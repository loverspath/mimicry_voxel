/**
 * @module FirstPerson3DRenderer
 * @category renderer
 * @description 초기 둠 / 위저드리 시점 DDA 레이캐스팅 1인칭 3D 텍스처 어드벤처 렌더러.
 *              나노바나나 생성 텍스처 매핑, 거리 감쇄 안개(Depth Fog), 빌보드 스프라이트 및 미니맵 레이더 제공
 * @purity DOM / Canvas Renderer
 * @dependencies DungeonThemeConfig.js, TextureManager.js
 * @exports FirstPerson3DRenderer
 */

import { getThemeForFloor } from '../configs/DungeonThemeConfig.js';
import { textureManager } from './TextureManager.js';

export class FirstPerson3DRenderer {
  constructor(canvasId = 'game-canvas', tileSize = 24) {
    this.canvas = typeof document !== 'undefined' ? document.getElementById(canvasId) : null;
    this.ctx = this.canvas && typeof this.canvas.getContext === 'function' 
      ? this.canvas.getContext('2d', { alpha: false }) 
      : null;

    this.tileSize = tileSize || 24;
    this.mode = 'dungeon3d';
    this.zoom = 1.0;

    this.w = this.canvas ? this.canvas.width : 800;
    this.h = this.canvas ? this.canvas.height : 600;
    this.viewportWidth = 30;
    this.viewportHeight = 20;

    // 시선 방향 각도 (라디안: 0 = 동, PI/2 = 남, PI = 서, 3PI/2 = 북)
    this.playerAngle = 3 * Math.PI / 2; // 기본 북쪽 시선 (270도)
    this.fov = 66 * (Math.PI / 180);    // 시야각 66도

    // Z-Buffer (스크린 수직선별 최소 벽 깊이)
    this.depthBuffer = new Float32Array(Math.max(1, this.w));

    // 수직 시점 각도(Pitch / Y-Shearing 수직 오프셋 px, 한계치 +-0.42*H)
    this.pitch = 0;

    // 동적 3D 계단/사다리 구조체 캐시 목록
    this.dynamicStairs = [];

    this.resize();

    // 텍스처 사전 로딩 보장
    if (textureManager && typeof textureManager.loadAll === 'function') {
      textureManager.loadAll().catch(() => {});
    }
  }

  resize() {
    if (!this.canvas) return;
    if (typeof window !== 'undefined') {
      this.w = this.canvas.width = window.innerWidth;
      this.h = this.canvas.height = window.innerHeight;
    } else {
      this.w = this.canvas.width || 800;
      this.h = this.canvas.height || 600;
    }
    this.depthBuffer = new Float32Array(Math.max(1, this.w));

    // 플로어캐스팅 저해상도 오프스크린 버퍼 동기화
    if (this.floorCanvas) {
      const bufW = 240;
      const bufH = Math.max(60, Math.floor(bufW * ((this.h || 600) / (this.w || 800))));
      this.floorCanvas.width = bufW;
      this.floorCanvas.height = bufH;
      if (this.floorCtx && typeof this.floorCtx.createImageData === 'function') {
        this.floorImageData = this.floorCtx.createImageData(bufW, bufH);
        this.floorBuffer = new Uint32Array(this.floorImageData.data.buffer);
      }
    }
  }

  adjustPitch(deltaPitch) {
    const maxPitch = Math.floor(this.h * 0.42);
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, (this.pitch || 0) + deltaPitch));
  }

  resetPitch() {
    this.pitch = 0;
  }

  snapCamera(x, y, z = 0) {
    this.camX = x + 0.5;
    this.camY = y + 0.5;
    this.walkBob = 0;
    this.walkCycle = 0;
  }

  setZoom(zoom) {
    if (Number.isFinite(zoom)) {
      this.zoom = zoom;
    }
  }

  clear() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#06070a';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  /**
   * 1인칭 레이캐스팅 벽면 및 바닥/천장 렌더링
   * @param {Object} map - 던전 맵 인스턴스
   * @param {number} startX - 레거시 카메라 오프셋 X
   * @param {number} startY - 레거시 카메라 오프셋 Y
   * @param {number} playerX - 플레이어 그리드 X
   * @param {number} playerY - 플레이어 그리드 Y
   * @param {number} lightRange - 횃불 광원 반경 (또는 층수)
   * @param {number} [floor=null] - 현재 층수
   */
  drawMap(map, startX, startY, playerX, playerY, lightRange = 6, floor = null) {
    if (!this.ctx || !map) return;

    const currentFloor = floor || map?.floor || 1;
    const theme = getThemeForFloor(currentFloor);
    const wallTex = textureManager.getWallTexture(theme.id);
    const floorTex = textureManager.getFloorTexture(theme.id);
    const ceilTex = textureManager.getCeilingTexture(theme.id);
    const userLightRange = typeof lightRange === 'number' ? Math.max(1.0, lightRange) : 4.0;
    this.currentLightRange = userLightRange;

    const clearDist = Math.max(1.2, userLightRange * 1.5);
    const maxLightDist = Math.max(4.0, userLightRange * 3.5);

    // 카메라 위치 선형 보간 (Smooth Camera Lerp, factor = 0.28) & 워킹 밥
    const targetX = playerX + 0.5;
    const targetY = playerY + 0.5;

    if (this.camX === undefined || this.camY === undefined) {
      this.camX = targetX;
      this.camY = targetY;
      this.walkBob = 0;
      this.walkCycle = 0;
    } else {
      const distSq = (targetX - this.camX) ** 2 + (targetY - this.camY) ** 2;
      if (distSq > 4.0) {
        this.camX = targetX;
        this.camY = targetY;
        this.walkBob = 0;
      } else {
        const lerpFactor = 0.28;
        this.camX += (targetX - this.camX) * lerpFactor;
        this.camY += (targetY - this.camY) * lerpFactor;

        // 보행 밥(Head-bob) 미세 진동 (±2.2px)
        if (distSq > 0.0005) {
          this.walkCycle = (this.walkCycle || 0) + 0.35;
          this.walkBob = Math.sin(this.walkCycle) * 2.2;
        } else {
          this.walkBob = (this.walkBob || 0) * 0.75;
        }
      }
    }

    const posX = this.camX;
    const posY = this.camY;
    const totalPitch = (this.pitch || 0) + (this.walkBob || 0);

    // 시선 벡터 및 카메라 평면 벡터 연산 (FOV 66도)
    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);
    const planeScale = Math.tan(this.fov / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    // 1. 천장 및 바닥 실사 텍스처 플로어캐스팅 렌더링 (미완료 시 그라디언트 폴백)
    this._renderCeilingAndFloor(floorTex, ceilTex, theme, posX, posY, dirX, dirY, planeX, planeY, userLightRange, clearDist, maxLightDist, totalPitch, map);

    // 2. 플레이어 주변 광원 반경 내 타일 탐험 완료 동기화 (아스키/복셀 전환 시 전장의 안개 해제)
    const revealR = Math.max(2, Math.floor(userLightRange || 4));
    for (let dy = -revealR; dy <= revealR; dy++) {
      for (let dx = -revealR; dx <= revealR; dx++) {
        if (dx * dx + dy * dy <= revealR * revealR) {
          const tx = playerX + dx;
          const ty = playerY + dy;
          if (map.tiles && map.tiles[ty] && map.tiles[ty][tx]) {
            map.tiles[ty][tx].isExplored = true;
            map.tiles[ty][tx].explored = true;
          }
        }
      }
    }

    // 3. DDA 수직 컬럼 레이캐스팅 루프
    const isImage = wallTex && (
      (typeof HTMLImageElement !== 'undefined' && wallTex instanceof HTMLImageElement) ||
      (typeof Image !== 'undefined' && wallTex instanceof Image) ||
      wallTex.complete !== undefined
    );
    const isReadyImage = isImage && wallTex.complete && wallTex.naturalWidth > 0;
    const isCanvas = wallTex && (
      (typeof HTMLCanvasElement !== 'undefined' && wallTex instanceof HTMLCanvasElement) ||
      wallTex.getContext !== undefined
    );
    const canDrawTexture = isReadyImage || isCanvas;

    const texWidth = isReadyImage 
      ? wallTex.naturalWidth 
      : ((wallTex && typeof wallTex.width === 'number' && wallTex.width > 0) ? wallTex.width : 64);
    const texHeight = isReadyImage 
      ? wallTex.naturalHeight 
      : ((wallTex && typeof wallTex.height === 'number' && wallTex.height > 0) ? wallTex.height : 64);

    for (let x = 0; x < this.w; x++) {
      const cameraX = (2 * x) / this.w - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;

      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);

      const deltaDistX = Math.abs(1 / (rayDirX || 0.00001));
      const deltaDistY = Math.abs(1 / (rayDirY || 0.00001));

      let stepX = 0;
      let stepY = 0;
      let sideDistX = 0;
      let sideDistY = 0;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - posX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - posY) * deltaDistY;
      }

      // DDA 실행 (벽 타일 충돌 판정까지)
      let hit = 0;
      let side = 0;
      let maxSteps = 45;

      while (hit === 0 && maxSteps-- > 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }

        // 3D 시야 광선 경로 상의 타일 탐험 완료 동기화
        if (map.tiles && map.tiles[mapY] && map.tiles[mapY][mapX]) {
          map.tiles[mapY][mapX].isExplored = true;
          map.tiles[mapY][mapX].explored = true;
        }

        if (typeof map.isWall === 'function') {
          if (map.isWall(mapX, mapY)) {
            hit = 1;
          }
        } else if (map.tiles && map.tiles[mapY] && map.tiles[mapY][mapX]) {
          if (map.tiles[mapY][mapX].type === 'WALL' || map.tiles[mapY][mapX].isWall) {
            hit = 1;
          }
        }
      }

      // 어안 왜곡 보정 수직 거리 (Perpendicular Distance)
      let perpWallDist = side === 0 ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
      perpWallDist = Math.max(0.1, perpWallDist);

      // Z-Buffer 저장
      this.depthBuffer[x] = perpWallDist;

      // 스크린 투사 벽 높이 및 수직 범위 연산 (Y-Shearing Pitch 수직 시점 및 워킹 밥 적용)
      const horizonY = Math.floor(this.h / 2 + totalPitch);
      const lineHeight = Math.floor(this.h / perpWallDist);
      const drawStart = Math.max(0, -lineHeight / 2 + horizonY);
      const drawEnd = Math.min(this.h - 1, lineHeight / 2 + horizonY);

      // 텍스처 수직 슬라이스 X 좌표 산출
      let wallX = side === 0 ? posY + perpWallDist * rayDirY : posX + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * texWidth);
      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) {
        texX = texWidth - texX - 1;
      }
      texX = Math.max(0, Math.min(texWidth - 1, texX));

      // 텍스처 1px 슬라이스 렌더링
      const sliceH = Math.max(1, drawEnd - drawStart);
      if (canDrawTexture) {
        try {
          this.ctx.drawImage(
            wallTex,
            texX, 0, 1, texHeight,
            x, drawStart, 1, sliceH
          );
        } catch (_) {
          this._drawProceduralWallSlice(x, drawStart, sliceH, side, theme, texX, texWidth);
        }
      } else {
        this._drawProceduralWallSlice(x, drawStart, sliceH, side, theme, texX, texWidth);
      }

      // 벽면 상/하단 접촉 앰비언트 오클루전 (Wall-Floor-Ceiling Contact Shadow)
      const aoHeight = Math.min(Math.floor(sliceH * 0.15), 5);
      if (aoHeight >= 1) {
        // 천장 접촉부 어두운 음영
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        this.ctx.fillRect(x, drawStart, 1, aoHeight);
        // 바닥 접촉부 짙은 접촉 그림자 (벽이 바닥에 견고히 밀착)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
        this.ctx.fillRect(x, drawEnd - aoHeight, 1, aoHeight);
      }

      // 거리 감쇄 안개(Depth Fog) 및 측면 음영 (유저 광원량 lightRange 비례 연동)
      let fog = 0;
      if (perpWallDist > clearDist) {
        const normDist = Math.min(1.0, Math.max(0, (perpWallDist - clearDist) / (maxLightDist - clearDist)));
        fog = Math.min(0.70, Math.pow(normDist, 1.25));
      }
      const shadowBonus = side === 1 ? 0.12 : 0.0;
      const totalDarkness = Math.min(0.70, fog * 0.65 + shadowBonus);

      if (totalDarkness > 0.03) {
        this.ctx.fillStyle = `rgba(6, 8, 12, ${totalDarkness})`;
        this.ctx.fillRect(x, drawStart, 1, sliceH);
      }
    }

    // 3. 횃불 앰비언트 글로우(Radial Torchlight Glow) 래스터라이징 (광원량 비례)
    this._renderTorchlightGlow(userLightRange, totalPitch);

    // 4. 다층 3D 복셀 사다리 & 계단 렌더링 (천장 관통 수직 사다리, 트랩도어 핏, 실시간 광원 채광)
    this._drawVoxelLadders(map, playerX, playerY, theme);

    // 5. 미니맵 나침반 레이더 오버레이 렌더링
    this._drawCompassRadar(map, playerX, playerY);

    // 6. 계단 도착 인게임 안내 프롬프트 배너 (화면 중앙 하단)
    this._drawStairArrivalPrompt(map, playerX, playerY);
  }

  /**
   * 실사 텍스처 로딩 중 또는 예외 발생 시 고품질 절차적 석조 벽면 슬라이스 렌더링
   */
  _drawProceduralWallSlice(x, drawStart, sliceH, side, theme, texX = 0, texWidth = 64) {
    const baseColor = theme?.wallColor || (side === 1 ? '#334155' : '#475569');
    this.ctx.fillStyle = baseColor;
    this.ctx.fillRect(x, drawStart, 1, sliceH);

    // 수직 모르타르 그루브 (블록 경계선)
    if (texX === 0 || texX === Math.floor(texWidth / 2)) {
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      this.ctx.fillRect(x, drawStart, 1, sliceH);
    }
  }

  _renderTorchlightGlow(lightRange = 4.0, totalPitch = null) {
    if (!this.ctx) return;
    const effPitch = totalPitch !== null ? totalPitch : ((this.pitch || 0) + (this.walkBob || 0));
    const horizonY = Math.floor(this.h / 2 + effPitch);
    const cx = this.w / 2;
    const cy = horizonY;
    const rangeScale = Math.max(0.6, Math.min(2.5, (lightRange || 4.0) / 4.0));
    const maxR = Math.max(this.w, this.h) * 0.70 * rangeScale;
    const centerAlpha = Math.min(0.18, 0.08 * rangeScale);
    const midAlpha = Math.min(0.10, 0.045 * rangeScale);
    const edgeAlpha = Math.min(0.04, 0.018 * rangeScale);

    const torchGrad = this.ctx.createRadialGradient(cx, cy, 20, cx, cy, maxR);
    torchGrad.addColorStop(0, `rgba(251, 191, 36, ${centerAlpha})`);  // 따스한 황금빛 횃불 중심광
    torchGrad.addColorStop(0.35, `rgba(245, 158, 11, ${midAlpha})`);
    torchGrad.addColorStop(0.70, `rgba(180, 83, 9, ${edgeAlpha})`);
    torchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.ctx.save();
    this.ctx.fillStyle = torchGrad;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.restore();
  }

  _renderCeilingAndFloor(floorTex, ceilTex, theme, posX = 0, posY = 0, dirX = 0, dirY = -1, planeX = 0.66, planeY = 0, userLightRange = 4.0, clearDist = 2.0, maxLightDist = 8.0, totalPitch = 0, map = null) {
    if (!this.ctx) return;
    const horizonY = Math.floor(this.h / 2 + totalPitch);

    // 오프스크린 플로어캐스팅 버퍼 (폭 240px 저해상도 스케일)
    const bufW = 240;
    const bufH = Math.max(60, Math.floor(bufW * ((this.h || 600) / (this.w || 800))));

    if (!this.floorCanvas && typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.floorCanvas = document.createElement('canvas');
      this.floorCanvas.width = bufW;
      this.floorCanvas.height = bufH;
      this.floorCtx = this.floorCanvas.getContext('2d', { willReadFrequently: true });
      this.floorImageData = this.floorCtx && typeof this.floorCtx.createImageData === 'function' 
        ? this.floorCtx.createImageData(bufW, bufH) 
        : null;
      this.floorBuffer = this.floorImageData ? new Uint32Array(this.floorImageData.data.buffer) : null;
    }

    const floorPixels = floorTex && typeof textureManager.getTexturePixelBuffer === 'function' 
      ? textureManager.getTexturePixelBuffer(floorTex, 128) 
      : null;
    const ceilPixels = ceilTex && typeof textureManager.getTexturePixelBuffer === 'function' 
      ? textureManager.getTexturePixelBuffer(ceilTex, 128) 
      : null;
    const ladderPitTex = textureManager.getLadderTexture(theme, true);
    const ladderPitPixels = ladderPitTex && typeof textureManager.getTexturePixelBuffer === 'function' 
      ? textureManager.getTexturePixelBuffer(ladderPitTex, 128) 
      : null;

    if (this.floorBuffer && this.floorCtx && (floorPixels || ceilPixels)) {
      this._renderFloorAndCeilCasting(floorPixels, ceilPixels, theme, bufW, bufH, posX, posY, dirX, dirY, planeX, planeY, clearDist, maxLightDist, totalPitch, map, ladderPitPixels);
    } else {
      this._renderProceduralCeilingAndFloorGradients(horizonY, theme);
    }
  }

  /**
   * 90s 레트로 정통 수평 스캔라인 원근 투시 (Floorcasting & Ceilingcasting)
   */
  _renderFloorAndCeilCasting(floorPixels, ceilPixels, theme, bufW, bufH, posX, posY, dirX, dirY, planeX, planeY, clearDist, maxLightDist, totalPitch = 0, map = null, ladderPitPixels = null) {
    const bufHorizonY = Math.floor(bufH / 2 + totalPitch * (bufH / (this.h || 600)));
    const posZ = 0.5 * bufH;
    const scaleToWorld = (this.h || 600) / bufH;

    // 1. 천장 스캔라인 캐스팅 (y = 0 ~ bufHorizonY - 1)
    for (let y = 0; y < bufHorizonY; y++) {
      const p = bufHorizonY - y;
      if (p <= 0) continue;
      const rowDistance = posZ / p;
      const worldDist = rowDistance * scaleToWorld;

      let fog = 0;
      if (worldDist > clearDist) {
        const normDist = Math.min(1.0, Math.max(0, (worldDist - clearDist) / (maxLightDist - clearDist)));
        fog = Math.min(0.85, Math.pow(normDist, 1.25));
      }
      const fogMul = 1.0 - fog;

      const floorStepX = rowDistance * (2 * planeX) / bufW;
      const floorStepY = rowDistance * (2 * planeY) / bufW;

      let mapX = posX + rowDistance * (dirX - planeX);
      let mapY = posY + rowDistance * (dirY - planeY);

      const rowOffset = y * bufW;

      if (ceilPixels) {
        for (let x = 0; x < bufW; x++) {
          const tileX = Math.floor(mapX);
          const tileY = Math.floor(mapY);

          // 상행 계단 타일 천장 개구부 (Hollow Ceiling Skylight Well for Upstairs)
          if (map && map.tiles && map.tiles[tileY] && map.tiles[tileY][tileX]) {
            const t = map.tiles[tileY][tileX];
            if (t.type === 'STAIRS_UP' || t.char === '<' || t.isUpStaircase) {
              const u = mapX - tileX;
              const v = mapY - tileY;
              // 사각 천장 석조 테두리 프레임 (외곽 12% 마진)
              if (u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88) {
                const frameShade = Math.max(20, Math.floor(52 * fogMul));
                this.floorBuffer[rowOffset + x] = 0xFF000000 | (frameShade << 16) | (frameShade << 8) | frameShade;
              } else {
                // 천장이 뚫려 위층으로 연결되는 채광 개구부: 테마별 앰비언트 글로우
                let skyR = 224, skyG = 242, skyB = 254; // CAVE_RUINS 기본 (청백색 자연광)
                if (theme === 'VOLCANIC_FORTRESS') {
                  skyR = 251; skyG = 146; skyB = 60; // 화산 오렌지광
                } else if (theme === 'MINES_CATACOMBS') {
                  skyR = 245; skyG = 158; skyB = 11; // 횃불 호박색광
                } else if (theme === 'DARK_ABYSS') {
                  skyR = 168; skyG = 85; skyB = 247; // 심연 보라 성운광
                } else if (theme === 'DEEP_ANGBAND') {
                  skyR = 239; skyG = 68; skyB = 68; // 앙그반드 핏빛광
                }
                const pitDist = Math.hypot(u - 0.5, v - 0.5);
                const glow = Math.max(0.20, 0.90 - pitDist * 1.1);
                const r = Math.min(255, Math.floor(skyR * glow * fogMul));
                const g = Math.min(255, Math.floor(skyG * glow * fogMul));
                const b = Math.min(255, Math.floor(skyB * glow * fogMul));
                this.floorBuffer[rowOffset + x] = 0xFF000000 | (b << 16) | (g << 8) | r;
              }
              mapX += floorStepX;
              mapY += floorStepY;
              continue;
            }
          }

          // 2x2 멀티타일 스케일링 (128px 텍스처가 2x2 타일에 걸쳐 반복되도록 mapX * 64)
          const tx = (Math.floor(mapX * 64) & 127);
          const ty = (Math.floor(mapY * 64) & 127);
          const pixel = ceilPixels[(ty << 7) + tx];

          // 타일 격자 줄눈 (Grout seam) 셰이딩 (정수 경계 0.042 반경)
          const fracX = mapX - Math.floor(mapX);
          const fracY = mapY - Math.floor(mapY);
          const isGrout = (fracX < 0.042 || fracX > 0.958 || fracY < 0.042 || fracY > 0.958);
          const finalFog = isGrout ? fogMul * 0.48 : fogMul;

          const r = ((pixel & 0xFF) * finalFog) | 0;
          const g = (((pixel >> 8) & 0xFF) * finalFog) | 0;
          const b = (((pixel >> 16) & 0xFF) * finalFog) | 0;
          this.floorBuffer[rowOffset + x] = 0xFF000000 | (b << 16) | (g << 8) | r;

          mapX += floorStepX;
          mapY += floorStepY;
        }
      } else {
        const shade = Math.max(10, Math.floor(35 * fogMul));
        const color = 0xFF000000 | (shade << 16) | (shade << 8) | shade;
        for (let x = 0; x < bufW; x++) {
          this.floorBuffer[rowOffset + x] = color;
        }
      }
    }

    // 2. 바닥 스캔라인 캐스팅 (y = bufHorizonY ~ bufH - 1)
    for (let y = Math.max(0, bufHorizonY); y < bufH; y++) {
      const p = y - bufHorizonY;
      if (p <= 0) continue;
      const rowDistance = posZ / p;
      const worldDist = rowDistance * scaleToWorld;

      let fog = 0;
      if (worldDist > clearDist) {
        const normDist = Math.min(1.0, Math.max(0, (worldDist - clearDist) / (maxLightDist - clearDist)));
        fog = Math.min(0.85, Math.pow(normDist, 1.25));
      }
      const fogMul = 1.0 - fog;

      const floorStepX = rowDistance * (2 * planeX) / bufW;
      const floorStepY = rowDistance * (2 * planeY) / bufW;

      let mapX = posX + rowDistance * (dirX - planeX);
      let mapY = posY + rowDistance * (dirY - planeY);

      const rowOffset = y * bufW;

      if (floorPixels) {
        for (let x = 0; x < bufW; x++) {
          const tileX = Math.floor(mapX);
          const tileY = Math.floor(mapY);

          // 하행 사다리 트랩도어 핏 타일 바닥 직접 융합 (시점 회전 시 지면과 100% 동기 회전)
          if (map && map.tiles && map.tiles[tileY] && map.tiles[tileY][tileX]) {
            const t = map.tiles[tileY][tileX];
            if (t.type === 'STAIRS_DOWN' || t.char === '>' || t.isStaircase) {
              const u = mapX - tileX;
              const v = mapY - tileY;

              // tex_ladder_pit 트랩도어 텍스처 1:1 직접 매핑
              if (ladderPitPixels && u >= 0.05 && u <= 0.95 && v >= 0.05 && v <= 0.95) {
                const su = Math.floor(((u - 0.05) / 0.90) * 128) & 127;
                const sv = Math.floor(((v - 0.05) / 0.90) * 128) & 127;
                const pixel = ladderPitPixels[(sv << 7) + su];
                const r = ((pixel & 0xFF) * fogMul) | 0;
                const g = (((pixel >> 8) & 0xFF) * fogMul) | 0;
                const b = (((pixel >> 16) & 0xFF) * fogMul) | 0;
                this.floorBuffer[rowOffset + x] = 0xFF000000 | (b << 16) | (g << 8) | r;
                mapX += floorStepX;
                mapY += floorStepY;
                continue;
              }

              // 사방 화강암 연석 (외곽 12% 마진)
              if (u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88) {
                const curbShade = Math.max(16, Math.floor(48 * fogMul));
                this.floorBuffer[rowOffset + x] = 0xFF000000 | (curbShade << 16) | (curbShade << 8) | curbShade;
              } else {
                // 내부 지하 심연 구멍: 칠흑과 깊은 지하 테마별 등불 그라디언트
                let glowR = 245, glowG = 158, glowB = 11;
                if (theme === 'VOLCANIC_FORTRESS') glowR = 251, glowG = 146, glowB = 60;
                else if (theme === 'DARK_ABYSS') glowR = 168, glowG = 85, glowB = 247;
                else if (theme === 'DEEP_ANGBAND') glowR = 239, glowG = 68, glowB = 68;

                const pitDist = Math.hypot(u - 0.5, v - 0.65);
                const glow = Math.max(0.04, 0.28 - pitDist * 0.35);
                const r = Math.min(255, Math.floor((glowR * 0.16) * glow * fogMul + 8 * fogMul));
                const g = Math.min(255, Math.floor((glowG * 0.16) * glow * fogMul + 6 * fogMul));
                const b = Math.min(255, Math.floor((glowB * 0.16) * glow * fogMul + 4 * fogMul));
                this.floorBuffer[rowOffset + x] = 0xFF000000 | (b << 16) | (g << 8) | r;
              }
              mapX += floorStepX;
              mapY += floorStepY;
              continue;
            }
          }

          // 2x2 멀티타일 스케일링
          const tx = (Math.floor(mapX * 64) & 127);
          const ty = (Math.floor(mapY * 64) & 127);
          const pixel = floorPixels[(ty << 7) + tx];

          // 타일 격자 줄눈 (Grout seam) 셰이딩
          const fracX = mapX - Math.floor(mapX);
          const fracY = mapY - Math.floor(mapY);
          const isGrout = (fracX < 0.042 || fracX > 0.958 || fracY < 0.042 || fracY > 0.958);
          const finalFog = isGrout ? fogMul * 0.48 : fogMul;

          const r = ((pixel & 0xFF) * finalFog) | 0;
          const g = (((pixel >> 8) & 0xFF) * finalFog) | 0;
          const b = (((pixel >> 16) & 0xFF) * finalFog) | 0;
          this.floorBuffer[rowOffset + x] = 0xFF000000 | (b << 16) | (g << 8) | r;

          mapX += floorStepX;
          mapY += floorStepY;
        }
      } else {
        const shade = Math.max(14, Math.floor(42 * fogMul));
        const color = 0xFF000000 | (shade << 16) | (shade << 8) | shade;
        for (let x = 0; x < bufW; x++) {
          this.floorBuffer[rowOffset + x] = color;
        }
      }
    }

    if (this.floorCtx && typeof this.floorCtx.putImageData === 'function') {
      this.floorCtx.putImageData(this.floorImageData, 0, 0);
      this.ctx.drawImage(this.floorCanvas, 0, 0, bufW, bufH, 0, 0, this.w, this.h);
    }
  }

  _renderProceduralCeilingAndFloorGradients(horizonY, theme) {
    if (!this.ctx) return;

    // 상단 천장 그라디언트 (웅장한 둥근 석조 아치 볼트 - 명도 상향)
    if (horizonY > 0) {
      const ceilGrad = this.ctx.createLinearGradient(0, 0, 0, horizonY);
      ceilGrad.addColorStop(0, '#0a0e17');
      ceilGrad.addColorStop(0.7, '#141d2d');
      ceilGrad.addColorStop(1, '#1e293b');
      this.ctx.fillStyle = ceilGrad;
      this.ctx.fillRect(0, 0, this.w, horizonY);
    }

    // 하단 바닥 그라디언트 (고대 지하 석조 바닥 - 명도 상향)
    if (horizonY < this.h) {
      const floorGrad = this.ctx.createLinearGradient(0, horizonY, 0, this.h);
      floorGrad.addColorStop(0, '#1e293b');
      floorGrad.addColorStop(0.3, '#172033');
      floorGrad.addColorStop(1, '#0c111a');
      this.ctx.fillStyle = floorGrad;
      this.ctx.fillRect(0, horizonY, this.w, this.h - horizonY);
    }
  }

  /**
   * 1인칭 시점 몬스터 / 엔티티 빌보드 투시 렌더링
   */
  drawEntity(entity, startX, startY, playerX, playerY, floor, playerInstance = null) {
    if (!this.ctx || !entity) return;
    // 플레이어 본인 시점이면 아바타 스프라이트 렌더링 스킵
    if (entity === playerInstance || (entity.x === playerX && entity.y === playerY && entity.isPlayer)) {
      return;
    }
    const posX = entity.visualX ?? entity.x;
    const posY = entity.visualY ?? entity.y;
    this._drawBillboardSprite(posX, posY, entity.char, entity.color, playerX, playerY, false);
  }

  /**
   * 1인칭 시점 아이템 빌보드 렌더링
   */
  drawItem(item, startX, startY, playerX, playerY, floor, map = null) {
    if (!this.ctx || !item) return;
    const posX = item.visualX ?? item.x;
    const posY = item.visualY ?? item.y;
    this._drawBillboardSprite(posX, posY, item.char, item.color, playerX, playerY, true);
  }

  /**
   * 2.5D 빌보드 스프라이트 투영 및 Z-Buffer 오클루전 가드
   */
  _drawBillboardSprite(objX, objY, char, color, playerX, playerY, isItem = false) {
    if (!this.ctx) return;

    const posX = playerX + 0.5;
    const posY = playerY + 0.5;

    const spriteX = (objX + 0.5) - posX;
    const spriteY = (objY + 0.5) - posY;

    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);
    const planeScale = Math.tan(this.fov / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.25) return; // 카메라 뒤쪽 및 초근접 컬링

    const spriteScreenX = Math.floor((this.w / 2) * (1 + transformX / transformY));
    const spriteSize = Math.abs(Math.floor(this.h / transformY));

    // Z-Buffer 가드: 스프라이트 중심점이 화면 안에 있고 벽보다 앞에 있는지 확인
    if (spriteScreenX < 0 || spriteScreenX >= this.w) return;
    if (transformY >= this.depthBuffer[spriteScreenX]) return; // 벽 뒤에 가려짐

    // 2.5D 빌보드 문자 심볼 렌더링
    this.ctx.save();
    const fontSize = Math.max(12, Math.min(180, Math.floor(spriteSize * 0.75)));
    this.ctx.font = `bold ${fontSize}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const horizonY = Math.floor(this.h / 2 + (this.pitch || 0) + (this.walkBob || 0));
    const drawY = horizonY + (isItem ? spriteSize * 0.22 : 0);
    
    // 심연/원거리 안개 감쇄 (유저 광원량 currentLightRange 비례 연동)
    const lr = this.currentLightRange || 4.0;
    const clearDist = Math.max(1.2, lr * 1.5);
    const maxLightDist = Math.max(4.0, lr * 3.5);
    let fog = 0;
    if (transformY > clearDist) {
      const normDist = Math.min(1.0, Math.max(0, (transformY - clearDist) / (maxLightDist - clearDist)));
      fog = Math.min(0.68, Math.pow(normDist, 1.2));
    }
    this.ctx.globalAlpha = Math.max(0.32, 1.0 - fog);

    this.ctx.fillStyle = color || '#ffffff';
    this.ctx.shadowColor = '#000000';
    this.ctx.shadowBlur = 8;
    this.ctx.fillText(char || '?', spriteScreenX, drawY);
    this.ctx.restore();
  }

  /**
   * 우측 상단 미니맵 나침반 레이더 오버레이
   */
  _drawCompassRadar(map, playerX, playerY) {
    if (!this.ctx) return;

    const radarR = 48;
    const cx = this.w - radarR - 16;
    const cy = radarR + 64;

    this.ctx.save();

    // 1. 레이더 배경 원
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radarR, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // 2. 반경 5타일 미니맵 격자 도트 렌더링
    const radarScale = radarR / 6;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5.2) continue;

        const gx = playerX + dx;
        const gy = playerY + dy;
        const px = cx + dx * radarScale;
        const py = cy + dy * radarScale;

        let isWall = false;
        if (map) {
          if (typeof map.isWall === 'function') {
            isWall = map.isWall(gx, gy);
          } else if (map.tiles && map.tiles[gy] && map.tiles[gy][gx]) {
            isWall = map.tiles[gy][gx].type === 'WALL';
          }
        }

        if (isWall) {
          this.ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
          this.ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
    }

    // 2-1. 반경 내 계단 인디케이터 (◆ 하행: #f43f5e, 상행: #38bdf8)
    const { downStairs, upStairs } = this._getStairLocations(map);
    for (const s of downStairs) {
      const dx = s.x - playerX;
      const dy = s.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 5.5) {
        const px = cx + dx * radarScale;
        const py = cy + dy * radarScale;
        this._drawRadarStairDiamond(px, py, '#f43f5e', '#fda4af');
      }
    }
    for (const s of upStairs) {
      const dx = s.x - playerX;
      const dy = s.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 5.5) {
        const px = cx + dx * radarScale;
        const py = cy + dy * radarScale;
        this._drawRadarStairDiamond(px, py, '#38bdf8', '#bae6fd');
      }
    }

    // 3. 부채꼴 시야각(FOV 66도) 콘 렌더링
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.arc(cx, cy, radarR - 4, this.playerAngle - this.fov / 2, this.playerAngle + this.fov / 2);
    this.ctx.closePath();
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    this.ctx.fill();

    // 4. 시선 방향 화살표
    const arrowLen = 22;
    const ax = cx + Math.cos(this.playerAngle) * arrowLen;
    const ay = cy + Math.sin(this.playerAngle) * arrowLen;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(ax, ay);
    this.ctx.strokeStyle = '#fbbf24';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    // 플레이어 중심 점
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fill();

    this.ctx.restore();
  }

  _drawRadarStairDiamond(px, py, fill, glow) {
    const d = 5.5;
    this.ctx.save();
    this.ctx.shadowColor = glow;
    this.ctx.shadowBlur = 12;
    this.ctx.fillStyle = fill;
    this.ctx.beginPath();
    this.ctx.moveTo(px, py - d);
    this.ctx.lineTo(px + d, py);
    this.ctx.lineTo(px, py + d);
    this.ctx.lineTo(px - d, py);
    this.ctx.closePath();
    this.ctx.fill();

    // 외곽 네온 펄스 링 (Halo Ring)
    this.ctx.strokeStyle = glow;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(px, py - d - 3);
    this.ctx.lineTo(px + d + 3, py);
    this.ctx.lineTo(px, py + d + 3);
    this.ctx.lineTo(px - d - 3, py);
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.restore();
  }

  _getStairLocations(map) {
    const downStairs = [];
    const upStairs = [];

    if (!map) return { downStairs, upStairs };

    if (map.downStaircases && Array.isArray(map.downStaircases)) {
      for (const s of map.downStaircases) {
        downStairs.push({ x: s.x, y: s.y, type: 'STAIRS_DOWN' });
      }
    }
    if (map.upStaircases && Array.isArray(map.upStaircases)) {
      for (const s of map.upStaircases) {
        upStairs.push({ x: s.x, y: s.y, type: 'STAIRS_UP', isSealed: !!s.isSealed });
      }
    }

    if (downStairs.length === 0 && upStairs.length === 0 && map.tiles) {
      for (let y = 0; y < (map.height || map.tiles.length); y++) {
        const row = map.tiles[y];
        if (!row) continue;
        for (let x = 0; x < (map.width || row.length); x++) {
          const tile = row[x];
          if (!tile) continue;
          if (tile.type === 'STAIRS_DOWN' || tile.char === '>' || tile.isStaircase) {
            downStairs.push({ x, y, type: 'STAIRS_DOWN' });
          } else if (tile.type === 'STAIRS_UP' || tile.char === '<' || tile.isUpStaircase) {
            upStairs.push({ x, y, type: 'STAIRS_UP', isSealed: !!tile.isSealed });
          }
        }
      }
    }

    return { downStairs, upStairs };
  }

  _drawVoxelLadders(map, playerX, playerY, theme = 'CAVE_RUINS') {
    if (!this.ctx || !map) return;

    const { downStairs, upStairs } = this._getStairLocations(map);
    const allStairs = [...downStairs, ...upStairs];
    if (allStairs.length === 0) return;

    const posX = this.camX !== undefined ? this.camX : (playerX + 0.5);
    const posY = this.camY !== undefined ? this.camY : (playerY + 0.5);
    const totalPitch = (this.pitch || 0) + (this.walkBob || 0);

    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);
    const planeScale = Math.tan(this.fov / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    const stairsWithDist = [];
    for (const stair of allStairs) {
      const stairX = (stair.x + 0.5) - posX;
      const stairY = (stair.y + 0.5) - posY;

      const invDet = 1.0 / (planeX * dirY - dirX * planeY || 0.0001);
      const transformX = invDet * (dirY * stairX - dirX * stairY);
      const transformY = invDet * (-planeY * stairX + planeX * stairY);

      if (transformY <= 0.20) continue; // 카메라 후방 또는 근접 클리핑

      const screenX = Math.floor((this.w / 2) * (1 + transformX / transformY));
      if (screenX < -300 || screenX >= this.w + 300) continue;

      // Z-Buffer 차폐 검사
      if (this.depthBuffer) {
        const checkCol = Math.max(0, Math.min(this.w - 1, screenX));
        if (this.depthBuffer[checkCol] < transformY - 0.25) continue;
      }

      stairsWithDist.push({
        ...stair,
        stairX,
        stairY,
        transformX,
        transformY,
        screenX
      });
    }

    // 원거리 계단/사다리부터 화가 알고리즘(Painter's Algorithm) 정렬
    stairsWithDist.sort((a, b) => b.transformY - a.transformY);

    for (const stair of stairsWithDist) {
      this._renderSingleVoxelLadder(stair, map.floor || 1, posX, posY, dirX, dirY, planeX, planeY, totalPitch, theme);
    }
  }

  _drawVoxelStairs(map, playerX, playerY, theme = 'CAVE_RUINS') {
    return this._drawVoxelLadders(map, playerX, playerY, theme);
  }

  _isReadyTexture(tex) {
    if (!tex) return false;
    if (typeof HTMLCanvasElement !== 'undefined' && tex instanceof HTMLCanvasElement) return true;
    const isImage = (typeof HTMLImageElement !== 'undefined' && tex instanceof HTMLImageElement) ||
                    (typeof Image !== 'undefined' && tex instanceof Image) ||
                    tex.complete !== undefined;
    return isImage ? (tex.complete && (tex.naturalWidth > 0 || tex.width > 0)) : true;
  }

  /**
   * 월드 3D 좌표 (wx, wy, wz)를 스크린 좌표 (sx, sy)로 사영 변환
   * @param {number} wx - 그리드 X
   * @param {number} wy - 그리드 Y
   * @param {number} wz - 수직 높이 (0.0=바닥, 0.5=눈높이, 1.0=천장)
   */
  _projectWorldPoint(wx, wy, wz, posX, posY, dirX, dirY, planeX, planeY, totalPitch = 0) {
    const rx = wx - posX;
    const ry = wy - posY;

    const invDet = 1.0 / (planeX * dirY - dirX * planeY || 0.0001);
    const camX = invDet * (dirY * rx - dirX * ry);
    const camY = invDet * (-planeY * rx + planeX * ry);

    if (camY <= 0.12) {
      return null; // 카메라 후방 및 클리핑 평면
    }

    const horizonY = Math.floor(this.h / 2 + totalPitch);
    const sx = (this.w / 2) * (1 + camX / camY);
    const sy = horizonY - ((wz - 0.5) * this.h) / camY;

    return {
      sx,
      sy,
      depth: camY,
      visible: (sx >= -200 && sx <= this.w + 200 && sy >= -200 && sy <= this.h + 200)
    };
  }

  /**
   * 월드 4개 정점 사각 다면체 투영 렌더링
   */
  _render3DQuad(ctx, p1, p2, p3, p4, fillColor, strokeColor, posX, posY, dirX, dirY, planeX, planeY, totalPitch, strokeWidth = 1) {
    const s1 = this._projectWorldPoint(p1[0], p1[1], p1[2], posX, posY, dirX, dirY, planeX, planeY, totalPitch);
    const s2 = this._projectWorldPoint(p2[0], p2[1], p2[2], posX, posY, dirX, dirY, planeX, planeY, totalPitch);
    const s3 = this._projectWorldPoint(p3[0], p3[1], p3[2], posX, posY, dirX, dirY, planeX, planeY, totalPitch);
    const s4 = this._projectWorldPoint(p4[0], p4[1], p4[2], posX, posY, dirX, dirY, planeX, planeY, totalPitch);

    if (!s1 || !s2 || !s3 || !s4) return;
    if (!s1.visible && !s2.visible && !s3.visible && !s4.visible) return;

    // Z-Buffer 차폐 검사
    const avgDepth = (s1.depth + s2.depth + s3.depth + s4.depth) * 0.25;
    const avgSx = Math.floor((s1.sx + s2.sx + s3.sx + s4.sx) * 0.25);
    if (this.depthBuffer && avgSx >= 0 && avgSx < this.w) {
      if (this.depthBuffer[avgSx] < avgDepth - 0.25) {
        return; // 벽 뒤에 가려짐
      }
    }

    ctx.beginPath();
    ctx.moveTo(s1.sx, s1.sy);
    ctx.lineTo(s2.sx, s2.sy);
    ctx.lineTo(s3.sx, s3.sy);
    ctx.lineTo(s4.sx, s4.sy);
    ctx.closePath();

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  _renderSingleVoxelLadder(stair, currentFloor = 1, posX = null, posY = null, dirX = null, dirY = null, planeX = null, planeY = null, totalPitch = null, theme = 'CAVE_RUINS') {
    const ctx = this.ctx;
    const isDown = stair.type === 'STAIRS_DOWN';
    const transformY = stair.transformY;

    // 유저 광원량 기반 안개 감쇄 및 투명도 계산
    const lr = this.currentLightRange || 4.0;
    const clearDist = Math.max(1.2, lr * 1.5);
    const maxLightDist = Math.max(4.0, lr * 3.5);
    let fog = 0;
    if (transformY > clearDist) {
      const normDist = Math.min(1.0, Math.max(0, (transformY - clearDist) / (maxLightDist - clearDist)));
      fog = Math.min(0.75, Math.pow(normDist, 1.25));
    }
    const fogMul = 1.0 - fog;

    const effPitch = totalPitch !== null ? totalPitch : ((this.pitch || 0) + (this.walkBob || 0));
    const pX = posX !== null ? posX : (this.camX !== undefined ? this.camX : 0);
    const pY = posY !== null ? posY : (this.camY !== undefined ? this.camY : 0);
    const dX = dirX !== null ? dirX : Math.cos(this.playerAngle);
    const dY = dirY !== null ? dirY : Math.sin(this.playerAngle);
    const pScale = Math.tan(this.fov / 2);
    const plX = planeX !== null ? planeX : -dY * pScale;
    const plY = planeY !== null ? planeY : dX * pScale;

    ctx.save();
    ctx.globalAlpha = Math.max(0.20, fogMul);

    if (isDown) {
      this._renderDownLadder3D(ctx, stair.x, stair.y, pX, pY, dX, dY, plX, plY, effPitch, fogMul, theme);
    } else {
      this._renderUpLadder3D(ctx, stair.x, stair.y, pX, pY, dX, dY, plX, plY, effPitch, fogMul, theme);
    }

    ctx.restore();
  }

  _renderSingleVoxelStair(stair, currentFloor = 1, posX = null, posY = null, dirX = null, dirY = null, planeX = null, planeY = null, totalPitch = null, theme = 'CAVE_RUINS') {
    return this._renderSingleVoxelLadder(stair, currentFloor, posX, posY, dirX, dirY, planeX, planeY, totalPitch, theme);
  }

  /**
   * 월드 좌표계 100% 고정형 하행 사다리(Trapdoor Pit & Ladder) 3D 다면체 렌더링
   */
  _renderDownLadder3D(ctx, tx, ty, posX, posY, dirX, dirY, planeX, planeY, totalPitch, fogMul, theme = 'CAVE_RUINS') {
    const q = (p1, p2, p3, p4, col, stroke, sw = 1) => {
      this._render3DQuad(ctx, p1, p2, p3, p4, col, stroke, posX, posY, dirX, dirY, planeX, planeY, totalPitch, sw);
    };

    const isIron = (theme === 'VOLCANIC_FORTRESS' || theme === 'DARK_ABYSS' || theme === 'DEEP_ANGBAND');
    const curbCol = `rgba(${Math.floor(51 * fogMul)}, ${Math.floor(65 * fogMul)}, ${Math.floor(85 * fogMul)}, 0.95)`;
    const curbDark = `rgba(${Math.floor(30 * fogMul)}, ${Math.floor(41 * fogMul)}, ${Math.floor(59 * fogMul)}, 0.95)`;
    const curbStroke = `rgba(${Math.floor(71 * fogMul)}, ${Math.floor(85 * fogMul)}, ${Math.floor(105 * fogMul)}, 0.8)`;

    const handleCol = isIron
      ? `rgba(${Math.floor(100 * fogMul)}, ${Math.floor(116 * fogMul)}, ${Math.floor(139 * fogMul)}, 0.95)`
      : `rgba(${Math.floor(180 * fogMul)}, ${Math.floor(83 * fogMul)}, ${Math.floor(9 * fogMul)}, 0.95)`;
    const handleDark = isIron
      ? `rgba(${Math.floor(39 * fogMul)}, ${Math.floor(45 * fogMul)}, ${Math.floor(55 * fogMul)}, 0.95)`
      : `rgba(${Math.floor(90 * fogMul)}, ${Math.floor(38 * fogMul)}, ${Math.floor(8 * fogMul)}, 0.95)`;
    const rungCol = isIron
      ? `rgba(${Math.floor(148 * fogMul)}, ${Math.floor(163 * fogMul)}, ${Math.floor(184 * fogMul)}, 0.95)`
      : `rgba(${Math.floor(217 * fogMul)}, ${Math.floor(119 * fogMul)}, ${Math.floor(6 * fogMul)}, 0.95)`;

    // 1. 사방 지면 보호 연석 (Safety Curb Rim: z in [0.0, 0.08])
    const cz = 0.08;
    q([tx+0.08, ty+0.08, cz], [tx+0.92, ty+0.08, cz], [tx+0.92, ty+0.16, cz], [tx+0.08, ty+0.16, cz], curbCol, curbStroke);
    q([tx+0.08, ty+0.84, cz], [tx+0.92, ty+0.84, cz], [tx+0.92, ty+0.92, cz], [tx+0.08, ty+0.92, cz], curbCol, curbStroke);
    q([tx+0.08, ty+0.16, cz], [tx+0.16, ty+0.16, cz], [tx+0.16, ty+0.84, cz], [tx+0.08, ty+0.84, cz], curbCol, curbStroke);
    q([tx+0.84, ty+0.16, cz], [tx+0.92, ty+0.16, cz], [tx+0.92, ty+0.84, cz], [tx+0.84, ty+0.84, cz], curbCol, curbStroke);

    // 2. 지면 위로 솟아오른 3D 사다리 안전 손잡이 (Top Ladder Handles: z in [0.0, 0.20])
    q([tx+0.32, ty+0.68, 0.0], [tx+0.37, ty+0.68, 0.0], [tx+0.37, ty+0.68, 0.20], [tx+0.32, ty+0.68, 0.20], handleCol, curbStroke);
    q([tx+0.32, ty+0.74, 0.0], [tx+0.32, ty+0.68, 0.0], [tx+0.32, ty+0.68, 0.20], [tx+0.32, ty+0.74, 0.20], handleDark, curbStroke);
    q([tx+0.63, ty+0.68, 0.0], [tx+0.68, ty+0.68, 0.0], [tx+0.68, ty+0.68, 0.20], [tx+0.63, ty+0.68, 0.20], handleCol, curbStroke);
    q([tx+0.68, ty+0.68, 0.0], [tx+0.68, ty+0.74, 0.0], [tx+0.68, ty+0.74, 0.20], [tx+0.68, ty+0.68, 0.20], handleDark, curbStroke);

    // 3. 지하 심연 함몰 갱도 (Shaft Base at z = -0.65)
    const pitBase = `rgba(${Math.floor(9 * fogMul)}, ${Math.floor(13 * fogMul)}, ${Math.floor(22 * fogMul)}, 0.95)`;
    q([tx+0.16, ty+0.16, -0.65], [tx+0.84, ty+0.16, -0.65], [tx+0.84, ty+0.84, -0.65], [tx+0.16, ty+0.84, -0.65], pitBase, null);

    // 4. 지하로 곧게 뻗어 내려가는 사다리 수직 레일 (Stiles: z in [-0.65, 0.0])
    q([tx+0.32, ty+0.68, -0.65], [tx+0.37, ty+0.68, -0.65], [tx+0.37, ty+0.68, 0.0], [tx+0.32, ty+0.68, 0.0], handleDark, null);
    q([tx+0.63, ty+0.68, -0.65], [tx+0.68, ty+0.68, -0.65], [tx+0.68, ty+0.68, 0.0], [tx+0.63, ty+0.68, 0.0], handleDark, null);

    // 5. 지하로 내려가는 4단계 수평 3D 발판 렁 (Rungs at z = 0.0, -0.15, -0.30, -0.45)
    const downRungZ = [0.0, -0.15, -0.30, -0.45];
    for (const rz of downRungZ) {
      q([tx+0.37, ty+0.68, rz], [tx+0.63, ty+0.68, rz], [tx+0.63, ty+0.68, rz + 0.03], [tx+0.37, ty+0.68, rz + 0.03], rungCol, curbStroke);
      q([tx+0.37, ty+0.68, rz + 0.03], [tx+0.63, ty+0.68, rz + 0.03], [tx+0.63, ty+0.72, rz + 0.03], [tx+0.37, ty+0.72, rz + 0.03], rungCol, null);
    }

    // 6. 지하 깊은 곳의 따스한 테마별 등불 앰비언트 글로우
    let glowR = 245, glowG = 158, glowB = 11;
    if (theme === 'VOLCANIC_FORTRESS') glowR = 251, glowG = 146, glowB = 60;
    else if (theme === 'DARK_ABYSS') glowR = 168, glowG = 85, glowB = 247;
    else if (theme === 'DEEP_ANGBAND') glowR = 239, glowG = 68, glowB = 68;

    const glowCenter = this._projectWorldPoint(tx + 0.5, ty + 0.65, -0.60, posX, posY, dirX, dirY, planeX, planeY, totalPitch);
    if (glowCenter && glowCenter.visible) {
      const glowRad = Math.max(10, Math.min(80, (this.h / glowCenter.depth) * 0.28));
      const glowGrad = ctx.createRadialGradient(glowCenter.sx, glowCenter.sy, 2, glowCenter.sx, glowCenter.sy, glowRad);
      glowGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${0.40 * fogMul})`);
      glowGrad.addColorStop(0.5, `rgba(${Math.floor(glowR * 0.8)}, ${Math.floor(glowG * 0.6)}, ${Math.floor(glowB * 0.4)}, ${0.18 * fogMul})`);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(glowCenter.sx - glowRad, glowCenter.sy - glowRad, glowRad * 2, glowRad * 2);
    }
  }

  /**
   * 바닥(z=0.0)부터 천장 개구부 위(z=1.05)까지 관통하는 3D 복셀 상행 사다리 렌더링
   */
  _renderUpLadder3D(ctx, tx, ty, posX, posY, dirX, dirY, planeX, planeY, totalPitch, fogMul, theme = 'CAVE_RUINS') {
    const q = (p1, p2, p3, p4, col, stroke, sw = 1) => {
      this._render3DQuad(ctx, p1, p2, p3, p4, col, stroke, posX, posY, dirX, dirY, planeX, planeY, totalPitch, sw);
    };

    const isIron = (theme === 'VOLCANIC_FORTRESS' || theme === 'DARK_ABYSS' || theme === 'DEEP_ANGBAND');
    let stileFront, stileSide, stileTop, rungFront, rungTop, rungDark, bandCol, strokeCol;
    if (isIron) {
      stileFront = `rgba(${Math.floor(71 * fogMul)}, ${Math.floor(85 * fogMul)}, ${Math.floor(105 * fogMul)}, 0.95)`;
      stileSide = `rgba(${Math.floor(39 * fogMul)}, ${Math.floor(45 * fogMul)}, ${Math.floor(55 * fogMul)}, 0.95)`;
      stileTop = `rgba(${Math.floor(148 * fogMul)}, ${Math.floor(163 * fogMul)}, ${Math.floor(184 * fogMul)}, 0.95)`;
      rungFront = `rgba(${Math.floor(100 * fogMul)}, ${Math.floor(116 * fogMul)}, ${Math.floor(139 * fogMul)}, 0.95)`;
      rungTop = `rgba(${Math.floor(161 * fogMul)}, ${Math.floor(161 * fogMul)}, ${Math.floor(170 * fogMul)}, 0.95)`;
      rungDark = `rgba(${Math.floor(24 * fogMul)}, ${Math.floor(24 * fogMul)}, ${Math.floor(27 * fogMul)}, 0.95)`;
      bandCol = `rgba(${Math.floor(30 * fogMul)}, ${Math.floor(41 * fogMul)}, ${Math.floor(59 * fogMul)}, 0.95)`;
      strokeCol = `rgba(${Math.floor(15 * fogMul)}, ${Math.floor(23 * fogMul)}, ${Math.floor(42 * fogMul)}, 0.8)`;
    } else {
      stileFront = `rgba(${Math.floor(146 * fogMul)}, ${Math.floor(64 * fogMul)}, ${Math.floor(14 * fogMul)}, 0.95)`;
      stileSide = `rgba(${Math.floor(90 * fogMul)}, ${Math.floor(38 * fogMul)}, ${Math.floor(8 * fogMul)}, 0.95)`;
      stileTop = `rgba(${Math.floor(180 * fogMul)}, ${Math.floor(83 * fogMul)}, ${Math.floor(9 * fogMul)}, 0.95)`;
      rungFront = `rgba(${Math.floor(217 * fogMul)}, ${Math.floor(119 * fogMul)}, ${Math.floor(6 * fogMul)}, 0.95)`;
      rungTop = `rgba(${Math.floor(245 * fogMul)}, ${Math.floor(158 * fogMul)}, ${Math.floor(11 * fogMul)}, 0.95)`;
      rungDark = `rgba(${Math.floor(69 * fogMul)}, ${Math.floor(26 * fogMul)}, ${Math.floor(3 * fogMul)}, 0.95)`;
      bandCol = `rgba(${Math.floor(63 * fogMul)}, ${Math.floor(63 * fogMul)}, ${Math.floor(70 * fogMul)}, 0.95)`;
      strokeCol = `rgba(${Math.floor(40 * fogMul)}, ${Math.floor(20 * fogMul)}, ${Math.floor(5 * fogMul)}, 0.8)`;
    }

    // 1. 좌우 수직 3D 사다리 레일 기둥 (Floor-to-Ceiling Stiles: z in [0.0, 1.05])
    // Left Stile: x in [tx+0.32, tx+0.38], y in [ty+0.70, ty+0.76], z in [0.0, 1.05]
    q([tx+0.32, ty+0.70, 0.0], [tx+0.38, ty+0.70, 0.0], [tx+0.38, ty+0.70, 1.05], [tx+0.32, ty+0.70, 1.05], stileFront, strokeCol);
    q([tx+0.32, ty+0.76, 0.0], [tx+0.32, ty+0.70, 0.0], [tx+0.32, ty+0.70, 1.05], [tx+0.32, ty+0.76, 1.05], stileSide, strokeCol);
    q([tx+0.38, ty+0.70, 0.0], [tx+0.38, ty+0.76, 0.0], [tx+0.38, ty+0.76, 1.05], [tx+0.38, ty+0.70, 1.05], stileSide, strokeCol);
    q([tx+0.32, ty+0.70, 1.05], [tx+0.38, ty+0.70, 1.05], [tx+0.38, ty+0.76, 1.05], [tx+0.32, ty+0.76, 1.05], stileTop, strokeCol);

    // Right Stile: x in [tx+0.62, tx+0.68], y in [ty+0.70, ty+0.76], z in [0.0, 1.05]
    q([tx+0.62, ty+0.70, 0.0], [tx+0.68, ty+0.70, 0.0], [tx+0.68, ty+0.70, 1.05], [tx+0.62, ty+0.70, 1.05], stileFront, strokeCol);
    q([tx+0.62, ty+0.76, 0.0], [tx+0.62, ty+0.70, 0.0], [tx+0.62, ty+0.70, 1.05], [tx+0.62, ty+0.76, 1.05], stileSide, strokeCol);
    q([tx+0.68, ty+0.70, 0.0], [tx+0.68, ty+0.76, 0.0], [tx+0.68, ty+0.76, 1.05], [tx+0.68, ty+0.70, 1.05], stileSide, strokeCol);
    q([tx+0.62, ty+0.70, 1.05], [tx+0.68, ty+0.70, 1.05], [tx+0.68, ty+0.76, 1.05], [tx+0.62, ty+0.76, 1.05], stileTop, strokeCol);

    // 2. 7단계 수평 가로 발판 렁 (7 Horizontal 3D Rungs: z in [0.15, 0.30, 0.45, 0.60, 0.75, 0.90, 1.05])
    const rungsZ = [0.15, 0.30, 0.45, 0.60, 0.75, 0.90, 1.05];
    for (const rz of rungsZ) {
      q([tx+0.38, ty+0.70, rz], [tx+0.62, ty+0.70, rz], [tx+0.62, ty+0.70, rz + 0.035], [tx+0.38, ty+0.70, rz + 0.035], rungFront, strokeCol);
      q([tx+0.38, ty+0.70, rz + 0.035], [tx+0.62, ty+0.70, rz + 0.035], [tx+0.62, ty+0.74, rz + 0.035], [tx+0.38, ty+0.74, rz + 0.035], rungTop, strokeCol);
      q([tx+0.38, ty+0.74, rz], [tx+0.62, ty+0.74, rz], [tx+0.62, ty+0.70, rz], [tx+0.38, ty+0.70, rz], rungDark, null);
    }

    // 3. 벽면 고정 철제 브래킷 (Wall Anchor Brackets at z = 0.40, z = 0.85)
    const bracketZ = [0.40, 0.85];
    for (const bz of bracketZ) {
      q([tx+0.32, ty+0.76, bz], [tx+0.38, ty+0.76, bz], [tx+0.38, ty+0.85, bz], [tx+0.32, ty+0.85, bz], bandCol, strokeCol);
      q([tx+0.62, ty+0.76, bz], [tx+0.68, ty+0.76, bz], [tx+0.68, ty+0.85, bz], [tx+0.62, ty+0.85, bz], bandCol, strokeCol);
    }

    // 4. 천장 개구부에서 쏟아져 내리는 테마별 채광 (Skylight Volumetric Light)
    let skyR = 224, skyG = 242, skyB = 254;
    if (theme === 'VOLCANIC_FORTRESS') skyR = 251, skyG = 146, skyB = 60;
    else if (theme === 'MINES_CATACOMBS') skyR = 245, skyG = 158, skyB = 11;
    else if (theme === 'DARK_ABYSS') skyR = 168, skyG = 85, skyB = 247;
    else if (theme === 'DEEP_ANGBAND') skyR = 239, skyG = 68, skyB = 68;

    const skylightTop = this._projectWorldPoint(tx + 0.5, ty + 0.72, 1.05, posX, posY, dirX, dirY, planeX, planeY, totalPitch);
    const skylightBase = this._projectWorldPoint(tx + 0.5, ty + 0.50, 0.0, posX, posY, dirX, dirY, planeX, planeY, totalPitch);
    if (skylightTop && skylightBase && skylightTop.visible && skylightBase.visible) {
      const coneW = Math.max(16, Math.min(110, (this.h / skylightTop.depth) * 0.42));
      const lightGrad = ctx.createLinearGradient(skylightTop.sx, skylightTop.sy, skylightBase.sx, skylightBase.sy);
      lightGrad.addColorStop(0, `rgba(${skyR}, ${skyG}, ${skyB}, ${0.35 * fogMul})`);
      lightGrad.addColorStop(0.5, `rgba(${Math.floor(skyR * 0.85)}, ${Math.floor(skyG * 0.85)}, ${Math.floor(skyB * 0.85)}, ${0.15 * fogMul})`);
      lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(skylightTop.sx - coneW * 0.35, skylightTop.sy);
      ctx.lineTo(skylightTop.sx + coneW * 0.35, skylightTop.sy);
      ctx.lineTo(skylightBase.sx + coneW * 0.75, skylightBase.sy);
      ctx.lineTo(skylightBase.sx - coneW * 0.75, skylightBase.sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * 동적 3D 계단/사다리 구조체 캐시 클리어
   */
  clearDynamicStairs() {
    this.dynamicStairs = [];
  }

  /**
   * 계단 오브젝트로부터 3D 렌더링 지오메트리 메타데이터 생성
   * @param {Object} stair - 계단 위치 및 타입 정보
   * @param {number} [currentFloor=1] - 던전 현재 층
   * @returns {Object|null} 계단 지오메트리 정보
   */
  buildStaircaseGeometry(stair, currentFloor = 1) {
    if (!stair) return null;
    return {
      x: stair.x,
      y: stair.y,
      type: stair.type,
      floor: currentFloor,
      isSealed: !!stair.isSealed,
      transformY: stair.transformY !== undefined ? stair.transformY : 0
    };
  }

  /**
   * 게임 상태로부터 동적 3D 계단 구조체 목록 갱신
   * @param {Object} game - 활성 게임 인스턴스
   */
  updateDynamicStairs(game) {
    this.clearDynamicStairs();
    const map = game?.map;
    if (!map) return;
    const { downStairs, upStairs } = this._getStairLocations(map);
    const currentFloor = game?.floor || map?.floor || 1;
    for (const s of downStairs) {
      const geom = this.buildStaircaseGeometry(s, currentFloor);
      if (geom) this.dynamicStairs.push(geom);
    }
    for (const s of upStairs) {
      const geom = this.buildStaircaseGeometry(s, currentFloor);
      if (geom) this.dynamicStairs.push(geom);
    }
  }

  /**
   * 빌보드 깊이 정렬(Painter\'s Algorithm) 및 시각적 선형 보간(Visual Lerp) 좌표 반영
   * @param {Object|Array} monstersOrGame - 게임 인스턴스 또는 몬스터 배열
   * @param {Array} [items=null] - 아이템 배열 (1번째 인자가 몬스터 배열일 때)
   * @param {number} [playerX=null] - 플레이어 X 좌표
   * @param {number} [playerY=null] - 플레이어 Y 좌표
   * @returns {Array} 정렬된 빌보드 리스트
   */
  updateBillboards(monstersOrGame, items = null, playerX = null, playerY = null) {
    let monsters = [];
    let groundItems = [];
    let px = playerX;
    let py = playerY;

    if (monstersOrGame && monstersOrGame.player) {
      const game = monstersOrGame;
      monsters = game.monsters || [];
      groundItems = game.items || [];
      px = px !== null && px !== undefined ? px : (game.player.visualX ?? game.player.x);
      py = py !== null && py !== undefined ? py : (game.player.visualY ?? game.player.y);
      this.lastGame = game;
    } else if (Array.isArray(monstersOrGame)) {
      monsters = monstersOrGame;
      groundItems = Array.isArray(items) ? items : [];
    }

    if (px === null || px === undefined) px = this.camX ?? 0;
    if (py === null || py === undefined) py = this.camY ?? 0;

    const billboards = [];

    // 1. 몬스터 빌보드 (visualX, visualY 선형 보간 좌표 우선)
    for (const m of monsters) {
      if (!m || m.isDead || (m.stats && m.stats.hp <= 0)) continue;
      const mx = m.visualX ?? m.x;
      const my = m.visualY ?? m.y;
      const dx = mx - px;
      const dy = my - py;
      const distSq = dx * dx + dy * dy;
      billboards.push({
        type: "monster",
        entity: m,
        monster: m,
        x: mx,
        y: my,
        distSq,
        renderOrder: -Math.round(distSq * 100),
        depthTest: true,
        alphaTest: 0.5,
        char: m.char,
        color: m.color
      });
    }

    // 2. 아이템 빌보드 (visualX, visualY 선형 보간 좌표 우선)
    for (const it of groundItems) {
      if (!it) continue;
      const ix = it.visualX ?? it.x;
      const iy = it.visualY ?? it.y;
      const dx = ix - px;
      const dy = iy - py;
      const distSq = dx * dx + dy * dy;
      billboards.push({
        type: "item",
        entity: it,
        item: it,
        x: ix,
        y: iy,
        distSq,
        renderOrder: -Math.round(distSq * 100),
        depthTest: true,
        alphaTest: 0.5,
        char: it.char,
        color: it.color
      });
    }

    // 3. 거리 역순(distSq 내림차순, Back-to-Front Painter\'s Algorithm) 정렬
    billboards.sort((a, b) => b.distSq - a.distSq);

    this.activeBillboards = billboards;

    // 4. 컨텍스트가 존재하면 빌보드 렌더링 수행
    if (this.ctx) {
      for (const b of billboards) {
        this._drawBillboardSprite(b.x, b.y, b.char, b.color, px, py, b.type === "item");
      }
    }

    return billboards;
  }

  /**
   * 계단 도착 인게임 안내 프롬프트 배너 (화면 중앙 하단)
   */
  _drawStairArrivalPrompt(map, playerX, playerY) {
    if (!this.ctx || !map || !map.tiles) return;
    const row = map.tiles[playerY];
    if (!row) return;
    const tile = row[playerX];
    if (!tile) return;

    let promptText = null;
    let strokeColor = null;
    let glowColor = null;

    if (tile.type === 'STAIRS_DOWN' || tile.char === '>' || tile.isStaircase) {
      promptText = "🪜 [하행 사다리 도착]: '>' 키로 아래층 이동";
      strokeColor = '#f43f5e';
      glowColor = 'rgba(244, 63, 94, 0.90)';
    } else if (tile.type === 'STAIRS_UP' || tile.char === '<' || tile.isUpStaircase) {
      promptText = "🪜 [상행 사다리 도착]: '<' 키로 위층 이동";
      strokeColor = '#38bdf8';
      glowColor = 'rgba(56, 189, 248, 0.90)';
    }

    if (!promptText) return;

    const ctx = this.ctx;
    ctx.save();
    const fontSize = Math.max(13, Math.min(20, Math.floor(this.w * 0.024)));
    ctx.font = `bold ${fontSize}px 'Fira Code', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText ? ctx.measureText(promptText).width : fontSize * 24;
    const padX = 18;
    const padY = 9;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize + padY * 2;
    const boxX = this.w / 2 - boxW / 2;
    const boxY = this.h - boxH - 28;

    ctx.fillStyle = 'rgba(10, 14, 24, 0.92)';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(promptText, this.w / 2, boxY + boxH / 2);

    ctx.restore();
  }

  updateParticles(dt) {
    // 1인칭 모드 파티클 확장 훅
  }

  /**
   * 1인칭 3D 뷰포트 레이캐스트 픽킹 (마우스/터치 클릭 좌표 -> 타일, 몬스터, 아이템 검색)
   * @param {number} screenX - 화면 X 좌표
   * @param {number} screenY - 화면 Y 좌표
   * @param {Object} [game=null] - 활성 게임 인스턴스
   * @returns {{x: number, y: number, tileX: number, tileY: number, monster: Object|null, item: Object|null}|null}
   */
  pick(screenX, screenY, game = null) {
    const activeGame = game || this.lastGame;
    if (screenX < 0 || screenX >= this.w || screenY < 0 || screenY >= this.h) {
      return null;
    }

    const player = activeGame?.player;
    const map = activeGame?.map;

    const posX = this.camX ?? (player ? (player.visualX ?? player.x) + 0.5 : 0.5);
    const posY = this.camY ?? (player ? (player.visualY ?? player.y) + 0.5 : 0.5);

    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);
    const planeScale = Math.tan(this.fov / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    const cameraX = (2 * screenX) / this.w - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;

    const horizonY = Math.floor(this.h / 2 + (this.pitch || 0) + (this.walkBob || 0));

    // 1. 빌보드 스프라이트 스크린 영역 히트 테스트
    if (activeGame) {
      const candidates = [];
      const monsters = activeGame.monsters || [];
      for (const m of monsters) {
        if (!m || m.isDead || (m.stats && m.stats.hp <= 0)) continue;
        const mx = m.visualX ?? m.x;
        const my = m.visualY ?? m.y;
        candidates.push({ type: "monster", entity: m, x: mx, y: my });
      }
      const items = activeGame.items || [];
      for (const it of items) {
        if (!it) continue;
        const ix = it.visualX ?? it.x;
        const iy = it.visualY ?? it.y;
        candidates.push({ type: "item", entity: it, x: ix, y: iy });
      }

      // 카메라와 가까운 빌보드부터 클릭 우선순위 판정
      const invDet = 1.0 / (planeX * dirY - dirX * planeY || 0.0001);
      const hitBillboards = [];

      for (const c of candidates) {
        const spriteX = (c.x + 0.5) - posX;
        const spriteY = (c.y + 0.5) - posY;
        const transformX = invDet * (dirY * spriteX - dirX * spriteY);
        const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

        if (transformY > 0.25) {
          const spriteScreenX = Math.floor((this.w / 2) * (1 + transformX / transformY));
          const spriteSize = Math.abs(Math.floor(this.h / transformY));
          const halfW = Math.max(16, spriteSize * 0.4);
          const halfH = Math.max(16, spriteSize * 0.4);
          const drawY = horizonY + (c.type === "item" ? spriteSize * 0.22 : 0);

          if (Math.abs(screenX - spriteScreenX) <= halfW && Math.abs(screenY - drawY) <= halfH) {
            const zDepth = (this.depthBuffer && this.depthBuffer[spriteScreenX] !== undefined) 
              ? this.depthBuffer[spriteScreenX] 
              : Infinity;
            if (transformY <= zDepth + 0.5) {
              hitBillboards.push({
                ...c,
                dist: transformY,
                tileX: Math.floor(c.x),
                tileY: Math.floor(c.y)
              });
            }
          }
        }
      }

      if (hitBillboards.length > 0) {
        hitBillboards.sort((a, b) => a.dist - b.dist);
        const best = hitBillboards[0];
        return {
          x: best.tileX,
          y: best.tileY,
          tileX: best.tileX,
          tileY: best.tileY,
          monster: best.type === "monster" ? best.entity : null,
          item: best.type === "item" ? best.entity : null
        };
      }
    }

    // 2. 바닥면(Floor) 투영 좌표 계산 (지평선 아래 클릭 시)
    let floorTileX = null;
    let floorTileY = null;
    if (screenY > horizonY) {
      const p = screenY - horizonY;
      const posZ = 0.5 * this.h;
      const rowDistance = posZ / Math.max(1, p);
      const floorX = posX + rowDistance * rayDirX;
      const floorY = posY + rowDistance * rayDirY;
      floorTileX = Math.floor(floorX);
      floorTileY = Math.floor(floorY);
    }

    // 3. 2D DDA 그리드 레이마칭
    let mapX = Math.floor(posX);
    let mapY = Math.floor(posY);
    const deltaDistX = Math.abs(1 / (rayDirX || 0.00001));
    const deltaDistY = Math.abs(1 / (rayDirY || 0.00001));
    let stepX = rayDirX < 0 ? -1 : 1;
    let stepY = rayDirY < 0 ? -1 : 1;
    let sideDistX = rayDirX < 0 ? (posX - mapX) * deltaDistX : (mapX + 1.0 - posX) * deltaDistX;
    let sideDistY = rayDirY < 0 ? (posY - mapY) * deltaDistY : (mapY + 1.0 - posY) * deltaDistY;

    let hit = 0;
    let steps = 0;
    const maxSteps = 40;

    while (hit === 0 && steps++ < maxSteps) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
      }

      if (map) {
        if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) break;

        // 타일 상의 몬스터 또는 아이템 확인
        const mon = activeGame?.monsters?.find(m => !m.isDead && (m.stats ? m.stats.hp > 0 : true) && Math.floor(m.visualX ?? m.x) === mapX && Math.floor(m.visualY ?? m.y) === mapY);
        const it = activeGame?.items?.find(i => Math.floor(i.visualX ?? i.x) === mapX && Math.floor(i.visualY ?? i.y) === mapY);

        if (mon || it) {
          return { x: mapX, y: mapY, tileX: mapX, tileY: mapY, monster: mon || null, item: it || null };
        }

        if (typeof map.isWall === "function" && map.isWall(mapX, mapY)) {
          hit = 1;
          break;
        }
      } else {
        hit = 1;
        break;
      }
    }

    // 바닥 타일이 유효하고 맵 내부인 경우
    if (floorTileX !== null && floorTileY !== null && map && floorTileX >= 0 && floorTileX < map.width && floorTileY >= 0 && floorTileY < map.height) {
      const mon = activeGame?.monsters?.find(m => !m.isDead && (m.stats ? m.stats.hp > 0 : true) && Math.floor(m.visualX ?? m.x) === floorTileX && Math.floor(m.visualY ?? m.y) === floorTileY);
      const it = activeGame?.items?.find(i => Math.floor(i.visualX ?? i.x) === floorTileX && Math.floor(i.visualY ?? i.y) === floorTileY);
      return { x: floorTileX, y: floorTileY, tileX: floorTileX, tileY: floorTileY, monster: mon || null, item: it || null };
    }

    if (hit && mapX >= 0 && mapY >= 0 && (!map || (mapX < map.width && mapY < map.height))) {
      return { x: mapX, y: mapY, tileX: mapX, tileY: mapY, monster: null, item: null };
    }

    return null;
  }
}
