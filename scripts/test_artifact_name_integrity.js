/**
 * @file test_artifact_name_integrity.js
 * @description 전설 유물(Artifact) '학살자(SLAYER)' 강제 부착 방지 및 ToME 순수 유물 명칭 보존 단위 테스트
 */

import { Item } from '../src/entities/Item.js';
import { createTomeItem, TOME_ARTIFACTS } from '../src/entities/ItemRegistry.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';
import { UniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { BossPhaseEngine } from '../src/systems/BossPhaseEngine.js';
import { TomeFlagResolver } from '../src/systems/TomeFlagResolver.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================================');
console.log('🧪 전설 유물(Artifact) 고유 명칭 무결성 및 순수 ToME 플래그 검증 테스트');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// [TEST SUITE 1] ItemRegistry.createTomeItem 유물 생성 검증
// -----------------------------------------------------------------------------
console.log('🧪 [TEST SUITE 1] ItemRegistry.createTomeItem 유물 생성 및 접사 제거 검증');

const ringil = createTomeItem('ART_RINGIL');
assert(ringil !== null, "createTomeItem('ART_RINGIL') 정상 생성");
assert(ringil.artifactKey === 'ART_RINGIL', "Ringil artifactKey='ART_RINGIL' 설정 확인");
assert(ringil.prefixes.length === 0, "Ringil prefixes 빈 배열 확인");
assert(ringil.suffixes.length === 0, "Ringil suffixes 빈 배열 확인 (SLAYER 제거)");
assert(!ringil.displayName.includes('학살자'), "Ringil displayName에 '학살자' 미포함 확인");
assert(!ringil.displayName.includes('SLAYER'), "Ringil displayName에 'SLAYER' 미포함 확인");
assert(ringil.displayName === ringil._baseName, `Ringil displayName이 고유 명칭('${ringil._baseName}')과 일치`);

const galadriel = createTomeItem('ART_OF_GALADRIEL');
assert(galadriel !== null, "createTomeItem('ART_OF_GALADRIEL') 정상 생성");
assert(!galadriel.displayName.includes('학살자'), "Phial of Galadriel displayName에 '학살자' 미포함 확인");
assert(galadriel.prefixes.length === 0 && galadriel.suffixes.length === 0, "Galadriel 접사 배열 공백 확인");

// -----------------------------------------------------------------------------
// [TEST SUITE 2] UniqueMonsterManager 유니크 드랍 유물 무결성 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 2] UniqueMonsterManager 유니크 드랍 유물 접사 제거 및 명칭 보존 검증');

const uniqueManager = new UniqueMonsterManager();
const mockUniqueMonster = {
  key: 'MON_FARMER_MAGGOT',
  displayName: 'Farmer Maggot',
  x: 10,
  y: 10
};

const uniqueDrops = uniqueManager.generateUniqueMonsterDrops(mockUniqueMonster, 10);
assert(Array.isArray(uniqueDrops) && uniqueDrops.length >= 2, "유니크 몬스터 드랍 아이템 2개 이상 생성 확인");

const artDrop = uniqueDrops.find(it => it.specialTags && it.specialTags.includes('ARTIFACT'));
if (artDrop) {
  assert(artDrop.prefixes.length === 0, `드랍 유물 [${artDrop.name}] prefixes 빈 배열 확인`);
  assert(artDrop.suffixes.length === 0, `드랍 유물 [${artDrop.name}] suffixes 빈 배열 확인`);
  assert(!artDrop.displayName.includes('학살자'), `드랍 유물 [${artDrop.displayName}]에 '학살자' 접미사 부착 없음`);
  assert(!artDrop.displayName.includes('SLAYER'), `드랍 유물 [${artDrop.displayName}]에 'SLAYER' 부착 없음`);
  assert(!artDrop.displayName.includes('철벽'), `드랍 유물 [${artDrop.displayName}]에 '철벽' 접미사 부착 없음`);
  assert(artDrop.artifactKey !== undefined, `드랍 유물 artifactKey(${artDrop.artifactKey}) 존재 확인`);
} else {
  assert(false, "유니크 드랍에 ARTIFACT 아이템이 존재해야 함");
}

// -----------------------------------------------------------------------------
// [TEST SUITE 3] BossPhaseEngine 모르고스 & Grond & Iron Crown 드랍 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 3] BossPhaseEngine 최종 보스 유물/코어 드랍 명칭 정규화 검증');

const bossEngine = new BossPhaseEngine();
const mockBoss = { x: 25, y: 25, displayName: 'Morgoth, Lord of Darkness' };

const grond = bossEngine.createGrond(mockBoss);
assert(grond !== null, "createGrond 정상 생성");
assert(grond.artifactKey === 'ART_GROND', "Grond artifactKey='ART_GROND' 설정 확인");
assert(grond.prefixes.length === 0, "Grond prefixes 빈 배열 확인");
assert(grond.suffixes.length === 0, "Grond suffixes 빈 배열 확인 (SLAYER/PULVERIZE 제거)");
assert(!grond.displayName.includes('학살자'), "Grond displayName에 '학살자' 미포함 확인");
assert(!grond.displayName.includes('SLAYER'), "Grond displayName에 'SLAYER' 미포함 확인");
assert(grond.displayName.includes("Grond"), "Grond 고유 명칭 보존 확인");

const ironCrown = bossEngine.createIronCrown(mockBoss);
assert(ironCrown !== null, "createIronCrown 정상 생성");
assert(ironCrown.artifactKey === 'ART_OF_MORGOTH', "Iron Crown artifactKey='ART_OF_MORGOTH' 설정 확인");
assert(ironCrown.prefixes.length === 0, "Iron Crown prefixes 빈 배열 확인");
assert(ironCrown.suffixes.length === 0, "Iron Crown suffixes 빈 배열 확인 (AEGIS/PROTECTION 제거)");
assert(!ironCrown.displayName.includes('학살자'), "Iron Crown displayName에 '학살자' 미포함 확인");
assert(!ironCrown.displayName.includes('철벽'), "Iron Crown displayName에 '철벽' 미포함 확인");
assert(ironCrown.displayName.includes("Morgoth"), "Iron Crown 고유 명칭(Morgoth) 보존 확인");

const morgothCore = bossEngine.createMorgothCore(mockBoss);
assert(morgothCore !== null, "createMorgothCore 정상 생성");
assert(morgothCore.prefixes.length === 0, "MorgothCore prefixes 빈 배열 확인");
assert(morgothCore.suffixes.length === 0, "MorgothCore suffixes 빈 배열 확인");
assert(morgothCore.displayName === "모르고스의 의태 코어", `MorgothCore 순수 명칭 확인 (실제: ${morgothCore.displayName})`);

// -----------------------------------------------------------------------------
// [TEST SUITE 4] TomeLootGenerator 절차적 유물 생성 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 4] TomeLootGenerator 유물 생성 및 에고 접사 분리 검증');

let generatedArtifactCount = 0;
for (let i = 0; i < 500; i++) {
  const item = TomeLootGenerator.generateFloorItem(0, 0, 50, true);
  if (item && item.specialTags && item.specialTags.includes('ARTIFACT')) {
    generatedArtifactCount++;
    assert(item.prefixes.length === 0, `TomeLootGenerator 유물 [${item.name}] prefixes=[] 검증`);
    assert(item.suffixes.length === 0, `TomeLootGenerator 유물 [${item.name}] suffixes=[] 검증`);
    assert(!item.displayName.includes('학살자'), `TomeLootGenerator 유물 [${item.displayName}] '학살자' 부착 없음`);
    assert(!item.displayName.includes('SLAYER'), `TomeLootGenerator 유물 [${item.displayName}] 'SLAYER' 부착 없음`);
    assert(item.artifactKey !== undefined, `TomeLootGenerator 유물 artifactKey(${item.artifactKey}) 존재`);
    if (generatedArtifactCount >= 5) break;
  }
}
assert(generatedArtifactCount > 0, `TomeLootGenerator에서 유물이 ${generatedArtifactCount}개 생성됨`);

// -----------------------------------------------------------------------------
// [TEST SUITE 5] Item.js 방어적 displayName 정규화 검증 (강제 접사 주입 시에도 원형 보존)
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 5] Item.js 방어적 displayName 정규화 검증');

const forcedArtifact = new Item(
  0, 0, 'WEAPON', '|', '#ffd700', '전설의 성검 아란루스',
  0, 'WEAPON', { str: 5 }, '3d8', null,
  ['FIRE', 'HOLY'], // 강제로 주입된 접두사
  ['SLAYER', 'AEGIS'], // 강제로 주입된 접미사
  ['ARTIFACT'],
  '테스트용 유물입니다.'
);

assert(forcedArtifact.displayName === '전설의 성검 아란루스', `specialTags에 ARTIFACT 존재 시 접사 무시하고 원본 이름 반환 (실제: ${forcedArtifact.displayName})`);
assert(forcedArtifact.name === '전설의 성검 아란루스', `name getter에서도 원본 이름 반환 (실제: ${forcedArtifact.name})`);

forcedArtifact.upgradeLevel = 3;
assert(forcedArtifact.displayName === '전설의 성검 아란루스 +3', `강화 레벨 적용 시 '+3'만 정상 부착 (실제: ${forcedArtifact.displayName})`);

// -----------------------------------------------------------------------------
// [TEST SUITE 6] 전수 조사: 전체 ToME 유물(ARTIFACTS) 100% 명칭 무결성 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 6] 전체 ToME 유물 데이터셋(TOME_ARTIFACTS_DATA) 전수 명칭 검증');

const allArtifactKeys = Object.keys(TOME_ARTIFACTS_DATA);
let cleanArtifactsCount = 0;

for (const key of allArtifactKeys) {
  const item = createTomeItem(key);
  if (!item) continue;

  const hasSlayer = item.displayName.includes('학살자') || item.displayName.includes('SLAYER');
  const hasPrefixOrSuffix = item.prefixes.length > 0 || item.suffixes.length > 0;
  
  if (!hasSlayer && !hasPrefixOrSuffix) {
    cleanArtifactsCount++;
  }
}

assert(cleanArtifactsCount === allArtifactKeys.length, `전체 ${allArtifactKeys.length}종 유물 전수 조사 100% 통과 (${cleanArtifactsCount}/${allArtifactKeys.length})`);

// -----------------------------------------------------------------------------
// [TEST SUITE 7] TomeFlagResolver 연동 유물 플래그 보존 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 7] TomeFlagResolver 유물 고유 플래그 수집 무결성 검증');

const ringilItem = createTomeItem('ART_RINGIL');
const ringilFlags = TomeFlagResolver.collectFlagsFromItem(ringilItem);
assert(ringilFlags.has('BRAND_COLD') || ringilFlags.has('COLD') || ringilFlags.has('ACTIVATE'), "Ringil 고유 플래그가 TomeFlagResolver를 통해 정상 수집됨");

const grondItem = createTomeItem('ART_GROND');
const grondFlags = TomeFlagResolver.collectFlagsFromItem(grondItem);
assert(grondFlags.has('KILL_DRAGON') || grondFlags.has('KILL_DEMON') || grondFlags.has('KILL_UNDEAD') || grondFlags.has('IMPACT'), "Grond 고유 플래그(KILL_DRAGON 등)가 TomeFlagResolver를 통해 정상 수집됨");

// -----------------------------------------------------------------------------
// 요약 및 최종 결과
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`🏁 UNIT TEST COMPLETE: ${passedTests} PASSED / ${totalTests - passedTests} FAILED (Total ${totalTests})`);
console.log('================================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL ARTIFACT NAME INTEGRITY TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
