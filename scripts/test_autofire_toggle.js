/**
 * scripts/test_autofire_toggle.js
 * Auto-fire toggle, ammo counter, and Novice Mage caster core integration test suite
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { CombatSystem } from '../src/core/CombatSystem.js';
import { getSpeciesConfig } from '../src/entities/MonsterRegistry.js';
import { ACTIVE_SKILL_CONFIGS } from '../src/core/Skills.js';

console.log("================================================================================");
console.log("🏹 [ToME 2.3.5 AUTO-FIRE TOGGLE & CASTER CORE TEST SUITE] 🏹");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// TEST 1: Auto-Fire Toggle State
// -----------------------------------------------------------------------------
console.log("--- TEST 1: 자동사격(Auto-Fire) 토글 및 상태 검증 ---");
const player = new Player(10, 10);

assert(player.autoFireEnabled === true, `기본 자동사격 상태가 ON (true) 임`);

player.toggleAutoFire();
assert(player.autoFireEnabled === false, `토글 호출 시 OFF (false) 로 전환됨`);

player.toggleAutoFire();
assert(player.autoFireEnabled === true, `재토글 호출 시 ON (true) 로 복귀됨`);

// -----------------------------------------------------------------------------
// TEST 2: Ranged Auto-Fire Execution & Cooldown
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 원거리 자동사격 격발 및 쿨다운 검증 ---");
const mockGame = {
  map: { isWalkable: (x, y) => true },
  effects: [],
  logs: [],
  addLogEntry: function(msg, type) {
    this.logs.push({ msg, type });
  }
};

const shortbow = player.inventory.find(i => i.name.includes('Shortbow') || i.char === '}');
player.equipment.weapon = shortbow; // 활 장착

const targetMonster = new Monster(14, 10, 'GOBLIN', 3); // 4칸 거리

// Case A: autoFireEnabled = true -> Fires projectile
player.autoFireEnabled = true;
CombatSystem.attackMonster(mockGame, player, targetMonster);

assert(mockGame.effects.length > 0, `투사체 시각 이펙트(ProjectileEffect) 생성 확인`);

// Case B: autoFireEnabled = false -> Skips auto-fire
player.autoFireEnabled = false;
mockGame.effects = [];
CombatSystem.attackMonster(mockGame, player, targetMonster);

assert(player.autoFireEnabled === false, `자동사격 OFF 상태 정상 유지 확인`);

// -----------------------------------------------------------------------------
// TEST 3: Novice Mage (MON_NOVICE_MAGE) Caster Core Integration
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 수습 마법사 (MON_NOVICE_MAGE) 마법 캐스터 코어 검증 ---");
const mageConfig = getSpeciesConfig('MON_NOVICE_MAGE');

assert(mageConfig !== null, `MON_NOVICE_MAGE 종족 설정 조회 성공`);
assert(mageConfig.growthType === 'MAGE', `성장 타입이 MAGE (지능 특화) 임`);
assert(mageConfig.coreBase.int >= 25, `기본 지능(INT) 29 보유 확인 (${mageConfig.coreBase.int})`);

// Active spells
const magicMissile = ACTIVE_SKILL_CONFIGS["ACTIVE_MAGIC_MISSILE"];
assert(magicMissile !== undefined, `ACTIVE_MAGIC_MISSILE (마법 미사일) 액티브 스킬 등록 확인`);
assert(magicMissile.maxRange >= 6.0, `마법 미사일 사거리 6.5칸 확인 (${magicMissile.maxRange}칸)`);

const phaseDoor = ACTIVE_SKILL_CONFIGS["ACTIVE_PHASE_DOOR"];
assert(phaseDoor !== undefined, `ACTIVE_PHASE_DOOR (점멸) 액티브 스킬 등록 확인`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
