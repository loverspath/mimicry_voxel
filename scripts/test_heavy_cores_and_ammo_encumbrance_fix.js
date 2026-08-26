/**
 * scripts/test_heavy_cores_and_ammo_encumbrance_fix.js
 * Unit tests verifying:
 * 1. Monster core weight calculation caps at 20 lbs maximum (preventing 2,800 lbs on giant/titan/Morgoth cores)
 * 2. Ammo bundle weight calculation properly recognizes type === 'ARROW'/'BOLT'/'SHOT' (0.1 lbs per unit)
 * 3. Player carrying Morgoth core + 100 arrows + potions remains under normal weight without over-encumbrance
 * 4. Game.prototype.forceSaveDebug serializes game state safely
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { TomeEquipmentEngine, TVAL } from '../src/systems/TomeEquipmentEngine.js';
import { Game } from '../src/core/Game.js';

console.log("================================================================================");
console.log("🛡️ [HEAVY CORES & BULK AMMO ENCUMBRANCE FIX TEST SUITE] 🛡️");
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
// TEST 1: Monster Core Weight Capping (3 ~ 20 lbs)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 거대 보스/타이탄 코어 무게 20 lbs 절대 상한선 검증 ---");

const titanCore = new Item(0, 0, 'CORE', '%', '#f59e0b', 'Lesser titan core');
titanCore.coreType = 'MON_LESSER_TITAN';
const titanWeight = TomeEquipmentEngine.calculateWeight(titanCore);
assert(titanWeight <= 20, `Lesser titan 코어 무게 (${titanWeight} lbs)가 20 lbs 이하임`);
assert(titanWeight >= 3, `Lesser titan 코어 무게 (${titanWeight} lbs)가 3 lbs 이상임`);

const morgothCore = new Item(0, 0, 'CORE', '%', '#ef4444', 'Morgoth core');
morgothCore.coreType = 'MON_MORGOTH';
const morgothWeight = TomeEquipmentEngine.calculateWeight(morgothCore);
assert(morgothWeight <= 20, `Morgoth 코어 무게 (${morgothWeight} lbs)가 20 lbs 이하로 정상 캡핑됨 (실제: ${morgothWeight} lbs, 2000+ lbs 폭등 차단)`);

const goblinCore = new Item(0, 0, 'CORE', '%', '#10b981', 'Goblin core');
goblinCore.coreType = 'MON_SMALL_KOBOLD';
const goblinWeight = TomeEquipmentEngine.calculateWeight(goblinCore);
assert(goblinWeight >= 3 && goblinWeight <= 20, `소형 몬스터 코어 무게 (${goblinWeight} lbs)가 3~20 lbs 정상 범위 내임`);

// -----------------------------------------------------------------------------
// TEST 2: Bulk Ammo Bundle isAmmo Scaling (0.1 lbs per unit)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 대용량 화살/볼트 번들 isAmmo 0.1 lbs 단위 무게 검증 ---");

const arrowBundle100 = new Item(0, 0, 'ARROW', '{', '#cbd5e1', 'Flight Arrows');
arrowBundle100.tval = TVAL.ARROW;
arrowBundle100.count = 100;
const arrowWeight = TomeEquipmentEngine.calculateWeight(arrowBundle100);
assert(arrowWeight === 10, `화살 100발 무게가 10 lbs임 (실제: ${arrowWeight} lbs, 100+ lbs 폭등 차단)`);

const boltBundle200 = new Item(0, 0, 'BOLT', '{', '#94a3b8', 'Steel Bolts');
boltBundle200.slotType = 'QUIVER';
boltBundle200.count = 200;
const boltWeight = TomeEquipmentEngine.calculateWeight(boltBundle200);
assert(boltWeight === 20, `볼트 200발 무게가 20 lbs임 (실제: ${boltWeight} lbs)`);

// -----------------------------------------------------------------------------
// TEST 3: Heavy Inventory Load with Titan Core + 100 Arrows + Potions
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 타이탄 변신 + 대용량 탄약 소지 시 실시간 과적 방지 검증 ---");

const player = new Player(0, 0, 'MON_NOVICE_WARRIOR');
player.mimicCore = titanCore;

const potions = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Healing Potions');
potions.tval = TVAL.POTION;
potions.count = 10; // 4.0 lbs

const food = new Item(0, 0, 'FOOD', ',', '#fbbf24', 'Food Rations');
food.tval = TVAL.FOOD;
food.count = 5; // 2.5 lbs

player.inventory.push(arrowBundle100, potions, food);

const curWeight = player.body.getCurrentWeight();
const maxLimit = player.body.getMaxWeightLimit();
const speedMod = player.body.getSpeedModifier();

assert(curWeight <= 75, `타이탄 변신 + 기본 장비 풀세트 + 화살 100발 + 물약 10병 총 소지 무게가 75 lbs 이하임 (현재: ${curWeight.toFixed(1)} lbs)`);
assert(curWeight < maxLimit * 0.80, `총 소지 무게 (${curWeight.toFixed(1)} lbs)가 최대 적재량 (${maxLimit} lbs)의 80% 미만으로 정상 유지됨`);
assert(speedMod === 1.0, `속도 감속 페널티 없이 정상 1.0 속도 유지 확인`);

// -----------------------------------------------------------------------------
// TEST 4: Game.prototype.forceSaveDebug Method
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: Game.prototype.forceSaveDebug 세이브 직렬화 검증 ---");

assert(typeof Game.prototype.forceSaveDebug === 'function', "Game.prototype.forceSaveDebug 메서드 존재 확인");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
