/**
 * @module TextureManager
 * @category renderer
 * @description 나노바나나(Imagen) 생성 5대 던전 테마 텍스처 및 바닥재 비동기 로딩,
 *              캐싱 및 절차적 캔버스 패턴 폴백 가드 매니저
 * @purity State Store / Pure Loader
 * @dependencies DungeonThemeConfig.js
 * @exports TextureManager, textureManager, TEXTURE_PATHS
 */

import { DUNGEON_THEMES, DUNGEON_THEME_KEYS } from '../configs/DungeonThemeConfig.js';

export const TEXTURE_PATHS = Object.freeze({
  CAVE_RUINS: '/public/textures/tex_cave_ruins.jpg',
  MINES_CATACOMBS: '/public/textures/tex_catacombs.jpg',
  VOLCANIC_FORTRESS: '/public/textures/tex_volcanic.jpg',
  DARK_ABYSS: '/public/textures/tex_dark_abyss.jpg',
  DEEP_ANGBAND: '/public/textures/tex_deep_angband.jpg',
  COMMON_FLOOR: '/public/textures/tex_dungeon_floor.jpg'
});

export class TextureManager {
  constructor() {
    this.textures = new Map();
    this.fallbackTextures = new Map();
    this.isLoaded = false;
    this._initFallbacks();
  }

  /**
   * 절차적 64x64 캔버스 폴백 텍스처 초기화 (네트워크 로드 전 또는 오류/오프라인 시 즉각 방어)
   */
  _initFallbacks() {
    for (const key of Object.keys(TEXTURE_PATHS)) {
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          if (key === 'CAVE_RUINS') {
            ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 56, 56);
            ctx.fillStyle = '#1e293b'; ctx.fillRect(16, 16, 32, 32);
          } else if (key === 'MINES_CATACOMBS') {
            ctx.fillStyle = '#52525b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#27272a'; ctx.strokeRect(2, 2, 60, 60);
            ctx.fillStyle = '#e4e4e7'; ctx.font = '16px monospace'; ctx.fillText('💀', 22, 38);
          } else if (key === 'VOLCANIC_FORTRESS') {
            ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 60, 60);
            ctx.fillStyle = '#b91c1c'; ctx.fillRect(12, 12, 40, 40);
          } else if (key === 'DARK_ABYSS') {
            ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeRect(4, 4, 56, 56);
            ctx.fillStyle = '#581c87'; ctx.fillRect(18, 18, 28, 28);
          } else if (key === 'DEEP_ANGBAND') {
            ctx.fillStyle = '#450a0a'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 60, 60);
            ctx.fillStyle = '#7f1d1d'; ctx.fillRect(14, 14, 36, 36);
          } else {
            // COMMON_FLOOR
            ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#0f172a'; ctx.strokeRect(1, 1, 62, 62);
            ctx.fillStyle = '#334155'; ctx.fillRect(8, 8, 20, 20);
            ctx.fillRect(36, 36, 20, 20);
          }
        }
        this.fallbackTextures.set(key, canvas);
      } else {
        // Headless Node.js Fallback Stub
        this.fallbackTextures.set(key, { width: 64, height: 64, key, isFallback: true });
      }
    }
  }

  /**
   * 모든 테마 텍스처를 비동기 프리로드합니다.
   * @returns {Promise<void>}
   */
  async loadAll() {
    if (typeof Image === 'undefined') {
      this.isLoaded = true;
      return;
    }

    const loadPromises = Object.entries(TEXTURE_PATHS).map(([key, url]) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          this.textures.set(key, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`[TextureManager] 텍스처 로드 실패: ${url}. 절차적 폴백 패턴을 사용합니다.`);
          this.textures.set(key, this.fallbackTextures.get(key));
          resolve();
        };
      });
    });

    await Promise.all(loadPromises);
    this.isLoaded = true;
  }

  /**
   * 특정 던전 테마의 벽면 텍스처 이미지를 반환합니다.
   * @param {string} themeKey 
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getWallTexture(themeKey) {
    if (!themeKey) return this.fallbackTextures.get('CAVE_RUINS');
    return this.textures.get(themeKey) || this.fallbackTextures.get(themeKey) || this.fallbackTextures.get('CAVE_RUINS');
  }

  /**
   * 공통 바닥재 텍스처를 반환합니다.
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getFloorTexture() {
    return this.textures.get('COMMON_FLOOR') || this.fallbackTextures.get('COMMON_FLOOR');
  }
}

export const textureManager = new TextureManager();
