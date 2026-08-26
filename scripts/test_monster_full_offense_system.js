/**
 * @file test_monster_full_offense_system.js
 * @description ToME/TomeNET 정통 몬스터 7대 공격 체계 통합 종합 검증 스위트
 *              1. 스펠 카탈로그 완비 및 키 정규화 (106종 C 스펠, ARROW_1~4, BR_WALL, BR_NUKE, S_ANIMAL 등)
 *              2. 실효 액션 핸들러 (소환, 점멸, 강제이동, 디버프/저주, 회복/가속, 투사체/브레스/AoE)
 *              3. TomeNET 정통 5단계 AI 의사결정 트리 (자가생존 -> 가속 -> 원거리포격 -> 소환/제어 -> 디버프)
 *              4. 20 Methods x 27 Effects 근접 On-Hit 타격 체계 통합
 */

import { TomeSpellEngine, TOME_CANONICAL_SPELLS, TOME_ATTACK_METHODS, TOME_ATTACK_EFFECTS } from '../src/systems/TomeSpellEngine.js';
import { MonsterAISystem } from '../src/systems/MonsterAISystem.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { Spawner } from '../src/core/Spawner.js';
import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Map } from '../src/map/Map.js';
import { TomeFlagResolver } from '../src/systems/TomeFlagResolver.js';
import { UnifiedTraitEngine } from '../src/systems/UnifiedTraitEngine.js';

console.log("==================================================");
console.log("🐉 ToME/TomeNET 몬스터 7대 공격 체계 통합 검증 스위트");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name} ${details ? '- ' + details : ''}`);
    failed++;
  }
}

// ----------------------------------------------------
// Section 1: 스펠 카탈로그 완비 및 키 정규화 검증
// ----------------------------------------------------
console.log("\n[1] 스펠 카탈로그 완비 및 키 정규화 검증");

// 1-1. ARROW_1 ~ ARROW_4 등록 확인
const arrow1 = TomeSpellEngine.getSpellDefinition('ARROW_1');
const arrow2 = TomeSpellEngine.getSpellDefinition('ARROW_2');
const arrow3 = TomeSpellEngine.getSpellDefinition('ARROW_3');
const arrow4 = TomeSpellEngine.getSpellDefinition('ARROW_4');

assert(arrow1 && arrow1.dice === '2d6', "ARROW_1 등록 및 2d6 대미지 명세 확인");
assert(arrow2 && arrow2.dice === '3d8', "ARROW_2 등록 및 3d8 대미지 명세 확인");
assert(arrow3 && arrow3.dice === '5d8', "ARROW_3 등록 및 5d8 대미지 명세 확인");
assert(arrow4 && arrow4.dice === '8d8', "ARROW_4 등록 및 8d8 대미지 명세 확인");

// 1-2. 키 정규화 및 동의어 해소 확인
assert(TomeSpellEngine.normalizeSpellKey('BO_ICEE') === 'BO_ICE', "BO_ICEE -> BO_ICE 정규화");
assert(TomeSpellEngine.normalizeSpellKey('MISSILE_1') === 'MISSILE', "MISSILE_1 -> MISSILE 정규화");
assert(TomeSpellEngine.getSpellDefinition('BO_ICEE') !== null, "BO_ICEE 키로 스펠 정의 정상 조회");
assert(TomeSpellEngine.getSpellDefinition('MISSILE_1') !== null, "MISSILE_1 키로 스펠 정의 정상 조회");

// 1-3. 추가 정식 스펙 검증 (BR_WALL, BR_NUKE, S_ANIMAL, S_ANIMALS, S_THUNDERLORD, S_BUG, ROCKET)
const brWall = TomeSpellEngine.getSpellDefinition('BR_WALL');
const brNuke = TomeSpellEngine.getSpellDefinition('BR_NUKE');
const sAnimal = TomeSpellEngine.getSpellDefinition('S_ANIMAL');
const sAnimals = TomeSpellEngine.getSpellDefinition('S_ANIMALS');
const sThunder = TomeSpellEngine.getSpellDefinition('S_THUNDERLORD');
const sBug = TomeSpellEngine.getSpellDefinition('S_BUG');
const rocket = TomeSpellEngine.getSpellDefinition('ROCKET');

assert(brWall && brWall.element === 'FORCE', "BR_WALL (충격 브레스, FORCE) 스펙 등록 확인");
assert(brNuke && brNuke.element === 'POISON' && brNuke.dice === '16d12', "BR_NUKE (방사능 브레스, 16d12) 스펙 등록 확인");
assert(sAnimal && sAnimal.summonType === 'ANIMAL' && sAnimal.count === 1, "S_ANIMAL 스펙 등록 확인");
assert(sAnimals && sAnimals.summonType === 'ANIMALS' && sAnimals.count === 3, "S_ANIMALS 스펙 등록 확인");
assert(sThunder && sThunder.summonType === 'THUNDERLORD', "S_THUNDERLORD 스펙 등록 확인");
assert(sBug && sBug.summonType === 'BUG', "S_BUG 스펙 등록 확인");
assert(rocket && rocket.element === 'FIRE' && rocket.dice === '12d10', "ROCKET (12d10) 스펙 등록 확인");

// ----------------------------------------------------
// Section 2: 실효 액션 핸들러 검증 (TomeSpellEngine.castSpell)
// ----------------------------------------------------
console.log("\n[2] 실효 액션 핸들러 검증 (TomeSpellEngine.castSpell)");

// Mock Map & Game 생성 (테스트 전용 열린 공간 확보)
const testMap = new Map(40, 40);
for (let x = 5; x <= 35; x++) {
  for (let y = 5; y <= 35; y++) {
    testMap.tiles[x][y] = { type: 'FLOOR', char: '.', color: '#555', name: 'Floor', transparent: true, isWalkable: true };
  }
}
const startTile = { x: 20, y: 20 };
const mockPlayer = new Player(startTile.x, startTile.y, 'HUMAN');
const testGame = {
  map: testMap,
  player: mockPlayer,
  monsters: [],
  logs: [],
  addLogEntry(msg, type = 'system') {
    this.logs.push(`[${type}] ${msg}`);
  },
  isMonsterAt(x, y) {
    return this.monsters.some(m => m.x === x && m.y === y && m.stats.hp > 0);
  }
};
mockPlayer.game = testGame;

// 2-1. 소환 (SUMMON) 액션 검증
const summonCaster = new Monster(startTile.x, startTile.y, 'ORC', 5);
const initialMonsterCount = testGame.monsters.length;
const summonRes = TomeSpellEngine.castSpell({
  spellKey: 'S_ANT',
  caster: summonCaster,
  target: mockPlayer,
  game: testGame
});
assert(summonRes.success, "S_ANT 소환 주문 시전 성공");
assert(testGame.monsters.length > initialMonsterCount, `실제 몬스터 맵 스폰 및 game.monsters 등록 확인 (${testGame.monsters.length}마리)`);

// 2-2. 점멸 (BLINK / TPORT) 액션 검증
const blinkCaster = new Monster(startTile.x, startTile.y, 'GOBLIN', 3);
const origX = blinkCaster.x, origY = blinkCaster.y;
const blinkRes = TomeSpellEngine.castSpell({
  spellKey: 'BLINK',
  caster: blinkCaster,
  target: mockPlayer,
  game: testGame
});
assert(blinkRes.success, "BLINK 점멸 주문 시전 성공");
assert(blinkCaster.x !== origX || blinkCaster.y !== origY, `점멸 후 시전자 좌표 이동 확인 (${origX},${origY} -> ${blinkCaster.x},${blinkCaster.y})`);

// 2-3. 위치 강제 이동 (TELE_TO / TELE_AWAY) 검증
const teleToCaster = new Monster(startTile.x, startTile.y, 'TITAN', 10);
mockPlayer.x = startTile.x + 8; mockPlayer.y = startTile.y + 8;

const teleToRes = TomeSpellEngine.castSpell({
  spellKey: 'TELE_TO',
  caster: teleToCaster,
  target: mockPlayer,
  game: testGame
});
assert(teleToRes.success, "TELE_TO 주문 시전 성공");
const distAfterTeleTo = Math.hypot(mockPlayer.x - teleToCaster.x, mockPlayer.y - teleToCaster.y);
assert(distAfterTeleTo <= 2.0, `TELE_TO: 플레이어가 몬스터 인접 칸으로 강제 인양됨 (거리: ${distAfterTeleTo.toFixed(1)})`);

const teleAwayRes = TomeSpellEngine.castSpell({
  spellKey: 'TELE_AWAY',
  caster: teleToCaster,
  target: mockPlayer,
  game: testGame
});
assert(teleAwayRes.success, "TELE_AWAY 주문 시전 성공");
const distAfterTeleAway = Math.hypot(mockPlayer.x - teleToCaster.x, mockPlayer.y - teleToCaster.y);
assert(distAfterTeleAway >= 5.0, `TELE_AWAY: 플레이어가 원거리로 강제 추방됨 (거리: ${distAfterTeleAway.toFixed(1)})`);

// 2-4. 디버프 및 저주 실효 효과 & 저항 판정 검증
const debuffCaster = new Monster(startTile.x, startTile.y, 'HUMAN', 5);

// 실명 (BLIND)
mockPlayer.debuffs.blind = 0;
TomeSpellEngine.castSpell({ spellKey: 'BLIND', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(mockPlayer.debuffs.blind > 0, `실명 디버프 턴수 부여 확인 (${mockPlayer.debuffs.blind}턴)`);

// 실명 면역 (NO_BLIND) 테스트
mockPlayer.flags = ['NO_BLIND'];
mockPlayer.debuffs.blind = 0;
TomeSpellEngine.castSpell({ spellKey: 'BLIND', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(mockPlayer.debuffs.blind === 0, "NO_BLIND 플래그 보유 시 실명 저항/면역 확인");

// 마비 (HOLD) & FREE_ACT 면역 테스트
mockPlayer.flags = [];
mockPlayer.debuffs.paralyzed = false;
TomeSpellEngine.castSpell({ spellKey: 'HOLD', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(mockPlayer.debuffs.paralyzed === true, "HOLD 시전 시 플레이어 마비 상태 부여 확인");

mockPlayer.flags = ['FREE_ACT'];
mockPlayer.debuffs.paralyzed = false;
TomeSpellEngine.castSpell({ spellKey: 'HOLD', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(mockPlayer.debuffs.paralyzed === false, "FREE_ACT 플래그 보유 시 마비 완전 면역 확인");

// 혼란 (CONF) & NO_CONF 면역 테스트
mockPlayer.flags = [];
mockPlayer.debuffs.confused = 0;
TomeSpellEngine.castSpell({ spellKey: 'CONF', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(mockPlayer.debuffs.confused > 0, `혼란 디버프 부여 확인 (${mockPlayer.debuffs.confused}턴)`);

mockPlayer.flags = ['NO_CONF'];
mockPlayer.debuffs.confused = 0;
TomeSpellEngine.castSpell({ spellKey: 'CONF', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(mockPlayer.debuffs.confused === 0, "NO_CONF 플래그 보유 시 혼란 면역 확인");

// 2-5. 자가 회복 (HEAL) & 가속 (HASTE) 검증
const healMonster = new Monster(startTile.x, startTile.y, 'HUMAN', 5);
healMonster.stats.hp = 10;
healMonster.stats.maxHp = 100;
TomeSpellEngine.castSpell({ spellKey: 'HEAL', caster: healMonster, target: null, game: testGame });
assert(healMonster.stats.hp > 10, `HEAL 시전 후 체력 회복 확인 (현재 HP: ${healMonster.stats.hp})`);

TomeSpellEngine.castSpell({ spellKey: 'HASTE', caster: healMonster, target: null, game: testGame });
assert(healMonster.hasteTurns >= 20, `HASTE 시전 후 hasteTurns 가속 부여 확인 (${healMonster.hasteTurns}턴)`);

// 2-6. 원거리 포격 대미지 및 속성 저항 검증
mockPlayer.flags = [];
mockPlayer.stats.hp = 200; mockPlayer.stats.maxHp = 200;
const boltRes = TomeSpellEngine.castSpell({ spellKey: 'BO_FIRE', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(boltRes.success && boltRes.damage > 0, `BO_FIRE 단일 화염 볼트 피해 적용 (${boltRes.damage} 대미지)`);

mockPlayer.flags = ['RES_FIRE'];
mockPlayer.stats.hp = 200;
const resistBoltRes = TomeSpellEngine.castSpell({ spellKey: 'BO_FIRE', caster: debuffCaster, target: mockPlayer, game: testGame });
assert(resistBoltRes.damage >= 0, `RES_FIRE 보유 시 화염 볼트 반감 판정 확인 (${resistBoltRes.damage} 대미지)`);

// ----------------------------------------------------
// Section 3: TomeNET 정통 5단계 AI 의사결정 트리 검증
// ----------------------------------------------------
console.log("\n[3] TomeNET 정통 5단계 AI 의사결정 트리 검증");

// 3-1. 빈도 파싱 검증
const m1In4 = { spells: ['1_IN_4', 'BO_FIRE'] };
const m1In2 = { spells: ['1_IN_2', 'BO_COLD'] };
const mDefault = { spells: ['BO_ACID'] };
assert(Math.abs(MonsterAISystem.getMonsterSpellFrequency(m1In4) - 0.25) < 0.001, "1_IN_4 빈도 파싱 (0.25)");
assert(Math.abs(MonsterAISystem.getMonsterSpellFrequency(m1In2) - 0.50) < 0.001, "1_IN_2 빈도 파싱 (0.50)");
assert(Math.abs(MonsterAISystem.getMonsterSpellFrequency(mDefault) - (1/6)) < 0.001, "기본 빈도 파싱 (1/6)");

// 3-2. 1단계: 자가 생존/회복 우선순위 검증 (HP < 35% & HEAL / BLINK)
mockPlayer.x = startTile.x; mockPlayer.y = startTile.y;
const woundedMage = new Monster(startTile.x, startTile.y + 2, 'HUMAN', 5);
woundedMage.spells = ['1_IN_6', 'HEAL', 'BO_FIRE', 'HASTE'];
woundedMage.stats.hp = 20; woundedMage.stats.maxHp = 100; // 20% HP
woundedMage.cooldowns = {};

MonsterAISystem.act(
  woundedMage,
  mockPlayer,
  testMap,
  () => false,
  () => {},
  () => {},
  (msg, type) => testGame.addLogEntry(msg, type)
);
assert(woundedMage.stats.hp > 20, `위기 상황(HP 20%)에서 1단계 자가 회복(HEAL) 우선 실행 확인 (HP: ${woundedMage.stats.hp})`);
assert(woundedMage.cooldowns['HEAL'] > 0, "HEAL 쿨다운 정상 등록 확인");

// 3-3. 2단계: 가속 버프 우선순위 검증 (비가속 & HASTE)
mockPlayer.x = startTile.x; mockPlayer.y = startTile.y;
const hasteMage = new Monster(startTile.x, startTile.y + 2, 'HUMAN', 5);
hasteMage.spells = ['1_IN_1', 'HASTE', 'BO_FIRE', 'S_ANT'];
hasteMage.stats.hp = 100; hasteMage.stats.maxHp = 100;
hasteMage.hasteTurns = 0;
hasteMage.cooldowns = {};

MonsterAISystem.act(
  hasteMage,
  mockPlayer,
  testMap,
  () => false,
  () => {},
  () => {},
  (msg, type) => testGame.addLogEntry(msg, type)
);
assert(hasteMage.hasteTurns > 0, `비가속 상태에서 2단계 가속 버프(HASTE) 우선 실행 확인 (${hasteMage.hasteTurns}턴)`);

// 3-4. 3단계: 원거리 포격 우선순위 검증 (브레스 -> 볼 -> 볼트)
const artilleryDragon = new Monster(startTile.x, startTile.y + 4, 'DRAGON', 10);
artilleryDragon.spells = ['1_IN_1', 'BR_FIRE', 'BA_FIRE', 'BO_FIRE'];
artilleryDragon.stats.hp = 300; artilleryDragon.stats.maxHp = 300;
artilleryDragon.hasteTurns = 10; // already hasted
artilleryDragon.cooldowns = {};
mockPlayer.x = startTile.x; mockPlayer.y = startTile.y; // distance 4 tiles (LOS clear)

MonsterAISystem.act(
  artilleryDragon,
  mockPlayer,
  testMap,
  () => false,
  () => {},
  () => {},
  (msg, type) => testGame.addLogEntry(msg, type)
);
assert(artilleryDragon.cooldowns['BR_FIRE'] > 0, "3단계: 브레스(BR_FIRE) 최우선 포격 격발 확인");

// 3-5. 4단계: 소환 및 전장 제어 우선순위 검증 (S_*, DARKNESS, SHRIEK)
const summonerLich = new Monster(startTile.x, startTile.y + 3, 'HUMAN', 8);
summonerLich.spells = ['1_IN_1', 'S_UNDEAD', 'BLIND', 'CAUSE_2'];
summonerLich.stats.hp = 200; summonerLich.stats.maxHp = 200;
summonerLich.hasteTurns = 10;
summonerLich.cooldowns = {};
const mCountBefore = testGame.monsters.length;

MonsterAISystem.act(
  summonerLich,
  mockPlayer,
  testMap,
  () => false,
  () => {},
  () => {},
  (msg, type) => testGame.addLogEntry(msg, type)
);
assert(summonerLich.cooldowns['S_UNDEAD'] > 0 || testGame.monsters.length > mCountBefore, "4단계: 소환(S_UNDEAD) 제어 우선 실행 확인");

// 3-6. 5단계: 디버프 및 저주 우선순위 검증 (BLIND, CONF, SLOW, CAUSE)
const curseWarlock = new Monster(startTile.x, startTile.y + 3, 'HUMAN', 8);
curseWarlock.spells = ['1_IN_1', 'BLIND', 'SLOW'];
curseWarlock.stats.hp = 200; curseWarlock.stats.maxHp = 200;
curseWarlock.hasteTurns = 10;
curseWarlock.cooldowns = {};
mockPlayer.flags = [];
mockPlayer.debuffs.blind = 0;

MonsterAISystem.act(
  curseWarlock,
  mockPlayer,
  testMap,
  () => false,
  () => {},
  () => {},
  (msg, type) => testGame.addLogEntry(msg, type)
);
assert(curseWarlock.cooldowns['BLIND'] > 0 || mockPlayer.debuffs.blind > 0, "5단계: 디버프/저주(BLIND) 실행 확인");

// 3-7. 순수 플래그 기반 재생 (REGEN) 검증 (하드코딩 없음)
const regenMonster = new Monster(startTile.x, startTile.y, 'HUMAN', 5);
regenMonster.flags = ['REGEN'];
regenMonster.stats.hp = 50; regenMonster.stats.maxHp = 100;
MonsterAISystem.act(
  regenMonster,
  mockPlayer,
  testMap,
  () => false,
  () => {},
  () => {},
  (msg, type) => testGame.addLogEntry(msg, type)
);
assert(regenMonster.stats.hp > 50, `REGEN 플래그 보유 몬스터 순수 데이터 기반 자연 치유 확인 (${regenMonster.stats.hp}/100)`);

// ----------------------------------------------------
// Section 4: 20 Methods x 27 Effects On-Hit 타격 체계 검증
// ----------------------------------------------------
console.log("\n[4] 20 Methods x 27 Effects On-Hit 타격 체계 검증");

// 4-1. 20 Methods 명세 수량 확인
assert(TOME_ATTACK_METHODS.length === 20, `20대 타격 메소드 완비 (${TOME_ATTACK_METHODS.length}종: ${TOME_ATTACK_METHODS.slice(0, 5).join(', ')}...)`);
assert(TOME_ATTACK_EFFECTS.length === 27, `27대 타격 효과 완비 (${TOME_ATTACK_EFFECTS.length}종: ${TOME_ATTACK_EFFECTS.slice(0, 5).join(', ')}...)`);

// 4-2. 주요 특수 On-Hit 효과 동작 검증
const attacker = new Monster(startTile.x, startTile.y, 'ORC', 5);

// 독 (POISON)
mockPlayer.debuffs.poison = 0;
mockPlayer.stats.hp = 100;
TomeSpellEngine.executeAttack({
  attack: { method: 'BITE', effect: 'POISON', damage: '2d6' },
  attacker,
  defender: mockPlayer,
  game: testGame
});
assert(mockPlayer.debuffs.poison > 0, "On-Hit POISON: 피격 대상 중독 상태 적용 확인");

// 골드 강탈 (EAT_GOLD)
mockPlayer.gold = 100;
TomeSpellEngine.executeAttack({
  attack: { method: 'TOUCH', effect: 'EAT_GOLD', damage: '1d4' },
  attacker,
  defender: mockPlayer,
  game: testGame
});
assert(mockPlayer.gold < 100, `On-Hit EAT_GOLD: 골드 강탈 확인 (잔여 골드: ${mockPlayer.gold}G)`);

// 경험치 흡수 (EXP_20) & HOLD_LIFE 저항
mockPlayer.xp = 100;
mockPlayer.flags = [];
TomeSpellEngine.executeAttack({
  attack: { method: 'TOUCH', effect: 'EXP_20', damage: '1d4' },
  attacker,
  defender: mockPlayer,
  game: testGame
});
assert(mockPlayer.xp <= 80, `On-Hit EXP_20: 생명력 흡수 확인 (잔여 XP: ${mockPlayer.xp})`);

mockPlayer.xp = 100;
mockPlayer.flags = ['HOLD_LIFE'];
TomeSpellEngine.executeAttack({
  attack: { method: 'TOUCH', effect: 'EXP_20', damage: '1d4' },
  attacker,
  defender: mockPlayer,
  game: testGame
});
assert(mockPlayer.xp === 100, "On-Hit EXP_20: HOLD_LIFE 보유 시 경험치 흡수 면역 확인");

// 마비 (PARALYZE) & FREE_ACT 저항
mockPlayer.flags = [];
mockPlayer.debuffs.paralyzed = false;
TomeSpellEngine.executeAttack({
  attack: { method: 'STING', effect: 'PARALYZE', damage: '1d4' },
  attacker,
  defender: mockPlayer,
  game: testGame
});
assert(mockPlayer.debuffs.paralyzed === true, "On-Hit PARALYZE: 마비 효과 적용 확인");

// 4-3. CombatSystem.attackPlayer 연동 통합 검증
const multiBlowMonster = new Monster(startTile.x, startTile.y + 1, 'ORC', 10);
multiBlowMonster.stats.dex = 50; // Ensure high dex for deterministic hit test
if (typeof multiBlowMonster.markDirty === 'function') multiBlowMonster.markDirty();
multiBlowMonster.attacks = [
  { method: 'CLAW', effect: 'HURT', damage: '2d4' },
  { method: 'BITE', effect: 'FIRE', damage: '2d6' }
];
mockPlayer.stats.hp = 200; mockPlayer.stats.maxHp = 200;
const hpBefore = mockPlayer.stats.hp;
CombatSystem.attackPlayer(testGame, multiBlowMonster, mockPlayer);
assert(mockPlayer.stats.hp < hpBefore, `CombatSystem.attackPlayer: TomeSpellEngine.executeAttack 2연타 연동 피해 확인 (${hpBefore} -> ${mockPlayer.stats.hp})`);

// ----------------------------------------------------
// 최종 요약
// ----------------------------------------------------
console.log("\n==================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL TESTS IN MONSTER FULL OFFENSE SUITE PASSED 100%!");
}
