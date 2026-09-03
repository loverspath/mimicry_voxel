/**
 * @file test_curse_drop_prevention.js
 * @description 착용 중인 저주 장비 버리기 차단, 영구 슬롯 먹통(Ghost Slot Bricking) 결함 방지 및 TomeTagSystem 모듈화 검증
 */

import { strict as assert } from 'assert';
import { TomeTagSystem } from '../src/systems/TomeTagSystem.js';
import { Item } from '../src/entities/Item.js';
import { Player } from '../src/entities/Player.js';
import { Game } from '../src/core/Game.js';
import { renderItemDetailHTML } from '../src/ui/InventoryView.js';

console.log("==================================================");
console.log("🧪 RUNNING: test_curse_drop_prevention.js");
console.log("==================================================");

let passedAssertions = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  passedAssertions++;
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: TomeTagSystem.canDrop SSOT 모듈화 판정 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 1] TomeTagSystem.canDrop 단일 진실 공급원(SSOT) 판정 검증");

const player = new Player(0, 0);

const unequippedCursed = new Item(0, 0, '저주받은 단검', 'WEAPON', '|', '#f00', false, 'WEAPON');
unequippedCursed.isCursed = true;
const res1 = TomeTagSystem.canDrop(unequippedCursed, player);
testAssert(res1.canDrop === true, "미착용 상태의 저주 아이템은 인벤토리에서 자유롭게 버릴 수 있어야 함");

const equippedNormal = new Item(0, 0, '정규 롱소드', 'WEAPON', '|', '#fff', false, 'WEAPON');
player.equipItem(equippedNormal);
const res2 = TomeTagSystem.canDrop(equippedNormal, player);
testAssert(res2.canDrop === true, "장착 중인 정상(비저주) 아이템은 버리기 판정 통과");
player.unequipItem(equippedNormal);

const equippedCursed = new Item(0, 0, '저주받은 파멸검', 'WEAPON', '|', '#f00', false, 'WEAPON');
equippedCursed.isCursed = true;
equippedCursed.curses = ['NORMAL'];
player.equipItem(equippedCursed);
const res3 = TomeTagSystem.canDrop(equippedCursed, player);
testAssert(res3.canDrop === false, "장착 중인 저주 아이템은 canDrop이 false여야 함");
testAssert(res3.reason && res3.reason.includes('저주 해제 주문서'), "canDrop 거부 사유에 저주 해제 주문서 안내가 포함되어야 함");

// -----------------------------------------------------------------------------
// TEST SUITE 2: Player.removeItem 원자성(Atomicity) 보장 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] Player.removeItem 원자성 및 고스트 슬롯 방지 검증");

player.inventory = [equippedCursed];
testAssert(player.equipment.weapon === equippedCursed, "저주받은 파멸검이 장착되어 있음");
testAssert(player.inventory.includes(equippedCursed), "저주받은 파멸검이 인벤토리에 있음");

// 저주받은 장비 removeItem 시도: unequip이 거부되므로 removeItem도 false여야 함
const removeResult = player.removeItem(equippedCursed);
testAssert(removeResult === false, "저주받은 장착 아이템은 removeItem 시 false를 반환해야 함");
testAssert(player.equipment.weapon === equippedCursed, "슬롯에서 저주 아이템이 사라지지 않고 보존되어야 함");
testAssert(player.inventory.includes(equippedCursed), "인벤토리에서도 아이템이 무단 삭제되지 않고 원자적으로 보존되어야 함");

// -----------------------------------------------------------------------------
// TEST SUITE 3: Game.dropItem 실행 차단 및 슬롯 영구 먹통 완치 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] Game.dropItem 롱프레스 버리기 방어 및 후속 장착 무결성 검증");

const logs = [];
const mockGame = {
  player: player,
  selectedItem: equippedCursed,
  addLogEntry: (msg, type) => logs.push({ msg, type }),
  closeContextMenu: () => {},
  renderInventoryList: () => {},
  updateUI: () => {},
  dropItem: Game.prototype.dropItem
};

// 저주받은 파멸검 dropItem 호출
const dropSuccess = mockGame.dropItem(equippedCursed);
testAssert(dropSuccess === false, "Game.dropItem은 저주 장착 장비에 대해 false를 반환해야 함");
testAssert(logs.some(l => l.msg.includes('[Curse]') && l.msg.includes('버릴 수 없습니다')), "저주 버리기 차단 로그 출력 확인");
testAssert(player.equipment.weapon === equippedCursed, "장비 슬롯 무결성 유지 (고스트화 방지)");
testAssert(player.inventory.includes(equippedCursed), "인벤토리 무결성 유지");

// 저주 해제 진행
TomeTagSystem.removeCurse(equippedCursed, false);
testAssert(equippedCursed.isCursed === false, "저주 해제 완료");

// 저주 해제 후 dropItem 재시도: 이제 정상 작동
const dropSuccessAfterPurify = mockGame.dropItem(equippedCursed);
testAssert(dropSuccessAfterPurify === true, "저주 해제 후 Game.dropItem 성공");
testAssert(player.equipment.weapon === null, "장비 슬롯이 정상적으로 비워짐");
testAssert(!player.inventory.includes(equippedCursed), "인벤토리에서 제거됨");

// 새 무기 장착 테스트 (슬롯 먹통 여부 최종 검증)
const newWeapon = new Item(0, 0, '새로운 미스릴 검', 'WEAPON', '|', '#38bdf8', false, 'WEAPON');
player.inventory = [newWeapon];
player.equipItem(newWeapon);
testAssert(player.equipment.weapon === newWeapon, "새로운 무기가 슬롯에 정상 장착되어야 함 (슬롯 먹통 완치 확인)");

// -----------------------------------------------------------------------------
// TEST SUITE 4: InventoryView 상세창 버리기 버튼 비활성화 렌더링 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] InventoryView 상세창 저주 장착 버리기 비활성화 렌더링 검증");

const cursedShield = new Item(0, 0, '저주받은 악마의 방패', 'SHIELD', ')', '#ef4444', false, 'SHIELD');
cursedShield.isCursed = true;
cursedShield.curses = ['NORMAL'];

const detailHtmlEquipped = renderItemDetailHTML(cursedShield, player, true);
testAssert(detailHtmlEquipped.includes('🔒 [ ☠️ 저주 결속 (버리기 불가) ]'), "착용 중인 저주 아이템에 버리기 불가 버튼 렌더링 확인");
testAssert(detailHtmlEquipped.includes('disabled'), "버튼에 disabled 속성 적용 확인");
testAssert(detailHtmlEquipped.includes('cursor: not-allowed'), "버튼에 cursor: not-allowed 스타일 적용 확인");

const detailHtmlUnequipped = renderItemDetailHTML(cursedShield, player, false);
testAssert(!detailHtmlUnequipped.includes('🔒 [ ☠️ 저주 결속 (버리기 불가) ]'), "미착용 상태에서는 버리기 불가 버튼이 아닌 정상 버리기 버튼이어야 함");
testAssert(detailHtmlUnequipped.includes('>버리기</button>'), "미착용 상태에서는 정상 버리기 버튼 노출");

console.log("\n==================================================");
console.log(`🎉 ALL TESTS PASSED! (Total Assertions: ${passedAssertions})`);
console.log("==================================================");
