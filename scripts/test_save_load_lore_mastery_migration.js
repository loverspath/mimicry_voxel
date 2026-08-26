/**
 * scripts/test_save_load_lore_mastery_migration.js
 * Unit test verifying:
 * 1. Fragmented legacy save files with alias keys ('Lesser titan', 'TITAN') auto-migrate to highest XP (2,880 XP -> Lv.50) across all canonical keys
 * 2. mimicCore coreType is canonicalized to 'MON_LESSER_TITAN'
 * 3. activeSkills are rebound to 4 innate skills of the restored mimicCore and are 100% unlocked at Lv.50
 * 4. Bestiary, HUD skilltree, and Core inspector all display Lv.50 with all skills unlocked
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { Map } from '../src/map/Map.js';
import { SaveSystem } from '../src/core/SaveSystem.js';
import { renderMonsterDetailCardHTML } from '../src/ui/MonsterLoreView.js';
import { renderSkillTreeHTML } from '../src/ui/HUDView.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';

console.log("================================================================================");
console.log("🧬 [SAVE/LOAD LORE MASTERY AUTO-MIGRATION TEST SUITE] 🧬");
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
// SETUP: Mock legacy save with fragmented lore registry & uncanonical core
// -----------------------------------------------------------------------------
const gameMock = {
  floor: 10,
  floorDanger: 2.0,
  map: new Map(20, 20, 1),
  effects: [],
  monsters: [],
  items: [],
  player: new Player(10, 10, 'MON_NOVICE_WARRIOR'),
  logs: [],
  addLogEntry(text, type) { this.logs.push({ text, type }); },
  updateUI() {}
};

const legacySaveData = {
  floor: 10,
  floorDanger: 2.0,
  map: {
    width: 20,
    height: 20,
    floor: 10,
    startingPosition: { x: 5, y: 5 },
    rooms: []
  },
  player: {
    x: 5,
    y: 5,
    name: 'Mighty Mimic',
    level: 15,
    hp: 450,
    maxHp: 450,
    speed: 10,
    mimicCore: {
      name: 'Lesser titan' // Legacy save stored name without canonical coreType
    },
    loreRegistry: {
      'Lesser titan': 2880, // Legacy key has 2,880 XP (Lv.50 threshold is 2,000 XP)
      'TITAN': 100
    },
    inventory: [],
    equipment: { weapon: -1, shield: -1, bow: -1, quiver: -1, armor: -1, helmet: -1, gloves: -1, boots: -1, cloak: -1, subCore1: -1, subCore2: -1, ring1: -1, ring2: -1, amulet: -1, equippedLamp: -1 }
  },
  items: [],
  monsters: []
};

// -----------------------------------------------------------------------------
// TEST 1: SaveSystem.deserialize auto-migrates lore and canonicalizes mimicCore
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 레거시 세이브 로드 시 로어 경험치 전 슬롯 동기화 및 coreType 정규화 ---");

SaveSystem.deserialize(gameMock, legacySaveData);

assert(gameMock.player.mimicCore.coreType === 'MON_LESSER_TITAN', "mimicCore.coreType이 'MON_LESSER_TITAN'으로 정규화됨");
assert(gameMock.player.mimicCore.name === 'Lesser titan', "mimicCore.name이 'Lesser titan'으로 정상 복원됨");

const xpByKey = gameMock.player.body.getLoreXp('MON_LESSER_TITAN');
const xpByName = gameMock.player.body.getLoreXp('Lesser titan');
const xpByAlias = gameMock.player.body.getLoreXp('레서 타이탄');

assert(xpByKey === 2880, `정규 키 MON_LESSER_TITAN 로어 경험치 동기화 확인 (${xpByKey} XP)`);
assert(xpByName === 2880, `영문명 Lesser titan 로어 경험치 동기화 확인 (${xpByName} XP)`);
assert(xpByAlias === 2880, `한글명 레서 타이탄 로어 경험치 동기화 확인 (${xpByAlias} XP)`);

const lvlByKey = gameMock.player.body.getLoreLevel('MON_LESSER_TITAN');
assert(lvlByKey === 50, `레서 타이탄 로어 숙련도 만렙 (Lv.${lvlByKey} == Lv.50) 달성 확인`);

// -----------------------------------------------------------------------------
// TEST 2: Active Skills Rebinding and 100% Unlock State
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: activeSkills 자동 재바인딩 및 전 스킬 해금 상태 검증 ---");

assert(Array.isArray(gameMock.player.activeSkills) && gameMock.player.activeSkills.length === 4, "activeSkills 4대 고유 스킬 배열 바인딩 확인");

gameMock.player.activeSkills.forEach(skill => {
  const isUnlocked = skill.isUnlocked(lvlByKey);
  assert(isUnlocked === true, `스킬 '${skill.name}' (요구 Lv.${skill.requiredMastery})이 Lv.50에서 100% 해금됨`);
});

// -----------------------------------------------------------------------------
// TEST 3: Bestiary & HUD SkillTree Visual Consistency
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 도감 상세 카드 및 HUD 스킬트리 모달 일치성 검증 ---");

const titanData = TOME_MONSTERS_DATA['MON_LESSER_TITAN'];
const detailHTML = renderMonsterDetailCardHTML(titanData, gameMock.player);

assert(detailHTML.includes('Lv.50'), "도감 상세 카드에 로어 숙련도 Lv.50 표시 확인");
assert(!detailHTML.includes('🔒 잠김'), "도감 상세 카드에 잠긴 스킬 없이 모두 해금됨");

const skillTreeHTML = renderSkillTreeHTML(gameMock.player);
assert(skillTreeHTML.includes('Lv.50 / 50'), "HUD 스킬트리에 Lv.50 / 50 만렙 표시 확인");
assert(skillTreeHTML.includes('🟢 자동 격발 대기'), "HUD 스킬트리 4개 스킬 모두 활성 대기 상태 확인");
assert(!skillTreeHTML.includes('🔒 잠김'), "HUD 스킬트리에 잠김 뱃지 0건 확인");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
