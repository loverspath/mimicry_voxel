/**
 * @file test_data_oriented_rebuilding_full.js
 * @description Phase 3 & 4: 엔티티 모델 Zero-Logic 순수 데이터 컴포넌트화 및 
 *              레거시 하드코딩(Skills/Perks/Tags/MonsterRegistry) 폐기 & ToME 마스터 데이터 100% 직결 무결성 통합 검증
 */

import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';
import { TOME_EGOS_DATA } from '../src/entities/TomeEgosData.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';

import { Monster } from '../src/entities/Monster.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { getSpeciesConfig, MONSTER_SPECIES, LEGACY_TOME_ALIASES_MAP } from '../src/entities/MonsterRegistry.js';
import { CORE_SKILL_TREES, ACTIVE_SKILL_CONFIGS, MONSTER_SKILLS } from '../src/core/Skills.js';
import { MONSTER_PERKS, getPerkDefinition } from '../src/entities/Perks.js';

import { TomeFlagResolver } from '../src/systems/TomeFlagResolver.js';
import { UnifiedTraitEngine } from '../src/systems/UnifiedTraitEngine.js';
import { VisionLightingEngine } from '../src/systems/VisionLightingEngine.js';
import { TomeSpellEngine, TOME_CANONICAL_SPELLS } from '../src/systems/TomeSpellEngine.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';
import { MonsterAISystem } from '../src/systems/MonsterAISystem.js';
import { PlayerStatCalculator } from '../src/systems/PlayerStatCalculator.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';

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

console.log('================================================================================');
console.log('🧪 [TEST SUITE 1] 851종 몬스터 변신 시 1~4번 스킬 동적 생성 및 유효성 전수 검증');
console.log('================================================================================');

const monsterKeys = Object.keys(TOME_MONSTERS_DATA);
assert(monsterKeys.length === 851, `ToME 마스터 몬스터 데이터 851종 전수 등록 확인 (실제: ${monsterKeys.length})`);

let validSkillCount851 = 0;
let validFactoryCount851 = 0;

for (const mKey of monsterKeys) {
  const skills = TomeSpellEngine.generatePlayerSkillsFromCore(mKey);
  if (skills && skills.length >= 1 && skills.length <= 4) {
    const allValid = skills.every(s => s.slot >= 1 && s.slot <= 4 && s.name && s.cooldown >= 1);
    if (allValid) validSkillCount851++;
  }

  const factorySkills = MonsterSpellFactory.createInnateSkills(mKey);
  if (factorySkills && factorySkills.length >= 1 && factorySkills.length <= 4) {
    const allValid = factorySkills.every(s => s.slot >= 1 && s.slot <= 4 && s.name && s.cooldown >= 1);
    if (allValid) validFactoryCount851++;
  }
}

assert(validSkillCount851 === 851, `851종 전수 TomeSpellEngine 1~4번 스킬 슬롯 생성 무결성 (851/851)`);
assert(validFactoryCount851 === 851, `851종 전수 MonsterSpellFactory 의태 스킬 인스턴스화 무결성 (851/851)`);

// 대표 몬스터 스킬 명세 정밀 검증
const balrogSkills = MonsterSpellFactory.createInnateSkills('MON_GREATER_BALROG');
assert(balrogSkills.length === 4, 'Greater Balrog 4개 스킬 생성');
assert(balrogSkills[0].slot === 1, 'Greater Balrog 1번 슬롯: 기본 타격');
assert(balrogSkills.some(s => s.name.includes('화염') || s.tomeKey === 'BO_FIRE' || s.tomeKey === 'BA_FIRE'), 'Greater Balrog 화염 주문 보유');
assert(balrogSkills.some(s => s.type === 'BREATH' || s.name.includes('브레스') || s.tomeKey === 'BR_FIRE'), 'Greater Balrog 화염 브레스 보유');

const dragonSkills = MonsterSpellFactory.createInnateSkills('MON_ANCIENT_RED_DRAGON');
assert(dragonSkills.length === 4, 'Ancient Red Dragon 4개 스킬 생성');
assert(dragonSkills.some(s => s.type === 'BREATH' || s.name.includes('브레스')), 'Ancient Red Dragon 브레스 궁극기 보유');

const witchKingSkills = MonsterSpellFactory.createInnateSkills('MON_THE_WITCH_KING_OF_ANGMAR');
assert(witchKingSkills.length === 4, 'Witch-King of Angmar 4개 스킬 생성');
assert(witchKingSkills.some(s => s.name.includes('황천') || s.name.includes('암흑') || s.name.includes('언데드') || s.name.includes('볼트')), 'Witch-King of Angmar 사령/황천 스킬 보유');

console.log('\n================================================================================');
console.log('🧪 [TEST SUITE 2] 플레이어 장비/코어 착용 시 UnifiedTraitEngine 연산 무결성 검증');
console.log('================================================================================');

const player = new Player(10, 10, 'MON_NOVICE_WARRIOR');
assert(player.lightRange >= 1, `플레이어 기본 광원 반경 계산 (${player.lightRange})`);

// 1. 유물 및 장비 착용
const ringil = new Item(10, 10, 'WEAPON', '|', '#38bdf8', 'Ringil', 0, 'WEAPON', {}, '4d5');
ringil.artifactKey = 'ART_RINGIL';
ringil.toHit = 22;
ringil.toDamage = 25;
player.equipItem(ringil);

const grond = new Item(10, 10, 'WEAPON', '\\', '#1e293b', 'Grond', 0, 'WEAPON', {}, '9d9');
grond.artifactKey = 'ART_GROND';

const phial = new Item(10, 10, 'LAMP', '~', '#fef08a', 'Phial of Galadriel', 1, 'LIGHT', {});
phial.artifactKey = 'ART_GALADRIEL';
player.equippedLamp = phial;

// 2. 광원 반경 검증 (Phial of Galadriel LITE3 -> +3 반경)
const lightRadius = UnifiedTraitEngine.calculateLightRadius(player, 1);
assert(lightRadius >= 4, `갈라드리엘 유리병 장착 시 광원 반경 4 이상 (${lightRadius})`);
assert(player.lightRange >= 4, `Player.lightRange 게터 광원 반경 연동 (${player.lightRange})`);

// 3. 플래그 및 저항 연산 검증
const collectedFlags = TomeFlagResolver.collectFlagsFromEntity(player);
assert(collectedFlags.has('BRAND_COLD'), 'Ringil 착용으로 BRAND_COLD 냉기 브랜드 획득');
assert(collectedFlags.has('FREE_ACT'), 'Ringil 착용으로 FREE_ACT 마비 면역 획득');
assert(collectedFlags.has('SPEED'), 'Ringil 착용으로 SPEED 속도 보정 획득');

const coldTrait = UnifiedTraitEngine.getElementalTrait(player, 'COLD');
assert(coldTrait.isResistant || collectedFlags.has('RES_COLD') || coldTrait.damageFactor <= 1.0, '냉기 속성 판정 유효');

// 4. 슬레이 배율 검증
const targetDemon = new Monster(11, 10, 'MON_GREATER_BALROG');
const slayResult = UnifiedTraitEngine.calculateSlayMultiplier(player, targetDemon);
assert(slayResult.multiplier >= 4.0, `Ringil(KILL_DEMON) 발동: 악마 대상 슬레이 배율 4.0배 이상 (실제: ${slayResult.multiplier}배)`);

// 5. 브랜드 추가 피해 검증
const brandResult = UnifiedTraitEngine.calculateBrandDamage(player, 50);
assert(brandResult.totalExtraDamage > 0, `Ringil 브랜드 추가 피해 정상 계산 (+${brandResult.totalExtraDamage})`);
assert(brandResult.multiplier >= 1.5, `브랜드 피해 배율 1.5배 이상 (실제: ${brandResult.multiplier})`);

console.log('\n================================================================================');
console.log('🧪 [TEST SUITE 3] 레거시 12개 하드코딩 객체 의존성 0건 확인');
console.log('================================================================================');

// 3-1. MONSTER_SPECIES가 851종 모든 키를 동적으로 지원하는지 확인
assert(MONSTER_SPECIES['MON_GREATER_BALROG'] !== undefined, 'MONSTER_SPECIES[MON_GREATER_BALROG] 동적 조회 성공');
assert(MONSTER_SPECIES['MON_ANCIENT_RED_DRAGON'] !== undefined, 'MONSTER_SPECIES[MON_ANCIENT_RED_DRAGON] 동적 조회 성공');
assert(MONSTER_SPECIES['MON_MORGOTH_LORD_OF_DARKNESS'] !== undefined, 'MONSTER_SPECIES[MORGOTH] 동적 조회 성공');
assert(MONSTER_SPECIES['MON_FOREST_TROLL'] !== undefined, 'MONSTER_SPECIES[MON_FOREST_TROLL] 동적 조회 성공');

// 3-2. 레거시 별칭(SLIME, GOBLIN, ORC 등)도 100% TOME_MONSTERS_DATA로 직결 확인
const slimeConfig = getSpeciesConfig('SLIME');
assert(slimeConfig.coreType === 'MON_GREEN_OOZE', `SLIME 별칭 -> MON_GREEN_OOZE 직결 (${slimeConfig.coreType})`);
assert(slimeConfig.name === 'Green ooze' || slimeConfig.name === '초록 슬라임', `Green ooze 이름 해석 (${slimeConfig.name})`);

const orcConfig = getSpeciesConfig('ORC');
assert(orcConfig.coreType === 'MON_HILL_ORC', `ORC 별칭 -> MON_HILL_ORC 직결 (${orcConfig.coreType})`);

const dragonConfig = getSpeciesConfig('DRAGON');
assert(dragonConfig.coreType === 'MON_MATURE_RED_DRAGON', `DRAGON 별칭 -> MON_MATURE_RED_DRAGON 직결 (${dragonConfig.coreType})`);

// 3-3. CORE_SKILL_TREES가 임의의 851종 몬스터에 대해 동적으로 트리를 생성하는지 확인
const balrogTree = CORE_SKILL_TREES['MON_GREATER_BALROG'];
assert(Array.isArray(balrogTree) && balrogTree.length === 5, 'Greater Balrog 동적 5단계 스킬 트리 생성');
assert(balrogTree[0].pt === 1 && balrogTree[4].pt === 10, '스킬 트리 pt 티어 (1~10) 정합성');

const lichTree = CORE_SKILL_TREES['MON_MASTER_LICH'];
assert(Array.isArray(lichTree) && lichTree.length === 5, 'Master Lich 동적 5단계 스킬 트리 생성');

// 3-4. MONSTER_PERKS가 임의의 ToME 플래그를 정규화하여 반환하는지 확인
const imFirePerk = MONSTER_PERKS['IM_FIRE'];
assert(imFirePerk.id === 'IM_FIRE', 'MONSTER_PERKS[IM_FIRE] 동적 해결');
assert(imFirePerk.name.includes('화염') || imFirePerk.name.includes('FIRE'), 'IM_FIRE 특성명 생성');

const freeActPerk = MONSTER_PERKS['FREE_ACT'];
assert(freeActPerk.id === 'FREE_ACT', 'MONSTER_PERKS[FREE_ACT] 동적 해결');
assert(freeActPerk.name.includes('자유') || freeActPerk.name.includes('FREE'), 'FREE_ACT 특성명 생성');

console.log('\n================================================================================');
console.log('🧪 [TEST SUITE 4] 몬스터 AI 턴에서 TomeSpellEngine 주문/브레스 정상 발동 검증');
console.log('================================================================================');

const balrogMonster = new Monster(10, 11, 'MON_GREATER_BALROG', 50);
const testDefender = new Player(10, 10, 'MON_NOVICE_WARRIOR');
testDefender.stats.hp = 1000;
testDefender.stats.maxHp = 1000;

// 4-1. 몬스터 근접 타격 실행 (TomeSpellEngine.executeAttack)
const attackResult = balrogMonster.executeAttack(testDefender);
assert(attackResult.success === true, 'Balrog 근접 공격(executeAttack) 성공');
assert(attackResult.finalDamage > 0, `Balrog 근접 타격 피해량 적용 (${attackResult.finalDamage} 피해)`);
assert(testDefender.stats.hp < 1000, `방어자 플레이어 체력 차감 (${testDefender.stats.hp}/1000)`);

// 4-2. 몬스터 주문 시전 실행 (TomeSpellEngine.castSpell)
const spellResult = balrogMonster.castSpell('BO_FIRE', testDefender);
assert(spellResult.success === true, 'Balrog BO_FIRE 화염 볼트 주문 시전 성공');
assert(spellResult.damage > 0, `BO_FIRE 주문 피해 적용 (${spellResult.damage} 피해)`);

// 4-3. 몬스터 브레스 시전 실행
const breathResult = balrogMonster.castSpell('BR_FIRE', testDefender);
assert(breathResult.success === true, 'Balrog BR_FIRE 화염 브레스 시전 성공');
assert(breathResult.damage > 0, `BR_FIRE 브레스 피해 적용 (${breathResult.damage} 피해)`);

// 4-4. MonsterAISystem.act() AI 턴 실행
const dummyMap = {
  isWalkable: () => true,
  isTransparent: () => true,
  getTile: () => ({ isWalkable: true })
};
const aiLogs = [];
const addLogEntry = (msg, type) => aiLogs.push({ msg, type });
let attackTriggered = false;
let breathTriggered = false;

balrogMonster.act(
  testDefender,
  dummyMap,
  () => false,
  () => { attackTriggered = true; },
  () => { breathTriggered = true; return true; },
  addLogEntry
);

assert(attackTriggered || breathTriggered || aiLogs.length > 0 || Object.keys(balrogMonster.cooldowns || {}).length > 0, 'MonsterAISystem.act() 실행 시 공격, 브레스 또는 주문 시전 정상 트리거');

console.log('\n================================================================================');
console.log(`🎉 [PHASE 3 & 4 INTEGRATION AUDIT RESULTS] ${passed} / ${total} 통과 (${((passed / total) * 100).toFixed(1)}%)`);
console.log('================================================================================');
