/**
 * @module MonsterAISystem
 * @category systems
 * @description 몬스터 A* 패스파인딩, 행동 결정(Act), Bat 도주 AI, 브레스/스킬 쿨다운 및 버프/힐 틱 전담 시스템
 * @purity Stateless System
 * @dependencies MonsterRegistry.js, Tags.js, Perks.js, TraceLogger.js, BossPhaseEngine.js
 * @exports MonsterAISystem
 */

import { getSpeciesConfig, MONSTER_GROWTH_PATTERNS } from '../entities/MonsterRegistry.js';
import { MONSTER_PERKS } from '../entities/Perks.js';
import { PREFIX_TAGS, SUFFIX_TAGS } from '../entities/Tags.js';
import { TraceLogger } from '../core/TraceLogger.js';
import { bossPhaseEngine } from './BossPhaseEngine.js';
import { TomeFlagResolver } from './TomeFlagResolver.js';
import { TomeSpellEngine } from './TomeSpellEngine.js';
import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';

export class MonsterAISystem {
  /**
   * 몬스터의 주문 시전 빈도를 파싱합니다 (e.g. '1_IN_4' -> 0.25, 기본 1/6).
   * @param {Object} monster
   * @returns {number}
   */
  static getMonsterSpellFrequency(monster) {
    if (!monster) return 1 / 6;
    let spells = [];
    if (monster.spells) spells = monster.spells;
    else if (monster.tomeKey && TOME_MONSTERS_DATA[monster.tomeKey]) spells = TOME_MONSTERS_DATA[monster.tomeKey].spells || [];

    for (const s of spells) {
      if (typeof s === 'string' && s.startsWith('1_IN_')) {
        const denom = parseInt(s.replace('1_IN_', ''), 10);
        if (!isNaN(denom) && denom > 0) return 1 / denom;
      }
      if (typeof s === 'string' && s.startsWith('FREQ_')) {
        const freq = parseInt(s.replace('FREQ_', ''), 10);
        if (!isNaN(freq) && freq > 0) return freq / 100;
      }
    }
    return 1 / 6;
  }

  /**
   * 몬스터 주문 1회를 실행하고 쿨다운을 등록합니다.
   * @param {Object} monster
   * @param {Object} spellObj - { key: string, spec: Object }
   * @param {Object} player
   * @param {Object} gameCtx
   * @param {Function} addLogEntry
   */
  static executeMonsterSpell(monster, spellObj, player, gameCtx, addLogEntry) {
    if (!monster.cooldowns) monster.cooldowns = {};
    const cd = spellObj.spec.cooldown || 4;
    monster.cooldowns[spellObj.key] = cd;
    if (spellObj.spec.type === 'BREATH') {
      monster.breathCooldown = cd;
    }

    TomeSpellEngine.castSpell({
      spellKey: spellObj.key,
      caster: monster,
      target: player,
      game: gameCtx,
      isPlayer: false
    });
  }

  /**
   * 몬스터 턴 행동 실행 및 AI 결정 (TomeNET 정통 5단계 AI 의사결정 트리)
   * @param {Object} monster - 몬스터 객체
   * @param {Object} player - 플레이어 객체
   * @param {Object} map - 맵 객체
   * @param {Function} isMonsterAt - 특정 좌표에 몬스터 존재 여부 콜백
   * @param {Function} attackPlayer - 플레이어 공격 콜백
   * @param {Function} useMonsterBreath - 브레스 발동 콜백
   * @param {Function} addLogEntry - 로그 출력 콜백
   */
  static act(monster, player, map, isMonsterAt, attackPlayer, useMonsterBreath, addLogEntry) {
    if (!monster || monster.stats.hp <= 0) return;

    // 원소 아우라 및 디버프 턴수 차감
    if (monster.elementalAura) {
      for (const key in monster.elementalAura) {
        if (monster.elementalAura[key] > 0) monster.elementalAura[key]--;
      }
    }
    if (monster.isSuperconducted > 0) {
      monster.isSuperconducted--;
    }

    const dx = player.x - monster.x;
    const dy = player.y - monster.y;
    const dist = Math.hypot(dx, dy);

    // 플레이어 활성 시야 범위 초과 시 수면 처리
    const activeSight = Math.max(10.5, (player.lightRange || 1) - 0.5);
    if (dist > activeSight && !monster.isAggroed) {
      return;
    }

    if (monster.manaShield && monster.manaShield > 0) {
      monster.manaShieldDuration--;
      if (monster.manaShieldDuration <= 0) {
        monster.manaShield = 0;
        addLogEntry(`[MonsterSkill] 👼 ${monster.displayName || monster.name}의 마나 실드가 지속시간 만료로 소멸했습니다.`, `combat`);
      }
    }

    if (monster.debuffs) {
      if (monster.debuffs.paralyzed) {
        if (monster.debuffs.paralyzeTurns && monster.debuffs.paralyzeTurns > 1) {
          monster.debuffs.paralyzeTurns--;
        } else {
          monster.debuffs.paralyzed = false;
        }
        addLogEntry(`[Debuff] ⚡ ${monster.displayName || monster.name}가 마비되어 이번 턴 행동할 수 없습니다!`, `combat`);
        return;
      }
      if (monster.debuffs.poison > 0) {
        const poisonDmg = 2;
        monster.stats.hp = Math.max(0, monster.stats.hp - poisonDmg);
        addLogEntry(`[Debuff] 🧪 ${monster.displayName || monster.name}가 독/부식으로 인해 ${poisonDmg}의 지속 피해를 입습니다! (HP: ${monster.stats.hp}/${monster.stats.maxHp})`, `combat`);
        monster.debuffs.poison--;
        if (monster.stats.hp <= 0) {
          monster.diedFromDot = true;
          return;
        }
      }
      if (monster.debuffs.frost > 0) {
        monster.debuffs.frost--;
      }
      if (monster.debuffs.magicVulnerability > 0) {
        monster.debuffs.magicVulnerability--;
      }
    }

    // Pure Data-Oriented Regeneration (No hardcoded species names)
    if ((TomeFlagResolver.hasFlag(monster, 'REGEN') || TomeFlagResolver.hasFlag(monster, 'REGENERATE')) && monster.stats.hp < monster.stats.maxHp) {
      const healAmt = Math.max(1, Math.floor(monster.stats.maxHp * 0.05));
      monster.stats.hp = Math.min(monster.stats.maxHp, monster.stats.hp + healAmt);
      addLogEntry(`[MonsterSkill] 🩸 ${monster.displayName || monster.name}이(가) 재생 능력으로 체력 ${healAmt}을(를) 회복했습니다. (HP: ${monster.stats.hp}/${monster.stats.maxHp})`, `loot`);
    }

    // Cooldown decrements
    if (monster.cooldowns) {
      for (const k in monster.cooldowns) {
        if (monster.cooldowns[k] > 0) monster.cooldowns[k]--;
      }
    }
    if (monster.breathCooldown > 0) {
      monster.breathCooldown--;
    }
    if (monster.giantBloodCooldown > 0) {
      monster.giantBloodCooldown--;
    }
    if (monster.hasteTurns > 0) {
      monster.hasteTurns--;
    }

    // 50F 모르고스 전용 3단 페이즈 스킬 실행
    if (bossPhaseEngine.isMorgoth(monster)) {
      const executed = bossPhaseEngine.executeBossAction(monster, player, {
        map,
        addLogEntry,
        effects: player.game?.effects || [],
        monsters: map?.monsters || [],
        player
      });
      if (executed && Math.random() < 0.6) {
        return;
      }
    }

    const config = getSpeciesConfig(monster.type);
    const gameCtx = player.game || {
      map,
      player,
      monsters: (map && map.monsters) || [],
      isMonsterAt,
      addLogEntry
    };

    // ----------------------------------------------------
    // TomeNET 5-Stage AI Decision Tree
    // ----------------------------------------------------
    const spells = TomeSpellEngine.resolveMonsterSpells(monster);
    const hasLineOfSight = !map || !map.isTransparent || map.isTransparent(monster.x, monster.y, player.x, player.y);
    const isSpellReady = (spKey) => (!monster.cooldowns || (monster.cooldowns[spKey] || 0) <= 0);

    if (spells.length > 0 && dist <= 7.5) {
      // 1단계: 자가 생존/회복 (HP < 35% & HEAL / BLINK / TPORT)
      if (monster.stats.hp < monster.stats.maxHp * 0.35) {
        const healSpell = spells.find(s => s.key === 'HEAL' && isSpellReady('HEAL'));
        const escSpell = spells.find(s => (s.key === 'BLINK' || s.key === 'TPORT') && isSpellReady(s.key));
        const chosenSurvival = healSpell || escSpell;

        if (chosenSurvival) {
          this.executeMonsterSpell(monster, chosenSurvival, player, gameCtx, addLogEntry);
          return;
        }
      }

      // Check Spell Frequency Roll (e.g. 1_IN_4 -> 25%, default 1/6)
      const freq = this.getMonsterSpellFrequency(monster);
      const shouldCast = Math.random() < freq;

      if (shouldCast) {
        // 2단계: 가속 버프 (비가속 & HASTE)
        if ((!monster.hasteTurns || monster.hasteTurns <= 0) && isSpellReady('HASTE')) {
          const hasteSpell = spells.find(s => s.key === 'HASTE');
          if (hasteSpell) {
            this.executeMonsterSpell(monster, hasteSpell, player, gameCtx, addLogEntry);
            return;
          }
        }

        // 3단계: 원거리 포격 (LOS 직선 시야 & 사거리 2~6.5칸: 브레스 -> 광역 볼 -> 볼트/화살)
        if (hasLineOfSight && dist >= 1.5 && dist <= 6.5) {
          // 3-1. 브레스 (BR_*)
          const breathSpell = spells.find(s => s.spec.type === 'BREATH' && isSpellReady(s.key));
          if (breathSpell) {
            this.executeMonsterSpell(monster, breathSpell, player, gameCtx, addLogEntry);
            return;
          }

          // 3-2. 광역 볼 (BA_*)
          const ballSpell = spells.find(s => s.spec.type === 'AOE' && isSpellReady(s.key));
          if (ballSpell) {
            this.executeMonsterSpell(monster, ballSpell, player, gameCtx, addLogEntry);
            return;
          }

          // 3-3. 볼트 / 화살 / 투사체 (BO_*, MISSILE, ARROW_*, ROCKET)
          const boltSpell = spells.find(s => s.spec.type === 'PROJECTILE' && !s.key.startsWith('CAUSE_') && s.key !== 'MIND_BLAST' && s.key !== 'BRAIN_SMASH' && s.key !== 'HAND_DOOM' && isSpellReady(s.key));
          if (boltSpell) {
            this.executeMonsterSpell(monster, boltSpell, player, gameCtx, addLogEntry);
            return;
          }
        }

        // 4단계: 소환 및 전장 제어 (S_*, DARKNESS, SHRIEK, TRAPS, MULTIPLY)
        const summonOrControl = spells.find(s => (s.spec.type === 'SUMMON' || s.key === 'DARKNESS' || s.key === 'SHRIEK' || s.key === 'TRAPS' || s.key === 'MULTIPLY') && isSpellReady(s.key));
        if (summonOrControl) {
          this.executeMonsterSpell(monster, summonOrControl, player, gameCtx, addLogEntry);
          return;
        }

        // 5단계: 디버프 및 저주 (BLIND, CONF, SCARE, HOLD, SLOW, DRAIN_MANA, CAUSE_*, MIND_BLAST, BRAIN_SMASH, TELE_TO, TELE_AWAY, FORGET)
        const debuffOrCurse = spells.find(s => (s.spec.type === 'DEBUFF' || s.key.startsWith('CAUSE_') || s.key === 'MIND_BLAST' || s.key === 'BRAIN_SMASH' || s.key === 'HAND_DOOM' || s.key === 'TELE_TO' || s.key === 'TELE_AWAY' || s.key === 'FORGET') && isSpellReady(s.key));
        if (debuffOrCurse) {
          this.executeMonsterSpell(monster, debuffOrCurse, player, gameCtx, addLogEntry);
          return;
        }
      }
    }

    // ----------------------------------------------------
    // Fallback: Movement or Melee Attack
    // ----------------------------------------------------
    if (dist <= 6.5) {
      if (config.aiPattern === 'BREATH' && monster.breathCooldown <= 0) {
        const triggeredBreath = useMonsterBreath(monster, dx, dy, dist);
        if (triggeredBreath) return;
      }

      if (config.aiPattern === 'FLEE') {
        this.runBatAI(monster, player, map, isMonsterAt, attackPlayer, dx, dy, dist);
      } else {
        this.runStandardMonsterAI(monster, player, map, isMonsterAt, attackPlayer, dx, dy, dist);
      }
    }
  }

  /**
   * 표준 몬스터 근접 공격 및 추적 AI
   */
  static runStandardMonsterAI(monster, player, map, isMonsterAt, attackPlayer, dx, dy, dist) {
    if (dist <= 1.5) {
      attackPlayer(monster, player);
    } else {
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      const nextX = monster.x + sx;
      const nextY = monster.y + sy;

      if (map.isWalkable(nextX, nextY) && !isMonsterAt(nextX, nextY) && !(nextX === player.x && nextY === player.y)) {
        monster.x = nextX;
        monster.y = nextY;
      } else if (sx !== 0 && map.isWalkable(monster.x + sx, monster.y) && !isMonsterAt(monster.x + sx, monster.y) && !(monster.x + sx === player.x && monster.y === player.y)) {
        monster.x += sx;
      } else if (sy !== 0 && map.isWalkable(monster.x, monster.y + sy) && !isMonsterAt(monster.x, monster.y + sy) && !(monster.x === player.x && monster.y + sy === player.y)) {
        monster.y += sy;
      }
    }
  }

  /**
   * 박쥐(Bat) 힛앤런 도주 AI
   */
  static runBatAI(monster, player, map, isMonsterAt, attackPlayer, dx, dy, dist) {
    if (monster.batFleeTurns > 0) {
      monster.batFleeTurns--;
      let targetX = monster.x;
      let targetY = monster.y;
      let maxDist = dist;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if (ox === 0 && oy === 0) continue;
          const nextX = monster.x + ox;
          const nextY = monster.y + oy;

          if (map.isWalkable(nextX, nextY) && !isMonsterAt(nextX, nextY) && !(nextX === player.x && nextY === player.y)) {
            const curDx = player.x - nextX;
            const curDy = player.y - nextY;
            const curDist = Math.sqrt(curDx * curDx + curDy * curDy);
            if (curDist > maxDist) {
              maxDist = curDist;
              targetX = nextX;
              targetY = nextY;
            }
          }
        }
      }
      monster.x = targetX;
      monster.y = targetY;
    } else if (dist <= 1.5) {
      attackPlayer(monster, player);
      monster.batFleeTurns = Math.floor(Math.random() * 2) + 2;
    } else {
      this.runStandardMonsterAI(monster, player, map, isMonsterAt, attackPlayer, dx, dy, dist);
    }
  }

  /**
   * 몬스터 턴 버프/힐 틱 처리 (성직자 힐, 주술사 블러드러스트 등)
   */
  static tickBuffsAndHeals(monster, allMonsters, addLogEntry) {
    if (monster.bloodLustTurns && monster.bloodLustTurns > 0) {
      monster.bloodLustTurns--;
      if (monster.bloodLustTurns === 0) {
        addLogEntry(`[MonsterSkill] 🩸 ${monster.displayName}의 피의 갈망 버프 효과가 만료되었습니다.`, `loot`);
      }
    }
    if (monster.priestHealCooldown && monster.priestHealCooldown > 0) {
      monster.priestHealCooldown--;
    }
    if (monster.shamanBuffCooldown && monster.shamanBuffCooldown > 0) {
      monster.shamanBuffCooldown--;
    }

    if (monster.suffixes && monster.suffixes.includes("PRIEST") && (!monster.priestHealCooldown || monster.priestHealCooldown <= 0)) {
      const woundedAllies = allMonsters.filter(m => {
        if (m === monster || m.stats.hp <= 0) return false;
        const dx = m.x - monster.x;
        const dy = m.y - monster.y;
        return Math.sqrt(dx * dx + dy * dy) <= 4.5 && m.stats.hp < m.stats.maxHp;
      });

      let target = null;
      if (monster.stats.hp < monster.stats.maxHp * 0.7) {
        target = monster;
      } else if (woundedAllies.length > 0) {
        woundedAllies.sort((a, b) => (a.stats.hp / a.stats.maxHp) - (b.stats.hp / b.stats.maxHp));
        target = woundedAllies[0];
      }

      if (target) {
        const healAmt = Math.max(6, Math.floor(target.stats.maxHp * 0.25));
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmt);
        monster.priestHealCooldown = 5;
        addLogEntry(`[MonsterSkill] ✨ 사제 ${monster.displayName}가 신성 치유의 기도를 올려 [${target.displayName}]의 체력을 [+${healAmt} HP 회복] 시켰습니다!`, `loot`);
      }
    }

    if (monster.suffixes && monster.suffixes.includes("SHAMAN") && (!monster.shamanBuffCooldown || monster.shamanBuffCooldown <= 0)) {
      const allies = allMonsters.filter(m => {
        if (m === monster || m.stats.hp <= 0 || m.bloodLustTurns > 0) return false;
        const dx = m.x - monster.x;
        const dy = m.y - monster.y;
        return Math.sqrt(dx * dx + dy * dy) <= 4.5;
      });

      if (allies.length > 0 || !monster.bloodLustTurns) {
        let target = monster;
        if (allies.length > 0) {
          target = allies[Math.floor(Math.random() * allies.length)];
        }

        target.bloodLustTurns = 3;
        monster.shamanBuffCooldown = 6;
        addLogEntry(`[MonsterSkill] 🩸 ${monster.displayName}가 정령 피의 갈망을 포효하여 [${target.displayName}]의 공격 대미지를 3턴간 [+30% 증폭] 시켰습니다!`, `loot`);
      }
    }
  }

  /**
   * 몬스터 4대 스탯 Breakdown 기여도 분석
   */
  static calculateMonsterBreakdown(monster, name) {
    if (!monster._isDirty && monster._statCache && monster._statCache[name] !== undefined && monster._statCache[name] !== null) {
      return {
        finalValue: monster._statCache[name],
        contributions: monster._statBreakdownCache[name] || []
      };
    }

    const config = getSpeciesConfig(monster.type);
    let contributions = [];

    TraceLogger.log('STATS', `몬스터 실시간 스탯 재계산 실행 | 대상: ${monster.name} | 스탯: ${name.toUpperCase()}`);

    let coreBase = config.coreBase && config.coreBase[name] !== undefined ? config.coreBase[name] : 8;
    let coreMax = config.coreMax && config.coreMax[name] !== undefined ? config.coreMax[name] : 150;
    let displayCoreName = config.displayName || config.name;

    contributions.push({ source: `종족 기본 (${displayCoreName})`, value: coreBase, color: "#cbd5e1" });

    const L = monster.level || 1;
    const phi = Math.pow(Math.log(L) / Math.log(100), 1.5);
    const growthCoeff = isNaN(phi) ? 0 : phi;

    const gType = config.growthType || 'BALANCED';
    const pattern = MONSTER_GROWTH_PATTERNS[gType] || MONSTER_GROWTH_PATTERNS.BALANCED;
    const statGrowth = Math.floor((coreMax - coreBase) * growthCoeff * (pattern[name] || 1.0));

    if (statGrowth > 0) {
      contributions.push({ source: `레벨 성장 (Lv.${L})`, value: statGrowth, color: "#a855f7" });
    }

    let statValue = coreBase + statGrowth;

    // 접두 태그 보너스
    if (monster.prefixes) {
      for (const p of monster.prefixes) {
        const pTag = PREFIX_TAGS[p];
        if (pTag && pTag.stats && pTag.stats[name]) {
          contributions.push({ source: `접두 아우라 [${pTag.name}]`, value: pTag.stats[name], color: "#fbbf24" });
          statValue += pTag.stats[name];
        }
      }
    }

    // 접미 태그 보너스
    if (monster.suffixes) {
      for (const s of monster.suffixes) {
        const sTag = SUFFIX_TAGS[s];
        if (sTag && sTag.stats && sTag.stats[name]) {
          contributions.push({ source: `접미 접사 [${sTag.name}]`, value: sTag.stats[name], color: "#38bdf8" });
          statValue += sTag.stats[name];
        }
      }
    }

    // Perk 스탯 배율 적용
    const statWeights = { str: 1.0, int: 1.0, wis: 1.0, dex: 1.0, con: 1.0, chr: 1.0, cha: 1.0 };
    const perks = monster.getActivePerks ? monster.getActivePerks() : (monster.perks || []);
    for (let perkId of perks) {
      const perk = MONSTER_PERKS[perkId];
      if (perk && perk.effects && perk.effects.statWeights && perk.effects.statWeights[name]) {
        statWeights[name] *= perk.effects.statWeights[name];
      }
    }

    if (statWeights[name] && statWeights[name] !== 1.0) {
      const baseBefore = statValue;
      statValue = Math.floor(statValue * statWeights[name]);
      contributions.push({ source: `특성 배율 (${statWeights[name].toFixed(2)}x)`, value: statValue - baseBefore, color: "#f43f5e" });
    }

    const finalVal = Math.max(1, statValue);

    if (monster._statCache) {
      monster._statCache[name] = finalVal;
      monster._statBreakdownCache[name] = contributions;
      if (['str', 'int', 'wis', 'dex', 'con', 'chr'].every(k => monster._statCache[k] !== null)) {
        monster._isDirty = false;
      }
    }

    return {
      finalValue: finalVal,
      contributions: contributions
    };
  }
}
