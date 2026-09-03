/**
 * @file test_ammo_and_quiver_classification.js
 * @description 라운드 페블 및 탄약류(Ammo) 시스템 전면 정비 및 슬롯 분류/심볼/장착 정합성 검증 테스트
 */

import { strict as assert } from 'assert';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { renderItemDetailHTML } from '../src/ui/InventoryView.js';

console.log("================================================================================");
console.log("🏹 [AMMO & QUIVER CLASSIFICATION AND INTEGRITY VERIFICATION SUITE] 🏹");
console.log("================================================================================\n");

let passed = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  console.log(`  ✅ PASS: ${message}`);
  passed++;
}

// -----------------------------------------------------------------------------
// [TEST 1] 탄약류 10종 TOME_KINDS_DATA 메타데이터 전수 규격 검증
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] 탄약류 10종 TOME_KINDS_DATA 메타데이터 전수 규격 검증");
const ammoKindKeys = [
  'KIND_ROUNDED_PEBBLE', // id: 82, tval: 16
  'KIND_IRON_SHOT',      // id: 83, tval: 16
  'KIND_MITHRIL_SHOT',   // id: 196, tval: 16
  'KIND_ARROW',          // id: 78, tval: 17
  'KIND_SHEAF_ARROW',    // id: 195, tval: 17
  'KIND_SEEKER_ARROW',   // id: 79, tval: 17
  'KIND_SILVER_ARROW',   // id: 465, tval: 17
  'KIND_BOLT',           // id: 80, tval: 18
  'KIND_SEEKER_BOLT',    // id: 81, tval: 18
  'KIND_SILVER_BOLT'     // id: 466, tval: 18
];

for (const key of ammoKindKeys) {
  const kind = TOME_KINDS_DATA[key];
  testAssert(kind !== undefined, `탄약 데이터 존재 확인: ${key}`);
  testAssert(kind.type === 'AMMO', `[${key}] type === 'AMMO' 확인 (실제: ${kind.type})`);
  testAssert(kind.slotType === 'QUIVER', `[${key}] slotType === 'QUIVER' 확인 (실제: ${kind.slotType})`);
  testAssert(kind.char === '{', `[${key}] char === '{' (정통 탄약 심볼) 확인 (실제: ${kind.char})`);
  testAssert(kind.tval === 16 || kind.tval === 17 || kind.tval === 18, `[${key}] tval이 16/17/18 중 하나임 (실제: ${kind.tval})`);
}

// -----------------------------------------------------------------------------
// [TEST 2] 발사기(Launcher, TVAL 19) 메타데이터 규격 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] 원거리 발사기(Launcher) 메타데이터 규격 검증");
const launcherKeys = [
  'KIND_SLING',
  'KIND_SHORT_BOW',
  'KIND_LONG_BOW',
  'KIND_LIGHT_CROSSBOW',
  'KIND_HEAVY_CROSSBOW'
];

for (const key of launcherKeys) {
  const launcher = TOME_KINDS_DATA[key];
  testAssert(launcher !== undefined, `발사기 데이터 존재 확인: ${key}`);
  testAssert(launcher.type === 'BOW', `[${key}] type === 'BOW' 확인`);
  testAssert(launcher.slotType === 'BOW', `[${key}] slotType === 'BOW' 확인`);
  testAssert(launcher.char === '}', `[${key}] char === '}' (정통 발사기 심볼) 확인`);
  testAssert(launcher.tval === 19, `[${key}] tval === 19 확인`);
}

// -----------------------------------------------------------------------------
// [TEST 3] TomeLootGenerator 탄약 생성 및 다발 번들링(15~35) 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] TomeLootGenerator 탄약 생성 및 다발 번들링(15~35) 검증");
{
  const pebbleKind = TOME_KINDS_DATA['KIND_ROUNDED_PEBBLE'];
  const pebbleItem = new Item(0, 0, pebbleKind.type, pebbleKind.char, pebbleKind.color, pebbleKind.name, 0, pebbleKind.slotType);
  pebbleItem.tval = pebbleKind.tval;
  pebbleItem.sval = pebbleKind.sval;

  testAssert(pebbleItem.slotType === 'QUIVER', "Pebble Item 인스턴스 slotType === 'QUIVER'");
  testAssert(pebbleItem.char === '{', "Pebble Item 인스턴스 char === '{'");

  // 다발 번들링 확인
  let totalAmmoGenerated = 0;
  for (let i = 0; i < 300; i++) {
    const item = TomeLootGenerator.generateFloorItem(0, 0, (i % 20) + 1);
    if (!item) continue;
    if (item.tval === 16 || item.tval === 17 || item.tval === 18 || item.slotType === 'QUIVER') {
      totalAmmoGenerated++;
      testAssert(item.slotType === 'QUIVER', `드랍 탄약 [${item.name}] slotType === 'QUIVER'`);
      testAssert(item.char === '{', `드랍 탄약 [${item.name}] char === '{'`);
      testAssert(item.count >= 15 && item.count <= 35, `드랍 탄약 [${item.name}] 수량(${item.count})이 15~35발 다발 규격 준수`);
      if (totalAmmoGenerated >= 5) break; // 5회 샘플링으로 충분
    }
  }
  testAssert(totalAmmoGenerated >= 5, `몬테카를로 드랍 생성 중 5개 이상의 탄약 검증 완료 (총 ${totalAmmoGenerated}개 샘플링)`);
}

// -----------------------------------------------------------------------------
// [TEST 4] Player.equipItem / unequipItem 슬롯 장착 판정 및 공존 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] Player.equipItem / unequipItem 슬롯 장착 판정 및 공존 검증");
{
  const player = new Player(0, 0, 'MON_NOVICE_WARRIOR');
  player.equipment.bow = null;
  player.equipment.quiver = null;

  const pebble = new Item(0, 0, 'AMMO', '{', '#94a3b8', 'Rounded Pebble', 0, 'QUIVER');
  pebble.tval = 16;
  pebble.count = 25;

  const sling = new Item(0, 0, 'BOW', '}', '#cbd5e1', 'Sling', 0, 'BOW');
  sling.tval = 19;
  sling.multiplier = 2;

  const arrow = new Item(0, 0, 'AMMO', '{', '#d97706', 'Arrow', 0, 'QUIVER');
  arrow.tval = 17;
  arrow.count = 30;

  const bow = new Item(0, 0, 'BOW', '}', '#b45309', 'Long Bow', 0, 'BOW');
  bow.tval = 19;
  bow.multiplier = 3;

  // 1) 페블 장착 시 quiver에 장착되고 bow는 비어있어야 함
  player.equipItem(pebble);
  testAssert(player.equipment.quiver === pebble, "라운드 페블 장착 시 equipment.quiver에 성공적으로 배정");
  testAssert(player.equipment.bow === null, "라운드 페블 장착 시 equipment.bow는 빈 상태 유지 (오장착 방지)");

  // 2) 슬링 장착 시 bow에 장착되고 quiver의 페블과 완벽히 공존해야 함
  player.equipItem(sling);
  testAssert(player.equipment.bow === sling, "슬링 장착 시 equipment.bow에 성공적으로 배정");
  testAssert(player.equipment.quiver === pebble, "슬링과 라운드 페블이 각자의 슬롯(bow, quiver)에 동시 공존");

  // 3) 화살 장착 시 페블이 화살로 교체되고 슬링은 유지됨
  player.equipItem(arrow);
  testAssert(player.equipment.quiver === arrow, "화살 장착 시 equipment.quiver에 배정 (페블 대체)");
  testAssert(player.equipment.bow === sling, "화살 장착 후에도 기존 슬링 장착 상태 불변");

  // 4) 롱보우 장착 시 슬링이 롱보우로 교체되고 화살은 유지됨
  player.equipItem(bow);
  testAssert(player.equipment.bow === bow, "롱보우 장착 시 equipment.bow에 배정 (슬링 대체)");
  testAssert(player.equipment.quiver === arrow, "롱보우 장착 후에도 기존 화살 장착 상태 불변");

  // 5) 해제 테스트
  player.unequipItem(player.equipment.quiver);
  testAssert(player.equipment.quiver === null, "quiver 해제 시 화살통만 비워짐");
  testAssert(player.equipment.bow === bow, "quiver 해제 후에도 bow는 유지됨");

  player.unequipItem(player.equipment.bow);
  testAssert(player.equipment.bow === null, "bow 해제 시 활 슬롯만 비워짐");
}

// -----------------------------------------------------------------------------
// [TEST 5] InventoryView UI 슬롯 명칭 및 호환 탄약/발사기 안내 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] InventoryView UI 슬롯 명칭 및 호환 탄약/발사기 안내 검증");
{
  const player = new Player(0, 0, 'MON_NOVICE_WARRIOR');

  const pebble = new Item(0, 0, 'AMMO', '{', '#94a3b8', 'Rounded Pebble', 0, 'QUIVER');
  pebble.tval = 16;
  pebble.count = 20;

  const arrow = new Item(0, 0, 'AMMO', '{', '#d97706', 'Sheaf Arrow', 0, 'QUIVER');
  arrow.tval = 17;
  arrow.count = 35;

  const bolt = new Item(0, 0, 'AMMO', '{', '#38bdf8', 'Seeker Bolt', 0, 'QUIVER');
  bolt.tval = 18;
  bolt.count = 22;

  const sling = new Item(0, 0, 'BOW', '}', '#cbd5e1', 'Sling', 0, 'BOW');
  sling.tval = 19;
  sling.multiplier = 2;

  // 페블 상세 모달 HTML 검증
  const pebbleHTML = renderItemDetailHTML(pebble, player, false);
  testAssert(pebbleHTML.includes('화살통 (탄약)'), "페블 모달에 '화살통 (탄약)' 슬롯명 출력 확인");
  testAssert(pebbleHTML.includes('슬링 전용 탄약 (Sling Shot)'), "페블 모달에 '슬링 전용 탄약 (Sling Shot)' 안내 확인");
  testAssert(pebbleHTML.includes('20발 다발'), "페블 모달에 '20발 다발' 보유 수량 확인");

  // 화살 상세 모달 HTML 검증
  const arrowHTML = renderItemDetailHTML(arrow, player, false);
  testAssert(arrowHTML.includes('활 전용 화살 (Bow Arrow)'), "화살 모달에 '활 전용 화살 (Bow Arrow)' 안내 확인");
  testAssert(arrowHTML.includes('35발 다발'), "화살 모달에 '35발 다발' 보유 수량 확인");

  // 볼트 상세 모달 HTML 검증
  const boltHTML = renderItemDetailHTML(bolt, player, false);
  testAssert(boltHTML.includes('석궁 전용 볼트 (Crossbow Bolt)'), "볼트 모달에 '석궁 전용 볼트 (Crossbow Bolt)' 안내 확인");

  // 슬링 발사기 상세 모달 HTML 검증
  const slingHTML = renderItemDetailHTML(sling, player, false);
  testAssert(slingHTML.includes('원거리 무기 (활/슬링/석궁)'), "슬링 모달에 '원거리 무기 (활/슬링/석궁)' 슬롯명 출력 확인");
  testAssert(slingHTML.includes('호환 탄약:</span> <b style="color: #fbbf24;">슬링 탄약 (Pebbles, Shots, tval: 16)</b>'), "슬링 모달에 슬링 탄약 호환 안내 출력 확인");
  testAssert(slingHTML.includes('사격 배율:</span> <b style="color: #34d399;">x2</b>'), "슬링 모달에 사격 배율 x2 출력 확인");
}

console.log("\n================================================================================");
console.log(`🎉 ALL TESTS PASSED! (${passed}/${passed} assertions succeeded)`);
console.log("================================================================================\n");
