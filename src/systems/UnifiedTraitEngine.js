/**
 * @module UnifiedTraitEngine
 * @category systems
 * @description TomeFlagResolver가 취합한 ToME 2.3.5 정통 플래그를 정밀 해석하여
 *              6대 스탯 보너스(str, int, wis, dex, con, chr), 21종 원소 저항률(%) 및 면역(Immunity),
 *              광원 반경(Lite Radius), 속도 보정(Speed), 슬레이(Slay) 및 브랜드(Brand) 공격 배율,
 *              상태이상 면역을 일괄 산출하는 순수 무상태 특성 판정 엔진.
 * @purity Stateless System
 * @dependencies TomeFlagResolver.js
 * @exports UnifiedTraitEngine
 */

import { TomeFlagResolver } from './TomeFlagResolver.js';

// 원소 매핑 및 표준 접두사 정의
const ELEMENT_MAP = {
  FIRE: { res: 'RES_FIRE', im: 'IM_FIRE', vuln: 'HURT_FIRE' },
  COLD: { res: 'RES_COLD', im: 'IM_COLD', vuln: 'HURT_COLD' },
  ELEC: { res: 'RES_ELEC', im: 'IM_ELEC', vuln: 'HURT_ELEC' },
  LIGHTNING: { res: 'RES_ELEC', im: 'IM_ELEC', vuln: 'HURT_ELEC' },
  ACID: { res: 'RES_ACID', im: 'IM_ACID', vuln: 'HURT_ACID' },
  POISON: { res: 'RES_POIS', im: 'IM_POIS', vuln: 'HURT_POIS' },
  NETHER: { res: 'RES_NETH', im: 'IM_NETH', vuln: null },
  CHAOS: { res: 'RES_CHAOS', im: null, vuln: null },
  DISENCHANT: { res: 'RES_DISEN', im: null, vuln: null },
  LIGHT: { res: 'RES_LITE', im: null, vuln: 'HURT_LITE' },
  LITE: { res: 'RES_LITE', im: null, vuln: 'HURT_LITE' },
  DARK: { res: 'RES_DARK', im: null, vuln: 'HURT_DARK' },
  NEXUS: { res: 'RES_NEXUS', im: null, vuln: null },
  SOUND: { res: 'RES_SOUND', im: null, vuln: null },
  SHARDS: { res: 'RES_SHARDS', im: null, vuln: null },
  CONFUSION: { res: 'RES_CONF', im: null, vuln: null },
  PLASMA: { res: 'RES_PLAS', im: null, vuln: null },
  WATER: { res: 'RES_WATER', im: 'IM_WATER', vuln: null },
  TIME: { res: 'RES_TIME', im: null, vuln: null },
  MANA: { res: null, im: null, vuln: null },
  DISINTEGRATION: { res: null, im: null, vuln: null },
  GRAVITY: { res: null, im: null, vuln: null },
  INERTIA: { res: null, im: null, vuln: null },
  FORCE: { res: null, im: null, vuln: null }
};

export class UnifiedTraitEngine {
  /**
   * 플래그 세트 또는 엔티티로부터 6대 스탯 보너스를 계산합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {Object} [directBonuses={}]
   * @returns {{ str: number, int: number, wis: number, dex: number, con: number, chr: number }}
   */
  static calculateStatBonuses(flagsOrEntity, directBonuses = {}) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    const bonuses = {
      str: directBonuses.str || 0,
      int: directBonuses.int || 0,
      wis: directBonuses.wis || 0,
      dex: directBonuses.dex || directBonuses.agl || 0,
      con: directBonuses.con || 0,
      chr: directBonuses.chr || directBonuses.cha || 0
    };

    // pval 스케일러 판정 (PVAL_M1=+1, PVAL_M2=+2, PVAL_M3=+3, PVAL_1=+1, PVAL_2=+2 ...)
    let pval = 1;
    if (flags.has('PVAL_5') || flags.has('PVAL_M5')) pval = 5;
    else if (flags.has('PVAL_4') || flags.has('PVAL_M4')) pval = 4;
    else if (flags.has('PVAL_3') || flags.has('PVAL_M3')) pval = 3;
    else if (flags.has('PVAL_2') || flags.has('PVAL_M2')) pval = 2;
    else if (flags.has('PVAL_1') || flags.has('PVAL_M1')) pval = 1;

    if (flags.has('STR')) bonuses.str += pval;
    if (flags.has('INT')) bonuses.int += pval;
    if (flags.has('WIS')) bonuses.wis += pval;
    if (flags.has('DEX')) bonuses.dex += pval;
    if (flags.has('CON')) bonuses.con += pval;
    if (flags.has('CHR') || flags.has('CHA')) bonuses.chr += pval;

    return bonuses;
  }

  /**
   * 특정 원소 속성에 대한 저항/면역 특성을 산출합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {string} element - 원소명 (e.g. 'FIRE', 'COLD', 'ELEC', 'ACID', 'POISON', 'NETHER' 등)
   * @returns {{ element: string, isImmune: boolean, isResistant: boolean, isVulnerable: boolean, resistancePercent: number, damageFactor: number }}
   */
  static getElementalTrait(flagsOrEntity, element) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    const upperEl = (element || 'PHYSICAL').toUpperCase();
    const mapping = ELEMENT_MAP[upperEl] || { res: `RES_${upperEl}`, im: `IM_${upperEl}`, vuln: `HURT_${upperEl}` };

    // 1. 원소 면역 (Immunity: 100% 감쇄, 피해 0)
    if (mapping.im && flags.has(mapping.im)) {
      return {
        element: upperEl,
        isImmune: true,
        isResistant: true,
        isVulnerable: false,
        resistancePercent: 100,
        damageFactor: 0.0
      };
    }

    // 2. 원소 취약 (Vulnerability: 1.5배 피해)
    if (mapping.vuln && flags.has(mapping.vuln)) {
      return {
        element: upperEl,
        isImmune: false,
        isResistant: false,
        isVulnerable: true,
        resistancePercent: -50,
        damageFactor: 1.50
      };
    }

    // 3. 일반 저항 (Resistance: 50% 감쇄 / 0.50 배율)
    if (mapping.res && flags.has(mapping.res)) {
      return {
        element: upperEl,
        isImmune: false,
        isResistant: true,
        isVulnerable: false,
        resistancePercent: 50,
        damageFactor: 0.50
      };
    }

    // 4. 일반 (무저항 / 1.0 배율)
    return {
      element: upperEl,
      isImmune: false,
      isResistant: false,
      isVulnerable: false,
      resistancePercent: 0,
      damageFactor: 1.0
    };
  }

  /**
   * 전 원소 저항 맵을 일괄 산출합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @returns {Object.<string, { isImmune: boolean, isResistant: boolean, resistancePercent: number, damageFactor: number }>}
   */
  static getAllElementalResistances(flagsOrEntity) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    const result = {};
    for (const elKey of Object.keys(ELEMENT_MAP)) {
      result[elKey] = this.getElementalTrait(flags, elKey);
    }
    return result;
  }

  /**
   * 원소 공격 피격 시 최종 대미지를 계산합니다.
   * @param {number} rawDamage
   * @param {string} element
   * @param {Set<string>|Object} flagsOrEntity
   * @returns {number}
   */
  static applyResistanceToDamage(rawDamage, element, flagsOrEntity) {
    if (rawDamage <= 0) return 0;
    const trait = this.getElementalTrait(flagsOrEntity, element);
    const finalDmg = Math.round(rawDamage * trait.damageFactor);
    return Math.max(0, finalDmg);
  }

  /**
   * 광원 반경(Lite Radius)을 계산합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {number} [baseRadius=0]
   * @returns {number}
   */
  static calculateLightRadius(flagsOrEntity, baseRadius = 0) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    let radius = baseRadius;

    if (flags.has('LITE3')) radius += 3;
    else if (flags.has('LITE2')) radius += 2;
    else if (flags.has('LITE1') || flags.has('LITE') || flags.has('HAS_LITE')) radius += 1;

    if (flags.has('DARKNESS')) radius -= 2;

    return Math.max(0, radius);
  }

  /**
   * 속도(Speed) 보정을 계산합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {number} [pval=0]
   * @returns {number}
   */
  static calculateSpeedBonus(flagsOrEntity, pval = 0) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    let speedBonus = 0;

    if (flags.has('SPEED')) {
      speedBonus += (pval > 0 ? pval : 2);
    }
    if (flags.has('HASTE') || flags.has('STATUS_HASTE')) {
      speedBonus += 5;
    }
    if (flags.has('SLOW') || flags.has('STATUS_SLOW')) {
      speedBonus -= 5;
    }
    if (flags.has('AGGRAVATE')) {
      speedBonus -= 1;
    }

    return speedBonus;
  }

  /**
   * 대상 몬스터에 대한 슬레이(Slay) 배율을 산출합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {Object} targetMonster
   * @returns {{ multiplier: number, bestSlay: string|null, activeSlays: string[] }}
   */
  static calculateSlayMultiplier(flagsOrEntity, targetMonster) {
    if (!targetMonster) return { multiplier: 1.0, bestSlay: null, activeSlays: [] };
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    const mFlags = TomeFlagResolver.collectFlagsFromMonster(targetMonster);

    const mType = (targetMonster.type || '').toUpperCase();
    const mName = (targetMonster.name || targetMonster.displayName || '').toUpperCase();

    let maxMult = 1.0;
    let bestSlay = null;
    const activeSlays = [];

    // 드래곤 (KILL=5.0x, SLAY=3.0x)
    const isDragon = mFlags.has('DRAGON') || mType.includes('DRAGON') || mName.includes('DRAGON') || mName.includes('WYRM') || mName.includes('DRAKE');
    if (isDragon) {
      if (flags.has('KILL_DRAGON')) {
        activeSlays.push('KILL_DRAGON');
        if (5.0 > maxMult) { maxMult = 5.0; bestSlay = '용족 섬멸 (Dragon Kill)'; }
      } else if (flags.has('SLAY_DRAGON')) {
        activeSlays.push('SLAY_DRAGON');
        if (3.0 > maxMult) { maxMult = 3.0; bestSlay = '용족 파멸 (Dragon Slay)'; }
      }
    }

    // 언데드 (KILL=4.0x, SLAY=2.5x)
    const isUndead = mFlags.has('UNDEAD') || mType.includes('UNDEAD') || mType.includes('SKELETON') || mType.includes('ZOMBIE') || mType.includes('GHOST') || mType.includes('LICH') || mName.includes('UNDEAD') || mName.includes('SKELETON') || mName.includes('LICH');
    if (isUndead) {
      if (flags.has('KILL_UNDEAD')) {
        activeSlays.push('KILL_UNDEAD');
        if (4.0 > maxMult) { maxMult = 4.0; bestSlay = '언데드 멸절 (Undead Kill)'; }
      } else if (flags.has('SLAY_UNDEAD')) {
        activeSlays.push('SLAY_UNDEAD');
        if (2.5 > maxMult) { maxMult = 2.5; bestSlay = '언데드 정화 (Undead Slay)'; }
      }
    }

    // 악마 / 악한 존재 (KILL=4.0x, SLAY=2.5x, SLAY_EVIL=2.0x)
    const isDemon = mFlags.has('DEMON') || mType.includes('DEMON') || mName.includes('DEMON') || mName.includes('BALROG') || mName.includes('DEVIL');
    const isEvil = mFlags.has('EVIL') || isDemon || isUndead || mType.includes('EVIL') || mName.includes('EVIL') || mName.includes('DARK');
    if (isDemon) {
      if (flags.has('KILL_DEMON')) {
        activeSlays.push('KILL_DEMON');
        if (4.0 > maxMult) { maxMult = 4.0; bestSlay = '악마 멸살 (Demon Kill)'; }
      } else if (flags.has('SLAY_DEMON')) {
        activeSlays.push('SLAY_DEMON');
        if (2.5 > maxMult) { maxMult = 2.5; bestSlay = '악마 퇴치 (Demon Slay)'; }
      }
    }
    if (isEvil && flags.has('SLAY_EVIL')) {
      activeSlays.push('SLAY_EVIL');
      if (2.0 > maxMult) { maxMult = 2.0; bestSlay = '사악 정벌 (Evil Slay)'; }
    }

    // 오크 (KILL=4.0x, SLAY=2.5x)
    const isOrc = mFlags.has('ORC') || mType.includes('ORC') || mType.includes('GOBLIN') || mName.includes('ORC') || mName.includes('GOBLIN');
    if (isOrc) {
      if (flags.has('KILL_ORC')) {
        activeSlays.push('KILL_ORC');
        if (4.0 > maxMult) { maxMult = 4.0; bestSlay = '오크 멸절 (Orc Kill)'; }
      } else if (flags.has('SLAY_ORC')) {
        activeSlays.push('SLAY_ORC');
        if (2.5 > maxMult) { maxMult = 2.5; bestSlay = '오크 척살 (Orc Slay)'; }
      }
    }

    // 거인 / 트롤 (2.5x)
    const isGiant = mFlags.has('GIANT') || mFlags.has('TROLL') || mType.includes('GIANT') || mType.includes('TROLL') || mType.includes('OGRE') || mName.includes('GIANT') || mName.includes('TROLL');
    if (isGiant) {
      if (flags.has('SLAY_GIANT') || flags.has('SLAY_TROLL')) {
        activeSlays.push('SLAY_GIANT');
        if (2.5 > maxMult) { maxMult = 2.5; bestSlay = '거인 분쇄 (Giant Slay)'; }
      }
    }

    // 동물 / 야수 (2.0x)
    const isAnimal = mFlags.has('ANIMAL') || mType.includes('BAT') || mType.includes('CANINE') || mType.includes('SPIDER') || mType.includes('SNAKE') || mType.includes('WOLF') || mName.includes('BAT') || mName.includes('WOLF');
    if (isAnimal && flags.has('SLAY_ANIMAL')) {
      activeSlays.push('SLAY_ANIMAL');
      if (2.0 > maxMult) { maxMult = 2.0; bestSlay = '야수 사냥 (Animal Slay)'; }
    }

    return { multiplier: maxMult, bestSlay, activeSlays };
  }

  /**
   * 원소 브랜드(Brand) 공격 추가 대미지를 계산합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {number} baseDamage
   * @returns {{ activeBrands: string[], totalExtraDamage: number, chosenBrand: Object|null, multiplier: number }}
   */
  static calculateBrandDamage(flagsOrEntity, baseDamage) {
    if (baseDamage <= 0) return { activeBrands: [], totalExtraDamage: 0, chosenBrand: null, multiplier: 1.0 };
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);

    const brands = [];
    if (flags.has('BRAND_FIRE') || flags.has('FIRE')) {
      brands.push({ element: 'FIRE', name: '화염 브랜드 (Fire Brand)', bonus: 0.50 });
    }
    if (flags.has('BRAND_COLD') || flags.has('COLD')) {
      brands.push({ element: 'COLD', name: '냉기 브랜드 (Cold Brand)', bonus: 0.50 });
    }
    if (flags.has('BRAND_ELEC') || flags.has('LIGHTNING')) {
      brands.push({ element: 'LIGHTNING', name: '전격 브랜드 (Elec Brand)', bonus: 0.50 });
    }
    if (flags.has('BRAND_ACID')) {
      brands.push({ element: 'ACID', name: '산성 브랜드 (Acid Brand)', bonus: 0.50 });
    }
    if (flags.has('BRAND_POIS') || flags.has('TOXIC')) {
      brands.push({ element: 'POISON', name: '맹독 브랜드 (Poison Brand)', bonus: 0.40 });
    }
    if (flags.has('BRAND_MANA') || flags.has('MANA')) {
      brands.push({ element: 'MANA', name: '마나 브랜드 (Mana Brand)', bonus: 0.60 });
    }

    if (brands.length === 0) {
      return { activeBrands: [], totalExtraDamage: 0, chosenBrand: null, multiplier: 1.0 };
    }

    const chosen = brands[Math.floor(Math.random() * brands.length)];
    const extraDamage = Math.max(1, Math.floor(baseDamage * chosen.bonus));

    return {
      activeBrands: brands.map(b => b.name),
      totalExtraDamage: extraDamage,
      chosenBrand: chosen,
      multiplier: 1.0 + chosen.bonus
    };
  }

  /**
   * 상태이상 면역 및 편의 특성 세트를 취합합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @returns {{ freeAction: boolean, noConfusion: boolean, noSleep: boolean, noFear: boolean, noBlind: boolean, noStun: boolean, holdLife: boolean, reflect: boolean, seeInvis: boolean, telepathy: boolean, regeneration: boolean, featherFall: boolean, slowDigest: boolean, canFly: boolean, passWall: boolean }}
   */
  static getStatusImmunities(flagsOrEntity) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    return {
      freeAction: flags.has('FREE_ACT') || flags.has('IM_PARALYZE') || flags.has('NO_PARALYZE'),
      noConfusion: flags.has('NO_CONF') || flags.has('RES_CONF') || flags.has('IM_CONF'),
      noSleep: flags.has('NO_SLEEP'),
      noFear: flags.has('NO_FEAR') || flags.has('RES_FEAR') || flags.has('IM_FEAR') || flags.has('HERO') || flags.has('STATUS_HERO'),
      noBlind: flags.has('NO_BLIND') || flags.has('RES_BLIND') || flags.has('IM_BLIND'),
      noStun: flags.has('NO_STUN'),
      holdLife: flags.has('HOLD_LIFE'),
      reflect: flags.has('REFLECT'),
      seeInvis: flags.has('SEE_INVIS') || flags.has('STATUS_SEE_INVIS') || flags.has('TELEPATHY') || flags.has('ESP_ALL'),
      telepathy: flags.has('TELEPATHY') || flags.has('ESP_ALL'),
      regeneration: flags.has('REGEN') || flags.has('REGENERATE'),
      featherFall: flags.has('FEATHER'),
      slowDigest: flags.has('SLOW_DIGEST'),
      canFly: flags.has('CAN_FLY') || flags.has('FLYING'),
      passWall: flags.has('PASS_WALL')
    };
  }

  /**
   * 스탯 유지(Sustain) 플래그를 취합합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @returns {{ str: boolean, int: boolean, wis: boolean, dex: boolean, con: boolean, chr: boolean }}
   */
  static getSustainedStats(flagsOrEntity) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    return {
      str: flags.has('SUST_STR'),
      int: flags.has('SUST_INT'),
      wis: flags.has('SUST_WIS'),
      dex: flags.has('SUST_DEX'),
      con: flags.has('SUST_CON'),
      chr: flags.has('SUST_CHR')
    };
  }

  /**
   * 광원 반경(Light Radius)을 연산합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {number} [baseRadius=1]
   * @returns {number} 최종 광원 반경
   */
  static calculateLightRadius(flagsOrEntity, baseRadius = 1) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    let radius = baseRadius;

    if (flags.has('LITE3')) radius += 3;
    else if (flags.has('LITE2')) radius += 2;
    else if (flags.has('LITE') || flags.has('LITE1') || flags.has('HAS_LITE')) radius += 1;

    if (flags.has('DARKNESS')) radius = Math.max(0, radius - 2);
    else if (flags.has('DARK')) radius = Math.max(0, radius - 1);

    if (flagsOrEntity && typeof flagsOrEntity === 'object') {
      if (flagsOrEntity.mimicCore && typeof flagsOrEntity.mimicCore.lightBonus === 'number') {
        radius += flagsOrEntity.mimicCore.lightBonus;
      }
      if (flagsOrEntity.equippedLamp) {
        const lamp = flagsOrEntity.equippedLamp;
        if (typeof lamp.lightBonus === 'number') radius += lamp.lightBonus;
        else if (typeof lamp.lightRadius === 'number') radius += lamp.lightRadius;
      }
    }

    return Math.max(0, radius);
  }

  /**
   * 행동 속도 가속도(Speed Bonus)를 취합합니다.
   * @param {Set<string>|Object} flagsOrEntity
   * @param {number} [pval=0]
   * @returns {number}
   */
  static calculateSpeedBonus(flagsOrEntity, pval = 0) {
    const flags = flagsOrEntity instanceof Set ? flagsOrEntity : TomeFlagResolver.collectFlagsFromEntity(flagsOrEntity);
    let effectivePval = pval;
    if (effectivePval === 0) {
      for (const f of flags) {
        if (f.startsWith('PVAL_')) {
          effectivePval = parseInt(f.replace('PVAL_', ''), 10) || 0;
        }
      }
    }

    let bonus = 0;
    if (flags.has('SPEED')) bonus += (effectivePval > 0 ? effectivePval : 3);
    if (flags.has('HASTE')) bonus += 5;
    if (flags.has('SLOW')) bonus -= (effectivePval > 0 ? effectivePval : 5);
    return bonus;
  }
}
