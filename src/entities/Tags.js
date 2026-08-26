/**
 * @module Tags
 * @description 장비 및 몬스터에 적용되는 접두사(Prefix)와 접미사(Suffix) 태그 시스템 정의 모듈. 등급 색상, 크로매틱 애니메이션 연산, 무작위 롤링 함수 및 원소 메타데이터(ELEMENT_METADATA)를 통합 관리합니다.
 * @dependency 없음
 */
export const PREFIX_TAGS = {
  FIRE: { 
    name: "불타는", 
    rarity: "uncommon", 
    stats: { str: 2 }, 
    element: "FIRE", 
    desc: "화염 피해 추가 & 화염 저항",
    colors: ["#ef4444", "#f97316", "#facc15"], // Red, Orange, Yellow
    synergyTags: ["FIRE_MELEE", "FIRE_RESIST"]
  },
  COLD: { 
    name: "얼어붙은", 
    rarity: "uncommon", 
    stats: { con: 2 }, 
    element: "COLD", 
    desc: "냉기 피해 추가 & 냉기 저항",
    colors: ["#38bdf8", "#0ea5e9", "#e0f2fe"], // Sky Blue, Ocean Blue, Soft White
    synergyTags: ["COLD_MELEE", "COLD_RESIST"]
  },
  LIGHTNING: { 
    name: "짜릿한", 
    rarity: "uncommon", 
    stats: { dex: 2 }, 
    element: "LIGHTNING", 
    desc: "전기 피해 추가 & 전기 저항",
    colors: ["#eab308", "#a855f7", "#ffffff"], // Bright Yellow, Spark Purple, White
    synergyTags: ["LIGHTNING_MELEE", "LIGHTNING_RESIST"]
  },
  TOXIC: { 
    name: "맹독의", 
    rarity: "uncommon", 
    stats: { int: 2 }, 
    element: "ACID", 
    desc: "산성 피해 추가 & 산성 저항",
    colors: ["#22c55e", "#a3e635", "#15803d"], // Green, Lime, Dark Green
    synergyTags: ["ACID_MELEE", "ACID_RESIST"]
  },
  MANA: {
    name: "마나의",
    rarity: "rare",
    stats: { int: 3 },
    element: "MANA",
    desc: "마나 피해 추가 & 마나 저항 (마법 취약 유발)",
    colors: ["#60a5fa", "#a78bfa", "#c084fc"], // Arcane Blue, Lavender, Violet
    synergyTags: ["MANA_MELEE", "MANA_RESIST"]
  },
  IRON: { 
    name: "강철의", 
    rarity: "uncommon", 
    stats: { con: 4, dex: -1 }, 
    desc: "방어력 크게 상승, 속도 약간 감소",
    colors: ["#94a3b8", "#cbd5e1", "#64748b"], // Slate, Silver, Muted Steel
    synergyTags: ["CON_BOOST", "PHYS_RESIST"]
  },
  FURIOUS: { 
    name: "광폭한", 
    rarity: "rare", 
    stats: { str: 5, dex: 3, con: -2 }, 
    desc: "공격력/속도 대폭 상승, 체력 감소",
    colors: ["#dc2626", "#f97316", "#7f1d1d"], // Crimson, Orange-Red, Maroon
    synergyTags: ["STR_BOOST", "DEX_BOOST"]
  },
  BLOODTHIRSTY: { 
    name: "피에 굶주린", 
    rarity: "epic", 
    stats: { str: 8, dex: 4 }, 
    desc: "공격력 및 가속 상승, 생명력 흡수",
    colors: ["#991b1b", "#ef4444", "#450a0a"], // Deep Blood, Bright Crimson, Dark Obsidian
    synergyTags: ["STR_BOOST", "DEX_BOOST", "LIFESTEAL", "LIFESTEAL", "LIFESTEAL"]
  },
  IMMORTAL: { 
    name: "불멸의", 
    rarity: "epic", 
    stats: { con: 12 }, 
    desc: "생명력 스탯 대폭 상승 및 물리 피해 고정 감쇄 태그(PHYS_RESIST) 2회 획득",
    colors: ["#fbbf24", "#fef08a", "#ffffff"], // Golden, Yellow, Celestial White
    synergyTags: ["CON_BOOST", "PHYS_RESIST", "PHYS_RESIST"]
  }
};

export const SUFFIX_TAGS = {
  SLAYER: { 
    name: "학살자", 
    rarity: "uncommon", 
    stats: { str: 3 }, 
    desc: "물리 피해 증가",
    colors: ["#b91c1c", "#f87171", "#7f1d1d"], // Killer Red, Rose, Blood Red
    synergyTags: ["STR_BOOST", "PHYS_MELEE"]
  },
  GALE: { 
    name: "바람구두", 
    rarity: "uncommon", 
    stats: { dex: 3 }, 
    desc: "행동 속도가 충전되는 가속 태그(HASTE_UNIT)를 1회 획득합니다.",
    colors: ["#2dd4bf", "#99f6e4", "#0d9488"], // Teal, Mint, Emerald Deep
    synergyTags: ["DEX_BOOST", "HASTE_UNIT"]
  },
  AEGIS: { 
    name: "철벽", 
    rarity: "uncommon", 
    stats: { con: 3 }, 
    desc: "생명력 스탯 상승 및 물리 피해 고정 감쇄 태그(PHYS_RESIST) 1회 획득",
    colors: ["#3b82f6", "#60a5fa", "#1e3a8a"], // Blue, Sky Blue, Royal Navy
    synergyTags: ["CON_BOOST", "PHYS_RESIST"]
  },
  SAGE: { 
    name: "현자", 
    rarity: "uncommon", 
    stats: { int: 4 }, 
    desc: "지능 상승",
    colors: ["#a855f7", "#c084fc", "#ffffff"], // Mystic Purple, Violet, White
    synergyTags: ["INT_BOOST", "MAGIC_BOOST"]
  },
  BLOODLUST: { 
    name: "피갈망", 
    rarity: "rare", 
    stats: { str: 4, con: 2 }, 
    desc: "생명력 흡수 및 공격력 상승",
    colors: ["#dc2626", "#ef4444", "#7f1d1d"], // Crimson, Bright Red, Dark Crimson
    synergyTags: ["STR_BOOST", "LIFESTEAL", "LIFESTEAL"]
  },
  FLURRY: { 
    name: "난무", 
    rarity: "rare", 
    stats: { dex: 3, str: 2 }, 
    desc: "밀리 공격 시 추가 공격 태그(STRIKE_UNIT)를 1회 획득합니다.",
    colors: ["#f43f5e", "#fb7185", "#fda4af"], // Rose, Light Rose, Pink
    synergyTags: ["STRIKE_UNIT", "DEX_BOOST"]
  },
  FOCUS: {
    name: "집중",
    rarity: "rare",
    stats: { int: 3 },
    desc: "지능 기반 최종 스킬 피해량 +20% 시너지 증폭 (중첩 가능)",
    colors: ["#60a5fa", "#3b82f6", "#1d4ed8"], // Blue, Deep Blue
    synergyTags: ["FOCUS", "INT_BOOST"]
  },
  QUICKCAST: {
    name: "신속",
    rarity: "rare",
    stats: { dex: 3 },
    desc: "쿨다운 회복 +1턴 가속 및 기본 대기시간 -20% 단축 (중첩 가능)",
    colors: ["#fbbf24", "#f59e0b", "#d97706"], // Amber, Gold
    synergyTags: ["QUICKCAST", "SPEED_BOOST"]
  },
  SHADOW: { 
    name: "심연", 
    rarity: "epic", 
    stats: { str: 5, dex: 5, con: 5, int: 5 }, 
    desc: "모든 스탯 절대 상승",
    colors: ["#4f46e5", "#818cf8", "#030712"], // Royal Indigo, Lilac, Pitch Black
    synergyTags: ["STR_BOOST", "DEX_BOOST", "CON_BOOST", "INT_BOOST"]
  },
  WARRIOR: {
    name: "전사",
    rarity: "uncommon",
    isJob: true,
    stats: { str: 4, con: 2 },
    desc: "전술 물리 강화 및 물리 피해 고정 감쇄 태그(PHYS_RESIST) 1회 획득",
    colors: ["#cbd5e1", "#f87171", "#7f1d1d"], // Slate, Red, Maroon
    synergyTags: ["JOB_WARRIOR", "PHYS_RESIST"]
  },
  MAGE: {
    name: "마법사",
    rarity: "uncommon",
    isJob: true,
    stats: { int: 5, dex: 1 },
    desc: "강력한 파괴 주문을 다루는 마법사 클래스",
    colors: ["#c084fc", "#60a5fa", "#ffffff"], // Violet, Arcane Blue, White
    synergyTags: ["JOB_MAGE"]
  },
  SHAMAN: {
    name: "샤먼",
    rarity: "uncommon",
    isJob: true,
    stats: { int: 2, con: 4 },
    desc: "대자연의 치유 토템과 정령의 피의 갈망을 다루는 샤먼 클래스",
    colors: ["#34d399", "#fb923c", "#a78bfa"], // Emerald, Orange, Lavender
    synergyTags: ["JOB_SHAMAN"]
  },
  PRIEST: {
    name: "사제",
    rarity: "uncommon",
    isJob: true,
    stats: { int: 5 },
    desc: "아군을 수호하고 강력한 신성 광역 회복을 시전하는 사제 클래스",
    colors: ["#ffffff", "#fef08a", "#e2e8f0"], // Celestial White, Gold, Silver
    synergyTags: ["JOB_PRIEST"]
  },
  CHAMPION: {
    name: "챔피언",
    rarity: "rare",
    isJob: true,
    stats: { str: 6, dex: 4, con: 4 },
    desc: "종합 전투력 대폭 강화 및 물리 피해 고정 감쇄 태그(PHYS_RESIST) 2회 획득",
    colors: ["#fbbf24", "#ef4444", "#facc15"], // Gold, Crimson, Yellow
    synergyTags: ["JOB_CHAMPION", "PHYS_RESIST", "PHYS_RESIST"]
  },
  CHIEFTAIN: {
    name: "치프틴",
    rarity: "epic",
    isJob: true,
    stats: { str: 8, con: 8 },
    desc: "압도적 힘/생명력 특화 및 물리 피해 고정 감쇄 태그(PHYS_RESIST) 3회 획득",
    colors: ["#a855f7", "#ec4899", "#f43f5e"], // Purple, Deep Pink, Rose
    synergyTags: ["JOB_CHIEFTAIN", "PHYS_RESIST", "PHYS_RESIST", "PHYS_RESIST"]
  }
};

/**
 * Gets the color hex code for rendering entity name based on rarity level.
 * @param {string} rarity - Rarity level ('uncommon', 'rare', 'epic')
 * @returns {string} Hex color code
 */
export function getRarityColor(rarity) {
  if (rarity === 'uncommon') return '#34d399'; // Emerald Green
  if (rarity === 'rare') return '#38bdf8';     // Sky Blue
  if (rarity === 'epic') return '#a855f7';     // Purple
  return '#e2e8f0';                            // Standard main text color
}

/**
 * Gets a dynamically cycling color based on active prefix/suffix tags.
 * If multiple tags exist, cycles through all tag colors.
 * If no tag colors exist but the item/monster has rarity, returns the rarity color.
 * Otherwise, falls back to baseColor.
 * @param {Array<string>} prefixes 
 * @param {Array<string>} suffixes 
 * @param {string} baseColor 
 * @returns {string} Hex color code
 */
export function getChromaticColor(prefixes = [], suffixes = [], baseColor = '#e2e8f0') {
  const activeColors = [];
  
  for (const pKey of prefixes) {
    const tag = PREFIX_TAGS[pKey];
    if (tag && tag.colors) {
      activeColors.push(...tag.colors);
    }
  }
  
  for (const sKey of suffixes) {
    const tag = SUFFIX_TAGS[sKey];
    if (tag && tag.colors) {
      activeColors.push(...tag.colors);
    }
  }
  
  if (activeColors.length > 0) {
    // 250ms interval cycle per color
    const index = Math.floor((Date.now() / 250) % activeColors.length);
    return activeColors[index];
  }
  
  const rarity = determineRarity(prefixes, suffixes);
  if (rarity !== 'normal') {
    return getRarityColor(rarity);
  }
  
  return baseColor;
}

/**
 * Determines the rarity of a tag combination.
 * @param {Array<string>} prefixes 
 * @param {Array<string>} suffixes 
 * @returns {string} 'normal' | 'uncommon' | 'rare' | 'epic'
 */
export function determineRarity(prefixes = [], suffixes = []) {
  let isEpic = false;
  let isRare = false;
  let isUncommon = false;

  const checkEpic = (key) => {
    return PREFIX_TAGS[key]?.rarity === 'epic' || SUFFIX_TAGS[key]?.rarity === 'epic';
  };
  const checkRare = (key) => {
    return PREFIX_TAGS[key]?.rarity === 'rare' || SUFFIX_TAGS[key]?.rarity === 'rare';
  };

  // 3+ tags or any Epic tag makes it Epic
  if (prefixes.length + suffixes.length >= 3 || prefixes.some(checkEpic) || suffixes.some(checkEpic)) {
    return 'epic';
  }
  // 2 tags or any Rare tag makes it Rare
  if (prefixes.length + suffixes.length === 2 || prefixes.some(checkRare) || suffixes.some(checkRare)) {
    return 'rare';
  }
  // 1 tag makes it Uncommon
  if (prefixes.length + suffixes.length === 1) {
    return 'uncommon';
  }
  return 'normal';
}

/**
 * Roll prefix and suffix tags based on floor danger level with strict Tier Gating.
 * Danger <= 3.8 (Floor 1~5) strictly blocks RARE and EPIC affixes and caps odds to 5%.
 * @param {number} danger - Danger scaling level
 * @returns {Object} { prefixes: Array<string>, suffixes: Array<string> }
 */
export function rollTags(danger = 1) {
  const isTier1 = danger <= 3.85;
  const isTier2 = danger > 3.85 && danger <= 12.0;

  let pOdds = isTier1 ? Math.min(0.05, danger * 0.012) : Math.min(0.8, 0.05 + danger * 0.04);
  let rOdds = isTier1 ? 0 : (isTier2 ? Math.min(0.20, danger * 0.015) : Math.min(0.4, 0.01 + danger * 0.02));
  let eOdds = (isTier1 || isTier2) ? 0 : Math.min(0.18, 0.002 + danger * 0.008);

  const roll = Math.random();
  let rarity = 'normal';
  
  if (roll < eOdds) {
    rarity = 'epic';
  } else if (roll < rOdds) {
    rarity = 'rare';
  } else if (roll < pOdds) {
    rarity = 'uncommon';
  }
  
  if (rarity === 'normal') {
    return { prefixes: [], suffixes: [] };
  }
  
  const getKeysByRarity = (tagObj, tier) => {
    return Object.keys(tagObj).filter(key => tagObj[key].rarity === tier);
  };
  
  const selectedPrefixes = [];
  const selectedSuffixes = [];
  
  if (rarity === 'uncommon') {
    const uncop = getKeysByRarity(PREFIX_TAGS, 'uncommon');
    const uncos = getKeysByRarity(SUFFIX_TAGS, 'uncommon').filter(k => !['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'].includes(k));
    if (Math.random() < 0.5 && uncop.length > 0) {
      selectedPrefixes.push(uncop[Math.floor(Math.random() * uncop.length)]);
    } else if (uncos.length > 0) {
      selectedSuffixes.push(uncos[Math.floor(Math.random() * uncos.length)]);
    }
  } else if (rarity === 'rare') {
    if (Math.random() < 0.4) {
      const rarep = getKeysByRarity(PREFIX_TAGS, 'rare');
      const rares = getKeysByRarity(SUFFIX_TAGS, 'rare').filter(k => !['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'].includes(k));
      if (Math.random() < 0.5 && rarep.length > 0) {
        selectedPrefixes.push(rarep[Math.floor(Math.random() * rarep.length)]);
      } else if (rares.length > 0) {
        selectedSuffixes.push(rares[Math.floor(Math.random() * rares.length)]);
      }
    } else {
      const uncop = getKeysByRarity(PREFIX_TAGS, 'uncommon');
      const uncos = getKeysByRarity(SUFFIX_TAGS, 'uncommon').filter(k => !['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'].includes(k));
      if (uncop.length > 0) selectedPrefixes.push(uncop[Math.floor(Math.random() * uncop.length)]);
      if (uncos.length > 0) selectedSuffixes.push(uncos[Math.floor(Math.random() * uncos.length)]);
    }
  } else if (rarity === 'epic') {
    if (Math.random() < 0.6) {
      const epicp = getKeysByRarity(PREFIX_TAGS, 'epic');
      const epics = getKeysByRarity(SUFFIX_TAGS, 'epic').filter(k => !['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'].includes(k));
      if (Math.random() < 0.5 && epicp.length > 0) {
        selectedPrefixes.push(epicp[Math.floor(Math.random() * epicp.length)]);
      } else if (epics.length > 0) {
        selectedSuffixes.push(epics[Math.floor(Math.random() * epics.length)]);
      }
    } else {
      const allPrefixes = Object.keys(PREFIX_TAGS);
      const allSuffixes = Object.keys(SUFFIX_TAGS).filter(k => !['WARRIOR', 'MAGE', 'SHAMAN', 'PRIEST', 'CHAMPION', 'CHIEFTAIN'].includes(k));
      
      const p1 = allPrefixes[Math.floor(Math.random() * allPrefixes.length)];
      selectedPrefixes.push(p1);
      
      const s1 = allSuffixes[Math.floor(Math.random() * allSuffixes.length)];
      selectedSuffixes.push(s1);
      
      if (Math.random() < 0.5) {
        const remainingPrefixes = allPrefixes.filter(p => p !== p1);
        if (remainingPrefixes.length > 0) {
          selectedPrefixes.push(remainingPrefixes[Math.floor(Math.random() * remainingPrefixes.length)]);
        }
      } else {
        const remainingSuffixes = allSuffixes.filter(s => s !== s1);
        if (remainingSuffixes.length > 0) {
          selectedSuffixes.push(remainingSuffixes[Math.floor(Math.random() * remainingSuffixes.length)]);
        }
      }
    }
  }
  
  return {
    prefixes: Array.from(new Set(selectedPrefixes)),
    suffixes: Array.from(new Set(selectedSuffixes))
  };
}

export const ELEMENT_METADATA = {
  FIRE: { name: "화염", color: "#ef4444", particleColor: "#ff4500" },
  COLD: { name: "냉기", color: "#38bdf8", particleColor: "#00bfff" },
  LIGHTNING: { name: "전기", color: "#eab308", particleColor: "#ffff00" },
  ACID: { name: "산성", color: "#22c55e", particleColor: "#32cd32" },
  MANA: { name: "마나", color: "#60a5fa", particleColor: "#a78bfa" },
  MAGIC: { name: "마법", color: "#fb7185", particleColor: "#ffc0cb" },
  APOCALYPSE: { name: "종말", color: "#a855f7", particleColor: "#8b008d" }

};

/**
 * Roll a single specialized monster job suffix based on danger scaling with Tier Gating.
 * Floor 1~11 (danger < 7.6): CHAMPION is strictly blocked.
 * Floor 1~24 (danger < 14.8): CHIEFTAIN is strictly blocked.
 * @param {number} danger - Danger scaling level
 * @returns {string|null} Rolled job suffix key, or null
 */
export function rollJobSuffix(danger = 1) {
  const jobChance = Math.min(0.45, 0.10 + danger * 0.025);
  if (Math.random() > jobChance) return null;

  const jobs = [];
  jobs.push({ key: "WARRIOR", weight: 30 });
  jobs.push({ key: "MAGE", weight: 25 });
  jobs.push({ key: "SHAMAN", weight: 20 });
  jobs.push({ key: "PRIEST", weight: 25 });

  // 1~11층 CHAMPION 차단 (12F+, danger >= 7.6에서만 해금)
  if (danger >= 7.6) {
    jobs.push({ key: "CHAMPION", weight: 15 + danger * 1.5 });
  }
  // 1~24층 CHIEFTAIN 차단 (25F+, danger >= 14.7에서만 해금)
  if (danger >= 14.7) {
    jobs.push({ key: "CHIEFTAIN", weight: 8 + danger * 1.2 });
  }

  const totalWeight = jobs.reduce((sum, j) => sum + j.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const job of jobs) {
    roll -= job.weight;
    if (roll <= 0) return job.key;
  }
  return "WARRIOR";
}

export const SYNERGY_TAG_REGISTRY = {
  PHYS_RESIST: {
    displayName: "물리 절대 감쇄",
    category: "DEFENSE",
    themeColor: "#10b981",
    formatValue: (stacks, entity) => {
      const conVal = entity.getEffectiveStat ? entity.getEffectiveStat('con') : entity.stats.con;
      const conMod = Math.floor(conVal / 10);
      const flatPerStack = 1 + Math.floor(conMod * 0.5);
      return `-${stacks * flatPerStack} HP (스택당 ${flatPerStack})`;
    }
  },
  REGEN_UNIT: {
    displayName: "자연 재생 (REGEN)",
    category: "DEFENSE",
    themeColor: "#34d399",
    formatValue: (stacks, entity) => {
      const conVal = entity.getEffectiveStat ? entity.getEffectiveStat('con') : entity.stats.con;
      const conMod = Math.floor(conVal / 10);
      const regenAmt = stacks * (1 + Math.floor(conMod * 0.1));
      return `+${regenAmt} HP/턴`;
    }
  },
  WAIT_HEAL: {
    displayName: "대기 재생 (REST)",
    category: "DEFENSE",
    themeColor: "#059669",
    formatValue: (stacks, entity) => {
      const conVal = entity.getEffectiveStat ? entity.getEffectiveStat('con') : entity.stats.con;
      const conMod = Math.floor(conVal / 10);
      const waitAmt = stacks * (1 + Math.floor(conMod * 0.2));
      return `+${waitAmt} HP/대기`;
    }
  },
  LIFESTEAL: {
    displayName: "생명력 흡수",
    category: "DEFENSE",
    themeColor: "#f43f5e",
    formatValue: (stacks) => `최종 피해의 ${stacks * 5}% 회복`
  },
  HASTE_UNIT: {
    displayName: "행동 속도 가속",
    category: "VELOCITY",
    themeColor: "#38bdf8",
    formatValue: (stacks) => `틱당 +${stacks * 15}% 행동 속도`
  },
  QUICKCAST: {
    displayName: "스킬 신속 가속",
    category: "VELOCITY",
    themeColor: "#fbbf24",
    formatValue: (stacks) => `쿨다운 회복 +${stacks}턴/턴 및 대기시간 -${((1 - Math.pow(0.8, stacks)) * 100).toFixed(0)}% 단축`
  },
  FOCUS: {
    displayName: "스킬 최종 집중",
    category: "OFFENSE",
    themeColor: "#60a5fa",
    formatValue: (stacks) => `지능 기반 최종 주문 피해량 +${stacks * 20}% 증폭`
  },
  APOCALYPSE: {
    displayName: "추가 종말 파멸",
    category: "OFFENSE",
    themeColor: "#ef4444",
    formatValue: (stacks) => `평타 적중 시 ${stacks * 2}d4 종말 절대 피해`
  },
  STRIKE_UNIT: {
    displayName: "추가 물리 타격",
    category: "OFFENSE",
    themeColor: "#ec4899",
    formatValue: (stacks) => `일반 평타 시 타격 횟수 +${Math.min(6, stacks)}회`
  },
  CRIT_UNIT: {
    displayName: "치명타 예리함",
    category: "OFFENSE",
    themeColor: "#eab308",
    formatValue: (stacks) => `치명 임계 요구 눈금 ${Math.max(15, 20 - stacks)}+ (배율 x${(1.5 + stacks * 0.15).toFixed(2)})`
  },
  FIRE_RESIST: { displayName: "화염 속성 저항", category: "RESISTANCE", themeColor: "#f43f5e", formatValue: (stacks) => `${Math.min(75, stacks * 15)}% 경감` },
  COLD_RESIST: { displayName: "냉기 속성 저항", category: "RESISTANCE", themeColor: "#38bdf8", formatValue: (stacks) => `${Math.min(75, stacks * 15)}% 경감` },
  LIGHTNING_RESIST: { displayName: "전기 속성 저항", category: "RESISTANCE", themeColor: "#eab308", formatValue: (stacks) => `${Math.min(75, stacks * 15)}% 경감` },
  ACID_RESIST: { displayName: "산성 속성 저항", category: "RESISTANCE", themeColor: "#34d399", formatValue: (stacks) => `${Math.min(75, stacks * 15)}% 경감` },
  MANA_RESIST: { displayName: "마나 속성 저항", category: "RESISTANCE", themeColor: "#a78bfa", formatValue: (stacks) => `${Math.min(75, stacks * 15)}% 경감` },
  FIRE_MELEE: { displayName: "화염 속성 추가 타격", category: "ELEMENTAL_DMG", themeColor: "#f43f5e", formatValue: (stacks) => `타격 시 +${stacks}d4 (INT 비례) 및 5스택 화염 대폭발` },
  COLD_MELEE: { displayName: "냉기 속성 추가 타격", category: "ELEMENTAL_DMG", themeColor: "#38bdf8", formatValue: (stacks) => `타격 시 +${stacks}d4 (INT 비례) 및 5스택 완동결` },
  LIGHTNING_MELEE: { displayName: "전기 속성 추가 타격", category: "ELEMENTAL_DMG", themeColor: "#eab308", formatValue: (stacks) => `타격 시 +${stacks}d4 (INT/감전비례) 및 5스택 연쇄낙뢰` },
  ACID_MELEE: { displayName: "산성 속성 추가 타격", category: "ELEMENTAL_DMG", themeColor: "#34d399", formatValue: (stacks) => `타격 시 +${stacks}d4 (INT 비례) 및 5스택 AC 영구삭감` },
  MANA_MELEE: { displayName: "마나 속성 추가 타격", category: "ELEMENTAL_DMG", themeColor: "#a78bfa", formatValue: (stacks) => `타격 시 +${stacks}d4 (INT 비례) 및 5스택 비전파열` },
  
  INT_BOOST: { displayName: "지능 스탯 증폭", category: "DEFENSE", themeColor: "#c084fc", formatValue: (stacks) => `지능(INT) 스탯 +${stacks * 10}% 증폭` },
  STR_BOOST: { displayName: "힘 스탯 증폭", category: "DEFENSE", themeColor: "#ef4444", formatValue: (stacks) => `힘(STR) 스탯 +${stacks * 10}% 증폭` },
  DEX_BOOST: { displayName: "민첩 스탯 증폭", category: "DEFENSE", themeColor: "#38bdf8", formatValue: (stacks) => `민첩(DEX) 스탯 +${stacks * 10}% 증폭` },
  CON_BOOST: { displayName: "생명력 스탯 증폭", category: "DEFENSE", themeColor: "#34d399", formatValue: (stacks) => `생명력(CON) 스탯 +${stacks * 10}% 증폭` },
  SPEED_BOOST: { displayName: "행동 가속 보정", category: "VELOCITY", themeColor: "#fbbf24", formatValue: (stacks) => `행동 속도 가산 +${stacks * 10}%` },
  PHYS_MELEE: { displayName: "추가 물리 피해", category: "OFFENSE", themeColor: "#fb7185", formatValue: (stacks) => `물리 타격 시 +${stacks * 3} 고정 추가 피해` },
  MAGIC_BOOST: { displayName: "추가 마법 피해", category: "OFFENSE", themeColor: "#a78bfa", formatValue: (stacks) => `마법 타격 시 +${stacks * 3} 고정 추가 피해` },
  CURSE_BOOST: { displayName: "약화 확률 증폭", category: "OFFENSE", themeColor: "#fda4af", formatValue: (stacks) => `타격 시 ${stacks * 25}% 확률로 마법 취약 부여` },
  
  JOB_WARRIOR: { displayName: "전사 클래스 시너지", category: "OFFENSE", themeColor: "#f87171", formatValue: (stacks) => `전술 물리 공격 보정 (중합: ${stacks})` },
  JOB_MAGE: { displayName: "마법사 클래스 시너지", category: "OFFENSE", themeColor: "#c084fc", formatValue: (stacks) => `주문 극대화 마법 공격 보정 (중합: ${stacks})` },
  JOB_SHAMAN: { displayName: "샤먼 클래스 시너지", category: "OFFENSE", themeColor: "#fb923c", formatValue: (stacks) => `원소 정령 분노 피갈망 활성 (중합: ${stacks})` },
  JOB_PRIEST: { displayName: "사제 클래스 시너지", category: "DEFENSE", themeColor: "#ffffff", formatValue: (stacks) => `성스러운 가호 신성 복구 활성 (중합: ${stacks})` },
  JOB_CHAMPION: { displayName: "챔피언 클래스 시너지", category: "OFFENSE", themeColor: "#fbbf24", formatValue: (stacks) => `종합 물리 투지 보정 (중합: ${stacks})` },
  JOB_CHIEFTAIN: { displayName: "치프틴 클래스 시너지", category: "OFFENSE", themeColor: "#f43f5e", formatValue: (stacks) => `추장의 지배력 기백 넉백 활성 (중합: ${stacks})` },

  ACTIVE_BREATH: { displayName: "원소 브레스 스킬", category: "OFFENSE", themeColor: "#ef4444", formatValue: (stacks) => `4턴마다 원소 브레스 격발 활성화 (중합: ${stacks})` },
  ACTIVE_HIGH_BREATH: { displayName: "고위 원소 브레스 스킬", category: "OFFENSE", themeColor: "#a855f7", formatValue: (stacks) => `12턴마다 파괴적인 고위 브레스 활성화 (중합: ${stacks})` },
  ACTIVE_MANA_ARROW: { displayName: "마력 화살 스킬", category: "OFFENSE", themeColor: "#60a5fa", formatValue: (stacks) => `3턴마다 지능 비례 원거리 마력볼트 활성화 (중합: ${stacks})` },
  ACTIVE_MANA_THRUST: { displayName: "마나 트러스트 스킬", category: "OFFENSE", themeColor: "#a78bfa", formatValue: (stacks) => `4턴마다 마법 보호막 연동 마나 방출 활성화 (중합: ${stacks})` },
  ACTIVE_TITAN_CHARGE: { displayName: "타이탄 돌격 스킬", category: "OFFENSE", themeColor: "#eab308", formatValue: (stacks) => `12턴마다 광역 기절 물리 돌격 격발 활성화 (중합: ${stacks})` },
  ACTIVE_TITAN_RAGE: { displayName: "타이탄 격노 스킬", category: "OFFENSE", themeColor: "#ec4899", formatValue: (stacks) => `8턴마다 1.5배율 파괴 격노 격발 활성화 (중합: ${stacks})` },
  ACTIVE_REND_STRIKE: { displayName: "상처 찢기 스킬", category: "OFFENSE", themeColor: "#fda4af", formatValue: (stacks) => `4턴마다 출혈 타격 스킬 활성화 (중합: ${stacks})` },
  ACTIVE_MANA_BREATH: { displayName: "마나 원소 브레스 스킬", category: "OFFENSE", themeColor: "#c084fc", formatValue: (stacks) => `4턴마다 비전 마나 브레스 격발 활성화 (중합: ${stacks})` },

  STRONG_ATTACK: { displayName: "강한 공격 (3타)", category: "OFFENSE", themeColor: "#f43f5e", formatValue: (stacks) => "매 3타째 공격 시 1.5배 물리 피해 강타 격발" },
  ACID_COUNTER: { displayName: "산성 반격 보호", category: "DEFENSE", themeColor: "#22c55e", formatValue: (stacks) => "피격 시 15% 확률로 1d4 부식 산성 반사 피해" },
  EVASION_BOOST: { displayName: "신체 회피 가속", category: "DEFENSE", themeColor: "#10b981", formatValue: (stacks) => `회피 AC 등급 +${stacks} 가산 추가 보정` },
  ACCURACY_BOOST: { displayName: "비열한 기습 명중", category: "OFFENSE", themeColor: "#38bdf8", formatValue: (stacks) => `명중 주사위 판정 롤 +${stacks * 2} 보정` },
  AMBUSH: { displayName: "벽 지형 암습 기습", category: "OFFENSE", themeColor: "#fb7185", formatValue: (stacks) => "벽에 인접한 적 근접 타격 시 +3 고정 추가 피해" },
  FRENZY: { displayName: "광폭 더블 FRENZY", category: "OFFENSE", themeColor: "#ec4899", formatValue: (stacks) => "물리 평타 공격 시 20% 확률로 2회 연속 타격" },
  GIANT_BLOOD: { displayName: "거인의 피 회복력", category: "DEFENSE", themeColor: "#854d0e", formatValue: (stacks) => "피격 시 30% 확률로 소실 체력 10% 즉시 초재생 복구" },
  ELEMENTAL_BOOST: { displayName: "주문 원소 마법 증폭", category: "OFFENSE", themeColor: "#ef4444", formatValue: (stacks) => "모든 액티브 속성 마법 및 원소 브레스 피해 +50% 증폭" },
  FEAR_AURA: { displayName: "심연 지배 공포 오라", category: "OFFENSE", themeColor: "#a855f7", formatValue: (stacks) => "5칸 범위 내 모든 적 명중 등급 -3 절대 페널티 디버프" },
  SPELL_CHARGE: { displayName: "주문 에너지 가속", category: "VELOCITY", themeColor: "#60a5fa", formatValue: (stacks) => "마법 주문 적중 시 행동 에너지 +15 즉시 충전" },
  SAGE_HEAL: { displayName: "현자의 포식 힐", category: "DEFENSE", themeColor: "#34d399", formatValue: (stacks) => "마법 취약 상태인 적 처치 시 잃은 체력 10% 가속 복구" },
  HOLY_SHIELD: { displayName: "천사 신성 장벽", category: "DEFENSE", themeColor: "#ffffff", formatValue: (stacks) => "피격 시 10% 확률로 잃은 체력 5% 신성 가호 즉시 회복" },
  MANA_SHIELD_PASSIVE: { displayName: "천상 마나 실드", category: "DEFENSE", themeColor: "#cbd5e1", formatValue: (stacks) => "스킬 시전 시 가한 대미지만큼 1턴 흡수 마나 보호막 전개" },
  MELEE_BOOST: { displayName: "근접 물리 투지", category: "OFFENSE", themeColor: "#fbbf24", formatValue: (stacks) => "기본 근접 평타 및 물리 공격 피해량 +15% 증폭" },
  BERSERK_RAGE: { displayName: "광전사의 분노", category: "OFFENSE", themeColor: "#ec4899", formatValue: (stacks) => "HP 50% 이하 돌입 시 물리 피해 +40% 및 행동 속도 +25% 극대화" },
};
