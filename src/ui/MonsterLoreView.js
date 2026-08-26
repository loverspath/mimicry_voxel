/**
 * @module MonsterLoreView
 * @category ui
 * @description TomeNET 스타일 851종 ToME 몬스터 도감, 검색/필터링, 168종 유니크 처치 체크리스트 및 로어/의태 마스터리 뷰 렌더러
 * @purity DOM Renderer
 * @dependencies TomeMonstersData.js, UniqueMonsterManager.js, Tags.js, Perks.js
 * @exports renderMonsterLoreModalHTML, renderMonsterBestiaryHTML, renderUniqueChecklistHTML, renderMonsterDetailCardHTML, renderLoreMasterySummaryHTML, getUniqueChecklistStats
 */

import { TOME_MONSTERS_DATA } from '../entities/TomeMonstersData.js';
import { uniqueMonsterManager } from '../systems/UniqueMonsterManager.js';
import { WEAPON_MASTERY_CONFIG } from '../entities/MimicBody.js';
import { getSpeciesConfig } from '../entities/MonsterRegistry.js';
import { MONSTER_PERKS } from '../entities/Perks.js';
import { MonsterSpellFactory } from '../systems/MonsterSpellFactory.js';

/**
 * 유니크 몬스터 처치 통계 데이터를 산출합니다.
 * @param {Object} [player=null] - 플레이어 인스턴스
 * @param {Object} [manager=null] - UniqueMonsterManager 인스턴스
 * @returns {{ total: number, killed: number, alive: number, unknown: number, killRate: number }}
 */
export function getUniqueChecklistStats(player = null, manager = null) {
  const umm = manager || uniqueMonsterManager;
  const uniques = umm ? umm.getAllUniqueMonsters() : [];
  const total = uniques.length || 168;
  
  let killed = 0;
  let alive = 0;
  let unknown = 0;

  uniques.forEach(m => {
    const key = m.key;
    const isDead = umm ? (umm.isKilled(key) || (player && player.getKillCount && player.getKillCount(key) > 0)) : false;
    const isSpawned = umm ? umm.isSpawned(key) : false;

    if (isDead) {
      killed++;
    } else if (isSpawned) {
      alive++;
    } else {
      unknown++;
    }
  });

  const killRate = total > 0 ? Math.round((killed / total) * 100) : 0;
  return { total, killed, alive, unknown, killRate };
}

/**
 * 몬스터 속성 저항 및 플래그 칩 HTML을 생성합니다.
 * @param {Array<string>} flags - 몬스터 플래그 배열
 * @returns {string} HTML 문자열
 */
function renderFlagChipsHTML(flags = []) {
  if (!flags || flags.length === 0) return `<span style="color:var(--text-muted); font-size:0.7rem;">기본 상태</span>`;

  const FLAG_STYLE_MAP = {
    UNIQUE: { label: "👑 유니크", color: "#fbbf24", bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.3)" },
    DRAGON: { label: "🐉 용족", color: "#f87171", bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.3)" },
    UNDEAD: { label: "💀 언데드", color: "#a78bfa", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.3)" },
    DEMON:  { label: "😈 악마", color: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)" },
    EVIL:   { label: "👿 사악", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.25)" },
    ANIMAL: { label: "🐾 야수", color: "#34d399", bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.3)" },
    RES_FIRE: { label: "🔥 화염 저항", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)" },
    RES_COLD: { label: "❄️ 냉기 저항", color: "#38bdf8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.25)" },
    RES_ELEC: { label: "⚡ 전기 저항", color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.25)" },
    RES_ACID: { label: "🧪 산성 저항", color: "#a3e635", bg: "rgba(163,230,53,0.12)", border: "rgba(163,230,53,0.25)" },
    RES_POIS: { label: "🟢 맹독 저항", color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
    IM_FIRE:  { label: "🔥 화염 면역", color: "#ef4444", bg: "rgba(239,68,68,0.2)", border: "rgba(239,68,68,0.4)" },
    IM_COLD:  { label: "❄️ 냉기 면역", color: "#0284c7", bg: "rgba(2,132,199,0.2)", border: "rgba(2,132,199,0.4)" },
    IM_ELEC:  { label: "⚡ 전기 면역", color: "#ca8a04", bg: "rgba(202,138,4,0.2)", border: "rgba(202,138,4,0.4)" },
    IM_ACID:  { label: "🧪 산성 면역", color: "#65a30d", bg: "rgba(101,163,13,0.2)", border: "rgba(101,163,13,0.4)" },
    IM_POIS:  { label: "🟢 맹독 면역", color: "#059669", bg: "rgba(5,150,105,0.2)", border: "rgba(5,150,105,0.4)" },
    NO_FEAR:  { label: "🛡️ 공포 면역", color: "#cbd5e1", bg: "rgba(203,213,225,0.1)", border: "rgba(203,213,225,0.2)" },
    NO_SLEEP: { label: "👁️ 수면 면역", color: "#cbd5e1", bg: "rgba(203,213,225,0.1)", border: "rgba(203,213,225,0.2)" },
    INVISIBLE:{ label: "👻 투명 은신", color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
  };

  const chips = [];
  flags.forEach(f => {
    if (FLAG_STYLE_MAP[f]) {
      const s = FLAG_STYLE_MAP[f];
      chips.push(`
        <span style="background: ${s.bg}; color: ${s.color}; border: 1px solid ${s.border}; padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: bold; font-size: 0.65rem; white-space: nowrap;">
          ${s.label}
        </span>
      `);
    }
  });

  if (chips.length === 0) {
    const previewFlags = flags.slice(0, 3).map(f => `<span style="background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.65rem;">${f}</span>`);
    return previewFlags.join(' ');
  }

  return chips.join(' ');
}

/**
 * 개별 몬스터 상세 분석 카드 HTML을 생성합니다.
 * @param {Object} monster - 대상 몬스터 데이터
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderMonsterDetailCardHTML(monster, player = null) {
  if (!monster) {
    return `
      <div style="background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        👈 좌측 목록에서 몬스터를 선택하여 상세 로어와 스펙을 확인하세요.
      </div>
    `;
  }

  const isUnique = monster.flags?.includes('UNIQUE') || monster.isUnique;
  const killCount = player && player.getKillCount ? (player.getKillCount(monster.key) || player.getKillCount(monster.name) || player.getKillCount(monster.type) || 0) : 0;
  const loreXp = player && player.body?.getLoreXp ? player.body.getLoreXp(monster.key || monster.type) : (player && player.body?.loreRegistry ? (player.body.loreRegistry[monster.key] || player.body.loreRegistry[monster.name] || player.body.loreRegistry[monster.type] || 0) : 0);
  const loreLvl = player && player.body?.getLoreLevel ? player.body.getLoreLevel(monster.type || monster.key) : 1;
  const loreMult = player && player.body?.getLoreMultiplier ? player.body.getLoreMultiplier(monster.type || monster.key) : 1.0;

  // 공격 패턴 표 생성
  let attacksHTML = `<span style="color:var(--text-muted); font-size:0.72rem; font-style:italic;">특수 물리 타격 없음</span>`;
  if (monster.attacks && Array.isArray(monster.attacks) && monster.attacks.length > 0) {
    const attackRows = monster.attacks.map(att => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:0.2rem 0.4rem; border-radius:4px; border:1px solid rgba(255,255,255,0.04); font-size:0.72rem;">
        <span style="color:#cbd5e1; font-weight:600;">⚔️ ${att.method || 'HIT'} (${att.effect || 'HURT'})</span>
        <span style="color:#f87171; font-weight:bold; font-family:monospace;">${att.damage || '1d4'}</span>
      </div>
    `).join('');
    attacksHTML = `<div style="display:flex; flex-direction:column; gap:0.25rem;">${attackRows}</div>`;
  }

  // 주문 및 브레스 목록
  let spellsHTML = '';
  if (monster.spells && Array.isArray(monster.spells) && monster.spells.length > 0) {
    const spellBadges = monster.spells.map(s => `<span style="background:rgba(168,85,247,0.12); color:#c084fc; border:1px solid rgba(168,85,247,0.25); padding:0.1rem 0.35rem; border-radius:4px; font-size:0.65rem; font-weight:bold;">🔮 ${s}</span>`).join(' ');
    spellsHTML = `
      <div style="margin-top:0.35rem;">
        <span style="font-size:0.7rem; color:#c084fc; font-weight:bold;">비전 주문 & 마법:</span>
        <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-top:0.15rem;">${spellBadges}</div>
      </div>
    `;
  }

  // 4대 고유 의태 스킬 (Innate Skills) 및 실시간 해금 상태
  const monsterKey = monster.key || monster.type || 'HUMAN';
  const innateSkills = MonsterSpellFactory.createInnateSkills(monsterKey);
  let innateSkillsHTML = '';
  if (innateSkills && innateSkills.length > 0) {
    const skillCards = innateSkills.map(skill => {
      const isUnlocked = skill.isUnlocked ? skill.isUnlocked(loreLvl) : (loreLvl >= (skill.requiredMastery || 1));
      const reqMastery = skill.requiredMastery || 1;
      const effectiveCd = skill.getEffectiveCooldown ? skill.getEffectiveCooldown(loreLvl) : skill.cooldown;
      const badgeColor = isUnlocked ? '#34d399' : '#f87171';
      const badgeText = isUnlocked ? `🟢 해금 (Lv.${reqMastery})` : `🔒 잠김 (요구 Lv.${reqMastery})`;

      return `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid ${isUnlocked ? (skill.color || '#38bdf8') : 'rgba(255,255,255,0.08)'}; border-radius: 5px; padding: 0.35rem 0.5rem; opacity: ${isUnlocked ? '1' : '0.65'}; font-size: 0.72rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem;">
            <span style="font-weight: bold; color: ${skill.color || '#38bdf8'}; display: flex; align-items: center; gap: 0.25rem;">
              <span>${skill.icon || '⚔️'}</span>
              <span>${skill.name}</span>
            </span>
            <span style="font-size: 0.65rem; color: ${badgeColor}; font-weight: bold;">${badgeText}</span>
          </div>
          <div style="color: var(--text-muted); font-size: 0.68rem; line-height: 1.3;">${skill.desc}</div>
          <div style="display: flex; gap: 0.5rem; font-size: 0.65rem; font-family: monospace; color: #94a3b8; margin-top: 0.15rem;">
            <span>쿨다운: <b style="color: #f59e0b;">${effectiveCd}턴</b></span>
            <span>사거리: <b style="color: #34d399;">${skill.maxRange}칸</b></span>
            <span>위력: <b style="color: #cbd5e1;">${skill.dice}</b></span>
          </div>
        </div>
      `;
    }).join('');

    innateSkillsHTML = `
      <div style="margin-top: 0.1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <p style="font-size: 0.74rem; font-weight: bold; color: #38bdf8; margin: 0;">🧬 4대 고유 의태 스킬 (Innate Skills)</p>
          <span style="font-size: 0.68rem; color: #a855f7; font-weight: bold;">로어 숙련도 Lv.${loreLvl}/50 (x${loreMult.toFixed(2)})</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
          ${skillCards}
        </div>
      </div>
    `;
  }

  const flagsChipsHTML = renderFlagChipsHTML(monster.flags || []);

  const uniqueBadge = isUnique
    ? `<span style="background: rgba(251,191,36,0.18); color: #fbbf24; border: 1px solid rgba(251,191,36,0.4); padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; font-size: 0.68rem;">👑 고유 유니크 (Unique)</span>`
    : `<span style="background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.3); padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; font-size: 0.68rem;">일반 몬스터 (Common)</span>`;

  return `
    <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <div style="width: 38px; height: 38px; border-radius: 6px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: center; align-items: center; font-size: 1.4rem; font-weight: bold; color: ${monster.baseColor || '#fff'}; font-family: monospace;">
            ${monster.char || 'm'}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <h4 style="margin: 0; color: ${monster.baseColor || '#fff'}; font-size: 1rem; font-weight: 700;">${monster.name}</h4>
              <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">#${monster.tomeId || 0}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; margin-top: 0.2rem;">
              ${uniqueBadge}
              <span style="font-size: 0.7rem; color: #38bdf8; font-weight: bold;">Lv.${monster.level || 1}</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 0.78rem; font-weight: bold; color: ${killCount > 0 ? '#34d399' : '#94a3b8'};">
            💀 킬 카운트: <b>${killCount}</b>회
          </div>
          <div style="font-size: 0.68rem; color: #a855f7;">
            🧬 로어 숙련도: <b>Lv.${loreLvl}</b> (${loreXp} XP)
          </div>
        </div>
      </div>

      <!-- 기본 스펙 그리드 -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 0.4rem 0.6rem; font-size: 0.75rem;">
        <div><span style="color: #94a3b8;">체력 (HP):</span> <b style="color: #ef4444;">${monster.coreBaseHp || 10}</b></div>
        <div><span style="color: #94a3b8;">방어력 (AC):</span> <b style="color: #38bdf8;">+${monster.baseAC || 8}</b></div>
        <div><span style="color: #94a3b8;">속도 (SPD):</span> <b style="color: #34d399;">${Number(monster.speed || 5.0).toFixed(1)}</b></div>
        <div><span style="color: #94a3b8;">기본 힘:</span> <b style="color: #f87171;">${monster.coreBase?.str || 10}</b></div>
        <div><span style="color: #94a3b8;">기본 민첩:</span> <b style="color: #7dd3fc;">${monster.coreBase?.dex || 10}</b></div>
        <div><span style="color: #94a3b8;">기본 지능:</span> <b style="color: #c084fc;">${monster.coreBase?.int || 10}</b></div>
      </div>

      <!-- 공격 패턴 -->
      <div>
        <p style="font-size: 0.74rem; font-weight: bold; color: #fbbf24; margin: 0 0 0.25rem 0;">⚔️ 물리 타격 및 피해 패턴</p>
        ${attacksHTML}
      </div>

      <!-- 속성 저항 및 플래그 -->
      <div>
        <p style="font-size: 0.74rem; font-weight: bold; color: #38bdf8; margin: 0 0 0.25rem 0;">🛡️ 속성 저항 및 특수 플래그</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
          ${flagsChipsHTML}
        </div>
        ${spellsHTML}
      </div>

      <!-- 4대 고유 의태 스킬 -->
      ${innateSkillsHTML}

      <!-- 플레이버 텍스트 / 서사 -->
      <div style="background: rgba(30, 41, 59, 0.45); border-left: 3px solid #fbbf24; border-radius: 4px; padding: 0.45rem 0.65rem; margin-top: 0.1rem;">
        <p style="font-size: 0.65rem; color: #fbbf24; font-weight: 700; text-transform: uppercase; margin: 0 0 0.15rem 0;">📜 ToME 몬스터 전승 서사 (Lore)</p>
        <p style="font-style: italic; font-size: 0.74rem; line-height: 1.4; color: #e2e8f0; margin: 0;">“${monster.flavorText || monster.description || '어두운 던전 심연에 서식하는 전설의 생명체입니다.'}”</p>
      </div>
    </div>
  `;
}

/**
 * 851종 몬스터 도감 (Bestiary) 탭 본문 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @param {Object} [options={}] - 검색 및 필터 옵션
 * @returns {string} HTML 문자열
 */
export function renderMonsterBestiaryHTML(player = null, options = {}) {
  const searchQuery = (options.searchQuery || '').trim().toLowerCase();
  const filterType = options.filterType || 'ALL'; // 'ALL', 'UNIQUE', 'COMMON', 'KILLED', 'LORE'
  const selectedKey = options.selectedKey || 'MON_FILTHY_STREET_URCHIN';

  const allMonsters = Object.values(TOME_MONSTERS_DATA || {});
  
  // 필터링 적용
  const filtered = allMonsters.filter(m => {
    if (!m) return false;
    const isUnique = m.flags?.includes('UNIQUE') || m.isUnique;
    const killCount = player && player.getKillCount ? (player.getKillCount(m.key) || player.getKillCount(m.name) || 0) : 0;
    const hasLore = player && player.body?.loreRegistry ? (player.body.loreRegistry[m.key] || player.body.loreRegistry[m.name] || player.body.loreRegistry[m.type] || 0) > 0 : false;

    if (filterType === 'UNIQUE' && !isUnique) return false;
    if (filterType === 'COMMON' && isUnique) return false;
    if (filterType === 'KILLED' && killCount <= 0) return false;
    if (filterType === 'LORE' && !hasLore) return false;

    if (searchQuery) {
      const matchName = (m.name || '').toLowerCase().includes(searchQuery);
      const matchChar = (m.char || '').toLowerCase() === searchQuery;
      const matchKey = (m.key || '').toLowerCase().includes(searchQuery);
      const matchFlavor = (m.flavorText || '').toLowerCase().includes(searchQuery);
      if (!matchName && !matchChar && !matchKey && !matchFlavor) return false;
    }
    return true;
  });

  // 레벨 순 정렬
  filtered.sort((a, b) => (a.level || 1) - (b.level || 1));

  // 현재 선택된 몬스터 객체 결정
  const selectedMonster = filtered.find(m => m.key === selectedKey) || filtered[0] || allMonsters[0];

  // 몬스터 목록 행 생성 (최대 150개 렌더링)
  const displayList = filtered.slice(0, 150);
  const rowsHTML = displayList.map(m => {
    const isSelected = selectedMonster && selectedMonster.key === m.key;
    const isUnique = m.flags?.includes('UNIQUE') || m.isUnique;
    const killCount = player && player.getKillCount ? (player.getKillCount(m.key) || player.getKillCount(m.name) || 0) : 0;
    
    return `
      <div class="lore-monster-item" data-key="${m.key}" onclick="window.__selectMonsterLore && window.__selectMonsterLore('${m.key}')" style="
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.35rem 0.5rem; border-radius: 6px; cursor: pointer;
        background: ${isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)'};
        border: 1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.05)'};
        transition: all 0.15s ease;
      ">
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="font-family: monospace; font-size: 0.95rem; font-weight: bold; color: ${m.baseColor || '#fff'}; width: 14px; text-align: center;">${m.char || 'm'}</span>
          <span style="font-size: 0.74rem; font-weight: 600; color: ${isSelected ? '#38bdf8' : 'var(--text-main)'};">${m.name}</span>
          ${isUnique ? `<span style="font-size: 0.6rem; color: #fbbf24;">👑</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.3rem;">
          <span style="font-size: 0.68rem; color: #94a3b8; font-family: monospace;">Lv.${m.level || 1}</span>
          ${killCount > 0 ? `<span style="font-size: 0.65rem; background: rgba(16,185,129,0.15); color: #34d399; padding: 0.05rem 0.25rem; border-radius: 3px; font-weight: bold;">💀${killCount}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; height: 100%;">
      <!-- 검색 및 필터 툴바 -->
      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; background: rgba(0,0,0,0.2); padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
        <input 
          id="monster-lore-search-input" 
          type="text" 
          placeholder="🔍 851종 몬스터 검색 (이름, 심볼, 속성)..." 
          value="${searchQuery}" 
          oninput="window.__onMonsterLoreSearch && window.__onMonsterLoreSearch(this.value)"
          style="flex: 1; min-width: 160px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.75rem;"
        />
        
        <div style="display: flex; gap: 0.2rem; flex-wrap: wrap;">
          <button onclick="window.__setMonsterLoreFilter && window.__setMonsterLoreFilter('ALL')" style="padding: 0.25rem 0.45rem; border-radius: 4px; font-size: 0.68rem; font-weight: bold; cursor: pointer; border: 1px solid ${filterType === 'ALL' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background: ${filterType === 'ALL' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${filterType === 'ALL' ? '#38bdf8' : 'var(--text-muted)'};">전체 (${allMonsters.length})</button>
          <button onclick="window.__setMonsterLoreFilter && window.__setMonsterLoreFilter('UNIQUE')" style="padding: 0.25rem 0.45rem; border-radius: 4px; font-size: 0.68rem; font-weight: bold; cursor: pointer; border: 1px solid ${filterType === 'UNIQUE' ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; background: ${filterType === 'UNIQUE' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${filterType === 'UNIQUE' ? '#fbbf24' : 'var(--text-muted)'};">👑 유니크</button>
          <button onclick="window.__setMonsterLoreFilter && window.__setMonsterLoreFilter('KILLED')" style="padding: 0.25rem 0.45rem; border-radius: 4px; font-size: 0.68rem; font-weight: bold; cursor: pointer; border: 1px solid ${filterType === 'KILLED' ? '#10b981' : 'rgba(255,255,255,0.1)'}; background: ${filterType === 'KILLED' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${filterType === 'KILLED' ? '#34d399' : 'var(--text-muted)'};">💀 처치한 적</button>
        </div>
      </div>

      <!-- 2단 목록/상세 그리드 -->
      <div style="display: grid; grid-template-columns: 240px 1fr; gap: 0.6rem; min-height: 280px;">
        <!-- 좌측 스크롤 목록 -->
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.4rem; overflow-y: auto; max-height: 340px; display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="font-size: 0.68rem; color: var(--text-muted); padding: 0.1rem 0.2rem; display: flex; justify-content: space-between;">
            <span>검색 결과: <b>${filtered.length}</b>종</span>
            <span>(스크롤하여 확인)</span>
          </div>
          ${rowsHTML || `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.75rem;">일치하는 몬스터가 없습니다.</div>`}
        </div>

        <!-- 우측 상세 정보 카드 -->
        <div style="overflow-y: auto; max-height: 340px;">
          ${renderMonsterDetailCardHTML(selectedMonster, player)}
        </div>
      </div>
    </div>
  `;
}

/**
 * ToME 168종 유니크 몬스터 처치 체크리스트 탭 본문 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @param {Object} [options={}] - 필터 옵션
 * @returns {string} HTML 문자열
 */
export function renderUniqueChecklistHTML(player = null, options = {}) {
  const filter = options.uniqueFilter || 'ALL'; // 'ALL', 'KILLED', 'ALIVE', 'UNKNOWN'
  const umm = uniqueMonsterManager;
  const uniques = umm ? umm.getAllUniqueMonsters() : [];
  const stats = getUniqueChecklistStats(player, umm);

  const filteredUniques = uniques.filter(m => {
    const key = m.key;
    const isDead = umm ? (umm.isKilled(key) || (player && player.getKillCount && player.getKillCount(key) > 0)) : false;
    const isSpawned = umm ? umm.isSpawned(key) : false;

    if (filter === 'KILLED' && !isDead) return false;
    if (filter === 'ALIVE' && (!isSpawned || isDead)) return false;
    if (filter === 'UNKNOWN' && isSpawned) return false;
    return true;
  });

  const checklistRows = filteredUniques.map(m => {
    const key = m.key;
    const isDead = umm ? (umm.isKilled(key) || (player && player.getKillCount && player.getKillCount(key) > 0)) : false;
    const isSpawned = umm ? umm.isSpawned(key) : false;
    const isAlive = isSpawned && !isDead;

    let statusBadge = `<span style="background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.3); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">❓ 미조우</span>`;
    let rowBg = 'rgba(255,255,255,0.015)';
    let rowBorder = 'rgba(255,255,255,0.03)';

    if (isDead) {
      statusBadge = `<span style="background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.4); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">💀 처치 완료</span>`;
      rowBg = 'rgba(16,185,129,0.04)';
      rowBorder = 'rgba(16,185,129,0.12)';
    } else if (isAlive) {
      statusBadge = `<span style="background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.4); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">⚠️ 던전 생존 중</span>`;
      rowBg = 'rgba(239,68,68,0.04)';
      rowBorder = 'rgba(239,68,68,0.15)';
    }

    return `
      <tr style="background: ${rowBg}; border-bottom: 1px solid ${rowBorder}; transition: background 0.1s;">
        <td style="padding: 0.35rem 0.5rem; text-align: center;">
          <span style="font-family: monospace; font-size: 1rem; font-weight: bold; color: ${m.baseColor || '#fbbf24'};">${m.char || 'p'}</span>
        </td>
        <td style="padding: 0.35rem 0.5rem; color: var(--text-main); font-weight: 700; font-size: 0.76rem;">
          ${m.name}
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal; font-style: italic;">“${(m.flavorText || '').slice(0, 38)}...”</div>
        </td>
        <td style="padding: 0.35rem 0.5rem; text-align: center; color: #38bdf8; font-weight: bold; font-family: monospace; font-size: 0.72rem;">
          Lv.${m.level || 1}
        </td>
        <td style="padding: 0.35rem 0.5rem; text-align: center; color: #f87171; font-weight: bold; font-family: monospace; font-size: 0.72rem;">
          ${m.coreBaseHp || 50} HP / +${m.baseAC || 15} AC
        </td>
        <td style="padding: 0.35rem 0.5rem; text-align: center;">
          ${statusBadge}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 0.6rem;">
      <!-- 처치 완료율 종합 대시보드 바 -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.4rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.78rem; font-weight: bold; color: #fbbf24;">👑 발리노르 전설 유니크 몬스터 토벌 진척도</span>
          <span style="font-size: 0.85rem; font-weight: 800; color: #34d399; font-family: monospace;">${stats.killed} / ${stats.total} (${stats.killRate}%)</span>
        </div>
        <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
          <div style="width: ${stats.killRate}%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399, #38bdf8); border-radius: 4px; transition: width 0.3s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.1rem;">
          <span>💀 처치 완료: <b style="color: #34d399;">${stats.killed}</b>체</span>
          <span>⚠️ 던전 생존: <b style="color: #f87171;">${stats.alive}</b>체</span>
          <span>❓ 미조우 대기: <b style="color: #94a3b8;">${stats.unknown}</b>체</span>
        </div>
      </div>

      <!-- 상태 필터 버튼 -->
      <div style="display: flex; gap: 0.3rem;">
        <button onclick="window.__setUniqueChecklistFilter && window.__setUniqueChecklistFilter('ALL')" style="padding: 0.25rem 0.5rem; border-radius: 5px; font-size: 0.7rem; font-weight: bold; cursor: pointer; border: 1px solid ${filter === 'ALL' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background: ${filter === 'ALL' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.03)'}; color: ${filter === 'ALL' ? '#38bdf8' : 'var(--text-muted)'};">전체 (${stats.total})</button>
        <button onclick="window.__setUniqueChecklistFilter && window.__setUniqueChecklistFilter('KILLED')" style="padding: 0.25rem 0.5rem; border-radius: 5px; font-size: 0.7rem; font-weight: bold; cursor: pointer; border: 1px solid ${filter === 'KILLED' ? '#10b981' : 'rgba(255,255,255,0.1)'}; background: ${filter === 'KILLED' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)'}; color: ${filter === 'KILLED' ? '#34d399' : 'var(--text-muted)'};">💀 처치 완료 (${stats.killed})</button>
        <button onclick="window.__setUniqueChecklistFilter && window.__setUniqueChecklistFilter('ALIVE')" style="padding: 0.25rem 0.5rem; border-radius: 5px; font-size: 0.7rem; font-weight: bold; cursor: pointer; border: 1px solid ${filter === 'ALIVE' ? '#f87171' : 'rgba(255,255,255,0.1)'}; background: ${filter === 'ALIVE' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)'}; color: ${filter === 'ALIVE' ? '#f87171' : 'var(--text-muted)'};">⚠️ 생존 중 (${stats.alive})</button>
        <button onclick="window.__setUniqueChecklistFilter && window.__setUniqueChecklistFilter('UNKNOWN')" style="padding: 0.25rem 0.5rem; border-radius: 5px; font-size: 0.7rem; font-weight: bold; cursor: pointer; border: 1px solid ${filter === 'UNKNOWN' ? '#94a3b8' : 'rgba(255,255,255,0.1)'}; background: ${filter === 'UNKNOWN' ? 'rgba(148,163,184,0.2)' : 'rgba(255,255,255,0.03)'}; color: ${filter === 'UNKNOWN' ? '#cbd5e1' : 'var(--text-muted)'};">❓ 미조우 (${stats.unknown})</button>
      </div>

      <!-- 체크리스트 테이블 -->
      <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow-y: auto; max-height: 290px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.72rem;">
          <thead style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; backdrop-filter: blur(8px);">
            <tr>
              <th style="padding: 0.35rem 0.5rem; text-align: center; color: var(--text-muted); width: 32px;">심볼</th>
              <th style="padding: 0.35rem 0.5rem; color: var(--text-muted);">유니크 명칭 및 전승</th>
              <th style="padding: 0.35rem 0.5rem; text-align: center; color: var(--text-muted); width: 60px;">레벨</th>
              <th style="padding: 0.35rem 0.5rem; text-align: center; color: var(--text-muted); width: 120px;">생명력 / 방어</th>
              <th style="padding: 0.35rem 0.5rem; text-align: center; color: var(--text-muted); width: 90px;">토벌 상태</th>
            </tr>
          </thead>
          <tbody>
            ${checklistRows || `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">해당 조건의 유니크 몬스터가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 몬스터 로어 및 무기 숙련도 요약 탭 본문 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderLoreMasterySummaryHTML(player) {
  if (!player || !player.body) return `<div style="color:var(--text-muted);">숙련도 데이터를 불러올 수 없습니다.</div>`;

  const MASTERY_CATEGORIES = ["UNARMED", "SWORD", "BLUNT", "POLEARM", "ARCHERY"];
  const masteryTableRows = MASTERY_CATEGORIES.map(cat => {
    const config = WEAPON_MASTERY_CONFIG.categories[cat] || { name: cat, desc: cat };
    const registry = player.body.weaponMastery || {};
    const count = registry[cat]?.count || 0;
    const lvl = player.body.getWeaponMasteryLevel(cat);
    const nextReq = player.body.getWeaponMasteryNextReq(cat);
    
    const accBonus = lvl - 1;
    const dmgMult = 1.0 + (lvl - 1) * 0.05;
    
    const lvlConfig = WEAPON_MASTERY_CONFIG.levels.find(l => l.lvl === lvl) || { extraAttacks: 0 };
    const extraAttacks = lvlConfig.extraAttacks || 0;
    const extraAttackText = extraAttacks > 0 ? ` / +${extraAttacks}타` : "";
    
    let levelBadgeColor = "rgba(255,255,255,0.05)";
    let levelBadgeText = "#94a3b8";
    if (lvl === 5) { levelBadgeColor = "rgba(239,68,68,0.15)"; levelBadgeText = "#f87171"; }
    else if (lvl === 4) { levelBadgeColor = "rgba(251,191,36,0.15)"; levelBadgeText = "#fbbf24"; }
    else if (lvl === 3) { levelBadgeColor = "rgba(59,130,246,0.15)"; levelBadgeText = "#60a5fa"; }
    else if (lvl === 2) { levelBadgeColor = "rgba(16,185,129,0.15)"; levelBadgeText = "#34d399"; }
    
    const progressText = nextReq !== null ? `${count} / ${nextReq} 타` : `${count} 타 (최대)`;
    
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 0.3rem 0.4rem; color: var(--text-main); font-weight: bold; font-size: 0.74rem;">⚔️ ${config.name}</td>
        <td style="padding: 0.3rem 0.4rem; text-align: center;">
          <span style="background: ${levelBadgeColor}; color: ${levelBadgeText}; font-weight: bold; font-size: 0.68rem; padding: 0.05rem 0.25rem; border-radius: 4px; border: 1px solid ${levelBadgeText}33;">Lv.${lvl}</span>
        </td>
        <td style="padding: 0.3rem 0.4rem; text-align: center; color: #fbbf24; font-size: 0.68rem; font-weight: bold;">
          +${accBonus} 명중 / x${dmgMult.toFixed(2)} 피해${extraAttackText}
        </td>
        <td style="padding: 0.3rem 0.4rem; text-align: right; color: var(--text-muted); font-size: 0.68rem; font-family: monospace;">${progressText}</td>
      </tr>
    `;
  }).join('');

  const reqResult = player.getWeaponRequirement ? player.getWeaponRequirement() : { isMet: true, weight: 1.0, currentStr: 10, reqStr: 5, currentDex: 10, reqDex: 5 };
  const activeWeapon = player.equipment?.weapon;
  const activeWeaponName = activeWeapon ? activeWeapon.name : "맨손 주먹";

  // 동적 로어 및 킬 레지스트리 합집합 순회
  const loreKeysSet = new Set([
    ...Object.keys(player.body.loreRegistry || {}),
    ...Object.keys(player.body.killRegistry || {}),
    ...Object.keys(player.killRegistry || {})
  ]);

  const loreRows = [];
  const processedSpecies = new Set();

  loreKeysSet.forEach(sp => {
    if (!sp || processedSpecies.has(sp)) return;
    processedSpecies.add(sp);

    const xp = (player.body.loreRegistry && player.body.loreRegistry[sp]) || 0;
    const kills = (player.getKillCount ? player.getKillCount(sp) : 0) || (player.body.getKillCount ? player.body.getKillCount(sp) : 0);
    if (xp === 0 && kills === 0) return;

    const config = getSpeciesConfig(sp);
    const displayName = (config && (config.displayName || config.name)) || sp;
    const lvl = player.body.getLoreLevel ? player.body.getLoreLevel(sp) : 1;
    const mult = player.body.getLoreMultiplier ? player.body.getLoreMultiplier(sp) : 1.0;

    loreRows.push({
      key: sp,
      name: displayName,
      lvl,
      mult,
      xp,
      kills
    });
  });

  // 누적 경험치 내림차순, 킬수 내림차순 정렬
  loreRows.sort((a, b) => b.xp - a.xp || b.kills - a.kills || a.name.localeCompare(b.name));

  const renderedLoreRows = loreRows.map(entry => {
    let levelBadgeColor = "rgba(56,189,248,0.15)";
    let levelBadgeText = "#38bdf8";
    if (entry.lvl >= 50) { levelBadgeColor = "rgba(239,68,68,0.18)"; levelBadgeText = "#f87171"; }
    else if (entry.lvl >= 25) { levelBadgeColor = "rgba(251,191,36,0.18)"; levelBadgeText = "#fbbf24"; }
    else if (entry.lvl >= 10) { levelBadgeColor = "rgba(168,85,247,0.18)"; levelBadgeText = "#c084fc"; }

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 0.3rem 0.4rem; color: var(--text-main); font-weight: bold; font-size: 0.74rem;">${entry.name}</td>
        <td style="padding: 0.3rem 0.4rem; text-align: center;">
          <span style="background: ${levelBadgeColor}; color: ${levelBadgeText}; font-weight: bold; font-size: 0.68rem; padding: 0.05rem 0.25rem; border-radius: 4px; border: 1px solid ${levelBadgeText}33;">Lv.${entry.lvl}</span>
        </td>
        <td style="padding: 0.3rem 0.4rem; text-align: center; color: #a855f7; font-size: 0.68rem; font-weight: bold;">x${entry.mult.toFixed(2)}</td>
        <td style="padding: 0.3rem 0.4rem; text-align: right; color: var(--text-muted); font-size: 0.68rem; font-family: monospace;">${entry.xp.toLocaleString()} XP (${entry.kills}킬)</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 0.6rem;">
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.6rem 0.75rem;">
        <p style="font-weight: bold; color: #fbbf24; font-size: 0.78rem; margin: 0 0 0.35rem 0;">⚔️ 무기 마스터리 숙련도 현황</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
              <th style="padding: 0.25rem 0.4rem; color: var(--text-muted);">계열명</th>
              <th style="padding: 0.25rem 0.4rem; text-align: center; color: var(--text-muted);">레벨</th>
              <th style="padding: 0.25rem 0.4rem; text-align: center; color: var(--text-muted);">보정/추가타</th>
              <th style="padding: 0.25rem 0.4rem; text-align: right; color: var(--text-muted);">다음 등급</th>
            </tr>
          </thead>
          <tbody>${masteryTableRows}</tbody>
        </table>
        
        <div style="margin-top: 0.4rem; font-size: 0.68rem; color: var(--text-muted);">
          🛡️ 현재 무기: <b>${activeWeaponName}</b> (${reqResult.weight ? reqResult.weight.toFixed(1) : '1.0'} kg) — <span style="color:${reqResult.isMet ? '#34d399' : '#f87171'}; font-weight:bold;">${reqResult.isMet ? '🟢 제어 성공 (추가타 +1회 활성)' : '🔴 신체 요구치 부족'}</span>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.6rem 0.75rem;">
        <p style="font-weight: bold; color: #34d399; font-size: 0.78rem; margin: 0 0 0.35rem 0;">🧬 몬스터 로어 숙련도 현황 (Lore Mastery Lv.1~50)</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
              <th style="padding: 0.25rem 0.4rem; color: var(--text-muted);">종족/몬스터</th>
              <th style="padding: 0.25rem 0.4rem; text-align: center; color: var(--text-muted);">로어 레벨</th>
              <th style="padding: 0.25rem 0.4rem; text-align: center; color: var(--text-muted);">의태 증폭</th>
              <th style="padding: 0.25rem 0.4rem; text-align: right; color: var(--text-muted);">누적 로어</th>
            </tr>
          </thead>
          <tbody>
            ${renderedLoreRows.length > 0 ? renderedLoreRows : `<tr><td colspan="4" style="text-align:center; padding:0.8rem; color:var(--text-muted); font-style:italic;">처치/의태를 통해 획득한 몬스터 로어가 아직 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 몬스터 로어 및 유니크 처치 통합 모달 바디 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @param {string} [activeTab='lore'] - 활성화할 탭 ('lore', 'unique', 'mastery')
 * @param {Object} [options={}] - 탭별 세부 옵션
 * @returns {string} HTML 문자열
 */
export function renderMonsterLoreModalHTML(player, activeTab = 'lore', options = {}) {
  const stats = getUniqueChecklistStats(player);

  let tabContentHTML = '';
  if (activeTab === 'unique') {
    tabContentHTML = renderUniqueChecklistHTML(player, options);
  } else if (activeTab === 'mastery') {
    tabContentHTML = renderLoreMasterySummaryHTML(player);
  } else {
    tabContentHTML = renderMonsterBestiaryHTML(player, options);
  }

  const loreActive = activeTab === 'lore';
  const uniqueActive = activeTab === 'unique';
  const masteryActive = activeTab === 'mastery';

  return `
    <div class="detail-header" style="text-align: left; display: flex; flex-direction: column; gap: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.6rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="detail-type" style="font-size: 0.7rem; color: #34d399; text-transform: uppercase; font-weight: bold;">[🧬 몬스터 로어 숙련도 & ToME 도감 (Lore Mastery Lv.1~50)]</span>
        <span style="font-size: 0.72rem; color: #fbbf24; font-weight: bold; font-family: monospace;">👑 토벌 진척: ${stats.killed}/168 (${stats.killRate}%)</span>
      </div>
      
      <!-- 상단 네비게이션 탭 -->
      <div style="display: flex; gap: 0.35rem; margin-top: 0.1rem;">
        <button id="tab-btn-lore" onclick="window.__switchLoreTab && window.__switchLoreTab('lore')" style="
          flex: 1; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;
          border: 1px solid ${loreActive ? '#34d399' : 'rgba(255,255,255,0.1)'};
          background: ${loreActive ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.03)'};
          color: ${loreActive ? '#34d399' : 'var(--text-muted)'};
          transition: all 0.15s ease;
        ">
          📚 851종 몬스터 도감
        </button>

        <button id="tab-btn-unique" onclick="window.__switchLoreTab && window.__switchLoreTab('unique')" style="
          flex: 1; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;
          border: 1px solid ${uniqueActive ? '#fbbf24' : 'rgba(255,255,255,0.1)'};
          background: ${uniqueActive ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)'};
          color: ${uniqueActive ? '#fbbf24' : 'var(--text-muted)'};
          transition: all 0.15s ease;
        ">
          👑 168종 유니크 체크리스트
        </button>

        <button id="tab-btn-mastery" onclick="window.__switchLoreTab && window.__switchLoreTab('mastery')" style="
          flex: 1; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;
          border: 1px solid ${masteryActive ? '#38bdf8' : 'rgba(255,255,255,0.1)'};
          background: ${masteryActive ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)'};
          color: ${masteryActive ? '#38bdf8' : 'var(--text-muted)'};
          transition: all 0.15s ease;
        ">
          🧬 로어 숙련도 & 무기 마스터리
        </button>
      </div>
    </div>

    <!-- 탭 본문 컨테이너 -->
    <div class="detail-desc" style="margin-top: 0.6rem; font-size: 0.82rem; color: var(--text-muted); text-align: left; overflow-y: auto; max-height: 380px; padding-right: 4px;">
      ${tabContentHTML}
    </div>
  `;
}
