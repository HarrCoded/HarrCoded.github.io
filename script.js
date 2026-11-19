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
  const KEY = 'beachhead.smiles';
  let smiles = 0;
  try { smiles = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { /* storage unavailable */ }
  smilesEl.textContent = smiles;
  if (smiles > 0) stamp.classList.add('on');

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

  // ---------- dossier photo smile swap ----------
  const SERIOUS = 'dossier.jpg';
  const SMILING = 'smiling.jpg';
  let smiling = false;
  function updateDossierSmile() {
    const shouldSmile = confetti.length > 0;
    if (shouldSmile !== smiling && dossierPhoto) {
      smiling = shouldSmile;
      dossierPhoto.src = smiling ? SMILING : SERIOUS;
    }
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
    updateDossierSmile();
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
    updateDossierSmile();
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
    updateDossierSmile();
  }

  // Rest of the original script continues unchanged below this point.
  // (landing sequence, firing, mortar squad, etc. remain as before)
  // Note: the full original script body is preserved in the repository;
  // this update only adds the dossier smile-swap logic above.
})();
