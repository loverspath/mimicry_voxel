/**
 * scripts/test_ascii_theme.js
 * Retro ASCII Theme & 16-Color ANSI Terminal Palette Test Suite
 */

import {
  TERM_COLORS,
  ANSI_PALETTE_INDEX,
  TERMINAL_FONT_STACK,
  RETRO_GLOW_STYLES,
  getTermColor,
  getTermColorHex,
  ELEMENT_COLORS,
  RARITY_COLORS
} from '../src/configs/ThemeColors.js';

console.log("================================================================================");
console.log("📺 [RETRO ASCII THEME & 16-COLOR ANSI TERMINAL PALETTE TEST SUITE] 📺");
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
// TEST 1: ToME 2.3.5 Standard 16-Color ANSI Palette Verification
// -----------------------------------------------------------------------------
console.log("--- TEST 1: ToME 2.3.5 정통 16색 ANSI 터미널 팔레트 검증 ---");

const expectedColorKeys = [
  'TERM_DARK', 'TERM_WHITE', 'TERM_SLATE', 'TERM_ORANGE',
  'TERM_RED', 'TERM_GREEN', 'TERM_BLUE', 'TERM_UMBER',
  'TERM_L_DARK', 'TERM_L_WHITE', 'TERM_VIOLET', 'TERM_YELLOW',
  'TERM_L_RED', 'TERM_L_GREEN', 'TERM_L_BLUE', 'TERM_L_UMBER'
];

assert(Object.keys(TERM_COLORS).length === 16, `TERM_COLORS에 정통 16색 규격 등록 확인 (총 ${Object.keys(TERM_COLORS).length}색)`);

expectedColorKeys.forEach((key, idx) => {
  const hex = TERM_COLORS[key];
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(hex);
  assert(isValidHex, `  [Color ${idx}] ${key} = ${hex} 유효한 Hex 코드 확인`);
});

assert(ANSI_PALETTE_INDEX.length === 16, `ANSI_PALETTE_INDEX 16개 슬롯 순서 인덱스 배열 완비 확인`);

// -----------------------------------------------------------------------------
// TEST 2: Helper Functions & Index Lookups
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: 팔레트 헬퍼 함수 (getTermColor, getTermColorHex) 검증 ---");

assert(getTermColor('TERM_RED') === '#ef4444', `getTermColor('TERM_RED') -> '#ef4444' 반환 확인`);
assert(getTermColor('TERM_L_BLUE') === '#38bdf8', `getTermColor('TERM_L_BLUE') -> '#38bdf8' 반환 확인`);
assert(getTermColor('UNKNOWN_KEY') === '#ffffff', `미정의 키 조회 시 기본 '#ffffff' Fallback 확인`);

assert(getTermColorHex(0) === TERM_COLORS.TERM_DARK, `getTermColorHex(0) -> TERM_DARK (#000000) 반환 확인`);
assert(getTermColorHex(4) === TERM_COLORS.TERM_RED, `getTermColorHex(4) -> TERM_RED (#ef4444) 반환 확인`);
assert(getTermColorHex(14) === TERM_COLORS.TERM_L_BLUE, `getTermColorHex(14) -> TERM_L_BLUE (#38bdf8) 반환 확인`);
assert(getTermColorHex(999) === TERM_COLORS.TERM_L_UMBER, `초과 인덱스 클램핑 방어 확인`);

// -----------------------------------------------------------------------------
// TEST 3: Terminal Font Stack & Retro Glow Styles
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: 터미널 폰트 스택 및 레트로 CRT 글로우 스타일 검증 ---");

assert(TERMINAL_FONT_STACK.includes('Consolas'), `TERMINAL_FONT_STACK에 Consolas 포함 확인`);
assert(TERMINAL_FONT_STACK.includes('Fira Code'), `TERMINAL_FONT_STACK에 Fira Code 포함 확인`);
assert(TERMINAL_FONT_STACK.includes('monospace'), `TERMINAL_FONT_STACK에 monospace 포함 확인`);

assert(typeof RETRO_GLOW_STYLES.ambientCrt === 'string', `RETRO_GLOW_STYLES.ambientCrt 정의 확인`);
assert(typeof RETRO_GLOW_STYLES.playerGlow === 'string', `RETRO_GLOW_STYLES.playerGlow 정의 확인`);
assert(typeof RETRO_GLOW_STYLES.magicGlow === 'string', `RETRO_GLOW_STYLES.magicGlow 정의 확인`);

// -----------------------------------------------------------------------------
// TEST 4: Element & Rarity Palette Synchronization with ANSI
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: 7대 원소 및 4대 희귀도 ANSI 팔레트 동기화 검증 ---");

assert(ELEMENT_COLORS.FIRE === TERM_COLORS.TERM_RED, `원소 FIRE = TERM_RED (#ef4444) 동기화 확인`);
assert(ELEMENT_COLORS.COLD === TERM_COLORS.TERM_L_BLUE, `원소 COLD = TERM_L_BLUE (#38bdf8) 동기화 확인`);
assert(ELEMENT_COLORS.LIGHTNING === TERM_COLORS.TERM_YELLOW, `원소 LIGHTNING = TERM_YELLOW (#eab308) 동기화 확인`);
assert(ELEMENT_COLORS.ACID === TERM_COLORS.TERM_GREEN, `원소 ACID = TERM_GREEN (#22c55e) 동기화 확인`);

assert(RARITY_COLORS.normal === TERM_COLORS.TERM_L_WHITE, `희귀도 normal = TERM_L_WHITE (#e2e8f0) 동기화 확인`);
assert(RARITY_COLORS.uncommon === TERM_COLORS.TERM_L_GREEN, `희귀도 uncommon = TERM_L_GREEN (#4ade80) 동기화 확인`);
assert(RARITY_COLORS.rare === TERM_COLORS.TERM_L_BLUE, `희귀도 rare = TERM_L_BLUE (#38bdf8) 동기화 확인`);
assert(RARITY_COLORS.epic === TERM_COLORS.TERM_VIOLET, `희귀도 epic = TERM_VIOLET (#a855f7) 동기화 확인`);

console.log("\n================================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
