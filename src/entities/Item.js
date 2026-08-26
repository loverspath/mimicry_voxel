/**
 * @module Item
 * @category entities
 * @description 던전 바닥 및 인벤토리 내의 장비, 소모품, 마법 디바이스, 정수 코어 아이템 데이터 컨테이너 모델
 * @purity Zero-Logic Data Container
 * @dependencies Tags.js, TomeEquipmentEngine.js, TomeConsumableEngine.js, TomeDeviceEngine.js
 * @exports Item
 */

import { PREFIX_TAGS, SUFFIX_TAGS, getChromaticColor } from './Tags.js';
import { TomeEquipmentEngine } from '../systems/TomeEquipmentEngine.js';
import { TomeConsumableEngine } from '../systems/TomeConsumableEngine.js';
import { TomeDeviceEngine } from '../systems/TomeDeviceEngine.js';

export class Item {
  /**
   * ToME 2.3.5 정통 체계에 따른 표준 아스키 심볼 도출 (TomeEquipmentEngine 위임)
   */
  static getDefaultSymbol(type, slotType = null, name = "", tval = null) {
    return TomeEquipmentEngine.getDefaultSymbol(type, slotType, tval);
  }

  /**
   * 레거시 문자를 ToME 2.3.5 정통 심볼로 변환 (TomeEquipmentEngine 위임)
   */
  static sanitizeSymbol(char, type, slotType = null, name = "", tval = null) {
    return TomeEquipmentEngine.sanitizeSymbol(char, type, slotType, tval);
  }

  constructor(
    x, y,
    type,
    char,
    color,
    name,
    lightBonus = 0,
    slotType = null,
    statBonuses = {},
    dice = null,
    coreType = null,
    prefixes = [],
    suffixes = [],
    specialTags = [],
    flavorText = ""
  ) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.slotType = slotType || TomeEquipmentEngine.getSlotType(null, type);
    this._baseName = name;
    this._baseColor = color;
    this._char = TomeEquipmentEngine.sanitizeSymbol(char, type, this.slotType);
    this.color = color;
    this.name = name;
    this.lightBonus = lightBonus;
    this.dice = dice; // e.g. '1d8'
    this.coreType = coreType; // 'SLIME', 'GOBLIN', 'BAT', etc.
    this.prefixes = Array.isArray(prefixes) ? prefixes : [];
    this.suffixes = Array.isArray(suffixes) ? suffixes : [];
    this.fusionLevel = 0;
    this.count = 1;
    this.specialTags = Array.isArray(specialTags) ? specialTags : [];
    this.flavorText = flavorText;

    // ToME DOD 확장 필드
    this.tval = undefined;
    this.sval = undefined;
    this.baseAC = 0;
    this.upgradeLevel = 0;
    this.toHit = 0;
    this.toDmg = 0;
    this.charges = undefined;
    this.timeout = 0;

    // Default stat bonuses
    this.statBonuses = {
      str: statBonuses.str || 0,
      dex: statBonuses.dex || 0,
      con: statBonuses.con || 0,
      int: statBonuses.int || 0,
      cha: statBonuses.cha || 0,
      ...statBonuses
    };

    // =========================================================================
    // 🧬 Entity-Component System (ECS): Slay, Brands, Resistances, Immunities, Perks
    // =========================================================================
    this.slayTags = {};
    this.brands = {};
    this.resistances = {};
    this.immunities = new Set();
    this.perks = new Set();

    this.syncComponents();
  }

  /**
   * 플래그 및 접사로부터 ECS 데이터 컴포넌트(슬레이, 브랜드, 저항, 면역, 퍽)를 동기화합니다.
   */
  syncComponents() {
    const allFlags = [...(this.flags || []), ...(this.specialTags || [])];
    for (const f of allFlags) {
      const u = f.toUpperCase();
      if (u === 'SLAY_ORC' || u === 'KILL_ORC') this.slayTags['ORC'] = Math.max(this.slayTags['ORC'] || 0, 2.5);
      else if (u === 'SLAY_DRAGON' || u === 'KILL_DRAGON') this.slayTags['DRAGON'] = Math.max(this.slayTags['DRAGON'] || 0, 3.0);
      else if (u === 'SLAY_UNDEAD' || u === 'KILL_UNDEAD') this.slayTags['UNDEAD'] = Math.max(this.slayTags['UNDEAD'] || 0, 2.5);
      else if (u === 'SLAY_GIANT' || u === 'SLAY_TROLL') this.slayTags['GIANT'] = Math.max(this.slayTags['GIANT'] || 0, 2.5);
      else if (u === 'SLAY_ANIMAL') this.slayTags['ANIMAL'] = Math.max(this.slayTags['ANIMAL'] || 0, 2.0);
      else if (u === 'SLAY_EVIL' || u === 'SLAY_DEMON') this.slayTags['EVIL'] = Math.max(this.slayTags['EVIL'] || 0, 2.0);
      else if (u === 'BRAND_FIRE') this.brands['FIRE'] = 0.50;
      else if (u === 'BRAND_COLD') this.brands['COLD'] = 0.50;
      else if (u === 'BRAND_ELEC') this.brands['LIGHTNING'] = 0.50;
      else if (u === 'BRAND_POIS') this.brands['POISON'] = 0.40;
      else if (u === 'BRAND_ACID') this.brands['ACID'] = 0.50;
      else if (u === 'RES_FIRE') this.resistances['FIRE'] = 0.50;
      else if (u === 'RES_COLD') this.resistances['COLD'] = 0.50;
      else if (u === 'RES_ELEC') this.resistances['LIGHTNING'] = 0.50;
      else if (u === 'RES_POIS') this.resistances['POISON'] = 0.50;
      else if (u === 'RES_ACID') this.resistances['ACID'] = 0.50;
      else if (u === 'RES_LITE') this.resistances['LIGHT'] = 0.50;
      else if (u === 'RES_DARK') this.resistances['DARK'] = 0.50;
      else if (u === 'IM_FIRE') this.resistances['FIRE'] = 1.0;
      else if (u === 'IM_COLD') this.resistances['COLD'] = 1.0;
      else if (u === 'IM_ELEC') this.resistances['LIGHTNING'] = 1.0;
      else if (u === 'IM_ACID') this.resistances['ACID'] = 1.0;
      else if (u === 'FREE_ACT') {
        this.immunities.add('PARALYSIS');
        this.immunities.add('STUN');
        this.perks.add('FREE_ACT');
      } else if (u === 'SEE_INVIS') {
        this.perks.add('SEE_INVIS');
      } else if (u === 'TELEPATHY') {
        this.perks.add('TELEPATHY');
      } else if (u === 'REGEN') {
        this.perks.add('REGEN');
      }
    }

    if (this.prefixes) {
      for (const p of this.prefixes) {
        if (p === 'FIRE') this.brands['FIRE'] = 0.50;
        if (p === 'COLD') this.brands['COLD'] = 0.50;
        if (p === 'LIGHTNING') this.brands['LIGHTNING'] = 0.50;
        if (p === 'TOXIC') this.brands['POISON'] = 0.40;
        if (p === 'HOLY') this.slayTags['EVIL'] = 2.0;
      }
    }
    if (this.suffixes) {
      for (const s of this.suffixes) {
        if (s === 'SLAYER') {
          this.slayTags['ORC'] = 2.5;
          this.slayTags['ANIMAL'] = 2.0;
        }
      }
    }
  }

  get char() {
    return TomeEquipmentEngine.sanitizeSymbol(this._char, this.type, this.slotType, this.tval);
  }

  set char(val) {
    this._char = TomeEquipmentEngine.sanitizeSymbol(val, this.type, this.slotType, this.tval);
  }

  get displayName() {
    const isArtifact = !!(this.artifactKey || (this.specialTags && this.specialTags.includes('ARTIFACT')));
    if (isArtifact) {
      let finalName = this._baseName;
      if (this.upgradeLevel && this.upgradeLevel > 0) {
        finalName += ` +${this.upgradeLevel}`;
      }
      return finalName;
    }

    let nameParts = [];
    for (const pKey of this.prefixes) {
      if (PREFIX_TAGS[pKey]) nameParts.push(PREFIX_TAGS[pKey].name);
    }
    nameParts.push(this._baseName);
    for (const sKey of this.suffixes) {
      if (SUFFIX_TAGS[sKey]) nameParts.push(SUFFIX_TAGS[sKey].name);
    }
    let finalName = nameParts.join(' ');
    if (this.type === 'CORE' && this.fusionLevel > 0) {
      finalName += ` +${this.fusionLevel}`;
    }
    if (this.upgradeLevel && this.upgradeLevel > 0) {
      finalName += ` +${this.upgradeLevel}`;
    }
    return finalName;
  }

  get name() {
    return this.displayName;
  }

  set name(val) {
    this._baseName = val;
  }

  get displayColor() {
    const isArtifact = !!(this.artifactKey || (this.specialTags && this.specialTags.includes('ARTIFACT')));
    if (isArtifact) {
      return this._baseColor || '#ffd700';
    }
    return getChromaticColor(this.prefixes, this.suffixes, this._baseColor);
  }

  get color() {
    return this.displayColor;
  }

  set color(val) {
    this._baseColor = val;
  }

  getEffectiveBonus(name) {
    let val = this.statBonuses[name] || 0;
    for (const pKey of this.prefixes) {
      val += PREFIX_TAGS[pKey]?.stats[name] || 0;
    }
    for (const sKey of this.suffixes) {
      val += SUFFIX_TAGS[sKey]?.stats[name] || 0;
    }
    return val;
  }

  getLightBonus() {
    if (this.type !== 'LAMP' && this.slotType !== 'LIGHT') return 0;
    let bonus = this.lightBonus;
    if (this.prefixes) {
      for (const p of this.prefixes) {
        if (p === "FIRE" || p === "LIGHTNING") bonus += 1;
      }
    }
    if (this.suffixes) {
      for (const s of this.suffixes) {
        if (s === "SAGE" || s === "SHADOW") bonus += 1;
      }
    }
    return bonus;
  }

  get weight() {
    return TomeEquipmentEngine.calculateWeight(this);
  }

  set weight(val) {
    this._weight = val;
  }

  get effectiveAC() {
    return TomeEquipmentEngine.calculateEffectiveAC(this);
  }

  get weaponCategory() {
    return TomeEquipmentEngine.getWeaponCategory(this);
  }

  set weaponCategory(val) {
    this._weaponCategory = val;
  }

  /**
   * 아이템 사용 효과를 해당 시스템 엔진으로 위임하여 실행합니다.
   * @param {Object} player - 플레이어 인스턴스
   * @param {Function} addLogEntry - 로그 출력 콜백
   * @param {Object} game - Game 인스턴스
   * @returns {boolean}
   */
  applyUseEffect(player, addLogEntry = null, game = null) {
    // 디바이스 계열 (Wand, Staff, Rod)
    if (
      this.tval === 65 || this.tval === 55 || this.tval === 66 || this.tval === 67 ||
      this.type === 'WAND' || this.type === 'STAFF' || this.type === 'ROD'
    ) {
      return TomeDeviceEngine.useDevice(this, player, game, addLogEntry);
    }

    // 소모품 계열 (Potion, Scroll, Flask, Food, Core)
    return TomeConsumableEngine.useConsumable(this, player, game, addLogEntry);
  }
}
