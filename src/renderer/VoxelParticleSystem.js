/**
 * @module VoxelParticleSystem
 * @description 3D 마이크로 복셀 큐브 물리 파편 및 파티클 연산 시스템.
 * 피격, 처치, 걷기, 포식, 레벨업 시 3D 회전과 바닥 튕김(Bounce) 물리 연산을 지원합니다.
 */

export class VoxelParticleSystem {
  constructor() {
    this.particles = [];
  }

  /**
   * 3D 복셀 파편 폭발 (피격 / 처치 / 상자 오픈 / 파괴)
   */
  spawnShatter(x, y, z, color, count = 14, speed = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.8 + 0.4) * speed;
      this.particles.push({
        x, y, z: z + 0.35,
        vx: Math.cos(angle) * spd * 0.045,
        vy: Math.sin(angle) * spd * 0.045,
        vz: (Math.random() * 0.8 + 0.5) * speed * 0.055,
        size: Math.random() * 3 + 3,
        color: color,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 8,
        life: 1.0,
        maxLife: 1.0 + Math.random() * 0.4
      });
    }
  }

  /**
   * 발자국 스파크 및 먼지 파티클
   */
  spawnFootstep(x, y, z, color = '#ffd700') {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.4,
        z: z + 0.1,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        vz: Math.random() * 0.04 + 0.02,
        size: 2.2,
        color: color,
        rot: 0, vrot: 2,
        life: 0.45, maxLife: 0.45
      });
    }
  }

  /**
   * 레벨업 및 코어 포식/진화 시 솟구치는 황금 복셀 분수
   */
  spawnFountain(x, y, z, colors = ['#ffd700', '#00ffcc', '#ffffff', '#f43f5e']) {
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 3.5 + 2.5;
      this.particles.push({
        x, y, z: z + 0.5,
        vx: Math.cos(angle) * spd * 0.04,
        vy: Math.sin(angle) * spd * 0.04,
        vz: (Math.random() * 0.6 + 0.8) * 0.14,
        size: Math.random() * 3.5 + 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random(), vrot: 6,
        life: 1.2, maxLife: 1.2
      });
    }
  }

  /**
   * 브레스 및 마법 발사체 궤적 파티클
   */
  spawnBreathTrail(x, y, z, color = '#f97316', count = 4) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + (Math.random() - 0.5) * 0.3,
        z: z + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.03,
        vy: (Math.random() - 0.5) * 0.03,
        vz: Math.random() * 0.05,
        size: Math.random() * 3 + 2,
        color: color,
        rot: Math.random(), vrot: 4,
        life: 0.6, maxLife: 0.6
      });
    }
  }

  /**
   * 물리 시뮬레이션 및 수명 업데이트
   */
  update(dt) {
    const gravity = 0.28;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vz -= gravity * dt;
      p.rot += p.vrot * dt;

      // 바닥 충돌 및 탄성 튕김 (Bounce)
      if (p.z <= 0) {
        p.z = 0;
        p.vz = -p.vz * 0.45;
        p.vx *= 0.7;
        p.vy *= 0.7;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  clear() {
    this.particles = [];
  }
}
