/**
 * @module InspectModalView
 * @category ui
 * @description 몬스터 48px 여유 히트박스 피킹 관찰 팝업 및 4대 스탯 기여도(Breakdown), 시너지, 상태이상 분석 뷰
 * @purity DOM Renderer
 * @dependencies Tags.js, Perks.js, Skills.js
 * @exports renderMonsterInspectHTML
 */

import { determineRarity, getRarityColor, SYNERGY_TAG_REGISTRY } from '../entities/Tags.js';
import { MONSTER_PERKS } from '../entities/Perks.js';
import { CORE_SKILL_TREES } from '../core/Skills.js';

/**
 * 몬스터 관찰(Inspect) 모달 바디 HTML을 생성합니다.
 * @param {Object} monster - 몬스터 인스턴스
 * @returns {string} HTML 문자열
 */
export function renderMonsterInspectHTML(monster) {
  const rarity = determineRarity(monster.prefixes, monster.suffixes);
  const rarityColor = getRarityColor(rarity);
  const rarityName = rarity === `normal` ? `일반` : rarity === `uncommon` ? `고급` : rarity === `rare` ? `희귀` : `전설`;

  const activeTags = monster.compileActiveTags ? monster.compileActiveTags() : {};

  // 4대 스탯 Breakdown 기여도 분석
  const strBD = monster.getEffectiveStatWithBreakdown ? monster.getEffectiveStatWithBreakdown('str') : { finalValue: monster.stats.str, contributions: [] };
  const dexBD = monster.getEffectiveStatWithBreakdown ? monster.getEffectiveStatWithBreakdown('dex') : { finalValue: monster.stats.dex, contributions: [] };
  const conBD = monster.getEffectiveStatWithBreakdown ? monster.getEffectiveStatWithBreakdown('con') : { finalValue: monster.stats.con, contributions: [] };
  const intBD = monster.getEffectiveStatWithBreakdown ? monster.getEffectiveStatWithBreakdown('int') : { finalValue: monster.stats.int, contributions: [] };

  const renderBreakdownHTML = (bd) => {
    if (bd.contributions.length === 0) return ``;
    return bd.contributions.map(c => {
      const sign = c.value >= 0 ? "+" : "";
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.64rem; color:rgba(255,255,255,0.4); line-height:1.25; margin-top:0.08rem; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:0.04rem;">
          <span>• ${c.source}</span>
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
    ELEMENTAL_DMG: { title: "🔥 속성 추가 타격 (Elemental Damage)", color: "#fbbf24", items: [] }
  };

  for (const [tag, count] of Object.entries(activeTags)) {
    const reg = SYNERGY_TAG_REGISTRY[tag];
    if (reg) {
      const formatted = reg.formatValue(count, monster);
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
      // 미등록 태그 디폴트 자동 노출
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
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.75rem; border-radius: 8px; margin-top:0.4rem;">
          <p style="font-weight: bold; color: ${cat.color}; font-size: 0.78rem; margin-bottom: 0.4rem;">${cat.title}</p>
          <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.76rem;">
            ${cat.items.join('')}
          </div>
        </div>
      `;
    }
  }

  let buffsDebuffsHTML = ``;
  let activeEffects = [];

  if (monster.manaShield && monster.manaShield > 0) {
    activeEffects.push(`
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(96, 165, 250, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #60a5fa; font-size: 0.78rem;">
        <span style="color: #60a5fa; font-weight: bold;">👼 마나 실드 (Mana Shield)</span>
        <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">+${monster.manaShield} HP 보호막 (${monster.manaShieldDuration}턴 남음)</span>
      </div>
    `);
  }
  if (monster.isAggroed) {
    activeEffects.push(`
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(244, 63, 94, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #f43f5e; font-size: 0.78rem;">
        <span style="color: #f43f5e; font-weight: bold;">🎯 타겟 어그로 (Aggroed)</span>
        <span style="font-weight: bold; color: var(--text-muted); font-size: 0.74rem;">전투 추적 기상 상태</span>
      </div>
    `);
  }

  if (monster.debuffs) {
    if (monster.debuffs.poison > 0) {
      activeEffects.push(`
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(52, 211, 153, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #34d399; font-size: 0.78rem;">
          <span style="color: #34d399; font-weight: bold;">🧪 산성 중독 (Poison)</span>
          <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">턴당 -2 HP 부식 (${monster.debuffs.poison}턴 남음)</span>
        </div>
      `);
    }
    if (monster.debuffs.frost > 0) {
      activeEffects.push(`
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(96, 165, 250, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #60a5fa; font-size: 0.78rem;">
          <span style="color: #60a5fa; font-weight: bold;">❄️ 빙결 감속 (Chilled)</span>
          <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">행동 속도 -30% (${monster.debuffs.frost}턴 남음)</span>
        </div>
      `);
    }
    if (monster.debuffs.paralyzed) {
      activeEffects.push(`
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(251, 191, 36, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #fbbf24; font-size: 0.78rem;">
          <span style="color: #fbbf24; font-weight: bold;">⚡ 감전 마비 (Paralyzed)</span>
          <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">행동 불가 상태 (1턴 남음)</span>
        </div>
      `);
    }
    if (monster.debuffs.magicVulnerability > 0) {
      activeEffects.push(`
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(192, 132, 252, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #c084fc; font-size: 0.78rem;">
          <span style="color: #c084fc; font-weight: bold;">🔮 마법 취약 (Vulnerability)</span>
          <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">받는 마법 피해 +30% (${monster.debuffs.magicVulnerability}턴 남음)</span>
        </div>
      `);
    }
  }

  if (monster.isColdVulnerable && monster.isColdVulnerable > 0) {
    activeEffects.push(`
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(96, 165, 250, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #60a5fa; font-size: 0.78rem;">
        <span style="color: #60a5fa; font-weight: bold;">❄️ 냉기 대파열 취약 (Vulnerability)</span>
        <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">원소 속성 피해 +30% (${monster.isColdVulnerable}턴 남음)</span>
      </div>
    `);
  }

  if (monster.isSuperconducted > 0) {
    activeEffects.push(`
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(96, 165, 250, 0.08); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #60a5fa; font-size: 0.78rem;">
        <span style="color: #60a5fa; font-weight: bold;">🧊⚡ 초전도 (Superconduct)</span>
        <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">물리 고정 저항 완전 상쇄 (${monster.isSuperconducted}턴 남음)</span>
      </div>
    `);
  }

  // Elemental Auras
  if (monster.elementalAura) {
    const elemNames = { FIRE: "🔥 화염 원소", COLD: "❄️ 냉기 원소", LIGHTNING: "⚡ 번개 원소", ACID: "🧪 산성 원소", MANA: "🔮 마나 원소" };
    const elemColors = { FIRE: "#f43f5e", COLD: "#60a5fa", LIGHTNING: "#fbbf24", ACID: "#34d399", MANA: "#c084fc" };
    const elemBgs = { FIRE: "rgba(244, 63, 94, 0.08)", COLD: "rgba(96, 165, 250, 0.08)", LIGHTNING: "rgba(251, 191, 36, 0.08)", ACID: "rgba(52, 211, 153, 0.08)", MANA: "rgba(192, 132, 252, 0.08)" };
    for (const key in monster.elementalAura) {
      const turns = monster.elementalAura[key];
      if (turns > 0) {
        activeEffects.push(`
          <div style="display: flex; align-items: center; justify-content: space-between; background: ${elemBgs[key]}; padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid ${elemColors[key]}; font-size: 0.78rem;">
            <span style="color: ${elemColors[key]}; font-weight: bold;">${elemNames[key]} 부착 (Aura)</span>
            <span style="font-weight: bold; color: var(--text-main); font-size: 0.74rem;">반응 대기 중 (${turns}턴 남음)</span>
          </div>
        `);
      }
    }
  }

  if (monster.breathCooldown > 0) {
    activeEffects.push(`
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #9ca3af; font-size: 0.78rem;">
        <span style="color: var(--text-muted); font-weight: bold;">💥 원소 브레스 쿨다운</span>
        <span style="font-weight: bold; color: var(--text-muted); font-size: 0.74rem;">사용 불가 (${monster.breathCooldown}턴 대기)</span>
      </div>
    `);
  }
  if (monster.giantBloodCooldown > 0) {
    activeEffects.push(`
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #9ca3af; font-size: 0.78rem;">
        <span style="color: var(--text-muted); font-weight: bold;">💖 거인의 피 내부 쿨다운</span>
        <span style="font-weight: bold; color: var(--text-muted); font-size: 0.74rem;">회복 발동 불가 (${monster.giantBloodCooldown}턴 대기)</span>
      </div>
    `);
  }

  if (activeEffects.length > 0) {
    buffsDebuffsHTML = `
      <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.6rem; margin-top: 0.4rem;">
        <p style="font-weight: bold; color: var(--text-main); font-size: 0.82rem; margin-bottom: 0.35rem;">💢 현재 전투 상태이상 및 버프/디버프:</p>
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          ${activeEffects.join('')}
        </div>
      </div>
    `;
  } else {
    buffsDebuffsHTML = `
      <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.6rem; margin-top: 0.4rem;">
        <p style="font-weight: bold; color: var(--text-main); font-size: 0.82rem; margin-bottom: 0.35rem;">💢 현재 전투 상태이상 및 버프/디버프:</p>
        <div style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.01); color: var(--text-muted); padding: 0.45rem; border-radius: 4px; font-size: 0.76rem; font-style: italic;">
          ● 적용된 전투 효과나 상태이상이 없습니다. (안정 상태)
        </div>
      </div>
    `;
  }

  let skillsHTML = ``;
  if (monster.skillSets && monster.skillSets.length > 0) {
    skillsHTML += `
      <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.6rem; margin-top: 0.4rem;">
        <p style="font-weight: bold; color: var(--text-main); font-size: 0.82rem; margin-bottom: 0.35rem;">📜 보유 무공 및 종족 스킬셋:</p>
        <ul style="list-style-type: none; padding-left: 0.2rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.78rem;">
    `;
    let count = 0;
    for (const skillSetName of monster.skillSets) {
      const skillTree = CORE_SKILL_TREES[skillSetName];
      if (skillTree) {
        for (const skill of skillTree) {
          const isActive = monster.level >= skill.pt;
          const typeLabel = skill.type === "ACTIVE" 
            ? `<span style="color: #60a5fa; font-weight: bold;">[액티브]</span>` 
            : `<span style="color: #10b981; font-weight: bold;">[패시브]</span>`;
          
          if (isActive) {
            skillsHTML += `
              <li style="background: rgba(16, 185, 129, 0.06); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #10b981;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.1rem;">
                  <span>${typeLabel} <b style="color: var(--text-main);">${skill.name}</b></span>
                  <span style="color: #10b981; font-weight: bold; font-size: 0.72rem;">● 활성화 (Lv.${skill.pt})</span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.74rem; padding-left: 0.2rem;">${skill.desc}</div>
              </li>
            `;
          } else {
            skillsHTML += `
              <li style="background: rgba(255, 255, 255, 0.01); padding: 0.25rem 0.4rem; border-radius: 4px; border-left: 3px solid #6b7280; opacity: 0.6;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.1rem; color: var(--text-muted);">
                  <span>${typeLabel} <b>${skill.name}</b></span>
                  <span style="color: #6b7280; font-weight: bold; font-size: 0.72rem;">○ 잠김 (요구 Lv.${skill.pt})</span>
                </div>
                <div style="color: rgba(255, 255, 255, 0.25); font-size: 0.74rem; padding-left: 0.2rem;">${skill.desc}</div>
              </li>
            `;
          }
          count++;
        }
      }
    }
    if (count === 0) {
      skillsHTML += `<li style="font-style: italic; color: var(--text-muted);">보유한 종족 무공 스킬셋이 없습니다.</li>`;
    }
    skillsHTML += `</ul></div>`;
  }

  let desc = ``;
  if (monster.type === `SLIME`) {
    desc = `물처럼 흐물거리는 정령성 유기체입니다. 차가운 던전 바닥에서 마력을 빨아들이며 성장합니다.`;
  } else if (monster.type === `GOBLIN`) {
    desc = `왜소하지만 대단히 날쌔고 비열한 아인종입니다. 틈이 보이면 바로 독침이나 비수로 급소를 찌릅니다.`;
  } else if (monster.type === `BAT`) {
    desc = `동굴 속에서 떼를 지어 살며, 초음파를 쏘아 사방을 식별합니다. 때로는 침입자의 생혈을 흡수하여 상처를 치유합니다.`;
  } else if (monster.type === `ORC`) {
    desc = `압도적인 완력과 지칠 줄 모르는 체력을 지닌 사나운 전사입니다. 거대한 군장검을 휘두르며 무자비하게 난동을 부립니다.`;
  } else if (monster.type === `OGRE`) {
    desc = `거대한 체구와 강인한 맷집을 가진 무시무시한 괴수입니다. 엄청난 힘으로 적을 분쇄합니다.`;
  } else if (monster.type === `HATCHLING`) {
    desc = `아직 어린 드래곤이지만 치명적인 화염을 뿜어낼 수 있는 무서운 지망생입니다.`;
  } else if (monster.type === `DRAGON`) {
    desc = `던전의 지배자이자 정점에 군림한 전설적인 불꽃의 드래곤입니다. 마법 비늘과 파괴적인 위용을 자랑합니다.`;
  } else {
    desc = `던전의 어둠 속에서 형상화된 기괴하고 적대적인 존재입니다.`;
  }

  let monsterPerksHTML = ``;
  if (monster.perks && monster.perks.length > 0) {
    monsterPerksHTML += `
      <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.6rem; margin-top: 0.4rem;">
        <p style="font-weight: bold; color: var(--text-main); font-size: 0.82rem; margin-bottom: 0.3rem;">🧬 고유 종족 특성 (Active Perks):</p>
        <ul style="list-style-type: none; padding-left: 0.4rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; color: var(--text-muted);">
    `;
    for (let perkId of monster.perks) {
      let perk = MONSTER_PERKS[perkId];
      if (perk) {
        monsterPerksHTML += `<li>• <span style="color: #10b981; font-weight: bold;">${perk.name}</span>: ${perk.desc}</li>`;
      }
    }
    monsterPerksHTML += `</ul></div>`;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 0.6rem; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
        <div><b>종족:</b> ${monster.displayName}</div>
        <div><b>등급:</b> <span style="color: ${rarityColor}; font-weight: bold;">${rarityName}</span></div>
        <div><b>현재 체력:</b> <span style="color: #10b981; font-weight: bold;">${monster.stats ? monster.stats.hp : (monster.hp || 10)} / ${monster.stats ? (monster.stats.maxHp || monster.maxHp || 10) : (monster.maxHp || 10)}</span></div>
        <div><b>회피 방어 (AC):</b> ${monster.baseAC || 10}</div>
        <div style="grid-column: span 2;"><b>행동 속도 (스피드):</b> ${Number(monster.speed || 1.0).toFixed(2)} / 틱</div>
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
          <div style="background: rgba(168, 85, 247, 0.03); border: 1px solid rgba(168, 85, 247, 0.12); padding: 0.5rem 0.6rem; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.15rem;">
              <span style="font-size:0.74rem; color:#c084fc; font-weight:700;">지능 (INT)</span>
              <span style="font-size:1.05rem; font-weight:800; color:#a855f7;">${intBD.finalValue}</span>
            </div>
            ${renderBreakdownHTML(intBD)}
          </div>
        </div>
      </div>

      ${synergyCardsHTML}

      ${monsterPerksHTML}
      ${buffsDebuffsHTML}
      ${skillsHTML}

      <div style="background: rgba(30, 41, 59, 0.45); border-left: 3px solid #fbbf24; border-radius: 6px; padding: 0.6rem 0.8rem; margin-top: 0.4rem; backdrop-filter: blur(8px); box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
        <p style="font-size: 0.7rem; color: #fbbf24; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">📜 ToME 생태 및 배경 서사 (Lore & Ecology)</p>
        <p style="font-style: italic; font-size: 0.78rem; line-height: 1.5; color: #e2e8f0; margin: 0;">“${monster.flavorText || monster.description || desc}”</p>
      </div>
    </div>
    <button class="modal-btn" id="monster-modal-ok-btn" style="margin-top: 0.8rem; background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.3); color: #38bdf8; font-weight: bold;">
      관찰 완료
    </button>
  `;
}
