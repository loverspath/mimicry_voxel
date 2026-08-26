/**
 * @module InventoryView
 * @category ui
 * @description 인벤토리 그리드, 아이템 슬롯, 장착/해제/포식 모달 및 코어 수치 계승 뷰 렌더러
 * @purity DOM Renderer
 * @dependencies Tags.js, MonsterRegistry.js, Perks.js, TomeSpellEngine.js
 * @exports EQUIP_BADGE_STYLES, TOME_FLAG_TRANSLATIONS, renderInventorySlotHTML, renderItemDetailHTML, renderTransferMaterialHTML, renderActiveCoreDetailsHTML
 */

import { PREFIX_TAGS, SUFFIX_TAGS } from '../entities/Tags.js';
import { getSpeciesConfig, MONSTER_GROWTH_PATTERNS } from '../entities/MonsterRegistry.js';
import { MONSTER_PERKS } from '../entities/Perks.js';
import { TomeSpellEngine } from '../systems/TomeSpellEngine.js';

/** 장비 슬롯 배지 메타 데이터 (슬롯명 → 표시 텍스트, 색상) */
export const EQUIP_BADGE_STYLES = {
  weapon:   { label: '무기',   bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  shield:   { label: '방패',   bg: 'rgba(59,130,246,0.15)',  color: '#38bdf8', border: 'rgba(59,130,246,0.3)' },
  bow:      { label: '활',     bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  quiver:   { label: '화살통', bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
  armor:    { label: '갑옷',   bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  helmet:   { label: '투구',   bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  gloves:   { label: '장갑',   bg: 'rgba(52,211,153,0.15)',  color: '#34d399', border: 'rgba(52,211,153,0.3)' },
  boots:    { label: '신발',   bg: 'rgba(168,85,247,0.15)',  color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  cloak:    { label: '망토',   bg: 'rgba(244,63,94,0.15)',   color: '#fb7185', border: 'rgba(244,63,94,0.3)' },
  lamp:     { label: '광원',   bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  ring1:    { label: '반지1',  bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
  ring2:    { label: '반지2',  bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
  amulet:   { label: '아뮬렛', bg: 'rgba(236,72,153,0.15)',  color: '#ec4899', border: 'rgba(236,72,153,0.3)' },
  subCore1: { label: '보조1',  bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  subCore2: { label: '보조2',  bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
};

/**
 * 인벤토리 슬롯 하나의 내부 HTML을 반환합니다.
 * @param {Object|null} item - 슬롯의 아이템 (없으면 null)
 * @param {Object} player - 플레이어 인스턴스
 * @returns {{ html: string, isEquipped: boolean, slotKey: string|null }}
 */
export function renderInventorySlotHTML(item, player, index = null) {
  let indexBadge = '';
  if (typeof index === 'number') {
    const label = index >= 0 && index < 26 ? `${String.fromCharCode(97 + index)})` : `${index + 1})`;
    indexBadge = `<span class="slot-index" style="color: #38bdf8; font-family: monospace; font-size: 0.85rem; font-weight: 700; min-width: 1.5rem; display: inline-block;">${label}</span>`;
  }

  if (!item) {
    return {
      html: `
        <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
          ${indexBadge}
          <span style="color: rgba(255,255,255,0.15); font-size: 0.8rem; font-style: italic;">빈 슬롯 (Empty)</span>
        </div>
      `,
      isEquipped: false,
      slotKey: null,
    };
  }

  // 장착 슬롯 판별
  let slotKey = null;
  if (player.equipment.weapon === item)        slotKey = 'weapon';
  else if (player.equipment.shield === item)   slotKey = 'shield';
  else if (player.equipment.bow === item)      slotKey = 'bow';
  else if (player.equipment.quiver === item)   slotKey = 'quiver';
  else if (player.equipment.armor === item)    slotKey = 'armor';
  else if (player.equipment.helmet === item)   slotKey = 'helmet';
  else if (player.equipment.gloves === item)   slotKey = 'gloves';
  else if (player.equipment.boots === item)    slotKey = 'boots';
  else if (player.equipment.cloak === item)    slotKey = 'cloak';
  else if (player.equippedLamp === item)       slotKey = 'lamp';
  else if (player.equipment.ring1 === item)    slotKey = 'ring1';
  else if (player.equipment.ring2 === item)    slotKey = 'ring2';
  else if (player.equipment.amulet === item)   slotKey = 'amulet';
  else if (player.equipment.subCore1 === item) slotKey = 'subCore1';
  else if (player.equipment.subCore2 === item) slotKey = 'subCore2';

  const isEquipped = slotKey !== null;

  // 배지 HTML 생성
  let equipLabel = '';
  if (slotKey && EQUIP_BADGE_STYLES[slotKey]) {
    const s = EQUIP_BADGE_STYLES[slotKey];
    equipLabel = `<span class="equip-badge" style="background: ${s.bg}; color: ${s.color}; border: 1px solid ${s.border}; font-size: 0.62rem; padding: 0.05rem 0.2rem; border-radius: 4px; font-weight: bold; margin-left: auto; white-space: nowrap;">${s.label}</span>`;
  }

  // 수량 표시
  let displayName = item.name;
  if (item.count && item.count > 1) {
    displayName += ` <span style="color: #60a5fa; font-weight: bold;">x${item.count}</span>`;
  }

  const html = `
    <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
      ${indexBadge}
      <span class="slot-char" style="color: ${item.color}; font-family: monospace; font-size: 1.1rem; font-weight: bold;">${item.char}</span>
      <span class="slot-name" style="font-size: 0.92rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</span>
    </div>
    ${equipLabel}
  `;

  return { html, isEquipped, slotKey };
}

/** ToME 원소 속성 배지 스타일 맵 */
const ELEMENT_BADGE_STYLES = {
  FIRE: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.35)' },
  COLD: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' },
  ELEC: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: 'rgba(234,179,8,0.35)' },
  ACID: { bg: 'rgba(132,204,22,0.15)', color: '#84cc16', border: 'rgba(132,204,22,0.35)' },
  POISON: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' },
  POIS: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' },
  MANA: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.35)' },
  DARK: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'rgba(167,139,250,0.35)' },
  DRAGON: { bg: 'rgba(244,63,94,0.15)', color: '#fb7185', border: 'rgba(244,63,94,0.35)' },
  PHYSICAL: { bg: 'rgba(148,163,184,0.12)', color: '#cbd5e1', border: 'rgba(148,163,184,0.25)' },
};

/** ToME 고유 플래그 한글화 및 메타데이터 맵 */
export const TOME_FLAG_TRANSLATIONS = {
  FREE_ACT: { name: "마비 면역 (Free Action)", color: "#34d399", desc: "마비 및 기절 상태이상에 면역이 됩니다." },
  RES_LITE: { name: "빛 저항 (Resist Light)", color: "#fbbf24", desc: "빛 및 섬광 속성 공격 피해를 대폭 경감합니다." },
  RES_DARK: { name: "어둠 저항 (Resist Dark)", color: "#a78bfa", desc: "어둠 및 암흑 속성 공격 피해를 대폭 경감합니다." },
  RES_FIRE: { name: "화염 저항 (Resist Fire)", color: "#ef4444", desc: "화염 속성 공격 피해를 대폭 경감합니다." },
  RES_COLD: { name: "냉기 저항 (Resist Cold)", color: "#38bdf8", desc: "냉기 속성 공격 피해를 대폭 경감합니다." },
  RES_ELEC: { name: "전격 저항 (Resist Elec)", color: "#eab308", desc: "번개 속성 공격 피해를 대폭 경감합니다." },
  RES_POIS: { name: "독 저항 (Resist Poison)", color: "#10b981", desc: "독 속성 공격 피해 및 중독 효과를 대폭 경감합니다." },
  RES_ACID: { name: "산 저항 (Resist Acid)", color: "#84cc16", desc: "산성 부식 및 산 속성 피해를 경감합니다." },
  SUST_STR: { name: "힘 유지 (Sustain STR)", color: "#f87171", desc: "힘 능력치 저하 및 드레인을 방어합니다." },
  SUST_INT: { name: "지능 유지 (Sustain INT)", color: "#60a5fa", desc: "지능 능력치 저하를 방어합니다." },
  SUST_WIS: { name: "지혜 유지 (Sustain WIS)", color: "#c084fc", desc: "지혜 능력치 저하를 방어합니다." },
  SUST_DEX: { name: "민첩 유지 (Sustain DEX)", color: "#34d399", desc: "민첩 능력치 저하를 방어합니다." },
  SUST_CON: { name: "생명력 유지 (Sustain CON)", color: "#2dd4bf", desc: "생명력 능력치 저하를 방어합니다." },
  SUST_CHR: { name: "매력 유지 (Sustain CHR)", color: "#f472b6", desc: "매력 능력치 저하를 방어합니다." },
  ACTIVATE: { name: "특수 발동 (Activate)", color: "#f59e0b", desc: "아이템 고유의 강력한 마법이나 아우라를 발동합니다." },
  SEE_INVIS: { name: "투시 (See Invisible)", color: "#38bdf8", desc: "은신하거나 투명화된 적을 즉시 감지합니다." },
  TELEPATHY: { name: "텔레파시 (Telepathy)", color: "#ec4899", desc: "시야 밖 몬스터의 정신을 감지합니다." },
  SLOW_DIGEST: { name: "완만한 대사 (Slow Digest)", color: "#a3e635", desc: "대사 속도를 안정화합니다." },
  REGEN: { name: "초재생 (Regeneration)", color: "#10b981", desc: "체력 자연 회복 속도를 비약적으로 가속합니다." },
  LITE1: { name: "발광 +1 (Light +1)", color: "#fbbf24", desc: "자체 광원 반경이 +1칸 증가합니다." },
  LITE2: { name: "발광 +2 (Light +2)", color: "#fbbf24", desc: "자체 광원 반경이 +2칸 증가합니다." },
  LITE3: { name: "발광 +3 (Light +3)", color: "#fbbf24", desc: "자체 광원 반경이 +3칸 증가합니다." },
  IM_FIRE: { name: "화염 면역 (Immune Fire)", color: "#ef4444", desc: "화염 피해를 100% 완전 무효화합니다." },
  IM_COLD: { name: "냉기 면역 (Immune Cold)", color: "#38bdf8", desc: "냉기 피해를 100% 완전 무효화합니다." },
  IM_ELEC: { name: "전격 면역 (Immune Elec)", color: "#eab308", desc: "전격 피해를 100% 완전 무효화합니다." },
  IM_ACID: { name: "산 면역 (Immune Acid)", color: "#84cc16", desc: "산성 피해 및 장비 부식을 완전 무효화합니다." },
  SPECIAL_GENE: { name: "고유 전승 유물", color: "#ffd700", desc: "발리노르의 전승에 기록된 유일무이한 고유 유물입니다." }
};

/**
 * 아이템 상세 정보 패널 HTML을 생성합니다.
 * @param {Object} item - 아이템 인스턴스
 * @param {Object} player - 플레이어 인스턴스
 * @param {boolean} isEquipped - 장착 여부
 * @param {boolean} isSubCore1 - 보조 코어 1 장착 여부
 * @param {boolean} isSubCore2 - 보조 코어 2 장착 여부
 * @param {boolean} hasDuplicate - 중복 소지 여부
 * @param {boolean} hasOtherCore - 계승 가능한 타 코어 존재 여부
 * @returns {string} HTML 문자열
 */
export function renderItemDetailHTML(item, player, isEquipped, isSubCore1, isSubCore2, hasDuplicate, hasOtherCore) {
  if (item.type === `CORE`) {
    const coreKey = item.tomeKey || item.coreType || item.type || 'MON_NOVICE_WARRIOR';
    const config = getSpeciesConfig(coreKey);
    const effectiveKey = config?.coreType || coreKey;
    const coreName = item.name || config?.displayName || config?.name || '몬스터 정수 코어';
    const coreChar = item.char || config?.char || '🧬';
    const coreColor = item.color || config?.baseColor || '#10b981';
    const level = config?.level || item.level || 1;
    const growthType = config?.growthType || 'BALANCED';
    const pattern = MONSTER_GROWTH_PATTERNS[growthType] || MONSTER_GROWTH_PATTERNS.BALANCED;
    const baseStats = config?.coreBase || { str: 10, int: 10, wis: 10, dex: 10, con: 10, chr: 10, cha: 10 };
    const maxStats = config?.coreMax || { str: 180, int: 180, wis: 180, dex: 180, con: 180, chr: 180, cha: 180 };
    const baseHp = config?.coreBaseHp || 18;
    const baseAC = config?.baseAC || 10;
    const fusionLevel = item.fusionLevel || 0;
    const legacyRatio = 0.15 + (player?.mimicCore?.fusionLevel || 0) * 0.015;

    // 뱃지 생성
    const growthBadge = `<span style="background: rgba(168,85,247,0.18); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">[${growthType}]</span>`;
    const levelBadge = `<span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">Lv.${level}</span>`;
    const fusionBadge = fusionLevel > 0 
      ? `<span style="background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">🔮 +${fusionLevel} 융합</span>`
      : '';

    // 1. 4 Active Skills 2x2 Grid
    const skills = TomeSpellEngine.getMonsterSkills(effectiveKey || item);
    const skillCardsHTML = skills.map((sk, idx) => {
      const elemKey = (sk.element || 'PHYSICAL').toUpperCase();
      const elemStyle = ELEMENT_BADGE_STYLES[elemKey] || ELEMENT_BADGE_STYLES.PHYSICAL;
      const slotNum = idx + 1;
      const skillColor = sk.color || '#38bdf8';

      return `
        <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.35rem 0.45rem; display: flex; flex-direction: column; gap: 0.2rem; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.2rem;">
            <span style="font-weight: 700; color: ${skillColor}; font-size: 0.72rem; display: flex; align-items: center; gap: 0.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="font-size: 0.8rem; flex-shrink: 0;">${sk.icon || '⚔️'}</span>
              <span style="overflow: hidden; text-overflow: ellipsis;" title="${sk.name}">[${slotNum}] ${sk.name}</span>
            </span>
            <span style="font-size: 0.6rem; background: ${elemStyle.bg}; color: ${elemStyle.color}; border: 1px solid ${elemStyle.border}; padding: 0.02rem 0.25rem; border-radius: 3px; font-weight: bold; flex-shrink: 0; white-space: nowrap;">${sk.element || 'PHYSICAL'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.66rem; color: #94a3b8; font-family: monospace;">
            <span>⚔️ 다이스: <b style="color: #f87171;">${sk.dice || '1d4'}</b></span>
            <span>⏳ 쿨다운: <b style="color: #fbbf24;">${sk.cooldown || 1}턴</b></span>
          </div>
        </div>
      `;
    }).join('');

    const skillsSectionHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.3rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.74rem; font-weight: bold; color: #38bdf8;">⚡ 개방되는 4대 의태 액티브 스킬:</span>
          <span style="font-size: 0.66rem; color: #94a3b8;">(1~4 슬롯 프리뷰)</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem;">
          ${skillCardsHTML}
        </div>
      </div>
    `;

    // 2. 6 Base Stats Grid
    const STAT_CONFIG = [
      { key: 'str', name: '힘 (STR)', val: baseStats.str ?? 10, max: maxStats.str ?? 180, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
      { key: 'int', name: '지능 (INT)', val: baseStats.int ?? 10, max: maxStats.int ?? 180, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
      { key: 'wis', name: '지혜 (WIS)', val: baseStats.wis ?? 10, max: maxStats.wis ?? 180, color: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)' },
      { key: 'dex', name: '민첩 (DEX)', val: baseStats.dex ?? 10, max: maxStats.dex ?? 180, color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
      { key: 'con', name: '생명력 (CON)', val: baseStats.con ?? 10, max: maxStats.con ?? 180, color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.25)' },
      { key: 'chr', name: '매력 (CHR)', val: baseStats.chr ?? baseStats.cha ?? 10, max: maxStats.chr ?? maxStats.cha ?? 180, color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)' },
    ];

    const statGridHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: bold;">📊 ToME 코어 베이스 6대 스탯:</span>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem;">
          ${STAT_CONFIG.map(s => `
            <div style="background: ${s.bg}; border: 1px solid ${s.border}; border-radius: 5px; padding: 0.25rem 0.35rem; text-align: center;">
              <div style="font-size: 0.62rem; color: ${s.color}; font-weight: bold;">${s.name}</div>
              <div style="font-size: 0.85rem; font-weight: 800; color: #f8fafc; margin-top: 0.05rem;">
                ${s.val} <span style="font-size: 0.6rem; color: #94a3b8; font-weight: normal;">/ max ${s.max}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // 3. Growth Multipliers & Base HP/AC
    const growthHTML = `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 5px; padding: 0.35rem 0.5rem; font-size: 0.72rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
          <span>📈 <b>성장 유형:</b> <b style="color: #c084fc;">${growthType}</b></span>
          <span style="color: #94a3b8; font-size: 0.68rem;">기본 HP: <b style="color: #ef4444;">${baseHp}</b> | 기본 AC: <b style="color: #38bdf8;">+${baseAC}</b></span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; color: #cbd5e1; font-family: monospace; font-size: 0.68rem;">
          <span>STR: <b style="color: #f87171;">x${(pattern.str || 1.0).toFixed(1)}</b></span>
          <span>DEX: <b style="color: #34d399;">x${(pattern.dex || 1.0).toFixed(1)}</b></span>
          <span>CON: <b style="color: #2dd4bf;">x${(pattern.con || 1.0).toFixed(1)}</b></span>
          <span>INT: <b style="color: #60a5fa;">x${(pattern.int || 1.0).toFixed(1)}</b></span>
        </div>
      </div>
    `;

    // 4. Resistance Flags & Perks
    const flagBadges = [];
    const allFlags = [...(config?.perks || []), ...(config?.flags || [])];
    const seenFlags = new Set();

    for (let f of allFlags) {
      if (!f || seenFlags.has(f)) continue;
      seenFlags.add(f);
      const info = TOME_FLAG_TRANSLATIONS[f];
      const perk = MONSTER_PERKS[f];
      if (info) {
        flagBadges.push(`<span style="background: rgba(255,255,255,0.05); color: ${info.color}; border: 1px solid ${info.color}44; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">${info.name.split(' (')[0]}</span>`);
      } else if (perk) {
        flagBadges.push(`<span style="background: rgba(251,191,36,0.12); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">⭐ ${perk.name}</span>`);
      }
    }

    const flagsHTML = flagBadges.length > 0 ? `
      <div style="display: flex; flex-direction: column; gap: 0.2rem;">
        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: bold;">🛡️ 고유 저항 및 특성 플래그:</span>
        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
          ${flagBadges.join('')}
        </div>
      </div>
    ` : '';

    // 5. ToME Lore
    const flavorText = item.flavorText || config?.flavorText || config?.desc || 'ToME 지하 깊은 곳에 서식하는 몬스터의 핵심 정수입니다.';
    const coreFlavorHTML = `
      <div style="background: rgba(30, 41, 59, 0.45); border-left: 3px solid #fbbf24; border-radius: 6px; padding: 0.45rem 0.65rem; backdrop-filter: blur(8px);">
        <p style="font-size: 0.65rem; color: #fbbf24; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.15rem 0;">📜 ToME 생태 서사 (Lore)</p>
        <p style="font-style: italic; font-size: 0.75rem; line-height: 1.4; color: #e2e8f0; margin: 0;">“${flavorText}”</p>
      </div>
    `;

    // 6. Main Core Warning
    const mainCoreWarningHTML = `
      <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.35rem; font-size: 0.72rem; color: #f43f5e; line-height: 1.35;">
        ⚠️ <b>메인 코어로 의태 시:</b> 레벨이 <b>1로 리셋</b>되며, 누적 추가 스탯의 <b>${(legacyRatio * 100).toFixed(1)}%가 영구 유산 스탯</b>으로 보존 이전됩니다.
      </div>
    `;

    return `
      <div class="detail-header" style="text-align: left; display: flex; flex-direction: column; gap: 0.2rem;">
        <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
          <span class="detail-type" style="font-size: 0.68rem; color: #10b981; text-transform: uppercase; font-weight: bold;">[🧬 몬스터 정수 코어]</span>
          ${levelBadge}
          ${growthBadge}
          ${fusionBadge}
        </div>
        <h3 class="detail-title" style="color: ${coreColor}; font-size: 1.15rem; font-weight: 700; margin: 0.1rem 0; display: flex; align-items: center; gap: 0.35rem;">
          <span style="font-size: 1.25rem;">${coreChar}</span>
          <span>${coreName}</span>
        </h3>
      </div>
      <div class="detail-desc" style="margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-muted); text-align: left; display: flex; flex-direction: column; gap: 0.45rem; line-height: 1.4; overflow-y: auto; max-height: 240px; padding-right: 4px;">
        ${skillsSectionHTML}
        ${statGridHTML}
        ${growthHTML}
        ${flagsHTML}
        ${coreFlavorHTML}
        ${mainCoreWarningHTML}
      </div>
      <div class="detail-actions" style="margin-top: auto; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.55rem;">
        <button class="modal-btn" id="swap-main-core-btn" style="background: rgba(244,63,94,0.18); border-color: rgba(244,63,94,0.4); color: #f43f5e; font-weight: bold;">
          🧬 메인 코어로 의태 장착 (Lv.1 리셋)
        </button>
        <button class="modal-btn" id="eat-core-btn" style="background: rgba(16,185,129,0.18); border-color: rgba(16,185,129,0.4); color: #34d399; font-weight: bold;">
          🥩 코어 포식 (돌연변이 흡수)
        </button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
          <button class="modal-btn" id="sub-core1-btn" style="${isSubCore1 ? `background: rgba(59,130,246,0.22); border-color: rgba(59,130,246,0.5); color: #60a5fa; font-weight: bold;` : `background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.3); color: #93c5fd;`}">
            ${isSubCore1 ? `🛡️ 보조 1 해제` : `🛡️ 보조 1 장착`}
          </button>
          <button class="modal-btn" id="sub-core2-btn" style="${isSubCore2 ? `background: rgba(59,130,246,0.22); border-color: rgba(59,130,246,0.5); color: #60a5fa; font-weight: bold;` : `background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.3); color: #93c5fd;`}">
            ${isSubCore2 ? `🛡️ 보조 2 해제` : `🛡️ 보조 2 장착`}
          </button>
        </div>
        <button class="modal-btn danger" id="detail-drop-btn">🗑️ 버리기</button>
      </div>
    `;
  }

  const isUsable = item.type === 'SCROLL' || item.type === 'POTION' || item.type === 'WAND' || item.type === 'STAFF' || item.type === 'ROD' || item.type === 'FOOD' || item.type === 'FLASK' || item.tval === 71 || item.tval === 70 || item.tval === 77 || item.tval === 80 || item.tval === 65 || item.tval === 55 || item.tval === 66;

  if (isUsable) {
    let desc = '';
    const isPotion = item.type === 'POTION' || item.tval === 71;
    const isScroll = item.type === 'SCROLL' || item.tval === 70;
    const isWand = item.type === 'WAND' || item.tval === 65;
    const isStaff = item.type === 'STAFF' || item.tval === 55;
    const isRod = item.type === 'ROD' || item.tval === 66;
    const isFood = item.type === 'FOOD' || item.tval === 80;
    const isFlask = item.type === 'FLASK' || item.tval === 77;

    let badgeLabel = '📦 소모품/도구';
    let badgeColor = '#38bdf8';
    let actionBtnLabel = '사용하기';

    if (isPotion) {
      badgeLabel = '🧪 비전의 연금 물약';
      badgeColor = '#34d399';
      actionBtnLabel = '🧪 물약 마시기';
      desc = item.flavorText || '마시면 체력을 회복하거나 신비한 능력이 활성화됩니다.';
    } else if (isScroll) {
      badgeLabel = '📜 고대 마법 주문서';
      badgeColor = '#a855f7';
      actionBtnLabel = '📜 주문서 읽기';
      desc = item.flavorText || '읽으면 고대의 주문이 즉시 발동합니다.';
    } else if (isWand) {
      badgeLabel = '🪄 마법 완드 (Wand)';
      badgeColor = '#38bdf8';
      const ch = item.charges !== undefined ? item.charges : 5;
      actionBtnLabel = `🪄 완드 발사 (충전: ${ch}회)`;
      desc = item.flavorText || '목표를 향해 강력한 마법 광선을 발사합니다.';
    } else if (isStaff) {
      badgeLabel = '🦯 마법 스태프 (Staff)';
      badgeColor = '#c084fc';
      const ch = item.charges !== undefined ? item.charges : 5;
      actionBtnLabel = `🦯 스태프 방출 (충전: ${ch}회)`;
      desc = item.flavorText || '주변 전역에 강력한 마력 파동을 방출합니다.';
    } else if (isRod) {
      badgeLabel = '⚡ 마법 로드 (Rod)';
      badgeColor = '#fbbf24';
      actionBtnLabel = (item.timeout && item.timeout > 0) ? `⏳ 재충전 중 (${item.timeout}턴)` : `⚡ 로드 발동 (쿨다운제)`;
      desc = item.flavorText || '충전 소모 없이 쿨다운을 거쳐 영구히 재사용 가능한 마법 지휘봉입니다.';
    } else if (isFood) {
      badgeLabel = '🍞 음식/버섯 (Food)';
      badgeColor = '#d97706';
      actionBtnLabel = '🍴 음식 섭취하기';
      desc = item.flavorText || '던전 탐험 중 섭취 가능한 비상식량입니다.';
    } else if (isFlask) {
      badgeLabel = '🏮 기름 플라스크 (Oil)';
      badgeColor = '#f59e0b';
      actionBtnLabel = '🏮 등불 급유 / 투척';
      desc = item.flavorText || '등불의 지속 시간을 연장하거나 던져서 화염을 일으킵니다.';
    }
    
    const consumableFlavorHTML = item.flavorText ? `
      <div style="background: rgba(30, 41, 59, 0.45); border-left: 3px solid #fbbf24; border-radius: 6px; padding: 0.45rem 0.65rem; margin-top: 0.35rem; backdrop-filter: blur(8px);">
        <p style="font-size: 0.65rem; color: #fbbf24; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem;">📜 ToME 배경 서사 (Lore)</p>
        <p style="font-style: italic; font-size: 0.75rem; line-height: 1.4; color: #e2e8f0; margin: 0;">“${item.flavorText}”</p>
      </div>
    ` : '';

    return `
      <div class="detail-header" style="text-align: left; display: flex; flex-direction: column; gap: 0.2rem;">
        <span class="detail-type" style="font-size: 0.68rem; color: ${badgeColor}; font-weight: bold; text-transform: uppercase;">[${badgeLabel}]</span>
        <h3 class="detail-title" style="color: ${item.color}; font-size: 1.15rem; font-weight: 700; margin: 0.1rem 0; display: flex; align-items: center; gap: 0.35rem;">
          <span style="font-size: 1.25rem;">${item.char}</span>
          <span>${item.name}</span>
        </h3>
      </div>
      <div class="detail-desc" style="margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-muted); text-align: left; overflow-y: auto; max-height: 140px; padding-right: 4px; line-height: 1.4; display: flex; flex-direction: column; gap: 0.35rem;">
        <p><b>효과:</b> <span style="color: #cbd5e1;">${desc}</span></p>
        ${consumableFlavorHTML}
      </div>
      <div class="detail-actions" style="margin-top: auto; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.5rem;">
        <button class="modal-btn primary" id="detail-use-btn" style="background: rgba(56,189,248,0.18); border-color: rgba(56,189,248,0.4); color: ${badgeColor}; font-weight: bold;">
          ${actionBtnLabel}
        </button>
        <button class="modal-btn danger" id="detail-drop-btn">버리기</button>
      </div>
    `;
  }

  // =========================================================================
  // 🛡️ ToME 정통 장착 장비 상세 인스펙터 (Detailed Gear Inspector)
  // =========================================================================

  const isArtifact = item.specialTags?.includes('ARTIFACT') || item.color === '#ffd700' || (item.name && item.name.includes('유물'));
  const isEgo = (item.prefixes && item.prefixes.length > 0) || (item.suffixes && item.suffixes.length > 0);
  
  const gradeBadge = isArtifact 
    ? `<span style="background: rgba(251,191,36,0.18); color: #fbbf24; border: 1px solid rgba(251,191,36,0.4); padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">👑 전설 유물 (Artifact)</span>`
    : isEgo 
      ? `<span style="background: rgba(56,189,248,0.18); color: #38bdf8; border: 1px solid rgba(56,189,248,0.4); padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">✨ 에고 장비 (Ego)</span>`
      : `<span style="background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.3); padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">🛡️ 일반 장비 (Standard)</span>`;

  const SLOT_NAME_MAP = {
    WEAPON: '근접 무기',
    SHIELD: '방패',
    BOW: '원거리 활',
    QUIVER: '화살통',
    ARMOR: '갑옷',
    HELMET: '투구',
    GLOVES: '장갑',
    BOOTS: '신발',
    CLOAK: '망토',
    RING: '반지',
    AMULET: '목걸이',
    LIGHT: '광원 등불',
    LAMP: '광원 등불'
  };
  const slotNameKor = SLOT_NAME_MAP[item.slotType] || SLOT_NAME_MAP[item.type] || item.type;

  // 1. 핵심 스펙 그리드 블록 (Dice, AC, Range, Light)
  const specItems = [];
  if (item.dice) {
    specItems.push(`<div><span style="color: #94a3b8;">⚔️ 공격 다이스:</span> <b style="color: #f87171;">${item.dice}</b></div>`);
  }
  if (typeof item.baseAC === 'number' && item.baseAC > 0) {
    specItems.push(`<div><span style="color: #94a3b8;">🛡️ 기본 방어 (AC):</span> <b style="color: #38bdf8;">+${item.baseAC}</b></div>`);
  }
  if (item.upgradeLevel && item.upgradeLevel > 0) {
    specItems.push(`<div><span style="color: #94a3b8;">✨ 강화 보정:</span> <b style="color: #34d399;">+${item.upgradeLevel}</b></div>`);
  }
  if (item.toHit) {
    specItems.push(`<div><span style="color: #94a3b8;">🎯 명중 보정:</span> <b style="color: #fbbf24;">+${item.toHit}</b></div>`);
  }
  if (item.toDmg) {
    specItems.push(`<div><span style="color: #94a3b8;">💥 피해 보정:</span> <b style="color: #f43f5e;">+${item.toDmg}</b></div>`);
  }
  if (item.range) {
    specItems.push(`<div><span style="color: #94a3b8;">🏹 사거리:</span> <b style="color: #a78bfa;">${item.range}칸</b></div>`);
  }
  if (item.lightBonus > 0) {
    specItems.push(`<div><span style="color: #94a3b8;">🏮 시야 광원:</span> <b style="color: #fbbf24;">+${item.lightBonus}칸</b></div>`);
  }

  const specGridHTML = specItems.length > 0 ? `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 0.5rem; background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.45rem 0.6rem; font-size: 0.78rem;">
      ${specItems.join('')}
    </div>
  ` : '';

  // 2. 6대 능력치 보너스 칩 (STR, DEX, CON, INT, WIS, CHR)
  const statChips = [];
  const STAT_CONFIG = {
    str: { name: '힘 (STR)', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' },
    dex: { name: '민첩 (DEX)', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
    con: { name: '생명력 (CON)', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.3)' },
    int: { name: '지능 (INT)', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)' },
    wis: { name: '지혜 (WIS)', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)' },
    cha: { name: '매력 (CHR)', color: '#ec4899', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.3)' },
  };

  for (let key in item.statBonuses) {
    const val = item.statBonuses[key];
    if (val && val !== 0 && STAT_CONFIG[key]) {
      const cfg = STAT_CONFIG[key];
      const sign = val > 0 ? '+' : '';
      statChips.push(`
        <span style="background: ${cfg.bg}; color: ${cfg.color}; border: 1px solid ${cfg.border}; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: bold; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.2rem;">
          ${cfg.name} ${sign}${val}
        </span>
      `);
    }
  }

  const statChipsHTML = statChips.length > 0 ? `
    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
      <span style="font-size: 0.72rem; color: #94a3b8; font-weight: bold;">📊 스탯 보정치:</span>
      <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
        ${statChips.join('')}
      </div>
    </div>
  ` : '';

  // 3. ToME 고유 플래그 & 에고 / 슬레이 목록
  const flagItems = [];
  if (item.flags && Array.isArray(item.flags)) {
    for (let f of item.flags) {
      const info = TOME_FLAG_TRANSLATIONS[f];
      if (info) {
        flagItems.push(`<li>• <span style="color: ${info.color}; font-weight: bold;">${info.name}</span>: <span style="color: #cbd5e1;">${info.desc}</span></li>`);
      } else {
        flagItems.push(`<li>• <span style="color: #38bdf8; font-weight: bold;">${f}</span></li>`);
      }
    }
  }

  if (item.prefixes && item.prefixes.length > 0) {
    for (let p of item.prefixes) {
      let tag = PREFIX_TAGS[p];
      if (tag) {
        let bonuses = Object.entries(tag.stats || {}).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(', ');
        bonuses = bonuses ? ` (${bonuses})` : ``;
        flagItems.push(`<li>• <span style="color: #fbbf24; font-weight: bold;">[접두] ${tag.name}</span>: <span style="color: #cbd5e1;">${tag.desc}${bonuses}</span></li>`);
      }
    }
  }

  if (item.suffixes && item.suffixes.length > 0) {
    for (let s of item.suffixes) {
      let tag = SUFFIX_TAGS[s];
      if (tag) {
        let bonuses = Object.entries(tag.stats || {}).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(', ');
        bonuses = bonuses ? ` (${bonuses})` : ``;
        flagItems.push(`<li>• <span style="color: #38bdf8; font-weight: bold;">[접미] ${tag.name}</span>: <span style="color: #cbd5e1;">${tag.desc}${bonuses}</span></li>`);
      }
    }
  }

  if (item.specialTags && item.specialTags.length > 0) {
    const tagCounts = {};
    for (let tag of item.specialTags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    for (let [tag, count] of Object.entries(tagCounts)) {
      const countText = count > 1 ? ` +${count}` : "";
      if (tag === 'FOCUS') {
        flagItems.push(`<li>• <span style="color: #60a5fa; font-weight: bold;">🎯 [특수] 집중 (FOCUS)${countText}</span>: <span style="color: #cbd5e1;">스킬 피해량 <b style="color: #60a5fa;">+${count * 20}%</b> 증폭</span></li>`);
      } else if (tag === 'QUICKCAST') {
        flagItems.push(`<li>• <span style="color: #fbbf24; font-weight: bold;">⚡ [특수] 신속 (QUICKCAST)${countText}</span>: <span style="color: #cbd5e1;">쿨다운 <b style="color: #38bdf8;">+${count}턴 가속</b></span></li>`);
      } else if (tag === 'APOCALYPSE') {
        flagItems.push(`<li>• <span style="color: #ef4444; font-weight: bold;">💀 [특수] 종말 (APOCALYPSE)${countText}</span>: <span style="color: #cbd5e1;">타격 시 <b style="color: #f43f5e;">${count * 2}d4 종말 추가 피해</b></span></li>`);
      } else if (tag === 'EXTRA_ATTACK') {
        flagItems.push(`<li>• <span style="color: #f43f5e; font-weight: bold;">⚔️ [특수] 추가타 (EXTRA_ATTACK)${countText}</span>: <span style="color: #cbd5e1;">공격 횟수 <b style="color: #f43f5e;">+${count}회</b></span></li>`);
      } else if (tag !== 'ARTIFACT' && tag !== 'LEGENDARY' && tag !== 'SLAYER') {
        flagItems.push(`<li>• <span style="color: #a855f7; font-weight: bold;">🎯 [특수] ${tag}${countText}</span></li>`);
      }
    }
  }

  const flagsHTML = flagItems.length > 0 ? `
    <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.4rem; margin-top: 0.2rem; font-size: 0.76rem;">
      <p style="font-weight: bold; color: var(--text-main); margin-bottom: 0.25rem;">✨ 고유 플래그 및 마법 효과:</p>
      <ul style="list-style-type: none; padding-left: 0.2rem; display: flex; flex-direction: column; gap: 0.25rem; margin: 0;">
        ${flagItems.join('')}
      </ul>
    </div>
  ` : '';

  // 4. 로어 & 플레이버 텍스트 (Lore)
  const loreHTML = item.flavorText ? `
    <div style="background: rgba(30, 41, 59, 0.45); border-left: 3px solid #fbbf24; border-radius: 6px; padding: 0.45rem 0.65rem; margin-top: 0.35rem; backdrop-filter: blur(8px);">
      <p style="font-size: 0.65rem; color: #fbbf24; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem;">📜 ToME 전승 서사 (Lore)</p>
      <p style="font-style: italic; font-size: 0.75rem; line-height: 1.4; color: #e2e8f0; margin: 0;">“${item.flavorText}”</p>
    </div>
  ` : '';

  // 5. 무게 및 가치 바
  const weightText = item.weight ? `${(item.weight / 10).toFixed(1)} lbs` : '1.0 lbs';
  const costText = item.cost ? `${item.cost.toLocaleString()} G` : '50 G';
  const levelText = item.level ? `Lv.${item.level}` : 'Lv.1';
  const metaBarHTML = `
    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.35rem; margin-top: 0.2rem;">
      <span>⚖️ 무게: <b style="color: #94a3b8;">${weightText}</b></span>
      <span>💰 가치: <b style="color: #fbbf24;">${costText}</b></span>
      <span>🏛️ 깊이: <b style="color: #94a3b8;">${levelText}</b></span>
    </div>
  `;

  return `
    <div class="detail-header" style="text-align: left; display: flex; flex-direction: column; gap: 0.2rem;">
      <div style="display: flex; align-items: center; gap: 0.4rem;">
        ${gradeBadge}
        <span style="font-size: 0.68rem; color: #94a3b8; font-weight: bold;">[${slotNameKor}]</span>
      </div>
      <h3 class="detail-title" style="color: ${item.color}; font-size: 1.15rem; font-weight: 700; margin: 0.1rem 0; display: flex; align-items: center; gap: 0.35rem;">
        <span style="font-size: 1.25rem;">${item.char}</span>
        <span>${item.name}</span>
      </h3>
    </div>
    <div class="detail-desc" style="margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-muted); text-align: left; overflow-y: auto; max-height: 180px; padding-right: 4px; display: flex; flex-direction: column; gap: 0.4rem;">
      ${specGridHTML}
      ${statChipsHTML}
      ${flagsHTML}
      ${loreHTML}
      ${metaBarHTML}
    </div>
    <div class="detail-actions" style="margin-top: auto; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.5rem;">
      <button class="modal-btn primary" id="detail-equip-btn" style="${isEquipped ? 'background: rgba(244,63,94,0.15); border-color: rgba(244,63,94,0.3); color: #f43f5e;' : 'background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #10b981;'} font-weight: bold;">
        ${isEquipped ? `장착 해제 (${slotNameKor})` : `${slotNameKor} 장착하기`}
      </button>
      <button class="modal-btn danger" id="detail-drop-btn">버리기</button>
    </div>
  `;
}

/**
 * 코어 수치 계승 소재 선택 UI의 HTML을 반환합니다.
 * @param {Object} targetItem - 계승 대상 코어 아이템
 * @param {Object[]} otherCores - 소재 후보 코어 배열
 * @returns {string} HTML 문자열
 */
export function renderTransferMaterialHTML(targetItem, otherCores) {
  const coresHTML = otherCores.map((core, idx) => `
    <button class="modal-btn" data-index="${idx}" style="text-align: left; background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.25); color: #3b82f6; display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; cursor: pointer; transition: background 0.15s ease;">
      <span>🧬 ${core.name}</span>
      <span style="font-weight: bold; font-size: 0.8rem; background: rgba(59,130,246,0.15); padding: 0.1rem 0.4rem; border-radius: 4px;">+${core.fusionLevel} 계승</span>
    </button>
  `).join('');

  return `
    <div class="detail-header" style="text-align: left;">
      <span class="detail-type" style="font-size: 0.7rem; color: #3b82f6; text-transform: uppercase;">[🔮 수치 계승 소재 선택]</span>
      <h3 class="detail-title" style="color: #3b82f6; font-size: 1.1rem; font-weight:600; margin-top: 0.15rem;">소재로 사용할 코어 선택</h3>
    </div>
    <div class="detail-desc" style="margin-top: 0.5rem; font-size: 0.82rem; color: var(--text-muted); text-align: left; display: flex; flex-direction: column; gap: 0.4rem; line-height: 1.4; overflow-y: auto; max-height: 120px; padding-right: 4px;">
      <p>소재로 사용될 코어는 <b>파괴</b>되며, 해당 코어의 <b>+수치(융합 레벨) 전체</b>가 대상 코어 [${targetItem.name}]에 합산되어 이전됩니다.</p>
      <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.4rem;">
        ${coresHTML}
      </div>
    </div>
    <div class="detail-actions" style="margin-top: auto; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.6rem;">
      <button class="modal-btn" id="cancel-transfer-btn" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); color: var(--text-muted);">
        취소
      </button>
    </div>
  `;
}

/**
 * 장착 중인 액티브 코어 상세 정보 모달 HTML을 생성합니다. (100% ToME 2.3.5 실데이터 동적 렌더러)
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderActiveCoreDetailsHTML(player) {
  const core = player.mimicCore || { name: '인간', coreType: 'HUMAN' };
  const coreType = core.coreType || core.name || 'HUMAN';
  const config = getSpeciesConfig(coreType);
  const coreName = core.name || config.name || '인간';
  const coreColor = core.baseColor || config.baseColor || '#10b981';
  const coreChar = core.char || config.char || '@';
  const fusionLevel = core.fusionLevel || 0;
  const lightBonus = core.lightBonus || config.lightBonus || 0;

  // 1. ToME 6대 베이스 능력치 및 한계치 (STR, INT, WIS, DEX, CON, CHR)
  const baseStats = config.coreBase || { str: 10, int: 10, wis: 10, dex: 10, con: 10, chr: 10, cha: 10 };
  const maxStats = config.coreMax || { str: 180, int: 180, wis: 180, dex: 180, con: 180, chr: 180, cha: 180 };
  const baseHp = config.coreBaseHp || 18;
  const baseAC = config.baseAC || 10;

  const STAT_CONFIG = [
    { key: 'str', name: '힘 (STR)', val: baseStats.str ?? 10, max: maxStats.str ?? 180, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
    { key: 'int', name: '지능 (INT)', val: baseStats.int ?? 10, max: maxStats.int ?? 180, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
    { key: 'wis', name: '지혜 (WIS)', val: baseStats.wis ?? 10, max: maxStats.wis ?? 180, color: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)' },
    { key: 'dex', name: '민첩 (DEX)', val: baseStats.dex ?? 10, max: maxStats.dex ?? 180, color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    { key: 'con', name: '생명력 (CON)', val: baseStats.con ?? 10, max: maxStats.con ?? 180, color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.25)' },
    { key: 'chr', name: '매력 (CHR)', val: baseStats.chr ?? baseStats.cha ?? 10, max: maxStats.chr ?? maxStats.cha ?? 180, color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)' },
  ];

  const statGridHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; margin-top: 0.2rem;">
      ${STAT_CONFIG.map(s => `
        <div style="background: ${s.bg}; border: 1px solid ${s.border}; border-radius: 6px; padding: 0.35rem 0.45rem; text-align: center;">
          <div style="font-size: 0.65rem; color: ${s.color}; font-weight: bold;">${s.name}</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: #f8fafc; margin-top: 0.05rem;">
            ${s.val} <span style="font-size: 0.65rem; color: #94a3b8; font-weight: normal;">/ max ${s.max}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 2. 성장 유형 및 성장 공식 배율
  const growthType = config.growthType || 'BALANCED';
  const pattern = MONSTER_GROWTH_PATTERNS[growthType] || MONSTER_GROWTH_PATTERNS.BALANCED;
  const growthMultiplierHTML = `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 0.45rem 0.6rem; font-size: 0.74rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
        <span>📈 <b>성장 유형:</b> <b style="color: #c084fc;">${growthType}</b></span>
        <span style="color: #94a3b8; font-size: 0.68rem;">기본 HP: <b style="color: #ef4444;">${baseHp}</b> | 기본 AC: <b style="color: #38bdf8;">+${baseAC}</b></span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; color: #cbd5e1; font-family: monospace; font-size: 0.7rem;">
        <span>STR: <b style="color: #f87171;">x${pattern.str.toFixed(1)}</b></span>
        <span>DEX: <b style="color: #34d399;">x${pattern.dex.toFixed(1)}</b></span>
        <span>CON: <b style="color: #2dd4bf;">x${pattern.con.toFixed(1)}</b></span>
        <span>INT: <b style="color: #60a5fa;">x${pattern.int.toFixed(1)}</b></span>
        <span>HP: <b style="color: #fb7185;">x${(pattern.hp || 1.0).toFixed(1)}</b></span>
      </div>
    </div>
  `;

  // 3. 실제 활성화된 고유 특성 (Perks)
  const perkDescList = [];
  if (config.perks && Array.isArray(config.perks)) {
    for (let perkId of config.perks) {
      let perk = MONSTER_PERKS[perkId];
      if (perk) {
        perkDescList.push(`<li>• <span style="color: #fbbf24; font-weight: bold;">${perk.name}</span>: <span style="color: #cbd5e1;">${perk.desc}</span></li>`);
      }
    }
  }

  const perksHTML = perkDescList.length > 0 ? `
    <div style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 0.4rem; margin-top: 0.2rem;">
      <p style="font-weight: bold; color: var(--text-main); font-size: 0.78rem; margin-bottom: 0.25rem;">
        💡 코어 고유 특성 (Active Perks):
      </p>
      <ul style="list-style-type: none; padding-left: 0.2rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; margin: 0;">
        ${perkDescList.join('')}
      </ul>
    </div>
  ` : `
    <div style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 0.4rem; margin-top: 0.2rem; font-size: 0.74rem; color: var(--text-muted); font-style: italic;">
      💡 코어 고유 특성: 기본 신체 특성 (추가 고유 패시브 없음)
    </div>
  `;

  // 4. 의태 고유 스킬 및 종족 숙련도 레벨
  const masteryLvl = player.getMorphMasteryLevel ? player.getMorphMasteryLevel(coreType) : (player.body?.getLoreLevel ? player.body.getLoreLevel(coreType) : 1);
  const loreXp = player.body?.loreRegistry?.[coreType] || 0;
  const innateSkills = player.getInnateSkills ? player.getInnateSkills() : (player.activeSkills || []);

  const skillsListHTML = innateSkills.length > 0 ? innateSkills.map(skill => {
    const isUnlocked = skill.isUnlocked ? skill.isUnlocked(masteryLvl) : true;
    const reqMastery = skill.requiredMastery || 1;
    const effectiveCd = skill.getEffectiveCooldown ? skill.getEffectiveCooldown(masteryLvl) : skill.cooldown;
    const badgeColor = isUnlocked ? '#34d399' : '#f87171';
    const badgeText = isUnlocked ? `🟢 개방됨 (Lv.${reqMastery})` : `🔒 잠김 (요구 Lv.${reqMastery})`;

    return `
      <div style="background: rgba(0,0,0,0.25); border: 1px solid ${isUnlocked ? (skill.color || '#38bdf8') : 'rgba(255,255,255,0.08)'}; border-radius: 5px; padding: 0.35rem 0.5rem; opacity: ${isUnlocked ? '1' : '0.6'}; font-size: 0.74rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem;">
          <span style="font-weight: bold; color: ${skill.color || '#38bdf8'}; display: flex; align-items: center; gap: 0.25rem;">
            <span>${skill.icon || '⚔️'}</span>
            <span>${skill.name}</span>
          </span>
          <span style="font-size: 0.65rem; color: ${badgeColor}; font-weight: bold;">${badgeText}</span>
        </div>
        <div style="color: var(--text-muted); font-size: 0.7rem; line-height: 1.3;">${skill.desc}</div>
        <div style="display: flex; gap: 0.5rem; font-size: 0.65rem; font-family: monospace; color: #94a3b8; margin-top: 0.15rem;">
          <span>쿨다운: <b style="color: #f59e0b;">${effectiveCd}턴</b></span>
          <span>사거리: <b style="color: #34d399;">${skill.maxRange}칸</b></span>
          <span>위력: <b style="color: #cbd5e1;">${skill.dice}</b></span>
        </div>
      </div>
    `;
  }).join('') : `
    <div style="font-size: 0.72rem; color: var(--text-muted); font-style: italic;">
      개방 가능한 고유 의태 스펠이 없습니다.
    </div>
  `;

  const skillsSectionHTML = `
    <div style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 0.4rem; margin-top: 0.2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
        <span style="font-weight: bold; color: var(--text-main); font-size: 0.78rem;">⚡ 개방 의태 스킬 & 숙련도:</span>
        <span style="font-size: 0.72rem; color: #38bdf8; font-weight: bold;">Lv.${masteryLvl} / 50 <span style="font-size: 0.65rem; color: #94a3b8;">(${loreXp} XP)</span></span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.3rem;">
        ${skillsListHTML}
      </div>
    </div>
  `;

  // 5. ToME 전승 생태 서사 (Lore)
  const flavorText = config.flavorText || config.desc || "A creature from the deep subterranean depths of ToME.";
  const coreFlavorHTML = `
    <div style="background: rgba(30, 41, 59, 0.45); border-left: 3px solid #fbbf24; border-radius: 6px; padding: 0.45rem 0.65rem; margin-top: 0.2rem; backdrop-filter: blur(8px);">
      <p style="font-size: 0.65rem; color: #fbbf24; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem;">📜 ToME 전승 서사 (Lore)</p>
      <p style="font-style: italic; font-size: 0.75rem; line-height: 1.4; color: #e2e8f0; margin: 0;">“${flavorText}”</p>
    </div>
  `;

  // 6. 메타 및 승계 비율
  const legacyRatio = 0.15 + (fusionLevel * 0.015);
  const fusionBadge = fusionLevel > 0 ? `<span style="background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">🔮 융합 +${fusionLevel}</span>` : '';
  const lightBadge = lightBonus > 0 ? `<span style="background: rgba(251,191,36,0.18); color: #fbbf24; border: 1px solid rgba(251,191,36,0.35); padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">🏮 광원 +${lightBonus}칸</span>` : '';

  return `
    <div class="detail-header" style="text-align: left; display: flex; flex-direction: column; gap: 0.15rem;">
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        <span class="detail-type" style="font-size: 0.68rem; color: #10b981; text-transform: uppercase; font-weight: bold;">[🧬 몬스터 정수 코어]</span>
        ${fusionBadge}
        ${lightBadge}
      </div>
      <h3 class="detail-title" style="color: ${coreColor}; font-size: 1.15rem; font-weight: 700; margin: 0.1rem 0; display: flex; align-items: center; gap: 0.35rem;">
        <span style="font-size: 1.25rem;">${coreChar}</span>
        <span>${coreName}</span>
      </h3>
    </div>
    <div class="detail-desc" style="margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-muted); text-align: left; display: flex; flex-direction: column; gap: 0.4rem; line-height: 1.4; overflow-y: auto; max-height: 280px; padding-right: 4px;">
      <p style="margin: 0; font-size: 0.76rem;"><b>설명:</b> 당신이 현재 모방하여 머물고 있는 바디의 근본(코어) 데이터 형상입니다. 이 코어의 육체적 기본 틀을 기준으로 스킬 및 스탯 성장이 이루어집니다.</p>
      
      <div>
        <span style="font-size: 0.74rem; font-weight: bold; color: #38bdf8;">📊 ToME 종족 베이스 6대 스탯:</span>
        ${statGridHTML}
      </div>

      ${growthMultiplierHTML}
      ${perksHTML}
      ${skillsSectionHTML}
      ${coreFlavorHTML}

      <div style="border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 0.4rem; font-size: 0.72rem; color: #cbd5e1; line-height: 1.35;">
        • 📈 <span style="color: var(--text-main); font-weight: bold;">ToME 성장 잠재력 (Growth):</span> ToME 2.3.5 정통 대수 성장 곡선(Logarithmic Phi Formula)에 따라 레벨 및 코어 한계치(Core Max) 비례 영속 스탯 성장.
      </div>
    </div>
    <div class="detail-actions" style="margin-top: auto; padding-top: 0.6rem; border-top: 1px solid rgba(255,255,255,0.06);">
      <div style="font-size: 0.7rem; color: var(--text-muted); text-align: center; border: 1px solid rgba(255,255,255,0.05); padding: 0.45rem; border-radius: 6px; background: rgba(255,255,255,0.01); line-height: 1.35;">
        ※ 코어는 모방(Mimicry) 능력을 사용해 다른 몬스터들의 신체를 분석·복사함으로써 자유롭게 교체해 나갈 수 있습니다. (코어 교체 시 누적 추가 스탯의 <b>${(legacyRatio * 100).toFixed(1)}%</b> 유산 보존)
      </div>
    </div>
  `;
}
