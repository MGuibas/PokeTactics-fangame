// Simulación de combate en tiempo real (autoritativa, determinista con semilla).
// Se ejecuta en el servidor (o en el navegador en modo solitario) a 20 ticks/s.

import { COLS, ROWS, key, dist, hexesInRadius, hexLine, bfsStep, inBounds } from './hex.js';
import { FORMS, LINES, baseStats, moveOf, movePower, COST_MUL } from './data/pokemon.js';
import { effectiveness } from './data/types.js';
import { ITEMS } from './data/items.js';
import { activeTraits } from './traits.js';
import { makeRng } from './util.js';

export const TICK_MS = 50;
const MOVE_MS = 420;
const CAST_MS = 450;
const OVERTIME_MS = 30000;

// Bits de estado enviados al cliente.
export const F = {
  STUN: 1, SLEEP: 2, PARA: 4, FREEZE: 8, BURN: 16, SLOW: 32, CONFUSE: 64,
  DYNA: 128, INVULN: 256, DISGUISE: 512, FLINCH: 1024, BOSS: 2048,
};
const STUN_BIT = { sleep: F.SLEEP, para: F.PARA, freeze: F.FREEZE, flinch: F.FLINCH };
const CC = new Set(['sleep', 'para', 'freeze', 'flinch', 'confuse']);

// Movimientos que Metrónomo puede sacar.
const METRO_POOL = [];
for (const f of Object.values(FORMS)) {
  for (const [star, m] of Object.entries(f.moves)) {
    if (['blast', 'beam', 'nova', 'chain', 'multi', 'global', 'bolt', 'drain', 'dash'].includes(m.kind) && m.name) {
      METRO_POOL.push({ form: f.id, star: +star, move: m });
    }
  }
}

export class Combat {
  /**
   * sides[i] = { playerId, name, units:[{uid,line,form,star,shiny,items,fr,x,y}], badges:[], traits:{},
   *              ghost?, pve? }
   * Las coordenadas x,y ya están en el sistema del tablero de combate (8 filas).
   */
  constructor({ id, sides, weather = 'despejado', stage = 1, seed = 1, kind = 'pvp', title = '', timeLimit = 42000, boss = false }) {
    this.id = id;
    this.kind = kind;
    this.title = title;
    this.weather = weather;
    this.stage = stage;
    this.rng = makeRng(seed);
    this.t = 0;
    this.timeLimit = timeLimit;
    this.sides = sides.map((s) => ({ ...s, gold: 0, dynaUsed: false }));
    this.units = [];
    this.grid = new Map();
    this.events = [];
    this.pending = [];
    this.done = false;
    this.result = null;
    this.secAcc = 0;
    this.seconds = 0;
    this.nextId = 1;
    this.overtimeAmp = 0;
    sides.forEach((s, si) => {
      const traitsLv = activeTraits(s.traits || {});
      this.sides[si].traitsLv = traitsLv;
      for (const u of s.units) this.addUnit(u, si, traitsLv, s.badges || [], boss && si === 1);
    });
    this.onStart();
  }

  // ───────────────────────── Construcción de unidades ─────────────────────────
  addUnit(src, side, tl, badges, isBoss) {
    const form = FORMS[src.form];
    const line = LINES[src.line];
    const b = baseStats(src.line, src.form, src.star);
    const types = form.types;
    const role = form.role;
    const has = (t) => types.includes(t) || role === t;
    const items = (src.items || []).filter((i) => ITEMS[i] && !ITEMS[i].consumable);
    const itemSet = new Set(items);

    let hpFlat = 0, hpPct = 0, atkPct = 0, asPct = 0, ap = 0, def = 0, mdef = 0, mana0 = 0;
    let crit = 0, critDmg = 0, dodge = 0, range = 0, dmgAmp = 0, dmgRed = 0, vamp = 0;

    for (const it of items) {
      const s = ITEMS[it].stats || {};
      hpFlat += s.hp || 0; atkPct += s.atkPct || 0; asPct += s.asPct || 0; ap += s.ap || 0;
      def += s.def || 0; mdef += s.mdef || 0; mana0 += s.mana0 || 0; crit += s.crit || 0;
      dodge += s.dodge || 0; range += s.range || 0; dmgAmp += s.dmgAmp || 0; vamp += s.vamp || 0;
    }
    if (itemSet.has('bolaluminosa')) {
      if (src.line === 'pichu') { atkPct += 1; ap += 100; } else { atkPct += 0.2; ap += 20; }
    }

    // Shiny y amistad.
    if (src.shiny) {
      const m = badges.includes('iris') ? 0.25 : 0.15;
      hpPct += m; atkPct += m; ap += 15;
    }
    if ((src.fr || 0) >= 5) {
      const m = badges.includes('amistad') ? 0.2 : 0.1;
      hpPct += m; atkPct += m; ap += m * 100;
    }

    // Sinergias.
    const L = (id) => tl[id] || 0;
    const lv = (id, arr) => (L(id) ? arr[L(id) - 1] : 0);
    if (has('normal') && L('normal')) { hpPct += lv('normal', [0.2, 0.45]); atkPct += lv('normal', [0.2, 0.45]); }
    if (has('fuego') && L('fuego')) dmgAmp += lv('fuego', [0.1, 0.3]);
    if (has('lucha') && L('lucha')) { atkPct += lv('lucha', [0.2, 0.45]); vamp += lv('lucha', [0.1, 0.2]); }
    if (has('tierra')) def += lv('tierra', [20, 40, 70]);
    if (has('volador') && L('volador')) { dodge += lv('volador', [0.1, 0.2, 0.35]); asPct += lv('volador', [0.1, 0.2, 0.35]); }
    ap += lv('psiquico', [15, 40]);
    if (has('psiquico')) ap += lv('psiquico', [15, 30]);
    if (has('fantasma')) dodge += lv('fantasma', [0.2, 0.35]);
    if (has('dragon') && L('dragon')) { hpFlat += lv('dragon', [300, 650]); dmgAmp += lv('dragon', [0.15, 0.35]); }
    if (has('siniestro') && L('siniestro')) { crit += lv('siniestro', [0.25, 0.45]); critDmg += lv('siniestro', [0.2, 0.4]); }
    if (has('acero')) dmgRed += lv('acero', [0.15, 0.32]);
    mdef += lv('hada', [20, 45]);
    if (has('defensor')) { def += lv('defensor', [20, 45, 80]); mdef += lv('defensor', [20, 45, 80]); }
    if (L('defensor') >= 3 && !has('defensor')) { def += 20; mdef += 20; }
    if (has('atacante')) atkPct += lv('atacante', [0.15, 0.35, 0.6]);
    if (has('veloz')) asPct += lv('veloz', [0.15, 0.35, 0.6]);
    if (has('tirador') && L('tirador')) { range += 1; dmgAmp += lv('tirador', [0.15, 0.35]); }
    if (has('mistico')) { ap += lv('mistico', [25, 60, 100]); mana0 += lv('mistico', [0, 10, 20]); }
    if (L('mistico') >= 3 && !has('mistico')) ap += 25;

    // Medallas.
    if (badges.includes('roca')) { def += 25; mdef += 25; }
    if (badges.includes('cascada')) mana0 += 25;
    if (badges.includes('trueno')) asPct += 0.2;
    if (badges.includes('alma')) ap += 30;
    if (badges.includes('pantano')) dmgAmp += 0.15;
    if (badges.includes('tierra')) hpFlat += 250;

    // Clima.
    const w = this.weather;
    if (w === 'lluvia' && has('electrico')) asPct += 0.2;
    if (w === 'arena' && (has('roca') || has('tierra') || has('acero'))) { def += 25; mdef += 25; }
    if (w === 'nieve') { if (has('hielo')) def += 20; else asPct -= 0.1; }
    if (w === 'niebla' && (has('hada') || has('psiquico'))) ap += 30;

    let maxHp = Math.round((b.hp + hpFlat) * (1 + hpPct));
    let atk = b.atk * (1 + atkPct);
    if (this.kind === 'pve' && side === 1) {
      maxHp = Math.round(maxHp * 0.6);
      atk *= 0.6;
    }
    if (isBoss) {
      const mul = 2.2 + this.stage * 0.9;
      maxHp = Math.round(maxHp * mul);
      atk *= 1 + this.stage * 0.12;
    }

    const u = {
      id: 'c' + this.nextId++, side, owner: this.sides[side].playerId,
      uid: src.uid, line: src.line, form: src.form, star: src.star, shiny: !!src.shiny, items, itemSet,
      types, role, x: src.x, y: src.y, fr: src.fr || 0,
      maxHp, hp: maxHp, atk, baseAs: b.as, asPct, ap: 100 + ap,
      def: b.def + def, mdef: b.mdef + mdef, range: b.range + range,
      mana: Math.min(b.mana - 1, b.mana0 + mana0), maxMana: b.mana,
      crit: Math.min(1, b.crit + crit), critDmg: b.critDmg + critDmg, dodge: Math.min(0.6, dodge),
      dmgAmp, dmgRed: Math.min(0.6, dmgRed), vamp,
      shields: [], buffs: [],
      alive: true, target: null, nextAtk: 250 + this.rng.int(350), busyUntil: 0, retargetAt: 0,
      stunUntil: 0, stunKind: null, burn: null, slowUntil: 0, slowPct: 0, confUntil: 0, invulnUntil: 0,
      shredUntil: 0, antiHealUntil: 0,
      moveMs: itemSet.has('panueloelegido') ? MOVE_MS / 2 : MOVE_MS,
      stacks: { metro: 0, aguante: 0 }, casts: 0, focusUsed: false, zidraUsed: false, alivioUsed: false,
      disguise: form.passive === 'disfraz',
      dyna: false, dynaUntil: 0, dynaBonus: 0, boss: isBoss,
      dmgDone: 0, dmgTaken: 0, healDone: 0,
      cc: !itemSet.has('hierbamental'),
      fireBurn: has('fuego') ? lv('fuego', [0.02, 0.035]) : 0,
      waterRegen: has('agua') ? lv('agua', [3, 6, 10]) : 0,
      badges,
    };
    if (L('agua') >= 3 && !has('agua')) u.waterRegen += 3;
    if (w === 'sol' && has('planta')) u.waterRegen += 3;
    u.elecLv = has('electrico') ? L('electrico') : 0;
    u.iceLv = has('hielo') ? L('hielo') : (L('hielo') >= 3 ? 1 : 0);
    u.fairyHeal = has('hada') ? lv('hada', [0.2, 0.4]) : 0;
    u.ghostConfuse = has('fantasma') && L('fantasma') >= 2;
    u.volcan = badges.includes('volcan');
    if (isBoss) { u.dyna = true; u.dynaUntil = 1e12; u.cc = false; }
    this.units.push(u);
    this.grid.set(key(u.x, u.y), u);
    return u;
  }

  onStart() {
    for (let si = 0; si < this.sides.length; si++) {
      const tl = this.sides[si].traitsLv;
      const mine = this.units.filter((u) => u.side === si);
      // Roca: escudo inicial.
      if (tl.roca) {
        for (const u of mine) if (u.types.includes('roca')) this.addShield(u, u.maxHp * [0.25, 0.55][tl.roca - 1], 30000, u);
      }
      if (tl.soporte) {
        const amt = [150, 350][tl.soporte - 1] * (1 + (this.stage - 1) * 0.15);
        for (const u of mine) this.addShield(u, amt, 8000, null);
        this.schedule(8000, () => {
          for (const u of this.units) if (u.alive && u.side === si) this.addShield(u, amt, 8000, null);
        });
      }
      // Hierba Blanca.
      for (const u of mine) {
        if (u.itemSet.has('hierbablanca')) {
          for (const a of mine) if (dist(a.x, a.y, u.x, u.y) <= 1) this.addShield(a, 250, 10000, u);
        }
      }
      // Siniestro 4: emboscada a la retaguardia.
      if (tl.siniestro >= 2) {
        for (const u of mine) if (u.types.includes('siniestro')) this.schedule(200 + this.rng.int(300), () => this.ambush(u));
      }
      // Tierra: temblores periódicos.
      if (tl.tierra >= 2) {
        const every = tl.tierra >= 3 ? 3000 : 6000;
        const quake = () => {
          if (this.done) return;
          const dmg = 50 + 25 * this.stage;
          const src = this.units.find((u) => u.alive && u.side === si && u.types.includes('tierra'));
          if (src) {
            this.ev({ k: 'quake', s: si });
            for (const e of this.units) {
              if (e.alive && e.side !== si && !e.types.includes('volador')) this.damage(src, e, dmg, { elem: 'tierra', tremor: true });
            }
          }
          this.schedule(every, quake);
        };
        this.schedule(every, quake);
      }
    }
  }

  // ───────────────────────── Bucle ─────────────────────────
  schedule(delay, fn) {
    this.pending.push({ at: this.t + delay, fn });
  }

  ev(e) { this.events.push(e); }

  step(dt = TICK_MS) {
    if (this.done) return [];
    this.t += dt;
    // Acciones programadas.
    if (this.pending.length) {
      const now = this.pending.filter((p) => p.at <= this.t);
      if (now.length) {
        this.pending = this.pending.filter((p) => p.at > this.t);
        now.sort((a, b) => a.at - b.at);
        for (const p of now) p.fn();
      }
    }
    // Tiempo extra: el daño sube.
    if (this.t > OVERTIME_MS) this.overtimeAmp = ((this.t - OVERTIME_MS) / 1000) * 0.12;

    const order = this.units.filter((u) => u.alive);
    // orden semi-aleatorio para no favorecer a un bando
    if (this.t % 100 === 0) order.reverse();
    for (const u of order) this.updateUnit(u);

    this.secAcc += dt;
    while (this.secAcc >= 1000) {
      this.secAcc -= 1000;
      this.seconds++;
      this.perSecond();
    }
    this.checkEnd();
    const out = this.events;
    this.events = [];
    return out;
  }

  perSecond() {
    const w = this.weather;
    for (const u of this.units) {
      if (!u.alive) continue;
      // Quemadura.
      if (u.burn && u.burn.until > this.t) {
        this.damage(u.burn.src || null, u, u.maxHp * u.burn.pct, { true: true, dot: true, noMana: true });
        if (!u.alive) continue;
      } else u.burn = null;
      // Regeneración.
      let regen = 0;
      const tl = this.sides[u.side].traitsLv;
      if (tl.planta) regen += [0.015, 0.03][tl.planta - 1];
      if (u.badges.includes('arcoiris')) regen += 0.015;
      if (u.itemSet.has('restos')) regen += 0.03;
      if (regen > 0 && u.hp < u.maxHp) this.heal(u, u.maxHp * regen, u, true);
      if (u.waterRegen) this.gainMana(u, u.waterRegen);
      if (w === 'arena' && !(u.types.includes('roca') || u.types.includes('tierra') || u.types.includes('acero'))) {
        this.damage(null, u, u.maxHp * 0.01, { true: true, dot: true, noMana: true });
      }
      // Fin del Dinamax.
      if (u.dyna && !u.boss && this.t >= u.dynaUntil) {
        u.dyna = false;
        u.maxHp -= u.dynaBonus;
        u.hp = Math.min(u.hp, u.maxHp);
        u.dynaBonus = 0;
        this.ev({ k: 'undyna', u: u.id });
      }
    }
  }

  checkEnd() {
    const alive = [0, 0];
    for (const u of this.units) if (u.alive) alive[u.side]++;
    let winner = null;
    if (alive[0] === 0 && alive[1] === 0) winner = -1;
    else if (alive[1] === 0) winner = 0;
    else if (alive[0] === 0) winner = 1;
    else if (this.t >= this.timeLimit) winner = -1;
    if (winner !== null) {
      this.done = true;
      const survivors = [[], []];
      for (const u of this.units) if (u.alive) survivors[u.side].push({ id: u.id, uid: u.uid, star: u.star, cost: LINES[u.line].cost });
      const stats = this.units.map((u) => ({ id: u.id, uid: u.uid, side: u.side, form: u.form, star: u.star, shiny: u.shiny, dmg: Math.round(u.dmgDone), taken: Math.round(u.dmgTaken), heal: Math.round(u.healDone) }));
      this.result = { winner, survivors, gold: this.sides.map((s) => s.gold), stats, time: this.t };
      this.ev({ k: 'end', w: winner });
    }
  }

  // ───────────────────────── IA de unidad ─────────────────────────
  enemiesOf(u) { return this.units.filter((e) => e.alive && e.side !== u.side); }
  alliesOf(u) { return this.units.filter((a) => a.alive && a.side === u.side); }
  isStunned(u) { return u.stunUntil > this.t; }

  updateUnit(u) {
    if (!u.alive || u.busyUntil > this.t || this.isStunned(u)) return;
    if (u.stunKind) { u.stunKind = null; }
    if (u.mana >= u.maxMana && u.maxMana > 0) { this.cast(u); return; }
    let tg = u.target;
    if (!tg || !tg.alive || (this.t >= u.retargetAt && dist(u.x, u.y, tg.x, tg.y) > u.range)) {
      tg = u.target = this.findTarget(u);
      u.retargetAt = this.t + 600;
    }
    if (!tg) return;
    const d = dist(u.x, u.y, tg.x, tg.y);
    if (d <= u.range) {
      if (this.t >= u.nextAtk) this.attack(u, tg);
    } else {
      this.moveToward(u, tg);
    }
  }

  findTarget(u) {
    let best = null, bd = 1e9;
    for (const e of this.units) {
      if (!e.alive || e.side === u.side) continue;
      const d = dist(u.x, u.y, e.x, e.y) + this.rng() * 0.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  moveToward(u, tg) {
    const blocked = (x, y) => this.grid.has(key(x, y));
    let step = bfsStep(u.x, u.y, blocked, (x, y) => dist(x, y, tg.x, tg.y) <= u.range);
    if (!step) {
      // Buscar cualquier otro enemigo alcanzable.
      const others = this.enemiesOf(u).filter((e) => e !== tg);
      for (const e of others) {
        step = bfsStep(u.x, u.y, blocked, (x, y) => dist(x, y, e.x, e.y) <= u.range);
        if (step) { u.target = e; break; }
      }
    }
    if (!step) { u.busyUntil = this.t + 250; return; }
    this.relocate(u, step[0], step[1]);
    u.busyUntil = this.t + u.moveMs;
    this.ev({ k: 'mv', u: u.id, x: u.x, y: u.y, d: u.moveMs });
  }

  relocate(u, x, y) {
    this.grid.delete(key(u.x, u.y));
    u.x = x; u.y = y;
    this.grid.set(key(x, y), u);
  }

  attackSpeed(u) {
    let pct = u.asPct + u.stacks.metro;
    for (const b of u.buffs) if (b.until > this.t) pct += b.as || 0;
    let as = u.baseAs * (1 + pct);
    if (u.slowUntil > this.t) as *= 1 - u.slowPct;
    return Math.max(0.2, Math.min(5, as));
  }

  atkValue(u) {
    let pct = 0;
    for (const b of u.buffs) if (b.until > this.t) pct += b.atk || 0;
    return u.atk * (1 + pct);
  }

  attack(u, tg) {
    u.nextAtk = this.t + 1000 / this.attackSpeed(u);
    const d = dist(u.x, u.y, tg.x, tg.y);
    const ranged = u.range > 1 && d > 1;
    const travel = ranged ? 120 + d * 70 : 180;
    this.ev({ k: 'atk', u: u.id, tg: tg.id, r: ranged ? 1 : 0, d: travel });
    this.gainMana(u, 10 + (u.itemSet.has('pila') ? 6 : 0));
    this.schedule(travel, () => this.resolveAttack(u, tg, false));
    if (u.itemSet.has('garrarapida') && this.rng() < 0.25) {
      this.schedule(travel + 120, () => this.resolveAttack(u, tg, true));
    }
  }

  resolveAttack(u, tg, extra) {
    if (!u.alive) return;
    // Confusión: puede golpearse a sí mismo.
    if (u.confUntil > this.t && this.rng() < 0.33) {
      this.ev({ k: 'txt', u: u.id, s: '¡Está confuso!' });
      this.damage(null, u, this.atkValue(u) * 0.5, { phys: true });
      return;
    }
    if (!tg.alive) return;
    if (tg.dodge > 0 && this.rng() < tg.dodge) {
      this.ev({ k: 'txt', u: tg.id, s: '¡Esquiva!' });
      return;
    }
    const crit = !tg.itemSet.has('cascodentado') && this.rng() < u.crit;
    const dmg = this.atkValue(u) * (crit ? u.critDmg : 1);
    this.damage(u, tg, dmg, { phys: true, elem: u.types[0], attack: true, crit });
    if (u.itemSet.has('metronomo')) u.stacks.metro = Math.min(2, u.stacks.metro + 0.06);
    if (u.itemSet.has('cintaaguante')) this.aguante(u);
    if (u.itemSet.has('vidasfera')) this.damage(null, u, u.maxHp * 0.02, { true: true, noMana: true, selfHit: true, silent: true });
    if (!tg.alive) return;
    if (u.itemSet.has('rocadelrey') && this.rng() < 0.2) this.applyStatus(tg, { kind: 'flinch', dur: 1 }, u);
    if (u.fireBurn) this.applyStatus(tg, { kind: 'burn', dur: 3, pct: u.fireBurn }, u);
    else if (u.volcan) this.applyStatus(tg, { kind: 'burn', dur: 3, pct: 0.015 }, u);
    if (u.iceLv) {
      this.applyStatus(tg, { kind: 'slow', dur: 2, pct: 0.25 }, u);
      if (u.iceLv >= 2 && this.rng() < 0.15) this.applyStatus(tg, { kind: 'freeze', dur: 1.2 }, u);
    }
    if (u.elecLv && this.rng() < [0.25, 0.4][u.elecLv - 1]) {
      const dmgE = [70, 140][u.elecLv - 1] * (1 + (this.stage - 1) * 0.1);
      const near = this.enemiesOf(u).filter((e) => e !== tg && dist(e.x, e.y, tg.x, tg.y) <= 2).slice(0, 1);
      const chain = [tg, ...near];
      this.ev({ k: 'chain', u: u.id, t: chain.map((c) => c.id), ty: 'electrico', small: 1 });
      for (const c of chain) {
        this.damage(u, c, dmgE, { elem: 'electrico' });
        if (u.elecLv >= 2 && c.alive) this.applyStatus(c, { kind: 'para', dur: 0.5 }, u);
      }
    }
    // Dinamax: los ataques salpican.
    if (u.dyna) {
      for (const e of this.enemiesOf(u)) {
        if (e !== tg && dist(e.x, e.y, tg.x, tg.y) <= 1) this.damage(u, e, dmg * 0.5, { phys: true, elem: u.types[0] });
      }
    }
  }

  aguante(u) {
    if (u.stacks.aguante < 25) { u.stacks.aguante++; u.def += 2; }
  }

  gainMana(u, amt) {
    if (u.manaLockUntil > this.t) return;
    u.mana = Math.min(u.maxMana, u.mana + amt);
  }

  // ───────────────────────── Daño y curación ─────────────────────────
  damage(src, tg, raw, o = {}) {
    if (!tg.alive || raw <= 0) return 0;
    if (tg.invulnUntil > this.t) return 0;
    let dmg = raw;
    let eff = 1;
    if (o.elem) {
      eff = effectiveness(o.elem, tg.types);
      dmg *= eff;
      if (src && eff > 1 && src.itemSet?.has('cintaexperto')) dmg *= 1.4;
      dmg *= this.weatherMul(o.elem);
    }
    if (src) {
      dmg *= 1 + src.dmgAmp + this.overtimeAmp + src.stacks.aguante * 0.02;
      if (src.dyna && src.boss) dmg *= 1;
    }
    if (!o.true) {
      let resist = o.phys ? tg.def : tg.mdef;
      if (!o.phys && tg.shredUntil > this.t) resist *= 0.6;
      if (tg.itemSet.has('protector')) {
        const n = this.units.filter((e) => e.alive && e.side !== tg.side && e.target === tg).length;
        resist += 12 * n;
      }
      dmg *= 100 / (100 + Math.max(0, resist));
      if (!o.phys && tg.itemSet.has('chalecoasalto')) dmg *= 0.75;
    }
    dmg *= 1 - tg.dmgRed;
    if (tg.disguise && src) {
      tg.disguise = false;
      this.ev({ k: 'txt', u: tg.id, s: '¡Su disfraz se rompió!' });
      return 0;
    }
    dmg = Math.max(1, Math.round(dmg));
    // Escudos.
    let left = dmg;
    for (const s of tg.shields) {
      if (s.until <= this.t || s.amt <= 0) continue;
      const a = Math.min(s.amt, left);
      s.amt -= a; left -= a;
      if (left <= 0) break;
    }
    tg.shields = tg.shields.filter((s) => s.amt > 0 && s.until > this.t);
    tg.hp -= left;
    tg.dmgTaken += dmg;
    if (src) src.dmgDone += dmg;
    if (!o.noMana && !tg.dyna) this.gainMana(tg, Math.min(10, raw * 0.01 + dmg * 0.03));
    if (!o.silent) {
      this.ev({ k: 'dmg', u: tg.id, a: dmg, t: o.true ? 't' : o.phys ? 'p' : 's', c: o.crit ? 1 : 0, e: eff > 1.01 ? 1 : eff < 0.99 ? -1 : 0, dot: o.dot ? 1 : 0 });
    }
    if (src && src.alive && src !== tg) {
      if (src.vamp > 0 && !o.dot) this.heal(src, dmg * src.vamp, src, true);
      if (o.ability && src.fairyHeal) {
        const low = this.lowestAlly(src);
        if (low) this.heal(low, dmg * src.fairyHeal, src);
      }
    }
    if (o.attack && tg.itemSet.has('cascodentado') && src && src.alive && !o.reflect) {
      this.damage(tg, src, 30, { reflect: true, noMana: true });
    }
    if (o.attack && tg.itemSet.has('cintaaguante')) this.aguante(tg);

    if (tg.hp <= 0) {
      if (tg.itemSet.has('bandafocus') && !tg.focusUsed) {
        tg.focusUsed = true;
        tg.hp = 1;
        tg.invulnUntil = this.t + 1500;
        this.ev({ k: 'txt', u: tg.id, s: '¡Aguantó con la Banda Focus!' });
        this.schedule(1500, () => { if (tg.alive) this.heal(tg, tg.maxHp * 0.3, tg); });
      } else {
        this.kill(tg, src);
      }
    } else {
      if (tg.itemSet.has('bayazidra') && !tg.zidraUsed && tg.hp < tg.maxHp * 0.5) {
        tg.zidraUsed = true;
        this.heal(tg, tg.maxHp * 0.35, tg);
        this.ev({ k: 'txt', u: tg.id, s: '¡Comió su Baya Zidra!' });
      }
      if (tg.itemSet.has('cascabelalivio') && !tg.alivioUsed && tg.hp < tg.maxHp * 0.4) {
        tg.alivioUsed = true;
        for (const a of this.alliesOf(tg)) if (dist(a.x, a.y, tg.x, tg.y) <= 2) this.heal(a, (a.maxHp - a.hp) * 0.25 + 50, tg);
        this.ev({ k: 'fx', u: tg.id, f: 'heal' });
      }
    }
    return dmg;
  }

  weatherMul(elem) {
    switch (this.weather) {
      case 'sol': return elem === 'fuego' ? 1.3 : elem === 'agua' ? 0.75 : 1;
      case 'lluvia': return elem === 'agua' ? 1.3 : elem === 'fuego' ? 0.75 : 1;
      case 'nieve': return elem === 'hielo' ? 1.3 : 1;
      case 'niebla': return elem === 'dragon' ? 0.8 : 1;
      case 'electrico': return elem === 'electrico' ? 1.3 : 1;
      default: return 1;
    }
  }

  heal(u, amt, src, silent = false) {
    if (!u.alive || amt <= 0) return 0;
    if (u.antiHealUntil > this.t || (u.burn && u.burn.until > this.t)) amt *= 0.6;
    if (src && src.itemSet?.has('semillamilagro')) amt *= 1.4;
    const real = Math.min(u.maxHp - u.hp, amt);
    if (real <= 0) return 0;
    u.hp += real;
    if (src) src.healDone += real;
    if (!silent || real >= 25) this.ev({ k: 'heal', u: u.id, a: Math.round(real) });
    return real;
  }

  addShield(u, amt, dur, src) {
    if (!u.alive) return;
    if (src && src.itemSet?.has('semillamilagro')) amt *= 1.4;
    u.shields.push({ amt: Math.round(amt), until: this.t + dur });
    this.ev({ k: 'shield', u: u.id, a: Math.round(amt) });
  }

  kill(u, src) {
    u.alive = false;
    u.hp = 0;
    this.grid.delete(key(u.x, u.y));
    this.ev({ k: 'die', u: u.id, s: src ? src.id : null });
  }

  lowestAlly(u, exclude = null) {
    let best = null, br = 2;
    for (const a of this.units) {
      if (!a.alive || a.side !== u.side || a === exclude) continue;
      const r = a.hp / a.maxHp;
      if (r < br) { br = r; best = a; }
    }
    return best;
  }

  applyStatus(tg, st, src) {
    if (!tg.alive || !st) return;
    const dur = (st.dur || 1) * 1000;
    if (CC.has(st.kind)) {
      if (!tg.cc || tg.dyna) return;
      if (st.kind === 'sleep' && this.weather === 'electrico' && src !== tg) return;
    }
    switch (st.kind) {
      case 'sleep': case 'para': case 'freeze': case 'flinch':
        tg.stunUntil = Math.max(tg.stunUntil, this.t + dur);
        tg.stunKind = st.kind;
        tg.busyUntil = Math.min(tg.busyUntil, this.t);
        break;
      case 'burn':
        if (!tg.burn || tg.burn.pct <= st.pct || tg.burn.until < this.t + dur) tg.burn = { until: this.t + dur, pct: st.pct || 0.02, src };
        break;
      case 'slow':
        tg.slowUntil = this.t + dur; tg.slowPct = st.pct || 0.3;
        break;
      case 'confuse':
        tg.confUntil = this.t + dur;
        break;
    }
    if (st.kind !== 'burn' && st.kind !== 'slow') this.ev({ k: 'st', u: tg.id, s: st.kind, d: dur });
  }

  // ───────────────────────── Habilidades ─────────────────────────
  cast(u) {
    const form = FORMS[u.form];
    let m = moveOf(form, u.star);
    let power = movePower(form, u.star, m);
    let metroName = null;
    if (m.kind === 'metronome') {
      const pick = this.rng.pick(METRO_POOL);
      metroName = pick.move.name;
      m = { ...pick.move, power: [1, 1, 1] };
      this.ev({ k: 'txt', u: u.id, s: `¡Metrónomo → ${metroName}!` });
    }
    u.mana = u.itemSet.has('etermaximo') ? 25 : 0;
    u.casts++;
    u.busyUntil = this.t + CAST_MS;
    let ap = u.ap / 100;
    if (u.casts === 1 && u.itemSet.has('cristalz')) {
      ap *= 2;
      this.ev({ k: 'txt', u: u.id, s: '¡MOVIMIENTO Z!' });
    }
    const P = power * ap;
    const i = u.star - 1;
    const tg = u.target && u.target.alive ? u.target : this.findTarget(u);
    const canCrit = u.itemSet.has('periscopio');
    const hit = (e, amt, extra = {}) => {
      const crit = canCrit && this.rng() < u.crit;
      const d = this.damage(u, e, amt * (crit ? u.critDmg : 1), { phys: m.phys, elem: m.type, ability: true, crit, ...extra });
      if (e.alive) {
        if (m.status) this.applyStatus(e, m.status, u);
        if (u.itemSet.has('llamasfera')) { this.applyStatus(e, { kind: 'burn', dur: 3, pct: 0.03 }, u); e.antiHealUntil = this.t + 5000; }
        if (u.itemSet.has('gafasespeciales')) e.shredUntil = this.t + 5000;
        if (u.ghostConfuse) this.applyStatus(e, { kind: 'confuse', dur: 1.5 }, u);
      }
      return d;
    };
    const base = { k: 'cast', u: u.id, m: metroName || m.name, kind: m.kind, ty: m.type };
    if (m.selfShield) this.addShield(u, m.selfShield[i] * COST_MUL[form.cost] * ap, 6000, u);

    switch (m.kind) {
      case 'blast': {
        if (!tg) break;
        const r = m.radius[i];
        this.ev({ ...base, tg: tg.id, x: tg.x, y: tg.y, r });
        const delay = 250;
        const cx = tg.x, cy = tg.y;
        this.schedule(delay, () => {
          for (const e of this.enemiesOf(u)) if (dist(e.x, e.y, cx, cy) <= r) hit(e, e === tg ? P : P * 0.75);
        });
        break;
      }
      case 'bolt': {
        const t2 = m.target === 'low' ? this.lowestEnemy(u) : tg;
        if (!t2) break;
        const d = dist(u.x, u.y, t2.x, t2.y);
        const travel = 150 + d * 60;
        this.ev({ ...base, tg: t2.id, x: t2.x, y: t2.y, d: travel });
        this.schedule(travel, () => { if (t2.alive) hit(t2, P); });
        break;
      }
      case 'beam': {
        if (!tg) break;
        const cells = hexLine(u.x, u.y, tg.x, tg.y, m.len[i]);
        const last = cells[cells.length - 1] || [tg.x, tg.y];
        this.ev({ ...base, tg: tg.id, x: last[0], y: last[1], fx0: u.x, fy0: u.y });
        const set = new Set(cells.map(([x, y]) => key(x, y)));
        this.schedule(200, () => {
          for (const e of this.enemiesOf(u)) if (set.has(key(e.x, e.y))) hit(e, P);
        });
        break;
      }
      case 'nova': {
        const r = m.radius[i];
        this.ev({ ...base, x: u.x, y: u.y, r });
        this.schedule(200, () => {
          for (const e of this.enemiesOf(u)) if (dist(e.x, e.y, u.x, u.y) <= r) hit(e, P);
        });
        break;
      }
      case 'dash': {
        let t2 = tg;
        if (m.target === 'far') t2 = this.farthestEnemy(u);
        else if (m.target === 'low') t2 = this.lowestEnemy(u);
        if (!t2) break;
        const spot = this.freeNear(t2.x, t2.y, u);
        const fx = u.x, fy = u.y;
        if (spot) this.relocate(u, spot[0], spot[1]);
        u.target = t2;
        this.ev({ ...base, tg: t2.id, x: u.x, y: u.y, fx0: fx, fy0: fy });
        u.busyUntil = this.t + 350;
        this.schedule(250, () => {
          if (!u.alive) return;
          if (m.landRadius) {
            for (const e of this.enemiesOf(u)) if (dist(e.x, e.y, t2.x, t2.y) <= m.landRadius) hit(e, e === t2 ? P : P * 0.6);
          } else if (t2.alive) hit(t2, P);
        });
        break;
      }
      case 'multi': {
        const n = m.hits[i];
        this.ev({ ...base, tg: tg?.id, n });
        for (let h = 0; h < n; h++) {
          this.schedule(120 + h * 130, () => {
            if (!u.alive) return;
            let e = m.same ? (u.target && u.target.alive ? u.target : this.findTarget(u)) : this.rng.pick(this.enemiesOf(u));
            if (!e) return;
            this.ev({ k: 'proj', u: u.id, tg: e.id, ty: m.type, d: 150 });
            this.schedule(150, () => { if (e.alive) hit(e, P); });
          });
        }
        break;
      }
      case 'chain': {
        if (!tg) break;
        const n = m.bounces[i];
        const chain = [tg];
        let cur = tg;
        for (let b = 1; b < n; b++) {
          let best = null, bd = 1e9;
          for (const e of this.enemiesOf(u)) {
            if (chain.includes(e)) continue;
            const d = dist(e.x, e.y, cur.x, cur.y);
            if (d < bd && d <= 3) { bd = d; best = e; }
          }
          if (!best) break;
          chain.push(best);
          cur = best;
        }
        this.ev({ ...base, t: chain.map((c) => c.id), tg: tg.id });
        chain.forEach((c, j) => this.schedule(120 + j * 90, () => { if (c.alive) hit(c, P * Math.pow(0.88, j)); }));
        break;
      }
      case 'drain': {
        if (!tg) break;
        this.ev({ ...base, tg: tg.id, x: tg.x, y: tg.y });
        this.schedule(250, () => {
          if (!tg.alive) return;
          const d = hit(tg, P);
          const who = m.healTarget === 'ally' ? this.lowestAlly(u) : u;
          if (who) this.heal(who, d * (m.heal?.[i] ?? 0.8), u);
        });
        break;
      }
      case 'heal': {
        const r = m.radius ? m.radius[i] : 99;
        const targets = this.alliesOf(u).filter((a) => m.all || dist(a.x, a.y, u.x, u.y) <= r);
        this.ev({ ...base, x: u.x, y: u.y, r: m.all ? 9 : r, t: targets.map((a) => a.id) });
        for (const a of targets) {
          this.heal(a, P, u);
          if (m.cleanse) { a.stunUntil = Math.min(a.stunUntil, this.t); a.burn = null; a.slowUntil = 0; a.confUntil = 0; }
        }
        break;
      }
      case 'shield': {
        const r = m.radius || 2;
        const targets = this.alliesOf(u).filter((a) => dist(a.x, a.y, u.x, u.y) <= r);
        this.ev({ ...base, x: u.x, y: u.y, r, t: targets.map((a) => a.id) });
        for (const a of targets) this.addShield(a, P, (m.dur || 4) * 1000, u);
        break;
      }
      case 'buff': {
        const b = { until: this.t + (m.dur || 5) * 1000, atk: m.atk[i], as: m.as[i] };
        if (m.stack) u.buffs.push(b);
        else u.buffs = [b];
        if (m.vamp) { u.vamp += m.vamp; this.schedule((m.dur || 5) * 1000, () => { u.vamp -= m.vamp; }); }
        this.ev({ ...base, x: u.x, y: u.y });
        u.busyUntil = this.t + 250;
        break;
      }
      case 'status': {
        if (!tg) break;
        const r = m.radius[i];
        this.ev({ ...base, tg: tg.id, x: tg.x, y: tg.y, r });
        const cx = tg.x, cy = tg.y;
        this.schedule(300, () => {
          for (const e of this.enemiesOf(u)) if (dist(e.x, e.y, cx, cy) <= r) hit(e, P);
          if (m.allyHeal) for (const a of this.alliesOf(u)) this.heal(a, a.maxHp * m.allyHeal[i] * ap, u);
        });
        break;
      }
      case 'splash': {
        this.ev({ ...base, x: u.x, y: u.y });
        this.ev({ k: 'txt', u: u.id, s: '¡Pero no pasó nada!' });
        break;
      }
      case 'payday': {
        if (!tg) break;
        const d = dist(u.x, u.y, tg.x, tg.y);
        const travel = 150 + d * 60;
        this.ev({ ...base, tg: tg.id, x: tg.x, y: tg.y, d: travel });
        this.schedule(travel, () => { if (tg.alive) hit(tg, P); });
        const side = this.sides[u.side];
        if (side.gold < 3 && this.rng() < m.gold[i] && !side.ghost && !side.pve) {
          side.gold++;
          this.ev({ k: 'coin', u: u.id, s: u.side });
        }
        break;
      }
      case 'global': {
        this.ev({ ...base, x: u.x, y: u.y, r: 9 });
        this.schedule(350, () => { for (const e of this.enemiesOf(u)) hit(e, P); });
        break;
      }
      case 'rest': {
        this.ev({ ...base, x: u.x, y: u.y });
        this.heal(u, u.maxHp * m.heal[i] * Math.min(1.5, ap), u);
        u.stunUntil = this.t + m.sleep[i] * 1000;
        u.stunKind = 'sleep';
        this.ev({ k: 'st', u: u.id, s: 'sleep', d: m.sleep[i] * 1000 });
        if (m.allyHeal?.[i]) for (const a of this.alliesOf(u)) if (a !== u) this.heal(a, a.maxHp * m.allyHeal[i], u);
        break;
      }
      case 'teleport': {
        const spot = this.safestHex(u);
        const fx = u.x, fy = u.y;
        if (spot) this.relocate(u, spot[0], spot[1]);
        this.ev({ ...base, x: u.x, y: u.y, fx0: fx, fy0: fy });
        this.addShield(u, P, 5000, u);
        break;
      }
      default:
        this.ev({ ...base, x: u.x, y: u.y });
    }
  }

  lowestEnemy(u) {
    let best = null, bh = 1e12;
    for (const e of this.enemiesOf(u)) if (e.hp < bh) { bh = e.hp; best = e; }
    return best;
  }

  farthestEnemy(u) {
    let best = null, bd = -1;
    for (const e of this.enemiesOf(u)) {
      const d = dist(u.x, u.y, e.x, e.y) + this.rng() * 0.3;
      if (d > bd) { bd = d; best = e; }
    }
    return best;
  }

  freeNear(x, y, u) {
    let best = null, bd = 1e9;
    for (const [hx, hy] of hexesInRadius(x, y, 2)) {
      if (hx === x && hy === y) continue;
      const occ = this.grid.get(key(hx, hy));
      if (occ && occ !== u) continue;
      const d = dist(hx, hy, x, y) * 10 + dist(hx, hy, u.x, u.y) * 0.1;
      if (d < bd) { bd = d; best = [hx, hy]; }
    }
    return best;
  }

  safestHex(u) {
    let best = null, bs = -1;
    const enemies = this.enemiesOf(u);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const occ = this.grid.get(key(x, y));
      if (occ && occ !== u) continue;
      let md = 99;
      for (const e of enemies) md = Math.min(md, dist(x, y, e.x, e.y));
      const s = md + this.rng() * 0.2;
      if (s > bs) { bs = s; best = [x, y]; }
    }
    return best;
  }

  ambush(u) {
    if (!u.alive) return;
    const t = this.farthestEnemy(u);
    if (!t) return;
    const spot = this.freeNear(t.x, t.y, u);
    if (!spot) return;
    const fx = u.x, fy = u.y;
    this.relocate(u, spot[0], spot[1]);
    u.target = t;
    this.ev({ k: 'dash', u: u.id, x: u.x, y: u.y, fx0: fx, fy0: fy });
  }

  // ───────────────────────── Dinamax (acción del jugador) ─────────────────────────
  dynamax(side, uid, longer = false) {
    const s = this.sides[side];
    if (s.dynaUsed || this.done) return false;
    let u = this.units.find((x) => x.alive && x.side === side && x.uid === uid);
    if (!u) {
      const mine = this.units.filter((x) => x.alive && x.side === side);
      mine.sort((a, b) => b.maxHp * b.star - a.maxHp * a.star);
      u = mine[0];
    }
    if (!u) return false;
    s.dynaUsed = true;
    u.dyna = true;
    u.dynaUntil = this.t + (longer ? 14000 : 9000);
    u.dynaBonus = u.maxHp;
    u.maxHp += u.dynaBonus;
    u.hp += u.dynaBonus;
    u.stunUntil = 0;
    u.confUntil = 0;
    this.ev({ k: 'dyna', u: u.id });
    this.ev({ k: 'txt', u: u.id, s: '¡DINAMAX!' });
    return true;
  }

  // ───────────────────────── Serialización ─────────────────────────
  flags(u) {
    let f = 0;
    if (u.stunUntil > this.t) f |= F.STUN | (STUN_BIT[u.stunKind] || 0);
    if (u.burn && u.burn.until > this.t) f |= F.BURN;
    if (u.slowUntil > this.t) f |= F.SLOW;
    if (u.confUntil > this.t) f |= F.CONFUSE;
    if (u.dyna) f |= F.DYNA;
    if (u.invulnUntil > this.t) f |= F.INVULN;
    if (u.disguise) f |= F.DISGUISE;
    if (u.boss) f |= F.BOSS;
    return f;
  }

  shieldOf(u) {
    let s = 0;
    for (const sh of u.shields) if (sh.until > this.t) s += sh.amt;
    return Math.round(s);
  }

  snapshot() {
    return this.units.filter((u) => u.alive).map((u) => [
      u.id, u.x, u.y, Math.max(0, Math.round(u.hp)), u.maxHp, Math.round(u.mana), u.maxMana, this.shieldOf(u), this.flags(u),
    ]);
  }

  initInfo() {
    return {
      id: this.id,
      kind: this.kind,
      title: this.title,
      weather: this.weather,
      sides: this.sides.map((s) => ({ playerId: s.playerId, name: s.name, ghost: !!s.ghost, pve: !!s.pve })),
      units: this.units.map((u) => ({
        id: u.id, side: u.side, form: u.form, line: u.line, star: u.star, shiny: u.shiny, items: u.items,
        x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, uid: u.uid,
        boss: u.boss, fr: u.fr, shield: this.shieldOf(u),
      })),
      time: this.t,
    };
  }
}

// Convierte una posición local del jugador (x 0..6, y 0..3 con 0 = primera línea) a coordenadas de combate.
export function toCombat(x, y, side) {
  if (side === 0) return [x, 4 + y];
  return [COLS - 1 - x, 3 - y];
}

export { inBounds };
