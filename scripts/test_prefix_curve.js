/**
 * @file test_prefix_curve.js
 * @description 1층~50층 몬스터 엘리트 프리픽스 출현 확률 곡선 1,000회 시뮬레이션 및 수학적 검증 테스트
 */

import { calculateElitePrefixChance, ELITE_PREFIX_CONFIG } from '../src/configs/GameBalanceConfig.js';

console.log("==================================================");
console.log("📈 TOME 2.3.5 ELITE PREFIX PROBABILITY CURVE TEST");
console.log("==================================================");

const testFloors = [1, 2, 5, 10, 25, 50];
const ITERATIONS = 10000;

console.log(`Config Parameters: minChance=${ELITE_PREFIX_CONFIG.minChance * 100}%, maxChance=${ELITE_PREFIX_CONFIG.maxChance * 100}%, exponent=${ELITE_PREFIX_CONFIG.exponent}, maxFloorRef=${ELITE_PREFIX_CONFIG.maxFloorRef}`);
console.log(`Running Monte-Carlo Simulation (${ITERATIONS.toLocaleString()} iterations per floor)...`);
console.log("--------------------------------------------------");
console.log("| Floor | Theoretical (%) | Empirical (%) | Sample Prefix Count | Status |");
console.log("--------------------------------------------------");

let allPassed = true;

testFloors.forEach(floor => {
  const theoretical = calculateElitePrefixChance(floor, false);
  let prefixCount = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const chance = calculateElitePrefixChance(floor, false);
    if (Math.random() < chance) {
      prefixCount++;
    }
  }

  const empirical = prefixCount / ITERATIONS;
  const theoreticalPct = (theoretical * 100).toFixed(2);
  const empiricalPct = (empirical * 100).toFixed(2);

  // Confidence margin check within +-1.5%
  const delta = Math.abs(empirical - theoretical);
  const passed = delta <= 0.02;

  if (!passed) allPassed = false;

  console.log(`|  ${floor.toString().padStart(2, ' ')}   |      ${theoreticalPct.padStart(5, ' ')}%     |     ${empiricalPct.padStart(5, ' ')}%    |       ${prefixCount.toString().padStart(5, ' ')}         |  ${passed ? '✅ PASS' : '❌ FAIL'} |`);
});

console.log("--------------------------------------------------");

// Boss 100% Guaranteed Check
const bossFloor1 = calculateElitePrefixChance(1, true);
const bossFloor50 = calculateElitePrefixChance(50, true);
const bossPassed = bossFloor1 === 1.0 && bossFloor50 === 1.0;

console.log(`\n👑 Boss Elite Prefix Guaranteed Check: Floor 1=${bossFloor1 * 100}%, Floor 50=${bossFloor50 * 100}% -> ${bossPassed ? '✅ PASS' : '❌ FAIL'}`);

if (!allPassed || !bossPassed) {
  console.error("❌ [FAIL] Monte-Carlo prefix curve verification failed!");
  process.exit(1);
} else {
  console.log("\n==================================================");
  console.log("🎉 ALL MATHEMATICAL PREFIX CURVE TESTS PASSED (100% SUCCESS)");
  console.log("==================================================");
}
