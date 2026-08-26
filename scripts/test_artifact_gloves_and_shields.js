/**
 * @file test_artifact_gloves_and_shields.js
 * @description Cammithrim을 포함한 ToME 2.3.5 전설 유물 장갑 10종 및 전설 방패 5종의
 *              GLOVES/SHIELD 타입 전수 검증 및 ItemRegistry / Spawner / Player 연동 검증.
 */

import { TOME_ARTIFACTS_DATA } from '../src/entities/TomeArtifactsData.js';
import { createTomeItem, TOME_ARTIFACTS } from '../src/entities/ItemRegistry.js';
import { Player } from '../src/entities/Player.js';

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
console.log('🧪 [TEST SUITE 1] ToME 전설 유물 장갑 10종 GLOVES 타입/슬롯타입/심볼 전수 검증');
console.log('🧪 ========================================================');

const ARTIFACT_GLOVES = [
  'ART_CAMMITHRIM',
  'ART_CAMBELEG',
  'ART_PAURHACH',
  'ART_PAURNIMMEN',
  'ART_PAURAEGEN',
  'ART_PAURNEN',
  'ART_CAMLOST',
  'ART_OF_FINGOLFIN',
  'ART_OF_EOL',
  'ART_SKYCLEAVER'
];

for (const key of ARTIFACT_GLOVES) {
  const art = TOME_ARTIFACTS_DATA[key];
  assert(art !== undefined, `유물 장갑 [${key}] 데이터셋 존재`);
  assert(art.type === 'GLOVES', `유물 장갑 [${key}] type === 'GLOVES'`);
  assert(art.slotType === 'GLOVES', `유물 장갑 [${key}] slotType === 'GLOVES'`);
  assert(art.char === ']', `유물 장갑 [${key}] char === ']'`);
}

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 2] ToME 전설 유물 방패 5종 SHIELD 타입/슬롯타입/심볼 전수 검증');
console.log('🧪 ========================================================');

const ARTIFACT_SHIELDS = [
  'ART_OF_THORIN',
  'ART_OF_CELEGORM',
  'ART_OF_ANARION',
  'ART_OF_GIL_GALAD',
  'ART_OF_THE_HARADRIM'
];

for (const key of ARTIFACT_SHIELDS) {
  const art = TOME_ARTIFACTS_DATA[key];
  assert(art !== undefined, `유물 방패 [${key}] 데이터셋 존재`);
  assert(art.type === 'SHIELD', `유물 방패 [${key}] type === 'SHIELD'`);
  assert(art.slotType === 'SHIELD', `유물 방패 [${key}] slotType === 'SHIELD'`);
  assert(art.char === ')', `유물 방패 [${key}] char === ')'`);
}

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 3] ItemRegistry.createTomeItem 인스턴스화 및 세이프가드 검증');
console.log('🧪 ========================================================');

const cammithrimItem = createTomeItem('ART_CAMMITHRIM');
assert(cammithrimItem !== null, 'createTomeItem("ART_CAMMITHRIM") 인스턴스 생성 성공');
assert(cammithrimItem.type === 'GLOVES', 'Cammithrim 인스턴스 type === "GLOVES"');
assert(cammithrimItem.slotType === 'GLOVES', 'Cammithrim 인스턴스 slotType === "GLOVES"');
assert(cammithrimItem.char === ']', 'Cammithrim 인스턴스 char === "]"');
assert(cammithrimItem.baseAC === 11, 'Cammithrim 기본 방어력(baseAC: 11) 정상 탑재');

const thorinItem = createTomeItem('ART_OF_THORIN');
assert(thorinItem !== null, 'createTomeItem("ART_OF_THORIN") 인스턴스 생성 성공');
assert(thorinItem.type === 'SHIELD', 'Thorin 방패 인스턴스 type === "SHIELD"');
assert(thorinItem.slotType === 'SHIELD', 'Thorin 방패 인스턴스 slotType === "SHIELD"');
assert(thorinItem.char === ')', 'Thorin 방패 인스턴스 char === ")"');

console.log('\n🧪 ========================================================');
console.log('🧪 [TEST SUITE 4] Cammithrim 장갑 + Thorin 방패 실시간 장착 및 AC 합산 검증');
console.log('🧪 ========================================================');

const player = new Player(5, 5);
const initialAC = player.getTotalAC();

player.equipItem(cammithrimItem);
assert(player.equipment.gloves === cammithrimItem, 'Cammithrim 장착 시 player.equipment.gloves에 장착됨');
assert(player.equipment.armor !== null, 'Cammithrim 장착 시 기존 갑옷 슬롯(armor)이 해제되지 않고 동시 착용 유지됨');
assert(player.getTotalAC() === initialAC + 11, `Cammithrim 장착 후 플레이어 총 AC가 +11 증가 (${initialAC} -> ${player.getTotalAC()})`);

player.equipItem(thorinItem);
assert(player.equipment.shield === thorinItem, 'Thorin 방패 장착 시 player.equipment.shield에 장착됨');
assert(player.equipment.weapon !== null, 'Thorin 방패 장착 시 기존 무기 슬롯(weapon)이 해제되지 않고 검+방패 동시 착용 유지됨');
assert(player.equipment.gloves === cammithrimItem, 'Thorin 방패 장착 후에도 Cammithrim 장갑 유지됨');

console.log('\n========================================================');
console.log(`🎉 [ARTIFACT AUDIT RESULTS] ${passed} / ${total} 통과 (${Math.round((passed/total)*100)}%)`);
console.log('========================================================');
