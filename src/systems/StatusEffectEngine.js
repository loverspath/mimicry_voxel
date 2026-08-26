/**
 * @module StatusEffectEngine
 * @category systems
 * @description ToME 2.3.5 정통 14대 상태이상/버프 카탈로그 관리, 동적 플래그 저항/면역 판정,
 *              턴별 지속시간 차감 및 DoT 피해(독/출혈/마나고갈) 처리, 스탯 및 속도 보정치를 일괄 산출하는 순수 무상태 엔진.
 * @purity Stateless System
 * @dependencies TomeFlagResolver.js, UnifiedTraitEngine.js, TraceLogger.js
 * @exports STATUS_DEFINITIONS, StatusEffectEngine
 */

import { TomeFlagResolver } from './TomeFlagResolver.js';
import { UnifiedTraitEngine } from './UnifiedTraitEngine.js';
import { TraceLogger } from '../core/TraceLogger.js';

/**
 * ToME 정통 14대 상태이상 / 버프 카탈로그 정의
 */
export const STATUS_DEFINITIONS = Object.freeze({
  // ==========================================
  // [디버프 카탈로그 (Debuffs)]
  // ==========================================
  PARALYZED: Object.freeze({
    key: 'PARALYZED',
    category: 'debuff',
    name: '마비',
    englishName: 'Paralyzed',
    icon: '⚡',
    color: '#fbbf24',
    desc: '완전히 마비되어 어떠한 행동이나 이동도 수행할 수 없습니다.',
    immunityFlags: ['FREE_ACT', 'IM_PARALYZE', 'NO_PARALYZE', 'IM_PARALYZED'],
    defaultDuration: 3,
    defaultPower: 1,
    modifiers: { speed: -99, paralyzed: true }
  }),

  CONFUSED: Object.freeze({
    key: 'CONFUSED',
    category: 'debuff',
    name: '혼란',
    englishName: 'Confused',
    icon: '🌀',
    color: '#c084fc',
    desc: '정신이 혼미해져 의도하지 않은 방향으로 비틀거리며 명중률과 방어력이 감소합니다.',
    immunityFlags: ['NO_CONF', 'RES_CONF', 'IM_CONF', 'IM_CONFUSION'],
    defaultDuration: 4,
    defaultPower: 1,
    modifiers: { toHit: -10, ac: -5 }
  }),

  BLIND: Object.freeze({
    key: 'BLIND',
    category: 'debuff',
    name: '실명',
    englishName: 'Blind',
    icon: '🌑',
    color: '#64748b',
    desc: '시야를 완전히 상실하여 명중률과 방어력이 대폭 감소합니다.',
    immunityFlags: ['NO_BLIND', 'RES_BLIND', 'IM_BLIND'],
    defaultDuration: 4,
    defaultPower: 1,
    modifiers: { toHit: -20, ac: -10 }
  }),

  AFRAID: Object.freeze({
    key: 'AFRAID',
    category: 'debuff',
    name: '공포',
    englishName: 'Afraid',
    icon: '😨',
    color: '#f87171',
    desc: '극심한 공포에 질려 적에게 접근하지 못하며 명중률이 감소합니다.',
    immunityFlags: ['NO_FEAR', 'RES_FEAR', 'IM_FEAR', 'HERO', 'STATUS_HERO'],
    defaultDuration: 4,
    defaultPower: 1,
    modifiers: { toHit: -10, ac: -5 }
  }),

  POISON: Object.freeze({
    key: 'POISON',
    category: 'debuff',
    name: '중독',
    englishName: 'Poisoned',
    icon: '🧪',
    color: '#22c55e',
    desc: '치명적인 독이 혈관을 타고 흘러 매 턴마다 체력 피해를 입습니다 (RES_POIS 50% 감쇄, IM_POIS 면역).',
    immunityFlags: ['IM_POIS', 'IM_POISON'],
    resistanceFlags: ['RES_POIS'],
    defaultDuration: 5,
    defaultPower: 2,
    modifiers: {}
  }),

  BLEED: Object.freeze({
    key: 'BLEED',
    category: 'debuff',
    name: '출혈',
    englishName: 'Bleeding',
    icon: '🩸',
    color: '#ef4444',
    desc: '찢어진 상처에서 피가 흘러내려 매 턴마다 물리 DoT 피해를 입습니다.',
    immunityFlags: ['IM_BLEED', 'UNDEAD', 'NON_LIVING'],
    defaultDuration: 4,
    defaultPower: 3,
    modifiers: {}
  }),

  SLOW: Object.freeze({
    key: 'SLOW',
    category: 'debuff',
    name: '감속',
    englishName: 'Slow',
    icon: '🐌',
    color: '#94a3b8',
    desc: '신체 반응이 느려져 행동 속도가 감소합니다.',
    immunityFlags: ['FREE_ACT', 'IM_SLOW'],
    defaultDuration: 5,
    defaultPower: 1,
    modifiers: { speed: -10 }
  }),

  FROST: Object.freeze({
    key: 'FROST',
    category: 'debuff',
    name: '동결',
    englishName: 'Frozen',
    icon: '❄️',
    color: '#38bdf8',
    desc: '한기에 온몸이 꽁꽁 얼어붙어 행동 속도가 감속됩니다.',
    immunityFlags: ['IM_COLD', 'IM_FROST'],
    defaultDuration: 4,
    defaultPower: 1,
    modifiers: { speed: -5 }
  }),

  DRAIN_MANA: Object.freeze({
    key: 'DRAIN_MANA',
    category: 'debuff',
    name: '마나 고갈',
    englishName: 'Mana Drain',
    icon: '🌀',
    color: '#818cf8',
    desc: '마력이 외부로 강제 유출되어 매 턴마다 마나가 소실됩니다.',
    immunityFlags: ['IM_DRAIN_MANA', 'HOLD_LIFE'],
    defaultDuration: 3,
    defaultPower: 5,
    modifiers: {}
  }),

  MAGIC_VULN: Object.freeze({
    key: 'MAGIC_VULN',
    category: 'debuff',
    name: '마법 취약',
    englishName: 'Magic Vulnerability',
    icon: '🔮',
    color: '#c084fc',
    desc: '마법 저항이 붕괴되어 받는 마법 피해가 30% 증가합니다.',
    immunityFlags: [],
    defaultDuration: 3,
    defaultPower: 1,
    modifiers: { magicVulnerability: 0.30 }
  }),

  // ==========================================
  // [버프 카탈로그 (Buffs)]
  // ==========================================
  HASTE: Object.freeze({
    key: 'HASTE',
    category: 'buff',
    name: '가속',
    englishName: 'Haste',
    icon: '⚡',
    color: '#eab308',
    desc: '시간의 흐름을 가속하여 행동 속도가 +10 증가합니다.',
    immunityFlags: [],
    defaultDuration: 15,
    defaultPower: 1,
    modifiers: { speed: 10 }
  }),

  HERO: Object.freeze({
    key: 'HERO',
    category: 'buff',
    name: '영웅화',
    englishName: 'Heroism',
    icon: '👑',
    color: '#f59e0b',
    desc: '전설적 영웅의 투지가 깃들어 명중률이 +12 증가하고 모든 공포에 면역이 됩니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { toHit: 12, fearImmune: true }
  }),

  MANA_SHIELD: Object.freeze({
    key: 'MANA_SHIELD',
    category: 'buff',
    name: '마나 보호막',
    englishName: 'Mana Shield',
    icon: '🛡️',
    color: '#06b6d4',
    desc: '신비로운 에테르 역장이 전개되어 받는 피해의 50%를 체력 대신 마나로 흡수합니다.',
    immunityFlags: [],
    defaultDuration: 10,
    defaultPower: 1,
    modifiers: { manaShieldRatio: 0.50 }
  }),

  BLESS: Object.freeze({
    key: 'BLESS',
    category: 'buff',
    name: '축복',
    englishName: 'Blessing',
    icon: '✨',
    color: '#fbbf24',
    desc: '천상의 가호가 깃들어 방어력(AC) +5 및 명중률 +5의 축복 보정을 받습니다.',
    immunityFlags: [],
    defaultDuration: 15,
    defaultPower: 1,
    modifiers: { ac: 5, toHit: 5 }
  }),

  SEE_INVIS: Object.freeze({
    key: 'SEE_INVIS',
    category: 'buff',
    name: '투명체 감지',
    englishName: 'See Invisible',
    icon: '👁️',
    color: '#a78bfa',
    desc: '차원의 경계를 꿰뚫어 보아 은신 및 투명화된 모든 개체를 선명하게 포착합니다.',
    immunityFlags: [],
    defaultDuration: 30,
    defaultPower: 1,
    modifiers: { seeInvis: true }
  }),

  RES_FIRE: Object.freeze({
    key: 'RES_FIRE',
    category: 'buff',
    name: '화염 보호',
    englishName: 'Resist Fire',
    icon: '🔥',
    color: '#f97316',
    desc: '내화성 마력 결계가 생성되어 화염 피해를 50% 감쇄합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { resFire: 50 }
  }),

  RES_COLD: Object.freeze({
    key: 'RES_COLD',
    category: 'buff',
    name: '냉기 보호',
    englishName: 'Resist Cold',
    icon: '❄️',
    color: '#38bdf8',
    desc: '보온성 마력 결계가 생성되어 냉기 피해를 50% 감쇄합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { resCold: 50 }
  }),

  RES_ELEC: Object.freeze({
    key: 'RES_ELEC',
    category: 'buff',
    name: '전격 보호',
    englishName: 'Resist Electricity',
    icon: '⚡',
    color: '#eab308',
    desc: '절연 마력 결계가 생성되어 번개 및 전기 피해를 50% 감쇄합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { resElec: 50 }
  }),

  RES_ACID: Object.freeze({
    key: 'RES_ACID',
    category: 'buff',
    name: '산성 보호',
    englishName: 'Resist Acid',
    icon: '🧪',
    color: '#84cc16',
    desc: '내산성 마력 결계가 생성되어 산성 부식 피해를 50% 감쇄합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { resAcid: 50 }
  })
});

/**
 * 상태이상 식별자 별칭(Alias) 매핑 사전
 */
const STATUS_ALIASES = Object.freeze({
  PARALYZE: 'PARALYZED',
  PARALYSIS: 'PARALYZED',
  CONFUSION: 'CONFUSED',
  CONF: 'CONFUSED',
  FEAR: 'AFRAID',
  POIS: 'POISON',
  FREEZE: 'FROST',
  FROZEN: 'FROST',
  SPEED: 'HASTE',
  HEROISM: 'HERO',
  BLESSING: 'BLESS',
  SEE_INVISIBLE: 'SEE_INVIS',
  MAGIC_VULNERABILITY: 'MAGIC_VULN',
  RESIST_FIRE: 'RES_FIRE',
  RESIST_COLD: 'RES_COLD',
  RESIST_ELEC: 'RES_ELEC',
  RESIST_ACID: 'RES_ACID'
});

export class StatusEffectEngine {
  /**
   * 상태이상 키를 표준 카탈로그 키로 정규화합니다.
   * @param {string} rawKey
   * @returns {string}
   */
  static normalizeKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return '';
    const upper = rawKey.trim().toUpperCase().replace(/^STATUS_/, '');
    return STATUS_ALIASES[upper] || upper;
  }

  /**
   * 대상 엔티티가 특정 상태이상에 면역인지 여부를 검사합니다.
   * 장비, 의태 코어, 종족 및 버프(HERO 등)를 일괄 취합하여 판정합니다.
   * @param {Object} target - 대상 엔티티 (Player or Monster)
   * @param {string} statusKey - 상태이상 식별자
   * @returns {boolean} 면역 여부
   */
  static isImmune(target, statusKey) {
    if (!target || !statusKey) return false;
    const key = this.normalizeKey(statusKey);
    const def = STATUS_DEFINITIONS[key];
    if (!def || def.category === 'buff') return false;

    // TomeFlagResolver를 통해 엔티티의 모든 플래그 취합
    const flags = TomeFlagResolver.collectFlagsFromEntity(target);

    // 1. 직접 정의된 면역 플래그 검사
    if (def.immunityFlags && def.immunityFlags.length > 0) {
      for (const f of def.immunityFlags) {
        if (flags.has(f)) return true;
      }
    }

    // 2. 특수 면역 조건
    if (key === 'AFRAID') {
      if (flags.has('NO_FEAR') || flags.has('RES_FEAR') || flags.has('IM_FEAR') || flags.has('HERO') || flags.has('STATUS_HERO')) {
        return true;
      }
      if (this.hasStatus(target, 'HERO')) {
        return true;
      }
    }

    if (key === 'PARALYZED') {
      if (flags.has('FREE_ACT') || flags.has('IM_PARALYZE') || flags.has('NO_PARALYZE')) {
        return true;
      }
    }

    if (key === 'CONFUSED') {
      if (flags.has('NO_CONF') || flags.has('RES_CONF') || flags.has('IM_CONF')) {
        return true;
      }
    }

    if (key === 'BLIND') {
      if (flags.has('NO_BLIND') || flags.has('RES_BLIND') || flags.has('IM_BLIND')) {
        return true;
      }
    }

    if (key === 'POISON') {
      if (flags.has('IM_POIS') || flags.has('IM_POISON')) {
        return true;
      }
    }

    if (key === 'SLOW') {
      if (flags.has('FREE_ACT') || flags.has('IM_SLOW')) {
        return true;
      }
    }

    if (key === 'FROST') {
      if (flags.has('IM_COLD') || flags.has('IM_FROST')) {
        return true;
      }
    }

    return false;
  }

  /**
   * 엔티티에 상태이상 또는 버프를 적용합니다.
   * 면역 판정 시 상태가 적용되지 않으며 저항 피드백을 남깁니다.
   * @param {Object} target - 대상 엔티티
   * @param {string} statusKey - 상태 키
   * @param {number} [duration=null] - 지속 턴수
   * @param {number} [power=null] - 효과 위력 / DoT 대미지
   * @param {Object|string} [source=null] - 발생원
   * @param {Object} [game=null] - Game 컨텍스트 (로그 출력용)
   * @returns {{ applied: boolean, reason?: string, statusKey: string, duration?: number, power?: number }}
   */
  static applyStatus(target, statusKey, duration = null, power = null, source = null, game = null) {
    if (!target || !statusKey) {
      return { applied: false, reason: 'INVALID_INPUT', statusKey: '' };
    }

    const key = this.normalizeKey(statusKey);
    const def = STATUS_DEFINITIONS[key];
    if (!def) {
      return { applied: false, reason: 'UNKNOWN_STATUS_KEY', statusKey: key };
    }

    if (!target.statuses || typeof target.statuses !== 'object') {
      target.statuses = {};
    }

    // 면역 여부 판정
    if (this.isImmune(target, key)) {
      const targetName = target.displayName || target.name || '대상';
      if (game && typeof game.addLogEntry === 'function') {
        game.addLogEntry(`[Resist] 🛡️ ${targetName}이(가) ${def.name} 상태이상에 면역으로 저항했습니다!`, 'system');
      }
      TraceLogger.log('STATUS', `${targetName} resisted status ${key} via immunity flag.`);
      return { applied: false, reason: 'IMMUNE', statusKey: key };
    }

    const finalDur = Math.max(1, typeof duration === 'number' && Number.isFinite(duration) ? duration : (def.defaultDuration || 3));
    const finalPow = power !== null && power !== undefined && Number.isFinite(power) ? power : (def.defaultPower !== undefined ? def.defaultPower : 1);

    if (target.statuses[key]) {
      target.statuses[key].duration = Math.max(target.statuses[key].duration, finalDur);
      target.statuses[key].power = Math.max(target.statuses[key].power || 0, finalPow);
      if (source) target.statuses[key].source = source;
    } else {
      target.statuses[key] = {
        duration: finalDur,
        power: finalPow,
        source: source || null,
        appliedAt: Date.now()
      };
    }

    if (typeof target.markDirty === 'function') {
      target.markDirty(`STATUS_APPLIED_${key}`);
    } else {
      target._isDirty = true;
    }

    const targetName = target.displayName || target.name || '대상';
    if (game && typeof game.addLogEntry === 'function') {
      const icon = def.icon || (def.category === 'buff' ? '✨' : '⚠️');
      const logType = def.category === 'buff' ? 'loot' : 'combat';
      game.addLogEntry(`[Status] ${icon} ${targetName}에게 ${def.name} (${target.statuses[key].duration}턴) 효과가 부여되었습니다.`, logType);
    }

    return {
      applied: true,
      statusKey: key,
      duration: target.statuses[key].duration,
      power: target.statuses[key].power
    };
  }

  /**
   * 매 턴 경과 시 상태이상의 지속시간을 차감하고 주기적 피해(DoT)를 처리합니다.
   * @param {Object} target - 대상 엔티티
   * @param {Object} [game=null] - 게임 인스턴스 (로그 및 맵 연동)
   * @returns {{ expired: string[], damages: Array<{ type: string, amount: number, reduced?: boolean }> }}
   */
  static tickStatuses(target, game = null) {
    if (!target || !target.statuses || typeof target.statuses !== 'object') {
      return { expired: [], damages: [] };
    }

    const expired = [];
    const damages = [];
    let stateChanged = false;

    for (const [key, statusObj] of Object.entries(target.statuses)) {
      if (!statusObj || statusObj.duration <= 0) {
        delete target.statuses[key];
        expired.push(key);
        stateChanged = true;
        continue;
      }

      // DoT 및 주기적 효과 적용
      if (key === 'POISON') {
        const baseDmg = statusObj.power > 0 ? statusObj.power : 2;
        const hasResPois = TomeFlagResolver.hasFlag(target, 'RES_POIS');
        const poisonDmg = hasResPois ? Math.max(1, Math.floor(baseDmg * 0.5)) : baseDmg;
        if (target.stats && typeof target.stats.hp === 'number') {
          target.stats.hp = Math.max(0, target.stats.hp - poisonDmg);
        }
        damages.push({ type: 'POISON', amount: poisonDmg, reduced: hasResPois });
        if (game && typeof game.addLogEntry === 'function') {
          const targetName = target.displayName || target.name || '대상';
          const resNote = hasResPois ? ' (독 저항 50% 감쇄)' : '';
          const hpNote = target.stats ? ` (남은 지속: ${statusObj.duration - 1}턴, HP: ${target.stats.hp}/${target.stats.maxHp})` : '';
          game.addLogEntry(`[Status] 🧪 ${targetName}이(가) 독으로 ${poisonDmg} 피해를 입었습니다!${resNote}${hpNote}`, 'combat');
        }
      } else if (key === 'BLEED') {
        const bleedDmg = statusObj.power > 0 ? statusObj.power : 3;
        if (target.stats && typeof target.stats.hp === 'number') {
          target.stats.hp = Math.max(0, target.stats.hp - bleedDmg);
        }
        damages.push({ type: 'BLEED', amount: bleedDmg });
        if (game && typeof game.addLogEntry === 'function') {
          const targetName = target.displayName || target.name || '대상';
          const hpNote = target.stats ? ` (HP: ${target.stats.hp}/${target.stats.maxHp})` : '';
          game.addLogEntry(`[Status] 🩸 ${targetName}이(가) 출혈로 ${bleedDmg} 물리 피해를 입었습니다!${hpNote}`, 'combat');
        }
      } else if (key === 'DRAIN_MANA') {
        const drainAmt = statusObj.power > 0 ? statusObj.power : 5;
        if (target.stats && typeof target.stats.mp === 'number') {
          target.stats.mp = Math.max(0, target.stats.mp - drainAmt);
        }
        damages.push({ type: 'DRAIN_MANA', amount: drainAmt });
        if (game && typeof game.addLogEntry === 'function') {
          const targetName = target.displayName || target.name || '대상';
          game.addLogEntry(`[Status] 🌀 ${targetName}의 마나가 ${drainAmt} 소모되었습니다!`, 'combat');
        }
      }

      // 지속시간 차감
      statusObj.duration--;
      stateChanged = true;

      // 만료 처리
      if (statusObj.duration <= 0) {
        delete target.statuses[key];
        expired.push(key);
        const def = STATUS_DEFINITIONS[key];
        if (game && typeof game.addLogEntry === 'function') {
          const targetName = target.displayName || target.name || '대상';
          const name = def ? def.name : key;
          game.addLogEntry(`[Status] ⏳ ${targetName}의 ${name} 상태가 해제되었습니다.`, 'system');
        }
      }
    }

    if (stateChanged) {
      if (typeof target.markDirty === 'function') {
        target.markDirty('STATUS_TICK');
      } else {
        target._isDirty = true;
      }
    }

    return { expired, damages };
  }

  /**
   * 대상 엔티티가 특정 상태를 활성 보유하고 있는지 확인합니다.
   * @param {Object} target
   * @param {string} statusKey
   * @returns {boolean}
   */
  static hasStatus(target, statusKey) {
    if (!target || !target.statuses || typeof target.statuses !== 'object') return false;
    const key = this.normalizeKey(statusKey);
    return Boolean(target.statuses[key] && target.statuses[key].duration > 0);
  }

  /**
   * 특정 상태의 상세 정보를 조회합니다.
   * @param {Object} target
   * @param {string} statusKey
   * @returns {Object|null}
   */
  static getStatus(target, statusKey) {
    if (!this.hasStatus(target, statusKey)) return null;
    const key = this.normalizeKey(statusKey);
    return target.statuses[key] || null;
  }

  /**
   * 특정 상태이상을 강제로 제거합니다.
   * @param {Object} target
   * @param {string} statusKey
   * @param {Object} [game=null]
   * @returns {boolean} 제거 성공 여부
   */
  static removeStatus(target, statusKey, game = null) {
    if (!this.hasStatus(target, statusKey)) return false;
    const key = this.normalizeKey(statusKey);
    delete target.statuses[key];

    if (typeof target.markDirty === 'function') {
      target.markDirty(`STATUS_${key}_REMOVED`);
    } else {
      target._isDirty = true;
    }

    const def = STATUS_DEFINITIONS[key];
    if (game && typeof game.addLogEntry === 'function') {
      const targetName = target.displayName || target.name || '대상';
      game.addLogEntry(`[Status] ✨ ${targetName}의 ${def ? def.name : key} 효과가 제거되었습니다.`, 'system');
    }

    return true;
  }

  /**
   * 엔티티의 모든 상태이상을 일괄 제거합니다 (디버프만, 버프만 필터링 가능).
   * @param {Object} target
   * @param {string} [category=null] - 'debuff' | 'buff' | null
   * @param {Object} [game=null]
   * @returns {string[]} 제거된 상태 키 목록
   */
  static clearAllStatuses(target, category = null, game = null) {
    if (!target || !target.statuses || typeof target.statuses !== 'object') return [];
    const removed = [];

    for (const key of Object.keys(target.statuses)) {
      const def = STATUS_DEFINITIONS[key];
      if (category && def && def.category !== category) continue;
      delete target.statuses[key];
      removed.push(key);
    }

    if (removed.length > 0) {
      if (typeof target.markDirty === 'function') {
        target.markDirty('STATUS_CLEAR_ALL');
      } else {
        target._isDirty = true;
      }
    }

    return removed;
  }

  /**
   * 활성화된 상태이상 및 버프로부터 산출되는 모든 수치 보정치(Speed, AC, ToHit, Resistances 등)를 합산합니다.
   * @param {Object} target
   * @returns {{ speed: number, ac: number, toHit: number, str: number, int: number, wis: number, dex: number, con: number, chr: number, damageReduction: number, manaShieldRatio: number, resFire: number, resCold: number, resElec: number, resAcid: number, seeInvis: boolean, fearImmune: boolean, paralyzed: boolean }}
   */
  static calculateStatusModifiers(target) {
    const modifiers = {
      speed: 0,
      ac: 0,
      toHit: 0,
      str: 0,
      int: 0,
      wis: 0,
      dex: 0,
      con: 0,
      chr: 0,
      damageReduction: 0,
      manaShieldRatio: 0,
      resFire: 0,
      resCold: 0,
      resElec: 0,
      resAcid: 0,
      seeInvis: false,
      fearImmune: false,
      paralyzed: false
    };

    if (!target || !target.statuses || typeof target.statuses !== 'object') {
      return modifiers;
    }

    for (const [key, statusObj] of Object.entries(target.statuses)) {
      if (!statusObj || statusObj.duration <= 0) continue;
      const def = STATUS_DEFINITIONS[key];
      if (!def) continue;

      if (key === 'HASTE') {
        modifiers.speed += 10;
      } else if (key === 'SLOW') {
        modifiers.speed -= 10;
      } else if (key === 'FROST') {
        modifiers.speed -= 5;
      } else if (key === 'PARALYZED') {
        modifiers.paralyzed = true;
        modifiers.speed -= 99;
      } else if (key === 'HERO') {
        modifiers.toHit += 12;
        modifiers.fearImmune = true;
      } else if (key === 'BLESS') {
        modifiers.ac += 5;
        modifiers.toHit += 5;
      } else if (key === 'MANA_SHIELD') {
        modifiers.manaShieldRatio = Math.max(modifiers.manaShieldRatio, 0.50);
      } else if (key === 'SEE_INVIS') {
        modifiers.seeInvis = true;
      } else if (key === 'RES_FIRE') {
        modifiers.resFire += 50;
      } else if (key === 'RES_COLD') {
        modifiers.resCold += 50;
      } else if (key === 'RES_ELEC') {
        modifiers.resElec += 50;
      } else if (key === 'RES_ACID') {
        modifiers.resAcid += 50;
      } else if (key === 'BLIND') {
        modifiers.toHit -= 20;
        modifiers.ac -= 10;
      } else if (key === 'CONFUSED') {
        modifiers.toHit -= 10;
        modifiers.ac -= 5;
      } else if (key === 'AFRAID') {
        modifiers.toHit -= 10;
        modifiers.ac -= 5;
      }
    }

    return modifiers;
  }

  /**
   * 기존 레거시 entity.debuffs 접근을 안전하게 StatusEffectEngine의 entity.statuses로 프록시 포워딩합니다.
   * @param {Object} entity
   * @returns {Object}
   */
  static createLegacyDebuffsProxy(entity) {
    const rawDebuffs = {
      poison: 0,
      frost: 0,
      paralyzed: false,
      magicVulnerability: 0,
      blind: 0,
      confused: 0,
      afraid: 0,
      slow: 0,
      paralyzeTurns: 0,
      bleed: 0
    };

    return new Proxy(rawDebuffs, {
      get(target, prop) {
        if (typeof prop === 'symbol') return Reflect.get(target, prop);
        const p = String(prop);
        if (!entity.statuses) return target[p] !== undefined ? target[p] : 0;

        switch (p) {
          case 'poison':
            return entity.statuses.POISON ? entity.statuses.POISON.duration : 0;
          case 'frost':
            return entity.statuses.FROST ? entity.statuses.FROST.duration : 0;
          case 'paralyzed':
            return Boolean(entity.statuses.PARALYZED && entity.statuses.PARALYZED.duration > 0);
          case 'paralyzeTurns':
            return entity.statuses.PARALYZED ? entity.statuses.PARALYZED.duration : 0;
          case 'blind':
            return entity.statuses.BLIND ? entity.statuses.BLIND.duration : 0;
          case 'confused':
          case 'confusion':
            return entity.statuses.CONFUSED ? entity.statuses.CONFUSED.duration : 0;
          case 'afraid':
          case 'fear':
            return entity.statuses.AFRAID ? entity.statuses.AFRAID.duration : 0;
          case 'slow':
            return entity.statuses.SLOW ? entity.statuses.SLOW.duration : 0;
          case 'bleed':
            return entity.statuses.BLEED ? entity.statuses.BLEED.duration : 0;
          case 'magicVulnerability':
            return entity.statuses.MAGIC_VULN ? entity.statuses.MAGIC_VULN.duration : 0;
          default:
            return target[p];
        }
      },
      set(target, prop, value) {
        if (typeof prop === 'symbol') return Reflect.set(target, prop, value);
        const p = String(prop);
        target[p] = value;

        if (!entity.statuses) entity.statuses = {};

        switch (p) {
          case 'poison':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'POISON', value, 2);
            else StatusEffectEngine.removeStatus(entity, 'POISON');
            break;
          case 'frost':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'FROST', value);
            else StatusEffectEngine.removeStatus(entity, 'FROST');
            break;
          case 'paralyzed':
            if (value) {
              const dur = entity.statuses.PARALYZED ? entity.statuses.PARALYZED.duration : 3;
              StatusEffectEngine.applyStatus(entity, 'PARALYZED', dur);
            } else {
              StatusEffectEngine.removeStatus(entity, 'PARALYZED');
            }
            break;
          case 'paralyzeTurns':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'PARALYZED', value);
            else StatusEffectEngine.removeStatus(entity, 'PARALYZED');
            break;
          case 'blind':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'BLIND', value);
            else StatusEffectEngine.removeStatus(entity, 'BLIND');
            break;
          case 'confused':
          case 'confusion':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'CONFUSED', value);
            else StatusEffectEngine.removeStatus(entity, 'CONFUSED');
            break;
          case 'afraid':
          case 'fear':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'AFRAID', value);
            else StatusEffectEngine.removeStatus(entity, 'AFRAID');
            break;
          case 'slow':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'SLOW', value);
            else StatusEffectEngine.removeStatus(entity, 'SLOW');
            break;
          case 'bleed':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'BLEED', value, 3);
            else StatusEffectEngine.removeStatus(entity, 'BLEED');
            break;
          case 'magicVulnerability':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'MAGIC_VULN', value);
            else StatusEffectEngine.removeStatus(entity, 'MAGIC_VULN');
            break;
        }
        return true;
      },
      has(target, prop) {
        return prop in target;
      },
      ownKeys(target) {
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, prop) {
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    });
  }
}
