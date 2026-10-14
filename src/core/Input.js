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
      'Numpad9': 'MOVE_NE',
      'KeyQ': 'CAMERA_LEFT',
      'KeyE': 'CAMERA_RIGHT',
      'KeyR': 'REST',
      'KeyF': 'FIRE',
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

      // Vi keys (8-way: y, u, h, j, k, l, b, n)
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

      // Camera turns
      'q': 'CAMERA_LEFT',
      'Q': 'CAMERA_LEFT',
      'e': 'CAMERA_RIGHT',
      'E': 'CAMERA_RIGHT',

      // Rest & Wait
      '.': 'WAIT',
      'r': 'REST',
      'R': 'REST',

      // Stairs
      '>': 'STAIRS_DOWN',
      '<': 'STAIRS_UP',
      'Period': 'STAIRS_DOWN',
      'Comma': 'STAIRS_UP',

      // Ranged Fire
      'f': 'FIRE',
      'F': 'FIRE',
      't': 'AUTOFIRE',
      'T': 'AUTOFIRE',

      // Other actions
      'i': 'INVENTORY',
      'I': 'INVENTORY',
      'c': 'COMBAT_LOG',
      'C': 'COMBAT_LOG',
      'Enter': 'INTERACT',
      'F8': 'TOGGLE_RENDER_MODE'
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        const action = this.resolveAction(e);
        if (action) {
          this.activeActions.add(action);
        }
      });

      window.addEventListener('keyup', (e) => {
        const action = this.resolveAction(e);
        if (action) {
          this.activeActions.delete(action);
        }
      });
    }
  }

  resolveAction(e) {
    if (!e) return null;
    if (e.key === '>' || e.key === 'Period') return 'STAIRS_DOWN';
    if (e.key === '<' || e.key === 'Comma') return 'STAIRS_UP';
    if (e.key === '.') return 'WAIT';
    if (e.code === 'Period' && e.shiftKey) return 'STAIRS_DOWN';
    if (e.code === 'Comma' && e.shiftKey) return 'STAIRS_UP';
    if (e.code && this.codeMap[e.code]) return this.codeMap[e.code];
    if (e.key && this.keyMap[e.key]) return this.keyMap[e.key];
    if (e.code === 'Period') return 'STAIRS_DOWN';
    if (e.code === 'Comma') return 'STAIRS_UP';
    return null;
  }

  // Called by VirtualController
  triggerVirtualAction(action) {
    this.activeActions.add(action);
  }

  releaseVirtualAction(action) {
    this.activeActions.delete(action);
  }

  isActionActive(action) {
    if (this.activeActions.has(action)) return true;
    if ((action === 'TURN_LEFT' || action === 'CAMERA_LEFT') && (this.activeActions.has('CAMERA_LEFT') || this.activeActions.has('TURN_LEFT'))) return true;
    if ((action === 'TURN_RIGHT' || action === 'CAMERA_RIGHT') && (this.activeActions.has('CAMERA_RIGHT') || this.activeActions.has('TURN_RIGHT'))) return true;
    if ((action === 'RANGED_FIRE' || action === 'FIRE') && (this.activeActions.has('FIRE') || this.activeActions.has('RANGED_FIRE'))) return true;
    if (action === 'REST' && this.activeActions.has('REST')) return true;
    if (action === 'WAIT' && this.activeActions.has('WAIT')) return true;
    if (action === 'STAIRS_DOWN' && this.activeActions.has('STAIRS_DOWN')) return true;
    if (action === 'STAIRS_UP' && this.activeActions.has('STAIRS_UP')) return true;
    return false;
  }

  clear() {
    this.activeActions.clear();
  }
}
