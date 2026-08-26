/**
 * scripts/test_encumbrance_safety_and_lightweight.js
 * Unit test verifying:
 * 1. ToME canonical lightweight consumable weights (potions: 0.4, scrolls: 0.2, food: 0.5, wands/rods: 0.5, staves: 1.5)
 * 2. MimicBody.js max weight limit baseline (40 lbs + STR*2.5 + CON*1.5 + LVL*1.5)
 * 3. Low STR/Mage/Agility morph forms with 10 potions, 5 food, 30 arrows, and equipped gear remain unencumbered (< 80%)
 * 4. Equipment vs inventory weight calculation prevents duplicate addition
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { TomeEquipmentEngine, TVAL } from '../src/systems/TomeEquipmentEngine.js';

console.log("================================================================================");
console.log("🎒 [ENCUMBRANCE SAFETY & LIGHTWEIGHT CONSUMABLES TEST SUITE] 🎒");
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
// TEST 1: Consumable Lightweight Scaling (ToME Canonical)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 소모품 단위 무게 ToME 정통 경량화 검증 ---");

const potion = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Potion of Healing');
potion.tval = TVAL.POTION;
potion.count = 10;
const potionWeight = TomeEquipmentEngine.calculateWeight(potion);
assert(potionWeight === 4.0, `포션 10병 무게가 4.0 lbs임 (실제: ${potionWeight})`);

const scroll = new Item(0, 0, 'SCROLL', '?', '#cbd5e1', 'Scroll of Phase Door');
scroll.tval = TVAL.SCROLL;
scroll.count = 5;
const scrollWeight = TomeEquipmentEngine.calculateWeight(scroll);
assert(scrollWeight === 1.0, `스크롤 5장 무게가 1.0 lbs임 (실제: ${scrollWeight})`);

const food = new Item(0, 0, 'FOOD', ',', '#fbbf24', 'Ration of Food');
food.tval = TVAL.FOOD;
food.count = 5;
const foodWeight = TomeEquipmentEngine.calculateWeight(food);
assert(foodWeight === 2.5, `식량 5개 무게가 2.5 lbs임 (실제: ${foodWeight})`);

const wand = new Item(0, 0, 'WAND', '-', '#38bdf8', 'Wand of Magic Missile');
wand.tval = TVAL.WAND;
wand.count = 2;
const wandWeight = TomeEquipmentEngine.calculateWeight(wand);
assert(wandWeight === 1.0, `완드 2개 무게가 1.0 lbs임 (실제: ${wandWeight})`);

const staff = new Item(0, 0, 'STAFF', '_', '#a855f7', 'Staff of Light');
staff.tval = TVAL.STAFF;
staff.count = 1;
const staffWeight = TomeEquipmentEngine.calculateWeight(staff);
assert(staffWeight === 1.5, `스태프 1개 무게가 1.5 lbs임 (실제: ${staffWeight})`);

// -----------------------------------------------------------------------------
// TEST 2: Max Weight Limit 40 lbs Baseline Formula
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 최대 적재 한계치 기본 40 lbs 안전 베이스라인 검증 ---");

const player = new Player(0, 0, 'MON_NOVICE_WARRIOR');
const str = player.getEffectiveStat('str');
const con = player.getEffectiveStat('con');
const lvl = player.level || 1;
const expectedLimit = Math.floor(40 + (str * 2.5) + (con * 1.5) + (lvl * 1.5));
const actualLimit = player.body.getMaxWeightLimit();

assert(actualLimit === expectedLimit, `최대 적재 한계치가 공식과 일치함 (${actualLimit} lbs == ${expectedLimit} lbs)`);
assert(actualLimit >= 65, `기본 캐릭터 최대 적재량이 65 lbs 이상으로 안전함 (현재: ${actualLimit} lbs)`);

// -----------------------------------------------------------------------------
// TEST 3: All Archetypes with Heavy Supplies Remain Unencumbered (< 80%)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 저STR 및 마법/민첩형 폼에서 보급품 소지 시 과적 방지 검증 ---");

const archetypePresets = [
  'MON_NOVICE_MAGE',
  'MON_NOVICE_PRIEST',
  'MON_NOVICE_ROGUE',
  'MON_FRUIT_BAT',
  'MON_SMALL_KOBOLD',
  'IMP'
];

for (const species of archetypePresets) {
  const p = new Player(0, 0, species);

  // Add supplies: 10 potions, 5 food, 30 arrows, 5 scrolls
  const pPotions = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Potion of Healing');
  pPotions.tval = TVAL.POTION;
  pPotions.count = 10;

  const pFood = new Item(0, 0, 'FOOD', ',', '#fbbf24', 'Ration of Food');
  pFood.tval = TVAL.FOOD;
  pFood.count = 5;

  const pArrows = new Item(0, 0, 'QUIVER', '{', '#cbd5e1', 'Arrows');
  pArrows.slotType = 'QUIVER';
  pArrows.count = 30;

  const pScrolls = new Item(0, 0, 'SCROLL', '?', '#cbd5e1', 'Scroll of Phase Door');
  pScrolls.tval = TVAL.SCROLL;
  pScrolls.count = 5;

  p.inventory.push(pPotions, pFood, pArrows, pScrolls);

  const curWeight = p.body.getCurrentWeight();
  const maxCap = p.body.getMaxWeightLimit();
  const speedMod = p.body.getSpeedModifier();

  assert(
    curWeight < maxCap * 0.80,
    `[${species}] 보급품 50개 소지 시 소지량 (${curWeight.toFixed(1)} lbs)이 최대 한계 (${maxCap} lbs)의 80% 미만임`
  );
  assert(
    speedMod === 1.0,
    `[${species}] 감속 페널티 없이 정상 속도 (1.0) 유지`
  );
}

// -----------------------------------------------------------------------------
// TEST 4: Equipment vs Inventory Weight Deduplication
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 장착 장비와 인벤토리 간 이중 가산 방지 검증 ---");

const testPlayer = new Player(0, 0, 'MON_NOVICE_WARRIOR');
const initialTotal = testPlayer.body.getCurrentWeight();

// Un-equip and re-equip check
const equippedWep = testPlayer.equipment.weapon;
testPlayer.equipment.weapon = null;
const weightAfterUnequip = testPlayer.body.getCurrentWeight();

assert(initialTotal === weightAfterUnequip, `무기 해제 시 무게 불변 확인 (${initialTotal} lbs == ${weightAfterUnequip} lbs)`);

testPlayer.equipment.weapon = equippedWep;
const weightAfterReEquip = testPlayer.body.getCurrentWeight();
assert(initialTotal === weightAfterReEquip, `무기 재장착 시 무게 불변 확인 (${initialTotal} lbs == ${weightAfterReEquip} lbs)`);

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
