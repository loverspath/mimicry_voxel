/**
 * @file test_tome_pseudo_id_and_tags.js
 * @description ToME 2.3.5 / TomeNET 정통 4단계 의사 감정(Pseudo-ID), 역보정 & 저주 태그 시스템,
 *              감정/저주해제 주문서 파이프라인 및 플레이어 아이덴티티 매트릭스 통합 단위 테스트
 */

import { Item } from '../src/entities/Item.js';
import { Player } from '../src/entities/Player.js';
import { TomeIdentificationEngine, ID_STATES, PSEUDO_SENSES } from '../src/systems/TomeIdentificationEngine.js';
import { TomeTagSystem, POLARITY, DETRIMENTAL_TAGS } from '../src/systems/TomeTagSystem.js';
import { TomeConsumableEngine } from '../src/systems/TomeConsumableEngine.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { TVAL } from '../src/systems/TomeEquipmentEngine.js';
import { PlayerIdentityModalView, renderPlayerIdentityModalHTML } from '../src/ui/PlayerIdentityModalView.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 1] ToME 4단계 의사 감정(Pseudo-ID) 및 7대 육감 품질 판정 검증');
console.log('='.repeat(80));

// 1-1. 육감 품질 판정 (evaluatePseudoSense)
const averageSword = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
assert(TomeIdentificationEngine.evaluatePseudoSense(averageSword) === PSEUDO_SENSES.AVERAGE, '보정치 0 기본 장비는 {average} 판정');

const goodSword = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
goodSword.toHit = 3;
goodSword.toDmg = 2;
assert(TomeIdentificationEngine.evaluatePseudoSense(goodSword) === PSEUDO_SENSES.GOOD, '양수 보정치 보유 장비는 {good} 판정');

const greatSword = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
greatSword.slayTags['ORC'] = 2.5;
assert(TomeIdentificationEngine.evaluatePseudoSense(greatSword) === PSEUDO_SENSES.GREAT, '슬레이(Slay) 보유 장비는 {great} 판정');

const greatArmor = new Item(0, 0, 'ARMOR', '[', '#cbd5e1', 'Chain Mail', 0, 'ARMOR');
greatArmor.resistances['FIRE'] = 0.5;
assert(TomeIdentificationEngine.evaluatePseudoSense(greatArmor) === PSEUDO_SENSES.GREAT, '원소 저항 보유 방어구는 {great} 판정');

const artifactSword = new Item(0, 0, 'WEAPON', '|', '#ffd700', "Glamdring", 0, 'WEAPON');
artifactSword.artifactKey = 'ART_GLAMDRING';
assert(TomeIdentificationEngine.evaluatePseudoSense(artifactSword) === PSEUDO_SENSES.SPECIAL, '전설 유물은 {special} 판정');

const worthlessDagger = new Item(0, 0, 'WEAPON', '|', '#94a3b8', 'Dagger', 0, 'WEAPON');
worthlessDagger.toHit = -2;
assert(TomeIdentificationEngine.evaluatePseudoSense(worthlessDagger) === PSEUDO_SENSES.WORTHLESS, '마이너스 보정치 불량품은 {worthless} 판정');

const cursedAmulet = new Item(0, 0, 'AMULET', '"', '#ef4444', 'Doom Amulet', 0, 'AMULET');
cursedAmulet.specialTags = ['CURSED'];
assert(TomeIdentificationEngine.evaluatePseudoSense(cursedAmulet) === PSEUDO_SENSES.CURSED, 'CURSED 태그 장비는 {cursed} 판정');

const terribleHelm = new Item(0, 0, 'HELMET', ']', '#ef4444', 'Iron Helm', 0, 'HELMET');
terribleHelm.specialTags = ['HEAVY_CURSED'];
assert(TomeIdentificationEngine.evaluatePseudoSense(terribleHelm) === PSEUDO_SENSES.TERRIBLE, 'HEAVY_CURSED 보유 장비는 {terrible} 판정');

// 1-2. 점진적 정보 개방 (Progressive Disclosure) displayName 테스트
const testSword = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
testSword.toHit = 4;
testSword.toDmg = 5;
testSword.prefixes = ['FIRE'];

assert(testSword.displayName === 'Broad Sword', 'Tier 0 (UNIDENTIFIED) 상태는 베이스명만 노출');

TomeIdentificationEngine.applyPseudoId(testSword);
assert(testSword.idState === ID_STATES.PSEUDO_IDENTIFIED, 'applyPseudoId 호출 시 PSEUDO_IDENTIFIED로 전이');
assert(testSword.displayName === 'Broad Sword {good}', 'Tier 1 (PSEUDO_IDENTIFIED) 상태는 {good} 접미사 부착');

TomeIdentificationEngine.identifyItem(testSword);
assert(testSword.idState === ID_STATES.IDENTIFIED, 'identifyItem 호출 시 IDENTIFIED로 전이');
assert(testSword.displayName.includes('불타는') && testSword.displayName.includes('(+4,+5)'), 'Tier 2 (IDENTIFIED) 상태는 에고 접사 및 보정치 공개');

TomeIdentificationEngine.starIdentifyItem(testSword);
assert(testSword.idState === ID_STATES.STAR_IDENTIFIED, 'starIdentifyItem 호출 시 STAR_IDENTIFIED로 전이');
assert(testSword.displayName.includes('*IDENTIFIED*'), 'Tier 3 (STAR_IDENTIFIED) 상태는 *IDENTIFIED* 칭호 부착');

// 1-3. 착용 센싱 자동 발현 (Wield Sense)
const player1 = new Player(0, 0);
const mysteryRing = new Item(0, 0, 'RING', '=', '#fbbf24', 'Ring', 0, 'RING');
mysteryRing.statBonuses = { dex: 3 };
mysteryRing.toHit = 2;
player1.equipItem(mysteryRing);

assert(mysteryRing.idState === ID_STATES.UNIDENTIFIED, '장착 직후에는 미식별 상태 유지');
TomeIdentificationEngine.processTurnSense(player1);
TomeIdentificationEngine.processTurnSense(player1);
assert(mysteryRing.idState === ID_STATES.UNIDENTIFIED, '2턴 경과 시까지는 미식별 유지');

let senseDiscovered = false;
TomeIdentificationEngine.processTurnSense(player1, (it, slot) => {
  senseDiscovered = true;
});
assert(mysteryRing.idState === ID_STATES.PSEUDO_IDENTIFIED, '3턴 경과 시 Wield Sense로 {good} 육감 자동 발현');
assert(senseDiscovered === true, '신규 육감 획득 콜백 정상 트리거');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 2] 정통 저주(Curse) 탈착 불가 결속 및 디트리멘탈 태그 검증');
console.log('='.repeat(80));

// 2-1. 태그 레지스트리 및 극성
assert(Object.keys(DETRIMENTAL_TAGS).length >= 15, '15종 이상의 디트리멘탈 태그 레지스트리 등록');
assert(DETRIMENTAL_TAGS.CURSED.polarity === POLARITY.DETRIMENTAL, 'CURSED 태그 극성은 DETRIMENTAL');
assert(DETRIMENTAL_TAGS.TELEPORT_RANDOM.polarity === POLARITY.DETRIMENTAL, 'TELEPORT_RANDOM 태그 극성은 DETRIMENTAL');
assert(DETRIMENTAL_TAGS.DRAIN_EXP.polarity === POLARITY.DETRIMENTAL, 'DRAIN_EXP 태그 극성은 DETRIMENTAL');

// 2-2. 탈착 불가 검증 (canUnequip)
const normalArmor = new Item(0, 0, 'ARMOR', '[', '#cbd5e1', 'Chain Mail', 0, 'ARMOR');
assert(TomeTagSystem.canUnequip(normalArmor) === true, '일반 장비는 자유롭게 탈착 가능');

const cursedBoots = new Item(0, 0, 'BOOTS', ']', '#ef4444', 'Iron Boots', 0, 'BOOTS');
cursedBoots.specialTags = ['CURSED'];
assert(TomeTagSystem.canUnequip(cursedBoots) === false, 'CURSED 태그 장비는 canUnequip=false');

// 2-3. 플레이어 장착 및 탈착 봉인 검증
const player2 = new Player(0, 0);
player2.equipItem(cursedBoots);
assert(player2.equipment.boots === cursedBoots, '저주받은 부츠 장착 성공');
assert(cursedBoots.isCursed === true, '장착 시 isCursed 플래그 활성화');

const unequipAttempt = player2.unequipItem(cursedBoots);
assert(unequipAttempt === false, '저주받은 장비는 unequipItem 호출 시 false 반환 및 탈착 거부');
assert(player2.equipment.boots === cursedBoots, '탈착 실패 후에도 장착 슬롯에 잔류');

// 2-4. 턴 라이프사이클 디트리멘탈 훅 검증
let curseLog = '';
const mockGame = {
  map: { getRandomWalkableTile: () => ({ x: 15, y: 25 }) },
  monsters: [{ isAsleep: true }, { isAsleep: true }]
};
const teleportItem = new Item(0, 0, 'RING', '=', '#c084fc', 'Ring of Chaos', 0, 'RING');
teleportItem.specialTags = ['TELEPORT_RANDOM', 'CURSED'];
player2.equipItem(teleportItem);

// 강제 트리거 시뮬레이션
DETRIMENTAL_TAGS.TELEPORT_RANDOM.onTurnTick(player2, teleportItem, mockGame, (msg) => { curseLog = msg; }, true);
assert(player2.x === 15 && player2.y === 25, 'TELEPORT_RANDOM 턴 틱 시 플레이어 좌표 강제 전송');
assert(curseLog.includes('공간왜곡 저주'), '텔레포트 저주 경고 로그 발송');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 3] 저주 해제 주문서(Remove Curse) 파이프라인 검증');
console.log('='.repeat(80));

// 3-1. 일반 저주 해제 주문서 (Scroll of Remove Curse)
const removeCurseRes = TomeTagSystem.removeCurse(cursedBoots, false);
assert(removeCurseRes.success === true, '일반 저주 장비 저주 해제 성공');
assert(cursedBoots.isCursed === false, '해제 후 isCursed=false');
assert(TomeTagSystem.canUnequip(cursedBoots) === true, '저주 해제 후 탈착 가능');

const unequipSuccess = player2.unequipItem(cursedBoots);
assert(unequipSuccess === true, '저주 해제 후 정상 탈착 완료');
assert(player2.equipment.boots === null, '탈착 후 슬롯 비워짐');

// 3-2. 영구 저주(PERMA_CURSED) 가드 검증
const permaCursedWeapon = new Item(0, 0, 'WEAPON', '|', '#b91c1c', 'Abyssal Blade', 0, 'WEAPON');
permaCursedWeapon.specialTags = ['PERMA_CURSED'];
permaCursedWeapon.isCursed = true;

const normalScrollFail = TomeTagSystem.removeCurse(permaCursedWeapon, false);
assert(normalScrollFail.success === false, '영구 저주는 일반 주문서로 해제 불가');
assert(permaCursedWeapon.isCursed === true, '영구 저주 장비 저주 상태 유지');

const starScrollSuccess = TomeTagSystem.removeCurse(permaCursedWeapon, true);
assert(starScrollSuccess.success === true, '강력한 *저주 해제* 주문서로는 영구 저주 해제 성공');
assert(permaCursedWeapon.isCursed === false, '정화 후 isCursed=false');

// 3-3. 전 슬롯 일괄 정화 (removeAllCurses)
const player3 = new Player(0, 0);
const c1 = new Item(0, 0, 'HELMET', ']', '#ef4444', 'Cursed Helm', 0, 'HELMET');
c1.specialTags = ['CURSED'];
const c2 = new Item(0, 0, 'ARMOR', '[', '#ef4444', 'Cursed Plate', 0, 'ARMOR');
c2.specialTags = ['HEAVY_CURSED'];
player3.equipItem(c1);
player3.equipItem(c2);

const clearedCount = TomeTagSystem.removeAllCurses(player3);
assert(clearedCount === 2, '착용 중인 모든 저주 장비(2개) 일괄 정화');
assert(c1.isCursed === false && c2.isCursed === false, '모든 슬롯 저주 정화 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 4] 감정 및 저주 해제 주문서 TomeConsumableEngine 사용 검증');
console.log('='.repeat(80));

const player4 = new Player(0, 0);
const unidentWeapon = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
unidentWeapon.toHit = 6;
unidentWeapon.toDmg = 8;
unidentWeapon.suffixes = ['SLAYER'];
player4.equipItem(unidentWeapon);

// 감정 주문서 생성 (sval 13)
const identifyScroll = new Item(0, 0, 'SCROLL', '?', '#fb7185', 'Scroll of Identify', 0, null);
identifyScroll.tval = TVAL.SCROLL;
identifyScroll.sval = 13;

let scrollLogs = [];
const logCb = (m, t) => scrollLogs.push(m);

const idResult = TomeConsumableEngine.useConsumable(identifyScroll, player4, null, logCb, unidentWeapon);
assert(idResult === true, '감정의 주문서 사용 성공');
assert(unidentWeapon.idState === ID_STATES.IDENTIFIED, '대상 장비 IDENTIFIED로 감정 완료');
assert(scrollLogs.some(l => l.includes('고대의 식별 마력')), '감정 성공 로그 출력 확인');

// 진실의 감정 주문서 생성 (sval 14)
const starIdScroll = new Item(0, 0, 'SCROLL', '?', '#fb7185', 'Scroll of *Identify*', 0, null);
starIdScroll.tval = TVAL.SCROLL;
starIdScroll.sval = 14;

const starIdResult = TomeConsumableEngine.useConsumable(starIdScroll, player4, null, logCb, unidentWeapon);
assert(starIdResult === true, '진실의 감정 주문서 사용 성공');
assert(unidentWeapon.idState === ID_STATES.STAR_IDENTIFIED, '대상 장비 STAR_IDENTIFIED로 완전 감정 완료');

// 저주 해제 주문서 사용 (sval 15)
const cursedRing = new Item(0, 0, 'RING', '=', '#ef4444', 'Cursed Band', 0, 'RING');
cursedRing.specialTags = ['CURSED'];
player4.equipItem(cursedRing);
assert(cursedRing.isCursed === true, '저주 반지 장착');

const removeCurseScroll = new Item(0, 0, 'SCROLL', '?', '#fb7185', 'Scroll of Remove Curse', 0, null);
removeCurseScroll.tval = TVAL.SCROLL;
removeCurseScroll.sval = 15;

const rcResult = TomeConsumableEngine.useConsumable(removeCurseScroll, player4, null, logCb, cursedRing);
assert(rcResult === true, '저주 해제 주문서 사용 성공');
assert(cursedRing.isCursed === false, '저주 반지 정화 완료');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 5] 스포너 & 전리품 생성기 역보정(Negative Calibration) 수학적 모델 검증');
console.log('='.repeat(80));

// 1,000개 장비 생성 시 역보정 및 저주 장비 출현율 검증
let negCount = 0;
let cursedSpawnCount = 0;
const SIMULATION_RUNS = 1000;

for (let i = 0; i < SIMULATION_RUNS; i++) {
  const testItem = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
  TomeLootGenerator.applyNegativeCalibration(testItem, 1);
  if (testItem.toHit < 0 || testItem.toDmg < 0 || testItem.baseAC < 0) {
    negCount++;
  }
  if (testItem.isCursed) {
    cursedSpawnCount++;
  }
}

const negRate = (negCount / SIMULATION_RUNS) * 100;
const curseRate = (cursedSpawnCount / SIMULATION_RUNS) * 100;
console.log(`  📊 1층 1,000회 시뮬레이션: 역보정 출현율 ${negRate.toFixed(1)}%, 저주 출현율 ${curseRate.toFixed(1)}%`);

assert(negRate >= 8.0 && negRate <= 25.0, `1층 역보정 발생률 8~25% 범위 적합 (실제: ${negRate.toFixed(1)}%)`);
assert(cursedSpawnCount > 0, `저주 장비가 0건 이상 출현 확인 (${cursedSpawnCount}건)`);

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 6] 모바일 플레이어 아이덴티티 매트릭스 UI 컴포넌트 검증');
console.log('='.repeat(80));

const player5 = new Player(0, 0);
player5.baseStats = { str: 16, dex: 14, con: 15, int: 10, wis: 12, chr: 8 };

// Tab 1: STATS
const statsHtml = renderPlayerIdentityModalHTML(player5, 'STATS');
assert(statsHtml.includes('identity-modal-sheet'), '모바일 바텀시트 컨테이너 렌더링');
assert(statsHtml.includes('힘 (STR)') && statsHtml.includes('민첩 (DEX)'), '6대 스탯 카드 마크업 포함');

// Tab 2: RESIST
const resistHtml = renderPlayerIdentityModalHTML(player5, 'RESIST');
assert(resistHtml.includes('화염') && resistHtml.includes('냉기') && resistHtml.includes('황천/지옥'), '14대 원소 저항 칩 마크업 포함');
assert(resistHtml.includes('resist-chip-card'), '원소 칩 카드 렌더링');

// Tab 3: TRAITS
const traitsHtml = renderPlayerIdentityModalHTML(player5, 'TRAITS');
assert(traitsHtml.includes('오크 학살') && traitsHtml.includes('용 학살'), '슬레이(Slay) 매트릭스 목록 포함');
assert(traitsHtml.includes('마비/기절 면역 (Free Action)'), '핵심 상태이상 면역 배지 포함');

// View 클래스 인스턴스화
const identityView = new PlayerIdentityModalView('test-identity-modal');
assert(identityView.currentTab === 'STATS', '기본 탭은 STATS');
identityView.switchTab('RESIST', player5);
assert(identityView.currentTab === 'RESIST', 'switchTab으로 활성 탭 전환 성공');

console.log('='.repeat(80));
console.log(`🎉 [TEST SUMMARY] 총 ${passed + failed}개 검증 중 ${passed}개 통과 (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
