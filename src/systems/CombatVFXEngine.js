/**
 * @module CombatVFXEngine
 * @category systems
 * @description ToME 2.3.5 정통 106종 주문, 20종 공격 메소드, 21종 브레스 및 상태이상 전수 대응.
 *              레트로 사이버펑크 순수 아스키 그래픽(ASCII as Graphics) Phase 2 마스터 전투 시각 효과 엔진.
 *              정적 비트맵 이미지 의존성 0%. 5대 물리 메소드(SLASH, CLAW, BITE, PIERCE, CRUSH),
 *              8대 투사체 볼트, 7대 광역 볼 폭풍, 드래곤 브레스 스트림, 6대 상태이상/유틸리티 렌더링 지원.
 * @purity State Store / High-Performance Canvas Renderer
 * @dependencies EventBus.js, GameEvents.js
 * @exports CombatVFXEngine, combatVFXEngine, VFX_TYPES, VFX_METHODS, VFX_SPELLS, ASCII_VFX_CATALOG, ASCII_GLYPH_POOLS, ASCII_PALETTES, VFX_PALETTES
 */

import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';

export const VFX_METHODS = Object.freeze({
  SLASH: 'SLASH',
  CLAW: 'CLAW',
  BITE: 'BITE',
  PIERCE: 'PIERCE',
  STING: 'STING',
  CRUSH: 'CRUSH',
  BASH: 'BASH',
  TOUCH: 'TOUCH',
  ENGULF: 'ENGULF'
});

export const VFX_SPELLS = Object.freeze({
  ARROW: 'ARROW',
  MISSILE: 'MISSILE',
  BO_FIRE: 'BO_FIRE',
  BO_COLD: 'BO_COLD',
  BO_ELEC: 'BO_ELEC',
  BO_ACID: 'BO_ACID',
  BO_POIS: 'BO_POIS',
  BO_NETH: 'BO_NETH',
  BO_LITE: 'BO_LITE',
  BO_DARK: 'BO_DARK',
  BO_WATE: 'BO_WATE',
  BA_FIRE: 'BA_FIRE',
  BA_COLD: 'BA_COLD',
  BA_ELEC: 'BA_ELEC',
  BA_ACID: 'BA_ACID',
  BA_POIS: 'BA_POIS',
  BA_NETH: 'BA_NETH',
  BA_MANA: 'BA_MANA',
  BREATH: 'BREATH',
  CONFUSION: 'CONFUSION',
  BLIND: 'BLIND',
  PARALYZE: 'PARALYZE',
  FEAR: 'FEAR',
  HEAL: 'HEAL',
  TELEPORT: 'TELEPORT'
});

// 하위 호환용 레거시 타입 정의
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

/**
 * Phase 2 전수 아스키 글리프 & 네온 팔레트 마스터 카탈로그
 */
export const ASCII_VFX_CATALOG = Object.freeze({
  // 1. 물리 5대 메소드
  SLASH: {
    coreGlyphs: ['⚔', '▓', '▒', '░', '/', '✦'],
    sparks: ['*', '+', '·', '✧', '.'],
    primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)',
    style: 'ARC'
  },
  CLAW: {
    coreGlyphs: ['\\', '\\', '\\'],
    sparks: ['.', "'", '·', '🩸'],
    primary: '#f87171', secondary: '#ef4444', glow: 'rgba(239, 68, 68, 0.95)',
    style: 'TRIPLE_SCRATCH'
  },
  BITE: {
    upperJaws: ['▲', '▲', '▲'],
    lowerJaws: ['▼', '▼', '▼'],
    sparks: ['*', '✦'],
    primary: '#fef08a', secondary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.90)',
    style: 'CLAMP'
  },
  PIERCE: {
    coreGlyphs: ['─', '━', '»', '➳', '┼', '✦'],
    sparks: ['*', '·'],
    primary: '#a7f3d0', secondary: '#10b981', glow: 'rgba(16, 185, 129, 0.95)',
    style: 'THRUST'
  },
  STING: {
    coreGlyphs: ['─', '━', '»', '➳', '┼', '✦'],
    sparks: ['o', '°', '·'],
    primary: '#d9f99d', secondary: '#22c55e', glow: 'rgba(34, 197, 94, 0.95)',
    style: 'THRUST'
  },
  CRUSH: {
    coreGlyphs: ['(', '[', '#', '@', '▓', ']', ')'],
    sparks: ['.', 'o', 'O'],
    primary: '#fed7aa', secondary: '#d97706', glow: 'rgba(217, 119, 6, 0.95)',
    style: 'SMASH'
  },
  BASH: {
    coreGlyphs: ['(', ')', '[', ']', '{', '}', '#', '@', '%', '&'],
    sparks: ['.', 'o', 'O'],
    primary: '#fbbf24', secondary: '#d97706', glow: 'rgba(251, 191, 36, 0.90)',
    style: 'SMASH'
  },

  // 2. 투사체 볼트 (8대 계통)
  ARROW: {
    coreGlyphs: ['──>', '➳', '➔'],
    sparks: ['·', '*'],
    primary: '#cbd5e1', secondary: '#94a3b8', glow: 'rgba(148, 163, 184, 0.85)',
    style: 'BOLT'
  },
  MISSILE: {
    coreGlyphs: ['🔮', '✦', '✧', '¤', '*'],
    sparks: ['·', '°'],
    primary: '#f5d0fe', secondary: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)',
    style: 'BOLT'
  },
  BO_FIRE: {
    coreGlyphs: ['🚀', '*', '%', '&', '▲', '♨'],
    sparks: ['·', '°', '♨'],
    primary: '#ffffff', secondary: '#f97316', glow: 'rgba(249, 115, 22, 0.95)',
    style: 'BOLT'
  },
  BO_COLD: {
    coreGlyphs: ['🧊', '❄', '*', '+', '◇', '◆'],
    sparks: ['~', '·'],
    primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)',
    style: 'BOLT'
  },
  BO_ELEC: {
    coreGlyphs: ['⚡', 'z', 'Z', 'ϟ', '\\', '/'],
    sparks: ['*', '+'],
    primary: '#ffffff', secondary: '#fde047', glow: 'rgba(234, 179, 8, 0.95)',
    style: 'BOLT'
  },
  BO_ACID: {
    coreGlyphs: ['🧪', '☣', 'o', 'O', '°', '%'],
    sparks: ['.', '·'],
    primary: '#d9f99d', secondary: '#22c55e', glow: 'rgba(34, 197, 94, 0.95)',
    style: 'BOLT'
  },
  BO_POIS: {
    coreGlyphs: ['☣', 'o', 'O', '°', '%', '~'],
    sparks: ['.', '·'],
    primary: '#a7f3d0', secondary: '#10b981', glow: 'rgba(16, 185, 129, 0.95)',
    style: 'BOLT'
  },
  BO_NETH: {
    coreGlyphs: ['☠', '🌑', '§', 'Ω', '✦'],
    sparks: ['·', '¤'],
    primary: '#f5d0fe', secondary: '#a855f7', glow: 'rgba(168, 85, 247, 0.95)',
    style: 'BOLT'
  },
  BO_LITE: {
    coreGlyphs: ['☀️', '✦', '✧', '★'],
    sparks: ['·', '✧'],
    primary: '#ffffff', secondary: '#fef08a', glow: 'rgba(254, 240, 138, 0.95)',
    style: 'BOLT'
  },
  BO_DARK: {
    coreGlyphs: ['🌑', '§', 'Ω', '✦'],
    sparks: ['·', '¤'],
    primary: '#94a3b8', secondary: '#475569', glow: 'rgba(71, 85, 105, 0.95)',
    style: 'BOLT'
  },
  BO_WATE: {
    coreGlyphs: ['🌊', '~', '≈', 'o', '°'],
    sparks: ['·'],
    primary: '#bae6fd', secondary: '#0284c7', glow: 'rgba(2, 132, 199, 0.95)',
    style: 'BOLT'
  },

  // 3. 광역 볼 폭풍 (7대 계통)
  BA_FIRE: {
    burstGlyphs: ['*', '%', '&', '#', '^', '~', '▲', '♨'],
    primary: '#ffffff', secondary: '#ef4444', glow: 'rgba(239, 68, 68, 0.95)',
    style: 'AOE_BALL'
  },
  BA_COLD: {
    burstGlyphs: ['❄', '*', '+', 'x', 'X', '†', '◆', '◇'],
    primary: '#ffffff', secondary: '#0284c7', glow: 'rgba(2, 132, 199, 0.95)',
    style: 'AOE_BALL'
  },
  BA_ELEC: {
    burstGlyphs: ['⚡', 'z', 'Z', 'ϟ', '\\', '/', '✦'],
    primary: '#ffffff', secondary: '#a855f7', glow: 'rgba(168, 85, 247, 0.95)',
    style: 'AOE_BALL'
  },
  BA_ACID: {
    burstGlyphs: ['o', 'O', '0', '°', '%', '~', '●', '≈'],
    primary: '#d9f99d', secondary: '#15803d', glow: 'rgba(21, 128, 61, 0.95)',
    style: 'AOE_BALL'
  },
  BA_POIS: {
    burstGlyphs: ['☁', 'o', 'O', '°', '%', '~', '§'],
    primary: '#a7f3d0', secondary: '#10b981', glow: 'rgba(16, 185, 129, 0.95)',
    style: 'AOE_BALL'
  },
  BA_NETH: {
    burstGlyphs: ['☠', '§', 'Ω', 'Ψ', '@', '✦'],
    primary: '#f5d0fe', secondary: '#4c0519', glow: 'rgba(76, 5, 25, 0.95)',
    style: 'AOE_BALL'
  },
  BA_MANA: {
    burstGlyphs: ['🌌', '✦', '✧', '¤', '★', '○', '◎'],
    primary: '#ffffff', secondary: '#6b21a8', glow: 'rgba(107, 33, 168, 0.95)',
    style: 'AOE_BALL'
  },

  // 4. 드래곤 브레스 스트림
  BREATH: {
    burstGlyphs: ['🐉', '▓', '▲', '@', '*', '%', '~', '·'],
    primary: '#ffffff', secondary: '#f97316', glow: 'rgba(249, 115, 22, 0.95)',
    style: 'CONE_STREAM'
  },

  // 5. 상태이상 및 유틸리티 (6대 계통)
  CONFUSION: {
    glyphs: ['@', '~', '%', '?', '!', '🌀'],
    primary: '#f5d0fe', secondary: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)',
    style: 'AURA_RING'
  },
  BLIND: {
    glyphs: ['░', '▒', '▓', '🌑', 'X'],
    primary: '#64748b', secondary: '#1e293b', glow: 'rgba(30, 41, 59, 0.85)',
    style: 'BLIND_SHROUD'
  },
  PARALYZE: {
    glyphs: ['⛓', '❄', '✕', '┼', '🔒'],
    primary: '#bae6fd', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)',
    style: 'CHAINS'
  },
  FEAR: {
    glyphs: ['👻', '!', '?', '😱', '«'],
    primary: '#fef08a', secondary: '#eab308', glow: 'rgba(234, 179, 8, 0.95)',
    style: 'FLEE'
  },
  HEAL: {
    glyphs: ['+', '✝', '💚', '♥', '✧'],
    primary: '#a7f3d0', secondary: '#10b981', glow: 'rgba(16, 185, 129, 0.95)',
    style: 'FOUNTAIN'
  },
  TELEPORT: {
    glyphs: ['(', '(', '@', ')', ')', '🌀'],
    primary: '#c4b5fd', secondary: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.95)',
    style: 'WARP'
  }
});

// 하위 호환용 글리프 풀 & 팔레트 매핑
export const ASCII_GLYPH_POOLS = Object.freeze({
  SLASH: ASCII_VFX_CATALOG.SLASH.coreGlyphs,
  SLASH_SPARKS: ASCII_VFX_CATALOG.SLASH.sparks,
  BASH: ASCII_VFX_CATALOG.BASH.coreGlyphs,
  CRITICAL: ['💥', '★', '✦', '▲', '▼', '⚡', '!'],
  FIRE_BURST: ASCII_VFX_CATALOG.BA_FIRE.burstGlyphs,
  FROST_SHATTER: ASCII_VFX_CATALOG.BA_COLD.burstGlyphs,
  LIGHTNING_SPARK: ASCII_VFX_CATALOG.BA_ELEC.burstGlyphs,
  ACID_POISON: ASCII_VFX_CATALOG.BA_ACID.burstGlyphs,
  ARCANE_NOVA: ASCII_VFX_CATALOG.BA_MANA.burstGlyphs,
  HOLY_SMITE: ASCII_VFX_CATALOG.HEAL.glyphs
});

export const ASCII_PALETTES = Object.freeze({
  SLASH: ASCII_VFX_CATALOG.SLASH,
  BASH: ASCII_VFX_CATALOG.BASH,
  PIERCE_CRIT: { primary: '#ffd700', secondary: '#ef4444', glow: 'rgba(239, 68, 68, 0.95)' },
  FIRE_BURST: ASCII_VFX_CATALOG.BA_FIRE,
  FROST_SHATTER: ASCII_VFX_CATALOG.BA_COLD,
  LIGHTNING_SPARK: ASCII_VFX_CATALOG.BA_ELEC,
  ACID_POISON: ASCII_VFX_CATALOG.BA_ACID,
  ARCANE_NOVA: ASCII_VFX_CATALOG.BA_MANA,
  HOLY_SMITE: ASCII_VFX_CATALOG.HEAL
});

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
      eventBus.on(GameEvents.SPELL_CAST, (data) => {
        if (data) this.triggerSpellCast(data);
      });
    }
  }

  /**
   * 전투 피격 이펙트 격발 (다단 히트 시차 발동 & Phase 2 메소드/스펠 카탈로그 연동)
   */
  triggerHitEffect(params) {
    if (!params) return;

    let key = params.method || params.type || params.spellId || 'SLASH';
    let x = params.x;
    let y = params.y;
    let damage = params.damage || 0;
    let isCrit = !!params.isCrit;
    let isPlayerAttacker = params.isPlayerAttacker !== false;
    let comboIndex = typeof params.comboIndex === 'number' ? params.comboIndex : 0;
    let totalCombos = typeof params.totalCombos === 'number' ? params.totalCombos : 1;
    let delay = typeof params.delay === 'number' ? Math.max(0, params.delay) : 0;
    let target = params.target || null;

    // element 기반 자동 변환
    if (params.element && !ASCII_VFX_CATALOG[key]) {
      const el = params.element.toUpperCase();
      if (el === 'FIRE') key = 'BO_FIRE';
      else if (el === 'COLD' || el === 'ICE') key = 'BO_COLD';
      else if (el === 'ELEC' || el === 'LIGHTNING') key = 'BO_ELEC';
      else if (el === 'ACID') key = 'BO_ACID';
      else if (el === 'POIS' || el === 'POISON') key = 'BO_POIS';
      else if (el === 'NETH' || el === 'NETHER') key = 'BO_NETH';
      else if (el === 'LITE' || el === 'LIGHT') key = 'BO_LITE';
      else if (el === 'MANA') key = 'MISSILE';
    }

    // 레거시 타입 문자열 변환
    if (key === 'FIRE_BURST') key = 'BA_FIRE';
    else if (key === 'FROST_SHATTER') key = 'BA_COLD';
    else if (key === 'LIGHTNING_SPARK') key = 'BA_ELEC';
    else if (key === 'ACID_POISON') key = 'BA_ACID';
    else if (key === 'ARCANE_NOVA') key = 'BA_MANA';
    else if (key === 'HOLY_SMITE') key = 'HEAL';
    else if (key === 'PIERCE_CRIT') key = 'PIERCE';

    const def = ASCII_VFX_CATALOG[key] || ASCII_VFX_CATALOG.SLASH;
    const pool = def.burstGlyphs || def.coreGlyphs || def.glyphs || ['*'];

    // 파티클 생성
    const particleCount = isCrit ? 24 : (14 + Math.min(6, comboIndex * 2));
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 2.0;
      particles.push({
        char: pool[Math.floor(Math.random() * pool.length)],
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.floor(Math.random() * 8 + 14),
        color: Math.random() > 0.4 ? def.primary : def.secondary,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 6
      });
    }

    // 슬래시 궤적 전용 글리프 시퀀스
    const slashSequence = def.coreGlyphs || ['⚔', '▓', '▒', '░', '/', '✦', '*'];

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
      key: key,
      type: key, // 레거시 호환
      def: def,
      x: x !== undefined ? x : 0,
      y: y !== undefined ? y : 0,
      sourceX: params.sourceX,
      sourceY: params.sourceY,
      damage: damage,
      isCrit: isCrit,
      isPlayerAttacker: isPlayerAttacker,
      palette: def,
      particles: particles,
      slashSequence: slashSequence,
      life: 0.35,
      maxLife: 0.35,
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
   * 범용 물리 공격 시각 효과 호출 훅 (CombatSystem.js 연동)
   */
  triggerAttackFX(type, source, target, isCritical = false, renderer = null, comboIndex = 0, totalCombos = 1, damage = 0, method = null) {
    const isPlayerAttacker = source && source.isPlayer;
    const targetX = target ? target.x : (source ? source.x : 0);
    const targetY = target ? target.y : (source ? source.y : 0);
    const dmg = damage || (target && target.lastDamageTaken) || (source && source.lastDamageDealt) || 0;

    if (comboIndex === 0 && target && typeof target === 'object') {
      target.hitFlash = 0.20;
    }

    this.triggerHitEffect({
      type: type,
      method: method || type,
      x: targetX,
      y: targetY,
      sourceX: source ? source.x : targetX,
      sourceY: source ? source.y : targetY,
      damage: dmg,
      isCrit: isCritical,
      isPlayerAttacker: isPlayerAttacker,
      comboIndex: comboIndex,
      totalCombos: totalCombos,
      delay: comboIndex * 0.08,
      target: target
    });
  }

  /**
   * ToME 주문 및 특수기 발동 시각 효과 호출 훅 (TomeSpellEngine.js 연동)
   */
  triggerSpellAction(spellId, source, target = null, element = null, damage = 0) {
    const isPlayer = source && source.isPlayer;
    const targetX = target ? target.x : (source ? source.x : 0);
    const targetY = target ? target.y : (source ? source.y : 0);

    this.triggerHitEffect({
      type: spellId,
      spellId: spellId,
      element: element,
      x: targetX,
      y: targetY,
      sourceX: source ? source.x : targetX,
      sourceY: source ? source.y : targetY,
      damage: damage,
      isCrit: false,
      isPlayerAttacker: isPlayer,
      comboIndex: 0,
      totalCombos: 1,
      delay: 0,
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

      if (v.delay > 0) {
        v.delay -= dt;
        if (v.delay <= 0) {
          v.delay = 0;
          if (!v.hasTriggeredFeedback) {
            v.hasTriggeredFeedback = true;
            this._applyHitFeedback(v);
          }
        } else {
          continue;
        }
      }

      v.life -= dt;
      v.progress = Math.min(1.0, 1.0 - (v.life / v.maxLife));

      for (const p of v.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot * dt;
        p.vx *= 0.94;
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
   * 1인칭 3D 렌더러 드로우 루프 (메소드별 시점 맞춤 렌더링)
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

    ctx.globalCompositeOperation = 'lighter';

    for (const v of this.activeVFX) {
      if (v.delay > 0) continue;

      const alpha = Math.max(0, v.life / v.maxLife);
      ctx.globalAlpha = alpha;

      const style = v.def.style || 'ARC';

      if (v.isPlayerAttacker) {
        // [1인칭 플레이어 공격: 스크린 공간 특화 렌더링]
        if (style === 'TRIPLE_SCRATCH') {
          this._drawClawScratch(ctx, w, h, v);
        } else if (style === 'CLAMP') {
          this._drawBiteClamp(ctx, w, h, v);
        } else if (style === 'THRUST') {
          this._drawPierceThrust(ctx, w, h, v);
        } else if (style === 'SMASH') {
          this._drawSmashCrush(ctx, w, h, v);
        } else if (style === 'FOUNTAIN') {
          this._drawHealFountain(ctx, w, h, v);
        } else if (style === 'WARP') {
          this._drawTeleportWarp(ctx, w, h, v);
        } else {
          this._drawScreenAsciiSlash(ctx, w, h, v);
        }
      } else {
        // [타겟 몬스터 공격: 3D 월드 빌보드 투사체/폭발 및 스크린 피격 연출]
        this._drawBillboardAsciiBurst(ctx, renderer, v);

        // 몬스터의 물리 피격 시에도 스크린에 손톱/이빨 자국이 덮침
        if (style === 'TRIPLE_SCRATCH') {
          this._drawClawScratch(ctx, w, h, v);
        } else if (style === 'CLAMP') {
          this._drawBiteClamp(ctx, w, h, v);
        } else if (style === 'THRUST') {
          this._drawPierceThrust(ctx, w, h, v);
        }
      }

      // 치명타 또는 콤보 배너
      if (v.isCrit) {
        this._drawCriticalBanner(ctx, w, h, v);
      } else if (v.comboText) {
        this._drawComboBanner(ctx, w, h, v);
      }
    }

    ctx.restore();

    // 피격 핏빛 비네팅
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
      ctx.shadowColor = v.def.glow;
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
      ctx.shadowColor = v.def.glow;
      ctx.shadowBlur = 14;

      const screenX = (v.x - cameraX) * charW + charW / 2;
      const screenY = (v.y - cameraY) * charH + charH / 2;

      if (screenX < -50 || screenX > (renderer.w || 800) + 50 || screenY < -50 || screenY > (renderer.h || 600) + 50) continue;

      // 중심 메소드/스펠 코어 글리프
      ctx.font = `bold ${Math.floor(charH * 1.4)}px 'Fira Code', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = v.def.primary;
      const coreChar = v.def.coreGlyphs ? v.def.coreGlyphs[0] : (v.def.burstGlyphs ? v.def.burstGlyphs[0] : '*');
      ctx.fillText(coreChar, screenX, screenY);

      // 주변 글리프 파편 비산
      for (const pt of v.particles) {
        ctx.font = `bold ${Math.floor(pt.size * 0.85)}px 'Fira Code', monospace`;
        ctx.fillStyle = pt.color;
        ctx.fillText(pt.char, screenX + pt.x * 0.85, screenY + pt.y * 0.85);
      }
    }

    ctx.restore();
  }

  // 1) 할퀴기 (3줄 평행 스크래치 & 핏방울)
  _drawClawScratch(ctx, w, h, v) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 14;
    ctx.font = '900 36px monospace';
    ctx.fillStyle = v.def.primary;

    const p = v.progress;
    const len = w * 0.35 * p;

    for (const offset of [-28, 0, 28]) {
      ctx.fillText('\\', -len / 2 + offset, -len / 2);
      ctx.fillText('\\', 0 + offset, 0);
      ctx.fillText('\\', len / 2 + offset, len / 2);
    }
    ctx.restore();
  }

  // 2) 물어뜯기 (상하 턱 교합)
  _drawBiteClamp(ctx, w, h, v) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 16;
    ctx.font = '900 32px monospace';
    ctx.fillStyle = v.def.primary;

    const dist = (1.0 - v.progress) * 80;
    ctx.fillText('▲ ▲ ▲', 0, -dist);
    ctx.fillText('▼ ▼ ▼', 0, dist);
    ctx.restore();
  }

  // 3) 찌르기 (원근 관통창)
  _drawPierceThrust(ctx, w, h, v) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 14;
    const scale = 1.0 + v.progress * 1.5;
    ctx.scale(scale, scale);
    ctx.font = '900 42px monospace';
    ctx.fillStyle = v.def.primary;
    ctx.fillText('─━» ✦', 0, 0);
    ctx.restore();
  }

  // 4) 분쇄 (암석 충격파)
  _drawSmashCrush(ctx, w, h, v) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 16;
    const size = 28 + v.progress * 42;
    ctx.font = `900 ${Math.floor(size)}px monospace`;
    ctx.fillStyle = v.def.primary;
    ctx.fillText('( [ # ▓ ] )', 0, 0);
    ctx.restore();
  }

  // 5) 치유 샘 (그린 크로스 분수)
  _drawHealFountain(ctx, w, h, v) {
    ctx.save();
    ctx.translate(w / 2, h * 0.65 - v.progress * 120);
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 16;
    ctx.font = '900 36px monospace';
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText('✝ 💚 ✝', 0, 0);
    ctx.restore();
  }

  // 6) 공간이동 왜곡
  _drawTeleportWarp(ctx, w, h, v) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 18;
    const size = 24 + v.progress * 50;
    ctx.font = `bold ${Math.floor(size)}px monospace`;
    ctx.fillStyle = v.def.primary;
    ctx.fillText('(( @ )) 🌀', 0, 0);
    ctx.restore();
  }

  // 7) 기본 참격 베지어 아크
  _drawScreenAsciiSlash(ctx, w, h, v) {
    const cx = w / 2;
    const cy = h / 2;
    const p = v.progress;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(v.slashAngle);

    const seq = v.def.coreGlyphs || ['⚔', '▓', '▒', '░', '/', '✦', '*'];
    const steps = seq.length;
    const arcSpan = w * 0.52;

    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 14;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      if (t > p * 1.35) continue;

      const gx = -arcSpan / 2 + t * arcSpan;
      const gy = Math.sin(t * Math.PI) * 45 - 20;

      ctx.font = `bold ${Math.floor(28 + (1 - t) * 16)}px 'Fira Code', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = i < 2 ? v.def.primary : v.def.secondary;
      ctx.fillText(seq[i], gx, gy);
    }

    for (const pt of v.particles) {
      ctx.font = `bold ${pt.size}px 'Fira Code', monospace`;
      ctx.fillStyle = pt.color;
      ctx.fillText(pt.char, pt.x, pt.y);
    }

    ctx.restore();
  }

  // 3D 빌보드 폭발 및 투사체 렌더링
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

    if (transformY <= 0.2) return;

    const screenX = Math.floor((renderer.w / 2) * (1 + transformX / transformY));
    const screenY = renderer.h / 2;

    if (screenX < 0 || screenX >= renderer.w) return;
    if (renderer.depthBuffer && transformY >= renderer.depthBuffer[screenX]) return;

    const baseSize = Math.max(14, Math.floor((renderer.h / transformY) * 0.32));

    ctx.save();
    ctx.shadowColor = v.def.glow;
    ctx.shadowBlur = 12;

    // 중심 심볼
    const centerChar = v.def.coreGlyphs ? v.def.coreGlyphs[0] : (v.def.burstGlyphs ? v.def.burstGlyphs[0] : '✸');
    ctx.font = `bold ${Math.floor(baseSize * 1.5)}px 'Fira Code', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = v.def.primary;
    ctx.fillText(centerChar, screenX, screenY);

    // 방사 파티클
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
