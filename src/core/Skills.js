/**
 * @module Skills
 * @description 플레이어 및 몬스터 스킬 시스템 설정 모듈.
 *              ToME 2.3.5 정통 851종 스펠/타격(TomeSpellEngine)과 100% 직결되어
 *              동적 스킬 트리(CORE_SKILL_TREES) 및 액티브 스킬 설정을 제공합니다.
 * @dependency MonsterRegistry.js, TomeSpellEngine.js
 */
import { getSpeciesConfig, getSpeciesKeyByName } from '../entities/MonsterRegistry.js';
import { TomeSpellEngine, TOME_CANONICAL_SPELLS } from '../systems/TomeSpellEngine.js';

// Base static definitions for UI fallbacks
export const BASE_SKILL_TREES = {
  "MON_NOVICE_WARRIOR": [
    { pt: 1, name: "터프함", desc: "힘(STR) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["STR_BOOST"] },
    { pt: 3, name: "강한공격", desc: "매 3타째 공격 1.5배 피해", type: "PASSIVE", isIntScaled: false, synergyTags: ["STRONG_ATTACK"] },
    { pt: 5, name: "몬스터탐지", desc: "20칸 내 적 투시 감지", type: "ACTIVE_PASSIVE", isIntScaled: false },
    { pt: 7, name: "끈질김", desc: "생명력(CON) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST"] },
    { pt: 10, name: "아이템탐지", desc: "20칸 내 바닥 템 감지", type: "ACTIVE_PASSIVE", isIntScaled: false }
  ],
  "Novice warrior": [
    { pt: 1, name: "터프함", desc: "힘(STR) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["STR_BOOST"] },
    { pt: 3, name: "강한공격", desc: "매 3타째 공격 1.5배 피해", type: "PASSIVE", isIntScaled: false, synergyTags: ["STRONG_ATTACK"] },
    { pt: 5, name: "몬스터탐지", desc: "20칸 내 적 투시 감지", type: "ACTIVE_PASSIVE", isIntScaled: false },
    { pt: 7, name: "끈질김", desc: "생명력(CON) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST"] },
    { pt: 10, name: "아이템탐지", desc: "20칸 내 바닥 템 감지", type: "ACTIVE_PASSIVE", isIntScaled: false }
  ],
  "인간 여행자": [
    { pt: 1, name: "터프함", desc: "힘(STR) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["STR_BOOST"] },
    { pt: 3, name: "강한공격", desc: "매 3타째 공격 1.5배 피해", type: "PASSIVE", isIntScaled: false, synergyTags: ["STRONG_ATTACK"] },
    { pt: 5, name: "몬스터탐지", desc: "20칸 내 적 투시 감지", type: "ACTIVE_PASSIVE", isIntScaled: false },
    { pt: 7, name: "끈질김", desc: "생명력(CON) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST"] },
    { pt: 10, name: "아이템탐지", desc: "20칸 내 바닥 템 감지", type: "ACTIVE_PASSIVE", isIntScaled: false }
  ],
  "초록 슬라임": [
    { pt: 1, name: "끈적임", desc: "생명력(CON) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST"] },
    { pt: 3, name: "재생", desc: "턴 시작 시 자연 재생 (REGEN_UNIT)", type: "PASSIVE", isIntScaled: false, synergyTags: ["REGEN_UNIT"] },
    { pt: 5, name: "산성반격", desc: "피격시 15%로 1d4 반사피해", type: "PASSIVE", isIntScaled: false, synergyTags: ["ACID_COUNTER"] },
    { pt: 7, name: "젤리회피", desc: "회피 AC 등급 +1 추가", type: "PASSIVE", isIntScaled: false, synergyTags: ["EVASION_BOOST"] },
    { pt: 10, name: "젤리바디", desc: "물리 피해 고정 감쇄 (PHYS_RESIST)", type: "PASSIVE", isIntScaled: false, synergyTags: ["PHYS_RESIST"] }
  ],
  "고블린": [
    { pt: 1, name: "좀도둑기민", desc: "민첩(DEX) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["DEX_BOOST"] },
    { pt: 3, name: "비열한기습", desc: "명중 주사위 롤 +2 가산", type: "PASSIVE", isIntScaled: false, synergyTags: ["ACCURACY_BOOST"] },
    { pt: 5, name: "가벼운발걸음", desc: "행동 속도 가속 (HASTE_UNIT)", type: "PASSIVE", isIntScaled: false, synergyTags: ["HASTE_UNIT"] },
    { pt: 7, name: "암습", desc: "벽에 붙은 적 타격시 +3 피해", type: "PASSIVE", isIntScaled: false, synergyTags: ["AMBUSH"] },
    { pt: 10, name: "광폭화", desc: "공격시 20%로 연속 2회 공격", type: "PASSIVE", isIntScaled: false, synergyTags: ["FRENZY"] }
  ],
  "과일박쥐": [
    { pt: 1, name: "야간반사", desc: "기본 어둠 시야 범위 +1칸", type: "PASSIVE", isIntScaled: false },
    { pt: 3, name: "흡혈격노", desc: "생명력 흡수 (LIFESTEAL)", type: "PASSIVE", isIntScaled: false, synergyTags: ["LIFESTEAL"] },
    { pt: 5, name: "초음파탐지", desc: "10칸 내 몬스터 투시 감지", type: "ACTIVE_PASSIVE", isIntScaled: false },
    { pt: 7, name: "질풍기류", desc: "행동 속도 가속 (HASTE_UNIT)", type: "PASSIVE", isIntScaled: false, synergyTags: ["HASTE_UNIT"] },
    { pt: 10, name: "영리한회피", desc: "회피 AC 등급 +3 추가", type: "PASSIVE", isIntScaled: false, synergyTags: ["EVASION_BOOST"] }
  ],
  "오크": [
    { pt: 1, name: "돌격격노", desc: "힘(STR) 스탯 +15%", type: "PASSIVE", isIntScaled: false, synergyTags: ["STR_BOOST"] },
    { pt: 3, name: "밀쳐내기", desc: "공격 시 25%로 적 1칸 넉백 +1d4", type: "PASSIVE", isIntScaled: false },
    { pt: 5, name: "강철근육", desc: "생명력(CON) +5%, 피격 피해 -1", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST", "PHYS_RESIST"] },
    { pt: 7, name: "학살의분노", desc: "공격 명중 시 30%로 에너지 +50", type: "PASSIVE", isIntScaled: false },
    { pt: 10, name: "돌격격노 파열", desc: "매 4타째 1.8배 강타 피해", type: "PASSIVE", isIntScaled: false }
  ],
  "오우거": [
    { pt: 1, name: "거인의힘", desc: "힘(STR) 스탯 +20%", type: "PASSIVE", isIntScaled: false, synergyTags: ["STR_BOOST"] },
    { pt: 3, name: "지진강타", desc: "4타째마다 1d6 추가 진동 피해", type: "PASSIVE", isIntScaled: false },
    { pt: 5, name: "단단한가죽", desc: "생명력(CON) +15%", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST"] },
    { pt: 7, name: "거인의피", desc: "피격 시 30%로 결손 HP 10% 자연 회복", type: "PASSIVE", isIntScaled: false, synergyTags: ["GIANT_BLOOD"] },
    { pt: 10, name: "파괴적분쇄", desc: "매 공격 AC 무시 + 1.5배 피해", type: "PASSIVE", isIntScaled: false }
  ],
  "드래곤 해츨링": [
    { pt: 1, name: "원소친화", desc: "지능(INT) 스탯 +10%", type: "PASSIVE", isIntScaled: false, synergyTags: ["INT_BOOST"] },
    { pt: 3, name: "브레스", desc: "4턴에 1번 전방 원소 브레스", type: "ACTIVE", isIntScaled: true, tags: ["MAGIC", "BREATH"], synergyTags: ["ACTIVE_BREATH", "FIRE_RESIST"] },
    { pt: 5, name: "마법비늘", desc: "4대 원소 저항 획득", type: "PASSIVE", isIntScaled: false, synergyTags: ["FIRE_RESIST", "COLD_RESIST", "LIGHTNING_RESIST", "ACID_RESIST"] },
    { pt: 7, name: "비행본능", desc: "행동 속도 가속 (HASTE_UNIT)", type: "PASSIVE", isIntScaled: false, synergyTags: ["HASTE_UNIT"] },
    { pt: 10, name: "용황각성", desc: "모든 원소 피해 +50%", type: "PASSIVE", isIntScaled: false, synergyTags: ["ELEMENTAL_BOOST"] }
  ],
  "성체 드래곤": [
    { pt: 1, name: "마법비늘", desc: "생명력(CON) +15% 및 4대 원소 저항", type: "PASSIVE", isIntScaled: false, synergyTags: ["CON_BOOST", "FIRE_RESIST", "COLD_RESIST", "LIGHTNING_RESIST", "ACID_RESIST"] },
    { pt: 3, name: "고위브레스", desc: "12턴에 1번 파괴적인 원소 브레스", type: "ACTIVE", isIntScaled: true, tags: ["MAGIC", "BREATH"], synergyTags: ["ACTIVE_HIGH_BREATH", "FIRE_RESIST"] },
    { pt: 5, name: "용황의기세", desc: "5칸 내 적 명중률 -15%", type: "PASSIVE", isIntScaled: false },
    { pt: 7, name: "초월적지배", desc: "5칸 내 모든 적 명중 -3 패널티", type: "PASSIVE", isIntScaled: false, synergyTags: ["FEAR_AURA"] },
    { pt: 10, name: "천상강림", desc: "20%로 2d10 낙뢰 + 1턴 마비", type: "ACTIVE", isIntScaled: true, tags: ["MAGIC", "SPELL"] }
  ]
};

/**
 * Generates a dynamic 5-tier skill tree for any of the 851 ToME monster species.
 * @param {string} speciesIdentifier
 * @returns {Array<Object>}
 */
export function generateDynamicSkillTree(speciesIdentifier) {
  const config = getSpeciesConfig(speciesIdentifier);
  if (!config) return BASE_SKILL_TREES["인간 여행자"];

  const spells = TomeSpellEngine.resolveMonsterSpells(config.coreType || speciesIdentifier);
  const attacks = TomeSpellEngine.resolveMonsterAttacks(config.coreType || speciesIdentifier);

  const tree = [];
  const gType = config.growthType || 'BALANCED';
  const statTag = gType === 'TANK' ? 'CON_BOOST' : (gType === 'MAGE' ? 'INT_BOOST' : (gType === 'SPEEDY' ? 'DEX_BOOST' : 'STR_BOOST'));
  tree.push({
    pt: 1,
    name: `${config.name}의 혈통`,
    desc: `기본 능력치(${statTag.replace('_BOOST', '')}) +10% 증폭`,
    type: "PASSIVE",
    isIntScaled: false,
    synergyTags: [statTag]
  });

  if (spells.length > 0 && spells[0].spec) {
    const sp = spells[0];
    tree.push({
      pt: 3,
      name: sp.spec.name,
      desc: `${sp.spec.name} 투사 (${sp.spec.dice || '2d6'}, 원소: ${sp.spec.element || 'MANA'})`,
      type: "ACTIVE",
      isIntScaled: sp.spec.type === 'PROJECTILE' || sp.spec.type === 'AOE',
      tags: ["MAGIC", sp.spec.type],
      synergyTags: [sp.spec.element ? `${sp.spec.element}_MELEE` : "MAGIC_BOOST"]
    });
  } else if (attacks.length > 0) {
    const atk = attacks[0];
    tree.push({
      pt: 3,
      name: `${atk.method} 타격`,
      desc: `${atk.method}(${atk.effect}) 공격 기술을 사용합니다. (${atk.damage || '1d6'})`,
      type: "PASSIVE",
      isIntScaled: false,
      synergyTags: [atk.effect === 'POISON' ? 'ACID_MELEE' : 'PHYS_MELEE']
    });
  } else {
    tree.push({
      pt: 3,
      name: "강한 공격",
      desc: "매 3타째 공격 시 1.5배 피해",
      type: "PASSIVE",
      isIntScaled: false,
      synergyTags: ["STRONG_ATTACK"]
    });
  }

  const perks = config.perks || [];
  const resTags = [];
  if (perks.includes('IM_FIRE') || perks.includes('RES_FIRE')) resTags.push('FIRE_RESIST');
  if (perks.includes('IM_COLD') || perks.includes('RES_COLD')) resTags.push('COLD_RESIST');
  if (perks.includes('IM_ELEC') || perks.includes('RES_ELEC')) resTags.push('LIGHTNING_RESIST');
  if (perks.includes('IM_ACID') || perks.includes('RES_ACID')) resTags.push('ACID_RESIST');

  tree.push({
    pt: 5,
    name: `${config.name}의 외피`,
    desc: resTags.length > 0 ? `${resTags.length}종 원소 저항력 획득` : "물리 피해 고정 감쇄 획득",
    type: "PASSIVE",
    isIntScaled: false,
    synergyTags: resTags.length > 0 ? resTags : ["PHYS_RESIST"]
  });

  tree.push({
    pt: 7,
    name: "야성의 질주",
    desc: "행동 속도를 충전해 주는 가속(HASTE_UNIT)을 획득합니다.",
    type: "PASSIVE",
    isIntScaled: false,
    synergyTags: ["HASTE_UNIT"]
  });

  if (spells.length > 1 && spells[1].spec) {
    const sp = spells[1];
    tree.push({
      pt: 10,
      name: `[궁극기] ${sp.spec.name}`,
      desc: `${sp.spec.name}을(를) 방출하여 광역 파멸 피해를 입힙니다.`,
      type: "ACTIVE",
      isIntScaled: true,
      tags: ["MAGIC", sp.spec.type],
      synergyTags: ["ELEMENTAL_BOOST"]
    });
  } else {
    tree.push({
      pt: 10,
      name: "[궁극기] 파멸의 일격",
      desc: "치명적인 강타 공격을 가합니다.",
      type: "PASSIVE",
      isIntScaled: false,
      synergyTags: ["BERSERK_RAGE"]
    });
  }

  return tree;
}

export const CORE_SKILL_TREES = new Proxy(BASE_SKILL_TREES, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (prop in target) return target[prop];
    return generateDynamicSkillTree(prop);
  }
});

export function renderSkillListHTML(category, investedPoints) {
  const skills = CORE_SKILL_TREES[category] || [];
  if (skills.length === 0) {
    return `<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 1rem;">스킬 트리를 불러오는 중...</div>`;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 0.35rem;">`;
  const bgTheme = "rgba(16,185,129,0.08)";
  const textTheme = "#34d399";

  skills.forEach(skill => {
    const isActive = investedPoints >= skill.pt;
    const focusBadge = skill.isIntScaled 
      ? ` <span style="font-size:0.68rem; font-weight:600; color:#60a5fa; border:1px solid rgba(96,165,250,0.25); background:rgba(96,165,250,0.08); border-radius:4px; padding:0.05rem 0.25rem; margin-left:0.25rem;">집중 영향</span>` 
      : "";

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; background:${isActive ? bgTheme : 'transparent'}; padding: 0.2rem; border-radius: 4px;">
        <span><b>[${skill.pt} pt] ${skill.name}:</b> ${skill.desc}${focusBadge}</span>
        <span style="color:${isActive ? textTheme : 'var(--text-muted)'}; font-weight:bold;">${isActive ? '● 활성화' : '○ 잠김'}</span>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

export function isMagicSkill(category, pt) {
  const skills = CORE_SKILL_TREES[category] || [];
  const skill = skills.find(s => s.pt === pt);
  if (!skill) return false;
  return skill.isIntScaled || (skill.tags && skill.tags.includes("MAGIC"));
}

const BASE_ACTIVE_SKILL_CONFIGS = {
  "ACTIVE_BREATH": {
    name: "원소 브레스",
    coreName: "드래곤 해츨링",
    trackerKey: "hatchling_breath",
    cooldown: 4,
    manaCost: 8,
    maxRange: 5.5,
    type: "BREATH",
    rollDamage: () => Math.floor(Math.random() * 6) + 1,
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.intMod * 1.5) + Math.floor(player.conMod * 1.0)
  },
  "ACTIVE_HIGH_BREATH": {
    name: "고위 원소 브레스",
    coreName: "성체 드래곤",
    trackerKey: "dragon_breath",
    cooldown: 12,
    manaCost: 20,
    maxRange: 5.5,
    type: "BREATH",
    rollDamage: () => {
      let baseDamage = 0;
      for (let j = 0; j < 4; j++) baseDamage += Math.floor(Math.random() * 10) + 1;
      return baseDamage;
    },
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.intMod * 3.0) + Math.floor(player.conMod * 2.0)
  },
  "ACTIVE_MANA_BREATH": {
    name: "마나 원소 브레스",
    coreName: "마나의 해츨링",
    trackerKey: "mana_breath",
    cooldown: 4,
    manaCost: 10,
    maxRange: 5.5,
    type: "BREATH",
    rollDamage: () => Math.floor(Math.random() * 6) + 1,
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.intMod * 2.0) + Math.floor(player.conMod * 0.5)
  },
  "ACTIVE_MANA_ARROW": {
    name: "마력화살",
    coreName: "임프",
    trackerKey: "mana_arrow",
    cooldown: 3,
    manaCost: 4,
    maxRange: 5.5,
    type: "PROJECTILE",
    rollDamage: () => Math.floor(Math.random() * 6) + 1,
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.intMod * 2.5)
  },
  "ACTIVE_MANA_THRUST": {
    name: "마나 트러스트",
    coreName: "하급천사",
    trackerKey: "mana_thrust",
    cooldown: 4,
    manaCost: 8,
    maxRange: 5.5,
    type: "PROJECTILE",
    rollDamage: () => Math.floor(Math.random() * 10) + 5,
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.intMod * 3.0),
    onHit: (game, player, totalDmg) => {
      const activeTags = player.compileActiveTags();
      if ((activeTags["MANA_SHIELD_PASSIVE"] || 0) > 0) {
        player.manaShield = totalDmg;
        player.manaShieldDuration = 2;
        game.addLogEntry(`[Skill] 마나 트러스트가 타격되며 마나 실드(+${totalDmg} 흡수 보호막, 1턴 유지)를 전개했습니다!`, `loot`);
      }
    }
  },
  "ACTIVE_TITAN_CHARGE": {
    name: "타이탄 돌격",
    coreName: "레서 타이탄",
    trackerKey: "titan_charge",
    cooldown: 12,
    manaCost: 6,
    maxRange: 5.5,
    type: "CHARGE",
    rollDamage: () => (Math.floor(Math.random() * 10) + 1) + (Math.floor(Math.random() * 10) + 1),
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.getEffectiveStat('str') * 3.0) + Math.floor(player.getEffectiveStat('con') * 1.5),
    onHit: (game, player, totalDmg, targetMonster) => {
      if (targetMonster) {
        targetMonster.debuffs || (targetMonster.debuffs = { poison: 0, frost: 0, magicVulnerability: 0, paralyzed: false });
        targetMonster.debuffs.paralyzed = true;
        const dx = Math.sign(targetMonster.x - player.x);
        const dy = Math.sign(targetMonster.y - player.y);
        const targetX = targetMonster.x - dx;
        const targetY = targetMonster.y - dy;
        if (game.map.isWalkable(targetX, targetY)) {
          player.x = targetX;
          player.y = targetY;
          game.addLogEntry(`[Skill] 💥 거침없이 적에게 돌진하여 강력한 충격으로 ${targetMonster.displayName}를 마비(기절)시켰습니다!`, `loot`);
        }
      }
    }
  },
  "ACTIVE_TITAN_RAGE": {
    name: "타이탄의 격노",
    coreName: "레서 타이탄",
    trackerKey: "titan_rage",
    cooldown: 8,
    manaCost: 5,
    maxRange: 1.5,
    type: "STRIKE",
    rollDamage: () => Math.floor(Math.random() * 12) + 6,
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.getEffectiveStat('str') * 2.0),
    onHit: (game, player, totalDmg, targetMonster) => {
      if (targetMonster && Math.random() < 0.20) {
        targetMonster.debuffs || (targetMonster.debuffs = { poison: 0, frost: 0, magicVulnerability: 0, paralyzed: false });
        targetMonster.debuffs.paralyzed = true;
        game.addLogEntry(`[Skill] ⚡ 타이탄의 격노 격발! 충격파로 인해 ${targetMonster.displayName}가 1턴간 마비되었습니다!`, `loot`);
      }
    }
  },
  "ACTIVE_REND_STRIKE": {
    name: "상처 찢기",
    coreName: "포레스트 트롤",
    trackerKey: "troll_rend",
    cooldown: 4,
    manaCost: 4,
    maxRange: 1.5,
    type: "STRIKE",
    rollDamage: () => Math.floor(Math.random() * 6) + 1,
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.getEffectiveStat('str') * 1.2),
    onHit: (game, player, totalDmg, targetMonster) => {
      if (targetMonster) {
        targetMonster.debuffs || (targetMonster.debuffs = { poison: 0, frost: 0, magicVulnerability: 0, paralyzed: false });
        targetMonster.debuffs.poison = Math.max(targetMonster.debuffs.poison || 0, 3);
        game.addLogEntry(`[Skill] 🩸 상처 찢기 성공! 강력한 출혈 상태(중독 독소 취급, 3턴)로 만듭니다.`, `loot`);
      }
    }
  },
  "ACTIVE_MAGIC_MISSILE": {
    name: "마법 미사일",
    coreName: "Novice mage",
    trackerKey: "magic_missile",
    cooldown: 3,
    manaCost: 5,
    maxRange: 6.5,
    type: "PROJECTILE",
    rollDamage: () => {
      let dmg = 0;
      for (let i = 0; i < 3; i++) dmg += Math.floor(Math.random() * 4) + 1;
      return dmg;
    },
    calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor(player.intMod * 2.0)
  },
  "ACTIVE_PHASE_DOOR": {
    name: "점멸 (Phase Door)",
    coreName: "Novice mage",
    trackerKey: "phase_door",
    cooldown: 5,
    manaCost: 10,
    maxRange: 0,
    type: "TELEPORT",
    onCast: (game, player) => {
      if (game && game.map) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const dist = Math.floor(Math.random() * 4) + 3;
          const angle = Math.random() * Math.PI * 2;
          const tx = Math.round(player.x + Math.cos(angle) * dist);
          const ty = Math.round(player.y + Math.sin(angle) * dist);
          if (game.map.isWalkable(tx, ty) && !game.isMonsterAt(tx, ty)) {
            player.x = tx;
            player.y = ty;
            game.addLogEntry(`[Spell] 🌀 점멸(Phase Door) 발동! 안전한 공간으로 순간이동했습니다!`, `loot`);
            return true;
          }
        }
      }
      return false;
    }
  }
};

export const ACTIVE_SKILL_CONFIGS = new Proxy(BASE_ACTIVE_SKILL_CONFIGS, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (prop in target) return target[prop];
    const spec = TomeSpellEngine.getSpellDefinition(prop) || TomeSpellEngine.getSpellDefinition(prop.replace('ACTIVE_', ''));
    if (spec) {
      return {
        name: spec.name,
        cooldown: spec.cooldown || 4,
        manaCost: 5,
        maxRange: spec.range || 5.5,
        type: spec.type,
        rollDamage: () => TomeSpellEngine.rollDice(spec.dice || '2d6'),
        calcTotalDamage: (player, baseDmg) => baseDmg + Math.floor((player.intMod || 0) * 2.0)
      };
    }
    return {
      name: prop,
      cooldown: 4,
      manaCost: 5,
      maxRange: 5.5,
      type: "PROJECTILE",
      rollDamage: () => Math.floor(Math.random() * 6) + 1,
      calcTotalDamage: (player, baseDmg) => baseDmg + (player.intMod || 0)
    };
  }
});

const BASE_MONSTER_SKILLS = {
  AMBUSH: {
    name: "암습",
    bonusAccuracy: 2,
    onAttackStart: (game, monster, player) => {
      if (Math.random() < 0.20) {
        game.addLogEntry(`[MonsterSkill] ${monster.displayName}가 광폭화하여 연속 2회 타격합니다!`, `combat`);
        return 2;
      }
      return 1;
    },
    calcDamage: (game, monster, player, baseDmg) => {
      let nextToWall = false;
      for (let ox = -1; ox <= 1 && !nextToWall; ox++) {
        for (let oy = -1; oy <= 1 && !nextToWall; oy++) {
          if (ox === 0 && oy === 0) continue;
          const _tile = game.map.getTile(player.x + ox, player.y + oy);
          if (_tile && !_tile.isWalkable) nextToWall = true;
        }
      }
      let isGoblinAmbush = false;
      let finalDmg = baseDmg;
      if (nextToWall) {
        isGoblinAmbush = true;
        finalDmg += 3;
      }
      return { dmg: finalDmg, isGoblinAmbush };
    },
    logMessage: (game, monster, player, dmg, info) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      if (info && info.isGoblinAmbush) {
        game.addLogEntry(`[MonsterSkill] 고블린 암습! 벽 인접 +3 총 ${dmg} 피해${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      } else {
        game.addLogEntry(`[Combat] ${monster.name}가 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      }
    }
  },
  PULVERIZE: {
    name: "파괴적분쇄",
    ignoreAC: true,
    calcDamage: (game, monster, player, baseDmg) => {
      monster.attackCount = (monster.attackCount || 0) + 1;
      let finalDmg = Math.floor(baseDmg * 1.5);
      let isOgreEq = false;
      let eqDmg = 0;
      if (monster.attackCount % 4 === 0) {
        isOgreEq = true;
        eqDmg = Math.floor(Math.random() * 6) + 1;
        finalDmg += eqDmg;
      }
      return { dmg: finalDmg, isOgreEq, eqDmg };
    },
    logMessage: (game, monster, player, dmg, info) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      game.addLogEntry(`[MonsterSkill] ${monster.name}가 파괴적분쇄 발동! AC 무시 1.5배 피해 ${dmg}${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      if (info && info.isOgreEq) {
        game.addLogEntry(`[MonsterSkill] 오우거 지진강타! 충격파 +${info.eqDmg} 진동 피해`, `combat`);
      }
    }
  },
  STRONG: {
    name: "강한공격",
    calcDamage: (game, monster, player, baseDmg) => {
      monster.attackCount = (monster.attackCount || 0) + 1;
      let isHumanStrong = false;
      let finalDmg = baseDmg;
      if (monster.attackCount % 3 === 0) {
        isHumanStrong = true;
        finalDmg = Math.floor(baseDmg * 1.5);
      }
      return { dmg: finalDmg, isHumanStrong };
    },
    logMessage: (game, monster, player, dmg, info) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      if (info && info.isHumanStrong) {
        game.addLogEntry(`[MonsterSkill] 인간 여행자 강한공격! 1.5배 ${dmg} 피해${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      } else {
        game.addLogEntry(`[Combat] ${monster.name}가 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      }
    }
  },
  PUSH: {
    name: "돌격격노",
    calcDamage: (game, monster, player, baseDmg) => {
      monster.attackCount = (monster.attackCount || 0) + 1;
      let isOrcFury = false;
      let finalDmg = baseDmg;
      if (monster.attackCount % 4 === 0) {
        isOrcFury = true;
        finalDmg = Math.floor(baseDmg * 1.8);
      }
      let isOrcPush = false;
      let pushDmg = 0;
      if (Math.random() < 0.25) {
        isOrcPush = true;
        pushDmg = Math.floor(Math.random() * 4) + 1;
        finalDmg += pushDmg;
      }
      return { dmg: finalDmg, isOrcFury, isOrcPush, pushDmg };
    },
    logMessage: (game, monster, player, dmg, info) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      if (info && info.isOrcFury) {
        game.addLogEntry(`[MonsterSkill] 오크 돌격격노! 1.8배 ${dmg} 피해${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      } else {
        game.addLogEntry(`[Combat] ${monster.name}가 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      }
    },
    onHit: (game, monster, player, dmg, info) => {
      if (info && info.isOrcPush && player.stats.hp > 0) {
        const pdx = Math.sign(player.x - monster.x);
        const pdy = Math.sign(player.y - monster.y);
        const tx2 = player.x + pdx;
        const ty2 = player.y + pdy;
        if (game.map.isWalkable(tx2, ty2) && !game.isMonsterAt(tx2, ty2)) {
          player.x = tx2; player.y = ty2;
          game.addLogEntry(`[MonsterSkill] 오크 밀쳐내기! 1칸 뒤로 밀쳐냄 +${info.pushDmg} 피해`, `combat`);
        } else {
          game.addLogEntry(`[MonsterSkill] 오크 밀쳐내기! 막힌 지형 +${info.pushDmg} 추가 피해`, `combat`);
        }
      }
    }
  },
  HEAVEN: {
    name: "천상강림",
    calcDamage: (game, monster, player, baseDmg) => {
      let isDragonHeaven = false;
      let heavenDmg = 0;
      let finalDmg = baseDmg;
      if (Math.random() < 0.20) {
        isDragonHeaven = true;
        heavenDmg = (Math.floor(Math.random() * 10) + 1) + (Math.floor(Math.random() * 10) + 1);
        finalDmg += heavenDmg;
      }
      return { dmg: finalDmg, isDragonHeaven, heavenDmg };
    },
    logMessage: (game, monster, player, dmg) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      game.addLogEntry(`[Combat] ${monster.name}가 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    },
    onHit: (game, monster, player, dmg, info) => {
      if (info && info.isDragonHeaven && player.stats.hp > 0) {
        game.addLogEntry(`[MonsterSkill] ⚡ 성체 드래곤 천상강림! +${info.heavenDmg} 낙뢰 + 1턴 마비!`, `combat`);
        if (!player.debuffs) player.debuffs = { poison: 0, frost: 0, paralyzed: false };
        player.debuffs.paralyzed = true;
      }
    }
  },
  VAMP: {
    name: "흡혈",
    calcDamage: (game, monster, player, baseDmg) => {
      monster.attackCount = (monster.attackCount || 0) + 1;
      let isBatVamp = (monster.attackCount % 4 === 0);
      return { dmg: baseDmg, isBatVamp };
    },
    logMessage: (game, monster, player, dmg) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      game.addLogEntry(`[Combat] ${monster.name}가 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    },
    onHit: (game, monster, player, dmg, info) => {
      if (info && info.isBatVamp) {
        monster.stats.hp = Math.min(monster.maxHp, monster.stats.hp + 2);
        game.addLogEntry(`[MonsterSkill] 과일박쥐 흡혈격노! 피를 빨아 2 HP 회복 (HP: ${monster.stats.hp}/${monster.maxHp})`, `loot`);
      }
    }
  },
  TITAN_CHARGE: {
    name: "타이탄 돌격",
    calcDamage: (game, monster, player, baseDmg) => {
      monster.attackCount = (monster.attackCount || 0) + 1;
      let isTitanCharge = (monster.attackCount % 5 === 0);
      let finalDmg = baseDmg;
      if (isTitanCharge) {
        finalDmg = Math.floor(baseDmg * 2.0);
      }
      return { dmg: finalDmg, isTitanCharge };
    },
    logMessage: (game, monster, player, dmg, info) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      if (info && info.isTitanCharge) {
        game.addLogEntry(`[MonsterSkill] 💥 레서 타이탄의 파괴 돌격! 2배 피해 ${dmg}${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      } else {
        game.addLogEntry(`[Combat] ${monster.name}가 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      }
    },
    onHit: (game, monster, player, dmg, info) => {
      if (info && info.isTitanCharge && player.stats.hp > 0) {
        player.debuffs || (player.debuffs = { poison: 0, frost: 0, paralyzed: false });
        player.debuffs.paralyzed = true;
        const dx = Math.sign(player.x - monster.x);
        const dy = Math.sign(player.y - monster.y);
        const targetX = player.x - dx;
        const targetY = player.y - dy;
        if (game.map.isWalkable(targetX, targetY) && !game.isMonsterAt(targetX, targetY)) {
          monster.x = targetX;
          monster.y = targetY;
          game.addLogEntry(`[MonsterSkill] 레서 타이탄이 내 옆으로 거칠게 돌진해와 나를 마비시켰습니다!`, `combat`);
        }
      }
    }
  },
  SHIELD_SLAM: {
    name: "방패 밀치기",
    bonusAccuracy: 1,
    calcDamage: (game, monster, player, baseDmg) => {
      let isWarriorSlam = Math.random() < 0.30;
      let finalDmg = baseDmg;
      if (isWarriorSlam) {
        finalDmg = Math.floor(baseDmg * 1.3);
      }
      return { dmg: finalDmg, isWarriorSlam };
    },
    logMessage: (game, monster, player, dmg, info) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      if (info && info.isWarriorSlam) {
        game.addLogEntry(`[MonsterSkill] 🛡️ 전사 방패 밀치기! 1.3배의 강타 피해 ${dmg}${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      } else {
        game.addLogEntry(`[Combat] ${monster.name}가 전사 방패 밀치기로 나에게 ${dmg}의 피해를 입혔습니다!${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
      }
    },
    onHit: (game, monster, player, dmg, info) => {
      if (info && info.isWarriorSlam && player.stats.hp > 0) {
        const pdx = Math.sign(player.x - monster.x);
        const pdy = Math.sign(player.y - monster.y);
        const tx2 = player.x + pdx;
        const ty2 = player.y + pdy;
        if (game.map.isWalkable(tx2, ty2) && !game.isMonsterAt(tx2, ty2)) {
          player.x = tx2; player.y = ty2;
          game.addLogEntry(`[MonsterSkill] 전사 밀쳐내기! 방패 충격으로 1칸 넉백되었습니다!`, `combat`);
        }
      }
    }
  },
  FIREBOLT: {
    name: "화염 화살",
    ignoreAC: true,
    calcDamage: (game, monster, player, baseDmg) => {
      let magicDmg = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1) + monster.intMod;
      return { dmg: Math.max(1, magicDmg) };
    },
    logMessage: (game, monster, player, dmg) => {
      game.addLogEntry(`[MonsterSkill] 🔥 마법사 화염 화살! 뜨거운 마법 구체 투사체 피해 ${dmg} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    }
  },
  LIGHTNING_BOLT: {
    name: "번개 화살",
    ignoreAC: true,
    calcDamage: (game, monster, player, baseDmg) => {
      let magicDmg = (Math.floor(Math.random() * 10) + 1) + monster.intMod;
      return { dmg: Math.max(1, magicDmg) };
    },
    logMessage: (game, monster, player, dmg) => {
      game.addLogEntry(`[MonsterSkill] ⚡ 샤먼 번개 화살! 전격 마법 투사체 피해 ${dmg} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    },
    onHit: (game, monster, player, dmg) => {
      if (player.stats.hp > 0 && Math.random() < 0.20) {
        player.debuffs || (player.debuffs = { poison: 0, frost: 0, paralyzed: false });
        player.debuffs.paralyzed = true;
        game.addLogEntry(`[MonsterSkill] ⚡ 전격 감전! 번개 충격으로 인해 1턴간 마비되었습니다!`, `combat`);
      }
    }
  },
  CHAMPION_STRIKE: {
    name: "챔피언 격타",
    ignoreAC: true,
    bonusAccuracy: 2,
    calcDamage: (game, monster, player, baseDmg) => ({ dmg: Math.floor(baseDmg * 1.8) }),
    logMessage: (game, monster, player, dmg) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      game.addLogEntry(`[MonsterSkill] ⚔️ 챔피언 용맹의 격타! 방어구 회피 AC 무시 1.8배 대미지 ${dmg}${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    }
  },
  CHIEFTAIN_ROAR: {
    name: "추장의 함성 격쇄",
    ignoreAC: true,
    bonusAccuracy: 3,
    calcDamage: (game, monster, player, baseDmg) => ({ dmg: Math.floor(baseDmg * 2.0) }),
    logMessage: (game, monster, player, dmg) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      game.addLogEntry(`[MonsterSkill] 💀 치프틴 추장의 함성 격쇄! AC 완전 무시 2.0배 파멸 타격 피해 ${dmg}${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    },
    onHit: (game, monster, player) => {
      if (player.stats.hp > 0) {
        const pdx = Math.sign(player.x - monster.x);
        const pdy = Math.sign(player.y - monster.y);
        const tx2 = player.x + pdx;
        const ty2 = player.y + pdy;
        if (tx2 >= 0 && tx2 < game.map.width && ty2 >= 0 && ty2 < game.map.height) {
          if (game.map.isWalkable(tx2, ty2) && !game.isMonsterAt(tx2, ty2)) {
            player.x = tx2; player.y = ty2;
            game.addLogEntry(`[MonsterSkill] 치프틴 돌격 압박! 기백에 짓눌려 1칸 뒤로 넉백되었습니다!`, `combat`);
          }
        }
        if (Math.random() < 0.30) {
          player.debuffs || (player.debuffs = { poison: 0, frost: 0, paralyzed: false });
          player.debuffs.paralyzed = true;
          game.addLogEntry(`[MonsterSkill] 💀 패왕의 위압! 추장의 살기에 짓눌려 1턴간 기절(마비) 상태가 됩니다!`, `combat`);
        }
      }
    }
  },
  REND: {
    name: "상처 찢기",
    bonusAccuracy: 1,
    calcDamage: (game, monster, player, baseDmg) => ({ dmg: Math.floor(baseDmg * 1.2) }),
    logMessage: (game, monster, player, dmg) => {
      const flatRed = player.getFlatDamageReduction ? player.getFlatDamageReduction() : 0;
      const _defSfx = flatRed > 0 ? ` (방어구 태그 감쇄 -${flatRed})` : ``;
      game.addLogEntry(`[MonsterSkill] 🩸 ${monster.displayName}의 상처 찢기 발동! 1.2배 대미지 ${dmg}${_defSfx} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    },
    onHit: (game, monster, player) => {
      if (player.stats.hp > 0) {
        player.debuffs || (player.debuffs = { poison: 0, frost: 0, paralyzed: false });
        player.debuffs.poison = Math.max(player.debuffs.poison || 0, 3);
        game.addLogEntry(`[MonsterSkill] 🩸 적의 발톱에 살점이 찢겨나가 3턴간 출혈(중독 취급) 상태가 되었습니다!`, `combat`);
      }
    }
  },
  HOLY_BOLT: {
    name: "성스러운 화살",
    ignoreAC: true,
    calcDamage: (game, monster, player, baseDmg) => {
      let magicDmg = (Math.floor(Math.random() * 8) + 1) + monster.intMod;
      return { dmg: Math.max(1, magicDmg) };
    },
    logMessage: (game, monster, player, dmg) => {
      game.addLogEntry(`[MonsterSkill] 👼 사제 성스러운 화살! 신성 주문 투사체 피해 ${dmg} (HP: ${player.stats.hp}/${player.stats.maxHp})`, `combat`);
    }
  }
};

export const MONSTER_SKILLS = new Proxy(BASE_MONSTER_SKILLS, {
  get(target, prop) {
    if (typeof prop !== 'string') return target[prop];
    if (prop in target) return target[prop];
    return {
      name: prop,
      calcDamage: (game, monster, player, baseDmg) => ({ dmg: baseDmg }),
      logMessage: (game, monster, player, dmg) => {
        game.addLogEntry(`[Combat] ${monster.displayName || monster.name}의 ${prop} 공격! 나에게 ${dmg} 피해`, 'combat');
      }
    };
  }
});
