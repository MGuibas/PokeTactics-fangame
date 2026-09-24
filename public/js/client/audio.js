// Audio del juego: música por situación, efectos y gritos de Pokémon.
// Si en public/audio hay archivos propios (ver public/audio/LEEME.txt) se usan esos;
// si no, todo se sintetiza con WebAudio: temas chiptune originales, efectos por tipo
// y un grito procedural distinto para cada especie.
import { dexOf } from '../game/data/lore.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const EXT = /\.(ogg|mp3|m4a|wav|webm|opus|flac)$/i;
// Si falta la pista de una situación se prueba con la siguiente de la cadena.
const FALLBACK = { 'battle-gym': 'battle', 'battle-wild': 'battle', raid: 'battle-gym', champion: 'victory', gameover: 'defeat', lobby: 'menu', safari: 'planning' };
const VOL_KEY = 'pt3d-vol';

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────── Temas sintetizados (composiciones originales) ─────────────
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10] };
const _ = null;
// Melodías en grados de la escala (corcheas; null = silencio, '-' = mantener).
const THEMES = {
  menu: {
    bpm: 108, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'square', pad: true, arp: true, drums: 'soft',
    mel: [4, '-', 2, 4, 7, '-', '-', 6, 5, '-', 4, 2, 4, '-', '-', _, 2, '-', 1, 2, 4, '-', 5, 4, 2, '-', '-', '-', _, _, _, _,
      4, '-', 2, 4, 7, '-', 9, 8, 7, '-', 5, 4, 5, '-', 7, _, 8, '-', 7, 5, 4, '-', 2, 1, 0, '-', '-', '-', _, _, _, _],
  },
  planning: {
    bpm: 118, root: 62, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'square', arp: true, drums: 'light', swing: 0.12,
    mel: [0, 2, 4, _, 4, 5, 4, 2, 3, _, 3, 4, 5, '-', _, _, 4, 5, 7, _, 7, 8, 7, 5, 4, '-', '-', _, 2, 3, 4, _,
      5, '-', 4, 3, 2, _, 3, 4, 5, 7, '-', 5, 4, '-', _, _, 1, 2, 3, _, 2, 1, 0, _, 1, '-', '-', _, _, _, _, _],
  },
  safari: {
    bpm: 132, root: 65, scale: 'mixo', prog: [0, 0, 6, 3, 0, 4, 6, 4], lead: 'triangle', arp: true, drums: 'bongo', swing: 0.18,
    mel: [7, _, 4, _, 5, 7, _, 4, 2, _, 4, 5, 4, '-', _, _, 7, _, 9, _, 8, 7, _, 5, 4, _, 2, 4, 0, '-', _, _,
      4, 4, 5, _, 7, _, 4, _, 6, '-', 5, 4, 2, '-', _, _, 4, 5, 7, 9, 8, _, 7, 5, 4, _, 2, _, 0, '-', _, _],
  },
  battle: {
    bpm: 152, root: 57, scale: 'minor', prog: [0, 5, 6, 4, 0, 5, 3, 4], lead: 'square', arp: true, drums: 'battle', bassMode: 'octave',
    mel: [0, '-', 4, '-', 3, 2, 3, 4, 7, '-', 6, 4, 6, '-', 4, 3, 2, '-', 3, 4, 5, '-', 4, 2, 4, '-', '-', '-', 7, 6, 4, 3,
      0, '-', 4, '-', 3, 2, 3, 4, 9, '-', 8, 7, 8, '-', 9, 11, 10, '-', 9, 8, 7, '-', 6, 4, 7, '-', '-', '-', _, 4, 6, 7],
  },
  'battle-wild': {
    bpm: 144, root: 60, scale: 'dorian', prog: [0, 3, 0, 4, 0, 3, 6, 4], lead: 'square', arp: true, drums: 'battle', bassMode: 'octave',
    mel: [4, 3, 4, 6, 7, '-', 4, '-', 3, 2, 3, 4, 2, '-', 0, '-', 4, 3, 4, 6, 7, '-', 9, '-', 8, '-', 7, 6, 7, '-', _, _,
      2, '-', 4, 2, 3, '-', 5, 3, 4, '-', 6, 4, 5, '-', 7, '-', 6, 5, 4, 3, 2, '-', 3, 4, 0, '-', '-', '-', _, _, _, _],
  },
  'battle-gym': {
    bpm: 160, root: 55, scale: 'minor', prog: [0, 0, 5, 5, 3, 3, 4, 4], lead: 'sawtooth', arp: true, drums: 'heavy', bassMode: 'gallop',
    mel: [7, '-', 7, 6, 7, '-', 9, '-', 10, '-', 9, 7, 6, '-', 4, '-', 5, '-', 5, 4, 5, '-', 7, '-', 4, '-', 3, 2, 0, '-', '-', '-',
      7, '-', 7, 6, 7, '-', 9, '-', 10, '-', 11, 12, 14, '-', 12, '-', 11, '-', 10, 9, 10, '-', 11, 10, 9, '-', 8, '-', 11, '-', '-', '-'],
  },
  raid: {
    bpm: 138, root: 52, scale: 'minor', prog: [0, 5, 1, 4, 0, 5, 6, 4], lead: 'sawtooth', pad: true, arp: true, drums: 'heavy', bassMode: 'gallop',
    mel: [0, '-', '-', '-', 1, '-', 0, '-', 4, '-', '-', '-', 3, '-', 1, '-', 0, '-', '-', '-', 1, '-', 3, '-', 4, '-', 5, '-', 4, '-', '-', '-',
      7, '-', '-', '-', 8, '-', 7, '-', 5, '-', '-', '-', 4, '-', 3, '-', 4, '-', 5, 4, 3, '-', 1, '-', 0, '-', '-', '-', _, _, _, _],
  },
};
const DRUMS = {
  soft: { k: 'x.......x.......', s: '........', h: '..x...x...x...x.' },
  light: { k: 'x.......x..x....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  bongo: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: '.xx..x.x.xx..x.x' },
  battle: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  heavy: { k: 'x.x.x...x.xxx...', s: '....x..x....x...', h: 'x.xxx.xxx.xxx.xx' },
};

// ───────────── Sonido de habilidades por tipo ─────────────
const TYPE_SND = {
  fuego: (a, p) => { a.noise(0.45, { vol: 0.16, freq: 500, type: 'lowpass', slide: 3, pan: p }); a.noise(0.3, { vol: 0.06, freq: 3000, q: 3, delay: 0.05, pan: p }); },
  agua: (a, p) => { a.noise(0.35, { vol: 0.13, freq: 2200, q: 1.5, slide: 0.25, pan: p }); for (let i = 0; i < 4; i++) a.tone(600 + Math.random() * 900, 0.06, { type: 'sine', vol: 0.05, slide: 1.8, delay: 0.05 + i * 0.05, pan: p }); },
  planta: (a, p) => { for (let i = 0; i < 5; i++) a.noise(0.07, { vol: 0.07, freq: 3500 + i * 300, q: 2, delay: i * 0.04, pan: p }); a.tone(700, 0.2, { type: 'triangle', vol: 0.04, slide: 1.5, pan: p }); },
  electrico: (a, p) => { a.noise(0.22, { vol: 0.12, freq: 3200, q: 5, pan: p }); a.tone(1500, 0.16, { type: 'square', vol: 0.05, slide: 0.35, pan: p }); a.tone(90, 0.2, { type: 'sawtooth', vol: 0.06, pan: p }); },
  hielo: (a, p) => { [96, 100, 103, 107].forEach((n, i) => a.tone(NOTE(n), 0.25, { type: 'sine', vol: 0.04, delay: i * 0.03, pan: p })); a.noise(0.25, { vol: 0.06, freq: 7000, type: 'highpass', pan: p }); },
  lucha: (a, p) => { a.tone(160, 0.12, { type: 'sine', vol: 0.22, slide: 0.4, pan: p }); a.noise(0.08, { vol: 0.12, freq: 900, pan: p }); },
  tierra: (a, p) => { a.noise(0.6, { vol: 0.18, freq: 120, type: 'lowpass', pan: p }); a.tone(60, 0.4, { type: 'sine', vol: 0.15, slide: 0.7, pan: p }); },
  roca: (a, p) => { for (let i = 0; i < 3; i++) a.noise(0.12, { vol: 0.12, freq: 300 + i * 150, delay: i * 0.07, pan: p }); a.tone(90, 0.2, { type: 'triangle', vol: 0.1, slide: 0.6, pan: p }); },
  volador: (a, p) => { a.noise(0.4, { vol: 0.1, freq: 800, q: 0.7, slide: 3, pan: p }); },
  psiquico: (a, p) => { a.tone(420, 0.45, { type: 'sine', vol: 0.08, slide: 2.2, vib: 14, pan: p }); a.tone(640, 0.45, { type: 'sine', vol: 0.05, slide: 0.6, vib: 9, pan: p }); },
  fantasma: (a, p) => { a.tone(220, 0.6, { type: 'triangle', vol: 0.08, slide: 0.5, vib: 6, pan: p }); a.tone(233, 0.6, { type: 'triangle', vol: 0.06, slide: 0.55, vib: 7, pan: p }); },
  dragon: (a, p) => { a.tone(75, 0.6, { type: 'sawtooth', vol: 0.12, slide: 1.8, pan: p }); a.noise(0.5, { vol: 0.12, freq: 350, type: 'lowpass', slide: 2, pan: p }); },
  siniestro: (a, p) => { a.noise(0.25, { vol: 0.12, freq: 600, type: 'lowpass', slide: 0.3, pan: p }); a.tone(110, 0.25, { type: 'square', vol: 0.06, slide: 0.5, pan: p }); },
  acero: (a, p) => { a.fm(520, 0.5, { ratio: 2.76, depth: 900, vol: 0.08, pan: p }); a.noise(0.06, { vol: 0.1, freq: 4000, pan: p }); },
  hada: (a, p) => { [84, 88, 91, 96, 100].forEach((n, i) => a.tone(NOTE(n), 0.3, { type: 'sine', vol: 0.045, delay: i * 0.045, pan: p })); },
  normal: (a, p) => { a.tone(300, 0.12, { type: 'triangle', vol: 0.1, slide: 2, pan: p }); a.noise(0.1, { vol: 0.08, freq: 1200, pan: p }); },
};

class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.8, cries: 0.75 };
    this.lastPlay = new Map();
    this.mood = 'menu';
    this.files = { music: {}, sfx: {}, cries: {} };
    this.buffers = new Map();
    this.track = null;
    this.activeCries = 0;
    try {
      if (localStorage.getItem('pt3d-sound') === 'off') this.enabled = false;
      if (localStorage.getItem('pt3d-music') === 'off') this.musicOn = false;
      Object.assign(this.vol, JSON.parse(localStorage.getItem(VOL_KEY) || '{}'));
    } catch {}
    this.indexReady = this.loadIndex();
  }

  // Lista de archivos de audio propios que ofrece el servidor.
  async loadIndex() {
    let idx = null;
    try { const r = await fetch('audio/index.json', { cache: 'no-cache' }); if (r.ok) idx = await r.json(); } catch {}
    idx ||= {};
    for (const f of idx.music || []) {
      const key = f.replace(EXT, '').toLowerCase().replace(/[-_ ]\d+$/, '');
      (this.files.music[key] ||= []).push('audio/music/' + encodeURIComponent(f));
    }
    for (const f of idx.sfx || []) this.files.sfx[f.replace(EXT, '').toLowerCase()] = 'audio/sfx/' + encodeURIComponent(f);
    for (const f of idx.cries || []) { const n = parseInt(f, 10); if (n > 0) this.files.cries[n] = 'audio/cries/' + encodeURIComponent(f); }
    if (this.ctx) this.preloadSfx();
    return this.files;
  }

  counts() {
    return { music: Object.values(this.files.music).reduce((a, l) => a + l.length, 0), sfx: Object.keys(this.files.sfx).length, cries: Object.keys(this.files.cries).length };
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.out.connect(comp).connect(c.destination);
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.cryBus = c.createGain();
    this.duckGain = c.createGain();
    this.musicBus.connect(this.duckGain).connect(this.out);
    this.sfxBus.connect(this.out);
    this.cryBus.connect(this.out);
    // Reverberación corta para dar espacio.
    this.verb = c.createConvolver();
    const len = c.sampleRate * 1.4;
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb.buffer = ir;
    this.verbSend = c.createGain();
    this.verbSend.gain.value = 0.22;
    this.verbSend.connect(this.verb).connect(this.out);
    this.sfxBus.connect(this.verbSend);
    this.cryBus.connect(this.verbSend);
    const nlen = c.sampleRate * 0.6;
    this.noiseBuf = c.createBuffer(1, nlen, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.preloadSfx();
    this.applyMusic();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.enabled ? this.vol.master : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.cryBus.gain.setTargetAtTime(this.vol.cries, t, 0.05);
  }

  setVolume(kind, v) {
    this.vol[kind] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOL_KEY, JSON.stringify(this.vol)); } catch {}
    this.applyVolumes();
  }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('pt3d-sound', this.enabled ? 'on' : 'off'); } catch {}
    this.applyVolumes();
    return this.enabled;
  }

  // ───────────── Primitivas de síntesis ─────────────
  panner(dest, pan) {
    if (!pan || !this.ctx.createStereoPanner) return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(dest);
    return p;
  }

  tone(freq, dur, { type = 'square', vol = 0.2, slide = 0, delay = 0, attack = 0.005, dest = null, pan = 0, vib = 0, vibDepth = 0.02, detune = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    if (vib) {
      const l = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      l.frequency.value = vib;
      lg.gain.value = freq * vibDepth;
      l.connect(lg).connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.panner(dest || this.sfxBus, pan));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Tono FM (metálico / campanas).
  fm(freq, dur, { ratio = 2, depth = 300, vol = 0.1, delay = 0, dest = null, pan = 0, type = 'sine' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), m = this.ctx.createOscillator(), mg = this.ctx.createGain(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    m.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(depth, t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur);
    m.connect(mg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.panner(dest || this.sfxBus, pan));
    o.start(t); m.start(t); o.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass', slide = 0, dest = null, pan = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = dur > 0.55;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.panner(dest || this.sfxBus, pan));
    src.start(t, Math.random() * 0.1);
    src.stop(t + dur + 0.05);
  }

  // ───────────── Archivos ─────────────
  loadBuffer(url) {
    if (!this.ctx) return Promise.resolve(null);
    if (!this.buffers.has(url)) {
      const p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((ab) => (ab ? new Promise((res) => this.ctx.decodeAudioData(ab, res, () => res(null))) : null))
        .catch(() => null);
      p.then((b) => { p.buffer = b; });
      this.buffers.set(url, p);
    }
    return this.buffers.get(url);
  }

  preloadSfx() { for (const url of Object.values(this.files.sfx)) this.loadBuffer(url); }

  playBuffer(buf, dest, { vol = 1, rate = 1, pan = 0, delay = 0 } = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.panner(dest, pan));
    s.start(this.ctx.currentTime + delay);
    return s;
  }

  // Efecto con nombre: archivo propio si existe; si no, síntesis.
  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    const now = performance.now();
    const min = { hit: 45, crit: 60, se: 120, cast: 70, die: 60, heal: 120, shield: 120, coin: 60, shot: 70, step: 90 }[name] || 0;
    if (min && now - (this.lastPlay.get(name) || 0) < min) return;
    this.lastPlay.set(name, now);
    const url = this.files.sfx[name];
    if (url) {
      const p = this.buffers.get(url) || this.loadBuffer(url);
      if (p.buffer) { this.playBuffer(p.buffer, this.sfxBus, { vol: opt.vol ?? 1, pan: opt.pan || 0, rate: opt.rate || 1 }); return; }
    }
    this.synth(name, opt);
  }

  synth(name, opt) {
    const p = opt.pan || 0;
    switch (name) {
      case 'click': this.tone(1200, 0.04, { vol: 0.06, type: 'triangle' }); this.tone(1800, 0.03, { vol: 0.04, type: 'sine', delay: 0.02 }); break;
      case 'hover': this.tone(1600, 0.025, { vol: 0.025, type: 'sine' }); break;
      case 'buy': this.tone(988, 0.07, { vol: 0.1 }); this.tone(1319, 0.12, { vol: 0.1, delay: 0.06 }); this.tone(1976, 0.1, { vol: 0.05, type: 'sine', delay: 0.12 }); break;
      case 'sell': this.tone(1318, 0.05, { vol: 0.08 }); this.tone(1976, 0.08, { vol: 0.08, delay: 0.05 }); this.tone(2637, 0.14, { vol: 0.07, delay: 0.1 }); break;
      case 'reroll': this.noise(0.2, { vol: 0.1, freq: 900, slide: 3 }); [0, 1, 2].forEach((i) => this.tone(600 + i * 200, 0.05, { vol: 0.05, type: 'triangle', delay: i * 0.04 })); break;
      case 'level': [60, 64, 67, 72, 76].forEach((n, i) => this.tone(NOTE(n + 12), 0.14, { vol: 0.1, delay: i * 0.065 })); this.tone(NOTE(84), 0.4, { vol: 0.06, type: 'triangle', delay: 0.33 }); break;
      case 'error': this.tone(200, 0.1, { vol: 0.1, type: 'square' }); this.tone(150, 0.16, { vol: 0.1, type: 'square', delay: 0.09 }); break;
      case 'place': this.tone(330, 0.05, { vol: 0.09, type: 'triangle' }); this.noise(0.05, { vol: 0.08, freq: 600, q: 1.5 }); break;
      case 'pickup': this.tone(520, 0.08, { vol: 0.07, type: 'triangle', slide: 1.6 }); break;
      case 'equip': this.fm(880, 0.25, { ratio: 3, depth: 500, vol: 0.07 }); this.tone(1320, 0.12, { vol: 0.05, type: 'sine', delay: 0.05 }); break;
      case 'magnet': this.tone(200, 0.35, { vol: 0.08, type: 'sawtooth', slide: 3, vib: 20 }); this.fm(660, 0.3, { ratio: 1.5, depth: 300, vol: 0.06, delay: 0.25 }); break;
      case 'land': this.tone(140, 0.12, { vol: 0.15, type: 'sine', slide: 0.5 }); this.noise(0.12, { vol: 0.08, freq: 500, type: 'lowpass' }); break;
      case 'step': this.noise(0.04, { vol: 0.03, freq: 900, q: 2, pan: p }); break;
      case 'hit': this.noise(0.08, { vol: 0.1, freq: 700 + Math.random() * 500, q: 0.8, pan: p }); this.tone(140 + Math.random() * 60, 0.06, { vol: 0.08, type: 'sine', slide: 0.5, pan: p }); break;
      case 'crit': this.noise(0.14, { vol: 0.15, freq: 1800, pan: p }); this.tone(1200, 0.1, { vol: 0.07, slide: 0.5, pan: p }); this.tone(90, 0.12, { vol: 0.12, type: 'sine', slide: 0.5, pan: p }); break;
      case 'se': this.tone(1568, 0.06, { vol: 0.06, type: 'triangle' }); this.tone(2093, 0.1, { vol: 0.06, type: 'triangle', delay: 0.05 }); break;
      case 'shot': this.noise(0.08, { vol: 0.05, freq: 2400, q: 1.5, slide: 0.5, pan: p }); break;
      case 'cast': this.tone(300 + Math.random() * 200, 0.25, { vol: 0.07, type: 'sawtooth', slide: 2.5, pan: p }); break;
      case 'blast': this.noise(0.4, { vol: 0.16, freq: 400, type: 'lowpass', slide: 0.3, pan: p }); this.tone(70, 0.3, { vol: 0.12, type: 'sine', slide: 0.6, pan: p }); break;
      case 'zap': TYPE_SND.electrico(this, p); break;
      case 'die': this.tone(500, 0.35, { vol: 0.09, type: 'triangle', slide: 0.25, pan: p }); this.noise(0.25, { vol: 0.05, freq: 800, slide: 0.3, pan: p }); break;
      case 'heal': [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n + 12), 0.14, { vol: 0.045, type: 'sine', delay: i * 0.05, pan: p })); break;
      case 'shield': this.fm(700, 0.35, { ratio: 1.5, depth: 200, vol: 0.05, pan: p }); this.tone(1400, 0.25, { vol: 0.03, type: 'sine', slide: 1.3, pan: p }); break;
      case 'coin': this.tone(1976, 0.06, { vol: 0.09 }); this.tone(2637, 0.18, { vol: 0.09, delay: 0.06 }); break;
      case 'evolve': {
        const seq = [60, 64, 67, 72, 64, 67, 72, 76, 67, 72, 76, 79];
        seq.forEach((n, i) => this.tone(NOTE(n + 12), 0.1, { vol: 0.07, type: 'square', delay: i * 0.075 }));
        this.noise(0.9, { vol: 0.05, freq: 3000, slide: 3, delay: 0.1 });
        [72, 76, 79, 84].forEach((n) => this.tone(NOTE(n), 1.1, { vol: 0.05, type: 'triangle', delay: seq.length * 0.075 }));
        break;
      }
      case 'win': [67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.14, { vol: 0.09, delay: i * 0.08 })); this.tone(NOTE(88), 0.5, { vol: 0.06, type: 'triangle', delay: 0.4 }); break;
      case 'lose': [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.24, { vol: 0.09, type: 'triangle', delay: i * 0.14 })); break;
      case 'round': this.tone(NOTE(79), 0.1, { vol: 0.09 }); this.tone(NOTE(84), 0.24, { vol: 0.09, delay: 0.1 }); break;
      case 'fight': this.noise(0.5, { vol: 0.14, freq: 200, type: 'lowpass', slide: 5 }); this.tone(NOTE(45), 0.4, { vol: 0.12, type: 'sawtooth' }); this.tone(NOTE(57), 0.4, { vol: 0.06, type: 'square', delay: 0.12 }); break;
      case 'dyna': this.tone(70, 1.4, { vol: 0.18, type: 'sawtooth', slide: 4 }); this.noise(1.2, { vol: 0.14, freq: 150, type: 'lowpass', slide: 8 }); this.fm(220, 1.2, { ratio: 1.01, depth: 60, vol: 0.08, delay: 0.3 }); break;
      case 'throw': this.noise(0.35, { vol: 0.09, freq: 2000, slide: 0.3 }); break;
      case 'shake': this.tone(300, 0.08, { vol: 0.1, type: 'square' }); this.tone(250, 0.08, { vol: 0.1, type: 'square', delay: 0.1 }); break;
      case 'caught': [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.12, { vol: 0.08, delay: i * 0.1 })); break;
      case 'escape': this.tone(600, 0.3, { vol: 0.09, type: 'triangle', slide: 0.3 }); this.noise(0.2, { vol: 0.06, freq: 1500, slide: 0.4 }); break;
      case 'badge': [72, 79, 84, 88, 91].forEach((n, i) => this.tone(NOTE(n), 0.2, { vol: 0.08, type: 'triangle', delay: i * 0.09 })); break;
      case 'quake': this.noise(0.8, { vol: 0.2, freq: 90, type: 'lowpass' }); this.tone(45, 0.7, { vol: 0.15, type: 'sine' }); break;
      case 'shiny': [96, 100, 103, 108, 103, 108].forEach((n, i) => this.tone(NOTE(n), 0.08, { vol: 0.045, type: 'sine', delay: i * 0.05 })); break;
      case 'splash': this.noise(0.28, { vol: 0.11, freq: 1500, q: 2, slide: 0.5 }); break;
      case 'tick': this.tone(1000, 0.03, { vol: 0.04 }); break;
      case 'ballopen': this.tone(900, 0.06, { vol: 0.06, type: 'square', slide: 1.5 }); this.noise(0.15, { vol: 0.05, freq: 4000, type: 'highpass' }); break;
      default: if (TYPE_SND[name]) TYPE_SND[name](this, p);
    }
  }

  // Habilidad: sonido según el tipo del movimiento.
  skill(type, kind, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const now = performance.now();
    if (now - (this.lastPlay.get('skill') || 0) < 60) return;
    this.lastPlay.set('skill', now);
    const url = this.files.sfx['skill-' + type];
    if (url) {
      const p = this.buffers.get(url) || this.loadBuffer(url);
      if (p.buffer) { this.playBuffer(p.buffer, this.sfxBus, { pan }); return; }
    }
    (TYPE_SND[type] || TYPE_SND.normal)(this, pan);
    if (kind === 'global' || kind === 'nova') this.tone(55, 0.5, { type: 'sine', vol: 0.12, slide: 0.6, pan });
  }

  // ───────────── Gritos ─────────────
  // Grito de un Pokémon: archivo cries/<nº Pokédex> si existe; si no, uno procedural único por especie.
  cry(form, line, star = 1, { rate = 1, vol = 1, pan = 0 } = {}) {
    if (!this.ctx || !this.enabled || this.vol.cries <= 0) return;
    const now = performance.now();
    if (now - (this.lastPlay.get('cry') || 0) < 180 || this.activeCries >= 3) return;
    this.lastPlay.set('cry', now);
    const dex = dexOf(form, line, star);
    const mega = /-(mega|gmax|primal)$/.test(form);
    const url = this.files.cries[dex];
    this.activeCries++;
    setTimeout(() => this.activeCries--, 700);
    if (url) {
      const p = this.buffers.get(url) || this.loadBuffer(url);
      const go = (b) => b && this.playBuffer(b, this.cryBus, { vol: vol * 0.8, rate: rate * (mega ? 0.9 : 1), pan });
      if (p.buffer) go(p.buffer); else p.then(go);
      return;
    }
    this.synthCry(dex || 1, { star, rate: rate * (mega ? 0.85 : 1), vol, pan, big: mega });
  }

  synthCry(dex, { star = 1, rate = 1, vol = 1, pan = 0, big = false }) {
    const r = mulberry(dex * 7919 + 17);
    const c = this.ctx;
    const dest = this.panner(this.cryBus, pan);
    const size = [1, 0.8, 0.64][Math.max(0, Math.min(2, star - 1))] * (big ? 0.85 : 1);
    const base = (170 + r() * 560) * size * rate;
    const wave = ['square', 'sawtooth', 'triangle', 'square'][Math.floor(r() * 4)];
    const syl = 1 + Math.floor(r() * 3);
    const growl = r() < 0.45 || star >= 3;
    const ratio = [0.5, 1, 1.5, 2, 3][Math.floor(r() * 5)];
    const fmDepth = r() * 0.8;
    const vibRate = 8 + r() * 26;
    let t = c.currentTime + 0.01;
    for (let s = 0; s < syl; s++) {
      const dur = (0.08 + r() * 0.2) * (1 + (star - 1) * 0.2) * (s === syl - 1 ? 1.5 : 1);
      const f0 = base * (0.75 + r() * 0.6);
      const f1 = f0 * (0.55 + r() * 1.2);
      const o = c.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      const m = c.createOscillator(), mg = c.createGain();
      m.frequency.value = f0 * ratio;
      mg.gain.value = f0 * fmDepth;
      m.connect(mg).connect(o.frequency);
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibRate;
      lg.gain.value = f0 * 0.04;
      l.connect(lg).connect(o.frequency);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900 + f0 * 4;
      const g = c.createGain();
      const v = 0.11 * vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.015);
      g.gain.setValueAtTime(v * 0.8, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(dest);
      for (const n of [o, m, l]) { n.start(t); n.stop(t + dur + 0.05); }
      if (growl) this.noise(dur, { vol: 0.05 * vol * (star >= 3 ? 1.6 : 1), freq: f0 * 1.5, q: 3, delay: t - c.currentTime, dest, slide: f1 / f0 });
      t += dur + 0.02 + r() * 0.07;
    }
  }

  // ───────────── Música ─────────────
  toggleMusic() {
    this.musicOn = !this.musicOn;
    try { localStorage.setItem('pt3d-music', this.musicOn ? 'on' : 'off'); } catch {}
    this.applyMusic();
    return this.musicOn;
  }

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.applyMusic();
  }

  // Pistas disponibles para una situación (siguiendo la cadena de alternativas).
  trackList(mood) {
    let m = mood;
    for (let i = 0; i < 5 && m; i++) {
      const l = this.files.music[m];
      if (l?.length) return l;
      m = FALLBACK[m];
    }
    return null;
  }

  pickFile(mood) {
    const l = this.trackList(mood);
    return l ? l[Math.floor(Math.random() * l.length)] : null;
  }

  async applyMusic() {
    if (!this.ctx) return;
    await this.indexReady;
    if (!this.musicOn) { this.stopTrack(); this.stopSeq(); return; }
    const list = this.trackList(this.mood);
    if (list) {
      this.stopSeq();
      // Si ya suena una pista válida para esta situación, se mantiene.
      if (this.track && list.includes(this.track.url)) this.track.mood = this.mood;
      else this.playTrack(list[Math.floor(Math.random() * list.length)], this.mood);
    } else {
      this.stopTrack();
      this.startSeq(this.mood);
    }
  }

  playTrack(url, mood) {
    const old = this.track;
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    const src = this.ctx.createMediaElementSource(el);
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(g).connect(this.musicBus);
    el.play().catch(() => {});
    g.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 1.2);
    this.track = { el, g, mood, url };
    if (old) this.fadeOut(old);
  }

  fadeOut(tr, dur = 1) {
    try {
      tr.g.gain.cancelScheduledValues(this.ctx.currentTime);
      tr.g.gain.setValueAtTime(Math.max(0.0001, tr.g.gain.value), this.ctx.currentTime);
      tr.g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    } catch {}
    setTimeout(() => { tr.el.pause(); tr.el.src = ''; }, dur * 1000 + 100);
  }

  stopTrack() { if (this.track) { this.fadeOut(this.track, 0.6); this.track = null; } }

  // Fanfarria corta (victoria, derrota, evolución…) bajando la música un momento.
  jingle(name) {
    if (!this.ctx || !this.enabled) return;
    const file = this.musicOn && this.pickFile(name);
    const t = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setTargetAtTime(0.12, t, 0.08);
    let dur = 2.2;
    if (file) {
      const el = new Audio(file);
      const src = this.ctx.createMediaElementSource(el);
      const g = this.ctx.createGain();
      src.connect(g).connect(this.out);
      g.gain.value = this.vol.music;
      el.play().catch(() => {});
      el.addEventListener('loadedmetadata', () => { dur = Math.min(12, el.duration || dur); this.duckGain.gain.setTargetAtTime(1, this.ctx.currentTime + dur, 0.4); });
      el.addEventListener('ended', () => { src.disconnect(); });
    } else {
      this.synth({ victory: 'win', champion: 'win', defeat: 'lose', gameover: 'lose', evolution: 'evolve' }[name] || name, {});
    }
    this.duckGain.gain.setTargetAtTime(1, t + dur, 0.4);
  }

  // Secuenciador de los temas sintetizados.
  startSeq(mood) {
    const th = THEMES[mood] || THEMES[FALLBACK[mood]] || THEMES.planning;
    if (this.seq && this.seq.th === th) return;
    this.stopSeq();
    const scale = SCALES[th.scale];
    const deg = (d) => th.root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const step = 60 / th.bpm / 4; // semicorcheas
    const dr = DRUMS[th.drums] || DRUMS.light;
    const bus = this.musicBus;
    const seq = { th, i: 0, next: this.ctx.currentTime + 0.12 };
    this.seq = seq;
    const run = () => {
      if (this.seq !== seq || !this.ctx) return;
      while (seq.next < this.ctx.currentTime + 0.3) {
        const i = seq.i;
        const s16 = i % 16;
        const bar = Math.floor(i / 16);
        const chordDeg = th.prog[bar % th.prog.length];
        const swing = s16 % 2 === 1 ? step * (th.swing || 0) : 0;
        const d = seq.next - this.ctx.currentTime + swing;
        // Bajo.
        const bassNote = deg(chordDeg) - 24;
        if (th.bassMode === 'gallop') { if (s16 % 4 !== 1) this.tone(NOTE(bassNote), step * 0.9, { type: 'triangle', vol: 0.3, delay: d, dest: bus }); }
        else if (th.bassMode === 'octave') { if (s16 % 2 === 0) this.tone(NOTE(bassNote + (s16 % 4 === 2 ? 12 : 0)), step * 1.6, { type: 'triangle', vol: 0.32, delay: d, dest: bus }); }
        else if (s16 % 4 === 0) this.tone(NOTE(bassNote), step * 3.2, { type: 'triangle', vol: 0.34, delay: d, dest: bus });
        // Arpegio.
        if (th.arp && s16 % 2 === 0) {
          const k = [0, 2, 4, 7][(s16 / 2) % 4];
          this.tone(NOTE(deg(chordDeg + k) + 12), step * 1.2, { type: 'square', vol: 0.035, delay: d, dest: bus, detune: 6 });
        }
        // Pad.
        if (th.pad && s16 === 0) for (const k of [0, 2, 4]) this.tone(NOTE(deg(chordDeg + k)), step * 15, { type: 'sawtooth', vol: 0.018, attack: 0.3, delay: d, dest: bus, detune: k * 4 - 4 });
        // Melodía (corcheas), con variación ligera en la repetición.
        if (s16 % 2 === 0) {
          const mi = (i / 2) % th.mel.length;
          const n = th.mel[mi];
          if (n !== null && n !== '-') {
            let len = 1;
            while (th.mel[(mi + len) % th.mel.length] === '-' && len < 8) len++;
            const oct = Math.floor(i / 2 / th.mel.length) % 2 === 1 && len === 1 && Math.random() < 0.15 ? 7 : 0;
            this.tone(NOTE(deg(n + oct) + 12), step * 2 * len * 0.92, { type: th.lead, vol: th.lead === 'sawtooth' ? 0.05 : 0.075, delay: d, dest: bus, vib: len > 2 ? 5.5 : 0, vibDepth: 0.012, attack: 0.01 });
            if (th.lead === 'square') this.tone(NOTE(deg(n) + 24), step * 2 * len * 0.5, { type: 'sine', vol: 0.02, delay: d + 0.02, dest: bus });
          }
        }
        // Percusión.
        if (dr.k[s16] === 'x') { this.tone(150, 0.14, { type: 'sine', vol: 0.3, slide: 0.3, delay: d, dest: bus }); }
        if (dr.s[s16 % dr.s.length] === 'x') { this.noise(0.12, { vol: 0.12, freq: 1800, q: 0.8, delay: d, dest: bus }); this.tone(190, 0.07, { type: 'triangle', vol: 0.1, delay: d, dest: bus }); }
        if (dr.h[s16] === 'x') this.noise(0.03, { vol: 0.035, freq: 8000, type: 'highpass', delay: d, dest: bus });
        seq.next += step;
        seq.i++;
      }
    };
    seq.timer = setInterval(run, 50);
    run();
  }

  stopSeq() {
    if (this.seq) { clearInterval(this.seq.timer); this.seq = null; }
  }
}

export const sfx = new Sfx();
