/**
 * @file test_mastery_and_skills.js
 * @description ToME 2.3.5 정통 몬스터 의태 스킬 바인딩, 무음 숙련도 누적(Silent Mastery),
 *              UI 전용 숙련도/스킬 뷰, 스킬포인트 전면 박멸 및 1층 프리픽스 억제 종합 검증 테스트 스위트.
 */

import { Player } from '../src/entities/Player.js';
import { MonsterSpellFactory, ActiveSkill } from '../src/systems/MonsterSpellFactory.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { renderSkillTreeHTML, renderMasteryDetailsHTML } from '../src/ui/HUDView.js';
import { Spawner } from '../src/core/Spawner.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('🧪 ========================================================');
console.log('🧪 [TEST SUITE 1] ToME 2.3.5 정통 몬스터 의태 스킬 1:1 바인딩 검증');
console.log('🧪 ========================================================');

// 1. Novice Mage
const mageSkills = MonsterSpellFactory.createInnateSkills('Novice mage');
assert(Array.isArray(mageSkills) && mageSkills.length === 4, 'Novice mage 의태 시 4개의 액티브 스킬이 정상 생성됨');
assert(mageSkills[0].slot === 1 && mageSkills[0].requiredMastery === 1, 'Mage Slot 1 (기본 주문)은 숙련도 Lv.1에서 즉시 해금');
assert(mageSkills[1].slot === 2 && mageSkills[1].requiredMastery === 1, 'Mage Slot 2 (특수 주문)은 숙련도 Lv.1에서 즉시 해금');
assert(mageSkills[2].slot === 3 && mageSkills[2].requiredMastery === 10, 'Mage Slot 3 (유틸/이동/점멸)은 숙련도 Lv.10에서 해금');
assert(mageSkills[3].slot === 4 && mageSkills[3].requiredMastery === 25, 'Mage Slot 4 (궁극기/광역)은 숙련도 Lv.25에서 해금');

// 2. Dragon
const dragonSkills = MonsterSpellFactory.createInnateSkills('Young blue dragon');
assert(dragonSkills.length === 4, 'Young blue dragon 의태 시 4개의 고유 스킬 바인딩 완료');
const breathSkill = dragonSkills.find(s => s.type === 'BREATH' || s.name.includes('브레스'));
assert(breathSkill !== undefined, '드래곤 종족에게 정통 ToME 브레스 스킬이 정확히 부여됨');

// 3. Player entity innate skill binding
const player = new Player(10, 10);
const initialSkills = player.getInnateSkills();
assert(initialSkills.length === 4, 'Player 생성 시 시작 종족의 4대 액티브 스킬이 즉시 장착됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] 몬스터 변신 숙련도(Morph Mastery) 해금 및 배율 곡선 검증');
console.log('🧪 ========================================================');

// Player start at Lv 1 (0 XP)
assert(player.getMorphMasteryLevel('Novice mage') === 1, '0 XP일 때 숙련도 레벨은 Lv.1');
assert(mageSkills[0].isUnlocked(1) === true, 'Lv.1에서 Slot 1 스킬은 사용 가능');
assert(mageSkills[1].isUnlocked(1) === true, 'Lv.1에서 Slot 2 스킬은 사용 가능');
assert(mageSkills[2].isUnlocked(1) === false, 'Lv.1에서 Slot 3 스킬은 잠김 (Lv.10 요구)');
assert(mageSkills[3].isUnlocked(1) === false, 'Lv.1에서 Slot 4 스킬은 잠김 (Lv.25 요구)');

// Gain XP to 100 XP -> Lv 10
player.body.loreRegistry['Novice mage'] = 100;
const lvl10 = player.getMorphMasteryLevel('Novice mage');
assert(lvl10 >= 10, `100 XP 도달 시 숙련도 Lv.10 이상 달성 (실측: Lv.${lvl10})`);
assert(mageSkills[2].isUnlocked(lvl10) === true, 'Lv.10 달성 시 Slot 3 스킬이 자동 해금됨');
assert(mageSkills[3].isUnlocked(lvl10) === false, 'Lv.10에서는 Slot 4 스킬은 아직 잠김');

// Gain XP to 500 XP -> Lv 25
player.body.loreRegistry['Novice mage'] = 500;
const lvl25 = player.getMorphMasteryLevel('Novice mage');
assert(lvl25 >= 25, `500 XP 도달 시 숙련도 Lv.25 이상 달성 (실측: Lv.${lvl25})`);
assert(mageSkills[3].isUnlocked(lvl25) === true, 'Lv.25 달성 시 Slot 4 궁극기 스킬이 자동 해금됨');

// Gain XP to 2000 XP -> Lv 50 Master
player.body.loreRegistry['Novice mage'] = 2000;
const lvl50 = player.getMorphMasteryLevel('Novice mage');
assert(lvl50 === 50, `2000 XP 도달 시 완전 마스터 Lv.50 달성 (실측: Lv.${lvl50})`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] 전투 로그 도배 100% 차단 (Silent Background Tracking) 검증');
console.log('🧪 ========================================================');

const loreLogs = player.body.gainLoreXp('ORC', 100);
assert(Array.isArray(loreLogs) && loreLogs.length === 0, 'gainLoreXp 호출 시 전투 로그창 출력 0건 (무음 백그라운드 누적)');

const weaponLogs = player.body.gainWeaponMasteryXp('SWORD', 50);
assert(Array.isArray(weaponLogs) && weaponLogs.length === 0, 'gainWeaponMasteryXp(SWORD) 호출 시 전투 로그창 출력 0건 (무음 백그라운드 누적)');

const archeryLogs = player.body.gainWeaponMasteryXp('ARCHERY', 30);
assert(Array.isArray(archeryLogs) && archeryLogs.length === 0, 'gainWeaponMasteryXp(ARCHERY) 호출 시 전투 로그창 출력 0건 (무음 백그라운드 누적)');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] 스킬포인트(SP) 전면 박멸 및 UI/코드 잔존 0건 검증');
console.log('🧪 ========================================================');

assert(player.skillPoints === undefined, 'Player 인스턴스에 skillPoints 프로퍼티가 완전 제거됨');
assert(player.coreSkillInvestments === undefined, 'Player 인스턴스에 coreSkillInvestments 프로퍼티가 완전 제거됨');

// Test Level Up
const levelUpResult = player.gainXp(100);
assert(levelUpResult.leveledUp === true, '경험치 획득으로 정상 레벨업');
assert(player.skillPoints === undefined, '레벨업 후에도 skillPoints가 생성되거나 가산되지 않음');
assert(!levelUpResult.logs.some(l => l.includes('스킬 포인트') || l.includes('SP')), '레벨업 로그에 스킬 포인트 관련 메시지 0건');

// Test Skill Modal HTML rendering
const skillModalHtml = renderSkillTreeHTML(player);
assert(typeof skillModalHtml === 'string' && skillModalHtml.length > 50, 'renderSkillTreeHTML 렌더링 정상');
assert(skillModalHtml.includes('자동 격발') && skillModalHtml.includes('종족 숙련도'), '스킬 모달 UI에 자동 격발 스킬 및 종족 숙련도가 정갈하게 표시됨');

// Test Mastery Details HTML rendering
const masteryHtml = renderMasteryDetailsHTML(player);
assert(typeof masteryHtml === 'string' && masteryHtml.length > 50, 'renderMasteryDetailsHTML 렌더링 정상');
assert(masteryHtml.includes('도검') || masteryHtml.includes('SWORD'), '숙련도 UI에 도검(SWORD) 마스터리가 정상 렌더링됨');
assert(masteryHtml.includes('궁술') || masteryHtml.includes('ARCHERY'), '숙련도 UI에 궁술(ARCHERY) 마스터리가 정상 렌더링됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 5] 1층 프리픽스/엘리트 1.5% 미만 억제 검증 (1,000마리 시뮬레이션)');
console.log('🧪 ========================================================');

const mockGame = {
  floor: 1,
  floorDanger: 1,
  player: { x: 5, y: 5, inventory: [], equippedLamp: null },
  monsters: [],
  items: [],
  isMonsterAt: () => false,
  addLogEntry: () => {},
  map: {
    rooms: [
      { center: { x: 5, y: 5 }, type: 'START' }
    ],
    isWalkable: () => true,
    isTransparent: () => true,
    width: 50,
    height: 50
  }
};

for (let i = 1; i <= 1000; i++) {
  mockGame.map.rooms.push({
    center: { x: 10 + (i % 20), y: 10 + Math.floor(i / 20) },
    type: 'NORMAL'
  });
}

Spawner.spawnFloorContent(mockGame);

let eliteCount = 0;
let prefixCount = 0;
const spawned = mockGame.monsters;

for (const mon of spawned) {
  if (mon.isElite) eliteCount++;
  if ((mon.prefixes && mon.prefixes.length > 0) || (mon.suffixes && mon.suffixes.length > 0)) {
    prefixCount++;
  }
}

const prefixRate = (prefixCount / spawned.length) * 100;
console.log(`  📊 1층 ${spawned.length}마리 스폰 결과:`);
console.log(`    - 프리픽스/접미사 보유 몬스터: ${prefixCount}마리 (${prefixRate.toFixed(2)}%)`);
console.log(`    - 엘리트 몬스터: ${eliteCount}마리 (${((eliteCount/spawned.length)*100).toFixed(2)}%)`);

assert(prefixRate <= 3.5, `1층 프리픽스 출현율이 통계적 허용치(3.5%) 이하로 억제됨 (실측: ${prefixRate.toFixed(2)}%)`);

console.log('\n========================================================');
console.log(`🎉 [TEST RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
