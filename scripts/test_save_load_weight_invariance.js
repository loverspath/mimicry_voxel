/**
 * scripts/test_save_load_weight_invariance.js
 * Unit test verifying:
 * 1. 10 consecutive save & load cycles maintain 100% weight invariance (no compounding / exponential explosion)
 * 2. Capped core weights (<= 20 lbs) and ammo bundle weights (0.1 lbs per unit) are strictly preserved across serialization
 * 3. Corrupt legacy save data with high weight numbers does not pollute item calculation
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { SaveSystem } from '../src/core/SaveSystem.js';
import { TomeEquipmentEngine, TVAL } from '../src/systems/TomeEquipmentEngine.js';
import { Map } from '../src/map/Map.js';

console.log("================================================================================");
console.log("🔒 [SAVE/LOAD WEIGHT INVARIANCE & DEDUPLICATION TEST SUITE] 🔒");
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
// SETUP
// -----------------------------------------------------------------------------
const gameMock = {
  floor: 5,
  floorDanger: 1.0,
  map: new Map(20, 20, 1),
  effects: [],
  monsters: [],
  items: [],
  player: new Player(10, 10, 'MON_NOVICE_WARRIOR'),
  logs: [],
  addLogEntry(text, type) { this.logs.push({ text, type }); },
  updateUI() {}
};

// Equip Titan Core
const titanCore = new Item(0, 0, 'CORE', '%', '#f59e0b', 'Lesser titan core');
titanCore.coreType = 'MON_LESSER_TITAN';
gameMock.player.mimicCore = titanCore;

// Add diverse inventory items
const arrows = new Item(0, 0, 'ARROW', '{', '#cbd5e1', 'Flight Arrows');
arrows.tval = TVAL.ARROW;
arrows.slotType = 'QUIVER';
arrows.count = 100;

const potions = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Healing Potions');
potions.tval = TVAL.POTION;
potions.count = 20;

const scrolls = new Item(0, 0, 'SCROLL', '?', '#cbd5e1', 'Scroll of Teleport');
scrolls.tval = TVAL.SCROLL;
scrolls.count = 15;

const food = new Item(0, 0, 'FOOD', ',', '#fbbf24', 'Food Rations');
food.tval = TVAL.FOOD;
food.count = 10;

const wand = new Item(0, 0, 'WAND', '-', '#38bdf8', 'Wand of Lightning');
wand.tval = TVAL.WAND;
wand.count = 2;

const staff = new Item(0, 0, 'STAFF', '_', '#a855f7', 'Staff of Earthquakes');
staff.tval = TVAL.STAFF;
staff.count = 1;

const extraCore = new Item(0, 0, 'CORE', '%', '#ef4444', 'Red Dragon Core');
extraCore.coreType = 'MON_RED_DRAGON';

gameMock.player.inventory.push(arrows, potions, scrolls, food, wand, staff, extraCore);

// -----------------------------------------------------------------------------
// TEST 1: 10 Consecutive Save/Load Invariance Cycles
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 10회 연속 세이브/로드 복리 무게 폭등 방지 불변성 검증 ---");

SaveSystem.deserialize(gameMock, JSON.parse(SaveSystem.serialize(gameMock)));
const initialWeight = gameMock.player.body.getCurrentWeight();
console.log(`  [Initial] 세이브/로드 초기화 후 총 소지 무게: ${initialWeight} lbs`);
assert(initialWeight > 0 && initialWeight < 120, `초기 총 소지 무게 (${initialWeight} lbs)가 정상 범위(120 lbs 미만)임`);

for (let cycle = 1; cycle <= 10; cycle++) {
  const serialized = SaveSystem.serialize(gameMock);
  const parsed = JSON.parse(serialized);
  SaveSystem.deserialize(gameMock, parsed);
  
  const currentWeight = gameMock.player.body.getCurrentWeight();
  const diff = Math.abs(currentWeight - initialWeight);

  assert(
    diff < 0.001,
    `[사이클 ${cycle}/10] 세이브/로드 후 무게 불변 (초기: ${initialWeight} lbs == 현재: ${currentWeight} lbs)`
  );
}

// -----------------------------------------------------------------------------
// TEST 2: Individual Item Weight Invariance
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 개별 아이템 단위 무게 및 _weight 오염 방지 검증 ---");

const deserializedArrows = gameMock.player.inventory.find(i => i.tval === TVAL.ARROW || i.type === 'ARROW');
assert(deserializedArrows !== undefined, "화살 인벤토리 아이템 검색 성공");
assert(deserializedArrows.weight === 10, `화살 100발 무게가 10 lbs로 정확함 (실제: ${deserializedArrows.weight} lbs)`);

const deserializedPotions = gameMock.player.inventory.find(i => (i.tval === TVAL.POTION || i.type === 'POTION') && i.count === 20);
assert(deserializedPotions !== undefined, "포션 20병 인벤토리 아이템 검색 성공");
assert(deserializedPotions.weight === 8.0, `포션 20병 무게가 8.0 lbs로 정확함 (실제: ${deserializedPotions.weight} lbs)`);

const deserializedCore = gameMock.player.inventory.find(i => i.type === 'CORE' && i.coreType === 'MON_RED_DRAGON');
assert(deserializedCore !== undefined, "인벤토리 보관용 드래곤 코어 검색 성공");
assert(deserializedCore.weight <= 20, `보관용 드래곤 코어 무게 (${deserializedCore.weight} lbs)가 20 lbs 이하로 캡핑됨`);

// -----------------------------------------------------------------------------
// TEST 3: Legacy Corrupt Save File Resistance
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 레거시 손상 세이브 데이터(weight: 7350) 로드 시 안전 복원 검증 ---");

const corruptSaveData = {
  floor: 1,
  floorDanger: 1.0,
  map: {
    width: 20,
    height: 20,
    floor: 1,
    startingPosition: { x: 0, y: 0 },
    rooms: []
  },
  player: {
    x: 0,
    y: 0,
    name: 'Adventurer',
    level: 1,
    hp: 20,
    maxHp: 20,
    speed: 10,
    inventory: [
      {
        type: 'ARROW',
        tval: TVAL.ARROW,
        slotType: 'QUIVER',
        count: 100,
        weight: 7350 // Corrupt legacy weight
      }
    ],
    equipment: { weapon: -1, shield: -1, bow: -1, quiver: -1, armor: -1, helmet: -1, gloves: -1, boots: -1, cloak: -1, subCore1: -1, subCore2: -1, ring1: -1, ring2: -1, amulet: -1, equippedLamp: -1 }
  },
  items: [],
  monsters: []
};

SaveSystem.deserialize(gameMock, corruptSaveData);

const recoveredArrow = gameMock.player.inventory[0];
assert(recoveredArrow.weight === 10, `손상된 7350 lbs 화살이 동적 공식에 의해 10 lbs로 정상 자가치유 복구됨 (실제: ${recoveredArrow.weight} lbs)`);
const totalWeight = gameMock.player.body.getCurrentWeight();
assert(totalWeight <= 50, `복구된 플레이어 총 무게 (${totalWeight} lbs)가 50 lbs 이하로 정상 유지됨`);

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
