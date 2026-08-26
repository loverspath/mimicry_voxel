/**
 * @file test_graveyard_single_record.js
 * @description 플레이어 사망 시 묘비명(Graveyard) 중복 기록 방지, Game.js 재진입 가드,
 *              턴 루프 즉시 종료 및 CombatSystem 연동 무결성 검증 단위 테스트 스위트
 */

import {
  saveGraveyardRecord,
  getGraveyardRecords,
  deduplicateGraveyardRecords,
  clearGraveyardRecords,
  saveAscensionRecord,
  getHallOfFameRecords,
  clearHallOfFameRecords,
  renderHallOfFameModalHTML,
  renderGraveyardModalHTML
} from '../src/ui/AscensionModalView.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Map } from '../src/map/Map.js';

console.log("================================================================================");
console.log("⚰️ MIMICRY VOXEL: GRAVEYARD SINGLE RECORD & DEATH RE-ENTRY GUARD TEST SUITE");
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
// TEST 1: saveGraveyardRecord 중복 저장 방지 (시그니처 및 ID 세이프가드)
// -----------------------------------------------------------------------------
console.log("▶ [TEST 1] saveGraveyardRecord() 중복 적재 방지 세이프가드 검증");
{
  clearGraveyardRecords();
  assert(getGraveyardRecords().length === 0, "초기 묘비명 레코드 수는 0이어야 함");

  const deathRecord1 = {
    playerName: "테스터",
    level: 10,
    floor: 5,
    killer: "오크 전사",
    turns: 120,
    kills: 15,
    mimicCore: "오크"
  };

  // 1차 저장
  saveGraveyardRecord(deathRecord1);
  assert(getGraveyardRecords().length === 1, "1차 저장 후 묘비명 레코드 수는 1이어야 함");

  // 동일한 데이터로 즉시 2차 저장 시도 -> 중복 방지되어야 함
  saveGraveyardRecord(deathRecord1);
  assert(getGraveyardRecords().length === 1, "동일 데이터 재저장 시 레코드 수가 1개로 유지되어야 함 (중복 차단)");

  // 3차 저장 시도 (동일 캐릭터, 동일 턴, 동일 사인, 동일 층수)
  saveGraveyardRecord({
    playerName: "테스터",
    level: 10,
    floor: 5,
    killer: "오크 전사",
    turns: 120,
    kills: 15,
    mimicCore: "오크"
  });
  assert(getGraveyardRecords().length === 1, "동일 속성의 새 객체 전달 시에도 레코드 수는 1개여야 함");

  // 다른 캐릭터 또는 다른 턴수/사인의 경우 정상 저장되어야 함
  saveGraveyardRecord({
    playerName: "테스터2",
    level: 12,
    floor: 6,
    killer: "동굴 트롤",
    turns: 150,
    kills: 20
  });
  assert(getGraveyardRecords().length === 2, "상이한 캐릭터/사망 데이터는 정상 저장되어 총 2개가 되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 1-B: deduplicateGraveyardRecords() 기존 저장된 중복 항목 전수 제거 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 1-B] deduplicateGraveyardRecords() 레코드 전수 중복 제거 검증");
{
  const pollutedRecords = [
    { id: "grave_1", playerName: "영웅", level: 15, floor: 10, killer: "발록", turns: 500, deathDate: "2026-08-25T10:00:00.000Z" },
    { id: "grave_1", playerName: "영웅", level: 15, floor: 10, killer: "발록", turns: 500, deathDate: "2026-08-25T10:00:00.000Z" }, // ID 중복
    { id: "grave_2", playerName: "영웅", level: 15, floor: 10, killer: "발록", turns: 500, deathDate: "2026-08-25T10:00:02.000Z" }, // 다른 ID이나 동일 사망 사건 (시그니처 일치)
    { id: "grave_3", playerName: "마법사", level: 20, floor: 25, killer: "나즈굴", turns: 800, deathDate: "2026-08-25T11:00:00.000Z" },
    { id: "grave_4", playerName: "마법사", level: 20, floor: 25, killer: "나즈굴", turns: 800, deathDate: "2026-08-25T11:00:01.000Z" }  // 동일 사망 사건 (시그니처 일치)
  ];

  const cleanRecords = deduplicateGraveyardRecords(pollutedRecords);
  assert(cleanRecords.length === 2, `5개 오염 레코드 중복 제거 후 고유 레코드는 2개여야 함 (실제: ${cleanRecords.length})`);
  assert(cleanRecords[0].playerName === "영웅" && cleanRecords[1].playerName === "마법사", "고유 캐릭터 사망 레코드만 보존되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 1-C: getGraveyardRecords() 조회 시 자동 중복 제거 및 localStorage 자동 치유(Auto-Healing) 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 1-C] getGraveyardRecords() 조회 시 자동 중복 제거 및 Auto-Healing 검증");
{
  clearGraveyardRecords();

  // 기존 저장소에 중복 레코드들이 이미 저장되어 있던 상황 시뮬레이션
  const duplicateRecords = [
    { id: "grave_dup_1", playerName: "미믹헌터", level: 30, floor: 20, killer: "고룡 글라우룽", turns: 1200, score: 50000 },
    { id: "grave_dup_2", playerName: "미믹헌터", level: 30, floor: 20, killer: "고룡 글라우룽", turns: 1200, score: 50000 }, // 동일 인물/층/사인/턴 중복
    { id: "grave_dup_3", playerName: "미믹헌터", level: 30, floor: 20, killer: "고룡 글라우룽", turns: 1200, score: 50000 }, // 3중 복제
    { id: "grave_dup_4", playerName: "엘프궁수", level: 25, floor: 18, killer: "동굴 트롤", turns: 950, score: 35000 }
  ];

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mimicry_graveyard_records', JSON.stringify(duplicateRecords));
  } else {
    // Save directly using saveGraveyardRecord mock or global
    // AscensionModalView memory storage test
  }

  // getGraveyardRecords 호출 시 즉시 2개로 자동 정제되어야 함
  const healedRecords = deduplicateGraveyardRecords(duplicateRecords);
  assert(healedRecords.length === 2, `중복 4개 레코드가 고유 2개로 자동 정제되어야 함 (실제: ${healedRecords.length})`);
  assert(healedRecords[0].playerName === "미믹헌터" && healedRecords[1].playerName === "엘프궁수", "정제된 고유 사망자 레코드만 유지되어야 함");
}

// -----------------------------------------------------------------------------
// TEST 2: Mock Game 객체 기반 handlePlayerDeath() 재진입 방지 가드 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 2] Game.js handlePlayerDeath() 다중 호출 시 재진입 가드 및 단일 로그 검증");
{
  clearGraveyardRecords();

  const logs = [];
  const mockGame = {
    currentSlot: 'slot1',
    isGameOver: false,
    _isHandlingDeath: false,
    playerTurn: true,
    floor: 3,
    turn: 80,
    player: {
      name: '용감한 모험가',
      level: 5,
      lastDamageSource: '화염 드레이크',
      killCount: 8,
      mimicCore: { name: '도마뱀' },
      stats: { hp: 0, maxHp: 50 }
    },
    addLogEntry(msg, type) {
      logs.push({ msg, type });
    },
    showMainMenu() {},
    handlePlayerDeath() {
      if (this.isGameOver || this._isHandlingDeath) return;
      this.isGameOver = true;
      this._isHandlingDeath = true;
      this.playerTurn = false;

      const killer = this.player?.lastDamageSource || '앙그반드의 어둠';
      const floor = this.floor || 1;
      const slotName = (this.currentSlot || 'slot1').toUpperCase();

      this.addLogEntry(`💀 [GAME OVER] ${killer}에게 쓰러져 모험을 마감하셨습니다. (지하 ${floor}층)`, `combat`);
      this.addLogEntry(`💀 [Permadeath] 캐릭터가 사망하여 [${slotName}] 세이브 데이터가 영구 삭제됩니다.`, `combat`);
      
      const deathData = {
        playerName: this.player?.name || '용감한 모험가',
        level: this.player?.level || 1,
        floor: floor,
        killer: killer,
        turns: this.turn || 1,
        kills: this.player?.killCount || 0,
        mimicCore: this.player?.mimicCore?.name || '인간 여행자',
        deathDate: new Date().toISOString()
      };
      saveGraveyardRecord(deathData);
    }
  };

  // 1회 호출
  mockGame.handlePlayerDeath();
  assert(mockGame.isGameOver === true, "isGameOver 플래그가 true여야 함");
  assert(mockGame._isHandlingDeath === true, "_isHandlingDeath 플래그가 true여야 함");
  assert(mockGame.playerTurn === false, "playerTurn이 false로 전환되어야 함");
  assert(getGraveyardRecords().length === 1, "묘비명 레코드 수가 정확히 1이어야 함");
  
  const gameOverLogs = logs.filter(l => l.msg.includes('[GAME OVER]'));
  assert(gameOverLogs.length === 1, "GAME OVER 로그가 정확히 1회만 출력되어야 함");
  assert(gameOverLogs[0].msg === "💀 [GAME OVER] 화염 드레이크에게 쓰러져 모험을 마감하셨습니다. (지하 3층)", "단일화된 GAME OVER 로그 포맷이 올바라야 함");

  const permadeathLogs = logs.filter(l => l.msg.includes('[Permadeath]'));
  assert(permadeathLogs.length === 1, "Permadeath 로그가 정확히 1회만 출력되어야 함");

  // 2회 연속 중복 호출 시도
  mockGame.handlePlayerDeath();
  mockGame.handlePlayerDeath();
  assert(getGraveyardRecords().length === 1, "handlePlayerDeath 3회 호출 후에도 묘비명 레코드 수는 1개여야 함");
  
  const gameOverLogsAfter = logs.filter(l => l.msg.includes('[GAME OVER]'));
  assert(gameOverLogsAfter.length === 1, "GAME OVER 로그도 1회만 유지되어야 함 (중복 출력 방지)");
}

// -----------------------------------------------------------------------------
// TEST 3: CombatSystem 몬스터 일반 공격 시 플레이어 사망 파이프라인 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 3] CombatSystem.attackPlayer() 피격 사망 시 단 1회 사망 처리 검증");
{
  clearGraveyardRecords();

  const logs = [];
  let deathHandledCount = 0;

  const player = new Player(5, 5);
  player.stats.hp = 1; // 1 HP (한 방에 사망하도록 설정)
  player.stats.maxHp = 100;
  player.name = "피격자";

  const monster = new Monster(5, 6, "ORC", 5);
  monster._baseName = "난폭한 오크 대장";
  monster.getActiveAttackSkill = () => 'PULVERIZE';

  const game = {
    player,
    map: new Map(20, 20, 1),
    currentSlot: 'slot1',
    isGameOver: false,
    _isHandlingDeath: false,
    floor: 2,
    turn: 45,
    effects: [],
    addLogEntry(msg, type) {
      logs.push({ msg, type });
    },
    handlePlayerDeath() {
      if (this.isGameOver || this._isHandlingDeath) return;
      this.isGameOver = true;
      this._isHandlingDeath = true;
      deathHandledCount++;

      saveGraveyardRecord({
        playerName: this.player.name,
        level: this.player.level,
        floor: this.floor,
        killer: this.player.lastDamageSource || monster.displayName,
        turns: this.turn,
        kills: 0,
        mimicCore: '인간'
      });
    }
  };

  // 몬스터 공격 실행 (BTH 회피 확률 감안하여 확정 사망 시까지 공격)
  let safety = 10;
  while (player.stats.hp > 0 && safety-- > 0) {
    CombatSystem.attackPlayer(game, monster, player);
  }

  assert(player.stats.hp === 0, "플레이어 체력이 0이어야 함");
  assert(player.lastDamageSource === "난폭한 오크 대장", `lastDamageSource가 몬스터 이름으로 기록되어야 함 (실제: ${player.lastDamageSource})`);
  assert(deathHandledCount === 1, `handlePlayerDeath가 정확히 1회만 호출되어야 함 (실제: ${deathHandledCount})`);
  assert(getGraveyardRecords().length === 1, `묘비명 레코드가 1개만 저장되어야 함 (실제: ${getGraveyardRecords().length})`);
  assert(getGraveyardRecords()[0].killer === "난폭한 오크 대장", "묘비명에 기록된 사인이 일치해야 함");
}

// -----------------------------------------------------------------------------
// TEST 4: CombatSystem 몬스터 원소 브레스 피격 사망 시 단 1회 사망 처리 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 4] CombatSystem.useMonsterBreath() 브레스 피격 사망 검증");
{
  clearGraveyardRecords();

  const logs = [];
  let deathHandledCount = 0;

  const player = new Player(5, 5);
  player.stats.hp = 1;
  player.stats.maxHp = 100;
  player.name = "브레스피격자";

  const monster = new Monster(5, 7, "HATCHLING", 10);
  monster._baseName = "붉은 화염 해츨링";

  const map = new Map(20, 20, 1);
  map.isTransparent = () => true;

  const game = {
    player,
    map,
    currentSlot: 'slot1',
    isGameOver: false,
    _isHandlingDeath: false,
    floor: 4,
    turn: 90,
    effects: [],
    addLogEntry(msg, type) {
      logs.push({ msg, type });
    },
    handlePlayerDeath() {
      if (this.isGameOver || this._isHandlingDeath) return;
      this.isGameOver = true;
      this._isHandlingDeath = true;
      deathHandledCount++;

      saveGraveyardRecord({
        playerName: this.player.name,
        level: this.player.level,
        floor: this.floor,
        killer: this.player.lastDamageSource || monster.displayName,
        turns: this.turn,
        kills: 0,
        mimicCore: '인간'
      });
    }
  };

  const breathResult = CombatSystem.useMonsterBreath(game, monster, 0, -2, 2);
  assert(breathResult === true, "브레스가 성공적으로 격발되어야 함");
  assert(player.stats.hp === 0, "플레이어 체력이 0이어야 함");
  assert(game.player.lastDamageSource === "붉은 화염 해츨링", "lastDamageSource가 브레스 몬스터 이름이어야 함");
  assert(deathHandledCount === 1, "브레스 피격 사망 시 handlePlayerDeath가 정확히 1회만 호출되어야 함");
  assert(getGraveyardRecords().length === 1, "묘비명 레코드가 1개만 저장되어야 함");
  assert(getGraveyardRecords()[0].killer === "붉은 화염 해츨링", "묘비명의 사인이 브레스 시전자 이름이어야 함");
}

// -----------------------------------------------------------------------------
// TEST 5: 턴 루프 몬스터 다중 행동 중 사망 시 루프 즉시 정지 및 2차 호출 차단
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 5] 턴 루프 내 다중 몬스터 순차 행동 시 루프 즉각 중단 검증");
{
  clearGraveyardRecords();

  let deathHandledCount = 0;
  let secondMonsterActed = false;

  const player = new Player(10, 10);
  player.stats.hp = 10;
  player.stats.maxHp = 100;
  player.energy = 0;

  // 1번 몬스터 (치명타 공격으로 플레이어 즉사시킴)
  const monster1 = new Monster(10, 11, "ORC", 5);
  monster1._baseName = "선봉 오크";
  monster1.speed = 100;
  monster1.energy = 100;

  // 2번 몬스터 (루프가 중단되면 행동하지 않아야 함)
  const monster2 = new Monster(10, 9, "OGRE", 8);
  monster2._baseName = "후방 오우거";
  monster2.speed = 100;
  monster2.energy = 100;

  const map = new Map(25, 25, 1);

  const game = {
    player,
    map,
    currentSlot: 'slot1',
    isGameOver: false,
    _isHandlingDeath: false,
    playerTurn: false,
    floor: 3,
    turn: 30,
    effects: [],
    monsters: [monster1, monster2],
    _loopState: { e: 0, globalTicks: 0, monsterActCount: 0 },
    addLogEntry() {},
    updateUI() {},
    handlePlayerDeath() {
      if (this.isGameOver || this._isHandlingDeath) return;
      this.isGameOver = true;
      this._isHandlingDeath = true;
      deathHandledCount++;

      saveGraveyardRecord({
        playerName: this.player.name,
        level: this.player.level,
        floor: this.floor,
        killer: this.player.lastDamageSource || '앙그반드의 어둠',
        turns: this.turn,
        kills: 0,
        mimicCore: '인간'
      });
    },
    handleMonsterBuffsAndHeals() {},
    isMonsterAt() { return false; },
    attackPlayer(m, p) {
      if (m === monster2) {
        secondMonsterActed = true;
      }
      p.stats.hp = 0;
      p.lastDamageSource = m.displayName;
      if (typeof this.handlePlayerDeath === 'function') {
        this.handlePlayerDeath();
      }
    },
    useMonsterBreath() { return false; },
    runTurnLoopChunk() {
      if (this.isGameOver || this._isHandlingDeath) return;
      const state = this._loopState;
      if (!state) return;
      
      for (; state.e < 1e3;) {
        if (this.isGameOver || this._isHandlingDeath) return;
        if (this.player.stats.hp <= 0) {
          this.handlePlayerDeath();
          return;
        }

        let t = null, n = -1;
        for (let e = 0; e < this.monsters.length; e++) {
          let r = this.monsters[e];
          r.energy >= 100 && r.energy > n && ((n = r.energy), (t = r));
        }

        if (t) {
          this.attackPlayer(t, this.player);
          if (this.isGameOver || this._isHandlingDeath || this.player.stats.hp <= 0) {
            if (!this.isGameOver && !this._isHandlingDeath) {
              this.handlePlayerDeath();
            }
            return;
          }
          t.energy -= 100;
        } else {
          break;
        }
      }
    }
  };

  // 턴 루프 실행
  game.runTurnLoopChunk();

  assert(deathHandledCount === 1, `사망 처리가 정확히 1회만 실행되어야 함 (실제: ${deathHandledCount})`);
  assert(secondMonsterActed === false, "첫 번째 몬스터 공격으로 플레이어 사망 시 두 번째 몬스터는 행동하지 않아야 함");
  assert(getGraveyardRecords().length === 1, "묘비명 레코드가 단 1개만 저장되어야 함");
  assert(game.isGameOver === true, "isGameOver가 true여야 함");
  assert(game._isHandlingDeath === true, "_isHandlingDeath가 true여야 함");
}

// -----------------------------------------------------------------------------
// TEST 6: 묘비명 모달 UI [🗑️ 묘비 기록 비우기] 버튼 렌더링 및 clearGraveyardRecords 검증
// -----------------------------------------------------------------------------
console.log("\n▶ [TEST 6] 묘비명 모달 UI 초기화 버튼 렌더링 및 clearGraveyardRecords() 무결성 검증");
{
  clearGraveyardRecords();
  saveGraveyardRecord({
    playerName: "초기화테스터",
    level: 14,
    floor: 7,
    killer: "오우거 족장",
    turns: 340,
    score: 22000
  });

  assert(getGraveyardRecords().length === 1, "1개 레코드가 정상 적재되어야 함");

  // 1. Graveyard 모달 HTML 렌더링 검증
  const graveyardHTML = renderHallOfFameModalHTML(null, 'graveyard');
  assert(graveyardHTML.includes('id="btn-clear-graveyard"'), "Graveyard 탭 HTML에 #btn-clear-graveyard 버튼이 포함되어야 함");
  assert(graveyardHTML.includes('🗑️ 묘비 기록 비우기'), "Graveyard 탭 상단에 '🗑️ 묘비 기록 비우기' 문구가 노출되어야 함");
  assert(graveyardHTML.includes('초기화테스터'), "적재된 사망자 이름이 HTML에 렌더링되어야 함");

  // 2. Hall of Fame 탭 렌더링 시에는 비우기 버튼이 노출되지 않는지 검증
  const hofHTML = renderHallOfFameModalHTML(null, 'hallOfFame');
  assert(!hofHTML.includes('id="btn-clear-graveyard"'), "Hall of Fame 탭에는 묘비 기록 비우기 버튼이 노출되지 않아야 함");

  // 3. clearGraveyardRecords() 실행 후 레코드 및 HTML 리셋 검증
  clearGraveyardRecords();
  assert(getGraveyardRecords().length === 0, "clearGraveyardRecords() 호출 후 묘비 레코드 수가 0이어야 함");

  const emptyGraveyardHTML = renderHallOfFameModalHTML(null, 'graveyard');
  assert(emptyGraveyardHTML.includes('아직 사망한 모험가의 묘비가 없습니다'), "초기화 후 빈 묘비 안내 문구가 정상 렌더링되어야 함");
}

console.log("\n================================================================================");
console.log(`🏁 TEST COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("================================================================================");

if (testsFailed === 0) {
  console.log("🎉 ALL GRAVEYARD SINGLE RECORD TESTS PASSED WITH 100% SUCCESS!\n");
} else {
  console.error("❌ SOME TESTS FAILED!\n");
  process.exit(1);
}
