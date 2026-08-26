/**
 * @module PlayerStatCalculator
 * @category systems
 * @description 플레이어 동적 스탯 연산, 스탯 Breakdown 기여도 분석, 속성 저항, 대미지 감쇄 및 속도 산출 전담 시스템
 * @purity Stateless System
 * @dependencies Tags.js, MonsterRegistry.js, Perks.js, TraceLogger.js
 * @exports PlayerStatCalculator
 */

import { PREFIX_TAGS, SUFFIX_TAGS, ELEMENT_METADATA } from '../entities/Tags.js';
import { getSpeciesConfig, getSpeciesKeyByName } from '../entities/MonsterRegistry.js';
import { MONSTER_PERKS } from '../entities/Perks.js';
import { TraceLogger } from '../core/TraceLogger.js';

const DEFAULT_SPECIES = 'HUMAN';

export class PlayerStatCalculator {
  /**
   * 플레이어의 4대/5대 스탯을 실시간 계산하고 기여도(Breakdown)를 산출합니다.
   * @param {Object} player - 플레이어 인스턴스
   * @param {string} name - 스탯 식별자 ('str', 'dex', 'con', 'int', 'cha')
   * @returns {{ finalValue: number, contributions: Array<{ source: string, value: number, color: string }> }}
   */
  static calculateEffectiveStatWithBreakdown(player, name) {
    // 캐시 유효성 확인
    if (!player._isDirty && player._statCache && player._statCache[name] !== undefined && player._statCache[name] !== null) {
      return {
        finalValue: player._statCache[name],
        contributions: player._statBreakdownCache[name] || []
      };
    }

    const configKey = player.mimicCore.coreType || getSpeciesKeyByName(player.mimicCore.name || DEFAULT_SPECIES);
    let contributions = [];

    TraceLogger.log('STATS', `플레이어 실시간 스탯 재계산 실행 | 대상 스탯: ${name.toUpperCase()}`);

    // 1. Resolve Core Base & Core Max limits for growth calculations
    let coreBase = 8;
    let coreMax = 150;
    let displayCoreName = player.mimicCore.name || "인간 여행자";
    
    const config = getSpeciesConfig(configKey);
    if (config) {
      coreBase = config.coreBase && config.coreBase[name] !== undefined ? config.coreBase[name] : 8;
      coreMax = config.coreMax && config.coreMax[name] !== undefined ? config.coreMax[name] : 150;
      displayCoreName = config.displayName || config.name;
    }

    contributions.push({ source: `메인 코어 기본 (${displayCoreName})`, value: coreBase, color: "#cbd5e1" });

    // 2. Resolve growth bonus index scaled by Lore Level multiplier
    const L = player.level;
    const phi = Math.pow(Math.log(L) / Math.log(100), 1.5);
    const loreMult = player.body ? player.body.getLoreMultiplier(configKey) : 1.0;
    const growthBonus = Math.floor((coreMax - coreBase) * (isNaN(phi) ? 0 : phi) * loreMult);

    if (growthBonus > 0) {
      contributions.push({ source: `레벨 성장 보너스 (Lv.${L})`, value: growthBonus, color: "#a855f7" });
    }

    // 3. Base + permanent legacy + growth addition
    const legacyVal = (player.legacyStats && player.legacyStats[name]) || 0;
    if (legacyVal > 0) {
      contributions.push({ source: "영구 포식 유산", value: legacyVal, color: "#10b981" });
    }

    let statValue = coreBase + legacyVal + growthBonus;

    // 4. Sub-cores stat adjustments
    const subCores = [player.equipment.subCore1, player.equipment.subCore2];
    const getSubBase = (subCoreObj, sName) => {
      if (!subCoreObj) return 5;
      const subKey = subCoreObj.coreType || getSpeciesKeyByName(subCoreObj.name || '');
      const subConfig = getSpeciesConfig(subKey);
      if (subConfig && subConfig.coreBase && subConfig.coreBase[sName] !== undefined) {
        return subConfig.coreBase[sName];
      }
      return 5;
    };

    let idx = 1;
    for (const subCore of subCores) {
      if (subCore) {
        const subBase = getSubBase(subCore, name);
        const subLoreMult = player.body ? player.body.getLoreMultiplier(subCore.coreType || DEFAULT_SPECIES) : 1.0;
        const ratio = (0.20 + (subCore.fusionLevel || 0) * 0.02) * subLoreMult;
        const subBonus = Math.max(1, Math.floor(subBase * ratio));
        
        contributions.push({ source: `보조 코어 ${idx} (${subCore.name || subCore.coreType})`, value: subBonus + (subCore.fusionLevel || 0), color: "#3b82f6" });
        statValue += subBonus + (subCore.fusionLevel || 0);
      }
      idx++;
    }

    // 5. 일반 장착 장비 베이스 스탯 추가
    for (const key in player.equipment) {
      if (key === 'subCore1' || key === 'subCore2') continue;
      const gear = player.equipment[key];
      if (gear && gear.statBonuses && gear.statBonuses[name]) {
        const nameKorMap = {
          weapon: '근접무기',
          shield: '방패',
          bow: '활',
          quiver: '화살통',
          armor: '갑옷',
          helmet: '투구',
          gloves: '장갑',
          boots: '신발',
          cloak: '망토',
          ring1: '반지1',
          ring2: '반지2',
          amulet: '목걸이'
        };
        let nameKor = nameKorMap[key] || '장신구';
        contributions.push({ source: `장비 장착 (${nameKor}: ${gear.name})`, value: gear.statBonuses[name], color: "#60a5fa" });
        statValue += gear.statBonuses[name];
      }
    }
    if (player.equippedLamp && player.equippedLamp.statBonuses && player.equippedLamp.statBonuses[name]) {
      contributions.push({ source: `광원 등불 (${player.equippedLamp.name})`, value: player.equippedLamp.statBonuses[name], color: "#eab308" });
      statValue += player.equippedLamp.statBonuses[name];
    }

    // 6. 접두/접미 태그 능력치 추가
    const prefixSubCoreLevels = {};
    const suffixSubCoreLevels = {};
    const uniquePrefixes = new Set();
    const uniqueSuffixes = new Set();

    if (player.mimicCore) {
      if (player.mimicCore.prefixes) {
        for (const p of player.mimicCore.prefixes) {
          uniquePrefixes.add(p);
          prefixSubCoreLevels[p] = Math.max(prefixSubCoreLevels[p] || 0, player.mimicCore.fusionLevel || 0);
        }
      }
      if (player.mimicCore.suffixes) {
        for (const s of player.mimicCore.suffixes) {
          uniqueSuffixes.add(s);
          suffixSubCoreLevels[s] = Math.max(suffixSubCoreLevels[s] || 0, player.mimicCore.fusionLevel || 0);
        }
      }
    }

    for (const key in player.equipment) {
      const gear = player.equipment[key];
      if (!gear) continue;
      const isSubCore = (key === 'subCore1' || key === 'subCore2');
      if (gear.prefixes) {
        for (const p of gear.prefixes) {
          uniquePrefixes.add(p);
          if (isSubCore) {
            prefixSubCoreLevels[p] = Math.max(prefixSubCoreLevels[p] || 0, gear.fusionLevel || 0);
          }
        }
      }
      if (gear.suffixes) {
        for (const s of gear.suffixes) {
          uniqueSuffixes.add(s);
          if (isSubCore) {
            suffixSubCoreLevels[s] = Math.max(suffixSubCoreLevels[s] || 0, gear.fusionLevel || 0);
          }
        }
      }
    }

    if (player.equippedLamp) {
      if (player.equippedLamp.prefixes) {
        for (const p of player.equippedLamp.prefixes) {
          uniquePrefixes.add(p);
        }
      }
      if (player.equippedLamp.suffixes) {
        for (const s of player.equippedLamp.suffixes) {
          uniqueSuffixes.add(s);
        }
      }
    }

    for (const pKey of uniquePrefixes) {
      const baseBonus = PREFIX_TAGS[pKey]?.stats[name] || 0;
      if (baseBonus !== 0) {
        let finalBonus = baseBonus;
        if (pKey in prefixSubCoreLevels) {
          finalBonus = Math.floor(baseBonus * (1 + prefixSubCoreLevels[pKey] * 0.10));
        }
        contributions.push({ source: `접두 아우라 [${PREFIX_TAGS[pKey].name}]`, value: finalBonus, color: "#fbbf24" });
        statValue += finalBonus;
      }
    }

    for (const sKey of uniqueSuffixes) {
      const baseBonus = SUFFIX_TAGS[sKey]?.stats[name] || 0;
      if (baseBonus !== 0) {
        let finalBonus = baseBonus;
        if (sKey in suffixSubCoreLevels) {
          finalBonus = Math.floor(baseBonus * (1 + suffixSubCoreLevels[sKey] * 0.10));
        }
        contributions.push({ source: `접미 접사 [${SUFFIX_TAGS[sKey].name}]`, value: finalBonus, color: "#38bdf8" });
        statValue += finalBonus;
      }
    }

    // 7. 스킬 패시브 배율 보정 적용
    const activeTags = player.compileActiveTags ? player.compileActiveTags() : {};
    let multiplier = 1.0;
    let multiplierName = "";
    
    if (name === 'str') {
      const strBoost = activeTags["STR_BOOST"] || 0;
      if (strBoost > 0) {
        multiplier += strBoost * 0.10;
        multiplierName = `힘 시너지 증폭 STR_BOOST (x${multiplier.toFixed(2)})`;
      }
    } else if (name === 'con') {
      const conBoost = activeTags["CON_BOOST"] || 0;
      if (conBoost > 0) {
        multiplier += conBoost * 0.10;
        multiplierName = `생명 시너지 증폭 CON_BOOST (x${multiplier.toFixed(2)})`;
      }
    } else if (name === 'dex') {
      const dexBoost = activeTags["DEX_BOOST"] || 0;
      if (dexBoost > 0) {
        multiplier += dexBoost * 0.10;
        multiplierName = `민첩 시너지 증폭 DEX_BOOST (x${multiplier.toFixed(2)})`;
      }
    } else if (name === 'int') {
      const intBoost = activeTags["INT_BOOST"] || 0;
      if (intBoost > 0) {
        multiplier += intBoost * 0.10;
        multiplierName = `지능 시너지 증폭 INT_BOOST (x${multiplier.toFixed(2)})`;
      }
    } else if (name === 'wis') {
      const wisBoost = activeTags["WIS_BOOST"] || 0;
      if (wisBoost > 0) {
        multiplier += wisBoost * 0.10;
        multiplierName = `지혜 시너지 증폭 WIS_BOOST (x${multiplier.toFixed(2)})`;
      }
    } else if (name === 'chr' || name === 'cha') {
      const chrBoost = activeTags["CHR_BOOST"] || activeTags["CHA_BOOST"] || 0;
      if (chrBoost > 0) {
        multiplier += chrBoost * 0.10;
        multiplierName = `매력 시너지 증폭 CHR_BOOST (x${multiplier.toFixed(2)})`;
      }
    }

    if (multiplier > 1.0) {
      const baseTotal = statValue;
      statValue = Math.floor(statValue * multiplier);
      contributions.push({ source: multiplierName, value: statValue - baseTotal, color: "#f43f5e" });
    }

    // 부정적 돌연변이 디메리트 적용
    if (name === 'dex' && activeTags["SLOW_REFLEX"]) {
      contributions.push({ source: "돌연변이 페널티 (둔한 반사)", value: -3, color: "#ef4444" });
      statValue -= 3;
    } else if (name === 'int' && activeTags["DULL_MIND"]) {
      contributions.push({ source: "돌연변이 페널티 (둔한 정신)", value: -3, color: "#ef4444" });
      statValue -= 3;
    }

    const finalVal = Math.max(1, Math.min(999, statValue));
    
    // 캐시 저장
    if (player._statCache) {
      player._statCache[name] = finalVal;
      player._statBreakdownCache[name] = contributions;
      if (['str', 'dex', 'con', 'int'].every(k => player._statCache[k] !== null)) {
        player._isDirty = false;
      }
    }

    return {
      finalValue: finalVal,
      contributions: contributions
    };
  }

  /**
   * 플레이어 실시간 스피드(행동 속도) 계산
   * @param {Object} player
   * @returns {number}
   */
  static calculateSpeed(player) {
    const dex = this.calculateEffectiveStatWithBreakdown(player, 'dex').finalValue;
    let calculatedSpeed = dex < 100 ? (4 + 6 * (dex / 100)) : (10 + (dex - 100) * 0.0375);

    let speedMult = player.getPerkEffectMultiplier ? player.getPerkEffectMultiplier("speedMultiplier") : 1.0;

    const activeTags = player.compileActiveTags ? player.compileActiveTags() : {};
    const hasteStacks = activeTags["HASTE_UNIT"] || 0;
    if (hasteStacks > 0) {
      speedMult *= (1.0 + hasteStacks * 0.15);
    }

    if (player.debuffs && player.debuffs.frost > 0) {
      speedMult *= 0.70;
    }

    const berserkRage = activeTags["BERSERK_RAGE"] || 0;
    if (berserkRage > 0 && player.stats && player.stats.hp <= player.stats.maxHp * 0.5) {
      speedMult *= (1.0 + berserkRage * 0.25);
    }

    if (player.body && player.body.getSpeedModifier) {
      speedMult *= player.body.getSpeedModifier();
    }

    return Math.max(3.5, calculatedSpeed * speedMult);
  }

  /**
   * 플레이어 최대 체력(Max HP) 계산
   * @param {Object} player
   * @returns {number}
   */
  static calculateMaxHp(player) {
    const con = this.calculateEffectiveStatWithBreakdown(player, 'con').finalValue;
    const baseMaxHp = con * 5 + player.level * 2;
    const hpMult = player.getPerkEffectMultiplier ? player.getPerkEffectMultiplier("hpMultiplier") : 1.0;
    return Math.floor(baseMaxHp * hpMult);
  }


  /**
   * 물리 고정 대미지 감쇄량 계산
   * @param {Object} player
   * @param {Object} [activeTags=null]
   * @returns {number}
   */
  static calculateFlatDamageReduction(player, activeTags = null) {
    if (!player) return 0;
    const tags = activeTags || (player.compileActiveTags ? player.compileActiveTags() : {});
    const stacks = tags["PHYS_RESIST"] || 0;
    if (stacks <= 0) return 0;

    const conVal = player.getEffectiveStat ? player.getEffectiveStat('con') : (player.stats?.con || 10);
    const conMod = Math.floor(conVal / 10);
    const flatPerStack = 1 + Math.floor(conMod * 0.5);

    return stacks * flatPerStack;
  }
}
