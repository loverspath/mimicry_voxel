/**
 * @module HUDView
 * @category ui
 * @description 상단 상태바(SPD, HP, Floor), 플레이어 상세 스테이터스창, 스킬 수련 트리, 무기/로어 마스터리 도감 뷰
 * @purity DOM Renderer
 * @dependencies Tags.js, MonsterRegistry.js, Perks.js, Skills.js, MimicBody.js, EventBus.js, GameEvents.js, MonsterLoreView.js
 * @exports renderPlayerStatusPanelHTML, renderPlayerDetailsHTML, renderSkillTreeHTML, renderMasteryDetailsHTML, updateTopBarHUD, formatCombatLogHTML, updateFloatingAutoFireButton
 */

import { PREFIX_TAGS, SUFFIX_TAGS, SYNERGY_TAG_REGISTRY } from '../entities/Tags.js';
import { getSpeciesConfig } from '../entities/MonsterRegistry.js';
import { MONSTER_PERKS } from '../entities/Perks.js';
import { ACTIVE_SKILL_CONFIGS } from '../core/Skills.js';
import { WEAPON_MASTERY_CONFIG } from '../entities/MimicBody.js';
import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';
import { renderMonsterLoreModalHTML } from './MonsterLoreView.js';

/**
 * 인벤토리 내 플레이어 요약 상태 패널 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderPlayerStatusPanelHTML(player) {
  const totalAC = player.getTotalAC ? player.getTotalAC() : 10;
  const bHitScore = player.getBaseToHitScore ? player.getBaseToHitScore() : 50;
  const hitChancePct = Math.round((player.getBaseHitChance ? player.getBaseHitChance(10) : 0.83) * 100);

  return `
    <div class="char-sheet" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem; margin-bottom: 0.8rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.82rem; text-align: left;">
      <div id="active-core-btn" style="grid-column: span 2; font-weight: bold; color: #10b981; border: 1px solid rgba(16,185,129,0.25); background: rgba(16,185,129,0.08); border-radius: 6px; padding: 0.3rem 0.5rem; margin-bottom: 0.2rem; cursor: pointer; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.25rem; transition: background 0.15s ease; user-select: none;">
        🧬 장착 코어: ${player.mimicCore.name} 🔍
      </div>
      <div id="char-info-btn" style="grid-column: span 2; font-weight: bold; color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); background: rgba(56,189,248,0.08); border-radius: 6px; padding: 0.3rem 0.5rem; margin-bottom: 0.2rem; cursor: pointer; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.25rem; transition: background 0.15s ease; user-select: none;">
        👤 주인공 상세 정보 & 스킬 🔍
      </div>
      <div id="skill-tree-btn" style="grid-column: span 2; font-weight: bold; color: #fbbf24; border: 1px solid rgba(251,191,36,0.25); background: rgba(251,191,36,0.08); border-radius: 6px; padding: 0.3rem 0.5rem; margin-bottom: 0.2rem; cursor: pointer; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.25rem; transition: background 0.15s ease; user-select: none;">
        ⚡ 의태 고유 스킬 & 숙련도 🔍
      </div>
      <div id="mastery-info-btn" style="grid-column: span 2; font-weight: bold; color: #34d399; border: 1px solid rgba(52,211,153,0.25); background: rgba(52,211,153,0.08); border-radius: 6px; padding: 0.3rem 0.5rem; margin-bottom: 0.4rem; cursor: pointer; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.25rem; transition: background 0.15s ease; user-select: none;">
        📚 마스터리 및 로어 도감 🔍
      </div>
      <div><b>레벨:</b> ${player.level}</div>
      <div><b>행동 에너지:</b> ${Math.floor(player.energy)}/100</div>
      <div><b>경험치:</b> ${player.xp}/${player.xpNeeded}</div>
      <div><b>체력 (HP):</b> <span style="color:#ef4444; font-weight:bold;">${player.stats.hp}/${player.stats.maxHp}</span>${player.manaShield && player.manaShield > 0 ? ` <span style="color:#60a5fa; font-weight:bold;">(+${player.manaShield})</span>` : ''}</div>
      <div style="grid-column: span 2; display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.1rem; margin-bottom: 0.2rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: bold;">
          <span style="color: #ef4444;">❤️ HP: ${player.stats.hp} / ${player.stats.maxHp}</span>
          <span style="color: #34d399;">🛡️ 의태 생존율: ${Math.round((player.stats.hp / Math.max(1, player.stats.maxHp)) * 100)}%</span>
        </div>
        <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
          <div style="width: ${Math.max(0, Math.min(100, (player.stats.hp / player.stats.maxHp) * 100))}%; height: 100%; background: linear-gradient(90deg, #ef4444, #f87171); border-radius: 3px;"></div>
        </div>
      </div>
      <div><b>총합 방어 (AC):</b> <span style="color:#38bdf8; font-weight:bold;">+${totalAC}</span></div>
      <div><b>기본 명중 (BTH):</b> <span style="color:#fbbf24; font-weight:bold;">${bHitScore} (${hitChancePct}%)</span></div>
      <div><b>힘 (STR):</b> ${player.getEffectiveStat(`str`)} (+${player.strMod})</div>
      <div><b>지능 (INT):</b> ${player.getEffectiveStat(`int`)} (+${player.intMod})</div>
      <div><b>지혜 (WIS):</b> ${player.getEffectiveStat(`wis`)} (+${player.wisMod})</div>
      <div><b>민첩 (DEX):</b> ${player.getEffectiveStat(`dex`)} (+${player.dexMod})</div>
      <div><b>생명력 (CON):</b> ${player.getEffectiveStat(`con`)} (+${player.conMod})</div>
      <div><b>매력 (CHR):</b> ${player.getEffectiveStat(`chr`)} (+${player.chrMod})</div>
      <div style="grid-column: span 2; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); margin-top: 0.1rem;">
        <span style="font-size: 0.72rem; font-weight: bold; color: #38bdf8;">
          🏹 원거리 사격: 무한 탄약 (쿨타임 기반)
        </span>
        <button id="hud-autofire-btn" onclick="window.game && window.game.toggleAutoFire && window.game.toggleAutoFire()" style="
          cursor: pointer; font-size: 0.7rem; font-weight: 700; border-radius: 4px; padding: 0.15rem 0.45rem;
          background: ${player.autoFireEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.15)'};
          border: 1px solid ${player.autoFireEnabled ? '#22c55e' : '#64748b'};
          color: ${player.autoFireEnabled ? '#4ade80' : '#94a3b8'};
        ">
          🏹 자동사격: ${player.autoFireEnabled ? 'ON' : 'OFF'} [T]
        </button>
      </div>
      <div style="grid-column: span 2; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem; margin-top: 0.2rem; display: flex; flex-direction: column; gap: 0.25rem;">
        <div><b>근접 무기:</b> ${player.equipment.weapon ? `<span style="color:${player.equipment.weapon.color}">${player.equipment.weapon.name}</span>` : `맨손`}</div>
        <div><b>방패 (SHIELD):</b> ${player.equipment.shield ? `<span style="color:${player.equipment.shield.color}">${player.equipment.shield.name}</span>` : `없음`}</div>
        <div><b>원거리 활:</b> ${player.equipment.bow ? `<span style="color:${player.equipment.bow.color}">${player.equipment.bow.name}</span>` : `없음`}</div>
        <div><b>장착 갑옷:</b> ${player.equipment.armor ? `<span style="color:${player.equipment.armor.color}">${player.equipment.armor.name}</span>` : `맨몸`}</div>
        <div><b>장착 투구:</b> ${player.equipment.helmet ? `<span style="color:${player.equipment.helmet.color}">${player.equipment.helmet.name}</span>` : `없음`}</div>
        <div><b>장착 장갑:</b> ${player.equipment.gloves ? `<span style="color:${player.equipment.gloves.color}">${player.equipment.gloves.name}</span>` : `없음`}</div>
        <div><b>장착 부츠:</b> ${player.equipment.boots ? `<span style="color:${player.equipment.boots.color}">${player.equipment.boots.name}</span>` : `없음`}</div>
        <div><b>장착 망토:</b> ${player.equipment.cloak ? `<span style="color:${player.equipment.cloak.color}">${player.equipment.cloak.name}</span>` : `없음`}</div>
        <div><b>장착 반지1:</b> ${player.equipment.ring1 ? `<span style="color:${player.equipment.ring1.color}">${player.equipment.ring1.name}</span>` : `없음`}</div>
        <div><b>장착 반지2:</b> ${player.equipment.ring2 ? `<span style="color:${player.equipment.ring2.color}">${player.equipment.ring2.name}</span>` : `없음`}</div>
        <div><b>장착 아뮬렛:</b> ${player.equipment.amulet ? `<span style="color:${player.equipment.amulet.color}">${player.equipment.amulet.name}</span>` : `없음`}</div>
        <div><b>보조 코어1:</b> ${player.equipment.subCore1 ? `<span style="color:${player.equipment.subCore1.color}">${player.equipment.subCore1.name}</span>` : `비어있음`}</div>
        <div><b>보조 코어2:</b> ${player.equipment.subCore2 ? `<span style="color:${player.equipment.subCore2.color}">${player.equipment.subCore2.name}</span>` : `비어있음`}</div>
      </div>
    </div>
  `;
}

/**
 * 주인공 상세 정보 및 스탯 Breakdown 분석 모달 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderPlayerDetailsHTML(player) {
  let speedText = player.getEffectiveStat(`dex`) < 100 
    ? `낮은 민첩으로 인한 스피드 패널티 구간 (기본 속도 10 미만 감속)` 
    : `성장 틱 스피드 충전 적용 중 (DEX 상승에 비례해 속도 지속 증가)`;

  const activeTags = player.compileActiveTags();
  
  // 6대 스탯 Breakdown 기여도 분석
  const strBD = player.getEffectiveStatWithBreakdown('str');
  const intBD = player.getEffectiveStatWithBreakdown('int');
  const wisBD = player.getEffectiveStatWithBreakdown('wis');
  const dexBD = player.getEffectiveStatWithBreakdown('dex');
  const conBD = player.getEffectiveStatWithBreakdown('con');
  const chrBD = player.getEffectiveStatWithBreakdown('chr');

  const renderBreakdownHTML = (bd) => {
    return bd.contributions.map(c => {
      const sign = c.value >= 0 ? "+" : "";
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:rgba(255,255,255,0.45); line-height:1.25; margin-top:0.1rem; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:0.05rem;">
          <span style="font-weight: 500;">• ${c.source}</span>
          <span style="color:${c.color || '#cbd5e1'}; font-weight:700;">${sign}${c.value}</span>
        </div>
      `;
    }).join('');
  };

  // 선언적 시너지 레지스트리를 통한 동적 시너지 렌더러 구현
  let synergyCardsHTML = ``;
  const categories = {
    DEFENSE: { title: "🧱 생존 및 재생 시너지 (Defense & Health)", color: "#10b981", items: [] },
    VELOCITY: { title: "⚡ 속도 및 가속 시너지 (Speed & Haste)", color: "#38bdf8", items: [] },
    OFFENSE: { title: "⚔️ 전투 및 강타 시너지 (Offense & Crits)", color: "#f43f5e", items: [] },
    RESISTANCE: { title: "🛡️ 속성 저항 장막 (Elemental Wards)", color: "#34d399", items: [] },
    ELEMENTAL_DMG: { title: "🔥 속성 주입 아우라 (Elemental Infusions)", color: "#fbbf24", items: [] }
  };

  for (const [tag, count] of Object.entries(activeTags)) {
    const reg = SYNERGY_TAG_REGISTRY[tag];
    if (reg) {
      const formatted = reg.formatValue(count, player);
      const category = reg.category || "OFFENSE";
      if (categories[category]) {
        categories[category].items.push(`
          <div style="display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.015); padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <span style="color:var(--text-main); font-weight:600; display:flex; align-items:center; gap:0.25rem;">
              <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:${reg.themeColor};"></span>
              ${reg.displayName}
            </span>
            <span style="color:${reg.themeColor}; font-weight:bold; text-align:right;">
              ${formatted} (${count}스택)
            </span>
          </div>
        `);
      }
    } else {
      const formattedDefault = `×${count} 중첩 활성화`;
      categories.OFFENSE.items.push(`
        <div style="display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.015); padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
          <span style="color:var(--text-muted); font-weight:600;">
            ❓ [미분류] ${tag}
          </span>
          <span style="color:#94a3b8; font-weight:bold;">
            ${formattedDefault}
          </span>
        </div>
      `);
    }
  }

  for (const key in categories) {
    const cat = categories[key];
    if (cat.items.length > 0) {
      synergyCardsHTML += `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
          <p style="font-weight: bold; color: ${cat.color}; font-size: 0.78rem; margin-bottom: 0.4rem;">${cat.title}</p>
          <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.76rem;">
            ${cat.items.join('')}
          </div>
        </div>
      `;
    }
  }

  if (synergyCardsHTML === ``) {
    synergyCardsHTML = `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.8rem; border-radius: 8px; text-align:center; color:var(--text-muted); font-style:italic; font-size:0.76rem;">
        ● 현재 활성화된 특별한 신체 시너지가 없습니다.
      </div>
    `;
  }

  let compiledPerksHTML = ``;
  const activePerks = player.getCombinedPerks();
  if (activePerks.length > 0) {
    compiledPerksHTML += `<ul style="list-style-type: none; padding-left: 0.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.74rem; margin-top:0.4rem;">`;
    for (let perkId of activePerks) {
      let perk = MONSTER_PERKS[perkId];
      if (perk) {
        compiledPerksHTML += `<li>• <span style="color:#10b981; font-weight:bold;">${perk.name}</span>: ${perk.desc}</li>`;
      }
    }
    compiledPerksHTML += `</ul>`;
  }

  let compiledGearTagsHTML = ``;
  const uniquePrefixes = new Set();
  const uniqueSuffixes = new Set();

  if (player.mimicCore) {
    if (player.mimicCore.prefixes) player.mimicCore.prefixes.forEach(p => uniquePrefixes.add(p));
    if (player.mimicCore.suffixes) player.mimicCore.suffixes.forEach(s => uniqueSuffixes.add(s));
  }

  for (const key in player.equipment) {
    const gear = player.equipment[key];
    if (gear) {
      if (gear.prefixes) gear.prefixes.forEach(p => uniquePrefixes.add(p));
      if (gear.suffixes) gear.suffixes.forEach(s => uniqueSuffixes.add(s));
    }
  }

  if (player.equippedLamp) {
    if (player.equippedLamp.prefixes) player.equippedLamp.prefixes.forEach(p => uniquePrefixes.add(p));
    if (player.equippedLamp.suffixes) player.equippedLamp.suffixes.forEach(s => uniqueSuffixes.add(s));
  }
  if (uniquePrefixes.size > 0 || uniqueSuffixes.size > 0) {
    compiledGearTagsHTML += `<ul style="list-style-type: none; padding-left: 0.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.74rem; margin-top:0.4rem;">`;
    for (let p of uniquePrefixes) {
      let tag = PREFIX_TAGS[p];
      if (tag) {
        compiledGearTagsHTML += `<li>• <span style="color:#fbbf24; font-weight:bold;">[접두] ${tag.name}</span>: ${tag.desc}</li>`;
      }
    }
    for (let s of uniqueSuffixes) {
      let tag = SUFFIX_TAGS[s];
      if (tag) {
        compiledGearTagsHTML += `<li>• <span style="color:#38bdf8; font-weight:bold;">[접미] ${tag.name}</span>: ${tag.desc}</li>`;
      }
    }
    compiledGearTagsHTML += `</ul>`;
  }

  const currentWeight = player.body.getCurrentWeight();
  const maxWeight = player.body.getMaxWeightLimit();
  const weightPercent = Math.min(100, Math.floor((currentWeight / maxWeight) * 100));
  let weightColor = "#10b981";
  let weightStatusText = "🟢 원활한 행동력";
  if (currentWeight >= maxWeight) {
    weightColor = "#ef4444";
    weightStatusText = "⚠️ 과적 (속도 저하)";
  } else if (currentWeight >= maxWeight * 0.8) {
    weightColor = "#fbbf24";
    weightStatusText = "⚡ 무거움 (스피드 감소)";
  }

  let mutationsHTML = ``;
  if (player.body.mutations && player.body.mutations.length > 0) {
    mutationsHTML += `
      <div>
        <p style="font-weight: bold; color: #a855f7; font-size: 0.78rem; margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.25rem;">🧬 바디 각인 돌연변이 특성 (Mutations - ${player.body.mutations.length}/4)</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
    `;
    player.body.mutations.forEach(mutId => {
      const perk = MONSTER_PERKS[mutId];
      if (perk) {
        const isBad = ["FRAIL_BODY", "SLOW_REFLEX", "MANA_LEAK", "DULL_MIND", "HEAVY_SOUL"].includes(mutId);
        if (isBad) {
          mutationsHTML += `<span style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #f87171; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 5px; font-weight: bold; display: inline-flex; align-items: center; gap: 0.2rem;">💀 <b>${perk.name}</b></span>`;
        } else {
          mutationsHTML += `<span style="background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); color: #c084fc; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 5px; font-weight: bold; display: inline-flex; align-items: center; gap: 0.2rem;">🧬 <b>${perk.name}</b></span>`;
        }
      }
    });
    mutationsHTML += `</div></div>`;
  } else {
    mutationsHTML += `
      <div>
        <p style="font-weight: bold; color: #a855f7; font-size: 0.78rem; margin-bottom: 0.25rem;">🧬 바디 각인 돌연변이 유전자 (Mutations - 0/4)</p>
        <span style="color: var(--text-muted); font-size: 0.72rem; font-style: italic;">코어 포식/섭취 시 일정 확률로 영구 시너지 태그가 육체에 각인됩니다.</span>
      </div>
    `;
  }

  let synergyDashboardHTML = ``;
  if (Object.keys(activeTags).length > 0) {
    synergyDashboardHTML += `
      <div>
        <p style="font-weight: bold; color: #a855f7; font-size: 0.78rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.25rem;">🎯 실시간 바디 시너지 대시보드 (Active Synergies)</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
    `;
    for (const [tag, count] of Object.entries(activeTags)) {
      const reg = SYNERGY_TAG_REGISTRY[tag];
      let badgeColor = "#94a3b8";
      if (reg) {
        badgeColor = reg.themeColor;
      } else {
        if (tag.includes("STR")) badgeColor = "#ef4444";
        else if (tag.includes("DEX")) badgeColor = "#38bdf8";
        else if (tag.includes("CON")) badgeColor = "#10b981";
        else if (tag.includes("INT")) badgeColor = "#a855f7";
      }

      synergyDashboardHTML += `
        <span style="
          display: inline-flex; align-items: center; gap: 0.2rem;
          font-size: 0.7rem; font-weight: bold;
          background: ${badgeColor}12; border: 1px solid ${badgeColor}35;
          color: ${badgeColor}; padding: 0.15rem 0.45rem; border-radius: 5px;
        ">
          <b>${reg ? reg.displayName : tag}</b> ×${count}
        </span>
      `;
    }
    synergyDashboardHTML += `</div></div>`;
  }

  return `
    <div class="detail-header" style="
      text-align: left;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0.7rem 0.9rem;
      border-radius: 10px 10px 0 0;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    ">
      <span class="detail-type" style="font-size: 0.7rem; color: #38bdf8; text-transform: uppercase; font-weight: bold; letter-spacing: 0.06em;">[👤 모방 육체 상세 정보 상태창]</span>
      <h3 class="detail-title" style="color: #38bdf8; font-size: 1.15rem; font-weight:700; margin-top: 0.15rem; margin-bottom: 0;">
        모방자 (${player.mimicCore.name} 형태)
      </h3>
    </div>
    
    <div class="detail-desc" style="
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-top: none;
      padding: 0.9rem;
      border-radius: 0 0 10px 10px;
      font-size: 0.82rem;
      color: var(--text-muted);
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      line-height: 1.5;
      overflow-y: auto;
      max-height: 380px;
      padding-right: 4px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    ">
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px; font-size: 0.76rem; line-height: 1.45;">
        <b>소개:</b> 숙주 몬스터들의 형태를 모방하는 유동 신체입니다. 장착한 무기 및 기어의 고유 보정을 영구 계승하여 융합 성장합니다.
      </div>
      
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.76rem; font-weight: bold; margin-bottom: 0.25rem;">
          <span style="color: var(--text-main);">⚖️ 적재 중량 무게:</span>
          <span style="color: ${weightColor}; font-family: monospace;">${currentWeight.toFixed(1)} / ${maxWeight} kg</span>
        </div>
        <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 0.25rem;">
          <div style="width: ${weightPercent}%; height: 100%; background: ${weightColor}; transition: width 0.3s ease; border-radius: 4px;"></div>
        </div>
        <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: bold;">
          상태: <span style="color: ${weightColor};">${weightStatusText}</span>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
        <p style="font-weight: bold; color: #fbbf24; font-size: 0.78rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.25rem;">⚔️ 핵심 능력치 기여도 분석 (Breakdown Attributes)</p>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#f87171; font-weight:700;">힘 (STR)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#ef4444;">${strBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(strBD)}
          </div>
          <div style="background: rgba(168, 85, 247, 0.03); border: 1px solid rgba(168, 85, 247, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#c084fc; font-weight:700;">지능 (INT)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#a855f7;">${intBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(intBD)}
          </div>
          <div style="background: rgba(251, 191, 36, 0.03); border: 1px solid rgba(251, 191, 36, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#fde047; font-weight:700;">지혜 (WIS)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#eab308;">${wisBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(wisBD)}
          </div>
          <div style="background: rgba(56, 189, 248, 0.03); border: 1px solid rgba(56, 189, 248, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#7dd3fc; font-weight:700;">민첩 (DEX)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#38bdf8;">${dexBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(dexBD)}
          </div>
          <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#34d399; font-weight:700;">생명력 (CON)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#10b981;">${conBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(conBD)}
          </div>
          <div style="background: rgba(236, 72, 153, 0.03); border: 1px solid rgba(236, 72, 153, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#f472b6; font-weight:700;">매력 (CHR)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#ec4899;">${chrBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(chrBD)}
          </div>
        </div>
        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.45rem; padding-left: 0.1rem; line-height: 1.3;">
          ℹ️ ${speedText}
        </div>
      </div>

      ${synergyCardsHTML}

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
        <p style="font-weight: bold; color: #38bdf8; font-size: 0.78rem; margin-bottom: 0.2rem;">⭐ 고유 특성 및 전투 능력치 (Perks & Combat Stats)</p>
        <ul style="list-style-type: none; padding-left: 0.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.74rem;">
          <li>• 🧬 <b>모방 능력 (Mimicry):</b> 타겟 처치 시 대상의 바디 코어를 분석/복제하여 영혼 이식.</li>
          <li>• 🎯 <b>기본 명중률 (BTH):</b> <span style="color: #fbbf24; font-weight:bold;">${player.getBaseToHitScore ? player.getBaseToHitScore() : 50} BTH (${Math.round((player.getBaseHitChance ? player.getBaseHitChance(10) : 0.83) * 100)}%)</span> <span style="font-size:0.68rem; color:var(--text-muted);">(vs 표준 AC 10)</span></li>
          <li>• 🛡️ <b>총합 방어력 (Total AC):</b> <span style="color: #38bdf8; font-weight:bold;">+${player.getTotalAC ? player.getTotalAC() : 10} AC</span> <span style="font-size:0.68rem; color:var(--text-muted);">(기본 물리 감쇄 -${Math.floor((player.getTotalAC ? player.getTotalAC() : 10) / 8)} DMG)</span></li>
        </ul>
        ${compiledPerksHTML}
        ${compiledGearTagsHTML}
      </div>
      
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
        ${mutationsHTML}
      </div>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
        ${synergyDashboardHTML}
      </div>

      ${(() => {
        const hasBreath = Object.entries(ACTIVE_SKILL_CONFIGS).some(
          ([key, cfg]) => cfg.type === "BREATH" && (activeTags[key] || 0) > 0
        );
        if (!hasBreath) return ``;

        const ELEM_META = {
          FIRE:       { label: "🔥 화염",  color: "#ef4444" },
          COLD:       { label: "❄️ 냉기",  color: "#38bdf8" },
          LIGHTNING:  { label: "⚡ 전기",  color: "#a855f7" },
          ACID:       { label: "🧪 산성",  color: "#22c55e" },
          MANA:       { label: "🔮 마나",  color: "#a78bfa" },
        };
        const availableElems = new Set(["FIRE"]);
        for (const key in player.equipment) {
          const gear = player.equipment[key];
          if (gear && gear.prefixes) {
            for (const pref of gear.prefixes) {
              const tag = PREFIX_TAGS[pref];
              if (tag && tag.element && ELEM_META[tag.element]) availableElems.add(tag.element);
            }
          }
        }

        const current = player.selectedBreathElement;
        let btnHTML = ``;

        btnHTML += `<button
          onclick="window.__game && window.__game.setBreathElement(null)"
          style="
            padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.72rem; font-weight: bold; cursor: pointer;
            border: 1px solid ${!current ? '#60a5fa' : 'rgba(255,255,255,0.15)'};
            background: ${!current ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)'};
            color: ${!current ? '#60a5fa' : 'var(--text-muted)'};
          ">🔁 자동</button>`;

        for (const elem of availableElems) {
          const meta = ELEM_META[elem];
          const isSelected = current === elem;
          btnHTML += `<button
            onclick="window.__game && window.__game.setBreathElement('${elem}')"
            style="
              padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.72rem; font-weight: bold; cursor: pointer;
              border: 1px solid ${isSelected ? meta.color : 'rgba(255,255,255,0.15)'};
              background: ${isSelected ? `${meta.color}22` : 'rgba(255,255,255,0.05)'};
              color: ${isSelected ? meta.color : 'var(--text-muted)'};
            ">${meta.label}</button>`;
        }

        return `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px;">
            <p style="font-weight: bold; color: #f97316; font-size: 0.78rem; margin-bottom: 0.3rem;">
              🐉 브레스 속성 선택
            </p>
            <p style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.35rem;">
              현재: <b style="color:#f97316;">${current ? (ELEM_META[current]?.label ?? current) : "🔁 자동 감지"}</b>
              &nbsp;— 장착 장비의 속성 태그 중에서 선택하세요.
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem;">
              ${btnHTML}
            </div>
          </div>
        `;
      })()}
    </div>
  `;
}

/**
 * 몬스터 의태 고유 스킬 및 숙련도 모달 HTML을 생성합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderSkillTreeHTML(player) {
  const coreName = player.mimicCore?.name || '인간';
  const masteryLvl = player.getMorphMasteryLevel ? player.getMorphMasteryLevel() : 1;
  const innateSkills = player.getInnateSkills ? player.getInnateSkills() : [];
  const loreXp = player.body?.loreRegistry?.[player.mimicCore?.coreType || 'HUMAN'] || 0;

  const skillsListHTML = innateSkills.map(skill => {
    const isUnlocked = skill.isUnlocked(masteryLvl);
    const cd = player.getTracker ? player.getTracker(skill.id, 'cooldown') : 0;
    const effectiveCd = skill.getEffectiveCooldown ? skill.getEffectiveCooldown(masteryLvl) : skill.cooldown;
    
    let statusBadge = `<span style="background: rgba(16,185,129,0.15); color: #34d399; font-weight: bold; font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 4px; border: 1px solid rgba(16,185,129,0.3);">🟢 자동 격발 대기 (Auto-Ready)</span>`;
    if (!isUnlocked) {
      statusBadge = `<span style="background: rgba(239,68,68,0.15); color: #f87171; font-weight: bold; font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 4px; border: 1px solid rgba(239,68,68,0.3);">🔒 잠김 (숙련도 Lv.${skill.requiredMastery} 필요)</span>`;
    } else if (cd > 0) {
      statusBadge = `<span style="background: rgba(251,191,36,0.15); color: #fbbf24; font-weight: bold; font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 4px; border: 1px solid rgba(251,191,36,0.3);">⏳ 쿨다운 ${cd}턴 (회복 중)</span>`;
    }

    const cardOpacity = isUnlocked ? '1' : '0.6';
    const borderCol = isUnlocked ? skill.color : 'rgba(255,255,255,0.1)';

    return `
      <div style="background: rgba(0,0,0,0.3); border: 1px solid ${borderCol}; border-radius: 6px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; opacity: ${cardOpacity};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span style="font-size: 1rem;">${skill.icon}</span>
            <b style="color: ${skill.color}; font-size: 0.85rem;">${skill.name}</b>
          </div>
          ${statusBadge}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.35;">
          ${skill.desc}
        </div>
        <div style="display: flex; gap: 0.6rem; font-size: 0.7rem; font-family: monospace; color: #94a3b8; margin-top: 0.15rem;">
          <span>⏳ 쿨다운: <b style="color: #f59e0b;">${effectiveCd}턴</b></span>
          <span>🎯 사거리: <b style="color: #34d399;">${skill.maxRange}칸</b></span>
          <span>🎲 위력: <b style="color: #cbd5e1;">${skill.dice}</b></span>
          <span>⚡ 발동: <b style="color: #38bdf8;">자동 조준 격발</b></span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="detail-header" style="text-align: left;">
      <span class="detail-type" style="font-size: 0.7rem; color: #fbbf24; text-transform: uppercase;">[⚡ ToME 2.3.5 정통 몬스터 의태 스킬]</span>
      <h3 class="detail-title" style="color: #fbbf24; font-size: 1.1rem; font-weight:600; margin-top: 0.15rem;">
        현재 의태: ${coreName}
      </h3>
    </div>
    <div class="detail-desc" style="margin-top: 0.5rem; font-size: 0.82rem; color: var(--text-muted); text-align: left; display: flex; flex-direction: column; gap: 0.5rem;">
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>🧬 종족 숙련도: <b style="color: #38bdf8; font-size: 0.9rem;">Lv.${masteryLvl} / 50</b> <span style="font-size: 0.7rem; color: #94a3b8;">(${loreXp} XP)</span></span>
        <span style="font-size: 0.72rem; color: #34d399;">🎯 사거리/쿨타임 충족 시 자동 조준 격발</span>
      </div>

      <p style="font-weight: bold; color: var(--text-main); font-size: 0.8rem; margin-top: 0.1rem;">⚡ 자동 격발 고유 스킬 목록:</p>
      <div style="display: flex; flex-direction: column; gap: 0.4rem;">
        ${skillsListHTML}
      </div>
    </div>
  `;
}

/**
 * 무기 마스터리 및 몬스터 종족 로어 도감 HTML을 생성합니다. (TomeNET 스타일 3-탭 통합 뷰)
 * @param {Object} player - 플레이어 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderMasteryDetailsHTML(player) {
  return renderMonsterLoreModalHTML(player, 'mastery');
}

// Global Browser DOM 이벤트 브릿지 바인딩 (인게임 탭 전환, 검색, 필터링)
if (typeof window !== 'undefined') {
  window.__currentLoreTab = 'lore';
  window.__currentLoreFilter = 'ALL';
  window.__currentUniqueFilter = 'ALL';
  window.__currentLoreSearch = '';
  window.__currentSelectedMonsterKey = 'MON_FILTHY_STREET_URCHIN';

  window.__switchLoreTab = function(tab) {
    window.__currentLoreTab = tab;
    const player = (window.__game && window.__game.player) || (window.game && window.game.player);
    const detailEl = document.getElementById('item-detail');
    if (detailEl && player) {
      detailEl.innerHTML = renderMonsterLoreModalHTML(player, tab, {
        filterType: window.__currentLoreFilter,
        uniqueFilter: window.__currentUniqueFilter,
        searchQuery: window.__currentLoreSearch,
        selectedKey: window.__currentSelectedMonsterKey
      });
    }
  };

  window.__onMonsterLoreSearch = function(query) {
    window.__currentLoreSearch = query;
    const player = (window.__game && window.__game.player) || (window.game && window.game.player);
    const detailEl = document.getElementById('item-detail');
    if (detailEl && player) {
      detailEl.innerHTML = renderMonsterLoreModalHTML(player, 'lore', {
        filterType: window.__currentLoreFilter,
        uniqueFilter: window.__currentUniqueFilter,
        searchQuery: window.__currentLoreSearch,
        selectedKey: window.__currentSelectedMonsterKey
      });
      const input = document.getElementById('monster-lore-search-input');
      if (input) {
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      }
    }
  };

  window.__setMonsterLoreFilter = function(filter) {
    window.__currentLoreFilter = filter;
    const player = (window.__game && window.__game.player) || (window.game && window.game.player);
    const detailEl = document.getElementById('item-detail');
    if (detailEl && player) {
      detailEl.innerHTML = renderMonsterLoreModalHTML(player, 'lore', {
        filterType: window.__currentLoreFilter,
        uniqueFilter: window.__currentUniqueFilter,
        searchQuery: window.__currentLoreSearch,
        selectedKey: window.__currentSelectedMonsterKey
      });
    }
  };

  window.__setUniqueChecklistFilter = function(filter) {
    window.__currentUniqueFilter = filter;
    const player = (window.__game && window.__game.player) || (window.game && window.game.player);
    const detailEl = document.getElementById('item-detail');
    if (detailEl && player) {
      detailEl.innerHTML = renderMonsterLoreModalHTML(player, 'unique', {
        filterType: window.__currentLoreFilter,
        uniqueFilter: window.__currentUniqueFilter,
        searchQuery: window.__currentLoreSearch,
        selectedKey: window.__currentSelectedMonsterKey
      });
    }
  };

  window.__selectMonsterLore = function(key) {
    window.__currentSelectedMonsterKey = key;
    const player = (window.__game && window.__game.player) || (window.game && window.game.player);
    const detailEl = document.getElementById('item-detail');
    if (detailEl && player) {
      detailEl.innerHTML = renderMonsterLoreModalHTML(player, 'lore', {
        filterType: window.__currentLoreFilter,
        uniqueFilter: window.__currentUniqueFilter,
        searchQuery: window.__currentLoreSearch,
        selectedKey: window.__currentSelectedMonsterKey
      });
    }
  };
}

/**
 * 상단 탑바 HUD(SPD, HP, Floor) 텍스트를 업데이트합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @param {number} floor - 현재 층수
 */
export function updateTopBarHUD(player, floor) {
  const hpEl = document.getElementById('ui-hp');
  const spdEl = document.getElementById('ui-speed');
  const flEl = document.getElementById('ui-floor');

  if (hpEl) {
    const shieldText = player.manaShield > 0 ? ` (+${player.manaShield})` : '';
    hpEl.textContent = `${player.stats.hp}/${player.stats.maxHp}${shieldText}`;
  }
  if (spdEl) {
    const effectiveDex = player.getEffectiveStat ? player.getEffectiveStat('dex') : player.stats.dex;
    const speed = Math.max(0.1, effectiveDex * 0.1);
    spdEl.textContent = speed.toFixed(2);
  }
  if (flEl) {
    flEl.textContent = floor.toString();
  }
}

/**
 * 전투 로그 엔트리 HTML 문자열을 포맷팅합니다.
 * @param {string} message - 로그 메시지
 * @param {string} [type='system'] - 로그 유형 ('combat', 'loot', 'system', 'danger', 'heal')
 * @returns {string} HTML p 태그 문자열
 */
export function formatCombatLogHTML(message, type = 'system') {
  return `<p class="log-entry ${type}">${message}</p>`;
}

/**
 * 컨트롤 바 상단 원거리 자동사격 아이콘 버튼(🏹)을 업데이트/렌더링합니다.
 * @param {Object} player - 플레이어 인스턴스
 * @param {Object} [game=null] - 게임 인스턴스
 */
export function updateFloatingAutoFireButton(player, game = null) {
  if (typeof document === 'undefined') return;

  // 1. 혹시 남아있을 수 있는 레거시 플로팅 버튼 DOM 정리
  const legacyBtn = document.getElementById('hud-floating-autofire-btn');
  if (legacyBtn && legacyBtn.parentNode) {
    legacyBtn.parentNode.removeChild(legacyBtn);
  }

  // 2. 통합 액션 바 아이콘 버튼 검색
  let btn = document.getElementById('btn-autofire-toggle');
  const isMenuOpen = game ? game.isMainMenuOpen : (typeof window !== 'undefined' && (window.__game ? window.__game.isMainMenuOpen : (window.game ? window.game.isMainMenuOpen : false)));
  const hasBow = !isMenuOpen && player && player.equipment && (player.equipment.bow || (player.equipment.weapon && (player.equipment.weapon.slotType === 'BOW' || player.equipment.weapon.char === '}' || player.equipment.weapon.weaponCategory === 'ARCHERY' || player.equipment.weapon.weaponCategory === 'RANGED')));

  if (!btn) {
    // DOM에 컨테이너가 있을 경우 동적 생성
    const topRow = document.querySelector('.action-top-row');
    if (topRow) {
      btn = document.createElement('button');
      btn.id = 'btn-autofire-toggle';
      btn.className = 'action-btn autofire-icon-btn hidden';
      btn.setAttribute('data-action', 'AUTOFIRE');
      btn.setAttribute('title', '원거리 자동사격 ON/OFF 토글 (단축키: T)');
      btn.innerHTML = `<span class="autofire-icon">🏹</span><span id="autofire-badge" class="autofire-badge">ON</span>`;
      topRow.appendChild(btn);
    }
  }

  if (!btn) return;

  if (!hasBow) {
    btn.classList?.add?.('hidden');
    btn.style.display = 'none';
    return;
  }

  btn.classList?.remove?.('hidden');
  btn.style.display = 'flex';
  const isEnabled = !!player.autoFireEnabled;
  const badge = (btn.querySelector && btn.querySelector('#autofire-badge')) || (typeof document !== 'undefined' && document.getElementById ? document.getElementById('autofire-badge') : null);

  if (isEnabled) {
    btn.classList?.remove?.('is-disabled');
    if (badge) {
      badge.innerText = 'ON';
      if (badge.style) {
        badge.style.background = '#10b981';
        badge.style.color = '#06070b';
      }
    }
  } else {
    btn.classList?.add?.('is-disabled');
    if (badge) {
      badge.innerText = 'OFF';
      if (badge.style) {
        badge.style.background = '#64748b';
        badge.style.color = '#f1f5f9';
      }
    }
  }
}

// EventBus Pub/Sub 기반 UI 라이프사이클 및 플로팅 컨트롤 자동 동기화 리스너 등록
if (typeof eventBus !== 'undefined' && eventBus.on) {
  eventBus.on(GameEvents.TITLE_SCREEN, () => {
    if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-autofire-toggle') || document.getElementById('hud-floating-autofire-btn');
      if (btn) {
        btn.classList.add('hidden');
        btn.style.display = 'none';
      }
    }
  });

  eventBus.on(GameEvents.GAME_START, (data) => {
    if (data && data.player) {
      updateFloatingAutoFireButton(data.player, data.game);
    }
  });

  eventBus.on(GameEvents.EQUIPMENT_CHANGE, (data) => {
    if (data && data.player) {
      updateFloatingAutoFireButton(data.player, data.game);
    }
  });

  eventBus.on(GameEvents.AUTOFIRE_TOGGLE, (data) => {
    if (data && data.player) {
      updateFloatingAutoFireButton(data.player, data.game);
    }
  });

  eventBus.on(GameEvents.GAME_OVER, () => {
    if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-autofire-toggle') || document.getElementById('hud-floating-autofire-btn');
      if (btn) {
        btn.classList.add('hidden');
        btn.style.display = 'none';
      }
    }
  });
}

