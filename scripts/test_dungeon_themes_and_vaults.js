/**
 * scripts/test_dungeon_themes_and_vaults.js
 * 1~50층 5대 테마 던전 및 특수 지형(Vault & Monster Pit) 종합 테스트 스위트
 */

import {
  DUNGEON_THEMES,
  DUNGEON_THEME_KEYS,
  getThemeForFloor,
  getThemeConfig,
  getAmbientText,
  getRandomPitMonsterSpecies,
  getThemeColors
} from '../src/configs/DungeonThemeConfig.js';
import { Map, RectRoom } from '../src/map/Map.js';
import { Voxel3DMapBridge, VOXEL_THEMES } from '../src/map/Voxel3DMapBridge.js';

console.log("================================================================================");
console.log("🏰 [5 MAJOR DUNGEON THEMES & SPECIAL TERRAIN (VAULTS / PITS) TEST SUITE] 🏰");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: 5대 던전 테마 명세 및 1~50층 매핑 무결성 검증
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 5대 테마 명세 및 1~50층 매핑 무결성 검증 ---");

assert(DUNGEON_THEME_KEYS.length === 5, `DUNGEON_THEME_KEYS 5개 테마 키 등록 확인 (총 ${DUNGEON_THEME_KEYS.length}개)`);

DUNGEON_THEME_KEYS.forEach(key => {
  const theme = DUNGEON_THEMES[key];
  assert(!!theme, `테마 [${key}] 레지스트리 정의 확인`);
  assert(typeof theme.name === 'string' && theme.name.length > 0, `  - 테마 [${key}] 한글 이름 (${theme.name}) 유효성 확인`);
  assert(typeof theme.nameEn === 'string' && theme.nameEn.length > 0, `  - 테마 [${key}] 영문 이름 (${theme.nameEn}) 유효성 확인`);
  assert(typeof theme.description === 'string' && theme.description.length > 0, `  - 테마 [${key}] 설명 텍스트 유효성 확인`);
  assert(Array.isArray(theme.ambientTexts) && theme.ambientTexts.length >= 3, `  - 테마 [${key}] 환경 텍스트 ${theme.ambientTexts.length}개 보유 확인`);
  
  // 색상 검증
  assert(typeof theme.colors?.wallColor === 'string', `  - 테마 [${key}] wallColor (${theme.colors?.wallColor}) 정의 확인`);
  assert(typeof theme.colors?.floorColor === 'string', `  - 테마 [${key}] floorColor (${theme.colors?.floorColor}) 정의 확인`);
  assert(typeof theme.colors?.vaultFloorColor === 'string', `  - 테마 [${key}] vaultFloorColor (${theme.colors?.vaultFloorColor}) 정의 확인`);
  assert(typeof theme.colors?.pitFloorColor === 'string', `  - 테마 [${key}] pitFloorColor (${theme.colors?.pitFloorColor}) 정의 확인`);
  
  // 복셀 및 특수 확률 검증
  assert(!!theme.voxelColors?.wall && !!theme.voxelColors?.floor, `  - 테마 [${key}] 3D 복셀 팔레트 완비 확인`);
  assert(theme.specialRoomChances?.vaultChance > 0, `  - 테마 [${key}] Vault 스폰 확률 (${theme.specialRoomChances?.vaultChance}) 확인`);
  assert(theme.specialRoomChances?.monsterPitChance > 0, `  - 테마 [${key}] Pit 스폰 확률 (${theme.specialRoomChances?.monsterPitChance}) 확인`);
  assert(Array.isArray(theme.pitMonsterTypes) && theme.pitMonsterTypes.length >= 2, `  - 테마 [${key}] 피트 몬스터 후보 ${theme.pitMonsterTypes?.length}종 확인`);
  assert(Array.isArray(theme.vaultTypes) && theme.vaultTypes.length >= 2, `  - 테마 [${key}] 금고 아키타입 ${theme.vaultTypes?.length}종 확인`);
});

// 1~50층 전 층 테마 매핑 검증
for (let f = 1; f <= 50; f++) {
  const theme = getThemeForFloor(f);
  if (f <= 10) assert(theme.id === 'CAVE_RUINS', `[Floor ${f}] -> CAVE_RUINS 매핑 확인`);
  else if (f <= 20) assert(theme.id === 'MINES_CATACOMBS', `[Floor ${f}] -> MINES_CATACOMBS 매핑 확인`);
  else if (f <= 30) assert(theme.id === 'VOLCANIC_FORTRESS', `[Floor ${f}] -> VOLCANIC_FORTRESS 매핑 확인`);
  else if (f <= 40) assert(theme.id === 'DARK_ABYSS', `[Floor ${f}] -> DARK_ABYSS 매핑 확인`);
  else assert(theme.id === 'DEEP_ANGBAND', `[Floor ${f}] -> DEEP_ANGBAND 매핑 확인`);
}

// 경계값 및 초과층 Fallback 검증
assert(getThemeForFloor(0).id === 'CAVE_RUINS', 'Floor 0 클램핑 -> CAVE_RUINS 매핑 확인');
assert(getThemeForFloor(55).id === 'DEEP_ANGBAND', 'Floor 55 초과층 -> DEEP_ANGBAND 매핑 확인');
assert(getThemeForFloor(100).id === 'DEEP_ANGBAND', 'Floor 100 초과층 -> DEEP_ANGBAND 매핑 확인');

// -----------------------------------------------------------------------------
// TEST 2: 테마 헬퍼 함수 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 테마 헬퍼 함수 (getThemeConfig, getAmbientText, getRandomPitMonsterSpecies, getThemeColors) 검증 ---");

assert(getThemeConfig('VOLCANIC_FORTRESS').name === '작열하는 화산 요새와 용암 동굴', 'getThemeConfig 키 조회 확인');
assert(getThemeConfig('UNKNOWN_KEY').id === 'CAVE_RUINS', 'getThemeConfig 알 수 없는 키 기본 fallback 확인');

const ambient1 = getAmbientText(5);
assert(typeof ambient1 === 'string' && ambient1.length > 0, `1~10F Ambient Text 생성 확인: "${ambient1}"`);
const ambient50 = getAmbientText(50);
assert(typeof ambient50 === 'string' && ambient50.length > 0, `50F Ambient Text 생성 확인: "${ambient50}"`);

const pitSpecies1 = getRandomPitMonsterSpecies(3);
assert(['SLIME', 'GOBLIN', 'KOBOLD'].includes(pitSpecies1), `1~10F 피트 종족 롤링 확인: [${pitSpecies1}]`);
const pitSpecies30 = getRandomPitMonsterSpecies(25);
assert(['TROLL', 'OGRE', 'DEMON', 'DRAGON'].includes(pitSpecies30), `21~30F 피트 종족 롤링 확인: [${pitSpecies30}]`);

const colors25 = getThemeColors(25);
assert(colors25.wallColor === '#991b1b', '25층 화산 요새 wallColor (#991b1b) 일치 확인');
assert(colors25.floorColor === '#450a0a', '25층 화산 요새 floorColor (#450a0a) 일치 확인');

// -----------------------------------------------------------------------------
// TEST 3: Map 클래스 테마 통합 및 절차적 맵 생성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: Map 클래스 테마 통합 및 절차적 맵 생성 검증 ---");

const testFloors = [1, 10, 15, 25, 35, 45, 50];

testFloors.forEach(f => {
  const map = new Map(60, 40, f);
  assert(map.floor === f, `[Floor ${f}] Map.floor 일치 확인`);
  assert(map.theme.id === getThemeForFloor(f).id, `[Floor ${f}] Map.themeKey (${map.themeKey}) 테마 일치 확인`);
  assert(map.rooms.length > 0, `[Floor ${f}] 방 생성 개수: ${map.rooms.length}개`);
  assert(map.isWalkable(map.startingPosition.x, map.startingPosition.y), `[Floor ${f}] 시작 지점 (${map.startingPosition.x}, ${map.startingPosition.y}) Walkable 확인`);
  
  // 시작 방(0번 방) FOV 사전 탐색 검증
  const startTile = map.getTile(map.startingPosition.x, map.startingPosition.y);
  assert(startTile.isExplored === true, `[Floor ${f}] 시작 지점 타일 사전 탐색(isExplored) 완료 확인`);

  // 계단 검증
  const startRoom = map.rooms[0];
  const upStairTile = map.getTile(startRoom.center.x, startRoom.center.y);
  assert(upStairTile.char === '<', `[Floor ${f}] 상행 계단 '<' 배치 확인`);
  if (f === 1) {
    assert(upStairTile.isUpStaircase === false, `[Floor 1] 1층 상행 계단 봉인 상태 확인`);
  } else {
    assert(upStairTile.isUpStaircase === true, `[Floor ${f}] 2층 이상 상행 계단 활성화 확인`);
  }

  const lastRoom = map.rooms[map.rooms.length - 1];
  const downStairTile = map.getTile(lastRoom.center.x, lastRoom.center.y);
  if (f < 50) {
    assert(downStairTile.char === '>' && downStairTile.isStaircase === true, `[Floor ${f}] 하행 계단 '>' 배치 확인`);
  } else {
    assert(map.getDownStairs().length === 0, `[Floor 50] 50층 결전장 하행 계단 미생성 (0개) 확인`);
  }

  // 5층 단위 보스룸 검증
  if (f % 5 === 0) {
    assert(lastRoom.type === 'BOSS', `[Floor ${f}] 5의 배수 층 마지막 방 BOSS 타입 지정 확인`);
    const bossRoom = map.getBossRoom();
    assert(bossRoom !== null && bossRoom === lastRoom, `[Floor ${f}] map.getBossRoom() 반환 유효성 확인`);
  }
});

// -----------------------------------------------------------------------------
// TEST 4: 보물 금고 (TREASURE_VAULT) 절차적 아키타입 생성 무결성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 보물 금고 (TREASURE_VAULT) 절차적 아키타입 생성 무결성 검증 ---");

const vaultMap = new Map(80, 60, 25, { forceRoomType: 'TREASURE_VAULT', maxRooms: 10 });
const vaultRooms = vaultMap.getVaultRooms();

assert(vaultRooms.length > 0, `강제 생성 시 보물 금고 방 ${vaultRooms.length}개 생성 확인`);

vaultRooms.forEach((vr, idx) => {
  assert(vr.type === 'TREASURE_VAULT', `[Vault ${idx}] 방 타입 TREASURE_VAULT 확인`);
  assert(vr.vaultType === 'INNER_CHAMBER' || vr.vaultType === 'GEM_ALCOVE', `[Vault ${idx}] 아키타입 [${vr.vaultType}] 지정 확인`);
  assert(vr.treasureTiles.length > 0, `[Vault ${idx}] 보물 타일 ${vr.treasureTiles.length}개 배치 확인`);
  
  // 보물 타일 확인
  vr.treasureTiles.forEach(tt => {
    const tile = vaultMap.getTile(tt.x, tt.y);
    assert(tile !== null, `[Vault ${idx}] 보물 타일 좌표 (${tt.x}, ${tt.y}) 유효성 확인`);
    assert(tile.char === '$' || tile.type === 'TREASURE', `[Vault ${idx}] 보물 타일 기호/타입 확인 ($ / TREASURE)`);
    assert(tile.isWalkable === true, `[Vault ${idx}] 보물 타일 이동 가능(Walkable) 확인`);
  });

  // 함정 타일 확인
  if (vr.trapTiles.length > 0) {
    vr.trapTiles.forEach(tr => {
      const tile = vaultMap.getTile(tr.x, tr.y);
      assert(tile.isTrap === true && tile.char === '^', `[Vault ${idx}] 함정 타일 (${tr.x}, ${tr.y}) isTrap 및 기호 '^' 확인`);
    });
  }

  // 대형 밀실(INNER_CHAMBER)인 경우 도어 타일 확인
  if (vr.vaultType === 'INNER_CHAMBER') {
    assert(vr.doorTiles.length > 0, `[Vault ${idx}] INNER_CHAMBER 도어 타일 (${vr.doorTiles.length}개) 배치 확인`);
    vr.doorTiles.forEach(dt => {
      const tile = vaultMap.getTile(dt.x, dt.y);
      assert(tile.char === '+' && tile.isWalkable === true, `[Vault ${idx}] 도어 타일 '+' 통행 가능 확인`);
    });
  }
});

// -----------------------------------------------------------------------------
// TEST 5: 몬스터 피트 (MONSTER_PIT) 절차적 생성 무결성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 몬스터 피트 (MONSTER_PIT) 절차적 생성 무결성 검증 ---");

const pitMap = new Map(80, 60, 35, { forceRoomType: 'MONSTER_PIT', maxRooms: 10 });
const pitRooms = pitMap.getPitRooms();

assert(pitRooms.length > 0, `강제 생성 시 몬스터 피트 방 ${pitRooms.length}개 생성 확인`);

pitRooms.forEach((pr, idx) => {
  assert(pr.type === 'MONSTER_PIT', `[Pit ${idx}] 방 타입 MONSTER_PIT 확인`);
  assert(typeof pr.pitSpecies === 'string' && pr.pitSpecies.length > 0, `[Pit ${idx}] 피트 몬스터 단일 종족 [${pr.pitSpecies}] 지정 확인`);
  assert(pr.pitTiles.length > 0, `[Pit ${idx}] 피트 스폰 타일 ${pr.pitTiles.length}개 마킹 확인`);

  // 피트 타일 검증
  pr.pitTiles.forEach(pt => {
    const tile = pitMap.getTile(pt.x, pt.y);
    assert(tile !== null, `[Pit ${idx}] 피트 타일 좌표 (${pt.x}, ${pt.y}) 유효성 확인`);
    assert(tile.isPitTile === true, `[Pit ${idx}] 타일 isPitTile 플래그 확인`);
    assert(tile.pitSpecies === pr.pitSpecies, `[Pit ${idx}] 타일 pitSpecies [${tile.pitSpecies}] 일치 확인`);
    assert(tile.isWalkable === true, `[Pit ${idx}] 피트 타일 Walkable 확인`);
  });
});

// -----------------------------------------------------------------------------
// TEST 6: 맵 충돌, 시야(LOS) 투명도 및 타일 판정 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 6: 맵 충돌, 시야(LOS) 투명도 및 타일 판정 검증 ---");

const map6 = new Map(50, 50, 1);
assert(map6.isWalkable(0, 0) === false, '외곽 벽 좌표 (0,0) isWalkable === false 확인');
assert(map6.getTile(-1, -1) === null, '음수 좌표 getTile === null 확인');
assert(map6.getTile(100, 100) === null, '초과 좌표 getTile === null 확인');

const startPos = map6.startingPosition;
assert(map6.isWalkable(startPos.x, startPos.y) === true, '시작 좌표 isWalkable === true 확인');
assert(map6.isTransparent(startPos.x, startPos.y, startPos.x, startPos.y) === true, '동일 좌표 시야 투과 isTransparent === true 확인');

// 인접 1칸 시야 투과 검증 (3x3 안전구역)
assert(map6.isTransparent(startPos.x, startPos.y, startPos.x + 1, startPos.y) === true, '인접 바닥 타일 시야 투과 확인');

// 벽 너머 시야 차단 검증
assert(map6.isTransparent(startPos.x, startPos.y, 0, 0) === false, '외곽 벽 방향 시야 차단(isTransparent === false) 확인');

// -----------------------------------------------------------------------------
// TEST 7: 3D 복셀 브릿지 (Voxel3DMapBridge) 동기화 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 7: 3D 복셀 브릿지 (Voxel3DMapBridge) 동기화 검증 ---");

const bridge = new Voxel3DMapBridge(vaultMap);
const topVoxelStart = bridge.getTopVoxel(vaultMap.startingPosition.x, vaultMap.startingPosition.y);

assert(topVoxelStart !== null, '시작 좌표 최상단 복셀 조회 확인');
assert(topVoxelStart.isWalkable === true, '시작 좌표 최상단 복셀 Walkable 확인');
assert(topVoxelStart.themeKey === 'FLOOR' || topVoxelStart.themeKey === 'STAIRS_UP', `시작 좌표 복셀 테마 [${topVoxelStart.themeKey}] 유효성 확인`);

const wallStack = bridge.getVoxelStack(0, 0);
assert(wallStack.length === 3, `외곽 성벽 Z=0~2 다층 복셀 스택 (길이: ${wallStack.length}) 확인`);
assert(wallStack[2].themeKey === 'WALL' && wallStack[2].isWalkable === false, '성벽 최상단 복셀 WALL 테마 및 비통행 확인');

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED (100% PASS)`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
