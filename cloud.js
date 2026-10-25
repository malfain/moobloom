'use strict';
/* Masuk dengan Google + simpan progres di cloud (Supabase Auth & database, paket gratis).
   - Tombol hanya muncul bila supabase-config.js sudah diisi.
   - Simpanan disimpan di tabel saves (satu baris per akun); bila berbeda dengan perangkat ini, pemain memilih.
   - Tanpa login / tanpa internet, game tetap menyimpan di perangkat seperti biasa. */
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const box = document.getElementById('cloudBox');
  if (!box || !cfg.url || !cfg.anonKey) return;

  const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js';
  const AT_KEY = SAVE_KEY + '.at';
  let sb = null, user = null, busy = false, lastUp = 0, upTimer = null;
  // synced: unggahan baru diizinkan setelah pemain memastikan simpanan mana yang dipakai
  // baseAt: versi cloud terakhir yang diketahui perangkat ini (cegah menimpa progres dari perangkat lain)
  // foreignBlock: simpanan perangkat ini milik akun lain dan pemain menolak memakainya
  let synced = false, baseAt = 0, foreignBlock = false;
  const OWNER_KEY = SAVE_KEY + '.uid';

  const loadScript = src => new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Gagal memuat ' + src));
    document.head.append(s);
  });
  const localAt = () => { try { return +localStorage.getItem(AT_KEY) || 0; } catch (e) { return 0; } };
  const esc = t => String(t).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const G_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  // data akun Google dari Supabase
  const toUser = u => u && {uid: u.id, email: u.email || '', displayName: (u.user_metadata || {}).full_name || (u.user_metadata || {}).name || '',
    photoURL: (u.user_metadata || {}).avatar_url || (u.user_metadata || {}).picture || ''};

  function render(note) {
    box.hidden = false;
    if (!user) {
      box.innerHTML = `<button class="gBtn" id="gIn" type="button" ${busy ? 'disabled' : ''}>${G_LOGO}<span>${busy ? 'Menghubungkan…' : 'Masuk dengan Google'}</span></button>
        <div class="cloudNote">${esc(note || 'Masuk agar progres tersimpan di cloud & bisa dilanjut di HP/laptop lain.')}</div>`;
      box.querySelector('#gIn').onclick = signIn;
    } else {
      const pic = /^https:\/\//.test(user.photoURL) ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : '';
      box.innerHTML = `<div class="cloudUser">${pic}<span>☁ ${esc(user.displayName || user.email || 'Pemain')}</span>
        <button class="linkBtn" id="gOut" type="button">Keluar</button></div>
        <div class="cloudNote">${esc(note || 'Progres tersimpan otomatis ke akunmu setiap tidur.')}</div>`;
      box.querySelector('#gOut').onclick = signOut;
    }
  }

  async function init() {
    render();
    try {
      if (!window.supabase) await loadScript(SDK);
      sb = window.supabase.createClient(cfg.url, cfg.anonKey);
      // kembali dari halaman login Google dengan galat?
      const err = new URLSearchParams(location.hash.slice(1) || location.search).get('error_description');
      if (err) render('Login gagal: ' + err);
      sb.auth.onAuthStateChange((ev, session) => {
        const u = toUser(session && session.user);
        if ((u && u.uid) === (user && user.uid)) return;   // pembaruan token: bukan pergantian akun
        user = u; synced = false; baseAt = 0; foreignBlock = false; busy = false;
        render(u ? 'Menyinkronkan…' : undefined);
        if (u) setTimeout(sync, 0);   // jangan memanggil Supabase di dalam callback auth
      });
    } catch (e) { console.warn(e); render('Login Google tidak tersedia (cek koneksi internet).'); }
  }

  async function signIn() {
    if (!sb || busy) return;
    busy = true; render();
    // Google membuka di halaman yang sama lalu kembali ke game (aman untuk HP)
    const {error} = await sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin + location.pathname, queryParams: {prompt: 'select_account'}}});
    if (error) { busy = false; render('Login gagal: ' + error.message); }
  }
  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    render('Kamu sudah keluar. Progres tetap tersimpan di perangkat ini.');
  }

  // baris simpanan akun ini: {data, at} atau null
  async function getRow() {
    const {data, error} = await sb.from('saves').select('data, at').eq('user_id', user.uid).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function putRow(row) {
    const {error} = await sb.from('saves').upsert({user_id: user.uid, ...row, updated_at: new Date().toISOString()});
    if (error) throw error;
  }

  const getLS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const setLS = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  function done(at) { synced = true; baseAt = at; setLS(OWNER_KEY, user.uid); }
  async function push() { synced = true; await upload(true, true); render('Progres perangkat ini diunggah ke akunmu.'); }

  // saat masuk: bandingkan simpanan cloud dengan simpanan perangkat ini
  async function sync() {
    if (!user) return;
    try {
      const cloud = await getRow(), cloudAt = cloud ? +cloud.at || 0 : 0;
      const localTxt = getLS(SAVE_KEY), local = localTxt ? loadSave() : null, hasLocal = !!local && local !== 'rusak';
      const owner = getLS(OWNER_KEY), foreign = hasLocal && !!owner && owner !== user.uid;
      let cd = null;
      if (cloud && cloud.data) { try { cd = migrate(JSON.parse(cloud.data)); } catch (e) { cd = null; } if (cd && !validSave(cd)) cd = null; }
      const lbl = d => `Musim ${SEASONS[d.season]} Hari ${d.day}, Tahun ${d.year} · ${d.gold.toLocaleString('id-ID')} G`;
      if (!cd && !hasLocal) { done(cloudAt); return render(); }
      if (!cd && !foreign) return push();
      if (!cd) {   // perangkat dipakai bergantian: jangan diam-diam memindahkan progres akun lain
        openModal('Progres akun lain', `<p>Progres di perangkat ini berasal dari akun Google lain:</p><p>📱 ${esc(lbl(local))}</p>
          <p>Pakai progres ini untuk akun <b>${esc(user.displayName || user.email || '')}</b>?</p>`,
          [{label: 'Tidak', fn: () => { foreignBlock = true; done(cloudAt); render('Tekan Mulai Baru untuk memulai progres di akun ini.'); }},
           {label: 'Ya, pakai', primary: true, fn: push}]);
        return render();
      }
      if (!hasLocal) return useCloud(cd, cloudAt);
      if (localTxt === cloud.data) { done(cloudAt); return render(); }
      // keduanya ada & berbeda: biarkan pemain memilih agar progres panjang tidak tertimpa
      openModal('Pilih progres', `<p>Ada dua simpanan berbeda:</p>
        <p>☁ <b>Akun Google</b><br>${esc(lbl(cd))}</p><p>📱 <b>Perangkat ini</b>${foreign ? ' (dari akun lain)' : ''}<br>${esc(lbl(local))}</p>
        <p class="muted">Simpanan yang tidak dipilih akan ditimpa.</p>`,
        [{label: 'Pakai perangkat ini', fn: push},
         {label: 'Pakai akun Google', primary: true, fn: () => useCloud(cd, cloudAt)}]);
      render();
    } catch (e) { console.warn(e); render('Gagal sinkron dengan cloud: ' + (e.message || e.code)); }
  }
  function useCloud(d, at) {
    // sedang bermain: tunda (unggahan tetap diblokir) sampai kembali ke layar judul
    if (R.running) return render('Kembali ke judul untuk memuat progres dari cloud.');
    if (!setLS(SAVE_KEY, JSON.stringify(d)) || !setLS(AT_KEY, String(at || Date.now()))) return render('Penyimpanan perangkat penuh/terblokir.');
    done(at);
    if (!document.getElementById('title').hidden) showTitle();
    render(`Progres dari cloud dimuat (Hari ${d.day}). Tekan Lanjutkan.`);
  }

  async function upload(now, quiet) {
    if (!user || !sb || !synced || foreignBlock) return;
    clearTimeout(upTimer);
    if (!now && Date.now() - lastUp < 5000) { upTimer = setTimeout(() => upload(true), 5000); return; }
    const data = getLS(SAVE_KEY);
    if (!data) return;
    lastUp = Date.now();
    try {
      const remote = await getRow(), remoteAt = remote ? +remote.at || 0 : 0;
      if (remoteAt > baseAt) {   // perangkat lain menyimpan lebih baru: jangan ditimpa
        synced = false;
        if (R.running) msg('☁ Ada progres lebih baru dari perangkat lain — kembali ke judul untuk memilih.');
        return;
      }
      const at = Math.max(localAt() || Date.now(), baseAt + 1);
      await putRow({data, at, day: S ? S.day : 0, season: S ? S.season : 0});
      baseAt = at; setLS(OWNER_KEY, user.uid);
      if (R.running && !quiet) msg('☁ Progres tersimpan di akun Google.');
    } catch (e) { console.warn(e); if (R.running) msg('☁ Gagal menyimpan ke cloud — tersimpan di perangkat saja.'); }
  }
  // kembali ke judul: coba sinkron lagi bila tertunda; mulai baru: progres baru milik akun ini
  onGame('title', () => { if (user && !synced) sync(); });
  onGame('start', isNew => { if (isNew) foreignBlock = false; });
  onGame('saved', () => upload(false));

  window.Cloud = {get user() { return user; }, signIn, signOut, sync, upload};
  init();
})();
