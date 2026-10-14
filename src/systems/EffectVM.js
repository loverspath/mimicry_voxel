/**
 * @module EffectVM
 * @category systems
 * @description Argon 표준 무상태 EffectVM (Effect Virtual Machine).
 *              스킬, 몬스터 주문, 물약/스크롤, 완드/스태프/로드, 유물 발동의 12대 정형 EffectOp[] 파이프라인을 실행하며,
 *              피해 연산, 투사체/범위 폭발, 상태이상 부여/치료, 맵 변형, 엔티티 소환 및 통합 사망 처리(LootSystem / BossPhaseEngine)를 보장합니다.
 * @purity Pure / Stateless Execution Engine
 * @dependencies EffectOpSchema.js, CombatCalculator.js, StatusEffectEngine.js, LootSystem.js, Monster.js, BossPhaseEngine.js
 * @exports EffectVM
 */

import { EFFECT_OP_TYPES } from '../configs/EffectOpSchema.js';
import { CombatCalculator } from '../core/CombatCalculator.js';
import { StatusEffectEngine } from './StatusEffectEngine.js';
import { LootSystem } from '../core/LootSystem.js';
import { Monster } from '../entities/Monster.js';
import { bossPhaseEngine } from './BossPhaseEngine.js';

export class EffectVM {
  /**
   * 일련의 EffectOp 배열 또는 단일 EffectOp를 실행합니다.
   * @param {Object|Array<Object>} ops - 단일 또는 배열 형태의 EffectOp
   * @param {Object} context - 실행 컨텍스트
   * @param {Object} [context.caster] - 시전자 엔티티 (Player or Monster)
   * @param {Object} [context.target] - 대상 엔티티
   * @param {number} [context.targetX] - 대상 X 좌표
   * @param {number} [context.targetY] - 대상 Y 좌표
   * @param {Object} [context.game] - Game 핵심 인스턴스
   * @param {Object} [context.map] - 던전 맵 객체
   * @param {Array<Object>} [context.monsters] - 몬스터 목록
   * @param {Function} [context.addLogEntry] - 로그 출력 콜백
   * @returns {{ success: boolean, results: Array<Object> }}
   */
  static execute(ops, context = {}) {
    if (!ops) return { success: true, results: [] };
    const opList = Array.isArray(ops) ? ops : [ops];
    const results = [];

    for (const op of opList) {
      if (!op || typeof op !== 'object' || !op.op) continue;
      const res = this.executeOp(op, context);
      results.push(res);
    }

    return { success: true, results };
  }

  /**
   * 단일 EffectOp를 디스패치하여 실행합니다.
   * @param {Object} op
   * @param {Object} context
   * @returns {Object}
   */
  static executeOp(op, context = {}) {
    switch (op.op) {
      case EFFECT_OP_TYPES.DEAL_DAMAGE:
        return this._executeDealDamage(op, context);

      case EFFECT_OP_TYPES.PROJECT_AREA:
        return this._executeProjectArea(op, context);

      case EFFECT_OP_TYPES.APPLY_STATUS:
        return this._executeApplyStatus(op, context);

      case EFFECT_OP_TYPES.CURE_STATUS:
        return this._executeCureStatus(op, context);

      case EFFECT_OP_TYPES.HEAL_ENTITY:
        return this._executeHealEntity(op, context);

      case EFFECT_OP_TYPES.MODIFY_STAT:
        return this._executeModifyStat(op, context);

      case EFFECT_OP_TYPES.DISPLACE:
        return this._executeDisplace(op, context);

      case EFFECT_OP_TYPES.SUMMON_ENTITIES:
        return this._executeSummonEntities(op, context);

      case EFFECT_OP_TYPES.ALTER_MAP:
        return this._executeAlterMap(op, context);

      case EFFECT_OP_TYPES.MUTATE_INVENTORY:
        return this._executeMutateInventory(op, context);

      case EFFECT_OP_TYPES.DRAIN_VITAL:
        return this._executeDrainVital(op, context);

      case EFFECT_OP_TYPES.GRANT_RESOURCE:
        return this._executeGrantResource(op, context);

      default:
        return { op: op.op, executed: false, error: `Unknown op: ${op.op}` };
    }
  }

  // ==========================================
  // [1. DEAL_DAMAGE]
  // ==========================================
  static _executeDealDamage(op, context) {
    const target = this._resolveTarget(op.target || 'TARGET', context);
    if (!target || !target.stats) {
      return { op: op.op, executed: false, error: 'Target not found or has no stats' };
    }

    const caster = context.caster || null;
    const element = (op.element || 'PHYSICAL').toUpperCase();
    const logFn = this._getLogFn(context);

    // 1. 기본 대미지 연산 (dice + flat) * mult
    let baseDmg = op.flat || 0;
    if (op.dice) {
      baseDmg += CombatCalculator.rollDice(op.dice);
    }
    const mult = typeof op.mult === 'number' && Number.isFinite(op.mult) ? op.mult : 1.0;
    let finalDmg = Math.floor(baseDmg * mult);

    // 2. 방어력 감쇄 (ignoreACPct 적용)
    const ignoreACPct = typeof op.ignoreACPct === 'number' ? Math.max(0, Math.min(1, op.ignoreACPct)) : 0;
    if (ignoreACPct < 1.0) {
      const acFactor = 1.0 - ignoreACPct;
      if (target.isPlayer) {
        const totalAC = target.getTotalAC ? target.getTotalAC() : (10 + (target.dexMod || 0));
        const acReduction = Math.floor((totalAC / 8) * acFactor);
        finalDmg = Math.max(1, finalDmg - acReduction);

        // INVULN / damageReductionPct 적용
        const mods = StatusEffectEngine.getAggregatedModifiers(target);
        if (mods.damageReductionPct > 0) {
          finalDmg = Math.max(1, Math.floor(finalDmg * (1 - mods.damageReductionPct)));
        }
      } else {
        const mAC = target.baseAC !== undefined ? target.baseAC : 10;
        const acReduction = Math.floor((mAC / 8) * acFactor);
        finalDmg = Math.max(1, finalDmg - acReduction);
      }
    }

    // 3. 속성 저항 및 면역 감쇄
    if (element !== 'PHYSICAL') {
      if (target.isPlayer) {
        const hasRes = CombatCalculator.getPlayerResistance(target, element);
        if (hasRes) {
          finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
        }
      } else {
        const mFlags = target.flags || (target.compileActiveTags ? target.compileActiveTags() : {});
        const checkElemFlag = (col, el) => Boolean(col && (col instanceof Set ? col.has(el) : (Array.isArray(col) && col.includes(el))));
        const isImmune = Boolean(mFlags[`IM_${element}`] || checkElemFlag(target.immunities, element));
        if (isImmune) {
          finalDmg = 0;
        } else {
          const isRes = Boolean(mFlags[`RES_${element}`] || checkElemFlag(target.resistances, element));
          if (isRes) {
            finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
          }
        }
      }
    }

    // 4. 슬레이 태그 증폭 (slayTags)
    if (op.slayTags && Array.isArray(op.slayTags) && !target.isPlayer) {
      const mType = (target.type || target.name || '').toUpperCase();
      for (const st of op.slayTags) {
        if (mType.includes(st.toUpperCase())) {
          finalDmg = Math.floor(finalDmg * 1.5);
          break;
        }
      }
    }

    // 체력 감소
    target.stats.hp = Math.max(0, target.stats.hp - finalDmg);

    // 5. 흡혈 (lifestealPct)
    let healAmt = 0;
    if (op.lifestealPct && op.lifestealPct > 0 && caster && caster.stats) {
      healAmt = Math.floor(finalDmg * op.lifestealPct);
      if (healAmt > 0) {
        caster.stats.hp = Math.min(caster.stats.maxHp, caster.stats.hp + healAmt);
      }
    }

    const targetName = target.displayName || target.name || (target.isPlayer ? '플레이어' : '대상');
    if (logFn) {
      logFn(`[Damage] 💥 ${targetName}에게 ${finalDmg}의 ${element} 피해를 입혔습니다! (남은 HP: ${target.stats.hp}/${target.stats.maxHp})`, 'combat');
      if (healAmt > 0) {
        logFn(`[Lifesteal] 🩸 생명력 흡수로 ${healAmt} HP를 회복했습니다!`, 'loot');
      }
    }

    // 몬스터 사망 시 통합 훅 발동
    if (!target.isPlayer && target.stats.hp <= 0) {
      this._handleMonsterDeath(target, context);
    }

    return { op: op.op, executed: true, damage: finalDmg, target, element, lifesteal: healAmt };
  }

  // ==========================================
  // [2. PROJECT_AREA]
  // ==========================================
  static _executeProjectArea(op, context) {
    const caster = context.caster || { x: 0, y: 0 };
    const shape = op.shape || 'BALL';
    const range = op.range || 5;
    const radius = op.radius || 2;
    const targetX = context.targetX !== undefined ? context.targetX : (context.target ? context.target.x : caster.x);
    const targetY = context.targetY !== undefined ? context.targetY : (context.target ? context.target.y : caster.y);

    const affectedTiles = this._calculateAreaTiles(shape, caster.x, caster.y, targetX, targetY, range, radius, context.map);
    const monsters = this._resolveMonsters(context);
    const affectedEntities = [];

    // 영역 내 몬스터 탐색
    for (const m of monsters) {
      if (!m || (m.stats && m.stats.hp <= 0)) continue;
      const key = `${m.x},${m.y}`;
      if (affectedTiles.has(key)) {
        affectedEntities.push(m);
      }
    }

    // 시전자가 몬스터일 때 플레이어도 범위 내에 있으면 포함
    const player = context.game?.player || (context.caster?.isPlayer ? null : context.target?.isPlayer ? context.target : null);
    if (player && affectedTiles.has(`${player.x},${player.y}`)) {
      if (!caster.isPlayer) {
        affectedEntities.push(player);
      }
    }

    const hitResults = [];
    for (const entity of affectedEntities) {
      const dmgRes = this._executeDealDamage({
        op: EFFECT_OP_TYPES.DEAL_DAMAGE,
        element: op.element,
        dice: op.dice,
        flat: op.flat,
        mult: op.mult,
        ignoreACPct: op.ignoreACPct,
        slayTags: op.slayTags,
        lifestealPct: op.lifestealPct
      }, { ...context, target: entity });

      hitResults.push(dmgRes);

      // 온힛 추가 효과 (onHitOps) 실행
      if (op.onHitOps && Array.isArray(op.onHitOps)) {
        for (const nestedOp of op.onHitOps) {
          this.executeOp(nestedOp, { ...context, target: entity });
        }
      }
    }

    return { op: op.op, executed: true, shape, hitCount: affectedEntities.length, hitResults };
  }

  // ==========================================
  // [3. APPLY_STATUS]
  // ==========================================
  static _executeApplyStatus(op, context) {
    const target = this._resolveTarget(op.target || 'TARGET', context);
    if (!target) {
      return { op: op.op, executed: false, error: 'Target not found' };
    }

    if (typeof op.chance === 'number' && Math.random() >= op.chance) {
      return { op: op.op, executed: false, reason: 'CHANCE_FAILED' };
    }

    const duration = op.duration || null;
    const power = op.power || null;
    const caster = context.caster || null;
    const logFn = this._getLogFn(context);

    const res = StatusEffectEngine.applyStatus(target, op.statusId, duration, power, caster, logFn);
    return { op: op.op, executed: res.applied, ...res };
  }

  // ==========================================
  // [4. CURE_STATUS]
  // ==========================================
  static _executeCureStatus(op, context) {
    const target = this._resolveTarget(op.target || 'TARGET', context);
    if (!target) {
      return { op: op.op, executed: false, error: 'Target not found' };
    }

    const logFn = this._getLogFn(context);
    const cured = StatusEffectEngine.cureStatus(target, op.statusIds, logFn);
    return { op: op.op, executed: true, cured };
  }

  // ==========================================
  // [5. HEAL_ENTITY]
  // ==========================================
  static _executeHealEntity(op, context) {
    const target = this._resolveTarget(op.target || 'SELF', context);
    if (!target || !target.stats) {
      return { op: op.op, executed: false, error: 'Target not found or has no stats' };
    }

    let healAmt = op.flat || 0;
    if (op.dice) {
      healAmt += CombatCalculator.rollDice(op.dice);
    }
    if (op.pctMaxHp && typeof op.pctMaxHp === 'number') {
      healAmt += Math.floor(target.stats.maxHp * op.pctMaxHp);
    }

    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmt);

    // 마나 회복 (restoreMana)
    let restoredMana = 0;
    if (op.restoreMana) {
      restoredMana = op.restoreMana === true ? (target.stats.maxMp || 100) : op.restoreMana;
      if (target.stats.mp !== undefined) {
        target.stats.mp = Math.min(target.stats.maxMp || 100, target.stats.mp + restoredMana);
      }
    }

    const logFn = this._getLogFn(context);
    const targetName = target.displayName || target.name || (target.isPlayer ? '플레이어' : '대상');
    if (logFn) {
      logFn(`[Heal] 💖 ${targetName}이(가) 체력을 +${healAmt} 회복했습니다! (HP: ${target.stats.hp}/${target.stats.maxHp})`, 'loot');
      if (restoredMana > 0) {
        logFn(`[Restore] 🌀 마나가 +${restoredMana} 회복되었습니다!`, 'loot');
      }
    }

    return { op: op.op, executed: true, healedHp: healAmt, restoredMana };
  }

  // ==========================================
  // [6. MODIFY_STAT]
  // ==========================================
  static _executeModifyStat(op, context) {
    const target = this._resolveTarget(op.target || 'TARGET', context);
    if (!target) return { op: op.op, executed: false, error: 'Target not found' };

    const stats = op.stat === 'all' ? ['str', 'dex', 'con', 'int', 'wis', 'chr'] : [op.stat.toLowerCase()];
    const delta = op.delta || 0;

    for (const s of stats) {
      if (op.restore) {
        if (target.baseStats && target.baseStats[s] !== undefined && target.stats && target.stats[s] !== undefined) {
          target.stats[s] = Math.max(target.stats[s], target.baseStats[s]);
        }
      } else if (op.permanent) {
        if (target.legacyStats) {
          target.legacyStats[s] = (target.legacyStats[s] || 0) + delta;
        } else if (target.baseStats) {
          target.baseStats[s] = (target.baseStats[s] || 10) + delta;
        }
      } else {
        if (target.stats) {
          target.stats[s] = (target.stats[s] || 10) + delta;
        }
      }
    }

    if (typeof target.markDirty === 'function') {
      target.markDirty('MODIFY_STAT');
    }

    const logFn = this._getLogFn(context);
    if (logFn) {
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      logFn(`[Stat] ⚡ ${op.stat.toUpperCase()} 능력치가 ${sign} 변동되었습니다.`, 'system');
    }

    return { op: op.op, executed: true, stats, delta };
  }

  // ==========================================
  // [7. DISPLACE]
  // ==========================================
  static _executeDisplace(op, context) {
    const target = this._resolveTarget(op.target || 'SELF', context);
    if (!target) return { op: op.op, executed: false, error: 'Target not found' };

    const mode = op.mode || 'BLINK';
    const dist = op.dist || (mode === 'BLINK' ? 4 : 20);
    const map = context.map || context.game?.map || null;
    const logFn = this._getLogFn(context);

    if (mode === 'BLINK' || mode === 'TELEPORT') {
      const newPos = this._findWalkableTile(target.x, target.y, dist, map, context);
      if (newPos) {
        target.x = newPos.x;
        target.y = newPos.y;
        if (logFn) {
          const name = target.displayName || target.name || '대상';
          logFn(`[Teleport] 🌀 ${name}이(가) 공간 이동했습니다! (${newPos.x}, ${newPos.y})`, 'system');
        }
        return { op: op.op, executed: true, mode, newPos };
      }
    } else if (mode === 'CHARGE_TO' || mode === 'PULL_TO') {
      const other = context.target || context.caster;
      if (other && other !== target) {
        const dx = Math.sign(other.x - target.x);
        const dy = Math.sign(other.y - target.y);
        const tx = target.x + dx;
        const ty = target.y + dy;
        if (map && map.isWalkable && map.isWalkable(tx, ty)) {
          target.x = tx;
          target.y = ty;
        }
      }
    } else if (mode === 'PUSH_AWAY') {
      const caster = context.caster || { x: target.x, y: target.y };
      const dx = Math.sign(target.x - caster.x);
      const dy = Math.sign(target.y - caster.y);
      const tx = target.x + dx * (op.dist || 2);
      const ty = target.y + dy * (op.dist || 2);
      if (map && map.isWalkable && map.isWalkable(tx, ty)) {
        target.x = tx;
        target.y = ty;
      }
    }

    return { op: op.op, executed: true, mode };
  }

  // ==========================================
  // [8. SUMMON_ENTITIES]
  // ==========================================
  static _executeSummonEntities(op, context) {
    const caster = context.caster || context.game?.player || { x: 0, y: 0 };
    const count = op.count || 1;
    const map = context.map || context.game?.map || null;
    const monsterList = this._resolveMonsters(context);
    const spawned = [];
    const logFn = this._getLogFn(context);

    // 스폰할 종족 식별
    let species = 'GOBLIN';
    if (typeof op.summonFilter === 'string') {
      species = op.summonFilter;
    } else if (op.summonFilter && op.summonFilter.species) {
      species = op.summonFilter.species;
    }

    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
      { dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 }
    ];

    let dirIdx = 0;
    for (let i = 0; i < count; i++) {
      let spawnX = caster.x + 1;
      let spawnY = caster.y;

      while (dirIdx < directions.length) {
        const d = directions[dirIdx++];
        const tx = caster.x + d.dx;
        const ty = caster.y + d.dy;
        const isOccupied = monsterList.some(m => m.x === tx && m.y === ty) ||
          (context.game?.player && context.game.player.x === tx && context.game.player.y === ty);

        if (!isOccupied && (!map || (map.isWalkable && map.isWalkable(tx, ty)) || (!map.isWall || !map.isWall(tx, ty)))) {
          spawnX = tx;
          spawnY = ty;
          break;
        }
      }

      const level = Math.max(1, (caster.level || 1) + Math.floor(Math.random() * 3) - 1);
      const monster = new Monster(spawnX, spawnY, species, level, [], []);
      if (op.ttl) {
        monster.ttl = op.ttl;
      }

      // context.monsters 또는 game.monsters에 직접 투입 (결코 더미 배열로 증발하지 않음)
      monsterList.push(monster);
      spawned.push(monster);

      if (logFn) {
        logFn(`[Summon] 👹 ${monster.displayName || monster.name}(Lv.${level})이(가) 소환되었습니다!`, 'combat');
      }
    }

    return { op: op.op, executed: true, count: spawned.length, spawned };
  }

  // ==========================================
  // [9. ALTER_MAP]
  // ==========================================
  static _executeAlterMap(op, context) {
    const action = op.action || 'REVEAL_ALL';
    const radius = op.radius || 5;
    const map = context.map || context.game?.map || null;
    const caster = context.caster || { x: 0, y: 0 };
    const logFn = this._getLogFn(context);

    if (action === 'REVEAL_ALL' && map) {
      if (typeof map.revealAll === 'function') {
        map.revealAll();
      } else if (map.tiles) {
        for (let y = 0; y < map.tiles.length; y++) {
          for (let x = 0; x < map.tiles[y].length; x++) {
            if (map.tiles[y][x]) {
              map.tiles[y][x].revealed = true;
              map.tiles[y][x].explored = true;
            }
          }
        }
      }
      if (logFn) logFn('[Map] 🗺️ 던전 전체 지도가 머릿속에 선명하게 떠오릅니다!', 'system');
    } else if (action === 'LIGHT_AREA' && map && map.tiles) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = caster.x + dx;
          const ty = caster.y + dy;
          if (map.tiles[ty] && map.tiles[ty][tx]) {
            map.tiles[ty][tx].lit = true;
            map.tiles[ty][tx].revealed = true;
          }
        }
      }
      if (logFn) logFn('[Map] ☀️ 주변 지역이 환한 빛으로 가득 찹니다!', 'system');
    } else if (action === 'EARTHQUAKE' || action === 'DESTROY_AREA' || action === 'STONE_TO_MUD' || action === 'KILL_WALL') {
      // 1. 암반 굴착 및 벽 파괴 (맵 최외곽 테두리 제외)
      if (map && map.tiles) {
        const height = map.height || map.tiles.length;
        const width = map.width || (map.tiles[0] ? map.tiles[0].length : 0);
        let carvedCount = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = caster.x + dx;
            const ty = caster.y + dy;
            // 맵 최외곽 테두리 보호
            if (tx <= 0 || ty <= 0 || tx >= width - 1 || ty >= height - 1) continue;
            
            const dist = Math.hypot(dx, dy);
            if (dist <= radius) {
              const tile = map.getTile ? map.getTile(tx, ty) : map.tiles[ty]?.[tx];
              if (tile && !tile.isWalkable) {
                const ok = map.carveWall ? map.carveWall(tx, ty) : false;
                if (!ok) {
                  if (!tile.isStaircase && !tile.isUpStaircase && tile.type !== 'STAIRS_UP' && tile.type !== 'STAIRS_DOWN') {
                    tile.type = 'FLOOR';
                    tile.char = '.';
                    tile.isWalkable = true;
                    tile.blocksVision = false;
                    map.mutationVersion = (map.mutationVersion || 0) + 1;
                    if (map.bridge && typeof map.bridge.updateTile === 'function') {
                      map.bridge.updateTile(tx, ty);
                    }
                    carvedCount++;
                  }
                } else {
                  carvedCount++;
                }
              }
            }
          }
        }
        if (context.game && typeof context.game.updateFOV === 'function') {
          context.game.updateFOV();
        }
        if (carvedCount > 0 && logFn) {
          logFn(`[Excavation] ⛏️ 강력한 충격으로 암반 ${carvedCount}칸이 붕괴되어 평지가 되었습니다!`, 'system');
        }
      }

      // 2. 주변 몬스터 물리 충격 대미지
      const monsters = this._resolveMonsters(context);
      for (const m of monsters) {
        if (!m || (m.stats && m.stats.hp <= 0)) continue;
        const dist = Math.hypot(m.x - caster.x, m.y - caster.y);
        if (dist <= radius) {
          const quakDmg = CombatCalculator.rollDice('5d6');
          m.stats.hp = Math.max(0, m.stats.hp - quakDmg);
          if (m.stats.hp <= 0) {
            this._handleMonsterDeath(m, context);
          }
        }
      }
      if (logFn) logFn('[Map] 💥 대지가 뒤흔들리며 지형이 붕괴합니다!', 'combat');
    }

    return { op: op.op, executed: true, action };
  }

  // ==========================================
  // [10. MUTATE_INVENTORY]
  // ==========================================
  static _executeMutateInventory(op, context) {
    const action = op.action || 'IDENTIFY';
    const player = context.game?.player || context.caster || context.target;
    const inv = player?.inventory || [];
    const logFn = this._getLogFn(context);

    if (action === 'IDENTIFY' || action === 'IDENTIFY_FULL') {
      const item = op.item || inv.find(i => !i.identified);
      if (item) {
        item.identified = true;
        if (action === 'IDENTIFY_FULL') item.fullyIdentified = true;
        if (logFn) logFn(`[Item] 🔍 [${item.name}]의 모든 숨겨진 정보가 식별되었습니다!`, 'loot');
      }
    } else if (action === 'REMOVE_CURSE' || action === 'REMOVE_CURSE_HEAVY') {
      let count = 0;
      for (const it of inv) {
        if (it.cursed || it.isCursed) {
          it.cursed = false;
          it.isCursed = false;
          count++;
        }
      }
      if (logFn) logFn(`[Holy] ✨ 성스러운 기운이 깃들어 ${count}개의 저주가 정화되었습니다!`, 'loot');
    } else if (action === 'ENCHANT_WEAPON') {
      const weapon = player?.equipment?.weapon;
      if (weapon) {
        weapon.upgradeLevel = (weapon.upgradeLevel || 0) + 1;
        if (logFn) logFn(`[Enchant] ⚔️ [${weapon.name}]에 마법이 부여되어 강화 수치가 +1 증가했습니다!`, 'loot');
      }
    } else if (action === 'ENCHANT_ARMOR') {
      const armor = player?.equipment?.armor;
      if (armor) {
        armor.upgradeLevel = (armor.upgradeLevel || 0) + 1;
        if (logFn) logFn(`[Enchant] 🛡️ [${armor.name}]에 마법이 부여되어 방어 수치가 +1 증가했습니다!`, 'loot');
      }
    }

    return { op: op.op, executed: true, action };
  }

  // ==========================================
  // [11. DRAIN_VITAL]
  // ==========================================
  static _executeDrainVital(op, context) {
    const target = this._resolveTarget(op.target || 'TARGET', context);
    if (!target) return { op: op.op, executed: false, error: 'Target not found' };

    const type = op.type || 'MANA';
    const amount = op.amount || 10;
    const logFn = this._getLogFn(context);

    if (type === 'XP') {
      if (target.gainXp) {
        target.xp = Math.max(0, (target.xp || 0) - amount);
      }
    } else if (type === 'MANA') {
      if (target.stats && target.stats.mp !== undefined) {
        target.stats.mp = Math.max(0, target.stats.mp - amount);
      }
    }

    if (logFn) {
      logFn(`[Drain] 🌀 ${type} 수치가 ${amount} 흡수/고갈되었습니다!`, 'combat');
    }

    return { op: op.op, executed: true, type, amount };
  }

  // ==========================================
  // [12. GRANT_RESOURCE]
  // ==========================================
  static _executeGrantResource(op, context) {
    const target = this._resolveTarget(op.target || 'SELF', context);
    if (!target) return { op: op.op, executed: false, error: 'Target not found' };

    const logFn = this._getLogFn(context);

    if (op.xp && typeof op.xp === 'number') {
      if (typeof target.gainXp === 'function') {
        target.gainXp(op.xp);
      } else {
        target.xp = (target.xp || 0) + op.xp;
      }
    }

    if (op.loreXp && target.body && typeof target.body.gainLoreXp === 'function') {
      const species = op.loreSpecies || target.mimicCore?.coreType || 'GOBLIN';
      target.body.gainLoreXp(species, op.loreXp);
    }

    if (op.gold && typeof op.gold === 'number') {
      target.gold = (target.gold || 0) + op.gold;
    }

    if (op.energy && typeof op.energy === 'number') {
      target.energy = (target.energy || 0) + op.energy;
    }

    if (logFn) {
      logFn('[Resource] ✨ 모험 자원이 성공적으로 가산되었습니다.', 'loot');
    }

    return { op: op.op, executed: true, ...op };
  }

  // ==========================================
  // [Mandatory Unified Death Hook]
  // ==========================================
  /**
   * 몬스터 HP <= 0 도달 시 보스 페이즈 전이 및 LootSystem 사망 루틴을 일괄 처리합니다.
   * @param {Object} monster
   * @param {Object} context
   */
  static _handleMonsterDeath(monster, context) {
    if (!monster || monster._deathProcessed) return;
    if (!monster.stats || monster.stats.hp > 0) return;

    const game = context.game || context;

    // 1. 50F 모르고스 보스 페이즈 전이 검사
    const bEngine = game?.bossPhaseEngine || bossPhaseEngine;
    if (bEngine && typeof bEngine.checkPhaseTransition === 'function') {
      bEngine.checkPhaseTransition(monster, game);
      if (monster.stats && monster.stats.hp > 0) {
        return; // 페이즈 전이 성공으로 생존
      }
    }

    // 사망 처리 중복 방지 플래그 마킹
    monster._deathProcessed = true;

    // 2. 단일 진실 공급원 전리품 및 승천 격발
    if (typeof game?.handleMonsterDeath === 'function') {
      game.handleMonsterDeath(monster);
    } else if (typeof LootSystem?.processMonsterDeath === 'function') {
      try {
        LootSystem.processMonsterDeath(monster, game);
      } catch (err) {
        if (game && game.player) {
          LootSystem.processMonsterDeath(game, game.player, monster, '주문/효과');
        }
      }
    }

    // 3. 월드 몬스터 리스트에서 제거
    const monsterList = game?.monsters || context.monsters;
    if (Array.isArray(monsterList)) {
      const idx = monsterList.indexOf(monster);
      if (idx !== -1) {
        monsterList.splice(idx, 1);
      }
    }
  }

  // ==========================================
  // [내부 헬퍼 메서드]
  // ==========================================
  static _resolveTarget(targetKeyword, context) {
    if (targetKeyword === 'SELF') {
      return context.caster || context.game?.player || null;
    }
    return context.target || context.caster || context.game?.player || null;
  }

  static _resolveMonsters(context) {
    if (Array.isArray(context.monsters)) return context.monsters;
    if (context.game?.monsters && Array.isArray(context.game.monsters)) return context.game.monsters;
    return [];
  }

  static _getLogFn(context) {
    if (typeof context.addLogEntry === 'function') return context.addLogEntry;
    if (context.game && typeof context.game.addLogEntry === 'function') {
      return context.game.addLogEntry.bind(context.game);
    }
    return null;
  }

  static _calculateAreaTiles(shape, cx, cy, tx, ty, range, radius, map) {
    const tiles = new Set();

    if (shape === 'BALL' || shape === 'WAVE') {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.hypot(dx, dy) <= radius + 0.5) {
            tiles.add(`${tx + dx},${ty + dy}`);
          }
        }
      }
    } else if (shape === 'SURROUND') {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.hypot(dx, dy) <= radius + 0.5) {
            tiles.add(`${cx + dx},${cy + dy}`);
          }
        }
      }
    } else if (shape === 'BOLT' || shape === 'BEAM') {
      const dist = Math.hypot(tx - cx, ty - cy) || 1;
      const steps = Math.min(range, Math.ceil(dist));
      for (let s = 1; s <= steps; s++) {
        const px = Math.round(cx + (tx - cx) * (s / dist));
        const py = Math.round(cy + (ty - cy) * (s / dist));
        tiles.add(`${px},${py}`);
      }
    } else if (shape === 'CONE') {
      const angle = Math.atan2(ty - cy, tx - cx);
      for (let r = 1; r <= range; r++) {
        for (let a = -0.5; a <= 0.5; a += 0.25) {
          const px = Math.round(cx + Math.cos(angle + a) * r);
          const py = Math.round(cy + Math.sin(angle + a) * r);
          tiles.add(`${px},${py}`);
        }
      }
    }

    return tiles;
  }

  static _findWalkableTile(x, y, dist, map, context) {
    const monsters = this._resolveMonsters(context);
    for (let attempts = 0; attempts < 20; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.floor(Math.random() * dist) + 1;
      const nx = Math.round(x + Math.cos(angle) * r);
      const ny = Math.round(y + Math.sin(angle) * r);

      const isOccupied = monsters.some(m => m.x === nx && m.y === ny);
      if (!isOccupied && (!map || (map.isWalkable && map.isWalkable(nx, ny)))) {
        return { x: nx, y: ny };
      }
    }
    return { x: x + 1, y };
  }
}
