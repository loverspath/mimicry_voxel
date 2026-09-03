/**
 * @module GameBalanceConfig
 * @category configs
 * @description 게임 밸런스 공식, 레벨업 성장 곡선, 무게/속도 제약, 무기 숙련도, 전투 주사위 공식, 속성 저항 계수 및 드랍 확률 중앙화 설정
 * @purity Pure Function
 * @dependencies none
 * @exports COMBAT_CONFIG, LEVEL_CONFIG, WEIGHT_CONFIG, WEAPON_MASTERY_CONFIG, WEAPON_REQUIREMENT_CONFIG, SKILL_BALANCE_CONFIG, LOOT_BALANCE_CONFIG, TURN_CONFIG, DUNGEON_CUSTOM_SETTINGS, SPAWN_FEATURE_CONFIG, isJokeMonster, calculateXpNeeded, calculateStatGrowth, calculateMaxWeightLimit, calculateSpeedModifier
 */

/**
 * 1. 전투 공식 및 한계 조율 데이터 레지스트리 (Combat Baseline)
 */
export const COMBAT_CONFIG = {
  FEAR_AURA: { maxDistance: 5.5, accuracyPenaltyPerStack: 3 },
  UPGRADE: { armorPenPerLevel: 0.02, conModPenLimit: 0.90, dmgMultPerLevel: 0.03 },
  CRIT: { baseThreshold: 20, minThreshold: 15, baseMultiplier: 1.5, multiplierPerStack: 0.15 },
  BERSERK_RAGE: { hpPercentageTrigger: 0.50, damageAmpPerStack: 0.40 },
  ELEMENTAL_MELEE: { diceFormula: "1d4", coldVulnerabilityAmp: 1.30 },
  MONSTER: {
    SLIME_REFLECTION: { chance: 0.15, diceFormula: "1d4" },
    OGRE_REGEN: { chance: 0.30, maxHpPercentageHeal: 0.10, cooldown: 4 }
  },
  PLAYER_DEFENSE: { baseAC: 10, protectPrayerReduction: 3, armorReductionDivisor: 20 },
  SPELL_SYNERGY: {
    MANA_LEAK_DEBUFF: 0.80,         // -20% spell damage
    ELEMENTAL_BOOST_AMP: 0.50,      // +50% breath damage per stack
    MAGIC_BOOST_AMP: 0.20,          // +20% spell damage per stack
    FOCUS_AMP: 0.20,                // +20% damage per stack
    SPELL_CHARGE_ENERGY: 15,
    SAGE_HEAL_PCT: 0.10,
    QUICKCAST_CD_REDUCTION: 0.80    // 20% cooldown reduction compound
  }
};

/**
 * 2. RPG 레벨업 및 경험치(XP) 성장 곡선 설정
 */
export const LEVEL_CONFIG = {
  baseXp: 50,
  growthMultiplier: 15,
  maxStatCap: 999,
  defaultCoreBase: 8,
  defaultCoreMax: 150,
  growthPhiExponent: 1.5,
  maxReferenceLevel: 100
};

/**
 * 3. 미믹 소지 무게(Weight) 및 과적(Over-encumbrance) 감속 배율 설정
 */
export const WEIGHT_CONFIG = {
  strMultiplier: 3.5,             // STR 1당 무게 한도 계수
  conMultiplier: 1.5,             // CON 1당 무게 한도 계수
  heavySoulPenalty: 15,           // HEAVY_SOUL 변이 패널티 (+15kg)
  heavyThreshold: 0.80,           // 80% 이상 소지 시 중량 상태
  heavySpeedMultiplier: 0.70,     // 중량 시 속도 30% 감속 (0.70)
  overloadThreshold: 1.00,        // 100% 초과 시 과적 상태
  overloadSpeedMultiplier: 0.40   // 과적 시 속도 60% 감속 (0.40)
};

/**
 * 4. 무기 숙련도(Mastery) 및 요구 스탯(Requirement) 설정
 */
export const WEAPON_MASTERY_CONFIG = {
  levels: [
    { lvl: 1, req: 0, extraAttacks: 0 },
    { lvl: 2, req: 30, extraAttacks: 0 },
    { lvl: 3, req: 80, extraAttacks: 1 },
    { lvl: 4, req: 180, extraAttacks: 1 },
    { lvl: 5, req: 380, extraAttacks: 2 }
  ],
  categories: {
    UNARMED: { name: "맨손 타격", desc: "무기 장착 해제 상태. 체중을 실은 원시적 체술." },
    SWORD: { name: "도검 검술", desc: "검, 단검, 군장검. 예리하게 베고 찌르는 검법." },
    BLUNT: { name: "둔기 강타", desc: "메이스, 도끼, 망치, 둔기. 가공할 타격력의 강타술." },
    POLEARM: { name: "장병 창술", desc: "창, 할버드, 스태프, 지팡이. 리치를 살린 창술과 봉술." }
  }
};

export const WEAPON_REQUIREMENT_CONFIG = {
  strMultiplier: 3.5, // 무기 무게당 요구 STR 스탯 배율
  dexMultiplier: 2.5, // 무기 무게당 요구 DEX 스탯 배율
  minStrLimit: 12,    // 맨손 상태일 때 요구하는 힘의 최소 한계치
  minDexLimit: 10     // 맨손 상태일 때 요구하는 민첩의 최소 한계치
};

/**
 * 5. 스킬 밸런스 및 마나 계수 설정
 */
export const SKILL_BALANCE_CONFIG = {
  spellChargeEnergy: 15,
  sageHealPct: 0.10,
  quickcastCdReduction: 0.80,
  manaLeakDebuff: 0.80,
  elementalBoostAmp: 0.50,
  magicBoostAmp: 0.20,
  focusAmp: 0.20
};

/**
 * 6. 전리품(Loot) 및 아이템 드랍률/직업 접미사 스케일링 설정
 */
export const LOOT_BALANCE_CONFIG = {
  baseDropChance: 0.25,
  dangerDropScaling: 0.03,
  maxDropChance: 0.85,
  rarityBonus: {
    uncommon: 0.10,
    rare: 0.25,
    epic: 0.50
  },
  jobSuffixBaseChance: 0.15,
  jobSuffixDangerScaling: 0.04,
  maxJobSuffixChance: 0.45
};

/**
 * 7. 턴 스케줄러 및 액션 포인트(AP) 설정
 */
export const TURN_CONFIG = {
  baseActionPoints: 100,
  moveCost: 100,
  attackCost: 100,
  castCost: 120,
  itemUseCost: 80,
  waitCost: 100
};

/**
 * 8. 몬스터 엘리트 프리픽스(칭호/속성) 출현 확률 수학적 곡선 설정
 */
export const ELITE_PREFIX_CONFIG = {
  minChance: 0.015,       // 1층 극희귀 출현율 (1.5%)
  maxChance: 0.85,        // 50층 심층부 출현율 (85.0%)
  exponent: 1.35,         // 곡선 가속 지수 (1.35)
  maxFloorRef: 50         // 기준 심층 층수
};

/**
 * 레벨에 따른 필요 경험치(xpNeeded)를 산출합니다.
 * @param {number} level - 현재 캐릭터 레벨
 * @returns {number} 다음 레벨업에 필요한 경험치
 */
export function calculateXpNeeded(level) {
  if (level <= 1) return LEVEL_CONFIG.baseXp;
  return LEVEL_CONFIG.baseXp + (level * level * LEVEL_CONFIG.growthMultiplier);
}

/**
 * 로그-스케일 성장 곡선에 따른 스탯 증가량을 계산합니다.
 * @param {number} level - 현재 레벨
 * @param {number} [coreBase=8] - 종족 기초 스탯치
 * @param {number} [coreMax=150] - 종족 최대 잠재 스탯치
 * @returns {number} 계산된 누적 스탯 증가치
 */
export function calculateStatGrowth(level, coreBase = LEVEL_CONFIG.defaultCoreBase, coreMax = LEVEL_CONFIG.defaultCoreMax) {
  if (level <= 1) return 0;
  const phi = Math.pow(Math.log(level) / Math.log(LEVEL_CONFIG.maxReferenceLevel), LEVEL_CONFIG.growthPhiExponent);
  return Math.floor((coreMax - coreBase) * (isNaN(phi) ? 0 : phi));
}

/**
 * 던전 층수에 따른 몬스터 엘리트 프리픽스(칭호/속성) 부여 확률을 비선형 수학적 곡선으로 산출합니다.
 * P_prefix(floor) = clamp(0.015, 0.85, 0.015 + ((floor - 1) / 49)^1.35 * 0.835)
 * @param {number} floor - 현재 던전 층수
 * @param {boolean} [isBoss=false] - 보스 몬스터 여부 (보스는 100% 확정)
 * @returns {number} 0.015 ~ 0.85 (보스: 1.0)
 */
export function calculateElitePrefixChance(floor, isBoss = false) {
  if (isBoss) return 1.0;
  const f = Math.max(1, floor || 1);
  const normalized = Math.min(1.0, (f - 1) / (ELITE_PREFIX_CONFIG.maxFloorRef - 1));
  const raw = ELITE_PREFIX_CONFIG.minChance + Math.pow(normalized, ELITE_PREFIX_CONFIG.exponent) * (ELITE_PREFIX_CONFIG.maxChance - ELITE_PREFIX_CONFIG.minChance);
  return Math.max(ELITE_PREFIX_CONFIG.minChance, Math.min(ELITE_PREFIX_CONFIG.maxChance, raw));
}

/**
 * 8.1 종합 던전 & 게임플레이 커스텀 설정 (Dungeon Custom Settings Engine)
 */
export const DUNGEON_CUSTOM_SETTINGS = {
  // 1. SPAWN & DIFFICULTY (스폰/난이도/변형체)
  spawn: {
    allowJokeMonsters: false, // 기본값 false, 켜면 JokeAngband 조크 몬스터 허용
    flagBlacklist: ['JOKEANGBAND', 'JOKEBAND', 'ONLY_JOKE', 'UNFINISHED'],
    difficultyPreset: 'NORMAL', // 'EASY', 'NORMAL', 'HARD', 'NIGHTMARE'
    hpSanityClamping: true // 비정상 수치 억제 (층계별 HP 상한 가드)
  },
  // 2. MAP GENERATION (맵 크기/밀도/계단)
  map: {
    mapSizeScale: 1.0, // 0.75 콤팩트 ~ 1.0 표준 ~ 1.3 대형 탐험
    roomDensity: 'STANDARD', // 'COMPACT', 'STANDARD', 'LABYRINTH'
    stairCountMultiplier: 1.0 // 계단 출현 배율
  },
  // 3. LOOT & DROP RATES (드랍 수율/에고/유물)
  loot: {
    itemDropMultiplier: 1.0, // 0.5 하드코어 ~ 1.0 표준 ~ 1.5 풍요
    goldDropMultiplier: 1.0,
    egoDropMultiplier: 1.0,
    artifactRarityMultiplier: 1.0
  },
  // 4. GAMEPLAY & PROCEDURAL (유동성/OOD/편의성)
  gameplay: {
    oodRollChance: 0.10, // Out-of-Depth 깜짝 출현 확률 0.0 ~ 0.25
    monsterDensityMultiplier: 1.0,
    permadeathMode: true
  }
};

/** 하위 호환용 단축 참조 */
export const SPAWN_FEATURE_CONFIG = DUNGEON_CUSTOM_SETTINGS.spawn;

export const JOKE_KEYWORDS = Object.freeze([
  'programmer',
  'hacker',
  'maintainer',
  'microsoft',
  'gates',
  'random number generator',
  '프로그래머',
  'jokeangband',
  'jokeband'
]);

/**
 * 주어진 몬스터 메타데이터 또는 인스턴스가 조크/이스터에그 몬스터인지 판별합니다.
 * @param {Object} monsterData 
 * @param {boolean|null} allowJokeOverride
 * @returns {boolean}
 */
export function isJokeMonster(monsterData, allowJokeOverride = null) {
  if (!monsterData) return false;
  let allowJoke = allowJokeOverride;
  if (allowJoke === null && typeof globalThis !== 'undefined' && globalThis.__activeBalanceConfig) {
    allowJoke = globalThis.__activeBalanceConfig?.spawn?.allowJokeMonsters;
  }
  const cfg = DUNGEON_CUSTOM_SETTINGS?.spawn || SPAWN_FEATURE_CONFIG;
  if (allowJoke ?? cfg.allowJokeMonsters) return false;

  // 1. 플래그 기반 검출
  const flags = monsterData.flags || monsterData.perks || [];
  if (Array.isArray(flags)) {
    const jokeFlags = ['JOKEANGBAND', 'JOKEBAND', 'JOKE', 'ONLY_JOKE', 'UNFINISHED'];
    if (flags.some(flag => jokeFlags.includes(flag) || (cfg.flagBlacklist && cfg.flagBlacklist.includes(flag)))) {
      return true;
    }
  }

  // 2. 키워드 기반 검출 (이름, 플레이버 텍스트, 설명, 키)
  const textToCheck = `${monsterData.key || ''} ${monsterData.name || ''} ${monsterData.flavorText || ''} ${monsterData.desc || ''} ${monsterData.description || ''}`.toLowerCase();
  for (const kw of JOKE_KEYWORDS) {
    if (textToCheck.includes(kw.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * 9. ToME 2.3.5 6대 정통 스탯(STR/INT/WIS/DEX/CON/CHR) 메타데이터
 */
export const STAT_METADATA = {
  str: { key: 'str', name: '힘 (STR)', desc: '근접 물리 피해량 및 최대 적재 중량을 증가시킵니다.' },
  int: { key: 'int', name: '지능 (INT)', desc: '비전 마법 공격력 및 최대 마나 한도를 증가시킵니다.' },
  wis: { key: 'wis', name: '지혜 (WIS)', desc: '신성 기도, 상태이상 내성 저항력 및 치유력을 증가시킵니다.' },
  dex: { key: 'dex', name: '민첩 (DEX)', desc: '명중률, 회피율, 원거리 사격 공격력 및 치명타율을 증가시킵니다.' },
  con: { key: 'con', name: '체질 (CON)', desc: '최대 체력(HP), 방어력 및 턴당 체력 회복량을 증가시킵니다.' },
  chr: { key: 'chr', name: '매력 (CHR)', desc: '상점 가격 할인율 및 정수 코어 융합 효율을 증가시킵니다.' }
};

/**
 * 10. ToME 정통 원거리(Ranged) 사격 시스템 설정
 */
export const RANGED_COMBAT_CONFIG = {
  defaultRange: 5,            // 기본 활/석궁 사거리 (5칸)
  minRange: 2,                // 최소 사거리 (1칸 인접은 근접 전환)
  maxRange: 8,                // 최대 사거리 한계 (8칸)
  defaultMultiplier: 2,       // 기본 원거리 발사체 배율 (x2)
  dexScalingFactor: 1.2,      // DEX 1당 원거리 공격력 가산치
  bowDamageDice: "1d6",       // 기본 화살 피해 주사위
  crossbowDamageDice: "1d8",  // 기본 석궁 볼트 피해 주사위
  slingDamageDice: "1d4"      // 기본 슬링 탄환 피해 주사위
};

/**
 * 10.1 마법 스킬 자원 체계 (100% 순수 쿨다운 및 변신 숙련도 감축 모드)
 */
export const MAGIC_RESOURCE_CONFIG = {
  mode: 'COOLDOWN_ONLY',
  masteryCooldownDivisor: 25   // 변신 숙련도 25레벨당 쿨타임 -1턴 감소 (Lv 25: -1, Lv 50: -2)
};

/**
 * 10.2 원거리 무기 쿨타임 및 속사(Shots per round) 듀얼 모드 설정
 */
export const ARCHERY_CONFIG = {
  mode: 'INTERVAL_COOLDOWN',  // 'INTERVAL_COOLDOWN' (무기별 발사 간격 쿨타임) or 'BURST_RATE' (DEX/숙련도 기반 턴당 연사)
  weapons: {
    SHORTBOW: { name: '단궁', intervalCooldown: 1, baseShots: 1, baseMultiplier: 2.0, defaultRange: 5 },
    LONGBOW: { name: '장궁', intervalCooldown: 2, baseShots: 1, baseMultiplier: 3.0, defaultRange: 7 },
    LIGHT_CROSSBOW: { name: '경량 석궁', intervalCooldown: 2, baseShots: 1, baseMultiplier: 3.5, defaultRange: 6 },
    HEAVY_CROSSBOW: { name: '중형 석궁', intervalCooldown: 3, baseShots: 1, baseMultiplier: 4.5, defaultRange: 8 },
    SLING: { name: '슬링', intervalCooldown: 1, baseShots: 1, baseMultiplier: 1.5, defaultRange: 4 }
  }
};

/**
 * 11. ToME 슬레이(Slay) 및 브랜드(Brand) 배율 설정
 */
export const TOME_SLAY_CONFIG = {
  SLAY_ORC:     { name: "오크 학살자", multiplier: 3.0, races: ["ORC"] },
  SLAY_DRAGON:  { name: "용 학살자", multiplier: 4.0, races: ["DRAGON", "HATCHLING"] },
  SLAY_UNDEAD:  { name: "언데드 퇴마", multiplier: 3.0, races: ["LICH", "SKELETON", "ZOMBIE", "GHOST"] },
  SLAY_DEMON:   { name: "악마 멸살", multiplier: 3.5, races: ["IMP", "BALROG", "DEMON"] },
  SLAY_EVIL:    { name: "사악 징벌", multiplier: 2.0, isAlignment: true },
  SLAY_ANIMAL:  { name: "야수 사냥", multiplier: 2.5, races: ["BAT", "SPIDER", "SNAKE", "HOUND"] },
  BRAND_FIRE:   { name: "화염 브랜드", multiplier: 3.0, element: "FIRE" },
  BRAND_COLD:   { name: "냉기 브랜드", multiplier: 3.0, element: "COLD" },
  BRAND_ELEC:   { name: "전기 브랜드", multiplier: 3.0, element: "LIGHTNING" },
  BRAND_ACID:   { name: "산성 브랜드", multiplier: 3.0, element: "ACID" },
  BRAND_POIS:   { name: "맹독 브랜드", multiplier: 2.5, element: "POISON" }
};

/**
 * 12. ToME 2.3.5 몬스터 5대 생태/신체 방어 아키타입 설정
 */
export const MONSTER_DEFENSE_ARCHETYPES = {
  OOZE_JELLY: {
    id: 'OOZE_JELLY',
    name: '연체/유기체형',
    types: ['SLIME', 'JELLY', 'WORM', 'MUD', 'CREEPING_COIN'],
    hitBonus: 10,                 // 부드러운 외피로 인해 공격자 명중 보너스 +10 BTH
    reflectChance: 0.15,          // 15% 물리 타격 반사
    flavorLog: '🟢 [연체 외피] 말랑말랑한 점액질 외피로 인해 타격이 부드럽게 박혀 들어갑니다!'
  },
  AGILE_FLYING: {
    id: 'AGILE_FLYING',
    name: '민첩/비행형',
    types: ['BAT', 'BIRD', 'ROGUE', 'SPIDER', 'FAERIE', 'NINJA'],
    dodgeRate: 0.15,              // 15% 기민한 찰나의 회피 (Agile Dodge)
    flavorLog: '💨 [아슬아슬한 회피] 적이 날렵한 비행/동작으로 공격을 찰나의 순간에 회피했습니다!'
  },
  HEAVY_ARMORED: {
    id: 'HEAVY_ARMORED',
    name: '외골격/중갑형',
    types: ['GOLEM', 'BEETLE', 'KNIGHT', 'CRAB', 'STATUE', 'TURTLE'],
    effectiveAcBonus: 10,         // 단단한 장갑 보너스
    flavorLog: '🛡️ [단단한 외피] 적의 굳건한 외골격 장갑에 무기가 둔탁하게 튕겨나갑니다!'
  },
  ETHEREAL_GHOST: {
    id: 'ETHEREAL_GHOST',
    name: '영체/환영형',
    types: ['GHOST', 'SHADOW', 'WRAITH', 'PHANTOM', 'SPECTRE', 'POLTERGEIST', 'WILL_O_WISP'],
    phaseMissRate: 0.25,          // 물리 일반 무기 25% 위상 통과 빗나감
    flavorLog: '👻 [위상 빗나감] 물리 칼날이 실체 없는 영체를 허공처럼 통과했습니다! (마법/원소 인챈트 필요)'
  },
  COLOSSAL_GIANT: {
    id: 'COLOSSAL_GIANT',
    name: '대형 거수형',
    types: ['DRAGON', 'GIANT', 'OGRE', 'TROLL', 'TITAN', 'COLOSSUS', 'HYDRA'],
    hitBonus: 12,                 // 거대한 피격 면적으로 공격자 명중 보너스 +12 BTH
    damageReductionPct: 0.10,     // 두터운 가죽/비늘로 인한 10% 피해 경감
    flavorLog: '🐉 [거대한 몸집] 거대한 몸집으로 인해 타격이 빗나가지 않고 확실하게 적중합니다!'
  }
};

/**
 * 13. ToME 2.3.5 정통 명중률(To-Hit) 및 방어력(AC) 백분율 연산 설정
 */
export const COMBAT_ACCURACY_CONFIG = {
  BASE_HIT_SCORE: 50,         // 기본 베이스 명중 점수
  LEVEL_HIT_WEIGHT: 2.0,      // 레벨당 명중 점수 가중치 (+2.0/Lv)
  DEX_HIT_WEIGHT: 3.0,        // DEX 수정치당 명중 점수 (+3.0/mod)
  WEAPON_TO_H_WEIGHT: 3.0,    // 무기/강화 to_h 보정당 가중치 (+3.0/to_h)
  MASTERY_HIT_WEIGHT: 1.5,    // 무기 마스터리 레벨당 가중치 (+1.5/Lvl)
  AC_SCALING_FACTOR: 1.0,     // 피격자 AC 스케일링 계수
  MIN_HIT_CHANCE: 0.05,       // 절대 최소 명중률 (5% 펌블 방지)
  MAX_HIT_CHANCE: 0.95        // 절대 최대 명중률 (95% 럭키 닷지 보장)
};

/**
 * ToME 2.3.5 정통 To-Hit vs AC 백분율 명중 확률을 계산합니다.
 * @param {Object|number} paramsOrToHit - { level, dexMod, weaponToH, masteryLevel, targetAC, bonusAcc } 또는 레거시 toHit
 * @param {number} [targetAC=10] - 레거시 호환용 피격자 AC
 * @returns {number} 0.05 ~ 0.95 명중 확률
 */
export function calculateToHitVsAc(paramsOrToHit, targetAC = 10) {
  const cfg = COMBAT_ACCURACY_CONFIG;
  
  if (typeof paramsOrToHit === 'number') {
    const toHit = paramsOrToHit;
    const totalToHit = cfg.BASE_HIT_SCORE + toHit * cfg.WEAPON_TO_H_WEIGHT;
    const hitChance = totalToHit / (totalToHit + Math.max(0, targetAC) * cfg.AC_SCALING_FACTOR);
    return Math.max(cfg.MIN_HIT_CHANCE, Math.min(cfg.MAX_HIT_CHANCE, hitChance));
  }

  const p = paramsOrToHit || {};
  const level = p.level || 1;
  const dexMod = p.dexMod || 0;
  const weaponToH = p.weaponToH || 0;
  const masteryLevel = p.masteryLevel || 1;
  const bonusAcc = p.bonusAcc || 0;
  const ac = Math.max(0, p.targetAC !== undefined ? p.targetAC : targetAC);

  const totalToHit = cfg.BASE_HIT_SCORE + 
                     (level * cfg.LEVEL_HIT_WEIGHT) + 
                     (dexMod * cfg.DEX_HIT_WEIGHT) + 
                     (weaponToH * cfg.WEAPON_TO_H_WEIGHT) + 
                     (masteryLevel * cfg.MASTERY_HIT_WEIGHT) + 
                     bonusAcc;

  const hitChance = totalToHit / (totalToHit + ac * cfg.AC_SCALING_FACTOR);
  return Math.max(cfg.MIN_HIT_CHANCE, Math.min(cfg.MAX_HIT_CHANCE, hitChance));
}

/**
 * DEX 기반 치명타율을 계산합니다 (기본 5% + DEX 보정).
 * @param {number} dex - 민첩 스탯치
 * @param {number} [bonusRate=0] - 추가 치명타율 보정
 * @returns {number} 0.05 ~ 0.50 치명타 확률
 */
export function calculateDexCritChance(dex, bonusRate = 0) {
  const baseRate = 0.05;
  const dexBonus = Math.max(0, (dex - 10) * 0.005); // DEX 1당 +0.5%
  return Math.max(0.05, Math.min(0.50, baseRate + dexBonus + bonusRate));
}

/**
 * STR과 CON 스탯을 기반으로 최대 적재 중량을 계산합니다.
 * @param {number} str - 유효 힘 스탯
 * @param {number} con - 유효 체질 스탯
 * @returns {number} 최대 소지 가능 중량 (kg)
 */
export function calculateMaxWeightLimit(str, con) {
  return Math.floor((str * WEIGHT_CONFIG.strMultiplier) + (con * WEIGHT_CONFIG.conMultiplier));
}

/**
 * 현재 적재량과 최대 한도에 따른 이동 속도 보정 배율을 산출합니다.
 * @param {number} currentWeight - 현재 총 소지 중량
 * @param {number} maxLimit - 최대 한도 중량
 * @returns {number} 속도 배율 (1.0: 정상, 0.7: 중량, 0.4: 과적)
 */
export function calculateSpeedModifier(currentWeight, maxLimit) {
  if (currentWeight >= maxLimit) return WEIGHT_CONFIG.overloadSpeedMultiplier;
  if (currentWeight >= maxLimit * WEIGHT_CONFIG.heavyThreshold) return WEIGHT_CONFIG.heavySpeedMultiplier;
  return 1.0;
}
