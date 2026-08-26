/**
 * scripts/test_start_and_continue_game.js
 * Comprehensive Test Suite for '새 모험 시작하기' (Start New Adventure) and '모험 이어하기' (Continue Adventure) Lifecycle,
 * SaveSystem StatusEffectEngine Proxy Preservation, Multi-Slot Management, and Try-Catch Error Guards.
 */

import { Game } from '../src/core/Game.js';
import { Player } from '../src/entities/Player.js';
import { SaveSystem, SAVE_SLOTS } from '../src/core/SaveSystem.js';
import { StatusEffectEngine } from '../src/systems/StatusEffectEngine.js';
import { eventBus } from '../src/events/EventBus.js';
import { GameEvents } from '../src/events/GameEvents.js';

console.log("================================================================================");
console.log("🎮 [START NEW GAME & CONTINUE GAME COMPREHENSIVE VERIFICATION SUITE] 🎮");
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
// HEADLESS DOM ENVIRONMENT SIMULATION
// -----------------------------------------------------------------------------
class MockDOMElement {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.style = {};
    this.classList = {
      _classes: new Set(className ? className.split(' ').filter(Boolean) : []),
      contains: (c) => this.classList._classes.has(c),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c)
    };
    this.attributes = {};
    this.onclick = null;
    this.innerHTML = '';
    this.innerText = '';
    this.children = [];
    this.scrollTop = 0;
    this.scrollHeight = 100;
  }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(evt, handler) {
    if (evt === 'click') this.onclick = handler;
  }
  querySelector(sel) {
    if (sel === '#autofire-badge') return domElements.get('autofire-badge');
    if (sel === '.log-bottom-spacer') return this.children.find(c => c.className === 'log-bottom-spacer') || null;
    return null;
  }
  closest() { return null; }
  appendChild(child) {
    if (child) {
      this.children.push(child);
      if (child.id) domElements.set(child.id, child);
    }
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      return this.children.splice(idx, 1)[0];
    }
    return null;
  }
  scrollIntoView() {}
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

// Setup Canvas & Key DOM elements
getOrCreateElem('game-canvas');
const overlay = getOrCreateElem('main-menu-overlay');
const primaryActions = getOrCreateElem('menu-primary-actions');
const slotSelection = getOrCreateElem('menu-slot-selection', 'hidden');
const slotTitle = getOrCreateElem('slot-modal-title');
const coreSelection = getOrCreateElem('menu-core-selection', 'hidden');
const newGameBtn = getOrCreateElem('menu-new-game-btn');
const loadGameBtn = getOrCreateElem('menu-load-game-btn');
const hofBtn = getOrCreateElem('menu-hof-btn');
const slotBackBtn = getOrCreateElem('menu-slot-back-btn');
const coreBackBtn = getOrCreateElem('menu-core-back-btn');
const combatLog = getOrCreateElem('combat-log');
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

// In-memory localStorage mock
const storageData = new Map();
global.localStorage = {
  getItem: (key) => storageData.get(key) || null,
  setItem: (key, val) => storageData.set(key, String(val)),
  removeItem: (key) => storageData.delete(key),
  clear: () => storageData.clear(),
  get length() { return storageData.size; },
  key: (i) => Array.from(storageData.keys())[i] || null
};

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
  localStorage: global.localStorage,
  showCrashBanner: (msg) => { console.warn("[MOCK CRASH BANNER]", msg); }
};

// =============================================================================
// TEST SUITE EXECUTION
// =============================================================================

// -----------------------------------------------------------------------------
// SECTION 1: Game Initialization & showMainMenu() Validation
// -----------------------------------------------------------------------------
console.log("--- 1. Game 초기화 및 Main Menu 진입 검증 ---");
const game = new Game();
assert(game.isMainMenuOpen === true, "Game 초기 상태에서 isMainMenuOpen === true");
assert(typeof game.showMainMenu === 'function', "Game.showMainMenu 메서드 존재");

game.showMainMenu();
assert(overlay.style.display === 'flex', "showMainMenu 호출 시 main-menu-overlay 표시 (display: flex)");
assert(!primaryActions.classList.contains('hidden'), "1차 메인 메뉴 버튼군(새 모험 / 이어하기) 노출");
assert(slotSelection.classList.contains('hidden'), "초기 상태에서 슬롯 선택창 숨김");
assert(coreSelection.classList.contains('hidden'), "초기 상태에서 코어 선택창 숨김");

for (let i = 1; i <= 8; i++) {
  const infoEl = domElements.get(`slot${i}-info`);
  assert(infoEl && infoEl.innerText === '비어 있음', `초기 슬롯${i} 상태: '비어 있음' 표시`);
}

// -----------------------------------------------------------------------------
// SECTION 2: '새 모험 시작하기' -> 슬롯1 -> 인간 여행자 (HUMAN) 전체 라이프사이클
// -----------------------------------------------------------------------------
console.log("\n--- 2. '새 모험 시작하기' -> 슬롯1 -> 인간 여행자 코어 시작 검증 ---");
newGameBtn.onclick({ stopPropagation: () => {} });
assert(primaryActions.classList.contains('hidden'), "'새 모험 시작하기' 클릭 시 1차 메뉴 숨김");
assert(!slotSelection.classList.contains('hidden'), "슬롯 선택창 표시");
assert(slotTitle.innerText.includes('새 게임'), "슬롯 타이틀이 '새 게임을 시작할 슬롯 선택'으로 변경");

// Select Slot 1
slotBtns[0].onclick({ stopPropagation: () => {} });
assert(game.currentSlot === 'slot1', "슬롯 1 선택 완료 (currentSlot: 'slot1')");
assert(slotSelection.classList.contains('hidden'), "슬롯 선택창 숨김");
assert(!coreSelection.classList.contains('hidden'), "코어 선택창 표시");

// Select HUMAN Core
coreBtns[0].onclick({ stopPropagation: () => {} });
assert(game.isMainMenuOpen === false, "코어 선택 후 isMainMenuOpen === false");
assert(overlay.style.display === 'none', "타이틀 오버레이 닫힘 (display: none)");
assert(game.player !== null, "플레이어 엔티티 생성 완료");
assert(game.player.char === '@', "인간 여행자 플레이어 문자 '@'");
assert(game.player.color === '#34d399', "인간 여행자 플레이어 색상 '#34d399'");
assert(game.player.equipment.weapon !== null, "시작 무기 장착 확인");
assert(game.player.equipment.bow !== null, "시작 원거리 활 장착 확인");
assert(game.player.equipment.quiver !== null, "시작 화살통 장착 확인");
assert(game.player.equipment.armor !== null, "시작 갑옷 장착 확인");
assert(game.player.equippedLamp !== null, "시작 횃불 장착 확인");
assert(game.floor === 1, "초기 층수: 1층");
assert(game.map.rooms.length > 0, `절차적 던전 방 생성 (${game.map.rooms.length}개 방)`);

// -----------------------------------------------------------------------------
// SECTION 3: 자동 세이브 및 SaveSystem.getSlotInfo 검증
// -----------------------------------------------------------------------------
console.log("\n--- 3. 자동 저장 및 SaveSystem.getSlotInfo 검증 ---");
const slot1Info = SaveSystem.getSlotInfo('slot1');
assert(slot1Info !== null && slot1Info.exists === true, "슬롯 1에 세이브 데이터 저장 확인");
assert(slot1Info.species.includes('인간') || slot1Info.species.includes('Novice'), `슬롯 1 종족 정보: ${slot1Info.species}`);
assert(slot1Info.level === 1, `슬롯 1 레벨: ${slot1Info.level}`);
assert(slot1Info.floor === 1, `슬롯 1 층수: ${slot1Info.floor}`);

// -----------------------------------------------------------------------------
// SECTION 4: 상태이상 부여 및 StatusEffectEngine / debuffs Proxy 보존 검증
// -----------------------------------------------------------------------------
console.log("\n--- 4. StatusEffectEngine & debuffs Proxy 직렬화/역직렬화 보존 검증 ---");
// Apply status effects via Proxy and Engine
game.player.debuffs.poison = 5;
game.player.debuffs.frost = 3;
StatusEffectEngine.applyStatus(game.player, 'BLIND', 4);

assert(game.player.statuses.POISON && game.player.statuses.POISON.duration === 5, "프록시를 통한 중독(POISON: 5턴) 부여 성공");
assert(game.player.statuses.FROST && game.player.statuses.FROST.duration === 3, "프록시를 통한 동결(FROST: 3턴) 부여 성공");
assert(game.player.statuses.BLIND && game.player.statuses.BLIND.duration === 4, "엔진을 통한 실명(BLIND: 4턴) 부여 성공");

// Save game with active statuses
game.saveGame(true);

// Re-deserialize into a fresh game instance
const loadedGame = new Game();
const loadResult = SaveSystem.loadGame(loadedGame, true, 'slot1');
assert(loadResult === true, "슬롯 1 세이브 로드 성공");
assert(loadedGame.player !== null, "로드된 게임 플레이어 존재");
assert(loadedGame.player.statuses.POISON && loadedGame.player.statuses.POISON.duration === 5, "로드 후 중독(POISON) 상태 지속시간 5턴 정상 복원");
assert(loadedGame.player.statuses.FROST && loadedGame.player.statuses.FROST.duration === 3, "로드 후 동결(FROST) 상태 지속시간 3턴 정상 복원");
assert(loadedGame.player.statuses.BLIND && loadedGame.player.statuses.BLIND.duration === 4, "로드 후 실명(BLIND) 상태 지속시간 4턴 정상 복원");

// Verify debuffs Proxy is 100% active and not destroyed by plain object assignment
assert(loadedGame.player.debuffs.poison === 5, "로드 후 debuffs.poison Proxy getter 정상 작동 (5)");
loadedGame.player.debuffs.poison = 0;
assert(!loadedGame.player.statuses.POISON || loadedGame.player.statuses.POISON.duration === 0, "로드 후 debuffs.poison = 0 세터 작동 시 statuses.POISON 자동 제거 (Proxy 온전함)");

// -----------------------------------------------------------------------------
// SECTION 5: '새 모험 시작하기' -> 슬롯2 -> 임프 (IMP) 코어 시작 검증
// -----------------------------------------------------------------------------
console.log("\n--- 5. 슬롯 2에 임프(IMP) 코어로 새 모험 시작 검증 ---");
game.showMainMenu();
assert(game.isMainMenuOpen === true, "showMainMenu() 재호출 시 메인 메뉴 열림");

newGameBtn.onclick({ stopPropagation: () => {} });
slotBtns[1].onclick({ stopPropagation: () => {} }); // Select Slot 2
assert(game.currentSlot === 'slot2', "슬롯 2 선택 완료");

coreBtns[1].onclick({ stopPropagation: () => {} }); // Select IMP Core
assert(game.isMainMenuOpen === false, "임프 코어 선택 후 인게임 진입");
assert(game.player.mimicCore.coreType === 'MON_HOMUNCULUS' || game.player.mimicCore.name.includes('Homunculus') || game.player.mimicCore.coreType === 'IMP', "임프(Homunculus) 코어 장착 확인");

const slot2Info = SaveSystem.getSlotInfo('slot2');
assert(slot2Info !== null && slot2Info.exists === true, "슬롯 2 세이브 정상 생성");
assert(slot2Info.species.includes('임프') || slot2Info.species.includes('호문쿨루스') || slot2Info.species.includes('Homunculus'), `슬롯 2 종족 정보: ${slot2Info.species}`);

// -----------------------------------------------------------------------------
// SECTION 6: '모험 이어하기' (Continue Game) 로드 플로우 검증
// -----------------------------------------------------------------------------
console.log("\n--- 6. '모험 이어하기' 슬롯 1 로드 플로우 검증 ---");
game.showMainMenu();
loadGameBtn.onclick({ stopPropagation: () => {} });
assert(!slotSelection.classList.contains('hidden'), "이어하기 클릭 시 슬롯 목록 표시");
assert(slotTitle.innerText.includes('불러올'), "슬롯 타이틀이 '불러올 슬롯 선택'으로 변경");

// Click Slot 1 (contains Human save)
slotBtns[0].onclick({ stopPropagation: () => {} });
assert(game.currentSlot === 'slot1', "슬롯 1 로드 지정");
assert(game.isMainMenuOpen === false, "로드 완료 후 isMainMenuOpen === false");
assert(overlay.style.display === 'none', "타이틀 오버레이 닫힘");
assert(game.player.char === '@', "슬롯 1의 인간 여행자 플레이어 복원 확인");

// -----------------------------------------------------------------------------
// SECTION 7: 빈 슬롯 로드 시 방어 가드 (Error Handling / Feedback) 검증
// -----------------------------------------------------------------------------
console.log("\n--- 7. 빈 슬롯 로드 시 방어 가드 검증 ---");
game.showMainMenu();
loadGameBtn.onclick({ stopPropagation: () => {} });
// Click Slot 5 (empty)
slotBtns[4].onclick({ stopPropagation: () => {} });
assert(game.isMainMenuOpen === true, "빈 슬롯 로드 시 메인 메뉴 닫히지 않고 열림 유지");
assert(overlay.style.display === 'flex', "타이틀 오버레이 유지");
assert(slotTitle.innerText.includes('비어 있는 슬롯'), `빈 슬롯 안내 메시지 출력: '${slotTitle.innerText}'`);

// -----------------------------------------------------------------------------
// SECTION 8: 손상된 세이브 데이터 로드 시 Try-Catch Guard 검증
// -----------------------------------------------------------------------------
console.log("\n--- 8. 손상된 세이브 데이터 로드 시 Try-Catch 방어 가드 검증 ---");
// Inject corrupted JSON into slot3
storageData.set('mimicry_save_game_slot3', '{ "corrupted": true, "player": null }');
slotBtns[2].onclick({ stopPropagation: () => {} });
assert(game.isMainMenuOpen === true, "손상된 세이브 로드 시 크래시 없이 메인 메뉴 유지");
assert(overlay.style.display === 'flex', "타이틀 오버레이 유지");

// -----------------------------------------------------------------------------
// SECTION 9: 플레이어 사망 시 세이브 삭제 및 타이틀 복귀 라이프사이클 검증
// -----------------------------------------------------------------------------
console.log("\n--- 9. 플레이어 사망 -> 묘비명 저장 -> 슬롯 삭제 -> 타이틀 복귀 검증 ---");
// Start in slot1
game.currentSlot = 'slot1';
game.resetToNewGame('HUMAN');
game.saveGame(true);
assert(SaveSystem.getSlotInfo('slot1') !== null, "사망 전 슬롯 1 세이브 존재 확인");

// Trigger death
game.player.stats.hp = 0;
game.handlePlayerDeath();
assert(game.isGameOver === true, "사망 처리: isGameOver === true");
assert(SaveSystem.getSlotInfo('slot1') === null, "Permadeath 룰에 의해 슬롯 1 세이브 파일 영구 삭제 확인");

// Return to title screen
game.showMainMenu();
assert(game.isMainMenuOpen === true, "사망 후 showMainMenu 호출 시 타이틀 복귀");
const slot1AfterDeath = SaveSystem.getSlotInfo('slot1');
assert(slot1AfterDeath === null, "슬롯 1이 '비어 있음' 상태로 정상 갱신");

// Start new adventure in slot 1 again after death
newGameBtn.onclick({ stopPropagation: () => {} });
slotBtns[0].onclick({ stopPropagation: () => {} });
coreBtns[0].onclick({ stopPropagation: () => {} });
assert(game.isMainMenuOpen === false, "사망 후 슬롯 1에 재시작 성공");
assert(game.player.stats.hp > 0, "재시작된 플레이어 HP 정상 회복");

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`🎉 ALL START & CONTINUE GAME TESTS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
