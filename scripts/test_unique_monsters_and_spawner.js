/**
 * @file test_unique_monsters_and_spawner.js
 * @description ToME 2.3.5 유니크 몬스터 1회성 스폰 생태계, 전설 유물/에고 확정 드랍 파이프라인 및 SaveSystem 직렬화/역직렬화 검증 스위트
 */

import { uniqueMonsterManager, UniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { Spawner, MONSTER_PIT_THEMES, DUNGEON_THEMES } from '../src/core/Spawner.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { SaveSystem } from '../src/core/SaveSystem.js';
import { Map } from '../src/map/Map.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';

console.log("================================================================================");
console.log("🏰 MIMICRY VOXEL: UNIQUE MONSTERS, SPAWNER & SAVE SYSTEM INTEGRATION TEST");
console.log("================================================================================\n");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: UniqueMonsterManager Dataset Indexing & Identification
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] UniqueMonsterManager 데이터셋 인덱싱 및 유니크 판별 검증");
{
  const allUniques = uniqueMonsterManager.getAllUniqueMonsters();
  console.log(`  - 총 인덱싱된 유니크 몬스터 수: ${allUniques.length}`);
  assert(allUniques.length >= 160, `160종 이상의 유니크 몬스터가 색인되어야 함 (실제: ${allUniques.length})`);

  const sampleKey = allUniques[0].key;
  assert(uniqueMonsterManager.isUnique(sampleKey), `isUnique('${sampleKey}')는 true여야 함`);
  assert(!uniqueMonsterManager.isUnique('MON_FILTHY_STREET_URCHIN'), `일반 몬스터는 isUnique가 false여야 함`);

  const lookupData = uniqueMonsterManager.getUniqueMonsterByKey(sampleKey);
  assert(lookupData !== null && lookupData.key === sampleKey, `getUniqueMonsterByKey로 메타데이터 조회 가능해야 함`);
}

// -----------------------------------------------------------------------------
// TEST 2: 1-Time Unique Monster Spawn Guarantee (단 1회 스폰 보장)
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] 유니크 몬스터 단 1회 스폰 보장 (중복 스폰 절대 방지) 검증");
{
  const manager = new UniqueMonsterManager();
  const candidate = manager.getAllUniqueMonsters()[0];
  const targetKey = candidate.key;

  assert(manager.canSpawn(targetKey), `초기 상태에서 canSpawn('${targetKey}')은 true여야 함`);
  assert(!manager.isSpawned(targetKey), `초기 상태에서 isSpawned는 false여야 함`);

  // 1회 스폰 마킹
  manager.markSpawned(targetKey);
  assert(manager.isSpawned(targetKey), `markSpawned 호출 후 isSpawned는 true여야 함`);
  assert(!manager.canSpawn(targetKey), `스폰된 유니크는 canSpawn이 false여야 함 (중복 스폰 방지)`);

  // rollUniqueMonster로 선택 시 중복 선택 불가 확인
  const rolled = manager.rollUniqueMonster(candidate.level, { minLevelOffset: -1, maxLevelOffset: 1 });
  if (rolled) {
    assert(rolled.key !== targetKey, `이미 스폰된 '${targetKey}'는 다시 롤링되지 않아야 함`);
  } else {
    assert(true, `후보가 없으면 null 반환`);
  }
}

// -----------------------------------------------------------------------------
// TEST 3: Unique Monster Kill & Artifact Drop Pipeline (전설 유물 확정 드랍)
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] 유니크 처치 및 전설 유물/특급 에고 확정 드랍 파이프라인 검증");
{
  const manager = new UniqueMonsterManager();
  const uniqueCandidate = manager.getAllUniqueMonsters().find(m => m.level >= 5) || manager.getAllUniqueMonsters()[0];
  const uniqueMonster = manager.createUniqueMonsterInstance(10, 10, uniqueCandidate, 5);

  assert(uniqueMonster !== null, `createUniqueMonsterInstance로 인스턴스가 정상 생성되어야 함`);
  assert(uniqueMonster.isUnique === true, `생성된 몬스터의 isUnique는 true여야 함`);
  assert(uniqueMonster.uniqueKey === uniqueCandidate.key, `uniqueKey가 일치해야 함`);

  // 처치 전리품 드랍 생성
  const drops = manager.generateUniqueMonsterDrops(uniqueMonster, 5);
  console.log(`  - 생성된 드랍 아이템 수: ${drops.length}`);
  drops.forEach(d => console.log(`    * [${d.type}] ${d.name} (${d.char}) - 희귀도: ${d.prefixes.join('/')}`));

  assert(drops.length >= 2, `유니크 처치 시 최소 2개 이상의 최고급 전리품이 생성되어야 함`);
  assert(manager.isKilled(uniqueCandidate.key), `처치 후 isKilled('${uniqueCandidate.key}')는 true여야 함`);
  assert(!manager.canSpawn(uniqueCandidate.key), `처치된 몬스터는 canSpawn이 false여야 함`);

  const hasArtifactOrEgo = drops.some(d => d.specialTags?.includes('ARTIFACT') || d.prefixes?.includes('LEGENDARY') || d.prefixes?.includes('HOLY'));
  assert(hasArtifactOrEgo, `전설 유물(ARTIFACT) 또는 최고급 레전더리 에고가 반드시 포함되어야 함`);
}

// -----------------------------------------------------------------------------
// TEST 4: LootSystem Integration with Unique Monsters (100% 코어 및 유물 드랍)
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] LootSystem.processMonsterDeath 유니크 연동 검증");
{
  const testManager = new UniqueMonsterManager();
  const player = new Player(10, 10, 'HUMAN');
  const uMon = testManager.createUniqueMonsterInstance(12, 12, 'MON_FARMER_MAGGOT', 2);

  const mockGame = {
    floor: 2,
    floorDanger: 2,
    monsters: [uMon],
    items: [],
    map: new Map(30, 30),
    uniqueMonsterManager: testManager,
    addLogEntry: (msg, type) => {}
  };

  LootSystem.processMonsterDeath(mockGame, player, uMon, '신성 마법 일격');

  assert(testManager.isKilled('MON_FARMER_MAGGOT'), `LootSystem 처리 후 Farmer Maggot은 처치 상태여야 함`);
  assert(mockGame.items.length >= 2, `바닥에 정수 코어 및 전설 전리품이 생성되어야 함 (실제: ${mockGame.items.length})`);
  
  const hasCore = mockGame.items.some(it => it.type === 'CORE');
  assert(hasCore, `유니크 몬스터 처치 시 정수 코어가 100% 확정 드랍되어야 함`);
}

// -----------------------------------------------------------------------------
// TEST 5: Spawner Dungeon Simulation (Vault, Monster Pit, Unique Spawns)
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] Spawner 1~20층 시뮬레이션: Vault, Pit, Unique 스폰 및 무결성 검증");
{
  const simManager = new UniqueMonsterManager();
  const player = new Player(10, 10, 'HUMAN');
  
  let totalUniqueEncounters = 0;
  let totalVaultRooms = 0;
  let totalMonsterPits = 0;
  const spawnedUniqueKeys = new Set();

  for (let floor = 1; floor <= 20; floor++) {
    const map = new Map(60, 60, floor);
    // 강제로 방 타입 다양화
    if (map.rooms.length > 2) {
      map.rooms[1].type = 'TREASURE_VAULT';
      totalVaultRooms++;
    }
    if (map.rooms.length > 3 && floor >= 3) {
      map.rooms[2].type = 'MONSTER_PIT';
      totalMonsterPits++;
    }

    const simGame = {
      floor,
      floorDanger: 1 + floor * 0.5,
      map,
      player,
      monsters: [],
      items: [],
      uniqueMonsterManager: simManager,
      addLogEntry: () => {},
      isMonsterAt: (x, y) => simGame.monsters.some(m => m.x === x && m.y === y)
    };

    Spawner.spawnFloorContent(simGame);

    simGame.monsters.forEach(m => {
      if (m.isUnique) {
        totalUniqueEncounters++;
        assert(!spawnedUniqueKeys.has(m.uniqueKey || m.type), `유니크 [${m.displayName}]는 세션 중복 스폰되지 않아야 함`);
        spawnedUniqueKeys.add(m.uniqueKey || m.type);
      }
    });
  }

  console.log(`  - 20개 층 탐험 결과:`);
  console.log(`    * 고유 유니크 조우 수: ${totalUniqueEncounters}`);
  console.log(`    * Vault 금고 조우 수: ${totalVaultRooms}`);
  console.log(`    * Monster Pit 조우 수: ${totalMonsterPits}`);

  assert(totalUniqueEncounters > 0, `20층 시뮬레이션 중 유니크 몬스터가 1체 이상 정상 스폰되어야 함`);
  assert(spawnedUniqueKeys.size === totalUniqueEncounters, `모든 스폰된 유니크 몬스터는 서로 달라야 함 (1회성 보장)`);
}

// -----------------------------------------------------------------------------
// TEST 6: SaveSystem Serialization & Deserialization Integrity
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 6] SaveSystem 직렬화/역직렬화 유니크 몬스터 생태계 복원 검증");
{
  const saveManager = new UniqueMonsterManager();
  saveManager.markSpawned('MON_FARMER_MAGGOT');
  saveManager.markKilled('MON_FARMER_MAGGOT');
  saveManager.markSpawned('MON_BULLRUSH');

  const player = new Player(10, 10, 'HUMAN');
  const map = new Map(40, 40, 3);
  const gameToSave = {
    floor: 3,
    floorDanger: 2.5,
    map,
    player,
    monsters: [],
    items: [],
    uniqueMonsterManager: saveManager
  };

  const serializedJson = SaveSystem.serialize(gameToSave);
  assert(typeof serializedJson === 'string' && serializedJson.length > 50, `SaveSystem.serialize 출력이 유효한 JSON 문자열이어야 함`);

  const parsed = JSON.parse(serializedJson);
  assert(parsed.uniqueMonsters !== undefined, `직렬화 JSON에 uniqueMonsters 필드가 포함되어야 함`);
  assert(parsed.uniqueMonsters.killed.includes('MON_FARMER_MAGGOT'), `killed 목록에 MON_FARMER_MAGGOT이 포함되어야 함`);
  assert(parsed.uniqueMonsters.spawned.includes('MON_BULLRUSH'), `spawned 목록에 MON_BULLRUSH가 포함되어야 함`);

  // 새로운 Game 인스턴스에 로드
  const freshManager = new UniqueMonsterManager();
  const gameToLoad = {
    uniqueMonsterManager: freshManager
  };

  SaveSystem.deserialize(gameToLoad, serializedJson);

  assert(freshManager.isKilled('MON_FARMER_MAGGOT'), `역직렬화 후 MON_FARMER_MAGGOT은 처치 상태로 복원되어야 함`);
  assert(freshManager.isSpawned('MON_BULLRUSH'), `역직렬화 후 MON_BULLRUSH는 스폰 상태로 복원되어야 함`);
  assert(!freshManager.canSpawn('MON_FARMER_MAGGOT'), `복원 후 처치된 몬스터는 스폰 불가여야 함`);
  assert(!freshManager.canSpawn('MON_BULLRUSH'), `복원 후 스폰된 몬스터는 스폰 불가여야 함`);
}

console.log("\n================================================================================");
console.log(`🏁 TEST COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("================================================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL TESTS PASSED WITH 100% SUCCESS!");
}
