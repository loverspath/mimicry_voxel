/**
 * @module SynthesisSchemaConfig
 * @category configs
 * @description Declarative Synthesis Grammar for Argon Phase 2.
 *              Defines the 4-axis procedural synthesis tables:
 *              1. BLOW_METHOD_GRAMMAR (All 22 ToME Blow Methods)
 *              2. BLOW_EFFECT_GRAMMAR (All 34 ToME Blow Effects)
 *              3. SPELL_DESCRIPTOR_GRAMMAR (All 94 ToME Spells with EffectOp templates)
 *              4. ARCHETYPE_FLAG_TACTICS (61 char Symbols x 124 flags Tactical Generators)
 * @purity Pure Data / Schema Definition
 */

import { EFFECT_OP_TYPES } from './EffectOpSchema.js';

// =========================================================================
// 1. BLOW_METHOD_GRAMMAR (All 22 ToME Blow Methods)
// =========================================================================
export const BLOW_METHOD_GRAMMAR = Object.freeze({
  // MELEE_IMPACT group
  HIT: Object.freeze({
    delivery: 'MELEE_IMPACT',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.05,
    ignoreACPct: 0.20,
    knockbackChance: 0.15,
    koVerb: '강타',
    vfxType: 'CRUSH',
    icon: '⚔️'
  }),
  PUNCH: Object.freeze({
    delivery: 'MELEE_IMPACT',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.08,
    ignoreACPct: 0.20,
    knockbackChance: 0.20,
    koVerb: '주먹 강타',
    vfxType: 'CRUSH',
    icon: '👊'
  }),
  KICK: Object.freeze({
    delivery: 'MELEE_IMPACT',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.08,
    ignoreACPct: 0.20,
    knockbackChance: 0.35,
    koVerb: '발차기',
    vfxType: 'CRUSH',
    icon: '🦶'
  }),
  BUTT: Object.freeze({
    delivery: 'MELEE_IMPACT',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.05,
    ignoreACPct: 0.25,
    knockbackChance: 0.30,
    koVerb: '박치기',
    vfxType: 'CRUSH',
    icon: '💥'
  }),
  CRUSH: Object.freeze({
    delivery: 'MELEE_IMPACT',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.10,
    ignoreACPct: 0.35,
    knockbackChance: 0.30,
    koVerb: '분쇄 강타',
    vfxType: 'CRUSH',
    icon: '🔨'
  }),

  // MELEE_REND group
  CLAW: Object.freeze({
    delivery: 'MELEE_REND',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.18,
    multiHitCap: 3,
    bleedChance: 0.45,
    koVerb: '할퀴기',
    vfxType: 'SLASH',
    icon: '🐾'
  }),
  BITE: Object.freeze({
    delivery: 'MELEE_REND',
    range: 1.5,
    shape: 'SINGLE',
    critBonus: 0.20,
    multiHitCap: 2,
    bleedChance: 0.50,
    koVerb: '물어뜯기',
    vfxType: 'SLASH',
    icon: '🦷'
  }),

  // CONTACT_INJECT group
  STING: Object.freeze({
    delivery: 'CONTACT_INJECT',
    range: 1.5,
    shape: 'SINGLE',
    hitBonus: 25,
    ignoreACPct: 0.35,
    statusDurationMult: 1.5,
    koVerb: '독침 찌르기',
    vfxType: 'PIERCE',
    icon: '🦂'
  }),
  TOUCH: Object.freeze({
    delivery: 'CONTACT_INJECT',
    range: 1.5,
    shape: 'SINGLE',
    hitBonus: 25,
    ignoreACPct: 0.40,
    statusDurationMult: 1.5,
    koVerb: '불길한 접촉',
    vfxType: 'PIERCE',
    icon: '✋'
  }),
  CRAWL: Object.freeze({
    delivery: 'CONTACT_INJECT',
    range: 1.5,
    shape: 'SINGLE',
    hitBonus: 20,
    ignoreACPct: 0.25,
    statusDurationMult: 1.4,
    koVerb: '침식 기어오르기',
    vfxType: 'PIERCE',
    icon: '🐛'
  }),
  DROOL: Object.freeze({
    delivery: 'CONTACT_INJECT',
    range: 1.5,
    shape: 'SINGLE',
    hitBonus: 15,
    ignoreACPct: 0.30,
    statusDurationMult: 1.6,
    koVerb: '타액 분비',
    vfxType: 'PIERCE',
    icon: '💧'
  }),

  // MELEE_RUSH group
  CHARGE: Object.freeze({
    delivery: 'MELEE_RUSH',
    range: 3.5,
    shape: 'LINE_RUSH',
    displaceMode: 'CHARGE_TO',
    slowChance: 0.50,
    koVerb: '돌격',
    vfxType: 'THRUST',
    icon: '🏃'
  }),
  ENGULF: Object.freeze({
    delivery: 'MELEE_RUSH',
    range: 2.5,
    shape: 'LINE_RUSH',
    displaceMode: 'CHARGE_TO',
    slowChance: 0.60,
    koVerb: '집어삼키기',
    vfxType: 'THRUST',
    icon: '🕳️'
  }),

  // RANGED_GAZE_SPIT group
  GAZE: Object.freeze({
    delivery: 'RANGED_GAZE_SPIT',
    range: 4.5,
    shape: 'BEAM',
    hitBonus: 20,
    koVerb: '마안 응시',
    vfxType: 'MAGIC',
    icon: '👁️'
  }),
  SPIT: Object.freeze({
    delivery: 'RANGED_GAZE_SPIT',
    range: 4.5,
    shape: 'BEAM',
    hitBonus: 15,
    koVerb: '타액 투척',
    vfxType: 'MAGIC',
    icon: '💦'
  }),
  SHOW: Object.freeze({
    delivery: 'RANGED_GAZE_SPIT',
    range: 4.0,
    shape: 'BEAM',
    hitBonus: 20,
    koVerb: '현혹의 과시',
    vfxType: 'MAGIC',
    icon: '✨'
  }),

  // RADIAL_BURST group
  WAIL: Object.freeze({
    delivery: 'RADIAL_BURST',
    range: 2.5,
    radius: 2.5,
    shape: 'SURROUND_AOE',
    koVerb: '통곡 파동',
    vfxType: 'SHOCKWAVE',
    icon: '📢'
  }),
  MOAN: Object.freeze({
    delivery: 'RADIAL_BURST',
    range: 2.5,
    radius: 2.5,
    shape: 'SURROUND_AOE',
    koVerb: '신음 파동',
    vfxType: 'SHOCKWAVE',
    icon: '👻'
  }),
  SPORE: Object.freeze({
    delivery: 'RADIAL_BURST',
    range: 2.5,
    radius: 2.5,
    shape: 'SURROUND_AOE',
    koVerb: '포자 방출',
    vfxType: 'SHOCKWAVE',
    icon: '🍄'
  }),
  EXPLODE: Object.freeze({
    delivery: 'RADIAL_BURST',
    range: 2.5,
    radius: 3.0,
    shape: 'SURROUND_AOE',
    koVerb: '자폭 충격파',
    vfxType: 'SHOCKWAVE',
    icon: '💥'
  }),
  INSULT: Object.freeze({
    delivery: 'RADIAL_BURST',
    range: 3.0,
    radius: 2.5,
    shape: 'SURROUND_AOE',
    koVerb: '도발 조롱',
    vfxType: 'SHOCKWAVE',
    icon: '🤬'
  }),
  BEG: Object.freeze({
    delivery: 'RADIAL_BURST',
    range: 2.5,
    radius: 2.0,
    shape: 'SURROUND_AOE',
    koVerb: '애원 분산',
    vfxType: 'SHOCKWAVE',
    icon: '🥺'
  })
});

// =========================================================================
// 2. BLOW_EFFECT_GRAMMAR (All 34 ToME Blow Effects)
// =========================================================================
export const BLOW_EFFECT_GRAMMAR = Object.freeze({
  HURT: Object.freeze({ element: 'PHYSICAL', statusId: null, mult: 1.15, koPrefix: '맹렬한' }),
  '*': Object.freeze({ element: 'PHYSICAL', statusId: null, mult: 1.15, koPrefix: '맹렬한' }),

  POISON: Object.freeze({ element: 'POISON', statusId: 'POISON', duration: 5, power: 6, mult: 1.25, koPrefix: '맹독의' }),
  DISEASE: Object.freeze({ element: 'POISON', statusId: 'POISON', duration: 6, power: 8, mult: 1.25, koPrefix: '역병의' }),
  ABOMINATION: Object.freeze({ element: 'POISON', statusId: 'POISON', duration: 5, power: 7, mult: 1.30, koPrefix: '흉측한 오염의' }),

  FIRE: Object.freeze({ element: 'FIRE', statusId: 'BURN', duration: 3, power: 5, mult: 1.30, koPrefix: '업화의' }),
  COLD: Object.freeze({ element: 'COLD', statusId: 'SLOW', duration: 3, power: 10, mult: 1.30, koPrefix: '혹한의' }),
  ELEC: Object.freeze({ element: 'LIGHTNING', statusId: 'STUN', duration: 2, power: 5, mult: 1.35, koPrefix: '뇌전의' }),
  ACID: Object.freeze({ element: 'ACID', statusId: 'SUNDER', duration: 4, power: 15, ignoreACPct: 0.40, mult: 1.30, koPrefix: '부식성' }),

  PARALYZE: Object.freeze({ element: 'DARK', statusId: 'PARALYZE', duration: 2, chance: 0.55, mult: 1.20, koPrefix: '마비의' }),
  CONFUSE: Object.freeze({ element: 'CONFUSION', statusId: 'CONFUSE', duration: 4, chance: 0.75, mult: 1.25, koPrefix: '혼란의' }),
  HALLU: Object.freeze({ element: 'CONFUSION', statusId: 'CONFUSE', duration: 4, chance: 0.75, mult: 1.25, koPrefix: '환각의' }),
  INSANITY: Object.freeze({ element: 'CONFUSION', statusId: 'CONFUSE', duration: 5, chance: 0.80, mult: 1.30, koPrefix: '광기의' }),

  TERRIFY: Object.freeze({ element: 'DARK', statusId: 'FEAR', duration: 4, chance: 0.80, mult: 1.20, koPrefix: '공포의' }),
  BLIND: Object.freeze({ element: 'DARK', statusId: 'BLIND', duration: 4, chance: 0.75, mult: 1.20, koPrefix: '실명의' }),

  EXP_10: Object.freeze({ element: 'NETHER', lifestealPct: 0.35, drainType: 'XP', drainAmount: 10, mult: 1.35, koPrefix: '영혼 착취의' }),
  EXP_20: Object.freeze({ element: 'NETHER', lifestealPct: 0.40, drainType: 'XP', drainAmount: 20, mult: 1.35, koPrefix: '원혼 흡수의' }),
  EXP_40: Object.freeze({ element: 'NETHER', lifestealPct: 0.45, drainType: 'XP', drainAmount: 40, mult: 1.35, koPrefix: '망령 갈취의' }),
  EXP_80: Object.freeze({ element: 'NETHER', lifestealPct: 0.50, drainType: 'XP', drainAmount: 80, mult: 1.40, koPrefix: '대사령 포식의' }),

  LOSE_STR: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'str', mult: 1.30, koPrefix: '완력 붕괴의' }),
  LOSE_DEX: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'dex', mult: 1.30, koPrefix: '민첩 붕괴의' }),
  LOSE_CON: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'con', mult: 1.30, koPrefix: '체력 붕괴의' }),
  LOSE_INT: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'int', mult: 1.30, koPrefix: '지능 붕괴의' }),
  LOSE_WIS: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'wis', mult: 1.30, koPrefix: '지혜 붕괴의' }),
  LOSE_CHR: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'chr', mult: 1.30, koPrefix: '매력 붕괴의' }),
  LOSE_ALL: Object.freeze({ element: 'NETHER', statusId: 'WEAKEN', duration: 5, stat: 'all', mult: 1.40, koPrefix: '기력 붕괴의' }),

  UN_BONUS: Object.freeze({ element: 'MANA', dispelTarget: true, drainType: 'MANA', drainAmount: 15, mult: 1.30, koPrefix: '마력 파쇄의' }),
  UN_POWER: Object.freeze({ element: 'MANA', dispelTarget: true, drainType: 'MANA', drainAmount: 25, mult: 1.35, koPrefix: '신성 해체의' }),

  SHATTER: Object.freeze({ element: 'SHARDS', earthquakeRadius: 1, ignoreACPct: 0.35, mult: 1.45, koPrefix: '대지 분쇄의' }),
  TIME: Object.freeze({ element: 'TIME', statusId: 'SLOW', duration: 4, mult: 1.40, koPrefix: '시간 역행의' }),

  EAT_GOLD: Object.freeze({ element: 'PHYSICAL', plunderBonus: true, lifestealPct: 0.25, plunderType: 'GOLD', mult: 1.25, koPrefix: '금화 약탈의' }),
  EAT_ITEM: Object.freeze({ element: 'PHYSICAL', plunderBonus: true, lifestealPct: 0.25, plunderType: 'ITEM', mult: 1.25, koPrefix: '보물 강탈의' }),
  EAT_FOOD: Object.freeze({ element: 'PHYSICAL', plunderBonus: true, lifestealPct: 0.25, plunderType: 'FOOD', mult: 1.25, koPrefix: '식량 포식의' }),
  EAT_LITE: Object.freeze({ element: 'PHYSICAL', plunderBonus: true, lifestealPct: 0.25, plunderType: 'LITE', mult: 1.25, koPrefix: '광원 흡수의' })
});

// Helper for building canonical EffectOp arrays for spells
function makeBreathOps(element, dice, range, onHitStatus = null) {
  const onHitOps = onHitStatus ? [{
    op: EFFECT_OP_TYPES.APPLY_STATUS,
    statusId: onHitStatus.id,
    duration: onHitStatus.duration || 4,
    power: onHitStatus.power || 5
  }] : [];

  return [
    {
      op: EFFECT_OP_TYPES.PROJECT_AREA,
      shape: 'CONE',
      element,
      dice,
      range,
      radius: 2,
      onHitOps
    }
  ];
}

function makeBallOps(element, dice, range, radius, onHitStatus = null) {
  const onHitOps = onHitStatus ? [{
    op: EFFECT_OP_TYPES.APPLY_STATUS,
    statusId: onHitStatus.id,
    duration: onHitStatus.duration || 4,
    power: onHitStatus.power || 5
  }] : [];

  return [
    {
      op: EFFECT_OP_TYPES.PROJECT_AREA,
      shape: 'BALL',
      element,
      dice,
      range,
      radius,
      onHitOps
    }
  ];
}

function makeBoltOps(element, dice, range, onHitStatus = null) {
  const ops = [
    {
      op: EFFECT_OP_TYPES.DEAL_DAMAGE,
      element,
      dice,
      target: 'TARGET'
    }
  ];
  if (onHitStatus) {
    ops.push({
      op: EFFECT_OP_TYPES.APPLY_STATUS,
      statusId: onHitStatus.id,
      duration: onHitStatus.duration || 3,
      power: onHitStatus.power || 5,
      target: 'TARGET'
    });
  }
  return ops;
}

// =========================================================================
// 3. SPELL_DESCRIPTOR_GRAMMAR (All 94 ToME Spells)
// =========================================================================
export const SPELL_DESCRIPTOR_GRAMMAR = Object.freeze({
  // --- 23 Breaths (BR_*) ---
  BR_ACID: Object.freeze({
    id: 'BR_ACID', name: '산성 브레스', desc: '전방 부채꼴에 강산성 브레스를 뿜어냅니다.',
    type: 'BREATH', element: 'ACID', cooldown: 6, range: 6.5, dice: '12d12', icon: '🐉', color: '#22c55e',
    ops: makeBreathOps('ACID', '12d12', 6.5, { id: 'SUNDER', duration: 4, power: 15 })
  }),
  BR_ELEC: Object.freeze({
    id: 'BR_ELEC', name: '뇌격 브레스', desc: '전방 부채꼴에 파괴적인 번개 브레스를 방출합니다.',
    type: 'BREATH', element: 'LIGHTNING', cooldown: 6, range: 6.5, dice: '12d12', icon: '🐉', color: '#eab308',
    ops: makeBreathOps('LIGHTNING', '12d12', 6.5, { id: 'STUN', duration: 2, power: 5 })
  }),
  BR_FIRE: Object.freeze({
    id: 'BR_FIRE', name: '화염 브레스', desc: '작열하는 업화 브레스를 전방에 뿜어냅니다.',
    type: 'BREATH', element: 'FIRE', cooldown: 6, range: 7.0, dice: '15d12', icon: '🐉', color: '#ef4444',
    ops: makeBreathOps('FIRE', '15d12', 7.0, { id: 'BURN', duration: 3, power: 8 })
  }),
  BR_COLD: Object.freeze({
    id: 'BR_COLD', name: '냉기 브레스', desc: '절대영도의 동결 브레스를 전방에 몰아칩니다.',
    type: 'BREATH', element: 'COLD', cooldown: 6, range: 7.0, dice: '15d12', icon: '🐉', color: '#38bdf8',
    ops: makeBreathOps('COLD', '15d12', 7.0, { id: 'SLOW', duration: 3, power: 10 })
  }),
  BR_POIS: Object.freeze({
    id: 'BR_POIS', name: '맹독 브레스', desc: '치명적인 맹독 포자 가스를 전방에 살포합니다.',
    type: 'BREATH', element: 'POISON', cooldown: 6, range: 6.5, dice: '12d12', icon: '🐉', color: '#10b981',
    ops: makeBreathOps('POISON', '12d12', 6.5, { id: 'POISON', duration: 5, power: 8 })
  }),
  BR_NETH: Object.freeze({
    id: 'BR_NETH', name: '황천 브레스', desc: '사령과 명계의 기운을 담은 황천 브레스를 방출합니다.',
    type: 'BREATH', element: 'NETHER', cooldown: 6, range: 6.5, dice: '12d10', icon: '🐉', color: '#7c3aed',
    ops: makeBreathOps('NETHER', '12d10', 6.5)
  }),
  BR_LITE: Object.freeze({
    id: 'BR_LITE', name: '광휘 브레스', desc: '눈부신 섬광의 태양빛 브레스를 방출합니다.',
    type: 'BREATH', element: 'LIGHT', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#fde047',
    ops: makeBreathOps('LIGHT', '10d10', 6.5)
  }),
  BR_DARK: Object.freeze({
    id: 'BR_DARK', name: '암흑 브레스', desc: '심연의 어둠을 담은 흑요석 브레스를 토해냅니다.',
    type: 'BREATH', element: 'DARK', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#334155',
    ops: makeBreathOps('DARK', '10d10', 6.5, { id: 'BLIND', duration: 4 })
  }),
  BR_CONF: Object.freeze({
    id: 'BR_CONF', name: '혼란 브레스', desc: '정신을 어지럽히는 환각 파동 브레스를 뿜습니다.',
    type: 'BREATH', element: 'CONFUSION', cooldown: 5, range: 6.0, dice: '8d8', icon: '🐉', color: '#c084fc',
    ops: makeBreathOps('CONFUSION', '8d8', 6.0, { id: 'CONFUSE', duration: 4 })
  }),
  BR_SOUN: Object.freeze({
    id: 'BR_SOUN', name: '음파 브레스', desc: '공기를 찢는 고주파 충격 음파를 발사합니다.',
    type: 'BREATH', element: 'SOUND', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#f59e0b',
    ops: makeBreathOps('SOUND', '10d10', 6.5, { id: 'STUN', duration: 2, power: 6 })
  }),
  BR_CHAO: Object.freeze({
    id: 'BR_CHAO', name: '혼돈 브레스', desc: '물리 법칙을 뒤흔드는 혼돈의 소용돌이를 뿜어냅니다.',
    type: 'BREATH', element: 'CHAOS', cooldown: 6, range: 7.0, dice: '14d12', icon: '🐉', color: '#ec4899',
    ops: makeBreathOps('CHAOS', '14d12', 7.0, { id: 'CONFUSE', duration: 3 })
  }),
  BR_DISE: Object.freeze({
    id: 'BR_DISE', name: '마법 해체 브레스', desc: '모든 마법적 보호막을 부식시키는 해체 브레스입니다.',
    type: 'BREATH', element: 'DISENCHANT', cooldown: 6, range: 6.5, dice: '12d12', icon: '🐉', color: '#a855f7',
    ops: makeBreathOps('DISENCHANT', '12d12', 6.5)
  }),
  BR_NEXU: Object.freeze({
    id: 'BR_NEXU', name: '넥서스 왜곡 브레스', desc: '공간 좌표를 뒤틀어버리는 넥서스 브레스를 방출합니다.',
    type: 'BREATH', element: 'NEXUS', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#6366f1',
    ops: makeBreathOps('NEXUS', '10d10', 6.5)
  }),
  BR_TIME: Object.freeze({
    id: 'BR_TIME', name: '시간 왜곡 브레스', desc: '시간 흐름을 둔화시키는 시공간 브레스를 방출합니다.',
    type: 'BREATH', element: 'TIME', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#0ea5e9',
    ops: makeBreathOps('TIME', '10d10', 6.5, { id: 'SLOW', duration: 4, power: 10 })
  }),
  BR_INER: Object.freeze({
    id: 'BR_INER', name: '관성 감속 브레스', desc: '적의 신체 관성을 구속하여 둔화시키는 브레스입니다.',
    type: 'BREATH', element: 'INERTIA', cooldown: 5, range: 6.0, dice: '8d8', icon: '🐉', color: '#64748b',
    ops: makeBreathOps('INERTIA', '8d8', 6.0, { id: 'SLOW', duration: 5, power: 10 })
  }),
  BR_GRAV: Object.freeze({
    id: 'BR_GRAV', name: '중력 붕괴 브레스', desc: '극대 중력장을 형성하여 적을 압쇄합니다.',
    type: 'BREATH', element: 'GRAVITY', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#475569',
    ops: makeBreathOps('GRAVITY', '10d10', 6.5)
  }),
  BR_SHAR: Object.freeze({
    id: 'BR_SHAR', name: '강철 파편 브레스', desc: '무수한 강철 파편 폭풍을 전방에 쏟아붓습니다.',
    type: 'BREATH', element: 'SHARDS', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#94a3b8',
    ops: makeBreathOps('SHARDS', '10d10', 6.5)
  }),
  BR_PLAS: Object.freeze({
    id: 'BR_PLAS', name: '플라즈마 브레스', desc: '초고열 플라즈마 광선을 전방에 뿜어냅니다.',
    type: 'BREATH', element: 'PLASMA', cooldown: 6, range: 7.0, dice: '14d12', icon: '🐉', color: '#f43f5e',
    ops: makeBreathOps('PLASMA', '14d12', 7.0)
  }),
  BR_FORC: Object.freeze({
    id: 'BR_FORC', name: '역장 충격 브레스', desc: '강력한 물리적 역장 파동을 발사하여 밀쳐냅니다.',
    type: 'BREATH', element: 'FORCE', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#38bdf8',
    ops: makeBreathOps('FORCE', '10d10', 6.5)
  }),
  BR_WALL: Object.freeze({
    id: 'BR_WALL', name: '충격장 브레스', desc: '역장 벽을 형성하며 대미지를 주는 파동입니다.',
    type: 'BREATH', element: 'FORCE', cooldown: 6, range: 6.5, dice: '10d10', icon: '🐉', color: '#38bdf8',
    ops: makeBreathOps('FORCE', '10d10', 6.5)
  }),
  BR_MANA: Object.freeze({
    id: 'BR_MANA', name: '순수 마나 브레스', desc: '원초적 순수 마나 에너지를 방출하여 모든 저항을 관통합니다.',
    type: 'BREATH', element: 'MANA', cooldown: 7, range: 7.5, dice: '16d12', icon: '🐉', color: '#e879f9',
    ops: makeBreathOps('MANA', '16d12', 7.5)
  }),
  BR_DISI: Object.freeze({
    id: 'BR_DISI', name: '원자 분해 브레스', desc: '물질을 분해하는 파멸의 분해 광선을 뿜어냅니다.',
    type: 'BREATH', element: 'DISINTEGRATION', cooldown: 7, range: 7.5, dice: '15d12', icon: '🐉', color: '#fb7185',
    ops: makeBreathOps('DISINTEGRATION', '15d12', 7.5)
  }),
  BR_NUKE: Object.freeze({
    id: 'BR_NUKE', name: '방사능 브레스', desc: '유독 방사능 오염 가스를 방출하여 맹독과 방사능 피해를 가합니다.',
    type: 'BREATH', element: 'POISON', cooldown: 7, range: 7.5, dice: '16d12', icon: '🐉', color: '#84cc16',
    ops: makeBreathOps('POISON', '16d12', 7.5, { id: 'POISON', duration: 6, power: 10 })
  }),

  // --- 13 Balls (BA_*) ---
  BA_ACID: Object.freeze({
    id: 'BA_ACID', name: '산성 폭풍구', desc: '목표 지점 반경에 강산성 폭발을 일으킵니다.',
    type: 'AOE', element: 'ACID', cooldown: 5, range: 6.0, dice: '8d8', icon: '💥', color: '#22c55e',
    ops: makeBallOps('ACID', '8d8', 6.0, 2.5, { id: 'SUNDER', duration: 3, power: 10 })
  }),
  BA_ELEC: Object.freeze({
    id: 'BA_ELEC', name: '뇌격 구체 폭발', desc: '목표 지점 반경에 연쇄 번개 폭풍을 일으킵니다.',
    type: 'AOE', element: 'LIGHTNING', cooldown: 5, range: 6.0, dice: '8d8', icon: '⚡', color: '#eab308',
    ops: makeBallOps('LIGHTNING', '8d8', 6.0, 2.5, { id: 'STUN', duration: 2, power: 5 })
  }),
  BA_FIRE: Object.freeze({
    id: 'BA_FIRE', name: '화염구 폭발 (Fire Ball)', desc: '목표 지점 반경에 거대한 화염 폭풍을 일으킵니다.',
    type: 'AOE', element: 'FIRE', cooldown: 5, range: 6.0, dice: '10d10', icon: '🔥', color: '#ef4444',
    ops: makeBallOps('FIRE', '10d10', 6.0, 2.5, { id: 'BURN', duration: 3, power: 6 })
  }),
  BA_COLD: Object.freeze({
    id: 'BA_COLD', name: '동결 폭풍구', desc: '목표 지점 반경에 냉기 눈보라를 몰아칩니다.',
    type: 'AOE', element: 'COLD', cooldown: 5, range: 6.0, dice: '10d10', icon: '❄️', color: '#38bdf8',
    ops: makeBallOps('COLD', '10d10', 6.0, 2.5, { id: 'SLOW', duration: 3, power: 10 })
  }),
  BA_POIS: Object.freeze({
    id: 'BA_POIS', name: '맹독 독가스 폭발', desc: '목표 지점 반경에 치명적인 맹독 구름을 확산시킵니다.',
    type: 'AOE', element: 'POISON', cooldown: 4, range: 5.5, dice: '12d2', icon: '☁️', color: '#10b981',
    ops: makeBallOps('POISON', '12d2', 5.5, 3.0, { id: 'POISON', duration: 4, power: 6 })
  }),
  BA_NETH: Object.freeze({
    id: 'BA_NETH', name: '황천 영혼 폭풍', desc: '황천의 사령 폭풍을 일으켜 영혼 피해를 입힙니다.',
    type: 'AOE', element: 'NETHER', cooldown: 5, range: 6.0, dice: '10d10', icon: '☠️', color: '#7c3aed',
    ops: makeBallOps('NETHER', '10d10', 6.0, 2.5)
  }),
  BA_WATE: Object.freeze({
    id: 'BA_WATE', name: '대홍수 해일 폭발', desc: '거대한 수류 해일을 일으켜 광역 피해를 입힙니다.',
    type: 'AOE', element: 'WATER', cooldown: 6, range: 6.0, dice: '12d10', icon: '🌊', color: '#0284c7',
    ops: makeBallOps('WATER', '12d10', 6.0, 3.0)
  }),
  BA_MANA: Object.freeze({
    id: 'BA_MANA', name: '마나 폭풍 (Mana Storm)', desc: '전장을 뒤덮는 극대 마나 폭풍으로 모든 저항을 분쇄합니다.',
    type: 'AOE', element: 'MANA', cooldown: 7, range: 7.0, dice: '15d10', icon: '🌌', color: '#e879f9',
    ops: makeBallOps('MANA', '15d10', 7.0, 3.0)
  }),
  BA_DARK: Object.freeze({
    id: 'BA_DARK', name: '암흑 성운 폭발', desc: '암흑 성운을 폭발시켜 적들의 시야를 가립니다.',
    type: 'AOE', element: 'DARK', cooldown: 5, range: 6.0, dice: '8d10', icon: '🌑', color: '#1e293b',
    ops: makeBallOps('DARK', '8d10', 6.0, 2.5, { id: 'BLIND', duration: 3 })
  }),
  BA_LITE: Object.freeze({
    id: 'BA_LITE', name: '태양광 폭발', desc: '강렬한 성스러운 태양광 폭발을 일으킵니다.',
    type: 'AOE', element: 'LIGHT', cooldown: 5, range: 6.0, dice: '8d10', icon: '☀️', color: '#fef08a',
    ops: makeBallOps('LIGHT', '8d10', 6.0, 2.5)
  }),
  BA_CHAO: Object.freeze({
    id: 'BA_CHAO', name: '혼돈 폭풍', desc: '혼돈의 파동을 일으켜 광역 무작위 피해를 줍니다.',
    type: 'AOE', element: 'CHAOS', cooldown: 5, range: 6.0, dice: '10d10', icon: '🌀', color: '#ec4899',
    ops: makeBallOps('CHAOS', '10d10', 6.0, 2.5, { id: 'CONFUSE', duration: 3 })
  }),
  BA_SOUN: Object.freeze({
    id: 'BA_SOUN', name: '음파 폭풍 충격파', desc: '주변을 진동시키는 극초음파 폭풍구를 폭발시킵니다.',
    type: 'AOE', element: 'SOUND', cooldown: 5, range: 6.0, dice: '8d8', icon: '📢', color: '#f59e0b',
    ops: makeBallOps('SOUND', '8d8', 6.0, 2.5, { id: 'STUN', duration: 2, power: 5 })
  }),
  BA_SHAR: Object.freeze({
    id: 'BA_SHAR', name: '파편 폭풍구', desc: '날카로운 금속 파편을 비산시켜 적들을 찢습니다.',
    type: 'AOE', element: 'SHARDS', cooldown: 5, range: 6.0, dice: '8d8', icon: '🗡️', color: '#94a3b8',
    ops: makeBallOps('SHARDS', '8d8', 6.0, 2.5)
  }),

  // --- 19 Bolts & Projectiles ---
  BO_ACID: Object.freeze({
    id: 'BO_ACID', name: '산성 볼트', desc: '부식성 산성 볼트를 투사하여 피해를 입힙니다.',
    type: 'PROJECTILE', element: 'ACID', cooldown: 3, range: 6.0, dice: '7d8', icon: '🧪', color: '#22c55e',
    ops: makeBoltOps('ACID', '7d8', 6.0)
  }),
  BO_ELEC: Object.freeze({
    id: 'BO_ELEC', name: '뇌격 볼트', desc: '번개 볼트를 투사하여 뇌격 피해와 감전을 가합니다.',
    type: 'PROJECTILE', element: 'LIGHTNING', cooldown: 3, range: 6.0, dice: '4d8', icon: '⚡', color: '#eab308',
    ops: makeBoltOps('LIGHTNING', '4d8', 6.0, { id: 'STUN', duration: 1, power: 5 })
  }),
  BO_FIRE: Object.freeze({
    id: 'BO_FIRE', name: '화염 볼트', desc: '작열하는 화염 볼트를 투사하여 화염 피해를 입힙니다.',
    type: 'PROJECTILE', element: 'FIRE', cooldown: 3, range: 6.0, dice: '9d8', icon: '🔥', color: '#ef4444',
    ops: makeBoltOps('FIRE', '9d8', 6.0, { id: 'BURN', duration: 2, power: 5 })
  }),
  BO_COLD: Object.freeze({
    id: 'BO_COLD', name: '냉기 볼트', desc: '서리의 냉기 볼트를 투사하여 빙결 피해를 입힙니다.',
    type: 'PROJECTILE', element: 'COLD', cooldown: 3, range: 6.0, dice: '6d8', icon: '❄️', color: '#38bdf8',
    ops: makeBoltOps('COLD', '6d8', 6.0, { id: 'SLOW', duration: 2, power: 10 })
  }),
  BO_POIS: Object.freeze({
    id: 'BO_POIS', name: '독침 볼트', desc: '맹독 볼트를 투사하여 지속 중독 피해를 입힙니다.',
    type: 'PROJECTILE', element: 'POISON', cooldown: 3, range: 5.5, dice: '3d8', icon: '🩸', color: '#10b981',
    ops: makeBoltOps('POISON', '3d8', 5.5, { id: 'POISON', duration: 3, power: 6 })
  }),
  BO_NETH: Object.freeze({
    id: 'BO_NETH', name: '황천 볼트', desc: '황천의 사령 볼트를 투사하여 영혼 피해를 입힙니다.',
    type: 'PROJECTILE', element: 'NETHER', cooldown: 3, range: 6.0, dice: '5d5', icon: '☠️', color: '#7c3aed',
    ops: makeBoltOps('NETHER', '5d5', 6.0)
  }),
  BO_WATE: Object.freeze({
    id: 'BO_WATE', name: '수류 볼트', desc: '압축된 수류 볼트를 투사하여 피해를 입힙니다.',
    type: 'PROJECTILE', element: 'WATER', cooldown: 4, range: 6.0, dice: '10d10', icon: '🌊', color: '#0284c7',
    ops: makeBoltOps('WATER', '10d10', 6.0)
  }),
  BO_MANA: Object.freeze({
    id: 'BO_MANA', name: '마나 관통 볼트', desc: '순수한 응축 마나 볼트를 투사하여 방어를 관통합니다.',
    type: 'PROJECTILE', element: 'MANA', cooldown: 4, range: 6.5, dice: '12d8', icon: '✨', color: '#c084fc',
    ops: makeBoltOps('MANA', '12d8', 6.5)
  }),
  BO_PLAS: Object.freeze({
    id: 'BO_PLAS', name: '플라즈마 볼트', desc: '고열 플라즈마 볼트를 투사합니다.',
    type: 'PROJECTILE', element: 'PLASMA', cooldown: 4, range: 6.0, dice: '10d8', icon: '⚡', color: '#f43f5e',
    ops: makeBoltOps('PLASMA', '10d8', 6.0)
  }),
  BO_ICE: Object.freeze({
    id: 'BO_ICE', name: '빙창 볼트', desc: '날카로운 얼음 창을 투사합니다.',
    type: 'PROJECTILE', element: 'COLD', cooldown: 3, range: 6.0, dice: '6d6', icon: '🧊', color: '#bae6fd',
    ops: makeBoltOps('COLD', '6d6', 6.0, { id: 'SLOW', duration: 2, power: 10 })
  }),
  BO_ICEE: Object.freeze({
    id: 'BO_ICEE', name: '빙창 볼트', desc: '날카로운 얼음 창을 투사합니다.',
    type: 'PROJECTILE', element: 'COLD', cooldown: 3, range: 6.0, dice: '6d6', icon: '🧊', color: '#bae6fd',
    ops: makeBoltOps('COLD', '6d6', 6.0, { id: 'SLOW', duration: 2, power: 10 })
  }),
  BO_DARK: Object.freeze({
    id: 'BO_DARK', name: '암흑 볼트', desc: '칠흑의 암흑 볼트를 투사합니다.',
    type: 'PROJECTILE', element: 'DARK', cooldown: 3, range: 6.0, dice: '4d8', icon: '🌑', color: '#334155',
    ops: makeBoltOps('DARK', '4d8', 6.0)
  }),
  BO_LITE: Object.freeze({
    id: 'BO_LITE', name: '광휘 볼트', desc: '성스러운 빛의 볼트를 투사합니다.',
    type: 'PROJECTILE', element: 'LIGHT', cooldown: 3, range: 6.0, dice: '4d8', icon: '☀️', color: '#fde047',
    ops: makeBoltOps('LIGHT', '4d8', 6.0)
  }),
  ARROW_1: Object.freeze({
    id: 'ARROW_1', name: '속사 화살', desc: '원거리 정밀 화살을 쾌속 발사합니다.',
    type: 'PROJECTILE', element: 'PHYSICAL', cooldown: 1, range: 6.0, dice: '1d8', icon: '🏹', color: '#34d399',
    ops: makeBoltOps('PHYSICAL', '1d8', 6.0)
  }),
  ARROW_2: Object.freeze({
    id: 'ARROW_2', name: '2연속 사격', desc: '화살 2발을 연속으로 격발하여 적을 꿰뚫습니다.',
    type: 'PROJECTILE', element: 'PHYSICAL', cooldown: 2, range: 6.5, dice: '2d8', icon: '🏹', color: '#10b981',
    ops: makeBoltOps('PHYSICAL', '2d8', 6.5)
  }),
  ARROW_3: Object.freeze({
    id: 'ARROW_3', name: '3연속 사격', desc: '화살 3발을 맹렬히 쏟아붓습니다.',
    type: 'PROJECTILE', element: 'PHYSICAL', cooldown: 3, range: 7.0, dice: '3d8', icon: '🏹', color: '#059669',
    ops: makeBoltOps('PHYSICAL', '3d8', 7.0)
  }),
  ARROW_4: Object.freeze({
    id: 'ARROW_4', name: '저격 일격 (Snipe)', desc: '치명적인 급소 저격 화살을 발사합니다.',
    type: 'PROJECTILE', element: 'PHYSICAL', cooldown: 4, range: 8.0, dice: '5d8', icon: '🏹', color: '#047857',
    ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '5d8', ignoreACPct: 0.35, target: 'TARGET' }]
  }),
  MISSILE: Object.freeze({
    id: 'MISSILE', name: '마법 미사일', desc: '비전 마법 미사일을 적에게 발사합니다.',
    type: 'PROJECTILE', element: 'MANA', cooldown: 2, range: 6.0, dice: '2d6', icon: '🔮', color: '#a78bfa',
    ops: makeBoltOps('MANA', '2d6', 6.0)
  }),
  ROCKET: Object.freeze({
    id: 'ROCKET', name: '로켓 발사', desc: '파괴적인 화염 로켓을 직격시킵니다.',
    type: 'PROJECTILE', element: 'FIRE', cooldown: 5, range: 7.0, dice: '12d10', icon: '🚀', color: '#f97316',
    ops: [
      { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'FIRE', dice: '12d10', target: 'TARGET' },
      { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', element: 'FIRE', dice: '4d8', radius: 1.5, range: 7.0 }
    ]
  }),

  // --- 23 Summons (S_*) ---
  S_KIN: Object.freeze({
    id: 'S_KIN', name: '동족 지원 소환', desc: '동족 지원군 2마리를 소환합니다.',
    type: 'SUMMON', cooldown: 6, range: 0, icon: '👥', color: '#fb923c',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'KIN' } }]
  }),
  S_CYBER: Object.freeze({
    id: 'S_CYBER', name: '사이버데몬 소환', desc: '강력한 사이버데몬을 소환합니다.',
    type: 'SUMMON', cooldown: 10, range: 0, icon: '🤖', color: '#f43f5e',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'CYBERDEMON' } }]
  }),
  S_MONSTER: Object.freeze({
    id: 'S_MONSTER', name: '몬스터 소환', desc: '임의의 몬스터 1마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '👾', color: '#a855f7',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'MONSTER' } }]
  }),
  S_MONSTERS: Object.freeze({
    id: 'S_MONSTERS', name: '몬스터 군단 소환', desc: '몬스터 군단 4마리를 소환합니다.',
    type: 'SUMMON', cooldown: 8, range: 0, icon: '👾', color: '#a855f7',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 4, summonFilter: { species: 'MONSTER' } }]
  }),
  S_ANT: Object.freeze({
    id: 'S_ANT', name: '거대 개미 떼 소환', desc: '거대 개미 3마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '🐜', color: '#d97706',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 3, summonFilter: { species: 'ANT' } }]
  }),
  S_SPIDER: Object.freeze({
    id: 'S_SPIDER', name: '독거미 무리 소환', desc: '독거미 3마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '🕷️', color: '#059669',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 3, summonFilter: { species: 'SPIDER' } }]
  }),
  S_HOUND: Object.freeze({
    id: 'S_HOUND', name: '사냥개 무리 소환', desc: '사냥개 3마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '🐕', color: '#b45309',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 3, summonFilter: { species: 'HOUND' } }]
  }),
  S_HYDRA: Object.freeze({
    id: 'S_HYDRA', name: '히드라 소환', desc: '다두 히드라를 소환합니다.',
    type: 'SUMMON', cooldown: 6, range: 0, icon: '🐉', color: '#16a34a',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'HYDRA' } }]
  }),
  S_ANGEL: Object.freeze({
    id: 'S_ANGEL', name: '천사 군단 소환', desc: '신성한 천사 2명을 소환합니다.',
    type: 'SUMMON', cooldown: 8, range: 0, icon: '👼', color: '#fef08a',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'ANGEL' } }]
  }),
  S_DEMON: Object.freeze({
    id: 'S_DEMON', name: '하급 악마 소환', desc: '지옥의 악마 2마리를 소환합니다.',
    type: 'SUMMON', cooldown: 6, range: 0, icon: '😈', color: '#ef4444',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'DEMON' } }]
  }),
  S_UNDEAD: Object.freeze({
    id: 'S_UNDEAD', name: '언데드 군단 소환', desc: '불사의 언데드 3구를 소환합니다.',
    type: 'SUMMON', cooldown: 6, range: 0, icon: '💀', color: '#7c3aed',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 3, summonFilter: { species: 'UNDEAD' } }]
  }),
  S_DRAGON: Object.freeze({
    id: 'S_DRAGON', name: '드래곤 소환', desc: '강력한 드래곤 1마리를 소환합니다.',
    type: 'SUMMON', cooldown: 8, range: 0, icon: '🐲', color: '#ea580c',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'DRAGON' } }]
  }),
  S_HI_UNDEAD: Object.freeze({
    id: 'S_HI_UNDEAD', name: '상급 고대 언데드 소환', desc: '고대 리치/망령 2구를 소환합니다.',
    type: 'SUMMON', cooldown: 9, range: 0, icon: '☠️', color: '#581c87',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'HI_UNDEAD' } }]
  }),
  S_HI_DRAGON: Object.freeze({
    id: 'S_HI_DRAGON', name: '고대 고룡 소환', desc: '고대 드래곤 2마리를 소환합니다.',
    type: 'SUMMON', cooldown: 10, range: 0, icon: '🐉', color: '#c2410c',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'HI_DRAGON' } }]
  }),
  S_HI_DEMON: Object.freeze({
    id: 'S_HI_DEMON', name: '대악마 군주 소환', desc: '상급 악마 군주 2마리를 소환합니다.',
    type: 'SUMMON', cooldown: 10, range: 0, icon: '👿', color: '#991b1b',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'HI_DEMON' } }]
  }),
  S_WRAITH: Object.freeze({
    id: 'S_WRAITH', name: '흑색 영체 소환', desc: '암흑 영체 2구를 소환합니다.',
    type: 'SUMMON', cooldown: 9, range: 0, icon: '👻', color: '#334155',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: { species: 'WRAITH' } }]
  }),
  S_UNIQUE: Object.freeze({
    id: 'S_UNIQUE', name: '유니크 네임드 소환', desc: '전설의 유니크 몬스터 1마리를 소환합니다.',
    type: 'SUMMON', cooldown: 15, range: 0, icon: '👑', color: '#ffd700',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'UNIQUE' } }]
  }),
  S_ANIMAL: Object.freeze({
    id: 'S_ANIMAL', name: '야수 소환', desc: '사나운 야수 1마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '🐾', color: '#b45309',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'ANIMAL' } }]
  }),
  S_ANIMALS: Object.freeze({
    id: 'S_ANIMALS', name: '야수 무리 소환', desc: '사나운 야수 무리 3마리를 소환합니다.',
    type: 'SUMMON', cooldown: 6, range: 0, icon: '🐾', color: '#b45309',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 3, summonFilter: { species: 'ANIMAL' } }]
  }),
  S_THUNDERLORD: Object.freeze({
    id: 'S_THUNDERLORD', name: '썬더로드 소환', desc: '뇌신 썬더로드를 소환합니다.',
    type: 'SUMMON', cooldown: 10, range: 0, icon: '⚡', color: '#eab308',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'THUNDERLORD' } }]
  }),
  S_BUG: Object.freeze({
    id: 'S_BUG', name: '벌레 떼 소환', desc: '괴물 벌레 무리 3마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '🪲', color: '#65a30d',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 3, summonFilter: { species: 'BUG' } }]
  }),
  S_RNG: Object.freeze({
    id: 'S_RNG', name: '무작위 몬스터 소환', desc: '무작위 몬스터 1마리를 소환합니다.',
    type: 'SUMMON', cooldown: 5, range: 0, icon: '🎲', color: '#a855f7',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'MONSTER' } }]
  }),
  MULTIPLY: Object.freeze({
    id: 'MULTIPLY', name: '세포 증식', desc: '자신의 세포를 분열 증식하여 복제체를 소환합니다.',
    type: 'SUMMON', cooldown: 4, range: 0, icon: '🦠', color: '#10b981',
    ops: [{ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 1, summonFilter: { species: 'KIN' } }]
  }),

  // --- Utility, Curses, Controls (16+) ---
  BLINK: Object.freeze({
    id: 'BLINK', name: '위상 점멸 (Phase Door)', desc: '단거리 시공간을 왜곡하여 안전한 곳으로 점멸합니다.',
    type: 'TELEPORT', element: 'MANA', cooldown: 4, range: 4.0, icon: '💨', color: '#c084fc',
    ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: 4, target: 'SELF' }]
  }),
  TPORT: Object.freeze({
    id: 'TPORT', name: '공간 도약 (Teleport)', desc: '위기 상황에서 장거리 공간으로 즉시 도약합니다.',
    type: 'TELEPORT', element: 'MANA', cooldown: 6, range: 25.0, icon: '🌀', color: '#a855f7',
    ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'TELEPORT', dist: 25, target: 'SELF' }]
  }),
  TELE_TO: Object.freeze({
    id: 'TELE_TO', name: '목표물 강제 인양', desc: '적을 자신의 바로 앞으로 강제 순간이동시킵니다.',
    type: 'UTILITY', element: 'MANA', cooldown: 5, range: 7.0, icon: '🧲', color: '#a855f7',
    ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'PULL_TO', target: 'TARGET' }]
  }),
  TELE_AWAY: Object.freeze({
    id: 'TELE_AWAY', name: '적 추방 텔레포트', desc: '위험한 적을 던전 저 멀리로 강제 추방합니다.',
    type: 'UTILITY', element: 'MANA', cooldown: 5, range: 6.0, icon: '💨', color: '#38bdf8',
    ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'PUSH_AWAY', dist: 15, target: 'TARGET' }]
  }),
  TELE_LEVEL: Object.freeze({
    id: 'TELE_LEVEL', name: '차원 추방 텔레포트', desc: '적을 다른 차원으로 추방합니다.',
    type: 'UTILITY', element: 'MANA', cooldown: 10, range: 6.0, icon: '🌀', color: '#8b5cf6',
    ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'TELE_LEVEL', target: 'TARGET' }]
  }),
  HASTE: Object.freeze({
    id: 'HASTE', name: '신속 가속 (Haste)', desc: '자신의 에너지를 가속하여 15턴간 이동/행동 속도를 대폭 증폭합니다.',
    type: 'BUFF', element: 'PHYSICAL', cooldown: 6, range: 0, icon: '⚡', color: '#fbbf24',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 15, target: 'SELF' }]
  }),
  HEAL: Object.freeze({
    id: 'HEAL', name: '상처 치유 (Heal)', desc: '신성한 생명력을 체내에 주입하여 대량의 체력을 회복합니다.',
    type: 'SELF', element: 'HOLY', cooldown: 5, range: 0, dice: '10d10', icon: '💚', color: '#34d399',
    ops: [{ op: EFFECT_OP_TYPES.HEAL_ENTITY, dice: '10d10', target: 'SELF' }]
  }),
  INVULNER: Object.freeze({
    id: 'INVULNER', name: '무적 결계 (Invulnerability)', desc: '신성한 방호 결계를 전개하여 모든 피해를 흡수합니다.',
    type: 'BUFF', element: 'HOLY', cooldown: 12, range: 0, icon: '🛡️', color: '#fef08a',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'INVULN', duration: 3, target: 'SELF' }]
  }),
  HOLD: Object.freeze({
    id: 'HOLD', name: '마비 구속', desc: '강력한 마력 사슬로 대상을 묶어 마비시킵니다.',
    type: 'DEBUFF', element: 'MANA', cooldown: 5, range: 5.0, icon: '⛓️', color: '#3b82f6',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PARALYZE', duration: 3, chance: 0.85, target: 'TARGET' }]
  }),
  SLOW: Object.freeze({
    id: 'SLOW', name: '감속 결계', desc: '대상의 이동과 행동을 무겁게 둔화시킵니다.',
    type: 'DEBUFF', element: 'COLD', cooldown: 4, range: 5.5, icon: '🐌', color: '#94a3b8',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 5, power: 10, chance: 0.90, target: 'TARGET' }]
  }),
  CONF: Object.freeze({
    id: 'CONF', name: '혼란의 주문', desc: '대상의 정신을 뒤흔들어 깊은 혼란에 빠뜨립니다.',
    type: 'DEBUFF', element: 'MANA', cooldown: 4, range: 5.5, icon: '🌀', color: '#c084fc',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 5, chance: 0.85, target: 'TARGET' }]
  }),
  SCARE: Object.freeze({
    id: 'SCARE', name: '공포의 포효', desc: '소름끼치는 포효로 대상을 공포에 질려 달아나게 만듭니다.',
    type: 'DEBUFF', element: 'DARK', cooldown: 4, range: 5.5, icon: '😱', color: '#eab308',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 5, chance: 0.85, target: 'TARGET' }]
  }),
  BLIND: Object.freeze({
    id: 'BLIND', name: '실명 유발', desc: '대상의 시야를 칠흑 같은 암흑으로 가립니다.',
    type: 'DEBUFF', element: 'DARK', cooldown: 4, range: 5.5, icon: '👁️', color: '#64748b',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLIND', duration: 5, chance: 0.85, target: 'TARGET' }]
  }),
  FORGET: Object.freeze({
    id: 'FORGET', name: '기억 상실 (Amnesia)', desc: '대상의 기억을 지워 방향 감각을 상실하게 만듭니다.',
    type: 'DEBUFF', element: 'MANA', cooldown: 6, range: 5.0, icon: '❓', color: '#94a3b8',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 4, chance: 0.80, target: 'TARGET' }]
  }),
  DARKNESS: Object.freeze({
    id: 'DARKNESS', name: '심연의 어둠 소환', desc: '주변 타일을 칠흑의 어둠으로 뒤덮습니다.',
    type: 'UTILITY', element: 'DARK', cooldown: 4, range: 0, icon: '🌑', color: '#1e293b',
    ops: [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DARKNESS', radius: 4 }]
  }),
  TRAPS: Object.freeze({
    id: 'TRAPS', name: '함정 소환/해체', desc: '주변의 함정과 문을 조작합니다.',
    type: 'UTILITY', element: 'MANA', cooldown: 6, range: 0, icon: '🕸️', color: '#78716c',
    ops: [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DESTROY_DOORS_TRAPS' }]
  }),
  SHRIEK: Object.freeze({
    id: 'SHRIEK', name: '전율의 비명', desc: '던전 전체를 뒤흔드는 비명으로 주변 적들에게 공포를 일으킵니다.',
    type: 'AOE', element: 'SOUND', cooldown: 3, range: 0, icon: '📢', color: '#f59e0b',
    ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 3 }] }]
  }),
  WORLD: Object.freeze({
    id: 'WORLD', name: '시간 정지 (The World)', desc: '시간의 흐름을 멈추고 자신만을 가속합니다.',
    type: 'BUFF', element: 'TIME', cooldown: 12, range: 0, icon: '⏳', color: '#eab308',
    ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 10, target: 'SELF' }]
  }),
  HAND_DOOM: Object.freeze({
    id: 'HAND_DOOM', name: '파멸의 손길', desc: '대상의 생명력을 즉시 40% 분쇄하는 사령의 손길입니다.',
    type: 'PROJECTILE', element: 'DARK', cooldown: 8, range: 6.0, dice: '10d15', icon: '🖐️', color: '#000000',
    ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'DARK', dice: '10d15', mult: 2.0, target: 'TARGET' }]
  }),
  BRAIN_SMASH: Object.freeze({
    id: 'BRAIN_SMASH', name: '뇌수 파쇄 (Brain Smash)', desc: '뇌를 직접 강타하여 치명적인 마나 피해와 기절/혼란을 안깁니다.',
    type: 'PROJECTILE', element: 'MANA', cooldown: 5, range: 6.0, dice: '12d12', icon: '🧠', color: '#e11d48',
    ops: [
      { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MANA', dice: '12d12', target: 'TARGET' },
      { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 4, target: 'TARGET' },
      { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 2, power: 8, target: 'TARGET' }
    ]
  }),
  MIND_BLAST: Object.freeze({
    id: 'MIND_BLAST', name: '정신 폭격 (Mind Blast)', desc: '정신 파동으로 뇌를 흔들어 피해를 입히고 혼란을 겁니다.',
    type: 'PROJECTILE', element: 'MANA', cooldown: 4, range: 6.0, dice: '8d8', icon: '🧠', color: '#f43f5e',
    ops: [
      { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MANA', dice: '8d8', target: 'TARGET' },
      { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 3, target: 'TARGET' }
    ]
  }),
  CAUSE_1: Object.freeze({
    id: 'CAUSE_1', name: '경상 저주', desc: '체내 혈관을 터뜨리는 경미한 저주입니다.',
    type: 'PROJECTILE', element: 'DARK', cooldown: 2, range: 5.5, dice: '3d8', icon: '🩸', color: '#ef4444',
    ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'DARK', dice: '3d8', target: 'TARGET' }]
  }),
  CAUSE_2: Object.freeze({
    id: 'CAUSE_2', name: '중상 저주', desc: '살점을 찢는 강력한 저주입니다.',
    type: 'PROJECTILE', element: 'DARK', cooldown: 3, range: 5.5, dice: '8d8', icon: '🩸', color: '#dc2626',
    ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'DARK', dice: '8d8', target: 'TARGET' }]
  }),
  CAUSE_3: Object.freeze({
    id: 'CAUSE_3', name: '치명상 저주', desc: '뼈와 살을 붕괴시키는 파멸의 저주입니다.',
    type: 'PROJECTILE', element: 'DARK', cooldown: 4, range: 6.0, dice: '10d10', icon: '🩸', color: '#b91c1c',
    ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'DARK', dice: '10d10', target: 'TARGET' }]
  }),
  CAUSE_4: Object.freeze({
    id: 'CAUSE_4', name: '필살의 사령 저주', desc: '즉사에 준하는 극대 파멸 피해를 가합니다.',
    type: 'PROJECTILE', element: 'DARK', cooldown: 6, range: 6.5, dice: '15d12', icon: '🩸', color: '#7f1d1d',
    ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'DARK', dice: '15d12', target: 'TARGET' }]
  }),
  DRAIN_MANA: Object.freeze({
    id: 'DRAIN_MANA', name: '마나 흡수', desc: '적의 마력을 강탈하여 자신의 마나를 회복합니다.',
    type: 'DEBUFF', element: 'MANA', cooldown: 4, range: 5.5, dice: '4d8', icon: '🔮', color: '#a855f7',
    ops: [
      { op: EFFECT_OP_TYPES.DRAIN_VITAL, type: 'MANA', amount: 20, target: 'TARGET' },
      { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MANA', dice: '4d8', target: 'TARGET' }
    ]
  }),
  DISPEL: Object.freeze({
    id: 'DISPEL', name: '마법 해제', desc: '대상의 모든 마법적 버프를 정화하고 해제합니다.',
    type: 'UTILITY', element: 'MANA', cooldown: 5, range: 6.0, icon: '✨', color: '#38bdf8',
    ops: [{ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['HASTE', 'HEROISM', 'SHIELD', 'INVULN'], target: 'TARGET' }]
  })
});

// =========================================================================
// 4. ARCHETYPE_FLAG_TACTICS (61 char Symbols x 124 flags Tactical Generators)
// =========================================================================
export const ARCHETYPE_FLAG_TACTICS = Object.freeze({
  // Flag-driven tactical skills
  FLAGS: Object.freeze({
    AURA_FIRE: {
      id: 'TAC_AURA_FIRE',
      name: '화염 오라 방출',
      desc: '신체 주변에 작열하는 화염 오라를 폭발시킵니다.',
      type: 'AOE',
      element: 'FIRE',
      cooldown: 5,
      range: 2.5,
      dice: '4d8',
      icon: '🔥',
      color: '#ef4444',
      ops: [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'FIRE', dice: '4d8', radius: 2.5 },
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BURN', duration: 3, target: 'SELF' }
      ]
    },
    AURA_COLD: {
      id: 'TAC_AURA_COLD',
      name: '서리 오라 방출',
      desc: '신체 주변에 절대영도의 서리 냉기를 방출합니다.',
      type: 'AOE',
      element: 'COLD',
      cooldown: 5,
      range: 2.5,
      dice: '4d8',
      icon: '❄️',
      color: '#38bdf8',
      ops: [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'COLD', dice: '4d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 3, power: 10 }] }
      ]
    },
    AURA_ELEC: {
      id: 'TAC_AURA_ELEC',
      name: '뇌전 방전',
      desc: '주변 타일에 고압 전기를 방전하여 감전시킵니다.',
      type: 'AOE',
      element: 'LIGHTNING',
      cooldown: 5,
      range: 2.5,
      dice: '4d8',
      icon: '⚡',
      color: '#eab308',
      ops: [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'LIGHTNING', dice: '4d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 2, power: 5 }] }
      ]
    },
    PASS_WALL: {
      id: 'TAC_WRAITH_STEP',
      name: '위상 관통 (Wraith Step)',
      desc: '물질계를 일시적으로 이탈하여 벽을 통과해 안전 지대로 점멸합니다.',
      type: 'TELEPORT',
      element: 'DARK',
      cooldown: 4,
      range: 4.5,
      icon: '👻',
      color: '#6366f1',
      ops: [
        { op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: 4, target: 'SELF' }
      ]
    },
    KILL_WALL: {
      id: 'TAC_WALL_CRUSHER',
      name: '암벽 분쇄 파동',
      desc: '주변 지형을 박살내는 진동파를 일으킵니다.',
      type: 'AOE',
      element: 'SHARDS',
      cooldown: 6,
      range: 2.5,
      dice: '6d8',
      icon: '🔨',
      color: '#a8a29e',
      ops: [
        { op: EFFECT_OP_TYPES.ALTER_MAP, action: 'EARTHQUAKE', radius: 2 },
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'SHARDS', dice: '6d8', radius: 2.5 }
      ]
    },
    INVISIBLE: {
      id: 'TAC_SHADOW_AMBUSH',
      name: '그림자 은신 기습',
      desc: '어둠 속에 모습을 감추고 급습을 준비합니다.',
      type: 'SELF',
      element: 'DARK',
      cooldown: 5,
      range: 0,
      icon: '👥',
      color: '#475569',
      ops: [
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 4, target: 'SELF' }
      ]
    },
    REFLECTING: {
      id: 'TAC_MIRROR_CARAPACE',
      name: '거울 등딱지 방호',
      desc: '마법 투사체를 반사하는 반사막을 전개합니다.',
      type: 'BUFF',
      element: 'MANA',
      cooldown: 8,
      range: 0,
      icon: '🛡️',
      color: '#67e8f9',
      ops: [
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 5, power: 15, target: 'SELF' }
      ]
    },
    REGENERATE: {
      id: 'TAC_FERAL_MEND',
      name: '야성의 재생 (Feral Mend)',
      desc: '세포를 급속 활성화하여 결손된 체력을 회복합니다.',
      type: 'SELF',
      element: 'HOLY',
      cooldown: 5,
      range: 0,
      dice: '4d8',
      icon: '🌿',
      color: '#10b981',
      ops: [
        { op: EFFECT_OP_TYPES.HEAL_ENTITY, dice: '4d8', target: 'SELF' }
      ]
    },
    CAN_FLY: {
      id: 'TAC_AERIAL_SWOOP',
      name: '공중 급강하 강타',
      desc: '상공으로 비상한 후 적에게 고속 급강하 타격을 가합니다.',
      type: 'MELEE_STRIKE',
      element: 'PHYSICAL',
      cooldown: 3,
      range: 3.5,
      dice: '3d8',
      icon: '🦅',
      color: '#38bdf8',
      ops: [
        { op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '3d8', mult: 1.35, target: 'TARGET' }
      ]
    },
    FRIENDS: {
      id: 'TAC_PACK_HOWL',
      name: '무리 결집의 포효',
      desc: '동료들을 고무시키는 포효를 내질러 투기를 북돋웁니다.',
      type: 'BUFF',
      element: 'PHYSICAL',
      cooldown: 6,
      range: 0,
      icon: '🐺',
      color: '#ea580c',
      ops: [
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HEROISM', duration: 6, power: 10, target: 'SELF' }
      ]
    },
    ANIMAL: {
      id: 'TAC_FERAL_LUNGE',
      name: '야수의 덮치기',
      desc: '야성의 본능으로 적에게 도약하여 덮칩니다.',
      type: 'MELEE_STRIKE',
      element: 'PHYSICAL',
      cooldown: 3,
      range: 3.0,
      dice: '2d8',
      icon: '🐾',
      color: '#b45309',
      ops: [
        { op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d8', mult: 1.25, target: 'TARGET' }
      ]
    },
    UNDEAD: {
      id: 'TAC_SOUL_SIPHON',
      name: '원혼 착취',
      desc: '적의 생명력을 흡수하여 자신의 상처를 치유합니다.',
      type: 'PROJECTILE',
      element: 'NETHER',
      cooldown: 4,
      range: 4.5,
      dice: '3d8',
      icon: '💀',
      color: '#7c3aed',
      ops: [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'NETHER', dice: '3d8', lifestealPct: 0.45, target: 'TARGET' }
      ]
    },
    DEMON: {
      id: 'TAC_HELLFIRE_LASH',
      name: '지옥불 채찍',
      desc: '지옥의 화염 채찍을 휘둘러 화염 피해와 화상을 입힙니다.',
      type: 'PROJECTILE',
      element: 'FIRE',
      cooldown: 4,
      range: 4.0,
      dice: '4d8',
      icon: '😈',
      color: '#ef4444',
      ops: [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'FIRE', dice: '4d8', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BURN', duration: 3, target: 'TARGET' }
      ]
    },
    DRAGON: {
      id: 'TAC_DRAGON_ROAR',
      name: '용의 위압 포효',
      desc: '용황의 위압으로 주변 적들에게 극심한 공포를 선사합니다.',
      type: 'AOE',
      element: 'DARK',
      cooldown: 5,
      range: 0,
      icon: '🐉',
      color: '#f97316',
      ops: [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 4, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 4 }] }
      ]
    },
    GIANT: {
      id: 'TAC_TITAN_SLAM',
      name: '거인의 대지 강타',
      desc: '지면을 발로 굴러 진동파를 일으켜 적들을 기절시킵니다.',
      type: 'AOE',
      element: 'PHYSICAL',
      cooldown: 5,
      range: 2.5,
      dice: '5d8',
      icon: '👣',
      color: '#78716c',
      ops: [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'PHYSICAL', dice: '5d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 2, power: 8 }] }
      ]
    },
    ORC: {
      id: 'TAC_ORC_BULL_RUSH',
      name: '오크 저돌 돌격',
      desc: '거친 기세로 돌진하여 적을 들이받고 밀쳐냅니다.',
      type: 'MELEE_STRIKE',
      element: 'PHYSICAL',
      cooldown: 3,
      range: 3.5,
      dice: '3d6',
      icon: '🐗',
      color: '#15803d',
      ops: [
        { op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '3d6', mult: 1.30, target: 'TARGET' }
      ]
    },
    TROLL: {
      id: 'TAC_TROLL_BOULDER',
      name: '바위 투척',
      desc: '거대한 바위를 집어던져 원거리 타격을 가합니다.',
      type: 'PROJECTILE',
      element: 'PHYSICAL',
      cooldown: 4,
      range: 5.5,
      dice: '4d8',
      icon: '🪨',
      color: '#854d0e',
      ops: [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '4d8', target: 'TARGET' }
      ]
    },
    EVIL: {
      id: 'TAC_DREAD_GLARE',
      name: '사악한 시선',
      desc: '적의 영혼을 얼어붙게 하는 사악한 저주를 겁니다.',
      type: 'PROJECTILE',
      element: 'DARK',
      cooldown: 4,
      range: 5.0,
      icon: '👁️',
      color: '#4c1d95',
      ops: [
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'WEAKEN', duration: 4, target: 'TARGET' }
      ]
    },
    SMART: {
      id: 'TAC_TACTICAL_FEINT',
      name: '지능적 교란',
      desc: '교묘한 페인트 동작으로 적의 방어를 무너뜨립니다.',
      type: 'PROJECTILE',
      element: 'PHYSICAL',
      cooldown: 4,
      range: 4.0,
      icon: '🧠',
      color: '#0284c7',
      ops: [
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SUNDER', duration: 4, power: 10, target: 'TARGET' }
      ]
    }
  }),

  // Char-driven tactical skills for monsters without enough spells/flags
  CHARS: Object.freeze({
    // Dragons
    d: { id: 'TAC_WYRM_BUFFET', name: '용의 날갯짓 폭풍', desc: '날개를 펄럭여 돌풍을 일으켜 적을 밀쳐냅니다.', type: 'AOE', element: 'FORCE', cooldown: 4, range: 2.5, dice: '3d8', icon: '💨', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'FORCE', dice: '3d8', radius: 2.5 }] },
    D: { id: 'TAC_ANCIENT_WYRM_AWE', name: '고룡의 압도적 기백', desc: '고룡의 위엄으로 주변 적들을 공포에 떨게 합니다.', type: 'AOE', element: 'DARK', cooldown: 5, range: 0, icon: '🐲', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 4.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 4 }] }] },
    
    // Orcs, Ogres, Trolls, Giants
    o: { id: 'TAC_ORC_WAR_STOMP', name: '전투 발구르기', desc: '바닥을 굴러 충격파를 발생시킵니다.', type: 'AOE', element: 'PHYSICAL', cooldown: 3, range: 2.0, dice: '2d6', icon: '🦶', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'PHYSICAL', dice: '2d6', radius: 2.0 }] },
    O: { id: 'TAC_OGRE_CLUB_SWING', name: '오우거 몽둥이 횡천', desc: '거대한 둔기를 휘둘러 전방을 쓸어버립니다.', type: 'AOE', element: 'PHYSICAL', cooldown: 4, range: 2.5, dice: '3d8', icon: '🏏', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'PHYSICAL', dice: '3d8', radius: 2.0 }] },
    T: { id: 'TAC_TROLL_CRUSH', name: '트롤 육탄 압쇄', desc: '거구로 짓눌러 적에게 중상을 입힙니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 1.5, dice: '3d8', icon: '🧌', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '3d8', mult: 1.30, target: 'TARGET' }] },
    P: { id: 'TAC_GIANT_STOMP', name: '거인의 짓밟기', desc: '엄청난 완력으로 지면을 강타합니다.', type: 'AOE', element: 'PHYSICAL', cooldown: 4, range: 2.5, dice: '4d8', icon: '👣', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'PHYSICAL', dice: '4d8', radius: 2.5 }] },

    // Spiders, Insects, Ants, Centipedes
    S: { id: 'TAC_WEB_TRAP', name: '거미줄 투척 결계', desc: '끈적한 거미줄을 투사하여 이동 속도를 늦춥니다.', type: 'PROJECTILE', element: 'POISON', cooldown: 4, range: 5.0, icon: '🕸️', ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 4, power: 10, target: 'TARGET' }] },
    I: { id: 'TAC_INSECT_SWARM', name: '벌레 무리 기습', desc: '날카로운 날갯짓으로 급습합니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 2.5, dice: '2d6', icon: '🪰', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.20, target: 'TARGET' }] },
    a: { id: 'TAC_ANT_MANDIBLE', name: '거대 턱 물어뜯기', desc: '단단한 큰 턱으로 적을 꽉 뭅니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 1.5, dice: '2d8', icon: '🐜', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d8', mult: 1.25, target: 'TARGET' }] },
    c: { id: 'TAC_CENTIPEDE_POISON', name: '지네 맹독 분사', desc: '부식성 독액을 전방에 뿌립니다.', type: 'PROJECTILE', element: 'POISON', cooldown: 3, range: 4.0, dice: '2d6', icon: '🐛', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'POISON', dice: '2d6', target: 'TARGET' }, { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'POISON', duration: 3, target: 'TARGET' }] },

    // Bats, Hounds, Quadrupeds, Felines
    B: { id: 'TAC_BAT_SONIC_SCREECH', name: '초음파 초저주파 비명', desc: '방향 감각을 잃게 하는 초음파를 발산합니다.', type: 'AOE', element: 'SOUND', cooldown: 4, range: 0, icon: '🦇', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 3.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 3 }] }] },
    H: { id: 'TAC_HOUND_SNARL', name: '사냥개의 위협 으르렁', desc: '적을 위협하여 공포에 질리게 합니다.', type: 'DEBUFF', element: 'PHYSICAL', cooldown: 4, range: 3.5, icon: '🐕', ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 3, target: 'TARGET' }] },
    C: { id: 'TAC_CANINE_RUSH', name: '사냥개의 맹렬한 도약', desc: '적에게 맹렬히 도약하여 물어뜯습니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 3.5, dice: '2d8', icon: '🐺', ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', target: 'TARGET' }, { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d8', mult: 1.25, target: 'TARGET' }] },
    q: { id: 'TAC_BEAST_POUNCE', name: '야수의 기습 덮치기', desc: '전방으로 도약해 덮칩니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 3.0, dice: '2d8', icon: '🐾', ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', target: 'TARGET' }, { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d8', target: 'TARGET' }] },
    f: { id: 'TAC_FELINE_AGILITY', name: '고양이과 유연 도약', desc: '재빠르게 위치를 바꾸며 적을 할큅니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 2.5, dice: '2d6', icon: '🐱', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.20, target: 'TARGET' }] },

    // Undead, Spirits, Liches, Vampires
    L: { id: 'TAC_LICH_BONE_ARMOR', name: '사령 뼈 갑옷 전개', desc: '해골 뼈 방호벽을 둘러 방어력을 올립니다.', type: 'BUFF', element: 'DARK', cooldown: 7, range: 0, icon: '💀', ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 5, power: 15, target: 'SELF' }] },
    V: { id: 'TAC_VAMP_BAT_FORM', name: '흡혈귀 박쥐 변신 점멸', desc: '박쥐 떼로 흩어져 다른 위치로 점멸합니다.', type: 'TELEPORT', element: 'DARK', cooldown: 5, range: 4.5, icon: '🦇', ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: 4, target: 'SELF' }] },
    W: { id: 'TAC_WRAITH_CHILL', name: '망령의 냉기 장막', desc: '주변을 극저온의 냉기 장막으로 감쌉니다.', type: 'AOE', element: 'COLD', cooldown: 5, range: 2.5, dice: '3d8', icon: '👻', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'COLD', dice: '3d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 3 }] }] },
    G: { id: 'TAC_GHOST_TERROR', name: '원혼의 비명', desc: '공포스러운 비명으로 적들을 달아나게 합니다.', type: 'AOE', element: 'DARK', cooldown: 4, range: 0, icon: '👻', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 3.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 3 }] }] },
    z: { id: 'TAC_ZOMBIE_PLAGUE', name: '좀비 부패 역병', desc: '부패한 역병을 퍼뜨려 중독시킵니다.', type: 'PROJECTILE', element: 'POISON', cooldown: 3, range: 4.0, dice: '2d6', icon: '🧟', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'POISON', dice: '2d6', target: 'TARGET' }, { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'POISON', duration: 4, target: 'TARGET' }] },
    s: { id: 'TAC_SKELETON_SPEAR', name: '골편 투척', desc: '자신의 뼈 조각을 날카롭게 투척합니다.', type: 'PROJECTILE', element: 'PHYSICAL', cooldown: 3, range: 5.0, dice: '2d6', icon: '🦴', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', target: 'TARGET' }] },

    // Oozes, Molds, Jellies, Mushrooms
    j: { id: 'TAC_OOZE_ACID_SPLASH', name: '산성 젤리 분출', desc: '몸체 일부를 떼어내 산성 용액을 뿜어냅니다.', type: 'PROJECTILE', element: 'ACID', cooldown: 3, range: 4.5, dice: '3d6', icon: '🟢', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'ACID', dice: '3d6', target: 'TARGET' }] },
    m: { id: 'TAC_MOLD_SPORE_CLOUD', name: '포자 구름 방출', desc: '주변에 맹독성 포자 가스를 퍼뜨립니다.', type: 'AOE', element: 'POISON', cooldown: 4, range: 2.5, dice: '2d6', icon: '🍄', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'POISON', dice: '2d6', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'POISON', duration: 3 }] }] },
    ',': { id: 'TAC_MUSHROOM_CONFUSE', name: '환각 버섯 포자', desc: '환각을 일으키는 버섯 포자를 흩뿌립니다.', type: 'AOE', element: 'CONFUSION', cooldown: 4, range: 2.5, dice: '1d6', icon: '🍄', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'CONFUSION', dice: '1d6', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 3 }] }] },

    // Eyes, Yeeks
    e: { id: 'TAC_EYE_PSYCHIC_RAY', name: '마안 정신 광선', desc: '눈에서 정신을 혼란시키는 광선을 발사합니다.', type: 'PROJECTILE', element: 'MANA', cooldown: 3, range: 5.5, dice: '3d6', icon: '👁️', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MANA', dice: '3d6', target: 'TARGET' }, { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 3, target: 'TARGET' }] },
    y: { id: 'TAC_YEEK_SCREAM', name: '이크의 고음 절규', desc: '당황하여 내지르는 고음 비명으로 적을 교란합니다.', type: 'AOE', element: 'SOUND', cooldown: 4, range: 0, icon: '📢', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 3.0, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 2 }] }] },

    // Humanoids, Kobolds, Hobbits
    p: { id: 'TAC_HUMANOID_DIRTY_KICK', name: '급소 발차기', desc: '적의 급소를 기습 발차기하여 주춤하게 만듭니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 1.5, dice: '2d6', icon: '🦶', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.25, target: 'TARGET' }, { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 1, power: 4, target: 'TARGET' }] },
    h: { id: 'TAC_HOBBIT_SLING_STONE', name: '투석구 돌팔매', desc: '돌멩이를 정확히 던져 적을 견제합니다.', type: 'PROJECTILE', element: 'PHYSICAL', cooldown: 2, range: 5.5, dice: '2d4', icon: '🪨', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d4', target: 'TARGET' }] },
    k: { id: 'TAC_KOBOLD_POISON_DART', name: '코볼트 독침 다트', desc: '독을 바른 투척 다트를 던집니다.', type: 'PROJECTILE', element: 'POISON', cooldown: 3, range: 5.0, dice: '1d6', icon: '🎯', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'POISON', dice: '1d6', target: 'TARGET' }, { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'POISON', duration: 3, target: 'TARGET' }] },

    // Elementals, Vortices
    E: { id: 'TAC_ELEMENTAL_SURGE', name: '원소 에너지 폭주', desc: '신체 원소 에너지를 폭발시켜 주변을 강타합니다.', type: 'AOE', element: 'MANA', cooldown: 4, range: 2.5, dice: '4d8', icon: '⚡', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'MANA', dice: '4d8', radius: 2.5 }] },
    v: { id: 'TAC_VORTEX_CYCLONE', name: '소용돌이 돌풍', desc: '자신을 중심으로 강력한 회오리바람을 일으킵니다.', type: 'AOE', element: 'FORCE', cooldown: 4, range: 2.5, dice: '3d8', icon: '🌪️', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'FORCE', dice: '3d8', radius: 2.5 }] },
    Z: { id: 'TAC_HOUND_BREATH_BURST', name: '하운드 속성 숨결', desc: '전방에 속성 숨결을 짧게 내뿜습니다.', type: 'BREATH', element: 'PHYSICAL', cooldown: 4, range: 4.5, dice: '3d8', icon: '🐕', ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'CONE', element: 'PHYSICAL', dice: '3d8', range: 4.5 }] },

    // Snakes, Worms
    J: { id: 'TAC_SNAKE_CONSTRICT', name: '뱀의 전신 휘감기', desc: '적의 전신을 휘감아 마비시킵니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 4, range: 1.5, dice: '2d8', icon: '🐍', ops: [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d8', mult: 1.25, target: 'TARGET' }, { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PARALYZE', duration: 2, target: 'TARGET' }] },
    w: { id: 'TAC_WORM_BURROW_CHARGE', name: '벌레 땅굴 돌진', desc: '땅속을 파고들어 적 앞으로 솟구쳐 들이받습니다.', type: 'MELEE_STRIKE', element: 'PHYSICAL', cooldown: 3, range: 3.5, dice: '2d6', icon: '🪱', ops: [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', target: 'TARGET' }, { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.20, target: 'TARGET' }] }
  })
});
