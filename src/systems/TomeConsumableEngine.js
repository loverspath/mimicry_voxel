/**
 * @module TomeConsumableEngine
 * @category systems
 * @description ToME 2.3.5 정통 (tval, sval) 기반 포션 45+종, 주문서 42+종, 기름 플라스크, 음식 및 코어 소비 무상태 엔진
 * @purity Stateless Engine (State Mutation with Log Feedback)
 * @dependencies TomeEquipmentEngine.js, TomeKindsData.js, TomeIdentificationEngine.js, TomeTagSystem.js
 * @exports TomeConsumableEngine
 */

import { TVAL } from './TomeEquipmentEngine.js';
import { TOME_KINDS_DATA } from '../entities/TomeKindsData.js';
import { TomeIdentificationEngine } from './TomeIdentificationEngine.js';
import { TomeTagSystem } from './TomeTagSystem.js';

// 고속 베이스명 정확 일치 색인 맵
const KINDS_BY_NAME = {};
for (const k of Object.values(TOME_KINDS_DATA || {})) {
  KINDS_BY_NAME[k.name] = k;
  const cleanName = k.name.replace(/^[&\s]+/, '').replace(/[~#]/g, '').trim();
  if (!KINDS_BY_NAME[cleanName]) KINDS_BY_NAME[cleanName] = k;
}

// 한글 레거시 아이템명 정확 일치 튜플 매핑 사전 (문자열 부분 파싱 0%)
const KOREAN_KIND_ALIASES = Object.freeze({
  '상급 체력 물약': { tval: TVAL.POTION, sval: 35 },
  '하급 체력 물약': { tval: TVAL.POTION, sval: 34 },
  '최상급 체력 물약': { tval: TVAL.POTION, sval: 36 },
  '완전 치유 물약': { tval: TVAL.POTION, sval: 38 },
  '생명의 비약': { tval: TVAL.POTION, sval: 39 },
  '힘의 성장 영약': { tval: TVAL.POTION, sval: 48 },
  '능력치 성장 영약': { tval: TVAL.POTION, sval: 48 },
  '민첩의 성장 영약': { tval: TVAL.POTION, sval: 51 },
  '생명력의 성장 영약': { tval: TVAL.POTION, sval: 52 },
  '지능의 성장 영약': { tval: TVAL.POTION, sval: 49 },
  '전능의 성장 영약': { tval: TVAL.POTION, sval: 55 },
  '가속의 물약': { tval: TVAL.POTION, sval: 18 },
  '신속의 물약': { tval: TVAL.POTION, sval: 18 },
  '영웅의 물약': { tval: TVAL.POTION, sval: 32 },
  '광폭화의 물약': { tval: TVAL.POTION, sval: 33 },
  '무적의 물약': { tval: TVAL.POTION, sval: 62 },
  '해독 물약': { tval: TVAL.POTION, sval: 27 },

  '마법 지도 주문서': { tval: TVAL.SCROLL, sval: 25 },
  '무기 강화 주문서': { tval: TVAL.SCROLL, sval: 21 },
  '방어구 강화 주문서': { tval: TVAL.SCROLL, sval: 20 },
  '갑옷 강화 주문서': { tval: TVAL.SCROLL, sval: 20 },
  '차원 도약 주문서': { tval: TVAL.SCROLL, sval: 8 },
  '순간이동 주문서': { tval: TVAL.SCROLL, sval: 10 },
  '텔레포트 주문서': { tval: TVAL.SCROLL, sval: 10 },
  '축복 주문서': { tval: TVAL.SCROLL, sval: 33 },
  '감정 주문서': { tval: TVAL.SCROLL, sval: 13 },
  '진실의 감정 주문서': { tval: TVAL.SCROLL, sval: 14 },
  '저주 해제 주문서': { tval: TVAL.SCROLL, sval: 15 },
  '강력한 저주 해제 주문서': { tval: TVAL.SCROLL, sval: 16 },
  'Scroll of Identify': { tval: TVAL.SCROLL, sval: 13 },
  'Scroll of *Identify*': { tval: TVAL.SCROLL, sval: 14 },
  'Scroll of Remove Curse': { tval: TVAL.SCROLL, sval: 15 },
  'Scroll of *Remove Curse*': { tval: TVAL.SCROLL, sval: 16 },
  '대파괴 주문서': { tval: TVAL.SCROLL, sval: 41 }
});

export class TomeConsumableEngine {
  /**
   * 소비성 아이템을 사용합니다.
   * @param {Object} item - 사용할 Item 인스턴스
   * @param {Object} player - 플레이어 인스턴스
   * @param {Object} game - Game 핵심 인스턴스
   * @param {Function} addLogEntry - 로그 출력 함수
   * @returns {boolean} 사용 성공 여부
   */
  static useConsumable(item, player, game = null, addLogEntry = null, targetItem = null) {
    if (!item || !player) return false;

    const log = (msg, type = 'loot') => {
      if (typeof addLogEntry === 'function') {
        addLogEntry(msg, type);
      } else if (game && typeof game.addLogEntry === 'function') {
        game.addLogEntry(msg, type);
      }
    };

    // 0. 미믹 코어 아이템 포식
    if (item.type === 'CORE') {
      if (typeof player.useCoreAsFood === 'function') {
        return player.useCoreAsFood(item, game);
      }
      return false;
    }

    // tval / sval 정규화 도출
    let tval = item.tval;
    let sval = item.sval;

    if (tval === undefined || sval === undefined) {
      const alias = KOREAN_KIND_ALIASES[item._baseName || item.name];
      if (alias) {
        tval = tval !== undefined ? tval : alias.tval;
        sval = sval !== undefined ? sval : alias.sval;
      } else {
        const baseKind = KINDS_BY_NAME[item._baseName || item.name];
        if (baseKind) {
          tval = tval !== undefined ? tval : baseKind.tval;
          sval = sval !== undefined ? sval : baseKind.sval;
        }
      }
    }

    if (tval === undefined) {
      if (item.type === 'POTION') tval = TVAL.POTION;
      else if (item.type === 'SCROLL') tval = TVAL.SCROLL;
      else if (item.type === 'FOOD') tval = TVAL.FOOD;
      else if (item.type === 'FLASK') tval = TVAL.FLASK;
    }

    if (tval === TVAL.POTION || item.type === 'POTION') {
      return this.usePotion(item, player, game, log, sval);
    } else if (tval === TVAL.SCROLL || item.type === 'SCROLL') {
      return this.useScroll(item, player, game, log, sval, targetItem);
    } else if (tval === TVAL.FLASK || item.type === 'FLASK') {
      return this.useFlask(item, player, game, log, sval);
    } else if (tval === TVAL.FOOD || item.type === 'FOOD') {
      return this.useFood(item, player, game, log, sval);
    }

    return false;
  }

  /**
   * 포션(TV_POTION: 71) 마시기 처리
   */
  static usePotion(item, player, game, log, sval = null) {
    if (sval === null || sval === undefined) sval = item.sval;
    let used = false;

    // Helper: 영구 스탯 상승
    const boostStat = (statKey, statName) => {
      if (!player.baseStats) player.baseStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      if (!player.legacyStats) player.legacyStats = {};
      player.baseStats[statKey] = (player.baseStats[statKey] || 10) + 1;
      player.legacyStats[statKey] = (player.legacyStats[statKey] || 0) + 1;
      if (player.stats && player.stats[statKey] !== undefined) {
        player.stats[statKey] += 1;
      }
      if (statKey === 'con') {
        const oldMax = player.stats.maxHp;
        player.stats.maxHp = player.getMaxHp ? player.getMaxHp() : (player.stats.maxHp + 5);
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 5);
      }
      if (typeof player.markDirty === 'function') {
        player.markDirty(`스탯 영약: ${statKey}`);
      }
      log(`[Potion] 🌟 능력치 성장 영약의 신비한 기운이 몸에 깃듭니다! 기본 ${statName} 능력치가 영구히 +1 상승했습니다!`, 'loot');
    };

    // Helper: 체력 치유
    const healHp = (amount, cureDebuffs = false, fullLife = false) => {
      const oldHp = player.stats.hp;
      if (fullLife) {
        player.stats.maxHp = (player.stats.maxHp || (player.getMaxHp ? player.getMaxHp() : 20)) + 5;
        player.stats.hp = player.stats.maxHp;
      } else {
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + amount);
      }
      const actualHealed = player.stats.hp - oldHp;
      if (cureDebuffs && player.debuffs) {
        player.debuffs.poison = 0;
        player.debuffs.frost = 0;
        if (player.debuffs.magicVulnerability !== undefined) player.debuffs.magicVulnerability = 0;
        if (player.debuffs.paralyzed !== undefined) player.debuffs.paralyzed = false;
      }
      log(`[Potion] 🧪 [${item.name}]을(를) 마셨습니다! 체력이 +${actualHealed} 회복되었습니다. (HP: ${player.stats.hp}/${player.stats.maxHp})`, 'loot');
    };

    switch (sval) {
      // 1. 과즙 및 음료
      case 1: // Apple Juice
      case 2: // Slime Mold Juice
        healHp(5);
        used = true;
        break;

      // 2. 생명의 피 (Blood of Life)
      case 3:
        boostStat('con', '생명력(CON)');
        healHp(player.stats.maxHp, true, true);
        used = true;
        break;

      // 3. 디버프 물약 (음용 시 부정적 효과)
      case 4: // Slowness
        player.slowTurns = (player.slowTurns || 0) + 10;
        log(`[Potion] ⚠️ 몸이 천근만근 무거워지며 감속 상태가 되었습니다!`, 'combat');
        used = true;
        break;
      case 6: // Poison
        if (player.debuffs) player.debuffs.poison = (player.debuffs.poison || 0) + 15;
        log(`[Potion] ☠️ 맹독성 물약을 마셔 극심한 중독 상태에 빠졌습니다!`, 'combat');
        used = true;
        break;
      case 7: // Blindness
        player.blindTurns = (player.blindTurns || 0) + 12;
        log(`[Potion] 👁️ 시야가 완전히 차단되어 아무것도 보이지 않습니다!`, 'combat');
        used = true;
        break;
      case 9: // Booze
        player.confusedTurns = (player.confusedTurns || 0) + 10;
        healHp(10);
        log(`[Potion] 🍺 독한 술기운이 퍼지며 혼란에 빠졌지만 체력이 약간 회복되었습니다.`, 'loot');
        used = true;
        break;
      case 11: // Sleep
        if (player.debuffs) player.debuffs.paralyzed = true;
        log(`[Potion] 💤 극도의 졸음이 몰려와 깊은 잠에 빠져듭니다!`, 'combat');
        used = true;
        break;
      case 15: // Ruination
        player.stats.hp = Math.max(1, player.stats.hp - 50);
        log(`[Potion] 💥 파멸의 독약이 몸을 파괴하여 50의 피해를 입었습니다!`, 'combat');
        used = true;
        break;
      case 18: // Speed / Haste
        player.speedBuffTurns = (player.speedBuffTurns || 0) + 15;
        log(`[Potion] ⚡ 가속의 물약을 마셨습니다! 15턴 동안 이동 및 공격 속도가 2배 빨라집니다!`, 'loot');
        used = true;
        break;
      case 22: // Detonations
        player.stats.hp = Math.max(1, player.stats.hp - 30);
        log(`[Potion] 💣 물약이 뱃속에서 폭발하여 30의 피해를 입었습니다!`, 'combat');
        used = true;
        break;
      case 23: // Death
        player.stats.hp = Math.max(1, player.stats.hp - 80);
        log(`[Potion] 💀 죽음의 비약이 온몸을 태워 80의 치명적인 피해를 입었습니다!`, 'combat');
        used = true;
        break;

      // 4. 경험치 / 배움
      case 12: // Potion of Learning
        if (typeof player.gainXp === 'function') {
          const res = player.gainXp(1000);
          log(`[Potion] 📖 배움의 영약을 마셔 1000 경험치를 습득했습니다!`, 'loot');
          if (res && res.logs) res.logs.forEach(l => log(l, 'loot'));
        }
        used = true;
        break;
      case 59: // Experience
        if (typeof player.gainXp === 'function') {
          const res = player.gainXp(2500);
          log(`[Potion] 🌟 지고의 경험 영약을 마셔 2500 경험치를 습득했습니다!`, 'loot');
          if (res && res.logs) res.logs.forEach(l => log(l, 'loot'));
        }
        used = true;
        break;

      // 5. 투시 / 감지 / 시야
      case 24: // Infra-vision
        player.infravisionTurns = (player.infravisionTurns || 0) + 50;
        log(`[Potion] 👁️ 적외선 시야가 활성화되어 어둠 속의 온혈 생물을 감지합니다!`, 'loot');
        used = true;
        break;
      case 25: // Detect Invisible
        player.seeInvisTurns = (player.seeInvisTurns || 0) + 50;
        log(`[Potion] 🔮 투명체 감지 능력이 생겨 은신한 몬스터를 꿰뚫어 봅니다!`, 'loot');
        used = true;
        break;
      case 57: // *Enlightenment*
        if (game && game.map) {
          if (typeof game.map.revealAll === 'function') game.map.revealAll();
          if (game.map.tiles) {
            for (let y = 0; y < game.map.tiles.length; y++) {
              for (let x = 0; x < game.map.tiles[y].length; x++) {
                if (game.map.tiles[y] && game.map.tiles[y][x]) {
                  game.map.tiles[y][x].isExplored = true;
                  game.map.tiles[y][x].explored = true;
                  game.map.tiles[y][x].revealed = true;
                }
              }
            }
          }
        }
        player.seeInvisTurns = (player.seeInvisTurns || 0) + 100;
        log(`[Potion] 🌟 전지전능의 영약(*Enlightenment*)으로 이번 층의 전체 지형과 보이지 않는 존재가 명료하게 드러납니다!`, 'loot');
        used = true;
        break;

      // 6. 해독 및 저항
      case 26: // Slow Poison
        if (player.debuffs && player.debuffs.poison > 0) {
          player.debuffs.poison = Math.floor(player.debuffs.poison / 2);
        }
        log(`[Potion] 🧪 해독 진정제로 중독 증세가 대폭 완화되었습니다.`, 'loot');
        used = true;
        break;
      case 27: // Neutralise Poison
        if (player.debuffs) player.debuffs.poison = 0;
        log(`[Potion] 🌿 완전 해독제를 마셔 체내의 모든 독소가 정화되었습니다!`, 'loot');
        used = true;
        break;
      case 28: // Boldness
        player.fearTurns = 0;
        log(`[Potion] 🛡️ 용기의 비약으로 공포가 눈 녹듯 사라졌습니다!`, 'loot');
        used = true;
        break;
      case 30: // Resist Heat
        player.fireResistTurns = (player.fireResistTurns || 0) + 30;
        log(`[Potion] 🔥 화염 저항의 물약을 마셨습니다! 30턴 동안 화염 피해를 경감합니다.`, 'loot');
        used = true;
        break;
      case 31: // Resist Cold
        player.coldResistTurns = (player.coldResistTurns || 0) + 30;
        log(`[Potion] ❄️ 냉기 저항의 물약을 마셨습니다! 30턴 동안 동결 및 냉기 피해를 경감합니다.`, 'loot');
        used = true;
        break;

      // 7. 버프 계열 (가속, 영웅심, 광폭화, 무적)
      case 32: // Heroism
        player.heroismTurns = (player.heroismTurns || 0) + 25;
        healHp(10);
        log(`[Potion] ⚔️ 영웅의 비약을 마셨습니다! 25턴 동안 공포 면역과 공격력 증폭이 부여됩니다!`, 'loot');
        used = true;
        break;
      case 33: // Berserk Strength
        player.heroismTurns = (player.heroismTurns || 0) + 35;
        healHp(30);
        log(`[Potion] 🩸 광폭화의 영약을 마셨습니다! 35턴 동안 저지 불가 광폭 상태에 돌입합니다!`, 'loot');
        used = true;
        break;
      case 62: // Invulnerability
        player.invulnerableTurns = (player.invulnerableTurns || 0) + 10;
        log(`[Potion] 🛡️ 절대 무적의 영약(Invulnerability)을 마셨습니다! 10턴 동안 모든 피해를 100% 무효화합니다!`, 'loot');
        used = true;
        break;

      // 8. 6단계 체력 치유 포션
      case 34: // Cure Light Wounds
        healHp(20);
        used = true;
        break;
      case 35: // Cure Serious Wounds
        healHp(50, true);
        used = true;
        break;
      case 36: // Cure Critical Wounds
        healHp(100, true);
        used = true;
        break;
      case 38: // *Healing*
        healHp(300, true);
        used = true;
        break;
      case 39: // Life
        boostStat('con', '생명력(CON)');
        healHp(player.stats.maxHp, true, true);
        used = true;
        break;

      // 9. 마나 및 레벨 복원
      case 40: // Restore Mana
        if (player.stats && player.stats.mp !== undefined) player.stats.mp = player.stats.maxMp || 50;
        player.manaShield = Math.max(player.manaShield || 0, 50);
        player.manaShieldDuration = Math.max(player.manaShieldDuration || 0, 20);
        log(`[Potion] 🔷 마나 회복 영약으로 마력과 보호막이 완전히 충전되었습니다!`, 'loot');
        used = true;
        break;
      case 41: // Restore Life Levels
        log(`[Potion] 🕊️ 생명 복원의 비약으로 상실된 생명력이 온전히 회복되었습니다!`, 'loot');
        healHp(50, true);
        used = true;
        break;

      // 10. 스탯 복원 포션
      case 42: // Restore Strength
      case 43: // Restore Intelligence
      case 44: // Restore Wisdom
      case 45: // Restore Dexterity
      case 46: // Restore Constitution
      case 47: // Restore Charisma
        if (typeof player.markDirty === 'function') player.markDirty('스탯 복원');
        log(`[Potion] 💧 신체 정화 영약으로 약화되었던 능력치가 본래 수치로 복구되었습니다.`, 'loot');
        used = true;
        break;

      // 11. 스탯 영구 성장 영약 (Permanent Stat Boost)
      case 48: // Strength
        boostStat('str', '힘(STR)');
        used = true;
        break;
      case 49: // Intelligence
        boostStat('int', '지능(INT)');
        used = true;
        break;
      case 51: // Dexterity
        boostStat('dex', '민첩(DEX)');
        used = true;
        break;
      case 52: // Constitution
        boostStat('con', '생명력(CON)');
        used = true;
        break;
      case 53: // Charisma
        boostStat('cha', '매력(CHA)');
        used = true;
        break;
      case 55: // Augmentation (All Stats)
        boostStat('str', '힘');
        boostStat('dex', '민첩');
        boostStat('con', '생명력');
        boostStat('int', '지능');
        log(`[Potion] 👑 전능의 영약(Augmentation)이 발동하여 모든 핵심 능력치가 영구히 상승했습니다!`, 'loot');
        used = true;
        break;

      case 63: // New Life
        healHp(player.stats.maxHp, true);
        log(`[Potion] 🌅 신생의 비약(New Life)으로 몸과 마음이 완전히 정화되었습니다!`, 'loot');
        used = true;
        break;

      // 12. 폴백 (potionEffect 객체 지원 및 기본 치유)
      default:
        if (item.potionEffect) {
          if (item.potionEffect.type === 'STAT_BOOST') {
            boostStat('str', '힘(STR)');
          } else {
            healHp(item.potionEffect.amount || 25, true);
          }
          used = true;
        } else {
          healHp(25);
          used = true;
        }
        break;
    }

    if (used) {
      this._consumeItem(item, player);
    }
    return used;
  }

  /**
   * 주문서(TV_SCROLL: 70) 읽기 처리
   */
  static useScroll(item, player, game, log, sval = null, targetItem = null) {
    if (sval === null || sval === undefined) sval = item.sval;
    const map = game ? game.map : null;
    let used = false;

    switch (sval) {
      // 1. 단거리 점멸 (Phase Door: 3~5칸 안전 텔레포트)
      case 8: // Phase Door
        if (this._teleportPlayer(player, map, 3, 5)) {
          log(`[Scroll] 🌀 차원 도약 주문서(Phase Door)가 발동하여 근처 안전한 위치로 순식간에 점멸했습니다!`, 'loot');
          used = true;
        }
        break;

      // 2. 장거리 순간이동 (Teleportation)
      case 10: // Teleport Level
        if (this._teleportPlayer(player, map, 8, 30)) {
          log(`[Scroll] ✨ 텔레포트 주문서(Teleportation)가 발동하여 던전의 새로운 방으로 순간이동했습니다!`, 'loot');
          used = true;
        }
        break;

      // 3. 지도 밝히기 (Magic Mapping)
      case 25: // Magic Mapping
      case 31: // Divination
        if (map) {
          if (typeof map.revealAll === 'function') {
            map.revealAll();
          }
          if (map.tiles) {
            for (let y = 0; y < map.tiles.length; y++) {
              for (let x = 0; x < map.tiles[y].length; x++) {
                if (map.tiles[y] && map.tiles[y][x]) {
                  map.tiles[y][x].isExplored = true;
                  map.tiles[y][x].explored = true;
                  map.tiles[y][x].revealed = true;
                }
              }
            }
          }
          log(`[Scroll] 🗺️ 마법 지도 주문서(Magic Mapping)가 이번 층의 모든 방과 복도를 100% 탐지했습니다!`, 'loot');
          used = true;
        }
        break;

      // 4. 무기 강화 주문서
      case 17: // Enchant Weapon To-Hit
      case 18: // Enchant Weapon To-Dam
      case 21: // *Enchant Weapon*
        {
          const weapon = player.equipment?.weapon;
          if (!weapon) {
            log(`[System] ⚠️ 강화할 무기가 장착되어 있지 않습니다! 무기를 먼저 장착해 주세요.`, 'system');
            return false;
          }
          weapon.upgradeLevel = (weapon.upgradeLevel || 0) + 1;
          weapon.toHit = (weapon.toHit || 0) + 1;
          weapon.toDmg = (weapon.toDmg || 0) + 1;
          log(`[Scroll] ✨ 무기 강화 대성공! 장착 중인 [${weapon.name}]이(가) +${weapon.upgradeLevel}단계 (명중+${weapon.toHit}, 피해+${weapon.toDmg})로 강화되었습니다!`, 'loot');
          used = true;
        }
        break;

      // 5. 방어구 강화 주문서
      case 20: // *Enchant Armour*
        {
          const armor = player.equipment?.armor || player.equipment?.shield || player.equipment?.helmet;
          if (!armor) {
            log(`[System] ⚠️ 강화할 방어구가 장착되어 있지 않습니다! 방어구를 먼저 장착해 주세요.`, 'system');
            return false;
          }
          armor.upgradeLevel = (armor.upgradeLevel || 0) + 1;
          armor.baseAC = (armor.baseAC || 0) + 1;
          log(`[Scroll] 🛡️ 방어구 강화 대성공! [${armor.name}]의 기본 방어력(AC)이 +${armor.baseAC}로 강화되었습니다!`, 'loot');
          used = true;
        }
        break;

      // 6. 감정의 주문서 (Scroll of Identify: sval 13)
      case 13: {
        let target = targetItem;
        if (!target) {
          const eq = player.equipment || {};
          for (const k of Object.keys(eq)) {
            if (eq[k] && (eq[k].idState === 'UNIDENTIFIED' || eq[k].idState === 'PSEUDO_IDENTIFIED')) {
              target = eq[k];
              break;
            }
          }
          if (!target && Array.isArray(player.inventory)) {
            target = player.inventory.find(i => i && (i.idState === 'UNIDENTIFIED' || i.idState === 'PSEUDO_IDENTIFIED'));
          }
        }
        if (!target) {
          log(`[System] ℹ️ 감정할 미식별 장비가 존재하지 않습니다!`, 'system');
          return false;
        }
        TomeIdentificationEngine.identifyItem(target);
        log(`[Identify] 🔍 고대의 식별 마력이 깃들어 [${target.displayName}]의 진정한 위력이 드러났습니다!`, 'loot');
        used = true;
        break;
      }

      // 7. 진실의 감정 주문서 (Scroll of *Identify*: sval 14)
      case 14: {
        let target = targetItem;
        if (!target) {
          const eq = player.equipment || {};
          for (const k of Object.keys(eq)) {
            if (eq[k] && eq[k].idState !== 'STAR_IDENTIFIED') {
              target = eq[k];
              break;
            }
          }
          if (!target && Array.isArray(player.inventory)) {
            target = player.inventory.find(i => i && i.idState !== 'STAR_IDENTIFIED');
          }
        }
        if (!target) {
          log(`[System] ℹ️ 진실의 감정을 적용할 대상 장비가 없습니다!`, 'system');
          return false;
        }
        TomeIdentificationEngine.starIdentifyItem(target);
        log(`[Identify] 🌟 진실의 빛이 비추어 [${target.displayName}]의 숨겨진 모든 권능과 서사가 밝혀졌습니다!`, 'loot');
        used = true;
        break;
      }

      // 8. 저주 해제의 주문서 (Scroll of Remove Curse: sval 15)
      case 15: {
        let target = targetItem;
        if (!target) {
          const eq = player.equipment || {};
          for (const k of Object.keys(eq)) {
            if (eq[k] && (eq[k].isCursed || !TomeTagSystem.canUnequip(eq[k]))) {
              target = eq[k];
              break;
            }
          }
          if (!target && Array.isArray(player.inventory)) {
            target = player.inventory.find(i => i && (i.isCursed || !TomeTagSystem.canUnequip(i)));
          }
        }
        if (!target) {
          log(`[System] 🕊️ 정화할 저주받은 장비가 존재하지 않습니다!`, 'system');
          return false;
        }
        const res = TomeTagSystem.removeCurse(target, false);
        log(res.message, res.success ? 'loot' : 'warning');
        used = res.success;
        break;
      }

      // 9. 강력한 저주 해제의 주문서 (Scroll of *Remove Curse*: sval 16)
      case 16: {
        const count = TomeTagSystem.removeAllCurses(player);
        if (count > 0) {
          log(`[Purify] ☀️ 찬란한 정화의 광휘가 전신을 감싸며 착용 중인 모든 장비의 흉악한 저주(${count}개)가 완전히 소멸했습니다!`, 'loot');
          used = true;
        } else {
          let invCount = 0;
          if (Array.isArray(player.inventory)) {
            for (const item of player.inventory) {
              if (item && (item.isCursed || !TomeTagSystem.canUnequip(item))) {
                const res = TomeTagSystem.removeCurse(item, true);
                if (res.success) invCount++;
              }
            }
          }
          if (invCount > 0) {
            log(`[Purify] ☀️ 찬란한 정화의 광휘가 인벤토리 내의 저주 장비(${invCount}개)를 완전히 정화했습니다!`, 'loot');
            used = true;
          } else {
            log(`[System] 🕊️ 정화할 저주받은 장비가 존재하지 않습니다!`, 'system');
            return false;
          }
        }
        break;
      }

      // 10. 신성 축복 (Blessing)
      case 33: // Blessing
      case 34: // Holy Chant
      case 35: // Holy Prayer
      case 37: // Protection from Evil
        player.protectPrayerTurns = (player.protectPrayerTurns || 0) + 30;
        if (player.debuffs) {
          player.debuffs.poison = 0;
          player.debuffs.frost = 0;
          if (player.debuffs.magicVulnerability !== undefined) player.debuffs.magicVulnerability = 0;
        }
        log(`[Scroll] 🕊️ 성스러운 축복 주문서가 발동하여 모든 부정적 상태이상이 정화되고 신성 보호막(30턴)이 생성되었습니다!`, 'loot');
        used = true;
        break;

      // 7. 대파괴 (*Destruction*)
      case 41:
        if (game && Array.isArray(game.monsters)) {
          let killed = 0;
          for (let i = game.monsters.length - 1; i >= 0; i--) {
            const m = game.monsters[i];
            const dist = Math.hypot(m.x - player.x, m.y - player.y);
            if (dist <= 15) {
              m.stats.hp -= 100;
              if (m.stats.hp <= 0) {
                game.monsters.splice(i, 1);
                killed++;
              }
            }
          }
          log(`[Scroll] 🌋 대파괴 주문서(*Destruction*)가 발동하여 15칸 반경의 지형을 뒤흔들고 ${killed}체의 적을 일소했습니다!`, 'loot');
          used = true;
        }
        break;

      // 8. 언데드 퇴치 (Dispel Undead)
      case 42:
        if (game && Array.isArray(game.monsters)) {
          let count = 0;
          for (const m of game.monsters) {
            if (m.type === 'UNDEAD' || (m.flags && m.flags.includes('UNDEAD'))) {
              m.stats.hp -= 80;
              count++;
            }
          }
          log(`[Scroll] ☀️ 신성한 광휘(Dispel Undead)가 던전 전역의 언데드 ${count}체에 큰 타격을 입혔습니다!`, 'loot');
          used = true;
        }
        break;

      // 9. 포만감 / 더미
      case 32: // Satisfy Hunger
        log(`[Scroll] 🍞 주문서의 마력으로 허기가 가셨습니다.`, 'loot');
        used = true;
        break;

      // 10. 마법 도구 재충전 (Recharging)
      case 22: // Recharging
        if (player.inventory) {
          let recharged = 0;
          for (const invItem of player.inventory) {
            if (invItem.charges !== undefined) {
              invItem.charges += 3;
              recharged++;
            }
          }
          log(`[Scroll] ⚡ 재충전 주문서(Recharging)로 소지 중인 마법 완드/스태프의 충전량이 +3 회복되었습니다!`, 'loot');
          used = true;
        }
        break;

      // 11. 폴백 기본 주문서 (무기 강화 또는 체력 회복)
      default:
        {
          const weapon = player.equipment?.weapon;
          if (weapon) {
            weapon.upgradeLevel = (weapon.upgradeLevel || 0) + 1;
            weapon.toHit = (weapon.toHit || 0) + 1;
            weapon.toDmg = (weapon.toDmg || 0) + 1;
            log(`[Scroll] ✨ 신비한 주문서의 마력이 무기에 깃들어 [${weapon.name}]이(가) +${weapon.upgradeLevel}강화되었습니다!`, 'loot');
          } else {
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 20);
            log(`[Scroll] ✨ 신비한 주문서가 발동하여 체력이 +20 회복되었습니다.`, 'loot');
          }
          used = true;
        }
        break;
    }

    if (used) {
      this._consumeItem(item, player);
    }
    return used;
  }

  /**
   * 기름 플라스크(TV_FLASK: 77) 사용 처리
   */
  static useFlask(item, player, game, log, sval = null) {
    if (player.equippedLamp) {
      player.equippedLamp.fuelTurns = (player.equippedLamp.fuelTurns || 0) + 7500;
      log(`[Flask] 🏮 기름 플라스크를 등불에 가득 채웠습니다! 등불 연료가 +7,500턴 연장되었습니다.`, 'loot');
    } else {
      log(`[Flask] 🔥 기름 플라스크를 투척하여 화염을 일으켰습니다!`, 'combat');
    }
    this._consumeItem(item, player);
    return true;
  }

  /**
   * 음식(TV_FOOD: 80) 먹기 처리 (더미화)
   */
  static useFood(item, player, game, log, sval = null) {
    log(`[Food] 🍞 이 음식은 아무런 맛도 느껴지지 않습니다.`, 'system');
    this._consumeItem(item, player);
    return true;
  }

  /**
   * 안전한 위치로 플레이어를 텔레포트시킵니다.
   */
  static _teleportPlayer(player, map, minDist = 3, maxDist = 15) {
    if (!map) return false;

    for (let attempts = 0; attempts < 100; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const targetX = Math.round(player.x + Math.cos(angle) * dist);
      const targetY = Math.round(player.y + Math.sin(angle) * dist);

      if (targetX >= 1 && targetX < map.width - 1 && targetY >= 1 && targetY < map.height - 1) {
        if (map.isWalkable(targetX, targetY)) {
          player.x = targetX;
          player.y = targetY;
          return true;
        }
      }
    }

    // 폴백: 첫 번째 방 중심
    if (map.rooms && map.rooms.length > 0) {
      const room = map.rooms[Math.floor(Math.random() * map.rooms.length)];
      const center = room.center;
      player.x = center.x;
      player.y = center.y;
      return true;
    }

    return false;
  }

  /**
   * 사용된 아이템 수량을 1 차감하고, 0개일 경우 인벤토리에서 제거합니다.
   */
  static _consumeItem(item, player) {
    item.count = (item.count || 1) - 1;
    if (item.count <= 0 && player.inventory) {
      player.removeItem(item);
    }
  }
}
