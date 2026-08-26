/**
 * @module MimicBody
 * @category entities
 * @description 무정형 미믹의 영구 본체 컨테이너 클래스. 메인 코어의 탈착과 상관없이 스탯, 로어 숙련도, 몬스터 킬 카운트, 돌연변이 태그를 영구 보존하며 무게 한도 및 감속 배율을 수학적으로 도출합니다.
 * @purity State Store / Logic Container
 * @dependencies Tags.js, MonsterRegistry.js, Perks.js, Skills.js
 * @exports WEAPON_MASTERY_CONFIG, WEAPON_REQUIREMENT_CONFIG, MimicBody
 */
import { PREFIX_TAGS, SUFFIX_TAGS } from './Tags.js';
import { getSpeciesConfig } from './MonsterRegistry.js';
import { MONSTER_PERKS } from './Perks.js';
import { CORE_SKILL_TREES } from '../core/Skills.js';

export const WEAPON_MASTERY_CONFIG = {
  levels: [
    { lvl: 1, req: 0, extraAttacks: 0 },
    { lvl: 2, req: 30, extraAttacks: 0 },
    { lvl: 3, req: 80, extraAttacks: 1 },
    { lvl: 4, req: 180, extraAttacks: 1 },
    { lvl: 5, req: 380, extraAttacks: 2 }
  ],
  categories: {
    UNARMED: { name: "맨손 타격", desc: "무기 장착 해제 상태. 체중을 실은 원시적 체술." },
    SWORD: { name: "도검 검술", desc: "검, 단검, 군장검. 예리하게 베고 찌르는 검법." },
    BLUNT: { name: "둔기 강타", desc: "메이스, 도끼, 망치, 둔기. 가공할 타격력의 강타술." },
    POLEARM: { name: "장병 창술", desc: "창, 할버드, 스태프, 지팡이. 리치를 살린 창술과 봉술." },
    ARCHERY: { name: "궁술 사격", desc: "활, 석궁, 슬링. 원거리 저격과 화살 사격술." }
  }
};

export const WEAPON_REQUIREMENT_CONFIG = {
  strMultiplier: 3.5, // 무기 무게당 요구 STR 스탯 배율
  dexMultiplier: 2.5, // 무기 무게당 요구 DEX 스탯 배율
  minStrLimit: 12,    // 맨손 상태일 때 요구하는 힘의 최소 한계치
  minDexLimit: 10     // 맨손 상태일 때 요구하는 민첩의 최소 한계치
};

export class MimicBody {
  /**
   * Initialize the Mimic Body container.
   * @param {Object} player - Reference to the Player instance for equipment/inventory lookup
   */
  constructor(player) {
    this.player = player;

    // Permanent basic stats of the Mimic itself (not core-dependent)
    this.baseStats = {
      str: 8,
      int: 8,
      wis: 8,
      dex: 8,
      con: 8,
      chr: 6,
      cha: 6
    };

    // Permanent legacy stats retained across core morphs
    this.legacyStats = {
      str: 0,
      int: 0,
      wis: 0,
      dex: 0,
      con: 0,
      chr: 0,
      cha: 0
    };

    // Permanent active mutations (synergy tags) consumed from cores
    this.mutations = []; // Array of strings (e.g. ["ACID_COUNTER", "SPEED_BOOST"])

    // Lore mastery levels for each monster species
    // Stores experience points (XP) for each core type dynamically (supports infinite species automatically)
    this.loreRegistry = {};

    // Monster kill counts registry
    this.killRegistry = {};

    // Weapon mastery counters registry
    this.weaponMastery = {
      UNARMED: { count: 0 },
      SWORD: { count: 0 },
      BLUNT: { count: 0 },
      POLEARM: { count: 0 },
      ARCHERY: { count: 0 }
    };
  }

  // Record a monster kill with canonical key synchronization
  recordKill(keyOrType, amount = 1) {
    if (!keyOrType) return;
    if (!this.killRegistry) this.killRegistry = {};
    const cur = this.getKillCount(keyOrType);
    const newKills = cur + amount;
    this.killRegistry[keyOrType] = newKills;

    const config = getSpeciesConfig(keyOrType);
    if (config) {
      if (config.coreType) this.killRegistry[config.coreType] = newKills;
      if (config.name) this.killRegistry[config.name] = newKills;
      if (config.displayName) this.killRegistry[config.displayName] = newKills;
    }
  }

  // Get kill count for a monster or species with canonical key normalization
  getKillCount(keyOrType) {
    if (!keyOrType || !this.killRegistry) return 0;
    let maxKills = this.killRegistry[keyOrType] || 0;
    const config = getSpeciesConfig(keyOrType);
    if (config) {
      if (config.coreType && this.killRegistry[config.coreType]) {
        maxKills = Math.max(maxKills, this.killRegistry[config.coreType]);
      }
      if (config.name && this.killRegistry[config.name]) {
        maxKills = Math.max(maxKills, this.killRegistry[config.name]);
      }
      if (config.displayName && this.killRegistry[config.displayName]) {
        maxKills = Math.max(maxKills, this.killRegistry[config.displayName]);
      }
    }
    return maxKills;
  }

  // Get accumulated Lore XP for a species, resolving canonical keys and aliases in O(1)
  getLoreXp(speciesType) {
    if (!speciesType || !this.loreRegistry) return 0;
    
    let maxExp = this.loreRegistry[speciesType] || 0;

    const config = getSpeciesConfig(speciesType);
    if (config) {
      if (config.coreType && this.loreRegistry[config.coreType]) {
        maxExp = Math.max(maxExp, this.loreRegistry[config.coreType]);
      }
      if (config.name && this.loreRegistry[config.name]) {
        maxExp = Math.max(maxExp, this.loreRegistry[config.name]);
      }
      if (config.displayName && this.loreRegistry[config.displayName]) {
        maxExp = Math.max(maxExp, this.loreRegistry[config.displayName]);
      }
    }

    return maxExp;
  }

  // Get Lore / Morph Mastery Level (from 1 to 50) based on accumulated lore experience points
  getLoreLevel(speciesType) {
    const xp = this.getLoreXp(speciesType);
    if (xp >= 2000) return 50;
    if (xp >= 500) return Math.min(49, 25 + Math.floor((xp - 500) / 60));
    if (xp >= 100) return Math.min(24, 10 + Math.floor((xp - 100) / 26.6));
    return Math.min(9, 1 + Math.floor(xp / 11.1));
  }

  // Add lore experience points for a species, synchronizing canonical keys and display names
  gainLoreXp(speciesType, amount) {
    if (!speciesType || !amount) return [];
    if (!this.loreRegistry) this.loreRegistry = {};

    const currentXp = this.getLoreXp(speciesType);
    const newXp = currentXp + amount;

    // Synchronize across input key and canonical config keys
    this.loreRegistry[speciesType] = newXp;

    const config = getSpeciesConfig(speciesType);
    if (config) {
      if (config.coreType) {
        this.loreRegistry[config.coreType] = newXp;
      }
      if (config.name) {
        this.loreRegistry[config.name] = newXp;
      }
      if (config.displayName) {
        this.loreRegistry[config.displayName] = newXp;
      }
    }

    return [];
  }

  // Get Weapon Mastery Level (from 1 to 5) based on count
  getWeaponMasteryLevel(category) {
    const registry = this.weaponMastery || {};
    const count = registry[category]?.count || 0;
    const levels = WEAPON_MASTERY_CONFIG.levels;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (count >= levels[i].req) {
        return levels[i].lvl;
      }
    }
    return 1;
  }

  // Get next Level's required hits count
  getWeaponMasteryNextReq(category) {
    const registry = this.weaponMastery || {};
    const count = registry[category]?.count || 0;
    const currentLvl = this.getWeaponMasteryLevel(category);
    const levels = WEAPON_MASTERY_CONFIG.levels;
    if (currentLvl >= levels.length) {
      return null; // Max Level
    }
    return levels[currentLvl].req;
  }

  // Add hits count to category quietly in background
  gainWeaponMasteryXp(category, amount = 1, game = null) {
    if (!this.weaponMastery) {
      this.weaponMastery = {
        UNARMED: { count: 0 },
        SWORD: { count: 0 },
        BLUNT: { count: 0 },
        POLEARM: { count: 0 },
        ARCHERY: { count: 0 }
      };
    }
    if (!this.weaponMastery[category]) {
      this.weaponMastery[category] = { count: 0 };
    }
    this.weaponMastery[category].count += amount;
    return [];
  }

  /**
   * Sums up the total weight of the Player (Main core, sub cores, armor, weapons, and inventory)
   */
  getCurrentWeight() {
    let total = 0;

    // 1. Add Main Core weight dynamically (mimicCore is a plain object, not an Item instance)
    if (this.player.mimicCore) {
      const coreType = this.player.mimicCore.coreType || 'HUMAN';
      const config = getSpeciesConfig(coreType);
      let coreWeight = 5.0;
      if (config && config.coreBase) {
        const strBase = config.coreBase.str || 8;
        const conBase = config.coreBase.con || 8;
        const hpBase = config.coreBaseHp || 10;
        const rawWeight = (strBase * 0.05) + (conBase * 0.05) + (hpBase * 0.005);
        coreWeight = Math.min(20, Math.max(3, Math.floor(rawWeight)));
      }
      total += coreWeight;
    }

    // 2. Add equipped gear and sub cores (track equipped instances to avoid double-counting in inventory)
    const equippedSet = new Set();
    if (this.player.equipment) {
      for (const key in this.player.equipment) {
        const gear = this.player.equipment[key];
        if (gear) {
          equippedSet.add(gear);
          const safeWeight = Math.min(50, Math.max(0, typeof gear.weight === 'number' ? gear.weight : 0));
          total += safeWeight;
        }
      }
    }
    if (this.player.equippedLamp) {
      equippedSet.add(this.player.equippedLamp);
      const safeWeight = Math.min(50, Math.max(0, typeof this.player.equippedLamp.weight === 'number' ? this.player.equippedLamp.weight : 0));
      total += safeWeight;
    }

    // 3. Add inventory items (excluding already equipped items)
    if (this.player.inventory) {
      for (const item of this.player.inventory) {
        if (!equippedSet.has(item)) {
          const safeWeight = Math.min(50, Math.max(0, typeof item.weight === 'number' ? item.weight : 0));
          total += safeWeight;
        }
      }
    }

    // 3.5. HEAVY_SOUL 부정적 돌연변이 디메리트 적용 (소지 중량 +15kg 가산)
    if (this.mutations && this.mutations.includes("HEAVY_SOUL")) {
      total += 15;
    }

    return Math.max(1, Math.round(total * 10) / 10);
  }

  /**
   * Maximum weight load capacity based on baseline, Strength, Constitution, and Level.
   * Max Weight = 40 + (STR * 2.5) + (CON * 1.5) + (LVL * 1.5)
   */
  getMaxWeightLimit() {
    const str = this.player.getEffectiveStat('str');
    const con = this.player.getEffectiveStat('con');
    const lvl = this.player.level || 1;
    return Math.floor(40 + (str * 2.5) + (con * 1.5) + (lvl * 1.5));
  }

  /**
   * Returns the dynamic speed reduction multiplier based on over-encumbrance stages.
   * - < 80% weight: No penalty (1.0)
   * - >= 80% and < 100% weight: Heavy (30% reduction, multiplier 0.70)
   * - >= 100% weight: Overloaded (60% reduction, multiplier 0.40)
   */
  getSpeedModifier() {
    const current = this.getCurrentWeight();
    const limit = this.getMaxWeightLimit();

    if (current >= limit) {
      return 0.40; // Overloaded! Speed -60%
    }
    if (current >= limit * 0.80) {
      return 0.70; // Heavy! Speed -30%
    }
    return 1.0; // Healthy load
  }

  /**
   * Calculates the exact compiled synergy tags matching Player's traits, mutations, and level-gated skill trees.
   */
  compileActiveTags() {
    const tagCounts = {};
    const addTags = (tagsList) => {
      if (!tagsList) return;
      for (const tag of tagsList) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    };

    // 1. Gather tags from equipment (weapon, armor, helmet, subCore1, subCore2, lamp)
    for (const key in this.player.equipment) {
      const gear = this.player.equipment[key];
      if (gear) {
        if (gear.prefixes) {
          gear.prefixes.forEach(p => addTags(PREFIX_TAGS[p]?.synergyTags));
        }
        if (gear.suffixes) {
          gear.suffixes.forEach(s => addTags(SUFFIX_TAGS[s]?.synergyTags));
        }
        if (gear.specialTags) {
          addTags(gear.specialTags);
        }
      }
    }

    // Gather tags from Main Core (mimicCore)
    if (this.player.mimicCore) {
      if (this.player.mimicCore.prefixes) {
        this.player.mimicCore.prefixes.forEach(p => addTags(PREFIX_TAGS[p]?.synergyTags));
      }
      if (this.player.mimicCore.suffixes) {
        this.player.mimicCore.suffixes.forEach(s => addTags(SUFFIX_TAGS[s]?.synergyTags));
      }
      if (this.player.mimicCore.specialTags) {
        addTags(this.player.mimicCore.specialTags);
      }
    }

    // Lamp tags
    if (this.player.equippedLamp) {
      if (this.player.equippedLamp.prefixes) {
        this.player.equippedLamp.prefixes.forEach(p => addTags(PREFIX_TAGS[p]?.synergyTags));
      }
      if (this.player.equippedLamp.suffixes) {
        this.player.equippedLamp.suffixes.forEach(s => addTags(SUFFIX_TAGS[s]?.synergyTags));
      }
      if (this.player.equippedLamp.specialTags) {
        addTags(this.player.equippedLamp.specialTags);
      }
    }

    // 2. Gather tags from active innate skills (Main and Sub Cores)
    // Main core
    const mainCategory = this.player.normalizeCategory(this.player.mimicCore.name);
    const mainMastery = this.getLoreLevel(this.player.mimicCore.coreType || mainCategory);
    const mainSkills = CORE_SKILL_TREES[mainCategory] || [];
    mainSkills.forEach(skill => {
      if (mainMastery >= (skill.requiredMastery || 1)) addTags(skill.synergyTags);
    });

    // Sub Cores
    const checkSubCoreSkills = (core) => {
      if (!core) return;
      const category = this.player.normalizeCategory(core.baseName || core.name || core.coreType);
      const subMastery = this.getLoreLevel(core.coreType || category);
      const skills = CORE_SKILL_TREES[category] || [];
      skills.forEach(skill => {
        if (subMastery >= (skill.requiredMastery || 1)) addTags(skill.synergyTags);
      });
    };
    checkSubCoreSkills(this.player.equipment.subCore1);
    checkSubCoreSkills(this.player.equipment.subCore2);

    // 3. Gather tags from active perks
    const activePerks = this.player.getCombinedPerks();
    activePerks.forEach(perkId => {
      addTags(MONSTER_PERKS[perkId]?.synergyTags);
    });

    // 4. Gather permanent mutations (which are now permanent perks!)
    if (this.mutations) {
      this.mutations.forEach(perkId => {
        const perk = MONSTER_PERKS[perkId];
        if (perk && perk.synergyTags) {
          addTags(perk.synergyTags);
        }
      });
    }

    return tagCounts;
  }

  // Get cumulative stats weighting factors based on Lore Level
  // A higher lore level increases stats growth coefficients and fusion efficiencies!
  getLoreMultiplier(speciesType) {
    const lvl = this.getLoreLevel(speciesType);
    if (lvl >= 50) return 1.50;
    if (lvl >= 25) return 1.35;
    if (lvl >= 10) return 1.25;
    if (lvl >= 5) return 1.20;
    if (lvl >= 4) return 1.15;
    if (lvl >= 3) return 1.10;
    if (lvl >= 2) return 1.05;
    return 1.00;
  }
}
