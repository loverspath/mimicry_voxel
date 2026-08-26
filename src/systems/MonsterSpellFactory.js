/**
 * @module MonsterSpellFactory
 * @category systems
 * @description ToME 2.3.5 정통 몬스터 DB(TomeMonstersData.js)의 106종 spells 플래그 및 attacks 데이터를 100% 기반으로
 *              몬스터 코어 변신 시 플레이어 스킬바(1, 2, 3, 4번 슬롯)에 1:1 정확하게 바인딩하는 순수 의태 스펠 엔진.
 * @dependencies TomeMonstersData.js, MonsterRegistry.js
 */

import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { getSpeciesConfig, MONSTER_SPECIES } from '../entities/MonsterRegistry.js';

export class ActiveSkill {
  constructor(data) {
    this.id = data.id;
    this.tomeKey = data.tomeKey || data.id;
    this.slot = data.slot; // 1, 2, 3, 4
    this.requiredMastery = data.requiredMastery || (data.slot <= 2 ? 1 : (data.slot === 3 ? 10 : 25));
    this.name = data.name;
    this.desc = data.desc;
    this.type = data.type || 'PROJECTILE'; // 'PROJECTILE', 'AOE', 'BREATH', 'SELF', 'MELEE_STRIKE', 'TELEPORT'
    this.element = data.element || 'PHYSICAL';
    this.cooldown = data.cooldown || 2;
    this.maxRange = data.maxRange || 5.5;
    this.dice = data.dice || '1d6';
    this.color = data.color || '#38bdf8';
    this.icon = data.icon || '⚔️';
    this._execute = data.execute;
  }

  isUnlocked(masteryLevel = 1) {
    return (masteryLevel || 1) >= this.requiredMastery;
  }

  /**
   * 변신 숙련도(Morph Mastery)에 따른 실효 쿨타임을 산출합니다.
   * @param {number} masteryLevel
   * @returns {number}
   */
  getEffectiveCooldown(masteryLevel = 1) {
    const reduction = Math.floor((masteryLevel || 1) / 25); // Lv 25: -1, Lv 50: -2
    return Math.max(1, this.cooldown - reduction);
  }

  execute(game, player, target = null) {
    if (!game || !player) return false;
    const masteryLvl = player.getMorphMasteryLevel ? player.getMorphMasteryLevel() : 1;

    if (!this.isUnlocked(masteryLvl)) {
      if (game.addLogEntry) {
        game.addLogEntry(`🔒 [스킬 잠김] ${this.name} 스킬은 [${player.mimicCore?.name || '현재 몬스터'}] 변신 숙련도 Lv.${this.requiredMastery} 이상에서 사용 가능합니다.`, 'combat');
      }
      return false;
    }

    const currentCd = player.getTracker ? player.getTracker(this.id, 'cooldown') : 0;
    if (currentCd > 0) {
      if (game.addLogEntry) {
        game.addLogEntry(`⏳ [쿨다운 중] ${this.name} 재사용 대기시간이 ${currentCd}턴 남았습니다.`, 'combat');
      }
      return false;
    }

    // Run ToME canonical execution logic
    const success = this._execute(game, player, target, this);
    if (success) {
      const finalCd = this.getEffectiveCooldown(masteryLvl);
      if (player.setTracker) {
        player.setTracker(this.id, 'cooldown', finalCd);
      }

      // Gain Morph Lore Mastery XP (+2) on successful active skill execution
      const currentMorphKey = player.mimicCore?.coreType || player.mimicCore?.name;
      if (currentMorphKey && player.body && player.body.gainLoreXp) {
        player.body.gainLoreXp(currentMorphKey, 2);
      }
    }
    return success;
  }
}

/**
 * ToME 2.3.5 정통 스펠 정의 카탈로그 (1:1 스펙)
 */
export const TOME_SPELL_DEFINITIONS = {
  // --- Pure Arcane & Bolts ---
  'MISSILE': {
    name: '🔮 마법 미사일',
    desc: '비전 마법 미사일을 적에게 발사합니다. (2d6 + 2.0*INT)',
    type: 'PROJECTILE',
    element: 'MANA',
    manaCost: 3,
    cooldown: 2,
    maxRange: 6.0,
    dice: '2d6',
    color: '#a78bfa',
    icon: '🔮',
    statKey: 'intMod',
    statScale: 2.0
  },
  'BO_FIRE': {
    name: '🔥 화염 볼트',
    desc: '작열하는 화염 볼트를 투사하여 화염 피해를 입힙니다. (9d8 + 2.5*INT)',
    type: 'PROJECTILE',
    element: 'FIRE',
    manaCost: 6,
    cooldown: 3,
    maxRange: 6.0,
    dice: '9d8',
    color: '#ef4444',
    icon: '🔥',
    statKey: 'intMod',
    statScale: 2.5
  },
  'BO_COLD': {
    name: '❄️ 냉기 볼트',
    desc: '서리의 냉기 볼트를 투사하여 빙결 피해를 입힙니다. (6d8 + 2.5*INT)',
    type: 'PROJECTILE',
    element: 'COLD',
    manaCost: 5,
    cooldown: 3,
    maxRange: 6.0,
    dice: '6d8',
    color: '#38bdf8',
    icon: '❄️',
    statKey: 'intMod',
    statScale: 2.5
  },
  'BO_ELEC': {
    name: '⚡ 뇌격 볼트',
    desc: '번개 볼트를 투사하여 뇌격 피해를 입히고 25% 확률로 1턴 감전 마비시킵니다. (4d8 + 2.0*INT)',
    type: 'PROJECTILE',
    element: 'LIGHTNING',
    manaCost: 5,
    cooldown: 3,
    maxRange: 6.0,
    dice: '4d8',
    color: '#eab308',
    icon: '⚡',
    statKey: 'intMod',
    statScale: 2.0,
    statusEffect: 'paralyzed',
    statusChance: 0.25
  },
  'BO_ACID': {
    name: '🧪 산성 볼트',
    desc: '부식성 산성 볼트를 투사하여 강한 산성 피해를 입힙니다. (7d8 + 2.0*INT)',
    type: 'PROJECTILE',
    element: 'ACID',
    manaCost: 5,
    cooldown: 3,
    maxRange: 6.0,
    dice: '7d8',
    color: '#22c55e',
    icon: '🧪',
    statKey: 'intMod',
    statScale: 2.0
  },
  'BO_POIS': {
    name: '🩸 독침 볼트',
    desc: '맹독 볼트를 투사하여 피해를 입히고 3턴간 지속 중독시킵니다. (3d8 + 2.0*INT)',
    type: 'PROJECTILE',
    element: 'POISON',
    manaCost: 4,
    cooldown: 3,
    maxRange: 5.5,
    dice: '3d8',
    color: '#10b981',
    icon: '🩸',
    statKey: 'intMod',
    statScale: 2.0,
    statusEffect: 'poison',
    poisonTurns: 3
  },
  'BO_NETH': {
    name: '☠️ 황천 볼트',
    desc: '황천(Nether)의 사령 볼트를 투사하여 영혼 피해를 입힙니다. (5d5 + 2.5*INT)',
    type: 'PROJECTILE',
    element: 'DARK',
    manaCost: 6,
    cooldown: 3,
    maxRange: 6.0,
    dice: '5d5',
    color: '#7c3aed',
    icon: '☠️',
    statKey: 'intMod',
    statScale: 2.5
  },
  'BO_MANA': {
    name: '✨ 마나 볼트',
    desc: '순수한 응축 마나 볼트를 투사하여 마법 저항을 관통합니다. (12d8 + 3.0*INT)',
    type: 'PROJECTILE',
    element: 'MANA',
    manaCost: 8,
    cooldown: 4,
    maxRange: 6.5,
    dice: '12d8',
    color: '#c084fc',
    icon: '✨',
    statKey: 'intMod',
    statScale: 3.0
  },

  // --- ToME Balls (AoE Explosions) ---
  'BA_FIRE': {
    name: '💥 화염구 폭발 (Fire Ball)',
    desc: '목표 지점 반경 2.5칸 내 모든 적에게 거대한 화염 폭풍을 일으킵니다. (10d10 + 3.0*INT)',
    type: 'AOE',
    element: 'FIRE',
    manaCost: 12,
    cooldown: 6,
    maxRange: 5.5,
    dice: '10d10',
    color: '#ef4444',
    icon: '💥',
    statKey: 'intMod',
    statScale: 3.0
  },
  'BA_COLD': {
    name: '❄️ 눈보라 폭발 (Frost Ball)',
    desc: '목표 지점 반경 2.5칸 내 모든 적에게 빙결 눈보라를 몰아칩니다. (10d10 + 3.0*INT)',
    type: 'AOE',
    element: 'COLD',
    manaCost: 12,
    cooldown: 6,
    maxRange: 5.5,
    dice: '10d10',
    color: '#38bdf8',
    icon: '❄️',
    statKey: 'intMod',
    statScale: 3.0
  },
  'BA_ELEC': {
    name: '⚡ 뇌격 폭풍 (Lightning Ball)',
    desc: '목표 지점 반경 2.5칸 내 모든 적에게 연쇄 번개 폭풍을 일으킵니다. (8d8 + 2.5*INT)',
    type: 'AOE',
    element: 'LIGHTNING',
    manaCost: 11,
    cooldown: 5,
    maxRange: 5.5,
    dice: '8d8',
    color: '#eab308',
    icon: '⚡',
    statKey: 'intMod',
    statScale: 2.5
  },
  'BA_ACID': {
    name: '🧪 산성 구체 폭발 (Acid Ball)',
    desc: '목표 지점 반경 2.5칸 내 모든 적을 강산성 용액으로 녹입니다. (10d10 + 2.5*INT)',
    type: 'AOE',
    element: 'ACID',
    manaCost: 11,
    cooldown: 5,
    maxRange: 5.5,
    dice: '10d10',
    color: '#22c55e',
    icon: '🧪',
    statKey: 'intMod',
    statScale: 2.5
  },
  'BA_POIS': {
    name: '☁️ 독가스 폭발 (Poison Cloud)',
    desc: '목표 지점 반경 3.0칸 내 모든 적에게 치명적인 맹독 구름을 확산시킵니다. (12d2 + 2.0*INT)',
    type: 'AOE',
    element: 'POISON',
    manaCost: 9,
    cooldown: 5,
    maxRange: 5.5,
    dice: '12d2',
    color: '#10b981',
    icon: '☁️',
    statKey: 'intMod',
    statScale: 2.0
  },
  'BA_MANA': {
    name: '🌌 마나 폭풍 (Mana Storm)',
    desc: '전장을 뒤덮는 극대 마나 폭풍을 일으켜 모든 저항을 분쇄합니다. (20d10 + 4.0*INT)',
    type: 'AOE',
    element: 'MANA',
    manaCost: 20,
    cooldown: 8,
    maxRange: 6.0,
    dice: '20d10',
    color: '#a855f7',
    icon: '🌌',
    statKey: 'intMod',
    statScale: 4.0
  },

  // --- ToME Breaths ---
  'BR_FIRE': {
    name: '🐉 화염 브레스',
    desc: '전방 5.5칸 부채꼴 영역에 파괴적인 화염 브레스를 뿜어냅니다. (4d10 + 3.0*INT + 2.0*CON)',
    type: 'BREATH',
    element: 'FIRE',
    manaCost: 15,
    cooldown: 8,
    maxRange: 5.5,
    dice: '4d10',
    color: '#f97316',
    icon: '🐉'
  },
  'BR_COLD': {
    name: '🐉 냉기 브레스',
    desc: '전방 5.5칸 부채꼴 영역에 절대영도의 냉기 브레스를 뿜어냅니다. (4d10 + 3.0*INT + 2.0*CON)',
    type: 'BREATH',
    element: 'COLD',
    manaCost: 15,
    cooldown: 8,
    maxRange: 5.5,
    dice: '4d10',
    color: '#38bdf8',
    icon: '🐉'
  },
  'BR_ELEC': {
    name: '🐉 뇌격 브레스',
    desc: '전방 5.5칸 부채꼴 영역에 파괴적인 낙뢰 브레스를 뿜어냅니다. (4d10 + 3.0*INT + 2.0*CON)',
    type: 'BREATH',
    element: 'LIGHTNING',
    manaCost: 15,
    cooldown: 8,
    maxRange: 5.5,
    dice: '4d10',
    color: '#eab308',
    icon: '🐉'
  },
  'BR_ACID': {
    name: '🐉 산성 브레스',
    desc: '전방 5.5칸 부채꼴 영역에 모든 것을 녹이는 산성 브레스를 뿜어냅니다. (4d10 + 3.0*INT + 2.0*CON)',
    type: 'BREATH',
    element: 'ACID',
    manaCost: 15,
    cooldown: 8,
    maxRange: 5.5,
    dice: '4d10',
    color: '#22c55e',
    icon: '🐉'
  },
  'BR_POIS': {
    name: '🐉 맹독 브레스',
    desc: '전방 5.5칸 부채꼴 영역에 치명적인 맹독 브레스를 뿜어냅니다. (4d10 + 3.0*INT + 2.0*CON)',
    type: 'BREATH',
    element: 'POISON',
    manaCost: 14,
    cooldown: 8,
    maxRange: 5.5,
    dice: '4d10',
    color: '#10b981',
    icon: '🐉'
  },

  // --- ToME Utility, Healing, Mobility ---
  'BLINK': {
    name: '💨 점멸 (Phase Door)',
    desc: '시공간을 왜곡하여 3~6칸 거리의 안전한 타일로 즉시 단거리 텔레포트합니다.',
    type: 'TELEPORT',
    element: 'MANA',
    manaCost: 4,
    cooldown: 4,
    maxRange: 6.0,
    color: '#c084fc',
    icon: '💨'
  },
  'TELEPORT': {
    name: '🌀 순간이동 (Teleport)',
    desc: '위기 상황에서 던전 내 안전한 다른 구역으로 즉시 장거리 텔레포트합니다.',
    type: 'TELEPORT',
    element: 'MANA',
    manaCost: 7,
    cooldown: 7,
    maxRange: 15.0,
    color: '#a855f7',
    icon: '🌀'
  },
  'HEAL': {
    name: '💚 상처 치유 (Heal)',
    desc: '신성한 생명력을 체내에 주입하여 체력을 2d10 + WIS*2 만큼 즉시 회복합니다.',
    type: 'SELF',
    element: 'HOLY',
    manaCost: 8,
    cooldown: 5,
    maxRange: 0,
    dice: '2d10',
    color: '#34d399',
    icon: '💚'
  },
  'HASTE': {
    name: '⚡ 신속 가속 (Haste)',
    desc: '자신의 에너지를 폭발적으로 가속하여 5턴간 행동 속도를 대폭 증폭합니다.',
    type: 'SELF',
    element: 'PHYSICAL',
    manaCost: 6,
    cooldown: 6,
    maxRange: 0,
    color: '#fbbf24',
    icon: '⚡'
  },
  'DRAIN_MANA': {
    name: '🔮 마나 흡수 (Drain Mana)',
    desc: '적의 마나 에너지를 강탈하여 피해를 입히고 자신의 마나를 +10 MP 회복합니다.',
    type: 'PROJECTILE',
    element: 'MANA',
    manaCost: 0,
    cooldown: 4,
    maxRange: 5.5,
    dice: '2d8',
    color: '#60a5fa',
    icon: '🔮'
  },

  // --- ToME Wounds & Curses ---
  'CAUSE_1': {
    name: '🩸 상처 저주 (Light Wounds)',
    desc: '적에게 고통의 저주를 내려 체내 상처를 터뜨립니다. (3d8 + 1.5*INT)',
    type: 'PROJECTILE',
    element: 'DARK',
    manaCost: 3,
    cooldown: 2,
    maxRange: 5.5,
    dice: '3d8',
    color: '#f43f5e',
    icon: '🩸'
  },
  'CAUSE_2': {
    name: '🩸 중급 상처 저주 (Serious Wounds)',
    desc: '적에게 강력한 저주를 내려 살점을 찢습니다. (8d8 + 2.0*INT)',
    type: 'PROJECTILE',
    element: 'DARK',
    manaCost: 5,
    cooldown: 3,
    maxRange: 5.5,
    dice: '8d8',
    color: '#e11d48',
    icon: '🩸'
  },
  'CAUSE_3': {
    name: '💀 치명상 저주 (Critical Wounds)',
    desc: '적에게 파멸의 치명상을 입혀 대량의 피를 뿜게 합니다. (10d15 + 2.5*INT)',
    type: 'PROJECTILE',
    element: 'DARK',
    manaCost: 8,
    cooldown: 4,
    maxRange: 5.5,
    dice: '10d15',
    color: '#be123c',
    icon: '💀'
  },
  'CAUSE_4': {
    name: '☠️ 필멸의 저주 (Mortal Wounds)',
    desc: '적에게 죽음의 필멸 저주를 내려 즉사에 준하는 파멸 피해를 가합니다. (15d15 + 3.0*INT)',
    type: 'PROJECTILE',
    element: 'DARK',
    manaCost: 15,
    cooldown: 6,
    maxRange: 5.5,
    dice: '15d15',
    color: '#881337',
    icon: '☠️'
  },
  'MIND_BLAST': {
    name: '🧠 정신 분쇄 (Mind Blast)',
    desc: '적의 뇌를 직접 강타하여 정신 피해를 입히고 2턴간 혼란에 빠뜨립니다. (8d8 + 2.5*INT)',
    type: 'PROJECTILE',
    element: 'MANA',
    manaCost: 7,
    cooldown: 4,
    maxRange: 5.5,
    dice: '8d8',
    color: '#ec4899',
    icon: '🧠',
    statusEffect: 'confusion'
  },

  // --- ToME Crowd Control ---
  'BLIND': {
    name: '👁️ 암흑 실명 (Blindness)',
    desc: '적의 시야를 칠흑의 암흑으로 가려 3턴간 실명 상태로 만듭니다.',
    type: 'PROJECTILE',
    element: 'DARK',
    manaCost: 4,
    cooldown: 4,
    maxRange: 5.5,
    color: '#475569',
    icon: '👁️',
    statusEffect: 'blind'
  },
  'CONF': {
    name: '🌀 혼란의 파동 (Confusion)',
    desc: '적의 정신을 교란시켜 3턴간 피아식별이 불가능한 혼란 상태에 빠뜨립니다.',
    type: 'PROJECTILE',
    element: 'MANA',
    manaCost: 4,
    cooldown: 4,
    maxRange: 5.5,
    color: '#a855f7',
    icon: '🌀',
    statusEffect: 'confusion'
  },
  'SLOW': {
    name: '🕸️ 감속의 덫 (Slow)',
    desc: '적의 신체를 무겁게 짓눌러 4턴간 이동 및 행동 속도를 50% 둔화시킵니다.',
    type: 'PROJECTILE',
    element: 'COLD',
    manaCost: 4,
    cooldown: 4,
    maxRange: 5.5,
    color: '#64748b',
    icon: '🕸️',
    statusEffect: 'slow'
  },
  'HOLD': {
    name: '⛓️ 마비 속박 (Paralyze)',
    desc: '강력한 마력 사슬로 적의 전신을 묶어 2턴간 완전 마비 상태로 만듭니다.',
    type: 'PROJECTILE',
    element: 'MANA',
    manaCost: 6,
    cooldown: 5,
    maxRange: 5.0,
    color: '#fbbf24',
    icon: '⛓️',
    statusEffect: 'paralyzed'
  },

  // --- Archery Shots ---
  'ARROW_1': {
    name: '🏹 속사 화살',
    desc: '원거리 정밀 화살을 쾌속 발사합니다. (1d8 + 1.5*DEX)',
    type: 'PROJECTILE',
    element: 'PHYSICAL',
    manaCost: 1,
    cooldown: 1,
    maxRange: 6.0,
    dice: '1d8',
    color: '#34d399',
    icon: '🏹',
    statKey: 'dexMod',
    statScale: 1.5
  },
  'ARROW_2': {
    name: '🏹 2연속 사격',
    desc: '화살 2발을 연속으로 격발하여 적을 꿰뚫습니다. (2d8 + 2.0*DEX)',
    type: 'PROJECTILE',
    element: 'PHYSICAL',
    manaCost: 2,
    cooldown: 2,
    maxRange: 6.5,
    dice: '2d8',
    color: '#10b981',
    icon: '🏹',
    statKey: 'dexMod',
    statScale: 2.0
  },
  'ARROW_3': {
    name: '🏹 3연속 사격',
    desc: '화살 3발을 맹렬히 쏟아붓습니다. (3d8 + 2.5*DEX)',
    type: 'PROJECTILE',
    element: 'PHYSICAL',
    manaCost: 4,
    cooldown: 3,
    maxRange: 7.0,
    dice: '3d8',
    color: '#059669',
    icon: '🏹',
    statKey: 'dexMod',
    statScale: 2.5
  },
  'ARROW_4': {
    name: '🏹 저격 일격 (Snipe)',
    desc: '치명적인 급소 저격 화살을 발사하여 방어구를 관통합니다. (5d8 + 3.0*DEX)',
    type: 'PROJECTILE',
    element: 'PHYSICAL',
    manaCost: 6,
    cooldown: 4,
    maxRange: 8.0,
    dice: '5d8',
    color: '#047857',
    icon: '🏹',
    statKey: 'dexMod',
    statScale: 3.0
  }
};

/**
 * ToME 2.3.5 정통 몬스터 공격(attacks) 변환 카탈로그
 */
export const TOME_ATTACK_DEFINITIONS = {
  'POISON_BITE': {
    name: '🩸 맹독 물기',
    desc: '적을 날카롭게 물어뜯어 중독 피해를 부여합니다. (피해 주사위 + 3턴 중독)',
    type: 'MELEE_STRIKE',
    element: 'POISON',
    manaCost: 2,
    cooldown: 2,
    maxRange: 1.5,
    color: '#10b981',
    icon: '🩸',
    poisonTurns: 3
  },
  'CRUSH_STRIKE': {
    name: '🔨 파쇄 강타',
    desc: '적의 뼈를 으스러뜨리는 1.5배의 묵직한 물리 파쇄 타격을 가합니다.',
    type: 'MELEE_STRIKE',
    element: 'PHYSICAL',
    manaCost: 2,
    cooldown: 2,
    maxRange: 1.5,
    color: '#f59e0b',
    icon: '🔨',
    multiplier: 1.5
  },
  'CLAW_SLASH': {
    name: '🐾 맹렬한 할퀴기',
    desc: '예리한 발톱으로 적을 빠르게 2연속 할퀴어 1.3배 피해를 가합니다.',
    type: 'MELEE_STRIKE',
    element: 'PHYSICAL',
    manaCost: 2,
    cooldown: 2,
    maxRange: 1.5,
    color: '#f43f5e',
    icon: '🐾',
    multiplier: 1.3
  },
  'STEAL_STRIKE': {
    name: '🗡️ 기습 찌르기',
    desc: '방심한 적의 급소를 찔러 방어력(AC)을 무시하고 1.4배 피해를 가합니다.',
    type: 'MELEE_STRIKE',
    element: 'PHYSICAL',
    manaCost: 2,
    cooldown: 2,
    maxRange: 1.5,
    color: '#38bdf8',
    icon: '🗡️',
    multiplier: 1.4,
    ignoreAC: true
  },
  'BASIC_STRIKE': {
    name: '⚔️ 본능 타격',
    desc: '종족 고유의 신체 능력으로 전방 적에게 1.2배의 타격을 가합니다.',
    type: 'MELEE_STRIKE',
    element: 'PHYSICAL',
    manaCost: 1,
    cooldown: 1,
    maxRange: 1.5,
    color: '#94a3b8',
    icon: '⚔️',
    multiplier: 1.2
  }
};

export class MonsterSpellFactory {
  static _cache = new Map();

  /**
   * ToME 몬스터 데이터로부터 1:1 4슬롯 고유 스킬 인스턴스를 도출합니다.
   * @param {string} speciesIdentifier - 'MON_NOVICE_MAGE', 'Novice warrior', 'ORC', 'HUMAN' 등
   * @returns {Array<ActiveSkill>} 4개의 ActiveSkill 인스턴스 배열 (슬롯 1, 2, 3, 4)
   */
  static createInnateSkills(speciesIdentifier) {
    if (!speciesIdentifier) speciesIdentifier = 'HUMAN';

    if (this._cache.has(speciesIdentifier)) {
      return this._cache.get(speciesIdentifier);
    }

    // 1. Resolve exact ToME monster entry from TomeMonstersData
    let monsterData = TOME_MONSTERS_DATA[speciesIdentifier];
    if (!monsterData) {
      for (const k in TOME_MONSTERS_DATA) {
        const item = TOME_MONSTERS_DATA[k];
        if (item.name === speciesIdentifier || item.key === speciesIdentifier) {
          monsterData = item;
          break;
        }
      }
    }

    const config = getSpeciesConfig(speciesIdentifier) || {};
    const rawSpells = (monsterData && monsterData.spells) || [];
    const rawAttacks = (monsterData && monsterData.attacks) || config.blows || [];
    const breathElement = (monsterData && monsterData.breathElement) || config.breathElement || null;

    // Filter valid castable spells (ignore 1_IN_* frequency markers)
    const validSpells = rawSpells.filter(s => !s.startsWith('1_IN_') && TOME_SPELL_DEFINITIONS[s]);

    const collectedSkills = [];

    // 2. Map Valid ToME Spells 1:1
    for (const spellKey of validSpells) {
      if (collectedSkills.length >= 4) break;
      const spec = TOME_SPELL_DEFINITIONS[spellKey];
      const slotNum = collectedSkills.length + 1;
      const reqMastery = slotNum <= 2 ? 1 : (slotNum === 3 ? 10 : 25);

      collectedSkills.push(new ActiveSkill({
        id: `${speciesIdentifier}_${spellKey}`,
        tomeKey: spellKey,
        slot: slotNum,
        requiredMastery: reqMastery,
        name: spec.name,
        desc: spec.desc,
        type: spec.type,
        element: spec.element,
        manaCost: spec.manaCost,
        cooldown: spec.cooldown,
        maxRange: spec.maxRange,
        dice: spec.dice || '2d6',
        color: spec.color,
        icon: spec.icon,
        execute: (game, player, target, skill) => this._executeGenericSpell(game, player, target, skill, spec)
      }));
    }

    // 3. If Breath Element exists and not yet added, add Canonical ToME Breath
    if (breathElement && collectedSkills.length < 4) {
      const breathKey = `BR_${breathElement}`;
      const breathSpec = TOME_SPELL_DEFINITIONS[breathKey] || TOME_SPELL_DEFINITIONS['BR_FIRE'];
      const slotNum = collectedSkills.length + 1;
      const reqMastery = slotNum <= 2 ? 1 : (slotNum === 3 ? 10 : 25);

      collectedSkills.push(new ActiveSkill({
        id: `${speciesIdentifier}_${breathKey}`,
        tomeKey: breathKey,
        slot: slotNum,
        requiredMastery: reqMastery,
        name: breathSpec.name,
        desc: breathSpec.desc,
        type: 'BREATH',
        element: breathElement,
        manaCost: breathSpec.manaCost,
        cooldown: breathSpec.cooldown,
        maxRange: breathSpec.maxRange,
        dice: breathSpec.dice || '4d10',
        color: breathSpec.color,
        icon: breathSpec.icon,
        execute: (game, player, target, skill) => this._executeBreathSpell(game, player, target, skill, breathElement)
      }));
    }

    // 4. If slots remain (< 4), convert ToME Attacks (blows) into active strike techniques
    for (const attack of rawAttacks) {
      if (collectedSkills.length >= 4) break;
      const method = attack.method || 'HIT';
      const effect = attack.effect || 'HURT';
      const damageDice = attack.damage || '1d4';

      let attackSpecKey = 'BASIC_STRIKE';
      if (effect === 'POISON') attackSpecKey = 'POISON_BITE';
      else if (method === 'CRUSH' || method === 'BUTT') attackSpecKey = 'CRUSH_STRIKE';
      else if (method === 'CLAW' || method === 'PECK') attackSpecKey = 'CLAW_SLASH';
      else if (method === 'TOUCH' || method === 'STING') attackSpecKey = 'STEAL_STRIKE';

      const spec = TOME_ATTACK_DEFINITIONS[attackSpecKey];
      const slotNum = collectedSkills.length + 1;
      const reqMastery = slotNum <= 2 ? 1 : (slotNum === 3 ? 10 : 25);

      collectedSkills.push(new ActiveSkill({
        id: `${speciesIdentifier}_ATK_${method}_${slotNum}`,
        tomeKey: `ATK_${method}`,
        slot: slotNum,
        requiredMastery: reqMastery,
        name: spec.name,
        desc: `${spec.desc} (기본 피해 주사위: ${damageDice})`,
        type: spec.type,
        element: spec.element,
        manaCost: spec.manaCost,
        cooldown: spec.cooldown,
        maxRange: spec.maxRange,
        dice: damageDice,
        color: spec.color,
        icon: spec.icon,
        execute: (game, player, target, skill) => this._executeAttackStrike(game, player, target, skill, spec, damageDice)
      }));
    }

    // 5. Fill any remaining slots up to 4 with Standard Innate Techniques
    while (collectedSkills.length < 4) {
      const slotNum = collectedSkills.length + 1;
      const reqMastery = slotNum <= 2 ? 1 : (slotNum === 3 ? 10 : 25);
      let fallbackKey = 'BASIC_STRIKE';
      if (slotNum === 3) fallbackKey = 'BLINK'; // Standard mobility
      else if (slotNum === 4) fallbackKey = 'CRUSH_STRIKE'; // Heavy smash

      const spec = TOME_SPELL_DEFINITIONS[fallbackKey] || TOME_ATTACK_DEFINITIONS[fallbackKey] || TOME_ATTACK_DEFINITIONS.BASIC_STRIKE;

      collectedSkills.push(new ActiveSkill({
        id: `${speciesIdentifier}_SLOT_${slotNum}`,
        tomeKey: fallbackKey,
        slot: slotNum,
        requiredMastery: reqMastery,
        name: spec.name,
        desc: spec.desc,
        type: spec.type,
        element: spec.element,
        manaCost: spec.manaCost || 2,
        cooldown: spec.cooldown || 2,
        maxRange: spec.maxRange || 1.5,
        dice: spec.dice || '1d6',
        color: spec.color || '#38bdf8',
        icon: spec.icon || '⚔️',
        execute: (game, player, target, skill) => spec.type === 'TELEPORT' ? this._executePhaseDoor(game, player, skill) : this._executeAttackStrike(game, player, target, skill, spec, '1d6')
      }));
    }

    this._cache.set(speciesIdentifier, collectedSkills);
    return collectedSkills;
  }

  // =========================================================================
  // TO ME EXECUTION ENGINES
  // =========================================================================
  static _findTarget(game, player, maxRange) {
    if (!game) return null;
    const monsterList = game.dungeon?.monsters || game.monsters || [];
    const candidates = monsterList.filter(m => {
      if (!m || !m.stats || m.stats.hp <= 0) return false;
      const dist = Math.hypot(m.x - player.x, m.y - player.y);
      if (dist > maxRange) return false;
      return game.map ? game.map.isTransparent(player.x, player.y, m.x, m.y) : true;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    return candidates[0];
  }

  static _executeGenericSpell(game, player, target, skill, spec) {
    if (spec.type === 'TELEPORT') {
      return this._executePhaseDoor(game, player, skill);
    }
    if (spec.type === 'SELF' && spec.element === 'HOLY') {
      return this._executeHeal(game, player, skill, spec);
    }
    if (spec.type === 'AOE') {
      return this._executeAoESpell(game, player, target, skill, spec);
    }

    const enemy = target || this._findTarget(game, player, skill.maxRange);
    if (!enemy) {
      if (game.addLogEntry) game.addLogEntry(`⚠️ [시전 실패] 사거리(${skill.maxRange}칸) 내에 조준할 적이 없습니다.`, 'combat');
      return false;
    }

    let dmg = 0;
    const parts = (spec.dice || '2d6').split('d');
    const count = parseInt(parts[0], 10) || 1;
    const sides = parseInt(parts[1], 10) || 6;
    for (let i = 0; i < count; i++) dmg += Math.floor(Math.random() * sides) + 1;

    const statBonus = Math.floor((player[spec.statKey] || player.intMod || 0) * (spec.statScale || 1.0));
    let totalDmg = Math.max(1, dmg + statBonus);

    if (player.getMorphMasteryLevel && player.getMorphMasteryLevel() >= 50) {
      totalDmg *= 2;
    }

    enemy.stats.hp -= totalDmg;
    if (enemy.markDirty) enemy.markDirty('ToME 스펠 피격');

    if (game.addLogEntry) {
      game.addLogEntry(`✨ [스킬 발동] <b>${skill.name}</b>! ${enemy.displayName}에게 <b>${totalDmg}</b>의 ${spec.element} 마법 피해! (HP: ${Math.max(0, enemy.stats.hp)}/${enemy.stats.maxHp})`, 'combat');
    }

    if (spec.statusEffect) {
      if (!enemy.debuffs) enemy.debuffs = { poison: 0, frost: 0, paralyzed: false, confusion: 0, blind: 0, slow: 0 };
      if (spec.statusEffect === 'poison') enemy.debuffs.poison = Math.max(enemy.debuffs.poison || 0, spec.poisonTurns || 3);
      else if (spec.statusEffect === 'paralyzed') enemy.debuffs.paralyzed = true;
      else if (spec.statusEffect === 'confusion') enemy.debuffs.confusion = 3;
      else if (spec.statusEffect === 'blind') enemy.debuffs.blind = 3;
      else if (spec.statusEffect === 'slow') enemy.debuffs.slow = 4;
    }

    if (enemy.stats.hp <= 0 && game.killMonster) {
      game.killMonster(enemy);
    }
    return true;
  }

  static _executeAttackStrike(game, player, target, skill, spec, dice) {
    const enemy = target || this._findTarget(game, player, skill.maxRange);
    if (!enemy) {
      if (game.addLogEntry) game.addLogEntry(`⚠️ [시전 실패] 인접한 적이 없습니다.`, 'combat');
      return false;
    }

    let dmg = 0;
    const parts = (dice || '1d4').split('d');
    const count = parseInt(parts[0], 10) || 1;
    const sides = parseInt(parts[1], 10) || 4;
    for (let i = 0; i < count; i++) dmg += Math.floor(Math.random() * sides) + 1;

    let totalDmg = Math.max(1, Math.floor((dmg + (player.strMod || 0)) * (spec.multiplier || 1.0)));
    if (player.getMorphMasteryLevel && player.getMorphMasteryLevel() >= 50) {
      totalDmg *= 2;
    }

    enemy.stats.hp -= totalDmg;
    if (enemy.markDirty) enemy.markDirty('ToME 물리 강타 피격');

    if (game.addLogEntry) {
      game.addLogEntry(`⚔️ [스킬 발동] <b>${skill.name}</b>! ${enemy.displayName}에게 <b>${totalDmg}</b>의 강타 피해!`, 'combat');
    }

    if (spec.poisonTurns) {
      if (!enemy.debuffs) enemy.debuffs = { poison: 0, frost: 0, paralyzed: false };
      enemy.debuffs.poison = Math.max(enemy.debuffs.poison || 0, spec.poisonTurns);
    }

    if (enemy.stats.hp <= 0 && game.killMonster) {
      game.killMonster(enemy);
    }
    return true;
  }

  static _executePhaseDoor(game, player, skill) {
    if (!game.map) return false;
    const candidates = [];
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        const dist = Math.hypot(dx, dy);
        if (dist >= 2.5 && dist <= 5.5) {
          const tx = player.x + dx;
          const ty = player.y + dy;
          if (game.map.isWalkable(tx, ty) && !game.isMonsterAt(tx, ty)) {
            candidates.push({ x: tx, y: ty });
          }
        }
      }
    }
    if (candidates.length === 0) return false;
    const dest = candidates[Math.floor(Math.random() * candidates.length)];
    player.x = dest.x;
    player.y = dest.y;

    if (game.addLogEntry) {
      game.addLogEntry(`💨 [스킬 발동] <b>${skill.name}</b>! 시공간을 왜곡하여 (${dest.x}, ${dest.y}) 위치로 즉시 점멸했습니다!`, 'loot');
    }
    return true;
  }

  static _executeHeal(game, player, skill, spec) {
    let healAmount = 0;
    const parts = (spec.dice || '2d10').split('d');
    const count = parseInt(parts[0], 10) || 2;
    const sides = parseInt(parts[1], 10) || 10;
    for (let i = 0; i < count; i++) healAmount += Math.floor(Math.random() * sides) + 1;
    healAmount += (player.wisMod || 0) * 2;

    const oldHp = player.stats.hp;
    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
    const recovered = player.stats.hp - oldHp;

    if (game.addLogEntry) {
      game.addLogEntry(`💚 [스킬 발동] <b>${skill.name}</b>! 신성한 치유력으로 <b>+${recovered} HP</b>를 회복했습니다! (HP: ${player.stats.hp}/${player.stats.maxHp})`, 'loot');
    }
    return true;
  }

  static _executeBreathSpell(game, player, target, skill, elem) {
    if (!game) return false;
    const monsterList = game.dungeon?.monsters || game.monsters || [];
    const enemiesInRange = monsterList.filter(m => {
      if (!m || !m.stats || m.stats.hp <= 0) return false;
      const dist = Math.hypot(m.x - player.x, m.y - player.y);
      return dist <= skill.maxRange && (game.map ? game.map.isTransparent(player.x, player.y, m.x, m.y) : true);
    });

    if (enemiesInRange.length === 0) {
      if (game.addLogEntry) game.addLogEntry(`⚠️ [브레스 실패] 전방 사거리에 적이 없습니다.`, 'combat');
      return false;
    }

    let baseBreath = 0;
    for (let i = 0; i < 4; i++) baseBreath += Math.floor(Math.random() * 10) + 1;
    let totalDmg = Math.max(5, baseBreath + (player.intMod || 0) * 3 + (player.conMod || 0) * 2);

    if (player.getMorphMasteryLevel && player.getMorphMasteryLevel() >= 50) {
      totalDmg *= 2;
    }

    if (game.addLogEntry) {
      game.addLogEntry(`🐉 [궁극기 발동] <b>${skill.name}</b>! ${elem} 브레스가 전방 ${enemiesInRange.length}마리에게 <b>${totalDmg}</b>의 광역 파멸 피해를 입혔습니다!`, 'combat');
    }

    enemiesInRange.forEach(m => {
      m.stats.hp -= totalDmg;
      if (m.markDirty) m.markDirty('브레스 피격');
      if (m.stats.hp <= 0 && game.killMonster) {
        game.killMonster(m);
      }
    });
    return true;
  }

  static _executeAoESpell(game, player, target, skill, spec) {
    const centerEnemy = target || this._findTarget(game, player, skill.maxRange);
    if (!centerEnemy) {
      if (game.addLogEntry) game.addLogEntry(`⚠️ [시전 실패] 사거리 내에 폭발 중심점이 될 적이 없습니다.`, 'combat');
      return false;
    }

    const monsterList = game.dungeon?.monsters || game.monsters || [];
    const enemiesInBlast = monsterList.filter(m => {
      if (!m || !m.stats || m.stats.hp <= 0) return false;
      return Math.hypot(m.x - centerEnemy.x, m.y - centerEnemy.y) <= 2.5;
    });

    let blastDmg = 0;
    const parts = (spec.dice || '10d10').split('d');
    const count = parseInt(parts[0], 10) || 10;
    const sides = parseInt(parts[1], 10) || 10;
    for (let i = 0; i < count; i++) blastDmg += Math.floor(Math.random() * sides) + 1;
    let totalDmg = Math.max(5, blastDmg + Math.floor((player.intMod || 0) * (spec.statScale || 3.0)));

    if (player.getMorphMasteryLevel && player.getMorphMasteryLevel() >= 50) {
      totalDmg *= 2;
    }

    if (game.addLogEntry) {
      game.addLogEntry(`💥 [궁극기 발동] <b>${skill.name}</b>! ${centerEnemy.displayName} 주변 반경에 폭풍이 몰아쳐 ${enemiesInBlast.length}마리에게 <b>${totalDmg}</b>의 광역 피해!`, 'combat');
    }

    enemiesInBlast.forEach(m => {
      m.stats.hp -= totalDmg;
      if (m.markDirty) m.markDirty('원소 폭풍 피격');
      if (m.stats.hp <= 0 && game.killMonster) {
        game.killMonster(m);
      }
    });
    return true;
  }
}
