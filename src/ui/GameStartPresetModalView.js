/**
 * @module GameStartPresetModalView
 * @category ui
 * @description 게임 시작 시 4대 난이도 프리셋 선택 및 세부 모디파이어(드랍률, 몬스터 밀도, 사망 모드 등) 커스터마이징 대화상자 렌더러
 * @purity DOM Renderer
 * @dependencies BalancePresets.js, BalanceModifierManager.js, EventBus.js, GameEvents.js
 * @exports GameStartPresetModalView, renderPresetModalHTML
 */

import { BALANCE_PRESET_TYPES, BALANCE_PRESETS, getPresetConfig } from '../configs/BalancePresets.js';
import { balanceModifierManager } from '../systems/BalanceModifierManager.js';
import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';

/**
 * 밸런스 프리셋 선택 모달의 순수 HTML 마크업을 생성합니다.
 * @param {string} selectedPresetId - 현재 선택된 프리셋 ID
 * @param {Object} [overrides={}] - 커스텀 오버라이드 객체
 * @returns {string} 모달 본문 HTML
 */
export function renderPresetModalHTML(selectedPresetId = BALANCE_PRESET_TYPES.CLASSIC_TOME, overrides = {}) {
  const basePreset = getPresetConfig(selectedPresetId);
  const curSpawn = { ...basePreset.spawn, ...(overrides.spawn || {}) };
  const curLoot = { ...basePreset.loot, ...(overrides.loot || {}) };
  const curGameplay = { ...basePreset.gameplay, ...(overrides.gameplay || {}) };

  const presetCardsHtml = Object.values(BALANCE_PRESETS).map(preset => {
    const isSelected = preset.id === selectedPresetId;
    const activeClass = isSelected ? 'selected' : '';
    return `
      <div class="preset-card ${activeClass}" data-preset-id="${preset.id}" style="--badge-color: ${preset.badgeColor};">
        <div class="preset-card-header">
          <span class="preset-badge-indicator" style="background: ${preset.badgeColor};"></span>
          <h4 class="preset-card-title">${preset.name}</h4>
          ${isSelected ? '<span class="preset-selected-tag">선택됨</span>' : ''}
        </div>
        <p class="preset-card-desc">${preset.desc}</p>
        <div class="preset-card-summary">
          <span class="summary-pill">사망: ${preset.gameplay.deathPenaltyMode}</span>
          <span class="summary-pill">드랍: ${preset.loot.itemDropMultiplier}x</span>
          <span class="summary-pill">밀도: ${preset.spawn.monsterDensityMultiplier}x</span>
          <span class="summary-pill">쿨다운: ${preset.gameplay.cooldownRecoveryMultiplier}x</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="preset-modal-backdrop" id="preset-modal-backdrop">
      <div class="preset-modal-container glassmorphism-card" role="dialog" aria-labelledby="preset-modal-title">
        <header class="preset-modal-header">
          <div class="header-title-group">
            <span class="header-icon">⚖️</span>
            <div>
              <h2 id="preset-modal-title" class="modal-main-title">난이도 프리셋 및 동적 밸런스 설정</h2>
              <p class="modal-sub-title">플레이 스타일에 맞게 던전 규칙과 난이도를 자유롭게 조율하세요</p>
            </div>
          </div>
          <button type="button" class="modal-close-btn" id="preset-modal-close-btn" aria-label="닫기">✕</button>
        </header>

        <div class="preset-modal-content">
          <!-- 1. 4대 메이저 프리셋 선택 그리드 -->
          <section class="preset-section">
            <h3 class="section-label">1. 기본 난이도 프리셋 선택</h3>
            <div class="preset-cards-grid">
              ${presetCardsHtml}
            </div>
          </section>

          <!-- 2. 세부 파라미터 모디파이어 슬라이더/토글 -->
          <section class="preset-section modifiers-section">
            <div class="section-header-row">
              <h3 class="section-label">2. 세부 모디파이어 커스터마이징</h3>
              <button type="button" id="btn-reset-modifiers" class="btn-text-action">↺ 프리셋 기본값 복원</button>
            </div>

            <div class="modifiers-grid">
              <!-- 스폰 & 조크 몬스터 -->
              <div class="modifier-box">
                <div class="mod-row">
                  <label for="mod-monster-density">몬스터 밀도 배율</label>
                  <span class="mod-val" id="val-monster-density">${curSpawn.monsterDensityMultiplier}x</span>
                </div>
                <input type="range" id="mod-monster-density" min="0.5" max="3.0" step="0.25" value="${curSpawn.monsterDensityMultiplier}" class="mod-slider" />
                <span class="mod-hint">던전 방마다 출현하는 몬스터의 개체수 배율</span>
              </div>

              <!-- 아이템 드랍률 -->
              <div class="modifier-box">
                <div class="mod-row">
                  <label for="mod-item-drop">아이템 드랍 배율</label>
                  <span class="mod-val" id="val-item-drop">${curLoot.itemDropMultiplier}x</span>
                </div>
                <input type="range" id="mod-item-drop" min="0.5" max="4.0" step="0.5" value="${curLoot.itemDropMultiplier}" class="mod-slider" />
                <span class="mod-hint">몬스터 처치 및 보물상자 전리품 획득 배율</span>
              </div>

              <!-- 쿨다운 회복 속도 -->
              <div class="modifier-box">
                <div class="mod-row">
                  <label for="mod-cd-recovery">스킬 쿨다운 회복 배율</label>
                  <span class="mod-val" id="val-cd-recovery">${curGameplay.cooldownRecoveryMultiplier}x</span>
                </div>
                <input type="range" id="mod-cd-recovery" min="0.5" max="2.5" step="0.25" value="${curGameplay.cooldownRecoveryMultiplier}" class="mod-slider" />
                <span class="mod-hint">턴 경과 시 스킬 재사용 대기시간 회복 속도</span>
              </div>

              <!-- 사망 패널티 모드 -->
              <div class="modifier-box">
                <div class="mod-row">
                  <label for="mod-death-penalty">사망 패널티 모드</label>
                  <span class="mod-val" id="val-death-penalty" style="color: #38bdf8; font-weight: bold;">${curGameplay.deathPenaltyMode}</span>
                </div>
                <select id="mod-death-penalty" class="mod-select">
                  <option value="PERMADEATH" ${curGameplay.deathPenaltyMode === 'PERMADEATH' ? 'selected' : ''}>PERMADEATH (정통 영구 사망)</option>
                  <option value="CHECKPOINT" ${curGameplay.deathPenaltyMode === 'CHECKPOINT' ? 'selected' : ''}>CHECKPOINT (해당 층 부활)</option>
                  <option value="ROGUE_LITE" ${curGameplay.deathPenaltyMode === 'ROGUE_LITE' ? 'selected' : ''}>ROGUE_LITE (재화/도감 유지)</option>
                  <option value="IRONMAN" ${curGameplay.deathPenaltyMode === 'IRONMAN' ? 'selected' : ''}>IRONMAN (저장 슬롯 즉시 파기)</option>
                </select>
                <span class="mod-hint">캐릭터 체력 0 도달 시 적용되는 사망 패널티 룰</span>
              </div>

              <!-- 조크 몬스터 허용 토글 -->
              <div class="modifier-box toggle-box">
                <div class="toggle-content">
                  <span class="toggle-label">조크 몬스터 출현 (JokeMonsters)</span>
                  <span class="mod-hint">산타, 바니걸 등 이스터에그 조크 몬스터 출현 허용</span>
                </div>
                <label class="switch-ui">
                  <input type="checkbox" id="mod-joke-monsters" ${curSpawn.allowJokeMonsters ? 'checked' : ''} />
                  <span class="switch-slider"></span>
                </label>
              </div>

              <!-- OOD 깜짝 심층 유입 한계 -->
              <div class="modifier-box">
                <div class="mod-row">
                  <label for="mod-ood-chance">돌발 심층(OOD) 출현율</label>
                  <span class="mod-val" id="val-ood-chance">${Math.round(curSpawn.oodRollChanceCap * 100)}%</span>
                </div>
                <input type="range" id="mod-ood-chance" min="0.0" max="0.30" step="0.05" value="${curSpawn.oodRollChanceCap}" class="mod-slider" />
                <span class="mod-hint">저층에서 상위 심층 몬스터가 돌발 조우할 확률</span>
              </div>
            </div>
          </section>
        </div>

        <footer class="preset-modal-footer">
          <div class="footer-status-pill">
            <span class="indicator-dot" style="background: ${basePreset.badgeColor};"></span>
            <span id="footer-active-preset-name">${basePreset.name}</span>
          </div>
          <div class="footer-actions">
            <button type="button" id="btn-preset-cancel" class="sys-btn secondary">취소</button>
            <button type="button" id="btn-preset-confirm" class="sys-btn primary">✨ 밸런스 적용 및 확정</button>
          </div>
        </footer>
      </div>
    </div>
  `;
}

export class GameStartPresetModalView {
  constructor(modalId = 'game-start-preset-modal-root') {
    this.modalId = modalId;
    this.container = null;
    this.currentPresetId = BALANCE_PRESET_TYPES.CLASSIC_TOME;
    this.customOverrides = { spawn: {}, map: {}, loot: {}, gameplay: {} };
    this.onConfirmCallback = null;
    this.isOpen = false;
  }

  /**
   * DOM 트리에 모달 컨테이너를 마운트합니다.
   */
  init(parentEl = null) {
    if (typeof document === 'undefined') return;
    const parent = parentEl || document.body;

    let existing = document.getElementById(this.modalId);
    if (!existing) {
      this.container = document.createElement('div');
      this.container.id = this.modalId;
      this.container.className = 'preset-modal-mount hidden';
      parent.appendChild(this.container);
    } else {
      this.container = existing;
    }
  }

  /**
   * 모달을 열고 현재 매니저의 프리셋/설정을 기반으로 렌더링합니다.
   * @param {Object} [options={}]
   * @param {Function} [options.onConfirm=null] - 적용 완료 시 호출될 콜백
   * @param {string} [options.initialPresetId=null]
   */
  open(options = {}) {
    if (!this.container) this.init();
    if (options.onConfirm) this.onConfirmCallback = options.onConfirm;

    const currentConfig = balanceModifierManager.getActiveConfig();
    this.currentPresetId = options.initialPresetId || currentConfig?.presetId || BALANCE_PRESET_TYPES.CLASSIC_TOME;
    this.customOverrides = JSON.parse(JSON.stringify(balanceModifierManager.customOverrides || {}));

    this._render();
    this._bindEvents();

    this.container.classList.remove('hidden');
    this.isOpen = true;
  }

  /**
   * 모달을 닫습니다.
   */
  close() {
    if (!this.container) return;
    this.container.classList.add('hidden');
    this.isOpen = false;
  }

  /**
   * 모달 HTML을 새로고침 렌더링합니다.
   * @private
   */
  _render() {
    if (!this.container) return;
    this.container.innerHTML = renderPresetModalHTML(this.currentPresetId, this.customOverrides);
  }

  /**
   * 인터랙티브 조작계 이벤트 바인딩
   * @private
   */
  _bindEvents() {
    if (!this.container) return;

    // 1. 프리셋 카드 선택
    const cards = this.container.querySelectorAll('.preset-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const presetId = card.getAttribute('data-preset-id');
        if (presetId && presetId !== this.currentPresetId) {
          this.currentPresetId = presetId;
          this.customOverrides = {}; // 프리셋 변경 시 커스텀 오버라이드 초기화
          this._render();
          this._bindEvents();
        }
      });
    });

    // 2. 세부 슬라이더 및 입력 이벤트
    const densityInput = this.container.querySelector('#mod-monster-density');
    if (densityInput) {
      densityInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!this.customOverrides.spawn) this.customOverrides.spawn = {};
        this.customOverrides.spawn.monsterDensityMultiplier = val;
        const valLabel = this.container.querySelector('#val-monster-density');
        if (valLabel) valLabel.textContent = `${val.toFixed(2)}x`;
      });
    }

    const itemDropInput = this.container.querySelector('#mod-item-drop');
    if (itemDropInput) {
      itemDropInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!this.customOverrides.loot) this.customOverrides.loot = {};
        this.customOverrides.loot.itemDropMultiplier = val;
        const valLabel = this.container.querySelector('#val-item-drop');
        if (valLabel) valLabel.textContent = `${val.toFixed(1)}x`;
      });
    }

    const cdRecoveryInput = this.container.querySelector('#mod-cd-recovery');
    if (cdRecoveryInput) {
      cdRecoveryInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!this.customOverrides.gameplay) this.customOverrides.gameplay = {};
        this.customOverrides.gameplay.cooldownRecoveryMultiplier = val;
        const valLabel = this.container.querySelector('#val-cd-recovery');
        if (valLabel) valLabel.textContent = `${val.toFixed(2)}x`;
      });
    }

    const deathSelect = this.container.querySelector('#mod-death-penalty');
    if (deathSelect) {
      deathSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!this.customOverrides.gameplay) this.customOverrides.gameplay = {};
        this.customOverrides.gameplay.deathPenaltyMode = val;
        const valLabel = this.container.querySelector('#val-death-penalty');
        if (valLabel) valLabel.textContent = val;
      });
    }

    const jokeToggle = this.container.querySelector('#mod-joke-monsters');
    if (jokeToggle) {
      jokeToggle.addEventListener('change', (e) => {
        const val = e.target.checked;
        if (!this.customOverrides.spawn) this.customOverrides.spawn = {};
        this.customOverrides.spawn.allowJokeMonsters = val;
      });
    }

    const oodInput = this.container.querySelector('#mod-ood-chance');
    if (oodInput) {
      oodInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!this.customOverrides.spawn) this.customOverrides.spawn = {};
        this.customOverrides.spawn.oodRollChanceCap = val;
        const valLabel = this.container.querySelector('#val-ood-chance');
        if (valLabel) valLabel.textContent = `${Math.round(val * 100)}%`;
      });
    }

    // 3. 프리셋 기본값 복원 버튼
    const resetBtn = this.container.querySelector('#btn-reset-modifiers');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.customOverrides = {};
        this._render();
        this._bindEvents();
      });
    }

    // 4. 취소 / 닫기 버튼
    const closeBtn = this.container.querySelector('#preset-modal-close-btn');
    const cancelBtn = this.container.querySelector('#btn-preset-cancel');
    const closeHandler = () => this.close();
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);
    if (cancelBtn) cancelBtn.addEventListener('click', closeHandler);

    // 5. 확정 및 적용 버튼
    const confirmBtn = this.container.querySelector('#btn-preset-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        // BalanceModifierManager에 적용
        balanceModifierManager.setPreset(this.currentPresetId);
        balanceModifierManager.setCustomOverrides(this.customOverrides);

        const finalConfig = balanceModifierManager.getActiveConfig();

        if (typeof this.onConfirmCallback === 'function') {
          this.onConfirmCallback(finalConfig);
        }

        this.close();
      });
    }
  }
}
