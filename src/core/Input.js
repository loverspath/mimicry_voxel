/**
 * @module Input
 * @category core
 * @description 키보드(화살표, WASD, 넘패드), 마우스 및 가상 패드 입력을 추상화된 게임 액션으로 매핑하고 발송하는 입력 제어 모듈
 * @purity DOM Event Handler
 * @dependencies none
 * @exports Input
 */

export class Input {
  constructor() {
    this.activeActions = new Set();
    
    // Key mapping to abstract actions
    this.keyMap = {
      // Arrow keys (4-way)
      'ArrowUp': 'MOVE_N',
      'ArrowRight': 'MOVE_E',
      'ArrowDown': 'MOVE_S',
      'ArrowLeft': 'MOVE_W',
      
      // WASD (4-way fallback)
      'w': 'MOVE_N',
      'd': 'MOVE_E',
      's': 'MOVE_S',
      'a': 'MOVE_W',
      
      // Numpad (8-way)
      '8': 'MOVE_N',
      '9': 'MOVE_NE',
      '6': 'MOVE_E',
      '3': 'MOVE_SE',
      '2': 'MOVE_S',
      '1': 'MOVE_SW',
      '4': 'MOVE_W',
      '7': 'MOVE_NW',
      '5': 'WAIT',

      // Vi keys (8-way)
      'k': 'MOVE_N',
      'u': 'MOVE_NE',
      'l': 'MOVE_E',
      'n': 'MOVE_SE',
      'j': 'MOVE_S',
      'b': 'MOVE_SW',
      'h': 'MOVE_W',
      'y': 'MOVE_NW',
      '.': 'WAIT',

      // Other actions
      'i': 'INVENTORY',
      'c': 'COMBAT_LOG',
      'e': 'INTERACT',
      'Enter': 'INTERACT',
      't': 'AUTOFIRE',
      'T': 'AUTOFIRE'
    };

    window.addEventListener('keydown', (e) => {
      const action = this.keyMap[e.key];
      if (action) {
        this.activeActions.add(action);
      }
    });

    window.addEventListener('keyup', (e) => {
      const action = this.keyMap[e.key];
      if (action) {
        this.activeActions.delete(action);
      }
    });
  }

  // Called by VirtualController
  triggerVirtualAction(action) {
    this.activeActions.add(action);
  }

  releaseVirtualAction(action) {
    this.activeActions.delete(action);
  }

  isActionActive(action) {
    return this.activeActions.has(action);
  }

  clear() {
    this.activeActions.clear();
  }
}
