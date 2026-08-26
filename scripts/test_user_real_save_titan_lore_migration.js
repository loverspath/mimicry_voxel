/**
 * scripts/test_user_real_save_titan_lore_migration.js
 * Unit test verifying the exact scenario from user's actual save file:
 * - Legacy key "TITAN" had 3,408 XP (Lv.50)
 * - Canonical keys "MON_LESSER_TITAN" and "Lesser titan" had 25 XP (Lv.3)
 * - Reverse alias lookup and SaveSystem auto-migration synchronizes all keys to 3,408 XP (Lv.50)
 * - All 4 innate skills of Lesser titan are 100% unlocked
 */

import { Player } from '../src/entities/Player.js';
import { Map } from '../src/map/Map.js';
import { SaveSystem } from '../src/core/SaveSystem.js';
import { renderMonsterDetailCardHTML } from '../src/ui/MonsterLoreView.js';
import { renderSkillTreeHTML } from '../src/ui/HUDView.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';

console.log("================================================================================");
console.log("🧬 [REAL SAVE DATA TITAN LORE REVERSE-ALIAS MIGRATION TEST] 🧬");
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
// SETUP: Mocking the exact user save state
// -----------------------------------------------------------------------------
const gameMock = {
  floor: 24,
  floorDanger: 4.8,
  map: new Map(20, 20, 1),
  effects: [],
  monsters: [],
  items: [],
  player: new Player(10, 10, 'MON_LESSER_TITAN'),
  logs: [],
  addLogEntry(text, type) { this.logs.push({ text, type }); },
  updateUI() {}
};

// Exact data structure matching user's mimicry_debug_save_F24_1787748363261.json
const userRealSaveData = {
  floor: 24,
  floorDanger: 4.8,
  map: {
    width: 20,
    height: 20,
    floor: 24,
    startingPosition: { x: 5, y: 5 },
    rooms: []
  },
  player: {
    x: 5,
    y: 5,
    name: 'Mighty Mimic',
    level: 24,
    hp: 1200,
    maxHp: 1200,
    speed: 11,
    mimicCore: {
      coreType: 'MON_LESSER_TITAN',
      name: 'Lesser titan',
      char: 'T',
      baseColor: '#fbbf24'
    },
    loreRegistry: {
      'TITAN': 3408,            // Legacy prototype key had 3,408 XP!
      'MON_LESSER_TITAN': 25,   // Newly added canonical key had only 25 XP!
      'Lesser titan': 25,       // Name alias had only 25 XP!
      'SLIME': 800
    },
    inventory: [],
    equipment: { weapon: -1, shield: -1, bow: -1, quiver: -1, armor: -1, helmet: -1, gloves: -1, boots: -1, cloak: -1, subCore1: -1, subCore2: -1, ring1: -1, ring2: -1, amulet: -1, equippedLamp: -1 }
  },
  items: [],
  monsters: []
};

// -----------------------------------------------------------------------------
// TEST 1: Direct Reverse-Alias Lookup on MimicBody (even before migration)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: MimicBody 양방향 별칭(Reverse Alias) 최대치 산출 검증 ---");

const testBodyPlayer = new Player(10, 10, 'MON_LESSER_TITAN');
testBodyPlayer.body.loreRegistry = {
  'TITAN': 3408,
  'MON_LESSER_TITAN': 25,
  'Lesser titan': 25
};

const directXp = testBodyPlayer.body.getLoreXp('MON_LESSER_TITAN');
assert(directXp === 3408, `getLoreXp('MON_LESSER_TITAN')가 TITAN(3408)의 최대 XP를 즉시 산출 (${directXp} XP)`);

const directLvl = testBodyPlayer.body.getLoreLevel('MON_LESSER_TITAN');
assert(directLvl === 50, `getLoreLevel('MON_LESSER_TITAN')가 즉시 만렙(Lv.50)으로 평가됨 (Lv.${directLvl})`);

const morphLvl = testBodyPlayer.getMorphMasteryLevel('MON_LESSER_TITAN');
assert(morphLvl === 50, `player.getMorphMasteryLevel('MON_LESSER_TITAN')가 즉시 Lv.50으로 평가됨 (Lv.${morphLvl})`);

// -----------------------------------------------------------------------------
// TEST 2: SaveSystem.deserialize Real Save Load & Full Key Synchronization
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 실제 세이브 로드 시 전 슬롯 3,408 XP (Lv.50) 완벽 동기화 ---");

SaveSystem.deserialize(gameMock, userRealSaveData);

assert(gameMock.player.body.loreRegistry['MON_LESSER_TITAN'] === 3408, `loreRegistry['MON_LESSER_TITAN']가 3,408 XP로 동기화됨`);
assert(gameMock.player.body.loreRegistry['TITAN'] === 3408, `loreRegistry['TITAN']가 3,408 XP로 보존됨`);
assert(gameMock.player.body.loreRegistry['Lesser titan'] === 3408, `loreRegistry['Lesser titan']가 3,408 XP로 동기화됨`);
assert(gameMock.player.body.loreRegistry['레서 타이탄'] === 3408, `loreRegistry['레서 타이탄'] 한글 별칭도 3,408 XP로 동기화됨`);

assert(gameMock.player.body.getLoreLevel('MON_LESSER_TITAN') === 50, `로드 후 레서 타이탄 로어 레벨 Lv.50 확인`);

// -----------------------------------------------------------------------------
// TEST 3: Active Skills Auto-Rebinding & Unlocked Status
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 장착 코어 activeSkills 4종 자동 복원 및 해금 상태 검증 ---");

assert(gameMock.player.activeSkills.length === 4, "4대 고유 액티브 스킬 배열 바인딩 확인");

gameMock.player.activeSkills.forEach(skill => {
  const isUnlocked = skill.isUnlocked(50);
  assert(isUnlocked === true, `타이탄 스킬 '${skill.name}' (요구 Lv.${skill.requiredMastery}) 해금 확인`);
});

// -----------------------------------------------------------------------------
// TEST 4: Bestiary & HUD SkillTree 100% Unlocked Visual Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 도감 및 스킬트리 모달 100% 해금 UI 검증 ---");

const titanData = TOME_MONSTERS_DATA['MON_LESSER_TITAN'];
const detailHTML = renderMonsterDetailCardHTML(titanData, gameMock.player);

assert(detailHTML.includes('Lv.50'), "도감 상세 카드에 로어 숙련도 Lv.50 표시 확인");
assert(!detailHTML.includes('🔒 잠김'), "도감 상세 카드에 잠긴 스킬 0건 확인");

const skillTreeHTML = renderSkillTreeHTML(gameMock.player);
assert(skillTreeHTML.includes('Lv.50 / 50'), "스킬트리 모달에 Lv.50 / 50 만렙 표시 확인");
assert(skillTreeHTML.includes('🟢 자동 격발 대기'), "스킬트리 모달에 자동 격발 대기 뱃지 노출 확인");
assert(!skillTreeHTML.includes('🔒 잠김'), "스킬트리 모달에 잠김 뱃지 0건 확인");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
