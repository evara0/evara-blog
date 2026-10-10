// Run with: node --test tests/test_personal_interactions.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const scene = require('../app/static/me-scene.js');

test('paused, reduced-motion, hidden, and focused scenes do not advance time', () => {
  for (const flag of ['paused', 'reduced', 'hidden', 'frozen']) {
    const state = scene.createState();
    scene.advance(state, 0);
    scene.advance(state, 20);
    assert.equal(state.time, .02);
    state[flag] = true;
    scene.advance(state, 2000);
    assert.equal(state.time, .02, flag);
    state[flag] = false;
    scene.advance(state, 2020);
    assert.equal(state.time, .04, flag);
  }
});

test('resuming never catches up a long background gap', () => {
  const state = scene.createState();
  scene.advance(state, 0);
  state.lastFrame = null;
  scene.advance(state, 500000);
  assert.equal(state.time, 0);
  scene.advance(state, 500016);
  assert.equal(state.time, .016);
  scene.advance(state, 900000);
  assert.ok(state.time <= .067);
});

test('travel and tilt are bounded after excessive input', () => {
  const state = scene.createState();
  state.paused = true;
  scene.move(state, -100000);
  assert.equal(state.travel, 0);
  scene.move(state, 100000);
  assert.equal(state.travel, scene.MAX_TRAVEL);
  scene.drag(state, 10, 100000);
  assert.equal(state.pitch, .72);
  scene.drag(state, 10, -100000);
  assert.equal(state.pitch, -.72);
});

test('reset restores camera and preserves time and pause preference', () => {
  const state = scene.createState();
  scene.drag(state, 200, 100);
  scene.move(state, 300);
  state.paused = true;
  state.time = 42;
  scene.reset(state);
  for (const key of Object.keys(scene.INITIAL)) assert.equal(state[key], scene.INITIAL[key]);
  assert.equal(state.paused, true);
  assert.equal(state.time, 42);
});

test('perspective enlarges close objects and rejects points behind the camera', () => {
  const state = scene.createState();
  state.yaw = state.pitch = 0;
  const near = scene.project({ x: 50, y: 20, z: -300 }, state, 1200, 800);
  const far = scene.project({ x: 50, y: 20, z: 300 }, state, 1200, 800);
  assert.ok(near.scale > far.scale);
  assert.ok(near.x > far.x);
  assert.equal(scene.project({ x: 0, y: 0, z: -1200 }, state, 1200, 800), null);
});

test('rotating the camera changes the projected position without NaN at phone sizes', () => {
  const state = scene.createState();
  const point = { x: 180, y: 75, z: 130 };
  const initial = scene.project(point, state, 320, 740);
  scene.drag(state, 120, 40);
  const moved = scene.project(point, state, 320, 740);
  assert.notEqual(initial.x, moved.x);
  for (const value of Object.values(moved)) assert.ok(Number.isFinite(value));
});

test('text rings close continuously and have real depth, not a flat text strip', () => {
  const a = scene.ringPoint(0, 250, 30);
  const b = scene.ringPoint(Math.PI * 2, 250, 30);
  assert.ok(Math.abs(a.x - b.x) < 1e-10);
  assert.ok(Math.abs(a.z - b.z) < 1e-10);
  const mid = scene.ringPoint(Math.PI / 2, 250, 30);
  assert.ok(Math.abs(mid.z - a.z) > 200);
  assert.equal(a.y, 30);
});

test('object motion is deterministic and responds to scene time', () => {
  assert.deepEqual(scene.objectPoints(0), scene.objectPoints(0));
  assert.notDeepEqual(scene.objectPoints(0), scene.objectPoints(10));
  assert.equal(scene.objectPoints(0).length, 3);
});

test('Canvas failure keeps the original static content visible and controls hidden', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/static/me.js'), 'utf8');
  let immersive = false;
  const controls = { hidden: true };
  const root = { classList: { add: () => { immersive = true; } } };
  const canvas = { getContext: () => null };
  const document = {
    documentElement: root,
    getElementById: id => id === 'universe' ? canvas : {},
    querySelector: () => controls,
    querySelectorAll: () => [],
  };
  vm.runInNewContext(source, {
    document,
    window: { CosmicScene: scene, matchMedia: () => ({ matches: false }) },
    console: { warn() {} },
  });
  assert.equal(immersive, false);
  assert.equal(controls.hidden, true);
});

function interactivePage(reduced = false) {
  const frames = new Map();
  let nextFrame = 1, state, draws = 0, document;
  class Element {
    constructor(id = '') {
      this.id = id; this.dataset = {}; this.hidden = true; this.listeners = {}; this.attrs = {};
      this.classes = new Set();
      this.classList = { add: v => this.classes.add(v), remove: v => this.classes.delete(v), contains: v => this.classes.has(v) };
      this.style = { setProperty() {} }; this.offsetWidth = 100; this.tagName = 'BUTTON';
    }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    emit(name, event = {}) { this.listeners[name]?.(event); }
    setAttribute(name, value) { this.attrs[name] = value; }
    focus() { document.activeElement = this; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
    showModal() { this.open = true; document.activeElement = this.closeButton; }
    close() { this.open = false; this.emit('close'); }
    querySelector(selector) { return selector === '.dialog-close' ? this.closeButton : selector === '.dialog-body' ? this.body : this.heading; }
  }
  const root = new Element();
  const canvas = new Element('universe');
  const controls = new Element();
  const ids = Object.fromEntries(['motion-toggle', 'motion-label', 'motion-icon', 'scene-status', 'zoom-in', 'zoom-out', 'reset-view', 'journey-region', 'journey-progress', 'journey-percent', 'zone-caption-title', 'zone-caption-text', 'journey-scrubber', 'journey-phase', 'stop-travel', 'settings-dialog', 'settings-toggle', 'settings-close', 'travel-speed', 'look-sensitivity', 'speed-value', 'sensitivity-value', 'settings-reset'].map(id => [id, new Element(id)]));
  ids['travel-speed'].value = '1'; ids['look-sensitivity'].value = '1';
  ids['settings-dialog'].closeButton = ids['settings-close'];
  ids['journey-scrubber'].tagName = 'INPUT';
  ids.universe = canvas;
  const dialogs = ['about', 'systems', 'sound'].map(name => {
    const dialog = new Element(`${name}-panel`);
    dialog.closeButton = new Element(); dialog.heading = {};
    dialog.body = new Element(); dialog.body.dataset.source = `${name}-source`; dialog.body.heading = {};
    ids[dialog.id] = dialog; ids[`${name}-source`] = { innerHTML: '<h2>个人内容</h2>' };
    return dialog;
  });
  const nodes = dialogs.map(dialog => {
    const node = new Element(); node.dataset.panel = dialog.id; node.classes.add('space-node'); return node;
  });
  const dock = new Element(); dock.dataset.panel = dialogs[0].id;
  const routes = scene.ZONES.map(zone => { const button = new Element(); button.dataset.travel = String(zone.travel); return button; });
  const body = new Element(); body.tagName = 'BODY';
  document = new Element();
  document.documentElement = root; document.hidden = false; document.activeElement = body;
  document.getElementById = id => ids[id];
  document.querySelector = () => controls;
  document.querySelectorAll = selector => selector === '.space-node' ? nodes : selector === '.content-dialog' ? dialogs : selector === '[data-travel]' ? routes : [...nodes, dock];
  const media = { matches: reduced, addEventListener(name, handler) { this.change = handler; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/static/me.js'), 'utf8'), {
    document,
    window: { matchMedia: () => media, addEventListener() {}, CosmicScene: { ...scene, Universe: class {
      constructor(canvas, value) { state = value; }
      draw() { draws++; }
      resize() {}
    } } },
    requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    console: { warn() {} },
  });
  return { state, ids, canvas, nodes, dock, routes, dialogs, document, body, media, frames, get draws() { return draws; } };
}

test('touch pointer drag updates view, while cancel releases capture and stops movement', () => {
  const page = interactivePage();
  const start = page.state.yaw;
  page.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 8, button: 0, clientX: 50, clientY: 60 });
  page.canvas.emit('pointermove', { pointerType: 'touch', pointerId: 8, clientX: 120, clientY: 90 });
  assert.notEqual(page.state.yaw, start);
  assert.equal(page.canvas.capture, 8);
  page.canvas.emit('pointercancel', { pointerId: 8 });
  const cancelled = page.state.yaw;
  assert.equal(page.canvas.capture, null);
  assert.equal(page.canvas.classes.has('dragging'), false);
  page.canvas.emit('pointermove', { pointerId: 8, clientX: 180, clientY: 120 });
  assert.equal(page.state.yaw, cancelled);
});

test('UI reduced-motion and visibility wiring stop the frame loop but allow active travel', () => {
  const page = interactivePage(true);
  assert.equal(page.frames.size, 0);
  assert.equal(page.ids['motion-toggle'].disabled, true);
  const before = page.draws;
  page.ids['zoom-in'].emit('click');
  assert.equal(page.state.travel, 260);
  assert.ok(page.draws > before);
  assert.equal(page.frames.size, 0);
  page.media.matches = false; page.media.change();
  assert.equal(page.frames.size, 1);
  page.document.hidden = true; page.document.emit('visibilitychange');
  assert.equal(page.frames.size, 0);
  page.document.hidden = false; page.document.emit('visibilitychange');
  assert.equal(page.frames.size, 1);
  page.ids['motion-toggle'].emit('click');
  assert.equal(page.frames.size, 0);
  assert.equal(page.ids['motion-toggle'].attrs['aria-pressed'], 'true');
});

test('opening content freezes the scene and closing restores its original entry focus', () => {
  const page = interactivePage();
  page.dock.emit('click');
  assert.equal(page.dialogs[0].open, true);
  assert.equal(page.state.frozen, true);
  assert.equal(page.frames.size, 0);
  page.dialogs[0].closeButton.emit('click');
  assert.equal(page.dialogs[0].open, false);
  assert.equal(page.document.activeElement, page.dock);
  assert.equal(page.state.frozen, false);
  assert.equal(page.frames.size, 1);
});

test('advancing crosses a shape and going back reveals it again', () => {
  const state = scene.createState();
  state.yaw = state.pitch = 0;
  state.paused = true;
  const origin = { x: 0, y: 0, z: 0 };
  const initial = scene.project(origin, state, 1280, 800);
  assert.ok(initial);
  scene.move(state, 1700);
  assert.equal(scene.project(origin, state, 1280, 800), null);
  assert.ok(scene.project({ x: 140, y: -50, z: 1900 }, state, 1280, 800));
  scene.move(state, -1700);
  assert.deepEqual(scene.project(origin, state, 1280, 800), initial);
});

test('near and distant points have different parallax with fixed focal length', () => {
  const state = scene.createState();
  state.yaw = state.pitch = 0; state.paused = true;
  const near = { x: 250, y: 0, z: 300 }, far = { x: 250, y: 0, z: 5000 };
  const nearBefore = scene.project(near, state, 1280, 800), farBefore = scene.project(far, state, 1280, 800);
  scene.move(state, 350);
  const nearAfter = scene.project(near, state, 1280, 800), farAfter = scene.project(far, state, 1280, 800);
  assert.ok(Math.abs(nearAfter.x - nearBefore.x) > Math.abs(farAfter.x - farBefore.x) * 5);
  assert.ok(nearAfter.scale / nearBefore.scale > farAfter.scale / farBefore.scale);
  assert.ok(scene.cameraPosition(state).z > -1120);
});

test('ordinary travel approaches the destination smoothly and freezes with content open', () => {
  const state = scene.createState();
  scene.moveTo(state, 1900);
  assert.equal(state.travel, 0);
  scene.advance(state, 0); scene.advance(state, 20);
  assert.ok(state.travel > 0 && state.travel < 1900);
  const partial = state.travel;
  state.frozen = true; scene.advance(state, 1000);
  assert.equal(state.travel, partial);
  state.frozen = false;
  for (let t = 1020; t <= 3000; t += 20) scene.advance(state, t);
  assert.equal(state.travel, 1900);
});

test('waypoints, keyboard, and reset update the real position in still mode', () => {
  const page = interactivePage(true);
  page.routes[2].emit('click');
  assert.equal(page.state.travel, 3800);
  assert.equal(page.ids['journey-region'].textContent, '03 / 声音星域');
  assert.equal(page.canvas.dataset.travel, '3800');
  let prevented = false;
  page.document.emit('keydown', { key: 's', target: page.body, preventDefault() { prevented = true; } });
  assert.equal(page.state.travel, 3540);
  assert.equal(prevented, true);
  page.ids['reset-view'].emit('click');
  assert.equal(page.state.travel, 0);
  assert.equal(page.state.targetTravel, 0);
  assert.equal(page.ids['journey-percent'].textContent, '0.0%');
  assert.equal(page.frames.size, 0);
});

test('opposite input reverses an unfinished flight instead of continuing toward its old target', () => {
  const state = scene.createState();
  scene.moveTo(state, 3800);
  scene.advance(state, 0); scene.advance(state, 50);
  const current = state.travel;
  scene.move(state, -260);
  assert.ok(state.targetTravel < current);
  scene.advance(state, 100);
  assert.ok(state.travel < current);
});

test('travel keys work with controls focused and do not capture browser shortcuts', () => {
  const page = interactivePage(true);
  page.document.emit('keydown', { key: 'w', target: page.ids['motion-toggle'], preventDefault() {} });
  assert.equal(page.state.travel, 260);
  let prevented = false;
  page.document.emit('keydown', { key: 'w', ctrlKey: true, target: page.body, preventDefault() { prevented = true; } });
  assert.equal(page.state.travel, 260);
  assert.equal(prevented, false);
});

test('precise seek cancels the old destination and a focused range keeps its value', () => {
  const page = interactivePage();
  page.routes[2].emit('click');
  page.document.activeElement = page.ids['journey-scrubber'];
  page.ids['journey-scrubber'].emit('focus');
  page.ids['journey-scrubber'].value = '37.5';
  page.ids['journey-scrubber'].emit('input');
  assert.equal(page.state.travel, 2400);
  assert.equal(page.state.targetTravel, 2400);
  assert.equal(page.ids['journey-scrubber'].value, '37.5');
  assert.equal(page.frames.size, 0);
  page.document.activeElement = page.body;
  page.ids['journey-scrubber'].emit('blur');
  assert.equal(page.frames.size, 1);
});

test('speed and sensitivity are bounded and change flight and observation response', () => {
  const slow = scene.createState(), fast = scene.createState();
  scene.setControls(slow, .35, .35); scene.setControls(fast, 1.6, 1.6);
  scene.moveTo(slow, 1900); scene.moveTo(fast, 1900);
  scene.advance(slow, 0); scene.advance(fast, 0);
  scene.advance(slow, 50); scene.advance(fast, 50);
  assert.ok(slow.travel < fast.travel);
  scene.drag(slow, 50, 20); scene.drag(fast, 50, 20);
  assert.ok(Math.abs(slow.yaw - scene.INITIAL.yaw) < Math.abs(fast.yaw - scene.INITIAL.yaw));
  scene.setControls(slow, -50, 500);
  assert.equal(slow.speed, .35); assert.equal(slow.sensitivity, 1.6);
});

test('stop and opening content cancel pending flight while keeping current position', () => {
  const page = interactivePage();
  page.routes[2].emit('click');
  page.state.travel = 500;
  page.document.emit('keydown', { key: 'Escape', target: page.body, preventDefault() {} });
  assert.equal(page.state.travel, 500); assert.equal(page.state.targetTravel, 500);
  assert.equal(page.state.paused, false);
  page.routes[2].emit('click');
  page.state.travel = 750;
  page.dock.emit('click');
  assert.equal(page.state.targetTravel, 750);
  page.dialogs[0].close();
  assert.equal(page.state.travel, 750);
});

test('settings freeze the scene, adjust controls and restore focus and defaults', () => {
  const page = interactivePage();
  page.ids['settings-toggle'].emit('click');
  assert.equal(page.ids['settings-dialog'].open, true);
  assert.equal(page.frames.size, 0);
  page.ids['travel-speed'].value = '.5'; page.ids['travel-speed'].emit('input');
  page.ids['look-sensitivity'].value = '.7'; page.ids['look-sensitivity'].emit('input');
  assert.equal(page.state.speed, .5); assert.equal(page.state.sensitivity, .7);
  page.ids['settings-reset'].emit('click');
  assert.equal(page.state.speed, 1); assert.equal(page.state.sensitivity, 1);
  page.ids['settings-close'].emit('click');
  assert.equal(page.document.activeElement, page.ids['settings-toggle']);
  assert.equal(page.frames.size, 1);
});

test('Shift makes fine steps and Ctrl-wheel is left to the browser', () => {
  const page = interactivePage(true);
  page.document.emit('keydown', { key: 'W', shiftKey: true, target: page.body, preventDefault() {} });
  assert.equal(page.state.travel, 52);
  page.ids['zoom-in'].emit('click', { shiftKey: true });
  assert.equal(page.state.travel, 104);
  let prevented = false;
  page.canvas.emit('wheel', { ctrlKey: true, deltaY: 200, preventDefault() { prevented = true; } });
  assert.equal(page.state.travel, 104); assert.equal(prevented, false);
});
