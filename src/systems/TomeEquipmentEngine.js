/**
 * @module TomeEquipmentEngine
 * @category systems
 * @description ToME 2.3.5 정통 tval 기반 슬롯(slotType), 아스키 심볼, 무게, 방어력(AC), 무기 카테고리 무상태 연산 엔진
 * @purity Pure Stateless Engine
 * @exports TomeEquipmentEngine, TVAL
 */

import { getSpeciesConfig } from '../entities/MonsterRegistry.js';

export const TVAL = Object.freeze({
  SKELETON: 1,
  BOTTLE: 2,
  CHEST: 5,
  SHOT: 16,
  ARROW: 17,
  BOLT: 18,
  BOW: 19,
  DIGGING: 20,
  HAFTED: 21,
  POLEARM: 22,
  SWORD: 23,
  AXE: 24,
  BOOTS: 30,
  GLOVES: 31,
  HELM: 32,
  CROWN: 33,
  SHIELD: 34,
  CLOAK: 35,
  SOFT_ARMOR: 36,
  HARD_ARMOR: 37,
  DRAG_ARMOR: 38,
  LITE: 39,
  AMULET: 40,
  RING: 45,
  STAFF: 55,
  WAND: 65,
  ROD: 66,
  ROD_MAIN: 67,
  SCROLL: 70,
  POTION: 71,
  FLASK: 77,
  FOOD: 80,
  GOLD: 100
});

const TVAL_SLOT_MAP = Object.freeze({
  [TVAL.BOW]: 'BOW',
  [TVAL.SHOT]: 'QUIVER',
  [TVAL.ARROW]: 'QUIVER',
  [TVAL.BOLT]: 'QUIVER',
  [TVAL.DIGGING]: 'WEAPON',
  [TVAL.HAFTED]: 'WEAPON',
  [TVAL.POLEARM]: 'WEAPON',
  [TVAL.SWORD]: 'WEAPON',
  [TVAL.AXE]: 'WEAPON',
  [TVAL.BOOTS]: 'BOOTS',
  [TVAL.GLOVES]: 'GLOVES',
  [TVAL.HELM]: 'HELMET',
  [TVAL.CROWN]: 'HELMET',
  [TVAL.SHIELD]: 'SHIELD',
  [TVAL.CLOAK]: 'CLOAK',
  [TVAL.SOFT_ARMOR]: 'ARMOR',
  [TVAL.HARD_ARMOR]: 'ARMOR',
  [TVAL.DRAG_ARMOR]: 'ARMOR',
  [TVAL.LITE]: 'LIGHT',
  [TVAL.AMULET]: 'AMULET',
  [TVAL.RING]: 'RING'
});

const TVAL_SYMBOL_MAP = Object.freeze({
  [TVAL.BOW]: '}',
  [TVAL.SHOT]: '{',
  [TVAL.ARROW]: '{',
  [TVAL.BOLT]: '{',
  [TVAL.DIGGING]: '\\',
  [TVAL.HAFTED]: '/',
  [TVAL.POLEARM]: '|',
  [TVAL.SWORD]: '|',
  [TVAL.AXE]: '\\',
  [TVAL.BOOTS]: ']',
  [TVAL.GLOVES]: ']',
  [TVAL.HELM]: ']',
  [TVAL.CROWN]: ']',
  [TVAL.SHIELD]: ')',
  [TVAL.CLOAK]: '(',
  [TVAL.SOFT_ARMOR]: '[',
  [TVAL.HARD_ARMOR]: '[',
  [TVAL.DRAG_ARMOR]: '[',
  [TVAL.LITE]: '~',
  [TVAL.AMULET]: '"',
  [TVAL.RING]: '=',
  [TVAL.STAFF]: '/',
  [TVAL.WAND]: '-',
  [TVAL.ROD]: '-',
  [TVAL.ROD_MAIN]: '-',
  [TVAL.SCROLL]: '?',
  [TVAL.POTION]: '!',
  [TVAL.FLASK]: '!',
  [TVAL.FOOD]: ',',
  [TVAL.GOLD]: '$',
  [TVAL.SKELETON]: '&',
  [TVAL.BOTTLE]: '!',
  [TVAL.CHEST]: '~'
});

const TYPE_SLOT_MAP = Object.freeze({
  WEAPON: 'WEAPON',
  BOW: 'BOW',
  QUIVER: 'QUIVER',
  AMMO: 'QUIVER',
  ARMOR: 'ARMOR',
  HELMET: 'HELMET',
  CROWN: 'HELMET',
  GLOVES: 'GLOVES',
  BOOTS: 'BOOTS',
  SHIELD: 'SHIELD',
  CLOAK: 'CLOAK',
  RING: 'RING',
  AMULET: 'AMULET',
  LAMP: 'LIGHT',
  LIGHT: 'LIGHT'
});

const VALID_TOME_SYMBOLS = new Set([
  '[', ']', ')', '(', '|', '\\', '/', '}', '{', '=', '"', '~', '!', '?', '*', '$', '&', '-', ','
]);

const LEGACY_SYMBOL_MAP = Object.freeze({
  'a': '[',
  'h': ']',
  'o': '=',
  'i': '"',
  'w': '|',
  'd': '|',
  'W': '|',
  't': '~',
  'c': '*',
  '@': '*'
});

export class TomeEquipmentEngine {
  /**
   * tval 또는 fallback type 기반으로 장착 슬롯(slotType) 도출
   * @param {number|null} tval 
   * @param {string|null} fallbackType 
   * @returns {string|null}
   */
  static getSlotType(tval, fallbackType = null) {
    if (typeof tval === 'number' && TVAL_SLOT_MAP[tval]) {
      return TVAL_SLOT_MAP[tval];
    }
    if (fallbackType && TYPE_SLOT_MAP[fallbackType]) {
      return TYPE_SLOT_MAP[fallbackType];
    }
    return null;
  }

  /**
   * ToME 2.3.5 표준 아스키 심볼 도출
   * @param {string} type 
   * @param {string|null} slotType 
   * @param {number|null} tval 
   * @returns {string}
   */
  static getDefaultSymbol(type, slotType = null, tval = null) {
    if (typeof tval === 'number' && TVAL_SYMBOL_MAP[tval]) {
      return TVAL_SYMBOL_MAP[tval];
    }
    if (type === 'CORE') return '*';
    if (type === 'POTION' || type === 'FLASK' || type === 'BOTTLE') return '!';
    if (type === 'SCROLL') return '?';
    if (type === 'WAND' || type === 'ROD') return '-';
    if (type === 'STAFF') return '/';
    if (type === 'FOOD') return ',';
    if (type === 'GOLD') return '$';
    if (type === 'SKELETON') return '&';
    if (type === 'LAMP' || slotType === 'LIGHT') return '~';
    if (slotType === 'RING' || type === 'RING') return '=';
    if (slotType === 'AMULET' || type === 'AMULET') return '"';
    if (slotType === 'ARMOR' || type === 'ARMOR') return '[';
    if (slotType === 'HELMET' || type === 'HELMET') return ']';
    if (slotType === 'GLOVES' || type === 'GLOVES') return ']';
    if (slotType === 'BOOTS' || type === 'BOOTS') return ']';
    if (slotType === 'SHIELD' || type === 'SHIELD') return ')';
    if (slotType === 'CLOAK' || type === 'CLOAK') return '(';
    if (slotType === 'BOW' || type === 'BOW') return '}';
    if (slotType === 'QUIVER' || type === 'QUIVER' || type === 'AMMO') return '{';
    if (slotType === 'WEAPON' || type === 'WEAPON') return '|';

    return '?';
  }

  /**
   * 레거시 문자 필터링 및 ToME 2.3.5 정통 심볼 보정
   * @param {string} char 
   * @param {string} type 
   * @param {string|null} slotType 
   * @param {number|null} tval 
   * @returns {string}
   */
  static sanitizeSymbol(char, type, slotType = null, tval = null) {
    if (char && LEGACY_SYMBOL_MAP[char]) {
      return LEGACY_SYMBOL_MAP[char];
    }
    // 탄약류(Ammo/Quiver)는 항상 정통 심볼 '{' 보장
    if (slotType === 'QUIVER' || type === 'AMMO' || type === 'QUIVER' || tval === TVAL.SHOT || tval === TVAL.ARROW || tval === TVAL.BOLT) {
      return '{';
    }
    // 원거리 발사기(Bow)는 항상 정통 심볼 '}' 보장
    if (slotType === 'BOW' || type === 'BOW' || tval === TVAL.BOW) {
      return '}';
    }
    if (char && VALID_TOME_SYMBOLS.has(char)) {
      return char;
    }
    return this.getDefaultSymbol(type, slotType, tval);
  }

  /**
   * 무기 카테고리 도출 ('SWORD', 'BLUNT', 'POLEARM', 'ARCHERY' 또는 null)
   * @param {Object} item 
   * @returns {string|null}
   */
  static getWeaponCategory(item) {
    if (!item) return null;
    if (item._weaponCategory) return item._weaponCategory;

    const tval = item.tval;
    if (tval === TVAL.BOW || tval === TVAL.SHOT || tval === TVAL.ARROW || tval === TVAL.BOLT) {
      return 'ARCHERY';
    }
    if (item.slotType === 'BOW' || item.slotType === 'QUIVER' || item.type === 'BOW' || item.type === 'QUIVER') {
      return 'ARCHERY';
    }

    if (tval === TVAL.SWORD) return 'SWORD';
    if (tval === TVAL.DIGGING || tval === TVAL.AXE || tval === TVAL.HAFTED) return 'BLUNT';
    if (tval === TVAL.POLEARM) return 'POLEARM';

    if (item.slotType === 'WEAPON' || item.type === 'WEAPON') {
      if (item.char === '\\') return 'BLUNT';
      if (item.char === '/') return 'POLEARM';
      if (item.char === '}' || item.char === '{') return 'ARCHERY';
      return 'SWORD';
    }

    return null;
  }

  /**
   * 유효 방어력(Effective AC = baseAC + to_a + upgradeLevel) 계산
   * @param {Object} item 
   * @returns {number}
   */
  static calculateEffectiveAC(item) {
    if (!item) return 0;
    const base = item.baseAC || 0;
    const toA = item.to_a || 0;
    const upg = item.upgradeLevel || 0;
    return base + toA + upg;
  }

  /**
   * 아이템의 동적 무게(Weight) 계산
   * @param {Object} item 
   * @returns {number}
   */
  static calculateWeight(item) {
    if (!item) return 0;
    const count = item.count || 1;
    const tval = item.tval;
    const slotType = item.slotType;
    const isAmmo = tval === TVAL.SHOT || tval === TVAL.ARROW || tval === TVAL.BOLT || slotType === 'QUIVER' || item.type === 'QUIVER' || item.type === 'ARROW' || item.type === 'BOLT' || item.type === 'SHOT' || (item.specialTags && item.specialTags.includes('AMMO'));

    // 1. Core items (highest priority dynamic formula)
    if (item.type === 'CORE') {
      const config = getSpeciesConfig(item.coreType || 'HUMAN');
      if (config && config.coreBase) {
        const strBase = config.coreBase.str || 8;
        const conBase = config.coreBase.con || 8;
        const hpBase = config.coreBaseHp || 10;
        const rawWeight = (strBase * 0.05) + (conBase * 0.05) + (hpBase * 0.005);
        return Math.min(20, Math.max(3, Math.floor(rawWeight)));
      }
      return 5.0;
    }

    // 2. Consumables (highest priority lightweight scale)
    if (tval === TVAL.POTION || item.type === 'POTION' || tval === TVAL.FLASK || item.type === 'FLASK') {
      return +(0.4 * count).toFixed(1);
    }
    if (tval === TVAL.SCROLL || item.type === 'SCROLL') {
      return +(0.2 * count).toFixed(1);
    }
    if (tval === TVAL.WAND || item.type === 'WAND' || tval === TVAL.ROD || item.type === 'ROD') {
      return +(0.5 * count).toFixed(1);
    }
    if (tval === TVAL.STAFF || item.type === 'STAFF') {
      return +(1.5 * count).toFixed(1);
    }
    if (tval === TVAL.FOOD || item.type === 'FOOD') {
      return +(0.5 * count).toFixed(1);
    }

    // 3. Ammo bundles (0.1 lbs per unit)
    if (isAmmo) {
      return Math.max(1, Math.floor(0.1 * count));
    }

    // 4. Explicit _weight (for defined weapons, armors, and standard ToME items)
    if (item._weight !== undefined && item._weight !== null) {
      let rawUnit = item._weight;
      if (rawUnit > 50) {
        rawUnit = rawUnit * 0.1;
      }
      return Math.min(50, Math.max(1, Math.floor(rawUnit * count)));
    }

    // 5. Fallback equipment formulas (when _weight is missing)
    if (slotType === 'WEAPON' || item.type === 'WEAPON') {
      let diceCount = 1;
      let diceSides = 4;
      if (item.dice) {
        const parts = String(item.dice).split('d');
        diceCount = parseInt(parts[0]) || 1;
        diceSides = parseInt(parts[1]) || 4;
      }
      const strBonus = item.statBonuses?.str || 0;
      const calc = Math.floor((diceCount * diceSides * 1.5) + (strBonus * 2.0));
      return Math.min(50, Math.max(1, calc));
    }

    if (slotType === 'ARMOR' || slotType === 'HELMET' || slotType === 'GLOVES' || slotType === 'BOOTS' || slotType === 'SHIELD' || slotType === 'CLOAK') {
      const conBonus = item.statBonuses?.con || 0;
      const dexBonus = item.statBonuses?.dex || 0;
      const baseWeight = slotType === 'ARMOR' ? 12.0 : slotType === 'SHIELD' ? 6.0 : slotType === 'HELMET' ? 3.5 : slotType === 'BOOTS' ? 3.0 : slotType === 'GLOVES' ? 1.5 : 2.0;
      const calc = Math.floor(baseWeight + (conBonus * 1.5) + (dexBonus * 0.5));
      return Math.min(50, Math.max(1, calc));
    }

    if (slotType === 'BOW' || item.type === 'BOW') return 3.0;
    if (slotType === 'RING' || item.type === 'RING') return 0.2;
    if (slotType === 'AMULET' || item.type === 'AMULET') return 0.2;
    if (slotType === 'LIGHT' || item.type === 'LAMP') return 1.0;

    return 1.0;
  }

  /**
   * 아이템 카테고리 문자열 도출
   * @param {Object} item 
   * @returns {string}
   */
  static getItemCategory(item) {
    if (!item) return 'ITEM';
    if (item.type === 'CORE') return 'CORE';
    if (item.tval === TVAL.POTION || item.type === 'POTION') return 'POTION';
    if (item.tval === TVAL.SCROLL || item.type === 'SCROLL') return 'SCROLL';
    if (item.tval === TVAL.WAND || item.type === 'WAND') return 'WAND';
    if (item.tval === TVAL.STAFF || item.type === 'STAFF') return 'STAFF';
    if (item.tval === TVAL.ROD || item.type === 'ROD') return 'ROD';
    if (item.tval === TVAL.FOOD || item.type === 'FOOD') return 'FOOD';
    if (item.tval === TVAL.FLASK || item.type === 'FLASK') return 'FLASK';
    if (item.slotType) return item.slotType;
    return item.type || 'ITEM';
  }
}
