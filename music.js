'use strict';
/* Musik latar Moo & Bloom: disintesis langsung dengan Web Audio (tanpa file).
   Tiap lagu = progresi akor + melodi pentatonik yang dibangkitkan dari "benih" tetap, jadi selalu sama tapi tidak monoton.
   Music.play('semi' | 'panas' | 'gugur' | 'dingin' | 'malam' | 'judul'), Music.stop(), Music.setVolume(0..1). */
(function () {
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);   // nomor MIDI → frekuensi
  // akor ditulis sebagai nomor MIDI nada dasar + jenis (mayor/minor)
  const TRACKS = {
    judul:  {bpm: 92, root: 60, scale: [0, 2, 4, 7, 9], chords: [[60, 'M'], [67, 'M'], [69, 'm'], [65, 'M']], lead: 'piano', seed: 3, pad: 0.5, beat: 0.6, swing: 0.08},
    semi:   {bpm: 100, root: 60, scale: [0, 2, 4, 7, 9], chords: [[60, 'M'], [65, 'M'], [67, 'M'], [60, 'M'], [69, 'm'], [65, 'M'], [67, 'M'], [67, 'M']], lead: 'piano', seed: 11, pad: 0.4, beat: 0.8, swing: 0.1},
    panas:  {bpm: 112, root: 65, scale: [0, 2, 4, 7, 9], chords: [[65, 'M'], [70, 'M'], [72, 'M'], [65, 'M'], [62, 'm'], [70, 'M'], [72, 'M'], [72, 'M']], lead: 'piano', seed: 7, pad: 0.3, beat: 1, swing: 0.12},
    gugur:  {bpm: 84, root: 57, scale: [0, 3, 5, 7, 10], chords: [[57, 'm'], [65, 'M'], [60, 'M'], [67, 'M']], lead: 'piano', seed: 21, pad: 0.6, beat: 0.5, swing: 0.06},
    dingin: {bpm: 72, root: 62, scale: [0, 2, 4, 7, 9], chords: [[62, 'M'], [59, 'm'], [67, 'M'], [69, 'M']], lead: 'piano', seed: 5, pad: 0.7, beat: 0, swing: 0},
    malam:  {bpm: 64, root: 57, scale: [0, 3, 5, 7, 10], chords: [[57, 'm'], [62, 'm'], [64, 'm'], [57, 'm']], lead: 'piano', seed: 9, pad: 0.8, beat: 0, swing: 0},
  };
  let ac = null, master = null, verb = null, cur = null, timer = null, nextT = 0, step = 0, vol = 0.45, noiseBuf = null, swap = null;

  function ensure() {
    if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return true; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    ac = new Ctx();
    master = ac.createGain(); master.gain.value = vol * 0.35;
    // gema ringan (delay berumpan balik) agar terasa luas & lembut
    const d = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), lp = ac.createBiquadFilter();
    d.delayTime.value = 0.33; fb.gain.value = 0.32; wet.gain.value = 0.28; lp.type = 'lowpass'; lp.frequency.value = 2400;
    verb = ac.createGain();
    verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(master);
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return true;
  }
  // pembangkit acak dengan benih: lagu yang sama selalu berbunyi sama
  const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function env(g, t, a, peak, dec, sus, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec + rel);
  }
  function voice(type, freq, t, len, gain, send = 0.3) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.connect(g); g.connect(master); if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); }
    return {o, g, start: () => { o.start(t); o.stop(t + len + 0.05); }};
  }
  // instrumen
  const INST = {
    flute(f, t, len, v) {   // seruling lembut dengan vibrato
      const a = voice('triangle', f, t, len + 0.3, v, 0.4), lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(a.o.frequency);
      lfo.start(t + 0.12); lfo.stop(t + len + 0.35);
      env(a.g, t, 0.06, v, 0.15, 0.7, len + 0.2); a.start();
    },
    pluck(f, t, len, v) {   // petikan (seperti ukulele)
      const a = voice('triangle', f, t, 0.6, v, 0.35), b = voice('sine', f * 2, t, 0.4, v * 0.4, 0.2);
      env(a.g, t, 0.005, v, 0.18, 0.3, 0.35); env(b.g, t, 0.005, v * 0.4, 0.1, 0.2, 0.2); a.start(); b.start();
    },
    piano(f, t, len, v) {   // piano: beberapa harmonik yang meluruh, nada tinggi memudar lebih cepat, filter menutup perlahan
      const lp = ac.createBiquadFilter(), out = ac.createGain(), send = ac.createGain();
      lp.type = 'lowpass'; lp.Q.value = 0.5;
      lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 2.2), t + 1.2);
      lp.connect(out); out.connect(master); send.gain.value = 0.35; out.connect(send); send.connect(verb);
      const dec = Math.min(2.6, Math.max(0.9, 380 / f)), hold = Math.max(len, 0.25);
      [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1], [5.02, 0.05]].forEach(([h, a], i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = i ? 'sine' : 'triangle'; o.frequency.value = f * h; o.detune.value = (i % 2 ? 3 : -2);
        o.connect(g); g.connect(lp);
        const pk = v * a, d = dec / (1 + i * 0.6);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.006);
        g.gain.exponentialRampToValueAtTime(pk * 0.35, t + Math.min(d, hold));          // luruh selama tuts ditekan
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(d, hold) + 0.35);      // lepas tuts
        o.start(t); o.stop(t + Math.min(d, hold) + 0.4);
      });
    },
    arp(f, t, v) { INST.piano(f, t, 0.3, v * 0.8); },   // iringan: piano lembut
    bass(f, t, len, v) { const a = voice('sine', f, t, len, v, 0); env(a.g, t, 0.02, v, 0.2, 0.6, len * 0.6); a.start(); },
    pad(fs, t, len, v) {    // alas akor hangat (gergaji tersaring)
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
      const s = ac.createGain(); s.gain.value = 0.4; lp.connect(s); s.connect(verb);
      for (const f of fs) for (const det of [-6, 6]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(g); g.connect(lp);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
        o.start(t); o.stop(t + len + 0.5);
      }
    },
    shaker(t, v) {
      const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6000; s.connect(hp); hp.connect(g); g.connect(master);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); s.start(t, Math.random() * 0.5); s.stop(t + 0.08);
    },
    kick(t, v) {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      o.connect(g); g.connect(master); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.start(t); o.stop(t + 0.2);
    },
  };
  const chordNotes = ([r, q]) => [r, r + (q === 'm' ? 3 : 4), r + 7];

  // melodi: tiap ketukan kuat memakai nada akor, sisanya melangkah di tangga nada pentatonik
  function buildMelody(tr) {
    const R = rng(tr.seed * 977 + 13), bars = tr.chords.length, notes = [];
    const pool = []; for (let o = 0; o < 2; o++) for (const s of tr.scale) pool.push(tr.root + 12 + o * 12 + s);
    let idx = Math.floor(pool.length / 2);
    for (let b = 0; b < bars; b++) {
      const ch = chordNotes(tr.chords[b]).map(n => n + 12);
      for (let s = 0; s < 8; s++) {   // 8 langkah (seperdelapan) per birama
        const strong = s % 4 === 0, rest = !strong && R() < 0.35;
        if (rest) { notes.push(null); continue; }
        if (strong) {   // pilih nada akor terdekat
          let best = 0, bd = 99; pool.forEach((p, i) => { const d = Math.min(...ch.map(c => Math.abs(((p - c) % 12 + 12) % 12))); const dd = d * 3 + Math.abs(i - idx); if (dd < bd) { bd = dd; best = i; } });
          idx = best;
        } else idx = Math.max(0, Math.min(pool.length - 1, idx + [-2, -1, -1, 1, 1, 2, 0][Math.floor(R() * 7)]));
        const long = R() < 0.3;
        notes.push({n: pool[idx], len: long ? 2 : 1});
      }
    }
    return notes;
  }

  function schedule() {
    if (!cur || !ac || ac.state !== 'running') return;   // audio dijeda/terganggu (mis. iPhone merekam layar): jangan menjadwalkan apa pun
    const spb = 60 / cur.tr.bpm / 2;   // detik per seperdelapan
    // jam audio melompat jauh (tab sempat dijeda, gangguan audio iOS): lompati nada yang terlewat, jangan dikejar semua
    if (nextT < ac.currentTime - 0.1) nextT = ac.currentTime + 0.05;
    let n = 0;
    while (nextT < ac.currentTime + 0.25 && n++ < 8) {
      const tr = cur.tr, bars = tr.chords.length, total = bars * 8, s = step % total, bar = Math.floor(s / 8), inBar = s % 8;
      const loop = Math.floor(step / total), t = nextT + (inBar % 2 ? tr.swing * spb : 0);
      const ch = chordNotes(tr.chords[bar]);
      if (inBar === 0) {
        INST.bass(NOTE(ch[0] - 24), t, spb * 3.5, 0.32);
        if (tr.pad) INST.pad(ch.map(n => NOTE(n)), t, spb * 8, 0.025 * tr.pad);
      }
      if (inBar === 4) INST.bass(NOTE(ch[tr.beat ? 2 : 0] - 24), t, spb * 3, 0.24);
      // arpeggio lembut
      if (tr.beat || inBar % 2 === 0) INST.arp(NOTE(ch[[0, 1, 2, 1][inBar % 4]] + 12), t, tr.beat ? 0.06 : 0.05);   // lagu pelan: arpeggio lebih jarang
      // ketukan ringan
      if (tr.beat) {
        if (inBar === 0 || inBar === 4) INST.kick(t, 0.18 * tr.beat);
        INST.shaker(t, (inBar % 2 ? 0.035 : 0.02) * tr.beat);
      }
      // melodi masuk setelah satu putaran pengiring, lalu bergantian dengan jeda agar tidak melelahkan
      const mel = cur.mel[s];
      if (loop % 4 !== 0 && mel) INST[tr.lead](NOTE(mel.n), t, spb * mel.len * 0.9, 0.12);
      nextT += spb; step++;
    }
  }

  window.Music = {
    TRACKS: Object.keys(TRACKS),
    get playing() { return cur && cur.name; },
    play(name) {
      if (!TRACKS[name] || !ensure()) return;
      if (cur && cur.name === name) { clearTimeout(swap); swap = null; return; }
      if (cur && !swap) {   // ganti lagu: pudarkan dulu, lalu mulai lagu baru
        master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
        swap = setTimeout(() => { swap = null; cur = null; window.Music.play(name); }, 1100);
        return;
      }
      if (swap) return;
      const fadeIn = !cur;
      cur = {name, tr: TRACKS[name], mel: buildMelody(TRACKS[name])};
      step = 0; nextT = ac.currentTime + 0.1;
      if (fadeIn) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(0.0001, ac.currentTime); master.gain.linearRampToValueAtTime(vol * 0.35, ac.currentTime + 1.5); }
      if (!timer) timer = setInterval(schedule, 40);
    },
    stop() {
      clearTimeout(swap); swap = null;
      cur = null; clearInterval(timer); timer = null;
      if (master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3); setTimeout(() => { if (!cur && master) master.gain.value = vol * 0.35; }, 1500); }
    },
    resume() { if (ac && ac.state !== 'running') ac.resume().catch(() => {}); },
    pause() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master && cur) master.gain.setTargetAtTime(vol * 0.35, ac.currentTime, 0.1); },
  };
})();
