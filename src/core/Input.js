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
    
    // Code mapping for physical key disambiguation (Top row digits for skills, Numpad for 8-way movement)
    this.codeMap = {
      'Digit1': 'SKILL_1',
      'Digit2': 'SKILL_2',
      'Digit3': 'SKILL_3',
      'Digit4': 'SKILL_4',
      'Numpad1': 'MOVE_SW',
      'Numpad2': 'MOVE_S',
      'Numpad3': 'MOVE_SE',
      'Numpad4': 'MOVE_W',
      'Numpad5': 'WAIT',
      'Numpad6': 'MOVE_E',
      'Numpad7': 'MOVE_NW',
      'Numpad8': 'MOVE_N',
      'Numpad9': 'MOVE_NE'
    };

    // Key mapping to abstract actions
    this.keyMap = {
      // Arrow keys (4-way)
      'ArrowUp': 'MOVE_N',
      'ArrowRight': 'MOVE_E',
      'ArrowDown': 'MOVE_S',
      'ArrowLeft': 'MOVE_W',
      
      // WASD (4-way fallback)
      'w': 'MOVE_N',
      'W': 'MOVE_N',
      'd': 'MOVE_E',
      'D': 'MOVE_E',
      's': 'MOVE_S',
      'S': 'MOVE_S',
      'a': 'MOVE_W',
      'A': 'MOVE_W',

      // Vi keys (8-way)
      'k': 'MOVE_N',
      'K': 'MOVE_N',
      'u': 'MOVE_NE',
      'U': 'MOVE_NE',
      'l': 'MOVE_E',
      'L': 'MOVE_E',
      'n': 'MOVE_SE',
      'N': 'MOVE_SE',
      'j': 'MOVE_S',
      'J': 'MOVE_S',
      'b': 'MOVE_SW',
      'B': 'MOVE_SW',
      'h': 'MOVE_W',
      'H': 'MOVE_W',
      'y': 'MOVE_NW',
      'Y': 'MOVE_NW',
      '.': 'WAIT',

      // Other actions
      'i': 'INVENTORY',
      'I': 'INVENTORY',
      'c': 'COMBAT_LOG',
      'C': 'COMBAT_LOG',
      'e': 'INTERACT',
      'E': 'INTERACT',
      'Enter': 'INTERACT',
      't': 'AUTOFIRE',
      'T': 'AUTOFIRE'
    };

    window.addEventListener('keydown', (e) => {
      const action = (e.code && this.codeMap[e.code]) || this.keyMap[e.key];
      if (action) {
        this.activeActions.add(action);
      }
    });

    window.addEventListener('keyup', (e) => {
      const action = (e.code && this.codeMap[e.code]) || this.keyMap[e.key];
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
