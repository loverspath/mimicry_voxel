/**
 * @module Player
 * @category entities
 * @description 플레이어 엔티티 모델 (Zero-Logic 순수 데이터 컴포넌트).
 *              스탯/저항/광원 계산은 UnifiedTraitEngine 및 PlayerStatCalculator에,
 *              의태 스킬 관리는 MonsterSpellFactory 및 TomeSpellEngine에 100% 위임합니다.
 * @purity Data Model / State Store
 * @dependencies Tags.js, MonsterRegistry.js, Perks.js, Item.js, Skills.js, MimicBody.js, TraceLogger.js, PlayerStatCalculator.js, UnifiedTraitEngine.js, VisionLightingEngine.js, MonsterSpellFactory.js, TomeFlagResolver.js, StatusEffectEngine.js
 * @exports Player
 */

import { PREFIX_TAGS, SUFFIX_TAGS, ELEMENT_METADATA } from './Tags.js';
import { getSpeciesConfig, MONSTER_SPECIES, normalizeCoreName, getSpeciesKeyByName } from './MonsterRegistry.js';
import { MONSTER_PERKS } from './Perks.js';
import { Item } from './Item.js';
import { CORE_SKILL_TREES } from '../core/Skills.js';
import { MimicBody, WEAPON_REQUIREMENT_CONFIG } from './MimicBody.js';
import { TraceLogger } from '../core/TraceLogger.js';
import { PlayerStatCalculator } from '../systems/PlayerStatCalculator.js';
import { MonsterSpellFactory } from '../systems/MonsterSpellFactory.js';
import { UnifiedTraitEngine } from '../systems/UnifiedTraitEngine.js';
import { VisionLightingEngine } from '../systems/VisionLightingEngine.js';
import { TomeFlagResolver } from '../systems/TomeFlagResolver.js';
import { StatusEffectEngine } from '../systems/StatusEffectEngine.js';

const DEFAULT_SPECIES = 'MON_NOVICE_WARRIOR';

export class Player {
  /**
   * Initialize the player entity.
   * @param {number} x - Starting X position
   * @param {number} y - Starting Y position
   * @param {string} startingCoreType - Initial species core
   */
  constructor(x, y, startingCoreType = DEFAULT_SPECIES) {
    this.x = x;
    this.y = y;
    this.isPlayer = true;
    this.name = 'Player';
    
    this._isDirty = true;
    this._statCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    this._statBreakdownCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    
    // Instantiate permanent Mimic Body container
    this.body = new MimicBody(this);
    
    // Retrieve species config from central registry
    const config = getSpeciesConfig(startingCoreType);
    
    this.mimicCore = {
      name: config.name,
      char: config.char,
      baseColor: config.baseColor,
      flashColor: config.flashColor,
      flashInterval: config.flashInterval,
      flashDuration: config.flashDuration,
      lightBonus: config.lightBonus || 0,
      coreType: config.coreType,
      fusionLevel: 0
    };

    const isStartingHuman = (
      startingCoreType === 'MON_NOVICE_WARRIOR' ||
      startingCoreType === 'HUMAN' ||
      config.coreType === 'MON_NOVICE_WARRIOR' ||
      config.name === 'Novice warrior' ||
      config.name === '인간 여행자'
    );

    this.char = isStartingHuman ? '@' : (this.mimicCore.char || '@');
    this.color = isStartingHuman ? '#34d399' : (this.mimicCore.baseColor || '#34d399');
    
    // RPG Level and Progression
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 50;

    // Use species config's base stats
    this.baseStats = this.body.baseStats;

    // Equipment Slots
    this.equipment = {
      weapon: null,
      shield: null,
      bow: null,
      quiver: null,
      armor: null,
      helmet: null,
      gloves: null,
      boots: null,
      cloak: null,
      subCore1: null,
      subCore2: null,
      ring1: null,
      ring2: null,
      amulet: null
    };

    this.equippedLamp = null;
    this.inventory = [];
    this.energy = 0;
    this.autoFireEnabled = true;
    
    this.legacyStats = this.body.legacyStats;

    // Innate Active Skills & Action Trackers
    this.activeSkills = MonsterSpellFactory.createInnateSkills(this.mimicCore.coreType || this.mimicCore.name);
    this.skillTrackers = {};
    this.attackCount = 0;
    
    this.manaShield = 0;
    this.manaShieldDuration = 0;
    this.selectedBreathElement = null;

    // Status & Buff State Store (StatusEffectEngine)
    this.statuses = {};
    this.debuffs = StatusEffectEngine.createLegacyDebuffsProxy(this);

    this.stats = {
      hp: this.getMaxHp(),
      maxHp: this.getMaxHp()
    };

    this.rangedCooldownTracker = 0;
    this.animationTime = 0;
    this.initializeStartingInventory();
  }

  get lightRange() {
    return this._lightRange !== undefined ? this._lightRange : UnifiedTraitEngine.calculateLightRadius(this, 1);
  }

  set lightRange(val) {
    this._lightRange = typeof val === 'number' && Number.isFinite(val) ? Math.max(1, val) : UnifiedTraitEngine.calculateLightRadius(this, 1);
  }

  getRangedCooldown(weapon) {
    if (!weapon) return 1;
    let baseCd = 2;
    const name = (weapon.name || "").toUpperCase();
    if (name.includes('HEAVY') || name.includes('중형')) baseCd = 4;
    else if (name.includes('LONGBOW') || name.includes('장궁') || name.includes('LIGHT') || name.includes('경량')) baseCd = 3;
    else if (name.includes('SLING') || name.includes('슬링')) baseCd = 2;

    const archeryLvl = this.body ? this.body.getWeaponMasteryLevel('ARCHERY') : 1;
    const reduction = Math.floor((archeryLvl - 1) / 2);
    return Math.max(1, baseCd - reduction);
  }

  getRangedShotsPerRound(weapon) {
    let shots = 1;
    const dex = this.getEffectiveStat('dex');
    if (this.dexMod >= 1 || dex >= 14) shots += 1;
    if (this.dexMod >= 3 || dex >= 22) shots += 1;
    return shots;
  }

  toggleAutoFire() {
    this.autoFireEnabled = !this.autoFireEnabled;
    return this.autoFireEnabled;
  }

  markDirty(reason = "이유 미상") {
    this._isDirty = true;
    this._statCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    this._statBreakdownCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    TraceLogger.log('CACHE', `플레이어 스탯 캐시 만료 (Dirty 마킹) | 사유: ${reason}`);
  }

  getEffectiveStatWithBreakdown(name) {
    return PlayerStatCalculator.calculateEffectiveStatWithBreakdown(this, name);
  }

  getEffectiveStat(name) {
    return this.getEffectiveStatWithBreakdown(name).finalValue;
  }

  get strMod() { return Math.floor(this.getEffectiveStat('str') / 10); }
  get intMod() { return Math.floor(this.getEffectiveStat('int') / 10); }
  get wisMod() { return Math.floor(this.getEffectiveStat('wis') / 10); }
  get dexMod() { return Math.floor(this.getEffectiveStat('dex') / 10); }
  get conMod() { return Math.floor(this.getEffectiveStat('con') / 10); }
  get chrMod() { return Math.floor(this.getEffectiveStat('chr') / 10); }
  get chaMod() { return Math.floor(this.getEffectiveStat('chr') / 10); }

  get proficiencyBonus() {
    return Math.floor((this.level - 1) / 4) + 2;
  }

  getCombinedPerks() {
    return Array.from(TomeFlagResolver.collectFlagsFromEntity(this));
  }

  compileActiveTags() {
    return this.body.compileActiveTags();
  }

  getPerkEffectMultiplier(key) {
    let multiplier = 1.0;
    const perks = this.getCombinedPerks();
    for (let perkId of perks) {
      const perk = MONSTER_PERKS[perkId];
      if (perk && perk.effects && perk.effects[key] !== undefined) {
        multiplier *= perk.effects[key];
      }
    }
    return multiplier;
  }

  getCombinedResistances(activeTags = null) {
    const resistances = new Set();
    const tags = activeTags || this.compileActiveTags();
    const baseElements = ["FIRE", "COLD", "LIGHTNING", "ACID"];

    for (const element in ELEMENT_METADATA) {
      const tagKey = `${element}_RESIST`;
      const hasDirectResist = (tags[tagKey] || 0) > 0;
      const hasGeneralElementalResist = baseElements.includes(element) && (tags["ELEMENTAL_RESIST"] || 0) > 0;

      if (hasDirectResist || hasGeneralElementalResist) {
        resistances.add(element);
      }
    }

    if ((tags["PHYS_RESIST"] || 0) > 0) resistances.add("PHYSICAL");

    const coreConfig = getSpeciesConfig(this.mimicCore?.coreType);
    const flags = (coreConfig && coreConfig.perks) || [];
    if (flags.includes('IM_FIRE') || flags.includes('RES_FIRE') || flags.includes('FIRE_RESISTANCE')) resistances.add('FIRE');
    if (flags.includes('IM_COLD') || flags.includes('RES_COLD') || flags.includes('COLD_RESISTANCE')) resistances.add('COLD');
    if (flags.includes('IM_ELEC') || flags.includes('RES_ELEC') || flags.includes('LIGHTNING_RESISTANCE')) resistances.add('LIGHTNING');
    if (flags.includes('IM_ACID') || flags.includes('RES_ACID') || flags.includes('ACID_RESISTANCE')) resistances.add('ACID');

    return Array.from(resistances);
  }

  get canFly() {
    return UnifiedTraitEngine.getStatusImmunities(this).canFly || this.body.mutations.includes('SPEEDY_FLIGHT');
  }

  getResistancePercent(element) {
    return UnifiedTraitEngine.getElementalTrait(this, element).resistancePercent / 100;
  }

  getFlatDamageReduction(activeTags = null) {
    return PlayerStatCalculator.calculateFlatDamageReduction(this, activeTags);
  }

  getLifestealPercent() {
    const activeTags = this.compileActiveTags();
    const stacks = activeTags["LIFESTEAL"] || 0;
    return stacks * 5;
  }

  getElementalDamageBonuses() {
    const bonuses = {};
    for (const element in ELEMENT_METADATA) {
      bonuses[element] = 0;
    }

    for (let key in this.equipment) {
      const gear = this.equipment[key];
      if (gear && gear.prefixes) {
        for (let p of gear.prefixes) {
          const tag = PREFIX_TAGS[p];
          if (tag && tag.element && bonuses[tag.element] !== undefined) {
            bonuses[tag.element] += 3;
          }
        }
      }
    }
    return bonuses;
  }

  get speed() {
    return PlayerStatCalculator.calculateSpeed(this);
  }

  takeDamage(amount, game) {
    if (this.manaShield && this.manaShield > 0 && this.manaShieldDuration > 0) {
      const shieldAbsorb = Math.min(amount, this.manaShield);
      this.manaShield -= shieldAbsorb;
      amount -= shieldAbsorb;
      if (game && shieldAbsorb > 0) {
        game.addLogEntry(`[Combat] 👼 마나 실드가 ${shieldAbsorb}의 피해를 경감시켰습니다! (실드 잔여량: ${this.manaShield})`, `combat`);
      }
    }
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    return this.stats.hp <= 0;
  }

  getMaxHp() {
    return PlayerStatCalculator.calculateMaxHp(this);
  }

  gainXp(amount) {
    this.xp += amount;
    let leveledUp = false;
    const logs = [];

    const getGrowth = (lvl, statName) => {
      const coreName = this.mimicCore.name;
      const configKey = getSpeciesKeyByName(coreName);
      let coreBase = 8;
      let coreMax = 150;

      if (configKey) {
        const config = getSpeciesConfig(configKey);
        if (config) {
          coreBase = config.coreBase[statName] !== undefined ? config.coreBase[statName] : 8;
          coreMax = config.coreMax[statName] !== undefined ? config.coreMax[statName] : 150;
        }
      }

      const phi = Math.pow(Math.log(lvl) / Math.log(100), 1.5);
      return Math.floor((coreMax - coreBase) * (isNaN(phi) ? 0 : phi));
    };

    while (this.xp >= this.xpNeeded) {
      const prevL = this.level;
      this.xp -= this.xpNeeded;
      this.level += 1;
      this.xpNeeded = 50 + (this.level * this.level * 15);

      const statsGrown = {};
      for (const key in this.baseStats) {
        const diff = getGrowth(this.level, key) - getGrowth(prevL, key);
        this.baseStats[key] = Math.min(999, this.baseStats[key] + diff);
        statsGrown[key] = diff;
      }

      leveledUp = true;
      this.markDirty("레벨업");
      
      this.stats.maxHp = this.getMaxHp();
      this.stats.hp = this.stats.maxHp;

      logs.push(`[Level Up] 레벨 ${this.level} 달성! (HP: ${this.stats.maxHp}/${this.stats.maxHp})`);
      logs.push(`능력치 상승: 힘 +${statsGrown.str}, 민첩 +${statsGrown.dex}, 생명력 +${statsGrown.con}, 지능 +${statsGrown.int}`);
    }

    return { leveledUp, logs };
  }

  pickupItem(item) {
    if (item.type === 'POTION' || item.type === 'SCROLL') {
      const existing = this.inventory.find(i => i.type === item.type && i.name === item.name);
      if (existing) {
        existing.count = (existing.count || 1) + (item.count || 1);
        return;
      }
    }
    item.count = item.count || 1;
    this.inventory.push(item);
  }

  isItemEquipped(item) {
    if (!item) return false;
    if (this.equippedLamp === item) return true;
    for (const key in this.equipment) {
      if (this.equipment[key] === item) return true;
    }
    return false;
  }

  equipItem(item) {
    this.markDirty("장비 장착: " + item.name);
    if (item.slotType === 'BOW' || item.char === '}' || item.type === 'BOW') {
      this.equipment.bow = item;
    } else if (item.slotType === 'QUIVER' || item.char === '{' || item.type === 'QUIVER') {
      this.equipment.quiver = item;
    } else if (item.slotType === 'WEAPON' || item.type === 'WEAPON') {
      this.equipment.weapon = item;
    } else if (item.slotType === 'SHIELD' || item.type === 'SHIELD' || item.char === ')') {
      this.equipment.shield = item;
    } else if (item.slotType === 'ARMOR' || item.type === 'ARMOR') {
      this.equipment.armor = item;
    } else if (item.slotType === 'HELMET' || item.type === 'HELMET') {
      this.equipment.helmet = item;
    } else if (item.slotType === 'GLOVES' || item.type === 'GLOVES') {
      this.equipment.gloves = item;
    } else if (item.slotType === 'BOOTS' || item.type === 'BOOTS') {
      this.equipment.boots = item;
    } else if (item.slotType === 'CLOAK' || item.type === 'CLOAK' || item.char === '(') {
      this.equipment.cloak = item;
    } else if (item.slotType === 'RING' || item.type === 'RING') {
      if (!this.equipment.ring1) {
        this.equipment.ring1 = item;
      } else if (!this.equipment.ring2) {
        this.equipment.ring2 = item;
      } else {
        this.equipment.ring1 = item;
      }
    } else if (item.slotType === 'AMULET' || item.type === 'AMULET') {
      this.equipment.amulet = item;
    } else if (item.type === 'LAMP' || item.slotType === 'LIGHT') {
      this.equippedLamp = item;
    }
    
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = this.getMaxHp();
    if (oldMaxHp > 0) {
      this.stats.hp = Math.max(1, Math.min(this.stats.maxHp, Math.round(this.stats.hp * (this.stats.maxHp / oldMaxHp))));
    } else {
      this.stats.hp = this.stats.maxHp;
    }
  }

  equipSubCore1(item) {
    this.markDirty("보조 코어1 장착: " + item.name);
    this.equipment.subCore1 = item;
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = this.getMaxHp();
    if (oldMaxHp > 0) {
      this.stats.hp = Math.max(1, Math.min(this.stats.maxHp, Math.round(this.stats.hp * (this.stats.maxHp / oldMaxHp))));
    } else {
      this.stats.hp = this.stats.maxHp;
    }
  }

  unequipSubCore1() {
    this.markDirty("보조 코어1 해제");
    this.equipment.subCore1 = null;
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = this.getMaxHp();
    if (oldMaxHp > 0) {
      this.stats.hp = Math.max(1, Math.min(this.stats.maxHp, Math.round(this.stats.hp * (this.stats.maxHp / oldMaxHp))));
    } else {
      this.stats.hp = this.stats.maxHp;
    }
  }

  equipSubCore2(item) {
    this.markDirty("보조 코어2 장착: " + item.name);
    this.equipment.subCore2 = item;
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = this.getMaxHp();
    if (oldMaxHp > 0) {
      this.stats.hp = Math.max(1, Math.min(this.stats.maxHp, Math.round(this.stats.hp * (this.stats.maxHp / oldMaxHp))));
    } else {
      this.stats.hp = this.stats.maxHp;
    }
  }

  unequipSubCore2() {
    this.markDirty("보조 코어2 해제");
    this.equipment.subCore2 = null;
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = this.getMaxHp();
    if (oldMaxHp > 0) {
      this.stats.hp = Math.max(1, Math.min(this.stats.maxHp, Math.round(this.stats.hp * (this.stats.maxHp / oldMaxHp))));
    } else {
      this.stats.hp = this.stats.maxHp;
    }
  }

  unequipItem(item) {
    if (!this.isItemEquipped(item)) return false;
    this.markDirty("장비 해제: " + (item ? item.name : "아이템"));
    if (this.equipment.bow === item) {
      this.equipment.bow = null;
    } else if (this.equipment.quiver === item) {
      this.equipment.quiver = null;
    } else if ((item.slotType === 'WEAPON' || item.type === 'WEAPON') && this.equipment.weapon === item) {
      this.equipment.weapon = null;
    } else if ((item.slotType === 'SHIELD' || item.type === 'SHIELD') && this.equipment.shield === item) {
      this.equipment.shield = null;
    } else if ((item.slotType === 'ARMOR' || item.type === 'ARMOR') && this.equipment.armor === item) {
      this.equipment.armor = null;
    } else if ((item.slotType === 'HELMET' || item.type === 'HELMET') && this.equipment.helmet === item) {
      this.equipment.helmet = null;
    } else if ((item.slotType === 'GLOVES' || item.type === 'GLOVES') && this.equipment.gloves === item) {
      this.equipment.gloves = null;
    } else if ((item.slotType === 'BOOTS' || item.type === 'BOOTS') && this.equipment.boots === item) {
      this.equipment.boots = null;
    } else if ((item.slotType === 'CLOAK' || item.type === 'CLOAK') && this.equipment.cloak === item) {
      this.equipment.cloak = null;
    } else if (item.slotType === 'RING' || item.type === 'RING') {
      if (this.equipment.ring1 === item) {
        this.equipment.ring1 = null;
      } else if (this.equipment.ring2 === item) {
        this.equipment.ring2 = null;
      }
    } else if ((item.slotType === 'AMULET' || item.type === 'AMULET') && this.equipment.amulet === item) {
      this.equipment.amulet = null;
    } else if ((item.type === 'LAMP' || item.slotType === 'LIGHT') && this.equippedLamp === item) {
      this.equippedLamp = null;
    } else if (this.equipment.subCore1 === item) {
      this.equipment.subCore1 = null;
    } else if (this.equipment.subCore2 === item) {
      this.equipment.subCore2 = null;
    }
    
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = this.getMaxHp();
    if (oldMaxHp > 0) {
      this.stats.hp = Math.max(1, Math.min(this.stats.maxHp, Math.round(this.stats.hp * (this.stats.maxHp / oldMaxHp))));
    } else {
      this.stats.hp = this.stats.maxHp;
    }
  }

  getTotalAC() {
    let totalAC = 10;
    if (this.mimicCore) {
      const configKey = this.mimicCore.coreType || this.mimicCore.name;
      const config = getSpeciesConfig(configKey);
      if (config && typeof config.baseAC === 'number') {
        totalAC = config.baseAC;
      }
    }

    totalAC += (this.dexMod || 0);

    const activeTags = this.compileActiveTags ? this.compileActiveTags() : {};
    totalAC += (activeTags["EVASION_BOOST"] || 0);
    totalAC += (activeTags["DEFENSE_BOOST"] || 0);

    for (const key in this.equipment) {
      if (key === 'subCore1' || key === 'subCore2') continue;
      const gear = this.equipment[key];
      if (gear) {
        if (typeof gear.baseAC === 'number') {
          totalAC += gear.baseAC;
        }
        if (typeof gear.upgradeLevel === 'number') {
          totalAC += gear.upgradeLevel;
        }
      }
    }

    return Math.max(1, totalAC);
  }

  getBaseToHitScore() {
    const weapon = this.equipment?.weapon;
    const weaponToHit = (weapon ? (weapon.to_h || weapon.toHit || weapon.upgradeLevel || 0) : 0) * 3.0;
    const category = weapon ? (weapon.weaponCategory || "SWORD") : "UNARMED";
    const masteryLvl = this.body ? this.body.getWeaponMasteryLevel(category) : 1;
    const level = this.level || 1;
    const playerDex = this.getEffectiveStat ? this.getEffectiveStat('dex') : (this.stats?.dex || 10);
    const dexBonus = Math.floor((playerDex - 10) * 1.5);
    const masteryBonus = (masteryLvl - 1) * 1.5;
    const activeTags = this.compileActiveTags ? this.compileActiveTags() : {};
    const accBoost = (activeTags["ACCURACY_BOOST"] || 0) * 4;
    return Math.round(50 + (level * 2.0) + dexBonus + weaponToHit + masteryBonus + accBoost);
  }

  getBaseHitChance(targetAC = 10) {
    const bHit = this.getBaseToHitScore();
    const rawHitChance = bHit / (bHit + Math.max(1, targetAC) * 1.0);
    return Math.max(0.05, Math.min(0.95, rawHitChance));
  }

  getKillCount(keyOrType) {
    return this.body ? this.body.getKillCount(keyOrType) : 0;
  }

  recordKill(keyOrType, amount = 1) {
    if (this.body) {
      this.body.recordKill(keyOrType, amount);
    }
  }

  removeItem(item) {
    this.unequipItem(item);
    const index = this.inventory.indexOf(item);
    if (index !== -1) {
      this.inventory.splice(index, 1);
    }
  }

  update(deltaTime) {
    this.animationTime += deltaTime;
    const cycleTime = this.animationTime % (this.mimicCore.flashInterval || 1000);
    if (cycleTime < (this.mimicCore.flashDuration || 100)) {
      this.color = this.mimicCore.flashColor || '#ef4444';
    } else {
      const isStartingHuman = (
        this.mimicCore.coreType === 'MON_NOVICE_WARRIOR' ||
        this.mimicCore.coreType === 'HUMAN' ||
        this.mimicCore.name === 'Novice warrior' ||
        this.mimicCore.name === '인간 여행자'
      );
      this.color = isStartingHuman ? '#34d399' : (this.mimicCore.baseColor || '#34d399');
    }
  }

  move(dx, dy, map) {
    const newX = this.x + dx;
    const newY = this.y + dy;
    if (map.isWalkable(newX, newY)) {
      this.x = newX;
      this.y = newY;
      return true;
    }
    return false;
  }

  normalizeCategory(name) {
    return normalizeCoreName(name);
  }

  getWeaponRequirement() {
    const weapon = this.equipment.weapon;
    const weight = weapon ? (weapon.weight || 0) : 0;
    const config = WEAPON_REQUIREMENT_CONFIG;
    
    const reqStr = Math.max(config.minStrLimit, Math.floor(weight * config.strMultiplier));
    const reqDex = Math.max(config.minDexLimit, Math.floor(weight * config.dexMultiplier));
    
    const currentStr = this.getEffectiveStat('str');
    const currentDex = this.getEffectiveStat('dex');
    
    const isMet = (currentStr >= reqStr && currentDex >= reqDex);
    
    return {
      reqStr,
      reqDex,
      currentStr,
      currentDex,
      isMet,
      weight
    };
  }

  canDetectMonsters() {
    return VisionLightingEngine.canDetectMonsters(this);
  }

  canDetectItems() {
    const cType = this.mimicCore?.coreType || '';
    const name = this.mimicCore?.name || '';
    return cType.includes('GOBLIN') || name.includes('고블린') || cType.includes('HUMAN') || name.includes('인간');
  }

  getMorphMasteryLevel(speciesType = null) {
    const sType = speciesType || this.mimicCore?.coreType || this.mimicCore?.name || 'MON_NOVICE_WARRIOR';
    if (this.body && this.body.getLoreLevel) {
      return this.body.getLoreLevel(sType);
    }
    return 1;
  }

  getInnateSkills() {
    const coreKey = this.mimicCore?.coreType || this.mimicCore?.name || 'MON_NOVICE_WARRIOR';
    return MonsterSpellFactory.createInnateSkills(coreKey);
  }

  castActiveSkill(slotNumber, game, target = null) {
    const skills = this.getInnateSkills();
    const skill = skills.find(s => s.slot === slotNumber);
    if (!skill) {
      if (game && game.addLogEntry) game.addLogEntry(`⚠️ [스킬 슬롯 비어있음] ${slotNumber}번 슬롯에 배정된 스킬이 없습니다.`, 'combat');
      return false;
    }
    return skill.execute(game, this, target);
  }

  getTracker(key, field = 'cooldown') {
    if (!this.skillTrackers) this.skillTrackers = {};
    if (!this.skillTrackers[key]) this.skillTrackers[key] = {};
    return this.skillTrackers[key][field] || 0;
  }

  setTracker(key, field, value) {
    if (!this.skillTrackers) this.skillTrackers = {};
    if (!this.skillTrackers[key]) this.skillTrackers[key] = {};
    this.skillTrackers[key][field] = value;
  }

  hasEquipmentTag(tagName) {
    return TomeFlagResolver.hasFlag(this, tagName);
  }

  decrementCooldown(key) {
    let amount = 1;
    const activeTags = this.compileActiveTags();
    const quickcastStacks = activeTags["QUICKCAST"] || 0;
    if (quickcastStacks > 0) {
      amount = 1 + quickcastStacks;
    }
    let current = this.getTracker(key, 'cooldown');
    if (current > 0) {
      this.setTracker(key, 'cooldown', Math.max(0, current - amount));
      return true;
    }
    return false;
  }

  incrementCount(key, threshold) {
    let current = this.getTracker(key, 'count');
    let next = current + 1;
    if (next >= threshold) {
      this.setTracker(key, 'count', 0);
      return true;
    }
    this.setTracker(key, 'count', next);
    return false;
  }

  initializeStartingInventory() {
    this.inventory = [];
    this.equipment = { weapon: null, bow: null, quiver: null, armor: null, helmet: null, subCore1: null, subCore2: null, ring1: null, ring2: null, amulet: null };
    this.equippedLamp = null;
    
    const shortSword = new Item(this.x, this.y, 'WEAPON', '|', '#cbd5e1', 'Short Sword', 0, 'WEAPON', { str: 1, dex: 1 }, '1d7', null, [], [], [], "A small, handy blade, ideal for close combat and swift thrusts.");
    shortSword.toHit = 2;
    shortSword.toDamage = 2;
    shortSword.weaponCategory = 'SWORD';

    const shortbow = new Item(this.x, this.y, 'BOW', '}', '#d97706', 'Shortbow', 0, 'BOW', { dex: 2 }, '1d4', null, [], [], [], "A flexible wooden bow crafted for firing arrows from a safe distance.");
    shortbow.range = 5;
    shortbow.multiplier = 2.0;
    shortbow.weaponCategory = 'ARCHERY';

    const arrows = new Item(this.x, this.y, 'QUIVER', '{', '#94a3b8', 'Bundle of Arrows', 0, 'QUIVER', {}, '1d4', null, [], [], [], "A bundle of 30 standard flight arrows tipped with iron points.");
    arrows.count = 30;

    const softLeather = new Item(this.x, this.y, 'ARMOR', '[', '#b45309', 'Soft Leather Armour', 0, 'ARMOR', { con: 1 }, null, null, [], [], [], "Tanned animal hide offering basic protection without restricting movement.");
    softLeather.baseAC = 4;
    softLeather.weight = 4.0;

    const torches = new Item(this.x, this.y, 'LAMP', '~', '#fbbf24', 'Wooden Torch', 1, 'LIGHT', {}, null, null, [], [], [], "A resin-soaked branch providing basic illumination in dark dungeon depths.");
    torches.count = 3;

    const curePotion = new Item(this.x, this.y, 'POTION', '!', '#f43f5e', 'Potion of Cure Light Wounds', 0, null, {}, null, null, [], [], [], "A soothing draught that heals minor injuries and calms bodily pain.");
    curePotion.count = 3;
    curePotion.potionEffect = { type: 'HEAL', amount: 35 };

    const foodRation = new Item(this.x, this.y, 'FOOD', ',', '#d97706', 'Ration of Food', 0, null, {}, null, null, [], [], [], "Lightweight and filling bread and dried meat suitable for dungeon journeys.");
    foodRation.count = 2;

    this.equipment.weapon = shortSword;
    this.equipment.bow = shortbow;
    this.equipment.quiver = arrows;
    this.equipment.armor = softLeather;
    this.equippedLamp = torches;

    this.inventory.push(shortSword, shortbow, arrows, softLeather, torches, curePotion, foodRation);
  }

  useCoreAsFood(item, game) {
    if (!item || item.type !== 'CORE') return false;

    const speciesType = item.coreType || DEFAULT_SPECIES;
    const config = getSpeciesConfig(speciesType);
    if (!config) return false;

    this.energy -= 100;

    const baseStatSum = (config.coreBase.str || 8) + (config.coreBase.dex || 8) + (config.coreBase.con || 8) + (config.coreBase.int || 8);
    const eatXp = Math.floor(config.xpValue * (1 + baseStatSum / 50));

    const coreLvl = item.upgradeLevel || 1;
    const consumeLore = Math.max(1, Math.floor((config.xpValue / 5) * (1 + Math.max(0, coreLvl - this.level) * 0.2)));

    game.addLogEntry(`[Mutation] 🥩 무정형 미믹의 육체로 [${item.name}]을(를) 흡수/섭취하였습니다! (1턴 소비)`, `loot`);

    const xpRes = this.gainXp(eatXp);
    xpRes.logs.forEach(l => game.addLogEntry(l, `loot`));

    const loreLogs = this.body.gainLoreXp(speciesType, consumeLore);
    loreLogs.forEach(l => game.addLogEntry(l, `loot`));
    game.addLogEntry(`[System] ${config.name} 로어 숙련도 +${consumeLore} 가산!`, `system`);

    const loreLvl = this.body.getLoreLevel(speciesType);

    const badMutations = ["FRAIL_BODY", "SLOW_REFLEX", "MANA_LEAK", "DULL_MIND", "HEAVY_SOUL"];
    const activeBadMutations = this.body.mutations.filter(m => badMutations.includes(m));
    if (activeBadMutations.length > 0) {
      const purifyChance = 0.10 + (loreLvl * 0.05);
      if (Math.random() < purifyChance) {
        const targetToPurify = activeBadMutations[Math.floor(Math.random() * activeBadMutations.length)];
        const targetIdx = this.body.mutations.indexOf(targetToPurify);
        if (targetIdx !== -1) {
          this.body.mutations.splice(targetIdx, 1);
          const perkData = MONSTER_PERKS[targetToPurify];
          const korName = perkData ? perkData.name : targetToPurify;
          game.addLogEntry(`[Purify] ✨ 정화 성공! 코어의 강력한 정제 효과로 바디 내의 유해한 [${korName}] 돌연변이가 깨끗이 치유/소멸되었습니다!`, `loot`);
        }
      }
    }

    const mutationChance = 0.15 + (loreLvl - 1) * 0.03;
    let didGetGoodMutation = false;
    
    if (Math.random() < mutationChance) {
      const eligiblePerks = [];
      if (config.perks) {
        config.perks.forEach(perkId => {
          if (MONSTER_PERKS[perkId] && !eligiblePerks.includes(perkId)) {
            if (!this.body.mutations.includes(perkId) && !badMutations.includes(perkId)) {
              eligiblePerks.push(perkId);
            }
          }
        });
      }

      if (eligiblePerks.length > 0) {
        const randomPerkId = eligiblePerks[Math.floor(Math.random() * eligiblePerks.length)];
        if (this.body.mutations.length >= 4) {
          const evicted = this.body.mutations.shift();
          const evictedPerk = MONSTER_PERKS[evicted];
          const evictedName = evictedPerk ? evictedPerk.name : evicted;
          game.addLogEntry(`[Mutation] ⚠️ 돌연변이 슬롯 초과! 기존 돌연변이 [${evictedName}]가 밀려나며 소멸했습니다.`, `combat`);
        }
        
        this.body.mutations.push(randomPerkId);
        didGetGoodMutation = true;
        const perkData = MONSTER_PERKS[randomPerkId];
        const perkName = perkData ? perkData.name : randomPerkId;
        const perkDesc = perkData ? perkData.desc : "";
        game.addLogEntry(`[Mutation] ✨ 돌연변이 성공! 몬스터의 태생 특성 [${perkName}] (${perkDesc}) 유전자를 영구 본체 바디에 각인시켰습니다!`, `loot`);
      }
    }

    if (!didGetGoodMutation) {
      game.addLogEntry(`[Mutation] 긍정적 돌연변이 각인에 실패하였습니다. (숙련도가 높을수록 성공률이 올라갑니다.)`, `system`);
    }

    const effectiveInt = this.getEffectiveStat("int");
    const effectiveCon = this.getEffectiveStat("con");
    const negativeMutationChance = Math.max(0.02, 0.15 - (effectiveInt + effectiveCon) / 100);
    
    if (Math.random() < negativeMutationChance) {
      const chosenBad = badMutations[Math.floor(Math.random() * badMutations.length)];
      if (!this.body.mutations.includes(chosenBad)) {
        if (this.body.mutations.length >= 4) {
          const evicted = this.body.mutations.shift();
          const evictedPerk = MONSTER_PERKS[evicted];
          const evictedName = evictedPerk ? evictedPerk.name : evicted;
          game.addLogEntry(`[Mutation] ⚠️ 돌연변이 슬롯 초과! 기존 돌연변이 [${evictedName}]가 밀려나며 소멸했습니다.`, `combat`);
        }
        
        this.body.mutations.push(chosenBad);
        const badPerk = MONSTER_PERKS[chosenBad];
        const badName = badPerk ? badPerk.name : chosenBad;
        const badDesc = badPerk ? badPerk.desc : "";
        game.addLogEntry(`[Mutation] 💀 변이 실패... 코어의 불안정한 마력이 역류하여 바디에 유해한 [${badName}] 변이가 침투하여 각인되었습니다! (${badDesc})`, `combat`);
      }
    }

    this.removeItem(item);
    return true;
  }

  tickDebuffs(addLogEntry) {
    if (!this.statuses && !this.debuffs) return false;
    StatusEffectEngine.tickStatuses(this, { addLogEntry });
    return this.stats.hp <= 0;
  }

  tickOverload(addLogEntry) {
    if (this.body.getCurrentWeight() >= this.body.getMaxWeightLimit()) {
      this.overloadTick = (this.overloadTick || 0) + 1;
      if (this.overloadTick >= 10) {
        this.overloadTick = 0;
        const scratchDmg = 2;
        this.stats.hp = Math.max(0, this.stats.hp - scratchDmg);
        addLogEntry(
          `[Weight] ⚠️ 과적 상태로 인한 찰과상 피해! 척추와 근육이 크게 혹사당해 체력 2가 감소했습니다. (HP: ${this.stats.hp}/${this.stats.maxHp})`,
          `combat`
        );
        if (this.stats.hp <= 0) return true;
      }
    } else {
      this.overloadTick = 0;
    }
    return false;
  }

  doSwapMainCore(item, addLogEntry) {
    if (item.type !== 'CORE') return;

    const prevCoreName = this.mimicCore.name;

    const getGrowthDelta = (level, statKey, speciesName) => {
      const config = getSpeciesConfig(speciesName);
      const base = config.coreBase[statKey] || 8;
      const max = config.coreMax[statKey] || 150;
      const phi = (Math.log(level) / Math.log(100)) ** 1.5;
      return Math.floor((max - base) * (isNaN(phi) ? 0 : phi));
    };

    const inheritRatio = 0.15 + (this.mimicCore.fusionLevel || 0) * 0.015;
    const inherited = {};
    for (const key in this.legacyStats) {
      const growthAtLevel = getGrowthDelta(this.level, key, this.mimicCore.name);
      const gain = Math.floor(growthAtLevel * inheritRatio);
      this.legacyStats[key] = (this.legacyStats[key] || 0) + gain;
      inherited[key] = gain;
    }

    const prevFusionLevel = this.mimicCore.fusionLevel || 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 50;

    const prevPrefixes = this.mimicCore.prefixes ? [...this.mimicCore.prefixes] : [];
    const prevSuffixes = this.mimicCore.suffixes ? [...this.mimicCore.suffixes] : [];
    const prevSpecialTags = this.mimicCore.specialTags ? [...this.mimicCore.specialTags] : [];

    const config = getSpeciesConfig(item.coreType);
    this.mimicCore = {
      name: config.name,
      char: config.char,
      baseColor: config.baseColor,
      flashColor: config.flashColor,
      flashInterval: config.flashInterval,
      flashDuration: config.flashDuration,
      lightBonus: config.lightBonus || 0,
      coreType: config.coreType,
      prefixes: item.prefixes ? [...item.prefixes] : [],
      suffixes: item.suffixes ? [...item.suffixes] : [],
      specialTags: item.specialTags ? [...item.specialTags] : [],
      fusionLevel: item.fusionLevel || 0,
    };
    const isHumanCore = (
      config.coreType === 'MON_NOVICE_WARRIOR' ||
      config.coreType === 'HUMAN' ||
      config.name === 'Novice warrior' ||
      config.name === '인간 여행자'
    );
    this.char = isHumanCore ? '@' : (this.mimicCore.char || '@');
    this.color = isHumanCore ? '#34d399' : (this.mimicCore.baseColor || '#34d399');
    this.activeSkills = MonsterSpellFactory.createInnateSkills(this.mimicCore.coreType || this.mimicCore.name);

    if (this.equipment.subCore1 === item) this.equipment.subCore1 = null;
    if (this.equipment.subCore2 === item) this.equipment.subCore2 = null;
    this.removeItem(item);

    const prevConfig = getSpeciesConfig(prevCoreName);
    if (prevConfig) {
      const returnedCore = new Item(
        this.x, this.y, 'CORE',
        '*', prevConfig.baseColor,
        `${prevConfig.name} 코어`,
        0, null, {}, null, prevConfig.coreType,
        prevPrefixes, prevSuffixes, prevSpecialTags
      );
      returnedCore.fusionLevel = prevFusionLevel;
      this.pickupItem(returnedCore);
    }

    this.stats.maxHp = this.getMaxHp();
    this.stats.hp = this.stats.maxHp;

    addLogEntry(`🧬 [환생] ${this.mimicCore.name}(으)로 메인 코어를 교체했습니다!`, `loot`);
    if (prevConfig) {
      addLogEntry(`[System] 기존 장착 중이던 [${prevCoreName}] 코어가 소지품으로 반환되었습니다.`, `system`);
    }
    addLogEntry(
      `[System] 레벨이 1로 리셋되었으며, 누적 추가 스탯의 ${(inheritRatio * 100).toFixed(1)}%가 영구 보존되었습니다!`,
      `loot`
    );
    addLogEntry(
      `영구 보존량: 힘 +${inherited.str}, 민첩 +${inherited.dex}, 생명력 +${inherited.con}, 지능 +${inherited.int}`,
      `loot`
    );
  }
}
