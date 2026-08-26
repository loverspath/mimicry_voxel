/**
 * @module TomeFlagResolver
 * @category systems
 * @description ToME 2.3.5 몬스터 종족(tomeKey), 장비(베이스+에고+유물), 의태 변이(mutations/perks),
 *              소모품 및 임시 상태로부터 모든 ToME 플래그(RES_*, IM_*, LITE*, SUST_*, SLAY_*, ESP_*,
 *              FREE_ACT, NO_*, CAN_FLY, PASS_WALL, REFLECT 등)를 O(1) 단일 Set으로 일괄 추출 및 병합하는 순수 무상태 엔진.
 * @purity Stateless System
 * @dependencies TomeMonstersData.js, TomeKindsData.js, TomeEgosData.js, TomeArtifactsData.js
 * @exports TomeFlagResolver
 */

import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { TOME_KINDS_DATA } from '../entities/TomeKindsData.js';
import { TOME_EGOS_DATA } from '../entities/TomeEgosData.js';
import { TOME_ARTIFACTS_DATA } from '../entities/TomeArtifactsData.js';

export class TomeFlagResolver {
  /**
   * 엔티티(플레이어, 몬스터, NPC)로부터 모든 활성 ToME 플래그 세트를 추출합니다.
   * @param {Object} entity
   * @returns {Set<string>}
   */
  static collectFlagsFromEntity(entity) {
    const flags = new Set();
    if (!entity) return flags;

    // 1. 직접 정의된 flags 배열 또는 Set
    if (entity.flags) {
      this._mergeIterable(flags, entity.flags);
    }

    // 2. 몬스터/변신 코어 종족 플래그
    const monsterKey = entity.tomeKey || entity.species || entity.coreType || (entity.mimicCore && (entity.mimicCore.coreType || entity.mimicCore.tomeKey));
    if (monsterKey) {
      const monsterFlags = this.collectFlagsFromMonster(monsterKey);
      this._mergeIterable(flags, monsterFlags);
    }

    // 3. 플레이어 장비 슬롯 전수 수집
    if (entity.equipment) {
      const eqFlags = this.collectFlagsFromEquipment(entity.equipment, entity.equippedLamp);
      this._mergeIterable(flags, eqFlags);
    }

    // 4. 의태 변이 및 퍽 (Mutations / Perks)
    if (entity.mutations) {
      this._mergeIterable(flags, this.collectFlagsFromMutations(entity.mutations));
    }
    if (entity.perks) {
      this._mergeIterable(flags, this.collectFlagsFromMutations(entity.perks));
    }

    // 5. 임시 플래그 / 상태 효과
    if (entity.temporaryFlags) {
      this._mergeIterable(flags, entity.temporaryFlags);
    }
    if (entity.statusEffects) {
      if (Array.isArray(entity.statusEffects)) {
        for (const st of entity.statusEffects) {
          if (st && st.flag) flags.add(st.flag);
          if (st && st.flags) this._mergeIterable(flags, st.flags);
        }
      } else if (typeof entity.statusEffects === 'object') {
        for (const [stKey, stVal] of Object.entries(entity.statusEffects)) {
          if (stVal && (typeof stVal === 'number' ? stVal > 0 : true)) {
            flags.add(`STATUS_${stKey.toUpperCase()}`);
          }
        }
      }
    }
    if (entity.statuses && typeof entity.statuses === 'object') {
      for (const [stKey, stVal] of Object.entries(entity.statuses)) {
        const isActive = stVal && (typeof stVal === 'object' ? (stVal.duration > 0) : Boolean(stVal));
        if (isActive) {
          const upper = stKey.toUpperCase();
          flags.add(`STATUS_${upper}`);
          flags.add(upper);
          if (upper === 'HERO') {
            flags.add('NO_FEAR');
            flags.add('HERO');
          }
          if (upper === 'RES_FIRE') flags.add('RES_FIRE');
          if (upper === 'RES_COLD') flags.add('RES_COLD');
          if (upper === 'RES_ELEC') flags.add('RES_ELEC');
          if (upper === 'RES_ACID') flags.add('RES_ACID');
          if (upper === 'SEE_INVIS') flags.add('SEE_INVIS');
          if (upper === 'HASTE') flags.add('HASTE');
          if (upper === 'BLESS') flags.add('BLESS');
        }
      }
    }

    return flags;
  }

  /**
   * 장비 객체 및 장착된 광원으로부터 모든 플래그를 취합합니다.
   * @param {Object} equipment - 장비 슬롯 맵
   * @param {Object} [equippedLamp] - 장착된 광원 아이템
   * @returns {Set<string>}
   */
  static collectFlagsFromEquipment(equipment, equippedLamp = null) {
    const flags = new Set();
    if (!equipment && !equippedLamp) return flags;

    const slots = [];
    if (equipment) {
      if (typeof equipment === 'object') {
        for (const key of Object.keys(equipment)) {
          const item = equipment[key];
          if (item) slots.push(item);
        }
      } else if (Array.isArray(equipment)) {
        slots.push(...equipment);
      }
    }

    if (equippedLamp) {
      slots.push(equippedLamp);
    }

    for (const item of slots) {
      if (!item) continue;
      const itemFlags = this.collectFlagsFromItem(item);
      this._mergeIterable(flags, itemFlags);
    }

    return flags;
  }

  /**
   * 단일 아이템(베이스, 에고, 유물, 커스텀 아이템)으로부터 모든 플래그를 취합합니다.
   * @param {Object|string} itemOrKey
   * @returns {Set<string>}
   */
  static collectFlagsFromItem(itemOrKey) {
    const flags = new Set();
    if (!itemOrKey) return flags;

    // 문자열 키로 넘어온 경우
    if (typeof itemOrKey === 'string') {
      if (TOME_ARTIFACTS_DATA[itemOrKey]) {
        this._mergeIterable(flags, TOME_ARTIFACTS_DATA[itemOrKey].flags);
        return flags;
      }
      if (TOME_KINDS_DATA[itemOrKey]) {
        this._mergeIterable(flags, TOME_KINDS_DATA[itemOrKey].flags);
        return flags;
      }
      if (TOME_EGOS_DATA[itemOrKey]) {
        this._mergeIterable(flags, TOME_EGOS_DATA[itemOrKey].flags);
        return flags;
      }
      flags.add(itemOrKey);
      return flags;
    }

    const item = itemOrKey;

    // 1. 유물 키 또는 데이터 연동
    const artKey = item.artifactKey || item.artKey || (item.key && item.key.startsWith('ART_') ? item.key : null);
    if (artKey && TOME_ARTIFACTS_DATA[artKey]) {
      this._mergeIterable(flags, TOME_ARTIFACTS_DATA[artKey].flags);
    }

    // 2. 베이스 아이템 (Kinds) 플래그
    const kindKey = item.kindKey || (item.key && item.key.startsWith('KIND_') ? item.key : null);
    if (kindKey && TOME_KINDS_DATA[kindKey]) {
      this._mergeIterable(flags, TOME_KINDS_DATA[kindKey].flags);
    }

    // 3. 에고 (Egos) 플래그
    const egoKey = item.egoKey || (item.key && item.key.startsWith('EGO_') ? item.key : null);
    if (egoKey && TOME_EGOS_DATA[egoKey]) {
      this._mergeIterable(flags, TOME_EGOS_DATA[egoKey].flags);
    }
    if (item.egoKeys && Array.isArray(item.egoKeys)) {
      for (const ek of item.egoKeys) {
        if (TOME_EGOS_DATA[ek]) {
          this._mergeIterable(flags, TOME_EGOS_DATA[ek].flags);
        }
      }
    }

    // 4. 아이템 인스턴스 직접 필드
    if (item.flags) {
      this._mergeIterable(flags, item.flags);
    }
    if (item.specialTags) {
      this._mergeIterable(flags, item.specialTags);
    }

    // 5. 접두/접미사 (Prefix / Suffix)
    if (item.prefixes && Array.isArray(item.prefixes)) {
      for (const p of item.prefixes) {
        flags.add(`PREFIX_${p}`);
        if (p === 'FIRE') flags.add('BRAND_FIRE');
        if (p === 'COLD') flags.add('BRAND_COLD');
        if (p === 'LIGHTNING' || p === 'ELEC') flags.add('BRAND_ELEC');
        if (p === 'TOXIC' || p === 'POISON') flags.add('BRAND_POIS');
        if (p === 'ACID') flags.add('BRAND_ACID');
        if (p === 'HOLY') flags.add('SLAY_EVIL');
      }
    }
    if (item.suffixes && Array.isArray(item.suffixes)) {
      for (const s of item.suffixes) {
        flags.add(`SUFFIX_${s}`);
        if (s === 'SLAYER') {
          flags.add('SLAY_ORC');
          flags.add('SLAY_ANIMAL');
          flags.add('SLAY_EVIL');
        }
      }
    }

    return flags;
  }

  /**
   * 몬스터 종족 식별자 또는 몬스터 인스턴스로부터 ToME 플래그를 취합합니다.
   * @param {Object|string} monsterOrKey
   * @returns {Set<string>}
   */
  static collectFlagsFromMonster(monsterOrKey) {
    const flags = new Set();
    if (!monsterOrKey) return flags;

    let key = typeof monsterOrKey === 'string' ? monsterOrKey : (monsterOrKey.tomeKey || monsterOrKey.key || monsterOrKey.species);
    if (!key && typeof monsterOrKey === 'object' && monsterOrKey.name) {
      key = `MON_${monsterOrKey.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_')}`;
    }

    if (key && TOME_MONSTERS_DATA[key]) {
      const data = TOME_MONSTERS_DATA[key];
      if (data.flags) this._mergeIterable(flags, data.flags);
      if (data.breathElement) flags.add(`BREATH_${data.breathElement}`);
    }

    if (typeof monsterOrKey === 'object') {
      if (monsterOrKey.flags) this._mergeIterable(flags, monsterOrKey.flags);
      if (monsterOrKey.specialTags) this._mergeIterable(flags, monsterOrKey.specialTags);
      if (monsterOrKey.type) flags.add(monsterOrKey.type.toUpperCase());
    }

    return flags;
  }

  /**
   * 변이 목록 또는 퍽 목록으로부터 플래그를 추출합니다.
   * @param {Array|Set|Object} mutations
   * @returns {Set<string>}
   */
  static collectFlagsFromMutations(mutations) {
    const flags = new Set();
    if (!mutations) return flags;

    if (Array.isArray(mutations) || mutations instanceof Set) {
      for (const m of mutations) {
        if (!m) continue;
        if (typeof m === 'string') {
          flags.add(m);
        } else if (typeof m === 'object') {
          if (m.flag) flags.add(m.flag);
          if (m.flags) this._mergeIterable(flags, m.flags);
          if (m.id) flags.add(`MUT_${m.id.toUpperCase()}`);
        }
      }
    } else if (typeof mutations === 'object') {
      for (const [k, v] of Object.entries(mutations)) {
        if (v) {
          flags.add(k);
          if (typeof v === 'object' && v.flags) this._mergeIterable(flags, v.flags);
        }
      }
    }

    return flags;
  }

  /**
   * 다중 소스를 일괄 통합하여 단일 정규화된 플래그 세트를 산출합니다.
   * @param {Object} sources
   * @param {string} [sources.raceKey]
   * @param {Object} [sources.monster]
   * @param {Object} [sources.equipment]
   * @param {Object} [sources.equippedLamp]
   * @param {Array|Set} [sources.mutations]
   * @param {Array|Set} [sources.perks]
   * @param {Array|Set} [sources.temporaryFlags]
   * @param {Array} [sources.items]
   * @returns {Set<string>}
   */
  static resolveUnifiedFlags(sources = {}) {
    const unified = new Set();

    if (sources.raceKey) {
      this._mergeIterable(unified, this.collectFlagsFromMonster(sources.raceKey));
    }
    if (sources.monster) {
      this._mergeIterable(unified, this.collectFlagsFromMonster(sources.monster));
    }
    if (sources.equipment || sources.equippedLamp) {
      this._mergeIterable(unified, this.collectFlagsFromEquipment(sources.equipment, sources.equippedLamp));
    }
    if (sources.mutations) {
      this._mergeIterable(unified, this.collectFlagsFromMutations(sources.mutations));
    }
    if (sources.perks) {
      this._mergeIterable(unified, this.collectFlagsFromMutations(sources.perks));
    }
    if (sources.temporaryFlags) {
      this._mergeIterable(unified, sources.temporaryFlags);
    }
    if (sources.items && Array.isArray(sources.items)) {
      for (const item of sources.items) {
        this._mergeIterable(unified, this.collectFlagsFromItem(item));
      }
    }

    return unified;
  }

  /**
   * 플래그 세트 또는 엔티티가 특정 플래그를 보유하고 있는지 확인합니다 (O(1)).
   * @param {Set<string>|Object} flagSetOrEntity
   * @param {string} flagName
   * @returns {boolean}
   */
  static hasFlag(flagSetOrEntity, flagName) {
    if (!flagSetOrEntity || !flagName) return false;
    const flagSet = flagSetOrEntity instanceof Set ? flagSetOrEntity : this.collectFlagsFromEntity(flagSetOrEntity);
    return flagSet.has(flagName);
  }

  /**
   * 여러 플래그 중 하나라도 보유하고 있는지 확인합니다.
   * @param {Set<string>|Object} flagSetOrEntity
   * @param {...string} flagNames
   * @returns {boolean}
   */
  static hasAnyFlag(flagSetOrEntity, ...flagNames) {
    if (!flagSetOrEntity || flagNames.length === 0) return false;
    const flagSet = flagSetOrEntity instanceof Set ? flagSetOrEntity : this.collectFlagsFromEntity(flagSetOrEntity);
    return flagNames.some(f => flagSet.has(f));
  }

  /**
   * 주어진 모든 플래그를 보유하고 있는지 확인합니다.
   * @param {Set<string>|Object} flagSetOrEntity
   * @param {...string} flagNames
   * @returns {boolean}
   */
  static hasAllFlags(flagSetOrEntity, ...flagNames) {
    if (!flagSetOrEntity || flagNames.length === 0) return false;
    const flagSet = flagSetOrEntity instanceof Set ? flagSetOrEntity : this.collectFlagsFromEntity(flagSetOrEntity);
    return flagNames.every(f => flagSet.has(f));
  }

  /**
   * 특정 접두사(e.g. 'RES_', 'IM_', 'ESP_', 'SLAY_', 'BRAND_')로 시작하는 플래그 목록을 추출합니다.
   * @param {Set<string>|Object} flagSetOrEntity
   * @param {string} prefix
   * @returns {string[]}
   */
  static getFlagsWithPrefix(flagSetOrEntity, prefix) {
    if (!flagSetOrEntity || !prefix) return [];
    const flagSet = flagSetOrEntity instanceof Set ? flagSetOrEntity : this.collectFlagsFromEntity(flagSetOrEntity);
    const results = [];
    for (const f of flagSet) {
      if (f.startsWith(prefix)) results.push(f);
    }
    return results;
  }

  /**
   * @private
   */
  static _mergeIterable(targetSet, sourceIterable) {
    if (!sourceIterable) return;
    if (Array.isArray(sourceIterable) || sourceIterable instanceof Set) {
      for (const item of sourceIterable) {
        if (typeof item === 'string') targetSet.add(item);
      }
    }
  }
}
