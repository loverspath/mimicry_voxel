/**
 * @module Effects
 * @description 게임 내 2.5D 아이소메트릭 기반 실시간 데이터 지향 스킬 비주얼 이펙트 파이프라인 엔진 모듈.
 * Skills.js 및 CombatSystem.js의 스킬 엔티티 메타데이터(원소, 사거리, 각도, 글리프, 투사체 형태, 결합 반응)를 주입받아
 * 3D 고밀도 미니 복셀 입자 스트림 브레스(SkillConeBreathEffect),
 * 3D 포물선 탄도학 & 공전 에너지 링 마법 투사체(SkillProjectileEffect),
 * 연속 전도 레이저/낙뢰 빔(SkillBeamEffect),
 * 2.5D 등각타원 슬래시 아크(SkillMeleeSlashEffect),
 * 3D 앵커링 플로팅 텍스트(FloatingTextEffect),
 * 광역 폭발(AoEExplosionEffect)을 정석 아이소메트릭 좌표계(toScreen)로 통합 렌더링합니다.
 */

/**
 * 7대 원소별 고유 비주얼 테마 정의 (팔레트, 글리프, 발광색, 복셀 파편 컬러)
 */
export const ELEMENT_THEMES = {
  FIRE: {
    name: "화염 (Fire)",
    color: "#f97316",
    glowColor: "rgba(249, 115, 22, 0.85)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [251, 191, 36], [249, 115, 22], [185, 28, 28]],
    glyphs: ['*', '%', '^', '♨', 'x', '+'],
    headChar: '*',
    voxelColors: ['#ff4500', '#ffa500', '#ffeb3b', '#d32f2f']
  },
  COLD: {
    name: "냉기 (Ice/Cold)",
    color: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.85)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [224, 242, 254], [56, 189, 248], [2, 132, 199]],
    glyphs: ['❄', '*', '+', 'x', '◇', '¤'],
    headChar: '❄',
    voxelColors: ['#00f0ff', '#a5f3fc', '#38bdf8', '#0284c7']
  },
  ICE: {
    name: "빙결 (Ice)",
    color: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.85)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [224, 242, 254], [56, 189, 248], [2, 132, 199]],
    glyphs: ['❄', '*', '+', 'x', '◇', '¤'],
    headChar: '❄',
    voxelColors: ['#00f0ff', '#a5f3fc', '#38bdf8', '#0284c7']
  },
  LIGHTNING: {
    name: "뇌격 (Lightning)",
    color: "#eab308",
    glowColor: "rgba(234, 179, 8, 0.9)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [253, 224, 71], [234, 179, 8], [168, 85, 247]],
    glyphs: ['⚡', 'z', 's', 'N', 'Z', 'ϟ'],
    headChar: '⚡',
    voxelColors: ['#fde047', '#eab308', '#ffffff', '#a855f7']
  },
  ACID: {
    name: "산성 (Acid)",
    color: "#22c55e",
    glowColor: "rgba(34, 197, 94, 0.85)",
    coreColor: "#d9f99d",
    trailColors: [[217, 249, 157], [163, 230, 53], [34, 197, 94], [21, 128, 61]],
    glyphs: ['o', '°', '●', '~', 'u', '•'],
    headChar: 'o',
    voxelColors: ['#84cc16', '#22c55e', '#15803d', '#a3e635']
  },
  MANA: {
    name: "마력 (Mana)",
    color: "#a78bfa",
    glowColor: "rgba(167, 139, 250, 0.85)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [233, 213, 255], [167, 139, 250], [96, 165, 250]],
    glyphs: ['✦', '✨', '*', '¤', '°', '~'],
    headChar: '✦',
    voxelColors: ['#c084fc', '#818cf8', '#38bdf8', '#e879f9']
  },
  MAGIC: {
    name: "비전 (Arcane Magic)",
    color: "#fb7185",
    glowColor: "rgba(251, 113, 133, 0.85)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [254, 205, 211], [251, 113, 133], [225, 29, 72]],
    glyphs: ['✦', '✨', '*', 'o', '★', '◇'],
    headChar: '✨',
    voxelColors: ['#f472b6', '#fb7185', '#fda4af', '#be123c']
  },
  APOCALYPSE: {
    name: "종말/암흑 (Dark Void)",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.9)",
    coreColor: "#ef4444",
    trailColors: [[239, 68, 68], [220, 38, 38], [168, 85, 247], [76, 5, 25]],
    glyphs: ['W', 'X', '@', '%', '☠', 'Ω'],
    headChar: '☠',
    voxelColors: ['#a855f7', '#ef4444', '#4c0519', '#9333ea']
  },
  HOLY: {
    name: "신성 (Holy)",
    color: "#ffd700",
    glowColor: "rgba(255, 215, 0, 0.9)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [254, 240, 138], [255, 215, 0], [245, 158, 11]],
    glyphs: ['†', '✦', '☼', '+', '✨', '◊'],
    headChar: '†',
    voxelColors: ['#ffd700', '#fef08a', '#ffffff', '#f59e0b']
  },
  PHYSICAL: {
    name: "물리 (Physical)",
    color: "#cbd5e1",
    glowColor: "rgba(203, 213, 225, 0.6)",
    coreColor: "#ffffff",
    trailColors: [[255, 255, 255], [226, 232, 240], [203, 213, 225], [148, 163, 184]],
    glyphs: ['/', '—', '\\', '|', 'x', '+'],
    headChar: '/',
    voxelColors: ['#94a3b8', '#cbd5e1', '#e2e8f0', '#64748b']
  }
};

export function getElementTheme(element = "PHYSICAL") {
  const key = String(element).toUpperCase();
  return ELEMENT_THEMES[key] || ELEMENT_THEMES.PHYSICAL;
}

/**
 * 기본 비주얼 이펙트 추상 기본 클래스
 */
export class VisualEffect {
  constructor(duration, delay = 0) {
    this.age = 0;
    this.duration = duration;
    this.delay = delay;
  }

  update(dt) {
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return true;
    }
    this.age += dt;
    return this.age < this.duration;
  }

  draw(renderer, cameraX, cameraY) {
    // Overridden by subclasses
  }
}

/**
 * 2.5D 등각타원 슬래시 아크 및 3D 복셀 파편 연동 근접 공격 이펙트
 */
export class MeleeSlashEffect extends VisualEffect {
  constructor(x, y, element = "PHYSICAL", z = null, skillMeta = null) {
    super(200); // 200ms impact slash
    this.x = x;
    this.y = y;
    this.z = z;
    this.element = (skillMeta && skillMeta.element) ? skillMeta.element : element;
    this.skillMeta = skillMeta;
    this.spawnedShatter = false;
    this.theme = getElementTheme(this.element);
  }

  draw(renderer) {
    if (!renderer || !renderer.toScreen) return;

    const topV = renderer.mapBridge ? renderer.mapBridge.getTopVoxel(this.x, this.y) : null;
    const ez = this.z !== null ? this.z : (topV ? topV.z : 0);
    const { sx, sy, tileW, tileH } = renderer.toScreen(this.x, this.y, ez);

    if (sx < -100 || sx > renderer.w + 100 || sy < -100 || sy > renderer.h + 100) return;

    const ctx = renderer.ctx;
    const progress = Math.min(1, this.age / this.duration);
    const zoom = renderer.zoom || 1;

    const theme = this.theme;
    const color = progress < 0.4 ? theme.coreColor : theme.color;
    const glowColor = theme.glowColor;

    // 타격 첫 프레임 시 3D 복셀 미니 파편 비산
    if (!this.spawnedShatter && renderer.particleSys) {
      this.spawnedShatter = true;
      const count = this.skillMeta ? 16 : 12;
      renderer.particleSys.spawnShatter(this.x, this.y, ez + 0.6, theme.color, count, 4.8);
    }

    // 1. 2.5D 등각타원 슬래시 아크
    ctx.save();
    const centerX = sx;
    const centerY = sy - tileH * 0.9;
    const radiusX = tileW * 1.25;
    const radiusY = tileH * 1.25;

    ctx.translate(centerX, centerY);
    const startAngle = -Math.PI * 0.85 + progress * Math.PI * 0.35;
    const endAngle = Math.PI * 0.4 + progress * Math.PI * 0.45;

    ctx.beginPath();
    ctx.scale(1, radiusY / radiusX);
    ctx.arc(0, 0, radiusX, startAngle, endAngle);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = Math.max(2, 5 * (1 - progress) * zoom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radiusX * 0.85, startAngle + 0.15, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 2.5 * (1 - progress) * zoom);
    ctx.stroke();
    ctx.restore();

    // 2. 임팩트 아스키 기호 렌더링
    const chars = (this.skillMeta && this.skillMeta.glyphs) ? this.skillMeta.glyphs : theme.glyphs;
    const frame = Math.min(chars.length - 1, Math.floor(progress * chars.length));
    const char = chars[frame] || theme.headChar;
    const fontSize = Math.floor(30 * zoom);

    ctx.save();
    ctx.font = `bold ${fontSize}px 'Consolas', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.fillText(char, centerX, centerY);
    ctx.restore();
  }
}

/**
 * 고속 직사(Direct High-Speed) 탄도학, 2중 나선 볼텍스 & 제트 추진 3D 복셀 마법 투사체 이펙트
 */
export class ProjectileEffect extends VisualEffect {
  constructor(startX, startY, endX, endY, skillMetaOrElement = "PHYSICAL", speed = 0.12, arcHeight = 0, startZ = null, endZ = null) {
    super(230); // 230ms sharp high-speed flight
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;

    if (typeof skillMetaOrElement === 'object' && skillMetaOrElement !== null) {
      this.skillMeta = skillMetaOrElement;
      this.element = skillMetaOrElement.element || "MANA";
      this.speed = skillMetaOrElement.speed || speed;
      this.customGlyph = skillMetaOrElement.glyph || null;
    } else {
      this.skillMeta = null;
      this.element = skillMetaOrElement || "PHYSICAL";
      this.speed = speed;
      this.customGlyph = null;
    }

    this.startZ = startZ;
    this.endZ = endZ;
    this.currentX = startX;
    this.currentY = startY;
    this.currentZ = 0.5;
    this.trail = [];
    this.theme = getElementTheme(this.element);
    this.hitSpawned = false;

    const dx = endX - startX;
    const dy = endY - startY;
    this.dist = Math.hypot(dx, dy);
    this.flightAngle = Math.atan2(dy, dx);
  }

  update(dt) {
    this.age += dt;
    // 강력한 가속 이징 (t^1.35)으로 미사일/레일건처럼 목표물에 꽂히는 고속 직사 탄도학
    const linearT = Math.min(1, this.age / this.duration);
    const u = Math.pow(linearT, 1.35);

    this.currentX = this.startX + (this.endX - this.startX) * u;
    this.currentY = this.startY + (this.endY - this.startY) * u;

    const sz = this.startZ !== null ? this.startZ : 0.6;
    const ez = this.endZ !== null ? this.endZ : 0.5;
    this.currentZ = sz + (ez - sz) * u;

    // 고속 꼬리 트레일 노드 기록
    this.trail.push({
      x: this.currentX,
      y: this.currentY,
      z: this.currentZ,
      age: 0,
      u: u,
      rot: Math.random() * Math.PI * 2
    });
    this.trail.forEach(pt => pt.age += dt);
    this.trail = this.trail.filter(pt => pt.age < 140);

    return this.age < this.duration;
  }

  draw(renderer) {
    if (!renderer || !renderer.toScreen) return;

    const ctx = renderer.ctx;
    const zoom = renderer.zoom || 1;
    const linearT = Math.min(1, this.age / this.duration);
    const u = Math.pow(linearT, 1.35);
    const theme = this.theme;

    const headColor = theme.color;
    const headChar = this.customGlyph || theme.headChar;

    const sz = this.startZ !== null ? this.startZ : 0.6;
    const ez = this.endZ !== null ? this.endZ : 0.5;

    // 1. 원소별 고유 궤적 (제트 화염 추진 / 2중 나선 볼텍스 / 얼음 쐐기 잔상)
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      const trailRatio = i / this.trail.length;
      const alpha = trailRatio * 0.85 * (1 - pt.age / 140);
      const { sx: tsx, sy: tsy } = renderer.toScreen(pt.x, pt.y, pt.z);

      if (tsx < -80 || tsx > renderer.w + 80 || tsy < -80 || tsy > renderer.h + 80) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);

      if (this.element === "FIRE" && renderer.drawMiniVoxel) {
        // 화염구: 뒤로 뿜어져 나가는 제트 추진 마이크로 복셀 큐브
        const voxelColor = theme.voxelColors[i % theme.voxelColors.length];
        renderer.drawMiniVoxel(tsx, tsy, Math.max(2, 6 * trailRatio * zoom), voxelColor, pt.rot);
      } else if (this.element === "COLD" || this.element === "ICE") {
        // 냉기: 날카로운 다이아몬드 서리 궤적
        ctx.fillStyle = i % 2 === 0 ? "#00f0ff" : "#a5f3fc";
        ctx.font = `bold ${Math.floor(14 * trailRatio * zoom)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◇', tsx, tsy);
      } else {
        // 일반/마나: 크로매틱 빛줄기 트레일
        const trailColorArr = theme.trailColors[Math.min(theme.trailColors.length - 1, Math.floor((1 - trailRatio) * theme.trailColors.length))];
        ctx.fillStyle = `rgb(${trailColorArr[0]}, ${trailColorArr[1]}, ${trailColorArr[2]})`;
        ctx.beginPath();
        ctx.arc(tsx, tsy, Math.max(2, Math.floor(7 * trailRatio * zoom)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. 바닥 투영 그림자
    const shadowPos = renderer.toScreen(this.currentX, this.currentY, Math.min(sz, ez));
    if (renderer.drawDropShadow) {
      renderer.drawDropShadow(shadowPos.sx, shadowPos.sy, renderer.baseTileW * zoom, renderer.baseTileH * zoom, 10 * zoom, 0.45);
    }

    // 3. 투사체 헤드 위치
    const { sx, sy } = renderer.toScreen(this.currentX, this.currentY, this.currentZ);

    // 4. 원소별 특화 헤드 연출: 2중 나선(Double Helix) 또는 제트 플레임
    ctx.save();
    if (this.element === "MANA" || this.element === "MAGIC" || this.element === "HOLY") {
      // 마력/비전: 투사체 축을 2중 나선으로 회전하는 크로매틱 소용돌이 리본
      const helixRadiusX = 14 * zoom;
      const helixRadiusY = 7 * zoom;
      const helixAngle = (this.age / 1000) * 24;

      for (let h = 0; h < 2; h++) {
        const angle = helixAngle + h * Math.PI;
        const hx = sx + Math.cos(angle) * helixRadiusX;
        const hy = sy + Math.sin(angle) * helixRadiusY;
        const sparkColor = h === 0 ? theme.coreColor : theme.color;

        ctx.fillStyle = sparkColor;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(2, 3.5 * zoom), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.element === "DARK" || this.element === "APOCALYPSE") {
      // 암흑/종말: 공간을 왜곡하는 크로매틱 잔상 글리치
      ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
      ctx.font = `900 ${Math.floor(28 * zoom)}px 'Consolas', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(headChar, sx - 4 * zoom, sy);
      ctx.fillStyle = "rgba(168, 85, 247, 0.6)";
      ctx.fillText(headChar, sx + 4 * zoom, sy);
    }
    ctx.restore();

    // 5. 투사체 본체 아스키 글리프 렌더링
    ctx.save();
    ctx.font = `900 ${Math.floor(30 * zoom)}px 'Consolas', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 크로매틱 외곽선
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = theme.glowColor;
    ctx.fillText(headChar, sx - 2 * zoom, sy);
    ctx.fillText(headChar, sx + 2 * zoom, sy);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = theme.coreColor;
    ctx.shadowColor = headColor;
    ctx.shadowBlur = 14;
    ctx.fillText(headChar, sx, sy);
    ctx.restore();

    // 6. 착탄 순간의 폭발적 타격 임팩트 (24개의 3D 원소 복셀 파편 대폭발)
    if (u >= 0.90 && !this.hitSpawned && renderer.particleSys) {
      this.hitSpawned = true;
      const count = (this.skillMeta && this.skillMeta.aoeRadius) ? 30 : 22;
      renderer.particleSys.spawnShatter(this.endX, this.endY, ez + 0.5, headColor, count, 6.0);
    }
  }
}

/**
 * 2.5D 고밀도 3D 미니 복셀 & 크로매틱 아스키 스트림 브레스 이펙트
 */
export class ConeBreathEffect extends VisualEffect {
  constructor(startX, startY, targetX, targetY, skillMetaOrElement = "FIRE") {
    super(480); // 480ms sustained breath stream
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;

    if (typeof skillMetaOrElement === 'object' && skillMetaOrElement !== null) {
      this.skillMeta = skillMetaOrElement;
      this.element = skillMetaOrElement.element || "FIRE";
      this.coneRange = skillMetaOrElement.maxRange || 5.5;
      this.coneSpread = skillMetaOrElement.coneAngle || 0.9;
    } else {
      this.skillMeta = null;
      this.element = skillMetaOrElement || "FIRE";
      this.coneRange = 5.2;
      this.coneSpread = 0.85;
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    this.dirX = len > 0 ? dx / len : 1;
    this.dirY = len > 0 ? dy / len : 0;

    this.theme = getElementTheme(this.element);
    this.particles = [];
  }

  update(dt) {
    this.age += dt;
    const progress = this.age / this.duration;
    const currentRange = Math.min(this.coneRange, progress * 1.4 * this.coneRange);

    // 지속 방출 구간: 매 틱마다 고밀도 3D 미니 복셀 + 아스키 입자 생성
    if (this.age < 340) {
      const spawnCount = 4;
      for (let i = 0; i < spawnCount; i++) {
        const angleOffset = (Math.random() - 0.5) * this.coneSpread;
        const cos = Math.cos(angleOffset);
        const sin = Math.sin(angleOffset);
        const spreadX = this.dirX * cos - this.dirY * sin;
        const spreadY = this.dirX * sin + this.dirY * cos;

        const dist = (0.2 + Math.random() * 0.8) * currentRange;
        const px = this.startX + spreadX * dist;
        const py = this.startY + spreadY * dist;
        const pz = Math.random() * 1.1 + 0.2; // 3D 높이

        const isMiniVoxel = Math.random() > 0.45; // 45% 확률로 3D 미니 복셀 큐브
        const chars = this.theme.glyphs;
        const char = chars[Math.floor(Math.random() * chars.length)];
        const voxelColor = this.theme.voxelColors[Math.floor(Math.random() * this.theme.voxelColors.length)];

        this.particles.push({
          x: px,
          y: py,
          z: pz,
          age: 0,
          maxLife: 220 + Math.random() * 60,
          char,
          isMiniVoxel,
          voxelColor,
          size: Math.random() * 8 + 14,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 8
        });
      }
    }

    this.particles.forEach(p => {
      p.age += dt;
      p.rot += (p.vrot * dt) / 1000;
    });
    this.particles = this.particles.filter(p => p.age < p.maxLife);

    return this.age < this.duration || this.particles.length > 0;
  }

  draw(renderer) {
    if (!renderer || !renderer.toScreen) return;

    const ctx = renderer.ctx;
    const zoom = renderer.zoom || 1;
    const theme = this.theme;

    for (const p of this.particles) {
      const topV = renderer.mapBridge ? renderer.mapBridge.getTopVoxel(Math.round(p.x), Math.round(p.y)) : null;
      const baseZ = topV ? topV.z : 0;
      const { sx, sy } = renderer.toScreen(p.x, p.y, baseZ + p.z);

      if (sx < -100 || sx > renderer.w + 100 || sy < -100 || sy > renderer.h + 100) continue;

      const ratio = p.age / p.maxLife;
      const alpha = Math.max(0, 1 - ratio);

      if (p.isMiniVoxel && renderer.drawMiniVoxel) {
        // 1. 3D 미니 복셀 큐브 렌더링
        ctx.save();
        ctx.globalAlpha = alpha;
        renderer.drawMiniVoxel(sx, sy, p.size * 0.45 * zoom, p.voxelColor, p.rot);
        ctx.restore();
      } else {
        // 2. 크로매틱 아스키 글리프 렌더링
        let color = theme.color;
        if (ratio < 0.25) color = theme.coreColor;
        else if (ratio < 0.6) color = theme.color;
        else color = theme.trailColors[theme.trailColors.length - 1] ? `rgb(${theme.trailColors[theme.trailColors.length - 1].join(',')})` : theme.color;

        ctx.save();
        ctx.font = `bold ${Math.floor(p.size * zoom)}px 'Consolas', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = theme.glowColor;
        ctx.shadowBlur = 6;
        ctx.fillText(p.char, sx, sy);
        ctx.restore();
      }
    }
  }
}

/**
 * 연속 전도 레이저 / 낙뢰 빔 이펙트 (SkillBeamEffect)
 */
export class SkillBeamEffect extends VisualEffect {
  constructor(startX, startY, endX, endY, element = "LIGHTNING", startZ = null, endZ = null) {
    super(300); // 300ms continuous beam
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.element = element;
    this.startZ = startZ;
    this.endZ = endZ;
    this.theme = getElementTheme(element);
    this.spawnedShatter = false;
  }

  draw(renderer) {
    if (!renderer || !renderer.toScreen) return;

    const ctx = renderer.ctx;
    const progress = this.age / this.duration;
    const alpha = Math.max(0, 1 - progress);
    const zoom = renderer.zoom || 1;
    const theme = this.theme;

    const sz = this.startZ !== null ? this.startZ : 0.8;
    const ez = this.endZ !== null ? this.endZ : 0.5;

    const p0 = renderer.toScreen(this.startX, this.startY, sz);
    const p1 = renderer.toScreen(this.endX, this.endY, ez);

    if (!this.spawnedShatter && renderer.particleSys) {
      this.spawnedShatter = true;
      renderer.particleSys.spawnShatter(this.endX, this.endY, ez, theme.color, 14, 4.5);
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // 지그재그 뇌격 / 레이저 분절 노드 계산
    const segments = 8;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const bx = p0.sx + (p1.sx - p0.sx) * t;
      const by = p0.sy + (p1.sy - p0.sy) * t;
      const jitter = (i === 0 || i === segments) ? 0 : (Math.random() - 0.5) * 14 * zoom;
      points.push({ x: bx + jitter, y: by + jitter });
    }

    // 외부 발광 빔
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = theme.glowColor;
    ctx.lineWidth = Math.max(3, 8 * (1 - progress) * zoom);
    ctx.stroke();

    // 내부 코어 빔
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = theme.coreColor;
    ctx.lineWidth = Math.max(1, 3 * (1 - progress) * zoom);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * 2.5D 등각 충격파 링 및 광역 폭발 이펙트 (AoEExplosionEffect)
 */
export class AoEExplosionEffect extends VisualEffect {
  constructor(x, y, radius = 2.5, element = "FIRE", z = null, skillMeta = null) {
    super(380);
    this.x = x;
    this.y = y;
    this.radius = (skillMeta && skillMeta.aoeRadius) ? skillMeta.aoeRadius : radius;
    this.element = (skillMeta && skillMeta.element) ? skillMeta.element : element;
    this.z = z;
    this.skillMeta = skillMeta;
    this.spawnedShatter = false;
    this.theme = getElementTheme(this.element);
  }

  draw(renderer) {
    if (!renderer || !renderer.toScreen) return;

    const topV = renderer.mapBridge ? renderer.mapBridge.getTopVoxel(this.x, this.y) : null;
    const ez = this.z !== null ? this.z : (topV ? topV.z : 0);
    const { sx, sy, tileW, tileH } = renderer.toScreen(this.x, this.y, ez);

    const progress = this.age / this.duration;
    const zoom = renderer.zoom || 1;
    const currentRadiusX = (this.radius * tileW) * progress;
    const currentRadiusY = (this.radius * tileH) * progress;

    const theme = this.theme;
    const color = theme.color;

    if (!this.spawnedShatter && renderer.particleSys) {
      this.spawnedShatter = true;
      const count = Math.min(32, Math.floor(this.radius * 10));
      renderer.particleSys.spawnShatter(this.x, this.y, ez + 0.5, color, count, 5.5);
    }

    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.beginPath();
    ctx.scale(1, currentRadiusY / Math.max(1, currentRadiusX));
    ctx.arc(0, 0, currentRadiusX, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 6 * (1 - progress) * zoom);
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.shadowColor = theme.glowColor;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 엔티티 3D 복셀 머리 위 정중앙 앵커링 대미지/힐 플로팅 텍스트 이펙트
 */
export class FloatingTextEffect extends VisualEffect {
  constructor(x, y, text, color = "#ef4444", isCrit = false, delaySeconds = 0, z = null) {
    const delayMs = (typeof delaySeconds === 'number' && delaySeconds <= 10) ? Math.max(0, delaySeconds * 1000) : 0;
    super(650, delayMs); // 650ms float
    this.x = x;
    this.y = y;
    this.z = (typeof delaySeconds === 'number' && delaySeconds > 10) ? delaySeconds : z;
    this.text = text;
    this.color = color;
    this.isCrit = isCrit;
  }

  draw(renderer) {
    if (this.delay > 0) return;
    if (!renderer || !renderer.toScreen) return;

    const topV = renderer.mapBridge ? renderer.mapBridge.getTopVoxel(this.x, this.y) : null;
    const ez = this.z !== null ? this.z : (topV ? topV.z : 0);
    const { sx, sy, tileH } = renderer.toScreen(this.x, this.y, ez);

    if (sx < -100 || sx > renderer.w + 100 || sy < -100 || sy > renderer.h + 100) return;

    const progress = this.age / this.duration;
    const riseY = Math.sin(progress * Math.PI * 0.5) * 38;
    const alpha = Math.max(0, 1 - progress * progress);
    const zoom = renderer.zoom || 1;

    const baseSize = this.isCrit ? 24 : 18;
    const fontSize = Math.floor(baseSize * zoom);

    const ctx = renderer.ctx;
    ctx.save();
    ctx.font = `900 ${fontSize}px 'Consolas', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;

    const drawY = sy - tileH - 16 * zoom - riseY;

    // 검은색 외곽선 (가독성 보장)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.strokeText(this.text, sx, drawY);

    ctx.fillStyle = this.color;
    if (this.isCrit) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
    }
    ctx.fillText(this.text, sx, drawY);
    ctx.restore();
  }
}

/**
 * 스킬 엔티티 메타데이터 기반 이펙트 팩토리 (SkillVisualEffectFactory)
 */
export class SkillVisualEffectFactory {
  /**
   * 스킬 설정 및 시전자/타겟 정보를 분석하여 최적의 3D 복셀 이펙트 객체를 생성합니다.
   */
  static createSkillEffect(skillConfig, source, target, reactionResult = null) {
    if (!skillConfig) return null;

    const sx = source.x;
    const sy = source.y;
    const tx = target ? target.x : sx;
    const ty = target ? target.y : sy;

    const skillType = (skillConfig.type || "PROJECTILE").toUpperCase();
    const element = skillConfig.element || (skillConfig.tags && skillConfig.tags.includes("BREATH") ? "FIRE" : "MANA");

    if (skillType === "BREATH" || (skillConfig.tags && skillConfig.tags.includes("BREATH"))) {
      return new ConeBreathEffect(sx, sy, tx, ty, skillConfig);
    } else if (skillType === "PROJECTILE" || (skillConfig.tags && skillConfig.tags.includes("PROJECTILE"))) {
      return new ProjectileEffect(sx, sy, tx, ty, skillConfig);
    } else if (skillType === "BEAM" || (skillConfig.tags && skillConfig.tags.includes("BEAM"))) {
      return new SkillBeamEffect(sx, sy, tx, ty, element);
    } else if (skillType === "AOE" || (skillConfig.tags && skillConfig.tags.includes("AOE"))) {
      return new AoEExplosionEffect(tx, ty, skillConfig.maxRange || 3.0, element, null, skillConfig);
    } else {
      return new MeleeSlashEffect(tx, ty, element, null, skillConfig);
    }
  }
}
