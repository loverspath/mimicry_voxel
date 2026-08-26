/**
 * @file test_auto_skills.js
 * @description 플레이어가 이동하거나 턴을 진행할 때, 사거리 내 유효한 적을 자동 타겟팅하여
 *              스킬 및 활 공격이 자동으로 격발되는지 시뮬레이션 검증하는 통합 테스트.
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('🧪 ========================================================');
console.log('🧪 [SIMULATION] 플레이어 이동 및 턴 진행 시 스킬 자동 격발 시뮬레이션');
console.log('🧪 ========================================================');

const player = new Player(10, 10);
player.mimicCore = { name: '레드 드래곤', coreType: 'DRAGON' };
player.activeSkills = MonsterSpellFactory.createInnateSkills('DRAGON');
player.trackers = { cooldown: {} };
player.body.loreRegistry = { DRAGON: 0 }; // Lv 1

const bow = new Item(0, 0, 'WEAPON', '}', '#38bdf8', '장궁', 10, null, {}, null, 'ARCHERY');
bow.slotType = 'BOW';
bow.range = 6;
player.equipment.bow = bow;
player.autoFireEnabled = true;

const enemyA = new Monster(14, 10, 'Giant bat', 1); // 4칸 거리
enemyA.baseAC = 5;
enemyA.stats.hp = 100;
enemyA.stats.maxHp = 100;

const mockGame = {
  player: player,
  dungeon: {
    currentFloor: 1,
    monsters: [enemyA]
  },
  map: {
    isWalkable: (x, y) => true,
    isTransparent: (x1, y1, x2, y2) => true
  },
  effects: [],
  logs: [],
  addLogEntry: function(text, type) {
    this.logs.push({ text, type });
  },
  triggerShake: function() {},
  triggerFloatingText: function() {},
  updateUI: function() {},
  draw: function() {}
};

// 턴 1: 플레이어가 적을 향해 1칸 이동 (10, 10) -> (11, 10)
player.x = 11;
player.y = 10;
// 적과 거리: 3칸

// 1. checkAndCastAutoSkills 실행 (드래곤 화염 브레스 격발)
const cast1 = CombatSystem.checkAndCastAutoSkills(mockGame, player);
assert(cast1 === true, '턴 1: 이동 후 3칸 거리 박쥐에게 화염 브레스 자동 격발');
assert(player.getTracker('DRAGON_BR_FIRE', 'cooldown') === 8, '턴 1: 브레스 쿨다운 8턴 부여');

// 2. 턴 종료 및 쿨다운 회수
CombatSystem.triggerActiveSkills(mockGame);
assert(player.getTracker('DRAGON_BR_FIRE', 'cooldown') === 7, '턴 1 종료: 브레스 쿨다운 7턴으로 감소');

// 3. 턴 2: 플레이어가 다시 1칸 대기/이동 -> 브레스는 쿨다운 중이므로 화살 0개 상태에서 자동 사격 격발
player.rangedCooldownTracker = 0;
const cast2 = CombatSystem.checkAndCastAutoSkills(mockGame, player);
assert(cast2 === false, '턴 2: 브레스가 쿨다운 중이므로 스킬은 미격발');

const bowFire = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(bowFire === true, '턴 2: 스킬 쿨다운 중 장궁 자동 사격(Auto-Fire) 즉시 격발');
assert(player.rangedCooldownTracker > 0, '턴 2: 장궁 쿨다운 정상 발동');

console.log('\n========================================================');
console.log(`🎉 [AUTO SKILLS RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
