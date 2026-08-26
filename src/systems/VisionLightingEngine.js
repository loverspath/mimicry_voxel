/**
 * @module VisionLightingEngine
 * @category systems
 * @description ToME 2.3.5 정통 광원 반경(Lite Radius), 9종 ESP(초감각 텔레파시: ESP_ORC, ESP_DRAGON,
 *              ESP_UNDEAD, ESP_DEMON, ESP_GIANT, ESP_TROLL, ESP_ANIMAL, ESP_HUMAN, ESP_EVIL, TELEPATHY),
 *              적외선 시야(Infravision), 투명 감지(See Invisible)를 종합 연산하는 순수 무상태 시야/조명 엔진.
 * @purity Stateless System
 * @dependencies TomeFlagResolver.js, UnifiedTraitEngine.js
 * @exports VisionLightingEngine
 */

import { TomeFlagResolver } from './TomeFlagResolver.js';
import { UnifiedTraitEngine } from './UnifiedTraitEngine.js';

export class VisionLightingEngine {
  /**
   * 맵 타일 시야 및 조명 범위를 산출합니다.
   * @param {Object} map - 던전 맵 객체 (isTransparent, width, height 지원)
   * @param {number} playerX
   * @param {number} playerY
   * @param {number} [lightRadius=1]
   * @param {Set<string>|Object} [flagsOrEntity]
   * @returns {Set<string>} 가시 좌표 세트 ('x,y' 형태)
   */
  static calculateVisionMap(map, playerX, playerY, lightRadius = 1, flagsOrEntity = null) {
    const visibleTiles = new Set();
    if (!map) return visibleTiles;

    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    const effectiveRadius = UnifiedTraitEngine.calculateLightRadius(flags, lightRadius);

    const r = Math.max(1, effectiveRadius);
    visibleTiles.add(`${playerX},${playerY}`);

    // 원형 브레즌햄 / 레이캐스팅 시야 연산
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist <= r + 0.5) {
          const tx = playerX + dx;
          const ty = playerY + dy;
          if (this._hasLineOfSight(map, playerX, playerY, tx, ty)) {
            visibleTiles.add(`${tx},${ty}`);
          }
        }
      }
    }

    return visibleTiles;
  }

  /**
   * 플레이어가 임의의 몬스터 감지(ESP 또는 적외선 시야) 능력을 보유하고 있는지 여부를 판정합니다.
   * @param {Object} player
   * @param {Set<string>|Object} [flagsOrEntity]
   * @returns {boolean}
   */
  static canDetectMonsters(player, flagsOrEntity = null) {
    if (!player) return false;
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity || player);
    return flags.has('TELEPATHY') ||
      flags.has('ESP_ALL') ||
      flags.has('ESP_EVIL') ||
      flags.has('ESP_ANIMAL') ||
      flags.has('ESP_UNDEAD') ||
      flags.has('ESP_DEMON') ||
      flags.has('ESP_ORC') ||
      flags.has('ESP_TROLL') ||
      flags.has('ESP_GIANT') ||
      flags.has('ESP_DRAGON') ||
      flags.has('ESP_HUMAN') ||
      flags.has('INFRA') ||
      flags.has('INFRA_VISION') ||
      Boolean(player.infraRadius && player.infraRadius > 0);
  }

  /**
   * 플레이어가 특정 몬스터를 감지/시야로 포착할 수 있는지 여부를 판정합니다.
   * @param {Object} player - 플레이어 인스턴스 (x, y, flags 등)
   * @param {Object} monster - 대상 몬스터 인스턴스
   * @param {Object} [map] - 던전 맵 객체
   * @param {Set<string>|Object} [flagsOrEntity] - 사전 취합된 플래그
   * @returns {{ visible: boolean, detectionMethod: string|null, reason: string }}
   */
  static isMonsterVisible(player, monster, map = null, flagsOrEntity = null) {
    if (!player || !monster) return { visible: false, detectionMethod: null, reason: 'Invalid entities' };

    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity || player);
    const mFlags = TomeFlagResolver.collectFlagsFromMonster(monster);
    const mType = (monster.type || '').toUpperCase();
    const mName = (monster.name || monster.displayName || '').toUpperCase();

    const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
    const hasLos = map ? this._hasLineOfSight(map, player.x, player.y, monster.x, monster.y) : true;
    const isMonsterInvis = mFlags.has('INVISIBLE') || mFlags.has('INVIS') || monster.isInvisible;

    // 1. ESP / 텔레파시 감지 (전 맵 투시, 벽 관통)
    const espResult = this._checkESP(flags, mFlags, mType, mName);
    if (espResult.detected) {
      return { visible: true, detectionMethod: 'ESP', reason: espResult.reason };
    }

    // 2. 적외선 감지 (Infravision: 온혈 몬스터 감지)
    const hasInfra = flags.has('INFRA') || flags.has('INFRA_VISION') || (player.infraRadius && player.infraRadius > 0);
    const infraRadius = player.infraRadius || 4.5;
    const isWarmBlooded = !mFlags.has('UNDEAD') && !mFlags.has('NONLIVING') && !mFlags.has('GOLEM') && !mFlags.has('ELEMENTAL') && !mType.includes('UNDEAD') && !mType.includes('GOLEM');
    if (hasInfra && isWarmBlooded && dist <= infraRadius && hasLos) {
      return { visible: true, detectionMethod: 'INFRARED', reason: '적외선 온혈 감지 (Infravision)' };
    }

    // 3. 일반 광원 시야 (Line of Sight + Light Radius)
    const lightRadius = UnifiedTraitEngine.calculateLightRadius(flags, player.lightRadius || 1);
    const withinLight = dist <= (lightRadius + 0.5);

    if (withinLight && hasLos) {
      // 투명 몬스터의 경우 투명 감지(SEE_INVIS / TELEPATHY) 필요
      if (isMonsterInvis) {
        const canSeeInvis = flags.has('SEE_INVIS') || flags.has('TELEPATHY') || flags.has('ESP_ALL');
        if (canSeeInvis) {
          return { visible: true, detectionMethod: 'SEE_INVIS', reason: '투명체 시각화 (See Invisible)' };
        } else {
          return { visible: false, detectionMethod: null, reason: '투명화된 몬스터 (투시 능력 필요)' };
        }
      }
      return { visible: true, detectionMethod: 'LOS', reason: '직접 광원 시야 (Line of Sight)' };
    }

    return { visible: false, detectionMethod: null, reason: '시야/광원 범위 밖' };
  }

  /**
   * 던전 내 모든 몬스터 중 플레이어가 감지한 몬스터 목록을 일괄 추출합니다.
   * @param {Array<Object>} monsterList
   * @param {Object} player
   * @param {Object} [map]
   * @param {Set<string>|Object} [flagsOrEntity]
   * @returns {Array<{ monster: Object, x: number, y: number, visible: boolean, detectionMethod: string, reason: string }>}
   */
  static getDetectedMonsters(monsterList, player, map = null, flagsOrEntity = null) {
    if (!monsterList || !Array.isArray(monsterList) || !player) return [];
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity || player);

    const detected = [];
    for (const monster of monsterList) {
      if (!monster || (monster.stats && monster.stats.hp <= 0)) continue;
      const res = this.isMonsterVisible(player, monster, map, flags);
      if (res.visible) {
        detected.push({
          monster,
          x: monster.x,
          y: monster.y,
          visible: true,
          detectionMethod: res.detectionMethod,
          reason: res.reason
        });
      }
    }
    return detected;
  }

  /**
   * ESP(초감각 텔레파시) 감지 여부를 판정합니다.
   * @private
   */
  static _checkESP(pFlags, mFlags, mType, mName) {
    const isMindless = mFlags.has('EMPTY_MIND') || mFlags.has('WEIRD_MIND');

    // 전능 텔레파시 (Telepathy / ESP_ALL): 무정신체 제외 모든 지성체 감지
    if ((pFlags.has('TELEPATHY') || pFlags.has('ESP_ALL')) && !isMindless) {
      return { detected: true, reason: '전체 텔레파시 (Universal Telepathy)' };
    }

    // 종족별 ESP 판정
    if (pFlags.has('ESP_ORC') && (mFlags.has('ORC') || mType.includes('ORC') || mType.includes('GOBLIN') || mName.includes('ORC') || mName.includes('GOBLIN'))) {
      return { detected: true, reason: '오크 감각 텔레파시 (ESP Orc)' };
    }
    if (pFlags.has('ESP_DRAGON') && (mFlags.has('DRAGON') || mType.includes('DRAGON') || mName.includes('DRAGON') || mName.includes('WYRM') || mName.includes('DRAKE'))) {
      return { detected: true, reason: '용족 감각 텔레파시 (ESP Dragon)' };
    }
    if (pFlags.has('ESP_UNDEAD') && (mFlags.has('UNDEAD') || mType.includes('UNDEAD') || mType.includes('SKELETON') || mType.includes('ZOMBIE') || mType.includes('LICH') || mName.includes('UNDEAD') || mName.includes('LICH') || mName.includes('GHOST'))) {
      return { detected: true, reason: '언데드 감지 텔레파시 (ESP Undead)' };
    }
    if (pFlags.has('ESP_DEMON') && (mFlags.has('DEMON') || mType.includes('DEMON') || mName.includes('DEMON') || mName.includes('BALROG') || mName.includes('IMP'))) {
      return { detected: true, reason: '악마 감지 텔레파시 (ESP Demon)' };
    }
    if (pFlags.has('ESP_GIANT') && (mFlags.has('GIANT') || mFlags.has('TROLL') || mType.includes('GIANT') || mType.includes('TROLL') || mType.includes('OGRE') || mName.includes('GIANT') || mName.includes('TROLL'))) {
      return { detected: true, reason: '거인 감지 텔레파시 (ESP Giant)' };
    }
    if (pFlags.has('ESP_TROLL') && (mFlags.has('TROLL') || mType.includes('TROLL') || mName.includes('TROLL'))) {
      return { detected: true, reason: '트롤 감지 텔레파시 (ESP Troll)' };
    }
    if (pFlags.has('ESP_ANIMAL') && (mFlags.has('ANIMAL') || mType.includes('BAT') || mType.includes('CANINE') || mType.includes('SPIDER') || mType.includes('WOLF') || mName.includes('BAT') || mName.includes('WOLF'))) {
      return { detected: true, reason: '야수 감지 텔레파시 (ESP Animal)' };
    }
    if (pFlags.has('ESP_HUMAN') && (mFlags.has('HUMAN') || mFlags.has('MORTAL') || mType.includes('HUMAN') || mType.includes('WARRIOR') || mType.includes('MAGE'))) {
      return { detected: true, reason: '인간형 감지 텔레파시 (ESP Human)' };
    }
    if (pFlags.has('ESP_EVIL') && (mFlags.has('EVIL') || mFlags.has('DEMON') || mFlags.has('UNDEAD') || mType.includes('EVIL') || mName.includes('EVIL') || mName.includes('DARK'))) {
      return { detected: true, reason: '사악체 감지 텔레파시 (ESP Evil)' };
    }

    return { detected: false, reason: null };
  }

  /**
   * 직선 시선(Line of Sight) 투명성 검사
   * @private
   */
  static _hasLineOfSight(map, x0, y0, x1, y1) {
    if (x0 === x1 && y0 === y1) return true;
    if (!map) return true;
    if (map.isTransparent) return map.isTransparent(x0, y0, x1, y1);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let currX = x0;
    let currY = y0;

    while (currX !== x1 || currY !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currY += sy;
      }

      if (currX === x1 && currY === y1) break;

      if (map.tiles && map.tiles[currY] && map.tiles[currY][currX]) {
        const tile = map.tiles[currY][currX];
        if (tile.isWall || tile.blocksSight || (tile.transparent === false)) {
          return false;
        }
      }
    }

    return true;
  }
}
