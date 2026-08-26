/**
 * scripts/test_realtime_innate_skills_autocast.js
 * Unit test verifying:
 * 1. Self-heal (HEAL) auto-casts when HP <= 85% of maxHp, restores HP, and triggers cooldown
 * 2. Self-buff (HASTE) casts cleanly without "no target in range (0칸)" failure
 * 3. Offensive strike / breath / projectile auto-casts when enemies are in range
 * 4. Phase door teleports when HP < 35% and adjacent enemies exist
 * 5. CombatSystem.triggerActiveSkills connects auto-cast pipeline seamlessly
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Map } from '../src/map/Map.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';

console.log("================================================================================");
console.log("⚡ [REAL-TIME INNATE SKILLS AUTO-CAST ENGINE TEST SUITE] ⚡");
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
// SETUP
// -----------------------------------------------------------------------------
const gameMock = {
  map: new Map(30, 30, 1),
  monsters: [],
  items: [],
  player: null,
  logs: [],
  addLogEntry(text, type) { this.logs.push({ text, type }); },
  isMonsterAt(x, y) { return this.monsters.some(m => m.x === x && m.y === y); },
  killMonster(m) {
    const idx = this.monsters.indexOf(m);
    if (idx !== -1) this.monsters.splice(idx, 1);
  }
};

// -----------------------------------------------------------------------------
// TEST 1: Auto-Cast Self-Heal on HP Loss (Lesser Titan)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 체력 85% 이하 시 상처 치유 (HEAL) 자동 격발 검증 ---");

const titanPlayer = new Player(15, 15, 'MON_LESSER_TITAN');
titanPlayer.body.loreRegistry['MON_LESSER_TITAN'] = 3408; // Lv.50
gameMock.player = titanPlayer;
gameMock.logs = [];

const maxHp = titanPlayer.stats.maxHp;
titanPlayer.stats.hp = Math.floor(maxHp * 0.70); // 70% HP (under 85%)

const beforeHp = titanPlayer.stats.hp;
assert(beforeHp < maxHp * 0.85, `체력이 85% 미만으로 손실됨 (${beforeHp}/${maxHp})`);

CombatSystem.triggerActiveSkills(gameMock);

assert(titanPlayer.stats.hp > beforeHp, `자가 치유 발동으로 체력 회복 확인 (${beforeHp} -> ${titanPlayer.stats.hp})`);
assert(gameMock.logs.some(l => l.text.includes('신성한 치유력') || l.text.includes('상처 치유')), "치유 성공 로그 출력 확인");

const healSkill = titanPlayer.getInnateSkills().find(s => s.id.includes('HEAL') || s.name.includes('치유'));
const healCd = titanPlayer.getTracker(healSkill.id, 'cooldown');
assert(healCd > 0, `치유 스킬 쿨다운 세팅 확인 (남은 쿨: ${healCd}턴)`);

// -----------------------------------------------------------------------------
// TEST 2: Cooldown Gate Prevents Double-Cast
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 쿨다운 중 중복 자동 시전 방지 검증 ---");

const hpAfterHeal = titanPlayer.stats.hp;
CombatSystem.triggerActiveSkills(gameMock); // Cooldown is active
assert(titanPlayer.stats.hp === hpAfterHeal, "쿨다운 중 추가 치유 발동 차단 확인");

// -----------------------------------------------------------------------------
// TEST 3: SELF Spells (HASTE / HEAL) Clean Execution (No 0-range targeting error)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: SELF 계열 스펠 (HASTE/HEAL) 타겟 탐색 버그 없음 검증 ---");

gameMock.logs = [];
const hasteSkill = {
  id: 'HASTE',
  name: '⚡ 신속 가속 (Haste)',
  desc: '행동 속도 가속',
  type: 'SELF',
  element: 'PHYSICAL',
  cooldown: 6,
  maxRange: 0
};

const hasteSuccess = MonsterSpellFactory._executeGenericSpell(gameMock, titanPlayer, null, hasteSkill, hasteSkill);
assert(hasteSuccess === true, "HASTE 스킬 타겟 오류 없이 자가 시전 성공");
assert(!gameMock.logs.some(l => l.text.includes('조준할 적이 없습니다')), "'조준할 적이 없습니다' 에러 로그 미발생 확인");

// -----------------------------------------------------------------------------
// TEST 4: Offensive Attack / Strike Auto-Cast on Visible Target
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 사거리 내 적 포착 시 공격 스킬 자동 조준 격발 검증 ---");

const targetOrc = new Monster(16, 15, 'ORC');
targetOrc.stats.hp = 100;
targetOrc.stats.maxHp = 100;
gameMock.monsters = [targetOrc];

// Reset cooldowns
titanPlayer.skillTrackers = {};
// Full HP so HEAL won't trigger
titanPlayer.stats.hp = titanPlayer.stats.maxHp;

const orcBeforeHp = targetOrc.stats.hp;
CombatSystem.triggerActiveSkills(gameMock);

assert(targetOrc.stats.hp < orcBeforeHp, `사거리 내 오크에게 자동 공격 스킬 적중 확인 (${orcBeforeHp} -> ${targetOrc.stats.hp})`);

// -----------------------------------------------------------------------------
// TEST 5: Crisis Teleport (Phase Door) Auto-Cast
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 위기 상황(체력 35% 미만 + 인접 적) 점멸 탈출 검증 ---");

const homunculusPlayer = new Player(15, 15, 'MON_HOMUNCULUS');
homunculusPlayer.body.loreRegistry['MON_HOMUNCULUS'] = 500; // Lv.25 (Phase door requires Lv.10)
gameMock.player = homunculusPlayer;

homunculusPlayer.stats.hp = Math.floor(homunculusPlayer.stats.maxHp * 0.20); // 20% HP (Critical!)
const adjacentEnemy = new Monster(15, 16, 'ORC'); // adjacent (distance = 1)
adjacentEnemy.stats.hp = 100;
gameMock.monsters = [adjacentEnemy];

const origX = homunculusPlayer.x;
const origY = homunculusPlayer.y;

homunculusPlayer.tryAutoCastInnateSkills(gameMock);

const moved = (homunculusPlayer.x !== origX || homunculusPlayer.y !== origY);
assert(moved, `위기 상황에서 플레이어 점멸 이동 확인 (원래: ${origX},${origY} -> 현재: ${homunculusPlayer.x},${homunculusPlayer.y})`);

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
