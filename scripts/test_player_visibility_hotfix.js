/**
 * scripts/test_player_visibility_hotfix.js
 * Comprehensive Unit Test Suite for Player Visibility Hotfix & Rendering Integrity
 *
 * Verifies:
 * 1. Player entity constructor property completeness (isPlayer: true, name: 'Player', char: '@', color: '#34d399', body: MimicBody)
 * 2. Voxel3DRenderer drawEntity() isPlayer detection guard & 100% visibility guarantee
 * 3. Classic2DAsciiRenderer drawEntity() isPlayer detection guard & 100% visibility guarantee
 * 4. Distinct handling between Player and standard Monsters (no monster misidentification)
 * 5. Player pick() hit-test integrity on both 3D and 2D renderers
 * 6. Core morphing / swap player identity and visibility retention
 * 7. VoxelMimicBridge chromatic palette support for player entity
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { MimicBody } from '../src/entities/MimicBody.js';
import { getSpeciesConfig, LEGACY_TOME_ALIASES_MAP } from '../src/entities/MonsterRegistry.js';
import { Voxel3DRenderer } from '../src/renderer/Voxel3DRenderer.js';
import { Classic2DAsciiRenderer } from '../src/renderer/Classic2DAsciiRenderer.js';
import { VoxelMimicBridge } from '../src/entities/VoxelMimicBridge.js';
import { TERM_COLORS } from '../src/configs/ThemeColors.js';

console.log("================================================================================");
console.log("🌟 [PLAYER VISIBILITY HOTFIX & RENDERING INTEGRITY TEST SUITE] 🌟");
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
// Canvas and DOM Mocking for Node.js Headless Environment
// -----------------------------------------------------------------------------
const drawCalls = [];
const textCalls = [];

const mockCtx = {
  fillRect: (x, y, w, h) => { drawCalls.push({ type: 'fillRect', x, y, w, h }); },
  fillText: (text, x, y) => { textCalls.push({ text, x, y, font: mockCtx.font, fillStyle: mockCtx.fillStyle }); },
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  setTransform: () => {},
  scale: () => {},
  rotate: () => {},
  translate: () => {},
  font: '',
  fillStyle: '',
  strokeStyle: '',
  textAlign: '',
  textBaseline: '',
  lineWidth: 1
};

const mockCanvas = {
  getContext: () => mockCtx,
  clientWidth: 800,
  clientHeight: 600,
  width: 800,
  height: 600,
  style: {},
  parentElement: { clientWidth: 800, clientHeight: 600 },
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: (id) => mockCanvas,
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      addEventListener: () => {},
      appendChild: () => {}
    }),
    body: { appendChild: () => {} }
  };
}

if (typeof global.window === 'undefined') {
  global.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: () => {}
  };
}

// -----------------------------------------------------------------------------
// TEST 1: Player Constructor Properties Completeness
// -----------------------------------------------------------------------------
console.log("--- TEST 1: Player 생성자 기본 프로퍼티 완비 검증 ---");
const player = new Player(12, 18);

assert(player.isPlayer === true, `player.isPlayer === true 확인 (${player.isPlayer})`);
assert(player.name === 'Player', `player.name === 'Player' 확인 ('${player.name}')`);
assert(player.char === '@', `시작 인간 코어 시 플레이어 기본 글리프가 '@' 확인 ('${player.char}')`);
assert(player.color === '#34d399', `시작 인간 코어 시 기본 색상이 선명한 민트 '#34d399' 확인 ('${player.color}')`);
assert(player.body instanceof MimicBody, `player.body가 MimicBody 인스턴스로 정상 구비 확인`);
assert(player.mimicCore.coreType === 'MON_NOVICE_WARRIOR', `기본 코어 타입이 MON_NOVICE_WARRIOR 확인`);
assert(player.x === 12 && player.y === 18, `시작 좌표 (12, 18) 정상 설정 확인`);

// -----------------------------------------------------------------------------
// TEST 2: Voxel3DRenderer 3D 렌더링 가드 & 100% 가시성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: Voxel3DRenderer 플레이어 렌더링 가드 및 100% 가시성 검증 ---");
const renderer3D = new Voxel3DRenderer('test-canvas', 20);

// Mock Map
const mockDarkMap = {
  width: 40,
  height: 40,
  getTile: (x, y) => ({ isWalkable: true, isExplored: false, type: 'FLOOR' }),
  isWalkable: () => true,
  isTransparent: () => false // 완전히 가려진 암흑 맵
};
renderer3D.map = mockDarkMap;

// Reset call logs
textCalls.length = 0;

// Draw player in complete darkness / zero light range
renderer3D.drawEntity(player, 12, 18, player.x, player.y, 0, false);

assert(textCalls.length > 0, `암흑/시야 0 상태에서도 플레이어 drawEntity 호출 시 렌더링 수행 확인`);
const renderedGlyph3D = textCalls.find(c => c.text === '@');
assert(renderedGlyph3D !== undefined, `3D 렌더러에서 플레이어 글리프 '@' 정상 출력 확인`);
const renderedLabel3D = textCalls.find(c => c.text === 'Lv.1 MIMIC');
assert(renderedLabel3D !== undefined, `3D 렌더러에서 골드 레벨 라벨 'Lv.1 MIMIC' 정상 출력 확인`);
assert(renderedLabel3D && renderedLabel3D.fillStyle === TERM_COLORS.TERM_YELLOW, `레벨 라벨이 골드/옐로우 (${TERM_COLORS.TERM_YELLOW}) 색상으로 렌더링 확인`);

// -----------------------------------------------------------------------------
// TEST 3: Classic2DAsciiRenderer 2D 렌더링 가드 & 100% 가시성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: Classic2DAsciiRenderer 플레이어 렌더링 가드 및 100% 가시성 검증 ---");
const renderer2D = new Classic2DAsciiRenderer('test-canvas', 24);
renderer2D.map = mockDarkMap;

// Reset call logs
textCalls.length = 0;

// Draw player in complete darkness
renderer2D.drawEntity(player, 12, 18, player.x, player.y, 0, false);

assert(textCalls.length > 0, `암흑/시야 0 상태에서도 2D 렌더러 플레이어 drawEntity 정상 출력 확인`);
const renderedGlyph2D = textCalls.find(c => c.text === '@');
assert(renderedGlyph2D !== undefined, `2D 렌더러에서 플레이어 글리프 '@' 정상 출력 확인`);
const renderedLabel2D = textCalls.find(c => c.text === 'Lv.1 MIMIC');
assert(renderedLabel2D !== undefined, `2D 렌더러에서 골드 레벨 라벨 'Lv.1 MIMIC' 정상 출력 확인`);
assert(renderedLabel2D && renderedLabel2D.fillStyle === TERM_COLORS.TERM_YELLOW, `2D 레벨 라벨이 골드/옐로우 (${TERM_COLORS.TERM_YELLOW}) 색상으로 렌더링 확인`);

// -----------------------------------------------------------------------------
// TEST 4: Monster Misidentification Prevention Guard
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 일반 몬스터와 플레이어 식별 분리 및 가시성 가드 검증 ---");
const noviceMonster = new Monster(12, 25, 'MON_NOVICE_WARRIOR', 1);

// Test monster in darkness (should NOT be visible when map is blocked)
textCalls.length = 0;
renderer3D.drawEntity(noviceMonster, 12, 18, player.x, player.y, 0, false);
assert(textCalls.length === 0, `시야 밖/벽 뒤의 일반 몬스터는 렌더링되지 않음 (isVisible = false 가드 작동)`);

// Test monster in clear vision
const mockClearMap = {
  width: 40,
  height: 40,
  getTile: (x, y) => ({ isWalkable: true, isExplored: true, type: 'FLOOR' }),
  isWalkable: () => true,
  isTransparent: () => true
};
renderer3D.map = mockClearMap;

textCalls.length = 0;
renderer3D.drawEntity(noviceMonster, 12, 18, player.x, player.y, 10, false);
const monGlyph = textCalls.find(c => c.text === noviceMonster.char);
assert(monGlyph !== undefined, `시야 내 일반 몬스터는 몬스터 글리프('${noviceMonster.char}')로 정상 출력`);
const monLabel = textCalls.find(c => c.text === noviceMonster.name);
assert(monLabel !== undefined, `몬스터 라벨은 몬스터 이름('${noviceMonster.name}')으로 출력되며 'Lv.1 MIMIC'이 아님`);
assert(!textCalls.some(c => c.text.includes('MIMIC')), `일반 몬스터에 플레이어 전용 MIMIC 라벨이 미부착됨을 확인`);

// -----------------------------------------------------------------------------
// TEST 5: Player pick() Hit-Testing Integrity on 3D & 2D Renderers
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 3D 및 2D 렌더러 pick() 플레이어 본체 역피킹 검증 ---");
renderer3D.snapCamera(player.x, player.y);
renderer2D.snapCamera(player.x, player.y);

// Center screen coordinates (400, 300) should pick player
const picked3D = renderer3D.pick(400, 300, [noviceMonster], [], player, mockClearMap);
assert(picked3D !== null && picked3D.type === 'player' && picked3D.data === player, `3D 렌더러 화면 중심 클릭 시 player 객체 정상 피킹 확인`);

const picked2D = renderer2D.pick(400, 300, [noviceMonster], [], player, mockClearMap);
assert(picked2D !== null && picked2D.type === 'player' && picked2D.data === player, `2D 렌더러 화면 중심 클릭 시 player 객체 정상 피킹 확인`);

// -----------------------------------------------------------------------------
// TEST 6: Core Swap / Morphing Player Identity & Visibility Retention
// -----------------------------------------------------------------------------
console.log("\n--- TEST 6: 메인 코어 변신/교체 시 플레이어 정체성 및 렌더링 무결성 유지 검증 ---");
const dragonCoreItem = new Item(player.x, player.y, 'CORE', '*', '#ef4444', '성체 드래곤 코어', 0, null, {}, null, 'MON_MATURE_RED_DRAGON');
const logs = [];
player.doSwapMainCore(dragonCoreItem, (msg) => logs.push(msg));

assert(player.isPlayer === true, `드래곤 코어로 환생 후에도 player.isPlayer === true 유지`);
assert(player.name === 'Player', `환생 후에도 player.name === 'Player' 유지`);
assert(player.mimicCore.coreType === 'MON_MATURE_RED_DRAGON', `메인 코어가 MON_MATURE_RED_DRAGON으로 교체됨`);
assert(player.char === 'd', `드래곤 코어 변신 시 글리프가 'd'로 변경됨`);

// Verify 3D rendering after morph
textCalls.length = 0;
renderer3D.drawEntity(player, player.x, player.y, player.x, player.y, 5, false);
const morphedGlyph = textCalls.find(c => c.text === 'd');
assert(morphedGlyph !== undefined, `변신 후 3D 렌더러에서 'd' 글리프 정상 렌더링 확인`);
const morphedLabel = textCalls.find(c => c.text === 'Lv.1 MIMIC');
assert(morphedLabel !== undefined, `변신 후에도 골드 레벨 라벨 'Lv.1 MIMIC' 정상 렌더링 확인`);

// -----------------------------------------------------------------------------
// TEST 7: VoxelMimicBridge Chromatic Palette Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST 7: VoxelMimicBridge 크로매틱 셰이딩 지원 검증 ---");
const chromatic = VoxelMimicBridge.getEntityChromatic(player, 1.0);
assert(chromatic !== null, `VoxelMimicBridge.getEntityChromatic(player) 결과 객체 반환 확인`);
assert(Array.isArray(chromatic.colors) && chromatic.colors.length > 0, `크로매틱 색상 배열 유효 확인 (총 ${chromatic.colors.length}색)`);
assert(chromatic.colors.includes('#ef4444'), `드래곤 폼 크로매틱 색상에 화염 레드 (#ef4444) 포함 확인`);

console.log("\n================================================================================");
console.log(`🎉 ALL PLAYER VISIBILITY HOTFIX TESTS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
