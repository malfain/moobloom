'use strict';
/* Tampilan 2D piksel (canvas). */
const cv = $('game');
const g0 = cv.getContext('2d');

function drawCrop(cr, sx, sy) {
  const d = CROPS[cr.type];
  if (cr.dead) {
    r(sx + 7, sy + 6, 2, 8, '#c9a86a'); r(sx + 4, sy + 7, 3, 1); r(sx + 6, sy + 14, 4, 1, '#a08050'); r(sx + 9, sy + 5, 3, 1); r(sx + 5, sy + 10, 2, 1); r(sx + 9, sy + 9, 3, 1);
    return;
  }
  const mature = cr.days >= d.grow;
  const st = mature ? 3 : Math.min(2, Math.floor(cr.days / d.grow * 3));
  if (st === 0) { r(sx + 5, sy + 9, 2, 2, '#e8d08a'); r(sx + 9, sy + 7, 2, 2); r(sx + 8, sy + 11, 2, 2); return; }
  if (st === 1) { r(sx + 7, sy + 8, 2, 5, d.leaf); r(sx + 4, sy + 7, 3, 2); r(sx + 9, sy + 6, 3, 2); return; }
  const tall = cr.type === 'jagung';
  if (st === 2) {
    if (tall) { r(sx + 7, sy - 2, 2, 15, d.leaf); r(sx + 3, sy + 4, 4, 2); r(sx + 9, sy + 1, 4, 2); r(sx + 4, sy + 9, 3, 2); return; }
    r(sx + 7, sy + 5, 2, 9, d.leaf); r(sx + 3, sy + 6, 4, 3); r(sx + 9, sy + 4, 4, 3); r(sx + 4, sy + 10, 3, 2); r(sx + 9, sy + 9, 3, 2);
    r(sx + 4, sy + 6, 2, 1, '#7fd060'); return;
  }
  switch (cr.type) {
    case 'lobak': case 'kentang': case 'wortel': case 'ubi': {
      r(sx + 4, sy + 1, 2, 7, d.leaf); r(sx + 7, sy, 2, 8); r(sx + 10, sy + 1, 2, 7); r(sx + 3, sy + 2, 2, 2); r(sx + 11, sy + 3, 2, 2);
      const big = cr.type === 'lobak' || cr.type === 'kentang';
      r(sx + 4, sy + 7, 8, big ? 7 : 6, d.color); r(sx + 5, sy + 6, 6, 1);
      if (cr.type === 'lobak') r(sx + 4, sy + 7, 8, 2, d.accent);
      if (cr.type === 'wortel') { r(sx + 6, sy + 13, 4, 2, d.color); r(sx + 7, sy + 15, 2, 1); }
      r(sx + 5, sy + 8, 2, 2, 'rgba(255,255,255,.45)');
      break;
    }
    case 'stroberi': case 'tomat': case 'terong': {
      r(sx + 3, sy + 3, 10, 10, d.leaf); r(sx + 2, sy + 5, 12, 6); r(sx + 4, sy + 2, 8, 1, '#7fd060');
      const fr = cr.type === 'terong' ? [[3, 7, 3, 5], [10, 6, 3, 5]] : [[4, 5, 3, 3], [9, 7, 3, 3], [5, 10, 3, 3], [10, 2, 2, 2]];
      for (const [x, y, w, h] of fr) { r(sx + x, sy + y, w, h, d.color); r(sx + x, sy + y, 1, 1, '#ffffffaa'); }
      break;
    }
    case 'jagung':
      r(sx + 7, sy - 8, 2, 21, d.leaf); r(sx + 3, sy + 2, 4, 2); r(sx + 9, sy - 2, 4, 2); r(sx + 4, sy + 8, 3, 2); r(sx + 9, sy + 6, 4, 2);
      r(sx + 9, sy + 1, 3, 6, d.color); r(sx + 9, sy + 1, 3, 1, '#7fbf3a'); r(sx + 10, sy + 2, 1, 4, d.accent);
      r(sx + 7, sy - 10, 2, 2, '#e8c070');
      break;
    case 'semangka':
      r(sx + 2, sy + 4, 3, 2, d.leaf); r(sx + 11, sy + 3, 3, 2);
      r(sx + 3, sy + 6, 10, 8, d.color); r(sx + 2, sy + 8, 12, 4);
      for (const x of [5, 8, 11]) r(sx + x, sy + 6, 1, 8, d.accent);
      r(sx + 4, sy + 7, 2, 1, '#ffffff88');
      break;
  }
}

function drawTree(sx, sy) {
  r(sx + 6, sy + 8, 4, 8, '#7a4a24'); r(sx + 6, sy + 8, 1, 8, '#5a3415');
  r(sx + 1, sy - 10, 14, 16, '#2f7d32'); r(sx - 1, sy - 6, 18, 9); r(sx + 3, sy - 13, 10, 4);
  r(sx + 3, sy - 10, 6, 4, '#47a047'); r(sx + 1, sy - 5, 3, 3); r(sx + 5, sy - 12, 4, 2);
  r(sx + 1, sy + 3, 14, 3, '#246326'); r(sx - 1, sy + 1, 2, 2);
}

function drawObj(o, tx, ty, sx, sy) {
  switch (o) {
    case 'tree': return drawTree(sx, sy);
    case 'rock':
      r(sx + 3, sy + 6, 10, 8, '#8a8f96'); r(sx + 2, sy + 8, 12, 5);
      r(sx + 5, sy + 7, 4, 2, '#b6bcc4'); r(sx + 3, sy + 13, 10, 1, '#5d6268'); r(sx + 10, sy + 9, 2, 1, '#6d7278');
      return;
    case 'stump':
      r(sx + 3, sy + 8, 10, 7, '#7a4e26'); r(sx + 3, sy + 6, 10, 3, '#c79a5e'); r(sx + 5, sy + 7, 6, 1, '#9c6c3a');
      r(sx + 2, sy + 13, 2, 2, '#7a4e26'); r(sx + 12, sy + 13, 2, 2); r(sx + 5, sy + 10, 1, 4, '#5a3415');
      return;
    case 'weed':
      r(sx + 4, sy + 7, 2, 7, '#3e8f2e'); r(sx + 7, sy + 5, 2, 9); r(sx + 10, sy + 8, 2, 6); r(sx + 3, sy + 9, 2, 2); r(sx + 11, sy + 7, 2, 2);
      r(sx + 7, sy + 5, 1, 2, '#6cc04a');
      return;
    case 'bin':
      r(sx + 1, sy + 4, 14, 11, '#9a6634'); r(sx, sy + 2, 16, 4, '#7a4a22'); r(sx + 1, sy + 3, 14, 1, '#b07a42');
      r(sx + 1, sy + 9, 14, 1, '#7a4a22'); r(sx + 1, sy + 14, 14, 1, '#5a3415'); r(sx + 7, sy + 6, 2, 2, '#f6c343');
      return;
    case 'feed':
      r(sx + 1, sy + 8, 14, 6, '#8a5a2b'); r(sx + 2, sy + 9, 12, 2, troughAt(tx, ty) && troughAt(tx, ty).food > 0 ? '#f2d060' : '#4a2a10');
      r(sx + 1, sy + 13, 2, 3, '#5a3415'); r(sx + 13, sy + 13, 2, 3);
      return;
    case 'hay':
      r(sx + 1, sy + 8, 14, 6, '#8a5a2b'); r(sx + 1, sy + 13, 2, 3, '#5a3415'); r(sx + 13, sy + 13, 2, 3);
      if (troughAt(tx, ty) && troughAt(tx, ty).food > 0) { r(sx + 2, sy + 5, 12, 5, '#e8cf6a'); r(sx + 3, sy + 4, 3, 1, '#f4e08a'); r(sx + 9, sy + 4, 4, 1); r(sx + 5, sy + 6, 1, 3, '#c9a94a'); r(sx + 10, sy + 6, 1, 2); }
      else r(sx + 2, sy + 9, 12, 2, '#4a2a10');
      return;
    case 'deco': case 'flower': {
      const d = decoAt(tx, ty);
      if (!d) return;
      if (d.kind === 'pagar' || d.kind === 'pagarputih') {
        const pw = d.kind === 'pagarputih', post = pw ? '#f2eee6' : '#7a5534', rail = pw ? '#fbf8f2' : '#9a7450';
        r(sx + 7, sy + 6, 2, 10, post);
        const is = (x, y) => { const e = decoAt(x, y); return e && e.kind === d.kind; };
        if (is(tx + 1, ty)) { r(sx + 8, sy + 8, 8, 1, rail); r(sx + 8, sy + 11, 8, 1); }
        if (is(tx - 1, ty)) { r(sx, sy + 8, 8, 1, rail); r(sx, sy + 11, 8, 1); }
        if (is(tx, ty + 1)) r(sx + 7, sy + 12, 2, 4, post);
      } else if (d.kind === 'pagarhidup') {
        r(sx, sy + 5, 16, 10, '#3f7a2c'); r(sx + 1, sy + 4, 14, 3, '#5a9a3a');
      } else if (d.kind === 'jalanbatu') {
        [[2, 2], [9, 3], [3, 9], [10, 10]].forEach(([x, y]) => { r(sx + x, sy + y, 5, 4, '#b8b2a6'); r(sx + x, sy + y + 3, 5, 1, '#8f897e'); });
      } else if (d.kind === 'pohonek') {
        r(sx + 7, sy + 8, 3, 8, '#6b4428'); r(sx + 1, sy - 4, 14, 12, '#3c6f24'); r(sx + 3, sy - 6, 10, 4, '#649f37');
      } else if (d.kind === 'cemara') {
        r(sx + 7, sy + 11, 2, 5, '#6b4428'); r(sx + 3, sy + 4, 10, 7, '#2f7d3c'); r(sx + 5, sy - 1, 6, 6, '#378c44'); r(sx + 7, sy - 4, 2, 4, '#42a04e');
      } else if (d.kind === 'orangan') {
        r(sx + 7, sy + 4, 2, 12, '#8a5a32'); r(sx + 3, sy + 6, 10, 2); r(sx + 5, sy + 5, 6, 5, '#c4372a'); r(sx + 6, sy + 1, 4, 4, '#e8d6a8'); r(sx + 4, sy, 8, 2, '#e0b94a');
      } else if (d.kind === 'bunga') {
        r(sx + 2, sy + 10, 12, 4, '#6b4a2e');
        [[3, 7, '#ff6fa8'], [7, 6, '#ffd84a'], [11, 7, '#ffffff'], [5, 9, '#b98cff'], [10, 9, '#ff8a3d']].forEach(([x, y, c]) => { r(sx + x, sy + y + 2, 1, 3, '#4a9a34'); r(sx + x - 1, sy + y, 3, 2, c); });
      } else if (d.kind === 'semak') {
        r(sx + 2, sy + 5, 12, 10, '#3f8a32'); r(sx + 4, sy + 3, 8, 4); r(sx + 4, sy + 5, 4, 2, '#5cb048');
      } else if (d.kind === 'bangku') {
        r(sx + 1, sy + 6, 14, 2, '#7a4a24'); r(sx + 1, sy + 9, 14, 2, '#9a6a3c'); r(sx + 2, sy + 11, 2, 4, '#3a3a3a'); r(sx + 12, sy + 11, 2, 4);
      } else if (d.kind === 'sprinkler') {
        r(sx + 4, sy + 13, 8, 3, '#9a9a94'); r(sx + 7, sy + 7, 2, 7, '#b8bec6'); r(sx + 5, sy + 5, 6, 2, '#2f7fd0'); r(sx + 7, sy + 4, 2, 1, '#d5dbe1');
        r(sx + 2, sy + 6, 1, 1, '#8fd3ff'); r(sx + 13, sy + 6, 1, 1); r(sx + 3, sy + 3, 1, 1); r(sx + 12, sy + 3, 1, 1);
      } else if (d.kind === 'jalantunggul') {   // tanah berpasir + potongan tunggul
        r(sx + 1, sy + 2, 14, 12, '#d9b27a');
        [[2, 3], [9, 2], [5, 8], [11, 9], [2, 11]].forEach(([x, y]) => { r(sx + x, sy + y + 2, 4, 2, '#8a5a35'); r(sx + x, sy + y, 4, 2, '#e3b57e'); r(sx + x + 1, sy + y, 2, 1, '#b9834f'); });
      } else if (d.kind === 'kayukering') {   // batang kayu tumbang berlumut + jamur merah
        r(sx + 1, sy + 7, 13, 6, '#7a5232'); r(sx + 1, sy + 7, 13, 2, '#a9774a'); r(sx + 3, sy + 6, 6, 2, '#6fa03a');
        r(sx + 13, sy + 7, 3, 6, '#d9b07a'); r(sx + 14, sy + 9, 1, 2, '#3a2412');
        r(sx + 4, sy + 13, 1, 2, '#e9dfc8'); r(sx + 3, sy + 12, 3, 1, '#d9473a'); r(sx + 8, sy + 13, 1, 2, '#e9dfc8'); r(sx + 7, sy + 12, 3, 1, '#d9473a');
      } else if (d.kind === 'sumur') {   // sumur batu beratap biru
        r(sx + 3, sy + 9, 10, 6, '#c9c3b6'); r(sx + 3, sy + 12, 10, 1, '#8f897c'); r(sx + 4, sy + 8, 8, 2, '#2f5f73');
        r(sx + 3, sy + 2, 1, 8, '#8a5a35'); r(sx + 12, sy + 2, 1, 8); r(sx + 4, sy + 4, 8, 1, '#8a5a35'); r(sx + 7, sy + 5, 2, 2, '#6e4628');
        r(sx + 1, sy, 14, 2, '#4a6e9c'); r(sx + 3, sy - 2, 10, 2); r(sx + 6, sy - 3, 4, 1, '#36547a');
      } else if (d.kind === 'kolam') {   // kolam kecil berbatu
        r(sx + 1, sy + 4, 14, 10, '#6e8f3e'); r(sx + 2, sy + 5, 12, 8, '#3c8fa6'); r(sx + 3, sy + 6, 5, 1, '#bde9f1');
        r(sx + 9, sy + 8, 3, 2, '#5fa548'); r(sx + 10, sy + 7, 1, 1, '#f7b3c6');
        [[0, 6], [1, 12], [6, 13], [12, 12], [14, 7]].forEach(([x, y]) => r(sx + x, sy + y, 3, 2, '#b9b6ac'));
        r(sx + 2, sy + 1, 1, 5, '#4e7f2a'); r(sx + 2, sy, 1, 2, '#7a4d2d');
      } else if (d.kind === 'sungai') {   // aliran air yang menyambung ke sungai di sebelahnya
        const is = (x, y) => { const e = decoAt(x, y); return e && e.kind === 'sungai'; };
        // tepi rumput gelap hanya di sisi yang tidak menyambung (tanpa garis di sambungan antar petak)
        const segs = [[3, 3, 10, 10]];
        if (is(tx + 1, ty)) segs.push([8, 3, 8, 10]); if (is(tx - 1, ty)) segs.push([0, 3, 8, 10]);
        if (is(tx, ty + 1)) segs.push([3, 8, 10, 8]); if (is(tx, ty - 1)) segs.push([3, 0, 10, 8]);
        segs.forEach(([x, y, w, h]) => r(sx + x, sy + y, w, h, '#5e7f34'));
        segs.forEach(([x, y, w, h]) => r(sx + x + (x === 0 ? 0 : 1), sy + y + (y === 0 ? 0 : 1), w - (x === 0 ? 0 : 1) - (x + w === 16 ? 0 : 1), h - (y === 0 ? 0 : 1) - (y + h === 16 ? 0 : 1), '#5fb0c4'));
        r(sx + 6, sy + 7, 3, 1, '#bde9f1');
      } else if (d.kind === 'lampu') {
        r(sx + 7, sy + 3, 2, 12, '#2e2e2e'); r(sx + 5, sy + 14, 6, 2); r(sx + 5, sy, 6, 4, night() > 0.15 ? '#ffd86b' : '#fff2c0'); r(sx + 5, sy - 1, 6, 1, '#2e2e2e');
      }
      return;
    }
    case 'forsale':
      r(sx + 3, sy + 7, 2, 9, '#6a4020'); r(sx + 11, sy + 7, 2, 9);
      r(sx + 1, sy + 2, 14, 8, '#c8382c'); r(sx + 3, sy + 5, 10, 2, '#f1e6d0'); r(sx + 7, sy + 3, 2, 2, '#f6c343');
      return;
    case 'fruit': {
      const t = S.orchard[tx + ',' + ty];
      if (!t) return;
      const f = FRUITS[t.type], grown = Math.min(1, t.days / f.grow);
      if (grown < 1 / 3) {   // tunas kecil
        r(sx + 4, sy + 13, 8, 3, '#7a5232'); r(sx + 7, sy + 7, 2, 7, '#7a5232');
        r(sx + 4, sy + 7, 3, 2, '#5cbf44'); r(sx + 9, sy + 6, 3, 2); r(sx + 6, sy + 4, 4, 2, '#3f9a36');
        return;
      }
      const k = grown < 2 / 3 ? 0.55 + grown * 0.3 : 0.75 + 0.25 * grown, w = Math.round(14 * k), h = Math.round(12 * k);
      r(sx + 7, sy + 16 - Math.round(8 * k), 2, Math.round(8 * k), '#7a4a24');
      r(sx + 8 - w / 2, sy + 16 - Math.round(8 * k) - h + 2, w, h, '#3f9a36'); r(sx + 9 - w / 2, sy + 16 - Math.round(8 * k) - h + 2, w - 4, 2, '#5cbf44');
      if (t.fruit) for (const [ox, oy] of [[-4, -12], [2, -14], [4, -9], [-2, -8], [0, -11]]) r(sx + 8 + ox, sy + 16 + oy, 2, 2, f.color);
      return;
    }
    case 'sign':
      r(sx + 7, sy + 8, 2, 8, '#7a4a24'); r(sx + 2, sy + 2, 12, 8, '#b07a42'); r(sx + 2, sy + 9, 12, 1, '#7a4a24');
      r(sx + 4, sy + 4, 8, 1, '#5a3415'); r(sx + 4, sy + 6, 6, 1);
      return;
  }
}

function drawBuilding(b) {
  const X = b.x * T - R.cam.x, Y = b.y * T - R.cam.y, W = b.w * T, H = b.h * T;
  const lit = night() > 0.15;
  const dx = b.door[0] * T - R.cam.x;
  const win = (wx, wy) => { r(wx, wy, 12, 9, '#5d3a1a'); r(wx + 1, wy + 1, 10, 7, lit ? '#ffd86b' : '#9fd3f7'); r(wx + 6, wy + 1, 1, 7, '#5d3a1a'); r(wx + 1, wy + 4, 10, 1); if (!lit) r(wx + 2, wy + 2, 2, 1, '#e6f6ff'); };
  if (b.id === 'rumah') {
    r(X + 2, Y + 10, W - 4, H - 10, '#f1dfb4'); r(X + 2, Y + H - 2, W - 4, 2, '#c9b184');
    r(X + 2, Y + 10, 2, H - 10, '#a0703f'); r(X + W - 4, Y + 10, 2, H - 10);
    r(X + W - 18, Y - 20, 6, 10, '#8a8f96'); r(X + W - 19, Y - 21, 8, 2, '#6d7278');
    r(X - 3, Y - 6, W + 6, 18, '#c0392b'); r(X + 2, Y - 12, W - 4, 6);
    for (let i = 0; i < 4; i++) r(X - 3 + (i % 2) * 2, Y - 8 + i * 5, W + 4, 1, '#9b2a1f');
    r(X + 2, Y - 12, W - 4, 2, '#e05a45'); r(X - 3, Y + 11, W + 6, 2, '#7c2018');
    win(X + 10, Y + 20); win(X + W - 22, Y + 20);
    r(dx + 3, Y + H - 15, 10, 15, '#7a4a24'); r(dx + 4, Y + H - 14, 8, 1, '#9a6634'); r(dx + 10, Y + H - 8, 1, 2, '#f6c343');
  } else if (b.id === 'kandang') {
    r(X + 2, Y + 10, W - 4, H - 10, '#b5462f'); r(X + 2, Y + H - 2, W - 4, 2, '#7c2a1c');
    for (let i = 1; i < 6; i++) r(X + 2 + i * 10, Y + 12, 1, H - 14, '#9a3a26');
    r(X - 2, Y - 4, W + 4, 15, '#6b3a2a'); r(X + 4, Y - 10, W - 8, 6); r(X + 4, Y - 10, W - 8, 2, '#8a5040'); r(X - 2, Y + 10, W + 4, 2, '#4a2418');
    r(X + 2, Y + 10, W - 4, 1, '#f1e6d0');
    r(dx + 2, Y + H - 16, 12, 16, '#f1e6d0'); r(dx + 3, Y + H - 15, 10, 15, '#8a3a26');
    for (let i = 0; i < 10; i++) { r(dx + 3 + i, Y + H - 15 + Math.floor(i * 1.5), 1, 1, '#f1e6d0'); r(dx + 12 - i, Y + H - 15 + Math.floor(i * 1.5), 1, 1); }
    r(X + W - 22, Y + 20, 10, 10, '#f1e6d0'); r(X + W - 21, Y + 21, 8, 8, lit ? '#ffd86b' : '#3a2a1a');
  } else if (b.id === 'lumbung') {
    r(X + 2, Y + 8, W - 4, H - 8, '#a8402c'); r(X + 2, Y + H - 2, W - 4, 2, '#6e2618');
    for (let i = 1; i < W / 8; i++) r(X + 2 + i * 8, Y + 10, 1, H - 12, '#8f3524');
    r(X - 3, Y - 2, W + 6, 12, '#5e2a20'); r(X + 4, Y - 10, W - 8, 8); r(X + 14, Y - 14, W - 28, 4);
    r(X + 14, Y - 14, W - 28, 1, '#7a3a2c'); r(X - 3, Y + 9, W + 6, 2, '#3e1a12'); r(X + 2, Y + 11, W - 4, 1, '#f1e6d0');
    r(X + W / 2 - 5, Y - 8, 10, 7, '#f1e6d0'); r(X + W / 2 - 4, Y - 7, 8, 5, lit ? '#ffd86b' : '#3a2a1a');
    r(dx - 3, Y + H - 19, 22, 19, '#f1e6d0'); r(dx - 2, Y + H - 18, 20, 18, '#8a3020');
    for (let i = 0; i < 18; i++) { r(dx - 1 + i, Y + H - 18 + i, 1, 1, '#f1e6d0'); r(dx + 16 - i, Y + H - 18 + i, 1, 1); }
    r(dx + 7, Y + H - 18, 1, 18, '#f1e6d0');
  } else {
    r(X + 2, Y + 10, W - 4, H - 10, '#d9a066'); r(X + 2, Y + H - 2, W - 4, 2, '#a06a3a');
    for (let i = 0; i < 4; i++) r(X + 2, Y + 16 + i * 8, W - 4, 1, '#b8834e');
    r(X - 3, Y - 6, W + 6, 17, '#3f8f4a'); r(X + 2, Y - 12, W - 4, 6); r(X + 2, Y - 12, W - 4, 2, '#5fb86a');
    for (let i = 0; i < 4; i++) r(X - 3 + (i % 2) * 2, Y - 8 + i * 5, W + 4, 1, '#2f6f38');
    for (let i = 0; i * 6 < W - 4; i++) { r(X + 2 + i * 6, Y + 11, 6, 6, i % 2 ? '#fff4e6' : '#d9534f'); r(X + 2 + i * 6, Y + 17, 6, 1, i % 2 ? '#e8d8c0' : '#a83a36'); }
    r(X + W / 2 - 12, Y - 18, 24, 9, '#7a4a24'); r(X + W / 2 - 11, Y - 17, 22, 7, '#f1dfb4');
    r(X + W / 2 - 3, Y - 16, 5, 5, '#f6c343'); r(X + W / 2 - 2, Y - 15, 3, 3, '#e0a21c');
    win(X + 8, Y + 22); win(X + W - 20, Y + 22);
    const open = S.time >= SHOP_OPEN && S.time < SHOP_CLOSE;
    r(dx + 3, Y + H - 15, 10, 15, open ? '#4a2a10' : '#7a4a24'); r(dx + 2, Y + H - 16, 12, 1, '#5a3415');
    if (!open) r(dx + 4, Y + H - 11, 8, 4, '#f1dfb4');
  }
}

function drawPlayer(px, py) {
  const p = S.player, d = p.dir;
  const step = R.moving ? (Math.floor(R.anim * 7) % 2) : 0;
  const bob = R.moving && step ? -1 : 0;
  const x = px - 6, y = py + bob;
  r(px - 5, py - 1, 10, 3, 'rgba(0,0,0,.22)');
  // kaki
  if (d === 'left' || d === 'right') {
    r(x + 4 + (step ? 2 : 0), y - 4, 2, 4, '#5a3415'); r(x + 6 - (step ? 2 : 0), y - 4, 2, 4, '#4a2a10');
  } else {
    r(x + 3, y - 4 - (step ? 1 : 0), 2, 4, '#5a3415'); r(x + 7, y - 4 - (step ? 0 : 1) * (R.moving ? 1 : 0), 2, 4);
  }
  // overall & baju
  r(x + 2, y - 10, 8, 6, '#3f6fb5'); r(x + 2, y - 5, 8, 1, '#2f5590');
  r(x + 1, y - 12, 10, 3, '#e2554a');
  if (d === 'down') { r(x + 3, y - 12, 1, 3, '#3f6fb5'); r(x + 8, y - 12, 1, 3); r(x + 3, y - 9, 1, 1, '#f6c343'); r(x + 8, y - 9, 1, 1); }
  // lengan
  if (d === 'left') r(x + 5, y - 11, 2, 5, '#e2554a');
  else if (d === 'right') r(x + 5, y - 11, 2, 5, '#c8433a');
  else { r(x, y - 11, 2, 5, '#e2554a'); r(x + 10, y - 11, 2, 5); r(x, y - 7, 2, 1, '#f2c49b'); r(x + 10, y - 7, 2, 1); }
  // kepala
  r(x + 3, y - 17, 6, 5, '#f2c49b');
  if (d === 'up') r(x + 3, y - 17, 6, 4, '#6a3a1a');
  else {
    r(x + 3, y - 17, 6, 1, '#6a3a1a');
    if (d === 'down') { r(x + 4, y - 15, 1, 2, '#2b1a0a'); r(x + 7, y - 15, 1, 2); r(x + 5, y - 13, 2, 1, '#e09a7a'); }
    else if (d === 'left') { r(x + 3, y - 15, 1, 2, '#2b1a0a'); r(x + 8, y - 17, 1, 3, '#6a3a1a'); }
    else { r(x + 8, y - 15, 1, 2, '#2b1a0a'); r(x + 3, y - 17, 1, 3, '#6a3a1a'); }
  }
  // topi jerami
  r(x, y - 18, 12, 2, '#e8c35a'); r(x + 3, y - 21, 6, 3, '#e8c35a'); r(x + 3, y - 19, 6, 1, '#c0392b'); r(x + 4, y - 21, 3, 1, '#f6dc8a');
}

// hewan digambar menghadap kanan; `ai.flip` membalik ke kiri
const mirror = (cx, cy, ai) => (ox, oy, w, h, c) => r(ai.flip ? cx - ox - w : cx + ox, cy + oy, w, h, c);
function drawCow(cx, cy, ai) {
  const rr = mirror(cx, cy, ai), st = Math.floor(ai.walk * 6) % 2;
  r(cx - 8, cy - 1, 16, 3, 'rgba(0,0,0,.2)');
  rr(-6, -4, 2, 4, '#e8e2d6'); rr(-3, -4 + st, 2, 4 - st); rr(3, -4 + st, 2, 4 - st); rr(5, -4, 2, 4);
  rr(-6, -1, 2, 1, '#3a2a1a'); rr(5, -1, 2, 1);
  rr(-7, -11, 14, 8, '#fafaf5'); rr(-5, -10, 4, 3, '#2b2b2b'); rr(1, -9, 3, 3); rr(-2, -6, 2, 2);
  rr(-1, -4, 3, 1, '#f2a7b0'); rr(-8, -10, 1, 5, '#fafaf5'); rr(-8, -6, 1, 1, '#2b2b2b');
  rr(6, -14, 6, 6, '#fafaf5'); rr(7, -14, 3, 2, '#2b2b2b'); rr(9, -10, 4, 3, '#f2a7b0'); rr(11, -9, 1, 1, '#b06070');
  rr(8, -12, 1, 1, '#222'); rr(6, -15, 1, 1, '#e8dcc0'); rr(11, -15, 1, 1); rr(5, -13, 1, 2, '#fafaf5');
}
function drawGoat(cx, cy, ai) {
  const rr = mirror(cx, cy, ai), st = Math.floor(ai.walk * 7) % 2;
  r(cx - 6, cy - 1, 12, 2, 'rgba(0,0,0,.2)');
  rr(-4, -4, 1, 4, '#c4aa86'); rr(-2, -4 + st, 1, 4 - st); rr(3, -4 + st, 1, 4 - st); rr(5, -4, 1, 4);
  rr(-5, -10, 11, 6, '#d9c2a0'); rr(-4, -5, 9, 1, '#c4aa86'); rr(-6, -11, 1, 2, '#d9c2a0'); rr(-3, -10, 3, 2, '#e9dcc4');
  rr(5, -13, 4, 5, '#d9c2a0'); rr(5, -15, 1, 2, '#7a6a5a'); rr(6, -16, 2, 1); rr(8, -9, 1, 3, '#f2ecdc');
  rr(7, -12, 1, 1, '#222'); rr(4, -12, 2, 1, '#c4aa86'); rr(8, -11, 1, 1, '#8a6a5a');
}
function drawPig(cx, cy, ai) {
  const rr = mirror(cx, cy, ai), st = Math.floor(ai.walk * 7) % 2;
  r(cx - 7, cy - 1, 14, 2, 'rgba(0,0,0,.2)');
  rr(-5, -3, 2, 3, '#e08a96'); rr(-2, -3 + st, 2, 3 - st); rr(2, -3 + st, 2, 3 - st); rr(4, -3, 2, 3);
  rr(-6, -10, 12, 7, '#f4a6b2'); rr(-5, -11, 10, 1); rr(-4, -4, 8, 1, '#e08a96');
  rr(-8, -10, 2, 1, '#e08a96'); rr(-8, -9, 1, 1);                       // ekor keriting
  rr(5, -11, 4, 6, '#f4a6b2'); rr(8, -9, 2, 3, '#e57f8f'); rr(9, -8, 1, 1, '#9a4a56');   // kepala & moncong
  rr(5, -12, 2, 2, '#e08a96'); rr(7, -10, 1, 1, '#222');
}
function drawChicken(cx, cy, ai) {
  const rr = mirror(cx, cy, ai);
  r(cx - 4, cy - 1, 8, 2, 'rgba(0,0,0,.2)');
  const st = Math.floor(ai.walk * 8) % 2;
  rr(-2, -3, 1, 3, '#e8a33c'); rr(1, -3 + st, 1, 3 - st);
  rr(-4, -9, 8, 6, '#fffaf0'); rr(-6, -11, 3, 4); rr(-6, -11, 1, 2, '#e8e2d0');
  rr(-2, -8, 4, 3, '#e8e2d0');
  rr(2, -13, 4, 5, '#fffaf0'); rr(3, -14, 2, 1, '#e0402f'); rr(6, -11, 1, 1, '#f0a030'); rr(4, -12, 1, 1, '#222'); rr(5, -10, 1, 2, '#e0402f');
}

function drawEgg(ex, ey) {
  r(ex - 3, ey - 1, 6, 2, 'rgba(0,0,0,.18)');
  r(ex - 2, ey - 6, 4, 5, '#fffaf0'); r(ex - 1, ey - 7, 2, 1); r(ex - 1, ey - 5, 1, 2, '#ffffff'); r(ex + 1, ey - 3, 1, 2, '#e8dcc0');
}

function render() {
  const vw = cv.width, vh = cv.height, p = S.player, vf = viewFocus();
  const mapW = MW * T, mapH = MH * T;
  R.cam.x = mapW <= vw ? Math.round((mapW - vw) / 2) : clamp(Math.round(vf.x - vw / 2), 0, mapW - vw);
  R.cam.y = mapH <= vh ? Math.round((mapH - vh) / 2) : clamp(Math.round(vf.y - 8 - vh / 2), 0, mapH - vh);
  const cx = R.cam.x, cy = R.cam.y;
  g = g0;
  g.fillStyle = '#1d4a1f'; g.fillRect(0, 0, vw, vh);
  const tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(MW - 1, Math.floor((cx + vw) / T));
  const ty0 = Math.max(0, Math.floor(cy / T)), ty1 = Math.min(MH - 1, Math.floor((cy + vh) / T) + 2);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const sx = tx * T - cx, sy = ty * T - cy;
    drawGround(tx, ty, sx, sy);
    const s = S.soil[ty][tx];
    if (s) drawSoil(s, sx, sy);
  }
  // pagar kayu kandang
  g.fillStyle = '#9a7450';
  for (const [a, b, c, d] of allFences()) {
    const x0 = a * T - cx, y0 = b * T - cy, x1 = c * T - cx, y1 = d * T - cy;
    if (b === d) { r(x0, y0 - 6, x1 - x0, 1, '#9a7450'); r(x0, y0 - 3, x1 - x0, 1); for (let x = x0; x <= x1; x += 8) r(x - 1, y0 - 8, 2, 8, '#7a5534'); }
    else { r(x0, y0, 1, y1 - y0, '#9a7450'); for (let y = y0; y <= y1; y += 8) r(x0 - 1, y - 7, 2, 8, '#7a5534'); }
  }
  // sorot petak di depan petani
  if (!R.modal && !R.noChar) {
    const [fx, fy] = facing();
    if (inMap(fx, fy)) {
      const sx = fx * T - cx, sy = fy * T - cy;
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillRect(sx, sy, 3, 1); g.fillRect(sx, sy, 1, 3); g.fillRect(sx + 13, sy, 3, 1); g.fillRect(sx + 15, sy, 1, 3);
      g.fillRect(sx, sy + 15, 3, 1); g.fillRect(sx, sy + 13, 1, 3); g.fillRect(sx + 13, sy + 15, 3, 1); g.fillRect(sx + 15, sy + 13, 1, 3);
    }
  }
  const dl = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = Math.max(0, tx0 - 1); tx <= Math.min(MW - 1, tx1 + 1); tx++) {
    const o = S.obj[ty][tx], sx = tx * T - cx, sy = ty * T - cy;
    if (o && o !== 'bld') dl.push({y: o === 'flower' && decoAt(tx, ty) && ['jalanbatu', 'jalantunggul'].includes(decoAt(tx, ty).kind) ? ty * T : (ty + 1) * T - (o === 'weed' ? 2 : 0), f: () => drawObj(o, tx, ty, sx, sy)});
    const s = S.soil[ty][tx];
    if (s && s.crop) dl.push({y: (ty + 1) * T - 1, f: () => drawCrop(s.crop, sx, sy)});
  }
  for (const b of buildings()) dl.push({y: (b.y + b.h) * T, f: () => drawBuilding({...b, id: b.kind})});
  if (R.buildMode && R.build && !R.build.pick && R.build.x != null) dl.push({y: 1e9, f: () => {   // pratinjau penempatan
    const bd = R.build, d = BUILD[bd.kind], fr = footprint(bd.kind, bd.x, bd.y), ok = canPlace(bd.kind, bd.x, bd.y, bd.moveId);
    g.fillStyle = ok ? 'rgba(58,214,90,.3)' : 'rgba(232,71,58,.35)';
    g.fillRect(fr.x0 * T - cx, fr.y0 * T - cy, (fr.x1 - fr.x0 + 1) * T, (fr.y1 - fr.y0 + 1) * T);
    g.fillStyle = ok ? 'rgba(58,214,90,.55)' : 'rgba(232,71,58,.6)';
    g.fillRect(bd.x * T - cx, bd.y * T - cy, d.w * T, d.h * T);
  }});
  for (const e of S.eggs) dl.push({y: e.y, f: () => drawEgg(Math.round(e.x - cx), Math.round(e.y - cy))});
  if (animalsVisible()) for (const a of S.animals) {
    const draw = {sapi: drawCow, kambing: drawGoat, babi: drawPig}[a.type] || drawChicken, ai = R.ai[a.id] || {flip: false, walk: 0};
    dl.push({y: a.y, f: () => draw(Math.round(a.x - cx), Math.round(a.y - cy), ai)});
  }
  for (const w of S.shift || []) dl.push({y: w.y, f: () => {   // karyawan
    const x = Math.round(w.x - cx), y = Math.round(w.y - cy), step = w.walk ? (Math.floor(R.t * 8) % 2) : 0, shirt = w.job === 'petani' ? '#4f8f3a' : '#c0532b';
    r(x - 3, y - 4, 2, 4, '#5a3415'); r(x + 1, y - 4 + step, 2, 4 - step);   // kaki
    r(x - 4, y - 10, 8, 6, shirt); r(x - 3, y - 15, 6, 5, '#f2c49b');        // badan & kepala
    r(x - 6, y - 17, 12, 2, '#e8c35a'); r(x - 3, y - 19, 6, 2);              // caping
    if (w.state === 'work' && w.cool > 0.4) r(x + 4, y - 9, 3, 2, w.job === 'petani' ? '#7fc8ff' : '#f2e2a0');
  }});
  if (!R.noChar) dl.push({y: p.y, f: () => {
    const px = Math.round(p.x - cx), py = Math.round(p.y - cy);
    const behind = R.swing > 0 && p.dir === 'up';
    if (behind) drawSwing(px, py);
    drawPlayer(px, py);
    if (R.swing > 0 && !behind) drawSwing(px, py);
  }});
  dl.sort((a, b) => a.y - b.y);
  for (const d of dl) d.f();
  for (const [key, t] of Object.entries(S.orchard)) { const [tx, ty] = key.split(',').map(Number); drawFruitBadge(g, tx * T - cx + 8, ty * T - cy - 14, t, 0.42); }
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {   // indikator panen
    const s = S.soil[ty][tx];
    if (s && s.crop && !s.crop.dead) drawCropBadge(g, tx * T - cx + 8, ty * T - cy - (s.crop.type === 'jagung' ? 10 : 2), s.crop, s.watered, 0.42);
  }
  for (const a of S.animals) {
    const kind = animalBubble(a);
    if (kind) drawBubble(g, Math.round(a.x - cx), Math.round(a.y - cy - ({sapi: 16, kambing: 15, babi: 14}[a.type] || 13)), kind, 0.6);
  }
  // partikel
  for (const q of R.particles) {
    const x = Math.round(q.x - cx), y = Math.round(q.y - cy);
    g.globalAlpha = clamp(q.life * 2, 0, 1);
    if (q.kind === 'text') {
      g.font = 'bold 8px monospace'; g.textAlign = 'center';
      g.fillStyle = '#2b1a0a'; g.fillText(q.text, x + 1, y + 1);
      g.fillStyle = q.color; g.fillText(q.text, x, y);
    } else if (q.kind === 'heart') drawHeart(x, y, q.color);
    else r(x, y, 2, 2, q.color);
  }
  g.globalAlpha = 1;
  // cuaca
  if (S.weather === 'hujan') {
    g.fillStyle = 'rgba(30,50,90,.18)'; g.fillRect(0, 0, vw, vh);
    g.fillStyle = 'rgba(200,225,255,.7)';
    for (const d of R.drops) { g.fillRect(Math.round(d.x), Math.round(d.y), 1, 4); }
  } else if (S.weather === 'salju') {
    g.fillStyle = 'rgba(230,240,255,.12)'; g.fillRect(0, 0, vw, vh);
    g.fillStyle = '#fff';
    for (const d of R.drops) g.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
  }
  // senja & malam
  const n = night();
  if (n > 0) {
    const dusk = S.time < 1140;
    g.fillStyle = dusk ? `rgba(120,50,40,${n})` : `rgba(20,25,70,${n})`;
    g.fillRect(0, 0, vw, vh);
  }
}

function drawSwing(px, py) {
  const off = {down: [-8, -8], up: [-8, -30], left: [-19, -17], right: [3, -17]}[S.player.dir];
  g.save(); g.translate(px + off[0], py + off[1]);
  drawToolIcon(R.swingTool);
  g.restore();
}


function resize() {
  const W = innerWidth, H = innerHeight;
  const scale = clamp(Math.floor(Math.min(W / (T * 16), H / (T * 10))), 2, 6);
  cv.width = Math.ceil(W / scale); cv.height = Math.ceil(H / scale);
  cv.style.width = cv.width * scale + 'px'; cv.style.height = cv.height * scale + 'px';
  g0.imageSmoothingEnabled = false;
  R.drops = [];
}


function updateDrops2d(dt) {
  if (S.weather !== 'cerah') {
    const want = S.weather === 'hujan' ? 90 : 60;
    while (R.drops.length < want) R.drops.push({x: Math.random() * cv.width, y: Math.random() * cv.height, s: 0.6 + Math.random() * 0.6});
    for (const d of R.drops) {
      if (S.weather === 'hujan') { d.y += 220 * d.s * dt; d.x -= 30 * dt; }
      else { d.y += 22 * d.s * dt; d.x += Math.sin(R.t * 2 + d.s * 9) * 8 * dt; }
      if (d.y > cv.height) { d.y = -4; d.x = Math.random() * cv.width; }
      if (d.x < 0) d.x += cv.width;
    }
  }
}

window.Renderers = window.Renderers || {};
Renderers['2d'] = {
  init() { cv.hidden = false; },
  // titik layar → koordinat dunia (piksel game) untuk ketuk & geser
  pxPerTile() { return cv.getBoundingClientRect().width / cv.width * T; },
  pickWorld(cx, cy) { const rc = cv.getBoundingClientRect(), k = rc.width / cv.width; return [(cx - rc.left) / k + R.cam.x, (cy - rc.top) / k + R.cam.y]; },
  resize,
  update: updateDrops2d,
  draw: render,
};
