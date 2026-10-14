import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup Mock DOM environment for Game and Input
const mockCtx = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'measureText') return () => ({ width: 10 });
    return () => ({});
  }
});
const mockCanvas = {
  getContext: () => mockCtx,
  width: 800,
  height: 600,
  style: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  appendChild: () => {},
  removeChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  children: []
};
global.document = {
  getElementById: () => mockCanvas,
  createElement: (tag) => {
    if (tag === 'canvas') return { ...mockCanvas };
    return {
      style: {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      innerHTML: '',
      appendChild: () => {},
      setAttribute: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
    };
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  body: {
    appendChild: () => {},
    style: {}
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.window = {
  innerWidth: 800,
  innerHeight: 600,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { search: '' },
  localStorage: { getItem: () => null, setItem: () => {} }
};

import { StatusEffectEngine } from '../src/systems/StatusEffectEngine.js';
import { TomeConsumableEngine } from '../src/systems/TomeConsumableEngine.js';
import { TomeDeviceEngine } from '../src/systems/TomeDeviceEngine.js';
import { ArtifactActivationEngine } from '../src/systems/ArtifactActivationEngine.js';
import { ItemSchemaInterpreter } from '../src/systems/ItemSchemaInterpreter.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Game } from '../src/core/Game.js';
import { Input } from '../src/core/Input.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';
import { renderItemDetailHTML } from '../src/ui/InventoryView.js';

describe('Argon Phase 3: Item Schema Interpreter, Device & Turn/Input Contract Tests', () => {
  let player;
  let mockGame;

  beforeEach(() => {
    player = new Player(10, 10, 'MON_NOVICE_WARRIOR');
    player.statuses = {};
    player.energy = 100;
    player.isAutoCastEnabled = false;

    mockGame = {
      player,
      monsters: [],
      items: [],
      floor: 1,
      playerTurn: true,
      map: {
        width: 30,
        height: 30,
        isWalkable: () => true,
        getTile: (x, y) => ({ x, y, isWalkable: true, type: 'FLOOR', char: '.' }),
        revealAll: vi.fn(),
        rooms: [{ center: { x: 5, y: 5 } }]
      },
      addLogEntry: vi.fn(),
      bossPhaseEngine: {
        checkPhaseTransition: vi.fn()
      }
    };
  });

  describe('Verification 1: Potions, Mushrooms & StatusEffectEngine Contract', () => {
    it('drinking Potion of Naivety (tval: 71, sval: 18) does NOT grant haste, decreases wis, and applies WEAKEN', () => {
      const initialWis = player.baseStats ? player.baseStats.wis : 10;
      const naivetyPotion = { tval: 71, sval: 18, name: 'Potion of Naivety', count: 1 };

      const res = TomeConsumableEngine.useConsumable(naivetyPotion, player, mockGame);
      expect(res).toBe(true);

      // Must NOT grant haste
      expect(StatusEffectEngine.hasStatus(player, 'HASTE')).toBe(false);
      expect(player.speedBuffTurns || 0).toBe(0);

      // Must reduce wisdom and apply WEAKEN
      const currentWis = player.baseStats ? player.baseStats.wis : (player.stats.wis || 10);
      expect(currentWis).toBeLessThan(initialWis);
      expect(StatusEffectEngine.hasStatus(player, 'WEAKEN')).toBe(true);
    });

    it('legacy speed potion with sval: 29 or name containing 가속 still grants HASTE', () => {
      const speedPotion = { tval: 71, sval: 29, name: '가속의 물약', count: 1 };

      const res = TomeConsumableEngine.useConsumable(speedPotion, player, mockGame);
      expect(res).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'HASTE')).toBe(true);
      expect(player.speedBuffTurns).toBeGreaterThan(0);
    });

    it('applies real active statuses for Heroism, Berserk, Invulnerability, Resist Heat/Cold', () => {
      // 1. Resist Heat (sval: 30) -> RES_FIRE
      const heatPotion = { tval: 71, sval: 30, name: 'Resist Heat', count: 1 };
      TomeConsumableEngine.useConsumable(heatPotion, player, mockGame);
      expect(StatusEffectEngine.hasStatus(player, 'RES_FIRE')).toBe(true);

      // 2. Resist Cold (sval: 31) -> RES_COLD
      const coldPotion = { tval: 71, sval: 31, name: 'Resist Cold', count: 1 };
      TomeConsumableEngine.useConsumable(coldPotion, player, mockGame);
      expect(StatusEffectEngine.hasStatus(player, 'RES_COLD')).toBe(true);

      // 3. Heroism (sval: 32) -> HEROISM
      player.stats.hp = 10;
      const heroismPotion = { tval: 71, sval: 32, name: 'Heroism', count: 1 };
      TomeConsumableEngine.useConsumable(heroismPotion, player, mockGame);
      expect(StatusEffectEngine.hasStatus(player, 'HEROISM')).toBe(true);
      expect(player.stats.hp).toBeGreaterThanOrEqual(20);

      // 4. Berserk Strength (sval: 33) -> BERSERK
      const berserkPotion = { tval: 71, sval: 33, name: 'Berserk Strength', count: 1 };
      TomeConsumableEngine.useConsumable(berserkPotion, player, mockGame);
      expect(StatusEffectEngine.hasStatus(player, 'BERSERK')).toBe(true);

      // 5. Invulnerability (sval: 62) -> INVULN
      const invulnPotion = { tval: 71, sval: 62, name: 'Invulnerability', count: 1 };
      TomeConsumableEngine.useConsumable(invulnPotion, player, mockGame);
      expect(StatusEffectEngine.hasStatus(player, 'INVULN')).toBe(true);
    });

    it('eating magic mushroom triggers authentic status effects and identifies flavor', () => {
      const blindMushroom = { tval: 80, sval: 1, name: 'Mushroom of Blindness', count: 1 };
      const res = TomeConsumableEngine.useConsumable(blindMushroom, player, mockGame);
      expect(res).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'BLIND')).toBe(true);
      expect(blindMushroom.identified).toBe(true);
    });
  });

  describe('Verification 2: Monster Kills with Wand/Rod/Staff and *Destruction* Scroll', () => {
    let targetMonster;

    beforeEach(() => {
      targetMonster = new Monster(11, 10, 'ORC', 1, [], []);
      targetMonster.stats = { hp: 10, maxHp: 10 };
      targetMonster.xpValue = 50;
      targetMonster.level = 1;
      mockGame.monsters = [targetMonster];
    });

    it('killing monster with Wand in TomeDeviceEngine awards XP and calls LootSystem.processMonsterDeath', () => {
      const spyLoot = vi.spyOn(LootSystem, 'processMonsterDeath');
      const spyGainXp = vi.spyOn(player, 'gainXp');
      const startXp = player.xp || 0;
      const startLevel = player.level || 1;

      // Mock random to guarantee activation success
      const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Wand of Fireflash (sval: 4) deals 40 damage
      const wand = { tval: 65, sval: 4, name: 'Wand of Fireflash', charges: 3 };
      const res = TomeDeviceEngine.useWand(wand, player, mockGame, mockGame.addLogEntry, 4);

      expect(res).toBe(true);
      expect(spyLoot).toHaveBeenCalled();
      expect(spyGainXp).toHaveBeenCalled();
      expect(player.level > startLevel || player.xp > startXp).toBe(true);
      expect(mockGame.monsters.includes(targetMonster)).toBe(false);

      spyRandom.mockRestore();
      spyLoot.mockRestore();
      spyGainXp.mockRestore();
    });

    it('killing monster with Rod in TomeDeviceEngine awards XP and calls LootSystem.processMonsterDeath', () => {
      const spyLoot = vi.spyOn(LootSystem, 'processMonsterDeath');
      const spyGainXp = vi.spyOn(player, 'gainXp');
      const startXp = player.xp || 0;
      const startLevel = player.level || 1;

      // Rod of Acid Bolts (sval: 20) deals 30 damage
      const rod = { tval: 66, sval: 20, name: 'Rod of Acid Bolts', timeout: 0 };
      const res = TomeDeviceEngine.useRod(rod, player, mockGame, mockGame.addLogEntry, 20);

      expect(res).toBe(true);
      expect(rod.timeout).toBeGreaterThan(0);
      expect(spyLoot).toHaveBeenCalled();
      expect(spyGainXp).toHaveBeenCalled();
      expect(player.level > startLevel || player.xp > startXp).toBe(true);
      expect(mockGame.monsters.includes(targetMonster)).toBe(false);

      spyLoot.mockRestore();
      spyGainXp.mockRestore();
    });

    it('killing monster with Staff in TomeDeviceEngine awards XP and calls LootSystem.processMonsterDeath', () => {
      const spyLoot = vi.spyOn(LootSystem, 'processMonsterDeath');
      const spyGainXp = vi.spyOn(player, 'gainXp');
      const startXp = player.xp || 0;
      const startLevel = player.level || 1;

      const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Staff of Shake (Earthquake, sval: 7) deals 35 AoE damage
      const staff = { tval: 55, sval: 7, name: 'Staff of Earthquakes', charges: 2 };
      const res = TomeDeviceEngine.useStaff(staff, player, mockGame, mockGame.addLogEntry, 7);

      expect(res).toBe(true);
      expect(spyLoot).toHaveBeenCalled();
      expect(spyGainXp).toHaveBeenCalled();
      expect(player.level > startLevel || player.xp > startXp).toBe(true);
      expect(mockGame.monsters.includes(targetMonster)).toBe(false);

      spyRandom.mockRestore();
      spyLoot.mockRestore();
      spyGainXp.mockRestore();
    });

    it('killing monsters with *Destruction* scroll awards XP and routes through LootSystem.processMonsterDeath', () => {
      const spyLoot = vi.spyOn(LootSystem, 'processMonsterDeath');
      const spyGainXp = vi.spyOn(player, 'gainXp');
      const startXp = player.xp || 0;
      const startLevel = player.level || 1;

      const destructionScroll = { tval: 70, sval: 41, name: 'Scroll of *Destruction*', count: 1 };
      const res = TomeConsumableEngine.useConsumable(destructionScroll, player, mockGame);

      expect(res).toBe(true);
      expect(spyLoot).toHaveBeenCalled();
      expect(spyGainXp).toHaveBeenCalled();
      expect(player.level > startLevel || player.xp > startXp).toBe(true);
      expect(mockGame.monsters.includes(targetMonster)).toBe(false);

      spyLoot.mockRestore();
      spyGainXp.mockRestore();
    });
  });

  describe('Verification 3: Artifact Activation Engine Completeness (All 81 Activatable Artifacts)', () => {
    it('resolves and executes all 81 activatable artifacts in TOME_ARTIFACTS_DATA and sets item.timeout', () => {
      const activatableEntries = Object.entries(TOME_ARTIFACTS_DATA).filter(([k, v]) => {
        return v.activate || (v.flags && v.flags.includes('ACTIVATE'));
      });

      expect(activatableEntries.length).toBe(81);

      let successCount = 0;
      for (const [artKey, artData] of activatableEntries) {
        const item = { ...artData, artifactKey: artKey, name: artData.name };
        const testP = new Player(10, 10, 'MON_NOVICE_WARRIOR');
        testP.artifactCooldowns = {};

        const res = ArtifactActivationEngine.activateArtifact(item, testP, mockGame);
        if (res.success && item.timeout > 0) {
          successCount++;
        }
      }

      expect(successCount).toBe(81);
    });

    it('supports activating specific legendary artifacts (Ringil, Narya, Boromir) with positional and object signatures', () => {
      const ringil = { artifactKey: 'ART_RINGIL', name: 'Ringil', flags: ['ACTIVATE'] };
      const resPos = ArtifactActivationEngine.activateArtifact(ringil, player, mockGame);
      expect(resPos.success).toBe(true);
      expect(ringil.timeout).toBeGreaterThan(0);

      // Clear cooldown for next test
      player.artifactCooldowns = {};
      if (player.setTracker) player.setTracker('ART_CD_ART_RINGIL', 'cooldown', 0);
      delete ringil.timeout;
      delete ringil.currentCooldown;

      const resObj = ArtifactActivationEngine.activateArtifact({ item: ringil, player, game: mockGame });
      expect(resObj.success).toBe(true);
      expect(ringil.timeout).toBeGreaterThan(0);
    });
  });

  describe('Verification 4: Turn Contract, Energy Deduction & Rod Timeout Ticking in Game.js', () => {
    let game;

    beforeEach(() => {
      game = new Game();
      game.player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
      game.player.energy = 100;
      game.monsters = [];
    });

    it('using an item via game.useItem(item) consumes 100 energy and advances runTurnLoop', () => {
      let energyBeforeLoop = null;
      const spyTurnLoop = vi.spyOn(game, 'runTurnLoop').mockImplementation(function() {
        energyBeforeLoop = this.player.energy;
      });
      const potion = { tval: 71, sval: 34, name: 'Cure Light Wounds', count: 1 };
      game.player.inventory = [potion];

      const success = game.useItem(potion);
      expect(success).toBe(true);
      expect(energyBeforeLoop).toBe(0);
      expect(spyTurnLoop).toHaveBeenCalled();

      spyTurnLoop.mockRestore();
    });

    it('activating an artifact via game.activateItem(item) consumes 100 energy and advances runTurnLoop', () => {
      let energyBeforeLoop = null;
      const spyTurnLoop = vi.spyOn(game, 'runTurnLoop').mockImplementation(function() {
        energyBeforeLoop = this.player.energy;
      });
      const ringil = { artifactKey: 'ART_RINGIL', name: 'Ringil', flags: ['ACTIVATE'] };

      const success = game.activateItem(ringil);
      expect(success).toBe(true);
      expect(energyBeforeLoop).toBe(0);
      expect(ringil.timeout).toBeGreaterThan(0);
      expect(spyTurnLoop).toHaveBeenCalled();

      spyTurnLoop.mockRestore();
    });

    it('ticks down Rod timeout and Artifact cooldown in runTurnLoop', () => {
      const rod = { tval: 66, sval: 20, name: 'Rod of Acid Bolts', timeout: 5 };
      game.player.inventory = [rod];
      game.player.artifactCooldowns = { ART_RINGIL: 4 };

      game.runTurnLoop();

      expect(rod.timeout).toBe(4);
      expect(game.player.artifactCooldowns.ART_RINGIL).toBe(3);
    });
  });

  describe('Verification 5: Auto-Cast Suppression & Cooldown Non-Duplication Contract', () => {
    let game;

    beforeEach(() => {
      game = new Game();
      game.player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
      game.player.energy = 100;
      game.player.isAutoCastEnabled = false;
      game.monsters = [];
      game.map = {
        width: 30,
        height: 30,
        isWalkable: () => true,
        getTile: (x, y) => ({ x, y, isWalkable: true, type: 'FLOOR', char: '.' })
      };
    });

    it('moving 1 step with isAutoCastEnabled = false does NOT auto-cast skills', () => {
      const spyAutoSkills = vi.spyOn(game.player, 'tryAutoCastInnateSkills');
      const startX = game.player.x;

      game.movePlayer(1, 0);

      expect(game.player.x).toBe(startX + 1);
      expect(spyAutoSkills).not.toHaveBeenCalled();

      spyAutoSkills.mockRestore();
    });

    it('moving 1 step does NOT double-tick cooldowns (cooldown only ticks once per turn in runTurnLoop)', () => {
      const skill = { id: 'TEST_SKILL', cooldown: 5, currentCooldown: 5 };
      game.player.getInnateSkills = () => [skill];
      game.player.decrementCooldown = vi.fn((id) => {
        if (id === 'TEST_SKILL') skill.currentCooldown--;
      });

      game.movePlayer(1, 0);

      // Decrement must be called exactly once per step (inside runTurnLoop)
      expect(game.player.decrementCooldown).toHaveBeenCalledTimes(1);
      expect(skill.currentCooldown).toBe(4);
    });
  });

  describe('Task 2 & 4: Input Key Resolution & Map Interactions (Doors & Traps)', () => {
    let input;
    let game;

    beforeEach(() => {
      input = new Input();
      game = new Game();
      game.player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
      game.monsters = [];
    });

    it('resolves >, <, Period, Comma for stairs, KeyR for rest, KeyF for fire, KeyQ/KeyE for camera', () => {
      expect(input.resolveAction({ key: '>' })).toBe('STAIRS_DOWN');
      expect(input.resolveAction({ key: '<' })).toBe('STAIRS_UP');
      expect(input.resolveAction({ code: 'Period' })).toBe('STAIRS_DOWN');
      expect(input.resolveAction({ code: 'Comma' })).toBe('STAIRS_UP');
      expect(input.resolveAction({ code: 'Period', shiftKey: true })).toBe('STAIRS_DOWN');
      expect(input.resolveAction({ code: 'Comma', shiftKey: true })).toBe('STAIRS_UP');
      expect(input.resolveAction({ key: '.' })).toBe('WAIT');
      expect(input.resolveAction({ code: 'KeyR' })).toBe('REST');
      expect(input.resolveAction({ code: 'KeyF' })).toBe('FIRE');
      expect(input.resolveAction({ code: 'KeyQ' })).toBe('CAMERA_LEFT');
      expect(input.resolveAction({ code: 'KeyE' })).toBe('CAMERA_RIGHT');
    });

    it('opens CLOSED_DOOR when player walks into door tile', () => {
      const doorTile = { x: 6, y: 5, type: 'CLOSED_DOOR', char: '+', isWalkable: false, blocksVision: true };
      game.map = {
        getTile: (x, y) => (x === 6 && y === 5 ? doorTile : { x, y, isWalkable: true, type: 'FLOOR', char: '.' })
      };

      const moved = game.movePlayer(1, 0);
      expect(moved).toBe(true);
      expect(doorTile.type).toBe('OPEN_DOOR');
      expect(doorTile.char).toBe("'");
      expect(doorTile.isWalkable).toBe(true);
      expect(doorTile.blocksVision).toBe(false);
      // Player opened door without stepping inside yet
      expect(game.player.x).toBe(5);
    });

    it('steps onto TRAP tile and triggers trap check (damage or disarm)', () => {
      const trapTile = { x: 6, y: 5, type: 'TRAP', char: '^', isTrap: true, isWalkable: true };
      game.map = {
        getTile: (x, y) => (x === 6 && y === 5 ? trapTile : { x, y, isWalkable: true, type: 'FLOOR', char: '.' }),
        isWalkable: () => true
      };

      const startHp = game.player.stats.hp;
      game.movePlayer(1, 0);

      expect(game.player.x).toBe(6);
      // Either disarmed (trapTile.isDisarmed === true) or player took trap damage
      const wasDisarmed = trapTile.isDisarmed === true && trapTile.char === '.';
      const tookDamage = game.player.stats.hp < startHp;
      expect(wasDisarmed || tookDamage).toBe(true);
    });
  });

  describe('InventoryView: Artifact Activation UI Rendering', () => {
    it('renders [⚡ 유물 발동 (Activate)] button in renderItemDetailHTML for activatable artifacts', () => {
      const ringil = {
        artifactKey: 'ART_RINGIL',
        name: 'Ringil',
        char: '|',
        color: '#ffd700',
        flags: ['ACTIVATE'],
        specialTags: ['ARTIFACT'],
        timeout: 0
      };

      const html = renderItemDetailHTML(ringil, player, false, false, false, false, false);
      expect(html).toContain('detail-activate-btn');
      expect(html).toContain('⚡ 유물 발동 (Activate)');
    });
  });

  describe('ItemSchemaInterpreter Canonical Translation', () => {
    it('interprets items into valid EffectOp[] array', () => {
      const wand = { tval: 65, sval: 4, name: 'Wand of Fireflash' };
      const ops = ItemSchemaInterpreter.interpretItem(wand);

      expect(Array.isArray(ops)).toBe(true);
      expect(ops.length).toBeGreaterThan(0);
      expect(ops[0].op).toBe('PROJECT_AREA');
      expect(ops[0].element).toBe('FIRE');
    });

    it('executes item directly via EffectVM in executeItem', () => {
      const heroismPotion = { tval: 71, sval: 32, name: 'Heroism' };
      const res = ItemSchemaInterpreter.executeItem(heroismPotion, { caster: player, game: mockGame });

      expect(res.success).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'HEROISM')).toBe(true);
    });
  });

  describe('Argon Hotfix: Monster Turn Loop Contract & Game Method Bindings', () => {
    let game;
    let monster;

    beforeEach(() => {
      game = new Game();
      game.player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
      game.player.energy = 0;
      game.player.stats.hp = 100;
      game.player.stats.maxHp = 100;

      monster = new Monster(5, 7, 'MON_SCAVENGER_RAT', 'Scavenger Rat');
      monster.energy = 100;
      monster.stats = { hp: 20, maxHp: 20, speed: 110, plev: 1 };

      game.monsters = [monster];
      game.map = {
        width: 20,
        height: 20,
        isWalkable: () => true,
        getTile: (x, y) => ({ x, y, isWalkable: true, type: 'FLOOR', char: '.' }),
        isTransparent: () => true
      };
    });

    it('verifies Game.prototype has isMonsterAt, getMonsterAt, updateFOV, attackPlayer, useMonsterBreath, handleMonsterBuffsAndHeals', () => {
      expect(typeof game.isMonsterAt).toBe('function');
      expect(typeof game.getMonsterAt).toBe('function');
      expect(typeof game.updateFOV).toBe('function');
      expect(typeof game.attackPlayer).toBe('function');
      expect(typeof game.useMonsterBreath).toBe('function');
      expect(typeof game.handleMonsterBuffsAndHeals).toBe('function');

      expect(game.isMonsterAt(5, 7)).toBe(true);
      expect(game.isMonsterAt(1, 1)).toBe(false);
      expect(game.getMonsterAt(5, 7)).toBe(monster);
      expect(game.getMonsterAt(1, 1)).toBe(null);

      // Dead monsters should not register
      monster.stats.hp = 0;
      expect(game.isMonsterAt(5, 7)).toBe(false);
      expect(game.getMonsterAt(5, 7)).toBe(null);
    });

    it('runs _runTurnLoopChunk with live monster and executes monster.act without errors', () => {
      monster.stats.hp = 20;
      monster.energy = 100;

      const spyIsMonsterAt = vi.spyOn(game, 'isMonsterAt');
      const spyHandleBuffs = vi.spyOn(game, 'handleMonsterBuffsAndHeals');
      const logEntries = [];
      game.addLogEntry = vi.fn((msg, type) => {
        logEntries.push({ msg, type });
      });

      // Monster at (5, 7) moves towards player at (5, 5) and calls isMonsterAt
      game._loopState = { e: 0, globalTicks: 0, monsterActCount: 0 };
      game._runTurnLoopChunk();

      const errorLogs = logEntries.filter(l => l.msg && l.msg.includes('몬스터 행동 오류'));
      expect(errorLogs).toHaveLength(0);
      expect(spyHandleBuffs).toHaveBeenCalled();
      expect(spyIsMonsterAt).toHaveBeenCalled();
    });

    it('executes monster melee attack via attackPlayer when adjacent during turn loop', () => {
      monster.stats.hp = 20;
      monster.energy = 100;
      // Position adjacent to player (5, 5) -> (5, 6)
      monster.x = 5;
      monster.y = 6;

      const spyAttackPlayer = vi.spyOn(game, 'attackPlayer');
      const logEntries = [];
      game.addLogEntry = vi.fn((msg, type) => {
        logEntries.push({ msg, type });
      });

      game._loopState = { e: 0, globalTicks: 0, monsterActCount: 0 };
      game._runTurnLoopChunk();

      const errorLogs = logEntries.filter(l => l.msg && l.msg.includes('몬스터 행동 오류'));
      expect(errorLogs).toHaveLength(0);
      expect(spyAttackPlayer).toHaveBeenCalled();
    });

    it('verifies useMonsterBreath and handleMonsterBuffsAndHeals execute without throwing', () => {
      monster.stats.hp = 20;
      expect(() => {
        game.handleMonsterBuffsAndHeals(monster);
      }).not.toThrow();

      expect(() => {
        game.useMonsterBreath(monster, 'FIRE', 10, '불꽃 브레스');
      }).not.toThrow();
    });

    it('audits that 100% of this.<methodName>( calls across Game.js exist on Game.prototype', async () => {
      const fs = await import('fs');
      const code = fs.readFileSync('src/core/Game.js', 'utf8');
      const matches = [...code.matchAll(/this\.([a-zA-Z0-9_$]+)\s*\(/g)];
      const methodNames = new Set(matches.map(m => m[1]));

      const proto = Game.prototype;
      const missing = [];
      for (const name of methodNames) {
        if (typeof proto[name] !== 'function') {
          missing.push(name);
        }
      }

      expect(missing).toEqual([]);
    });
  });

  describe('Hotfix Verification: Scroll Effects & Obsolete Status Panel Removal Contract', () => {
    let hotfixPlayer, hotfixGame, testWeapon;

    beforeEach(() => {
      hotfixPlayer = new Player(10, 10, 'MON_NOVICE_WARRIOR');
      testWeapon = { name: 'Long Sword', upgradeLevel: 0, toHit: 0, toDmg: 0 };
      hotfixPlayer.equipment = { weapon: testWeapon };

      const tiles = Array.from({ length: 25 }, () =>
        Array.from({ length: 25 }, () => ({
          isWalkable: true,
          isExplored: false,
          explored: false,
          revealed: false,
          lit: false,
          type: 'FLOOR',
          char: '.'
        }))
      );

      hotfixGame = {
        player: hotfixPlayer,
        map: {
          width: 25,
          height: 25,
          tiles,
          getTile: (x, y) => tiles[y]?.[x] || null,
          isWalkable: (x, y) => true
        },
        items: [],
        monsters: [],
        addLogEntry: vi.fn(),
        updateFOV: vi.fn()
      };
    });

    it('[1] Object Detection (sval 27), Trap Detection (sval 28), Light (sval 24), Darkness (sval 0) scrolls NEVER enchant weapon and execute their original effects', () => {
      // 1. Object Detection (sval: 27)
      const groundItem = { x: 12, y: 12, name: 'Iron Ring', type: 'RING' };
      hotfixGame.items = [groundItem];

      const objectScroll = { tval: 70, sval: 27, name: 'Object Detection', count: 1 };
      const resObj = TomeConsumableEngine.useConsumable(objectScroll, hotfixPlayer, hotfixGame);

      expect(resObj).toBe(true);
      expect(testWeapon.upgradeLevel).toBe(0);
      expect(testWeapon.toHit).toBe(0);
      expect(testWeapon.toDmg).toBe(0);
      expect(groundItem.detected).toBe(true);
      expect(hotfixGame.map.tiles[12][12].isExplored).toBe(true);

      // 2. Trap Detection (sval: 28)
      hotfixGame.map.tiles[15][15].isTrap = true;
      hotfixGame.map.tiles[15][15].type = 'TRAP';
      hotfixGame.map.tiles[15][15].char = '^';

      const trapScroll = { tval: 70, sval: 28, name: 'Trap Detection', count: 1 };
      const resTrap = TomeConsumableEngine.useConsumable(trapScroll, hotfixPlayer, hotfixGame);

      expect(resTrap).toBe(true);
      expect(testWeapon.upgradeLevel).toBe(0);
      expect(testWeapon.toHit).toBe(0);
      expect(testWeapon.toDmg).toBe(0);
      expect(hotfixGame.map.tiles[15][15].trapDetected).toBe(true);
      expect(hotfixGame.map.tiles[15][15].isExplored).toBe(true);

      // 3. Light (sval: 24)
      const lightScroll = { tval: 70, sval: 24, name: 'Light', count: 1 };
      const resLight = TomeConsumableEngine.useConsumable(lightScroll, hotfixPlayer, hotfixGame);

      expect(resLight).toBe(true);
      expect(testWeapon.upgradeLevel).toBe(0);
      expect(testWeapon.toHit).toBe(0);
      expect(testWeapon.toDmg).toBe(0);
      expect(hotfixGame.map.tiles[10][10].lit).toBe(true);
      expect(hotfixGame.map.tiles[10][10].isExplored).toBe(true);

      // 4. Darkness (sval: 0)
      const darkScroll = { tval: 70, sval: 0, name: 'Darkness', count: 1 };
      const resDark = TomeConsumableEngine.useConsumable(darkScroll, hotfixPlayer, hotfixGame);

      expect(resDark).toBe(true);
      expect(testWeapon.upgradeLevel).toBe(0);
      expect(testWeapon.toHit).toBe(0);
      expect(testWeapon.toDmg).toBe(0);
      expect(hotfixGame.map.tiles[10][10].lit).toBe(false);
      expect(StatusEffectEngine.hasStatus(hotfixPlayer, 'BLIND')).toBe(true);

      // Verify that genuine weapon enchantment scrolls (e.g. sval: 21 *Enchant Weapon*) DO increase weapon stats
      const enchantScroll = { tval: 70, sval: 21, name: '*Enchant Weapon*', count: 1 };
      const resEnchant = TomeConsumableEngine.useConsumable(enchantScroll, hotfixPlayer, hotfixGame);

      expect(resEnchant).toBe(true);
      expect(testWeapon.upgradeLevel).toBe(1);
      expect(testWeapon.toHit).toBe(1);
      expect(testWeapon.toDmg).toBe(1);
    });

    it('[2] Inventory default view does not render obsolete #player-status-panel duplicate buttons (#active-core-btn, #skill-tree-btn, etc.) and only item list and item-detail are displayed', async () => {
      const fs = await import('fs');
      const html = fs.readFileSync('index.html', 'utf8');

      // 1. Verify index.html does not contain #player-status-panel inside #inventory-split-view
      expect(html).not.toMatch(/<div\s+id=["']player-status-panel["']/);

      // 2. Mock DOM container elements for Game.renderInventoryList
      const listEl = {
        innerHTML: '',
        appendChild: vi.fn()
      };
      const detailEl = {
        innerHTML: '<div class="detail-empty">소지품에서 아이템을 선택하세요.</div>'
      };
      const panelEl = {
        innerHTML: 'OBSOLETE',
        style: {}
      };

      const elementMap = {
        'inventory-list': listEl,
        'item-detail': detailEl,
        'player-status-panel': panelEl
      };

      const originalGetElementById = global.document.getElementById;
      global.document.getElementById = vi.fn(id => elementMap[id] || originalGetElementById(id));

      try {
        const gameInstance = new Game();
        gameInstance.player = hotfixPlayer;
        gameInstance.player.inventory = [
          { name: 'Potion of Healing', type: 'POTION', char: '!', color: '#ff0000', count: 1 }
        ];

        // Call renderInventoryList
        gameInstance.renderInventoryList();

        // Ensure player-status-panel is either cleared & hidden or not populated
        expect(panelEl.innerHTML).toBe('');
        expect(panelEl.style.display).toBe('none');

        // Ensure obsolete duplicate buttons are NOT created or queried
        expect(global.document.getElementById).not.toHaveBeenCalledWith('active-core-btn');
        expect(global.document.getElementById).not.toHaveBeenCalledWith('skill-tree-btn');
        expect(global.document.getElementById).not.toHaveBeenCalledWith('char-info-btn');
        expect(global.document.getElementById).not.toHaveBeenCalledWith('mastery-info-btn');

        // Ensure inventory items were appended to listEl
        expect(listEl.appendChild).toHaveBeenCalled();
      } finally {
        global.document.getElementById = originalGetElementById;
      }
    });

    it('verifies renderItemDetailHTML for consumable with artifact activation does not throw ReferenceError on flagItems', () => {
      const activableScroll = {
        name: 'Ancient Scroll of Power',
        type: 'SCROLL',
        tval: 70,
        sval: 27,
        char: '?',
        color: '#cbd5e1',
        flavorText: 'An ancient parchment radiating mystic glow.',
        activate: {
          effectKey: 'CURE_700',
          desc: '700 HP를 즉시 회복하고 모든 상태이상을 치유합니다.'
        }
      };

      expect(() => {
        const html = renderItemDetailHTML(activableScroll, hotfixPlayer);
        expect(html).toContain('유물 발동');
      }).not.toThrow();
    });
  });
});
