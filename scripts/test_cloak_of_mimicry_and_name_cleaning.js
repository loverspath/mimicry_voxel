/**
 * @file test_cloak_of_mimicry_and_name_cleaning.js
 * @description 의태의 망토(Cloak of Mimicry, id 618) 파싱 결함 완치 및 Angband 포맷 토큰(&, ~, #) 전수 정제 검증 테스트
 */

import { strict as assert } from 'assert';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { Item } from '../src/entities/Item.js';

console.log("================================================================================");
console.log("🦹 [CLOAK OF MIMICRY & TOKEN CLEANING INTEGRITY VERIFICATION SUITE] 🦹");
console.log("================================================================================\n");

let passed = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  console.log(`  ✅ PASS: ${message}`);
  passed++;
}

// -----------------------------------------------------------------------------
// [TEST 1] id 618 의태의 망토(Cloak of Mimicry) 메타데이터 정합성 검증
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] id 618 의태의 망토(Cloak of Mimicry) 메타데이터 정합성 검증");
{
  const cloakKind = TOME_KINDS_DATA['KIND_CLOAK_OF_MIMICRY'];
  testAssert(cloakKind !== undefined, "TOME_KINDS_DATA에 KIND_CLOAK_OF_MIMICRY 키 존재 확인");
  testAssert(cloakKind.id === 618, "id가 618로 정확히 매핑됨 확인");
  testAssert(cloakKind.name === "Cloak of Mimicry", `아이템 명칭이 'Cloak of Mimicry'로 등록됨 (실제: ${cloakKind.name})`);
  testAssert(cloakKind.type === "CLOAK" && cloakKind.slotType === "CLOAK", "type 및 slotType이 CLOAK으로 정확히 설정됨");
  testAssert(!cloakKind.name.includes('&') && !cloakKind.name.includes('~') && !cloakKind.name.includes('#'), "아이템 명칭에 &, ~, # 기호가 전무함");
  testAssert(cloakKind.flavorText.includes("Combined with proper skill, this cloak can make you seem like a different creature."), "의태 망토 원작 플레이버 텍스트 보존 확인");

  // 기존 깨진 KIND_ 키 영구 박멸 확인
  testAssert(TOME_KINDS_DATA['KIND_'] === undefined, "구 버전 깨진 키 KIND_가 완전히 제거됨");
}

// -----------------------------------------------------------------------------
// [TEST 2] # 템플릿 기호 잔존 아이템(Morphic Oil, Spellbook, Rods) 전수 정제 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] # 템플릿 기호 잔존 아이템(Morphic Oil, Spellbook, Rods) 전수 정제 검증");
{
  const morphicOil = TOME_KINDS_DATA['KIND_MORPHIC_OIL_OF'];
  testAssert(morphicOil && morphicOil.name === "Morphic Oil", `Morphic Oil 명칭 정제 확인 (실제: ${morphicOil.name})`);

  const spellbook = TOME_KINDS_DATA['KIND_SPELLBOOK_OF'];
  testAssert(spellbook && spellbook.name === "Spellbook", `Spellbook 명칭 정제 확인 (실제: ${spellbook.name})`);

  const rodKeys = [
    'KIND_WOODEN_ROD_OF', 'KIND_COPPER_ROD_OF', 'KIND_IRON_ROD_OF',
    'KIND_SILVER_ROD_OF', 'KIND_GOLDEN_ROD_OF', 'KIND_MITHRIL_ROD_OF', 'KIND_ADAMANTITE_ROD_OF'
  ];

  for (const rk of rodKeys) {
    const rod = TOME_KINDS_DATA[rk];
    testAssert(rod !== undefined, `로드 데이터셋 존재 확인: ${rk}`);
    testAssert(!rod.name.includes('#') && !rod.name.includes('&') && !rod.name.includes('~'), `로드 명칭 [${rod.name}]에 토큰 기호 없음`);
  }
}

// -----------------------------------------------------------------------------
// [TEST 3] TomeLootGenerator.cleanItemName 헬퍼 단위 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] TomeLootGenerator.cleanItemName 정적 정제 헬퍼 검증");
{
  testAssert(TomeLootGenerator.cleanItemName('& Short Bow~') === 'Short Bow', "관사와 물결표가 제거된 'Short Bow'");
  testAssert(TomeLootGenerator.cleanItemName('& Cloak~ of Mimicry') === 'Cloak of Mimicry', "중간 물결표가 제거된 'Cloak of Mimicry'");
  testAssert(TomeLootGenerator.cleanItemName('& Pair~ of Hard Leather Boots~') === 'Pair of Hard Leather Boots', "다중 물결표가 모두 제거된 'Pair of Hard Leather Boots'");
  testAssert(TomeLootGenerator.cleanItemName('& Wooden Rod~ of#') === 'Wooden Rod of', "# 및 ~가 제거된 'Wooden Rod of'");
  testAssert(TomeLootGenerator.cleanItemName('& #~') === '', "깨진 & #~ 토큰 완벽 소거");
  testAssert(TomeLootGenerator.cleanItemName(null) === 'Item', "null 입력 시 안전한 폴백 'Item'");
}

// -----------------------------------------------------------------------------
// [TEST 4] Item.js displayName 방어적 정제 안전망 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] Item.js displayName 방어적 정제 안전망 검증");
{
  const dirtyItem1 = new Item(0, 0, 'CLOAK', '(', '#eab308', '& #~', 0, 'CLOAK');
  testAssert(dirtyItem1.name === '', `오염된 '& #~' 생성 시 name이 공백으로 정제됨 (실제: '${dirtyItem1.name}')`);
  testAssert(!dirtyItem1.displayName.includes('&') && !dirtyItem1.displayName.includes('#') && !dirtyItem1.displayName.includes('~'), "dirtyItem1 displayName에 토큰 미포함");

  const dirtyItem2 = new Item(0, 0, 'BOW', '}', '#d97706', '& Short Bow~', 0, 'BOW');
  testAssert(dirtyItem2.displayName.includes('Short Bow'), `dirtyItem2 displayName이 'Short Bow' 포함 (실제: '${dirtyItem2.displayName}')`);
  testAssert(!dirtyItem2.displayName.includes('&') && !dirtyItem2.displayName.includes('~'), "dirtyItem2 displayName에 & 및 ~ 미포함");

  const dirtyItem3 = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', '& Broad Sword~', 0, 'WEAPON', {}, '2d5', null, ['FIRE'], [], []);
  dirtyItem3.idState = 'IDENTIFIED';
  testAssert(!dirtyItem3.displayName.includes('&') && !dirtyItem3.displayName.includes('~'), `에고 접사 결합 후에도 & 및 ~ 미포함 (실제: '${dirtyItem3.displayName}')`);
}

// -----------------------------------------------------------------------------
// [TEST 5] 1,000회 무작위 아이템 생성 시 &, ~, # 토큰 잔존 0건 몬테카를로 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] 1,000회 무작위 아이템 생성 시 &, ~, # 토큰 잔존 0건 몬테카를로 검증");
{
  let totalSampled = 1000;
  let tokenLeaks = 0;
  let cloakOfMimicryCount = 0;

  for (let i = 0; i < totalSampled; i++) {
    const floor = (i % 50) + 1;
    const item = TomeLootGenerator.generateFloorItem(0, 0, floor, i % 5 === 0);
    if (!item) continue;

    const name = item.name || '';
    const displayName = item.displayName || '';

    if (name.includes('&') || name.includes('~') || name.includes('#') ||
        displayName.includes('&') || displayName.includes('~') || displayName.includes('#')) {
      tokenLeaks++;
      console.error(`    ❌ 토큰 유출 감지: [name: "${name}" | displayName: "${displayName}"]`);
    }

    if (name.includes('Cloak of Mimicry')) {
      cloakOfMimicryCount++;
    }
  }

  testAssert(tokenLeaks === 0, `1,000회 아이템 생성 중 &, ~, # 토큰 유출 0건 (실제 누출: ${tokenLeaks}건)`);
  console.log(`    ℹ️ 시뮬레이션 중 의태의 망토(Cloak of Mimicry) 정상 스폰 횟수: ${cloakOfMimicryCount}회`);
}

console.log("\n================================================================================");
console.log(`🎉 ALL TESTS PASSED! (${passed}/${passed} assertions succeeded)`);
console.log("================================================================================\n");
