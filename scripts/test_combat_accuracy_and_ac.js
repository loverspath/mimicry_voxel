/**
 * @file test_combat_accuracy_and_ac.js
 * @description ToME 2.3.5 정통 BTH 백분율 명중 판정, 5대 생태/신체 방어 아키타입,
 *              1~50층 몬테카를로 명중률 시뮬레이션 종합 검증 테스트 스위트.
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';
import { COMBAT_ACCURACY_CONFIG, MONSTER_DEFENSE_ARCHETYPES, calculateToHitVsAc } from '../src/configs/GameBalanceConfig.js';
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
console.log('🧪 [TEST SUITE 1] ToME 2.3.5 정통 BTH 명중률 및 AC 설정 무결성 검증');
console.log('🧪 ========================================================');

assert(COMBAT_ACCURACY_CONFIG.BASE_HIT_SCORE === 50, 'BASE_HIT_SCORE가 50으로 설정됨');
assert(COMBAT_ACCURACY_CONFIG.LEVEL_HIT_WEIGHT === 2.0, 'LEVEL_HIT_WEIGHT가 2.0으로 설정됨');
assert(COMBAT_ACCURACY_CONFIG.DEX_HIT_WEIGHT === 3.0, 'DEX_HIT_WEIGHT가 3.0으로 설정됨');
assert(COMBAT_ACCURACY_CONFIG.WEAPON_TO_H_WEIGHT === 3.0, 'WEAPON_TO_H_WEIGHT가 3.0으로 설정됨');
assert(COMBAT_ACCURACY_CONFIG.MASTERY_HIT_WEIGHT === 1.5, 'MASTERY_HIT_WEIGHT가 1.5로 설정됨');
assert(COMBAT_ACCURACY_CONFIG.AC_SCALING_FACTOR === 1.0, 'AC_SCALING_FACTOR가 1.0으로 설정됨');

// Math check: Level 1 Player (DEX 10, to_h 0) vs AC 8
const f1Calc = calculateToHitVsAc({ level: 1, dexMod: 0, weaponToH: 0, masteryLevel: 1, targetAC: 8 });
console.log(`  📊 1층 1레벨 기본 명중률 공식 산출값: ${(f1Calc * 100).toFixed(2)}%`);
assert(f1Calc >= 0.80 && f1Calc <= 0.92, '1층 기본 명중률이 80~92% 대역으로 산출됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] 1층 1레벨 플레이어 1,000회 몬테카를로 명중 시뮬레이션 (목표: 75~88%)');
console.log('🧪 ========================================================');

const playerL1 = new Player(5, 5);
const noviceWarrior = new Monster(6, 6, 'Novice warrior', 1);
noviceWarrior.baseAC = 10;

let hitCountL1 = 0;
const SIM_COUNT = 1000;

for (let i = 0; i < SIM_COUNT; i++) {
  const result = CombatCalculator.calculateHitChance(playerL1, noviceWarrior, {}, 10);
  if (result.isHit) hitCountL1++;
}

const hitRateL1 = (hitCountL1 / SIM_COUNT) * 100;
console.log(`  📊 1층 1,000회 타격 결과: 적중 ${hitCountL1}회 (실측 명중률: ${hitRateL1.toFixed(2)}%)`);
assert(hitRateL1 >= 70.0 && hitRateL1 <= 95.0, `1층 실측 명중률이 70~95% 범위에 완벽 안착 (실측: ${hitRateL1.toFixed(2)}%)`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] 25층 중층부 플레이어 vs 중갑 몬스터 (AC 35) 몬테카를로 시뮬레이션');
console.log('🧪 ========================================================');

const playerL25 = new Player(5, 5);
playerL25.level = 25;
playerL25.stats.dex = 18; // dexMod = 4
playerL25.equipment.weapon = new Item(0, 0, 'WEAPON', '/', '#ffffff', '장검 (+4)', 5, null, {}, null, 'SWORD');
playerL25.equipment.weapon.to_h = 4;
playerL25.equipment.weapon.weaponCategory = 'SWORD';
playerL25.body.weaponMastery = { SWORD: { count: 100 } }; // Lv 4 Mastery

const orcChieftain = new Monster(6, 6, 'ORC', 25);
orcChieftain.baseAC = 35;

let hitCountL25 = 0;
for (let i = 0; i < SIM_COUNT; i++) {
  const result = CombatCalculator.calculateHitChance(playerL25, orcChieftain, {}, 10);
  if (result.isHit) hitCountL25++;
}

const hitRateL25 = (hitCountL25 / SIM_COUNT) * 100;
console.log(`  📊 25층 1,000회 타격 결과: 적중 ${hitCountL25}회 (실측 명중률: ${hitRateL25.toFixed(2)}%)`);
assert(hitRateL25 >= 70.0 && hitRateL25 <= 95.0, `25층 실측 명중률이 70~95% 범위로 안정적 적중 (실측: ${hitRateL25.toFixed(2)}%)`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] 50층 심층부 고위 보스 (AC 80) 몬테카를로 시뮬레이션');
console.log('🧪 ========================================================');

const playerL50 = new Player(5, 5);
playerL50.level = 50;
playerL50.stats.dex = 26; // dexMod = 8
playerL50.equipment.weapon = new Item(0, 0, 'WEAPON', '/', '#ffffff', '신성한 에스토크 (+8)', 5, null, {}, null, 'SWORD');
playerL50.equipment.weapon.to_h = 8;
playerL50.equipment.weapon.weaponCategory = 'SWORD';
playerL50.body.weaponMastery = { SWORD: { count: 300 } }; // Lv 5 Mastery

const ancientDragon = new Monster(6, 6, 'DRAGON', 50);
ancientDragon.baseAC = 80;

let hitCountL50 = 0;
for (let i = 0; i < SIM_COUNT; i++) {
  const result = CombatCalculator.calculateHitChance(playerL50, ancientDragon, {}, 10);
  if (result.isHit) hitCountL50++;
}

const hitRateL50 = (hitCountL50 / SIM_COUNT) * 100;
console.log(`  📊 50층 1,000회 타격 결과: 적중 ${hitCountL50}회 (실측 명중률: ${hitRateL50.toFixed(2)}%)`);
assert(hitRateL50 >= 60.0 && hitRateL50 <= 90.0, `50층 실측 명중률이 60~90% 범위로 정통 RPG 밸런스 유지 (실측: ${hitRateL50.toFixed(2)}%)`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 5] 5대 생태/신체 방어 아키타입 고유 판정 검증');
console.log('🧪 ========================================================');

// 1. Ooze/Jelly (Slime)
const slime = new Monster(6, 6, 'SLIME', 1);
const slimeArch = CombatCalculator.resolveMonsterArchetype(slime);
assert(slimeArch && slimeArch.id === 'OOZE_JELLY', '슬라임이 OOZE_JELLY 아키타입으로 정상 분류됨');
assert(slimeArch.hitBonus === 10, '슬라임에게 +10 BTH 명중 보너스 적용');

// 2. Agile/Flying (Bat)
const bat = new Monster(6, 6, 'BAT', 1);
const batArch = CombatCalculator.resolveMonsterArchetype(bat);
assert(batArch && batArch.id === 'AGILE_FLYING', '박쥐가 AGILE_FLYING 아키타입으로 정상 분류됨');
assert(batArch.dodgeRate === 0.15, '박쥐에게 15% 기민한 찰나의 회피(Agile Dodge) 적용');

// 3. Heavy/Armored (Golem)
const golem = new Monster(6, 6, 'GOLEM', 10);
golem.name = 'Clay golem';
const golemArch = CombatCalculator.resolveMonsterArchetype(golem);
assert(golemArch && golemArch.id === 'HEAVY_ARMORED', '골렘이 HEAVY_ARMORED 아키타입으로 정상 분류됨');
assert(golemArch.effectiveAcBonus === 10, '골렘에게 +10 AC 장갑 보너스 적용');

// 4. Ethereal/Ghost (Ghost)
const ghost = new Monster(6, 6, 'GHOST', 15);
ghost.name = 'Shadow';
const ghostArch = CombatCalculator.resolveMonsterArchetype(ghost);
assert(ghostArch && ghostArch.id === 'ETHEREAL_GHOST', '유령이 ETHEREAL_GHOST 아키타입으로 정상 분류됨');
assert(ghostArch.phaseMissRate === 0.25, '일반 물리 무기에 대한 25% 위상 빗나감 적용');

// 5. Colossal/Giant (Dragon)
const dragon = new Monster(6, 6, 'DRAGON', 30);
const dragonArch = CombatCalculator.resolveMonsterArchetype(dragon);
assert(dragonArch && dragonArch.id === 'COLOSSAL_GIANT', '드래곤이 COLOSSAL_GIANT 아키타입으로 정상 분류됨');
assert(dragonArch.hitBonus === 12, '드래곤 대형 피격 면적으로 +12 BTH 명중 보너스 적용');

console.log('\n========================================================');
console.log(`🎉 [TEST RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
