/**
 * @file test_inventory_item_detail_view.js
 * @description 인벤토리 아이템 상세 정보 인스펙터(ToME 스펙, 다이스, AC, 스탯칩, 플래그/에고, 로어) 렌더링 검증.
 */

import { renderItemDetailHTML } from '../src/ui/InventoryView.js';
import { createTomeItem } from '../src/entities/ItemRegistry.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';

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
console.log('🧪 [TEST SUITE 1] 전설 유물 [Cammithrim] 상세 정보 인스펙터 렌더링 검증');
console.log('🧪 ========================================================');

const player = new Player(5, 5);
const cammithrim = createTomeItem('ART_CAMMITHRIM');

const unequippedHTML = renderItemDetailHTML(cammithrim, player, false, false, false, false, false);

assert(unequippedHTML.includes('전설 유물 (Artifact)'), '1. 전설 유물 배지 [👑 전설 유물 (Artifact)] 노출 확인');
assert(unequippedHTML.includes('[장갑]'), '2. 슬롯 분류 [장갑] 노출 확인');
assert(unequippedHTML.includes('기본 방어 (AC)'), '3. 방어력 항목 표기 확인');
assert(unequippedHTML.includes('+11'), '4. 방어력 수치 (+11) 정확히 표기 확인');
assert(unequippedHTML.includes('FREE_ACT') || unequippedHTML.includes('마비 면역'), '5. 고유 플래그 [마비 면역] 한글/영문 설명 노출 확인');
assert(unequippedHTML.includes('RES_LITE') || unequippedHTML.includes('빛 저항'), '6. 고유 플래그 [빛 저항] 노출 확인');
assert(unequippedHTML.includes('ToME 전승 서사') || unequippedHTML.includes('Lore'), '7. 원작 배경 서사(Lore) 박스 렌더링 확인');
assert(unequippedHTML.includes('These gloves glow so brightly'), '8. Cammithrim 로어 원문 텍스트 포함 확인');
assert(unequippedHTML.includes('장갑 장착하기'), '9. 미장착 시 [장갑 장착하기] 버튼 렌더링 확인');

// 장착 후 렌더링 검증
player.equipItem(cammithrim);
const equippedHTML = renderItemDetailHTML(cammithrim, player, true, false, false, false, false);
assert(equippedHTML.includes('장착 해제 (장갑)'), '10. 장착 상태 시 [장착 해제 (장갑)] 버튼 렌더링 확인');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] 무기 [롱소드] 공격 다이스 및 스탯 칩 렌더링 검증');
console.log('🧪 ========================================================');

const longsword = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', '에고 롱소드', 0, 'WEAPON', { str: 3, dex: 2 }, '1d8', null, ['FIRE'], ['SLAYER']);
longsword.toHit = 4;
longsword.toDmg = 5;

const swordHTML = renderItemDetailHTML(longsword, player, false, false, false, false, false);

assert(swordHTML.includes('에고 장비 (Ego)'), '1. 에고 장비 배지 노출 확인');
assert(swordHTML.includes('공격 다이스:'), '2. 공격 다이스 라벨 노출 확인');
assert(swordHTML.includes('1d8'), '3. 공격 다이스 수치 (1d8) 확인');
assert(swordHTML.includes('명중 보정:'), '4. 명중 보정 라벨 노출 확인');
assert(swordHTML.includes('+4'), '5. 명중 보정 수치 (+4) 확인');
assert(swordHTML.includes('피해 보정:'), '6. 피해 보정 라벨 노출 확인');
assert(swordHTML.includes('+5'), '7. 피해 보정 수치 (+5) 확인');
assert(swordHTML.includes('힘 (STR) +3'), '8. 스탯 칩 [힘 (STR) +3] 렌더링 확인');
assert(swordHTML.includes('민첩 (DEX) +2'), '9. 스탯 칩 [민첩 (DEX) +2] 렌더링 확인');
assert(swordHTML.includes('근접 무기 장착하기'), '10. [근접 무기 장착하기] 버튼 렌더링 확인');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] 방패 [Thorin] 및 갑옷 [Soft Leather] 렌더링 검증');
console.log('🧪 ========================================================');

const thorin = createTomeItem('ART_OF_THORIN');
const thorinHTML = renderItemDetailHTML(thorin, player, false, false, false, false, false);
assert(thorinHTML.includes('[방패]'), '1. Thorin 방패 [방패] 슬롯 표기 확인');
assert(thorinHTML.includes('방패 장착하기'), '2. [방패 장착하기] 버튼 표기 확인');

const armor = new Item(0, 0, 'ARMOR', '[', '#b45309', 'Soft Leather Armour', 0, 'ARMOR', { con: 1 });
armor.baseAC = 4;
const armorHTML = renderItemDetailHTML(armor, player, false, false, false, false, false);
assert(armorHTML.includes('[갑옷]'), '3. 갑옷 슬롯 [갑옷] 표기 확인');
assert(armorHTML.includes('기본 방어 (AC):'), '4. 기본 방어력 라벨 확인');
assert(armorHTML.includes('+4'), '5. 기본 방어력 (+4) 확인');
assert(armorHTML.includes('생명력 (CON) +1'), '6. [생명력 (CON) +1] 스탯 칩 확인');
assert(armorHTML.includes('갑옷 장착하기'), '7. [갑옷 장착하기] 버튼 확인');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] 모던 몬스터 정수 코어 [레드 드래곤 코어] 상세 인스펙터 렌더링 검증');
console.log('🧪 ========================================================');

const dragonCore = new Item(0, 0, 'CORE', '🧬', '#ef4444', '성숙한 화염 드래곤의 정수 코어', 0, 'CORE', {}, null, null, null, null, 'MON_RED_DRAGON');
dragonCore.flavorText = '화염의 심연에서 뿜어져 나오는 지옥불의 정수가 응축된 붉은 용의 코어입니다.';

const coreHTML = renderItemDetailHTML(dragonCore, player, false, false, false, false, false);

assert(coreHTML.includes('몬스터 정수 코어'), '1. 코어 타입 헤더 [🧬 몬스터 정수 코어] 노출 확인');
assert(coreHTML.includes('성숙한 화염 드래곤의 정수 코어'), '2. 코어 아이템 명칭 렌더링 확인');
assert(coreHTML.includes('개방되는 4대 의태 액티브 스킬'), '3. 4대 의태 액티브 스킬 프리뷰 섹션 헤더 노출 확인');
assert(coreHTML.includes('[1]') && coreHTML.includes('[2]') && coreHTML.includes('[3]') && coreHTML.includes('[4]'), '4. 1~4 슬롯 스킬 번호 뱃지 노출 확인');
assert(coreHTML.includes('다이스:') && coreHTML.includes('쿨다운:'), '5. 스킬 주사위(다이스) 및 쿨다운 메타데이터 확인');
assert(coreHTML.includes('ToME 코어 베이스 6대 스탯'), '6. 6대 베이스 스탯 헤더 렌더링 확인');
assert(coreHTML.includes('힘 (STR)') && coreHTML.includes('민첩 (DEX)') && coreHTML.includes('생명력 (CON)'), '7. 6대 스탯 항목 렌더링 확인');
assert(coreHTML.includes('성장 유형:'), '8. 성장 유형 패턴 배율 렌더링 확인');
assert(coreHTML.includes('ToME 생태 서사 (Lore)'), '9. ToME 생태 서사(Lore) 박스 렌더링 확인');
assert(coreHTML.includes('화염의 심연에서 뿜어져 나오는 지옥불'), '10. 코어 생태 서사 원문 포함 확인');
assert(coreHTML.includes('메인 코어로 의태 시:') && coreHTML.includes('1로 리셋'), '11. 메인 코어 장착 주의사항 및 유산 스탯 보존 비율 렌더링 확인');
assert(coreHTML.includes('swap-main-core-btn') && coreHTML.includes('메인 코어로 의태 장착'), '12. [메인 코어로 의태 장착] 버튼 노출 확인');
assert(coreHTML.includes('eat-core-btn') && coreHTML.includes('코어 포식'), '13. [코어 포식] 버튼 노출 확인');
assert(coreHTML.includes('sub-core1-btn') && coreHTML.includes('보조 1 장착'), '14. [보조 1 장착] 버튼 노출 확인');
assert(coreHTML.includes('sub-core2-btn') && coreHTML.includes('보조 2 장착'), '15. [보조 2 장착] 버튼 노출 확인');
assert(coreHTML.includes('detail-drop-btn') && coreHTML.includes('버리기'), '16. [버리기] 버튼 노출 확인');

// 레거시 버튼 전면 제거 검증
assert(!coreHTML.includes('train-core-btn'), '17. 레거시 [train-core-btn] 완전 제거 확인');
assert(!coreHTML.includes('transfer-core-btn'), '18. 레거시 [transfer-core-btn] 완전 제거 확인');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 5] 보조 코어 장착 상태 및 융합 레벨 뱃지 검증');
console.log('🧪 ========================================================');

const slimeCore = new Item(0, 0, 'CORE', '🧬', '#10b981', '슬라임의 정수 코어', 0, 'CORE', {}, null, null, null, null, 'SLIME');
slimeCore.fusionLevel = 3;

// 보조 1, 보조 2 장착 상태
const equippedCoreHTML = renderItemDetailHTML(slimeCore, player, false, true, true, false, false);
assert(equippedCoreHTML.includes('보조 1 해제'), '1. isSubCore1=true 시 [보조 1 해제] 텍스트 전환 확인');
assert(equippedCoreHTML.includes('보조 2 해제'), '2. isSubCore2=true 시 [보조 2 해제] 텍스트 전환 확인');
assert(equippedCoreHTML.includes('+3 융합'), '3. 융합 레벨 +3 뱃지 [🔮 +3 융합] 렌더링 확인');
assert(!equippedCoreHTML.includes('train-core-btn') && !equippedCoreHTML.includes('transfer-core-btn'), '4. 슬라임 코어에서도 레거시 버튼 완전 부재 확인');

console.log('\n========================================================');
console.log(`🎉 [INSPECTOR DETAIL VIEW RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');

