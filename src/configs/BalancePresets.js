/**
 * @module BalancePresets
 * @category configs
 * @description 미미크리 복셀 4대 밸런스 프리셋 및 사용자 정의 모디파이어 레지스트리
 * @purity Pure Constants
 * @dependencies none
 * @exports BALANCE_PRESET_TYPES, BALANCE_PRESETS, getPresetConfig
 */

export const BALANCE_PRESET_TYPES = {
  CLASSIC_TOME: 'CLASSIC_TOME',
  CASUAL_EXPLORER: 'CASUAL_EXPLORER',
  CHAOS_VOXEL: 'CHAOS_VOXEL',
  NIGHTMARE_ABYSS: 'NIGHTMARE_ABYSS',
  CUSTOM: 'CUSTOM'
};

export const BALANCE_PRESETS = {
  CLASSIC_TOME: {
    id: 'CLASSIC_TOME',
    name: '📜 정통 ToME 2.3.5 (Classic Hardcore)',
    desc: '원작 로그라이크의 가혹한 영구 사망, 엄격한 자원 관리, 정통 톨킨 판타지 생태계를 그대로 계승합니다.',
    badgeColor: '#38bdf8',
    spawn: {
      allowJokeMonsters: false,
      monsterDensityMultiplier: 1.0,
      oodRollChanceCap: 0.10,
      uniqueSpawnRate: 1.0
    },
    map: {
      mapSizeScale: 1.0,
      roomDensity: 'STANDARD',
      stairCountMultiplier: 1.0
    },
    loot: {
      itemDropMultiplier: 1.0,
      goldDropMultiplier: 1.0,
      egoDropMultiplier: 1.0,
      artifactRarityMultiplier: 1.0
    },
    gameplay: {
      deathPenaltyMode: 'PERMADEATH',
      cooldownRecoveryMultiplier: 1.0,
      playerDamageReductionBonus: 0.0,
      coreDevourEfficiency: 1.0
    }
  },

  CASUAL_EXPLORER: {
    id: 'CASUAL_EXPLORER',
    name: '🌿 캐주얼 탐험가 (Casual Explorer)',
    desc: '층계 부활 체크포인트, 저층 OOD 원천 차단, 풍부한 전리품과 쿨타임 가속으로 쾌적한 던전 탐험을 제공합니다.',
    badgeColor: '#34d399',
    spawn: {
      allowJokeMonsters: false,
      monsterDensityMultiplier: 0.75,
      oodRollChanceCap: 0.00,
      uniqueSpawnRate: 0.8
    },
    map: {
      mapSizeScale: 0.9,
      roomDensity: 'COMPACT',
      stairCountMultiplier: 1.3
    },
    loot: {
      itemDropMultiplier: 2.0,
      goldDropMultiplier: 2.0,
      egoDropMultiplier: 1.5,
      artifactRarityMultiplier: 1.8
    },
    gameplay: {
      deathPenaltyMode: 'CHECKPOINT',
      cooldownRecoveryMultiplier: 1.5,
      playerDamageReductionBonus: 0.20,
      coreDevourEfficiency: 1.5
    }
  },

  CHAOS_VOXEL: {
    id: 'CHAOS_VOXEL',
    name: '💥 카오스 복셀 (Chaos Voxel Sandbox)',
    desc: '조크 몬스터 100% 개방, 몬스터 대량 웨이브 스폰, 전리품 폭발과 스킬 난사가 펼쳐지는 핵앤슬래시 모드입니다.',
    badgeColor: '#fbbf24',
    spawn: {
      allowJokeMonsters: true,
      monsterDensityMultiplier: 2.2,
      oodRollChanceCap: 0.25,
      uniqueSpawnRate: 2.0
    },
    map: {
      mapSizeScale: 1.25,
      roomDensity: 'LABYRINTH',
      stairCountMultiplier: 1.5
    },
    loot: {
      itemDropMultiplier: 3.5,
      goldDropMultiplier: 3.0,
      egoDropMultiplier: 2.5,
      artifactRarityMultiplier: 3.0
    },
    gameplay: {
      deathPenaltyMode: 'ROGUE_LITE',
      cooldownRecoveryMultiplier: 2.0,
      playerDamageReductionBonus: 0.10,
      coreDevourEfficiency: 2.0
    }
  },

  NIGHTMARE_ABYSS: {
    id: 'NIGHTMARE_ABYSS',
    name: '💀 악몽의 심연 (Nightmare Abyss)',
    desc: '한 치의 실수도 용납되지 않는 극한의 난이도. 심층 몬스터 돌발 유입, 피격 피해 증가, 희귀한 보급품.',
    badgeColor: '#f43f5e',
    spawn: {
      allowJokeMonsters: false,
      monsterDensityMultiplier: 1.5,
      oodRollChanceCap: 0.20,
      uniqueSpawnRate: 1.5
    },
    map: {
      mapSizeScale: 1.1,
      roomDensity: 'STANDARD',
      stairCountMultiplier: 0.8
    },
    loot: {
      itemDropMultiplier: 0.6,
      goldDropMultiplier: 0.6,
      egoDropMultiplier: 0.7,
      artifactRarityMultiplier: 0.5
    },
    gameplay: {
      deathPenaltyMode: 'IRONMAN',
      cooldownRecoveryMultiplier: 0.8,
      playerDamageReductionBonus: -0.15,
      coreDevourEfficiency: 0.7
    }
  }
};

/**
 * 지정된 프리셋 ID의 설정을 반환합니다. 유효하지 않은 경우 CLASSIC_TOME을 기본으로 반환합니다.
 * @param {string} presetType
 * @returns {Object} 프리셋 설정 객체
 */
export function getPresetConfig(presetType) {
  return BALANCE_PRESETS[presetType] || BALANCE_PRESETS.CLASSIC_TOME;
}
