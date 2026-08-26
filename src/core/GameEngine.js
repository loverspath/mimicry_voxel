/**
 * @module GameEngine
 * @category core
 * @description 순수 턴 스케줄링, 엔티티 라이프사이클 관리 및 EventBus 기반 메시지 디스패치를 전담하는 슬림 엔진 코어
 * @purity State Store / Logic Engine
 * @dependencies EventBus.js, GameEvents.js, GameBalanceConfig.js
 * @exports GameEngine
 */

import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';
import { TURN_CONFIG } from '../configs/GameBalanceConfig.js';

export class GameEngine {
  constructor() {
    this.turn = 0;
    this.floor = 1;
    this.isProcessingTurn = false;
    this.eventBus = eventBus;
  }

  /**
   * 턴 번호 증가 및 TURN_START 이벤트 발행
   */
  nextTurn() {
    this.turn++;
    this.eventBus.emit(GameEvents.TURN_START, { turn: this.turn, floor: this.floor });
  }

  /**
   * 턴 종료 처리 및 TURN_END 이벤트 발행
   */
  endTurn() {
    this.eventBus.emit(GameEvents.TURN_END, { turn: this.turn, floor: this.floor });
  }

  /**
   * 층수 변경 처리
   * @param {number} newFloor - 새 층 번호
   */
  changeFloor(newFloor) {
    this.floor = newFloor;
    this.eventBus.emit(GameEvents.FLOOR_CHANGE, { floor: this.floor });
  }

  /**
   * 로그 메시지 발행 (UI와 디커플링된 이벤트 발송)
   * @param {string} message - 로그 내용
   * @param {string} [type='system'] - 로그 유형
   */
  log(message, type = 'system') {
    this.eventBus.emit(GameEvents.LOG_MESSAGE, { message, type });
  }

  /**
   * 승천(Ascension) 승리 상태 활성화 및 이벤트 디스패치
   * @param {Object} victoryData - 승리 통계 데이터
   */
  triggerVictory(victoryData) {
    this.isVictory = true;
    this.eventBus.emit(GameEvents.ASCENSION, victoryData);
    this.eventBus.emit(GameEvents.GAME_VICTORY, victoryData);
    this.log(`✨ [Ascension] 50F 모르고스를 물리치고 발리노르로 승천하였습니다!`, 'loot');
  }

  /**
   * 게임 오버(사망) 상태 활성화 및 이벤트 디스패치
   * @param {Object} deathData - 사망 기록 데이터
   */
  triggerGameOver(deathData) {
    this.isGameOver = true;
    this.eventBus.emit(GameEvents.GAME_OVER, deathData);
  }

  /**
   * 보스 페이즈 전환 이벤트 디스패치
   * @param {Object} bossMonster - 대상 보스
   * @param {number} fromPhase - 이전 페이즈
   * @param {number} toPhase - 변경 페이즈
   */
  triggerBossPhaseChange(bossMonster, fromPhase, toPhase) {
    this.eventBus.emit(GameEvents.BOSS_PHASE_CHANGE, {
      boss: bossMonster,
      fromPhase,
      toPhase
    });
  }
}
