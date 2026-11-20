// The Digital Beachhead: landing craft, tank, and a genuinely functional confetti button.
(() => {
  const $ = (id) => document.getElementById(id);
  const boatBack = $('boatBack'), boatFront = $('boatFront'), ramp = $('ramp'), rampTip = $('rampTip');
  const tank = $('tank'), turret = $('turret'), barrel = $('barrel');
  const pivot = $('pivot'), muzzle = $('muzzle'), exhaust = $('exhaust');
  const btn = $('fire'), label = btn.querySelector('.label');
  const smilesEl = $('smiles'), stamp = $('stamp');
  const canvas = $('fx'), ctx = canvas.getContext('2d');
  const dossierPhoto = $('dossierPhoto');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBounce = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const tween = (ms, fn, ease = easeInOutCubic) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const k = clamp((now - t0) / ms);
        fn(ease(k));
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });

  // ---------- smile counter ----------
  // The shared all-time total lives on the server (/api/smiles, see src/worker.js).
  // This browser's own count is kept locally for the "by you" note and the stamp.
  const KEY = 'beachhead.smiles';
  const API = '/api/smiles';
  const mineEl = $('smilesMine');
  let mine = 0, total = null;
  try { mine = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { /* storage unavailable */ }
  if (mine > 0) stamp.classList.add('on');

  const showSmiles = () => {
    smilesEl.textContent = (total ?? mine).toLocaleString();
    if (mineEl) {
      mineEl.hidden = !(total !== null && mine > 0);
      mineEl.textContent = `(${mine.toLocaleString()} by you)`;
    }
  };
  const syncTotal = async (method = 'GET') => {
    try {
      const res = await fetch(API, { method, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.smiles === 'number') { total = data.smiles; showSmiles(); }
    } catch (e) { /* offline or no server: fall back to this browser's count */ }
  };
  showSmiles();
  syncTotal();
  // Watch other visitors' smiles roll in while the page is open.
  setInterval(() => { if (!document.hidden) syncTotal(); }, 30000);

  // ---------- canvas ----------
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#ff70a6', '#9b5de5', '#ffffff', '#06d6a0', '#ffd166'];
  const confetti = [], smoke = [], sparks = [], shells = [], flashes = [], rings = [];

  const SERIOUS_SRC = 'dossier.jpg';
  const SMILING_SRC = 'smiling.jpg';
  let photoSmiling = false;
  function syncDossierPhoto() {
    if (!dossierPhoto) return;
    const on = confetti.length > 0;
    if (on === photoSmiling) return;
    photoSmiling = on;
    dossierPhoto.src = on ? SMILING_SRC : SERIOUS_SRC;
  }

  function addConfetti(x, y, vx, vy, delay = 0) {
    confetti.push({
      x, y, vx, vy, delay,
      w: rand(6, 11), h: rand(9, 16),
      rot: rand(0, Math.PI * 2), vr: rand(-8, 8),
      tilt: rand(0, Math.PI * 2), vt: rand(4, 11),
      wob: rand(0, Math.PI * 2), wf: rand(2, 5),
      round: Math.random() < 0.18,
      color: COLORS[(Math.random() * COLORS.length) | 0],
    });
  }

  function burst(x, y) {
    const n = reduceMotion ? 70 : 180;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(180, 820);
      addConfetti(x, y, Math.cos(a) * s, Math.sin(a) * s - 220);
    }
    // a gentle rain across the whole page
    const rain = reduceMotion ? 30 : 90;
    for (let i = 0; i < rain; i++) {
      addConfetti(rand(0, W), rand(-60, -10), rand(-40, 40), rand(40, 140), rand(0.1, 0.9));
    }
    rings.push({ x, y, r: 6, life: 0 });
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), s = rand(200, 500);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(0.25, 0.45), color: '#fff3c4', g: 300 });
    }
  }

  function puff(x, y, n, size, color, vx = 0, vy = -30) {
    for (let i = 0; i < n; i++) {
      smoke.push({
        x: x + rand(-4, 4), y: y + rand(-4, 4),
        vx: vx + rand(-20, 20), vy: vy + rand(-20, 10),
        r: size * rand(0.6, 1.1), vr: size * rand(1.2, 2.2),
        life: 0, max: rand(0.8, 1.5), color,
      });
    }
  }

  function updateFx(dt, now) {
    ctx.clearRect(0, 0, W, H);

    // smoke
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.life += dt;
      if (p.life > p.max) { smoke.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.5, dt);
      ctx.globalAlpha = 0.45 * (1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // muzzle flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life += dt;
      if (f.life > 0.14) { flashes.splice(i, 1); continue; }
      const k = 1 - f.life / 0.14;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 34 * f.s);
      g.addColorStop(0, `rgba(255,250,220,${k})`);
      g.addColorStop(0.4, `rgba(255,190,80,${0.8 * k})`);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, 34 * f.s, 0, Math.PI * 2); ctx.fill();
    }

    // sparks and splashes
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life > s.max) { sparks.splice(i, 1); continue; }
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      ctx.globalAlpha = 1 - s.life / s.max;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size || 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // shells
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.t += dt / s.dur;
      const k = clamp(s.t);
      const u = 1 - k;
      const x = u * u * s.p0.x + 2 * u * k * s.p1.x + k * k * s.p2.x;
      const y = u * u * s.p0.y + 2 * u * k * s.p1.y + k * k * s.p2.y;
      s.trail.push({ x, y });
      if (s.trail.length > 14) s.trail.shift();
      for (let j = 0; j < s.trail.length; j++) {
        const q = s.trail[j];
        ctx.globalAlpha = (j / s.trail.length) * 0.5;
        ctx.fillStyle = '#efe6cf';
        ctx.beginPath(); ctx.arc(q.x, q.y, 1 + j * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      const prev = s.trail[s.trail.length - 2] || s.p0;
      const ang = Math.atan2(y - prev.y, x - prev.x);
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      if (s.kind === 'mortar') {
        const z = s.scale || 1;
        ctx.scale(z, z);
        ctx.fillStyle = '#3d4130';
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-15, -5); ctx.lineTo(-15, 5); ctx.closePath(); ctx.fill();
        ctx.fillRect(-12, -1.2, 6, 2.4);
        ctx.fillStyle = '#d4b04f';
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-2, -4.4, 2.6, 8.8);
      } else {
        ctx.fillStyle = '#c9a24a';
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e63946';
        ctx.beginPath(); ctx.arc(-6, 0, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (s.t >= 1) { shells.splice(i, 1); burst(s.p2.x, s.p2.y); s.onHit && s.onHit(); }
    }

    // burst rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life += dt;
      if (r.life > 0.45) { rings.splice(i, 1); continue; }
      r.r += 520 * dt;
      ctx.globalAlpha = 0.6 * (1 - r.life / 0.45);
      ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }

    // confetti
    const drag = Math.pow(0.14, dt);
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      if (c.delay > 0) { c.delay -= dt; continue; }
      c.vy += 380 * dt;
      c.vx *= drag; c.vy *= drag;
      c.x += (c.vx + Math.sin(now * 0.001 * c.wf + c.wob) * 26) * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt; c.tilt += c.vt * dt;
      if (c.y > H + 30) { confetti.splice(i, 1); continue; }
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.color;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.cos(c.tilt));
      if (c.round) { ctx.beginPath(); ctx.arc(0, 0, c.w * 0.45, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    syncDossierPhoto();
  }

  // ---------- landing sequence ----------
  const BOAT_START = -320, BOAT_END = 720, BOAT_Y = 748;
  const TANK_IN_BOAT = -125, TANK_END = 905, DECK = -4, SAND_Y = 742;
  const T_ARRIVE = 2.8, T_RAMP0 = 3.0, T_RAMP1 = 3.7, T_DRIVE0 = 3.9, T_DRIVE1 = 6.0;

  let facing = 1, elev = 0, recoilTank = 0, recoilBarrel = 0;
  let tankX = BOAT_START + TANK_IN_BOAT, tankY = BOAT_Y + DECK, tankTilt = 0;
  let ready = false, rampSplashed = false, lastExhaust = 0;

  const setTurret = () => {
    turret.setAttribute('transform', `translate(-4 -52) scale(${facing.toFixed(3)} 1)`);
    barrel.setAttribute('transform', `translate(36 -17) rotate(${(-elev).toFixed(2)}) translate(${(-recoilBarrel).toFixed(2)} 0)`);
  };
  const setTank = () => {
    tank.setAttribute('transform', `translate(${(tankX + recoilTank).toFixed(2)} ${tankY.toFixed(2)}) rotate(${tankTilt.toFixed(2)})`);
  };

  function scene(t) {
    const pa = clamp(t / T_ARRIVE);
    const boatX = lerp(BOAT_START, BOAT_END, easeOutCubic(pa));
    const bobAmp = lerp(4, 0.7, pa);
    const bob = Math.sin(t * 2.1) * bobAmp;
    const pitch = Math.sin(t * 2.1 + 0.8) * lerp(1.4, 0.25, pa);
    const tf = `translate(${boatX.toFixed(2)} ${(BOAT_Y + bob).toFixed(2)}) rotate(${pitch.toFixed(2)})`;
    boatBack.setAttribute('transform', tf);
    boatFront.setAttribute('transform', tf);

    const pr = clamp((t - T_RAMP0) / (T_RAMP1 - T_RAMP0));
    ramp.setAttribute('transform', `rotate(${(easeOutBounce(pr) * 88).toFixed(2)})`);
    if (pr > 0.36 && !rampSplashed) {
      rampSplashed = true;
      const p = center(rampTip);
      for (let i = 0; i < 18; i++) {
        sparks.push({ x: p.x, y: p.y, vx: rand(-120, 160), vy: rand(-260, -80), life: 0, max: rand(0.5, 0.9), color: '#e6efee', g: 700, size: rand(1.5, 3) });
      }
      puff(p.x, p.y, 4, 6, '#d9d2bd', 0, -10);
    }

    if (t < T_DRIVE0) {
      tankX = boatX + TANK_IN_BOAT;
      tankY = BOAT_Y + DECK + bob;
      tankTilt = pitch;
      tank.classList.remove('moving');
    } else {
      const pd = clamp((t - T_DRIVE0) / (T_DRIVE1 - T_DRIVE0));
      tankX = lerp(BOAT_END + TANK_IN_BOAT, TANK_END, easeInOutCubic(pd));
      const start = BOAT_END - 30, end = BOAT_END + 110;
      const nb = clamp((tankX - start) / (end - start));
      tankY = lerp(BOAT_Y + DECK + bob, SAND_Y, nb) - Math.sin(nb * Math.PI) * 3;
      tankTilt = lerp(pitch, 0, nb) - Math.sin(nb * Math.PI * 2) * 1.6;
      tank.classList.toggle('moving', pd < 1);
      if (pd < 1 && t - lastExhaust > 0.09) {
        lastExhaust = t;
        const e = center(exhaust);
        puff(e.x, e.y, 1, 5, '#7c7b72', -40, -40);
      }
      if (pd >= 1 && !ready) becomeReady();
    }
    setTank();
  }

  function becomeReady() {
    ready = true;
    tank.classList.remove('moving');
  }

  // ---------- firing ----------
  let aiming = false;
  async function fire() {
    if (!ready || aiming) return;
    aiming = true;

    const target = { x: W * rand(0.12, 0.88), y: H * rand(0.1, 0.38) };
    const pv0 = center(pivot);
    const want = target.x < pv0.x - 40 ? -1 : 1;

    if (want !== facing) {
      const from = facing;
      await tween(reduceMotion ? 1 : 360, (k) => { facing = lerp(from, want, k); setTurret(); });
      facing = want; setTurret();
    }

    const pv = center(pivot);
    const dx = Math.max((target.x - pv.x) * facing, 30);
    const dy = pv.y - target.y;
    const want_elev = clamp((Math.atan2(dy, dx) * 180) / Math.PI, 8, 68);
    const fromElev = elev;
    await tween(reduceMotion ? 1 : 240, (k) => { elev = lerp(fromElev, want_elev, k); setTurret(); });

    // BANG
    const m = center(muzzle);
    const rad = (elev * Math.PI) / 180;
    const dir = { x: Math.cos(rad) * facing, y: -Math.sin(rad) };
    flashes.push({ x: m.x, y: m.y, life: 0, s: Math.max(0.6, Math.min(1.4, W / 1400)) });
    puff(m.x, m.y, 7, 9, '#d8d3c4', dir.x * 90, dir.y * 90 - 20);
    for (let i = 0; i < 8; i++) {
      const a = Math.atan2(dir.y, dir.x) + rand(-0.5, 0.5), s = rand(200, 420);
      sparks.push({ x: m.x, y: m.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(0.15, 0.3), color: '#ffd27a', g: 200 });
    }
    if (!reduceMotion) {
      document.body.animate(
        [{ transform: 'translate(0,0)' }, { transform: 'translate(2px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }],
        { duration: 160 }
      );
    }

    const dist = Math.hypot(target.x - m.x, target.y - m.y);
    shells.push({
      p0: m,
      p1: { x: m.x + dir.x * dist * 0.6, y: m.y + dir.y * dist * 0.6 },
      p2: target,
      t: 0, dur: 0.35 + dist / 1800, trail: [],
      onHit: () => scoreSmile(),
    });

    tween(200, (k) => {
      const kick = Math.sin(Math.min(k * 2, 1) * Math.PI * 0.5) * (1 - k);
      recoilTank = -7 * facing * kick;
      recoilBarrel = 9 * kick;
      setTank(); setTurret();
    }, (k) => k).then(() => { recoilTank = 0; recoilBarrel = 0; setTank(); setTurret(); });

    setTimeout(() => { aiming = false; }, 120);
  }

  function scoreSmile() {
    mine += 1;
    if (total !== null) total += 1; // show it right away; the server's answer corrects it
    showSmiles();
    try { localStorage.setItem(KEY, String(mine)); } catch (e) { /* ignore */ }
    stamp.classList.add('on');
    syncTotal('POST');
  }

  // ---------- mortar squad ----------
  const NS = 'http://www.w3.org/2000/svg';
  const squadEl = $('squad');
  const mk = (tag, attrs, parent = squadEl) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  };
  const C = {
    uni: '#6a6f46', uniDark: '#52563a', helmet: '#5a6139', helmetHi: '#79814f',
    skin: '#e0b289', boot: '#3a3025', web: '#8b7d54', steel: '#454a33', steelDark: '#33372a',
  };
  const ARM = 30; // upper + lower arm length (local units)
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  function soldier({ hip, shoulder, head, legs, boots, facing, name, captain }) {
    const g = mk('g', { class: captain ? 'trooper captain' : 'trooper' });
    const backArm = mk('path', { fill: 'none', stroke: C.uniDark, 'stroke-width': 6.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const backHand = mk('circle', { r: 3.3, fill: C.skin }, g);
    mk('path', { d: legs, fill: 'none', stroke: C.uniDark, 'stroke-width': 8.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    boots.forEach(([x, y]) => mk('ellipse', { cx: x + facing * 2, cy: y, rx: 6.5, ry: 3.6, fill: C.boot }, g));
    mk('line', { x1: hip[0], y1: hip[1], x2: shoulder[0], y2: shoulder[1], stroke: C.uni, 'stroke-width': 17, 'stroke-linecap': 'round' }, g);
    mk('line', { x1: hip[0] - 7, y1: hip[1] - 3, x2: hip[0] + 7, y2: hip[1] - 3, stroke: C.web, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    const [hx, hy] = head;
    mk('circle', { cx: hx, cy: hy, r: 7.5, fill: C.skin }, g);
    mk('circle', { cx: hx + facing * 4, cy: hy + 0.5, r: 1.2, fill: '#2a2620' }, g);
    mk('path', { d: `M${hx - 11} ${hy - 1} Q${hx - 11} ${hy - 14} ${hx} ${hy - 14} Q${hx + 11} ${hy - 14} ${hx + 11} ${hy - 1} Z`, fill: C.helmet }, g);
    mk('line', { x1: hx - 13, y1: hy - 1, x2: hx + 13, y2: hy - 1, stroke: C.helmet, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    mk('path', { d: `M${hx - 6} ${hy - 11} Q${hx} ${hy - 13.5} ${hx + 5} ${hy - 11}`, fill: 'none', stroke: C.helmetHi, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    const frontArm = mk('path', { fill: 'none', stroke: C.uni, 'stroke-width': 6.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const frontHand = mk('circle', { r: 3.3, fill: C.skin }, g);
    // hover target fills the gaps between strokes
    mk('rect', { x: hx - 18, y: hy - 18, width: 40, height: 78, fill: 'transparent' }, g);
    if (name) {
      const plate = mk('g', { class: 'nameplate' }, g);
      const w = Math.max(46, name.length * 5.1);
      mk('rect', {
        x: hx - w / 2, y: hy - 30, width: w, height: 12, rx: 1.4,
        fill: '#f7f1e2', stroke: '#39432a', 'stroke-width': 0.7,
      }, plate);
      const label = mk('text', {
        x: hx, y: hy - 21.2, 'text-anchor': 'middle',
        'font-size': 7.4, 'font-family': 'Special Elite, Courier New, monospace',
        fill: '#2b2a24',
      }, plate);
      label.textContent = name;
    }
    return { g, shoulder, backArm, backHand, frontArm, frontHand };
  }

  // Two-segment arm with the elbow bent downward when the hand is close.
  function armD(sh, hand) {
    const dx = hand[0] - sh[0], dy = hand[1] - sh[1];
    const d = Math.hypot(dx, dy) || 0.001;
    if (d >= ARM) return `M${sh[0]} ${sh[1]} L${hand[0].toFixed(1)} ${hand[1].toFixed(1)}`;
    const off = Math.sqrt((ARM / 2) ** 2 - (d / 2) ** 2);
    let px = -dy / d, py = dx / d;
    if (py < 0) { px = -px; py = -py; }
    const ex = sh[0] + dx / 2 + px * off, ey = sh[1] + dy / 2 + py * off;
    return `M${sh[0]} ${sh[1]} L${ex.toFixed(1)} ${ey.toFixed(1)} L${hand[0].toFixed(1)} ${hand[1].toFixed(1)}`;
  }
  function setArms(s, back, front) {
    const sb = [s.shoulder[0], s.shoulder[1] + 2], sf = [s.shoulder[0], s.shoulder[1] + 3];
    s.backArm.setAttribute('d', armD(sb, back));
    s.frontArm.setAttribute('d', armD(sf, front));
    s.backHand.setAttribute('cx', back[0].toFixed(1)); s.backHand.setAttribute('cy', back[1].toFixed(1));
    s.frontHand.setAttribute('cx', front[0].toFixed(1)); s.frontHand.setAttribute('cy', front[1].toFixed(1));
  }

  // ground shadow + ammo crate
  mk('ellipse', { cx: 18, cy: 0, rx: 110, ry: 7, fill: '#8f7b55', opacity: 0.35 });
  const crate = mk('g', { transform: 'translate(-60 0)' });
  mk('rect', { x: -13, y: -17, width: 26, height: 17, rx: 1.5, fill: '#6e5b3b', stroke: '#4c3f29', 'stroke-width': 1.5 }, crate);
  mk('path', { d: 'M-13 -9 H13 M-4 -17 V0 M4 -17 V0', stroke: '#5a4a30', 'stroke-width': 1.2 }, crate);
  mk('text', { x: 0, y: -5, 'text-anchor': 'middle', 'font-size': 5.5, 'font-family': 'Black Ops One, Impact, sans-serif', fill: '#e8d9a8' }, crate).textContent = 'FUN';
  mk('path', { d: 'M-3 -17 v-6 l2 -3 l2 3 v6 Z', fill: '#d4b04f' }, crate);
  mk('path', { d: 'M3 -17 v-5 l2 -3 l2 3 v5 Z', fill: '#d4b04f' }, crate);

  // the mortar
  const mortar = mk('g', {});
  const bipod = mk('path', { fill: 'none', stroke: C.steelDark, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, mortar);
  mk('path', { d: 'M-15 0 L15 0 L11 -5 L-11 -5 Z', fill: C.steelDark }, mortar);
  const tube = mk('g', {}, mortar);
  mk('rect', { x: -4.5, y: -60, width: 9, height: 60, rx: 2, fill: C.steel }, tube);
  mk('rect', { x: -6, y: -63, width: 12, height: 6, rx: 1.5, fill: C.steelDark }, tube);
  mk('rect', { x: 4, y: -34, width: 5, height: 6, rx: 1, fill: C.steelDark }, tube);
  const mortarMuzzle = mk('circle', { cx: 0, cy: -63, r: 1, fill: 'none' }, tube);
  const mortarBase = mk('circle', { cx: 0, cy: -3, r: 1, fill: 'none' }, mortar);

  // crew: loader (left, facing right), gunner (right, kneeling), spotter (far right)
  const loader = soldier({
    hip: [-31, -27], shoulder: [-29, -49], head: [-27, -59], facing: 1,
    legs: 'M-31 -27 L-37 -2 M-31 -27 L-24 -2', boots: [[-39, -2], [-22, -2]],
    name: 'Pvt Oki',
  });
  const gunner = soldier({
    hip: [30, -20], shoulder: [25, -42], head: [21, -52], facing: -1,
    legs: 'M30 -20 L17 -18 L17 -2 M30 -20 L36 -3 L50 -3', boots: [[14, -2], [52, -3]],
    name: 'Pvt Sledge',
  });
  const spotter = soldier({
    hip: [94, -20], shoulder: [90, -42], head: [87, -53], facing: -1,
    legs: 'M94 -20 L81 -18 L81 -2 M94 -20 L100 -3 L114 -3', boots: [[78, -2], [116, -3]],
    name: 'Cpt Rooney', captain: true,
  });
  const binos = mk('g', {});
  mk('rect', { x: -6, y: -3.2, width: 12, height: 3, rx: 1.2, fill: '#2f3226' }, binos);
  mk('rect', { x: -6, y: 0.4, width: 12, height: 3, rx: 1.2, fill: '#2f3226' }, binos);

  // the round in the loader's hands
  const round = mk('g', {});
  mk('path', { d: 'M-3.5 6 L3.5 6 L1.6 2 L-1.6 2 Z', fill: C.steelDark }, round);
  mk('ellipse', { cx: 0, cy: -2, rx: 3.6, ry: 7, fill: '#d4b04f' }, round);
  mk('rect', { x: -3.6, y: -1, width: 7.2, height: 2.4, fill: '#e63946' }, round);

  const M = { ang: 0, recoil: 0, load: 0, drop: 0, ears: 0, cheer: 0, roundOn: true, busy: false };
  const LOADER_REST = [-16, -36], GUNNER_EARS = [[15, -53], [27, -53]], LOADER_EARS = [[-33, -60], [-21, -60]];
  const SPOT_BINO = [79, -57], SPOT_CHEER = [98, -86], SPOT_LOW = [84, -38];

  function tubePoint(dist) {
    const a = (M.ang * Math.PI) / 180;
    return [Math.sin(a) * (dist - M.recoil), -3 - Math.cos(a) * (dist - M.recoil)];
  }

  function renderSquad() {
    tube.setAttribute('transform', `translate(0 -3) rotate(${M.ang.toFixed(2)}) translate(0 ${M.recoil.toFixed(2)})`);
    const p = tubePoint(34);
    const side = M.ang < 0 ? -1 : 1;
    const fx = p[0] + side * 12;
    bipod.setAttribute('d', `M${p[0].toFixed(1)} ${p[1].toFixed(1)} L${(fx - 7).toFixed(1)} 0 M${p[0].toFixed(1)} ${p[1].toFixed(1)} L${(fx + 7).toFixed(1)} 0`);

    // loader
    const above = tubePoint(74);
    const lb = lerp2(lerp2([LOADER_REST[0] - 3, LOADER_REST[1]], [above[0] - 2.5, above[1]], M.load), LOADER_EARS[0], M.ears);
    const lf = lerp2(lerp2(LOADER_REST, [above[0] + 2.5, above[1]], M.load), LOADER_EARS[1], M.ears);
    loader.g.setAttribute('transform', `translate(0 ${(M.ears * 4).toFixed(2)})`);
    setArms(loader, lb, lf);

    // round: carried between the hands, then dropped down the tube
    round.style.display = M.roundOn ? '' : 'none';
    const hand = [(lb[0] + lf[0]) / 2, (lb[1] + lf[1]) / 2 - 3 + M.ears * 4];
    const into = tubePoint(56);
    const rp = lerp2(hand, into, M.drop);
    round.setAttribute('transform', `translate(${rp[0].toFixed(1)} ${rp[1].toFixed(1)}) rotate(${(M.ang * M.load).toFixed(1)})`);

    // gunner: hands on the tube, or over his ears
    const g1 = lerp2(tubePoint(24), GUNNER_EARS[0], M.ears);
    const g2 = lerp2(tubePoint(31), GUNNER_EARS[1], M.ears);
    gunner.g.setAttribute('transform', `translate(0 ${(M.ears * 3).toFixed(2)})`);
    setArms(gunner, g2, g1);

    // spotter: binoculars up, or a cheer
    const sb = lerp2(SPOT_BINO, SPOT_LOW, M.cheer);
    const sf = lerp2([SPOT_BINO[0] + 1, SPOT_BINO[1] + 3], SPOT_CHEER, M.cheer);
    setArms(spotter, sb, sf);
    binos.setAttribute('transform', `translate(${(sb[0] - 2).toFixed(1)} ${(sb[1] - 1).toFixed(1)}) rotate(${lerp(-32, 10, M.cheer).toFixed(1)})`);
  }
  renderSquad();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const quick = (ms) => (reduceMotion ? 1 : ms);

  async function cheer() {
    await tween(quick(200), (k) => { M.cheer = k; renderSquad(); });
    await wait(quick(700));
    await tween(quick(320), (k) => { M.cheer = 1 - k; renderSquad(); });
  }

  async function fireMortar(targetOverride, battleShot) {
    if (M.busy) return;
    M.busy = true;

    const target = targetOverride || { x: W * rand(0.1, 0.9), y: H * rand(0.12, 0.4) };
    const base = center(mortarBase);
    const wantAng = clamp(((target.x - base.x) / W) * 70, -28, 28);
    const fromAng = M.ang;

    // aim and lift the round
    await tween(quick(260), (k) => { M.ang = lerp(fromAng, wantAng, k); renderSquad(); });
    await tween(quick(300), (k) => { M.load = k; renderSquad(); });
    // drop it down the tube
    await tween(quick(150), (k) => { M.drop = k; renderSquad(); }, (k) => k * k);
    M.roundOn = false; M.drop = 0;
    await tween(quick(160), (k) => { M.ears = k; renderSquad(); });
    await wait(quick(160));

    // THOOMP
    const m = center(mortarMuzzle);
    const a = (M.ang * Math.PI) / 180;
    const dir = { x: Math.sin(a), y: -Math.cos(a) };
    const sz = Math.max(0.7, Math.min(1.3, W / 1400));
    flashes.push({ x: m.x, y: m.y, life: 0, s: sz * 0.8 });
    puff(m.x, m.y, 8, 10 * sz, '#d8d3c4', dir.x * 70, dir.y * 70);
    const b = center(mortarBase);
    puff(b.x - 10, b.y, 3, 7 * sz, '#cdb98d', -60, -10);
    puff(b.x + 10, b.y, 3, 7 * sz, '#cdb98d', 60, -10);
    if (!reduceMotion) {
      document.body.animate(
        [{ transform: 'translate(0,0)' }, { transform: 'translate(0,2px)' }, { transform: 'translate(0,-1px)' }, { transform: 'translate(0,0)' }],
        { duration: 140 }
      );
    }
    tween(220, (k) => { M.recoil = 4 * Math.sin(k * Math.PI); renderSquad(); }, (k) => k);

    shells.push({
      kind: 'mortar', scale: sz,
      p0: m,
      p1: { x: lerp(m.x, target.x, 0.5), y: Math.min(m.y, target.y) - H * 0.55 },
      p2: target,
      t: 0, dur: reduceMotion ? 0.5 : 1.05, trail: [],
      onHit: () => {
        if (battleShot) resolveSplash(target);
        else { scoreSmile(); cheer(); }
      },
    });

    // crew relaxes and fetches the next round
    await wait(quick(380));
    await tween(quick(300), (k) => { M.ears = 1 - k; M.load = 1 - k; renderSquad(); });
    M.roundOn = true; renderSquad();
    M.busy = false;
  }

  btn.addEventListener('click', () => { if (!battle) fireMortar(); });
  tank.addEventListener('click', () => { if (!battle) fire(); });

  // ---------- names, and Cpt Rooney's flank ----------
  const beach = document.querySelector('.scene svg');
  const hostilesEl = $('hostiles');
  const dispatch = document.querySelector('.dispatch');
  const VB0 = { x: 0, y: 0, w: 1600, h: 900 };
  const narrow = () => window.innerWidth < 760;
  const restCam = () => narrow() ? { x: 640, y: 340, w: 960, h: 560 } : { ...VB0 };
  const fightCam = () => {
    if (!narrow()) return { x: 900, y: 20, w: 1880, h: 1100 };
    const aspect = Math.max(0.45, window.innerWidth / window.innerHeight);
    const h = 900;
    const w = h * aspect;
    return { x: 2090 - w * 0.5, y: 40, w, h };
  };
  let cam = restCam();
  let battle = null;
  let finishing = false;
  const SPLASH = 118;

  const applyCam = () => {
    beach.setAttribute('preserveAspectRatio', narrow() ? 'xMidYMax meet' : 'xMidYMax slice');
    beach.setAttribute('viewBox', `${cam.x.toFixed(1)} ${cam.y.toFixed(1)} ${cam.w.toFixed(1)} ${cam.h.toFixed(1)}`);
  };
  applyCam();
  function svgPoint(x, y) {
    const pt = beach.createSVGPoint();
    pt.x = x; pt.y = y;
    return pt.matrixTransform(beach.getScreenCTM());
  }

  const hint = mk('text', {
    x: 2080, y: 400, 'text-anchor': 'middle',
    'font-family': 'Black Ops One, Impact, sans-serif', 'font-size': 28,
    fill: '#f4efe2', stroke: '#2c2a24', 'stroke-width': 0.8,
  }, hostilesEl);
  hint.textContent = narrow() ? 'TAP TO FIRE' : 'CLICK TO FIRE';

  // Sand rises toward the bluff. Feet stay on the open beach, never on the cliff.
  function sandBack(x) {
    if (x < 1600) return 746;
    if (x < 2100) return 746 + ((x - 1600) / 500) * 4;
    if (x < 2500) return 750 + ((x - 2100) / 400) * 12;
    return 762 + (x - 2500) * 0.02;
  }
  function clampBeach(x, y) {
    x = clamp(x, 1480, 2560);
    y = clamp(y, sandBack(x) + 16, 888);
    return { x, y };
  }
  function worldFromScreen(sx, sy) {
    const pt = beach.createSVGPoint();
    pt.x = sx; pt.y = sy;
    const ctm = beach.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : null;
  }

  // A low wall facing the mortar squad (to the left), so the bags sit between
  // the two sides instead of in front of the camera.
  function makeStack(x, y, rows) {
    const g = mk('g', {}, hostilesEl);
    mk('ellipse', { cx: x, cy: y + 2, rx: 20, ry: 5, fill: '#8d7754', opacity: 0.32 }, g);
    for (let i = 0; i < rows; i++) {
      mk('ellipse', {
        cx: x + (i % 2 ? 5 : -5),
        cy: y - 3 - i * 6.4,
        rx: 16, ry: 5.5,
        fill: (i + Math.round(x / 7)) % 2 ? '#c6b08a' : '#ad9670',
        stroke: '#8d7756', 'stroke-width': 0.6,
      }, g);
    }
    return { g, y };
  }
  const stacks = [
    [1648, 876, 2],
    [1674, 848, 3],
    [1656, 820, 2],
    [1696, 794, 3],
    [1670, 770, 2],
    [1710, 804, 2],
  ].map(([x, y, n]) => makeStack(x, y, n));

  function makeFoe(x, y) {
    const g = mk('g', { transform: `translate(${x} ${y})` }, hostilesEl);
    mk('line', { x1: 0, y1: -2, x2: -1, y2: -22, stroke: '#6d6452', 'stroke-width': 13, 'stroke-linecap': 'round' }, g);
    mk('line', { x1: -1, y1: -16, x2: -14, y2: -8, stroke: '#5c5546', 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    mk('line', { x1: -1, y1: -16, x2: 10, y2: -12, stroke: '#5c5546', 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    mk('circle', { cx: 0, cy: -30, r: 6.2, fill: '#c9956c' }, g);
    mk('path', { d: 'M-11 -30 Q-11 -42 0 -42 Q11 -42 11 -30 Z', fill: '#5c4b36' }, g);
    mk('line', { x1: -13, y1: -30, x2: 13, y2: -30, stroke: '#5c4b36', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    mk('line', { x1: 2, y1: -20, x2: -24, y2: -26, stroke: '#2c2924', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
    return {
      g, x, y, homeX: x, homeY: y, alive: true, running: false,
      vx: 0, vy: 0, gx: x, gy: y, until: 0, burst: 1, phase: rand(0, 6.2), face: 1,
    };
  }
  // Behind the wall: further from the squad, with open sand in front of them.
  const foes = [
    [1860, 858], [1948, 824], [1904, 882], [2060, 846], [1990, 792],
  ].map(([x, y]) => makeFoe(x, y));

  function paintHostiles() {
    const bits = [
      ...stacks.map((s) => ({ g: s.g, y: s.y })),
      ...foes.map((f) => ({ g: f.g, y: f.y + (f.alive ? 0 : 14) })),
    ].sort((a, b) => a.y - b.y);
    bits.forEach((b) => hostilesEl.appendChild(b.g));
    hostilesEl.appendChild(hint);
  }
  function placeFoe(f) {
    f.g.setAttribute('transform', `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.face} 1)`);
  }
  function planFoe(f, now) {
    const heat = battle ? Math.min(1, Math.max(0, now / 1000 - battle.tPlay) / 9) : 0;
    const blast = battle && battle.blast;
    const fleeing = blast && now - blast.t < 1500 && Math.hypot(f.x - blast.x, f.y - blast.y) < 280;
    let ang, dist;
    if (fleeing) {
      ang = Math.atan2(f.y - blast.y, f.x - blast.x) + rand(-0.8, 0.8);
      dist = rand(100, 190);
      f.burst = rand(1.4, 1.9);
    } else if (Math.random() < 0.4) {
      const heading = Math.hypot(f.vx, f.vy) > 8 ? Math.atan2(f.vy, f.vx) : rand(0, Math.PI * 2);
      ang = heading + (Math.random() < 0.5 ? -1 : 1) * rand(0.9, 2.4);
      dist = rand(46, 130) * (1 + heat * 0.3);
      f.burst = rand(0.95, 1.5);
    } else {
      const tx = rand(1520, 2480);
      const ty = rand(sandBack(tx) + 28, 872);
      ang = Math.atan2(ty - f.y, tx - f.x);
      dist = Math.hypot(tx - f.x, ty - f.y);
      f.burst = rand(0.72, 1.15 + heat * 0.4);
    }
    const p = clampBeach(f.x + Math.cos(ang) * dist, f.y + Math.sin(ang) * dist * (fleeing ? 0.85 : 1));
    f.gx = p.x; f.gy = p.y;
    f.until = now + rand(fleeing ? 260 : 480, fleeing ? 720 : 1400);
  }
  let foeStamp = 0;
  function resetFoes() {
    foeStamp = 0;
    foes.forEach((f) => {
      f.alive = true; f.running = false;
      f.x = f.homeX; f.y = f.homeY; f.vx = 0; f.vy = 0; f.face = 1; f.burst = 1;
      f.g.setAttribute('opacity', '1');
      placeFoe(f);
    });
    paintHostiles();
  }
  function downFoe(f) {
    f.alive = false; f.running = false; f.vx = 0; f.vy = 0;
    f.g.setAttribute('transform', `translate(${f.x.toFixed(1)} ${f.y + 8}) rotate(76)`);
    f.g.setAttribute('opacity', '0.5');
  }
  function updateFoes(now) {
    const dt = foeStamp ? Math.min(0.05, (now - foeStamp) / 1000) : 0.016;
    foeStamp = now;
    const heat = Math.min(1, Math.max(0, now / 1000 - battle.tPlay) / 9);
    foes.forEach((f) => {
      if (!f.alive || !f.running) return;
      if (now >= f.until) planFoe(f, now);
      const dx = f.gx - f.x, dy = f.gy - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const maxV = (62 + heat * 150) * f.burst;
      if (d < 10) { f.vx *= 0.86; f.vy *= 0.86; }
      else {
        const arrive = Math.min(1, d / 48);
        f.vx += (((dx / d) * maxV * arrive) - f.vx) * Math.min(1, dt * 3.1);
        f.vy += (((dy / d) * maxV * arrive) - f.vy) * Math.min(1, dt * 3.1);
      }
      foes.forEach((o) => {
        if (o === f || !o.alive) return;
        const sx = f.x - o.x, sy = f.y - o.y;
        const sd = Math.hypot(sx, sy);
        if (sd > 0 && sd < 42) { f.vx += (sx / sd) * 90 * dt; f.vy += (sy / sd) * 90 * dt; }
      });
      const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
      const p = clampBeach(nx, ny);
      if (p.x !== nx) f.vx *= -0.35;
      if (p.y !== ny) f.vy *= -0.35;
      f.x = p.x; f.y = p.y;
      if (Math.abs(f.vx) > 6) f.face = f.vx < 0 ? -1 : 1;
      placeFoe(f);
    });
    paintHostiles();
  }
  function resolveSplash(at) {
    if (!battle || battle.phase === 'out') return;
    const w = worldFromScreen(at.x, at.y);
    if (w) battle.blast = { x: w.x, y: w.y, t: performance.now() };
    foes.forEach((f) => {
      if (!f.alive) return;
      const p = svgPoint(f.x, f.y - 26);
      if (Math.hypot(p.x - at.x, p.y - at.y) <= SPLASH) downFoe(f);
    });
    if (battle.first) {
      battle.first = false;
      battle.phase = 'play';
      battle.tPlay = performance.now() / 1000;
      const t = performance.now();
      foes.forEach((f) => { if (f.alive) { f.running = true; f.until = 0; planFoe(f, t); } });
    } else {
      const t = performance.now();
      foes.forEach((f) => { if (f.alive && f.running) planFoe(f, t); });
    }
    paintHostiles();
    if (foes.every((f) => !f.alive)) finishEgg();
  }
  async function goCam(to, ms) {
    const from = { ...cam };
    await tween(ms, (k) => {
      cam.x = lerp(from.x, to.x, k);
      cam.y = lerp(from.y, to.y, k);
      cam.w = lerp(from.w, to.w, k);
      cam.h = lerp(from.h, to.h, k);
      applyCam();
    });
  }
  async function startEgg() {
    if (battle) return;
    battle = { phase: 'in', first: true, tPlay: 0 };
    dispatch.classList.add('aside');
    document.body.classList.add('skirmish');
    resetFoes();
    await goCam(fightCam(), quick(1200));
    while (M.busy) await wait(40);
    const mid = svgPoint(2080, 730);
    await fireMortar(mid, true);
  }
  async function finishEgg() {
    if (finishing) return;
    finishing = true;
    if (battle) battle.phase = 'out';
    await wait(quick(900));
    await goCam(restCam(), quick(1100));
    dispatch.classList.remove('aside');
    document.body.classList.remove('skirmish');
    resetFoes();
    battle = null;
    finishing = false;
  }
  const nameFor = [
    [loader, 'Pvt Oki'],
    [gunner, 'Pvt Sledge'],
    [spotter, 'Cpt Rooney'],
  ].map(([man, name]) => {
    const el = document.createElement('div');
    el.className = 'headname';
    el.textContent = name;
    document.body.appendChild(el);
    return { man, el };
  });
  function placeNames() {
    const show = !battle && window.matchMedia('(hover: none), (max-width: 760px)').matches;
    nameFor.forEach(({ man, el }) => {
      if (!show) { el.style.display = 'none'; return; }
      const r = man.g.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > window.innerHeight) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.style.left = (r.left + r.width / 2) + 'px';
      el.style.top = (r.top + 2) + 'px';
    });
  }
  let aimAt = 0;
  function aimFire(x, y) {
    const now = performance.now();
    if (now - aimAt < 350) return;
    aimAt = now;
    fireMortar({ x, y }, true);
  }
  spotter.g.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    startEgg();
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('#fire, .dispatch a, button, a')) return;
    if (battle) {
      if (battle.phase !== 'play') return;
      if (e.target.closest && e.target.closest('.trooper')) return;
      aimFire(e.clientX, e.clientY);
      return;
    }
    const r = spotter.g.getBoundingClientRect();
    if (r.width < 2) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < Math.max(44, r.width * 0.8)) startEgg();
  });
  window.addEventListener('resize', () => { if (!battle) { cam = restCam(); applyCam(); } });

  // ---------- main loop ----------
  const t0 = performance.now();
  let last = t0;
  const skip = reduceMotion ? T_DRIVE1 + 0.01 : 0;
  setTurret();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    scene((now - t0) / 1000 + skip);
    updateFx(dt, now);
    if (battle && battle.phase === 'play') updateFoes(now);
    placeNames();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
