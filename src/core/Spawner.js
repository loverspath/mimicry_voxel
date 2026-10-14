/**
 * @module Spawner
 * @category core
 * @description ToME 2.3.5 정통 던전 깊이(Depth) 기반 동적 몬스터 및 아이템 스포너 엔진.
 *              851종 몬스터 풀, 유니크 몬스터 1회성 스폰 생태계, Vault 및 Monster Pit 전용 군집 스폰, 테마별 절차적 배치 지원.
 * @purity Pure Factory / Spawner Logic
 * @dependencies Item.js, Monster.js, Tags.js, TomeLootGenerator.js, MonsterRegistry.js, UniqueMonsterManager.js, GameBalanceConfig.js, BossPhaseEngine.js
 * @exports Spawner, SPECIAL_MONSTER_PACKS, MONSTER_PIT_THEMES, DUNGEON_THEMES
 */

import { Item } from '../entities/Item.js';
import { Monster } from '../entities/Monster.js';
import { rollTags, rollJobSuffix } from '../entities/Tags.js';
import { TomeLootGenerator } from '../systems/TomeLootGenerator.js';
import { MONSTER_SPECIES } from '../entities/MonsterRegistry.js';
import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { calculateElitePrefixChance, isJokeMonster, SPAWN_FEATURE_CONFIG, DUNGEON_CUSTOM_SETTINGS } from '../configs/GameBalanceConfig.js';
import { uniqueMonsterManager } from '../systems/UniqueMonsterManager.js';
import { bossPhaseEngine } from '../systems/BossPhaseEngine.js';
import { DungeonValueBudgetEngine, clampMonsterHp } from '../systems/DungeonValueBudgetEngine.js';
import { getThemeForFloor } from '../configs/DungeonThemeConfig.js';

/**
 * 던전 층별 테마 정의
 */
export const DUNGEON_THEMES = {
  STANDARD: { key: 'STANDARD', name: '표준 던전', preferredSpecies: ['GOBLIN', 'ORC', 'BAT', 'SLIME', 'HUMAN', 'OGRE'] },
  ORC_STRONGHOLD: { key: 'ORC_STRONGHOLD', name: '오크 요새', preferredSpecies: ['ORC', 'GOBLIN', 'OGRE', 'TROLL'] },
  UNDEAD_CRYPT: { key: 'UNDEAD_CRYPT', name: '언데드 지하 묘지', preferredSpecies: ['HUMAN', 'BAT', 'IMP'] },
  DRAGON_LAIR: { key: 'DRAGON_LAIR', name: '용의 둥지', preferredSpecies: ['HATCHLING', 'DRAGON', 'IMP'] },
  ELEMENTAL_SANCTUM: { key: 'ELEMENTAL_SANCTUM', name: '원소 성소', preferredSpecies: ['SLIME', 'IMP', 'ANGEL', 'TITAN'] },
  TROLL_CAVERN: { key: 'TROLL_CAVERN', name: '트롤 동굴', preferredSpecies: ['TROLL', 'OGRE', 'TITAN'] },
  BEAST_WARREN: { key: 'BEAST_WARREN', name: '야수 소굴', preferredSpecies: ['BAT', 'SLIME', 'GOBLIN'] }
};

/**
 * 몬스터 핏(Monster Pit) 전용 군집 테마 정의
 */
export const MONSTER_PIT_THEMES = [
  {
    key: 'ORC_PIT',
    name: '오크 & 고블린 소굴 (Orcish Nest)',
    minFloor: 3,
    leaderSpecies: 'ORC',
    followerSpecies: ['ORC', 'GOBLIN', 'OGRE'],
    packSizeRange: [4, 7],
    leaderSuffix: 'CHIEFTAIN',
    logMessage: '⚔️ 묵직한 군화 소리와 사나운 고함이 메아리칩니다! 수많은 오크와 고블린으로 들끓는 몬스터 소굴입니다!'
  },
  {
    key: 'UNDEAD_PIT',
    name: '망령의 무덤 (Undead Crypt)',
    minFloor: 4,
    leaderSpecies: 'HUMAN',
    followerSpecies: ['HUMAN', 'BAT', 'IMP'],
    packSizeRange: [4, 6],
    leaderSuffix: 'MAGE',
    logMessage: '💀 오한이 서린 냉기와 불길한 마력이 감돕니다! 원혼들과 망령들이 떼를 지어 몰려듭니다!'
  },
  {
    key: 'DRAGON_PIT',
    name: '화룡의 둥지 (Dragon Brood)',
    minFloor: 7,
    leaderSpecies: 'DRAGON',
    followerSpecies: ['HATCHLING', 'IMP'],
    packSizeRange: [3, 5],
    leaderSuffix: 'CHAMPION',
    logMessage: '🔥 뜨거운 열기와 유황 냄새가 진동합니다! 해츨링들과 거대한 화룡이 도사리는 용의 둥지입니다!'
  },
  {
    key: 'TROLL_PIT',
    name: '트롤 서식지 (Troll Cavern)',
    minFloor: 5,
    leaderSpecies: 'TROLL',
    followerSpecies: ['TROLL', 'OGRE'],
    packSizeRange: [3, 5],
    leaderSuffix: 'WARRIOR',
    logMessage: '🌿 바위마저 으스러뜨리는 거대한 트롤과 오우거 무리가 길목을 가로막고 있습니다!'
  },
  {
    key: 'DEMON_PIT',
    name: '심연의 차원문 (Abyssal Rift)',
    minFloor: 6,
    leaderSpecies: 'TITAN',
    followerSpecies: ['IMP', 'SLIME'],
    packSizeRange: [4, 6],
    leaderSuffix: 'PRIEST',
    logMessage: '🔮 붉은빛 마법진 주위로 사악한 마족과 임프들이 끊임없이 솟아나오고 있습니다!'
  },
  {
    key: 'ANIMAL_PIT',
    name: '동굴 박쥐 & 야수 군집 (Beast Swarm)',
    minFloor: 2,
    leaderSpecies: 'BAT',
    followerSpecies: ['BAT', 'SLIME'],
    packSizeRange: [5, 8],
    leaderSuffix: 'SHAMAN',
    logMessage: '🦇 천장을 가득 메운 과일박쥐 떼와 야수 군집이 사방에서 날아듭니다!'
  }
];

/**
 * 방 내부 또는 주변에서 벽/문/막힌 타일이 아닌 안전한 바닥(FLOOR) 좌표를 탐색하는 헬퍼 함수
 * @param {Object} map - 게임 맵 인스턴스
 * @param {number} preferredX - 선호 X 좌표
 * @param {number} preferredY - 선호 Y 좌표
 * @param {Object|null} room - 대상 방 객체 (옵션)
 * @param {Set<string>|null} occupiedSet - 이미 점유된 좌표 집합 (옵션)
 * @returns {{ x: number, y: number }}
 */
export function findSafeFloorPos(map, preferredX, preferredY, room = null, occupiedSet = null) {
  if (!map) return { x: preferredX, y: preferredY };

  const isSafe = (x, y) => {
    if (x < 1 || x >= map.width - 1 || y < 1 || y >= map.height - 1) return false;
    if (!map.isWalkable(x, y)) return false;
    const tile = map.getTile(x, y);
    if (!tile) return false;
    if (tile.char === '#' || tile.char === '+' || tile.type === 'WALL' || tile.type === 'VAULT_WALL' || tile.type === 'DOOR') {
      return false;
    }
    if (occupiedSet && occupiedSet.has(`${x},${y}`)) return false;
    return true;
  };

  // 1. 선호 좌표가 안전한 바닥이면 바로 사용
  if (isSafe(preferredX, preferredY)) {
    return { x: preferredX, y: preferredY };
  }

  // 2. 선호 좌표 주변 나선형 반경 탐색
  const maxRadius = room ? Math.max(room.w, room.h, 6) : 6;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = preferredX + dx;
        const ny = preferredY + dy;
        if (room) {
          if (nx <= room.x1 || nx >= room.x2 - 1 || ny <= room.y1 || ny >= room.y2 - 1) continue;
        }
        if (isSafe(nx, ny)) {
          return { x: nx, y: ny };
        }
      }
    }
  }

  // 3. 방 내부 전체 바닥 검사
  if (room) {
    for (let ry = room.y1 + 1; ry < room.y2 - 1; ry++) {
      for (let rx = room.x1 + 1; rx < room.x2 - 1; rx++) {
        if (isSafe(rx, ry)) {
          return { x: rx, y: ry };
        }
      }
    }
  }

  // 4. Fallback: 맵 전체에서 안전한 바닥 좌표 탐색
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (isSafe(x, y)) {
        return { x, y };
      }
    }
  }

  return { x: preferredX, y: preferredY };
}

export const SPECIAL_MONSTER_PACKS = [
  {
    name: "비전 의회 (Arcane Council)",
    weight: 25,
    minFloor: 6,
    allowedSpecies: ["IMP", "ANGEL", "HUMAN"],
    packSizeRange: [2, 4],
    setup: (leader, danger) => ({
      speciesOverride: leader.type,
      prefixRoll: () => [],
      suffixRoll: () => []
    }),
    logMessage: "🔮 방 주변 마력이 격렬히 공명합니다! 고위 마법사들로 구성된 '비전 의회' 무리를 마주했습니다!"
  },
  {
    name: "전쟁 선봉대 (War Vanguard)",
    weight: 35,
    minFloor: 6,
    allowedSpecies: ["ORC", "OGRE", "GOBLIN", "TITAN"],
    packSizeRange: [3, 4],
    setup: (leader, danger) => ({
      speciesOverride: leader.type,
      prefixRoll: () => [],
      suffixRoll: () => []
    }),
    logMessage: "⚔️ 절도 있고 묵직한 군화 소리가 통로를 타고 울립니다! '전쟁 선봉대'와 정예 지휘관이 기습해옵니다!"
  },
  {
    name: "원소 신전 사제단 (Elemental Temple)",
    weight: 20,
    minFloor: 6,
    allowedSpecies: ["SLIME", "IMP", "ANGEL", "HUMAN", "BAT"],
    packSizeRange: [3, 4],
    setup: (leader, danger) => ({
      speciesOverride: (idx, allowed) => allowed[idx % allowed.length],
      prefixRoll: () => [],
      suffixRoll: () => []
    }),
    logMessage: "🌿 대자연의 속삭임과 치유 아우라가 가득 찹니다! 원소 토템을 공유하는 다종족 '사제단 무리'가 가로막습니다!"
  },
  {
    name: "돌연변이 군집 (Mutant Swarm)",
    weight: 20,
    minFloor: 6,
    allowedSpecies: ["BAT", "SLIME", "GOBLIN"],
    packSizeRange: [3, 4],
    setup: (leader, danger) => ({
      speciesOverride: leader.type,
      prefixRoll: () => [],
      suffixRoll: () => []
    }),
    logMessage: "💀 기이하고 광폭한 울음소리가 동굴을 메웁니다! 치명적인 돌연변이 인자를 공유하는 '돌연변이 군집'입니다!"
  }
];

export class Spawner {
  static _cachedMonsters = Object.values(TOME_MONSTERS_DATA || {}).filter(m => !isJokeMonster(m));

  /**
   * 던전 층수(floor)에 맞는 던전 테마를 결정합니다.
   * @param {number} floor - 현재 층수
   * @returns {Object} DUNGEON_THEMES 또는 DungeonThemeConfig 엔트리
   */
  static determineFloorTheme(floor = 1) {
    return getThemeForFloor(floor);
  }

  /**
   * 층수(floor)와 위험도에 맞는 몬스터 종족을 851종 ToME 데이터셋에서 동적으로 선택합니다 (가우시안 OOD 10% 지원).
   * @param {number} floor - 현재 층수
   * @param {boolean} isBossRoom - 보스 여부
   * @param {string} [theme=null] - 테마 키
   * @returns {string} 종족 키
   */
  static rollMonsterSpecies(floor = 1, isBossRoom = false, theme = null) {
    const oodChance = DUNGEON_CUSTOM_SETTINGS?.gameplay?.oodRollChance ?? 0.10;
    const effectiveLevel = DungeonValueBudgetEngine.rollOutOfDepthLevel(floor, oodChance, 8);

    if (this._cachedMonsters && this._cachedMonsters.length > 0) {
      const isEligible = (m) => {
        if (!m) return false;
        if (isJokeMonster(m)) return false;
        const isUnique = m.flags && (m.flags.includes('UNIQUE') || m.flags.includes('UNIQUE_FRIEND') || m.isUnique === true);
        return !isUnique;
      };

      if (isBossRoom) {
        const highLevel = this._cachedMonsters.filter(m => {
          return isEligible(m) && m.level >= effectiveLevel + 1 && m.level <= effectiveLevel + 8;
        });
        if (highLevel.length > 0) {
          return highLevel[Math.floor(Math.random() * highLevel.length)].key;
        }
      }

      // 테마 우선 필터링 (유니크 몬스터 및 조크 몬스터는 일반 스폰 풀에서 철저히 배제)
      const minL = Math.max(1, effectiveLevel - 3);
      const maxL = effectiveLevel + 3;
      let candidates = this._cachedMonsters.filter(m => {
        return isEligible(m) && m.level >= minL && m.level <= maxL;
      });

      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)].key;
      }
    }

    const standardPool = ["SLIME", "BAT", "GOBLIN", "ORC", "HUMAN", "OGRE", "HATCHLING", "IMP", "TITAN", "ANGEL", "DRAGON"];
    return standardPool[Math.floor(Math.random() * standardPool.length)];
  }

  /**
   * 층수 위험도 기반 반지 생성
   * @param {number} x 
   * @param {number} y 
   * @param {number} danger 
   * @returns {Item}
   */
  static rollRing(x, y, danger = 1) {
    return TomeLootGenerator.generateFloorItem(x, y, danger, false);
  }

  /**
   * 층수 위험도 기반 목걸이 생성
   * @param {number} x 
   * @param {number} y 
   * @param {number} danger 
   * @returns {Item}
   */
  static rollAmulet(x, y, danger = 1) {
    return TomeLootGenerator.generateFloorItem(x, y, danger, false);
  }

  /**
   * 던전 층 내 모든 방에 몬스터와 아이템을 동적 배치합니다 (spawnFloorContent 호환 래퍼).
   * @param {Object} game - Game 핵심 인스턴스
   * @param {number} [floor=null] - 선택적 던전 층수
   */
  static spawnEntitiesForFloor(game, floor = null) {
    if (floor !== null && game) game.floor = floor;
    if (game) {
      game.items = [];
      game.monsters = [];
    }
    return this.spawnFloorContent(game);
  }

  /**
   * 던전 층 내 모든 방(Room)에 ToME 2.3.5 기반 유니크 몬스터, Vault/Pit 전용 스폰, 테마별 몬스터와 아이템을 동적 배치합니다.
   * @param {Object} game - Game 핵심 인스턴스
   */
  static spawnFloorContent(game) {
    if (!game.map || !game.map.rooms || game.map.rooms.length === 0) return;

    const umm = game.uniqueMonsterManager || uniqueMonsterManager;
    const floorTheme = Spawner.determineFloorTheme(game.floor);
    let uniqueSpawnedThisFloor = false;
    const isMonsterPresent = (x, y) => (typeof game.isMonsterAt === 'function' ? game.isMonsterAt(x, y) : (game.monsters ? game.monsters.some(m => m.x === x && m.y === y) : false));

    // 층당 1회 통합 검증으로 일반 방 유니크 스폰 통제 (보스방이 없을 시 20% 확률로 1개 방 선정)
    let floorUniqueTargetRoomIndex = -1;
    const hasBossRoom = game.map.rooms.some(r => r.type === 'BOSS');
    if (!hasBossRoom && Math.random() < 0.20) {
      const normalRoomIndices = [];
      for (let i = 1; i < game.map.rooms.length; i++) {
        if (game.map.rooms[i].type === 'NORMAL') {
          normalRoomIndices.push(i);
        }
      }
      if (normalRoomIndices.length > 0) {
        floorUniqueTargetRoomIndex = normalRoomIndices[Math.floor(Math.random() * normalRoomIndices.length)];
      }
    }

    // 1. 시작 방 광원 보장 (플레이어에게 광원이 없을 때)
    if (game.player && !game.player.equippedLamp && (!game.player.inventory || !game.player.inventory.some(e => e.type === 'LAMP'))) {
      const startRoom = game.map.rooms[0];
      const sc = startRoom.center;
      if (!game.items) game.items = [];
      game.items.push(new Item(sc.x, sc.y, 'LAMP', '~', '#fbbf24', '횃불', 1, 'LIGHT', {}, null, null, [], [], [], "주변을 밝혀주는 기본적인 횃불입니다."));
    }

    const occupiedPositions = new Set();
    if (game.player) {
      occupiedPositions.add(`${game.player.x},${game.player.y}`);
    }
    if (game.map?.stairs) {
      occupiedPositions.add(`${game.map.stairs.x},${game.map.stairs.y}`);
    }

    // 2. 각 방별 몬스터 및 전리품 동적 생성
    for (let i = 1; i < game.map.rooms.length; i++) {
      const room = game.map.rooms[i];
      const center = room.center;
      const isLastRoom = i === game.map.rooms.length - 1;

      // ----------------------------------------------------
      // A. 보스 룸 (BOSS) 스폰
      // ----------------------------------------------------
      if (room.type === 'BOSS') {
        let bossMonster = null;
        const bPos = findSafeFloorPos(game.map, center.x, center.y, room, occupiedPositions);
        occupiedPositions.add(`${bPos.x},${bPos.y}`);

        // 0) 50F 모르고스의 옥좌 최종 보스 확정 스폰
        if (game.floor >= 50) {
          const morgothData = umm.getUniqueMonsterByKey('MON_MORGOTH_LORD_OF_DARKNESS') || TOME_MONSTERS_DATA['MON_MORGOTH_LORD_OF_DARKNESS'];
          if (morgothData) {
            bossMonster = umm.createUniqueMonsterInstance(bPos.x, bPos.y, morgothData, 100);
            if (bossMonster) {
              bossPhaseEngine.initBossEncounter(bossMonster, game);
              uniqueSpawnedThisFloor = true;
            }
          }
        }

        if (!bossMonster) {
          // 1) 층수에 맞는 유니크 몬스터 롤링 시도 (1회성 스폰 보장)
          const uniqueData = umm.rollUniqueMonster(game.floor + 1, {
            minLevelOffset: -2,
            maxLevelOffset: 8,
            autoMarkSpawned: true
          });

          if (uniqueData) {
            bossMonster = umm.createUniqueMonsterInstance(bPos.x, bPos.y, uniqueData, game.floor + 2);
            uniqueSpawnedThisFloor = true;
          } else {
            // 2) 폴백 종족 보스 스폰 (레거시 접사 전면 배제)
            const bossSpecies = Spawner.rollMonsterSpecies(game.floor, true);
            const bossLevel = game.floor + 2;

            bossMonster = new Monster(bPos.x, bPos.y, bossSpecies, bossLevel, [], []);
            bossMonster.stats.hp = clampMonsterHp(Math.floor(bossMonster.stats.hp * 1.35), bossLevel);
            bossMonster.stats.maxHp = bossMonster.stats.hp;
            bossMonster.xpValue *= 3;

            // 보스 고유 칭호 부여
            if (bossSpecies === 'ORC') bossMonster._baseName = '오크 군단장';
            else if (bossSpecies === 'OGRE') bossMonster._baseName = '진흙 골짜기 오우거 추장';
            else if (bossSpecies === 'DRAGON') bossMonster._baseName = '고대의 성체 대룡';
            else if (bossSpecies === 'TITAN') bossMonster._baseName = '혹한의 타이탄 군주';
            else if (bossSpecies === 'ANGEL') bossMonster._baseName = '심판의 대천사';
          }
        }

        if (bossMonster) {
          if (!game.monsters) game.monsters = [];
          game.monsters.push(bossMonster);

          setTimeout(() => {
            if (typeof game.addLogEntry === 'function') {
              game.addLogEntry(`🚨 [WARNING] 보스 [${bossMonster.displayName}](Lv.${bossMonster.level})이 출현했습니다! 물리치고 특별한 정수 코어와 유니크 장비를 쟁취하세요!`, 'combat');
            }
          }, 1000);
        }

        // 보스룸 특별 전리품 배치 (전설 유물 / 에고 무기) - 안전 바닥 탐색 보장
        if (!game.items) game.items = [];
        const bItem1Pos = findSafeFloorPos(game.map, center.x + 1, center.y, room, occupiedPositions);
        occupiedPositions.add(`${bItem1Pos.x},${bItem1Pos.y}`);
        const bossItem = TomeLootGenerator.generateFloorItem(bItem1Pos.x, bItem1Pos.y, game.floor, true);
        game.items.push(bossItem);

        // 보스 격파 보상 특급 전리품 절차적 생성 배치 - 안전 바닥 탐색 보장
        const bItem2Pos = findSafeFloorPos(game.map, center.x - 1, center.y, room, occupiedPositions);
        occupiedPositions.add(`${bItem2Pos.x},${bItem2Pos.y}`);
        game.items.push(TomeLootGenerator.generateFloorItem(bItem2Pos.x, bItem2Pos.y, game.floor + 1, true));

      // ----------------------------------------------------
      // B. 비밀 보물 금고 룸 (TREASURE_VAULT) 스폰
      // ----------------------------------------------------
      } else if (room.type === 'TREASURE_VAULT') {
        if (!game.items) game.items = [];
        if (!game.monsters) game.monsters = [];

        // 1) 보물 금고 특급 전리품 1~2개 배치 - 안전 바닥 탐색 100% 보장
        const vPos1 = findSafeFloorPos(game.map, center.x, center.y, room, occupiedPositions);
        occupiedPositions.add(`${vPos1.x},${vPos1.y}`);
        const vaultItem1 = TomeLootGenerator.generateFloorItem(vPos1.x, vPos1.y, game.floor + 3, true);
        game.items.push(vaultItem1);

        if (Math.random() < 0.65) {
          const vPos2 = findSafeFloorPos(game.map, center.x + 1, center.y, room, occupiedPositions);
          occupiedPositions.add(`${vPos2.x},${vPos2.y}`);
          const vaultItem2 = TomeLootGenerator.generateFloorItem(vPos2.x, vPos2.y, game.floor + 2, true);
          game.items.push(vaultItem2);
        }

        // 보물 금고 추가 마법 전리품 절차적 생성 배치 - 안전 바닥 탐색 100% 보장
        const vPos3 = findSafeFloorPos(game.map, center.x, center.y - 1, room, occupiedPositions);
        occupiedPositions.add(`${vPos3.x},${vPos3.y}`);
        game.items.push(TomeLootGenerator.generateFloorItem(vPos3.x, vPos3.y, game.floor + 2, true));

        // 2) 금고 수호자 스폰 (35% 확률로 유니크 수호자, 아니면 BudgetEngine 정예) - 안전 바닥 및 레거시 접사 제거
        const gPos = findSafeFloorPos(game.map, center.x - 1, center.y, room, occupiedPositions);
        occupiedPositions.add(`${gPos.x},${gPos.y}`);

        let guardMonster = null;
        if (!uniqueSpawnedThisFloor && Math.random() < 0.35) {
          const uniqueData = umm.rollUniqueMonster(game.floor + 1, {
            minLevelOffset: -1,
            maxLevelOffset: 5,
            autoMarkSpawned: true
          });
          if (uniqueData) {
            guardMonster = umm.createUniqueMonsterInstance(gPos.x, gPos.y, uniqueData, game.floor + 1);
            uniqueSpawnedThisFloor = true;
          }
        }

        if (!guardMonster) {
          const guardSpecies = Spawner.rollMonsterSpecies(game.floor + 1, false);
          guardMonster = new Monster(gPos.x, gPos.y, guardSpecies, game.floor + 2, [], []);
          guardMonster.stats.hp = clampMonsterHp(Math.floor(guardMonster.stats.hp * 1.3), game.floor + 2);
          guardMonster.stats.maxHp = guardMonster.stats.hp;
        }

        if (guardMonster) {
          game.monsters.push(guardMonster);
        }

        setTimeout(() => {
          if (typeof game.addLogEntry === 'function') {
            game.addLogEntry(`🛡️ [보물 금고] 신비한 기운이 감도는 비밀 금고에 도달했습니다! 수호자 [${guardMonster.displayName}]이(가) 보물을 지키고 있습니다.`, 'loot');
          }
        }, 1200);

      // ----------------------------------------------------
      // C. 몬스터 핏 (MONSTER_PIT) 스폰 (Map 생성기에서 결정된 특수방만)
      // ----------------------------------------------------
      } else if (room.type === 'MONSTER_PIT') {
        if (!game.items) game.items = [];
        if (!game.monsters) game.monsters = [];

        // 1) 적합한 Monster Pit 테마 선택
        const eligiblePits = MONSTER_PIT_THEMES.filter(p => game.floor >= p.minFloor);
        const chosenPit = eligiblePits.length > 0 ? eligiblePits[Math.floor(Math.random() * eligiblePits.length)] : MONSTER_PIT_THEMES[0];

        // 2) Pit 우두머리 스폰 - 안전 바닥 탐색 및 레거시 접사 제거
        const leaderLevel = Math.max(1, game.floor + 1);
        const lPos = findSafeFloorPos(game.map, center.x, center.y, room, occupiedPositions);
        occupiedPositions.add(`${lPos.x},${lPos.y}`);

        const leaderMonster = new Monster(lPos.x, lPos.y, chosenPit.leaderSpecies, leaderLevel, [], []);
        game.monsters.push(leaderMonster);

        // 3) 군집 몬스터 스폰 (4~7마리 격자 배치) - 안전 바닥 탐색 및 레거시 접사 제거
        const packSize = Math.floor(Math.random() * (chosenPit.packSizeRange[1] - chosenPit.packSizeRange[0] + 1)) + chosenPit.packSizeRange[0];
        let spawnedCount = 1;

        for (let dx = -2; dx <= 2 && spawnedCount < packSize; dx++) {
          for (let dy = -2; dy <= 2 && spawnedCount < packSize; dy++) {
            if (dx === 0 && dy === 0) continue;
            const fPos = findSafeFloorPos(game.map, center.x + dx, center.y + dy, room, occupiedPositions);

            if (!isMonsterPresent(fPos.x, fPos.y) && !(game.player && fPos.x === game.player.x && fPos.y === game.player.y)) {
              occupiedPositions.add(`${fPos.x},${fPos.y}`);
              const followerSpecies = chosenPit.followerSpecies[spawnedCount % chosenPit.followerSpecies.length];
              const fLevel = Math.max(1, game.floor + (Math.random() > 0.5 ? 0 : -1));
              game.monsters.push(new Monster(fPos.x, fPos.y, followerSpecies, fLevel, [], []));
              spawnedCount++;
            }
          }
        }

        // 4) Pit 보물 상자 전리품 배치 - 안전 바닥 탐색 보장
        const pTreasurePos = findSafeFloorPos(game.map, center.x + 1, center.y, room, occupiedPositions);
        occupiedPositions.add(`${pTreasurePos.x},${pTreasurePos.y}`);
        const pitTreasure = TomeLootGenerator.generateFloorItem(pTreasurePos.x, pTreasurePos.y, game.floor + 1, true);
        game.items.push(pitTreasure);

        setTimeout(() => {
          if (typeof game.addLogEntry === 'function') {
            game.addLogEntry(`💀 [${chosenPit.name}] ${chosenPit.logMessage}`, 'combat');
          }
        }, 1000);

      // ----------------------------------------------------
      // D. 일반 방 (NORMAL) 스폰
      // ----------------------------------------------------
      } else {
        if (!game.items) game.items = [];
        if (!game.monsters) game.monsters = [];

        // 1) 일반 방 아이템 스폰 - 안전 바닥 탐색 보장
        const itemChance = game.floor <= 3 ? 0.70 : 0.45;
        if (Math.random() < itemChance) {
          const itemPos = findSafeFloorPos(game.map, center.x, center.y, room, occupiedPositions);
          occupiedPositions.add(`${itemPos.x},${itemPos.y}`);
          const floorItem = TomeLootGenerator.generateFloorItem(itemPos.x, itemPos.y, game.floor, false);
          game.items.push(floorItem);
        }

        // 저층(1~3층) 탐험 지원 물약 추가 롤링 - 안전 바닥 탐색 보장
        if (game.floor <= 3 && Math.random() < 0.50) {
          const potionCandX = center.x + (Math.random() > 0.5 ? 1 : -1);
          const potionCandY = center.y + (Math.random() > 0.5 ? 1 : -1);
          const potionPos = findSafeFloorPos(game.map, potionCandX, potionCandY, room, occupiedPositions);
          occupiedPositions.add(`${potionPos.x},${potionPos.y}`);
          const supPotion = TomeLootGenerator.generateFloorItem(potionPos.x, potionPos.y, game.floor, false);
          game.items.push(supPotion);
        }

        // 2) 일반 방 유니크 / 일반 몬스터 기습 등장 판정 - 안전 바닥 탐색 및 레거시 접사 제거
        const mCandX = center.x + (Math.random() > 0.5 ? 1 : -1);
        const mCandY = center.y + (Math.random() > 0.5 ? 1 : -1);
        const mPos = findSafeFloorPos(game.map, mCandX, mCandY, room, occupiedPositions);

        if (!isMonsterPresent(mPos.x, mPos.y) && !(game.player && mPos.x === game.player.x && mPos.y === game.player.y)) {
          occupiedPositions.add(`${mPos.x},${mPos.y}`);
          let uniqueMonster = null;
          if (!uniqueSpawnedThisFloor && i === floorUniqueTargetRoomIndex) {
            const uniqueData = umm.rollUniqueMonster(game.floor, {
              minLevelOffset: -3,
              maxLevelOffset: 3,
              autoMarkSpawned: true
            });
            if (uniqueData) {
              uniqueMonster = umm.createUniqueMonsterInstance(mPos.x, mPos.y, uniqueData, game.floor);
              uniqueSpawnedThisFloor = true;
            }
          }

          if (uniqueMonster) {
            game.monsters.push(uniqueMonster);
            setTimeout(() => {
              if (typeof game.addLogEntry === 'function') {
                game.addLogEntry(`👑 [유니크 출현] 전설의 유니크 몬스터 [${uniqueMonster.displayName}](Lv.${uniqueMonster.level})이(가) 통로에 모습을 드러냈습니다!`, 'combat');
              }
            }, 1000);
          } else {
            // 3) 일반 몬스터 및 특수 무리(Special Monster Pack) 스폰 (레거시 접사 제거)
            const species = Spawner.rollMonsterSpecies(game.floor, false, floorTheme.id || floorTheme.key);
            const monsterLevel = Math.max(1, game.floor + Math.floor(Math.random() * 3) - 1);

            const isPack = game.floor >= 6 && Math.random() < 0.35;
            let specialPack = null;

            if (isPack && Math.random() < 0.40) {
              const eligiblePacks = SPECIAL_MONSTER_PACKS.filter(p => game.floor >= p.minFloor && p.allowedSpecies.includes(species));
              if (eligiblePacks.length > 0) {
                const totalW = eligiblePacks.reduce((sum, p) => sum + p.weight, 0);
                let wRoll = Math.random() * totalW;
                for (const p of eligiblePacks) {
                  wRoll -= p.weight;
                  if (wRoll <= 0) {
                    specialPack = p;
                    break;
                  }
                }
              }
            }

            if (specialPack) {
              const packRules = specialPack.setup({ type: species }, game.floorDanger);
              const packSize = Math.floor(Math.random() * (specialPack.packSizeRange[1] - specialPack.packSizeRange[0] + 1)) + specialPack.packSizeRange[0];
              
              let leaderSpecies = species;
              if (typeof packRules.speciesOverride === "function") {
                leaderSpecies = packRules.speciesOverride(0, specialPack.allowedSpecies);
              } else if (packRules.speciesOverride) {
                leaderSpecies = packRules.speciesOverride;
              }

              const leaderMonster = new Monster(mPos.x, mPos.y, leaderSpecies, monsterLevel, [], []);
              game.monsters.push(leaderMonster);

              let spawnedCount = 1;
              for (let dx = -2; dx <= 2 && spawnedCount < packSize; dx++) {
                for (let dy = -2; dy <= 2 && spawnedCount < packSize; dy++) {
                  if (dx === 0 && dy === 0) continue;
                  const compPos = findSafeFloorPos(game.map, mPos.x + dx, mPos.y + dy, room, occupiedPositions);

                  if (!isMonsterPresent(compPos.x, compPos.y) && !(game.player && compPos.x === game.player.x && compPos.y === game.player.y)) {
                    occupiedPositions.add(`${compPos.x},${compPos.y}`);
                    let compSpecies = species;
                    if (typeof packRules.speciesOverride === "function") {
                      compSpecies = packRules.speciesOverride(spawnedCount, specialPack.allowedSpecies);
                    } else if (packRules.speciesOverride) {
                      compSpecies = packRules.speciesOverride;
                    }

                    const compLevel = Math.max(1, monsterLevel + Math.floor(Math.random() * 3) - 1);
                    game.monsters.push(new Monster(compPos.x, compPos.y, compSpecies, compLevel, [], []));
                    spawnedCount++;
                  }
                }
              }

              setTimeout(() => {
                if (typeof game.addLogEntry === 'function') {
                  game.addLogEntry(`✨ <b>${specialPack.name} 출현!</b> ${specialPack.logMessage}`, 'combat');
                }
              }, 800);

            } else {
              // 일반 단일 스폰 또는 일반 무리 스폰 (레거시 접사 전면 배제)
              game.monsters.push(new Monster(mPos.x, mPos.y, species, monsterLevel, [], []));

              if (isPack) {
                const packSize = Math.floor(Math.random() * 3) + 2; // 2 ~ 4마리
                let spawnedCount = 1;

                for (let dx = -2; dx <= 2 && spawnedCount < packSize; dx++) {
                  for (let dy = -2; dy <= 2 && spawnedCount < packSize; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const compPos = findSafeFloorPos(game.map, mPos.x + dx, mPos.y + dy, room, occupiedPositions);

                    if (!isMonsterPresent(compPos.x, compPos.y) && !(game.player && compPos.x === game.player.x && compPos.y === game.player.y)) {
                      occupiedPositions.add(`${compPos.x},${compPos.y}`);
                      const compLevel = Math.max(1, monsterLevel + Math.floor(Math.random() * 3) - 1);
                      game.monsters.push(new Monster(compPos.x, compPos.y, species, compLevel, [], []));
                      spawnedCount++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 소환 타입(summonType) 및 던전 층수에 맞춰 적합한 ToME 851종 몬스터 종족 키를 반환합니다.
   * @param {string} summonType
  static _summonPools = null;

  /**
   * 소환 타입별 적격 몬스터 후보 풀을 캐싱하여 반환합니다.
   * @private
   */
  static _getSummonPool(sType) {
    if (!this._summonPools) {
      this._summonPools = {};
    }
    if (this._summonPools[sType]) {
      return this._summonPools[sType];
    }

    const allM = this._cachedMonsters || Object.values(TOME_MONSTERS_DATA || {});
    const isEligible = (m) => {
      if (!m) return false;
      if (isJokeMonster(m)) return false;
      const isUnique = m.flags && (m.flags.includes('UNIQUE') || m.flags.includes('UNIQUE_FRIEND') || m.isUnique === true);
      return !isUnique;
    };

    let candidates = [];
    switch (sType) {
      case 'ANIMAL':
      case 'ANIMALS':
        candidates = allM.filter(m => isEligible(m) && ((m.flags && m.flags.includes('ANIMAL')) || /\b(?:bat|snake|wolf|bear|dog|cat|bird|jackal|rat)\b/i.test(m.name || '')));
        break;
      case 'ANT':
        candidates = allM.filter(m => isEligible(m) && (/(?:^|_)(?:ANT|ANTS)(?:_|$)/i.test(m.key || '') || /\bants?\b/i.test(m.name || '')));
        break;
      case 'SPIDER':
        candidates = allM.filter(m => isEligible(m) && (/(?:^|_)(?:SPIDER|SPIDERS)(?:_|$)/i.test(m.key || '') || /\bspiders?\b/i.test(m.name || '')));
        break;
      case 'HOUND':
        candidates = allM.filter(m => isEligible(m) && (/(?:^|_)(?:HOUND|HOUNDS)(?:_|$)/i.test(m.key || '') || /\bhounds?\b/i.test(m.name || '')));
        break;
      case 'HYDRA':
        candidates = allM.filter(m => isEligible(m) && (/(?:^|_)(?:HYDRA|HYDRAS)(?:_|$)/i.test(m.key || '') || /\bhydras?\b/i.test(m.name || '')));
        break;
      case 'ANGEL':
        candidates = allM.filter(m => isEligible(m) && ((m.flags && m.flags.includes('ANGEL')) || /\bangels?\b/i.test(m.name || '') || /\barchangel\b/i.test(m.name || '')));
        break;
      case 'DEMON':
        candidates = allM.filter(m => isEligible(m) && ((m.flags && m.flags.includes('DEMON')) || /\b(?:demon|imp|balrog|devil)\b/i.test(m.name || '')));
        break;
      case 'HI_DEMON':
        candidates = allM.filter(m => isEligible(m) && (m.flags && m.flags.includes('DEMON')) && (m.level || 1) >= 20);
        break;
      case 'UNDEAD':
        candidates = allM.filter(m => isEligible(m) && ((m.flags && m.flags.includes('UNDEAD')) || /\b(?:skeleton|zombie|vampire|ghoul|ghost|spectre|wight|lich)\b/i.test(m.name || '')));
        break;
      case 'HI_UNDEAD':
        candidates = allM.filter(m => isEligible(m) && (m.flags && m.flags.includes('UNDEAD')) && (m.level || 1) >= 20);
        break;
      case 'DRAGON':
        candidates = allM.filter(m => isEligible(m) && ((m.flags && m.flags.includes('DRAGON')) || /\b(?:dragon|drake|wyrm)\b/i.test(m.name || '')));
        break;
      case 'HI_DRAGON':
        candidates = allM.filter(m => isEligible(m) && (m.flags && m.flags.includes('DRAGON')) && (m.level || 1) >= 20);
        break;
      case 'WRAITH':
        candidates = allM.filter(m => isEligible(m) && /\b(?:wraith|ghost|spectre|shadow|shade)\b/i.test(m.name || ''));
        break;
      case 'CYBERDEMON':
        candidates = allM.filter(m => isEligible(m) && (/(?:^|_)(?:CYBER|TITAN)(?:_|$)/i.test(m.key || '') || /\b(?:cyberdemon|titan)\b/i.test(m.name || '')));
        break;
      case 'THUNDERLORD':
        candidates = allM.filter(m => isEligible(m) && ((m.flags && m.flags.includes('THUNDERLORD')) || /\bthunderlord\b/i.test(m.name || '')));
        break;
      case 'BUG':
        candidates = allM.filter(m => isEligible(m) && /\b(?:bug|beetle|flea|centipede|insect)\b/i.test(m.name || ''));
        break;
      default:
        candidates = null;
        break;
    }

    this._summonPools[sType] = candidates;
    return candidates;
  }

  /**
   * 소환 타입(summonType)에 맞는 몬스터 종족 키를 롤링합니다.
   * @param {string} [summonType='MONSTER'] - 소환 분류 (ANIMAL, DEMON, UNDEAD, DRAGON, CYBERDEMON 등)
   * @param {number} [floor=1]
   * @returns {string}
   */
  static resolveSummonSpecies(summonType = 'MONSTER', floor = 1) {
    const sType = String(summonType || 'MONSTER').toUpperCase();
    if (sType === 'MONSTER' || sType === 'MONSTERS') {
      return Spawner.rollMonsterSpecies(floor, false);
    }

    const candidates = this._getSummonPool(sType);
    if (candidates && candidates.length > 0) {
      const levelMatched = candidates.filter(c => Math.abs((c.level || 1) - floor) <= 6);
      const pool = levelMatched.length > 0 ? levelMatched : candidates;
      return pool[Math.floor(Math.random() * pool.length)].key;
    }

    return Spawner.rollMonsterSpecies(floor, false);
  }

  /**
   * 지정 좌표(x, y) 주변 반경의 워커블 타일에 몬스터 군집을 소환하고 게임 엔티티 풀에 등록합니다.
   * @param {Object} game
   * @param {number} x
   * @param {number} y
   * @param {string} [summonType='MONSTER']
   * @param {number} [count=1]
   * @param {Object} [caster=null]
   * @returns {Monster[]}
   */
  static spawnMonsterAround(game, x, y, summonType = 'MONSTER', count = 1, caster = null) {
    if (!game) return [];
    const floor = (game && game.floor) ? game.floor : 1;
    const map = game.map;
    const isMonsterPresent = (tx, ty) => {
      if (typeof game.isMonsterAt === 'function') return game.isMonsterAt(tx, ty);
      const list = game.monsters || (game.dungeon && game.dungeon.monsters) || [];
      return list.some(m => m && m.x === tx && m.y === ty && m.stats && m.stats.hp > 0);
    };
    const isPlayerPresent = (tx, ty) => {
      return game.player && game.player.x === tx && game.player.y === ty;
    };

    const spawned = [];
    const targetCount = Math.max(1, count);

    const validTiles = [];
    for (let r = 1; r <= 4; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (map) {
            if (map.isWalkable && !map.isWalkable(tx, ty)) continue;
          }
          if (isMonsterPresent(tx, ty) || isPlayerPresent(tx, ty)) continue;
          validTiles.push({ x: tx, y: ty });
        }
      }
    }

    const umm = game.uniqueMonsterManager || uniqueMonsterManager;

    for (let i = 0; i < targetCount && i < validTiles.length; i++) {
      const tile = validTiles[i];
      let monsterInstance = null;

      if (summonType === 'UNIQUE') {
        const uData = umm.rollUniqueMonster(floor + 2, { minLevelOffset: -1, maxLevelOffset: 6, autoMarkSpawned: true });
        if (uData) {
          monsterInstance = umm.createUniqueMonsterInstance(tile.x, tile.y, uData, floor + 2);
        }
      }

      if (!monsterInstance) {
        let species = null;
        if (summonType === 'KIN' && caster) {
          species = caster.tomeKey || caster.type || caster.species || 'GOBLIN';
        } else {
          species = this.resolveSummonSpecies(summonType, floor);
        }

        const mLevel = Math.max(1, floor + (String(summonType).startsWith('HI_') ? 3 : 0));
        monsterInstance = new Monster(tile.x, tile.y, species, mLevel);
      }

      if (monsterInstance) {
        if (!game.monsters) game.monsters = [];
        game.monsters.push(monsterInstance);
        if (game.dungeon && game.dungeon.monsters && !game.dungeon.monsters.includes(monsterInstance)) {
          game.dungeon.monsters.push(monsterInstance);
        }
        spawned.push(monsterInstance);
      }
    }

    return spawned;
  }
}
