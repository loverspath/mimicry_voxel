/**
 * @module ItemSchemaInterpreter
 * @category systems
 * @description ToME 2.3.5 아이템 스키마 (tval, sval, flags, pval, activate)를
 *              Argon 표준 12대 EffectOp[] 정형 규격으로 해석하고 EffectVM / StatusEffectEngine 파이프라인으로 연결하는 해석 엔진.
 * @purity Pure / Stateless Interpretation Engine
 * @dependencies EffectOpSchema.js, EffectVM.js, StatusEffectEngine.js, ArtifactActivationEngine.js, TomeEquipmentEngine.js, TomeKindsData.js
 * @exports ItemSchemaInterpreter
 */

import { EFFECT_OP_TYPES, validateEffectOp } from '../configs/EffectOpSchema.js';
import { EffectVM } from './EffectVM.js';
import { StatusEffectEngine } from './StatusEffectEngine.js';
import { ArtifactActivationEngine } from './ArtifactActivationEngine.js';
import { TVAL } from './TomeEquipmentEngine.js';
import { TOME_KINDS_DATA } from '../entities/TomeKindsData.js';

// 베이스명 인덱스 맵
const KINDS_BY_NAME = {};
for (const k of Object.values(TOME_KINDS_DATA || {})) {
  KINDS_BY_NAME[k.name] = k;
  const cleanName = k.name.replace(/^[&\s]+/, '').replace(/[~#]/g, '').trim();
  if (!KINDS_BY_NAME[cleanName]) KINDS_BY_NAME[cleanName] = k;
}

export class ItemSchemaInterpreter {
  /**
   * 임의의 아이템을 canonical EffectOp[] 배열로 해석합니다.
   * @param {Object} item - 대상 아이템 객체 (tval, sval, flags, pval, activate 등)
   * @returns {Array<Object>} EffectOp[]
   */
  static interpretItem(item) {
    if (!item || typeof item !== 'object') return [];

    // 1. 유물 발동(Activation) 우선 검사 (81종 activatable artifacts)
    const hasActivateFlag = item.activate ||
      (item.flags && (Array.isArray(item.flags) ? item.flags.includes('ACTIVATE') : item.flags.has?.('ACTIVATE'))) ||
      (item.specialTags && item.specialTags.includes('ACTIVATE'));

    const actResolved = ArtifactActivationEngine.resolveArtifactActivation(item);
    if (actResolved && (hasActivateFlag || actResolved.spec)) {
      const artOps = this._interpretArtifactActivation(actResolved.key, actResolved.spec, item);
      if (artOps && artOps.length > 0) {
        return this._validateOps(artOps);
      }
    }

    // 2. tval / sval 도출
    let tval = item.tval;
    let sval = item.sval;

    if (tval === undefined || sval === undefined) {
      const baseKind = KINDS_BY_NAME[item._baseName || item.name];
      if (baseKind) {
        if (tval === undefined) tval = baseKind.tval;
        if (sval === undefined) sval = baseKind.sval;
      }
    }

    if (tval === undefined) {
      if (item.type === 'POTION') tval = TVAL.POTION;
      else if (item.type === 'SCROLL') tval = TVAL.SCROLL;
      else if (item.type === 'FOOD') tval = TVAL.FOOD;
      else if (item.type === 'FLASK') tval = TVAL.FLASK;
      else if (item.type === 'WAND') tval = TVAL.WAND;
      else if (item.type === 'STAFF') tval = TVAL.STAFF;
      else if (item.type === 'ROD') tval = TVAL.ROD;
    }

    let ops = [];

    // 3. 포션 (tval === 71)
    if (tval === TVAL.POTION || item.type === 'POTION') {
      ops = this._interpretPotion(sval, item);
    }
    // 4. 스크롤 (tval === 70)
    else if (tval === TVAL.SCROLL || item.type === 'SCROLL') {
      ops = this._interpretScroll(sval, item);
    }
    // 5. 음식 및 버섯 (tval === 80)
    else if (tval === TVAL.FOOD || item.type === 'FOOD') {
      ops = this._interpretFood(sval, item);
    }
    // 6. 완드 (tval === 65)
    else if (tval === TVAL.WAND || item.type === 'WAND') {
      ops = this._interpretWand(sval, item);
    }
    // 7. 스태프 (tval === 55)
    else if (tval === TVAL.STAFF || item.type === 'STAFF') {
      ops = this._interpretStaff(sval, item);
    }
    // 8. 로드 (tval === 66, 67)
    else if (tval === TVAL.ROD || tval === TVAL.ROD_MAIN || item.type === 'ROD') {
      ops = this._interpretRod(sval, item);
    }

    return this._validateOps(ops);
  }

  /**
   * 아이템을 해석한 후 EffectVM을 통해 즉시 실행합니다.
   * @param {Object} item - 대상 아이템
   * @param {Object} context - 실행 컨텍스트 (caster, target, game, addLogEntry 등)
   * @returns {{ success: boolean, results: Array<Object>, ops: Array<Object> }}
   */
  static executeItem(item, context = {}) {
    const ops = this.interpretItem(item);
    const execRes = EffectVM.execute(ops, context);
    return { ...execRes, ops };
  }

  // ==========================================
  // [포션 해석기 (tval: 71, all 53 svals)]
  // ==========================================
  static _interpretPotion(sval, item) {
    const ops = [];

    // 레거시 가속 물약 호환성 보장
    if ((item.name && item.name.includes('가속')) || sval === 29) {
      ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 15, target: 'SELF' });
      return ops;
    }

    switch (sval) {
      case 1: // Apple Juice
      case 2: // Slime Mold Juice
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 5, target: 'SELF' });
        break;

      case 3: // Blood of Life
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', delta: 1, permanent: true, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 1000, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' });
        break;

      case 4: // Slowness
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 10, target: 'SELF' });
        break;

      case 5: // Salt Water
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['POISON'], target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PARALYZE', duration: 2, target: 'SELF' });
        break;

      case 6: // Poison
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'POISON', duration: 15, power: 2, target: 'SELF' });
        break;

      case 7: // Blindness
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLIND', duration: 12, target: 'SELF' });
        break;

      case 9: // Booze
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 10, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 10, target: 'SELF' });
        break;

      case 10: // Corruption
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'WEAKEN', duration: 10, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'DISEASE', duration: 10, target: 'SELF' });
        break;

      case 11: // Sleep
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PARALYZE', duration: 5, target: 'SELF' });
        break;

      case 12: // Learning
        ops.push({ op: EFFECT_OP_TYPES.GRANT_RESOURCE, xp: 1000, target: 'SELF' });
        break;

      case 13: // Lose Memories
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'AMNESIA', duration: 10, target: 'SELF' });
        break;

      case 15: // Ruination
        ops.push({ op: EFFECT_OP_TYPES.DEAL_DAMAGE, flat: 50, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'all', delta: -1, target: 'SELF' });
        break;

      case 16: // Weakness
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'str', delta: -1, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'WEAKEN', duration: 10, target: 'SELF' });
        break;

      case 17: // Stupidity
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'int', delta: -1, target: 'SELF' });
        break;

      // [CRITICAL FIX] Potion of Naivety -> reduces Wisdom / applies WEAKEN, NOT Speed/Haste!
      case 18: // Naivety
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'wis', delta: -1, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'WEAKEN', duration: 10, target: 'SELF' });
        break;

      case 19: // Clumsiness
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'dex', delta: -1, target: 'SELF' });
        break;

      case 20: // Sickliness
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', delta: -1, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'DISEASE', duration: 10, target: 'SELF' });
        break;

      case 21: // Ugliness
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'chr', delta: -1, target: 'SELF' });
        break;

      case 22: // Detonations
        ops.push({ op: EFFECT_OP_TYPES.DEAL_DAMAGE, flat: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 5, target: 'SELF' });
        break;

      case 23: // Death
        ops.push({ op: EFFECT_OP_TYPES.DEAL_DAMAGE, flat: 80, target: 'SELF' });
        break;

      case 24: // Infra-vision
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'INFRA', duration: 50, target: 'SELF' });
        break;

      case 25: // Detect Invisible
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SEE_INVIS', duration: 50, target: 'SELF' });
        break;

      case 26: // Slow Poison
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['POISON'], target: 'SELF' });
        break;

      case 27: // Neutralise Poison
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['POISON'], target: 'SELF' });
        break;

      case 28: // Boldness
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['FEAR'], target: 'SELF' });
        break;

      case 30: // Resist Heat -> RES_FIRE
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_FIRE', duration: 30, target: 'SELF' });
        break;

      case 31: // Resist Cold -> RES_COLD
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_COLD', duration: 30, target: 'SELF' });
        break;

      case 32: // Heroism -> HEROISM + heal 10 + cure fear
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HEROISM', duration: 25, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 10, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['FEAR'], target: 'SELF' });
        break;

      case 33: // Berserk Strength -> BERSERK + heal 30 + cure fear
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BERSERK', duration: 35, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['FEAR'], target: 'SELF' });
        break;

      case 34: // Cure Light Wounds
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 20, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['BLEED'], target: 'SELF' });
        break;

      case 35: // Cure Serious Wounds
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 50, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['BLEED', 'BLIND', 'CONFUSE'], target: 'SELF' });
        break;

      case 36: // Cure Critical Wounds
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 100, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['BLEED', 'BLIND', 'CONFUSE', 'POISON', 'STUN'], target: 'SELF' });
        break;

      case 38: // *Healing*
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 300, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['BLEED', 'BLIND', 'CONFUSE', 'POISON', 'STUN'], target: 'SELF' });
        break;

      case 39: // Life
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 1000, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', delta: 1, permanent: true, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' });
        break;

      case 40: // Restore Mana
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, restoreMana: true, target: 'SELF' });
        break;

      case 41: // Restore Life Levels
        ops.push({ op: EFFECT_OP_TYPES.GRANT_RESOURCE, xp: 2000, target: 'SELF' });
        break;

      case 42: // Restore Strength
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'str', restore: true, target: 'SELF' });
        break;

      case 43: // Restore Intelligence
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'int', restore: true, target: 'SELF' });
        break;

      case 44: // Restore Wisdom
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'wis', restore: true, target: 'SELF' });
        break;

      case 45: // Restore Dexterity
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'dex', restore: true, target: 'SELF' });
        break;

      case 46: // Restore Constitution
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', restore: true, target: 'SELF' });
        break;

      case 47: // Restore Charisma
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'chr', restore: true, target: 'SELF' });
        break;

      case 48: // Strength Gain
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'str', delta: 1, permanent: true, target: 'SELF' });
        break;

      case 49: // Intelligence Gain
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'int', delta: 1, permanent: true, target: 'SELF' });
        break;

      case 51: // Dexterity Gain
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'dex', delta: 1, permanent: true, target: 'SELF' });
        break;

      case 52: // Constitution Gain
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', delta: 1, permanent: true, target: 'SELF' });
        break;

      case 53: // Charisma Gain
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'chr', delta: 1, permanent: true, target: 'SELF' });
        break;

      case 55: // Augmentation
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'all', delta: 1, permanent: true, target: 'SELF' });
        break;

      case 57: // *Enlightenment*
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SEE_INVIS', duration: 100, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'ESP', duration: 100, target: 'SELF' });
        break;

      case 59: // Experience
        ops.push({ op: EFFECT_OP_TYPES.GRANT_RESOURCE, xp: 2500, target: 'SELF' });
        break;

      case 62: // Invulnerability -> INVULN
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'INVULN', duration: 10, target: 'SELF' });
        break;

      case 63: // New Life
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'all', restore: true, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 1000, restoreMana: true, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' });
        break;

      default:
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 15, target: 'SELF' });
        break;
    }

    return ops;
  }

  // ==========================================
  // [스크롤 해석기 (tval: 70, all 42 svals)]
  // ==========================================
  static _interpretScroll(sval, item) {
    const ops = [];

    switch (sval) {
      case 0: // Darkness
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DARKNESS' });
        break;

      case 4: // Summon Monsters
        ops.push({ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: 'GOBLIN' });
        break;

      case 5: // Summon Undead
        ops.push({ op: EFFECT_OP_TYPES.SUMMON_ENTITIES, count: 2, summonFilter: 'UNDEAD' });
        break;

      case 8: // Phase Door
        ops.push({ op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: 10, target: 'SELF' });
        break;

      case 10: // Teleport
        ops.push({ op: EFFECT_OP_TYPES.DISPLACE, mode: 'TELEPORT', dist: 100, target: 'SELF' });
        break;

      case 13: // Identify
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'IDENTIFY' });
        break;

      case 14: // *Identify*
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'IDENTIFY_FULL' });
        break;

      case 15: // Remove Curse
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'REMOVE_CURSE' });
        break;

      case 16: // *Remove Curse*
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'REMOVE_CURSE_HEAVY' });
        break;

      case 17: // Enchant Weapon To-Hit
      case 18: // Enchant Weapon To-Dam
      case 19: // Craftsmanship
      case 21: // *Enchant Weapon*
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'ENCHANT_WEAPON' });
        break;

      case 20: // *Enchant Armour*
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'ENCHANT_ARMOR' });
        break;

      case 22: // Recharging
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'RECHARGE' });
        break;

      case 25: // Magic Mapping
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' });
        break;

      case 26: // Treasure Detection
      case 27: // Object Detection
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DETECT_ITEMS' });
        break;

      case 31: // Divination
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' });
        ops.push({ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'IDENTIFY_FULL' });
        break;

      case 32: // Satisfy Hunger
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 5, target: 'SELF' });
        break;

      case 33: // Blessing
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLESSED', duration: 20, target: 'SELF' });
        break;

      case 34: // Holy Chant
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLESSED', duration: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PROT_EVIL', duration: 30, target: 'SELF' });
        break;

      case 35: // Holy Prayer
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLESSED', duration: 50, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PROT_EVIL', duration: 50, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 50, target: 'SELF' });
        break;

      case 36: // Monster Confusion
        ops.push({
          op: EFFECT_OP_TYPES.PROJECT_AREA,
          shape: 'SURROUND',
          radius: 6,
          onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 10, target: 'TARGET' }]
        });
        break;

      case 37: // Protection from Evil
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PROT_EVIL', duration: 50, target: 'SELF' });
        break;

      case 38: // Rune of Protection
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 30, target: 'SELF' });
        break;

      // [CRITICAL FIX] *Destruction* routes lethal damage through EffectVM / LootSystem.processMonsterDeath
      case 41: // *Destruction*
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DESTROY_AREA', radius: 15 });
        ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 15, element: 'PHYSICAL', flat: 9999 });
        break;

      case 42: // Dispel Undead
        ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 10, element: 'LIGHT', flat: 100, slayTags: ['UNDEAD'] });
        break;

      case 45: // Mass Genocide
        ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 20, element: 'MAGIC', flat: 1000 });
        break;

      case 49: // Ice
        ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'COLD', flat: 50 });
        break;

      case 50: // Chaos
        ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'CHAOS', flat: 80 });
        break;

      default:
        ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'LIGHT_AREA', radius: 4 });
        break;
    }

    return ops;
  }

  // ==========================================
  // [음식 및 버섯 해석기 (tval: 80, all 20 svals)]
  // ==========================================
  static _interpretFood(sval, item) {
    const ops = [];

    // 일반 음식 (sval >= 32)
    if (sval >= 32) {
      if (sval === 40) { // Sprig of Athelas
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 50, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' });
      } else if (sval === 38 || sval === 39) { // Fine Ale / Fine Wine
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 5, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 5, target: 'SELF' });
      } else {
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 10, target: 'SELF' });
      }
      return ops;
    }

    // 마법 버섯 (Magic Mushrooms: sval 1..19)
    switch (sval) {
      case 1: // Blindness
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLIND', duration: 10, target: 'SELF' });
        break;

      case 2: // Paranoia
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'FEAR', duration: 10, target: 'SELF' });
        break;

      case 3: // Confusion
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 10, target: 'SELF' });
        break;

      case 4: // Hallucination
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HALLU', duration: 15, target: 'SELF' });
        break;

      case 5: // Paralysis
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PARALYZE', duration: 5, target: 'SELF' });
        break;

      case 6: // Weakness
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'str', delta: -1, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'WEAKEN', duration: 15, target: 'SELF' });
        break;

      case 7: // Sickness
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', delta: -1, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'DISEASE', duration: 15, target: 'SELF' });
        break;

      case 8: // Stupidity
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'int', delta: -1, target: 'SELF' });
        break;

      case 9: // Naivety
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'wis', delta: -1, target: 'SELF' });
        break;

      case 10: // Unhealth
        ops.push({ op: EFFECT_OP_TYPES.DEAL_DAMAGE, flat: 20, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'DISEASE', duration: 20, target: 'SELF' });
        break;

      case 11: // Disease
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'DISEASE', duration: 25, target: 'SELF' });
        break;

      case 12: // Cure Poison
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['POISON'], target: 'SELF' });
        break;

      case 13: // Cure Blindness
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['BLIND'], target: 'SELF' });
        break;

      case 14: // Cure Paranoia
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['FEAR'], target: 'SELF' });
        break;

      case 15: // Cure Confusion
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['CONFUSE'], target: 'SELF' });
        break;

      case 16: // Cure Serious
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 50, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['BLEED', 'BLIND', 'CONFUSE'], target: 'SELF' });
        break;

      case 17: // Restore Str
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'str', restore: true, target: 'SELF' });
        break;

      case 18: // Restore Con
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'con', restore: true, target: 'SELF' });
        break;

      case 19: // Restoring
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'all', restore: true, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 100, target: 'SELF' });
        break;

      default:
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 10, target: 'SELF' });
        break;
    }

    return ops;
  }

  // ==========================================
  // [완드 해석기 (tval: 65)]
  // ==========================================
  static _interpretWand(sval, item) {
    switch (sval) {
      case 3: // Manathrust
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MANA', flat: 30, dice: '6d8', target: 'TARGET' }];
      case 4: // Fireflash
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 3, element: 'FIRE', flat: 40, dice: '8d8' }];
      case 5: // Firewall
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BEAM', range: 5, element: 'FIRE', flat: 35, dice: '6d8' }];
      case 6: // Tidal Wave
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'WAVE', radius: 3, element: 'COLD', flat: 35, dice: '6d8' }];
      case 7: // Ice Storm
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'COLD', flat: 45, dice: '10d8' }];
      case 8: // Noxious Cloud
      case 9: // Poison Blood
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 3, element: 'POISON', flat: 30, dice: '5d8' }];
      case 10: // Thunderstorm
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'LIGHTNING', flat: 50, dice: '12d8' }];
      case 14: // Teleport Away
        return [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'TELEPORT', dist: 50, target: 'TARGET' }];
      case 18: // Essence of Speed
        return [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 15, target: 'SELF' }];
      case 22: // Confuse
        return [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 10, target: 'TARGET' }];
      default:
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MAGIC', flat: 25, dice: '3d8', target: 'TARGET' }];
    }
  }

  // ==========================================
  // [스태프 해석기 (tval: 55)]
  // ==========================================
  static _interpretStaff(sval, item) {
    switch (sval) {
      case 3: // Identify
        return [{ op: EFFECT_OP_TYPES.MUTATE_INVENTORY, action: 'IDENTIFY' }];
      case 4: // Light
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'LIGHT_AREA', radius: 5 }];
      case 5: // Mapping
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' }];
      case 6: // Detect Evil
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DETECT_MONSTERS' }];
      case 7: // Detect Invisibility
        return [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SEE_INVIS', duration: 30, target: 'SELF' }];
      case 8: // Teleportation
        return [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'TELEPORT', dist: 50, target: 'SELF' }];
      case 10: // Cure Light
        return [{ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 25, target: 'SELF' }];
      case 11: // Healing
        return [
          { op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 300, target: 'SELF' },
          { op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' }
        ];
      case 12: // Speed
        return [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 25, target: 'SELF' }];
      case 13: // Dispel Evil
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 8, element: 'LIGHT', flat: 100, slayTags: ['EVIL'] }];
      case 14: // Power
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 10, element: 'MAGIC', flat: 150 }];
      case 15: // Holiness
        return [
          { op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 150, target: 'SELF' },
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PROT_EVIL', duration: 30, target: 'SELF' },
          { op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' }
        ];
      case 16: // Darkness
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DARKNESS' }];
      case 17: // Earthquakes
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'EARTHQUAKE', radius: 5 }];
      case 18: // Genocide
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 15, element: 'MAGIC', flat: 500 }];
      case 19: // Destruction
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DESTROY_AREA', radius: 12 }];
      case 20: // Starburst
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 6, element: 'LIGHT', flat: 120 }];
      default:
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'LIGHT_AREA', radius: 4 }];
    }
  }

  // ==========================================
  // [로드 해석기 (tval: 66, 67)]
  // ==========================================
  static _interpretRod(sval, item) {
    switch (sval) {
      case 1: // Trap/Door Destruction
      case 16: // Disarm
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'DESTROY_DOORS_TRAPS' }];
      case 4: // Magic Mapping
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' }];
      case 9: // Illumination
      case 17: // Light
        return [{ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'LIGHT_AREA', radius: 5 }];
      case 12: // Healing
        return [{ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 200, target: 'SELF' }];
      case 14: // Speed
        return [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 20, target: 'SELF' }];
      case 15: // Teleport Away
        return [{ op: EFFECT_OP_TYPES.DISPLACE, mode: 'TELEPORT', dist: 50, target: 'TARGET' }];
      case 18: // Fire Bolt
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'FIRE', flat: 40, dice: '6d8', target: 'TARGET' }];
      case 19: // Cold Bolt
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'COLD', flat: 40, dice: '6d8', target: 'TARGET' }];
      case 20: // Lightning Bolt
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'LIGHTNING', flat: 40, dice: '6d8', target: 'TARGET' }];
      case 21: // Acid Bolt
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'ACID', flat: 40, dice: '6d8', target: 'TARGET' }];
      case 24: // Acid Balls
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'ACID', flat: 45 }];
      case 25: // Lightning Balls
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'LIGHTNING', flat: 45 }];
      case 26: // Fire Balls
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'FIRE', flat: 45 }];
      case 27: // Cold Balls
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'COLD', flat: 45 }];
      case 28: // Havoc
        return [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 6, element: 'CHAOS', flat: 60, dice: '10d10' }];
      default:
        return [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MAGIC', flat: 25, dice: '4d8', target: 'TARGET' }];
    }
  }

  // ==========================================
  // [전설 유물 고유 발동 해석기 (Artifact Activations)]
  // ==========================================
  static _interpretArtifactActivation(actKey, spec, item) {
    const ops = [];
    if (!spec) return ops;

    const actType = spec.type || 'SPECIAL';

    // 1. 치유 및 스탯 복구
    if (actType === 'HEAL' || actType === 'RESTORATION') {
      const healAmt = spec.healAmount || parseInt(spec.dice, 10) || 100;
      ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: healAmt, target: 'SELF' });
      if (actType === 'RESTORATION' || actKey === 'THRAIN' || actKey === 'BARAHIR' || actKey === 'REST_ALL' || actKey === 'RESTORE_STAT' || actKey === 'RESTORATION') {
        ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'all', restore: true, target: 'SELF' });
      }
      ops.push({ op: EFFECT_OP_TYPES.CURE_STATUS, statusIds: ['ALL_NEGATIVE'], target: 'SELF' });
      return ops;
    }

    // 2. 광원 방출
    if (actType === 'LIGHT' || actKey === 'LIGHT' || actKey === 'SUNLIGHT' || actKey === 'ILLUMINATION' || actKey === 'DAWN') {
      ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'LIGHT_AREA', radius: 5 });
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 4, element: 'LIGHT', flat: parseInt(spec.dice, 10) || 50, dice: spec.dice });
      return ops;
    }

    // 3. 탐지 및 지도
    if (actType === 'DETECT' || actKey === 'MAP_LIGHT' || actKey === 'DETECT_ALL') {
      ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' });
      ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'LIGHT_AREA', radius: 8 });
      return ops;
    }

    // 4. 공간 이동
    if (actType === 'TELEPORT' || actKey === 'DIM_DOOR' || actKey === 'PHASE_DOOR') {
      ops.push({ op: EFFECT_OP_TYPES.DISPLACE, mode: actKey === 'PHASE_DOOR' ? 'BLINK' : 'TELEPORT', dist: spec.range || 50, target: 'SELF' });
      return ops;
    }

    // 5. 악령 소멸 / 디스펠
    if (actType === 'DISPEL' || actKey === 'DISP_EVIL') {
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 10, element: 'LIGHT', flat: parseInt(spec.dice, 10) || 500, slayTags: ['EVIL'] });
      return ops;
    }

    // 6. 단일 볼트
    if (actType === 'BOLT') {
      const dmg = parseInt(spec.dice, 10) || 50;
      ops.push({
        op: EFFECT_OP_TYPES.DEAL_DAMAGE,
        element: spec.element || 'MAGIC',
        flat: dmg,
        dice: spec.dice,
        target: 'TARGET',
        lifestealPct: actKey === 'DRAIN_2' ? 1.0 : 0
      });
      return ops;
    }

    // 7. 광역 투사체 (AOE)
    if (actType === 'AOE') {
      const dmg = parseInt(spec.dice, 10) || 75;
      ops.push({
        op: EFFECT_OP_TYPES.PROJECT_AREA,
        shape: 'BALL',
        radius: 4,
        element: spec.element || 'FIRE',
        flat: dmg,
        dice: spec.dice
      });
      return ops;
    }

    // 8. 버프
    if (actType === 'BUFF') {
      if (spec.speed || actKey === 'SPEED' || actKey === 'TULKAS' || actKey === 'ROHAN') {
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: spec.turns || 30, target: 'SELF' });
      }
      if (actKey === 'PROT_EVIL') {
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'PROT_EVIL', duration: 50, target: 'SELF' });
      }
      if (actKey === 'HURIN') {
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HEROISM', duration: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 20, target: 'SELF' });
      }
      if (actKey === 'TURMIL') {
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'BLESSED', duration: 30, target: 'SELF' });
      }
      if (actKey === 'BLADETURNER') {
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 20, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_FIRE', duration: 20, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_COLD', duration: 20, target: 'SELF' });
      }
      if (actKey === 'COLLUIN') {
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_FIRE', duration: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_COLD', duration: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_ELEC', duration: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_ACID', duration: 30, target: 'SELF' });
        ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'RES_POIS', duration: 30, target: 'SELF' });
      }
      return ops;
    }

    // 9. 궁극기 / 복합 발동
    if (actKey === 'NARYA') {
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'FIRE', flat: 200 });
      ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 50, target: 'SELF' });
      return ops;
    }
    if (actKey === 'NENYA') {
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 4, element: 'COLD', flat: 200 });
      ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 300, target: 'SELF' });
      return ops;
    }
    if (actKey === 'VILYA') {
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', radius: 5, element: 'ELEC', flat: 250 });
      ops.push({ op: EFFECT_OP_TYPES.ALTER_MAP, action: 'REVEAL_ALL' });
      return ops;
    }
    if (actKey === 'POWER') {
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 8, element: 'MANA', flat: 600 });
      ops.push({ op: EFFECT_OP_TYPES.MODIFY_STAT, stat: 'all', delta: 2, target: 'SELF' });
      return ops;
    }
    if (actKey === 'ERU') {
      ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 1000, target: 'SELF' });
      ops.push({ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', radius: 10, element: 'LIGHT', flat: 1000, slayTags: ['EVIL'] });
      ops.push({ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'INVULN', duration: 10, target: 'SELF' });
      return ops;
    }

    // 기본 대체
    ops.push({ op: EFFECT_OP_TYPES.HEAL_ENTITY, flat: 50, target: 'SELF' });
    return ops;
  }

  // ==========================================
  // [유효성 검증 필터]
  // ==========================================
  static _validateOps(ops) {
    if (!Array.isArray(ops)) return [];
    return ops.filter(op => {
      const res = validateEffectOp(op);
      return res && res.valid;
    });
  }
}
