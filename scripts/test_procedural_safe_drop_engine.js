/**
 * scripts/test_procedural_safe_drop_engine.js
 * Unit test verifying:
 * 1. Procedural BFS safe drop algorithm findSafeDropLocation / getSafeDropPosition
 * 2. Complete prevention of item spawns on walls and unwalkable tiles
 * 3. processMonsterDeath places 100% of drops on valid walkable floor tiles even when killed in corners/walls
 */

import { Map } from '../src/map/Map.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { uniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';

console.log("================================================================================");
console.log("🧱 [PROCEDURAL BFS SAFE DROP ENGINE TEST SUITE] 🧱");
console.log("================================================================================");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// SETUP: Custom map with specific walls and rooms
// -----------------------------------------------------------------------------
const map = new Map(20, 20, 1);
// Fill border with walls
for (let x = 0; x < 20; x++) {
  if (map.tiles[0] && map.tiles[0][x]) map.tiles[0][x].isWalkable = false;
  if (map.tiles[19] && map.tiles[19][x]) map.tiles[19][x].isWalkable = false;
}
for (let y = 0; y < 20; y++) {
  if (map.tiles[y] && map.tiles[y][0]) map.tiles[y][0].isWalkable = false;
  if (map.tiles[y] && map.tiles[y][19]) map.tiles[y][19].isWalkable = false;
}

// Create a solid wall block at (5, 5), (5, 6), (6, 5), (6, 6)
map.tiles[5][5].isWalkable = false;
map.tiles[6][5].isWalkable = false;
map.tiles[5][6].isWalkable = false;
map.tiles[6][6].isWalkable = false;

// Set (5, 4), (10, 10), and (1, 1) as walkable floors
map.tiles[4][5].isWalkable = true;
map.tiles[10][10].isWalkable = true;
map.tiles[1][1].isWalkable = true;

// -----------------------------------------------------------------------------
// TEST 1: BFS Safe Drop on Walkable Floor (Radius 0)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 이미 통행 가능한 바닥 타일의 즉시 반환 검증 ---");

const walkPos = LootSystem.findSafeDropLocation(map, 10, 10);
assert(walkPos.x === 10 && walkPos.y === 10, "바닥 타일(10, 10)은 좌표 변경 없이 (10, 10) 즉시 반환");

// -----------------------------------------------------------------------------
// TEST 2: BFS Safe Drop inside Wall Block
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 벽 내부 좌표(5, 5)에서 절차적 BFS 안전 타일 탐색 검증 ---");

assert(!map.isWalkable(5, 5), "(5, 5)는 벽 타일임");

const safePosFromWall = LootSystem.findSafeDropLocation(map, 5, 5, 5);
assert(map.isWalkable(safePosFromWall.x, safePosFromWall.y), `찾아낸 좌표 (${safePosFromWall.x}, ${safePosFromWall.y})는 100% 이동 가능한 타일`);
assert(!map.isWall(safePosFromWall.x, safePosFromWall.y), `찾아낸 좌표 (${safePosFromWall.x}, ${safePosFromWall.y})는 벽이 아님`);
const dist = Math.hypot(safePosFromWall.x - 5, safePosFromWall.y - 5);
assert(dist <= 2.0, `최단 거리의 안전 바닥 타일로 보정됨 (거리: ${dist.toFixed(2)})`);

// -----------------------------------------------------------------------------
// TEST 3: getSafeDropPosition Alias Functionality
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: getSafeDropPosition 별칭 메서드 무결성 검증 ---");

const aliasPos = LootSystem.getSafeDropPosition(map, 0, 0, 5);
assert(map.isWalkable(aliasPos.x, aliasPos.y), `외곽 벽(0, 0)에서 내부 안전 타일 (${aliasPos.x}, ${aliasPos.y}) 탐색 성공`);

// -----------------------------------------------------------------------------
// TEST 4: Monster Death Near Wall Guarantees 0% Drops on Wall Tiles
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 벽 모서리 처치 시 전리품 드랍 안전 타일 100% 보장 검증 ---");

const gameMock = {
  map: map,
  monsters: [],
  items: [],
  player: new Player(10, 10, 'MON_NOVICE_WARRIOR'),
  logs: [],
  addLogEntry(text, type) { this.logs.push({ text, type }); }
};

// Place a monster right next to walls at (1, 1) surrounded by (0, 0..2) and (0..2, 0)
const cornerMonster = new Monster(1, 1, 'MON_HILL_ORC');
cornerMonster.stats.hp = 0;
cornerMonster.isUnique = false;

// Kill monster 20 times with various random offsets
for (let i = 0; i < 20; i++) {
  LootSystem.processMonsterDeath(gameMock, gameMock.player, cornerMonster, "테스트 참격");
}

assert(gameMock.items.length > 0, `총 ${gameMock.items.length}개의 전리품(코어, 장비, 화살)이 드랍됨`);

let wallDropCount = 0;
gameMock.items.forEach(item => {
  if (!map.isWalkable(item.x, item.y) || map.isWall(item.x, item.y)) {
    console.error(`  ❌ 벽 위에 떨어진 아이템 발견: [${item.name}] at (${item.x}, ${item.y})`);
    wallDropCount++;
  }
});

assert(wallDropCount === 0, `벽 타일 위에 스폰된 아이템 0건 확인 (100% 안전 바닥 타일 드랍)`);

// -----------------------------------------------------------------------------
// TEST 5: Unique Monster Drops in Corner
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 유니크 몬스터 모서리 처치 시 확정 드랍 안전 배치 검증 ---");

gameMock.items = [];
const uniqueMonster = new Monster(1, 1, 'MON_BROGDA_THE_ORC_CAPTAIN');
uniqueMonster.isUnique = true;
uniqueMonster.uniqueKey = 'MON_BROGDA_THE_ORC_CAPTAIN';
uniqueMonster.name = 'Brogda the Orc Captain';

LootSystem.processMonsterDeath(gameMock, gameMock.player, uniqueMonster, "신성 폭발");

assert(gameMock.items.length >= 2, `유니크 확정 유물 및 코어 드랍 확인 (${gameMock.items.length}개)`);

let uniqueWallDropCount = 0;
gameMock.items.forEach(item => {
  if (!map.isWalkable(item.x, item.y) || map.isWall(item.x, item.y)) {
    uniqueWallDropCount++;
  }
});

assert(uniqueWallDropCount === 0, `유니크 전리품 벽 타일 스폰 0건 (100% 바닥 타일 배치)`);

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
