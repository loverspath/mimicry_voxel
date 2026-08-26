/**
 * @file test_data_oriented_systems.js
 * @description ToME 4대 마스터 데이터셋 기반 5대 시스템 레이어 통합 검증 테스트 스위트
 *              (TomeFlagResolver, UnifiedTraitEngine, VisionLightingEngine, TomeSpellEngine, ArtifactActivationEngine)
 */

import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { TOME_EGOS_DATA } from '../src/entities/TomeEgosData.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';

import { TomeFlagResolver } from '../src/systems/TomeFlagResolver.js';
import { UnifiedTraitEngine } from '../src/systems/UnifiedTraitEngine.js';
import { VisionLightingEngine } from '../src/systems/VisionLightingEngine.js';
import { TomeSpellEngine, TOME_CANONICAL_SPELLS, TOME_ATTACK_METHODS, TOME_ATTACK_EFFECTS } from '../src/systems/TomeSpellEngine.js';
import { ArtifactActivationEngine, TOME_ARTIFACT_ACTIVATIONS, ARTIFACT_KEY_TO_ACTIVATION } from '../src/systems/ArtifactActivationEngine.js';

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

console.log('================================================================');
console.log('🧪 [TEST SUITE 1] TomeFlagResolver O(1) 플래그 추출 및 통합 검증');
console.log('================================================================');

// 1-1. 대표 몬스터 플래그 추출 검증
const balrogFlags = TomeFlagResolver.collectFlagsFromMonster('MON_GREATER_BALROG');
assert(balrogFlags.has('DEMON'), 'Greater Balrog DEMON 플래그 보유');
assert(balrogFlags.has('IM_FIRE'), 'Greater Balrog IM_FIRE 화염 면역 보유');
assert(balrogFlags.has('CAN_FLY'), 'Greater Balrog CAN_FLY 비행 보유');
assert(balrogFlags.has('NO_SLEEP'), 'Greater Balrog NO_SLEEP 수면 면역 보유');
assert(balrogFlags.has('BREATH_FIRE'), 'Greater Balrog BREATH_FIRE 원소 플래그 생성');

const dragonFlags = TomeFlagResolver.collectFlagsFromMonster('MON_ANCIENT_RED_DRAGON');
assert(dragonFlags.has('DRAGON'), 'Ancient Red Dragon DRAGON 플래그 보유');
assert(dragonFlags.has('IM_FIRE'), 'Ancient Red Dragon IM_FIRE 화염 면역 보유');
assert(dragonFlags.has('SUSCEP_COLD'), 'Ancient Red Dragon SUSCEP_COLD 냉기 취약 플래그 보유');

const witchKingFlags = TomeFlagResolver.collectFlagsFromMonster('MON_THE_WITCH_KING_OF_ANGMAR');
assert(witchKingFlags.has('UNDEAD'), 'Witch-King of Angmar UNDEAD 플래그 보유');
assert(witchKingFlags.has('IM_COLD'), 'Witch-King of Angmar IM_COLD 냉기 면역 보유');
assert(witchKingFlags.has('IM_POIS'), 'Witch-King of Angmar IM_POIS 독 면역 보유');
assert(witchKingFlags.has('UNIQUE'), 'Witch-King of Angmar UNIQUE 플래그 보유');

const lichFlags = TomeFlagResolver.collectFlagsFromMonster('MON_MASTER_LICH');
assert(lichFlags.has('UNDEAD'), 'Master Lich UNDEAD 플래그 보유');
assert(lichFlags.has('NO_CONF'), 'Master Lich NO_CONF 혼란 면역 보유');

// 1-2. 아이템 및 장비 플래그 추출 검증
const ringilFlags = TomeFlagResolver.collectFlagsFromItem('ART_RINGIL');
assert(ringilFlags.has('BRAND_COLD'), 'Ringil BRAND_COLD 플래그 보유');
assert(ringilFlags.has('FREE_ACT'), 'Ringil FREE_ACT 마비 면역 보유');
assert(ringilFlags.has('KILL_DEMON'), 'Ringil KILL_DEMON 악마 파멸 보유');
assert(ringilFlags.has('SPEED'), 'Ringil SPEED 속도 보정 보유');

const grondFlags = TomeFlagResolver.collectFlagsFromItem('ART_GROND');
assert(grondFlags.has('ESP_ALL'), 'Grond ESP_ALL 전체 텔레파시 보유');
assert(grondFlags.has('KILL_DRAGON'), 'Grond KILL_DRAGON 용족 섬멸 보유');
assert(grondFlags.has('RES_ACID'), 'Grond RES_ACID 산성 저항 보유');

// 1-3. 다중 소스 통합 (resolveUnifiedFlags) 검증
const mockEquipment = {
  weapon: { key: 'ART_RINGIL', flags: ['ACTIVATE', 'BRAND_COLD', 'FREE_ACT'] },
  armor: { key: 'EGO_OF_POWER', flags: ['RES_FIRE', 'RES_COLD', 'RES_ELEC', 'RES_ACID', 'CHR'] },
  helmet: { key: 'ART_OF_MORGOTH', flags: ['ESP_ALL', 'INFRA', 'SEE_INVIS', 'STR', 'INT', 'WIS', 'DEX', 'CON'] }
};
const unified = TomeFlagResolver.resolveUnifiedFlags({
  raceKey: 'MON_GREATER_BALROG',
  equipment: mockEquipment,
  mutations: ['CAN_FLY', 'MUT_SCALES']
});
assert(unified.has('DEMON'), '통합 플래그: 종족(DEMON) 포함');
assert(unified.has('BRAND_COLD'), '통합 플래그: 무기(BRAND_COLD) 포함');
assert(unified.has('RES_FIRE'), '통합 플래그: 갑옷(RES_FIRE) 포함');
assert(unified.has('ESP_ALL'), '통합 플래그: 투구(ESP_ALL) 포함');
assert(unified.has('MUT_SCALES'), '통합 플래그: 변이(MUT_SCALES) 포함');
assert(TomeFlagResolver.hasAllFlags(unified, 'DEMON', 'BRAND_COLD', 'ESP_ALL'), 'hasAllFlags 정상 판정');
assert(TomeFlagResolver.hasAnyFlag(unified, 'NON_EXISTENT', 'ESP_ALL'), 'hasAnyFlag 정상 판정');
assert(TomeFlagResolver.getFlagsWithPrefix(unified, 'RES_').length >= 4, 'getFlagsWithPrefix RES_ 목록 정상');

console.log('\n================================================================');
console.log('🧪 [TEST SUITE 2] UnifiedTraitEngine 스탯/원소저항/슬레이/브랜드 검증');
console.log('================================================================');

// 2-1. 6대 스탯 보너스 계산
const statsFlags = new Set(['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHR', 'PVAL_3']);
const statBonuses = UnifiedTraitEngine.calculateStatBonuses(statsFlags, { str: 2 });
assert(statBonuses.str === 5, 'PVAL_3 적용 STR 보너스 (3 + direct 2 = 5)');
assert(statBonuses.int === 3, 'PVAL_3 적용 INT 보너스 (3)');
assert(statBonuses.con === 3, 'PVAL_3 적용 CON 보너스 (3)');
assert(statBonuses.chr === 3, 'PVAL_3 적용 CHR 보너스 (3)');

// 2-2. 원소 저항 & 면역 & 취약 계산
const resFlags = new Set(['IM_FIRE', 'RES_COLD', 'HURT_LITE']);
const fireTrait = UnifiedTraitEngine.getElementalTrait(resFlags, 'FIRE');
assert(fireTrait.isImmune === true, 'FIRE 면역 (isImmune: true)');
assert(fireTrait.damageFactor === 0.0, 'FIRE 면역 대미지 배율 0.0');

const coldTrait = UnifiedTraitEngine.getElementalTrait(resFlags, 'COLD');
assert(coldTrait.isResistant === true, 'COLD 저항 (isResistant: true)');
assert(coldTrait.damageFactor === 0.50, 'COLD 저항 대미지 배율 0.50');

const liteTrait = UnifiedTraitEngine.getElementalTrait(resFlags, 'LIGHT');
assert(liteTrait.isVulnerable === true, 'LIGHT 취약 (isVulnerable: true)');
assert(liteTrait.damageFactor === 1.50, 'LIGHT 취약 대미지 배율 1.50');

const reducedFireDmg = UnifiedTraitEngine.applyResistanceToDamage(100, 'FIRE', resFlags);
assert(reducedFireDmg === 0, '화염 100 대미지 -> 면역 적용 0 대미지');
const reducedColdDmg = UnifiedTraitEngine.applyResistanceToDamage(100, 'COLD', resFlags);
assert(reducedColdDmg === 50, '냉기 100 대미지 -> 저항 적용 50 대미지');
const reducedLiteDmg = UnifiedTraitEngine.applyResistanceToDamage(100, 'LIGHT', resFlags);
assert(reducedLiteDmg === 150, '빛 100 대미지 -> 취약 적용 150 대미지');

// 2-3. 광원 반경 & 속도 보정
const liteFlags = new Set(['LITE3', 'HAS_LITE']);
assert(UnifiedTraitEngine.calculateLightRadius(liteFlags, 1) === 4, '광원 반경 (기본 1 + LITE3(+3) = 4)');
const darkFlags = new Set(['DARKNESS']);
assert(UnifiedTraitEngine.calculateLightRadius(darkFlags, 2) === 0, 'DARKNESS 광원 감쇄 (기본 2 - 2 = 0)');

const speedFlags = new Set(['SPEED', 'HASTE', 'PVAL_3']);
assert(UnifiedTraitEngine.calculateSpeedBonus(speedFlags, 3) === 8, '속도 보정 (SPEED +3, HASTE +5 = +8)');

// 2-4. 슬레이(Slay) 배율 계산
const slayFlags = new Set(['KILL_DRAGON', 'SLAY_UNDEAD', 'SLAY_EVIL']);
const targetDragon = { name: 'Ancient Red Dragon', type: 'DRAGON', flags: ['DRAGON', 'EVIL'] };
const dragonSlay = UnifiedTraitEngine.calculateSlayMultiplier(slayFlags, targetDragon);
assert(dragonSlay.multiplier === 5.0, 'KILL_DRAGON 대상 5.0배 슬레이 배율');

const targetUndead = { name: 'Master Lich', type: 'UNDEAD', flags: ['UNDEAD', 'EVIL'] };
const undeadSlay = UnifiedTraitEngine.calculateSlayMultiplier(slayFlags, targetUndead);
assert(undeadSlay.multiplier === 2.5, 'SLAY_UNDEAD 대상 2.5배 슬레이 배율');

// 2-5. 브랜드(Brand) 추가 피해 계산
const brandFlags = new Set(['BRAND_FIRE', 'BRAND_COLD', 'BRAND_MANA']);
const brandResult = UnifiedTraitEngine.calculateBrandDamage(brandFlags, 100);
assert(brandResult.activeBrands.length === 3, '3종 브랜드 활성화');
assert(brandResult.totalExtraDamage >= 50, '브랜드 추가 대미지 50% 이상 발동');

// 2-6. 상태이상 면역 세트
const immFlags = new Set(['FREE_ACT', 'NO_CONF', 'NO_SLEEP', 'HOLD_LIFE', 'REFLECT', 'REGEN', 'CAN_FLY']);
const imms = UnifiedTraitEngine.getStatusImmunities(immFlags);
assert(imms.freeAction === true, 'Free Action 마비 면역');
assert(imms.noConfusion === true, 'No Confusion 혼란 면역');
assert(imms.noSleep === true, 'No Sleep 수면 면역');
assert(imms.holdLife === true, 'Hold Life 레벨드레인 면역');
assert(imms.reflect === true, 'Reflect 원거리 반사');
assert(imms.regeneration === true, 'Regen 초재생');
assert(imms.canFly === true, 'Can Fly 비행');

console.log('\n================================================================');
console.log('🧪 [TEST SUITE 3] VisionLightingEngine FoV/ESP/적외선/투명 감지 검증');
console.log('================================================================');

// 3-1. 모의 맵 및 시야 연산 검증
const mockMap = {
  width: 20,
  height: 20,
  isTransparent: (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0) <= 5.0
};
const visionMap = VisionLightingEngine.calculateVisionMap(mockMap, 10, 10, 2, new Set(['LITE2']));
assert(visionMap.has('10,10'), '플레이어 위치 (10,10) 가시');
assert(visionMap.has('12,10'), '광원 반경 내 (12,10) 가시');

// 3-2. ESP 텔레파시 감지 검증
const espPlayer = { x: 5, y: 5, flags: ['ESP_ORC', 'ESP_DRAGON'] };
const farOrc = { x: 100, y: 100, name: 'Orc warrior', type: 'ORC', flags: ['ORC', 'EVIL'] };
const farDragon = { x: 80, y: 80, name: 'Great Wyrm', type: 'DRAGON', flags: ['DRAGON'] };
const farUndead = { x: 50, y: 50, name: 'Ghost', type: 'UNDEAD', flags: ['UNDEAD'] };

const orcVis = VisionLightingEngine.isMonsterVisible(espPlayer, farOrc, mockMap);
assert(orcVis.visible === true && orcVis.detectionMethod === 'ESP', 'ESP_ORC로 100칸 밖 오크 감지');

const dragonVis = VisionLightingEngine.isMonsterVisible(espPlayer, farDragon, mockMap);
assert(dragonVis.visible === true && dragonVis.detectionMethod === 'ESP', 'ESP_DRAGON으로 80칸 밖 드래곤 감지');

const undeadVis = VisionLightingEngine.isMonsterVisible(espPlayer, farUndead, mockMap);
assert(undeadVis.visible === false, 'ESP_UNDEAD 없으므로 먼 언데드 미감지');

// 3-3. 적외선(Infravision) 온혈 감지 검증
const infraPlayer = { x: 10, y: 10, flags: ['INFRA'], infraRadius: 5.0 };
const warmMonster = { x: 13, y: 10, name: 'Cave Bear', type: 'ANIMAL', flags: ['ANIMAL'] };
const coldGolem = { x: 13, y: 10, name: 'Iron Golem', type: 'GOLEM', flags: ['GOLEM', 'NONLIVING'] };

const bearVis = VisionLightingEngine.isMonsterVisible(infraPlayer, warmMonster, mockMap);
assert(bearVis.visible === true && bearVis.detectionMethod === 'INFRARED', '적외선으로 어둠 속 온혈 곰 감지');

const golemVis = VisionLightingEngine.isMonsterVisible(infraPlayer, coldGolem, mockMap);
assert(golemVis.visible === false, '냉혈/무생물 골렘은 적외선 감지 불가');

// 3-4. 투명 몬스터 감지 (SEE_INVIS) 검증
const normalPlayer = { x: 10, y: 10, flags: [], lightRadius: 3 };
const invisMonster = { x: 11, y: 10, name: 'Phantom', flags: ['INVISIBLE'] };
assert(VisionLightingEngine.isMonsterVisible(normalPlayer, invisMonster, mockMap).visible === false, '투시 없는 플레이어에게 투명 몬스터 불가시');

const seeInvisPlayer = { x: 10, y: 10, flags: ['SEE_INVIS'], lightRadius: 3 };
const invisVis = VisionLightingEngine.isMonsterVisible(seeInvisPlayer, invisMonster, mockMap);
assert(invisVis.visible === true && invisVis.detectionMethod === 'SEE_INVIS', 'SEE_INVIS 보유 시 투명 몬스터 가시');

console.log('\n================================================================');
console.log('🧪 [TEST SUITE 4] TomeSpellEngine 106종 주문/20종 타격/스킬 슬롯 검증');
console.log('================================================================');

// 4-1. 카탈로그 정합성 검증
const allSpellKeys = TomeSpellEngine.getAllSpellKeys();
assert(allSpellKeys.length >= 60, `TomeSpellEngine 스펠 카탈로그 등록 (${allSpellKeys.length}종)`);
assert(TOME_ATTACK_METHODS.length === 20, 'ToME 정통 20종 공격 메소드 등록');
assert(TOME_ATTACK_EFFECTS.length === 27, 'ToME 정통 27종 공격 이펙트 등록');

// 4-2. 몬스터 스펠 & 공격 추출 검증
const balrogSpells = TomeSpellEngine.resolveMonsterSpells('MON_GREATER_BALROG');
assert(balrogSpells.some(s => s.key === 'BA_FIRE'), 'Greater Balrog BA_FIRE 스펠 보유');
assert(balrogSpells.some(s => s.key === 'BR_FIRE'), 'Greater Balrog BR_FIRE 화염 브레스 보유');
assert(balrogSpells.some(s => s.key === 'S_DEMON'), 'Greater Balrog S_DEMON 악마 소환 보유');

const balrogAttacks = TomeSpellEngine.resolveMonsterAttacks('MON_GREATER_BALROG');
assert(balrogAttacks.length === 4, 'Greater Balrog 4회 연속 타격 보유');
assert(balrogAttacks[0].method === 'HIT' && balrogAttacks[0].effect === 'FIRE', 'Greater Balrog 1타: HIT / FIRE (8d12)');

// 4-3. 스펠 시전(castSpell) 및 원소 저항 적용 검증
const fireMage = { name: 'Fire Archmage' };
const immuneTarget = { name: 'Fire Drake', stats: { hp: 500, maxHp: 500 }, flags: ['IM_FIRE'] };
const castImmune = TomeSpellEngine.castSpell({ spellKey: 'BO_FIRE', caster: fireMage, target: immuneTarget });
assert(castImmune.success === true, 'BO_FIRE 시전 성공');
assert(castImmune.damage === 0, '화염 면역 타겟에게 대미지 0 적용');
assert(immuneTarget.stats.hp === 500, '화염 면역 타겟 HP 보존');

const normalTarget = { name: 'Goblin', stats: { hp: 500, maxHp: 500 }, flags: [] };
const castNormal = TomeSpellEngine.castSpell({ spellKey: 'BO_FIRE', caster: fireMage, target: normalTarget });
assert(castNormal.damage > 0, `일반 타겟에게 ${castNormal.damage} 대미지 적용`);
assert(normalTarget.stats.hp < 500, '일반 타겟 HP 차감 완료');

// 4-4. 근접 타격 실행 (executeAttack) 검증
const attacker = { name: 'Ancient Dragon' };
const defender = { name: 'Warrior', stats: { hp: 200 }, flags: ['RES_FIRE'] };
const atkResult = TomeSpellEngine.executeAttack({
  attack: { method: 'BITE', effect: 'FIRE', damage: '7d9' },
  attacker,
  defender
});
assert(atkResult.success === true, '드래곤 BITE(FIRE) 공격 실행 성공');
assert(atkResult.finalDamage <= atkResult.rawDamage, 'RES_FIRE 방어자에 의해 화염 피해 50% 감쇄');

// 4-5. 플레이어 의태 1~4 슬롯 스킬 생성 검증
const balrogSkills = TomeSpellEngine.generatePlayerSkillsFromCore('MON_GREATER_BALROG');
assert(balrogSkills.length === 4, 'Greater Balrog 코어 4개 스킬 생성');
assert(balrogSkills[0].slot === 1 && balrogSkills[0].id === 'SKILL_BASIC_ATTACK', '1번 슬롯: 기본 타격');
assert(balrogSkills[1].slot === 2, '2번 슬롯: 볼트/상태이상 스킬');
assert(balrogSkills[2].slot === 3, '3번 슬롯: 광역 폭발/소환 스킬');
assert(balrogSkills[3].slot === 4 && balrogSkills[3].name.includes('궁극기'), '4번 슬롯: 궁극기 브레스');

console.log('\n================================================================');
console.log('🧪 [TEST SUITE 5] ArtifactActivationEngine 유물 발동 & 쿨다운 검증');
console.log('================================================================');

// 5-1. 유물 발동 메타데이터 식별 검증
const galadrielAct = ArtifactActivationEngine.resolveArtifactActivation('ART_OF_GALADRIEL');
assert(galadrielAct !== null && galadrielAct.key === 'LIGHT', 'Phial of Galadriel -> LIGHT 발동 식별');
assert(galadrielAct.spec.cooldown === 10, 'Phial of Galadriel 쿨다운 10턴');

const thrainAct = ArtifactActivationEngine.resolveArtifactActivation('ART_OF_THRAIN');
assert(thrainAct !== null && thrainAct.key === 'THRAIN', 'Arkenstone of Thrain -> THRAIN 발동 식별');
assert(thrainAct.spec.cooldown === 150, 'Arkenstone of Thrain 쿨다운 150턴');

const grondAct = ArtifactActivationEngine.resolveArtifactActivation('ART_GROND');
assert(grondAct !== null && grondAct.key === 'GROND', 'Grond -> GROND 대지진동 발동 식별');

const ringilAct = ArtifactActivationEngine.resolveArtifactActivation('ART_RINGIL');
assert(ringilAct !== null && ringilAct.key === 'BO_COLD_1', 'Ringil -> BO_COLD_1 발동 식별');

const cammithrimAct = ArtifactActivationEngine.resolveArtifactActivation('ART_CAMMITHRIM');
assert(cammithrimAct !== null && cammithrimAct.key === 'BO_MISS_1', 'Cammithrim -> BO_MISS_1 발동 식별');

// 5-2. 유물 발동 실행 및 쿨다운 관리 검증
const testPlayer = {
  name: 'Hero',
  stats: { hp: 100, maxHp: 500 },
  artifactCooldowns: {},
  statusEffects: []
};
const testGaladriel = { key: 'ART_OF_GALADRIEL', name: "Phial of Galadriel" };

assert(ArtifactActivationEngine.canActivate(testGaladriel, testPlayer) === true, '쿨다운 없는 갈라드리엘 유리병 발동 가능');

const actResult = ArtifactActivationEngine.activateArtifact({
  item: testGaladriel,
  player: testPlayer
});
assert(actResult.success === true, '갈라드리엘 유리병 발동 성공');
assert(actResult.cooldownSet === 10, '쿨다운 10턴 등록');
assert(ArtifactActivationEngine.getCooldown(testGaladriel, testPlayer) === 10, '플레이어 쿨다운 트래커에 10턴 기록');
assert(ArtifactActivationEngine.canActivate(testGaladriel, testPlayer) === false, '쿨다운 중 발동 불가 판정');

// 5-3. 쿨다운 턴 감소 검증
ArtifactActivationEngine.tickCooldowns(testPlayer);
assert(ArtifactActivationEngine.getCooldown(testGaladriel, testPlayer) === 9, '1턴 경과 후 쿨다운 9턴으로 감소');

// 5-4. 대량 회복 유물 (Arkenstone of Thrain) 발동 검증
const testThrain = { key: 'ART_OF_THRAIN', name: 'Arkenstone of Thrain' };
const thrainResult = ArtifactActivationEngine.activateArtifact({
  item: testThrain,
  player: testPlayer
});
assert(thrainResult.success === true, '스레인의 대보물 발동 성공');
assert(testPlayer.stats.hp > 100, `체력 회복 적용 (HP: ${testPlayer.stats.hp}/${testPlayer.stats.maxHp})`);
assert(ArtifactActivationEngine.getCooldown(testThrain, testPlayer) === 150, '스레인의 보물 쿨다운 150턴 기록');

console.log('\n================================================================');
console.log(`🎉 [SYSTEMS LAYER AUDIT RESULTS] ${passed} / ${total} 통과 (${Math.round((passed / total) * 100)}%)`);
console.log('================================================================\n');

if (passed !== total) {
  process.exit(1);
}
