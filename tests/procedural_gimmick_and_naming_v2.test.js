// Setup Mock DOM environment for Game and Voxel3DRenderer
const mockCtx = new Proxy({}, {
  get: () => () => ({ width: 10 })
});
const mockCanvas = {
  getContext: () => mockCtx,
  width: 800,
  height: 600,
  style: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};
global.document = {
  getElementById: () => mockCanvas,
  createElement: () => ({ ...mockCanvas, style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { appendChild: () => {}, style: {} },
  addEventListener: () => {}
};
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 800,
  innerHeight: 600
};

import { describe, it, expect, vi } from 'vitest';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { ProceduralSkillSynthesizer } from '../src/systems/ProceduralSkillSynthesizer.js';
import { MONSTER_GROWTH_PATTERNS, getSpeciesConfig } from '../src/entities/MonsterRegistry.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { CORE_SKILL_TREES } from '../src/core/Skills.js';
import { Game } from '../src/core/Game.js';

describe('Procedural Gimmick & Classic Fantasy Naming V2 Specification Test Suite', () => {

  // =========================================================================
  // 1. Full Audit: Prohibited Words Eradication across all 851 Monsters
  // =========================================================================
  describe('Contract 1: Classic Fantasy Naming & Prohibited Word Audit', () => {
    it('audits all 851 monsters to guarantee 0 prohibited words in skill/passive names & descriptions', () => {
      const allKeys = Object.keys(TOME_MONSTERS_DATA);
      expect(allKeys.length).toBe(851);

      const prohibitedRegex = /(전심전력|한계\s*돌파|극타|난무|비기|오의|극의|초절|멸살|폭쇄|종말의\s*심판|천벌|신벌|절기|초신성|무쌍|혈풍|일기당천|\[궁극기\])/;
      const violations = [];

      for (const key of allKeys) {
        const monster = TOME_MONSTERS_DATA[key];
        const skills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet(key);
        expect(skills.length).toBe(4);

        for (const s of skills) {
          if (prohibitedRegex.test(s.name)) {
            violations.push({ key, type: 'skill_name', value: s.name });
          }
          if (prohibitedRegex.test(s.desc)) {
            violations.push({ key, type: 'skill_desc', value: s.desc });
          }
          // Check that monster name prefix like "${monster.name}의" is not in skill name
          if (monster.name && s.name.startsWith(monster.name)) {
            violations.push({ key, type: 'monster_name_prefix', value: s.name });
          }
        }

        const passives = ProceduralSkillSynthesizer.synthesizePassiveTree(key);
        expect(passives.length).toBe(5);

        for (const p of passives) {
          if (prohibitedRegex.test(p.name)) {
            violations.push({ key, type: 'passive_name', value: p.name });
          }
          if (prohibitedRegex.test(p.desc)) {
            violations.push({ key, type: 'passive_desc', value: p.desc });
          }
        }
      }

      if (violations.length > 0) {
        console.error('Prohibited word violations found:', violations);
      }
      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Starter Cores: HUMAN & IMP Identity Contract
  // =========================================================================
  describe('Contract 2: Starter Core Identity Contract (HUMAN & IMP)', () => {
    it('verifies HUMAN (Novice warrior) receives authentic warrior skills and passive tree', () => {
      const skills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet('MON_NOVICE_WARRIOR');
      expect(skills.length).toBe(4);

      // Slot 1: Basic weapon strike
      expect(skills[0].slot).toBe(1);
      expect(skills[0].name).toContain('검 베기');

      // Slot 2: Defensive stance
      expect(skills[1].slot).toBe(2);
      expect(skills[1].name).toContain('방패 막기 태세');

      // Slot 3: Tactical tackle / rush
      expect(skills[2].slot).toBe(3);
      expect(skills[2].name).toContain('어깨 밀치기');

      // Slot 4: Weapon mastery combo
      expect(skills[3].slot).toBe(4);
      expect(skills[3].name).toContain('무기 숙련 연격');

      // Passive tree
      const passives = ProceduralSkillSynthesizer.synthesizePassiveTree('MON_NOVICE_WARRIOR');
      expect(passives.length).toBe(5);
      const allTags = passives.flatMap(p => p.synergyTags);
      expect(allTags).toContain('STR_BOOST');
      expect(allTags).toContain('STRONG_ATTACK');
      expect(allTags).toContain('PHYS_RESIST');
      expect(allTags).toContain('WAIT_HEAL');
      expect(allTags).toContain('BERSERK_RAGE');
    });

    it('verifies IMP is correctly mapped and receives spellcaster skills and passives', () => {
      const config = getSpeciesConfig('IMP');
      expect(config.coreType).toBe('MON_IMP');

      const configKorean = getSpeciesConfig('임프');
      expect(configKorean.coreType).toBe('MON_IMP');

      const skills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet('MON_IMP');
      expect(skills.length).toBe(4);

      // Slot 1: Primary fire spell (BO_FIRE) for caster
      expect(skills[0].slot).toBe(1);
      expect(skills[0].element).toBe('FIRE');
      expect(skills[0].type).toBe('PROJECTILE');
      expect(skills[0].requiredMastery).toBe(1);
      expect(skills[0].cooldown).toBeLessThanOrEqual(2);

      // Slot 2: Mana shield or control/debuff
      expect(skills[1].slot).toBe(2);
      expect(skills[1].requiredMastery).toBe(1);

      // Slot 3: Tactical blink / short teleport
      expect(skills[2].slot).toBe(3);
      expect(skills[2].name).toBe('단거리 전이');
      expect(skills[2].type).toBe('TELEPORT');
      expect(skills[2].requiredMastery).toBe(3);

      // Slot 4: Remaining spell (SCARE/Fear or Apex)
      expect(skills[3].slot).toBe(4);
      expect(skills[3].requiredMastery).toBe(6);

      // Passive tree
      const passives = ProceduralSkillSynthesizer.synthesizePassiveTree('MON_IMP');
      const allTags = passives.flatMap(p => p.synergyTags);
      expect(allTags).toContain('SPELL_CHARGE');
      expect(allTags).toContain('QUICKCAST');
    });

    it('verifies IMP manual skill cast triggers damage, ProjectileEffect, and FloatingTextEffect', () => {
      const game = new Game();
      game.player = new Player(5, 5, 'MON_IMP');
      game.player.energy = 100;
      game.effects = [];
      const monster = new Monster(7, 5, 'MON_NOVICE_WARRIOR');
      monster.stats.hp = 100;
      monster.stats.maxHp = 100;
      game.monsters = [monster];
      game.map = {
        width: 30,
        height: 30,
        isWalkable: () => true,
        isTransparent: () => true,
        getTile: (x, y) => ({ x, y, isWalkable: true, type: 'FLOOR', char: '.' })
      };

      const initialHp = monster.stats.hp;
      const success = game.castActiveSkill(1);

      expect(success).toBe(true);
      expect(monster.stats.hp).toBeLessThan(initialHp);
      expect(game.effects.length).toBeGreaterThan(0);
      expect(game.effects.some(e => e.constructor.name === 'ProjectileEffect' || e.startX !== undefined)).toBe(true);
      expect(game.effects.some(e => e.constructor.name === 'FloatingTextEffect' || e.text !== undefined)).toBe(true);
    });

    it('verifies IMP auto-cast deterministically triggers offensive spell on turn advance when enemies in range', () => {
      const game = new Game();
      game.player = new Player(5, 5, 'MON_IMP');
      game.player.energy = 100;
      game.effects = [];
      const monster = new Monster(8, 5, 'MON_NOVICE_WARRIOR');
      monster.stats.hp = 100;
      monster.stats.maxHp = 100;
      game.monsters = [monster];
      game.map = {
        width: 30,
        height: 30,
        isWalkable: () => true,
        isTransparent: () => true,
        getTile: (x, y) => ({ x, y, isWalkable: true, type: 'FLOOR', char: '.' })
      };

      const skills = game.player.getInnateSkills();
      const fireSkill = skills.find(s => s.slot === 1);
      expect(fireSkill).toBeDefined();
      expect(game.player.isAutoCastEnabled(fireSkill.id)).toBe(true);
      expect(game.player.getTracker(fireSkill.id, 'cooldown')).toBe(0);

      const initialHp = monster.stats.hp;
      // Advance turn by moving player
      game.movePlayer(0, 1);

      // Verify that auto-cast fired, dealt damage, and triggered cooldown and effects
      expect(monster.stats.hp).toBeLessThan(initialHp);
      expect(game.effects.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 3. Spell Starvation Prevention & Apex Skills
  // =========================================================================
  describe('Contract 3: 4-Slot Role Separation & Spell Starvation Prevention', () => {
    it('ensures casters and dragon monsters retain spells/breaths in Slot 4', () => {
      // Novice mage: has MISSILE on Slot 1, and spells distributed across slots
      const mageSkills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet('MON_NOVICE_MAGE');
      expect(mageSkills[0].slot).toBe(1);
      expect(mageSkills[0].type).toBe('PROJECTILE');
      expect(mageSkills[0].requiredMastery).toBe(1);
      expect(['마법 화살', '화염 화살', '냉기 화살', '마법 미사일']).toContain(mageSkills[0].name);

      expect(mageSkills[3].slot).toBe(4);
      expect(mageSkills[3].requiredMastery).toBe(6);

      // Baby red dragon: breathElement FIRE
      const redDragonSkills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet('MON_BABY_RED_DRAGON');
      expect(redDragonSkills[3].slot).toBe(4);
      expect(redDragonSkills[3].name).toBe('화염의 숨결');
      expect(redDragonSkills[3].element).toBe('FIRE');

      // Ancient multi-hued dragon: multiple breaths
      const ancientDragonSkills = ProceduralSkillSynthesizer.synthesizeMonsterSkillSet('MON_ANCIENT_MULTI_HUED_DRAGON');
      expect(ancientDragonSkills[3].slot).toBe(4);
      expect(ancientDragonSkills[3].name).toContain('숨결');
    });
  });

  // =========================================================================
  // 4. Gameplay Engine Integration: Gimmicks & Passives
  // =========================================================================
  describe('Contract 4: Gameplay Engine & Passive Integration', () => {
    it('defines WARRIOR and ROGUE growth patterns in MONSTER_GROWTH_PATTERNS', () => {
      expect(MONSTER_GROWTH_PATTERNS.WARRIOR).toBeDefined();
      expect(MONSTER_GROWTH_PATTERNS.WARRIOR.str).toBeGreaterThan(1.0);
      expect(MONSTER_GROWTH_PATTERNS.WARRIOR.hp).toBeGreaterThan(1.0);

      expect(MONSTER_GROWTH_PATTERNS.ROGUE).toBeDefined();
      expect(MONSTER_GROWTH_PATTERNS.ROGUE.dex).toBeGreaterThan(1.0);
    });

    it('verifies FORCE_MAXHP increases monster and player max HP by +25%', () => {
      // Monster with FORCE_MAXHP
      const baseMonster = new Monster(0, 0, 'MON_NOVICE_WARRIOR');
      const titan = new Monster({
        type: 'MON_NOVICE_WARRIOR',
        name: 'Force warrior',
        flags: ['FORCE_MAXHP']
      });
      expect(titan.stats.maxHp).toBeGreaterThanOrEqual(Math.floor(baseMonster.stats.maxHp * 1.25));

      // Player with FORCE_MAXHP
      const player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
      player.mimicCore.flags = ['FORCE_MAXHP'];
      const hpWithFlag = player.getMaxHp();
      player.mimicCore.flags = [];
      const hpWithoutFlag = player.getMaxHp();
      expect(hpWithFlag).toBe(Math.floor(hpWithoutFlag * 1.25));
    });

    it('verifies Giant / Troll / Ogre regeneration and Slime acid counter in CombatCalculator deterministically', () => {
      const mockGame = { addLogEntry: vi.fn(), map: { getTile: () => ({ isWalkable: true }) } };
      const player = new Player(10, 10, 'MON_NOVICE_WARRIOR');
      player.stats = { hp: 50, maxHp: 50 };

      // Ogre monster
      const ogre = new Monster(0, 0, 'MON_OGRE');
      ogre.stats.maxHp = 100;
      ogre.stats.hp = 20;
      ogre.giantBloodCooldown = 0;

      // 100% deterministic test with rng injection: roll < threshold triggers regen
      CombatCalculator.processGenericAttackSynergies(player, ogre, {}, 10, mockGame, { rng: () => 0.0 });
      expect(ogre.stats.hp).toBeGreaterThan(20);
      expect(ogre.giantBloodCooldown).toBeGreaterThan(0);

      // Cooldown prevents regen even if roll is 0.0
      const hpAfterRegen = ogre.stats.hp;
      CombatCalculator.processGenericAttackSynergies(player, ogre, {}, 10, mockGame, { rng: () => 0.0 });
      expect(ogre.stats.hp).toBe(hpAfterRegen);

      // Reset cooldown, roll >= threshold does not trigger regen
      ogre.giantBloodCooldown = 0;
      CombatCalculator.processGenericAttackSynergies(player, ogre, {}, 10, mockGame, { rng: () => 0.99 });
      expect(ogre.stats.hp).toBe(hpAfterRegen);

      // Slime monster acid reflection (char: 'j')
      const slime = new Monster(0, 0, 'MON_GREEN_JELLY');
      slime.stats.maxHp = 50;
      slime.stats.hp = 50;
      player.stats.hp = 50;

      // 100% deterministic test with rng injection: roll < threshold triggers acid counter
      CombatCalculator.processGenericAttackSynergies(player, slime, {}, 10, mockGame, { rng: () => 0.0 });
      expect(player.stats.hp).toBeLessThan(50);

      // Roll >= threshold does not trigger acid counter
      player.stats.hp = 50;
      CombatCalculator.processGenericAttackSynergies(player, slime, {}, 10, mockGame, { rng: () => 0.99 });
      expect(player.stats.hp).toBe(50);
    });

    it('verifies PASS_WALL allows passing non-border walls and blocks border breach', () => {
      const map = {
        width: 20,
        height: 20,
        tiles: Array.from({ length: 20 }, (_, y) =>
          Array.from({ length: 20 }, (_, x) => ({
            type: (x === 0 || y === 0 || x === 19 || y === 19 || x === 10) ? 'WALL' : 'FLOOR',
            char: (x === 0 || y === 0 || x === 19 || y === 19 || x === 10) ? '#' : '.',
            isWalkable: !(x === 0 || y === 0 || x === 19 || y === 19 || x === 10)
          }))
        ),
        isWalkable(x, y) {
          return this.tiles[y]?.[x]?.isWalkable ?? false;
        },
        getTile(x, y) {
          return this.tiles[y]?.[x];
        }
      };

      const player = new Player(9, 10, 'MON_NOVICE_WARRIOR');
      player.statuses = { PASS_WALL: { duration: 5 } };
      expect(player.hasPassWall()).toBe(true);

      // Move into inner wall at (10, 10) -> Should succeed!
      const moved = player.move(1, 0, map);
      expect(moved).toBe(true);
      expect(player.x).toBe(10);
      expect(player.y).toBe(10);

      // Now place player at (1, 1) and attempt to move into border at (0, 1) -> Must FAIL!
      player.x = 1;
      player.y = 1;
      const borderMoved = player.move(-1, 0, map);
      expect(borderMoved).toBe(false);
      expect(player.x).toBe(1);
    });

    it('verifies KILL_WALL carves walls into floor and updates map', () => {
      const map = {
        width: 20,
        height: 20,
        tiles: Array.from({ length: 20 }, (_, y) =>
          Array.from({ length: 20 }, (_, x) => ({
            type: (x === 0 || y === 0 || x === 19 || y === 19 || x === 5) ? 'WALL' : 'FLOOR',
            char: (x === 0 || y === 0 || x === 19 || y === 19 || x === 5) ? '#' : '.',
            isWalkable: !(x === 0 || y === 0 || x === 19 || y === 19 || x === 5),
            blocksVision: (x === 0 || y === 0 || x === 19 || y === 19 || x === 5)
          }))
        ),
        isWalkable(x, y) {
          return this.tiles[y]?.[x]?.isWalkable ?? false;
        },
        getTile(x, y) {
          return this.tiles[y]?.[x];
        }
      };

      const player = new Player(4, 5, 'MON_NOVICE_WARRIOR');
      player.mimicCore.flags = ['KILL_WALL'];
      expect(player.hasKillWall()).toBe(true);

      const targetTile = map.getTile(5, 5);
      expect(targetTile.isWalkable).toBe(false);

      // Move into wall at (5, 5) -> Carves wall!
      const moved = player.move(1, 0, map);
      expect(moved).toBe(true);
      expect(player.x).toBe(5);
      expect(targetTile.type).toBe('FLOOR');
      expect(targetTile.char).toBe('.');
      expect(targetTile.isWalkable).toBe(true);
    });

    it('verifies CAN_FLY ignores floor traps in Game.movePlayer', () => {
      const game = new Game();
      game.map = {
        width: 20,
        height: 20,
        tiles: Array.from({ length: 20 }, (_, y) =>
          Array.from({ length: 20 }, (_, x) => ({
            type: 'FLOOR',
            char: '.',
            isWalkable: true,
            isTrap: (x === 6 && y === 5)
          }))
        ),
        isWalkable() { return true; },
        getTile(x, y) { return this.tiles[y]?.[x]; }
      };

      game.player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
      game.player.mimicCore.flags = ['CAN_FLY'];
      game.player.stats.hp = 100;
      game.player.stats.maxHp = 100;
      expect(game.player.canFly).toBe(true);

      // Move onto trap at (6, 5)
      game.movePlayer(1, 0);
      expect(game.player.x).toBe(6);
      expect(game.player.y).toBe(5);
      // HP remains 100 because trap was bypassed by flight
      expect(game.player.stats.hp).toBe(100);
    });
  });
});
