/**
 * @file test_status_effect_engine.js
 * @description StatusEffectEngine 전담 단위 테스트 스위트
 *              1. ToME 정통 14대 상태이상/버프 카탈로그 등록 및 무결성 검증
 *              2. 플래그 기반 동적 면역(FREE_ACT, NO_CONF, NO_BLIND, NO_FEAR/HERO, IM_POIS 등) 검증
 *              3. 독 DoT 대미지 및 RES_POIS 50% 감쇄 / IM_POIS 100% 면역 검증
 *              4. 출혈(BLEED) 물리 DoT 및 마나 고갈(DRAIN_MANA) 검증
 *              5. 버프 효과(HASTE, HERO, MANA_SHIELD, BLESS, SEE_INVIS, RES_*) 및 calculateStatusModifiers 검증
 *              6. Player 및 Monster의 this.statuses 와 this.debuffs 레거시 프록시 양방향 연동 검증
 *              7. tickStatuses 턴 경과 및 지속시간 만료 해제 검증
 */

import { StatusEffectEngine, STATUS_DEFINITIONS } from '../src/systems/StatusEffectEngine.js';
import { TomeFlagResolver } from '../src/systems/TomeFlagResolver.js';
import { UnifiedTraitEngine } from '../src/systems/UnifiedTraitEngine.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';

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
console.log('🧪 [TEST SUITE 1] ToME 정통 14대 상태이상/버프 카탈로그 무결성 검증');
console.log('🧪 ========================================================');

const requiredCatalogKeys = [
  'PARALYZED',
  'CONFUSED',
  'BLIND',
  'AFRAID',
  'POISON',
  'BLEED',
  'SLOW',
  'FROST',
  'DRAIN_MANA',
  'HASTE',
  'HERO',
  'MANA_SHIELD',
  'BLESS',
  'SEE_INVIS',
  'RES_FIRE',
  'RES_COLD',
  'RES_ELEC',
  'RES_ACID'
];

for (const key of requiredCatalogKeys) {
  const def = STATUS_DEFINITIONS[key];
  assert(def !== undefined, `카탈로그 상태 정의 존재: ${key}`);
  assert(typeof def.name === 'string' && def.name.length > 0, `${key} 한글명 정의: ${def.name}`);
  assert(typeof def.category === 'string', `${key} 카테고리 정의 (${def.category})`);
}

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] 플래그 및 장비 기반 동적 면역(Immunity) 파이프라인 검증');
console.log('🧪 ========================================================');

// 1. FREE_ACT 착용 시 마비 100% 면역 검증
const player = new Player(5, 5);
assert(!StatusEffectEngine.isImmune(player, 'PARALYZED'), '기본 플레이어: 마비 면역 없음');

// FREE_ACT 반지 착용
const freeActionRing = new Item(0, 0, 'RING', '=', '#fbbf24', 'Ring of Free Action', 0, 'RING');
freeActionRing.flags = ['FREE_ACT'];
player.equipment.ring1 = freeActionRing;

assert(StatusEffectEngine.isImmune(player, 'PARALYZED'), 'FREE_ACT 장착 후: 마비 면역 활성화');
const applyParalyzeRes = StatusEffectEngine.applyStatus(player, 'PARALYZED', 5);
assert(applyParalyzeRes.applied === false && applyParalyzeRes.reason === 'IMMUNE', '마비 적용 시 면역 저항 확인');
assert(!StatusEffectEngine.hasStatus(player, 'PARALYZED'), '마비 상태 미적용 유지 확인');

// 2. NO_CONF / RES_CONF 착용 시 혼란 100% 면역 검증
assert(!StatusEffectEngine.isImmune(player, 'CONFUSED'), '기본 플레이어: 혼란 면역 없음');
const noConfHelm = new Item(0, 0, 'HELMET', ']', '#c084fc', 'Helm of Clarity', 0, 'HELMET');
noConfHelm.flags = ['NO_CONF'];
player.equipment.helmet = noConfHelm;

assert(StatusEffectEngine.isImmune(player, 'CONFUSED'), 'NO_CONF 장착 후: 혼란 면역 활성화');
const applyConfRes = StatusEffectEngine.applyStatus(player, 'CONFUSED', 4);
assert(applyConfRes.applied === false && applyConfRes.reason === 'IMMUNE', '혼란 적용 시 면역 저항 확인');

// 3. NO_BLIND 착용 시 실명 100% 면역 검증
assert(!StatusEffectEngine.isImmune(player, 'BLIND'), '기본 플레이어: 실명 면역 없음');
const noBlindAmulet = new Item(0, 0, 'AMULET', '"', '#64748b', 'Amulet of True Sight', 0, 'AMULET');
noBlindAmulet.flags = ['NO_BLIND'];
player.equipment.amulet = noBlindAmulet;

assert(StatusEffectEngine.isImmune(player, 'BLIND'), 'NO_BLIND 장착 후: 실명 면역 활성화');
const applyBlindRes = StatusEffectEngine.applyStatus(player, 'BLIND', 4);
assert(applyBlindRes.applied === false && applyBlindRes.reason === 'IMMUNE', '실명 적용 시 면역 저항 확인');

// 4. NO_FEAR 및 HERO 버프 활성화 시 공포 면역 검증
const monster = new Monster(10, 10, 'MON_GOBLIN');
assert(!StatusEffectEngine.isImmune(monster, 'AFRAID'), '일반 고블린: 공포 면역 없음');

// 고블린에 HERO 버프 부여
StatusEffectEngine.applyStatus(monster, 'HERO', 10);
assert(StatusEffectEngine.isImmune(monster, 'AFRAID'), 'HERO 버프 보유 시: 공포 면역 자동 활성화');
const applyAfraidRes = StatusEffectEngine.applyStatus(monster, 'AFRAID', 4);
assert(applyAfraidRes.applied === false && applyAfraidRes.reason === 'IMMUNE', 'HERO 보유자에게 공포 적용 시 면역 저항');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] 독 DoT 대미지 및 저항 감쇄(RES_POIS 50%, IM_POIS 100%) 검증');
console.log('🧪 ========================================================');

const victimNormal = new Monster(1, 1, 'MON_GOBLIN');
victimNormal.stats.hp = 20;
victimNormal.stats.maxHp = 20;

// 1. 일반 피해 독 적용 (위력 4, 지속 3턴)
StatusEffectEngine.applyStatus(victimNormal, 'POISON', 3, 4);
assert(StatusEffectEngine.hasStatus(victimNormal, 'POISON'), '독 상태이상 정상 적용');
assert(victimNormal.statuses.POISON.duration === 3, '독 지속시간 3턴 확인');

// 1턴 틱 진행
const tick1 = StatusEffectEngine.tickStatuses(victimNormal);
assert(victimNormal.stats.hp === 16, `일반 독 틱 대미지 4 적용 (20 -> ${victimNormal.stats.hp})`);
assert(victimNormal.statuses.POISON.duration === 2, '독 지속시간 1턴 차감 (3 -> 2)');
assert(tick1.damages[0].amount === 4, '피해 리포트 4 산출');

// 2. RES_POIS 보유 몬스터 독 50% 감쇄 검증
const victimResist = new Monster(2, 2, 'MON_GOBLIN');
victimResist.flags = ['RES_POIS'];
victimResist.stats.hp = 20;
victimResist.stats.maxHp = 20;

StatusEffectEngine.applyStatus(victimResist, 'POISON', 3, 4);
const tickRes = StatusEffectEngine.tickStatuses(victimResist);
assert(victimResist.stats.hp === 18, `RES_POIS 50% 감쇄 독 틱 대미지 2 적용 (20 -> ${victimResist.stats.hp})`);
assert(tickRes.damages[0].amount === 2, '피해 리포트 감쇄 대미지 2 산출');

// 3. IM_POIS 보유 몬스터 독 100% 면역 검증
const victimImmune = new Monster(3, 3, 'MON_GOBLIN');
victimImmune.flags = ['IM_POIS'];
const poisonImmuneRes = StatusEffectEngine.applyStatus(victimImmune, 'POISON', 3, 4);
assert(poisonImmuneRes.applied === false && poisonImmuneRes.reason === 'IMMUNE', 'IM_POIS 보유자 독 면역 저항');
assert(!StatusEffectEngine.hasStatus(victimImmune, 'POISON'), '독 상태 미부여 확인');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] 출혈(BLEED) 물리 DoT 및 마나 고갈(DRAIN_MANA) 검증');
console.log('🧪 ========================================================');

const bleeder = new Monster(4, 4, 'MON_HILL_ORC');
bleeder.stats.hp = 30;
bleeder.stats.maxHp = 30;
bleeder.stats.mp = 20;

StatusEffectEngine.applyStatus(bleeder, 'BLEED', 2, 5);
StatusEffectEngine.applyStatus(bleeder, 'DRAIN_MANA', 2, 8);

assert(StatusEffectEngine.hasStatus(bleeder, 'BLEED'), '출혈 상태 적용');
assert(StatusEffectEngine.hasStatus(bleeder, 'DRAIN_MANA'), '마나 고갈 상태 적용');

const bleedTick = StatusEffectEngine.tickStatuses(bleeder);
assert(bleeder.stats.hp === 25, `출혈 물리 DoT 5 피해 적용 (30 -> ${bleeder.stats.hp})`);
assert(bleeder.stats.mp === 12, `마나 고갈 8 MP 소모 적용 (20 -> ${bleeder.stats.mp})`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 5] 버프 효과 및 calculateStatusModifiers 검증');
console.log('🧪 ========================================================');

const buffTarget = new Player(10, 10);
StatusEffectEngine.applyStatus(buffTarget, 'HASTE', 15);
StatusEffectEngine.applyStatus(buffTarget, 'BLESS', 15);
StatusEffectEngine.applyStatus(buffTarget, 'HERO', 20);
StatusEffectEngine.applyStatus(buffTarget, 'MANA_SHIELD', 10);
StatusEffectEngine.applyStatus(buffTarget, 'SEE_INVIS', 30);
StatusEffectEngine.applyStatus(buffTarget, 'RES_FIRE', 20);

const mods = StatusEffectEngine.calculateStatusModifiers(buffTarget);
assert(mods.speed === 10, `HASTE 버프로 속도 +10 산출 (actual: ${mods.speed})`);
assert(mods.ac === 5, `BLESS 버프로 AC +5 산출 (actual: ${mods.ac})`);
assert(mods.toHit === 17, `BLESS(+5) + HERO(+12)로 명중 +17 산출 (actual: ${mods.toHit})`);
assert(mods.fearImmune === true, `HERO 버프로 공포 면역 활성화 (actual: ${mods.fearImmune})`);
assert(mods.manaShieldRatio === 0.50, `MANA_SHIELD 버프로 마나 50% 흡수 비율 산출 (actual: ${mods.manaShieldRatio})`);
assert(mods.seeInvis === true, `SEE_INVIS 버프로 투명체 감지 활성화 (actual: ${mods.seeInvis})`);
assert(mods.resFire === 50, `RES_FIRE 버프로 화염 저항 50% 산출 (actual: ${mods.resFire})`);

// TomeFlagResolver 연동 확인
const resolvedFlags = TomeFlagResolver.collectFlagsFromEntity(buffTarget);
assert(resolvedFlags.has('STATUS_HASTE') && resolvedFlags.has('HASTE'), 'TomeFlagResolver가 HASTE 플래그 자동 수집');
assert(resolvedFlags.has('STATUS_HERO') && resolvedFlags.has('NO_FEAR'), 'TomeFlagResolver가 HERO 및 NO_FEAR 플래그 자동 수집');
assert(resolvedFlags.has('STATUS_RES_FIRE') && resolvedFlags.has('RES_FIRE'), 'TomeFlagResolver가 RES_FIRE 플래그 자동 수집');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 6] Player & Monster statuses 및 debuffs 하위 호환 프록시 양방향 검증');
console.log('🧪 ========================================================');

const testPlayer = new Player(0, 0);
assert(typeof testPlayer.statuses === 'object', 'Player.statuses가 객체로 초기화됨');
assert(typeof testPlayer.debuffs === 'object', 'Player.debuffs가 프록시 객체로 제공됨');

// 1. 레거시 debuffs 쓰기 -> statuses 자동 반영
testPlayer.debuffs.poison = 4;
assert(testPlayer.statuses.POISON !== undefined, 'player.debuffs.poison = 4 설정 시 statuses.POISON 생성');
assert(testPlayer.statuses.POISON.duration === 4, 'statuses.POISON.duration === 4 확인');
assert(testPlayer.debuffs.poison === 4, 'player.debuffs.poison 읽기 시 4 반환');

// 2. 레거시 paralyzed 불리언 쓰기/읽기
testPlayer.debuffs.paralyzed = true;
assert(testPlayer.statuses.PARALYZED !== undefined, 'player.debuffs.paralyzed = true 설정 시 statuses.PARALYZED 생성');
assert(testPlayer.debuffs.paralyzed === true, 'player.debuffs.paralyzed 읽기 시 true 반환');

testPlayer.debuffs.paralyzed = false;
assert(testPlayer.statuses.PARALYZED === undefined, 'player.debuffs.paralyzed = false 설정 시 statuses.PARALYZED 제거');
assert(testPlayer.debuffs.paralyzed === false, 'player.debuffs.paralyzed 읽기 시 false 반환');

// 3. Monster debuffs 프록시 검증
const testMon = new Monster(0, 0, 'MON_HILL_ORC');
testMon.debuffs.frost = 3;
assert(testMon.statuses.FROST !== undefined && testMon.statuses.FROST.duration === 3, 'monster.debuffs.frost = 3 설정 시 statuses.FROST 정상 반영');
assert(testMon.debuffs.frost === 3, 'monster.debuffs.frost 읽기 시 3 반환');

// 4. tickDebuffs 레거시 메서드 연동 검증
testPlayer.stats.hp = 50;
testPlayer.stats.maxHp = 50;
const logs = [];
const isDead = testPlayer.tickDebuffs((msg, type) => logs.push({ msg, type }));
assert(isDead === false, 'tickDebuffs 생존 여부 확인 (false)');
assert(testPlayer.stats.hp < 50, `독 틱으로 플레이어 HP 감소 확인 (50 -> ${testPlayer.stats.hp})`);
assert(testPlayer.debuffs.poison === 3, `남은 독 지속시간 3턴 확인 (actual: ${testPlayer.debuffs.poison})`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 7] 상태이상 지속시간 만료 및 자동 해제 검증');
console.log('🧪 ========================================================');

const expiryTarget = new Monster(0, 0, 'MON_GOBLIN');
StatusEffectEngine.applyStatus(expiryTarget, 'SLOW', 1);
assert(StatusEffectEngine.hasStatus(expiryTarget, 'SLOW'), 'SLOW 1턴 부여 확인');

const expireReport = StatusEffectEngine.tickStatuses(expiryTarget);
assert(!StatusEffectEngine.hasStatus(expiryTarget, 'SLOW'), '1턴 후 SLOW 만료로 상태 제거 확인');
assert(expireReport.expired.includes('SLOW'), '만료 리포트에 SLOW 포함 확인');

console.log('\n========================================================');
console.log(`🎉 [STATUS EFFECT ENGINE TEST RESULTS] ${passed} / ${total} 통과 (${Math.round((passed / total) * 100)}%)`);
console.log('========================================================');

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
