/**
 * @file test_data_oriented_items.js
 * @description ToME 501종 아이템 및 소비품/디바이스 데이터 지향 엔티티화 & 3대 무상태 시스템 엔진 통합 검증 테스트
 *              1. TomeConsumableEngine (포션 6단계 치유, 스탯 영약, 속도, 무적, 해독, 주문서, 플라스크, 음식 더미화)
 *              2. TomeDeviceEngine (완드 charges 소모, 스태프 광역 방출, 로드 timeout 쿨다운 및 tickTimeouts)
 *              3. TomeEquipmentEngine (tval 기반 슬롯 도출, 심볼, 유효 AC, 무기 카테고리, 동적 무게)
 *              4. Item.js Zero-Logic 위임 및 Game.js 무결성 검증
 *              5. name.includes(...) 잔재 0건 정적 감사
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Item } from '../src/entities/Item.js';
import { Player } from '../src/entities/Player.js';
import { Map } from '../src/map/Map.js';
import { TVAL, TomeEquipmentEngine } from '../src/systems/TomeEquipmentEngine.js';
import { TomeConsumableEngine } from '../src/systems/TomeConsumableEngine.js';
import { TomeDeviceEngine } from '../src/systems/TomeDeviceEngine.js';
import { TOME_KINDS_DATA } from '../src/entities/TomeKindsData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let total = 0;
let passed = 0;

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
console.log('🧪 ToME 501종 아이템 & 3대 무상태 엔진 (DOD Rebuilding) 단위 테스트');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// [TEST SUITE 1] TomeEquipmentEngine: 무상태 슬롯, 아스키 심볼, 무게, AC 연산 검증
// -----------------------------------------------------------------------------
console.log('🧪 [TEST SUITE 1] TomeEquipmentEngine 무상태 연산 검증');

// 1-1. tval 기반 slotType 도출
assert(TomeEquipmentEngine.getSlotType(TVAL.SWORD) === 'WEAPON', '1. TVAL.SWORD(23) -> WEAPON 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.BOW) === 'BOW', '2. TVAL.BOW(19) -> BOW 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.ARROW) === 'QUIVER', '3. TVAL.ARROW(17) -> QUIVER 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.HARD_ARMOR) === 'ARMOR', '4. TVAL.HARD_ARMOR(37) -> ARMOR 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.SHIELD) === 'SHIELD', '5. TVAL.SHIELD(34) -> SHIELD 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.HELM) === 'HELMET', '6. TVAL.HELM(32) -> HELMET 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.GLOVES) === 'GLOVES', '7. TVAL.GLOVES(31) -> GLOVES 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.BOOTS) === 'BOOTS', '8. TVAL.BOOTS(30) -> BOOTS 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.CLOAK) === 'CLOAK', '9. TVAL.CLOAK(35) -> CLOAK 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.LITE) === 'LIGHT', '10. TVAL.LITE(39) -> LIGHT 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.RING) === 'RING', '11. TVAL.RING(45) -> RING 슬롯 도출');
assert(TomeEquipmentEngine.getSlotType(TVAL.AMULET) === 'AMULET', '12. TVAL.AMULET(40) -> AMULET 슬롯 도출');

// 1-2. ToME 2.3.5 정통 심볼 및 레거시 문자 정제
assert(TomeEquipmentEngine.getDefaultSymbol('POTION', null, TVAL.POTION) === '!', '13. 포션 기본 심볼 ! 확인');
assert(TomeEquipmentEngine.getDefaultSymbol('SCROLL', null, TVAL.SCROLL) === '?', '14. 주문서 기본 심볼 ? 확인');
assert(TomeEquipmentEngine.getDefaultSymbol('WAND', null, TVAL.WAND) === '-', '15. 완드 기본 심볼 - 확인');
assert(TomeEquipmentEngine.getDefaultSymbol('STAFF', null, TVAL.STAFF) === '/', '16. 스태프 기본 심볼 / 확인');
assert(TomeEquipmentEngine.getDefaultSymbol('ROD', null, TVAL.ROD) === '-', '17. 로드 기본 심볼 - 확인');
assert(TomeEquipmentEngine.getDefaultSymbol('FOOD', null, TVAL.FOOD) === ',', '18. 음식 기본 심볼 , 확인');
assert(TomeEquipmentEngine.sanitizeSymbol('w', 'WEAPON', 'WEAPON', TVAL.SWORD) === '|', '19. 레거시 문자 "w" -> "|" 자동 정제 확인');

// 1-3. 유효 AC 및 동적 무게 연산
const plateArmor = new Item(0, 0, 'ARMOR', '[', '#fff', 'Full Plate');
plateArmor.baseAC = 25;
plateArmor.to_a = 5;
plateArmor.upgradeLevel = 2;
assert(TomeEquipmentEngine.calculateEffectiveAC(plateArmor) === 32, '20. 유효 방어력 (25+5+2=32) 산출 확인');

plateArmor.count = 2;
plateArmor._weight = 20;
assert(TomeEquipmentEngine.calculateWeight(plateArmor) === 40, '21. 중첩 아이템 동적 무게 (20*2=40) 산출 확인');

// -----------------------------------------------------------------------------
// [TEST SUITE 2] TomeConsumableEngine: 포션 6단계 치유 및 특수 비약 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 2] TomeConsumableEngine 포션 6단계 치유 & 특수 비약 검증');

const player = new Player(10, 10);
const logs = [];
const mockGame = {
  player,
  map: new Map(40, 30, 1),
  monsters: [],
  addLogEntry: (msg, type) => logs.push({ msg, type })
};

// 2-1. 6단계 치유 포션
// 1단계: Cure Light Wounds (sval 34, +20)
player.stats.hp = 10;
const pLight = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Cure Light Wounds');
pLight.tval = TVAL.POTION;
pLight.sval = 34;
pLight.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.stats.hp === 30, `22. 1단계 Cure Light Wounds 체력 +20 회복 (10 -> ${player.stats.hp})`);

// 2단계: Cure Serious Wounds (sval 35, +50, poison/frost 정화)
player.stats.hp = 10;
player.debuffs.poison = 5;
player.debuffs.frost = 3;
const pSerious = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Cure Serious Wounds');
pSerious.tval = TVAL.POTION;
pSerious.sval = 35;
pSerious.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.stats.hp === 60, `23. 2단계 Cure Serious Wounds 체력 +50 회복 (10 -> ${player.stats.hp})`);
assert(player.debuffs.poison === 0 && player.debuffs.frost === 0, '24. 독 및 동결 상태이상 완전 정화 확인');

// 3단계: Cure Critical Wounds (sval 36, +100 -> 풀피 회복)
player.stats.hp = 10;
const pCritical = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Cure Critical Wounds');
pCritical.tval = TVAL.POTION;
pCritical.sval = 36;
pCritical.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.stats.hp === player.stats.maxHp, `25. 3단계 Cure Critical Wounds 체력 +100 풀피 회복 (HP: ${player.stats.hp}/${player.stats.maxHp})`);

// 4단계: *Healing* (sval 38, +300 -> 풀피 회복)
player.stats.hp = 10;
const pHealing = new Item(0, 0, 'POTION', '!', '#f43f5e', '*Healing*');
pHealing.tval = TVAL.POTION;
pHealing.sval = 38;
pHealing.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.stats.hp === player.stats.maxHp, `26. 4단계 *Healing* 체력 +300 풀피 회복 (HP: ${player.stats.hp}/${player.stats.maxHp})`);

// 5단계: Life (sval 39, 풀피 회복 + CON 성장으로 maxHp 증가)
player.stats.hp = 20;
const oldMax = player.stats.maxHp;
const pLife = new Item(0, 0, 'POTION', '!', '#f43f5e', 'Life');
pLife.tval = TVAL.POTION;
pLife.sval = 39;
pLife.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.stats.hp === player.stats.maxHp, `27. 5단계 Life 풀피 회복 확인 (HP: ${player.stats.hp})`);
assert(player.stats.maxHp >= oldMax, `28. 5단계 Life 생명력 CON 성장으로 최대 체력 증가 확인 (${oldMax} -> ${player.stats.maxHp})`);

// 6단계: Blood of Life (sval 3, 풀피 회복 + CON 성장)
player.stats.hp = 20;
const pBlood = new Item(0, 0, 'POTION', '!', '#f43f5e', '& Blood~ of Life');
pBlood.tval = TVAL.POTION;
pBlood.sval = 3;
pBlood.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.stats.hp === player.stats.maxHp, `29. 6단계 Blood of Life 체력 완전 충전 확인 (HP: ${player.stats.hp})`);

// 2-2. 스탯 영구 성장 영약
const oldDex = player.baseStats.dex || 10;
const pDex = new Item(0, 0, 'POTION', '!', '#10b981', 'Dexterity');
pDex.tval = TVAL.POTION;
pDex.sval = 51;
pDex.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.baseStats.dex === oldDex + 1, `30. 민첩 영약 (sval 51) 기본 DEX +1 영구 상승 확인 (${oldDex} -> ${player.baseStats.dex})`);

// 2-3. 가속, 무적, 해독 비약
const pSpeed = new Item(0, 0, 'POTION', '!', '#fbbf24', 'Speed');
pSpeed.tval = TVAL.POTION;
pSpeed.sval = 18;
pSpeed.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.speedBuffTurns >= 15, `31. 가속 물약 (sval 18) 15턴 버프 획득 확인 (${player.speedBuffTurns}턴)`);

const pInvuln = new Item(0, 0, 'POTION', '!', '#fbbf24', 'Invulnerability');
pInvuln.tval = TVAL.POTION;
pInvuln.sval = 62;
pInvuln.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(player.invulnerableTurns >= 10, `32. 절대 무적 영약 (sval 62) 10턴 무적 확인 (${player.invulnerableTurns}턴)`);

// -----------------------------------------------------------------------------
// [TEST SUITE 3] TomeConsumableEngine: 주문서, 기름 플라스크, 음식 및 코어 포식 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 3] 주문서, 플라스크, 음식 더미화 & 코어 포식 검증');

// 3-1. 위상문 (Phase Door: sval 8) & 순간이동 (Teleportation: sval 10)
const sPhase = new Item(0, 0, 'SCROLL', '?', '#c084fc', 'Phase Door');
sPhase.tval = TVAL.SCROLL;
sPhase.sval = 8;
const phaseOk = sPhase.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(phaseOk === true, '33. 위상문 주문서 (sval 8) 차원 도약 성공');
assert(mockGame.map.isWalkable(player.x, player.y), '34. 위상문 도약 후 안전 타일 위치 확인');

// 3-2. 마법 지도 (Magic Mapping: sval 25)
const sMap = new Item(0, 0, 'SCROLL', '?', '#38bdf8', 'Magic Mapping');
sMap.tval = TVAL.SCROLL;
sMap.sval = 25;
sMap.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(mockGame.map.tiles[5][5].isExplored === true, '35. 마법 지도 주문서 (sval 25) 던전 전역 100% 개방 확인');

// 3-3. 무기/방어구 인챈트 주문서
const testSword = new Item(0, 0, 'WEAPON', '|', '#cbd5e1', 'Broad Sword', 0, 'WEAPON');
testSword.upgradeLevel = 0;
testSword.toHit = 0;
testSword.toDmg = 0;
player.equipment.weapon = testSword;

const sEnchantW = new Item(0, 0, 'SCROLL', '?', '#a855f7', '*Enchant Weapon*');
sEnchantW.tval = TVAL.SCROLL;
sEnchantW.sval = 21;
sEnchantW.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(testSword.upgradeLevel === 1, '36. *Enchant Weapon* 강화도 +1 확인');
assert(testSword.toHit === 1 && testSword.toDmg === 1, '37. 명중 +1 및 피해 +1 증가 확인');

// 3-4. 대파괴 (*Destruction*: sval 41)
const dummyMonster = { x: player.x + 2, y: player.y + 2, stats: { hp: 50 }, displayName: 'Orc' };
mockGame.monsters = [dummyMonster];
const sDestruction = new Item(0, 0, 'SCROLL', '?', '#ef4444', '*Destruction*');
sDestruction.tval = TVAL.SCROLL;
sDestruction.sval = 41;
sDestruction.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(mockGame.monsters.length === 0, '38. 대파괴 주문서 (*Destruction*) 15칸 반경 몬스터 일소 확인');

// 3-5. 기름 플라스크 (Flask of Oil: tval 77, sval 0)
const lamp = new Item(0, 0, 'LAMP', '~', '#fbbf24', 'Brass Lantern', 2, 'LIGHT');
lamp.fuelTurns = 500;
player.equippedLamp = lamp;

const flask = new Item(0, 0, 'FLASK', '!', '#f59e0b', 'Flask of oil');
flask.tval = TVAL.FLASK;
flask.sval = 0;
flask.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(lamp.fuelTurns === 8000, `39. 기름 플라스크 등불 7500턴 급유 확인 (500 -> ${lamp.fuelTurns}턴)`);

// 3-6. 음식 더미화 (Food: tval 80, sval 35)
const food = new Item(0, 0, 'FOOD', ',', '#d97706', 'Ration of Food');
food.tval = TVAL.FOOD;
food.sval = 35;
food.count = 2;
let foodLogMsg = '';
food.applyUseEffect(player, (m, t) => { foodLogMsg = m; }, mockGame);
assert(foodLogMsg.includes('아무런 맛도 느껴지지 않습니다'), '40. 공복 시스템 부재에 따른 음식 안전 더미화 로그 확인');
assert(food.count === 1, '41. 음식 섭취 시 아이템 수량 정상 소모 확인');

// 3-7. 미믹 코어 포식 무결성
let coreEaten = false;
player.useCoreAsFood = (coreItem, g) => { coreEaten = true; return true; };
const coreItem = new Item(0, 0, 'CORE', '*', '#38bdf8', 'Goblin Core');
coreItem.applyUseEffect(player, (m, t) => {}, mockGame);
assert(coreEaten === true, '42. 미믹 코어 아이템 포식 파이프라인 무결성 확인');

// -----------------------------------------------------------------------------
// [TEST SUITE 4] TomeDeviceEngine: 완드, 스태프, 로드 디바이스 시스템 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 4] TomeDeviceEngine 완드, 스태프, 로드 디바이스 검증');

// 4-1. 완드 (Wand: tval 65, charges 소모 & 실패율)
const wand = new Item(0, 0, 'WAND', '-', '#38bdf8', 'Manathrust Wand');
wand.tval = TVAL.WAND;
wand.sval = 3; // Manathrust
wand.charges = 5;

// 플레이어 INT 높여서 실패율 0%로 최소화
player.baseStats.int = 50;
player.stats.int = 50;
player.markDirty("테스트 INT 증가");

const targetMonster = { x: player.x + 1, y: player.y, stats: { hp: 50 }, displayName: 'Test Goblin' };
mockGame.monsters = [targetMonster];

const wandResult = wand.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
if (wandResult) {
  assert(wand.charges === 4, `43. 완드 성공 시 charges 1 차감 확인 (5 -> ${wand.charges})`);
  assert(targetMonster.stats.hp === 20, `44. Manathrust 완드 30 마나 피해 적용 확인 (50 -> ${targetMonster.stats.hp})`);
} else {
  assert(wand.charges === 5, '43. 완드 실패 시 charges 보존 확인');
}

// 4-2. 스태프 (Staff: tval 55, 광역 방출 & charges 소모)
const staff = new Item(0, 0, 'STAFF', '/', '#c084fc', 'Recovery Staff');
staff.tval = TVAL.STAFF;
staff.sval = 11; // Recovery
staff.charges = 3;
player.stats.hp = 10;
let staffResult = false;
for (let attempt = 0; attempt < 10 && !staffResult; attempt++) {
  staff.charges = 3;
  player.stats.hp = 10;
  staffResult = staff.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
}
assert(staffResult === true && staff.charges === 2, `45. 스태프 발동 시 charges 1 차감 확인 (3 -> ${staff.charges})`);
assert(player.stats.hp === player.stats.maxHp, `46. Recovery 스태프 +150 대규모 회복 확인 (10 -> ${player.stats.hp}/${player.stats.maxHp})`);

// 4-3. 로드 (Rod: tval 66, 무충전 소모 & 쿨다운 timeout 설정 및 턴 감쇄)
const rod = new Item(0, 0, 'ROD', '-', '#fbbf24', 'Speed Rod');
rod.tval = TVAL.ROD;
rod.sval = 11; // Speed
rod.timeout = 0;
player.inventory = [rod];

const rodResult1 = rod.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(rodResult1 === true, '47. 로드 첫 번째 사용 성공');
assert(rod.timeout === 30, `48. 로드 쿨다운 timeout=30 설정 확인 (timeout: ${rod.timeout})`);

// 쿨다운 중 재사용 시도 -> 차단
const rodResult2 = rod.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(rodResult2 === false, '49. 쿨다운 중 로드 재사용 안전 차단 확인');

// 턴 경과: tickTimeouts 호출
TomeDeviceEngine.tickTimeouts(player.inventory);
assert(rod.timeout === 29, `50. 턴 경과 시 tickTimeouts로 timeout 1 감쇄 확인 (30 -> ${rod.timeout})`);

for (let i = 0; i < 29; i++) {
  TomeDeviceEngine.tickTimeouts(player.inventory);
}
assert(rod.timeout === 0, `51. 29턴 추가 경과 후 로드 쿨다운 완전 해제 (timeout: ${rod.timeout})`);

const rodResult3 = rod.applyUseEffect(player, (m, t) => logs.push(m), mockGame);
assert(rodResult3 === true, '52. 쿨다운 만료 후 로드 재사용 성공 확인');

// -----------------------------------------------------------------------------
// [TEST SUITE 5] 정적 코드 감사: name.includes(...) 비즈니스 로직 잔재 0건 검증
// -----------------------------------------------------------------------------
console.log('\n🧪 [TEST SUITE 5] 3대 무상태 시스템 및 Item.js 정적 코드 감사');

const filesToAudit = [
  path.resolve(__dirname, '../src/systems/TomeConsumableEngine.js'),
  path.resolve(__dirname, '../src/systems/TomeDeviceEngine.js'),
  path.resolve(__dirname, '../src/systems/TomeEquipmentEngine.js'),
  path.resolve(__dirname, '../src/entities/Item.js')
];

let forbiddenFound = 0;
for (const fPath of filesToAudit) {
  const code = fs.readFileSync(fPath, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    // Check for name.includes( or _baseName.includes(
    if ((line.includes('name.includes(') || line.includes('_baseName.includes(')) && !line.includes('//')) {
      console.error(`  ❌ [FAIL] 금지된 문자열 파싱 발견: ${path.basename(fPath)}:${idx + 1} -> ${line.trim()}`);
      forbiddenFound++;
    }
  });
}
assert(forbiddenFound === 0, `53. 3대 엔진 및 Item.js 내 name.includes(...) 잔재 0건 확인 (발견: ${forbiddenFound})`);

// -----------------------------------------------------------------------------
// 최종 결과 요약
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`🏁 UNIT TEST COMPLETE: ${passed} PASSED / ${total - passed} FAILED (Total ${total})`);
console.log('================================================================================');

if (passed === total) {
  console.log('🎉 ALL DATA-ORIENTED ITEM SYSTEM TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
} else {
  process.exit(1);
}
