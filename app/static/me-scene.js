/* A small, dependency-free perspective scene. Shared with the Node behavior tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CosmicScene = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const INITIAL = { yaw: -0.04, pitch: -0.035, travel: 0, targetTravel: 0 };
  const MAX_TRAVEL = 6400;
  const ZONES = [
    { id: 'arrival', title: '01 / 起点', name: 'EVARA', travel: 0, x: 0, y: 0, color: '#e8d4ff', caption: '从这里，向未知出发。' },
    { id: 'systems', title: '02 / 构造星域', name: 'MAKE', travel: 1900, x: 140, y: -50, color: '#98fff0', caption: '想法，在深空中连接成结构。' },
    { id: 'sound', title: '03 / 声音星域', name: 'SOUND', travel: 3800, x: -140, y: 75, color: '#ffacd9', caption: '沿着频率，发现新的关系。' },
    { id: 'unknown', title: '04 / 未知星域', name: 'UNWRITTEN', travel: 5700, x: 60, y: -30, color: '#c3efad', caption: '还没有被命名的可能性。' },
  ];

  function createState() {
    return { ...INITIAL, time: 0, lastFrame: null, paused: false, reduced: false, hidden: false, frozen: false, speed: 1, sensitivity: 1 };
  }
  function moving(state) { return !state.paused && !state.reduced && !state.hidden && !state.frozen; }
  function advance(state, timestamp) {
    if (state.lastFrame !== null && moving(state)) {
      const dt = clamp((timestamp - state.lastFrame) / 1000, 0, 0.05);
      state.time += dt;
      state.travel += (state.targetTravel - state.travel) * (1 - Math.exp(-dt * 6 * state.speed));
      if (Math.abs(state.travel - state.targetTravel) < .5) state.travel = state.targetTravel;
    }
    state.lastFrame = timestamp;
    return state.time;
  }
  function drag(state, dx, dy) {
    state.yaw = clamp(state.yaw + dx * 0.004 * state.sensitivity, -.7, .7);
    state.pitch = clamp(state.pitch + dy * 0.003 * state.sensitivity, -0.72, 0.72);
  }
  function moveTo(state, destination) {
    state.targetTravel = clamp(destination, 0, MAX_TRAVEL);
    if (!moving(state)) state.travel = state.targetTravel;
  }
  function move(state, amount) {
    const reversing = (state.targetTravel - state.travel) * amount < 0;
    moveTo(state, (moving(state) && !reversing ? state.targetTravel : state.travel) + amount);
  }
  function seek(state, destination) {
    state.travel = clamp(destination, 0, MAX_TRAVEL);
    state.targetTravel = state.travel;
  }
  function stop(state) { state.targetTravel = state.travel; }
  function setControls(state, speed, sensitivity) {
    state.speed = clamp(Number.isFinite(speed) ? speed : 1, .35, 1.6);
    state.sensitivity = clamp(Number.isFinite(sensitivity) ? sensitivity : 1, .35, 1.6);
  }
  function regionFor(travel) {
    return ZONES.reduce((nearest, zone) => Math.abs(zone.travel - travel) < Math.abs(nearest.travel - travel) ? zone : nearest, ZONES[0]);
  }
  function cameraPosition(state) {
    let index = ZONES.findIndex(zone => zone.travel > state.travel);
    if (index < 0) index = ZONES.length - 1;
    const a = ZONES[Math.max(0, index - 1)], b = ZONES[index];
    const fraction = clamp((state.travel - a.travel) / Math.max(1, b.travel - a.travel), 0, 1);
    const t = fraction * fraction * (3 - 2 * fraction);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: state.travel - 1120 };
  }
  function reset(state) { Object.assign(state, INITIAL); }
  function rotate(point, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    const x = point.x * cy + point.z * sy;
    const z = point.z * cy - point.x * sy;
    return { x, y: point.y * cx - z * sx, z: point.y * sx + z * cx };
  }
  function project(point, state, width, height) {
    const camera = cameraPosition(state);
    const rotated = rotate({ x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z }, state.yaw, state.pitch);
    const depth = rotated.z;
    if (depth < 145) return null;
    const unit = Math.min(width / 1040, height / 720);
    const scale = 1040 / depth * unit;
    return { x: width * 0.52 + rotated.x * scale, y: height * 0.51 + rotated.y * scale, scale, depth, z: rotated.z };
  }
  function ringPoint(angle, radius, height, tilt = 0) {
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    return { x, y: height + x * Math.sin(tilt), z: z + x * Math.cos(tilt) * 0.08 };
  }
  function objectPoints(time) {
    return [
      { x: -400 + Math.sin(time * .12) * 22, y: -70 + Math.cos(time * .18) * 20, z: 100 },
      { x: 140 + 370 + Math.cos(time * .13) * 20, y: -180 + Math.sin(time * .15) * 25, z: 1980 },
      { x: -140 + 330 + Math.sin(time * .16) * 28, y: 220 + Math.cos(time * .11) * 16, z: 3900 },
    ];
  }
  function seededRandom(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  class Universe {
    constructor(canvas, state, onObjects) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      if (!this.ctx) throw new Error('Canvas 2D unavailable');
      this.state = state;
      this.onObjects = onObjects;
      this.layoutCache = new Map();
      const random = seededRandom(4319);
      this.stars = Array.from({ length: 1900 }, () => ({ x: (random() - .5) * 3100, y: (random() - .5) * 2100, z: random() * 8600 - 450, size: random() * 2 + .4, phase: random() * TAU }));
      const alphabet = ['∞', '谱', '↗', '{ }', '♮', 'a', '造', '01', '∿', 'Ω', 'e', '♫', '思', '∂'];
      this.glyphs = Array.from({ length: 64 }, (_, i) => ({ text: alphabet[i % alphabet.length], x: (random() - .5) * 1600, y: (random() - .5) * 1100, z: random() * 7800 - 180, phase: random() * TAU, font: i % 3 }));
      this.resize();
    }
    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.nebula = this.createNebula();
    }
    createNebula() {
      const cloud = document.createElement('canvas');
      cloud.width = Math.min(1400, Math.round(this.width));
      cloud.height = Math.min(1000, Math.round(this.height));
      const ctx = cloud.getContext('2d');
      const random = seededRandom(921);
      const w = cloud.width, h = cloud.height;
      ctx.globalCompositeOperation = 'screen';
      // Curved clouds, rather than a smooth gradient panel, form a diagonal galaxy.
      for (let i = 0; i < 92; i++) {
        const t = random();
        const x = (t * .92 + .06) * w;
        const y = (0.75 - t * .42 + Math.sin(t * 8) * .09 + (random() - .5) * .15) * h;
        const r = (random() * .09 + .03) * Math.max(w, h);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        const color = t > .5 ? '161,26,186' : '35,66,209';
        gradient.addColorStop(0, `rgba(${color},${.035 + random() * .055})`);
        gradient.addColorStop(.35, `rgba(${color},.022)`);
        gradient.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 3500; i++) {
        const t = random();
        const x = (t * .9 + .05) * w;
        const y = (.73 - t * .39 + Math.sin(t * 8) * .075 + (random() - .5) * .1) * h;
        ctx.fillStyle = `rgba(${t > .5 ? '242,137,255' : '138,161,255'},${random() * .15})`;
        const r = random() * 1.2;
        ctx.fillRect(x, y, r, r);
      }
      return cloud;
    }
    textItems(time) {
      const items = [];
      const spread = this.width < 600 ? 1.22 : 1;
      ZONES.forEach((zone, zoneIndex) => {
      const rows = [
        { text: `${zone.name} · ${zone.name} · ${zone.name} · `, y: -82, radius: 260, size: zoneIndex === 3 ? 41 : 58, color: zone.color, speed: .07, font: '700 SIZEpx Quicksand, sans-serif' },
        { text: ['SYSTEMS / SOUND / THOUGHTS / ', 'BUILD / CONNECT / CREATE / ', 'WAVES / RESONANCE / RHYTHM / ', '未知 · POSSIBILITIES · 未完成 · '][zoneIndex], y: 8, radius: 270, size: 27, color: zone.color, speed: -.065, font: 'italic SIZEpx Georgia, serif' },
        { text: `${zone.name} · ${zone.name} · ${zone.name} · `, y: 96, radius: 260, size: zoneIndex === 3 ? 38 : 50, color: zone.color, speed: .07, font: '700 SIZEpx Quicksand, sans-serif' },
      ];
      const world = p => ({ x: p.x + zone.x, y: p.y + zone.y, z: p.z + zone.travel });
      rows.forEach(row => {
        const key = `${row.text}|${row.font}|${row.size}`;
        if (!this.layoutCache.has(key)) {
          this.ctx.font = row.font.replace('SIZE', row.size);
          const widths = [...row.text].map(letter => Math.max(4, this.ctx.measureText(letter).width) + 3);
          const total = widths.reduce((sum, width) => sum + width, 0);
          let offset = 0;
          this.layoutCache.set(key, [...row.text].map((letter, index) => {
            const angle = (offset + widths[index] * .5) / total * TAU;
            offset += widths[index];
            return { letter, angle };
          }));
        }
        this.layoutCache.get(key).forEach(({ letter, angle: baseAngle }) => {
          const angle = baseAngle + time * row.speed;
          const point = ringPoint(angle, row.radius * spread, row.y * spread);
          const next = ringPoint(angle + .012, row.radius * spread, row.y * spread);
          items.push({ point: world(point), next: world(next), center: { x: zone.x, y: zone.y, z: zone.travel }, letter, size: row.size * spread, font: row.font, color: row.color, kind: 'cylinder' });
        });
      });
      const words = ['   构 想 · 声 音 · 连 接 · 生 成 ·    EVARA / A PRIVATE UNIVERSE    ', '   构 造 · 系 统 · 自 动 化 ·   IDEAS BECOME STRUCTURES    ', '   音 程 · 旋 律 · 频 率 ·    SOUND IS A DIFFERENT GRAVITY    ', '   未 知 · 未 命 名 ·    STILL BECOMING / STILL UNWRITTEN    '][zoneIndex];
      [...words].forEach((letter, i, letters) => {
        const a = i / letters.length * TAU * 1.65 - time * .045;
        const point = { x: Math.cos(a) * 365, z: Math.sin(a) * 310, y: (i / letters.length - .5) * 410 };
        const next = { x: Math.cos(a + .012) * 365, z: Math.sin(a + .012) * 310, y: point.y + 1 };
        // Tilt the helix around its depth axis.
        const tilt = p => ({ x: p.x * .83 - p.y * .56, y: p.x * .56 + p.y * .83, z: p.z });
        items.push({ point: world(tilt(point)), next: world(tilt(next)), letter, size: 19, font: '400 SIZEpx ui-monospace, monospace', color: zone.color, kind: 'helix' });
      });
      });
      return items;
    }
    drawLine(points, color, width = 1) {
      const ctx = this.ctx;
      ctx.beginPath();
      let started = false;
      points.forEach(p => {
        if (!p) { started = false; return; }
        if (!started) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        started = true;
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    drawOrbit(radius, y, time, color, tilt, zone) {
      const points = Array.from({ length: 90 }, (_, i) => {
        const p = ringPoint(i / 89 * TAU + time * .015, radius, y, tilt);
        return project({ x: p.x + zone.x, y: p.y + zone.y, z: p.z + zone.travel }, this.state, this.width, this.height);
      });
      this.drawLine(points, color, .6);
    }
    drawObject(point, index, time) {
      const ctx = this.ctx;
      const center = project(point, this.state, this.width, this.height);
      if (!center) return null;
      if (center.depth > 5500) return center;
      const size = Math.min(150, 36 * center.scale);
      ctx.save();
      ctx.translate(center.x, center.y);
      if (index === 0) {
        const planet = ctx.createRadialGradient(-size * .35, -size * .35, 0, 0, 0, size);
        planet.addColorStop(0, '#dbbaff'); planet.addColorStop(.15, '#9161d8'); planet.addColorStop(.65, '#341553'); planet.addColorStop(1, '#100a21');
        ctx.shadowColor = '#bb55ff'; ctx.shadowBlur = 23 * center.scale;
        ctx.fillStyle = planet; ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.rotate(-.48); ctx.scale(1, .35);
        ctx.beginPath(); ctx.ellipse(0, 0, size * 1.65, size * 1.15, 0, 0, TAU); ctx.strokeStyle = '#c89cee80'; ctx.lineWidth = 1.2; ctx.stroke();
      } else if (index === 1) {
        const corners = Array.from({ length: 8 }, (_, i) => ({ x: (i & 1 ? 1 : -1) * 32, y: (i & 2 ? 1 : -1) * 32, z: (i & 4 ? 1 : -1) * 32 }));
        const rotated = corners.map(p => rotate(p, time * .19 + .4, .5));
        ctx.strokeStyle = '#87f8ea'; ctx.shadowColor = '#38b9bb'; ctx.shadowBlur = 14;
        for (let i = 0; i < 8; i++) for (let bit = 1; bit <= 4; bit *= 2) {
          const j = i ^ bit;
          if (j > i) {
            ctx.beginPath(); ctx.moveTo(rotated[i].x * center.scale, rotated[i].y * center.scale); ctx.lineTo(rotated[j].x * center.scale, rotated[j].y * center.scale); ctx.stroke();
          }
        }
      } else {
        ctx.strokeStyle = '#c8fa9b'; ctx.shadowColor = '#81bd44'; ctx.shadowBlur = 12;
        for (let i = -11; i <= 11; i++) {
          const amplitude = (Math.cos(i * .29 + time * .8) * .4 + .6) * Math.sin((i + 12) / 24 * Math.PI) * 33 * center.scale;
          ctx.beginPath(); ctx.moveTo(i * 4 * center.scale, -amplitude); ctx.lineTo(i * 4 * center.scale, amplitude); ctx.stroke();
        }
      }
      ctx.restore();
      return center;
    }
    draw() {
      const ctx = this.ctx, w = this.width, h = this.height, time = this.state.time;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // These cloud banks occupy different world depths. Flying through them changes
      // their relative size and screen position; they are not one fixed backdrop.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 6; i >= 0; i--) {
        const cloud = project({ x: Math.sin(i * 2.1) * 360, y: Math.cos(i * 1.7) * 110, z: i * 1250 + 450 }, this.state, w, h);
        if (!cloud) continue;
        const size = Math.min(w * 5, 1700 * cloud.scale);
        ctx.globalAlpha = clamp((cloud.depth - 145) / 500, 0, 1) * clamp(3000 / cloud.depth, .15, .85);
        ctx.drawImage(this.nebula, cloud.x - size * .5, cloud.y - size * .32, size, size * .64);
      }
      ctx.restore();
      // Slow parallax throughout the starfield establishes distance.
      ctx.save();
      this.stars.slice(0, w < 600 ? 1200 : 1900).forEach(star => {
        const p = project({ x: star.x, y: star.y, z: star.z + Math.sin(time * .02 + star.phase) * 80 }, this.state, w, h);
        if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) return;
        const opacity = (.25 + (Math.sin(time * .3 + star.phase) + 1) * .22) * clamp(3300 / p.depth, .18, 1);
        ctx.fillStyle = `rgba(220,210,255,${opacity})`;
        const size = clamp(star.size * p.scale, .35, 6);
        ctx.fillRect(p.x, p.y, size, size);
        if (star.size > 1.46 && p.scale > .65) {
          ctx.strokeStyle = `rgba(212,211,255,${opacity * .35})`;
          ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
        }
      });
      ctx.restore();
      // Receding gates make the route and its scale visible from the starting area.
      for (let z = 700; z <= 7400; z += 650) {
        const points = Array.from({ length: 41 }, (_, i) => {
          const angle = i / 40 * TAU;
          return project({ x: Math.cos(angle) * 480, y: Math.sin(angle) * 350, z }, this.state, w, h);
        });
        this.drawLine(points, '#a297d928', .7);
      }
      ZONES.forEach(zone => {
      const origin = project({ x: zone.x, y: zone.y, z: zone.travel }, this.state, w, h);
      if (!origin) return;
      const glowRadius = Math.min(w * 1.8, 195 * origin.scale);
      const glow = ctx.createRadialGradient(origin.x, origin.y, 3, origin.x, origin.y, glowRadius);
      glow.addColorStop(0, '#e28eff14'); glow.addColorStop(.42, '#9d30dd10'); glow.addColorStop(1, '#651ec100');
      ctx.fillStyle = glow; ctx.fillRect(origin.x - glowRadius, origin.y - glowRadius, glowRadius * 2, glowRadius * 2);
      this.drawOrbit(318, -30, time, '#ac82cf38', .23, zone);
      this.drawOrbit(434, 18, time, '#65aeb229', -.5, zone);
      this.drawOrbit(281, -129, time, '#9fa4ff25', 0, zone);
      });
      const items = this.textItems(time).map(item => ({ ...item, p: project(item.point, this.state, w, h), q: project(item.next, this.state, w, h), centerProjection: item.center ? project(item.center, this.state, w, h) : null })).filter(item => item.p && item.q && item.size * item.p.scale > 4).sort((a, b) => b.p.depth - a.p.depth);
      items.forEach(item => {
        if (item.letter === ' ') return;
        const p = item.p, q = item.q;
        const depthOpacity = clamp(1700 / p.depth, .12, .95) * clamp((p.depth - 145) / 210, 0, 1);
        ctx.save();
        const backFace = item.centerProjection && p.depth > item.centerProjection.depth;
        ctx.globalAlpha = depthOpacity * (backFace ? .16 : 1);
        ctx.translate(p.x, p.y);
        let angle = Math.atan2(q.y - p.y, q.x - p.x);
        if (angle > Math.PI / 2) angle -= Math.PI; else if (angle < -Math.PI / 2) angle += Math.PI;
        ctx.rotate(angle);
        // Side-facing glyphs narrow, so the letter forms wrap a real cylinder.
        ctx.scale(clamp(Math.abs(q.x - p.x) / Math.max(.01, Math.hypot(q.x - p.x, q.y - p.y)), .25, 1), 1);
        ctx.font = item.font.replace('SIZE', Math.min(220, item.size * p.scale).toFixed(2));
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = item.color;
        if (p.depth < 1300 && item.kind === 'cylinder') { ctx.shadowColor = item.color; ctx.shadowBlur = 3.5; }
        ctx.fillText(item.letter, 0, 0);
        ctx.restore();
      });
      this.glyphs.forEach(glyph => {
        const p = project({ x: glyph.x + Math.sin(time * .07 + glyph.phase) * 45, y: glyph.y + Math.cos(time * .09 + glyph.phase) * 25, z: glyph.z }, this.state, w, h);
        if (!p) return;
        ctx.save(); ctx.globalAlpha = clamp(900 / p.depth, .05, .24); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(time * .05 + glyph.phase) * .2);
        ctx.font = `${glyph.font === 1 ? 'italic ' : ''}${Math.min(160, 42 * p.scale)}px ${['Georgia, serif', 'Georgia, serif', 'ui-monospace, monospace'][glyph.font]}`;
        ctx.fillStyle = glyph.font === 1 ? '#fbb0ef' : '#adbee9'; ctx.fillText(glyph.text, 0, 0); ctx.restore();
      });
      const objects = objectPoints(time).map((point, i) => this.drawObject(point, i, time));
      this.onObjects(objects, w, h);
    }
  }
  return { createState, moving, advance, drag, move, moveTo, seek, stop, setControls, reset, regionFor, cameraPosition, project, rotate, ringPoint, objectPoints, seededRandom, Universe, INITIAL, ZONES, MAX_TRAVEL };
});
