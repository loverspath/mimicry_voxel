/**
 * @module ThemeColors
 * @category configs
 * @description ToME 2.3.5 정통 16색 ANSI 터미널 팔레트(TERM_COLORS), 7대 원소 팔레트, 4대 아이템 등급 색상,
 *              터미널 폰트 스택 및 레트로 크로매틱 글로우 스타일 통합 설정
 * @purity Pure Constants
 * @dependencies none
 * @exports TERM_COLORS, ANSI_PALETTE_INDEX, TERMINAL_FONT_STACK, RETRO_GLOW_STYLES, CANVAS_CLEAR_3D, RARITY_COLORS, ELEMENT_COLORS, ELEMENT_PALETTES, RARITY_THEMES, UI_THEMES, VOXEL_THEMES, getTermColor, getTermColorHex, getRarityColor, getRarityLabel, getElementColor
 */

/**
 * 0. ToME 2.3.5 / Angband 정통 16색 ANSI 터미널 색상 팔레트 (Standard Terminal 16 Colors)
 */
export const TERM_COLORS = {
  TERM_DARK: '#000000',      // 0. 검정 (Black / Background / Shadow)
  TERM_WHITE: '#ffffff',     // 1. 백색 (Pure White / Normal text)
  TERM_SLATE: '#94a3b8',     // 2. 점판암회색 (Slate / Iron / Light armor)
  TERM_ORANGE: '#f97316',    // 3. 주황 (Orange / Fire / Artifacts)
  TERM_RED: '#ef4444',       // 4. 적색 (Red / Danger / Dragon)
  TERM_GREEN: '#22c55e',     // 5. 녹색 (Green / Acid / Nature / Serpent)
  TERM_BLUE: '#3b82f6',      // 6. 청색 (Blue / Frost / Water)
  TERM_UMBER: '#b45309',     // 7. 암갈색 (Umber / Dirt / Wood / Earth)
  TERM_L_DARK: '#475569',    // 8. 명암회색 (Light Dark / Unexplored / Fog)
  TERM_L_WHITE: '#e2e8f0',   // 9. 명백색 (Light White / Silver / Mithril)
  TERM_VIOLET: '#a855f7',    // 10. 보라 (Violet / Arcane / Undead / Nether)
  TERM_YELLOW: '#eab308',    // 11. 황색 (Yellow / Lightning / Gold)
  TERM_L_RED: '#f87171',     // 12. 명적색 (Light Red / Critical / Ruby)
  TERM_L_GREEN: '#4ade80',   // 13. 명녹색 (Light Green / Heal / Poison)
  TERM_L_BLUE: '#38bdf8',    // 14. 명청색 (Light Blue / Mana / Phase)
  TERM_L_UMBER: '#d97706',   // 15. 명갈색 (Light Umber / Copper / Leather)
};

/**
 * 정통 ANSI 16색 인덱스 순서 배열 (0..15)
 */
export const ANSI_PALETTE_INDEX = [
  TERM_COLORS.TERM_DARK,
  TERM_COLORS.TERM_WHITE,
  TERM_COLORS.TERM_SLATE,
  TERM_COLORS.TERM_ORANGE,
  TERM_COLORS.TERM_RED,
  TERM_COLORS.TERM_GREEN,
  TERM_COLORS.TERM_BLUE,
  TERM_COLORS.TERM_UMBER,
  TERM_COLORS.TERM_L_DARK,
  TERM_COLORS.TERM_L_WHITE,
  TERM_COLORS.TERM_VIOLET,
  TERM_COLORS.TERM_YELLOW,
  TERM_COLORS.TERM_L_RED,
  TERM_COLORS.TERM_L_GREEN,
  TERM_COLORS.TERM_L_BLUE,
  TERM_COLORS.TERM_L_UMBER,
];

/**
 * 정통 아스키 터미널 모노스페이스 폰트 스택
 */
export const TERMINAL_FONT_STACK = "'Consolas', 'Monaco', 'Courier New', 'Fira Code', monospace";

/**
 * 레트로 CRT 및 크로매틱 앰비언트 글로우 스타일 정의
 */
export const RETRO_GLOW_STYLES = {
  ambientCrt: "0 0 2px rgba(255, 255, 255, 0.35)",
  playerGlow: "0 0 6px rgba(255, 215, 0, 0.6)",
  magicGlow: "0 0 8px rgba(168, 85, 247, 0.7)",
  manaGlow: "0 0 6px rgba(56, 189, 248, 0.65)",
  dangerGlow: "0 0 6px rgba(239, 68, 68, 0.75)",
  lootGlow: "0 0 6px rgba(234, 179, 8, 0.65)",
};

/**
 * 1. 3D 캔버스 배경 클리어 색상
 */
export const CANVAS_CLEAR_3D = "#06070b";

/**
 * 2. 4대 희귀도 텍스트 헥스코드 (ToME 정통 색상 매핑)
 */
export const RARITY_COLORS = {
  normal: TERM_COLORS.TERM_L_WHITE,   // #e2e8f0 (Slate White)
  uncommon: TERM_COLORS.TERM_L_GREEN, // #4ade80 (Emerald Green)
  rare: TERM_COLORS.TERM_L_BLUE,      // #38bdf8 (Sky Blue)
  epic: TERM_COLORS.TERM_VIOLET       // #a855f7 (Mystic Purple)
};

/**
 * 3. 7대 원소 기본 헥스코드 (ToME 정통 색상 매핑)
 */
export const ELEMENT_COLORS = {
  FIRE: TERM_COLORS.TERM_RED,          // #ef4444
  COLD: TERM_COLORS.TERM_L_BLUE,       // #38bdf8
  LIGHTNING: TERM_COLORS.TERM_YELLOW,  // #eab308
  ACID: TERM_COLORS.TERM_GREEN,        // #22c55e
  MANA: TERM_COLORS.TERM_BLUE,         // #3b82f6
  MAGIC: TERM_COLORS.TERM_L_RED,       // #f87171
  APOCALYPSE: TERM_COLORS.TERM_VIOLET  // #a855f7
};

/**
 * 4. 7대 원소(Elemental) 상세 팔레트 및 시각 효과 색상
 */
export const ELEMENT_PALETTES = {
  FIRE: {
    name: "화염",
    primary: ELEMENT_COLORS.FIRE,
    secondary: "#f97316",    // Orange-500
    accent: "#facc15",       // Yellow-400
    particle: "#ff4500",     // OrangeRed
    glow: "rgba(239, 68, 68, 0.45)"
  },
  COLD: {
    name: "냉기",
    primary: ELEMENT_COLORS.COLD,
    secondary: "#0ea5e9",    // Ocean Blue
    accent: "#e0f2fe",       // Soft Frost
    particle: "#00bfff",     // DeepSkyBlue
    glow: "rgba(56, 189, 248, 0.45)"
  },
  LIGHTNING: {
    name: "전기",
    primary: ELEMENT_COLORS.LIGHTNING,
    secondary: "#a855f7",    // Purple-500
    accent: "#ffffff",       // Pure White
    particle: "#ffff00",     // Electric Yellow
    glow: "rgba(234, 179, 8, 0.45)"
  },
  ACID: {
    name: "산성",
    primary: ELEMENT_COLORS.ACID,
    secondary: "#a3e635",    // Lime-400
    accent: "#15803d",       // Emerald Dark
    particle: "#32cd32",     // LimeGreen
    glow: "rgba(34, 197, 94, 0.45)"
  },
  MANA: {
    name: "마나",
    primary: ELEMENT_COLORS.MANA,
    secondary: "#a78bfa",    // Violet-400
    accent: "#c084fc",       // Purple-400
    particle: "#a78bfa",     // Arcane Lavender
    glow: "rgba(96, 165, 250, 0.45)"
  },
  MAGIC: {
    name: "마법",
    primary: ELEMENT_COLORS.MAGIC,
    secondary: "#f43f5e",    // Rose-500
    accent: "#ffc0cb",       // Soft Pink
    particle: "#ffc0cb",     // Spark Pink
    glow: "rgba(251, 113, 133, 0.45)"
  },
  APOCALYPSE: {
    name: "종말",
    primary: ELEMENT_COLORS.APOCALYPSE,
    secondary: "#7e22ce",    // Dark Violet
    accent: "#8b008d",       // Deep Magenta
    particle: "#8b008d",     // Void Purple
    glow: "rgba(168, 85, 247, 0.55)"
  }
};

/**
 * 5. 4대 아이템 및 엔티티 희귀도(Rarity) 테마
 */
export const RARITY_THEMES = {
  normal: {
    color: RARITY_COLORS.normal,
    label: "일반",
    border: "rgba(226, 232, 240, 0.2)",
    glow: "none",
    bg: "rgba(226, 232, 240, 0.05)"
  },
  uncommon: {
    color: RARITY_COLORS.uncommon,
    label: "고급",
    border: "rgba(52, 211, 153, 0.4)",
    glow: "0 0 12px rgba(52, 211, 153, 0.35)",
    bg: "rgba(52, 211, 153, 0.1)"
  },
  rare: {
    color: RARITY_COLORS.rare,
    label: "희귀",
    border: "rgba(56, 189, 248, 0.5)",
    glow: "0 0 16px rgba(56, 189, 248, 0.45)",
    bg: "rgba(56, 189, 248, 0.12)"
  },
  epic: {
    color: RARITY_COLORS.epic,
    label: "전설",
    border: "rgba(168, 85, 247, 0.6)",
    glow: "0 0 20px rgba(168, 85, 247, 0.55)",
    bg: "rgba(168, 85, 247, 0.15)"
  }
};

/**
 * 6. UI 및 글래스모피즘(Glassmorphism) 테마
 */
export const UI_THEMES = {
  canvasClear: CANVAS_CLEAR_3D,
  bgBase: "#06070b",
  bgGlassPanel: "rgba(15, 23, 42, 0.75)",
  bgGlassHeader: "rgba(22, 23, 29, 0.85)",
  bgGlassModal: "rgba(10, 12, 18, 0.88)",
  borderGlass: "rgba(255, 255, 255, 0.12)",
  borderAccent: "rgba(192, 132, 252, 0.5)",
  borderSubtle: "rgba(255, 255, 255, 0.06)",
  backdropBlur: "12px",
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
  textMuted: "#64748b",
  accentPurple: "#c084fc",
  accentBlue: "#38bdf8"
};

/**
 * 7. 복셀 지형 블록(Terrain Block) 3D 테마 팔레트
 */
export const VOXEL_THEMES = {
  WALL: {
    name: '심연의 복셀 성벽',
    top: [36, 42, 54], left: [22, 26, 36], right: [14, 18, 24],
    mortar: 'rgba(0,0,0,0.65)', bevel: 'rgba(255,255,255,0.12)',
    isWalkable: false, height: 2, pattern: 'brick'
  },
  FLOOR: {
    name: '석조 바닥',
    top: [58, 62, 75], left: [38, 42, 52], right: [24, 28, 36],
    mortar: 'rgba(0,0,0,0.4)', bevel: 'rgba(255,255,255,0.2)',
    isWalkable: true, height: 0, pattern: 'stone'
  },
  ELEVATED: {
    name: '고지대 제단',
    top: [90, 95, 115], left: [58, 62, 78], right: [40, 44, 56],
    mortar: 'rgba(0,0,0,0.5)', bevel: 'rgba(255,255,255,0.28)',
    isWalkable: true, height: 1, pattern: 'rune'
  },
  LAVA: {
    name: '작열하는 용암지대',
    top: [180, 48, 20], left: [110, 28, 12], right: [65, 15, 6],
    mortar: 'rgba(255,100,0,0.6)', bevel: 'rgba(255,200,50,0.45)',
    isWalkable: true, height: 0, hazard: 'fire',
    lightColor: [255, 85, 25], lightRadius: 4.8, pattern: 'magma'
  },
  SANCTUARY: {
    name: '비전의 성역',
    top: [20, 115, 140], left: [12, 75, 95], right: [8, 48, 60],
    mortar: 'rgba(0,255,255,0.4)', bevel: 'rgba(140,255,255,0.45)',
    isWalkable: true, height: 1, buff: 'heal',
    lightColor: [0, 245, 255], lightRadius: 5.2, pattern: 'crystal'
  },
  TREASURE: {
    name: '황금 보물터',
    top: [155, 120, 30], left: [105, 80, 16], right: [65, 48, 10],
    mortar: 'rgba(255,215,0,0.45)', bevel: 'rgba(255,245,160,0.5)',
    isWalkable: true, height: 0,
    lightColor: [255, 210, 45], lightRadius: 4.2, pattern: 'gold'
  },
  DOOR: {
    name: '고대 룬 문',
    top: [95, 75, 45], left: [65, 50, 28], right: [42, 32, 18],
    mortar: 'rgba(0,0,0,0.6)', bevel: 'rgba(255,220,120,0.3)',
    isWalkable: true, height: 1, pattern: 'wood'
  },
  STAIRS_DOWN: {
    name: '하층 진입 계단',
    top: [80, 50, 120], left: [50, 30, 80], right: [32, 18, 52],
    mortar: 'rgba(168,85,247,0.5)', bevel: 'rgba(216,180,254,0.4)',
    isWalkable: true, height: 0,
    lightColor: [192, 132, 252], lightRadius: 3.5, pattern: 'stair'
  },
  STAIRS_UP: {
    name: '상층 귀환 계단',
    top: [70, 100, 140], left: [45, 65, 95], right: [28, 42, 65],
    mortar: 'rgba(56,189,248,0.5)', bevel: 'rgba(186,230,253,0.4)',
    isWalkable: true, height: 1,
    lightColor: [56, 189, 248], lightRadius: 3.5, pattern: 'stair'
  }
};

/**
 * 희귀도 키에 대응하는 텍스트 렌더링 색상을 반환합니다.
 * @param {string} rarity - 희귀도 레벨 ('normal' | 'uncommon' | 'rare' | 'epic')
 * @returns {string} Hex 색상 코드
 */
export function getRarityColor(rarity) {
  return RARITY_COLORS[rarity] || RARITY_COLORS.normal;
}

/**
 * 희귀도 키에 대응하는 한글 레이블을 반환합니다.
 * @param {string} rarity - 희귀도 레벨
 * @returns {string} 한글 레이블 ('일반' | '고급' | '희귀' | '전설')
 */
export function getRarityLabel(rarity) {
  return RARITY_THEMES[rarity]?.label || RARITY_THEMES.normal.label;
}

/**
 * 원소 키에 대응하는 대표 색상을 반환합니다.
 * @param {string} element - 원소 식별자 ('FIRE', 'COLD', 'LIGHTNING' 등)
 * @returns {string} Hex 색상 코드
 */
export function getElementColor(element) {
  return ELEMENT_COLORS[element] || "#ffffff";
}

/**
 * 정통 16색 터미널 색상 키로 색상 Hex 코드를 조회합니다.
 * @param {string} key - 'TERM_WHITE', 'TERM_RED', 'TERM_L_BLUE' 등
 * @returns {string} Hex 색상 코드
 */
export function getTermColor(key) {
  return TERM_COLORS[key] || TERM_COLORS.TERM_WHITE;
}

/**
 * 정통 16색 터미널 인덱스(0..15)로 색상 Hex 코드를 조회합니다.
 * @param {number} index - 0 ~ 15
 * @returns {string} Hex 색상 코드
 */
export function getTermColorHex(index) {
  const safeIdx = Math.max(0, Math.min(15, Math.floor(index || 0)));
  return ANSI_PALETTE_INDEX[safeIdx] || TERM_COLORS.TERM_WHITE;
}
