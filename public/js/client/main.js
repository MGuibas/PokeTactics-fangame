// Punto de entrada: menú, sala multijugador y arranque de la partida.
import * as THREE from 'three';
import { Engine, hexToWorld } from './engine.js';
import { Arena } from './arena.js';
import { FX } from './fx.js';
import { UnitView } from './units.js';
import { GameClient } from './game.js';
import { WsTransport, LocalTransport } from './net.js';
import { portrait } from './portraits.js';
import { sfx } from './audio.js';
import { AVATARS } from '../game/room.js';
import { FORMS, LINE_LIST } from '../game/data/pokemon.js';
import { WEATHER_IDS } from '../game/data/world.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const engine = new Engine($('scene'));
const arena = new Arena(engine);
const fx = new FX(engine);
const ctx = { scene: engine.scene, engine, fx, overlay: $('overlay') };

let prefs = { name: '', avatar: 'pikachu' };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem('pt3d-prefs') || '{}') }; } catch {}
const savePrefs = () => { try { localStorage.setItem('pt3d-prefs', JSON.stringify(prefs)); } catch {} };

// ───────── Escena de fondo del menú: Pokémon paseando por la isla ─────────
let menuUnits = [];
function startMenuScene() {
  stopMenuScene();
  engine.camTarget.set(0, 0.5, -1);
  engine.camBase.set(0, 13, 25);
  const picks = [...LINE_LIST].sort(() => Math.random() - 0.5).slice(0, 10);
  picks.forEach((l, i) => {
    const star = 1 + Math.floor(Math.random() * 3);
    const form = l.forms[star - 1] === 'eevee-evo' ? 'sylveon' : l.forms[star - 1];
    const v = new UnitView(ctx, { id: 'm' + i, form, line: l.id, star, shiny: Math.random() < 0.15, bench: true });
    v.hideBar = true;
    const x = Math.floor(Math.random() * 7), y = Math.floor(Math.random() * 8);
    v.place(hexToWorld(x, y));
    v.wanderAt = Math.random() * 3;
    menuUnits.push(v);
  });
  arena.setWeather(WEATHER_IDS[Math.floor(Math.random() * 3)] === 'sol' ? 'sol' : 'despejado', true);
}
function stopMenuScene() {
  for (const v of menuUnits) v.dispose();
  menuUnits = [];
}
engine.onUpdate((dt, t) => {
  if (!menuUnits.length) return;
  engine.camOffset.set(Math.sin(t * 0.1) * 3, 0, Math.cos(t * 0.1) * 1.5 - 1.5);
  for (const v of menuUnits) {
    v.wanderAt -= dt;
    if (v.wanderAt <= 0) {
      v.wanderAt = 2 + Math.random() * 4;
      const p = hexToWorld(Math.floor(Math.random() * 7), Math.floor(Math.random() * 8));
      if (Math.random() < 0.7) v.moveTo(p, 900, 0.35);
      else v.jump();
    }
    v.update(dt, t);
  }
});

// ───────── Menú ─────────
function showScreen(id) {
  for (const s of ['menu', 'lobby', 'help']) $(s).classList.toggle('hidden', s !== id);
}

function buildAvatarPicker() {
  const el = $('avatar-picker');
  el.innerHTML = AVATARS.map((a) => `<div class="av ${a === prefs.avatar ? 'sel' : ''}" data-a="${a}" title="${FORMS[a].name}"><img src="${portrait(a)}" alt="${FORMS[a].name}"/></div>`).join('');
  el.onclick = (e) => {
    const av = e.target.closest('.av');
    if (!av) return;
    prefs.avatar = av.dataset.a;
    savePrefs();
    sfx.unlock();
    sfx.play('click');
    el.querySelectorAll('.av').forEach((x) => x.classList.toggle('sel', x === av));
  };
}

function playerName() {
  const n = $('name-input').value.trim() || prefs.name || 'Entrenador';
  prefs.name = n;
  savePrefs();
  return n;
}

$('name-input').value = prefs.name;
$('btn-solo').onclick = () => { sfx.unlock(); startSolo(); };
$('btn-multi').onclick = () => { sfx.unlock(); openLobby(); };
$('btn-help').onclick = () => { sfx.unlock(); showScreen('help'); };
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { leaveLobby(); showScreen('menu'); }));

// ───────── Partida ─────────
let game = null;
function startGame(net, myId, solo) {
  stopMenuScene();
  for (const s of ['menu', 'lobby', 'help']) $(s).classList.add('hidden');
  engine.camTarget.set(0, 0, 3.3);
  engine.camBase.set(0, 19, 13.5);
  engine.camOffset.set(0, 0, 0);
  game = new GameClient({
    engine, arena, fx, net, myId, solo,
    onExit: () => {
      game = null;
      if (!solo) { ws = null; }
      startMenuScene();
      showScreen('menu');
    },
  });
}

function startSolo() {
  const net = new LocalTransport({ name: playerName(), avatar: prefs.avatar });
  const off = net.on((m) => {
    if (m.t === 'gameStart') { off(); startGame(net, m.you, true); }
  });
}

// ───────── Multijugador ─────────
let ws = null;
let myId = null;
let lobby = null;
function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function openLobby() {
  showScreen('lobby');
  $('lobby-browse').classList.remove('hidden');
  $('lobby-room').classList.add('hidden');
  $('lobby-status').textContent = '';
  if (location.protocol === 'file:') { $('lobby-status').textContent = 'El multijugador necesita el servidor (npm start).'; return; }
  if (!ws) connectWs();
  else ws.send({ t: 'list' });
}

function connectWs() {
  ws = new WsTransport(wsUrl());
  ws.on((m) => {
    switch (m.t) {
      case 'welcome':
        myId = m.id;
        try { sessionStorage.setItem('pt3d-token', m.token); } catch {}
        break;
      case 'rooms': renderRooms(m.list); break;
      case 'lobby': lobby = m.lobby; renderLobby(); break;
      case 'left': lobby = null; $('lobby-browse').classList.remove('hidden'); $('lobby-room').classList.add('hidden'); if (m.text) $('lobby-status').textContent = m.text; ws.send({ t: 'list' }); break;
      case 'error': $('lobby-status').textContent = m.text; sfx.play('error'); break;
      case 'gameStart': if (!game) startGame(ws, m.you, false); break;
      case '_close': if (!game) $('lobby-status').textContent = 'Sin conexión con el servidor…'; break;
      case '_open': {
        $('lobby-status').textContent = '';
        let token = null;
        try { token = sessionStorage.getItem('pt3d-token'); } catch {}
        ws.send({ t: 'hello', name: playerName(), avatar: prefs.avatar, token });
        break;
      }
    }
  });
  clearInterval(connectWs.timer);
  connectWs.timer = setInterval(() => { if (ws && !lobby && !game && !$('lobby').classList.contains('hidden')) ws.send({ t: 'list' }); }, 4000);
}

function renderRooms(list) {
  const el = $('room-list');
  if (!list.length) { el.innerHTML = '<p class="muted">No hay salas públicas. ¡Crea una!</p>'; return; }
  el.innerHTML = list.map((r) => `<div class="room-item"><div><b>${esc(r.name)}</b> <span class="muted">· ${r.players}/8</span></div><button class="btn secondary" data-code="${r.code}">Unirse</button></div>`).join('');
  el.querySelectorAll('button').forEach((b) => (b.onclick = () => ws.send({ t: 'join', code: b.dataset.code })));
}

function renderLobby() {
  if (!lobby) return;
  $('lobby-browse').classList.add('hidden');
  $('lobby-room').classList.remove('hidden');
  $('room-code').textContent = lobby.code;
  const host = lobby.host === myId;
  const slots = [];
  for (let i = 0; i < 8; i++) {
    const m = lobby.members[i];
    if (!m) { slots.push('<div class="member empty">Libre<br>(bot)</div>'); continue; }
    slots.push(`<div class="member">${host && m.id !== myId ? `<button class="kick" data-id="${m.id}" title="Expulsar">✕</button>` : ''}<img src="${portrait(m.avatar)}"/><div class="nm">${m.bot ? '🤖 ' : ''}${esc(m.name)}</div><div class="tag">${m.host ? '👑 Anfitrión' : m.id === myId ? 'Tú' : m.bot ? 'Bot' : 'Entrenador'}</div></div>`);
  }
  $('member-list').innerHTML = slots.join('');
  $('member-list').querySelectorAll('.kick').forEach((b) => (b.onclick = () => ws.send({ t: 'kick', id: b.dataset.id })));
  $('btn-start').disabled = !host;
  $('btn-addbot').disabled = !host || lobby.members.length >= 8;
  $('btn-start').textContent = host ? '¡Empezar partida!' : 'Esperando al anfitrión…';
}

function leaveLobby() {
  if (ws && lobby) ws.send({ t: 'leave' });
  lobby = null;
}

$('btn-create').onclick = () => ws && ws.send({ t: 'create', public: $('chk-public').checked, name: `Sala de ${playerName()}` });
$('btn-join').onclick = () => { const c = $('code-input').value.trim().toUpperCase(); if (c) ws && ws.send({ t: 'join', code: c }); };
$('code-input').onkeydown = (e) => { if (e.key === 'Enter') $('btn-join').click(); };
$('btn-addbot').onclick = () => ws && ws.send({ t: 'addBot' });
$('btn-start').onclick = () => ws && ws.send({ t: 'start' });
$('btn-leave').onclick = () => { leaveLobby(); $('lobby-browse').classList.remove('hidden'); $('lobby-room').classList.add('hidden'); ws && ws.send({ t: 'list' }); };

// Unirse directamente con ?sala=CODIGO
const qs = new URLSearchParams(location.search);

// ───────── Arranque ─────────
buildAvatarPicker();
startMenuScene();
showScreen('menu');
setTimeout(() => $('loading').classList.add('gone'), 300);
setTimeout(() => $('loading').remove(), 900);
if (qs.get('sala')) {
  openLobby();
  setTimeout(() => ws && ws.send({ t: 'join', code: qs.get('sala').toUpperCase() }), 400);
}
// Modo de prueba: ?auto=solo arranca directamente.
if (qs.get('auto') === 'solo') startSolo();
window.__pt3d = { engine, arena, fx, get game() { return game; } };
