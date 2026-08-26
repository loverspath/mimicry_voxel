/**
 * @module ConsumableEffectEngine
 * @category systems
 * @description ToME 2.3.5 소비성 아이템 효과 실행기 (TomeConsumableEngine 연동 호환 래퍼)
 * @purity Stateless Facade
 * @exports ConsumableEffectEngine
 */

import { TomeConsumableEngine } from './TomeConsumableEngine.js';

export class ConsumableEffectEngine {
  /**
   * 소비성 아이템(포션, 스크롤, 플라스크, 음식 등)을 사용합니다.
   * @param {Object} item - 사용할 Item 인스턴스
   * @param {Object} player - 플레이어 인스턴스
   * @param {Object} game - Game 핵심 인스턴스
   * @param {Function} addLogEntry - 로그 출력 함수
   * @returns {boolean} 사용 성공 여부
   */
  static useConsumable(item, player, game = null, addLogEntry = null) {
    return TomeConsumableEngine.useConsumable(item, player, game, addLogEntry);
  }

  /**
   * 포션 마시기 효과 처리
   */
  static usePotion(item, player, game, log) {
    return TomeConsumableEngine.usePotion(item, player, game, log);
  }

  /**
   * 주문서 읽기 효과 처리
   */
  static useScroll(item, player, game, log) {
    return TomeConsumableEngine.useScroll(item, player, game, log);
  }
}
