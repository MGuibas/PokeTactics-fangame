// GameRoom: estado completo de una partida (autoritativo).
// Funciona igual en Node (multijugador) y en el navegador (modo solitario).

import { COLS, HALF_ROWS, BENCH_SIZE } from './hex.js';
import { LINES, FORMS, LINES_BY_COST, POOL_SIZE, EEVEE_BRANCH, formFor, traitsOfForm } from './data/pokemon.js';
import { TYPES, TRAITS } from './data/types.js';
import { ITEMS, COMPONENTS, FULL_ITEMS, combine } from './data/items.js';
import {
  WEATHER_IDS, BADGES, BADGE_IDS, EVENTS, WILD_ROUNDS, GYMS, ELITE, RAID_BOSSES,
  XP_TO_LEVEL, MAX_LEVEL, SHOP_ODDS, SHOP_SIZE, REROLL_COST, XP_COST, XP_PER_BUY, MAX_ITEMS,
  SHINY_CHANCE, STAGE_DAMAGE, roundType, roundsInStage, PHASE_TIME,
} from './data/world.js';
import { Combat, TICK_MS, toCombat } from './combat.js';
import { computeTraits } from './traits.js';
import { makeRng, uid, clamp } from './util.js';
import { botPlan, botSafari, botCombat, botBadge, botCapture } from './bot.js';

const DEX_MILESTONES = [
  [8, 'gold', 4, '+4 de oro'],
  [16, 'component', 1, 'un componente'],
  [24, 'caramelo', 1, 'un Caramelo Raro'],
  [32, 'component', 2, '2 componentes'],
  [40, 'gold', 12, '+12 de oro'],
  [50, 'full', 1, 'un objeto completo'],
  [60, 'caramelo', 2, '2 Caramelos Raros'],
];

export const AVATARS = ['pikachu', 'eevee', 'charmander', 'squirtle', 'bulbasaur', 'meowth', 'gastly', 'riolu', 'togepi', 'mimikyu', 'froakie', 'munchlax'];

export class Player {
  constructor(id, name, isBot = false, avatar = 'pikachu') {
    this.id = id;
    this.name = name;
    this.isBot = isBot;
    this.avatar = avatar;
    this.connected = !isBot;
    this.hp = 100;
    this.gold = 0;
    this.level = 1;
    this.xp = 0;
    this.streak = 0;
    this.alive = true;
    this.place = 0;
    this.board = [];
    this.bench = new Array(BENCH_SIZE).fill(null);
    this.items = [];
    this.shop = new Array(SHOP_SIZE).fill(null);
    this.locked = false;
    this.badges = [];
    this.badgeInfo = {};
    this.traitBonus = {};
    this.pendingBadge = null;
    this.capture = null;
    this.dyna = 0;
    this.dex = new Set();
    this.dexIdx = 0;
    this.lastOpp = [];
    this.ready = false;
    this.freeReroll = false;
    this.scout = null;
    this.fightId = null;
    this.dirty = true;
    this.brain = null;
    this.stats = { rerolls: 0, bought: 0, captured: 0, shinies: 0, evolutions: 0, wins: 0 };
  }
  all() { return [...this.board, ...this.bench.filter(Boolean)]; }
  maxBoard() { return this.level + (this.badges.includes('mochila') ? 1 : 0); }
  find(uidv) { return this.all().find((u) => u.uid === uidv) || null; }
  benchFree() { return this.bench.findIndex((b) => b === null); }
  boardAt(x, y) { return this.board.find((u) => u.x === x && u.y === y) || null; }
  get isAi() { return this.isBot || !this.connected; }
}

export class GameRoom {
  constructor({ code = 'LOCAL', send = () => {}, seed = Date.now() % 1e9, options = {} } = {}) {
    this.code = code;
    this.send = send;
    this.rng = makeRng(seed);
    this.seed = seed;
    this.options = { fast: false, ...options };
    this.players = [];
    this.time = 0;
    this.phase = 'lobby';
    this.stage = 1;
    this.round = 1;
    this.rtype = 'safari';
    this.phaseEnd = 0;
    this.weather = 'despejado';
    this.forecast = this.rng.pick(WEATHER_IDS.filter((w) => w !== 'despejado'));
    this.event = null;
    this.pool = {};
    for (const l of Object.values(LINES)) this.pool[l.id] = POOL_SIZE[l.cost];
    this.combats = new Map();
    this.safari = null;
    this.gymsUsed = [];
    this.roomDirty = true;
    this.ranking = [];
    this.log = [];
    this.nextCombatId = 1;
    this.over = false;
    this.pendingCaptures = new Map();
  }

  // ───────────────────────── Jugadores ─────────────────────────
  addPlayer({ id, name, isBot = false, avatar }) {
    const p = new Player(id, name, isBot, avatar || this.rng.pick(AVATARS));
    this.players.push(p);
    this.roomDirty = true;
    return p;
  }

  getPlayer(id) { return this.players.find((p) => p.id === id); }
  alive() { return this.players.filter((p) => p.alive); }

  setConnected(id, on) {
    const p = this.getPlayer(id);
    if (!p) return;
    p.connected = on;
    this.roomDirty = true;
    if (on) this.resync(p);
  }

  resync(p) {
    p.dirty = true;
    this.roomDirty = true;
    const c = this.combatOf(p.id);
    if (c && this.phase === 'combat') this.send(p.id, { t: 'cs', ...c.combat.initInfo(), viewer: p.id });
  }

  // ───────────────────────── Ciclo de juego ─────────────────────────
  start() {
    if (this.phase !== 'lobby') return;
    this.stage = 1;
    this.round = 1;
    this.beginRound();
  }

  tick(dt = TICK_MS) {
    if (this.phase === 'lobby' || this.phase === 'ended') { this.flush(); return; }
    this.time += dt;
    switch (this.phase) {
      case 'planning': this.tickPlanning(); break;
      case 'combat': this.tickCombat(dt); break;
      case 'results': if (this.time >= this.phaseEnd) this.nextRound(); break;
      case 'safari': this.tickSafari(); break;
    }
    this.flush();
  }

  beginRound() {
    this.rtype = roundType(this.stage, this.round);
    const first = this.stage === 1 && this.round === 1;
    if (this.round === 1 && this.stage >= 2) {
      this.weather = this.forecast;
      const pool = WEATHER_IDS.filter((w) => w !== this.weather);
      this.forecast = this.rng.pick(pool);
      this.rollEvent();
    }
    for (const p of this.alive()) {
      p.ready = false;
      p.freeReroll = p.badges.includes('descuento');
      if (!first) this.income(p);
      if (!p.locked || first) this.rollShop(p, true);
      p.locked = false;
      if (this.stage >= 2) p.dyna = Math.min(3, p.dyna + (p.badges.includes('dinamax') ? 1.5 : 1));
      if (this.round === 1 && [2, 3, 4].includes(this.stage)) {
        p.pendingBadge = this.badgeOptions(p);
      }
      p.dirty = true;
    }
    if (this.rtype === 'safari') this.startSafari();
    else {
      this.phase = 'planning';
      const dur = this.stage === 1 ? PHASE_TIME.planningShort : PHASE_TIME.planning;
      this.phaseEnd = this.time + (this.options.fast ? 1500 : dur);
      this.planStart = this.time;
      for (const p of this.alive()) if (p.isAi) p.botAt = this.time + (this.options.fast ? 50 : 400 + this.rng.int(4000));
    }
    this.roomDirty = true;
    this.broadcast({ t: 'round', stage: this.stage, round: this.round, rtype: this.rtype, weather: this.weather, event: this.event });
  }

  nextRound() {
    if (this.over) return;
    this.round++;
    if (this.round > roundsInStage(this.stage)) {
      this.stage++;
      this.round = 1;
      this.event = null;
    }
    this.beginRound();
  }

  income(p) {
    const base = this.stage === 1 ? [0, 0, 2, 2, 3][this.round] || 3 : 5;
    const interest = Math.min(5, Math.floor(p.gold / 10));
    const s = Math.abs(p.streak);
    const streak = s >= 5 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;
    let g = base + interest + streak;
    if (p.badges.includes('amuleto')) g += 2;
    p.gold += g;
    let xp = 2;
    if (p.badges.includes('estudio')) xp += 3;
    if (this.event?.id === 'entreno') xp += 2;
    this.addXp(p, xp);
  }

  addXp(p, n) {
    p.xp += n;
    while (p.level < MAX_LEVEL && p.xp >= XP_TO_LEVEL[p.level]) {
      p.xp -= XP_TO_LEVEL[p.level];
      p.level++;
      this.fx(p, { kind: 'levelup', level: p.level });
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
  }

  rollEvent() {
    const ids = Object.keys(EVENTS);
    const id = this.rng.pick(ids);
    this.event = { id };
    if (id === 'enjambre') {
      const t = this.rng.pick(Object.keys(TYPES).filter((t) => t !== 'normal'));
      this.event.type = t;
    }
    for (const p of this.alive()) {
      if (id === 'caramelos') this.giveItem(p, 'caramelo');
      if (id === 'regalo') this.giveItem(p, this.rng.pick(COMPONENTS));
    }
  }

  // ───────────────────────── Tienda ─────────────────────────
  rerollCost(p) {
    if (p.freeReroll) return 0;
    return this.event?.id === 'rebajas' ? 1 : REROLL_COST;
  }

  shinyChance(p) {
    let c = SHINY_CHANCE;
    if (this.event?.id === 'shiny') c *= 8;
    if (p.badges.includes('iris')) c *= 6;
    return Math.min(0.5, c);
  }

  rollShop(p, free = false) {
    const odds = SHOP_ODDS[p.level];
    for (let i = 0; i < SHOP_SIZE; i++) {
      let line = null;
      if (this.event?.id === 'enjambre' && this.rng() < 0.4) {
        const cands = Object.values(LINES).filter((l) => l.types.includes(this.event.type) && odds[l.cost - 1] > 0 && this.pool[l.id] > 0);
        if (cands.length) line = this.rng.weighted(cands, (l) => this.pool[l.id]).id;
      }
      if (!line) {
        let r = this.rng() * 100;
        let cost = 1;
        for (let c = 0; c < 5; c++) { r -= odds[c]; if (r <= 0) { cost = c + 1; break; } }
        for (let c = cost; c >= 1 && !line; c--) {
          const cands = LINES_BY_COST[c].filter((id) => this.pool[id] > 0);
          if (cands.length) line = this.rng.weighted(cands, (id) => this.pool[id]);
        }
      }
      p.shop[i] = line ? { line, shiny: this.rng() < this.shinyChance(p) } : null;
    }
    p.dirty = true;
  }

  // ───────────────────────── Acciones del jugador ─────────────────────────
  handle(pid, msg) {
    const p = this.getPlayer(pid);
    if (!p || !msg || typeof msg.t !== 'string') return;
    if (!p.alive && !['emote', 'chat', 'scout'].includes(msg.t)) return;
    switch (msg.t) {
      case 'buy': this.buy(p, msg.slot | 0); break;
      case 'sell': this.sell(p, msg.uid); break;
      case 'reroll': this.reroll(p); break;
      case 'xp': this.buyXp(p); break;
      case 'lock': p.locked = !p.locked; p.dirty = true; break;
      case 'move': this.move(p, msg.uid, msg.to); break;
      case 'equip': this.equip(p, msg.idx | 0, msg.uid); break;
      case 'badge': this.pickBadge(p, msg.id); break;
      case 'safari': this.safariPick(p, msg.id); break;
      case 'capture': this.tryCapture(p, +msg.q || 0); break;
      case 'dynamax': this.dynamax(p, msg.uid); break;
      case 'ready': if (this.phase === 'planning') { p.ready = !!msg.v; this.roomDirty = true; } break;
      case 'scout': this.setScout(p, msg.id || null); break;
      case 'emote': this.broadcast({ t: 'emote', from: p.id, e: String(msg.e || '').slice(0, 16) }); break;
      case 'chat': {
        const text = String(msg.text || '').slice(0, 140).trim();
        if (text) this.broadcast({ t: 'chat', from: p.id, name: p.name, text });
        break;
      }
      case 'autoplace': this.autoPlace(p); break;
    }
  }

  canShop(p) {
    return p.alive && ['planning', 'combat', 'results'].includes(this.phase);
  }

  buy(p, slot) {
    if (!this.canShop(p)) return false;
    const s = p.shop[slot];
    if (!s) return false;
    const line = LINES[s.line];
    if (p.gold < line.cost || this.pool[s.line] <= 0) return false;
    const benchOnly = this.phase === 'combat';
    let idx = p.benchFree();
    if (idx < 0) {
      // Permitir si completa una evolución.
      const same = (benchOnly ? p.bench.filter(Boolean) : p.all()).filter((u) => u.line === s.line && u.star === 1);
      if (same.length < 2) { this.fx(p, { kind: 'toast', text: '¡Tu banquillo está lleno!' }); return false; }
    }
    p.gold -= line.cost;
    this.pool[s.line]--;
    p.shop[slot] = null;
    const u = this.makeUnit(s.line, 1, s.shiny);
    if (s.shiny) p.stats.shinies++;
    p.stats.bought++;
    if (idx >= 0) p.bench[idx] = u;
    else p.limbo = u;
    this.register(p, u);
    this.checkCombine(p);
    if (p.limbo) { this.pool[s.line]++; p.gold += line.cost; p.limbo = null; }
    p.dirty = true;
    return true;
  }

  makeUnit(line, star = 1, shiny = false, form = null) {
    return { uid: uid('p'), line, star, form: form || formFor(line, star), shiny: !!shiny, items: [], fr: 0 };
  }

  register(p, u) {
    const before = p.dex.size;
    p.dex.add(u.form);
    if (p.dex.size !== before) {
      while (p.dexIdx < DEX_MILESTONES.length && p.dex.size >= DEX_MILESTONES[p.dexIdx][0]) {
        const [n, kind, amt, txt] = DEX_MILESTONES[p.dexIdx];
        p.dexIdx++;
        if (kind === 'gold') p.gold += amt;
        else if (kind === 'component') for (let i = 0; i < amt; i++) this.giveItem(p, this.rng.pick(COMPONENTS));
        else if (kind === 'caramelo') for (let i = 0; i < amt; i++) this.giveItem(p, 'caramelo');
        else if (kind === 'full') this.giveItem(p, this.rng.pick(FULL_ITEMS));
        this.fx(p, { kind: 'toast', text: `📕 ¡Pokédex: ${n} especies registradas! Recompensa: ${txt}.`, big: true });
      }
    }
  }

  giveItem(p, id) {
    p.items.push(id);
    if (p.items.length > MAX_ITEMS + 4) p.items.length = MAX_ITEMS + 4;
    p.dirty = true;
  }

  copies(u) { return Math.pow(3, u.star - 1); }

  sellValue(u) {
    const cost = LINES[u.line].cost;
    const c = this.copies(u);
    return Math.max(1, cost * c - (u.star > 1 && cost > 1 ? 1 : 0));
  }

  sell(p, uidv) {
    if (!this.canShop(p)) return false;
    const u = p.find(uidv);
    if (!u) return false;
    if (this.phase === 'combat' && p.board.includes(u)) return false;
    this.removeUnit(p, u);
    p.gold += this.sellValue(u);
    this.pool[u.line] += this.copies(u);
    for (const it of u.items) this.giveItem(p, it);
    p.dirty = true;
    this.roomDirty = true;
    return true;
  }

  removeUnit(p, u) {
    const bi = p.board.indexOf(u);
    if (bi >= 0) p.board.splice(bi, 1);
    const i = p.bench.indexOf(u);
    if (i >= 0) p.bench[i] = null;
    if (p.limbo === u) p.limbo = null;
  }

  reroll(p) {
    if (!this.canShop(p)) return false;
    const c = this.rerollCost(p);
    if (p.gold < c) return false;
    p.gold -= c;
    p.freeReroll = false;
    p.stats.rerolls++;
    this.rollShop(p);
    return true;
  }

  buyXp(p) {
    if (!this.canShop(p) || p.level >= MAX_LEVEL || p.gold < XP_COST) return false;
    p.gold -= XP_COST;
    this.addXp(p, XP_PER_BUY);
    p.dirty = true;
    this.roomDirty = true;
    return true;
  }

  // to = {type:'board', x, y} | {type:'bench', i}
  move(p, uidv, to) {
    if (!to || !['planning', 'combat', 'results'].includes(this.phase)) return false;
    const u = p.find(uidv);
    if (!u) return false;
    const inCombat = this.phase === 'combat';
    const fromBoard = p.board.includes(u);
    if (inCombat && (fromBoard || to.type === 'board')) return false;
    if (to.type === 'board') {
      const x = to.x | 0, y = to.y | 0;
      if (x < 0 || x >= COLS || y < 0 || y >= HALF_ROWS) return false;
      const other = p.boardAt(x, y);
      if (other === u) return true;
      if (fromBoard) {
        if (other) { other.x = u.x; other.y = u.y; }
        u.x = x; u.y = y;
      } else {
        const bi = p.bench.indexOf(u);
        if (other) {
          // intercambio banquillo <-> tablero
          p.board.splice(p.board.indexOf(other), 1);
          p.bench[bi] = other;
          delete other.x; delete other.y;
        } else {
          if (p.board.length >= p.maxBoard()) {
            this.fx(p, { kind: 'toast', text: `Máximo ${p.maxBoard()} Pokémon en el tablero. ¡Sube de nivel!` });
            return false;
          }
          p.bench[bi] = null;
        }
        u.x = x; u.y = y;
        p.board.push(u);
      }
    } else if (to.type === 'bench') {
      const i = to.i | 0;
      if (i < 0 || i >= BENCH_SIZE) return false;
      const other = p.bench[i];
      if (other === u) return true;
      if (fromBoard) {
        const ox = u.x, oy = u.y;
        p.board.splice(p.board.indexOf(u), 1);
        delete u.x; delete u.y;
        if (other) { other.x = ox; other.y = oy; p.board.push(other); }
        p.bench[i] = u;
      } else {
        const bi = p.bench.indexOf(u);
        p.bench[bi] = other;
        p.bench[i] = u;
      }
    } else return false;
    p.dirty = true;
    this.roomDirty = true;
    return true;
  }

  autoPlace(p) {
    if (this.phase === 'combat') return;
    // Rellena el tablero con los mejores del banquillo.
    const bench = p.bench.filter(Boolean).sort((a, b) => b.star * 10 + LINES[b.line].cost - (a.star * 10 + LINES[a.line].cost));
    for (const u of bench) {
      if (p.board.length >= p.maxBoard()) break;
      const spot = this.freeSpot(p, u);
      if (!spot) break;
      p.bench[p.bench.indexOf(u)] = null;
      u.x = spot[0]; u.y = spot[1];
      p.board.push(u);
    }
    p.dirty = true;
    this.roomDirty = true;
  }

  freeSpot(p, u) {
    const f = FORMS[u.form];
    const ranged = LINES[u.line].stats.range > 1;
    const rows = ranged ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const cols = [3, 2, 4, 1, 5, 0, 6];
    for (const y of rows) for (const x of cols) if (!p.boardAt(x, y)) return [x, y];
    return null;
  }

  equip(p, idx, uidv) {
    const it = p.items[idx];
    const u = p.find(uidv);
    if (!it || !u) return false;
    const def = ITEMS[it];
    if (it === 'caramelo') {
      // Copia básica de la línea.
      const i = p.benchFree();
      const benchOnly = this.phase === 'combat';
      const same = (benchOnly ? p.bench.filter(Boolean) : p.all()).filter((x) => x.line === u.line && x.star === 1);
      if (i < 0 && same.length < 2) { this.fx(p, { kind: 'toast', text: 'No hay sitio en el banquillo.' }); return false; }
      p.items.splice(idx, 1);
      const nu = this.makeUnit(u.line, 1, false);
      if (i >= 0) p.bench[i] = nu; else p.limbo = nu;
      if (this.pool[u.line] > 0) this.pool[u.line]--;
      this.fx(p, { kind: 'toast', text: `🍬 ¡Un ${FORMS[nu.form].name} se une a tu equipo!` });
      this.register(p, nu);
      this.checkCombine(p);
      if (p.limbo) p.limbo = null;
      p.dirty = true;
      return true;
    }
    if (def.component && u.items.length) {
      const last = u.items[u.items.length - 1];
      if (ITEMS[last]?.component) {
        const full = combine(last, it);
        if (full) {
          u.items[u.items.length - 1] = full;
          p.items.splice(idx, 1);
          this.fx(p, { kind: 'item', uid: u.uid, item: full });
          p.dirty = true; this.roomDirty = true;
          return true;
        }
      }
    }
    if (u.items.length >= 3) { this.fx(p, { kind: 'toast', text: 'Máximo 3 objetos por Pokémon.' }); return false; }
    u.items.push(it);
    p.items.splice(idx, 1);
    this.fx(p, { kind: 'item', uid: u.uid, item: it });
    p.dirty = true;
    this.roomDirty = true;
    return true;
  }

  // ───────────────────────── Evoluciones ─────────────────────────
  checkCombine(p) {
    let changed = true;
    while (changed) {
      changed = false;
      const benchOnly = this.phase === 'combat';
      const pool = benchOnly ? p.bench.filter(Boolean) : p.all();
      if (p.limbo) pool.push(p.limbo);
      const groups = new Map();
      for (const u of pool) {
        if (u.star >= 3) continue;
        const k = u.line + ':' + u.star;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(u);
      }
      for (const g of groups.values()) {
        if (g.length < 3) continue;
        g.sort((a, b) => (p.board.includes(b) ? 1 : 0) - (p.board.includes(a) ? 1 : 0));
        const trio = g.slice(0, 3);
        this.evolve(p, trio);
        changed = true;
        break;
      }
    }
  }

  evolve(p, trio) {
    const keep = trio.find((u) => p.board.includes(u)) || trio.find((u) => p.bench.includes(u)) || trio[0];
    const others = trio.filter((u) => u !== keep);
    const fromForm = keep.form;
    const star = keep.star + 1;
    let form = formFor(keep.line, star);
    if (keep.line === 'eevee') {
      if (star === 2) form = this.eeveeBranch(p);
      else {
        const cnt = {};
        for (const u of trio) cnt[u.form] = (cnt[u.form] || 0) + 1;
        form = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      }
    }
    const items = [...keep.items];
    for (const o of others) {
      for (const it of o.items) {
        if (items.length < 3) items.push(it);
        else this.giveItem(p, it);
      }
      this.removeUnit(p, o);
      if (p.limbo === o) p.limbo = null;
    }
    // Si keep estaba en limbo, colócalo en un hueco del banquillo liberado.
    if (p.limbo === keep) {
      const i = p.benchFree();
      if (i >= 0) { p.bench[i] = keep; p.limbo = null; }
    }
    keep.star = star;
    keep.form = form;
    keep.items = items;
    keep.shiny = trio.some((u) => u.shiny);
    keep.fr = Math.max(...trio.map((u) => u.fr || 0));
    p.stats.evolutions++;
    this.register(p, keep);
    const txt = FORMS[fromForm].name === FORMS[form].name
      ? `¡${FORMS[form].name} ha subido a ${'★'.repeat(star)}!`
      : `¡${FORMS[fromForm].name} ha evolucionado a ${FORMS[form].name}!`;
    this.fx(p, { kind: 'evolve', uid: keep.uid, from: fromForm, to: form, star, text: txt });
    p.dirty = true;
    this.roomDirty = true;
  }

  eeveeBranch(p) {
    const counts = computeTraits(p.board.filter((u) => u.line !== 'eevee'), p.traitBonus);
    let best = [], bn = 0;
    for (const [t, br] of Object.entries(EEVEE_BRANCH)) {
      const n = counts[t] || 0;
      if (n > bn) { bn = n; best = [br]; } else if (n === bn && n > 0) best.push(br);
    }
    if (!best.length) best = Object.values(EEVEE_BRANCH);
    return this.rng.pick(best);
  }

  // ───────────────────────── Medallas ─────────────────────────
  badgeOptions(p) {
    const avail = BADGE_IDS.filter((b) => !p.badges.includes(b) || b === 'emblema');
    return this.rng.shuffle([...avail]).slice(0, 3);
  }

  pickBadge(p, id) {
    if (!p.pendingBadge || !p.pendingBadge.includes(id)) return false;
    p.pendingBadge = null;
    p.badges.push(id);
    switch (id) {
      case 'bolsa': p.gold += 18; break;
      case 'caramelos': this.giveItem(p, 'caramelo'); this.giveItem(p, 'caramelo'); break;
      case 'maletin': for (let i = 0; i < 3; i++) this.giveItem(p, this.rng.pick(COMPONENTS)); break;
      case 'ultraball': p.gold += 6; break;
      case 'emblema': {
        const t = this.rng.pick(Object.keys(TYPES));
        p.traitBonus[t] = (p.traitBonus[t] || 0) + 1;
        p.badgeInfo.emblema = [...(p.badgeInfo.emblema || []), t];
        this.fx(p, { kind: 'toast', text: `🏅 ¡Emblema de tipo ${TYPES[t].name}!` });
        break;
      }
    }
    this.fx(p, { kind: 'badge', id });
    p.dirty = true;
    this.roomDirty = true;
    return true;
  }

  // ───────────────────────── Fase de planificación ─────────────────────────
  tickPlanning() {
    for (const p of this.alive()) {
      if (p.isAi && p.botAt && this.time >= p.botAt) {
        p.botAt = 0;
        if (p.pendingBadge) botBadge(this, p);
        if (p.capture) botCapture(this, p);
        botPlan(this, p);
        p.ready = true;
      }
    }
    const humans = this.alive().filter((p) => !p.isAi);
    const allReady = humans.length > 0 && humans.every((p) => p.ready) && this.time - this.planStart > 2500
      && this.alive().filter((p) => p.isAi).every((p) => !p.botAt);
    const noHumans = humans.length === 0 && this.time - this.planStart > 1500 && this.alive().every((p) => !p.botAt);
    if (this.time >= this.phaseEnd || allReady || noHumans) this.startCombat();
  }

  startCombat() {
    for (const p of this.alive()) {
      if (p.pendingBadge) this.pickBadge(p, this.rng.pick(p.pendingBadge));
      if (p.capture) { this.fx(p, { kind: 'toast', text: `¡El ${FORMS[p.capture.form].name} salvaje huyó!` }); p.capture = null; }
      if (p.board.length < p.maxBoard()) this.autoPlace(p);
      p.ready = false;
    }
    this.phase = 'combat';
    this.combats.clear();
    const alive = this.alive();
    if (this.rtype === 'pvp') {
      const pairs = this.makePairs(alive);
      for (const [a, b, ghost] of pairs) this.createCombat(a, b, ghost);
    } else {
      for (const p of alive) this.createPve(p);
    }
    this.phaseEnd = this.time + PHASE_TIME.combatMax + 2000;
    this.roomDirty = true;
  }

  makePairs(alive) {
    let best = null, bestScore = 1e9;
    for (let tries = 0; tries < 24; tries++) {
      const arr = this.rng.shuffle([...alive]);
      let score = 0;
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const a = arr[i], b = arr[i + 1];
        const ia = a.lastOpp.indexOf(b.id);
        if (ia >= 0) score += 10 - ia;
      }
      if (score < bestScore) { bestScore = score; best = arr; }
      if (score === 0) break;
    }
    const pairs = [];
    for (let i = 0; i + 1 < best.length; i += 2) pairs.push([best[i], best[i + 1], false]);
    if (best.length % 2 === 1) {
      const last = best[best.length - 1];
      const others = alive.filter((p) => p !== last);
      if (others.length) pairs.push([last, this.rng.pick(others), true]);
    }
    for (const [a, b, ghost] of pairs) {
      a.lastOpp = [b.id, ...a.lastOpp].slice(0, 3);
      if (!ghost) b.lastOpp = [a.id, ...b.lastOpp].slice(0, 3);
    }
    return pairs;
  }

  sideOf(p, sideIdx, extra = {}) {
    return {
      playerId: p.id,
      name: p.name,
      units: p.board.map((u) => {
        const [x, y] = toCombat(u.x, u.y, sideIdx);
        return { uid: u.uid, line: u.line, form: u.form, star: u.star, shiny: u.shiny, items: [...u.items], fr: u.fr, x, y };
      }),
      badges: [...p.badges],
      traits: computeTraits(p.board, p.traitBonus),
      ...extra,
    };
  }

  createCombat(a, b, ghost) {
    const id = 'f' + this.nextCombatId++;
    const combat = new Combat({
      id,
      sides: [this.sideOf(a, 0), this.sideOf(b, 1, { ghost })],
      weather: this.weather,
      stage: this.stage,
      seed: this.rng.int(1e9),
      kind: 'pvp',
      title: ghost ? `vs. ${b.name} (eco)` : `${a.name} vs. ${b.name}`,
    });
    const entry = { id, combat, players: ghost ? [a.id] : [a.id, b.id], home: a.id, away: ghost ? null : b.id, ghost, ended: false };
    this.combats.set(id, entry);
    a.fightId = id;
    if (!ghost) b.fightId = id;
    this.sendCombatInit(entry);
  }

  pveLineup(p) {
    const key = `${this.stage}-${this.round}`;
    let title = 'Pokémon salvajes', units = [], kind = 'pve', boss = false, leader = null;
    if (WILD_ROUNDS[key]) {
      units = WILD_ROUNDS[key].units.map(([l, s, x, y]) => {
        let line = l;
        if (l === 'random1') line = this.rng.pick(LINES_BY_COST[1].filter((id) => id !== 'magikarp'));
        if (l === 'random2') line = this.rng.pick(LINES_BY_COST[2].filter((id) => id !== 'eevee'));
        return { line, star: s, x, y };
      });
    } else if (this.stage <= 3) {
      if (!this.gymToday || this.gymToday.stage !== this.stage) {
        const avail = GYMS.filter((g) => !this.gymsUsed.includes(g.name));
        const g = this.rng.pick(avail.length ? avail : GYMS);
        this.gymsUsed.push(g.name);
        this.gymToday = { stage: this.stage, g };
      }
      leader = this.gymToday.g;
      title = `${leader.icon} ¡${leader.title} te desafía!`;
      kind = 'gym';
      units = leader.units.map(([line, s, x, y, form]) => ({ line, star: Math.min(3, s + (this.stage >= 3 ? 1 : 0)), x, y, form }));
    } else if (this.stage === 4) {
      if (!this.eliteToday) this.eliteToday = this.rng.pick(ELITE);
      leader = this.eliteToday;
      title = `${leader.icon} ¡${leader.title} te desafía!`;
      kind = 'gym';
      units = leader.units.map(([line, s, x, y, form]) => ({ line, star: Math.min(3, s), x, y, form }));
    } else {
      if (!this.raidToday || this.raidToday.stage !== this.stage) this.raidToday = { stage: this.stage, line: this.rng.pick(RAID_BOSSES) };
      const line = this.raidToday.line;
      title = `🔴 ¡Incursión Dinamax: ${FORMS[LINES[line].forms[0]].name} legendario!`;
      kind = 'raid';
      boss = true;
      units = [{ line, star: this.stage >= 6 ? 3 : 2, x: 3, y: 1 }];
    }
    return { title, units, kind, boss };
  }

  createPve(p) {
    const id = 'f' + this.nextCombatId++;
    if (!this.pveCache || this.pveCache.key !== `${this.stage}-${this.round}`) {
      this.pveCache = { key: `${this.stage}-${this.round}`, lineup: this.pveLineup(p) };
    }
    const lu = this.pveCache.lineup;
    const pveSide = {
      playerId: 'pve',
      name: lu.title,
      units: lu.units.map((u) => {
        const [x, y] = toCombat(u.x, u.y, 1);
        const form = u.form || formFor(u.line, u.star);
        return { uid: 'w' + uid(), line: u.line, form, star: u.star, shiny: false, items: [], x, y };
      }),
      badges: [],
      traits: {},
      pve: true,
    };
    const combat = new Combat({
      id,
      sides: [this.sideOf(p, 0), pveSide],
      weather: this.weather,
      stage: this.stage,
      seed: this.rng.int(1e9),
      kind: lu.kind,
      title: lu.title,
      boss: lu.boss,
      timeLimit: lu.boss ? 40000 : 42000,
    });
    const entry = { id, combat, players: [p.id], home: p.id, away: null, pve: true, lineup: lu, ended: false };
    this.combats.set(id, entry);
    p.fightId = id;
    this.sendCombatInit(entry);
  }

  viewersOf(entry) {
    const v = new Set(entry.players);
    for (const p of this.players) {
      if (p.scout && entry.players.includes(p.scout)) v.add(p.id);
    }
    return v;
  }

  sendCombatInit(entry, only = null) {
    const info = entry.combat.initInfo();
    for (const pid of only ? [only] : this.viewersOf(entry)) this.send(pid, { t: 'cs', ...info, viewer: pid });
  }

  combatOf(pid) {
    for (const e of this.combats.values()) if (e.players.includes(pid)) return e;
    return null;
  }

  setScout(p, target) {
    if (target === p.id) target = null;
    p.scout = target;
    p.dirty = true;
    if (this.phase === 'combat') {
      const e = target ? this.combatOf(target) : this.combatOf(p.id);
      if (e) this.sendCombatInit(e, p.id);
    }
  }

  dynamax(p, uidv) {
    if (this.phase !== 'combat') return false;
    const need = p.badges.includes('dinamax') ? 2 : 3;
    if (p.dyna < need) return false;
    const e = this.combatOf(p.id);
    if (!e || e.ended) return false;
    const side = e.home === p.id ? 0 : 1;
    if (e.combat.dynamax(side, uidv, p.badges.includes('dinamax'))) {
      p.dyna = 0;
      p.dirty = true;
      return true;
    }
    return false;
  }

  tickCombat(dt) {
    let allDone = true;
    for (const e of this.combats.values()) {
      if (e.ended) continue;
      const c = e.combat;
      // IA: Dinamax de bots.
      for (const pid of e.players) {
        const p = this.getPlayer(pid);
        if (p && p.isAi) botCombat(this, p, e);
      }
      const events = c.step(dt);
      const snap = c.snapshot();
      const msg = { t: 'ct', id: e.id, time: c.t, u: snap, ev: events };
      for (const pid of this.viewersOf(e)) this.send(pid, msg);
      if (c.done) this.finishCombat(e);
      else allDone = false;
    }
    if (allDone || this.time >= this.phaseEnd) {
      for (const e of this.combats.values()) if (!e.ended) { e.combat.done = true; e.combat.result = e.combat.result || { winner: -1, survivors: [[], []], gold: [0, 0], stats: [] }; this.finishCombat(e); }
      this.endCombatPhase();
    }
  }

  playerDamage(survivors) {
    let d = STAGE_DAMAGE[Math.min(this.stage, STAGE_DAMAGE.length - 1)];
    for (const s of survivors) d += s.star;
    return d;
  }

  finishCombat(e) {
    e.ended = true;
    const r = e.combat.result;
    const home = this.getPlayer(e.home);
    const away = e.away ? this.getPlayer(e.away) : null;
    const dmg = {};
    const hurt = (p, amount) => {
      if (!p) return;
      p.hp -= amount;
      dmg[p.id] = amount;
      p.dirty = true;
    };
    const win = (p) => { if (!p) return; p.streak = p.streak > 0 ? p.streak + 1 : 1; p.stats.wins++; };
    const lose = (p) => { if (!p) return; p.streak = p.streak < 0 ? p.streak - 1 : -1; };
    let loot = null;
    if (e.pve) {
      if (r.winner === 0) {
        win(home);
        loot = this.pveLoot(home, e);
      } else {
        lose(home);
        const base = this.stage === 1 ? 1 : this.playerDamage([]) ;
        hurt(home, e.lineup.kind === 'raid' ? 6 + this.stage : base + r.survivors[1].reduce((a, s) => a + s.star, 0));
        if (this.stage === 1) { this.giveItem(home, this.rng.pick(COMPONENTS)); loot = { items: 1, consolation: true }; }
      }
    } else {
      if (r.winner === 0) {
        win(home); home.gold += 1;
        if (away) { lose(away); hurt(away, this.playerDamage(r.survivors[0])); }
      } else if (r.winner === 1) {
        lose(home); hurt(home, this.playerDamage(r.survivors[1]));
        if (away) { win(away); away.gold += 1; }
      } else {
        lose(home); hurt(home, this.playerDamage([]));
        if (away) { lose(away); hurt(away, this.playerDamage([])); }
      }
    }
    // Oro de Día de Pago.
    if (home && r.gold[0]) { home.gold += r.gold[0]; }
    if (away && r.gold[1]) { away.gold += r.gold[1]; }
    // Amistad.
    for (const p of [home, away]) {
      if (!p) continue;
      const inc = p.badges.includes('amistad') ? 2 : 1;
      for (const u of p.board) u.fr = Math.min(5, (u.fr || 0) + inc);
      p.fightId = null;
      p.dirty = true;
    }
    const msg = { t: 'ce', id: e.id, winner: r.winner, dmg, stats: r.stats, loot, home: e.home, away: e.away, pve: !!e.pve, gold: r.gold };
    for (const pid of this.viewersOf(e)) this.send(pid, msg);
    this.roomDirty = true;
  }

  pveLoot(p, e) {
    const lu = e.lineup;
    const loot = { items: 0, gold: 0 };
    if (lu.kind === 'pve') {
      const n = this.stage === 1 ? (this.round === 4 ? 2 : 1) : 2;
      for (let i = 0; i < n; i++) this.giveItem(p, this.rng.pick(COMPONENTS));
      loot.items = n;
      if (this.round >= 3) { p.gold += 1; loot.gold = 1; }
      // Oportunidad de captura.
      const wild = this.rng.pick(lu.units);
      p.capture = { line: wild.line, form: formFor(wild.line, 1), shiny: this.rng() < this.shinyChance(p) * 2 };
      loot.capture = p.capture;
    } else if (lu.kind === 'gym') {
      const n = this.stage >= 4 ? 3 : 2;
      for (let i = 0; i < n; i++) this.giveItem(p, this.rng.pick(COMPONENTS));
      p.gold += 3;
      loot.items = n; loot.gold = 3;
      if (this.stage >= 3) { this.giveItem(p, 'caramelo'); loot.caramelo = 1; }
    } else if (lu.kind === 'raid') {
      const line = lu.units[0].line;
      const u = this.makeUnit(line, 1, this.rng() < 0.2);
      const i = p.benchFree();
      if (i >= 0) { p.bench[i] = u; this.register(p, u); this.checkCombine(p); loot.legend = u.form; }
      else { p.gold += 5; loot.gold = 5; }
      for (let k = 0; k < 2; k++) this.giveItem(p, this.rng.pick(FULL_ITEMS));
      loot.items = 2;
    }
    p.dirty = true;
    return loot;
  }

  endCombatPhase() {
    // Eliminaciones.
    const dead = this.alive().filter((p) => p.hp <= 0).sort((a, b) => a.hp - b.hp);
    for (const p of dead) {
      p.alive = false;
      p.hp = 0;
      p.place = this.alive().length + 1;
      this.ranking.unshift({ id: p.id, name: p.name, place: p.place });
      for (const u of p.all()) this.pool[u.line] += this.copies(u);
      p.board = []; p.bench = new Array(BENCH_SIZE).fill(null);
      this.fx(p, { kind: 'eliminated', place: p.place });
      this.broadcast({ t: 'toast', text: `💀 ${p.name} ha sido eliminado (${p.place}º)` });
      p.dirty = true;
    }
    for (const p of this.alive()) this.checkCombine(p);
    const alive = this.alive();
    if (alive.length <= 1) {
      this.over = true;
      if (alive[0]) {
        alive[0].place = 1;
        this.ranking.unshift({ id: alive[0].id, name: alive[0].name, place: 1 });
      }
      this.phase = 'ended';
      this.broadcast({ t: 'gameover', ranking: this.ranking, players: this.players.map((p) => ({ id: p.id, name: p.name, place: p.place, avatar: p.avatar, stats: p.stats, board: p.board.map((u) => ({ form: u.form, star: u.star, shiny: u.shiny })) })) });
      this.roomDirty = true;
      return;
    }
    this.phase = 'results';
    this.phaseEnd = this.time + (this.options.fast ? 200 : PHASE_TIME.results);
    this.roomDirty = true;
  }

  // ───────────────────────── Captura ─────────────────────────
  tryCapture(p, q) {
    if (!p.capture || this.phase !== 'planning') return false;
    const c = p.capture;
    p.capture = null;
    const guaranteed = p.badges.includes('ultraball');
    const chance = guaranteed ? 1 : clamp(0.3 + clamp(q, 0, 1) * 0.65, 0.3, 0.95);
    const ok = this.rng() < chance;
    const shakes = ok ? 3 : 1 + this.rng.int(3);
    if (ok) {
      const u = this.makeUnit(c.line, 1, c.shiny);
      const i = p.benchFree();
      if (i >= 0) {
        p.bench[i] = u;
        this.pool[c.line] = Math.max(0, this.pool[c.line] - 1);
        this.register(p, u);
        this.checkCombine(p);
      } else {
        p.gold += LINES[c.line].cost;
      }
      p.stats.captured++;
    }
    this.fx(p, { kind: 'capture', ok, shakes, form: c.form, shiny: c.shiny, chance });
    p.dirty = true;
    return ok;
  }

  // ───────────────────────── Zona Safari (draft) ─────────────────────────
  startSafari() {
    const alive = this.alive();
    const n = Math.max(3, alive.length + 1);
    const costs = this.stage === 1 ? [1] : this.stage === 2 ? [1, 2] : this.stage === 3 ? [2, 3] : this.stage === 4 ? [3, 4] : [4, 5];
    const options = [];
    for (let i = 0; i < n; i++) {
      const cost = this.rng.pick(costs);
      const cands = LINES_BY_COST[cost].filter((id) => this.pool[id] > 0);
      const line = this.rng.pick(cands.length ? cands : LINES_BY_COST[1]);
      let item = this.rng.pick(COMPONENTS);
      if (this.stage >= 4 && this.rng() < 0.3) item = this.rng() < 0.5 ? 'caramelo' : this.rng.pick(FULL_ITEMS);
      options.push({ id: 's' + i, line, form: formFor(line, 1), shiny: this.rng() < this.shinyChance(alive[0] || {}) * 1.5, item, takenBy: null });
    }
    const order = this.stage === 1 ? this.rng.shuffle([...alive]) : [...alive].sort((a, b) => a.hp - b.hp || this.rng() - 0.5);
    this.safari = { options, order: order.map((p) => p.id), turn: -1, turnEnd: 0 };
    this.phase = 'safari';
    this.phaseEnd = this.time + (this.options.fast ? 200 : PHASE_TIME.safariIntro);
    this.roomDirty = true;
  }

  tickSafari() {
    const s = this.safari;
    if (!s) return;
    if (s.turn === -1) {
      if (this.time >= this.phaseEnd) this.advanceSafari();
      return;
    }
    if (s.turn >= s.order.length) {
      if (this.time >= this.phaseEnd) { this.safari = null; this.nextRound(); }
      return;
    }
    const pid = s.order[s.turn];
    const p = this.getPlayer(pid);
    if (!p || !p.alive) { this.advanceSafari(); return; }
    if (p.isAi && this.time >= s.botAt) {
      const id = botSafari(this, p);
      this.safariPick(p, id);
      return;
    }
    if (this.time >= s.turnEnd) {
      const free = s.options.filter((o) => !o.takenBy);
      if (free.length) this.safariPick(p, this.rng.pick(free).id);
      else this.advanceSafari();
    }
  }

  advanceSafari() {
    const s = this.safari;
    s.turn++;
    if (s.turn >= s.order.length) {
      this.phaseEnd = this.time + (this.options.fast ? 100 : 1800);
    } else {
      s.turnEnd = this.time + (this.options.fast ? 300 : PHASE_TIME.safariPick);
      s.botAt = this.time + (this.options.fast ? 0 : 700 + this.rng.int(900));
    }
    this.roomDirty = true;
  }

  safariPick(p, optId) {
    const s = this.safari;
    if (!s || this.phase !== 'safari' || s.turn < 0 || s.order[s.turn] !== p.id) return false;
    const o = s.options.find((x) => x.id === optId && !x.takenBy);
    if (!o) return false;
    o.takenBy = p.id;
    const u = this.makeUnit(o.line, 1, o.shiny);
    if (this.pool[o.line] > 0) this.pool[o.line]--;
    const i = p.benchFree();
    if (i >= 0) { p.bench[i] = u; this.register(p, u); } else p.gold += LINES[o.line].cost;
    this.giveItem(p, o.item);
    this.checkCombine(p);
    this.broadcast({ t: 'safariPick', pid: p.id, opt: o.id });
    p.dirty = true;
    this.advanceSafari();
    return true;
  }

  // ───────────────────────── Comunicación ─────────────────────────
  fx(p, data) {
    if (p.isBot) return;
    this.send(p.id, { t: 'fx', ...data });
  }

  broadcast(msg) {
    for (const p of this.players) if (!p.isBot) this.send(p.id, msg);
  }

  publicState() {
    const rt = Math.max(0, this.phaseEnd - this.time);
    return {
      code: this.code,
      phase: this.phase,
      stage: this.stage,
      round: this.round,
      rtype: this.rtype,
      timeLeft: this.phase === 'safari' && this.safari && this.safari.turn >= 0 && this.safari.turn < this.safari.order.length
        ? Math.max(0, this.safari.turnEnd - this.time) : rt,
      weather: this.weather,
      forecast: this.forecast,
      event: this.event,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, hp: p.hp, level: p.level, gold: p.gold, streak: p.streak,
        alive: p.alive, place: p.place, isBot: p.isBot, connected: p.connected, ready: p.ready,
        fightId: p.fightId, badges: p.badges,
        board: p.board.map((u) => ({ uid: u.uid, line: u.line, form: u.form, star: u.star, shiny: u.shiny, x: u.x, y: u.y, items: u.items, fr: u.fr })),
        bench: p.bench.map((u) => (u ? { uid: u.uid, line: u.line, form: u.form, star: u.star, shiny: u.shiny, items: u.items } : null)),
        traits: computeTraits(p.board, p.traitBonus),
      })),
      safari: this.safari ? {
        options: this.safari.options,
        order: this.safari.order,
        turn: this.safari.turn,
      } : null,
      fights: [...this.combats.values()].map((e) => ({ id: e.id, players: e.players, ended: e.ended, pve: !!e.pve, title: e.combat.title })),
    };
  }

  privateState(p) {
    return {
      id: p.id,
      hp: p.hp,
      gold: p.gold,
      level: p.level,
      xp: p.xp,
      xpNeed: p.level < MAX_LEVEL ? XP_TO_LEVEL[p.level] : 0,
      maxBoard: p.maxBoard(),
      streak: p.streak,
      alive: p.alive,
      place: p.place,
      board: p.board,
      bench: p.bench,
      items: p.items,
      shop: p.shop,
      locked: p.locked,
      rerollCost: this.rerollCost(p),
      badges: p.badges,
      badgeInfo: p.badgeInfo,
      pendingBadge: p.pendingBadge,
      capture: p.capture,
      dyna: p.dyna,
      dynaNeed: p.badges.includes('dinamax') ? 2 : 3,
      dex: p.dex.size,
      dexNext: DEX_MILESTONES[p.dexIdx]?.[0] || null,
      traitBonus: p.traitBonus,
      traits: computeTraits(p.board, p.traitBonus),
      ready: p.ready,
      scout: p.scout,
      fightId: p.fightId,
      pool: this.pool,
    };
  }

  flush() {
    if (this.roomDirty) {
      this.roomDirty = false;
      const pub = this.publicState();
      for (const p of this.players) {
        if (p.isBot) continue;
        this.send(p.id, { t: 'state', room: pub, me: this.privateState(p) });
        p.dirty = false;
      }
    }
    for (const p of this.players) {
      if (p.dirty) {
        p.dirty = false;
        if (!p.isBot) this.send(p.id, { t: 'me', me: this.privateState(p) });
        // El tablero de otros jugadores cambia: refresca el estado público con moderación.
        this.roomDirtySoon = true;
      }
    }
    if (this.roomDirtySoon && (!this.lastPub || this.time - this.lastPub > 400)) {
      this.roomDirtySoon = false;
      this.lastPub = this.time;
      this.roomDirty = true;
    }
  }
}
