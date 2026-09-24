// Efectos de sonido y música chiptune sintetizados con WebAudio (sin archivos).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.musicOn = true;
    this.lastPlay = new Map();
    try {
      const s = localStorage.getItem('pt3d-sound');
      if (s === 'off') this.enabled = false;
      if (localStorage.getItem('pt3d-music') === 'off') this.musicOn = false;
    } catch {}
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicOn) this.startMusic();
  }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('pt3d-sound', this.enabled ? 'on' : 'off'); } catch {}
    if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0;
    return this.enabled;
  }

  tone(freq, dur, { type = 'square', vol = 0.2, slide = 0, delay = 0, attack = 0.005, dest = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass', slide = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    // Evita saturar con demasiados sonidos iguales.
    const now = performance.now();
    const min = { hit: 45, crit: 60, se: 120, cast: 70, die: 60, heal: 120, shield: 120, coin: 60 }[name] || 0;
    if (min && now - (this.lastPlay.get(name) || 0) < min) return;
    this.lastPlay.set(name, now);
    switch (name) {
      case 'click': this.tone(880, 0.05, { vol: 0.08 }); break;
      case 'buy': this.tone(988, 0.07, { vol: 0.12 }); this.tone(1319, 0.12, { vol: 0.12, delay: 0.06 }); break;
      case 'sell': this.tone(660, 0.07, { vol: 0.1 }); this.tone(440, 0.12, { vol: 0.1, delay: 0.06 }); break;
      case 'reroll': this.noise(0.18, { vol: 0.12, freq: 900, slide: 3 }); this.tone(520, 0.1, { vol: 0.06, type: 'triangle', slide: 2 }); break;
      case 'level': [60, 64, 67, 72].forEach((n, i) => this.tone(NOTE(n + 12), 0.12, { vol: 0.12, delay: i * 0.07 })); break;
      case 'error': this.tone(180, 0.15, { vol: 0.12, type: 'sawtooth' }); break;
      case 'place': this.tone(440, 0.05, { vol: 0.08, type: 'triangle' }); this.tone(660, 0.06, { vol: 0.08, type: 'triangle', delay: 0.04 }); break;
      case 'pickup': this.tone(520, 0.06, { vol: 0.07, type: 'triangle', slide: 1.5 }); break;
      case 'hit': this.noise(0.08, { vol: 0.11, freq: 700 + Math.random() * 500, q: 0.8 }); break;
      case 'crit': this.noise(0.12, { vol: 0.16, freq: 1800 }); this.tone(1200, 0.08, { vol: 0.07, slide: 0.5 }); break;
      case 'se': this.tone(1568, 0.06, { vol: 0.07, type: 'triangle' }); this.tone(2093, 0.1, { vol: 0.07, type: 'triangle', delay: 0.05 }); break;
      case 'cast': this.tone(300 + Math.random() * 200, 0.25, { vol: 0.08, type: 'sawtooth', slide: 2.5 }); break;
      case 'blast': this.noise(0.35, { vol: 0.18, freq: 400, type: 'lowpass', slide: 0.3 }); break;
      case 'zap': this.noise(0.2, { vol: 0.12, freq: 3000, q: 4 }); this.tone(1400, 0.15, { vol: 0.06, type: 'square', slide: 0.4 }); break;
      case 'die': this.tone(500, 0.3, { vol: 0.1, type: 'triangle', slide: 0.25 }); break;
      case 'heal': [72, 76, 79].forEach((n, i) => this.tone(NOTE(n + 12), 0.1, { vol: 0.05, type: 'sine', delay: i * 0.05 })); break;
      case 'shield': this.tone(900, 0.2, { vol: 0.05, type: 'sine', slide: 1.5 }); break;
      case 'coin': this.tone(1976, 0.06, { vol: 0.1 }); this.tone(2637, 0.15, { vol: 0.1, delay: 0.06 }); break;
      case 'evolve': {
        const seq = [60, 64, 67, 72, 76, 79, 84];
        seq.forEach((n, i) => this.tone(NOTE(n), 0.16, { vol: 0.1, type: 'square', delay: i * 0.09 }));
        this.tone(NOTE(84), 0.6, { vol: 0.1, type: 'triangle', delay: seq.length * 0.09 });
        break;
      }
      case 'win': [67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.14, { vol: 0.1, delay: i * 0.08 })); break;
      case 'lose': [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.2, { vol: 0.1, type: 'triangle', delay: i * 0.12 })); break;
      case 'round': this.tone(NOTE(79), 0.1, { vol: 0.1 }); this.tone(NOTE(84), 0.2, { vol: 0.1, delay: 0.1 }); break;
      case 'fight': this.noise(0.4, { vol: 0.15, freq: 200, type: 'lowpass', slide: 4 }); this.tone(NOTE(55), 0.3, { vol: 0.12, type: 'sawtooth' }); break;
      case 'dyna': {
        this.tone(80, 1.2, { vol: 0.2, type: 'sawtooth', slide: 4 });
        this.noise(1.0, { vol: 0.15, freq: 150, type: 'lowpass', slide: 8 });
        break;
      }
      case 'throw': this.noise(0.3, { vol: 0.1, freq: 2000, slide: 0.3 }); break;
      case 'shake': this.tone(300, 0.08, { vol: 0.12, type: 'square' }); this.tone(250, 0.08, { vol: 0.12, type: 'square', delay: 0.1 }); break;
      case 'caught': [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.12, { vol: 0.1, delay: i * 0.1 })); break;
      case 'escape': this.tone(600, 0.3, { vol: 0.1, type: 'triangle', slide: 0.3 }); break;
      case 'badge': [72, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.18, { vol: 0.09, type: 'triangle', delay: i * 0.1 })); break;
      case 'quake': this.noise(0.6, { vol: 0.2, freq: 90, type: 'lowpass' }); break;
      case 'shiny': [96, 100, 103, 108].forEach((n, i) => this.tone(NOTE(n), 0.07, { vol: 0.05, type: 'sine', delay: i * 0.05 })); break;
      case 'splash': this.noise(0.25, { vol: 0.12, freq: 1500, q: 2 }); break;
      case 'tick': this.tone(1000, 0.03, { vol: 0.05 }); break;
    }
  }

  // ───── Música procedural ─────
  toggleMusic() {
    this.musicOn = !this.musicOn;
    try { localStorage.setItem('pt3d-music', this.musicOn ? 'on' : 'off'); } catch {}
    if (this.musicOn) this.startMusic(); else this.stopMusic();
    return this.musicOn;
  }

  setMood(mood) { this.mood = mood; }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bpm = 112;
    const step = 60 / bpm / 2;
    // Progresión alegre I–V–vi–IV y otra más tensa para el combate.
    const progs = {
      calm: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      battle: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
    };
    const melodyA = [0, 2, 4, 2, 7, 4, 2, 0, 4, 5, 7, 9, 7, 5, 4, 2];
    let i = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const prog = progs[this.mood === 'battle' ? 'battle' : 'calm'];
        const bar = Math.floor(i / 8) % prog.length;
        const chord = prog[bar];
        const beat = i % 8;
        const delay = this.nextTime - this.ctx.currentTime;
        // Bajo
        if (beat % 2 === 0) this.tone(NOTE(chord[0] - 12), step * 1.6, { type: 'triangle', vol: 0.35, delay, dest: this.musicGain });
        // Arpegio
        this.tone(NOTE(chord[beat % 3] + 12), step * 0.8, { type: 'square', vol: 0.06, delay, dest: this.musicGain });
        // Melodía cada 2 pasos
        if (beat % 2 === 0 && Math.floor(i / 32) % 2 === 1) {
          const n = chord[0] + 12 + melodyA[(i / 2) % 16];
          this.tone(NOTE(n), step * 1.8, { type: 'triangle', vol: 0.18, delay, dest: this.musicGain });
        }
        // Percusión
        if (this.mood === 'battle' && beat % 4 === 0) this.noise(0.06, { vol: 0.05, freq: 150, type: 'lowpass', delay });
        if (beat % 4 === 2) this.noise(0.04, { vol: 0.03, freq: 6000, type: 'highpass', delay });
        this.nextTime += step;
        i++;
      }
    };
    this.musicTimer = setInterval(schedule, 60);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const sfx = new Sfx();
