/**
 * @file test_tomenet_monster_drops.js
 * @description 유니크 몬스터 하드코딩 드랍 배제 및 ToME/TomeNET 정통 드랍 플래그/테이블 기반 전리품 생성 엔진 검증
 */

import { UniqueMonsterManager, LEGACY_DUMMY_ITEMS } from '../src/systems/UniqueMonsterManager.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 1] 하드코딩 레거시 아이템 명칭 완전 퇴출 및 더미 격리 검증');
console.log('='.repeat(80));

assert(Array.isArray(LEGACY_DUMMY_ITEMS), 'LEGACY_DUMMY_ITEMS 배열 상수 익스포트 확인');
assert(LEGACY_DUMMY_ITEMS.includes('축복받은 기사의 명검'), '축복받은 기사의 명검이 더미 목록에 격리됨');
assert(LEGACY_DUMMY_ITEMS.includes('발리노르의 신성한 명검'), '발리노르의 신성한 명검이 더미 목록에 격리됨');
assert(LEGACY_DUMMY_ITEMS.includes('발리노르의 무기 대강화 주문서'), '발리노르의 무기 대강화 주문서가 더미 목록에 격리됨');
assert(LEGACY_DUMMY_ITEMS.includes('영구 전능 성장 영약'), '영구 전능 성장 영약이 더미 목록에 격리됨');

const manager = new UniqueMonsterManager();

// 1~5층 저층 유니크 30회 반복 드랍 테스트
let foundLegacyInLow = false;
for (let i = 0; i < 30; i++) {
  const lowMon = manager.createUniqueMonsterInstance(10, 10, 'MON_FARMER_MAGGOT', 2);
  const drops = manager.generateUniqueMonsterDrops(lowMon, 2);
  for (const d of drops) {
    if (LEGACY_DUMMY_ITEMS.includes(d.name)) {
      foundLegacyInLow = true;
      break;
    }
  }
}
assert(!foundLegacyInLow, '1~5층 유니크 처치 시 하드코딩 레거시 아이템이 단 1건도 생성되지 않음');

// 6층 이상 고층 유니크 30회 반복 드랍 테스트
let foundLegacyInHigh = false;
for (let i = 0; i < 30; i++) {
  const highMon = manager.createUniqueMonsterInstance(15, 15, 'MON_NAR_THE_DWARF', 17);
  const drops = manager.generateUniqueMonsterDrops(highMon, 17);
  for (const d of drops) {
    if (LEGACY_DUMMY_ITEMS.includes(d.name)) {
      foundLegacyInHigh = true;
      break;
    }
  }
}
assert(!foundLegacyInHigh, '6층 이상 유니크 처치 시 하드코딩 레거시 아이템이 단 1건도 생성되지 않음');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 2] ToME / TomeNET 정통 몬스터 드랍 플래그 파서(parseMonsterDropRules) 검증');
console.log('='.repeat(80));

// 1. DROP_4D2 플래그 보유 몬스터
const mockDrop4D2Mon = {
  uniqueKey: 'MON_TEST_4D2',
  flags: ['UNIQUE', 'DROP_4D2', 'DROP_GREAT']
};
const rules4D2 = manager.parseMonsterDropRules(mockDrop4D2Mon);
assert(rules4D2.count >= 5 && rules4D2.count <= 8, `DROP_4D2는 5~8개의 드랍 수를 산출해야 함 (실제: ${rules4D2.count})`);
assert(rules4D2.isGreat === true, 'DROP_GREAT 플래그 파싱 확인 (isGreat = true)');
assert(rules4D2.isGood === true, 'DROP_GREAT 시 isGood도 true로 판정');

// 2. DROP_2D2 플래그 보유 몬스터
const mockDrop2D2Mon = {
  uniqueKey: 'MON_TEST_2D2',
  flags: ['UNIQUE', 'DROP_2D2', 'DROP_GOOD']
};
const rules2D2 = manager.parseMonsterDropRules(mockDrop2D2Mon);
assert(rules2D2.count >= 3 && rules2D2.count <= 4, `DROP_2D2는 3~4개의 드랍 수를 산출해야 함 (실제: ${rules2D2.count})`);
assert(rules2D2.isGood === true, 'DROP_GOOD 플래그 파싱 확인 (isGood = true)');

// 3. 플래그가 없는 유니크 몬스터의 기본 보장치 검증
const mockNoFlagMon = {
  isUnique: true,
  uniqueKey: 'MON_TEST_NO_FLAG',
  flags: []
};
const rulesDefault = manager.parseMonsterDropRules(mockNoFlagMon);
assert(rulesDefault.count >= 2, `유니크 몬스터는 기본 최소 2개 이상의 드랍을 보장해야 함 (실제: ${rulesDefault.count})`);
assert(rulesDefault.isGood === true, '유니크 몬스터는 기본 isGood = true 보장');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 3] 1~5층 저층 유니크 ToME 정규 에고 장비 및 표준 소모품 검증');
console.log('='.repeat(80));

const lowUnique = manager.createUniqueMonsterInstance(5, 5, 'MON_FARMER_MAGGOT', 3);
const lowDrops = manager.generateUniqueMonsterDrops(lowUnique, 3);

assert(lowDrops.length >= 2, '저층 유니크 처치 시 2개 이상의 전리품 생성');
const egoEquip = lowDrops.find(d => d.type === 'WEAPON' || d.type === 'ARMOR' || d.type === 'HELMET' || d.type === 'SHIELD');
assert(egoEquip !== undefined, '정규 에고 장비가 생성됨');
assert(egoEquip.prefixes.includes('HOLY'), '에고 장비에 고결한 HOLY 접두사가 안착됨');
assert(egoEquip.suffixes.length > 0, `에고 장비에 접미사(${egoEquip.suffixes.join('/')}) 안착 확인`);
assert(egoEquip.name !== '축복받은 기사의 명검', `하드코딩 명칭이 아닌 정규 장비 기본명(${egoEquip.name}) 확인`);

const hasScroll = lowDrops.some(d => d.type === 'SCROLL' && (d.name === '무기 강화 주문서' || d.name === '방어구 강화 주문서'));
assert(hasScroll, '표준 ToME 마법 강화 주문서 생성 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 4] 6층 이상 ToME 전설 유물(Artifact) 우선 드랍 및 절차적 추가 드랍 검증');
console.log('='.repeat(80));

const highUnique = manager.createUniqueMonsterInstance(20, 20, 'MON_SHAGRAT_THE_ORC_CAPTAIN', 19);
const highDrops = manager.generateUniqueMonsterDrops(highUnique, 19);

assert(highDrops.length >= 2, '고층 유니크 처치 시 2개 이상의 전리품 생성');
const artItem = highDrops.find(d => d.specialTags && d.specialTags.includes('ARTIFACT'));
assert(artItem !== undefined, 'ToME 정규 전설 유물이 반드시 1개 이상 선별 드랍됨');
assert(artItem.artifactKey !== undefined, `유물 키(${artItem.artifactKey}) 보유 확인`);
assert(!artItem.name.includes('발리노르의 신성한 명검'), '하드코딩 발리노르 명검이 아닌 진짜 ToME 유물 드랍 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 5] Spawner.js 보스룸 및 비밀 금고 하드코딩 제거 검증');
console.log('='.repeat(80));

import { Spawner } from '../src/core/Spawner.js';
const mockGame = {
  floor: 3,
  player: { equippedLamp: true },
  items: [],
  monsters: [],
  map: {
    width: 20,
    height: 20,
    rooms: [
      { type: 'NORMAL', center: { x: 2, y: 2 } },
      { type: 'BOSS', center: { x: 7, y: 7 } },
      { type: 'TREASURE_VAULT', center: { x: 15, y: 15 } }
    ],
    isWalkable: () => true,
    isWall: () => false
  }
};

Spawner.spawnFloorContent(mockGame);

assert(mockGame.items.length >= 2, `보스룸 및 비밀 금고에 특급 전리품들이 절차적 스폰됨 (스폰 수: ${mockGame.items.length})`);
// TomeLootGenerator로 생성된 아이템들은 올바른 cost, components, tags를 갖춤
for (const it of mockGame.items) {
  assert(it !== null && typeof it === 'object', `스폰된 아이템 [${it.name}] 유효 객체 확인`);
  assert(typeof it.cost === 'number', `스폰된 아이템 [${it.name}] 정규 비용(${it.cost}) 산출 확인`);
}

console.log('='.repeat(80));
console.log(`🎉 [TEST SUMMARY] 총 ${passed + failed}개 검증 중 ${passed}개 통과 (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
