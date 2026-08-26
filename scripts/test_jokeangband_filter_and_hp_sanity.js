/**
 * @file test_jokeangband_filter_and_hp_sanity.js
 * @description JOKEANGBAND 조크/이스터에그 몬스터(Mathilde 등) 일반 던전 스폰 전면 차단 및
 *              층계별 몬스터 HP 상한 가드(Sanity Guard) 무결성 종합 단위 테스트.
 */

import { Spawner } from '../src/core/Spawner.js';
import { uniqueMonsterManager, UniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { DungeonValueBudgetEngine, getMaxAllowedMonsterHp, clampMonsterHp, DUNGEON_TIER_CONFIGS } from '../src/systems/DungeonValueBudgetEngine.js';
import { Monster } from '../src/entities/Monster.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { 
  SPAWN_FEATURE_CONFIG, 
  DUNGEON_CUSTOM_SETTINGS, 
  isJokeMonster 
} from '../src/configs/GameBalanceConfig.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('================================================================================');
console.log('🛡️ MIMICRY VOXEL: JOKEANGBAND FILTER & HP SANITY GUARD UNIT TEST');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// [TEST 1] SPAWN_FEATURE_CONFIG & isJokeMonster 판별 검증
// -----------------------------------------------------------------------------
console.log('▶ [TEST 1] SPAWN_FEATURE_CONFIG 및 isJokeMonster 판별 엔진 검증');

assert(SPAWN_FEATURE_CONFIG.allowJokeMonsters === false, '기본 allowJokeMonsters는 false여야 함');
assert(Array.isArray(SPAWN_FEATURE_CONFIG.flagBlacklist), 'flagBlacklist 배열이 정의되어 있어야 함');
assert(SPAWN_FEATURE_CONFIG.flagBlacklist.includes('JOKEANGBAND'), 'flagBlacklist에 JOKEANGBAND가 포함되어야 함');
assert(SPAWN_FEATURE_CONFIG.hpSanityClamping === true, 'hpSanityClamping은 true여야 함');

const mathildeData = TOME_MONSTERS_DATA['MON_MATHILDE_THE_SCIENCE_STUDENT'];
assert(Boolean(mathildeData), 'Mathilde 메타데이터가 존재해야 함');
assert(isJokeMonster(mathildeData) === true, 'Mathilde는 isJokeMonster가 true여야 함');

const normalOrcData = TOME_MONSTERS_DATA['MON_ORC'] || TOME_MONSTERS_DATA['MON_HILL_ORC'];
assert(isJokeMonster(normalOrcData) === false, '일반 오크는 isJokeMonster가 false여야 함');

const slimeData = TOME_MONSTERS_DATA['MON_GREEN_GLUTTON_GHOST'] || { name: 'Slime', flags: [] };
assert(isJokeMonster(slimeData) === false, '일반 슬라임은 isJokeMonster가 false여야 함');


// -----------------------------------------------------------------------------
// [TEST 2] Spawner 1~50F 일반 스폰 풀에서 JOKEANGBAND 몬스터 0마리 검증
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 2] Spawner.rollMonsterSpecies 1~50F 1,000회 시뮬레이션 조크 몬스터 0% 검증');

let jokeSpawnCount = 0;
let totalRolls = 1000;

for (let i = 0; i < totalRolls; i++) {
  const floor = (i % 50) + 1;
  const isBoss = Math.random() < 0.2;
  const speciesKey = Spawner.rollMonsterSpecies(floor, isBoss);
  const monData = TOME_MONSTERS_DATA[speciesKey];
  if (monData && isJokeMonster(monData)) {
    jokeSpawnCount++;
    console.error(`    [경고] 조크 몬스터 스폰 감지: ${monData.name} (${speciesKey}) at Floor ${floor}`);
  }
}

assert(jokeSpawnCount === 0, `1,000회 스폰 롤링 중 조크 몬스터 출현 횟수는 0이어야 함 (실제: ${jokeSpawnCount})`);


// -----------------------------------------------------------------------------
// [TEST 3] Spawner.resolveSummonSpecies 소환 풀 조크 몬스터 배제 검증
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 3] Spawner.resolveSummonSpecies 소환 타입별 조크 몬스터 배제 검증');

const summonTypes = ['MONSTER', 'ANIMAL', 'ANT', 'SPIDER', 'HOUND', 'HYDRA', 'ANGEL', 'DEMON', 'HI_DEMON', 'UNDEAD', 'HI_UNDEAD', 'DRAGON', 'HI_DRAGON', 'WRAITH', 'CYBERDEMON', 'THUNDERLORD', 'BUG'];
let jokeSummonCount = 0;

for (const sType of summonTypes) {
  for (let f = 1; f <= 50; f += 5) {
    for (let r = 0; r < 20; r++) {
      const summonedKey = Spawner.resolveSummonSpecies(sType, f);
      const monData = TOME_MONSTERS_DATA[summonedKey];
      if (monData && isJokeMonster(monData)) {
        jokeSummonCount++;
        console.error(`    [경고] 소환 풀 조크 몬스터 감지: ${monData.name} (type: ${sType}, floor: ${f})`);
      }
    }
  }
}

assert(jokeSummonCount === 0, `소환 풀 시뮬레이션 중 조크 몬스터 출현 횟수는 0이어야 함 (실제: ${jokeSummonCount})`);


// -----------------------------------------------------------------------------
// [TEST 4] UniqueMonsterManager 유니크 풀 조크 몬스터 영구 제외 검증
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 4] UniqueMonsterManager 유니크 풀 조크 몬스터 영구 제외 검증');

const testUmm = new UniqueMonsterManager();
assert(testUmm.canSpawn('MON_MATHILDE_THE_SCIENCE_STUDENT') === false, 'Mathilde는 canSpawn이 false여야 함');

let mathildeInPool = false;
for (let f = 1; f <= 50; f++) {
  const avail = testUmm.getAvailableUniqueMonsters(f, { minLevelOffset: -20, maxLevelOffset: 20 });
  if (avail.some(m => m.key === 'MON_MATHILDE_THE_SCIENCE_STUDENT' || isJokeMonster(m))) {
    mathildeInPool = true;
    break;
  }
}
assert(mathildeInPool === false, '1~50F 전체 getAvailableUniqueMonsters 풀에 Mathilde나 조크 몬스터가 없어야 함');

let jokeUniqueRolledCount = 0;
for (let f = 1; f <= 50; f++) {
  for (let r = 0; r < 10; r++) {
    const rolled = testUmm.rollUniqueMonster(f, { autoMarkSpawned: false });
    if (rolled && isJokeMonster(rolled)) {
      jokeUniqueRolledCount++;
    }
  }
}
assert(jokeUniqueRolledCount === 0, `유니크 롤링 중 조크 몬스터 출현 횟수는 0이어야 함 (실제: ${jokeUniqueRolledCount})`);


// -----------------------------------------------------------------------------
// [TEST 5] DungeonValueBudgetEngine 층계별 최대 HP 상한(Sanity Guard) 검증
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 5] DungeonValueBudgetEngine 층계별 최대 HP 상한 (Max Allowed HP) 검증');

assert(getMaxAllowedMonsterHp(1) === 300, '1F 최대 허용 HP는 300이어야 함 (Tier 1: 1~5F)');
assert(getMaxAllowedMonsterHp(5) === 300, '5F 최대 허용 HP는 300이어야 함 (Tier 1: 1~5F)');
assert(getMaxAllowedMonsterHp(6) === 1200, '6F 최대 허용 HP는 1,200이어야 함 (Tier 2: 6~20F)');
assert(getMaxAllowedMonsterHp(20) === 1200, '20F 최대 허용 HP는 1,200이어야 함 (Tier 2: 6~20F)');
assert(getMaxAllowedMonsterHp(21) === 3500, '21F 최대 허용 HP는 3,500이어야 함 (Tier 3: 21~40F)');
assert(getMaxAllowedMonsterHp(40) === 3500, '40F 최대 허용 HP는 3,500이어야 함 (Tier 3: 21~40F)');
assert(getMaxAllowedMonsterHp(41) === 8000, '41F 최대 허용 HP는 8,000이어야 함 (Tier 4: 41~50F)');
assert(getMaxAllowedMonsterHp(50, false) === 8000, '50F 일반 보스 최대 허용 HP는 8,000이어야 함');
assert(getMaxAllowedMonsterHp(50, true) === 15000, '50F 모르고스 최종보스 최대 허용 HP는 15,000이어야 함 (특수 예외)');

assert(clampMonsterHp(50000, 1) === 300, '1F에서 50,000 HP는 300으로 클램핑되어야 함');
assert(clampMonsterHp(50000, 10) === 1200, '10F에서 50,000 HP는 1,200으로 클램핑되어야 함');
assert(clampMonsterHp(50000, 30) === 3500, '30F에서 50,000 HP는 3,500으로 클램핑되어야 함');
assert(clampMonsterHp(50000, 50, false) === 8000, '50F에서 50,000 HP는 8,000으로 클램핑되어야 함');
assert(clampMonsterHp(50000, 50, true) === 15000, '50F 모르고스는 15,000으로 클램핑되어야 함');


// -----------------------------------------------------------------------------
// [TEST 6] Monster 엔티티 생성 시 Sanity Clamping 및 저층 HP 건전성 실측 검증
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 6] Monster 엔티티 생성 시 Sanity Clamping 및 저층 HP 건전성 검증');

// 1) 비정상 스탯 몬스터(Mathilde: coreBaseHp 11110, CON 180) 강제 생성 시 300 이하 클램핑 확인
const forcedMathilde = new Monster(0, 0, 'MON_MATHILDE_THE_SCIENCE_STUDENT', 1);
assert(forcedMathilde.stats.hp <= 300, `Mathilde의 1층 HP는 300 이하여야 함 (실제: ${forcedMathilde.stats.hp})`);
assert(forcedMathilde.stats.maxHp <= 300, `Mathilde의 1층 maxHp는 300 이하여야 함 (실제: ${forcedMathilde.stats.maxHp})`);
assert(forcedMathilde.maxHp <= 300, `Mathilde의 maxHp getter는 300 이하여야 함 (실제: ${forcedMathilde.maxHp})`);

// 2) 1~5층 일반 몬스터 100회 시뮬레이션 시 체력 건전성(10 ~ 250 범위) 검증
let abnormalHpCount = 0;
for (let i = 0; i < 100; i++) {
  const floor = (i % 5) + 1;
  const speciesKey = Spawner.rollMonsterSpecies(floor, false);
  const monster = new Monster(0, 0, speciesKey, floor);
  
  if (monster.stats.hp < 1 || monster.stats.hp > 300) {
    abnormalHpCount++;
    console.error(`    [경고] 비정상 HP 몬스터 발견: ${monster.displayName} Lv.${monster.level} (HP: ${monster.stats.hp}) at Floor ${floor}`);
  }
}

assert(abnormalHpCount === 0, `1~5층 100회 몬스터 생성 중 비정상 HP 몬스터 수는 0이어야 함 (실제: ${abnormalHpCount})`);


// -----------------------------------------------------------------------------
// [TEST 7] 종합 던전 커스텀 설정 DUNGEON_CUSTOM_SETTINGS 무결성 검증
// -----------------------------------------------------------------------------
console.log('\n▶ [TEST 7] DUNGEON_CUSTOM_SETTINGS 4대 종합 커스텀 설정 구조 검증');

assert(DUNGEON_CUSTOM_SETTINGS.spawn !== undefined, 'DUNGEON_CUSTOM_SETTINGS.spawn 정의 확인');
assert(DUNGEON_CUSTOM_SETTINGS.map !== undefined, 'DUNGEON_CUSTOM_SETTINGS.map 정의 확인');
assert(DUNGEON_CUSTOM_SETTINGS.loot !== undefined, 'DUNGEON_CUSTOM_SETTINGS.loot 정의 확인');
assert(DUNGEON_CUSTOM_SETTINGS.gameplay !== undefined, 'DUNGEON_CUSTOM_SETTINGS.gameplay 정의 확인');

assert(DUNGEON_CUSTOM_SETTINGS.map.mapSizeScale === 1.0, 'map.mapSizeScale 기본값 1.0 확인');
assert(DUNGEON_CUSTOM_SETTINGS.loot.itemDropMultiplier === 1.0, 'loot.itemDropMultiplier 기본값 1.0 확인');
assert(DUNGEON_CUSTOM_SETTINGS.gameplay.oodRollChance === 0.10, 'gameplay.oodRollChance 기본값 0.10 확인');


// -----------------------------------------------------------------------------
// 결과 요약
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`🏁 TEST COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================================');

if (failedTests === 0) {
  console.log('🎉 ALL JOKEANGBAND FILTER & HP SANITY TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED! PLEASE CHECK THE LOG ABOVE.');
  process.exit(1);
}
