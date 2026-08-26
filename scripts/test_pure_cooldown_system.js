/**
 * @file test_pure_cooldown_system.js
 * @description 마나(MP) 및 화살(Arrow) 완전 박멸, 100% 순수 쿨타임 및 숙련도(Mastery)
 *              자동 격발 전투 엔진 종합 검증 테스트 스위트.
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';
import { ARCHERY_CONFIG } from '../src/configs/GameBalanceConfig.js';

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
console.log('🧪 [TEST SUITE 1] 마나(MP) 및 화살(Arrow) 완전 박멸 검증');
console.log('🧪 ========================================================');

const player = new Player(5, 5);

// 1. Player MP fields non-existence check
assert(player.stats.mp === undefined, 'Player.stats.mp 필드가 존재하지 않음 (Clean Purge)');
assert(player.consumeMp === undefined, 'Player.consumeMp 메서드가 제거됨');
assert(player.restoreMp === undefined, 'Player.restoreMp 메서드가 제거됨');
assert(player.getArrowCount === undefined, 'Player.getArrowCount 메서드가 제거됨');

// 2. ActiveSkill manaCost check
const innateSkills = MonsterSpellFactory.createInnateSkills('KOBOLD');
assert(innateSkills.length === 4, '코볼트 의태 스킬 4개 생성 완료');
assert(innateSkills[0].manaCost === undefined, '스킬에 manaCost 필드가 없음 (Pure Cooldown)');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] 무한 화살 & 궁술 숙련도(Archery Mastery) 쿨타임 단축 검증');
console.log('🧪 ========================================================');

const bow = new Item(0, 0, 'WEAPON', '}', '#38bdf8', '중형 석궁', 10, null, {}, null, 'ARCHERY');
bow.slotType = 'BOW';
bow.range = 7;
player.equipment.bow = bow;
player.inventory = []; // 화살 0개 (빈 인벤토리)

// Archery Mastery Lv 1 (0 XP)
player.body.weaponMastery = { ARCHERY: { count: 0 } };
const cdLv1 = player.getRangedCooldown(bow);
console.log(`  📊 궁술 Lv.1 중형 석궁 쿨다운: ${cdLv1}턴`);
assert(cdLv1 === 4, '궁술 Lv.1 중형 석궁 기본 쿨다운 4턴');

// Archery Mastery Lv 20+ (200 XP)
player.body.weaponMastery = { ARCHERY: { count: 200 } };
const cdLv20 = player.getRangedCooldown(bow);
console.log(`  📊 궁술 Lv.20+ 중형 석궁 쿨다운: ${cdLv20}턴`);
assert(cdLv20 <= 3, '궁술 Lv.20+ 숙련도 적용 시 쿨다운 -1턴 단축 (3턴 이하)');

// Archery Mastery Lv 40+ (400 XP)
player.body.weaponMastery = { ARCHERY: { count: 400 } };
const cdLv40 = player.getRangedCooldown(bow);
console.log(`  📊 궁술 Lv.40+ 중형 석궁 쿨다운: ${cdLv40}턴`);
assert(cdLv40 <= 2, '궁술 Lv.40+ 숙련도 적용 시 쿨다운 -2턴 단축 (2턴 이하)');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] 시야/사거리 내 적 감지 시 원거리 자동 사격(Auto-Fire) 검증 (화살 0개)');
console.log('🧪 ========================================================');

const mockGame = {
  player: player,
  dungeon: {
    currentFloor: 1,
    monsters: []
  },
  map: {
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

const enemyMonster = new Monster(8, 5, 'Novice warrior', 1); // 3칸 거리
enemyMonster.baseAC = 10;
mockGame.dungeon.monsters.push(enemyMonster);

player.rangedCooldownTracker = 0;
player.autoFireEnabled = true;

const fired = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(fired === true, '화살이 0개인 상태에서도 사거리 3칸 내 적에게 자동 사격 성공');
assert(player.rangedCooldownTracker > 0, `사격 후 원거리 쿨다운 정상 발동 (${player.rangedCooldownTracker}턴)`);

// 쿨다운 중 재발사 방지 검증
const secondFire = CombatSystem.tryAutoRangedAttack(mockGame, player);
assert(secondFire === false, '쿨다운 중에는 자동 사격이 대기 상태로 유지됨');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] 의태 스킬 자동 조준 격발(Auto-Cast) & 쿨다운 라이프사이클 검증');
console.log('🧪 ========================================================');

// 1. Dragon Fire Breath (Range 5.5) vs Monster at Range 4
player.mimicCore = { name: '레드 드래곤', coreType: 'DRAGON' };
player.activeSkills = MonsterSpellFactory.createInnateSkills('DRAGON');
player.trackers = { cooldown: {} };
player.body.loreRegistry = { DRAGON: 0 }; // Lv 1

const dragonTarget = new Monster(9, 5, 'Small kobold', 1); // 4칸 거리
dragonTarget.baseAC = 8;
mockGame.dungeon.monsters = [dragonTarget];

const dragonCastSuccess = CombatSystem.checkAndCastAutoSkills(mockGame, player);
assert(dragonCastSuccess === true, '사거리 4칸 내 적에게 드래곤 화염 브레스(DRAGON_BR_FIRE) 자동 조준 격발 성공');

// 격발된 스킬 쿨다운 부여 확인
const breathSkill = player.activeSkills[0];
const breathCd = player.getTracker(breathSkill.id, 'cooldown');
assert(breathCd > 0, `브레스 시전 후 쿨다운 정상 부여됨 (CD: ${breathCd}턴)`);

// 턴 진행 시 쿨다운 감소 검증
CombatSystem.triggerActiveSkills(mockGame);
const afterTurnCd = player.getTracker(breathSkill.id, 'cooldown');
assert(afterTurnCd === breathCd - 1, `턴 진행 시 브레스 쿨다운 정상 1턴 감소 (${breathCd} -> ${afterTurnCd})`);

// 2. Orc Melee Strike (Range 1.5) vs Adjacent Monster at Range 1
player.mimicCore = { name: '오크', coreType: 'ORC' };
player.activeSkills = MonsterSpellFactory.createInnateSkills('ORC');
player.trackers = { cooldown: {} };
player.body.loreRegistry = { ORC: 0 };

const adjacentEnemy = new Monster(6, 5, 'Novice warrior', 1); // 1칸 인접
adjacentEnemy.baseAC = 10;
mockGame.dungeon.monsters = [adjacentEnemy];

const orcCastSuccess = CombatSystem.checkAndCastAutoSkills(mockGame, player);
assert(orcCastSuccess === true, '1칸 인접 적에게 오크 근접 타격 스킬 자동 조준 격발 성공');

const orcSkill = player.activeSkills[0];
const orcCd = player.getTracker(orcSkill.id, 'cooldown');
assert(orcCd > 0, `오크 스킬 시전 후 쿨다운 정상 부여됨 (CD: ${orcCd}턴)`);

console.log('\n========================================================');
console.log(`🎉 [TEST RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
