/**
 * scripts/test_dynamic_inventory_slots.js
 * Unit Test Suite for:
 * 1. Unlimited dynamic inventory slots rendering beyond 24 items (30+ items test).
 * 2. ToME slot index badges (a~z, 27)...) on inventory slots.
 * 3. Dynamic selectItem(item) selection and scrollIntoView integration.
 */

// Mock Headless DOM Elements
class MockDOMElement {
  constructor(id = '', className = '') {
    this.id = id;
    this._className = className;
    this.style = {};
    this.children = [];
    this._innerHTML = '';
    this.classList = {
      _classes: new Set(className ? className.split(' ') : []),
      contains: (c) => this.classList._classes.has(c),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c)
    };
    this.attributes = {};
    this.onclick = null;
    this.innerText = '';
    this.scrolledIntoView = false;
    this.scrollOptions = null;
  }
  set className(val) {
    this._className = val;
    this.classList._classes = new Set(val ? val.split(' ') : []);
  }
  get className() {
    return this._className || '';
  }
  set innerHTML(val) {
    this._innerHTML = val;
    if (val === '') {
      this.children = [];
    }
  }
  get innerHTML() {
    return this._innerHTML;
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(evt, handler) {
    if (evt === 'click') this.onclick = handler;
  }
  querySelector(sel) {
    return this.children.find(c => c.className && c.className.includes(sel.replace('.', ''))) || null;
  }
  querySelectorAll(sel) {
    return this.children.filter(c => c.className && c.className.includes(sel.replace('.', '')));
  }
  closest() { return null; }
  scrollIntoView(options) {
    this.scrolledIntoView = true;
    this.scrollOptions = options;
  }
  appendChild(child) {
    this.children.push(child);
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

const domMap = new Map();
function getOrCreate(id) {
  if (!domMap.has(id)) {
    const el = new MockDOMElement(id);
    if (id === 'game-canvas') {
      el.getContext = () => ({
        fillRect: () => {}, fillText: () => {}, beginPath: () => {}, arc: () => {},
        fill: () => {}, save: () => {}, restore: () => {}, setTransform: () => {}, scale: () => {},
        moveTo: () => {}, lineTo: () => {}, stroke: () => {}, closePath: () => {},
        translate: () => {}, rotate: () => {}, clearRect: () => {}, measureText: () => ({ width: 10 })
      });
      el.clientWidth = 800; el.clientHeight = 600; el.width = 800; el.height = 600;
    }
    domMap.set(id, el);
  }
  return domMap.get(id);
}

globalThis.requestAnimationFrame = (cb) => {};
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1024,
  innerHeight: 768,
  devicePixelRatio: 1,
  location: { search: '' },
  requestAnimationFrame: (cb) => {}
};
globalThis.document = {
  getElementById: (id) => getOrCreate(id),
  querySelector: (sel) => {
    if (sel.startsWith('#')) return getOrCreate(sel.slice(1));
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === '.inventory-slot') {
      const list = getOrCreate('inventory-list');
      return list ? list.children.filter(c => c.classList.contains('inventory-slot')) : [];
    }
    return [];
  },
  createElement: (tag) => new MockDOMElement('', ''),
  body: new MockDOMElement('body'),
  addEventListener: () => {}
};
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

import { Game } from '../src/core/Game.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { renderInventorySlotHTML } from '../src/ui/InventoryView.js';

console.log("================================================================================");
console.log("🎒 [DYNAMIC INVENTORY SLOTS & TOME BADGES TEST SUITE] 🎒");
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
// TEST 1: ToME Slot Index Badges (a~z, 27)...)
// -----------------------------------------------------------------------------
console.log("--- TEST 1: ToME 슬롯 인덱스 배지 (a~z, 27)...) 렌더링 검증 ---");

const dummyPlayer = new Player(0, 0);
const testItem = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Dagger');

const slot0 = renderInventorySlotHTML(testItem, dummyPlayer, 0);
assert(slot0.html.includes('a)'), `인덱스 0번 배지는 'a)' 임`);

const slot25 = renderInventorySlotHTML(testItem, dummyPlayer, 25);
assert(slot25.html.includes('z)'), `인덱스 25번 배지는 'z)' 임`);

const slot26 = renderInventorySlotHTML(testItem, dummyPlayer, 26);
assert(slot26.html.includes('27)'), `인덱스 26번 배지는 '27)' 임`);

const slot34 = renderInventorySlotHTML(testItem, dummyPlayer, 34);
assert(slot34.html.includes('35)'), `인덱스 34번 배지는 '35)' 임`);

const emptySlot0 = renderInventorySlotHTML(null, dummyPlayer, 0);
assert(emptySlot0.html.includes('a)') && /empty/i.test(emptySlot0.html), `빈 슬롯 0번에도 'a)' 배지와 'Empty'가 함께 렌더링됨`);

// -----------------------------------------------------------------------------
// TEST 2: Dynamic Inventory Slots Rendering (35 Items)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 35개 아이템 소지 시 동적 슬롯 35개 전수 렌더링 검증 ---");

const game = new Game();
game.player = new Player(0, 0);
game.player.inventory = [];

// Populate inventory with 35 distinct items
for (let i = 0; i < 35; i++) {
  const item = new Item(0, 0, 'POTION', '!', '#f43f5e', `Potion of Test #${i + 1}`);
  game.player.inventory.push(item);
}

assert(game.player.inventory.length === 35, `플레이어 인벤토리에 35개 아이템 적재 확인`);

// Render inventory
game.renderInventoryList();

const inventoryListEl = getOrCreate('inventory-list');
const slotElements = inventoryListEl.children.filter(c => c.classList.contains('inventory-slot'));

assert(
  slotElements.length === 35,
  `renderInventoryList() 호출 시 24칸 제한 없이 35개 슬롯 요소가 전수 생성됨 (실제: ${slotElements.length}개)`
);

// -----------------------------------------------------------------------------
// TEST 3: Minimum 24 Slots when inventory has fewer items
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 아이템 수가 24개 미만일 때 최소 24칸 기본 그리드 유지 검증 ---");

game.player.inventory = [testItem];
game.renderInventoryList();

const minSlotElements = inventoryListEl.children.filter(c => c.classList.contains('inventory-slot'));
assert(
  minSlotElements.length === 24,
  `아이템이 1개일 때 최소 기본 24칸 슬롯 유지됨 (실제: ${minSlotElements.length}개)`
);
assert(
  minSlotElements[0].classList.contains('empty') === false,
  `0번 슬롯은 아이템이 채워져 있음`
);
assert(
  minSlotElements[1].classList.contains('empty') === true,
  `1번 슬롯은 빈 슬롯('empty') 상태임`
);

// -----------------------------------------------------------------------------
// TEST 4: Selection and scrollIntoView of Deep Items (e.g. 30th item)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 30번째 심층 아이템 선택 및 scrollIntoView 자동 스크롤 검증 ---");

// Refill with 35 items
game.player.inventory = [];
for (let i = 0; i < 35; i++) {
  const item = new Item(0, 0, 'POTION', '!', '#f43f5e', `Item #${i + 1}`);
  game.player.inventory.push(item);
}
game.renderInventoryList();

const targetItem = game.player.inventory[29]; // 30th item
game.selectItem(targetItem);

assert(game.selectedItem === targetItem, `game.selectedItem이 30번째 아이템으로 정상 설정됨`);

const currentSlots = inventoryListEl.children.filter(c => c.classList.contains('inventory-slot'));
assert(
  currentSlots[29].classList.contains('selected') === true,
  `29번(30번째) 슬롯 요소에 'selected' 클래스 정상 부여됨`
);
assert(
  currentSlots[0].classList.contains('selected') === false,
  `0번 슬롯 요소는 'selected' 클래스가 제거됨`
);
assert(
  currentSlots[29].scrolledIntoView === true,
  `29번 슬롯에 scrollIntoView() 메서드가 성공적으로 격발됨`
);
assert(
  currentSlots[29].scrollOptions && currentSlots[29].scrollOptions.behavior === 'smooth',
  `scrollIntoView 옵션에 smooth 동작이 적용됨`
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`TEST SUMMARY: TOTAL ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL DYNAMIC INVENTORY SLOTS TESTS PASSED 100%!");
  process.exit(0);
}
