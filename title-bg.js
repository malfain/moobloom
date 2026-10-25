'use strict';
/* Latar layar judul: langit, awan yang bergeser, bukit, dan padang rumput yang bergoyang tertiup angin.
   Canvas 2D ringan; hanya digambar saat layar judul terlihat. */
(function () {
  const title = document.getElementById('title');
  const cv = document.getElementById('titleBg');
  if (!title || !cv) return;
  const ctx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, horizon = 0, blades = [], flowers = [], clouds = [], hills = [], flocks = [], butterflies = [];

  // angka acak tetap (tampilan sama tiap dibuka)
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // awan: beberapa gumpalan lingkaran lembut, dirender sekali ke canvas kecil
  function makeCloud(scale) {
    const c = document.createElement('canvas'), w = Math.round(260 * scale), h = Math.round(110 * scale);
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const puffs = 7 + Math.floor(rnd() * 5);
    for (let i = 0; i < puffs; i++) {
      const px = w * (0.18 + rnd() * 0.64), py = h * (0.45 + rnd() * 0.25), r = h * (0.22 + rnd() * 0.22);
      const g = x.createRadialGradient(px, py - r * 0.2, r * 0.1, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    // bayangan lembut di bawah awan
    const sh = x.createLinearGradient(0, h * 0.5, 0, h);
    sh.addColorStop(0, 'rgba(160,185,215,0)'); sh.addColorStop(1, 'rgba(160,185,215,0.35)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = sh; x.fillRect(0, 0, w, h);
    return c;
  }

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    horizon = H * 0.58;
    seed = 7;
    clouds = [];
    for (let i = 0; i < 7; i++) {
      const depth = 0.4 + rnd() * 0.6;
      clouds.push({img: makeCloud(0.6 + depth * 0.9), x: rnd() * (W + 300) - 150, y: H * (0.05 + rnd() * 0.32), v: 6 + depth * 14, a: 0.65 + depth * 0.35});
    }
    // kawanan burung: tiap kawanan terbang melintas dengan formasi longgar; yang jauh lebih kecil & lambat
    // kupu-kupu di atas padang: warna cerah, lintasan zig-zag
    butterflies = [];
    const wingColors = [['#ffb02e', '#e8701a'], ['#ffe14d', '#e0b020'], ['#7fc8ff', '#3a8fd8'], ['#ff8fc7', '#e0569a'], ['#ffffff', '#d9d9e8']];
    for (let i = 0; i < Math.max(5, Math.round(W / 140)); i++) {
      const [c1, c2] = wingColors[Math.floor(rnd() * wingColors.length)];
      butterflies.push({x0: rnd() * W, y0: horizon + 20 + rnd() * (H - horizon) * 0.7, c1, c2, ph: rnd() * 100, sp: 0.25 + rnd() * 0.35, size: 0.8 + rnd() * 0.6, flap: 14 + rnd() * 6});
    }
    flocks = [];
    for (let k = 0; k < 3; k++) {
      const depth = 0.35 + rnd() * 0.65, birds = [];
      const count = 3 + Math.floor(rnd() * 5);
      for (let i = 0; i < count; i++) birds.push({dx: -i * (18 + rnd() * 10) * depth, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 9 * depth + (rnd() - 0.5) * 6, ph: rnd() * 6, flap: 7 + rnd() * 3});
      flocks.push({depth, birds, y: H * (0.08 + rnd() * 0.3), v: 22 + depth * 38, off: rnd() * (W + 600), bob: rnd() * 6, dir: rnd() < 0.7 ? 1 : -1});
    }
    hills = [
      {y: horizon - H * 0.06, amp: H * 0.05, f: 0.004, ph: rnd() * 10, c1: '#8fb7a6', c2: '#a7c9b2'},
      {y: horizon - H * 0.015, amp: H * 0.035, f: 0.007, ph: rnd() * 10, c1: '#6fa864', c2: '#86bd6f'},
    ];
    // helai rumput: makin ke bawah makin dekat (lebih tinggi, lebih tebal, lebih gelap di pangkal)
    blades = [];
    const n = Math.min(2600, Math.round(W * 2.4));
    for (let i = 0; i < n; i++) {
      const d = Math.pow(rnd(), 0.8);   // 0 = jauh (dekat horizon), 1 = dekat
      blades.push({
        x: rnd() * (W + 40) - 20, y: horizon + 4 + d * (H - horizon), d,
        h: (8 + rnd() * 14) * (0.35 + d * 1.9), w: (1 + rnd() * 1.6) * (0.4 + d * 1.4),
        hue: 85 + rnd() * 30, light: 30 + rnd() * 18, ph: rnd() * Math.PI * 2, lean: (rnd() - 0.5) * 0.5,
      });
    }
    blades.sort((a, b) => a.y - b.y);
    flowers = [];
    for (let i = 0; i < Math.round(W / 18); i++) {
      const d = 0.3 + rnd() * 0.7;
      flowers.push({x: rnd() * W, y: horizon + 10 + d * (H - horizon - 10), d, c: ['#ffffff', '#ffe066', '#ff8fc7', '#c9a2ff'][Math.floor(rnd() * 4)], ph: rnd() * 6});
    }
  }

  function hillPath(hl, t) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) {
      const y = hl.y - Math.sin(x * hl.f + hl.ph) * hl.amp - Math.sin(x * hl.f * 2.3 + hl.ph * 1.7) * hl.amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath();
  }

  function draw(t) {
    // langit
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#4f9be0'); sky.addColorStop(0.55, '#8cc6f2'); sky.addColorStop(1, '#d9efff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 2);
    // cahaya matahari
    const sx = W * 0.82, sy = H * 0.12, sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.45);
    sun.addColorStop(0, 'rgba(255,248,214,0.95)'); sun.addColorStop(0.08, 'rgba(255,242,190,0.6)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, horizon);
    // awan bergeser
    for (const c of clouds) {
      const x = ((c.x + t * c.v) % (W + c.img.width + 200)) - c.img.width - 100;
      ctx.globalAlpha = c.a; ctx.drawImage(c.img, x, c.y); ctx.globalAlpha = 1;
    }
    // burung terbang (siluet gelap, sayap mengepak)
    for (const f of flocks) {
      const span = W + 600, lead = (f.off + t * f.v) % span - 300;
      const fx = f.dir > 0 ? lead : W - lead, fy = f.y + Math.sin(t * 0.6 + f.bob) * 10;
      const s = 0.55 + f.depth * 0.9;
      ctx.strokeStyle = `rgba(40,48,60,${0.55 + f.depth * 0.35})`;
      ctx.lineWidth = 1.2 + f.depth * 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const b of f.birds) {
        const x = fx + b.dx * f.dir, y = fy + b.dy + Math.sin(t * 1.3 + b.ph) * 2;
        const wing = Math.sin(t * b.flap + b.ph);            // -1..1 kepakan
        const tipY = y - wing * 6 * s, midY = y - 2 * s + wing * 2 * s, span2 = 9 * s;
        ctx.beginPath();
        ctx.moveTo(x - span2, tipY);
        ctx.quadraticCurveTo(x - span2 * 0.45, midY - 3 * s, x, y);
        ctx.quadraticCurveTo(x + span2 * 0.45, midY - 3 * s, x + span2, tipY);
        ctx.stroke();
      }
    }
    // bukit
    for (const hl of hills) {
      hillPath(hl, t);
      const g = ctx.createLinearGradient(0, hl.y - hl.amp, 0, horizon + 20);
      g.addColorStop(0, hl.c2); g.addColorStop(1, hl.c1);
      ctx.fillStyle = g; ctx.fill();
    }
    // tanah padang
    const field = ctx.createLinearGradient(0, horizon, 0, H);
    field.addColorStop(0, '#7fb954'); field.addColorStop(1, '#3f7d2a');
    ctx.fillStyle = field; ctx.fillRect(0, horizon, W, H - horizon);
    // angin: hembusan bergelombang yang berjalan melintasi padang
    const gustAt = x => Math.sin(t * 0.9 - x * 0.006) * 0.5 + Math.sin(t * 0.37 - x * 0.0021 + 1.3) * 0.5;
    ctx.lineCap = 'round';
    for (const b of blades) {
      const gust = gustAt(b.x);
      const sway = (Math.sin(t * 2.1 + b.ph + b.x * 0.02) * 0.18 + gust * 0.55 + b.lean) * (0.5 + b.d * 0.7);
      const tipX = b.x + sway * b.h, tipY = b.y - b.h * (1 - Math.abs(sway) * 0.18);
      ctx.strokeStyle = `hsl(${b.hue}, ${45 + b.d * 15}%, ${b.light + (1 - b.d) * 14 + gust * 4}%)`;
      ctx.lineWidth = b.w;
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(b.x + sway * b.h * 0.25, b.y - b.h * 0.55, tipX, tipY);
      ctx.stroke();
    }
    for (const f of flowers) {
      const sway = gustAt(f.x) * 4 * f.d + Math.sin(t * 2 + f.ph) * 1.2;
      const r = 1.5 + f.d * 2.5;
      ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x + sway, f.y - 6 * f.d, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2b52a'; ctx.beginPath(); ctx.arc(f.x + sway, f.y - 6 * f.d, r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // kupu-kupu: melayang zig-zag, sayap mengepak cepat (lebar sayap dipersempit-diperlebar)
    for (const b of butterflies) {
      const tt = t * b.sp + b.ph;
      const x = (b.x0 + tt * 40 + Math.sin(tt * 1.7) * 60 + Math.sin(tt * 4.3) * 14) % (W + 60) - 30;
      const y = b.y0 + Math.sin(tt * 1.3) * 40 + Math.sin(tt * 5.1) * 10 - Math.abs(Math.sin(tt * 2.2)) * 18;
      const open = 0.25 + Math.abs(Math.sin(t * b.flap + b.ph)) * 0.75;   // 0.25 (tertutup) .. 1 (terbuka)
      const k = b.size * (1.6 + (y - horizon) / (H - horizon) * 1.6);   // makin dekat makin besar
      const tilt = Math.cos(tt * 1.7) * 0.35;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      for (const side of [-1, 1]) {
        ctx.save(); ctx.scale(side * open, 1);
        ctx.fillStyle = b.c1; ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(3.2 * k, -2.6 * k, 3.4 * k, 2.6 * k, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();   // sayap atas
        ctx.fillStyle = b.c2;
        ctx.beginPath(); ctx.ellipse(2.4 * k, 1.8 * k, 2.3 * k, 1.8 * k, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();    // sayap bawah
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(3.8 * k, -3 * k, 0.7 * k, 0, Math.PI * 2); ctx.fill();   // bintik
        ctx.restore();
      }
      ctx.fillStyle = '#2b1a0a'; ctx.beginPath(); ctx.ellipse(0, 0, 0.7 * k, 3 * k, 0, 0, Math.PI * 2); ctx.fill();   // badan
      ctx.strokeStyle = '#2b1a0a'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(0, -2.8 * k); ctx.lineTo(-1.4 * k, -5 * k); ctx.moveTo(0, -2.8 * k); ctx.lineTo(1.4 * k, -5 * k); ctx.stroke();   // antena
      ctx.restore();
    }
  }

  let start = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (title.hidden) return;   // permainan berjalan: latar judul tidak digambar
    draw(still ? 20 : (now - start) / 1000);
  }
  addEventListener('resize', build);
  build();
  requestAnimationFrame(frame);
})();
