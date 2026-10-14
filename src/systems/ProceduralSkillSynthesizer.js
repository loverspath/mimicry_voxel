/**
 * @module ProceduralSkillSynthesizer
 * @category systems
 * @description Procedural Monster & Core Skillset Synthesis Engine.
 *              Eliminates the 3-way split-brain (MonsterSpellFactory vs Skills vs TomeSpellEngine)
 *              and deterministically synthesizes authentic 4-slot active skillsets + 5-tier passive trees
 *              + Sub-Core infusions for all 851 ToME monsters and player Main/Sub Cores.
 * @purity Pure / Deterministic Synthesis Engine
 * @dependencies TomeMonstersData.js, SynthesisSchemaConfig.js, EffectOpSchema.js, EffectVM.js, StatusEffectEngine.js
 */

import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import {
  BLOW_METHOD_GRAMMAR,
  BLOW_EFFECT_GRAMMAR,
  SPELL_DESCRIPTOR_GRAMMAR,
  ARCHETYPE_FLAG_TACTICS
} from '../configs/SynthesisSchemaConfig.js';
import { EFFECT_OP_TYPES } from '../configs/EffectOpSchema.js';
import { EffectVM } from './EffectVM.js';

/**
 * 32-bit FNV-1a deterministic hash.
 * @param {string} str
 * @returns {number}
 */
export function fnv1a(str) {
  let hash = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Canonical ActiveSkill Model for Player Hotbar and Monster AI
 */
export class ActiveSkill {
  constructor(data) {
    this.id = data.id;
    this.tomeKey = data.tomeKey || data.id;
    this.slot = data.slot; // 1, 2, 3, 4
    this.requiredMastery = data.requiredMastery || (data.slot <= 2 ? 1 : (data.slot === 3 ? 10 : 25));
    this.pt = data.pt || this.requiredMastery;
    this.name = data.name;
    this.desc = data.desc || '';
    this.type = data.type || 'PROJECTILE';
    this.targetType = data.targetType || 'TARGET';
    this.element = data.element || 'PHYSICAL';
    this.cooldown = data.cooldown || 2;
    this.maxRange = data.maxRange || data.range || 5.5;
    this.range = this.maxRange;
    this.dice = data.dice || '1d6';
    this.color = data.color || '#38bdf8';
    this.icon = data.icon || '⚔️';
    this.synergyTags = Array.isArray(data.synergyTags) ? [...data.synergyTags] : [];
    this.ops = Array.isArray(data.ops) ? JSON.parse(JSON.stringify(data.ops)) : [];
    this.infusedBy = Array.isArray(data.infusedBy) ? [...data.infusedBy] : [];
    this._customExecute = data.execute || null;
  }

  isUnlocked(masteryLevel = 1) {
    return (masteryLevel || 1) >= (this.requiredMastery || this.pt || 1);
  }

  getEffectiveCooldown(masteryLevel = 1) {
    const reduction = Math.floor((masteryLevel || 1) / 25);
    return Math.max(1, this.cooldown - reduction);
  }

  execute(game, player, target = null) {
    if (!game || !player) return false;
    const masteryLvl = player.getMorphMasteryLevel ? player.getMorphMasteryLevel() : 1;

    if (!this.isUnlocked(masteryLvl)) {
      if (game.addLogEntry) {
        game.addLogEntry(`🔒 [스킬 잠김] ${this.name} 스킬은 변신 숙련도 Lv.${this.requiredMastery} 이상에서 사용 가능합니다.`, 'combat');
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

    // Custom execution fallback
    if (this._customExecute && (!this.ops || this.ops.length === 0)) {
      const res = this._customExecute(game, player, target, this);
      if (res) this._postExecute(game, player, masteryLvl);
      return res;
    }

    // Target resolution if not passed
    let resolvedTarget = target;
    if (!resolvedTarget && this.targetType !== 'SELF') {
      resolvedTarget = this._findTarget(game, player, this.maxRange);
    }

    if (!resolvedTarget && this.targetType !== 'SELF' && this.type !== 'TELEPORT' && this.type !== 'BUFF') {
      if (game.addLogEntry) {
        game.addLogEntry(`⚠️ [시전 실패] 사거리(${this.maxRange}칸) 내에 조준할 적이 없습니다.`, 'combat');
      }
      return false;
    }

    // EffectVM Canonical Pipeline Execution
    const context = {
      caster: player,
      target: resolvedTarget,
      targetX: resolvedTarget ? resolvedTarget.x : player.x,
      targetY: resolvedTarget ? resolvedTarget.y : player.y,
      game,
      map: game.map,
      monsters: game.monsters || (game.dungeon && game.dungeon.monsters) || [],
      addLogEntry: game.addLogEntry ? game.addLogEntry.bind(game) : null
    };

    const vmRes = EffectVM.execute(this.ops, context);
    if (vmRes && vmRes.success) {
      if (game.addLogEntry) {
        game.addLogEntry(`✨ [스킬 발동] <b>${this.name}</b> 시전 성공!`, 'combat');
      }
      this._postExecute(game, player, masteryLvl);
      return true;
    }

    return false;
  }

  _postExecute(game, player, masteryLvl) {
    const finalCd = this.getEffectiveCooldown(masteryLvl);
    if (player.setTracker) {
      player.setTracker(this.id, 'cooldown', finalCd);
    }
    const currentMorphKey = player.mimicCore?.coreType || player.mimicCore?.name;
    if (currentMorphKey && player.body && player.body.gainLoreXp) {
      player.body.gainLoreXp(currentMorphKey, 2);
    }
    if (game.updateUI) game.updateUI();
  }

  _findTarget(game, player, maxRange) {
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
}

export class ProceduralSkillSynthesizer {
  static _skillSetCache = new Map();
  static _passiveTreeCache = new Map();

  /**
   * Resolves raw monster entry from TOME_MONSTERS_DATA.
   * @param {string} monsterKey
   * @returns {Object|null}
   */
  static resolveMonsterData(monsterKey) {
    if (!monsterKey) return null;
    if (TOME_MONSTERS_DATA[monsterKey]) return TOME_MONSTERS_DATA[monsterKey];

    const trimmed = String(monsterKey).trim();
    if (TOME_MONSTERS_DATA[trimmed]) return TOME_MONSTERS_DATA[trimmed];

    // Search by name or key case-insensitively
    const lower = trimmed.toLowerCase();
    for (const k in TOME_MONSTERS_DATA) {
      const m = TOME_MONSTERS_DATA[k];
      if (m.key.toLowerCase() === lower || (m.name && m.name.toLowerCase() === lower)) {
        return m;
      }
    }

    // Infer dynamically from key/name tokens if not directly found in the table
    const upper = trimmed.toUpperCase();
    let inferredChar = 'p';
    let inferredAttacks = [{ method: 'HIT', effect: 'HURT', damage: '1d6' }];
    let inferredFlags = ['MORTAL'];
    let inferredGrowth = 'BALANCED';
    let inferredBreath = null;

    if (upper.includes('SPIDER')) {
      inferredChar = 'S';
      inferredAttacks = [{ method: 'BITE', effect: 'POISON', damage: '1d6' }, { method: 'STING', effect: 'POISON', damage: '1d4' }];
      inferredFlags = ['ANIMAL', 'RES_POIS'];
      inferredGrowth = 'SPEEDY';
    } else if (upper.includes('LION') || upper.includes('TIGER') || upper.includes('CAT') || upper.includes('LEOPARD')) {
      inferredChar = 'f';
      inferredAttacks = [{ method: 'CLAW', effect: 'HURT', damage: '2d4' }, { method: 'BITE', effect: 'HURT', damage: '2d6' }];
      inferredFlags = ['ANIMAL', 'FRIENDS'];
      inferredGrowth = 'WARRIOR';
    } else if (upper.includes('HOUND') || upper.includes('WOLF') || upper.includes('DOG')) {
      inferredChar = 'C';
      inferredAttacks = [{ method: 'BITE', effect: 'HURT', damage: '1d8' }];
      inferredFlags = ['ANIMAL'];
      inferredGrowth = 'SPEEDY';
    } else if (upper.includes('DRAGON') || upper.includes('WYRM')) {
      inferredChar = 'd';
      inferredAttacks = [{ method: 'CLAW', effect: 'HURT', damage: '2d8' }, { method: 'BITE', effect: 'HURT', damage: '3d8' }];
      inferredFlags = ['DRAGON'];
      inferredGrowth = 'TANK';
    } else if (upper.includes('BAT')) {
      inferredChar = 'B';
      inferredAttacks = [{ method: 'BITE', effect: 'HURT', damage: '1d4' }];
      inferredFlags = ['ANIMAL', 'CAN_FLY'];
      inferredGrowth = 'SPEEDY';
    } else if (upper.includes('SNAKE')) {
      inferredChar = 'J';
      inferredAttacks = [{ method: 'BITE', effect: 'POISON', damage: '1d6' }];
      inferredFlags = ['ANIMAL'];
    }

    if (upper.includes('FIRE') || upper.includes('FLAME')) {
      inferredBreath = 'FIRE';
      inferredFlags.push('AURA_FIRE', 'RES_FIRE');
      if (inferredAttacks[0]) inferredAttacks[0].effect = 'FIRE';
    } else if (upper.includes('COLD') || upper.includes('ICE') || upper.includes('FROST')) {
      inferredBreath = 'COLD';
      inferredFlags.push('AURA_COLD', 'RES_COLD');
      if (inferredAttacks[0]) inferredAttacks[0].effect = 'COLD';
    } else if (upper.includes('POISON') || upper.includes('VENOM')) {
      inferredBreath = 'POISON';
      inferredFlags.push('RES_POIS');
      if (inferredAttacks[0]) inferredAttacks[0].effect = 'POISON';
    } else if (upper.includes('ELEC') || upper.includes('LIGHTNING') || upper.includes('SHOCK')) {
      inferredBreath = 'LIGHTNING';
      inferredFlags.push('AURA_ELEC', 'RES_ELEC');
      if (inferredAttacks[0]) inferredAttacks[0].effect = 'ELEC';
    } else if (upper.includes('ACID')) {
      inferredBreath = 'ACID';
      inferredFlags.push('RES_ACID');
      if (inferredAttacks[0]) inferredAttacks[0].effect = 'ACID';
    }

    return {
      key: trimmed,
      name: trimmed.replace(/^MON_/, '').replace(/_/g, ' '),
      char: inferredChar,
      growthType: inferredGrowth,
      breathElement: inferredBreath,
      attacks: inferredAttacks,
      spells: inferredBreath ? [`BR_${inferredBreath}`] : [],
      flags: inferredFlags,
      level: 10
    };
  }

  /**
   * Deterministically synthesizes 4 distinct active skills for any of the 851 monsters.
   * @param {string} monsterKey
   * @param {Array<string>} [subCoreKeys=[]]
   * @returns {Array<ActiveSkill>} 4 distinct ActiveSkills (slot 1, 2, 3, 4)
   */
  static synthesizeMonsterSkillSet(monsterKey, subCoreKeys = []) {
    const validSubs = Array.isArray(subCoreKeys) ? subCoreKeys.filter(Boolean) : [];
    const cacheKey = `${monsterKey}::${validSubs.join('+')}`;
    if (this._skillSetCache.has(cacheKey)) {
      return this._skillSetCache.get(cacheKey);
    }

    const monsterData = this.resolveMonsterData(monsterKey) || {
      key: monsterKey || 'MON_NOVICE_WARRIOR',
      name: monsterKey || 'Novice warrior',
      char: 'p',
      growthType: 'WARRIOR',
      attacks: [{ method: 'HIT', effect: 'HURT', damage: '1d6' }],
      spells: [],
      flags: ['MORTAL'],
      level: 1
    };

    const cleanKey = monsterData.key || monsterKey;
    const seed = fnv1a(cleanKey);
    const rawAttacks = monsterData.attacks || [];
    const rawSpells = (monsterData.spells || []).filter(s => typeof s === 'string' && !s.startsWith('1_IN_') && !s.startsWith('FREQ_'));
    const flags = new Set(monsterData.flags || []);
    const char = monsterData.char || 'p';

    // ----------------------------------------------------
    // Slot 1: Signature Blow / Innate Strike (reqMastery: 1)
    // ----------------------------------------------------
    const slot1 = this._synthesizeSlot1(cleanKey, monsterData, rawAttacks, flags, char, seed);

    // ----------------------------------------------------
    // Slot 2: Primary Elemental / Ranged / Secondary Strike (reqMastery: 1)
    // ----------------------------------------------------
    const slot2 = this._synthesizeSlot2(cleanKey, monsterData, rawSpells, rawAttacks, flags, char, seed, slot1);

    // ----------------------------------------------------
    // Slot 3: Tactical / Mobility / Control / Aura (reqMastery: 10)
    // ----------------------------------------------------
    const slot3 = this._synthesizeSlot3(cleanKey, monsterData, rawSpells, flags, char, seed, [slot1, slot2]);

    // ----------------------------------------------------
    // Slot 4: Apex / Ultimate Finisher (reqMastery: 25)
    // ----------------------------------------------------
    const slot4 = this._synthesizeSlot4(cleanKey, monsterData, rawSpells, rawAttacks, flags, char, seed, [slot1, slot2, slot3]);

    const skillset = [slot1, slot2, slot3, slot4];

    // Guarantee 0 duplicate skill IDs across slots
    const seenIds = new Set();
    for (let i = 0; i < skillset.length; i++) {
      const sk = skillset[i];
      if (seenIds.has(sk.id)) {
        sk.id = `${sk.id}_SLOT_${sk.slot}`;
      }
      seenIds.add(sk.id);
    }

    // ----------------------------------------------------
    // Sub-Core Infusions & Tactical Injections
    // ----------------------------------------------------
    if (validSubs.length > 0) {
      this._applySubCoreInfusions(skillset, cleanKey, validSubs);
    }

    this._skillSetCache.set(cacheKey, skillset);
    return skillset;
  }

  // =========================================================================
  // Slot 1: Signature Blow / Innate Strike
  // =========================================================================
  static _synthesizeSlot1(key, monsterData, attacks, flags, char, seed) {
    if (attacks.length > 0) {
      const atk0 = attacks[0];
      const method = (atk0.method || 'HIT').toUpperCase();
      const effect = (atk0.effect || 'HURT').toUpperCase();
      const dice = atk0.damage || '1d4';

      const methodGrammar = BLOW_METHOD_GRAMMAR[method] || BLOW_METHOD_GRAMMAR.HIT;
      const effectGrammar = BLOW_EFFECT_GRAMMAR[effect] || BLOW_EFFECT_GRAMMAR.HURT;

      let name = `${effectGrammar.koPrefix} ${methodGrammar.koVerb}`;
      if (attacks.length >= 3 && attacks.some(a => a.method === 'CLAW') && attacks.some(a => a.method === 'BITE')) {
        name = '연속 할퀴기와 물어뜯기';
      }

      const ops = [
        {
          op: EFFECT_OP_TYPES.DEAL_DAMAGE,
          element: effectGrammar.element || 'PHYSICAL',
          dice,
          mult: effectGrammar.mult || 1.15,
          ignoreACPct: methodGrammar.ignoreACPct || 0,
          lifestealPct: effectGrammar.lifestealPct || 0,
          target: 'TARGET'
        }
      ];

      if (effectGrammar.statusId) {
        ops.push({
          op: EFFECT_OP_TYPES.APPLY_STATUS,
          statusId: effectGrammar.statusId,
          duration: effectGrammar.duration || 3,
          power: effectGrammar.power || 5,
          chance: effectGrammar.chance || 1.0,
          target: 'TARGET'
        });
      }

      return new ActiveSkill({
        id: `${key}_SLOT_1_ATK_${method}_${effect}`,
        tomeKey: `ATK_${method}`,
        slot: 1,
        requiredMastery: 1,
        name,
        desc: `${monsterData.name} 고유의 시그니처 타격 기예. (${dice}, 속성: ${effectGrammar.element})`,
        type: methodGrammar.delivery === 'MELEE_RUSH' ? 'CHARGE' : 'MELEE_STRIKE',
        element: effectGrammar.element || 'PHYSICAL',
        cooldown: 2,
        maxRange: methodGrammar.range || 1.5,
        dice,
        color: '#f43f5e',
        icon: methodGrammar.icon || '⚔️',
        synergyTags: [effectGrammar.element ? `${effectGrammar.element}_MELEE` : 'PHYS_MELEE'],
        ops
      });
    }

    // Creature with NEVER_BLOW or 0 attacks (Molds, Eyes, Jellies, Passive NPCs)
    let fallbackName = '본능의 타격';
    let fallbackElement = 'PHYSICAL';
    let fallbackIcon = '⚔️';
    let fallbackOps = [{ op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '1d4', mult: 1.15, target: 'TARGET' }];

    if (char === 'e') {
      fallbackName = '마안 정신 파동';
      fallbackElement = 'MANA';
      fallbackIcon = '👁️';
      fallbackOps = [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'MANA', dice: '2d4', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 3, target: 'TARGET' }
      ];
    } else if (char === 'm' || char === ',') {
      fallbackName = '포자 분출 타격';
      fallbackElement = 'POISON';
      fallbackIcon = '🍄';
      fallbackOps = [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'POISON', dice: '1d6', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'POISON', duration: 3, power: 4, target: 'TARGET' }
      ];
    } else if (char === 'j') {
      fallbackName = '산성 점액 강타';
      fallbackElement = 'ACID';
      fallbackIcon = '🟢';
      fallbackOps = [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'ACID', dice: '2d4', target: 'TARGET' },
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SUNDER', duration: 3, power: 8, target: 'TARGET' }
      ];
    } else if (flags.has('UNDEAD') || char === 'G' || char === 'W' || char === 'L') {
      fallbackName = '원혼의 사령 접촉';
      fallbackElement = 'NETHER';
      fallbackIcon = '👻';
      fallbackOps = [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'NETHER', dice: '2d4', lifestealPct: 0.35, target: 'TARGET' }
      ];
    }

    return new ActiveSkill({
      id: `${key}_SLOT_1_INNATE_STRIKE`,
      tomeKey: 'INNATE_STRIKE',
      slot: 1,
      requiredMastery: 1,
      name: fallbackName,
      desc: `${monsterData.name} 종족의 신체 본능 타격 기술.`,
      type: 'MELEE_STRIKE',
      element: fallbackElement,
      cooldown: 2,
      maxRange: 1.5,
      dice: '1d4',
      color: '#f43f5e',
      icon: fallbackIcon,
      synergyTags: [`${fallbackElement}_MELEE`],
      ops: fallbackOps
    });
  }

  // =========================================================================
  // Slot 2: Primary Elemental / Ranged / Secondary Special
  // =========================================================================
  static _synthesizeSlot2(key, monsterData, spells, attacks, flags, char, seed, slot1) {
    // 1. Try to find a primary offensive spell (Breaths, Bolts, Balls, Arrow, Rocket, Mind Blast)
    const offensiveSpellKey = spells.find(s => {
      const spec = SPELL_DESCRIPTOR_GRAMMAR[s];
      return spec && (
        spec.type === 'BREATH' ||
        spec.type === 'PROJECTILE' ||
        (spec.type === 'AOE' && !s.startsWith('BA_MANA')) ||
        s.startsWith('BO_') ||
        s.startsWith('ARROW_') ||
        s === 'MISSILE' ||
        s === 'ROCKET' ||
        s === 'MIND_BLAST'
      );
    });

    if (offensiveSpellKey) {
      const spec = SPELL_DESCRIPTOR_GRAMMAR[offensiveSpellKey];
      return new ActiveSkill({
        id: `${key}_SLOT_2_${offensiveSpellKey}`,
        tomeKey: offensiveSpellKey,
        slot: 2,
        requiredMastery: 1,
        name: spec.name,
        desc: spec.desc,
        type: spec.type,
        element: spec.element,
        cooldown: spec.cooldown || 3,
        maxRange: spec.range || 6.0,
        dice: spec.dice || '2d6',
        color: spec.color || '#38bdf8',
        icon: spec.icon || '🔮',
        synergyTags: [spec.element ? `${spec.element}_SPELL` : 'MAGIC_SPELL'],
        ops: spec.ops
      });
    }

    // 2. Try to find a distinct secondary attack
    if (attacks.length > 1) {
      const atk0 = attacks[0];
      const distinctAtk = attacks.find(a => a.method !== atk0.method || a.effect !== atk0.effect) || attacks[1];
      const method = (distinctAtk.method || 'BITE').toUpperCase();
      const effect = (distinctAtk.effect || 'HURT').toUpperCase();
      const dice = distinctAtk.damage || '1d6';

      const methodGrammar = BLOW_METHOD_GRAMMAR[method] || BLOW_METHOD_GRAMMAR.BITE;
      const effectGrammar = BLOW_EFFECT_GRAMMAR[effect] || BLOW_EFFECT_GRAMMAR.HURT;

      const ops = [
        {
          op: EFFECT_OP_TYPES.DEAL_DAMAGE,
          element: effectGrammar.element || 'PHYSICAL',
          dice,
          mult: (effectGrammar.mult || 1.15) * 1.1,
          ignoreACPct: methodGrammar.ignoreACPct || 0,
          lifestealPct: effectGrammar.lifestealPct || 0,
          target: 'TARGET'
        }
      ];

      if (effectGrammar.statusId) {
        ops.push({
          op: EFFECT_OP_TYPES.APPLY_STATUS,
          statusId: effectGrammar.statusId,
          duration: effectGrammar.duration || 3,
          power: effectGrammar.power || 6,
          target: 'TARGET'
        });
      }

      return new ActiveSkill({
        id: `${key}_SLOT_2_SEC_${method}_${effect}`,
        tomeKey: `SEC_${method}`,
        slot: 2,
        requiredMastery: 1,
        name: `보조 타격: ${effectGrammar.koPrefix} ${methodGrammar.koVerb}`,
        desc: `정교하게 가하는 ${distinctAtk.method} 2차 특수 타격 기술. (${dice})`,
        type: 'MELEE_STRIKE',
        element: effectGrammar.element || 'PHYSICAL',
        cooldown: 3,
        maxRange: methodGrammar.range || 1.5,
        dice,
        color: '#fb923c',
        icon: methodGrammar.icon || '🦷',
        synergyTags: [`${effectGrammar.element || 'PHYS'}_MELEE`],
        ops
      });
    }

    // 3. Fallback Archetype Ranged / Spitting / Lunge technique
    let fallbackName = '원거리 투척 견제';
    let fallbackElement = 'PHYSICAL';
    let fallbackIcon = '🪨';
    let fallbackRange = 5.0;
    let fallbackDice = '1d6';

    if (char === 'd' || char === 'D') {
      fallbackName = '원소 불꽃 뿜기';
      fallbackElement = 'FIRE';
      fallbackIcon = '🔥';
      fallbackDice = '2d6';
    } else if (char === 'S' || char === 's' || char === 'c') {
      fallbackName = '독침 투사';
      fallbackElement = 'POISON';
      fallbackIcon = '💉';
      fallbackDice = '1d8';
    } else if (char === 'j' || char === 'm') {
      fallbackName = '부식액 분사';
      fallbackElement = 'ACID';
      fallbackIcon = '🧪';
      fallbackDice = '2d6';
    } else if (char === 'B' || char === 'f') {
      fallbackName = '맹렬한 덮치기';
      fallbackElement = 'PHYSICAL';
      fallbackIcon = '🐾';
      fallbackRange = 3.0;
      fallbackDice = '2d4';
    }

    return new ActiveSkill({
      id: `${key}_SLOT_2_ARCHETYPE_SPECIAL`,
      tomeKey: 'ARCHETYPE_SPECIAL',
      slot: 2,
      requiredMastery: 1,
      name: fallbackName,
      desc: `${monsterData.name}의 고유 원거리/특수 견제 기술.`,
      type: fallbackRange > 1.5 ? 'PROJECTILE' : 'MELEE_STRIKE',
      element: fallbackElement,
      cooldown: 3,
      maxRange: fallbackRange,
      dice: fallbackDice,
      color: '#38bdf8',
      icon: fallbackIcon,
      synergyTags: [`${fallbackElement}_SPECIAL`],
      ops: [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: fallbackElement, dice: fallbackDice, target: 'TARGET' }
      ]
    });
  }

  // =========================================================================
  // Slot 3: Tactical / Mobility / Control / Aura
  // =========================================================================
  static _synthesizeSlot3(key, monsterData, spells, flags, char, seed, prevSkills) {
    const prevIds = new Set(prevSkills.map(s => s.tomeKey));

    // 1. Try to find a tactical/utility/crowd control spell
    const tacticalSpellKey = spells.find(s => {
      if (prevIds.has(s)) return false;
      const spec = SPELL_DESCRIPTOR_GRAMMAR[s];
      return spec && (
        spec.type === 'TELEPORT' ||
        spec.type === 'BUFF' ||
        spec.type === 'DEBUFF' ||
        spec.type === 'SELF' ||
        spec.type === 'SUMMON' ||
        spec.type === 'UTILITY' ||
        s === 'HEAL' ||
        s === 'HASTE' ||
        s === 'BLINK' ||
        s === 'TPORT' ||
        s === 'HOLD' ||
        s === 'CONF' ||
        s === 'SLOW' ||
        s === 'SCARE' ||
        s === 'BLIND' ||
        s.startsWith('S_')
      );
    });

    if (tacticalSpellKey) {
      const spec = SPELL_DESCRIPTOR_GRAMMAR[tacticalSpellKey];
      return new ActiveSkill({
        id: `${key}_SLOT_3_${tacticalSpellKey}`,
        tomeKey: tacticalSpellKey,
        slot: 3,
        requiredMastery: 10,
        name: spec.name,
        desc: spec.desc,
        type: spec.type,
        element: spec.element || 'MANA',
        cooldown: spec.cooldown || 4,
        maxRange: spec.range || 5.0,
        dice: spec.dice || '1d6',
        color: spec.color || '#a855f7',
        icon: spec.icon || '🌀',
        synergyTags: ['TACTICAL_CONTROL'],
        ops: spec.ops
      });
    }

    // 2. Try to find a Flag-based tactic
    for (const flagKey in ARCHETYPE_FLAG_TACTICS.FLAGS) {
      if (flags.has(flagKey)) {
        const tacSpec = ARCHETYPE_FLAG_TACTICS.FLAGS[flagKey];
        return new ActiveSkill({
          id: `${key}_SLOT_3_${tacSpec.id}`,
          tomeKey: tacSpec.id,
          slot: 3,
          requiredMastery: 10,
          name: tacSpec.name,
          desc: tacSpec.desc,
          type: tacSpec.type,
          element: tacSpec.element,
          cooldown: tacSpec.cooldown,
          maxRange: tacSpec.range || 2.5,
          dice: tacSpec.dice || '2d6',
          color: tacSpec.color || '#fbbf24',
          icon: tacSpec.icon || '⚡',
          synergyTags: ['TACTICAL_AURA'],
          ops: tacSpec.ops
        });
      }
    }

    // 3. Try Char-based tactic
    if (ARCHETYPE_FLAG_TACTICS.CHARS[char]) {
      const charSpec = ARCHETYPE_FLAG_TACTICS.CHARS[char];
      return new ActiveSkill({
        id: `${key}_SLOT_3_${charSpec.id}`,
        tomeKey: charSpec.id,
        slot: 3,
        requiredMastery: 10,
        name: charSpec.name,
        desc: charSpec.desc,
        type: charSpec.type,
        element: charSpec.element,
        cooldown: charSpec.cooldown,
        maxRange: charSpec.range || 2.5,
        dice: charSpec.dice || '2d6',
        color: '#fbbf24',
        icon: charSpec.icon || '🎯',
        synergyTags: ['TACTICAL_ARCHETYPE'],
        ops: charSpec.ops
      });
    }

    // 4. Fallback based on Growth Type & Shield Check
    const growthType = monsterData.growthType || 'BALANCED';
    const isShieldHumanoid = (char === 'p' || char === 'h' || char === 'k') && (
      monsterData.name.toLowerCase().includes('warrior') ||
      monsterData.name.toLowerCase().includes('guard') ||
      monsterData.name.toLowerCase().includes('knight') ||
      monsterData.name.toLowerCase().includes('paladin')
    );

    if (isShieldHumanoid) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_SHIELD_BASH`,
        tomeKey: 'SHIELD_BASH',
        slot: 3,
        requiredMastery: 10,
        name: '방패 강타 (Shield Bash)',
        desc: '단단한 방패로 적을 내리쳐 1턴간 기절시키고 뒤로 밀쳐냅니다.',
        type: 'MELEE_STRIKE',
        element: 'PHYSICAL',
        cooldown: 3,
        maxRange: 1.5,
        dice: '2d6',
        color: '#60a5fa',
        icon: '🛡️',
        synergyTags: ['PHYS_STUN'],
        ops: [
          { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.35, target: 'TARGET' },
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 1, power: 6, target: 'TARGET' },
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'PUSH_AWAY', dist: 1, target: 'TARGET' }
        ]
      });
    }

    // NEVER give SHIELD_BASH to non-shield monsters
    if (growthType === 'TANK') {
      return new ActiveSkill({
        id: `${key}_SLOT_3_IRON_SKIN`,
        tomeKey: 'IRON_SKIN',
        slot: 3,
        requiredMastery: 10,
        name: '강철 가죽 방호',
        desc: '신체 외피를 순간 강화하여 피해를 흡수하는 보호막을 전개합니다.',
        type: 'BUFF',
        element: 'PHYSICAL',
        cooldown: 6,
        maxRange: 0,
        color: '#94a3b8',
        icon: '🛡️',
        synergyTags: ['DEFENSE_BUFF'],
        ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 5, power: 12, target: 'SELF' }]
      });
    }

    return new ActiveSkill({
      id: `${key}_SLOT_3_TACTICAL_EVASION`,
      tomeKey: 'TACTICAL_EVASION',
      slot: 3,
      requiredMastery: 10,
      name: '전술적 회피 기동',
      desc: '민첩하게 몸을 움직여 4턴간 이동 속도를 가속합니다.',
      type: 'BUFF',
      element: 'PHYSICAL',
      cooldown: 5,
      range: 0,
      color: '#fbbf24',
      icon: '💨',
      synergyTags: ['SPEED_BUFF'],
      ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 4, target: 'SELF' }]
    });
  }

  // =========================================================================
  // Slot 4: Apex / Ultimate Finisher
  // =========================================================================
  static _synthesizeSlot4(key, monsterData, spells, attacks, flags, char, seed, prevSkills) {
    const prevIds = new Set(prevSkills.map(s => s.tomeKey));

    // 1. Try to find an Apex spell (Balls, High Breaths, Doom, Brain Smash, World)
    const apexSpellKey = spells.find(s => {
      if (prevIds.has(s)) return false;
      const spec = SPELL_DESCRIPTOR_GRAMMAR[s];
      return spec && (
        s.startsWith('BA_') ||
        s === 'HAND_DOOM' ||
        s === 'BRAIN_SMASH' ||
        s === 'WORLD' ||
        s === 'ROCKET' ||
        s === 'CAUSE_4' ||
        s === 'S_HI_DEMON' ||
        s === 'S_HI_DRAGON' ||
        s === 'S_HI_UNDEAD' ||
        s === 'S_UNIQUE' ||
        (spec.type === 'BREATH' && !prevIds.has(s))
      );
    });

    if (apexSpellKey) {
      const spec = SPELL_DESCRIPTOR_GRAMMAR[apexSpellKey];
      return new ActiveSkill({
        id: `${key}_SLOT_4_${apexSpellKey}`,
        tomeKey: apexSpellKey,
        slot: 4,
        requiredMastery: 25,
        name: `[궁극기] ${spec.name}`,
        desc: `전장을 휩쓰는 ${spec.name} 극대 파멸 궁극기.`,
        type: spec.type,
        element: spec.element,
        cooldown: Math.max(6, (spec.cooldown || 6) + 1),
        maxRange: spec.range || 6.5,
        dice: spec.dice || '15d10',
        color: spec.color || '#ec4899',
        icon: '👑',
        synergyTags: ['APEX_TECHNIQUE', `${spec.element}_APEX`],
        ops: spec.ops
      });
    }

    // 2. Synthesize an Apex Multi-Hit Combo Flurry using monster's attacks
    if (attacks.length > 1) {
      const comboOps = [];
      let totalMult = 1.0;
      for (const atk of attacks) {
        const method = (atk.method || 'HIT').toUpperCase();
        const effect = (atk.effect || 'HURT').toUpperCase();
        const dice = atk.damage || '1d6';
        const effectGrammar = BLOW_EFFECT_GRAMMAR[effect] || BLOW_EFFECT_GRAMMAR.HURT;

        comboOps.push({
          op: EFFECT_OP_TYPES.DEAL_DAMAGE,
          element: effectGrammar.element || 'PHYSICAL',
          dice,
          mult: 1.25,
          target: 'TARGET'
        });
        if (effectGrammar.statusId) {
          comboOps.push({
            op: EFFECT_OP_TYPES.APPLY_STATUS,
            statusId: effectGrammar.statusId,
            duration: 3,
            power: 6,
            target: 'TARGET'
          });
        }
      }

      return new ActiveSkill({
        id: `${key}_SLOT_4_APEX_COMBO_FLURRY`,
        tomeKey: 'APEX_COMBO_FLURRY',
        slot: 4,
        requiredMastery: 25,
        name: `[궁극기] ${monsterData.name}의 전심전력 연격 난무`,
        desc: `신체의 모든 타격 기관을 일제히 해방하여 ${attacks.length}회의 연속 파멸 강타를 쏟아붓습니다.`,
        type: 'MELEE_STRIKE',
        element: 'PHYSICAL',
        cooldown: 7,
        maxRange: 1.5,
        dice: attacks[0].damage || '2d8',
        color: '#f43f5e',
        icon: '👑',
        synergyTags: ['APEX_TECHNIQUE', 'MULTI_HIT_COMBO'],
        ops: comboOps
      });
    }

    // 3. Archetype Apex Finisher
    let apexName = `[궁극기] ${monsterData.name}의 한계 돌파 극타`;
    let apexElement = 'PHYSICAL';
    let apexDice = '10d10';
    let apexOps = [
      { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '10d10', mult: 2.0, ignoreACPct: 0.50, target: 'TARGET' },
      { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 2, power: 10, target: 'TARGET' }
    ];

    if (flags.has('DRAGON') || char === 'd' || char === 'D') {
      apexName = '[궁극기] 용황의 천지개벽 브레스';
      apexElement = 'FIRE';
      apexOps = [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'CONE', element: 'FIRE', dice: '15d12', range: 7.5 }
      ];
    } else if (flags.has('UNDEAD') || char === 'L' || char === 'V') {
      apexName = '[궁극기] 명계의 영혼 대수확';
      apexElement = 'NETHER';
      apexOps = [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'NETHER', dice: '12d10', radius: 3.5, lifestealPct: 0.50 }
      ];
    } else if (flags.has('DEMON') || char === 'u' || char === 'U') {
      apexName = '[궁극기] 지옥의 업화 대폭발';
      apexElement = 'FIRE';
      apexOps = [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'BALL', element: 'FIRE', dice: '14d10', range: 6.5, radius: 3.0 }
      ];
    } else if (char === 'j' || char === 'm') {
      apexName = '[궁극기] 절대 융해 산성 폭풍';
      apexElement = 'ACID';
      apexOps = [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'ACID', dice: '12d10', radius: 3.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SUNDER', duration: 5, power: 25 }] }
      ];
    }

    return new ActiveSkill({
      id: `${key}_SLOT_4_APEX_FINISHER`,
      tomeKey: 'APEX_FINISHER',
      slot: 4,
      requiredMastery: 25,
      name: apexName,
      desc: `${monsterData.name}의 모든 잠재력을 폭발시키는 궁극의 결전 기예.`,
      type: 'AOE',
      element: apexElement,
      cooldown: 8,
      maxRange: 6.0,
      dice: apexDice,
      color: '#ec4899',
      icon: '👑',
      synergyTags: ['APEX_TECHNIQUE'],
      ops: apexOps
    });
  }

  // =========================================================================
  // Sub-Core Infusions & Tactical Injections
  // =========================================================================
  static _applySubCoreInfusions(skillset, mainKey, subCoreKeys) {
    const subPayloads = [];

    for (const subKey of subCoreKeys) {
      const subData = this.resolveMonsterData(subKey);
      if (!subData) continue;

      let subElement = 'PHYSICAL';
      let subStatusId = null;

      // Extract from breathElement or spells
      if (subData.breathElement) {
        subElement = subData.breathElement;
      } else if (subData.spells && subData.spells.length > 0) {
        const offensiveSpell = subData.spells.find(s => SPELL_DESCRIPTOR_GRAMMAR[s]);
        if (offensiveSpell) {
          subElement = SPELL_DESCRIPTOR_GRAMMAR[offensiveSpell].element;
        }
      } else if (subData.attacks && subData.attacks.length > 0) {
        const atkEffect = subData.attacks[0].effect;
        if (atkEffect && BLOW_EFFECT_GRAMMAR[atkEffect]) {
          subElement = BLOW_EFFECT_GRAMMAR[atkEffect].element;
          subStatusId = BLOW_EFFECT_GRAMMAR[atkEffect].statusId;
        }
      }

      // Check aura flags
      if (subData.flags) {
        if (subData.flags.includes('AURA_FIRE')) subElement = 'FIRE';
        if (subData.flags.includes('AURA_COLD')) subElement = 'COLD';
        if (subData.flags.includes('AURA_ELEC')) subElement = 'LIGHTNING';
      }

      if (!subStatusId) {
        if (subElement === 'POISON') subStatusId = 'POISON';
        else if (subElement === 'FIRE') subStatusId = 'BURN';
        else if (subElement === 'COLD') subStatusId = 'SLOW';
        else if (subElement === 'LIGHTNING') subStatusId = 'STUN';
        else if (subElement === 'ACID') subStatusId = 'SUNDER';
      }

      subPayloads.push({
        key: subKey,
        name: subData.name,
        element: subElement,
        statusId: subStatusId,
        spells: subData.spells || []
      });
    }

    if (subPayloads.length === 0) return;

    // Infuse Slot 1 and Slot 2
    for (const targetSlot of [skillset[0], skillset[1]]) {
      if (!targetSlot) continue;

      for (const payload of subPayloads) {
        if (targetSlot.infusedBy.includes(payload.key)) continue;
        targetSlot.infusedBy.push(payload.key);

        // Append elemental bonus damage op
        if (payload.element && payload.element !== 'PHYSICAL') {
          targetSlot.ops.push({
            op: EFFECT_OP_TYPES.DEAL_DAMAGE,
            element: payload.element,
            dice: '1d6',
            mult: 0.5,
            target: 'TARGET'
          });
          targetSlot.synergyTags.push(`${payload.element}_INFUSION`);
          targetSlot.desc += ` [${payload.element} 주입: +1d6]`;
        }

        // Append status effect op
        if (payload.statusId) {
          targetSlot.ops.push({
            op: EFFECT_OP_TYPES.APPLY_STATUS,
            statusId: payload.statusId,
            duration: 3,
            power: 5,
            target: 'TARGET'
          });
          targetSlot.synergyTags.push(`${payload.statusId}_STATUS`);
        }
      }
    }

    // Optional Tactical Injection for Slot 3 (if subCore1 has a prominent tactical spell)
    const sub1 = subPayloads[0];
    if (sub1 && sub1.spells) {
      const prominentTactical = sub1.spells.find(s => s === 'BLINK' || s === 'HEAL' || s === 'HASTE' || s === 'TELEPORT');
      if (prominentTactical && skillset[2] && skillset[2].type === 'MELEE_STRIKE') {
        const spec = SPELL_DESCRIPTOR_GRAMMAR[prominentTactical];
        if (spec) {
          skillset[2].desc += ` (보조 코어 전술 주입: ${spec.name})`;
          skillset[2].ops.push(...spec.ops);
          skillset[2].infusedBy.push(sub1.key);
        }
      }
    }
  }

  // =========================================================================
  // 5-Tier Passive Tree Synthesis
  // =========================================================================
  /**
   * Synthesizes a genuinely unique 5-node passive tree (pt: 1, 3, 5, 7, 10).
   * @param {string} monsterKey
   * @returns {Array<Object>} 5 passive node objects
   */
  static synthesizePassiveTree(monsterKey) {
    if (this._passiveTreeCache.has(monsterKey)) {
      return this._passiveTreeCache.get(monsterKey);
    }

    const data = this.resolveMonsterData(monsterKey) || {
      name: monsterKey || 'Novice warrior',
      growthType: 'WARRIOR',
      attacks: [],
      flags: []
    };

    const tree = [];
    const flags = new Set(data.flags || []);
    const gType = data.growthType || 'BALANCED';

    // 1pt: Ancestral Stat Affinity
    let statTag = 'STR_BOOST';
    let statDesc = '힘(STR) 스탯 +10%';
    if (gType === 'TANK' || data.char === 'j' || data.char === 'm') {
      statTag = 'CON_BOOST';
      statDesc = '생명력(CON) 스탯 +10%';
    } else if (gType === 'MAGE' || flags.has('UNDEAD') || data.char === 'e') {
      statTag = 'INT_BOOST';
      statDesc = '지능(INT) 스탯 +10%';
    } else if (gType === 'SPEEDY' || flags.has('ANIMAL') || data.char === 'S' || data.char === 'B') {
      statTag = 'DEX_BOOST';
      statDesc = '민첩(DEX) 스탯 +10%';
    }

    tree.push({
      pt: 1,
      name: `${data.name}의 혈통`,
      desc: statDesc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: [statTag]
    });

    // 3pt: Innate Strike Technique / Element Attunement
    let pt3Name = '치명적 본능';
    let pt3Desc = '기본 공격력 및 치명타율 +5% 증가';
    let pt3Tags = ['STRONG_ATTACK'];

    if (data.attacks && data.attacks.length > 0) {
      const atk = data.attacks[0];
      const effect = atk.effect || 'HURT';
      if (effect === 'POISON' || effect === 'DISEASE') {
        pt3Name = '독소 분비체';
        pt3Desc = '모든 근접 공격에 맹독 피해 부여';
        pt3Tags = ['POISON_MELEE', 'ACID_MELEE'];
      } else if (effect === 'FIRE') {
        pt3Name = '발화 신체';
        pt3Desc = '모든 근접 공격에 화염 피해 부여';
        pt3Tags = ['FIRE_MELEE'];
      } else if (effect === 'COLD') {
        pt3Name = '혹한의 서리발';
        pt3Desc = '모든 근접 공격에 빙결 감속 부여';
        pt3Tags = ['COLD_MELEE'];
      } else if (effect === 'ELEC') {
        pt3Name = '생체 발전기';
        pt3Desc = '근접 공격 시 20% 확률로 뇌전 감전';
        pt3Tags = ['LIGHTNING_MELEE'];
      }
    }

    tree.push({
      pt: 3,
      name: pt3Name,
      desc: pt3Desc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: pt3Tags
    });

    // 5pt: Carapace & Elemental Resistance
    const resTags = [];
    if (flags.has('IM_FIRE') || flags.has('RES_FIRE')) resTags.push('FIRE_RESIST');
    if (flags.has('IM_COLD') || flags.has('RES_COLD')) resTags.push('COLD_RESIST');
    if (flags.has('IM_ELEC') || flags.has('RES_ELEC')) resTags.push('LIGHTNING_RESIST');
    if (flags.has('IM_ACID') || flags.has('RES_ACID')) resTags.push('ACID_RESIST');
    if (flags.has('IM_POIS') || flags.has('RES_POIS')) resTags.push('POISON_RESIST');

    tree.push({
      pt: 5,
      name: `${data.name}의 외피`,
      desc: resTags.length > 0 ? `${resTags.length}종 원소 저항력 획득` : '물리 피해 고정 감쇄 획득',
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: resTags.length > 0 ? resTags : ['PHYS_RESIST']
    });

    // 7pt: Mobility / Regeneration / Ambush Perk
    let pt7Name = '강인한 육체';
    let pt7Desc = '체력 자연 회복력 및 최대 HP +10% 증가';
    let pt7Tags = ['CON_BOOST'];

    if ((data.speed && data.speed >= 6) || flags.has('CAN_FLY') || flags.has('FAST')) {
      pt7Name = '질풍의 비행';
      pt7Desc = '행동 속도를 충전해 주는 가속(HASTE_UNIT)을 획득합니다.';
      pt7Tags = ['HASTE_UNIT'];
    } else if (flags.has('REGENERATE')) {
      pt7Name = '세포 재생';
      pt7Desc = '매 턴마다 생명력이 자연 재생됩니다.';
      pt7Tags = ['REGEN_UNIT'];
    } else if (flags.has('INVISIBLE')) {
      pt7Name = '그림자 은신';
      pt7Desc = '어둠 속에서 치명타 확률이 대폭 증가합니다.';
      pt7Tags = ['AMBUSH'];
    } else if (flags.has('UNDEAD')) {
      pt7Name = '망령의 생명 착취';
      pt7Desc = '적에게 입힌 피해의 일부를 생명력으로 흡수합니다.';
      pt7Tags = ['LIFESTEAL'];
    }

    tree.push({
      pt: 7,
      name: pt7Name,
      desc: pt7Desc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: pt7Tags
    });

    // 10pt: Apex Awakening / Core Transcendance
    let pt10Name = '[각성] 패왕의 기백';
    let pt10Desc = '모든 능력치 및 전투 능력이 극한으로 각성합니다.';
    let pt10Tags = ['BERSERK_RAGE'];

    if (flags.has('DRAGON')) {
      pt10Name = '[각성] 용황 각성';
      pt10Desc = '모든 원소 피해 +50% 및 브레스 쿨다운 -2턴';
      pt10Tags = ['ELEMENTAL_BOOST', 'DRAGON_AWAKENING'];
    } else if (flags.has('UNDEAD') || flags.has('DEMON')) {
      pt10Name = '[각성] 심연의 지배자';
      pt10Desc = '적 처치 시 주변에 공포 파동 및 체력 흡수';
      pt10Tags = ['SOUL_REAP', 'FEAR_AURA'];
    } else if (data.char === 'j' || data.char === 'm') {
      pt10Name = '[각성] 극산성 대사체';
      pt10Desc = '피격 시 적 방어력 100% 분쇄 및 산성 반격';
      pt10Tags = ['ACID_COUNTER', 'PHYS_RESIST'];
    } else if (gType === 'WARRIOR' || flags.has('ORC') || flags.has('GIANT')) {
      pt10Name = '[각성] 광폭 분쇄격';
      pt10Desc = '공격 시 25% 확률로 연속 2회 타격';
      pt10Tags = ['FRENZY', 'STRONG_ATTACK'];
    }

    tree.push({
      pt: 10,
      name: pt10Name,
      desc: pt10Desc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: pt10Tags
    });

    this._passiveTreeCache.set(monsterKey, tree);
    return tree;
  }
}
