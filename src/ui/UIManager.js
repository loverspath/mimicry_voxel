/**
 * @module UIManager
 * @category ui
 * @description 게임 클라이언트 DOM 모달, HUD 상태바, 전투 로그 및 사용자 인터랙션 뷰 라우팅 중앙 관리자
 * @purity DOM Manager / State Store
 * @dependencies InventoryView.js, InspectModalView.js, HUDView.js, MonsterLoreView.js, AscensionModalView.js
 * @exports UIManager
 */

import { renderInventorySlotHTML, renderItemDetailHTML, renderTransferMaterialHTML, renderActiveCoreDetailsHTML } from './InventoryView.js';
import { renderMonsterInspectHTML } from './InspectModalView.js';
import { renderPlayerStatusPanelHTML, renderPlayerDetailsHTML, renderSkillTreeHTML, renderMasteryDetailsHTML, updateTopBarHUD, formatCombatLogHTML } from './HUDView.js';
import { renderMonsterLoreModalHTML, renderMonsterBestiaryHTML, renderUniqueChecklistHTML, renderLoreMasterySummaryHTML } from './MonsterLoreView.js';
import { renderAscensionModalHTML, renderHallOfFameModalHTML, renderGraveyardModalHTML, renderRecordDetailModalHTML, AscensionModalView, saveAscensionRecord, getHallOfFameRecords, saveGraveyardRecord, getGraveyardRecords } from './AscensionModalView.js';

export class UIManager {
  /**
   * UI 매니저 인스턴스 생성
   * @param {Object} [game=null] - 게임 인스턴스 참조
   */
  constructor(game = null) {
    this.game = game;
    const getEl = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
    this.combatLog = getEl('combat-log');
    this.logModalList = getEl('log-modal-list');
    this.inventoryModal = getEl('inventory-modal');
    this.inventoryList = getEl('inventory-list');
    this.playerStatusPanel = getEl('player-status-panel');
    this.itemDetail = getEl('item-detail');
    this.logModal = getEl('log-modal');
    this.monsterInspectModal = getEl('monster-inspect-modal');
    this.monsterInspectBody = getEl('monster-inspect-body');
  }

  /**
   * 상단 상태바(SPD, HP, Floor) 갱신
   * @param {Object} player - 플레이어 객체
   * @param {number} floor - 현재 던전 층수
   */
  updateTopBar(player, floor) {
    if (!player) return;
    updateTopBarHUD(player, floor);
  }

  /**
   * 전투/시스템 로그창 및 로그 모달에 새 메시지 추가
   * @param {string} text - 출력할 로그 메시지
   * @param {string} [type='system'] - 로그 유형 ('combat', 'loot', 'system', 'danger', 'heal')
   */
  addLogEntry(text, type = 'system') {
    if (this.combatLog) {
      const p = document.createElement('p');
      p.className = `log-entry ${type}`;
      p.innerHTML = text;
      this.combatLog.appendChild(p);

      // 최대 30개 유지
      while (this.combatLog.children.length > 30) {
        this.combatLog.removeChild(this.combatLog.firstChild);
      }
      this.combatLog.scrollTop = this.combatLog.scrollHeight;
    }

    if (this.logModalList) {
      const p = document.createElement('div');
      p.className = `log-entry ${type}`;
      p.style.fontSize = '0.78rem';
      p.style.lineHeight = '1.35';
      p.innerHTML = text;
      this.logModalList.appendChild(p);
      this.logModalList.scrollTop = this.logModalList.scrollHeight;
    }
  }

  /**
   * 인벤토리 모달 열기 및 리스트 렌더링
   * @param {Object} player - 플레이어 객체
   * @param {Function} [onSlotClick=null] - 슬롯 클릭 콜백
   */
  openInventory(player, onSlotClick = null) {
    if (!this.inventoryModal || !player) return;
    this.inventoryModal.classList.remove('hidden');
    this.renderInventoryGrid(player, onSlotClick);
  }

  /**
   * 인벤토리 모달 닫기
   */
  closeInventory() {
    if (this.inventoryModal) {
      this.inventoryModal.classList.add('hidden');
    }
  }

  /**
   * 인벤토리 25개 슬롯 그리드 렌더링
   * @param {Object} player
   * @param {Function} [onSlotClick=null]
   */
  renderInventoryGrid(player, onSlotClick = null) {
    if (!this.inventoryList) return;
    this.inventoryList.innerHTML = '';

    const maxSlots = Math.max(24, (player.inventory && player.inventory.length) || 0);
    for (let i = 0; i < maxSlots; i++) {
      const item = player.inventory[i] || null;
      const slotEl = document.createElement('div');
      slotEl.className = 'inventory-slot';
      
      const { html, isEquipped } = renderInventorySlotHTML(item, player, i);
      if (isEquipped) slotEl.classList.add('equipped');
      slotEl.innerHTML = html;

      if (item && onSlotClick) {
        slotEl.addEventListener('click', () => onSlotClick(item, i));
      }
      this.inventoryList.appendChild(slotEl);
    }

    if (this.playerStatusPanel) {
      this.playerStatusPanel.innerHTML = renderPlayerStatusPanelHTML(player);
    }
  }

  /**
   * 아이템 상세 뷰 렌더링
   */
  showItemDetail(item, player, isEquipped, isSubCore1, isSubCore2, hasDuplicate, hasOtherCore) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderItemDetailHTML(
      item, player, isEquipped, isSubCore1, isSubCore2, hasDuplicate, hasOtherCore
    );
  }

  /**
   * 장착 중인 액티브 코어 상세 정보 모달 표시
   * @param {Object} player - 플레이어 객체
   */
  showActiveCoreDetails(player) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderActiveCoreDetailsHTML(player);
  }

  /**
   * 주인공 상세 스탯창 렌더링
   */
  showPlayerDetails(player) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderPlayerDetailsHTML(player);
  }

  /**
   * 몬스터 48px 피킹 관찰 모달 표시
   * @param {Object} monster - 대상 몬스터
   */
  showMonsterInspect(monster) {
    if (!this.monsterInspectModal || !this.monsterInspectBody) return;
    this.monsterInspectBody.innerHTML = renderMonsterInspectHTML(monster);
    this.monsterInspectModal.classList.remove('hidden');

    const okBtn = document.getElementById('monster-modal-ok-btn');
    if (okBtn) {
      okBtn.onclick = () => this.hideMonsterInspect();
    }
  }

  /**
   * 몬스터 관찰 모달 닫기
   */
  hideMonsterInspect() {
    if (this.monsterInspectModal) {
      this.monsterInspectModal.classList.add('hidden');
    }
  }

  /**
   * 몬스터 의태 고유 스킬 및 숙련도 표시
   */
  showSkillTree(player) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderSkillTreeHTML(player);
  }

  /**
   * 무기 마스터리 및 로어 도감 표시
   */
  showMasteryDetails(player) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderMasteryDetailsHTML(player);
  }

  /**
   * TomeNET 스타일 몬스터 로어 및 유니크 처치 체크리스트 모달 표시
   * @param {Object} player - 플레이어 인스턴스
   * @param {string} [activeTab='lore'] - 활성화할 탭 ('lore', 'unique', 'mastery')
   * @param {Object} [options={}] - 필터/검색 옵션
   */
  showMonsterLoreModal(player, activeTab = 'lore', options = {}) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderMonsterLoreModalHTML(player, activeTab, options);
  }

  /**
   * 코어 수치 계승 선택창 표시
   */
  showTransferMaterial(targetItem, otherCores) {
    if (!this.itemDetail) return;
    this.itemDetail.innerHTML = renderTransferMaterialHTML(targetItem, otherCores);
  }

  /**
   * 50F 모르고스 토벌 승천(Ascension) 엔딩 컷씬 모달 표시
   * @param {Object} victoryData - 승리 통계 데이터
   * @param {Function} [onConfirm=null] - 확인 콜백
   */
  showAscensionModal(victoryData, onConfirm = null) {
    AscensionModalView.showVictory(victoryData, onConfirm);
  }

  /**
   * 승천 모달 닫기
   */
  hideAscensionModal() {
    AscensionModalView.close();
  }

  /**
   * 명예의 전당 및 사망 묘비명 모달 표시
   * @param {string} [activeTab='hallOfFame'] - 'hallOfFame' | 'graveyard'
   */
  showHallOfFameModal(activeTab = 'hallOfFame') {
    AscensionModalView.showHallOfFame(activeTab);
  }

  /**
   * 명예의 전당 모달 닫기
   */
  hideHallOfFameModal() {
    AscensionModalView.close();
  }

  /**
   * 사망 묘비명 모달 직접 표시
   */
  showGraveyardModal() {
    AscensionModalView.showHallOfFame('graveyard');
  }

  /**
   * 명예의 전당 / 사망 묘비명 레코드 상세 인스펙터 모달 표시
   * @param {Object} record - 레코드 데이터
   * @param {string} [activeTab='stats'] - 'stats' | 'equipment' | 'logs'
   */
  showRecordDetailModal(record, activeTab = 'stats') {
    AscensionModalView.showRecordDetailModal(record, activeTab);
  }
}
