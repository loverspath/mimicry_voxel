/**
 * @module TomeEgoEngine
 * @category systems
 * @description ToME 2.3.5 정통 101종 에고 및 183종 유물의 슬레이(Slay), 속성 브랜드(Brand), 저항(Resist), 
 *              상태이상 면역(Free Action), 투시(See Invisible), 초재생(Regen) 등 전투/생존 플래그 판정 엔진
 * @purity Stateless System
 * @exports TomeEgoEngine
 */

export class TomeEgoEngine {
  /**
   * 플레이어가 장착 중인 모든 장비의 플래그(flags), 특수 태그(specialTags), 접사(prefixes/suffixes)를 취합합니다.
   * @param {Object} player - 플레이어 인스턴스
   * @returns {Set<string>} 취합된 고유 플래그 세트
   */
  static collectPlayerFlags(player) {
    const flags = new Set();
    if (!player || !player.equipment) return flags;

    const allSlots = [
      player.equipment.weapon,
      player.equipment.shield,
      player.equipment.armor,
      player.equipment.helmet,
      player.equipment.gloves,
      player.equipment.boots,
      player.equipment.cloak,
      player.equipment.ring,
      player.equipment.amulet,
      player.equipment.bow,
      player.equipment.quiver,
      player.equippedLamp
    ];

    for (const item of allSlots) {
      if (!item) continue;
      if (item.flags && Array.isArray(item.flags)) {
        for (const f of item.flags) flags.add(f);
      }
      if (item.specialTags && Array.isArray(item.specialTags)) {
        for (const t of item.specialTags) flags.add(t);
      }
      if (item.prefixes && Array.isArray(item.prefixes)) {
        for (const p of item.prefixes) {
          flags.add(`PREFIX_${p}`);
          if (p === 'FIRE') flags.add('BRAND_FIRE');
          if (p === 'COLD') flags.add('BRAND_COLD');
          if (p === 'LIGHTNING') flags.add('BRAND_ELEC');
          if (p === 'TOXIC') flags.add('BRAND_POIS');
          if (p === 'HOLY') flags.add('SLAY_EVIL');
        }
      }
      if (item.suffixes && Array.isArray(item.suffixes)) {
        for (const s of item.suffixes) {
          flags.add(`SUFFIX_${s}`);
          if (s === 'SLAYER') {
            flags.add('SLAY_ORC');
            flags.add('SLAY_ANIMAL');
          }
        }
      }
    }

    return flags;
  }

  /**
   * 특정 몬스터를 공격할 때 적용되는 슬레이(Slay) 배율과 명칭을 계산합니다.
   * @param {Object} player - 플레이어 인스턴스
   * @param {Object} monster - 대상 몬스터 인스턴스
   * @returns {{ multiplier: number, slayType: string|null }} 슬레이 결과
   */
  static getSlayMultiplier(player, monster) {
    if (!player || !monster) return { multiplier: 1.0, slayType: null };

    const flags = this.collectPlayerFlags(player);
    const mType = (monster.type || '').toUpperCase();
    const mName = (monster.name || monster.displayName || '').toUpperCase();

    let maxMult = 1.0;
    let bestSlay = null;

    // 1. 드래곤 슬레이 (3.0배)
    if (flags.has('SLAY_DRAGON') || flags.has('KILL_DRAGON')) {
      if (mType.includes('DRAGON') || mName.includes('DRAGON') || mName.includes('WYRM') || mName.includes('DRAKE')) {
        if (3.0 > maxMult) {
          maxMult = 3.0;
          bestSlay = '용족 파멸 (Dragon Slay)';
        }
      }
    }

    // 2. 언데드 슬레이 (2.5배)
    if (flags.has('SLAY_UNDEAD')) {
      if (mType.includes('UNDEAD') || mType.includes('SKELETON') || mType.includes('ZOMBIE') || mType.includes('GHOST') || mType.includes('LICH') || mName.includes('UNDEAD') || mName.includes('SKELETON') || mName.includes('ZOMBIE')) {
        if (2.5 > maxMult) {
          maxMult = 2.5;
          bestSlay = '언데드 정화 (Undead Slay)';
        }
      }
    }

    // 3. 오크/고블린 슬레이 (2.5배)
    if (flags.has('SLAY_ORC') || flags.has('KILL_ORC')) {
      if (mType.includes('ORC') || mType.includes('GOBLIN') || mName.includes('ORC') || mName.includes('GOBLIN') || mName.includes('오크') || mName.includes('고블린')) {
        if (2.5 > maxMult) {
          maxMult = 2.5;
          bestSlay = '오크 척살 (Orc Slay)';
        }
      }
    }

    // 4. 거인/트롤/오우거 슬레이 (2.5배)
    if (flags.has('SLAY_GIANT') || flags.has('SLAY_TROLL')) {
      if (mType.includes('GIANT') || mType.includes('TROLL') || mType.includes('OGRE') || mName.includes('GIANT') || mName.includes('TROLL') || mName.includes('OGRE')) {
        if (2.5 > maxMult) {
          maxMult = 2.5;
          bestSlay = '거인 분쇄 (Giant Slay)';
        }
      }
    }

    // 5. 동물/야수 슬레이 (2.0배)
    if (flags.has('SLAY_ANIMAL')) {
      if (mType.includes('BAT') || mType.includes('CANINE') || mType.includes('SPIDER') || mType.includes('SNAKE') || mType.includes('WOLF') || mName.includes('BAT') || mName.includes('WOLF') || mName.includes('SPIDER')) {
        if (2.0 > maxMult) {
          maxMult = 2.0;
          bestSlay = '야수 사냥 (Animal Slay)';
        }
      }
    }

    // 6. 악마/사악한 존재 슬레이 (2.0배)
    if (flags.has('SLAY_EVIL') || flags.has('SLAY_DEMON')) {
      if (mType.includes('DEMON') || mType.includes('IMP') || mName.includes('DEMON') || mName.includes('DEVIL') || mName.includes('DARK')) {
        if (2.0 > maxMult) {
          maxMult = 2.0;
          bestSlay = '악마 퇴치 (Demon Slay)';
        }
      }
    }

    return { multiplier: maxMult, slayType: bestSlay };
  }

  /**
   * 공격 시 발동하는 원소 브랜드(Brand) 추가 피해를 계산합니다.
   * @param {Object} player - 플레이어 인스턴스
   * @param {number} baseDmg - 기본 물리 피해량
   * @returns {{ extraDmg: number, element: string|null, brandName: string|null }}
   */
  static getBrandDamage(player, baseDmg) {
    if (!player || baseDmg <= 0) return { extraDmg: 0, element: null, brandName: null };

    const flags = this.collectPlayerFlags(player);
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
    if (flags.has('BRAND_POIS') || flags.has('TOXIC')) {
      brands.push({ element: 'POISON', name: '맹독 브랜드 (Poison Brand)', bonus: 0.40 });
    }
    if (flags.has('BRAND_ACID')) {
      brands.push({ element: 'ACID', name: '산성 브랜드 (Acid Brand)', bonus: 0.50 });
    }

    if (brands.length === 0) return { extraDmg: 0, element: null, brandName: null };

    // 활성화된 브랜드 중 하나 발동
    const chosen = brands[Math.floor(Math.random() * brands.length)];
    const extraDmg = Math.max(1, Math.floor(baseDmg * chosen.bonus));

    return { extraDmg, element: chosen.element, brandName: chosen.name };
  }

  /**
   * 플레이어가 마비 면역(Free Action)을 보유하고 있는지 확인합니다.
   */
  static hasFreeAction(player) {
    const flags = this.collectPlayerFlags(player);
    return flags.has('FREE_ACT');
  }

  /**
   * 플레이어가 투시(See Invisible)를 보유하고 있는지 확인합니다.
   */
  static hasSeeInvisible(player) {
    const flags = this.collectPlayerFlags(player);
    return flags.has('SEE_INVIS') || flags.has('TELEPATHY');
  }

  /**
   * 플레이어가 초재생(Regeneration)을 보유하고 있는지 확인합니다.
   */
  static hasRegeneration(player) {
    const flags = this.collectPlayerFlags(player);
    return flags.has('REGEN');
  }

  /**
   * 플레이어가 특정 원소 속성에 저항을 보유하고 있는지 확인합니다.
   */
  static hasElementalResistance(player, element) {
    if (!player || !element) return false;
    const flags = this.collectPlayerFlags(player);
    const upperEl = element.toUpperCase();

    if (upperEl === 'FIRE' && (flags.has('RES_FIRE') || flags.has('IM_FIRE'))) return true;
    if (upperEl === 'COLD' && (flags.has('RES_COLD') || flags.has('IM_COLD'))) return true;
    if (upperEl === 'LIGHTNING' || upperEl === 'ELEC') {
      if (flags.has('RES_ELEC') || flags.has('IM_ELEC')) return true;
    }
    if (upperEl === 'POISON' && (flags.has('RES_POIS') || flags.has('IM_POIS'))) return true;
    if (upperEl === 'ACID' && (flags.has('RES_ACID') || flags.has('IM_ACID'))) return true;
    if (upperEl === 'LIGHT' && flags.has('RES_LITE')) return true;
    if (upperEl === 'DARK' && flags.has('RES_DARK')) return true;

    return false;
  }
}
