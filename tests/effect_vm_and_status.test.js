import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusEffectEngine, STATUS_DEFINITIONS } from '../src/systems/StatusEffectEngine.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { PlayerStatCalculator } from '../src/systems/PlayerStatCalculator.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';
import { VisionLightingEngine } from '../src/systems/VisionLightingEngine.js';
import { EffectVM } from '../src/systems/EffectVM.js';
import { EFFECT_OP_TYPES } from '../src/configs/EffectOpSchema.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { bossPhaseEngine } from '../src/systems/BossPhaseEngine.js';

describe('Argon Phase 1-B: Stateless EffectVM & Unified StatusEffectEngine', () => {
  let player;

  beforeEach(() => {
    player = new Player(10, 10, 'MON_NOVICE_WARRIOR');
    player.statuses = {};
    player._isDirty = true;
  });

  describe('Task 1: StatusEffectEngine & Legacy Fields Sync', () => {
    it('synchronizes legacy player.speedBuffTurns with HASTE status and increases calculated speed in PlayerStatCalculator', () => {
      const baseSpeed = PlayerStatCalculator.calculateSpeed(player);

      // 1. Setting legacy field
      player.speedBuffTurns = 10;
      expect(StatusEffectEngine.hasStatus(player, 'HASTE')).toBe(true);
      expect(StatusEffectEngine.getTurns(player, 'HASTE')).toBe(10);

      const hasteSpeed = PlayerStatCalculator.calculateSpeed(player);
      expect(hasteSpeed).toBeGreaterThan(baseSpeed);
      expect(hasteSpeed).toBeCloseTo(baseSpeed + 10, 1);

      // 2. Setting via applyStatus
      StatusEffectEngine.applyStatus(player, 'HASTE', 15);
      expect(player.speedBuffTurns).toBe(15);
      expect(StatusEffectEngine.getTurns(player, 'HASTE')).toBe(15);

      // 3. Resetting legacy field
      player.speedBuffTurns = 0;
      expect(StatusEffectEngine.hasStatus(player, 'HASTE')).toBe(false);
      expect(PlayerStatCalculator.calculateSpeed(player)).toBeCloseTo(baseSpeed, 1);
    });

    it('synchronizes all major legacy turns properties into StatusEffectEngine', () => {
      // 1. Debuffs synchronization
      player.blindTurns = 4;
      player.confusedTurns = 3;
      player.paralyzedTurns = 2;
      player.afraidTurns = 5;
      player.slowTurns = 6;
      player.poisonTurns = 9;
      player.cutTurns = 4;

      expect(StatusEffectEngine.hasStatus(player, 'BLIND')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'CONFUSE')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'PARALYZE')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'FEAR')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'SLOW')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'POISON')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'BLEED')).toBe(true);

      // 2. Buffs and Protections synchronization
      player.invulnerableTurns = 5;
      player.heroismTurns = 8;
      player.berserkTurns = 6;
      player.shieldBuffTurns = 12;
      player.protectPrayerTurns = 7;
      player.tempResFireTurns = 10;
      player.tempResColdTurns = 10;
      player.tempResElecTurns = 10;
      player.tempResAcidTurns = 10;
      player.tempResPoisTurns = 10;
      player.espTurns = 15;
      player.infraTurns = 20;
      player.wraithformTurns = 8;

      expect(StatusEffectEngine.hasStatus(player, 'INVULN')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'HEROISM')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'BERSERK')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'SHIELD')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'PROT_EVIL')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'RES_FIRE')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'RES_COLD')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'RES_ELEC')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'RES_ACID')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'RES_POIS')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'ESP')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'INFRA')).toBe(true);
      expect(StatusEffectEngine.hasStatus(player, 'PASS_WALL')).toBe(true);
    });

    it('aggregates modifiers cleanly via StatusEffectEngine.getAggregatedModifiers', () => {
      StatusEffectEngine.applyStatus(player, 'HASTE', 10);
      StatusEffectEngine.applyStatus(player, 'HEROISM', 10);
      StatusEffectEngine.applyStatus(player, 'BERSERK', 10);
      StatusEffectEngine.applyStatus(player, 'SHIELD', 10);
      StatusEffectEngine.applyStatus(player, 'INVULN', 10);
      StatusEffectEngine.applyStatus(player, 'PROT_EVIL', 10);
      StatusEffectEngine.applyStatus(player, 'BLESSED', 10);
      StatusEffectEngine.applyStatus(player, 'RES_FIRE', 10);

      const mods = StatusEffectEngine.getAggregatedModifiers(player);

      expect(mods.speedDelta).toBe(10);
      // toHitDelta: HEROISM (+12) + BERSERK (+24) + BLESSED (+10) = 46
      expect(mods.toHitDelta).toBe(46);
      // toDamDelta: BERSERK (+15) = 15
      expect(mods.toDamDelta).toBe(15);
      // acDelta: BERSERK (-10) + SHIELD (+50) + INVULN (+100) + PROT_EVIL (+15) + BLESSED (+5) = 160
      expect(mods.acDelta).toBe(160);
      // damageReductionPct: INVULN (0.90)
      expect(mods.damageReductionPct).toBe(0.90);
      // tempResistances
      expect(mods.tempResistances.FIRE).toBe(0.50);
      // flags
      expect(mods.flags.fearImmune).toBe(true);
      expect(mods.flags.protEvil).toBe(true);
    });

    it('cures individual statuses and ALL_NEGATIVE correctly', () => {
      StatusEffectEngine.applyStatus(player, 'POISON', 10);
      StatusEffectEngine.applyStatus(player, 'BLEED', 10);
      StatusEffectEngine.applyStatus(player, 'BLIND', 10);
      StatusEffectEngine.applyStatus(player, 'HASTE', 10);

      // Cure single status
      StatusEffectEngine.cureStatus(player, 'POISON');
      expect(StatusEffectEngine.hasStatus(player, 'POISON')).toBe(false);
      expect(player.poisonTurns).toBe(0);

      // Cure ALL_NEGATIVE
      StatusEffectEngine.cureStatus(player, 'ALL_NEGATIVE');
      expect(StatusEffectEngine.hasStatus(player, 'BLEED')).toBe(false);
      expect(StatusEffectEngine.hasStatus(player, 'BLIND')).toBe(false);
      expect(player.cutTurns).toBe(0);
      expect(player.blindTurns).toBe(0);

      // Buff HASTE should remain intact
      expect(StatusEffectEngine.hasStatus(player, 'HASTE')).toBe(true);
      expect(player.speedBuffTurns).toBe(10);
    });
  });

  describe('Task 1 & 2: CombatCalculator & VisionLightingEngine Integration', () => {
    let monster;

    beforeEach(() => {
      monster = new Monster(12, 10, 'ORC', 5, [], []);
      monster.stats = { hp: 50, maxHp: 50 };
    });

    it('HEROISM, BERSERK, SHIELD, INVULN accurately modify AC, To-Hit, To-Dam and damage reduction in CombatCalculator', () => {
      const baseAC = player.getTotalAC();
      const baseHit = CombatCalculator.calculateHitChance(player, monster, {}, 10);

      // 1. HEROISM: +12 toHit, +10 maxHp, fearImmune
      StatusEffectEngine.applyStatus(player, 'HEROISM', 10);
      const heroHit = CombatCalculator.calculateHitChance(player, monster, {}, 10);
      expect(heroHit.bHit).toBe(baseHit.bHit + 12);
      expect(player.getMaxHp()).toBeGreaterThanOrEqual(10);

      // 2. BERSERK: +24 toHit, +15 toDam, -10 AC
      StatusEffectEngine.applyStatus(player, 'BERSERK', 10);
      const berserkHit = CombatCalculator.calculateHitChance(player, monster, {}, 10);
      expect(berserkHit.bHit).toBe(baseHit.bHit + 12 + 24);

      const physDmg = CombatCalculator.calculatePhysicalDamage(player, monster, {}, 10);
      expect(physDmg.dmg).toBeGreaterThanOrEqual(15); // +15 bonus included

      // AC should be baseAC - 10
      expect(player.getTotalAC()).toBe(Math.max(1, baseAC - 10));

      // 3. SHIELD: +50 AC
      StatusEffectEngine.applyStatus(player, 'SHIELD', 10);
      expect(player.getTotalAC()).toBe(baseAC - 10 + 50);

      // 4. INVULN: +100 AC, 90% damage reduction
      StatusEffectEngine.applyStatus(player, 'INVULN', 10);
      expect(player.getTotalAC()).toBe(baseAC - 10 + 50 + 100);

      const incomingRaw = 100;
      const filtered = CombatCalculator.filterPlayerIncomingDamage(player, incomingRaw, 0, false, false);
      // Under INVULN, incoming damage must be reduced by 90% (max 10% remaining)
      expect(filtered.finalDmg).toBeLessThanOrEqual(10);
    });

    it('RES_FIRE grants 50% resistance in CombatCalculator and Player', () => {
      expect(CombatCalculator.getPlayerResistance(player, 'FIRE')).toBe(false);

      player.tempResFireTurns = 10;
      expect(CombatCalculator.getPlayerResistance(player, 'FIRE')).toBe(true);
      expect(player.getResistancePercent('FIRE')).toBeGreaterThanOrEqual(0.50);
    });

    it('BLIND reduces vision radius to 1 in VisionLightingEngine', () => {
      const mockMap = {
        width: 20,
        height: 20,
        isTransparent: () => true
      };

      // Normal vision
      const normalVision = VisionLightingEngine.calculateVisionMap(mockMap, 5, 5, 4, player);
      expect(normalVision.size).toBeGreaterThan(1);

      // Blind vision
      player.blindTurns = 5;
      const blindVision = VisionLightingEngine.calculateVisionMap(mockMap, 5, 5, 4, player);
      // With radius 1: (5,5) plus adjacent = 5 tiles (Manhattan/circle <= 1.5)
      expect(blindVision.size).toBeLessThan(normalVision.size);
      expect(player.lightRange).toBe(1);
    });
  });

  describe('Task 2: EffectVM Canonical Execution & Unified Death Hook', () => {
    let mockGame;
    let targetMonster;

    beforeEach(() => {
      targetMonster = new Monster(11, 10, 'ORC', 3, [], []);
      targetMonster.stats = { hp: 40, maxHp: 40 };
      targetMonster.baseAC = 0;

      mockGame = {
        player,
        monsters: [targetMonster],
        map: {
          isWalkable: () => true,
          isTransparent: () => true
        },
        addLogEntry: vi.fn(),
        bossPhaseEngine: {
          checkPhaseTransition: vi.fn()
        }
      };
    });

    it('executes DEAL_DAMAGE accurately and applies damage to target', () => {
      const op = {
        op: EFFECT_OP_TYPES.DEAL_DAMAGE,
        element: 'FIRE',
        flat: 15,
        dice: '2d6',
        mult: 1.0
      };

      const res = EffectVM.execute(op, { caster: player, target: targetMonster, game: mockGame });
      expect(res.success).toBe(true);
      expect(res.results[0].executed).toBe(true);
      expect(targetMonster.stats.hp).toBeLessThan(40);
      expect(res.results[0].damage).toBeGreaterThanOrEqual(17);
    });

    it('executes APPLY_STATUS and CURE_STATUS', () => {
      // 1. APPLY_STATUS
      const applyOp = {
        op: EFFECT_OP_TYPES.APPLY_STATUS,
        target: 'TARGET',
        statusId: 'POISON',
        duration: 5,
        power: 3
      };

      EffectVM.execute(applyOp, { caster: player, target: targetMonster, game: mockGame });
      expect(StatusEffectEngine.hasStatus(targetMonster, 'POISON')).toBe(true);
      expect(StatusEffectEngine.getTurns(targetMonster, 'POISON')).toBe(5);

      // 2. CURE_STATUS
      const cureOp = {
        op: EFFECT_OP_TYPES.CURE_STATUS,
        target: 'TARGET',
        statusIds: 'POISON'
      };

      EffectVM.execute(cureOp, { caster: player, target: targetMonster, game: mockGame });
      expect(StatusEffectEngine.hasStatus(targetMonster, 'POISON')).toBe(false);
    });

    it('executes HEAL_ENTITY on self or target', () => {
      player.stats.hp = 20;
      player.stats.maxHp = 100;

      const healOp = {
        op: EFFECT_OP_TYPES.HEAL_ENTITY,
        target: 'SELF',
        flat: 25,
        dice: '1d4'
      };

      const res = EffectVM.execute(healOp, { caster: player, game: mockGame });
      expect(res.success).toBe(true);
      expect(player.stats.hp).toBeGreaterThanOrEqual(46);
    });

    it('executes SUMMON_ENTITIES directly into game.monsters adjacent to caster', () => {
      const initialCount = mockGame.monsters.length;

      const summonOp = {
        op: EFFECT_OP_TYPES.SUMMON_ENTITIES,
        summonFilter: 'BAT',
        count: 2,
        ttl: 10
      };

      const res = EffectVM.execute(summonOp, { caster: player, game: mockGame });
      expect(res.success).toBe(true);
      expect(mockGame.monsters.length).toBe(initialCount + 2);

      const summoned = mockGame.monsters[mockGame.monsters.length - 1];
      expect(summoned.type).toBe('BAT');
      expect(summoned.ttl).toBe(10);
    });

    it('triggers bossPhaseEngine and LootSystem.processMonsterDeath when a monster dies', () => {
      const spyLoot = vi.spyOn(LootSystem, 'processMonsterDeath').mockImplementation(() => {});

      targetMonster.stats.hp = 10;

      const lethalOp = {
        op: EFFECT_OP_TYPES.DEAL_DAMAGE,
        element: 'PHYSICAL',
        flat: 50
      };

      const res = EffectVM.execute(lethalOp, { caster: player, target: targetMonster, game: mockGame });
      expect(res.success).toBe(true);
      expect(targetMonster.stats.hp).toBe(0);
      expect(targetMonster._deathProcessed).toBe(true);

      // Verifies boss phase transition was checked
      expect(mockGame.bossPhaseEngine.checkPhaseTransition).toHaveBeenCalledWith(targetMonster, mockGame);

      // Verifies LootSystem.processMonsterDeath was triggered
      expect(spyLoot).toHaveBeenCalled();

      // Verifies monster was removed from game.monsters
      expect(mockGame.monsters.includes(targetMonster)).toBe(false);

      spyLoot.mockRestore();
    });
  });
});
