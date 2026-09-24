// Servidor: archivos estáticos + WebSocket con salas multijugador.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameRoom, AVATARS } from '../public/js/game/room.js';
import { randomCode, uid } from '../public/js/game/util.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = +process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const BOT_NAMES = ['Ash', 'Misty', 'Brock', 'Gary', 'Dawn', 'May', 'Serena', 'Cynthia', 'Red', 'Lillie', 'Hop', 'Nemona', 'Iris', 'Cilan', 'Leon', 'Marnie'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) { res.writeHead(404); res.end('404'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) {
    res.writeHead(500); res.end('500');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map(); // id -> client
const tokens = new Map(); // token -> id
const lobbies = new Map(); // code -> lobby

function send(c, msg) {
  if (c && c.ws && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}

function lobbyInfo(l) {
  return {
    code: l.code,
    name: l.name,
    public: l.public,
    started: !!l.room,
    host: l.host,
    members: l.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, bot: !!m.bot, host: m.id === l.host })),
  };
}

function broadcastLobby(l) {
  const info = { t: 'lobby', lobby: lobbyInfo(l) };
  for (const m of l.members) if (!m.bot) send(clients.get(m.id), info);
}

function publicList() {
  return [...lobbies.values()].filter((l) => l.public && !l.room && l.members.length < MAX_PLAYERS)
    .map((l) => ({ code: l.code, name: l.name, players: l.members.length }));
}

function leaveLobby(c) {
  const l = c.lobby && lobbies.get(c.lobby);
  c.lobby = null;
  if (!l) return;
  if (l.room) {
    l.room.setConnected(c.id, false);
    return;
  }
  l.members = l.members.filter((m) => m.id !== c.id);
  if (!l.members.some((m) => !m.bot)) { lobbies.delete(l.code); return; }
  if (l.host === c.id) l.host = l.members.find((m) => !m.bot).id;
  broadcastLobby(l);
}

function joinLobby(c, l) {
  if (l.room) { send(c, { t: 'error', text: 'La partida ya ha empezado.' }); return; }
  if (l.members.length >= MAX_PLAYERS) { send(c, { t: 'error', text: 'La sala está llena.' }); return; }
  leaveLobby(c);
  c.lobby = l.code;
  l.members.push({ id: c.id, name: c.name, avatar: c.avatar });
  broadcastLobby(l);
}

function startLobby(l) {
  const used = new Set(l.members.map((m) => m.name));
  const names = BOT_NAMES.filter((n) => !used.has(n));
  while (l.members.length < MAX_PLAYERS) {
    const name = names.splice(Math.floor(Math.random() * names.length), 1)[0] || 'Bot';
    l.members.push({ id: 'bot-' + uid(), name, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], bot: true });
  }
  const room = new GameRoom({
    code: l.code,
    send: (pid, msg) => send(clients.get(pid), msg),
  });
  for (const m of l.members) room.addPlayer({ id: m.id, name: m.name, isBot: !!m.bot, avatar: m.avatar });
  l.room = room;
  broadcastLobby(l);
  for (const m of l.members) if (!m.bot) send(clients.get(m.id), { t: 'gameStart', code: l.code, you: m.id });
  room.start();
}

wss.on('connection', (ws) => {
  const c = { id: 'p-' + uid(), ws, name: 'Entrenador', avatar: 'pikachu', lobby: null, alive: true };
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case 'hello': {
        c.name = String(msg.name || 'Entrenador').slice(0, 16).trim() || 'Entrenador';
        c.avatar = AVATARS.includes(msg.avatar) ? msg.avatar : 'pikachu';
        // Reconexión.
        if (msg.token && tokens.has(msg.token)) {
          const oldId = tokens.get(msg.token);
          const old = clients.get(oldId);
          const l = old && old.lobby && lobbies.get(old.lobby);
          if (l && l.room && !l.room.over) {
            if (old.ws && old.ws !== ws) try { old.ws.close(); } catch {}
            c.id = oldId;
            c.lobby = l.code;
            clients.set(c.id, c);
            c.token = msg.token;
            send(c, { t: 'welcome', id: c.id, token: c.token });
            send(c, { t: 'gameStart', code: l.code, you: c.id, resume: true });
            l.room.setConnected(c.id, true);
            return;
          }
        }
        c.token = uid('t') + uid('t');
        tokens.set(c.token, c.id);
        clients.set(c.id, c);
        send(c, { t: 'welcome', id: c.id, token: c.token });
        send(c, { t: 'rooms', list: publicList() });
        break;
      }
      case 'list': send(c, { t: 'rooms', list: publicList() }); break;
      case 'create': {
        let code;
        do code = randomCode(5); while (lobbies.has(code));
        const l = { code, name: String(msg.name || `Sala de ${c.name}`).slice(0, 30), public: !!msg.public, host: c.id, members: [], room: null, created: Date.now() };
        lobbies.set(code, l);
        joinLobby(c, l);
        break;
      }
      case 'join': {
        const l = lobbies.get(String(msg.code || '').toUpperCase().trim());
        if (!l) { send(c, { t: 'error', text: 'No existe esa sala.' }); break; }
        joinLobby(c, l);
        break;
      }
      case 'leave': leaveLobby(c); send(c, { t: 'left' }); break;
      case 'addBot': {
        const l = lobbies.get(c.lobby);
        if (!l || l.host !== c.id || l.room || l.members.length >= MAX_PLAYERS) break;
        const used = new Set(l.members.map((m) => m.name));
        const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
        l.members.push({ id: 'bot-' + uid(), name, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], bot: true });
        broadcastLobby(l);
        break;
      }
      case 'kick': {
        const l = lobbies.get(c.lobby);
        if (!l || l.host !== c.id || l.room) break;
        const m = l.members.find((x) => x.id === msg.id);
        if (!m || m.id === c.id) break;
        l.members = l.members.filter((x) => x !== m);
        if (!m.bot) { const k = clients.get(m.id); if (k) { k.lobby = null; send(k, { t: 'left', text: 'Te han expulsado de la sala.' }); } }
        broadcastLobby(l);
        break;
      }
      case 'start': {
        const l = lobbies.get(c.lobby);
        if (l && l.host === c.id && !l.room) startLobby(l);
        break;
      }
      default: {
        const l = c.lobby && lobbies.get(c.lobby);
        if (l && l.room) l.room.handle(c.id, msg);
      }
    }
  });
  ws.on('close', () => {
    if (clients.get(c.id) !== c) return;
    const l = c.lobby && lobbies.get(c.lobby);
    if (l && l.room) { l.room.setConnected(c.id, false); c.ws = null; return; }
    leaveLobby(c);
    clients.delete(c.id);
  });
});

// Bucle de juego: 20 ticks/s para todas las salas.
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  let dt = now - last;
  last = now;
  dt = Math.min(dt, 250);
  for (const l of lobbies.values()) {
    if (!l.room) continue;
    // Pasos fijos de 50 ms para que la simulación sea estable.
    l.acc = (l.acc || 0) + dt;
    while (l.acc >= 50) { l.acc -= 50; l.room.tick(50); }
    if (l.room.over && !l.overAt) l.overAt = now;
    const humansOnline = l.members.some((m) => !m.bot && clients.get(m.id)?.ws);
    if ((l.overAt && now - l.overAt > 10 * 60e3) || (!humansOnline && now - (l.idleSince ||= now) > 5 * 60e3)) {
      lobbies.delete(l.code);
    } else if (humansOnline) l.idleSince = 0;
  }
}, 50);

// Latido para detectar conexiones muertas.
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.ws) continue;
    if (!c.alive) { try { c.ws.terminate(); } catch {} continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 20000);

server.listen(PORT, () => {
  console.log(`\n  ⚡ Poké Tactics 3D en http://localhost:${PORT}\n`);
});
