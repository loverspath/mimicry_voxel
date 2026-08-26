/**
 * @module BossPhaseEngine
 * @category systems
 * @description 50F 모르고스의 옥좌 최종 보스전(Morgoth Encounter) 3단계 페이즈 전환 엔진, 암흑 장막/지진/소환/영혼 드레인 스킬 제어 및 승천 보상 파이프라인
 * @purity State Store / Logic System
 * @dependencies EventBus.js, GameEvents.js, Item.js, Monster.js, Effects.js, TomeMonstersData.js, TomeArtifactsData.js, UniqueMonsterManager.js, AscensionModalView.js
 * @exports BossPhaseEngine, bossPhaseEngine, BOSS_PHASES, MORGOTH_KEY
 */

import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';
import { Item } from '../entities/Item.js';
import { Monster } from '../entities/Monster.js';
import {
  MeleeSlashEffect,
  ProjectileEffect,
  ConeBreathEffect,
  FloatingTextEffect,
  AoEExplosionEffect,
  SkillBeamEffect
} from '../core/Effects.js';
import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { TOME_ARTIFACTS_DATA } from '../entities/TomeArtifactsData.js';
import { uniqueMonsterManager } from './UniqueMonsterManager.js';
import { saveAscensionRecord, calculateScore, serializeCombatStats, serializeEquipmentSlots, serializeInventoryItems, serializeRecentLogs } from '../ui/AscensionModalView.js';
import { LootSystem } from '../core/LootSystem.js';

export const MORGOTH_KEY = 'MON_MORGOTH_LORD_OF_DARKNESS';

/**
 * 50F 모르고스 3단계 페이즈 상수 설정
 */
export const BOSS_PHASES = {
  PHASE_1: {
    id: 1,
    key: 'PHASE_1',
    name: 'Phase 1: 암흑의 장막 (Darkness Veil)',
    minHpRatio: 0.70,
    color: '#60a5fa',
    bgAura: 'rgba(59, 130, 246, 0.15)',
    dialogue: '👑 [MORGOTH] "어리석은 필멸자여, 빛의 잔재를 쥐고 감히 나의 옥좌에 발을 들였느냐... 앙그반드의 영원한 암흑을 맞이하라!"',
    desc: '빛을 삼키는 어둠의 장막과 칠흑의 숨결로 침입자를 압박합니다.'
  },
  PHASE_2: {
    id: 2,
    key: 'PHASE_2',
    name: 'Phase 2: 대지 분쇄 & 친위대 소환 (Earth Shatter & Legion Summon)',
    minHpRatio: 0.30,
    color: '#f59e0b',
    bgAura: 'rgba(245, 158, 11, 0.25)',
    dialogue: '💥 [MORGOTH] "그론드(Grond)여, 저 벌레의 뼈를 가루로 만들어라! 앙그반드의 충신들이여, 옥좌를 침범한 자를 찢어발겨라!"',
    desc: '지축을 뒤흔드는 지진 충격파와 함께 앙그반드의 친위대(발록, 나즈굴)를 소환합니다.'
  },
  PHASE_3: {
    id: 3,
    key: 'PHASE_3',
    name: 'Phase 3: 앙그반드의 궁극 격노 (Wrath of Angband)',
    minHpRatio: 0.0,
    color: '#ef4444',
    bgAura: 'rgba(239, 68, 68, 0.35)',
    dialogue: '🔥 [MORGOTH] "크아아악! 감히 핑골핀에 이어 나에게 상처를 입히다니... 세상의 모든 영혼을 집어삼키는 절대 암흑의 격노를 보여주마!"',
    desc: '신격을 초월한 절대 암흑의 분노로 플레이어의 영혼을 드레인하고 초고속 연속 행동을 개시합니다.'
  }
};

export class BossPhaseEngine {
  constructor() {
    this.activeBoss = null;
    this.phase = 1;
    this.minionsSummoned = false;
    this.berserkActive = false;
    this.darknessVeilCooldown = 0;
    this.earthShatterCooldown = 0;
    this.soulDrainCooldown = 0;
    this.summonCooldown = 0;
  }

  /**
   * 대상 몬스터가 50F 최종 보스 모르고스인지 판별합니다.
   * @param {Object} monster 
   * @returns {boolean}
   */
  isMorgoth(monster) {
    if (!monster) return false;
    if (monster.isFinalBoss === true) return true;
    if (monster.uniqueKey === MORGOTH_KEY || monster.type === MORGOTH_KEY) return true;
    const name = monster.displayName || monster.name || '';
    if (name.includes('Morgoth') || name.includes('모르고스')) return true;
    return false;
  }

  /**
   * 50F 모르고스 조우 시 보스전 라이프사이클을 초기화합니다.
   * @param {Object} bossMonster 
   * @param {Object} game 
   */
  initBossEncounter(bossMonster, game) {
    if (!bossMonster) return;
    this.activeBoss = bossMonster;
    this.phase = 1;
    this.minionsSummoned = false;
    this.berserkActive = false;
    this.darknessVeilCooldown = 0;
    this.earthShatterCooldown = 0;
    this.soulDrainCooldown = 0;
    this.summonCooldown = 0;

    bossMonster.isFinalBoss = true;
    bossMonster.bossPhase = 1;
    bossMonster.uniqueKey = MORGOTH_KEY;

    // 보스 고유 스펙 보정
    if (bossMonster.stats) {
      bossMonster.stats.maxHp = Math.max(bossMonster.stats.maxHp || 15000, 15000);
      bossMonster.stats.hp = bossMonster.stats.maxHp;
    }

    if (game && typeof game.addLogEntry === 'function') {
      game.addLogEntry(`👑 [FINAL BOSS] 암흑의 군주 모르고스(Morgoth, Lord of Darkness)가 옥좌에서 일어섭니다!`, 'danger');
      game.addLogEntry(BOSS_PHASES.PHASE_1.dialogue, 'danger');
    }

    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit(GameEvents.BOSS_PHASE_CHANGE, {
        boss: bossMonster,
        fromPhase: 0,
        toPhase: 1,
        phaseConfig: BOSS_PHASES.PHASE_1
      });
    }
  }

  /**
   * 보스 HP 비율에 따른 현재 도달해야 할 페이즈 번호를 산출합니다.
   * @param {Object} bossMonster 
   * @returns {number} 1, 2, or 3
   */
  getPhase(bossMonster) {
    if (!bossMonster || !bossMonster.stats || bossMonster.stats.maxHp <= 0) return 1;
    const hpRatio = Math.max(0, bossMonster.stats.hp / bossMonster.stats.maxHp);
    if (hpRatio > BOSS_PHASES.PHASE_1.minHpRatio) return 1;
    if (hpRatio > BOSS_PHASES.PHASE_2.minHpRatio) return 2;
    return 3;
  }

  /**
   * 페이즈 번호에 따른 상세 메타데이터 반환
   * @param {number} phaseNum 
   * @returns {Object}
   */
  getPhaseConfig(phaseNum) {
    if (phaseNum === 2) return BOSS_PHASES.PHASE_2;
    if (phaseNum === 3) return BOSS_PHASES.PHASE_3;
    return BOSS_PHASES.PHASE_1;
  }

  /**
   * 보스 피격 후 HP 변동에 따른 페이즈 전환 여부를 검사하고 즉시 스킬/연출을 격발합니다.
   * @param {Object} bossMonster 
   * @param {Object} game 
   * @returns {{transitioned: boolean, fromPhase: number, toPhase: number}}
   */
  checkPhaseTransition(bossMonster, game) {
    if (!this.isMorgoth(bossMonster)) {
      return { transitioned: false, fromPhase: 1, toPhase: 1 };
    }

    const currentPhase = this.getPhase(bossMonster);
    const prevPhase = bossMonster.bossPhase || this.phase || 1;

    if (currentPhase > prevPhase) {
      bossMonster.bossPhase = currentPhase;
      this.phase = currentPhase;
      const cfg = this.getPhaseConfig(currentPhase);

      if (game && typeof game.addLogEntry === 'function') {
        game.addLogEntry(`⚡ [BOSS PHASE TRANSITION] === ${cfg.name} 진입! ===`, 'danger');
        game.addLogEntry(cfg.dialogue, 'danger');
      }

      // 페이즈별 즉발 트리거 실행
      if (currentPhase === 2) {
        this.summonAngbandMinions(bossMonster, game, 2);
        this.executeEarthShatter(bossMonster, game?.player, game);
      } else if (currentPhase === 3) {
        this.berserkActive = true;
        bossMonster.speed = (bossMonster.speed || 10) * 1.5;
        this.executeWrathOfAngband(bossMonster, game?.player, game);
      }

      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit(GameEvents.BOSS_PHASE_CHANGE, {
          boss: bossMonster,
          fromPhase: prevPhase,
          toPhase: currentPhase,
          phaseConfig: cfg
        });
      }

      return { transitioned: true, fromPhase: prevPhase, toPhase: currentPhase };
    }

    return { transitioned: false, fromPhase: prevPhase, toPhase: prevPhase };
  }

  /**
   * Phase 1 스킬: 암흑 장막 (Darkness Veil)
   * 주변을 짙은 어둠으로 뒤덮어 플레이어 시야를 차단하고 암흑 도트 피해 부여
   */
  executeDarknessVeil(bossMonster, player, game) {
    if (!bossMonster || !player || !game) return false;
    const mx = bossMonster.x || 0;
    const my = bossMonster.y || 0;

    if (game.effects && Array.isArray(game.effects)) {
      game.effects.push(new AoEExplosionEffect(mx, my, 4, 'DARK'));
    }

    const dx = (player.x || 0) - mx;
    const dy = (player.y || 0) - my;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 5.5) {
      const dmg = Math.floor(15 + Math.random() * 15);
      if (typeof player.takeDamage === 'function') {
        player.takeDamage(dmg);
      } else if (player.stats) {
        player.stats.hp = Math.max(0, player.stats.hp - dmg);
      }
      if (game.effects) {
        game.effects.push(new FloatingTextEffect(player.x, player.y, `-${dmg} (암흑 장막)`, '#818cf8', true));
      }
      if (game.addLogEntry) {
        game.addLogEntry(`🌌 [암흑 장막] 모르고스가 뿜어낸 칠흑의 장막이 시야를 잠식하며 ${dmg}의 암흑 피해를 입힙니다!`, 'danger');
      }
      return true;
    }
    return false;
  }

  /**
   * Phase 1 & 2 공용 스킬: 칠흑의 숨결 (Dark Breath)
   */
  executeDarkBreath(bossMonster, player, game) {
    if (!bossMonster || !player || !game) return false;
    const mx = bossMonster.x || 0;
    const my = bossMonster.y || 0;
    const px = player.x || 0;
    const py = player.y || 0;

    if (game.effects && Array.isArray(game.effects)) {
      game.effects.push(new ConeBreathEffect(mx, my, px, py, 'DARK'));
    }

    const dmg = Math.floor(25 + Math.random() * 25);
    if (typeof player.takeDamage === 'function') {
      player.takeDamage(dmg);
    } else if (player.stats) {
      player.stats.hp = Math.max(0, player.stats.hp - dmg);
    }

    if (game.effects) {
      game.effects.push(new FloatingTextEffect(px, py, `-${dmg} (칠흑 숨결)`, '#9333ea', true));
    }
    if (game.addLogEntry) {
      game.addLogEntry(`💨 [칠흑의 숨결] 모르고스가 심연의 암흑 브레스를 내뿜어 ${dmg}의 막대한 피해를 입혔습니다!`, 'danger');
    }
    return true;
  }

  /**
   * Phase 2 스킬: 대지 분쇄 (Earth Shatter / Grond Strike)
   * 앙그반드의 지반을 강타하여 광역 지진 물리 피해 및 충격파 발생
   */
  executeEarthShatter(bossMonster, player, game) {
    if (!bossMonster || !game) return false;
    const mx = bossMonster.x || 0;
    const my = bossMonster.y || 0;

    if (game.effects && Array.isArray(game.effects)) {
      game.effects.push(new AoEExplosionEffect(mx, my, 5, 'PHYSICAL'));
    }

    if (player) {
      const px = player.x || 0;
      const py = player.y || 0;
      const dist = Math.sqrt(Math.pow(px - mx, 2) + Math.pow(py - my, 2));

      if (dist <= 6.0) {
        const dmg = Math.floor(35 + Math.random() * 30);
        if (typeof player.takeDamage === 'function') {
          player.takeDamage(dmg);
        } else if (player.stats) {
          player.stats.hp = Math.max(0, player.stats.hp - dmg);
        }
        if (game.effects) {
          game.effects.push(new FloatingTextEffect(px, py, `-${dmg} 💥 대지분쇄`, '#ea580c', true));
        }
        if (game.addLogEntry) {
          game.addLogEntry(`💥 [대지 분쇄] 모르고스가 파멸의 철퇴 그론드로 지축을 내리찍어 ${dmg}의 지진 피해를 입혔습니다!`, 'danger');
        }
      }
    }
    return true;
  }

  /**
   * Phase 2 스킬: 앙그반드 친위대 소환 (Summon Balrog & Nazgul)
   * 모르고스 주변 빈 타일에 발록(Gothmog/Balrog) 및 나즈굴(Witch-King/Wraith)을 소환
   */
  summonAngbandMinions(bossMonster, game, count = 2) {
    if (!bossMonster || !game) return false;
    const mx = bossMonster.x || 0;
    const my = bossMonster.y || 0;
    const monsterList = game.dungeon?.monsters || game.monsters;
    if (!monsterList) return false;

    const minionTypes = [
      { key: 'MON_GOTHMOG_HIGH_CAPTAIN_OF_BALROGS', name: '발록 친위대장 고스모그', species: 'DEMON', char: 'U', color: '#ef4444' },
      { key: 'MON_WITCH_KING_OF_ANGMAR', name: '앙그마르의 마술사왕 나즈굴', species: 'WRAITH', char: 'W', color: '#a855f7' }
    ];

    let summonedCount = 0;
    const offsets = [
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
    ];

    for (let i = 0; i < count; i++) {
      const typeInfo = minionTypes[i % minionTypes.length];
      const offset = offsets[i % offsets.length];
      const sx = mx + offset.dx;
      const sy = my + offset.dy;

      // 맵 통과 가능 여부 확인
      const isBlocked = game.map ? (typeof game.map.isWalkable === 'function' ? !game.map.isWalkable(sx, sy) : (typeof game.map.isWall === 'function' ? game.map.isWall(sx, sy) : false)) : false;
      const isOccupied = monsterList.some(m => m.x === sx && m.y === sy);

      const spawnX = (!isBlocked && !isOccupied) ? sx : mx;
      const spawnY = (!isBlocked && !isOccupied) ? sy : my;

      const minion = new Monster(spawnX, spawnY, typeInfo.species || 'DEMON', 45, ['LEGENDARY'], ['CHAMPION']);
      minion._baseName = typeInfo.name;
      minion.uniqueKey = typeInfo.key;
      minion.color = typeInfo.color;
      minion.stats.hp = 850;
      minion.stats.maxHp = 850;
      minion.xpValue = 1500;

      monsterList.push(minion);
      summonedCount++;

      if (game.effects) {
        game.effects.push(new AoEExplosionEffect(spawnX, spawnY, 2, 'FIRE'));
      }
    }

    this.minionsSummoned = true;
    if (game.addLogEntry) {
      game.addLogEntry(`👹 [앙그반드 군단 소환] 모르고스의 호명에 응하여 앙그반드의 친위대(${summonedCount}체)가 전장에 출현했습니다!`, 'danger');
    }
    return true;
  }

  /**
   * Phase 3 스킬: 앙그반드의 궁극 격노 (Wrath of Angband)
   */
  executeWrathOfAngband(bossMonster, player, game) {
    if (!bossMonster || !game) return false;
    const mx = bossMonster.x || 0;
    const my = bossMonster.y || 0;

    if (game.effects && Array.isArray(game.effects)) {
      game.effects.push(new AoEExplosionEffect(mx, my, 6, 'CHAOS'));
    }

    if (game.addLogEntry) {
      game.addLogEntry(`🔥 [Wrath of Angband] 모르고스가 궁극의 암흑 격노를 폭발시켜 전신에 암흑 화염 오라를 휘감습니다!`, 'danger');
    }

    if (player) {
      this.executeSoulDrain(bossMonster, player, game);
    }
    return true;
  }

  /**
   * Phase 3 스킬: 광역 영혼 드레인 (Soul Drain / Nether Leach)
   * 플레이어의 HP/에너지를 흡수하고 모르고스의 체력을 회복
   */
  executeSoulDrain(bossMonster, player, game) {
    if (!bossMonster || !player || !game) return false;
    const px = player.x || 0;
    const py = player.y || 0;
    const mx = bossMonster.x || 0;
    const my = bossMonster.y || 0;

    if (game.effects && Array.isArray(game.effects)) {
      game.effects.push(new SkillBeamEffect(mx, my, px, py, '#8b5cf6'));
    }

    const drainDmg = Math.floor(40 + Math.random() * 35);
    if (typeof player.takeDamage === 'function') {
      player.takeDamage(drainDmg);
    } else if (player.stats) {
      player.stats.hp = Math.max(0, player.stats.hp - drainDmg);
    }

    // 보스 체력 회복
    if (bossMonster.stats) {
      bossMonster.stats.hp = Math.min(bossMonster.stats.maxHp, bossMonster.stats.hp + Math.floor(drainDmg * 0.5));
    }

    if (game.effects) {
      game.effects.push(new FloatingTextEffect(px, py, `-${drainDmg} 💀 영혼 드레인`, '#c084fc', true));
      game.effects.push(new FloatingTextEffect(mx, my, `+${Math.floor(drainDmg * 0.5)} 회복`, '#34d399', false));
    }

    if (game.addLogEntry) {
      game.addLogEntry(`💀 [영혼 드레인] 모르고스가 플레이어의 생명력을 흡수하여 ${drainDmg} 피해를 입히고 체력을 회복했습니다!`, 'danger');
    }
    return true;
  }

  /**
   * 몬스터 턴 중 보스 AI 행동 결정 및 격발
   * @param {Object} bossMonster 
   * @param {Object} player 
   * @param {Object} game 
   */
  executeBossAction(bossMonster, player, game) {
    if (!this.isMorgoth(bossMonster) || !player || !game) return false;

    const currentPhase = this.getPhase(bossMonster);
    const roll = Math.random();

    if (currentPhase === 1) {
      if (roll < 0.5) {
        return this.executeDarkBreath(bossMonster, player, game);
      } else {
        return this.executeDarknessVeil(bossMonster, player, game);
      }
    } else if (currentPhase === 2) {
      if (!this.minionsSummoned || roll < 0.25) {
        return this.summonAngbandMinions(bossMonster, game, 1);
      } else if (roll < 0.65) {
        return this.executeEarthShatter(bossMonster, player, game);
      } else {
        return this.executeDarkBreath(bossMonster, player, game);
      }
    } else {
      // Phase 3
      if (roll < 0.60) {
        return this.executeSoulDrain(bossMonster, player, game);
      } else {
        return this.executeEarthShatter(bossMonster, player, game);
      }
    }
  }

  /**
   * 100% 확정 드랍: 모르고스의 궁극 의태 코어 생성
   * @param {Object} bossMonster 
   * @returns {Item}
   */
  createMorgothCore(bossMonster) {
    const mx = bossMonster?.x || 0;
    const my = bossMonster?.y || 0;

    const core = new Item(
      mx, my,
      'CORE',
      '*',
      '#64748b',
      "모르고스의 의태 코어",
      0,
      null,
      { str: 30, dex: 20, con: 30, int: 25, cha: 20 },
      null,
      MORGOTH_KEY,
      [],
      [],
      ['LORD_OF_DARKNESS', 'MIMIC_ULTIMATE', 'WRATH_OF_ANGBAND', 'EARTH_SHATTER', 'DARKNESS_VEIL', 'DARK_BREATH'],
      "절대 암흑의 군주 모르고스의 신격 정수가 응축된 궁극의 의태 코어입니다. 착용 시 앙그반드의 모든 권능을 행사할 수 있습니다."
    );
    core.rarity = 'LEGENDARY';
    return core;
  }

  /**
   * 100% 확정 드랍: 고유 유물 'Grond' 생성
   * @param {Object} bossMonster 
   * @returns {Item}
   */
  createGrond(bossMonster) {
    const mx = bossMonster?.x || 0;
    const my = bossMonster?.y || 0;

    const grondData = TOME_ARTIFACTS_DATA ? TOME_ARTIFACTS_DATA['ART_GROND'] : null;
    const grond = new Item(
      mx, my,
      'WEAPON',
      '\\',
      '#ffd700',
      grondData?.name || "유물: 'Grond'",
      1,
      'WEAPON',
      grondData?.statBonuses || { str: 10, con: 5 },
      grondData?.dice || "9d9",
      null,
      [],
      [],
      ['ARTIFACT', 'SHATTER_WALLS', 'DOOMSPELL'],
      grondData?.flavorText || "The mighty Hammer of the Underworld, blackened by doomspells of shattering, whose wielder holds the lives of all Morgoth's servants in his hand."
    );
    grond.baseAC = grondData?.baseAC ?? 10;
    grond.cost = 10000000;
    grond.weight = grondData?.weight ?? 100;
    grond.artifactKey = 'ART_GROND';
    if (grondData?.flags) {
      grond.flags = [...grondData.flags];
    }
    grond.syncComponents();
    return grond;
  }

  /**
   * 100% 확정 드랍: 고유 유물 'Iron Crown of Morgoth' 생성
   * @param {Object} bossMonster 
   * @returns {Item}
   */
  createIronCrown(bossMonster) {
    const mx = bossMonster?.x || 0;
    const my = bossMonster?.y || 0;

    const crownData = TOME_ARTIFACTS_DATA ? TOME_ARTIFACTS_DATA['ART_OF_MORGOTH'] : null;
    const crown = new Item(
      mx, my,
      'HELMET',
      ']',
      '#ffd700',
      crownData?.name || "유물: Massive Iron Crown of Morgoth",
      1,
      'HELMET',
      crownData?.statBonuses || { str: 10, dex: 10, con: 10, int: 10, chr: 10 },
      null,
      null,
      [],
      [],
      ['ARTIFACT', 'RES_DARK', 'RES_NETHER', 'ESP_ALL', 'LITE1'],
      crownData?.flavorText || "Two Silmarils of Feanor blaze from the thunderous crown of twisted iron. The corrupted metal feels at once as infernal as hellfire and as chilling as the Outer Darkness."
    );
    crown.baseAC = crownData?.baseAC ?? 30;
    crown.cost = 10000000;
    crown.weight = crownData?.weight ?? 20;
    crown.artifactKey = 'ART_OF_MORGOTH';
    if (crownData?.flags) {
      crown.flags = [...crownData.flags];
    }
    crown.syncComponents();
    return crown;
  }

  /**
   * 모르고스 처치 시 확정 드랍 생성, 통계 집계 및 승천(Ascension) 엔딩 이벤트 격발
   * @param {Object} bossMonster 
   * @param {Object} player 
   * @param {Object} game 
   * @returns {Object} victoryData
   */
  handleBossDeath(bossMonster, player, game) {
    if (!bossMonster || !player || !game) return null;

    // 1. 유니크 처치 마킹
    const umm = game.uniqueMonsterManager || uniqueMonsterManager;
    umm.markKilled(MORGOTH_KEY);

    // 2. 100% 확정 고유 전리품 생성 (Core + Grond + Iron Crown)
    const drops = [
      this.createMorgothCore(bossMonster),
      this.createGrond(bossMonster),
      this.createIronCrown(bossMonster)
    ];

    for (const dropItem of drops) {
      LootSystem.spawnSafeDropItem(game, dropItem, bossMonster.x, bossMonster.y);
      if (game.addLogEntry) {
        game.addLogEntry(`✨ [신화의 유물 드랍] 모르고스의 유해에서 [${dropItem.name}]이(가) 나타났습니다!`, 'loot');
      }
    }

    // 3. 모험 통계 종합 데이터 생성
    const totalTurns = game.engine?.turn || game.turn || 1;
    const totalKills = player.killCount || player.monstersKilled || 1;
    const uniquesKilled = Array.from(umm.killed || []);
    const uniqueCount = uniquesKilled.length;

    // 전설 유물 수집 리스트 취합
    const collectedArtifacts = [];
    const checkItem = (item) => {
      if (item && (item.artifactKey || (item.specialTags && item.specialTags.includes('ARTIFACT')) || item.name.startsWith('유물:'))) {
        collectedArtifacts.push(item.name);
      }
    };

    if (player.inventory) player.inventory.forEach(checkItem);
    if (player.equipment) Object.values(player.equipment).forEach(checkItem);
    drops.forEach(d => collectedArtifacts.push(d.name));

    const stats = serializeCombatStats(player);
    const equipment = serializeEquipmentSlots(player.equipment);
    const inventory = serializeInventoryItems(player.inventory);
    const recentLogs = serializeRecentLogs(game.logHistory);

    const victoryData = {
      id: `ascension_${Date.now()}`,
      playerName: player.name || '모험가 (Valinor Ascendant)',
      level: player.level || 50,
      xp: player.xp || 100000,
      floor: game.floor || 50,
      turns: totalTurns,
      kills: totalKills,
      uniqueKills: uniqueCount,
      uniquesList: uniquesKilled,
      artifactsCount: collectedArtifacts.length,
      artifactsList: collectedArtifacts,
      mimicCore: player.mimicCore?.name || '모르고스의 의태 코어',
      stats: stats,
      equipment: equipment,
      inventory: inventory,
      recentLogs: recentLogs,
      finalEquipment: {
        weapon: player.equipment?.weapon?.name || "유물: 'Grond'",
        shield: player.equipment?.shield?.name || '없음',
        bow: player.equipment?.bow?.name || '없음',
        armor: player.equipment?.armor?.name || '발리노르의 성갑',
        helmet: player.equipment?.helmet?.name || '유물: Massive Iron Crown of Morgoth',
        boots: player.equipment?.boots?.name || '신속의 장화',
        gloves: player.equipment?.gloves?.name || '미스릴 건틀릿',
        cloak: player.equipment?.cloak?.name || '그림자 망토'
      },
      isVictory: true,
      clearDate: new Date().toISOString()
    };

    victoryData.score = calculateScore(victoryData);

    // 4. 영구 명예의 전당 저장
    saveAscensionRecord(victoryData);

    // 5. 승리 및 승천 이벤트 디스패치
    if (game.addLogEntry) {
      game.addLogEntry(`🏆 ======================================================`, 'loot');
      game.addLogEntry(`✨ [ASCENSION] 50F 모르고스를 물리치고 발리노르로 승천하였습니다! ✨`, 'loot');
      game.addLogEntry(`🏆 ======================================================`, 'loot');
    }

    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit(GameEvents.ASCENSION, victoryData);
      eventBus.emit(GameEvents.GAME_VICTORY, victoryData);
      eventBus.emit(GameEvents.BOSS_DEATH, { boss: bossMonster, victoryData });
    }

    if (game.engine && typeof game.engine.triggerVictory === 'function') {
      game.engine.triggerVictory(victoryData);
    }

    return victoryData;
  }
}

export const bossPhaseEngine = new BossPhaseEngine();
