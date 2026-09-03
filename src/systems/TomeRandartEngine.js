/**
 * @module TomeRandartEngine
 * @category systems
 * @description ToME 2.3.5 정통 파워 예산(Power Budget) 기반 절차적 랜덤 아티팩트(Randart) 생성 엔진.
 *              신다린/퀘냐 조합형 네이밍 및 스탯, 브랜드, 슬레이어, 저항, 특수 권능 절차적 합성
 * @purity Pure Factory
 * @dependencies Item.js
 * @exports TomeRandartEngine
 */

import { Item } from '../entities/Item.js';

const SINDARIN_PREFIXES = ['Celeb', 'Gild', 'Aeg', 'Mith', 'Gond', 'Mor', 'El', 'Tin', 'Bar', 'Dor'];
const SINDARIN_SUFFIXES = ['ir', 'ond', 'ion', 'ril', 'dur', 'gond', 'calen', 'mir', 'hel', 'fin'];
const EPIC_TITLES = ['Doomgiver', 'Soulkeeper', 'Lightbringer', 'Foehammer', 'Firefang', 'Icecleaver', 'Shadowbane', 'Lifeblessed', 'Foe-Reaper', 'Mornclash'];

export class TomeRandartEngine {
  /**
   * 신화적 톨킨풍 고유 명칭 생성 (신다린 조합형 또는 서사형 타이틀)
   * @param {string} baseName - 베이스 장비 명칭 (예: Broad Sword, Mithril Chain Mail)
   * @returns {string} 완성된 란다트 명칭
   */
  static generateName(baseName) {
    const clean = (baseName || 'Equipment').replace(/^[&]\s*/, '').replace(/[~#]/g, '').replace(/\s+/g, ' ').trim();
    if (Math.random() < 0.5) {
      const p = SINDARIN_PREFIXES[Math.floor(Math.random() * SINDARIN_PREFIXES.length)];
      const s = SINDARIN_SUFFIXES[Math.floor(Math.random() * SINDARIN_SUFFIXES.length)];
      return `${clean} '${p}${s}'`;
    } else {
      const title = EPIC_TITLES[Math.floor(Math.random() * EPIC_TITLES.length)];
      return `${clean} '${title}'`;
    }
  }

  /**
   * 베이스 아이템 종류(baseKind)와 던전 깊이를 기반으로 절차적 란다트(Randart) 생성
   * @param {number} x - 맵 X 좌표
   * @param {number} y - 맵 Y 좌표
   * @param {Object} baseKind - 베이스 아이템 템플릿(TomeKindsData 엔트리)
   * @param {number} [depth=30] - 현재 던전 층수
   * @returns {Item} 완성된 절차적 전설 유물 인스턴스
   */
  static createRandart(x, y, baseKind, depth = 30) {
    if (!baseKind) {
      baseKind = {
        name: 'Broad Sword',
        type: 'WEAPON',
        char: '|',
        slotType: 'WEAPON',
        dice: '2d5',
        cost: 200,
        tval: 23,
        sval: 10
      };
    }

    let budget = 40 + Math.floor(depth * 1.2) + Math.floor(Math.random() * 25);
    const randartName = this.generateName(baseKind.name);

    const statBonuses = { ...(baseKind.statBonuses || {}) };
    const flags = new Set(baseKind.flags || []);
    const specialTags = new Set(['ARTIFACT', 'RANDART']);

    const isWeapon = baseKind.type === 'WEAPON' || baseKind.slotType === 'WEAPON';
    const isBow = baseKind.type === 'BOW' || baseKind.slotType === 'BOW';
    const isArmor = ['ARMOR', 'SHIELD', 'HELMET', 'BOOTS', 'GLOVES', 'CLOAK'].includes(baseKind.type) ||
                    ['ARMOR', 'SHIELD', 'HELMET', 'BOOTS', 'GLOVES', 'CLOAK'].includes(baseKind.slotType);

    let toHit = (isWeapon || isBow) ? (Math.floor(Math.random() * 8) + 5) : 0;
    let toDmg = (isWeapon || isBow) ? (Math.floor(Math.random() * 8) + 5) : 0;
    let baseAC = (baseKind.baseAC || 0) + (isArmor ? (Math.floor(Math.random() * 10) + 5) : 0);

    // 파워 예산 소진 루프
    while (budget > 12) {
      const roll = Math.random();

      if (roll < 0.25 && budget >= 15) {
        // 1. 6대 기본 스탯 가산 (STR/DEX/CON/INT/WIS/CHR)
        const stats = ['str', 'dex', 'con', 'int', 'wis'];
        const st = stats[Math.floor(Math.random() * stats.length)];
        statBonuses[st] = (statBonuses[st] || 0) + Math.floor(Math.random() * 2) + 2;
        budget -= 15;
      } else if (roll < 0.45 && budget >= 25 && (isWeapon || isBow)) {
        // 2. 5대 원소 브랜드 (무기/활)
        const brands = ['BRAND_FIRE', 'BRAND_COLD', 'BRAND_ELEC', 'BRAND_ACID', 'BRAND_POIS'];
        const b = brands[Math.floor(Math.random() * brands.length)];
        flags.add(b);
        specialTags.add(b);
        budget -= 25;
      } else if (roll < 0.65 && budget >= 20 && (isWeapon || isBow)) {
        // 3. 종족 슬레이어 (무기/활)
        const slays = ['SLAY_EVIL', 'SLAY_DRAGON', 'SLAY_DEMON', 'SLAY_UNDEAD', 'SLAY_ORC', 'SLAY_GIANT'];
        const s = slays[Math.floor(Math.random() * slays.length)];
        flags.add(s);
        specialTags.add(s);
        budget -= 20;
      } else if (roll < 0.85 && budget >= 15) {
        // 4. 원소 및 특수 저항
        const resists = ['RES_FIRE', 'RES_COLD', 'RES_ELEC', 'RES_ACID', 'RES_POIS', 'RES_DARK', 'RES_LITE', 'RES_CONF', 'RES_NETHER'];
        const r = resists[Math.floor(Math.random() * resists.length)];
        flags.add(r);
        specialTags.add(r);
        budget -= 15;
      } else if (budget >= 30) {
        // 5. 하이엔드 특수 권능
        const powers = ['FREE_ACT', 'SEE_INVIS', 'TELEPATHY', 'REGEN', 'SPEED'];
        const p = powers[Math.floor(Math.random() * powers.length)];
        flags.add(p);
        specialTags.add(p);
        if (p === 'SPEED') {
          statBonuses.speed = (statBonuses.speed || 0) + Math.floor(Math.random() * 3) + 3;
        }
        budget -= 30;
      } else {
        budget -= 10;
      }
    }

    const type = baseKind.type || 'WEAPON';
    const slotType = baseKind.slotType || (isWeapon ? 'WEAPON' : (isBow ? 'BOW' : (isArmor ? 'ARMOR' : null)));
    const char = baseKind.char || (isWeapon ? '|' : (isBow ? '}' : (isArmor ? '[' : '~')));

    const item = new Item(
      x, y,
      type,
      char,
      '#ffd700',
      randartName,
      baseKind.lightBonus || (type === 'LAMP' ? 3 : 0),
      slotType,
      statBonuses,
      baseKind.dice || null,
      null,
      [],
      [],
      Array.from(specialTags),
      `미지의 대장장이가 빚어낸 세상에 단 하나뿐인 전설의 절차적 유물입니다. (깊이: ${depth}F)`
    );

    item.artifactKey = 'ART_RANDART_' + randartName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    item.tval = baseKind.tval;
    item.sval = baseKind.sval;
    item.toHit = toHit;
    item.toDmg = toDmg;
    item.baseAC = baseAC;
    item.cost = Math.max(5000, (baseKind.cost || 100) * 20);
    item.weight = baseKind.weight || 10;
    if (baseKind.multiplier) item.multiplier = baseKind.multiplier;
    item.flags = Array.from(flags);
    item.syncComponents();

    return item;
  }
}
