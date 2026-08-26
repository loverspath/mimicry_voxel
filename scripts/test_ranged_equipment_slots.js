/**
 * scripts/test_ranged_equipment_slots.js
 * Independent Ranged (Bow) & Quiver Equipment Slots Test Suite
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { renderInventorySlotHTML } from '../src/ui/InventoryView.js';

console.log("================================================================================");
console.log("🏹 [INDEPENDENT RANGED (BOW) & QUIVER EQUIPMENT SLOTS TEST SUITE] 🏹");
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
// TEST 1: Starter Kit 5-Slot Simultaneous Equipping Verification
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 스타터 킷 5대 장비(검/활/화살통/갑옷/등불) 동시 장착 검증 ---");
const player = new Player(10, 10, 'MON_NOVICE_WARRIOR');

assert(player.equipment.weapon !== null && player.equipment.weapon.name === 'Short Sword', `1. 근접 무기 슬롯(weapon): Short Sword 장착 확인`);
assert(player.equipment.bow !== null && player.equipment.bow.name === 'Shortbow', `2. 원거리 활 슬롯(bow): Shortbow 독립 장착 확인`);
assert(player.equipment.quiver !== null && player.equipment.quiver.name === 'Bundle of Arrows', `3. 화살통 슬롯(quiver): Bundle of Arrows 장착 확인 (${player.equipment.quiver.count}발)`);
assert(player.equipment.armor !== null && player.equipment.armor.name === 'Soft Leather Armour', `4. 방어구 슬롯(armor): Soft Leather Armour 장착 확인`);
assert(player.equippedLamp !== null && player.equippedLamp.name === 'Wooden Torch', `5. 광원 슬롯(lamp): Wooden Torch 장착 확인`);

// -----------------------------------------------------------------------------
// TEST 2: Independent Slot Equipping & No Collision / Swap Overwrite
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 무기 슬롯 독립성 및 스왑 충돌 방지 검증 ---");

const initialWeapon = player.equipment.weapon;
const initialBow = player.equipment.bow;
const initialQuiver = player.equipment.quiver;

// Equip a new bow -> Only bow slot should change, melee weapon should be preserved!
const longbow = new Item(10, 10, 'BOW', '}', '#b45309', 'Longbow', 0, 'BOW', { dex: 3 }, '1d6', null, [], [], [], "A powerful bow.");
player.equipItem(longbow);

assert(player.equipment.bow === longbow, `새 활(Longbow) 장착 시 bow 슬롯에 정상 장착됨`);
assert(player.equipment.weapon === initialWeapon, `활 장착 후에도 기존 근접 무기(${initialWeapon.name}) 슬롯이 보존됨 (스왑 충돌 방지)`);

// Equip a new melee weapon -> Only melee slot should change, bow should be preserved!
const broadsword = new Item(10, 10, 'WEAPON', '|', '#94a3b8', 'Broad Sword', 0, 'WEAPON', { str: 2 }, '2d5', null, [], [], [], "A heavy cutting blade.");
player.equipItem(broadsword);

assert(player.equipment.weapon === broadsword, `새 도검(Broad Sword) 장착 시 weapon 슬롯에 정상 장착됨`);
assert(player.equipment.bow === longbow, `도검 장착 후에도 원거리 활(Longbow) 슬롯이 보존됨 (동시 장착 유지)`);

// -----------------------------------------------------------------------------
// TEST 3: Ammo Quiver Depletion & Auto-Unequip
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 화살통 탄약 소진 및 자동 탈착 검증 ---");

const mockGame = {
  player: player,
  monsters: [new Monster(14, 10, 'GOBLIN', 3)],
  items: [],
  map: { isWalkable: () => true, isTransparent: () => true },
  effects: [],
  logs: [],
  addLogEntry: function(msg, type) { this.logs.push({ msg, type }); },
  updateUI: function() {},
  handlePlayerDeath: function() {}
};

// Set small ammo in quiver
player.equipment.quiver.count = 2;
const targetMonster = mockGame.monsters[0];

// Shot 1
CombatSystem.fireRangedAttack(mockGame, player, targetMonster);
assert(player.equipment.quiver && player.equipment.quiver.count === 1, `1발 사격 후 화살통 탄약 1발 남음`);

// Shot 2 (Last arrow)
CombatSystem.fireRangedAttack(mockGame, player, targetMonster);
assert(player.equipment.quiver === null, `마지막 화살 발사 후 화살통(quiver) 슬롯 자동 비워짐 (null)`);

// -----------------------------------------------------------------------------
// TEST 4: UI InventoryView Slot Badges
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: UI 인벤토리 뷰 슬롯 배지(bow, quiver) 렌더링 검증 ---");

player.equipment.bow = longbow;
player.equipment.quiver = initialQuiver;
initialQuiver.count = 30;

const bowSlotInfo = renderInventorySlotHTML(longbow, player);
assert(bowSlotInfo.isEquipped === true && bowSlotInfo.slotKey === 'bow', `활 아이템 renderInventorySlotHTML -> slotKey: 'bow' 판별 성공`);
assert(bowSlotInfo.html.includes('활'), `활 슬롯 배지 HTML에 '활' 텍스트 포함 확인`);

const quiverSlotInfo = renderInventorySlotHTML(initialQuiver, player);
assert(quiverSlotInfo.isEquipped === true && quiverSlotInfo.slotKey === 'quiver', `화살통 renderInventorySlotHTML -> slotKey: 'quiver' 판별 성공`);
assert(quiverSlotInfo.html.includes('화살통'), `화살통 슬롯 배지 HTML에 '화살통' 텍스트 포함 확인`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
