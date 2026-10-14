/**
 * @file renderer_and_save_contract.test.js
 * @description Phase 4 Argon Contract Tests:
 * 1. FirstPerson3DRenderer duplicate method elimination, pick raycasting, and updateBillboards depth sorting.
 * 2. Player.reincarnate baseline reset preventing infinite baseStats compounding.
 * 3. SaveSystem 100% fidelity round-trip serialization of item, player, map.stairs, and monster contracts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

import { FirstPerson3DRenderer } from '../src/renderer/FirstPerson3DRenderer.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { Monster } from '../src/entities/Monster.js';
import { Map } from '../src/map/Map.js';
import { SaveSystem } from '../src/core/SaveSystem.js';

describe('Phase 4: FirstPerson3DRenderer Contract', () => {
  it('has no duplicate clearDynamicStairs / buildStaircaseGeometry / updateDynamicStairs method definitions', () => {
    const filePath = path.resolve(__dirname, '../src/renderer/FirstPerson3DRenderer.js');
    const source = fs.readFileSync(filePath, 'utf8');

    const countMethodDefs = (methodName) => {
      const regex = new RegExp(`^\\s*${methodName}\\s*\\(`, 'gm');
      const matches = source.match(regex);
      return matches ? matches.length : 0;
    };

    expect(countMethodDefs('clearDynamicStairs')).toBe(1);
    expect(countMethodDefs('buildStaircaseGeometry')).toBe(1);
    expect(countMethodDefs('updateDynamicStairs')).toBe(1);
    expect(countMethodDefs('updateBillboards')).toBe(1);
    expect(countMethodDefs('pick')).toBe(1);

    // Verify dead duplicate methods were cleanly removed
    expect(source.includes('_renderDownstairs3D')).toBe(false);
    expect(source.includes('_renderUpstairs3D')).toBe(false);
    expect(source.includes('_drawPerspectiveVoxelBlock')).toBe(false);
  });

  it('updateDynamicStairs correctly populates and clears dynamicStairs without ghosts', () => {
    const renderer = new FirstPerson3DRenderer('nonexistent-canvas', 24);
    renderer.w = 800;
    renderer.h = 600;

    const mockGame = {
      floor: 3,
      map: {
        floor: 3,
        downStaircases: [{ x: 5, y: 7, isSealed: false }],
        upStaircases: [{ x: 2, y: 3, isSealed: true }]
      }
    };

    renderer.updateDynamicStairs(mockGame);
    expect(renderer.dynamicStairs.length).toBe(2);
    expect(renderer.dynamicStairs.find(s => s.type === 'STAIRS_DOWN')).toEqual({
      x: 5,
      y: 7,
      type: 'STAIRS_DOWN',
      floor: 3,
      isSealed: false,
      transformY: 0
    });
    expect(renderer.dynamicStairs.find(s => s.type === 'STAIRS_UP')).toEqual({
      x: 2,
      y: 3,
      type: 'STAIRS_UP',
      floor: 3,
      isSealed: true,
      transformY: 0
    });

    renderer.clearDynamicStairs();
    expect(renderer.dynamicStairs.length).toBe(0);
  });

  it('updateBillboards uses interpolated visual coordinates and sorts back-to-front (Painter\'s Algorithm)', () => {
    const renderer = new FirstPerson3DRenderer('nonexistent-canvas', 24);
    renderer.w = 800;
    renderer.h = 600;

    const player = { x: 0, y: 0, visualX: 0, visualY: 0 };
    // Close monster (distance ~2)
    const mNear = {
      x: 10, y: 10,
      visualX: 0, visualY: 2,
      isDead: false,
      char: 'o', color: '#ff0000',
      stats: { hp: 15 }
    };
    // Far monster (distance ~10)
    const mFar = {
      x: 1, y: 1,
      visualX: 0, visualY: 10,
      isDead: false,
      char: 'D', color: '#ff8800',
      stats: { hp: 100 }
    };
    // Ground item (distance ~5)
    const itemMid = {
      x: 0, y: 0,
      visualX: 0, visualY: 5,
      char: '!', color: '#00ff00'
    };

    const billboards = renderer.updateBillboards([mNear, mFar], [itemMid], player.visualX, player.visualY);

    expect(billboards.length).toBe(3);
    // Back-to-front painter's order: furthest first, nearest last
    expect(billboards[0].distSq).toBe(100); // mFar (0, 10) -> distSq = 100
    expect(billboards[0].entity).toBe(mFar);
    expect(billboards[0].renderOrder).toBe(-10000);

    expect(billboards[1].distSq).toBe(25);  // itemMid (0, 5) -> distSq = 25
    expect(billboards[1].entity).toBe(itemMid);
    expect(billboards[1].renderOrder).toBe(-2500);

    expect(billboards[2].distSq).toBe(4);   // mNear (0, 2) -> distSq = 4
    expect(billboards[2].entity).toBe(mNear);
    expect(billboards[2].renderOrder).toBe(-400);

    // Verify depthTest and alphaTest are configured
    for (const b of billboards) {
      expect(b.depthTest).toBe(true);
      expect(b.alphaTest).toBe(0.5);
    }
  });

  it('pick returns hit coordinates and target entity in 1st-person 3D view', () => {
    const renderer = new FirstPerson3DRenderer('nonexistent-canvas', 24);
    renderer.w = 800;
    renderer.h = 600;
    renderer.playerAngle = 0; // East (+X direction)
    renderer.camX = 5.5;
    renderer.camY = 5.5;
    renderer.pitch = 0;

    const mockMonster = {
      x: 8, y: 5,
      visualX: 8, visualY: 5,
      char: 'k', color: '#ff0000',
      isDead: false,
      stats: { hp: 10 }
    };

    const mockGame = {
      player: { x: 5, y: 5, visualX: 5, visualY: 5 },
      map: {
        width: 20, height: 20,
        isWall: (x, y) => x === 12 && y === 5
      },
      monsters: [mockMonster],
      items: []
    };

    // Center click directly in front along ray
    const hit = renderer.pick(400, 300, mockGame);
    expect(hit).not.toBeNull();
    expect(hit.tileX).toBe(8);
    expect(hit.tileY).toBe(5);
    expect(hit.monster).toBe(mockMonster);

    // Out of bounds screen click returns null
    expect(renderer.pick(-50, 300, mockGame)).toBeNull();
    expect(renderer.pick(1200, 300, mockGame)).toBeNull();
  });
});

describe('Phase 4: Player Reincarnation Stat Baseline Contract', () => {
  it('player.reincarnate resets baseStats to baseline before adding legacyStats to avoid compounding', () => {
    const player = new Player(10, 10, 'MON_NOVICE_WARRIOR');
    player.legacyStats = {
      str: 5,
      dex: 4,
      con: 3,
      int: 2,
      wis: 1,
      chr: 0,
      maxHp: 15,
      ac: 2,
      speed: 10
    };

    // First reincarnation
    player.reincarnate();
    expect(player.reincarnationCount).toBe(1);
    expect(player.level).toBe(1);
    expect(player.xp).toBe(0);

    // Baseline stats should be 10 + legacy
    expect(player.baseStats.str).toBe(15); // 10 + 5
    expect(player.baseStats.dex).toBe(14); // 10 + 4
    expect(player.baseStats.con).toBe(13); // 10 + 3
    expect(player.baseStats.int).toBe(12); // 10 + 2
    expect(player.baseStats.wis).toBe(11); // 10 + 1
    expect(player.baseStats.chr).toBe(10); // 10 + 0
    expect(player.baseStats.maxHp).toBe(65); // 50 + 15
    expect(player.baseStats.ac).toBe(2);    // 0 + 2
    expect(player.baseStats.speed).toBe(120); // 110 + 10

    // Calling reincarnate() multiple times must NOT compound exponentially!
    for (let i = 0; i < 5; i++) {
      player.reincarnate();
    }

    expect(player.reincarnationCount).toBe(6);
    expect(player.baseStats.str).toBe(15); // Still exactly 15, NOT 10 + 5*6 = 40
    expect(player.baseStats.dex).toBe(14);
    expect(player.baseStats.con).toBe(13);
    expect(player.baseStats.int).toBe(12);
    expect(player.baseStats.wis).toBe(11);
    expect(player.baseStats.chr).toBe(10);
    expect(player.baseStats.maxHp).toBe(65);
    expect(player.baseStats.ac).toBe(2);
    expect(player.baseStats.speed).toBe(120);
  });
});

describe('Phase 4: SaveSystem 100% Fidelity Serialization Contract', () => {
  beforeEach(() => {
    // Mock localStorage for node test environment
    const store = {};
    global.localStorage = {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; }
    };
  });

  it('round-trips item, player, map.stairs, and monster states with 100% fidelity', () => {
    const game = {
      floor: 5,
      floorDanger: 6,
      currentSlot: 'slot2',
      addLogEntry: vi.fn(),
      map: new Map(25, 25, 5),
      player: new Player(7, 7, 'MON_NOVICE_WARRIOR'),
      items: [],
      monsters: []
    };

    // 1. Detailed item with comprehensive attributes
    const testItem = new Item(
      7, 7, 'WEAPON', '(', '#c084fc', 'Holy Longsword of Radiance',
      2, 'WEAPON', { str: 2 }, '2d8', null,
      ['HOLY'], ['RADIANCE'], ['LIGHT_AFFINITY'], 'A legendary glowing blade.'
    );
    testItem.tval = 24;
    testItem.sval = 5;
    testItem.pval = 3;
    testItem.idState = 'KNOWN';
    testItem.isIdentified = true;
    testItem.isCursed = true;
    testItem.curses = ['HEAVY_CURSE'];
    testItem.isArtifact = true;
    testItem.artifactKey = 'THE_HOLY_SWORD';
    testItem.artifactId = 'THE_HOLY_SWORD';
    testItem.isRandart = true;
    testItem.egoKey = 'EGO_HOLY';
    testItem.flags = ['SLAY_UNDEAD', 'FREE_ACT', 'RES_FIRE'];
    testItem.activate = 'BURST_HOLY_LIGHT';
    testItem.timeout = 14;
    testItem.charges = 6;
    testItem.maxCharges = 12;
    testItem.toHit = 8;
    testItem.toDam = 11;
    testItem.toAC = 3;
    testItem.dice = '2d8';
    testItem.sides = 8;
    testItem.baseAC = 5;
    testItem.ac = 5;
    testItem.weight = 18;
    testItem.prefix = 'Holy';
    testItem.suffix = 'of Radiance';
    testItem.synergyTags = ['LIGHT_AFFINITY', 'BLESSED'];

    game.player.inventory.push(testItem);
    game.player.equipment.weapon = testItem;

    // SubCores
    const sub1 = new Item(0, 0, 'CORE', '*', '#ef4444', 'Dragon Core', 1, null, {}, null, 'MON_ANCIENT_RED_DRAGON');
    const sub2 = new Item(0, 0, 'CORE', '*', '#38bdf8', 'Ice Drake Core', 1, null, {}, null, 'MON_ICE_DRAKE');
    game.player.inventory.push(sub1);
    game.player.inventory.push(sub2);
    game.player.equipment.subCore1 = sub1;
    game.player.equipment.subCore2 = sub2;

    // Player state
    game.player.reincarnationCount = 4;
    game.player.slainUniques = ['MORGOTH', 'GLAURUNG'];
    game.player.body.mutations = ['ACID_COUNTER', 'FIRE_AURA'];
    game.player.body.loreRegistry = { MON_ANCIENT_RED_DRAGON: 1500, MON_ICE_DRAKE: 900 };
    game.player.statuses = {
      HASTE: { key: 'HASTE', name: '가속', duration: 15, power: 2, color: '#38bdf8', icon: '⚡', modifiers: {} },
      SHIELD: { key: 'SHIELD', name: '방어막', duration: 8, power: 1, color: '#fbbf24', icon: '🛡️', modifiers: {} }
    };

    // Map stairs
    game.map.stairs = [
      { x: 3, y: 4, type: 'STAIRS_DOWN', isDown: true, isUp: false, isSealed: false },
      { x: 18, y: 19, type: 'STAIRS_UP', isDown: false, isUp: true, isSealed: true }
    ];

    // Monster state
    const boss = new Monster(12, 12, 'MON_MORGOTH', 50, ['ANCIENT'], ['SUPREME']);
    boss.key = 'MON_MORGOTH';
    boss.isUnique = true;
    boss.isFinalBoss = true;
    boss.bossPhase = 2;
    boss.blows = [{ method: 'CRUSH', effect: 'SHATTER', damage: '8d12' }];
    boss.spells = ['MANA_STORM', 'SUMMON_DEMONS'];
    boss.flags = ['REFLECT', 'IM_FIRE', 'NO_CONF'];
    boss.cooldowns = { breath: 3, spell: 5 };
    boss.statuses = {
      STUN: { key: 'STUN', name: '기절', duration: 2, power: 1 }
    };
    game.monsters.push(boss);

    // Mock 3D renderer on game to test dynamic stairs cleanup
    game.renderer3d = {
      clearDynamicStairs: vi.fn(),
      updateDynamicStairs: vi.fn()
    };

    // Serialize
    const serialized = SaveSystem.serialize(game);
    expect(typeof serialized).toBe('string');

    // Create fresh game instance to deserialize into
    const restoredGame = {
      currentSlot: 'slot2',
      addLogEntry: vi.fn(),
      renderer3d: {
        clearDynamicStairs: vi.fn(),
        updateDynamicStairs: vi.fn()
      }
    };

    SaveSystem.deserialize(restoredGame, serialized);

    // 1. Verify item preservation
    const restoredItem = restoredGame.player.equipment.weapon;
    expect(restoredItem).toBeDefined();
    expect(restoredItem.tval).toBe(24);
    expect(restoredItem.sval).toBe(5);
    expect(restoredItem.pval).toBe(3);
    expect(restoredItem.idState).toBe('KNOWN');
    expect(restoredItem.isIdentified).toBe(true);
    expect(restoredItem.isCursed).toBe(true);
    expect(restoredItem.curses).toEqual(['HEAVY_CURSE']);
    expect(restoredItem.isArtifact).toBe(true);
    expect(restoredItem.artifactKey).toBe('THE_HOLY_SWORD');
    expect(restoredItem.artifactId).toBe('THE_HOLY_SWORD');
    expect(restoredItem.isRandart).toBe(true);
    expect(restoredItem.egoKey).toBe('EGO_HOLY');
    expect(restoredItem.flags).toEqual(['SLAY_UNDEAD', 'FREE_ACT', 'RES_FIRE']);
    expect(restoredItem.activate).toBe('BURST_HOLY_LIGHT');
    expect(restoredItem.timeout).toBe(14);
    expect(restoredItem.charges).toBe(6);
    expect(restoredItem.maxCharges).toBe(12);
    expect(restoredItem.toHit).toBe(8);
    expect(restoredItem.toDam).toBe(11);
    expect(restoredItem.toAC).toBe(3);
    expect(restoredItem.dice).toBe('2d8');
    expect(restoredItem.sides).toBe(8);
    expect(restoredItem.baseAC).toBe(5);
    expect(restoredItem.ac).toBe(5);
    expect(restoredItem.weight).toBe(18);
    expect(restoredItem.prefix).toBe('Holy');
    expect(restoredItem.suffix).toBe('of Radiance');
    expect(restoredItem.synergyTags).toEqual(['LIGHT_AFFINITY', 'BLESSED']);

    // 2. Verify player preservation
    expect(restoredGame.player.reincarnationCount).toBe(4);
    expect(restoredGame.player.slainUniques).toEqual(['MORGOTH', 'GLAURUNG']);
    expect(restoredGame.player.body.mutations).toEqual(['ACID_COUNTER', 'FIRE_AURA']);
    expect(restoredGame.player.equipment.subCore1).toBeDefined();
    expect(restoredGame.player.equipment.subCore1.coreType).toBe('MON_ANCIENT_RED_DRAGON');
    expect(restoredGame.player.equipment.subCore2).toBeDefined();
    expect(restoredGame.player.equipment.subCore2.coreType).toBe('MON_ICE_DRAKE');
    expect(restoredGame.player.statuses.HASTE).toBeDefined();
    expect(restoredGame.player.statuses.HASTE.duration).toBe(15);
    expect(restoredGame.player.statuses.SHIELD).toBeDefined();
    expect(restoredGame.player.statuses.SHIELD.duration).toBe(8);

    // 3. Verify map.stairs preservation
    expect(restoredGame.map.stairs).toBeDefined();
    expect(restoredGame.map.stairs.length).toBe(2);
    expect(restoredGame.map.stairs[0]).toEqual({
      x: 3, y: 4, type: 'STAIRS_DOWN', isDown: true, isUp: false, isSealed: false
    });
    expect(restoredGame.map.stairs[1]).toEqual({
      x: 18, y: 19, type: 'STAIRS_UP', isDown: false, isUp: true, isSealed: true
    });

    // 4. Verify monster preservation
    expect(restoredGame.monsters.length).toBe(1);
    const restoredBoss = restoredGame.monsters[0];
    expect(restoredBoss.key).toBe('MON_MORGOTH');
    expect(restoredBoss.isUnique).toBe(true);
    expect(restoredBoss.isFinalBoss).toBe(true);
    expect(restoredBoss.bossPhase).toBe(2);
    expect(restoredBoss.blows).toEqual([{ method: 'CRUSH', effect: 'SHATTER', damage: '8d12' }]);
    expect(restoredBoss.spells).toEqual(['MANA_STORM', 'SUMMON_DEMONS']);
    expect(restoredBoss.flags).toEqual(['REFLECT', 'IM_FIRE', 'NO_CONF']);
    expect(restoredBoss.cooldowns).toEqual({ breath: 3, spell: 5 });
    expect(restoredBoss.statuses.STUN).toBeDefined();
    expect(restoredBoss.statuses.STUN.duration).toBe(2);

    // 5. Verify 3D dynamic stairs elimination was triggered
    expect(restoredGame.renderer3d.clearDynamicStairs).toHaveBeenCalled();
    expect(restoredGame.renderer3d.updateDynamicStairs).toHaveBeenCalledWith(restoredGame);
  });
});
