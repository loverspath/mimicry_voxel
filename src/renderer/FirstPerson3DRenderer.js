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

    this.resize();
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
  }

  snapCamera(x, y, z = 0) {
    // 1인칭 시점에서는 카메라가 항상 플레이어 좌표에 직접 고정됩니다.
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
    const floorTex = textureManager.getFloorTexture();
    const userLightRange = typeof lightRange === 'number' ? Math.max(1.0, lightRange) : 4.0;
    this.currentLightRange = userLightRange;

    const clearDist = Math.max(1.2, userLightRange * 1.5);
    const maxLightDist = Math.max(4.0, userLightRange * 3.5);

    const posX = playerX + 0.5;
    const posY = playerY + 0.5;

    // 시선 벡터 및 카메라 평면 벡터 연산 (FOV 66도)
    const dirX = Math.cos(this.playerAngle);
    const dirY = Math.sin(this.playerAngle);
    const planeScale = Math.tan(this.fov / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    // 1. 천장 및 바닥 배경 그라디언트 렌더링
    this._renderCeilingAndFloor(floorTex, theme);

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
    const texWidth = wallTex?.width || 64;
    const texHeight = wallTex?.height || 64;

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

      // 스크린 투사 벽 높이 및 수직 범위 연산
      const lineHeight = Math.floor(this.h / perpWallDist);
      const drawStart = Math.max(0, -lineHeight / 2 + this.h / 2);
      const drawEnd = Math.min(this.h - 1, lineHeight / 2 + this.h / 2);

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
      if (wallTex && ((typeof HTMLElement !== 'undefined' && wallTex instanceof HTMLElement) || typeof Image !== 'undefined')) {
        try {
          this.ctx.drawImage(
            wallTex,
            texX, 0, 1, texHeight,
            x, drawStart, 1, sliceH
          );
        } catch (_) {
          // 안전 드로우 폴백
          this.ctx.fillStyle = side === 1 ? '#334155' : '#475569';
          this.ctx.fillRect(x, drawStart, 1, sliceH);
        }
      } else {
        this.ctx.fillStyle = side === 1 ? '#334155' : '#475569';
        this.ctx.fillRect(x, drawStart, 1, sliceH);
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
    this._renderTorchlightGlow(userLightRange);

    // 4. 미니맵 나침반 레이더 오버레이 렌더링
    this._drawCompassRadar(map, playerX, playerY);
  }

  _renderTorchlightGlow(lightRange = 4.0) {
    if (!this.ctx) return;
    const cx = this.w / 2;
    const cy = this.h / 2;
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

  _renderCeilingAndFloor(floorTex, theme) {
    if (!this.ctx) return;

    // 상단 천장 그라디언트 (웅장한 둥근 석조 아치 볼트 - 명도 상향)
    const ceilGrad = this.ctx.createLinearGradient(0, 0, 0, this.h / 2);
    ceilGrad.addColorStop(0, '#0a0e17');
    ceilGrad.addColorStop(0.7, '#141d2d');
    ceilGrad.addColorStop(1, '#1e293b');
    this.ctx.fillStyle = ceilGrad;
    this.ctx.fillRect(0, 0, this.w, this.h / 2);

    // 하단 바닥 그라디언트 (고대 지하 석조 바닥 - 명도 상향)
    const floorGrad = this.ctx.createLinearGradient(0, this.h / 2, 0, this.h);
    floorGrad.addColorStop(0, '#1e293b');
    floorGrad.addColorStop(0.3, '#172033');
    floorGrad.addColorStop(1, '#0c111a');
    this.ctx.fillStyle = floorGrad;
    this.ctx.fillRect(0, this.h / 2, this.w, this.h / 2);
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
    this._drawBillboardSprite(entity.x, entity.y, entity.char, entity.color, playerX, playerY, false);
  }

  /**
   * 1인칭 시점 아이템 빌보드 렌더링
   */
  drawItem(item, startX, startY, playerX, playerY, floor, map = null) {
    if (!this.ctx || !item) return;
    this._drawBillboardSprite(item.x, item.y, item.char, item.color, playerX, playerY, true);
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

    const drawY = this.h / 2 + (isItem ? spriteSize * 0.22 : 0);
    
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

  updateParticles(dt) {
    // 1인칭 모드 파티클 확장 훅
  }

  pick(clientX, clientY) {
    return null;
  }
}
