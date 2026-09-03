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
import { TomeRandartEngine } from './TomeRandartEngine.js';

export class TomeLootGenerator {
  static _cachedKinds = Object.values(TOME_KINDS_DATA || {}).filter(k =>
    k && k.tval !== 102 && k.key !== 'KIND_RANDOM_ARTIFACT'
  );
  static _cachedEgos = Object.values(TOME_EGOS_DATA || {});
  static _cachedArtifacts = Object.values(TOME_ARTIFACTS_DATA || {});

  /**
   * Angband/ToME 포맷 토큰(&, ~, #)을 제거하고 깨끗한 표준 아이템 명칭으로 정제합니다.
   * @param {string} name - 원시 아이템 명칭 (예: '& Short Bow~', '& Cloak~ of Mimicry', '& #~')
   * @returns {string} 정제된 아이템 명칭
   */
  static cleanItemName(name) {
    if (!name || typeof name !== 'string') return 'Item';
    return name
      .replace(/^[&]\s*/, '')      // Angband 관사 토큰 & 제거
      .replace(/~/g, '')           // Angband 복수형 변환 토큰 ~ 제거
      .replace(/#+/g, '')          // Angband 템플릿 토큰 # 제거
      .replace(/\s+/g, ' ')        // 연속 공백 단일화
      .trim();
  }

  /**
   * 3대 랜덤 플래그(RANDOM_RESIST, RANDOM_POWER, RANDOM_RES_OR_POWER)를 구체적인 저항 및 권능 플래그로 100% 치환합니다.
   * @param {string[]} flags - 원본 플래그 배열
   * @returns {string[]} 치환 완료된 고유 플래그 배열
   */
  static resolveRandomFlags(flags) {
    const flagSet = new Set(flags || []);

    while (flagSet.has('RANDOM_RESIST')) {
      flagSet.delete('RANDOM_RESIST');
      const r = Math.random();
      let res;
      if (r < 0.60) {
        const base4 = ['RES_FIRE', 'RES_COLD', 'RES_ELEC', 'RES_ACID'];
        res = base4[Math.floor(Math.random() * base4.length)];
      } else if (r < 0.88) {
        const adv = ['RES_POIS', 'RES_DARK', 'RES_LITE', 'RES_FEAR'];
        res = adv[Math.floor(Math.random() * adv.length)];
      } else {
        const high = ['RES_CONF', 'RES_SOUND', 'RES_SHARDS', 'RES_NETHER', 'RES_NEXUS', 'RES_CHAOS'];
        res = high[Math.floor(Math.random() * high.length)];
      }
      flagSet.add(res);
    }

    while (flagSet.has('RANDOM_POWER')) {
      flagSet.delete('RANDOM_POWER');
      const powers = [
        { flag: 'FREE_ACT', w: 20 },
        { flag: 'SEE_INVIS', w: 20 },
        { flag: 'SLOW_DIGEST', w: 15 },
        { flag: 'REGEN', w: 15 },
        { flag: 'FEATHER', w: 10 },
        { flag: 'TELEPATHY', w: 8 },
        { flag: 'SPEED', w: 7 },
        { flag: 'EXTRA_ATTACK', w: 5 }
      ];
      const totalW = powers.reduce((acc, p) => acc + p.w, 0);
      let rollW = Math.random() * totalW;
      let chosen = powers[0].flag;
      for (const p of powers) {
        if (rollW < p.w) {
          chosen = p.flag;
          break;
        }
        rollW -= p.w;
      }
      flagSet.add(chosen);
    }

    while (flagSet.has('RANDOM_RES_OR_POWER')) {
      flagSet.delete('RANDOM_RES_OR_POWER');
      if (Math.random() < 0.5) {
        flagSet.add('RANDOM_RESIST');
      } else {
        flagSet.add('RANDOM_POWER');
      }
    }

    if (flagSet.has('RANDOM_RESIST') || flagSet.has('RANDOM_POWER')) {
      return this.resolveRandomFlags(Array.from(flagSet));
    }

    return Array.from(flagSet);
  }

  /**
   * 베이스 장비명과 아티팩트 rawName을 ToME 정통 4대 네이밍 룰에 따라 결합합니다.
   * @param {Object} art - 아티팩트 데이터 객체
   * @param {string} [baseName=null] - 베이스 장비명
   * @returns {string} 완성된 아티팩트 정통 명칭
   */
  static getArtifactDisplayName(art, baseName = null) {
    let base = baseName;
    if (!base) {
      const match = this._cachedKinds.find(k => k.tval === art.tval && k.sval === art.sval);
      if (match && match.name) {
        base = this.cleanItemName(match.name);
      } else {
        if (art.tval === 45 || art.type === 'RING') base = 'Ring';
        else if (art.tval === 40 || art.type === 'AMULET') base = 'Amulet';
        else if (art.tval === 39 || art.type === 'LAMP') {
          if (art.key === 'ART_OF_GALADRIEL') base = 'The Phial';
          else if (art.key === 'ART_OF_MINAS_ITHIL') base = 'The Palantir';
          else if (art.key === 'ART_OF_SPACE_TIME') base = 'The Stone';
          else base = 'Phial';
        } else {
          base = art.type || 'Artifact';
        }
      }
    } else {
      base = this.cleanItemName(base);
    }

    const raw = this.cleanItemName((art.rawName || art.name || '').replace(/^유물:\s*/, ''));

    let finalName = '';
    if (art.flags && art.flags.includes('HIDE_TYPE')) {
      if (raw.startsWith('of ') || raw.startsWith('the ')) {
        finalName = `${base} ${raw}`;
      } else {
        finalName = raw;
      }
    } else if (raw.startsWith('of ') || raw.startsWith('the ')) {
      finalName = `${base} ${raw}`;
    } else if (raw.startsWith("'") && raw.endsWith("'")) {
      finalName = `${base} ${raw}`;
    } else if (raw.includes("'")) {
      finalName = `${base} ${raw}`;
    } else {
      finalName = `${base} of ${raw}`;
    }

    return this.cleanItemName(finalName);
  }

  static _egoPools = null;

  static _initEgoPools() {
    if (this._egoPools) return;
    const egos = this._cachedEgos || Object.values(TOME_EGOS_DATA || {});
    this._egoPools = {
      weapon: egos.filter(e =>
        (e.flags && e.flags.some(f => f.startsWith('BRAND_') || f.startsWith('SLAY_') || f === 'VORPAL' || f === 'BLOWS')) ||
        /Flame|Frost|Lightning|Acid|Venom|Westernesse|Slay|Defender|Vampiric|Gondolin|Accuracy|Sharp|Earthquakes|Chaotic/i.test(e.name)
      ),
      bow: egos.filter(e =>
        /Extra Might|Extra Shots|Accuracy|Velocity|Westernesse/i.test(e.name)
      ),
      boots: egos.filter(e =>
        /Speed|Free Action|Stealth|Agility|Levitation/i.test(e.name)
      ),
      armor: egos.filter(e =>
        (e.flags && e.flags.some(f => f.startsWith('RES_') || f === 'REFLECT' || f === 'STEALTH' || f === 'FREE_ACT')) ||
        /Resistance|Elven|Dwarven|Protection|Reflection|Noldor|Aman/i.test(e.name)
      ),
      jewelry: egos.filter(e =>
        /Might|Lordliness|Wisdom|Intelligence|Regeneration|Power/i.test(e.name)
      ),
      general: egos
    };
  }

  static _getEgosForSlot(type, slotType) {
    if (!this._egoPools) this._initEgoPools();
    const t = (slotType || type || '').toUpperCase();
    if (t === 'WEAPON') return this._egoPools.weapon;
    if (t === 'BOW') return this._egoPools.bow;
    if (t === 'BOOTS') return this._egoPools.boots;
    if (['ARMOR', 'SHIELD', 'HELMET', 'CLOAK', 'GLOVES'].includes(t)) return this._egoPools.armor;
    if (['RING', 'AMULET'].includes(t)) return this._egoPools.jewelry;
    return this._egoPools.general;
  }

  /**
   * ToME 데이터셋 초기 로더 (호환성 유지용)
   */
  static async initDataset() {
    return true;
  }

  /**
   * 고정 아티팩트(Artifact) 인스턴스를 생성합니다. 베이스 장비명 결합 및 3대 랜덤 플래그를 100% 치환합니다.
   * @param {number} x 
   * @param {number} y 
   * @param {Object} art 
   * @param {number} [danger=20] 
   * @returns {Item}
   */
  static _createArtifactItemInstance(x, y, art, danger = 20) {
    if (!art) return null;
    let type = art.type || 'WEAPON';
    let slotType = art.slotType || null;
    let char = art.char || '|';

    const baseKind = this._cachedKinds.find(k => k.tval === art.tval && k.sval === art.sval);
    const finalName = this.getArtifactDisplayName(art, baseKind?.name);
    const resolvedFlags = this.resolveRandomFlags(art.flags);

    if (art.tval === 19 || type === 'BOW' || baseKind?.type === 'BOW') {
      type = 'BOW';
      slotType = 'BOW';
      char = '}';
    } else if (art.tval === 31 || type === 'GLOVES') {
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
    } else if (art.tval === 45 || type === 'RING') {
      type = 'RING';
      slotType = 'RING';
      char = '=';
    } else if (art.tval === 40 || type === 'AMULET') {
      type = 'AMULET';
      slotType = 'AMULET';
      char = '"';
    }

    const statBonuses = { ...(art.statBonuses || {}) };
    if (resolvedFlags.includes('SPEED')) {
      statBonuses.speed = (statBonuses.speed || 0) + 3;
    }

    const artifactItem = new Item(
      x, y,
      type,
      char,
      art.color || '#ffd700',
      finalName,
      art.type === 'LAMP' ? 3 : 0,
      slotType,
      statBonuses,
      art.dice || baseKind?.dice || null,
      null,
      [],
      [],
      ['ARTIFACT', ...(art.specialTags || [])],
      art.flavorText || "고대 발리노르의 권능이 깃든 전설의 유물입니다."
    );

    artifactItem.artifactKey = art.key;
    if (art.tval !== undefined) artifactItem.tval = art.tval;
    if (art.sval !== undefined) artifactItem.sval = art.sval;
    if (typeof art.baseAC === 'number') artifactItem.baseAC = art.baseAC;
    if (typeof art.cost === 'number') artifactItem.cost = art.cost;
    if (typeof art.weight === 'number') artifactItem.weight = art.weight;
    if (baseKind?.multiplier) artifactItem.multiplier = baseKind.multiplier;
    artifactItem.flags = resolvedFlags;
    artifactItem.syncComponents();
    return artifactItem;
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
      // 심도 15층 이상에서는 25% 확률로 파워 예산 기반 절차적 란다트(Randart) 생성
      if (danger >= 15 && Math.random() < 0.25) {
        const equipKinds = this._cachedKinds.filter(k =>
          k.tval !== 102 && k.key !== 'KIND_RANDOM_ARTIFACT' && k.cost > 40 &&
          ['WEAPON', 'BOW', 'ARMOR', 'SHIELD', 'HELMET', 'BOOTS', 'GLOVES', 'CLOAK'].includes(k.type || k.slotType)
        );
        if (equipKinds.length > 0) {
          const randBase = equipKinds[Math.floor(Math.random() * equipKinds.length)];
          return TomeRandartEngine.createRandart(x, y, randBase, danger);
        }
      }

      // 정규 고정 아티팩트(Static Artifact) 생성
      const validArts = this._cachedArtifacts.filter(a => a.level <= danger + 10);
      if (validArts.length > 0) {
        const art = validArts[Math.floor(Math.random() * validArts.length)];
        return this._createArtifactItemInstance(x, y, art, danger);
      }
    }

    // 2. 기본 아이템 풀 추출
    let baseKind = null;
    if (this._cachedKinds && this._cachedKinds.length > 0) {
      const candidates = this._cachedKinds.filter(k => k.tval !== 102 && k.key !== 'KIND_RANDOM_ARTIFACT' && k.level <= danger + 4);
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
        { name: "무기 강화 주문서", type: "SCROLL", slotType: null, char: "?", color: "#fb7185", flavorText: "무기에 마법의 예리함을 각인하는 강화 주문서입니다." },
        { name: "Scroll of Identify", tval: 70, sval: 13, type: "SCROLL", slotType: null, char: "?", color: "#38bdf8", cost: 50, level: 1, flavorText: "미식별 장비의 숨겨진 능력과 접사를 판별해 주는 고대의 감정 주문서입니다." },
        { name: "Scroll of Remove Curse", tval: 70, sval: 15, type: "SCROLL", slotType: null, char: "?", color: "#fbcfe8", cost: 100, level: 3, flavorText: "장비에 깃든 사악한 결속 저주를 정화하여 안전하게 탈의할 수 있게 해주는 저주 해제 주문서입니다." }
      ];
      baseKind = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
    }

    // 3. 에고(Ego) 접사 부여 판정 (TomeEgosData 101종 정통 풀 연동)
    const egoChance = isSpecialRoom ? tierConfig.loot.egoChanceSpecial : tierConfig.loot.egoChanceNormal;
    const prefixes = [];
    const suffixes = [];
    const specialTags = [];
    let egoData = null;

    const isEligibleEquip = ['WEAPON', 'SHIELD', 'BOW', 'ARMOR', 'HELMET', 'GLOVES', 'BOOTS', 'CLOAK', 'RING', 'AMULET', 'LAMP'].includes(baseKind.type) ||
                           ['WEAPON', 'SHIELD', 'BOW', 'ARMOR', 'HELMET', 'GLOVES', 'BOOTS', 'CLOAK', 'RING', 'AMULET', 'LIGHT'].includes(baseKind.slotType);

    if (Math.random() < egoChance && isEligibleEquip) {
      const slotEgos = this._getEgosForSlot(baseKind.type, baseKind.slotType);
      if (slotEgos && slotEgos.length > 0) {
        egoData = slotEgos[Math.floor(Math.random() * slotEgos.length)];
      }

      const allowedPrefixes = tierConfig.loot.allowedEgoPrefixes || ["FIRE", "COLD", "LIGHTNING", "TOXIC", "IRON", "HOLY"];
      const allowedSuffixes = tierConfig.loot.allowedEgoSuffixes || ["SLAYER", "GALE", "AEGIS", "SAGE"];

      if (egoData) {
        const resolvedEgoFlags = this.resolveRandomFlags(egoData.flags);
        for (const f of resolvedEgoFlags) specialTags.push(f);

        // 정통 브랜드/에고 태그 매핑
        if (resolvedEgoFlags.includes('BRAND_FIRE') || /Flame|Fire|Fiery/i.test(egoData.name)) prefixes.push('FIRE');
        else if (resolvedEgoFlags.includes('BRAND_COLD') || /Frost|Cold|Frozen/i.test(egoData.name)) prefixes.push('COLD');
        else if (resolvedEgoFlags.includes('BRAND_ELEC') || /Lightning|Shock/i.test(egoData.name)) prefixes.push('LIGHTNING');
        else if (resolvedEgoFlags.includes('BRAND_ACID') || /Acid/i.test(egoData.name)) prefixes.push('ACID');
        else if (resolvedEgoFlags.includes('BRAND_POIS') || /Venom|Toxic/i.test(egoData.name)) prefixes.push('TOXIC');
        else if (/Holy|Blessed|Aman/i.test(egoData.name)) prefixes.push('HOLY');
        else prefixes.push(allowedPrefixes[Math.floor(Math.random() * allowedPrefixes.length)]);

        if (/Westernesse/i.test(egoData.name)) suffixes.push('WESTERNESSE');
        else if (/Slay|Defender/i.test(egoData.name)) suffixes.push('SLAYER');
        else if (Math.random() < 0.40 && allowedSuffixes.length > 0) {
          suffixes.push(allowedSuffixes[Math.floor(Math.random() * allowedSuffixes.length)]);
        }
      } else {
        prefixes.push(allowedPrefixes[Math.floor(Math.random() * allowedPrefixes.length)]);
        if (Math.random() < 0.40 && allowedSuffixes.length > 0) {
          suffixes.push(allowedSuffixes[Math.floor(Math.random() * allowedSuffixes.length)]);
        }
      }

      if (isSpecialRoom && danger >= 6 && Math.random() < 0.35) {
        specialTags.push("EXTRA_ATTACK");
      }
    }

    let type = baseKind.type;
    let slotType = baseKind.slotType;
    let char = baseKind.char || Item.getDefaultSymbol(type, slotType, baseKind.name);

    if (baseKind.tval === 19 || type === 'BOW' || slotType === 'BOW') {
      type = 'BOW';
      slotType = 'BOW';
      char = '}';
    } else if (baseKind.tval === 16 || baseKind.tval === 17 || baseKind.tval === 18 || type === 'AMMO' || type === 'QUIVER' || slotType === 'QUIVER') {
      type = 'AMMO';
      slotType = 'QUIVER';
      char = '}';
    } else if (baseKind.tval === 31 || type === 'GLOVES') {
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

    const cleanBase = this.cleanItemName(baseKind.name);
    let itemName = cleanBase;
    if (egoData) {
      const cleanEgo = this.cleanItemName(egoData.name);
      if (cleanEgo.startsWith('of ') || cleanEgo.startsWith('(')) {
        itemName = `${cleanBase} ${cleanEgo}`;
      } else {
        itemName = `${cleanEgo} ${cleanBase}`;
      }
    }
    itemName = this.cleanItemName(itemName);

    const itemStatBonuses = { ...(baseKind.statBonuses || {}) };
    if (egoData && egoData.flags) {
      if (egoData.flags.includes('STR')) itemStatBonuses.str = (itemStatBonuses.str || 0) + 2;
      if (egoData.flags.includes('DEX')) itemStatBonuses.dex = (itemStatBonuses.dex || 0) + 2;
      if (egoData.flags.includes('CON')) itemStatBonuses.con = (itemStatBonuses.con || 0) + 2;
      if (egoData.flags.includes('INT')) itemStatBonuses.int = (itemStatBonuses.int || 0) + 2;
      if (egoData.flags.includes('WIS')) itemStatBonuses.wis = (itemStatBonuses.wis || 0) + 2;
      if (egoData.flags.includes('SPEED') || egoData.name === 'of Speed') itemStatBonuses.speed = (itemStatBonuses.speed || 0) + 5;
    }

    const item = new Item(
      x, y,
      type,
      char,
      baseKind.color || "#cbd5e1",
      itemName,
      baseKind.lightBonus || (baseKind.type === 'LAMP' ? 2 : 0),
      slotType,
      itemStatBonuses,
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
    if (baseKind.flags && Array.isArray(baseKind.flags)) item.flags = [...baseKind.flags];
    if (baseKind.multiplier) item.multiplier = baseKind.multiplier;

    // 탄약류(화살/볼트/탄환) 15~35발 다발(Bundle) 롤링 적용
    const isAmmo = item.tval === 16 || item.tval === 17 || item.tval === 18 ||
                   item.slotType === 'QUIVER' || item.type === 'AMMO' || item.type === 'QUIVER' ||
                   /arrow|bolt|shot|화살|볼트|탄환/i.test(item.name || '') ||
                   /arrow|bolt|shot|화살|볼트|탄환/i.test(baseKind?.name || '');
    if (isAmmo) {
      item.count = Math.floor(Math.random() * 21) + 15; // 15 ~ 35발
    }

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

    if (egoData) {
      if (egoData.name.includes('Defender')) item.baseAC = (item.baseAC || 0) + 15;
      if (egoData.name.includes('Slaying')) {
        item.toHit = (item.toHit || 0) + 7;
        item.toDmg = (item.toDmg || 0) + 7;
      }
    }

    if (item.tval === 65 || item.type === 'WAND') item.charges = 5;
    if (item.tval === 55 || item.type === 'STAFF') item.charges = 5;
    if (item.tval === 66 || item.type === 'ROD') item.timeout = 0;

    // ToME 정통 역보정 & 저주 에고 출현 파이프라인
    this.applyNegativeCalibration(item, danger);
    item.syncComponents();

    return item;
  }

  /**
   * 층수 심도(floor)에 따른 역보정 및 저주 에고 확률적 부여 훅
   * @param {Item} item - 대상 아이템 인스턴스
   * @param {number} floor - 현재 던전 층수
   * @returns {Item}
   */
  static applyNegativeCalibration(item, floor = 1) {
    if (!item) return item;
    const isEquip = ['WEAPON', 'SHIELD', 'BOW', 'ARMOR', 'HELMET', 'GLOVES', 'BOOTS', 'CLOAK', 'RING', 'AMULET'].includes(item.type) ||
                    ['WEAPON', 'SHIELD', 'BOW', 'ARMOR', 'HELMET', 'GLOVES', 'BOOTS', 'CLOAK', 'RING', 'AMULET'].includes(item.slotType);
    if (!isEquip) return item;

    // 장비 기본 감정 상태는 미감정(UNIDENTIFIED)으로 마스킹
    item.idState = 'UNIDENTIFIED';

    // P_neg = max(0.08, 0.16 - (floor * 0.0016))
    const pNeg = Math.max(0.08, 0.16 - (floor * 0.0016));
    if (Math.random() < pNeg) {
      const isCurse = Math.random() < 0.65;
      if (isCurse) {
        item.isCursed = true;
        if (!item.specialTags.includes('CURSED')) {
          item.specialTags.push('CURSED');
        }

        let isHeavy = false;
        let isPerma = false;
        if (floor >= 25) {
          const roll = Math.random();
          if (roll < 0.10) {
            isPerma = true;
            item.specialTags.push('PERMA_CURSED');
          } else if (roll < 0.35) {
            isHeavy = true;
            item.specialTags.push('HEAVY_CURSED');
          }
        }

        // 디트리멘탈 서브 태그 풀
        const detrimentalPool = [
          'TELEPORT_RANDOM', 'DRAIN_EXP', 'AGGRAVATE',
          'VULN_FIRE', 'VULN_COLD', 'VULN_ELEC', 'VULN_ACID',
          'PENALTY_STR', 'PENALTY_DEX', 'PENALTY_CON', 'PENALTY_INT'
        ];
        const subTag = detrimentalPool[Math.floor(Math.random() * detrimentalPool.length)];
        if (!item.specialTags.includes(subTag)) {
          item.specialTags.push(subTag);
        }

        // 마이너스 역보정 수치 반영
        if (isHeavy) {
          item.toHit = -1 * (5 + Math.floor(Math.random() * 8));
          item.toDmg = -1 * (5 + Math.floor(Math.random() * 8));
        } else {
          item.toHit = -1 * (1 + Math.floor(Math.random() * 6));
          item.toDmg = -1 * (1 + Math.floor(Math.random() * 6));
        }
        if (['ARMOR', 'HELMET', 'SHIELD', 'GLOVES', 'BOOTS', 'CLOAK'].includes(item.type) || ['ARMOR', 'HELMET', 'SHIELD', 'GLOVES', 'BOOTS', 'CLOAK'].includes(item.slotType)) {
          item.baseAC = -1 * (1 + Math.floor(Math.random() * 5));
        }
      } else {
        // 단순 불량품 (Worthless)
        item.toHit = -1 * (1 + Math.floor(Math.random() * 6));
        item.toDmg = -1 * (1 + Math.floor(Math.random() * 6));
        if (['ARMOR', 'HELMET', 'SHIELD', 'GLOVES', 'BOOTS', 'CLOAK'].includes(item.type) || ['ARMOR', 'HELMET', 'SHIELD', 'GLOVES', 'BOOTS', 'CLOAK'].includes(item.slotType)) {
          item.baseAC = -1 * (1 + Math.floor(Math.random() * 4));
        }
      }
    }
    return item;
  }

  /**
   * 몬스터 처치 시 전리품(골드, 소모품, 에고 장비, 아티팩트)을 롤링하여 반환합니다.
   * @param {Object} monster - 처치된 몬스터
   * @param {number} floor - 현재 던전 층수
   * @param {Object} [map=null] - 맵 인스턴스
   * @returns {Array<Item>} 생성된 전리품 아이템 목록
   */
  static rollMonsterDrop(monster, floor = 1, map = null) {
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
      let targetX = mx + offsetX;
      let targetY = my + offsetY;

      if (map && typeof map.isWalkable === 'function' && !map.isWalkable(targetX, targetY)) {
        targetX = mx;
        targetY = my;
      }

      const item = this.generateFloorItem(targetX, targetY, Math.max(floor, mLevel), isBoss);
      drops.push(item);
    }

    return drops;
  }

  /**
   * 던전 층수에 맞는 ToME 장비(무기/방어구/투구/방패/신발/장갑/망토/활 등) 1개를 절차적으로 생성합니다.
   * @param {number} x 
   * @param {number} y 
   * @param {number} floor 
   * @param {boolean} isSpecialRoom 
   * @returns {Item}
   */
  static generateEquipmentItem(x, y, floor = 1, isSpecialRoom = false, allowedTypes = ['WEAPON', 'ARMOR', 'HELMET', 'SHIELD']) {
    const validEquipTypes = Array.isArray(allowedTypes) && allowedTypes.length > 0
      ? allowedTypes
      : ['WEAPON', 'ARMOR', 'HELMET', 'SHIELD', 'BOOTS', 'GLOVES', 'CLOAK', 'BOW'];
    for (let i = 0; i < 20; i++) {
      const item = this.generateFloorItem(x, y, floor, isSpecialRoom);
      if (item && validEquipTypes.includes(item.type)) {
        return item;
      }
    }
    // 폴백 기본 무기
    const fallback = new Item(x, y, 'WEAPON', '|', '#cbd5e1', '롱소드', 1, 'WEAPON', { str: 2 }, '1d8', null, [], [], [], '날이 곧고 양날이 서 있는 정통 롱소드입니다.');
    fallback.syncComponents();
    return fallback;
  }

  // Alias for backward compatibility
  static generateLoot(x, y, depth = 1, isBossDrop = false) {
    return this.generateFloorItem(x, y, depth, isBossDrop);
  }
}
