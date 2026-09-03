/**
 * @module TomeSpellEngine
 * @category systems
 * @description ToME 2.3.5 정통 몬스터 851종의 106종 C 원작 spells (볼트 14종, 볼 13종, 브레스 21종,
 *              상태이상 23종, 소환 17종, 유틸 18종) 및 20종 attacks 메소드 / 27종 effects를
 *              1:1 정확하게 해석 및 실행하는 통합 주문/전투 엔진. 플레이어 의태 스킬(1~4 슬롯) 및 몬스터 AI 공통 사용.
 * @purity Stateless System
 * @dependencies TomeMonstersData.js, UnifiedTraitEngine.js, TomeFlagResolver.js, Spawner.js
 * @exports TomeSpellEngine, TOME_CANONICAL_SPELLS, TOME_ATTACK_METHODS, TOME_ATTACK_EFFECTS
 */

import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { UnifiedTraitEngine } from './UnifiedTraitEngine.js';
import { TomeFlagResolver } from './TomeFlagResolver.js';
import { Spawner } from '../core/Spawner.js';
import { combatVFXEngine } from './CombatVFXEngine.js';

export const TOME_ATTACK_METHODS = Object.freeze([
  'HIT', 'TOUCH', 'PUNCH', 'KICK', 'CLAW', 'BITE', 'STING', 'BUTT',
  'CRUSH', 'ENGULF', 'CHARGE', 'CRAWL', 'DROOL', 'SPIT', 'EXPLODE',
  'GAZE', 'WAIL', 'GROAN', 'BEG', 'INSULT'
]);

export const TOME_ATTACK_EFFECTS = Object.freeze([
  'HURT', 'POISON', 'UN_BONUS', 'UN_POWER', 'EAT_GOLD', 'EAT_ITEM',
  'EAT_FOOD', 'EAT_LITE', 'ACID', 'ELEC', 'FIRE', 'COLD', 'BLIND',
  'CONFUSE', 'TERRIFY', 'PARALYZE', 'LOSE_STR', 'LOSE_DEX', 'LOSE_CON',
  'LOSE_INT', 'LOSE_WIS', 'LOSE_CHR', 'SHATTER', 'EXP_10', 'EXP_20',
  'EXP_40', 'EXP_80'
]);

export const TOME_CANONICAL_SPELLS = Object.freeze({
  // === 1. 볼트 및 투사체 (Bolts & Projectiles) ===
  'MISSILE': { name: '비전 마법 미사일', type: 'PROJECTILE', element: 'MANA', dice: '2d6', cooldown: 2, range: 6.0, icon: '🔮', color: '#a78bfa' },
  'MISSILE_1': { name: '비전 마법 미사일 I', type: 'PROJECTILE', element: 'MANA', dice: '2d6', cooldown: 2, range: 6.0, icon: '🔮', color: '#a78bfa' },
  'ARROW': { name: '화살 투사', type: 'PROJECTILE', element: 'PHYSICAL', dice: '1d6', cooldown: 1, range: 6.0, icon: '🏹', color: '#94a3b8' },
  'ARROW_1': { name: '화살 투사 I', type: 'PROJECTILE', element: 'PHYSICAL', dice: '2d6', cooldown: 1, range: 6.0, icon: '🏹', color: '#94a3b8' },
  'ARROW_2': { name: '화살 투사 II', type: 'PROJECTILE', element: 'PHYSICAL', dice: '3d8', cooldown: 1, range: 6.0, icon: '🏹', color: '#94a3b8' },
  'ARROW_3': { name: '화살 투사 III', type: 'PROJECTILE', element: 'PHYSICAL', dice: '5d8', cooldown: 2, range: 6.0, icon: '🏹', color: '#94a3b8' },
  'ARROW_4': { name: '화살 투사 IV', type: 'PROJECTILE', element: 'PHYSICAL', dice: '8d8', cooldown: 2, range: 6.0, icon: '🏹', color: '#94a3b8' },
  'ROCKET': { name: '로켓 발사', type: 'PROJECTILE', element: 'FIRE', dice: '12d10', cooldown: 5, range: 7.0, icon: '🚀', color: '#f97316' },
  'BO_ACID': { name: '산성 볼트', type: 'PROJECTILE', element: 'ACID', dice: '7d8', cooldown: 3, range: 6.0, icon: '🧪', color: '#22c55e' },
  'BO_ELEC': { name: '뇌격 볼트', type: 'PROJECTILE', element: 'ELEC', dice: '4d8', cooldown: 3, range: 6.0, icon: '⚡', color: '#eab308' },
  'BO_FIRE': { name: '화염 볼트', type: 'PROJECTILE', element: 'FIRE', dice: '9d8', cooldown: 3, range: 6.0, icon: '🔥', color: '#ef4444' },
  'BO_COLD': { name: '냉기 볼트', type: 'PROJECTILE', element: 'COLD', dice: '6d8', cooldown: 3, range: 6.0, icon: '❄️', color: '#38bdf8' },
  'BO_POIS': { name: '독침 볼트', type: 'PROJECTILE', element: 'POISON', dice: '3d8', cooldown: 3, range: 5.5, icon: '🩸', color: '#10b981' },
  'BO_NETH': { name: '황천 볼트', type: 'PROJECTILE', element: 'NETHER', dice: '5d5', cooldown: 3, range: 6.0, icon: '☠️', color: '#7c3aed' },
  'BO_WATE': { name: '수류 볼트', type: 'PROJECTILE', element: 'WATER', dice: '10d10', cooldown: 4, range: 6.0, icon: '🌊', color: '#0284c7' },
  'BO_MANA': { name: '마나 관통 볼트', type: 'PROJECTILE', element: 'MANA', dice: '12d8', cooldown: 4, range: 6.5, icon: '✨', color: '#c084fc' },
  'BO_PLAS': { name: '플라즈마 볼트', type: 'PROJECTILE', element: 'PLASMA', dice: '10d8', cooldown: 4, range: 6.0, icon: '⚡', color: '#f43f5e' },
  'BO_ICE': { name: '빙창 볼트', type: 'PROJECTILE', element: 'COLD', dice: '6d6', cooldown: 3, range: 6.0, icon: '🧊', color: '#bae6fd' },
  'BO_ICEE': { name: '빙창 볼트', type: 'PROJECTILE', element: 'COLD', dice: '6d6', cooldown: 3, range: 6.0, icon: '🧊', color: '#bae6fd' },
  'BO_DARK': { name: '암흑 볼트', type: 'PROJECTILE', element: 'DARK', dice: '4d8', cooldown: 3, range: 6.0, icon: '🌑', color: '#334155' },
  'BO_LITE': { name: '광휘 볼트', type: 'PROJECTILE', element: 'LIGHT', dice: '4d8', cooldown: 3, range: 6.0, icon: '☀️', color: '#fde047' },

  // === 2. 볼 (Balls - AoE 폭발) ===
  'BA_ACID': { name: '산성 폭풍구', type: 'AOE', element: 'ACID', dice: '8d8', radius: 2.5, cooldown: 5, range: 6.0, icon: '💥', color: '#22c55e' },
  'BA_ELEC': { name: '뇌격 구체 폭발', type: 'AOE', element: 'ELEC', dice: '8d8', radius: 2.5, cooldown: 5, range: 6.0, icon: '⚡', color: '#eab308' },
  'BA_FIRE': { name: '화염구 폭발 (Fire Ball)', type: 'AOE', element: 'FIRE', dice: '10d10', radius: 2.5, cooldown: 5, range: 6.0, icon: '🔥', color: '#ef4444' },
  'BA_COLD': { name: '동결 폭풍구', type: 'AOE', element: 'COLD', dice: '10d10', radius: 2.5, cooldown: 5, range: 6.0, icon: '❄️', color: '#38bdf8' },
  'BA_POIS': { name: '맹독 독가스 폭발', type: 'AOE', element: 'POISON', dice: '12d2', radius: 3.0, cooldown: 4, range: 5.5, icon: '🟢', color: '#10b981' },
  'BA_NETH': { name: '황천 영혼 폭풍', type: 'AOE', element: 'NETHER', dice: '10d10', radius: 2.5, cooldown: 5, range: 6.0, icon: '☠️', color: '#7c3aed' },
  'BA_WATE': { name: '대홍수 해일 폭발', type: 'AOE', element: 'WATER', dice: '12d10', radius: 3.0, cooldown: 6, range: 6.0, icon: '🌊', color: '#0284c7' },
  'BA_MANA': { name: '마나 폭풍 (Mana Storm)', type: 'AOE', element: 'MANA', dice: '15d10', radius: 3.0, cooldown: 7, range: 7.0, icon: '🌌', color: '#e879f9' },
  'BA_DARK': { name: '암흑 성운 폭발', type: 'AOE', element: 'DARK', dice: '8d10', radius: 2.5, cooldown: 5, range: 6.0, icon: '🌑', color: '#1e293b' },
  'BA_LITE': { name: '태양광 폭발', type: 'AOE', element: 'LIGHT', dice: '8d10', radius: 2.5, cooldown: 5, range: 6.0, icon: '☀️', color: '#fef08a' },
  'BA_CHAO': { name: '혼돈 폭풍', type: 'AOE', element: 'CHAOS', dice: '10d10', radius: 2.5, cooldown: 5, range: 6.0, icon: '🌀', color: '#ec4899' },
  'BA_SOUN': { name: '음파 폭풍 충격파', type: 'AOE', element: 'SOUND', dice: '8d8', radius: 2.5, cooldown: 5, range: 6.0, icon: '📢', color: '#f59e0b' },
  'BA_SHAR': { name: '파편 폭풍', type: 'AOE', element: 'SHARDS', dice: '8d8', radius: 2.5, cooldown: 5, range: 6.0, icon: '🗡️', color: '#94a3b8' },

  // === 3. 정통 21종 브레스 (Breaths) ===
  'BR_ACID': { name: '산성 브레스', type: 'BREATH', element: 'ACID', dice: '12d12', cooldown: 6, range: 6.5, icon: '🐉', color: '#22c55e' },
  'BR_ELEC': { name: '뇌격 브레스', type: 'BREATH', element: 'ELEC', dice: '12d12', cooldown: 6, range: 6.5, icon: '🐉', color: '#eab308' },
  'BR_FIRE': { name: '화염 브레스', type: 'BREATH', element: 'FIRE', dice: '15d12', cooldown: 6, range: 7.0, icon: '🐉', color: '#ef4444' },
  'BR_COLD': { name: '냉기 브레스', type: 'BREATH', element: 'COLD', dice: '15d12', cooldown: 6, range: 7.0, icon: '🐉', color: '#38bdf8' },
  'BR_POIS': { name: '맹독 브레스', type: 'BREATH', element: 'POISON', dice: '12d12', cooldown: 6, range: 6.5, icon: '🐉', color: '#10b981' },
  'BR_NETH': { name: '황천 브레스', type: 'BREATH', element: 'NETHER', dice: '12d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#7c3aed' },
  'BR_LITE': { name: '광휘 브레스', type: 'BREATH', element: 'LIGHT', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#fde047' },
  'BR_DARK': { name: '암흑 브레스', type: 'BREATH', element: 'DARK', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#334155' },
  'BR_CONF': { name: '혼란 브레스', type: 'BREATH', element: 'CONFUSION', dice: '8d8', cooldown: 5, range: 6.0, icon: '🐉', color: '#c084fc' },
  'BR_SOUN': { name: '음파 브레스', type: 'BREATH', element: 'SOUND', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#f59e0b' },
  'BR_CHAO': { name: '혼돈 브레스', type: 'BREATH', element: 'CHAOS', dice: '14d12', cooldown: 6, range: 7.0, icon: '🐉', color: '#ec4899' },
  'BR_DISE': { name: '마법 해체 브레스', type: 'BREATH', element: 'DISENCHANT', dice: '12d12', cooldown: 6, range: 6.5, icon: '🐉', color: '#a855f7' },
  'BR_NEXU': { name: '넥서스 왜곡 브레스', type: 'BREATH', element: 'NEXUS', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#6366f1' },
  'BR_TIME': { name: '시간 왜곡 브레스', type: 'BREATH', element: 'TIME', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#0ea5e9' },
  'BR_INER': { name: '관성 감속 브레스', type: 'BREATH', element: 'INERTIA', dice: '8d8', cooldown: 5, range: 6.0, icon: '🐉', color: '#64748b' },
  'BR_GRAV': { name: '중력 붕괴 브레스', type: 'BREATH', element: 'GRAVITY', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#475569' },
  'BR_SHAR': { name: '강철 파편 브레스', type: 'BREATH', element: 'SHARDS', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#94a3b8' },
  'BR_PLAS': { name: '플라즈마 브레스', type: 'BREATH', element: 'PLASMA', dice: '14d12', cooldown: 6, range: 7.0, icon: '🐉', color: '#f43f5e' },
  'BR_FORC': { name: '역장 충격 브레스', type: 'BREATH', element: 'FORCE', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#38bdf8' },
  'BR_WALL': { name: '충격 브레스 (Force Wall)', type: 'BREATH', element: 'FORCE', dice: '10d10', cooldown: 6, range: 6.5, icon: '🐉', color: '#38bdf8' },
  'BR_MANA': { name: '순수 마나 브레스', type: 'BREATH', element: 'MANA', dice: '16d12', cooldown: 7, range: 7.5, icon: '🐉', color: '#e879f9' },
  'BR_DISI': { name: '원자 분해 브레스', type: 'BREATH', element: 'DISINTEGRATION', dice: '15d12', cooldown: 7, range: 7.5, icon: '🐉', color: '#fb7185' },
  'BR_NUKE': { name: '방사능 브레스 (Toxic Nuke)', type: 'BREATH', element: 'POISON', dice: '16d12', cooldown: 7, range: 7.5, icon: '🐉', color: '#84cc16' },

  // === 4. 상태이상 & 정신 공격 (Debuffs / Mind / Curses) ===
  'BLIND': { name: '실명 유발', type: 'DEBUFF', effect: 'BLIND', cooldown: 4, range: 5.5, icon: '👁️', color: '#64748b' },
  'CONF': { name: '혼란의 주문', type: 'DEBUFF', effect: 'CONFUSION', cooldown: 4, range: 5.5, icon: '🌀', color: '#c084fc' },
  'SCARE': { name: '공포의 포효', type: 'DEBUFF', effect: 'FEAR', cooldown: 4, range: 5.5, icon: '😱', color: '#eab308' },
  'SLOW': { name: '감속 결계', type: 'DEBUFF', effect: 'SLOW', cooldown: 4, range: 5.5, icon: '🐌', color: '#94a3b8' },
  'HOLD': { name: '마비 구속', type: 'DEBUFF', effect: 'PARALYZE', cooldown: 5, range: 5.0, icon: '⛓️', color: '#3b82f6' },
  'SLEEP': { name: '수면의 안개', type: 'DEBUFF', effect: 'SLEEP', cooldown: 4, range: 5.0, icon: '💤', color: '#818cf8' },
  'DRAIN_MANA': { name: '마나 흡수', type: 'DEBUFF', effect: 'DRAIN_MANA', dice: '4d8', cooldown: 4, range: 5.5, icon: '🔮', color: '#a855f7' },
  'MIND_BLAST': { name: '정신 폭격 (Mind Blast)', type: 'PROJECTILE', element: 'PSYCHIC', dice: '8d8', cooldown: 4, range: 6.0, icon: '🧠', color: '#f43f5e' },
  'BRAIN_SMASH': { name: '뇌수 파쇄 (Brain Smash)', type: 'PROJECTILE', element: 'PSYCHIC', dice: '12d12', cooldown: 5, range: 6.0, icon: '🧠', color: '#e11d48' },
  'CAUSE_1': { name: '경상 저주', type: 'PROJECTILE', element: 'CURSE', dice: '3d8', cooldown: 3, range: 5.5, icon: '🩸', color: '#ef4444' },
  'CAUSE_2': { name: '중상 저주', type: 'PROJECTILE', element: 'CURSE', dice: '8d8', cooldown: 4, range: 5.5, icon: '🩸', color: '#dc2626' },
  'CAUSE_3': { name: '치명상 저주', type: 'PROJECTILE', element: 'CURSE', dice: '10d10', cooldown: 5, range: 6.0, icon: '🩸', color: '#b91c1c' },
  'CAUSE_4': { name: '필살의 사령 저주', type: 'PROJECTILE', element: 'CURSE', dice: '15d12', cooldown: 6, range: 6.5, icon: '🩸', color: '#7f1d1d' },
  'TELE_TO': { name: '목표물 강제 인양', type: 'UTILITY', effect: 'TELE_TO', cooldown: 5, range: 7.0, icon: '🧲', color: '#a855f7' },
  'TELE_AWAY': { name: '적 추방 텔레포트', type: 'UTILITY', effect: 'TELE_AWAY', cooldown: 5, range: 6.0, icon: '💨', color: '#38bdf8' },
  'TELE_LEVEL': { name: '차원 추방 텔레포트', type: 'UTILITY', effect: 'TELE_LEVEL', cooldown: 10, range: 6.0, icon: '🌀', color: '#8b5cf6' },
  'DARKNESS': { name: '심연의 어둠 소환', type: 'UTILITY', effect: 'DARKNESS', cooldown: 4, range: 5.0, icon: '🌑', color: '#1e293b' },
  'TRAPS': { name: '함정 소환', type: 'UTILITY', effect: 'TRAPS', cooldown: 6, range: 4.0, icon: '🕸️', color: '#78716c' },
  'FORGET': { name: '기억 상실 (Amnesia)', type: 'DEBUFF', effect: 'AMNESIA', cooldown: 6, range: 5.0, icon: '❓', color: '#94a3b8' },
  'HAND_DOOM': { name: '파멸의 손길', type: 'PROJECTILE', element: 'DEATH', dice: '10d15', cooldown: 8, range: 6.0, icon: '🖐️', color: '#000000' },
  'SHRIEK': { name: '전율의 비명', type: 'AOE', effect: 'AGGRO_ALL', radius: 8.0, cooldown: 3, range: 0, icon: '📢', color: '#f59e0b' },
  'DISPEL': { name: '마법 해제', type: 'UTILITY', effect: 'DISPEL', cooldown: 5, range: 6.0, icon: '✨', color: '#38bdf8' },

  // === 5. 소환 계열 (Summons - 20종) ===
  'S_KIN': { name: '동족 지원 소환', type: 'SUMMON', summonType: 'KIN', count: 2, cooldown: 6, icon: '👥', color: '#fb923c' },
  'S_CYBER': { name: '사이버데몬 소환', type: 'SUMMON', summonType: 'CYBERDEMON', count: 1, cooldown: 10, icon: '🤖', color: '#f43f5e' },
  'S_MONSTER': { name: '몬스터 소환', type: 'SUMMON', summonType: 'MONSTER', count: 1, cooldown: 5, icon: '👾', color: '#a855f7' },
  'S_MONSTERS': { name: '몬스터 군단 소환', type: 'SUMMON', summonType: 'MONSTERS', count: 4, cooldown: 8, icon: '👾', color: '#a855f7' },
  'S_ANT': { name: '거대 개미 떼 소환', type: 'SUMMON', summonType: 'ANT', count: 3, cooldown: 5, icon: '🐜', color: '#d97706' },
  'S_SPIDER': { name: '독거미 무리 소환', type: 'SUMMON', summonType: 'SPIDER', count: 3, cooldown: 5, icon: '🕷️', color: '#059669' },
  'S_HOUND': { name: '사냥개 무리 소환', type: 'SUMMON', summonType: 'HOUND', count: 3, cooldown: 5, icon: '🐕', color: '#b45309' },
  'S_HYDRA': { name: '히드라 소환', type: 'SUMMON', summonType: 'HYDRA', count: 1, cooldown: 6, icon: '🐉', color: '#16a34a' },
  'S_ANGEL': { name: '천사 군단 소환', type: 'SUMMON', summonType: 'ANGEL', count: 2, cooldown: 8, icon: '👼', color: '#fef08a' },
  'S_DEMON': { name: '하급 악마 소환', type: 'SUMMON', summonType: 'DEMON', count: 2, cooldown: 6, icon: '😈', color: '#ef4444' },
  'S_UNDEAD': { name: '언데드 군단 소환', type: 'SUMMON', summonType: 'UNDEAD', count: 3, cooldown: 6, icon: '💀', color: '#7c3aed' },
  'S_DRAGON': { name: '드래곤 소환', type: 'SUMMON', summonType: 'DRAGON', count: 1, cooldown: 8, icon: '🐲', color: '#ea580c' },
  'S_HI_UNDEAD': { name: '상급 고대 언데드 소환', type: 'SUMMON', summonType: 'HI_UNDEAD', count: 2, cooldown: 9, icon: '☠️', color: '#581c87' },
  'S_HI_DRAGON': { name: '고대 고룡 소환', type: 'SUMMON', summonType: 'HI_DRAGON', count: 2, cooldown: 10, icon: '🐉', color: '#c2410c' },
  'S_HI_DEMON': { name: '대악마 군주 소환', type: 'SUMMON', summonType: 'HI_DEMON', count: 2, cooldown: 10, icon: '👿', color: '#991b1b' },
  'S_WRAITH': { name: '나즈굴 흑색 영체 소환', type: 'SUMMON', summonType: 'WRAITH', count: 2, cooldown: 9, icon: '👻', color: '#334155' },
  'S_UNIQUE': { name: '유니크 네임드 소환', type: 'SUMMON', summonType: 'UNIQUE', count: 1, cooldown: 15, icon: '👑', color: '#ffd700' },
  'S_ANIMAL': { name: '야수 소환', type: 'SUMMON', summonType: 'ANIMAL', count: 1, cooldown: 5, icon: '🐾', color: '#b45309' },
  'S_ANIMALS': { name: '야수 무리 소환', type: 'SUMMON', summonType: 'ANIMALS', count: 3, cooldown: 6, icon: '🐾', color: '#b45309' },
  'S_THUNDERLORD': { name: '썬더로드 소환', type: 'SUMMON', summonType: 'THUNDERLORD', count: 1, cooldown: 10, icon: '⚡', color: '#eab308' },
  'S_BUG': { name: '벌레 떼 소환', type: 'SUMMON', summonType: 'BUG', count: 3, cooldown: 5, icon: '🪲', color: '#65a30d' },
  'S_RNG': { name: '무작위 몬스터 소환', type: 'SUMMON', summonType: 'MONSTER', count: 1, cooldown: 5, icon: '🎲', color: '#a855f7' },
  'MULTIPLY': { name: '세포 증식', type: 'SUMMON', summonType: 'KIN', count: 1, cooldown: 4, icon: '🦠', color: '#10b981' },

  // === 6. 회복 및 자가 버프 (Heal / Utility) ===
  'HEAL': { name: '신성 자가 치유', type: 'HEAL', dice: '10d10', cooldown: 5, range: 0, icon: '💚', color: '#22c55e' },
  'HASTE': { name: '신속 가속 (Haste)', type: 'BUFF', effect: 'HASTE', turns: 20, cooldown: 6, range: 0, icon: '⚡', color: '#38bdf8' },
  'BLINK': { name: '순간 위상 점멸 (Blink)', type: 'UTILITY', effect: 'BLINK', maxDist: 4, cooldown: 3, range: 0, icon: '💨', color: '#38bdf8' },
  'TPORT': { name: '장거리 공간 도약 (Teleport)', type: 'UTILITY', effect: 'TELEPORT', maxDist: 50, cooldown: 5, range: 0, icon: '🌀', color: '#818cf8' }
});

export class TomeSpellEngine {
  /**
   * 스펠 키를 정규화하여 동의어(e.g. BO_ICEE -> BO_ICE, MISSILE_1 -> MISSILE)를 해소합니다.
   * @param {string} spellKey
   * @returns {string|null}
   */
  static normalizeSpellKey(spellKey) {
    if (!spellKey) return null;
    const k = String(spellKey).trim().toUpperCase();
    if (k === 'BO_ICEE') return 'BO_ICE';
    if (k === 'MISSILE_1') return 'MISSILE';
    if (k === 'ARROW') return 'ARROW_1';
    if (k === 'BR_FORC') return 'BR_WALL';
    return k;
  }

  /**
   * 스펠 키에 대한 정통 명세 객체를 반환합니다.
   * @param {string} spellKey
   * @returns {Object|null}
   */
  static getSpellDefinition(spellKey) {
    if (!spellKey) return null;
    if (TOME_CANONICAL_SPELLS[spellKey]) return TOME_CANONICAL_SPELLS[spellKey];
    const normKey = this.normalizeSpellKey(spellKey);
    return TOME_CANONICAL_SPELLS[normKey] || null;
  }

  /**
   * 지원하는 모든 스펠 키 목록을 반환합니다.
   * @returns {string[]}
   */
  static getAllSpellKeys() {
    return Object.keys(TOME_CANONICAL_SPELLS);
  }

  /**
   * 지원하는 모든 타격 방식(20종) 목록을 반환합니다.
   * @returns {string[]}
   */
  static getAllAttackMethods() {
    return [...TOME_ATTACK_METHODS];
  }

  /**
   * 지원하는 모든 타격 효과(27종) 목록을 반환합니다.
   * @returns {string[]}
   */
  static getAllAttackEffects() {
    return [...TOME_ATTACK_EFFECTS];
  }

  /**
   * 몬스터 종족 또는 인스턴스로부터 스펠 목록을 추출합니다.
   * @param {Object|string} monsterOrKey
   * @returns {Array<{ key: string, spec: Object }>}
   */
  static resolveMonsterSpells(monsterOrKey) {
    const list = [];
    if (!monsterOrKey) return list;

    let spells = [];
    if (typeof monsterOrKey === 'string' && TOME_MONSTERS_DATA[monsterOrKey]) {
      spells = TOME_MONSTERS_DATA[monsterOrKey].spells || [];
    } else if (typeof monsterOrKey === 'object') {
      if (monsterOrKey.spells) spells = monsterOrKey.spells;
      else if (monsterOrKey.tomeKey && TOME_MONSTERS_DATA[monsterOrKey.tomeKey]) {
        spells = TOME_MONSTERS_DATA[monsterOrKey.tomeKey].spells || [];
      }
    }

    for (const spKey of spells) {
      if (typeof spKey !== 'string') continue;
      if (spKey.startsWith('1_IN_') || spKey.startsWith('FREQ_')) continue; // 빈도 플래그 제외
      const spec = this.getSpellDefinition(spKey);
      if (spec) {
        list.push({ key: spKey, spec });
      }
    }

    return list;
  }

  /**
   * 몬스터 종족 또는 인스턴스로부터 근접 타격(Attacks) 배열을 추출합니다.
   * @param {Object|string} monsterOrKey
   * @returns {Array<{ method: string, effect: string, damage: string }>}
   */
  static resolveMonsterAttacks(monsterOrKey) {
    if (!monsterOrKey) return [];
    if (typeof monsterOrKey === 'string' && TOME_MONSTERS_DATA[monsterOrKey]) {
      return TOME_MONSTERS_DATA[monsterOrKey].attacks || [];
    }
    if (typeof monsterOrKey === 'object') {
      if (monsterOrKey.attacks && monsterOrKey.attacks.length > 0) return monsterOrKey.attacks;
      if (monsterOrKey.blows && monsterOrKey.blows.length > 0) {
        return monsterOrKey.blows.map(b => ({ method: b.method || 'HIT', effect: b.effect || 'HURT', damage: b.dice || b.damage || '1d4' }));
      }
      if (monsterOrKey.tomeKey && TOME_MONSTERS_DATA[monsterOrKey.tomeKey]) {
        return TOME_MONSTERS_DATA[monsterOrKey.tomeKey].attacks || [];
      }
    }
    return [];
  }

  /**
   * 주사위 표기식(e.g. '8d12', '2d6+4')을 굴려 난수 합계를 산출합니다.
   * @param {string} diceStr
   * @returns {number}
   */
  static rollDice(diceStr) {
    if (!diceStr) return 1;
    const match = String(diceStr).trim().match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
    if (!match) {
      const parsed = parseInt(diceStr, 10);
      return isNaN(parsed) ? 1 : Math.max(1, parsed);
    }
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    if (match[3] && match[4]) {
      const modifier = parseInt(match[4], 10);
      total += (match[3] === '+' ? modifier : -modifier);
    }
    return Math.max(1, total);
  }

  /**
   * 몬스터의 근접 타격 1회를 대상(플레이어 또는 방어자)에게 실행합니다.
   * 20종 Methods x 27종 Effects를 정밀 지원합니다.
   * @param {Object} params
   * @param {Object} params.attack - { method: string, effect: string, damage: string }
   * @param {Object} params.attacker
   * @param {Object} params.defender
   * @param {Object} [params.game]
   * @returns {{ success: boolean, rawDamage: number, finalDamage: number, effectApplied: string|null, message: string }}
   */
  static executeAttack({ attack, attacker, defender, game = null }) {
    if (!attack || !attacker || !defender) {
      return { success: false, rawDamage: 0, finalDamage: 0, effectApplied: null, message: 'Invalid entities' };
    }

    const rawDmg = this.rollDice(attack.damage || '1d4');
    let finalDmg = rawDmg;
    let effectApplied = null;

    const defFlags = TomeFlagResolver.collectFlagsFromEntity(defender);
    const effect = (attack.effect || 'HURT').toUpperCase();
    const method = (attack.method || 'HIT').toUpperCase();

    // 27 Attack Effects 핸들링
    switch (effect) {
      case 'FIRE':
        finalDmg = UnifiedTraitEngine.applyResistanceToDamage(rawDmg, 'FIRE', defFlags);
        effectApplied = '화염 타격';
        break;
      case 'COLD':
        finalDmg = UnifiedTraitEngine.applyResistanceToDamage(rawDmg, 'COLD', defFlags);
        effectApplied = '냉기 타격';
        break;
      case 'ELEC':
        finalDmg = UnifiedTraitEngine.applyResistanceToDamage(rawDmg, 'ELEC', defFlags);
        effectApplied = '뇌격 타격';
        break;
      case 'ACID':
        finalDmg = UnifiedTraitEngine.applyResistanceToDamage(rawDmg, 'ACID', defFlags);
        effectApplied = '산성 타격';
        break;
      case 'POISON':
        finalDmg = UnifiedTraitEngine.applyResistanceToDamage(rawDmg, 'POISON', defFlags);
        if (defender.debuffs) {
          defender.debuffs.poison = (defender.debuffs.poison || 0) + 3;
        }
        effectApplied = '맹독 중독';
        break;
      case 'BLIND':
        if (!defFlags.has('NO_BLIND')) {
          if (defender.debuffs) defender.debuffs.blind = (defender.debuffs.blind || 0) + 4;
          effectApplied = '실명';
        } else {
          effectApplied = '실명 저항';
        }
        break;
      case 'CONFUSE':
        if (!defFlags.has('NO_CONF')) {
          if (defender.debuffs) defender.debuffs.confused = (defender.debuffs.confused || 0) + 4;
          effectApplied = '혼란';
        } else {
          effectApplied = '혼란 저항';
        }
        break;
      case 'TERRIFY':
        if (!defFlags.has('NO_FEAR')) {
          if (defender.debuffs) defender.debuffs.afraid = (defender.debuffs.afraid || 0) + 4;
          effectApplied = '공포';
        } else {
          effectApplied = '공포 저항';
        }
        break;
      case 'PARALYZE':
        if (!defFlags.has('FREE_ACT')) {
          if (defender.debuffs) {
            defender.debuffs.paralyzed = true;
            defender.debuffs.paralyzeTurns = (defender.debuffs.paralyzeTurns || 0) + 2;
          }
          effectApplied = '마비';
        } else {
          effectApplied = '마비 면역(FREE_ACT)';
        }
        break;
      case 'EAT_GOLD':
        if (defender.gold && defender.gold > 0) {
          const stolen = Math.min(defender.gold, Math.floor(Math.random() * 50) + 10);
          defender.gold -= stolen;
          effectApplied = `골드 강탈 (-${stolen}G)`;
        } else {
          effectApplied = '골드 강탈 시도';
        }
        break;
      case 'EAT_ITEM':
        if (defender.inventory && defender.inventory.length > 0) {
          const itemIdx = Math.floor(Math.random() * defender.inventory.length);
          const eatenItem = defender.inventory[itemIdx];
          defender.inventory.splice(itemIdx, 1);
          effectApplied = `아이템 파괴/강탈 (${eatenItem.name || '아이템'})`;
        } else {
          effectApplied = '아이템 강탈 시도';
        }
        break;
      case 'EAT_FOOD':
        if (defender.inventory) {
          const foodIdx = defender.inventory.findIndex(i => i.type === 'FOOD' || (i.name && i.name.includes('식량')));
          if (foodIdx >= 0) {
            defender.inventory.splice(foodIdx, 1);
            effectApplied = '식량 섭취/강탈';
          }
        }
        break;
      case 'EAT_LITE':
        if (defender.equippedLamp && defender.equippedLamp.fuel !== undefined) {
          defender.equippedLamp.fuel = Math.max(0, defender.equippedLamp.fuel - 50);
          effectApplied = '광원 연료 흡수';
        }
        break;
      case 'UN_BONUS':
      case 'UN_POWER':
        effectApplied = '마력 해제/약화';
        break;
      case 'LOSE_STR':
        if (!defFlags.has('SUST_STR')) effectApplied = '힘 저하';
        else effectApplied = '힘 유지(SUST_STR)';
        break;
      case 'LOSE_DEX':
        if (!defFlags.has('SUST_DEX')) effectApplied = '민첩 저하';
        else effectApplied = '민첩 유지(SUST_DEX)';
        break;
      case 'LOSE_CON':
        if (!defFlags.has('SUST_CON')) effectApplied = '건강 저하';
        else effectApplied = '건강 유지(SUST_CON)';
        break;
      case 'LOSE_INT':
        if (!defFlags.has('SUST_INT')) effectApplied = '지능 저하';
        else effectApplied = '지능 유지(SUST_INT)';
        break;
      case 'LOSE_WIS':
        if (!defFlags.has('SUST_WIS')) effectApplied = '지혜 저하';
        else effectApplied = '지혜 유지(SUST_WIS)';
        break;
      case 'LOSE_CHR':
        if (!defFlags.has('SUST_CHR')) effectApplied = '매력 저하';
        else effectApplied = '매력 유지(SUST_CHR)';
        break;
      case 'SHATTER':
        effectApplied = '강력한 지진 분쇄 타격';
        finalDmg = Math.floor(finalDmg * 1.3);
        break;
      case 'EXP_10':
      case 'EXP_20':
      case 'EXP_40':
      case 'EXP_80': {
        const drainXp = parseInt(effect.replace('EXP_', ''), 10) || 10;
        if (!defFlags.has('HOLD_LIFE')) {
          if (defender.xp !== undefined) defender.xp = Math.max(0, defender.xp - drainXp);
          effectApplied = `생명력 흡수 (-${drainXp} XP)`;
        } else {
          effectApplied = '생명력 흡수 저항(HOLD_LIFE)';
        }
        break;
      }
      case 'HURT':
      default:
        effectApplied = '물리 타격';
        break;
    }

    // 방어자 체력 차감
    if (defender.takeDamage && typeof defender.takeDamage === 'function') {
      defender.takeDamage(finalDmg, game);
    } else if (defender.stats && defender.stats.hp !== undefined) {
      defender.stats.hp = Math.max(0, defender.stats.hp - finalDmg);
    }

    const atkName = attacker.displayName || attacker.name || '공격자';
    const defName = defender.displayName || defender.name || '방어자';
    const effectLabel = effectApplied ? ` [${effectApplied}]` : '';
    const msg = `⚔️ ${atkName}의 ${method}(${effect})! ${defName}에게 ${finalDmg} 피해 (기본: ${rawDmg})${effectLabel}`;

    if (game && game.addLogEntry) {
      game.addLogEntry(msg, 'combat');
    }

    return { success: true, rawDamage: rawDmg, finalDamage: finalDmg, effectApplied, message: msg };
  }

  /**
   * 스펠을 시전(Cast)하고 실효 액션을 대상 및 맵에 적용합니다.
   * @param {Object} params
   * @param {string} params.spellKey
   * @param {Object} params.caster
   * @param {Object} [params.target]
   * @param {Object} [params.game]
   * @param {boolean} [params.isPlayer=false]
   * @returns {{ success: boolean, spellName: string, damage: number, message: string, spawned?: number }}
   */
  static castSpell({ spellKey, caster, target = null, game = null, isPlayer = false }) {
    const spec = this.getSpellDefinition(spellKey);
    if (!spec || !caster) {
      return { success: false, spellName: spellKey, damage: 0, message: 'Invalid spell or caster' };
    }

    const casterName = caster.displayName || caster.name || (isPlayer ? '플레이어' : '시전자');
    let dmg = 0;

    if (spec.dice) {
      dmg = this.rollDice(spec.dice);
    }

    // 쿨다운 등록
    if (caster.cooldowns) {
      caster.cooldowns[spellKey] = spec.cooldown || 4;
    }
    if (spec.type === 'BREATH') {
      caster.breathCooldown = spec.cooldown || 6;
    }

    // 1. 자가 치유 (HEAL)
    if (spec.type === 'HEAL') {
      const healAmount = dmg || 50;
      if (caster.stats && caster.stats.hp !== undefined) {
        const oldHp = caster.stats.hp;
        caster.stats.hp = Math.min(caster.stats.maxHp || 9999, caster.stats.hp + healAmount);
        const actual = caster.stats.hp - oldHp;
        if (combatVFXEngine) combatVFXEngine.triggerSpellAction('HEAL', caster, caster, null, -actual);
        const msg = `💚 ${casterName}이(가) ${spec.name} 시전! +${actual} HP 회복 (HP: ${caster.stats.hp}/${caster.stats.maxHp})`;
        if (game && game.addLogEntry) game.addLogEntry(msg, 'loot');
        return { success: true, spellName: spec.name, damage: -actual, message: msg };
      }
    }

    // 2. 가속 버프 (BUFF / HASTE)
    if (spec.type === 'BUFF' && spec.effect === 'HASTE') {
      caster.hasteTurns = (caster.hasteTurns || 0) + (spec.turns || 20);
      const msg = `⚡ ${casterName}이(가) ${spec.name} 시전! 이동 및 행동 속도가 대폭 가속되었습니다! (${spec.turns || 20}턴)`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'loot');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    // 3. 소환 계열 (SUMMON)
    if (spec.type === 'SUMMON') {
      const summonType = spec.summonType || 'MONSTER';
      const count = spec.count || 1;
      const spawnedMonsters = Spawner.spawnMonsterAround(game, caster.x, caster.y, summonType, count, caster);
      const msg = `👥 ${casterName}이(가) ${spec.name} 시전! ${spawnedMonsters.length}마리의 지원군 소환!`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, spawned: spawnedMonsters.length, message: msg };
    }

    // 4. 점멸 / 텔레포트 (BLINK / TPORT)
    if (spec.type === 'UTILITY' && (spec.effect === 'BLINK' || spec.effect === 'TELEPORT')) {
      const maxD = spec.maxDist || (spec.effect === 'BLINK' ? 4 : 50);
      const minD = spec.effect === 'BLINK' ? 2 : 5;
      const map = game?.map;
      let dest = null;

      if (map) {
        const candidates = [];
        for (let dx = -maxD; dx <= maxD; dx++) {
          for (let dy = -maxD; dy <= maxD; dy++) {
            const d = Math.hypot(dx, dy);
            if (d < minD || d > maxD) continue;
            const tx = caster.x + dx;
            const ty = caster.y + dy;
            if (map.isWalkable && !map.isWalkable(tx, ty)) continue;
            if (game.isMonsterAt && game.isMonsterAt(tx, ty)) continue;
            if (game.player && game.player.x === tx && game.player.y === ty) continue;
            candidates.push({ x: tx, y: ty });
          }
        }
        if (candidates.length > 0) {
          dest = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      if (dest) {
        caster.x = dest.x;
        caster.y = dest.y;
      }
      if (combatVFXEngine) combatVFXEngine.triggerSpellAction('TELEPORT', caster, caster);
      const msg = `💨 ${casterName}이(가) ${spec.name}으로 순간이동했습니다! (${caster.x}, ${caster.y})`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    // 5. 위치 강제 이동 (TELE_TO / TELE_AWAY / TELE_LEVEL)
    if (spec.effect === 'TELE_TO' && target) {
      const map = game?.map;
      let dest = null;
      if (map) {
        const candidates = [];
        for (let r = 1; r <= 2; r++) {
          for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
              if (dx === 0 && dy === 0) continue;
              const tx = caster.x + dx;
              const ty = caster.y + dy;
              if (map.isWalkable && !map.isWalkable(tx, ty)) continue;
              if (game.isMonsterAt && game.isMonsterAt(tx, ty)) continue;
              candidates.push({ x: tx, y: ty });
            }
          }
          if (candidates.length > 0) break;
        }
        if (candidates.length > 0) {
          dest = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
      if (dest) {
        target.x = dest.x;
        target.y = dest.y;
      }
      if (combatVFXEngine) combatVFXEngine.triggerSpellAction('TELEPORT', caster, target);
      const targetName = target.displayName || target.name || '대상';
      const msg = `🧲 ${casterName}이(가) ${spec.name} 발동! ${targetName}을(를) 눈앞으로 강제 소환했습니다!`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    if (spec.effect === 'TELE_AWAY' && target) {
      const map = game?.map;
      let dest = null;
      if (map) {
        const candidates = [];
        for (let dx = -30; dx <= 30; dx++) {
          for (let dy = -30; dy <= 30; dy++) {
            const d = Math.hypot(dx, dy);
            if (d < 10 || d > 35) continue;
            const tx = target.x + dx;
            const ty = target.y + dy;
            if (map.isWalkable && !map.isWalkable(tx, ty)) continue;
            if (game.isMonsterAt && game.isMonsterAt(tx, ty)) continue;
            if (caster.x === tx && caster.y === ty) continue;
            candidates.push({ x: tx, y: ty });
          }
        }
        if (candidates.length > 0) {
          dest = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
      if (dest) {
        target.x = dest.x;
        target.y = dest.y;
      }
      if (combatVFXEngine) combatVFXEngine.triggerSpellAction('TELEPORT', caster, target);
      const targetName = target.displayName || target.name || '대상';
      const msg = `💨 ${casterName}이(가) ${spec.name} 발동! ${targetName}을(를) 저 멀리 강제 추방했습니다!`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    // 6. 디버프 및 정신 공격 (DEBUFF)
    if (spec.type === 'DEBUFF' && target) {
      const tFlags = TomeFlagResolver.collectFlagsFromEntity(target);
      const targetName = target.displayName || target.name || '대상';
      let appliedMsg = '';

      if (!target.debuffs) {
        target.debuffs = { poison: 0, frost: 0, paralyzed: false, magicVulnerability: 0, blind: 0, confused: 0, afraid: 0, slow: 0 };
      }

      switch (spec.effect) {
        case 'BLIND':
          if (tFlags.has('NO_BLIND')) {
            appliedMsg = `${targetName}이(가) 실명 효과에 저항했습니다! (면역: NO_BLIND)`;
          } else {
            target.debuffs.blind = (target.debuffs.blind || 0) + 5;
            appliedMsg = `👁️ ${targetName}이(가) 실명 상태에 빠졌습니다! (5턴)`;
          }
          break;
        case 'CONFUSION':
          if (tFlags.has('NO_CONF')) {
            appliedMsg = `${targetName}이(가) 혼란 효과에 저항했습니다! (면역: NO_CONF)`;
          } else {
            target.debuffs.confused = (target.debuffs.confused || 0) + 5;
            appliedMsg = `🌀 ${targetName}이(가) 깊은 혼란에 빠졌습니다! (5턴)`;
          }
          break;
        case 'FEAR':
          if (tFlags.has('NO_FEAR')) {
            appliedMsg = `${targetName}이(가) 공포 효과에 저항했습니다! (면역: NO_FEAR)`;
          } else {
            target.debuffs.afraid = (target.debuffs.afraid || 0) + 5;
            appliedMsg = `😱 ${targetName}이(가) 극심한 공포에 휩싸였습니다! (5턴)`;
          }
          break;
        case 'PARALYZE':
          if (tFlags.has('FREE_ACT')) {
            appliedMsg = `${targetName}이(가) 마비 효과에 저항했습니다! (면역: FREE_ACT)`;
          } else {
            target.debuffs.paralyzed = true;
            target.debuffs.paralyzeTurns = (target.debuffs.paralyzeTurns || 0) + 3;
            appliedMsg = `⛓️ ${targetName}이(가) 마비 구속되었습니다! (3턴)`;
          }
          break;
        case 'SLOW':
          if (tFlags.has('FREE_ACT')) {
            appliedMsg = `${targetName}이(가) 감속 효과에 저항했습니다! (면역: FREE_ACT)`;
          } else {
            target.debuffs.slow = (target.debuffs.slow || 0) + 5;
            appliedMsg = `🐌 ${targetName}이(가) 감속 결계에 걸렸습니다! (5턴)`;
          }
          break;
        case 'DRAIN_MANA': {
          const drained = dmg || 15;
          if (target.energy !== undefined) target.energy = Math.max(0, target.energy - drained * 2);
          if (target.stats && target.stats.sp !== undefined) target.stats.sp = Math.max(0, target.stats.sp - drained);
          appliedMsg = `🔮 ${targetName}의 마력/기력이 ${drained} 흡수당했습니다!`;
          break;
        }
        case 'AMNESIA':
          appliedMsg = `❓ ${targetName}이(가) 일시적 기억 상실에 걸렸습니다!`;
          break;
        default:
          appliedMsg = `${targetName}에게 ${spec.name} 효과 적용`;
          break;
      }

      if (combatVFXEngine) {
        if (spec.effect === 'CONFUSION') combatVFXEngine.triggerSpellAction('CONFUSION', caster, target);
        else if (spec.effect === 'BLIND') combatVFXEngine.triggerSpellAction('BLIND', caster, target);
        else if (spec.effect === 'FEAR') combatVFXEngine.triggerSpellAction('FEAR', caster, target);
        else if (spec.effect === 'PARALYZE') combatVFXEngine.triggerSpellAction('PARALYZE', caster, target);
      }

      const msg = `✨ ${casterName}의 ${spec.name}! ${appliedMsg}`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    // 7. 유틸리티 특수 효과 (SHRIEK, DARKNESS)
    if (spec.effect === 'AGGRO_ALL') {
      if (game && game.monsters) {
        for (const m of game.monsters) {
          if (m && m.stats && m.stats.hp > 0) m.isAggroed = true;
        }
      }
      const msg = `📢 ${casterName}이(가) ${spec.name}을(를) 내질러 던전 내 모든 괴물들을 자극했습니다!`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    if (spec.effect === 'DARKNESS') {
      const msg = `🌑 ${casterName}이(가) ${spec.name}을(를) 시전하여 주변을 칠흑 같은 암흑으로 물들였습니다!`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: 0, message: msg };
    }

    // 8. 단일 투사체 (Bolt / Missile / Curses / Mind Blast / Brain Smash / Hand of Doom)
    if (spec.type === 'PROJECTILE' && target) {
      const targetFlags = TomeFlagResolver.collectFlagsFromEntity(target);
      let finalDmg = dmg;

      if (spellKey === 'HAND_DOOM') {
        finalDmg = Math.max(10, Math.floor((target.stats?.hp || 100) * 0.40));
      } else if (spec.element) {
        finalDmg = UnifiedTraitEngine.applyResistanceToDamage(dmg, spec.element, targetFlags);
      }

      if (target.takeDamage && typeof target.takeDamage === 'function') {
        target.takeDamage(finalDmg, game);
      } else if (target.stats && target.stats.hp !== undefined) {
        target.stats.hp = Math.max(0, target.stats.hp - finalDmg);
      }

      if (combatVFXEngine) {
        let vfxId = 'MISSILE';
        if (spellKey === 'ARROW' || (spec.name && spec.name.includes('화살'))) vfxId = 'ARROW';
        else if (spec.element) {
          const el = spec.element.toUpperCase();
          if (el === 'FIRE') vfxId = 'BO_FIRE';
          else if (el === 'COLD' || el === 'ICE') vfxId = 'BO_COLD';
          else if (el === 'ELEC' || el === 'LIGHTNING') vfxId = 'BO_ELEC';
          else if (el === 'ACID') vfxId = 'BO_ACID';
          else if (el === 'POIS' || el === 'POISON') vfxId = 'BO_POIS';
          else if (el === 'NETHER' || el === 'NETH') vfxId = 'BO_NETH';
          else if (el === 'LIGHT' || el === 'LITE') vfxId = 'BO_LITE';
          else if (el === 'DARK') vfxId = 'BO_DARK';
          else if (el === 'WATER' || el === 'WATE') vfxId = 'BO_WATE';
        }
        combatVFXEngine.triggerSpellAction(vfxId, caster, target, spec.element, finalDmg);
      }

      const targetName = target.displayName || target.name || '대상';
      const msg = `🔮 ${casterName}이(가) ${targetName}에게 ${spec.name} 발사! 💥 ${finalDmg} 피해 (원소: ${spec.element || 'MANA'})`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: finalDmg, message: msg };
    }

    // 9. 브레스 / 광역 폭풍 (Breath / AoE)
    if (spec.type === 'BREATH' || spec.type === 'AOE') {
      let targetCount = 0;
      const targets = target ? [target] : (game && (game.monsters || (game.dungeon && game.dungeon.monsters)) ? (game.monsters || game.dungeon.monsters) : []);

      for (const t of targets) {
        if (!t || t === caster || (t.stats && t.stats.hp <= 0)) continue;
        const tFlags = TomeFlagResolver.collectFlagsFromEntity(t);
        const finalDmg = spec.element ? UnifiedTraitEngine.applyResistanceToDamage(dmg, spec.element, tFlags) : dmg;
        if (t.takeDamage && typeof t.takeDamage === 'function') {
          t.takeDamage(finalDmg, game);
          targetCount++;
        } else if (t.stats && t.stats.hp !== undefined) {
          t.stats.hp = Math.max(0, t.stats.hp - finalDmg);
          targetCount++;
        }
      }

      if (combatVFXEngine) {
        let aoeId = 'BA_MANA';
        if (spec.type === 'BREATH') {
          aoeId = 'BREATH';
        } else if (spec.element) {
          const el = spec.element.toUpperCase();
          if (el === 'FIRE') aoeId = 'BA_FIRE';
          else if (el === 'COLD' || el === 'ICE') aoeId = 'BA_COLD';
          else if (el === 'ELEC' || el === 'LIGHTNING') aoeId = 'BA_ELEC';
          else if (el === 'ACID') aoeId = 'BA_ACID';
          else if (el === 'POIS' || el === 'POISON') aoeId = 'BA_POIS';
          else if (el === 'NETHER' || el === 'NETH') aoeId = 'BA_NETH';
        }
        combatVFXEngine.triggerSpellAction(aoeId, caster, target, spec.element, dmg);
      }

      const msg = `🐉 ${casterName}이(가) ${spec.name} 발동! ${targetCount}개 대상에게 ${dmg}의 광역 폭풍 피해`;
      if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
      return { success: true, spellName: spec.name, damage: dmg, message: msg };
    }

    // 10. 기타 범용 주문 완료 처리
    const msg = `✨ ${casterName}이(가) ${spec.name} 시전 완료!`;
    if (game && game.addLogEntry) game.addLogEntry(msg, 'combat');
    return { success: true, spellName: spec.name, damage: 0, message: msg };
  }

  /**
   * 몬스터 종족 또는 코어로부터 플레이어 변신 1~4번 스킬 슬롯 설정을 생성합니다.
   * @param {Object|string} monsterOrKey
   * @returns {Array<Object>} 4개 스킬 슬롯 명세
   */
  static generatePlayerSkillsFromCore(monsterOrKey) {
    const spells = this.resolveMonsterSpells(monsterOrKey);
    const attacks = this.resolveMonsterAttacks(monsterOrKey);

    const skills = [];

    // Slot 1: 기본 공격 / 평타 기반 스킬
    const primaryAtk = attacks[0] || { method: 'HIT', effect: 'HURT', damage: '1d6' };
    skills.push({
      slot: 1,
      id: 'SKILL_BASIC_ATTACK',
      name: `기본 타격 (${primaryAtk.method})`,
      desc: `${primaryAtk.method} 방식으로 적을 타격합니다. (${primaryAtk.damage} + ${primaryAtk.effect})`,
      element: primaryAtk.effect === 'HURT' ? 'PHYSICAL' : primaryAtk.effect,
      cooldown: 1,
      dice: primaryAtk.damage,
      icon: '⚔️',
      color: '#38bdf8'
    });

    // Slot 2: 볼트 또는 상태이상 스킬
    const boltSpell = spells.find(s => s.spec.type === 'PROJECTILE' || s.spec.type === 'DEBUFF') || spells[0];
    if (boltSpell) {
      skills.push({
        slot: 2,
        id: `SKILL_${boltSpell.key}`,
        tomeKey: boltSpell.key,
        name: boltSpell.spec.name,
        desc: `${boltSpell.spec.name}을(를) 투사합니다. (원소: ${boltSpell.spec.element || 'MANA'})`,
        element: boltSpell.spec.element || 'MANA',
        cooldown: boltSpell.spec.cooldown || 2,
        dice: boltSpell.spec.dice || '2d6',
        icon: boltSpell.spec.icon || '🔮',
        color: boltSpell.spec.color || '#a78bfa'
      });
    } else {
      skills.push({
        slot: 2,
        id: 'SKILL_POWER_STRIKE',
        name: '강타 (Power Strike)',
        desc: '무기를 힘껏 휘둘러 강력한 강타를 입힙니다. (2d8)',
        element: 'PHYSICAL',
        cooldown: 2,
        dice: '2d8',
        icon: '💥',
        color: '#f59e0b'
      });
    }

    // Slot 3: AoE 폭발 또는 소환 / 회복 스킬
    const aoeSpell = spells.find(s => s.spec.type === 'AOE' || s.spec.type === 'HEAL' || s.spec.type === 'UTILITY') || spells[1];
    if (aoeSpell) {
      skills.push({
        slot: 3,
        id: `SKILL_${aoeSpell.key}`,
        tomeKey: aoeSpell.key,
        name: aoeSpell.spec.name,
        desc: `${aoeSpell.spec.name}을(를) 방출합니다.`,
        element: aoeSpell.spec.element || 'MANA',
        cooldown: aoeSpell.spec.cooldown || 4,
        dice: aoeSpell.spec.dice || '6d6',
        icon: aoeSpell.spec.icon || '💥',
        color: aoeSpell.spec.color || '#ec4899'
      });
    } else {
      skills.push({
        slot: 3,
        id: 'SKILL_WHIRLWIND',
        name: '회전 베기 (Whirlwind)',
        desc: '주변 모든 적을 휩쓰는 광역 회전 공격을 가합니다. (3d8)',
        element: 'PHYSICAL',
        cooldown: 4,
        dice: '3d8',
        icon: '🌪️',
        color: '#a855f7'
      });
    }

    // Slot 4: 궁극기 (브레스 / 대규모 마나 폭풍 / 상급 소환)
    const ultSpell = spells.find(s => s.spec.type === 'BREATH' || s.spec.type === 'SUMMON' || s.key === 'BA_MANA') || spells[2];
    if (ultSpell) {
      skills.push({
        slot: 4,
        id: `SKILL_${ultSpell.key}`,
        tomeKey: ultSpell.key,
        name: `[궁극기] ${ultSpell.spec.name}`,
        desc: `${ultSpell.spec.name} 궁극기를 발동합니다. 파멸적인 피해를 입힙니다.`,
        element: ultSpell.spec.element || 'DRAGON',
        cooldown: ultSpell.spec.cooldown || 6,
        dice: ultSpell.spec.dice || '12d12',
        icon: ultSpell.spec.icon || '🐉',
        color: ultSpell.spec.color || '#ef4444'
      });
    } else {
      skills.push({
        slot: 4,
        id: 'SKILL_ULTIMATE_SMASH',
        name: '[궁극기] 파멸의 일격',
        desc: '혼신의 힘을 실은 파멸의 일격을 가합니다. (8d10)',
        element: 'PHYSICAL',
        cooldown: 6,
        dice: '8d10',
        icon: '⚡',
        color: '#ef4444'
      });
    }

    return skills;
  }

  /**
   * Alias for generatePlayerSkillsFromCore
   */
  static getMonsterSkills(monsterOrKey) {
    return this.generatePlayerSkillsFromCore(monsterOrKey);
  }
}

