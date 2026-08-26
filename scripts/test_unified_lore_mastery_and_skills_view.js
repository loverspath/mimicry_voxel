/**
 * scripts/test_unified_lore_mastery_and_skills_view.js
 * Unit tests verifying:
 * 1. Monster Bestiary detail cards integrate the 4 Innate Skills with real-time Lore Level unlock states
 * 2. Inventory Core detail inspector displays the exact 4 skills of the inspected coreType (1:1 mapping, no active core leakage)
 * 3. SSOT (Single Source of Truth) dynamic lore mastery methods are used across all views without hardcoded arrays
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { renderMonsterDetailCardHTML, renderMonsterLoreModalHTML } from '../src/ui/MonsterLoreView.js';
import { renderActiveCoreDetailsHTML } from '../src/ui/InventoryView.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';

console.log("================================================================================");
console.log("🧬 [UNIFIED LORE MASTERY & INNATE SKILLS VIEW TEST SUITE] 🧬");
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
const player = new Player(10, 10, 'MON_NOVICE_WARRIOR');
const redDragonData = TOME_MONSTERS_DATA['MON_RED_DRAGON'] || {
  key: 'MON_RED_DRAGON',
  name: 'Ancient red dragon',
  char: 'D',
  baseColor: '#ef4444',
  level: 45,
  coreBaseHp: 1800,
  baseAC: 90,
  speed: 12.0
};

// -----------------------------------------------------------------------------
// TEST 1: Monster Bestiary Detail Card Integrates 4 Innate Skills
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: 도감 상세 카드 4대 고유 의태 스킬 통합 검증 ---");

const detailHTML = renderMonsterDetailCardHTML(redDragonData, player);
assert(detailHTML.includes('4대 고유 의태 스킬'), "상세 카드에 '4대 고유 의태 스킬' 섹션 존재 확인");

const dragonSkills = MonsterSpellFactory.createInnateSkills('MON_RED_DRAGON');
assert(dragonSkills.length === 4, "레드 드래곤 4대 고유 스킬 생성 성공");

dragonSkills.forEach(skill => {
  assert(detailHTML.includes(skill.name), `도감 상세 카드에 스킬 '${skill.name}' 렌더링 확인`);
});

assert(detailHTML.includes('🟢 해금') || detailHTML.includes('🔒 잠김'), "스킬 해금 상태 뱃지 렌더링 확인");

// -----------------------------------------------------------------------------
// TEST 2: Real-time Unlock State Synchronization with Lore Level
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 로어 레벨 성장에 따른 실시간 스킬 해금 뱃지 검증 ---");

// Level 1: Only Lv.1 skill is unlocked
const lvl1HTML = renderMonsterDetailCardHTML(redDragonData, player);
assert(lvl1HTML.includes('🟢 해금 (Lv.1)'), "Lv.1 기본 스킬 해금 뱃지 확인");
assert(lvl1HTML.includes('🔒 잠김 (요구 Lv.10)'), "Lv.10 요구 스킬 잠김 뱃지 확인");

// Gain Lore XP -> 600 XP (Lore Lv.26)
player.body.gainLoreXp('MON_RED_DRAGON', 600);
const loreLvl = player.body.getLoreLevel('MON_RED_DRAGON');
assert(loreLvl >= 25, `레드 드래곤 로어 레벨 Lv.${loreLvl} 성장 확인`);

const lvl26HTML = renderMonsterDetailCardHTML(redDragonData, player);
assert(lvl26HTML.includes('🟢 해금 (Lv.10)'), "Lv.10 스킬 실시간 해금 전환 확인");
assert(lvl26HTML.includes('🟢 해금 (Lv.25)'), "Lv.25 스킬 실시간 해금 전환 확인");

// -----------------------------------------------------------------------------
// TEST 3: Inventory Core Detail Inspector 1:1 Mapping (No Active Core Leakage)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 인벤토리 코어 인스펙터 스킬 1:1 바인딩 검증 ---");

const dragonCoreItem = new Item(0, 0, 'CORE', '%', '#ef4444', 'Ancient red dragon core');
dragonCoreItem.coreType = 'MON_RED_DRAGON';

// Player active core is Novice Warrior, but inspecting dragonCoreItem
const coreInspectorHTML = renderActiveCoreDetailsHTML(dragonCoreItem, player);

assert(!coreInspectorHTML.includes('회전 베기'), "장착 중인 전사 스킬(회전 베기)이 용 코어에 오염 출력되지 않음");
dragonSkills.forEach(skill => {
  assert(coreInspectorHTML.includes(skill.name), `인스펙터에 용 코어 전용 스킬 '${skill.name}' 직결 렌더링 확인`);
});

// -----------------------------------------------------------------------------
// TEST 4: Unified Terminology & Modal Header
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 용어 단일화 (Lore Mastery Lv.1~50) 검증 ---");

const modalHTML = renderMonsterLoreModalHTML(player, 'lore');
assert(modalHTML.includes('🧬 몬스터 로어 숙련도 & ToME 도감 (Lore Mastery Lv.1~50)'), "통합 헤더 단일화 명칭 확인");
assert(modalHTML.includes('🧬 로어 숙련도 & 무기 마스터리'), "탭 버튼 단일화 명칭 확인");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
