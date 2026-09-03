/**
 * @module CombatVFXEngine
 * @category systems
 * @description 레트로 사이버펑크 순수 아스키 그래픽(ASCII as Graphics) 기반 전투 시각 효과 엔진.
 *              다단 히트(Sequential Multi-Hit Combo) 시차 발동 & 다각도 슬래시 궤적 지원.
 *              정적 비트맵 이미지 의존성 100% 제거. 8대 공격 유형 아스키 파티클, 1인칭 검기 아크,
 *              3D 빌보드 룬 폭발, 2D 아스키 텍스트 블룸, 콤보 배너 및 화면 흔들림 제어
 * @purity State Store / High-Performance Canvas Renderer
 * @dependencies EventBus.js, GameEvents.js
 * @exports CombatVFXEngine, combatVFXEngine, VFX_TYPES, ASCII_GLYPH_POOLS, ASCII_PALETTES, VFX_PALETTES
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

export const ASCII_GLYPH_POOLS = Object.freeze({
  SLASH: ['/', '\\', '|', '-', '⚔', '†', '‡', '░', '▒', '▓'],
  SLASH_SPARKS: ['*', '+', '·', '✧', '.'],
  BASH: ['(', ')', '[', ']', '{', '}', '#', '@', '%', '&', 'O'],
  CRITICAL: ['💥', '★', '✦', '▲', '▼', '⚡', '!'],
  FIRE_BURST: ['*', '%', '&', '#', '^', '~', '!', '@', '▲', '♨'],
  FROST_SHATTER: ['❄', '*', '+', 'x', 'X', '†', '▲', '▼', '◆', '◇'],
  LIGHTNING_SPARK: ['⚡', 'z', 'Z', '\\', '/', '~', '|', 'ϟ', '✦'],
  ACID_POISON: ['o', 'O', '0', '°', '%', '~', '●', '≈', '§'],
  ARCANE_NOVA: ['@', '§', '¤', 'Ω', 'Ψ', '★', '✧', '✦', '○', '◎'],
  HOLY_SMITE: ['†', '‡', '✦', '★', '✧', '▲', '●']
});

export const ASCII_PALETTES = Object.freeze({
  SLASH: { primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.90)' },
  BASH: { primary: '#fbbf24', secondary: '#d97706', glow: 'rgba(251, 191, 36, 0.90)' },
  PIERCE_CRIT: { primary: '#ffd700', secondary: '#ef4444', glow: 'rgba(239, 68, 68, 0.95)' },
  FIRE_BURST: { primary: '#ffffff', secondary: '#f97316', glow: 'rgba(249, 115, 22, 0.95)' },
  FROST_SHATTER: { primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)' },
  LIGHTNING_SPARK: { primary: '#ffffff', secondary: '#fde047', glow: 'rgba(234, 179, 8, 0.95)' },
  ACID_POISON: { primary: '#d9f99d', secondary: '#22c55e', glow: 'rgba(34, 197, 94, 0.90)' },
  ARCANE_NOVA: { primary: '#f5d0fe', secondary: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)' },
  HOLY_SMITE: { primary: '#ffffff', secondary: '#ffd700', glow: 'rgba(255, 215, 0, 0.95)' }
});

// 하위 호환성 별칭
export const VFX_PALETTES = ASCII_PALETTES;

// 다단 히트 연타별 참격 궤적 각도 테이블 (라디안)
const COMBO_SLASH_ANGLES = Object.freeze([
  -0.38, // 1타: 대각 좌하 베기
   0.38, // 2타: 대각 우하 베기
   0.00, // 3타: 수평 횡베기
   0.75, // 4타: 솟구치는 어퍼컷 베기
   0.00, // 5타: 고속 연속 찌르기 (수평 집중)
  -0.55  // 6타+: 대형 크로스 절단 피니셔
]);

export class CombatVFXEngine {
  constructor() {
    this.activeVFX = [];
    this.screenShakeTime = 0;
    this.screenShakeIntensity = 0;
    this.bloodVignetteAlpha = 0;

    this._bindEvents();
  }

  _bindEvents() {
    if (typeof eventBus !== 'undefined' && eventBus.on) {
      eventBus.on(GameEvents.COMBAT_ATTACK, (data) => {
        if (data) this.triggerHitEffect(data);
      });
    }
  }

  /**
   * 전투 피격 이펙트 격발 (다단 히트 시차 발동 & 콤보 궤적 지원)
   * @param {Object} params - { type, x, y, damage, isCrit, element, isPlayerAttacker, comboIndex, totalCombos, delay, target }
   */
  triggerHitEffect(params) {
    if (!params) return;

    let type = params.type;
    let x = params.x;
    let y = params.y;
    let damage = params.damage || 0;
    let isCrit = !!params.isCrit;
    let isPlayerAttacker = params.isPlayerAttacker !== false;
    let comboIndex = typeof params.comboIndex === 'number' ? params.comboIndex : 0;
    let totalCombos = typeof params.totalCombos === 'number' ? params.totalCombos : 1;
    let delay = typeof params.delay === 'number' ? Math.max(0, params.delay) : 0;
    let target = params.target || null;

    // element 기반 자동 타입 변환
    if (!type && params.element) {
      const el = params.element.toUpperCase();
      if (el === 'FIRE') type = VFX_TYPES.FIRE_BURST;
      else if (el === 'COLD' || el === 'FROST') type = VFX_TYPES.FROST_SHATTER;
      else if (el === 'ELEC' || el === 'LIGHTNING') type = VFX_TYPES.LIGHTNING_SPARK;
      else if (el === 'ACID' || el === 'POIS') type = VFX_TYPES.ACID_POISON;
    }

    const resolvedType = VFX_TYPES[type] || (isCrit ? VFX_TYPES.PIERCE_CRIT : VFX_TYPES.SLASH);
    const palette = ASCII_PALETTES[resolvedType] || ASCII_PALETTES.SLASH;
    const glyphPool = ASCII_GLYPH_POOLS[resolvedType] || ASCII_GLYPH_POOLS.SLASH;

    // 파티클 글리프 생성 (치명타 24개, 일반 14~18개)
    const particleCount = isCrit ? 24 : (14 + Math.min(6, comboIndex * 2));
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 2.0;
      particles.push({
        char: glyphPool[Math.floor(Math.random() * glyphPool.length)],
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.floor(Math.random() * 8 + 14),
        color: Math.random() > 0.4 ? palette.primary : palette.secondary,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 6
      });
    }

    // 슬래시 궤적 전용 글리프 시퀀스
    const slashSequence = ['⚔', '▓', '▒', '░', '/', '✦', '*'];

    // 연타별 교차 궤적 각도 산출
    const angleIdx = Math.min(COMBO_SLASH_ANGLES.length - 1, comboIndex);
    const slashAngle = COMBO_SLASH_ANGLES[angleIdx] + (Math.random() - 0.5) * 0.12;

    // 콤보 텍스트 생성
    let comboText = null;
    const comboCount = comboIndex + 1;
    if (totalCombos > 1) {
      if (comboCount === 1) comboText = `⚔ 1 HIT!`;
      else if (comboCount === 2) comboText = `⚔ 2 HITS!`;
      else if (comboCount === 3) comboText = `⚔ 3 HITS!`;
      else if (comboCount === 4) comboText = `⚡ 4 HITS COMBO! ⚡`;
      else comboText = `🔥 ${comboCount} HITS BARRAGE! 🔥`;
    }

    const vfx = {
      id: Math.random().toString(36).substring(2, 9),
      type: resolvedType,
      x: x !== undefined ? x : 0,
      y: y !== undefined ? y : 0,
      damage: damage,
      isCrit: isCrit,
      isPlayerAttacker: isPlayerAttacker,
      palette: palette,
      particles: particles,
      slashSequence: slashSequence,
      life: 0.32,
      maxLife: 0.32,
      progress: 0.0,
      slashAngle: slashAngle,
      comboIndex: comboIndex,
      totalCombos: totalCombos,
      comboText: comboText,
      delay: delay,
      hasTriggeredFeedback: delay === 0,
      target: target
    };

    this.activeVFX.push(vfx);

    // 즉시 발동하는 타격(delay === 0)의 경우 즉각 물리 피드백 반영
    if (delay === 0) {
      this._applyHitFeedback(vfx);
    }
  }

  _applyHitFeedback(vfx) {
    if (vfx.isCrit) {
      this.addScreenShake(10.0, 0.22);
    } else if (vfx.isPlayerAttacker) {
      this.addScreenShake(4.5 + vfx.comboIndex * 1.5, 0.14);
    }

    if (!vfx.isPlayerAttacker) {
      this.addScreenShake(8.0 + vfx.comboIndex * 2.0, 0.22);
      this.bloodVignetteAlpha = Math.max(0.85, this.bloodVignetteAlpha + 0.35);
    }

    if (vfx.target && typeof vfx.target === 'object') {
      vfx.target.hitFlash = 0.20;
    }
  }

  /**
   * 범용 전투 시각 효과 호출 훅 (CombatSystem.js 및 Game.js 연동용)
   * 다단 히트(comboIndex / totalCombos) 시차 지원
   */
  triggerAttackFX(type, source, target, isCritical = false, renderer = null, comboIndex = 0, totalCombos = 1, damage = 0) {
    const isPlayerAttacker = source && source.isPlayer;
    const targetX = target ? target.x : (source ? source.x : 0);
    const targetY = target ? target.y : (source ? source.y : 0);
    const dmg = damage || (target && target.lastDamageTaken) || (source && source.lastDamageDealt) || 0;

    // 타겟 피격 플래시 (시차 0인 경우 즉시 설정)
    if (comboIndex === 0 && target && typeof target === 'object') {
      target.hitFlash = 0.20;
    }

    this.triggerHitEffect({
      type: type || (isCritical ? VFX_TYPES.PIERCE_CRIT : VFX_TYPES.SLASH),
      x: targetX,
      y: targetY,
      damage: dmg,
      isCrit: isCritical,
      isPlayerAttacker: isPlayerAttacker,
      comboIndex: comboIndex,
      totalCombos: totalCombos,
      delay: comboIndex * 0.08,
      target: target
    });
  }

  addScreenShake(intensity = 10, duration = 0.3) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeTime = Math.max(this.screenShakeTime, duration);
  }

  update(dt = 0.016) {
    // 1. 활성 VFX 수명, 시차 딜레이 및 물리 파티클 갱신
    for (let i = this.activeVFX.length - 1; i >= 0; i--) {
      const v = this.activeVFX[i];

      // 시차 딜레이 처리
      if (v.delay > 0) {
        v.delay -= dt;
        if (v.delay <= 0) {
          v.delay = 0;
          if (!v.hasTriggeredFeedback) {
            v.hasTriggeredFeedback = true;
            this._applyHitFeedback(v);
          }
        } else {
          // 아직 시차 딜레이 대기 중인 타격은 수명 감소 및 입자 비산 보류
          continue;
        }
      }

      v.life -= dt;
      v.progress = Math.min(1.0, 1.0 - (v.life / v.maxLife));

      for (const p of v.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot * dt;
        p.vx *= 0.94; // 감속 저항
        p.vy *= 0.94;
      }

      if (v.life <= 0) {
        this.activeVFX.splice(i, 1);
      }
    }

    // 2. 화면 셰이크 감쇄
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      this.screenShakeIntensity *= Math.max(0, 1.0 - dt * 6.5);
      if (this.screenShakeTime <= 0) this.screenShakeIntensity = 0;
    }

    // 3. 핏빛 비네팅 감쇄
    if (this.bloodVignetteAlpha > 0) {
      this.bloodVignetteAlpha = Math.max(0, this.bloodVignetteAlpha - dt * 3.6);
    }
  }

  /**
   * 1인칭 3D 렌더러 전용 아스키 그래픽 드로우 루프
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

    // 2. 가산 혼합 및 네온 글로우 활성화
    ctx.globalCompositeOperation = 'lighter';

    for (const v of this.activeVFX) {
      if (v.delay > 0) continue; // 시차 대기 중인 타격 렌더링 제외

      const alpha = Math.max(0, v.life / v.maxLife);
      ctx.globalAlpha = alpha;

      if (v.isPlayerAttacker) {
        // [1인칭 스크린 아스키 검기 아크]
        this._drawScreenAsciiSlash(ctx, w, h, v);
      } else {
        // [타겟 3D 빌보드 아스키 룬 폭발]
        this._drawBillboardAsciiBurst(ctx, renderer, v);
      }

      // 치명타 배너 또는 연타 콤보 배너
      if (v.isCrit) {
        this._drawCriticalBanner(ctx, w, h, v);
      } else if (v.comboText) {
        this._drawComboBanner(ctx, w, h, v);
      }
    }

    ctx.restore();

    // 3. 피격 핏빛 비네팅
    if (this.bloodVignetteAlpha > 0.02) {
      this._drawBloodVignette(ctx, w, h, this.bloodVignetteAlpha);
    }
  }

  /**
   * 2.5D 복셀 렌더러 전용 아스키 그래픽 드로우 루프
   */
  renderVoxelVFX(renderer, cameraX = 0, cameraY = 0) {
    if (!renderer || !renderer.ctx) return;
    const ctx = renderer.ctx;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const v of this.activeVFX) {
      if (v.delay > 0) continue;

      const alpha = Math.max(0, v.life / v.maxLife);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = v.palette.glow;
      ctx.shadowBlur = 10;

      let screenX = (v.x - cameraX) * 24;
      let screenY = (v.y - cameraY) * 24;
      if (typeof renderer.toScreen === 'function') {
        const pt = renderer.toScreen(v.x, v.y);
        screenX = pt.sx !== undefined ? pt.sx : pt.x;
        screenY = pt.sy !== undefined ? pt.sy : pt.y;
      }

      for (const pt of v.particles) {
        ctx.font = `bold ${pt.size}px monospace`;
        ctx.fillStyle = pt.color;
        ctx.fillText(pt.char, screenX + pt.x, screenY + pt.y);
      }
    }

    ctx.restore();
  }

  /**
   * 2D 클래식 아스키 렌더러 전용 아스키 글리프 블룸 드로우 루프
   */
  renderAsciiVFX(renderer, cameraX = 0, cameraY = 0) {
    if (!renderer || !renderer.ctx) return;
    const ctx = renderer.ctx;
    const charW = renderer.charWidth || 14;
    const charH = renderer.charHeight || 23;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const v of this.activeVFX) {
      if (v.delay > 0) continue;

      const alpha = Math.max(0, v.life / v.maxLife);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = v.palette.glow;
      ctx.shadowBlur = 12;

      // 타겟 그리드 셀 좌표를 캔버스 픽셀로 변환
      const screenX = (v.x - cameraX) * charW + charW / 2;
      const screenY = (v.y - cameraY) * charH + charH / 2;

      if (screenX < -50 || screenX > (renderer.w || 800) + 50 || screenY < -50 || screenY > (renderer.h || 600) + 50) continue;

      // 중심 타격 네온 심볼
      ctx.font = `bold ${Math.floor(charH * 1.35)}px 'Fira Code', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = v.palette.primary;
      const centerChar = v.slashSequence ? v.slashSequence[0] : '*';
      ctx.fillText(centerChar, screenX, screenY);

      // 주변 방사 아스키 파티클 비산
      for (const pt of v.particles) {
        ctx.font = `bold ${Math.floor(pt.size * 0.85)}px 'Fira Code', monospace`;
        ctx.fillStyle = pt.color;
        ctx.fillText(pt.char, screenX + pt.x * 0.85, screenY + pt.y * 0.85);
      }
    }

    ctx.restore();
  }

  /**
   * 스크린 공간 아스키 참격 궤적 렌더링
   */
  _drawScreenAsciiSlash(ctx, w, h, v) {
    const cx = w / 2;
    const cy = h / 2;
    const p = v.progress;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(v.slashAngle);

    // 베지어 곡선상의 글리프 배치
    const steps = v.slashSequence.length;
    const arcSpan = w * 0.52;

    ctx.shadowColor = v.palette.glow;
    ctx.shadowBlur = 14;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      if (t > p * 1.35) continue;

      const gx = -arcSpan / 2 + t * arcSpan;
      const gy = Math.sin(t * Math.PI) * 45 - 20;

      ctx.font = `bold ${Math.floor(28 + (1 - t) * 16)}px 'Fira Code', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = i < 2 ? v.palette.primary : v.palette.secondary;
      ctx.fillText(v.slashSequence[i], gx, gy);
    }

    // 후방 방사 파티클
    for (const pt of v.particles) {
      ctx.font = `bold ${pt.size}px 'Fira Code', monospace`;
      ctx.fillStyle = pt.color;
      ctx.fillText(pt.char, pt.x, pt.y);
    }

    ctx.restore();
  }

  /**
   * 타겟 월드 좌표에 원근 투영되는 3D 아스키 빌보드 룬 폭발
   */
  _drawBillboardAsciiBurst(ctx, renderer, v) {
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

    if (transformY <= 0.2) return; // 카메라 후방 컬링

    const screenX = Math.floor((renderer.w / 2) * (1 + transformX / transformY));
    const screenY = renderer.h / 2;

    if (screenX < 0 || screenX >= renderer.w) return;
    if (renderer.depthBuffer && transformY >= renderer.depthBuffer[screenX]) return; // Z-Culling

    const baseSize = Math.max(14, Math.floor((renderer.h / transformY) * 0.32));

    ctx.save();
    ctx.shadowColor = v.palette.glow;
    ctx.shadowBlur = 12;

    // 중심 마법진 아스키 심볼
    ctx.font = `bold ${Math.floor(baseSize * 1.5)}px 'Fira Code', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = v.palette.primary;
    ctx.fillText('✸', screenX, screenY);

    // 방사형 아스키 파티클 비산
    for (const pt of v.particles) {
      const px = screenX + pt.x * (baseSize / 16);
      const py = screenY + pt.y * (baseSize / 16);
      ctx.font = `bold ${Math.floor(baseSize * (pt.size / 16))}px 'Fira Code', monospace`;
      ctx.fillStyle = pt.color;
      ctx.fillText(pt.char, px, py);
    }

    ctx.restore();
  }

  _drawCriticalBanner(ctx, w, h, v) {
    const p = v.progress;
    const scale = 1.0 + (1.0 - p) * 0.4;
    ctx.save();
    ctx.translate(w / 2, h * 0.28);
    ctx.scale(scale, scale);
    ctx.font = "900 24px 'Fira Code', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 16;
    const dmgText = v.damage > 0 ? ` -${v.damage}` : '';
    ctx.fillText(`💥 CRITICAL!${dmgText} 💥`, 0, 0);
    ctx.restore();
  }

  _drawComboBanner(ctx, w, h, v) {
    const p = v.progress;
    const scale = 1.0 + (1.0 - p) * 0.3;
    ctx.save();
    ctx.translate(w / 2, h * 0.33);
    ctx.scale(scale, scale);
    ctx.font = "bold 20px 'Fira Code', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const isHighCombo = v.comboIndex >= 3;
    ctx.fillStyle = isHighCombo ? '#fde047' : '#38bdf8';
    ctx.shadowColor = isHighCombo ? '#f97316' : '#0284c7';
    ctx.shadowBlur = 12;
    ctx.fillText(v.comboText, 0, 0);
    ctx.restore();
  }

  _drawBloodVignette(ctx, w, h, alpha) {
    ctx.save();
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.50})`);
    grad.addColorStop(1, `rgba(127, 29, 29, ${alpha * 0.90})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export const combatVFXEngine = new CombatVFXEngine();
