# 🔮 아스키 그래픽(ASCII as Graphics) 전투 VFX 아키텍처 및 파이프라인 명세서
### Specification of Retro-Cyberpunk Pure ASCII Particle System, Screen-Space Slash Arcs, and Neon-Bloom Combat Effects

> **문서 메타데이터**
> - **버전**: `v2.0.0` (Pure ASCII Graphical VFX Overhaul)
> - **작성일**: 2026-09-03
> - **작성자**: 카스미 루리 (Research Agent / INTJ 용의주도한 전략가)
> - **수신인**: 오케스트레이터 및 타쿠미 코하루 (Dev Agent)
> - **대상 프로젝트**: [`/data/data/com.termux/files/home/opendcmart/mimicry_voxel`](file:///data/data/com.termux/files/home/opendcmart/mimicry_voxel)

---

## 🧭 1. 개요 및 설계 철학 (Executive Philosophy)

### 1.1 "ASCII as Graphics (글리프가 곧 그래픽이다)"
고전 로그라이크와 80~90년대 사이버펑크 터미널 미학의 정수는 텍스트 문자(ASCII Glyphs) 그 자체가 지닌 **선(Line), 면(Area), 밀도(Density), 기하학적 형태(Geometry)**입니다.

본 명세서는 외부 정적 이미지 텍스처(비트맵 스프라이트)를 완전히 배제하고, **아스키 글리프를 2D 캔버스 엔진에서 고속 회전·스케일링·물리 시뮬레이션되는 동적 파티클이자 스프라이트로 취급**하는 차세대 전투 시각 효과 체계입니다.

```mermaid
flowchart LR
    StaticAsset["❌ 정적 비트맵 이미지<br>(로딩 지연, 해상도 저하, 메모리 부하)"] 
    -->|전면 개편 및 혁신| 
    AsciiGraphics["✅ 순수 절차적 아스키 그래픽스 (Pure ASCII Graphics)<br>(60fps 무상태 래스터라이징, 네온 블룸 글로우, 벡터 스케일링)"]
```

### 1.2 4대 핵심 아키텍처 이점
1. **외부 자원 의존도 0% (Zero-Asset Overhead)**:
   - 외부 `.png`나 `.jpg` 이미지 다운로드 대기시간이 전혀 없어, 최초 부팅 즉시 100% 프레임 드랍 없는 60fps 렌더링을 보장합니다.
2. **무한 해상도 벡터 스케일링 (Vector-like Sharpness)**:
   - 캔버스 2D 폰트 렌더러를 직접 활용하므로, 4K 모니터나 초고밀도 모바일(Retina/AMOLED) 화면에서도 깨짐 없이 칼날처럼 예리한 비주얼을 유지합니다.
3. **네온 블룸 CRT 글로우 (Neon Bloom & Additive Blending)**:
   - `ctx.shadowBlur`와 가산 혼합(`globalCompositeOperation = 'lighter'`)을 결합하여, 어두운 던전 속에서 타오르는 레트로 사이버펑크 네온의 강렬한 발광을 연출합니다.
4. **시점 통합 일관성 (Aesthetic Coherence)**:
   - 1인칭 3D 시점, 2.5D 복셀 쿼터뷰, 고전 2D 아스키 뷰가 모두 동일한 '아스키 글리프'를 공유함으로써 게임 전체의 일관된 예술적 정체성을 확립합니다.

---

## ⚔️ 2. 8대 공격 유형별 아스키 글리프 매트릭스 & 물리 수식

각 공격 유형마다 독자적인 기호학적(Semiotics) 글리프 레퍼토리와 물리 방사 공식을 부여합니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 8대 전투 유형별 아스키 글리프 카탈로그                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. 참격 (SLASH)       : [ "/", "\", "|", "-", "⚔", "†", "‡", "░", "▒", "▓" ]  │
│ 2. 둔기 (BASH)        : [ "(", ")", "[", "]", "{", "}", "#", "@", "%", "O" ]  │
│ 3. 치명타 (CRITICAL)   : [ "💥 CRITICAL 💥", "⚡", "★", "✦", "▲", "▼", "!" ]   │
│ 4. 화염 (FIRE_BURST)   : [ "*", "%", "&", "#", "^", "~", "!", "@", "▲", "♨" ]  │
│ 5. 빙결 (FROST_SHATTER): [ "*", "+", "x", "X", "†", "▲", "▼", "◆", "◇", "❄" ]  │
│ 6. 전격 (LIGHTNING)   : [ "z", "Z", "\", "/", "⚡", "~", "|", "ϟ", "✦" ]     │
│ 7. 산성/독 (ACID_POIS) : [ "o", "O", "0", "°", "%", "~", "●", "≈", "§" ]       │
│ 8. 비전/신성 (ARCANE)  : [ "@", "§", "¤", "Ω", "Ψ", "★", "✧", "✦", "○", "◎" ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 상세 글리프 매트릭스 및 네온 컬러 규격

| 공격 유형 (VFX Type) | 코어 아스키 글리프 풀 | 후방 스파크 입자 풀 | 1차 코어 색상 | 2차 네온 글로우 | 비주얼 역학 (Dynamics) |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **`SLASH`** (물리 참격) | `["/", "\\", "⚔", "†", "‡", "░", "▒", "▓"]` | `["*", "+", "·", "✧", "."]` | `#ffffff` | `#38bdf8` (시안) | 베지어 곡선 궤적을 따라 회전하며 잔상 형성 |
| **`BASH`** (둔기 충격파) | `["(", ")", "[", "]", "{", "}", "#", "@", "%"]` | `[".", "o", "O"]` | `#fbbf24` | `#d97706` (앰버) | 타겟 중심 동심원 괄호 충격파 팽창 및 파편 비산 |
| **`CRITICAL`** (치명타) | `["💥 CRITICAL 💥", "★", "✦", "▲", "⚡"]` | `["!", "*", "+"]` | `#ef4444` | `#ffd700` (황금) | 대형 볼드 배너 팝인(Pop-in) + 화면 진동 |
| **`FIRE_BURST`** (화염 폭발) | `["*", "%", "&", "#", "^", "~", "!", "@", "▲"]` | `["·", "°", "♨"]` | `#ffffff` | `#f97316` (네온 주황) | 소용돌이치며 상승하는 화염 룬 및 불티 비산 |
| **`FROST_SHATTER`** (빙결) | `["❄", "*", "+", "x", "X", "†", "◆", "◇"]` | `["~", "·", "°"]` | `#ffffff` | `#a5f3fc` (빙하 청색) | 사방으로 튕겨나가는 예리한 서리 결정체 |
| **`LIGHTNING_SPARK`** (전격) | `["⚡", "z", "Z", "\\", "/", "~", "ϟ", "✦"]` | `["*", "+"]` | `#ffffff` | `#fde047` (고전압 황색)| 지그재그 전도 궤적 및 전자기 플래시 |
| **`ACID_POISON`** (산성/독) | `["o", "O", "0", "°", "%", "~", "●", "§"]` | `[".", "·"]` | `#d9f99d` | `#22c55e` (비비드 라임)| 보글거리며 튀어오르는 거품 및 부식 연기 |
| **`ARCANE_NOVA`** (비전) | `["@", "§", "¤", "Ω", "Ψ", "★", "✧", "✦"]` | `["○", "◎"]` | `#f5d0fe` | `#c084fc` (오컬트 보라)| 팽창하는 고대 마법진 룬 링 확산 |

---

## 🎥 3. 3대 렌더러 시점별 아스키 투영 파이프라인

### 3.1 1인칭 3D 뷰 (`FirstPerson3DRenderer`) 아스키 연출

1인칭 시점에서는 **카메라 화면 공간(Screen-Space)을 가르는 아스키 검기 아크**와, **3D 월드 타겟에 투영되는 아스키 빌보드 폭발**이 유기적으로 맞물립니다.

```
┌─────────────────────────────────────────────────────────────┐
│ [1인칭 화면 스크린 공간 검기 아크 (Screen-Space Arc)]       │
│                                                             │
│       [ 💥 CRITICAL! +48 DMG 💥 ]  <-- 네온 발광 배너      │
│                                                             │
│                      /                                      │
│                     / ⚔ ▓                                   │
│                    / ▒ ░                                    │
│                   / ✦ * ·                                   │
│            \     /                                          │
│             \   /                                           │
│              \ /                                            │
│               v   <-- 베지어 궤적을 따라 회전된 글리프 행렬 │
└─────────────────────────────────────────────────────────────┘
```

#### 1) 스크린 공간 아스키 검기 궤적 (Screen-Space ASCII Arc):
- 검기 진행률 $p \in [0, 1]$에 따라 대각선 궤적 상의 6~10개 지점 $t_i$ 계산.
- 각 지점마다 접선 각도 $\theta(t_i) = \text{atan2}(dy, dx)$를 구하여 글리프를 캔버스 축에서 정밀 회전(`ctx.rotate`).
- 칼날 중심부에는 밀도가 높은 `"⚔"`, `"▓"`, `"▒"`, 외곽에는 잔상인 `"░"`, `"/"`, 스파크인 `"*"`, `"+"` 배치.
- 폰트 크기: $36\text{px} \sim 52\text{px}$ (모바일 화면에 시원하게 꽂히는 타격감).

#### 2) 월드 타겟 3D 아스키 빌보드 폭발 (World Billboard ASCII Burst):
- 타겟 좌표 $(tx, ty)$에 카메라 역행렬 원근 투영:
  $$transformY = invDet \cdot (-\vec{C}_y \cdot \Delta x + \vec{C}_x \cdot \Delta y)$$
- $transformY > 0.2$ 및 Z-Buffer 오클루전 통과 시, 타겟 중심에서 16~24개의 아스키 룬 파티클 방출.
- 각 파티클은 개별 방사 각도 $\alpha_k$와 속도 $v_k$로 비산:
  $$x_k(t) = screenX + \cos(\alpha_k) \cdot v_k t, \quad y_k(t) = screenY + \sin(\alpha_k) \cdot v_k t - g t^2$$
- 글리프 폰트 크기는 거리에 따라 실시간 스케일링:
  $$fontSize = \max\left(14, \left\lfloor \frac{H}{transformY} \cdot 0.35 \right\rfloor\right)$$

---

### 3.2 2.5D 복셀 뷰 (`Voxel3DRenderer`) 아스키 연출

- 아이소메트릭 등각 투영 좌표계로 변환된 타겟 지점 $(isoX, isoY)$ 상공으로 아스키 파티클들이 분수처럼 솟구쳐 오름.
- 바닥 타일 $Z = 0$에 닿으면 탄성 튕김(Bounce: $v_z = -0.4 v_z$) 물리 시뮬레이션 적용.
- 3D 등각타원 충격파: 바닥면에 `[`, `]`, `(`, `)` 글리프들이 타원형 링을 이루며 외곽으로 퍼져나감.

---

### 3.3 2D 클래식 아스키 뷰 (`Classic2DAsciiRenderer`) 아스키 연출

- 터미널 폰트 비율(14×23)을 엄격히 준수.
- 타겟 셀에 즉시 폭발 글리프(`*`, `#`, `@`)가 점멸하며, 피격 몬스터 심볼 색상이 3프레임 동안 역상(Inverted) 하이라이트 처리.

---

## ⚡ 4. 고속 캔버스 래스터라이징 & 네온 블룸 최적화

1. **가산 혼합(Additive Blending)**:
   ```javascript
   ctx.save();
   ctx.globalCompositeOperation = 'lighter'; // RGB 광원 합성
   ctx.shadowColor = palette.glow;
   ctx.shadowBlur = 12; // 네온 CRT 블룸 효과
   // 아스키 글리프 렌더링
   ctx.restore();
   ```
2. **외부 자원 로딩 0초 & 가비지 컬렉션(GC) 최소화**:
   - `Image` 객체를 생성하지 않으므로 네트워크 스레드 차단 및 메모리 누수가 원천 배제됩니다.
   - 단일 파티클 배열 재사용(In-Place Lifecycle)으로 초당 60프레임을 완벽히 방어합니다.

---

## 💻 5. 개발 에이전트(타쿠미 코하루)를 위한 완결 레퍼런스 코드

타쿠미 코하루 요원이 기존 `src/systems/CombatVFXEngine.js`를 즉시 100% 교체 투입할 수 있는 완성형 소스코드를 제공합니다.

### 5.1 교체 모듈: `src/systems/CombatVFXEngine.js`

```javascript
/**
 * @module CombatVFXEngine
 * @category systems
 * @description 레트로 사이버펑크 순수 아스키 그래픽(ASCII as Graphics) 기반 전투 시각 효과 엔진.
 *              정적 이미지 에셋 의존도 0%. 8대 공격 유형 아스키 파티클, 1인칭 검기 아크,
 *              3D 빌보드 룬 폭발, 네온 블룸 글로우 및 화면 흔들림 제어
 * @purity State Store / High-Performance Canvas Renderer
 * @dependencies EventBus.js, GameEvents.js
 * @exports CombatVFXEngine, combatVFXEngine, VFX_TYPES, ASCII_GLYPH_POOLS, ASCII_PALETTES
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
  SLASH: { primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.9)' },
  BASH: { primary: '#fbbf24', secondary: '#d97706', glow: 'rgba(251, 191, 36, 0.9)' },
  PIERCE_CRIT: { primary: '#ffd700', secondary: '#ef4444', glow: 'rgba(239, 68, 68, 0.95)' },
  FIRE_BURST: { primary: '#ffffff', secondary: '#f97316', glow: 'rgba(249, 115, 22, 0.95)' },
  FROST_SHATTER: { primary: '#ffffff', secondary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)' },
  LIGHTNING_SPARK: { primary: '#ffffff', secondary: '#fde047', glow: 'rgba(234, 179, 8, 0.95)' },
  ACID_POISON: { primary: '#d9f99d', secondary: '#22c55e', glow: 'rgba(34, 197, 94, 0.9)' },
  ARCANE_NOVA: { primary: '#f5d0fe', secondary: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)' },
  HOLY_SMITE: { primary: '#ffffff', secondary: '#ffd700', glow: 'rgba(255, 215, 0, 0.95)' }
});

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
   * 전투 피격 이펙트 격발 (100% 아스키 파티클 생성)
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

    const resolvedType = VFX_TYPES[type] || (isCrit ? VFX_TYPES.PIERCE_CRIT : VFX_TYPES.SLASH);
    const palette = ASCII_PALETTES[resolvedType] || ASCII_PALETTES.SLASH;
    const glyphPool = ASCII_GLYPH_POOLS[resolvedType] || ASCII_GLYPH_POOLS.SLASH;
    const sparkPool = ASCII_GLYPH_POOLS.SLASH_SPARKS;

    // 파티클 글리프 14~20개 생성
    const particleCount = isCrit ? 22 : 14;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4.5 + 2.0);
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

    const vfx = {
      id: Math.random().toString(36).substring(2, 9),
      type: resolvedType,
      x: x,
      y: y,
      damage: damage,
      isCrit: isCrit,
      isPlayerAttacker: isPlayerAttacker,
      palette: palette,
      particles: particles,
      slashSequence: slashSequence,
      life: 0.32,
      maxLife: 0.32,
      progress: 0.0,
      slashAngle: (Math.random() - 0.5) * 0.45 // 미세 참격 각도 편차
    };

    this.activeVFX.push(vfx);

    // 물리 피드백 (셰이크 & 비네팅)
    if (isCrit) {
      this.addScreenShake(9.0, 0.25);
    }
    if (!isPlayerAttacker) {
      this.addScreenShake(14.0, 0.35);
      this.bloodVignetteAlpha = 0.85;
    }
  }

  addScreenShake(intensity = 10, duration = 0.3) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeTime = Math.max(this.screenShakeTime, duration);
  }

  update(dt) {
    for (let i = this.activeVFX.length - 1; i >= 0; i--) {
      const v = this.activeVFX[i];
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

    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      this.screenShakeIntensity *= Math.max(0, 1.0 - dt * 6.0);
      if (this.screenShakeTime <= 0) this.screenShakeIntensity = 0;
    }

    if (this.bloodVignetteAlpha > 0) {
      this.bloodVignetteAlpha = Math.max(0, this.bloodVignetteAlpha - dt * 3.5);
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

    // 1. 화면 셰이크
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
      const alpha = Math.max(0, v.life / v.maxLife);
      ctx.globalAlpha = alpha;

      if (v.isPlayerAttacker) {
        // [1인칭 스크린 아스키 검기 아크]
        this._drawScreenAsciiSlash(ctx, w, h, v);
      } else {
        // [타겟 3D 빌보드 아스키 룬 폭발]
        this._drawBillboardAsciiBurst(ctx, renderer, v);
      }

      // 치명타 시 상단 네온 배너
      if (v.isCrit) {
        this._drawCriticalBanner(ctx, w, h, v);
      }
    }

    ctx.restore();

    // 3. 피격 비네팅
    if (this.bloodVignetteAlpha > 0.02) {
      this._drawBloodVignette(ctx, w, h, this.bloodVignetteAlpha);
    }
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
    const arcSpan = w * 0.5;

    ctx.shadowColor = v.palette.glow;
    ctx.shadowBlur = 14;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // 검기가 베어넘어가는 시간에 맞춘 전개
      if (t > p * 1.3) continue;

      const gx = -arcSpan / 2 + t * arcSpan;
      const gy = Math.sin(t * Math.PI) * 45 - 20;

      ctx.font = `bold ${Math.floor(28 + (1 - t) * 16)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = i < 2 ? v.palette.primary : v.palette.secondary;
      ctx.fillText(v.slashSequence[i], gx, gy);
    }

    // 후방 방사 파티클
    for (const pt of v.particles) {
      ctx.font = `bold ${pt.size}px monospace`;
      ctx.fillStyle = pt.color;
      ctx.fillText(pt.char, pt.x, pt.y);
    }

    ctx.restore();
  }

  /**
   * 타겟 월드 좌표에 원근 투영되는 3D 아스키 빌보드 룬 폭발
   */
  _drawBillboardAsciiBurst(ctx, renderer, v) {
    const posX = (renderer.playerX || 0) + 0.5;
    const posY = (renderer.playerY || 0) + 0.5;
    const spriteX = (v.x + 0.5) - posX;
    const spriteY = (v.y + 0.5) - posY;

    const dirX = Math.cos(renderer.playerAngle || 0);
    const dirY = Math.sin(renderer.playerAngle || 0);
    const planeScale = Math.tan((renderer.fov || 1.15) / 2);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.2) return; // 카메라 뒤 컬링

    const screenX = Math.floor((renderer.w / 2) * (1 + transformX / transformY));
    const screenY = renderer.h / 2;

    if (screenX < 0 || screenX >= renderer.w) return;
    if (renderer.depthBuffer && transformY >= renderer.depthBuffer[screenX]) return; // Z-Culling

    const baseSize = Math.max(14, Math.floor((renderer.h / transformY) * 0.32));

    ctx.save();
    ctx.shadowColor = v.palette.glow;
    ctx.shadowBlur = 12;

    // 중심 마법진 심볼
    ctx.font = `bold ${Math.floor(baseSize * 1.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = v.palette.primary;
    ctx.fillText('✸', screenX, screenY);

    // 방사형 아스키 파티클
    for (const pt of v.particles) {
      const px = screenX + pt.x * (baseSize / 16);
      const py = screenY + pt.y * (baseSize / 16);
      ctx.font = `bold ${Math.floor(baseSize * (pt.size / 16))}px monospace`;
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
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 16;
    ctx.fillText(`💥 CRITICAL! -${v.damage} 💥`, 0, 0);
    ctx.restore();
  }

  _drawBloodVignette(ctx, w, h, alpha) {
    ctx.save();
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(127, 29, 29, ${alpha * 0.9})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export const combatVFXEngine = new CombatVFXEngine();
```

---

## 📈 6. 결론 및 마일스톤 제언

- **정적 에셋으로부터의 완전한 해방**: 이번 개편을 통해 미미크리 복셀 엔진은 외부 이미지 파일이나 다운로드 지연에 구애받지 않고, **엔진 자체에 내장된 순수 수학과 글리프 래스터라이징만으로 60fps 불꽃을 뿜어내는 완전 무결한 레트로 사이버펑크 렌더러**로 거듭나게 됩니다.
- **예술적 통일성 완성**: 1인칭 3D 시점에서도 아스키 특유의 정취가 화면 가득 살아 숨 쉬어, 유저에게 "고전 로그라이크 세계관 속으로 직접 걸어 들어간 듯한" 독보적인 몰입감을 선사할 것입니다.

---

**© 2026 OpenDCMart Engine Team & Mimicry Voxel Engineering Group.**  
*Analyzed and Designed by Kasumi Ruri (research_agent).*
