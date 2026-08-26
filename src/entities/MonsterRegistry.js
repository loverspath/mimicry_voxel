/**
 * @module MonsterRegistry
 * @category entities
 * @description 몬스터 종족(Species) 및 ToME 오픈소스 몬스터 마스터 데이터셋(851종) 중앙 제어 레지스트리
 * @purity Pure Registry / Data Store
 * @dependencies TomeMonstersData.js
 * @exports MONSTER_GROWTH_PATTERNS, MONSTER_SPECIES, LEGACY_TOME_ALIASES_MAP, getSpeciesConfig, normalizeCoreName, getSpeciesKeyByName
 */
import { TOME_MONSTERS_DATA } from './TomeMonstersData.js';

export { TOME_MONSTERS_DATA };

export const MONSTER_GROWTH_PATTERNS = Object.freeze({
  BALANCED: { str: 1.0, dex: 1.0, con: 1.0, int: 1.0, hp: 1.0 },
  TANK:     { str: 0.8, dex: 0.6, con: 1.6, int: 0.5, hp: 1.8 },
  DPS:      { str: 1.6, dex: 1.2, con: 0.7, int: 0.9, hp: 0.8 },
  SPEEDY:   { str: 0.7, dex: 1.8, con: 0.8, int: 1.0, hp: 0.7 },
  MAGE:     { str: 0.5, dex: 0.8, con: 0.7, int: 1.8, hp: 0.7 },
  BOSS:     { str: 2.0, dex: 1.2, con: 2.0, int: 1.5, hp: 2.5 }
});

export const LEGACY_TOME_ALIASES_MAP = Object.freeze({
  PLAYER: 'MON_NOVICE_WARRIOR',
  HUMAN: 'MON_NOVICE_WARRIOR',
  '인간': 'MON_NOVICE_WARRIOR',
  '인간 여행자': 'MON_NOVICE_WARRIOR',
  '인간 여성 여행자': 'MON_NOVICE_WARRIOR',
  IMP: 'MON_HOMUNCULUS',
  '임프': 'MON_HOMUNCULUS',
  GOBLIN: 'MON_SMALL_KOBOLD',
  '고블린': 'MON_SMALL_KOBOLD',
  '고블린 전사': 'MON_SMALL_KOBOLD',
  SLIME: 'MON_GREEN_OOZE',
  '슬라임': 'MON_GREEN_OOZE',
  '초록 슬라임': 'MON_GREEN_OOZE',
  BAT: 'MON_FRUIT_BAT',
  '박쥐': 'MON_FRUIT_BAT',
  '과일박쥐': 'MON_FRUIT_BAT',
  ORC: 'MON_HILL_ORC',
  '오크': 'MON_HILL_ORC',
  '오크 돌격병': 'MON_HILL_ORC',
  OGRE: 'MON_OGRE',
  '오우거': 'MON_OGRE',
  HATCHLING: 'MON_BABY_RED_DRAGON',
  '해츨링': 'MON_BABY_RED_DRAGON',
  '드래곤 해츨링': 'MON_BABY_RED_DRAGON',
  DRAGON: 'MON_MATURE_RED_DRAGON',
  '드래곤': 'MON_MATURE_RED_DRAGON',
  '성체 드래곤': 'MON_MATURE_RED_DRAGON',
  ANGEL: 'MON_ANGEL',
  '천사': 'MON_ANGEL',
  '하급천사': 'MON_ANGEL',
  TITAN: 'MON_LESSER_TITAN',
  '타이탄': 'MON_LESSER_TITAN',
  '레서 타이탄': 'MON_LESSER_TITAN',
  TROLL: 'MON_FOREST_TROLL',
  '트롤': 'MON_FOREST_TROLL',
  '포레스트 트롤': 'MON_FOREST_TROLL'
});

// Name-to-Key Cache for O(1) Lookups across all 851 monsters
const _NAME_TO_KEY_CACHE = new Map();
function initNameToKeyCache() {
  if (_NAME_TO_KEY_CACHE.size > 0) return;
  for (const [key, data] of Object.entries(TOME_MONSTERS_DATA)) {
    _NAME_TO_KEY_CACHE.set(key.toUpperCase(), key);
    if (data.name) {
      _NAME_TO_KEY_CACHE.set(data.name.toUpperCase(), key);
    }
  }
}

/**
 * Retrieves the species config by its type or key (e.g. 'SLIME', 'MON_BALROG', 'Greater Balrog').
 * 100% Data-Oriented: Resolves directly from TOME_MONSTERS_DATA (851 species).
 * @param {string} type 
 * @returns {Object} Species configuration object
 */
export function getSpeciesConfig(type) {
  initNameToKeyCache();

  let resolvedKey = type;
  if (!resolvedKey) resolvedKey = 'MON_NOVICE_WARRIOR';

  if (typeof resolvedKey === 'string') {
    const up = resolvedKey.toUpperCase();
    if (LEGACY_TOME_ALIASES_MAP[resolvedKey]) {
      resolvedKey = LEGACY_TOME_ALIASES_MAP[resolvedKey];
    } else if (LEGACY_TOME_ALIASES_MAP[up]) {
      resolvedKey = LEGACY_TOME_ALIASES_MAP[up];
    } else if (_NAME_TO_KEY_CACHE.has(up)) {
      resolvedKey = _NAME_TO_KEY_CACHE.get(up);
    }
  }

  // 1. Resolve from 851 ToME Master Monsters (Primary Single Source of Truth)
  if (TOME_MONSTERS_DATA && TOME_MONSTERS_DATA[resolvedKey]) {
    const tm = TOME_MONSTERS_DATA[resolvedKey];
    const attacks = (tm.attacks || tm.blows || []).map(a => ({
      method: a.method || "HIT",
      effect: a.effect || "HURT",
      dice: a.damage || a.dice || "1d4"
    }));

    let lightBonus = 0;
    if (tm.flags) {
      if (tm.flags.includes('LITE3')) lightBonus = 3;
      else if (tm.flags.includes('LITE2')) lightBonus = 2;
      else if (tm.flags.includes('LITE') || tm.flags.includes('LITE1') || tm.flags.includes('HAS_LITE')) lightBonus = 1;
    }

    return {
      coreType: tm.key,
      name: tm.name,
      displayName: tm.name,
      char: tm.char,
      baseColor: tm.baseColor || '#cbd5e1',
      flashColor: '#ef4444',
      flashInterval: 1000,
      flashDuration: 100,
      lightBonus,
      coreBase: tm.coreBase || { str: 10, int: 10, wis: 10, dex: 10, con: 10, chr: 10, cha: 10 },
      coreMax: tm.coreMax || { str: 200, int: 200, wis: 200, dex: 200, con: 200, chr: 200, cha: 200 },
      coreBaseHp: tm.coreBaseHp || 20,
      xpValue: tm.exp || Math.max(10, (tm.level || 1) * 15),
      baseAC: tm.baseAC || tm.ac || 10,
      traitDesc: `ToME 레벨 ${tm.level || 1} ${tm.growthType || '일반'} 생명체`,
      statInfoText: `힘 ${tm.coreBase?.str || 10}, 지능 ${tm.coreBase?.int || 10}, 지혜 ${tm.coreBase?.wis || 10}, 민첩 ${tm.coreBase?.dex || 10}, 생명력 ${tm.coreBase?.con || 10}, 매력 ${tm.coreBase?.chr || 10}`,
      growthType: tm.growthType || 'BALANCED',
      aiPattern: tm.aiPattern || ((tm.breathElement || (tm.flags && tm.flags.some(f => f && f.startsWith('BREATH_')))) ? 'BREATH' : ((tm.flags && tm.flags.includes('RAND_25')) ? 'FLEE' : 'STANDARD')),
      breathElement: tm.breathElement || null,
      perks: tm.flags || [],
      flags: tm.flags || [],
      spells: tm.spells || [],
      attacks: attacks.length > 0 ? attacks : [{ method: "HIT", effect: "HURT", damage: "1d4" }],
      blows: attacks.length > 0 ? attacks : [{ method: "HIT", effect: "HURT", dice: "1d4" }],
      flavorText: tm.flavorText || tm.description || "A creature lurking in the depths of ToME.",
      themeColors: { bg: 'rgba(255,255,255,0.05)', text: tm.baseColor || '#cbd5e1' }
    };
  }

  // Sensible default fallback
  return {
    coreType: type || 'MON_NOVICE_WARRIOR',
    name: '인간 여행자',
    displayName: '인간 여행자',
    char: '@',
    baseColor: '#34d399',
    flashColor: '#ef4444',
    flashInterval: 1000,
    flashDuration: 100,
    lightBonus: 0,
    coreBase: { str: 10, dex: 10, con: 10, int: 10, wis: 10, chr: 10, cha: 10 },
    coreMax: { str: 150, dex: 150, con: 150, int: 150, wis: 150, chr: 150, cha: 150 },
    coreBaseHp: 18,
    xpValue: 15,
    baseAC: 10,
    traitDesc: '기본 생명체',
    statInfoText: '힘 10, 민첩 10, 생명력 10, 지능 10',
    growthType: 'BALANCED',
    aiPattern: 'STANDARD',
    breathElement: null,
    perks: [],
    flags: [],
    spells: [],
    attacks: [{ method: "HIT", effect: "HURT", damage: "1d4" }],
    blows: [{ method: "HIT", effect: "HURT", dice: "1d4" }],
    flavorText: "A traveler in the subterranean depths.",
    themeColors: { bg: 'rgba(255,255,255,0.05)', text: '#34d399' }
  };
}

/**
 * Proxy-backed MONSTER_SPECIES registry dynamically connected to all 851 ToME monsters.
 * Zero hardcoded lambdas or static object literals.
 */
export const MONSTER_SPECIES = new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (prop === 'then' || prop === 'toJSON') return undefined;
    return getSpeciesConfig(prop);
  },
  has(target, prop) {
    if (typeof prop !== 'string') return false;
    const up = prop.toUpperCase();
    return Boolean(TOME_MONSTERS_DATA[prop] || LEGACY_TOME_ALIASES_MAP[prop] || LEGACY_TOME_ALIASES_MAP[up] || _NAME_TO_KEY_CACHE.has(up));
  },
  ownKeys() {
    return Object.keys(TOME_MONSTERS_DATA);
  },
  getOwnPropertyDescriptor(target, prop) {
    return {
      enumerable: true,
      configurable: true,
      value: getSpeciesConfig(prop)
    };
  }
});

/**
 * 몬스터 종족명(한글/영문/포함관계)을 표준 이름 카테고리명으로 단일 규격화합니다.
 */
export function normalizeCoreName(name) {
  if (!name) return "인간 여행자";
  const config = getSpeciesConfig(name);
  return config ? config.name : name;
}

/**
 * 몬스터 종족 이름으로부터 영문 설정 Key(예: 'MON_HILL_ORC')를 동적으로 조회합니다.
 */
export function getSpeciesKeyByName(name) {
  if (!name) return 'MON_NOVICE_WARRIOR';
  const config = getSpeciesConfig(name);
  return config ? config.coreType : 'MON_NOVICE_WARRIOR';
}
