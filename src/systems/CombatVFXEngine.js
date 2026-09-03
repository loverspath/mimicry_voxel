/**
 * @module CombatVFXEngine
 * @category systems
 * @description 3대 렌더러(1인칭 3D, 2.5D 복셀, 2D 아스키)를 아우르는 통합 전투 시각 효과 엔진.
 *              나노바나나 에셋 기반 화면 슬래시, 원소 폭발, 화면 흔들림(Screen Shake), 피격 비네팅 및 가산 혼합 파티클 제어
 * @purity State Store
 * @dependencies EventBus.js, GameEvents.js
 * @exports CombatVFXEngine, combatVFXEngine, VFX_TYPES, VFX_PALETTES
 */

import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';

export const VFX_TYPES = Object.freeze({
  SLASH: 'SLASH',
  BASH: 'BASH',
  PIERCE_CRIT: 'PIERCE_CRIT',
  FIRE_BURST: 'FIRE_BURST',
  FROST_SHATTER: 'FROST_SHATTER',
  LIGHTNING_SPARK: 'LIGHTNING_SPARK',
  ACID_POISON: 'ACID_POISON',
  ARCANE_NOVA: 'ARCANE_NOVA',
  HOLY_SMITE: 'HOLY_SMITE'
});

export const VFX_PALETTES = Object.freeze({
  SLASH: { primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.85)', assetKey: 'slash' },
  BASH: { primary: '#fbbf24', secondary: '#d97706', glow: 'rgba(251, 191, 36, 0.85)', assetKey: 'slash' },
  PIERCE_CRIT: { primary: '#ffd700', secondary: '#ef4444', glow: 'rgba(239, 68, 68, 0.95)', assetKey: 'slash' },
  FIRE_BURST: { primary: '#ffffff', secondary: '#f97316', glow: 'rgba(249, 115, 22, 0.95)', assetKey: 'fire' },
  FROST_SHATTER: { primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)', assetKey: 'frost' },
  LIGHTNING_SPARK: { primary: '#ffffff', secondary: '#fde047', glow: 'rgba(234, 179, 8, 0.95)', assetKey: 'fire' },
  ACID_POISON: { primary: '#d9f99d', secondary: '#22c55e', glow: 'rgba(34, 197, 94, 0.85)', assetKey: 'fire' },
  ARCANE_NOVA: { primary: '#f5d0fe', secondary: '#c084fc', glow: 'rgba(192, 132, 252, 0.90)', assetKey: 'frost' },
  HOLY_SMITE: { primary: '#ffffff', secondary: '#ffd700', glow: 'rgba(255, 215, 0, 0.95)', assetKey: 'slash' }
});

const EFFECT_ASSET_PATHS = Object.freeze({
  slash: '/public/textures/effects/fx_slash.jpg',
  fire: '/public/textures/effects/fx_fire.jpg',
  frost: '/public/textures/effects/fx_frost.jpg'
});

export class CombatVFXEngine {
  constructor() {
    this.activeVFX = [];
    this.screenShakeTime = 0;
    this.screenShakeIntensity = 0;
    this.bloodVignetteAlpha = 0;

    // 텍스처 에셋 캐시 및 프리로드
    this.textures = new Map();
    this._loadTextures();

    this._bindEvents();
  }

  _loadTextures() {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;
    for (const [key, path] of Object.entries(EFFECT_ASSET_PATHS)) {
      try {
        const img = new Image();
        img.src = path;
        this.textures.set(key, img);
      } catch (_) {
        // Headless fallback
      }
    }
  }

  _bindEvents() {
    if (typeof eventBus !== 'undefined' && eventBus.on) {
      eventBus.on(GameEvents.COMBAT_ATTACK, (data) => {
        if (data) this.triggerHitEffect(data);
      });
    }
  }

  /**
   * 전투 피격 이펙트 격발 (객체 인자 또는 함수형 인자 모두 지원)
   */
  triggerHitEffect(params) {
    if (!params) return;

    let type = params.type;
    let x = params.x;
    let y = params.y;
    let damage = params.damage || 0;
    let isCrit = !!params.isCrit;
    let isPlayerAttacker = params.isPlayerAttacker !== false;

    // element 기반 자동 타입 변환
    if (!type && params.element) {
      const el = params.element.toUpperCase();
      if (el === 'FIRE') type = VFX_TYPES.FIRE_BURST;
      else if (el === 'COLD' || el === 'FROST') type = VFX_TYPES.FROST_SHATTER;
      else if (el === 'ELEC' || el === 'LIGHTNING') type = VFX_TYPES.LIGHTNING_SPARK;
      else if (el === 'ACID' || el === 'POIS') type = VFX_TYPES.ACID_POISON;
    }

    const resolvedType = VFX_TYPES[type] || VFX_TYPES.SLASH;
    const palette = VFX_PALETTES[resolvedType] || VFX_PALETTES.SLASH;

    const vfx = {
      id: Math.random().toString(36).substring(2, 9),
      type: resolvedType,
      x: x !== undefined ? x : 0,
      y: y !== undefined ? y : 0,
      damage: damage,
      isCrit: isCrit,
      isPlayerAttacker: isPlayerAttacker,
      palette: palette,
      assetKey: palette.assetKey || 'slash',
      life: 0.28,
      maxLife: 0.28,
      progress: 0.0,
      slashAngle: (Math.random() - 0.5) * 0.55,
      sparks: Array.from({ length: isCrit ? 16 : 8 }).map(() => ({
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        x: 0,
        y: 0,
        size: Math.random() * 3.5 + 2
      }))
    };

    this.activeVFX.push(vfx);

    // 타격 시 화면 셰이크 및 피격 비네팅
    if (isCrit) {
      this.addScreenShake(10.0, 0.25);
    } else if (isPlayerAttacker) {
      this.addScreenShake(5.0, 0.15);
    }

    if (!isPlayerAttacker) {
      this.addScreenShake(14.0, 0.35);
      this.bloodVignetteAlpha = 0.85; // 피격 시 붉은 비네팅 점멸
    }
  }

  /**
   * 범용 전투 시각 효과 호출 훅 (CombatSystem.js 및 Game.js 연동용)
   */
  triggerAttackFX(type, source, target, isCritical = false, renderer = null) {
    const isPlayerAttacker = source && source.isPlayer;
    const targetX = target ? target.x : (source ? source.x : 0);
    const targetY = target ? target.y : (source ? source.y : 0);

    // 타겟 피격 플래시
    if (target && typeof target === 'object') {
      target.hitFlash = 0.20;
    }

    this.triggerHitEffect({
      type: type || (isCritical ? VFX_TYPES.PIERCE_CRIT : VFX_TYPES.SLASH),
      x: targetX,
      y: targetY,
      isCrit: isCritical,
      isPlayerAttacker: isPlayerAttacker
    });
  }

  addScreenShake(intensity = 8, duration = 0.25) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeTime = Math.max(this.screenShakeTime, duration);
  }

  update(dt = 0.016) {
    // 1. 활성 VFX 수명 업데이트
    for (let i = this.activeVFX.length - 1; i >= 0; i--) {
      const v = this.activeVFX[i];
      v.life -= dt;
      v.progress = Math.min(1.0, 1.0 - (v.life / v.maxLife));

      for (const sp of v.sparks) {
        sp.x += sp.vx;
        sp.y += sp.vy;
      }

      if (v.life <= 0) {
        this.activeVFX.splice(i, 1);
      }
    }

    // 2. 화면 셰이크 감쇠
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      this.screenShakeIntensity *= Math.max(0, 1.0 - dt * 7.0);
      if (this.screenShakeTime <= 0) {
        this.screenShakeIntensity = 0;
      }
    }

    // 3. 핏빛 비네팅 감쇠
    if (this.bloodVignetteAlpha > 0) {
      this.bloodVignetteAlpha = Math.max(0, this.bloodVignetteAlpha - dt * 3.8);
    }
  }

  /**
   * 1인칭 3D 렌더러 전용 전투 이펙트 드로우 루프
   */
  renderFirstPersonVFX(renderer) {
    if (!renderer || !renderer.ctx) return;
    const ctx = renderer.ctx;
    const w = renderer.w;
    const h = renderer.h;

    // 1. 화면 셰이크 변환 적용
    let offsetX = 0;
    let offsetY = 0;
    if (this.screenShakeIntensity > 0.5) {
      offsetX = (Math.random() - 0.5) * this.screenShakeIntensity;
      offsetY = (Math.random() - 0.5) * this.screenShakeIntensity;
    }

    ctx.save();
    if (offsetX !== 0 || offsetY !== 0) {
      ctx.translate(offsetX, offsetY);
    }

    // 2. 가산 혼합 설정
    ctx.globalCompositeOperation = 'lighter';

    for (const v of this.activeVFX) {
      const alpha = Math.max(0, v.life / v.maxLife);
      ctx.globalAlpha = alpha;

      if (v.isPlayerAttacker) {
        // [1인칭 스크린 슬래시 아크 & 텍스처 오버레이]
        this._drawScreenSlash(ctx, w, h, v);
      } else {
        // [타겟 월드 빌보드 원소 폭발]
        this._drawBillboardBurst(ctx, renderer, v);
      }
    }

    ctx.restore();

    // 3. 핏빛 비네팅 렌더링
    if (this.bloodVignetteAlpha > 0.02) {
      this._drawBloodVignette(ctx, w, h, this.bloodVignetteAlpha);
    }
  }

  _drawScreenSlash(ctx, w, h, v) {
    const cx = w / 2;
    const cy = h / 2;
    const p = v.progress;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(v.slashAngle);

    // 슬래시 텍스처 에셋 오버레이 지원
    const tex = this.textures.get(v.assetKey || 'slash');
    if (tex && tex.complete && tex.naturalWidth > 0) {
      try {
        const texSize = Math.min(w, h) * (0.65 + p * 0.25);
        ctx.drawImage(tex, -texSize / 2, -texSize / 2, texSize, texSize);
      } catch (_) {}
    }

    // 절삭 빛 원호 궤적 (베지어 곡선)
    const arcLen = w * 0.50;
    const startX = -arcLen * (1.0 - p * 0.5);
    const endX = arcLen * (p * 1.3);

    ctx.beginPath();
    ctx.moveTo(startX, -50);
    ctx.quadraticCurveTo(0, 70, endX, -30);
    ctx.strokeStyle = v.palette.primary;
    ctx.lineWidth = v.isCrit ? 12 : 6;
    ctx.shadowColor = v.palette.glow;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // 절단 스파크 방사
    for (const sp of v.sparks) {
      ctx.fillStyle = v.palette.secondary;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawBillboardBurst(ctx, renderer, v) {
    const posX = (renderer.playerX !== undefined ? renderer.playerX : 0) + 0.5;
    const posY = (renderer.playerY !== undefined ? renderer.playerY : 0) + 0.5;
    const spriteX = (v.x + 0.5) - posX;
    const spriteY = (v.y + 0.5) - posY;

    const dirX = Math.cos(renderer.playerAngle || 0);
    const dirY = Math.sin(renderer.playerAngle || 0);
    const planeScale = Math.tan((renderer.fov || 1.15) / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    const invDet = 1.0 / (planeX * dirY - dirX * planeY || 0.0001);
    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.2) return;

    const screenX = Math.floor((renderer.w / 2) * (1 + transformX / transformY));
    const size = Math.abs(Math.floor(renderer.h / transformY)) * (1.1 + v.progress * 0.9);

    if (screenX < 0 || screenX >= renderer.w) return;
    if (renderer.depthBuffer && transformY >= renderer.depthBuffer[screenX]) return; // Z-Culling

    // 원소 텍스처 에셋 오버레이 지원
    const tex = this.textures.get(v.assetKey || 'fire');
    if (tex && tex.complete && tex.naturalWidth > 0) {
      try {
        ctx.drawImage(tex, screenX - size / 2, renderer.h / 2 - size / 2, size, size);
      } catch (_) {}
    }

    const grad = ctx.createRadialGradient(screenX, renderer.h / 2, 0, screenX, renderer.h / 2, size * 0.65);
    grad.addColorStop(0, v.palette.primary);
    grad.addColorStop(0.5, v.palette.secondary);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screenX, renderer.h / 2, size * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBloodVignette(ctx, w, h, alpha) {
    ctx.save();
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.55})`);
    grad.addColorStop(1, `rgba(127, 29, 29, ${alpha * 0.92})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export const combatVFXEngine = new CombatVFXEngine();
