/**
 * @module Perks
 * @category entities
 * @description ToME 2.3.5 정통 플래그 및 변이(Mutations/Perks) 시스템 통합 정의 모듈.
 *              TomeFlagResolver 및 UnifiedTraitEngine과 직결되어 스탯 가중치, 행동 가속도, 상태이상 면역을 관리합니다.
 * @purity Stateless / Pure Registry
 * @dependencies none
 * @exports MONSTER_PERKS, getPerkDefinition
 */

const BASE_PERKS_DATA = {
  // Action Velocity & Body Traits
  SPEEDY_FLIGHT: {
    id: "SPEEDY_FLIGHT",
    name: "비행 본능",
    desc: "행동 속도가 40% 증가하고 비행 능력을 획득합니다.",
    effects: { speedMultiplier: 1.4 },
    synergyTags: ["SPEED_BOOST", "CAN_FLY"]
  },
  CAN_FLY: {
    id: "CAN_FLY",
    name: "비행 능력",
    desc: "공중을 날아 함정과 지형 방해를 무시합니다.",
    effects: { speedMultiplier: 1.1 },
    synergyTags: ["CAN_FLY"]
  },
  HEAVY_GIANT: {
    id: "HEAVY_GIANT",
    name: "거인의 육체",
    desc: "행동 속도가 30% 감속하고 최대 체력이 20% 증가합니다.",
    effects: { speedMultiplier: 0.7, hpMultiplier: 1.2 },
    synergyTags: ["CON_BOOST"]
  },
  SLUGGISH: {
    id: "SLUGGISH",
    name: "느릿느릿",
    desc: "행동 속도가 20% 감소합니다.",
    effects: { speedMultiplier: 0.8 },
    synergyTags: []
  },
  
  // Stat Boost Perks
  DEXTEROUS: {
    id: "DEXTEROUS",
    name: "좀도둑 기민",
    desc: "기본 민첩성(DEX) 스탯 +20% 증가.",
    effects: { statWeights: { dex: 1.2 } },
    synergyTags: ["DEX_BOOST"]
  },
  TOUGH_BODY: {
    id: "TOUGH_BODY",
    name: "터프함",
    desc: "기본 생명력(CON) 스탯 +15% 증가.",
    effects: { statWeights: { con: 1.15 } },
    synergyTags: ["CON_BOOST"]
  },
  SOLID_BODY: {
    id: "SOLID_BODY",
    name: "단단한 몸",
    desc: "물리 피해 고정 감쇄 태그(PHYS_RESIST)를 1회 획득합니다.",
    effects: { statWeights: { con: 1.1 } },
    synergyTags: ["CON_BOOST", "PHYS_RESIST"]
  },
  ANGELIC_GRACE: {
    id: "ANGELIC_GRACE",
    name: "천사의 은총",
    desc: "행동 속도가 30% 증가하고, 최대 체력이 30% 증가하며, 스킬 쿨타임 가속(QUICKCAST) 효과를 받습니다.",
    effects: { speedMultiplier: 1.3, hpMultiplier: 1.3 },
    synergyTags: ["QUICKCAST", "SPEED_BOOST"]
  },

  // Magical Scaling & Resistance Perks
  FIRE_RESISTANCE: {
    id: "FIRE_RESISTANCE",
    name: "마법 비늘 (화염)",
    desc: "화염 속성 공격 피해를 50% 경감합니다.",
    effects: { resistances: ["FIRE"], elementDmgReceivedMultiplier: 0.50 },
    synergyTags: ["FIRE_RESIST"]
  },
  COLD_RESISTANCE: {
    id: "COLD_RESISTANCE",
    name: "마법 비늘 (냉기)",
    desc: "냉기 속성 공격 피해를 50% 경감합니다.",
    effects: { resistances: ["COLD"], elementDmgReceivedMultiplier: 0.50 },
    synergyTags: ["COLD_RESIST"]
  },
  LIGHTNING_RESISTANCE: {
    id: "LIGHTNING_RESISTANCE",
    name: "마법 비늘 (전기)",
    desc: "전기 속성 공격 피해를 50% 경감합니다.",
    effects: { resistances: ["LIGHTNING"], elementDmgReceivedMultiplier: 0.50 },
    synergyTags: ["LIGHTNING_RESIST"]
  },
  ACID_RESISTANCE: {
    id: "ACID_RESISTANCE",
    name: "마법 비늘 (산성)",
    desc: "산성 속성 공격 피해를 50% 경감합니다.",
    effects: { resistances: ["ACID"], elementDmgReceivedMultiplier: 0.50 },
    synergyTags: ["ACID_RESIST"]
  },
  ELEMENTAL_MASTERY: {
    id: "ELEMENTAL_MASTERY",
    name: "용황의 위엄",
    desc: "최종 원소/마법 공격 피해량이 50% 증가합니다.",
    effects: { elementDmgMultiplier: 1.5 },
    synergyTags: ["ELEMENTAL_BOOST"]
  },
  DRAGON_SCALES: {
    id: "DRAGON_SCALES",
    name: "마법 비늘",
    desc: "물리 피해 고정 감쇄 및 4대 원소 저항력을 획득합니다.",
    effects: { resistances: ["FIRE", "COLD", "LIGHTNING", "ACID"] },
    synergyTags: [
      "CON_BOOST",
      "PHYS_RESIST", "PHYS_RESIST", "PHYS_RESIST",
      "FIRE_RESIST", "FIRE_RESIST", "FIRE_RESIST",
      "COLD_RESIST", "COLD_RESIST", "COLD_RESIST",
      "LIGHTNING_RESIST", "LIGHTNING_RESIST", "LIGHTNING_RESIST",
      "ACID_RESIST", "ACID_RESIST", "ACID_RESIST"
    ]
  },
  FEAR_AURA: {
    id: "FEAR_AURA",
    name: "초월적 지배",
    desc: "주변 5칸 내 대상의 명중률을 3 감소시킵니다.",
    effects: { accuracyDebuff: 3 },
    synergyTags: ["FEAR_AURA"]
  },
  GIANT_HEART: {
    id: "GIANT_HEART",
    name: "거인의 피",
    desc: "피격 시 30% 확률로 결손 HP의 10%를 자연 회복합니다.",
    synergyTags: ["GIANT_BLOOD"]
  },
  ACID_REFLECT: {
    id: "ACID_REFLECT",
    name: "산성 반격",
    desc: "피격 시 15% 확률로 1d4 산성 반사 피해를 플레이어에게 입힙니다.",
    synergyTags: ["ACID_COUNTER"]
  },
  SLAUGHTER_RAGE: {
    id: "SLAUGHTER_RAGE",
    name: "학살의 분노",
    desc: "공격 시 30% 확률로 행동 에너지 50을 추가 획득합니다.",
    synergyTags: ["FRENZY"]
  },
  TITAN_FORCE: {
    id: "TITAN_FORCE",
    name: "타이탄의 투기",
    desc: "물리 평타 공격 시 추가 타격 +2회 및 힘(STR) 스탯 +20% 증가.",
    effects: { statWeights: { str: 1.2 } },
    synergyTags: ["EXTRA_ATTACK", "EXTRA_ATTACK", "STR_BOOST"]
  },
  WARRIOR_HEART: {
    id: "WARRIOR_HEART",
    name: "투사의 강인함",
    desc: "최대 체력이 20% 증가하고 물리 피해 고정 감쇄를 획득합니다.",
    effects: { hpMultiplier: 1.2 },
    synergyTags: ["CON_BOOST", "PHYS_RESIST", "PHYS_RESIST"]
  },
  TROLL_REGEN: {
    id: "TROLL_REGEN",
    name: "트롤의 초재생력",
    desc: "자연 재생 및 대기 재생 능력을 획득하며, 힘(STR) 스탯이 +15% 증가합니다.",
    effects: { statWeights: { str: 1.15 } },
    synergyTags: ["STR_BOOST", "REGEN_UNIT", "REGEN_UNIT", "REGEN_UNIT", "WAIT_HEAL", "WAIT_HEAL"]
  },
  
  // 💀 섭취 불안정성에 따른 영구 본체 부정적 특성 (Penalties)
  FRAIL_BODY: {
    id: "FRAIL_BODY",
    name: "유리 신체",
    desc: "피격 시 입는 모든 최종 대미지가 3 가산됩니다.",
    synergyTags: []
  },
  SLOW_REFLEX: {
    id: "SLOW_REFLEX",
    name: "둔한 반사",
    desc: "민첩(DEX) 스탯 최종 판정 수치가 3 감소합니다.",
    synergyTags: []
  },
  MANA_LEAK: {
    id: "MANA_LEAK",
    name: "마력 누수",
    desc: "액티브 마법 및 스킬 최종 발동 피해량이 20% 감소합니다.",
    synergyTags: []
  },
  DULL_MIND: {
    id: "DULL_MIND",
    name: "둔한 정신",
    desc: "지능(INT) 스탯 최종 판정 수치가 3 감소합니다.",
    synergyTags: []
  },
  HEAVY_SOUL: {
    id: "HEAVY_SOUL",
    name: "무거운 영혼",
    desc: "소지품 적재 무게 계산 시 항상 15kg이 추가됩니다.",
    synergyTags: []
  }
};

/**
 * 플래그 또는 특성 식별자에 대한 정규화된 특성 객체를 반환합니다.
 * @param {string} perkId
 * @returns {Object}
 */
export function getPerkDefinition(perkId) {
  if (!perkId) return null;
  if (BASE_PERKS_DATA[perkId]) return BASE_PERKS_DATA[perkId];

  // Dynamic ToME canonical flag representation
  const upper = String(perkId).toUpperCase();
  if (BASE_PERKS_DATA[upper]) return BASE_PERKS_DATA[upper];

  let name = perkId;
  let desc = `ToME 플래그 [${perkId}]`;
  let synergyTags = [];
  let effects = {};

  if (upper.startsWith('RES_')) {
    const el = upper.replace('RES_', '');
    name = `${el} 저항`;
    desc = `${el} 속성 피해를 50% 경감합니다.`;
    synergyTags = [`${el}_RESIST`];
    effects = { resistances: [el] };
  } else if (upper.startsWith('IM_')) {
    const el = upper.replace('IM_', '');
    name = `${el} 면역`;
    desc = `${el} 속성 피해에 완전 면역(100% 무효화)됩니다.`;
    synergyTags = [`${el}_RESIST`, `${el}_IMMUNE`];
    effects = { immunities: [el] };
  } else if (upper === 'FREE_ACT') {
    name = '자유 행동';
    desc = '마비 및 이동 불가 상태이상에 완전 면역됩니다.';
    effects = { immunities: ['PARALYZE'] };
  } else if (upper === 'NO_CONF') {
    name = '혼란 면역';
    desc = '정신 혼란 상태이상에 걸리지 않습니다.';
    effects = { immunities: ['CONFUSE'] };
  } else if (upper === 'NO_SLEEP') {
    name = '수면 면역';
    desc = '수면 마법 및 효과에 걸리지 않습니다.';
    effects = { immunities: ['SLEEP'] };
  } else if (upper === 'HOLD_LIFE') {
    name = '생명력 보존';
    desc = '레벨 드레인 및 경험치 흡수 공격을 방어합니다.';
  } else if (upper === 'SEE_INVIS') {
    name = '투시 시각';
    desc = '은신 및 투명 상태의 적을 감지합니다.';
  } else if (upper.startsWith('ESP_')) {
    const espTarget = upper.replace('ESP_', '');
    name = `텔레파시 (${espTarget})`;
    desc = `${espTarget} 종족의 위치를 벽 너머로 감지합니다.`;
  } else if (upper === 'REGEN' || upper === 'REGENERATE') {
    name = '초재생';
    desc = '매 턴 자연스럽게 체력을 회복합니다.';
    synergyTags = ['REGEN_UNIT'];
  } else if (upper === 'REFLECT') {
    name = '원거리 반사';
    desc = '원거리 투사체 및 볼트 공격을 튕겨냅니다.';
  }

  return {
    id: perkId,
    name,
    desc,
    synergyTags,
    effects
  };
}

/**
 * Proxy-backed MONSTER_PERKS: O(1) dynamic resolver for any ToME flag or perk
 */
export const MONSTER_PERKS = new Proxy(BASE_PERKS_DATA, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (prop in target) return target[prop];
    return getPerkDefinition(prop);
  }
});
