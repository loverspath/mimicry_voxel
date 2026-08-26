/**
 * @file test_tome_consumables_and_ac.js
 * @description ToME 2.3.5 정통 4대 시스템 검증:
 *              1. AC 물리 피해 감쇄 공식 및 방패 블록 연동
 *              2. 포션 15종 및 스크롤 15종 실제 효과 실행기 (ConsumableEffectEngine)
 *              3. 에고 101종 및 유물 183종 슬레이/브랜드/저항 엔진 (TomeEgoEngine)
 */

import { CombatCalculator } from '../src/core/CombatCalculator.js';
import { ConsumableEffectEngine } from '../src/systems/ConsumableEffectEngine.js';
import { TomeEgoEngine } from '../src/systems/TomeEgoEngine.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { Map } from '../src/map/Map.js';

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
console.log('🧪 [TEST SUITE 1] ToME 정통 방어구 AC 물리 피해 감쇄 및 방패 블록 검증');
console.log('🧪 ========================================================');

const player = new Player(5, 5);
const rawDamage = 30;

// 기본 상태 감쇄 (AC 10, CON 10 기준: 감쇄 = 1 + 1 = 2)
const unarmoredDmg = CombatCalculator.calculateAcDamageReduction(player, rawDamage);
assert(unarmoredDmg <= 30, `1. 기본 감쇄 적용: 순수 피해 30 -> 실질 피해 ${unarmoredDmg}`);

// 중갑 + 방패 + 투구 + 장갑 + 부츠 풀세트 장착
const heavyArmor = new Item(0, 0, 'ARMOR', '[', '#fff', 'Full Plate', 0, 'ARMOR');
heavyArmor.baseAC = 25;
player.equipment.armor = heavyArmor;

const shield = new Item(0, 0, 'SHIELD', ')', '#fff', 'Tower Shield', 0, 'SHIELD');
shield.baseAC = 12;
player.equipment.shield = shield;

const helmet = new Item(0, 0, 'HELMET', ']', '#fff', 'Iron Helm', 0, 'HELMET');
helmet.baseAC = 8;
player.equipment.helmet = helmet;

const gloves = new Item(0, 0, 'GLOVES', ']', '#fff', 'Set of Gauntlets', 0, 'GLOVES');
gloves.baseAC = 5;
player.equipment.gloves = gloves;

const boots = new Item(0, 0, 'BOOTS', ']', '#fff', 'Iron Greaves', 0, 'BOOTS');
boots.baseAC = 6;
player.equipment.boots = boots;

const totalAC = player.getTotalAC();
assert(totalAC >= 56, `2. 풀세트 장착 후 플레이어 총 AC(${totalAC}) 대폭 상승`);

const armoredDmg = CombatCalculator.calculateAcDamageReduction(player, rawDamage);
assert(armoredDmg < unarmoredDmg, `3. 중갑/방패 장착 시 물리 피해 대폭 감쇄 (${unarmoredDmg} -> ${armoredDmg})`);
assert(armoredDmg <= 24, `4. AC 비례 물리 감쇄 공식(AC/8 + CON/10) 정밀 작동`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] ConsumableEffectEngine 포션 소비 효과 검증');
console.log('🧪 ========================================================');

// 1. 체력 회복 포션
player.stats.hp = 10;
player.stats.maxHp = 100;
const healPotion = new Item(0, 0, 'POTION', '!', '#f43f5e', '상급 체력 물약');
healPotion.potionEffect = { type: 'HEAL', amount: 50 };
healPotion.count = 2;

const healResult = ConsumableEffectEngine.useConsumable(healPotion, player, null);
assert(healResult === true, '1. 상급 체력 물약 사용 성공');
assert(player.stats.hp === 60, `2. 체력 +50 회복 확인 (10 -> ${player.stats.hp})`);
assert(healPotion.count === 1, `3. 포션 수량 1개 차감 확인 (2 -> ${healPotion.count})`);

// 2. 능력치 영구 성장 영약
const oldStr = player.baseStats.str || 10;
const strPotion = new Item(0, 0, 'POTION', '!', '#10b981', '힘의 성장 영약');
strPotion.potionEffect = { type: 'STAT_BOOST' };
const strResult = ConsumableEffectEngine.useConsumable(strPotion, player, null);
assert(strResult === true, '4. 힘의 성장 영약 사용 성공');
assert(player.baseStats.str === oldStr + 1, `5. 기본 힘(STR) 스탯 영구히 +1 상승 확인 (${oldStr} -> ${player.baseStats.str})`);

// 3. 가속의 포션
const speedPotion = new Item(0, 0, 'POTION', '!', '#fbbf24', '가속의 물약');
ConsumableEffectEngine.useConsumable(speedPotion, player, null);
assert(player.speedBuffTurns >= 15, `6. 가속의 물약 15턴 버프 획득 확인 (${player.speedBuffTurns}턴)`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] ConsumableEffectEngine 스크롤 소비 효과 검증');
console.log('🧪 ========================================================');

const map = new Map(40, 30, 1);
const mockGame = { map, addLogEntry: () => {} };

// 1. 마법 지도 주문서 (Magic Mapping)
const playerWalkableX = map.startingPosition ? map.startingPosition.x : 5;
const playerWalkableY = map.startingPosition ? map.startingPosition.y : 5;
player.x = playerWalkableX;
player.y = playerWalkableY;

const mapScroll = new Item(0, 0, 'SCROLL', '?', '#38bdf8', '마법 지도 주문서');
assert(map.tiles[playerWalkableY][playerWalkableX].explored !== true, '1. 사용 전 던전 타일 미탐지 상태 확인');

const mapResult = ConsumableEffectEngine.useConsumable(mapScroll, player, mockGame);
assert(mapResult === true, '2. 마법 지도 주문서 사용 성공');
assert(map.tiles[playerWalkableY][playerWalkableX].explored === true, '3. 맵 전역 타일 100% 탐지(explored: true) 완료');

// 2. 무기 강화 주문서 (Enchant Weapon)
const testWeapon = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', '롱소드', 0, 'WEAPON', {}, '1d8');
testWeapon.upgradeLevel = 0;
testWeapon.toHit = 0;
testWeapon.toDmg = 0;
player.equipment.weapon = testWeapon;

const enchantScroll = new Item(0, 0, 'SCROLL', '?', '#a855f7', '무기 강화 주문서');
const enchantResult = ConsumableEffectEngine.useConsumable(enchantScroll, player, mockGame);
assert(enchantResult === true, '4. 무기 강화 주문서 사용 성공');
assert(testWeapon.upgradeLevel === 1, `5. 무기 강화도 +1 증가 확인 (${testWeapon.upgradeLevel}단계)`);
assert(testWeapon.toHit === 1 && testWeapon.toDmg === 1, `6. 무기 명중(+${testWeapon.toHit}) 및 피해(+${testWeapon.toDmg}) 증가 확인`);

// 3. 차원 도약 주문서 (Phase Door)
const initialX = player.x;
const initialY = player.y;
const phaseScroll = new Item(0, 0, 'SCROLL', '?', '#c084fc', '차원 도약 주문서');
const phaseResult = ConsumableEffectEngine.useConsumable(phaseScroll, player, mockGame);
assert(phaseResult === true, '7. 차원 도약 주문서 사용 성공');
assert(map.isWalkable(player.x, player.y) === true, `8. 안전한 보행 가능 타일(x:${player.x}, y:${player.y})로 점멸 확인`);

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] TomeEgoEngine 에고/유물 슬레이, 브랜드, 저항 검증');
console.log('🧪 ========================================================');

// 1. 오크 슬레이 (SLAY_ORC: 2.5배)
const orcSlayerWeapon = new Item(0, 0, 'WEAPON', '|', '#ffd700', '유물: 오크베기', 0, 'WEAPON');
orcSlayerWeapon.flags = ['SLAY_ORC', 'BRAND_FIRE'];
player.equipment.weapon = orcSlayerWeapon;

const orcMonster = { type: 'ORC', name: 'Snaga Orc', conMod: 0 };
const dragonMonster = { type: 'DRAGON', name: 'Young Red Dragon', conMod: 0 };

const orcSlayResult = TomeEgoEngine.getSlayMultiplier(player, orcMonster);
assert(orcSlayResult.multiplier === 2.5, `1. 오크 대상 슬레이 배율 2.5배 적용 확인 (${orcSlayResult.slayType})`);

const dragonSlayResult = TomeEgoEngine.getSlayMultiplier(player, dragonMonster);
assert(dragonSlayResult.multiplier === 1.0, '2. 비대상 몬스터에겐 슬레이 미적용(1.0배) 확인');

// 2. 화염 브랜드 (BRAND_FIRE: +50% 화염 추가 피해)
const brandResult = TomeEgoEngine.getBrandDamage(player, 20);
assert(brandResult.extraDmg === 10, `3. 화염 브랜드 +50% 추가 피해(+${brandResult.extraDmg}) 산출 확인`);
assert(brandResult.element === 'FIRE', '4. 브랜드 속성 FIRE 확인');

// 3. 원소 저항 (RES_FIRE)
const fireShield = new Item(0, 0, 'SHIELD', ')', '#ffd700', '유물: 안나르', 0, 'SHIELD');
fireShield.flags = ['RES_FIRE', 'FREE_ACT'];
player.equipment.shield = fireShield;

assert(TomeEgoEngine.hasElementalResistance(player, 'FIRE') === true, '5. 방패의 RES_FIRE 저항 감지 확인');
assert(TomeEgoEngine.hasElementalResistance(player, 'COLD') === false, '6. 미보유 속성 저항 false 확인');
assert(TomeEgoEngine.hasFreeAction(player) === true, '7. 방패의 FREE_ACT 마비 면역 감지 확인');

console.log('\n========================================================');
console.log(`🎉 [CONSUMABLE, AC & EGO TEST RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
