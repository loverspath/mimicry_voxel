/**
 * @module BalanceModifierManager
 * @category systems
 * @description 게임 시작 옵션 및 런타임 밸런싱 모디파이어를 병합/평가하고 변경 이벤트를 발행하는 중앙 관리자
 * @purity State Store / Logic System
 * @dependencies EventBus.js, GameEvents.js, BalancePresets.js
 * @exports BalanceModifierManager, balanceModifierManager
 */

import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';
import { BALANCE_PRESET_TYPES, getPresetConfig } from '../configs/BalancePresets.js';

export class BalanceModifierManager {
  constructor() {
    this.currentPresetId = BALANCE_PRESET_TYPES.CLASSIC_TOME;
    this.customOverrides = {};
    this.activeConfig = null;

    this._reevaluateConfig();
  }

  /**
   * 활성 프리셋을 변경합니다. (선택 시 기존 커스텀 오버라이드는 초기화됩니다)
   * @param {string} presetId
   */
  setPreset(presetId) {
    if (!BALANCE_PRESET_TYPES[presetId]) {
      console.warn(`[BalanceModifierManager] 알 수 없는 프리셋: ${presetId}. CLASSIC_TOME으로 대체합니다.`);
      presetId = BALANCE_PRESET_TYPES.CLASSIC_TOME;
    }
    this.currentPresetId = presetId;
    this.customOverrides = {};
    this._reevaluateConfig();
  }

  /**
   * 특정 카테고리의 밸런스 파라미터 오버라이드를 설정합니다.
   * @param {string} category - 'spawn' | 'map' | 'loot' | 'gameplay'
   * @param {string} key
   * @param {*} value
   */
  setCustomOverride(category, key, value) {
    if (!this.customOverrides[category]) {
      this.customOverrides[category] = {};
    }
    this.customOverrides[category][key] = value;
    this._reevaluateConfig();
  }

  /**
   * 다중 커스텀 오버라이드를 일괄 적용합니다.
   * @param {Object} overrides
   */
  setCustomOverrides(overrides = {}) {
    if (!overrides || typeof overrides !== 'object') return;
    for (const [category, values] of Object.entries(overrides)) {
      if (!this.customOverrides[category]) {
        this.customOverrides[category] = {};
      }
      Object.assign(this.customOverrides[category], values);
    }
    this._reevaluateConfig();
  }

  /**
   * 모든 커스텀 오버라이드를 제거하고 현재 프리셋 기본값으로 복원합니다.
   */
  resetCustomOverrides() {
    this.customOverrides = {};
    this._reevaluateConfig();
  }

  /**
   * 현재 동결된 불변 밸런스 설정을 조회합니다.
   * @returns {Readonly<Object>}
   */
  getActiveConfig() {
    return this.activeConfig;
  }

  /**
   * 프리셋과 커스텀 오버라이드를 심층 병합하고 불변 동결 처리 및 이벤트 브로드캐스팅을 수행합니다.
   * @private
   */
  _reevaluateConfig() {
    const basePreset = getPresetConfig(this.currentPresetId);

    const mergedSpawn = Object.freeze({ ...basePreset.spawn, ...(this.customOverrides.spawn || {}) });
    const mergedMap = Object.freeze({ ...basePreset.map, ...(this.customOverrides.map || {}) });
    const mergedLoot = Object.freeze({ ...basePreset.loot, ...(this.customOverrides.loot || {}) });
    const mergedGameplay = Object.freeze({ ...basePreset.gameplay, ...(this.customOverrides.gameplay || {}) });

    const merged = {
      presetId: this.currentPresetId,
      name: basePreset.name,
      badgeColor: basePreset.badgeColor,
      spawn: mergedSpawn,
      map: mergedMap,
      loot: mergedLoot,
      gameplay: mergedGameplay
    };

    this.activeConfig = Object.freeze(merged);
    if (typeof globalThis !== 'undefined') {
      globalThis.__activeBalanceConfig = this.activeConfig;
    }

    // EventBus 메시지 브로드캐스팅
    if (typeof eventBus !== 'undefined' && eventBus && typeof eventBus.emit === 'function') {
      const eventName = (GameEvents && GameEvents.BALANCE_CONFIG_CHANGED) ? GameEvents.BALANCE_CONFIG_CHANGED : 'BALANCE_CONFIG_CHANGED';
      eventBus.emit(eventName, {
        config: this.activeConfig,
        presetId: this.currentPresetId
      });
    }
  }

  /**
   * 세이브 저장을 위한 직렬화 DTO 생성
   * @returns {Object}
   */
  serialize() {
    return {
      presetId: this.currentPresetId,
      customOverrides: JSON.parse(JSON.stringify(this.customOverrides))
    };
  }

  /**
   * 세이브 복원을 위한 역직렬화
   * @param {Object} data
   */
  deserialize(data) {
    if (!data) return;
    this.currentPresetId = data.presetId || BALANCE_PRESET_TYPES.CLASSIC_TOME;
    this.customOverrides = data.customOverrides || {};
    this._reevaluateConfig();
  }
}

export const balanceModifierManager = new BalanceModifierManager();
