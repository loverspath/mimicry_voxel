/**
 * scripts/test_realtime_morph_combat_mastery.js
 * Unit test verifying real-time morph mastery lore XP growth:
 * 1. Melee physical attack hit grants +1 Lore XP to active morph form
 * 2. Ranged autofire hit grants +1 Lore XP to active morph form
 * 3. Active innate skill execution grants +2 Lore XP to active morph form
 * 4. Slaying enemy monster grants +50% bonus Lore XP to active morph form
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';
import { Map } from '../src/map/Map.js';

console.log("================================================================================");
console.log("⚔️ [REAL-TIME MORPH COMBAT MASTERY LORE XP TEST SUITE] ⚔️");
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
const map = new Map(30, 30, 1);
const game = {
  map,
  floor: 1,
  effects: [],
  items: [],
  logs: [],
  addLogEntry(text, type) {
    this.logs.push({ text, type });
  },
  updateUI() {}
};

// Unobstructed line of sight for mock map
map.isWalkable = () => true;

const player = new Player(10, 10);
player.stats.dex = 30; // High accuracy
const ogreCore = new Item(0, 0, 'CORE', '%', '#10b981', 'Ogre');
ogreCore.coreType = 'MON_OGRE';
player.mimicCore = ogreCore;

// -----------------------------------------------------------------------------
// TEST 1: Melee Attack Grants +1 Lore XP to Active Morph Form
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 근접 타격 적중 시 변신 폼(MON_OGRE) +1 로어 경험치 가산 검증 ---");

const targetMonster = new Monster(11, 10, 'SLIME');
targetMonster.stats.hp = 1000;
targetMonster.stats.maxHp = 1000;
targetMonster.baseAC = 0;

const initialOgreLore = player.body.getLoreXp('MON_OGRE');

// Execute melee attacks until at least 1 hit lands
for (let i = 0; i < 5; i++) {
  CombatSystem.attackMonster(game, player, targetMonster);
}

const afterMeleeLore = player.body.getLoreXp('MON_OGRE');
assert(afterMeleeLore > initialOgreLore, `근접 타격 후 변신 폼 로어 XP 증가 확인 (이전: ${initialOgreLore}, 이후: ${afterMeleeLore})`);

// -----------------------------------------------------------------------------
// TEST 2: Ranged Attack Grants +1 Lore XP to Active Morph Form
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 원거리 사격 적중 시 변신 폼(MON_OGRE) +1 로어 경험치 가산 검증 ---");

const bow = new Item(0, 0, 'BOW', '}', '#a855f7', 'Shortbow');
bow.slotType = 'BOW';
bow.range = 10;
bow.multiplier = 1;
const arrows = new Item(0, 0, 'QUIVER', '{', '#cbd5e1', 'Arrows');
arrows.slotType = 'QUIVER';
arrows.count = 50;

player.equipment.bow = bow;
player.equipment.quiver = arrows;

const distantMonster = new Monster(14, 10, 'SLIME');
distantMonster.stats.hp = 1000;
distantMonster.stats.maxHp = 1000;
distantMonster.baseAC = 0;

const beforeRangedLore = player.body.getLoreXp('MON_OGRE');
for (let i = 0; i < 5; i++) {
  CombatSystem.fireRangedAttack(game, player, distantMonster);
}
const afterRangedLore = player.body.getLoreXp('MON_OGRE');

assert(afterRangedLore > beforeRangedLore, `원거리 사격 후 변신 폼 로어 XP 증가 확인 (이전: ${beforeRangedLore}, 이후: ${afterRangedLore})`);

// -----------------------------------------------------------------------------
// TEST 3: Active Innate Skill Cast Grants +2 Lore XP to Active Morph Form
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 고유 액티브 스킬 시전 성공 시 변신 폼(MON_OGRE) +2 로어 경험치 가산 검증 ---");

const skills = player.getInnateSkills();
assert(skills.length > 0, "Ogre 고유 스킬 목록 로드 확인");

const skillToCast = skills[0];
const beforeSkillLore = player.body.getLoreXp('MON_OGRE');

const castSuccess = skillToCast.execute(game, player, targetMonster);
assert(castSuccess === true, "액티브 스킬 시전 성공 확인");

const afterSkillLore = player.body.getLoreXp('MON_OGRE');
assert(afterSkillLore === beforeSkillLore + 2, `스킬 시전 후 +2 로어 경험치 가산 확인 (이전: ${beforeSkillLore}, 이후: ${afterSkillLore})`);

// -----------------------------------------------------------------------------
// TEST 4: Slaying Enemy Monster Grants +50% Bonus Lore XP to Active Morph Form
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 적 몬스터 처치 시 변신 본체 폼에도 50% 처치 보너스 로어 XP 가산 검증 ---");

const preyMonster = new Monster(11, 11, 'MON_HILL_ORC');
preyMonster.stats.hp = 0;
preyMonster.xpValue = 50;

const beforeKillOgreLore = player.body.getLoreXp('MON_OGRE');
const beforeKillOrcLore = player.body.getLoreXp('MON_HILL_ORC');

LootSystem.processMonsterDeath(game, player, preyMonster, "의태 강타");

const afterKillOgreLore = player.body.getLoreXp('MON_OGRE');
const afterKillOrcLore = player.body.getLoreXp('MON_HILL_ORC');

assert(afterKillOrcLore > beforeKillOrcLore, `처치된 적 몬스터(Hill orc) 로어 XP 가산 확인 (이전: ${beforeKillOrcLore}, 이후: ${afterKillOrcLore})`);
assert(afterKillOgreLore > beforeKillOgreLore, `전투를 수행한 변신 본체(Ogre) 폼에도 처치 보너스 로어 XP 가산 확인 (이전: ${beforeKillOgreLore}, 이후: ${afterKillOgreLore})`);

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
