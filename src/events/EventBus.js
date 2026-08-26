/**
 * @module EventBus
 * @category events
 * @description 게임 엔진과 UI 컴포넌트 간의 결합도를 완전히 분리하는 싱글톤 Pub/Sub 중앙 메시지 브로커
 * @purity State Store / Event Broker
 * @dependencies none
 * @exports EventBus, eventBus
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 식별자 (GameEvents enum)
   * @param {Function} callback - 이벤트 수신 콜백
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback); // 구독 해제 함수 반환
  }

  /**
   * 이벤트 리스너 등록 해제
   * @param {string} event - 이벤트 식별자
   * @param {Function} callback - 해제할 콜백
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 이벤트 단발성 구독 (1회 실행 후 자동 해제)
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 이벤트 발행 및 구독자 전파
   * @param {string} event - 이벤트 식별자
   * @param {*} [data=null] - 전달할 페이로드 데이터
   */
  emit(event, data = null) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus Error on '${event}']:`, error);
        }
      }
    }
  }

  /**
   * 모든 이벤트 리스너 초기화
   */
  clear() {
    this.listeners.clear();
  }
}

// 전역 싱글톤 인스턴스
export const eventBus = new EventBus();
