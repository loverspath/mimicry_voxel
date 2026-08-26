/**
 * scripts/test_kill_count_and_skill_hotkeys.js
 * Unit tests for:
 * 1. Player.js kill count and lore delegation methods (recordKill, getKillCount, gainLoreXp, getLoreXp)
 * 2. LootSystem.processMonsterDeath incrementing both slain monster lore and active morph form lore XP (>= 2)
 * 3. Input.js Digit1~4 (SKILL_1~4) vs Numpad1~9 (MOVE_SW ~ MOVE_NE) mapping isolation
 * 4. Game.prototype.update skill hotkey dispatching
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { Input } from '../src/core/Input.js';
import { Map } from '../src/map/Map.js';

console.log("================================================================================");
console.log("🎯 [KILL COUNT DELEGATION & SKILL HOTKEYS TEST SUITE] 🎯");
console.log("================================================================================");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Player.js Delegation Methods
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: Player.js 킬 카운트 및 로어 경험치 body 위임 메서드 검증 ---");

const player = new Player(0, 0);

// Record kill through Player directly
player.recordKill('MON_HILL_ORC', 3);
assert(player.getKillCount('MON_HILL_ORC') === 3, `player.getKillCount('MON_HILL_ORC') 3 반환 (실제: ${player.getKillCount('MON_HILL_ORC')})`);
assert(player.body.getKillCount('MON_HILL_ORC') === 3, "player.body.getKillCount에서도 3 동기화 확인");
assert(player.getKillCount('Hill orc') === 3, "영문명 별칭으로 조회 시에도 3 반환");

// Gain Lore XP through Player directly
player.gainLoreXp('MON_HILL_ORC', 150);
assert(player.getLoreXp('MON_HILL_ORC') === 150, `player.getLoreXp('MON_HILL_ORC') 150 반환 (실제: ${player.getLoreXp('MON_HILL_ORC')})`);
assert(player.body.getLoreXp('MON_HILL_ORC') === 150, "player.body.getLoreXp에서도 150 동기화 확인");
assert(player.getLoreXp('Hill orc') === 150, "영문명 별칭으로 조회 시에도 150 반환");

// -----------------------------------------------------------------------------
// TEST 2: LootSystem Concurrent Kill Count & Active Morph Lore XP Slaying
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: LootSystem 처치 시 킬수 및 활성 폼 로어 경험치 동시 가산 검증 ---");

const gameMock = {
  floor: 1,
  items: [],
  logs: [],
  addLogEntry(text, type) { this.logs.push({ text, type }); }
};

// Equip Ogre core as active morph form
const ogreCore = new Item(0, 0, 'CORE', '%', '#10b981', 'Ogre');
ogreCore.coreType = 'MON_OGRE';
player.mimicCore = ogreCore;

const initialOgreLore = player.getLoreXp('MON_OGRE');
const initialKoboldKills = player.getKillCount('MON_SMALL_KOBOLD');
const initialKoboldLore = player.getLoreXp('MON_SMALL_KOBOLD');

const kobold = new Monster(5, 5, 'MON_SMALL_KOBOLD');
kobold.stats.hp = 0;
kobold.xpValue = 30;

LootSystem.processMonsterDeath(gameMock, player, kobold, '격투');

assert(player.getKillCount('MON_SMALL_KOBOLD') > initialKoboldKills, `사냥 후 코볼트 킬수 1 이상 증가 확인 (현재: ${player.getKillCount('MON_SMALL_KOBOLD')})`);
assert(player.getLoreXp('MON_SMALL_KOBOLD') > initialKoboldLore, `사냥 후 코볼트 로어 XP 가산 확인 (현재: ${player.getLoreXp('MON_SMALL_KOBOLD')})`);
assert(player.getLoreXp('MON_OGRE') >= initialOgreLore + 2, `사냥 후 활성 변신 본체(Ogre) 폼에 최소 +2 이상의 보너스 로어 XP 가산 확인 (이전: ${initialOgreLore}, 현재: ${player.getLoreXp('MON_OGRE')})`);

// -----------------------------------------------------------------------------
// TEST 3: Input.js Top Row Digit1~4 (Skills) vs Numpad1~9 (Movement)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: Input.js 숫자키 Digit1~4 (스킬) vs Numpad1~9 (이동) 격리 검증 ---");

// Headless window mock for event registration
let keydownListener = null;
let keyupListener = null;
globalThis.window = {
  addEventListener(evt, fn) {
    if (evt === 'keydown') keydownListener = fn;
    if (evt === 'keyup') keyupListener = fn;
  }
};

const input = new Input();

// Test Digit1 -> SKILL_1
keydownListener({ code: 'Digit1', key: '1' });
assert(input.isActionActive('SKILL_1'), "e.code 'Digit1' 발생 시 'SKILL_1' 액션 활성화");
assert(!input.isActionActive('MOVE_SW'), "e.code 'Digit1' 발생 시 대각선 이동('MOVE_SW')이 활성화되지 않음");
keyupListener({ code: 'Digit1', key: '1' });
assert(!input.isActionActive('SKILL_1'), "Digit1 키업 시 'SKILL_1' 해제");

// Test Digit4 -> SKILL_4
keydownListener({ code: 'Digit4', key: '4' });
assert(input.isActionActive('SKILL_4'), "e.code 'Digit4' 발생 시 'SKILL_4' 액션 활성화");
assert(!input.isActionActive('MOVE_W'), "e.code 'Digit4' 발생 시 좌측 이동('MOVE_W')이 활성화되지 않음");
keyupListener({ code: 'Digit4', key: '4' });

// Test Numpad1 -> MOVE_SW
keydownListener({ code: 'Numpad1', key: '1' });
assert(input.isActionActive('MOVE_SW'), "e.code 'Numpad1' 발생 시 'MOVE_SW' 액션 활성화");
assert(!input.isActionActive('SKILL_1'), "e.code 'Numpad1' 발생 시 스킬('SKILL_1')이 활성화되지 않음");
keyupListener({ code: 'Numpad1', key: '1' });

// Test Numpad9 -> MOVE_NE
keydownListener({ code: 'Numpad9', key: '9' });
assert(input.isActionActive('MOVE_NE'), "e.code 'Numpad9' 발생 시 'MOVE_NE' 액션 활성화");
keyupListener({ code: 'Numpad9', key: '9' });

// -----------------------------------------------------------------------------
// TEST 4: Player.castActiveSkill Execution
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: Player.castActiveSkill 고유 스킬 시전 연동 검증 ---");

const target = new Monster(1, 0, 'SLIME');
target.stats.hp = 100;

// Ogre has skills at slot 1
const cast1Result = player.castActiveSkill(1, gameMock, target);
assert(cast1Result === true, "player.castActiveSkill(1, game) 정상 시전 성공");

// Non-existent slot 5
const cast5Result = player.castActiveSkill(5, gameMock, target);
assert(cast5Result === false, "비어있는 5번 슬롯 시전 시 안전하게 false 반환");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
