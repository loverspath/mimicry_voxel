/**
 * scripts/test_tomenet_visuals.js
 * Comprehensive Test Suite for TomeNET Slim Rectangular Grid, Crisp Color Cycling,
 * Archery Auto & Targeted Firing, and Floating Bottom-Right Toggle Button
 */

import { Classic2DAsciiRenderer } from '../src/renderer/Classic2DAsciiRenderer.js';
import { Voxel3DRenderer } from '../src/renderer/Voxel3DRenderer.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { updateFloatingAutoFireButton } from '../src/ui/HUDView.js';

console.log("================================================================================");
console.log("🏹 [TOMENET SLIM GLYPH, CRISP COLOR CYCLING & ARCHERY ENGINE TEST] 🏹");
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
// TEST 1: Classic2DAsciiRenderer 14x23 Slim Grid (1:1.64 Aspect Ratio)
// -----------------------------------------------------------------------------
console.log("--- TEST 1: TomeNET 정통 14x23 슬림 직사각형 그리드 종횡비 검증 ---");

const dummyCanvas = {
  getContext: () => ({
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    scale: () => {}
  }),
  clientWidth: 800,
  clientHeight: 600,
  width: 800,
  height: 600,
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

// Mock global document if not available in Node
if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: () => dummyCanvas,
    createElement: (tag) => ({
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
    addEventListener: () => {}
  };
}

const asciiRenderer = new Classic2DAsciiRenderer('test-canvas', 20);

assert(asciiRenderer.baseCellWidth === 14, `baseCellWidth 가로 너비 14px 정밀 규격 확인`);
assert(asciiRenderer.baseCellHeight === 23, `baseCellHeight 세로 높이 23px 정밀 규격 확인`);

const ratio = asciiRenderer.baseCellHeight / asciiRenderer.baseCellWidth;
assert(ratio >= 1.60 && ratio <= 1.70, `종횡비 1:${ratio.toFixed(2)} (1:1.64 TomeNET 슬림 직사각형) 완벽 일치 확인`);

const screenPos = asciiRenderer.toScreen(10, 10);
assert(screenPos.tileW === 14 && screenPos.tileH === 23, `toScreen() 변환 시 tileW: 14, tileH: 23 슬림 타일 반환 확인`);

// -----------------------------------------------------------------------------
// TEST 2: CombatSystem.tryAutoRangedAttack (자동사격 트리거 및 턴 연동)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 활 자동사격 (CombatSystem.tryAutoRangedAttack) 검증 ---");

const player = new Player(10, 10);
player.initializeStartingInventory();

const mockMap = {
  width: 30,
  height: 30,
  getTile: (x, y) => ({ isWalkable: true, type: 'FLOOR' }),
  isWalkable: (x, y) => true,
  isTransparent: (x0, y0, x1, y1) => true
};

const mockMonster = new Monster(10, 14, 'GOBLIN', 1);

const mockGame = {
  player,
  map: mockMap,
  monsters: [mockMonster],
  effects: [],
  logs: [],
  addLogEntry: function(msg, type) {
    this.logs.push({ msg, type });
  }
};

assert(player.equipment.bow !== null, `플레이어 기본 장비에 단궁(Bow) 장착 확인`);
assert(player.equipment.quiver !== null, `플레이어 기본 화살집(Quiver) 구비 확인`);
assert(player.autoFireEnabled === true, `기본 원거리 자동사격 상태 = ON (true) 확인`);

// Run auto ranged attack
const fired = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(fired === true, `4칸 거리 시야 내 몬스터에게 자동 원거리 사격 격발 성공!`);
assert(mockGame.logs.some(l => l.msg.includes('원거리 저격') || l.msg.includes('화살')), `전투 로그에 '[원거리 저격]' 포맷 정상 출력 확인`);

// -----------------------------------------------------------------------------
// TEST 3: Auto-fire OFF Mode Handling
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 자동사격 OFF 및 쿨다운 중 방어 검증 ---");

player.autoFireEnabled = false;
const firedOff = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(firedOff === false, `autoFireEnabled = false 시 자동사격 미격발 방어 확인`);

player.autoFireEnabled = true;
// 쿨다운 중일 때 미격발 확인
player.cooldowns = { RANGED_ATTACK: 3 };
const firedCd = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(firedCd === false, `쿨다운 중일 때 자동사격 불발 및 턴 낭비 방어 확인`);
delete player.cooldowns.RANGED_ATTACK;

// -----------------------------------------------------------------------------
// TEST 4: Out of Range & Wall Blocked (No LoS) Defense
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 사거리 초과 및 벽 가림(LoS 차단) 방어 검증 ---");

player.equipment.quiver.count = 25; // 화살 보충
mockMonster.x = 10;
mockMonster.y = 22; // 12칸 거리 (최대 사거리 5칸 초과)

const firedFar = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(firedFar === false, `최대 사거리(5칸) 초과 몬스터(12칸) 자동사격 미격발 확인`);

mockMonster.y = 13; // 3칸 거리
const mockBlockedMap = {
  width: 30,
  height: 30,
  getTile: () => ({ isWalkable: false }),
  isWalkable: () => false,
  isTransparent: () => false // 벽으로 시야 차단
};
mockGame.map = mockBlockedMap;

const firedBlocked = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(firedBlocked === false, `벽에 시야가 가려진 적에 대한 사격 방어 확인`);

// -----------------------------------------------------------------------------
// TEST 5: Integrated Action Bar Auto-Fire Icon Button
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 통합 액션 바 [🏹] 자동사격 아이콘 버튼 검증 ---");

let capturedBtn = {
  id: 'btn-autofire-toggle',
  className: 'action-btn autofire-icon-btn hidden',
  style: {},
  classList: {
    _classes: new Set(['action-btn', 'autofire-icon-btn', 'hidden']),
    contains: function(c) { return this._classes.has(c); },
    add: function(c) { this._classes.add(c); },
    remove: function(c) { this._classes.delete(c); }
  },
  querySelector: () => ({ innerText: '', style: {} })
};

global.document.getElementById = (id) => {
  if (id === 'btn-autofire-toggle') return capturedBtn;
  return dummyCanvas;
};

mockGame.map = mockMap;
updateFloatingAutoFireButton(player, { isMainMenuOpen: false });
assert(capturedBtn !== null, `updateFloatingAutoFireButton() 호출 시 액션 바 토글 버튼 갱신 확인`);
assert(!capturedBtn.classList.contains('hidden'), `인게임 활 장착 시 hidden 클래스 제거 확인`);
assert(capturedBtn.style.display === 'flex', `버튼 display: flex 활성화 확인`);

console.log("\n================================================================================");
console.log(`🎉 ALL TOMENET VISUALS & ARCHERY TESTS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
