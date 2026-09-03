/**
 * @module TextureManager
 * @category renderer
 * @description 나노바나나(Imagen) 생성 5대 던전 테마 텍스처 및 바닥재 비동기 로딩,
 *              동적 온디맨드 로딩, 캐싱 및 절차적 캔버스 패턴 폴백 가드 매니저
 * @purity State Store / Pure Loader
 * @dependencies DungeonThemeConfig.js, EventBus.js
 * @exports TextureManager, textureManager, TEXTURE_PATHS, resolveTexturePath
 */

import { DUNGEON_THEMES, DUNGEON_THEME_KEYS } from '../configs/DungeonThemeConfig.js';
import { eventBus } from '../events/EventBus.js';

export const TEXTURE_FILENAMES = Object.freeze({
  CAVE_RUINS: 'tex_cave_ruins.jpg',
  MINES_CATACOMBS: 'tex_catacombs.jpg',
  VOLCANIC_FORTRESS: 'tex_volcanic.jpg',
  DARK_ABYSS: 'tex_dark_abyss.jpg',
  DEEP_ANGBAND: 'tex_deep_angband.jpg',
  COMMON_FLOOR: 'tex_dungeon_floor.jpg'
});

/**
 * 런타임 환경(로컬 서버, 서브디렉토리 포크, 깃허브 페이지스)에 맞춘 범용 텍스처 URL 리졸버
 * @param {string} filename 
 * @returns {string} 해석된 텍스처 경로 URL
 */
export function resolveTexturePath(filename) {
  const cleanName = String(filename || '').replace(/^.*[\\/]/, '');
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      const url = new URL(`../../public/textures/${cleanName}`, import.meta.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href;
      }
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname || '';
    if (pathname.includes('/fork_experimental')) {
      return `../public/textures/${cleanName}`;
    }
    return `./public/textures/${cleanName}`;
  }
  return `/public/textures/${cleanName}`;
}

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
    this.loadingPromises = new Map();
    this.fallbackTextures = new Map();
    this.isLoaded = false;
    this._initFallbacks();

    // 브라우저 런타임 환경 시 생성과 동시에 비동기 프리로드 자동 격발
    if (typeof window !== 'undefined' || typeof Image !== 'undefined') {
      this.loadAll().catch((err) => {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[TextureManager] Preload note:', err?.message || err);
        }
      });
    }
  }

  /**
   * 고품질 절차적 64x64 캔버스 폴백 텍스처 초기화 (네트워크 로드 전 또는 오류/오프라인 시 즉각 방어)
   */
  _initFallbacks() {
    for (const key of Object.keys(TEXTURE_FILENAMES)) {
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          if (key === 'CAVE_RUINS') {
            ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
            // 벽돌 석조 패턴
            ctx.strokeRect(0, 0, 64, 32);
            ctx.strokeRect(0, 32, 64, 32);
            ctx.strokeRect(32, 0, 32, 32);
            ctx.fillStyle = '#64748b'; ctx.fillRect(4, 4, 24, 8);
          } else if (key === 'MINES_CATACOMBS') {
            ctx.fillStyle = '#3f3f46'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, 60, 60);
            ctx.strokeRect(16, 16, 32, 32);
            ctx.fillStyle = '#a1a1aa'; ctx.font = '16px monospace'; ctx.fillText('💀', 22, 38);
          } else if (key === 'VOLCANIC_FORTRESS') {
            ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, 60, 60);
            ctx.fillStyle = '#b91c1c'; ctx.fillRect(12, 12, 40, 40);
            ctx.fillStyle = '#f97316'; ctx.fillRect(20, 20, 24, 24);
          } else if (key === 'DARK_ABYSS') {
            ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
            ctx.strokeRect(4, 4, 56, 56);
            ctx.fillStyle = '#581c87'; ctx.fillRect(18, 18, 28, 28);
          } else if (key === 'DEEP_ANGBAND') {
            ctx.fillStyle = '#450a0a'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, 60, 60);
            ctx.fillStyle = '#7f1d1d'; ctx.fillRect(14, 14, 36, 36);
          } else {
            // COMMON_FLOOR
            ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 32, 32);
            ctx.strokeRect(32, 0, 32, 32);
            ctx.strokeRect(0, 32, 32, 32);
            ctx.strokeRect(32, 32, 32, 32);
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
   * 단일 테마 텍스처 온디맨드 로딩 및 캐싱
   */
  _loadSingleTexture(key, customUrl = null) {
    if (this.textures.has(key)) {
      return Promise.resolve(this.textures.get(key));
    }
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    const url = customUrl || TEXTURE_PATHS[key] || resolveTexturePath(TEXTURE_FILENAMES[key] || `${key.toLowerCase()}.jpg`);
    const promise = new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        const fallback = this.fallbackTextures.get(key) || this.fallbackTextures.get('CAVE_RUINS');
        this.textures.set(key, fallback);
        return resolve(fallback);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        this.textures.set(key, img);
        this.loadingPromises.delete(key);
        if (typeof eventBus !== 'undefined' && eventBus.emit) {
          eventBus.emit('TEXTURE_LOADED', { key, url, width: img.naturalWidth, height: img.naturalHeight });
        }
        resolve(img);
      };

      img.onerror = () => {
        // 1차 상대 경로 재시도 (fallback relative path)
        const altUrl = url.startsWith('/') ? `.${url}` : `/${url.replace(/^\.\//, '')}`;
        const retryImg = new Image();
        retryImg.onload = () => {
          this.textures.set(key, retryImg);
          this.loadingPromises.delete(key);
          if (typeof eventBus !== 'undefined' && eventBus.emit) {
            eventBus.emit('TEXTURE_LOADED', { key, url: altUrl, width: retryImg.naturalWidth, height: retryImg.naturalHeight });
          }
          resolve(retryImg);
        };
        retryImg.onerror = () => {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[TextureManager] 텍스처 로드 최종 실패: ${url} (및 ${altUrl}). 고품질 절차적 폴백 패턴 사용.`);
          }
          const fallback = this.fallbackTextures.get(key) || this.fallbackTextures.get('CAVE_RUINS');
          this.textures.set(key, fallback);
          this.loadingPromises.delete(key);
          resolve(fallback);
        };
        retryImg.src = altUrl;
      };

      img.src = url;
    });

    this.loadingPromises.set(key, promise);
    return promise;
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

    const loadPromises = Object.keys(TEXTURE_FILENAMES).map((key) => {
      return this._loadSingleTexture(key);
    });

    await Promise.all(loadPromises);
    this.isLoaded = true;
  }

  /**
   * 특정 던전 테마의 벽면 텍스처 이미지를 반환합니다.
   * 캐시 미적중 시 즉각적인 백그라운드 로드를 발동하고 폴백을 반환합니다.
   * @param {string} themeKey 
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getWallTexture(themeKey) {
    const key = themeKey || 'CAVE_RUINS';
    if (!this.textures.has(key)) {
      this._loadSingleTexture(key);
      return this.fallbackTextures.get(key) || this.fallbackTextures.get('CAVE_RUINS');
    }
    return this.textures.get(key);
  }

  /**
   * 공통 바닥재 텍스처를 반환합니다.
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getFloorTexture() {
    const key = 'COMMON_FLOOR';
    if (!this.textures.has(key)) {
      this._loadSingleTexture(key);
      return this.fallbackTextures.get(key);
    }
    return this.textures.get(key);
  }
}

export const textureManager = new TextureManager();
