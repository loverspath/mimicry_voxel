/**
 * @module TomeDeviceEngine
 * @category systems
 * @description ToME 2.3.5 정통 마법 디바이스(완드 30종, 스태프 20종, 로드 28종) 발동 및 충전량/쿨다운 무상태 제어 엔진
 * @purity Stateless Engine (State Mutation with Log Feedback)
 * @exports TomeDeviceEngine
 */

import { TVAL } from './TomeEquipmentEngine.js';
import { TOME_KINDS_DATA } from '../entities/TomeKindsData.js';

// 고속 베이스명 정확 일치 색인 맵
const KINDS_BY_NAME = {};
for (const k of Object.values(TOME_KINDS_DATA || {})) {
  KINDS_BY_NAME[k.name] = k;
  const cleanName = k.name.replace(/^[&\s]+/, '').replace(/[~#]/g, '').trim();
  if (!KINDS_BY_NAME[cleanName]) KINDS_BY_NAME[cleanName] = k;
}

export class TomeDeviceEngine {
  /**
   * 마법 디바이스(완드, 스태프, 로드)를 발동합니다.
   * @param {Object} item - 사용할 디바이스 아이템
   * @param {Object} player - 플레이어 인스턴스
   * @param {Object} game - Game 인스턴스
   * @param {Function} addLogEntry - 로그 출력 콜백
   * @returns {boolean} 사용 성공 여부
   */
  static useDevice(item, player, game = null, addLogEntry = null) {
    if (!item || !player) return false;

    const log = (msg, type = 'loot') => {
      if (typeof addLogEntry === 'function') {
        addLogEntry(msg, type);
      } else if (game && typeof game.addLogEntry === 'function') {
        game.addLogEntry(msg, type);
      }
    };

    let tval = item.tval;
    let sval = item.sval;

    if (tval === undefined || sval === undefined) {
      const baseKind = KINDS_BY_NAME[item._baseName || item.name];
      if (baseKind) {
        tval = tval !== undefined ? tval : baseKind.tval;
        sval = sval !== undefined ? sval : baseKind.sval;
      }
    }

    if (tval === undefined) {
      if (item.type === 'WAND') tval = TVAL.WAND;
      else if (item.type === 'STAFF') tval = TVAL.STAFF;
      else if (item.type === 'ROD') tval = TVAL.ROD;
    }

    if (tval === TVAL.WAND || item.type === 'WAND') {
      return this.useWand(item, player, game, log, sval);
    } else if (tval === TVAL.STAFF || item.type === 'STAFF') {
      return this.useStaff(item, player, game, log, sval);
    } else if (tval === TVAL.ROD || tval === TVAL.ROD_MAIN || item.type === 'ROD') {
      return this.useRod(item, player, game, log, sval);
    }

    return false;
  }

  /**
   * 완드(TV_WAND: 65) 조준 및 발사 처리 (볼트/볼/빔, charges 소모, 실패율 판정)
   */
  static useWand(item, player, game, log, sval = null) {
    if (sval === null || sval === undefined) sval = item.sval;

    // 1. 충전량 확인
    if (item.charges === undefined) {
      item.charges = 5;
    }
    if (item.charges <= 0) {
      log(`[Wand] ⚠️ [${item.name}]의 마력이 모두 소진되어 발동할 수 없습니다! (충전: 0)`, 'system');
      return false;
    }

    // 2. 디바이스 발동 실패율 판정 (INT 기반)
    const intVal = player.getEffectiveStat ? player.getEffectiveStat('int') : (player.stats?.int || 10);
    const failRate = Math.max(5, Math.min(45, 25 - Math.floor((intVal - 10) * 1.5)));
    const roll = Math.random() * 100;
    if (roll < failRate) {
      log(`[Wand] 💨 마력을 제어하지 못해 [${item.name}]의 주문 발동에 실패했습니다! (실패율: ${failRate.toFixed(0)}%)`, 'combat');
      return false;
    }

    // 3. 충전량 1 소모
    item.charges -= 1;

    // 4. 대상 몬스터 탐색
    const target = this._findNearestTarget(player, game);

    switch (sval) {
      case 3: // Manathrust
        this._dealDamage(target, 30, 'MANA', game, log, item.name);
        log(`[Wand] ⚡ [${item.name}]에서 순수한 마나 광선(Manathrust)이 뿜어져 나왔습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 4: // Fireflash
        this._dealDamage(target, 40, 'FIRE', game, log, item.name);
        log(`[Wand] 🔥 [${item.name}]에서 작열하는 화염구(Fireflash)가 발사되었습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 5: // Firewall
        log(`[Wand] 🌋 [${item.name}]에서 타오르는 화염벽이 솟구쳤습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 6: // Tidal Wave
        this._dealDamage(target, 35, 'COLD', game, log, item.name);
        log(`[Wand] 🌊 [${item.name}]에서 거센 해일(Tidal Wave)이 소용돌이쳤습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 7: // Ice Storm
        this._dealDamage(target, 45, 'COLD', game, log, item.name);
        log(`[Wand] ❄️ [${item.name}]에서 혹한의 눈보라(Ice Storm)가 몰아쳤습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 8: // Noxious Cloud
      case 9: // Poison Blood
        this._dealDamage(target, 30, 'POISON', game, log, item.name);
        log(`[Wand] ☠️ [${item.name}]에서 치명적인 맹독 구름이 피어올랐습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 10: // Thunderstorm
        this._dealDamage(target, 50, 'LIGHTNING', game, log, item.name);
        log(`[Wand] ⚡ [${item.name}]에서 파괴적인 뇌우(Thunderstorm)가 내리꽂혔습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 14: // Teleport Away
        if (target && game && game.map) {
          this._teleportEntity(target, game.map);
          log(`[Wand] 🌀 [${item.name}]의 차원 추방 마법으로 대상이 던전 어딘가로 날아갔습니다! (남은 충전: ${item.charges})`, 'combat');
        } else {
          log(`[Wand] 🌀 [${item.name}]의 차원 도약 광선이 방출되었습니다! (남은 충전: ${item.charges})`, 'combat');
        }
        break;
      case 18: // Essence of Speed
        player.speedBuffTurns = (player.speedBuffTurns || 0) + 15;
        log(`[Wand] ⚡ [${item.name}]의 신속의 정수가 몸에 스며들어 15턴 동안 속도가 빨라집니다! (남은 충전: ${item.charges})`, 'loot');
        break;
      case 22: // Confuse
        if (target) target.confusedTurns = (target.confusedTurns || 0) + 10;
        log(`[Wand] 💫 [${item.name}]의 혼란 광선이 대상을 어지럽힙니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      default:
        this._dealDamage(target, 25, 'MAGIC', game, log, item.name);
        log(`[Wand] ✨ [${item.name}]에서 신비로운 마력 탄환이 발사되었습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
    }

    return true;
  }

  /**
   * 스태프(TV_STAFF: 55) 광역 방출 처리 (본인/광역, charges 소모, 실패율 판정)
   */
  static useStaff(item, player, game, log, sval = null) {
    if (sval === null || sval === undefined) sval = item.sval;

    // 1. 충전량 확인
    if (item.charges === undefined) {
      item.charges = 5;
    }
    if (item.charges <= 0) {
      log(`[Staff] ⚠️ [${item.name}]의 마력이 모두 소진되어 사용할 수 없습니다! (충전: 0)`, 'system');
      return false;
    }

    // 2. 디바이스 발동 실패율 판정
    const intVal = player.getEffectiveStat ? player.getEffectiveStat('int') : (player.stats?.int || 10);
    const failRate = Math.max(5, Math.min(40, 20 - Math.floor((intVal - 10) * 1.5)));
    const roll = Math.random() * 100;
    if (roll < failRate) {
      log(`[Staff] 💨 정신을 집중하지 못해 [${item.name}]의 마력 해방에 실패했습니다! (실패율: ${failRate.toFixed(0)}%)`, 'combat');
      return false;
    }

    // 3. 충전량 1 소모
    item.charges -= 1;

    switch (sval) {
      case 3: // Globe of Light
        log(`[Staff] 💡 [${item.name}]에서 눈부신 빛의 구체가 방출되어 주변을 밝히고 어둠을 몰아냅니다! (남은 충전: ${item.charges})`, 'loot');
        this._dealAoEDamage(player, game, 25, 'LIGHT', 5, log);
        break;
      case 4: // Fiery Shield
        player.protectPrayerTurns = (player.protectPrayerTurns || 0) + 20;
        log(`[Staff] 🔥 [${item.name}]에서 화염의 수호 방벽이 둘러졌습니다! (남은 충전: ${item.charges})`, 'loot');
        break;
      case 5: // Remove Curses
        if (player.debuffs) {
          player.debuffs.poison = 0;
          player.debuffs.frost = 0;
        }
        log(`[Staff] 🕊️ [${item.name}]의 정화 파동으로 모든 부정적 저주가 해제되었습니다! (남은 충전: ${item.charges})`, 'loot');
        break;
      case 7: // Shake (Earthquake)
        this._dealAoEDamage(player, game, 35, 'PHYSICAL', 6, log);
        log(`[Staff] 🌋 [${item.name}]을 내리치자 강력한 지진파가 던전을 뒤흔들었습니다! (남은 충전: ${item.charges})`, 'combat');
        break;
      case 9: // Teleportation
        if (game && game.map) {
          this._teleportEntity(player, game.map);
          log(`[Staff] ✨ [${item.name}]의 순간이동 파동으로 안전한 위치로 도약했습니다! (남은 충전: ${item.charges})`, 'loot');
        }
        break;
      case 11: // Recovery
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 150);
        if (player.debuffs) {
          player.debuffs.poison = 0;
          player.debuffs.frost = 0;
        }
        log(`[Staff] 💖 [${item.name}]의 강력한 회복 마력이 온몸을 감쌉니다! (HP: ${player.stats.hp}/${player.stats.maxHp}, 남은 충전: ${item.charges})`, 'loot');
        break;
      case 13: // Vision
        if (game && game.map) {
          if (typeof game.map.revealAll === 'function') game.map.revealAll();
          else if (game.map.tiles) {
            for (let y = 0; y < game.map.height; y++) {
              for (let x = 0; x < game.map.width; x++) {
                if (game.map.tiles[y] && game.map.tiles[y][x]) {
                  game.map.tiles[y][x].explored = true;
                  game.map.tiles[y][x].revealed = true;
                }
              }
            }
          }
        }
        log(`[Staff] 🗺️ [${item.name}]의 천리안(Vision) 파동으로 이번 층의 지형이 완벽히 드러났습니다! (남은 충전: ${item.charges})`, 'loot');
        break;
      default:
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 40);
        log(`[Staff] 🌟 [${item.name}]의 신비한 마력이 사방으로 방출되었습니다! (남은 충전: ${item.charges})`, 'loot');
        break;
    }

    return true;
  }

  /**
   * 로드(TV_ROD: 66) 발동 처리 (무충전 소모, 고유 쿨다운 timeout 설정)
   */
  static useRod(item, player, game, log, sval = null) {
    if (sval === null || sval === undefined) sval = item.sval;

    // 1. 쿨다운(timeout) 확인
    item.timeout = item.timeout || 0;
    if (item.timeout > 0) {
      log(`[Rod] ⏳ [${item.name}]이(가) 아직 마력을 재충전 중입니다! (남은 쿨다운: ${item.timeout}턴)`, 'system');
      return false;
    }

    const target = this._findNearestTarget(player, game);
    let cooldown = 15;

    switch (sval) {
      case 1: // Door/Stair Location
      case 6: // Detection
        cooldown = 15;
        log(`[Rod] 🔍 [${item.name}]의 감지 파동이 주변의 비밀과 지형을 감지했습니다!`, 'loot');
        break;
      case 4: // Illumination
      case 15: // Light
        cooldown = 10;
        log(`[Rod] 💡 [${item.name}]에서 영롱한 빛이 뿜어져 나와 주변을 비춥니다!`, 'loot');
        break;
      case 8: // Curing
        cooldown = 15;
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 40);
        if (player.debuffs) player.debuffs.poison = 0;
        log(`[Rod] 🌿 [${item.name}]의 치유 파동이 상처를 아물게 합니다! (HP: ${player.stats.hp}/${player.stats.maxHp})`, 'loot');
        break;
      case 10: // Restoration
        cooldown = 40;
        if (typeof player.markDirty === 'function') player.markDirty('로드 복원');
        log(`[Rod] 💧 [${item.name}]의 복원 에너지가 모든 능력치를 본래대로 되돌렸습니다!`, 'loot');
        break;
      case 11: // Speed
        cooldown = 30;
        player.speedBuffTurns = (player.speedBuffTurns || 0) + 15;
        log(`[Rod] ⚡ [${item.name}]의 가속 광선으로 15턴 동안 이동 및 공격이 가속됩니다!`, 'loot');
        break;
      case 20: // Acid Bolts
        cooldown = 12;
        this._dealDamage(target, 30, 'ACID', game, log, item.name);
        log(`[Rod] 🧪 [${item.name}]에서 강력한 부식성 산성 볼트가 발사되었습니다!`, 'combat');
        break;
      case 21: // Lightning Bolts
        cooldown = 12;
        this._dealDamage(target, 35, 'LIGHTNING', game, log, item.name);
        log(`[Rod] ⚡ [${item.name}]에서 날카로운 전격 볼트가 벼락처럼 꽂혔습니다!`, 'combat');
        break;
      case 22: // Fire Bolts
        cooldown = 12;
        this._dealDamage(target, 35, 'FIRE', game, log, item.name);
        log(`[Rod] 🔥 [${item.name}]에서 뜨거운 화염 볼트가 발사되었습니다!`, 'combat');
        break;
      case 23: // Frost Bolts
        cooldown = 12;
        this._dealDamage(target, 35, 'COLD', game, log, item.name);
        log(`[Rod] ❄️ [${item.name}]에서 차가운 냉기 볼트가 발사되었습니다!`, 'combat');
        break;
      case 24: // Acid Balls
      case 25: // Lightning Balls
      case 26: // Fire Balls
      case 27: // Cold Balls
        cooldown = 20;
        this._dealAoEDamage(player, game, 45, 'ELEMENTAL', 5, log);
        log(`[Rod] 💥 [${item.name}]에서 원소 폭풍 구체가 폭발하여 주변 적들을 강타했습니다!`, 'combat');
        break;
      case 28: // Havoc
        cooldown = 40;
        this._dealAoEDamage(player, game, 60, 'HAVOC', 7, log);
        log(`[Rod] 🌋 [${item.name}]에서 대혼돈의 파멸파가 터져 나와 전역을 뒤흔들었습니다!`, 'combat');
        break;
      default:
        cooldown = 15;
        this._dealDamage(target, 25, 'MAGIC', game, log, item.name);
        log(`[Rod] ✨ [${item.name}]에서 신비한 로드의 에너지가 방출되었습니다!`, 'combat');
        break;
    }

    item.timeout = cooldown;
    log(`[Rod] ⏳ [${item.name}]의 재충전 쿨다운이 설정되었습니다. (${cooldown}턴)`, 'system');
    return true;
  }

  /**
   * 매 턴 플레이어 인벤토리의 모든 로드 timeout 쿨다운을 1씩 감소시킵니다.
   * @param {Array<Object>} inventory 
   */
  static tickTimeouts(inventory) {
    if (!Array.isArray(inventory)) return;
    for (const item of inventory) {
      if (item && item.timeout && item.timeout > 0) {
        item.timeout -= 1;
      }
    }
  }

  // =========================================================================
  // 🎯 내부 헬퍼 함수: 타겟팅, 피해 적용, 텔레포트
  // =========================================================================

  static _findNearestTarget(player, game) {
    if (!game || !Array.isArray(game.monsters) || game.monsters.length === 0) return null;
    let closest = null;
    let minDist = 999;
    for (const m of game.monsters) {
      if (!m || m.stats?.hp <= 0) continue;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d < minDist && d <= 10) {
        minDist = d;
        closest = m;
      }
    }
    return closest;
  }

  static _dealDamage(target, amount, element, game, log, deviceName) {
    if (!target) return;
    target.stats.hp -= amount;
    log(`[Combat] 🎯 [${deviceName}]의 공격이 ${target.displayName || target.name}에게 ${amount} (${element}) 피해를 입혔습니다!`, 'combat');
    if (target.stats.hp <= 0 && game && Array.isArray(game.monsters)) {
      const idx = game.monsters.indexOf(target);
      if (idx !== -1) game.monsters.splice(idx, 1);
      log(`[Combat] 💀 ${target.displayName || target.name}가 처치되었습니다!`, 'system');
    }
  }

  static _dealAoEDamage(player, game, amount, element, radius, log) {
    if (!game || !Array.isArray(game.monsters)) return;
    for (let i = game.monsters.length - 1; i >= 0; i--) {
      const m = game.monsters[i];
      if (!m || m.stats?.hp <= 0) continue;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d <= radius) {
        m.stats.hp -= amount;
        if (m.stats.hp <= 0) {
          game.monsters.splice(i, 1);
          log(`[Combat] 💀 광역 마법에 휩쓸린 ${m.displayName || m.name}가 소멸했습니다!`, 'system');
        }
      }
    }
  }

  static _teleportEntity(entity, map) {
    if (!entity || !map) return;
    for (let i = 0; i < 50; i++) {
      const tx = Math.floor(Math.random() * (map.width - 2)) + 1;
      const ty = Math.floor(Math.random() * (map.height - 2)) + 1;
      if (map.isWalkable(tx, ty)) {
        entity.x = tx;
        entity.y = ty;
        return;
      }
    }
  }
}
