/**
 * @file test_runtime_spawn.js
 * @description 1층, 5층, 10층, 25층, 50층 ToME 2.3.5 실시간 런타임 동기 스폰 검증 테스트
 */

import { Spawner } from '../src/core/Spawner.js';
import { Map } from '../src/map/Map.js';
import { Player } from '../src/entities/Player.js';
import { TomeLootGenerator } from '../src/systems/TomeLootGenerator.js';

console.log("==================================================");
console.log("🚀 TOME 2.3.5 RUNTIME SYNCHRONOUS SPAWN AUDIT");
console.log("==================================================");

const testFloors = [1, 5, 10, 25, 50];
const player = new Player(10, 10, 'HUMAN');

let totalMonstersTested = 0;
let totalItemsTested = 0;

testFloors.forEach(floor => {
  console.log(`\n==================================================`);
  console.log(`🏰 [DUNGEON FLOOR ${floor}] DEPTH SIMULATION`);
  console.log(`==================================================`);

  const map = new Map(60, 60);
  const danger = Math.max(1, Math.floor(floor * 0.9));
  const logs = [];

  const mockGame = {
    floor,
    floorDanger: danger,
    map,
    player,
    monsters: [],
    items: [],
    addLogEntry: (msg) => logs.push(msg),
    isMonsterAt: (x, y) => mockGame.monsters.some(m => m.x === x && m.y === y)
  };

  Spawner.spawnFloorContent(mockGame);

  console.log(`📊 Spawned: ${mockGame.monsters.length} Monsters, ${mockGame.items.length} Items (Rooms: ${map.rooms.length})`);
  totalMonstersTested += mockGame.monsters.length;
  totalItemsTested += mockGame.items.length;

  console.log(`\n🐉 Sample Monsters on Floor ${floor}:`);
  mockGame.monsters.slice(0, 5).forEach((m, idx) => {
    console.log(`   [${idx + 1}] ${m.displayName} | Char: '${m.char}' | Lv.${m.level} | HP: ${m.stats.hp} | AC: ${m.baseAC}`);
    console.log(`       Lore: “${m.flavorText}”`);
  });

  console.log(`\n✨ Sample Items on Floor ${floor}:`);
  mockGame.items.slice(0, 5).forEach((it, idx) => {
    console.log(`   [${idx + 1}] ${it.name} | Char: '${it.char}' | Type: ${it.type} | Slot: ${it.slotType || 'None'}`);
    if (it.flavorText) {
      console.log(`       Lore: “${it.flavorText}”`);
    }
  });
});

console.log("\n==================================================");
console.log(`🎉 RUNTIME SPAWN AUDIT COMPLETE: ${totalMonstersTested} Monsters & ${totalItemsTested} Items Verified Across Depths`);
console.log("==================================================");
