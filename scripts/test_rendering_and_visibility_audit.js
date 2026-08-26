/**
 * scripts/test_rendering_and_visibility_audit.js
 * Comprehensive Unit Test Suite for Rendering Pipeline 3-Way Patch & Player Visibility Audit
 *
 * Verifies:
 * 1. Player lightRange bidirectional Getter/Setter & _lightRange backing field synchronization
 * 2. Classic2DAsciiRenderer resize() viewport calculation using baseCellWidth(14) & baseCellHeight(23)
 * 3. 3D & 2D Renderer snapCamera(x, y, z), drawMap, drawEntity(player) call integrity
 * 4. Game render() transitionAlpha clipping guard (no black overlay when transitionAlpha <= 0.001)
 * 5. Game resetToNewGame() and nextFloor() snapCamera Z-height propagation
 */

import { Player } from '../src/entities/Player.js';
import { Monster } from '../src/entities/Monster.js';
import { Item } from '../src/entities/Item.js';
import { Map as DungeonMap } from '../src/map/Map.js';
import { Classic2DAsciiRenderer } from '../src/renderer/Classic2DAsciiRenderer.js';
import { Voxel3DRenderer } from '../src/renderer/Voxel3DRenderer.js';
import { Game } from '../src/core/Game.js';
import { UnifiedTraitEngine } from '../src/systems/UnifiedTraitEngine.js';

console.log("================================================================================");
console.log("🌟 [RENDERING PIPELINE 3-WAY PATCH & PLAYER VISIBILITY AUDIT TEST SUITE] 🌟");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Canvas & DOM Mocking for Node.js Headless Environment
// -----------------------------------------------------------------------------
const drawCalls = [];
const textCalls = [];
const fillRectCalls = [];

const mockCtx = {
  fillRect: (x, y, w, h) => {
    fillRectCalls.push({ x, y, w, h, fillStyle: mockCtx.fillStyle });
    drawCalls.push({ type: 'fillRect', x, y, w, h, fillStyle: mockCtx.fillStyle });
  },
  fillText: (text, x, y) => {
    textCalls.push({ text, x, y, font: mockCtx.font, fillStyle: mockCtx.fillStyle });
    drawCalls.push({ type: 'fillText', text, x, y, font: mockCtx.font, fillStyle: mockCtx.fillStyle });
  },
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  setTransform: () => {},
  scale: () => {},
  rotate: () => {},
  translate: () => {},
  clearRect: () => {},
  font: '',
  fillStyle: '',
  strokeStyle: '',
  textAlign: '',
  textBaseline: '',
  lineWidth: 1
};

const mockCanvas = {
  getContext: () => mockCtx,
  clientWidth: 800,
  clientHeight: 600,
  width: 800,
  height: 600,
  style: {},
  parentElement: { clientWidth: 800, clientHeight: 600 },
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

function createMockElement(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    style: {},
    innerHTML: '',
    innerText: '',
    className: '',
    children: [],
    dataset: {},
    scrollTop: 0,
    scrollHeight: 100,
    classList: {
      _classes: new Set(),
      add: (c) => el.classList._classes.add(c),
      remove: (c) => el.classList._classes.delete(c),
      contains: (c) => el.classList._classes.has(c),
      toggle: (c) => {
        if (el.classList._classes.has(c)) el.classList._classes.delete(c);
        else el.classList._classes.add(c);
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: (child) => {
      el.children.push(child);
      el.firstChild = el.children[0];
      return child;
    },
    removeChild: (child) => {
      const idx = el.children.indexOf(child);
      if (idx !== -1) el.children.splice(idx, 1);
      el.firstChild = el.children[0] || null;
      return child;
    },
    querySelector: (sel) => null,
    querySelectorAll: (sel) => [],
    scrollIntoView: () => {}
  };
  el.firstChild = null;
  return el;
}

const mockElementCache = new Map();

if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: (id) => {
      if (id === 'game-canvas') return mockCanvas;
      if (!mockElementCache.has(id)) {
        mockElementCache.set(id, createMockElement('div'));
      }
      return mockElementCache.get(id);
    },
    createElement: (tag) => createMockElement(tag),
    body: createMockElement('body'),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => { cb(); return 1; };
}

if (typeof global.window === 'undefined') {
  global.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => { cb(); return 1; },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    }
  };
}

if (typeof global.localStorage === 'undefined') {
  global.localStorage = global.window.localStorage;
}

// =============================================================================
// TEST SUITE 1: Player lightRange Bidirectional Getter/Setter & Backing Field
// =============================================================================
console.log("--- TEST SUITE 1: Player.lightRange Getter/Setter & Backing Field ---");
{
  const player = new Player(10, 10, 'HUMAN');
  const defaultRadius = UnifiedTraitEngine.calculateLightRadius(player, 1);

  assert(player.lightRange === defaultRadius, `Default player.lightRange matches UnifiedTraitEngine (${defaultRadius})`);
  assert(player._lightRange === undefined, `Backing field player._lightRange is initially undefined`);

  // Explicit set
  player.lightRange = 7;
  assert(player._lightRange === 7, `player._lightRange correctly updated to 7`);
  assert(player.lightRange === 7, `player.lightRange getter returns 7`);

  // Clamping test (val < 1 clamped to 1)
  player.lightRange = 0;
  assert(player.lightRange === 1, `player.lightRange clamped to minimum 1 when given 0`);

  player.lightRange = -5;
  assert(player.lightRange === 1, `player.lightRange clamped to minimum 1 when given -5`);

  // Non-number fallback test
  player.lightRange = null;
  assert(player.lightRange === defaultRadius, `player.lightRange falls back to UnifiedTraitEngine when given null`);

  player.lightRange = "invalid";
  assert(player.lightRange === defaultRadius, `player.lightRange falls back to UnifiedTraitEngine when given invalid string`);

  player.lightRange = 8.5;
  assert(player.lightRange === 8.5, `player.lightRange accepts finite float 8.5`);
}

// =============================================================================
// TEST SUITE 2: Classic2DAsciiRenderer Viewport Calculation (14x23 Grid)
// =============================================================================
console.log("\n--- TEST SUITE 2: Classic2DAsciiRenderer resize() Viewport Calculation ---");
{
  const renderer = new Classic2DAsciiRenderer('game-canvas', 24);

  // Default dimensions: w=800, h=600, zoom=1.0, baseCellWidth=14, baseCellHeight=23
  renderer.w = 800;
  renderer.h = 600;
  renderer.zoom = 1.0;
  renderer.resize();

  const expectedVpW = Math.max(12, Math.floor(800 / (14 * 1.0))); // Math.floor(57.14) = 57
  const expectedVpH = Math.max(10, Math.floor(600 / (23 * 1.0))); // Math.floor(26.08) = 26

  assert(renderer.viewportWidth === expectedVpW, `Classic2DAsciiRenderer.viewportWidth is ${expectedVpW} (used baseCellWidth 14, not tileSize 24)`);
  assert(renderer.viewportHeight === expectedVpH, `Classic2DAsciiRenderer.viewportHeight is ${expectedVpH} (used baseCellHeight 23, not tileSize 24)`);
  assert(renderer.viewportWidth !== Math.floor(800 / 24), `Confirmed viewportWidth is NOT calculated with tileSize 24 (which would be 33)`);

  // Test with custom zoom
  renderer.setZoom(1.5);
  const zoomedVpW = Math.max(12, Math.floor(800 / (14 * 1.5))); // Math.floor(38.09) = 38
  const zoomedVpH = Math.max(10, Math.floor(600 / (23 * 1.5))); // Math.floor(17.39) = 17
  assert(renderer.viewportWidth === zoomedVpW, `Zoom 1.5x viewportWidth correctly calculated as ${zoomedVpW}`);
  assert(renderer.viewportHeight === zoomedVpH, `Zoom 1.5x viewportHeight correctly calculated as ${zoomedVpH}`);
}

// =============================================================================
// TEST SUITE 3: 2D & 3D Renderer snapCamera and Entity Rendering
// =============================================================================
console.log("\n--- TEST SUITE 3: 2D & 3D Renderer snapCamera & drawEntity ---");
{
  const renderer2D = new Classic2DAsciiRenderer('game-canvas', 24);
  renderer2D.snapCamera(25, 30, 4);
  assert(renderer2D.camX === 25 && renderer2D.camY === 30, `2D snapCamera sets camX=25, camY=30`);
  assert(renderer2D.camInitialized === true, `2D snapCamera marks camInitialized=true`);

  const renderer3D = new Voxel3DRenderer('game-canvas', 24);
  renderer3D.snapCamera(15, 20, 0);
  const baseCamY = renderer3D.camY;
  const expectedCamX = (15 - 20) * renderer3D.baseTileW;
  assert(renderer3D.camX === expectedCamX, `3D snapCamera sets isometric camX=${expectedCamX}`);

  // Now snap with Z-height = 3
  renderer3D.snapCamera(15, 20, 3);
  const expectedCamYWithZ = baseCamY - (3 * renderer3D.baseBlockH);
  assert(renderer3D.camY === expectedCamYWithZ, `3D snapCamera adjusts camY with Z-height offset (${expectedCamYWithZ})`);
  assert(renderer3D.camInitialized === true, `3D snapCamera marks camInitialized=true`);

  // Draw Entity Player visibility test
  const player = new Player(15, 20, 'HUMAN');
  const initialTextCount = textCalls.length;
  renderer2D.drawEntity(player, 15, 20, 15, 20, 5, true);
  assert(textCalls.length > initialTextCount, `2D renderer drawEntity successfully invoked canvas text rendering for Player`);

  // 3D renderer drawEntity test
  const initialDrawCount = drawCalls.length;
  renderer3D.drawEntity(player, 15, 20, 15, 20, 5, true);
  assert(drawCalls.length > initialDrawCount, `3D renderer drawEntity successfully rendered voxel/symbol for Player`);
}

// =============================================================================
// TEST SUITE 4: Game.render() transitionAlpha Clipping Guard
// =============================================================================
console.log("\n--- TEST SUITE 4: Game.render() transitionAlpha Guard ---");
{
  const game = new Game();
  game.player = new Player(10, 10, 'HUMAN');
  game.map = new DungeonMap(40, 40, 1);
  game.renderer = new Classic2DAsciiRenderer('game-canvas', 24);

  // Case A: transitionAlpha = 0 (Normal gameplay - NO black overlay)
  game.transitionAlpha = 0;
  fillRectCalls.length = 0;
  game.render();
  const blackOverlaysWhenZero = fillRectCalls.filter(c => c.fillStyle && c.fillStyle.includes('rgba(0, 0, 0'));
  assert(blackOverlaysWhenZero.length === 0, `No black overlay drawn when transitionAlpha = 0`);

  // Case B: transitionAlpha = 0.0005 (Micro-fraction <= 0.001 - NO black overlay)
  game.transitionAlpha = 0.0005;
  fillRectCalls.length = 0;
  game.render();
  const blackOverlaysMicro = fillRectCalls.filter(c => c.fillStyle && c.fillStyle.includes('rgba(0, 0, 0'));
  assert(blackOverlaysMicro.length === 0, `No black overlay drawn when transitionAlpha = 0.0005 (<= 0.001 guard active)`);

  // Case C: transitionAlpha = 0.8 (Active floor transition - Black overlay present)
  game.transitionAlpha = 0.8;
  fillRectCalls.length = 0;
  game.render();
  const blackOverlaysActive = fillRectCalls.filter(c => c.fillStyle && c.fillStyle.includes('rgba(0, 0, 0'));
  assert(blackOverlaysActive.length > 0, `Black transition overlay correctly drawn when transitionAlpha = 0.8 (> 0.001)`);
}

// =============================================================================
// TEST SUITE 5: Game resetToNewGame() & nextFloor() Camera Z-Height Propagation
// =============================================================================
console.log("\n--- TEST SUITE 5: Camera Z-Height Propagation in Floor Transitions ---");
{
  const game = new Game();
  let lastSnapZ = null;
  game.renderer = {
    canvas: mockCanvas,
    ctx: mockCtx,
    mapBridge: {
      getTopVoxel: (x, y) => ({ z: 5, type: 'floor' })
    },
    snapCamera: (x, y, z) => {
      lastSnapZ = z;
    },
    clear: () => {},
    drawMap: () => {},
    drawItem: () => {},
    drawEntity: () => {},
    setZoom: () => {}
  };

  // Test resetToNewGame
  game.resetToNewGame('HUMAN');
  assert(lastSnapZ === 5, `resetToNewGame propagates top voxel height (z=5) to snapCamera`);

  // Test nextFloor
  lastSnapZ = null;
  game.nextFloor();
  assert(lastSnapZ === 5, `nextFloor propagates top voxel height (z=5) to snapCamera`);

  // Test prevFloor
  lastSnapZ = null;
  game.prevFloor();
  assert(lastSnapZ === 5, `prevFloor propagates top voxel height (z=5) to snapCamera`);
}

// =============================================================================
// SUMMARY & RESULTS
// =============================================================================
console.log("\n================================================================================");
console.log(`TEST SUMMARY: Passed ${passed}, Failed ${failed}`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL RENDERING PIPELINE & PLAYER VISIBILITY AUDIT TESTS PASSED (100%)!\n");
  process.exit(0);
}
