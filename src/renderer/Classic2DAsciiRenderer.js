/**
 * @module Classic2DAsciiRenderer
 * @description 원본 Mimicry 정통 2D 탑다운 격자(ASCII Grid) 렌더러.
 * 클래식 로그라이크 스타일의 2D 타일 폰트 렌더링, 시야/안개 시스템, 엔티티 및 아이템 심볼 표시를 지원하며,
 * Game.js 및 Effects.js와의 100% 드롭인(Drop-in) 호환성을 보장합니다.
 */

import { VoxelParticleSystem } from './VoxelParticleSystem.js';
import { VoxelMimicBridge } from '../entities/VoxelMimicBridge.js';
import { TERM_COLORS, TERMINAL_FONT_STACK, RETRO_GLOW_STYLES } from '../configs/ThemeColors.js';

export class Classic2DAsciiRenderer {
  constructor(canvasId, tileSize) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tileSize = tileSize || 24;
    this.mode = 'ascii';

    this.particleSys = new VoxelParticleSystem();
    this.mapBridge = null;

    // 2D Camera & Viewport State
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1.0;
    this.time = 0;
    this.camInitialized = false;

    // TomeNET 정통 슬림 직사각형 그리드 (가로 14px : 세로 23px, 종횡비 1:1.64)
    this.baseCellWidth = 14;
    this.baseCellHeight = 23;
    this.baseTileW = this.baseCellWidth;
    this.baseTileH = this.baseCellHeight;
    this.baseBlockH = 0;

    this.w = 800;
    this.h = 600;
    this.viewportWidth = Math.max(20, Math.floor(this.w / this.baseCellWidth));
    this.viewportHeight = Math.max(15, Math.floor(this.h / this.baseCellHeight));

    this.resize();
    this.setupGestureListeners();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 150);
    });
  }

  /**
   * 줌 배율 직접 설정 (0.4x ~ 3.0x 범위 안전 클램핑)
   */
  setZoom(z) {
    if (!Number.isFinite(z)) return;
    this.zoom = Math.max(0.4, Math.min(3.0, z));
    if (this.w && this.h) {
      this.viewportWidth = Math.max(12, Math.floor(this.w / (this.baseCellWidth * this.zoom)));
      this.viewportHeight = Math.max(10, Math.floor(this.h / (this.baseCellHeight * this.zoom)));
    }
  }

  /**
   * 모바일 핀치 줌(Pinch-to-zoom) 및 마우스 휠 줌 제스처 바인딩
   */
  setupGestureListeners() {
    const target = (typeof document !== 'undefined' ? document.getElementById('game-container') : null) || this.canvas;
    if (!target) return;
    let initialDist = null;
    let initialZoom = 1.0;

    target.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 2) {
        initialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = this.zoom;
      }
    }, { passive: false });

    target.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 2 && initialDist) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / initialDist;
        this.setZoom(initialZoom * factor);
      }
    }, { passive: false });

    target.addEventListener('touchend', (e) => {
      if (!e.touches || e.touches.length < 2) {
        initialDist = null;
      }
    });

    target.addEventListener('wheel', (e) => {
      if (e.target && e.target.closest && e.target.closest('.modal-content, #log-modal, #inventory-modal, #options-modal, #monster-modal')) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.setZoom(this.zoom * delta);
    }, { passive: false });
  }

  /**
   * 뷰포트 크기 및 해상도 실시간 100% 풀 블리드 동기화
   */
  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    let w = window.innerWidth || this.canvas.clientWidth || 800;
    let h = window.innerHeight || this.canvas.clientHeight || 600;
    if (w <= 0) w = 800;
    if (h <= 0) h = 600;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    if (this.canvas.style) {
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.w = w;
    this.h = h;

    this.viewportWidth = Math.max(12, Math.floor(w / (this.baseCellWidth * this.zoom)));
    this.viewportHeight = Math.max(10, Math.floor(h / (this.baseCellHeight * this.zoom)));
  }

  checkDynamicResize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const currentW = this.canvas.clientWidth || (parent ? parent.clientWidth : 0) || window.innerWidth;
    const currentH = this.canvas.clientHeight || (parent ? parent.clientHeight : 0) || window.innerHeight;
    if (currentW > 0 && currentH > 0 && (this.w !== currentW || this.h !== currentH)) {
      this.resize();
    }
  }

  clear() {
    this.ctx.fillStyle = '#0a0d14';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  /**
   * 카메라를 플레이어 그리드 위치로 즉각 센터링 (스냅)
   */
  snapCamera(playerX, playerY, playerZ = 0) {
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return;
    this.camX = playerX;
    this.camY = playerY;
    this.camInitialized = true;
  }

  /**
   * 2D 탑다운 스크린 좌표 변환 (화면 정중앙 앵커 공식)
   * screenX = (x - camX) * tileSize * zoom + (w / 2)
   * screenY = (y - camY) * tileSize * zoom + (h / 2)
   */
  toScreen(x, y, z = 0) {
    const cellW = this.baseCellWidth * this.zoom;
    const cellH = this.baseCellHeight * this.zoom;
    const safeCamX = Number.isFinite(this.camX) ? this.camX : 0;
    const safeCamY = Number.isFinite(this.camY) ? this.camY : 0;

    const sx = (x - safeCamX) * cellW + (this.w / 2);
    const sy = (y - safeCamY) * cellH + (this.h / 2);

    return {
      sx,
      sy,
      tileW: cellW,
      tileH: cellH,
      blockH: 0
    };
  }

  /**
   * 2D 바닥 그림자 (원형)
   */
  drawDropShadow(sx, sy, tileW, tileH, radius = 8, alpha = 0.3) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, radius * this.zoom, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  /**
   * 2D 아스키 맵 렌더링 패스
   */
  drawMap(map, cameraX, cameraY, playerX, playerY, lightRange) {
    this.checkDynamicResize();
    this.map = map;
    this.time += 0.016;

    if (!this.camInitialized || !Number.isFinite(this.camX) || !Number.isFinite(this.camY)) {
      this.snapCamera(playerX, playerY);
    } else {
      this.camX += (playerX - this.camX) * 0.2;
      this.camY += (playerY - this.camY) * 0.2;
    }

    const effLightRange = Math.max(1, lightRange || 1);
    const cellW = this.baseCellWidth * this.zoom;
    const cellH = this.baseCellHeight * this.zoom;
    const radiusX = Math.ceil(this.w / (2 * cellW)) + 2;
    const radiusY = Math.ceil(this.h / (2 * cellH)) + 2;

    const startX = Math.max(0, Math.floor(playerX - radiusX));
    const endX = Math.min(map.width, Math.ceil(playerX + radiusX));
    const startY = Math.max(0, Math.floor(playerY - radiusY));
    const endY = Math.min(map.height, Math.ceil(playerY + radiusY));

    const ctx = this.ctx;
    ctx.font = `bold ${Math.floor(cellH * 0.85)}px ${TERMINAL_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y);
        if (!tile) continue;

        const dx = x - playerX;
        const dy = y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isVisible = dist <= effLightRange + 0.5 && map.isTransparent(playerX, playerY, x, y);

        if (isVisible) tile.isExplored = true;
        if (!isVisible && !tile.isExplored) continue;

        const { sx, sy } = this.toScreen(x, y);

        // 1. 타일 배경 격자 칠하기 (14x23 슬림 직사각형)
        if (isVisible) {
          ctx.fillStyle = tile.isWalkable ? '#0b1120' : '#1e293b';
          ctx.fillRect(sx - cellW / 2, sy - cellH / 2, cellW, cellH);
        } else {
          ctx.fillStyle = '#030712';
          ctx.fillRect(sx - cellW / 2, sy - cellH / 2, cellW, cellH);
        }

        // 2. 2D 아스키 문자 렌더링 (ToME 정통 16색 팔레트, 샤프 단일 픽셀)
        let char = tile.char || (tile.isWalkable ? '.' : '#');
        let color = isVisible ? (tile.color || TERM_COLORS.TERM_SLATE) : '#1e293b';

        if (tile.type === 'WALL') {
          char = '#';
          color = isVisible ? TERM_COLORS.TERM_SLATE : '#1e293b';
        } else if (tile.type === 'FLOOR') {
          char = '.';
          color = isVisible ? TERM_COLORS.TERM_L_DARK : '#1e293b';
        } else if (tile.type === 'STAIRS_DOWN') {
          char = '>';
          color = isVisible ? TERM_COLORS.TERM_L_BLUE : '#0369a1';
        } else if (tile.type === 'STAIRS_UP') {
          char = '<';
          color = isVisible ? TERM_COLORS.TERM_YELLOW : '#b45309';
        }

        ctx.fillStyle = color;
        ctx.fillText(char, sx, sy);
      }
    }
  }

  /**
   * 2D 아스키 엔티티 렌더링 (플레이어 & 몬스터)
   * TomeNET 정통 샤프 픽셀 + 시간 기반 컬러 사이클링(Color Cycling)
   */
  drawEntity(entity, cameraX, cameraY, playerX, playerY, lightRange, hasMonsterDetection = false) {
    if (!entity) return;

    const isPlayer = (entity.isPlayer === true || entity.name === 'Player' || entity.char === '@' || (entity.x === playerX && entity.y === playerY && (entity.body || entity.mimicBody)));
    const dx = entity.x - playerX;
    const dy = entity.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const effLightRange = Math.max(1, lightRange || 1);

    let isVisible = isPlayer || (dist <= effLightRange + 0.5);
    if (!isPlayer && isVisible && this.map) {
      isVisible = this.map.isTransparent(playerX, playerY, entity.x, entity.y);
    }
    const isDetected = hasMonsterDetection && dist <= 20.5;

    if (!isVisible && !isDetected) return;

    const { sx, sy, tileH: cellH } = this.toScreen(entity.x, entity.y);
    const ctx = this.ctx;
    const fontSize = Math.floor(cellH * 0.95);

    // 1. 엔티티 글리프 렌더링 (선명하고 날카로운 단일 픽셀 글꼴)
    ctx.font = `900 ${fontSize}px ${TERMINAL_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const char = isPlayer ? (entity.char || '@') : (entity.char || 'M');
    const baseColor = isVisible ? (entity.color || (isPlayer ? '#34d399' : TERM_COLORS.TERM_RED)) : TERM_COLORS.TERM_RED;

    // TomeNET 정통 컬러 사이클링 (두꺼운 외곽선 번짐 없이 자연스러운 마법광 색상 변환)
    const chrom = VoxelMimicBridge.getEntityChromatic(entity, this.time);
    let renderColor = baseColor;
    if (chrom && isVisible && chrom.colors && chrom.colors.length > 0) {
      const phase = this.time * (chrom.speed || 3.0);
      const cIdx = Math.floor(phase) % chrom.colors.length;
      renderColor = chrom.colors[cIdx];
    }

    ctx.fillStyle = renderColor;
    ctx.fillText(char, sx, sy);

    // 2. 이름/레벨 텍스트
    if (isVisible) {
      ctx.font = `bold ${Math.max(10, Math.floor(10 * this.zoom))}px ${TERMINAL_FONT_STACK}`;
      ctx.fillStyle = isPlayer ? TERM_COLORS.TERM_YELLOW : 'rgba(240,245,255,0.85)';
      const label = isPlayer ? `Lv.${entity.level || 1} MIMIC` : (entity.name || 'Monster');
      ctx.fillText(label, sx, sy - cellH * 0.7);
    }
  }

  /**
   * 2D 아스키 아이템 / 코어 렌더링
   */
  drawItem(item, cameraX, cameraY, playerX, playerY, lightRange, hasItemDetection = false) {
    if (!item) return;

    const dx = item.x - playerX;
    const dy = item.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const effLightRange = Math.max(1, lightRange || 1);

    let isVisible = dist <= effLightRange + 0.5;
    if (isVisible && this.map) {
      isVisible = this.map.isTransparent(playerX, playerY, item.x, item.y);
    }
    const isDetected = hasItemDetection && dist <= 20.5;

    if (!isVisible && !isDetected) return;

    const { sx, sy, tileH: cellH } = this.toScreen(item.x, item.y);
    const ctx = this.ctx;
    const fontSize = Math.floor(cellH * 0.85);

    ctx.font = `bold ${fontSize}px ${TERMINAL_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const char = item.char || '*';
    const baseItemColor = isVisible ? (item.color || TERM_COLORS.TERM_L_BLUE) : TERM_COLORS.TERM_YELLOW;

    // TomeNET 정통 아이템 컬러 사이클링 (유물/코어 펄스)
    const chrom = VoxelMimicBridge.getItemChromatic(item);
    let renderColor = baseItemColor;
    if (chrom && isVisible && chrom.colors && chrom.colors.length > 0) {
      const phase = this.time * (chrom.speed || 2.2);
      const cIdx = Math.floor(phase) % chrom.colors.length;
      renderColor = chrom.colors[cIdx];
    }

    ctx.fillStyle = renderColor;
    ctx.fillText(char, sx, sy);
  }

  /**
   * 파티클 시스템 업데이트 및 2D 렌더링
   */
  updateParticles(dt) {
    this.particleSys.update(dt);
    const ctx = this.ctx;
    for (const p of this.particleSys.particles) {
      const { sx, sy } = this.toScreen(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
  }

  /**
   * 2D 아스키 격자 화면 좌표 -> 몬스터/아이템 최우선 역피킹
   */
  pick(clientX, clientY, entities, items, player, map) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const safeCamX = Number.isFinite(this.camX) ? this.camX : 0;
    const safeCamY = Number.isFinite(this.camY) ? this.camY : 0;

    const cellW = this.baseCellWidth * this.zoom;
    const cellH = this.baseCellHeight * this.zoom;
    const relX = (sx - (this.w / 2)) / cellW;
    const relY = (sy - (this.h / 2)) / cellH;

    const tx = Math.round(safeCamX + relX);
    const ty = Math.round(safeCamY + relY);

    // 1. 몬스터 피킹 (격자 좌표 및 40px 화면 반경 듀얼 매칭)
    if (entities && entities.length > 0) {
      const exactMonster = entities.find(e => e.x === tx && e.y === ty);
      if (exactMonster) return { type: 'monster', data: exactMonster, x: tx, y: ty };

      const monRadius = Math.max(38, 38 * this.zoom);
      for (const m of entities) {
        const pos = this.toScreen(m.x, m.y);
        const d = Math.hypot(sx - pos.sx, sy - pos.sy);
        if (d <= monRadius) return { type: 'monster', data: m, x: m.x, y: m.y };
      }
    }

    // 2. 아이템 피킹 (격자 좌표 및 36px 화면 반경 듀얼 매칭)
    if (items && items.length > 0) {
      const exactItem = items.find(i => i.x === tx && i.y === ty);
      if (exactItem) return { type: 'item', data: exactItem, x: tx, y: ty };

      const itemRadius = Math.max(34, 34 * this.zoom);
      for (const it of items) {
        const pos = this.toScreen(it.x, it.y);
        const d = Math.hypot(sx - pos.sx, sy - pos.sy);
        if (d <= itemRadius) return { type: 'item', data: it, x: it.x, y: it.y };
      }
    }

    // 3. 플레이어 피킹
    if (player) {
      if (player.x === tx && player.y === ty) return { type: 'player', data: player, x: tx, y: ty };
      const pPos = this.toScreen(player.x, player.y);
      if (Math.hypot(sx - pPos.sx, sy - pPos.sy) <= Math.max(38, 38 * this.zoom)) {
        return { type: 'player', data: player, x: player.x, y: player.y };
      }
    }

    // 빈 바닥은 모달을 띄우지 않고 쾌적하게 무시
    return null;
  }
}
