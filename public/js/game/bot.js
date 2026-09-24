// IA de los entrenadores bot (también controla a jugadores desconectados).

import { LINES, FORMS, traitsOfForm } from './data/pokemon.js';
import { TRAITS } from './data/types.js';
import { ITEMS, COMPONENTS } from './data/items.js';
import { BADGES } from './data/world.js';
import { COLS, HALF_ROWS, BENCH_SIZE } from './hex.js';
import { computeTraits } from './traits.js';

const TYPE_POOL = ['fuego', 'agua', 'tierra', 'hielo', 'volador', 'planta', 'electrico', 'psiquico', 'lucha', 'fantasma', 'dragon', 'siniestro', 'acero', 'hada', 'roca', 'normal'];
const ROLE_POOL = ['defensor', 'atacante', 'veloz', 'tirador', 'mistico', 'soporte'];

function brain(room, p) {
  if (!p.brain) {
    p.brain = {
      prefs: [room.rng.pick(TYPE_POOL), room.rng.pick(ROLE_POOL)],
      greed: 0.6 + room.rng() * 0.8,
      style: room.rng.pick(['eco', 'reroll', 'normal']),
    };
  }
  return p.brain;
}

function lineTraits(lineId) {
  const l = LINES[lineId];
  return [...l.types, l.role];
}

function copiesOwned(p, lineId) {
  let n = 0;
  for (const u of p.all()) if (u.line === lineId) n += Math.pow(3, u.star - 1);
  return n;
}

function unitScore(p, u, prefs) {
  const cost = LINES[u.line].cost;
  let s = cost * Math.pow(u.star, 2.2) * 2;
  const tr = traitsOfForm(u.form);
  for (const t of tr) if (prefs.includes(t)) s *= 1.25;
  s += u.items.length * 3;
  if (u.line === 'magikarp' && u.star === 1) s *= 0.3;
  if (u.shiny) s *= 1.1;
  return s;
}

function updatePrefs(room, p) {
  const b = brain(room, p);
  if (room.stage < 2 || p.board.length < 3) return;
  const counts = computeTraits(p.all(), p.traitBonus);
  const sorted = Object.entries(counts).sort((a, c) => c[1] - a[1]);
  const types = sorted.filter(([t]) => TYPE_POOL.includes(t));
  const roles = sorted.filter(([t]) => ROLE_POOL.includes(t));
  if (types[0] && room.rng() < 0.5) b.prefs[0] = types[0][0];
  if (roles[0] && room.rng() < 0.5) b.prefs[1] = roles[0][0];
}

function reserveGold(room, p) {
  const b = brain(room, p);
  if (p.hp < 35 || room.stage === 1) return 0;
  if (p.hp < 55) return 10;
  if (room.stage <= 2) return b.style === 'eco' ? 20 : 10;
  if (b.style === 'reroll' && room.stage === 3) return 10;
  return Math.min(50, Math.round(30 * b.greed + room.stage * 4));
}

function targetLevel(room) {
  const s = room.stage, r = room.round;
  if (s === 1) return 3;
  if (s === 2) return r >= 5 ? 5 : 4;
  if (s === 3) return r >= 2 ? 6 : 5;
  if (s === 4) return r >= 5 ? 8 : 7;
  if (s === 5) return 8;
  return 9;
}

export function botPlan(room, p) {
  const b = brain(room, p);
  updatePrefs(room, p);
  const reserve = reserveGold(room, p);

  // Subir de nivel.
  let guard = 0;
  while (p.level < targetLevel(room) && p.gold >= 4 && guard++ < 20) {
    if (!room.buyXp(p)) break;
  }
  // Nivel extra con mucho oro.
  while (p.gold > 60 && p.level < 9 && guard++ < 30) if (!room.buyXp(p)) break;

  // Comprar y actualizar.
  let rolls = 0;
  const maxRolls = p.hp < 40 ? 12 : b.style === 'reroll' && room.stage >= 3 ? 5 : p.gold > 55 ? 3 : 0;
  for (let pass = 0; pass < 14; pass++) {
    buyGood(room, p, reserve);
    if (rolls >= maxRolls) break;
    const c = room.rerollCost(p);
    if (p.gold - c < Math.max(2, reserve - (p.hp < 40 ? 99 : 0))) break;
    if (!room.reroll(p)) break;
    rolls++;
  }

  // Caramelos: úsalos para completar evoluciones.
  for (let i = p.items.length - 1; i >= 0; i--) {
    if (p.items[i] !== 'caramelo') continue;
    const cand = p.all().filter((u) => u.star < 3).sort((a, c) => copiesOwned(p, c.line) - copiesOwned(p, a.line))[0];
    if (cand) room.equip(p, i, cand.uid);
  }

  sellExcess(room, p);
  arrange(room, p);
  equipItems(room, p);
}

function buyGood(room, p, reserve) {
  const b = brain(room, p);
  for (let i = 0; i < p.shop.length; i++) {
    const s = p.shop[i];
    if (!s) continue;
    const line = LINES[s.line];
    const owned = copiesOwned(p, s.line);
    let score = owned * 4 + (s.shiny ? 3 : 0);
    for (const t of lineTraits(s.line)) if (b.prefs.includes(t)) score += 3;
    score += line.cost * (room.stage >= 4 ? 1.5 : 0.6);
    if (s.line === 'magikarp') score += owned >= 2 ? 6 : -1;
    const benchFull = p.benchFree() < 0;
    const pairing = owned % 3 === 2;
    const need = p.all().length < p.maxBoard();
    const minKeep = need ? 0 : pairing || score >= 8 ? Math.min(reserve, 4) : reserve;
    if (p.gold - line.cost < minKeep) continue;
    if (!need && score < 5) continue;
    if (benchFull && !pairing) continue;
    room.buy(p, i);
  }
}

function sellExcess(room, p) {
  const b = brain(room, p);
  // Vende lo que sobra si el banquillo está casi lleno.
  const bench = p.bench.filter(Boolean);
  if (bench.length < BENCH_SIZE - 2) return;
  const scored = bench.map((u) => ({ u, s: unitScore(p, u, b.prefs) + copiesOwned(p, u.line) * 3 })).sort((a, c) => a.s - c.s);
  for (let i = 0; i < scored.length - (BENCH_SIZE - 3); i++) room.sell(p, scored[i].u.uid);
}

function isRanged(u) {
  return LINES[u.line].stats.range > 1;
}

function arrange(room, p) {
  const b = brain(room, p);
  const all = p.all();
  const max = p.maxBoard();
  const chosen = [...all].sort((a, c) => unitScore(p, c, b.prefs) - unitScore(p, a, b.prefs)).slice(0, max);
  // Recoloca: primero devuelve todo al banquillo virtualmente.
  const rest = all.filter((u) => !chosen.includes(u));
  const front = chosen.filter((u) => !isRanged(u)).sort((a, c) => (FORMS[c.form].role === 'defensor') - (FORMS[a.form].role === 'defensor'));
  const back = chosen.filter((u) => isRanged(u));
  const spots = [];
  const cols = [3, 2, 4, 1, 5, 0, 6];
  const used = new Set();
  const take = (rows, u) => {
    for (const y of rows) for (const x of cols) {
      const k = x + ',' + y;
      if (!used.has(k)) { used.add(k); spots.push([u, x, y]); return; }
    }
  };
  for (const u of front) take([0, 1, 2, 3], u);
  for (const u of back) take([3, 2, 1, 0], u);
  p.board = [];
  const bench = new Array(BENCH_SIZE).fill(null);
  for (const [u, x, y] of spots) { u.x = x; u.y = y; p.board.push(u); }
  let bi = 0;
  for (const u of rest) {
    delete u.x; delete u.y;
    if (bi < BENCH_SIZE) bench[bi++] = u;
    else { room.pool[u.line] += Math.pow(3, u.star - 1); p.gold += room.sellValue(u); }
  }
  p.bench = bench;
  p.dirty = true;
}

function equipItems(room, p) {
  if (!p.board.length) return;
  const b = brain(room, p);
  const carries = [...p.board].sort((a, c) => unitScore(p, c, b.prefs) - unitScore(p, a, b.prefs));
  const tank = [...p.board].sort((a, c) => (FORMS[c.form].role === 'defensor') - (FORMS[a.form].role === 'defensor'))[0];
  let guard = 0;
  for (let i = 0; i < p.items.length && guard++ < 30;) {
    const it = p.items[i];
    if (it === 'caramelo') { i++; continue; }
    const defensive = ['hierro', 'zinc', 'masps'].includes(it) || ['cascodentado', 'protector', 'bandafocus', 'chalecoasalto', 'restos', 'cascabelalivio'].includes(it);
    const order = defensive ? [tank, ...carries] : carries;
    let done = false;
    for (const u of order) {
      if (!u) continue;
      const last = u.items[u.items.length - 1];
      const canCombine = ITEMS[it]?.component && last && ITEMS[last]?.component;
      if (u.items.length < 3 || canCombine) {
        // No dejes componentes sueltos si hay 3 objetos.
        if (u.items.length === 2 && ITEMS[it]?.component && !canCombine) continue;
        if (room.equip(p, i, u.uid)) { done = true; break; }
      }
    }
    if (!done) i++;
  }
}

export function botBadge(room, p) {
  const opts = p.pendingBadge;
  if (!opts) return;
  const pref = room.stage >= 3 ? opts.find((id) => BADGES[id].kind === 'combat') : null;
  room.pickBadge(p, pref || room.rng.pick(opts));
}

export function botCapture(room, p) {
  room.tryCapture(p, 0.3 + room.rng() * 0.6);
}

export function botSafari(room, p) {
  const b = brain(room, p);
  const free = room.safari.options.filter((o) => !o.takenBy);
  let best = free[0], bs = -1;
  for (const o of free) {
    let s = copiesOwned(p, o.line) * 3 + LINES[o.line].cost * 2 + (o.shiny ? 2 : 0) + room.rng();
    for (const t of lineTraits(o.line)) if (b.prefs.includes(t)) s += 2;
    if (!COMPONENTS.includes(o.item)) s += 3;
    if (s > bs) { bs = s; best = o; }
  }
  return best?.id;
}

export function botCombat(room, p, entry) {
  const need = p.badges.includes('dinamax') ? 2 : 3;
  if (p.dyna < need) return;
  const c = entry.combat;
  if (!p.dynaAt || p.dynaFight !== entry.id) { p.dynaFight = entry.id; p.dynaAt = 2500 + room.rng.int(5000); }
  if (c.t >= p.dynaAt) room.dynamax(p, null);
}
