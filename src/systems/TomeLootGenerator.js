/**
 * @module TomeLootGenerator
 * @category systems
 * @description ToME 2.3.5 정통 알고리즘 기반 던전 깊이(Depth)별 아이템 롤링, 에고(Ego) 접사 합성 및 전설 유물(Artifact) 드랍 파이프라인 엔진
 * @purity Pure Loot Factory
 * @dependencies Item.js, Tags.js
 * @exports TomeLootGenerator
 */

import { Item } from '../entities/Item.js';
import { determineRarity, getRarityColor, rollTags } from '../entities/Tags.js';
import { TOME_KINDS_DATA } from '../entities/TomeKindsData.js';
import { TOME_ARTIFACTS_DATA } from '../entities/TomeArtifactsData.js';
import { TOME_EGOS_DATA } from '../entities/TomeEgosData.js';
import { DungeonValueBudgetEngine } from './DungeonValueBudgetEngine.js';

export class TomeLootGenerator {
  static _cachedKinds = Object.values(TOME_KINDS_DATA || {});
  static _cachedEgos = Object.values(TOME_EGOS_DATA || {});
  static _cachedArtifacts = Object.values(TOME_ARTIFACTS_DATA || {});

  /**
   * ToME 데이터셋 초기 로더 (호환성 유지용)
   */
  static async initDataset() {
    return true;
  }

  /**
   * 던전 층수(floor)에 맞는 ToME 바닥 아이템 1개를 절차적으로 생성합니다.
   * @param {number} x - 월드 X
   * @param {number} y - 월드 Y
   * @param {number} floor - 던전 층수 (1~100)
   * @param {boolean} isSpecialRoom - 보스룸 또는 비밀 금고 여부
   * @returns {Item}
   */
  static generateFloorItem(x, y, floor = 1, isSpecialRoom = false) {
    const danger = Math.max(1, floor);
    const tierConfig = DungeonValueBudgetEngine.getTierConfig(danger);

    // 1. 유물(Artifact) 드랍 판정 (1~5F는 0% 완전 차단, 6~20F 10%, 21~40F 20%, 41~50F 35%)
    const artChance = isSpecialRoom ? tierConfig.loot.artifactDropChanceSpecial : tierConfig.loot.artifactDropChanceNormal;
    if (this._cachedArtifacts && this._cachedArtifacts.length > 0 && Math.random() < artChance) {
      const validArts = this._cachedArtifacts.filter(a => a.level <= danger + 10);
      if (validArts.length > 0) {
        const art = validArts[Math.floor(Math.random() * validArts.length)];
        let type = art.type || 'WEAPON';
        let slotType = art.slotType || null;
        let char = art.char || '|';

        if (art.tval === 31 || type === 'GLOVES') {
          type = 'GLOVES';
          slotType = 'GLOVES';
          char = ']';
        } else if (art.tval === 34 || type === 'SHIELD') {
          type = 'SHIELD';
          slotType = 'SHIELD';
          char = ')';
        } else if (art.tval === 30 || type === 'BOOTS') {
          type = 'BOOTS';
          slotType = 'BOOTS';
          char = ']';
        } else if (art.tval === 35 || type === 'CLOAK') {
          type = 'CLOAK';
          slotType = 'CLOAK';
          char = '(';
        } else if (art.tval === 32 || art.tval === 33 || type === 'HELMET' || type === 'CROWN') {
          type = 'HELMET';
          slotType = 'HELMET';
          char = ']';
        } else if (art.tval === 36 || art.tval === 37 || art.tval === 38 || type === 'ARMOR') {
          type = 'ARMOR';
          slotType = 'ARMOR';
          char = '[';
        }

        const artifactItem = new Item(
          x, y,
          type,
          char,
          art.color || '#ffd700',
          art.name,
          art.type === 'LAMP' ? 3 : 0,
          slotType,
          art.statBonuses || {},
          art.dice,
          null,
          [],
          [],
          ['ARTIFACT', ...(art.specialTags || [])],
          art.flavorText || "고대 발리노르의 권능이 깃든 전설의 유물입니다."
        );
        artifactItem.artifactKey = art.key;
        if (art.tval !== undefined) artifactItem.tval = art.tval;
        if (art.sval !== undefined) artifactItem.sval = art.sval;
        if (typeof art.baseAC === 'number') {
          artifactItem.baseAC = art.baseAC;
        }
        if (typeof art.cost === 'number') {
          artifactItem.cost = art.cost;
        }
        if (typeof art.weight === 'number') {
          artifactItem.weight = art.weight;
        }
        if (art.flags && Array.isArray(art.flags)) {
          artifactItem.flags = [...art.flags];
        }
        artifactItem.syncComponents();
        return artifactItem;
      }
    }

    // 2. 기본 아이템 풀 추출
    let baseKind = null;
    if (this._cachedKinds && this._cachedKinds.length > 0) {
      const candidates = this._cachedKinds.filter(k => k.level <= danger + 4);
      if (candidates.length > 0) {
        baseKind = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // 폴백 기본 템플릿
    if (!baseKind) {
      const fallbackTemplates = [
        { name: "롱소드", type: "WEAPON", slotType: "WEAPON", char: "|", color: "#cbd5e1", dice: "1d8", statBonuses: { str: 2 }, flavorText: "날이 곧고 양날이 서 있는 정통 롱소드입니다." },
        { name: "브로드액스", type: "WEAPON", slotType: "WEAPON", char: "\\", color: "#94a3b8", dice: "2d4", statBonuses: { str: 3 }, flavorText: "묵직한 무게감으로 뼈를 부수는 양손 도끼입니다." },
        { name: "체인 메일", type: "ARMOR", slotType: "ARMOR", char: "[", color: "#64748b", statBonuses: { con: 3 }, flavorText: "촘촘한 쇠사슬을 엮어 만든 방어력이 우수한 갑옷입니다." },
        { name: "강철 투구", type: "HELMET", slotType: "HELMET", char: "]", color: "#94a3b8", statBonuses: { con: 2, dex: 1 }, flavorText: "머리를 단단히 보호하는 주조 강철 투구입니다." },
        { name: "기민의 반지", type: "RING", slotType: "RING", char: "=", color: "#fbbf24", statBonuses: { dex: 3 }, flavorText: "착용자의 반사신경을 기민하게 높여주는 마법 반지입니다." },
        { name: "수호의 목걸이", type: "AMULET", slotType: "AMULET", char: '"', color: "#38bdf8", statBonuses: { con: 2, int: 2 }, flavorText: "영혼을 안정시키고 방어력을 증폭하는 수호의 목걸이입니다." },
        { name: "백은의 마법 등불", type: "LAMP", slotType: "LIGHT", char: "~", color: "#eab308", lightBonus: 2, statBonuses: { int: 2 }, flavorText: "안개와 어둠을 꿰뚫는 마법의 등불입니다." },
        { name: "하급 체력 물약", type: "POTION", slotType: null, char: "!", color: "#f43f5e", flavorText: "상처를 빠르게 치유하는 붉은 물약입니다." },
        { name: "상급 체력 물약", type: "POTION", slotType: null, char: "!", color: "#a855f7", flavorText: "치명적인 상처도 즉시 봉합하는 보랏빛 영약입니다." },
        { name: "능력치 성장 영약", type: "POTION", slotType: null, char: "!", color: "#10b981", flavorText: "주인공의 잠재력을 영구적으로 증폭시키는 신비한 비약입니다." },
        { name: "무기 강화 주문서", type: "SCROLL", slotType: null, char: "?", color: "#fb7185", flavorText: "무기에 마법의 예리함을 각인하는 강화 주문서입니다." }
      ];
      baseKind = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
    }

    // 3. 에고(Ego) 접사 부여 판정 (티어별 에고 풀 분리)
    const egoChance = isSpecialRoom ? tierConfig.loot.egoChanceSpecial : tierConfig.loot.egoChanceNormal;
    const prefixes = [];
    const suffixes = [];
    const specialTags = [];

    if (Math.random() < egoChance && ['WEAPON', 'SHIELD', 'BOW', 'ARMOR', 'HELMET', 'GLOVES', 'BOOTS', 'CLOAK', 'RING', 'AMULET', 'LAMP'].includes(baseKind.type)) {
      const allowedPrefixes = tierConfig.loot.allowedEgoPrefixes || ["FIRE", "COLD", "LIGHTNING", "TOXIC", "IRON", "HOLY"];
      const allowedSuffixes = tierConfig.loot.allowedEgoSuffixes || ["SLAYER", "GALE", "AEGIS", "SAGE"];
      prefixes.push(allowedPrefixes[Math.floor(Math.random() * allowedPrefixes.length)]);
      if (Math.random() < 0.40 && allowedSuffixes.length > 0) {
        suffixes.push(allowedSuffixes[Math.floor(Math.random() * allowedSuffixes.length)]);
      }
      if (isSpecialRoom && danger >= 6 && Math.random() < 0.35) {
        specialTags.push("EXTRA_ATTACK");
      }
    }

    let type = baseKind.type;
    let slotType = baseKind.slotType;
    let char = baseKind.char || Item.getDefaultSymbol(type, slotType, baseKind.name);

    if (baseKind.tval === 31 || type === 'GLOVES') {
      type = 'GLOVES';
      slotType = 'GLOVES';
      char = ']';
    } else if (baseKind.tval === 34 || type === 'SHIELD') {
      type = 'SHIELD';
      slotType = 'SHIELD';
      char = ')';
    } else if (baseKind.tval === 30 || type === 'BOOTS') {
      type = 'BOOTS';
      slotType = 'BOOTS';
      char = ']';
    } else if (baseKind.tval === 35 || type === 'CLOAK') {
      type = 'CLOAK';
      slotType = 'CLOAK';
      char = '(';
    } else if (baseKind.tval === 32 || baseKind.tval === 33 || type === 'HELMET' || type === 'CROWN') {
      type = 'HELMET';
      slotType = 'HELMET';
      char = ']';
    } else if (baseKind.tval === 36 || baseKind.tval === 37 || baseKind.tval === 38 || type === 'ARMOR') {
      type = 'ARMOR';
      slotType = 'ARMOR';
      char = '[';
    }

    const item = new Item(
      x, y,
      type,
      char,
      baseKind.color || "#cbd5e1",
      baseKind.name,
      baseKind.lightBonus || (baseKind.type === 'LAMP' ? 2 : 0),
      slotType,
      baseKind.statBonuses || {},
      baseKind.dice || null,
      null,
      prefixes,
      suffixes,
      specialTags,
      baseKind.flavorText || "깊은 던전에서 발견된 ToME 장비입니다."
    );

    if (baseKind.tval !== undefined) item.tval = baseKind.tval;
    if (baseKind.sval !== undefined) item.sval = baseKind.sval;
    if (typeof baseKind.baseAC === 'number') item.baseAC = baseKind.baseAC;
    if (typeof baseKind.weight === 'number') item.weight = baseKind.weight;
    if (typeof baseKind.cost === 'number') item.cost = baseKind.cost;
    if (typeof baseKind.level === 'number') item.level = baseKind.level;
    if (baseKind.flags && Array.isArray(baseKind.flags)) item.flags = baseKind.flags;

    // 시그모이드 장비 인챈트(+to_h, +to_d, +to_a, pval) 산출 및 적용
    const enchants = DungeonValueBudgetEngine.calculateEnchantments(danger, type);
    item.to_h = enchants.to_h;
    item.to_d = enchants.to_d;
    item.to_a = enchants.to_a;
    item.pval = enchants.pval;
    item.toHit = (item.toHit || 0) + enchants.to_h;
    item.toDmg = (item.toDmg || 0) + enchants.to_d;
    if (enchants.to_a > 0) {
      item.baseAC = (item.baseAC || 0) + enchants.to_a;
    }
    if (enchants.pval > 0) {
      item.pval = enchants.pval;
    }

    if (item.tval === 65 || item.type === 'WAND') item.charges = 5;
    if (item.tval === 55 || item.type === 'STAFF') item.charges = 5;
    if (item.tval === 66 || item.type === 'ROD') item.timeout = 0;

    return item;
  }

  /**
   * 몬스터 처치 시 전리품(골드, 소모품, 에고 장비, 아티팩트)을 롤링하여 반환합니다.
   * @param {Object} monster - 처치된 몬스터
   * @param {number} floor - 현재 던전 층수
   * @returns {Array<Item>} 생성된 전리품 아이템 목록
   */
  static rollMonsterDrop(monster, floor = 1) {
    const drops = [];
    const mx = monster.x || 0;
    const my = monster.y || 0;
    const mLevel = monster.level || 1;
    const rarity = determineRarity(monster.prefixes || [], monster.suffixes || []);

    // 1. 드랍 횟수 판정
    let dropCount = 0;
    const isBoss = rarity === 'legendary' || rarity === 'epic' || (monster.displayName && (monster.displayName.includes("군단장") || monster.displayName.includes("추장") || monster.displayName.includes("대룡")));

    if (isBoss) {
      dropCount = Math.floor(Math.random() * 2) + 2; // 2 ~ 3개
    } else if (rarity === 'rare') {
      dropCount = Math.random() < 0.75 ? 2 : 1;
    } else if (rarity === 'uncommon') {
      dropCount = Math.random() < 0.55 ? 1 : 0;
    } else {
      dropCount = Math.random() < 0.35 ? 1 : 0;
    }

    for (let i = 0; i < dropCount; i++) {
      const offsetX = i === 0 ? 0 : (Math.random() > 0.5 ? 1 : -1);
      const offsetY = i === 0 ? 0 : (Math.random() > 0.5 ? 1 : -1);
      const item = this.generateFloorItem(mx + offsetX, my + offsetY, Math.max(floor, mLevel), isBoss);
      drops.push(item);
    }

    return drops;
  }

  // Alias for backward compatibility
  static generateLoot(x, y, depth = 1, isBossDrop = false) {
    return this.generateFloorItem(x, y, depth, isBossDrop);
  }
}
