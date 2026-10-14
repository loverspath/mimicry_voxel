/**
 * @module EffectOpSchema
 * @category configs
 * @description Argon 표준 12대 EffectOp 정형 스키마 및 유효성 검증 카탈로그.
 *              스킬, 몬스터 주문, 물약/스크롤, 완드/스태프/로드, 유물 발동의 공통 효과 연산자 규격.
 * @purity Pure Data / Schema Definition
 * @exports EFFECT_OP_TYPES, PROJECT_AREA_SHAPES, DISPLACE_MODES, ALTER_MAP_ACTIONS,
 *          MUTATE_INVENTORY_ACTIONS, DRAIN_VITAL_TYPES, TARGET_TYPES, validateEffectOp
 */

export const EFFECT_OP_TYPES = Object.freeze({
  DEAL_DAMAGE: 'DEAL_DAMAGE',
  PROJECT_AREA: 'PROJECT_AREA',
  APPLY_STATUS: 'APPLY_STATUS',
  CURE_STATUS: 'CURE_STATUS',
  HEAL_ENTITY: 'HEAL_ENTITY',
  MODIFY_STAT: 'MODIFY_STAT',
  DISPLACE: 'DISPLACE',
  SUMMON_ENTITIES: 'SUMMON_ENTITIES',
  ALTER_MAP: 'ALTER_MAP',
  MUTATE_INVENTORY: 'MUTATE_INVENTORY',
  DRAIN_VITAL: 'DRAIN_VITAL',
  GRANT_RESOURCE: 'GRANT_RESOURCE'
});

export const PROJECT_AREA_SHAPES = Object.freeze([
  'BOLT',
  'BEAM',
  'BALL',
  'CONE',
  'WAVE',
  'SURROUND'
]);

export const DISPLACE_MODES = Object.freeze([
  'BLINK',
  'TELEPORT',
  'PULL_TO',
  'PUSH_AWAY',
  'CHARGE_TO',
  'TELE_LEVEL'
]);

export const ALTER_MAP_ACTIONS = Object.freeze([
  'REVEAL_ALL',
  'DETECT_MONSTERS',
  'DETECT_ITEMS',
  'DETECT_TRAPS',
  'STONE_TO_MUD',
  'DESTROY_DOORS_TRAPS',
  'EARTHQUAKE',
  'DARKNESS',
  'LIGHT_AREA',
  'DESTROY_AREA'
]);

export const MUTATE_INVENTORY_ACTIONS = Object.freeze([
  'IDENTIFY',
  'IDENTIFY_FULL',
  'REMOVE_CURSE',
  'REMOVE_CURSE_HEAVY',
  'ENCHANT_WEAPON',
  'ENCHANT_ARMOR',
  'RECHARGE',
  'STEAL_GOLD',
  'STEAL_ITEM',
  'DRAIN_CHARGE'
]);

export const DRAIN_VITAL_TYPES = Object.freeze([
  'XP',
  'MANA',
  'STAT'
]);

export const TARGET_TYPES = Object.freeze([
  'SELF',
  'TARGET',
  'ALL_ENEMIES',
  'AREA'
]);

/**
 * 주어진 EffectOp 객체의 문법 및 필수 파라미터 유효성을 검사합니다.
 * @param {Object} op - 효과 연산자 객체
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEffectOp(op) {
  if (!op || typeof op !== 'object') {
    return { valid: false, error: 'EffectOp must be a non-null object' };
  }

  const { op: opType } = op;
  if (!opType || typeof opType !== 'string' || !EFFECT_OP_TYPES[opType]) {
    return { valid: false, error: `Invalid or missing op type: "${opType}"` };
  }

  switch (opType) {
    case EFFECT_OP_TYPES.DEAL_DAMAGE:
      // element, dice, flat, mult, ignoreACPct, slayTags, lifestealPct
      return { valid: true };

    case EFFECT_OP_TYPES.PROJECT_AREA:
      if (op.shape && !PROJECT_AREA_SHAPES.includes(op.shape)) {
        return { valid: false, error: `Invalid shape "${op.shape}" for PROJECT_AREA` };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.APPLY_STATUS:
      if (!op.statusId) {
        return { valid: false, error: 'APPLY_STATUS requires statusId' };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.CURE_STATUS:
      if (!op.statusIds) {
        return { valid: false, error: 'CURE_STATUS requires statusIds' };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.HEAL_ENTITY:
      return { valid: true };

    case EFFECT_OP_TYPES.MODIFY_STAT:
      if (!op.stat) {
        return { valid: false, error: 'MODIFY_STAT requires stat parameter' };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.DISPLACE:
      if (op.mode && !DISPLACE_MODES.includes(op.mode)) {
        return { valid: false, error: `Invalid mode "${op.mode}" for DISPLACE` };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.SUMMON_ENTITIES:
      return { valid: true };

    case EFFECT_OP_TYPES.ALTER_MAP:
      if (op.action && !ALTER_MAP_ACTIONS.includes(op.action)) {
        return { valid: false, error: `Invalid action "${op.action}" for ALTER_MAP` };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.MUTATE_INVENTORY:
      if (op.action && !MUTATE_INVENTORY_ACTIONS.includes(op.action)) {
        return { valid: false, error: `Invalid action "${op.action}" for MUTATE_INVENTORY` };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.DRAIN_VITAL:
      if (op.type && !DRAIN_VITAL_TYPES.includes(op.type)) {
        return { valid: false, error: `Invalid type "${op.type}" for DRAIN_VITAL` };
      }
      return { valid: true };

    case EFFECT_OP_TYPES.GRANT_RESOURCE:
      return { valid: true };

    default:
      return { valid: true };
  }
}
