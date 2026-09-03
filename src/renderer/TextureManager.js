/**
 * @module TextureManager
 * @category renderer
 * @description 나노바나나(Imagen) 생성 5대 던전 테마 벽면, 바닥재 및 천장 텍스처 비동기 로딩,
 *              동적 온디맨드 로딩, 픽셀 버퍼 캐싱 및 90s 레트로 플로어캐스팅 지원 매니저
 * @purity State Store / Pure Loader
 * @dependencies DungeonThemeConfig.js, EventBus.js
 * @exports TextureManager, textureManager, TEXTURE_PATHS, FLOOR_TEXTURE_PATHS, CEILING_TEXTURE_PATHS, resolveTexturePath
 */

import { DUNGEON_THEMES, DUNGEON_THEME_KEYS } from '../configs/DungeonThemeConfig.js';
import { eventBus } from '../events/EventBus.js';

export const WALL_TEXTURE_FILENAMES = Object.freeze({
  CAVE_RUINS: 'tex_cave_ruins.jpg',
  MINES_CATACOMBS: 'tex_catacombs.jpg',
  VOLCANIC_FORTRESS: 'tex_volcanic.jpg',
  DARK_ABYSS: 'tex_dark_abyss.jpg',
  DEEP_ANGBAND: 'tex_deep_angband.jpg'
});

export const FLOOR_TEXTURE_FILENAMES = Object.freeze({
  CAVE_RUINS: 'tex_floor_cave_ruins.jpg',
  MINES_CATACOMBS: 'tex_floor_catacombs.jpg',
  VOLCANIC_FORTRESS: 'tex_floor_volcanic.jpg',
  DARK_ABYSS: 'tex_floor_dark_abyss.jpg',
  DEEP_ANGBAND: 'tex_floor_deep_angband.jpg',
  COMMON_FLOOR: 'tex_dungeon_floor.jpg'
});

export const CEILING_TEXTURE_FILENAMES = Object.freeze({
  CAVE_RUINS: 'tex_ceil_cave_ruins.jpg',
  MINES_CATACOMBS: 'tex_ceil_catacombs.jpg',
  VOLCANIC_FORTRESS: 'tex_ceil_volcanic.jpg',
  DARK_ABYSS: 'tex_ceil_dark_abyss.jpg',
  DEEP_ANGBAND: 'tex_ceil_deep_angband.jpg'
});

export const TEXTURE_FILENAMES = Object.freeze({
  ...WALL_TEXTURE_FILENAMES,
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

export const FLOOR_TEXTURE_PATHS = Object.freeze({
  CAVE_RUINS: '/public/textures/tex_floor_cave_ruins.jpg',
  MINES_CATACOMBS: '/public/textures/tex_floor_catacombs.jpg',
  VOLCANIC_FORTRESS: '/public/textures/tex_floor_volcanic.jpg',
  DARK_ABYSS: '/public/textures/tex_floor_dark_abyss.jpg',
  DEEP_ANGBAND: '/public/textures/tex_floor_deep_angband.jpg',
  COMMON_FLOOR: '/public/textures/tex_dungeon_floor.jpg'
});

export const CEILING_TEXTURE_PATHS = Object.freeze({
  CAVE_RUINS: '/public/textures/tex_ceil_cave_ruins.jpg',
  MINES_CATACOMBS: '/public/textures/tex_ceil_catacombs.jpg',
  VOLCANIC_FORTRESS: '/public/textures/tex_ceil_volcanic.jpg',
  DARK_ABYSS: '/public/textures/tex_ceil_dark_abyss.jpg',
  DEEP_ANGBAND: '/public/textures/tex_ceil_deep_angband.jpg'
});

export const STAIR_TEXTURE_FILENAMES = Object.freeze({
  DOWN: 'tex_stairs_down.jpg',
  UP: 'tex_stairs_up.jpg'
});

export const STAIR_TEXTURE_PATHS = Object.freeze({
  DOWN: '/public/textures/tex_stairs_down.jpg',
  UP: '/public/textures/tex_stairs_up.jpg'
});

export const THEMED_STAIR_DOWN_PATHS = Object.freeze({
  CAVE_RUINS: '/public/textures/tex_stairs_down_cave.jpg',
  MINES_CATACOMBS: '/public/textures/tex_stairs_down_catacombs.jpg',
  VOLCANIC_FORTRESS: '/public/textures/tex_stairs_down_volcanic.jpg',
  DARK_ABYSS: '/public/textures/tex_stairs_down_dark_abyss.jpg',
  DEEP_ANGBAND: '/public/textures/tex_stairs_down_deep_angband.jpg'
});

export const THEMED_STAIR_UP_PATHS = Object.freeze({
  CAVE_RUINS: '/public/textures/tex_stairs_up_cave.jpg',
  MINES_CATACOMBS: '/public/textures/tex_stairs_up_catacombs.jpg',
  VOLCANIC_FORTRESS: '/public/textures/tex_stairs_up_volcanic.jpg',
  DARK_ABYSS: '/public/textures/tex_stairs_up_dark_abyss.jpg',
  DEEP_ANGBAND: '/public/textures/tex_stairs_up_deep_angband.jpg'
});

export const ALL_TEXTURE_REGISTRY = Object.freeze({
  // 벽면 5종
  CAVE_RUINS: 'tex_cave_ruins.jpg',
  MINES_CATACOMBS: 'tex_catacombs.jpg',
  VOLCANIC_FORTRESS: 'tex_volcanic.jpg',
  DARK_ABYSS: 'tex_dark_abyss.jpg',
  DEEP_ANGBAND: 'tex_deep_angband.jpg',

  // 바닥 5종 + 공통 1종
  FLOOR_CAVE_RUINS: 'tex_floor_cave_ruins.jpg',
  FLOOR_MINES_CATACOMBS: 'tex_floor_catacombs.jpg',
  FLOOR_VOLCANIC_FORTRESS: 'tex_floor_volcanic.jpg',
  FLOOR_DARK_ABYSS: 'tex_floor_dark_abyss.jpg',
  FLOOR_DEEP_ANGBAND: 'tex_floor_deep_angband.jpg',
  COMMON_FLOOR: 'tex_dungeon_floor.jpg',

  // 천장 5종
  CEIL_CAVE_RUINS: 'tex_ceil_cave_ruins.jpg',
  CEIL_MINES_CATACOMBS: 'tex_ceil_catacombs.jpg',
  CEIL_VOLCANIC_FORTRESS: 'tex_ceil_volcanic.jpg',
  CEIL_DARK_ABYSS: 'tex_ceil_dark_abyss.jpg',
  CEIL_DEEP_ANGBAND: 'tex_ceil_deep_angband.jpg',

  // 기본 계단 2종
  STAIRS_DOWN: 'tex_stairs_down.jpg',
  STAIRS_UP: 'tex_stairs_up.jpg',

  // 5대 던전 테마별 전용 하행 계단 5종
  STAIRS_DOWN_CAVE_RUINS: 'tex_stairs_down_cave.jpg',
  STAIRS_DOWN_MINES_CATACOMBS: 'tex_stairs_down_catacombs.jpg',
  STAIRS_DOWN_VOLCANIC_FORTRESS: 'tex_stairs_down_volcanic.jpg',
  STAIRS_DOWN_DARK_ABYSS: 'tex_stairs_down_dark_abyss.jpg',
  STAIRS_DOWN_DEEP_ANGBAND: 'tex_stairs_down_deep_angband.jpg',

  // 5대 던전 테마별 전용 상행 계단 5종
  STAIRS_UP_CAVE_RUINS: 'tex_stairs_up_cave.jpg',
  STAIRS_UP_MINES_CATACOMBS: 'tex_stairs_up_catacombs.jpg',
  STAIRS_UP_VOLCANIC_FORTRESS: 'tex_stairs_up_volcanic.jpg',
  STAIRS_UP_DARK_ABYSS: 'tex_stairs_up_dark_abyss.jpg',
  STAIRS_UP_DEEP_ANGBAND: 'tex_stairs_up_deep_angband.jpg'
});

export class TextureManager {
  constructor() {
    this.textures = new Map();
    this.loadingPromises = new Map();
    this.fallbackTextures = new Map();
    this.pixelBuffers = new Map();
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
    for (const key of Object.keys(ALL_TEXTURE_REGISTRY)) {
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          if (key.startsWith('FLOOR_') || key === 'COMMON_FLOOR') {
            // 바닥재 폴백 패턴
            ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 32, 32);
            ctx.strokeRect(32, 0, 32, 32);
            ctx.strokeRect(0, 32, 32, 32);
            ctx.strokeRect(32, 32, 32, 32);
            if (key.includes('VOLCANIC')) {
              ctx.fillStyle = '#7c2d12'; ctx.fillRect(8, 8, 16, 16);
            } else if (key.includes('DARK')) {
              ctx.fillStyle = '#3b0764'; ctx.fillRect(8, 8, 16, 16);
            }
          } else if (key.startsWith('CEIL_')) {
            // 천장 폴백 아치 패턴
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
            ctx.strokeRect(4, 4, 56, 56);
            ctx.beginPath();
            ctx.arc(32, 64, 28, Math.PI, 0);
            ctx.stroke();
          } else if (key === 'STAIRS_DOWN') {
            // 하행 계단 지하 개구부 폴백
            ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
            ctx.strokeRect(4, 4, 56, 56);
            ctx.fillStyle = '#1e293b'; ctx.fillRect(8, 8, 48, 14);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(12, 22, 40, 14);
            ctx.fillStyle = '#020617'; ctx.fillRect(16, 36, 32, 20);
          } else if (key === 'STAIRS_UP') {
            // 상행 계단 아치 폴백
            ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
            ctx.strokeRect(6, 6, 52, 52);
            ctx.fillStyle = '#334155'; ctx.fillRect(10, 38, 44, 18);
            ctx.fillStyle = '#475569'; ctx.fillRect(14, 22, 36, 16);
            ctx.fillStyle = '#cbd5e1'; ctx.fillRect(18, 8, 28, 14);
          } else {
            // 벽면 폴백 패턴
            if (key === 'CAVE_RUINS') {
              ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, 64, 64);
              ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
              ctx.strokeRect(0, 0, 64, 32); ctx.strokeRect(0, 32, 64, 32); ctx.strokeRect(32, 0, 32, 32);
              ctx.fillStyle = '#64748b'; ctx.fillRect(4, 4, 24, 8);
            } else if (key === 'MINES_CATACOMBS') {
              ctx.fillStyle = '#3f3f46'; ctx.fillRect(0, 0, 64, 64);
              ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2;
              ctx.strokeRect(2, 2, 60, 60); ctx.strokeRect(16, 16, 32, 32);
              ctx.fillStyle = '#a1a1aa'; ctx.font = '16px monospace'; ctx.fillText('💀', 22, 38);
            } else if (key === 'VOLCANIC_FORTRESS') {
              ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, 64, 64);
              ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
              ctx.strokeRect(2, 2, 60, 60); ctx.fillStyle = '#b91c1c'; ctx.fillRect(12, 12, 40, 40);
              ctx.fillStyle = '#f97316'; ctx.fillRect(20, 20, 24, 24);
            } else if (key === 'DARK_ABYSS') {
              ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 64, 64);
              ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
              ctx.strokeRect(4, 4, 56, 56); ctx.fillStyle = '#581c87'; ctx.fillRect(18, 18, 28, 28);
            } else {
              // DEEP_ANGBAND
              ctx.fillStyle = '#450a0a'; ctx.fillRect(0, 0, 64, 64);
              ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3;
              ctx.strokeRect(2, 2, 60, 60); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(14, 14, 36, 36);
            }
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

    const filename = ALL_TEXTURE_REGISTRY[key] || `${key.toLowerCase()}.jpg`;
    const url = customUrl || resolveTexturePath(filename);

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
   * 벽면, 바닥, 천장 전수 16종 테마 텍스처를 비동기 프리로드합니다.
   * @returns {Promise<void>}
   */
  async loadAll() {
    if (typeof Image === 'undefined') {
      this.isLoaded = true;
      return;
    }

    const loadPromises = Object.keys(ALL_TEXTURE_REGISTRY).map((key) => {
      return this._loadSingleTexture(key);
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
    const key = themeKey || 'CAVE_RUINS';
    if (!this.textures.has(key)) {
      this._loadSingleTexture(key);
      return this.fallbackTextures.get(key) || this.fallbackTextures.get('CAVE_RUINS');
    }
    return this.textures.get(key);
  }

  /**
   * 특정 던전 테마의 바닥재 텍스처 이미지를 반환합니다.
   * @param {string} [themeKey] 
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getFloorTexture(themeKey = null) {
    const key = themeKey ? `FLOOR_${themeKey}` : 'COMMON_FLOOR';
    if (!this.textures.has(key)) {
      this._loadSingleTexture(key);
      return this.textures.get('COMMON_FLOOR') || this.fallbackTextures.get(key) || this.fallbackTextures.get('COMMON_FLOOR');
    }
    return this.textures.get(key);
  }

  /**
   * 특정 던전 테마의 천장 텍스처 이미지를 반환합니다.
   * @param {string} [themeKey] 
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getCeilingTexture(themeKey = null) {
    const key = themeKey ? `CEIL_${themeKey}` : 'CEIL_CAVE_RUINS';
    if (!this.textures.has(key)) {
      this._loadSingleTexture(key);
      return this.fallbackTextures.get(key) || this.fallbackTextures.get('CEIL_CAVE_RUINS');
    }
    return this.textures.get(key);
  }

  /**
   * 계단 실사 텍스처를 반환합니다. 5대 던전 테마별 전용 텍스처를 우선 조회합니다.
   * @param {boolean|string} isDown - true/'DOWN'이면 하행, false/'UP'이면 상행
   * @param {string} [themeKey] - 던전 테마 키 (예: 'CAVE_RUINS', 'VOLCANIC_FORTRESS' 등)
   * @returns {HTMLImageElement|HTMLCanvasElement|Object}
   */
  getStairTexture(isDown = true, themeKey = null) {
    const isD = (isDown === true || isDown === 'DOWN' || isDown === 'STAIRS_DOWN');
    const prefix = isD ? 'STAIRS_DOWN' : 'STAIRS_UP';

    if (themeKey) {
      const themedKey = `${prefix}_${themeKey}`;
      if (this.textures.has(themedKey)) {
        return this.textures.get(themedKey);
      }
      if (ALL_TEXTURE_REGISTRY[themedKey]) {
        this._loadSingleTexture(themedKey);
        if (this.fallbackTextures.has(themedKey)) {
          return this.fallbackTextures.get(themedKey);
        }
      }
    }

    const defaultKey = isD ? 'STAIRS_DOWN' : 'STAIRS_UP';
    if (!this.textures.has(defaultKey)) {
      this._loadSingleTexture(defaultKey);
      return this.fallbackTextures.get(defaultKey);
    }
    return this.textures.get(defaultKey);
  }

  /**
   * 플로어캐스팅/실링캐스팅 초고속 샘플링용 128x128 32비트 픽셀 버퍼를 추출하고 캐싱합니다.
   * @param {HTMLImageElement|HTMLCanvasElement|Object} tex
   * @param {number} [size=128]
   * @returns {Uint32Array|null}
   */
  getTexturePixelBuffer(tex, size = 128) {
    if (!tex) return null;
    if (this.pixelBuffers.has(tex)) {
      return this.pixelBuffers.get(tex);
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }

    try {
      const isImage = (typeof HTMLImageElement !== 'undefined' && tex instanceof HTMLImageElement) ||
                      (typeof Image !== 'undefined' && tex instanceof Image) ||
                      tex.complete !== undefined;
      const isReady = !isImage || (tex.complete && tex.naturalWidth > 0);
      if (!isReady) return null;

      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = size;
      sampleCanvas.height = size;
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!sampleCtx) return null;

      sampleCtx.drawImage(tex, 0, 0, size, size);
      const imgData = sampleCtx.getImageData(0, 0, size, size);
      const uint32Buffer = new Uint32Array(imgData.data.buffer);

      this.pixelBuffers.set(tex, uint32Buffer);
      return uint32Buffer;
    } catch (_) {
      return null;
    }
  }
}

export const textureManager = new TextureManager();
