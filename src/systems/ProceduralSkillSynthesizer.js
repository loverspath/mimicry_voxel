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
import { ProjectileEffect, ConeBreathEffect, AoEExplosionEffect, FloatingTextEffect } from '../core/Effects.js';
import { combatVFXEngine } from './CombatVFXEngine.js';

export const ELEMENT_KO = Object.freeze({
  PHYSICAL: '물리',
  POISON: '맹독',
  FIRE: '화염',
  COLD: '냉기',
  LIGHTNING: '뇌전',
  ELEC: '뇌전',
  ACID: '산성',
  MANA: '비전',
  NETHER: '황천',
  DARK: '암흑',
  LIGHT: '광휘',
  CHAOS: '혼돈',
  SOUND: '음파',
  SHARDS: '파편',
  WATER: '수류',
  FORCE: '역장',
  PLASMA: '플라즈마',
  TIME: '시공간',
  GRAVITY: '중력',
  INERTIA: '관성',
  CONFUSION: '혼란',
  DISENCHANT: '해체',
  DISINTEGRATION: '분해',
  HOLY: '신성'
});

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
    this.requiredMastery = data.requiredMastery || (data.slot <= 2 ? 1 : (data.slot === 3 ? 3 : 6));
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

      // Visual Effects (ProjectileEffect, ConeBreathEffect, AoEExplosionEffect, combatVFXEngine)
      if (game && Array.isArray(game.effects)) {
        const sx = player.x;
        const sy = player.y;
        const tx = resolvedTarget ? resolvedTarget.x : sx;
        const ty = resolvedTarget ? resolvedTarget.y : sy;
        const sType = (this.type || '').toUpperCase();
        const hasAreaOp = this.ops && this.ops.some(op => op.op === EFFECT_OP_TYPES.PROJECT_AREA);

        if ((sType === 'BREATH' || sType === 'CONE_BREATH') && !hasAreaOp) {
          game.effects.push(new ConeBreathEffect(sx, sy, tx, ty, this));
        } else if ((sType === 'AOE' || sType === 'AOE_BURST') && !hasAreaOp) {
          game.effects.push(new AoEExplosionEffect(tx, ty, this.aoeRadius || this.maxRange || 2.5, this.element || 'FIRE', null, this));
        } else if (resolvedTarget && (this.maxRange > 1.5 || sType === 'PROJECTILE' || sType === 'DEBUFF' || sType === 'BOLT')) {
          game.effects.push(new ProjectileEffect(sx, sy, tx, ty, this));
        }
      }

      if (combatVFXEngine && typeof combatVFXEngine.triggerSpellAction === 'function') {
        const sType = (this.type || '').toUpperCase();
        let vfxId = 'MISSILE';
        const el = (this.element || 'MANA').toUpperCase();
        if (sType === 'BREATH' || sType === 'CONE_BREATH') {
          vfxId = 'BREATH';
        } else if (sType === 'AOE' || sType === 'AOE_BURST') {
          vfxId = `BA_${el === 'FIRE' ? 'FIRE' : el === 'COLD' || el === 'ICE' ? 'COLD' : el === 'LIGHTNING' || el === 'ELEC' ? 'ELEC' : el === 'ACID' ? 'ACID' : 'MANA'}`;
        } else if (sType === 'PROJECTILE' || sType === 'BOLT') {
          vfxId = `BO_${el === 'FIRE' ? 'FIRE' : el === 'COLD' || el === 'ICE' ? 'COLD' : el === 'LIGHTNING' || el === 'ELEC' ? 'ELEC' : el === 'ACID' ? 'ACID' : 'FIRE'}`;
        } else if (sType === 'DEBUFF') {
          if (this.id.includes('BLIND') || this.name.includes('실명')) vfxId = 'BLIND';
          else if (this.id.includes('CONF') || this.name.includes('혼란')) vfxId = 'CONFUSION';
          else if (this.id.includes('FEAR') || this.name.includes('공포')) vfxId = 'FEAR';
          else vfxId = 'MISSILE';
        } else if (sType === 'TELEPORT') {
          vfxId = 'TELEPORT';
        }
        combatVFXEngine.triggerSpellAction(vfxId, player, resolvedTarget, this.element, 0);
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
      return (game.map && typeof game.map.isTransparent === 'function') ? game.map.isTransparent(player.x, player.y, m.x, m.y) : true;
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
    const growthType = monsterData.growthType || 'BALANCED';

    // 5대 데이터 시그니처 (growthType, spells, attacks, flags, breathElement) 기반 일반화 아키타입 판정
    const isCaster = growthType === 'MAGE' || growthType === 'PRIEST' || char === 'u' ||
      rawSpells.some(s => s.startsWith('BO_') || s.startsWith('BA_') || s === 'MISSILE' || s === 'MIND_BLAST' || s.startsWith('CAUSE_'));
    const isRangedArcher = growthType === 'ARCHER' || flags.has('ARCHER') || rawSpells.some(s => s.startsWith('ARROW_'));

    const remainingSpells = [...rawSpells];

    // ----------------------------------------------------
    // Slot 1: Signature Blow / Innate Strike or Core Caster Spell (reqMastery: 1)
    // ----------------------------------------------------
    const slot1 = this._synthesizeSlot1(cleanKey, monsterData, rawAttacks, flags, char, seed, remainingSpells, isCaster, isRangedArcher);

    // ----------------------------------------------------
    // Slot 2: Primary Elemental / Ranged / Secondary Strike / Support (reqMastery: 1)
    // ----------------------------------------------------
    const slot2 = this._synthesizeSlot2(cleanKey, monsterData, remainingSpells, rawAttacks, flags, char, seed, slot1);

    // ----------------------------------------------------
    // Slot 3: Tactical / Mobility / Control / Aura (reqMastery: 3)
    // ----------------------------------------------------
    const slot3 = this._synthesizeSlot3(cleanKey, monsterData, remainingSpells, flags, char, seed, [slot1, slot2]);

    // ----------------------------------------------------
    // Slot 4: Apex / Ultimate Finisher / High Spell (reqMastery: 6)
    // ----------------------------------------------------
    const slot4 = this._synthesizeSlot4(cleanKey, monsterData, remainingSpells, rawAttacks, flags, char, seed, [slot1, slot2, slot3], isCaster);

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
  // Slot 1: Signature Blow / Innate Strike or Core Caster/Ranged Magic
  // =========================================================================
  static _synthesizeSlot1(key, monsterData, attacks, flags, char, seed, availableSpells = [], isCaster = false, isRangedArcher = false) {
    if (isCaster || isRangedArcher) {
      let chosenKey = null;
      if (isRangedArcher) {
        chosenKey = availableSpells.find(s => s.startsWith('ARROW_')) || 'ARROW_1';
      } else {
        // Caster: priority BO_* -> MISSILE -> MIND_BLAST -> CAUSE_*
        chosenKey = availableSpells.find(s => s.startsWith('BO_')) ||
                    availableSpells.find(s => s === 'MISSILE') ||
                    availableSpells.find(s => s === 'MIND_BLAST') ||
                    availableSpells.find(s => s === 'CAUSE_1' || s === 'CAUSE_2' || s === 'CAUSE_3') ||
                    (monsterData.growthType === 'PRIEST' ? 'CAUSE_1' : 'MISSILE');
      }

      if (chosenKey) {
        const spec = SPELL_DESCRIPTOR_GRAMMAR[chosenKey];
        if (spec) {
          const sIdx = availableSpells.indexOf(chosenKey);
          if (sIdx >= 0) availableSpells.splice(sIdx, 1);

          const cleanName = (spec.name || chosenKey).replace(/\[궁극기\]\s*/g, '');
          const elemKor = ELEMENT_KO[spec.element] || '비전';

          return new ActiveSkill({
            id: `${key}_SLOT_1_${chosenKey}`,
            tomeKey: chosenKey,
            slot: 1,
            requiredMastery: 1,
            name: cleanName,
            desc: spec.desc || `원거리 ${elemKor} 투사체를 발사하여 대상을 타격합니다. (${spec.dice || '2d6'})`,
            type: spec.type || 'PROJECTILE',
            element: spec.element || 'MANA',
            cooldown: Math.min(2, spec.cooldown || 2),
            maxRange: spec.range || 6.0,
            dice: spec.dice || '2d6',
            color: spec.color || '#38bdf8',
            icon: spec.icon || '🔮',
            synergyTags: ['SPELL_CHARGE', `${spec.element || 'MANA'}_SPELL`],
            ops: spec.ops
          });
        }
      }
    }

    if (attacks.length > 0) {
      const atk0 = attacks[0];
      const method = (atk0.method || 'HIT').toUpperCase();
      const effect = (atk0.effect || 'HURT').toUpperCase();
      const dice = atk0.damage || '1d4';

      const methodGrammar = BLOW_METHOD_GRAMMAR[method] || BLOW_METHOD_GRAMMAR.HIT;
      const effectGrammar = BLOW_EFFECT_GRAMMAR[effect] || BLOW_EFFECT_GRAMMAR.HURT;

      let name = `${effectGrammar.koPrefix} ${methodGrammar.koVerb}`;
      const isSwordWarrior = (char === 'p' || char === 'h' || char === 'k') && (
        monsterData.name.toLowerCase().includes('warrior') ||
        monsterData.name.toLowerCase().includes('guard') ||
        monsterData.name.toLowerCase().includes('knight') ||
        monsterData.name.toLowerCase().includes('soldier')
      );
      if (isSwordWarrior && method === 'HIT' && effect === 'HURT') {
        name = '검 베기';
      } else if (attacks.length >= 3 && attacks.some(a => a.method === 'CLAW') && attacks.some(a => a.method === 'BITE')) {
        name = '연속 할퀴기와 물어뜯기';
      }

      const elemKey = effectGrammar.element || 'PHYSICAL';
      const elemKor = ELEMENT_KO[elemKey] || '물리';

      const ops = [
        {
          op: EFFECT_OP_TYPES.DEAL_DAMAGE,
          element: elemKey,
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
        desc: `대상을 강하게 가격하는 ${elemKor} 속성 타격 기술. (${dice})`,
        type: methodGrammar.delivery === 'MELEE_RUSH' ? 'CHARGE' : 'MELEE_STRIKE',
        element: elemKey,
        cooldown: 2,
        maxRange: methodGrammar.range || 1.5,
        dice,
        color: '#f43f5e',
        icon: methodGrammar.icon || '⚔️',
        synergyTags: [elemKey ? `${elemKey}_MELEE` : 'PHYS_MELEE'],
        ops
      });
    }

    // Creature with NEVER_BLOW or 0 attacks (Molds, Eyes, Jellies, Passive NPCs)
    let fallbackName = '본능적 타격';
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
      desc: '신체 본능을 실어 대상을 타격합니다. (1d4)',
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
  // Slot 2: Survival / Stance / Ecological Upkeep / Support Gimmick
  // =========================================================================
  static _synthesizeSlot2(key, monsterData, spells, attacks, flags, char, seed, slot1) {
    const growthType = monsterData.growthType || 'BALANCED';
    const nameLower = (monsterData.name || '').toLowerCase();

    // 다중 스펠 몬스터의 상태이상/제어/보조 주문 최우선 분배 (BLIND, CONF, SCARE, SLOW, HOLD, HEAL, HASTE 등)
    const controlSpellKey = spells.find(s => 
      s === 'CONF' || s === 'BLIND' || s === 'SCARE' || s === 'HOLD' || s === 'SLOW' ||
      s === 'HEAL' || s === 'HASTE' || s === 'MANA_SHIELD' || s === 'INVULNER' || s === 'FORGET' ||
      s === 'DISPEL' || s === 'SHRIEK'
    );
    if (controlSpellKey) {
      const spec = SPELL_DESCRIPTOR_GRAMMAR[controlSpellKey];
      if (spec) {
        const sIdx = spells.indexOf(controlSpellKey);
        if (sIdx >= 0) spells.splice(sIdx, 1);
        const cleanName = (spec.name || controlSpellKey).replace(/\[궁극기\]\s*/g, '');
        return new ActiveSkill({
          id: `${key}_SLOT_2_${controlSpellKey}`,
          tomeKey: controlSpellKey,
          slot: 2,
          requiredMastery: 1,
          name: cleanName,
          desc: spec.desc,
          type: spec.type,
          element: spec.element || 'MANA',
          cooldown: spec.cooldown || 4,
          maxRange: spec.range || 5.0,
          color: spec.color || '#c084fc',
          icon: spec.icon || '🌀',
          synergyTags: ['CONTROL_SPELL'],
          ops: spec.ops
        });
      }
    }

    // 1. Ogre / Troll / Giant / Regenerate
    if (flags.has('GIANT') || flags.has('TROLL') || flags.has('OGRE') || flags.has('REGENERATE') || char === 'O' || char === 'T' || char === 'P') {
      return new ActiveSkill({
        id: `${key}_SLOT_2_GIANT_REGEN`,
        tomeKey: 'GIANT_REGEN',
        slot: 2,
        requiredMastery: 1,
        name: '거인족 피의 재생',
        desc: '신체 활성 세포를 급속 자극하여 생명력을 회복하고 상처를 치유합니다.',
        type: 'BUFF',
        element: 'PHYSICAL',
        cooldown: 5,
        maxRange: 0,
        color: '#10b981',
        icon: '🌿',
        synergyTags: ['DEFENSE_BUFF', 'REGEN_UNIT'],
        ops: [
          { op: EFFECT_OP_TYPES.HEAL_ENTITY, dice: '3d8', target: 'SELF' },
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'REGEN_UNIT', duration: 4, power: 5, target: 'SELF' }
        ]
      });
    }

    // 2. Slime / Mold / Jelly (cell fission / acid counter)
    if (char === 'j' || char === 'm' || char === ',') {
      return new ActiveSkill({
        id: `${key}_SLOT_2_SLIME_FISSION`,
        tomeKey: 'SLIME_FISSION',
        slot: 2,
        requiredMastery: 1,
        name: '점액 세포 분열',
        desc: '점액질 세포를 분열시켜 피해를 흡수하는 방어막을 전개하고 체력을 회복합니다.',
        type: 'BUFF',
        element: 'ACID',
        cooldown: 5,
        maxRange: 0,
        color: '#22c55e',
        icon: '🟢',
        synergyTags: ['DEFENSE_BUFF', 'ACID_COUNTER'],
        ops: [
          { op: EFFECT_OP_TYPES.HEAL_ENTITY, dice: '2d8', target: 'SELF' },
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 4, power: 15, target: 'SELF' }
        ]
      });
    }

    // 3. Rogue / Assassin / Thief / Invisible (only if not Mage or Priest)
    if (growthType === 'ROGUE' || ((flags.has('INVISIBLE') || nameLower.includes('thief') || nameLower.includes('rogue') || nameLower.includes('assassin')) && growthType !== 'MAGE' && growthType !== 'PRIEST')) {
      return new ActiveSkill({
        id: `${key}_SLOT_2_SHADOW_VEIL`,
        tomeKey: 'SHADOW_VEIL',
        slot: 2,
        requiredMastery: 1,
        name: '그림자 은신',
        desc: '어둠의 장막 속에 몸을 숨겨 회피율과 급습 치명타 확률을 끌어올립니다.',
        type: 'BUFF',
        element: 'DARK',
        cooldown: 6,
        maxRange: 0,
        color: '#475569',
        icon: '👥',
        synergyTags: ['STEALTH_BUFF', 'AMBUSH'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 4, target: 'SELF' }
        ]
      });
    }

    // 4. Undead / Ghost / Wraith / Wight / Lich
    if (flags.has('UNDEAD') || char === 'G' || char === 'W' || char === 'L' || char === 'V') {
      return new ActiveSkill({
        id: `${key}_SLOT_2_DEATH_WAIL`,
        tomeKey: 'DEATH_WAIL',
        slot: 2,
        requiredMastery: 1,
        name: '망자의 통곡',
        desc: '사령의 서늘한 비명을 내질러 주변 적들에게 공포를 심고 움직임을 둔화시킵니다.',
        type: 'AOE',
        element: 'NETHER',
        cooldown: 6,
        maxRange: 2.5,
        color: '#818cf8',
        icon: '👻',
        synergyTags: ['CONTROL_AOE', 'FEAR_AURA'],
        ops: [
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'NETHER', dice: '2d6', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 3, power: 5 }] }
        ]
      });
    }

    // 5. Dragon / Wyrm
    if (flags.has('DRAGON') || char === 'd' || char === 'D') {
      return new ActiveSkill({
        id: `${key}_SLOT_2_DRAGON_DREAD`,
        tomeKey: 'DRAGON_DREAD',
        slot: 2,
        requiredMastery: 1,
        name: '용의 위압',
        desc: '고룡의 위압적인 기운을 뿜어내어 전신에 단단한 비늘 방어막을 형성합니다.',
        type: 'BUFF',
        element: 'FIRE',
        cooldown: 6,
        maxRange: 0,
        color: '#f97316',
        icon: '🐉',
        synergyTags: ['DEFENSE_BUFF'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 5, power: 20, target: 'SELF' }
        ]
      });
    }

    // 6. Priest / Cleric / Angel / Holy
    if (flags.has('ANGEL') || char === 'A' || spells.includes('HEAL') || nameLower.includes('priest') || nameLower.includes('cleric') || nameLower.includes('paladin')) {
      return new ActiveSkill({
        id: `${key}_SLOT_2_HOLY_HEAL`,
        tomeKey: 'HOLY_HEAL',
        slot: 2,
        requiredMastery: 1,
        name: '성스러운 치유',
        desc: '성스러운 권능을 집중하여 부상당한 신체를 치유하고 회복합니다.',
        type: 'SELF',
        element: 'HOLY',
        cooldown: 5,
        maxRange: 0,
        color: '#fbbf24',
        icon: '✨',
        synergyTags: ['HOLY_BUFF', 'SAGE_HEAL'],
        ops: [
          { op: EFFECT_OP_TYPES.HEAL_ENTITY, dice: '3d8', target: 'SELF' }
        ]
      });
    }

    // 7. Beholder / Eye
    if (char === 'e' || char === 'E' || nameLower.includes('beholder') || nameLower.includes('eye')) {
      return new ActiveSkill({
        id: `${key}_SLOT_2_CONFUSION_GAZE`,
        tomeKey: 'CONFUSION_GAZE',
        slot: 2,
        requiredMastery: 1,
        name: '혼란의 주시',
        desc: '기괴한 마안의 눈빛으로 대상의 정신을 어지럽혀 혼란에 빠뜨립니다.',
        type: 'PROJECTILE',
        element: 'MANA',
        cooldown: 4,
        maxRange: 5.0,
        color: '#c084fc',
        icon: '👁️',
        synergyTags: ['CONTROL_SPELL'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'CONFUSE', duration: 3, power: 5, target: 'TARGET' }
        ]
      });
    }

    // 8. Mage / Caster / Imp
    if (growthType === 'MAGE' || spells.includes('BLINK') || spells.includes('MANA_SHIELD') || char === 'u' || (char === 'p' && nameLower.includes('mage'))) {
      return new ActiveSkill({
        id: `${key}_SLOT_2_MANA_SHIELD`,
        tomeKey: 'MANA_SHIELD',
        slot: 2,
        requiredMastery: 1,
        name: '마력 보호막',
        desc: '압축된 비전 마나를 신체 주변에 둘러 적의 피해를 흡수하는 보호막을 전개합니다.',
        type: 'BUFF',
        element: 'MANA',
        cooldown: 5,
        maxRange: 0,
        color: '#38bdf8',
        icon: '🔮',
        synergyTags: ['DEFENSE_BUFF', 'MANA_SHIELD_PASSIVE'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 4, power: 15, target: 'SELF' }
        ]
      });
    }

    // 9. Humanoid Warrior / Knight / Guard (e.g. Novice warrior)
    if ((char === 'p' || char === 'h' || char === 'k') && (growthType === 'WARRIOR' || nameLower.includes('warrior') || nameLower.includes('guard') || nameLower.includes('knight') || nameLower.includes('soldier'))) {
      return new ActiveSkill({
        id: `${key}_SLOT_2_DEFENSIVE_STANCE`,
        tomeKey: 'DEFENSIVE_STANCE',
        slot: 2,
        requiredMastery: 1,
        name: '방패 막기 태세',
        desc: '방어구를 견고히 다잡아 적의 공격을 방어하고 충격을 감쇄시키는 태세를 취합니다.',
        type: 'BUFF',
        element: 'PHYSICAL',
        cooldown: 4,
        maxRange: 0,
        color: '#60a5fa',
        icon: '🛡️',
        synergyTags: ['DEFENSE_BUFF'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 4, power: 12, target: 'SELF' }
        ]
      });
    }

    // 10. Animal / Beast / Speedy
    if (flags.has('ANIMAL') || growthType === 'SPEEDY' || char === 'f' || char === 'C' || char === 'B') {
      return new ActiveSkill({
        id: `${key}_SLOT_2_ALERT_STANCE`,
        tomeKey: 'ALERT_STANCE',
        slot: 2,
        requiredMastery: 1,
        name: '경계 태세',
        desc: '야수의 본능적인 직감으로 주변을 경계하며 신속하게 회피할 태세를 갖춥니다.',
        type: 'BUFF',
        element: 'PHYSICAL',
        cooldown: 4,
        maxRange: 0,
        color: '#fbbf24',
        icon: '🐾',
        synergyTags: ['SPEED_BUFF'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 3, target: 'SELF' }
        ]
      });
    }

    // Fallback Defensive Stance
    return new ActiveSkill({
      id: `${key}_SLOT_2_DEFENSIVE_STANCE`,
      tomeKey: 'DEFENSIVE_STANCE',
      slot: 2,
      requiredMastery: 1,
      name: '방어 태세',
      desc: '단단한 방어 태세를 취하여 일시적으로 피해를 흡수하는 방어막을 전개합니다.',
      type: 'BUFF',
      element: 'PHYSICAL',
      cooldown: 4,
      maxRange: 0,
      color: '#94a3b8',
      icon: '🛡️',
      synergyTags: ['DEFENSE_BUFF'],
      ops: [
        { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 4, power: 10, target: 'SELF' }
      ]
    });
  }

  // =========================================================================
  // Slot 3: Terrain / Movement / Environment Interaction Gimmick (reqMastery: 3)
  // =========================================================================
  static _synthesizeSlot3(key, monsterData, spells, flags, char, seed, prevSkills) {
    const prevIds = new Set(prevSkills.map(s => s.tomeKey));
    const growthType = monsterData.growthType || 'BALANCED';
    const nameLower = (monsterData.name || '').toLowerCase();

    // 1. PASS_WALL
    if (flags.has('PASS_WALL')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_PASS_WALL`,
        tomeKey: 'PASS_WALL',
        slot: 3,
        requiredMastery: 3,
        name: '에테르 투과',
        desc: '물질계를 일시 이탈하여 벽을 자유롭게 통과하여 이동합니다.',
        type: 'TELEPORT',
        element: 'DARK',
        cooldown: 4,
        maxRange: 4.5,
        color: '#6366f1',
        icon: '👻',
        synergyTags: ['PASS_WALL', 'TACTICAL_MOBILITY'],
        ops: [
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: 4, target: 'SELF' }
        ]
      });
    }

    // 2. KILL_WALL / HURT_ROCK
    if (flags.has('KILL_WALL') || flags.has('HURT_ROCK')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_KILL_WALL`,
        tomeKey: 'KILL_WALL',
        slot: 3,
        requiredMastery: 3,
        name: '암반 굴착',
        desc: '전방의 단단한 암벽을 파쇄하여 새로운 통로를 개척하고 주변에 충격파를 일으킵니다.',
        type: 'AOE',
        element: 'PHYSICAL',
        cooldown: 5,
        maxRange: 2.5,
        dice: '3d8',
        color: '#a8a29e',
        icon: '⛏️',
        synergyTags: ['KILL_WALL', 'ALTER_MAP'],
        ops: [
          { op: EFFECT_OP_TYPES.ALTER_MAP, action: 'EARTHQUAKE', radius: 2 },
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'PHYSICAL', dice: '3d8', radius: 2.5 }
        ]
      });
    }

    // 2.5. Teleport spells for Mages/Casters (priority over flight for casters)
    const casterTeleSpell = spells.find(s => s === 'BLINK' || s === 'TPORT' || s === 'TELE_TO');
    if (casterTeleSpell && (growthType === 'MAGE' || growthType === 'PRIEST')) {
      spells.splice(spells.indexOf(casterTeleSpell), 1);
      const isBlink = (casterTeleSpell === 'BLINK');
      return new ActiveSkill({
        id: `${key}_SLOT_3_${casterTeleSpell}`,
        tomeKey: casterTeleSpell,
        slot: 3,
        requiredMastery: 3,
        name: isBlink ? '단거리 전이' : '차원 이동',
        desc: '공간을 왜곡하여 안전한 위치로 순식간에 순간 이동합니다.',
        type: 'TELEPORT',
        element: 'MANA',
        cooldown: isBlink ? 3 : 5,
        maxRange: isBlink ? 4.0 : 8.0,
        color: '#c084fc',
        icon: '🌀',
        synergyTags: ['TACTICAL_MOBILITY'],
        ops: [
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: isBlink ? 4 : 8, target: 'SELF' }
        ]
      });
    }

    // 3. CAN_FLY / FLYING
    if (flags.has('CAN_FLY') || flags.has('FLYING')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_AERIAL_SWOOP`,
        tomeKey: 'AERIAL_SWOOP',
        slot: 3,
        requiredMastery: 3,
        name: '비상 강습',
        desc: '공중으로 솟구쳐 함정을 무시하고 적의 머리 위로 급강하 타격을 가합니다.',
        type: 'CHARGE',
        element: 'PHYSICAL',
        cooldown: 4,
        maxRange: 4.0,
        dice: '2d8',
        color: '#38bdf8',
        icon: '🦅',
        synergyTags: ['CAN_FLY', 'TACTICAL_MOBILITY'],
        ops: [
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', dist: 4, target: 'TARGET' },
          { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d8', mult: 1.25, target: 'TARGET' }
        ]
      });
    }

    // 4. REFLECTING / REFLECT
    if (flags.has('REFLECTING') || flags.has('REFLECT')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_MIRROR_CARAPACE`,
        tomeKey: 'MIRROR_CARAPACE',
        slot: 3,
        requiredMastery: 3,
        name: '거울 장갑',
        desc: '마법 투사체를 튕겨내는 거울 광택 장갑을 활성화합니다.',
        type: 'BUFF',
        element: 'MANA',
        cooldown: 7,
        maxRange: 0,
        color: '#67e8f9',
        icon: '🛡️',
        synergyTags: ['DEFENSE_BUFF', 'REFLECT'],
        ops: [
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SHIELD', duration: 5, power: 20, target: 'SELF' }
        ]
      });
    }

    // 5. Teleport spells (BLINK, TPORT, TELE_TO, etc.)
    const teleSpell = spells.find(s => s === 'BLINK' || s === 'TPORT' || s === 'TELE_TO' || s === 'TELE_AWAY' || s === 'TELE_LEVEL' || s === 'DARKNESS' || s === 'TRAPS');
    if (teleSpell) {
      spells.splice(spells.indexOf(teleSpell), 1);
      const isBlink = (teleSpell === 'BLINK');
      const spec = SPELL_DESCRIPTOR_GRAMMAR[teleSpell];
      const cleanName = isBlink ? '단거리 전이' : (spec?.name || teleSpell).replace(/\[궁극기\]\s*/g, '');
      return new ActiveSkill({
        id: `${key}_SLOT_3_${teleSpell}`,
        tomeKey: teleSpell,
        slot: 3,
        requiredMastery: 3,
        name: cleanName,
        desc: spec?.desc || '공간을 왜곡하여 안전한 위치로 순식간에 순간 이동합니다.',
        type: spec?.type || 'TELEPORT',
        element: spec?.element || 'MANA',
        cooldown: isBlink ? 3 : (spec?.cooldown || 5),
        maxRange: spec?.range || (isBlink ? 4.0 : 8.0),
        color: spec?.color || '#c084fc',
        icon: spec?.icon || '🌀',
        synergyTags: ['TACTICAL_MOBILITY'],
        ops: spec?.ops || [
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: isBlink ? 4 : 8, target: 'SELF' }
        ]
      });
    }

    // 6. Elemental Auras
    if (flags.has('AURA_FIRE')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_AURA_FIRE`,
        tomeKey: 'AURA_FIRE',
        slot: 3,
        requiredMastery: 3,
        name: '화염 오라 방출',
        desc: '신체 주변에 작열하는 화염 오라를 폭발시켜 근접한 적을 불태웁니다.',
        type: 'AOE',
        element: 'FIRE',
        cooldown: 5,
        maxRange: 2.5,
        dice: '3d8',
        color: '#ef4444',
        icon: '🔥',
        synergyTags: ['TACTICAL_AURA'],
        ops: [
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'FIRE', dice: '3d8', radius: 2.5 }
        ]
      });
    }
    if (flags.has('AURA_COLD')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_AURA_COLD`,
        tomeKey: 'AURA_COLD',
        slot: 3,
        requiredMastery: 3,
        name: '서리 오라 방출',
        desc: '신체 주변에 냉기를 방출하여 주변 적을 둔화시킵니다.',
        type: 'AOE',
        element: 'COLD',
        cooldown: 5,
        maxRange: 2.5,
        dice: '3d8',
        color: '#38bdf8',
        icon: '❄️',
        synergyTags: ['TACTICAL_AURA'],
        ops: [
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'COLD', dice: '3d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SLOW', duration: 3, power: 8 }] }
        ]
      });
    }
    if (flags.has('AURA_ELEC')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_AURA_ELEC`,
        tomeKey: 'AURA_ELEC',
        slot: 3,
        requiredMastery: 3,
        name: '뇌전 방전',
        desc: '주변 타일에 고압 전기를 방전하여 적을 감전시킵니다.',
        type: 'AOE',
        element: 'LIGHTNING',
        cooldown: 5,
        maxRange: 2.5,
        dice: '3d8',
        color: '#eab308',
        icon: '⚡',
        synergyTags: ['TACTICAL_AURA'],
        ops: [
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'LIGHTNING', dice: '3d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 1, power: 5 }] }
        ]
      });
    }

    // 7. Humanoid Warrior / Knight / Guard (e.g. Novice warrior)
    if ((char === 'p' || char === 'h' || char === 'k') && (growthType === 'WARRIOR' || nameLower.includes('warrior') || nameLower.includes('guard') || nameLower.includes('knight') || nameLower.includes('soldier'))) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_SHOULDER_TACKLE`,
        tomeKey: 'SHOULDER_TACKLE',
        slot: 3,
        requiredMastery: 3,
        name: '어깨 밀치기',
        desc: '체중을 실어 강하게 몸을 부딪혀 적을 뒤로 1칸 밀쳐내고 1턴간 기절시킵니다.',
        type: 'CHARGE',
        element: 'PHYSICAL',
        cooldown: 3,
        maxRange: 2.0,
        dice: '2d6',
        color: '#60a5fa',
        icon: '🛡️',
        synergyTags: ['PHYS_STUN', 'TACTICAL_CONTROL'],
        ops: [
          { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.25, target: 'TARGET' },
          { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 1, power: 6, target: 'TARGET' },
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'PUSH_AWAY', dist: 1, target: 'TARGET' }
        ]
      });
    }

    // 8. Rogue / Assassin
    if (growthType === 'ROGUE' || nameLower.includes('thief') || nameLower.includes('rogue') || nameLower.includes('assassin')) {
      return new ActiveSkill({
        id: `${key}_SLOT_3_SHADOW_STEP`,
        tomeKey: 'SHADOW_STEP',
        slot: 3,
        requiredMastery: 3,
        name: '그림자 걸음',
        desc: '그림자 속을 미끄러지듯 이동하여 대상의 배후로 순간 도약합니다.',
        type: 'TELEPORT',
        element: 'DARK',
        cooldown: 4,
        maxRange: 3.5,
        color: '#64748b',
        icon: '👥',
        synergyTags: ['TACTICAL_MOBILITY'],
        ops: [
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'BLINK', dist: 3, target: 'SELF' }
        ]
      });
    }

    // 9. Beast / Speedy
    if (flags.has('ANIMAL') || growthType === 'SPEEDY' || char === 'f' || char === 'C' || char === 'B') {
      return new ActiveSkill({
        id: `${key}_SLOT_3_LEAP_RUSH`,
        tomeKey: 'LEAP_RUSH',
        slot: 3,
        requiredMastery: 3,
        name: '도약 돌진',
        desc: '강한 도약으로 거리를 좁혀 적에게 덮치기 타격을 가합니다.',
        type: 'CHARGE',
        element: 'PHYSICAL',
        cooldown: 3,
        maxRange: 3.5,
        dice: '2d6',
        color: '#fbbf24',
        icon: '🐾',
        synergyTags: ['TACTICAL_MOBILITY'],
        ops: [
          { op: EFFECT_OP_TYPES.DISPLACE, mode: 'CHARGE_TO', dist: 3, target: 'TARGET' },
          { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '2d6', mult: 1.2, target: 'TARGET' }
        ]
      });
    }

    // Fallback: Tactical Maneuver
    return new ActiveSkill({
      id: `${key}_SLOT_3_TACTICAL_MANEUVER`,
      tomeKey: 'TACTICAL_MANEUVER',
      slot: 3,
      requiredMastery: 3,
      name: '전술적 기동',
      desc: '민첩하게 위치를 전환하여 3턴간 이동 속도를 가속합니다.',
      type: 'BUFF',
      element: 'PHYSICAL',
      cooldown: 4,
      maxRange: 0,
      color: '#fbbf24',
      icon: '💨',
      synergyTags: ['SPEED_BUFF'],
      ops: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'HASTE', duration: 3, target: 'SELF' }]
    });
  }

  // =========================================================================
  // Slot 4: Apex Finisher / Signature High Spell / Breath (reqMastery: 6)
  // =========================================================================
  static _synthesizeSlot4(key, monsterData, spells, attacks, flags, char, seed, prevSkills) {
    const prevIds = new Set(prevSkills.map(s => s.tomeKey));
    const growthType = monsterData.growthType || 'BALANCED';
    const nameLower = (monsterData.name || '').toLowerCase();

    // 1. Dragon Breaths (BR_*) - TOP PRIORITY for Breaths / Dragons to avoid starvation!
    const isDragon = flags.has('DRAGON') || char === 'd' || char === 'D' || nameLower.includes('dragon') || nameLower.includes('wyrm');
    const breathSpellKey = spells.find(s => s.startsWith('BR_')) || (isDragon && monsterData.breathElement ? `BR_${monsterData.breathElement}` : null);
    if (breathSpellKey) {
      if (spells.includes(breathSpellKey)) {
        spells.splice(spells.indexOf(breathSpellKey), 1);
      }
      const breathNames = {
        BR_FIRE: '화염의 숨결',
        BR_COLD: '냉기의 숨결',
        BR_ACID: '산성의 숨결',
        BR_ELEC: '뇌전의 숨결',
        BR_POIS: '독의 숨결',
        BR_NETH: '황천의 숨결',
        BR_CHAOS: '혼돈의 숨결',
        BR_DISI: '분해의 숨결',
        BR_TIME: '시간의 숨결',
        BR_DARK: '암흑의 숨결',
        BR_LITE: '섬광의 숨결',
        BR_SHAR: '파편의 숨결',
        BR_SOUN: '음파의 숨결'
      };
      const element = breathSpellKey.replace('BR_', '') || 'FIRE';
      const breathName = breathNames[breathSpellKey] || `${ELEMENT_KO[element] || element} 숨결`;
      const spec = SPELL_DESCRIPTOR_GRAMMAR[breathSpellKey] || {
        element,
        cooldown: 6,
        range: 6.5,
        dice: '12d10',
        color: '#ef4444'
      };

      return new ActiveSkill({
        id: `${key}_SLOT_4_${breathSpellKey}`,
        tomeKey: breathSpellKey,
        slot: 4,
        requiredMastery: 6,
        name: breathName,
        desc: `전방 원뿔 범위를 향해 강력한 ${breathName}을 내뿜어 광역 피해를 입힙니다.`,
        type: 'BREATH',
        element: spec.element || element,
        cooldown: Math.max(5, (spec.cooldown || 6)),
        maxRange: spec.range || 6.5,
        dice: spec.dice || '12d10',
        color: spec.color || '#ef4444',
        icon: '🐉',
        synergyTags: ['APEX_TECHNIQUE', `${spec.element || element}_BREATH`],
        ops: spec.ops || [
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'CONE', element: spec.element || element, dice: spec.dice || '12d10', range: spec.range || 6.5 }
        ]
      });
    }

    // 2. Apex Spells (BA_*, HAND_DOOM, BRAIN_SMASH, WORLD, ROCKET, CAUSE_4, S_HI_*, DRAIN_MANA)
    const apexSpellKey = spells.find(s => {
      return (
        s.startsWith('BA_') ||
        s === 'HAND_DOOM' ||
        s === 'BRAIN_SMASH' ||
        s === 'WORLD' ||
        s === 'ROCKET' ||
        s === 'CAUSE_4' ||
        s === 'DRAIN_MANA' ||
        s === 'S_HI_DEMON' ||
        s === 'S_HI_DRAGON' ||
        s === 'S_HI_UNDEAD' ||
        s === 'S_UNIQUE'
      );
    });

    if (apexSpellKey) {
      spells.splice(spells.indexOf(apexSpellKey), 1);
      const spec = SPELL_DESCRIPTOR_GRAMMAR[apexSpellKey] || {
        name: apexSpellKey,
        desc: '강력한 상급 주문을 시전합니다.',
        type: 'AOE',
        element: 'MANA',
        cooldown: 6,
        range: 6.0,
        dice: '10d10',
        color: '#ec4899'
      };

      // Strip prohibited tags like [궁극기]
      const cleanName = (spec.name || apexSpellKey).replace(/\[궁극기\]\s*/g, '');

      return new ActiveSkill({
        id: `${key}_SLOT_4_${apexSpellKey}`,
        tomeKey: apexSpellKey,
        slot: 4,
        requiredMastery: 6,
        name: cleanName,
        desc: `전장을 휩쓰는 강력한 ${cleanName} 주문을 시전합니다. (${spec.dice || '10d10'})`,
        type: spec.type,
        element: spec.element,
        cooldown: Math.max(5, (spec.cooldown || 6)),
        maxRange: spec.range || 6.5,
        dice: spec.dice || '10d10',
        color: spec.color || '#ec4899',
        icon: '🔮',
        synergyTags: ['APEX_TECHNIQUE', `${spec.element || 'MANA'}_APEX`],
        ops: spec.ops
      });
    }

    // 3. Other projectile / offensive spells or remaining spells for Casters
    const candidateSpellKey = spells.find(s => {
      return (
        s.startsWith('BO_') ||
        s.startsWith('ARROW_') ||
        s === 'MISSILE' ||
        s === 'MIND_BLAST' ||
        s.startsWith('CAUSE_')
      );
    }) || (spells.length > 0 ? spells[0] : null);

    if (candidateSpellKey || growthType === 'MAGE' || growthType === 'PRIEST') {
      const spellKey = candidateSpellKey || 'BO_FIRE';
      if (spells.includes(spellKey)) {
        spells.splice(spells.indexOf(spellKey), 1);
      }
      const spec = SPELL_DESCRIPTOR_GRAMMAR[spellKey] || {
        name: spellKey === 'MISSILE' ? '마법 화살' : '화염 화살',
        desc: '원거리 마법 투사체를 발사합니다.',
        type: 'PROJECTILE',
        element: spellKey === 'MISSILE' ? 'MANA' : 'FIRE',
        cooldown: 4,
        range: 6.0,
        dice: '4d8',
        color: '#38bdf8'
      };

      const cleanName = (spec.name || spellKey).replace(/\[궁극기\]\s*/g, '');

      return new ActiveSkill({
        id: `${key}_SLOT_4_${spellKey}`,
        tomeKey: spellKey,
        slot: 4,
        requiredMastery: 6,
        name: cleanName,
        desc: spec.desc || `정밀하게 조준된 ${cleanName} 투사체를 발사하여 대상을 강타합니다.`,
        type: spec.type || 'PROJECTILE',
        element: spec.element || 'MANA',
        cooldown: spec.cooldown || 4,
        maxRange: spec.range || 6.0,
        dice: spec.dice || '4d8',
        color: spec.color || '#38bdf8',
        icon: spec.icon || '🔮',
        synergyTags: ['APEX_TECHNIQUE', `${spec.element || 'MANA'}_SPELL`],
        ops: spec.ops || [
          { op: EFFECT_OP_TYPES.PROJECT_MISSILE, element: spec.element || 'MANA', dice: spec.dice || '4d8', range: spec.range || 6.0 }
        ]
      });
    }

    // 4. Special physical gimmicks (EXPLODE, ENGULF, SHATTER)
    const hasExplode = attacks.some(a => a.method === 'EXPLODE');
    if (hasExplode) {
      return new ActiveSkill({
        id: `${key}_SLOT_4_EXPLODE`,
        tomeKey: 'EXPLODE',
        slot: 4,
        requiredMastery: 6,
        name: '제어 폭발',
        desc: '체내 폭발성 에너지를 방출하여 주변 타일의 적들에게 강력한 파편 피해를 가합니다.',
        type: 'AOE',
        element: 'SHARDS',
        cooldown: 6,
        maxRange: 2.5,
        dice: '8d8',
        color: '#ef4444',
        icon: '💥',
        synergyTags: ['APEX_TECHNIQUE'],
        ops: [{ op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'SHARDS', dice: '8d8', radius: 2.5 }]
      });
    }

    const hasEngulf = attacks.some(a => a.method === 'ENGULF');
    if (hasEngulf) {
      return new ActiveSkill({
        id: `${key}_SLOT_4_ENGULF`,
        tomeKey: 'ENGULF',
        slot: 4,
        requiredMastery: 6,
        name: '포식',
        desc: '대상을 신체 내부로 집어삼켜 강력한 소화 피해를 가하고 체력을 회복합니다.',
        type: 'MELEE_STRIKE',
        element: 'ACID',
        cooldown: 5,
        maxRange: 1.5,
        dice: '4d8',
        color: '#22c55e',
        icon: '👅',
        synergyTags: ['APEX_TECHNIQUE'],
        ops: [
          { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'ACID', dice: '4d8', mult: 1.5, lifestealPct: 0.5, target: 'TARGET' }
        ]
      });
    }

    const hasShatter = attacks.some(a => a.effect === 'SHATTER');
    if (hasShatter) {
      return new ActiveSkill({
        id: `${key}_SLOT_4_SHATTER`,
        tomeKey: 'SHATTER',
        slot: 4,
        requiredMastery: 6,
        name: '대지 강타',
        desc: '지면을 강하게 내리쳐 진동파로 주변 지형과 적들을 일제히 흔들어 놓습니다.',
        type: 'AOE',
        element: 'PHYSICAL',
        cooldown: 5,
        maxRange: 2.0,
        dice: '5d8',
        color: '#78716c',
        icon: '🔨',
        synergyTags: ['APEX_TECHNIQUE'],
        ops: [
          { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'PHYSICAL', dice: '5d8', radius: 2.0, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 1, power: 8 }] }
        ]
      });
    }

    // 5. Multi-Attack Melee Combo Flurry
    if (attacks.length > 1) {
      const isSwordHumanoid = (char === 'p' || char === 'h' || char === 'k');
      const isBeast = (char === 'f' || char === 'C' || char === 'd' || char === 'B' || flags.has('ANIMAL'));
      let comboName = '연속 타격';
      if (isSwordHumanoid) {
        comboName = '무기 숙련 연격';
      } else if (isBeast) {
        comboName = '연속 할퀴기와 물어뜯기';
      }

      const comboOps = [];
      for (const atk of attacks) {
        const method = (atk.method || 'HIT').toUpperCase();
        const effect = (atk.effect || 'HURT').toUpperCase();
        const dice = atk.damage || '1d6';
        const effectGrammar = BLOW_EFFECT_GRAMMAR[effect] || BLOW_EFFECT_GRAMMAR.HURT;

        comboOps.push({
          op: EFFECT_OP_TYPES.DEAL_DAMAGE,
          element: effectGrammar.element || 'PHYSICAL',
          dice,
          mult: 1.15,
          target: 'TARGET'
        });
      }

      return new ActiveSkill({
        id: `${key}_SLOT_4_COMBO_STRIKE`,
        tomeKey: 'COMBO_STRIKE',
        slot: 4,
        requiredMastery: 6,
        name: comboName,
        desc: `모든 타격 부위를 연계하여 ${attacks.length}회의 연속 타격을 신속하게 퍼붓습니다.`,
        type: 'MELEE_STRIKE',
        element: 'PHYSICAL',
        cooldown: 5,
        maxRange: 1.5,
        dice: attacks[0].damage || '2d6',
        color: '#f43f5e',
        icon: '⚔️',
        synergyTags: ['APEX_TECHNIQUE', 'MULTI_HIT_COMBO'],
        ops: comboOps
      });
    }

    // 6. Single Attack Archetype Finisher
    let apexName = '결전 강타';
    let apexElement = 'PHYSICAL';
    let apexDice = '6d8';
    let apexOps = [
      { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'PHYSICAL', dice: '6d8', mult: 1.5, ignoreACPct: 0.35, target: 'TARGET' },
      { op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'STUN', duration: 1, power: 8, target: 'TARGET' }
    ];

    if (flags.has('UNDEAD') || char === 'L' || char === 'V') {
      apexName = '생명력 착취 접촉';
      apexElement = 'NETHER';
      apexOps = [
        { op: EFFECT_OP_TYPES.DEAL_DAMAGE, element: 'NETHER', dice: '5d8', lifestealPct: 0.50, target: 'TARGET' }
      ];
    } else if (char === 'j' || char === 'm') {
      apexName = '산성 점액 방출';
      apexElement = 'ACID';
      apexOps = [
        { op: EFFECT_OP_TYPES.PROJECT_AREA, shape: 'SURROUND', element: 'ACID', dice: '5d8', radius: 2.5, onHitOps: [{ op: EFFECT_OP_TYPES.APPLY_STATUS, statusId: 'SUNDER', duration: 3, power: 15 }] }
      ];
    } else if (growthType === 'WARRIOR') {
      apexName = '대지 강타';
    }

    return new ActiveSkill({
      id: `${key}_SLOT_4_APEX_FINISHER`,
      tomeKey: 'APEX_FINISHER',
      slot: 4,
      requiredMastery: 6,
      name: apexName,
      desc: `온 힘을 실어 적을 강타하는 필사의 공격. (${apexDice})`,
      type: 'MELEE_STRIKE',
      element: apexElement,
      cooldown: 5,
      maxRange: 1.5,
      dice: apexDice,
      color: '#f43f5e',
      icon: '⚔️',
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
          const elemKor = ELEMENT_KO[payload.element] || payload.element;
          targetSlot.desc += ` [${elemKor} 주입: +1d6]`;
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
    const char = data.char || 'p';
    const nameLower = (data.name || '').toLowerCase();

    // ----------------------------------------------------
    // 1pt: Ancestral Stat Affinity
    // ----------------------------------------------------
    let statTag = 'STR_BOOST';
    let statName = '전사의 완력';
    let statDesc = '힘(STR) 스탯 +10%';

    if (gType === 'TANK' || char === 'j' || char === 'm') {
      statTag = 'CON_BOOST';
      statName = '강인한 생명력';
      statDesc = '생명력(CON) 스탯 +10%';
    } else if (gType === 'MAGE' || flags.has('UNDEAD') || char === 'e' || char === 'u') {
      statTag = 'INT_BOOST';
      statName = '마력 친화';
      statDesc = '지능(INT) 스탯 +10%';
    } else if (gType === 'SPEEDY' || gType === 'ROGUE' || flags.has('ANIMAL') || char === 'S' || char === 'B' || char === 'f') {
      statTag = 'DEX_BOOST';
      statName = '기민한 감각';
      statDesc = '민첩(DEX) 스탯 +10%';
    }

    tree.push({
      pt: 1,
      name: statName,
      desc: statDesc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: [statTag]
    });

    // ----------------------------------------------------
    // 3pt: Innate Combat Gimmick
    // ----------------------------------------------------
    let pt3Name = '강타 숙련';
    let pt3Desc = '기본 공격력 및 치명타율 보정';
    let pt3Tags = ['STRONG_ATTACK'];

    if (gType === 'MAGE' || (data.spells && data.spells.length > 0)) {
      pt3Name = '주문 충전';
      pt3Desc = '마법 주문 적중 시 행동 에너지가 충전됩니다.';
      pt3Tags = ['SPELL_CHARGE'];
    } else if (flags.has('GIANT') || flags.has('TROLL') || flags.has('OGRE') || flags.has('REGENERATE') || char === 'O' || char === 'T' || char === 'P') {
      pt3Name = '거인족 피의 재생';
      pt3Desc = '피격 시 확률적으로 결손 체력을 자연 회복합니다.';
      pt3Tags = ['GIANT_BLOOD'];
    } else if (char === 'j' || char === 'm' || char === ',') {
      pt3Name = '산성 반격';
      pt3Desc = '피격 시 부식 산성 반사 피해를 입힙니다.';
      pt3Tags = ['ACID_COUNTER'];
    } else if (gType === 'ROGUE' || flags.has('INVISIBLE') || nameLower.includes('thief') || nameLower.includes('rogue')) {
      pt3Name = '그림자 기습';
      pt3Desc = '벽 지형에 인접한 적 근접 타격 시 추가 피해를 입힙니다.';
      pt3Tags = ['AMBUSH'];
    } else if (flags.has('ANGEL') || char === 'A' || nameLower.includes('priest') || nameLower.includes('cleric')) {
      pt3Name = '현자의 은혜';
      pt3Desc = '마법 상태이상인 적 처치 시 체력을 회복합니다.';
      pt3Tags = ['SAGE_HEAL'];
    } else if (data.attacks && data.attacks.length > 0) {
      const atk = data.attacks[0];
      const effect = (atk.effect || 'HURT').toUpperCase();
      if (effect === 'POISON' || effect === 'DISEASE') {
        pt3Name = '독소 분비체';
        pt3Desc = '근접 공격 시 맹독 피해를 부여합니다.';
        pt3Tags = ['POISON_MELEE'];
      } else if (effect === 'FIRE') {
        pt3Name = '발화 신체';
        pt3Desc = '근접 공격 시 화염 피해를 부여합니다.';
        pt3Tags = ['FIRE_MELEE'];
      } else if (effect === 'COLD') {
        pt3Name = '혹한의 냉기';
        pt3Desc = '근접 공격 시 빙결 감속을 부여합니다.';
        pt3Tags = ['COLD_MELEE'];
      } else if (effect === 'ELEC') {
        pt3Name = '뇌전 유도';
        pt3Desc = '근접 공격 시 뇌전 감전을 일으킵니다.';
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

    // ----------------------------------------------------
    // 5pt: Defensive / Resistance / Environmental
    // ----------------------------------------------------
    const resTags = [];
    if (flags.has('IM_FIRE') || flags.has('RES_FIRE')) resTags.push('FIRE_RESIST');
    if (flags.has('IM_COLD') || flags.has('RES_COLD')) resTags.push('COLD_RESIST');
    if (flags.has('IM_ELEC') || flags.has('RES_ELEC')) resTags.push('LIGHTNING_RESIST');
    if (flags.has('IM_ACID') || flags.has('RES_ACID')) resTags.push('ACID_RESIST');
    if (flags.has('IM_POIS') || flags.has('RES_POIS')) resTags.push('POISON_RESIST');

    let pt5Name = '단단한 갑주';
    let pt5Desc = '물리 피해 고정 감쇄 획득';
    let pt5Tags = ['PHYS_RESIST'];

    if (flags.has('PASS_WALL')) {
      pt5Name = '위상 투과';
      pt5Desc = '물질계 벽 타일을 자유롭게 투과하여 이동할 수 있습니다.';
      pt5Tags = ['PASS_WALL'];
    } else if (flags.has('CAN_FLY') || flags.has('FLYING')) {
      pt5Name = '비행 본능';
      pt5Desc = '바닥의 모든 함정을 무시하고 공중을 비행합니다.';
      pt5Tags = ['CAN_FLY'];
    } else if (resTags.length > 0) {
      pt5Name = '원소 저항 외피';
      pt5Desc = `${resTags.length}종 원소 저항력을 획득합니다.`;
      pt5Tags = resTags;
    } else if (gType === 'MAGE') {
      pt5Name = '마력 보호막';
      pt5Desc = '스킬 시전 시 피해를 흡수하는 마나 보호막을 전개합니다.';
      pt5Tags = ['MANA_SHIELD_PASSIVE'];
    }

    tree.push({
      pt: 5,
      name: pt5Name,
      desc: pt5Desc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: pt5Tags
    });

    // ----------------------------------------------------
    // 7pt: Mobility / Regeneration / Sustain
    // ----------------------------------------------------
    let pt7Name = '불굴의 투지';
    let pt7Desc = '대기 시 소실된 체력을 신속히 회복합니다.';
    let pt7Tags = ['WAIT_HEAL'];

    if (gType === 'MAGE') {
      pt7Name = '신속 영창';
      pt7Desc = '스킬 쿨다운이 신속하게 감소합니다.';
      pt7Tags = ['QUICKCAST'];
    } else if (flags.has('REGENERATE') || flags.has('GIANT') || flags.has('TROLL')) {
      pt7Name = '자연 재생';
      pt7Desc = '매 턴마다 생명력이 자연 재생됩니다.';
      pt7Tags = ['REGEN_UNIT'];
    } else if (flags.has('INVISIBLE') || gType === 'ROGUE') {
      pt7Name = '기민한 회피';
      pt7Desc = '적의 공격을 민첩하게 피하는 추가 회피율을 획득합니다.';
      pt7Tags = ['EVASION_BOOST'];
    } else if (flags.has('UNDEAD')) {
      pt7Name = '생명력 흡수';
      pt7Desc = '적에게 입힌 피해의 일부를 생명력으로 흡수합니다.';
      pt7Tags = ['LIFESTEAL'];
    } else if (flags.has('ANGEL') || char === 'A' || nameLower.includes('priest')) {
      pt7Name = '성스러운 가호';
      pt7Desc = '피격 시 신성 가호로 체력을 회복합니다.';
      pt7Tags = ['HOLY_SHIELD'];
    } else if (flags.has('CAN_FLY') || flags.has('FAST') || gType === 'SPEEDY') {
      pt7Name = '질풍 기동';
      pt7Desc = '행동 속도를 충전해 주는 가속 효과를 획득합니다.';
      pt7Tags = ['HASTE_UNIT'];
    } else if (gType === 'WARRIOR') {
      pt7Name = '휴식 재생';
      pt7Desc = '대기 시 소실된 체력을 신속히 회복합니다.';
      pt7Tags = ['WAIT_HEAL'];
    }

    tree.push({
      pt: 7,
      name: pt7Name,
      desc: pt7Desc,
      type: 'PASSIVE',
      isIntScaled: false,
      synergyTags: pt7Tags
    });

    // ----------------------------------------------------
    // 10pt: Apex Mastery
    // ----------------------------------------------------
    let pt10Name = '절대 투지';
    let pt10Desc = '체력이 저하되면 전투 능력이 대폭 증폭됩니다.';
    let pt10Tags = ['BERSERK_RAGE'];

    if (flags.has('DRAGON')) {
      pt10Name = '용의 권능';
      pt10Desc = '모든 원소 피해 및 브레스 위력이 증폭됩니다.';
      pt10Tags = ['ELEMENTAL_BOOST'];
    } else if (flags.has('UNDEAD') || flags.has('DEMON')) {
      pt10Name = '심연의 공포';
      pt10Desc = '주변 적들에게 지속적인 공포 디버프를 부여합니다.';
      pt10Tags = ['FEAR_AURA'];
    } else if (char === 'j' || char === 'm') {
      pt10Name = '원초적 분열';
      pt10Desc = '피격 시 생명력이 지속적으로 자가 회복됩니다.';
      pt10Tags = ['REGEN_UNIT'];
    } else if (gType === 'WARRIOR' || flags.has('ORC') || flags.has('GIANT')) {
      pt10Name = '전장의 광기';
      pt10Desc = '위기 상황에서 공격력과 이동 속도가 대폭 상승합니다.';
      pt10Tags = ['BERSERK_RAGE'];
    } else if (gType === 'MAGE') {
      pt10Name = '비전 극대화';
      pt10Desc = '지능 기반 마법 주문의 최종 위력이 집중 증폭됩니다.';
      pt10Tags = ['FOCUS'];
    } else if (gType === 'ROGUE') {
      pt10Name = '급소 찌르기';
      pt10Desc = '치명타 임계치가 대폭 낮아져 치명타가 빈번하게 발생합니다.';
      pt10Tags = ['CRIT_UNIT'];
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
