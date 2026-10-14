/**
 * @module StatusEffectEngine
 * @category systems
 * @description ToME 2.3.5 정통 디버프 및 버프 카탈로그 관리, 동적 플래그 저항/면역 판정,
 *              턴별 지속시간 차감 및 DoT 처리, 스탯/속도/AC/ToHit/내성 통합 보정치를 일괄 산출하는 단일 진실 공급원(Single Source of Truth) 엔진.
 * @purity Pure / Stateless Logic with Entity State Synchronization
 * @dependencies TomeFlagResolver.js, UnifiedTraitEngine.js, TraceLogger.js
 * @exports STATUS_DEFINITIONS, STATUS_ALIASES, StatusEffectEngine
 */

import { TomeFlagResolver } from './TomeFlagResolver.js';
import { UnifiedTraitEngine } from './UnifiedTraitEngine.js';
import { TraceLogger } from '../core/TraceLogger.js';

/**
 * 정통 상태이상 (Debuffs) 및 버프 (Buffs) 카탈로그 정의
 */
export const STATUS_DEFINITIONS = Object.freeze({
  // ==========================================
  // [디버프 카탈로그 (Debuffs)]
  // ==========================================
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

  BURN: Object.freeze({
    key: 'BURN',
    category: 'debuff',
    name: '화상',
    englishName: 'Burning',
    icon: '🔥',
    color: '#f97316',
    desc: '맹렬한 화염에 휩싸여 매 턴마다 화염 DoT 피해를 입습니다 (RES_FIRE 50% 감쇄, IM_FIRE 면역).',
    immunityFlags: ['IM_FIRE'],
    resistanceFlags: ['RES_FIRE'],
    defaultDuration: 3,
    defaultPower: 5,
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
    immunityFlags: ['IM_BLEED', 'UNDEAD', 'NON_LIVING', 'NONLIVING'],
    defaultDuration: 4,
    defaultPower: 3,
    modifiers: {}
  }),

  BLIND: Object.freeze({
    key: 'BLIND',
    category: 'debuff',
    name: '실명',
    englishName: 'Blind',
    icon: '🌑',
    color: '#64748b',
    desc: '시야를 완전히 상실하여 명중률과 방어력이 대폭 감소하고 시야 반경이 1로 제한됩니다.',
    immunityFlags: ['NO_BLIND', 'RES_BLIND', 'IM_BLIND'],
    defaultDuration: 4,
    defaultPower: 1,
    modifiers: { toHit: -20, ac: -10 }
  }),

  CONFUSE: Object.freeze({
    key: 'CONFUSE',
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

  PARALYZE: Object.freeze({
    key: 'PARALYZE',
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

  FEAR: Object.freeze({
    key: 'FEAR',
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

  STUN: Object.freeze({
    key: 'STUN',
    category: 'debuff',
    name: '기절',
    englishName: 'Stunned',
    icon: '💫',
    color: '#f59e0b',
    desc: '충격으로 뇌진탕을 일으켜 명중률, 방어력, 속도가 감소합니다.',
    immunityFlags: ['NO_STUN', 'IM_STUN', 'FREE_ACT'],
    defaultDuration: 3,
    defaultPower: 1,
    modifiers: { toHit: -10, ac: -5, speed: -5 }
  }),

  HALLU: Object.freeze({
    key: 'HALLU',
    category: 'debuff',
    name: '환각',
    englishName: 'Hallucinating',
    icon: '🌈',
    color: '#ec4899',
    desc: '환각에 빠져 주변 개체와 지형이 왜곡되어 보입니다.',
    immunityFlags: ['NO_HALLU', 'RES_CHAOS'],
    defaultDuration: 5,
    defaultPower: 1,
    modifiers: { hallucinating: true }
  }),

  AMNESIA: Object.freeze({
    key: 'AMNESIA',
    category: 'debuff',
    name: '기억상실',
    englishName: 'Amnesia',
    icon: '❓',
    color: '#a855f7',
    desc: '기억을 잃어 지형과 주문 정보가 지워집니다.',
    immunityFlags: ['HOLD_LIFE'],
    defaultDuration: 4,
    defaultPower: 1,
    modifiers: { amnesia: true }
  }),

  WEAKEN: Object.freeze({
    key: 'WEAKEN',
    category: 'debuff',
    name: '약화',
    englishName: 'Weakened',
    icon: '💔',
    color: '#f43f5e',
    desc: '근력이 약화되어 가하는 물리 피해(To-Dam)가 10 감소합니다.',
    immunityFlags: [],
    defaultDuration: 5,
    defaultPower: 1,
    modifiers: { toDam: -10 }
  }),

  SUNDER: Object.freeze({
    key: 'SUNDER',
    category: 'debuff',
    name: '방어 분쇄',
    englishName: 'Sundered',
    icon: '🛡️💥',
    color: '#e11d48',
    desc: '갑주가 파괴되어 방어력(AC)이 20 감소합니다.',
    immunityFlags: [],
    defaultDuration: 5,
    defaultPower: 1,
    modifiers: { ac: -20 }
  }),

  DISEASE: Object.freeze({
    key: 'DISEASE',
    category: 'debuff',
    name: '질병',
    englishName: 'Diseased',
    icon: '🦠',
    color: '#84cc16',
    desc: '역병에 감염되어 체질(CON)과 힘(STR)이 감소합니다.',
    immunityFlags: ['IM_POIS'],
    defaultDuration: 6,
    defaultPower: 1,
    modifiers: { con: -5, str: -3 }
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

  HEROISM: Object.freeze({
    key: 'HEROISM',
    category: 'buff',
    name: '영웅화',
    englishName: 'Heroism',
    icon: '👑',
    color: '#f59e0b',
    desc: '전설적 영웅의 투지가 깃들어 명중률이 +12, 최대 HP가 +10 증가하고 모든 공포에 면역이 됩니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { toHit: 12, maxHp: 10, fearImmune: true }
  }),

  BERSERK: Object.freeze({
    key: 'BERSERK',
    category: 'buff',
    name: '광폭화',
    englishName: 'Berserk',
    icon: '🩸',
    color: '#dc2626',
    desc: '피의 광란에 빠져 명중률 +24, 추가 물리 피해 +15 증가하지만 방어력이 10 감소하며 공포에 면역이 됩니다.',
    immunityFlags: [],
    defaultDuration: 15,
    defaultPower: 1,
    modifiers: { toHit: 24, toDam: 15, ac: -10, fearImmune: true }
  }),

  INVULN: Object.freeze({
    key: 'INVULN',
    category: 'buff',
    name: '무적',
    englishName: 'Invulnerability',
    icon: '✨🛡️',
    color: '#facc15',
    desc: '신성한 불멸의 보호막이 생성되어 받는 모든 피해를 90% 감쇄하고 방어력이 +100 증가합니다.',
    immunityFlags: [],
    defaultDuration: 8,
    defaultPower: 1,
    modifiers: { damageReductionPct: 0.90, ac: 100 }
  }),

  SHIELD: Object.freeze({
    key: 'SHIELD',
    category: 'buff',
    name: '신성 방패',
    englishName: 'Shield',
    icon: '🛡️',
    color: '#38bdf8',
    desc: '강력한 마력 방패가 전개되어 방어력(AC)이 +50 증가합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { ac: 50 }
  }),

  PROT_EVIL: Object.freeze({
    key: 'PROT_EVIL',
    category: 'buff',
    name: '악으로부터의 보호',
    englishName: 'Protection from Evil',
    icon: '✝️',
    color: '#60a5fa',
    desc: '사악한 존재의 공격을 방어하며 방어력(AC) +15의 가호를 받습니다.',
    immunityFlags: [],
    defaultDuration: 25,
    defaultPower: 1,
    modifiers: { protEvil: true, ac: 15 }
  }),

  BLESSED: Object.freeze({
    key: 'BLESSED',
    category: 'buff',
    name: '축복',
    englishName: 'Blessing',
    icon: '✨',
    color: '#fbbf24',
    desc: '천상의 가호가 깃들어 방어력(AC) +5 및 명중률 +10의 축복 보정을 받습니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { ac: 5, toHit: 10 }
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
    modifiers: { resFire: 0.50 }
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
    modifiers: { resCold: 0.50 }
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
    modifiers: { resElec: 0.50 }
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
    modifiers: { resAcid: 0.50 }
  }),

  RES_POIS: Object.freeze({
    key: 'RES_POIS',
    category: 'buff',
    name: '독 보호',
    englishName: 'Resist Poison',
    icon: '🍃',
    color: '#22c55e',
    desc: '해독 마력 결계가 생성되어 독 피해를 50% 감쇄합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { resPois: 0.50 }
  }),

  ESP: Object.freeze({
    key: 'ESP',
    category: 'buff',
    name: '초감각 텔레파시',
    englishName: 'Telepathy',
    icon: '👁️‍🗨️',
    color: '#c084fc',
    desc: '지성체의 정신 파동을 포착하여 벽 너머의 몬스터 위치를 투시합니다.',
    immunityFlags: [],
    defaultDuration: 25,
    defaultPower: 1,
    modifiers: { telepathy: true }
  }),

  INFRA: Object.freeze({
    key: 'INFRA',
    category: 'buff',
    name: '적외선 시야',
    englishName: 'Infravision',
    icon: '🔥👁️',
    color: '#fb923c',
    desc: '온혈 몬스터의 체온을 감지하여 어둠 속에서도 시야를 +5 확장합니다.',
    immunityFlags: [],
    defaultDuration: 30,
    defaultPower: 1,
    modifiers: { infraBonus: 5 }
  }),

  PASS_WALL: Object.freeze({
    key: 'PASS_WALL',
    category: 'buff',
    name: '유령 형상',
    englishName: 'Wraithform',
    icon: '👻',
    color: '#94a3b8',
    desc: '비물질적인 에테르 형태로 화하여 벽을 통과하여 이동할 수 있습니다.',
    immunityFlags: [],
    defaultDuration: 10,
    defaultPower: 1,
    modifiers: { wraithform: true, passWall: true }
  }),

  REGEN_BOOST: Object.freeze({
    key: 'REGEN_BOOST',
    category: 'buff',
    name: '급속 재생',
    englishName: 'Regeneration',
    icon: '💖',
    color: '#f43f5e',
    desc: '생명력이 초자연적으로 약동하여 턴당 자연 회복량이 +5 증가합니다.',
    immunityFlags: [],
    defaultDuration: 20,
    defaultPower: 1,
    modifiers: { regenBonus: 5 }
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
  })
});

/**
 * 상태이상 및 버프 식별자 별칭(Alias) 매핑 사전
 */
export const STATUS_ALIASES = Object.freeze({
  BURNING: 'BURN',
  FIRE: 'BURN',
  CUT: 'BLEED',
  BLEEDING: 'BLEED',
  CONFUSED: 'CONFUSE',
  CONFUSION: 'CONFUSE',
  CONF: 'CONFUSE',
  PARALYZED: 'PARALYZE',
  PARALYSIS: 'PARALYZE',
  AFRAID: 'FEAR',
  FEARED: 'FEAR',
  POIS: 'POISON',
  POISONED: 'POISON',
  FREEZE: 'FROST',
  FROZEN: 'FROST',
  HALLUCINATING: 'HALLU',
  HALLUCINATION: 'HALLU',
  SPEED: 'HASTE',
  HERO: 'HEROISM',
  BLESS: 'BLESSED',
  BLESSING: 'BLESSED',
  INVULNERABLE: 'INVULN',
  INVULNERABILITY: 'INVULN',
  PROTECT_EVIL: 'PROT_EVIL',
  PROT_EVIL_PRAYER: 'PROT_EVIL',
  PROTECT_PRAYER: 'PROT_EVIL',
  PROTECTPRAYER: 'PROT_EVIL',
  RESIST_FIRE: 'RES_FIRE',
  RESIST_COLD: 'RES_COLD',
  RESIST_ELEC: 'RES_ELEC',
  RESIST_LIGHTNING: 'RES_ELEC',
  RES_LIGHTNING: 'RES_ELEC',
  RESIST_ACID: 'RES_ACID',
  RESIST_POIS: 'RES_POIS',
  RES_POISON: 'RES_POIS',
  RESIST_POISON: 'RES_POIS',
  TELEPATHY: 'ESP',
  INFRAVISION: 'INFRA',
  INFRA_VISION: 'INFRA',
  WRAITHFORM: 'PASS_WALL',
  WRAITH_FORM: 'PASS_WALL',
  REGEN: 'REGEN_BOOST',
  REGENERATION: 'REGEN_BOOST',
  SEE_INVISIBLE: 'SEE_INVIS',
  MAGIC_VULNERABILITY: 'MAGIC_VULN'
});

/**
 * 레거시 턴 수치 필드와 상태 카탈로그 식별자 간의 동기화 매핑 테이블
 */
const LEGACY_FIELD_MAPPINGS = Object.freeze([
  { field: 'speedBuffTurns', status: 'HASTE' },
  { field: 'invulnerableTurns', status: 'INVULN' },
  { field: 'heroismTurns', status: 'HEROISM' },
  { field: 'berserkTurns', status: 'BERSERK' },
  { field: 'shieldBuffTurns', status: 'SHIELD' },
  { field: 'protectPrayerTurns', status: 'PROT_EVIL' },
  { field: 'blindTurns', status: 'BLIND' },
  { field: 'confusedTurns', status: 'CONFUSE' },
  { field: 'confuseTurns', status: 'CONFUSE' },
  { field: 'paralyzedTurns', status: 'PARALYZE' },
  { field: 'paralyzeTurns', status: 'PARALYZE' },
  { field: 'afraidTurns', status: 'FEAR' },
  { field: 'fearTurns', status: 'FEAR' },
  { field: 'slowTurns', status: 'SLOW' },
  { field: 'poisonTurns', status: 'POISON' },
  { field: 'cutTurns', status: 'BLEED' },
  { field: 'bleedTurns', status: 'BLEED' },
  { field: 'tempResFireTurns', status: 'RES_FIRE' },
  { field: 'tempResColdTurns', status: 'RES_COLD' },
  { field: 'tempResElecTurns', status: 'RES_ELEC' },
  { field: 'tempResAcidTurns', status: 'RES_ACID' },
  { field: 'tempResPoisTurns', status: 'RES_POIS' },
  { field: 'espTurns', status: 'ESP' },
  { field: 'infraTurns', status: 'INFRA' },
  { field: 'wraithformTurns', status: 'PASS_WALL' }
]);

export class StatusEffectEngine {
  /**
   * 상태 식별자를 표준 카탈로그 키로 정규화합니다.
   * @param {string} rawKey
   * @returns {string}
   */
  static normalizeKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return '';
    const upper = rawKey.trim().toUpperCase().replace(/^STATUS_/, '');
    return STATUS_ALIASES[upper] || upper;
  }

  /**
   * 레거시 프로퍼티(speedBuffTurns, blindTurns 등)를 canonical entity.statuses와 양방향 동기화합니다.
   * @param {Object} entity
   */
  static syncLegacyFields(entity) {
    if (!entity || typeof entity !== 'object') return;
    if (entity._isSyncingLegacy) return;
    entity._isSyncingLegacy = true;

    try {
      if (!entity.statuses || typeof entity.statuses !== 'object') {
        entity.statuses = {};
      }

      if (!entity._legacySyncCache) {
        entity._legacySyncCache = {};
      }

      for (const { field, status } of LEGACY_FIELD_MAPPINGS) {
        const legacyVal = entity[field];
        const currentDur = entity.statuses[status]?.duration || 0;
        const cachedVal = entity._legacySyncCache[field];

        if (typeof legacyVal === 'number' && legacyVal > 0) {
          if (legacyVal !== currentDur && legacyVal !== cachedVal) {
            // 외부 코드에서 legacy 필드를 갱신한 경우
            this.applyStatus(entity, status, legacyVal);
          }
        } else if (legacyVal === 0 && currentDur > 0 && cachedVal !== 0 && cachedVal !== undefined) {
          // 외부 코드에서 명시적으로 0으로 해제한 경우
          this.removeStatus(entity, status);
        }

        // 동기화 후 양방향 일치 유지 (Player의 getter/setter가 없는 일반 객체일 때만 직접 할당)
        const finalDur = entity.statuses[status]?.duration || 0;
        const proto = Object.getPrototypeOf(entity);
        const desc = Object.getOwnPropertyDescriptor(entity, field) || (proto ? Object.getOwnPropertyDescriptor(proto, field) : null);
        if (!desc || (!desc.get && !desc.set)) {
          if (field in entity) {
            entity[field] = finalDur;
          }
        }
        entity._legacySyncCache[field] = finalDur;
      }
    } finally {
      entity._isSyncingLegacy = false;
    }
  }

  /**
   * 대상 엔티티가 특정 상태이상에 면역인지 여부를 검사합니다.
   * @param {Object} target
   * @param {string} statusKey
   * @returns {boolean}
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
    if (key === 'FEAR') {
      if (flags.has('NO_FEAR') || flags.has('RES_FEAR') || flags.has('IM_FEAR') || flags.has('HERO') || flags.has('STATUS_HERO')) {
        return true;
      }
      if (this.hasStatus(target, 'HEROISM') || this.hasStatus(target, 'BERSERK')) {
        return true;
      }
    }

    if (key === 'PARALYZE') {
      if (flags.has('FREE_ACT') || flags.has('IM_PARALYZE') || flags.has('NO_PARALYZE') || flags.has('IM_PARALYZED')) {
        return true;
      }
    }

    if (key === 'CONFUSE') {
      if (flags.has('NO_CONF') || flags.has('RES_CONF') || flags.has('IM_CONF') || flags.has('IM_CONFUSION')) {
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
   * @param {Object} entity - 대상 엔티티
   * @param {string} statusId - 상태 식별자
   * @param {number} [duration=null] - 지속 턴수
   * @param {number} [power=null] - 효과 위력
   * @param {Object|string} [source=null] - 발생원
   * @param {Object|Function} [addLogEntry=null] - 로거 함수 또는 Game 인스턴스
   * @returns {{ applied: boolean, reason?: string, statusKey: string, duration?: number, power?: number }}
   */
  static applyStatus(entity, statusId, duration = null, power = null, source = null, addLogEntry = null) {
    if (!entity || !statusId) {
      return { applied: false, reason: 'INVALID_INPUT', statusKey: '' };
    }

    const key = this.normalizeKey(statusId);
    const def = STATUS_DEFINITIONS[key];
    if (!def) {
      return { applied: false, reason: 'UNKNOWN_STATUS_KEY', statusKey: key };
    }

    if (!entity.statuses || typeof entity.statuses !== 'object') {
      entity.statuses = {};
    }

    const logFn = typeof addLogEntry === 'function'
      ? addLogEntry
      : (addLogEntry && typeof addLogEntry.addLogEntry === 'function' ? addLogEntry.addLogEntry.bind(addLogEntry) : null);

    // 면역 여부 판정
    if (this.isImmune(entity, key)) {
      const targetName = entity.displayName || entity.name || '대상';
      if (logFn) {
        logFn(`[Resist] 🛡️ ${targetName}이(가) ${def.name} 효과에 면역으로 저항했습니다!`, 'system');
      }
      TraceLogger.log('STATUS', `${targetName} resisted status ${key} via immunity flag.`);
      return { applied: false, reason: 'IMMUNE', statusKey: key };
    }

    const finalDur = Math.max(1, typeof duration === 'number' && Number.isFinite(duration) ? duration : (def.defaultDuration || 3));
    const finalPow = power !== null && power !== undefined && Number.isFinite(power) ? power : (def.defaultPower !== undefined ? def.defaultPower : 1);

    if (entity.statuses[key]) {
      entity.statuses[key].duration = Math.max(entity.statuses[key].duration, finalDur);
      entity.statuses[key].power = Math.max(entity.statuses[key].power || 0, finalPow);
      if (source) entity.statuses[key].source = source;
    } else {
      entity.statuses[key] = {
        duration: finalDur,
        power: finalPow,
        source: source || null,
        appliedAt: Date.now()
      };
    }

    if (typeof entity.markDirty === 'function') {
      entity.markDirty(`STATUS_APPLIED_${key}`);
    } else {
      entity._isDirty = true;
    }

    const targetName = entity.displayName || entity.name || '대상';
    if (logFn) {
      const icon = def.icon || (def.category === 'buff' ? '✨' : '⚠️');
      const logType = def.category === 'buff' ? 'loot' : 'combat';
      logFn(`[Status] ${icon} ${targetName}에게 ${def.name} (${entity.statuses[key].duration}턴) 효과가 부여되었습니다.`, logType);
    }

    return {
      applied: true,
      statusKey: key,
      duration: entity.statuses[key].duration,
      power: entity.statuses[key].power
    };
  }

  /**
   * 지정된 상태이상들을 치료/해제합니다.
   * @param {Object} entity - 대상 엔티티
   * @param {string|string[]} statusIds - 단일 키, 배열, 또는 'ALL_NEGATIVE'
   * @param {Object|Function} [addLogEntry=null]
   * @returns {string[]} 해제된 상태 키 목록
   */
  static cureStatus(entity, statusIds, addLogEntry = null) {
    if (!entity || !entity.statuses) return [];

    const logFn = typeof addLogEntry === 'function'
      ? addLogEntry
      : (addLogEntry && typeof addLogEntry.addLogEntry === 'function' ? addLogEntry.addLogEntry.bind(addLogEntry) : null);

    const cured = [];

    if (statusIds === 'ALL_NEGATIVE' || statusIds === 'NEGATIVE' || statusIds === 'DEBUFF') {
      for (const [rawKey, obj] of Object.entries(entity.statuses)) {
        if (!obj || obj.duration <= 0) continue;
        const norm = this.normalizeKey(rawKey);
        const def = STATUS_DEFINITIONS[norm];
        if (def && def.category === 'debuff') {
          delete entity.statuses[rawKey];
          cured.push(norm);
          if (logFn) {
            logFn(`[Status] ✨ ${entity.displayName || entity.name || '대상'}의 ${def.name || norm} 효과가 치료되었습니다.`, 'system');
          }
        }
      }
    } else {
      const list = Array.isArray(statusIds) ? statusIds : String(statusIds).split(',').map(s => s.trim());
      for (const rawId of list) {
        const norm = this.normalizeKey(rawId);
        for (const rawKey of Object.keys(entity.statuses)) {
          if (this.normalizeKey(rawKey) === norm) {
            const def = STATUS_DEFINITIONS[norm];
            delete entity.statuses[rawKey];
            cured.push(norm);
            if (logFn) {
              logFn(`[Status] ✨ ${entity.displayName || entity.name || '대상'}의 ${def ? def.name : norm} 효과가 치료되었습니다.`, 'system');
            }
          }
        }
      }
    }

    if (cured.length > 0) {
      if (typeof entity.markDirty === 'function') {
        entity.markDirty('STATUS_CURED');
      } else {
        entity._isDirty = true;
      }
      this.syncLegacyFields(entity);
    }

    return cured;
  }

  /**
   * 엔티티가 특정 상태를 활성 보유하고 있는지 확인합니다.
   * @param {Object} entity
   * @param {string} statusId
   * @returns {boolean}
   */
  static hasStatus(entity, statusId) {
    if (!entity || !statusId) return false;
    this.syncLegacyFields(entity);
    if (!entity.statuses || typeof entity.statuses !== 'object') return false;
    const norm = this.normalizeKey(statusId);
    for (const [k, v] of Object.entries(entity.statuses)) {
      if (this.normalizeKey(k) === norm && v && v.duration > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * 특정 상태의 남은 턴수를 조회합니다.
   * @param {Object} entity
   * @param {string} statusId
   * @returns {number}
   */
  static getTurns(entity, statusId) {
    if (!entity || !statusId) return 0;
    this.syncLegacyFields(entity);
    if (!entity.statuses || typeof entity.statuses !== 'object') return 0;
    const norm = this.normalizeKey(statusId);
    for (const [k, v] of Object.entries(entity.statuses)) {
      if (this.normalizeKey(k) === norm && v) {
        return v.duration || 0;
      }
    }
    return 0;
  }

  /**
   * 활성화된 상태들로부터 산출되는 전체 통합 보정치(speedDelta, toHitDelta, acDelta, damageReductionPct, tempResistances, flags 등)를 산출합니다.
   * @param {Object} entity
   * @returns {{ speedDelta: number, toHitDelta: number, toDamDelta: number, acDelta: number, damageReductionPct: number, tempResistances: { FIRE: number, COLD: number, LIGHTNING: number, ACID: number, POISON: number }, flags: { fearImmune: boolean, protEvil: boolean, telepathy: boolean, wraithform: boolean } }}
   */
  static getAggregatedModifiers(entity) {
    const modifiers = {
      speedDelta: 0,
      toHitDelta: 0,
      toDamDelta: 0,
      acDelta: 0,
      damageReductionPct: 0,
      tempResistances: {
        FIRE: 0,
        COLD: 0,
        LIGHTNING: 0,
        ACID: 0,
        POISON: 0
      },
      flags: {
        fearImmune: false,
        protEvil: false,
        telepathy: false,
        wraithform: false
      },
      maxHpBonus: 0,
      infraBonus: 0,
      regenBonus: 0,
      passWall: false,
      seeInvis: false,
      paralyzed: false,
      manaShieldRatio: 0
    };

    if (!entity) return modifiers;
    this.syncLegacyFields(entity);
    if (!entity.statuses || typeof entity.statuses !== 'object') return modifiers;

    for (const [rawKey, statusObj] of Object.entries(entity.statuses)) {
      if (!statusObj || statusObj.duration <= 0) continue;
      const key = this.normalizeKey(rawKey);

      switch (key) {
        case 'HASTE':
          modifiers.speedDelta += 10;
          break;
        case 'SLOW':
          modifiers.speedDelta -= 10;
          break;
        case 'FROST':
          modifiers.speedDelta -= 5;
          break;
        case 'PARALYZE':
          modifiers.speedDelta -= 99;
          modifiers.paralyzed = true;
          break;
        case 'HEROISM':
          modifiers.toHitDelta += 12;
          modifiers.maxHpBonus += 10;
          modifiers.flags.fearImmune = true;
          break;
        case 'BERSERK':
          modifiers.toHitDelta += 24;
          modifiers.toDamDelta += 15;
          modifiers.acDelta -= 10;
          modifiers.flags.fearImmune = true;
          break;
        case 'INVULN':
          modifiers.damageReductionPct = Math.max(modifiers.damageReductionPct, 0.90);
          modifiers.acDelta += 100;
          break;
        case 'SHIELD':
          modifiers.acDelta += 50;
          break;
        case 'PROT_EVIL':
          modifiers.flags.protEvil = true;
          modifiers.acDelta += 15;
          break;
        case 'BLESSED':
          modifiers.acDelta += 5;
          modifiers.toHitDelta += 10;
          break;
        case 'RES_FIRE':
          modifiers.tempResistances.FIRE = Math.max(modifiers.tempResistances.FIRE, 0.50);
          break;
        case 'RES_COLD':
          modifiers.tempResistances.COLD = Math.max(modifiers.tempResistances.COLD, 0.50);
          break;
        case 'RES_ELEC':
          modifiers.tempResistances.LIGHTNING = Math.max(modifiers.tempResistances.LIGHTNING, 0.50);
          break;
        case 'RES_ACID':
          modifiers.tempResistances.ACID = Math.max(modifiers.tempResistances.ACID, 0.50);
          break;
        case 'RES_POIS':
          modifiers.tempResistances.POISON = Math.max(modifiers.tempResistances.POISON, 0.50);
          break;
        case 'ESP':
          modifiers.flags.telepathy = true;
          break;
        case 'INFRA':
          modifiers.infraBonus += 5;
          break;
        case 'PASS_WALL':
          modifiers.flags.wraithform = true;
          modifiers.flags.passWall = true;
          modifiers.passWall = true;
          modifiers.wraithform = true;
          break;
        case 'REGEN_BOOST':
          modifiers.regenBonus += 5;
          break;
        case 'BLIND':
          modifiers.toHitDelta -= 20;
          modifiers.acDelta -= 10;
          break;
        case 'CONFUSE':
          modifiers.toHitDelta -= 10;
          modifiers.acDelta -= 5;
          break;
        case 'FEAR':
          modifiers.toHitDelta -= 10;
          modifiers.acDelta -= 5;
          break;
        case 'STUN':
          modifiers.toHitDelta -= 10;
          modifiers.acDelta -= 5;
          modifiers.speedDelta -= 5;
          break;
        case 'WEAKEN':
          modifiers.toDamDelta -= 10;
          break;
        case 'SUNDER':
          modifiers.acDelta -= 20;
          break;
        case 'SEE_INVIS':
          modifiers.seeInvis = true;
          break;
        case 'MANA_SHIELD':
          modifiers.manaShieldRatio = Math.max(modifiers.manaShieldRatio, 0.50);
          break;
      }
    }

    return modifiers;
  }

  /**
   * 하위 호환성 전용 수치 보정치 조회 래퍼
   * @param {Object} target
   * @returns {Object}
   */
  static calculateStatusModifiers(target) {
    const agg = this.getAggregatedModifiers(target);
    return {
      speed: agg.speedDelta,
      ac: agg.acDelta,
      toHit: agg.toHitDelta,
      toDam: agg.toDamDelta,
      str: 0,
      int: 0,
      wis: 0,
      dex: 0,
      con: 0,
      chr: 0,
      damageReduction: agg.damageReductionPct,
      damageReductionPct: agg.damageReductionPct,
      manaShieldRatio: agg.manaShieldRatio,
      resFire: agg.tempResistances.FIRE * 100,
      resCold: agg.tempResistances.COLD * 100,
      resElec: agg.tempResistances.LIGHTNING * 100,
      resAcid: agg.tempResistances.ACID * 100,
      seeInvis: agg.seeInvis,
      fearImmune: agg.flags.fearImmune,
      paralyzed: agg.paralyzed
    };
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
    for (const [k, v] of Object.entries(target.statuses)) {
      if (this.normalizeKey(k) === key) return v;
    }
    return null;
  }

  /**
   * 특정 상태를 강제로 제거합니다.
   * @param {Object} target
   * @param {string} statusKey
   * @param {Object|Function} [addLogEntry=null]
   * @returns {boolean}
   */
  static removeStatus(target, statusKey, addLogEntry = null) {
    return this.cureStatus(target, statusKey, addLogEntry).length > 0;
  }

  /**
   * 엔티티의 모든 상태를 일괄 제거합니다.
   * @param {Object} target
   * @param {string} [category=null] - 'debuff' | 'buff' | null
   * @param {Object|Function} [addLogEntry=null]
   * @returns {string[]}
   */
  static clearAllStatuses(target, category = null, addLogEntry = null) {
    if (!target || !target.statuses || typeof target.statuses !== 'object') return [];
    const removed = [];
    const logFn = typeof addLogEntry === 'function'
      ? addLogEntry
      : (addLogEntry && typeof addLogEntry.addLogEntry === 'function' ? addLogEntry.addLogEntry.bind(addLogEntry) : null);

    for (const rawKey of Object.keys(target.statuses)) {
      const norm = this.normalizeKey(rawKey);
      const def = STATUS_DEFINITIONS[norm];
      if (category && def && def.category !== category) continue;
      delete target.statuses[rawKey];
      removed.push(norm);
    }

    if (removed.length > 0) {
      if (typeof target.markDirty === 'function') {
        target.markDirty('STATUS_CLEAR_ALL');
      } else {
        target._isDirty = true;
      }
      this.syncLegacyFields(target);
      if (logFn) {
        logFn(`[Status] ✨ ${target.displayName || target.name || '대상'}의 상태가 모두 정화되었습니다.`, 'system');
      }
    }

    return removed;
  }

  /**
   * 매 턴 경과 시 상태 지속시간 차감 및 DoT 피해를 처리합니다.
   * @param {Object} target
   * @param {Object} [game=null]
   * @returns {{ expired: string[], damages: Array<{ type: string, amount: number, reduced?: boolean }> }}
   */
  static tickStatuses(target, game = null) {
    if (!target) return { expired: [], damages: [] };
    this.syncLegacyFields(target);

    if (!target.statuses || typeof target.statuses !== 'object') {
      return { expired: [], damages: [] };
    }

    const expired = [];
    const damages = [];
    let stateChanged = false;

    const logFn = game && typeof game.addLogEntry === 'function' ? game.addLogEntry.bind(game) : null;

    for (const [rawKey, statusObj] of Object.entries(target.statuses)) {
      if (!statusObj || statusObj.duration <= 0) {
        delete target.statuses[rawKey];
        expired.push(rawKey);
        stateChanged = true;
        continue;
      }

      const key = this.normalizeKey(rawKey);

      // DoT 및 주기적 효과 적용
      if (key === 'POISON') {
        const baseDmg = statusObj.power > 0 ? statusObj.power : 2;
        const hasResPois = TomeFlagResolver.hasFlag(target, 'RES_POIS') || (this.getTurns(target, 'RES_POIS') > 0);
        const poisonDmg = hasResPois ? Math.max(1, Math.floor(baseDmg * 0.5)) : baseDmg;
        if (target.stats && typeof target.stats.hp === 'number') {
          target.stats.hp = Math.max(0, target.stats.hp - poisonDmg);
        }
        damages.push({ type: 'POISON', amount: poisonDmg, reduced: hasResPois });
        if (logFn) {
          const targetName = target.displayName || target.name || '대상';
          const resNote = hasResPois ? ' (독 저항 50% 감쇄)' : '';
          const hpNote = target.stats ? ` (HP: ${target.stats.hp}/${target.stats.maxHp})` : '';
          logFn(`[Status] 🧪 ${targetName}이(가) 독으로 ${poisonDmg} 피해를 입었습니다!${resNote}${hpNote}`, 'combat');
        }
      } else if (key === 'BURN') {
        const hasResFire = flags.has('RES_FIRE');
        let burnDmg = statusObj.power > 0 ? statusObj.power : 5;
        if (hasResFire) burnDmg = Math.max(1, Math.floor(burnDmg * 0.5));
        if (target.stats && typeof target.stats.hp === 'number') {
          target.stats.hp = Math.max(0, target.stats.hp - burnDmg);
        }
        damages.push({ type: 'BURN', amount: burnDmg, reduced: hasResFire });
        if (logFn) {
          const targetName = target.displayName || target.name || '대상';
          const resNote = hasResFire ? ' (화염 저항 50% 감쇄)' : '';
          const hpNote = target.stats ? ` (HP: ${target.stats.hp}/${target.stats.maxHp})` : '';
          logFn(`[Status] 🔥 ${targetName}이(가) 화상으로 ${burnDmg} 화염 피해를 입었습니다!${resNote}${hpNote}`, 'combat');
        }
      } else if (key === 'BLEED') {
        const bleedDmg = statusObj.power > 0 ? statusObj.power : 3;
        if (target.stats && typeof target.stats.hp === 'number') {
          target.stats.hp = Math.max(0, target.stats.hp - bleedDmg);
        }
        damages.push({ type: 'BLEED', amount: bleedDmg });
        if (logFn) {
          const targetName = target.displayName || target.name || '대상';
          const hpNote = target.stats ? ` (HP: ${target.stats.hp}/${target.stats.maxHp})` : '';
          logFn(`[Status] 🩸 ${targetName}이(가) 출혈로 ${bleedDmg} 물리 피해를 입었습니다!${hpNote}`, 'combat');
        }
      } else if (key === 'DRAIN_MANA') {
        const drainAmt = statusObj.power > 0 ? statusObj.power : 5;
        if (target.stats && typeof target.stats.mp === 'number') {
          target.stats.mp = Math.max(0, target.stats.mp - drainAmt);
        }
        damages.push({ type: 'DRAIN_MANA', amount: drainAmt });
        if (logFn) {
          const targetName = target.displayName || target.name || '대상';
          logFn(`[Status] 🌀 ${targetName}의 마나가 ${drainAmt} 소모되었습니다!`, 'combat');
        }
      }

      // 지속시간 차감
      statusObj.duration--;
      stateChanged = true;

      // 만료 처리
      if (statusObj.duration <= 0) {
        delete target.statuses[rawKey];
        expired.push(key);
        const def = STATUS_DEFINITIONS[key];
        if (logFn) {
          const targetName = target.displayName || target.name || '대상';
          const name = def ? def.name : key;
          logFn(`[Status] ⏳ ${targetName}의 ${name} 상태가 해제되었습니다.`, 'system');
        }
      }
    }

    if (stateChanged) {
      if (typeof target.markDirty === 'function') {
        target.markDirty('STATUS_TICK');
      } else {
        target._isDirty = true;
      }
      this.syncLegacyFields(target);
    }

    return { expired, damages };
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
        switch (p) {
          case 'poison':
            return StatusEffectEngine.getTurns(entity, 'POISON');
          case 'frost':
            return StatusEffectEngine.getTurns(entity, 'FROST');
          case 'paralyzed':
            return StatusEffectEngine.hasStatus(entity, 'PARALYZE');
          case 'paralyzeTurns':
            return StatusEffectEngine.getTurns(entity, 'PARALYZE');
          case 'blind':
            return StatusEffectEngine.getTurns(entity, 'BLIND');
          case 'confused':
          case 'confusion':
            return StatusEffectEngine.getTurns(entity, 'CONFUSE');
          case 'afraid':
          case 'fear':
            return StatusEffectEngine.getTurns(entity, 'FEAR');
          case 'slow':
            return StatusEffectEngine.getTurns(entity, 'SLOW');
          case 'bleed':
            return StatusEffectEngine.getTurns(entity, 'BLEED');
          case 'magicVulnerability':
            return StatusEffectEngine.getTurns(entity, 'MAGIC_VULN');
          default:
            return target[p];
        }
      },
      set(target, prop, value) {
        if (typeof prop === 'symbol') return Reflect.set(target, prop, value);
        const p = String(prop);
        target[p] = value;

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
              const dur = StatusEffectEngine.getTurns(entity, 'PARALYZE') || 3;
              StatusEffectEngine.applyStatus(entity, 'PARALYZE', dur);
            } else {
              StatusEffectEngine.removeStatus(entity, 'PARALYZE');
            }
            break;
          case 'paralyzeTurns':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'PARALYZE', value);
            else StatusEffectEngine.removeStatus(entity, 'PARALYZE');
            break;
          case 'blind':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'BLIND', value);
            else StatusEffectEngine.removeStatus(entity, 'BLIND');
            break;
          case 'confused':
          case 'confusion':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'CONFUSE', value);
            else StatusEffectEngine.removeStatus(entity, 'CONFUSE');
            break;
          case 'afraid':
          case 'fear':
            if (value > 0) StatusEffectEngine.applyStatus(entity, 'FEAR', value);
            else StatusEffectEngine.removeStatus(entity, 'FEAR');
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
