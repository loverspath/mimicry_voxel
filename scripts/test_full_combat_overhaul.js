/**
 * scripts/test_full_combat_overhaul.js
 * ToME 2.3.5 정통 전투·스탯·원거리·스타터킷·다중타격·이원화 숙련도 전수 검증 스크립트
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { getSpeciesConfig, MONSTER_SPECIES } from '../src/entities/MonsterRegistry.js';
import { CombatCalculator } from '../src/core/CombatCalculator.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { COMBAT_CONFIG, STAT_METADATA, TOME_SLAY_CONFIG, RANGED_COMBAT_CONFIG } from '../src/configs/GameBalanceConfig.js';
import { WEAPON_MASTERY_CONFIG } from '../src/entities/MimicBody.js';

console.log("================================================================================");
console.log("⚔️ [ToME 2.3.5 FULL COMBAT & MASTERY OVERHAUL TEST SUITE] ⚔️");
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
// TEST 1: 6대 정통 스탯 (STR, INT, WIS, DEX, CON, CHR) 전역 확장 검증
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 6대 정통 스탯 시스템 (STR/INT/WIS/DEX/CON/CHR) 검증 ---");
const player = new Player(10, 10);
assert(player.getEffectiveStat('str') >= 8, `Player STR is accessible: ${player.getEffectiveStat('str')}`);
assert(player.getEffectiveStat('int') >= 5, `Player INT is accessible: ${player.getEffectiveStat('int')}`);
assert(player.getEffectiveStat('wis') >= 8, `Player WIS is accessible: ${player.getEffectiveStat('wis')}`);
assert(player.getEffectiveStat('dex') >= 8, `Player DEX is accessible: ${player.getEffectiveStat('dex')}`);
assert(player.getEffectiveStat('con') >= 8, `Player CON is accessible: ${player.getEffectiveStat('con')}`);
assert(player.getEffectiveStat('chr') >= 6, `Player CHR is accessible: ${player.getEffectiveStat('chr')}`);

assert(typeof player.strMod === 'number', `strMod getter exists: +${player.strMod}`);
assert(typeof player.intMod === 'number', `intMod getter exists: +${player.intMod}`);
assert(typeof player.wisMod === 'number', `wisMod getter exists: +${player.wisMod}`);
assert(typeof player.dexMod === 'number', `dexMod getter exists: +${player.dexMod}`);
assert(typeof player.conMod === 'number', `conMod getter exists: +${player.conMod}`);
assert(typeof player.chrMod === 'number', `chrMod getter exists: +${player.chrMod}`);

const wisBreakdown = player.getEffectiveStatWithBreakdown('wis');
assert(wisBreakdown.contributions.length > 0, `WIS Breakdown has contributions: ${wisBreakdown.contributions.map(c => c.source).join(', ')}`);

const chrBreakdown = player.getEffectiveStatWithBreakdown('chr');
assert(chrBreakdown.contributions.length > 0, `CHR Breakdown has contributions: ${chrBreakdown.contributions.map(c => c.source).join(', ')}`);

// -----------------------------------------------------------------------------
// TEST 2: ToME 2.3.5 정통 스타터 킷 7종 지급 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: ToME 2.3.5 정통 스타터 킷 7종 검증 ---");
const inv = player.inventory;
const eq = player.equipment;

const weapon = eq.weapon;
assert(weapon && weapon.name.includes("Short Sword"), `1. 무기 슬롯에 Short Sword 장착됨 (${weapon?.name}, 주사위: ${weapon?.dice}, to_h:+${weapon?.toHit}, to_d:+${weapon?.toDmg})`);

const armor = eq.armor;
assert(armor && armor.name.includes("Soft Leather Armour"), `2. 갑옷 슬롯에 Soft Leather Armour 장착됨 (${armor?.name}, 방어도: ${armor?.statBonuses?.con})`);

const shortbow = inv.find(i => i.name.includes("Shortbow") || i.char === '}');
assert(shortbow && shortbow.range === 5 && shortbow.multiplier === 2.0, `3. 인벤토리에 Shortbow 소지 (${shortbow?.name}, 사거리: ${shortbow?.range}칸, 배율: x${shortbow?.multiplier})`);

const arrows = inv.find(i => i.name.includes("Bundle of Arrows") || i.char === '{');
assert(arrows && arrows.count === 30, `4. 인벤토리에 Bundle of Arrows 30발 소지 (${arrows?.name}, 수량: ${arrows?.count})`);

const torch = inv.find(i => i.name.includes("Wooden Torch") || i.char === '~');
assert(torch && torch.count === 3, `5. 인벤토리에 Wooden Torch 3개 소지 (${torch?.name}, 수량: ${torch?.count})`);

const healPotion = inv.find(i => i.name.includes("Potion of Cure Light Wounds") || i.char === '!');
assert(healPotion && healPotion.count === 3, `6. 인벤토리에 Potion of Cure Light Wounds 3병 소지 (${healPotion?.name}, 수량: ${healPotion?.count})`);

const food = inv.find(i => i.name.includes("Ration of Food") || i.char === ',');
assert(food && food.count === 2, `7. 인벤토리에 Ration of Food 2개 소지 (${food?.name}, 수량: ${food?.count})`);

// -----------------------------------------------------------------------------
// TEST 3: ToME 정통 밀리 전투 & Slay/Brand 공식 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: ToME 정통 밀리 전투 & Slay/Brand 배율 검증 ---");
const orcMonster = new Monster(11, 10, 'ORC', 5);
const dragonMonster = new Monster(12, 10, 'DRAGON', 20);

// Slay Weapon
const dragonSlayingSword = {
  name: "Dragon Slaying Broadsword",
  dice: "2d6",
  slotType: "WEAPON",
  weaponCategory: "SWORD",
  specialTags: ["SLAY_DRAGON"]
};

const slayRes1 = CombatCalculator.calculateSlayMultiplier(player, dragonMonster, dragonSlayingSword, {});
assert(slayRes1.multiplier === 4.0, `SLAY_DRAGON vs DRAGON -> x4.0 배율 적용 (${slayRes1.slayName})`);

const orcSlayingDagger = {
  name: "Orcrist Dagger",
  dice: "1d6",
  slotType: "WEAPON",
  weaponCategory: "SWORD",
  specialTags: ["SLAY_ORC"]
};

const slayRes2 = CombatCalculator.calculateSlayMultiplier(player, orcMonster, orcSlayingDagger, {});
assert(slayRes2.multiplier === 3.0, `SLAY_ORC vs ORC -> x3.0 배율 적용 (${slayRes2.slayName})`);

// -----------------------------------------------------------------------------
// TEST 4: 원거리 사격 엔진 (Archery, LoS, 사거리, 화살 차감) 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 원거리 사격 엔진 (Archery, Bresenham LoS, Range) 검증 ---");
const mockMap = {
  isWalkable: (x, y) => true // 열린 시야
};

const mockMapWithWall = {
  isWalkable: (x, y) => !(x === 11 && y === 10) // 벽으로 가로막힘
};

const targetMonster = new Monster(14, 10, 'GOBLIN', 3); // 거리: 4칸 (x: 10 -> 14)
player.equipment.weapon = shortbow; // 활 장착

// LoS Open
const rangedHit = CombatCalculator.calculateRangedAttack(player, targetMonster, shortbow, arrows, {}, mockMap);
assert(rangedHit.valid === true, `4칸 거리 사격 유효 판정 (거리: ${rangedHit.dist}칸)`);

let successfulHit = null;
for (let attempt = 0; attempt < 30; attempt++) {
  const res = CombatCalculator.calculateRangedAttack(player, targetMonster, shortbow, arrows, {}, mockMap);
  if (res.isHit) {
    successfulHit = res;
    break;
  }
}
assert(successfulHit && typeof successfulHit.damage === 'number' && successfulHit.damage > 0, `원거리 대미지 산출 성공: ${successfulHit?.damage} dmg (DEX 기반 x2.0 배율)`);

// LoS Blocked
const rangedBlocked = CombatCalculator.calculateRangedAttack(player, targetMonster, shortbow, arrows, {}, mockMapWithWall);
assert(rangedBlocked.valid === false && rangedBlocked.reason === "NO_LOS", `장애물 벽에 의한 시선(LoS) 차단 감지 성공`);

// Out of range test
const farMonster = new Monster(20, 10, 'GOBLIN', 3); // 거리: 10칸
const rangedFar = CombatCalculator.calculateRangedAttack(player, farMonster, shortbow, arrows, {}, mockMap);
assert(rangedFar.valid === false && rangedFar.reason === "OUT_OF_RANGE", `최대 사거리(5칸) 초과 사격 방지 성공 (거리: 10칸)`);

// -----------------------------------------------------------------------------
// TEST 5: 몬스터 다중 타격(Blows) 및 플레이어 변신 연타 계승 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: 몬스터 다중 타격(Blows) 및 변신 계승 검증 ---");
const dragonBlows = CombatCalculator.calculateMonsterBlows(dragonMonster);
assert(dragonBlows.length >= 2, `성체 드래곤 다중 타격 Blows 보유 (${dragonBlows.length}연타: ${dragonBlows.map(b => `${b.method} ${b.dice}`).join(', ')})`);

// Player Morphed into Dragon with Unarmed
player.equipment.weapon = null; // 맨손 해제
player.mimicCore = {
  name: "성체 드래곤",
  coreType: "DRAGON",
  level: 15
};

const playerDragonBlows = CombatCalculator.calculatePlayerBlows(player, {});
assert(playerDragonBlows.length >= 2, `드래곤 코어 변신 시 맨손 1~4연타 Blows 시퀀스 계승 성공 (${playerDragonBlows.length}연타: ${playerDragonBlows.map(b => b.method).join(', ')})`);

// -----------------------------------------------------------------------------
// TEST 6: 이원화 숙련도 (Dual Mastery) 검증 (무기 궁술 & 종족 변신 로어)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 6: 이원화 숙련도 (Dual Mastery: Archery & Morph Lore) 검증 ---");
assert(WEAPON_MASTERY_CONFIG.categories.ARCHERY !== undefined, `궁술 사격 (ARCHERY) 무기 숙련도 카테고리 등록 확인`);

const initialArcheryLvl = player.body.getWeaponMasteryLevel("ARCHERY");
assert(initialArcheryLvl === 1, `궁술 초기 숙련도 Lv.1`);

// Gain Archery Mastery XP
player.body.weaponMastery.ARCHERY.count = 200;
const upgradedArcheryLvl = player.body.getWeaponMasteryLevel("ARCHERY");
assert(upgradedArcheryLvl >= 4, `궁술 숙련도 200회 누적 시 Lv.${upgradedArcheryLvl} 승격`);

// Morph Lore Mastery
const initialDragonLore = player.body.getLoreLevel("DRAGON");
assert(initialDragonLore === 1, `드래곤 로어 초기 숙련도 Lv.1`);

player.body.gainLoreXp("DRAGON", 350);
const upgradedDragonLore = player.body.getLoreLevel("DRAGON");
assert(upgradedDragonLore >= 4, `드래곤 로어 350 XP 누적 시 Lv.${upgradedDragonLore} 승격`);

const loreMult = player.body.getLoreMultiplier("DRAGON");
assert(loreMult > 1.0, `드래곤 로어 숙련도에 따른 의태 능력치 증폭 배율: x${loreMult.toFixed(3)}`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
