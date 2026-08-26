/**
 * @module Monster
 * @category entities
 * @description 몬스터 엔티티 모델 (Zero-Logic 순수 데이터 컴포넌트).
 *              스펠/공격 연산은 TomeSpellEngine에, 스탯/저항/플래그 판정은 TomeFlagResolver 및 UnifiedTraitEngine에 위임합니다.
 * @purity Data Model / State Store
 * @dependencies Tags.js, MonsterRegistry.js, Item.js, Perks.js, Skills.js, TraceLogger.js, MonsterAISystem.js, TomeFlagResolver.js, UnifiedTraitEngine.js, TomeSpellEngine.js, StatusEffectEngine.js
 * @exports MONSTER_ATTACK_SKILL_NAMES, Monster
 */

import { PREFIX_TAGS, SUFFIX_TAGS, getChromaticColor } from './Tags.js';
import { getSpeciesConfig, MONSTER_GROWTH_PATTERNS, normalizeCoreName } from './MonsterRegistry.js';
import { Item } from './Item.js';
import { MONSTER_PERKS } from './Perks.js';
import { CORE_SKILL_TREES } from '../core/Skills.js';
import { TraceLogger } from '../core/TraceLogger.js';
import { MonsterAISystem } from '../systems/MonsterAISystem.js';
import { TomeFlagResolver } from '../systems/TomeFlagResolver.js';
import { UnifiedTraitEngine } from '../systems/UnifiedTraitEngine.js';
import { TomeSpellEngine } from '../systems/TomeSpellEngine.js';
import { PlayerStatCalculator } from '../systems/PlayerStatCalculator.js';
import { StatusEffectEngine } from '../systems/StatusEffectEngine.js';
import { clampMonsterHp } from '../systems/DungeonValueBudgetEngine.js';

export const MONSTER_ATTACK_SKILL_NAMES = Object.freeze({
  AMBUSH: "암습",
  PUSH: "밀쳐내기",
  PULVERIZE: "파괴적분쇄",
  STRONG: "강한공격",
  VAMP: "흡혈격노"
});

export class Monster {
  /**
   * Initialize a monster entity.
   * @param {number} x - Map X position
   * @param {number} y - Map Y position
   * @param {string} type - Monster type or key (e.g. 'SLIME', 'MON_HILL_ORC', 'Ancient Red Dragon')
   * @param {number} level - Level of the monster
   * @param {Array<string>} prefixes - Rarity prefix tags
   * @param {Array<string>} suffixes - Rarity suffix tags
   */
  constructor(x, y, type, level = 1, prefixes = [], suffixes = []) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.energy = 0; // Initialize energy to 0 for turn system
    this.batFleeTurns = 0; // Flee turn counter for Bat AI
    this.breathCooldown = 0; // Turn cooldown for breaths/spells
    this.giantBloodCooldown = 0; // Cooldown for giant blood passive
    this.bloodLustTurns = 0;
    this.hasteTurns = 0;
    this.priestHealCooldown = 0;
    this.shamanBuffCooldown = 0;
    this.manaShield = 0;
    this.manaShieldDuration = 0;
    this.prefixes = Array.isArray(prefixes) ? prefixes : [];
    this.suffixes = Array.isArray(suffixes) ? suffixes : [];

    // Ensure valid positive level
    this.level = (isNaN(level) || typeof level !== 'number' || level < 1) ? 1 : level;

    // Retrieve species config from central registry (ToME 851 Master Data)
    const config = getSpeciesConfig(type);

    this.tomeKey = config.coreType || type;
    this.name = config.name;
    this.char = config.char;
    this.color = config.baseColor;
    this.flavorText = config.flavorText || "A creature lurking in the depths of the dungeon.";
    this.description = this.flavorText;

    const coreBase = config.coreBase || { str: 10, dex: 10, con: 10, int: 10, wis: 10, chr: 10, cha: 10 };
    const coreMax = config.coreMax || { str: 150, dex: 150, con: 150, int: 150, wis: 150, chr: 150, cha: 150 };
    const coreBaseHp = config.coreBaseHp || 20;
    this.xpValue = config.xpValue || 20;
    this.baseAC = config.baseAC || 10;
    this.breathElement = config.breathElement || null;

    if (type === 'HUMAN' || config.coreType === 'MON_NOVICE_WARRIOR') {
      this.hasTorch = true;
    }

    // Unified 1.5-power log growth curve scaling
    const phi = Math.pow(Math.log(this.level) / Math.log(100), 1.5);
    const growthCoeff = isNaN(phi) ? 0 : phi;

    this.perks = config.perks || [];
    this.flags = config.flags || config.perks || [];
    this.spells = config.spells || [];
    this.attacks = config.attacks || config.blows || [{ method: "HIT", effect: "HURT", damage: "1d4" }];
    this.blows = config.blows || [{ method: "HIT", effect: "HURT", dice: "1d4" }];

    const normalizedName = normalizeCoreName(type);
    this.skillSets = [config.name];
    if (normalizedName && !this.skillSets.includes(normalizedName)) {
      this.skillSets.push(normalizedName);
    }
    if (this.suffixes) {
      for (const sKey of this.suffixes) {
        if (["WARRIOR", "MAGE", "SHAMAN", "CHAMPION", "CHIEFTAIN", "PRIEST"].includes(sKey)) {
          this.skillSets.push(sKey);
        }
      }
    }

    // Growth pattern
    const gType = config.growthType || 'BALANCED';
    const pattern = MONSTER_GROWTH_PATTERNS[gType] || MONSTER_GROWTH_PATTERNS.BALANCED;

    // Stat weights from perks
    const statWeights = { str: 1.0, int: 1.0, wis: 1.0, dex: 1.0, con: 1.0, chr: 1.0, cha: 1.0 };
    let hpMult = 1.0;
    for (let perkId of this.getActivePerks()) {
      const perk = MONSTER_PERKS[perkId];
      if (perk && perk.effects) {
        if (perk.effects.statWeights) {
          for (let key in perk.effects.statWeights) {
            statWeights[key] *= perk.effects.statWeights[key];
          }
        }
        if (perk.effects.hpMultiplier) {
          hpMult *= perk.effects.hpMultiplier;
        }
      }
    }

    this.stats = {
      str: (coreBase.str || 10) + Math.floor(((coreMax.str || 150) - (coreBase.str || 10)) * growthCoeff * (pattern.str || 1.0) * statWeights.str),
      int: (coreBase.int || 10) + Math.floor(((coreMax.int || 150) - (coreBase.int || 10)) * growthCoeff * (pattern.int || 1.0) * statWeights.int),
      wis: (coreBase.wis || coreBase.int || 10) + Math.floor(((coreMax.wis || coreMax.int || 150) - (coreBase.wis || coreBase.int || 10)) * growthCoeff * (pattern.wis || pattern.int || 1.0) * statWeights.wis),
      dex: (coreBase.dex || 10) + Math.floor(((coreMax.dex || 150) - (coreBase.dex || 10)) * growthCoeff * (pattern.dex || 1.0) * statWeights.dex),
      con: (coreBase.con || 10) + Math.floor(((coreMax.con || 150) - (coreBase.con || 10)) * growthCoeff * (pattern.con || 1.0) * statWeights.con),
      chr: (coreBase.chr || coreBase.cha || 6) + Math.floor(((coreMax.chr || coreMax.cha || 150) - (coreBase.chr || coreBase.cha || 6)) * growthCoeff * (pattern.chr || pattern.cha || 1.0) * statWeights.chr),
      cha: (coreBase.chr || coreBase.cha || 6) + Math.floor(((coreMax.chr || coreMax.cha || 150) - (coreBase.chr || coreBase.cha || 6)) * growthCoeff * (pattern.chr || pattern.cha || 1.0) * statWeights.chr)
    };

    const conGrowth = this.stats.con - (coreBase.con || 10);
    const rawHp = coreBaseHp + conGrowth * 5 + this.level * 2;
    this.stats.maxHp = Math.floor(rawHp * (pattern.hp || 1.0) * hpMult);

    this.stats.str = Math.max(1, Math.min(999, this.stats.str));
    this.stats.dex = Math.max(1, Math.min(999, this.stats.dex));
    this.stats.con = Math.max(1, Math.min(999, this.stats.con));

    this._baseName = config.name;
    this._baseColor = config.baseColor;

    // Unique Monster identification
    this.isUnique = Boolean(
      config.isUnique ||
      (config.flags && config.flags.includes('UNIQUE')) ||
      (config.perks && config.perks.includes('UNIQUE')) ||
      (this.prefixes.includes('LEGENDARY') && this.suffixes.includes('CHAMPION'))
    );
    this.uniqueKey = this.isUnique ? (config.coreType || type) : null;

    if (this.isUnique) {
      this.stats.maxHp = Math.floor(this.stats.maxHp * 1.35);
    }

    const isMorgoth = this.type === 'MON_MORGOTH_LORD_OF_DARKNESS' || this.uniqueKey === 'MON_MORGOTH_LORD_OF_DARKNESS' || this._baseName === 'Morgoth, Lord of Darkness';
    this.stats.maxHp = clampMonsterHp(this.stats.maxHp, this.level, isMorgoth);
    this.stats.hp = this.stats.maxHp;
    this.statuses = {};
    this.debuffs = StatusEffectEngine.createLegacyDebuffsProxy(this);
    this.isAggroed = false;
    this.elementalAura = { FIRE: 0, COLD: 0, LIGHTNING: 0, ACID: 0, MANA: 0 };
    this.elementalInfusions = { FIRE: 0, COLD: 0, LIGHTNING: 0, ACID: 0, MANA: 0 };
    this.isSuperconducted = 0;
    this.cooldowns = {};
    this.skillTrackers = {};

    this._isDirty = true;
    this._statCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    this._statBreakdownCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    this._maxHpCache = null;

    // Species Tags & Inferences
    this.speciesTags = new Set(config.speciesTags || []);
    if (this.type) this.speciesTags.add(this.type.toUpperCase());
    if (config.flags && Array.isArray(config.flags)) {
      for (const f of config.flags) this.speciesTags.add(f.toUpperCase());
    }

    const uType = (this.type || '').toUpperCase();
    if (uType === 'GOBLIN' || uType === 'ORC' || uType === 'URUK') {
      this.speciesTags.add('ORC');
      this.speciesTags.add('EVIL');
    } else if (uType === 'DRAGON' || uType === 'WYRM' || uType === 'DRAKE') {
      this.speciesTags.add('DRAGON');
      this.speciesTags.add('EVIL');
    } else if (uType === 'UNDEAD' || uType === 'SKELETON' || uType === 'ZOMBIE' || uType === 'GHOST' || uType === 'LICH') {
      this.speciesTags.add('UNDEAD');
      this.speciesTags.add('EVIL');
    } else if (uType === 'OGRE' || uType === 'TROLL' || uType === 'GIANT') {
      this.speciesTags.add('GIANT');
      this.speciesTags.add('EVIL');
    } else if (uType === 'BAT' || uType === 'CANINE' || uType === 'SPIDER' || uType === 'SNAKE' || uType === 'WOLF' || uType === 'ANIMAL') {
      this.speciesTags.add('ANIMAL');
    } else if (uType === 'DEMON' || uType === 'IMP') {
      this.speciesTags.add('DEMON');
      this.speciesTags.add('EVIL');
    } else if (uType === 'SLIME') {
      this.speciesTags.add('SLIME');
    }

    this.resistances = { ...(config.resistances || {}) };
    this.immunities = new Set(config.immunities || []);
  }

  markDirty(reason = "이유 미상") {
    this._isDirty = true;
    this._statCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    this._statBreakdownCache = { str: null, dex: null, con: null, int: null, wis: null, chr: null, cha: null };
    this._maxHpCache = null;
    TraceLogger.log('CACHE', `몬스터 스탯 캐시 만료 | 대상: ${this.displayName} | 사유: ${reason}`);
  }

  get displayName() {
    let nameParts = [];
    for (const pKey of this.prefixes) {
      if (PREFIX_TAGS[pKey]) nameParts.push(PREFIX_TAGS[pKey].name);
    }
    nameParts.push(this._baseName);
    for (const sKey of this.suffixes) {
      if (SUFFIX_TAGS[sKey]) nameParts.push(SUFFIX_TAGS[sKey].name);
    }
    return nameParts.join(' ');
  }

  get name() {
    return this.displayName;
  }

  set name(val) {
    this._baseName = val;
  }

  get specialAction() {
    const config = getSpeciesConfig(this.type);
    if (config && config.specialAction) return config.specialAction;
    if (this.breathElement) {
      return {
        namePattern: `{elementName} 브레스`,
        cooldown: 5,
        maxRange: 5.5,
        rollBaseDamage: () => TomeSpellEngine.rollDice("4d6"),
        getScaling: (monster) => monster.intMod || 0,
        applyDebuffs: (game, monster, element) => {}
      };
    }
    return null;
  }

  get displayColor() {
    return getChromaticColor(this.prefixes, this.suffixes, this._baseColor);
  }

  get color() {
    return this.displayColor;
  }

  set color(val) {
    this._baseColor = val;
  }

  getEffectiveStatWithBreakdown(name) {
    return MonsterAISystem.calculateMonsterBreakdown(this, name);
  }

  getEffectiveStat(name) {
    return this.getEffectiveStatWithBreakdown(name).finalValue;
  }

  get maxHp() {
    if (!this._isDirty && this._maxHpCache !== null) {
      return this._maxHpCache;
    }

    const config = getSpeciesConfig(this.type);
    const coreBase = config.coreBase || { con: 10 };
    const coreBaseHp = config.coreBaseHp || 20;
    const gType = config.growthType || 'BALANCED';
    const pattern = MONSTER_GROWTH_PATTERNS[gType] || MONSTER_GROWTH_PATTERNS.BALANCED;
    
    let hpMult = 1.0;
    for (let perkId of this.getActivePerks()) {
      const perk = MONSTER_PERKS[perkId];
      if (perk && perk.effects && perk.effects.hpMultiplier) {
        hpMult *= perk.effects.hpMultiplier;
      }
    }
    
    const currentCon = this.getEffectiveStat('con');
    const conGrowth = currentCon - (coreBase.con || 10);
    const rawHp = coreBaseHp + conGrowth * 5 + this.level * 2;
    
    let baseMax = Math.floor(rawHp * (pattern.hp || 1.0) * hpMult);
    
    for (const pKey of this.prefixes) {
      if (pKey === 'IMMORTAL') baseMax += 40;
    }

    if (this.isUnique) {
      baseMax = Math.floor(baseMax * 1.35);
    }
    
    const isMorgoth = this.type === 'MON_MORGOTH_LORD_OF_DARKNESS' || this.uniqueKey === 'MON_MORGOTH_LORD_OF_DARKNESS' || this._baseName === 'Morgoth, Lord of Darkness';
    const finalMaxHp = clampMonsterHp(baseMax, this.level, isMorgoth);
    this._maxHpCache = finalMaxHp;
    return finalMaxHp;
  }

  get strMod() { return Math.floor(this.getEffectiveStat('str') / 10); }
  get intMod() { return Math.floor(this.getEffectiveStat('int') / 10); }
  get wisMod() { return Math.floor(this.getEffectiveStat('wis') / 10); }
  get dexMod() { return Math.floor(this.getEffectiveStat('dex') / 10); }
  get conMod() { return Math.floor(this.getEffectiveStat('con') / 10); }
  get chrMod() { return Math.floor(this.getEffectiveStat('chr') / 10); }
  get chaMod() { return Math.floor(this.getEffectiveStat('chr') / 10); }

  get speed() {
    let calculatedSpeed = 0;
    const dex = this.getEffectiveStat('dex');
    if (dex < 100) {
      calculatedSpeed = 4 + 6 * (dex / 100);
    } else {
      calculatedSpeed = 10 + (dex - 100) * 0.0375;
    }

    const speedBonus = this.getPerkEffectMultiplier("speedMultiplier");
    calculatedSpeed *= speedBonus;

    const activeTags = this.compileActiveTags();
    const hasteStacks = activeTags["HASTE_UNIT"] || 0;
    if (hasteStacks > 0) {
      calculatedSpeed *= (1.0 + hasteStacks * 0.15);
    }

    for (const pKey of this.prefixes) {
      if (pKey === 'FURIOUS') calculatedSpeed *= 1.15;
      if (pKey === 'IRON') calculatedSpeed *= 0.90;
      if (pKey === 'BLOODTHIRSTY') calculatedSpeed *= 1.10;
    }

    if (this.debuffs && this.debuffs.frost > 0) {
      calculatedSpeed *= 0.70;
    }

    if (this.speedMultiplier) {
      calculatedSpeed *= this.speedMultiplier;
    }

    return Math.max(3.5, calculatedSpeed);
  }

  set speed(val) {
    if (typeof val === 'number') {
      const current = this.speed;
      this.speedMultiplier = current > 0 ? (val / current) * (this.speedMultiplier || 1.0) : 1.5;
    }
  }

  update(deltaTime) {
    if (this.type === 'BAT' && this.prefixes.length === 0 && this.suffixes.length === 0) {
      this.animationTime = (this.animationTime || 0) + deltaTime;
      const cycle = Math.floor(this.animationTime / 300) % 2;
      this._baseColor = cycle === 0 ? '#fbbf24' : '#f472b6';
    }
  }

  takeDamage(amount) {
    this.markDirty("피격 피해: " + amount);
    this.isAggroed = true;
    if (this.manaShield && this.manaShield > 0 && this.manaShieldDuration > 0) {
      const shieldAbsorb = Math.min(amount, this.manaShield);
      this.manaShield -= shieldAbsorb;
      amount -= shieldAbsorb;
    }
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    return this.stats.hp <= 0;
  }

  getSpeciesTags() {
    return Array.from(TomeFlagResolver.collectFlagsFromEntity(this));
  }

  hasSpeciesTag(tag) {
    return TomeFlagResolver.hasFlag(this, tag);
  }

  getResistance(element) {
    return UnifiedTraitEngine.getElementalTrait(this, element).resistancePercent / 100;
  }

  hasImmunity(condition) {
    return TomeFlagResolver.hasFlag(this, `IM_${condition}`) || (condition === 'PARALYZE' && TomeFlagResolver.hasFlag(this, 'FREE_ACT'));
  }

  getCombinedResistances() {
    return Array.from(TomeFlagResolver.getFlagsWithPrefix(this, 'RES_'));
  }

  getResistancePercent(element) {
    return UnifiedTraitEngine.getElementalTrait(this, element).resistancePercent / 100;
  }

  getFlatDamageReduction() {
    return PlayerStatCalculator.calculateFlatDamageReduction(this);
  }

  getLifestealPercent() {
    const activeTags = this.compileActiveTags();
    const stacks = activeTags["LIFESTEAL"] || 0;
    return stacks * 5;
  }

  tickBuffsAndHeals(allMonsters, addLogEntry) {
    if (this.stats.hp <= 0) return;
    this.markDirty("매 턴 틱 쿨타임/버프 갱신");
    MonsterAISystem.tickBuffsAndHeals(this, allMonsters, addLogEntry);
  }

  act(player, map, isMonsterAt, attackPlayer, useMonsterBreath, addLogEntry) {
    MonsterAISystem.act(this, player, map, isMonsterAt, attackPlayer, useMonsterBreath, addLogEntry);
  }

  runStandardMonsterAI(player, map, isMonsterAt, attackPlayer, dx, dy, dist) {
    MonsterAISystem.runStandardMonsterAI(this, player, map, isMonsterAt, attackPlayer, dx, dy, dist);
  }

  runBatAI(player, map, isMonsterAt, attackPlayer, dx, dy, dist) {
    MonsterAISystem.runBatAI(this, player, map, isMonsterAt, attackPlayer, dx, dy, dist);
  }

  createCoreItem(x = this.x, y = this.y) {
    const config = getSpeciesConfig(this.type);
    const cChar = '*';
    return new Item(
      x,
      y,
      'CORE',
      cChar,
      config.baseColor,
      `${config.name} 코어`,
      0,
      null,
      {},
      null,
      this.type,
      this.prefixes,
      this.suffixes
    );
  }

  getActivePerks() {
    return this.perks || [];
  }

  compileActiveTags() {
    const tagCounts = {};
    const addTags = (tagsList) => {
      if (!tagsList) return;
      for (const tag of tagsList) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    };

    if (this.prefixes) {
      this.prefixes.forEach(p => addTags(PREFIX_TAGS[p]?.synergyTags));
    }
    if (this.suffixes) {
      this.suffixes.forEach(s => addTags(SUFFIX_TAGS[s]?.synergyTags));
    }

    const activePerks = this.getActivePerks();
    for (const perkId of activePerks) {
      addTags(MONSTER_PERKS[perkId]?.synergyTags);
    }

    if (this.skillSets) {
      for (const skillSetName of this.skillSets) {
        const skillTree = CORE_SKILL_TREES[skillSetName];
        if (skillTree) {
          for (const skill of skillTree) {
            if (this.level >= skill.pt) {
              addTags(skill.synergyTags);
            }
          }
        }
      }
    }

    if (this.protectPrayerTurns && this.protectPrayerTurns > 0) {
      tagCounts["PHYS_RESIST"] = (tagCounts["PHYS_RESIST"] || 0) + 3;
    }

    return tagCounts;
  }

  hasActiveSpecialAction() {
    return Boolean(this.specialAction || this.breathElement || (this.spells && this.spells.length > 0));
  }

  getActiveAttackSkill() {
    if (this.suffixes) {
      if (this.suffixes.includes("CHIEFTAIN")) return "CHIEFTAIN_ROAR";
      if (this.suffixes.includes("CHAMPION")) return "CHAMPION_STRIKE";
      if (this.suffixes.includes("WARRIOR")) return "SHIELD_SLAM";
      if (this.suffixes.includes("MAGE")) return "FIREBOLT";
      if (this.suffixes.includes("SHAMAN")) return "LIGHTNING_BOLT";
      if (this.suffixes.includes("PRIEST")) return "HOLY_BOLT";
    }

    const config = getSpeciesConfig(this.type);
    return config.attackSkill || null;
  }

  hasPerk(perkId) {
    return TomeFlagResolver.hasFlag(this, perkId);
  }

  getPerkEffectMultiplier(key) {
    let multiplier = 1.0;
    for (let perkId of this.getActivePerks()) {
      const perk = MONSTER_PERKS[perkId];
      if (perk && perk.effects && perk.effects[key] !== undefined) {
        multiplier *= perk.effects[key];
      }
    }
    return multiplier;
  }

  executeAttack(defender, game = null) {
    const attack = this.blows[0] || { method: "HIT", effect: "HURT", damage: "1d4" };
    return TomeSpellEngine.executeAttack({ attack, attacker: this, defender, game });
  }

  castSpell(spellKey, target = null, game = null) {
    return TomeSpellEngine.castSpell({ spellKey, caster: this, target, game });
  }
}
