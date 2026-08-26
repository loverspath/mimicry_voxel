/**
 * @module TraceLogger
 * @description 게임의 복잡한 스탯 재계산 격발 원인, 더티 플래그 만료 시점 및 전투 대미지 감쇄 계산 경로 등 
 *              모든 중요 상태 변화 시점을 정밀하게 기록하고 역추적(Traceability)할 수 있도록 전담하는 중앙 집중형 디버그 로그 엔진.
 * @dependency 없음
 */
export class TraceLogger {
  static logs = [];
  static maxLogs = 500;

  /**
   * 디버그 로그 적재
   * @param {string} category - 로그 카테고리 (e.g. 'STATS', 'COMBAT', 'CACHE', 'BUFF')
   * @param {string} message - 상세 로그 메시지
   * @param {Object} [meta] - 추가 메타데이터
   */
  static log(category, message, meta = null) {
    const timestamp = new Date().toISOString().slice(11, 23); // 'HH:MM:SS.mmm' 포맷
    const logEntry = {
      timestamp,
      category: category.toUpperCase(),
      message,
      meta
    };

    TraceLogger.logs.push(logEntry);

    // 로그 한도 초과 시 오래된 것부터 삭제
    if (TraceLogger.logs.length > TraceLogger.maxLogs) {
      TraceLogger.logs.shift();
    }

    // 개발 중 콘솔 디버깅 편의를 위해 브라우저 개발자 도구에 노출
    if (typeof console !== 'undefined' && console.debug) {
      const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
      console.debug(`[TRACE] [${timestamp}] [${category}] ${message}${metaStr}`);
    }
  }

  /**
   * 전체 적재된 로그 반환
   * @returns {Array<Object>} 로그 엔트리 배열
   */
  static getLogs() {
    return TraceLogger.logs;
  }

  /**
   * 특정 카테고리로 필터링된 로그 반환
   * @param {string} category 
   * @returns {Array<Object>}
   */
  static getLogsByCategory(category) {
    const catUpper = category.toUpperCase();
    return TraceLogger.logs.filter(l => l.category === catUpper);
  }

  /**
   * 로그 버퍼 초기화
   */
  static clear() {
    TraceLogger.logs = [];
  }
}
