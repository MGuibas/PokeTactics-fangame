// Transportes: WebSocket (multijugador) o sala local en el navegador (modo solitario).
import { GameRoom, AVATARS } from '../game/room.js';

export class WsTransport {
  constructor(url) {
    this.url = url;
    this.handlers = new Set();
    this.queue = [];
    this.closed = false;
    this.connect();
  }
  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      for (const m of this.queue) this.ws.send(JSON.stringify(m));
      this.queue = [];
      this.emit({ t: '_open' });
    };
    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.emit(msg);
    };
    this.ws.onclose = () => {
      this.emit({ t: '_close' });
      if (!this.closed) setTimeout(() => this.connect(), 1500);
    };
    this.ws.onerror = () => {};
  }
  emit(msg) { for (const h of this.handlers) h(msg); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }
  close() { this.closed = true; try { this.ws.close(); } catch {} }
}

const BOT_NAMES = ['Ash', 'Misty', 'Brock', 'Gary', 'Dawn', 'May', 'Serena', 'Cynthia', 'Red', 'Lillie', 'Hop', 'Nemona', 'Iris', 'Leon', 'Marnie'];

export class LocalTransport {
  constructor({ name, avatar, bots = 7 }) {
    this.handlers = new Set();
    this.id = 'me';
    this.room = new GameRoom({
      code: 'SOLO',
      send: (pid, msg) => {
        if (pid !== this.id) return;
        // Copia para imitar la red (evita compartir referencias mutables).
        const copy = JSON.parse(JSON.stringify(msg));
        this.emit(copy);
      },
    });
    this.room.addPlayer({ id: this.id, name, avatar });
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < bots; i++) {
      this.room.addPlayer({ id: 'bot' + i, name: names[i], isBot: true, avatar: AVATARS[(i * 5 + 3) % AVATARS.length] });
    }
    this.paused = false;
    setTimeout(() => {
      this.emit({ t: 'gameStart', code: 'SOLO', you: this.id, solo: true });
      this.room.start();
      this.last = performance.now();
      this.acc = 0;
      this.timer = setInterval(() => this.loop(), 25);
    }, 30);
  }
  loop() {
    const now = performance.now();
    this.acc += Math.min(250, now - this.last);
    this.last = now;
    if (this.paused) { this.acc = 0; return; }
    while (this.acc >= 50) { this.acc -= 50; this.room.tick(50); }
  }
  emit(msg) { for (const h of this.handlers) h(msg); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  send(msg) {
    if (!msg || typeof msg.t !== 'string') return;
    this.room.handle(this.id, JSON.parse(JSON.stringify(msg)));
  }
  close() { clearInterval(this.timer); }
}
