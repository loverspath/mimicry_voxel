/**
 * @module UniqueMonsterManager
 * @category systems
 * @description ToME 2.3.5 정통 168종 유니크 몬스터 1회성 스폰 생태계 제어, 전설 유물 및 특급 에고 확정 드랍 파이프라인 엔진
 * @purity State Store / Logic System
 * @dependencies TomeMonstersData.js, TomeArtifactsData.js, TomeEgosData.js, Item.js, Monster.js, Tags.js, EventBus.js
 * @exports UniqueMonsterManager, uniqueMonsterManager
 */

import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { TOME_ARTIFACTS_DATA } from '../entities/TomeArtifactsData.js';
import { TOME_EGOS_DATA } from '../entities/TomeEgosData.js';
import { Item } from '../entities/Item.js';
import { Monster } from '../entities/Monster.js';
import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';
import { isJokeMonster } from '../configs/GameBalanceConfig.js';
import { clampMonsterHp } from './DungeonValueBudgetEngine.js';
import { TomeLootGenerator } from './TomeLootGenerator.js';

/**
 * @deprecated [LEGACY_DUMMY_ITEMS]
 * 하드코딩된 구형 더미 아이템 명칭 레코드 (인게임 실제 드랍 파이프라인에서 완전 퇴출 및 격리됨)
 * ToME/TomeNET 정통 드랍 플래그/테이블(DROP_2D2, DROP_GREAT 등) 기반 절차적 엔진으로 전면 교체.
 */
export const LEGACY_DUMMY_ITEMS = Object.freeze([
  '축복받은 기사의 명검',
  '발리노르의 신성한 명검',
  '발리노르의 무기 대강화 주문서',
  '영구 전능 성장 영약'
]);

export class UniqueMonsterManager {
  /**
   * 유니크 몬스터 관리자 인스턴스를 생성합니다.
   */
  constructor() {
    /** @type {Set<string>} 현재 세션에서 이미 스폰된 유니크 몬스터 키 목록 */
    this.spawned = new Set();
    /** @type {Set<string>} 현재 세션에서 플레이어에게 처치된 유니크 몬스터 키 목록 */
    this.killed = new Set();
    /** @type {Set<string>} 이미 드랍된 전설 유물 키 목록 (중복 유물 방지) */
    this.droppedArtifacts = new Set();

    // ToME 2.3.5 데이터셋 사전 인덱싱
    this._uniqueMonsterList = [];
    this._uniqueMonsterMap = new Map();
    this._artifactList = [];
    this._egoList = [];

    this._initializeDatasets();
  }

  /**
   * ToME 원본 데이터셋으로부터 유니크 몬스터, 전설 유물, 에고 데이터를 파싱하고 레벨 순으로 정렬/캐싱합니다.
   * @private
   */
  _initializeDatasets() {
    // 1. 유니크 몬스터 인덱싱 (flags에 'UNIQUE'가 포함된 몬스터들)
    if (TOME_MONSTERS_DATA) {
      const allMonsters = Object.values(TOME_MONSTERS_DATA);
      for (const m of allMonsters) {
        if (m && m.flags && (m.flags.includes('UNIQUE') || m.flags.includes('UNIQUE_FRIEND') || m.isUnique === true)) {
          this._uniqueMonsterList.push(m);
          this._uniqueMonsterMap.set(m.key, m);
          if (m.name) {
            this._uniqueMonsterMap.set(m.name, m);
          }
        }
      }
      this._uniqueMonsterList.sort((a, b) => (a.level || 1) - (b.level || 1));
    }

    // 2. 전설 유물(Artifacts) 인덱싱
    if (TOME_ARTIFACTS_DATA) {
      this._artifactList = Object.values(TOME_ARTIFACTS_DATA);
      this._artifactList.sort((a, b) => (a.level || 1) - (b.level || 1));
    }

    // 3. 에고 접사 인덱싱
    if (TOME_EGOS_DATA) {
      this._egoList = Object.values(TOME_EGOS_DATA);
    }
  }

  /**
   * 전체 유니크 몬스터 목록을 반환합니다.
   * @returns {Array<Object>}
   */
  getAllUniqueMonsters() {
    return [...this._uniqueMonsterList];
  }

  /**
   * 키 또는 이름으로 유니크 몬스터 메타데이터를 조회합니다.
   * @param {string} keyOrName 
   * @returns {Object|null}
   */
  getUniqueMonsterByKey(keyOrName) {
    if (!keyOrName) return null;
    return this._uniqueMonsterMap.get(keyOrName) || null;
  }

  /**
   * 주어진 몬스터 객체 또는 키가 유니크 몬스터인지 판별합니다.
   * @param {Object|string} monsterOrKey 
   * @returns {boolean}
   */
  isUnique(monsterOrKey) {
    if (!monsterOrKey) return false;
    if (typeof monsterOrKey === 'string') {
      if (this._uniqueMonsterMap.has(monsterOrKey)) return true;
      const monData = TOME_MONSTERS_DATA[monsterOrKey];
      return Boolean(monData && monData.flags && monData.flags.includes('UNIQUE'));
    }
    if (typeof monsterOrKey === 'object') {
      if (monsterOrKey.isUnique) return true;
      if (monsterOrKey.type && this._uniqueMonsterMap.has(monsterOrKey.type)) return true;
      if (monsterOrKey.uniqueKey && this._uniqueMonsterMap.has(monsterOrKey.uniqueKey)) return true;
      if (monsterOrKey.flags && monsterOrKey.flags.includes('UNIQUE')) return true;
      if (monsterOrKey.perks && monsterOrKey.perks.includes('UNIQUE')) return true;
    }
    return false;
  }

  /**
   * 특정 유니크 몬스터가 현재 스폰 가능한 상태인지 확인합니다. (스폰 이력 및 처치 이력이 없어야 함)
   * @param {string} key 
   * @returns {boolean}
   */
  canSpawn(key) {
    if (!key) return false;
    const uData = this.getUniqueMonsterByKey(key) || TOME_MONSTERS_DATA[key];
    if (isJokeMonster(uData)) return false;
    if (!this.isUnique(key)) return false;
    return !this.spawned.has(key) && !this.killed.has(key);
  }

  /**
   * 유니크 몬스터를 스폰된 것으로 기록합니다.
   * @param {string} key 
   */
  markSpawned(key) {
    if (!key) return;
    this.spawned.add(key);
    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit(GameEvents.UNIQUE_MONSTER_SPAWNED || 'UNIQUE_MONSTER_SPAWNED', { key });
    }
  }

  /**
   * 유니크 몬스터를 처치된 것으로 기록합니다.
   * @param {string} key 
   */
  markKilled(key) {
    if (!key) return;
    this.killed.add(key);
    this.spawned.add(key); // 처치되었으면 당연히 스폰된 상태임
    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit(GameEvents.UNIQUE_MONSTER_KILLED || 'UNIQUE_MONSTER_KILLED', { key });
    }
  }

  /**
   * 유니크 몬스터의 스폰 여부를 확인합니다.
   * @param {string} key 
   * @returns {boolean}
   */
  isSpawned(key) {
    return this.spawned.has(key);
  }

  /**
   * 유니크 몬스터의 처치 여부를 확인합니다.
   * @param {string} key 
   * @returns {boolean}
   */
  isKilled(key) {
    return this.killed.has(key);
  }

  /**
   * 유니크 몬스터가 스폰되었으나 아직 처치되지 않고 생존해 있는지 확인합니다.
   * @param {string} key 
   * @returns {boolean}
   */
  isAlive(key) {
    return this.spawned.has(key) && !this.killed.has(key);
  }

  /**
   * 층수(floor)와 조건에 맞는 스폰 가능한 유니크 몬스터 후보 목록을 필터링합니다.
   * @param {number} floor - 현재 던전 층수
   * @param {Object} [options={}] - 필터링 옵션
   * @param {number} [options.minLevelOffset=-4] - 최소 레벨 오프셋
   * @param {number} [options.maxLevelOffset=5] - 최대 레벨 오프셋
   * @param {string} [options.theme=null] - 테마 필터 (선택 사항)
   * @returns {Array<Object>}
   */
  getAvailableUniqueMonsters(floor = 1, options = {}) {
    const minOffset = typeof options.minLevelOffset === 'number' ? options.minLevelOffset : -4;
    const maxOffset = typeof options.maxLevelOffset === 'number' ? options.maxLevelOffset : 5;
    
    const minLevel = Math.max(1, floor + minOffset);
    const maxLevel = Math.max(minLevel + 2, floor + maxOffset);

    return this._uniqueMonsterList.filter(m => {
      if (isJokeMonster(m)) return false;
      if (!this.canSpawn(m.key)) return false;
      const mLevel = m.level || 1;
      if (mLevel < minLevel || mLevel > maxLevel) return false;

      // 테마 필터링 지원 (테마 지정 시)
      if (options.theme) {
        const themeUpper = options.theme.toUpperCase();
        if (themeUpper === 'ORC' && !(m.name.includes('Orc') || m.name.includes('Goblin') || m.name.includes('Ogre'))) return false;
        if (themeUpper === 'UNDEAD' && !(m.flags?.includes('UNDEAD') || m.name.includes('Ghost') || m.name.includes('Wight') || m.name.includes('Wraith') || m.name.includes('Vampire') || m.name.includes('Lich'))) return false;
        if (themeUpper === 'DRAGON' && !(m.flags?.includes('DRAGON') || m.name.includes('Dragon') || m.name.includes('Drake') || m.name.includes('Worm') || m.name.includes('Glaurung') || m.name.includes('Ancalagon'))) return false;
        if (themeUpper === 'DEMON' && !(m.flags?.includes('DEMON') || m.name.includes('Demon') || m.name.includes('Balrog') || m.name.includes('Devil'))) return false;
        if (themeUpper === 'TROLL' && !(m.flags?.includes('TROLL') || m.name.includes('Troll') || m.name.includes('Giant'))) return false;
      }

      return true;
    });
  }

  /**
   * 층수(floor)와 환경에 맞추어 유니크 몬스터 1체를 롤링하여 선택합니다.
   * @param {number} floor - 현재 층수
   * @param {Object} [options={}] - 옵션
   * @param {boolean} [options.autoMarkSpawned=true] - 선정 시 자동으로 markSpawned 처리할지 여부
   * @returns {Object|null} 선택된 유니크 몬스터 메타데이터
   */
  rollUniqueMonster(floor = 1, options = {}) {
    const autoMark = options.autoMarkSpawned !== false;
    let candidates = this.getAvailableUniqueMonsters(floor, options);

    // 후보가 부족할 경우 범위 확장 롤링 (폴백)
    if (candidates.length === 0) {
      candidates = this.getAvailableUniqueMonsters(floor, {
        minLevelOffset: -8,
        maxLevelOffset: 12
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    // 가중치 롤링: 층수와 레벨이 가까울수록 높은 가중치
    const weightedCandidates = candidates.map(c => {
      const diff = Math.abs((c.level || 1) - floor);
      const weight = Math.max(1, 20 - diff * 2);
      return { candidate: c, weight };
    });

    const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = candidates[0];

    for (const item of weightedCandidates) {
      roll -= item.weight;
      if (roll <= 0) {
        selected = item.candidate;
        break;
      }
    }

    if (autoMark && selected) {
      this.markSpawned(selected.key);
    }

    return selected;
  }

  /**
   * 유니크 몬스터 인스턴스를 생성합니다.
   * @param {number} x - 맵 X 좌표
   * @param {number} y - 맵 Y 좌표
   * @param {Object|string} uniqueDataOrKey - 유니크 몬스터 데이터 또는 키
   * @param {number} [levelOverride=null] - 레벨 오버라이드 (기본값: 데이터의 level)
   * @returns {Monster|null}
   */
  createUniqueMonsterInstance(x, y, uniqueDataOrKey, levelOverride = null) {
    let uData = typeof uniqueDataOrKey === 'string' ? this.getUniqueMonsterByKey(uniqueDataOrKey) : uniqueDataOrKey;
    if (!uData && typeof uniqueDataOrKey === 'string') {
      uData = TOME_MONSTERS_DATA[uniqueDataOrKey];
    }
    if (!uData) return null;

    const monsterLevel = levelOverride || uData.level || 1;
    
    // 저층(1~5층)은 LEGENDARY 강제 부착 제거 및 티어별(1~11F CHAMPION 차단, 1~24F CHIEFTAIN 차단) 접사 정규화
    let prefixes = [];
    let suffixes = [];
    if (monsterLevel <= 5) {
      prefixes = [];
      suffixes = ['WARRIOR'];
    } else if (monsterLevel <= 11) {
      prefixes = ['IRON'];
      suffixes = ['WARRIOR'];
    } else if (monsterLevel <= 24) {
      prefixes = ['IRON'];
      suffixes = ['CHAMPION'];
    } else {
      prefixes = ['LEGENDARY'];
      suffixes = ['CHAMPION'];
    }

    const monster = new Monster(x, y, uData.key, monsterLevel, prefixes, suffixes);
    
    // 유니크 전용 스펙 보정
    monster.isUnique = true;
    monster.uniqueKey = uData.key;
    monster._baseName = uData.name;
    monster.xpValue = Math.floor(monster.xpValue * 2.5);
    monster.stats.hp = Math.floor(monster.stats.hp * 1.5);
    const isMorgoth = monster.type === 'MON_MORGOTH_LORD_OF_DARKNESS' || monster.uniqueKey === 'MON_MORGOTH_LORD_OF_DARKNESS' || monster._baseName === 'Morgoth, Lord of Darkness';
    monster.stats.hp = clampMonsterHp(monster.stats.hp, monster.level, isMorgoth);
    monster.stats.maxHp = monster.stats.hp;

    return monster;
  }

  /**
   * ToME / TomeNET 정통 몬스터 드랍 플래그를 분석하여 생성할 아이템 수와 품질 보정치를 산출합니다.
   * @param {Object} monster 
   * @returns {{ count: number, isGood: boolean, isGreat: boolean, onlyItem: boolean, onlyGold: boolean }}
   */
  parseMonsterDropRules(monster) {
    const uData = this.getUniqueMonsterByKey(monster.uniqueKey || monster.type) || TOME_MONSTERS_DATA[monster.uniqueKey || monster.type] || {};
    const flags = monster.flags || uData.flags || [];

    let count = 0;
    let isGood = false;
    let isGreat = false;
    let onlyItem = false;
    let onlyGold = false;

    for (const flag of flags) {
      if (flag === 'DROP_4D2') {
        count += 4 + Math.floor(Math.random() * 4) + 1; // 4 + 1d4 (5~8개)
      } else if (flag === 'DROP_3D2') {
        count += 3 + Math.floor(Math.random() * 3) + 1; // 3 + 1d3 (4~6개)
      } else if (flag === 'DROP_2D2') {
        count += 2 + Math.floor(Math.random() * 2) + 1; // 2 + 1d2 (3~4개)
      } else if (flag === 'DROP_1D2') {
        count += 1 + (Math.random() < 0.5 ? 1 : 0); // 1~2개
      } else if (flag === 'DROP_90') {
        if (Math.random() < 0.90) count += 1;
      } else if (flag === 'DROP_60') {
        if (Math.random() < 0.60) count += 1;
      } else if (flag === 'DROP_GOOD') {
        isGood = true;
      } else if (flag === 'DROP_GREAT') {
        isGreat = true;
        isGood = true;
      } else if (flag === 'ONLY_ITEM') {
        onlyItem = true;
      } else if (flag === 'ONLY_GOLD') {
        onlyGold = true;
      }
    }

    // 유니크 몬스터 기본 보장 (플래그가 없거나 적은 경우 최소 2~3개 보장)
    if (monster.isUnique || uData.isUnique) {
      if (count < 2) {
        count = 2 + (Math.random() < 0.5 ? 1 : 0);
      }
      isGood = true;
    }

    return { count: Math.max(1, count), isGood, isGreat, onlyItem, onlyGold };
  }

  /**
   * 유니크 몬스터 처치 시 ToME 2.3.5 / TomeNET 정통 규칙에 기반한 전리품을 절차적으로 생성합니다.
   * @param {Object} monster - 처치된 유니크 몬스터 인스턴스
   * @param {number} floor - 현재 던전 층수
   * @param {Object} [map=null] - 던전 맵 객체
   * @returns {Array<Item>} 드랍될 아이템 배열
   */
  generateUniqueMonsterDrops(monster, floor = 1, map = null) {
    if (!monster) return [];
    const drops = [];
    const mx = monster.x || 0;
    const my = monster.y || 0;
    const mLevel = monster.level || floor || 1;
    const effectiveFloor = Math.max(floor, mLevel);

    const isWalkable = (x, y) => {
      if (!map) return true;
      if (typeof map.isWalkable === 'function' && !map.isWalkable(x, y)) return false;
      if (typeof map.isWall === 'function' && map.isWall(x, y)) return false;
      return true;
    };

    // 타일 위치 후보군 (중첩 방지용)
    const getDropPos = (index) => {
      const offsets = [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 2, dy: 0 },
        { dx: 0, dy: 2 }
      ];
      const offset = offsets[index % offsets.length];
      const targetX = mx + offset.dx;
      const targetY = my + offset.dy;
      if (isWalkable(targetX, targetY)) {
        return { x: targetX, y: targetY };
      }
      return { x: mx, y: my };
    };

    // 처치 상태 마킹
    const key = monster.uniqueKey || monster.type;
    if (key) {
      this.markKilled(key);
    }

    const dropRules = this.parseMonsterDropRules(monster);
    const totalCount = Math.max(2, dropRules.count);

    // -------------------------------------------------------------------------
    // 1~5층 (초심자 티어): ToME 정규 드랍 테이블 기반 고결한 에고 무기 + 정규 소모품
    // -------------------------------------------------------------------------
    if (effectiveFloor <= 5) {
      // 1) 고결한 ToME 에고 무기/장비 (하드코딩 검 퇴출, 정규 기본 장비에 HOLY 에고 부여)
      const p1 = getDropPos(0);
      const baseEquip = TomeLootGenerator.generateEquipmentItem(p1.x, p1.y, effectiveFloor, true);
      if (baseEquip) {
        if (!baseEquip.prefixes) baseEquip.prefixes = [];
        if (!baseEquip.prefixes.includes('HOLY')) {
          baseEquip.prefixes.unshift('HOLY');
        }
        if (!baseEquip.suffixes) baseEquip.suffixes = [];
        if (baseEquip.suffixes.length === 0) {
          baseEquip.suffixes.push('SLAYER');
        }
        baseEquip.flavorText = `유니크 [${monster.displayName}]을(를) 물리치고 획득한 ToME 정통 에고 장비입니다.`;
        baseEquip.syncComponents();
        drops.push(baseEquip);
      }

      // 2) ToME 정규 마법 강화 주문서 (무기 강화 주문서 또는 방어구 강화 주문서)
      const p2 = getDropPos(1);
      const isScrollWeapon = Math.random() < 0.6;
      const standardScroll = new Item(
        p2.x, p2.y,
        'SCROLL',
        '?',
        '#fb7185',
        isScrollWeapon ? '무기 강화 주문서' : '방어구 강화 주문서',
        0,
        null,
        {},
        null,
        null,
        [],
        [],
        [],
        isScrollWeapon ? "무기에 마법의 예리함을 각인하는 강화 주문서입니다." : "방어구의 내구력과 마법 저항을 강화하는 마법 주문서입니다."
      );
      standardScroll.syncComponents();
      drops.push(standardScroll);

      // 3) ToME 정규 회복 물약 (추가 슬롯이 있을 시)
      if (totalCount >= 3) {
        const p3 = getDropPos(2);
        const standardPotion = new Item(
          p3.x, p3.y,
          'POTION',
          '!',
          '#f43f5e',
          '상급 체력 물약',
          0,
          null,
          {},
          null,
          null,
          [],
          [],
          [],
          "상처를 즉시 봉합하고 체력을 회복시켜주는 고농축 물약입니다."
        );
        standardPotion.potionEffect = { type: 'HEAL', amount: 50 };
        standardPotion.syncComponents();
        drops.push(standardPotion);
      }

      return drops;
    }

    // -------------------------------------------------------------------------
    // 6층 이상: ToME 전설 유물(Artifact) 우선 선별 + 정규 절차적 추가 드랍
    // -------------------------------------------------------------------------
    let chosenArtifact = null;
    const availableArts = this._artifactList.filter(art => !this.droppedArtifacts.has(art.key) && (art.level <= mLevel + 12));
    
    if (availableArts.length > 0) {
      const closeArts = availableArts.filter(art => Math.abs(art.level - mLevel) <= 15);
      const pool = closeArts.length > 0 ? closeArts : availableArts;
      chosenArtifact = pool[Math.floor(Math.random() * pool.length)];
    }

    const posArt = getDropPos(0);
    if (chosenArtifact) {
      this.droppedArtifacts.add(chosenArtifact.key);
      const artItem = TomeLootGenerator._createArtifactItemInstance(posArt.x, posArt.y, chosenArtifact, effectiveFloor);
      if (artItem) {
        drops.push(artItem);
      }
    } else {
      // 유물이 모두 소진된 경우: TomeLootGenerator 기반 최고급 2중 에고 장비 절차적 생성
      const fallbackItem = TomeLootGenerator.generateFloorItem(posArt.x, posArt.y, effectiveFloor + 5, true);
      if (fallbackItem) {
        if (!fallbackItem.prefixes.includes('LEGENDARY')) fallbackItem.prefixes.unshift('LEGENDARY');
        if (!fallbackItem.specialTags.includes('EXTRA_ATTACK')) fallbackItem.specialTags.push('EXTRA_ATTACK');
        fallbackItem.syncComponents();
        drops.push(fallbackItem);
      }
    }

    // 2. 추가 전리품 (ToME 드랍 룰셋의 남은 수량만큼 정규 절차적 생성)
    const remainingSlots = Math.max(1, totalCount - drops.length);
    for (let i = 0; i < remainingSlots; i++) {
      const pos = getDropPos(drops.length);
      const bonusDepth = effectiveFloor + (dropRules.isGreat ? 5 : (dropRules.isGood ? 2 : 0));
      const bonusItem = TomeLootGenerator.generateFloorItem(pos.x, pos.y, bonusDepth, true);
      if (bonusItem) {
        drops.push(bonusItem);
      }
    }

    return drops;
  }

  /**
   * 세이브 저장을 위해 유니크 몬스터 매니저 상태를 직렬화합니다.
   * @returns {Object}
   */
  serialize() {
    return {
      spawned: Array.from(this.spawned),
      killed: Array.from(this.killed),
      droppedArtifacts: Array.from(this.droppedArtifacts)
    };
  }

  /**
   * 세이브 데이터로부터 유니크 몬스터 매니저 상태를 복원합니다.
   * @param {Object} data 
   */
  deserialize(data) {
    if (!data) return;
    this.spawned = new Set(data.spawned || []);
    this.killed = new Set(data.killed || []);
    this.droppedArtifacts = new Set(data.droppedArtifacts || []);
  }

  /**
   * 모든 유니크 스폰/처치/유물 상태를 초기화합니다.
   */
  reset() {
    this.spawned.clear();
    this.killed.clear();
    this.droppedArtifacts.clear();
  }
}

/** 싱글톤 전역 인스턴스 */
export const uniqueMonsterManager = new UniqueMonsterManager();
