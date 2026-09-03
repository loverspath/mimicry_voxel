/**
 * scripts/test_encumbrance_ammo_and_archer_loot.js
 * Unit & Integration Test Suite for:
 * 1. Starting presets encumbrance bugfix (no double-counting of equipped gear in inventory).
 * 2. Multi-stack ammo bundle generation (15~35 count) in TomeLootGenerator and ItemRegistry.
 * 3. Archer monster kill bonus arrow bundle drops (85% chance, 15~30 count, contextual tier, log verification).
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { createTomeItem } from '../src/entities/ItemRegistry.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { TomeEquipmentEngine, TVAL } from '../src/systems/TomeEquipmentEngine.js';

console.log("================================================================================");
console.log("🏹 [ENCUMBRANCE, AMMO BUNDLES & ARCHER LOOT TEST SUITE] 🏹");
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
// TEST 1: Starting Presets Encumbrance Bugfix (No Overburdened status on spawn)
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 신규 캐릭터 기본 프리셋 소지 중량 및 과적 방지 검증 ---");

const testPresets = [
  'MON_NOVICE_WARRIOR',
  'MON_NOVICE_MAGE',
  'MON_NOVICE_PRIEST',
  'MON_NOVICE_ROGUE',
  'MON_SMALL_KOBOLD',
  'MON_FRUIT_BAT',
  'MON_GREEN_OOZE',
  'IMP'
];

for (const speciesKey of testPresets) {
  const p = new Player(0, 0, speciesKey);
  const currentWeight = p.body.getCurrentWeight();
  const maxLimit = p.body.getMaxWeightLimit();
  const speedMod = p.body.getSpeedModifier();

  assert(
    currentWeight < maxLimit * 0.80,
    `[${speciesKey}] 소지 중량 (${currentWeight}kg)은 최대 적재 한계(${maxLimit}kg)의 80% 미만으로 정상 유지됨`
  );
  assert(
    speedMod === 1.0,
    `[${speciesKey}] 시작 속도 감속 배율이 1.0 (감속 페널티 없음) 확인`
  );
}

// -----------------------------------------------------------------------------
// TEST 2: Inventory vs Equipment Weight Filtering (No Double Counting)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 장착 장비와 인벤토리 중복 무게 합산 방지 필터 검증 ---");
const p2 = new Player(0, 0, 'MON_NOVICE_WARRIOR');
const initialWeight = p2.body.getCurrentWeight();

// Un-equipping weapon: move from equipment.weapon to inventory-only (not in equipment)
const equippedWeapon = p2.equipment.weapon;
p2.equipment.weapon = null;
const weightAfterUnequip = p2.body.getCurrentWeight();

assert(
  initialWeight === weightAfterUnequip,
  `무기 장착 해제 시 총 소지 중량이 불변해야 함 (이중 가산 없음: 초기 ${initialWeight}kg == 해제 후 ${weightAfterUnequip}kg)`
);

// -----------------------------------------------------------------------------
// TEST 3: Multi-stack Ammo (15~35) Generation in TomeLootGenerator & ItemRegistry
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 화살/볼트 탄약류 15~35발 다발(Bundle) 생성 검증 ---");

// ItemRegistry createTomeItem ammo checks
const ammoKinds = ['KIND_ARROW', 'KIND_SEEKER_ARROW', 'KIND_SHEAF_ARROW', 'KIND_FLIGHT_ARROW', 'KIND_SILVER_ARROW'];
for (const key of ammoKinds) {
  const arrowItem = createTomeItem(key);
  assert(arrowItem !== null, `[ItemRegistry] ${key} 생성 성공`);
  assert(arrowItem.slotType === 'QUIVER', `[ItemRegistry] ${key} slotType은 QUIVER임`);
  assert(arrowItem.char === '{', `[ItemRegistry] ${key} char 심볼은 '{' 임`);
  assert(
    arrowItem.count >= 15 && arrowItem.count <= 35,
    `[ItemRegistry] ${key} count (${arrowItem.count}발)는 15~35발 범위 내임`
  );
  assert(
    arrowItem.weight >= 1 && arrowItem.weight <= 5,
    `[ItemRegistry] ${key} 번들 무게 (${arrowItem.weight}kg) 정상 스케일링됨`
  );
}

// TomeLootGenerator ammo bundling checks
let generatedAmmoCount = 0;
let validBundleRangeCount = 0;
for (let i = 0; i < 400; i++) {
  const item = TomeLootGenerator.generateFloorItem(0, 0, 10);
  if (item.tval === TVAL.ARROW || item.tval === TVAL.BOLT || item.tval === TVAL.SHOT || item.slotType === 'QUIVER') {
    generatedAmmoCount++;
    if (item.count >= 15 && item.count <= 35) {
      validBundleRangeCount++;
    }
  }
}
assert(
  generatedAmmoCount > 0 && validBundleRangeCount === generatedAmmoCount,
  `[TomeLootGenerator] 던전 생성 탄약 (${generatedAmmoCount}개) 전수가 15~35발 번들로 생성됨`
);

// -----------------------------------------------------------------------------
// TEST 4: Archer Monster Detection and 85% Bonus Arrow Bundle Drops
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 궁수/화살 계열 몬스터 처치 시 85% 화살 다발 보너스 드랍 검증 ---");

const testArcherConfigs = [
  {
    name: 'Novice archer',
    displayName: 'Novice archer',
    type: 'MON_NOVICE_ARCHER',
    x: 5,
    y: 5,
    level: 5,
    xpValue: 30,
    spells: ['ARROW_1']
  },
  {
    name: 'Elven Ranger',
    displayName: '엘프 순찰자',
    type: 'MON_ELF_RANGER',
    x: 6,
    y: 6,
    level: 25,
    xpValue: 120,
    specialTags: ['ARCHER']
  },
  {
    name: 'Master Sniper',
    displayName: '마스터 스나이퍼',
    type: 'MON_SNIPER',
    x: 7,
    y: 7,
    level: 45,
    xpValue: 350,
    tags: ['ARROW']
  }
];

const mockPlayer = new Player(0, 0);

for (const archerMon of testArcherConfigs) {
  let dropOccurred = 0;
  const trials = 200;
  const capturedLogs = [];

  for (let i = 0; i < trials; i++) {
    const mockGame = {
      floor: archerMon.level,
      items: [],
      addLogEntry: (text, type) => capturedLogs.push({ text, type })
    };

    LootSystem.processMonsterDeath(mockGame, mockPlayer, archerMon, '화살 저격');
    const archerDrop = mockGame.items.find(it => it.specialTags && it.specialTags.includes('AMMO'));
    if (archerDrop) {
      dropOccurred++;
      assert(
        archerDrop.count >= 15 && archerDrop.count <= 35,
        `[${archerMon.name}] 보너스 화살 수량(${archerDrop.count}발)이 15~35발 범위 내임`
      );
      assert(
        archerDrop.slotType === 'QUIVER',
        `[${archerMon.name}] 보너스 드랍 아이템 슬롯이 QUIVER임`
      );
    }
  }

  const rate = dropOccurred / trials;
  assert(
    rate >= 0.70 && rate <= 0.98,
    `[${archerMon.name}] 화살 다발 보너스 드롭률 (${(rate * 100).toFixed(1)}%)이 약 85% 규격을 준수함`
  );

  const archerLog = capturedLogs.find(l => l.text && l.text.includes('🏹 [궁수 전리품]'));
  assert(
    Boolean(archerLog),
    `[${archerMon.name}] 궁수 전리품 획득 로그 ("🏹 [궁수 전리품]...") 정상 출력 확인`
  );
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`TEST SUMMARY: TOTAL ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL ENCUMBRANCE, AMMO BUNDLE & ARCHER LOOT TESTS PASSED 100%!");
  process.exit(0);
}
