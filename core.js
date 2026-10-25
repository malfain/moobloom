'use strict';
/* Moo & Bloom — logika permainan, HUD, input. Tampilan ada di render2d.js / render3d.js. */
/* ================= Data ================= */
const T = 16, MW = 44, MH = 30;   // peta awal 32×24 + wilayah perluasan di timur & selatan
const SEASONS = ['Semi', 'Panas', 'Gugur', 'Dingin'];
const SEASON_DAYS = 10;
const MIN_MS = 450;            // ms nyata per menit game (10 menit ≈ 4,5 detik)
const DAY_START = 360, DAY_END = 1440, SHOP_OPEN = 540, SHOP_CLOSE = 1020;
const MAX_STAMINA = 100, CAN_MAX = 20;
const SAVE_KEY = 'kebunPelangi.beta1';   // nama lama dipertahankan agar simpanan pemain tidak hilang

const CROPS = {
  lobak:    {name: 'Lobak',    season: 0, grow: 4, regrow: 0, sell: 60,  seed: 5,  color: '#f4f0ff', accent: '#b05cc8', leaf: '#4fae3a'},
  kentang:  {name: 'Kentang',  season: 0, grow: 6, regrow: 0, sell: 80,  seed: 8,  color: '#c9955a', accent: '#a87440', leaf: '#3f9a36'},
  stroberi: {name: 'Stroberi', season: 0, grow: 7, regrow: 2, sell: 40,  seed: 13,  color: '#e8384a', accent: '#ffe36b', leaf: '#3d9a3a'},
  tomat:    {name: 'Tomat',    season: 1, grow: 7, regrow: 3, sell: 60,  seed: 10,  color: '#e8432f', accent: '#ff8a6b', leaf: '#3c8f2f'},
  jagung:   {name: 'Jagung',   season: 1, grow: 8, regrow: 3, sell: 70,  seed: 11,  color: '#f7cf3c', accent: '#c9a020', leaf: '#5aa83a'},
  semangka: {name: 'Semangka', season: 1, grow: 9, regrow: 0, sell: 260, seed: 30, color: '#3d8f3a', accent: '#9fd46a', leaf: '#4a9e36'},
  terong:   {name: 'Terong',   season: 2, grow: 6, regrow: 3, sell: 60,  seed: 10,  color: '#6b3b8f', accent: '#9a64c0', leaf: '#3f8a33'},
  wortel:   {name: 'Wortel',   season: 2, grow: 5, regrow: 0, sell: 80,  seed: 8,  color: '#f08a24', accent: '#ffb15c', leaf: '#4fae3a'},
  ubi:      {name: 'Ubi',      season: 2, grow: 6, regrow: 0, sell: 100, seed: 10,  color: '#b0446a', accent: '#d6708f', leaf: '#46a038'},
};
const GOODS = {
  telur: {name: 'Telur', sell: 50},
  susu:  {name: 'Susu Sapi', sell: 150},
  susuK: {name: 'Susu Kambing', sell: 110},
  truffle: {name: 'Daging Babi', sell: 500},   // kunci lama 'truffle' dipertahankan agar save tetap cocok
  kayu:  {name: 'Kayu', sell: 5},
};
const FEED_PRICE = 10, HAY_PRICE = 15;
// ternak: ayam di kandang (pakan → telur), sapi & kambing di lumbung (jerami → susu, diperah)
const ANIMALS = {
  ayam:    {name: 'Ayam',    price: 300,  home: 'kandang', product: 'telur', speed: 14, names: ['Ciko', 'Piyik', 'Jago', 'Kuning']},
  kambing: {name: 'Kambing', price: 1200, home: 'lumbung', product: 'susuK', speed: 10, names: ['Jenggot', 'Embek', 'Kriwil', 'Domba']},
  sapi:    {name: 'Sapi',    price: 2000, home: 'lumbung', product: 'susu',  speed: 8,  names: ['Belang', 'Mumu', 'Susi', 'Bona']},
  babi:    {name: 'Babi',    price: 750,  home: 'lumbung', product: 'truffle', speed: 9, names: ['Pinky', 'Gendut', 'Bulat', 'Nuri'],
            grow: 6, meat: 10},   // dibesarkan: 6 malam kenyang → gemuk, lalu dipotong jadi daging (dijual lewat kotak kirim)
};

const TOOLS = [
  {id: 'cangkul',  name: 'Cangkul',  cost: 2},
  {id: 'penyiram', name: 'Penyiram', cost: 1},
  {id: 'sabit',    name: 'Sabit',    cost: 1},
  {id: 'palu',     name: 'Palu',     cost: 2},
  {id: 'kapak',    name: 'Kapak',    cost: 3},
  {id: 'benih',    name: 'Benih',    cost: 0},
  {id: 'pemerah',  name: 'Pemerah',  cost: 1},
  {id: 'tangan',   name: 'Tangan',   cost: 0},
];

// bangunan tetap (tidak bisa dipindah)
const FIXED_BUILDINGS = [
  {id: 'rumah', kind: 'rumah', x: 3,  y: 2,  w: 5, h: 3, door: [5, 4]},
  {id: 'toko',  kind: 'toko',  x: 23, y: 15, w: 5, h: 3, door: [25, 17]},
];
// katalog mode bangun. Kandang & lumbung datang dengan halaman berpagar + tempat makan (posisi relatif ke pojok bangunan).
// yard = petak halaman; gate = celah pagar; trough = tempat makan; area = batas gerak hewan (piksel, dari tepi halaman)
const BUILD = {
  kandang: {name: 'Kandang Ayam', icon: '🐔', price: 1500, w: 4, h: 3, door: 1, cap: 4, feed: 'pakan', troughObj: 'feed', trough: [6, 4],
            yard: {x0: -1, x1: 6, y0: 4, y1: 7}, gate: 'top', area: {l: 6, r: 6, t: 10, b: 6}},
  lumbung: {name: 'Lumbung', icon: '🐄', price: 3000, w: 5, h: 3, door: 2, cap: 6, feed: 'jerami', troughObj: 'hay', trough: [5, 3],
            yard: {x0: -1, x1: 5, y0: 3, y1: 6}, gate: 'right', area: {l: 14, r: 14, t: 18, b: 8}},
  pagar:   {name: 'Pagar Kayu',   icon: '🪵', price: 15,  w: 1, h: 1, deco: true, solid: true},
  bunga:   {name: 'Petak Bunga',  icon: '🌷', price: 30,  w: 1, h: 1, deco: true, solid: false},
  semak:   {name: 'Semak',        icon: '🌳', price: 40,  w: 1, h: 1, deco: true, solid: true},
  bangku:  {name: 'Bangku Taman', icon: '🪑', price: 90,  w: 1, h: 1, deco: true, solid: true},
  lampu:   {name: 'Lampu Taman',  icon: '🏮', price: 120, w: 1, h: 1, deco: true, solid: true},
  sprinkler: {name: 'Penyiram Otomatis', icon: '💦', price: 5000, w: 1, h: 1, deco: true, solid: true, note: 'siram 8 petak sekitar tiap pagi'},
};
const FIELD = {x0: 11, y0: 8, x1: 20, y1: 16};
const FIELD2 = {x0: 10, y0: 24, x1: 21, y1: 27};   // ladang kedua di wilayah selatan
// wilayah perluasan: tertutup hutan sampai dibeli lewat papan "Dijual"
const REGIONS = [
  {id: 'timur',    name: 'Kebun Timur',     x0: 31, y0: 1,  x1: 42, y1: 22, price: 2500, sign: [30, 14]},
  {id: 'selatan',  name: 'Ladang Selatan',  x0: 1,  y0: 23, x1: 30, y1: 28, price: 4000, sign: [12, 22]},
  {id: 'tenggara', name: 'Lembah Tenggara', x0: 31, y0: 23, x1: 42, y1: 28, price: 6000, sign: [30, 22]},
];
// pohon buah: bibit dibeli di toko, tumbuh beberapa hari, lalu berbuah berkala (tidak berbuah di musim dingin)
const FRUITS = {
  apel:  {name: 'Apel',  price: 60, sell: 45, color: '#d8352a', grow: 3, regrow: 2},
  ceri:  {name: 'Ceri',  price: 75, sell: 55, color: '#a3122c', grow: 3, regrow: 2},
  pir:   {name: 'Pir',   price: 70, sell: 50, color: '#c9cf4a', grow: 4, regrow: 2},
  jeruk: {name: 'Jeruk', price: 90, sell: 65, color: '#f29a1f', grow: 4, regrow: 3},
};
const FRUIT_YIELD = 3;
// kandang & lumbung awal (bisa dipindah lewat mode bangun)
const STARTER_STRUCTS = [{id: 's1', kind: 'kandang', x: 3, y: 15, food: 0}, {id: 's2', kind: 'lumbung', x: 2, y: 7, food: 0}];
const HAY = [7, 10], FEED = [9, 19];   // posisi tempat makan awal (dipakai migrasi simpanan lama)
const START = {x: 5 * T + 8, y: 5 * T + 10};
const SOLID = new Set(['tree', 'rock', 'stump', 'bld', 'bin', 'feed', 'hay', 'sign', 'fruit', 'forsale', 'deco']);   // 'flower' = dekorasi yang bisa dilewati
const DIRV = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};

const PAL = {
  grass: '#7cc35a', tuft: '#5fa845', grassHi: '#9bd673',
  path: '#e1c48a', pebble: '#c9a76a', pathHi: '#ecd5a3',
  field: '#b8875a', fieldDk: '#9c7048', fieldHi: '#c99a6b',
  tilled: '#7b4f2c', furrow: '#5f3c20', wet: '#4b2f19', wetFurrow: '#38220f',
  water: '#3f8fd6', waterDk: '#2f6fb0', waterHi: '#9fd3f7',
};

/* ================= Util ================= */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function h2(x, y, s = 0) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const fmtTime = m => { const h = Math.floor(m / 60) % 24, mm = Math.floor((m % 60) / 10) * 10; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
const $ = id => document.getElementById(id);

/* ================= State ================= */
let S = null;                       // disimpan
const R = {                         // runtime, tidak disimpan
  keys: {up: false, down: false, left: false, right: false},
  moving: false, anim: 0, swing: 0, swingTool: null,
  acc: 0, t: 0, particles: [], drops: [], modal: false, running: false,
  msgTimer: 0, cam: {x: 0, y: 0}, ai: {}, stumpHits: {},
  noChar: true, camFocus: {x: 15.5 * 16, y: 11 * 16}, zoom: 1, lastTap: null,   // mode tanpa karakter: kamera bebas   // ai: gerak tiap hewan per id
};

function newGame() {
  const rnd = mulberry32(20261024);
  const ground = [], obj = [], soil = [];
  for (let y = 0; y < MH; y++) {
    ground.push(new Array(MW).fill('grass'));
    obj.push(new Array(MW).fill(null));
    soil.push(new Array(MW).fill(null));
  }
  const setG = (x, y, v) => { if (inMap(x, y)) ground[y][x] = v; };
  // jalan setapak
  for (let x = 2; x <= 22; x++) setG(x, 6, 'path');
  for (let y = 6; y <= 18; y++) setG(22, y, 'path');
  for (let x = 2; x <= 27; x++) setG(x, 18, 'path');
  setG(5, 5, 'path'); setG(9, 5, 'path');
  for (let y = 6; y <= 18; y++) setG(8, y, 'path');
  // ladang
  for (let y = FIELD.y0; y <= FIELD.y1; y++) for (let x = FIELD.x0; x <= FIELD.x1; x++) setG(x, y, 'field');
  // kolam
  for (let y = 3; y <= 7; y++) for (let x = 24; x <= 29; x++) {
    const corner = (x === 24 || x === 29) && (y === 3 || y === 7);
    if (!corner) setG(x, y, 'water');
  }
  // wilayah perluasan: jalan & ladang kedua sudah ada di bawah hutan, terlihat setelah dibeli
  for (let y = 19; y <= 28; y++) setG(22, y, 'path');
  for (let x = 23; x <= 41; x++) setG(x, 18, 'path');
  for (let y = 18; y <= 28; y++) setG(36, y, 'path');
  for (let y = FIELD2.y0; y <= FIELD2.y1; y++) for (let x = FIELD2.x0; x <= FIELD2.x1; x++) setG(x, y, 'field');
  // pohon tepi & hiasan; batas peta lama (x=31, y=23) ikut jadi hutan wilayah terkunci
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
    if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) obj[y][x] = 'tree';
  for (const r of REGIONS) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++)
    if (x === 31 || y === 23 || rnd() < 0.55) obj[y][x] = 'tree';
  for (const r of REGIONS) obj[r.sign[1]][r.sign[0]] = 'forsale';
  for (const [x, y] of [[13, 2], [16, 3], [19, 2], [11, 21], [15, 22], [19, 21], [28, 10], [29, 12], [27, 21], [25, 11], [14, 20]])
    if (ground[y][x] === 'grass') obj[y][x] = 'tree';
  // bangunan
  for (const b of FIXED_BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) obj[y][x] = 'bld';
  obj[4][9] = 'bin';
  obj[7][11] = 'sign';
  const structures = STARTER_STRUCTS.map(st => ({...st}));
  for (const st of structures) { clearFootprint(obj, st); writeStructure(obj, st); }
  // sampah di ladang
  for (let y = FIELD.y0; y <= FIELD.y1; y++) for (let x = FIELD.x0; x <= FIELD.x1; x++) {
    const v = rnd();
    obj[y][x] = v < 0.22 ? 'weed' : v < 0.30 ? 'rock' : v < 0.35 ? 'stump' : null;
  }
  return {
    v: 5, ground, obj, soil, structures, nextSid: 3,
    day: 1, season: 0, year: 1, time: DAY_START,
    gold: 300, stamina: MAX_STAMINA, water: CAN_MAX,
    tool: 0, seedSel: 'lobak',
    inv: {seeds: {lobak: 6, kentang: 3}, crops: {}, telur: 0, susu: 0, susuK: 0, truffle: 0, kayu: 0, pakan: 3, jerami: 2, bibit: {apel: 1}, buah: {}},
    player: {x: START.x, y: START.y, dir: 'down'},
    weather: 'cerah', tomorrow: 'cerah',
    shippedValue: 0, shippedItems: {},
    animals: [{id: 1, type: 'ayam', name: 'Ciko', home: 's1', x: 6 * T, y: 21 * T, hearts: 1, petToday: false, ready: false}],
    eggs: [], nextId: 2,
    regions: {},             // wilayah perluasan yang sudah dibeli
    orchard: starterOrchard(obj),
    stats: {harvested: 0, earned: 0},
    xp: 0,                   // pengalaman → level (karyawan terbuka di level STAFF_LEVEL)
    ledger: {days: [], total: {in: 0, out: 0}},   // buku kas (lihat cash())
    market: {},              // pengali harga jual per barang (lihat rollMarket)
    shift: [],               // karyawan yang sedang bekerja hari ini (posisi & tugas)
    applicants: [],          // pelamar kerja hari ini (lihat rollApplicants)
    staff: [],               // karyawan: [{job: 'petani'|'peternak', name}], maks STAFF_MAX
  };
}

// tiga pohon buah awal yang sudah berbuah, berjajar di utara ladang
function starterOrchard(obj) {
  const o = {};
  [['apel', 13], ['ceri', 15], ['pir', 17]].forEach(([type, x]) => { obj[4][x] = 'fruit'; o[x + ',4'] = {type, days: FRUITS[type].grow, wait: 0, fruit: true}; });
  return o;
}

// lumbung, tempat jerami, dan padang (dipakai game baru & migrasi simpanan lama)
function placeRanch(obj) {
  for (let y = 7; y < 10; y++) for (let x = 2; x < 7; x++) obj[y][x] = 'bld';
  for (let y = 10; y <= 14; y++) for (let x = 1; x <= 7; x++) if (obj[y][x] !== 'bld') obj[y][x] = null;
  obj[HAY[1]][HAY[0]] = 'hay';
}
function migrate(d) {
  if (d && d.inv && d.inv.truffle === undefined) d.inv.truffle = 0;   // barang baru (babi)
  if (d && d.v === 1 && d.chicken && isOldGrid(d.obj) && d.inv) {
    const c = d.chicken;
    d.animals = [{id: 1, type: 'ayam', name: 'Ciko', x: c.x, y: c.y, hearts: c.hearts, petToday: !!c.petToday, ready: false}];
    d.eggs = c.egg ? [c.egg] : [];
    delete d.chicken;
    d.nextId = 2; d.hayBox = 0;
    Object.assign(d.inv, {susu: 0, susuK: 0, jerami: d.inv.jerami || 0});
    if (d.tool === 6) d.tool = 7;   // slot 7 dulu Tangan, sekarang Pemerah
    placeRanch(d.obj);
    d.v = 3;
  }
  // v2 (beta awal ternak) menaruh lumbung di kanan, tertutup atap toko → pindahkan ke kiri
  if (d && d.v === 2 && isOldGrid(d.obj) && Array.isArray(d.animals)) {
    for (let y = 9; y <= 11; y++) for (let x = 24; x <= 28; x++) if (d.obj[y][x] === 'bld') d.obj[y][x] = null;
    if (d.obj[11][23] === 'hay') d.obj[11][23] = null;
    for (const [x, y] of [[28, 10], [25, 11]]) if (d.ground[y][x] === 'grass' && !d.obj[y][x]) d.obj[y][x] = 'tree';
    placeRanch(d.obj);
    for (const a of d.animals) if (ANIMALS[a.type] && ANIMALS[a.type].home === 'lumbung') Object.assign(a, {x: 4 * T, y: 12 * T});
    d.v = 3;
  }
  // v3 → v4: peta diperbesar (32×24 → 44×30) dengan wilayah perluasan, pohon buah, pagar
  if (d && d.v === 3 && isOldGrid(d.ground) && isOldGrid(d.obj) && isOldGrid(d.soil) && d.inv) {
    const fresh = newGame();
    d.ground = fresh.ground;   // tanah tidak pernah berubah saat bermain → pakai peta baru (jalan perluasan utuh)
    for (const k of ['obj', 'soil']) {
      for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) fresh[k][y][x] = d[k][y] ? d[k][y][x] : fresh[k][y][x];
      d[k] = fresh[k];
    }
    for (const r of REGIONS) d.obj[r.sign[1]][r.sign[0]] = 'forsale';
    d.regions = {}; d.orchard = {};
    d.inv.bibit = {apel: 2}; d.inv.buah = {};   // hadiah dua bibit apel untuk pemain lama
    d.v = 4;
  }
  // tempat jerami & pakan dipindah ke dalam pagar (simpanan sebelum perubahan ini)
  if (d && d.v === 4 && isGrid(d.obj)) {
    if (d.obj[9][7] === 'hay') { d.obj[9][7] = null; d.obj[HAY[1]][HAY[0]] = 'hay'; }
    if (d.obj[17][7] === 'feed') { d.obj[17][7] = null; d.obj[FEED[1]][FEED[0]] = 'feed'; }
  }
  // v4 → v5: kandang & lumbung jadi bangunan yang bisa dipindah (mode bangun); porsi makan per bangunan
  if (d && d.v === 4 && isGrid(d.obj) && Array.isArray(d.animals)) {
    d.structures = [{id: 's1', kind: 'kandang', x: 3, y: 15, food: d.feedBox | 0}, {id: 's2', kind: 'lumbung', x: 2, y: 7, food: d.hayBox | 0}];
    d.nextSid = 3;
    for (const a of d.animals) a.home = ANIMALS[a.type] && ANIMALS[a.type].home === 'kandang' ? 's1' : 's2';
    delete d.feedBox; delete d.hayBox;
    d.v = 5;
  }
  if (d && d.v === 5) {   // level & karyawan (tanpa naik versi): simpanan lama dapat XP sesuai panen & pendapatannya
    if (!isNum(d.xp)) d.xp = d.stats && isNum(d.stats.harvested) ? Math.floor(d.stats.harvested * 3 + (d.stats.earned || 0) / 25) : 0;
    // sekali saja: XP minimal sesuai lama bermain (20 XP per hari yang sudah dilewati) agar pemain lama tidak terlalu rendah
    if (!d.xpFloor && isNum(d.day) && isNum(d.season) && isNum(d.year)) {
      const played = ((d.year - 1) * 4 + d.season) * SEASON_DAYS + d.day - 1;
      d.xp = Math.max(d.xp, played * 20);
      d.xpFloor = true;
    }
    if (!Array.isArray(d.staff)) d.staff = [];
    if (!Array.isArray(d.applicants)) d.applicants = [];
    if (!Array.isArray(d.shift)) d.shift = [];
    for (const a of d.animals || []) if (a && a.type === 'babi' && a.ready) { a.ready = false; a.grow = (a.grow || 0) + 1; }
    if (!d.ledger) d.ledger = {days: [], total: {in: 0, out: 0}};
    if (!d.market || typeof d.market !== 'object') d.market = {};
    if (Array.isArray(d.ledger.days) && d.ledger.days.length > LEDGER_DAYS) d.ledger.days.length = LEDGER_DAYS;
  }
  return d;
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); localStorage.setItem(SAVE_KEY + '.at', String(Date.now())); }
  catch (e) { return false; }
  emit('saved');   // cloud.js mengunggah ke akun Google bila pemain sudah masuk
  return true;
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isOldGrid = a => Array.isArray(a) && a.length === 24 && a.every(row => Array.isArray(row) && row.length === 32);   // simpanan sebelum v4
const isGrid = a => Array.isArray(a) && a.length === MH && a.every(row => Array.isArray(row) && row.length === MW);
function validSave(d) {
  if (!d || d.v !== 5 || !isGrid(d.ground) || !isGrid(d.obj) || !isGrid(d.soil)) return false;
  for (const k of ['day', 'season', 'year', 'time', 'gold', 'stamina', 'water', 'tool', 'nextId', 'nextSid', 'shippedValue', 'xp']) if (!isNum(d[k])) return false;
  if (d.xp < 0 || d.xp > 1e9) return false;
  if (!d.market || typeof d.market !== 'object' || !Object.values(d.market).every(v => isNum(v) && v >= 0.5 && v <= 3)) return false;
  if (!d.ledger || !Array.isArray(d.ledger.days) || d.ledger.days.length > LEDGER_DAYS || !d.ledger.total || !isNum(d.ledger.total.in) || !isNum(d.ledger.total.out) ||
      !d.ledger.days.every(e => e && typeof e.k === 'string' && e.in && e.out && typeof e.in === 'object' && typeof e.out === 'object' &&
        Object.values(e.in).every(isNum) && Object.values(e.out).every(isNum))) return false;
  const okStat = v => v === undefined || [1, 2, 3, 4, 5].includes(v);
  const okWorker = w => w && Object.hasOwn(STAFF, w.job) && typeof w.name === 'string' && w.name.length < 40 &&
    (w.wage === undefined || (isNum(w.wage) && w.wage >= 0 && w.wage <= 1000)) && okStat(w.spd) && okStat(w.sta) && okStat(w.ski) &&
    (w.age === undefined || isNum(w.age)) && (w.exp === undefined || isNum(w.exp)) && (w.from === undefined || (typeof w.from === 'string' && w.from.length < 30));
  if (!Array.isArray(d.staff) || d.staff.length > STAFF_MAX || !d.staff.every(okWorker)) return false;
  if (!Array.isArray(d.applicants) || d.applicants.length > 5 || !d.applicants.every(okWorker)) return false;
  if (!Array.isArray(d.shift) || d.shift.length > STAFF_MAX || !d.shift.every(w => okWorker(w) && isNum(w.x) && isNum(w.y) && isNum(w.budget) && isNum(w.luck) && w.done && typeof w.done === 'object')) return false;
  if (!d.inv || !d.inv.seeds || !d.inv.crops) return false;
  for (const k of ['telur', 'susu', 'susuK', 'truffle', 'kayu', 'pakan', 'jerami']) if (!isNum(d.inv[k])) return false;
  if (!d.player || !isNum(d.player.x) || !isNum(d.player.y) || !DIRV[d.player.dir]) return false;
  if (!Array.isArray(d.animals) || !d.animals.every(a => a && isNum(a.id) && Object.hasOwn(ANIMALS, a.type) && isNum(a.x) && isNum(a.y) &&
    isNum(a.hearts) && a.hearts >= 0 && a.hearts <= 10 && typeof a.name === 'string' && /^[\w ]{1,19}$/.test(a.name))) return false;
  if (!Array.isArray(d.structures) || !d.structures.every(st => st && typeof st.id === 'string' && /^s\d+$/.test(st.id) && Object.hasOwn(BUILD, st.kind) &&
    isNum(st.x) && isNum(st.y) && st.x > 0 && st.y > 0 && st.x < MW && st.y < MH && (BUILD[st.kind].deco || isNum(st.food)))) return false;
  if (new Set(d.structures.map(st => st.id)).size !== d.structures.length) return false;
  if (!d.animals.every(a => d.structures.some(st => st.id === a.home && st.kind === ANIMALS[a.type].home))) return false;
  const ids = d.animals.map(a => a.id);
  if (new Set(ids).size !== ids.length || ids.some(id => id >= d.nextId)) return false;
  if (!Array.isArray(d.eggs) || !d.eggs.every(e => e && isNum(e.x) && isNum(e.y))) return false;
  if (!CROPS[d.seedSel] || !TOOLS[d.tool] || !d.stats || !isNum(d.stats.harvested) || !isNum(d.stats.earned)) return false;
  for (const m of [d.inv.seeds, d.inv.crops]) for (const [k, v] of Object.entries(m)) if (!CROPS[k] || !isNum(v)) return false;
  for (const row of d.soil) for (const c of row) if (c && c.crop && !CROPS[c.crop.type]) return false;
  if (!d.regions || typeof d.regions !== 'object' || !d.orchard || typeof d.orchard !== 'object') return false;
  for (const [k, t] of Object.entries(d.orchard))
    if (!/^\d+,\d+$/.test(k) || !t || !Object.hasOwn(FRUITS, t.type) || !isNum(t.days) || !isNum(t.wait)) return false;
  for (const m of [d.inv.bibit, d.inv.buah]) if (!m || Object.entries(m).some(([k, v]) => !Object.hasOwn(FRUITS, k) || !isNum(v))) return false;
  const names = new Set([...Object.values(CROPS), ...Object.values(GOODS), ...Object.values(FRUITS)].map(x => x.name));
  if (!d.shippedItems || Object.entries(d.shippedItems).some(([k, v]) => !names.has(k) || !isNum(v))) return false;
  return ['cerah', 'hujan', 'salju'].includes(d.weather) && ['cerah', 'hujan', 'salju'].includes(d.tomorrow);
}
function loadSave() {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return null;
    const d = migrate(JSON.parse(t));
    return validSave(d) ? d : 'rusak';
  } catch (e) { return null; }
}

/* ================= Dunia ================= */
function regionAt(tx, ty) { return REGIONS.find(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1); }
function tileLocked(tx, ty) { const r = regionAt(tx, ty); return !!r && !S.regions[r.id]; }
function solid(tx, ty) {
  if (!inMap(tx, ty)) return true;
  if (S.ground[ty][tx] === 'water' || tileLocked(tx, ty)) return true;
  return SOLID.has(S.obj[ty][tx]);
}
// kotak (piksel) menabrak pagar? pagar = garis tipis ±2px
function hitsFence(x0, y0, x1, y1) {
  for (const [a, b, c, d] of allFences()) {
    const fx0 = Math.min(a, c) * T - 2, fx1 = Math.max(a, c) * T + 2, fy0 = Math.min(b, d) * T - 2, fy1 = Math.max(b, d) * T + 2;
    if (x0 < fx1 && x1 > fx0 && y0 < fy1 && y1 > fy0) return true;
  }
  return false;
}
function blocked(x, y) {
  const x0 = Math.floor((x - 5) / T), x1 = Math.floor((x + 4) / T);
  const y0 = Math.floor((y - 4) / T), y1 = Math.floor((y + 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
  return hitsFence(x - 5, y - 4, x + 4, y + 1);
}
function facing() {
  const p = S.player, [dx, dy] = DIRV[p.dir];
  return [Math.floor(p.x / T) + dx, Math.floor((p.y - 2) / T) + dy];
}
function doorAt(tx, ty) { return buildings().find(b => b.door[0] === tx && b.door[1] === ty); }
function animalsVisible() { return S.time < 1110; }   // malam: hewan masuk kandang/lumbung
function animalAt(tx, ty, pick) {
  if (!animalsVisible()) return null;
  const cx = tx * T + 8, cy = ty * T + 8;
  let best = null, bd = Infinity;
  for (const a of S.animals) {
    if (pick && !pick(a)) continue;
    const rad = a.type === 'ayam' ? 12 : 15, dx = a.x - cx, dy = a.y - 4 - cy;
    if (Math.abs(dx) < rad && Math.abs(dy) < rad && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = a; }
  }
  return best;
}
function eggAt(tx, ty) { return S.eggs.findIndex(e => Math.floor(e.x / T) === tx && Math.floor((e.y - 1) / T) === ty); }
// tapak badan hewan (piksel) — sapi paling besar; cek sudut-sudutnya terhadap petak padat
const BODY = {ayam: 4, kambing: 7, babi: 8, sapi: 10};
function animalBlocked(type, x, y) {
  const r = BODY[type];
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, 2], [r, 2]]) if (solid(Math.floor((x + dx) / T), Math.floor((y + dy) / T))) return true;
  return hitsFence(x - r, y - r, x + r, y + 2);
}
const homeCount = kind => S.animals.filter(a => ANIMALS[a.type].home === kind).length;
const homeCap = kind => S.structures.filter(st => st.kind === kind).reduce((n, st) => n + BUILD[kind].cap, 0);
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const heartsTxt = h => '♥'.repeat(Math.ceil(h / 2)) + '♡'.repeat(5 - Math.ceil(h / 2));
const randomIn = r => ({x: r.x0 + Math.random() * (r.x1 - r.x0), y: r.y0 + Math.random() * (r.y1 - r.y0)});
function isMature(cr) { return cr && !cr.dead && cr.days >= CROPS[cr.type].grow; }

/* ================= Peristiwa (dipakai suara, getar, kamera) ================= */
const bus = {};
function onGame(name, fn) { (bus[name] || (bus[name] = [])).push(fn); }
function emit(name, data) { for (const fn of bus[name] || []) { try { fn(data); } catch (e) { console.error(e); } } }

/* ================= Aksi ================= */
function msg(text) { const m = $('msg'); m.textContent = text; m.hidden = false; R.msgTimer = 3.2; }

function spend(cost) {
  if (S.stamina < cost) { msg('Kamu terlalu lelah. Pulang dan tidur dulu!'); emit('tired'); return false; }
  S.stamina = Math.max(0, S.stamina - cost);
  emit('tool', R.swingTool);
  if (S.stamina <= 20 && S.stamina + cost > 20) msg('Kamu mulai kelelahan...');
  return true;
}
function burst(tx, ty, color, n = 6, kind = 'dot') {
  for (let i = 0; i < n; i++) R.particles.push({
    x: tx * T + 8 + (Math.random() - 0.5) * 8, y: ty * T + 10,
    vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, life: 0.5 + Math.random() * 0.3, color, kind,
  });
}
function popText(text, color = '#fff') {
  const p = R.noChar && R.lastTap ? R.lastTap : S.player;   // tanpa karakter: muncul di petak yang diketuk
  R.particles.push({x: p.x, y: p.y - 24, vx: 0, vy: -14, life: 1.1, color, kind: 'text', text, g: 0});
}

// target = [tx, ty] dari ketuk/geser (bawaan: petak di depan petani); drag = bagian dari gerakan geser
function useTool(target, drag) {
  if (R.modal || (!drag && R.swing > 0)) return;
  const tool = TOOLS[S.tool];
  if (tool.id === 'tangan') return interact(target);
  if (tool.id === 'benih') return plant(target, drag);
  const [tx, ty] = target || facing();
  if (!inMap(tx, ty) || tileLocked(tx, ty)) return;
  const o = S.obj[ty][tx], soil = S.soil[ty][tx], gr = S.ground[ty][tx];
  R.swing = drag ? 0.12 : 0.25; R.swingTool = tool.id;
  const wrongTool = () => {
    if (o === 'weed') msg('Rumput liar — bersihkan dengan Sabit (3).');
    else if (o === 'rock') msg('Batu — hancurkan dengan Palu (4).');
    else if (o === 'stump') msg('Tunggul kayu — tebang dengan Kapak (5).');
  };
  switch (tool.id) {
    case 'cangkul':
      if (o) return wrongTool();
      if (gr !== 'field') return msg('Tanah di sini terlalu keras. Cangkul di ladang.');
      if (soil) return;
      if (!spend(tool.cost)) return;
      S.soil[ty][tx] = {watered: S.weather === 'hujan', crop: null};
      burst(tx, ty, PAL.tilled);
      break;
    case 'penyiram':
      if (gr === 'water') { S.water = CAN_MAX; burst(tx, ty, PAL.waterHi, 8); emit('refill'); msg('Penyiram terisi penuh!'); return; }
      if (!soil) return;
      if (S.water <= 0) return msg('Penyiram kosong! Isi ulang di kolam.');
      if (!spend(tool.cost)) return;
      S.water--; soil.watered = true;
      burst(tx, ty, PAL.waterHi, 7);
      break;
    case 'sabit':
      if (o === 'weed') {
        if (!spend(tool.cost)) return;
        S.obj[ty][tx] = null; S.inv.jerami++; burst(tx, ty, '#4c9a34', 8); popText('+1 Jerami', '#f2e2a0');
        return;
      }
      if (soil && soil.crop && soil.crop.dead) { if (!spend(tool.cost)) return; soil.crop = null; burst(tx, ty, '#8a6a3a'); return; }
      return wrongTool();
    case 'palu':
      if (o === 'rock') { if (!spend(tool.cost)) return; S.obj[ty][tx] = null; burst(tx, ty, '#9aa0a8', 9); return; }
      if (soil && !soil.crop) { if (!spend(tool.cost)) return; S.soil[ty][tx] = null; burst(tx, ty, PAL.field); return; }
      return wrongTool();
    case 'pemerah': {
      const a = animalAt(tx, ty, x => x.type !== 'ayam' && x.ready) || animalAt(tx, ty);
      if (!a) return msg('Hadapkan ke sapi atau kambing untuk memerah susu.');
      if (a.type === 'ayam') return a.ready ? void collectFrom(a) : msg('Ayam tidak bisa diperah. Beri makan, besok bertelur.');
      if (a.type === 'babi') return animalTap(a);
      if (!a.ready) return msg(`${a.name} belum bisa diperah. Isi jerami di lumbung, besok pagi susunya siap.`);
      if (!spend(tool.cost)) return;
      const g = ANIMALS[a.type].product;
      a.ready = false; S.inv[g]++; emit('milk');
      popText('+1 ' + GOODS[g].name, '#fffbe0');
      break;
    }
    case 'kapak': {
      if (o === 'fruit') { R.swing = 0; return askChopFruit(tx, ty); }
      if (o === 'tree' && !choppable(tx, ty)) return msg('Pohon di tepi hutan tidak bisa ditebang.');
      if (o !== 'stump' && o !== 'tree') return wrongTool();
      if (!spend(tool.cost)) return;
      const k = tx + ',' + ty;
      if (o === 'tree') {   // pohon: 5 tebasan → tumbang jadi tunggul (+5 kayu)
        R.stumpHits[k] = (R.stumpHits[k] || 0) + 1;
        burst(tx, ty, '#6cc04a', 6);
        if (R.stumpHits[k] >= 5) {
          delete R.stumpHits[k];
          S.obj[ty][tx] = 'stump'; S.inv.kayu += 5; emit('chop');
          R.worldVer = (R.worldVer || 0) + 1;   // pohon realistis digambar sekaligus: susun ulang
          popText('+5 Kayu · tinggal tunggulnya', '#ffe7b0');
        }
        break;
      }
      R.stumpHits[k] = (R.stumpHits[k] || 0) + 1;
      burst(tx, ty, '#c79a5e', 6);
      if (R.stumpHits[k] >= 3) {
        delete R.stumpHits[k];
        S.obj[ty][tx] = null; S.inv.kayu += 3; emit('chop');
        popText('+3 Kayu', '#ffe7b0');
      }
      break;
    }
  }
}

// benih terpilih habis/bukan musimnya → pindah otomatis ke benih lain yang dimiliki (utamakan yang cocok musim ini)
function ensureSeed() {
  const ok = id => (S.inv.seeds[id] || 0) > 0;
  if (ok(S.seedSel) && CROPS[S.seedSel].season === S.season) return true;
  const owned = Object.keys(CROPS).filter(ok), fit = owned.find(id => CROPS[id].season === S.season);
  if (fit) S.seedSel = fit;
  else if (!ok(S.seedSel) && owned.length) S.seedSel = owned[0];
  return ok(S.seedSel);
}
function plant(target, drag) {
  if (R.modal) return;
  ensureSeed();
  const [tx, ty] = target || facing();
  if (!inMap(tx, ty) || tileLocked(tx, ty)) return;
  if (!inMap(tx, ty)) return;
  const soil = S.soil[ty][tx];
  const type = S.seedSel, n = S.inv.seeds[type] || 0;
  if (!n) return msg('Benih habis. Beli benih di toko (09:00–17:00).');
  const cr = CROPS[type];
  if (!soil) return msg('Cangkul tanahnya dulu sebelum menanam.');
  if (soil.crop) return;
  if (cr.season !== S.season) return msg(`${cr.name} hanya tumbuh di Musim ${SEASONS[cr.season]}.`);
  S.inv.seeds[type] = n - 1;
  if (n - 1 === 0) ensureSeed();   // jenis ini habis: lanjut ke benih lain
  soil.crop = {type, days: 0, dead: false};
  emit('plant');
  R.swing = drag ? 0.1 : 0.18; R.swingTool = 'benih';
  burst(tx, ty, '#e8d08a', 4);
  refreshHotbar();
}

function interact(target) {
  if (R.modal) return;
  const [tx, ty] = target || facing();
  if (!inMap(tx, ty)) return;
  if (tileLocked(tx, ty)) return msg('Wilayah ini belum dibuka. Cari papan "Dijual" untuk membelinya.');
  const ei = eggAt(tx, ty);
  if (ei >= 0) {
    S.eggs.splice(ei, 1); S.inv.telur++; emit('pickup');
    popText('+1 Telur', '#fffbe0');
    return;
  }
  const a = animalAt(tx, ty);
  if (a) return animalTap(a);
  const door = doorAt(tx, ty);
  if (door) {
    if (door.kind === 'rumah') return askSleep();
    if (door.kind === 'toko') return (S.time >= SHOP_OPEN && S.time < SHOP_CLOSE) ? openShop() : msg('Toko tutup. Buka pukul 09:00–17:00.');
    if (door.kind === 'kandang' || door.kind === 'lumbung') {
      const st = structById(door.id), n = residents(st).length;
      return msg(`${BUILD[st.kind].name}: ${n}/${BUILD[st.kind].cap} hewan · ${BUILD[st.kind].feed} terisi ${st.food} porsi.`);
    }
  }
  const o = S.obj[ty][tx];
  if (o === 'bin') return openShip();
  if (o === 'deco' && decoAt(tx, ty) && decoAt(tx, ty).kind === 'sprinkler') return msg('Penyiram otomatis: menyiram 8 bedeng di sekelilingnya setiap pagi. Pindahkan lewat 🔨 Bangun.');
  if (o === 'feed' || o === 'hay') return fillTrough(troughAt(tx, ty));
  if (o === 'fruit') return fruitTap(tx, ty);
  if ((o === 'tree' || o === 'stump') && haveBibit()) return msg('Bibit tidak ditanam di pohon yang sudah ada. Tebang dulu dengan Kapak (5), atau ketuk rumput kosong → pilih bibit.');
  if (o === 'forsale') return askBuyRegion(REGIONS.find(r => r.sign[0] === tx && r.sign[1] === ty));
  if (o === 'sign') return msg('Ladang Moo & Bloom — cangkul, tanam, siram tiap hari, lalu kirim hasilnya!');
  const soil = S.soil[ty][tx];
  if (soil && soil.crop) {
    const cr = soil.crop, def = CROPS[cr.type];
    if (cr.dead) return msg('Tanaman ini layu. Bersihkan dengan Sabit.');
    if (isMature(cr)) {
      S.inv.crops[cr.type] = (S.inv.crops[cr.type] || 0) + 1;
      S.stats.harvested++; emit('harvest');
      popText('+1 ' + def.name, '#fffbe0'); addXp(cropXp(cr.type));
      burst(tx, ty, def.leaf, 6);
      if (def.regrow) cr.days = def.grow - def.regrow; else soil.crop = null;
      return;
    }
    return msg(`${def.name}: panen dalam ±${fmtReal(realSecondsLeft(cr))}${soil.watered ? ' (sudah disiram)' : ' — jangan lupa disiram!'}`);
  }
  if (S.ground[ty][tx] === 'water') return msg('Airnya jernih. Pakai Penyiram untuk mengisi.');
}

const feedOf = a => a.type === 'ayam' ? 'pakan' : 'jerami';
// hewan sudah kebagian porsi dari tempat makan bangunannya (porsi ≥ penghuni yang belum disuapi)
function troughCovers(a) {
  const st = structById(a.home);
  return !!st && st.food >= residents(st).filter(x => !x.fed).length;
}
function popAt(x, y, text, color = '#fffbe0') { R.particles.push({x, y, vx: 0, vy: -14, life: 1.1, color, kind: 'text', text, g: 0}); }
function petAnimal(a) {
  emit({ayam: 'cluck', sapi: 'moo', kambing: 'baa', babi: 'oink'}[a.type]);
  if (!a.petToday) { a.petToday = true; msg(`Kamu mengelus ${a.name} si ${ANIMALS[a.type].name.toLowerCase()}. Ia terlihat senang!`); }
  else msg(`${a.name} ${heartsTxt(a.hearts)}${a.fed ? ' · sudah makan' : ' · lapar'}`);
  const top = a.type === 'ayam' ? 14 : 24;
  for (let i = 0; i < 3; i++) R.particles.push({x: a.x + (i - 1) * 5, y: a.y - top, vx: (i - 1) * 6, vy: -20, life: 1, color: '#e8384a', kind: 'heart'});
}
// beri makan langsung (pakan ayam / jerami); hewan yang makan hari ini menghasilkan besok pagi
function feedAnimal(a, quiet) {
  const item = feedOf(a);
  if (a.fed) return false;
  if (troughCovers(a)) { if (!quiet) msg(`${a.name} sudah kebagian dari tempat ${item === 'jerami' ? 'jerami' : 'pakan'}.`); return false; }
  if (S.inv[item] <= 0) { if (!quiet) msg(item === 'jerami' ? 'Jerami habis. Sabit rumput liar atau beli di toko.' : 'Pakan ayam habis. Beli di toko.'); return false; }
  S.inv[item]--; a.fed = true; emit('feed');
  popAt(a.x, a.y - 18, item === 'jerami' ? '+jerami' : '+pakan', '#f2e2a0');
  return true;
}
function collectFrom(a) {
  if (!a.ready) return false;
  const g = ANIMALS[a.type].product;
  a.ready = false; S.inv[g]++; emit(a.type === 'ayam' ? 'pickup' : a.type === 'babi' ? 'oink' : 'milk'); addXp(3);
  popAt(a.x, a.y - 20, '+1 ' + GOODS[g].name);
  return true;
}
// E / ketuk pada hewan: ambil hasil → elus → beri makan → status
// babi gemuk dijual utuh ke pasar
const pigGrown = a => !!ANIMALS[a.type].grow && (a.grow || 0) >= ANIMALS[a.type].grow;
// potong babi gemuk → daging masuk tas (dijual lewat kotak kirim seperti susu & telur)
function butcherPig(a) {
  if (!S.animals.includes(a)) return 0;
  const n = ANIMALS[a.type].meat;
  S.animals = S.animals.filter(x => x !== a); delete R.ai[a.id];
  S.inv.truffle += n; addXp(15);
  popAt(a.x, a.y - 22, `+${n} ${GOODS.truffle.name}`, '#ffd0c0');
  return n;
}
function askSellPig(a) {
  const n = ANIMALS[a.type].meat, worth = n * GOODS.truffle.sell;
  openModal(`Potong ${a.name}?`, `<p>🐷 ${esc(a.name)} sudah gemuk. Dipotong menghasilkan <b>${n} ${GOODS.truffle.name}</b> (±${worth.toLocaleString('id-ID')} G bila dijual lewat kotak kirim).</p><p class="muted">Kamu bisa membeli anak babi lagi di toko.</p>`,
    [{label: 'Nanti'}, {label: 'Potong', primary: true, fn: () => { if (butcherPig(a)) { emit('chop'); msg(`${a.name} dipotong: +${n} ${GOODS.truffle.name}. Jual lewat kotak kirim.`); } }}]);
}
function animalTap(a) {
  if (pigGrown(a)) return askSellPig(a);
  if (collectFrom(a)) return;
  if (!a.petToday) return petAnimal(a);
  if (!a.fed && feedAnimal(a)) return;
  if (ANIMALS[a.type].grow) return msg(`${a.name} sedang dibesarkan: ${a.grow || 0}/${ANIMALS[a.type].grow} hari kenyang. Setelah gemuk bisa dipotong jadi ${ANIMALS[a.type].meat} daging.`);
  petAnimal(a);
}

// isi tempat makan sebuah kandang/lumbung: satu porsi per penghuni, dimakan semalam
function fillTrough(st) {
  if (!st) return;
  const def = BUILD[st.kind], item = def.feed, n = residents(st).length, need = n - st.food;
  if (!n) return msg(st.kind === 'kandang' ? 'Kandang ini belum ada ayamnya. Beli di toko.' : 'Lumbung ini masih kosong. Beli sapi, kambing, atau babi di toko.');
  if (need <= 0) return msg(`Tempat ${item} sudah penuh (${st.food}/${n}).`);
  if (S.inv[item] <= 0) return msg(item === 'jerami' ? 'Kamu tidak punya jerami. Potong rumput liar dengan Sabit atau beli di toko.' : 'Kamu tidak punya pakan. Beli di toko.');
  const put = Math.min(need, S.inv[item]);
  S.inv[item] -= put; st.food += put; emit('feed');
  msg(`${put} porsi ${item} diisi (${st.food}/${n}). ${st.food >= n ? 'Besok pagi hewannya menghasilkan.' : 'Masih kurang ' + (n - st.food) + ' porsi.'}`);
}

/* ================= Bangunan yang bisa dipasang/dipindah (mode bangun) ================= */
const structById = id => S.structures.find(st => st.id === id);
const residents = st => S.animals.filter(a => a.home === st.id);
const isHome = st => !BUILD[st.kind].deco;
// tapak bangunan (petak): bangunan + halaman berpagar; dekorasi = 1 petak
function footprint(kind, x, y) {
  const d = BUILD[kind];
  if (d.deco) return {x0: x, y0: y, x1: x, y1: y};
  return {x0: Math.min(x, x + d.yard.x0), x1: Math.max(x + d.w - 1, x + d.yard.x1), y0: y, y1: y + d.yard.y1};
}
const inRect = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
function structAtTile(tx, ty, homesOnly) {
  return S.structures.find(st => (!homesOnly || isHome(st)) && inRect(footprint(st.kind, st.x, st.y), tx, ty));
}
// batas gerak hewan (piksel) di halaman sebuah kandang/lumbung
function structArea(st) {
  const d = BUILD[st.kind], yx0 = st.x + d.yard.x0, yx1 = st.x + d.yard.x1, yy0 = st.y + d.yard.y0, yy1 = st.y + d.yard.y1;
  return {x0: yx0 * T + d.area.l, x1: (yx1 + 1) * T - d.area.r, y0: yy0 * T + d.area.t, y1: (yy1 + 1) * T - d.area.b};
}
function spawnIn(st, type) {
  const area = structArea(st);
  let pos = randomIn(area);
  for (let i = 0; i < 20 && animalBlocked(type, pos.x, pos.y); i++) pos = randomIn(area);
  return pos;
}
// pagar halaman (garis antar petak) dengan gerbang
function structFences(st) {
  const d = BUILD[st.kind], x = st.x, y = st.y;
  const X0 = x + d.yard.x0, X1 = x + d.yard.x1 + 1, Y0 = y + d.yard.y0, Y1 = y + d.yard.y1 + 1;
  if (d.gate === 'top') return [[X0, Y0, x + 1, Y0], [x + 3, Y0, X1, Y0], [X0, Y0, X0, Y1], [X1, Y0, X1, Y1], [X0, Y1, X1, Y1]];
  return [[X0, Y0, x, Y0], [x + d.w, Y0, X1, Y0], [X0, Y0, X0, Y1], [X0, Y1, X1, Y1], [X1, Y0, X1, y + 5], [X1, y + 6, X1, Y1]];
}
function allFences() { return S ? S.structures.filter(isHome).flatMap(structFences) : []; }
// semua bangunan untuk digambar & pintu: bangunan tetap + kandang/lumbung pemain
function buildings() {
  return FIXED_BUILDINGS.concat(S.structures.filter(isHome).map(st => {
    const d = BUILD[st.kind];
    return {id: st.id, kind: st.kind, x: st.x, y: st.y, w: d.w, h: d.h, door: [st.x + d.door, st.y + d.h - 1]};
  }));
}
const troughTile = st => [st.x + BUILD[st.kind].trough[0], st.y + BUILD[st.kind].trough[1]];
function troughAt(tx, ty) { return S.structures.find(st => isHome(st) && troughTile(st)[0] === tx && troughTile(st)[1] === ty); }
// penyiram otomatis: menyiram 8 bedeng di sekelilingnya (3×3) setiap pagi dan saat baru dipasang
function runSprinklers(only) {
  let n = 0;
  for (const st of S.structures) {
    if (st.kind !== 'sprinkler' || (only && st !== only)) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const s = inMap(st.x + dx, st.y + dy) && S.soil[st.y + dy][st.x + dx];
      if (s && !s.watered) { s.watered = true; n++; }
    }
  }
  return n;
}
const decoAt = (tx, ty) => S.structures.find(st => !isHome(st) && st.x === tx && st.y === ty);
// tulis/hapus isi peta untuk sebuah bangunan
function writeStructure(obj, st) {
  const d = BUILD[st.kind];
  if (d.deco) { obj[st.y][st.x] = d.solid ? 'deco' : 'flower'; return; }
  for (let y = st.y; y < st.y + d.h; y++) for (let x = st.x; x < st.x + d.w; x++) obj[y][x] = 'bld';
  const [tx, ty] = troughTile(st); obj[ty][tx] = d.troughObj;
}
function clearFootprint(obj, st) {
  const r = footprint(st.kind, st.x, st.y);
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) obj[y][x] = null;
}
// rumput liar, batu & tunggul ikut dibersihkan saat bangunan dipasang
const DEBRIS = new Set(['weed', 'rock', 'stump']);
function clearDebris(st) {
  const r = footprint(st.kind, st.x, st.y);
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (DEBRIS.has(S.obj[y][x])) S.obj[y][x] = null;
}
// bisa dipasang? semua petak tapak harus lahan terbuka, kosong, tidak bertumpuk bangunan lain
function canPlace(kind, x, y, ignoreId) {
  const d = BUILD[kind], r = footprint(kind, x, y), self = ignoreId && structById(ignoreId);
  const selfRect = self && footprint(self.kind, self.x, self.y);
  for (let ty = r.y0; ty <= r.y1; ty++) for (let tx = r.x0; tx <= r.x1; tx++) {
    if (tx < 1 || ty < 1 || tx > MW - 2 || ty > MH - 2 || tileLocked(tx, ty)) return false;
    const g = S.ground[ty][tx], mine = selfRect && inRect(selfRect, tx, ty);
    if (g === 'water' || (g === 'path' && (d.deco || (tx >= x && tx < x + d.w && ty >= y && ty < y + d.h)))) return false;
    if (S.soil[ty][tx] || (S.obj[ty][tx] && !mine && !DEBRIS.has(S.obj[ty][tx]))) return false;
    if (S.structures.some(st => st.id !== ignoreId && inRect(footprint(st.kind, st.x, st.y), tx, ty))) return false;
  }
  if (!R.noChar) { const [px, py] = playerTile(); if (inRect(r, px, py) && !(selfRect && inRect(selfRect, px, py))) return false; }
  return true;
}
function placeNew(kind, x, y) {
  const d = BUILD[kind];
  if (S.gold < d.price || !canPlace(kind, x, y)) return false;
  cash(-d.price, 'bangun'); emit('coin');
  const st = {id: 's' + S.nextSid++, kind, x, y};
  if (!d.deco) st.food = 0;
  S.structures.push(st); clearDebris(st); writeStructure(S.obj, st);
  if (!d.deco) addXp(10);
  R.worldVer = (R.worldVer || 0) + 1;
  if (kind === 'sprinkler') { const n = runSprinklers(st); msg(`Penyiram otomatis dipasang! Menyiram 8 bedeng di sekitarnya tiap pagi${n ? ` (${n} bedeng langsung disiram)` : ''}.`); }
  else msg(d.deco ? `${d.name} dipasang.` : `${d.name} baru berdiri! Kapasitas bertambah ${d.cap} hewan.`);
  return true;
}
function moveStruct(id, x, y) {
  const st = structById(id);
  if (!st || !canPlace(st.kind, x, y, id)) return false;
  const old = footprint(st.kind, st.x, st.y);
  for (let ty = old.y0; ty <= old.y1; ty++) for (let tx = old.x0; tx <= old.x1; tx++)
    if (['bld', 'feed', 'hay', 'deco', 'flower'].includes(S.obj[ty][tx])) S.obj[ty][tx] = null;
  st.x = x; st.y = y; clearDebris(st); writeStructure(S.obj, st);
  if (st.kind === 'sprinkler') runSprinklers(st);
  for (const a of residents(st)) { Object.assign(a, spawnIn(st, a.type)); delete R.ai[a.id]; }
  R.worldVer = (R.worldVer || 0) + 1;
  msg(`${BUILD[st.kind].name} dipindahkan.`);
  return true;
}
function sellDeco(id) {
  const st = structById(id);
  if (!st || isHome(st)) return;
  S.obj[st.y][st.x] = null; S.structures = S.structures.filter(x => x !== st);
  const back = Math.floor(BUILD[st.kind].price / 2); cash(back, 'refund'); emit('coin');
  R.worldVer = (R.worldVer || 0) + 1;
  msg(`${BUILD[st.kind].name} dijual (+${back} G).`);
}

// ---------- panel mode bangun ----------
// ===== cat tanah (mode bangun): pemain membuat ladang / jalan di mana saja, atau mengembalikannya jadi rumput =====
const TERRAIN = {
  ladang: {name: 'Ladang', icon: '🟫', price: 10, to: 'field', note: 'tanah untuk bedeng'},
  jalan:  {name: 'Jalan', icon: '🪨', price: 5, to: 'path', note: 'untuk lewat & hiasan'},
  rumput: {name: 'Rumput', icon: '🌱', price: 0, to: 'grass', note: 'hapus jalan / ladang kosong'},
};
let paintTimer = null;
function canPaint(kind, tx, ty) {
  const t = TERRAIN[kind];
  if (!t || tx < 1 || ty < 1 || tx > MW - 2 || ty > MH - 2 || tileLocked(tx, ty)) return false;
  const g = S.ground[ty][tx], o = S.obj[ty][tx];
  if (g === 'water' || g === t.to || S.soil[ty][tx] || structAtTile(tx, ty)) return false;
  if (o && !(DEBRIS.has(o) && t.to !== 'path') && o !== 'weed') return false;   // pohon, bangunan, dll. tidak bisa ditimpa
  return true;
}
function paintAt(tx, ty) {
  const kind = R.paint, t = TERRAIN[kind];
  if (!t || !canPaint(kind, tx, ty)) return;
  if (S.gold < t.price) { if (!R.paintWarned) { R.paintWarned = true; msg('Uangmu tidak cukup.'); } return; }
  if (t.price) cash(-t.price, 'bangun');
  if (S.obj[ty][tx] === 'weed' && t.to === 'path') S.obj[ty][tx] = null;
  S.ground[ty][tx] = t.to;
  R.paintCount = (R.paintCount || 0) + 1; R.paintCost = (R.paintCost || 0) + t.price;
  burst(tx, ty, t.to === 'path' ? '#c9b48a' : t.to === 'field' ? '#8a5a32' : '#6cc04a', 4);
  (R.groundTiles || (R.groundTiles = [])).push([tx, ty]);   // renderer 3D menggambar ulang petak ini saja
  clearTimeout(paintTimer);
  paintTimer = setTimeout(() => { if (R.buildMode) renderBuildBar(); }, 150);
}
function startPaint(kind) { R.build = null; R.paint = kind; R.paintCount = 0; R.paintCost = 0; R.paintWarned = false; renderBuildBar(); }
function openBuild() { if (!S || R.modal) return; hideSeedPop(); R.buildMode = true; R.build = null; renderBuildBar(); }
function closeBuild() { R.buildMode = false; R.build = null; R.paint = null; R.painting = null; $('buildBar').hidden = true; }
function startPlace(kind) {
  const d = BUILD[kind], f = viewFocus(), cx = Math.floor(f.x / T), cy = Math.floor(f.y / T);
  R.build = {kind, x: d.deco ? cx : cx - Math.floor(d.w / 2), y: d.deco ? cy : cy - 2};
  renderBuildBar();
}
function buildTap(tx, ty) {
  if (!R.build) return;
  if (R.build.pick) {   // mode pindah: pilih bangunan/dekorasi
    const st = decoAt(tx, ty) || structAtTile(tx, ty, true);
    if (!st) return msg('Ketuk kandang, lumbung, atau dekorasi yang mau dipindah.');
    R.build = {kind: st.kind, x: st.x, y: st.y, moveId: st.id};
  } else {
    const d = BUILD[R.build.kind];
    R.build.x = d.deco ? tx : tx - Math.floor(d.w / 2); R.build.y = d.deco ? ty : ty - 1;
  }
  renderBuildBar();
}
function renderBuildBar() {
  const bar = $('buildBar'); bar.hidden = false;
  if (R.paint) {
    const t = TERRAIN[R.paint];
    bar.innerHTML = `<div class="bb-title">${t.icon} ${t.name}${t.price ? ` · ${t.price} G/petak` : ' · gratis'} <span class="muted">· ${S.gold.toLocaleString('id-ID')} G</span></div>
      <div class="bb-hint">Ketuk atau geser jari di peta untuk mengecat petak. ${R.paintCount ? `Sudah ${R.paintCount} petak${R.paintCost ? ` (−${R.paintCost} G)` : ''}.` : ''}<br><span class="muted">Tidak bisa di atas bedeng, pohon, bangunan, air, atau lahan yang belum dibeli.</span></div>
      <div class="bb-row">${Object.entries(TERRAIN).map(([k, x]) => `<button class="btn${k === R.paint ? ' primary' : ''}" data-paint="${k}">${x.icon} ${x.name}</button>`).join('')}<button class="btn primary" data-act="paintdone">✓ Selesai</button></div>`;
    return;
  }
  if (!R.build) {
    bar.innerHTML = `<div class="bb-title">🔨 Mode bangun <span class="muted">· ${S.gold.toLocaleString('id-ID')} G</span></div>
      <div class="bb-list">${Object.entries(BUILD).map(([k, d]) => `<button class="bb-item" data-k="${k}" ${S.gold < d.price ? 'disabled' : ''}><span class="bb-ico">${d.icon}</span><b>${d.name}</b><small>${d.price.toLocaleString('id-ID')} G${d.cap ? ' · ' + d.cap + ' hewan' : ''}${d.note ? ' · ' + d.note : ''}</small></button>`).join('')}</div>
      <div class="bb-title" style="margin-top:6px">🗺️ Tanah <span class="muted">· ketuk/geser di peta</span></div>
      <div class="bb-list">${Object.entries(TERRAIN).map(([k, t]) => `<button class="bb-item" data-paint="${k}"><span class="bb-ico">${t.icon}</span><b>${t.name}</b><small>${t.price ? t.price + ' G/petak' : 'gratis'} · ${t.note}</small></button>`).join('')}</div>
      <div class="bb-row"><button class="btn" data-act="move">↔ Pindahkan</button><button class="btn primary" data-act="done">Selesai</button></div>`;
    return;
  }
  if (R.build.pick) {
    bar.innerHTML = `<div class="bb-title">↔ Pindahkan</div><div class="bb-hint">Ketuk kandang, lumbung, atau dekorasi yang mau dipindah.</div><div class="bb-row"><button class="btn" data-act="cancel">✕ Batal</button></div>`;
    return;
  }
  const d = BUILD[R.build.kind], mv = R.build.moveId, ok = canPlace(R.build.kind, R.build.x, R.build.y, mv);
  bar.innerHTML = `<div class="bb-title">${mv ? 'Pindahkan' : 'Pasang'} ${d.icon} ${d.name}${mv ? '' : ' · ' + d.price.toLocaleString('id-ID') + ' G'}</div>
    <div class="bb-hint">${ok ? '✅ Bisa di sini. Ketuk peta untuk menggeser, lalu tekan ✓.' : '❌ Tidak bisa di sini (terhalang, di jalan/air, atau di luar lahan). Ketuk tempat lain.'}</div>
    <div class="bb-row"><button class="btn" data-act="cancel">✕ Batal</button>${mv && d.deco ? `<button class="btn" data-act="sell">Jual (+${Math.floor(d.price / 2)} G)</button>` : ''}<button class="btn primary" data-act="ok" ${ok ? '' : 'disabled'}>✓ ${mv ? 'Pindah' : 'Pasang'}</button></div>`;
}
$('buildBar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !S) return;
  if (b.dataset.k) return startPlace(b.dataset.k);
  if (b.dataset.paint) return startPaint(b.dataset.paint);
  const act = b.dataset.act;
  if (act === 'paintdone') { R.paint = null; return renderBuildBar(); }
  if (act === 'done') return closeBuild();
  if (act === 'move') { R.build = {pick: true}; return renderBuildBar(); }
  if (act === 'cancel') { R.build = null; return renderBuildBar(); }
  if (act === 'sell') { sellDeco(R.build.moveId); R.build = null; return renderBuildBar(); }
  if (act === 'ok') {
    const {kind, x, y, moveId} = R.build;
    const done = moveId ? moveStruct(moveId, x, y) : placeNew(kind, x, y);
    if (done) R.build = moveId || !BUILD[kind].deco || S.gold < BUILD[kind].price ? null : {kind, x: x + 1, y};   // dekorasi: lanjut pasang berikutnya
    renderBuildBar();
  }
});
$('seasonBtn').addEventListener('click', e => { e.currentTarget.blur(); if (S && R.running && !R.modal) { closeBuild(); openSeasons(); } });
$('datebox').addEventListener('click', () => { if (S && R.running && !R.modal) openSeasons(); });
$('goldbox').addEventListener('click', () => { if (S && R.running && !R.modal) openFinance(); });
$('staffBtn').addEventListener('click', e => { e.currentTarget.blur(); if (!R.modal && S) { closeBuild(); openStaff(); } });
$('buildBtn').addEventListener('click', e => { e.currentTarget.blur(); if (R.buildMode) closeBuild(); else openBuild(); });

/* ================= Pohon buah & perluasan wilayah ================= */
const orchardAt = (tx, ty) => S.orchard[tx + ',' + ty];
function fruitTap(tx, ty) {
  const t = orchardAt(tx, ty);
  if (!t) return;
  const f = FRUITS[t.type];
  if (t.fruit) {
    t.fruit = false; t.wait = f.regrow;
    S.inv.buah[t.type] = (S.inv.buah[t.type] || 0) + FRUIT_YIELD; S.stats.harvested += FRUIT_YIELD;
    emit('harvest'); popText(`+${FRUIT_YIELD} ${f.name}`, '#fffbe0'); burst(tx, ty, f.color, 8); addXp(3);
    return;
  }
  if (S.season === 3) return msg(`Pohon ${f.name} beristirahat di musim dingin.`);
  const stage = t.days < f.grow / 3 ? 'Tunas' : t.days < f.grow * 2 / 3 ? 'Pohon muda' : 'Pohon';
  msg(`${stage} ${f.name}: berbuah dalam ±${fmtReal(realSecondsDays(fruitDaysLeft(t)))}${haveBibit() ? ' · bibit baru ditanam di rumput kosong' : ''}`);
}
const fruitDaysLeft = t => t.days < FRUITS[t.type].grow ? FRUITS[t.type].grow - t.days : Math.max(1, t.wait);
// tanam bibit di petak kosong mana saja: rumput atau tanah ladang (bukan jalan, air, bedeng, kandang, atau wilayah terkunci)
function canPlantTree(tx, ty) {
  if (!inMap(tx, ty) || !['grass', 'field'].includes(S.ground[ty][tx]) || S.obj[ty][tx] || S.soil[ty][tx] || tileLocked(tx, ty)) return false;
  // seluruh area berpagar (padang & halaman ayam, termasuk depan pintu lumbung) tidak boleh ditanami
  if (structAtTile(tx, ty, true)) return false;   // tapak kandang/lumbung (termasuk halaman berpagar)
  // kotak badan petani tidak boleh tumpang tindih dengan petak pohon (supaya tidak terjebak)
  const p = S.player;
  return R.noChar || !(p.x + 4 > tx * T && p.x - 5 < tx * T + T && p.y + 1 > ty * T && p.y - 4 < ty * T + T);
}
// pohon hutan boleh ditebang, kecuali barisan paling tepi peta (batas dunia)
const choppable = (tx, ty) => tx > 0 && ty > 0 && tx < MW - 1 && ty < MH - 1 && !tileLocked(tx, ty);
const haveBibit = () => Object.values(S.inv.bibit).some(n => n > 0);
function plantTree(type, tx, ty) {
  if ((S.inv.bibit[type] || 0) <= 0) return msg('Bibit habis. Beli di toko.');
  if (!canPlantTree(tx, ty)) return msg('Pohon bisa ditanam di petak kosong mana saja — kecuali jalan, air, bedeng, dan dalam kandang.');
  S.inv.bibit[type]--; S.obj[ty][tx] = 'fruit';
  S.orchard[tx + ',' + ty] = {type, days: 0, wait: 0, fruit: false};
  R.worldVer = (R.worldVer || 0) + 1;   // rumput realistis di petak ini disingkirkan agar tunas terlihat
  emit('plant'); burst(tx, ty, '#6cc04a', 6); addXp(2);
  msg(`Tunas ${FRUITS[type].name} ditanam! Tumbuh besar & berbuah sekitar ${FRUITS[type].grow} hari lagi.`);
}
function askChopFruit(tx, ty) {
  const t = orchardAt(tx, ty);
  if (!t) return;
  openModal('Tebang pohon?', `<p>Tebang pohon ${FRUITS[t.type].name} ini? Kamu mendapat 2 kayu, tapi pohonnya hilang.</p>`, [
    {label: 'Batal'},
    {label: 'Tebang', fn: () => { S.obj[ty][tx] = null; delete S.orchard[tx + ',' + ty]; S.inv.kayu += 2; emit('chop'); popText('+2 Kayu', '#ffe7b0'); }},
  ]);
}
function askBuyRegion(r) {
  if (!r) return;
  if (S.regions[r.id]) return;
  if (r.id === 'tenggara' && !S.regions.timur && !S.regions.selatan)
    return msg('Buka Kebun Timur atau Ladang Selatan dulu — Lembah Tenggara hanya bisa dicapai lewat salah satunya.');
  const can = S.gold >= r.price;
  openModal('Perluas wilayah', `<p>Buka <b>${r.name}</b> seharga <b>${r.price.toLocaleString('id-ID')} G</b>?</p>
    <p class="muted">${r.id === 'selatan' ? 'Berisi ladang kedua yang luas untuk menanam lebih banyak.' : r.id === 'timur' ? 'Padang luas, cocok untuk kebun pohon buah.' : 'Lembah tenang dengan jalan setapak.'}
    Hutannya dibersihkan, sebagian pohon dibiarkan sebagai hiasan.</p>${can ? '' : `<p>Uangmu belum cukup (${S.gold.toLocaleString('id-ID')} G).</p>`}`,
    can ? [{label: 'Nanti'}, {label: `Beli ${r.price.toLocaleString('id-ID')} G`, primary: true, fn: () => unlockRegion(r)}] : [{label: 'Tutup', primary: true}]);
}
function unlockRegion(r) {
  if (S.regions[r.id] || S.gold < r.price) return;
  cash(-r.price, 'wilayah'); S.regions[r.id] = true; emit('coin'); addXp(40);
  const rnd = mulberry32(r.x0 * 97 + r.y0);
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const g = S.ground[y][x];
    if (S.obj[y][x] === 'tree' && (g !== 'grass' || x === 31 || y === 23 || rnd() > 0.12)) S.obj[y][x] = null;   // sisakan sedikit pohon hiasan
    if (g === 'field' && !S.obj[y][x]) { const v = rnd(); S.obj[y][x] = v < 0.2 ? 'weed' : v < 0.27 ? 'rock' : v < 0.31 ? 'stump' : null; }
  }
  S.obj[r.sign[1]][r.sign[0]] = null;
  R.worldVer = (R.worldVer || 0) + 1;   // renderer menyusun ulang rumput, pohon & tanah
  msg(`${r.name} terbuka! Jelajahi lahan barumu.`);
}

/* ================= Keterangan musim (ketuk kotak tanggal) ================= */
const SEASON_ICON = ['🌸', '☀️', '🍂', '❄️'];
function openSeasons() {
  const rows = SEASONS.map((nm, i) => {
    const crops = Object.values(CROPS).filter(c => c.season === i).map(c => c.name).join(', ');
    const note = i === 3 ? 'Tidak ada tanaman yang tumbuh. Ternak tetap jalan, pohon buah istirahat, petani libur' : crops;
    return `<tr class="${i === S.season ? 'now' : ''}"><td>${SEASON_ICON[i]} ${nm}${i === S.season ? ' <b>(sekarang)</b>' : ''}</td><td>${SEASON_DAYS} hari</td><td>${note}</td></tr>`;
  }).join('');
  const left = SEASON_DAYS - S.day;
  openModal('📅 Musim', `<p>Sekarang <b>Musim ${SEASONS[S.season]}, hari ${S.day} dari ${SEASON_DAYS}</b> · Tahun ${S.year}<br>
      <span class="muted">${left > 0 ? `${left} hari lagi menuju Musim ${SEASONS[(S.season + 1) % 4]}` : `Besok berganti ke Musim ${SEASONS[(S.season + 1) % 4]}`}. Tanaman musim lalu layu saat musim berganti.</span></p>
    <table class="cashTbl seasonTbl"><tr><th>Musim</th><th>Lama</th><th>Catatan</th></tr>${rows}</table>
    <p class="muted">1 tahun = ${SEASON_DAYS * 4} hari. Satu hari game (06:00–24:00) ±8 menit waktu nyata.</p>`, [{label: 'Tutup', primary: true}]);
}

/* ================= Keuangan: buku kas uang masuk & pengeluaran per minggu ================= */
const LEDGER_DAYS = 8;   // jumlah minggu yang disimpan (nama lama dipertahankan untuk validSave)
const CASH_IN = {jual: 'Hasil kiriman/penjualan', refund: 'Jual dekorasi'};
const CASH_OUT = {benih: 'Benih', bibit: 'Bibit pohon', pakan: 'Pakan & jerami', hewan: 'Beli hewan', bangun: 'Bangunan & dekorasi', wilayah: 'Perluasan wilayah', gaji: 'Gaji karyawan'};
// hari ke-n sejak awal permainan (0 = Semi 1 Tahun 1); seminggu = 7 hari game
const absDay = () => ((S.year - 1) * 4 + S.season) * SEASON_DAYS + S.day - 1;
const weekKey = () => 'w' + (Math.floor(absDay() / 7) + 1);
function weekLabel(k) {
  const w = +k.slice(1), d0 = (w - 1) * 7, d1 = d0 + 6;
  const dd = n => { const y = Math.floor(n / (4 * SEASON_DAYS)), se = Math.floor(n / SEASON_DAYS) % 4; return `${SEASONS[se]} ${n % SEASON_DAYS + 1}${y ? ` Th${y + 1}` : ''}`; };
  return `Minggu ${w}<small> (${dd(d0)} – ${dd(d1)})</small>`;
}
// semua perubahan uang lewat sini agar tercatat (delta positif = masuk)
function cash(delta, cat) {
  S.gold += delta;
  if (!delta) return;
  const L = S.ledger, side = delta > 0 ? 'in' : 'out', k = weekKey();
  let e = L.days[0];
  if (!e || e.k !== k) { e = {k, in: {}, out: {}}; L.days.unshift(e); if (L.days.length > LEDGER_DAYS) L.days.length = LEDGER_DAYS; }
  e[side][cat] = (+e[side][cat] || 0) + Math.abs(delta);
  L.total[side] += Math.abs(delta);
}
const sumObj = o => Object.values(o).reduce((a, v) => a + (+v || 0), 0);
const fmtG = n => Math.round(n).toLocaleString('id-ID') + ' G';
function openFinance() {
  const L = S.ledger, weeks = L.days.filter(e => /^w\d+$/.test(e.k));
  const cur = weeks[0] && weeks[0].k === weekKey() ? weeks[0] : {k: weekKey(), in: {}, out: {}};
  const tIn = sumObj(cur.in), tOut = sumObj(cur.out);
  const wages = S.staff.reduce((a, w) => a + (w.job === 'petani' && S.season === 3 ? 0 : STAFF[w.job].wage), 0);
  const net = n => `<span class="${n >= 0 ? 'cashIn' : 'cashOut'}">${n >= 0 ? '+' : '−'}${fmtG(Math.abs(n))}</span>`;
  const catRows = (side, names) => Object.entries(names).filter(([c]) => +cur[side][c]).map(([c, n]) =>
    `<div class="row"><div class="nm">${n}</div><span class="${side === 'in' ? 'cashIn' : 'cashOut'}">${side === 'in' ? '+' : '−'}${fmtG(+cur[side][c])}</span></div>`).join('') || '<p class="muted">Belum ada.</p>';
  openModal('💰 Keuangan', `
    <p><b>${weekLabel(cur.k)}</b> · hari ke-${absDay() % 7 + 1} dari 7</p>
    <div class="cashSum"><div><small>Uang masuk minggu ini</small><b class="cashIn">+${fmtG(tIn)}</b></div><div><small>Pengeluaran minggu ini</small><b class="cashOut">−${fmtG(tOut)}</b></div><div><small>Bersih</small><b>${net(tIn - tOut)}</b></div></div>
    <p class="muted">Saldo: <b>${fmtG(S.gold)}</b> · Kiriman hari ini (dibayar besok): <b>${fmtG(S.shippedValue)}</b> · Gaji karyawan per hari: <b>${fmtG(wages)}</b> (≈ ${fmtG(wages * 7)}/minggu)</p>
    <p><b>Uang masuk minggu ini</b></p>${catRows('in', CASH_IN)}
    <p><b>Pengeluaran minggu ini</b></p>${catRows('out', CASH_OUT)}
    <p><b>Riwayat mingguan</b></p>
    <table class="cashTbl"><tr><th>Minggu</th><th>Masuk</th><th>Keluar</th><th>Bersih</th></tr>
      ${weeks.map(e => { const i = sumObj(e.in), o = sumObj(e.out); return `<tr><td>${weekLabel(e.k)}</td><td class="cashIn">+${fmtG(i)}</td><td class="cashOut">−${fmtG(o)}</td><td>${net(i - o)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Belum ada transaksi.</td></tr>'}
    </table>
    <p class="muted">Sepanjang permainan: masuk ${fmtG(L.total.in)} · keluar ${fmtG(L.total.out)}</p>`, [{label: 'Tutup', primary: true}]);
}

/* ================= Level, XP & karyawan ================= */
const STAFF_LEVEL = 10;   // karyawan terbuka di level ini
const xpNeed = L => 30 + 20 * L;   // XP dari level L ke L+1
function levelInfo(xp) {
  let L = 1, cur = Math.max(0, Math.floor(xp) || 0);
  while (cur >= xpNeed(L)) { cur -= xpNeed(L); L++; }
  return {L, cur, need: xpNeed(L)};
}
const cropXp = type => Math.max(2, Math.round(CROPS[type].sell / 15));
function addXp(n) {
  if (!S || !n) return;
  const before = levelInfo(S.xp).L;
  S.xp += n;
  const after = levelInfo(S.xp).L;
  if (after <= before) return;
  emit('ship');
  popText(`Naik level! Lv ${after}`, '#ffe36b');
  // ditunda: pemanggil (mis. toko) mungkin sedang menggambar ulang jendelanya sendiri
  if (before < STAFF_LEVEL && after >= STAFF_LEVEL) setTimeout(() => {
    rollApplicants();
    if (R.modal) return msg(`🎉 Level ${after}! Lowongan kerja dibuka — lihat pelamar di tombol 👷 Karyawan.`);
    openModal(`Level ${after}!`, `<p>🎉 Selamat! <b>Lowongan kerja dibuka.</b></p><p>Pelamar sudah datang. Buka tombol <b>👷 Karyawan</b>, pilih pelamar yang cocok, lalu rekrut. Pelamar baru datang setiap pagi.</p>`, [{label: 'Lihat karyawan', primary: true, fn: () => setTimeout(openStaff, 0)}]);
  }, 0);
  else msg(`🎉 Naik ke Level ${after}!` + (after < STAFF_LEVEL ? ` Karyawan terbuka di Level ${STAFF_LEVEL}.` : ''));
}

// karyawan: dua bidang kerja berbeda (menanam & berternak), maksimal STAFF_MAX orang; bekerja tiap pagi dan digaji harian
const STAFF_MAX = 5;
const STAFF = {
  petani: {role: 'Petani', icon: '🌾', wage: 30, unit: 'bedeng', names: ['Pak Tani', 'Mas Budi', 'Kang Ujang', 'Pak Darto', 'Bang Iwan'],
    jobs: ['Membersihkan tanaman layu (gagal panen karena ganti musim)', 'Memanen tanaman & buah yang matang', 'Menanam benih di bedeng kosong (memakai benih di tasmu)', 'Menyiram bedeng', 'Mencangkul bedeng baru bila benihmu lebih banyak dari bedeng kosong', 'Menanam bibit pohon buah di dekat kebun buah']},
  peternak: {role: 'Peternak', icon: '🐄', wage: 50, unit: 'hewan', names: ['Bu Ternak', 'Mbak Sri', 'Teh Euis', 'Bu Wati', 'Kak Rina'],
    jobs: ['Mengambil telur & susu', 'Mengisi tempat pakan & jerami (memakai stok di tasmu)', 'Mengelus hewan', 'Memotong babi yang sudah gemuk menjadi daging']},
};
const staffOf = job => S.staff.filter(w => w.job === job);

// benih yang dipakai petani: musim ini, ada di tas, dan sempat matang sebelum musim berganti
const farmSeed = () => {
  const own = Object.keys(CROPS).filter(k => CROPS[k].season === S.season && (S.inv.seeds[k] || 0) > 0);
  return own.find(k => SEASON_DAYS - S.day + 1 >= CROPS[k].grow) || own[0];   // utamakan yang sempat matang musim ini
};
// tanah ladang kosong yang bisa dicangkul petani
const canTill = (tx, ty) => S.ground[ty][tx] === 'field' && (!S.obj[ty][tx] || DEBRIS.has(S.obj[ty][tx])) && !S.soil[ty][tx] && !tileLocked(tx, ty) && !structAtTile(tx, ty);
// perlu bedeng baru? bila benih musim ini lebih banyak daripada bedeng kosong (termasuk yang sedang dicangkul karyawan lain)
function needMoreBeds() {
  let seeds = 0, empty = 0;
  for (const k in CROPS) if (CROPS[k].season === S.season) seeds += S.inv.seeds[k] || 0;
  if (!seeds) return false;
  for (const row of S.soil) for (const s of row) if (s && !s.crop) empty++;
  empty += S.shift.filter(o => o.tgt && o.tgt.till).length;
  return seeds > empty;
}
// ===== karyawan bekerja langsung di ladang pada siang hari =====
// tiap orang berjalan ke bedeng/hewan terdekat dan mengerjakannya satu per satu (dengan suara & efek),
// sepanjang jam kerja (06:00 sampai jam pulang) sampai semua pekerjaan beres; ⚡ kecepatan menentukan laju jalan & kerja,
// 💪 tenaga menentukan jam pulang (tenaga 1 → 17:00, 3 → 18:00, 5 → 19:00).
const WORK_END = 1080;   // jam pulang bawaan (18:00)
const workEnd = w => 990 + statOf(w, 'sta') * 30;   // tenaga 1 → 17:00 … 5 → 19:00 (+30 menit per tingkat)
const walkSpeed = w => 34 + (w.spd || 3) * 9;          // piksel per detik (43–79)
const workTime = w => 1.35 - (w.spd || 3) * 0.19;      // detik per pekerjaan (1,16–0,4)
const nearView = (x, y) => { const f = viewFocus(); return Math.hypot(x - f.x, y - f.y) < 16 * T; };
const taken = (w, key) => S.shift.some(o => o !== w && o.tgt && o.tgt.key === key);
function tileNeedsFarmer(tx, ty) {
  const s = S.soil[ty][tx];
  if (!s) return false;
  if (s.crop && s.crop.dead) return true;   // tanaman layu (gagal panen karena ganti musim): dibersihkan
  if (s.crop) return isMature(s.crop) || !s.watered;
  return !!farmSeed();
}
function farmTask(w) {
  let best = null, bd = Infinity;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!tileNeedsFarmer(x, y) || taken(w, 't' + x + ',' + y)) continue;
    const d = Math.hypot(x * T + 8 - w.x, y * T + 8 - w.y);
    if (d < bd) { bd = d; best = {key: 't' + x + ',' + y, tx: x, ty: y}; }
  }
  // tidak ada bedeng yang perlu diurus: cangkul bedeng baru di sebelah bedeng yang sudah ada (ladang tetap rapi)
  if (!best && S.season !== 3 && needMoreBeds()) for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (!canTill(x, y) || taken(w, 't' + x + ',' + y)) continue;
    const next = S.soil[y][x - 1] || S.soil[y][x + 1] || S.soil[y - 1][x] || S.soil[y + 1][x];
    const d = Math.hypot(x * T + 8 - w.x, y * T + 8 - w.y) + (next ? 0 : 6 * T) + (S.obj[y][x] ? 3 * T : 0);
    if (d < bd) { bd = d; best = {key: 't' + x + ',' + y, tx: x, ty: y, till: true}; }
  }
  if (!best) best = saplingTask(w);
  if (S.season !== 3) for (const [k, t] of Object.entries(S.orchard)) {
    if (!t.fruit || taken(w, 'f' + k)) continue;
    const [x, y] = k.split(',').map(Number), d = Math.hypot(x * T + 8 - w.x, y * T + 8 - w.y);
    if (d < bd) { bd = d; best = {key: 'f' + k, tx: x, ty: y, fruit: true}; }
  }
  return best;
}
// bibit pohon buah: tanam di rumput kosong dekat pohon buah lain, berjarak 1 petak (kebun rapi & bisa dilewati)
const bibitType = () => Object.keys(FRUITS).find(k => (S.inv.bibit[k] || 0) > 0);
function saplingSpot(tx, ty) {
  if (S.ground[ty][tx] !== 'grass' || !canPlantTree(tx, ty)) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(tx + dx, ty + dy) && S.obj[ty + dy][tx + dx] === 'fruit') return false;
  return true;
}
function saplingTask(w) {
  if (!bibitType()) return null;
  const trees = Object.keys(S.orchard).map(k => k.split(',').map(Number));
  let best = null, bd = Infinity;
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (!saplingSpot(x, y) || taken(w, 'p' + x + ',' + y)) continue;
    const near = trees.length ? Math.min(...trees.map(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)))) : 3;
    const d = Math.hypot(x * T + 8 - w.x, y * T + 8 - w.y) + (near === 2 ? 0 : near * 3 * T);   // utamakan sebaris dengan kebun buah
    if (d < bd) { bd = d; best = {key: 'p' + x + ',' + y, tx: x, ty: y, sapling: true}; }
  }
  return best;
}
const animalNeedsRancher = a => {
  const st = structById(a.home);
  return a.ready || !a.petToday || pigGrown(a) || (st && st.food < residents(st).length && S.inv[feedOf(a)] > 0);
};
function ranchTask(w) {
  let best = null, bd = Infinity;
  for (const a of S.animals) {
    if (!animalNeedsRancher(a) || taken(w, 'a' + a.id)) continue;
    const d = Math.hypot(a.x - w.x, a.y - w.y);
    if (d < bd) { bd = d; best = {key: 'a' + a.id, id: a.id}; }
  }
  return best;
}
function taskPos(t) {
  if (t.id !== undefined) { const a = S.animals.find(x => x.id === t.id); return a && {x: a.x + 8, y: a.y + 2}; }
  return {x: t.tx * T + 8, y: t.ty * T + 15};
}
const taskValid = t => t.id !== undefined ? S.animals.some(a => a.id === t.id && animalNeedsRancher(a))
  : t.fruit ? !!(S.orchard[t.tx + ',' + t.ty] && S.orchard[t.tx + ',' + t.ty].fruit)
  : t.till ? canTill(t.tx, t.ty) : t.sapling ? !!bibitType() && saplingSpot(t.tx, t.ty) : tileNeedsFarmer(t.tx, t.ty);
function doFarm(w, t) {
  const loud = nearView(w.x, w.y);
  if (t.fruit) {
    const o = S.orchard[t.tx + ',' + t.ty], f = FRUITS[o.type];
    o.fruit = false; o.wait = f.regrow; S.inv.buah[o.type] = (S.inv.buah[o.type] || 0) + FRUIT_YIELD; S.stats.harvested += FRUIT_YIELD; w.done.buah++;
    burst(t.tx, t.ty, f.color, 8); popAt(t.tx * T + 8, t.ty * T, `+${FRUIT_YIELD} ${f.name}`); if (loud) emit('harvest');
    return;
  }
  if (t.sapling) {   // tanam bibit pohon buah: tumbuh dari tunas kecil
    const type = bibitType();
    if (!type) return;
    S.inv.bibit[type]--; S.obj[t.ty][t.tx] = 'fruit';
    S.orchard[t.tx + ',' + t.ty] = {type, days: 0, wait: 0, fruit: false};
    R.worldVer = (R.worldVer || 0) + 1;
    w.done.pohon = (w.done.pohon || 0) + 1;
    burst(t.tx, t.ty, '#6cc04a', 8); popAt(t.tx * T + 8, t.ty * T, `🌱 Tunas ${FRUITS[type].name}`);
    if (loud) emit('plant');
    return;
  }
  let sound = null;
  if (t.till) {   // bersihkan rumput liar/batu/tunggul, cangkul bedeng baru, lalu langsung ditanami & disiram
    const o = S.obj[t.ty][t.tx];
    if (o) { if (o === 'weed') S.inv.jerami++; else S.inv.kayu += o === 'stump' ? 1 : 0; S.obj[t.ty][t.tx] = null; }
    S.soil[t.ty][t.tx] = {watered: false, crop: null}; w.done.cangkul = (w.done.cangkul || 0) + 1;
    burst(t.tx, t.ty, '#8a5a32', 6); if (loud) emit('tool', 'cangkul');
  }
  const s = S.soil[t.ty][t.tx];
  if (s.crop && s.crop.dead) {   // bersihkan tanaman layu
    s.crop = null; w.done.bersih = (w.done.bersih || 0) + 1;
    burst(t.tx, t.ty, '#a08050', 6); popAt(t.tx * T + 8, t.ty * T, '🧹 Dibersihkan', '#e8dcc0');
    sound = 'clean';
  }
  if (s.crop && isMature(s.crop)) {
    const def = CROPS[s.crop.type], n = Math.random() < w.luck ? 2 : 1;
    S.inv.crops[s.crop.type] = (S.inv.crops[s.crop.type] || 0) + n; S.stats.harvested += n; w.done.panen += n; if (n > 1) w.done.bonus++;
    popAt(t.tx * T + 8, t.ty * T, `+${n} ${def.name}${n > 1 ? ' 🎯' : ''}`); burst(t.tx, t.ty, def.leaf, 6);
    if (def.regrow) s.crop.days = def.grow - def.regrow; else s.crop = null;
    sound = 'harvest';
  }
  if (!s.crop) {
    const id = farmSeed();
    if (id) { S.inv.seeds[id]--; s.crop = {type: id, days: 0, dead: false}; w.done.tanam++; burst(t.tx, t.ty, '#e8d08a', 4); sound = sound || 'plant'; }
  }
  const wet = s.crop && !s.watered;
  if (wet) { s.watered = true; w.done.siram++; burst(t.tx, t.ty, '#7fc8ff', 9); }
  if (!loud) return;
  if (sound === 'clean') emit('tool', 'sabit'); else if (sound) emit(sound);
  if (wet) setTimeout(() => emit('tool', 'penyiram'), sound ? 280 : 0);   // bunyi air menyiram
}
function doRanch(w, t) {
  const a = S.animals.find(x => x.id === t.id), loud = nearView(w.x, w.y);
  if (!a) return;
  if (pigGrown(a)) {   // babi gemuk dipotong → daging masuk tas
    const n = butcherPig(a);
    w.done.potong = (w.done.potong || 0) + 1; w.done.daging = (w.done.daging || 0) + n;
    if (loud) emit('chop');
    return;
  }
  if (a.ready) {
    const g = ANIMALS[a.type].product, n = Math.random() < w.luck ? 2 : 1;
    a.ready = false; S.inv[g] += n; w.done.hasil += n; if (n > 1) w.done.bonus++;
    popAt(a.x, a.y - 20, `+${n} ${GOODS[g].name}${n > 1 ? ' 🎯' : ''}`);
    if (loud) emit(a.type === 'ayam' ? 'cluck' : a.type === 'babi' ? 'oink' : a.type === 'sapi' ? 'moo' : 'baa');
  }
  const st = structById(a.home), item = feedOf(a);
  if (st && st.food < residents(st).length && S.inv[item] > 0) {   // isi penuh tempat makan sekaligus (bukan satu porsi per kunjungan)
    const put = Math.min(residents(st).length - st.food, S.inv[item]);
    S.inv[item] -= put; st.food += put; w.done.makan += put; if (loud) emit('feed');
  }
  if (!a.petToday) { a.petToday = true; w.done.elus++; popAt(a.x, a.y - 12, '❤', '#ff7a9a'); }
}
// dipanggil dari update(): gerakkan karyawan & kerjakan tugas
function staffTick(dt) {
  if (!S.shift || !S.shift.length) return;
  for (const w of S.shift) {
    w.walk = false;
    if (w.cool > 0) { w.cool -= dt; continue; }
    if (S.time >= (w.end || WORK_END)) {   // jam pulang
      if (w.state !== 'done') { w.left = !!(w.job === 'petani' ? farmTask(w) : ranchTask(w)); w.state = 'done'; w.tgt = null; popAt(w.x, w.y - 26, '👋 Pulang, sampai besok!', '#c8f7a0'); }
      continue;
    }
    if (!w.tgt || !taskValid(w.tgt)) w.tgt = w.job === 'petani' ? farmTask(w) : ranchTask(w);
    if (!w.tgt) { w.state = 'idle'; w.cool = 1.5; continue; }
    const tp = taskPos(w.tgt);
    if (!tp) { w.tgt = null; continue; }
    const dx = tp.x - w.x, dy = tp.y - w.y, d = Math.hypot(dx, dy);
    if (d > 5) { const st = Math.min(d, walkSpeed(w) * dt); w.x += dx / d * st; w.y += dy / d * st; w.dir = Math.atan2(dx, dy); w.walk = true; w.state = 'walk'; continue; }
    (w.job === 'petani' ? doFarm : doRanch)(w, w.tgt);
    w.tgt = null; w.cool = workTime(w); w.state = 'work';
  }
}
// laporan kerja kemarin untuk laporan pagi
function shiftReport() {
  const out = [];
  for (const w of S.shift || []) {
    const d = Object.fromEntries(Object.entries(w.done || {}).map(([k, v]) => [k, Math.max(0, Math.floor(+v) || 0)])), parts = w.job === 'petani'
      ? [d.bersih && `membersihkan ${d.bersih} tanaman layu`, d.pohon && `menanam ${d.pohon} bibit pohon`, d.cangkul && `mencangkul ${d.cangkul} bedeng baru`, d.panen && `memanen ${d.panen}`, d.buah && `memetik ${d.buah} pohon`, d.tanam && `menanam ${d.tanam}`, d.siram && `menyiram ${d.siram} bedeng`]
      : [d.potong && `memotong ${d.potong} babi gemuk (+${d.daging} daging — jual lewat kotak kirim)`, d.hasil && `mengambil ${d.hasil} hasil ternak`, d.makan && `mengisi ${d.makan} porsi makan`, d.elus && `mengelus ${d.elus} hewan`];
    const did = parts.filter(Boolean);
    const left = w.left;   // dicatat saat jam pulang: masih ada kerjaan yang belum beres
    out.push(`${STAFF[w.job].icon} Kemarin ${esc(w.name)} ${did.length ? did.join(', ') : 'tidak menemukan pekerjaan'}.${d.bonus ? ` 🎯 Bonus ×${d.bonus}.` : ''}` +
      (left ? ` Sampai jam pulang masih ada ${w.job === 'petani' ? 'bedeng' : 'hewan'} yang belum terurus — rekrut ${STAFF[w.job].role.toLowerCase()} lagi atau pilih yang ⚡ lebih cepat.` : ''));
  }
  return out;
}
// CV pelamar: tiap atribut 1–5 dan semuanya berpengaruh
//  ⚡ kecepatan → laju jalan & kerja · 💪 tenaga → jam pulang (lebih lama bekerja) · 🎯 keahlian → peluang hasil bonus
const STAT_NAMES = {spd: '⚡ Kecepatan', sta: '💪 Tenaga', ski: '🎯 Keahlian'};
const HIRE_FEE = 5;          // biaya rekrut = 5 × gaji harian
const REROLL_PRICE = 50;     // cari pelamar lain
const statOf = (w, k) => isNum(w[k]) ? w[k] : 3;   // karyawan lama tanpa CV dianggap rata-rata
const speedLabel = w => `Kerja ${['sangat lambat', 'lambat', 'sedang', 'cepat', 'sangat cepat'][statOf(w, 'spd') - 1]} (±${workTime({spd: statOf(w, 'spd')}).toFixed(1)} dtk per ${STAFF[w.job].unit})`;
const bonusChance = w => statOf(w, 'ski') * 0.05;         // 5–25% hasil +1
const workerWage = w => isNum(w.wage) ? w.wage : STAFF[w.job].wage;
const wageFor = (job, st) => { const t = st.spd + st.sta + st.ski; return job === 'petani' ? Math.round(5 + t * 2.5) : Math.round(15 + t * 3.5); };
const starsOf = w => Math.max(1, Math.min(3, Math.round((statOf(w, 'spd') + statOf(w, 'sta') + statOf(w, 'ski')) / 5)));
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const statBar = v => `<span class="sbar">${'<i class="on"></i>'.repeat(v)}${'<i></i>'.repeat(5 - v)}</span>`;
// 3 pelamar baru: minimal satu petani & satu peternak; atribut acak (nilai 5 jarang)
function rollApplicants() {
  const used = new Set(S.staff.map(w => w.name)), out = [];
  const roll = () => { const r = Math.random(); return r < 0.15 ? 1 : r < 0.45 ? 2 : r < 0.75 ? 3 : r < 0.93 ? 4 : 5; };
  for (const job of ['petani', 'peternak', Math.random() < 0.5 ? 'petani' : 'peternak']) {
    const pool = STAFF[job].names.filter(n => !used.has(n));
    const name = pool.length ? pool[Math.floor(Math.random() * pool.length)] : STAFF[job].role + ' ' + Math.floor(Math.random() * 90 + 10);
    used.add(name);
    const st = {spd: roll(), sta: roll(), ski: roll()}, age = 18 + Math.floor(Math.random() * 38);
    out.push({job, name, ...st, wage: wageFor(job, st), age});
  }
  S.applicants = out;
}
// kartu CV untuk pelamar / karyawan
function cvCard(w, btn) {
  const d = STAFF[w.job];
  const bio = isNum(w.age) ? `Umur ${w.age} tahun` : 'Karyawan lama';
  return `<div class="cv"><div class="cvHead"><b>${d.icon} ${esc(w.name)}</b> — ${d.role} <span class="stars">${stars(starsOf(w))}</span><small>${bio}</small></div>
    <div class="cvStats">${Object.entries(STAT_NAMES).map(([k, n]) => `<div>${n} ${statBar(statOf(w, k))}</div>`).join('')}</div>
    <small class="muted">${speedLabel(w)} · kerja sampai ${fmtTime(workEnd(w))} · bonus hasil ${Math.round(bonusChance(w) * 100)}% · gaji ${workerWage(w)} G/hari</small>${btn}</div>`;
}
// masukkan satu karyawan ke daftar kerja hari ini (bayar gaji); kembalikan catatan untuk laporan
function startShift(w) {
  const d = STAFF[w.job], i = S.shift.length;
  if (w.job === 'petani' && S.season === 3) return `${d.icon} ${esc(w.name)} libur di musim dingin (tidak digaji).`;
  if (S.gold < workerWage(w)) return `${d.icon} ${esc(w.name)} libur: uangmu kurang untuk gaji ${workerWage(w)} G.`;
  cash(-workerWage(w), 'gaji');
  S.shift.push({job: w.job, name: w.name, budget: 0, spd: statOf(w, 'spd'), luck: bonusChance(w), end: workEnd(w), x: START.x + (i % 3 - 1) * 14, y: START.y + 10 + Math.floor(i / 3) * 12, dir: 0, cool: 0, tgt: null,
    done: {panen: 0, buah: 0, tanam: 0, siram: 0, cangkul: 0, hasil: 0, makan: 0, elus: 0, bonus: 0}});
  return `${d.icon} ${esc(w.name)} bekerja hari ini sampai jam ${fmtTime(workEnd(w))} <span class="muted">(gaji −${workerWage(w)} G)</span>`;
}
function staffWork() {
  const notes = shiftReport();
  S.shift = []; S.shiftDay = absDay();
  for (const w of S.staff) notes.push(startShift(w));
  if (levelInfo(S.xp).L >= STAFF_LEVEL) { rollApplicants(); if (S.staff.length < STAFF_MAX) notes.push('👷 Ada 3 pelamar kerja baru hari ini — lihat di tombol Karyawan.'); }
  return notes;
}
function hireStaff(i) {
  const a = S.applicants[i];
  if (!a || S.staff.length >= STAFF_MAX || levelInfo(S.xp).L < STAFF_LEVEL) return false;
  const fee = a.wage * HIRE_FEE;
  if (S.gold < fee) return false;
  cash(-fee, 'gaji');
  S.staff.push({...a});
  S.applicants.splice(i, 1);
  // langsung mulai bekerja hari ini (sebelum panel digambar ulang), atau besok bila jam kerja sudah lewat
  const note = S.time < workEnd(a) - 60 ? startShift(S.staff[S.staff.length - 1]).replace(/<[^>]+>/g, '')
    : `${STAFF[a.job].icon} ${a.name} bergabung! Mulai bekerja besok pagi (jam kerja 06:00–${fmtTime(workEnd(a))}).`;
  setTimeout(() => msg(note), 0);
  emit('coin'); return true;
}
function fireStaff(i) { const w = S.staff[i]; S.staff.splice(i, 1); if (w) S.shift = S.shift.filter(o => o.name !== w.name); }
function openStaff() {
  const lv = levelInfo(S.xp);
  const jobInfo = d => `<small>${d.jobs.map(j => '• ' + j).join('<br>')}</small>`;
  if (lv.L < STAFF_LEVEL) {
    let need = lv.need - lv.cur; for (let L = lv.L + 1; L < STAFF_LEVEL; L++) need += xpNeed(L);
    return openModal('👷 Karyawan', `<p>🔒 Lowongan kerja dibuka di <b>Level ${STAFF_LEVEL}</b>.</p><p>Kamu sekarang Level ${lv.L} — butuh <b>${need} XP</b> lagi.</p>
      <p class="muted">XP didapat dari memanen, memetik buah, mengambil hasil ternak, menanam pohon, membeli hewan, membangun kandang, dan membuka wilayah.</p>
      ${Object.values(STAFF).map(d => `<div class="row"><div class="nm">${d.icon} ${d.role}${jobInfo(d)}</div></div>`).join('')}`, [{label: 'Tutup', primary: true}]);
  }
  if (!Array.isArray(S.applicants) || !S.applicants.length && !S.applicantsRolled) { rollApplicants(); S.applicantsRolled = true; }
  const paint = () => {
    const full = S.staff.length >= STAFF_MAX;
    return `<p><b>Karyawan: ${S.staff.length}/${STAFF_MAX}</b>${full ? ' — penuh' : ''}</p>
      <p><b>📋 Pelamar hari ini</b> <span class="muted">(berganti tiap pagi)</span></p>` +
      (S.applicants.length ? S.applicants.map((a, i) => { const fee = a.wage * HIRE_FEE; return cvCard(a,
        `<div class="cvBtn"><span class="muted">Biaya rekrut ${fee} G</span><button class="btn primary" data-hire="${i}" ${full || S.gold < fee ? 'disabled' : ''}>Rekrut</button></div>`); }).join('')
        : '<p class="muted">Pelamar hari ini sudah habis. Besok pagi datang pelamar baru.</p>') +
      `<p><button class="btn" data-reroll="1" ${S.gold < REROLL_PRICE ? 'disabled' : ''}>🔄 Cari pelamar lain (${REROLL_PRICE} G)</button></p>
      <p class="muted">🌾 Petani: ${STAFF.petani.jobs.join(' · ')}<br>🐄 Peternak: ${STAFF.peternak.jobs.join(' · ')}</p>` +
      (S.staff.length ? '<p><b>Tim kamu</b></p>' + S.staff.map((w, i) => {
        const sh = S.shift.find(o => o.name === w.name);
        const today = sh ? (sh.state === 'done' ? 'Sudah pulang 👋' : sh.state === 'idle' ? 'Semua beres, menunggu kerjaan ✔' : 'Sedang bekerja…')
          : w.job === 'petani' && S.season === 3 ? 'Libur musim dingin ❄️'
          : S.time >= workEnd(w) - 60 ? 'Mulai bekerja besok pagi'
          : `Libur: uang kurang untuk gaji ${workerWage(w)} G`;
        return cvCard(w, `<div class="cvBtn"><span class="muted">${today}</span><button class="btn" data-fire="${i}">Berhentikan</button></div>`);
      }).join('') : '');
  };
  openModal('👷 Karyawan', `<div id="staffList">${paint()}</div><p class="muted">Karyawan bekerja setiap pagi setelah kamu tidur. Hasilnya muncul di laporan pagi.</p>`, [{label: 'Tutup', primary: true}]);
  const list = $('staffList');
  list.onclick = e => {
    const h = e.target.closest('[data-hire]'), f = e.target.closest('[data-fire]'), rr = e.target.closest('[data-reroll]');
    if (h) hireStaff(+h.dataset.hire);
    else if (f) { const w = S.staff[+f.dataset.fire]; if (w) { fireStaff(+f.dataset.fire); msg(`${w.name} diberhentikan.`); } }
    else if (rr) { if (S.gold < REROLL_PRICE) return; cash(-REROLL_PRICE, 'gaji'); rollApplicants(); emit('ui'); }
    else return;
    list.innerHTML = paint();
  };
}

/* ================= Hari & waktu ================= */
function rollWeather(season) {
  const p = [0.25, 0.2, 0.25, 0.3][season];
  return Math.random() < p ? (season === 3 ? 'salju' : 'hujan') : 'cerah';
}

function newDay(passedOut = false) {
  const notes = [];
  // tanaman tumbuh bila disiram
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const s = S.soil[y][x];
    if (!s) continue;
    if (s.crop && !s.crop.dead) {
      if (s.watered && s.crop.days < CROPS[s.crop.type].grow) s.crop.days++;
    } else if (!s.crop && !s.watered && Math.random() < 0.1) { S.soil[y][x] = null; continue; }
    s.watered = false;
  }
  // ternak: tiap hewan makan satu porsi dari rumahnya; yang kenyang menghasilkan telur/susu
  const left = {};
  for (const st of S.structures) if (!BUILD[st.kind].deco) left[st.id] = st.food;
  let eggs = 0, milk = 0, hungry = 0, fatPigs = 0;
  for (const a of S.animals) {
    const home = a.home;
    if (a.petToday) a.hearts = Math.min(10, a.hearts + 1);
    a.petToday = false;
    // kenyang bila diberi makan langsung hari ini, atau kebagian porsi dari tempat pakan
    if (a.fed || left[home] > 0) {
      if (!a.fed) left[home]--;
      if (ANIMALS[a.type].grow) { const was = a.grow || 0; a.grow = Math.min(ANIMALS[a.type].grow, was + 1); if (a.grow >= ANIMALS[a.type].grow && was < a.grow) fatPigs++; }
      else if (!a.ready) { a.ready = true; if (a.type === 'ayam') eggs++; else milk++; }
    } else { a.hearts = Math.max(0, a.hearts - 1); hungry++; }
    a.fed = false;
  }
  for (const st of S.structures) if (!BUILD[st.kind].deco) st.food = 0;
  if (eggs) notes.push(`${eggs} ayam bertelur — ketuk ayamnya (atau E) untuk mengambil telur.`);
  if (milk) notes.push(`${milk} hewan lumbung siap diperah — ketuk & geser di atas hewan.`);
  if (fatPigs) notes.push(`🐷 ${fatPigs} babi sudah gemuk! ${S.staff.some(w => w.job === 'peternak') ? 'Peternak akan memotongnya hari ini' : 'Ketuk babinya untuk memotong'} → ${ANIMALS.babi.meat} daging, jual lewat kotak kirim.`);
  if (hungry) notes.push(`${hungry} hewan kelaparan semalam. Isi pakan ayam / jerami lumbung ya.`);
  // pohon buah: bibit tumbuh, pohon dewasa berbuah berkala (istirahat di musim dingin)
  let fruiting = 0;
  if (S.season !== 3) for (const t of Object.values(S.orchard)) {
    const f = FRUITS[t.type];
    if (t.days < f.grow) { t.days++; if (t.days >= f.grow) { t.fruit = true; fruiting++; } }
    else if (!t.fruit && --t.wait <= 0) { t.fruit = true; fruiting++; }
  }
  if (fruiting) notes.push(`${fruiting} pohon buah berbuah — ketuk atau geser untuk memanen.`);
  // bayaran kiriman
  const paid = S.shippedValue;
  if (paid) cash(paid, 'jual'); S.stats.earned += paid;
  S.shippedValue = 0; S.shippedItems = {};
  // kalender
  S.day++;
  if (S.day > SEASON_DAYS) {
    S.day = 1;
    S.season = (S.season + 1) % 4;
    if (S.season === 0) S.year++;
    let died = 0;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const s = S.soil[y][x];
      if (s && s.crop && !s.crop.dead && CROPS[s.crop.type].season !== S.season) { s.crop.dead = true; died++; }
    }
    notes.unshift(`Musim berganti: Musim ${SEASONS[S.season]}!` + (died ? ` ${died} tanaman musim lalu layu.` : ''));
    if (S.season === 3) notes.push('Di musim dingin tidak ada tanaman yang tumbuh. Rawat ternak dan siapkan musim semi.');
    const avail = Object.entries(CROPS).filter(([, d]) => d.season === S.season);
    if (avail.length) S.seedSel = avail[0][0];
  }
  S.weather = S.tomorrow;
  S.tomorrow = rollWeather(S.season);
  if (S.weather === 'hujan') for (const row of S.soil) for (const s of row) if (s) s.watered = true;
  runSprinklers();
  // rumput liar tumbuh
  if (S.season !== 3) {
    let placed = 0;
    for (let i = 0; i < 30 && placed < 3; i++) {
      const x = FIELD.x0 + Math.floor(Math.random() * (FIELD.x1 - FIELD.x0 + 1));
      const y = FIELD.y0 + Math.floor(Math.random() * (FIELD.y1 - FIELD.y0 + 1));
      if (!S.obj[y][x] && !S.soil[y][x] && !structAtTile(x, y)) { S.obj[y][x] = 'weed'; placed++; }
    }
  }
  rollMarket();
  {
    const moves = marketKeys().filter(k => !k.startsWith('c:') || CROPS[k.slice(2)].season === S.season).map(k => [k, mkt(k)]).sort((a, b) => b[1] - a[1]);
    const up = moves.filter(([, m]) => m >= 1.5).slice(0, 3).map(([k, m]) => `${marketName(k)} ${fmtX(m)} (${marketPrice(k)} G)`);
    const dn = moves.filter(([, m]) => m < 0.85).slice(-3).map(([k, m]) => `${marketName(k)} ${fmtX(m)} (${marketPrice(k)} G)`);
    notes.push(`📈 Harga pasar berubah.${up.length ? ` Naik: ${up.join(', ')}.` : ''}${dn.length ? ` Turun: ${dn.join(', ')}.` : ''}`);
  }
  notes.push(...staffWork());
  S.time = DAY_START;
  S.stamina = passedOut ? Math.floor(MAX_STAMINA / 2) : MAX_STAMINA;
  S.player.x = START.x; S.player.y = START.y; S.player.dir = 'down';
  R.acc = 0; R.drops = []; R.particles = []; R.stumpHits = {};
  const saved = save();
  emit(passedOut ? 'faint' : 'day');
  return {paid, notes, passedOut, saved};
}

const WX = {cerah: 'Cerah ☀', hujan: 'Hujan ☂', salju: 'Salju ❄'};

function showMorning(res) {
  const lines = [];
  if (res.passedOut) lines.push('<p>Kamu pingsan karena bekerja lewat tengah malam... Tenagamu hanya pulih setengah.</p>');
  lines.push(`<p><b>Musim ${SEASONS[S.season]}, Hari ${S.day}</b> · Tahun ${S.year}</p>`);
  lines.push(`<p>Hasil kiriman kemarin: <b>${res.paid} G</b></p>`);
  lines.push(`<p>Cuaca hari ini: ${WX[S.weather]}${S.weather === 'hujan' ? ' — ladang tersiram otomatis.' : ''}<br><span class="muted">Ramalan besok: ${WX[S.tomorrow]}</span></p>`);
  for (const n of res.notes) lines.push(`<p>${n}</p>`);
  lines.push(res.saved ? '<p class="muted">Permainan tersimpan.</p>' : '<p class="muted">Gagal menyimpan — penyimpanan browser tidak tersedia.</p>');
  openModal('Selamat pagi!', lines.join(''), [{label: 'Mulai hari', primary: true}]);
}

function askSleep() {
  openModal('Rumah', `<p>Tidur sekarang? Hari akan berganti dan permainan disimpan.</p><p class="muted">Ramalan besok: ${WX[S.tomorrow]}</p>`, [
    {label: 'Batal'},
    {label: 'Tidur', primary: true, fn: () => { const res = newDay(false); setTimeout(() => showMorning(res), 0); }},
  ]);
}

/* ================= Toko, kirim, tas ================= */
function openShop() {
  const render = () => {
    const seeds = Object.entries(CROPS).filter(([, d]) => d.season === S.season);
    const rows = seeds.map(([id, d]) => `<div class="row"><div class="nm">Benih ${d.name}<small>${d.grow} hari${d.regrow ? `, berbuah lagi tiap ${d.regrow} hari` : ''} · jual ${marketPrice('c:' + id)} G ${trendTag('c:' + id)} · punya ${S.inv.seeds[id] || 0}</small></div><span>${d.seed} G</span>
      <button class="btn" data-buy="${id}" data-n="1" ${S.gold < d.seed ? 'disabled' : ''}>+1</button>
      <button class="btn" data-buy="${id}" data-n="5" ${S.gold < d.seed * 5 ? 'disabled' : ''}>+5</button></div>`);
    if (!seeds.length) rows.push('<p class="muted">Tidak ada benih di musim dingin.</p>');
    rows.push('<h3 class="shop-h">Pakan</h3>');
    for (const [id, nm, price, note] of [['pakan', 'Pakan ayam', FEED_PRICE, '1 porsi per ayam per hari'], ['jerami', 'Jerami', HAY_PRICE, '1 porsi per sapi/kambing per hari']])
      rows.push(`<div class="row"><div class="nm">${nm}<small>${note} · punya ${S.inv[id]}</small></div><span>${price} G</span>
        <button class="btn" data-buy="${id}" data-n="1" ${S.gold < price ? 'disabled' : ''}>+1</button>
        <button class="btn" data-buy="${id}" data-n="5" ${S.gold < price * 5 ? 'disabled' : ''}>+5</button></div>`);
    rows.push('<h3 class="shop-h">Bibit pohon buah</h3>');
    for (const [id, f] of Object.entries(FRUITS))
      rows.push(`<div class="row"><div class="nm">Bibit ${f.name}<small>berbuah ${f.grow} hari, lalu tiap ${f.regrow} hari · ${FRUIT_YIELD} buah × ${f.sell} G · punya ${S.inv.bibit[id] || 0}</small></div><span>${f.price} G</span>
        <button class="btn" data-buy="bibit:${id}" data-n="1" ${S.gold < f.price ? 'disabled' : ''}>+1</button></div>`);
    rows.push('<h3 class="shop-h">Hewan ternak</h3>');
    for (const [id, d] of Object.entries(ANIMALS)) {
      const full = homeCount(d.home) >= homeCap(d.home);
      rows.push(`<div class="row"><div class="nm">${d.name}<small>${d.home === 'kandang' ? 'tinggal di kandang ayam · bertelur' : d.grow ? `tinggal di lumbung · dibesarkan ${d.grow} hari lalu dipotong` : 'tinggal di lumbung · diperah susunya'} · ${d.grow ? `${d.meat} daging × ${GOODS.truffle.sell} G` : `hasil ${GOODS[d.product].sell} G`} · ${homeCount(d.home)}/${homeCap(d.home)}${full ? ' · <b>penuh — bangun ' + (d.home === 'kandang' ? 'kandang' : 'lumbung') + ' baru (🔨)</b>' : ''}</small></div><span>${d.price} G</span>
        <button class="btn" data-buy="hewan:${id}" data-n="1" ${S.gold < d.price || full ? 'disabled' : ''}>Beli</button></div>`);
    }
    return `<p class="muted">"Selamat datang! Benih segar untuk Musim ${SEASONS[S.season]}." · Uangmu: <b>${S.gold} G</b></p>` + rows.join('');
  };
  openModal('Toko Benih & Ternak', render(), [{label: 'Tutup', primary: true}]);
  const body = $('mBody');
  body.onclick = e => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const id = b.dataset.buy, n = +b.dataset.n;
    if (id.startsWith('bibit:')) {
      const f = FRUITS[id.slice(6)];
      if (!f || S.gold < f.price) return;
      cash(-f.price, 'bibit'); emit('coin');
      S.inv.bibit[id.slice(6)] = (S.inv.bibit[id.slice(6)] || 0) + 1;
      msg('Bibit dibeli. Ketuk petak kosong mana saja untuk menanamnya.');
    } else if (id.startsWith('hewan:')) {
      const type = id.slice(6);
      if (!buyAnimal(type)) return;
    } else {
      const price = id === 'pakan' ? FEED_PRICE : id === 'jerami' ? HAY_PRICE : CROPS[id].seed;
      if (S.gold < price * n) return;
      cash(-price * n, id === 'pakan' || id === 'jerami' ? 'pakan' : 'benih'); emit('coin');
      if (id === 'pakan' || id === 'jerami') S.inv[id] += n; else { S.inv.seeds[id] = (S.inv.seeds[id] || 0) + n; S.seedSel = id; }
    }
    body.innerHTML = render();
    refreshHotbar();
    const again = body.querySelector(`[data-buy="${id}"][data-n="${n}"]`);
    (again && !again.disabled ? again : $('mBtns').querySelector('button')).focus();
  };
}

function buyAnimal(type) {
  const d = ANIMALS[type];
  const st = d && S.structures.find(x => x.kind === d.home && residents(x).length < BUILD[x.kind].cap);
  if (!d || !st || S.gold < d.price) return false;
  cash(-d.price, 'hewan'); emit('coin');
  const used = new Set(S.animals.map(a => a.name));
  const name = d.names.find(n => !used.has(n)) || d.name + ' ' + S.nextId;
  const pos = spawnIn(st, type);
  S.animals.push({id: S.nextId++, type, name, home: st.id, x: pos.x, y: pos.y, hearts: 0, petToday: false, ready: false, fed: false});
  addXp(5);
  msg(`${name} si ${d.name.toLowerCase()} sudah tiba di ${d.home === 'kandang' ? 'kandang ayam' : 'lumbung'}!`);
  return true;
}

/* ---------- harga pasar naik-turun dengan pengali (×): tiap pagi naik/turun satu tingkat, maksimal ×3 ---------- */
const MKT_STEPS = [0.7, 0.8, 0.9, 1, 1.25, 1.5, 2, 2.5, 3];
const fmtX = m => '×' + m.toLocaleString('id-ID');
const MKT_GOODS = ['telur', 'susu', 'susuK', 'truffle', 'kayu'];
const marketKeys = () => [...Object.keys(CROPS).map(i => 'c:' + i), ...Object.keys(FRUITS).map(i => 'b:' + i), ...MKT_GOODS.map(i => 'g:' + i)];
const mkt = key => S.market && isNum(S.market[key]) ? S.market[key] : 1;
const basePrice = key => { const [k, id] = key.split(':'); return k === 'c' ? CROPS[id].sell : k === 'b' ? FRUITS[id].sell : GOODS[id].sell; };
const marketPrice = key => Math.max(1, Math.round(basePrice(key) * mkt(key)));
const marketName = key => { const [k, id] = key.split(':'); return k === 'c' ? CROPS[id].name : k === 'b' ? FRUITS[id].name : GOODS[id].name; };
const trendTag = key => { const m = mkt(key); return m > 1 ? `<span class="up">▲ ${fmtX(m)}</span>` : m < 1 ? `<span class="down">▼ ${fmtX(m)}</span>` : '<span class="muted">• normal</span>'; };
const stepOf = m => MKT_STEPS.reduce((bi, v, i) => Math.abs(v - m) < Math.abs(MKT_STEPS[bi] - m) ? i : bi, 3);
function rollMarket() {
  S.market = S.market || {};
  for (const k of marketKeys()) {
    const r = Math.random(), i = stepOf(mkt(k));
    let move = r < 0.05 ? 2 : r < 0.38 ? 1 : r < 0.62 ? 0 : r < 0.95 ? -1 : -2;   // sesekali melonjak/anjlok 2 tingkat
    if ((i >= 6 && move >= 0 || i <= 1 && move <= 0) && Math.random() < 0.6) move = i >= 6 ? -1 : 1;   // harga ekstrem cenderung kembali normal
    S.market[k] = MKT_STEPS[clamp(i + move, 0, MKT_STEPS.length - 1)];
  }
}
function sellables() {
  const list = [];
  for (const [id, n] of Object.entries(S.inv.crops)) if (n > 0) list.push({key: 'c:' + id, name: CROPS[id].name, n, price: marketPrice('c:' + id)});
  for (const [id, n] of Object.entries(S.inv.buah)) if (n > 0) list.push({key: 'b:' + id, name: FRUITS[id].name, n, price: marketPrice('b:' + id)});
  for (const id of MKT_GOODS) if (S.inv[id] > 0) list.push({key: 'g:' + id, name: GOODS[id].name, n: S.inv[id], price: marketPrice('g:' + id)});
  return list;
}
// kirim sebagian barang: n buah dari satu jenis (uang dibayar besok pagi, memakai harga pasar hari ini)
function shipItem(key, n) {
  const it = sellables().find(x => x.key === key);
  if (!it) return 0;
  n = Math.min(it.n, Math.max(1, n | 0));
  const [kind, id] = key.split(':'), total = n * it.price;
  if (kind === 'c') S.inv.crops[id] -= n; else if (kind === 'b') S.inv.buah[id] -= n; else S.inv[id] -= n;
  S.shippedItems[it.name] = (S.shippedItems[it.name] || 0) + n;
  S.shippedValue += total;
  if (total) emit('ship');
  return total;
}
function shipAll(filter) {
  let total = 0;
  for (const it of sellables()) if (!filter || filter(it)) total += shipItem(it.key, it.n);
  return total;
}
function openShip() {
  const paint = () => {
    const list = sellables();
    const already = Object.entries(S.shippedItems).map(([n, k]) => `${esc(n)} ×${k}`).join(', ');
    let html = list.length
      ? list.map(it => `<div class="row"><div class="nm">${it.name} ×${it.n}<small>${it.price} G/buah · ${trendTag(it.key)}</small></div>
          <span>${(it.n * it.price).toLocaleString('id-ID')} G</span>
          <button class="btn" data-ship="${it.key}" data-n="1">Kirim 1</button><button class="btn${mkt(it.key) >= 1 ? ' primary' : ''}" data-ship="${it.key}" data-n="${it.n}">Kirim semua</button></div>`).join('')
      : '<p class="muted">Tasmu tidak berisi hasil panen untuk dikirim.</p>';
    if (list.length) {
      const up = list.filter(it => mkt(it.key) > 1);
      html += `<p class="shipAll"><button class="btn primary" data-shipup="1" ${up.length ? '' : 'disabled'}>▲ Kirim yang harganya naik (${up.reduce((a, it) => a + it.n * it.price, 0).toLocaleString('id-ID')} G)</button>
        <button class="btn" data-shipall="1">Kirim semua (${list.reduce((a, it) => a + it.n * it.price, 0).toLocaleString('id-ID')} G)</button></p>`;
    }
    if (already) html += `<p class="muted">Sudah dikirim hari ini: ${already} (${S.shippedValue.toLocaleString('id-ID')} G)</p>`;
    html += '<p class="muted">Pilih barang yang mau dikirim — simpan yang harganya ▼ turun sampai harganya naik. Uang dibayar besok pagi. Harga pasar berubah setiap pagi (bisa naik sampai ×3).</p>';
    const show = marketKeys().filter(k => !k.startsWith('c:') || CROPS[k.slice(2)].season === S.season);
    html += `<details class="mkt"><summary>📈 Harga pasar hari ini</summary>${show.map(k => `<div class="row"><div class="nm">${marketName(k)}<small>normal ${basePrice(k)} G</small></div><span>${marketPrice(k)} G ${trendTag(k)}</span></div>`).join('')}</details>`;
    return html;
  };
  openModal('Kotak Kirim', `<div id="shipList">${paint()}</div>`, [{label: 'Tutup', primary: true}]);
  const box = $('shipList');
  box.onclick = e => {
    const one = e.target.closest('[data-ship]'), up = e.target.closest('[data-shipup]'), all = e.target.closest('[data-shipall]');
    let t = 0;
    if (one) t = shipItem(one.dataset.ship, +one.dataset.n);
    else if (up) t = shipAll(it => mkt(it.key) > 1);
    else if (all) t = shipAll();
    else return;
    if (t) msg(`Dikirim ${t.toLocaleString('id-ID')} G — dibayar besok pagi.`);
    box.innerHTML = paint();
  };
}

function openBag() {
  const cells = [];
  for (const [id, n] of Object.entries(S.inv.seeds)) if (n > 0) cells.push(`<div class="cell">Benih ${CROPS[id].name}<b>${n}</b></div>`);
  for (const [id, n] of Object.entries(S.inv.crops)) if (n > 0) cells.push(`<div class="cell">${CROPS[id].name}<b>${n}</b></div>`);
  for (const [id, nm] of [['telur', 'Telur'], ['susu', 'Susu Sapi'], ['susuK', 'Susu Kambing'], ['truffle', 'Daging Babi'], ['kayu', 'Kayu'], ['pakan', 'Pakan ayam'], ['jerami', 'Jerami']])
    if (S.inv[id]) cells.push(`<div class="cell">${nm}<b>${S.inv[id]}</b></div>`);
  for (const [id, n] of Object.entries(S.inv.buah)) if (n > 0) cells.push(`<div class="cell">${FRUITS[id].name}<b>${n}</b></div>`);
  for (const [id, n] of Object.entries(S.inv.bibit)) if (n > 0) cells.push(`<div class="cell">Bibit ${FRUITS[id].name}<b>${n}</b></div>`);
  const pets = S.animals.map(a => `<div class="row"><div class="nm">${esc(a.name)}<small>${ANIMALS[a.type].name}${a.type !== 'ayam' && a.ready ? ' · siap diperah' : ''}</small></div><span class="hearts">${heartsTxt(a.hearts)}</span></div>`).join('');
  openModal('Tas', `<div class="grid">${cells.join('') || '<span class="muted">Kosong.</span>'}</div>
    <p><b>Ternak</b></p>${pets || '<p class="muted">Belum punya hewan.</p>'}
    <p class="muted">Total panen: ${S.stats.harvested} · Total pendapatan: ${S.stats.earned} G</p>`, [{label: 'Tutup', primary: true}]);
}

function openMenu() {
  openModal('Menu', `<p><b>Kontrol</b><br>WASD/Panah: jalan · Spasi/J: pakai alat · E/K: periksa, panen, buka pintu<br>1–8 atau Q: ganti alat · R: ganti jenis benih · I: tas<br>V: ganti kamera (atas, dekat, mata petani) · M: suara & getar</p>
    <p><b>Mode 5D</b><br>3D + suara (D4) + getar HP & guncangan layar (D5). Di kamera mata petani: ▲ maju, ▼ mundur, ◀ ▶ belok.</p>
    <p><b>Tips</b><br>• Ladang ada di tengah. Bersihkan rumput (Sabit), batu (Palu), tunggul & pohon (Kapak).<br>• Siram tiap hari; isi Penyiram di kolam (kanan atas).<br>• Kirim panen di kotak kayu samping rumah, uang dibayar esok pagi.<br>• Toko benih (kanan bawah) buka 09:00–17:00.<br>• Ternak: beli ayam, kambing, sapi, babi di toko. Ayam bertelur, sapi & kambing diperah susunya, babi dibesarkan 6 hari lalu dipotong jadi 10 daging — jual dagingnya lewat kotak kirim seperti susu. Elus setiap hari (E) agar hatinya naik.<br>• Isi pakan ayam (samping kandang) dan jerami (kanan lumbung) — 1 porsi per hewan. Jerami gratis dari rumput liar yang disabit.<br>• Pagi harinya ambil telur, dan perah sapi/kambing dengan Pemerah (7).<br>• <b>Ketuk & geser:</b> ketuk bedeng kosong → pilih benih → geser ke banyak petak. Geser di atas tanaman matang untuk panen. Pilih Penyiram/Cangkul lalu geser untuk menyiram/mencangkul banyak petak. Ketuk hewan lapar lalu geser ke hewan lain untuk memberi makan; ketuk hewan bergelembung untuk mengambil telur/susu.<br>• Tidur sebelum tengah malam!</p>`,
    [{label: 'Ke layar judul', fn: () => { R.running = false; showTitle(); }}, {label: '💰 Keuangan', fn: () => setTimeout(openFinance, 0)}, {label: 'Lanjut', primary: true}]);
  const body = $('mBody'), chr = document.createElement('p');
  chr.innerHTML = `<b>Karakter</b><br><button class="btn gfx${R.noChar ? ' primary' : ''}" data-chr="0">Sembunyikan (ala Hay Day)</button> <button class="btn gfx${R.noChar ? '' : ' primary'}" data-chr="1">Tampilkan petani</button>`;
  body.prepend(chr);
  chr.onclick = e => { const b = e.target.closest('[data-chr]'); if (!b) return; setNoChar(b.dataset.chr === '0', true); closeModal(); msg(R.noChar ? 'Mode tanpa karakter: geser layar untuk melihat sekitar, ketuk untuk bertani.' : 'Petani ditampilkan lagi.'); };
  if (!RND.qualityInfo) return;
  const box = document.createElement('div');
  const paint = () => {
    const q = RND.qualityInfo();
    box.innerHTML = `<p><b>Grafik</b> <span class="muted">${q.fps ? '· ' + q.fps + ' fps' : ''}</span><br>` +
      [['auto', 'Otomatis']].concat(q.levels.map((n, i) => [String(i), n])).map(([v, n]) =>
        `<button class="btn gfx${(v === 'auto' ? q.mode === 'auto' : q.mode !== 'auto' && +v === q.level) ? ' primary' : ''}" data-gfx="${v}">${n}</button>`).join(' ') +
      `<br><span class="muted">Sekarang: ${q.levels[q.level]}. <b>HD</b> untuk laptop & HP kuat (layar tajam penuh, bayangan 4K, rumput 1,5× lebih lebat). Pilih lebih rendah bila terasa patah-patah (laptop tanpa kartu grafik, layar Retina, atau sambil merekam layar).</span></p>`;
  };
  paint(); body.prepend(box);
  body.onclick = e => { const b = e.target.closest('[data-gfx]'); if (b) { RND.setQuality(b.dataset.gfx === 'auto' ? 'auto' : +b.dataset.gfx); paint(); } };
}

/* ================= Dialog ================= */
let modalReturnFocus = null;
// Tap/tekan yang membuka dialog tidak boleh langsung menekan tombolnya.
const modalFresh = () => performance.now() - (R.modalAt || 0) < 350;
function openModal(title, html, buttons) {
  endDrag(); hideSeedPop();
  R.modal = true;
  emit('ui');
  for (const k in R.keys) R.keys[k] = false;
  $('mTitle').textContent = title;
  const body = $('mBody');
  body.innerHTML = html; body.onclick = null;
  const bx = $('mBtns'); bx.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : '');
    el.textContent = b.label;
    el.onclick = () => { if (modalFresh()) return; closeModal(); if (b.fn) b.fn(); };
    bx.append(el);
  }
  $('modal').hidden = false;
  R.modalAt = performance.now();
  modalReturnFocus = document.activeElement;
  (bx.querySelector('.primary') || bx.querySelector('button')).focus();
}
function closeModal() {
  $('modal').hidden = true;
  R.modal = false;
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.blur?.();
}

/* ================= Piksel bersama (tanah, ikon) ================= */
let g = null;
function r(x, y, w, h, c) { if (c) g.fillStyle = c; g.fillRect(x, y, w, h); }

function drawGround(tx, ty, sx, sy) {
  const t = S.ground[ty][tx];
  if (t === 'grass') {
    r(sx, sy, 16, 16, PAL.grass);
    for (let k = 0; k < 3; k++) {
      const px = sx + Math.floor(h2(tx, ty, k + 1) * 14), py = sy + Math.floor(h2(tx, ty, k + 11) * 13);
      r(px, py, 1, 2, PAL.tuft); r(px + 1, py + 1, 1, 2, PAL.tuft);
    }
    if (h2(tx, ty, 5) < 0.3) r(sx + Math.floor(h2(tx, ty, 6) * 13), sy + Math.floor(h2(tx, ty, 7) * 13), 2, 1, PAL.grassHi);
    const f = h2(tx, ty, 9);
    if (f < 0.05) { const fx = sx + 4 + Math.floor(f * 120), fy = sy + 6; r(fx, fy, 3, 1, f < 0.025 ? '#fff' : '#ffd84a'); r(fx + 1, fy - 1, 1, 3); r(fx + 1, fy, 1, 1, '#e0902a'); }
  } else if (t === 'path') {
    r(sx, sy, 16, 16, PAL.path);
    for (let k = 0; k < 3; k++) r(sx + Math.floor(h2(tx, ty, k + 21) * 14), sy + Math.floor(h2(tx, ty, k + 31) * 14), 2, 1, PAL.pebble);
    r(sx + Math.floor(h2(tx, ty, 41) * 13), sy + Math.floor(h2(tx, ty, 42) * 13), 2, 1, PAL.pathHi);
  } else if (t === 'field') {
    r(sx, sy, 16, 16, PAL.field);
    for (let k = 0; k < 4; k++) r(sx + Math.floor(h2(tx, ty, k + 51) * 15), sy + Math.floor(h2(tx, ty, k + 61) * 15), 1, 1, k % 2 ? PAL.fieldDk : PAL.fieldHi);
  } else if (t === 'water') {
    r(sx, sy, 16, 16, PAL.water);
    if (ty > 0 && S.ground[ty - 1][tx] !== 'water') { r(sx, sy, 16, 3, PAL.waterDk); r(sx, sy, 16, 1, '#6d5a3a'); }
    if (tx > 0 && S.ground[ty][tx - 1] !== 'water') r(sx, sy, 1, 16, '#6d5a3a');
    if (tx < MW - 1 && S.ground[ty][tx + 1] !== 'water') r(sx + 15, sy, 1, 16, '#6d5a3a');
    if (ty < MH - 1 && S.ground[ty + 1][tx] !== 'water') r(sx, sy + 15, 16, 1, '#6d5a3a');
    const ph = Math.sin(R.t * 1.6 + tx * 1.3 + ty * 0.7);
    r(sx + 3 + Math.round(ph * 2), sy + 6 + Math.floor(h2(tx, ty, 71) * 6), 4, 1, PAL.waterHi);
    if (h2(tx, ty, 72) < 0.5) r(sx + 9 - Math.round(ph * 2), sy + 11, 3, 1, PAL.waterHi);
  }
}

function drawSoil(s, sx, sy) {
  const wet = s.watered;
  r(sx + 1, sy + 1, 14, 14, wet ? PAL.wet : PAL.tilled);
  const fc = wet ? PAL.wetFurrow : PAL.furrow;
  r(sx + 2, sy + 4, 12, 1, fc); r(sx + 2, sy + 8, 12, 1, fc); r(sx + 2, sy + 12, 12, 1, fc);
  if (wet) { r(sx + 4, sy + 6, 1, 1, '#6a4a30'); r(sx + 10, sy + 10, 1, 1, '#6a4a30'); }
}

function night() { const t = S.time; return t < 1020 ? 0 : t < 1140 ? (t - 1020) / 120 * 0.25 : Math.min(0.55, 0.25 + (t - 1140) / 120 * 0.3); }

function drawHeart(x, y, c) { r(x - 2, y, 2, 2, c); r(x + 1, y, 2, 2); r(x - 2, y + 1, 5, 2); r(x - 1, y + 3, 3, 1); r(x, y + 4, 1, 1); }

// ikon alat 16x16 (dipakai di hotbar & saat mengayun)
function drawToolIcon(id, cropId) {
  const handle = (x, y, n) => { for (let i = 0; i < n; i++) r(x + i, y - i, 2, 2, '#8a5a2b'); };
  switch (id) {
    case 'cangkul': handle(2, 13, 9); r(9, 2, 6, 3, '#9aa3ad'); r(13, 2, 2, 6); r(13, 7, 2, 1, '#5d6570'); r(9, 2, 6, 1, '#d5dbe1'); break;
    case 'penyiram':
      r(3, 6, 9, 7, '#5b9bd5'); r(4, 5, 7, 1, '#7fb6e8'); r(12, 7, 2, 2); r(13, 5, 2, 2, '#5b9bd5'); r(14, 4, 2, 1, '#3a6e9e');
      r(5, 2, 5, 1, '#3a6e9e'); r(5, 2, 1, 3); r(9, 2, 1, 3); r(3, 12, 9, 1, '#3a6e9e'); r(4, 7, 2, 3, '#a8d0f0'); break;
    case 'sabit': r(4, 9, 2, 6, '#8a5a2b'); r(4, 7, 3, 2, '#c0c8d0'); r(6, 4, 3, 3); r(8, 3, 5, 2); r(12, 4, 2, 3); r(13, 6, 1, 2, '#d5dbe1'); r(6, 6, 1, 1, '#8a929c'); break;
    case 'palu': handle(3, 13, 7); r(7, 2, 8, 5, '#7d858f'); r(7, 2, 8, 1, '#aab2bb'); r(7, 6, 8, 1, '#5d6570'); break;
    case 'kapak': handle(3, 13, 8); r(9, 2, 4, 7, '#9aa3ad'); r(12, 1, 3, 9, '#d5dbe1'); r(9, 8, 4, 1, '#5d6570'); break;
    case 'benih': {
      const c = CROPS[cropId || (S ? S.seedSel : 'lobak')];
      r(3, 5, 10, 10, '#c9a46a'); r(3, 14, 10, 1, '#a07c45'); r(5, 3, 6, 2, '#a07c45'); r(6, 4, 4, 1, '#7a5a2a');
      r(6, 8, 4, 4, c.color); r(6, 8, 4, 1, c.accent); r(4, 6, 1, 7, '#dcbc84'); break;
    }
    case 'pemerah':   // ember susu
      r(5, 2, 6, 1, '#7d858f'); r(4, 3, 1, 3); r(11, 3, 1, 3);
      r(3, 6, 10, 2, '#9aa3ad'); r(4, 8, 8, 6, '#c0c8d0'); r(5, 14, 6, 1, '#7d858f');
      r(4, 6, 8, 1, '#ffffff'); r(5, 9, 1, 4, '#e6ebf0'); break;
    case 'tangan':
      r(4, 7, 8, 7, '#f2c49b'); r(4, 3, 2, 5); r(6, 2, 2, 6); r(8, 2, 2, 6); r(10, 3, 2, 5); r(2, 8, 2, 3);
      r(4, 13, 8, 1, '#b07a52'); r(6, 2, 1, 1, '#ffe0c0'); r(8, 2, 1, 1); break;
  }
}

// gelembung di atas hewan: hasil siap diambil, atau lapar (gaya game bertani kasual)
function animalBubble(a) {
  if (!animalsVisible()) return null;
  if (a.ready) return ANIMALS[a.type].product;
  if (pigGrown(a)) return 'truffle';   // babi gemuk: siap dijual
  if (!a.fed && !troughCovers(a)) return 'lapar';
  return null;
}
// sisa waktu panen dalam detik dunia nyata: sisa hari ini sampai tengah malam + hari berikutnya
// (tanaman tumbuh saat pergantian hari, dengan anggapan disiram tiap hari; tidur mempercepat)
function realSecondsDays(left) {
  if (left <= 0) return 0;
  return ((DAY_END - S.time) + (left - 1) * (DAY_END - DAY_START)) * MIN_MS / 1000 - R.acc / 1000;
}
const realSecondsLeft = cr => realSecondsDays(CROPS[cr.type].grow - cr.days);
// 492 → "8:12", 3725 → "1:02:05"
function fmtReal(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), ss = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// indikator panen di atas tanaman: bilah kemajuan + hitung mundur waktu nyata, tetes air bila belum disiram, "Panen!" bila matang
function drawCropBadge(ctx, x, y, cr, watered, k) {
  const d = cr._grow ? {grow: cr._grow} : CROPS[cr.type], ready = cr.days >= d.grow;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.font = '600 9px Fredoka, ui-rounded, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const pill = (w, fill) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -6, w, 12, 6) : ctx.rect(-w / 2, -6, w, 12); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 1.2; ctx.stroke(); };
  if (ready) {
    pill(40, '#ffd25a');
    ctx.fillStyle = '#4a2a10'; ctx.fillText('Panen!', 0, 0.5);
  } else {
    const pct = Math.floor(cr.days / d.grow * 100), label = '⏱ ' + fmtReal(cr._secs ?? realSecondsLeft(cr));
    const w = Math.max(50, ctx.measureText(label).width + 12);
    pill(w, 'rgba(255,248,230,.95)');
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 1, -5, (w - 2) * pct / 100, 10); ctx.clip();
    pill(w, '#8fd36a'); ctx.restore();
    ctx.fillStyle = '#2b1a0a'; ctx.fillText(label, 0, 0.5);
    if (!watered) {   // belum disiram: tetes air di kiri bilah
      ctx.translate(-w / 2 - 7, 0);
      ctx.fillStyle = '#4aa8ff'; ctx.strokeStyle = '#1d5e9a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(5, 1, 0, 5); ctx.quadraticCurveTo(-5, 1, 0, -6); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawFruitBadge(ctx, x, y, t, k) {
  if (S.season === 3 && !t.fruit) return;
  const f = FRUITS[t.type], grow = t.days < f.grow;
  const total = grow ? f.grow : f.regrow, done = grow ? t.days : f.regrow - Math.max(1, t.wait);
  drawCropBadge(ctx, x, y, {type: '_fruit', days: t.fruit ? 1 : done / total, _grow: 1, _secs: realSecondsDays(fruitDaysLeft(t))}, true, k);
}
function drawBubble(ctx, x, y, kind, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, -9, 8, 0, Math.PI * 2); ctx.moveTo(-3, -2); ctx.lineTo(0, 3); ctx.lineTo(3, -2); ctx.fill(); ctx.stroke();
  if (kind === 'telur') { ctx.fillStyle = '#fff2d6'; ctx.strokeStyle = '#c9a46a'; ctx.beginPath(); ctx.ellipse(0, -9, 3.6, 4.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  else if (kind === 'truffle') {   // daging babi (paha dengan tulang)
    ctx.fillStyle = '#f4efe6'; ctx.strokeStyle = '#a89a86'; ctx.beginPath(); ctx.arc(3.6, -5.6, 1.5, 0, Math.PI * 2); ctx.arc(5, -4.4, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(1.4, -7.4, 3, 1.6);
    ctx.fillStyle = '#d9534f'; ctx.strokeStyle = '#8a2a26'; ctx.beginPath(); ctx.ellipse(-1, -10.5, 4.6, 3.6, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2a0a0'; ctx.beginPath(); ctx.ellipse(-2, -11.5, 1.8, 1.1, -0.6, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'susu' || kind === 'susuK') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7d9fb8'; ctx.beginPath(); ctx.rect(-3, -12, 6, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = kind === 'susu' ? '#3f7fd0' : '#d08a3f'; ctx.fillRect(-2, -15, 4, 3);
  } else { ctx.strokeStyle = '#d9a720'; ctx.lineWidth = 1.6; for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(dx * 0.6, -4); ctx.lineTo(dx, -14); ctx.stroke(); } }
  ctx.restore();
}

/* ================= Update ================= */
function update(dt) {
  R.t += dt;
  // waktu
  R.acc += dt * 1000;
  while (R.acc >= MIN_MS) {
    R.acc -= MIN_MS;
    S.time++;
    if (S.time === SHOP_CLOSE - 60) msg('Toko benih tutup satu jam lagi.');
    if (S.time === 1320) msg('Sudah larut. Sebaiknya segera pulang dan tidur.');
    if (S.time >= DAY_END) {
      const res = newDay(true);
      showMorning(res);
      return;
    }
  }
  staffTick(dt);
  // gerak petani (atau geser kamera di mode tanpa karakter)
  const p = S.player, k = R.keys;
  if (R.noChar) {
    const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (dx || dy) panBy(dx * 150 * dt * R.zoom, dy * 150 * dt * R.zoom);
    R.moving = false; if (R.swing > 0) R.swing -= dt;
  } else if (R.swing > 0) { R.swing -= dt; R.moving = false; }
  else {
    let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (R.pov) {   // mata petani: ▲ maju, ▼ mundur searah pandangan; belok lewat turn()
      const f = (k.up ? 1 : 0) - (k.down ? 1 : 0);
      [dx, dy] = DIRV[p.dir].map(v => v * f);
    }
    R.moving = dx !== 0 || dy !== 0;
    if (R.moving && R.pov) {
      const sp = (S.stamina <= 0 ? 40 : 64) * dt;
      const nx = p.x + dx * sp, ny = p.y + dy * sp;
      if (!blocked(nx, p.y)) p.x = nx;
      if (!blocked(p.x, ny)) p.y = ny;
    } else if (R.moving) {
      if (dx && !dy) p.dir = dx > 0 ? 'right' : 'left';
      else if (dy && !dx) p.dir = dy > 0 ? 'down' : 'up';
      else {
        const keep = (p.dir === 'right' && dx > 0) || (p.dir === 'left' && dx < 0) || (p.dir === 'down' && dy > 0) || (p.dir === 'up' && dy < 0);
        if (!keep) p.dir = dy > 0 ? 'down' : 'up';
      }
      const sp = (S.stamina <= 0 ? 40 : 64) * dt * (dx && dy ? 0.7071 : 1);
      const nx = p.x + dx * sp, ny = p.y + dy * sp;
      if (!blocked(nx, p.y)) p.x = nx;
      if (!blocked(p.x, ny)) p.y = ny;
    }
    if (R.moving) {
      const before = Math.floor(R.anim * 3.5);
      R.anim += dt;
      if (Math.floor(R.anim * 3.5) !== before) emit('step', S.ground[Math.floor((p.y - 1) / T)]?.[Math.floor(p.x / T)]);
    }
  }
  // ternak berkeliaran di halaman masing-masing, tidak menembus bangunan/benda padat
  if (animalsVisible()) for (const an of S.animals) {
    const def = ANIMALS[an.type], hs = structById(an.home) || S.structures.find(st => st.kind === def.home);
    if (!hs) continue;
    const area = structArea(hs);
    // di luar halamannya (simpanan lama / dipindah): kembalikan langsung, jangan berjalan menembus bangunan
    if (an.x < area.x0 || an.x > area.x1 || an.y < area.y0 || an.y > area.y1 || animalBlocked(an.type, an.x, an.y)) {
      for (let i = 0; i < 20; i++) { Object.assign(an, randomIn(area)); if (!animalBlocked(an.type, an.x, an.y)) break; }
      delete R.ai[an.id];
    }
    const a = R.ai[an.id] || (R.ai[an.id] = {tx: an.x, ty: an.y, wait: Math.random() * 3, flip: false, walk: 0});
    if (a.wait > 0) { a.wait -= dt; continue; }
    const ddx = a.tx - an.x, ddy = a.ty - an.y, d = Math.hypot(ddx, ddy);
    const pick = () => { a.wait = 1.5 + Math.random() * (an.type === 'ayam' ? 3 : 5); const t = randomIn(area); a.tx = t.x; a.ty = t.y; };
    if (d < 1) pick();
    else {
      const sp = Math.min(d, def.speed * dt), nx = an.x + ddx / d * sp, ny = an.y + ddy / d * sp;
      if (animalBlocked(an.type, nx, ny)) { pick(); a.wait = 0.4; continue; }   // terhalang → cari tujuan lain
      an.x = nx; an.y = ny;
      a.flip = ddx < 0; a.walk += dt;
    }
  }
  // partikel
  for (const q of R.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 120) * dt; q.life -= dt; }
  R.particles = R.particles.filter(q => q.life > 0);
  RND.update(dt);
  if (R.msgTimer > 0) { R.msgTimer -= dt; if (R.msgTimer <= 0) $('msg').hidden = true; }
}

/* ================= HUD ================= */
const hud = {};
function setTxt(id, v) { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } }
function updateHUD() {
  setTxt('dateTxt', `${SEASONS[S.season]}, Hari ${S.day} · Th ${S.year}`);
  setTxt('timeTxt', fmtTime(S.time));
  setTxt('wxTxt', WX[S.weather]);
  setTxt('goldTxt', S.gold.toLocaleString('id-ID'));
  const lv = levelInfo(S.xp);
  setTxt('lvlTxt', 'Lv ' + lv.L);
  if (hud.xpPct !== lv.cur / lv.need) { hud.xpPct = lv.cur / lv.need; $('xpFill').style.width = (hud.xpPct * 100).toFixed(1) + '%'; $('lvlBox').title = `${lv.cur}/${lv.need} XP`; }
  const pct = S.stamina / MAX_STAMINA * 100;
  if (hud.st !== S.stamina) {
    hud.st = S.stamina;
    const f = $('stamFill');
    f.style.width = pct + '%';
    f.style.background = pct > 50 ? 'var(--ok)' : pct > 20 ? 'var(--warn)' : 'var(--bad)';
  }
  const key = S.tool + '|' + S.water + '|' + S.seedSel + '|' + (S.inv.seeds[S.seedSel] || 0);
  if (hud.hb !== key) { hud.hb = key; refreshHotbar(); }
}

const slots = [];
function buildHotbar() {
  const hb = $('hotbar'); hb.innerHTML = ''; slots.length = 0;
  TOOLS.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'slot'; b.setAttribute('aria-label', t.name);
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const key = document.createElement('span'); key.className = 'key'; key.textContent = i + 1;
    const sub = document.createElement('span'); sub.className = 'sub';
    b.append(c, key, sub);
    b.addEventListener('click', () => { selectTool(i, true); b.blur(); });
    hb.append(b); slots.push({b, c, sub, t});
  });
}
function refreshHotbar() {
  if (!S) return;
  ensureSeed();   // slot benih selalu menunjukkan benih yang masih ada
  slots.forEach((s, i) => {
    s.b.classList.toggle('on', i === S.tool);
    const ctx = s.c.getContext('2d');
    const icon = RND && RND.toolIcon ? RND.toolIcon(s.t.id, S.seedSel) : null;
    if (icon) {   // mode 3D: ikon model 3D
      if (s.c.width !== 64) { s.c.width = s.c.height = 64; s.c.classList.add('icon3d'); }
      ctx.clearRect(0, 0, 64, 64); ctx.drawImage(icon, 0, 0, 64, 64);
    } else { if (s.c.width !== 16) { s.c.width = s.c.height = 16; s.c.classList.remove('icon3d'); } ctx.clearRect(0, 0, 16, 16); const prev = g; g = ctx; drawToolIcon(s.t.id); g = prev; }
    if (s.t.id === 'penyiram') s.sub.innerHTML = `<span class="wbar"><i style="width:${S.water / CAN_MAX * 100}%"></i></span>`;
    else if (s.t.id === 'benih') s.sub.textContent = '×' + (S.inv.seeds[S.seedSel] || 0);
    else s.sub.textContent = '';
  });
  const t = TOOLS[S.tool];
  $('toolName').textContent = t.id === 'benih' ? `Benih ${CROPS[S.seedSel].name} (${S.inv.seeds[S.seedSel] || 0})` : t.id === 'penyiram' ? `Penyiram ${S.water}/${CAN_MAX}` : t.name;
}
function cycleSeed() {
  const ids = Object.keys(CROPS);
  const owned = ids.filter(id => (S.inv.seeds[id] || 0) > 0);
  const pool = owned.length ? owned : ids.filter(id => CROPS[id].season === S.season);
  if (!pool.length) return;
  S.seedSel = pool[(pool.indexOf(S.seedSel) + 1) % pool.length];
  refreshHotbar();
}
function selectTool(i, fromClick) {
  if (fromClick && i === S.tool && TOOLS[i].id === 'benih') cycleSeed();
  S.tool = i;
  refreshHotbar();
}

/* ================= Input ================= */
const KEYMAP = {ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'};
addEventListener('keydown', e => {
  if (!S || !R.running) return;
  if (R.modal) {
    if (e.code === 'Escape') { e.preventDefault(); closeModal(); }
    else if ((e.code === 'Enter' || e.code === 'Space') && (e.repeat || modalFresh())) e.preventDefault();
    else if (e.code === 'Tab') {
      const f = [...$('modal').querySelectorAll('button:not(:disabled)')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey ? i <= 0 : i === f.length - 1 || i < 0) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const dir = KEYMAP[e.code];
  if (dir) {
    e.preventDefault();
    if (R.pov && (dir === 'left' || dir === 'right')) { if (!e.repeat) turn(dir); return; }
    R.keys[dir] = true; return;
  }
  if (e.repeat) return;
  switch (e.code) {
    case 'Space': case 'KeyJ': case 'KeyC': e.preventDefault(); if (R.noChar) msg('Mode tanpa karakter: ketuk/klik petaknya langsung.'); else useTool(); break;
    case 'KeyE': case 'KeyK': case 'KeyX': case 'Enter': e.preventDefault(); if (R.noChar) msg('Mode tanpa karakter: ketuk/klik petaknya langsung.'); else interact(); break;
    case 'KeyQ': selectTool((S.tool + 1) % TOOLS.length); break;
    case 'KeyR': cycleSeed(); break;
    case 'KeyI': case 'Tab': e.preventDefault(); openBag(); break;
    case 'Escape': if (R.buildMode) closeBuild(); else openMenu(); break;
    case 'KeyB': if (R.buildMode) closeBuild(); else openBuild(); break;
    case 'KeyV': cycleCamera(); break;
    case 'KeyM': toggleSound(); break;
    default:
      if (/^Digit[1-8]$/.test(e.code)) selectTool(+e.code.slice(5) - 1);
  }
});
addEventListener('keyup', e => {
  if (R.modal && (e.code === 'Space' || e.code === 'Enter') && modalFresh()) e.preventDefault();
  const dir = KEYMAP[e.code];
  if (dir) R.keys[dir] = false;
  if (e.key === 'Meta' || e.key === 'Control') for (const k in R.keys) R.keys[k] = false;
});
addEventListener('blur', () => { for (const k in R.keys) R.keys[k] = false; });

document.querySelectorAll('.pad button').forEach(b => {
  const k = b.dataset.k;
  const on = e => {
    e.preventDefault();
    if (R.modal) return;
    if (R.pov && (k === 'left' || k === 'right')) return turn(k);
    b.setPointerCapture?.(e.pointerId); R.keys[k] = true;
  };
  const off = e => { e.preventDefault(); R.keys[k] = false; };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('lostpointercapture', off);
});
$('btnA').addEventListener('pointerdown', e => { e.preventDefault(); useTool(); });
$('btnB').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
$('bagBtn').addEventListener('click', e => { e.currentTarget.blur(); if (!R.modal) openBag(); });
$('menuBtn').addEventListener('click', e => { e.currentTarget.blur(); if (!R.modal) openMenu(); });
$('camBtn').addEventListener('click', e => { e.currentTarget.blur(); if (!R.modal) cycleCamera(); });
$('sndBtn').addEventListener('click', e => { e.currentTarget.blur(); toggleSound(); });

const TURN = ['up', 'right', 'down', 'left'];
function turn(side) {
  const p = S.player;
  p.dir = TURN[(TURN.indexOf(p.dir) + (side === 'right' ? 1 : 3)) % 4];
}
function cycleCamera() {
  if (!RND || !RND.cycleCamera) return msg('Ganti kamera hanya ada di mode 3D.');
  const name = RND.cycleCamera();
  for (const k in R.keys) R.keys[k] = false;
  msg(R.pov ? 'Kamera: mata petani — ▲ maju, ▼ mundur, ◀ ▶ belok' : `Kamera: ${name}`);
}
function toggleSound() {
  if (!window.FX5D) return;
  const muted = FX5D.toggleMute();
  $('sndBtn').textContent = muted ? 'Suara: mati' : 'Suara: nyala';
  msg(muted ? 'Suara & getar dimatikan.' : 'Suara & getar dinyalakan.');
}
$('modal').addEventListener('click', e => { if (e.target.id === 'modal' && !modalFresh()) closeModal(); });

/* ================= Ketuk & geser: tanam, siram, panen, beri makan, ambil hasil ================= */
const REACH = Infinity;   // tanpa batas: petak mana pun yang terlihat bisa diketuk/digeser
const drag = {on: false, action: null, seen: new Set(), warned: false, popTile: null};
const playerTile = () => [Math.floor(S.player.x / T), Math.floor((S.player.y - 1) / T)];
function inReach(tx, ty) { const [px, py] = playerTile(); return Math.max(Math.abs(px - tx), Math.abs(py - ty)) <= REACH; }
function faceTo(tx, ty) {
  R.lastTap = {x: tx * T + 8, y: ty * T + 10};
  const p = S.player, dx = tx + 0.5 - p.x / T, dy = ty + 0.5 - (p.y - 1) / T;
  if (Math.abs(dx) + Math.abs(dy) > 0.6) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
function tooFar() { if (!drag.warned) { drag.warned = true; msg(`Terlalu jauh — jalan mendekat dulu (jangkauan ${REACH} petak).`); } }
// hewan terdekat dari titik dunia (piksel); badan hewan berada sedikit di atas kakinya
function animalAtPoint(wx, wy, pick) {
  if (!animalsVisible()) return null;
  let best = null, bd = Infinity;
  for (const a of S.animals) {
    if (pick && !pick(a)) continue;
    const big = a.type !== 'ayam', rad = big ? 20 : 14, dx = a.x - wx, dy = a.y - (big ? 9 : 5) - wy, d = dx * dx + dy * dy;
    if (d < rad * rad && d < bd) { bd = d; best = a; }
  }
  return best;
}
function tileAction(tx, ty) {
  if (tileLocked(tx, ty)) return null;
  const s = S.soil[ty][tx], o = S.obj[ty][tx], tool = TOOLS[S.tool].id;
  if (s && s.crop && isMature(s.crop)) return 'harvest';
  if (o === 'fruit' && orchardAt(tx, ty) && orchardAt(tx, ty).fruit) return 'harvest';
  if (tool === 'benih' && s && !s.crop && ensureSeed() && CROPS[S.seedSel].season === S.season) return 'plant';
  if (tool === 'penyiram' && s && !s.watered && S.water > 0) return 'water';
  if (tool === 'cangkul' && !o && !s && S.ground[ty][tx] === 'field') return 'till';
  if (tool === 'sabit' && (o === 'weed' || (s && s.crop && s.crop.dead))) return 'cut';
  if (tool === 'penyiram' && S.ground[ty][tx] === 'water') return 'refill';
  // gaya Hay Day: dengan Tangan, ketuk/geser tanaman kering langsung menyiram; ketuk kolam mengisi penyiram
  if (tool === 'tangan' && s && s.crop && !s.crop.dead && !s.watered && S.water > 0) return 'water';
  if (tool === 'tangan' && S.ground[ty][tx] === 'water' && S.water < CAN_MAX) return 'refill';
  if (tool === 'palu' && (o === 'rock' || (s && !s.crop))) return 'smash';
  if (tool === 'kapak' && (o === 'stump' || o === 'fruit' || (o === 'tree' && choppable(tx, ty)))) return 'axe';
  return null;
}
function applyTile(tx, ty) {
  if (!inMap(tx, ty) || tileAction(tx, ty) !== drag.action) return;
  if (!inReach(tx, ty)) return tooFar();
  const cost = {till: 2, water: 1, cut: 1, smash: 2, axe: 3}[drag.action] || 0;
  if (cost && S.stamina < cost) { if (!drag.warned) { drag.warned = true; msg('Kamu terlalu lelah. Pulang dan tidur dulu!'); emit('tired'); } return endDrag(); }
  faceTo(tx, ty);
  if (drag.action === 'harvest') interact([tx, ty]);
  else if (drag.action === 'axe' && S.obj[ty][tx] === 'fruit') { endDrag(); useTool([tx, ty]); }   // minta konfirmasi tebang
  else if (drag.action === 'plant') plant([tx, ty], true);
  else useTool([tx, ty], true);
}
function applyAnimal(a) {
  if (drag.seen.has('a' + a.id)) return;
  drag.seen.add('a' + a.id);
  const t = [Math.floor(a.x / T), Math.floor((a.y - 1) / T)];
  if (!inReach(...t)) return tooFar();
  faceTo(...t);
  if (R.modal) return;
  if (drag.action === 'collect') collectFrom(a);
  else if (drag.action === 'feed' && !feedAnimal(a, drag.warned)) drag.warned = true;
}
function startDrag(action, pid) {
  Object.assign(drag, {on: true, action, pid, seen: new Set(), warned: false, back: null});
  // siram dengan Tangan: pinjam Penyiram selama menggeser, lalu kembali ke Tangan
  if ((action === 'water' || action === 'refill') && TOOLS[S.tool].id === 'tangan') { drag.back = S.tool; S.tool = TOOLS.findIndex(t => t.id === 'penyiram'); }
}
const worldAt = e => RND && RND.pickWorld ? RND.pickWorld(e.clientX, e.clientY) : null;
const ANIMAL_ACTS = new Set(['feed', 'collect']);
addEventListener('pointerdown', e => {
  if (!S || !R.running || R.modal || e.button !== 0 || !(e.target.id === 'game' || e.target.id === 'game3d')) return;
  if (pinch) return;   // jari kedua: zoom, bukan aksi
  hideSeedPop();
  const pid = e.pointerId;
  const w = worldAt(e);
  if (!w) return;
  const [wx, wy] = w, tx = Math.floor(wx / T), ty = Math.floor(wy / T);
  if (R.buildMode && R.paint) { R.painting = pid; paintAt(tx, ty); return; }   // cat tanah: ketuk/geser
  if (R.buildMode) {   // mode bangun: ketuk = taruh/pilih; geser = lihat sekitar (tanpa karakter)
    if (R.noChar) pan = {pid, x: e.clientX, y: e.clientY, moved: false, build: [tx, ty], cx: e.clientX, cy: e.clientY};
    else buildTap(tx, ty);
    return;
  }
  const a = animalAtPoint(wx, wy);
  if (a) {
    if (a.ready) { startDrag('collect', pid); return applyAnimal(a); }
    if (!a.fed && !troughCovers(a) && S.inv[feedOf(a)] > 0) { startDrag('feed', pid); return applyAnimal(a); }
    const t = [Math.floor(a.x / T), Math.floor((a.y - 1) / T)];
    if (!inReach(...t)) { drag.warned = false; return tooFar(); }
    faceTo(...t); return animalTap(a);
  }
  if (!inMap(tx, ty)) return;
  const act = tileAction(tx, ty);
  if (act) { startDrag(act, pid); return applyTile(tx, ty); }
  const s = S.soil[ty][tx], busy = s || S.obj[ty][tx] || doorAt(tx, ty) || eggAt(tx, ty) >= 0;
  const treeTap = !busy && canPlantTree(tx, ty) && Object.values(S.inv.bibit).some(n => n > 0);
  if (R.noChar) { pan = {pid, x: e.clientX, y: e.clientY, moved: false, tree: treeTap ? [tx, ty] : null, tap: busy ? [tx, ty] : null, cx: e.clientX, cy: e.clientY}; return; }
  if (treeTap) { drag.popTile = [tx, ty]; return showTreePop(e.clientX, e.clientY); }
  if (!busy) return;
  drag.warned = false;
  if (!inReach(tx, ty)) return tooFar();
  if (s && !s.crop) { drag.popTile = [tx, ty]; drag.popPid = pid; return showSeedPop(e.clientX, e.clientY); }
  faceTo(tx, ty); interact([tx, ty]);
});
addEventListener('pointermove', e => {
  if (pinch && pointers.has(e.pointerId)) {   // cubit dua jari → zoom
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch.d > 0 && d > 0 && RND === Renderers['3d']) R.zoom = clamp(R.zoom * pinch.d / d, 0.55, 1.8);
    pinch.d = d; return;
  }
  if (R.painting != null && e.pointerId === R.painting) {
    if (!R.paint || R.modal || (e.pointerType === 'mouse' && !(e.buttons & 1))) { R.painting = null; return; }
    const w = worldAt(e); if (w) paintAt(Math.floor(w[0] / T), Math.floor(w[1] / T));
    return;
  }
  if (pan && (R.modal || (e.pointerType === 'mouse' && !(e.buttons & 1)))) { pan = null; return; }
  if (pan && e.pointerId === pan.pid) {   // geser kamera mengikuti jari/mouse
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (Math.hypot(e.clientX - pan.cx, e.clientY - pan.cy) > 6) pan.moved = true;
    if (pan.moved) {
      const ppt = RND.pxPerTile ? RND.pxPerTile() : 40;
      panBy(-dx / ppt * T, -dy / ppt * T * (RND === Renderers['3d'] ? 1.4 : 1));
    }
    pan.x = e.clientX; pan.y = e.clientY; return;
  }
  if (!drag.on || !S || e.pointerId !== drag.pid) return;
  if (R.modal || !R.running || (e.pointerType === 'mouse' && !(e.buttons & 1))) return endDrag();
  const w = worldAt(e);
  if (!w) return;
  if (ANIMAL_ACTS.has(drag.action)) {
    const a = animalAtPoint(w[0], w[1], x => drag.action === 'collect' ? x.ready : !x.fed);
    if (a) applyAnimal(a);
    return;
  }
  const tx = Math.floor(w[0] / T), ty = Math.floor(w[1] / T), k = tx + ',' + ty;
  if (drag.seen.has(k)) return;
  drag.seen.add(k); applyTile(tx, ty);
});
// mode tanpa karakter: geser kamera, cubit untuk zoom, roda mouse untuk zoom
let pan = null, pinch = null;
const pointers = new Map();
function panBy(dx, dy) {
  const f = R.camFocus;
  f.x = clamp(f.x + dx, 3 * T, (MW - 3) * T); f.y = clamp(f.y + dy, 3 * T, (MH - 2) * T);
}
addEventListener('pointerdown', e => {
  if (!(e.target.id === 'game' || e.target.id === 'game3d')) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2 && R.noChar) { endDrag(); pan = null; hideSeedPop(); pinch = {d: 0}; }
}, true);
const releasePointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pan && e.pointerId === pan.pid) {
    if (!pan.moved && e.type === 'pointerup' && S && R.running && !R.modal) {   // ketuk tanpa geser
      if (pan.build) buildTap(...pan.build);
      else if (pan.tree) { drag.popTile = pan.tree; showTreePop(pan.cx, pan.cy); }
      else if (pan.tap) {
        const [tx, ty] = pan.tap, s = S.soil[ty][tx];
        if (s && !s.crop) { drag.popTile = pan.tap; showSeedPop(pan.cx, pan.cy); }
        else { faceTo(tx, ty); interact(pan.tap); }
      }
    }
    pan = null;
  }
};
addEventListener('pointerup', releasePointer);
addEventListener('pointercancel', releasePointer);
addEventListener('wheel', e => {
  if (!S || !R.running || R.modal || !R.noChar || RND !== Renderers['3d'] || !(e.target.id === 'game' || e.target.id === 'game3d')) return;
  e.preventDefault();
  R.zoom = clamp(R.zoom * Math.exp(e.deltaY * 0.0012), 0.55, 1.8);
}, {passive: false});
function setNoChar(on, toggled) {
  R.noChar = on;
  try { localStorage.setItem('kebunPelangi.nochar', on ? '1' : '0'); } catch (e) { /* abaikan */ }
  document.body.classList.toggle('nochar', on);
  if (on && S && toggled) R.camFocus = {x: S.player.x, y: S.player.y};   // beralih dari mode petani: mulai dari posisinya
  if (!on && S && blocked(S.player.x, S.player.y)) { S.player.x = START.x; S.player.y = START.y; }   // keluar dari pohon yang ditanam di posisinya
  if (on && R.pov && RND.cycleCamera) RND.cycleCamera();   // kamera mata petani tidak dipakai tanpa karakter
  $('keys').innerHTML = on ? 'Geser layar/mouse: lihat sekitar<br>Cubit/scroll: zoom<br>WASD/panah: geser kamera<br>Ketuk: tanam, siram, panen, beri makan<br>1-8 / Q: ganti alat · I: tas<br>Esc: menu'
    : 'WASD/Panah: jalan<br>Spasi/J: pakai alat<br>E/K: periksa/ambil<br>1-8 / Q: ganti alat<br>R: ganti benih · I: tas<br>V: kamera · M: suara<br>Esc: menu';
}
try { R.noChar = localStorage.getItem('kebunPelangi.nochar') !== '0'; } catch (e) { /* bawaan: tanpa karakter */ }
function viewFocus() { return R.noChar ? R.camFocus : S.player; }

// alat yang dipilih tetap terpilih sampai pemain menggantinya (tanam/siram/cangkul berulang tanpa memilih ulang);
// geser di petak yang tidak bisa dikenai alat tetap menggeser pandangan
function endDrag(e) {
  if (drag.on && (!e || e.pointerId === undefined || e.pointerId === drag.pid)) {
    drag.on = false;
    if (drag.back != null) { S.tool = drag.back; drag.back = null; }
    refreshHotbar();
  }
}
addEventListener('pointerup', e => { if (e.pointerId === R.painting) R.painting = null; endDrag(e); });
addEventListener('pointercancel', e => { if (e.pointerId === R.painting) R.painting = null; });
addEventListener('pointercancel', endDrag);
addEventListener('blur', () => { endDrag(); pan = pinch = null; pointers.clear(); });
addEventListener('contextmenu', e => { if (e.target.id === 'game' || e.target.id === 'game3d') e.preventDefault(); endDrag(); });

// popup benih: ketuk bedeng kosong → pilih benih → geser ke petak-petak lain
function showSeedPop(cx, cy) {
  const pop = $('seedPop'), ids = Object.keys(CROPS).filter(id => CROPS[id].season === S.season && (S.inv.seeds[id] || 0) > 0);
  if (!ids.length) return msg(S.season === 3 ? 'Musim dingin: tidak ada yang bisa ditanam.' : 'Tidak punya benih musim ini. Beli di toko (09:00–17:00).');
  pop.innerHTML = '';
  for (const id of ids) {
    const b = document.createElement('button');
    b.className = 'seedBtn'; b.setAttribute('aria-label', 'Benih ' + CROPS[id].name);
    const c = document.createElement('canvas');
    const icon = RND && RND.toolIcon ? RND.toolIcon('benih', id) : null;
    if (icon) { c.width = c.height = 64; c.classList.add('icon3d'); c.getContext('2d').drawImage(icon, 0, 0, 64, 64); }
    else { c.width = c.height = 16; const prev = g; g = c.getContext('2d'); drawToolIcon('benih', id); g = prev; }
    const n = document.createElement('span'); n.textContent = S.inv.seeds[id];
    b.append(c, n);
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!S || !R.running || R.modal) return hideSeedPop();
      S.seedSel = id; S.tool = TOOLS.findIndex(t => t.id === 'benih');
      hideSeedPop(); startDrag('plant', e.pointerId);
      if (drag.popTile) { drag.seen.add(drag.popTile.join(',')); applyTile(...drag.popTile); }
      refreshHotbar();
    });
    pop.append(b);
  }
  const hint = document.createElement('div'); hint.className = 'seedHint'; hint.textContent = 'Tekan benih, lalu geser ke petak';
  pop.append(hint);
  pop.hidden = false;
  const r = pop.getBoundingClientRect();
  pop.style.left = clamp(cx - r.width / 2, 8, innerWidth - r.width - 8) + 'px';
  pop.style.top = clamp(cy - r.height - 18, 8, innerHeight - r.height - 8) + 'px';
}
// popup bibit pohon: ketuk rumput kosong → pilih bibit → tertanam di petak itu
function showTreePop(cx, cy) {
  const pop = $('seedPop'), ids = Object.keys(FRUITS).filter(id => (S.inv.bibit[id] || 0) > 0);
  pop.innerHTML = '';
  for (const id of ids) {
    const b = document.createElement('button');
    b.className = 'seedBtn'; b.setAttribute('aria-label', 'Bibit ' + FRUITS[id].name);
    const ico = document.createElement('i'); ico.className = 'treeIco'; ico.style.setProperty('--fruit', FRUITS[id].color);
    const n = document.createElement('span'); n.textContent = S.inv.bibit[id];
    b.append(ico, n);
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!S || !R.running || R.modal) return hideSeedPop();
      hideSeedPop();
      if (drag.popTile) { faceTo(...drag.popTile); plantTree(id, ...drag.popTile); }
    });
    pop.append(b);
  }
  const hint = document.createElement('div'); hint.className = 'seedHint'; hint.textContent = 'Pilih bibit pohon untuk ditanam di sini';
  pop.append(hint);
  pop.hidden = false;
  const r = pop.getBoundingClientRect();
  pop.style.left = clamp(cx - r.width / 2, 8, innerWidth - r.width - 8) + 'px';
  pop.style.top = clamp(cy - r.height - 18, 8, innerHeight - r.height - 8) + 'px';
}
function hideSeedPop() { const p = $('seedPop'); if (p) p.hidden = true; }

const useTouch = () => document.body.classList.add('touch');
if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches) useTouch();
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') useTouch(); });

/* ================= Loop ================= */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    if (S && R.running && !R.modal) update(dt);
    if (S) { RND.draw(); updateHUD(); }
  } catch (e) { console.error(e); }
}
function showTitle() {
  hideSeedPop(); drag.on = false; closeBuild();
  $('title').hidden = false;
  $('title').querySelector('.help').innerHTML = R.noChar
    ? '<b>Cara main:</b> geser layar untuk melihat sekitar, cubit (atau scroll) untuk zoom. Pilih alat di bawah, lalu ketuk atau geser di atas petak: cangkul, tanam, siram, panen. Ketuk hewan untuk memberi makan & mengambil telur/susu. Ketuk pintu rumah untuk tidur & menyimpan.'
    : '<b>Cara main:</b> jalan dengan WASD/panah (atau tombol arah di layar). Spasi memakai alat ke petak di depanmu, E untuk memeriksa, memanen, mengelus hewan, membuka toko, kotak kirim, dan pintu rumah. Tanaman hanya tumbuh bila disiram tiap hari. Tidur di rumah untuk menyimpan permainan.';
  const sv = loadSave();
  $('contBtn').hidden = !sv || sv === 'rusak';
  $('saveNote').hidden = sv !== 'rusak';
  ($('contBtn').hidden ? $('newBtn') : $('contBtn')).focus();
  emit('title');
}
function startGame(state, welcome) {
  hideSeedPop(); drag.on = false; closeBuild();
  S = state;
  R.camFocus = {x: 15.5 * T, y: 11 * T}; R.zoom = 1; R.lastTap = null;
  if (R.noChar) S.tool = TOOLS.findIndex(t => t.id === 'tangan');   // mulai dengan Tangan: geser = lihat sekitar
  setNoChar(R.noChar);
  R.ai = {};
  for (const w of S.shift) { w.tgt = null; w.cool = 0; }
  if (S.staff.length && S.shiftDay !== absDay()) { S.shift = []; S.shiftDay = absDay(); for (const w of S.staff) startShift(w); }
  R.particles = []; R.drops = []; R.acc = 0; R.swing = 0; R.stumpHits = {};
  for (const k in hud) delete hud[k];
  $('title').hidden = true;
  R.running = true;
  emit('start', !!welcome);
  refreshHotbar();
  if (welcome) openModal('Selamat datang di Moo & Bloom!', `<p>Kamu mewarisi ladang kecil yang lama tak terurus. Ubah jadi kebun yang subur!</p>
    <p>• Ladang ada di tengah — bersihkan dulu rumput, batu, dan tunggul.<br>• Cangkul (1), tanam Benih (6), lalu Siram (2) setiap hari.<br>• Kirim panen di kotak kayu samping rumah.<br>• Ternak: ayam di kiri bawah, lumbung sapi & kambing di kiri, di bawah rumah. Beli hewan di toko, elus dan beri makan setiap hari.</p>
    <p class="muted">Ini versi BETA: satu ladang, 9 tanaman, 4 musim × 10 hari, ayam · kambing · sapi · babi.</p>`, [{label: 'Ayo bertani!', primary: true}]);
  else msg(`Selamat datang kembali! Musim ${SEASONS[S.season]}, Hari ${S.day}.`);
}
$('newBtn').addEventListener('click', () => startGame(newGame(), true));
$('contBtn').addEventListener('click', () => { const d = loadSave(); if (d && d !== 'rusak') startGame(d, false); });
let RND = null;
// Pilih tampilan: 3D bawaan (bila Three.js termuat), 2D lewat ?2d atau bila 3D gagal.
function boot() {
  const want2d = /[?&]2d\b/.test(location.search);
  const ok3d = !!(window.Renderers && Renderers['3d']);
  RND = Renderers[!want2d && ok3d ? '3d' : '2d'];
  try { RND.init(); }
  catch (e) { console.warn('3D tidak tersedia, pakai 2D:', e); RND = Renderers['2d']; RND.init(); }
  addEventListener('resize', () => RND.resize());
  RND.resize();
  // pilihan tampilan di layar judul
  const is3d = RND === Renderers['3d'], rich = is3d && window.Real3D && Real3D.enabled;
  const cur = rich ? (Real3D.toon ? '?kartun' : '?') : is3d ? '?lowpoly' : '?2d';
  const modes = ok3d ? [['?', '3D Realistis'], ['?kartun', '3D Kartun'], ['?lowpoly', '3D Low-poly'], ['?2d', '2D Piksel']] : [['?2d', '2D Piksel']];
  $('modeLink').innerHTML = 'Tampilan: ' + modes.map(([href, name]) => href === cur ? `<b>${name}</b>` : `<a href="${href}">${name}</a>`).join(' · ') +
    (ok3d ? '' : ' <span class="muted">(3D butuh internet)</span>');
  document.body.classList.add('mode-' + (RND === Renderers['3d'] ? '3d' : '2d'));
  buildHotbar();
  showTitle();
  requestAnimationFrame(frame);
}

// Antarmuka uji untuk otomatisasi / konsol.
window.game = { TERRAIN, canPaint, paintAt, startPaint, openSeasons, staffTick, cash, openFinance, levelInfo, addXp, STAFF, hireStaff, fireStaff, openStaff, staffWork,
  get S() { return S; }, R, CROPS, TOOLS, ANIMALS, FRUITS, REGIONS, BUILD, canPlace, placeNew, moveStruct, sellDeco, openBuild, closeBuild, buildTap, startPlace, unlockRegion, plantTree, fruitTap, buyAnimal, migrate, validSave, feedAnimal, collectFrom, animalAtPoint, drag,
  start: () => startGame(newGame(), false),
  get RND() { return RND; }, emit, onGame, turn, cycleCamera,
  newDay, useTool, interact, plant, shipAll, selectTool, closeModal,
  face(dir) { S.player.dir = dir; },
  tp(tx, ty, dir = 'down') { S.player.x = tx * T + 8; S.player.y = ty * T + 10; S.player.dir = dir; },
  swingDone() { R.swing = 0; },
  step(dt) { update(dt); },   // simulasi waktu untuk pengujian
};
