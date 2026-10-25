'use strict';
/* "5D": dimensi ke-4 = suara (disintesis WebAudio, tanpa file), dimensi ke-5 = getar HP.
   Mendengarkan peristiwa dari core.js lewat onGame(). */
(function () {
  const PREF = 'kebunPelangi.mute';
  let muted = false;
  try { muted = localStorage.getItem(PREF) === '1'; } catch (e) { /* tanpa penyimpanan */ }
  let ac = null, master = null, noiseBuf = null, rainGain = null;

  // Browser hanya mengizinkan audio setelah interaksi pengguna.
  function ensure() {
    if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // dengung hujan terus-menerus, volumenya diatur oleh ambient()
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
    rainGain = ac.createGain(); rainGain.gain.value = 0;
    src.connect(f); f.connect(rainGain); rainGain.connect(master); src.start();
  }
  addEventListener('pointerdown', ensure, true);
  addEventListener('keydown', ensure, true);
  addEventListener('touchend', ensure, true);   // iOS membuka audio pada touchend/click
  addEventListener('click', ensure, true);

  function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, type = 'lowpass', delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  // air dituang dari gembor: aliran air + banyak percikan tetes acak + sesekali bunyi "plip"
  function pour(dur) {
    if (!ac || muted) return;
    const t0 = ac.currentTime;
    // aliran: derau pita sempit yang bergelombang pelan (gemericik)
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.2;
    lfo.frequency.value = 7; lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.13, t0 + 0.08); g.gain.setValueAtTime(0.13, t0 + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t0, Math.random()); s.stop(t0 + dur + 0.05); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    // percikan tetes yang jatuh ke tanah
    for (let i = 0; i < 26; i++) {
      const t = t0 + 0.05 + Math.random() * (dur - 0.1), d = 0.025 + Math.random() * 0.04;
      const ds = ac.createBufferSource(), f = ac.createBiquadFilter(), dg = ac.createGain();
      ds.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 3200; f.Q.value = 3 + Math.random() * 4;
      dg.gain.setValueAtTime(0.06 + Math.random() * 0.08, t); dg.gain.exponentialRampToValueAtTime(0.0001, t + d);
      ds.connect(f); f.connect(dg); dg.connect(master); ds.start(t, Math.random() * 1.5); ds.stop(t + d + 0.01);
    }
    // beberapa "plip" (tetes jatuh ke genangan)
    for (let i = 0; i < 4; i++) {
      const t = t0 + 0.1 + Math.random() * (dur - 0.2), f0 = 900 + Math.random() * 700;
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.05);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.035, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.08);
    }
  }
  function buzz(pattern) {
    // getar hanya diizinkan setelah pengguna menyentuh/mengetuk halaman
    if (muted || !navigator.vibrate || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    try { navigator.vibrate(pattern); } catch (e) { /* tidak didukung */ }
  }

  const TOOL_SFX = {
    cangkul:  () => { noise(0.14, 0.4, 450); tone(85, 0.12, 'triangle', 0.25, -30); buzz(25); },
    penyiram: () => { pour(0.9); buzz(10); },
    sabit:    () => { noise(0.16, 0.25, 3800, 'bandpass'); buzz(12); },
    palu:     () => { tone(190, 0.09, 'square', 0.14, -60); noise(0.22, 0.35, 1300); buzz(40); },
    kapak:    () => { tone(150, 0.07, 'square', 0.12, -40); noise(0.12, 0.35, 900); buzz(35); },
  };
  const SFX = {
    step: g => noise(0.05, g === 'path' ? 0.05 : 0.07, g === 'path' ? 1800 : g === 'field' ? 700 : 1000),
    tool: id => TOOL_SFX[id] && TOOL_SFX[id](),
    tired: () => { tone(300, 0.25, 'sine', 0.12, -140); buzz([60, 40, 60]); },
    refill: () => { for (let i = 0; i < 4; i++) tone(500 + i * 120, 0.08, 'sine', 0.1, 200, i * 0.06); },
    chop: () => { tone(70, 0.3, 'triangle', 0.35, -20); noise(0.35, 0.3, 500); buzz([30, 30, 60]); },
    plant: () => tone(620, 0.08, 'sine', 0.1, 180),
    harvest: () => { tone(523, 0.09, 'triangle', 0.2); tone(784, 0.14, 'triangle', 0.2, 0, 0.08); buzz([15, 30, 15]); },
    pickup: () => { tone(660, 0.07, 'triangle', 0.16); tone(990, 0.12, 'triangle', 0.16, 0, 0.07); buzz(15); },
    cluck: () => { for (let i = 0; i < 3; i++) tone(650 + Math.random() * 120, 0.06, 'square', 0.06, -220, i * 0.1); buzz(10); },
    coin: () => { tone(988, 0.06, 'square', 0.08); tone(1319, 0.16, 'square', 0.08, 0, 0.06); buzz(10); },
    ship: () => { for (let i = 0; i < 3; i++) tone(880 + i * 220, 0.1, 'square', 0.07, 0, i * 0.09); buzz([10, 40, 10]); },
    ui: () => tone(440, 0.05, 'triangle', 0.07),
    moo: () => { tone(140, 0.7, 'sawtooth', 0.09, -40); tone(70, 0.7, 'sine', 0.12, -15); buzz([40, 30, 80]); },
    oink: () => { for (let i = 0; i < 2; i++) { tone(220 - i * 30, 0.14, 'square', 0.06, -60, i * 0.16); noise(0.1, 0.06, 600, 'lowpass', i * 0.16); } buzz([20, 30, 20]); },
    baa: () => { for (let i = 0; i < 3; i++) tone(420 - i * 20, 0.12, 'sawtooth', 0.06, 30, i * 0.11); buzz([20, 20, 20]); },
    milk: () => { for (let i = 0; i < 3; i++) noise(0.08, 0.12, 2400, 'bandpass', i * 0.12); tone(700, 0.15, 'sine', 0.08, 300, 0.36); buzz(15); },
    feed: () => { noise(0.25, 0.18, 900, 'bandpass'); buzz(10); },
    day: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, 0, i * 0.12)); buzz([30, 60, 30]); },
    faint: () => { [440, 349, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.14, 0, i * 0.18)); buzz(250); },
  };
  for (const name in SFX) onGame(name, SFX[name]);

  // suasana: hujan, burung di siang hari, jangkrik di malam hari
  setInterval(() => {
    if (!ac) return;
    if (!S || !R.running) { rainGain.gain.setTargetAtTime(0, ac.currentTime, 0.2); return; }
    const raining = S.weather === 'hujan' && !muted && !R.modal;
    rainGain.gain.setTargetAtTime(raining ? 0.12 : 0, ac.currentTime, 0.4);
    if (muted || R.modal || S.weather !== 'cerah') return;
    if (S.time < 1080 && Math.random() < 0.25) {
      const f = 2200 + Math.random() * 1200;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(f, 0.07, 'sine', 0.035, 600, i * 0.11);
    } else if (S.time >= 1140 && Math.random() < 0.5) {
      for (let i = 0; i < 4; i++) tone(4400, 0.025, 'square', 0.012, 0, i * 0.05);
    }
  }, 900);

  window.FX5D = {
    pour,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem(PREF, muted ? '1' : '0'); } catch (e) { /* tanpa penyimpanan */ }
      ensure();
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
  };
  const btn = document.getElementById('sndBtn');
  if (btn) btn.textContent = muted ? 'Suara: mati' : 'Suara: nyala';
})();
