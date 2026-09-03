/**
 * @module TomeIdentificationEngine
 * @category systems
 * @description ToME 2.3.5 / TomeNET 정통 4단계 의사 감정(Pseudo-ID) 및 점진적 정보 개방 무상태 엔진
 * @purity Stateless System
 * @dependencies TomeFlagResolver.js
 * @exports TomeIdentificationEngine, ID_STATES, PSEUDO_SENSES
 */

import { TomeFlagResolver } from './TomeFlagResolver.js';

export const ID_STATES = Object.freeze({
  UNIDENTIFIED: 'UNIDENTIFIED',
  PSEUDO_IDENTIFIED: 'PSEUDO_IDENTIFIED',
  IDENTIFIED: 'IDENTIFIED',
  STAR_IDENTIFIED: 'STAR_IDENTIFIED'
});

export const PSEUDO_SENSES = Object.freeze({
  SPECIAL: 'special',
  GREAT: 'great',
  GOOD: 'good',
  AVERAGE: 'average',
  WORTHLESS: 'worthless',
  CURSED: 'cursed',
  TERRIBLE: 'terrible'
});

export class TomeIdentificationEngine {
  /**
   * 아이템의 실제 속성을 기반으로 ToME 정통 의사 감정 육감 칭호(Pseudo-Sense)를 산출합니다.
   * @param {Object} item - 대상 아이템 인스턴스
   * @returns {string} PSEUDO_SENSES 열거형 중 하나
   */
  static evaluatePseudoSense(item) {
    if (!item) return PSEUDO_SENSES.AVERAGE;

    // 소모품 및 코어, 골드는 의사 감정 대상에서 제외
    if (item.type === 'POTION' || item.type === 'SCROLL' || item.type === 'CORE' || item.type === 'FOOD' || item.type === 'GOLD') {
      return PSEUDO_SENSES.AVERAGE;
    }

    let flags = new Set();
    if (item.flags instanceof Set) {
      flags = item.flags;
    } else if (Array.isArray(item.flags)) {
      flags = new Set(item.flags);
    } else if (typeof TomeFlagResolver !== 'undefined' && typeof TomeFlagResolver.collectFlagsFromItem === 'function') {
      flags = TomeFlagResolver.collectFlagsFromItem(item);
    }

    // specialTags 병합
    if (Array.isArray(item.specialTags)) {
      for (const t of item.specialTags) flags.add(t);
    }

    const toHit = item.toHit !== undefined ? item.toHit : 0;
    const toDmg = item.toDmg !== undefined ? item.toDmg : (item.toDamage || 0);
    const baseAC = item.baseAC !== undefined ? item.baseAC : (item.ac || 0);
    const upgradeLevel = item.upgradeLevel || 0;

    // 1. 치명적 저주 (Terrible) 판정
    if (
      flags.has('PERMA_CURSED') ||
      flags.has('HEAVY_CURSED') ||
      flags.has('TY_CURSE') ||
      flags.has('AGGRAVATE') ||
      flags.has('BLACK_BREATH')
    ) {
      return PSEUDO_SENSES.TERRIBLE;
    }

    // 2. 일반 저주 (Cursed) 판정
    if (
      flags.has('CURSED') ||
      item.isCursed ||
      toHit <= -5 ||
      toDmg <= -5 ||
      baseAC <= -5
    ) {
      return PSEUDO_SENSES.CURSED;
    }

    // 3. 전설 유물 (Special) 판정
    const isArtifact = !!(
      item.artifactKey ||
      flags.has('ARTIFACT') ||
      flags.has('INSTA_ART') ||
      item.color === '#ffd700'
    );
    if (isArtifact) {
      return PSEUDO_SENSES.SPECIAL;
    }

    // 4. 최상급 에고 (Great) 판정 (슬레이, 브랜드, 저항, 면역, 발동 보유)
    const hasSlays = Object.keys(item.slayTags || {}).length > 0;
    const hasBrands = Object.keys(item.brands || {}).length > 0;
    const hasResists = Object.keys(item.resistances || {}).length > 0;
    const hasImmunities = (item.immunities && (item.immunities.size > 0 || Object.keys(item.immunities).length > 0));
    const hasActivation = flags.has('ACTIVATE');
    const hasEgoPrefixes = Array.isArray(item.prefixes) && item.prefixes.length > 0;
    const hasEgoSuffixes = Array.isArray(item.suffixes) && item.suffixes.length > 0;

    if (hasSlays || hasBrands || hasResists || hasImmunities || hasActivation) {
      return PSEUDO_SENSES.GREAT;
    }

    // 5. 우수 장비 (Good) 판정 (단순 에고 접사, 강화 또는 양수 보정치 보유)
    if (
      hasEgoPrefixes ||
      hasEgoSuffixes ||
      upgradeLevel > 0 ||
      toHit > 0 ||
      toDmg > 0 ||
      baseAC > 0
    ) {
      return PSEUDO_SENSES.GOOD;
    }

    // 6. 조잡한 마이너스 장비 (Worthless) 판정 (단, 저주는 아님)
    if (toHit < 0 || toDmg < 0 || baseAC < 0) {
      return PSEUDO_SENSES.WORTHLESS;
    }

    // 7. 평범한 일반 장비 (Average)
    return PSEUDO_SENSES.AVERAGE;
  }

  /**
   * 아이템을 의사 감정(Pseudo-ID) 상태로 전이합니다.
   * @param {Object} item
   * @returns {boolean} 상태 변경 여부
   */
  static applyPseudoId(item) {
    if (!item || item.idState !== ID_STATES.UNIDENTIFIED) return false;
    item.idState = ID_STATES.PSEUDO_IDENTIFIED;
    item.pseudoSense = this.evaluatePseudoSense(item);
    if (item.pseudoSense === PSEUDO_SENSES.CURSED || item.pseudoSense === PSEUDO_SENSES.TERRIBLE) {
      item.isCursed = true;
    }
    return true;
  }

  /**
   * 일반 감정 주문서(Scroll of Identify)를 통한 정밀 감정
   * @param {Object} item
   * @returns {boolean}
   */
  static identifyItem(item) {
    if (!item) return false;
    if (item.idState === ID_STATES.IDENTIFIED || item.idState === ID_STATES.STAR_IDENTIFIED) {
      return false;
    }
    item.idState = ID_STATES.IDENTIFIED;
    item.pseudoSense = this.evaluatePseudoSense(item);
    if (item.pseudoSense === PSEUDO_SENSES.CURSED || item.pseudoSense === PSEUDO_SENSES.TERRIBLE) {
      item.isCursed = true;
    }
    return true;
  }

  /**
   * 진실의 감정 주문서(Scroll of *Identify*)를 통한 3차 완전 감정
   * @param {Object} item
   * @returns {boolean}
   */
  static starIdentifyItem(item) {
    if (!item) return false;
    item.idState = ID_STATES.STAR_IDENTIFIED;
    item.pseudoSense = this.evaluatePseudoSense(item);
    if (item.pseudoSense === PSEUDO_SENSES.CURSED || item.pseudoSense === PSEUDO_SENSES.TERRIBLE) {
      item.isCursed = true;
    }
    return true;
  }

  /**
   * 인벤토리 및 장비 착용 턴 경과에 따른 감각 자동 발현 처리
   * @param {Object} player - 플레이어 인스턴스
   * @param {Function} [onSenseDiscovered=null] - 신규 감각 획득 시 알림 콜백
   */
  static processTurnSense(player, onSenseDiscovered = null) {
    if (!player || !player.equipment) return;

    const eq = player.equipment;
    for (const key of Object.keys(eq)) {
      const item = eq[key];
      if (item && item.idState === ID_STATES.UNIDENTIFIED) {
        item.wieldTurns = (item.wieldTurns || 0) + 1;
        if (item.wieldTurns >= 3) {
          const changed = this.applyPseudoId(item);
          if (changed && typeof onSenseDiscovered === 'function') {
            onSenseDiscovered(item, key);
          }
        }
      }
    }
  }

  /**
   * 감정 단계(Tier)에 따른 점진적 아이템 표시명 포맷팅 헬퍼
   * @param {Object} item
   * @returns {string}
   */
  static formatItemDisplayName(item) {
    if (!item) return '';

    // 소모품, 음식, 코어는 기본명 유지
    if (item.type === 'POTION' || item.type === 'SCROLL' || item.type === 'CORE' || item.type === 'FOOD' || item.type === 'GOLD') {
      return item._baseName || item.name || '아이템';
    }

    const baseName = item._baseName || item.name || '미지의 장비';
    const idState = item.idState || ID_STATES.IDENTIFIED;

    // Tier 0: 미감정 (외형 기본명만 노출)
    if (idState === ID_STATES.UNIDENTIFIED) {
      return baseName;
    }

    // Tier 1: 의사 감정 (육감 칭호 태그 노출)
    if (idState === ID_STATES.PSEUDO_IDENTIFIED) {
      const sense = item.pseudoSense || this.evaluatePseudoSense(item);
      return `${baseName} {${sense}}`;
    }

    // Tier 2 & 3: 정밀 감정 (에고, 보정치 공개)
    let identifiedName = baseName;
    const prefixStr = Array.isArray(item.prefixes) && item.prefixes.length > 0 ? item.prefixes.join(' ') + ' ' : '';
    const suffixStr = Array.isArray(item.suffixes) && item.suffixes.length > 0 ? ' of ' + item.suffixes.join(' ') : '';
    
    // 접사가 있다면 베이스 이름에 접사 반영
    if (prefixStr || suffixStr) {
      identifiedName = `${prefixStr}${baseName}${suffixStr}`.trim();
    }

    // 주사위 / 보정치 태그
    let modTag = '';
    const toHit = item.toHit !== undefined ? item.toHit : 0;
    const toDmg = item.toDmg !== undefined ? item.toDmg : 0;
    const baseAC = item.baseAC !== undefined ? item.baseAC : 0;

    if (toHit !== 0 || toDmg !== 0) {
      const hitSign = toHit >= 0 ? `+${toHit}` : `${toHit}`;
      const dmgSign = toDmg >= 0 ? `+${toDmg}` : `${toDmg}`;
      modTag += ` (${hitSign},${dmgSign})`;
    }

    if (baseAC !== 0) {
      const acSign = baseAC >= 0 ? `+${baseAC}` : `${baseAC}`;
      modTag += ` [${acSign}]`;
    }

    if (item.upgradeLevel && item.upgradeLevel > 0) {
      modTag += ` (+${item.upgradeLevel})`;
    }

    if (idState === ID_STATES.STAR_IDENTIFIED) {
      return `${identifiedName}${modTag} *IDENTIFIED*`;
    }

    return `${identifiedName}${modTag}`;
  }
}
