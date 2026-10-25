'use strict';
/* Tampilan 3D (Three.js r128): "realistis" (bawaan, lihat real3d.js) atau low-poly (?lowpoly).
   1 petak = 1 unit; x = kolom, z = baris, y = atas. */
(function () {
  if (!window.THREE) return;
  const RL = window.Real3D && Real3D.enabled ? Real3D : null;   // null = gaya low-poly
  const TOON = !!(RL && RL.toon);                                 // 3D Kartun (bawaan)
  const structGroup = new THREE.Group(), ghostGroup = new THREE.Group();
  let structSig = '', ghostSig = '';
  let worldVer = 0, ground3 = null, skyCtl = null, soilState = null, worldOf = null, grassMesh = null, windowsLit = null, treeGroup = null;

  let renderer, scene, camera, sun, hemi, fxCanvas, fx;
  let groundCtx, groundTex, focusMesh, rain, snow, playerRig;
  const rigs = new Map(), eggMeshes = [], workerRigs = [];   // ternak per id & telur (dibuat sesuai kebutuhan)
  // kualitas grafik: Otomatis menurunkan level bila fps < ~40 (laptop GPU terintegrasi, layar Retina, sambil merekam)
  // grass = bagian dari kumpulan rumput (dibuat 1,5× kepadatan Tinggi agar HD bisa lebih lebat)
  const QUAL = [
    {name: 'HD',            pr: 2,    shadow: 4096, grass: 1,    shadows: true, hd: true},   // laptop & HP kuat; hanya manual
    {name: 'Tinggi',        pr: 1.5,  shadow: 2048, grass: 0.67, shadows: true},
    // turunkan resolusi & bayangan dulu; rumput tetap lebat agar tampilan tidak berubah
    {name: 'Sedang',        pr: 1.0,  shadow: 1024, grass: 0.67, shadows: true},
    {name: 'Rendah',        pr: 0.75, shadow: 1024, grass: 0.53, shadows: true},
    {name: 'Sangat rendah', pr: 0.6,  shadow: 512,  grass: 0.33, shadows: false},
  ];
  const AUTO_TOP = 1;   // Otomatis mulai dari Tinggi, tidak pernah naik ke HD
  const GFX_KEY = 'kebunPelangi.gfx';
  let qMode = 'auto', qLevel = AUTO_TOP, fpsAcc = 0, fpsN = 0, fpsNow = 0;
  try {
    const p = JSON.parse(localStorage.getItem(GFX_KEY) || 'null');
    // pengaturan lama (sebelum ada HD) memakai indeks tanpa HD → geser satu
    if (p) { qMode = p.mode === 'manual' ? 'manual' : 'auto'; qLevel = clamp((p.level | 0) + (p.v === 2 ? 0 : 1), 0, QUAL.length - 1); }
    if (qMode === 'auto') qLevel = Math.max(qLevel, AUTO_TOP);
  } catch (e) { /* tanpa penyimpanan */ }
  const saveGfx = () => { try { localStorage.setItem(GFX_KEY, JSON.stringify({v: 2, mode: qMode, level: qLevel})); } catch (e) { /* abaikan */ } };
  const tiles = new Map();            // "x,y" -> {sig, group}
  const windowMats = [];
  const tools = {};
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const CAMS = [{id: 'atas', name: 'atas (gaya HM64)'}, {id: 'dekat', name: 'dekat'}, {id: 'mata', name: 'mata petani'}];
  let camMode = 0, shake = 0, baseFov = 40;
  const want = new THREE.Vector3(), look = new THREE.Vector3();
  let groundAt = -1, lastDraw = performance.now(), faceAngle = 0, pxPerUnit = 40;
  const v3 = new THREE.Vector3();

  /* ---------- bahan & bentuk dasar (dibagi pakai) ---------- */
  const MATS = {}, GEOS = {};
  const mat = c => MATS[c] || (MATS[c] = RL
    ? new THREE.MeshStandardMaterial({color: RL.lin(c), roughness: 0.8, metalness: 0, envMapIntensity: 0.5})
    : new THREE.MeshPhongMaterial({color: c, flatShading: true, shininess: 4}));
  // bahan berwarna-per-titik (daun & batu organik di mode realistis)
  const matV = c => MATS['v' + c] || (MATS['v' + c] = new THREE.MeshStandardMaterial({color: RL.lin(c), vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.5}));
  const geo = (k, make) => GEOS[k] || (GEOS[k] = make());
  const BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
  const ICO = () => geo('ico', () => RL ? RL.blobGeo(0, 2, 0.16) : new THREE.IcosahedronGeometry(0.5, 0));
  const SPH = () => geo('sph', () => new THREE.IcosahedronGeometry(0.5, 1));
  const CYL = () => geo('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  const CONE = () => geo('cone', () => new THREE.ConeGeometry(0.5, 1, 6));
  const DOD = () => geo('dod', () => new THREE.DodecahedronGeometry(0.5, 0));
  function part(g, m, x, y, z, sx, sy, sz) {
    const o = new THREE.Mesh(g, typeof m === 'string' ? mat(m) : m);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    o.castShadow = true; o.receiveShadow = true;
    return o;
  }
  const bx = (c, x, y, z, sx, sy, sz) => part(BOX(), c, x, y, z, sx, sy, sz);
  const tilt = (o, rx, rz) => { o.rotation.x = rx; o.rotation.z = rz; return o; };
  const leaf = c => RL ? matV(c) : c;   // daun memakai warna-per-titik di mode realistis

  // versi realistis untuk pohon, semak, batu, tunggul, rumput liar
  function buildObjReal(o, tx, ty) {
    const G = new THREE.Group(), v = h2(tx, ty, 3), blob = (i, d, a, sm) => RL.blobGeo(i, d, a, sm);
    switch (o) {
      case 'rock':   // batu utama + kerikil di sekitarnya
        G.add(part(RL.rockGeo((tx * 7 + ty) % 6), matV('#ffffff'), 0, 0.1, 0, 0.66, 0.5, 0.58));
        for (let i = 0; i < 4; i++) {
          const a = h2(tx, ty, 20 + i) * 6.28, r = 0.3 + h2(tx, ty, 30 + i) * 0.12, sz = 0.06 + h2(tx, ty, 40 + i) * 0.07;
          G.add(part(RL.rockGeo(i), matV('#ffffff'), Math.cos(a) * r, sz * 0.35, Math.sin(a) * r, sz * 1.3, sz, sz * 1.1));
        }
        G.rotation.y = v * 6;
        return G;
      case 'stump':
        G.add(part(RL.stumpGeo(), matV('#ffffff'), 0, 0, 0, 1, 1, 1));
        G.rotation.y = v * 6;
        return G;
      case 'weed':
        G.add(RL.weedTuft(tx * 31 + ty));
        return G;
    }
    return buildObj(o, tx, ty, true);
  }

  /* ---------- benda di petak ---------- */
  function buildObj(o, tx, ty, plain) {
    if (RL && !plain) return buildObjReal(o, tx, ty);
    const G = new THREE.Group(), v = h2(tx, ty, 3);
    switch (o) {
      case 'tree':
        if (ty === MH - 1) {   // tepi selatan: semak rendah agar tidak menutupi pandangan kamera
          G.add(part(ICO(), '#2f7d32', 0, 0.3, 0, 1.1, 0.6, 1.0));
          G.add(part(ICO(), '#3f9a3f', 0.25 * (v - 0.5), 0.5, 0, 0.6, 0.4, 0.6));
          break;
        }
        G.add(part(CYL(), '#7a4a24', 0, 0.45, 0, 0.22, 0.9, 0.22));
        G.add(part(ICO(), '#2f7d32', 0, 1.2, 0, 1.25, 1.05, 1.25));
        G.add(part(ICO(), '#3f9a3f', 0.1, 1.65, -0.05, 0.85, 0.8, 0.85));
        G.rotation.y = v * 6; G.scale.setScalar(0.85 + v * 0.35);
        break;
      case 'rock':
        G.add(part(DOD(), '#8a8f96', 0, 0.16, 0, 0.62, 0.42, 0.55));
        G.add(part(DOD(), '#a4aab2', 0.2, 0.1, 0.15, 0.25, 0.2, 0.25));
        G.rotation.y = v * 6;
        break;
      case 'stump':
        G.add(part(CYL(), '#7a4e26', 0, 0.16, 0, 0.5, 0.32, 0.5));
        G.add(part(CYL(), '#c79a5e', 0, 0.33, 0, 0.44, 0.02, 0.44));
        break;
      case 'weed':
        for (const [x, z, h] of [[-0.15, 0.05, 0.35], [0.05, -0.1, 0.45], [0.18, 0.12, 0.3]])
          G.add(tilt(part(CONE(), '#3e8f2e', x, h / 2, z, 0.12, h, 0.12), x, z));
        break;
      case 'bin':
        G.add(bx('#9a6634', 0, 0.28, 0, 0.8, 0.56, 0.7));
        G.add(bx('#7a4a22', 0, 0.6, 0, 0.88, 0.08, 0.78));
        G.add(bx('#f6c343', 0, 0.36, 0.36, 0.16, 0.12, 0.02));
        break;
      case 'feed':
        G.add(bx('#8a5a2b', 0, 0.14, 0, 0.9, 0.26, 0.45));
        G.add(bx(troughFull(tx, ty) ? '#f2d060' : '#4a2a10', 0, 0.28, 0, 0.78, 0.02, 0.33));
        break;
      case 'hay':
        G.add(bx('#8a5a2b', 0, 0.14, 0, 0.9, 0.26, 0.45));
        if (troughFull(tx, ty)) { G.add(part(SPH(), '#e8cf6a', 0, 0.3, 0, 0.8, 0.25, 0.4)); G.add(part(SPH(), '#d9bb55', 0.2, 0.36, 0.05, 0.3, 0.15, 0.25)); }
        else G.add(bx('#4a2a10', 0, 0.28, 0, 0.78, 0.02, 0.33));
        break;
      case 'sign':
        G.add(bx('#7a4a24', 0, 0.35, 0, 0.08, 0.7, 0.08));
        G.add(bx('#b07a42', 0, 0.68, 0.04, 0.72, 0.4, 0.06));
        break;
      case 'forsale':   // papan "Dijual" merah dengan koin emas
        for (const x of [-0.28, 0.28]) G.add(bx('#6a4020', x, 0.4, 0, 0.07, 0.8, 0.07));
        G.add(bx('#c8382c', 0, 0.72, 0.03, 0.78, 0.42, 0.06));
        G.add(bx('#f1e6d0', 0, 0.72, 0.065, 0.62, 0.08, 0.01));
        G.add(tilt(part(CYL(), '#f6c343', 0, 0.72, 0.08, 0.2, 0.03, 0.2), Math.PI / 2, 0));
        break;
      case 'fruit': return buildFruitTree(tx, ty);
      case 'deco': case 'flower': return buildDeco(tx, ty);
    }
    return G;
  }
  // bangunan & pagar disusun ulang bila kandang/lumbung dipasang atau dipindah
  function syncStructures() {
    const sig = buildings().map(b => b.kind + b.x + ',' + b.y).join('|');
    if (sig === structSig) return;
    structSig = sig;
    structGroup.clear();
    for (const b of buildings()) structGroup.add(buildBuilding({...b, id: b.kind}));
    structGroup.add(buildFences());
    windowsLit = null;
  }
  // pratinjau penempatan: hijau = bisa, merah = tidak
  function syncGhost() {
    const b = R.build;
    if (!R.buildMode || !b || b.pick || b.x == null) { ghostGroup.visible = false; return; }
    const ok = canPlace(b.kind, b.x, b.y, b.moveId), sig = [b.kind, b.x, b.y, ok].join(',');
    ghostGroup.visible = true;
    if (sig === ghostSig) return;
    ghostSig = sig;
    ghostGroup.clear();
    const d = BUILD[b.kind], r = footprint(b.kind, b.x, b.y), col = ok ? '#3ad65a' : '#e8473a';
    const flat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.32, depthWrite: false});
    const solid = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.45, depthWrite: false});
    const area = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 + 1, r.y1 - r.y0 + 1), flat);
    area.rotation.x = -Math.PI / 2; area.position.set((r.x0 + r.x1 + 1) / 2, 0.06, (r.y0 + r.y1 + 1) / 2);
    ghostGroup.add(area);
    const h = d.deco ? 0.6 : 1.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.98, h, d.h * 0.98), solid);
    box.position.set(b.x + d.w / 2, h / 2, b.y + d.h / 2);
    ghostGroup.add(box);
  }

  // dekorasi mode bangun
  function buildDeco(tx, ty) {
    const G = new THREE.Group(), d = decoAt(tx, ty);
    if (!d) return G;
    const v = h2(tx, ty, 7);
    switch (d.kind) {
      case 'pagar': {   // tiang + palang yang menyambung ke pagar tetangga
        G.add(bx('#7a5534', 0, 0.3, 0, 0.09, 0.6, 0.09));
        const m = pagarMask(tx, ty);
        for (const [bit, dx, dz] of [[1, 1, 0], [2, -1, 0], [4, 0, 1], [8, 0, -1]]) if (m & bit)
          for (const y of [0.24, 0.46]) G.add(bx('#9a7450', dx * 0.25, y, dz * 0.25, dx ? 0.5 : 0.05, 0.06, dz ? 0.5 : 0.05));
        if (!m) for (const y of [0.24, 0.46]) G.add(bx('#9a7450', 0, y, 0, 0.7, 0.06, 0.05));
        break;
      }
      case 'bunga':
        G.add(part(CYL(), '#6b4a2e', 0, 0.04, 0, 0.8, 0.08, 0.8));
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4 + v * 6, r = 0.12 + (i % 3) * 0.1, col = ['#ff6fa8', '#ffd84a', '#ffffff', '#b98cff', '#ff8a3d'][i % 5];
          G.add(part(CONE(), '#4a9a34', Math.cos(a) * r, 0.14, Math.sin(a) * r, 0.05, 0.2, 0.05));
          G.add(part(SPH(), col, Math.cos(a) * r, 0.26, Math.sin(a) * r, 0.11, 0.08, 0.11));
        }
        break;
      case 'semak':
        G.add(part(ICO(), RL ? matV('#3f7a2c') : '#3f8a32', 0, 0.3, 0, 0.85, 0.6, 0.85));
        G.add(part(ICO(), RL ? matV('#4f8f36') : '#4f9a3a', 0.15, 0.48, -0.05, 0.5, 0.4, 0.5));
        break;
      case 'bangku':
        G.add(bx('#9a6a3c', 0, 0.3, 0, 0.8, 0.06, 0.32));
        G.add(bx('#9a6a3c', 0, 0.52, -0.14, 0.8, 0.22, 0.05));
        for (const x of [-0.34, 0.34]) for (const z of [-0.12, 0.12]) G.add(bx('#3a3a3a', x, 0.14, z, 0.05, 0.28, 0.05));
        G.rotation.y = 0;
        break;
      case 'sprinkler': {   // penyiram otomatis: dudukan beton, pipa, kepala putar biru + percikan air
        G.add(part(CYL(), '#9a9a94', 0, 0.05, 0, 0.36, 0.1, 0.36));
        G.add(part(CYL(), '#b8bec6', 0, 0.25, 0, 0.07, 0.34, 0.07));
        G.add(part(CYL(), '#2f7fd0', 0, 0.45, 0, 0.2, 0.08, 0.2));
        G.add(part(CONE(), '#d5dbe1', 0, 0.53, 0, 0.1, 0.1, 0.1));
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          G.add(part(CYL(), '#b8bec6', Math.cos(a) * 0.12, 0.47, Math.sin(a) * 0.12, 0.03, 0.03, 0.03));
          const drop = new THREE.Mesh(SPH(), new THREE.MeshBasicMaterial({color: '#8fd3ff', transparent: true, opacity: 0.55}));
          drop.position.set(Math.cos(a) * 0.32, 0.36, Math.sin(a) * 0.32); drop.scale.set(0.07, 0.07, 0.07);
          G.add(drop);
        }
        break;
      }
      case 'lampu': {
        G.add(part(CYL(), '#2e2e2e', 0, 0.55, 0, 0.07, 1.1, 0.07));
        G.add(part(CYL(), '#2e2e2e', 0, 0.04, 0, 0.22, 0.08, 0.22));
        const glow = RL ? new THREE.MeshStandardMaterial({color: RL.lin('#fff2c0'), roughness: 0.3}) : new THREE.MeshPhongMaterial({color: '#fff2c0'});
        windowMats.push(glow);   // menyala di malam hari bersama jendela
        G.add(part(BOX(), glow, 0, 1.15, 0, 0.2, 0.24, 0.2));
        G.add(bx('#2e2e2e', 0, 1.3, 0, 0.26, 0.05, 0.26));
        windowsLit = null;
        break;
      }
    }
    return G;
  }
  // bit tetangga pagar: 1 kanan, 2 kiri, 4 bawah, 8 atas
  function pagarMask(tx, ty) {
    const is = (x, y) => { const d = decoAt(x, y); return d && d.kind === 'pagar'; };
    return (is(tx + 1, ty) ? 1 : 0) | (is(tx - 1, ty) ? 2 : 0) | (is(tx, ty + 1) ? 4 : 0) | (is(tx, ty - 1) ? 8 : 0);
  }
  const troughFull = (tx, ty) => { const st = troughAt(tx, ty); return !!st && st.food > 0; };

  // pohon buah: bibit kecil yang membesar, lalu pohon rimbun; buah bulat berwarna saat berbuah
  function buildFruitTree(tx, ty) {
    const G = new THREE.Group(), t = S.orchard[tx + ',' + ty];
    if (!t) return G;
    const f = FRUITS[t.type], v = h2(tx, ty, 3), grown = Math.min(1, t.days / f.grow);
    const canopy = RL ? matV(RL.toon ? '#5cbf44' : '#4a8a34') : '#4fa83a';
    G.rotation.y = v * 6;
    if (grown < 1 / 3) {   // tunas: gundukan tanah + batang tipis + beberapa daun (seperti Hay Day)
      const k = 0.7 + grown * 0.9;
      G.add(part(CYL(), RL ? '#6b4a2e' : '#7a5232', 0, 0.03, 0, 0.42, 0.06, 0.42));
      G.add(part(CYL(), '#7a5232', 0, 0.2 * k, 0, 0.035, 0.36 * k, 0.035));
      for (const [x, y, z] of [[0.08, 0.32, 0], [-0.08, 0.28, 0.04], [0, 0.4, -0.07], [0.02, 0.44, 0.06]])
        G.add(tilt(part(SPH(), '#5cbf44', x * k, y * k, z * k, 0.13 * k, 0.05 * k, 0.09 * k), z * 4, -x * 6));
      return G;
    }
    const sz = grown < 2 / 3 ? 0.45 + grown * 0.4 : 0.7 + 0.3 * grown;   // pohon muda → pohon besar
    G.add(part(geo('ftrunk', () => new THREE.CylinderGeometry(0.06, 0.1, 1, 8)), RL ? '#6b4a2e' : '#7a4a24', 0, 0.45 * sz, 0, sz, 0.9 * sz, sz));
    const blobs = [[0, 1.05, 0, 0.95], [0.28, 0.92, 0.1, 0.6], [-0.25, 0.95, -0.12, 0.62], [0.05, 1.3, -0.05, 0.6]];
    for (const [x, y, z, s] of blobs) G.add(part(ICO(), canopy, x * sz, y * sz, z * sz, s * sz, s * 0.85 * sz, s * sz));
    if (t.fruit) for (let i = 0; i < 9; i++) {
      const a = i * 2.39 + v * 6, h = 0.8 + (i % 3) * 0.2, r = 0.42 + (i % 2) * 0.08;
      G.add(part(SPH(), f.color, Math.cos(a) * r * sz, h * sz, Math.sin(a) * r * sz, 0.13, t.type === 'pir' ? 0.16 : 0.13, 0.13));
    }
    return G;
  }

  function cropStage(cr) {
    const d = CROPS[cr.type];
    return cr.dead ? 'x' : cr.days >= d.grow ? 3 : Math.min(2, Math.floor(cr.days / d.grow * 3));
  }
  function buildCrop(cr) {
    const G = new THREE.Group(), d = CROPS[cr.type], st = cropStage(cr);
    if (st === 'x') {
      for (const [x, z, a] of [[0, 0, 0.3], [0.12, -0.05, -0.5], [-0.1, 0.08, 0.6]]) G.add(tilt(part(CYL(), '#a08050', x, 0.15, z, 0.04, 0.32, 0.04), 0, a));
      return G;
    }
    if (st === 0) { for (const [x, z] of [[-0.15, 0.05], [0.1, -0.1], [0.05, 0.15]]) G.add(bx('#e8d08a', x, 0.03, z, 0.07, 0.05, 0.07)); return G; }
    if (st === 1) { G.add(tilt(part(CONE(), d.leaf, -0.05, 0.12, 0, 0.1, 0.25, 0.1), 0, 0.4)); G.add(tilt(part(CONE(), d.leaf, 0.06, 0.12, 0, 0.1, 0.25, 0.1), 0, -0.4)); return G; }
    if (st === 2) {
      if (cr.type === 'jagung') { G.add(part(CYL(), d.leaf, 0, 0.45, 0, 0.08, 0.9, 0.08)); G.add(tilt(part(CONE(), d.leaf, 0.12, 0.45, 0, 0.08, 0.4, 0.08), 0, -0.7)); return G; }
      G.add(part(ICO(), leaf(d.leaf), 0, 0.2, 0, 0.42, 0.36, 0.42));
      G.add(tilt(part(CONE(), d.leaf, 0.1, 0.35, 0, 0.1, 0.3, 0.1), 0, -0.5));
      return G;
    }
    switch (cr.type) {
      case 'lobak': case 'kentang': case 'wortel': case 'ubi':
        for (const [x, z] of [[-0.1, 0], [0.1, 0.02], [0, -0.1]]) G.add(tilt(part(CONE(), d.leaf, x, 0.38, z, 0.12, 0.45, 0.12), z * 3, -x * 3));
        if (cr.type === 'wortel') G.add(part(SPH(), d.color, 0, 0.08, 0, 0.24, 0.22, 0.24));
        else G.add(part(SPH(), d.color, 0, 0.12, 0, 0.36, 0.3, 0.36));
        if (cr.type === 'lobak') G.add(part(SPH(), d.accent, 0, 0.2, 0, 0.3, 0.12, 0.3));
        break;
      case 'stroberi': case 'tomat': case 'terong': {
        G.add(part(ICO(), leaf(d.leaf), 0, 0.3, 0, 0.62, 0.58, 0.62));
        const long = cr.type === 'terong';
        for (const [x, y, z] of [[0.25, 0.25, 0.15], [-0.22, 0.3, 0.18], [0.05, 0.42, 0.25], [0.15, 0.18, -0.24]])
          G.add(part(SPH(), d.color, x, y, z, long ? 0.12 : 0.14, long ? 0.24 : 0.14, long ? 0.12 : 0.14));
        break;
      }
      case 'jagung':
        G.add(part(CYL(), d.leaf, 0, 0.7, 0, 0.08, 1.4, 0.08));
        G.add(tilt(part(CONE(), d.leaf, -0.14, 0.5, 0, 0.08, 0.45, 0.08), 0, 0.8));
        G.add(tilt(part(CONE(), d.leaf, 0.14, 0.9, 0, 0.08, 0.45, 0.08), 0, -0.8));
        G.add(tilt(part(CYL(), d.color, 0.1, 0.75, 0.04, 0.11, 0.3, 0.11), 0, -0.3));
        G.add(part(CONE(), '#e8c070', 0, 1.47, 0, 0.1, 0.16, 0.1));
        break;
      case 'semangka':
        G.add(part(SPH(), d.color, 0, 0.22, 0, 0.56, 0.44, 0.5));
        for (const x of [-0.14, 0, 0.14]) G.add(bx(d.accent, x, 0.22, 0, 0.03, 0.42, 0.5));
        G.add(tilt(part(CONE(), d.leaf, -0.3, 0.1, -0.2, 0.18, 0.12, 0.18), 0, 1.2));
        break;
    }
    return G;
  }

  function tileSig(tx, ty) {
    const o = S.obj[ty][tx], s = S.soil[ty][tx];
    // mode realistis: pohon digambar sekaligus sebagai instans (lihat Real3D.makeTrees)
    let sig = o && o !== 'bld' && !(RL && o === 'tree') ? o : '';
    if (o === 'fruit') { const t = S.orchard[tx + ',' + ty]; if (t) sig += t.type + Math.min(t.days, FRUITS[t.type].grow) + (t.fruit ? 'F' : ''); }
    if (o === 'feed' || o === 'hay') sig += troughFull(tx, ty) ? 1 : 0;
    if (o === 'deco' || o === 'flower') { const d = decoAt(tx, ty); if (d) sig += d.kind + (d.kind === 'pagar' ? pagarMask(tx, ty) : ''); }
    if (RL && s) sig += '#s' + (s.watered ? 2 : 1);   // Realistis & Kartun: bedeng berupa gundukan 3D
    if (s && s.crop) sig += '|' + s.crop.type + cropStage(s.crop);
    return sig;
  }
  // bedeng kartun: gundukan tanah persegi menonjol dengan tiga alur, lebih gelap bila disiram
  const MOUND_H = 0.12;
  function buildMound(wet) {
    const G = new THREE.Group();
    const g = geo('mound', () => new THREE.CylinderGeometry(0.62, 0.69, MOUND_H, 4, 1).rotateY(Math.PI / 4).translate(0, MOUND_H / 2, 0));
    G.add(part(g, wet ? '#6b3f22' : '#9a5e34', 0, 0, 0, 1, 1, 1));
    for (const z of [-0.26, 0, 0.26]) G.add(bx(wet ? '#5a341c' : '#86502b', 0, MOUND_H + 0.012, z, 0.76, 0.03, 0.09));
    return G;
  }
  // bedeng realistis: gundukan tanah dengan 3 guludan membulat, warna tanah bervariasi; basah = lebih gelap & sedikit mengilap
  const BED_H = 0.1;
  const bedMat = wet => MATS['bed' + wet] || (MATS['bed' + wet] = new THREE.MeshStandardMaterial({vertexColors: true, roughness: wet ? 0.55 : 0.95, metalness: 0, envMapIntensity: wet ? 0.8 : 0.3}));
  function buildBed(wet, tx, ty) {
    const key = 'bed' + (wet ? 'W' : 'D') + ((tx + ty * 3) % 3);
    const tmp = new THREE.Color(), base = new THREE.Color(wet ? '#30200f' : '#4f331d'), light = new THREE.Color(wet ? '#44301a' : '#6b4829');
    const soil = (x, y, z) => {
      const n = vn(x * 14 + tx * 3.7, z * 14 + ty * 2.3), clod = vn(x * 42 + 5, z * 42 + y * 25);
      const furrow = 0.62 + clamp(y / 0.16, 0, 1) * 0.45;   // dasar alur lebih gelap
      tmp.copy(base).lerp(light, n).multiplyScalar(furrow * (clod > 0.78 ? 1.18 : clod < 0.22 ? 0.85 : 1));
      return tmp.getHex();
    };
    const m = new THREE.Mesh(ORG[key] || (ORG[key] = organic([
      // guludan tanah saja (tanpa alas persegi), lebar & saling menempel, ujungnya membulat
      ...[-0.3, 0, 0.3].map(z => ({g: geo('ridge', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 10).rotateZ(Math.PI / 2)), m: MX(0, 0.02, z, 0.9, 0.17, 0.34), col: soil, jitter: 0.04})),
      ...[-0.3, 0, 0.3].flatMap(z => [-1, 1].map(sx => ({g: SPH2(), m: MX(sx * 0.45, 0.02, z, 0.16, 0.17, 0.34), col: soil, jitter: 0.03}))),
    ])), bedMat(wet));
    m.receiveShadow = true; m.castShadow = false;
    return m;
  }
  // pagar kayu: tiang tiap ±0,5 petak + dua palang; satu mesh gabungan (statis)
  function buildFences() {
    const parts = [], post = '#7a5534', rail = '#9a7450';
    for (const [a, b, c, d] of allFences()) {
      const len = Math.hypot(c - a, d - b), n = Math.max(1, Math.round(len * 2)), ang = Math.atan2(d - b, c - a);
      for (let i = 0; i <= n; i++) {
        const x = a + (c - a) * i / n, z = b + (d - b) * i / n;
        parts.push({g: BOX(), m: MX(x, 0.3, z, 0.08, 0.6, 0.08), col: post});
      }
      for (const y of [0.24, 0.46]) parts.push({g: BOX(), m: MX((a + c) / 2, y, (b + d) / 2, len, 0.06, 0.04, 0, -ang, 0), col: rail});
    }
    const m = new THREE.Mesh(organic(parts), animMat());
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function syncTiles() {
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const key = tx + ',' + ty, sig = tileSig(tx, ty), cur = tiles.get(key);
      if (cur && cur.sig === sig) continue;
      if (cur) { scene.remove(cur.group); cur.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
      if (!sig) { tiles.delete(key); continue; }
      const G = new THREE.Group();
      const o = S.obj[ty][tx], s = S.soil[ty][tx];
      if (sig && o && o !== 'bld' && !(RL && o === 'tree')) G.add(buildObj(o, tx, ty));
      if (RL && s) G.add(TOON ? buildMound(s.watered) : buildBed(s.watered, tx, ty));
      if (s && s.crop) { const c = buildCrop(s.crop); if (RL) c.position.y = TOON ? MOUND_H : BED_H; G.add(c); }
      G.position.set(tx + 0.5, 0, ty + 0.5);
      scene.add(G);
      tiles.set(key, {sig, group: G});
    }
  }

  /* ---------- bangunan ---------- */
  let texPlank = null, texShingle = null;
  function texMat(kind, c, rx, ry) {
    const key = kind + c + rx + ry;
    if (MATS[key]) return MATS[key];
    const base = kind === 'plank' ? (texPlank || (texPlank = RL.planks(renderer))) : (texShingle || (texShingle = RL.shingles(renderer)));
    const map = base.clone(); map.needsUpdate = true; map.repeat.set(rx, ry);
    return (MATS[key] = new THREE.MeshStandardMaterial({color: RL.lin(c), map, roughness: 0.85, metalness: 0, envMapIntensity: 0.5}));
  }
  function prism(w, d, h, c) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {depth: w, bevelEnabled: false});
    g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);
    const m = new THREE.Mesh(g, RL ? texMat('shingle', c, 1, 1) : mat(c)); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function windowAt(G, x, y, z) {
    const m = RL ? new THREE.MeshStandardMaterial({color: RL.lin('#6f8fa3'), roughness: 0.08, metalness: 0.2, envMapIntensity: 1.2})
      : new THREE.MeshPhongMaterial({color: '#9fd3f7', flatShading: true, shininess: 30});
    windowMats.push(m);
    G.add(bx('#5d3a1a', x, y, z, 0.5, 0.42, 0.04));
    G.add(part(BOX(), m, x, y, z + 0.015, 0.4, 0.32, 0.04));
    G.add(bx('#5d3a1a', x, y, z + 0.03, 0.04, 0.32, 0.03));
  }
  function buildBuilding(b) {
    const G = new THREE.Group();
    const W = b.w - 0.1, D = b.h - 0.1, H = 1.35;
    const front = D / 2 + 0.02, doorX = b.door[0] + 0.5 - (b.x + b.w / 2);
    const style = {
      rumah:   {wall: '#f1dfb4', roof: '#c0392b', trim: '#a0703f', door: '#7a4a24'},
      kandang: {wall: '#b5462f', roof: '#6b3a2a', trim: '#f1e6d0', door: '#8a3a26'},
      toko:    {wall: '#d9a066', roof: '#3f8f4a', trim: '#a06a3a', door: '#4a2a10'},
      lumbung: {wall: '#a8402c', roof: '#5e2a20', trim: '#f1e6d0', door: '#8a3020'},
    }[b.id];
    G.add(bx(RL ? texMat('plank', style.wall, Math.round(W * 1.5), 1) : style.wall, 0, H / 2, 0, W, H, D));
    if (RL) G.add(bx('#7d7a72', 0, 0.06, 0, W + 0.12, 0.12, D + 0.12));   // fondasi batu
    G.add(bx(style.trim, 0, 0.05, 0, W + 0.04, 0.1, D + 0.04));
    for (const sx of [-1, 1]) G.add(bx(style.trim, sx * (W / 2 - 0.04), H / 2, front - 0.02, 0.1, H, 0.06));
    const roof = prism(W + 0.4, D + 0.5, 1.0, style.roof);
    roof.position.y = H; G.add(roof);
    G.add(bx(style.door, doorX, 0.42, front, 0.55, 0.84, 0.05));
    G.add(bx('#f6c343', doorX + 0.18, 0.42, front + 0.04, 0.05, 0.05, 0.03));
    if (b.id === 'rumah') {
      windowAt(G, -1.4, 0.75, front); windowAt(G, 1.4, 0.75, front);
      G.add(bx('#8a8f96', 1.4, H + 0.75, -0.3, 0.32, 0.8, 0.32));
    } else if (b.id === 'kandang') {
      windowAt(G, 1.1, 0.8, front);
      for (const a of [0.6, -0.6]) G.add(tilt(bx(style.trim, doorX, 0.42, front + 0.03, 0.06, 0.95, 0.02), 0, a));
    } else if (b.id === 'lumbung') {
      // pintu geser besar bertanda X + jendela loteng jerami
      G.add(bx(style.trim, doorX, 0.55, front + 0.01, 1.3, 1.1, 0.04));
      G.add(bx(style.door, doorX, 0.55, front + 0.03, 1.18, 1.0, 0.04));
      for (const a of [0.72, -0.72]) G.add(tilt(bx(style.trim, doorX, 0.55, front + 0.06, 0.07, 1.45, 0.02), 0, a));
      G.add(bx(style.trim, 0, H + 0.42, front - 0.18, 0.5, 0.42, 0.04));
      windowAt(G, 0, H + 0.42, front - 0.16);
      // silo di pojok belakang, masih di dalam tapak lumbung (tidak bisa ditembus petani)
      G.add(part(geo('silo', () => new THREE.CylinderGeometry(0.42, 0.42, 2.8, 14)), '#c9c4bb', W / 2 - 0.45, 1.4, -D / 2 + 0.45, 1, 1, 1));
      G.add(part(SPH(), '#7d7a72', W / 2 - 0.45, 2.8, -D / 2 + 0.45, 0.84, 0.5, 0.84));
    } else {
      windowAt(G, -1.5, 0.75, front); windowAt(G, 1.5, 0.75, front);
      for (let i = 0; i < 10; i++) G.add(tilt(bx(i % 2 ? '#fff4e6' : '#d9534f', -W / 2 + 0.25 + i * (W - 0.5) / 9, H - 0.05, front + 0.22, (W - 0.5) / 9, 0.06, 0.5), 0.35, 0));
      G.add(bx('#7a4a24', 0, H + 0.95, D / 2 - 0.2, 1.1, 0.42, 0.08));
      G.add(tilt(part(CYL(), '#f6c343', 0, H + 0.95, D / 2 - 0.14, 0.26, 0.04, 0.26), Math.PI / 2, 0));
    }
    G.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
    return G;
  }

  /* ---------- petani, ayam, alat ---------- */
  function buildTool(id) {
    const G = new THREE.Group(), handle = () => G.add(part(CYL(), '#8a5a2b', 0, 0.25, 0, 0.04, 0.5, 0.04));
    switch (id) {
      case 'cangkul': handle(); G.add(bx('#9aa3ad', 0, 0.5, 0.08, 0.16, 0.05, 0.2)); break;
      case 'penyiram': G.add(part(CYL(), '#5b9bd5', 0, 0.12, 0, 0.22, 0.2, 0.22)); G.add(tilt(part(CYL(), '#5b9bd5', 0, 0.16, 0.16, 0.04, 0.22, 0.04), 0.9, 0)); break;
      case 'sabit': handle(); G.add(tilt(bx('#c0c8d0', 0.08, 0.5, 0, 0.22, 0.04, 0.04), 0, 0.6)); break;
      case 'palu': handle(); G.add(bx('#7d858f', 0, 0.52, 0, 0.12, 0.12, 0.24)); break;
      case 'kapak': handle(); G.add(bx('#c0c8d0', 0, 0.48, 0.08, 0.04, 0.16, 0.16)); break;
      case 'benih': G.add(bx('#c9a46a', 0, 0.1, 0, 0.18, 0.2, 0.14)); break;
      case 'pemerah': G.add(part(CYL(), '#c0c8d0', 0, 0.12, 0.1, 0.2, 0.22, 0.2)); G.add(part(CYL(), '#ffffff', 0, 0.235, 0.1, 0.17, 0.01, 0.17)); break;
    }
    G.visible = false;
    return G;
  }
  // anggota badan berporos di pangkal (skala 1, supaya alat di tangan tidak terdistorsi)
  function limb(w, h, d, c, x, y) {
    const m = part(geo(`limb${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0)), c, x, y, 0, 1, 1, 1);
    return m;
  }
  function buildPlayer() {
    const P = new THREE.Group(), body = new THREE.Group();
    const legL = limb(0.12, 0.3, 0.14, '#5a3415', -0.08, 0.3), legR = limb(0.12, 0.3, 0.14, '#5a3415', 0.08, 0.3);
    const armL = limb(0.1, 0.3, 0.1, '#e2554a', -0.22, 0.66), armR = limb(0.1, 0.3, 0.1, '#e2554a', 0.22, 0.66);
    body.add(legL, legR, armL, armR);
    body.add(bx('#3f6fb5', 0, 0.42, 0, 0.32, 0.26, 0.2));
    body.add(bx('#e2554a', 0, 0.6, 0, 0.34, 0.14, 0.22));
    body.add(bx('#f2c49b', 0, 0.82, 0, 0.26, 0.24, 0.24));
    body.add(bx('#6a3a1a', 0, 0.88, -0.03, 0.27, 0.14, 0.22));
    body.add(bx('#2b1a0a', -0.06, 0.82, 0.125, 0.04, 0.05, 0.01));
    body.add(bx('#2b1a0a', 0.06, 0.82, 0.125, 0.04, 0.05, 0.01));
    body.add(part(CYL(), '#e8c35a', 0, 0.96, 0, 0.5, 0.03, 0.5));
    body.add(part(CYL(), '#e8c35a', 0, 1.04, 0, 0.24, 0.13, 0.24));
    body.add(part(CYL(), '#c0392b', 0, 1.0, 0, 0.25, 0.03, 0.25));
    const hand = new THREE.Group();
    hand.position.set(0, -0.3, 0.02); hand.rotation.x = Math.PI;   // alat menyambung arah lengan
    armR.add(hand);
    for (const t of TOOLS) if (t.id !== 'tangan') { tools[t.id] = buildTool(t.id); hand.add(tools[t.id]); }
    P.add(body);
    P.userData = {body, legL, legR, armL, armR};
    P.scale.setScalar(1.15);
    return P;
  }
  // karyawan: petani berbaju hijau, peternak berbaju merah, keduanya bercaping
  function buildWorker(job) {
    const P = new THREE.Group(), shirt = job === 'petani' ? '#4f8f3a' : '#c0532b';
    const legL = limb(0.12, 0.3, 0.14, '#5a3415', -0.08, 0.3), legR = limb(0.12, 0.3, 0.14, '#5a3415', 0.08, 0.3);
    const armL = limb(0.1, 0.3, 0.1, shirt, -0.22, 0.66), armR = limb(0.1, 0.3, 0.1, shirt, 0.22, 0.66);
    P.add(legL, legR, armL, armR);
    P.add(bx('#3a4a6a', 0, 0.42, 0, 0.32, 0.26, 0.2));
    P.add(bx(shirt, 0, 0.6, 0, 0.34, 0.16, 0.22));
    P.add(bx('#f2c49b', 0, 0.82, 0, 0.26, 0.24, 0.24));
    for (const x of [-0.06, 0.06]) P.add(bx('#2b1a0a', x, 0.82, 0.125, 0.04, 0.05, 0.01));
    P.add(part(CONE(), '#e8c35a', 0, 1.02, 0, 0.62, 0.2, 0.62));   // caping
    // alat di tangan kanan: gembor air (petani) / ember pakan (peternak)
    const tool = job === 'petani' ? bx('#4a90d9', 0, -0.32, 0.08, 0.14, 0.12, 0.2) : part(CYL(), '#b8bec6', 0, -0.32, 0.06, 0.16, 0.14, 0.16);
    armR.add(tool);
    P.userData = {legL, legR, armL, armR};
    P.scale.setScalar(1.1);
    return P;
  }
  // ternak menghadap +z; kaki berporos di pangkal agar bisa melangkah
  function buildCow() {
    const C = new THREE.Group(), legs = [];
    for (const [x, z] of [[-0.15, 0.28], [0.15, 0.28], [-0.15, -0.28], [0.15, -0.28]]) { const l = limb(0.1, 0.32, 0.1, '#ece6da', x, 0.34); l.position.z = z; legs.push(l); C.add(l); }
    C.add(bx('#fafaf5', 0, 0.5, 0, 0.46, 0.36, 0.82));
    for (const [x, y, z, w, h, d] of [[0.232, 0.52, 0.1, 0.02, 0.2, 0.26], [-0.232, 0.48, -0.18, 0.02, 0.22, 0.3], [0.05, 0.69, -0.1, 0.24, 0.02, 0.28]])
      C.add(bx('#2b2b2b', x, y, z, w, h, d));
    C.add(bx('#f2a7b0', 0, 0.3, -0.12, 0.16, 0.08, 0.16));               // ambing
    C.add(bx('#fafaf5', 0, 0.68, 0.5, 0.26, 0.26, 0.26));                 // kepala
    C.add(bx('#2b2b2b', 0.08, 0.76, 0.5, 0.12, 0.1, 0.27));
    C.add(bx('#f2a7b0', 0, 0.6, 0.65, 0.22, 0.12, 0.06));                 // moncong
    for (const x of [-0.12, 0.12]) { C.add(bx('#e8dcc0', x, 0.84, 0.46, 0.04, 0.08, 0.04)); C.add(bx('#fafaf5', x * 1.4, 0.72, 0.42, 0.08, 0.05, 0.05)); }
    for (const x of [-0.06, 0.06]) C.add(bx('#1a1a1a', x, 0.72, 0.633, 0.03, 0.03, 0.01));
    C.add(tilt(bx('#fafaf5', 0, 0.48, -0.44, 0.04, 0.3, 0.04), 0.3, 0));
    C.userData = {legs, head: null};
    return C;
  }
  function buildGoat() {
    const C = new THREE.Group(), legs = [];
    for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) { const l = limb(0.06, 0.28, 0.06, '#c4aa86', x, 0.28); l.position.z = z; legs.push(l); C.add(l); }
    C.add(bx('#d9c2a0', 0, 0.4, 0, 0.3, 0.26, 0.52));
    C.add(bx('#e9dcc4', 0, 0.42, 0.05, 0.31, 0.12, 0.3));
    const head = new THREE.Group(); head.position.set(0, 0.58, 0.32); C.add(head);
    head.add(bx('#d9c2a0', 0, 0, 0, 0.18, 0.2, 0.22));
    head.add(bx('#f2ecdc', 0, -0.13, 0.08, 0.05, 0.1, 0.04));             // jenggot
    for (const x of [-0.06, 0.06]) { head.add(tilt(bx('#7a6a5a', x, 0.14, -0.04, 0.035, 0.14, 0.035), -0.6, 0)); head.add(bx('#c4aa86', x * 2, 0.02, -0.02, 0.08, 0.04, 0.05)); }
    for (const x of [-0.05, 0.05]) head.add(bx('#1a1a1a', x, 0.03, 0.111, 0.025, 0.025, 0.01));
    C.add(tilt(bx('#d9c2a0', 0, 0.52, -0.28, 0.05, 0.1, 0.05), -0.6, 0));
    C.userData = {legs, head};
    return C;
  }
  function buildChicken() {
    const C = new THREE.Group();
    C.add(bx('#fffaf0', 0, 0.2, 0, 0.22, 0.18, 0.3));
    C.add(bx('#e8e2d0', 0, 0.22, -0.02, 0.24, 0.1, 0.18));
    C.add(bx('#fffaf0', 0, 0.36, 0.12, 0.13, 0.15, 0.13));
    C.add(bx('#e0402f', 0, 0.45, 0.12, 0.04, 0.06, 0.1));
    C.add(bx('#f0a030', 0, 0.35, 0.2, 0.05, 0.04, 0.06));
    C.add(bx('#fffaf0', 0, 0.3, -0.17, 0.12, 0.14, 0.06));
    for (const x of [-0.05, 0.05]) C.add(bx('#e8a33c', x, 0.05, 0, 0.03, 0.1, 0.03));
    C.scale.setScalar(1.8);
    C.userData = {legs: [], head: C.children[2]};
    return C;
  }
  /* ---------- ternak realistis (mode Realistis & Kartun): bentuk organik + warna per titik ---------- */
  // tiap bagian = elipsoid/kerucut yang digabung jadi satu geometri berwarna; dicache per jenis & varian
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3(), _c = new THREE.Color();
  function organic(parts) {
    const pos = [], nor = [], col = [];
    for (const p of parts) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g, P = g.attributes.position, N = g.attributes.normal;
      _m3.getNormalMatrix(p.m);
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(p.m);
        _n.fromBufferAttribute(N, i).applyMatrix3(_m3).normalize();
        if (p.jitter) _v.addScaledVector(_n, (vn(_v.x * 17 + _v.y * 5, _v.z * 17 - _v.y * 3) - 0.5) * p.jitter);   // permukaan gembur
        pos.push(_v.x, _v.y, _v.z); nor.push(_n.x, _n.y, _n.z);
        _c.set(typeof p.col === 'function' ? p.col(_v.x, _v.y, _v.z) : p.col);
        if (RL) _c.convertSRGBToLinear();
        col.push(_c.r, _c.g, _c.b);
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const MX = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const SPH2 = () => geo('sph2', () => new THREE.SphereGeometry(0.5, 22, 16));
  const LEGG = () => geo('legg', () => new THREE.CylinderGeometry(0.5, 0.34, 1, 12).translate(0, -0.5, 0));   // poros di pangkal
  const HOOF = () => geo('hoof', () => new THREE.CylinderGeometry(0.45, 0.55, 1, 12));
  const CON2 = () => geo('con2', () => new THREE.ConeGeometry(0.5, 1, 12));
  const animMat = () => MATS.animal || (MATS.animal = RL
    ? new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.5})
    : new THREE.MeshPhongMaterial({vertexColors: true, shininess: 6}));
  const ORG = {};
  const orgMesh = (key, make) => { const m = new THREE.Mesh(ORG[key] || (ORG[key] = organic(make())), animMat()); m.castShadow = m.receiveShadow = true; return m; };
  const vn = (x, y) => window.Real3D ? Real3D.vnoise(x, y) : 0.5;
  const sym = (f) => [-1, 1].map(f);
  function legRig(C, key, x, y, z, make) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z);
    pivot.add(orgMesh(key, make)); C.add(pivot);
    return pivot;
  }

  function cowReal(id) {
    const v = id % 3, C = new THREE.Group(), seed = v * 7.3 + 1;
    // belang Holstein: bercak hitam dari noise pada posisi titik, perut & kaki bawah putih
    const coat = (x, y, z) => y < 0.5 ? '#f1eee6' : vn(x * 3.1 + seed + y * 1.7, z * 3.1 + y * 0.9) > 0.56 ? '#1f1d1b' : '#f4f2ec';
    C.add(orgMesh('cowBody' + v, () => [
      {g: SPH2(), m: MX(0, 0.8, 0, 0.56, 0.5, 1.02), col: coat},          // badan
      {g: SPH2(), m: MX(0, 0.86, -0.36, 0.54, 0.48, 0.5), col: coat},     // pinggul
      {g: SPH2(), m: MX(0, 0.82, 0.34, 0.5, 0.52, 0.52), col: coat},      // dada & bahu
      {g: SPH2(), m: MX(0, 0.92, 0.56, 0.28, 0.32, 0.38, -0.55), col: coat}, // leher
      {g: SPH2(), m: MX(0, 0.52, -0.14, 0.2, 0.13, 0.2), col: '#e9a9a0'},  // ambing
    ]));
    const head = new THREE.Group(); head.position.set(0, 0.98, 0.78); C.add(head);
    head.add(orgMesh('cowHead' + v, () => [
      {g: SPH2(), m: MX(0, 0, 0, 0.26, 0.28, 0.42, 0.4), col: (x, y, z) => vn(x * 5 + seed, y * 5) > 0.6 ? '#1f1d1b' : '#f4f2ec'},
      {g: SPH2(), m: MX(0, -0.1, 0.19, 0.22, 0.17, 0.2), col: '#e3ab9e'},  // moncong
      ...sym(s => ({g: SPH2(), m: MX(s * 0.16, 0.07, -0.08, 0.17, 0.05, 0.09, 0, 0, s * 0.35), col: '#f1eee6'})),   // telinga
      ...sym(s => ({g: CON2(), m: MX(s * 0.09, 0.16, -0.1, 0.035, 0.11, 0.035, 0, 0, -s * 0.55), col: '#dcd0b6'})), // tanduk
      ...sym(s => ({g: SPH2(), m: MX(s * 0.11, 0.05, 0.09, 0.045, 0.045, 0.045), col: '#111111'})),               // mata
      ...sym(s => ({g: SPH2(), m: MX(s * 0.05, -0.1, 0.29, 0.03, 0.03, 0.02), col: '#5a3a36'})),                  // lubang hidung
    ]));
    const legs = [[-0.18, 0.36], [0.18, 0.36], [-0.18, -0.36], [0.18, -0.36]].map(([x, z]) => legRig(C, 'cowLeg', x, 0.64, z, () => [
      {g: LEGG(), m: MX(0, 0, 0, 0.13, 0.58, 0.13), col: (x2, y) => y > -0.25 ? '#f4f2ec' : '#efebe2'},
      {g: HOOF(), m: MX(0, -0.6, 0, 0.1, 0.06, 0.1), col: '#2a2622'},
    ]));
    const tail = new THREE.Group(); tail.position.set(0, 0.98, -0.66); tail.rotation.x = 0.2; C.add(tail);
    tail.add(orgMesh('cowTail', () => [
      {g: LEGG(), m: MX(0, 0, 0, 0.035, 0.58, 0.035), col: '#f1eee6'},
      {g: SPH2(), m: MX(0, -0.62, 0, 0.07, 0.14, 0.07), col: '#1f1d1b'},
    ]));
    C.scale.setScalar(0.9);
    C.userData = {legs, head, headY: head.position.y, tail};
    return C;
  }
  function goatReal(id) {
    const v = id % 3, C = new THREE.Group(), seed = v * 5.1 + 3;
    const coat = (x, y, z) => vn(x * 3.6 + seed, z * 3.6 + y) > 0.62 ? '#a8784a' : y < 0.42 ? '#e2d6bc' : '#ece2cc';
    C.add(orgMesh('goatBody' + v, () => [
      {g: SPH2(), m: MX(0, 0.55, 0, 0.36, 0.36, 0.7), col: coat},
      {g: SPH2(), m: MX(0, 0.58, -0.22, 0.34, 0.34, 0.36), col: coat},
      {g: SPH2(), m: MX(0, 0.56, 0.22, 0.32, 0.36, 0.34), col: coat},
      {g: SPH2(), m: MX(0, 0.7, 0.36, 0.17, 0.28, 0.2, -0.6), col: coat},
      {g: SPH2(), m: MX(0, 0.72, -0.38, 0.06, 0.14, 0.06, -0.6), col: coat},   // ekor tegak
    ]));
    const head = new THREE.Group(); head.position.set(0, 0.84, 0.5); C.add(head);
    head.add(orgMesh('goatHead' + v, () => [
      {g: SPH2(), m: MX(0, 0, 0, 0.17, 0.19, 0.32, 0.5), col: '#ece2cc'},
      {g: SPH2(), m: MX(0, -0.07, 0.13, 0.13, 0.12, 0.14), col: '#d9cbb0'},
      {g: CON2(), m: MX(0, -0.17, 0.1, 0.05, 0.15, 0.05, Math.PI), col: '#f6f1e6'},                                // jenggot
      ...sym(s => ({g: CON2(), m: MX(s * 0.05, 0.15, -0.09, 0.035, 0.2, 0.035, -1.0, 0, s * 0.18), col: '#7a6a58'})), // tanduk melengkung ke belakang
      ...sym(s => ({g: SPH2(), m: MX(s * 0.13, 0.03, -0.04, 0.16, 0.04, 0.07, 0, 0, s * 0.2), col: '#e2d6bc'})),     // telinga mendatar
      ...sym(s => ({g: SPH2(), m: MX(s * 0.08, 0.04, 0.06, 0.035, 0.035, 0.035), col: '#3a2a10'})),
    ]));
    const legs = [[-0.11, 0.24], [0.11, 0.24], [-0.11, -0.24], [0.11, -0.24]].map(([x, z]) => legRig(C, 'goatLeg', x, 0.42, z, () => [
      {g: LEGG(), m: MX(0, 0, 0, 0.075, 0.4, 0.075), col: '#e2d6bc'},
      {g: HOOF(), m: MX(0, -0.42, 0, 0.06, 0.04, 0.06), col: '#3a3028'},
    ]));
    C.scale.setScalar(0.85);
    C.userData = {legs, head, headY: head.position.y};
    return C;
  }
  function pigReal(id) {
    const C = new THREE.Group(), v = id % 2, seed = v * 4.7 + 2;
    const skin = (x, y, z) => v && vn(x * 4 + seed, z * 4 + y) > 0.64 ? '#4a3a36' : y < 0.36 ? '#eba0aa' : '#f5b2bc';   // babi merah muda / sesekali bertotol
    C.add(orgMesh('pigBody' + v, () => [
      {g: SPH2(), m: MX(0, 0.48, 0, 0.5, 0.46, 0.86), col: skin},          // badan bulat
      {g: SPH2(), m: MX(0, 0.5, -0.24, 0.48, 0.44, 0.46), col: skin},
      {g: SPH2(), m: MX(0, 0.5, 0.26, 0.46, 0.44, 0.44), col: skin},
    ]));
    const head = new THREE.Group(); head.position.set(0, 0.56, 0.5); C.add(head);
    head.add(orgMesh('pigHead' + v, () => [
      {g: SPH2(), m: MX(0, 0, 0, 0.32, 0.3, 0.3), col: '#f5b2bc'},
      {g: geo('snout', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16).rotateX(Math.PI / 2)), m: MX(0, -0.04, 0.17, 0.15, 0.11, 0.08), col: '#e88a98'},   // moncong
      ...sym(s => ({g: SPH2(), m: MX(s * 0.035, -0.04, 0.215, 0.025, 0.035, 0.02), col: '#9a4a56'})),                 // lubang hidung
      ...sym(s => ({g: CON2(), m: MX(s * 0.1, 0.15, 0.0, 0.1, 0.12, 0.04, 0.5, 0, -s * 0.4), col: '#eba0aa'})),        // telinga
      ...sym(s => ({g: SPH2(), m: MX(s * 0.09, 0.05, 0.12, 0.03, 0.03, 0.03), col: '#1a1a1a'})),
    ]));
    const legs = [[-0.13, 0.24], [0.13, 0.24], [-0.13, -0.24], [0.13, -0.24]].map(([x, z]) => legRig(C, 'pigLeg', x, 0.28, z, () => [
      {g: LEGG(), m: MX(0, 0, 0, 0.1, 0.26, 0.1), col: '#eba0aa'},
      {g: HOOF(), m: MX(0, -0.27, 0, 0.08, 0.04, 0.08), col: '#7a4a4a'},
    ]));
    const tail = new THREE.Group(); tail.position.set(0, 0.6, -0.44); C.add(tail);
    tail.add(orgMesh('pigTail', () => [{g: geo('curl', () => new THREE.TorusGeometry(0.05, 0.015, 6, 14, Math.PI * 1.6)), m: MX(0, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0), col: '#eba0aa'}]));
    C.scale.setScalar(0.85);
    C.userData = {legs, head, headY: head.position.y, tail};
    return C;
  }
  function chickenReal(id) {
    const C = new THREE.Group(), v = id % 2;
    const feather = v ? '#f7f3ea' : '#b8673a', wing = v ? '#e8e1d2' : '#8f4a26';   // ayam putih / ayam kampung cokelat
    C.add(orgMesh('ckBody' + v, () => [
      {g: SPH2(), m: MX(0, 0.34, 0, 0.32, 0.3, 0.42), col: feather},
      {g: SPH2(), m: MX(0, 0.3, 0.1, 0.28, 0.28, 0.28), col: feather},                 // dada
      ...[-0.5, 0, 0.5].map(a => ({g: SPH2(), m: MX(a * 0.08, 0.5, -0.2, 0.06, 0.24, 0.14, -0.5, 0, a * 0.5), col: v ? '#efe9dc' : '#2d3a2a'})),   // kipas ekor
      ...sym(s => ({g: SPH2(), m: MX(s * 0.15, 0.36, -0.02, 0.06, 0.17, 0.3, 0.15), col: wing})),     // sayap
      {g: SPH2(), m: MX(0, 0.48, 0.13, 0.15, 0.22, 0.15, -0.3), col: feather},            // leher
    ]));
    const head = new THREE.Group(); head.position.set(0, 0.6, 0.17); C.add(head);
    head.add(orgMesh('ckHead' + v, () => [
      {g: SPH2(), m: MX(0, 0, 0, 0.14, 0.14, 0.15), col: feather},
      ...[-0.04, 0, 0.04].map((z, i) => ({g: SPH2(), m: MX(0, 0.08 + (i === 1 ? 0.015 : 0), z, 0.03, 0.06, 0.05), col: '#d8262a'})),   // jengger
      {g: SPH2(), m: MX(0, -0.07, 0.06, 0.035, 0.06, 0.03), col: '#d8262a'},             // gelambir
      {g: CON2(), m: MX(0, -0.01, 0.1, 0.035, 0.07, 0.035, Math.PI / 2), col: '#e8a020'}, // paruh
      ...sym(s => ({g: SPH2(), m: MX(s * 0.055, 0.02, 0.04, 0.025, 0.025, 0.025), col: '#111111'})),
    ]));
    const legs = sym(s => legRig(C, 'ckLeg', s * 0.06, 0.2, 0, () => [
      {g: LEGG(), m: MX(0, 0, 0, 0.03, 0.2, 0.03), col: '#e8a030'},
      {g: SPH2(), m: MX(0, -0.2, 0.03, 0.05, 0.015, 0.09), col: '#e8a030'},              // jari kaki
    ]));
    C.scale.setScalar(1.3);
    C.userData = {legs, head, headY: head.position.y};
    return C;
  }
  // mode Realistis & Kartun memakai hewan organik; Low-poly tetap bergaya kotak
  // babi low-poly: kotak merah muda dengan moncong
  function buildPig() {
    const C = new THREE.Group(), legs = [];
    for (const [x, z] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]]) { const l = limb(0.09, 0.22, 0.09, '#e08a96', x, 0.24); l.position.z = z; legs.push(l); C.add(l); }
    C.add(bx('#f4a6b2', 0, 0.4, 0, 0.42, 0.34, 0.62));
    const head = new THREE.Group(); head.position.set(0, 0.46, 0.38); C.add(head);
    head.add(bx('#f4a6b2', 0, 0, 0, 0.28, 0.26, 0.2));
    head.add(bx('#e57f8f', 0, -0.03, 0.12, 0.14, 0.1, 0.05));
    for (const x of [-0.09, 0.09]) { head.add(bx('#e08a96', x, 0.15, -0.02, 0.07, 0.07, 0.03)); head.add(bx('#1a1a1a', x * 0.7, 0.05, 0.101, 0.03, 0.03, 0.01)); }
    C.userData = {legs, head, headY: head.position.y};
    return C;
  }
  const RIG = RL ? {ayam: chickenReal, sapi: cowReal, kambing: goatReal, babi: pigReal} : {ayam: buildChicken, sapi: buildCow, kambing: buildGoat, babi: buildPig};

  function focusTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#fff';
    for (const [a, b] of [[0, 0], [26, 0], [0, 26], [26, 26]]) { x.fillRect(a, b + (b ? 4 : 0), 6, 2); x.fillRect(a + (a ? 4 : 0), b, 2, 6); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
    return t;
  }

  /* ---------- ikon alat 3D untuk hotbar (dirender sekali ke canvas, dicache) ---------- */
  let iconR = null, iconScene = null, iconCam = null;
  const ICONS = {};
  const im = (c, metal) => new THREE.MeshStandardMaterial({color: RL ? new THREE.Color(c).convertSRGBToLinear() : c, roughness: metal ? 0.35 : 0.7, metalness: metal ? 0.6 : 0});
  const M_ = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); return m;
  };
  function iconModel(id, cropId) {
    const G = new THREE.Group(), wood = im('#9a6a3c'), steel = im('#c9d0d8', true), dark = im('#6d747c', true);
    const handle = (len = 1.6) => G.add(M_(new THREE.CylinderGeometry(0.06, 0.07, len, 12), wood, 0, 0, 0));
    switch (id) {
      case 'cangkul':
        handle(); G.add(M_(new THREE.BoxGeometry(0.6, 0.06, 0.34), steel, 0.2, 0.78, 0.12, 0.5, 0, 0));
        G.rotation.z = -0.75; break;
      case 'penyiram': {
        const blue = im('#4e93d6');
        G.add(M_(new THREE.CylinderGeometry(0.42, 0.5, 0.75, 24), blue, 0, 0, 0));
        G.add(M_(new THREE.CylinderGeometry(0.43, 0.43, 0.06, 24), im('#3a74b0'), 0, 0.38, 0));
        G.add(M_(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 12), blue, 0.62, 0.22, 0, 0, 0, -0.9));
        G.add(M_(new THREE.ConeGeometry(0.13, 0.18, 16), im('#3a74b0'), 0.98, 0.5, 0, 0, 0, -0.9 + Math.PI));
        G.add(M_(new THREE.TorusGeometry(0.3, 0.05, 10, 24, Math.PI), blue, -0.05, 0.38, 0));
        G.rotation.y = -0.5; G.scale.setScalar(0.95); break;
      }
      case 'sabit':
        G.add(M_(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 12), wood, 0, -0.45, 0));
        G.add(M_(new THREE.TorusGeometry(0.45, 0.06, 6, 28, Math.PI * 1.1), steel, -0.05, 0.4, 0, 0, 0, -0.35, 1, 1, 0.4));
        G.rotation.z = -0.4; break;
      case 'palu':
        handle(1.4); G.add(M_(new THREE.BoxGeometry(0.62, 0.26, 0.26), dark, 0, 0.72, 0));
        G.add(M_(new THREE.BoxGeometry(0.05, 0.27, 0.27), steel, 0.32, 0.72, 0));
        G.rotation.z = -0.75; break;
      case 'kapak': {
        handle();
        const sh = new THREE.Shape(); sh.moveTo(0, -0.18); sh.lineTo(0.45, -0.32); sh.quadraticCurveTo(0.55, 0, 0.45, 0.32); sh.lineTo(0, 0.18); sh.closePath();
        G.add(M_(new THREE.ExtrudeGeometry(sh, {depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2}), steel, 0.04, 0.6, -0.03));
        G.rotation.z = -0.75; break;
      }
      case 'benih': {
        const c = CROPS[cropId] || CROPS.lobak;
        const pts = [[0, -0.55], [0.42, -0.5], [0.5, -0.2], [0.46, 0.2], [0.3, 0.45], [0.16, 0.52], [0.2, 0.68], [0.0, 0.7]].map(([x, y]) => new THREE.Vector2(x, y));
        G.add(M_(new THREE.LatheGeometry(pts, 24), im('#cfa868'), 0, 0, 0));
        G.add(M_(new THREE.TorusGeometry(0.17, 0.035, 8, 20), im('#8a5a2b'), 0, 0.52, 0, Math.PI / 2));
        G.add(M_(new THREE.CircleGeometry(0.22, 24), im(c.color), 0, 0.02, 0.475));
        for (let i = 0; i < 5; i++) G.add(M_(new THREE.SphereGeometry(0.05, 10, 8), im(c.accent || c.color), Math.cos(i * 1.26) * 0.11, 0.02 + Math.sin(i * 1.26) * 0.11, 0.49));
        G.rotation.y = -0.35; break;
      }
      case 'pemerah':
        G.add(M_(new THREE.CylinderGeometry(0.45, 0.36, 0.7, 24, 1, true), im('#c9d0d8', true), 0, 0, 0));
        G.add(M_(new THREE.CircleGeometry(0.42, 24), im('#ffffff'), 0, 0.28, 0, -Math.PI / 2));
        G.add(M_(new THREE.TorusGeometry(0.45, 0.025, 8, 28), dark, 0, 0.35, 0, Math.PI / 2));
        G.add(M_(new THREE.TorusGeometry(0.42, 0.025, 8, 24, Math.PI), dark, 0, 0.35, 0, 0, 0.4));
        G.rotation.x = 0.35; break;
      case 'tangan': {
        const skin = im('#f2c49b');
        G.add(M_(new THREE.SphereGeometry(0.42, 20, 14), skin, 0, -0.1, 0, 0, 0, 0, 1, 1.1, 0.45));
        [-0.27, -0.09, 0.09, 0.27].forEach((x, i) => {
          const len = [0.42, 0.52, 0.5, 0.4][i];
          G.add(M_(new THREE.CylinderGeometry(0.075, 0.08, len, 12), skin, x, 0.3 + len / 2, 0));
          G.add(M_(new THREE.SphereGeometry(0.075, 12, 8), skin, x, 0.3 + len, 0));
        });
        G.add(M_(new THREE.CylinderGeometry(0.08, 0.09, 0.42, 12), skin, -0.42, 0.0, 0.05, 0, 0, 0.9));
        G.add(M_(new THREE.CylinderGeometry(0.36, 0.38, 0.22, 20), im('#e2554a'), 0, -0.55, 0));
        G.rotation.set(0.15, 0.3, 0.1); break;
      }
    }
    return G;
  }
  // gambar ikon alat 3D (128×128, latar transparan); dipakai hotbar & popup benih
  function toolIcon(id, cropId) {
    const key = id + (id === 'benih' ? ':' + (cropId || S && S.seedSel) : '');
    if (ICONS[key]) return ICONS[key];
    if (iconFail) return null;   // ikon 3D tidak tersedia → hotbar memakai ikon piksel
    try { return renderIcon(id, cropId, key); } catch (e) { iconFail = true; console.warn('Ikon 3D gagal, pakai ikon piksel:', e); return null; }
  }
  let iconFail = false;
  function renderIcon(id, cropId, key) {
    if (iconR && iconR.getContext().isContextLost()) iconR = null;
    if (!iconR) {
      iconR = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
      iconR.setSize(128, 128, false); iconR.setPixelRatio(1);
      if (RL) iconR.outputEncoding = THREE.sRGBEncoding;   // tanpa tone mapping: warna tetap pekat
      iconScene = new THREE.Scene();
      iconScene.add(new THREE.HemisphereLight('#ffffff', '#6a5030', 0.55));
      const d = new THREE.DirectionalLight('#fff1dc', 1.1); d.position.set(2, 3, 4); iconScene.add(d);
      const rim = new THREE.DirectionalLight('#cfe2ff', 0.35); rim.position.set(-3, 1, -2); iconScene.add(rim);
      iconCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); iconCam.position.set(0, 0.3, 4.2); iconCam.lookAt(0, 0.2, 0);
    }
    const model = iconModel(id, cropId || (S && S.seedSel));
    // pusatkan & sesuaikan ukuran model ke bingkai
    const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    model.position.sub(c); const s = 1.7 / Math.max(sz.x, sz.y, sz.z); const wrap = new THREE.Group(); wrap.add(model); wrap.scale.setScalar(s); wrap.position.y = 0.2;
    iconScene.add(wrap);
    iconR.render(iconScene, iconCam);
    const out = document.createElement('canvas'); out.width = out.height = 128;
    out.getContext('2d').drawImage(iconR.domElement, 0, 0);
    iconScene.remove(wrap);
    wrap.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return (ICONS[key] = out);
  }

  /* ---------- siklus hidup renderer ---------- */
  function init() {
    const lite = document.body.classList.contains('touch');   // HP: bayangan & resolusi lebih ringan
    renderer = new THREE.WebGLRenderer({antialias: !lite || !!QUAL[qLevel].hd});   // HD: anti-aliasing juga di HP
    renderer.userData = {lite};
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (RL) {
      renderer.outputEncoding = THREE.sRGBEncoding;
      // kartun: tanpa tone mapping agar warna tetap cerah seperti dirancang
      renderer.toneMapping = RL.toon ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.62;
      document.body.classList.add(RL.toon ? 'gfx-toon' : 'gfx-real');
    }
    const el = renderer.domElement;
    el.id = 'game3d'; el.setAttribute('aria-label', 'Dunia permainan Moo & Bloom (3D)');
    el.style.cssText = 'position:fixed;inset:0;display:block';
    fxCanvas = document.createElement('canvas');
    fxCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1';
    document.body.prepend(el, fxCanvas);
    fx = fxCanvas.getContext('2d');

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#8fd3ff');
    scene.fog = new THREE.Fog('#8fd3ff', 20, 42);
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, RL ? 400 : 120);

    hemi = new THREE.HemisphereLight('#dff3ff', '#4a6a30', 0.45);
    sun = new THREE.DirectionalLight('#fff4dd', 0.9);
    sun.castShadow = true;
    const qs = Math.min(QUAL[qLevel].shadow, lite && !QUAL[qLevel].hd ? 1024 : 4096);
    sun.shadow.mapSize.set(qs, qs); sun.castShadow = QUAL[qLevel].shadows;
    Object.assign(sun.shadow.camera, {left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50});
    sun.shadow.bias = -0.0008;
    if (RL) { sun.shadow.normalBias = 0.02; hemi.color = RL.lin('#cfe2ff'); hemi.groundColor = RL.lin('#4a5a30'); }
    scene.add(hemi, sun, sun.target);

    // tanah: tekstur piksel dari fungsi gambar yang sama dengan versi 2D
    const gc = document.createElement('canvas'); gc.width = MW * T; gc.height = MH * T;
    groundCtx = gc.getContext('2d');
    groundTex = new THREE.CanvasTexture(gc);
    groundTex.magFilter = THREE.NearestFilter;
    // tanpa mipmap: aman untuk tekstur non-pangkat-2 di WebGL1 dan murah diunggah ulang
    groundTex.minFilter = THREE.LinearFilter; groundTex.generateMipmaps = false;
    if (RL) ground3 = RL.makeGround(renderer, lite, !!QUAL[qLevel].hd);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), RL ? ground3.material : new THREE.MeshLambertMaterial({map: groundTex}));
    ground.rotation.x = -Math.PI / 2; ground.position.set(MW / 2, 0, MH / 2); ground.receiveShadow = true;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), RL
      ? new THREE.MeshStandardMaterial({color: RL.lin('#4a6a30'), roughness: 1})
      : new THREE.MeshLambertMaterial({color: '#2f6a2a'}));
    outer.rotation.x = -Math.PI / 2; outer.position.set(MW / 2, -0.02, MH / 2);
    scene.add(ground, outer);

    if (RL) {
      scene.add(RL.makeWater());
      soilState = new Int8Array(MW * MH).fill(-1);
    }
    scene.add(structGroup, ghostGroup);
    playerRig = buildPlayer(); scene.add(playerRig);
    focusMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: focusTexture(), transparent: true, opacity: 0.8, depthWrite: false}));
    focusMesh.rotation.x = -Math.PI / 2; scene.add(focusMesh);

    const N = 700, rp = new Float32Array(N * 6), sp = new Float32Array(N * 3);
    rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rp, 3)),
      new THREE.LineBasicMaterial({color: '#cfe4ff', transparent: true, opacity: 0.55}));
    snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)),
      new THREE.PointsMaterial({color: '#ffffff', size: 0.09}));
    rain.frustumCulled = snow.frustumCulled = false;
    rain.userData.seed = Array.from({length: N}, () => [Math.random() * 24 - 12, Math.random() * 9, Math.random() * 24 - 12, 0.7 + Math.random() * 0.6]);
    scene.add(rain, snow);
  }

  function resize() {
    const W = innerWidth, H = innerHeight;
    const q = QUAL[qLevel];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.hd ? 2 : renderer.userData.lite || RL ? 1.5 : 2, q.pr));
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
    const a = W / H;
    camera.aspect = a;
    // layar tegak: perlebar sudut pandang agar ladang tetap terlihat
    baseFov = camera.fov = a >= 1 ? 40 : clamp(2 * Math.atan(Math.tan(20 * Math.PI / 180) / a * 0.7) * 180 / Math.PI, 40, 70);
    camera.updateProjectionMatrix();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fxCanvas.width = W * dpr; fxCanvas.height = H * dpr;
    fxCanvas.style.width = W + 'px'; fxCanvas.style.height = H + 'px';
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function update(dt) {
    const wet = S.weather === 'hujan', cold = S.weather === 'salju';
    if (!wet && !cold) return;
    const seed = rain.userData.seed, cx = camLook.x, cz = camLook.z;
    const rp = rain.geometry.attributes.position.array, sp = snow.geometry.attributes.position.array;
    for (let i = 0; i < seed.length; i++) {
      const d = seed[i];
      d[1] -= (wet ? 13 : 1.2) * d[3] * dt;
      if (cold) d[0] += Math.sin(R.t * 1.5 + i) * 0.3 * dt;
      if (d[1] < 0) { d[1] = 9; d[0] = Math.random() * 24 - 12; d[2] = Math.random() * 24 - 12; }
      const x = cx + d[0], y = d[1], z = cz + d[2];
      if (wet) { const o = i * 6; rp[o] = x; rp[o + 1] = y; rp[o + 2] = z; rp[o + 3] = x - 0.05; rp[o + 4] = y + 0.35; rp[o + 5] = z; }
      else { const o = i * 3; sp[o] = x; sp[o + 1] = y; sp[o + 2] = z; }
    }
    (wet ? rain : snow).geometry.attributes.position.needsUpdate = true;
  }

  function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; }
  const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

  function draw() {
    const now = performance.now(), rawDt = (now - lastDraw) / 1000, dt = Math.min(0.05, rawDt); lastDraw = now;
    watchFps(rawDt);
    const p = S.player, vf = viewFocus(), px = vf.x / T, pz = vf.y / T;   // pusat pandangan: petani atau kamera bebas
    syncTiles();
    syncStructures();
    syncGhost();

    if (RL && (worldOf !== S || worldVer !== (R.worldVer || 0))) {
      // permainan baru/dimuat/wilayah dibuka: lukis seluruh tanah & tanam rumput (butuh data S)
      worldOf = S; worldVer = R.worldVer || 0;
      ground3.repaintAll();
      soilState.fill(-1);
      if (grassMesh) { scene.remove(grassMesh); grassMesh.dispose(); }
      grassMesh = RL.makeGrass(renderer.userData.lite); scene.add(grassMesh);
      applyQuality();
      if (treeGroup) { scene.remove(treeGroup); treeGroup.userData.dispose(); }
      treeGroup = RL.makeTrees(); scene.add(treeGroup);
    }
    if (RL) {
      // gambar ulang hanya petak yang berubah (dicangkul, disiram, diratakan)
      const changed = [];
      for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
        const s = S.soil[ty][tx], st = s ? (s.watered ? 2 : 1) : 0, i = ty * MW + tx;
        if (soilState[i] !== st) { if (soilState[i] !== -1) changed.push([tx, ty]); soilState[i] = st; }
      }
      if (changed.length) ground3.repaint(changed);
      RL.wind.value = now / 1000;
    } else {
    // low-poly: tekstur piksel ±4 fps (cukup untuk riak air), segera bila tanah berubah
    const soilSig = S.soil.map(row => row.map(s => s ? (s.watered ? 2 : 1) : 0).join('')).join('');
    if (soilSig !== groundCtx.canvas.dataset.sig || now - groundAt > 250) {
      groundCtx.canvas.dataset.sig = soilSig; groundAt = now;
      const prev = g; g = groundCtx;
      for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
        drawGround(tx, ty, tx * T, ty * T);
        const s = S.soil[ty][tx];
        if (s) drawSoil(s, tx * T, ty * T);
      }
      g = prev; groundTex.needsUpdate = true;
    }
    }

    // petani
    const U = playerRig.userData, k = 1 - Math.exp(-14 * dt);
    playerRig.position.set(p.x / T, 0, p.y / T - 0.15);
    faceAngle = lerpAngle(faceAngle, {down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2}[p.dir], k);
    playerRig.rotation.y = faceAngle;
    const sw = R.moving ? Math.sin(R.anim * 14) * 0.7 : 0;
    U.legL.rotation.x = sw; U.legR.rotation.x = -sw;
    U.armL.rotation.x = -sw * 0.8;
    U.body.position.y = R.moving ? Math.abs(Math.sin(R.anim * 14)) * 0.04 : 0;
    for (const id in tools) tools[id].visible = R.swing > 0 && R.swingTool === id;
    if (R.swing > 0) {
      const t = 1 - R.swing / 0.25;
      U.armR.rotation.x = R.swingTool === 'penyiram' || R.swingTool === 'benih' ? -1.2 + Math.sin(t * Math.PI) * 0.3 : -2.6 + t * 2.4;
    } else U.armR.rotation.x = sw * 0.8;

    // ternak: buat/hapus model sesuai daftar hewan, lalu gerakkan
    const seen = new Set(), vis = animalsVisible();
    for (const a of S.animals) {
      seen.add(a.id);
      let rig = rigs.get(a.id);
      if (!rig || rig.userData.type !== a.type) {
        if (rig) scene.remove(rig);
        rig = RIG[a.type](a.id); rig.userData.type = a.type; rig.userData.prev = null; rig.userData.angle = 0;
        rigs.set(a.id, rig); scene.add(rig);
      }
      rig.visible = vis;
      if (!vis) continue;
      const U2 = rig.userData, ax = a.x / T, az = a.y / T;
      const moved = U2.prev && Math.abs(ax - U2.prev[0]) + Math.abs(az - U2.prev[1]) > 1e-4;
      if (moved) U2.angle = lerpAngle(U2.angle, Math.atan2(ax - U2.prev[0], az - U2.prev[1]), k);
      U2.prev = [ax, az];
      rig.position.set(ax, 0, az - 0.1);
      rig.rotation.y = U2.angle;
      const walk = (R.ai[a.id] || {walk: 0}).walk, swing = moved ? Math.sin(walk * 10) * 0.5 : 0;
      U2.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3) ? swing : -swing; });
      const down = Math.floor(R.t * 2 + a.id) % 5 === 0;   // mematuk/merumput sesekali
      if (U2.head) U2.head.position.y = (U2.headY ?? (a.type === 'ayam' ? 0.36 : 0.58)) - (down ? (U2.headY ? 0.12 : 0.05) : 0);
      if (U2.tail) U2.tail.rotation.z = Math.sin(R.t * 3 + a.id) * 0.25;   // sapi mengibas ekor
    }
    for (const [id, rig] of rigs) if (!seen.has(id)) { scene.remove(rig); rigs.delete(id); }
    // karyawan yang sedang bekerja hari ini
    const crew = S.shift || [];
    while (workerRigs.length > crew.length) scene.remove(workerRigs.pop());
    crew.forEach((w, i) => {
      let rig = workerRigs[i];
      if (!rig || rig.userData.job !== w.job) { if (rig) scene.remove(rig); rig = buildWorker(w.job); rig.userData.job = w.job; rig.userData.angle = 0; workerRigs[i] = rig; scene.add(rig); }
      const U3 = rig.userData;
      U3.angle = lerpAngle(U3.angle, w.dir || 0, k);
      rig.position.set(w.x / T, 0, w.y / T - 0.1); rig.rotation.y = U3.angle;
      const sw2 = w.walk ? Math.sin(R.t * 12 + i) * 0.6 : 0;
      U3.legL.rotation.x = sw2; U3.legR.rotation.x = -sw2; U3.armL.rotation.x = -sw2 * 0.6;
      U3.armR.rotation.x = w.state === 'work' && w.cool > 0 ? -1.1 + Math.sin(R.t * 10) * 0.25 : sw2 * 0.6;   // menyiram/menuang
    });
    while (eggMeshes.length < S.eggs.length) { const e = part(SPH(), '#fffaf0', 0, 0.11, 0, 0.17, 0.22, 0.17); eggMeshes.push(e); scene.add(e); }
    eggMeshes.forEach((m, i) => { const e = S.eggs[i]; m.visible = !!e; if (e) m.position.set(e.x / T, 0.11, e.y / T); });

    // petak di depan petani
    const [fx0, fy0] = facing();
    focusMesh.visible = !R.modal && !R.noChar && inMap(fx0, fy0);
    focusMesh.position.set(fx0 + 0.5, RL && inMap(fx0, fy0) && S.soil[fy0][fx0] ? (TOON ? MOUND_H : BED_H) + 0.03 : 0.02, fy0 + 0.5);

    // langit, cahaya, cuaca
    const n = night(), dusk = S.time < 1140, wet = S.weather !== 'cerah';
    if (TOON) lightToon(px, pz, n, wet); else if (RL) lightReal(px, pz, n, wet); else {
    let sky = mix(wet ? '#9aa8b8' : '#8fd3ff', dusk ? '#f0a070' : '#1b2350', n / 0.55);
    scene.background = sky; scene.fog.color = sky;
    const dayK = 1 - n / 0.55;
    sun.intensity = (wet ? 0.35 : 0.7) * (0.15 + 0.85 * dayK);
    sun.color = mix('#fff4dd', dusk ? '#ffb070' : '#8090ff', 1 - dayK);
    hemi.intensity = 0.25 + 0.25 * dayK;
    const sunAng = (S.time - 720) / 720 * 1.2;
    sun.position.set(px + Math.sin(sunAng) * 10, 14, pz + 6);
    sun.target.position.set(px, 0, pz);
    }
    const lit = n > 0.15;
    if (lit !== windowsLit) {
      windowsLit = lit;
      for (const m of windowMats) { m.emissive.set(lit ? '#ffc040' : '#000000'); if (RL) m.emissive.convertSRGBToLinear(); }
    }
    const wasOn = rain.visible || snow.visible;
    rain.visible = S.weather === 'hujan'; snow.visible = S.weather === 'salju';
    if (!wasOn && (rain.visible || snow.visible)) update(0);   // isi posisi awal walau dialog pagi masih terbuka

    // kamera: atas (gaya HM64), dekat, atau mata petani
    const mode = CAMS[camMode].id, far = camera.aspect >= 1 ? 1 : 1.25;
    playerRig.visible = mode !== 'mata' && !R.noChar;
    if (mode === 'mata') {
      // agak menunduk agar petak yang dicangkul/disiram terlihat
      const fs = Math.sin(faceAngle), fc = Math.cos(faceAngle);
      want.set(px - fs * 0.35, 1.1, pz - 0.15 - fc * 0.35);
      look.set(px + fs * 1.5, 0.0, pz - 0.15 + fc * 1.5);
    } else {
      const near = mode === 'dekat';
      const tx = near ? px : clamp(px, 4, MW - 4), tz = near ? pz : clamp(pz, 3, MH - 2);
      // kartun: kamera lebih jauh & sudut sempit → kesan hampir isometrik
      const iso = TOON && !near ? 1.55 : 1;
      const zm = R.noChar ? R.zoom : 1;
      if (!RL) { scene.fog.near = 20 * zm; scene.fog.far = 42 * zm; }   // zoom jauh tidak tertutup kabut
      want.set(tx, (near ? 4.2 : 9.5) * far * iso * zm, tz + (near ? 5 : 9) * far * iso * zm);
      look.set(tx, near ? 0.7 : 0.4, tz + 0.3);
    }
    const fovWant = baseFov * (TOON && mode === 'atas' ? 0.66 : 1);
    if (Math.abs(camera.fov - fovWant) > 0.01) { camera.fov = fovWant; camera.updateProjectionMatrix(); }
    if (camPos.lengthSq() === 0) { camPos.copy(want); camLook.copy(look); }
    const ck = mode === 'mata' ? 1 - Math.exp(-18 * dt) : 1 - Math.exp(-6 * dt);
    camPos.lerp(want, ck); camLook.lerp(look, ck);
    camera.position.copy(camPos);
    if (shake > 0) {   // guncangan saat memukul (dimensi "sensasi")
      shake = Math.max(0, shake - dt);
      const a = shake * 0.35;
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a;
    }
    camera.lookAt(camLook);

    renderer.render(scene, camera);
    drawFx(px, pz);
  }

  const C1 = new THREE.Color(), C2 = new THREE.Color(), bgColor = new THREE.Color();
  function lightReal(px, pz, n, wet) {
    if (!skyCtl && THREE.Sky) skyCtl = RL.makeSky(renderer, scene);
    const res = skyCtl ? skyCtl.update(S.time, S.weather) : RL.sunFromTime(S.time);
    const {dir, elev} = res;
    const day = smoothstep(-4, 8, elev), warm = smoothstep(0, 25, elev);
    // langit mendung saat hujan/salju: sembunyikan langit atmosfer, pakai warna abu-abu
    if (skyCtl) skyCtl.sky.visible = !wet;
    const fogC = scene.fog.color;
    if (wet) fogC.set('#7d8893').convertSRGBToLinear().multiplyScalar(0.3 + 0.7 * day);
    else {
      C1.set('#e8a878').convertSRGBToLinear().lerp(C2.set('#b8cfe0').convertSRGBToLinear(), warm);   // senja → siang
      fogC.set('#0b1220').convertSRGBToLinear().lerp(C1, day);                                       // malam → terang
    } scene.fog.near = 24; scene.fog.far = 70;
    // warna latar ditulis tanpa encoding/tone mapping oleh r128 → ubah ke sRGB agar mendekati kabut
    if (skyCtl && !wet) scene.background = null;
    else { bgColor.copy(fogC).convertLinearToSRGB(); scene.background = bgColor; }
    sun.intensity = (wet ? 0.9 : 2.8) * day;
    sun.color.set('#ffb070').convertSRGBToLinear().lerp(C1.set('#fff3e2').convertSRGBToLinear(), warm);
    hemi.intensity = 0.25 + 0.55 * day;
    if (dir.y < 0.05) dir.y = 0.05;   // malam: cahaya bulan lemah dari atas
    sun.position.set(px + dir.x * 20, dir.y * 20, pz + dir.z * 20);
    sun.target.position.set(px, 0, pz);
    renderer.toneMappingExposure = 0.62 + (1 - day) * 0.25;
  }
  // kartun: langit biru cerah polos, cahaya lembut dan hangat; senja jingga, malam biru tua
  function lightToon(px, pz, n, wet) {
    const {dir, elev} = RL.sunFromTime(S.time);
    const day = smoothstep(-4, 8, elev), warm = smoothstep(0, 22, elev);
    const fogC = scene.fog.color;
    C1.set(wet ? '#a9b8c6' : '#ffb27a').lerp(C2.set(wet ? '#b9c6d2' : '#8fd8ff'), warm);
    fogC.set('#1d2a55').lerp(C1, day);   // r128: warna kabut & latar dipakai apa adanya (sRGB) → sama persis
    scene.fog.near = 40; scene.fog.far = 95;
    bgColor.copy(fogC); scene.background = bgColor;
    sun.intensity = (wet ? 0.4 : 0.85) * day;
    sun.color.set('#ffc890').convertSRGBToLinear().lerp(C2.set('#fff6e8').convertSRGBToLinear(), warm);
    hemi.color.set('#ffffff').convertSRGBToLinear(); hemi.groundColor.set('#8cc860').convertSRGBToLinear();
    hemi.intensity = 0.25 + 0.4 * day;
    if (dir.y < 0.05) dir.y = 0.05;
    sun.position.set(px + dir.x * 20, dir.y * 20, pz + dir.z * 20);
    sun.target.position.set(px, 0, pz);
  }
  function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  // titik layar → koordinat dunia (piksel game) lewat perpotongan sinar kamera dengan tanah
  function pickWorld(cx, cy) {
    ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground0, hit) ? [hit.x * T, hit.z * T] : null;
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight, v3.z];
  }
  // partikel game (koordinat piksel 2D) diproyeksikan dari titik asalnya di tanah
  function drawFx(px, pz) {
    fx.clearRect(0, 0, innerWidth, innerHeight);
    for (const [key, t] of Object.entries(S.orchard)) {   // lencana pohon buah
      const [tx, ty] = key.split(',').map(Number);
      const [bx3, by3, bz3] = toScreen(tx + 0.5, 1.9 * (0.35 + 0.65 * Math.min(1, t.days / FRUITS[t.type].grow)) + 0.1, ty + 0.5);
      if (bz3 < 1 && bx3 > -40 && by3 > -20 && bx3 < innerWidth + 40 && by3 < innerHeight + 20) drawFruitBadge(fx, bx3, by3, t, clamp(pxPerUnit / 55, 0.7, 1.6));
    }
    // indikator panen di atas tanaman yang terlihat (bilah % + sisa hari)
    const ck = clamp(pxPerUnit / 55, 0.7, 1.6);
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const s = S.soil[ty][tx];
      if (!s || !s.crop || s.crop.dead) continue;
      const tall = s.crop.type === 'jagung' && cropStage(s.crop) >= 2 ? 1.5 : 0.75;
      const [cx2, cy2, cz] = toScreen(tx + 0.5, tall + (RL ? (TOON ? MOUND_H : BED_H) : 0), ty + 0.5);
      if (cz >= 1 || cx2 < -40 || cy2 < -20 || cx2 > innerWidth + 40 || cy2 > innerHeight + 20) continue;
      drawCropBadge(fx, cx2, cy2, s.crop, s.watered, ck);
    }
    // gelembung hasil/lapar di atas ternak
    { const a0 = toScreen(px, 0, pz), b0 = toScreen(px + 1, 0, pz); pxPerUnit = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]); }
    const bk = clamp(pxPerUnit / 45, 0.8, 1.8);
    for (const a of S.animals) {
      const kind = animalBubble(a);
      if (!kind) continue;
      const [bx2, by2, bz] = toScreen(a.x / T, ({sapi: 1.3, kambing: 1.05, babi: 0.95}[a.type] || 1.1), a.y / T - 0.1);
      if (bz < 1) drawBubble(fx, bx2, by2, kind, bk);
    }
    if (!R.particles.length) return;
    const a = toScreen(px, 0, pz), b = toScreen(px + 1, 0, pz);
    pxPerUnit = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = pxPerUnit / T;
    const prev = g; g = fx;
    for (const q of R.particles) {
      if (q.ox === undefined) { q.ox = q.x; q.oy = q.y; }
      const lift = q.kind === 'text' ? [24, 1.7] : q.kind === 'heart' ? [14, 0.7] : [0, 0.3];
      const [sx, sy] = toScreen(q.ox / T, lift[1], (q.oy + lift[0]) / T);
      const x = sx + (q.x - q.ox) * k, y = sy + (q.y - q.oy) * k;
      fx.globalAlpha = clamp(q.life * 2, 0, 1);
      if (q.kind === 'text') {
        fx.font = '600 18px "Fredoka", ui-rounded, sans-serif'; fx.textAlign = 'center';
        fx.lineWidth = 4; fx.strokeStyle = '#2b1a0a'; fx.strokeText(q.text, x, y);
        fx.fillStyle = q.color; fx.fillText(q.text, x, y);
      } else if (q.kind === 'heart') {
        fx.save(); fx.translate(x, y); fx.scale(3, 3); drawHeart(0, 0, q.color); fx.restore();
      } else { fx.fillStyle = q.color; fx.fillRect(x - 3, y - 3, 6, 6); }
    }
    fx.globalAlpha = 1; g = prev;
  }

  window.Renderers = window.Renderers || {};
  function applyQuality() {
    const q = QUAL[qLevel];
    if (sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.castShadow = q.shadows;
    if (grassMesh) grassMesh.count = Math.max(1, Math.floor(grassMesh.userData.total * q.grass));
    resize();
  }
  // ukur fps tiap 2 detik; mode Otomatis turun satu level bila terlalu lambat
  function watchFps(dt) {
    if (dt <= 0 || dt > 0.25 || document.hidden || R.modal) return;
    fpsAcc += dt; fpsN++;
    if (fpsAcc < 2) return;
    fpsNow = Math.round(fpsN / fpsAcc);
    fpsAcc = fpsN = 0;
    if (qMode === 'auto' && fpsNow < 40 && qLevel < QUAL.length - 1) {
      qLevel++; applyQuality(); saveGfx();
      msg(`Grafik diturunkan ke "${QUAL[qLevel].name}" agar lebih mulus (${fpsNow} fps).`);
    }
  }
  function setQuality(mode) {
    const wasHd = !!QUAL[qLevel].hd;
    if (mode === 'auto') { qMode = 'auto'; qLevel = AUTO_TOP; }   // mulai lagi dari Tinggi, turun sendiri bila perlu
    else { qMode = 'manual'; qLevel = clamp(mode | 0, 0, QUAL.length - 1); }
    fpsAcc = fpsN = 0;
    applyQuality(); saveGfx();
    if (QUAL[qLevel].hd && !wasHd) msg('Grafik HD aktif. Tekstur tanah detail & anti-aliasing penuh berlaku saat game dibuka lagi.');
  }
  const qualityInfo = () => ({mode: qMode, level: qLevel, levels: QUAL.map(q => q.name), fps: fpsNow});

  function cycleCamera() {
    camMode = (camMode + 1) % CAMS.length;
    if (R.noChar && CAMS[camMode].id === 'mata') camMode = (camMode + 1) % CAMS.length;
    R.pov = CAMS[camMode].id === 'mata';
    return CAMS[camMode].name;
  }
  onGame('tool', id => { if (id === 'palu' || id === 'kapak' || id === 'cangkul') shake = id === 'cangkul' ? 0.12 : 0.22; });
  onGame('chop', () => { shake = 0.35; });

  Renderers['3d'] = {init, resize, update, draw, cycleCamera, pickWorld, toolIcon, pxPerTile: () => pxPerUnit, setQuality, qualityInfo, get debug() { return {scene, camera, renderer, playerRig, rigs, eggMeshes, tiles}; }};
})();
