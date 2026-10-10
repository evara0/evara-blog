(() => {
  const canvas = document.getElementById('universe');
  const root = document.documentElement;
  const controls = document.querySelector('.cosmos-controls');
  const nodes = [...document.querySelectorAll('.space-node')];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const api = window.CosmicScene;
  if (!api || !canvas) return;
  const state = api.createState();
  let frame = 0;
  let scene;
  let pointer = null;
  let hovered = false;
  let opener = null;
  let dialogOpen = false;
  const toggle = document.getElementById('motion-toggle');
  const label = document.getElementById('motion-label');
  const status = document.getElementById('scene-status');
  const scrubber = document.getElementById('journey-scrubber');
  const settingsDialog = document.getElementById('settings-dialog');
  const speedInput = document.getElementById('travel-speed');
  const sensitivityInput = document.getElementById('look-sensitivity');
  let seeking = false;
  let settingsOpen = false;
  let lastRegion = 'arrival';

  function updateJourney() {
    const zone = api.regionFor(state.travel);
    canvas.dataset.travel = Math.round(state.travel).toString();
    canvas.dataset.targetTravel = Math.round(state.targetTravel).toString();
    document.getElementById('journey-region').textContent = zone.title;
    document.getElementById('journey-progress').value = state.travel;
    const percentage = state.travel / api.MAX_TRAVEL * 100;
    document.getElementById('journey-percent').textContent = `${percentage.toFixed(1)}%`;
    if (!seeking && document.activeElement !== scrubber) scrubber.value = percentage.toFixed(2);
    const flying = Math.abs(state.travel - state.targetTravel) > 1;
    document.getElementById('journey-phase').textContent = flying ? `前往${api.regionFor(state.targetTravel).title.split(' / ')[1]}` : '位置已就绪 · 拖动航程可定位';
    document.getElementById('stop-travel').disabled = !flying;
    document.getElementById('zone-caption-title').textContent = `${zone.name} / DEEP SPACE`;
    document.getElementById('zone-caption-text').textContent = zone.caption;
    document.getElementById('zoom-in').disabled = state.targetTravel >= api.MAX_TRAVEL;
    document.getElementById('zoom-out').disabled = state.targetTravel <= 0;
    document.querySelectorAll('[data-travel]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.travel) === zone.travel)));
    if (lastRegion !== zone.id) status.textContent = `已进入${zone.title.split(' / ')[1]}`;
    lastRegion = zone.id;
  }

  function placeNodes(objects, width, height) {
    objects.forEach((point, index) => {
      const nearby = point && point.depth < 2400 && point.x > 35 && point.x < width - 35 && point.y > 170 && point.y < height - 110;
      nodes[index].hidden = !nearby;
      if (!nearby) return;
      nodes[index].classList.remove('label-muted');
      const nodeWidth = nodes[index].offsetWidth || 140;
      let x = Math.max(15, Math.min(width - nodeWidth - 15, point.x - nodeWidth * .25));
      let y = Math.max(height < 550 ? 180 : 240, Math.min(height - (height < 550 ? 115 : width < 501 ? 190 : 175), point.y + (width < 501 ? 15 : 40)));
      if (height < 550 && x < width * .32) y = 190;
      const nodeHeight = nodes[index].offsetHeight || 42;
      const panels = [...document.querySelectorAll('.journey-hud, .journey-routes, .cosmos-dock, .cosmos-controls, .universe-intro')].map(panel => panel.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
      const covered = (left, top, w = nodeWidth, h = nodeHeight) => panels.some(rect => left < rect.right + 8 && left + w > rect.left - 8 && top < rect.bottom + 8 && top + h > rect.top - 8);
      if (covered(x, y)) {
        const above = Math.max(180, point.y - nodeHeight - 24);
        if (!covered(x, above)) y = above;
        else if (!covered(point.x - 48, point.y - 48, 96, 96)) {
          x = point.x - 48; y = point.y - 48;
          nodes[index].classList.add('label-muted');
        } else { nodes[index].hidden = true; return; }
      }
      nodes[index].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      nodes[index].style.setProperty('--hit-x', `${point.x - x - 48}px`);
      nodes[index].style.setProperty('--hit-y', `${point.y - y - 48}px`);
    });
  }
  try {
    scene = new api.Universe(canvas, state, placeNodes);
    scene.draw();
  } catch (error) {
    console.warn('宇宙绘图不可用，显示可阅读的静态内容。', error);
    return;
  }

  const dialogs = [...document.querySelectorAll('.content-dialog')];
  // Content is authored once in accessible HTML; dialogs receive an independent copy.
  dialogs.forEach(dialog => {
    const body = dialog.querySelector('.dialog-body');
    const source = document.getElementById(body.dataset.source);
    body.innerHTML = source.innerHTML;
    body.querySelector('h2').id = `${dialog.id}-title`;
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialogOpen = false;
      opener?.focus({ preventScroll: true });
      sync();
    });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  });

  document.querySelectorAll('[data-panel]').forEach(button => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.panel);
      api.stop(state);
      opener = button;
      dialog.showModal();
      dialogOpen = true;
      sync();
    });
  });
  root.classList.add('immersive');
  ['.floating-nodes', '.cosmos-dock', '.cosmos-controls', '.scene-help', '.journey-hud', '.journey-routes'].forEach(selector => { document.querySelector(selector).hidden = false; });

  function render(timestamp) {
    frame = 0;
    // Deep space contains several sculptures: draw at 30 fps instead of saturating
    // the main thread, while keeping input-driven redraws immediate.
    if (state.lastFrame !== null && timestamp - state.lastFrame < 32) {
      frame = requestAnimationFrame(render);
      return;
    }
    api.advance(state, timestamp);
    scene.draw();
    updateJourney();
    if (api.moving(state)) frame = requestAnimationFrame(render);
  }
  function redraw() {
    scene.draw();
    updateJourney();
    if (api.moving(state) && !frame) {
      state.lastFrame = null;
      frame = requestAnimationFrame(render);
    }
  }
  function sync() {
    state.reduced = media.matches;
    state.hidden = document.hidden;
    state.frozen = hovered || dialogOpen || settingsOpen || seeking || document.activeElement === scrubber || document.activeElement?.classList.contains('space-node');
    toggle.disabled = state.reduced;
    toggle.setAttribute('aria-pressed', String(state.paused || state.reduced));
    label.textContent = state.reduced ? '静止模式' : state.paused ? '继续' : '暂停';
    document.getElementById('motion-icon').textContent = state.paused || state.reduced ? '▷' : 'Ⅱ';
    if (!api.moving(state)) {
      cancelAnimationFrame(frame);
      frame = 0;
      state.lastFrame = null;
    }
    redraw();
  }
  toggle.addEventListener('click', () => { state.paused = !state.paused; sync(); });
  function stopTravel() {
    api.stop(state);
    redraw();
    status.textContent = '航行已停止，停留在当前位置';
  }
  document.getElementById('stop-travel').addEventListener('click', stopTravel);
  scrubber.addEventListener('pointerdown', () => { seeking = true; sync(); });
  scrubber.addEventListener('focus', sync);
  scrubber.addEventListener('input', () => {
    api.seek(state, Number(scrubber.value) / 100 * api.MAX_TRAVEL);
    redraw();
  });
  ['change', 'pointerup', 'pointercancel', 'blur'].forEach(name => scrubber.addEventListener(name, () => { seeking = false; sync(); }));
  function updateSettings() {
    api.setControls(state, Number(speedInput.value), Number(sensitivityInput.value));
    document.getElementById('speed-value').textContent = `${state.speed.toFixed(2)}×`;
    document.getElementById('sensitivity-value').textContent = `${state.sensitivity.toFixed(2)}×`;
    canvas.dataset.speed = state.speed.toString();
    canvas.dataset.sensitivity = state.sensitivity.toString();
  }
  speedInput.addEventListener('input', updateSettings);
  sensitivityInput.addEventListener('input', updateSettings);
  document.getElementById('settings-toggle').addEventListener('click', () => {
    api.stop(state);
    settingsOpen = true;
    settingsDialog.showModal();
    sync();
  });
  document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());
  settingsDialog.addEventListener('close', () => {
    settingsOpen = false;
    document.getElementById('settings-toggle').focus({ preventScroll: true });
    sync();
  });
  document.getElementById('settings-reset').addEventListener('click', () => {
    speedInput.value = '1'; sensitivityInput.value = '1'; updateSettings();
  });
  media.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  nodes.forEach(node => {
    node.addEventListener('pointerenter', () => { hovered = true; sync(); });
    node.addEventListener('pointerleave', () => { hovered = false; sync(); });
    node.addEventListener('focus', sync);
    node.addEventListener('blur', () => { requestAnimationFrame(sync); });
  });

  function travelBy(amount) {
    api.move(state, amount * state.speed);
    redraw();
  }
  document.getElementById('zoom-in').addEventListener('click', event => travelBy(260 * (event.shiftKey ? .2 : 1)));
  document.getElementById('zoom-out').addEventListener('click', event => travelBy(-260 * (event.shiftKey ? .2 : 1)));
  document.querySelectorAll('[data-travel]').forEach(button => button.addEventListener('click', () => {
    api.moveTo(state, Number(button.dataset.travel));
    // Face the route when navigating directly to a distant destination.
    state.yaw = api.INITIAL.yaw;
    state.pitch = api.INITIAL.pitch;
    redraw();
  }));
  document.getElementById('reset-view').addEventListener('click', () => {
    api.reset(state); redraw();
    status.textContent = '已返回初始坐标';
  });
  canvas.addEventListener('wheel', event => {
    if (dialogOpen || settingsOpen || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const units = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 500 : 1;
    travelBy(Math.max(-640, Math.min(640, event.deltaY * units * 1.8)) * (event.shiftKey ? .2 : 1));
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || dialogOpen || pointer) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const fine = event.shiftKey ? .2 : 1;
    api.drag(state, (event.clientX - pointer.x) * fine, (event.clientY - pointer.y) * fine);
    pointer.x = event.clientX; pointer.y = event.clientY;
    status.textContent = '';
    redraw();
  });
  function release(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer = null;
    canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', event => { if (pointer?.id === event.pointerId) { pointer = null; canvas.classList.remove('dragging'); } });
  document.addEventListener('keydown', event => {
    if (dialogOpen || settingsOpen || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); stopTravel(); return; }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
    const step = { w: 260, W: 260, s: -260, S: -260, PageDown: 520, PageUp: -520 }[event.key];
    if (step) { event.preventDefault(); travelBy(step * (event.shiftKey ? .2 : 1)); return; }
    if (!['BODY', 'HTML', 'MAIN'].includes(event.target.tagName)) return;
    if (event.key === ' ' && !event.repeat) { event.preventDefault(); state.paused = !state.paused; sync(); return; }
    const directions = { ArrowLeft: [-22, 0], ArrowRight: [22, 0], ArrowUp: [0, -22], ArrowDown: [0, 22] };
    if (!directions[event.key]) return;
    event.preventDefault();
    api.drag(state, ...directions[event.key].map(value => value * (event.shiftKey ? .2 : 1)));
    status.textContent = '视角已转动';
    redraw();
  });
  window.addEventListener('resize', () => { scene.resize(); redraw(); });
  document.fonts?.ready.then(() => { scene.layoutCache?.clear(); redraw(); });
  updateSettings();
  sync();
})();
