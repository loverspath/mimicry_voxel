/**
 * @module VoxelMimicBridge
 * @description 미믹(Mimic)의 코어 융합, 변신(위장), 포식, 몬스터별 3D 크로매틱 셰이딩 및 복셀 모핑 이펙트 연동 브릿지.
 */

export class VoxelMimicBridge {
  /**
   * 엔티티의 현재 상태에 따른 3D 크로매틱 펄스 색상 및 Jitter 진폭 계산
   */
  static getEntityChromatic(entity, time = 0) {
    if (!entity) return null;

    // 1. Player Mimic Form Handling
    if (entity.name === 'Player' || entity.isPlayer === true || entity.char === '@' || entity.body || entity.mimicBody) {
      const activeCore = (entity.body && entity.body.activeCore) || (entity.mimicBody && entity.mimicBody.activeCore) || (entity.mimicCore && (entity.mimicCore.coreType || entity.mimicCore.name)) || null;
      let colors = ['#ffd700', '#38bdf8', '#ffffff', '#f43f5e'];
      let speed = 3.5;
      let jitter = 0;

      if (activeCore) {
        if (activeCore.includes('드래곤') || activeCore.includes('DRAGON')) {
          colors = ['#ef4444', '#f97316', '#ffd700', '#ffffff'];
          speed = 4.5;
          jitter = 1.2;
        } else if (activeCore.includes('골렘') || activeCore.includes('GOLEM')) {
          colors = ['#8d6e63', '#d7ccc8', '#00e5ff', '#ffffff'];
          speed = 2.5;
        } else if (activeCore.includes('치프틴') || activeCore.includes('CHIEFTAIN')) {
          colors = ['#f43f5e', '#a855f7', '#ffd700', '#ffffff'];
          speed = 4.0;
          jitter = 0.8;
        } else if (activeCore.includes('슬라임') || activeCore.includes('SLIME')) {
          colors = ['#10b981', '#34d399', '#6ee7b7', '#ffffff'];
          speed = 3.0;
        }
      }

      return {
        colors,
        speed,
        jitter,
        lightColor: [255, 215, 60],
        lightRadius: (entity.lightRange || 6) * 0.9
      };
    }

    // 2. Monster Chromatic Attributes
    const danger = entity.dangerLevel || (entity.stats ? entity.stats.level || 1 : 1);
    let baseColor = entity.color || '#e2e8f0';
    let colors = [baseColor, '#ffffff'];
    let speed = 2.0 + danger * 0.25;
    let jitter = (danger >= 5) ? (danger - 4) * 0.5 : 0;
    let lightColor = null;

    if (entity.name && (entity.name.includes('드래곤') || entity.name.includes('용암'))) {
      colors = ['#ef4444', '#f97316', '#ffeb3b'];
      lightColor = [249, 115, 22];
    } else if (entity.name && (entity.name.includes('치프틴') || entity.name.includes('족장'))) {
      colors = ['#f43f5e', '#d946ef', '#ffffff'];
      lightColor = [244, 63, 94];
    } else if (entity.name && (entity.name.includes('성역') || entity.name.includes('정령'))) {
      colors = ['#06b6d4', '#3b82f6', '#ffffff'];
      lightColor = [6, 182, 212];
    }

    return {
      colors,
      speed,
      jitter,
      lightColor,
      lightRadius: lightColor ? 3.5 : 0
    };
  }

  /**
   * 아이템의 3D 복셀 부유 및 크로매틱 색상
   */
  static getItemChromatic(item) {
    if (!item) return null;
    const baseColor = item.color || '#38bdf8';
    let colors = [baseColor, '#ffffff'];
    
    if (item.type === 'CORE') {
      colors = ['#a855f7', '#ec4899', '#38bdf8', '#ffd700'];
    } else if (item.type === 'WEAPON') {
      colors = ['#f43f5e', '#fb923c', '#ffffff'];
    } else if (item.type === 'ARMOR') {
      colors = ['#38bdf8', '#818cf8', '#ffffff'];
    }

    return {
      colors,
      speed: 2.2,
      jitter: 0
    };
  }
}
