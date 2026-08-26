/**
 * @file test_shield_and_gloves_slots.js
 * @description 독립 장갑(GLOVES) 및 방패(SHIELD) 장비 슬롯 신설,
 *              주무기 + 방패 + 갑옷 + 장갑 + 투구 동시 장착 및 AC 합산 검증 테스트 스위트.
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { renderInventorySlotHTML } from '../src/ui/InventoryView.js';
import { renderPlayerStatusPanelHTML } from '../src/ui/HUDView.js';
import { SaveSystem } from '../src/core/SaveSystem.js';
import { Map } from '../src/map/Map.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('🧪 ========================================================');
console.log('🧪 [TEST SUITE 1] ToME 2.3.5 데이터셋 내 장갑 및 방패 슬롯타입 전수 분류 검증');
console.log('🧪 ========================================================');

const leatherGloves = TOME_KINDS_DATA['KIND_SET_OF_LEATHER_GLOVES'];
assert(leatherGloves !== undefined, '가죽 장갑(KIND_SET_OF_LEATHER_GLOVES) 데이터 존재');
assert(leatherGloves.type === 'GLOVES', '가죽 장갑 type이 GLOVES로 분류됨');
assert(leatherGloves.slotType === 'GLOVES', '가죽 장갑 slotType이 GLOVES로 독립 슬롯 지정됨');
assert(leatherGloves.char === ']', '장갑 심볼이 ] 로 설정됨');

const gauntlets = TOME_KINDS_DATA['KIND_SET_OF_GAUNTLETS'];
assert(gauntlets !== undefined, '건틀릿(KIND_SET_OF_GAUNTLETS) 데이터 존재');
assert(gauntlets.type === 'GLOVES' && gauntlets.slotType === 'GLOVES', '건틀릿 type/slotType이 GLOVES로 지정됨');

const smallShield = TOME_KINDS_DATA['KIND_SMALL_METAL_SHIELD'];
assert(smallShield !== undefined, '소형 금속 방패(KIND_SMALL_METAL_SHIELD) 데이터 존재');
assert(smallShield.type === 'SHIELD', '방패 type이 SHIELD로 분류됨');
assert(smallShield.slotType === 'SHIELD', '방패 slotType이 SHIELD로 독립 슬롯 지정됨');
assert(smallShield.char === ')', '방패 심볼이 ) 로 설정됨');

const largeShield = TOME_KINDS_DATA['KIND_LARGE_METAL_SHIELD'];
assert(largeShield !== undefined, '대형 금속 방패(KIND_LARGE_METAL_SHIELD) 데이터 존재');
assert(largeShield.type === 'SHIELD' && largeShield.slotType === 'SHIELD', '대형 방패 type/slotType이 SHIELD로 지정됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] 무기 + 방패 + 갑옷 + 장갑 + 투구 동시 장착 파이프라인 검증');
console.log('🧪 ========================================================');

const player = new Player(5, 5);

const weaponItem = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', '브로드소드', 0, 'WEAPON', { str: 2 }, '2d5');
const shieldItem = new Item(0, 0, 'SHIELD', ')', '#94a3b8', '대형 금속 방패', 0, 'SHIELD', { con: 2 });
shieldItem.baseAC = 5;
const armorItem = new Item(0, 0, 'ARMOR', '[', '#64748b', '체인 메일', 0, 'ARMOR', { con: 3 });
armorItem.baseAC = 6;
const glovesItem = new Item(0, 0, 'GLOVES', ']', '#d97706', '강철 건틀릿', 0, 'GLOVES', { str: 1 });
glovesItem.baseAC = 3;
const helmetItem = new Item(0, 0, 'HELMET', ']', '#94a3b8', '주조 강철 투구', 0, 'HELMET', { con: 1 });
helmetItem.baseAC = 2;

// 순차적으로 장착
player.equipItem(weaponItem);
assert(player.equipment.weapon === weaponItem, '1. 무기 장착 성공');

player.equipItem(shieldItem);
assert(player.equipment.shield === shieldItem, '2. 방패 장착 성공');
assert(player.equipment.weapon === weaponItem, '2. 방패 장착 시 무기가 해제되지 않고 동시 장착 유지됨 (검+방패)');

player.equipItem(armorItem);
assert(player.equipment.armor === armorItem, '3. 갑옷 장착 성공');
assert(player.equipment.shield === shieldItem, '3. 갑옷 장착 시 방패 유지됨');

player.equipItem(glovesItem);
assert(player.equipment.gloves === glovesItem, '4. 장갑 장착 성공');
assert(player.equipment.armor === armorItem, '4. 장갑 장착 시 갑옷이 해제되지 않고 동시 장착 유지됨 (갑옷+장갑 독립 슬롯)');

player.equipItem(helmetItem);
assert(player.equipment.helmet === helmetItem, '5. 투구 장착 성공');

// 5종 동시 장착 최종 상태 검증
assert(
  player.equipment.weapon === weaponItem &&
  player.equipment.shield === shieldItem &&
  player.equipment.armor === armorItem &&
  player.equipment.gloves === glovesItem &&
  player.equipment.helmet === helmetItem,
  '🎉 무기 + 방패 + 갑옷 + 장갑 + 투구 5종 장비가 완벽하게 동시 장착됨'
);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] 방어력(AC) 누적 합산 연동 검증');
console.log('🧪 ========================================================');

const coreBaseAC = 16; // MON_NOVICE_WARRIOR baseAC
const baseExpectedAC = coreBaseAC + player.dexMod + armorItem.baseAC + shieldItem.baseAC + glovesItem.baseAC + helmetItem.baseAC;
const totalAC = player.getTotalAC();
console.log(`  📊 산출된 플레이어 총 AC: ${totalAC} (코어 기본 ${coreBaseAC} + DEX(${player.dexMod}) + 갑옷(6) + 방패(5) + 장갑(3) + 투구(2) = ${baseExpectedAC})`);
assert(totalAC === baseExpectedAC, `총 AC가 모든 부위(갑옷 6 + 방패 5 + 장갑 3 + 투구 2) 정상 합산됨 (${totalAC} === ${baseExpectedAC})`);

// 장갑 해제 시 AC 감소 확인
player.unequipItem(glovesItem);
assert(player.equipment.gloves === null, '장갑 해제 성공');
assert(player.getTotalAC() === totalAC - glovesItem.baseAC, '장갑 해제 시 AC가 장갑 방어력(3)만큼 정확히 감소');

// 방패 해제 시 AC 감소 확인
player.unequipItem(shieldItem);
assert(player.equipment.shield === null, '방패 해제 성공');
assert(player.getTotalAC() === totalAC - glovesItem.baseAC - shieldItem.baseAC, '방패 해제 시 AC가 방패 방어력(5)만큼 정확히 감소');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] UI 레이어 배지 및 상태창 렌더링 검증');
console.log('🧪 ========================================================');

// 다시 장착
player.equipItem(glovesItem);
player.equipItem(shieldItem);

const shieldSlot = renderInventorySlotHTML(shieldItem, player);
assert(shieldSlot.slotKey === 'shield', '방패 slotKey가 shield로 반환됨');
assert(shieldSlot.html.includes('방패'), '인벤토리 슬롯에 [방패] 배지 정상 렌더링');

const glovesSlot = renderInventorySlotHTML(glovesItem, player);
assert(glovesSlot.slotKey === 'gloves', '장갑 slotKey가 gloves로 반환됨');
assert(glovesSlot.html.includes('장갑'), '인벤토리 슬롯에 [장갑] 배지 정상 렌더링');

const hudHtml = renderPlayerStatusPanelHTML(player);
assert(hudHtml.includes('방패 (SHIELD)'), 'HUD 캐릭터 정보창에 방패(SHIELD) 슬롯 렌더링');
assert(hudHtml.includes('장착 장갑'), 'HUD 캐릭터 정보창에 장착 장갑 슬롯 렌더링');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 5] 세이브 & 로드 직렬화/역직렬화 무결성 검증');
console.log('🧪 ========================================================');

player.inventory = [weaponItem, shieldItem, armorItem, glovesItem, helmetItem];

const testMap = new Map(30, 30);
const mockGame = {
  floor: 1,
  floorDanger: 1,
  player: player,
  items: [],
  monsters: [],
  map: testMap
};

const savedJson = SaveSystem.serialize(mockGame);

const restoredGame = {
  floor: 1,
  floorDanger: 1,
  player: new Player(0, 0),
  items: [],
  monsters: [],
  map: null
};

SaveSystem.deserialize(restoredGame, savedJson);

assert(restoredGame.player.equipment.weapon?.name === '브로드소드', '세이브 복원 후 무기 장착 유지');
assert(restoredGame.player.equipment.shield?.name === '대형 금속 방패', '세이브 복원 후 방패 장착 유지');
assert(restoredGame.player.equipment.armor?.name === '체인 메일', '세이브 복원 후 갑옷 장착 유지');
assert(restoredGame.player.equipment.gloves?.name === '강철 건틀릿', '세이브 복원 후 장갑 장착 유지');
assert(restoredGame.player.equipment.helmet?.name === '주조 강철 투구', '세이브 복원 후 투구 장착 유지');

console.log('\n========================================================');
console.log(`🎉 [SHIELD & GLOVES RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
