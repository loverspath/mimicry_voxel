/**
 * @module VirtualController
 * @category ui
 * @description 모바일/터치 환경을 위한 온스크린 가상 D-패드 및 액션 버튼 이벤트 바인딩 컨트롤러
 * @purity DOM Event Handler
 * @dependencies none
 * @exports VirtualController
 */

export class VirtualController {
  constructor(inputManager) {
    this.inputManager = inputManager;
    this.buttons = document.querySelectorAll('#virtual-controller button[data-action]');
    
    this.bindEvents();
  }

  bindEvents() {
    this.buttons.forEach(btn => {
      const action = btn.getAttribute('data-action');
      
      // Support both touch and mouse for testing on desktop
      const triggerAction = (e) => {
        e.preventDefault(); // Prevent default touch behavior (scrolling/zooming)
        this.inputManager.triggerVirtualAction(action);
      };

      btn.addEventListener('mousedown', triggerAction);
      btn.addEventListener('touchstart', triggerAction, { passive: false });
      
      // We also need to handle release if we want hold-to-move
      const releaseAction = (e) => {
        e.preventDefault();
        this.inputManager.releaseVirtualAction(action);
      };

      btn.addEventListener('mouseup', releaseAction);
      btn.addEventListener('mouseleave', releaseAction);
      btn.addEventListener('touchend', releaseAction, { passive: false });
    });
  }
}
