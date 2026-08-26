/**
 * @file test_hof_and_graveyard_detail_view.js
 * @description 명예의 전당(Hall of Fame) 및 사망 묘비명(Graveyard) 상세 캐릭터 스펙,
 *              최종 착용 장비 12슬롯/인벤토리, 마지막 실시간 전투 로그 30줄 직렬화 및
 *              3단 탭 상세 인스펙터 모달 HTML 렌더러 전수 검증 단위 테스트 스위트
 */

import {
  saveAscensionRecord,
  getHallOfFameRecords,
  saveGraveyardRecord,
  getGraveyardRecords,
  clearHallOfFameRecords,
  clearGraveyardRecords,
  renderHallOfFameModalHTML,
  renderGraveyardModalHTML,
  renderRecordDetailModalHTML,
  serializeCombatStats,
  serializeItemData,
  serializeEquipmentSlots,
  serializeInventoryItems,
  serializeRecentLogs
} from '../src/ui/AscensionModalView.js';
import { Player } from '../src/entities/Player.js';
import { Item } from '../src/entities/Item.js';
import { bossPhaseEngine } from '../src/systems/BossPhaseEngine.js';

console.log("================================================================================");
console.log("🏆 MIMICRY VOXEL: HALL OF FAME & GRAVEYARD DETAIL INSPECTOR MODAL TEST SUITE");
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
// TEST 1: Serialization Helper Unit Tests (Pure functions)
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] 직렬화 헬퍼 함수 (serializeCombatStats, serializeItemData, serializeEquipmentSlots, serializeInventoryItems, serializeRecentLogs) 단위 검증");
{
  const player = new Player(5, 5, 'HUMAN');
  player.name = '테스트기사';
  player.level = 15;
  player.stats.hp = 180;
  player.stats.maxHp = 220;

  // 1. Stats serialization
  const stats = serializeCombatStats(player);
  assert(stats !== null, "serializeCombatStats는 null이 아니어야 함");
  assert(stats.hp === 180, "HP가 180이어야 함");
  assert(stats.maxHp === 220, "MaxHP가 220이어야 함");
  assert(typeof stats.str === 'number' && stats.str >= 10, "STR이 유효한 숫자여야 함");
  assert(typeof stats.ac === 'number', "AC가 유효한 숫자여야 함");
  assert(typeof stats.bth === 'number', "BTH가 유효한 숫자여야 함");
  assert(typeof stats.hitChance === 'number', "hitChance가 유효한 숫자여야 함");

  // 2. Item serialization
  const sword = new Item(0, 0, 'WEAPON', '/', '#38bdf8', '미스릴 롱소드');
  sword.baseAC = 0;
  sword.damageDice = '2d8';
  sword.toHit = 3;
  sword.toDam = 4;
  sword.prefixes = ['SHARP'];
  sword.suffixes = ['SLAYING'];
  sword.upgradeLevel = 2;

  const serializedItem = serializeItemData(sword);
  assert(serializedItem.name.includes('미스릴 롱소드'), "아이템 이름에 미스릴 롱소드가 포함되어야 함");
  assert(serializedItem.char === '/', "아이템 글리프가 일치해야 함");
  assert(serializedItem.color !== '', "아이템 색상이 존재해야 함");
  assert(serializedItem.dice === '2d8', "공격 주사위가 2d8이어야 함");
  assert(serializedItem.prefixes.includes('SHARP'), "prefix가 포함되어야 함");
  assert(serializedItem.suffixes.includes('SLAYING'), "suffix가 포함되어야 함");
  assert(serializedItem.upgradeLevel === 2, "강화 수치가 보존되어야 함");

  // 3. Equipment serialization (12 slots)
  player.equipment.weapon = sword;
  const shield = new Item(0, 0, 'SHIELD', ')', '#38bdf8', '청동 방패');
  shield.baseAC = 6;
  player.equipment.shield = shield;
  player.equipment.armor = null;

  const eqSlots = serializeEquipmentSlots(player.equipment);
  assert(eqSlots.weapon !== null && eqSlots.weapon.name.includes('미스릴 롱소드'), "weapon 슬롯이 정상 직렬화되어야 함");
  assert(eqSlots.shield !== null && eqSlots.shield.name.includes('청동 방패'), "shield 슬롯이 정상 직렬화되어야 함");
  assert(eqSlots.armor === null, "장착하지 않은 armor 슬롯은 null이어야 함");
  assert(Object.keys(eqSlots).length === 12, "총 12개 장비 슬롯이 존재해야 함");

  // 4. Inventory serialization
  const potion = new Item(0, 0, 'POTION', '!', '#f87171', '치유의 물약');
  potion.amount = 3;
  player.inventory = [sword, potion];
  const inv = serializeInventoryItems(player.inventory);
  assert(inv.length === 2, "인벤토리 아이템 2개가 직렬화되어야 함");
  assert(inv[1].name === '치유의 물약' && inv[1].amount === 3, "치유의 물약 x3 정보가 보존되어야 함");

  // 5. Recent logs serialization
  const mockHistory = [
    { text: "로그 1: 던전에 진입했습니다.", type: "system" },
    { text: "로그 2: 고블린을 처치했습니다.", type: "combat" },
    "로그 3: 아이템을 획득했습니다."
  ];
  const logs = serializeRecentLogs(mockHistory);
  assert(logs.length === 3, "3개의 로그가 정상 추출되어야 함");
  assert(logs[0].type === "system", "첫 번째 로그 타입이 system이어야 함");
  assert(logs[1].type === "combat", "두 번째 로그 타입이 combat이어야 함");
  assert(logs[2].text === "로그 3: 아이템을 획득했습니다.", "문자열 로그도 text로 정규화되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 2: Graveyard Death Data Full Serialization & Storage
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] 사망 묘비명(Graveyard) 상세 데이터(stats, equipment, inventory, recentLogs) 영구 보관 검증");
{
  clearGraveyardRecords();
  assert(getGraveyardRecords().length === 0, "초기 묘비 레코드는 0개여야 함");

  const deathRecord = {
    playerName: "어둠의방랑자",
    level: 18,
    floor: 24,
    killer: "Ancient Red Dragon",
    turns: 4500,
    kills: 120,
    uniqueKills: 5,
    mimicCore: "레드 드래곤",
    stats: {
      hp: 0,
      maxHp: 280,
      str: 22,
      int: 14,
      wis: 12,
      dex: 18,
      con: 20,
      chr: 10,
      ac: 45,
      bth: 85,
      hitChance: 65
    },
    equipment: {
      weapon: { name: "화염의 대검", char: "/", color: "#ef4444", dice: "3d6", baseAC: 0, prefixes: ["FIRE"] },
      shield: { name: "드래곤 스케일 쉴드", char: ")", color: "#f59e0b", baseAC: 12 },
      armor: { name: "미스릴 판금갑옷", char: "[", color: "#34d399", baseAC: 25 },
      helmet: null,
      gloves: null,
      boots: null,
      cloak: null,
      bow: null,
      quiver: null,
      ring1: null,
      ring2: null,
      amulet: null
    },
    inventory: [
      { name: "상급 마법 물약", char: "!", color: "#60a5fa", amount: 2, type: "POTION" },
      { name: "순간이동 두루마리", char: "?", color: "#c084fc", amount: 1, type: "SCROLL" }
    ],
    recentLogs: [
      { text: "레드 드래곤이 화염 숨결을 뿜어냅니다! (-85 데미지)", type: "danger" },
      { text: "체력이 0이 되어 사망하셨습니다.", type: "combat" }
    ],
    deathDate: new Date().toISOString()
  };

  const saved = saveGraveyardRecord(deathRecord);
  assert(saved.length === 1, "묘비명이 1건 정상 저장되어야 함");

  const loaded = getGraveyardRecords()[0];
  assert(loaded.playerName === "어둠의방랑자", "저장된 플레이어명이 일치해야 함");
  assert(loaded.stats !== null && loaded.stats.str === 22, "6대 스탯 STR=22가 보존되어야 함");
  assert(loaded.stats.ac === 45, "AC=45가 보존되어야 함");
  assert(loaded.equipment.weapon.name === "화염의 대검", "착용 무기가 보존되어야 함");
  assert(loaded.inventory.length === 2, "소지품 2개가 보존되어야 함");
  assert(loaded.recentLogs.length === 2, "최근 로그 2줄이 보존되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 3: Hall of Fame Ascension Data Full Serialization & Storage
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] 명예의 전당(Hall of Fame) 승천자 상세 데이터 영구 보관 검증");
{
  clearHallOfFameRecords();
  assert(getHallOfFameRecords().length === 0, "초기 명예의 전당 레코드는 0개여야 함");

  const victoryRecord = {
    playerName: "발리노르의수호자",
    level: 50,
    floor: 50,
    turns: 6200,
    kills: 450,
    uniqueKills: 28,
    uniquesList: ["Morgoth, Lord of Darkness", "Sauron, the Sorcerer"],
    artifactsCount: 8,
    artifactsList: ["유물: 'Grond'", "유물: Massive Iron Crown of Morgoth"],
    mimicCore: "모르고스의 의태 코어",
    stats: {
      hp: 550,
      maxHp: 550,
      str: 35,
      int: 30,
      wis: 28,
      dex: 32,
      con: 34,
      chr: 25,
      ac: 120,
      bth: 150,
      hitChance: 92
    },
    equipment: {
      weapon: { name: "유물: 'Grond'", char: "\\", color: "#ffd700", dice: "9d9", baseAC: 0, prefixes: ["LEGENDARY"], upgradeLevel: 10 },
      shield: { name: "아만의 방패", char: ")", color: "#ffd700", baseAC: 30 },
      armor: { name: "발리노르의 성갑", char: "[", color: "#ffd700", baseAC: 50 },
      helmet: { name: "유물: Massive Iron Crown of Morgoth", char: "]", color: "#ffd700", baseAC: 20 },
      gloves: { name: "미스릴 건틀릿", char: "(", color: "#34d399", baseAC: 10 },
      boots: { name: "신속의 장화", char: "]", color: "#c084fc", baseAC: 8 },
      cloak: { name: "그림자 망토", char: "(", color: "#fb7185", baseAC: 6 },
      bow: null,
      quiver: null,
      ring1: { name: "바라히르의 반지", char: "=", color: "#ffd700" },
      ring2: null,
      amulet: { name: "실마릴 목걸이", char: '"', color: "#ffd700" }
    },
    inventory: [
      { name: "생명의 영약", char: "!", color: "#34d399", amount: 5, type: "POTION" }
    ],
    recentLogs: [
      { text: "그론드의 일격이 모르고스를 강타합니다! (치명타 -450)", type: "combat" },
      { text: "✨ 50F 모르고스를 물리치고 발리노르로 승천하였습니다! ✨", type: "loot" }
    ],
    isVictory: true,
    clearDate: new Date().toISOString()
  };

  const savedHof = saveAscensionRecord(victoryRecord);
  assert(savedHof.length === 1, "승천 기록이 1건 정상 저장되어야 함");

  const loadedHof = getHallOfFameRecords()[0];
  assert(loadedHof.playerName === "발리노르의수호자", "승천자 이름이 일치해야 함");
  assert(loadedHof.isVictory === true, "isVictory가 true여야 함");
  assert(loadedHof.stats.str === 35 && loadedHof.stats.ac === 120, "전투 스탯 STR=35, AC=120이 보존되어야 함");
  assert(loadedHof.equipment.weapon.name === "유물: 'Grond'", "착용 무기 Grond가 보존되어야 함");
  assert(loadedHof.recentLogs.length === 2, "승천 전투 로그가 보존되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 4: Hall of Fame & Graveyard List HTML Rendering with Click Targets
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] renderHallOfFameModalHTML 인터랙티브 행(.record-row, data-id, 클릭 힌트) 렌더링 검증");
{
  const hofListHTML = renderHallOfFameModalHTML(null, 'hallOfFame');
  assert(hofListHTML.includes('class="record-row'), "명예의 전당 행에 .record-row 클래스가 포함되어야 함");
  assert(hofListHTML.includes('data-id="'), "명예의 전당 행에 data-id 속성이 포함되어야 함");
  assert(hofListHTML.includes('cursor: pointer'), "명예의 전당 행에 cursor: pointer 스타일이 포함되어야 함");
  assert(hofListHTML.includes('👉 클릭하여 캐릭터 정보/인벤토리/전투로그 보기'), "클릭 유도 안내 문구가 포함되어야 함");
  assert(hofListHTML.includes('발리노르의수호자'), "승천자 이름이 목록에 렌더링되어야 함");

  const graveListHTML = renderHallOfFameModalHTML(null, 'graveyard');
  assert(graveListHTML.includes('class="record-row'), "사망 묘비명 행에 .record-row 클래스가 포함되어야 함");
  assert(graveListHTML.includes('data-id="'), "사망 묘비명 행에 data-id 속성이 포함되어야 함");
  assert(graveListHTML.includes('👉 클릭하여 캐릭터 정보/인벤토리/전투로그 보기'), "사망 묘비명 행에 클릭 안내 문구가 포함되어야 함");
  assert(graveListHTML.includes('어둠의방랑자'), "사망자 이름이 목록에 렌더링되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 5: Record Detail Inspector Modal - Tab 1 [📊 캐릭터 스펙] Rendering
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] renderRecordDetailModalHTML 탭 1 [📊 캐릭터 스펙] 렌더링 검증");
{
  const hofRecord = getHallOfFameRecords()[0];
  const detailStatsHTML = renderRecordDetailModalHTML(hofRecord, 'stats');

  assert(detailStatsHTML.includes('detail-tab-stats'), "스펙 탭 버튼이 존재해야 함");
  assert(detailStatsHTML.includes('detail-tab-equipment'), "장비 탭 버튼이 존재해야 함");
  assert(detailStatsHTML.includes('detail-tab-logs'), "로그 탭 버튼이 존재해야 함");
  assert(detailStatsHTML.includes('발리노르의수호자'), "캐릭터명이 렌더링되어야 함");
  assert(detailStatsHTML.includes('모르고스의 의태 코어'), "의태 코어가 렌더링되어야 함");
  assert(detailStatsHTML.includes('Lv.50'), "최종 레벨이 렌더링되어야 함");
  assert(detailStatsHTML.includes('6,200 턴'), "총 턴수가 렌더링되어야 함");
  assert(detailStatsHTML.includes('450 마리'), "처치 몬스터 수가 렌더링되어야 함");
  assert(detailStatsHTML.includes('28 종'), "유니크 토벌 수가 렌더링되어야 함");
  assert(detailStatsHTML.includes('8 개'), "수집 유물 수가 렌더링되어야 함");
  assert(detailStatsHTML.includes('힘 (STR):'), "6대 스탯 STR 라벨이 렌더링되어야 함");
  assert(detailStatsHTML.includes('+120'), "방어력 AC 수치가 렌더링되어야 함");
  assert(detailStatsHTML.includes('150'), "명중 BTH 수치가 렌더링되어야 함");
  assert(detailStatsHTML.includes('btn-close-record-detail'), "모달 닫기 버튼이 포함되어야 함");
  assert(detailStatsHTML.includes('ESC'), "ESC 키 안내가 포함되어야 함");

  // 사망자 스펙 렌더링 검증
  const graveRecord = getGraveyardRecords()[0];
  const graveDetailHTML = renderRecordDetailModalHTML(graveRecord, 'stats');
  assert(graveDetailHTML.includes('어둠의방랑자'), "사망자명이 렌더링되어야 함");
  assert(graveDetailHTML.includes('Ancient Red Dragon'), "사망 원인 몬스터가 렌더링되어야 함");
  assert(graveDetailHTML.includes('24층'), "사망 층수가 렌더링되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 6: Record Detail Inspector Modal - Tab 2 [🎒 최종 장비 & 인벤토리] Rendering
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 6] renderRecordDetailModalHTML 탭 2 [🎒 최종 장비 & 인벤토리] 렌더링 검증");
{
  const hofRecord = getHallOfFameRecords()[0];
  const detailEqHTML = renderRecordDetailModalHTML(hofRecord, 'equipment');

  assert(detailEqHTML.includes('최종 착용 장비 12슬롯'), "12슬롯 장비 섹션 헤더가 존재해야 함");
  assert(detailEqHTML.includes("유물: 'Grond'"), "장착 무기명이 렌더링되어야 함");
  assert(detailEqHTML.includes('9d9'), "무기 공격 주사위 9d9가 렌더링되어야 함");
  assert(detailEqHTML.includes('아만의 방패'), "장착 방패명이 렌더링되어야 함");
  assert(detailEqHTML.includes('발리노르의 성갑'), "장착 갑옷명이 렌더링되어야 함");
  assert(detailEqHTML.includes('유물: Massive Iron Crown of Morgoth'), "장착 투구명이 렌더링되어야 함");
  assert(detailEqHTML.includes('미스릴 건틀릿'), "장착 장갑명이 렌더링되어야 함");
  assert(detailEqHTML.includes('신속의 장화'), "장착 신발명이 렌더링되어야 함");
  assert(detailEqHTML.includes('가방 소지품 목록'), "인벤토리 소지품 섹션 헤더가 존재해야 함");
  assert(detailEqHTML.includes('생명의 영약'), "소지품 목록에 생명의 영약이 렌더링되어야 함");
  assert(detailEqHTML.includes('x5'), "소지품 수량 x5가 렌더링되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 7: Record Detail Inspector Modal - Tab 3 [📜 마지막 전투 로그] Rendering
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 7] renderRecordDetailModalHTML 탭 3 [📜 마지막 전투 로그] 렌더링 검증");
{
  const graveRecord = getGraveyardRecords()[0];
  const detailLogsHTML = renderRecordDetailModalHTML(graveRecord, 'logs');

  assert(detailLogsHTML.includes('직전 실시간 전투/이벤트 로그'), "로그 뷰어 헤더가 존재해야 함");
  assert(detailLogsHTML.includes('01'), "로그 행 번호 01이 렌더링되어야 함");
  assert(detailLogsHTML.includes('02'), "로그 행 번호 02가 렌더링되어야 함");
  assert(detailLogsHTML.includes('화염 숨결을 뿜어냅니다'), "위험 로그 텍스트가 렌더링되어야 함");
  assert(detailLogsHTML.includes('체력이 0이 되어 사망하셨습니다'), "사망 로그 텍스트가 렌더링되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 8: Legacy Record Fallback & Safety Test
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 8] 레거시/불완전 레코드 (stats, equipment, inventory, logs 누락) 안전 폴백 렌더링 검증");
{
  const bareRecord = {
    id: "bare_001",
    playerName: "초보 모험가",
    level: 5,
    floor: 3,
    killer: "Giant Rat",
    turns: 80,
    score: 3500
  };

  // 1. Stats Tab fallback
  const htmlStats = renderRecordDetailModalHTML(bareRecord, 'stats');
  assert(htmlStats.includes('초보 모험가'), "플레이어명이 정상 렌더링되어야 함");
  assert(htmlStats.includes('Lv.5'), "레벨이 정상 렌더링되어야 함");
  assert(htmlStats.includes('Giant Rat'), "사망원인이 정상 렌더링되어야 함");

  // 2. Equipment Tab fallback
  const htmlEq = renderRecordDetailModalHTML(bareRecord, 'equipment');
  assert(htmlEq.includes('[비어있음]'), "장비 누락 시 [비어있음]으로 안전 렌더링되어야 함");
  assert(htmlEq.includes('소지하고 있던 인벤토리 아이템이 없습니다'), "인벤토리 누락 시 안내 문구가 렌더링되어야 함");

  // 3. Logs Tab fallback
  const htmlLogs = renderRecordDetailModalHTML(bareRecord, 'logs');
  assert(htmlLogs.includes('저장된 실시간 전투/시스템 로그가 없습니다'), "로그 누락 시 안내 문구가 렌더링되어야 함");
}

console.log("\n================================================================================");
console.log(`🏁 TEST COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("================================================================================");

if (testsFailed === 0) {
  console.log("🎉 ALL HOF & GRAVEYARD DETAIL VIEW TESTS PASSED WITH 100% SUCCESS!\n");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!\n");
  process.exit(1);
}
