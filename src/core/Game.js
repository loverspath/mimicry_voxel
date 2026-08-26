/**
 * @module Game
 * @category core
 * @description 미미크리 로그라이크 핵심 게임 루프, 턴 스케줄링, 엔티티 상호작용 및 UI 모달 이벤트 통합 조율 오케스트레이터
 * @purity State Store
 * @dependencies Map.js, Player.js, Input.js, Renderer.js, Voxel3DRenderer.js, Classic2DAsciiRenderer.js, Item.js, Monster.js, Tags.js, Skills.js, UIHelper.js, Spawner.js, SaveSystem.js, CombatSystem.js, Effects.js, VirtualController.js
 * @exports Game
 */

import { Map } from "../map/Map.js";
import { Player } from "../entities/Player.js";
import { Input } from "./Input.js";
import { Renderer } from "./Renderer.js";
import { Voxel3DRenderer } from "../renderer/Voxel3DRenderer.js";
import { Classic2DAsciiRenderer } from "../renderer/Classic2DAsciiRenderer.js";
import { Item } from "../entities/Item.js";
import { Monster } from "../entities/Monster.js";
import {
  PREFIX_TAGS,
  SUFFIX_TAGS,
  determineRarity,
  getRarityColor,
} from "../entities/Tags.js";
import { renderSkillListHTML } from "./Skills.js";
import {
  renderItemDetailHTML,
  renderPlayerDetailsHTML,
  renderMonsterInspectHTML,
  renderPlayerStatusPanelHTML,
  renderActiveCoreDetailsHTML,
  renderSkillTreeHTML,
  renderInventorySlotHTML,
  renderTransferMaterialHTML,
  renderMasteryDetailsHTML,
  updateFloatingAutoFireButton,
} from "./UIHelper.js";
import { SaveSystem, SAVE_SLOTS } from "./SaveSystem.js";
import { CombatSystem } from "./CombatSystem.js";
import { Spawner } from "./Spawner.js";
import {
  MONSTER_SPECIES,
  getSpeciesConfig,
  normalizeCoreName,
} from "../entities/MonsterRegistry.js";
import {
  MeleeSlashEffect,
  ProjectileEffect,
  ConeBreathEffect,
  FloatingTextEffect,
} from "./Effects.js";
import { eventBus } from "../events/EventBus.js";
import { GameEvents } from "../events/GameEvents.js";
import { saveGraveyardRecord, AscensionModalView, serializeCombatStats, serializeEquipmentSlots, serializeInventoryItems, serializeRecentLogs } from "../ui/AscensionModalView.js";
import { bossPhaseEngine } from "../systems/BossPhaseEngine.js";
import { uniqueMonsterManager } from "../systems/UniqueMonsterManager.js";
import { TomeDeviceEngine } from "../systems/TomeDeviceEngine.js";
import { DungeonValueBudgetEngine } from "../systems/DungeonValueBudgetEngine.js";
import { LootSystem } from "./LootSystem.js";

const getConfigByName = (name) =>
  Object.values(MONSTER_SPECIES).find((c) => c.name === name) ||
  getSpeciesConfig("HUMAN");

// Setup local aliases for minified variable references to prevent ReferenceError crashes
const t = Map;
const x = Player;
const S = Input;
const C = Renderer;
const V = CombatSystem;
const H = Spawner;
const I = SaveSystem;
const F = SAVE_SLOTS;
const N = renderInventorySlotHTML;
const k = renderPlayerStatusPanelHTML;
const A = renderActiveCoreDetailsHTML;
const E = renderPlayerDetailsHTML;
const j = renderSkillTreeHTML;
const h = renderSkillListHTML;
const o = determineRarity;
const i = getRarityColor;
const D = renderMonsterInspectHTML;
const P = renderTransferMaterialHTML;
const O = renderItemDetailHTML;

// Bundle mappings
const W = t;
const G = x;
const K = S;
const q = C;
const J = V;
const Y = H;
const X = I;
const Z = F;
const Q = N;
const ee = k;
const te = A;
const ne = E;
const re = j;
const $ = normalizeCoreName;
const ie = h;
const ae = o;
const oe = i;
const se = D;
const ce = P;

export class Game {
  constructor() {
    this.currentSlot = 'slot1';
    this.isMainMenuOpen = true;
    this.isGameOver = false;
    this._isHandlingDeath = false;
    this.logHistory = [{ text: 'Welcome to Mimicry.', type: 'system' }];
    this.isLogModalOpen = false;
    this.isOptionsOpen = false;
    this.options = { autoResize: true };
    this.tileSize = 20;
    this.floor = 1;
    this.floorDanger = DungeonValueBudgetEngine.calculateFloorDanger(this.floor);
    const initialDim = DungeonValueBudgetEngine.calculateMapDimensions(this.floor);
    this.mapWidth = initialDim.width;
    this.mapHeight = initialDim.height;
    this.transitionAlpha = 0;
    this.lastTime = 0;
    this.playerTurn = true;
    this.moveCooldown = 0;
    this.map = new W(this.mapWidth, this.mapHeight, this.floor, { maxRooms: initialDim.maxRooms });
    this.player = new G(this.map.startingPosition.x, this.map.startingPosition.y);
    this.input = new K();

    const urlParams = typeof window !== "undefined" && window.location ? new URLSearchParams(window.location.search) : null;
    const modeParam = urlParams ? urlParams.get("mode") : null;
    const savedMode = typeof localStorage !== "undefined" ? localStorage.getItem("mimicry_render_mode") : null;
    this.renderMode = modeParam === "ascii" ? "ascii" : (savedMode === "ascii" && modeParam !== "voxel" ? "ascii" : "voxel");
    this.renderer = this.renderMode === "ascii" ? new Classic2DAsciiRenderer("game-canvas", this.tileSize) : new Voxel3DRenderer("game-canvas", this.tileSize);

    this.uiHp = document.getElementById("ui-hp");
    this.uiFloor = document.getElementById("ui-floor");
    this.combatLog = document.getElementById("combat-log");
    this.isInventoryOpen = false;
    this.selectedItem = null;
    this.contextItem = null;
    this.standingItem = null;
    this.standingStairs = false;
    this.standingUpStairs = false;
    this.playerBreathCooldown = 0;
    this.items = [];
    this.monsters = [];
    this.effects = [];
    this.inspectingMonster = null;
    this.isInspectModalDirty = true;
    this.spawnFloorContent();
    this.loadOptions();
    this.applyOptions();
    this.bindModalEvents();
    this.updateRenderModeButton();
    this.updateZoomButton();

    window.addEventListener("resize", () => this.resizeGame());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.resizeGame(), 200);
    });
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartTime = 0;

    const onPointerDown = (ev) => {
      pointerStartX = ev.clientX || (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
      pointerStartY = ev.clientY || (ev.touches && ev.touches[0] ? ev.touches[0].clientY : 0);
      pointerStartTime = Date.now();
    };

    const onPointerUp = (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest('#top-bar, #virtual-controller, .modal-content, #context-menu, #combat-log')) return;
      const endX = ev.clientX || (ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0].clientX : 0);
      const endY = ev.clientY || (ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0].clientY : 0);
      const dist = Math.hypot(endX - pointerStartX, endY - pointerStartY);
      const dt = Date.now() - pointerStartTime;

      if (dist < 14 && dt < 450) {
        this.handleCanvasClick({ clientX: endX, clientY: endY });
      }
    };

    const containerEl = document.getElementById("game-container") || this.renderer.canvas;
    containerEl.addEventListener("pointerdown", onPointerDown);
    containerEl.addEventListener("pointerup", onPointerUp);
    this.renderer.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));

    // Keyboard ESC to close inspect modal
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const mModal = document.getElementById("monster-modal");
        if (mModal && !mModal.classList.contains("hidden")) {
          mModal.classList.add("hidden");
          this.inspectingMonster = null;
        }
      }
      if (e.key === "t" || e.key === "T") {
        this.toggleAutoFire();
      }
    });

    let e = document.getElementById("btn-save");
    e && (e.onclick = () => this.saveGame());
    let t = document.getElementById("btn-load");
    t && (t.onclick = () => this.loadGame());
  }

  toggleAutoFire() {
    if (!this.player) return;
    const newState = this.player.toggleAutoFire();
    this.addLogEntry(`[Archery] 🏹 원거리 자동사격이 [${newState ? 'ON' : 'OFF'}](으)로 전환되었습니다.`, `system`);
    this.updateUI();
    return newState;
  }
  start() {
    (this.updateUI(),
      this.showMainMenu(),
      this.runTurnLoop(),
      requestAnimationFrame((e) => this.loop(e)));
  }
  loop(e) {
    let t = e - this.lastTime;
    ((this.lastTime = e),
      this.update(t),
      this.render(),
      requestAnimationFrame((e) => this.loop(e)));
  }
  update(e) {
    if (!this.isMainMenuOpen) {
      this.player.update(e);
      for (let t of this.monsters) t.update && t.update(e);
      if (
        ((this.effects = this.effects.filter((t) => t.update(e))),
        this.transitionAlpha > 0 &&
          ((this.transitionAlpha -= e / 600),
          this.transitionAlpha < 0 && (this.transitionAlpha = 0)),
        this.input.isActionActive(`INVENTORY`))
      ) {
        (this.toggleInventory(), this.input.clear());
        return;
      }
      if (this.input.isActionActive(`COMBAT_LOG`)) {
        (this.toggleLogModal(), this.input.clear());
        return;
      }
      if (this.input.isActionActive(`AUTOFIRE`)) {
        (this.toggleAutoFire(), this.input.clear());
        return;
      }
    }
    if (
      !this.isMainMenuOpen &&
      !this.isInventoryOpen &&
      !this.isGameOver &&
      !this._isHandlingDeath &&
      (this.moveCooldown > 0 && (this.moveCooldown -= e),
      this.playerTurn && this.moveCooldown <= 0)
    ) {
      let e = 0,
        t = 0,
        n = !1;
      if (
        (this.input.isActionActive(`MOVE_N`) && (t = -1),
        this.input.isActionActive(`MOVE_NE`) && ((e = 1), (t = -1)),
        this.input.isActionActive(`MOVE_E`) && (e = 1),
        this.input.isActionActive(`MOVE_SE`) && ((e = 1), (t = 1)),
        this.input.isActionActive(`MOVE_S`) && (t = 1),
        this.input.isActionActive(`MOVE_SW`) && ((e = -1), (t = 1)),
        this.input.isActionActive(`MOVE_W`) && (e = -1),
        this.input.isActionActive(`MOVE_NW`) && ((e = -1), (t = -1)),
        e !== 0 || t !== 0)
      ) {
        let r = this.player.x + e,
          i = this.player.y + t,
          a = this.monsters.find((e) => e.x === r && e.y === i);
        a
          ? (this.attackMonster(this.player, a), (n = !0))
          : (n = this.player.move(e, t, this.map));
      } else if (this.input.isActionActive(`WAIT`)) {
        n = !0;
        if (this.player.stats.hp < this.player.stats.maxHp) {
          let waitHealAmt = 0;
          let logs = [];
          
          const activeTags = this.player.compileActiveTags();
          const conVal = this.player.getEffectiveStat('con');
          const conMod = Math.floor(conVal / 10);
          
          // WAIT_HEAL (대기 재생 가산 스택)
          const waitHealStacks = activeTags["WAIT_HEAL"] || 0;
          if (waitHealStacks > 0) {
            const amount = waitHealStacks * (1 + Math.floor(conMod * 0.2));
            waitHealAmt += amount;
            logs.push(`[Skill] 대기 재생(WAIT_HEAL x${waitHealStacks}) 효과로 체력 ${amount}을 회복했습니다.`);
          }
          
          if (waitHealAmt > 0) {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + waitHealAmt);
            logs.forEach(log => this.addLogEntry(`${log} (HP: ${this.player.stats.hp}/${this.player.stats.maxHp})`, `loot`));
          }
        }
      }
      else if (this.input.isActionActive(`INTERACT`))
        if (this.standingItem) {
          let e = this.standingItem;
          this.player.pickupItem(e);
          let t = this.items.indexOf(e);
          (t !== -1 && this.items.splice(t, 1),
            (this.standingItem = null),
            this.addLogEntry(
              `[Loot] ${e.name}을(를) 주워 소지품에 넣었습니다. (I 키나 모바일 INV 버튼으로 가방을 열어 장착하세요)`,
              `system`,
            ),
            (n = !0));
        } else
          this.standingStairs
            ? (this.nextFloor(), (n = !0))
            : this.standingUpStairs && (this.prevFloor(), (n = !0));
      if (n) {
        // REGEN_UNIT (턴당 자연 재생)
        const activeTags = this.player.compileActiveTags();
        const regenStacks = activeTags["REGEN_UNIT"] || 0;
        if (regenStacks > 0 && this.player.stats.hp < this.player.stats.maxHp) {
          const conVal = this.player.getEffectiveStat('con');
          const conMod = Math.floor(conVal / 10);
          const regenAmt = regenStacks * (1 + Math.floor(conMod * 0.1));
          this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + regenAmt);
          this.addLogEntry(`[Skill] 자연 재생(REGEN_UNIT x${regenStacks}) 효과로 체력이 +${regenAmt} 자동 회복되었습니다. (HP: ${this.player.stats.hp}/${this.player.stats.maxHp})`, `loot`);
        }

        if (
          (CombatSystem.checkAndCastAutoSkills(this, this.player),
          CombatSystem.tryAutoRangedAttack(this, this.player),
          this.triggerActiveSkills(),
          this.checkItemCollision(),
          (this.player.energy -= 100),
          (this.playerTurn = !1),
          (this.moveCooldown = 150),
          TomeDeviceEngine.tickTimeouts(this.player.inventory),
          this.player.tickOverload((e, t) => this.addLogEntry(e, t)))
        ) {
          this.handlePlayerDeath();
          return;
        }
        if (
          (this.player.manaShield &&
            this.player.manaShield > 0 &&
            (this.player.manaShieldDuration--,
            this.player.manaShieldDuration <= 0 &&
              ((this.player.manaShield = 0),
              this.addLogEntry(
                `[Skill] 👼 나의 마나 실드가 지속시간 만료로 소멸했습니다.`,
                `system`,
              ))),
          this.player.tickDebuffs((e, t) => this.addLogEntry(e, t)))
        ) {
          this.handlePlayerDeath();
          return;
        }
        if (this.isGameOver || this._isHandlingDeath) return;
        (this.saveGame(!0), this.runTurnLoop());
      }
    }
  }
  tickGlobalEnergy() {
    // Cache player speed to avoid calling the expensive getter (compileActiveTags) every tick
    if (this._cachedPlayerSpeed === undefined) {
      this._cachedPlayerSpeed = this.player.speed;
      this.updatePlayerLightRange();
      this._cachedLightRange = Math.max(12, this.player.lightRange);
    }
    this.player.energy += this._cachedPlayerSpeed;
    let e = this._cachedLightRange;
    for (let t of this.monsters) {
      let n = this.player.x - t.x,
        r = this.player.y - t.y;
      if (Math.sqrt(n * n + r * r) <= e || t.isAggroed) {
        // Cache monster speed to avoid recalculating compileActiveTags per tick
        if (t._cachedSpeed === undefined) {
          t._cachedSpeed = t.speed;
        }
        t.energy += t._cachedSpeed;
      }
    }
  }
  runTurnLoop() {
    if (this.isGameOver || this._isHandlingDeath) return;
    // Clear speed caches at start of turn processing
    this._cachedPlayerSpeed = undefined;
    this._cachedLightRange = undefined;
    for (let m of this.monsters) {
      m._cachedSpeed = undefined;
    }
    this._loopState = { e: 0, globalTicks: 0, monsterActCount: 0 };
    this._runTurnLoopChunk();
  }
  _runTurnLoopChunk() {
    if (this.isGameOver || this._isHandlingDeath) return;
    const state = this._loopState;
    if (!state) return;
    const startTime = performance.now();
    const MAX_CHUNK_MS = 12; // Yield to browser after 12ms to prevent UI freeze
    for (; state.e < 1e3; ) {
      if (this.isGameOver || this._isHandlingDeath) return;
      if (this.player.stats.hp <= 0) {
        this.handlePlayerDeath();
        return;
      }
      if ((state.e++, this.player.speed <= 0)) {
        ((this.playerTurn = !0), this.updateUI());
        return;
      }
      if (this.player.energy >= 100) {
        if (this.player.debuffs && this.player.debuffs.paralyzed) {
          ((this.player.debuffs.paralyzed = !1),
            (this.player.energy -= 100),
            this.addLogEntry(
              `[Debuff] ⚡ 마비 상태로 인해 이번 턴 행동을 건너뛰었습니다!`,
              `combat`,
            ),
            this.player.debuffs.frost > 0 &&
              (this.player.debuffs.frost--,
              this.player.debuffs.frost === 0 &&
                this.addLogEntry(
                  `[Debuff] ❄️ 빙결 감속 상태가 해제되었습니다!`,
                  `system`,
                )));
          continue;
        }
        ((this.playerTurn = !0), this.updateUI());
        return;
      }
      let t = null,
        n = -1;
      for (let e = 0; e < this.monsters.length; e++) {
        let r = this.monsters[e];
        r.energy >= 100 && r.energy > n && ((n = r.energy), (t = r));
      }
      if (t) {
        try {
          this.handleMonsterBuffsAndHeals(t);
          t.act(
            this.player,
            this.map,
            (e, t) => this.isMonsterAt(e, t),
            (e, t) => this.attackPlayer(e, t),
            (e, t, n, r) => this.useMonsterBreath(e, t, n, r),
            (e, t) => this.addLogEntry(e, t),
          );
        } catch (err) {
          console.error("몬스터 행동 중 오류 발생:", err);
          this.addLogEntry(`[Debug] 몬스터 행동 오류: ${err.message}. 스택: ${err.stack ? err.stack.split('\n')[1] : ''}`, "system");
          // 오류 발생 시에도 무한 루프나 프리징을 막기 위해 강제 복구
          this.player.energy = 100;
          this.playerTurn = true;
          this.updateUI();
          return;
        }
        if (this.isGameOver || this._isHandlingDeath || this.player.stats.hp <= 0) {
          if (!this.isGameOver && !this._isHandlingDeath) {
            this.handlePlayerDeath();
          }
          return;
        }
        t.energy -= 100;
        if (t.stats.hp <= 0) {
          let e = J.getScaledXpValue(this.player, t);
          if (t.diedFromDot) {
            this.addLogEntry(
              `[System] ${t.displayName}이(가) 지속 피해로 쓰러졌습니다! (+${e} XP)`,
              `system`,
            );
          } else {
            this.addLogEntry(
              `[Combat] ${t.displayName}을(를) 처치했습니다! (+${e} XP)`,
              `combat`,
            );
          }
          let n = this.player.gainXp(e);
          n.leveledUp && n.logs.forEach((e) => this.addLogEntry(e, `loot`));
          if (typeof this.player.recordKill === 'function') {
            if (t.uniqueKey) this.player.recordKill(t.uniqueKey);
            if (t.key) this.player.recordKill(t.key);
            if (t.type) this.player.recordKill(t.type);
            if (t.name) this.player.recordKill(t.name);
          }
          let r = this.monsters.indexOf(t);
          r !== -1 && this.monsters.splice(r, 1);
        }
        // Safety: if too many monster actions in one loop, force player turn
        if (++state.monsterActCount > 200) {
          this.player.energy = 100;
        }
        // Time-slice: yield to browser if we've been running too long
        if (performance.now() - startTime > MAX_CHUNK_MS) {
          setTimeout(() => this._runTurnLoopChunk(), 0);
          return;
        }
        continue;
      }
      let r = this.player.speed > 0;
      if (!r) {
        for (let e = 0; e < this.monsters.length; e++)
          if (this.monsters[e].speed > 0) {
            r = !0;
            break;
          }
      }
      if (!r) {
        ((this.playerTurn = !0), this.updateUI());
        return;
      }
      if (++state.globalTicks > 50) {
        this.player.energy = 100;
      }
      this.tickGlobalEnergy();
      // Time-slice check after energy tick (which is the heavier operation)
      if (performance.now() - startTime > MAX_CHUNK_MS) {
        setTimeout(() => this._runTurnLoopChunk(), 0);
        return;
      }
    }
  }
  isMonsterAt(e, t) {
    return this.monsters.some((n) => n.x === e && n.y === t);
  }
  killMonster(monster, source = "스킬 공격") {
    if (!monster) return;
    LootSystem.processMonsterDeath(this, this.player, monster, source);
  }
  handleMonsterBuffsAndHeals(monster) {
    if (monster.stats.hp <= 0) return;

    // Monster 도메인 클래스 내부로 모든 턴 틱 연산 및 사제/샤먼 AI 위임 호출
    if (monster.tickBuffsAndHeals) {
      monster.tickBuffsAndHeals(this.monsters, (msg, type) => this.addLogEntry(msg, type));
      // 인스펙팅 중인 대상 몬스터의 상태 변화 감지 시 모달 더티 플래그 마킹
      if (this.inspectingMonster === monster) {
        this.isInspectModalDirty = true;
      }
    }
  }
  updateUI() {
    this.uiHp &&
      (this.uiHp.innerText = `${this.player.stats.hp}/${this.player.stats.maxHp}`);
    let e = document.getElementById(`ui-speed`);
    if ((e && (e.innerText = this.player.speed.toFixed(2)), this.uiFloor)) {
      let e = this.floor * 5;
      this.uiFloor.innerText = `${this.floor}층 (${e}m)`;
    }

    // 몬스터 관찰 대상이 존재하고 더티 플래그가 세팅된 경우에만 브라우저 DOM 렌더링 실행 (렌더링 Lag 방지)
    if (this.inspectingMonster && this.isInspectModalDirty) {
      let modalTitle = document.getElementById(`monster-modal-title`);
      let modalBody = document.getElementById(`monster-modal-body`);
      if (modalTitle && modalBody) {
        modalTitle.innerText = `${this.inspectingMonster.displayName} (Lv.${this.inspectingMonster.level})`;
        let rarityTier = determineRarity(this.inspectingMonster.prefixes, this.inspectingMonster.suffixes);
        modalTitle.style.color = getRarityColor(rarityTier);
        modalBody.innerHTML = renderMonsterInspectHTML(this.inspectingMonster);
        
        // 새로 렌더링된 몬스터 관찰 완료(OK) 버튼에 닫기 이벤트 다시 바인딩
        let okBtn = document.getElementById(`monster-modal-ok-btn`);
        if (okBtn) {
          okBtn.onclick = () => {
            let modal = document.getElementById(`monster-modal`);
            if (modal) modal.classList.add(`hidden`);
            this.inspectingMonster = null;
          };
        }
        
        // 렌더링 완료 후 더티 플래그 초기화
        this.isInspectModalDirty = false;
      }
    }

    // 우측 하단 원거리 자동사격 전용 플로팅 토글 버튼 갱신
    if (this.player) {
      updateFloatingAutoFireButton(this.player, this);
    }
  }
  checkItemCollision() {
    ((this.standingItem = null),
      (this.standingStairs = !1),
      (this.standingUpStairs = !1));
    for (let e of this.items)
      if (e.x === this.player.x && e.y === this.player.y) {
        ((this.standingItem = e),
          this.addLogEntry(
            `발밑에 [${e.name}]이(가) 있습니다. [E] 키 또는 모바일 [ACT] 버튼을 눌러 획득하세요.`,
            `system`,
          ));
        return;
      }
    let e = this.map.getTile(this.player.x, this.player.y);
    e &&
      (e.isStaircase
        ? ((this.standingStairs = !0),
          this.addLogEntry(
            `발밑에 [아래로 가는 계단]이(가) 있습니다. [E] 키 또는 모바일 [ACT] 버튼을 눌러 내려가세요.`,
            `system`,
          ))
        : e.isUpStaircase &&
          ((this.standingUpStairs = !0),
          this.addLogEntry(
            `발밑에 [위로 가는 계단]이(가) 있습니다. [E] 키 또는 모바일 [ACT] 버튼을 눌러 올라가세요.`,
            `system`,
          )));
  }
  nextFloor() {
    this.floor += 1;
    let e = this.floor * 5;
    const dim = DungeonValueBudgetEngine.calculateMapDimensions(this.floor);
    this.mapWidth = dim.width;
    this.mapHeight = dim.height;
    ((this.floorDanger = DungeonValueBudgetEngine.calculateFloorDanger(this.floor)),
      this.addLogEntry(
        `지하 ${e}m 깊이로 내려갑니다. 차가운 지하 바람이 불어옵니다...`,
        `system`,
      ));
    let t = ``,
      n = `system`;
    (this.floorDanger < 5
      ? ((t = `[감각] 이 계층은 조용하고 평온하게 느껴집니다. 지루한 탐험이 될 것 같습니다.`),
        (n = `system`))
      : this.floorDanger >= 5 && this.floorDanger < 10
        ? ((t = `[감각] 마력의 미세한 흐름이 감지됩니다. 어쩌면 무언가 특별한 것이 숨겨져 있을지도 모릅니다.`),
          (n = `loot`))
        : this.floorDanger >= 10 && this.floorDanger < 16
          ? ((t = `[감각] 심장이 격하게 고동치고 온몸의 긴장이 극에 달합니다. 강력한 살기가 도사리고 있습니다!`),
            (n = `combat`))
          : ((t = `[감각] 숨통을 조여오는 공포와 절망의 기운이 온 방을 가득 채우고 있습니다! 맥박이 요동칩니다!`),
            (n = `combat`)),
      setTimeout(() => {
        this.addLogEntry(t, n);
      }, 400),
      (this.transitionAlpha = 1),
      (this.map = new W(this.mapWidth, this.mapHeight, this.floor, { maxRooms: dim.maxRooms })),
      (this.player.x = this.map.startingPosition.x),
      (this.player.y = this.map.startingPosition.y),
      (this.items = []),
      (this.monsters = []),
      this.spawnFloorContent(),
      (() => {
        const topV = this.renderer && this.renderer.mapBridge ? this.renderer.mapBridge.getTopVoxel(this.player.x, this.player.y) : null;
        this.renderer && this.renderer.snapCamera && this.renderer.snapCamera(this.player.x, this.player.y, topV ? topV.z : 0);
      })(),
      (this.player.energy = 0),
      (this.standingStairs = !1),
      this.updateUI(),
      this.saveGame(!0),
      this.runTurnLoop());
  }
  prevFloor() {
    if (this.floor <= 1) return;
    --this.floor;
    let e = this.floor * 5;
    const dim = DungeonValueBudgetEngine.calculateMapDimensions(this.floor);
    this.mapWidth = dim.width;
    this.mapHeight = dim.height;
    if (
      ((this.floorDanger = DungeonValueBudgetEngine.calculateFloorDanger(this.floor)),
      this.addLogEntry(
        `지하 ${e}m 깊이로 다시 올라갑니다. 차가운 지하 바람이 누그러듭니다...`,
        `system`,
      ),
      (this.transitionAlpha = 1),
      (this.map = new W(this.mapWidth, this.mapHeight, this.floor, { maxRooms: dim.maxRooms })),
      this.map.rooms.length > 0)
    ) {
      let e = this.map.rooms[this.map.rooms.length - 1];
      ((this.player.x = e.center.x), (this.player.y = e.center.y));
    }
    ((this.items = []),
      (this.monsters = []),
      this.spawnFloorContent(),
      (() => {
        const topV = this.renderer && this.renderer.mapBridge ? this.renderer.mapBridge.getTopVoxel(this.player.x, this.player.y) : null;
        this.renderer && this.renderer.snapCamera && this.renderer.snapCamera(this.player.x, this.player.y, topV ? topV.z : 0);
      })(),
      (this.player.energy = 0),
      (this.standingStairs = !1),
      (this.standingUpStairs = !1),
      this.updateUI(),
      this.saveGame(!0),
      this.runTurnLoop());
  }
  addLogEntry(e, t = `system`) {
    if (
      ((this.logHistory ||= []),
      this.logHistory.push({ text: e, type: t }),
      this.logHistory.length > 200 && this.logHistory.shift(),
      this.isLogModalOpen && this.renderLogModalList(),
      !this.combatLog)
    )
      return;
    let n = document.createElement(`p`);
    n.className = `log-entry ${t}`;
    n.innerHTML = e;
    this.combatLog.appendChild(n);

    // 하단 텍스트 잘림을 원천 방지하는 14px 물리 여백 스페이서 항상 최하단 유지
    let spacer = this.combatLog.querySelector ? this.combatLog.querySelector(`.log-bottom-spacer`) : null;
    if (!spacer) {
      spacer = document.createElement(`div`);
      spacer.className = `log-bottom-spacer`;
      spacer.style.height = `14px`;
      spacer.style.minHeight = `14px`;
      spacer.style.flexShrink = `0`;
      this.combatLog.appendChild(spacer);
    } else {
      this.combatLog.appendChild(spacer);
    }

    if (this.combatLog.children && typeof this.combatLog.removeChild === 'function') {
      while (this.combatLog.children.length > 6) {
        this.combatLog.removeChild(this.combatLog.firstChild);
      }
    }
    // Defer scroll update to avoid forced synchronous layout reflow per call
    if (!this._logScrollPending) {
      this._logScrollPending = true;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (this.combatLog) {
            this.combatLog.scrollTop = (this.combatLog.scrollHeight || 0) + 200;
            if (spacer && typeof spacer.scrollIntoView === 'function') {
              spacer.scrollIntoView({ block: 'end', behavior: 'auto' });
            }
          }
          this._logScrollPending = false;
        });
      } else {
        this._logScrollPending = false;
      }
    }
  }
  spawnFloorContent() {
    Y.spawnFloorContent(this);
  }
  attackMonster(e, t) {
    J.attackMonster(this, e, t);
  }
  attackPlayer(e, t) {
    J.attackPlayer(this, e, t);
  }
  useMonsterBreath(e, t, n, r) {
    return J.useMonsterBreath(this, e, t, n, r);
  }
  triggerActiveSkills() {
    J.triggerActiveSkills(this);
  }
  saveGame(e = !1) {
    try {
      X.saveGame(this, e);
    } catch (err) {
      console.error("[Game.saveGame Error]", err);
    }
  }
  loadGame(e = !1) {
    try {
      return X.loadGame(this, e);
    } catch (err) {
      console.error("[Game.loadGame Error]", err);
      return false;
    }
  }
  showMainMenu() {
    this.isMainMenuOpen = true;
    eventBus.emit(GameEvents.TITLE_SCREEN, { game: this });
    const overlay = document.getElementById('main-menu-overlay');
    const primaryActions = document.getElementById('menu-primary-actions') || document.getElementById('menu-main-view');
    const slotSelection = document.getElementById('menu-slot-selection') || document.getElementById('menu-slot-view');
    const slotModalTitle = document.getElementById('slot-modal-title') || document.getElementById('menu-slot-title');
    const coreSelection = document.getElementById('menu-core-selection') || document.getElementById('menu-core-view');

    if (!overlay) return;

    overlay.style.display = 'flex';
    primaryActions?.classList.remove('hidden');
    slotSelection?.classList.add('hidden');
    coreSelection?.classList.add('hidden');

    const updateSlotLabels = () => {
      SAVE_SLOTS.forEach((slotKey) => {
        const infoEl = document.getElementById(`${slotKey}-info`);
        if (infoEl) {
          try {
            const info = SaveSystem.getSlotInfo(slotKey);
            if (info) {
              infoEl.innerText = `Lv.${info.level} ${info.species} - ${info.floor}F`;
              infoEl.style.color = '#34d399';
            } else {
              infoEl.innerText = '비어 있음';
              infoEl.style.color = 'var(--text-muted)';
            }
          } catch (e) {
            infoEl.innerText = '비어 있음';
            infoEl.style.color = 'var(--text-muted)';
          }
        }
      });
    };
    updateSlotLabels();

    let mode = 'new';
    const newGameBtn = document.getElementById('menu-new-game-btn');
    if (newGameBtn) {
      newGameBtn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          mode = 'new';
          if (slotModalTitle) {
            slotModalTitle.innerText = '새 게임을 시작할 슬롯 선택';
            slotModalTitle.style.color = '#fbbf24';
          }
          updateSlotLabels();
          primaryActions?.classList.add('hidden');
          slotSelection?.classList.remove('hidden');
        } catch (err) {
          console.error("[MainMenu newGameBtn Error]", err);
        }
      };
    }

    const loadGameBtn = document.getElementById('menu-load-game-btn');
    if (loadGameBtn) {
      loadGameBtn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          mode = 'load';
          if (slotModalTitle) {
            slotModalTitle.innerText = '불러올 슬롯 선택';
            slotModalTitle.style.color = '#fbbf24';
          }
          updateSlotLabels();
          primaryActions?.classList.add('hidden');
          slotSelection?.classList.remove('hidden');
        } catch (err) {
          console.error("[MainMenu loadGameBtn Error]", err);
        }
      };
    }

    const hofBtn = document.getElementById('menu-hof-btn');
    if (hofBtn) {
      hofBtn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          if (this.uiManager && typeof this.uiManager.showHallOfFameModal === 'function') {
            this.uiManager.showHallOfFameModal('hallOfFame');
          } else {
            AscensionModalView.showHallOfFame('hallOfFame');
          }
        } catch (err) {
          console.error("[MainMenu hofBtn Error]", err);
        }
      };
    }

    const slotBackBtn = document.getElementById('menu-slot-back-btn');
    if (slotBackBtn) {
      slotBackBtn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          primaryActions?.classList.remove('hidden');
          slotSelection?.classList.add('hidden');
        } catch (err) {
          console.error("[MainMenu slotBackBtn Error]", err);
        }
      };
    }

    document.querySelectorAll('.slot-select-btn').forEach((btn) => {
      btn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          const slotKey = btn.getAttribute('data-slot') || 'slot1';
          const info = SaveSystem.getSlotInfo(slotKey);

          if (mode === 'new') {
            this.currentSlot = slotKey;
            slotSelection?.classList.add('hidden');
            coreSelection?.classList.remove('hidden');
          } else if (mode === 'load') {
            if (info) {
              this.currentSlot = slotKey;
              const success = this.loadGame(false);
              if (success) {
                this.isMainMenuOpen = false;
                overlay.style.display = 'none';
                this.updateUI();
                this.render();
              } else {
                if (slotModalTitle) {
                  slotModalTitle.innerText = `[${slotKey.toUpperCase()}] 세이브 파일 로드에 실패했습니다.`;
                  slotModalTitle.style.color = '#ef4444';
                }
              }
            } else {
              this.addLogEntry(`[Save] 선택한 ${slotKey.toUpperCase()} 슬롯은 비어 있어 로드할 수 없습니다.`, 'system');
              if (slotModalTitle) {
                slotModalTitle.innerText = `[${slotKey.toUpperCase()}] 비어 있는 슬롯입니다.`;
                slotModalTitle.style.color = '#f87171';
              }
            }
          }
        } catch (err) {
          console.error("[MainMenu Slot Select Error]", err);
          this.isMainMenuOpen = true;
          overlay.style.display = 'flex';
          if (typeof window !== 'undefined' && typeof window.showCrashBanner === 'function') {
            window.showCrashBanner(err.message || String(err), 'Game.js', 0, 0, err);
          }
          if (slotModalTitle) {
            slotModalTitle.innerText = `오류 발생: ${err.message}`;
            slotModalTitle.style.color = '#ef4444';
          }
        }
      };
    });

    document.querySelectorAll('.core-select-btn').forEach((btn) => {
      btn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          const coreType = btn.getAttribute('data-core') || 'HUMAN';
          this.currentSlot = this.currentSlot || 'slot1';
          
          this.resetToNewGame(coreType);
          this.saveGame(true);

          coreSelection?.classList.add('hidden');
          overlay.style.display = 'none';
          this.isMainMenuOpen = false;

          const config = getSpeciesConfig(coreType);
          const coreName = config ? config.displayName || config.name : coreType;
          this.addLogEntry(`⚔️ [${this.currentSlot.toUpperCase()}] 새 모험을 시작합니다! (시작 코어: ${coreName})`, 'loot');
          this.updateUI();
          this.render();
        } catch (err) {
          console.error("[MainMenu Core Select Error]", err);
          this.isMainMenuOpen = true;
          overlay.style.display = 'flex';
          if (typeof window !== 'undefined' && typeof window.showCrashBanner === 'function') {
            window.showCrashBanner(err.message || String(err), 'Game.js', 0, 0, err);
          }
          if (slotModalTitle) {
            slotModalTitle.innerText = `새 게임 시작 실패: ${err.message}`;
            slotModalTitle.style.color = '#ef4444';
          }
        }
      };
    });

    const coreBackBtn = document.getElementById('menu-core-back-btn');
    if (coreBackBtn) {
      coreBackBtn.onclick = (ev) => {
        if (ev) ev.stopPropagation();
        try {
          coreSelection?.classList.add('hidden');
          slotSelection?.classList.remove('hidden');
        } catch (err) {
          console.error("[MainMenu coreBackBtn Error]", err);
        }
      };
    }
  }
  resetToNewGame(e = `HUMAN`) {
    try {
      this.floor = 1;
      this.floorDanger = DungeonValueBudgetEngine.calculateFloorDanger(this.floor);
      const dim = DungeonValueBudgetEngine.calculateMapDimensions(this.floor);
      this.mapWidth = dim.width;
      this.mapHeight = dim.height;
      this.transitionAlpha = 0;
      this.playerTurn = true;
      this.isGameOver = false;
      this._isHandlingDeath = false;
      this.moveCooldown = 0;
      this.playerBreathCooldown = 0;
      this.hatchlingBreathCooldown = 0;
      this.dragonBreathCooldown = 0;
      this.items = [];
      this.monsters = [];
      this.effects = [];
      this.map = new W(this.mapWidth, this.mapHeight, this.floor, { maxRooms: dim.maxRooms });
      this.player = new G(
        this.map.startingPosition.x,
        this.map.startingPosition.y,
        e
      );
      this.spawnFloorContent();
      try {
        const topV = this.renderer && this.renderer.mapBridge ? this.renderer.mapBridge.getTopVoxel(this.player.x, this.player.y) : null;
        this.renderer && this.renderer.snapCamera && this.renderer.snapCamera(this.player.x, this.player.y, topV ? topV.z : 0);
      } catch (camErr) {
        // Safe fallback in headless/virtual testing environments
      }
      this.updatePlayerLightRange && this.updatePlayerLightRange();
      if (this.combatLog) {
        this.combatLog.innerHTML = `<p class="log-entry system">새로운 모험이 시작되었습니다! 슬롯: ${(this.currentSlot || 'slot1').toUpperCase()}</p>`;
      }
    } catch (err) {
      console.error("[Game.resetToNewGame Error]", err);
      throw err;
    }
  }
  hasEquipmentTag(e) {
    return J.hasEquipmentTag(this.player, e);
  }
  getScaledXpValue(e) {
    return J.getScaledXpValue(this.player, e);
  }
  bindModalEvents() {
    let e = document.getElementById(`modal-close-btn`);
    e && (e.onclick = () => this.toggleInventory());
    let t = document.getElementById(`context-equip`);
    t &&
      (t.onclick = () => {
        this.contextItem && this.toggleEquip(this.contextItem);
      });
    let n = document.getElementById(`context-eat`);
    n &&
      (n.onclick = () => {
        this.contextItem && this.eatCore(this.contextItem);
      });
    let r = document.getElementById(`context-drop`);
    r &&
      (r.onclick = () => {
        this.contextItem && this.dropItem(this.contextItem);
      });
    let i = document.getElementById(`context-cancel`);
    i && (i.onclick = () => this.closeContextMenu());
    let a = document.getElementById(`monster-modal-close-btn`);
    a &&
      (a.onclick = () => {
        document.getElementById(`monster-modal`).classList.add(`hidden`);
      });
    let o = document.getElementById(`monster-modal`);
    (o &&
      (o.onclick = (e) => {
        e.target === o && o.classList.add(`hidden`);
      }),
      document.addEventListener(`click`, (e) => {
        let t = document.getElementById(`context-menu`);
        t &&
          !t.classList.contains(`hidden`) &&
          !e.target.closest(`#context-menu`) &&
          !e.target.closest(`.inventory-slot`) &&
          this.closeContextMenu();
      }));
    let s = document.getElementById(`log-modal-close-btn`);
    s && (s.onclick = () => this.toggleLogModal());
    let c = document.getElementById(`log-modal`);
    c &&
      (c.onclick = (e) => {
        e.target === c && this.toggleLogModal();
      });
    let toggleRenderBtn = document.getElementById(`btn-toggle-render-mode`);
    toggleRenderBtn && (toggleRenderBtn.onclick = () => this.toggleRenderMode());
    let zoomBtn = document.getElementById(`btn-cycle-zoom`);
    zoomBtn && (zoomBtn.onclick = () => this.cycleZoom());
    let optionsBtn = document.getElementById(`btn-options`);
    optionsBtn && (optionsBtn.onclick = () => this.toggleOptionsModal());
    let optionsCloseBtn = document.getElementById(`options-modal-close-btn`);
    optionsCloseBtn &&
      (optionsCloseBtn.onclick = () => this.toggleOptionsModal());
    let optionsModal = document.getElementById(`options-modal`);
    optionsModal &&
      (optionsModal.onclick = (e) => {
        e.target === optionsModal && this.toggleOptionsModal();
      });
    let autoResizeCheckbox = document.getElementById(`opt-auto-resize`);
    autoResizeCheckbox &&
      ((autoResizeCheckbox.checked = this.options.autoResize),
      (autoResizeCheckbox.onchange = (e) => {
        ((this.options.autoResize = e.target.checked),
          this.saveOptions(),
          this.applyOptions());
      }));
    let btnExport = document.getElementById(`btn-export-save`);
    btnExport && (btnExport.onclick = () => this.exportSaveData());
    let btnImport = document.getElementById(`btn-import-save`);
    let fileInput = document.getElementById(`save-import-input`);
    btnImport &&
      fileInput &&
      ((btnImport.onclick = () => fileInput.click()),
      (fileInput.onchange = (e) => {
        let t = e.target.files[0];
        t && (this.importSaveData(t), (fileInput.value = ""));
      }));

    let btnViewHof = document.getElementById(`btn-view-hall-of-fame`);
    btnViewHof &&
      (btnViewHof.onclick = () => {
        if (this.uiManager && typeof this.uiManager.showHallOfFameModal === 'function') {
          this.uiManager.showHallOfFameModal('hallOfFame');
        } else {
          AscensionModalView.showHallOfFame('hallOfFame');
        }
      });

    // 승천 및 명예의 전당 이벤트 구독
    eventBus.on(GameEvents.ASCENSION, (data) => this.openAscensionEnding(data));
    eventBus.on(GameEvents.HALL_OF_FAME_OPEN, () => {
      if (this.uiManager && typeof this.uiManager.showHallOfFameModal === 'function') {
        this.uiManager.showHallOfFameModal('hallOfFame');
      } else {
        AscensionModalView.showHallOfFame('hallOfFame');
      }
    });
    eventBus.on(GameEvents.GRAVEYARD_OPEN, () => {
      if (this.uiManager && typeof this.uiManager.showGraveyardModal === 'function') {
        this.uiManager.showGraveyardModal();
      } else {
        AscensionModalView.showHallOfFame('graveyard');
      }
    });
  }
  toggleLogModal() {
    this.isLogModalOpen = !this.isLogModalOpen;
    let e = document.getElementById(`log-modal`);
    e &&
      (this.isLogModalOpen
        ? (this.isInventoryOpen && this.toggleInventory(),
          e.classList.remove(`hidden`),
          this.renderLogModalList())
        : e.classList.add(`hidden`));
  }
  renderLogModalList() {
    let e = document.getElementById(`log-modal-list`);
    e &&
      ((e.innerHTML = ``),
      this.logHistory.forEach((t) => {
        let n = document.createElement(`p`);
        ((n.className = `log-entry ${t.type}`),
          (n.style.marginBottom = `0.2rem`),
          (n.style.fontSize = `0.85rem`),
          (n.innerHTML = t.text),
          e.appendChild(n));
      }),
      (e.scrollTop = e.scrollHeight));
  }
  toggleInventory() {
    this.isInventoryOpen = !this.isInventoryOpen;
    let e = document.getElementById(`inventory-modal`);
    e &&
      (this.isInventoryOpen
        ? (e.classList.remove(`hidden`),
          this.renderInventoryList(),
          this.showPlayerDetails())
        : (e.classList.add(`hidden`), this.closeContextMenu()));
  }
  loadOptions() {
    try {
      if (typeof localStorage === 'undefined') return;
      let e = localStorage.getItem(`mimicry_options`);
      e && (this.options = Object.assign({}, this.options, JSON.parse(e)));
    } catch (e) {
      console.error(`Failed to load options`, e);
    }
  }
  saveOptions() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(`mimicry_options`, JSON.stringify(this.options));
    } catch (e) {
      console.error(`Failed to save options`, e);
    }
  }
  resizeGame() {
    let container = document.getElementById("game-container");
    if (container) {
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "100vw";
      container.style.height = "100vh";
      container.style.maxWidth = "100vw";
      container.style.maxHeight = "100vh";
      container.style.margin = "0";
      container.style.padding = "0";
      container.style.transform = "none";
    }
    if (this.renderer) {
      this.renderer.resize();
      if (this.player) {
        this.renderer.snapCamera(this.player.x, this.player.y);
      }
      this.updateZoomButton();
      this.render();
    }
  }
  applyOptions() {
    this.resizeGame();
  }
  switchRenderer(mode) {
    this.renderMode = mode === "ascii" ? "ascii" : "voxel";
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mimicry_render_mode", this.renderMode);
    }
    if (this.renderMode === "ascii") {
      this.renderer = new Classic2DAsciiRenderer("game-canvas", this.tileSize);
    } else {
      this.renderer = new Voxel3DRenderer("game-canvas", this.tileSize);
    }
    if (this.player) {
      this.renderer.snapCamera(this.player.x, this.player.y);
    }
    this.updateRenderModeButton();
    this.updateZoomButton();
    this.render();
  }
  toggleRenderMode() {
    const nextMode = this.renderMode === "voxel" ? "ascii" : "voxel";
    this.switchRenderer(nextMode);
    this.addLogEntry(`🎨 렌더링 모드가 [${this.renderMode === "voxel" ? "🧊 3D 복셀 모드" : "📜 2D 클래식 아스키 모드"}]로 전환되었습니다.`, "loot");
  }
  updateRenderModeButton() {
    const btn = document.getElementById("btn-toggle-render-mode");
    if (btn) {
      btn.innerHTML = this.renderMode === "voxel" ? "🧊 3D 복셀" : "📜 2D 아스키";
      btn.title = `클릭하여 ${this.renderMode === "voxel" ? "2D 클래식 아스키" : "3D 복셀"} 모드로 전환`;
    }
  }
  cycleZoom() {
    const presets = [0.6, 0.85, 1.0, 1.35, 1.7];
    const current = this.renderer.zoom || 1.0;
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < presets.length; i++) {
      const diff = Math.abs(presets[i] - current);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    const nextIdx = (closestIdx + 1) % presets.length;
    const nextZoom = presets[nextIdx];
    this.renderer.setZoom(nextZoom);
    if (this.player) {
      this.renderer.snapCamera(this.player.x, this.player.y);
    }
    this.updateZoomButton();
    const label = nextZoom <= 0.65 ? "초광각" : nextZoom <= 0.9 ? "광각" : nextZoom <= 1.15 ? "표준" : nextZoom <= 1.5 ? "확대" : "근접";
    this.addLogEntry(`🔍 뷰포트 배율: ${nextZoom.toFixed(2)}x (${label})`, "loot");
    this.render();
  }
  updateZoomButton() {
    const btn = document.getElementById("btn-cycle-zoom");
    if (btn && this.renderer) {
      btn.innerHTML = `🔍 ${this.renderer.zoom.toFixed(2)}x`;
      btn.title = "클릭하여 화면 확대/축소 배율 전환 (0.6x ~ 1.7x)";
    }
  }
  toggleOptionsModal() {
    this.isOptionsOpen = !this.isOptionsOpen;
    let e = document.getElementById(`options-modal`);
    e &&
      (this.isOptionsOpen
        ? (this.isInventoryOpen && this.toggleInventory(),
          this.isLogModalOpen && this.toggleLogModal(),
          e.classList.remove(`hidden`),
          (document.getElementById(`opt-auto-resize`).checked =
            this.options.autoResize))
        : e.classList.add(`hidden`));
  }
  renderInventoryList() {
    let e = document.getElementById(`inventory-list`);
    if (!e) return;
    e.innerHTML = ``;
    let t = document.getElementById(`player-status-panel`);
    t &&
      ((t.innerHTML = ee(this.player)),
      (document.getElementById(`active-core-btn`).onclick = () =>
        this.showActiveCoreDetails()),
      (document.getElementById(`char-info-btn`).onclick = () =>
        this.showPlayerDetails()),
      (document.getElementById(`skill-tree-btn`).onclick = () =>
        this.showSkillTree()),
      (document.getElementById(`mastery-info-btn`).onclick = () =>
        this.showMasteryDetails()));
    const totalSlots = Math.max(24, (this.player.inventory && this.player.inventory.length) || 0);
    for (let t = 0; t < totalSlots; t++) {
      let n = this.player.inventory[t],
        r = document.createElement(`div`);
      r.className = `inventory-slot`;
      let { html: i, isEquipped: a } = Q(n, this.player, t);
      ((r.innerHTML = i),
        n
          ? (a && r.classList.add(`equipped`),
            this.selectedItem === n && r.classList.add(`selected`),
            this.bindSlotEvents(r, n))
          : r.classList.add(`empty`),
        e.appendChild(r));
    }
  }
  showActiveCoreDetails() {
    this.selectedItem = null;
    let e = document.getElementById(`item-detail`);
    e &&
      (document
        .querySelectorAll(`.inventory-slot`)
        .forEach((e) => e.classList.remove(`selected`)),
      (e.innerHTML = te(this.player)));
  }
  showPlayerDetails() {
    this.selectedItem = null;
    let e = document.getElementById(`item-detail`);
    e &&
      (document
        .querySelectorAll(`.inventory-slot`)
        .forEach((e) => e.classList.remove(`selected`)),
      (e.innerHTML = ne(this.player)));
  }
  showMasteryDetails() {
    this.selectedItem = null;
    let e = document.getElementById(`item-detail`);
    e &&
      (document
        .querySelectorAll(`.inventory-slot`)
        .forEach((e) => e.classList.remove(`selected`)),
      (e.innerHTML = renderMasteryDetailsHTML(this.player)));
  }
  showSkillTree() {
    this.selectedItem = null;
    let e = document.getElementById(`item-detail`);
    if (!e) return;
    document
      .querySelectorAll(`.inventory-slot`)
      .forEach((e) => e.classList.remove(`selected`));
    e.innerHTML = renderSkillTreeHTML(this.player);
  }
  bindSlotEvents(e, t) {
    let n = 0,
      r = null;
    e.addEventListener(`click`, (e) => {
      let r = Date.now();
      (r - n < 300
        ? t.type === `POTION` || t.type === `SCROLL`
          ? this.useItem(t)
          : t.type === `CORE`
            ? this.eatCore(t)
            : this.toggleEquip(t)
        : this.selectItem(t),
        (n = r));
    });
    let i = (e) => {
        (r && clearTimeout(r),
          (r = setTimeout(() => {
            this.openContextMenu(e, t);
          }, 500)));
      },
      a = () => {
        r &&= (clearTimeout(r), null);
      };
    (e.addEventListener(`mousedown`, i),
      e.addEventListener(`touchstart`, i, { passive: !0 }),
      e.addEventListener(`mouseup`, a),
      e.addEventListener(`touchend`, a),
      e.addEventListener(`mouseleave`, a),
      e.addEventListener(`touchmove`, a),
      e.addEventListener(`contextmenu`, (e) => {
        (e.preventDefault(), this.openContextMenu(e, t));
      }));
  }
  selectItem(e) {
    this.selectedItem = e;
    document.querySelectorAll(`.inventory-slot`).forEach((t, n) => {
      if (this.player.inventory[n] === e) {
        t.classList.add(`selected`);
        if (typeof t.scrollIntoView === 'function') {
          t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else {
        t.classList.remove(`selected`);
      }
    });
    let t = document.getElementById(`item-detail`);
    if (!t) return;
    let n = this.player.isItemEquipped ? this.player.isItemEquipped(e) : (
        this.player.equipment.weapon === e ||
        this.player.equipment.shield === e ||
        this.player.equipment.bow === e ||
        this.player.equipment.quiver === e ||
        this.player.equipment.armor === e ||
        this.player.equipment.helmet === e ||
        this.player.equipment.gloves === e ||
        this.player.equipment.boots === e ||
        this.player.equipment.cloak === e ||
        this.player.equipment.ring1 === e ||
        this.player.equipment.ring2 === e ||
        this.player.equipment.amulet === e ||
        this.player.equippedLamp === e ||
        this.player.equipment.subCore1 === e ||
        this.player.equipment.subCore2 === e),
      r = this.player.equipment.subCore1 === e,
      i = this.player.equipment.subCore2 === e,
      a = !1,
      o = !1;
    if (e.type === `CORE`) {
      a = this.player.inventory.some(
        (t) => t.type === `CORE` && t.coreType === e.coreType && t !== e,
      );
      o = this.player.inventory.some(
        (t) => t.type === `CORE` && t !== e && (t.fusionLevel || 0) > 0,
      );
    }
    t.innerHTML = O(e, this.player, n, r, i, a, o);

    const setClick = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) btn.onclick = fn;
    };

      if (e.type === `CORE`) {
        setClick(`swap-main-core-btn`, () => this.swapMainCore(e));
        setClick(`eat-core-btn`, () => this.eatCore(e));
        setClick(`sub-core1-btn`, () => this.toggleSubCore1(e));
        setClick(`sub-core2-btn`, () => this.toggleSubCore2(e));
        setClick(`detail-drop-btn`, () => this.dropItem(e));
      } else if (
        e.type === `SCROLL` || e.type === `POTION` || e.type === `WAND` ||
        e.type === `STAFF` || e.type === `ROD` || e.type === `FOOD` ||
        e.type === `FLASK` || e.tval === 71 || e.tval === 70 || e.tval === 77 ||
        e.tval === 80 || e.tval === 65 || e.tval === 55 || e.tval === 66
      ) {
        setClick(`detail-use-btn`, () => this.useItem(e));
        setClick(`detail-drop-btn`, () => this.dropItem(e));
      } else {
        setClick(`detail-equip-btn`, () => this.toggleEquip(e));
        setClick(`detail-drop-btn`, () => this.dropItem(e));
      }
  }
  showTransferMaterialSelection(e) {
    let t = this.player.inventory.filter(
        (t) => t.type === `CORE` && t !== e && (t.fusionLevel || 0) > 0,
      ),
      n = document.getElementById(`item-detail`);
    if (!n) return;
    ((n.innerHTML = ce(e, t)),
      n.querySelectorAll(`[data-index]`).forEach((n) => {
        n.onclick = () => {
          let r = t[parseInt(n.getAttribute(`data-index`))];
          if (r) {
            let t = r.fusionLevel || 0;
            this.player.removeItem(r);
            e.fusionLevel = (e.fusionLevel || 0) + t;
            
            // 더티 플래그 만료 격발로 스탯 및 체력 캐시 일관성 확보!
            this.player.markDirty(`코어 계승: ${e.name}`);
            
            this.addLogEntry(
              `[Loot] 🔮 계승 성공! [${r.name}]의 수치를 [${e.name}]이(가) 이전받아 +${e.fusionLevel} 단계가 되었습니다!`,
              `loot`,
            );
            
            // 새롭게 갱신된 스탯 캐시를 바탕으로 체력의 비율을 파괴하지 않고 비례 보정
            const oldMaxHp = this.player.stats.maxHp;
            this.player.stats.maxHp = this.player.getMaxHp();
            if (oldMaxHp > 0) {
              this.player.stats.hp = Math.max(1, Math.min(this.player.stats.maxHp, Math.round(this.player.stats.hp * (this.player.stats.maxHp / oldMaxHp))));
            } else {
              this.player.stats.hp = this.player.stats.maxHp;
            }
            
            this.renderInventoryList();
            this.selectItem(e);
            this.updateUI();
          }
        };
      }));
    let r = document.getElementById(`cancel-transfer-btn`);
    r && (r.onclick = () => this.selectItem(e));
  }
  toggleEquip(e) {
    if (e.type === `POTION` || e.type === `SCROLL` || e.type === `WAND` || e.type === `STAFF` || e.type === `ROD` || e.type === `FOOD` || e.type === `FLASK` || e.tval === 71 || e.tval === 70 || e.tval === 77 || e.tval === 80 || e.tval === 65 || e.tval === 55 || e.tval === 66) {
      this.useItem(e);
      return;
    }
    if (e.type === `CORE`) {
      this.toggleSubCore1(e);
      return;
    }
    if (this.player.isItemEquipped ? this.player.isItemEquipped(e) : (
      this.player.equipment.weapon === e ||
      this.player.equipment.shield === e ||
      this.player.equipment.bow === e ||
      this.player.equipment.quiver === e ||
      this.player.equipment.armor === e ||
      this.player.equipment.helmet === e ||
      this.player.equipment.gloves === e ||
      this.player.equipment.boots === e ||
      this.player.equipment.cloak === e ||
      this.player.equipment.ring1 === e ||
      this.player.equipment.ring2 === e ||
      this.player.equipment.amulet === e ||
      this.player.equippedLamp === e ||
      this.player.equipment.subCore1 === e ||
      this.player.equipment.subCore2 === e
    ))
      (this.player.unequipItem(e),
        this.addLogEntry(
          `[Equipment] ${e.name}의 장착을 해제했습니다.`,
          `system`,
        ));
    else {
      let t = null;
      if (e.slotType === `BOW` || e.char === `}` || e.type === `BOW`) {
        t = this.player.equipment.bow;
      } else if (e.slotType === `QUIVER` || e.char === `{` || e.type === `QUIVER`) {
        t = this.player.equipment.quiver;
      } else if (e.slotType === `WEAPON` || e.type === `WEAPON`) {
        t = this.player.equipment.weapon;
      } else if (e.slotType === `SHIELD` || e.type === `SHIELD` || e.char === `)`) {
        t = this.player.equipment.shield;
      } else if (e.slotType === `ARMOR` || e.type === `ARMOR`) {
        t = this.player.equipment.armor;
      } else if (e.slotType === `HELMET` || e.type === `HELMET`) {
        t = this.player.equipment.helmet;
      } else if (e.slotType === `GLOVES` || e.type === `GLOVES`) {
        t = this.player.equipment.gloves;
      } else if (e.slotType === `BOOTS` || e.type === `BOOTS`) {
        t = this.player.equipment.boots;
      } else if (e.slotType === `CLOAK` || e.type === `CLOAK` || e.char === `(`) {
        t = this.player.equipment.cloak;
      } else if (e.slotType === `AMULET` || e.type === `AMULET`) {
        t = this.player.equipment.amulet;
      } else if ((e.slotType === `RING` || e.type === `RING`) && this.player.equipment.ring1 && this.player.equipment.ring2) {
        t = this.player.equipment.ring1;
      }
      t && this.player.unequipItem(t);
      this.player.equipItem(e);
      let n = ``;
      (e.lightBonus > 0
        ? (n = ` (원형 시야 +${e.lightBonus})`)
        : e.dice && (n = ` (피해 다이스 ${e.dice})`),
        this.addLogEntry(
          `[Equipment] ${e.name}을(를) 성공적으로 장착했습니다!${n}`,
          `loot`,
        ));
    }
    (this.closeContextMenu(),
      this.renderInventoryList(),
      this.selectedItem === e && this.selectItem(e),
      this.updateUI());
  }
  swapMainCore(e) {
    (this.player.doSwapMainCore(e, (e, t) => this.addLogEntry(e, t)),
      (this.selectedItem = null),
      this.closeContextMenu(),
      this.renderInventoryList(),
      this.updateUI());
  }
  toggleSubCore1(e) {
    e.type === `CORE` &&
      (this.player.equipment.subCore1 === e
        ? (this.player.unequipSubCore1(),
          this.addLogEntry(
            `[보조 코어] 보조 코어 1 슬롯에서 ${e.name}의 장착을 해제했습니다.`,
            `system`,
          ))
        : (this.player.equipment.subCore2 === e &&
            this.player.unequipSubCore2(),
          this.player.equipSubCore1(e),
          this.addLogEntry(
            `[보조 코어] 보조 코어 1 슬롯에 ${e.name}을(를) 장착했습니다!`,
            `loot`,
          )),
      this.closeContextMenu(),
      this.renderInventoryList(),
      this.selectedItem === e && this.selectItem(e),
      this.updateUI());
  }
  toggleSubCore2(e) {
    e.type === `CORE` &&
      (this.player.equipment.subCore2 === e
        ? (this.player.unequipSubCore2(),
          this.addLogEntry(
            `[보조 코어] 보조 코어 2 슬롯에서 ${e.name}의 장착을 해제했습니다.`,
            `system`,
          ))
        : (this.player.equipment.subCore1 === e &&
            this.player.unequipSubCore1(),
          this.player.equipSubCore2(e),
          this.addLogEntry(
            `[보조 코어] 보조 코어 2 슬롯에 ${e.name}을(를) 장착했습니다!`,
            `loot`,
          )),
      this.closeContextMenu(),
      this.renderInventoryList(),
      this.selectedItem === e && this.selectItem(e),
      this.updateUI());
  }
  dropItem(e) {
    (this.player.removeItem(e),
      this.addLogEntry(
        `[System] ${e.name}을(를) 소지품에서 꺼내 버렸습니다(파괴됨).`,
        `system`,
      ),
      (this.selectedItem = null),
      this.closeContextMenu(),
      this.renderInventoryList(),
      this.updateUI());
  }
  setBreathElement(e) {
    this.player.selectedBreathElement = e;
    let t = e || `자동`;
    (this.addLogEntry(
      `[Breath] 🐉 브레스 속성을 <b>${t}</b> 으로 설정했습니다.`,
      `loot`,
    ),
      this.updateUI());
  }
  useItem(e) {
    (e.applyUseEffect(this.player, (msg, type) => this.addLogEntry(msg, type), this),
      (this.selectedItem = null),
      this.renderInventoryList(),
      this.updateUI());
  }
  openContextMenu(e, t) {
    (e.preventDefault(), (this.contextItem = t));
    let n = document.getElementById(`context-menu`);
    if (!n) return;
    let r = 0,
      i = 0;
    if (e.touches && e.touches[0]) {
      let t = document.getElementById(`game-container`).getBoundingClientRect();
      ((r = e.touches[0].clientX - t.left), (i = e.touches[0].clientY - t.top));
    } else if (e.clientX !== void 0) {
      let t = document.getElementById(`game-container`).getBoundingClientRect();
      ((r = e.clientX - t.left), (i = e.clientY - t.top));
    } else ((r = 200), (i = 150));
    ((r = Math.min(650, Math.max(10, r))),
      (i = Math.min(450, Math.max(10, i))),
      (n.style.left = `${r}px`),
      (n.style.top = `${i}px`),
      n.classList.remove(`hidden`));
    let a = this.player.isItemEquipped ? this.player.isItemEquipped(t) : (
        this.player.equipment.weapon === t ||
        this.player.equipment.shield === t ||
        this.player.equipment.bow === t ||
        this.player.equipment.quiver === t ||
        this.player.equipment.armor === t ||
        this.player.equipment.helmet === t ||
        this.player.equipment.gloves === t ||
        this.player.equipment.boots === t ||
        this.player.equipment.cloak === t ||
        this.player.equipment.ring1 === t ||
        this.player.equipment.ring2 === t ||
        this.player.equipment.amulet === t ||
        this.player.equippedLamp === t ||
        this.player.equipment.subCore1 === t ||
        this.player.equipment.subCore2 === t),
      o = document.getElementById(`context-equip`);
    o.innerText = a
      ? `장착 해제`
      : t.type === `CORE`
        ? `보조 1 장착`
        : `장착하기`;
    let s = document.getElementById(`context-eat`);
    s &&
      (t.type === `CORE`
        ? s.classList.remove(`hidden`)
        : s.classList.add(`hidden`));
  }
  eatCore(e) {
    !e ||
      e.type !== `CORE` ||
      (this.player.useCoreAsFood(e, this) &&
        (this.closeContextMenu(),
        this.renderInventoryList(),
        this.showPlayerDetails(),
        this.updateUI(),
        (this.playerTurn = !1),
        (this.moveCooldown = 150),
        this.saveGame(!0),
        this.runTurnLoop()));
  }
  closeContextMenu() {
    let e = document.getElementById(`context-menu`);
    (e && e.classList.add(`hidden`), (this.contextItem = null));
  }
  updatePlayerLightRange() {
    let range = 1;
    const player = this.player;
    if (player.mimicCore && player.mimicCore.lightBonus) {
      range += player.mimicCore.lightBonus;
    }
    if (player.equippedLamp) {
      range += player.equippedLamp.getLightBonus();
    }
    if (player.mimicCore && (player.mimicCore.coreType === 'BAT' || (player.mimicCore.name && player.mimicCore.name.includes('박쥐')))) {
      range += 1;
    }
    player.lightRange = range;
  }
  render() {
    try {
      this.updatePlayerLightRange();
      let e = Math.max(
          0,
          Math.min(
            this.map.width - this.renderer.viewportWidth,
            this.player.x - Math.floor(this.renderer.viewportWidth / 2),
          ),
        ),
        t = Math.max(
          0,
          Math.min(
            this.map.height - this.renderer.viewportHeight,
            this.player.y - Math.floor(this.renderer.viewportHeight / 2),
          ),
        );
      ((this.cameraX = e), (this.cameraY = t));
      let n = this.player.lightRange,
        r = this.player.canDetectMonsters(),
        i = this.player.canDetectItems();
      (this.renderer.clear(),
        this.renderer.drawMap(this.map, e, t, this.player.x, this.player.y, n));
      for (let r of this.items)
        this.renderer.drawItem(r, e, t, this.player.x, this.player.y, n, i);
      for (let i of this.monsters)
        this.renderer.drawEntity(i, e, t, this.player.x, this.player.y, n, r);
      this.renderer.drawEntity(
        this.player,
        e,
        t,
        this.player.x,
        this.player.y,
        n,
      );
      for (let n of this.effects) n.draw(this.renderer, e, t);
      if (this.renderer.updateParticles) {
        this.renderer.updateParticles(0.016);
      }
      if (this.transitionAlpha > 0.001) {
        this.renderer.ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, this.transitionAlpha))})`;
        this.renderer.ctx.fillRect(
          0,
          0,
          this.renderer.w || this.renderer.canvas.width,
          this.renderer.h || this.renderer.canvas.height,
        );
      }
    } catch (err) {
      console.error("[RENDER ERROR]", err);
    }
  }
  handleCanvasClick(e) {
    if (this.isInventoryOpen || this.isOptionsOpen || this.isLogModalOpen || this.isMainMenuOpen) return;
    if (!this.player || !this.renderer || !this.renderer.pick) return;

    const result = this.renderer.pick(
      e.clientX,
      e.clientY,
      this.monsters,
      this.items,
      this.player,
      this.map
    );

    if (result) {
      if (result.type === 'monster') {
        const monster = result.data;
        const dx = monster.x - this.player.x;
        const dy = monster.y - this.player.y;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const bow = this.player.equipment.bow || (this.player.equipment.weapon && (this.player.equipment.weapon.slotType === 'BOW' || this.player.equipment.weapon.char === '}' || this.player.equipment.weapon.weaponCategory === 'ARCHERY' || this.player.equipment.weapon.weaponCategory === 'RANGED') ? this.player.equipment.weapon : null);
        // 원거리 무기 장착 상태에서 2칸 이상 떨어진 몬스터를 클릭/터치한 경우 직접 타겟 사격 격발
        if (bow && dist >= 2 && dist <= (bow.range || 5) && this.map && this.map.isTransparent(this.player.x, this.player.y, monster.x, monster.y)) {
          CombatSystem.attackMonster(this, this.player, monster);
          this.player.energy -= 100;
          this.playerTurn = false;
          this.runTurnLoop();
          this.updateUI();
          return;
        }
      }
      this.openInspectModal(result);
    }
  }

  openInspectModal(result) {
    if (!result) return;
    const modal = document.getElementById(`monster-modal`);
    const title = document.getElementById(`monster-modal-title`);
    const body = document.getElementById(`monster-modal-body`);
    const closeBtn = document.getElementById(`monster-modal-close-btn`);
    if (!modal || !body) return;

    const closeModal = () => {
      modal.classList.add(`hidden`);
      this.inspectingMonster = null;
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    if (result.type === `monster`) {
      const monster = result.data;
      const dx = monster.x - this.player.x;
      const dy = monster.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isVisible = (dist <= this.player.lightRange + 0.5 && this.map.isTransparent(this.player.x, this.player.y, monster.x, monster.y)) || this.player.canDetectMonsters();

      if (!isVisible) {
        this.addLogEntry(`🌫️ 어두운 안개 속에 가려져 있어 대상을 식별할 수 없습니다.`, `system`);
        return;
      }

      this.inspectingMonster = monster;
      this.isInspectModalDirty = true;
      const rarity = determineRarity(monster.prefixes, monster.suffixes);
      if (title) {
        title.innerText = `[몬스터 검사] ${monster.displayName} (Lv.${monster.level})`;
        title.style.color = getRarityColor(rarity);
      }
      body.innerHTML = renderMonsterInspectHTML(monster);
      const okBtn = document.getElementById(`monster-modal-ok-btn`);
      if (okBtn) okBtn.onclick = closeModal;
      modal.classList.remove(`hidden`);
      this.addLogEntry(`🔍 [관찰] ${monster.displayName}(Lv.${monster.level}) 상태를 상세 검사합니다.`, `system`);

    } else if (result.type === `item`) {
      const item = result.data;
      const dx = item.x - this.player.x;
      const dy = item.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isVisible = (dist <= this.player.lightRange + 0.5 && this.map.isTransparent(this.player.x, this.player.y, item.x, item.y)) || this.player.canDetectItems();

      if (!isVisible) {
        this.addLogEntry(`🌫️ 어둠에 가려진 바닥 아이템입니다.`, `system`);
        return;
      }

      this.inspectingMonster = null;
      if (title) {
        title.innerText = `[아이템 검사] ${item.name}`;
        title.style.color = item.color || `#38bdf8`;
      }
      body.innerHTML = renderItemDetailHTML(item, this.player, false, false, false, false, false);
      modal.classList.remove(`hidden`);
      this.addLogEntry(`🔍 [관찰] 바닥에 놓인 [${item.name}] 아이템의 세부 스펙을 확인합니다.`, `loot`);

    } else if (result.type === `player`) {
      this.inspectingMonster = null;
      if (title) {
        title.innerText = `[본체 검사] 플레이어 미믹 (Lv.${this.player.level})`;
        title.style.color = `#ffd700`;
      }
      body.innerHTML = renderPlayerDetailsHTML(this.player);
      modal.classList.remove(`hidden`);
      this.addLogEntry(`🔍 [관찰] 미믹 본체의 신체 스탯 및 코어 의태 상태를 점검합니다.`, `system`);
    }
  }

  openMonsterInspectModal(e) {
    this.openInspectModal({ type: 'monster', data: e, x: e.x, y: e.y });
  }
  handlePlayerDeath() {
    if (this.isGameOver || this._isHandlingDeath) return;
    this.isGameOver = true;
    this._isHandlingDeath = true;
    this.playerTurn = false;
    const killer = this.player?.lastDamageSource || '앙그반드의 어둠';
    const floor = this.floor || 1;
    const slotName = (this.currentSlot || 'slot1').toUpperCase();

    this.addLogEntry(`💀 [GAME OVER] ${killer}에게 쓰러져 모험을 마감하셨습니다. (지하 ${floor}층)`, `combat`);
    this.addLogEntry(`💀 [Permadeath] 캐릭터가 사망하여 [${slotName}] 세이브 데이터가 영구 삭제됩니다.`, `combat`);
    
    // 묘비명 영구 기록 저장
    try {
      const umm = this.uniqueMonsterManager || uniqueMonsterManager;
      const player = this.player;

      const stats = player ? serializeCombatStats(player) : null;
      const equipment = player?.equipment ? serializeEquipmentSlots(player.equipment) : {};
      const inventory = player?.inventory ? serializeInventoryItems(player.inventory) : [];
      const recentLogs = serializeRecentLogs(this.logHistory);

      const deathData = {
        playerName: player?.name || '용감한 모험가',
        level: player?.level || 1,
        floor: floor,
        killer: killer,
        turns: this.engine?.turn || this.turn || 1,
        kills: player?.killCount || 0,
        uniqueKills: umm?.killed?.size || 0,
        mimicCore: player?.mimicCore?.name || '인간 여행자',
        stats: stats,
        equipment: equipment,
        inventory: inventory,
        recentLogs: recentLogs,
        deathDate: new Date().toISOString()
      };
      saveGraveyardRecord(deathData);
      if (this.engine && typeof this.engine.triggerGameOver === 'function') {
        this.engine.triggerGameOver(deathData);
      }
    } catch (err) {
      console.warn("사망 기록 저장 중 오류:", err);
    }

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`mimicry_save_game_` + this.currentSlot);
      localStorage.removeItem(`mimicry_save_game`);
    }
    setTimeout(() => {
      this.showMainMenu();
    }, 2e3);
  }

  /**
   * 50F 승천(Ascension) 엔딩 모달 실행
   * @param {Object} victoryData 
   */
  openAscensionEnding(victoryData) {
    if (this.uiManager && typeof this.uiManager.showAscensionModal === 'function') {
      this.uiManager.showAscensionModal(victoryData, () => this.showMainMenu());
    } else {
      AscensionModalView.showVictory(victoryData, () => this.showMainMenu());
    }
  }
  exportSaveData() {
    try {
      const saveData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("mimicry_")) {
          saveData[key] = localStorage.getItem(key);
        }
      }
      const jsonString = JSON.stringify(saveData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.download = `mimicry_backup_${dateStr}.json`;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(url);
      this.addLogEntry(
        "💾 모든 세이브 데이터가 외부 JSON 파일로 정상 백업되었습니다.",
        "loot",
      );
    } catch (e) {
      console.error("Failed to export save data", e);
      alert("세이브 데이터를 내보내는 데 실패했습니다.");
    }
  }
  importSaveData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const saveData = JSON.parse(e.target.result);
        const keys = Object.keys(saveData);
        if (keys.length === 0 || !keys.some((k) => k.startsWith("mimicry_"))) {
          throw new Error("올바른 Mimicry 백업 파일이 아닙니다.");
        }
        if (
          confirm(
            "⚠️ 백업 파일을 가져오면 현재 저장된 모든 게임 슬롯과 설정이 덮어씌워집니다. 계속 진행하시겠습니까?",
          )
        ) {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith("mimicry_")) {
              localStorage.removeItem(key);
            }
          }
          for (const key of keys) {
            localStorage.setItem(key, saveData[key]);
          }
          alert("성공적으로 백업 데이터를 가져왔습니다! 게임을 재로드합니다.");
          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to import save data", err);
        alert(
          "백업 파일을 불러오는 데 실패했습니다. 파일이 깨졌거나 올바른 세이브 데이터가 아닙니다.",
        );
      }
    };
    reader.readAsText(file);
  }
}
