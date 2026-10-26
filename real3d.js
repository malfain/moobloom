'use strict';
/* Grafik "3D Realistis" untuk render3d.js (opsi 3: dunia realistis, karakter tetap imut).
   Semua tekstur dibuat prosedural — tidak ada file gambar/model yang perlu diunduh. */
(function () {
  if (!window.THREE) return;
  const enabled = !/[?&](lowpoly|2d)\b/.test(location.search);
  // gaya: 'real' (bawaan) atau 'kartun' (?kartun, cerah ala game bertani kasual)
  // ?ceria = gaya cerah ala game bertani kasual (pohon cemara & pohon gugur, pagar putih, bunga di tepi jalan)
  const style = /[?&]kartun\b/.test(location.search) ? 'kartun' : /[?&]realistis\b/.test(location.search) ? 'real' : 'ceria';   // bawaan: Ceria
  const ceria = style === 'ceria', toon = style === 'kartun' || ceria;

  /* ---------- noise ---------- */
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h2(xi, yi, 77), b = h2(xi + 1, yi, 77), c = h2(xi, yi + 1, 77), d = h2(xi + 1, yi + 1, 77);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 3) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; f *= 2; a *= 0.5; }
    return s / n;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lin = c => new THREE.Color(c).convertSRGBToLinear();

  /* ---------- tanah: warna + relief per piksel ---------- */
  // Lapisan dasar (rumput/jalan/ladang/dasar kolam) hanya bergantung pada peta tanah yang tak pernah
  // berubah, jadi dihitung sekali. Bedeng (tanah dicangkul) dilukis di atasnya per petak.
  // Hasil ditulis ke `out` = [r, g, b, tinggi] (0..255) agar tidak membuat array per piksel.
  // palet kartun: warna cerah, variasi lembut, bunga kecil di rumput
  function shadeToon(u, v, gt, out) {
    const mid = fbm(u * 0.9, v * 0.9), soft = fbm(u * 2.2 + 9, v * 2.2), f = vnoise(u * 5, v * 5);
    out[3] = 0;
    if (ceria) return shadeCeria(u, v, gt, out, mid, soft, f);
    switch (gt) {
      case 'path': {
        const stone = vnoise(u * 6 + 2, v * 6) > 0.84;
        out[0] = stone ? 222 : lerp(236, 246, soft); out[1] = stone ? 196 : lerp(212, 226, soft); out[2] = stone ? 150 : lerp(158, 176, soft);
        return;
      }
      case 'field': out[0] = lerp(196, 214, soft); out[1] = lerp(140, 156, soft); out[2] = lerp(86, 100, soft); return;
      case 'water': out[0] = 64; out[1] = 160; out[2] = 200; return;
      default: {
        const fl = vnoise(u * 7 + 11, v * 7 + 3);
        if (fl > 0.9) {   // bunga putih/kuning/merah muda
          const k = Math.floor(vnoise(u * 2, v * 2) * 3);
          out[0] = [255, 255, 255][k]; out[1] = [255, 222, 160][k]; out[2] = [255, 80, 200][k];
          return;
        }
        out[0] = lerp(92, 128, mid) + (f - 0.5) * 10; out[1] = lerp(180, 214, mid) + (f - 0.5) * 12; out[2] = lerp(54, 74, mid);
      }
    }
  }
  // palet ceria: rumput hijau terang berbintik cahaya, jalan tanah krem-oranye hangat, ladang cokelat kemerahan
  function shadeCeria(u, v, gt, out, mid, soft, f) {
    const fine = vnoise(u * 26, v * 26), g = fine - 0.5;
    switch (gt) {
      case 'path': {   // jalan tanah terakota, tepi sedikit lebih gelap, butiran halus
        const k = 0.93 + (soft - 0.5) * 0.14 + g * 0.08;
        out[0] = lerp(178, 198, mid) * k; out[1] = lerp(96, 114, mid) * k; out[2] = lerp(58, 72, mid) * k; out[3] = 120 + fine * 60;
        return;
      }
      case 'field': {   // ladang dibajak: tanah cokelat kemerahan dengan alur terang-gelap berselang
        const k = 0.92 + fbm(u * 4.5, v * 4.5, 3) * 0.16, row = smooth(0.25, 0.75, 0.5 + 0.5 * Math.sin(v * Math.PI * 6));
        out[0] = lerp(108, 170, row) * k; out[1] = lerp(56, 98, row) * k; out[2] = lerp(32, 58, row) * k; out[3] = 255 * fine; return;
      }
      case 'water': out[0] = 70; out[1] = 160; out[2] = 196; out[3] = 0; return;
      default: {   // rumput: hijau lembut, sapuan terang-gelap seperti lukisan, bintik helai rumput
        const fl = vnoise(u * 7 + 11, v * 7 + 3);
        if (fl > 0.955) { const k = Math.floor(vnoise(u * 2, v * 2) * 3); out[0] = [250, 246, 236][k]; out[1] = [250, 168, 220][k]; out[2] = [240, 200, 120][k]; out[3] = 200; return; }
        const light = smooth(0.5, 0.78, fbm(u * 0.5 + 2, v * 0.5 + 5)) * 0.4, dark = smooth(0.55, 0.8, fbm(u * 0.8 + 9, v * 0.8 + 1)) * 0.25;
        const blade = vnoise(u * 40 + 3, v * 40) > 0.72 ? -14 : 0;
        out[0] = lerp(lerp(lerp(118, 140, mid), 168, light), 92, dark) + g * 14 + blade * 0.6;
        out[1] = lerp(lerp(lerp(176, 196, mid), 214, light), 150, dark) + g * 16 + blade;
        out[2] = lerp(lerp(lerp(52, 62, mid), 82, light), 44, dark) + g * 8;
        out[3] = 255 * (fine * 0.6 + mid * 0.4);
      }
    }
  }
  function shadeBase(u, v, grid, out) {
    if (toon) {
      const ju = u + (fbm(u * 1.1 + 3.1, v * 1.1) - 0.5) * 0.35, jv = v + (fbm(u * 1.1, v * 1.1 + 7.7) - 0.5) * 0.35;
      return shadeToon(u, v, grid[clamp(Math.floor(jv), 0, MH - 1)][clamp(Math.floor(ju), 0, MW - 1)], out);
    }
    const mid = fbm(u * 3, v * 3), fine = vnoise(u * 28, v * 28), f = fine - 0.5;   // butiran halus seperti versi awal
    // batas antarjenis tanah dibuat bergelombang agar tidak terlihat kotak-kotak
    const ju = u + (fbm(u * 1.1 + 3.1, v * 1.1) - 0.5) * 0.6, jv = v + (fbm(u * 1.1, v * 1.1 + 7.7) - 0.5) * 0.6;
    const gt = grid[clamp(Math.floor(jv), 0, MH - 1)][clamp(Math.floor(ju), 0, MW - 1)];
    switch (gt) {
      case 'path': {
        if (vnoise(u * 18 + 2, v * 18) > 0.8) { const k = 0.9 + fine * 0.25; out[0] = 176 * k; out[1] = 168 * k; out[2] = 156 * k; out[3] = 240; return; }
        out[0] = lerp(166, 196, mid) + f * 16; out[1] = lerp(140, 170, mid) + f * 14; out[2] = lerp(102, 130, mid) + f * 10; out[3] = 110 + fine * 50;
        return;
      }
      case 'field': {   // tanah ladang: gumpalan halus berlapis (tanpa butir per piksel agar tidak kotak-kotak)
        const clod = fbm(u * 4.5, v * 4.5, 3), soft = vnoise(u * 9 + 7, v * 9 + 3), k = 0.84 + clod * 0.26 + (soft - 0.5) * 0.08;
        if (vnoise(u * 6 + 4, v * 6 + 1) > 0.9) { out[0] = 92; out[1] = 112; out[2] = 58; out[3] = 170; return; }   // rumput kecil
        out[0] = lerp(118, 146, mid) * k; out[1] = lerp(88, 110, mid) * k; out[2] = lerp(60, 78, mid) * k; out[3] = 255 * clod;
        return;
      }
      case 'water': out[0] = 58; out[1] = 62; out[2] = 44; out[3] = 60; return;
      default: {
        const dry = smooth(0.6, 0.8, fbm(u * 0.35 + 5, v * 0.35)) * 0.5;
        out[0] = lerp(lerp(48, 92, mid) + f * 22, 132, dry); out[1] = lerp(lerp(86, 130, mid) + f * 26, 124, dry);
        out[2] = lerp(lerp(30, 52, mid) + f * 12, 72, dry); out[3] = 255 * (fine * 0.6 + mid * 0.4);
      }
    }
  }
  // bedeng berbaris; tepi tipis dibiarkan memakai lapisan dasar. true bila piksel ini bedeng.
  function shadeSoil(u, v, s, out) {
    return false;   // bedeng digambar sebagai gundukan 3D (Realistis & Kartun), bukan tekstur
    const tx = Math.floor(u), ty = Math.floor(v), fu = u - tx, fv = v - ty;
    if (Math.min(fu, fv, 1 - fu, 1 - fv) <= 0.05) return false;
    const mid = fbm(u * 3, v * 3), ridge = 0.5 + 0.5 * Math.cos(fv * Math.PI * 6), grain = vnoise(u * 40, v * 40);
    let lum = 0.72 + 0.34 * ridge + (grain - 0.5) * 0.22 + (mid - 0.5) * 0.12, r = 96, g = 66, b = 42;
    if (s.watered) { lum *= 0.58; r -= 10; b += 6; }
    out[0] = r * lum; out[1] = g * lum; out[2] = b * lum; out[3] = 255 * (ridge * 0.8 + grain * 0.2);
    return true;
  }

  // noise periodik 128x128 (rata-rata 0.5) agar bisa diulang tanpa sambungan
  function detailCanvas() {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), img = x.createImageData(N, N);
    const pn = (u, v, P) => {
      const xi = Math.floor(u), yi = Math.floor(v), xf = u - xi, yf = v - yi, w = k => ((k % P) + P) % P;
      const a = h2(w(xi), w(yi), P), b = h2(w(xi + 1), w(yi), P), cc = h2(w(xi), w(yi + 1), P), d = h2(w(xi + 1), w(yi + 1), P);
      const s1 = xf * xf * (3 - 2 * xf), s2 = yf * yf * (3 - 2 * yf);
      return a + (b - a) * s1 + (cc - a) * s2 + (a - b - cc + d) * s1 * s2;
    };
    for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) {
      const n = pn(i / 16, y / 16, 8) * 0.45 + pn(i / 8, y / 8, 16) * 0.35 + pn(i / 4, y / 4, 32) * 0.2;
      const val = 255 * clamp(0.5 + (n - 0.5) * 0.7, 0, 1), o = (y * N + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = val; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  function makeGround(renderer, lite, hd) {
    const PX = hd ? 48 : lite ? 14 : 32, W = MW * PX, H = MH * PX;   // HD: tekstur tanah lebih detail
    const cc = document.createElement('canvas'), bc = document.createElement('canvas');
    cc.width = bc.width = W; cc.height = bc.height = H;
    const cx = cc.getContext('2d'), bxc = bc.getContext('2d');
    const out = [0, 0, 0, 0];
    // lapisan dasar dihitung bertahap di latar belakang (sejak layar judul) agar mulai main tanpa jeda
    const base = {col: new Uint8ClampedArray(W * H * 4), hgt: new Uint8ClampedArray(W * H * 4), row: 0, grid: newGame().ground, key: ''};
    base.key = base.grid.join('|');
    const baseRows = n => {
      for (let k = 0; k < n && base.row < H; k++, base.row++) {
        const y = base.row;
        for (let x = 0; x < W; x++) {
          shadeBase((x + 0.5) / PX, (y + 0.5) / PX, base.grid, out);
          const o = (y * W + x) * 4;
          base.col[o] = out[0]; base.col[o + 1] = out[1]; base.col[o + 2] = out[2]; base.col[o + 3] = 255;
          base.hgt[o] = base.hgt[o + 1] = base.hgt[o + 2] = out[3]; base.hgt[o + 3] = 255;
        }
      }
    };
    (function step() { if (base.row < H) { baseRows(lite ? 8 : 12); setTimeout(step, 0); } })();
    // satu petak: bedeng bila dicangkul, selain itu salin dari lapisan dasar
    const paint = (tx, ty) => {
      const ci = cx.createImageData(PX, PX), bi = bxc.createImageData(PX, PX), s = S.soil[ty][tx];
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        const o = (y * PX + x) * 4;
        if (s && shadeSoil(tx + (x + 0.5) / PX, ty + (y + 0.5) / PX, s, out)) {
          ci.data[o] = out[0]; ci.data[o + 1] = out[1]; ci.data[o + 2] = out[2]; bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = out[3];
        } else {
          const b = ((ty * PX + y) * W + tx * PX + x) * 4;
          ci.data[o] = base.col[b]; ci.data[o + 1] = base.col[b + 1]; ci.data[o + 2] = base.col[b + 2]; bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = base.hgt[b];
        }
        ci.data[o + 3] = bi.data[o + 3] = 255;
      }
      cx.putImageData(ci, tx * PX, ty * PX); bxc.putImageData(bi, tx * PX, ty * PX);
    };
    const gl2 = renderer.capabilities.isWebGL2;
    const tex = (c, srgb) => {
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (!gl2) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }   // WebGL1: tekstur non-pangkat-2
      return t;
    };
    const map = tex(cc, true), bump = tex(bc, false);
    const material = new THREE.MeshStandardMaterial(ceria ? {map, bumpMap: bump, bumpScale: 0.025, roughness: 0.95, metalness: 0, envMapIntensity: 0.3}
      : toon ? {map, roughness: 1, metalness: 0}
      : {map, bumpMap: bump, bumpScale: 0.035, roughness: 0.95, metalness: 0, envMapIntensity: 0.4});
    // tekstur detail kecil yang diulang 4x per petak, dikalikan ke warna → tajam dari dekat
    const detail = new THREE.CanvasTexture(detailCanvas());
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
    detail.anisotropy = renderer.capabilities.getMaxAnisotropy();
    material.onBeforeCompile = sh => {
      sh.uniforms.uDetail = {value: detail};
      sh.fragmentShader = 'uniform sampler2D uDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
        vec3 dt = texture2D(uDetail, vUv * vec2(${MW * 4}.0, ${MH * 4}.0)).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), dt * 2.0, ${ceria ? '0.35' : toon ? '0.25' : '0.0'});`);
    };
    return {
      material,
      repaint(list) { for (const [tx, ty] of list) paint(tx, ty); map.needsUpdate = bump.needsUpdate = true; },
      // jenis tanah berubah di beberapa petak (pemain mengecat ladang/jalan): hitung ulang lapisan dasar petak itu + tetangganya saja
      repaintGround(list) {
        base.grid = S.ground; base.key = base.grid.join('|');
        const seen = new Set();
        for (const [tx, ty] of list) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x0 = tx + dx, y0 = ty + dy, k = x0 + ',' + y0;
          if (x0 < 0 || y0 < 0 || x0 >= MW || y0 >= MH || seen.has(k)) continue;
          seen.add(k);
          for (let y = y0 * PX; y < (y0 + 1) * PX; y++) for (let x = x0 * PX; x < (x0 + 1) * PX; x++) {
            shadeBase((x + 0.5) / PX, (y + 0.5) / PX, base.grid, out);
            const o = (y * W + x) * 4;
            base.col[o] = out[0]; base.col[o + 1] = out[1]; base.col[o + 2] = out[2];
            base.hgt[o] = base.hgt[o + 1] = base.hgt[o + 2] = out[3];
          }
          paint(x0, y0);
        }
        map.needsUpdate = bump.needsUpdate = true;
      },
      repaintAll() {
        // simpanan dengan peta tanah lain (seharusnya tidak terjadi): hitung ulang lapisan dasar
        if (S.ground.join('|') !== base.key) { base.grid = S.ground; base.key = base.grid.join('|'); base.row = 0; }
        baseRows(H);
        cx.putImageData(new ImageData(base.col, W, H), 0, 0);
        bxc.putImageData(new ImageData(base.hgt, W, H), 0, 0);
        for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (S.soil[ty][tx]) paint(tx, ty);
        map.needsUpdate = bump.needsUpdate = true;
      },
    };
  }

  /* ---------- rumput instansi yang tertiup angin ---------- */
  const wind = {value: 0};
  function windMaterial(opts) {
    const m = new THREE.MeshStandardMaterial(Object.assign({vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, envMapIntensity: 0.4}, opts));
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = wind;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(modelMatrix[3][0], 0.0, modelMatrix[3][2]);
        #endif
        float sway = sin(uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5) * 0.6 + sin(uTime * 2.9 + ip.x * 1.9 - ip.z * 1.3) * 0.25;
        transformed.x += sway * position.y * position.y * 0.35;
        transformed.z += sway * position.y * position.y * 0.12;`);
      // helai dua sisi: jangan balik normal untuk sisi belakang (agar tidak tampak gelap)
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 geometryNormal = normal;');
    };
    return m;
  }
  let bladeGeo = null;
  function blade() {
    if (bladeGeo) return bladeGeo;
    // helai 1 unit tinggi, meruncing; normal menghadap atas supaya menyatu dengan cahaya tanah
    const pos = [], col = [], nor = [], seg = 3, base = lin(ceria ? '#5a9a2c' : toon ? '#3f9a2a' : '#2c4a1a'), tip = lin(ceria ? '#b4dc6a' : toon ? '#a8e65a' : '#9cc45a');
    const at = i => { const t = i / seg, w = 0.5 * (1 - t * 0.85); return [[-w, t], [w, t]]; };
    for (let i = 0; i < seg; i++) {
      const [a, b] = at(i), [c, d] = at(i + 1);
      for (const [x, y] of [a, b, c, b, d, c]) { pos.push(x, y, 0); nor.push(0, 1, 0); const k = base.clone().lerp(tip, y); col.push(k.r, k.g, k.b); }
    }
    const [c, d] = at(seg);
    for (const [x, y] of [c, d, [0, 1.08]]) { pos.push(x, y, 0); nor.push(0, 1, 0); col.push(tip.r, tip.g, tip.b); }
    bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bladeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    bladeGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return bladeGeo;
  }
  const grassMat = () => grassMat.m || (grassMat.m = windMaterial());
  function makeGrass(lite) {
    // kumpulan rumput 1,5× kepadatan "Tinggi" (42/petak); level grafik memakai sebagian (mesh.count)
    const per = ceria ? (lite ? 6 : 14) : toon ? (lite ? 3 : 6) : (lite ? 18 : 63), spots = [];   // kartun: hanya rumpun kecil
    for (let ty = 1; ty < MH - 1; ty++) for (let tx = 1; tx < MW - 1; tx++) {
      if (S.ground[ty][tx] !== 'grass' || SOLID.has(S.obj[ty][tx]) || tileLocked(tx, ty)) continue;   // tidak tembus bangunan/palung; hutan terkunci tanpa rumput
      if (S.obj[ty][tx] === 'flower') { const d = decoAt(tx, ty); if (d && (d.kind === 'jalanbatu' || d.kind === 'jalantunggul')) continue; }   // pijakan: tanpa rumput menembus
      if ((tx === 24 || tx === 29) && (ty === 3 || ty === 7)) continue;   // sudut kolam tertutup air
      for (let i = 0; i < per; i++) spots.push([tx + h2(tx, ty, i * 2 + 100), ty + h2(tx, ty, i * 2 + 101), h2(tx, ty, i + 300)]);
    }
    // acak urutan (deterministik) supaya mengurangi mesh.count menipiskan rumput merata, bukan memotong baris
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(h2(i, 17, 23) * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    const mesh = new THREE.InstancedMesh(blade(), grassMat(), spots.length);
    mesh.userData.total = spots.length;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    spots.forEach(([x, z, r], i) => {
      q.setFromAxisAngle(up, r * Math.PI * 2);
      sc.set(0.05 + r * 0.04, 0.16 + h2(i, 7, 9) * 0.26, 1);
      m.compose(p.set(x, 0, z), q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setScalar(0.75 + h2(i, 3, 5) * 0.5));
    });
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }
  function weedTuft(seed) {
    const n = 22, mesh = new THREE.InstancedMesh(blade(), grassMat(), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = h2(seed, i, 1) * Math.PI * 2, r = h2(seed, i, 2) * 0.28;
      q.setFromEuler(e.set((h2(seed, i, 3) - 0.5) * 0.6, a, (h2(seed, i, 4) - 0.5) * 0.6));
      m.compose(p.set(Math.cos(a) * r, 0, Math.sin(a) * r), q, sc.set(0.07, 0.3 + h2(seed, i, 5) * 0.35, 1));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setRGB(0.55, 0.75, 0.45));
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  /* ---------- daun & batu organik ---------- */
  const blobs = {};
  // bulatan bergelombang (tajuk pohon, semak, daun tanaman) dengan normal halus
  function blobGeo(seed, detail = 2, amp = 0.18, smoothN = true) {
    const key = seed + '_' + detail + '_' + amp + smoothN;
    if (blobs[key]) return blobs[key];
    const g = new THREE.IcosahedronGeometry(0.5, detail), P = g.attributes.position, v = new THREE.Vector3(), col = [];
    const nor = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const dir = v.clone().normalize();
      const n = vnoise(v.x * 3 + seed * 7 + v.z * 2.1, v.y * 3 + v.z * 1.3 + seed * 3);
      v.multiplyScalar(1 + (n - 0.5) * amp * 2);
      P.setXYZ(i, v.x, v.y, v.z);
      dir.toArray(nor, i * 3);
      const k = clamp(0.6 + 0.4 * (v.y + 0.5) + (n - 0.5) * 0.25, 0.35, 1.1);
      col.push(k, k, k);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (smoothN) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else g.computeVertexNormals();
    return (blobs[key] = g);
  }

  /* ---------- penggabungan geometri (lebih sedikit draw call) ---------- */
  // parts: [{geo, color, m: Matrix4}] → satu geometri non-indeks dengan warna per titik
  function mergeParts(parts) {
    const pos = [], nor = [], col = [], v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, c = lin(p.color);
      nm.getNormalMatrix(p.m);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos.push(v.x, v.y, v.z);
        n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z);
        const k = C ? C.getX(i) : 1; col.push(c.r * k, c.g * k, c.b * k);
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const M4 = (x, y, z, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  // angin pada pohon: pangkal batang diam, makin tinggi makin bergoyang; daun bergetar halus.
  // Dipakai untuk bahan warna & bahan bayangan agar bayangan ikut bergoyang.
  const TREE_SWAY = `#include <begin_vertex>
    #ifdef USE_INSTANCING
      vec3 tp = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
    #else
      vec3 tp = vec3(0.0);
    #endif
    float gust = 0.65 + 0.35 * sin(uTime * 0.35 + tp.x * 0.05);
    float sw = (sin(uTime * 1.1 + tp.x * 0.35 + tp.z * 0.27) * 0.6 + sin(uTime * 2.3 + tp.x * 0.9) * 0.25) * gust;
    float hh = max(0.0, position.y - 0.25);
    transformed.x += sw * hh * hh * 0.05;
    transformed.z += sw * hh * hh * 0.025;
    float leafy = smoothstep(0.75, 1.15, position.y);
    transformed += normal * sin(uTime * 7.0 + position.x * 9.0 + position.y * 7.0 + tp.x) * 0.012 * leafy;`;
  const addTreeSway = m => { m.onBeforeCompile = sh => { sh.uniforms.uTime = wind; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', TREE_SWAY); }; return m; };
  const treeMat = () => treeMat.m || (treeMat.m = addTreeSway(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.5})));
  const treeDepth = () => treeDepth.m || (treeDepth.m = addTreeSway(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking})));

  // semua pohon & semak tepi selatan: 4 varian pohon + 2 varian semak sebagai InstancedMesh
  function makeTrees() {
    const trunk = new THREE.CylinderGeometry(0.07, 0.13, 1, 7), greens = toon ? ['#46a834', '#58bf3e', '#3d962e'] : ['#355f24', '#3f6e2a', '#4a7a30'];
    // pohon: batang meruncing + 2 cabang + 9 gerombol daun membentuk kubah (dalam lebih gelap, luar lebih terang)
    const branch = new THREE.CylinderGeometry(0.025, 0.05, 1, 6).translate(0, 0.5, 0);
    const leafTones0 = toon ? ['#3d962e', '#46a834', '#58bf3e', '#6acb4a'] : ['#2c5220', '#355f24', '#3f6e2a', '#4f7f34'];
    // gaya ceria: cemara bertingkat (kerucut bertumpuk) dan pohon gugur warna-warni
    const coneG = new THREE.ConeGeometry(0.5, 1, 9);
    const pineGeo = i => hayPineGeo(i);
    const AUTUMN = {
      orange: ['#b4521e', '#de7a2a', '#e98e33', '#f2a03d'],
      yellow: ['#c99418', '#dfb224', '#efc83a', '#f7dc62'],
      red:    ['#8e1f22', '#c2302e', '#d4433b', '#e5574c'],
      green:  ['#3c6f24', '#4c862c', '#649f37', '#84b947'],   // ek hijau rindang (gelap di bawah, terang di puncak)
    };
    // ceria: tajuk bulat penuh dari banyak gumpalan bertumpuk (bawah gelap, puncak terang), batang lebih tebal
    const fluffyGeo = (i, tones) => {
      const parts = [{geo: trunk, color: '#5e4330', m: M4(0, 0.5, 0, 1.35, 1.0, 1.35)}];
      for (const [a, tl] of [[i * 1.7, 0.6], [i * 1.7 + 3.1, 0.55]])   // batang bercabang seperti desain
        parts.push({geo: branch, color: '#5e4330', m: new THREE.Matrix4().compose(new THREE.Vector3(0, 0.75, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tl, 0, Math.cos(a) * tl)), new THREE.Vector3(1.6, 0.75, 1.6))});
      parts.push({geo: blobGeo(i % 4, 2, 0.2), color: tones[0], m: M4(0, 1.4, 0, 1.25, 1.0, 1.25)});
      const ring = (n, r, y, sz, tone, off) => { for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + i * 0.9 + off, s2 = sz * (0.85 + h2(i, k + off * 10, 9) * 0.3);
        parts.push({geo: blobGeo((i + k) % 5, 2, 0.24), color: tones[tone], m: M4(Math.cos(a) * r, y + h2(i, k, 4) * 0.1, Math.sin(a) * r, s2, s2 * 0.85, s2)});
      } };
      ring(7, 0.5, 1.15, 0.62, 1, 0); ring(6, 0.38, 1.55, 0.6, 2, 0.4); ring(3, 0.18, 1.88, 0.55, 3, 0.9);
      parts.push({geo: blobGeo((i + 3) % 5, 2, 0.2), color: tones[3], m: M4(0, 2.05, 0, 0.55, 0.45, 0.55)});
      return mergeParts(parts);
    };
    const treeGeo = (i, tonesOverride) => {
      const leafTones = tonesOverride || leafTones0, bark = toon ? '#8a5a32' : '#5b3e28';
      const parts = [{geo: trunk, color: bark, m: M4(0, 0.55, 0, 1.05, 1.1, 1.05)}];
      for (const [a, tilt] of [[i * 1.3, 0.75], [i * 1.3 + 2.6, 0.6]]) {
        const br = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.8, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, Math.cos(a) * tilt)), new THREE.Vector3(1, 0.7, 1));
        parts.push({geo: branch, color: bark, m: br});
      }
      parts.push({geo: blobGeo(i % 4, 2, 0.24), color: leafTones[0], m: M4(0, 1.45, 0, 1.0, 0.85, 1.0)});   // inti tajuk (gelap)
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + i * 0.7, ring = k % 2 ? 0.42 : 0.3, up = k % 2 ? 1.32 : 1.68;
        const sz = 0.55 + h2(i, k, 9) * 0.25;
        parts.push({geo: blobGeo((i + k) % 5, 2, 0.28), color: leafTones[1 + (k % 3)],
          m: M4(Math.cos(a) * ring, up + h2(i, k, 4) * 0.12, Math.sin(a) * ring, sz, sz * 0.85, sz)});
      }
      parts.push({geo: blobGeo((i + 2) % 5, 2, 0.26), color: leafTones[3], m: M4(0.05, 1.95, -0.03, 0.6, 0.5, 0.6)});   // pucuk terang
      return mergeParts(parts);
    };
    const bushGeo = i => {
      const parts = [
        {geo: blobGeo(i % 4, 2, 0.22), color: ceria ? '#4f8a2e' : '#3a6b28', m: M4(0, 0.32, 0, 1.2, 0.65, 1.05)},
        {geo: blobGeo((i + 1) % 4, 2, 0.22), color: ceria ? '#6aa83e' : '#4a7d30', m: M4(0.12 * (i - 0.5), 0.55, 0.05, 0.7, 0.45, 0.7)},
      ];
      if (ceria) {   // semak bunga: bunga kuning bertengah jingga tersebar di permukaan
        const fl = new THREE.IcosahedronGeometry(0.5, 0);
        for (let k = 0; k < 12; k++) {
          const a = k * 2.39 + i, up = 0.3 + (k % 4) * 0.09, rr = 0.55 - (k % 4) * 0.1;
          parts.push({geo: fl, color: '#f6c433', m: M4(Math.cos(a) * rr, up + 0.12, Math.sin(a) * rr * 0.88, 0.1, 0.06, 0.1)});
        }
      }
      return mergeParts(parts);
    };
    const kinds = ceria
      // ceria: 0–2 cemara, 3 oranye, 4 kuning, 5 merah, 6 hijau, 7–8 semak
      ? [0, 1, 2].map(i => ({geo: pineGeo(i), list: []}))
          .concat(['orange', 'yellow', 'red', 'green'].map((k, i) => ({geo: fluffyGeo(i, AUTUMN[k]), list: []})))
          .concat([0, 1].map(i => ({geo: bushGeo(i), list: []})))
      : [0, 1, 2, 3].map(i => ({geo: treeGeo(i), list: []})).concat([0, 1].map(i => ({geo: bushGeo(i), list: []})));
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      if (S.obj[ty][tx] !== 'tree') continue;
      const bush = ty === MH - 1, v = h2(tx, ty, 3);
      if (ceria) {
        const r = h2(tx, ty, 41);   // ±35% cemara, ±37% ek hijau, sisanya pohon gugur warna-warni
        kinds[bush ? 7 + (tx % 2) : r < 0.35 ? Math.floor(r / 0.117) : r < 0.72 ? 6 : r < 0.84 ? 3 : r < 0.94 ? 4 : 5].list.push([tx, ty, v, bush]);
      } else kinds[bush ? 4 + (tx % 2) : (tx + ty) % 4].list.push([tx, ty, v, bush]);
    }
    // hutan dipecah per blok 8×8 petak agar blok di luar layar tidak digambar (tampilan tetap sama, GPU jauh lebih ringan).
    // Tiap blok memakai atribut geometri yang sama (tanpa salinan memori) dengan bola batas seluas bloknya.
    const CH = 8, R = CH * 0.75 + 1.6;
    const G = new THREE.Group(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const chunkGeo = (base, cx, cz) => {
      const g = new THREE.BufferGeometry();
      for (const n in base.attributes) g.setAttribute(n, base.attributes[n]);
      if (base.index) g.setIndex(base.index);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 1.2, cz), R);
      return g;
    };
    for (const k of kinds) {
      const chunks = new Map();
      for (const it of k.list) { const key = Math.floor(it[0] / CH) + ',' + Math.floor(it[1] / CH); (chunks.get(key) || chunks.set(key, []).get(key)).push(it); }
      for (const [key, list] of chunks) {
        const [bx, bz] = key.split(',').map(Number);
        const mesh = new THREE.InstancedMesh(chunkGeo(k.geo, bx * CH + CH / 2, bz * CH + CH / 2), treeMat(), list.length);
        mesh.customDepthMaterial = treeDepth();   // bayangan ikut bergoyang
        list.forEach(([tx, ty, v, bush], i) => {
          q.setFromAxisAngle(up, v * 6);
          mesh.setMatrixAt(i, m.compose(p.set(tx + 0.5, 0, ty + 0.5), q, sc.setScalar(bush ? 1 : 0.85 + v * 0.35)));
        });
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = true;   // r128 mematikannya untuk InstancedMesh; bola batas blok sudah benar
        G.add(mesh);
      }
    }
    G.userData.dispose = () => { for (const k of kinds) k.geo.dispose(); G.children.forEach(c => { if (c.geometry) c.geometry.dispose(); c.dispose(); }); };
    return G;
  }

  /* ---------- gaya ceria: rumpun bunga di tepi jalan (pink, putih, ungu), ikut bergoyang ---------- */
  function makeFlowers() {
    const G = new THREE.Group();
    if (!ceria) return G;
    const ico = new THREE.IcosahedronGeometry(0.5, 0);
    const clump = petal => mergeParts([
      {geo: ico, color: '#3f9a36', m: M4(0, 0.07, 0, 0.42, 0.16, 0.42)},
      ...[[0.1, 0.02], [-0.09, 0.07], [0.02, -0.1], [-0.05, -0.04], [0.08, 0.1]].map(([x, z], k) =>
        ({geo: ico, color: k === 3 ? '#ffd84a' : petal, m: M4(x, 0.17 + (k % 2) * 0.04, z, 0.12, 0.09, 0.12)})),
    ]);
    const kinds = ['#ff8fc8', '#fffaf2', '#c79bff'].map(c => ({geo: clump(c), list: []}));
    const isPath = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && S.ground[y][x] === 'path';
    for (let ty = 1; ty < MH - 1; ty++) for (let tx = 1; tx < MW - 1; tx++) {
      if (S.ground[ty][tx] !== 'grass' || S.obj[ty][tx] || S.soil[ty][tx] || tileLocked(tx, ty) || structAtTile(tx, ty)) continue;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isPath(tx + dx, ty + dy));
      if (!dirs.length || h2(tx, ty, 61) > 0.75) continue;
      for (const [dx, dy] of dirs) for (let k = 0; k < 2; k++) {   // dua rumpun berjajar di sisi yang berbatasan dengan jalan
        const along = (k + 0.5) / 2 + (h2(tx, ty, 70 + k) - 0.5) * 0.2;
        const x = dx ? tx + (dx > 0 ? 0.85 : 0.15) : tx + along, z = dy ? ty + (dy > 0 ? 0.85 : 0.15) : ty + along;
        kinds[Math.floor(h2(tx + dx, ty + dy, 80 + k) * 3)].list.push([x, z, h2(tx, ty, 90 + k)]);
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const k of kinds) {
      if (!k.list.length) continue;
      const mesh = new THREE.InstancedMesh(k.geo, treeMat(), k.list.length);
      k.list.forEach(([x, z, r], i) => { q.setFromAxisAngle(up, r * 6.28); mesh.setMatrixAt(i, m.compose(p.set(x, 0, z), q, sc.setScalar(0.9 + r * 0.5))); });
      mesh.castShadow = false; mesh.receiveShadow = true;
      G.add(mesh);
    }
    G.userData.dispose = () => { for (const k of kinds) k.geo.dispose(); G.children.forEach(c => { if (c.geometry) c.geometry.dispose(); c.dispose(); }); };
    return G;
  }

  /* ---------- batu & tunggul realistis (geometri berwarna per titik, dicache) ---------- */
  const _col = new THREE.Color();
  const pushCol = (arr, hex, k = 1) => { _col.set(hex).convertSRGBToLinear(); arr.push(_col.r * k, _col.g * k, _col.b * k); };
  const ROCKS = {};
  // batu tak beraturan: noise berlapis, dasar rata, bintik abu-cokelat, lumut di bagian atas
  function rockGeo(seed) {
    if (ROCKS[seed]) return ROCKS[seed];
    const g = new THREE.IcosahedronGeometry(0.5, 3), P = g.attributes.position, v = new THREE.Vector3(), col = [];
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const n = fbm(v.x * 2.2 + seed * 3.1 + v.z * 1.3, v.y * 2.2 + v.z * 1.9 + seed, 4);
      v.multiplyScalar(0.78 + n * 0.45);
      if (v.y < -0.12) v.y = -0.12 + (v.y + 0.12) * 0.15;   // dasar rata menempel tanah
      P.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const speck = vnoise(v.x * 18 + seed, v.z * 18 + v.y * 9), up = N.getY(i);
      const moss = up > 0.55 && vnoise(v.x * 5 + seed * 2, v.z * 5) > 0.5;
      const base = speck > 0.62 ? '#a39c90' : speck < 0.3 ? '#6f6b64' : '#8a857c';
      pushCol(col, moss ? '#5f7a3a' : base, 0.75 + (v.y + 0.2) * 0.5);   // bawah lebih gelap
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return (ROCKS[seed] = g);
  }
  // tunggul: kulit kayu bergurat, lingkaran tahun di atas, akar menjalar
  let STUMP = null;
  function stumpGeo() {
    if (STUMP) return STUMP;
    const parts = [];
    const bark = new THREE.CylinderGeometry(0.22, 0.29, 0.34, 20, 3, true).toNonIndexed(), bc = [], bp = bark.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i);
      const a = Math.atan2(v.z, v.x), groove = 0.5 + 0.5 * Math.sin(a * 22 + vnoise(v.y * 6, a * 3) * 4);
      const r = 1 + (groove - 0.5) * 0.06; bp.setXYZ(i, v.x * r, v.y, v.z * r);
      pushCol(bc, groove > 0.6 ? '#6b4a2e' : '#4e3420', 0.85 + (v.y + 0.17) * 0.6);
    }
    bark.computeVertexNormals(); bark.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); bark.translate(0, 0.17, 0);
    parts.push({geo: bark, color: '#ffffff', m: new THREE.Matrix4()});
    const top = new THREE.CircleGeometry(0.23, 28).rotateX(-Math.PI / 2).toNonIndexed(), tc = [], tp = top.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i);
      const d = Math.hypot(v.x, v.z), ring = 0.5 + 0.5 * Math.sin(d * 120 + vnoise(v.x * 8, v.z * 8) * 2);
      pushCol(tc, d > 0.2 ? '#5a3c24' : ring > 0.55 ? '#d2aa74' : '#b48850');
    }
    top.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); top.translate(0, 0.34, 0);
    parts.push({geo: top, color: '#ffffff', m: new THREE.Matrix4()});
    const root = new THREE.CylinderGeometry(0.02, 0.07, 1, 7).translate(0, 0.5, 0);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + 0.3;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25)), new THREE.Vector3(1, 0.3, 1));
      parts.push({geo: root, color: '#4e3420', m});
    }
    return (STUMP = mergeParts(parts));
  }

  /* ---------- tekstur kayu & genteng ---------- */
  function canvasTex(w, h, draw, renderer) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function planks(renderer) {
    return canvasTex(128, 128, (x, w, h) => {
      for (let i = 0; i < 8; i++) {
        const l = 215 + Math.floor(h2(i, 1, 9) * 35);
        x.fillStyle = `rgb(${l},${l - 6},${l - 14})`; x.fillRect(i * 16, 0, 16, h);
        for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(90,60,30,.12)'; x.fillRect(i * 16 + 2 + Math.floor(h2(i, k, 3) * 12), 0, 1, h); }
        x.fillStyle = 'rgba(40,25,10,.55)'; x.fillRect(i * 16, 0, 1, h);
      }
    }, renderer);
  }
  function shingles(renderer) {
    return canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#d8d0c8'; x.fillRect(0, 0, w, h);
      for (let row = 0; row < 4; row++) for (let i = -1; i < 7; i++) {
        const ox = i * 20 + (row % 2) * 10, oy = row * 32, l = 200 + Math.floor(h2(i, row, 4) * 50);
        x.fillStyle = `rgb(${l},${l},${l})`; x.fillRect(ox + 1, oy, 18, 30);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(ox + 1, oy + 26, 18, 4);
      }
    }, renderer);
  }

  /* ---------- air kolam ---------- */
  function makeWater() {
    const s = new THREE.Shape(), x0 = 24, x1 = 30, z0 = 3, z1 = 8, r = 0.9;
    // bentuk dibuat di bidang XY dengan y = -z, lalu diputar rata ke tanah
    s.moveTo(x0 + r, -z0); s.lineTo(x1 - r, -z0); s.quadraticCurveTo(x1, -z0, x1, -z0 - r);
    s.lineTo(x1, -z1 + r); s.quadraticCurveTo(x1, -z1, x1 - r, -z1); s.lineTo(x0 + r, -z1);
    s.quadraticCurveTo(x0, -z1, x0, -z1 + r); s.lineTo(x0, -z0 - r); s.quadraticCurveTo(x0, -z0, x0 + r, -z0);
    const g = new THREE.ShapeGeometry(s, 12); g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({color: lin(toon ? '#38bde6' : '#1f5566'), roughness: toon ? 0.18 : 0.06, metalness: 0.1, transparent: true, opacity: toon ? 0.93 : 0.9, envMapIntensity: 1.3});
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = wind;
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 wp = vWPos.xz; float t = uTime;
        vec3 wn = normalize(vec3(
          sin(wp.x * 2.3 + t * 1.1) * 0.06 + sin(wp.y * 4.7 - t * 1.6 + wp.x) * 0.04 + sin((wp.x - wp.y) * 9.0 + t * 2.3) * 0.015,
          1.0,
          cos(wp.y * 2.9 + t * 0.9) * 0.06 + sin(wp.x * 5.1 + t * 1.9) * 0.03 + cos((wp.x + wp.y) * 8.0 - t * 2.0) * 0.015));
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`);
    };
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = 0.035; mesh.receiveShadow = true;
    const G = new THREE.Group(); G.add(mesh);
    // batu di tepi kolam
    // batu di tepi kolam digabung jadi satu mesh (satu draw call)
    const per = (x1 - x0 + z1 - z0) * 2, pts = s.getSpacedPoints(Math.round(per * 2.2)), rocks = [];
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    pts.forEach((pt, i) => {
      const sz = 0.18 + h2(i, 2, 3) * 0.2;
      q.setFromAxisAngle(up, h2(i, 5, 1) * 6);
      rocks.push({geo: blobGeo(i % 5, 1, 0.3, false), color: '#8b8a82',
        m: new THREE.Matrix4().compose(new THREE.Vector3(pt.x, sz * 0.25, -pt.y), q, new THREE.Vector3(sz * 1.3, sz * 0.7, sz))});
    });
    const rim = new THREE.Mesh(mergeParts(rocks), new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.4}));
    rim.receiveShadow = true;
    G.add(rim);
    return G;
  }

  /* ---------- langit, matahari, cahaya lingkungan ---------- */
  // elevasi matahari dari jam game: terbit 06:00, terbenam ±19:00 (tetap jalan tanpa Sky.js)
  const sunDir = new THREE.Vector3();
  function sunFromTime(time) {
    const day = (time - 360) / 780;
    const elev = time <= 1140 ? Math.sin(Math.PI * clamp(day, 0, 1)) * 62 : -(time - 1140) / 300 * 25;
    const az = Math.PI * clamp(day, 0, 1), e = THREE.MathUtils.degToRad(elev);
    sunDir.set(Math.cos(az) * Math.cos(e), Math.sin(e), 0.55 * Math.cos(e)).normalize();
    return {dir: sunDir, elev};
  }
  function makeSky(renderer, scene) {
    if (toon || !THREE.Sky) return null;   // kartun: langit warna polos cerah
    const sky = new THREE.Sky(); sky.scale.setScalar(300); scene.add(sky);
    const envSky = new THREE.Sky(); envSky.scale.setScalar(300);
    const envScene = new THREE.Scene(); envScene.add(envSky);
    const pmrem = new THREE.PMREMGenerator(renderer);
    let rt = null, lastKey = '';
    return {
      sky,
      update(time, weather) {
        const {dir, elev} = sunFromTime(time);
        const overcast = weather !== 'cerah';
        for (const s of [sky, envSky]) {
          const u = s.material.uniforms;
          u.sunPosition.value.copy(dir);
          u.turbidity.value = overcast ? 14 : 5;
          u.rayleigh.value = overcast ? 3.5 : 1.4;
          u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.85;
        }
        // perbarui peta cahaya lingkungan hanya bila matahari bergeser cukup jauh
        const key = Math.round(elev / 3) + weather;
        if (key !== lastKey) {
          lastKey = key;
          const old = rt; rt = pmrem.fromScene(envScene, 0.04);
          scene.environment = rt.texture;
          if (old) old.dispose();
        }
        return {dir, elev};
      },
    };
  }

  // cemara (aset desain "Pohon Cemara"): 4 tingkat kerucut cekung bertumpuk, tepi bawah bergelombang membulat
  // dan menjuntai; hijau cerah di atas, lebih gelap di gelombang bawah; batang cokelat tebal; buah pinus kecil
  const PINES = {};
  function scallopGeo(lobes, seed) {
    const seg = lobes * 4, g = new THREE.ConeGeometry(1, 1, seg, 4, true), P = g.attributes.position, col = [];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z), t = 0.5 - y;   // t: 0 pucuk … 1 dasar
      let k = 1.3 - t * 0.45;
      if (r > 1e-4) {
        const ang = Math.atan2(z, x) + seed, wave = 0.5 + 0.5 * Math.cos(ang * lobes);
        const flare = Math.pow(t, 1.35);                       // sisi cekung, melebar di bawah
        const rr = flare * (t > 0.99 ? 1 + 0.05 * wave : 1), drop = t > 0.99 ? -0.16 * wave : 0;
        P.setXYZ(i, x / r * rr, y + drop, z / r * rr);
        if (t > 0.99) k = 0.62 + 0.18 * (1 - wave);
      }
      col.push(k, k, k);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  function hayPineGeo(i) {
    const key = i % 3;
    if (PINES[key]) return PINES[key];
    const parts = [{geo: new THREE.CylinderGeometry(0.08, 0.1, 1, 8), color: '#7c5130', m: M4(0, 0.25, 0, 1, 0.5, 1)}];
    // [pucuk, dasar, setengah lebar] tiap tingkat dari bawah ke atas (perbandingan dari desain "Layout Mesin": 6 tingkat ramping)
    const tiers = [[1.93, 0.32, 0.83], [2.21, 0.78, 0.73], [2.49, 1.24, 0.62], [2.73, 1.68, 0.51], [2.95, 2.11, 0.4], [3.2, 2.5, 0.27]];
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    tiers.forEach(([top, bot, hw], k) => {
      const h = top - bot, w = hw * (1 + (h2(key, k, 5) - 0.5) * 0.08);
      q.setFromAxisAngle(up, k * 0.9 + key * 1.3);
      parts.push({geo: scallopGeo(7 - Math.min(k, 3), key + k), color: '#4a7d35', m: new THREE.Matrix4().compose(p.set(0, bot + h / 2, 0), q, sc.set(w, h, w))});
    });
    return (PINES[key] = mergeParts(parts));
  }
  window.Real3D = {enabled, style, toon, ceria, makeFlowers, hayPineGeo, sunFromTime, rockGeo, stumpGeo, makeTrees, lin, vnoise, makeGround, makeGrass, weedTuft, blobGeo, windMaterial, planks, shingles, makeWater, makeSky, wind};
})();
