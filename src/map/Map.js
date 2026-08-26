/**
 * @module Map
 * @category map
 * @description 1~50층 5대 테마 던전 절차적 생성기, 타일 충돌/투명도 FOV 판정, 보스룸 및 특수 지형(보물 금고 Vault & 몬스터 피트 Monster Pit) 배치 시스템
 * @purity Data Model / State Store
 * @dependencies DungeonThemeConfig.js
 * @exports RectRoom, Map
 */

import {
  getThemeForFloor,
  getThemeConfig,
  getAmbientText,
  getRandomPitMonsterSpecies
} from '../configs/DungeonThemeConfig.js';
import { DungeonValueBudgetEngine } from '../systems/DungeonValueBudgetEngine.js';

/**
 * 절차적 던전 방(Room) 데이터 구조체
 */
export class RectRoom {
  /**
   * 직사각형 방 생성자
   * @param {number} x - 방의 시작 X 좌표
   * @param {number} y - 방의 시작 Y 좌표
   * @param {number} w - 방의 가로 너비
   * @param {number} h - 방의 세로 높이
   * @param {string} type - 방 유형 ('NORMAL' | 'BOSS' | 'TREASURE_VAULT' | 'MONSTER_PIT' | 'SANCTUARY')
   */
  constructor(x, y, w, h, type = 'NORMAL') {
    this.x1 = x;
    this.y1 = y;
    this.x2 = x + w;
    this.y2 = y + h;
    this.w = w;
    this.h = h;
    this.type = type;

    // 특수 방 세부 속성
    this.theme = null;
    this.vaultType = null;        // 'INNER_CHAMBER', 'PILLAR_GUARD', 'GEM_ALCOVE', etc.
    this.pitSpecies = null;       // 'GOBLIN', 'ORC', 'SKELETON', 'DRAGON', etc.
    this.pitTiles = [];           // [{x, y, species}]
    this.treasureTiles = [];      // [{x, y, isGuarded}]
    this.trapTiles = [];          // [{x, y, type}]
    this.doorTiles = [];          // [{x, y}]
    this.innerWalls = [];         // [{x, y}]
  }

  /**
   * 방의 중심 좌표를 계산하여 반환합니다.
   * @returns {{x: number, y: number}} 중심점 좌표
   */
  get center() {
    return {
      x: Math.floor((this.x1 + this.x2) / 2),
      y: Math.floor((this.y1 + this.y2) / 2)
    };
  }

  /**
   * 방의 가로 너비를 반환합니다.
   * @returns {number}
   */
  get width() {
    return this.x2 - this.x1;
  }

  /**
   * 방의 세로 높이를 반환합니다.
   * @returns {number}
   */
  get height() {
    return this.y2 - this.y1;
  }

  /**
   * 다른 방과의 교차(충돌) 여부를 판정합니다.
   * @param {RectRoom} other - 비교할 다른 방
   * @param {number} padding - 여백 간격 (기본값 0)
   * @returns {boolean} 충돌 여부
   */
  intersects(other, padding = 0) {
    return (
      this.x1 - padding <= other.x2 + padding &&
      this.x2 + padding >= other.x1 - padding &&
      this.y1 - padding <= other.y2 + padding &&
      this.y2 + padding >= other.y1 - padding
    );
  }

  /**
   * 특정 좌표가 방 내부에 포함되는지 판정합니다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {boolean} 포함 여부
   */
  contains(x, y) {
    return x >= this.x1 && x < this.x2 && y >= this.y1 && y < this.y2;
  }

  /**
   * 벽을 제외한 방 내부 유효 바닥 경계를 반환합니다.
   * @returns {{x1: number, y1: number, x2: number, y2: number}}
   */
  getInnerBounds() {
    return {
      x1: this.x1 + 1,
      y1: this.y1 + 1,
      x2: this.x2 - 1,
      y2: this.y2 - 1
    };
  }
}

/**
 * 절차적 던전 맵 모델 및 시야(FOV)/충돌 판정 클래스
 */
export class Map {
  /**
   * 절차적 던전 맵 인스턴스 초기화
   * @param {number} width - 맵 가로 너비 (타일 단위)
   * @param {number} height - 맵 세로 높이 (타일 단위)
   * @param {number} floor - 현재 던전 층수 (1~50)
   * @param {object} options - 생성 옵션 (maxRooms, forceRoomType 등)
   */
  constructor(width, height, floor = 1, options = {}) {
    this.width = width;
    this.height = height;
    this.floor = Math.max(1, Math.floor(floor || 1));

    // 현재 층에 대응하는 5대 테마 로드
    this.theme = getThemeForFloor(this.floor);
    this.themeKey = this.theme.id;

    // 던전 생성 파라미터
    const defaultDim = DungeonValueBudgetEngine.calculateMapDimensions(this.floor);
    this.maxRooms = options.maxRooms || defaultDim.maxRooms || 15;
    this.roomMinSize = options.roomMinSize || 6;
    this.roomMaxSize = options.roomMaxSize || 10;

    this.startingPosition = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    this.rooms = [];
    this.upStaircases = [];
    this.downStaircases = [];
    this.tiles = this.generateDungeon(options);
  }

  /**
   * 테마 및 특수 룸(Vault, Pit, Boss) 규칙에 기반하여 절차적 던전을 생성합니다.
   * @param {object} options - 생성 옵션
   * @returns {Array<Array<object>>} 2차원 타일 배열
   */
  generateDungeon(options = {}) {
    const wallColor = this.theme.colors.wallColor;
    const wallChar = this.theme.colors.wallChar || '#';
    const floorColor = this.theme.colors.floorColor;
    const floorChar = this.theme.colors.floorChar || '.';
    const corridorColor = this.theme.colors.corridorColor || floorColor;

    // 1. 테마 벽 타일로 전체 맵 초기화
    const tiles = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push({
          x,
          y,
          isWalkable: false,
          char: wallChar,
          color: wallColor,
          isExplored: false,
          type: 'WALL',
          roomType: null,
          isStaircase: false,
          isUpStaircase: false,
          isTrap: false,
          isPitTile: false,
          isVaultTile: false,
          pitSpecies: null
        });
      }
      tiles.push(row);
    }

    /**
     * 바닥 타일 카빙 헬퍼 함수
     */
    const carveTile = (x, y, char = floorChar, color = floorColor, type = 'FLOOR', roomType = null, extraProps = {}) => {
      if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
        const tile = tiles[y][x];
        const isWall = (char === '#' || type === 'WALL' || type === 'VAULT_WALL');
        tile.isWalkable = !isWall;
        tile.char = char;
        tile.color = color;
        tile.type = type;
        tile.roomType = roomType;
        if (extraProps && typeof extraProps === 'object') {
          Object.assign(tile, extraProps);
        }
      }
    };

    /**
     * 특수 벽 타일 배치 헬퍼 함수
     */
    const placeWallTile = (x, y, char = '#', color = wallColor, type = 'VAULT_WALL', roomType = null) => {
      if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
        const tile = tiles[y][x];
        tile.isWalkable = false;
        tile.char = char;
        tile.color = color;
        tile.type = type;
        tile.roomType = roomType;
      }
    };

    /**
     * 수평 복도 카빙
     */
    const carveHorizontalTunnel = (x1, x2, y) => {
      const start = Math.min(x1, x2);
      const end = Math.max(x1, x2);
      for (let x = start; x <= end; x++) {
        carveTile(x, y, '.', corridorColor, 'CORRIDOR');
      }
    };

    /**
     * 수직 복도 카빙
     */
    const carveVerticalTunnel = (y1, y2, x) => {
      const start = Math.min(y1, y2);
      const end = Math.max(y1, y2);
      for (let y = start; y <= end; y++) {
        carveTile(x, y, '.', corridorColor, 'CORRIDOR');
      }
    };

    this.rooms = [];

    // 2. 방 절차적 배치 및 복도 연결 (기본 골격 생성)
    for (let i = 0; i < this.maxRooms; i++) {
      const w = Math.floor(Math.random() * (this.roomMaxSize - this.roomMinSize + 1)) + this.roomMinSize;
      const h = Math.floor(Math.random() * (this.roomMaxSize - this.roomMinSize + 1)) + this.roomMinSize;

      const x = Math.floor(Math.random() * (this.width - w - 2)) + 1;
      const y = Math.floor(Math.random() * (this.height - h - 2)) + 1;

      const newRoom = new RectRoom(x, y, w, h);
      newRoom.theme = this.theme.id;

      // 충돌 검사
      let intersects = false;
      for (const otherRoom of this.rooms) {
        if (newRoom.intersects(otherRoom, 1)) {
          intersects = true;
          break;
        }
      }

      if (!intersects) {
        // 방 유형 결정 (1~5층은 Vault 0%, Pit 0% 완전 차단)
        let roomType = 'NORMAL';
        if (this.rooms.length > 0) {
          if (options.forceRoomType) {
            roomType = options.forceRoomType;
          } else {
            const specialProbs = DungeonValueBudgetEngine.getSpecialRoomProbabilities(this.floor);
            const vaultChance = specialProbs.vaultChance;
            const pitChance = specialProbs.monsterPitChance;
            const roll = Math.random();

            if (roll < vaultChance) {
              roomType = 'TREASURE_VAULT';
            } else if (roll < vaultChance + pitChance) {
              roomType = 'MONSTER_PIT';
            }
          }
        }
        newRoom.type = roomType;

        // 기본 방 바닥 카빙
        for (let ry = newRoom.y1; ry < newRoom.y2; ry++) {
          for (let rx = newRoom.x1; rx < newRoom.x2; rx++) {
            carveTile(rx, ry, floorChar, floorColor, 'FLOOR', roomType);
          }
        }

        const center = newRoom.center;

        if (this.rooms.length === 0) {
          // 첫 번째 방: 플레이어 시작 지점 설정
          this.startingPosition = center;
        } else {
          // 이전 방과 터널 연결
          const prevCenter = this.rooms[this.rooms.length - 1].center;

          if (Math.random() < 0.5) {
            carveHorizontalTunnel(prevCenter.x, center.x, prevCenter.y);
            carveVerticalTunnel(prevCenter.y, center.y, center.x);
          } else {
            carveVerticalTunnel(prevCenter.y, center.y, prevCenter.x);
            carveHorizontalTunnel(prevCenter.x, center.x, center.y);
          }
        }

        this.rooms.push(newRoom);
      }
    }

    // 3. 특수 룸(TREASURE_VAULT, MONSTER_PIT) 상세 내부 구조 적용 (터널 연결 후 오버라이드)
    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const w = room.w;
      const h = room.h;
      const center = room.center;

      if (room.type === 'TREASURE_VAULT') {
        // ==================== 보물 금고 (TREASURE_VAULT) ====================
        const vaultFloorCol = this.theme.colors.vaultFloorColor || '#c084fc';
        const trapCol = this.theme.colors.trapColor || '#f59e0b';
        const doorCol = this.theme.colors.doorColor || '#b45309';

        // 금고 바닥 카빙
        for (let ry = room.y1; ry < room.y2; ry++) {
          for (let rx = room.x1; rx < room.x2; rx++) {
            carveTile(rx, ry, '*', vaultFloorCol, 'VAULT_FLOOR', 'TREASURE_VAULT', { isVaultTile: true });
          }
        }

        if (w >= 7 && h >= 7) {
          // 대형 금고: 내부 이중벽 밀실 구조 (Inner Chamber Sanctum)
          room.vaultType = 'INNER_CHAMBER';
          const innerX1 = room.x1 + 2;
          const innerY1 = room.y1 + 2;
          const innerX2 = room.x2 - 3;
          const innerY2 = room.y2 - 3;

          for (let iy = innerY1; iy <= innerY2; iy++) {
            for (let ix = innerX1; ix <= innerX2; ix++) {
              const isBorder = (ix === innerX1 || ix === innerX2 || iy === innerY1 || iy === innerY2);
              if (isBorder) {
                placeWallTile(ix, iy, '#', wallColor, 'VAULT_WALL', 'TREASURE_VAULT');
                room.innerWalls.push({ x: ix, y: iy });
              }
            }
          }

          // 밀실 입구 문(Door) 생성 (중앙 1곳)
          const doorX = center.x;
          const doorY = innerY2;
          carveTile(doorX, doorY, '+', doorCol, 'DOOR', 'TREASURE_VAULT', { isWalkable: true });
          room.doorTiles.push({ x: doorX, y: doorY });

          // 밀실 중심 보물 타일 배치
          carveTile(center.x, center.y, '$', '#facc15', 'TREASURE', 'TREASURE_VAULT', { isVaultTile: true, isWalkable: true });
          room.treasureTiles.push({ x: center.x, y: center.y, isGuarded: true });

          // 보물 주변 함정(Trap) 배치
          const trapCandidates = [
            { x: center.x - 1, y: center.y },
            { x: center.x + 1, y: center.y },
            { x: center.x, y: center.y - 1 }
          ];
          trapCandidates.forEach(tc => {
            if (tc.x > innerX1 && tc.x < innerX2 && tc.y > innerY1 && tc.y < innerY2) {
              carveTile(tc.x, tc.y, '^', trapCol, 'TRAP', 'TREASURE_VAULT', { isTrap: true, isWalkable: true, isVaultTile: true });
              room.trapTiles.push({ x: tc.x, y: tc.y, type: 'TRAP' });
            }
          });
        } else {
          // 소형 금고: 기둥 수호 밀실 (Pillar Guarded Alcove)
          room.vaultType = 'GEM_ALCOVE';
          // 4개 모서리 기둥 벽 배치
          const corners = [
            { x: room.x1 + 1, y: room.y1 + 1 },
            { x: room.x2 - 2, y: room.y1 + 1 },
            { x: room.x1 + 1, y: room.y2 - 2 },
            { x: room.x2 - 2, y: room.y2 - 2 }
          ];
          corners.forEach(c => {
            placeWallTile(c.x, c.y, '#', wallColor, 'VAULT_WALL', 'TREASURE_VAULT');
            room.innerWalls.push(c);
          });

          // 중앙 보물 타일 배치
          carveTile(center.x, center.y, '$', '#facc15', 'TREASURE', 'TREASURE_VAULT', { isVaultTile: true, isWalkable: true });
          room.treasureTiles.push({ x: center.x, y: center.y, isGuarded: true });

          // 보물 앞 함정 1개 배치
          const trapPos = { x: center.x, y: Math.min(room.y2 - 2, center.y + 1) };
          if (trapPos.y !== center.y) {
            carveTile(trapPos.x, trapPos.y, '^', trapCol, 'TRAP', 'TREASURE_VAULT', { isTrap: true, isWalkable: true, isVaultTile: true });
            room.trapTiles.push({ x: trapPos.x, y: trapPos.y, type: 'TRAP' });
          }
        }

      } else if (room.type === 'MONSTER_PIT') {
        // ==================== 몬스터 피트 (MONSTER_PIT) ====================
        const pitFloorCol = this.theme.colors.pitFloorColor || '#4ade80';
        const pitSpecies = getRandomPitMonsterSpecies(this.floor);
        room.pitSpecies = pitSpecies;
        room.pitTiles = [];

        // 피트 바닥 카빙 및 피트 스폰 타일 마킹
        for (let ry = room.y1; ry < room.y2; ry++) {
          for (let rx = room.x1; rx < room.x2; rx++) {
            carveTile(rx, ry, '.', pitFloorCol, 'PIT_FLOOR', 'MONSTER_PIT', {
              isPitTile: true,
              pitSpecies: pitSpecies
            });
            room.pitTiles.push({ x: rx, y: ry, species: pitSpecies });
          }
        }
      }
    }

    // 4. 시작 방 안전성 보장 및 초기 시야(FOV) 사전 탐색
    if (this.rooms.length > 0) {
      const startRoom = this.rooms[0];
      startRoom.type = 'NORMAL'; // 시작 방은 항상 NORMAL
      const cx = startRoom.center.x;
      const cy = startRoom.center.y;
      this.startingPosition = { x: cx, y: cy };

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          carveTile(cx + dx, cy + dy, '.', floorColor, 'FLOOR', 'NORMAL');
        }
      }

      // 시작 방 주변 타일 탐색 완료(isExplored) 마킹
      for (let ry = Math.max(0, startRoom.y1 - 1); ry <= Math.min(this.height - 1, startRoom.y2); ry++) {
        for (let rx = Math.max(0, startRoom.x1 - 1); rx <= Math.min(this.width - 1, startRoom.x2); rx++) {
          if (tiles[ry] && tiles[ry][rx]) {
            tiles[ry][rx].isExplored = true;
          }
        }
      }
    }

    // 5. 보스룸 지정 및 다중 상/하행 계단 분산 배치
    if (this.rooms.length > 0) {
      const lastRoom = this.rooms[this.rooms.length - 1];

      // 5층 단위 보스룸 지정 (5, 10, 15, ..., 50층)
      if (this.floor % 5 === 0) {
        lastRoom.type = 'BOSS';
        for (let ry = lastRoom.y1; ry < lastRoom.y2; ry++) {
          for (let rx = lastRoom.x1; rx < lastRoom.x2; rx++) {
            carveTile(rx, ry, 'x', '#fca5a5', 'BOSS', 'BOSS');
          }
        }
      }

      // 층수 및 가용 방 개수에 따른 목표 상/하행 계단 수 산출
      const stairCounts = DungeonValueBudgetEngine.calculateStaircaseCounts(this.floor, this.rooms.length);
      const targetUpStairs = stairCounts.upStairs;
      const targetDownStairs = stairCounts.downStairs;

      this.upStaircases = [];
      this.downStaircases = [];

      const totalRooms = this.rooms.length;
      const selectedUpRoomIndices = [0]; // 1번째 상행 계단은 시작 방(0번 방)
      const selectedDownRoomIndices = [];

      if (targetDownStairs > 0 && totalRooms > 1) {
        // 1번째 하행 계단은 가장 깊은 방(마지막 방: 보스룸 또는 끝 방)
        selectedDownRoomIndices.push(totalRooms - 1);
      } else if (targetDownStairs > 0 && totalRooms === 1) {
        selectedDownRoomIndices.push(0);
      }

      // 두 방 중심 간의 유클리드 거리 계산
      const getRoomDistance = (r1, r2) => {
        const c1 = r1.center;
        const c2 = r2.center;
        return Math.hypot(c1.x - c2.x, c1.y - c2.y);
      };

      // 방 유형별 계단 배치 우선순위 패널티 (NORMAL 방 우선)
      const getRoomPenalty = (r) => {
        if (r.type === 'NORMAL') return 0;
        if (r.type === 'MONSTER_PIT') return 5;
        if (r.type === 'BOSS') return 10;
        return 50; // TREASURE_VAULT는 보물 보호를 위해 최후 순위
      };

      // 미선택 방 인덱스 목록
      const getAvailableIndices = (usedIndices) => {
        const list = [];
        for (let i = 0; i < totalRooms; i++) {
          if (!usedIndices.includes(i)) list.push(i);
        }
        return list;
      };

      // 추가 상행 계단 분산 선정 (기존 상행 계단들과의 거리 최대화 & 방 타입 우선)
      while (selectedUpRoomIndices.length < targetUpStairs) {
        const used = [...selectedUpRoomIndices, ...selectedDownRoomIndices];
        const avail = getAvailableIndices(used);
        if (avail.length === 0) break;

        let bestIdx = avail[0];
        let bestScore = -Infinity;
        for (const idx of avail) {
          let minDist = Infinity;
          for (const uIdx of selectedUpRoomIndices) {
            const dist = getRoomDistance(this.rooms[idx], this.rooms[uIdx]);
            if (dist < minDist) minDist = dist;
          }
          const score = minDist - getRoomPenalty(this.rooms[idx]);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
        selectedUpRoomIndices.push(bestIdx);
      }

      // 추가 하행 계단 분산 선정 (모든 기배치 계단들과의 거리 최대화 & 방 타입 우선)
      while (selectedDownRoomIndices.length < targetDownStairs) {
        const used = [...selectedUpRoomIndices, ...selectedDownRoomIndices];
        const avail = getAvailableIndices(used);
        if (avail.length === 0) break;

        let bestIdx = avail[0];
        let bestScore = -Infinity;
        for (const idx of avail) {
          let minDist = Infinity;
          for (const allIdx of [...selectedUpRoomIndices, ...selectedDownRoomIndices]) {
            const dist = getRoomDistance(this.rooms[idx], this.rooms[allIdx]);
            if (dist < minDist) minDist = dist;
          }
          const score = minDist - getRoomPenalty(this.rooms[idx]);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
        selectedDownRoomIndices.push(bestIdx);
      }

      // 방 내부 계단 안전 좌표 탐색 헬퍼 (보물 및 함정 덮어쓰기 원천 방지)
      const findSafeStairPos = (room) => {
        const center = room.center;
        const centerTile = tiles[center.y][center.x];
        if (centerTile && centerTile.isWalkable && centerTile.char !== '$' && centerTile.char !== '^' && centerTile.char !== '+' && centerTile.type !== 'TREASURE') {
          return { x: center.x, y: center.y };
        }
        for (let ry = room.y1 + 1; ry < room.y2 - 1; ry++) {
          for (let rx = room.x1 + 1; rx < room.x2 - 1; rx++) {
            const t = tiles[ry][rx];
            if (t && t.isWalkable && t.char !== '$' && t.char !== '^' && t.char !== '+' && t.type !== 'TREASURE') {
              return { x: rx, y: ry };
            }
          }
        }
        return { x: center.x, y: center.y };
      };

      // 상행 계단 타일 카빙 및 속성 적용
      for (const roomIdx of selectedUpRoomIndices) {
        const room = this.rooms[roomIdx];
        const pos = findSafeStairPos(room);
        const upStairTile = tiles[pos.y][pos.x];
        upStairTile.isWalkable = true;
        upStairTile.type = 'STAIRS_UP';
        upStairTile.char = '<';

        if (this.floor > 1) {
          upStairTile.color = this.theme.colors.stairUpColor || '#38bdf8';
          upStairTile.isUpStaircase = true;
          this.upStaircases.push({ x: pos.x, y: pos.y, isSealed: false, roomIndex: roomIdx });
        } else {
          // 1층 상행 계단은 봉인 상태 (회색)
          upStairTile.color = '#475569';
          upStairTile.isUpStaircase = false;
          this.upStaircases.push({ x: pos.x, y: pos.y, isSealed: true, roomIndex: roomIdx });
        }
      }

      // 하행 계단 타일 카빙 및 속성 적용 (50층은 targetDownStairs=0이므로 생성 안 됨)
      for (const roomIdx of selectedDownRoomIndices) {
        const room = this.rooms[roomIdx];
        const pos = findSafeStairPos(room);
        const stairTile = tiles[pos.y][pos.x];
        stairTile.isWalkable = true;
        stairTile.char = '>';
        stairTile.color = this.theme.colors.stairDownColor || '#f43f5e';
        stairTile.type = 'STAIRS_DOWN';
        stairTile.isStaircase = true;
        this.downStaircases.push({ x: pos.x, y: pos.y, roomIndex: roomIdx });
      }
    }

    return tiles;
  }

  /**
   * 지정한 좌표의 타일 객체를 조회합니다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {object|null} 타일 객체 또는 유효하지 않을 시 null
   */
  getTile(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.tiles[y][x];
    }
    return null;
  }

  /**
   * 지정한 좌표가 이동 가능한(Walkable) 타일인지 판정합니다.
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {boolean} 이동 가능 여부
   */
  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return tile ? tile.isWalkable : false;
  }

  /**
   * 지정한 좌표가 벽인지 판정합니다.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isWall(x, y) {
    return !this.isWalkable(x, y);
  }

  /**
   * 두 좌표 사이의 시선(LOS / Transparency) 투과 여부를 브레젠험 알고리즘으로 판정합니다.
   * @param {number} x1 - 출발지 X
   * @param {number} y1 - 출발지 Y
   * @param {number} x2 - 목적지 X
   * @param {number} y2 - 목적지 Y
   * @returns {boolean} 시야 투과 여부
   */
  isTransparent(x1, y1, x2, y2) {
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    x2 = Math.round(x2);
    y2 = Math.round(y2);

    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    let sx = (x1 < x2) ? 1 : -1;
    let sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;

    let cx = x1;
    let cy = y1;

    let safetyLimit = 1000;
    while (safetyLimit-- > 0) {
      if (cx === x2 && cy === y2) {
        return true;
      }

      if ((cx !== x1 || cy !== y1) && (cx !== x2 || cy !== y2)) {
        const tile = this.getTile(cx, cy);
        if (tile && (tile.char === '#' || !tile.isWalkable)) {
          return false;
        }
      }

      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
    return false;
  }

  /**
   * 특정 유형의 방 목록을 필터링하여 반환합니다.
   * @param {string} type - 방 유형 ('NORMAL', 'TREASURE_VAULT', 'MONSTER_PIT', 'BOSS')
   * @returns {Array<RectRoom>} 일치하는 방 배열
   */
  getRoomsByType(type) {
    return this.rooms.filter(r => r.type === type);
  }

  /**
   * 생성된 보물 금고(Vault) 방 목록을 반환합니다.
   * @returns {Array<RectRoom>}
   */
  getVaultRooms() {
    return this.getRoomsByType('TREASURE_VAULT');
  }

  /**
   * 생성된 몬스터 피트(Monster Pit) 방 목록을 반환합니다.
   * @returns {Array<RectRoom>}
   */
  getPitRooms() {
    return this.getRoomsByType('MONSTER_PIT');
  }

  /**
   * 보스 방(BOSS) 객체를 반환합니다.
   * @returns {RectRoom|null}
   */
  getBossRoom() {
    return this.rooms.find(r => r.type === 'BOSS') || null;
  }

  /**
   * 현재 맵의 던전 테마 설정 객체를 반환합니다.
   * @returns {object}
   */
  getTheme() {
    return this.theme;
  }

  /**
   * 생성된 모든 하행 계단 위치 목록을 반환합니다.
   * @returns {Array<{x: number, y: number, roomIndex?: number}>}
   */
  getStaircases() {
    return [...this.downStaircases];
  }

  /**
   * 생성된 모든 상행 계단 위치 목록을 반환합니다.
   * @returns {Array<{x: number, y: number, isSealed: boolean, roomIndex?: number}>}
   */
  getUpStairs() {
    return [...this.upStaircases];
  }

  /**
   * 생성된 모든 하행 계단 위치 목록을 반환합니다.
   * @returns {Array<{x: number, y: number, roomIndex?: number}>}
   */
  getDownStairs() {
    return [...this.downStaircases];
  }

  /**
   * 현재 테마에 대응하는 무작위 분위기 텍스트를 반환합니다.
   * @returns {string}
   */
  getAmbientDescription() {
    return getAmbientText(this.floor);
  }
}
