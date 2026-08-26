/**
 * scripts/test_title_buttons.js
 * Test Suite for Title Screen / Main Menu Button Clicking Lifecycle & Integrated Action Bar Auto-Fire Button
 */

import { Game } from '../src/core/Game.js';
import { Player } from '../src/entities/Player.js';
import { updateFloatingAutoFireButton } from '../src/ui/HUDView.js';
import { eventBus } from '../src/events/EventBus.js';
import { GameEvents } from '../src/events/GameEvents.js';

console.log("================================================================================");
console.log("🎮 [TITLE SCREEN & INTEGRATED ACTION BAR BUTTON LIFECYCLE TEST SUITE] 🎮");
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
// SETUP: Headless DOM Environment Simulation
// -----------------------------------------------------------------------------
class MockDOMElement {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.style = {};
    this.classList = {
      _classes: new Set(className ? className.split(' ') : []),
      contains: (c) => this.classList._classes.has(c),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c)
    };
    this.attributes = {};
    this.onclick = null;
    this.innerHTML = '';
    this.innerText = '';
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(evt, handler) {
    if (evt === 'click') this.onclick = handler;
  }
  querySelector(sel) {
    if (sel === '#autofire-badge') return domElements.get('autofire-badge');
    return null;
  }
  closest() { return null; }
  appendChild(child) {
    if (child && child.id) {
      domElements.set(child.id, child);
    }
  }
}

const domElements = new Map();
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
        stroke: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        clearRect: () => {},
        strokeRect: () => {},
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        scale: () => {},
        translate: () => {},
        measureText: () => ({ width: 10 })
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

// Pre-populate game canvas
getOrCreateElem('game-canvas');

// Pre-populate standard index.html / ascii.html DOM elements
const overlay = getOrCreateElem('main-menu-overlay');
const primaryActions = getOrCreateElem('menu-primary-actions');
const slotSelection = getOrCreateElem('menu-slot-selection', 'hidden');
const slotTitle = getOrCreateElem('slot-modal-title');
const coreSelection = getOrCreateElem('menu-core-selection', 'hidden');
const newGameBtn = getOrCreateElem('menu-new-game-btn');
const loadGameBtn = getOrCreateElem('menu-load-game-btn');
const slotBackBtn = getOrCreateElem('menu-slot-back-btn');
const coreBackBtn = getOrCreateElem('menu-core-back-btn');

// Pre-populate Action Bar Auto-Fire Icon Button
const topRow = getOrCreateElem('action-top-row', 'action-top-row');
const autofireBtn = getOrCreateElem('btn-autofire-toggle', 'action-btn autofire-icon-btn hidden');
const autofireBadge = getOrCreateElem('autofire-badge', 'autofire-badge');

const slotBtns = [];
for (let i = 1; i <= 8; i++) {
  const slotBtn = new MockDOMElement(`slot${i}-btn`, 'sys-btn slot-select-btn');
  slotBtn.setAttribute('data-slot', `slot${i}`);
  slotBtns.push(slotBtn);
  getOrCreateElem(`slot${i}-info`);
}

const coreHumanBtn = new MockDOMElement('core-human-btn', 'sys-btn core-select-btn');
coreHumanBtn.setAttribute('data-core', 'HUMAN');
const coreImpBtn = new MockDOMElement('core-imp-btn', 'sys-btn core-select-btn');
coreImpBtn.setAttribute('data-core', 'IMP');
const coreBtns = [coreHumanBtn, coreImpBtn];

global.document = {
  getElementById: (id) => domElements.get(id) || null,
  createElement: (tag) => new MockDOMElement('', ''),
  querySelector: (sel) => {
    if (sel === '.action-top-row') return topRow;
    if (sel === '#btn-autofire-toggle') return autofireBtn;
    return null;
  },
  querySelectorAll: (selector) => {
    if (selector === '.slot-select-btn') return slotBtns;
    if (selector === '.core-select-btn') return coreBtns;
    return [];
  },
  body: {
    appendChild: (el) => {
      if (el && el.id) domElements.set(el.id, el);
    }
  },
  addEventListener: () => {}
};

global.window = {
  innerWidth: 800,
  innerHeight: 600,
  addEventListener: () => {},
  location: { search: '' },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  }
};

// -----------------------------------------------------------------------------
// TEST 1: Auto-Fire Button Isolation (Hidden during Main Menu / Title Screen)
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 타이틀 화면 중 액션 바 자동사격 아이콘 버튼 노출 차단 검증 ---");

const testPlayer = new Player(10, 10);
testPlayer.initializeStartingInventory();

const mockGame = {
  isMainMenuOpen: true,
  player: testPlayer
};

updateFloatingAutoFireButton(testPlayer, mockGame);
assert(autofireBtn.classList.contains('hidden') || autofireBtn.style.display === 'none', `타이틀 화면 (isMainMenuOpen: true) 상태에서 자동사격 아이콘 버튼 완벽 은폐 (hidden)`);

// -----------------------------------------------------------------------------
// TEST 2: Title Screen Initialization & showMainMenu() Execution
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: Game.showMainMenu() 초기화 및 이벤트 리스너 바인딩 검증 ---");

const game = new Game();
assert(game.isMainMenuOpen === true, `Game 초기 상태에서 isMainMenuOpen === true 확인`);

game.showMainMenu();

assert(typeof newGameBtn.onclick === 'function', `[새 모험 시작하기] 버튼에 클릭 이벤트 리스너 정상 바인딩`);
assert(typeof loadGameBtn.onclick === 'function', `[모험 이어하기] 버튼에 클릭 이벤트 리스너 정상 바인딩`);
assert(typeof slotBackBtn.onclick === 'function', `[슬롯 돌아가기] 버튼에 클릭 이벤트 리스너 정상 바인딩`);
assert(typeof coreBackBtn.onclick === 'function', `[코어 돌아가기] 버튼에 클릭 이벤트 리스너 정상 바인딩`);

// -----------------------------------------------------------------------------
// TEST 3: '새 모험 시작하기' 클릭 -> 슬롯 선택 -> 코어 선택 -> 인게임 진입 라이프사이클
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: '새 모험 시작하기' -> 슬롯1 -> 인간 여행자 코어 클릭 전체 플로우 검증 ---");

// Step 1: Click '새 모험 시작하기'
newGameBtn.onclick({ stopPropagation: () => {} });
assert(primaryActions.classList.contains('hidden'), `1단계: '새 모험 시작하기' 클릭 시 1차 메뉴 숨김`);
assert(!slotSelection.classList.contains('hidden'), `1단계: 저장 슬롯 선택창 노출 (slot-selection open)`);
assert(slotTitle.innerText.includes('새 게임'), `1단계: 슬롯 모달 타이틀이 '새 게임'으로 변경 확인`);

// Step 2: Click 'Slot 1'
slotBtns[0].onclick({ stopPropagation: () => {} });
assert(game.currentSlot === 'slot1', `2단계: 슬롯 1 선택 저장 확인 (currentSlot: 'slot1')`);
assert(slotSelection.classList.contains('hidden'), `2단계: 슬롯 선택창 숨김`);
assert(!coreSelection.classList.contains('hidden'), `2단계: 시작 코어 선택창 노출 (core-selection open)`);

// Step 3: Click '인간 여행자 (HUMAN)' Core
coreBtns[0].onclick({ stopPropagation: () => {} });
assert(game.isMainMenuOpen === false, `3단계: 코어 선택 후 isMainMenuOpen === false 전환 확인`);
assert(overlay.style.display === 'none', `3단계: 타이틀 오버레이 완전 닫힘 (display: 'none')`);
assert(game.player !== null && game.player.equipment.bow !== null, `3단계: 신규 모험 캐릭터 및 스타터 키트 생성 완료`);

// -----------------------------------------------------------------------------
// TEST 4: 인게임 진입 후 통합 액션 바 [🏹] 아이콘 버튼 정상 활성화 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 인게임 진입 후 액션 바 [🏹] 아이콘 버튼 활성화 검증 ---");

updateFloatingAutoFireButton(game.player, game);
assert(!autofireBtn.classList.contains('hidden') && autofireBtn.style.display === 'flex', `인게임 진입 (isMainMenuOpen: false) 후 액션 바 아이콘 버튼 정상 노출 (display: 'flex')`);
assert(!autofireBtn.classList.contains('is-disabled'), `기본 자동사격 ON 상태에서 활성화 스타일 적용`);

// -----------------------------------------------------------------------------
// TEST 5: EventBus Pub/Sub 연동 (EQUIPMENT_CHANGE, AUTOFIRE_TOGGLE, TITLE_SCREEN)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: EventBus Pub/Sub 이벤트 반응형 UI 동기화 검증 ---");

// Test toggle auto fire
game.toggleAutoFire();
assert(game.player.autoFireEnabled === false, `단축키/버튼 토글 시 autoFireEnabled === false 전환`);
updateFloatingAutoFireButton(game.player, game);
assert(autofireBtn.classList.contains('is-disabled'), `토글 OFF 시 아이콘 버튼 is-disabled 스타일 적용`);

// Test return to title screen event
eventBus.emit(GameEvents.TITLE_SCREEN, { game });
assert(autofireBtn.classList.contains('hidden') || autofireBtn.style.display === 'none', `TITLE_SCREEN 이벤트 수신 시 아이콘 버튼 즉시 은폐 (hidden)`);

// -----------------------------------------------------------------------------
// TEST 6: '모험 이어하기' 클릭 -> 뒤로가기 네비게이션 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 6: '모험 이어하기' 및 뒤로가기 버튼 네비게이션 검증 ---");

game.showMainMenu();
assert(game.isMainMenuOpen === true, `showMainMenu 재호출 시 isMainMenuOpen === true 리셋 확인`);

// Click '모험 이어하기'
loadGameBtn.onclick({ stopPropagation: () => {} });
assert(primaryActions.classList.contains('hidden'), `'모험 이어하기' 클릭 시 1차 메뉴 숨김`);
assert(!slotSelection.classList.contains('hidden'), `저장 슬롯 선택창 노출`);
assert(slotTitle.innerText.includes('불러올'), `슬롯 모달 타이틀이 '불러올'로 변경 확인`);

// Click '뒤로 가기'
slotBackBtn.onclick({ stopPropagation: () => {} });
assert(!primaryActions.classList.contains('hidden'), `뒤로가기 클릭 시 1차 메뉴 복귀 확인`);
assert(slotSelection.classList.contains('hidden'), `슬롯 선택창 다시 숨김 확인`);

console.log("\n================================================================================");
console.log(`🎉 ALL TITLE BUTTON & INTEGRATED ACTION BAR TESTS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
