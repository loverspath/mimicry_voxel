/**
 * @module Voxel3DMapBridge
 * @category map
 * @description 2D 던전 맵 타일 데이터를 차세대 3D 다층 높이맵(Z=0~3) 복셀 블록 스택으로 변환 및 동기화하는 브릿지 시스템
 * @purity Data Model / State Store
 * @dependencies none
 * @exports VOXEL_THEMES, Voxel3DMapBridge
 */

export const VOXEL_THEMES = {
  WALL: {
    name: '심연의 복셀 성벽',
    top: [36, 42, 54], left: [22, 26, 36], right: [14, 18, 24],
    mortar: 'rgba(0,0,0,0.65)', bevel: 'rgba(255,255,255,0.12)',
    isWalkable: false, height: 2, pattern: 'brick'
  },
  FLOOR: {
    name: '석조 바닥',
    top: [58, 62, 75], left: [38, 42, 52], right: [24, 28, 36],
    mortar: 'rgba(0,0,0,0.4)', bevel: 'rgba(255,255,255,0.2)',
    isWalkable: true, height: 0, pattern: 'stone'
  },
  ELEVATED: {
    name: '고지대 제단',
    top: [90, 95, 115], left: [58, 62, 78], right: [40, 44, 56],
    mortar: 'rgba(0,0,0,0.5)', bevel: 'rgba(255,255,255,0.28)',
    isWalkable: true, height: 1, pattern: 'rune'
  },
  LAVA: {
    name: '작열하는 용암지대',
    top: [180, 48, 20], left: [110, 28, 12], right: [65, 15, 6],
    mortar: 'rgba(255,100,0,0.6)', bevel: 'rgba(255,200,50,0.45)',
    isWalkable: true, height: 0, hazard: 'fire',
    lightColor: [255, 85, 25], lightRadius: 4.8, pattern: 'magma'
  },
  SANCTUARY: {
    name: '비전의 성역',
    top: [20, 115, 140], left: [12, 75, 95], right: [8, 48, 60],
    mortar: 'rgba(0,255,255,0.4)', bevel: 'rgba(140,255,255,0.45)',
    isWalkable: true, height: 1, buff: 'heal',
    lightColor: [0, 245, 255], lightRadius: 5.2, pattern: 'crystal'
  },
  TREASURE: {
    name: '황금 보물터',
    top: [155, 120, 30], left: [105, 80, 16], right: [65, 48, 10],
    mortar: 'rgba(255,215,0,0.45)', bevel: 'rgba(255,245,160,0.5)',
    isWalkable: true, height: 0,
    lightColor: [255, 210, 45], lightRadius: 4.2, pattern: 'gold'
  },
  DOOR: {
    name: '고대 룬 문',
    top: [95, 75, 45], left: [65, 50, 28], right: [42, 32, 18],
    mortar: 'rgba(0,0,0,0.6)', bevel: 'rgba(255,220,120,0.3)',
    isWalkable: true, height: 1, pattern: 'wood'
  },
  STAIRS_DOWN: {
    name: '하층 진입 계단',
    top: [80, 50, 120], left: [50, 30, 80], right: [32, 18, 52],
    mortar: 'rgba(168,85,247,0.5)', bevel: 'rgba(216,180,254,0.4)',
    isWalkable: true, height: 0,
    lightColor: [192, 132, 252], lightRadius: 3.5, pattern: 'stair'
  },
  STAIRS_UP: {
    name: '상층 귀환 계단',
    top: [45, 110, 95], left: [28, 75, 62], right: [18, 48, 38],
    mortar: 'rgba(56,189,248,0.5)', bevel: 'rgba(186,230,253,0.4)',
    isWalkable: true, height: 0,
    lightColor: [56, 189, 248], lightRadius: 3.5, pattern: 'stair'
  }
};

/**
 * 2D 맵을 3D 복셀 다층 스택 구조로 변환 관리하는 브릿지 클래스
 */
export class Voxel3DMapBridge {
  /**
   * 브릿지 인스턴스 초기화
   * @param {object} map - Map 클래스 인스턴스
   */
  constructor(map) {
    this.map = map;
    this.voxelGrid = [];
    this.rebuildVoxelGrid();
  }

  /**
   * 2D 맵의 방 및 타일 데이터를 순회하며 3D 복셀 스택 그리드를 재구성합니다.
   */
  rebuildVoxelGrid() {
    if (!this.map) return;
    const { width, height, tiles, rooms } = this.map;

    this.voxelGrid = Array.from({ length: width }, () =>
      Array.from({ length: height }, () => [])
    );

    // Map room biomes
    const roomBiomeMap = new Map();
    if (rooms) {
      rooms.forEach((r, idx) => {
        let biome = 'FLOOR';
        if (r.type === 'TREASURE_VAULT') biome = 'TREASURE';
        else if (r.type === 'MONSTER_PIT') biome = 'ELEVATED';
        else if (r.type === 'BOSS') biome = 'LAVA';
        else if (idx === 2) biome = 'SANCTUARY';
        else if (idx % 3 === 0) biome = 'ELEVATED';
        roomBiomeMap.set(r, biome);
      });
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y] ? tiles[y][x] : null;
        if (!tile) continue;

        let themeKey = 'FLOOR';
        let maxZ = 0;
        let isWalkable = tile.isWalkable;

        // Check if inside a special room
        if (rooms) {
          for (const room of rooms) {
            if (x >= room.x1 && x < room.x2 && y >= room.y1 && y < room.y2) {
              const b = roomBiomeMap.get(room);
              if (b && tile.isWalkable) {
                themeKey = b;
                if (b === 'ELEVATED' || b === 'SANCTUARY') maxZ = 1;
              }
              break;
            }
          }
        }

        // Special tile overrides
        if (tile.char === '#' || tile.type === 'WALL' || tile.type === 'VAULT_WALL') {
          themeKey = 'WALL';
          maxZ = 2;
          isWalkable = false;
        } else if (tile.char === '+' || tile.type === 'DOOR') {
          themeKey = 'DOOR';
          maxZ = 1;
          isWalkable = true;
        } else if (tile.char === '>' || tile.type === 'STAIRS_DOWN') {
          themeKey = 'STAIRS_DOWN';
          maxZ = 0;
          isWalkable = true;
        } else if (tile.char === '<' || tile.type === 'STAIRS_UP') {
          themeKey = 'STAIRS_UP';
          maxZ = 0;
          isWalkable = true;
        } else if (tile.char === '$' || tile.char === '*' || tile.type === 'TREASURE' || tile.type === 'VAULT_FLOOR') {
          themeKey = 'TREASURE';
          maxZ = 0;
          isWalkable = true;
        } else if (tile.char === '^' || (tile.color && tile.color.includes('f97316')) || tile.type === 'LAVA') {
          themeKey = 'LAVA';
          maxZ = 0;
          isWalkable = true;
        }

        // Build 3D multi-layered Voxel stack from z=0 to maxZ
        const stack = [];
        for (let z = 0; z <= maxZ; z++) {
          stack.push({
            x, y, z,
            themeKey: (z === maxZ) ? themeKey : (themeKey === 'WALL' ? 'WALL' : 'FLOOR'),
            isWalkable: (z === maxZ) ? isWalkable : false,
            isTop: (z === maxZ),
            originalTile: tile
          });
        }
        this.voxelGrid[x][y] = stack;
      }
    }
  }

  /**
   * 지정한 (x, y) 좌표의 3D 복셀 스택 배열을 반환합니다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {Array<object>} Z축 복셀 스택 배열
   */
  getVoxelStack(x, y) {
    if (x >= 0 && x < this.map.width && y >= 0 && y < this.map.height) {
      return this.voxelGrid[x][y] || [];
    }
    return [];
  }

  /**
   * 지정한 (x, y) 좌표의 최상단(Top) 복셀 블록을 반환합니다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {object|null} 최상단 복셀 블록 객체
   */
  getTopVoxel(x, y) {
    const stack = this.getVoxelStack(x, y);
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }
}
