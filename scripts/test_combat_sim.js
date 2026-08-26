/**
 * @file test_combat_sim.js
 * @description Node.js 헤드리스 몬스터 조우, AI 의사결정, 평타/스킬/브레스 전투 10턴 무결성 시뮬레이션 테스트
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Map } from '../src/map/Map.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { renderMonsterInspectHTML } from '../src/ui/InspectModalView.js';
import { renderPlayerDetailsHTML } from '../src/ui/HUDView.js';

console.log("==================================================");
console.log("🎮 MIMICRY VOXEL HEADLESS COMBAT SIMULATION TEST");
console.log("==================================================");

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    process.exit(1);
  }
}

// 1. Initialize Map & Player
const map = new Map(40, 40);

// Find a walkable tile for player
let playerX = 10, playerY = 10;
for (let x = 5; x < 35; x++) {
  for (let y = 5; y < 35; y++) {
    if (map.isWalkable(x, y)) {
      playerX = x;
      playerY = y;
      break;
    }
  }
}

const player = new Player(playerX, playerY, 'HUMAN');
assert(player.stats.hp > 0, "Player spawned with valid HP");
assert(player.speed >= 3.5, "Player calculated valid speed >= 3.5");

// 2. Test Monster Spawning & Stat Calculations
const speciesList = ['GOBLIN', 'ORC', 'OGRE', 'BAT', 'SLIME', 'DRAGON', 'HATCHLING'];
const monsters = [];

speciesList.forEach((sp, idx) => {
  const mX = playerX + (idx % 3) + 1;
  const mY = playerY + Math.floor(idx / 3) + 1;
  const monster = new Monster(mX, mY, sp, Math.floor(idx / 2) + 1, ['FURIOUS'], ['CHAMPION']);
  monsters.push(monster);
  
  const bd = monster.getEffectiveStatWithBreakdown('str');
  assert(bd.finalValue > 0, `${sp} Monster calculated valid STR breakdown (${bd.finalValue})`);
  assert(monster.speed >= 3.5, `${sp} Monster calculated valid speed (${monster.speed.toFixed(2)})`);
});

// 3. Create Mock Game Context
const mockGame = {
  player,
  map,
  monsters,
  effects: [],
  logs: [],
  addLogEntry(msg, type = 'system') {
    this.logs.push(`[${type.toUpperCase()}] ${msg}`);
  },
  updateUI() {},
  handlePlayerDeath() {
    this.addLogEntry("플레이어 전사!", "combat");
  },
  isMonsterAt(x, y) {
    return this.monsters.some(m => m.x === x && m.y === y && m.stats.hp > 0);
  }
};

// 4. Test Inspect View Renderers
console.log("\n--- Testing UI Breakdown & Inspect HTML Renderers ---");
monsters.forEach(m => {
  const html = renderMonsterInspectHTML(m);
  assert(html.includes(m.displayName), `InspectModalView generated valid HTML for ${m.displayName}`);
});

const playerSheetHTML = renderPlayerDetailsHTML(player);
assert(playerSheetHTML.includes("모방자"), "HUDView generated valid player details HTML");

// 5. Simulate 10-Turn Combat & AI Execution
console.log("\n--- Simulating 10 Turns of Monster AI, Movement & Combat ---");

for (let turn = 1; turn <= 10; turn++) {
  console.log(`\n▶ [TURN ${turn}]`);
  
  // 5-1. Player Turn Action: Attack closest monster or move
  const targetMonster = monsters.find(m => m.stats.hp > 0);
  if (targetMonster) {
    console.log(`Player attacking target: ${targetMonster.displayName} (HP: ${targetMonster.stats.hp}/${targetMonster.stats.maxHp})`);
    CombatSystem.attackMonster(mockGame, player, targetMonster);
  }

  // 5-2. Monsters Turn Action: AI Act, Attack Player, Use Breath, Tick Buffs
  for (const m of monsters) {
    if (m.stats.hp <= 0) continue;
    
    // Buffs and heals tick
    m.tickBuffsAndHeals(monsters, (msg, type) => mockGame.addLogEntry(msg, type));
    
    // AI Act
    m.act(
      player,
      map,
      (x, y) => mockGame.isMonsterAt(x, y),
      (attM, targetP) => CombatSystem.attackPlayer(mockGame, attM, targetP),
      (brM, dx, dy, dist) => CombatSystem.useMonsterBreath(mockGame, brM, dx, dy, dist),
      (msg, type) => mockGame.addLogEntry(msg, type)
    );
  }

  console.log(`Turn ${turn} finished. Total logs generated: ${mockGame.logs.length}, Active effects: ${mockGame.effects.length}`);
}

assert(mockGame.logs.length > 0, "Combat logs successfully generated during 10 turns");
assert(true, "All 10 turns completed without unhandled exceptions or freezing");

console.log("\n==================================================");
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
console.log("==================================================");
