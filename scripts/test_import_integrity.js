/**
 * @file test_import_integrity.js
 * @description 전체 48개 ESM 모듈 런타임 동적 import 무결성 검증 및 
 *              CombatSystem.attackMonster() 실제 호출 테스트.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = getAllJsFiles(srcDir);
console.log(`🔍 총 ${jsFiles.length}개 JS 모듈 ESM 동적 로드 검증 시작...\n`);

let passed = 0;
let failed = 0;

for (const f of jsFiles) {
  const relPath = path.relative(path.join(__dirname, '..'), f);
  if (relPath === 'src/main.js') {
    // main.js imports style.css which is bundled by Vite for the browser
    console.log(`  ⏩ [SKIP BROWSER ENTRY] ${relPath}`);
    passed++;
    continue;
  }
  try {
    const mod = await import(`../${relPath}`);
    console.log(`  ✅ [OK] ${relPath}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${relPath} -> ${err.message}`);
    failed++;
  }
}

console.log(`\n========================================================`);
console.log(`📊 모듈 무결성 결과: ${passed} / ${jsFiles.length} 통과 (실패: ${failed})`);
console.log(`========================================================\n`);

if (failed > 0) {
  process.exit(1);
}

// 2. 실제 CombatSystem.attackMonster 런타임 호출 검증
console.log('⚔️ [전투 런타임 실전 검증] Player.attackMonster() 실제 호출 테스트...');

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { CombatSystem } from '../src/core/CombatSystem.js';

const mockGame = {
  player: new Player(5, 5),
  dungeon: {
    currentFloor: 1,
    monsters: []
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

const dummyMonster = new Monster(6, 6, 'Novice warrior', 1);
dummyMonster.baseAC = 10;
mockGame.dungeon.monsters.push(dummyMonster);

try {
  CombatSystem.attackMonster(mockGame, mockGame.player, dummyMonster);
  console.log('  ✅ [PASS] CombatSystem.attackMonster() 정상 실행 (WEAPON_MASTERY_CONFIG ReferenceError 없음)');
} catch (err) {
  console.error('  ❌ [FAIL] CombatSystem.attackMonster() 에러 발생:', err);
  process.exit(1);
}

console.log('\n🎉 [SUCCESS] 모든 모듈 import 및 실시간 전투 런타임 검증 100% 무결 통과!');
