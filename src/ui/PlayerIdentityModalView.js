/**
 * @module PlayerIdentityModalView
 * @category ui
 * @description 모바일 화면에 최적화된 플레이어 아이덴티티, 6대 스탯 보정치, 14대 원소 저항 매트릭스 및 슬레이/패시브 뷰
 * @purity DOM Renderer
 * @dependencies UnifiedTraitEngine.js, ThemeColors.js
 * @exports PlayerIdentityModalView, renderPlayerIdentityModalHTML
 */

import { UnifiedTraitEngine } from '../systems/UnifiedTraitEngine.js';
import { ELEMENT_COLORS, ELEMENT_PALETTES } from '../configs/ThemeColors.js';

/**
 * 14대 핵심 원소 저항 메타데이터
 */
const RESISTANCE_ELEMENTS = [
  { key: 'FIRE', name: '화염', icon: '🔥', defaultColor: '#ef4444' },
  { key: 'COLD', name: '냉기', icon: '❄️', defaultColor: '#38bdf8' },
  { key: 'ELEC', name: '전격', icon: '⚡', defaultColor: '#eab308' },
  { key: 'ACID', name: '산성', icon: '🧪', defaultColor: '#22c55e' },
  { key: 'POISON', name: '독성', icon: '🤢', defaultColor: '#10b981' },
  { key: 'LIGHT', name: '섬광', icon: '☀️', defaultColor: '#fde047' },
  { key: 'DARK', name: '암흑', icon: '🌑', defaultColor: '#475569' },
  { key: 'NETHER', name: '황천/지옥', icon: '💀', defaultColor: '#a855f7' },
  { key: 'CHAOS', name: '혼돈', icon: '🌀', defaultColor: '#ec4899' },
  { key: 'DISENCHANT', name: '마력해제', icon: '✨', defaultColor: '#818cf8' },
  { key: 'SOUND', name: '음파/굉음', icon: '🔊', defaultColor: '#fbbf24' },
  { key: 'SHARDS', name: '파편/유리', icon: '💎', defaultColor: '#94a3b8' },
  { key: 'NEXUS', name: '시공/넥서스', icon: '🌌', defaultColor: '#c084fc' },
  { key: 'CONFUSION', name: '혼란', icon: '💫', defaultColor: '#f43f5e' }
];

/**
 * 슬레이(Slay) 종족 메타데이터
 */
const SLAY_CATEGORIES = [
  { key: 'ORC', name: '오크 학살 (Slay Orc)', icon: '👺', defaultMult: 'x2.5' },
  { key: 'DRAGON', name: '용 학살 (Slay Dragon)', icon: '🐉', defaultMult: 'x3.0' },
  { key: 'UNDEAD', name: '언데드 퇴마 (Slay Undead)', icon: '💀', defaultMult: 'x2.5' },
  { key: 'DEMON', name: '악마 멸살 (Slay Demon)', icon: '👿', defaultMult: 'x3.5' },
  { key: 'EVIL', name: '사악 징벌 (Slay Evil)', icon: '⚔️', defaultMult: 'x2.0' },
  { key: 'ANIMAL', name: '야수 사냥 (Slay Animal)', icon: '🐺', defaultMult: 'x2.0' }
];

/**
 * 플레이어 아이덴티티 모달 HTML을 생성합니다.
 * @param {Object} player - 플레이어 객체
 * @param {string} [activeTab='STATS'] - 'STATS' | 'RESIST' | 'TRAITS'
 * @returns {string} HTML 마크업 문자열
 */
export function renderPlayerIdentityModalHTML(player, activeTab = 'STATS') {
  if (!player) return '<div class="modal-empty">플레이어 정보가 없습니다.</div>';

  const coreName = player.mimicCore?.name || '인간 여행자';
  const level = player.level || 1;
  const hp = player.stats?.hp || 0;
  const maxHp = player.stats?.maxHp || 1;
  const ac = typeof player.getTotalAC === 'function' ? player.getTotalAC() : (player.stats?.ac || 10);
  const spd = typeof player.getEffectiveSpeed === 'function' ? player.getEffectiveSpeed() : 0;
  const spdText = (spd >= 0 ? `+${spd.toFixed(2)}` : `${spd.toFixed(2)}`);

  // Tab 1: 6대 스탯 카드 렌더링
  const renderStatsTab = () => {
    const statsList = [
      { key: 'str', name: '힘 (STR)', desc: '근접 물리 피해량 및 최대 적재 한도' },
      { key: 'dex', name: '민첩 (DEX)', desc: '명중률, 회피율, 원거리 사격 공격력' },
      { key: 'con', name: '체질 (CON)', desc: '최대 체력(HP) 및 턴당 체력 자연 회복량' },
      { key: 'int', name: '지능 (INT)', desc: '비전 마법 공격력 및 최대 마나 한도' },
      { key: 'wis', name: '지혜 (WIS)', desc: '신성 기도, 상태이상 저항력 및 치유력' },
      { key: 'chr', name: '매력 (CHR)', desc: '상점 거래 할인 및 정수 코어 융합 효율' }
    ];

    const cardsHtml = statsList.map(st => {
      const baseVal = player.baseStats ? (player.baseStats[st.key] || 10) : 10;
      const effectiveVal = typeof player.getEffectiveStat === 'function' ? player.getEffectiveStat(st.key) : (player.stats?.[st.key] || baseVal);
      const bonus = effectiveVal - baseVal;
      const bonusBadge = bonus > 0 
        ? `<span class="stat-bonus-tag positive">+${bonus}</span>`
        : (bonus < 0 ? `<span class="stat-bonus-tag negative">${bonus}</span>` : '');

      const ratio = Math.min(100, Math.max(0, Math.round((effectiveVal / 180) * 100)));

      return `
        <div class="identity-stat-card">
          <div class="stat-card-header">
            <span class="stat-name">${st.name}</span>
            ${bonusBadge}
          </div>
          <div class="stat-val-row">
            <span class="stat-val-main">${effectiveVal}</span>
            <span class="stat-val-sub">/ 베이스: ${baseVal}</span>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width: ${ratio}%;"></div>
          </div>
          <span class="stat-desc-mini">${st.desc}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="identity-stats-grid">
        ${cardsHtml}
      </div>
    `;
  };

  // Tab 2: 14대 원소 저항 매트릭스 렌더링
  const renderResistTab = () => {
    let resistMap = {};
    if (typeof UnifiedTraitEngine !== 'undefined' && typeof UnifiedTraitEngine.getAllElementalResistances === 'function') {
      resistMap = UnifiedTraitEngine.getAllElementalResistances(player);
    }

    const chipsHtml = RESISTANCE_ELEMENTS.map(el => {
      const trait = resistMap[el.key] || { isImmune: false, isResistant: false, isVulnerable: false, resistancePercent: 0 };
      
      let badgeClass = 'neutral';
      let statusText = '0% 기본';
      let icon = '⚠️';

      if (trait.isImmune) {
        badgeClass = 'immune';
        statusText = '100% 면역';
        icon = '👑';
      } else if (trait.isResistant) {
        badgeClass = 'resistant';
        statusText = `${trait.resistancePercent || 50}% 저항`;
        icon = '🛡️';
      } else if (trait.isVulnerable) {
        badgeClass = 'vulnerable';
        statusText = '-50% 취약';
        icon = '💀';
      }

      return `
        <div class="resist-chip-card ${badgeClass}">
          <div class="resist-chip-title">
            <span>${el.icon}</span>
            <b>${el.name}</b>
          </div>
          <div class="resist-badge ${badgeClass}">
            <span>${icon}</span>
            <span>${statusText}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="identity-resist-grid">
        ${chipsHtml}
      </div>
    `;
  };

  // Tab 3: 슬레이 & 패시브 DNA 워크벤치 렌더링
  const renderTraitsTab = () => {
    const activeTags = typeof player.compileActiveTags === 'function' ? player.compileActiveTags() : {};

    // 1. 슬레이 목록
    const slaysHtml = SLAY_CATEGORIES.map(sl => {
      const hasSlay = activeTags[`SLAY_${sl.key}`] || activeTags[`KILL_${sl.key}`];
      const isKill = activeTags[`KILL_${sl.key}`];
      const mult = isKill ? 'x4.0 (완전 멸살)' : (hasSlay ? sl.defaultMult : 'x1.0 (미보유)');
      const badgeStyle = hasSlay ? 'active' : 'inactive';

      return `
        <div class="trait-row ${badgeStyle}">
          <span class="trait-icon">${sl.icon}</span>
          <span class="trait-name">${sl.name}</span>
          <span class="trait-val ${badgeStyle}">${mult}</span>
        </div>
      `;
    }).join('');

    // 2. 상태이상 면역
    const immunities = [
      { key: 'FREE_ACT', name: '마비/기절 면역 (Free Action)', icon: '🛡️' },
      { key: 'SEE_INVIS', name: '투명체 감지 (See Invisible)', icon: '👁️' },
      { key: 'TELEPATHY', name: '전뇌 텔레파시 (Telepathy)', icon: '🧠' },
      { key: 'REGEN', name: '초자연 재생 (Regeneration)', icon: '❤️' },
      { key: 'FEATHER_FALL', name: '낙하 깃털 (Feather Fall)', icon: '🪶' }
    ];

    const immunitiesHtml = immunities.map(im => {
      const has = !!activeTags[im.key];
      return `
        <div class="immunity-tag ${has ? 'unlocked' : 'locked'}">
          <span>${im.icon}</span>
          <span>${im.name}</span>
          <span class="tag-status">${has ? '활성' : '미보유'}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="identity-traits-container">
        <h4 class="traits-section-title">⚔️ 종족별 슬레이(Slay) 배율</h4>
        <div class="traits-rows-list">
          ${slaysHtml}
        </div>

        <h4 class="traits-section-title" style="margin-top: 1rem;">🛡️ 핵심 상태이상 면역 & 특수 감각</h4>
        <div class="immunities-grid">
          ${immunitiesHtml}
        </div>
      </div>
    `;
  };

  let contentBodyHtml = '';
  if (activeTab === 'RESIST') contentBodyHtml = renderResistTab();
  else if (activeTab === 'TRAITS') contentBodyHtml = renderTraitsTab();
  else contentBodyHtml = renderStatsTab();

  return `
    <div class="identity-modal-sheet glassmorphism-card" role="dialog" aria-labelledby="identity-modal-title">
      <header class="identity-modal-header">
        <div class="identity-header-left">
          <span class="identity-avatar-icon">🧬</span>
          <div>
            <h2 id="identity-modal-title" class="identity-title">${coreName} (Lv.${level})</h2>
            <div class="identity-quick-stats">
              <span>❤️ HP: <b>${hp}/${maxHp}</b></span>
              <span>🛡️ AC: <b>${ac}</b></span>
              <span>⚡ SPD: <b>${spdText}</b></span>
            </div>
          </div>
        </div>
        <button type="button" id="identity-modal-close-btn" class="modal-close-btn" aria-label="닫기">✕</button>
      </header>

      <nav class="identity-tabs-bar" role="tablist">
        <button type="button" class="identity-tab-btn ${activeTab === 'STATS' ? 'active' : ''}" data-tab="STATS">🧬 6대 스탯</button>
        <button type="button" class="identity-tab-btn ${activeTab === 'RESIST' ? 'active' : ''}" data-tab="RESIST">🛡️ 14대 원소 저항</button>
        <button type="button" class="identity-tab-btn ${activeTab === 'TRAITS' ? 'active' : ''}" data-tab="TRAITS">⚔️ 슬레이 & 면역</button>
      </nav>

      <div class="identity-modal-body">
        ${contentBodyHtml}
      </div>
    </div>
  `;
}

export class PlayerIdentityModalView {
  constructor(modalId = 'player-identity-modal') {
    this.modalId = modalId;
    this.currentTab = 'STATS';
    this.modalEl = null;
  }

  init(parentEl = null) {
    if (typeof document === 'undefined') return;
    const parent = parentEl || document.body;

    let existing = document.getElementById(this.modalId);
    if (!existing) {
      this.modalEl = document.createElement('div');
      this.modalEl.id = this.modalId;
      this.modalEl.className = 'identity-modal-mount hidden';
      parent.appendChild(this.modalEl);
    } else {
      this.modalEl = existing;
    }
  }

  open(player) {
    if (!this.modalEl) this.init();
    if (!player) return;
    this.modalEl.classList.remove('hidden');
    this.render(player);
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  switchTab(tab, player) {
    this.currentTab = tab;
    this.render(player);
  }

  render(player) {
    if (!this.modalEl || !player) return;
    this.modalEl.innerHTML = renderPlayerIdentityModalHTML(player, this.currentTab);
    this.bindEvents(player);
  }

  bindEvents(player) {
    if (!this.modalEl) return;
    const closeBtn = this.modalEl.querySelector('#identity-modal-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const tabBtns = this.modalEl.querySelectorAll('.identity-tab-btn');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) this.switchTab(targetTab, player);
      };
    });
  }
}
