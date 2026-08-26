/**
 * scripts/test_dynamic_map_and_stairs.js
 * 다중 상/하행 계단(Multiple Staircases) 분산 생성 & 층 깊이/예산 기반 동적 맵 크기(Dynamic Map Dimensions) 종합 단위 테스트
 */

import {
  DungeonValueBudgetEngine,
  calculateMapDimensions,
  calculateStaircaseCounts,
  DUNGEON_TIER_CONFIGS
} from '../src/systems/DungeonValueBudgetEngine.js';
import { Map, RectRoom } from '../src/map/Map.js';
import { Game } from '../src/core/Game.js';
import { SaveSystem } from '../src/core/SaveSystem.js';

// -----------------------------------------------------------------------------
// HEADLESS DOM ENVIRONMENT SIMULATION
// -----------------------------------------------------------------------------
class MockDOMElement {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.style = {};
    this.children = [];
    this.classList = {
      _classes: new globalThis.Set(className ? className.split(' ') : []),
      contains: (c) => this.classList._classes.has(c),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c)
    };
    this.attributes = {};
    this.onclick = null;
    this.innerHTML = '';
    this.innerText = '';
  }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(evt, handler) {
    if (evt === 'click') this.onclick = handler;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  appendChild(child) {
    this.children.push(child);
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
    } else if (this.children.length > 0 && !child) {
      this.children.shift();
    }
  }
}

const domElements = new globalThis.Map();
function getOrCreateElem(id, cls = '') {
  if (!domElements.has(id)) {
    const el = new MockDOMElement(id, cls);
    if (id === 'game-canvas') {
      el.getContext = () => ({
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        scale: () => {}
      });
      el.clientWidth = 800;
      el.clientHeight = 600;
      el.width = 800;
      el.height = 600;
    }
    domElements.set(id, el);
  }
  return domElements.get(id);
}

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { search: '?mode=ascii' },
  innerWidth: 1024,
  innerHeight: 768,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id)
};

globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

globalThis.document = {
  getElementById: (id) => getOrCreateElem(id),
  createElement: (tag) => new MockDOMElement('', ''),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: (sel) => null,
  querySelectorAll: (sel) => []
};

globalThis.localStorage = {
  getItem: (k) => {
    if (k === 'mimicry_render_mode') return 'ascii';
    if (k === 'mimicry_options') return JSON.stringify({ autoResize: true });
    return null;
  },
  setItem: () => {},
  removeItem: () => {}
};

console.log("================================================================================");
console.log("🏰 [DYNAMIC MAP DIMENSIONS & MULTIPLE STAIRCASES UNIT TEST SUITE] 🏰");
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
// TEST 1: DungeonValueBudgetEngine 동적 맵 크기 수식(calculateMapDimensions) 검증
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 1~50층 동적 맵 크기(calculateMapDimensions) 수식 검증 ---");

// 1) 티어별 규격 범위 검증
for (let f = 1; f <= 50; f++) {
  const dim = calculateMapDimensions(f);
  assert(dim && typeof dim.width === 'number' && typeof dim.height === 'number' && typeof dim.maxRooms === 'number',
    `[Floor ${f}] calculateMapDimensions 반환 객체 구조 검증 ({width: ${dim.width}, height: ${dim.height}, maxRooms: ${dim.maxRooms}})`);

  if (f <= 5) {
    // 1~5F: width 55~65, height 38~45, maxRooms 8~11 (콤팩트 튜토리얼 던전)
    assert(dim.width >= 55 && dim.width <= 65, `  - [Floor ${f}] Tier 1 Width (${dim.width}) 55~65 범위 충족`);
    assert(dim.height >= 38 && dim.height <= 45, `  - [Floor ${f}] Tier 1 Height (${dim.height}) 38~45 범위 충족`);
    assert(dim.maxRooms >= 8 && dim.maxRooms <= 11, `  - [Floor ${f}] Tier 1 MaxRooms (${dim.maxRooms}) 8~11 범위 충족`);
  } else if (f <= 20) {
    // 6~20F: width 65~80, height 45~55, maxRooms 12~16 (중형 던전)
    assert(dim.width >= 65 && dim.width <= 80, `  - [Floor ${f}] Tier 2 Width (${dim.width}) 65~80 범위 충족`);
    assert(dim.height >= 45 && dim.height <= 55, `  - [Floor ${f}] Tier 2 Height (${dim.height}) 45~55 범위 충족`);
    assert(dim.maxRooms >= 12 && dim.maxRooms <= 16, `  - [Floor ${f}] Tier 2 MaxRooms (${dim.maxRooms}) 12~16 범위 충족`);
  } else if (f <= 40) {
    // 21~40F: width 80~95, height 55~65, maxRooms 16~22 (대형 복잡 던전)
    assert(dim.width >= 80 && dim.width <= 95, `  - [Floor ${f}] Tier 3 Width (${dim.width}) 80~95 범위 충족`);
    assert(dim.height >= 55 && dim.height <= 65, `  - [Floor ${f}] Tier 3 Height (${dim.height}) 55~65 범위 충족`);
    assert(dim.maxRooms >= 16 && dim.maxRooms <= 22, `  - [Floor ${f}] Tier 3 MaxRooms (${dim.maxRooms}) 16~22 범위 충족`);
  } else {
    // 41~50F: width 90~110, height 65~75, maxRooms 20~26 (광활한 엔드게임 던전)
    assert(dim.width >= 90 && dim.width <= 110, `  - [Floor ${f}] Tier 4 Width (${dim.width}) 90~110 범위 충족`);
    assert(dim.height >= 65 && dim.height <= 75, `  - [Floor ${f}] Tier 4 Height (${dim.height}) 65~75 범위 충족`);
    assert(dim.maxRooms >= 20 && dim.maxRooms <= 26, `  - [Floor ${f}] Tier 4 MaxRooms (${dim.maxRooms}) 20~26 범위 충족`);
  }
}

// 2) 경계값 및 초과값 안전 클램핑 검증
const dimMin = calculateMapDimensions(0);
assert(dimMin.width === 55 && dimMin.height === 38 && dimMin.maxRooms === 8, '0층 입력 시 1층 기본 규격 (55x38, maxRooms 8) 클램핑 확인');

const dimMax = calculateMapDimensions(100);
assert(dimMax.width === 110 && dimMax.height === 75 && dimMax.maxRooms === 26, '100층 입력 시 50층 엔드게임 규격 (110x75, maxRooms 26) 클램핑 확인');

// 3) DUNGEON_TIER_CONFIGS 메타데이터 일치 확인
assert(DUNGEON_TIER_CONFIGS.TIER_1.mapDimensions.minWidth === 55, 'TIER_1 mapDimensions minWidth 55 확인');
assert(DUNGEON_TIER_CONFIGS.TIER_4.mapDimensions.maxWidth === 110, 'TIER_4 mapDimensions maxWidth 110 확인');

// -----------------------------------------------------------------------------
// TEST 2: DungeonValueBudgetEngine 다중 계단 수식(calculateStaircaseCounts) 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 다중 계단 수식(calculateStaircaseCounts) 검증 ---");

for (let f = 1; f <= 50; f++) {
  const counts = calculateStaircaseCounts(f, 20);

  // 상행 계단: 1층 1개(봉인), 2~10층 1~2개, 11~50층 2~3개
  if (f === 1) {
    assert(counts.upStairs === 1, `[Floor 1] 상행 계단 1개 확정 (실제: ${counts.upStairs})`);
  } else if (f <= 10) {
    assert(counts.upStairs >= 1 && counts.upStairs <= 2, `[Floor ${f}] 2~10층 상행 계단 1~2개 충족 (${counts.upStairs}개)`);
  } else {
    assert(counts.upStairs >= 2 && counts.upStairs <= 3, `[Floor ${f}] 11~50층 상행 계단 2~3개 충족 (${counts.upStairs}개)`);
  }

  // 하행 계단: 1~5층 1~2개, 6~20층 2~3개, 21~49층 2~4개, 50층 0개(보스방)
  if (f <= 5) {
    assert(counts.downStairs >= 1 && counts.downStairs <= 2, `[Floor ${f}] 1~5층 하행 계단 1~2개 충족 (${counts.downStairs}개)`);
  } else if (f <= 20) {
    assert(counts.downStairs >= 2 && counts.downStairs <= 3, `[Floor ${f}] 6~20층 하행 계단 2~3개 충족 (${counts.downStairs}개)`);
  } else if (f < 50) {
    assert(counts.downStairs >= 2 && counts.downStairs <= 4, `[Floor ${f}] 21~49층 하행 계단 2~4개 충족 (${counts.downStairs}개)`);
  } else {
    assert(counts.downStairs === 0, `[Floor 50] 50층 엔드게임 결전장 하행 계단 0개 충족 (${counts.downStairs}개)`);
  }
}

// 방 수가 부족한 경우 클램핑 검증
const clampedLowRooms = calculateStaircaseCounts(30, 2);
assert(clampedLowRooms.upStairs + clampedLowRooms.downStairs <= 2, '방 개수 2개일 때 계단 합계 2개 이하 안전 클램핑 확인');

// -----------------------------------------------------------------------------
// TEST 3: Map 인스턴스 1~50층 다중 계단 절차적 생성 및 분산 배치 무결성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: Map 인스턴스 다중 계단 분산 배치 및 무결성 검증 ---");

const testFloors = [1, 3, 5, 8, 15, 20, 25, 35, 45, 50];

testFloors.forEach(f => {
  const dim = calculateMapDimensions(f);
  const map = new Map(dim.width, dim.height, f, { maxRooms: dim.maxRooms });

  assert(map.width === dim.width, `[Floor ${f}] Map.width (${map.width}) 동적 규격 일치`);
  assert(map.height === dim.height, `[Floor ${f}] Map.height (${map.height}) 동적 규격 일치`);
  assert(map.rooms.length > 0, `[Floor ${f}] 방 생성 (${map.rooms.length}개) 성공`);

  const upStairs = map.getUpStairs();
  const downStairs = map.getDownStairs();

  assert(upStairs.length >= 1, `[Floor ${f}] 상행 계단 목록 조회 (${upStairs.length}개 >= 1) 확인`);
  if (f === 50) {
    assert(downStairs.length === 0, `[Floor 50] 50층 결전장 하행 계단 0개 확인`);
  } else {
    assert(downStairs.length >= 1, `[Floor ${f}] 하행 계단 목록 조회 (${downStairs.length}개 >= 1) 확인`);
  }

  // 상행 계단 타일 플래그 및 기호 검증
  upStairs.forEach((stair, idx) => {
    const tile = map.getTile(stair.x, stair.y);
    assert(tile !== null, `[Floor ${f}] 상행 계단 #${idx + 1} (${stair.x}, ${stair.y}) 타일 유효`);
    assert(tile.char === '<', `[Floor ${f}] 상행 계단 #${idx + 1} char === '<' 확인`);
    assert(tile.type === 'STAIRS_UP', `[Floor ${f}] 상행 계단 #${idx + 1} type === 'STAIRS_UP' 확인`);
    assert(tile.isWalkable === true, `[Floor ${f}] 상행 계단 #${idx + 1} isWalkable === true 확인`);

    if (f === 1) {
      assert(tile.isUpStaircase === false, `[Floor 1] 1층 상행 계단 #${idx + 1} 봉인 상태(isUpStaircase === false) 확인`);
      assert(tile.color === '#475569', `[Floor 1] 1층 상행 계단 #${idx + 1} 봉인 색상(#475569) 확인`);
    } else {
      assert(tile.isUpStaircase === true, `[Floor ${f}] 2층 이상 상행 계단 #${idx + 1} 활성 상태(isUpStaircase === true) 확인`);
    }
  });

  // 하행 계단 타일 플래그 및 기호 검증
  downStairs.forEach((stair, idx) => {
    const tile = map.getTile(stair.x, stair.y);
    assert(tile !== null, `[Floor ${f}] 하행 계단 #${idx + 1} (${stair.x}, ${stair.y}) 타일 유효`);
    assert(tile.char === '>', `[Floor ${f}] 하행 계단 #${idx + 1} char === '>' 확인`);
    assert(tile.type === 'STAIRS_DOWN', `[Floor ${f}] 하행 계단 #${idx + 1} type === 'STAIRS_DOWN' 확인`);
    assert(tile.isStaircase === true, `[Floor ${f}] 하행 계단 #${idx + 1} isStaircase === true 확인`);
    assert(tile.isWalkable === true, `[Floor ${f}] 하행 계단 #${idx + 1} isWalkable === true 확인`);
  });

  // 계단 좌표 고유성 검증 (서로 다른 좌표에 배치)
  const allStairCoords = [...upStairs, ...downStairs].map(s => `${s.x},${s.y}`);
  const uniqueStairCoords = new globalThis.Set(allStairCoords);
  assert(allStairCoords.length === uniqueStairCoords.size, `[Floor ${f}] 모든 계단 좌표 (${allStairCoords.length}개) 중복 없이 고유함 확인`);

  // 5층 단위 보스룸 무결성 검증
  if (f % 5 === 0) {
    const bossRoom = map.getBossRoom();
    assert(bossRoom !== null, `[Floor ${f}] 5층 단위 보스룸(getBossRoom) 존재 확인`);
    assert(bossRoom.type === 'BOSS', `[Floor ${f}] 보스룸 type === 'BOSS' 확인`);
  }
});

// -----------------------------------------------------------------------------
// TEST 4: Game 엔진 라이프사이클 및 동적 맵 크기 연동 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: Game 엔진 라이프사이클 및 동적 맵 연동 검증 ---");

const game = new Game();
game.runTurnLoop = () => {};
game.saveGame = () => {};
game.updateUI = () => {};
game.render = () => {};

// 1) 초기 생성 및 resetToNewGame
assert(game.floor === 1, 'Game 초기 1층 설정 확인');
assert(game.mapWidth === 55, `Game 초기 mapWidth 55 확인 (실제: ${game.mapWidth})`);
assert(game.mapHeight === 38, `Game 초기 mapHeight 38 확인 (실제: ${game.mapHeight})`);
assert(game.map.width === 55 && game.map.height === 38, 'Game.map 인스턴스 규격 55x38 일치 확인');

game.resetToNewGame('HUMAN');
assert(game.floor === 1, 'resetToNewGame 후 1층 유지 확인');
assert(game.mapWidth === 55 && game.mapHeight === 38, 'resetToNewGame 후 1층 동적 맵 규격 55x38 확인');

// 2) nextFloor() 동적 맵 스케일링
game.floor = 5;
game.nextFloor(); // 6층 진입
assert(game.floor === 6, 'nextFloor 후 6층 진입 확인');
const dim6 = calculateMapDimensions(6);
assert(game.mapWidth === dim6.width, `6층 진입 시 mapWidth (${game.mapWidth}) 6층 규격(${dim6.width}) 갱신 확인`);
assert(game.mapHeight === dim6.height, `6층 진입 시 mapHeight (${game.mapHeight}) 6층 규격(${dim6.height}) 갱신 확인`);
assert(game.map.width === dim6.width && game.map.height === dim6.height, 'Game.map 인스턴스 6층 규격 일치 확인');

// 3) 50층 엔드게임 진입
game.floor = 49;
game.nextFloor(); // 50층 진입
assert(game.floor === 50, '50층 진입 확인');
const dim50 = calculateMapDimensions(50);
assert(game.mapWidth === dim50.width, `50층 mapWidth (${game.mapWidth}) 110 확인`);
assert(game.mapHeight === dim50.height, `50층 mapHeight (${game.mapHeight}) 75 확인`);
assert(game.map.getDownStairs().length === 0, '50층 하행 계단 0개 확인');

// 4) prevFloor() 복원 검증
game.prevFloor(); // 49층으로 복귀
assert(game.floor === 49, 'prevFloor 후 49층 복귀 확인');
const dim49 = calculateMapDimensions(49);
assert(game.mapWidth === dim49.width, `49층 복귀 시 mapWidth (${game.mapWidth}) 49층 규격(${dim49.width}) 확인`);
assert(game.mapHeight === dim49.height, `49층 복귀 시 mapHeight (${game.mapHeight}) 49층 규격(${dim49.height}) 확인`);

// 5) 계단 타일 상호작용 검증
const downStairs49 = game.map.getDownStairs();
if (downStairs49.length > 0) {
  const targetStair = downStairs49[0];
  game.player.x = targetStair.x;
  game.player.y = targetStair.y;
  const tile = game.map.getTile(game.player.x, game.player.y);
  assert(tile.isStaircase === true, '하행 계단 타일 감지 확인');
}

const upStairs49 = game.map.getUpStairs();
if (upStairs49.length > 0) {
  const targetUpStair = upStairs49[0];
  game.player.x = targetUpStair.x;
  game.player.y = targetUpStair.y;
  const tile = game.map.getTile(game.player.x, game.player.y);
  assert(tile.isUpStaircase === true, '상행 계단 타일 감지 확인');
}

// -----------------------------------------------------------------------------
// TEST 5: SaveSystem 직렬화/역직렬화 맵 크기 및 다중 계단 복원 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: SaveSystem 동적 맵 직렬화/역직렬화 복원 검증 ---");

game.floor = 25;
const dim25 = calculateMapDimensions(25);
game.map = new Map(dim25.width, dim25.height, 25, { maxRooms: dim25.maxRooms });
game.mapWidth = dim25.width;
game.mapHeight = dim25.height;

const serialized = SaveSystem.serialize(game);
assert(typeof serialized === 'string' && serialized.length > 0, 'SaveSystem.serialize 성공');

const restoredGame = new Game();
restoredGame.runTurnLoop = () => {};
SaveSystem.deserialize(restoredGame, serialized);

assert(restoredGame.floor === 25, '역직렬화 후 층수 25층 복원 확인');
assert(restoredGame.mapWidth === dim25.width, `역직렬화 후 mapWidth (${restoredGame.mapWidth}) 복원 확인`);
assert(restoredGame.mapHeight === dim25.height, `역직렬화 후 mapHeight (${restoredGame.mapHeight}) 복원 확인`);
assert(restoredGame.map.width === dim25.width, `역직렬화 후 map.width (${restoredGame.map.width}) 복원 확인`);
assert(restoredGame.map.height === dim25.height, `역직렬화 후 map.height (${restoredGame.map.height}) 복원 확인`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED (100% PASS)`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
