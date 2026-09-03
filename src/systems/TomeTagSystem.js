/**
 * @module TomeTagSystem
 * @category systems
 * @description 데이터 지향 3대 극성(Positive, Neutral, Detrimental) 태그 정의, 저주 장착 결속 제약, 턴 라이프사이클 훅 및 정화 엔진
 * @purity Stateless System
 * @dependencies none
 * @exports TomeTagSystem, POLARITY, DETRIMENTAL_TAGS
 */

export const POLARITY = Object.freeze({
  POSITIVE: 'POSITIVE',
  NEUTRAL: 'NEUTRAL',
  DETRIMENTAL: 'DETRIMENTAL'
});

export const DETRIMENTAL_TAGS = Object.freeze({
  CURSED: {
    key: 'CURSED',
    name: '저주 결속',
    polarity: POLARITY.DETRIMENTAL,
    category: 'BIND',
    desc: '사악한 마력으로 신체에 결속되어 주문서로 정화하기 전까지 장착을 해제할 수 없습니다.',
    badge: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'rgba(239, 68, 68, 0.4)' }
  },
  HEAVY_CURSED: {
    key: 'HEAVY_CURSED',
    name: '중저주 결속',
    polarity: POLARITY.DETRIMENTAL,
    category: 'BIND',
    desc: '깊은 원념이 깃들어 일반 저주 해제 주문서를 50% 확률로 무력화합니다.',
    badge: { bg: 'rgba(185, 28, 28, 0.25)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.6)' }
  },
  PERMA_CURSED: {
    key: 'PERMA_CURSED',
    name: '영구 저주',
    polarity: POLARITY.DETRIMENTAL,
    category: 'BIND',
    desc: '필멸자의 마법을 거부하는 영구적 저주입니다. 오직 강력한 *저주 해제* 주문서로만 정화됩니다.',
    badge: { bg: 'rgba(127, 29, 29, 0.35)', color: '#fca5a5', border: '#b91c1c' }
  },
  TY_CURSE: {
    key: 'TY_CURSE',
    name: '고대의 파멸',
    polarity: POLARITY.DETRIMENTAL,
    category: 'DISASTER',
    desc: '던전의 깊은 악의가 깃들어 150~250턴마다 무작위 재앙(적 소환, 마비, 혼란)을 폭발시킵니다.',
    badge: { bg: 'rgba(153, 27, 27, 0.3)', color: '#f87171', border: '#ef4444' },
    onTurnTick: (player, item, game, log) => {
      if (Math.random() < 0.005) { // 약 200턴에 1회
        if (log) log(`[Curse] 🌋 [${item.name}]에 깃든 고대의 파멸(TY_CURSE)이 공명을 일으킵니다!`, 'danger');
      }
    }
  },
  AUTO_CURSE: {
    key: 'AUTO_CURSE',
    name: '악령 재결속',
    polarity: POLARITY.DETRIMENTAL,
    category: 'BIND',
    desc: '저주가 해제되어도 100턴 후 스스로 신체에 다시 저주를 겁니다.',
    badge: { bg: 'rgba(76, 29, 149, 0.25)', color: '#c084fc', border: '#8b5cf6' }
  },
  TELEPORT_RANDOM: {
    key: 'TELEPORT_RANDOM',
    name: '변덕의 공간왜곡',
    polarity: POLARITY.DETRIMENTAL,
    category: 'CHAOS',
    desc: '착용자의 의지와 상관없이 던전의 낯선 장소로 강제 순간이동시킵니다.',
    badge: { bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' },
    onTurnTick: (player, item, game, log, forceTrigger = false) => {
      if (!game || !game.map || !player) return;
      if (forceTrigger || Math.random() < 0.012) { // 약 80턴에 1회
        const freeTile = game.map.getRandomWalkableTile ? game.map.getRandomWalkableTile() : null;
        if (freeTile) {
          player.x = freeTile.x;
          player.y = freeTile.y;
          if (typeof log === 'function') log(`[Curse] 🌀 [${item.name}]의 공간왜곡 저주로 인해 미지의 방으로 강제 텔레포트되었습니다!`, 'danger');
        }
      }
    }
  },
  DRAIN_EXP: {
    key: 'DRAIN_EXP',
    name: '영혼 잠식',
    polarity: POLARITY.DETRIMENTAL,
    category: 'DRAIN',
    desc: '착용자의 영혼을 갉아먹어 주기적으로 축적된 경험치를 서서히 잠식합니다.',
    badge: { bg: 'rgba(15, 23, 42, 0.5)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
    onTurnTick: (player, item, game, log, forceTrigger = false) => {
      if (player && (forceTrigger || (Math.random() < 0.04 && player.xp > 0))) {
        const drained = Math.max(1, Math.floor((player.xp || 100) * 0.015));
        player.xp = Math.max(0, (player.xp || 0) - drained);
        if (typeof log === 'function') log(`[Curse] 💀 [${item.name}]의 영혼 잠식으로 경험치 -${drained} XP를 빼앗겼습니다!`, 'danger');
      }
    }
  },
  AGGRAVATE: {
    key: 'AGGRAVATE',
    name: '어그로 악취',
    polarity: POLARITY.DETRIMENTAL,
    category: 'AURA',
    desc: '섬뜩한 악취와 진동을 방출하여 던전 안의 잠든 몬스터를 깨우고 추적 반경을 극대화합니다.',
    badge: { bg: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
    onTurnTick: (player, item, game, log, forceTrigger = false) => {
      if (game && Array.isArray(game.monsters) && (forceTrigger || Math.random() < 0.05)) {
        let awakened = 0;
        for (const m of game.monsters) {
          if (m && m.isAsleep) {
            m.isAsleep = false;
            awakened++;
          }
        }
        if (awakened > 0 && typeof log === 'function') {
          log(`[Curse] 📢 [${item.name}]의 불길한 진동에 잠들어 있던 몬스터 ${awakened}체가 깨어났습니다!`, 'danger');
        }
      }
    }
  },
  VULN_FIRE: {
    key: 'VULN_FIRE',
    name: '화염 취약',
    polarity: POLARITY.DETRIMENTAL,
    category: 'ELEMENT',
    desc: '착용자의 몸이 화염에 극도로 취약해져 화염 피격 피해가 +50% 증가합니다.',
    badge: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' }
  },
  VULN_COLD: {
    key: 'VULN_COLD',
    name: '냉기 취약',
    polarity: POLARITY.DETRIMENTAL,
    category: 'ELEMENT',
    desc: '착용자의 신체가 얼어붙기 쉬워져 냉기 피격 피해가 +50% 증가합니다.',
    badge: { bg: 'rgba(56, 189, 248, 0.15)', color: '#7dd3fc', border: 'rgba(56, 189, 248, 0.3)' }
  },
  VULN_ELEC: {
    key: 'VULN_ELEC',
    name: '전격 취약',
    polarity: POLARITY.DETRIMENTAL,
    category: 'ELEMENT',
    desc: '감전 전도율이 급증하여 번개 피격 피해가 +50% 증가합니다.',
    badge: { bg: 'rgba(250, 204, 21, 0.15)', color: '#fde047', border: 'rgba(250, 204, 21, 0.3)' }
  },
  VULN_ACID: {
    key: 'VULN_ACID',
    name: '산성 취약',
    polarity: POLARITY.DETRIMENTAL,
    category: 'ELEMENT',
    desc: '산성 침식에 약해져 산성 피격 피해가 +50% 증가합니다.',
    badge: { bg: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' }
  },
  PENALTY_STR: {
    key: 'PENALTY_STR',
    name: '근력 쇠퇴',
    polarity: POLARITY.DETRIMENTAL,
    category: 'STAT',
    desc: '착용자의 힘(STR)이 감퇴하고 적재 한도가 급감합니다.',
    badge: { bg: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.25)' }
  },
  PENALTY_DEX: {
    key: 'PENALTY_DEX',
    name: '민첩 마비',
    polarity: POLARITY.DETRIMENTAL,
    category: 'STAT',
    desc: '착용자의 민첩(DEX)이 감퇴하여 명중률과 회피율이 저하됩니다.',
    badge: { bg: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.25)' }
  },
  PENALTY_CON: {
    key: 'PENALTY_CON',
    name: '생명력 감퇴',
    polarity: POLARITY.DETRIMENTAL,
    category: 'STAT',
    desc: '착용자의 체질(CON)이 깎여 최대 체력이 감소합니다.',
    badge: { bg: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.25)' }
  },
  PENALTY_INT: {
    key: 'PENALTY_INT',
    name: '지능 실추',
    polarity: POLARITY.DETRIMENTAL,
    category: 'STAT',
    desc: '착용자의 지능(INT)이 저하되어 주문 위력이 약화됩니다.',
    badge: { bg: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.25)' }
  },
  HUNGRY_CURSE: {
    key: 'HUNGRY_CURSE',
    name: '기갈의 저주',
    polarity: POLARITY.DETRIMENTAL,
    category: 'DRAIN',
    desc: '포만감 소모 속도가 가속화되어 허기가 빠르게 찾아옵니다.',
    badge: { bg: 'rgba(180, 83, 9, 0.2)', color: '#fbbf24', border: 'rgba(180, 83, 9, 0.4)' }
  },
  BLACK_BREATH: {
    key: 'BLACK_BREATH',
    name: '검은 숨결',
    polarity: POLARITY.DETRIMENTAL,
    category: 'FATAL',
    desc: '체력 자연 회복이 완전 차단되고 치유 마법의 효율이 50% 급감합니다.',
    badge: { bg: 'rgba(0, 0, 0, 0.7)', color: '#94a3b8', border: '#475569' }
  }
});

export class TomeTagSystem {
  /**
   * 아이템이 현재 저주받아 탈착 불가 상태인지 판정합니다.
   * @param {Object} item 
   * @returns {boolean} 탈착 가능 여부 (true: 자유롭게 벗을 수 있음, false: 저주로 결속됨)
   */
  static canUnequip(item) {
    if (!item) return true;
    if (item.isCursed) return false;

    const tags = Array.isArray(item.specialTags) ? item.specialTags : [];
    const prefixes = Array.isArray(item.prefixes) ? item.prefixes : [];
    const suffixes = Array.isArray(item.suffixes) ? item.suffixes : [];
    const flags = item.flags instanceof Set ? Array.from(item.flags) : (Array.isArray(item.flags) ? item.flags : []);
    const all = [...tags, ...prefixes, ...suffixes, ...flags];

    return !all.some(t => t === 'CURSED' || t === 'HEAVY_CURSED' || t === 'PERMA_CURSED');
  }

  /**
   * 장비로부터 저주를 정화합니다 (저주 해제 주문서 연동).
   * @param {Object} item 
   * @param {boolean} [isHeavyScroll=false] - 강력한 저주 해제(*Remove Curse*) 여부
   * @returns {{ success: boolean, message: string }}
   */
  static removeCurse(item, isHeavyScroll = false) {
    if (!item) return { success: false, message: "아이템이 존재하지 않습니다." };
    if (!item.isCursed && this.canUnequip(item)) {
      return { success: false, message: "이 아이템에는 깃든 저주가 없습니다." };
    }

    const tags = Array.isArray(item.specialTags) ? item.specialTags : [];
    const hasPerma = tags.includes('PERMA_CURSED') || (item.flags && item.flags.includes && item.flags.includes('PERMA_CURSED'));
    const hasHeavy = tags.includes('HEAVY_CURSED') || (item.flags && item.flags.includes && item.flags.includes('HEAVY_CURSED'));

    // 1. 영구 저주 검증
    if (hasPerma && !isHeavyScroll) {
      return { success: false, message: "영구 저주는 일반 주문서로 해제할 수 없습니다! *저주 해제* 주문서가 필요합니다." };
    }

    // 2. 중저주 50% 확률 검증
    if (hasHeavy && !isHeavyScroll && Math.random() < 0.5) {
      return { success: false, message: "중저주가 격렬히 저항하여 정화에 실패했습니다!" };
    }

    // 3. 저주 정화 실행
    item.isCursed = false;
    item.specialTags = tags.filter(t => t !== 'CURSED' && t !== 'HEAVY_CURSED' && (isHeavyScroll || t !== 'PERMA_CURSED'));
    if (item.flags) {
      if (item.flags instanceof Set) {
        item.flags.delete('CURSED');
        item.flags.delete('HEAVY_CURSED');
        if (isHeavyScroll) item.flags.delete('PERMA_CURSED');
      } else if (Array.isArray(item.flags)) {
        item.flags = item.flags.filter(t => t !== 'CURSED' && t !== 'HEAVY_CURSED' && (isHeavyScroll || t !== 'PERMA_CURSED'));
      }
    }
    
    // 마이너스 역보정 수치 정상화
    if (item.toHit < 0) item.toHit = 0;
    if (item.toDmg < 0) item.toDmg = 0;
    if (item.baseAC < 0) item.baseAC = 0;

    return {
      success: true,
      message: `✨ [${item.name}]에 깃든 불길한 저주가 완전히 정화되어 신체 결속이 풀렸습니다!`
    };
  }

  /**
   * 플레이어가 착용한 모든 장비의 저주를 일괄 정화합니다 (*Remove Curse*).
   * @param {Object} player
   * @returns {number} 정화된 장비 수
   */
  static removeAllCurses(player) {
    if (!player || !player.equipment) return 0;
    let count = 0;
    for (const key of Object.keys(player.equipment)) {
      const item = player.equipment[key];
      if (item && (!this.canUnequip(item) || item.isCursed)) {
        const res = this.removeCurse(item, true);
        if (res.success) count++;
      }
    }
    return count;
  }

  /**
   * 매 턴 플레이어가 착용한 모든 장비의 디트리멘탈 태그 라이프사이클 훅 실행
   * @param {Object} player 
   * @param {Object} game 
   * @param {Function} logCallback 
   */
  static processTurnTicks(player, game, logCallback) {
    if (!player || !player.equipment) return;

    const eq = player.equipment;
    for (const slotKey of Object.keys(eq)) {
      const item = eq[slotKey];
      if (!item) continue;

      const tags = [
        ...(item.specialTags || []),
        ...(item.prefixes || []),
        ...(item.suffixes || []),
        ...(item.flags ? Array.from(item.flags) : [])
      ];

      for (const tKey of tags) {
        const def = DETRIMENTAL_TAGS[tKey];
        if (def && typeof def.onTurnTick === 'function') {
          def.onTurnTick(player, item, game, logCallback);
        }
      }
    }
  }

  /**
   * 태그 키에 대한 정의 메타데이터를 반환합니다.
   * @param {string} tagKey
   * @returns {Object|null}
   */
  static getTagDefinition(tagKey) {
    return DETRIMENTAL_TAGS[tagKey] || null;
  }

  /**
   * 태그 배열의 3대 극성 점수를 계산합니다.
   * @param {string[]} tags
   * @returns {{ positiveCount: number, neutralCount: number, detrimentalCount: number, score: number }}
   */
  static evaluatePolarity(tags = []) {
    let positiveCount = 0;
    let neutralCount = 0;
    let detrimentalCount = 0;

    for (const t of tags) {
      if (DETRIMENTAL_TAGS[t]) {
        detrimentalCount++;
      } else if (['FREE_ACT', 'RES_FIRE', 'RES_COLD', 'RES_ELEC', 'RES_ACID', 'RES_POIS', 'SEE_INVIS', 'TELEPATHY'].includes(t) || t.startsWith('SLAY_') || t.startsWith('BRAND_')) {
        positiveCount++;
      } else {
        neutralCount++;
      }
    }

    const score = (positiveCount * 2) - (detrimentalCount * 3);
    return { positiveCount, neutralCount, detrimentalCount, score };
  }
}
