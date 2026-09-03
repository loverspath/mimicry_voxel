/**
 * @module EntryPoint
 * @description Mimicry Roguelike 게임의 최종 진입점(Entry Point). DOM 로드가 완료되면 Game 인스턴스와 터치용 VirtualController를 초기화하고 기동합니다.
 * @dependency Game.js, VirtualController.js
 */
import { Game } from './src/core/Game.js';
import { VirtualController } from './src/ui/VirtualController.js';
import { GameStartPresetModalView } from './src/ui/GameStartPresetModalView.js';
import { balanceModifierManager } from './src/systems/BalanceModifierManager.js';

// 전역 에러 핸들러 및 화면 상단 크래시 배너 장착
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
      <span style="font-weight:bold; font-size:0.85rem;">🚨 [런타임 에러 감지]</span>
      <div>
        <button id="btn-copy-crash" style="background:rgba(0,0,0,0.3); border:1px solid #fff; color:#fff; border-radius:4px; padding:0.2rem 0.5rem; cursor:pointer; font-size:0.75rem; margin-right:0.3rem;">에러 복사</button>
        <button onclick="location.reload();" style="background:rgba(0,0,0,0.3); border:1px solid #fff; color:#fff; border-radius:4px; padding:0.2rem 0.5rem; cursor:pointer; font-size:0.75rem;">새로고침</button>
        <button onclick="this.closest('#global-crash-banner').remove();" style="background:transparent; border:none; color:#fff; font-size:1rem; cursor:pointer; margin-left:0.5rem;">✕</button>
      </div>
    </div>
    <div style="word-break:break-all; font-size:0.75rem; opacity:0.95;"><b>메시지:</b> ${errorMsg} (${file}:${lineno || 0})</div>
    ${stack ? `<pre style="margin:0; font-size:0.68rem; opacity:0.85; max-height:80px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:0.3rem 0.5rem; border-radius:4px; white-space:pre-wrap;">${stack}</pre>` : ''}
  `;

  const copyBtn = document.getElementById('btn-copy-crash');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const fullText = `${errorMsg}\nLocation: ${file}:${lineno}\nStack:\n${stack}`;
      navigator.clipboard.writeText(fullText).then(() => {
        copyBtn.innerText = "복사 완료!";
      });
    };
  }

  if (window.__game && window.__game.addLogEntry) {
    window.__game.addLogEntry(`[Error] 🚨 ${errorMsg}`, `danger`);
  }
}

window.showCrashBanner = showCrashBanner;

window.onerror = function (message, source, lineno, colno, error) {
  showCrashBanner(message, source, lineno, colno, error);
  return false;
};

window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason || {};
  showCrashBanner(reason.message || String(reason), reason.fileName || '', reason.lineNumber || 0, 0, reason);
});

// Initialize the game when the window loads
window.addEventListener('load', () => {
  try {
    const game = new Game();
    const virtualController = new VirtualController(game.input);
    window.__game = game; // Expose for inline HTML button handlers (breath element selector)

    // 동적 밸런스 프리셋 모달 연동
    const presetModal = new GameStartPresetModalView('game-start-preset-modal-root');
    presetModal.init();
    presetModal.onConfirm((presetId, overrides) => {
      balanceModifierManager.applyPreset(presetId, overrides);
      if (game.addLogEntry) {
        game.addLogEntry(`⚖️ [밸런스 변경] ${balanceModifierManager.getPresetName()} 프리셋 적용 완료`, 'system');
      }
    });

    const balanceBtn = document.getElementById('btn-balance-preset-quick');
    if (balanceBtn) {
      balanceBtn.addEventListener('click', () => {
        presetModal.open(balanceModifierManager.currentPresetId, balanceModifierManager.customOverrides);
      });
    }

    game.start();
  } catch (err) {
    showCrashBanner(err.message, err.fileName || 'Game.js', err.lineNumber || 0, 0, err);
  }
});
