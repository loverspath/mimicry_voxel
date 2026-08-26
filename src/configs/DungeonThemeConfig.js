/**
 * @module DungeonThemeConfig
 * @category configs
 * @description 1~50층 5대 테마 던전 층계 명세, 테마별 타일 색상/복셀 팔레트, Vault 및 Monster Pit 스폰 확률 및 몬스터 계열 가중치 설정
 * @purity Pure Constants
 * @dependencies ThemeColors.js
 * @exports DUNGEON_THEMES, DUNGEON_THEME_KEYS, getThemeForFloor, getThemeConfig, getAmbientText, getRandomPitMonsterSpecies, getThemeColors, getSpecialRoomChancesForFloor
 */

import { TERM_COLORS } from './ThemeColors.js';

/**
 * 1~50층 5대 던전 테마 키 목록
 */
export const DUNGEON_THEME_KEYS = [
  'CAVE_RUINS',
  'MINES_CATACOMBS',
  'VOLCANIC_FORTRESS',
  'DARK_ABYSS',
  'DEEP_ANGBAND'
];

/**
 * 5대 던전 테마별 상세 데이터 명세 레지스트리
 */
export const DUNGEON_THEMES = {
  CAVE_RUINS: {
    id: 'CAVE_RUINS',
    themeIndex: 0,
    name: '동굴과 고대 폐허',
    nameEn: 'Cave & Ancient Ruins',
    minFloor: 1,
    maxFloor: 10,
    description: '습기 찬 석회암 동굴과 이끼 낀 고대 문명의 석조 잔해. 풋내기 모험가들이 처음 발을 들이는 앙그반드의 초입.',
    ambientTexts: [
      '차가운 물방울이 천장에서 바닥으로 뚝뚝 떨어집니다.',
      '벽면을 따라 축축한 이끼와 정체불명의 균류가 자라나 있습니다.',
      '먼 곳에서 작은 발소리와 찍찍거리는 쥐 울음소리가 희미하게 울립니다.',
      '부서진 석조 기둥 사이에 오래된 고대 룬 문자가 희미하게 남아있습니다.'
    ],
    colors: {
      wallChar: '#',
      floorChar: '.',
      wallColor: '#64748b',       // Slate 500
      floorColor: '#334155',      // Slate 700
      corridorColor: '#1e293b',   // Slate 800
      vaultFloorColor: '#c084fc', // Purple 400
      pitFloorColor: '#4ade80',   // Green 400
      doorColor: '#b45309',       // Umber
      trapColor: '#f59e0b',       // Amber
      stairDownColor: '#f43f5e',  // Rose
      stairUpColor: '#38bdf8',    // Sky Blue
      ambientLight: [180, 195, 215]
    },
    voxelColors: {
      wall: {
        top: [70, 80, 95], left: [45, 52, 65], right: [30, 36, 46],
        mortar: 'rgba(0,0,0,0.65)', bevel: 'rgba(255,255,255,0.12)',
        height: 2, pattern: 'brick'
      },
      floor: {
        top: [58, 62, 75], left: [38, 42, 52], right: [24, 28, 36],
        mortar: 'rgba(0,0,0,0.4)', bevel: 'rgba(255,255,255,0.2)',
        height: 0, pattern: 'stone'
      },
      vault: {
        top: [140, 95, 200], left: [95, 60, 145], right: [60, 35, 95],
        lightColor: [192, 132, 252], lightRadius: 4.5
      },
      pit: {
        top: [40, 140, 75], left: [25, 95, 48], right: [15, 65, 30],
        lightColor: [74, 222, 128], lightRadius: 4.0
      }
    },
    specialRoomChances: {
      vaultChance: 0.15,
      monsterPitChance: 0.12,
      sanctuaryChance: 0.10
    },
    monsterFamilies: {
      SLIME: 30,
      GOBLIN: 35,
      KOBOLD: 25,
      ORC: 15,
      ANIMAL: 20,
      SKELETON: 10
    },
    pitMonsterTypes: ['SLIME', 'GOBLIN', 'KOBOLD'],
    vaultTypes: ['TREASURE_CRYPT', 'RUINED_SHRINE', 'GEM_ALCOVE']
  },

  MINES_CATACOMBS: {
    id: 'MINES_CATACOMBS',
    themeIndex: 1,
    name: '버려진 광산과 납골당',
    nameEn: 'Mines & Catacombs',
    minFloor: 11,
    maxFloor: 20,
    description: '광부들이 파헤치다 버려진 갱도와 수많은 망자들의 유골이 안치된 음산한 지하 납골당.',
    ambientTexts: [
      '먼지 쌓인 목재 갱도 지지대가 삐걱거리는 소리를 냅니다.',
      '수많은 해골들이 벽면 틈새에서 공허한 눈빛으로 당신을 응시합니다.',
      '지하 깊은 곳에서 쇠사슬이 끌리는 불길한 소리가 들려옵니다.',
      '차가운 묘지 바람이 촛불을 흔들며 스쳐 지나갑니다.'
    ],
    colors: {
      wallChar: '#',
      floorChar: '.',
      wallColor: '#78716c',       // Stone 500
      floorColor: '#44403c',      // Stone 700
      corridorColor: '#292524',   // Stone 800
      vaultFloorColor: '#facc15', // Yellow 400 (Gold)
      pitFloorColor: '#fb7185',   // Rose 400
      doorColor: '#92400e',       // Amber 800
      trapColor: '#ea580c',       // Orange 600
      stairDownColor: '#f43f5e',
      stairUpColor: '#38bdf8',
      ambientLight: [160, 155, 140]
    },
    voxelColors: {
      wall: {
        top: [85, 80, 75], left: [55, 52, 48], right: [35, 33, 30],
        mortar: 'rgba(0,0,0,0.7)', bevel: 'rgba(255,255,255,0.1)',
        height: 2, pattern: 'stone'
      },
      floor: {
        top: [68, 64, 60], left: [44, 40, 38], right: [28, 25, 24],
        mortar: 'rgba(0,0,0,0.45)', bevel: 'rgba(255,255,255,0.15)',
        height: 0, pattern: 'stone'
      },
      vault: {
        top: [180, 145, 35], left: [120, 95, 20], right: [75, 58, 12],
        lightColor: [250, 204, 21], lightRadius: 4.8
      },
      pit: {
        top: [130, 45, 60], left: [85, 28, 38], right: [50, 16, 22],
        lightColor: [251, 113, 133], lightRadius: 4.2
      }
    },
    specialRoomChances: {
      vaultChance: 0.18,
      monsterPitChance: 0.15,
      sanctuaryChance: 0.08
    },
    monsterFamilies: {
      ORC: 30,
      SKELETON: 30,
      ZOMBIE: 25,
      GHOST: 15,
      SPIDER: 20,
      OGRE: 15
    },
    pitMonsterTypes: ['SKELETON', 'ZOMBIE', 'ORC', 'SPIDER'],
    vaultTypes: ['MINERS_VAULT', 'CATACOMB_MAUSOLEUM', 'FORGOTTEN_OSSURY']
  },

  VOLCANIC_FORTRESS: {
    id: 'VOLCANIC_FORTRESS',
    themeIndex: 2,
    name: '작열하는 화산 요새와 용암 동굴',
    nameEn: 'Volcanic Fortress & Lava Caverns',
    minFloor: 21,
    maxFloor: 30,
    description: '부글거리는 마그마와 흑요석 성벽으로 둘러싸인 화산 요새. 지옥의 열기와 유황 냄새가 진동합니다.',
    ambientTexts: [
      '발밑 바닥 틈새에서 시뻘건 마그마가 끓어오르며 열기를 뿜어냅니다.',
      '매캐한 유황 연기와 불꽃이 시야를 흐립니다.',
      '멀리서 화염 용의 거대한 포효가 지하 요새를 뒤흔듭니다.',
      '흑요석 벽면이 타오르는 불길을 반사하며 붉게 번쩍입니다.'
    ],
    colors: {
      wallChar: '#',
      floorChar: '.',
      wallColor: '#991b1b',       // Red 800 (Obsidian/Crimson)
      floorColor: '#450a0a',      // Red 950 (Dark Magma Crust)
      corridorColor: '#2a0808',
      vaultFloorColor: '#f97316', // Orange 500
      pitFloorColor: '#ef4444',   // Red 500
      doorColor: '#7c2d12',
      trapColor: '#dc2626',
      stairDownColor: '#f43f5e',
      stairUpColor: '#38bdf8',
      ambientLight: [230, 90, 40]
    },
    voxelColors: {
      wall: {
        top: [110, 25, 25], left: [70, 15, 15], right: [45, 10, 10],
        mortar: 'rgba(255,60,0,0.5)', bevel: 'rgba(255,180,50,0.25)',
        height: 2, pattern: 'brick'
      },
      floor: {
        top: [70, 20, 20], left: [45, 12, 12], right: [28, 8, 8],
        mortar: 'rgba(255,100,0,0.4)', bevel: 'rgba(255,150,50,0.2)',
        height: 0, pattern: 'magma'
      },
      vault: {
        top: [200, 100, 25], left: [135, 65, 15], right: [85, 38, 8],
        lightColor: [249, 115, 22], lightRadius: 5.2
      },
      pit: {
        top: [180, 35, 25], left: [115, 20, 15], right: [70, 10, 8],
        lightColor: [239, 68, 68], lightRadius: 4.8
      }
    },
    specialRoomChances: {
      vaultChance: 0.22,
      monsterPitChance: 0.18,
      sanctuaryChance: 0.06
    },
    monsterFamilies: {
      DRAGON: 25,
      TROLL: 25,
      DEMON: 20,
      OGRE: 20,
      FIRE_ELEMENTAL: 20,
      HELL_HOUND: 20
    },
    pitMonsterTypes: ['TROLL', 'OGRE', 'DEMON', 'DRAGON'],
    vaultTypes: ['VOLCANIC_TREASURY', 'DRAGON_HOARD', 'MAGMA_FORGE_SANCTUM']
  },

  DARK_ABYSS: {
    id: 'DARK_ABYSS',
    themeIndex: 3,
    name: '암흑 심연과 공허의 균열',
    nameEn: 'Dark Abyss & Void Rift',
    minFloor: 31,
    maxFloor: 40,
    description: '빛조차 흡수하는 절대 암흑의 공허. 비전 마법의 균열과 기괴한 심연의 존재들이 도사리고 있습니다.',
    ambientTexts: [
      '공허의 균열에서 기괴한 속삭임이 뇌리에 직접 울려 퍼집니다.',
      '시공간이 일그러지며 발밑 바닥이 보랏빛 잔상을 남깁니다.',
      '차가운 에테르 바람이 영혼을 얼어붙게 만듭니다.',
      '심연의 어둠 속에서 정체를 알 수 없는 거대한 촉수들이 스쳐 지나갑니다.'
    ],
    colors: {
      wallChar: '#',
      floorChar: '.',
      wallColor: '#581c87',       // Purple 900
      floorColor: '#2e1065',      // Purple 950
      corridorColor: '#1e0b40',
      vaultFloorColor: '#38bdf8', // Light Blue 400
      pitFloorColor: '#a855f7',   // Purple 500
      doorColor: '#6b21a8',
      trapColor: '#c084fc',
      stairDownColor: '#f43f5e',
      stairUpColor: '#38bdf8',
      ambientLight: [120, 60, 200]
    },
    voxelColors: {
      wall: {
        top: [65, 25, 105], left: [40, 15, 68], right: [25, 8, 42],
        mortar: 'rgba(168,85,247,0.4)', bevel: 'rgba(216,180,254,0.2)',
        height: 2, pattern: 'rune'
      },
      floor: {
        top: [42, 18, 75], left: [26, 10, 48], right: [16, 6, 30],
        mortar: 'rgba(147,51,234,0.3)', bevel: 'rgba(192,132,252,0.18)',
        height: 0, pattern: 'crystal'
      },
      vault: {
        top: [45, 145, 190], left: [28, 95, 130], right: [16, 60, 85],
        lightColor: [56, 189, 248], lightRadius: 5.5
      },
      pit: {
        top: [125, 45, 190], left: [80, 26, 128], right: [48, 15, 80],
        lightColor: [168, 85, 247], lightRadius: 5.0
      }
    },
    specialRoomChances: {
      vaultChance: 0.25,
      monsterPitChance: 0.22,
      sanctuaryChance: 0.05
    },
    monsterFamilies: {
      DEMON: 30,
      WRAITH: 25,
      SHADOW: 25,
      DRAGON: 20,
      TITAN: 20,
      LICH: 15
    },
    pitMonsterTypes: ['DEMON', 'WRAITH', 'SHADOW', 'DRAGON'],
    vaultTypes: ['ASTRAL_VAULT', 'VOID_TREASURY', 'ELDRITCH_SANCTUM']
  },

  DEEP_ANGBAND: {
    id: 'DEEP_ANGBAND',
    themeIndex: 4,
    name: '앙그반드 심층과 모르고스의 옥좌',
    nameEn: 'Deep Angband & Throne of Morgoth',
    minFloor: 41,
    maxFloor: 50,
    description: '암흑의 군주 모르고스가 군림하는 철의 요새 최심부. 궁극의 악과 발록, 고룡들이 수호하는 종말의 성소.',
    ambientTexts: [
      '철왕관의 불경한 광채가 사방의 핏빛 벽면을 번뜩입니다.',
      '발록들의 채찍 소리와 고대 용들의 지축을 울리는 숨결이 전율을 일으킵니다.',
      '모르고스의 거대한 옥좌에서 발산되는 압도적인 공포가 숨통을 죄어옵니다.',
      '지하 50층, 세상의 모든 빛이 소멸된 궁극의 종착지에 도달했습니다.'
    ],
    colors: {
      wallChar: '#',
      floorChar: '.',
      wallColor: '#881337',       // Rose 900
      floorColor: '#1c1917',      // Stone 900
      corridorColor: '#0c0a09',
      vaultFloorColor: '#e11d48', // Rose 600
      pitFloorColor: '#b91c1c',   // Red 700
      doorColor: '#4c0519',
      trapColor: '#f43f5e',
      stairDownColor: '#f43f5e',
      stairUpColor: '#38bdf8',
      ambientLight: [180, 30, 50]
    },
    voxelColors: {
      wall: {
        top: [95, 18, 40], left: [60, 10, 25], right: [38, 6, 16],
        mortar: 'rgba(244,63,94,0.45)', bevel: 'rgba(255,200,220,0.25)',
        height: 2, pattern: 'brick'
      },
      floor: {
        top: [36, 32, 34], left: [24, 20, 22], right: [15, 12, 14],
        mortar: 'rgba(225,29,72,0.35)', bevel: 'rgba(251,113,133,0.2)',
        height: 0, pattern: 'rune'
      },
      vault: {
        top: [190, 25, 65], left: [130, 15, 42], right: [80, 8, 25],
        lightColor: [225, 29, 72], lightRadius: 6.0
      },
      pit: {
        top: [160, 20, 25], left: [105, 12, 15], right: [65, 8, 10],
        lightColor: [185, 28, 28], lightRadius: 5.5
      }
    },
    specialRoomChances: {
      vaultChance: 0.30,
      monsterPitChance: 0.28,
      sanctuaryChance: 0.04
    },
    monsterFamilies: {
      DRAGON: 30,
      DEMON: 30,
      TITAN: 25,
      ANGEL: 20,
      OGRE: 15,
      WRAITH: 20
    },
    pitMonsterTypes: ['DRAGON', 'DEMON', 'TITAN', 'ANGEL'],
    vaultTypes: ['MORGOTH_TREASURY', 'BALROG_HOARD', 'IRON_CROWN_SANCTUM']
  }
};

/**
 * 던전 층수(1~50)에 따른 적합한 테마 객체를 조회합니다.
 * 50층을 초과하는 경우 심층(DEEP_ANGBAND) 테마가 적용됩니다.
 * @param {number} floor - 탐험 중인 던전 층수 (1-indexed)
 * @returns {object} 테마 설정 객체
 */
export function getThemeForFloor(floor = 1) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  if (safeFloor <= 10) return DUNGEON_THEMES.CAVE_RUINS;
  if (safeFloor <= 20) return DUNGEON_THEMES.MINES_CATACOMBS;
  if (safeFloor <= 30) return DUNGEON_THEMES.VOLCANIC_FORTRESS;
  if (safeFloor <= 40) return DUNGEON_THEMES.DARK_ABYSS;
  return DUNGEON_THEMES.DEEP_ANGBAND;
}

/**
 * 테마 키(ID)로 테마 설정 객체를 조회합니다.
 * @param {string} themeKey - 테마 ID ('CAVE_RUINS', 'MINES_CATACOMBS' 등)
 * @returns {object} 테마 설정 객체 (없을 시 CAVE_RUINS 반환)
 */
export function getThemeConfig(themeKey) {
  return DUNGEON_THEMES[themeKey] || DUNGEON_THEMES.CAVE_RUINS;
}

/**
 * 현재 층수에 대응하는 무작위 분위기(Ambient) 설명 텍스트를 반환합니다.
 * @param {number} floor - 탐험 중인 던전 층수
 * @returns {string} 분위기 텍스트
 */
export function getAmbientText(floor = 1) {
  const theme = getThemeForFloor(floor);
  if (!theme || !theme.ambientTexts || theme.ambientTexts.length === 0) {
    return '던전의 차가운 정적이 주위를 감쌉니다.';
  }
  const idx = Math.floor(Math.random() * theme.ambientTexts.length);
  return theme.ambientTexts[idx];
}

/**
 * 현재 층수 테마에 기반하여 몬스터 피트(Monster Pit)에 배치될 단일 종족을 롤링합니다.
 * @param {number} floor - 던전 층수
 * @returns {string} 몬스터 종족 식별자
 */
export function getRandomPitMonsterSpecies(floor = 1) {
  const theme = getThemeForFloor(floor);
  const pool = theme.pitMonsterTypes && theme.pitMonsterTypes.length > 0
    ? theme.pitMonsterTypes
    : ['GOBLIN'];
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * 층수에 따른 렌더링 색상 팔레트를 반환합니다.
 * @param {number} floor - 던전 층수
 * @returns {object} 벽, 바닥, 금고, 피트 색상 팔레트
 */
export function getThemeColors(floor = 1) {
  const theme = getThemeForFloor(floor);
  return theme.colors;
}

/**
 * 층수에 따른 특수방(Vault, Monster Pit, Sanctuary) 발생 확률을 반환합니다.
 * 1~5층은 초심자 보호를 위해 Vault 0%, Pit 0%가 적용됩니다.
 * @param {number} floor - 던전 층수
 * @returns {{ vaultChance: number, monsterPitChance: number, sanctuaryChance: number }}
 */
export function getSpecialRoomChancesForFloor(floor = 1) {
  const safeFloor = Math.max(1, Math.floor(floor || 1));
  if (safeFloor <= 5) {
    return { vaultChance: 0.0, monsterPitChance: 0.0, sanctuaryChance: 0.10 };
  }
  const theme = getThemeForFloor(safeFloor);
  return theme.specialRoomChances || { vaultChance: 0.15, monsterPitChance: 0.12, sanctuaryChance: 0.10 };
}
