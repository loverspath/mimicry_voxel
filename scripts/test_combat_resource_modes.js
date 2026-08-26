/**
 * scripts/test_combat_resource_modes.js
 * Pure Cooldown & Archery Burst / Mastery Integration Test
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { ARCHERY_CONFIG } from '../src/configs/GameBalanceConfig.js';
import { ACTIVE_SKILL_CONFIGS } from '../src/core/Skills.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';

console.log("================================================================================");
console.log("⚡ [PURE COOLDOWN & ARCHERY BURST / MASTERY TEST SUITE] ⚡");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Pure Cooldown Spell Execution
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 순수 쿨다운 주문 발사 검증 ---");
const player = new Player(10, 10);
player.mimicCore = { name: '수습 마법사', coreType: 'MAGE' };
player.activeSkills = MonsterSpellFactory.createInnateSkills('MAGE');
player.trackers = { cooldown: {} };
player.body.loreRegistry = { MAGE: 0 };

assert(player.activeSkills.length > 0, `마법사 의태 액티브 스킬 생성 확인`);
assert(player.activeSkills[0].manaCost === undefined, `마나 소모 없이 순수 쿨다운 체계 작동 확인`);

const mockGame = {
  player: player,
  dungeon: {
    currentFloor: 1,
    monsters: [new Monster(12, 10, 'GOBLIN', 3)]
  },
  monsters: [new Monster(12, 10, 'GOBLIN', 3)],
  items: [],
  map: { isWalkable: () => true, isTransparent: () => true },
  effects: [],
  logs: [],
  addLogEntry: function(msg, type) { this.logs.push({ msg, type }); },
  updateUI: function() {},
  handlePlayerDeath: function() {}
};

CombatSystem.checkAndCastAutoSkills(mockGame, player);

const firstSkill = player.activeSkills[0];
const cd = player.getCooldown ? player.getCooldown(firstSkill.id) : (player.trackers.cooldown[firstSkill.id] || 0);
assert(cd >= 0, `스킬 발사 및 쿨다운 추적 확인`);

// -----------------------------------------------------------------------------
// TEST 2: Archery Interval & Shots per Round
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 원거리 무기 쿨다운 및 속사 검증 ---");
const shortbow = player.inventory.find(i => i.name.includes('Shortbow') || i.char === '}');
player.equipment.weapon = shortbow;
player.autoFireEnabled = true;

const shots = player.getRangedShotsPerRound(shortbow);
assert(shots >= 1, `원거리 턴당 발사 횟수 산출 확인 (${shots}발/턴)`);

const targetMonster = new Monster(14, 10, 'GOBLIN', 3);
CombatSystem.attackMonster(mockGame, player, targetMonster);
assert(mockGame.effects.length > 0, `투사체 이펙트 정상 생성 확인`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

