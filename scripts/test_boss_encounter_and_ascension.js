/**
 * @file test_boss_encounter_and_ascension.js
 * @description 50F 모르고스의 옥좌 최종 보스전(Morgoth Encounter) 3단계 페이즈 전환, 암흑 스킬/소환/지진 연출,
 *              승천(Ascension) 엔딩 컷씬 및 명예의 전당(Hall of Fame) / 사망 묘비명(Graveyard) 전수 검증 테스트 스위트
 */

import { bossPhaseEngine, BossPhaseEngine, BOSS_PHASES, MORGOTH_KEY } from '../src/systems/BossPhaseEngine.js';
import {
  calculateScore,
  saveAscensionRecord,
  getHallOfFameRecords,
  saveGraveyardRecord,
  getGraveyardRecords,
  clearHallOfFameRecords,
  clearGraveyardRecords,
  renderAscensionModalHTML,
  renderHallOfFameModalHTML,
  renderGraveyardModalHTML
} from '../src/ui/AscensionModalView.js';
import { uniqueMonsterManager, UniqueMonsterManager } from '../src/systems/UniqueMonsterManager.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { LootSystem } from '../src/core/LootSystem.js';
import { Spawner } from '../src/core/Spawner.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { Map } from '../src/map/Map.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { eventBus } from '../src/events/EventBus.js';
import { GameEvents } from '../src/events/GameEvents.js';
import { TOME_MONSTERS_DATA } from '../src/entities/TomeMonstersData.js';
import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';

console.log("================================================================================");
console.log("👑 MIMICRY VOXEL: 50F MORGOTH ENCOUNTER & ASCENSION ENDING TEST SUITE");
console.log("================================================================================\n");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Morgoth Final Boss Detection & Initialization
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] 모르고스(Morgoth) 최종 보스 식별 및 조우 초기화 검증");
{
  const morgothData = TOME_MONSTERS_DATA[MORGOTH_KEY];
  assert(morgothData !== undefined, "TOME_MONSTERS_DATA에 MORGOTH_KEY 데이터가 존재해야 함");

  const morgoth = new Monster(10, 10, MORGOTH_KEY, 100, ['LEGENDARY'], ['CHAMPION']);
  morgoth.uniqueKey = MORGOTH_KEY;
  morgoth._baseName = "Morgoth, Lord of Darkness";

  assert(bossPhaseEngine.isMorgoth(morgoth), "bossPhaseEngine.isMorgoth(morgoth)는 true여야 함");
  assert(!bossPhaseEngine.isMorgoth(new Monster(5, 5, 'GOBLIN', 1)), "일반 고블린은 isMorgoth가 false여야 함");

  const mockLogs = [];
  const mockGame = {
    addLogEntry: (msg, type) => mockLogs.push({ msg, type }),
    player: new Player(10, 12)
  };

  bossPhaseEngine.initBossEncounter(morgoth, mockGame);

  assert(morgoth.isFinalBoss === true, "조우 초기화 후 isFinalBoss는 true여야 함");
  assert(morgoth.bossPhase === 1, "초기 보스 페이즈는 1이어야 함");
  assert(morgoth.stats.hp >= 15000, `모르고스 초기 HP는 15000 이상이어야 함 (실제: ${morgoth.stats.hp})`);
  assert(mockLogs.length >= 2, "보스 등장 알림 및 Phase 1 대사가 로그에 기록되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 2: Boss Phase 1 (HP 100% ~ 70%) & Dark Skills
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] Phase 1 (HP 100% ~ 70%): 암흑 장막(Darkness Veil) & 칠흑 숨결(Dark Breath)");
{
  const morgoth = new Monster(15, 15, MORGOTH_KEY, 100);
  morgoth.stats.hp = 15000;
  morgoth.stats.maxHp = 15000;
  morgoth.bossPhase = 1;

  assert(bossPhaseEngine.getPhase(morgoth) === 1, "HP 100%일 때 페이즈 1이어야 함");

  const player = new Player(15, 17);
  player.stats.hp = 100;
  player.stats.maxHp = 100;

  const mockLogs = [];
  const mockGame = {
    player,
    effects: [],
    addLogEntry: (msg, type) => mockLogs.push({ msg, type })
  };

  // Execute Darkness Veil
  const veilSuccess = bossPhaseEngine.executeDarknessVeil(morgoth, player, mockGame);
  assert(veilSuccess === true, "암흑 장막 스킬이 정상 실행되어야 함");
  assert(player.stats.hp < 100, `암흑 장막으로 플레이어가 피해를 입어야 함 (현재 HP: ${player.stats.hp})`);
  assert(mockGame.effects.length > 0, "암흑 장막 비주얼 이펙트가 등록되어야 함");

  // Execute Dark Breath
  const hpBeforeBreath = player.stats.hp;
  const breathSuccess = bossPhaseEngine.executeDarkBreath(morgoth, player, mockGame);
  assert(breathSuccess === true, "칠흑의 숨결 스킬이 정상 실행되어야 함");
  assert(player.stats.hp < hpBeforeBreath, `칠흑의 숨결로 플레이어가 추가 피해를 입어야 함 (현재 HP: ${player.stats.hp})`);
}

// -----------------------------------------------------------------------------
// TEST 3: Boss Phase 2 Transition (HP 70% ~ 30%) - Earth Shatter & Legion Summon
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] Phase 2 전환 (HP 70% ~ 30%): 대지 분쇄(Earth Shatter) & 앙그반드 친위대 소환");
{
  const morgoth = new Monster(20, 20, MORGOTH_KEY, 100);
  morgoth.stats.maxHp = 10000;
  morgoth.stats.hp = 6500; // 65% HP -> Phase 2
  morgoth.bossPhase = 1;

  assert(bossPhaseEngine.getPhase(morgoth) === 2, "HP 65%일 때 페이즈 2여야 함");

  const player = new Player(20, 22);
  player.stats.hp = 200;
  player.stats.maxHp = 200;

  const monstersList = [morgoth];
  const mockLogs = [];
  let phaseChangeEventFired = false;

  const unsubscribe = eventBus.on(GameEvents.BOSS_PHASE_CHANGE, (ev) => {
    if (ev.toPhase === 2) phaseChangeEventFired = true;
  });

  const mockGame = {
    player,
    monsters: monstersList,
    effects: [],
    addLogEntry: (msg, type) => mockLogs.push({ msg, type }),
    map: { isWall: () => false }
  };

  const transitionRes = bossPhaseEngine.checkPhaseTransition(morgoth, mockGame);
  unsubscribe();

  assert(transitionRes.transitioned === true, "Phase 2로 페이즈 전환이 발생해야 함");
  assert(transitionRes.toPhase === 2, "전환된 페이즈 번호는 2여야 함");
  assert(morgoth.bossPhase === 2, "보스 객체의 bossPhase가 2로 갱신되어야 함");
  assert(phaseChangeEventFired === true, "GameEvents.BOSS_PHASE_CHANGE 이벤트가 발행되어야 함");
  assert(monstersList.length >= 3, `앙그반드 친위대(발록, 나즈굴)가 소환되어 몬스터 목록에 추가되어야 함 (현재: ${monstersList.length})`);
  assert(player.stats.hp < 200, "전환 즉시 대지 분쇄 지진 피해가 가해져야 함");
}

// -----------------------------------------------------------------------------
// TEST 4: Boss Phase 3 Transition (HP 30% ~ 0%) - Wrath of Angband & Soul Drain
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] Phase 3 전환 (HP 30% ~ 0%): 앙그반드의 궁극 격노(Wrath) & 영혼 드레인(Soul Drain)");
{
  const morgoth = new Monster(20, 20, MORGOTH_KEY, 100);
  morgoth.stats.maxHp = 10000;
  morgoth.stats.hp = 2500; // 25% HP -> Phase 3
  morgoth.bossPhase = 2;
  const initialSpeed = morgoth.speed || 10;

  assert(bossPhaseEngine.getPhase(morgoth) === 3, "HP 25%일 때 페이즈 3이어야 함");

  const player = new Player(20, 22);
  player.stats.hp = 200;
  player.stats.maxHp = 200;

  const mockLogs = [];
  const mockGame = {
    player,
    effects: [],
    addLogEntry: (msg, type) => mockLogs.push({ msg, type })
  };

  const transitionRes = bossPhaseEngine.checkPhaseTransition(morgoth, mockGame);

  assert(transitionRes.transitioned === true, "Phase 3로 페이즈 전환이 발생해야 함");
  assert(transitionRes.toPhase === 3, "전환된 페이즈 번호는 3이어야 함");
  assert(morgoth.bossPhase === 3, "보스 객체의 bossPhase가 3으로 갱신되어야 함");
  assert(morgoth.speed > initialSpeed, `궁극 격노로 보스 이동속도가 가속되어야 함 (${initialSpeed} -> ${morgoth.speed})`);
  assert(player.stats.hp < 200, "영혼 드레인으로 플레이어 체력이 감소해야 함");
  assert(morgoth.stats.hp > 2500, "영혼 드레인으로 보스 체력이 회복되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 5: Morgoth Defeat & 100% Guaranteed Drops (Core + Grond + Iron Crown)
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] 모르고스 처치 시 100% 확정 전리품 (Morgoth Core, Grond, Iron Crown) 및 승천 격발");
{
  const morgoth = new Monster(30, 30, MORGOTH_KEY, 100);
  morgoth.uniqueKey = MORGOTH_KEY;
  morgoth._baseName = "Morgoth, Lord of Darkness";

  const player = new Player(30, 31);
  player.level = 50;
  player.xp = 250000;
  player.killCount = 142;
  player.equipment = {
    weapon: { name: "유물: 'Glamdring'" },
    armor: { name: "발리노르의 성갑" }
  };

  const itemsList = [];
  let ascensionEventFired = false;
  let victoryEventFired = false;

  const u1 = eventBus.on(GameEvents.ASCENSION, () => { ascensionEventFired = true; });
  const u2 = eventBus.on(GameEvents.GAME_VICTORY, () => { victoryEventFired = true; });

  const mockGame = {
    floor: 50,
    turn: 1250,
    items: itemsList,
    player,
    uniqueMonsterManager,
    addLogEntry: () => {}
  };

  const victoryData = bossPhaseEngine.handleBossDeath(morgoth, player, mockGame);
  u1();
  u2();

  assert(victoryData !== null, "handleBossDeath는 유효한 victoryData를 반환해야 함");
  assert(victoryData.isVictory === true, "victoryData.isVictory는 true여야 함");
  assert(victoryData.score > 100000, `승천 스코어는 100,000점 이상이어야 함 (실제: ${victoryData.score})`);
  assert(ascensionEventFired === true, "GameEvents.ASCENSION 이벤트가 발행되어야 함");
  assert(victoryEventFired === true, "GameEvents.GAME_VICTORY 이벤트가 발행되어야 함");

  // Verify Drops
  assert(itemsList.length >= 3, `3개 이상의 고유 신화 전리품이 드랍되어야 함 (실제: ${itemsList.length})`);
  const hasCore = itemsList.some(i => i.type === 'CORE' && i.coreType === MORGOTH_KEY);
  const hasGrond = itemsList.some(i => i.name.includes("Grond") || i.artifactKey === 'ART_GROND');
  const hasCrown = itemsList.some(i => i.name.includes("Iron Crown") || i.artifactKey === 'ART_OF_MORGOTH');

  assert(hasCore, "100% 확정 [모르고스의 의태 코어]가 드랍되어야 함");
  assert(hasGrond, "100% 확정 전설 유물 ['Grond']가 드랍되어야 함");
  assert(hasCrown, "100% 확정 전설 유물 [Massive Iron Crown of Morgoth]가 드랍되어야 함");

  // Verify Unique Monster Registry marked killed
  assert(uniqueMonsterManager.isKilled(MORGOTH_KEY), "모르고스는 uniqueMonsterManager에서 처치 상태여야 함");
}

// -----------------------------------------------------------------------------
// TEST 6: Roguelike Score Calculation Formula
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 6] 로그라이크 영예 점수(Score) 산출 공식 검증");
{
  const victoryScore = calculateScore({
    level: 50,
    xp: 300000,
    kills: 200,
    uniqueKills: 25,
    artifactsCount: 5,
    turns: 1500,
    isVictory: true
  });

  const deathScore = calculateScore({
    level: 15,
    xp: 15000,
    kills: 40,
    uniqueKills: 2,
    artifactsCount: 0,
    turns: 500,
    floor: 12,
    isVictory: false
  });

  console.log(`  - 승천(Ascension) 클리어 스코어: ${victoryScore.toLocaleString()} PTS`);
  console.log(`  - 사망(Graveyard) 일반 스코어: ${deathScore.toLocaleString()} PTS`);

  assert(victoryScore >= 200000, `승천 스코어는 200,000점 이상이어야 함 (실제: ${victoryScore})`);
  assert(deathScore > 0 && deathScore < victoryScore, "사망 스코어는 양수이며 승천 스코어보다 낮아야 함");
}

// -----------------------------------------------------------------------------
// TEST 7: Hall of Fame & Graveyard Storage & Serialization
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 7] 명예의 전당(Hall of Fame) 및 사망 묘비명(Graveyard) 저장/조회 무결성 검증");
{
  clearHallOfFameRecords();
  clearGraveyardRecords();

  assert(getHallOfFameRecords().length === 0, "초기 명예의 전당은 비어 있어야 함");
  assert(getGraveyardRecords().length === 0, "초기 사망 묘비명은 비어 있어야 함");

  // Save multiple records
  saveAscensionRecord({ playerName: "영웅 1", level: 50, score: 250000, turns: 1000 });
  saveAscensionRecord({ playerName: "영웅 2", level: 50, score: 320000, turns: 800 });
  saveAscensionRecord({ playerName: "영웅 3", level: 50, score: 180000, turns: 2000 });

  const hofRecords = getHallOfFameRecords();
  assert(hofRecords.length === 3, `3개의 승천 기록이 저장되어야 함 (실제: ${hofRecords.length})`);
  assert(hofRecords[0].playerName === "영웅 2", "최고 점수 320,000점의 '영웅 2'가 1위로 정렬되어야 함");
  assert(hofRecords[1].playerName === "영웅 1", "250,000점의 '영웅 1'이 2위여야 함");
  assert(hofRecords[2].playerName === "영웅 3", "180,000점의 '영웅 3'이 3위여야 함");

  // Save graveyard record
  saveGraveyardRecord({ playerName: "낙오자", level: 12, floor: 8, killer: "Forest Troll", score: 18500 });
  const graveRecords = getGraveyardRecords();
  assert(graveRecords.length === 1, "1개의 사망 묘비명이 저장되어야 함");
  assert(graveRecords[0].killer === "Forest Troll", "사망 원인이 올바르게 저장되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 8: AscensionModalView HTML Rendering Integrity
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 8] 승천 엔딩 컷씬 및 명예의 전당 / 묘비명 HTML 렌더링 검증");
{
  const victoryHTML = renderAscensionModalHTML({
    playerName: "코하루",
    score: 350000,
    turns: 1100,
    kills: 180,
    uniqueKills: 30,
    artifactsCount: 6,
    mimicCore: "모르고스의 의태 코어",
    level: 50,
    finalEquipment: { weapon: "유물: 'Grond'", helmet: "유물: Massive Iron Crown of Morgoth" }
  });

  assert(victoryHTML.includes("승천 (ASCENSION)"), "HTML에 승천 타이틀이 포함되어야 함");
  assert(victoryHTML.includes("350,000 PTS"), "HTML에 점수가 포맷팅되어 포함되어야 함");
  assert(victoryHTML.includes("모르고스의 의태 코어"), "HTML에 최종 의태 코어가 포함되어야 함");
  assert(victoryHTML.includes("btn-ascension-hall-of-fame"), "HTML에 명예의 전당 버튼 ID가 포함되어야 함");

  const hofHTML = renderHallOfFameModalHTML(null, 'hallOfFame');
  assert(hofHTML.includes("명예의 전당 (Hall of Fame)"), "명예의 전당 탭 헤더가 포함되어야 함");
  assert(hofHTML.includes("영웅 2"), "1위 플레이어 이름이 렌더링되어야 함");

  const graveHTML = renderHallOfFameModalHTML(null, 'graveyard');
  assert(graveHTML.includes("사망 묘비명 (Graveyard)"), "사망 묘비명 탭 헤더가 포함되어야 함");
  assert(graveHTML.includes("낙오자"), "사망자 이름이 렌더링되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 9: Full End-to-End Spawner + CombatSystem + LootSystem Simulation
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 9] 50F 보스룸 스폰부터 3단계 페이즈 전투 및 승천 엔딩 전 과정 통합 시뮬레이션");
{
  const game = {
    floor: 50,
    floorDanger: 25.0,
    turn: 100,
    items: [],
    monsters: [],
    effects: [],
    uniqueMonsterManager: new UniqueMonsterManager(),
    engine: new GameEngine(),
    addLogEntry: (msg) => {},
    updateUI: () => {}
  };

  game.engine.turn = 100;
  game.engine.floor = 50;

  // Create 50F Map with Boss room
  game.map = new Map(80, 60, 50);
  const bossRoom = game.map.rooms.find(r => r.type === 'BOSS') || game.map.rooms[game.map.rooms.length - 1];
  bossRoom.type = 'BOSS';

  // 1. Spawner generates Morgoth on floor 50
  Spawner.spawnFloorContent(game);

  const morgoth = game.monsters.find(m => bossPhaseEngine.isMorgoth(m));
  assert(morgoth !== undefined, "50F 던전 보스룸에 모르고스가 확정 스폰되어야 함");
  assert(morgoth.isFinalBoss === true, "스폰된 모르고스는 isFinalBoss가 true여야 함");
  assert(morgoth.bossPhase === 1, "스폰 직후 Phase 1이어야 함");

  const player = new Player(morgoth.x + 1, morgoth.y);
  player.level = 50;
  player.stats.hp = 500;
  player.stats.maxHp = 500;
  player.equipment.weapon = { name: "전설의 빛의 성검", dice: "5d10", baseAC: 5, slotType: "WEAPON" };
  game.player = player;

  // 2. Combat simulation Phase 1 -> Phase 2
  morgoth.stats.hp = Math.floor(morgoth.stats.maxHp * 0.65);
  bossPhaseEngine.checkPhaseTransition(morgoth, game);
  assert(morgoth.bossPhase === 2, "HP 65% 시 Phase 2로 전환되어야 함");

  // 3. Combat simulation Phase 2 -> Phase 3
  morgoth.stats.hp = Math.floor(morgoth.stats.maxHp * 0.20);
  bossPhaseEngine.checkPhaseTransition(morgoth, game);
  assert(morgoth.bossPhase === 3, "HP 20% 시 Phase 3로 전환되어야 함");

  // 4. Morgoth Defeat via LootSystem.processMonsterDeath
  morgoth.stats.hp = 0;
  let ascensionDetected = false;
  const offAscension = eventBus.on(GameEvents.ASCENSION, () => {
    ascensionDetected = true;
  });

  LootSystem.processMonsterDeath(game, player, morgoth, "발리노르의 빛");
  offAscension();

  assert(ascensionDetected === true, "LootSystem을 통한 처치 시 승천 이벤트가 격발되어야 함");
  assert(game.items.length >= 3, `유물 3종이 바닥에 드랍되어야 함 (현재: ${game.items.length})`);
  assert(game.uniqueMonsterManager.isKilled(MORGOTH_KEY), "모르고스는 처치 완료 상태여야 함");
  assert(game.engine.isVictory === true, "게임 엔진 상태가 isVictory === true여야 함");
}

console.log("\n================================================================================");
console.log(`🏁 TEST COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("================================================================================");

if (testsFailed === 0) {
  console.log("🎉 ALL 50F MORGOTH ENCOUNTER & ASCENSION TESTS PASSED WITH 100% SUCCESS!");
  process.exit(0);
} else {
  console.error(`❌ ${testsFailed} TESTS FAILED!`);
  process.exit(1);
}
