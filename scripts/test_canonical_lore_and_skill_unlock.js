/**
 * scripts/test_canonical_lore_and_skill_unlock.js
 * Unit tests for:
 * 1. MimicBody canonical lore key normalization (getLoreXp, getLoreLevel, gainLoreXp)
 * 2. Cross-alias synchronization (MON_LESSER_TITAN <-> Lesser titan <-> 레서 타이탄)
 * 3. Player morph mastery level resolution
 * 4. HUDView.renderSkillTreeHTML immediate skill unlock (Auto-Ready status) without key mismatch
 */

import { MimicBody } from '../src/entities/MimicBody.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { renderSkillTreeHTML } from '../src/ui/HUDView.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';
import { getSpeciesConfig } from '../src/entities/MonsterRegistry.js';

console.log("================================================================================");
console.log("⚡ [CANONICAL LORE KEY NORMALIZATION & SKILL UNLOCK TEST SUITE] ⚡");
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
// TEST 1: MimicBody Canonical Lore Key Normalization & Synchronization
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: MimicBody 종족 로어 정규 키 정규화 및 다중 키 동기화 검증 ---");

const body = new MimicBody();

// 1. Add XP using English display name 'Lesser titan'
body.gainLoreXp('Lesser titan', 1200);

assert(body.getLoreXp('MON_LESSER_TITAN') === 1200, "ToME 정규 ID(MON_LESSER_TITAN)로 조회 시 1200 XP 반환");
assert(body.getLoreXp('Lesser titan') === 1200, "영문명(Lesser titan)으로 조회 시 1200 XP 반환");
assert(body.getLoreXp('레서 타이탄') === 1200, "한글명(레서 타이탄)으로 조회 시 1200 XP 반환");
assert(body.getLoreXp('TITAN') === 1200, "레거시 별칭(TITAN)으로 조회 시 1200 XP 반환");

// 1200 XP -> 500 + (36-25)*60 = 500 + 660 = 1160 => Lv.36
const lvl1 = body.getLoreLevel('MON_LESSER_TITAN');
assert(lvl1 === 36, `1200 XP 축적 시 Lv.36 산출 (실제: Lv.${lvl1})`);

// 2. Add additional 1200 XP using ToME canonical key 'MON_LESSER_TITAN'
body.gainLoreXp('MON_LESSER_TITAN', 1200);
assert(body.getLoreXp('MON_LESSER_TITAN') === 2400, "추가 경험치 누적 후 2400 XP 동기화 확인");
assert(body.getLoreXp('Lesser titan') === 2400, "추가 경험치 누적 후 영문명 조회 시 2400 XP 동기화 확인");

const lvl2 = body.getLoreLevel('Lesser titan');
assert(lvl2 === 50, `2000 XP 이상 축적 시 만렙 Lv.50 산출 (실제: Lv.${lvl2})`);

// -----------------------------------------------------------------------------
// TEST 2: Slime / Green Ooze Cross-Alias Synchronization
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 슬라임/초록 슬라임(MON_GREEN_OOZE) 다중 별칭 정규화 검증 ---");

body.gainLoreXp('SLIME', 600);
assert(body.getLoreXp('MON_GREEN_OOZE') === 600, "SLIME 입력 후 MON_GREEN_OOZE로 조회 시 600 XP 반환");
assert(body.getLoreXp('초록 슬라임') === 600, "한글명(초록 슬라임)으로 조회 시 600 XP 반환");
assert(body.getLoreXp('Green ooze') === 600, "영문명(Green ooze)으로 조회 시 600 XP 반환");

const slimeLvl = body.getLoreLevel('MON_GREEN_OOZE');
assert(slimeLvl === 26, `600 XP 축적 시 Lv.26 산출 (실제: Lv.${slimeLvl})`);

// -----------------------------------------------------------------------------
// TEST 3: Player Core Morph Mastery & Skill Unlock Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 플레이어 코어 포식 후 스킬 트리 4대 스킬 즉시 해금 검증 ---");

const player = new Player(0, 0);
player.body = body;

// Equip/Morph to Lesser titan core
const titanCore = new Item(0, 0, 'CORE', '%', '#a855f7', 'Lesser titan');
titanCore.coreType = 'MON_LESSER_TITAN';
player.mimicCore = titanCore;

const morphLvl = player.getMorphMasteryLevel();
assert(morphLvl === 50, `player.getMorphMasteryLevel() 호출 시 Lv.50 정상 산출 (실제: Lv.${morphLvl})`);

const titanSkills = player.getInnateSkills();
assert(titanSkills.length >= 1, `Lesser titan 고유 스킬 목록 생성 확인 (개수: ${titanSkills.length})`);

// All skills should be unlocked at Lv.50
const allUnlocked = titanSkills.every(s => s.isUnlocked(morphLvl));
assert(allUnlocked, "Lv.50 상태에서 4대 고유 액티브 스킬이 모두 해금됨 (isUnlocked === true)");

// -----------------------------------------------------------------------------
// TEST 4: HUDView.renderSkillTreeHTML UI Output Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: HUDView.renderSkillTreeHTML UI 렌더링 무결성 검증 ---");

const skillTreeHTML = renderSkillTreeHTML(player);

assert(skillTreeHTML.includes('Lv.50 / 50'), "스킬 트리 상단에 'Lv.50 / 50' 레벨 정상 렌더링");
assert(skillTreeHTML.includes('2400 XP') || skillTreeHTML.includes('2,400 XP'), "스킬 트리 상단에 '2400 XP' 누적 로어 경험치 정상 렌더링");
assert(skillTreeHTML.includes('🟢 자동 격발 대기'), "해금된 스킬에 '🟢 자동 격발 대기 (Auto-Ready)' 배지 렌더링");
assert(!skillTreeHTML.includes('🔒 잠김'), "Lv.50 상태에서 '🔒 잠김' 배지가 전혀 노출되지 않음");

// -----------------------------------------------------------------------------
// TEST 5: Low-Level Core Skill Lock Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 저레벨 코어 장착 시 스킬 단계별 잠금 검증 ---");

// Set novice warrior with 0 XP -> Lv.1
const noviceCore = new Item(0, 0, 'CORE', '%', '#cbd5e1', 'Novice warrior');
noviceCore.coreType = 'MON_NOVICE_WARRIOR';
player.mimicCore = noviceCore;

const noviceLvl = player.getMorphMasteryLevel();
assert(noviceLvl === 1, `0 XP 상태에서 Novice warrior Lv.1 산출 (실제: Lv.${noviceLvl})`);

const noviceHTML = renderSkillTreeHTML(player);
assert(noviceHTML.includes('Lv.1 / 50'), "Novice warrior 스킬 트리에 'Lv.1 / 50' 렌더링");
assert(noviceHTML.includes('0 XP'), "0 XP 정상 렌더링");

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
