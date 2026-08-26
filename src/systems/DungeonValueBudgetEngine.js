/**
 * @module DungeonValueBudgetEngine
 * @category systems
 * @description ToME/TomeNET 정통 층 깊이(Depth 1~50F) 기반 통합 밸류 예산 시스템.
 *              4단계 티어 게이팅(Tier Gating), 가우시안/시그모이드 OOD 스케일링,
 *              동적 맵 크기(Dynamic Map Dimensions) 및 다중 계단(Multiple Staircases) 분산 수식 산출,
 *              장비 인챈트(+to_h, +to_d, +to_a, pval) 및 몬스터 접사/직업/특수방 예산 통제 엔진.
 * @purity Pure Logic / Budget Calculation Engine
 * @dependencies DungeonThemeConfig.js, Tags.js, GameBalanceConfig.js
 * @exports DungeonValueBudgetEngine, dungeonValueBudgetEngine, DUNGEON_TIER_CONFIGS,
 *          getTierConfig, getMaxAllowedMonsterHp, clampMonsterHp, calculateFloorDanger, getSpecialRoomProbabilities,
 *          calculateMapDimensions, calculateStaircaseCounts,
 *          rollOutOfDepthLevel, rollMonsterAffixes, rollMonsterJobSuffix,
 *          calculateEnchantments, sigmoid, rollGaussian
 */

import { getThemeForFloor } from '../configs/DungeonThemeConfig.js';
import { PREFIX_TAGS, SUFFIX_TAGS } from '../entities/Tags.js';
import { SPAWN_FEATURE_CONFIG } from '../configs/GameBalanceConfig.js';

/**
 * 4단계 층수 티어(Tier)별 상세 밸류 예산 명세 레지스트리
 */
export const DUNGEON_TIER_CONFIGS = {
  TIER_1: {
    tier: 1,
    name: 'Phase 1: 초심자 구역 (Beginner Depths)',
    minFloor: 1,
    maxFloor: 5,
    maxMonsterHp: 300, // 최대 HP 상한 300 (일반 몬스터 15~80, 네임드 보스 최대 250)
    mapDimensions: { minWidth: 55, maxWidth: 65, minHeight: 38, maxHeight: 45, minRooms: 8, maxRooms: 11 },
    staircaseCounts: { upMin: 1, upMax: 1, downMin: 1, downMax: 2 },
    specialRooms: {
      vaultChance: 0.0,       // 1~5F Vault 0% 완전 차단
      monsterPitChance: 0.0,  // 1~5F Pit 0% 완전 차단
      sanctuaryChance: 0.10
    },
    affixes: {
      allowedRarities: ['normal', 'uncommon'],
      allowedPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON'],
      allowedSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE'],
      blockedPrefixes: ['FURIOUS', 'BLOODTHIRSTY', 'IMMORTAL', 'MANA'],
      blockedSuffixes: ['BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST', 'SHADOW', 'CHAMPION', 'CHIEFTAIN'],
      eliteChanceMin: 0.005,
      eliteChanceMax: 0.03,   // 1층 0.5% ~ 5층 3% (0~5% COMMON만 극소수 허용)
      maxPrefixCount: 1,
      maxSuffixCount: 1
    },
    jobs: {
      allowedJobs: ['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST'],
      blockedJobs: ['CHAMPION', 'CHIEFTAIN'],
      jobChanceMin: 0.005,
      jobChanceMax: 0.02,
      jobChance: 0.015
    },
    loot: {
      artifactDropChanceNormal: 0.0,     // 일반방 유물 0% 차단
      artifactDropChanceSpecial: 0.0,    // 특수방 유물 0% 차단
      egoChanceNormal: 0.08,
      egoChanceSpecial: 0.25,
      allowedEgoPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'HOLY'],
      allowedEgoSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE'],
      blockedEgoPrefixes: ['FURIOUS', 'BLOODTHIRSTY', 'IMMORTAL', 'MANA'],
      blockedEgoSuffixes: ['BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST', 'SHADOW'],
      maxEnchantToH: 3,
      maxEnchantToD: 3,
      maxEnchantToA: 5,
      maxPval: 1
    }
  },
  TIER_2: {
    tier: 2,
    name: 'Phase 2: 숙련자 구역 (Adept Depths)',
    minFloor: 6,
    maxFloor: 20,
    maxMonsterHp: 1200, // 최대 HP 상한 1,200
    mapDimensions: { minWidth: 65, maxWidth: 80, minHeight: 45, maxHeight: 55, minRooms: 12, maxRooms: 16 },
    staircaseCounts: { upMin: 1, upMax: 2, downMin: 2, downMax: 3 },
    specialRooms: {
      vaultChance: 0.18,       // 6~10F 15%, 11~20F 18%
      monsterPitChance: 0.15,  // 6~10F 12%, 11~20F 15%
      sanctuaryChance: 0.08
    },
    affixes: {
      allowedRarities: ['normal', 'uncommon', 'rare'],
      allowedPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'MANA', 'FURIOUS'],
      allowedSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST'],
      blockedPrefixes: ['BLOODTHIRSTY', 'IMMORTAL'],
      blockedSuffixes: ['SHADOW', 'CHIEFTAIN'],
      eliteChanceMin: 0.08,
      eliteChanceMax: 0.25,
      maxPrefixCount: 1,
      maxSuffixCount: 2
    },
    jobs: {
      allowedJobs: ['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION'], // 12F+ CHAMPION 해금
      blockedJobs: ['CHIEFTAIN'], // 1~24F CHIEFTAIN 절대 차단
      jobChance: 0.22
    },
    loot: {
      artifactDropChanceNormal: 0.005,
      artifactDropChanceSpecial: 0.10,    // 특수방 10%
      egoChanceNormal: 0.20,
      egoChanceSpecial: 0.50,
      allowedEgoPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'MANA', 'FURIOUS', 'HOLY'],
      allowedEgoSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST'],
      blockedEgoPrefixes: ['BLOODTHIRSTY', 'IMMORTAL'],
      blockedEgoSuffixes: ['SHADOW'],
      maxEnchantToH: 7,
      maxEnchantToD: 7,
      maxEnchantToA: 12,
      maxPval: 2
    }
  },
  TIER_3: {
    tier: 3,
    name: 'Phase 3: 심층 구역 (Deep Depths)',
    minFloor: 21,
    maxFloor: 40,
    maxMonsterHp: 3500, // 최대 HP 상한 3,500
    mapDimensions: { minWidth: 80, maxWidth: 95, minHeight: 55, maxHeight: 65, minRooms: 16, maxRooms: 22 },
    staircaseCounts: { upMin: 2, upMax: 3, downMin: 2, downMax: 4 },
    specialRooms: {
      vaultChance: 0.25,
      monsterPitChance: 0.22,
      sanctuaryChance: 0.06
    },
    affixes: {
      allowedRarities: ['normal', 'uncommon', 'rare', 'epic'],
      allowedPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'MANA', 'FURIOUS', 'BLOODTHIRSTY', 'IMMORTAL'],
      allowedSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST', 'SHADOW'],
      blockedPrefixes: [],
      blockedSuffixes: [],
      eliteChanceMin: 0.25,
      eliteChanceMax: 0.45,
      maxPrefixCount: 2,
      maxSuffixCount: 2
    },
    jobs: {
      allowedJobs: ['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'], // 25F+ CHIEFTAIN 해금
      blockedJobs: [],
      jobChance: 0.35
    },
    loot: {
      artifactDropChanceNormal: 0.02,
      artifactDropChanceSpecial: 0.20,
      egoChanceNormal: 0.45,
      egoChanceSpecial: 0.75,
      allowedEgoPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'MANA', 'FURIOUS', 'BLOODTHIRSTY', 'IMMORTAL', 'HOLY'],
      allowedEgoSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST', 'SHADOW'],
      blockedEgoPrefixes: [],
      blockedEgoSuffixes: [],
      maxEnchantToH: 12,
      maxEnchantToD: 12,
      maxEnchantToA: 20,
      maxPval: 3
    }
  },
  TIER_4: {
    tier: 4,
    name: 'Phase 4: 최심부/앙그반드 심층 (Endgame & Angband Depths)',
    minFloor: 41,
    maxFloor: 50,
    maxMonsterHp: 8000, // 최대 HP 상한 8,000 (단, 50F 최종보스 모르고스 15,000 예외)
    mapDimensions: { minWidth: 90, maxWidth: 110, minHeight: 65, maxHeight: 75, minRooms: 20, maxRooms: 26 },
    staircaseCounts: { upMin: 2, upMax: 3, downMin: 2, downMax: 4 },
    specialRooms: {
      vaultChance: 0.30,
      monsterPitChance: 0.28,
      sanctuaryChance: 0.04
    },
    affixes: {
      allowedRarities: ['normal', 'uncommon', 'rare', 'epic'],
      allowedPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'MANA', 'FURIOUS', 'BLOODTHIRSTY', 'IMMORTAL'],
      allowedSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST', 'SHADOW'],
      blockedPrefixes: [],
      blockedSuffixes: [],
      eliteChanceMin: 0.40,
      eliteChanceMax: 0.65,
      maxPrefixCount: 2,
      maxSuffixCount: 3
    },
    jobs: {
      allowedJobs: ['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'],
      blockedJobs: [],
      jobChance: 0.45
    },
    loot: {
      artifactDropChanceNormal: 0.05,
      artifactDropChanceSpecial: 0.35,
      egoChanceNormal: 0.60,
      egoChanceSpecial: 0.90,
      allowedEgoPrefixes: ['FIRE', 'COLD', 'LIGHTNING', 'TOXIC', 'IRON', 'MANA', 'FURIOUS', 'BLOODTHIRSTY', 'IMMORTAL', 'HOLY'],
      allowedEgoSuffixes: ['SLAYER', 'GALE', 'AEGIS', 'SAGE', 'BLOODLUST', 'FLURRY', 'FOCUS', 'QUICKCAST', 'SHADOW'],
      blockedEgoPrefixes: [],
      blockedEgoSuffixes: [],
      maxEnchantToH: 15,
      maxEnchantToD: 15,
      maxEnchantToA: 25,
      maxPval: 5
    }
  }
};

/**
 * 층수에 대응하는 4단계 티어(Tier) 설정 객체를 조회합니다.
 * @param {number} floor - 던전 층수 (1~50)
 * @returns {object} 티어 명세 객체
 */
export function getTierConfig(floor = 1) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  if (safeFloor <= 5) return DUNGEON_TIER_CONFIGS.TIER_1;
  if (safeFloor <= 20) return DUNGEON_TIER_CONFIGS.TIER_2;
  if (safeFloor <= 40) return DUNGEON_TIER_CONFIGS.TIER_3;
  return DUNGEON_TIER_CONFIGS.TIER_4;
}

/**
 * 층계별 몬스터 최대 허용 HP 상한(Max Allowed HP by Floor)을 반환합니다.
 * - 1~5F: 최대 HP 상한 300 (일반 몬스터 15~80, 네임드 보스 최대 250)
 * - 6~20F: 최대 HP 상한 1,200
 * - 21~40F: 최대 HP 상한 3,500
 * - 41~50F: 최대 HP 상한 8,000 (단, 50F 최종보스 모르고스 15,000 예외)
 * @param {number} floor - 던전 층수 (1~50)
 * @param {boolean} [isMorgoth=false] - 50F 최종보스 모르고스 여부
 * @returns {number} 최대 허용 HP 상한치
 */
export function getMaxAllowedMonsterHp(floor = 1, isMorgoth = false) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  if (isMorgoth && safeFloor >= 50) return 15000;
  const tierCfg = getTierConfig(safeFloor);
  return tierCfg?.maxMonsterHp || 8000;
}

/**
 * 몬스터의 HP가 던전 층계 기준 비정상적으로 높게 산출된 경우 건전성 상한치로 클램핑합니다.
 * @param {number} hp - 원본 산출 체력
 * @param {number} floor - 던전 층수
 * @param {boolean} [isMorgoth=false] - 최종 보스 여부
 * @returns {number} 건전성 클램핑이 적용된 체력
 */
export function clampMonsterHp(hp, floor = 1, isMorgoth = false) {
  const cfg = SPAWN_FEATURE_CONFIG;
  if (cfg && cfg.hpSanityClamping === false) {
    return Math.max(1, Math.round(hp || 1));
  }
  const maxAllowed = getMaxAllowedMonsterHp(floor, isMorgoth);
  return Math.max(1, Math.min(maxAllowed, Math.round(hp || 1)));
}

/**
 * 던전 층수에 따른 결정론적 위험도(Danger Rating) 수치를 산출합니다.
 * 1층 1.6 -> 5층 3.8 -> 10층 6.5 -> 20층 12.0 -> 30층 17.5 -> 50층 28.5
 * @param {number} floor - 던전 층수
 * @returns {number} 위험도 수치
 */
export function calculateFloorDanger(floor = 1) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  return Math.round((1.0 + safeFloor * 0.55) * 10) / 10;
}

/**
 * 던전 층수에 따른 특수방(보물 금고 Vault, 몬스터 피트 Monster Pit, 성소 Sanctuary) 발생 확률을 반환합니다.
 * 1~5층(Tier 1)은 Vault 0%, Pit 0%가 100% 보장됩니다.
 * @param {number} floor - 던전 층수
 * @returns {{ vaultChance: number, monsterPitChance: number, sanctuaryChance: number }}
 */
export function getSpecialRoomProbabilities(floor = 1) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  if (safeFloor <= 5) {
    return { vaultChance: 0.0, monsterPitChance: 0.0, sanctuaryChance: 0.10 };
  }
  if (safeFloor <= 10) {
    return { vaultChance: 0.15, monsterPitChance: 0.12, sanctuaryChance: 0.10 };
  }
  if (safeFloor <= 20) {
    return { vaultChance: 0.18, monsterPitChance: 0.15, sanctuaryChance: 0.08 };
  }
  if (safeFloor <= 30) {
    return { vaultChance: 0.22, monsterPitChance: 0.18, sanctuaryChance: 0.06 };
  }
  if (safeFloor <= 40) {
    return { vaultChance: 0.25, monsterPitChance: 0.22, sanctuaryChance: 0.05 };
  }
  return { vaultChance: 0.30, monsterPitChance: 0.28, sanctuaryChance: 0.04 };
}

/**
 * 던전 층수에 따른 동적 맵 크기 및 최대 방 개수 명세를 산출합니다.
 * - 1~5F: width 55~65, height 38~45, maxRooms 8~11 (콤팩트 튜토리얼 던전)
 * - 6~20F: width 65~80, height 45~55, maxRooms 12~16 (중형 던전)
 * - 21~40F: width 80~95, height 55~65, maxRooms 16~22 (대형 복잡 던전)
 * - 41~50F: width 90~110, height 65~75, maxRooms 20~26 (광활한 엔드게임 던전)
 * @param {number} floor - 던전 층수 (1~50)
 * @returns {{ width: number, height: number, maxRooms: number }}
 */
export function calculateMapDimensions(floor = 1) {
  const safeFloor = Math.max(1, Math.min(50, Math.floor(floor || 1)));

  if (safeFloor <= 5) {
    const progress = (safeFloor - 1) / (5 - 1 || 1);
    const width = Math.round(55 + progress * (65 - 55));
    const height = Math.round(38 + progress * (45 - 38));
    const maxRooms = Math.round(8 + progress * (11 - 8));
    return { width, height, maxRooms };
  }
  if (safeFloor <= 20) {
    const progress = (safeFloor - 6) / (20 - 6 || 1);
    const width = Math.round(65 + progress * (80 - 65));
    const height = Math.round(45 + progress * (55 - 45));
    const maxRooms = Math.round(12 + progress * (16 - 12));
    return { width, height, maxRooms };
  }
  if (safeFloor <= 40) {
    const progress = (safeFloor - 21) / (40 - 21 || 1);
    const width = Math.round(80 + progress * (95 - 80));
    const height = Math.round(55 + progress * (65 - 55));
    const maxRooms = Math.round(16 + progress * (22 - 16));
    return { width, height, maxRooms };
  }
  // 41 ~ 50F
  const progress = (safeFloor - 41) / (50 - 41 || 1);
  const width = Math.round(90 + progress * (110 - 90));
  const height = Math.round(65 + progress * (75 - 65));
  const maxRooms = Math.round(20 + progress * (26 - 20));
  return { width, height, maxRooms };
}

/**
 * 던전 층수 및 생성된 방 개수에 따라 상/하행 계단(Staircase) 개수를 산출합니다.
 * - 상행 계단: 1F 1개(봉인), 2~10F 1~2개, 11~50F 2~3개
 * - 하행 계단: 1~5F 1~2개, 6~20F 2~3개, 21~49F 2~4개, 50F 0개(최종 결전장)
 * @param {number} floor - 던전 층수 (1~50)
 * @param {number} [roomCount=10] - 현재 층에 생성된 유효 방 개수
 * @returns {{ upStairs: number, downStairs: number }}
 */
export function calculateStaircaseCounts(floor = 1, roomCount = 10) {
  const safeFloor = Math.max(1, Math.min(50, Math.floor(floor || 1)));
  const maxAvailable = Math.max(1, Math.floor(roomCount || 10));

  let upStairs = 1;
  let downStairs = 1;

  // 상행 계단 수 산출
  if (safeFloor === 1) {
    upStairs = 1;
  } else if (safeFloor <= 10) {
    // 2~10F: 1~2개
    const progress = (safeFloor - 2) / (10 - 2 || 1);
    upStairs = Math.round(1 + progress * (2 - 1));
  } else {
    // 11~50F: 2~3개
    const progress = (safeFloor - 11) / (50 - 11 || 1);
    upStairs = Math.round(2 + progress * (3 - 2));
  }

  // 하행 계단 수 산출
  if (safeFloor >= 50) {
    downStairs = 0; // 50층 최종 결전장: 하행 계단 없음
  } else if (safeFloor <= 5) {
    // 1~5F: 1~2개
    const progress = (safeFloor - 1) / (5 - 1 || 1);
    downStairs = Math.round(1 + progress * (2 - 1));
  } else if (safeFloor <= 20) {
    // 6~20F: 2~3개
    const progress = (safeFloor - 6) / (20 - 6 || 1);
    downStairs = Math.round(2 + progress * (3 - 2));
  } else {
    // 21~49F: 2~4개
    const progress = (safeFloor - 21) / (49 - 21 || 1);
    downStairs = Math.round(2 + progress * (4 - 2));
  }

  // 방 개수 초과 방지 안전 클램핑
  if (safeFloor === 50) {
    downStairs = 0;
    upStairs = Math.max(1, Math.min(upStairs, maxAvailable));
  } else {
    if (maxAvailable === 1) {
      upStairs = 1;
      downStairs = 1;
    } else {
      upStairs = Math.max(1, Math.min(upStairs, maxAvailable - 1));
      const remainingRooms = Math.max(1, maxAvailable - upStairs);
      downStairs = Math.max(1, Math.min(downStairs, remainingRooms));
    }
  }

  return { upStairs, downStairs };
}

/**
 * Box-Muller 변환 기반 가우시안 정규분포 난수 생성기
 * @param {number} [mean=0] - 평균
 * @param {number} [stdDev=1] - 표준편차
 * @returns {number}
 */
export function rollGaussian(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + num * stdDev;
}

/**
 * ToME/Angband 정통 Out-of-Depth (OOD) 가우시안 몬스터 레벨 롤링 함수.
 * 1~5층(Tier 1) 초심자 구역에서는 OOD 오프셋이 상한(5층)을 넘지 않도록 철저히 통제합니다.
 * @param {number} floor - 현재 층수
 * @param {number} [oodChance=0.10] - OOD 발생 확률 (기본 10%)
 * @param {number} [maxOffset=8] - 최대 레벨 오프셋
 * @returns {number} 산출된 유효 레벨
 */
export function rollOutOfDepthLevel(floor = 1, oodChance = 0.10, maxOffset = 8) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  if (Math.random() >= oodChance) {
    return safeFloor;
  }

  const gVal = Math.abs(rollGaussian(2.5, 1.5));
  const offset = Math.min(maxOffset, Math.max(1, Math.round(gVal)));

  if (safeFloor <= 5) {
    return Math.min(5, safeFloor + Math.min(offset, Math.max(0, 5 - safeFloor)));
  }

  return Math.min(55, safeFloor + offset);
}

/**
 * 던전 층수 및 몬스터 분류에 따른 접두사/접미사(Affix) 롤링 함수.
 * 1~5층(Tier 1)에서는 0~5% COMMON/UNCOMMON만 허용하며, RARE/EPIC 접사(IMMORTAL, BLOODTHIRSTY 등)는 완전 차단됩니다.
 * @param {number} floor - 던전 층수
 * @param {boolean} [isBoss=false] - 보스 여부
 * @param {boolean} [isGuard=false] - 금고 수호자 여부
 * @returns {{ prefixes: Array<string>, suffixes: Array<string> }}
 */
export function rollMonsterAffixes(floor = 1, isBoss = false, isGuard = false) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  const tierConfig = getTierConfig(safeFloor);
  const { affixes } = tierConfig;

  // 정예 접사 획득 확률 계산
  const span = Math.max(1, tierConfig.maxFloor - tierConfig.minFloor);
  const progress = (safeFloor - tierConfig.minFloor) / span;
  let eliteChance = affixes.eliteChanceMin + progress * (affixes.eliteChanceMax - affixes.eliteChanceMin);
  
  if (isBoss) eliteChance = Math.min(1.0, eliteChance + 0.35);
  if (isGuard) eliteChance = Math.min(1.0, eliteChance + 0.25);

  if (Math.random() > eliteChance && !isBoss && !isGuard) {
    return { prefixes: [], suffixes: [] };
  }

  const selectedPrefixes = [];
  const selectedSuffixes = [];

  // 허용 접두사 필터링 (차단 목록 완전 배제)
  const validPrefixes = (affixes.allowedPrefixes || []).filter(p => !affixes.blockedPrefixes.includes(p));
  const validSuffixes = (affixes.allowedSuffixes || []).filter(s => !affixes.blockedSuffixes.includes(s) && !['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'].includes(s));

  if (validPrefixes.length > 0) {
    const pCount = isBoss ? Math.min(affixes.maxPrefixCount, 2) : 1;
    const shuffled = [...validPrefixes].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(pCount, shuffled.length); i++) {
      selectedPrefixes.push(shuffled[i]);
    }
  }

  if (validSuffixes.length > 0 && (isBoss || isGuard || Math.random() < 0.40)) {
    const sCount = isBoss ? Math.min(affixes.maxSuffixCount, 2) : 1;
    const shuffled = [...validSuffixes].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(sCount, shuffled.length); i++) {
      selectedSuffixes.push(shuffled[i]);
    }
  }

  return {
    prefixes: Array.from(new Set(selectedPrefixes)),
    suffixes: Array.from(new Set(selectedSuffixes))
  };
}

/**
 * 던전 층수 및 몬스터 분류에 따른 직업 접미사(Job Suffix) 롤링 함수.
 * 1~11층에서는 CHAMPION이 절대 스폰되지 않으며, 1~24층에서는 CHIEFTAIN이 절대 스폰되지 않습니다.
 * @param {number} floor - 던전 층수
 * @param {boolean} [isBoss=false] - 보스 여부
 * @returns {string|null} 선택된 직업 접미사 키 또는 null
 */
export function rollMonsterJobSuffix(floor = 1, isBoss = false) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  const tierConfig = getTierConfig(safeFloor);
  const { jobs } = tierConfig;

  const span = Math.max(1, tierConfig.maxFloor - tierConfig.minFloor);
  const progress = (safeFloor - tierConfig.minFloor) / span;
  let jobChance = jobs.jobChanceMin !== undefined
    ? jobs.jobChanceMin + progress * (jobs.jobChanceMax - jobs.jobChanceMin)
    : jobs.jobChance;

  if (isBoss) jobChance = Math.min(1.0, jobChance + 0.40);

  if (Math.random() > jobChance && !isBoss) {
    return null;
  }

  const jobPool = [];
  jobPool.push({ key: 'WARRIOR', weight: 30 });
  jobPool.push({ key: 'MAGE', weight: 25 });
  jobPool.push({ key: 'SHAMAN', weight: 20 });
  jobPool.push({ key: 'PRIEST', weight: 25 });

  // 1~11층 CHAMPION 차단 (12F+ 해금)
  if (safeFloor >= 12 && !jobs.blockedJobs.includes('CHAMPION')) {
    jobPool.push({ key: 'CHAMPION', weight: 15 + safeFloor * 0.5 });
  }

  // 1~24층 CHIEFTAIN 차단 (25F+ 해금)
  if (safeFloor >= 25 && !jobs.blockedJobs.includes('CHIEFTAIN')) {
    jobPool.push({ key: 'CHIEFTAIN', weight: 8 + safeFloor * 0.4 });
  }

  const totalWeight = jobPool.reduce((sum, j) => sum + j.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of jobPool) {
    roll -= item.weight;
    if (roll <= 0) return item.key;
  }

  return 'WARRIOR';
}

/**
 * 시그모이드(Sigmoid) 활성화 수학 함수
 * @param {number} x - 입력값
 * @param {number} [k=0.1] - 기울기
 * @param {number} [x0=25] - 변곡점 (25층)
 * @returns {number} 0 ~ 1 사이의 실수
 */
export function sigmoid(x, k = 0.1, x0 = 25) {
  return 1 / (1 + Math.exp(-k * (x - x0)));
}

/**
 * 시그모이드 수학 곡선 기반 장비 인챈트(+to_h, +to_d, +to_a, pval) 산출 엔진.
 * @param {number} floor - 던전 층수 (1~50)
 * @param {string} [itemType='WEAPON'] - 아이템 유형
 * @returns {{ to_h: number, to_d: number, to_a: number, pval: number }}
 */
export function calculateEnchantments(floor = 1, itemType = 'WEAPON') {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  const tierConfig = getTierConfig(safeFloor);
  const sFactor = sigmoid(safeFloor, 0.09, 25);
  const upperType = (itemType || 'WEAPON').toUpperCase();

  const isWeapon = ['WEAPON', 'BOW'].includes(upperType);
  const isArmor = ['ARMOR', 'SHIELD', 'HELMET', 'BOOTS', 'GLOVES', 'CLOAK'].includes(upperType);
  const isAccessory = ['RING', 'AMULET', 'LIGHT', 'LAMP'].includes(upperType);

  let to_h = 0;
  let to_d = 0;
  let to_a = 0;
  let pval = 0;

  if (isWeapon) {
    const rawH = Math.round(15 * sFactor + (Math.random() * 2 - 1));
    const rawD = Math.round(15 * sFactor + (Math.random() * 2 - 1));
    to_h = Math.max(0, Math.min(tierConfig.loot.maxEnchantToH, rawH));
    to_d = Math.max(0, Math.min(tierConfig.loot.maxEnchantToD, rawD));
  } else if (isArmor) {
    const rawA = Math.round(25 * sFactor + (Math.random() * 3 - 1.5));
    to_a = Math.max(0, Math.min(tierConfig.loot.maxEnchantToA, rawA));
  }

  if (isAccessory || Math.random() < 0.3) {
    const rawP = Math.max(1, Math.round(5 * sFactor));
    pval = Math.max(1, Math.min(tierConfig.loot.maxPval, rawP));
  }

  return { to_h, to_d, to_a, pval };
}

/**
 * 통합 던전 밸류 예산 시스템 클래스
 */
export class DungeonValueBudgetEngine {
  static getTierConfig = getTierConfig;
  static getMaxAllowedMonsterHp = getMaxAllowedMonsterHp;
  static clampMonsterHp = clampMonsterHp;
  static calculateFloorDanger = calculateFloorDanger;
  static getSpecialRoomProbabilities = getSpecialRoomProbabilities;
  static calculateMapDimensions = calculateMapDimensions;
  static calculateStaircaseCounts = calculateStaircaseCounts;
  static rollGaussian = rollGaussian;
  static rollOutOfDepthLevel = rollOutOfDepthLevel;
  static rollMonsterAffixes = rollMonsterAffixes;
  static rollMonsterJobSuffix = rollMonsterJobSuffix;
  static sigmoid = sigmoid;
  static calculateEnchantments = calculateEnchantments;
}

export const dungeonValueBudgetEngine = new DungeonValueBudgetEngine();
