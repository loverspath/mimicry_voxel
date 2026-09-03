/**
 * @file test_autocast_toggle.js
 * @description 전사(Novice warrior) SHIELD_BASH 배정, BLINK 제거 및 오토캐스트 On/Off 토글 시스템 단위 테스트
 */

import { MonsterSpellFactory } from '../src/systems/MonsterSpellFactory.js';
import { Player } from '../src/entities/Player.js';
import { renderSkillTreeHTML } from '../src/ui/HUDView.js';
import { renderSkillHotbarHTML } from '../src/ui/SkillHotbarView.js';
import { SaveSystem } from '../src/core/SaveSystem.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 1] 전사(MON_NOVICE_WARRIOR) SHIELD_BASH 배정 및 BLINK 완전 제거 검증');
console.log('='.repeat(80));

MonsterSpellFactory._cache.clear();
const warriorSkills = MonsterSpellFactory.createInnateSkills('MON_NOVICE_WARRIOR');

assert(warriorSkills.length === 4, '전사 스킬 4슬롯 완비');
const hasBlink = warriorSkills.some(s => s.tomeKey === 'BLINK' || s.type === 'TELEPORT');
assert(!hasBlink, '전사 스킬 목록에 마법 점멸(BLINK/TELEPORT)이 완전히 존재하지 않음');

const slot3 = warriorSkills.find(s => s.slot === 3);
assert(slot3 !== undefined, '3번 슬롯 스킬 존재');
assert(slot3.tomeKey === 'SHIELD_BASH', '3번 슬롯에 정통 전사 기술 SHIELD_BASH 안착');
assert(slot3.name.includes('방패 강타'), '3번 슬롯 스킬명이 방패 강타를 표기함');
assert(slot3.type === 'MELEE_STRIKE', '3번 슬롯 스킬 타입이 MELEE_STRIKE 물리 타격임');
assert(slot3.dice === '2d6', '3번 슬롯 피해 주사위 2d6 확인');
assert(slot3.requiredMastery === 10, '3번 슬롯 해금 숙련도 Lv.10 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 2] 마법형 몬스터(MON_NOVICE_MAGE, MON_IMP)의 BLINK 유지 교차 검증');
console.log('='.repeat(80));

MonsterSpellFactory._cache.clear();
const mageSkills = MonsterSpellFactory.createInnateSkills('MON_NOVICE_MAGE');
const mageHasBlink = mageSkills.some(s => s.tomeKey === 'BLINK' || s.name.includes('점멸'));
assert(mageHasBlink, '마법사 계열(MON_NOVICE_MAGE)은 3번 슬롯에 BLINK(점멸) 정상 배정');

MonsterSpellFactory._cache.clear();
const impSkills = MonsterSpellFactory.createInnateSkills('MON_IMP');
const impHasBlink = impSkills.some(s => s.tomeKey === 'BLINK' || s.tomeKey === 'TELEPORT' || s.type === 'TELEPORT');
assert(impHasBlink, '임프 계열(MON_IMP)은 순간이동/점멸 정상 배정');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 3] Player 오토캐스트 On/Off 상태 토글 및 tryAutoCastInnateSkills 차단 검증');
console.log('='.repeat(80));

const player = new Player(5, 5, 'MON_NOVICE_WARRIOR');
const pSkills = player.getInnateSkills();
const bashSkill = pSkills.find(s => s.tomeKey === 'SHIELD_BASH');

assert(player.isAutoCastEnabled(bashSkill.id) === true, '기본 오토캐스트 상태는 ON (true)');
const toggledOff = player.toggleAutoCast(bashSkill.id);
assert(toggledOff === false, '토글 시 오토캐스트 OFF (false) 반환');
assert(player.isAutoCastEnabled(bashSkill.id) === false, 'isAutoCastEnabled 상태가 false로 확인됨');

// 모의 게임 환경 설정
const mockEnemy = {
  id: 'enemy_1',
  displayName: '테스트 오크',
  x: 5,
  y: 6,
  type: 'ORC',
  level: 1,
  prefixes: [],
  suffixes: [],
  energy: 100,
  batFleeTurns: 0,
  breathCooldown: 0,
  giantBloodCooldown: 0,
  stats: { hp: 30, maxHp: 30 },
  debuffs: {},
  statuses: {}
};

const mockGame = {
  player,
  floor: 1,
  floorDanger: 1,
  items: [],
  monsters: [mockEnemy],
  dungeon: { monsters: [mockEnemy], items: [] },
  isMonsterAt: (x, y) => x === mockEnemy.x && y === mockEnemy.y,
  map: {
    width: 10,
    height: 10,
    floor: 1,
    startingPosition: { x: 5, y: 5 },
    rooms: [],
    isWalkable: () => true,
    isTransparent: () => true
  },
  uniqueMonsterManager: { serialize: () => ({}) },
  addLogEntry: () => {}
};

// 플레이어 체력 20%로 위기 상황 조성 & 숙련도 Lv.10 설정
player.stats.hp = 20;
player.stats.maxHp = 100;
player.body.loreRegistry['MON_NOVICE_WARRIOR'] = 300; // Lv.10+ 해금

// 모든 스킬 오토캐스트 OFF로 전환
pSkills.forEach(s => {
  if (player.isAutoCastEnabled(s.id)) player.toggleAutoCast(s.id);
});

// 전수 OFF 상태에서는 자동 시전 차단되어야 함
const didCastWhenAllOff = player.tryAutoCastInnateSkills(mockGame);
assert(didCastWhenAllOff === false, '모든 스킬 오토캐스트 OFF 상태일 때 위기 상황이어도 자동 시전 전면 차단됨');

// 오직 SHIELD_BASH(3번 슬롯)만 다시 ON으로 토글
player.toggleAutoCast(bashSkill.id);
assert(player.isAutoCastEnabled(bashSkill.id) === true, 'SHIELD_BASH 단독 오토캐스트 ON 복귀');

// SHIELD_BASH 자동 발동하여 적을 타격, 기절, 밀쳐냄
const didCastWhenBashOn = player.tryAutoCastInnateSkills(mockGame);
assert(didCastWhenBashOn === true, '오토캐스트 ON 상태에서 위기 상황 시 SHIELD_BASH 정상 자동 시전');
assert(mockEnemy.stats.hp < 30, '방패 강타로 적 체력 감소 확인');
assert(mockEnemy.debuffs.paralyzed === true, '방패 강타로 적 기절 부여 확인');
assert(mockEnemy.y === 7, '방패 강타로 적이 (5, 6)에서 (5, 7)로 뒤로 1칸 밀려남 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 4] SaveSystem 직렬화/역직렬화 무결성 검증');
console.log('='.repeat(80));

const saveData = SaveSystem.serialize(mockGame);
assert(saveData !== null && typeof saveData === 'string', '게임 저장 데이터 정상 문자열 생성');

const parsed = JSON.parse(saveData);
assert(parsed.player.disabledAutoCastSkills !== undefined, '저장 데이터에 disabledAutoCastSkills 필드 포함');
const skill1 = pSkills[0];
assert(parsed.player.disabledAutoCastSkills[skill1.id] === true, '스킬 1번 비활성화 상태가 정확히 저장됨');
assert(parsed.player.disabledAutoCastSkills[bashSkill.id] === false || parsed.player.disabledAutoCastSkills[bashSkill.id] === undefined, '스킬 3번 활성화 상태 정확히 저장');

const restoredGame = {
  monsters: [],
  dungeon: { monsters: [], items: [], bloodSplats: [] },
  map: { width: 10, height: 10, tiles: [] }
};
SaveSystem.deserialize(restoredGame, saveData);

assert(restoredGame.player.isAutoCastEnabled(skill1.id) === false, '로드 후에도 스킬 1번 OFF 상태 완벽 복원');
assert(restoredGame.player.isAutoCastEnabled(bashSkill.id) === true, '로드 후에도 스킬 3번 ON 상태 완벽 복원');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 5] UI 마크업(HUDView & SkillHotbarView) 오토캐스트 배지/버튼 검증');
console.log('='.repeat(80));

const skillTreeHTML = renderSkillTreeHTML(player);
assert(skillTreeHTML.includes('autocast-toggle-btn'), '의태 고유스킬 모달에 autocast-toggle-btn 버튼 포함');
assert(skillTreeHTML.includes('🟢 오토: ON') || skillTreeHTML.includes('🔴 오토: OFF'), '오토 On/Off 텍스트 정상 표기');

const hotbarHTML = renderSkillHotbarHTML(player);
assert(hotbarHTML.includes('slot-auto-badge'), '스킬 핫바에 slot-auto-badge 인디케이터 배지 포함');
assert(hotbarHTML.includes('AUTO') || hotbarHTML.includes('MAN'), '핫바에 AUTO 또는 MAN 상태 표기');

console.log('='.repeat(80));
console.log(`🎉 [TEST SUMMARY] 총 ${passed + failed}개 검증 중 ${passed}개 통과 (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
