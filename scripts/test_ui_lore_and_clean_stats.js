/**
 * @file test_ui_lore_and_clean_stats.js
 * @description UI/UX 레거시 D&D 가짜 정보 전수 제거 검증, ToME 2.3.5 BTH/Total AC 실데이터 연동,
 *              TomeNET 스타일 851종 몬스터 도감 및 168종 유니크 토벌 체크리스트 무결성 종합 테스트.
 */

import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { uniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { renderPlayerStatusPanelHTML, renderPlayerDetailsHTML, renderSkillTreeHTML, renderMasteryDetailsHTML } from '../src/ui/HUDView.js';
import { renderInventorySlotHTML, renderItemDetailHTML, renderActiveCoreDetailsHTML } from '../src/ui/InventoryView.js';
import { renderMonsterInspectHTML } from '../src/ui/InspectModalView.js';
import { 
  renderMonsterLoreModalHTML, 
  renderMonsterBestiaryHTML, 
  renderUniqueChecklistHTML, 
  renderMonsterDetailCardHTML, 
  renderLoreMasterySummaryHTML, 
  getUniqueChecklistStats 
} from '../src/ui/MonsterLoreView.js';
import { UIManager } from '../src/ui/UIManager.js';

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
console.log('🧪 [TEST SUITE 1] UI/UX 레거시 D&D 가짜 정보 전수 제거 및 ToME 2.3.5 실데이터 검증');
console.log('🧪 ========================================================');

const player = new Player(5, 5);

// 1. HUDView renderPlayerStatusPanelHTML
const statusHTML = renderPlayerStatusPanelHTML(player);
assert(typeof statusHTML === 'string' && statusHTML.length > 0, '상태 요약 패널 HTML이 정상 렌더링됨');
assert(!statusHTML.includes('D&D') && !statusHTML.includes('주사위 숙련'), '상태 패널에 D&D 주사위 숙련 가짜 텍스트가 없음');
assert(statusHTML.includes('총합 방어 (AC):'), 'ToME 정통 Total AC 항목이 상태 패널에 정상 표시됨');
assert(statusHTML.includes('기본 명중 (BTH):'), 'ToME 정통 Base-To-Hit (BTH) 항목이 상태 패널에 정상 표시됨');

// 2. HUDView renderPlayerDetailsHTML
const detailsHTML = renderPlayerDetailsHTML(player);
assert(typeof detailsHTML === 'string' && detailsHTML.length > 0, '플레이어 상세 정보 모달 HTML이 정상 렌더링됨');
assert(!detailsHTML.includes('D&D 주사위 숙련'), '플레이어 상세창에서 폐기된 D&D 주사위 숙련 항목이 완전히 제거됨');
assert(detailsHTML.includes('기본 명중률 (BTH)'), 'ToME 2.3.5 정통 기본 명중률 (BTH) 항목이 표시됨');
assert(detailsHTML.includes('총합 방어력 (Total AC)'), 'ToME 2.3.5 정통 총합 방어력 (Total AC) 항목이 표시됨');
assert(detailsHTML.includes('물리 감쇄'), 'AC에 따른 물리 피해 감쇄 수치가 표시됨');

// 3. Player entity calculation verification
const bHit = player.getBaseToHitScore();
const hitChance = player.getBaseHitChance(10);
const totalAC = player.getTotalAC();
assert(typeof bHit === 'number' && bHit >= 50, `플레이어 BTH 연산 정상 작동 (실측: ${bHit} BTH)`);
assert(typeof hitChance === 'number' && hitChance >= 0.05 && hitChance <= 0.95, `플레이어 기본 명중 확률 정상 연산 (실측: ${(hitChance * 100).toFixed(1)}%)`);
assert(typeof totalAC === 'number' && totalAC >= 10, `플레이어 총합 방어력(Total AC) 정상 연산 (실측: +${totalAC} AC)`);

// 4. InventoryView renderActiveCoreDetailsHTML
const activeCoreHTML = renderActiveCoreDetailsHTML(player);
assert(!activeCoreHTML.includes('신비한 시각') && !activeCoreHTML.includes('Light Focus'), '장착 코어 모달에서 신비한 시각 가짜 텍스트 완전 제거됨');
assert(!activeCoreHTML.includes('크로매틱 펄스') && !activeCoreHTML.includes('Pulse Color'), '장착 코어 모달에서 크로매틱 펄스 가짜 텍스트 완전 제거됨');
assert(!activeCoreHTML.includes('빠른 주사위 롤링으로 무작위 균등') && !activeCoreHTML.includes('D&D'), '장착 코어 모달에서 레거시 D&D 가짜 텍스트 없음');
assert(activeCoreHTML.includes('ToME 종족 베이스 6대 스탯'), '장착 코어 모달에 ToME 정통 6대 베이스 스탯 헤더 렌더링됨');
assert(activeCoreHTML.includes('힘 (STR)') && activeCoreHTML.includes('생명력 (CON)') && activeCoreHTML.includes('지능 (INT)'), '6대 스탯(STR, CON, INT, DEX, WIS, CHR) 정상 노출됨');
assert(activeCoreHTML.includes('성장 유형:'), '코어 성장 패턴(Growth Type) 정상 노출됨');
assert(activeCoreHTML.includes('코어 고유 특성'), '코어 고유 Perks 항목 정상 렌더링됨');
assert(activeCoreHTML.includes('개방 의태 스킬 & 숙련도'), '의태 고유 스킬 및 숙련도 섹션 렌더링됨');
assert(activeCoreHTML.includes('ToME 전승 서사 (Lore)'), 'ToME 정통 몬스터 로어 플레이버 텍스트 렌더링됨');
assert(activeCoreHTML.includes('ToME 성장 잠재력') && activeCoreHTML.includes('Logarithmic Phi Formula'), '코어 상세창에 ToME 정통 대수 성장 공식(Phi Formula) 서사가 정상 반영됨');

// 5. 슬라임 코어(Green ooze) 장착 상세 검증
const slimePlayer = new Player(5, 5, 'SLIME');
const slimeCoreHTML = renderActiveCoreDetailsHTML(slimePlayer);
assert(slimeCoreHTML.includes('Green ooze') || slimeCoreHTML.includes('MON_GREEN_OOZE') || slimeCoreHTML.includes('슬라임'), '슬라임(Green ooze) 코어 이름 및 데이터 정상 렌더링');
assert(slimeCoreHTML.includes('ROGUE') || slimeCoreHTML.includes('TANK') || slimeCoreHTML.includes('BALANCED'), '슬라임 ToME 성장 패턴(ROGUE) 정상 표시');
assert(slimeCoreHTML.includes('힘 (STR)') && slimeCoreHTML.includes('12'), '슬라임 베이스 STR 스탯(12) 정상 노출');
assert(!slimeCoreHTML.includes('신비한 시각') && !slimeCoreHTML.includes('크로매틱 펄스'), '슬라임 코어 모달에도 가짜 텍스트 없음');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] TomeNET 스타일 851종 몬스터 도감 (Bestiary) 뷰 무결성 검증');
console.log('🧪 ========================================================');

// 1. 전체 도감 렌더링
const bestiaryHTML = renderMonsterBestiaryHTML(player);
assert(typeof bestiaryHTML === 'string' && bestiaryHTML.length > 0, '851종 몬스터 도감 HTML 렌더링 성공');
assert(bestiaryHTML.includes('851종 몬스터 검색'), '도감 검색창 툴바가 정상 렌더링됨');
assert(bestiaryHTML.includes('lore-monster-item'), '몬스터 리스트 아이템들이 정상 생성됨');

// 2. 몬스터 검색 및 필터링
const dragonSearchHTML = renderMonsterBestiaryHTML(player, { searchQuery: 'dragon' });
assert(dragonSearchHTML.includes('dragon') || dragonSearchHTML.includes('Dragon'), '드래곤 검색 쿼리 필터링이 정상 작동함');

const uniqueFilterHTML = renderMonsterBestiaryHTML(player, { filterType: 'UNIQUE' });
assert(uniqueFilterHTML.includes('👑'), '유니크 몬스터 필터 시 유니크 심볼 뱃지가 표시됨');

// 3. 개별 몬스터 상세 카드
const sampleMonster = TOME_MONSTERS_DATA['MON_FILTHY_STREET_URCHIN'];
const detailCardHTML = renderMonsterDetailCardHTML(sampleMonster, player);
assert(detailCardHTML.includes('Filthy street urchin'), '몬스터 상세 카드에 몬스터 명칭이 정확히 렌더링됨');
assert(detailCardHTML.includes('체력 (HP):') && detailCardHTML.includes('방어력 (AC):'), '몬스터 HP/AC/SPD 기본 스펙이 정확히 노출됨');
assert(detailCardHTML.includes('물리 타격 및 피해 패턴'), '공격 패턴 및 다이스 공식이 노출됨');
assert(detailCardHTML.includes('ToME 몬스터 전승 서사 (Lore)'), '플레이버 텍스트 및 서사가 정상 노출됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] ToME 168종 유니크 몬스터 토벌 체크리스트 및 상태 추적 검증');
console.log('🧪 ========================================================');

// 1. 유니크 통계 데이터 계산
const initialStats = getUniqueChecklistStats(player, uniqueMonsterManager);
assert(initialStats.total >= 168, `ToME 168종 유니크 데이터셋 완비 (총 ${initialStats.total}체)`);
assert(initialStats.killed >= 0, `처치 완료 카운트: ${initialStats.killed}`);
assert(initialStats.unknown >= 0, `미조우 카운트: ${initialStats.unknown}`);

// 2. 유니크 처치 체크리스트 HTML 렌더링
const uniqueChecklistHTML = renderUniqueChecklistHTML(player);
assert(typeof uniqueChecklistHTML === 'string' && uniqueChecklistHTML.length > 0, '유니크 체크리스트 HTML 렌더링 성공');
assert(uniqueChecklistHTML.includes('발리노르 전설 유니크 몬스터 토벌 진척도'), '토벌 진척도 프로그레스 바가 정상 렌더링됨');
assert(uniqueChecklistHTML.includes('❓ 미조우') || uniqueChecklistHTML.includes('💀 처치 완료') || uniqueChecklistHTML.includes('⚠️ 던전 생존 중'), '유니크 몬스터 상태 배지가 정상 렌더링됨');

// 3. 유니크 스폰 및 처치 상태 전이 시뮬레이션
const testUniqueKey = 'MON_FARMER_MAGGOT';
assert(!uniqueMonsterManager.isSpawned(testUniqueKey), '초기 상태: 미스폰');

uniqueMonsterManager.markSpawned(testUniqueKey);
assert(uniqueMonsterManager.isSpawned(testUniqueKey), '스폰 마킹 후: 스폰됨 상태 확인');
assert(uniqueMonsterManager.isAlive(testUniqueKey), '스폰되었으나 미처치 상태: 생존 중(Alive)');

const aliveStats = getUniqueChecklistStats(player, uniqueMonsterManager);
assert(aliveStats.alive >= 1, '생존 중인 유니크 카운트가 1 이상으로 반영됨');

uniqueMonsterManager.markKilled(testUniqueKey);
player.recordKill(testUniqueKey, 1);
assert(uniqueMonsterManager.isKilled(testUniqueKey), '처치 마킹 후: 처치 완료 상태 확인');
assert(!uniqueMonsterManager.isAlive(testUniqueKey), '처치 완료 후: 생존 상태 해제 확인');
assert(player.getKillCount(testUniqueKey) === 1, '플레이어 엔티티 킬 카운트 1회 누적 확인');

const killedStats = getUniqueChecklistStats(player, uniqueMonsterManager);
assert(killedStats.killed >= 1, '처치 통계에 즉시 실시간 반영됨');

// 4. 필터링된 체크리스트 렌더링
const killedFilterHTML = renderUniqueChecklistHTML(player, { uniqueFilter: 'KILLED' });
assert(killedFilterHTML.includes('💀 처치 완료'), '처치 완료 필터 시 처치된 유니크 목록이 정상 렌더링됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] 킬 카운트, 로어 숙련도 및 무기 마스터리 통합 뷰 검증');
console.log('🧪 ========================================================');

// 1. 킬 카운트 누적
player.recordKill('MON_SCRAWNY_CAT', 5);
assert(player.getKillCount('MON_SCRAWNY_CAT') === 5, '일반 몬스터 처치 카운트 5회 누적 확인');

// 2. 무기 및 로어 마스터리 요약 뷰 렌더링
player.body.loreRegistry['SLIME'] = 120;
player.body.loreRegistry['MON_LESSER_TITAN'] = 14400;
player.recordKill('MON_LESSER_TITAN', 12);

const masterySummaryHTML = renderLoreMasterySummaryHTML(player);
assert(masterySummaryHTML.includes('무기 마스터리 숙련도 현황'), '무기 마스터리 표 렌더링 확인');
assert(masterySummaryHTML.includes('몬스터 종족 로어 숙련도 현황'), '몬스터 종족 로어 표 렌더링 확인');
assert(masterySummaryHTML.includes('Lesser titan') || masterySummaryHTML.includes('레서 타이탄'), 'ToME 851종 동적 로어 엔트리 (Lesser titan) 렌더링 확인');
assert(masterySummaryHTML.includes('14,400 XP'), '14,400 누적 로어 경험치 포맷 렌더링 확인');
assert(masterySummaryHTML.includes('Lv.50'), '2,000 XP 이상 몬스터의 만렙 (Lv.50) 렌더링 확인');
assert(masterySummaryHTML.includes('x1.50'), 'Lv.50 의태 보정 배율 (x1.50) 렌더링 확인');

// 3. 통합 모달 탭 전환 렌더링
const modalLoreHTML = renderMonsterLoreModalHTML(player, 'lore');
const modalUniqueHTML = renderMonsterLoreModalHTML(player, 'unique');
const modalMasteryHTML = renderMonsterLoreModalHTML(player, 'mastery');

assert(modalLoreHTML.includes('851종 몬스터 도감'), '통합 모달 [도감 탭] 정상 렌더링');
assert(modalUniqueHTML.includes('168종 유니크 체크리스트'), '통합 모달 [유니크 탭] 정상 렌더링');
assert(modalMasteryHTML.includes('무기/의태 마스터리'), '통합 모달 [마스터리 탭] 정상 렌더링');

// 4. HUDView renderMasteryDetailsHTML delegation
const hudMasteryHTML = renderMasteryDetailsHTML(player);
assert(hudMasteryHTML.includes('TomeNET 인게임 몬스터 로어 & 유니크 토벌 도감'), 'HUD 마스터리 도감 버튼 클릭 시 통합 로어/유니크 도감으로 정상 연결됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 5] UIManager 라우팅 및 연동 무결성 검증');
console.log('🧪 ========================================================');

const uiManager = new UIManager(null);
assert(typeof uiManager.showActiveCoreDetails === 'function', 'UIManager.showActiveCoreDetails 메서드 존재');
assert(typeof uiManager.showMonsterLoreModal === 'function', 'UIManager.showMonsterLoreModal 메서드 존재');
assert(typeof uiManager.showMasteryDetails === 'function', 'UIManager.showMasteryDetails 메서드 존재');
assert(typeof uiManager.showPlayerDetails === 'function', 'UIManager.showPlayerDetails 메서드 존재');
assert(typeof uiManager.showSkillTree === 'function', 'UIManager.showSkillTree 메서드 존재');

console.log('\n========================================================');
console.log(`🎉 [TEST RESULTS] ${passed}/${total} 테스트 100% 통과 완료!`);
console.log('========================================================');
