/**
 * scripts/test_starter_body.js
 * ToME 2.3.5 Starter Body (MON_NOVICE_WARRIOR) & Homunculus (MON_HOMUNCULUS) Core Integration Test
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { getSpeciesConfig, LEGACY_TOME_ALIASES_MAP } from '../src/entities/MonsterRegistry.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';

console.log("================================================================================");
console.log("🛡️ [ToME 2.3.5 STARTER BODY & HOMUNCULUS INTEGRATION TEST SUITE] 🛡️");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Default Starter Body is MON_NOVICE_WARRIOR (휴먼 바디)
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 신규 캐릭터 기본 스타팅 바디 (MON_NOVICE_WARRIOR) 검증 ---");
const player = new Player(10, 10);

assert(player.mimicCore.coreType === 'MON_NOVICE_WARRIOR', `기본 코어 타입이 MON_NOVICE_WARRIOR 임 (${player.mimicCore.coreType})`);
assert(player.isPlayer === true, `플레이어 isPlayer 플래그 true 확인`);
assert(player.char === '@', `휴먼 바디 플레이어 심볼이 '@' 임 ('${player.char}')`);
assert(player.mimicCore.char === 'p', `휴먼 바디 코어 원본 글리프가 'p' 임 ('${player.mimicCore.char}')`);

// -----------------------------------------------------------------------------
// TEST 2: Starter Kit 7 Items equipped / in inventory
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: ToME 정통 스타터 킷 7종 무결성 검증 ---");
const weapon = player.equipment.weapon;
assert(weapon && weapon.name.includes('Short Sword') && weapon.dice === '1d7', `무기: Short Sword (1d7) 기본 장착됨`);

const armor = player.equipment.armor;
assert(armor && armor.name.includes('Soft Leather Armour'), `갑옷: Soft Leather Armour 기본 장착됨`);

const shortbow = player.inventory.find(i => i.name.includes('Shortbow') || i.char === '}');
assert(shortbow && shortbow.range === 5 && shortbow.multiplier === 2.0, `인벤토리: Shortbow (사거리 5, 배율 x2.0) 소지`);

const arrows = player.inventory.find(i => i.name.includes('Bundle of Arrows') || i.char === '{');
assert(arrows && arrows.count === 30, `인벤토리: Bundle of Arrows 30발 소지`);

const torch = player.inventory.find(i => i.name.includes('Wooden Torch') || i.char === '~');
assert(torch && torch.count === 3, `인벤토리: Wooden Torch 3개 소지`);

const healPotion = player.inventory.find(i => i.name.includes('Potion of Cure Light Wounds') || i.char === '!');
assert(healPotion && healPotion.count === 3, `인벤토리: Potion of Cure Light Wounds 3병 소지`);

const food = player.inventory.find(i => i.name.includes('Ration of Food') || i.char === ',');
assert(food && food.count === 2, `인벤토리: Ration of Food 2개 소지`);

// -----------------------------------------------------------------------------
// TEST 3: Novice Warrior Unarmed Blows (2-Hit Sequence: 1d7 + 1d6)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 휴먼 바디 맨손 2연타 타격 (Blows: 1d7 + 1d6) 계승 검증 ---");
player.equipment.weapon = null; // 맨손 상태로 전환
const warriorBlows = CombatCalculator.calculatePlayerBlows(player, {});

assert(warriorBlows.length === 2, `휴먼 바디 맨손 2연타 시퀀스 발동 확인 (${warriorBlows.length}타)`);
assert(warriorBlows[0].dice === '1d7' && warriorBlows[1].dice === '1d6', `1타 1d7, 2타 1d6 다이스 확인 (1타: ${warriorBlows[0].dice}, 2타: ${warriorBlows[1].dice})`);

// -----------------------------------------------------------------------------
// TEST 4: Homunculus (MON_HOMUNCULUS / IMP) Core Morph & Intrinsic Flags
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 호문쿨루스 (MON_HOMUNCULUS / 임프 상응체) 변신 및 특성 검증 ---");
const homunculusConfig = getSpeciesConfig('MON_HOMUNCULUS');
assert(homunculusConfig !== null, `MON_HOMUNCULUS 설정 조회 성공`);

// Legacy IMP key alias resolution check
const legacyImpConfig = getSpeciesConfig('IMP');
assert(legacyImpConfig && legacyImpConfig.coreType === 'MON_HOMUNCULUS', `레거시 키 'IMP' -> 'MON_HOMUNCULUS' 단일화 매핑 성공`);

// Morph player into Homunculus
player.mimicCore = {
  name: homunculusConfig.name,
  coreType: homunculusConfig.coreType,
  level: 15
};

assert(player.canFly === true, `호문쿨루스 변신 시 비행 특성(CAN_FLY) 활성화 확인`);
const resistances = player.getCombinedResistances();
assert(resistances.includes('FIRE'), `호문쿨루스 변신 시 화염 면역(IM_FIRE) 활성화 확인`);

const homunculusBlows = CombatCalculator.calculatePlayerBlows(player, {});
assert(homunculusBlows.length === 2, `호문쿨루스 맨손 2연타 발동 확인 (${homunculusBlows.length}타)`);
assert(homunculusBlows[0].effect === 'PARALYZE', `호문쿨루스 1타 마비(PARALYZE) 효과 계승 확인`);
assert(homunculusBlows[1].dice === '1d10', `호문쿨루스 2타 1d10 강타 피해 다이스 계승 확인`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
