/**
 * @module RenderConfig
 * @category configs
 * @description 3D 복셀 렌더러 지오메트리 규격, 카메라/뷰포트 배율, 조명 및 앰비언트 오클루전, 파티클 물리 및 탄도학 통합 설정
 * @purity Pure Constants
 * @dependencies none
 * @exports BASE_TILE_WIDTH, BASE_TILE_HEIGHT, BASE_BLOCK_HEIGHT, VOXEL_DIMENSIONS, ZOOM_RANGE, ZOOM_STEPS, CAMERA_LERP_FACTOR, CAMERA_CONFIG, AO_SHADING_FACTORS, LIGHTING_CONFIG, HIT_PICK_RADIUS, PARTICLE_PHYSICS, BALLISTICS_CONFIG, BREAKPOINTS, getResponsiveViewport
 */

/**
 * 1. 복셀 그리드 및 기하학적 치수 (Isometric Dimensions)
 */
export const BASE_TILE_WIDTH = 34;       // 아이소메트릭 타일 가로 폭 (px)
export const BASE_TILE_HEIGHT = 17;      // 아이소메트릭 타일 세로 높이 (px, 2:1 ratio)
export const BASE_BLOCK_HEIGHT = 20;     // Z-Layer 블록 기본 높이 (px)

export const VOXEL_DIMENSIONS = {
  tileWidth: BASE_TILE_WIDTH,
  tileHeight: BASE_TILE_HEIGHT,
  blockHeight: 14,                      // 복셀 측면 단차 두께 (px)
  layerHeight: BASE_BLOCK_HEIGHT,
  halfTileW: BASE_TILE_WIDTH / 2,       // 17
  halfTileH: BASE_TILE_HEIGHT / 2       // 8.5
};

/**
 * 2. 2.5D 카메라 및 뷰포트 배율 제어 설정
 */
export const ZOOM_RANGE = { min: 0.4, max: 3.0 };
export const ZOOM_STEPS = [0.6, 0.8, 1.0, 1.3, 1.7];
export const CAMERA_LERP_FACTOR = 0.2;   // 카메라 스무딩 보간 계수

export const CAMERA_CONFIG = {
  defaultZoom: 1.0,
  minZoom: ZOOM_RANGE.min,
  maxZoom: ZOOM_RANGE.max,
  zoomSteps: ZOOM_STEPS,
  lerpFactor: CAMERA_LERP_FACTOR,
  defaultTileSize: 20,
  minViewportCols: 12,
  minViewportRows: 10,
  defaultCanvasWidth: 800,
  defaultCanvasHeight: 600
};

/**
 * 3. 조명(Lighting), 그림자 및 앰비언트 오클루전(Ambient Occlusion) 설정
 */
export const AO_SHADING_FACTORS = {
  top: 1.0,             // 상단면 기본 밝기 (100%)
  left: 0.65,           // 좌측면 음영 밝기 (65%)
  right: 0.40,          // 우측면 그림자 밝기 (40%)
  cornerDarkening: 0.25 // 구석 앰비언트 오클루전 추가 감쇄율
};

export const LIGHTING_CONFIG = {
  ambientLightIntensity: 0.35,
  directionalLightIntensity: 0.65,
  directionalLightAngle: Math.PI / 4, // 45도 입사광
  pointLightFalloffExponent: 1.8,
  maxLightRadius: 8.0,
  ambientOcclusionFactor: 0.25,
  shadowIntensity: 0.40,
  fogOfWarOpacity: 0.85,
  aoFactors: AO_SHADING_FACTORS
};

/**
 * 4. 마이크로 복셀 파티클 시스템 물리 상수
 */
export const PARTICLE_PHYSICS = {
  maxParticles: 300,
  gravity: 0.45,
  airResistance: 0.96,
  minLifetimeMs: 300,
  maxLifetimeMs: 800,
  lifetime: [300, 800],
  voxelParticleSize: 2,
  bounceDamping: 0.55
};

/**
 * 5. 고속 직사(Direct-Fire) 및 탄도학/히트박스 설정
 */
export const HIT_PICK_RADIUS = 48;       // 지형 간섭 없는 엔티티 최우선 피킹 반경 (px)

export const BALLISTICS_CONFIG = {
  trajectoryExponent: 1.35,              // t^1.35 고속 직사 궤적 가속도
  directFireSpeed: 12.0,
  spiralFrequency: 4.0,                  // 나선 궤적 회전 주파수
  jetVelocityMultiplier: 1.8,            // 제트 추진 순간 가속 배율
  inspectHitboxRadius: HIT_PICK_RADIUS   // 피킹 히트박스 반경
};

/**
 * 6. 반응형 레이아웃 및 폼팩터 중단점 (Breakpoints)
 */
export const BREAKPOINTS = {
  mobileFoldWidth: 600,                  // Galaxy Fold 접은 모드 기준 너비
  mobileWidth: 768,
  tabletWidth: 1024,
  desktopWidth: 1440
};

/**
 * 캔버스 크기와 줌 레벨을 기반으로 최적의 뷰포트 타일 그리드 크기를 계산합니다.
 * @param {number} canvasWidth - 캔버스 픽셀 너비
 * @param {number} canvasHeight - 캔버스 픽셀 높이
 * @param {number} [zoom=1.0] - 현재 줌 배율
 * @param {number} [tileSize=20] - 기본 타일 크기
 * @returns {{cols: number, rows: number}} 계산된 가로/세로 타일 개수
 */
export function getResponsiveViewport(canvasWidth, canvasHeight, zoom = 1.0, tileSize = CAMERA_CONFIG.defaultTileSize) {
  const effectiveW = BASE_TILE_WIDTH * zoom;
  const effectiveH = BASE_TILE_HEIGHT * zoom;
  
  const cols = Math.max(CAMERA_CONFIG.minViewportCols, Math.floor(canvasWidth / effectiveW));
  const rows = Math.max(CAMERA_CONFIG.minViewportRows, Math.floor(canvasHeight / effectiveH));
  
  return { cols, rows };
}
