/**
 * @module Voxel3DRenderer
 * @description Mimicry Roguelike 차세대 3D 다층 복셀(Voxel) 렌더러.
 * 정석 2.5D 아이소메트릭 중앙 정렬 좌표계, 반응형 화면비(Galaxy Fold 등) 실시간 적응,
 * 표준 로그라이크 FOV 시스템, 실시간 포인트 라이트 및 3D 마이크로 복셀 파편 물리 통합 렌더링.
 */

import { VoxelParticleSystem } from './VoxelParticleSystem.js';
import { Voxel3DMapBridge, VOXEL_THEMES } from '../map/Voxel3DMapBridge.js';
import { VoxelMimicBridge } from '../entities/VoxelMimicBridge.js';
import { TERMINAL_FONT_STACK, TERM_COLORS } from '../configs/ThemeColors.js';

export class Voxel3DRenderer {
  constructor(canvasId, tileSize) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tileSize = tileSize || 20;

    this.particleSys = new VoxelParticleSystem();
    this.mapBridge = null;
    this.lastMapInstance = null;

    // 2.5D Camera & Viewport State
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1.0;
    this.time = 0;
    this.camInitialized = false;

    // Grid constants
    this.baseTileW = 34;
    this.baseTileH = 17;
    this.baseBlockH = 20;

    this.w = 800;
    this.h = 600;
    this.viewportWidth = Math.max(20, Math.floor(this.w / this.tileSize));
    this.viewportHeight = Math.max(15, Math.floor(this.h / this.tileSize));

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
      this.viewportWidth = Math.max(12, Math.floor(this.w / (this.baseTileW * this.zoom)));
      this.viewportHeight = Math.max(10, Math.floor(this.h / (this.baseTileH * this.zoom)));
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

    this.viewportWidth = Math.max(12, Math.floor(w / (this.baseTileW * this.zoom)));
    this.viewportHeight = Math.max(10, Math.floor(h / (this.baseTileH * this.zoom)));
  }

  /**
   * 매 프레임 리사이즈 필요 여부 실시간 폴링 가드
   */
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
    this.ctx.fillStyle = '#06070b';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  /**
   * 카메라를 플레이어의 2.5D 월드 픽셀 위치로 즉각 센터링 (스냅)
   */
  snapCamera(playerX, playerY, playerZ = 0) {
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return;
    const tileW = this.baseTileW;
    const tileH = this.baseTileH;
    const blockH = this.baseBlockH;

    this.camX = (playerX - playerY) * tileW;
    this.camY = (playerX + playerY) * tileH - (playerZ * blockH);
    this.camInitialized = true;
  }

  /**
   * 2.5D 아이소메트릭 월드 좌표 -> 화면 정중앙 앵커 정석 변환 공식
   * worldX = (x - y) * tileW
   * worldY = (x + y) * tileH - (z * blockH)
   * screenX = (worldX - camX) * zoom + (w / 2)
   * screenY = (worldY - camY) * zoom + (h / 2)
   */
  toScreen(x, y, z = 0) {
    const tileW = this.baseTileW;
    const tileH = this.baseTileH;
    const blockH = this.baseBlockH;

    const worldX = (x - y) * tileW;
    const worldY = (x + y) * tileH - (z * blockH);

    const safeCamX = Number.isFinite(this.camX) ? this.camX : 0;
    const safeCamY = Number.isFinite(this.camY) ? this.camY : 0;

    const sx = (worldX - safeCamX) * this.zoom + (this.w / 2);
    const sy = (worldY - safeCamY) * this.zoom + (this.h / 2);

    return {
      sx,
      sy,
      tileW: tileW * this.zoom,
      tileH: tileH * this.zoom,
      blockH: blockH * this.zoom
    };
  }

  /**
   * 3D 다층 복셀 큐브 블록 렌더러
   */
  draw3DBlock(sx, sy, tileW, tileH, blockH, theme, lightBoost, aoFactor, isTop) {
    const ctx = this.ctx;
    const [tr, tg, tb] = theme.top;
    const [lr, lg, lb] = theme.left;
    const [rr, rg, rb] = theme.right;

    const clamp = (v) => Math.min(255, Math.max(0, Math.floor(v)));
    const topColor = `rgb(${clamp((tr + lightBoost[0]) * aoFactor)}, ${clamp((tg + lightBoost[1]) * aoFactor)}, ${clamp((tb + lightBoost[2]) * aoFactor)})`;
    const leftColor = `rgb(${clamp((lr + lightBoost[0] * 0.7) * aoFactor)}, ${clamp((lg + lightBoost[1] * 0.7) * aoFactor)}, ${clamp((lb + lightBoost[2] * 0.7) * aoFactor)})`;
    const rightColor = `rgb(${clamp((rr + lightBoost[0] * 0.5) * aoFactor)}, ${clamp((rg + lightBoost[1] * 0.5) * aoFactor)}, ${clamp((rb + lightBoost[2] * 0.5) * aoFactor)})`;

    // 1. 상단 다이아몬드 면
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy - tileH);
    ctx.lineTo(sx + tileW, sy);
    ctx.lineTo(sx, sy + tileH);
    ctx.lineTo(sx - tileW, sy);
    ctx.closePath();
    ctx.fill();

    // 상단 베벨 하이라이트 & 몰타르 라인
    if (isTop && aoFactor > 0.4) {
      ctx.strokeStyle = theme.bevel || 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - tileW, sy);
      ctx.lineTo(sx, sy - tileH);
      ctx.lineTo(sx + tileW, sy);
      ctx.stroke();

      ctx.strokeStyle = theme.mortar || 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - tileH * 0.5);
      ctx.lineTo(sx + tileW * 0.5, sy);
      ctx.lineTo(sx, sy + tileH * 0.5);
      ctx.lineTo(sx - tileW * 0.5, sy);
      ctx.stroke();
    }

    // 2. 좌측 3D 큐브 면
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(sx - tileW, sy);
    ctx.lineTo(sx, sy + tileH);
    ctx.lineTo(sx, sy + tileH + blockH);
    ctx.lineTo(sx - tileW, sy + blockH);
    ctx.closePath();
    ctx.fill();

    if (aoFactor > 0.4) {
      ctx.strokeStyle = theme.mortar || 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(sx - tileW, sy + blockH * 0.5);
      ctx.lineTo(sx, sy + tileH + blockH * 0.5);
      ctx.stroke();
    }

    // 3. 우측 3D 큐브 면
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy + tileH);
    ctx.lineTo(sx + tileW, sy);
    ctx.lineTo(sx + tileW, sy + blockH);
    ctx.lineTo(sx, sy + tileH + blockH);
    ctx.closePath();
    ctx.fill();

    if (aoFactor > 0.4) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + tileH + blockH * 0.5);
      ctx.lineTo(sx + tileW, sy + blockH * 0.5);
      ctx.stroke();
    }

    // 모서리 외곽선
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(sx, sy + tileH);
    ctx.lineTo(sx, sy + tileH + blockH);
    ctx.stroke();
  }

  /**
   * 3D 바닥 투영 타원 그림자 (Drop Shadow)
   */
  drawDropShadow(sx, sy, tileW, tileH, radius = 13, alpha = 0.45) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, tileH / tileW);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  /**
   * 3D 미니 복셀 파편 렌더러
   */
  drawMiniVoxel(sx, sy, size, color, rot) {
    const ctx = this.ctx;
    const w = size;
    const h = size * 0.5;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -h); ctx.lineTo(w, 0); ctx.lineTo(0, h); ctx.lineTo(-w, 0);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.lineTo(0, h); ctx.lineTo(0, h + size); ctx.lineTo(-w, size);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.lineTo(w, size); ctx.lineTo(0, h + size);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 맵 렌더링 패스 (Game.js에서 호출)
   */
  drawMap(map, cameraX, cameraY, playerX, playerY, lightRange) {
    this.checkDynamicResize();
    this.map = map;
    this.time += 0.016;

    if (this.lastMapInstance !== map) {
      this.lastMapInstance = map;
      this.mapBridge = new Voxel3DMapBridge(map);
      const topV = this.mapBridge.getTopVoxel(playerX, playerY);
      this.snapCamera(playerX, playerY, topV ? topV.z : 0);
    }

    const topVoxel = this.mapBridge ? this.mapBridge.getTopVoxel(playerX, playerY) : null;
    const playerZ = topVoxel ? topVoxel.z : 0;

    const tileW = this.baseTileW;
    const tileH = this.baseTileH;
    const blockH = this.baseBlockH;

    const targetWorldX = (playerX - playerY) * tileW;
    const targetWorldY = (playerX + playerY) * tileH - (playerZ * blockH);

    // 카메라 유효성 체크 및 부드러운 Lerp 추적
    if (!this.camInitialized || !Number.isFinite(this.camX) || !Number.isFinite(this.camY)) {
      this.snapCamera(playerX, playerY, playerZ);
    } else {
      this.camX += (targetWorldX - this.camX) * 0.2;
      this.camY += (targetWorldY - this.camY) * 0.2;
    }

    // 롤백된 원본 시야값 기반 동적 포인트 라이트
    const effLightRange = Math.max(1, lightRange || 1);
    this.activeLights = [
      { x: playerX, y: playerY, z: playerZ, color: [255, 215, 60], radius: Math.max(3.5, effLightRange * 1.3), intensity: 1.4 }
    ];

    // 뷰포트 화면 크기에 기반한 타일 반경
    const maxScreenDimension = Math.max(this.w, this.h);
    const radius = Math.max(12, Math.ceil(maxScreenDimension / (tileW * this.zoom)));

    const startX = Math.max(0, playerX - radius);
    const endX = Math.min(map.width, playerX + radius);
    const startY = Math.max(0, playerY - radius);
    const endY = Math.min(map.height, playerY + radius);

    const voxelQueue = [];

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y);
        if (!tile) continue;

        const dx = x - playerX;
        const dy = y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isVisible = dist <= effLightRange + 0.5 && map.isTransparent(playerX, playerY, x, y);

        if (isVisible) tile.isExplored = true;

        // 표준 로그라이크 FOV: 시야 내 타일 또는 이미 탐색된 기억 타일만 렌더링
        if (!isVisible && !tile.isExplored) continue;

        const stack = this.mapBridge ? this.mapBridge.getVoxelStack(x, y) : [];
        for (const block of stack) {
          voxelQueue.push({
            x, y, z: block.z,
            themeKey: block.themeKey,
            isTop: block.isTop,
            isVisible,
            isExplored: tile.isExplored,
            dist
          });
        }
      }
    }

    // 3D 깊이 정렬 (Back-to-Front: X + Y + Z)
    voxelQueue.sort((a, b) => (a.x + a.y + a.z * 1.05) - (b.x + b.y + b.z * 1.05));

    for (const v of voxelQueue) {
      const { sx, sy, tileW: tW, tileH: tH, blockH: bH } = this.toScreen(v.x, v.y, v.z);
      if (sx < -100 || sx > this.w + 100 || sy < -100 || sy > this.h + 100) continue;

      const theme = VOXEL_THEMES[v.themeKey] || VOXEL_THEMES.FLOOR;
      let lr = 0, lg = 0, lb = 0;

      if (v.isVisible) {
        for (const light of this.activeLights) {
          const d = Math.hypot(v.x - light.x, v.y - light.y, (v.z - light.z) * 0.7);
          if (d < light.radius) {
            const atten = (1 - d / light.radius) * light.intensity;
            lr += light.color[0] * atten * 0.45;
            lg += light.color[1] * atten * 0.45;
            lb += light.color[2] * atten * 0.45;
          }
        }
      }

      // 시야 내는 100% 라이팅, 탐색된 기억 타일은 0.42 슬레이트 안개 셰이딩
      const aoFactor = v.isVisible ? ((v.z === 0 && !v.isTop) ? 0.78 : 1.0) : 0.42;

      this.draw3DBlock(sx, sy, tW, tH, bH, theme, [lr, lg, lb], aoFactor, v.isTop);
    }
  }

  /**
   * 엔티티 렌더링 (플레이어 및 몬스터)
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

    const topVoxel = this.mapBridge ? this.mapBridge.getTopVoxel(entity.x, entity.y) : null;
    const ez = topVoxel ? topVoxel.z : 0;
    const { sx, sy, tileW, tileH } = this.toScreen(entity.x, entity.y, ez);

    // 1. 바닥 투영 그림자
    this.drawDropShadow(sx, sy, tileW, tileH, 14 * this.zoom, 0.5);

    // 2. 크로매틱 아스키 렌더링 (TomeNET 샤프 컬러 사이클링)
    const chrom = VoxelMimicBridge.getEntityChromatic(entity, this.time);
    const charY = sy - tileH - 7 * this.zoom;
    const fontSize = Math.floor(30 * this.zoom);

    this.ctx.font = `900 ${fontSize}px ${TERMINAL_FONT_STACK}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const char = isPlayer ? (entity.char || '@') : (entity.char || 'M');
    const baseColor = isVisible ? (entity.color || (isPlayer ? '#34d399' : TERM_COLORS.TERM_RED)) : TERM_COLORS.TERM_RED;

    let renderColor = baseColor;
    if (chrom && isVisible && chrom.colors && chrom.colors.length > 0) {
      const phase = this.time * (chrom.speed || 3.5);
      const cIdx = Math.floor(phase) % chrom.colors.length;
      renderColor = chrom.colors[cIdx];
    }

    this.ctx.fillStyle = renderColor;
    this.ctx.fillText(char, sx, charY);

    // 이름/레벨 태그
    if (isVisible) {
      this.ctx.font = `bold ${Math.max(10, Math.floor(11 * this.zoom))}px ${TERMINAL_FONT_STACK}`;
      this.ctx.fillStyle = isPlayer ? TERM_COLORS.TERM_YELLOW : 'rgba(240,245,255,0.9)';
      const label = isPlayer ? `Lv.${entity.level || 1} MIMIC` : (entity.name || 'Monster');
      this.ctx.fillText(label, sx, charY - fontSize * 0.78);
    }
  }

  /**
   * 아이템 / 코어 / 보물상자 렌더링
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

    const topVoxel = this.mapBridge ? this.mapBridge.getTopVoxel(item.x, item.y) : null;
    const iz = topVoxel ? topVoxel.z : 0;
    const { sx, sy, tileW, tileH } = this.toScreen(item.x, item.y, iz);

    const bob = Math.sin(this.time * 4 + item.x) * 3 * this.zoom;
    this.drawDropShadow(sx, sy, tileW, tileH, 10 * this.zoom, 0.4);

    const charY = sy - tileH - 5 * this.zoom + bob;
    const fontSize = Math.floor(24 * this.zoom);

    this.ctx.font = `bold ${fontSize}px ${TERMINAL_FONT_STACK}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const baseColor = isVisible ? (item.color || TERM_COLORS.TERM_L_BLUE) : TERM_COLORS.TERM_YELLOW;
    const chrom = VoxelMimicBridge.getItemChromatic(item);
    let renderColor = baseColor;
    if (chrom && isVisible && chrom.colors && chrom.colors.length > 0) {
      const phase = this.time * (chrom.speed || 2.2);
      const cIdx = Math.floor(phase) % chrom.colors.length;
      renderColor = chrom.colors[cIdx];
    }

    this.ctx.fillStyle = renderColor;
    this.ctx.fillText(item.char || '*', sx, charY);
  }

  /**
   * 파티클 물리 업데이트 및 3D 미니 복셀 렌더링
   */
  updateParticles(dt) {
    this.particleSys.update(dt);
    for (const p of this.particleSys.particles) {
      const { sx, sy } = this.toScreen(p.x, p.y, p.z);
      this.drawMiniVoxel(sx, sy, p.size * this.zoom, p.color, p.rot);
    }
  }

  /**
   * 2.5D 아이소메트릭 등각투영 역좌표 피킹 (몬스터 & 아이템 최우선 히트 테스트)
   */
  pick(clientX, clientY, entities, items, player, map) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const tileW = this.baseTileW;
    const tileH = this.baseTileH;
    const safeCamX = Number.isFinite(this.camX) ? this.camX : 0;
    const safeCamY = Number.isFinite(this.camY) ? this.camY : 0;

    const relWorldX = (sx - (this.w / 2)) / this.zoom + safeCamX;
    const relWorldY = (sy - (this.h / 2)) / this.zoom + safeCamY;

    const u = relWorldX / tileW;
    const v = relWorldY / tileH;
    const tx = Math.round((v + u) / 2);
    const ty = Math.round((v - u) / 2);

    // 1. 몬스터 최우선 피킹 (화면 공간 48px 여유 반경 및 타일 격자 (tx, ty) 듀얼 매칭)
    if (entities && entities.length > 0) {
      // 1-1. 직접 타일 좌표 일치 몬스터 확인
      const exactMonster = entities.find(m => m.x === tx && m.y === ty);
      if (exactMonster) {
        return { type: 'monster', data: exactMonster, x: exactMonster.x, y: exactMonster.y };
      }

      // 1-2. 화면 픽셀 공간 최근접 몬스터 피킹 (반경 48px)
      let closestMonster = null;
      let minMonDist = Infinity;
      const monRadius = Math.max(48, 48 * this.zoom);

      for (const m of entities) {
        const topVoxel = this.mapBridge ? this.mapBridge.getTopVoxel(m.x, m.y) : null;
        const mz = topVoxel ? topVoxel.z : 0;
        const pos = this.toScreen(m.x, m.y, mz);
        const centerCharY = pos.sy - pos.tileH - 7 * this.zoom;
        const d = Math.hypot(sx - pos.sx, sy - centerCharY);
        if (d <= monRadius && d < minMonDist) {
          minMonDist = d;
          closestMonster = m;
        }
      }
      if (closestMonster) {
        return { type: 'monster', data: closestMonster, x: closestMonster.x, y: closestMonster.y };
      }
    }

    // 2. 바닥 아이템 피킹 (화면 공간 44px 여유 반경 및 타일 격자 듀얼 매칭)
    if (items && items.length > 0) {
      const exactItem = items.find(it => it.x === tx && it.y === ty);
      if (exactItem) {
        return { type: 'item', data: exactItem, x: exactItem.x, y: exactItem.y };
      }

      let closestItem = null;
      let minItemDist = Infinity;
      const itemRadius = Math.max(44, 44 * this.zoom);

      for (const it of items) {
        const topVoxel = this.mapBridge ? this.mapBridge.getTopVoxel(it.x, it.y) : null;
        const iz = topVoxel ? topVoxel.z : 0;
        const pos = this.toScreen(it.x, it.y, iz);
        const centerCharY = pos.sy - pos.tileH - 5 * this.zoom;
        const d = Math.hypot(sx - pos.sx, sy - centerCharY);
        if (d <= itemRadius && d < minItemDist) {
          minItemDist = d;
          closestItem = it;
        }
      }
      if (closestItem) {
        return { type: 'item', data: closestItem, x: closestItem.x, y: closestItem.y };
      }
    }

    // 3. 플레이어 본체 피킹
    if (player) {
      if (player.x === tx && player.y === ty) {
        return { type: 'player', data: player, x: player.x, y: player.y };
      }

      const topVoxel = this.mapBridge ? this.mapBridge.getTopVoxel(player.x, player.y) : null;
      const pz = topVoxel ? topVoxel.z : 0;
      const pos = this.toScreen(player.x, player.y, pz);
      const centerCharY = pos.sy - pos.tileH - 7 * this.zoom;
      const d = Math.hypot(sx - pos.sx, sy - centerCharY);
      if (d <= Math.max(45, 45 * this.zoom)) {
        return { type: 'player', data: player, x: player.x, y: player.y };
      }
    }

    // 몬스터/아이템/플레이어가 없는 빈 바닥은 모달을 띄우지 않고 쾌적하게 무시
    return null;
  }
}
