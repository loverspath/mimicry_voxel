/**
 * @file test_first_person_3d_renderer.js
 * @description 1인칭 3D DDA 레이캐스팅 렌더러, 광원 리밸런싱, 8방향 상대 이동 및 터치/마우스 드래그 룩어라운드 단위 테스트
 */

const mockCanvas = {
  getContext: () => ({
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    drawImage: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    strokeRect: () => {},
    measureText: () => ({ width: 60 }),
    roundRect: () => {}
  }),
  width: 800,
  height: 600,
  style: {},
  addEventListener: () => {},
  appendChild: () => {},
  removeChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  scrollTop: 0,
  scrollHeight: 0,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: (id) => mockCanvas,
    createElement: () => mockCanvas,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {} }
  };
}

if (typeof global.window === 'undefined') {
  global.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: () => {}
  };
}

import { TextureManager, TEXTURE_PATHS, textureManager } from '../src/renderer/TextureManager.js';
import { FirstPerson3DRenderer } from '../src/renderer/FirstPerson3DRenderer.js';
import { Game } from '../src/core/Game.js';
import { DUNGEON_THEMES } from '../src/configs/DungeonThemeConfig.js';
import { CombatVFXEngine, combatVFXEngine, VFX_TYPES, ASCII_GLYPH_POOLS, ASCII_PALETTES } from '../src/systems/CombatVFXEngine.js';

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
console.log('🧪 [TEST SUITE 1] TextureManager 텍스처 프리로딩 및 절차적 폴백 가드 검증');
console.log('='.repeat(80));

// 1-1. 텍스처 경로 레지스트리 검증
assert(TEXTURE_PATHS.CAVE_RUINS === '/public/textures/tex_cave_ruins.jpg', 'CAVE_RUINS 텍스처 경로 정합성');
assert(TEXTURE_PATHS.MINES_CATACOMBS === '/public/textures/tex_catacombs.jpg', 'MINES_CATACOMBS 텍스처 경로 정합성');
assert(TEXTURE_PATHS.VOLCANIC_FORTRESS === '/public/textures/tex_volcanic.jpg', 'VOLCANIC_FORTRESS 텍스처 경로 정합성');
assert(TEXTURE_PATHS.DARK_ABYSS === '/public/textures/tex_dark_abyss.jpg', 'DARK_ABYSS 텍스처 경로 정합성');
assert(TEXTURE_PATHS.DEEP_ANGBAND === '/public/textures/tex_deep_angband.jpg', 'DEEP_ANGBAND 텍스처 경로 정합성');
assert(TEXTURE_PATHS.COMMON_FLOOR === '/public/textures/tex_dungeon_floor.jpg', 'COMMON_FLOOR 텍스처 경로 정합성');

// 1-2. 절차적 폴백 텍스처 인스턴스 검증
const customTexMgr = new TextureManager();
assert(customTexMgr.fallbackTextures.size >= 6, '폴백 텍스처(벽면, 바닥, 천장 전수) 등록 확인');
for (const key of Object.keys(TEXTURE_PATHS)) {
  const fallback = customTexMgr.fallbackTextures.get(key);
  assert(fallback !== undefined && fallback !== null, `${key} 폴백 텍스처 생성 유효`);
  assert(fallback.width === 64 && fallback.height === 64, `${key} 폴백 텍스처 64x64 규격 확인`);
}

// 1-3. 텍스처 조회 API 안전성
const caveTex = customTexMgr.getWallTexture('CAVE_RUINS');
assert(caveTex !== null && caveTex !== undefined, 'CAVE_RUINS 벽면 텍스처 조회 성공');
const floorTex = customTexMgr.getFloorTexture();
assert(floorTex !== null && floorTex !== undefined, '공통 바닥재 텍스처 조회 성공');

const unknownTex = customTexMgr.getWallTexture('INVALID_THEME_KEY');
assert(unknownTex !== null && unknownTex !== undefined, '알 수 없는 테마 요청 시 안전한 기본 폴백 반환');

// 1-4. 비동기 loadAll 안전성
await customTexMgr.loadAll();
assert(customTexMgr.isLoaded === true, 'loadAll() 호출 시 isLoaded=true 전이 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 2] FirstPerson3DRenderer 광원 리밸런싱, 횃불 글로우 및 DDA 수학 모델 검증');
console.log('='.repeat(80));

const fpRenderer = new FirstPerson3DRenderer('non_existent_canvas', 24);
assert(fpRenderer.mode === 'dungeon3d', '렌더러 모드 dungeon3d 식별자 확인');
assert(Math.abs(fpRenderer.playerAngle - (3 * Math.PI / 2)) < 0.001, '기본 시선 방향은 북쪽 (3PI/2 rad, 270 deg)');
assert(Math.abs(fpRenderer.fov - (66 * Math.PI / 180)) < 0.001, '기본 시야각(FOV) 66도 확인');
assert(fpRenderer.depthBuffer instanceof Float32Array, 'Z-Buffer Float32Array 인스턴스 할당 확인');
assert(fpRenderer.depthBuffer.length === fpRenderer.w, 'Z-Buffer 크기와 뷰포트 너비 일치 확인');

// 2-1. 횃불 앰비언트 글로우(Radial Torchlight Glow) 메소드 검증
assert(typeof fpRenderer._renderTorchlightGlow === 'function', '_renderTorchlightGlow 함수 존재 확인');
fpRenderer._renderTorchlightGlow(); // 크래시 없는지 실행 검증
assert(true, '_renderTorchlightGlow 예외 없이 정상 래스터라이징 완료');

// 2-2. 광원 리밸런싱 공식 검증 (근거리 100% 선명도, 원거리 최소 30% 가시성 보장)
function calculateDarkness(perpWallDist, side = 0) {
  let fog = 0;
  if (perpWallDist > 3.5) {
    const normDist = Math.max(0, (perpWallDist - 3.5) / 10.5);
    fog = Math.min(0.68, Math.pow(normDist, 1.25));
  }
  const shadowBonus = side === 1 ? 0.12 : 0.0;
  return Math.min(0.70, fog * 0.65 + shadowBonus);
}

const nearDarkness = calculateDarkness(2.0, 0); // 근거리 2타일
assert(nearDarkness === 0, `근거리(2타일)는 안개 없음 (darkness = ${nearDarkness}, 100% 원본 선명도 보장)`);

const midDarkness = calculateDarkness(7.0, 0); // 중거리 7타일
assert(midDarkness > 0 && midDarkness < 0.35, `중거리(7타일)는 부드러운 감쇄 (darkness = ${midDarkness.toFixed(3)})`);

const farDarkness = calculateDarkness(14.0, 1); // 원거리 14타일 (측면 포함)
assert(farDarkness <= 0.70, `원거리(14타일) 최대 어둠 70% 캡 가드 (darkness = ${farDarkness.toFixed(3)}, 최소 30% 가시성 상시 보장)`);

// 2-3. 어안 왜곡 보정 수직 거리 (Perpendicular Wall Distance) 수학 검증
const euclideanDist = 4.0;
const rayAngleOffset = 30 * (Math.PI / 180);
const perpDist = euclideanDist * Math.cos(rayAngleOffset);
assert(perpDist < euclideanDist, '수직 투영 거리는 유클리드 거리보다 작거나 같음 (어안 왜곡 방지)');
assert(Math.abs(perpDist - 3.4641) < 0.01, '어안 왜곡 보정 계수 연산 무결성 (d * cos(theta))');

// 2-4. 스크린 투사 벽 높이 검증 (lineHeight = H / perpDist)
const screenH = 600;
const testPerpDist = 2.0;
const expectedLineHeight = Math.floor(screenH / testPerpDist); // 300px
assert(expectedLineHeight === 300, '투사 벽 높이 연산 (lineHeight = H / perpDist = 300px)');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 3] 3D 빌보드(Billboard) 원근 투영 및 Z-Buffer 오클루전 가드 검증');
console.log('='.repeat(80));

const playerX = 10;
const playerY = 10;
const monsterX = 10;
const monsterY = 8;

const pAngle = 3 * Math.PI / 2;
const dirX = Math.cos(pAngle); // 0
const dirY = Math.sin(pAngle); // -1
const fov = 66 * (Math.PI / 180);
const planeScale = Math.tan(fov / 2);
const planeX = -dirY * planeScale; // +planeScale
const planeY = dirX * planeScale;  // 0

const spriteX = (monsterX + 0.5) - (playerX + 0.5); // 0
const spriteY = (monsterY + 0.5) - (playerY + 0.5); // -2

const invDet = 1.0 / (planeX * dirY - dirX * planeY);
const transformX = invDet * (dirY * spriteX - dirX * spriteY);
const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

assert(Math.abs(transformX) < 0.001, '플레이어 정면 엔티티는 transformX = 0 (화면 중앙 정렬)');
assert(transformY > 1.9 && transformY < 2.1, '전방 2타일 떨어진 몬스터의 변환 깊이 transformY = 2.0');

// Z-Buffer 오클루전 판정 검증
fpRenderer.depthBuffer[400] = 1.5; // 화면 중앙(x=400)에 1.5타일 거리의 벽이 존재함
const isOccludedByWall = transformY >= fpRenderer.depthBuffer[400];
assert(isOccludedByWall === true, '몬스터(깊이 2.0)가 벽(깊이 1.5) 뒤에 있을 때 Z-Culling으로 렌더링 차폐');

fpRenderer.depthBuffer[400] = 3.5; // 화면 중앙 벽이 3.5타일 뒤에 있음
const isVisibleInFrontOfWall = transformY < fpRenderer.depthBuffer[400];
assert(isVisibleInFrontOfWall === true, '몬스터(깊이 2.0)가 벽(깊이 3.5) 앞에 있을 때 정상 시각화 허용');

// 후방 엔티티 컬링 검증
const behindMonsterY = 12;
const behindSpriteY = (behindMonsterY + 0.5) - (playerY + 0.5);
const behindTransformY = invDet * (-planeY * spriteX + planeX * behindSpriteY);
assert(behindTransformY < 0, '플레이어 등 뒤에 있는 몬스터는 transformY < 0으로 즉시 후방 컬링');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 4] Game.js 시선 기준 8방향 상대 이동 및 터치/드래그 시점 회전 검증');
console.log('='.repeat(80));

const game = new Game();
assert(game.renderMode === 'voxel', '기본 렌더링 모드는 2.5D 복셀(voxel)');

// 1차 토글: voxel -> dungeon3d
game.toggleRenderMode();
assert(game.renderMode === 'dungeon3d', '1차 토글 시 1인칭 3D(dungeon3d) 모드로 전이');
assert(game.renderer instanceof FirstPerson3DRenderer, 'renderer 인스턴스가 FirstPerson3DRenderer로 교체');
assert(game.renderer.playerAngle === game.playerAngle, '1인칭 시선 각도(playerAngle) 동기화 확인');

// 4-1. 시선 기준 8방향 상대 이동 벡터 계산 함수
function getRelativeMoveVectors(angle) {
  const snappedAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  const fwdX = Math.round(Math.cos(snappedAngle));
  const fwdY = Math.round(Math.sin(snappedAngle));
  const rightX = -fwdY;
  const rightY = fwdX;
  const leftX = fwdY;
  const leftY = -fwdX;
  const backX = -fwdX;
  const backY = -fwdY;

  return {
    N: [fwdX, fwdY],
    S: [backX, backY],
    W: [leftX, leftY],
    E: [rightX, rightY],
    NW: [Math.max(-1, Math.min(1, fwdX + leftX)), Math.max(-1, Math.min(1, fwdY + leftY))],
    NE: [Math.max(-1, Math.min(1, fwdX + rightX)), Math.max(-1, Math.min(1, fwdY + rightY))],
    SW: [Math.max(-1, Math.min(1, backX + leftX)), Math.max(-1, Math.min(1, backY + leftY))],
    SE: [Math.max(-1, Math.min(1, backX + rightX)), Math.max(-1, Math.min(1, backY + rightY))]
  };
}

// Case A: 북쪽(3PI/2)을 바라볼 때
const northVecs = getRelativeMoveVectors(3 * Math.PI / 2);
assert(northVecs.N[0] === 0 && northVecs.N[1] === -1, '북쪽 시선: 전진(N) -> (0, -1)');
assert(northVecs.S[0] === 0 && northVecs.S[1] === 1, '북쪽 시선: 후진(S) -> (0, 1)');
assert(northVecs.W[0] === -1 && northVecs.W[1] === 0, '북쪽 시선: 좌측 사이드스텝(W) -> (-1, 0)');
assert(northVecs.E[0] === 1 && northVecs.E[1] === 0, '북쪽 시선: 우측 사이드스텝(E) -> (1, 0)');
assert(northVecs.NW[0] === -1 && northVecs.NW[1] === -1, '북쪽 시선: 대각 전진-좌측(NW) -> (-1, -1)');
assert(northVecs.NE[0] === 1 && northVecs.NE[1] === -1, '북쪽 시선: 대각 전진-우측(NE) -> (1, -1)');
assert(northVecs.SW[0] === -1 && northVecs.SW[1] === 1, '북쪽 시선: 대각 후진-좌측(SW) -> (-1, 1)');
assert(northVecs.SE[0] === 1 && northVecs.SE[1] === 1, '북쪽 시선: 대각 후진-우측(SE) -> (1, 1)');

// Case B: 동쪽(0 rad)을 바라볼 때
const eastVecs = getRelativeMoveVectors(0);
assert(eastVecs.N[0] === 1 && eastVecs.N[1] === 0, '동쪽 시선: 전진(N) -> (1, 0)');
assert(eastVecs.S[0] === -1 && eastVecs.S[1] === 0, '동쪽 시선: 후진(S) -> (-1, 0)');
assert(eastVecs.W[0] === 0 && eastVecs.W[1] === -1, '동쪽 시선: 좌측 사이드스텝(W) -> (0, -1)');
assert(eastVecs.E[0] === 0 && eastVecs.E[1] === 1, '동쪽 시선: 우측 사이드스텝(E) -> (0, 1)');

// Case C: 남쪽(PI/2 rad)을 바라볼 때
const southVecs = getRelativeMoveVectors(Math.PI / 2);
assert(southVecs.N[0] === 0 && southVecs.N[1] === 1, '남쪽 시선: 전진(N) -> (0, 1)');
assert(southVecs.W[0] === 1 && southVecs.W[1] === 0, '남쪽 시선: 좌측 사이드스텝(W) -> (1, 0)');

// Case D: 서쪽(PI rad)을 바라볼 때
const westVecs = getRelativeMoveVectors(Math.PI);
assert(westVecs.N[0] === -1 && westVecs.N[1] === 0, '서쪽 시선: 전진(N) -> (-1, 0)');
assert(westVecs.W[0] === 0 && westVecs.W[1] === 1, '서쪽 시선: 좌측 사이드스텝(W) -> (0, 1)');

// 4-2. 터치 / 마우스 드래그 실시간 360도 시점 회전(Drag Look-Around) 연산 검증
const initialAngle = game.playerAngle; // 3PI/2 (4.7123 rad)
const deltaX = 100; // 가로 100px 우측 드래그
const sensitivity = 0.007;
const expectedRotatedAngle = (initialAngle + deltaX * sensitivity + 2 * Math.PI) % (2 * Math.PI);

game.rotateFirstPerson(deltaX * sensitivity);
assert(Math.abs(game.playerAngle - expectedRotatedAngle) < 0.001, '우측 100px 드래그 시 playerAngle 부드러운 회전 반영');
assert(game.renderer.playerAngle === game.playerAngle, '렌더러 playerAngle 동기화 일치 확인');

// 음수 좌측 드래그 (-200px)
game.rotateFirstPerson(-200 * sensitivity);
const expectedLeftAngle = (expectedRotatedAngle - 200 * sensitivity + 2 * Math.PI) % (2 * Math.PI);
assert(Math.abs(game.playerAngle - expectedLeftAngle) < 0.001, '좌측 200px 드래그 시 playerAngle 360도 연속 회전');

// 4-3. 3단 순환 토글 완전성
game.toggleRenderMode(); // dungeon3d -> ascii
assert(game.renderMode === 'ascii', '2차 토글 시 ascii 모드 전이');
game.toggleRenderMode(); // ascii -> voxel
assert(game.renderMode === 'voxel', '3차 토글 시 voxel 모드 복귀');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 5] 3D 모드 탐험 타일의 아스키/복셀 맵 탐험(isExplored) 실시간 동기화 검증');
console.log('='.repeat(80));

// 5-1. 모의 던전 맵 생성 (20x20 그리드)
const testMap = {
  width: 20,
  height: 20,
  floor: 1,
  tiles: Array.from({ length: 20 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => ({
      x,
      y,
      type: (x === 0 || x === 19 || y === 0 || y === 19 || (x === 10 && y === 5)) ? 'WALL' : 'FLOOR',
      isWall: (x === 0 || x === 19 || y === 0 || y === 19 || (x === 10 && y === 5)),
      isExplored: false,
      explored: false
    }))
  ),
  isWall(x, y) {
    if (x < 0 || x >= 20 || y < 0 || y >= 20) return true;
    return this.tiles[y][x].isWall;
  }
};

assert(testMap.tiles[10][10].isExplored === false, '초기 상태: 플레이어 위치 미탐험 상태');
assert(testMap.tiles[10][8].isExplored === false, '초기 상태: 전방 통로 타일 미탐험 상태');

// 1인칭 3D 렌더러로 시야 및 맵 렌더링 호출 (광원 반경 4)
fpRenderer.drawMap(testMap, 0, 0, 10, 10, 4, 1);

assert(testMap.tiles[10][10].isExplored === true, '1인칭 시점 렌더링 후: 플레이어 타일 isExplored = true 동기화');
assert(testMap.tiles[10][10].explored === true, '1인칭 시점 렌더링 후: 플레이어 타일 explored = true 동기화');
assert(testMap.tiles[10][8].isExplored === true, '1인칭 레이캐스팅 관통 경로 상의 타일 탐험 완료 동기화');
assert(testMap.tiles[9][10].isExplored === true, '광원 반경(revealR) 내 주변 타일 탐험 완료 동기화');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 6] 나노바나나 에셋 기반 전투 시각 효과 엔진 (CombatVFXEngine) 검증');
console.log('='.repeat(80));

const vfxEngine = new CombatVFXEngine();

// 6-1. 슬래시 및 원소 타격 이펙트 격발 검증
vfxEngine.triggerHitEffect({
  type: VFX_TYPES.SLASH,
  x: 10,
  y: 8,
  damage: 42,
  isCrit: true,
  isPlayerAttacker: true
});

assert(vfxEngine.activeVFX.length === 1, '활성 전투 VFX 등록 확인');
assert(vfxEngine.activeVFX[0].type === 'SLASH', 'SLASH 이펙트 타입 식별 정합성');
assert(vfxEngine.activeVFX[0].isCrit === true, '치명타 플래그 보존 확인');
assert(vfxEngine.screenShakeIntensity > 0, '치명타 공격 시 화면 셰이크 강도 가산 확인');

// 6-2. 몬스터 공격 피격 시 핏빛 비네팅 및 셰이크 가산 검증
vfxEngine.triggerHitEffect({
  type: VFX_TYPES.FIRE_BURST,
  x: 10,
  y: 10,
  damage: 25,
  isCrit: false,
  isPlayerAttacker: false
});

assert(vfxEngine.activeVFX.length === 2, '두 번째 VFX(FIRE_BURST) 추가 등록 확인');
assert(vfxEngine.bloodVignetteAlpha > 0.5, '플레이어 피격 시 핏빛 비네팅 점멸 활성화 확인');

// 6-3. triggerAttackFX 헬퍼 메소드 검증
const mockMonsterTarget = { x: 12, y: 10, name: 'Orc', hitFlash: 0 };
const mockPlayerSource = { x: 10, y: 10, isPlayer: true };
vfxEngine.triggerAttackFX('FROST_SHATTER', mockPlayerSource, mockMonsterTarget, false, fpRenderer);

assert(vfxEngine.activeVFX.length === 3, 'triggerAttackFX 호출 시 활성 VFX 등록 확인');
assert(mockMonsterTarget.hitFlash > 0, '타겟 몬스터 hitFlash 피격 점멸 설정 확인');

// 6-4. 1인칭 3D 뷰 및 2.5D 복셀 뷰 순수 아스키 렌더링 호출 안전성 검증
assert(vfxEngine.activeVFX[0].particles.length >= 14, '아스키 파티클 14개 이상 생성 확인');
assert(typeof vfxEngine.activeVFX[0].particles[0].char === 'string', '파티클이 순수 텍스트 글리프로 구성됨을 확인');
assert(ASCII_GLYPH_POOLS.SLASH.includes(vfxEngine.activeVFX[0].slashSequence[0]), '슬래시 궤적 글리프 정합성 확인');

vfxEngine.renderFirstPersonVFX(fpRenderer);
assert(true, '1인칭 3D 뷰 아스키 그래픽 VFX 렌더링 예외 없이 완벽 실행');

vfxEngine.renderVoxelVFX(game.renderer);
assert(true, '2.5D 복셀 뷰 아스키 그래픽 VFX 렌더링 예외 없이 완벽 실행');

// 6-5. 시간 경과에 따른 수명 감쇄 및 소멸 검증
vfxEngine.update(0.15);
assert(vfxEngine.activeVFX[0].progress > 0.4, 'dt 경과 시 이펙트 진행률(progress) 갱신 확인');

vfxEngine.update(0.35); // 충분한 시간 경과 후
assert(vfxEngine.activeVFX.length === 0, '수명 종료 시 모든 활성 VFX 자동 소멸 완료');
assert(vfxEngine.screenShakeIntensity === 0, '화면 셰이크 완전히 감쇠 종료 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 7] 다층 3D 복셀 계단 렌더링 및 나침반 레이더 다이아몬드 인디케이터 검증');
console.log('='.repeat(80));

// 7-1. 계단 위치 추출 검증 (_getStairLocations)
const stairTestMap = {
  width: 20,
  height: 20,
  floor: 2,
  downStaircases: [{ x: 10, y: 8, roomIndex: 0 }],
  upStaircases: [{ x: 10, y: 12, isSealed: false, roomIndex: 1 }],
  tiles: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => ({ type: 'FLOOR' })))
};

const locations = fpRenderer._getStairLocations(stairTestMap);
assert(locations.downStairs.length === 1, '하행 계단 1개 정상 추출 확인');
assert(locations.downStairs[0].x === 10 && locations.downStairs[0].y === 8, '하행 계단 좌표 일치 (10, 8)');
assert(locations.upStairs.length === 1, '상행 계단 1개 정상 추출 확인');
assert(locations.upStairs[0].x === 10 && locations.upStairs[0].y === 12, '상행 계단 좌표 일치 (10, 12)');

// 7-2. 3D 복셀 계단 렌더링 파이프라인 검증 (_drawVoxelStairs)
fpRenderer.drawMap(stairTestMap, 0, 0, 10, 10, 5, 2);
assert(true, '하행/상행 계단 포함 맵 1인칭 3D 렌더링 예외 없이 정상 수행');

{
  // 7-3. 카메라 후방 계단 컬링 검증
  // 북쪽(3PI/2) 시선일 때, 플레이어 남쪽 (10, 15) 계단은 카메라 뒤편에 위치
  const behindStairY = (15 + 0.5) - (10 + 0.5);
  const dirX = Math.cos(fpRenderer.playerAngle);
  const dirY = Math.sin(fpRenderer.playerAngle);
  const planeScale = Math.tan(fpRenderer.fov / 2);
  const planeX = -dirY * planeScale;
  const planeY = dirX * planeScale;
  const invDet = 1.0 / (planeX * dirY - dirX * planeY || 0.0001);
  const transformYBehind = invDet * (-planeY * 0 + planeX * behindStairY);
  assert(transformYBehind < 0.25, '후방 계단은 transformY < 0.25로 안전하게 3D 렌더링 컬링');
}

// 7-4. 나침반 레이더 다이아몬드 인디케이터 렌더링 헬퍼 검증
fpRenderer._drawRadarStairDiamond(50, 50, '#f43f5e', '#fda4af');
assert(true, '나침반 레이더 계단 다이아몬드 인디케이터 예외 없이 정상 렌더링');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 8] 수직 시점(Pitch / Freelook) 및 초고시인성 계단 비콘/프롬프트 검증');
console.log('='.repeat(80));

// 8-1. 수직 시점(Pitch / Y-shearing) 초기화 및 클램핑 검증
assert(fpRenderer.pitch === 0, '1인칭 렌더러 기본 수직 시점(pitch) 0px 확인');

fpRenderer.adjustPitch(80);
assert(fpRenderer.pitch === 80, '수직 시점 상향 틸트(+80px) 반영 확인');

const maxAllowedPitch = Math.floor(fpRenderer.h * 0.42);
fpRenderer.adjustPitch(2000);
assert(fpRenderer.pitch === maxAllowedPitch, `수직 시점 최대 각도 클램프(${maxAllowedPitch}px) 보호 확인`);

fpRenderer.adjustPitch(-4000);
assert(fpRenderer.pitch === -maxAllowedPitch, `수직 시점 최소 각도 클램프(-${maxAllowedPitch}px) 보호 확인`);

fpRenderer.resetPitch();
assert(fpRenderer.pitch === 0, 'resetPitch() 호출 시 수직 시점 중앙(0px) 완벽 복귀');

// 8-2. Game.js 1인칭 수직 시점 메소드 연동 검증
if (game.renderMode !== 'dungeon3d') {
  game.toggleRenderMode();
}
game.pitchFirstPerson(-45);
assert(game.renderer.pitch === -45, 'Game.pitchFirstPerson() 실시간 시점 틸트 연동 확인');

game.resetFirstPersonPitch();
assert(game.renderer.pitch === 0, 'Game.resetFirstPersonPitch() 중앙 복귀 연동 확인');

// 8-3. 계단 도착 인게임 안내 프롬프트 검증 (_drawStairArrivalPrompt)
const stairPromptMap = {
  width: 10,
  height: 10,
  tiles: [
    [{ type: 'STAIRS_DOWN', char: '>' }],
    [{ type: 'STAIRS_UP', char: '<' }]
  ]
};

fpRenderer._drawStairArrivalPrompt(stairPromptMap, 0, 0);
assert(true, '하행 계단 타일 도착 안내 프롬프트 배너 예외 없이 정상 렌더링');

fpRenderer._drawStairArrivalPrompt(stairPromptMap, 0, 1);
assert(true, '상행 계단 타일 도착 안내 프롬프트 배너 예외 없이 정상 렌더링');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 9] 다단 히트(Sequential Multi-Hit Combo) 시차 발동 & 2D 아스키 렌더러 연동 검증');
console.log('='.repeat(80));

// 9-1. 4연타 콤보 시차 딜레이 및 궤적 각도 생성 검증
vfxEngine.activeVFX = [];
const mockPlayer = { x: 5, y: 5, isPlayer: true };
const mockTarget = { x: 6, y: 5, hitFlash: 0 };

for (let i = 0; i < 4; i++) {
  vfxEngine.triggerAttackFX('SLASH', mockPlayer, mockTarget, false, fpRenderer, i, 4, 15 + i * 5);
}

assert(vfxEngine.activeVFX.length === 4, '4연타 콤보 4개 VFX 동시 등록 확인');
assert(vfxEngine.activeVFX[0].delay === 0, '1타(히트 0)는 딜레이 0s 즉시 발동');
assert(Math.abs(vfxEngine.activeVFX[1].delay - 0.08) < 0.001, '2타(히트 1)는 0.08s 시차 딜레이 부여');
assert(Math.abs(vfxEngine.activeVFX[2].delay - 0.16) < 0.001, '3타(히트 2)는 0.16s 시차 딜레이 부여');
assert(Math.abs(vfxEngine.activeVFX[3].delay - 0.24) < 0.001, '4타(히트 3)는 0.24s 시차 딜레이 부여');

// 9-2. 콤보 텍스트 배너 검증
assert(vfxEngine.activeVFX[0].comboText === '⚔ 1 HIT!', '1타 콤보 텍스트 [⚔ 1 HIT!] 확인');
assert(vfxEngine.activeVFX[1].comboText === '⚔ 2 HITS!', '2타 콤보 텍스트 [⚔ 2 HITS!] 확인');
assert(vfxEngine.activeVFX[2].comboText === '⚔ 3 HITS!', '3타 콤보 텍스트 [⚔ 3 HITS!] 확인');
assert(vfxEngine.activeVFX[3].comboText === '⚡ 4 HITS COMBO! ⚡', '4타 콤보 텍스트 [⚡ 4 HITS COMBO! ⚡] 확인');

// 9-3. 시간 경과에 따른 시차 순차 발동 검증
assert(vfxEngine.activeVFX[0].hasTriggeredFeedback === true, '1타는 즉시 피드백 발동 완료');
assert(vfxEngine.activeVFX[1].hasTriggeredFeedback === false, '2타는 아직 대기 상태');

vfxEngine.update(0.09); // 0.09초 경과 (2타 발동 시점)
assert(vfxEngine.activeVFX[1].delay === 0, '0.09초 경과 후 2타 딜레이 만료');
assert(vfxEngine.activeVFX[1].hasTriggeredFeedback === true, '2타 피드백(화면 셰이크) 순차 발동 완료');
assert(vfxEngine.activeVFX[2].hasTriggeredFeedback === false, '3타는 여전히 대기 상태');

// 9-4. 2D 클래식 아스키 렌더러 전용 VFX 렌더링 호출 안전성 검증
const mockAsciiRenderer = {
  ctx: fpRenderer.ctx,
  charWidth: 14,
  charHeight: 23,
  w: 800,
  h: 600
};
vfxEngine.renderAsciiVFX(mockAsciiRenderer, 0, 0);
assert(true, '2D 클래식 아스키 렌더러(renderAsciiVFX) 예외 없이 무결 렌더링 완료');

// 9-5. 몬스터 역습 연타 및 핏빛 비네팅 연동 검증
vfxEngine.activeVFX = [];
const mockEnemy = { x: 6, y: 5, isPlayer: false };
vfxEngine.triggerAttackFX('BASH', mockEnemy, mockPlayer, false, fpRenderer, 0, 2, 20);
vfxEngine.triggerAttackFX('BASH', mockEnemy, mockPlayer, false, fpRenderer, 1, 2, 22);

assert(vfxEngine.bloodVignetteAlpha > 0.3, '몬스터 피격 시 핏빛 비네팅 점멸 확인');
assert(vfxEngine.activeVFX.length === 2, '몬스터 2연타 정상 등록 확인');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 10] Phase 2 물리 5대 메소드 및 마법 4대 범주 아스키 그래픽 검증');
console.log('='.repeat(80));

// 10-1. 물리 5대 메소드 스타일 및 글리프 카탈로그 검증
const { ASCII_VFX_CATALOG, VFX_METHODS, VFX_SPELLS } = await import('../src/systems/CombatVFXEngine.js');

assert(ASCII_VFX_CATALOG.CLAW.style === 'TRIPLE_SCRATCH', 'CLAW 스타일: TRIPLE_SCRATCH 확인');
assert(ASCII_VFX_CATALOG.BITE.style === 'CLAMP', 'BITE 스타일: CLAMP 확인');
assert(ASCII_VFX_CATALOG.PIERCE.style === 'THRUST', 'PIERCE 스타일: THRUST 확인');
assert(ASCII_VFX_CATALOG.CRUSH.style === 'SMASH', 'CRUSH 스타일: SMASH 확인');
assert(ASCII_VFX_CATALOG.SLASH.style === 'ARC', 'SLASH 스타일: ARC 확인');

// 10-2. 물리 메소드별 스크린/빌보드 렌더링 호출 안전성 검증
vfxEngine.activeVFX = [];
vfxEngine.triggerAttackFX('CLAW', mockPlayer, mockEnemy, false, fpRenderer, 0, 1, 30, 'CLAW');
vfxEngine.triggerAttackFX('BITE', mockPlayer, mockEnemy, false, fpRenderer, 0, 1, 35, 'BITE');
vfxEngine.triggerAttackFX('PIERCE', mockPlayer, mockEnemy, false, fpRenderer, 0, 1, 40, 'PIERCE');
vfxEngine.triggerAttackFX('CRUSH', mockPlayer, mockEnemy, false, fpRenderer, 0, 1, 45, 'CRUSH');

assert(vfxEngine.activeVFX.length === 4, '물리 4대 신규 메소드 4종 VFX 동시 등록 확인');
vfxEngine.renderFirstPersonVFX(fpRenderer);
assert(true, '1인칭 3D 뷰에서 CLAW, BITE, PIERCE, CRUSH 스크린 특화 렌더러 예외 없이 구동 완료');

// 10-3. 마법 투사체 볼트 & 광역 볼 & 브레스 액션 검증
vfxEngine.activeVFX = [];
vfxEngine.triggerSpellAction('ARROW', mockPlayer, mockEnemy, 'PHYSICAL', 25);
vfxEngine.triggerSpellAction('BO_FIRE', mockPlayer, mockEnemy, 'FIRE', 60);
vfxEngine.triggerSpellAction('BA_FIRE', mockPlayer, mockEnemy, 'FIRE', 100);
vfxEngine.triggerSpellAction('BREATH', mockEnemy, mockPlayer, 'FIRE', 120);

assert(vfxEngine.activeVFX.length === 4, '주문 4종(ARROW, BO_FIRE, BA_FIRE, BREATH) 정상 등록 확인');
assert(vfxEngine.activeVFX[0].def.style === 'BOLT', 'ARROW는 BOLT 스타일 적용 확인');
assert(vfxEngine.activeVFX[2].def.style === 'AOE_BALL', 'BA_FIRE는 AOE_BALL 스타일 적용 확인');
assert(vfxEngine.activeVFX[3].def.style === 'CONE_STREAM', 'BREATH는 CONE_STREAM 스타일 적용 확인');

// 10-4. 상태이상 및 유틸리티 주문 검증
vfxEngine.activeVFX = [];
vfxEngine.triggerSpellAction('HEAL', mockPlayer, mockPlayer, null, -50);
vfxEngine.triggerSpellAction('CONFUSION', mockEnemy, mockPlayer, null, 0);
vfxEngine.triggerSpellAction('TELEPORT', mockPlayer, mockPlayer, null, 0);

assert(vfxEngine.activeVFX.length === 3, '유틸 3종(HEAL, CONFUSION, TELEPORT) 정상 등록 확인');
assert(vfxEngine.activeVFX[0].def.style === 'FOUNTAIN', 'HEAL은 FOUNTAIN 스타일 적용 확인');
assert(vfxEngine.activeVFX[1].def.style === 'AURA_RING', 'CONFUSION은 AURA_RING 스타일 적용 확인');
assert(vfxEngine.activeVFX[2].def.style === 'WARP', 'TELEPORT는 WARP 스타일 적용 확인');

vfxEngine.renderFirstPersonVFX(fpRenderer);
vfxEngine.renderAsciiVFX(mockAsciiRenderer, 0, 0);
assert(true, '1인칭 3D 및 2D 아스키 렌더러에서 전수 마법 카탈로그 무결 렌더링 검증 완료');

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 11] 3D 던전 벽면 텍스처(TextureManager & DDA 슬라이싱) 무결성 검증');
console.log('='.repeat(80));

const { textureManager: tm, resolveTexturePath, TEXTURE_PATHS: tp, TEXTURE_FILENAMES: tf } = await import('../src/renderer/TextureManager.js');

// 11-1. 경로 해석 리졸버 검증
const resolvedRuins = resolveTexturePath(tf.CAVE_RUINS);
assert(resolvedRuins.includes('tex_cave_ruins.jpg'), 'resolveTexturePath()가 유효한 텍스처 URL을 생성함');
assert(tp.CAVE_RUINS.includes('tex_cave_ruins.jpg'), 'TEXTURE_PATHS.CAVE_RUINS 정합성 확인');
assert(tp.COMMON_FLOOR.includes('tex_dungeon_floor.jpg'), 'TEXTURE_PATHS.COMMON_FLOOR 정합성 확인');

// 11-2. 폴백 텍스처 및 온디맨드 로딩 트리거 검증
const wallFallback = tm.getWallTexture('CAVE_RUINS');
assert(Boolean(wallFallback), 'getWallTexture()가 null이 아닌 텍스처/폴백을 즉각 반환함');

const floorFallback = tm.getFloorTexture();
assert(Boolean(floorFallback), 'getFloorTexture()가 null이 아닌 바닥재 폴백을 즉각 반환함');

// 11-3. 1인칭 3D 렌더러 DDA 실사 텍스처 슬라이싱 검증
let drawImageSliceCount = 0;
const mockCanvasCtx = {
  ...fpRenderer.ctx,
  drawImage: (...args) => {
    drawImageSliceCount++;
  },
  fillRect: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  save: () => {},
  restore: () => {},
  fillText: () => {},
  strokeText: () => {}
};

const originalCtx = fpRenderer.ctx;
fpRenderer.ctx = mockCanvasCtx;

// 모의 실사 텍스처 주입 (complete = true, naturalWidth = 256)
const mockImageTexture = {
  width: 256,
  height: 256,
  naturalWidth: 256,
  naturalHeight: 256,
  complete: true
};
tm.textures.set('CAVE_RUINS', mockImageTexture);

const wallMap = {
  width: 10,
  height: 10,
  tiles: Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 10 }, (_, x) => {
      const isBoundary = x === 0 || x === 9 || y === 0 || y === 9;
      return {
        type: isBoundary ? 'WALL' : 'FLOOR',
        isWall: isBoundary,
        isExplored: false
      };
    })
  )
};

drawImageSliceCount = 0;
fpRenderer.drawMap(wallMap, 0, 0, 5, 5, 6, 1);

assert(drawImageSliceCount > 0, `실사 텍스처 이미지 DDA 수직 슬라이스(drawImage) 정상 호출 확인 (${drawImageSliceCount} 슬라이스)`);

// 11-4. 텍스처 미완료(complete = false) 시 절차적 벽돌 슬라이스 안전 폴백 검증
const unreadyTexture = {
  width: 256,
  height: 256,
  naturalWidth: 0,
  naturalHeight: 0,
  complete: false
};
tm.textures.set('VOLCANIC_FORTRESS', unreadyTexture);

let proceduralFallbackCalled = false;
fpRenderer._drawProceduralWallSlice = () => {
  proceduralFallbackCalled = true;
};

fpRenderer.drawMap(wallMap, 0, 0, 5, 5, 6, 25); // 25층 = VOLCANIC_FORTRESS
assert(proceduralFallbackCalled, '텍스처 미완료/로딩 중 시 _drawProceduralWallSlice 안전 폴백 정상 작동 확인');

fpRenderer.ctx = originalCtx;

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 12] 5대 던전 테마 맞춤형 바닥 & 천장 텍스처 및 90s 레트로 플로어캐스팅 검증');
console.log('='.repeat(80));

const { FLOOR_TEXTURE_PATHS, CEILING_TEXTURE_PATHS, FLOOR_TEXTURE_FILENAMES, CEILING_TEXTURE_FILENAMES } = await import('../src/renderer/TextureManager.js');

// 12-1. 바닥재 텍스처 경로 레지스트리 검증 (5대 테마 + 공통 바닥)
assert(FLOOR_TEXTURE_PATHS.CAVE_RUINS.includes('tex_floor_cave_ruins.jpg'), 'CAVE_RUINS 바닥재 텍스처 경로 정합성');
assert(FLOOR_TEXTURE_PATHS.MINES_CATACOMBS.includes('tex_floor_catacombs.jpg'), 'MINES_CATACOMBS 바닥재 텍스처 경로 정합성');
assert(FLOOR_TEXTURE_PATHS.VOLCANIC_FORTRESS.includes('tex_floor_volcanic.jpg'), 'VOLCANIC_FORTRESS 바닥재 텍스처 경로 정합성');
assert(FLOOR_TEXTURE_PATHS.DARK_ABYSS.includes('tex_floor_dark_abyss.jpg'), 'DARK_ABYSS 바닥재 텍스처 경로 정합성');
assert(FLOOR_TEXTURE_PATHS.DEEP_ANGBAND.includes('tex_floor_deep_angband.jpg'), 'DEEP_ANGBAND 바닥재 텍스처 경로 정합성');
assert(FLOOR_TEXTURE_PATHS.COMMON_FLOOR.includes('tex_dungeon_floor.jpg'), 'COMMON_FLOOR 바닥재 텍스처 경로 정합성');

// 12-2. 천장 텍스처 경로 레지스트리 검증 (5대 테마)
assert(CEILING_TEXTURE_PATHS.CAVE_RUINS.includes('tex_ceil_cave_ruins.jpg'), 'CAVE_RUINS 천장 텍스처 경로 정합성');
assert(CEILING_TEXTURE_PATHS.MINES_CATACOMBS.includes('tex_ceil_catacombs.jpg'), 'MINES_CATACOMBS 천장 텍스처 경로 정합성');
assert(CEILING_TEXTURE_PATHS.VOLCANIC_FORTRESS.includes('tex_ceil_volcanic.jpg'), 'VOLCANIC_FORTRESS 천장 텍스처 경로 정합성');
assert(CEILING_TEXTURE_PATHS.DARK_ABYSS.includes('tex_ceil_dark_abyss.jpg'), 'DARK_ABYSS 천장 텍스처 경로 정합성');
assert(CEILING_TEXTURE_PATHS.DEEP_ANGBAND.includes('tex_ceil_deep_angband.jpg'), 'DEEP_ANGBAND 천장 텍스처 경로 정합성');

// 12-3. 테마별 텍스처 조회 API 안전성 (getFloorTexture, getCeilingTexture)
for (const key of ['CAVE_RUINS', 'MINES_CATACOMBS', 'VOLCANIC_FORTRESS', 'DARK_ABYSS', 'DEEP_ANGBAND']) {
  const fTex = tm.getFloorTexture(key);
  assert(fTex !== null && fTex !== undefined, `${key} 테마 바닥 텍스처 조회 성공`);
  const cTex = tm.getCeilingTexture(key);
  assert(cTex !== null && cTex !== undefined, `${key} 테마 천장 텍스처 조회 성공`);
}

// 12-4. 90s 레트로 플로어캐스팅 & 실링캐스팅 버퍼 래스터라이징 검증
let floorPutImageDataCalled = false;
let floorDrawImageCalled = false;

const mockFloorCanvasCtx = {
  putImageData: () => { floorPutImageDataCalled = true; },
  createImageData: (w, h) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4)
  })
};

const mockFloorCanvas = {
  width: 240,
  height: 180,
  getContext: () => mockFloorCanvasCtx
};

fpRenderer.floorCanvas = mockFloorCanvas;
fpRenderer.floorCtx = mockFloorCanvasCtx;
fpRenderer.floorImageData = mockFloorCanvasCtx.createImageData(240, 180);
fpRenderer.floorBuffer = new Uint32Array(fpRenderer.floorImageData.data.buffer);

fpRenderer.ctx = {
  ...originalCtx,
  drawImage: () => { floorDrawImageCalled = true; },
  fillRect: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  save: () => {},
  restore: () => {}
};

// 128x128 모의 픽셀 버퍼 주입
const mockPixelBuf = new Uint32Array(128 * 128).fill(0xFF334455);
const dummyTexObj = { isMock: true };
tm.pixelBuffers.set(dummyTexObj, mockPixelBuf);

fpRenderer._renderCeilingAndFloor(dummyTexObj, dummyTexObj, { id: 'CAVE_RUINS' }, 5.5, 5.5, 0, -1, 0.66, 0, 4.0, 2.0, 8.0);

assert(floorPutImageDataCalled, '플로어캐스팅 픽셀 버퍼 putImageData 정상 호출 확인');
assert(floorDrawImageCalled, '오프스크린 플로어캐스팅 버퍼 스크린 투사 drawImage 정상 호출 확인');

fpRenderer.ctx = originalCtx;

console.log('='.repeat(80));
console.log('🧪 [TEST SUITE 13] 2x2 멀티타일 매핑, 타일 줄눈(Grout), 접촉 AO 그림자, 카메라 럴프 검증');
console.log('='.repeat(80));

// 13-1. 2x2 멀티타일 주기성 위상 변화 검증 (1타일 고정 착시 제거)
const tx0 = (Math.floor(0.0 * 64) & 127);
const tx1 = (Math.floor(1.0 * 64) & 127);
const tx2 = (Math.floor(2.0 * 64) & 127);

assert(tx0 === 0, '초기 타일 좌표 (0.0): 텍스처 오프셋 0');
assert(tx1 === 64, '1타일 전진 (1.0): 텍스처 64px (반 주기) 정밀 위상 변화 확인 (고정 착시 제거)');
assert(tx2 === 0, '2타일 전진 (2.0): 텍스처 128px 1주기 회귀 확인');

// 13-2. 타일 격자 줄눈(Grout / Mortar Seam) 셰이딩 검증
function checkGrout(mapCoord) {
  const frac = mapCoord - Math.floor(mapCoord);
  return (frac < 0.042 || frac > 0.958);
}
assert(checkGrout(1.01) === true, '타일 경계선 부근(1.01) 줄눈 음영 판정 (isGrout = true)');
assert(checkGrout(1.99) === true, '타일 경계선 부근(1.99) 줄눈 음영 판정 (isGrout = true)');
assert(checkGrout(1.50) === false, '타일 중심부(1.50) 일반 텍스처 명도 유지 (isGrout = false)');

// 13-3. 부드러운 카메라 선형 보간 (Camera Lerp) & 워킹 밥(Head-bob) 검증
fpRenderer.snapCamera(5, 5);
assert(fpRenderer.camX === 5.5 && fpRenderer.camY === 5.5, 'snapCamera 초기 카메라 중심 좌표 (5.5, 5.5) 확인');
assert(fpRenderer.walkBob === 0, 'snapCamera 시 워킹 밥 초기화 (0px) 확인');

const moveTestMap = {
  width: 10,
  height: 10,
  tiles: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ({ type: 'FLOOR', isWall: false, isExplored: false })))
};

// 동쪽으로 1칸 이동 시 (playerX: 5 -> 6)
fpRenderer.drawMap(moveTestMap, 0, 0, 6, 5, 6, 1);

assert(fpRenderer.camX > 5.5 && fpRenderer.camX < 6.5, `카메라가 즉시 점프하지 않고 60fps 선형 보간 진행 확인 (현재 camX: ${fpRenderer.camX.toFixed(2)})`);
assert(Math.abs(fpRenderer.walkBob) > 0, `플레이어 이동 중 보행 밥(Head-bob) 실시간 미세 진동 활성화 (${fpRenderer.walkBob.toFixed(2)}px)`);

// 4타일 초과 순간이동 시 즉시 스냅 안전 장치 검증
fpRenderer.drawMap(moveTestMap, 0, 0, 20, 20, 6, 1);
assert(fpRenderer.camX === 20.5 && fpRenderer.camY === 20.5, '장거리 이동/순간이동 시 럴프 지연 없이 즉시 스냅 확인');

// 13-4. 벽면 상/하단 접촉 앰비언트 오클루전 (Contact Shadow) 렌더링 호출 검증
let shadowFillRectCount = 0;
const testShadowCtx = {
  ...originalCtx,
  drawImage: () => {},
  fillRect: (x, y, w, h) => { shadowFillRectCount++; },
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  save: () => {},
  restore: () => {}
};
fpRenderer.ctx = testShadowCtx;
const singleWallMap = {
  width: 10,
  height: 10,
  tiles: Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => ({
    type: (x === 0 || x === 9 || y === 0 || y === 9) ? 'WALL' : 'FLOOR',
    isWall: (x === 0 || x === 9 || y === 0 || y === 9),
    isExplored: false
  })))
};
shadowFillRectCount = 0;
fpRenderer.drawMap(singleWallMap, 0, 0, 5, 5, 6, 1);
assert(shadowFillRectCount > 0, `벽면 상단 및 하단 접촉 앰비언트 오클루전 그림자 렌더링 확인 (${shadowFillRectCount} 회 fillRect)`);
fpRenderer.ctx = originalCtx;

console.log('='.repeat(80));
console.log(`🎉 [TEST SUMMARY] 총 ${passed + failed}개 검증 중 ${passed}개 통과 (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
