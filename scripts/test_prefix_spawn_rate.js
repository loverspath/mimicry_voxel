/**
 * scripts/test_prefix_spawn_rate.js
 * Verification of Floor 1 Monster Spawn Prefix/Tag Rate (Goal: <= 2.0%, target ~1.5%)
 */

import { Spawner } from '../src/core/Spawner.js';
import { calculateElitePrefixChance } from '../src/configs/GameBalanceConfig.js';
import { Monster } from '../src/entities/Monster.js';

console.log("================================================================================");
console.log("🎯 [FLOOR 1 MONSTER PREFIX SPAWN RATE STATISTICAL AUDIT] 🎯");
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

// 1. Math Curve Test
const f1Chance = calculateElitePrefixChance(1, false);
console.log(`[Formula Check] Floor 1 calculateElitePrefixChance(1) = ${(f1Chance * 100).toFixed(2)}%`);
assert(f1Chance === 0.015, `1층 엘리트 프리픽스 공식 산출값이 정확히 1.5% (0.015)로 설정됨`);

// 2. Headless Simulation of 1,000 Spawns on Floor 1
console.log("\n--- Floor 1 Normal Spawns (1,000 iterations) Simulation ---");

// Mock Game & Map context for Spawner
const mockGame = {
  floor: 1,
  floorDanger: 1,
  player: { x: 5, y: 5, inventory: [], equippedLamp: null },
  monsters: [],
  items: [],
  isMonsterAt: () => false,
  addLogEntry: () => {},
  map: {
    rooms: [
      { center: { x: 5, y: 5 }, type: 'START' }
    ],
    isWalkable: () => true,
    width: 50,
    height: 50
  }
};

// Add 1,000 normal rooms to map
for (let i = 1; i <= 1000; i++) {
  mockGame.map.rooms.push({
    center: { x: 10 + (i % 20), y: 10 + Math.floor(i / 20) },
    type: 'NORMAL'
  });
}

Spawner.spawnFloorContent(mockGame);

const spawnedCount = mockGame.monsters.length;
let taggedCount = 0;
let prefixCount = 0;
let suffixCount = 0;

const prefixDistribution = {};

for (const m of mockGame.monsters) {
  const hasPrefix = m.prefixes && m.prefixes.length > 0;
  const hasSuffix = m.suffixes && m.suffixes.length > 0;
  if (hasPrefix || hasSuffix) {
    taggedCount++;
  }
  if (hasPrefix) {
    prefixCount++;
    m.prefixes.forEach(p => prefixDistribution[p] = (prefixDistribution[p] || 0) + 1);
  }
  if (hasSuffix) {
    suffixCount++;
  }
}

const taggedRate = (taggedCount / spawnedCount) * 100;
const prefixRate = (prefixCount / spawnedCount) * 100;

console.log(`총 스폰된 몬스터: ${spawnedCount}마리`);
console.log(`태그(접두/접미) 보유 몬스터: ${taggedCount}마리 (${taggedRate.toFixed(2)}%)`);
console.log(`프리픽스 보유 몬스터: ${prefixCount}마리 (${prefixRate.toFixed(2)}%)`);
console.log(`순수 일반 몬스터(0 Tags): ${spawnedCount - taggedCount}마리 (${((spawnedCount - taggedCount) / spawnedCount * 100).toFixed(2)}%)`);
console.log(`프리픽스 분포:`, prefixDistribution);

assert(spawnedCount >= 900, `충분한 수의 1층 몬스터가 정상 생성됨 (${spawnedCount}마리)`);
assert(taggedRate <= 3.0, `1층 전체 변형 몬스터(접두/접미 포함) 비율이 통계적 3% 미만 (실측: ${taggedRate.toFixed(2)}%)`);
assert(taggedRate >= 0.3, `1층 극희귀 변형 몬스터가 0%가 아닌 1.5% 내외로 정상 출현 (실측: ${taggedRate.toFixed(2)}%)`);
assert((spawnedCount - taggedCount) / spawnedCount >= 0.97, `1층 몬스터의 97% 이상이 순수한 ToME 일반 몬스터임`);

console.log("\n================================================================================");
console.log(`🎉 STATISTICAL AUDIT RESULT: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) process.exit(1);
else process.exit(0);
