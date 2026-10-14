import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { ProceduralSkillSynthesizer, ActiveSkill } from '../src/systems/ProceduralSkillSynthesizer.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { StatusEffectEngine } from '../src/systems/StatusEffectEngine.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { Item } from '../src/entities/Item.js';
import { CORE_SKILL_TREES } from '../src/core/Skills.js';

describe('Argon Phase 2: 851 Monsters & Procedural Skillset Synthesizer', () => {

  // =========================================================================
  // Requirement 1: All 851 monsters receive 4 valid skills & 0 duplicate IDs
  // =========================================================================
  describe('Task 1 & 2: 851 Monster Skillset Completeness & ID Uniqueness', () => {
    it('verifies all 851 monsters in TOME_MONSTERS_DATA receive 4 active skills with 0 duplicate IDs', () => {
      const allKeys = Object.keys(TOME_MONSTERS_DATA);
      expect(allKeys.length).toBe(851);

      let totalMonstersChecked = 0;
      let duplicateIdMonsterCount = 0;

      for (const monsterKey of allKeys) {
        const skills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet(monsterKey);
        expect(skills).toBeDefined();
        expect(skills.length).toBe(4);

        // Check slot indices and required masteries
        expect(skills[0].slot).toBe(1);
        expect(skills[1].slot).toBe(2);
        expect(skills[2].slot).toBe(3);
        expect(skills[3].slot).toBe(4);

        expect(skills[0].requiredMastery).toBeLessThanOrEqual(2);
        expect(skills[1].requiredMastery).toBeLessThanOrEqual(2);
        expect(skills[2].requiredMastery).toBe(3);
        expect(skills[3].requiredMastery).toBe(6);

        // Check ID uniqueness within this monster's 4 slots
        const idSet = new Set();
        let hasDuplicate = false;
        for (const sk of skills) {
          if (idSet.has(sk.id)) {
            hasDuplicate = true;
          }
          idSet.add(sk.id);
          expect(typeof sk.name).toBe('string');
          expect(sk.name.length).toBeGreaterThan(0);
          expect(Array.isArray(sk.ops)).toBe(true);
          expect(sk.ops.length).toBeGreaterThan(0);
        }

        if (hasDuplicate) {
          duplicateIdMonsterCount++;
        }
        totalMonstersChecked++;
      }

      expect(totalMonstersChecked).toBe(851);
      expect(duplicateIdMonsterCount).toBe(0);
    });

    it('delegates MonsterSpellFactory.createInnateSkills and getSkillsForCore to ProceduralSkillSynthesizer', () => {
      const skills1 = MonsterSpellFactory.createInnateSkills('MON_NOVICE_MAGE');
      const skills2 = MonsterSpellFactory.getSkillsForCore('MON_NOVICE_MAGE');
      expect(skills1.length).toBe(4);
      expect(skills2.length).toBe(4);
      expect(skills1[0].id).toBe(skills2[0].id);
    });
  });

  // =========================================================================
  // Requirement 2: Non-shield monsters NEVER receive SHIELD_BASH
  // =========================================================================
  describe('Task 1 & 2: Non-Shield Monsters Prohibition of SHIELD_BASH', () => {
    it('ensures snakes, spiders, bats, hounds, molds, and eyes never receive SHIELD_BASH', () => {
      const nonShieldKeywords = ['snake', 'spider', 'bat', 'hound', 'mold', 'eye', 'worm', 'jelly', 'slime'];
      const nonShieldMonsters = Object.entries(TOME_MONSTERS_DATA).filter(([k, data]) => {
        const name = (data.name || '').toLowerCase();
        return nonShieldKeywords.some(kw => name.includes(kw));
      });

      expect(nonShieldMonsters.length).toBeGreaterThan(50);

      for (const [key, data] of nonShieldMonsters) {
        const skills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet(key);
        for (const skill of skills) {
          expect(skill.tomeKey).not.toBe('SHIELD_BASH');
          expect(skill.id).not.toContain('SHIELD_BASH');
          expect(skill.name).not.toContain('방패');
        }
      }
    });
  });

  // =========================================================================
  // Requirement 3: Sub-Core Infusion (Element & Status Ops)
  // =========================================================================
  describe('Task 2 & 3: Main & Sub-Core Skill Infusions', () => {
    it('infuses Main Core (MON_PACK_LION) with Sub Cores (MON_FIRE_HOUND and MON_VENOMOUS_SPIDER)', () => {
      const infusedSkills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet(
        'MON_PACK_LION',
        ['MON_FIRE_HOUND', 'MON_VENOMOUS_SPIDER']
      );

      expect(infusedSkills.length).toBe(4);
      const slot1 = infusedSkills[0];
      const slot2 = infusedSkills[1];

      // Check infusedBy
      expect(slot1.infusedBy).toContain('MON_FIRE_HOUND');
      expect(slot1.infusedBy).toContain('MON_VENOMOUS_SPIDER');
      expect(slot2.infusedBy).toContain('MON_FIRE_HOUND');
      expect(slot2.infusedBy).toContain('MON_VENOMOUS_SPIDER');

      // Check elemental ops in Slot 1
      const elements = slot1.ops.filter(o => o.element).map(o => o.element);
      expect(elements).toContain('FIRE');
      expect(elements).toContain('POISON');

      // Check status ops in Slot 1
      const statuses = slot1.ops.filter(o => o.statusId).map(o => o.statusId);
      expect(statuses).toContain('BURN');
      expect(statuses).toContain('POISON');

      // Check synergy tags
      expect(slot1.synergyTags).toContain('FIRE_INFUSION');
      expect(slot1.synergyTags).toContain('POISON_INFUSION');
    });

    it('dynamically updates Player innate skills when equipping and unequipping sub-cores', () => {
      const player = new Player(10, 10, '인간 여행자');
      player.mimicCore = {
        coreType: 'MON_PACK_LION',
        name: 'Pack lion'
      };

      // Initial active skills (no sub-cores)
      const baseSkills = player.getInnateSkills();
      expect(baseSkills[0].infusedBy.length).toBe(0);

      // Equip subCore1 (Fire hound)
      const fireCoreItem = new Item(0, 0, 'CORE', 'c', '#ef4444', 'Fire Hound Core', 100, 'CORE');
      fireCoreItem.coreType = 'MON_FIRE_HOUND';
      player.equipSubCore1(fireCoreItem);

      const infused1 = player.getInnateSkills();
      expect(infused1[0].infusedBy).toContain('MON_FIRE_HOUND');
      expect(infused1[0].synergyTags).toContain('FIRE_INFUSION');

      // Equip subCore2 (Venomous spider)
      const spiderCoreItem = new Item(0, 0, 'CORE', 'c', '#10b981', 'Venomous Spider Core', 100, 'CORE');
      spiderCoreItem.coreType = 'MON_VENOMOUS_SPIDER';
      player.equipSubCore2(spiderCoreItem);

      const infused2 = player.getInnateSkills();
      expect(infused2[0].infusedBy).toContain('MON_FIRE_HOUND');
      expect(infused2[0].infusedBy).toContain('MON_VENOMOUS_SPIDER');
      expect(infused2[0].synergyTags).toContain('POISON_INFUSION');

      // Unequip subCore1
      player.unequipSubCore1();
      const afterUnequip = player.getInnateSkills();
      expect(afterUnequip[0].infusedBy).not.toContain('MON_FIRE_HOUND');
      expect(afterUnequip[0].infusedBy).toContain('MON_VENOMOUS_SPIDER');
    });
  });

  // =========================================================================
  // Requirement 4: MimicBody Mastery Unlock (pt: 3, 5, 7, 10)
  // =========================================================================
  describe('Task 3: MimicBody Passive Tree Mastery Unlocks', () => {
    it('only unlocks pt: 3, 5, 7, 10 passive skills when masteryLv reaches 3, 5, 7, 10', () => {
      const player = new Player(10, 10, '인간 여행자');
      player.equipment = {};
      player.mimicCore = {
        coreType: 'MON_CAVE_SPIDER',
        name: 'Cave spider'
      };

      // Set lore mastery levels directly
      const body = player.body;
      const coreKey = 'MON_CAVE_SPIDER';

      // Level 1: Only pt: 1 is unlocked
      body.loreMastery = { [coreKey]: { xp: 0, level: 1, kills: 0 } };
      let tags = body.compileBodyActiveTags();
      const passiveTree = ProceduralSkillSynthesizer.synthesizePassiveTree(coreKey);

      // Verify pt: 1 tags are active
      passiveTree[0].synergyTags.forEach(tag => {
        expect(tags[tag]).toBeGreaterThan(0);
      });
      // Verify pt: 3, 5, 7, 10 tags are NOT yet active
      passiveTree.slice(1).forEach(node => {
        node.synergyTags.forEach(tag => {
          expect(tags[tag] || 0).toBe(0);
        });
      });

      // Level 3: pt: 1 and pt: 3 unlocked
      body.loreMastery[coreKey].level = 3;
      tags = body.compileBodyActiveTags();
      passiveTree[1].synergyTags.forEach(tag => {
        expect(tags[tag]).toBeGreaterThan(0);
      });
      passiveTree.slice(2).forEach(node => {
        node.synergyTags.forEach(tag => {
          expect(tags[tag] || 0).toBe(0);
        });
      });

      // Level 5: pt: 1, 3, 5 unlocked
      body.loreMastery[coreKey].level = 5;
      tags = body.compileBodyActiveTags();
      passiveTree[2].synergyTags.forEach(tag => {
        expect(tags[tag]).toBeGreaterThan(0);
      });
      passiveTree.slice(3).forEach(node => {
        node.synergyTags.forEach(tag => {
          expect(tags[tag] || 0).toBe(0);
        });
      });

      // Level 7: pt: 1, 3, 5, 7 unlocked
      body.loreMastery[coreKey].level = 7;
      tags = body.compileBodyActiveTags();
      passiveTree[3].synergyTags.forEach(tag => {
        expect(tags[tag]).toBeGreaterThan(0);
      });
      passiveTree.slice(4).forEach(node => {
        node.synergyTags.forEach(tag => {
          expect(tags[tag] || 0).toBe(0);
        });
      });

      // Level 10: all pt: 1, 3, 5, 7, 10 unlocked
      body.loreMastery[coreKey].level = 10;
      tags = body.compileBodyActiveTags();
      passiveTree[4].synergyTags.forEach(tag => {
        expect(tags[tag]).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // Requirement 5: Unarmed / Core-Inherited Melee Blows & Effects
  // =========================================================================
  describe('Task 3: Core-Inherited Blows & Status Effects', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('uses core blow.dice instead of 1d3 when unarmed and applies blow.effect', () => {
      const player = new Player(10, 10, '인간 여행자');
      player.equipment.weapon = null; // Unarmed
      player.stats.dex = 100;

      // Transform into a monster with distinctive blows (Fire hound: CLAW 3d3 HURT, BITE 2d6 FIRE)
      player.mimicCore = {
        coreType: 'MON_FIRE_HOUND',
        name: 'Fire hound'
      };

      const blows = CombatCalculator.calculatePlayerBlows(player, {});
      expect(blows.length).toBe(3);
      expect(blows[0].dice).toBe('3d3'); // Core dice, not 1d3 or 1d4!
      expect(blows[0].isCoreInherited).toBe(true);
      expect(blows.some(b => b.effect === 'FIRE')).toBe(true);

      const fireBlow = blows.find(b => b.effect === 'FIRE');
      expect(fireBlow.dice).toBe('2d6');

      // Verify damage calculation uses blow.dice
      const monster = new Monster(11, 10, 'Hill orc', 5, [], []);
      monster.baseAC = -200;
      monster.stats.ac = -200;
      monster.stats.hp = 100;
      monster.stats.maxHp = 100;

      const physResult = CombatCalculator.calculatePhysicalDamage(player, monster, {}, 10, fireBlow);
      expect(physResult.dmg).toBeGreaterThan(0);

      // Mock Game context for CombatSystem.attackMonster
      const game = {
        player,
        map: { isWalkable: () => true },
        monsters: [monster],
        effects: [],
        addLogEntry: () => {},
        updateUI: () => {}
      };

      // Execute attack and verify status effect is applied
      CombatSystem.attackMonster(game, player, monster);

      // Fire hound blow effect: BURN applied to target
      const hasBurn = StatusEffectEngine.hasStatus(monster, 'BURN');
      expect(hasBurn).toBe(true);
    });

    it('applies POISON on monster when unarmed core has POISON blow effect', () => {
      const player = new Player(10, 10, '인간 여행자');
      player.equipment.weapon = null; // Unarmed
      player.stats.dex = 100;

      player.mimicCore = {
        coreType: 'MON_COPPERHEAD_SNAKE',
        name: 'Copperhead snake'
      };

      const blows = CombatCalculator.calculatePlayerBlows(player, {});
      expect(blows.length).toBeGreaterThan(0);
      expect(blows[0].effect).toBe('POISON');
      expect(blows[0].dice).toBe('2d4');

      const monster = new Monster(11, 10, 'Giant rat', 2, [], []);
      monster.baseAC = -200;
      monster.stats.ac = -200;
      monster.stats.hp = 50;
      monster.stats.maxHp = 50;

      const game = {
        player,
        map: { isWalkable: () => true },
        monsters: [monster],
        effects: [],
        addLogEntry: () => {},
        updateUI: () => {}
      };

      CombatSystem.attackMonster(game, player, monster);

      expect(StatusEffectEngine.hasStatus(monster, 'POISON')).toBe(true);
    });
  });
});
