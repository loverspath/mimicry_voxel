/**
 * @file test_item_symbols.js
 * @description ToME 2.3.5 정통 아스키 심볼 전역 검증 및 레거시 문자 박멸 검사 스크립트
 */

import { Item } from '../src/entities/Item.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Spawner } from '../src/core/Spawner.js';
import { Map } from '../src/map/Map.js';
import { TOME_BASE_ITEMS, createTomeItem } from '../src/entities/ItemRegistry.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';

console.log("==================================================");
console.log("🔍 TOME 2.3.5 ITEM SYMBOL INTEGRITY TEST");
console.log("==================================================");

const VALID_TOME_SYMBOLS = new Set([
  '[',  // armor / boots / gloves / robe
  ']',  // helmet / crown
  ')',  // shield
  '(',  // cloak
  '|',  // sword / dagger
  '\\', // axe / blunt / hammer
  '/',  // polearm / spear / staff
  '}',  // bow / crossbow / sling
  '{',  // ammo / arrow
  '=',  // ring
  '"',  // amulet
  '~',  // light / torch / lamp / chest / junk
  '!',  // potion / bottle
  '?',  // scroll / book
  '*',  // core / gem / artifact
  '$',  // gold
  '&',  // skeleton
  '-',  // wand / rod
  ','   // food
]);

const FORBIDDEN_LEGACY_SYMBOLS = new Set(['a', 'd', 'h', 'o', 'i', 'w', 't', 'W', 'c', '@']);

let totalChecked = 0;
let passedCount = 0;

function assertSymbol(item, context) {
  totalChecked++;
  const char = item.char;
  const isValid = VALID_TOME_SYMBOLS.has(char);
  const isForbidden = FORBIDDEN_LEGACY_SYMBOLS.has(char);

  if (isValid && !isForbidden) {
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${context} | Item: "${item.name}" (type: ${item.type}, slot: ${item.slotType}) has INVALID symbol: '${char}'`);
    process.exit(1);
  }
}

// 1. Check Player Starting Inventory & Equipment
console.log("\n--- 1. Testing Player Starting Inventory & Cores ---");
const player = new Player(10, 10, 'HUMAN');
player.inventory.forEach((it, idx) => {
  assertSymbol(it, `Player inventory slot #${idx}`);
});

// 2. Check Monster Core Drops
console.log("\n--- 2. Testing Monster Core Drops ---");
const monsterTypes = ['SLIME', 'GOBLIN', 'ORC', 'OGRE', 'BAT', 'DRAGON', 'HATCHLING', 'HUMAN'];
monsterTypes.forEach(sp => {
  const m = new Monster(10, 10, sp, 1);
  const coreItem = m.createCoreItem();
  assertSymbol(coreItem, `Monster core drop (${sp})`);
});

// 3. Check Spawner Floor Item Pools
console.log("\n--- 3. Testing Spawner Item Generator Pools ---");
const map = new Map(40, 40);
const mockGame = {
  map,
  items: [],
  monsters: [],
  floor: 1,
  floorDanger: 1,
  player,
  addLogEntry() {}
};

Spawner.spawnFloorContent(mockGame);
mockGame.items.forEach((it, idx) => {
  assertSymbol(it, `Spawner floor item #${idx}`);
});

// Test Ring and Amulet Rollers
for (let d = 1; d <= 10; d++) {
  const ring = Spawner.rollRing(0, 0, d);
  assertSymbol(ring, `Spawner.rollRing(danger=${d})`);

  const amulet = Spawner.rollAmulet(0, 0, d);
  assertSymbol(amulet, `Spawner.rollAmulet(danger=${d})`);
}

// 4. Check ItemRegistry Sampled Items
console.log("\n--- 4. Testing ItemRegistry Base Items ---");
for (const key in TOME_BASE_ITEMS) {
  const it = createTomeItem(key, 0, 0);
  if (it) {
    assertSymbol(it, `ItemRegistry item: ${key}`);
  }
}

// 5. Check TomeLootGenerator Depth Scaling Drops
console.log("\n--- 5. Testing TomeLootGenerator Depth Drops ---");
for (let depth = 1; depth <= 50; depth += 5) {
  for (let i = 0; i < 5; i++) {
    const loot = TomeLootGenerator.generateLoot(0, 0, depth, i === 0);
    assertSymbol(loot, `TomeLootGenerator(depth=${depth}, isBoss=${i === 0})`);
  }
}

// 6. Test Legacy Sanitization Guard on Item Constructor
console.log("\n--- 6. Testing Legacy Sanitization Guard ---");
const legacyTests = [
  { rawChar: 'a', type: 'ARMOR', slotType: 'ARMOR', expected: '[' },
  { rawChar: 'h', type: 'HELMET', slotType: 'HELMET', expected: ']' },
  { rawChar: 'o', type: 'RING', slotType: 'RING', expected: '=' },
  { rawChar: 'i', type: 'AMULET', slotType: 'AMULET', expected: '"' },
  { rawChar: 'w', type: 'WEAPON', slotType: 'WEAPON', expected: '|' },
  { rawChar: 'd', type: 'WEAPON', slotType: 'WEAPON', expected: '|' },
  { rawChar: 't', type: 'LAMP', slotType: 'LIGHT', expected: '~' },
  { rawChar: 'W', type: 'WEAPON', slotType: 'WEAPON', expected: '|' },
  { rawChar: 'c', type: 'CORE', slotType: null, expected: '*' },
  { rawChar: '@', type: 'CORE', slotType: null, expected: '*' }
];

legacyTests.forEach(t => {
  const item = new Item(0, 0, t.type, t.rawChar, '#fff', 'TestItem', 0, t.slotType);
  if (item.char === t.expected) {
    totalChecked++;
    passedCount++;
  } else {
    console.error(`❌ [FAIL] Sanitizer failed for rawChar '${t.rawChar}' -> got '${item.char}', expected '${t.expected}'`);
    process.exit(1);
  }
});

console.log("\n==================================================");
console.log(`🎉 ALL ${totalChecked} ITEM SYMBOLS TESTED & PASSED (100% ToME 2.3.5 COMPLIANT)`);
console.log("==================================================");
