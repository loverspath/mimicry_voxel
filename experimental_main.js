/**
 * @module ExperimentalEntryPoint
 * @category root
 * @description 미미크리 복셀 차세대 실험적 버전 진입점. 동적 밸런스 프리셋 엔진, 4대 스킬 플로팅 핫바, HUD 실시간 상태 칩 및 위기 비네팅 펄스 통합 오케스트레이션.
 * @dependencies Game.js, VirtualController.js, SkillHotbarView.js, GameStartPresetModalView.js, BalanceModifierManager.js, EventBus.js, GameEvents.js, PlayerIdentityModalView.js
 * @exports experimentalInit
 */

import { Game } from './src/core/Game.js';
import { VirtualController } from './src/ui/VirtualController.js';
import { SkillHotbarView } from './src/ui/SkillHotbarView.js';
import { GameStartPresetModalView } from './src/ui/GameStartPresetModalView.js';
import { PlayerIdentityModalView } from './src/ui/PlayerIdentityModalView.js';
import { balanceModifierManager } from './src/systems/BalanceModifierManager.js';
import { eventBus } from './src/events/EventBus.js';
import { GameEvents } from './src/events/GameEvents.js';

// 전역 에러 배너 핸들러
function showCrashBanner(errorMsg, source, lineno, colno, error) {
  console.error("[GLOBAL ERROR CAUGHT]", { errorMsg, source, lineno, colno, error });
  let banner = document.getElementById('global-crash-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'global-crash-banner';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
      background: rgba(220, 38, 38, 0.95); color: #ffffff;
      padding: 0.75rem 1rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-size: 0.8rem;
      border-bottom: 2px solid #ef4444; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      display: flex; flex-direction: column; gap: 0.3rem;
      backdrop-filter: blur(8px);
    `;
    if (document.body) {
      document.body.prepend(banner);
    }
  }

  const stack = error && error.stack ? error.stack.split('\n').slice(0, 4).join('\n') : '';
  const file = source ? source.split('/').pop() : 'script';

  banner.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-weight:bold; font-size:0.85rem;">🚨 [실험적 빌드 런타임 에러]</span>
      <div>
        <button onclick="location.reload();" style="background:rgba(0,0,0,0.3); border:1px solid #fff; color:#fff; border-radius:4px; padding:0.2rem 0.5rem; cursor:pointer; font-size:0.75rem;">새로고침</button>
        <button onclick="this.closest('#global-crash-banner').remove();" style="background:transparent; border:none; color:#fff; font-size:1rem; cursor:pointer; margin-left:0.5rem;">✕</button>
      </div>
    </div>
    <div style="word-break:break-all; font-size:0.75rem; opacity:0.95;"><b>메시지:</b> ${errorMsg} (${file}:${lineno || 0})</div>
    ${stack ? `<pre style="margin:0; font-size:0.68rem; opacity:0.85; max-height:80px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:0.3rem 0.5rem; border-radius:4px; white-space:pre-wrap;">${stack}</pre>` : ''}
  `;
}

window.onerror = function (message, source, lineno, colno, error) {
  showCrashBanner(message, source, lineno, colno, error);
  return false;
};

window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason || {};
  showCrashBanner(reason.message || String(reason), reason.fileName || '', reason.lineNumber || 0, 0, reason);
});

/**
 * 차세대 UI/UX 실험적 엔진 초기화 함수
 */
export function experimentalInit() {
  try {
    const game = new Game();
    const virtualController = new VirtualController(game.input);

    // 1. 4대 스킬 플로팅 핫바 뷰 초기화
    const skillHotbar = new SkillHotbarView('skill-hotbar-container');
    skillHotbar.init(document.getElementById('game-container') || document.body);

    // 스킬 원터치 격발 콜백
    skillHotbar.setOnSkillTrigger((slotNum) => {
      if (!game.player || game.isMainMenuOpen || game.isGameOver) return;
      const castSuccess = game.player.castActiveSkill(slotNum, game);
      if (castSuccess) {
        // 턴 진행 및 몬스터 턴 시뮬레이션
        game.playerTurn = false;
        game.update();
        game.updateUI();
        game.render();
      }
    });

    // 2. 동적 밸런스 프리셋 모달 뷰 초기화
    const presetModal = new GameStartPresetModalView('game-start-preset-modal-root');
    presetModal.init(document.body);

    // 2-B. 플레이어 아이덴티티 & 특성 매트릭스 모달 초기화
    const identityModal = new PlayerIdentityModalView('player-identity-modal');
    identityModal.init(document.body);

    const openIdentityModal = () => {
      if (game.player) identityModal.open(game.player);
    };

    const identityBtn = document.getElementById('btn-player-identity');
    if (identityBtn) identityBtn.onclick = openIdentityModal;

    // 단축키 'C' (또는 'c') 지원
    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        if (!identityModal.modalEl || identityModal.modalEl.classList.contains('hidden')) {
          openIdentityModal();
        } else {
          identityModal.close();
        }
      }
    });

    // 3. 상단바 프리셋 인디케이터 배지 갱신 로직
    const updatePresetBadge = () => {
      const activeCfg = balanceModifierManager.getActiveConfig();
      const badgeBtn = document.getElementById('ui-preset-badge');
      const labelEl = document.getElementById('ui-preset-label');
      const dotEl = badgeBtn ? badgeBtn.querySelector('.preset-dot') : null;

      if (badgeBtn && activeCfg) {
        const shortId = activeCfg.presetId ? activeCfg.presetId.replace('_', ' ') : 'CLASSIC';
        if (labelEl) labelEl.textContent = `📜 ${shortId}`;
        badgeBtn.style.borderColor = activeCfg.badgeColor || '#38bdf8';
        badgeBtn.style.color = activeCfg.badgeColor || '#38bdf8';
        if (dotEl) dotEl.style.background = activeCfg.badgeColor || '#38bdf8';
      }
    };

    updatePresetBadge();

    // 4. 프리셋 모달 오픈 버튼 이벤트 바인딩
    const openPresetModal = () => presetModal.open();

    const badgeBtn = document.getElementById('ui-preset-badge');
    if (badgeBtn) badgeBtn.onclick = openPresetModal;

    const quickPresetBtn = document.getElementById('btn-balance-preset-quick');
    if (quickPresetBtn) quickPresetBtn.onclick = openPresetModal;

    const optionsPresetBtn = document.getElementById('btn-open-preset-from-options');
    if (optionsPresetBtn) optionsPresetBtn.onclick = openPresetModal;

    const menuPresetBtn = document.getElementById('menu-preset-config-btn');
    if (menuPresetBtn) menuPresetBtn.onclick = openPresetModal;

    // 5. EventBus 밸런스 변경 수신
    if (typeof eventBus !== 'undefined' && eventBus) {
      const evName = (GameEvents && GameEvents.BALANCE_CONFIG_CHANGED) ? GameEvents.BALANCE_CONFIG_CHANGED : 'BALANCE_CONFIG_CHANGED';
      eventBus.on(evName, (payload) => {
        updatePresetBadge();
        if (game && typeof game.addLogEntry === 'function' && payload?.config) {
          game.addLogEntry(`⚖️ [밸런스 모디파이어] ${payload.config.name} 설정이 적용되었습니다.`, 'system');
        }
      });
    }

    // 6. 실시간 상태이상 칩 바 갱신 함수
    const updateStatusChips = (player) => {
      const container = document.getElementById('hud-status-chips-bar');
      if (!container || !player) return;

      const chips = [];

      // A. 플레이어 실시간 상태이상 (statuses)
      if (player.statuses && typeof player.statuses === 'object') {
        for (const [key, st] of Object.entries(player.statuses)) {
          if (st && (st.duration > 0 || st.stacks > 0)) {
            const icon = st.icon || '⚡';
            const name = st.name || key;
            const dur = st.duration ? `${st.duration}T` : `${st.stacks}S`;
            const isBuff = !['POISON', 'BLEEDING', 'STUN', 'BLIND', 'SLOW', 'CONFUSION'].includes(key.toUpperCase());
            const chipClass = isBuff ? 'buff' : 'debuff';
            chips.push(`
              <span class="status-chip ${chipClass}" title="${name} (${dur})">
                <span>${icon}</span>
                <span>${name}</span>
                <span style="opacity: 0.8; font-size: 0.65rem;">${dur}</span>
              </span>
            `);
          }
        }
      }

      // B. 플레이어 디버프 (debuffs)
      if (player.debuffs && typeof player.debuffs === 'object') {
        for (const [key, val] of Object.entries(player.debuffs)) {
          if (val && !chips.some(c => c.includes(key))) {
            chips.push(`
              <span class="status-chip debuff" title="디버프: ${key}">
                <span>⚠️</span>
                <span>${key}</span>
              </span>
            `);
          }
        }
      }

      container.innerHTML = chips.join('');
    };

    // 7. 저체력 위기 비네팅 펄스 갱신 함수
    const updateLowHpVignette = (player) => {
      const vignette = document.getElementById('low-hp-vignette');
      if (!vignette || !player || !player.stats) return;

      const hp = player.stats.hp || 0;
      const maxHp = player.stats.maxHp || 1;
      const ratio = hp / maxHp;

      if (ratio <= 0.15 && hp > 0) {
        vignette.className = 'low-hp-vignette active critical';
      } else if (ratio <= 0.30 && hp > 0) {
        vignette.className = 'low-hp-vignette active';
      } else {
        vignette.className = 'low-hp-vignette';
      }
    };

    // 8. 기존 game.updateUI 가로채기 (Monkey-patching with original call)
    const origUpdateUI = game.updateUI.bind(game);
    game.updateUI = function () {
      origUpdateUI();
      if (this.player) {
        skillHotbar.update(this.player);
        updateStatusChips(this.player);
        updateLowHpVignette(this.player);
        updatePresetBadge();
      }
    };

    // 9. 전역 참조 노출
    window.__game = game;
    window.__balanceModifierManager = balanceModifierManager;
    window.__presetModal = presetModal;
    window.__skillHotbar = skillHotbar;
    window.__identityModal = identityModal;

    // 10. 게임 루프 기동
    game.start();

    // 초기 UI 동기화
    if (game.player) {
      skillHotbar.update(game.player);
      updateStatusChips(game.player);
      updateLowHpVignette(game.player);
    }
  } catch (err) {
    showCrashBanner(err.message, err.fileName || 'experimental_main.js', err.lineNumber || 0, 0, err);
  }
}

// 브라우저 로드 시 자동 기동
if (typeof window !== 'undefined') {
  window.addEventListener('load', experimentalInit);
}
