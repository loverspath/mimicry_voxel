/**
 * scripts/test_balance_presets_and_hotbar.js
 * 단위 테스트:
 * 1. BalancePresets.js 4대 밸런스 프리셋 정밀 수치 및 헬퍼 검증
 * 2. BalanceModifierManager.js 프리셋 전환, 커스텀 오버라이드 병합, 불변 동결, EventBus 이벤트 브로드캐스팅, 직렬화/역직렬화 검증
 * 3. SkillHotbarView.js 및 renderSkillHotbarHTML 4대 슬롯 실시간 렌더링(Ready, Cooldown, Locked, Empty) 검증
 * 4. GameStartPresetModalView.js 및 renderPresetModalHTML 모달 마크업 및 파라미터 렌더링 검증
 * 5. SaveSystem 세이브/로드 직렬화 무결성 및 isJokeMonster 동적 밸런스 연동 검증
 * 6. experimental.html / experimental_main.js / experimental_style.css 독립 파일 무결성 검증
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { BALANCE_PRESET_TYPES, BALANCE_PRESETS, getPresetConfig } from '../src/configs/BalancePresets.js';
import { BalanceModifierManager, balanceModifierManager } from '../src/systems/BalanceModifierManager.js';
import { renderSkillHotbarHTML, SkillHotbarView } from '../src/ui/SkillHotbarView.js';
import { renderPresetModalHTML, GameStartPresetModalView } from '../src/ui/GameStartPresetModalView.js';
import { eventBus } from '../src/events/EventBus.js';
import { GameEvents } from '../src/events/GameEvents.js';
import { SaveSystem } from '../src/core/SaveSystem.js';
import { isJokeMonster } from '../src/configs/GameBalanceConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log("================================================================================");
console.log("⚖️ [DYNAMIC BALANCE PRESET ENGINE & SKILL HOTBAR TEST SUITE] ⚖️");
console.log("================================================================================");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: BalancePresets.js 4대 프리셋 명세 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: BalancePresets.js 4대 프리셋 및 기본 수치 검증 ---");

assert(BALANCE_PRESET_TYPES.CLASSIC_TOME === 'CLASSIC_TOME', "BALANCE_PRESET_TYPES.CLASSIC_TOME 정의 확인");
assert(BALANCE_PRESET_TYPES.CASUAL_EXPLORER === 'CASUAL_EXPLORER', "BALANCE_PRESET_TYPES.CASUAL_EXPLORER 정의 확인");
assert(BALANCE_PRESET_TYPES.CHAOS_VOXEL === 'CHAOS_VOXEL', "BALANCE_PRESET_TYPES.CHAOS_VOXEL 정의 확인");
assert(BALANCE_PRESET_TYPES.NIGHTMARE_ABYSS === 'NIGHTMARE_ABYSS', "BALANCE_PRESET_TYPES.NIGHTMARE_ABYSS 정의 확인");

const classic = BALANCE_PRESETS.CLASSIC_TOME;
assert(classic && classic.id === 'CLASSIC_TOME', "CLASSIC_TOME 프리셋 객체 로드 확인");
assert(classic.spawn.allowJokeMonsters === false, "CLASSIC_TOME: 조크 몬스터 비허용 (false)");
assert(classic.spawn.monsterDensityMultiplier === 1.0, "CLASSIC_TOME: 몬스터 밀도 1.0x");
assert(classic.loot.itemDropMultiplier === 1.0, "CLASSIC_TOME: 아이템 드랍률 1.0x");
assert(classic.gameplay.deathPenaltyMode === 'PERMADEATH', "CLASSIC_TOME: 사망 룰 PERMADEATH");
assert(classic.gameplay.cooldownRecoveryMultiplier === 1.0, "CLASSIC_TOME: 쿨다운 회복 배율 1.0x");

const casual = BALANCE_PRESETS.CASUAL_EXPLORER;
assert(casual && casual.id === 'CASUAL_EXPLORER', "CASUAL_EXPLORER 프리셋 객체 로드 확인");
assert(casual.gameplay.deathPenaltyMode === 'CHECKPOINT', "CASUAL_EXPLORER: 사망 룰 CHECKPOINT");
assert(casual.spawn.oodRollChanceCap === 0.00, "CASUAL_EXPLORER: 저층 OOD 확률 0%");
assert(casual.loot.itemDropMultiplier === 2.0, "CASUAL_EXPLORER: 아이템 드랍률 2.0x");
assert(casual.gameplay.cooldownRecoveryMultiplier === 1.5, "CASUAL_EXPLORER: 쿨다운 회복 1.5x");
assert(casual.gameplay.playerDamageReductionBonus === 0.20, "CASUAL_EXPLORER: 피해 경감 +20%");

const chaos = BALANCE_PRESETS.CHAOS_VOXEL;
assert(chaos && chaos.id === 'CHAOS_VOXEL', "CHAOS_VOXEL 프리셋 객체 로드 확인");
assert(chaos.spawn.allowJokeMonsters === true, "CHAOS_VOXEL: 조크 몬스터 100% 개방 (true)");
assert(chaos.spawn.monsterDensityMultiplier === 2.2, "CHAOS_VOXEL: 몬스터 밀도 2.2x");
assert(chaos.loot.itemDropMultiplier === 3.5, "CHAOS_VOXEL: 아이템 드랍률 3.5x");
assert(chaos.gameplay.cooldownRecoveryMultiplier === 2.0, "CHAOS_VOXEL: 쿨다운 회복 2.0x");

const nightmare = BALANCE_PRESETS.NIGHTMARE_ABYSS;
assert(nightmare && nightmare.id === 'NIGHTMARE_ABYSS', "NIGHTMARE_ABYSS 프리셋 객체 로드 확인");
assert(nightmare.gameplay.deathPenaltyMode === 'IRONMAN', "NIGHTMARE_ABYSS: 사망 룰 IRONMAN");
assert(nightmare.loot.itemDropMultiplier === 0.6, "NIGHTMARE_ABYSS: 아이템 드랍률 0.6x");
assert(nightmare.gameplay.cooldownRecoveryMultiplier === 0.8, "NIGHTMARE_ABYSS: 쿨다운 회복 0.8x");
assert(nightmare.gameplay.playerDamageReductionBonus === -0.15, "NIGHTMARE_ABYSS: 추가 피격 패널티 -15%");

// getPresetConfig fallback
assert(getPresetConfig('UNKNOWN_PRESET').id === 'CLASSIC_TOME', "알 수 없는 프리셋 요청 시 CLASSIC_TOME 기본값 폴백");

// -----------------------------------------------------------------------------
// TEST 2: BalanceModifierManager.js 상태 관리 및 불변성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: BalanceModifierManager.js 프리셋 전환/오버라이드/불변성/이벤트 검증 ---");

const manager = new BalanceModifierManager();
const initialConfig = manager.getActiveConfig();
assert(initialConfig.presetId === 'CLASSIC_TOME', "매니저 초기 프리셋 CLASSIC_TOME 확인");
assert(Object.isFrozen(initialConfig), "activeConfig 불변 동결(Object.isFrozen) 검증");
assert(Object.isFrozen(initialConfig.spawn), "activeConfig.spawn 서브 객체 불변 동결 검증");
assert(Object.isFrozen(initialConfig.loot), "activeConfig.loot 서브 객체 불변 동결 검증");

// EventBus 구독 검증
let eventEmittedCount = 0;
let lastEmittedConfig = null;
const unsubscribe = eventBus.on(GameEvents.BALANCE_CONFIG_CHANGED, (data) => {
  eventEmittedCount++;
  lastEmittedConfig = data.config;
});

// 프리셋 전환
manager.setPreset('CHAOS_VOXEL');
const chaosConfig = manager.getActiveConfig();
assert(chaosConfig.presetId === 'CHAOS_VOXEL', "CHAOS_VOXEL 전환 확인");
assert(chaosConfig.spawn.allowJokeMonsters === true, "전환 후 allowJokeMonsters === true 반영 확인");
assert(eventEmittedCount >= 1, "프리셋 전환 시 EventBus BALANCE_CONFIG_CHANGED 이벤트 수신 확인");
assert(lastEmittedConfig && lastEmittedConfig.presetId === 'CHAOS_VOXEL', "이벤트 페이로드에 최신 설정 반영 확인");

// 커스텀 오버라이드
manager.setCustomOverride('loot', 'itemDropMultiplier', 9.9);
const overrideConfig = manager.getActiveConfig();
assert(overrideConfig.loot.itemDropMultiplier === 9.9, "커스텀 오버라이드 9.9 반영 확인");
assert(overrideConfig.spawn.allowJokeMonsters === true, "기존 프리셋의 다른 필드 보존 확인");

// 커스텀 오버라이드 일괄 적용
manager.setCustomOverrides({
  spawn: { monsterDensityMultiplier: 3.5 },
  gameplay: { deathPenaltyMode: 'CHECKPOINT' }
});
const batchConfig = manager.getActiveConfig();
assert(batchConfig.spawn.monsterDensityMultiplier === 3.5, "일괄 오버라이드 monsterDensityMultiplier 3.5 반영");
assert(batchConfig.gameplay.deathPenaltyMode === 'CHECKPOINT', "일괄 오버라이드 deathPenaltyMode CHECKPOINT 반영");
assert(batchConfig.loot.itemDropMultiplier === 9.9, "이전 오버라이드 유지 확인");

// 오버라이드 초기화
manager.resetCustomOverrides();
const resetConfig = manager.getActiveConfig();
assert(resetConfig.loot.itemDropMultiplier === 3.5, "오버라이드 리셋 후 CHAOS_VOXEL 기본 드랍률(3.5) 복원 확인");

// 직렬화 및 역직렬화
manager.setPreset('CASUAL_EXPLORER');
manager.setCustomOverride('gameplay', 'cooldownRecoveryMultiplier', 2.5);
const serialized = manager.serialize();
assert(serialized.presetId === 'CASUAL_EXPLORER', "직렬화 presetId 확인");
assert(serialized.customOverrides.gameplay.cooldownRecoveryMultiplier === 2.5, "직렬화 커스텀 오버라이드 보존 확인");

const restoreManager = new BalanceModifierManager();
restoreManager.deserialize(serialized);
const restoredConfig = restoreManager.getActiveConfig();
assert(restoredConfig.presetId === 'CASUAL_EXPLORER', "역직렬화 후 presetId 복원 확인");
assert(restoredConfig.gameplay.cooldownRecoveryMultiplier === 2.5, "역직렬화 후 커스텀 오버라이드 복원 확인");

unsubscribe();

// -----------------------------------------------------------------------------
// TEST 3: SkillHotbarView.js 및 renderSkillHotbarHTML 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: SkillHotbarView.js 및 renderSkillHotbarHTML 마크업 검증 ---");

const emptyMarkup = renderSkillHotbarHTML(null);
assert(emptyMarkup.includes('스킬 정보 없음'), "null 플레이어 전달 시 안전 폴백 마크업 출력");

// Mock Player with 4 Active Skills
const mockPlayer = {
  mimicCore: { coreType: 'MON_IMP', name: '임프' },
  getMorphMasteryLevel: () => 5,
  getTracker: (id, field) => {
    if (id === 'SKILL_BOLT' && field === 'cooldown') return 0; // Ready
    if (id === 'SKILL_FIRE' && field === 'cooldown') return 4; // On Cooldown
    return 0;
  },
  getInnateSkills: () => [
    {
      id: 'SKILL_BOLT',
      slot: 1,
      name: '마력 화살',
      icon: '✨',
      color: '#38bdf8',
      cooldown: 2,
      maxRange: 5,
      requiredMastery: 1,
      isUnlocked: () => true,
      getEffectiveCooldown: () => 2
    },
    {
      id: 'SKILL_FIRE',
      slot: 2,
      name: '화염구',
      icon: '🔥',
      color: '#f97316',
      cooldown: 5,
      maxRange: 4,
      requiredMastery: 1,
      isUnlocked: () => true,
      getEffectiveCooldown: () => 5
    },
    {
      id: 'SKILL_METEOR',
      slot: 3,
      name: '메테오 스트라이크',
      icon: '☄️',
      color: '#ef4444',
      cooldown: 12,
      maxRange: 6,
      requiredMastery: 20, // Locked (current mastery 5 < 20)
      isUnlocked: () => false,
      getEffectiveCooldown: () => 12
    }
    // Slot 4 is null (Empty)
  ]
};

const hotbarHtml = renderSkillHotbarHTML(mockPlayer);

assert(hotbarHtml.includes('data-slot="1"'), "슬롯 1 데이터 속성 포함 확인");
assert(hotbarHtml.includes('skill-slot slot-1 ready'), "슬롯 1 (마력 화살) ready 상태 클래스 부여 확인");
assert(hotbarHtml.includes('✨'), "슬롯 1 아이콘(✨) 렌더링 확인");

assert(hotbarHtml.includes('data-slot="2"'), "슬롯 2 데이터 속성 포함 확인");
assert(hotbarHtml.includes('skill-slot slot-2 on-cooldown'), "슬롯 2 (화염구) on-cooldown 상태 클래스 부여 확인");
assert(hotbarHtml.includes('cd-number">4<'), "슬롯 2 잔여 쿨다운(4) 숫자 오버레이 출력 확인");

assert(hotbarHtml.includes('data-slot="3"'), "슬롯 3 데이터 속성 포함 확인");
assert(hotbarHtml.includes('skill-slot slot-3 locked'), "슬롯 3 (메테오) locked 상태 클래스 부여 확인");
assert(hotbarHtml.includes('Lv.20'), "슬롯 3 요구 숙련도(Lv.20) 잠금 오버레이 출력 확인");

assert(hotbarHtml.includes('skill-slot empty') && hotbarHtml.includes('data-slot="4"'), "슬롯 4 empty 상태 슬롯 렌더링 확인");

// SkillHotbarView instance headless check
const hotbarView = new SkillHotbarView('test-container');
assert(hotbarView.containerId === 'test-container', "SkillHotbarView 인스턴스 초기화 확인");
hotbarView.init();
hotbarView.setVisible(true);
hotbarView.destroy();

// -----------------------------------------------------------------------------
// TEST 4: GameStartPresetModalView.js 및 renderPresetModalHTML 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: GameStartPresetModalView.js 및 renderPresetModalHTML 마크업 검증 ---");

const modalHtml = renderPresetModalHTML(BALANCE_PRESET_TYPES.CLASSIC_TOME);

assert(modalHtml.includes('data-preset-id="CLASSIC_TOME"'), "CLASSIC_TOME 프리셋 카드 마크업 포함 확인");
assert(modalHtml.includes('data-preset-id="CASUAL_EXPLORER"'), "CASUAL_EXPLORER 프리셋 카드 마크업 포함 확인");
assert(modalHtml.includes('data-preset-id="CHAOS_VOXEL"'), "CHAOS_VOXEL 프리셋 카드 마크업 포함 확인");
assert(modalHtml.includes('data-preset-id="NIGHTMARE_ABYSS"'), "NIGHTMARE_ABYSS 프리셋 카드 마크업 포함 확인");

assert(modalHtml.includes('id="mod-monster-density"'), "몬스터 밀도 조절 슬라이더 마크업 확인");
assert(modalHtml.includes('id="mod-item-drop"'), "아이템 드랍 조절 슬라이더 마크업 확인");
assert(modalHtml.includes('id="mod-cd-recovery"'), "쿨다운 회복 속도 슬라이더 마크업 확인");
assert(modalHtml.includes('id="mod-death-penalty"'), "사망 패널티 셀렉트 박스 마크업 확인");
assert(modalHtml.includes('id="mod-joke-monsters"'), "조크 몬스터 토글 스위치 마크업 확인");
assert(modalHtml.includes('id="btn-preset-confirm"'), "확정 및 적용 버튼 마크업 확인");

const modalView = new GameStartPresetModalView('test-modal-root');
assert(modalView.modalId === 'test-modal-root', "GameStartPresetModalView 인스턴스 초기화 확인");
modalView.init();
modalView.close();

// -----------------------------------------------------------------------------
// TEST 5: SaveSystem & isJokeMonster 연동 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: SaveSystem 및 isJokeMonster 동적 밸런스 연동 검증 ---");

balanceModifierManager.setPreset('NIGHTMARE_ABYSS');

const mockGame = {
  floor: 3,
  floorDanger: 5,
  player: {
    x: 10, y: 12, level: 3, xp: 120, xpNeeded: 200,
    baseStats: {}, legacyStats: {}, attackCount: 1, debuffs: {}, statuses: {},
    autoFireEnabled: true, stats: { hp: 25, maxHp: 30 },
    mimicCore: { name: '인간', coreType: 'HUMAN' },
    animationTime: 0, energy: 100, playerBreathCooldown: 0,
    inventory: [], equipment: {}
  },
  uniqueMonsterManager: { serialize: () => ({}), deserialize: () => {} },
  items: [],
  monsters: [],
  map: { width: 40, height: 40, floor: 3, startingPosition: { x: 5, y: 5 }, rooms: [] }
};

const saveJson = SaveSystem.serialize(mockGame);
const parsedSave = JSON.parse(saveJson);

assert(parsedSave.balance !== undefined && parsedSave.balance !== null, "세이브 데이터에 balance 필드 직렬화 확인");
assert(parsedSave.balance.presetId === 'NIGHTMARE_ABYSS', "세이브된 프리셋 ID가 NIGHTMARE_ABYSS로 정확히 보존됨");

// SaveSystem.deserialize 검증
balanceModifierManager.setPreset('CLASSIC_TOME'); // 강제로 다른 값으로 변경
assert(balanceModifierManager.getActiveConfig().presetId === 'CLASSIC_TOME', "테스트를 위해 CLASSIC_TOME으로 일시 변경");

SaveSystem.deserialize(mockGame, parsedSave);
assert(balanceModifierManager.getActiveConfig().presetId === 'NIGHTMARE_ABYSS', "세이브 복원 시 balanceModifierManager가 NIGHTMARE_ABYSS로 자동 복구됨");

// isJokeMonster 동적 연동 검증
const bunnyGirlMonster = { flags: ['JOKEANGBAND'], name: '바니걸' };

balanceModifierManager.setPreset('CLASSIC_TOME');
assert(isJokeMonster(bunnyGirlMonster) === true, "CLASSIC_TOME에서는 바니걸이 조크 몬스터로 차단됨 (true)");

balanceModifierManager.setPreset('CHAOS_VOXEL');
assert(isJokeMonster(bunnyGirlMonster) === false, "CHAOS_VOXEL에서는 바니걸이 조크 몬스터 차단 해제됨 (false, 출현 허용)");

// -----------------------------------------------------------------------------
// TEST 6: 독립 실행형 실험적 포크 파일 무결성 검증
// -----------------------------------------------------------------------------
console.log("\n--- TEST 6: experimental.html / experimental_main.js / experimental_style.css 무결성 검증 ---");

const expHtmlPath = path.join(projectRoot, 'experimental.html');
const expMainPath = path.join(projectRoot, 'experimental_main.js');
const expCssPath = path.join(projectRoot, 'experimental_style.css');

assert(fs.existsSync(expHtmlPath), "experimental.html 파일 존재 확인");
assert(fs.existsSync(expMainPath), "experimental_main.js 파일 존재 확인");
assert(fs.existsSync(expCssPath), "experimental_style.css 파일 존재 확인");

const expHtmlContent = fs.readFileSync(expHtmlPath, 'utf8');
assert(expHtmlContent.includes('experimental_style.css'), "experimental.html이 experimental_style.css 참조 확인");
assert(expHtmlContent.includes('experimental_main.js'), "experimental.html이 experimental_main.js 모듈 참조 확인");
assert(expHtmlContent.includes('skill-hotbar-container'), "experimental.html 내 skill-hotbar-container 마운트 확인");
assert(expHtmlContent.includes('hud-status-chips-bar'), "experimental.html 내 hud-status-chips-bar 마운트 확인");
assert(expHtmlContent.includes('low-hp-vignette'), "experimental.html 내 low-hp-vignette 마운트 확인");
assert(expHtmlContent.includes('game-start-preset-modal-root'), "experimental.html 내 game-start-preset-modal-root 마운트 확인");

const expCssContent = fs.readFileSync(expCssPath, 'utf8');
assert(expCssContent.includes('.skill-hotbar-root'), "experimental_style.css 내 스킬 핫바 스타일 정의 확인");
assert(expCssContent.includes('.low-hp-vignette'), "experimental_style.css 내 저체력 비네팅 스타일 정의 확인");
assert(expCssContent.includes('.hud-status-chips-bar'), "experimental_style.css 내 실시간 상태 칩 스타일 정의 확인");
assert(expCssContent.includes('.preset-modal-container'), "experimental_style.css 내 프리셋 모달 스타일 정의 확인");

// 기존 index.html 보존 확인
const indexHtmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
assert(indexHtmlContent.includes('main.js'), "기존 index.html이 훼손되지 않고 main.js를 온전히 보존하고 있음 확인");

// 프리셋을 기본 CLASSIC_TOME으로 재설정
balanceModifierManager.setPreset('CLASSIC_TOME');

console.log("\n================================================================================");
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
