/**
 * @module SkillHotbarView
 * @category ui
 * @description 화면 하단 상시 노출 4대 의태 액티브 스킬 핫바 및 실시간 쿨다운 방사형 애니메이션/원터치 격발 렌더러
 * @purity DOM Renderer
 * @dependencies EventBus.js, GameEvents.js
 * @exports SkillHotbarView, renderSkillHotbarHTML
 */

import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';

/**
 * 플레이어의 4대 액티브 스킬 슬롯 HTML 마크업을 순수 문자열로 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} 생성된 HTML 마크업
 */
export function renderSkillHotbarHTML(player) {
  if (!player) return '<div class="skill-hotbar-empty">스킬 정보 없음</div>';

  const skills = player.getInnateSkills ? player.getInnateSkills() : (player.activeSkills || []);
  const coreKey = player.mimicCore?.coreType || player.mimicCore?.name || 'MON_NOVICE_WARRIOR';
  const masteryLvl = player.getMorphMasteryLevel ? player.getMorphMasteryLevel(coreKey) : 1;

  let slotsHtml = '';

  for (let i = 0; i < 4; i++) {
    const slotNum = i + 1;
    const skill = skills[i];

    if (!skill) {
      slotsHtml += `
        <div class="skill-slot empty" data-slot="${slotNum}" title="빈 스킬 슬롯 ${slotNum}">
          <span class="slot-num-badge">${slotNum}</span>
          <span class="slot-empty-icon">·</span>
        </div>
      `;
      continue;
    }

    const isUnlocked = typeof skill.isUnlocked === 'function' ? skill.isUnlocked(masteryLvl) : true;
    const currentCd = player.getTracker ? player.getTracker(skill.id, 'cooldown') : (skill.currentCooldown || 0);
    const maxCd = typeof skill.getEffectiveCooldown === 'function' ? skill.getEffectiveCooldown(masteryLvl) : (skill.cooldown || 1);
    const isReady = isUnlocked && currentCd <= 0;

    let slotClasses = `skill-slot slot-${slotNum}`;
    let overlayHtml = '';

    if (!isUnlocked) {
      slotClasses += ' locked';
      overlayHtml = `
        <div class="slot-lock-overlay" title="숙련도 Lv.${skill.requiredMastery} 필요">
          <span class="lock-icon">🔒</span>
          <span class="req-lvl">Lv.${skill.requiredMastery}</span>
        </div>
      `;
    } else if (currentCd > 0) {
      slotClasses += ' on-cooldown';
      const cdPercentage = Math.min(100, Math.max(0, Math.round((currentCd / maxCd) * 100)));
      overlayHtml = `
        <div class="slot-cooldown-overlay" style="--cd-pct: ${cdPercentage}%;">
          <div class="cd-radial-sweep" style="background: conic-gradient(rgba(15, 23, 42, 0.85) ${cdPercentage}%, transparent 0%);"></div>
          <span class="cd-number">${currentCd}</span>
        </div>
      `;
    } else {
      slotClasses += ' ready';
    }

    const color = skill.color || '#38bdf8';
    const icon = skill.icon || '⚡';
    const tooltipText = `${skill.name} [단축키: ${slotNum}] - ${skill.desc || ''} (쿨다운: ${maxCd}턴, 사거리: ${skill.maxRange || 1}칸)`;

    slotsHtml += `
      <button type="button" class="${slotClasses}" data-slot="${slotNum}" data-skill-id="${skill.id}" title="${tooltipText}" style="--skill-accent: ${color};">
        <span class="slot-num-badge">${slotNum}</span>
        <span class="skill-icon">${icon}</span>
        <span class="skill-name-mini">${skill.name}</span>
        ${overlayHtml}
        <div class="slot-glow-halo"></div>
      </button>
    `;
  }

  return `
    <div class="skill-hotbar-wrapper" role="toolbar" aria-label="액티브 의태 스킬 핫바">
      <div class="skill-hotbar-slots">
        ${slotsHtml}
      </div>
    </div>
  `;
}

export class SkillHotbarView {
  /**
   * @param {string} [containerId='skill-hotbar-container']
   */
  constructor(containerId = 'skill-hotbar-container') {
    this.containerId = containerId;
    this.container = null;
    this.boundHandler = null;
    this.onSkillTriggerCallback = null;
  }

  /**
   * 부모 DOM 노드에 스킬 핫바 컨테이너를 마운트합니다.
   * @param {HTMLElement} [parentEl=document.body]
   */
  init(parentEl = null) {
    if (typeof document === 'undefined') return;
    const parent = parentEl || document.getElementById('game-container') || document.body;

    let existing = document.getElementById(this.containerId);
    if (!existing) {
      this.container = document.createElement('div');
      this.container.id = this.containerId;
      this.container.className = 'skill-hotbar-root';
      parent.appendChild(this.container);
    } else {
      this.container = existing;
    }

    this._setupEvents();
  }

  /**
   * 스킬 클릭/터치 이벤트 리스너를 바인딩합니다.
   * @private
   */
  _setupEvents() {
    if (!this.container) return;

    if (this.boundHandler) {
      this.container.removeEventListener('click', this.boundHandler);
    }

    this.boundHandler = (e) => {
      const slotBtn = e.target.closest('.skill-slot.ready');
      if (!slotBtn) return;
      e.preventDefault();
      e.stopPropagation();

      const slotNum = parseInt(slotBtn.getAttribute('data-slot'), 10);
      const skillId = slotBtn.getAttribute('data-skill-id');

      // 1. 등록된 트리거 콜백 실행
      if (typeof this.onSkillTriggerCallback === 'function') {
        this.onSkillTriggerCallback(slotNum, skillId);
      }

      // 2. EventBus로도 격발 이벤트 전파
      if (typeof eventBus !== 'undefined' && eventBus && typeof eventBus.emit === 'function') {
        const evName = (GameEvents && GameEvents.SKILL_CAST) ? GameEvents.SKILL_CAST : 'SKILL_CAST';
        eventBus.emit(evName, { slot: slotNum, skillId });
      }

      // 3. UI 펄스 애니메이션 적용
      slotBtn.classList.add('skill-cast-pulse');
      setTimeout(() => slotBtn.classList.remove('skill-cast-pulse'), 300);
    };

    this.container.addEventListener('click', this.boundHandler);
  }

  /**
   * 스킬 격발 핸들러 콜백을 등록합니다.
   * @param {Function} callback - (slotNum, skillId) => void
   */
  setOnSkillTrigger(callback) {
    this.onSkillTriggerCallback = callback;
  }

  /**
   * 플레이어의 최신 스킬/쿨다운 상태를 핫바에 실시간 렌더링합니다.
   * @param {Object} player
   * @param {Function} [onSkillTrigger=null]
   */
  update(player, onSkillTrigger = null) {
    if (onSkillTrigger) {
      this.onSkillTriggerCallback = onSkillTrigger;
    }
    if (!this.container) return;
    this.container.innerHTML = renderSkillHotbarHTML(player);
  }

  /**
   * 핫바 표시 여부를 토글합니다.
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }

  /**
   * 리소스 정리 및 이벤트 리스너 해제
   */
  destroy() {
    if (this.container && this.boundHandler) {
      this.container.removeEventListener('click', this.boundHandler);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.boundHandler = null;
    this.onSkillTriggerCallback = null;
  }
}
