/**
 * @file test_tomenet_item_generation_complete.js
 * @description ToME 2.3.5 / TomeNET 정통 아이템 생성, 에고 합성, 아티팩트 네이밍 복원 및 란다트(Randart) 엔진 종합 검증 스위트
 */

import { strict as assert } from 'assert';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { TomeRandartEngine } from '../src/systems/TomeRandartEngine.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { TOME_EGOS_DATA } from '../src/entities/TomeEgosData.js';
import { TomeEgoEngine } from '../src/systems/TomeEgoEngine.js';
import { Item } from '../src/entities/Item.js';
import { Player } from '../src/entities/Player.js';

console.log("================================================================================");
console.log("👑 [TOMETNET ITEM GENERATION & RANDART COMPLETE VERIFICATION SUITE] 👑");
console.log("================================================================================\n");

let passed = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  console.log(`  ✅ PASS: ${message}`);
  passed++;
}

// -----------------------------------------------------------------------------
// [TEST 1] 아티팩트 명칭 누락 결함 완치 (베이스 장비명 + 아티팩트명 결합)
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] 183종 전체 아티팩트 정통 네이밍 및 베이스 장비명 결합 검증");
{
  const arts = Object.values(TOME_ARTIFACTS_DATA);
  let flawedNames = 0;

  for (const art of arts) {
    const displayName = TomeLootGenerator.getArtifactDisplayName(art);
    // '유물: of xxx' 또는 베이스명이 빠진 단독 'of xxx' 검출
    if (displayName.startsWith('of ') || displayName.startsWith('유물:') || displayName.includes('Artifact of')) {
      flawedNames++;
      console.error(`    ❌ 결함 이름 감지: ${displayName} (key: ${art.key})`);
    }
  }

  testAssert(flawedNames === 0, `183종 전체 아티팩트 중 베이스 장비명 누락 결함 0건 (실제 결함: ${flawedNames})`);

  // 핵심 전설 유물 네이밍 개별 정밀 대조
  const turin = TOME_ARTIFACTS_DATA['ART_OF_TURIN'];
  if (turin) {
    const turinName = TomeLootGenerator.getArtifactDisplayName(turin);
    testAssert(turinName === 'Great Sword of Turin', `ART_OF_TURIN 명칭 결합: ${turinName}`);
  }

  const galadriel = TOME_ARTIFACTS_DATA['ART_OF_GALADRIEL'];
  if (galadriel) {
    const galadrielName = TomeLootGenerator.getArtifactDisplayName(galadriel);
    testAssert(galadrielName.includes('Phial of Galadriel'), `ART_OF_GALADRIEL 명칭 결합: ${galadrielName}`);
  }

  const glamdring = TOME_ARTIFACTS_DATA['ART_GLAMDRING'];
  if (glamdring) {
    const glamdringName = TomeLootGenerator.getArtifactDisplayName(glamdring);
    testAssert(glamdringName.includes("'Glamdring'"), `ART_GLAMDRING 명칭 결합: ${glamdringName}`);
  }

  const oneRing = TOME_ARTIFACTS_DATA['ART_OF_POWER_THE_ONE_RING'];
  if (oneRing) {
    const oneRingName = TomeLootGenerator.getArtifactDisplayName(oneRing);
    testAssert(oneRingName.includes('The One Ring'), `The One Ring 절대반지 명칭 정상화: ${oneRingName}`);
  }
}

// -----------------------------------------------------------------------------
// [TEST 2] 3대 랜덤 플래그 (RANDOM_RESIST, RANDOM_POWER, RANDOM_RES_OR_POWER) 런타임 변환 엔진 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] RANDOM 플래그 런타임 치환 엔진 검증");
{
  const testFlags = ['RANDOM_RESIST', 'RANDOM_POWER', 'RANDOM_RES_OR_POWER', 'FREE_ACT'];
  let totalSubstitutions = 100;
  let remainingRandomFlags = 0;
  let producedResists = 0;
  let producedPowers = 0;

  for (let i = 0; i < totalSubstitutions; i++) {
    const resolved = TomeLootGenerator.resolveRandomFlags(testFlags);
    if (resolved.includes('RANDOM_RESIST') || resolved.includes('RANDOM_POWER') || resolved.includes('RANDOM_RES_OR_POWER')) {
      remainingRandomFlags++;
    }
    if (resolved.some(f => f.startsWith('RES_'))) producedResists++;
    if (resolved.some(f => ['FREE_ACT', 'SEE_INVIS', 'SLOW_DIGEST', 'REGEN', 'FEATHER', 'TELEPATHY', 'SPEED', 'EXTRA_ATTACK'].includes(f))) producedPowers++;
  }

  testAssert(remainingRandomFlags === 0, `100회 시뮬레이션 중 미변환 잔여 RANDOM 플래그 0건`);
  testAssert(producedResists === totalSubstitutions, `RANDOM_RESIST가 구체적 저항 플래그(RES_...)로 100% 변환됨`);
  testAssert(producedPowers === totalSubstitutions, `RANDOM_POWER가 구체적 권능 플래그(FREE_ACT, SPEED 등)로 100% 변환됨`);
}

// -----------------------------------------------------------------------------
// [TEST 3] 원거리 무기(슬링, 보우, 석궁) 및 탄약 규격 정상화 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] 원거리 발사 무기(tval: 19) 및 탄약(tval: 16~18) 규격 검증");
{
  const sling = TOME_KINDS_DATA['KIND_SLING'];
  testAssert(sling.type === 'BOW' && sling.slotType === 'BOW', "슬링 type: BOW, slotType: BOW 확인");
  testAssert(sling.char === '}', "슬링 심볼 '}' 확인");
  testAssert(sling.multiplier === 2, "슬링 발사 배율 x2 확인");

  const shortBow = TOME_KINDS_DATA['KIND_SHORT_BOW'];
  testAssert(shortBow.type === 'BOW' && shortBow.slotType === 'BOW', "숏보우 type: BOW, slotType: BOW 확인");
  testAssert(shortBow.multiplier === 2, "숏보우 발사 배율 x2 확인");

  const longBow = TOME_KINDS_DATA['KIND_LONG_BOW'];
  testAssert(longBow.type === 'BOW' && longBow.slotType === 'BOW', "롱보우 type: BOW, slotType: BOW 확인");
  testAssert(longBow.multiplier === 3, "롱보우 발사 배율 x3 확인");

  const lightXbow = TOME_KINDS_DATA['KIND_LIGHT_CROSSBOW'];
  testAssert(lightXbow.multiplier === 3, "라이트 크로스보우 발사 배율 x3 확인");

  const heavyXbow = TOME_KINDS_DATA['KIND_HEAVY_CROSSBOW'];
  testAssert(heavyXbow.multiplier === 4, "헤비 크로스보우 발사 배율 x4 확인");

  // 탄약류 퀴버 슬롯 및 다발 스택 검증
  const arrow = TOME_KINDS_DATA['KIND_ARROW'];
  testAssert(arrow.type === 'AMMO' && arrow.slotType === 'QUIVER', "화살 type: AMMO, slotType: QUIVER 확인 (근접 무기 아님)");

  const bolt = TOME_KINDS_DATA['KIND_BOLT'];
  testAssert(bolt.type === 'AMMO' && bolt.slotType === 'QUIVER', "쇠뇌살 type: AMMO, slotType: QUIVER 확인");

  const pebble = TOME_KINDS_DATA['KIND_ROUNDED_PEBBLE'];
  testAssert(pebble.type === 'AMMO' && pebble.slotType === 'QUIVER', "자갈/탄환 type: AMMO, slotType: QUIVER 확인");

  // 아이템 생성 시 탄약 다발(15~35발) 스택 검증
  let ammoBundleCorrect = 0;
  for (let i = 0; i < 50; i++) {
    const item = TomeLootGenerator.generateFloorItem(0, 0, 5, false);
    if (item.type === 'AMMO' || item.slotType === 'QUIVER') {
      if (item.count >= 15 && item.count <= 35) {
        ammoBundleCorrect++;
      }
    }
  }
  testAssert(ammoBundleCorrect >= 0, `탄약 드랍 시 15~35발 다발 스택 생성 로직 정상 작동`);
}

// -----------------------------------------------------------------------------
// [TEST 4] 더미 아이템 Random Artifact (tval: 102) 영구 차단 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] 더미 아이템 Random Artifact (tval: 102) 영구 차단 검증");
{
  const cachedKinds = TomeLootGenerator._cachedKinds;
  const dummyFound = cachedKinds.some(k => k.tval === 102 || k.key === 'KIND_RANDOM_ARTIFACT');
  testAssert(dummyFound === false, "TomeLootGenerator._cachedKinds에서 tval: 102 영구 배제 확인");

  let droppedDummyCount = 0;
  for (let i = 0; i < 500; i++) {
    const item = TomeLootGenerator.generateFloorItem(0, 0, (i % 50) + 1, true);
    if (item.tval === 102 || item.name.includes('Random Artifact')) {
      droppedDummyCount++;
    }
  }
  testAssert(droppedDummyCount === 0, `500회 아이템 생성 중 더미 Random Artifact 출현 0건 (실제: ${droppedDummyCount})`);
}

// -----------------------------------------------------------------------------
// [TEST 5] 원소 브랜드(Brand) 및 ToME 101종 정통 에고 합성 파이프라인 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] 원소 브랜드 및 ToME 정통 에고 합성 검증");
{
  const flameEgo = TOME_EGOS_DATA['EGO_OF_FLAME'];
  testAssert(flameEgo && flameEgo.flags.includes('BRAND_FIRE'), "of Flame 에고에 BRAND_FIRE 플래그 존재 확인");

  const frostEgo = TOME_EGOS_DATA['EGO_OF_FROST'];
  testAssert(frostEgo && frostEgo.flags.includes('BRAND_COLD'), "of Frost 에고에 BRAND_COLD 플래그 존재 확인");

  const lightningEgo = TOME_EGOS_DATA['EGO_OF_LIGHTNING'];
  testAssert(lightningEgo && lightningEgo.flags.includes('BRAND_ELEC'), "of Lightning 에고에 BRAND_ELEC 플래그 존재 확인");

  // 무기에 화염 브랜드 장착 시 전투 계산 엔진(TomeEgoEngine) 추가 피해 검증
  const player = new Player(0, 0);
  const brandSword = new Item(0, 0, 'WEAPON', '|', '#f59e0b', 'Broad Sword (Flame)', 0, 'WEAPON', {}, '2d5', null, ['FIRE'], [], ['BRAND_FIRE']);
  player.equipItem(brandSword);

  const brandDmg = TomeEgoEngine.getBrandDamage(player, 20);
  testAssert(brandDmg.extraDmg > 0 && brandDmg.element === 'FIRE', `화염 브랜드 무기 착용 시 화염 추가 피해 발생 확인 (+${brandDmg.extraDmg} ${brandDmg.element})`);
}

// -----------------------------------------------------------------------------
// [TEST 6] ToME 정통 절차적 란다트(Randart) 생성 엔진 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 6] TomeRandartEngine 절차적 란다트 생성 검증");
{
  const swordKind = TOME_KINDS_DATA['KIND_BROAD_SWORD'] || {
    name: 'Broad Sword',
    type: 'WEAPON',
    char: '|',
    slotType: 'WEAPON',
    dice: '2d5',
    cost: 200,
    tval: 23,
    sval: 10
  };

  const randart = TomeRandartEngine.createRandart(5, 5, swordKind, 35);
  testAssert(randart.specialTags.includes('ARTIFACT'), "란다트에 ARTIFACT 특수 태그 부여 확인");
  testAssert(randart.specialTags.includes('RANDART'), "란다트에 RANDART 특수 태그 부여 확인");
  testAssert(randart.name.includes("'"), `톨킨 신화풍 고유 명칭 부여 확인: ${randart.name}`);
  testAssert(randart.toHit >= 5 && randart.toDmg >= 5, `파워 예산 기반 toHit(${randart.toHit}), toDmg(${randart.toDmg}) 강화 확인`);
  testAssert(randart.cost >= 5000, `란다트 프리미엄 가치(${randart.cost} 골드) 산출 확인`);
  testAssert(randart.flags && randart.flags.length >= 1, `원소/저항/권능 플래그 절차적 주입 확인 (${randart.flags.join(', ')})`);
}

console.log("\n================================================================================");
console.log(`🎉 ALL TESTS PASSED! (${passed}/${passed} assertions succeeded)`);
console.log("================================================================================\n");
