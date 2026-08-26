/**
 * @module ArtifactActivationEngine
 * @category systems
 * @description ToME 2.3.5 정통 183종 전설 유물의 고유 발동(Activation: ACT_SUNLIGHT, ACT_BO_ACID_1,
 *              ACT_BA_COLD_1, ACT_HEAL_1, ACT_RESTORE_STAT, ACT_WORD_OF_RECALL, ACT_GROND, ACT_THRAIN 등)을
 *              식별하고 쿨다운(Cooldown) 관리 및 특수 주문 효과를 발동하는 순수 무상태 유물 발동 엔진.
 * @purity Stateless System
 * @dependencies TomeArtifactsData.js, TomeSpellEngine.js, UnifiedTraitEngine.js
 * @exports ArtifactActivationEngine, TOME_ARTIFACT_ACTIVATIONS, ARTIFACT_KEY_TO_ACTIVATION
 */

import { TOME_ARTIFACTS_DATA } from '../entities/TomeArtifactsData.js';
import { UnifiedTraitEngine } from './UnifiedTraitEngine.js';

// 78종 ToME 정통 발동 주문 메타데이터 카탈로그
export const TOME_ARTIFACT_ACTIVATIONS = Object.freeze({
  'LIGHT': { name: '태양의 광휘 방출 (Light)', cooldown: 10, type: 'LIGHT', dice: '10d10', desc: '주변을 환하게 밝히고 언데드/빛 취약 적에게 10d10의 태양광 피해를 입힙니다.' },
  'SUNLIGHT': { name: '태양의 광휘 방출 (Sunlight)', cooldown: 10, type: 'LIGHT', dice: '10d10', desc: '주변을 환하게 밝히고 빛 피해를 입힙니다.' },
  'MAP_LIGHT': { name: '비전 마법 지도 & 광원 (Map & Light)', cooldown: 20, type: 'UTILITY', desc: '현재 층의 지형과 구조를 감지하여 맵을 밝힙니다.' },
  'THRAIN': { name: '스레인의 대보물 (Heart of the Mountain)', cooldown: 150, type: 'RESTORATION', desc: '투시경, 주변 조명, 500 HP 치유 및 모든 저하된 스탯을 완전히 회복합니다.' },
  'PROT_EVIL': { name: '악령 퇴치 결계 (Protection from Evil)', cooldown: 100, type: 'BUFF', desc: '사악한 몬스터의 접근과 공격을 막아내는 신성 결계를 형성합니다.' },
  'DISP_EVIL': { name: '악령 일괄 소멸 (Dispel Evil)', cooldown: 300, type: 'DISPEL', dice: '500', desc: '시야 내 모든 사악한 존재에게 500의 신성 파멸 피해를 가합니다.' },
  'DIM_DOOR': { name: '차원의 문 (Dimension Door)', cooldown: 50, type: 'TELEPORT', desc: '원하는 안전한 지점으로 단거리 차원 도약을 실행합니다.' },
  'BARAHIR': { name: '바라히르의 축복 (Blessing of Barahir)', cooldown: 100, type: 'HEAL', healAmount: 300, desc: '300 HP를 즉시 회복하고 모든 스탯을 원상 복구합니다.' },
  'TULKAS': { name: '툴카스의 광폭 신속 (Speed of Tulkas)', cooldown: 150, type: 'BUFF', speed: 10, turns: 50, desc: '50턴 동안 속도를 +10 증가시킵니다.' },
  'NARYA': { name: '불의 반지 나랴 (Narya Fire Storm)', cooldown: 200, type: 'AOE', element: 'FIRE', dice: '200', desc: '200의 화염 폭풍구를 투사하고 50턴간 가속합니다.' },
  'NENYA': { name: '물의 반지 네냐 (Nenya Frost & Heal)', cooldown: 200, type: 'HYBRID', element: 'COLD', dice: '200', healAmount: 300, desc: '200의 빙결 폭풍구를 투사하고 300 HP를 회복합니다.' },
  'VILYA': { name: '공기의 반지 빌랴 (Vilya Lightning Storm)', cooldown: 200, type: 'AOE', element: 'ELEC', dice: '250', desc: '250의 뇌격 폭풍구를 방출하고 지도를 탐지합니다.' },
  'POWER': { name: '절대반지의 권능 (The One Ring Power)', cooldown: 400, type: 'ULTIMATE', dice: '600', desc: '모든 주변 적에게 600의 절대 파멸 피해를 가하고 스탯을 극대화합니다.' },
  'ERU': { name: '일루바타르의 은총 (Grace of Eru)', cooldown: 500, type: 'ULTIMATE', healAmount: 1000, dice: '1000', desc: '1000 HP 완전 치유, 1000 악령 소멸 및 무적 결계를 발동합니다.' },

  // 볼트 계열
  'BO_ACID_1': { name: '산성 볼트 I', cooldown: 10, type: 'BOLT', element: 'ACID', dice: '3d8+10', desc: '강력한 산성 볼트를 투사합니다.' },
  'BO_COLD_1': { name: '냉기 볼트 I', cooldown: 10, type: 'BOLT', element: 'COLD', dice: '3d8+10', desc: '냉기 서리 볼트를 투사합니다.' },
  'BO_ELEC_1': { name: '전격 볼트 I', cooldown: 10, type: 'BOLT', element: 'ELEC', dice: '4d8+10', desc: '번개 볼트를 투사합니다.' },
  'BO_FIRE_1': { name: '화염 볼트 I', cooldown: 15, type: 'BOLT', element: 'FIRE', dice: '9d8', desc: '화염 볼트를 투사합니다.' },
  'BO_MISS_1': { name: '마법 미사일 I', cooldown: 5, type: 'BOLT', element: 'MANA', dice: '2d6', desc: '비전 마법 미사일을 발사합니다.' },
  'BO_MISS_2': { name: '상급 마법 미사일 II', cooldown: 8, type: 'BOLT', element: 'MANA', dice: '3d6+5', desc: '강화된 마법 미사일을 발사합니다.' },

  // 볼(AoE) 계열
  'BA_FIRE_1': { name: '화염구 폭발 (Fire Ball 72)', cooldown: 50, type: 'AOE', element: 'FIRE', dice: '72', desc: '반경 내 적들에게 72의 화염구 폭발을 일으킵니다.' },
  'BA_COLD_1': { name: '빙결구 폭발 (Frost Ball 48)', cooldown: 40, type: 'AOE', element: 'COLD', dice: '48', desc: '반경 내 적들에게 48의 냉기 폭발을 일으킵니다.' },
  'BA_COLD_2': { name: '대빙결구 폭발 (Frost Ball 100)', cooldown: 80, type: 'AOE', element: 'COLD', dice: '100', desc: '반경 내 적들에게 100의 상급 냉기 폭발을 일으킵니다.' },
  'BA_ELEC_2': { name: '대뇌격구 폭발 (Lightning Ball 100)', cooldown: 80, type: 'AOE', element: 'ELEC', dice: '100', desc: '반경 내 적들에게 100의 상급 전격 폭발을 일으킵니다.' },
  'BA_POIS_1': { name: '악취 구름 (Stinking Cloud 12)', cooldown: 20, type: 'AOE', element: 'POISON', dice: '12', desc: '독가스 구름을 피워 지속 피해를 줍니다.' },

  // 회복 및 정화
  'CURE_MW': { name: '중상 치료 (Cure Medium Wounds)', cooldown: 20, type: 'HEAL', dice: '4d8', desc: '4d8의 체력을 회복하고 출혈을 치료합니다.' },
  'HEAL_1': { name: '중상 치료 (Heal I)', cooldown: 20, type: 'HEAL', dice: '4d8', desc: '체력을 회복합니다.' },
  'CURE_700': { name: '상급 치유 (Heal 700)', cooldown: 100, type: 'HEAL', healAmount: 700, desc: '700 HP를 즉시 회복하고 모든 상태이상을 치유합니다.' },
  'CURE_1000': { name: '궁극 치유 (Heal 1000)', cooldown: 200, type: 'HEAL', healAmount: 1000, desc: '1000 HP를 즉시 회복하고 모든 상태이상을 완전 정화합니다.' },
  'CURE_POISON': { name: '해독 (Neutralize Poison)', cooldown: 15, type: 'HEAL', desc: '몸 안의 모든 맹독을 즉시 정화합니다.' },
  'REST_ALL': { name: '전 스탯 복구 (Restore All Stats)', cooldown: 150, type: 'RESTORATION', desc: '드레인된 6대 스탯을 원래 수치로 복구합니다.' },
  'RESTORE_STAT': { name: '전 스탯 복구 (Restore Stats)', cooldown: 150, type: 'RESTORATION', desc: '저하된 스탯을 복구합니다.' },
  'REST_LIFE': { name: '생명력 복원 (Restore Life)', cooldown: 200, type: 'RESTORATION', desc: '흡수당한 경험치와 영혼 생명력을 원상 복구합니다.' },
  'RECALL': { name: '귀환의 단어 (Word of Recall)', cooldown: 200, type: 'UTILITY', desc: '마을과 깊은 던전 사이를 안전하게 전이합니다.' },
  'WORD_OF_RECALL': { name: '귀환의 단어 (Word of Recall)', cooldown: 200, type: 'UTILITY', desc: '던전과 마을 사이를 전이합니다.' },

  // 버프 및 상태
  'SPEED': { name: '가속 (Haste Self)', cooldown: 100, type: 'BUFF', speed: 5, turns: 30, desc: '30턴 동안 속도를 +5 증가시킵니다.' },
  'TELEPORT': { name: '공간 이동 (Teleport)', cooldown: 45, type: 'TELEPORT', range: 100, desc: '던전 내 무작위 안전 지점으로 즉시 순간이동합니다.' },
  'TELE_AWAY': { name: '적 추방 (Teleport Away)', cooldown: 50, type: 'UTILITY', desc: '마주한 적을 먼 곳으로 강제 추방합니다.' },
  'GENOCIDE': { name: '단일 종족 말살 (Genocide)', cooldown: 300, type: 'PURGE', desc: '지정한 몬스터 종족을 현재 층에서 완전히 소멸시킵니다.' },
  'MASS_GENO': { name: '주변 적 대량 말살 (Mass Genocide)', cooldown: 400, type: 'PURGE', desc: '플레이어 주변의 모든 일반 몬스터를 일괄 소멸시킵니다.' },

  // 네임드 유물 고유 발동
  'GROND': { name: '그론드의 대지 진동 (Grond Earth Shatter)', cooldown: 250, type: 'AOE', element: 'PHYSICAL', dice: '300', desc: '대지를 강타하여 300의 지진 피해를 입히고 벽을 부숩니다.' },
  'GANDALF': { name: '간달프의 마나 폭풍 (Gandalf Mana Storm)', cooldown: 250, type: 'AOE', element: 'MANA', dice: '300', desc: '300의 마나 폭풍과 영구적인 섬광을 방출합니다.' },
  'BOROMIR': { name: '보로미르의 뿔나팔 (Horn of Boromir)', cooldown: 60, type: 'DEBUFF', effect: 'FEAR_STUN', desc: '주변 모든 적을 공포에 떨게 하고 3턴간 기절시킵니다.' },
  'HURIN': { name: '후린의 전투 함성 (Battle Cry of Hurin)', cooldown: 80, type: 'BUFF', desc: '영웅심을 고취하여 공격력 +10, 최대 체력 +20, 공포 면역을 얻습니다.' },
  'TURMIL': { name: '투르밀의 성스러운 축복 (Blessing of Turmil)', cooldown: 70, type: 'BUFF', desc: '방어력 +10, 명중률 +10의 신성 축복을 받습니다.' },
  'BLADETURNER': { name: '블레이드터너 절대 방어 (Blade Turner)', cooldown: 200, type: 'BUFF', desc: '20턴 동안 AC +50 및 모든 원소 저항 +50%를 얻습니다.' },
  'RAZORBACK': { name: '레이저백 별빛 폭발 (Star Burst)', cooldown: 120, type: 'AOE', element: 'LIGHT', dice: '150', desc: '8방향으로 150의 광휘 및 전격 레이저를 방출합니다.' },
  'EREBOR': { name: '에레보르의 성벽 (Erebor Fortification)', cooldown: 90, type: 'UTILITY', desc: '암석을 진흙으로 바꾸고 견고한 방어벽을 구축합니다.' },
  'CELEBRIMBOR': { name: '켈레브림보르의 마나 쇄도 (Celebrimbor Surge)', cooldown: 120, type: 'UTILITY', desc: '모든 지팡이와 완드의 마력을 완충하고 마나를 회복합니다.' },
  'RECHARGE': { name: '마력 재충전 (Recharge)', cooldown: 70, type: 'UTILITY', desc: '장착된 마법 도구의 충전량을 회복합니다.' },
  'SLEEP': { name: '최면 수면 (Mass Sleep)', cooldown: 55, type: 'DEBUFF', effect: 'SLEEP', desc: '주변 모든 몬스터를 깊은 잠에 빠뜨립니다.' },
  'CONFUSE': { name: '혼란 유발 (Confuse)', cooldown: 45, type: 'DEBUFF', effect: 'CONFUSION', desc: '적에게 혼란 상태를 부여합니다.' },
  'DETECT_ALL': { name: '만물 탐지 (Detect All)', cooldown: 60, type: 'DETECT', desc: '현재 층의 모든 몬스터, 아이템, 함정, 계단을 탐지합니다.' },
  'DETECT_XTRA': { name: '보물 및 마력 탐지 (Detect Extra)', cooldown: 40, type: 'DETECT', desc: '주변의 마법 보물과 유물을 탐지합니다.' },
  'STONE_MUD': { name: '암석 용해 (Stone to Mud)', cooldown: 25, type: 'UTILITY', desc: '전방의 암석 벽을 녹여 통로를 만듭니다.' },
  'DEST_DOOR': { name: '문 및 함정 파괴 (Destroy Doors/Traps)', cooldown: 15, type: 'UTILITY', desc: '인접한 잠긴 문과 위험한 함정을 즉시 파괴합니다.' },
  'UNDEATH': { name: '사령의 손길 (Undeath Nether Bolt)', cooldown: 120, type: 'BOLT', element: 'NETHER', dice: '150', desc: '150의 사령 피해를 입히고 체력을 흡수합니다.' },
  'NATUREBANE': { name: '자연의 진동 (Nature Shockwave)', cooldown: 90, type: 'AOE', element: 'PHYSICAL', dice: '100', desc: '100의 자연 충격파를 방출합니다.' },
  'FUNDIN': { name: '푼딘의 드워프 광원 (Fundin Light)', cooldown: 50, type: 'LIGHT', dice: '50', desc: '석재 투시 시야와 광원을 제공합니다.' },
  'GORLIM': { name: '고를림의 그림자 은폐 (Gorlim Shadow Cloak)', cooldown: 100, type: 'BUFF', desc: '그림자 속으로 몸을 숨겨 투명 상태를 얻습니다.' },
  'EOL': { name: '에올의 암흑 볼트 (Eol Dark Bolt)', cooldown: 80, type: 'BOLT', element: 'DARK', dice: '120', desc: '120의 암흑 볼트를 발사하고 적의 마나를 소진시킵니다.' },
  'ORCHAST': { name: '오르크 수면 (Orchast Orc Slumber)', cooldown: 60, type: 'DEBUFF', effect: 'SLEEP', desc: '오크 및 주변 적들을 잠재웁니다.' },
  'PALANTIR': { name: '팔란티르의 천리안 (Palantir True Seeing)', cooldown: 250, type: 'BUFF', desc: '100턴 동안 전체 텔레파시와 진실의 시야를 얻습니다.' },
  'DAWN': { name: '여명의 서광 (Dawn Sunlight Ray)', cooldown: 40, type: 'LIGHT', dice: '80', desc: '서광의 빛을 뿜어 어둠을 몰아내고 80의 빛 피해를 입힙니다.' },
  'NIGHT': { name: '밤의 장막 (Night Darkness Storm)', cooldown: 60, type: 'AOE', element: 'DARK', dice: '80', desc: '암흑의 폭풍을 일으켜 적들을 실명시킵니다.' },
  'CUBRAGOL': { name: '쿠브라골 화염 화살 (Cubragol Fire Strike)', cooldown: 30, type: 'BOLT', element: 'FIRE', dice: '100', desc: '100의 작열하는 화염 화살을 투사합니다.' },
  'BELANGIL': { name: '벨란길 빙결 화살 (Belangil Frost Strike)', cooldown: 30, type: 'BOLT', element: 'COLD', dice: '100', desc: '100의 서리 빙결 화살을 투사합니다.' },
  'BELEGENNON': { name: '벨레겐논 전격 방출 (Belegennon Spark)', cooldown: 40, type: 'BOLT', element: 'ELEC', dice: '120', desc: '120의 뇌격 전기를 투사합니다.' },
  'COLLUIN': { name: '콜루인 원소 보호막 (Colluin Elemental Ward)', cooldown: 120, type: 'BUFF', desc: '30턴 동안 모든 원소 저항 결계를 생성합니다.' },
  'DRAIN_2': { name: '흡혈의 입맞춤 (Vampiric Drain)', cooldown: 80, type: 'BOLT', element: 'DARK', dice: '120', desc: '120의 피해를 입히고 가한 피해만큼 체력을 흡수합니다.' },
  'DRUEDAIN': { name: '드루에다인의 위장술 (Druedain Camouflage)', cooldown: 60, type: 'BUFF', desc: '자연과 동화되어 회복력을 극대화합니다.' },
  'ELESSAR': { name: '엘레사르 왕의 치유 (Elessar Royal Heal)', cooldown: 150, type: 'HEAL', healAmount: 400, desc: '400 HP 회복 및 모든 저주를 정화합니다.' },
  'FIRESTAR': { name: '화염별 투사 (Firestar)', cooldown: 50, type: 'AOE', element: 'FIRE', dice: '100', desc: '100의 화염구 폭발을 일으킵니다.' },
  'GILGALAD': { name: '길갈라드의 별빛 창 (Gil-galad Starlight)', cooldown: 80, type: 'BOLT', element: 'LIGHT', dice: '150', desc: '150의 순수 별빛 광선을 투사합니다.' },
  'HARADRIM': { name: '하라드림의 모래 폭풍 (Haradrim Sandstorm)', cooldown: 60, type: 'AOE', element: 'POISON', dice: '80', desc: '80의 모래 독풍 피해를 입힙니다.' },
  'HELM': { name: '헬름의 강철 정신 (Helm of Hammerhand)', cooldown: 100, type: 'BUFF', desc: '텔레파시와 정신 방어막을 부여합니다.' },
  'LEBOHAUM': { name: '레보하움 용족 퇴치 (Lebohaum Dragon Ward)', cooldown: 80, type: 'BUFF', desc: '용족에 대한 절대 공포 면역과 방어력을 얻습니다.' },
  'MAGGOT': { name: '매곳 농부의 사냥개 소환 (Farmer Maggot Dogs)', cooldown: 120, type: 'SUMMON', count: 2, desc: '충성스러운 사냥개 2마리를 아군으로 소환합니다.' },
  'MEDIATOR': { name: '중재자의 평화 (Mediator Pacify)', cooldown: 90, type: 'DEBUFF', effect: 'PACIFY', desc: '적들의 적대감을 가라앉히고 진정시킵니다.' },
  'ROHAN': { name: '로한의 기마 질주 (Rohan Cavalier Haste)', cooldown: 100, type: 'BUFF', speed: 7, turns: 30, desc: '30턴 동안 속도를 +7 증가시킵니다.' },
  'SKULLCLEAVER': { name: '스컬클리버 파쇄격 (Skullcleaver Strike)', cooldown: 75, type: 'BOLT', element: 'PHYSICAL', dice: '200', desc: '200의 묵직한 물리 파쇄 피해를 가합니다.' },
  'UMBAR': { name: '움바르의 암습 (Umbar Shadow Strike)', cooldown: 70, type: 'HYBRID', dice: '100', desc: '100의 암습 피해를 입히고 단거리 점멸합니다.' },
  'AXE_GOTHMOG': { name: '고스모그의 화염 도끼 (Axe of Gothmog)', cooldown: 200, type: 'AOE', element: 'FIRE', dice: '300', desc: '300의 지옥불과 혼돈의 참격을 가합니다.' }
});

// ToME 정통 183종 유물 Key -> 발동 키 1:1 매핑 테이블
export const ARTIFACT_KEY_TO_ACTIVATION = Object.freeze({
  'ART_OF_GALADRIEL': 'LIGHT',
  'ART_OF_ELENDIL': 'MAP_LIGHT',
  'ART_OF_THRAIN': 'THRAIN',
  'ART_OF_CARLAMMAS': 'PROT_EVIL',
  'ART_OF_INGWE': 'DISP_EVIL',
  'ART_OF_FLARE': 'DIM_DOOR',
  'ART_OF_BARAHIR': 'BARAHIR',
  'ART_OF_TULKAS': 'TULKAS',
  'ART_OF_POWER_NARYA': 'NARYA',
  'ART_OF_POWER_NENYA': 'NENYA',
  'ART_OF_POWER_VILYA': 'VILYA',
  'ART_OF_POWER_THE_ONE_RING': 'POWER',
  'ART_RAZORBACK': 'RAZORBACK',
  'ART_OF_ETERNITY': 'ERU',
  'ART_SOULKEEPER': 'CURE_1000',
  'ART_BELEGENNON': 'BELEGENNON',
  'ART_OF_CELEBORN': 'GENOCIDE',
  'ART_OF_CASPANION': 'DEST_DOOR',
  'ART_OF_HURIN': 'HURIN',
  'ART_OF_DOR_LOMIN': 'GORLIM',
  'ART_CAMMITHRIM': 'BO_MISS_1',
  'ART_OF_FINGOLFIN': 'SPEED',
  'ART_RINGIL': 'BO_COLD_1',
  'ART_GROND': 'GROND',
  'ART_OF_GANDALF': 'GANDALF',
  'ART_OF_BOROMIR': 'BOROMIR',
  'ART_OF_TURMIL': 'TURMIL',
  'ART_BLADETURNER': 'BLADETURNER',
  'ART_OF_EREBOR': 'EREBOR',
  'ART_OF_CELEBRIMBOR': 'CELEBRIMBOR',
  'ART_OF_THORIN': 'BO_ACID_1',
  'ART_OF_GIL_GALAD': 'GILGALAD',
  'ART_OF_THE_HARADRIM': 'HARADRIM',
  'ART_SKULLCLEAVER': 'SKULLCLEAVER',
  'ART_CUBRAGOL': 'CUBRAGOL',
  'ART_BELANGIL': 'BELANGIL',
  'ART_COLLUIN': 'COLLUIN',
  'ART_ELESSAR': 'ELESSAR',
  'ART_FIRESTAR': 'FIRESTAR',
  'ART_OF_HELM_HAMMERHAND': 'HELM',
  'ART_OF_FARMER_MAGGOT': 'MAGGOT',
  'ART_OF_GOTHMOG': 'AXE_GOTHMOG'
});

export class ArtifactActivationEngine {
  /**
   * 유물 아이템 또는 키로부터 발동 메타데이터를 식별합니다.
   * @param {Object|string} itemOrKey
   * @returns {{ key: string, spec: Object }|null}
   */
  static resolveArtifactActivation(itemOrKey) {
    if (!itemOrKey) return null;

    let artKey = null;
    let actKey = null;

    if (typeof itemOrKey === 'string') {
      if (TOME_ARTIFACT_ACTIVATIONS[itemOrKey]) {
        return { key: itemOrKey, spec: TOME_ARTIFACT_ACTIVATIONS[itemOrKey] };
      }
      artKey = itemOrKey;
    } else if (typeof itemOrKey === 'object') {
      actKey = itemOrKey.activate || itemOrKey.activation;
      artKey = itemOrKey.artifactKey || itemOrKey.key;
    }

    if (!actKey && artKey) {
      actKey = ARTIFACT_KEY_TO_ACTIVATION[artKey];
    }

    if (actKey) {
      const cleanKey = actKey.startsWith('ACT_') ? actKey.slice(4) : actKey;
      const spec = TOME_ARTIFACT_ACTIVATIONS[cleanKey] || TOME_ARTIFACT_ACTIVATIONS[actKey] || TOME_ARTIFACT_ACTIVATIONS[`ACT_${cleanKey}`];
      if (spec) {
        return { key: cleanKey, spec };
      }
    }

    // TOME_ARTIFACTS_DATA 연동
    if (artKey && TOME_ARTIFACTS_DATA[artKey]) {
      const artData = TOME_ARTIFACTS_DATA[artKey];
      if (artData.flags && artData.flags.includes('ACTIVATE')) {
        const found = ARTIFACT_KEY_TO_ACTIVATION[artKey];
        if (found && TOME_ARTIFACT_ACTIVATIONS[found]) {
          return { key: found, spec: TOME_ARTIFACT_ACTIVATIONS[found] };
        }
      }
    }

    return null;
  }

  /**
   * 해당 유물 아이템이 현재 발동 가능한지 검사합니다.
   * @param {Object} item
   * @param {Object} [player]
   * @returns {boolean}
   */
  static canActivate(item, player = null) {
    if (!item) return false;
    const resolved = this.resolveArtifactActivation(item);
    if (!resolved) return false;

    const cd = this.getCooldown(item, player);
    return cd <= 0;
  }

  /**
   * 유물 아이템의 현재 남은 쿨다운을 조회합니다.
   * @param {Object} item
   * @param {Object} [player]
   * @returns {number}
   */
  static getCooldown(item, player = null) {
    if (!item) return 0;
    const key = item.artifactKey || item.key || (typeof item === 'string' ? item : 'UNKNOWN');

    if (player && player.getTracker) {
      return player.getTracker(`ART_CD_${key}`, 'cooldown') || 0;
    }
    if (player && player.artifactCooldowns && player.artifactCooldowns[key] !== undefined) {
      return player.artifactCooldowns[key];
    }
    if (item.currentCooldown !== undefined) {
      return item.currentCooldown;
    }
    return 0;
  }

  /**
   * 유물의 고유 발동 효과를 실행하고 쿨다운을 설정합니다.
   * @param {Object} params
   * @param {Object} params.item
   * @param {Object} params.player
   * @param {Object} [params.target]
   * @param {Object} [params.game]
   * @returns {{ success: boolean, activationName: string, cooldownSet: number, damage: number, heal: number, message: string }}
   */
  static activateArtifact({ item, player, target = null, game = null }) {
    if (!item || !player) {
      return { success: false, activationName: 'None', cooldownSet: 0, damage: 0, heal: 0, message: 'Invalid arguments' };
    }

    const resolved = this.resolveArtifactActivation(item);
    if (!resolved) {
      const msg = `⚠️ [발동 불가] ${item.name || '아이템'}에는 고유 발동 주문이 깃들어있지 않습니다.`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'system');
      return { success: false, activationName: 'None', cooldownSet: 0, damage: 0, heal: 0, message: msg };
    }

    const currentCd = this.getCooldown(item, player);
    if (currentCd > 0) {
      const msg = `⏳ [쿨다운 중] ${resolved.spec.name} 재충전까지 ${currentCd}턴 남았습니다.`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: false, activationName: resolved.spec.name, cooldownSet: currentCd, damage: 0, heal: 0, message: msg };
    }

    const spec = resolved.spec;
    const itemName = item.displayName || item.name || '전설 유물';
    let dealtDmg = 0;
    let healedHp = 0;

    // 1. 치유 및 회복
    if (spec.healAmount || spec.type === 'HEAL' || spec.type === 'RESTORATION') {
      healedHp = spec.healAmount || 50;
      if (player.stats && player.stats.hp !== undefined) {
        const oldHp = player.stats.hp;
        player.stats.hp = Math.min(player.stats.maxHp || 9999, player.stats.hp + healedHp);
        healedHp = player.stats.hp - oldHp;
      }
    }

    // 2. 공격 마법 (Bolt / AoE / Dispel)
    if (spec.dice || spec.type === 'BOLT' || spec.type === 'AOE' || spec.type === 'DISPEL') {
      const rawDmg = parseInt(spec.dice, 10) || 50;
      if (target && target.stats) {
        const tFlags = target.flags ? new Set(target.flags) : new Set();
        dealtDmg = spec.element ? UnifiedTraitEngine.applyResistanceToDamage(rawDmg, spec.element, tFlags) : rawDmg;
        target.stats.hp = Math.max(0, target.stats.hp - dealtDmg);
      } else {
        dealtDmg = rawDmg;
      }
    }

    // 3. 버프 (가속 / 보호막 등)
    if (spec.speed && player.statusEffects) {
      if (Array.isArray(player.statusEffects)) {
        player.statusEffects.push({ type: 'HASTE', turns: spec.turns || 30, speed: spec.speed });
      }
    }

    // 쿨다운 등록
    const finalCd = spec.cooldown || 50;
    const artKey = item.artifactKey || item.key || 'ARTIFACT';

    if (player.setTracker) {
      player.setTracker(`ART_CD_${artKey}`, 'cooldown', finalCd);
    } else {
      if (!player.artifactCooldowns) player.artifactCooldowns = {};
      player.artifactCooldowns[artKey] = finalCd;
    }
    item.currentCooldown = finalCd;

    const logMsg = `🌟 [유물 발동] <b>${itemName}</b>의 <b>${spec.name}</b>! ${spec.desc}`;
    if (game && game.addLogEntry) {
      game.addLogEntry(logMsg, 'loot');
    }

    return {
      success: true,
      activationName: spec.name,
      cooldownSet: finalCd,
      damage: dealtDmg,
      heal: healedHp,
      message: logMsg
    };
  }

  /**
   * 매 턴마다 등록된 유물 쿨다운을 1씩 차감합니다.
   * @param {Object} player
   */
  static tickCooldowns(player) {
    if (!player) return;
    if (player.artifactCooldowns) {
      for (const k of Object.keys(player.artifactCooldowns)) {
        if (player.artifactCooldowns[k] > 0) {
          player.artifactCooldowns[k] -= 1;
        }
      }
    }
  }
}
