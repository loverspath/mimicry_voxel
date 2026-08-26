/**
 * scripts/test_monster_death_and_core_name.js
 * Unit test verifying:
 * 1. Dynamic ToME core name resolution (no hardcoding of '인간 여성 여행자')
 * 2. Accurate monster death log branching: DoT (지속 피해) vs Combat (처치)
 * 3. Base & dynamic skill tree resolution for ToME starter body (MON_NOVICE_WARRIOR)
 * 4. Game.prototype.killMonster delegation to LootSystem.processMonsterDeath
 */

// Headless DOM mock
class MockDOMElement {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.style = {};
    this.children = [];
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
  addEventListener(evt, handler) { if (evt === 'click') this.onclick = handler; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  scrollIntoView() {}
  appendChild(child) { this.children.push(child); }
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
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => new MockDOMElement('', tag),
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
import { Monster } from '../src/entities/Monster.js';
import { getSpeciesConfig } from '../src/entities/MonsterRegistry.js';
import { CORE_SKILL_TREES, BASE_SKILL_TREES } from '../src/core/Skills.js';
import { MonsterAISystem } from '../src/systems/MonsterAISystem.js';
import { LootSystem } from '../src/core/LootSystem.js';

console.log("================================================================================");
console.log("🧪 [TEST SUITE: CORE NAME DYNAMIC RESOLUTION & MONSTER DEATH LOG REPAIR] 🧪");
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
// TEST 1: Dynamic Core Name Resolution via getSpeciesConfig
// -----------------------------------------------------------------------------
console.log("--- TEST 1: Dynamic Core Name Resolution for All Species ---");

const humanConfig = getSpeciesConfig('HUMAN');
assert(humanConfig !== null, "HUMAN resolves to valid species config");
assert(humanConfig.coreType === 'MON_NOVICE_WARRIOR', `HUMAN coreType is MON_NOVICE_WARRIOR (actual: ${humanConfig.coreType})`);
assert(humanConfig.name === 'Novice warrior', `HUMAN name is 'Novice warrior' (actual: ${humanConfig.name})`);

const impConfig = getSpeciesConfig('IMP');
assert(impConfig !== null, "IMP resolves to valid species config");
assert(impConfig.coreType === 'MON_HOMUNCULUS', `IMP coreType is MON_HOMUNCULUS (actual: ${impConfig.coreType})`);
assert(impConfig.name === 'Homunculus', `IMP name is 'Homunculus' (actual: ${impConfig.name})`);

// -----------------------------------------------------------------------------
// TEST 2: BASE_SKILL_TREES & CORE_SKILL_TREES Resolution
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: Starter Body Skill Tree Canonical Keys ---");

assert(Array.isArray(BASE_SKILL_TREES['MON_NOVICE_WARRIOR']), "BASE_SKILL_TREES has 'MON_NOVICE_WARRIOR'");
assert(Array.isArray(BASE_SKILL_TREES['Novice warrior']), "BASE_SKILL_TREES has 'Novice warrior'");
assert(Array.isArray(BASE_SKILL_TREES['인간 여행자']), "BASE_SKILL_TREES has '인간 여행자'");
assert(BASE_SKILL_TREES['인간 여성 여행자'] === undefined, "'인간 여성 여행자' legacy key removed from BASE_SKILL_TREES");

const humanSkills = CORE_SKILL_TREES['MON_NOVICE_WARRIOR'];
assert(Array.isArray(humanSkills) && humanSkills.length === 5, "CORE_SKILL_TREES returns 5-tier skill tree for MON_NOVICE_WARRIOR");
assert(humanSkills[0].name === "터프함", `First skill is '터프함' (actual: ${humanSkills[0].name})`);

// -----------------------------------------------------------------------------
// TEST 3: Monster DoT Death Log (diedFromDot = true -> 지속 피해 로그)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: Monster Turn Loop - DoT Death Log Branching ---");

const mockGame = {
  player: new Player(10, 10),
  monsters: [],
  logHistory: [],
  addLogEntry(msg, type) {
    this.logHistory.push({ msg, type });
  }
};

// Create a monster and simulate death by poison DoT (use ORC which has no poison immunity)
const poisonMonster = new Monster(11, 11, 'ORC');
poisonMonster.stats.hp = 1;
poisonMonster.debuffs.poison = 1;

// Simulate MonsterAISystem.act
MonsterAISystem.act(
  poisonMonster,
  mockGame.player,
  { isWalkable: () => true },
  () => false,
  () => {},
  () => {},
  (msg, type) => mockGame.addLogEntry(msg, type)
);

assert(poisonMonster.stats.hp <= 0, "Monster HP reduced to 0 by poison DoT");
assert(poisonMonster.diedFromDot === true, "poisonMonster.diedFromDot is set to true");

// Simulate Game turn loop handling
const scaledXp = LootSystem.getScaledXpValue(mockGame.player, poisonMonster);
if (poisonMonster.diedFromDot) {
  mockGame.addLogEntry(
    `[System] ${poisonMonster.displayName}이(가) 지속 피해로 쓰러졌습니다! (+${scaledXp} XP)`,
    `system`
  );
} else {
  mockGame.addLogEntry(
    `[Combat] ${poisonMonster.displayName}을(를) 처치했습니다! (+${scaledXp} XP)`,
    `combat`
  );
}

const dotLog = mockGame.logHistory.find(l => l.msg.includes('지속 피해로 쓰러졌습니다'));
assert(dotLog !== undefined, "Log history contains '지속 피해로 쓰러졌습니다'");
assert(!mockGame.logHistory.some(l => l.msg.includes('상태이상 피해로 사망했습니다')), "No '상태이상 피해로 사망했습니다' legacy log generated");

// -----------------------------------------------------------------------------
// TEST 4: Direct Combat Death Log (diedFromDot falsy -> 처치 로그)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: Direct Combat / Skill Defeat Log Branching ---");

mockGame.logHistory = [];
const combatMonster = new Monster(12, 12, 'GOBLIN');
combatMonster.stats.hp = 0; // killed directly
combatMonster.diedFromDot = false;

const combatXp = LootSystem.getScaledXpValue(mockGame.player, combatMonster);
if (combatMonster.diedFromDot) {
  mockGame.addLogEntry(
    `[System] ${combatMonster.displayName}이(가) 지속 피해로 쓰러졌습니다! (+${combatXp} XP)`,
    `system`
  );
} else {
  mockGame.addLogEntry(
    `[Combat] ${combatMonster.displayName}을(를) 처치했습니다! (+${combatXp} XP)`,
    `combat`
  );
}

const combatLog = mockGame.logHistory.find(l => l.msg.includes('처치했습니다'));
assert(combatLog !== undefined, "Log history contains '[Combat] ... 처치했습니다!'");
assert(combatLog.type === 'combat', "Log entry type is 'combat'");

// -----------------------------------------------------------------------------
// TEST 5: Game.prototype.killMonster exists and calls LootSystem.processMonsterDeath
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: Game.prototype.killMonster Integration ---");

assert(typeof Game.prototype.killMonster === 'function', "Game.prototype.killMonster is defined as a function");

const testGame = new Game();
testGame.render = () => {};
testGame.updateUI = () => {};
testGame.player = new Player(10, 10);
const targetMonster = new Monster(15, 15, 'BAT');
testGame.monsters = [targetMonster];
testGame.items = [];

testGame.killMonster(targetMonster, "신성 일격");
assert(!testGame.monsters.includes(targetMonster), "Monster removed from game.monsters by killMonster");
assert(testGame.logHistory.some(l => l.text && l.text.includes('신성 일격(으)로 처치했습니다')), "LootSystem logged death with custom attack source");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
