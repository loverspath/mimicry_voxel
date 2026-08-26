/**
 * @file test_dungeon_budget.js
 * @description ToME/TomeNET 정통 층 깊이(Depth 1~50F) 기반 던전 밸류 예산 시스템(DungeonValueBudgetEngine)
 *              단위 테스트 및 1~50층 100회 시뮬레이션 통합 검증 스위트.
 */

import {
  DungeonValueBudgetEngine,
  DUNGEON_TIER_CONFIGS,
  getTierConfig,
  calculateFloorDanger,
  getSpecialRoomProbabilities,
  rollOutOfDepthLevel,
  rollMonsterAffixes,
  rollMonsterJobSuffix,
  calculateEnchantments,
  sigmoid,
  rollGaussian
} from '../src/systems/DungeonValueBudgetEngine.js';

import { Map } from '../src/map/Map.js';
import { Spawner } from '../src/core/Spawner.js';
import { Player } from '../src/entities/Player.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';
import { UniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { PREFIX_TAGS, SUFFIX_TAGS } from '../src/entities/Tags.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log("================================================================================");
console.log("🏰 DUNGEON VALUE BUDGET ENGINE (1~50F) TIER GATING & SIMULATION TEST SUITE");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// TEST SUITE 1: DungeonValueBudgetEngine 핵심 단위 함수 검증
// -----------------------------------------------------------------------------
console.log("\n🧪 [TEST SUITE 1] DungeonValueBudgetEngine 순수 함수 및 티어 명세 검증");
{
  // 1. 4단계 티어 명세 조회
  const t1 = getTierConfig(1);
  const t1_end = getTierConfig(5);
  const t2 = getTierConfig(6);
  const t2_end = getTierConfig(20);
  const t3 = getTierConfig(21);
  const t3_end = getTierConfig(40);
  const t4 = getTierConfig(41);
  const t4_end = getTierConfig(50);

  assert(t1.tier === 1 && t1_end.tier === 1, "1~5층은 Tier 1 (초심자 구역)이어야 함");
  assert(t2.tier === 2 && t2_end.tier === 2, "6~20층은 Tier 2 (숙련자 구역)이어야 함");
  assert(t3.tier === 3 && t3_end.tier === 3, "21~40층은 Tier 3 (심층 구역)이어야 함");
  assert(t4.tier === 4 && t4_end.tier === 4, "41~50층은 Tier 4 (앙그반드 심층)이어야 함");

  // 2. 특수방 확률 검증
  const p1 = getSpecialRoomProbabilities(1);
  const p5 = getSpecialRoomProbabilities(5);
  const p6 = getSpecialRoomProbabilities(6);
  const p15 = getSpecialRoomProbabilities(15);
  const p25 = getSpecialRoomProbabilities(25);
  const p45 = getSpecialRoomProbabilities(45);

  assert(p1.vaultChance === 0 && p1.monsterPitChance === 0, "1층은 Vault 0%, Monster Pit 0%이어야 함");
  assert(p5.vaultChance === 0 && p5.monsterPitChance === 0, "5층은 Vault 0%, Monster Pit 0%이어야 함");
  assert(p6.vaultChance === 0.15 && p6.monsterPitChance === 0.12, "6~10층은 Vault 15%, Monster Pit 12%이어야 함");
  assert(p15.vaultChance === 0.18 && p15.monsterPitChance === 0.15, "11~20층은 Vault 18%, Monster Pit 15%이어야 함");
  assert(p25.vaultChance === 0.22 && p25.monsterPitChance === 0.18, "21~30층은 Vault 22%, Monster Pit 18%이어야 함");
  assert(p45.vaultChance === 0.30 && p45.monsterPitChance === 0.28, "41~50층은 Vault 30%, Monster Pit 28%이어야 함");

  // 3. 위험도(Danger Rating) 곡선 검증
  const d1 = calculateFloorDanger(1);
  const d5 = calculateFloorDanger(5);
  const d10 = calculateFloorDanger(10);
  const d20 = calculateFloorDanger(20);
  const d50 = calculateFloorDanger(50);

  assert(d1 < 5.0, `1층 위험도는 5.0 미만이어야 함 (실제: ${d1})`);
  assert(d5 < 5.0, `5층 위험도는 5.0 미만이어야 함 (실제: ${d5})`);
  assert(d10 >= 5.0 && d10 < 10.0, `10층 위험도는 5.0~10.0 사이여야 함 (실제: ${d10})`);
  assert(d20 >= 10.0 && d20 < 16.0, `20층 위험도는 10.0~16.0 사이여야 함 (실제: ${d20})`);
  assert(d50 >= 16.0, `50층 위험도는 16.0 이상이어야 함 (실제: ${d50})`);

  // 4. 가우시안 OOD 레벨 롤링 검증 (1~5층은 5 이하 엄격 제한)
  let oodViolations = 0;
  for (let i = 0; i < 500; i++) {
    const rolledLevel = rollOutOfDepthLevel(1 + (i % 5), 1.0, 10);
    if (rolledLevel > 5) oodViolations++;
  }
  assert(oodViolations === 0, `1~5층 가우시안 OOD 레벨은 5층 이하로 엄격히 제한되어야 함 (위반: ${oodViolations})`);

  // 5. 시그모이드 장비 인챈트 산출 검증
  const enc1 = calculateEnchantments(1, 'WEAPON');
  const enc25 = calculateEnchantments(25, 'WEAPON');
  const enc50 = calculateEnchantments(50, 'WEAPON');
  const encArm1 = calculateEnchantments(1, 'ARMOR');
  const encArm50 = calculateEnchantments(50, 'ARMOR');

  assert(enc1.to_h <= 3 && enc1.to_d <= 3, `1층 무기 인챈트는 +3 이하이어야 함 (+${enc1.to_h}, +${enc1.to_d})`);
  assert(enc50.to_h >= 6 && enc50.to_d >= 6, `50층 무기 인챈트는 +6 이상이어야 함 (+${enc50.to_h}, +${enc50.to_d})`);
  assert(encArm1.to_a <= 5, `1층 방어구 AC 인챈트는 +5 이하이어야 함 (+${encArm1.to_a})`);
  assert(encArm50.to_a >= 10, `50층 방어구 AC 인챈트는 +10 이상이어야 함 (+${encArm50.to_a})`);
}

// -----------------------------------------------------------------------------
// TEST SUITE 2: 몬스터 접사 및 직업 티어 게이팅 (Tier Gating) 검증
// -----------------------------------------------------------------------------
console.log("\n🧪 [TEST SUITE 2] 몬스터 접사 및 직업 롤링 티어 게이팅 검증");
{
  const blockedEpicPrefixes = ['IMMORTAL', 'BLOODTHIRSTY'];
  const blockedRarePrefixes = ['FURIOUS', 'MANA'];
  const blockedSuffixes = ['SHADOW', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST'];

  let tier1RareEpicViolations = 0;
  let tier1ChampionViolations = 0;
  let tier1ChieftainViolations = 0;

  for (let i = 0; i < 500; i++) {
    const floor = 1 + (i % 5);
    const affixes = rollMonsterAffixes(floor, true, true);
    for (const p of affixes.prefixes) {
      if (blockedEpicPrefixes.includes(p) || blockedRarePrefixes.includes(p)) {
        tier1RareEpicViolations++;
      }
    }
    for (const s of affixes.suffixes) {
      if (blockedSuffixes.includes(s)) {
        tier1RareEpicViolations++;
      }
    }

    const job = rollMonsterJobSuffix(floor, true);
    if (job === 'CHAMPION') tier1ChampionViolations++;
    if (job === 'CHIEFTAIN') tier1ChieftainViolations++;
  }

  assert(tier1RareEpicViolations === 0, `1~5층에서 RARE/EPIC 몬스터 접사는 0건이어야 함 (실제: ${tier1RareEpicViolations})`);
  assert(tier1ChampionViolations === 0, `1~5층에서 CHAMPION 직업은 0건이어야 함 (실제: ${tier1ChampionViolations})`);
  assert(tier1ChieftainViolations === 0, `1~5층에서 CHIEFTAIN 직업은 0건이어야 함 (실제: ${tier1ChieftainViolations})`);

  // 1~11층 CHAMPION 차단 및 12층+ 해금 검증
  let pre12ChampionCount = 0;
  let post12ChampionCount = 0;
  for (let i = 0; i < 300; i++) {
    const jobPre = rollMonsterJobSuffix(1 + (i % 11), true);
    if (jobPre === 'CHAMPION') pre12ChampionCount++;

    const jobPost = rollMonsterJobSuffix(12 + (i % 8), true);
    if (jobPost === 'CHAMPION') post12ChampionCount++;
  }
  assert(pre12ChampionCount === 0, `1~11층에서 CHAMPION 직업은 0건이어야 함 (실제: ${pre12ChampionCount})`);
  assert(post12ChampionCount > 0, `12~20층에서 CHAMPION 직업이 정상 등장해야 함 (실제: ${post12ChampionCount})`);

  // 1~24층 CHIEFTAIN 차단 및 25층+ 해금 검증
  let pre25ChieftainCount = 0;
  let post25ChieftainCount = 0;
  for (let i = 0; i < 300; i++) {
    const jobPre = rollMonsterJobSuffix(1 + (i % 24), true);
    if (jobPre === 'CHIEFTAIN') pre25ChieftainCount++;

    const jobPost = rollMonsterJobSuffix(25 + (i % 20), true);
    if (jobPost === 'CHIEFTAIN') post25ChieftainCount++;
  }
  assert(pre25ChieftainCount === 0, `1~24층에서 CHIEFTAIN 직업은 0건이어야 함 (실제: ${pre25ChieftainCount})`);
  assert(post25ChieftainCount > 0, `25~50층에서 CHIEFTAIN 직업이 정상 등장해야 함 (실제: ${post25ChieftainCount})`);
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: 절차적 맵 생성기(Map.js) 1~5층 Vault/Pit 0% 완전 차단 검증
// -----------------------------------------------------------------------------
console.log("\n🧪 [TEST SUITE 3] Map.js 절차적 맵 생성기 특수방 배치 검증");
{
  let lowFloorVaults = 0;
  let lowFloorPits = 0;
  let highFloorVaults = 0;
  let highFloorPits = 0;

  // 1~5층 100회 맵 생성 시뮬레이션
  for (let i = 0; i < 100; i++) {
    const floor = 1 + (i % 5);
    const map = new Map(60, 40, floor);
    for (const room of map.rooms) {
      if (room.type === 'TREASURE_VAULT') lowFloorVaults++;
      if (room.type === 'MONSTER_PIT') lowFloorPits++;
    }
  }

  assert(lowFloorVaults === 0, `1~5층 100회 생성 중 TREASURE_VAULT는 0건이어야 함 (실제: ${lowFloorVaults})`);
  assert(lowFloorPits === 0, `1~5층 100회 생성 중 MONSTER_PIT은 0건이어야 함 (실제: ${lowFloorPits})`);

  // 6~50층 100회 맵 생성 시뮬레이션
  for (let i = 0; i < 100; i++) {
    const floor = 6 + (i % 45);
    const map = new Map(60, 40, floor);
    for (const room of map.rooms) {
      if (room.type === 'TREASURE_VAULT') highFloorVaults++;
      if (room.type === 'MONSTER_PIT') highFloorPits++;
    }
  }

  assert(highFloorVaults > 0, `6~50층 100회 생성 중 TREASURE_VAULT가 정상 생성되어야 함 (실제: ${highFloorVaults})`);
  assert(highFloorPits > 0, `6~50층 100회 생성 중 MONSTER_PIT이 정상 생성되어야 함 (실제: ${highFloorPits})`);
}

// -----------------------------------------------------------------------------
// TEST SUITE 4: 1~50층 100회 스포너 & 전리품 통합 시뮬레이션 검증
// -----------------------------------------------------------------------------
console.log("\n🧪 [TEST SUITE 4] 1~50층 100회(층당 2회) Spawner & LootGenerator 런타임 시뮬레이션");
{
  const testManager = new UniqueMonsterManager();
  const player = new Player(20, 20, 'HUMAN');

  let totalMonstersSpawned = 0;
  let tier1RareEpicAffixesFound = 0;
  let tier1ArtifactsInNormalRooms = 0;
  let tier1ChampionOrChieftainFound = 0;
  let totalUniquesSpawned = 0;

  // 1~50층 x 2회 = 100회 던전 탐험 시뮬레이션
  for (let floor = 1; floor <= 50; floor++) {
    for (let iter = 1; iter <= 2; iter++) {
      const map = new Map(60, 50, floor);
      const game = {
        floor,
        floorDanger: calculateFloorDanger(floor),
        map,
        player,
        monsters: [],
        items: [],
        uniqueMonsterManager: testManager,
        addLogEntry: () => {},
        isMonsterAt: (x, y) => game.monsters.some(m => m.x === x && m.y === y)
      };

      Spawner.spawnFloorContent(game);

      totalMonstersSpawned += game.monsters.length;

      for (const m of game.monsters) {
        if (m.isUnique) {
          totalUniquesSpawned++;
        }

        if (floor <= 5) {
          // 1~5층 접사 검증
          for (const p of m.prefixes || []) {
            if (PREFIX_TAGS[p]?.rarity === 'rare' || PREFIX_TAGS[p]?.rarity === 'epic' || p === 'LEGENDARY') {
              tier1RareEpicAffixesFound++;
            }
          }
          for (const s of m.suffixes || []) {
            if (SUFFIX_TAGS[s]?.rarity === 'rare' || SUFFIX_TAGS[s]?.rarity === 'epic' || s === 'CHAMPION' || s === 'CHIEFTAIN') {
              tier1ChampionOrChieftainFound++;
            }
          }
        }
      }

      if (floor <= 5) {
        const normalRooms = map.rooms.filter(r => r.type === 'NORMAL');
        for (const it of game.items) {
          const inNormal = normalRooms.some(r => r.contains(it.x, it.y));
          if (inNormal && (it.specialTags?.includes('ARTIFACT') || it.artifactKey)) {
            tier1ArtifactsInNormalRooms++;
          }
        }
      }
    }
  }

  console.log(`  - 100회 탐험 시뮬레이션 통계:`);
  console.log(`    * 총 스폰된 몬스터 수: ${totalMonstersSpawned}`);
  console.log(`    * 조우한 유니크 몬스터 수: ${totalUniquesSpawned}`);
  console.log(`    * 1~5층 RARE/EPIC 몬스터 접사 위반: ${tier1RareEpicAffixesFound}`);
  console.log(`    * 1~5층 CHAMPION/CHIEFTAIN 위반: ${tier1ChampionOrChieftainFound}`);
  console.log(`    * 1~5층 일반방 유물 드랍 위반: ${tier1ArtifactsInNormalRooms}`);

  assert(totalMonstersSpawned > 500, `100회 시뮬레이션 중 500체 이상의 몬스터가 정상 스폰되어야 함`);
  assert(tier1RareEpicAffixesFound === 0, `1~5층에서 스폰된 모든 몬스터의 RARE/EPIC 접사는 0건이어야 함 (실제: ${tier1RareEpicAffixesFound})`);
  assert(tier1ChampionOrChieftainFound === 0, `1~5층에서 스폰된 모든 몬스터의 CHAMPION/CHIEFTAIN은 0건이어야 함 (실제: ${tier1ChampionOrChieftainFound})`);
  assert(tier1ArtifactsInNormalRooms === 0, `1~5층 일반방 유물 스폰은 0건이어야 함 (실제: ${tier1ArtifactsInNormalRooms})`);
}

// -----------------------------------------------------------------------------
// TEST SUITE 5: 유니크 몬스터 저층 보상 정규화 검증
// -----------------------------------------------------------------------------
console.log("\n🧪 [TEST SUITE 5] UniqueMonsterManager 저층 보상 정규화 검증");
{
  const uMgr = new UniqueMonsterManager();
  const lowUniqueMon = uMgr.createUniqueMonsterInstance(10, 10, 'MON_FARMER_MAGGOT', 2);

  assert(!lowUniqueMon.prefixes.includes('LEGENDARY'), "1~5층 유니크 몬스터는 LEGENDARY 접두사가 강제 부착되지 않아야 함");
  assert(lowUniqueMon.suffixes.includes('WARRIOR'), "1~5층 유니크 몬스터는 WARRIOR 등 허용 직업을 가져야 함");

  const drops = uMgr.generateUniqueMonsterDrops(lowUniqueMon, 2);
  const hasImmortalScroll = drops.some(d => d.name && d.name.includes("대강화"));
  const hasPermanentElixir = drops.some(d => d.name && d.name.includes("영구 전능"));
  const hasHolyEgo = drops.some(d => d.prefixes?.includes('HOLY'));
  const hasStandardScroll = drops.some(d => d.name === '무기 강화 주문서' || d.name === '방어구 강화 주문서');

  assert(!hasImmortalScroll, "1~5층 유니크 처치 시 '발리노르의 무기 대강화 주문서'가 드랍되지 않아야 함");
  assert(!hasPermanentElixir, "1~5층 유니크 처치 시 '영구 전능 성장 영약'이 드랍되지 않아야 함");
  assert(hasHolyEgo, "1~5층 유니크 처치 시 고결한 에고 무기(HOLY)가 드랍되어야 함");
  assert(hasStandardScroll, "1~5층 유니크 처치 시 일반 강화 주문서가 정상 드랍되어야 함");
}

console.log("\n================================================================================");
console.log(`🏁 TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL DUNGEON VALUE BUDGET TESTS PASSED WITH 100% SUCCESS!");
}
