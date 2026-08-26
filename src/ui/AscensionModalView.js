/**
 * @module AscensionModalView
 * @category ui
 * @description 50F 모르고스 토벌 승천(Ascension) 엔딩 컷씬, 발리노르의 빛 연출, 영구 명예의 전당(Hall of Fame) 및 사망 묘비명(Graveyard) 저장/렌더링 및 상세 스펙/인벤토리/전투로그 인스펙터 시스템
 * @purity DOM Manager / State Store
 * @dependencies ThemeColors.js, EventBus.js, GameEvents.js
 * @exports saveAscensionRecord, getHallOfFameRecords, saveGraveyardRecord, getGraveyardRecords, deduplicateGraveyardRecords, calculateScore, clearHallOfFameRecords, clearGraveyardRecords, renderAscensionModalHTML, renderHallOfFameModalHTML, renderGraveyardModalHTML, renderRecordDetailModalHTML, showRecordDetailModal, serializeCombatStats, serializeItemData, serializeEquipmentSlots, serializeInventoryItems, serializeRecentLogs, AscensionModalView
 */

import { TERM_COLORS } from '../configs/ThemeColors.js';
import { eventBus } from '../events/EventBus.js';
import { GameEvents } from '../events/GameEvents.js';

const STORAGE_KEY_HALL_OF_FAME = 'mimicry_hall_of_fame_records';
const STORAGE_KEY_GRAVEYARD = 'mimicry_graveyard_records';

// In-memory fallback for non-browser/Node.js testing environments
const memoryStorage = {
  [STORAGE_KEY_HALL_OF_FAME]: '[]',
  [STORAGE_KEY_GRAVEYARD]: '[]'
};

function getStorageItem(key) {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStorage[key] || null;
}

function setStorageItem(key, val) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, val);
  } else {
    memoryStorage[key] = val;
  }
}

/**
 * 로그라이크 종합 영예 점수(Score) 공식 연산
 * @param {Object} data 
 * @returns {number}
 */
export function calculateScore(data = {}) {
  const level = Number(data.level) || 1;
  const xp = Number(data.xp) || 0;
  const kills = Number(data.kills) || 0;
  const uniqueKills = Number(data.uniqueKills) || 0;
  const artifactsCount = Number(data.artifactsCount) || 0;
  const turns = Number(data.turns) || 1;
  const isVictory = Boolean(data.isVictory);

  // 기본 스코어 산식: 레벨(x1000) + XP + 킬수(x50) + 유니크수(x1000) + 유물수(x2500) + 승천 보너스(150,000점)
  // 속공 턴 단축 보너스: 50,000 - min(40000, 턴수 * 5)
  let baseScore = level * 1000 + Math.floor(xp * 0.5) + kills * 50 + uniqueKills * 1000 + artifactsCount * 2500;
  if (isVictory) {
    baseScore += 150000;
    const speedBonus = Math.max(0, 50000 - Math.min(45000, turns * 5));
    baseScore += speedBonus;
  } else {
    baseScore += Math.max(0, (data.floor || 1) * 500);
  }

  return Math.max(100, Math.floor(baseScore));
}

/**
 * 플레이어 전투 스탯 및 6대 능력치 직렬화
 * @param {Object} player
 * @returns {Object|null}
 */
export function serializeCombatStats(player) {
  if (!player) return null;
  const hp = player.stats?.hp !== undefined ? player.stats.hp : 0;
  const maxHp = player.stats?.maxHp || (player.getMaxHp ? player.getMaxHp() : hp || 1);
  const str = player.getEffectiveStat ? player.getEffectiveStat('str') : (player.stats?.str || 10);
  const int = player.getEffectiveStat ? player.getEffectiveStat('int') : (player.stats?.int || 10);
  const wis = player.getEffectiveStat ? player.getEffectiveStat('wis') : (player.stats?.wis || 10);
  const dex = player.getEffectiveStat ? player.getEffectiveStat('dex') : (player.stats?.dex || 10);
  const con = player.getEffectiveStat ? player.getEffectiveStat('con') : (player.stats?.con || 10);
  const chr = player.getEffectiveStat ? player.getEffectiveStat('chr') : (player.stats?.chr || 10);
  const ac = player.getTotalAC ? player.getTotalAC() : (player.stats?.ac || 10);
  const bth = player.getBaseToHitScore ? player.getBaseToHitScore() : (player.stats?.bth || 50);
  const hitChance = player.getBaseHitChance ? Math.round(player.getBaseHitChance() * 100) : Math.min(95, Math.max(5, Math.round((bth / (bth + ac)) * 100)));

  return {
    hp,
    maxHp,
    str,
    int,
    wis,
    dex,
    con,
    chr,
    ac,
    bth,
    hitChance
  };
}

/**
 * 단일 아이템 객체 직렬화
 * @param {Object} item
 * @returns {Object|null}
 */
export function serializeItemData(item) {
  if (!item) return null;
  const prefixes = Array.isArray(item.prefixes) ? [...item.prefixes] : (item.prefix ? [item.prefix] : []);
  const suffixes = Array.isArray(item.suffixes) ? [...item.suffixes] : (item.suffix ? [item.suffix] : []);
  
  let dice = '';
  if (typeof item.dice === 'string') {
    dice = item.dice;
  } else if (item.damageDice) {
    dice = typeof item.damageDice === 'string' ? item.damageDice : `${item.damageDice.diceCount || item.damageDice.count || 1}d${item.damageDice.diceSides || item.damageDice.sides || 4}`;
  } else if (item.damageRoll) {
    dice = `${item.damageRoll.diceCount || item.damageRoll.count || 1}d${item.damageRoll.diceSides || item.damageRoll.sides || 4}`;
  }

  return {
    name: item.name || '알 수 없는 아이템',
    char: item.char || '?',
    color: item.color || '#cbd5e1',
    type: item.slotType || item.type || item.itemType || 'ITEM',
    baseAC: typeof item.baseAC === 'number' ? item.baseAC : (typeof item.ac === 'number' ? item.ac : 0),
    dice: dice,
    prefixes: prefixes,
    suffixes: suffixes,
    amount: item.amount || item.count || 1,
    charges: item.charges !== undefined ? item.charges : (item.currentCharges !== undefined ? item.currentCharges : null),
    maxCharges: item.maxCharges || null,
    toHit: item.toHit ?? item.to_h ?? null,
    toDam: item.toDam ?? item.to_d ?? null,
    upgradeLevel: item.upgradeLevel || 0,
    flavorText: item.flavorText || item.description || ''
  };
}

/**
 * 착용 장비 12개 슬롯 직렬화
 * @param {Object} equipment
 * @returns {Object}
 */
export function serializeEquipmentSlots(equipment) {
  if (!equipment) return {};
  const slots = ['weapon', 'shield', 'bow', 'quiver', 'armor', 'helmet', 'gloves', 'boots', 'cloak', 'ring1', 'ring2', 'amulet'];
  const result = {};
  for (const slot of slots) {
    result[slot] = serializeItemData(equipment[slot]);
  }
  return result;
}

/**
 * 인벤토리 아이템 목록 직렬화
 * @param {Array<Object>} inventory
 * @returns {Array<Object>}
 */
export function serializeInventoryItems(inventory) {
  if (!Array.isArray(inventory)) return [];
  return inventory.map(serializeItemData).filter(Boolean);
}

/**
 * 최근 30줄 전투/시스템 로그 직렬화
 * @param {Array<Object|string>} logHistory
 * @returns {Array<Object>}
 */
export function serializeRecentLogs(logHistory) {
  if (!Array.isArray(logHistory)) return [];
  return logHistory.slice(-30).map(l => {
    if (typeof l === 'string') {
      return { text: l, type: 'system' };
    }
    return {
      text: l.text || '',
      type: l.type || 'system'
    };
  });
}

/**
 * 승천(클리어) 기록을 명예의 전당 로컬 스토리지에 영구 보관합니다.
 * @param {Object} record 
 * @returns {Array<Object>} 업데이트된 전체 명예의 전당 목록
 */
export function saveAscensionRecord(record) {
  if (!record) return [];
  const records = getHallOfFameRecords();

  const formattedRecord = {
    id: record.id || `hof_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    playerName: record.playerName || '용감한 승천자',
    level: record.level || 50,
    floor: record.floor || 50,
    turns: record.turns || 1,
    kills: record.kills || 0,
    uniqueKills: record.uniqueKills || 0,
    uniquesList: record.uniquesList || [],
    artifactsCount: record.artifactsCount || 0,
    artifactsList: record.artifactsList || [],
    mimicCore: record.mimicCore || '인간 여행자',
    stats: record.stats || null,
    equipment: record.equipment || null,
    inventory: record.inventory || [],
    recentLogs: record.recentLogs || [],
    finalEquipment: record.finalEquipment || {},
    score: record.score || calculateScore({ ...record, isVictory: true }),
    isVictory: true,
    clearDate: record.clearDate || new Date().toISOString()
  };

  records.push(formattedRecord);
  // 점수 내림차순 정렬
  records.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 최대 50개 유지
  const trimmed = records.slice(0, 50);
  setStorageItem(STORAGE_KEY_HALL_OF_FAME, JSON.stringify(trimmed));
  return trimmed;
}

/**
 * 명예의 전당 랭킹 목록을 조회합니다.
 * @returns {Array<Object>}
 */
export function getHallOfFameRecords() {
  try {
    const raw = getStorageItem(STORAGE_KEY_HALL_OF_FAME);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * 묘비명 레코드 배열 내 중복 항목을 필터링(Deduplicate)합니다.
 * 고유 식별자(ID) 및 시그니처(playerName_level_floor_killer_turns) 기준 중복 레코드를 완벽히 통합/제거합니다.
 * @param {Array<Object>} records 
 * @returns {Array<Object>}
 */
export function deduplicateGraveyardRecords(records) {
  if (!Array.isArray(records)) return [];
  const result = [];
  const seenIds = new Set();
  const seenSignatures = new Set();

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;

    const rId = record.id ? String(record.id) : null;
    const rName = record.playerName || '이름 모를 모험가';
    const rLevel = record.level || 1;
    const rFloor = record.floor || 1;
    const rKiller = record.killer || '정체불명의 적';
    const rTurns = record.turns || 1;
    const signature = `${rName}_${rLevel}_${rFloor}_${rKiller}_${rTurns}`;

    if (rId && seenIds.has(rId)) {
      continue;
    }
    if (seenSignatures.has(signature)) {
      continue;
    }

    if (rId) seenIds.add(rId);
    seenSignatures.add(signature);
    result.push(record);
  }

  return result;
}

/**
 * 사망 묘비명(Graveyard) 기록을 로컬 스토리지에 영구 보관합니다.
 * ID 및 시그니처(playerName_level_floor_killer_turns) 기반으로 기존 배열에 존재하는지 검사하여 중복 적재를 원천 차단합니다.
 * @param {Object} record 
 * @returns {Array<Object>}
 */
export function saveGraveyardRecord(record) {
  if (!record) return [];
  const records = getGraveyardRecords();

  const recordName = record.playerName || '이름 모를 모험가';
  const recordLevel = record.level || 1;
  const recordFloor = record.floor || 1;
  const recordKiller = record.killer || '정체불명의 적';
  const recordTurns = record.turns || 1;
  const signature = `${recordName}_${recordLevel}_${recordFloor}_${recordKiller}_${recordTurns}`;

  // 중복 기록 방지 세이프가드: ID 일치 또는 고유 시그니처 일치 시 중복 적재 원천 차단
  const isDuplicate = records.some(r => {
    if (!r || typeof r !== 'object') return false;
    if (record.id && r.id && String(record.id) === String(r.id)) return true;
    const rSig = `${r.playerName || '이름 모를 모험가'}_${r.level || 1}_${r.floor || 1}_${r.killer || '정체불명의 적'}_${r.turns || 1}`;
    return rSig === signature;
  });

  if (isDuplicate) {
    return records;
  }

  const formattedRecord = {
    id: record.id || `grave_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    playerName: recordName,
    level: recordLevel,
    floor: recordFloor,
    killer: recordKiller,
    turns: recordTurns,
    kills: record.kills || 0,
    uniqueKills: record.uniqueKills || 0,
    mimicCore: record.mimicCore || '인간 여행자',
    stats: record.stats || null,
    equipment: record.equipment || null,
    inventory: record.inventory || [],
    recentLogs: record.recentLogs || [],
    score: record.score || calculateScore({ ...record, isVictory: false }),
    epitaph: record.epitaph || `지하 ${recordFloor}층에서 [${recordKiller}]에게 최후를 맞이하고 영면하다.`,
    deathDate: record.deathDate || new Date().toISOString(),
    isVictory: false
  };

  records.push(formattedRecord);
  // 점수 내림차순 정렬
  records.sort((a, b) => (b.score || 0) - (a.score || 0));

  const trimmed = deduplicateGraveyardRecords(records).slice(0, 50);
  setStorageItem(STORAGE_KEY_GRAVEYARD, JSON.stringify(trimmed));
  return trimmed;
}

/**
 * 사망 묘비명 목록을 조회합니다. 기저장된 중복 항목까지 완벽히 전수 필터링(deduplicate)하여 반환합니다.
 * 중복이 발견되면 정제된 고유 레코드 배열로 localStorage를 즉시 자동 갱신(Auto-Healing)합니다.
 * @returns {Array<Object>}
 */
export function getGraveyardRecords() {
  try {
    const raw = getStorageItem(STORAGE_KEY_GRAVEYARD);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deduplicated = deduplicateGraveyardRecords(parsed);
    if (deduplicated.length !== parsed.length || JSON.stringify(deduplicated) !== raw) {
      setStorageItem(STORAGE_KEY_GRAVEYARD, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch (e) {
    return [];
  }
}

/**
 * 명예의 전당 기록 초기화
 */
export function clearHallOfFameRecords() {
  setStorageItem(STORAGE_KEY_HALL_OF_FAME, '[]');
}

/**
 * 사망 묘비명 기록 초기화
 */
export function clearGraveyardRecords() {
  setStorageItem(STORAGE_KEY_GRAVEYARD, '[]');
}

/**
 * 승천(Ascension) 엔딩 컷씬 모달 HTML 렌더링
 * @param {Object} victoryData 
 * @returns {string} HTML String
 */
export function renderAscensionModalHTML(victoryData = {}) {
  const score = (victoryData.score || calculateScore(victoryData)).toLocaleString();
  const turns = (victoryData.turns || 1).toLocaleString();
  const kills = (victoryData.kills || 0).toLocaleString();
  const uniqueCount = victoryData.uniqueKills || 0;
  const artifactsCount = victoryData.artifactsCount || 0;
  const mimicCore = victoryData.mimicCore || '모르고스의 의태 코어';
  const level = victoryData.level || 50;

  const eq = victoryData.finalEquipment || {};
  const weapon = eq.weapon || "유물: 'Grond'";
  const helmet = eq.helmet || '유물: Massive Iron Crown of Morgoth';
  const armor = eq.armor || '발리노르의 성갑';
  const shield = eq.shield || '없음';

  return `
    <div class="ascension-cutscene-container" style="
      background: radial-gradient(circle at 50% 30%, rgba(251, 191, 36, 0.25) 0%, rgba(15, 23, 42, 0.95) 75%, #06070b 100%);
      border: 2px solid #fbbf24;
      border-radius: 16px;
      box-shadow: 0 0 60px rgba(251, 191, 36, 0.4), inset 0 0 40px rgba(251, 191, 36, 0.15);
      padding: 2rem;
      max-width: 680px;
      margin: 0 auto;
      text-align: center;
      color: #f8fafc;
      font-family: inherit;
      position: relative;
      overflow: hidden;
    ">
      <!-- Valinor Light Ray Background Accent -->
      <div style="position: absolute; top: -50px; left: 50%; transform: translateX(-50%); width: 400px; height: 160px; background: radial-gradient(ellipse, rgba(253, 224, 71, 0.4), transparent 70%); pointer-events: none;"></div>

      <div style="font-size: 3rem; margin-bottom: 0.5rem; filter: drop-shadow(0 0 16px #fbbf24);">✨ 👑 🕊️</div>
      <h1 style="
        font-size: 1.85rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: linear-gradient(135deg, #fef08a, #f59e0b, #fbbf24);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.4rem;
        text-shadow: 0 0 30px rgba(251, 191, 36, 0.6);
      ">
        승천 (ASCENSION)
      </h1>
      <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem;">
        지하 50층의 암흑 군주 <strong>모르고스(Morgoth)</strong>를 물리치고 앙그반드의 어둠을 영구히 종식시켰습니다.<br>
        당신의 영혼은 <strong>발리노르의 영원한 빛(Light of Valinor)</strong>으로 승천하여 불멸의 영예를 얻었습니다!
      </p>

      <!-- Score Box -->
      <div style="
        background: rgba(251, 191, 36, 0.12);
        border: 1px solid rgba(251, 191, 36, 0.35);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        margin-bottom: 1.5rem;
        display: inline-block;
      ">
        <span style="font-size: 0.8rem; color: #fde047; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.2rem;">🏆 최종 모험 영예 점수</span>
        <span style="font-size: 2.2rem; font-weight: 800; color: #ffffff; font-family: monospace; text-shadow: 0 0 15px rgba(251, 191, 36, 0.8);">${score} PTS</span>
      </div>

      <!-- 4-Column Stats Grid -->
      <div style="
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        text-align: left;
      ">
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem 1rem;">
          <div style="font-size: 0.75rem; color: #94a3b8;">⏱️ 총 소요 턴수</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #38bdf8;">${turns} 턴</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem 1rem;">
          <div style="font-size: 0.75rem; color: #94a3b8;">⚔️ 누적 처치 몬스터</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #f43f5e;">${kills} 마리</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem 1rem;">
          <div style="font-size: 0.75rem; color: #94a3b8;">👑 처치한 유니크 몬스터</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #fbbf24;">${uniqueCount} / 168 종</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem 1rem;">
          <div style="font-size: 0.75rem; color: #94a3b8;">💎 수집한 전설 유물</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #a855f7;">${artifactsCount} 개</div>
        </div>
      </div>

      <!-- Final Build Summary -->
      <div style="
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 0.9rem 1.2rem;
        margin-bottom: 1.5rem;
        text-align: left;
        font-size: 0.82rem;
      ">
        <div style="color: #fbbf24; font-weight: bold; margin-bottom: 0.4rem; display: flex; justify-content: space-between;">
          <span>🧬 최종 의태 폼: Lv.${level} [${mimicCore}]</span>
          <span style="color: #34d399;">승천 완료</span>
        </div>
        <div style="color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;">
          <div>🗡️ 무기: <span style="color: #ffd700;">${weapon}</span></div>
          <div>👑 투구: <span style="color: #ffd700;">${helmet}</span></div>
          <div>🛡️ 방어구: <span style="color: #cbd5e1;">${armor}</span></div>
          <div>🛡️ 방패: <span style="color: #cbd5e1;">${shield}</span></div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button id="btn-ascension-hall-of-fame" class="modal-btn" style="
          flex: 1;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #ffffff;
          font-weight: bold;
          padding: 0.8rem 1.2rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        ">🏆 명예의 전당 보기</button>
        <button id="btn-ascension-main-menu" class="modal-btn" style="
          flex: 1;
          background: rgba(51, 65, 85, 0.8);
          color: #e2e8f0;
          font-weight: 600;
          padding: 0.8rem 1.2rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.15);
          cursor: pointer;
          font-size: 0.9rem;
        ">🏰 메인 메뉴로 이동</button>
      </div>
    </div>
  `;
}

/**
 * 명예의 전당 & 사망 묘비명 통합 모달 HTML 렌더링
 * @param {Array<Object>} records 
 * @param {string} [activeTab='hallOfFame'] - 'hallOfFame' | 'graveyard'
 * @returns {string} HTML String
 */
export function renderHallOfFameModalHTML(records = [], activeTab = 'hallOfFame') {
  const isHof = activeTab === 'hallOfFame';
  const displayRecords = isHof ? getHallOfFameRecords() : getGraveyardRecords();

  let listHTML = '';
  if (!displayRecords || displayRecords.length === 0) {
    listHTML = `
      <div style="padding: 3rem 1rem; text-align: center; color: #94a3b8; font-size: 0.9rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${isHof ? '📜' : '🪦'}</div>
        ${isHof ? '아직 승천에 성공한 영웅의 기록이 없습니다. 50F 모르고스를 물리치고 첫 번째 승천자가 되어보세요!' : '아직 사망한 모험가의 묘비가 없습니다.'}
      </div>
    `;
  } else {
    listHTML = displayRecords.map((rec, idx) => {
      const rankBadge = idx === 0 ? '🥇 1위' : (idx === 1 ? '🥈 2위' : (idx === 2 ? '🥉 3위' : `${idx + 1}위`));
      const score = (rec.score || 0).toLocaleString();
      const dateStr = rec.clearDate || rec.deathDate ? new Date(rec.clearDate || rec.deathDate).toLocaleDateString() : '-';

      if (isHof) {
        return `
          <div class="record-row hof-record-row" data-id="${rec.id}" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: ${idx < 3 ? 'rgba(251, 191, 36, 0.08)' : 'rgba(30, 41, 59, 0.4)'};
            border: 1px solid ${idx === 0 ? '#fbbf24' : 'rgba(255,255,255,0.06)'};
            border-radius: 10px;
            padding: 0.75rem 1rem;
            gap: 0.8rem;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 0.8rem; flex: 1; min-width: 0;">
              <span style="font-weight: 800; font-size: 0.95rem; color: ${idx === 0 ? '#fbbf24' : (idx === 1 ? '#e2e8f0' : (idx === 2 ? '#f59e0b' : '#94a3b8'))}; width: 48px;">
                ${rankBadge}
              </span>
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <span style="font-weight: bold; color: #f8fafc; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${rec.playerName} <span style="font-size: 0.75rem; color: #34d399; font-weight: normal;">(Lv.${rec.level || 50} ${rec.mimicCore || '의태'})</span>
                </span>
                <span style="font-size: 0.72rem; color: #94a3b8;">
                  ⏱️ ${rec.turns}턴 | ⚔️ ${rec.kills}킬 | 👑 유니크 ${rec.uniqueKills || 0}종 | 💎 유물 ${rec.artifactsCount || (rec.artifactsList ? rec.artifactsList.length : 0)}개
                </span>
                <span style="font-size: 0.68rem; color: #38bdf8; margin-top: 0.15rem;">
                  👉 클릭하여 캐릭터 정보/인벤토리/전투로그 보기
                </span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 800; color: #fbbf24; font-size: 1.05rem; font-family: monospace;">${score} PTS</div>
              <div style="font-size: 0.68rem; color: #64748b;">${dateStr}</div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="record-row graveyard-record-row" data-id="${rec.id}" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 10px;
            padding: 0.75rem 1rem;
            gap: 0.8rem;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div style="display: flex; align-items: center; gap: 0.8rem; flex: 1; min-width: 0;">
              <span style="font-size: 1.2rem;">🪦</span>
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <span style="font-weight: bold; color: #f8fafc; font-size: 0.9rem;">
                  ${rec.playerName} <span style="font-size: 0.75rem; color: #f87171;">(Lv.${rec.level || 1} - ${rec.floor || 1}F 사망)</span>
                </span>
                <span style="font-size: 0.72rem; color: #94a3b8; font-style: italic;">
                  "${rec.epitaph || '어둠 속에서 영면하다'}"
                </span>
                <span style="font-size: 0.68rem; color: #38bdf8; margin-top: 0.15rem;">
                  👉 클릭하여 캐릭터 정보/인벤토리/전투로그 보기
                </span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #e2e8f0; font-size: 0.95rem; font-family: monospace;">${score} PTS</div>
              <div style="font-size: 0.68rem; color: #64748b;">${dateStr}</div>
            </div>
          </div>
        `;
      }
    }).join('');
  }

  return `
    <div class="hall-of-fame-modal-content" style="
      background: #0f172a;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      max-width: 660px;
      width: 94%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin: 0 auto;
      color: #f8fafc;
    ">
      <!-- Modal Header & Tabs -->
      <div style="padding: 1.2rem 1.5rem 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 0.5rem;">
          <button id="tab-btn-hall-of-fame" class="modal-tab-btn" style="
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            border: 1px solid ${isHof ? '#fbbf24' : 'transparent'};
            background: ${isHof ? 'rgba(251, 191, 36, 0.15)' : 'transparent'};
            color: ${isHof ? '#fbbf24' : '#94a3b8'};
          ">🏆 명예의 전당 (Hall of Fame)</button>
          <button id="tab-btn-graveyard" class="modal-tab-btn" style="
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            border: 1px solid ${!isHof ? '#f87171' : 'transparent'};
            background: ${!isHof ? 'rgba(239, 68, 68, 0.15)' : 'transparent'};
            color: ${!isHof ? '#f87171' : '#94a3b8'};
          ">🪦 사망 묘비명 (Graveyard)</button>
        </div>
        <button id="btn-close-hall-of-fame" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
      </div>

      <!-- Sub-header Toolbar (Graveyard Mode Action Bar) -->
      ${!isHof ? `
      <div style="padding: 0.5rem 1.5rem; background: rgba(15, 23, 42, 0.6); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.78rem; color: #94a3b8;">⚰️ 사망한 모험가의 영면 기록 (${displayRecords.length}개)</span>
        <button id="btn-clear-graveyard" class="modal-btn" style="
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 0.3rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        ">🗑️ 묘비 기록 비우기</button>
      </div>
      ` : ''}

      <!-- Click Hint Bar -->
      <div style="padding: 0.4rem 1.5rem; background: rgba(56, 189, 248, 0.05); border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.72rem; color: #38bdf8; display: flex; align-items: center; gap: 0.4rem;">
        <span>ℹ️ 레코드를 클릭하면 상세 캐릭터 스펙, 최종 장비/인벤토리 및 사망/클리어 전투 로그를 조회할 수 있습니다.</span>
      </div>

      <!-- Records List -->
      <div id="hof-records-list" style="
        padding: 1rem 1.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        flex: 1;
      ">
        ${listHTML}
      </div>

      <!-- Footer Info -->
      <div style="padding: 0.8rem 1.5rem; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b;">
        <span>기록은 브라우저 로컬 저장소에 영구 보관됩니다.</span>
        <span>총 ${displayRecords.length}개 기록</span>
      </div>
    </div>
  `;
}

/**
 * 묘비명 렌더러 래퍼 (하위 호환)
 */
export function renderGraveyardModalHTML(records = []) {
  return renderHallOfFameModalHTML(records, 'graveyard');
}

/**
 * 명예의 전당 / 사망 묘비명 레코드 상세 인스펙터 모달 HTML 렌더링
 * @param {Object} record - 저장된 영웅/사망자 데이터 객체
 * @param {string} [activeDetailTab='stats'] - 'stats' | 'equipment' | 'logs'
 * @returns {string} HTML 문자열
 */
export function renderRecordDetailModalHTML(record = {}, activeDetailTab = 'stats') {
  const isVictory = Boolean(record.isVictory);
  const name = record.playerName || '이름 모를 모험가';
  const level = record.level || 1;
  const floor = record.floor || (isVictory ? 50 : 1);
  const turns = (record.turns || 1).toLocaleString();
  const kills = (record.kills || 0).toLocaleString();
  const uniqueKills = record.uniqueKills || (record.uniquesList ? record.uniquesList.length : 0);
  const artifactsCount = record.artifactsCount || (record.artifactsList ? record.artifactsList.length : 0);
  const mimicCore = record.mimicCore || '인간 여행자';
  const score = (record.score || 0).toLocaleString();
  const killer = record.killer || '정체불명의 적';
  const dateStr = record.clearDate || record.deathDate ? new Date(record.clearDate || record.deathDate).toLocaleString() : '-';

  // Stats fallback
  const rawStats = record.stats || {};
  const hp = rawStats.hp !== undefined ? rawStats.hp : (isVictory ? 500 : 0);
  const maxHp = rawStats.maxHp || (isVictory ? 500 : Math.max(1, level * 18));
  const hpPercent = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
  const str = rawStats.str || 10;
  const int = rawStats.int || 10;
  const wis = rawStats.wis || 10;
  const dex = rawStats.dex || 10;
  const con = rawStats.con || 10;
  const chr = rawStats.chr || 10;
  const ac = rawStats.ac !== undefined ? rawStats.ac : (level * 2);
  const bth = rawStats.bth !== undefined ? rawStats.bth : (50 + level * 2);
  const hitChance = rawStats.hitChance !== undefined ? rawStats.hitChance : Math.min(95, Math.max(5, Math.round((bth / (bth + ac)) * 100)));

  // Equipment slots
  const slotLabels = {
    weapon: { label: '주 무기 (Weapon)', char: '/', color: '#38bdf8' },
    shield: { label: '방패 (Shield)', char: ')', color: '#38bdf8' },
    bow:    { label: '원거리 활 (Bow)', char: '}', color: '#f59e0b' },
    quiver: { label: '화살통 (Quiver)', char: '=', color: '#38bdf8' },
    armor:  { label: '갑옷 (Armor)', char: '[', color: '#34d399' },
    helmet: { label: '투구 (Helmet)', char: ']', color: '#34d399' },
    gloves: { label: '장갑 (Gloves)', char: '(', color: '#34d399' },
    boots:  { label: '신발 (Boots)', char: ']', color: '#c084fc' },
    cloak:  { label: '망토 (Cloak)', char: '(', color: '#fb7185' },
    ring1:  { label: '반지 1 (Ring 1)', char: '=', color: '#a78bfa' },
    ring2:  { label: '반지 2 (Ring 2)', char: '=', color: '#a78bfa' },
    amulet: { label: '목걸이 (Amulet)', char: '"', color: '#ec4899' }
  };

  const rawEquipment = record.equipment || {};
  const finalEqLegacy = record.finalEquipment || {};

  // Inventory items
  const inventory = Array.isArray(record.inventory) ? record.inventory : [];

  // Recent logs
  const logs = Array.isArray(record.recentLogs) ? record.recentLogs : [];

  // -------------------------------------------------------------
  // TAB 1: STATS CONTENT
  // -------------------------------------------------------------
  let tabStatsHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- Hero/Death Header Banner -->
      <div style="
        background: ${isVictory ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(217, 119, 6, 0.1))' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(153, 27, 27, 0.1))'};
        border: 1px solid ${isVictory ? 'rgba(251, 191, 36, 0.35)' : 'rgba(239, 68, 68, 0.3)'};
        border-radius: 10px;
        padding: 0.9rem 1.2rem;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <span style="font-weight: 800; font-size: 1.1rem; color: ${isVictory ? '#fbbf24' : '#f87171'};">
            ${isVictory ? '👑 [발리노르 승천 영웅]' : '💀 [전사한 모험가]'} ${name}
          </span>
          <span style="font-size: 0.8rem; color: #94a3b8;">${dateStr}</span>
        </div>
        <div style="font-size: 0.84rem; color: #cbd5e1; line-height: 1.4;">
          ${isVictory 
            ? '✨ 50F 모르고스를 격파하고 발리노르의 영원한 빛(Light of Valinor)으로 승천하여 가운데땅의 영원한 수호자로 명예의 전당에 등재되었습니다.' 
            : `지하 <strong>${floor}층</strong>에서 <strong>[${killer}]</strong>에게 최후를 맞이하고 영면하였습니다.<br><span style="font-style: italic; color: #94a3b8;">"${record.epitaph || '어둠 속에서 영면하다.'}"</span>`}
        </div>
      </div>

      <!-- Core Adventure Statistics (8-Card Grid) -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">🧬 의태 폼</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #34d399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mimicCore}</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">🎖️ 최종 레벨</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #f8fafc;">Lv.${level} (${isVictory ? '50F 승천' : `${floor}F`})</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">⏱️ 소요 턴수</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #38bdf8;">${turns} 턴</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">🏆 모험 점수</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #fbbf24; font-family: monospace;">${score} PTS</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">⚔️ 몬스터 처치</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #f43f5e;">${kills} 마리</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">👑 유니크 토벌</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #eab308;">${uniqueKills} 종</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">💎 수집한 유물</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #a855f7;">${artifactsCount} 개</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.8rem;">
          <div style="font-size: 0.7rem; color: #94a3b8;">🎯 기본 적중률</div>
          <div style="font-size: 0.88rem; font-weight: bold; color: #10b981;">${hitChance}%</div>
        </div>
      </div>

      <!-- Combat Vitals & 6 Attributes -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <!-- Left: Health & Armor & Hit -->
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
          <div style="font-size: 0.8rem; font-weight: bold; color: #38bdf8; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.3rem;">
            🛡️ 전투 생존 및 명중 지표
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.76rem; margin-bottom: 0.2rem;">
              <span style="color: #94a3b8;">생명력 (HP)</span>
              <span style="font-weight: bold; color: ${hp > 0 ? '#34d399' : '#f87171'};">${hp} / ${maxHp}</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div style="width: ${hpPercent}%; height: 100%; background: ${hp > 0 ? '#34d399' : '#ef4444'};"></div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
            <span style="color: #94a3b8;">🛡️ 방어력 (AC):</span>
            <span style="font-weight: bold; color: #60a5fa; font-family: monospace;">+${ac}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
            <span style="color: #94a3b8;">⚔️ 명중 보정치 (BTH):</span>
            <span style="font-weight: bold; color: #fbbf24; font-family: monospace;">${bth}</span>
          </div>
        </div>

        <!-- Right: 6 Stats -->
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <div style="font-size: 0.8rem; font-weight: bold; color: #34d399; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.3rem;">
            📊 6대 핵심 능력치 (Attributes)
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; font-size: 0.78rem;">
            <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">힘 (STR):</span><span style="font-weight: bold; color: #f87171;">${str} (+${Math.floor(str / 10)})</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">지능 (INT):</span><span style="font-weight: bold; color: #60a5fa;">${int} (+${Math.floor(int / 10)})</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">지혜 (WIS):</span><span style="font-weight: bold; color: #c084fc;">${wis} (+${Math.floor(wis / 10)})</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">민첩 (DEX):</span><span style="font-weight: bold; color: #34d399;">${dex} (+${Math.floor(dex / 10)})</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">체력 (CON):</span><span style="font-weight: bold; color: #fbbf24;">${con} (+${Math.floor(con / 10)})</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">매력 (CHR):</span><span style="font-weight: bold; color: #f472b6;">${chr} (+${Math.floor(chr / 10)})</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // -------------------------------------------------------------
  // TAB 2: EQUIPMENT & INVENTORY CONTENT
  // -------------------------------------------------------------
  const renderItemCard = (slotKey, item, fallbackName) => {
    const meta = slotLabels[slotKey] || { label: slotKey, char: '?', color: '#cbd5e1' };
    if (!item && !fallbackName) {
      return `
        <div style="background: rgba(30, 41, 59, 0.35); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1rem; color: #475569; font-family: monospace; font-weight: bold; width: 22px; text-align: center;">${meta.char}</span>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <span style="font-size: 0.72rem; color: #64748b;">${meta.label}</span>
            <span style="font-size: 0.78rem; color: #475569; font-style: italic;">[비어있음]</span>
          </div>
        </div>
      `;
    }

    const itemName = item ? item.name : (fallbackName === '없음' ? null : fallbackName);
    if (!itemName || itemName === '없음') {
      return `
        <div style="background: rgba(30, 41, 59, 0.35); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1rem; color: #475569; font-family: monospace; font-weight: bold; width: 22px; text-align: center;">${meta.char}</span>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <span style="font-size: 0.72rem; color: #64748b;">${meta.label}</span>
            <span style="font-size: 0.78rem; color: #475569; font-style: italic;">[비어있음]</span>
          </div>
        </div>
      `;
    }

    const itemChar = item?.char || meta.char;
    const itemColor = item?.color || meta.color;
    
    let subDetails = [];
    if (item?.dice) subDetails.push(`⚔️ 주사위 ${item.dice}`);
    if (item?.baseAC) subDetails.push(`🛡️ AC +${item.baseAC}`);
    if (item?.upgradeLevel) subDetails.push(`(+${item.upgradeLevel})`);
    if (item?.charges !== null && item?.charges !== undefined) subDetails.push(`⚡ ${item.charges}회`);

    const subText = subDetails.length > 0 ? subDetails.join(' | ') : (item?.type || '장비');

    return `
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 1.15rem; color: ${itemColor}; font-family: monospace; font-weight: bold; width: 22px; text-align: center;">${itemChar}</span>
        <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
          <span style="font-size: 0.7rem; color: #94a3b8;">${meta.label}</span>
          <span style="font-size: 0.82rem; font-weight: bold; color: ${itemColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${itemName}</span>
          <span style="font-size: 0.68rem; color: #64748b;">${subText}</span>
        </div>
      </div>
    `;
  };

  const equipSlots = ['weapon', 'shield', 'bow', 'quiver', 'armor', 'helmet', 'gloves', 'boots', 'cloak', 'ring1', 'ring2', 'amulet'];
  const equipGridHTML = equipSlots.map(s => renderItemCard(s, rawEquipment[s], finalEqLegacy[s])).join('');

  let inventoryListHTML = '';
  if (inventory.length === 0) {
    inventoryListHTML = `
      <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.82rem; background: rgba(15,23,42,0.4); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.06);">
        소지하고 있던 인벤토리 아이템이 없습니다.
      </div>
    `;
  } else {
    inventoryListHTML = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; max-height: 180px; overflow-y: auto;">
        ${inventory.map(item => {
          const char = item.char || '?';
          const color = item.color || '#cbd5e1';
          const amountStr = item.amount && item.amount > 1 ? ` <span style="color:#60a5fa; font-weight:bold;">x${item.amount}</span>` : '';
          const chargesStr = item.charges !== null && item.charges !== undefined ? ` <span style="color:#fbbf24; font-size:0.7rem;">(${item.charges}회)</span>` : '';
          return `
            <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.4rem 0.6rem; display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-family: monospace; font-size: 1rem; color: ${color}; font-weight: bold; width: 18px; text-align: center;">${char}</span>
              <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                <span style="font-size: 0.78rem; font-weight: bold; color: ${color}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${item.name}${amountStr}${chargesStr}
                </span>
                <span style="font-size: 0.66rem; color: #64748b;">${item.type || '소지품'}${item.baseAC ? ` | AC +${item.baseAC}` : ''}${item.dice ? ` | ⚔️ ${item.dice}` : ''}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let tabEquipmentHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.9rem;">
      <!-- Equipment 12-Slot Section -->
      <div>
        <div style="font-size: 0.8rem; font-weight: bold; color: #38bdf8; margin-bottom: 0.4rem; display: flex; justify-content: space-between;">
          <span>⚔️ 최종 착용 장비 12슬롯 (Final Equipment)</span>
          <span style="font-size: 0.72rem; color: #94a3b8;">총 12 슬롯</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
          ${equipGridHTML}
        </div>
      </div>

      <!-- Inventory Bag Section -->
      <div>
        <div style="font-size: 0.8rem; font-weight: bold; color: #34d399; margin-bottom: 0.4rem; display: flex; justify-content: space-between;">
          <span>🎒 가방 소지품 목록 (Bag Inventory)</span>
          <span style="font-size: 0.72rem; color: #94a3b8;">${inventory.length}개 소지</span>
        </div>
        ${inventoryListHTML}
      </div>
    </div>
  `;

  // -------------------------------------------------------------
  // TAB 3: COMBAT LOGS CONTENT
  // -------------------------------------------------------------
  let tabLogsHTML = '';
  if (logs.length === 0) {
    tabLogsHTML = `
      <div style="padding: 3rem 1rem; text-align: center; color: #64748b; font-size: 0.85rem; background: rgba(3, 7, 18, 0.6); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.06);">
        📜 저장된 실시간 전투/시스템 로그가 없습니다.
      </div>
    `;
  } else {
    const typeColors = {
      combat: '#f87171',
      loot: '#34d399',
      system: '#94a3b8',
      danger: '#ef4444',
      heal: '#60a5fa'
    };

    const logLines = logs.map((entry, idx) => {
      const text = typeof entry === 'string' ? entry : (entry.text || '');
      const type = typeof entry === 'string' ? 'system' : (entry.type || 'system');
      const color = typeColors[type] || '#94a3b8';
      const lineNum = String(idx + 1).padStart(2, '0');

      return `
        <div style="display: flex; gap: 0.6rem; line-height: 1.35; font-size: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 0.15rem 0;">
          <span style="color: #475569; user-select: none; font-weight: bold;">${lineNum}</span>
          <span style="color: ${color}; word-break: break-all;">${text}</span>
        </div>
      `;
    }).join('');

    tabLogsHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.4rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; font-weight: bold; color: #f8fafc;">📜 직전 실시간 전투/이벤트 로그 (최근 ${logs.length}줄)</span>
          <span style="font-size: 0.72rem; color: #64748b;">최신순 하단 배열</span>
        </div>
        <div style="
          background: #030712;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-family: monospace;
          max-height: 380px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        ">
          ${logLines}
        </div>
      </div>
    `;
  }

  // Active tab selector
  let currentTabBody = tabStatsHTML;
  if (activeDetailTab === 'equipment') currentTabBody = tabEquipmentHTML;
  if (activeDetailTab === 'logs') currentTabBody = tabLogsHTML;

  return `
    <div class="record-detail-modal-container" style="
      background: #0b1120;
      border: 1px solid ${isVictory ? 'rgba(251, 191, 36, 0.4)' : 'rgba(239, 68, 68, 0.35)'};
      border-radius: 14px;
      box-shadow: 0 0 50px rgba(0,0,0,0.8), 0 0 20px ${isVictory ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.15)'};
      max-width: 680px;
      width: 95%;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin: 0 auto;
      color: #f8fafc;
      font-family: inherit;
    ">
      <!-- Modal Header -->
      <div style="
        padding: 1rem 1.4rem;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(15, 23, 42, 0.8);
      ">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.3rem;">${isVictory ? '🏆' : '🪦'}</span>
          <div>
            <span style="font-weight: 800; font-size: 1rem; color: #f8fafc;">
              [상세 모험 기록] ${name}
            </span>
            <span style="font-size: 0.72rem; color: ${isVictory ? '#fbbf24' : '#f87171'}; margin-left: 0.4rem; font-weight: bold;">
              ${isVictory ? '✨ 승천 완료' : `💀 ${floor}F 전사`}
            </span>
          </div>
        </div>
        <button id="btn-close-record-detail" style="
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 1.5rem;
          cursor: pointer;
          line-height: 1;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        ">&times;</button>
      </div>

      <!-- Detail Navigation Tabs -->
      <div style="
        display: flex;
        background: rgba(15, 23, 42, 0.5);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        padding: 0.4rem 1.4rem 0;
        gap: 0.4rem;
      ">
        <button id="detail-tab-stats" class="detail-tab-btn" style="
          padding: 0.5rem 1rem;
          border-radius: 8px 8px 0 0;
          font-size: 0.82rem;
          font-weight: bold;
          cursor: pointer;
          border: 1px solid ${activeDetailTab === 'stats' ? '#38bdf8' : 'transparent'};
          border-bottom: ${activeDetailTab === 'stats' ? '2px solid #38bdf8' : 'none'};
          background: ${activeDetailTab === 'stats' ? 'rgba(56, 189, 248, 0.15)' : 'transparent'};
          color: ${activeDetailTab === 'stats' ? '#38bdf8' : '#94a3b8'};
        ">📊 캐릭터 스펙</button>

        <button id="detail-tab-equipment" class="detail-tab-btn" style="
          padding: 0.5rem 1rem;
          border-radius: 8px 8px 0 0;
          font-size: 0.82rem;
          font-weight: bold;
          cursor: pointer;
          border: 1px solid ${activeDetailTab === 'equipment' ? '#34d399' : 'transparent'};
          border-bottom: ${activeDetailTab === 'equipment' ? '2px solid #34d399' : 'none'};
          background: ${activeDetailTab === 'equipment' ? 'rgba(52, 211, 153, 0.15)' : 'transparent'};
          color: ${activeDetailTab === 'equipment' ? '#34d399' : '#94a3b8'};
        ">🎒 최종 장비 & 인벤토리</button>

        <button id="detail-tab-logs" class="detail-tab-btn" style="
          padding: 0.5rem 1rem;
          border-radius: 8px 8px 0 0;
          font-size: 0.82rem;
          font-weight: bold;
          cursor: pointer;
          border: 1px solid ${activeDetailTab === 'logs' ? '#fbbf24' : 'transparent'};
          border-bottom: ${activeDetailTab === 'logs' ? '2px solid #fbbf24' : 'none'};
          background: ${activeDetailTab === 'logs' ? 'rgba(251, 191, 36, 0.15)' : 'transparent'};
          color: ${activeDetailTab === 'logs' ? '#fbbf24' : '#94a3b8'};
        ">📜 마지막 전투 로그 (${logs.length})</button>
      </div>

      <!-- Tab Body Container -->
      <div id="record-detail-body" style="
        padding: 1.2rem 1.4rem;
        overflow-y: auto;
        flex: 1;
      ">
        ${currentTabBody}
      </div>

      <!-- Footer Action -->
      <div style="
        padding: 0.8rem 1.4rem;
        background: rgba(15, 23, 42, 0.8);
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span style="font-size: 0.74rem; color: #64748b;">
          💡 <strong>ESC</strong> 키를 누르거나 닫기 버튼을 클릭하여 목록으로 돌아갑니다.
        </span>
        <button id="btn-close-record-detail-bottom" class="modal-btn" style="
          background: rgba(51, 65, 85, 0.8);
          color: #e2e8f0;
          font-weight: 600;
          padding: 0.4rem 1rem;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.15);
          cursor: pointer;
          font-size: 0.8rem;
        ">닫기 [ESC]</button>
      </div>
    </div>
  `;
}

export class AscensionModalView {
  static showVictory(victoryData, onConfirm = null) {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('ascension-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ascension-modal-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      overlay.style.backdropFilter = 'blur(10px)';
      overlay.style.zIndex = '9999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = renderAscensionModalHTML(victoryData);
    overlay.classList.remove('hidden');

    const btnHof = document.getElementById('btn-ascension-hall-of-fame');
    if (btnHof) {
      btnHof.onclick = () => {
        AscensionModalView.showHallOfFame('hallOfFame');
      };
    }

    const btnMenu = document.getElementById('btn-ascension-main-menu');
    if (btnMenu) {
      btnMenu.onclick = () => {
        overlay.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm();
      };
    }
  }

  static showHallOfFame(activeTab = 'hallOfFame') {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('hof-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hof-modal-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      overlay.style.backdropFilter = 'blur(10px)';
      overlay.style.zIndex = '10000';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      document.body.appendChild(overlay);
    }

    const render = (tab) => {
      overlay.innerHTML = renderHallOfFameModalHTML(null, tab);
      overlay.classList.remove('hidden');

      const btnClose = document.getElementById('btn-close-hall-of-fame');
      if (btnClose) btnClose.onclick = () => overlay.classList.add('hidden');

      const tabHof = document.getElementById('tab-btn-hall-of-fame');
      if (tabHof) tabHof.onclick = () => render('hallOfFame');

      const tabGrave = document.getElementById('tab-btn-graveyard');
      if (tabGrave) tabGrave.onclick = () => render('graveyard');

      const btnClearGrave = document.getElementById('btn-clear-graveyard');
      if (btnClearGrave) {
        btnClearGrave.onclick = () => {
          const doClear = typeof confirm === 'function' ? confirm('모든 사망 묘비명 기록을 초기화하시겠습니까?') : true;
          if (doClear) {
            clearGraveyardRecords();
            render('graveyard');
          }
        };
      }

      // 각 레코드 행 클릭 시 상세 인스펙터 모달 오픈
      const rows = overlay.querySelectorAll('.record-row');
      rows.forEach(row => {
        row.onclick = () => {
          const recId = row.getAttribute('data-id');
          const records = tab === 'hallOfFame' ? getHallOfFameRecords() : getGraveyardRecords();
          const rec = records.find(r => String(r.id) === String(recId));
          if (rec) {
            AscensionModalView.showRecordDetailModal(rec, 'stats');
          }
        };
      });
    };

    render(activeTab);
  }

  /**
   * 상세 레코드 인스펙터 팝업 모달 표시
   * @param {Object} record - 조회할 레코드 객체
   * @param {string} [activeTab='stats'] - 기본 탭
   */
  static showRecordDetailModal(record, activeTab = 'stats') {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('record-detail-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'record-detail-modal-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
      overlay.style.backdropFilter = 'blur(10px)';
      overlay.style.zIndex = '10001';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      document.body.appendChild(overlay);
    }

    let escHandler = null;

    const closeModal = () => {
      overlay.classList.add('hidden');
      if (escHandler) {
        window.removeEventListener('keydown', escHandler);
        escHandler = null;
      }
    };

    const render = (tab) => {
      overlay.innerHTML = renderRecordDetailModalHTML(record, tab);
      overlay.classList.remove('hidden');

      const btnClose = document.getElementById('btn-close-record-detail');
      if (btnClose) btnClose.onclick = closeModal;

      const btnCloseBottom = document.getElementById('btn-close-record-detail-bottom');
      if (btnCloseBottom) btnCloseBottom.onclick = closeModal;

      const tabStats = document.getElementById('detail-tab-stats');
      if (tabStats) tabStats.onclick = () => render('stats');

      const tabEq = document.getElementById('detail-tab-equipment');
      if (tabEq) tabEq.onclick = () => render('equipment');

      const tabLogs = document.getElementById('detail-tab-logs');
      if (tabLogs) tabLogs.onclick = () => render('logs');
    };

    escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', escHandler);

    render(activeTab);
  }

  static close() {
    if (typeof document === 'undefined') return;
    const o1 = document.getElementById('ascension-modal-overlay');
    if (o1) o1.classList.add('hidden');
    const o2 = document.getElementById('hof-modal-overlay');
    if (o2) o2.classList.add('hidden');
    const o3 = document.getElementById('record-detail-modal-overlay');
    if (o3) o3.classList.add('hidden');
  }
}
