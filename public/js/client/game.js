// Controlador de la partida en el cliente: estado, vistas 3D, entrada y efectos.
import * as THREE from 'three';
import { hexToWorld, benchToWorld } from './engine.js';
import { UnitView } from './units.js';
import { Hud, esc } from './ui.js';
import { TYPE_COLOR } from './fx.js';
import { sfx } from './audio.js';
import { portrait, warmPortraits } from './portraits.js';
import { FORMS, LINES } from '../game/data/pokemon.js';
import { ITEMS } from '../game/data/items.js';
import { WEATHERS, BADGES } from '../game/data/world.js';
import { mirror, COLS } from '../game/hex.js';

const $ = (id) => document.getElementById(id);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class GameClient {
  constructor({ engine, arena, fx, net, myId, onExit, solo }) {
    this.engine = engine;
    this.arena = arena;
    this.fx = fx;
    this.net = net;
    this.myId = myId;
    this.onExit = onExit;
    this.solo = solo;
    this.me = null;
    this.room = null;
    this.views = new Map(); // tablero/banquillo (uid)
    this.cviews = new Map(); // combate (id)
    this.sviews = new Map(); // safari
    this.fight = null;
    this.scoutId = null;
    this.mode = 'board';
    this.hover = null;
    this.drag = null;
    this.itemDrag = null;
    this.dynaArmed = false;
    this.ctx = { scene: engine.scene, engine, fx, overlay: $('overlay') };
    this.hud = new Hud(this);
    this.hud.show(true);
    document.getElementById('hud').classList.toggle('solo', !!solo);
    this.unsub = net.on((m) => this.onMsg(m));
    this.bindInput();
    this.stopUpdate = engine.onUpdate((dt, t) => this.update(dt, t));
    this.companion = null;
    sfx.setMood('calm');
    // Pre-renderiza retratos de formas base.
    warmPortraits(Object.values(LINES).map((l) => [l.forms[0], false]));
  }

  send(msg) { this.net.send(msg); }

  // ───────────────────────── Mensajes ─────────────────────────
  onMsg(m) {
    switch (m.t) {
      case 'state': this.onState(m.room, m.me); break;
      case 'me': this.onMe(m.me); break;
      case 'fx': this.onFx(m); break;
      case 'round': this.onRound(m); break;
      case 'cs': this.onCombatStart(m); break;
      case 'ct': this.onCombatTick(m); break;
      case 'ce': this.onCombatEnd(m); break;
      case 'toast': this.hud.toast(m.text); break;
      case 'emote': this.onEmote(m); break;
      case 'chat': this.hud.chat(m.name, m.text); sfx.play('click'); break;
      case 'gameover': this.onGameOver(m); break;
      case 'safariPick': this.onSafariPick(m); break;
      case '_close': if (!this.solo) this.hud.toast('📴 Conexión perdida… reconectando'); break;
    }
  }

  onState(room, me) {
    const prev = this.room;
    this.room = room;
    if (me) this.me = me;
    if (!prev || prev.weather !== room.weather) this.arena.setWeather(room.weather, !prev);
    if (prev && prev.phase !== room.phase) this.onPhase(prev.phase, room.phase);
    if (!prev) this.onPhase(null, room.phase);
    this.hud.render(room, this.me);
    if (room.phase === 'safari') this.renderSafari();
    else if (this.sviews.size) this.clearSafari();
    this.refreshBoard();
    this.updateCompanion();
  }

  onMe(me) {
    const prev = this.me;
    this.me = me;
    if (prev && me.gold > prev.gold + 0 && prev.gold !== undefined && this.room?.phase !== 'planning') { /* oro de combate */ }
    if (prev && me.level > prev.level) { /* manejado por fx levelup */ }
    this.hud.renderMe(me);
    this.refreshBoard();
  }

  onPhase(from, to) {
    if (to === 'planning') {
      this.exitCombat();
      sfx.setMood('calm');
      this.dynaArmed = false;
      this.dynaUsed = false;
      if (this.me?.pendingBadge && !this.badgeOpen) setTimeout(() => this.me?.pendingBadge && this.hud.showBadges(this.me.pendingBadge), 900);
    }
    if (to === 'combat') {
      sfx.setMood('battle');
    }
    if (to === 'safari') {
      this.exitCombat();
      this.hud.banner('🦁 ¡Zona Safari!', '', 'El entrenador con menos vida elige primero');
    }
  }

  onRound(m) {
    const w = WEATHERS[m.weather];
    const t = m.rtype === 'pvp' ? '⚔️ Combate' : m.rtype === 'safari' ? '🦁 Zona Safari' : m.stage === 1 ? '🌿 Pokémon salvajes' : m.stage <= 3 ? '🏟️ Gimnasio' : m.stage === 4 ? '👑 Alto Mando' : '🔴 Incursión Dinamax';
    if (m.rtype !== 'safari') this.hud.banner(`Etapa ${m.stage}-${m.round}`, '', t);
    sfx.play('round');
    if (m.round === 1 && m.stage >= 2) {
      setTimeout(() => this.hud.toast(`${w.icon} El clima cambia: ${w.name}. ${w.desc}`, true), 1200);
      if (m.event) {
        import('../game/data/world.js').then(({ EVENTS }) => {
          const ev = EVENTS[m.event.id];
          const desc = ev.desc.replace('{type}', m.event.type ? m.event.type : '');
          setTimeout(() => this.hud.toast(`📰 Noticias del Profesor: ${ev.icon} ${ev.name} — ${desc}`, true), 2600);
        });
      }
    }
  }

  onFx(m) {
    switch (m.kind) {
      case 'evolve': {
        sfx.play('evolve');
        this.hud.toast('✨ ' + m.text, true);
        const v = this.views.get(m.uid);
        if (v) {
          v.evolveFx(() => {
            v.swapModel(m.to, v.shiny, m.star);
            this.fx.sparkle(v.group.position.clone().add(V3(0, 0.6, 0)), 0xffffff, 26, 0.9);
            this.fx.ring(v.group.position, 2, 0xfff4a0, 0.6);
          });
          v.evolving = true;
          setTimeout(() => { v.evolving = false; this.refreshBoard(); }, 2100);
        }
        break;
      }
      case 'levelup': sfx.play('level'); this.hud.toast(`⬆️ ¡Nivel ${m.level}! Ya caben ${m.level} Pokémon en el tablero.`); break;
      case 'toast': this.hud.toast(m.text, m.big); if (m.text.includes('lleno') || m.text.includes('Máximo')) sfx.play('error'); break;
      case 'item': sfx.play('place'); break;
      case 'badge': sfx.play('badge'); this.hud.toast(`🏅 Medalla obtenida: ${BADGES[m.id].name}`, true); break;
      case 'capture': this.onCaptureResult(m); break;
      case 'eliminated': this.hud.banner(`💀 Eliminado`, 'lose', `Has quedado ${m.place}º`); sfx.play('lose'); break;
    }
  }

  onEmote(m) {
    this.hud.emote(m.from, m.e);
    const viewed = this.scoutId || this.myId;
    if (m.from === viewed && this.companion) {
      this.fx.text(this.companion.topPos().add(V3(0, 0.6, 0)), m.e, 'txt big', 2);
      this.companion.jump();
    }
  }

  onGameOver(m) {
    const me = m.players.find((p) => p.id === this.myId);
    sfx.play(me?.place === 1 ? 'win' : 'lose');
    setTimeout(() => this.hud.showGameOver(m, this.myId, () => this.exit()), 1200);
  }

  exit() {
    this.hud.closeModal();
    this.dispose();
    this.onExit && this.onExit();
  }

  // ───────────────────────── Tablero (planificación) ─────────────────────────
  viewedPlayer() {
    if (this.scoutId && this.room) return this.room.players.find((p) => p.id === this.scoutId);
    return null;
  }

  currentOpponent() {
    if (!this.room) return null;
    const f = this.room.fights?.find((x) => x.players.includes(this.myId) && !x.ended);
    if (!f) return null;
    return f.players.find((p) => p !== this.myId) || null;
  }

  refreshBoard() {
    if (!this.me || !this.room) return;
    const sp = this.viewedPlayer();
    const board = sp ? sp.board : this.me.board;
    const bench = sp ? sp.bench : this.me.bench;
    const showBoard = this.mode !== 'combat' && this.room.phase !== 'safari';
    const wanted = new Map();
    if (showBoard) for (const u of board) wanted.set(u.uid, { u, pos: hexToWorld(u.x, 4 + u.y), bench: false });
    bench.forEach((u, i) => { if (u) wanted.set(u.uid, { u, pos: benchToWorld(i), bench: true }); });
    for (const [uid, v] of this.views) {
      if (!wanted.has(uid) && !v.evolving) { v.dispose(); this.views.delete(uid); }
    }
    for (const [uid, { u, pos, bench: onBench }] of wanted) {
      let v = this.views.get(uid);
      if (v && (v.form !== u.form || v.shiny !== u.shiny || v.star !== u.star) && !v.evolving) {
        v.swapModel(u.form, u.shiny, u.star);
      }
      if (!v) {
        v = new UnitView(this.ctx, { uid, form: u.form, line: u.line, star: u.star, shiny: u.shiny, items: u.items, fr: u.fr, bench: onBench });
        v.place(pos);
        v.faceYaw(0);
        v.yaw = 0;
        this.views.set(uid, v);
        if (!sp) this.fx.burst(pos.clone().add(V3(0, 0.3, 0)), 0xffffff, 8, 2, 0.3, 0.3);
      } else if (!v.dragging) {
        if (v.pos.distanceTo(pos) > 0.01) v.moveTo(pos, 220, 0.5);
      }
      v.items = u.items || [];
      v.fr = u.fr || 0;
      v.hp = 1; v.maxHp = 1; v.mana = 0; v.maxMana = 0; v.shield = 0;
      v.setBench(onBench);
      v.bar.classList.add('hidebars');
      v.updateBar();
      v.unit = u;
      v.own = !sp;
      if (!v.dragging && !v.act) v.faceYaw(0);
    }
  }

  // ───────────────────────── Combate ─────────────────────────
  onCombatStart(m) {
    const target = this.scoutId || this.myId;
    if (!m.sides.some((s) => s.playerId === target)) return;
    this.exitCombat(true);
    this.mode = 'combat';
    this.fight = { id: m.id, mirror: m.sides[1].playerId === target, mySide: m.sides[1].playerId === target ? 1 : 0, kind: m.kind, title: m.title, sides: m.sides, ended: false, units: new Map() };
    const f = this.fight;
    for (const u of m.units) {
      const [x, y] = f.mirror ? mirror(u.x, u.y) : [u.x, u.y];
      const pos = hexToWorld(x, y);
      const enemy = u.side !== f.mySide;
      const v = new UnitView(this.ctx, { id: u.id, uid: u.uid, form: u.form, line: u.line, star: u.star, shiny: u.shiny, items: u.items, enemy, boss: u.boss, hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield, fr: u.fr });
      v.place(pos);
      v.yaw = v.targetYaw = enemy ? 0 : Math.PI;
      v.types = FORMS[u.form].types;
      this.cviews.set(u.id, v);
      f.units.set(u.id, u);
      if (enemy && m.time < 200) {
        v.group.visible = false;
        v.bar.style.visibility = 'hidden';
        const reveal = () => {
          if (v.group.visible) return;
          v.group.visible = true; v.bar.style.visibility = ''; v.jump();
          if (v.shiny) { sfx.play('shiny'); this.fx.sparkle(v.midPos(), 0xffffff, 20, 0.7); }
        };
        setTimeout(() => this.fx.pokeball(pos, reveal), 150 + Math.random() * 450);
        setTimeout(reveal, 1300);
      }
    }
    this.refreshBoard();
    if (m.time < 200) {
      if (m.kind === 'pvp') {
        const opp = m.sides[1 - f.mySide];
        this.hud.banner('¡Combate!', '', `vs. ${esc(opp.name)}`);
      } else this.hud.banner(m.kind === 'raid' ? '🔴 ¡Incursión!' : m.kind === 'gym' ? '🏟️ ¡Desafío!' : '🌿 ¡Salvajes!', '', esc(m.title));
      sfx.play('fight');
    }
    this.hud.renderMe(this.me);
  }

  combatPos(x, y) {
    const [mx, my] = this.fight.mirror ? mirror(x, y) : [x, y];
    return hexToWorld(mx, my);
  }

  onCombatTick(m) {
    const f = this.fight;
    if (!f || m.id !== f.id) return;
    const seen = new Set();
    for (const s of m.u) {
      const [id, x, y, hp, maxHp, mana, maxMana, shield, flags] = s;
      const v = this.cviews.get(id);
      if (!v || v.dead) continue;
      seen.add(id);
      v.setState(hp, maxHp, mana, maxMana, shield, flags);
      const p = this.combatPos(x, y);
      if (v.pos.distanceToSquared(p) > 0.01 && !v.anim) v.moveTo(p, 300, 0.25);
    }
    for (const e of m.ev) this.combatEvent(e);
  }

  combatEvent(e) {
    const f = this.fight;
    const V = (id) => this.cviews.get(id);
    switch (e.k) {
      case 'mv': {
        const v = V(e.u);
        if (v && !v.dead) v.moveTo(this.combatPos(e.x, e.y), e.d, 0.3);
        break;
      }
      case 'atk': {
        const a = V(e.u), t = V(e.tg);
        if (!a || !t) break;
        if (e.r) {
          a.shoot(t.pos);
          this.fx.projectile(a.midPos(), t.midPos(), TYPE_COLOR[a.types[0]] || 0xffffff, e.d / 1000, 0.13, 0.3);
        } else a.lunge(t.pos);
        break;
      }
      case 'proj': {
        const a = V(e.u), t = V(e.tg);
        if (a && t) this.fx.projectile(a.midPos(), t.midPos(), TYPE_COLOR[e.ty] || 0xffffff, e.d / 1000, 0.2, 0.5);
        break;
      }
      case 'dmg': {
        const t = V(e.u);
        if (!t) break;
        const cls = [e.t, e.c ? 'crit' : '', e.e > 0 ? 'se' : e.e < 0 ? 'nve' : '', e.dot ? 'small' : ''].join(' ');
        this.fx.text(t.topPos(), String(e.a), cls, 0.9, (Math.random() - 0.5) * 30);
        if (!e.dot) {
          t.hitFlash();
          sfx.play(e.c ? 'crit' : 'hit');
          if (e.e > 0 && e.a > 60 && Math.random() < 0.35) { this.fx.text(t.topPos().add(V3(0, 0.5, 0)), '¡Súper eficaz!', 'txt small', 1.2); sfx.play('se'); }
          if (e.a > 250) this.fx.impact(t.midPos(), t.types?.[0], true);
        }
        break;
      }
      case 'heal': {
        const t = V(e.u);
        if (t && e.a >= 30) { this.fx.text(t.topPos(), '+' + e.a, 'heal', 0.9, 20); this.fx.rising(t.group.position, 0x6cf07e, 5, 0.4); sfx.play('heal'); }
        break;
      }
      case 'shield': {
        const t = V(e.u);
        if (t) { this.fx.bubble(t.group, Math.max(0.6, t.height * 0.75)); sfx.play('shield'); }
        break;
      }
      case 'cast': {
        const a = V(e.u);
        if (!a) break;
        a.castAnim();
        const from = a.group.position.clone();
        const to = e.x !== undefined ? this.combatPos(e.x, e.y) : V(e.tg)?.pos || from;
        if (e.kind === 'dash' || e.kind === 'teleport') {
          a.moveTo(to, 220, 1.2);
        }
        if (e.kind === 'chain' && e.t) {
          const pts = [a.midPos(), ...e.t.map((id) => V(id)?.midPos()).filter(Boolean)];
          this.fx.lightning(pts, TYPE_COLOR[e.ty] || 0xffe14a);
          sfx.play('zap');
        } else if (e.kind === 'multi') {
          // proyectiles vía eventos 'proj'
        } else {
          this.fx.cast(e.kind, e.ty, from, to, e.r || 1, e);
          sfx.play(['blast', 'nova', 'global', 'beam'].includes(e.kind) ? 'blast' : 'cast');
        }
        if (e.kind === 'splash') sfx.play('splash');
        if (e.kind === 'global') this.engine.shake = 0.8;
        if (e.kind === 'heal' && e.t) for (const id of e.t) { const t = V(id); if (t) this.fx.rising(t.group.position, 0x6cf07e, 6, 0.4); }
        if (e.m) this.fx.text(a.topPos().add(V3(0, 0.45, 0)), e.m, 'txt', 1.4);
        break;
      }
      case 'chain': {
        const a = V(e.u);
        if (!a) break;
        const pts = [a.midPos(), ...e.t.map((id) => V(id)?.midPos()).filter(Boolean)];
        this.fx.lightning(pts, 0xffe14a, 0.2);
        break;
      }
      case 'dash': {
        const a = V(e.u);
        if (a) { const to = this.combatPos(e.x, e.y); this.fx.cast('dash', a.types[0], a.group.position.clone(), to); a.moveTo(to, 250, 1.4); }
        break;
      }
      case 'st': {
        const t = V(e.u);
        const txt = { sleep: '¡Dormido!', para: '¡Paralizado!', freeze: '¡Congelado!', confuse: '¡Confuso!', flinch: '¡Retrocede!' }[e.s];
        if (t && txt && Math.random() < 0.6) this.fx.text(t.topPos().add(V3(0, 0.3, 0)), txt, 'txt small', 1);
        break;
      }
      case 'die': {
        const t = V(e.u);
        if (!t) break;
        t.die();
        this.fx.burst(t.midPos(), 0xffffff, 16, 4, 0.4, 0.5);
        this.fx.burst(t.midPos(), TYPE_COLOR[t.types?.[0]] || 0xcccccc, 10, 3, 0.35, 0.5);
        sfx.play('die');
        break;
      }
      case 'txt': {
        const t = V(e.u);
        if (t) this.fx.text(t.topPos().add(V3(0, 0.4, 0)), e.s, 'txt', 1.5);
        if (e.s.includes('Z')) this.engine.shake = 0.4;
        break;
      }
      case 'coin': {
        const t = V(e.u);
        if (t) { this.fx.coins(t.midPos(), 10); this.fx.text(t.topPos(), '+1 💰', 'coin', 1.2); sfx.play('coin'); }
        break;
      }
      case 'dyna': {
        const t = V(e.u);
        if (!t) break;
        sfx.play('dyna');
        this.engine.shake = 1;
        this.fx.ring(t.group.position, 3.5, 0xff2050, 0.8);
        this.fx.dome(t.group.position.clone().add(V3(0, 1, 0)), 2.5, 0xff4070, 0.6);
        if (!t.enemy) this.dynaUsed = true;
        this.dynaArmed = false;
        break;
      }
      case 'quake': {
        this.engine.shake = 0.6;
        sfx.play('quake');
        this.fx.ring(V3(0, 0, e.s === f.mySide ? -2.5 : 2.5), 8, 0xd9a44e, 0.7);
        break;
      }
      case 'fx': {
        const t = V(e.u);
        if (t && e.f === 'heal') this.fx.ring(t.group.position, 3, 0x6cf07e, 0.6);
        break;
      }
    }
  }

  onCombatEnd(m) {
    const f = this.fight;
    if (!f || m.id !== f.id) return;
    f.ended = true;
    const target = this.scoutId || this.myId;
    const mySide = f.mySide;
    let cls, txt, sub = '';
    if (m.winner === -1) { cls = 'draw'; txt = 'Empate'; }
    else if (m.winner === mySide) { cls = 'win'; txt = '¡Victoria!'; }
    else { cls = 'lose'; txt = 'Derrota'; }
    const dmg = m.dmg?.[target];
    if (dmg) sub = `−${dmg} PS`;
    if (m.loot && target === this.myId) {
      const l = m.loot;
      const parts = [];
      if (l.items) parts.push(`${l.items} objeto${l.items > 1 ? 's' : ''}`);
      if (l.gold) parts.push(`+${l.gold} 💰`);
      if (l.caramelo) parts.push('🍬');
      if (l.legend) parts.push(`¡${FORMS[l.legend].name}!`);
      if (parts.length) sub = (sub ? sub + ' · ' : '') + 'Botín: ' + parts.join(', ');
      if (l.capture) setTimeout(() => this.hud.toast(`🎯 ¡Un ${FORMS[l.capture.form].name}${l.capture.shiny ? ' ✨ SHINY' : ''} salvaje se ha quedado! Intenta capturarlo.`, true), 1500);
    }
    const g = m.gold?.[mySide];
    if (g) sub = (sub ? sub + ' · ' : '') + `Día de Pago +${g} 💰`;
    this.hud.banner(txt, cls, sub);
    if (target === this.myId) sfx.play(cls === 'win' ? 'win' : cls === 'lose' ? 'lose' : 'round');
    for (const v of this.cviews.values()) {
      if (v.dead) continue;
      const won = (v.enemy ? 1 - mySide : mySide) === m.winner;
      if (won) setTimeout(() => v.celebrate(), Math.random() * 300);
    }
    this.showRecap(m.stats, mySide);
    if (this.companion) { if (cls === 'win') this.companion.celebrate(); else if (cls === 'lose') this.companion.hitFlash(); }
  }

  showRecap(stats, mySide) {
    document.getElementById('recap')?.remove();
    if (!stats?.length) return;
    const mine = stats.filter((s) => s.side === mySide).sort((a, b) => b.dmg - a.dmg).slice(0, 6);
    const max = Math.max(1, ...mine.map((s) => s.dmg));
    const d = document.createElement('div');
    d.id = 'recap';
    d.innerHTML = `<h4>📊 Daño infligido</h4>` + mine.map((s) => `<div class="r"><img src="${portrait(s.form, s.shiny)}"/><div class="bar"><i style="width:${(s.dmg / max) * 100}%"></i></div><span>${s.dmg}</span></div>`).join('');
    document.body.appendChild(d);
    clearTimeout(this._recapT);
    this._recapT = setTimeout(() => d.remove(), 6000);
  }

  exitCombat(keepMode = false) {
    for (const v of this.cviews.values()) v.dispose();
    this.cviews.clear();
    this.fight = null;
    if (!keepMode) {
      this.mode = 'board';
      this.refreshBoard();
    }
  }

  // ───────────────────────── Dinamax ─────────────────────────
  armDynamax() {
    if (!this.me || this.me.dyna < this.me.dynaNeed || !this.fight || this.scoutId) return;
    if (this.dynaArmed) { this.send({ t: 'dynamax', uid: null }); this.dynaArmed = false; return; }
    this.dynaArmed = true;
    this.hud.toast('🔴 Toca a uno de tus Pokémon para Dinamaxizarlo');
    clearTimeout(this._dynaT);
    this._dynaT = setTimeout(() => { if (this.dynaArmed) { this.send({ t: 'dynamax', uid: null }); this.dynaArmed = false; } }, 5000);
    this.hud.renderMe(this.me);
  }

  // ───────────────────────── Captura ─────────────────────────
  openCapture() {
    const c = this.me?.capture;
    if (!c) return;
    const box = this.hud.modal(`<h2>🎯 ¡${esc(FORMS[c.form].name)}${c.shiny ? ' ✨' : ''} salvaje!</h2>
      <p>Pulsa cuando el anillo verde sea lo más pequeño posible.</p>
      <div class="capture" id="cap-area"><img src="${portrait(c.form, c.shiny, { full: true })}"/><div class="ring inner"></div><div class="ring" id="cap-ring"></div></div>
      <div class="capture-msg" id="cap-msg"></div>
      <div class="row-btns"><button class="btn primary big" id="cap-throw">¡Lanzar Poké Ball!</button></div>`, false);
    const ring = box.querySelector('#cap-ring');
    let t0 = performance.now();
    let running = true;
    const loop = () => {
      if (!running) return;
      const t = (performance.now() - t0) / 1000;
      const k = (Math.sin(t * 3.2) * 0.5 + 0.5);
      const size = 60 + k * 190;
      ring.style.width = ring.style.height = size + 'px';
      ring.style.borderColor = k < 0.25 ? '#4fd36b' : k < 0.6 ? '#ffcb05' : '#ef4a3a';
      this._capK = k;
      requestAnimationFrame(loop);
    };
    loop();
    const throwBall = () => {
      if (!running) return;
      running = false;
      const q = 1 - this._capK;
      box.querySelector('#cap-throw').disabled = true;
      const area = box.querySelector('#cap-area');
      const ball = document.createElement('div');
      ball.className = 'ball thrown';
      area.appendChild(ball);
      this._capBall = ball;
      this._capArea = area;
      sfx.play('throw');
      setTimeout(() => { area.querySelector('img').style.transition = 'transform .3s, opacity .3s'; area.querySelector('img').style.transform = 'scale(0.1)'; area.querySelector('img').style.opacity = '0'; ring.remove(); area.querySelector('.inner')?.remove(); }, 550);
      setTimeout(() => this.send({ t: 'capture', q }), 700);
    };
    box.querySelector('#cap-throw').onclick = throwBall;
    box.querySelector('#cap-area').onclick = throwBall;
  }

  onCaptureResult(m) {
    const ball = this._capBall, area = this._capArea;
    const msg = document.getElementById('cap-msg');
    if (!ball || !msg) { this.hud.toast(m.ok ? `🎉 ¡Has capturado a ${FORMS[m.form].name}!` : `💨 ${FORMS[m.form].name} escapó…`, true); return; }
    let i = 0;
    const shake = () => {
      if (i < m.shakes) {
        ball.className = 'ball';
        void ball.offsetWidth;
        ball.className = 'ball shake';
        sfx.play('shake');
        msg.textContent = '.'.repeat(i + 1);
        i++;
        setTimeout(shake, 800);
      } else if (m.ok) {
        ball.classList.add('ok');
        msg.textContent = `🎉 ¡${FORMS[m.form].name} atrapado!`;
        sfx.play('caught');
        setTimeout(() => this.hud.closeModal(), 1600);
      } else {
        msg.textContent = `💨 ¡Oh, no! ¡${FORMS[m.form].name} escapó!`;
        sfx.play('escape');
        ball.style.display = 'none';
        const img = area.querySelector('img');
        img.style.transform = 'scale(1)'; img.style.opacity = '1';
        setTimeout(() => this.hud.closeModal(), 1600);
      }
    };
    setTimeout(shake, 300);
  }

  // ───────────────────────── Zona Safari ─────────────────────────
  renderSafari() {
    const s = this.room.safari;
    if (!s) return;
    // Opciones en círculo.
    const n = s.options.length;
    s.options.forEach((o, i) => {
      let v = this.sviews.get(o.id);
      if (o.takenBy) {
        if (v && !v.leaving) {
          v.leaving = true;
          this.fx.burst(v.midPos(), 0xffffff, 16, 4, 0.4, 0.5);
          sfx.play('buy');
          setTimeout(() => { v.dispose(); this.sviews.delete(o.id); }, 50);
        }
        return;
      }
      if (!v) {
        v = new UnitView(this.ctx, { id: o.id, form: o.form, line: o.line, star: 1, shiny: o.shiny, items: [o.item], bench: true });
        v.safari = o;
        v.angle = (i / n) * Math.PI * 2;
        this.sviews.set(o.id, v);
      }
    });
    let ui = document.getElementById('safari-ui');
    if (!ui) { ui = document.createElement('div'); ui.id = 'safari-ui'; document.body.appendChild(ui); }
    const cur = s.order[s.turn];
    const curP = this.room.players.find((p) => p.id === cur);
    const mine = cur === this.myId;
    ui.innerHTML = `<h3>${s.turn < 0 ? '🦁 Zona Safari' : mine ? '👉 ¡Tu turno! Elige un Pokémon' : curP ? `Elige: ${esc(curP.name)}` : 'Zona Safari'}</h3>
      <div class="order">${s.order.map((pid, i) => { const p = this.room.players.find((x) => x.id === pid); return `<span class="${i === s.turn ? 'cur' : i < s.turn ? 'done' : ''}" title="${esc(p?.name || '')}"><img src="${portrait(p?.avatar || 'pikachu')}"/></span>`; }).join('')}</div>`;
    if (mine && this._lastSafariTurn !== s.turn) { sfx.play('round'); this._lastSafariTurn = s.turn; }
  }

  onSafariPick(m) {
    const p = this.room?.players.find((x) => x.id === m.pid);
    const v = this.sviews.get(m.opt);
    if (v && p) this.fx.text(v.topPos().add(V3(0, 0.5, 0)), `→ ${p.name}`, 'txt', 1.4);
  }

  clearSafari() {
    for (const v of this.sviews.values()) v.dispose();
    this.sviews.clear();
    document.getElementById('safari-ui')?.remove();
  }

  // ───────────────────────── Compañero ─────────────────────────
  updateCompanion() {
    const p = this.scoutId ? this.viewedPlayer() : this.room?.players.find((x) => x.id === this.myId);
    if (!p) return;
    const form = p.avatar;
    if (!this.companion || this.companion.form !== form) {
      this.companion?.dispose();
      this.companion = new UnitView(this.ctx, { id: 'comp', form, line: FORMS[form]?.line || 'pichu', star: 1, bench: true, scaleMul: 1.25 });
      this.companion.hideBar = true;
      this.companion.place(V3(-9.3, 0, 4.4));
      this.companion.yaw = this.companion.targetYaw = 2.4;
    }
  }

  // ───────────────────────── Entrada ─────────────────────────
  bindInput() {
    const c = this.engine.canvas;
    this.onDown = (e) => this.pointerDown(e);
    this.onMove = (e) => this.pointerMove(e);
    this.onUp = (e) => this.pointerUp(e);
    this.onKey = (e) => this.keyDown(e);
    this.onWheel = (e) => { this.engine.camZoom = Math.max(0.72, Math.min(1.35, this.engine.camZoom + e.deltaY * 0.0008)); };
    c.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', this.onKey);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  ndc(e) {
    return { x: (e.clientX / this.engine.width) * 2 - 1, y: -(e.clientY / this.engine.height) * 2 + 1 };
  }

  // Selecciona la vista bajo el puntero (proyección a pantalla).
  pick(e, pool) {
    let best = null, bd = 1e9;
    for (const v of pool) {
      if (!v || v.dead || v.removed || !v.group.visible) continue;
      const s = this.engine.toScreen(v.midPos());
      const top = this.engine.toScreen(v.topPos());
      const r = Math.max(26, Math.abs(s.y - top.y) * 1.6);
      const d = Math.hypot(s.x - e.clientX, s.y - e.clientY);
      if (d < r && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  planningViews() { return [...this.views.values()]; }

  canDrag(v) {
    if (!v || !v.own || !this.me?.alive) return false;
    const phase = this.room?.phase;
    if (!['planning', 'combat', 'results'].includes(phase)) return false;
    if (phase === 'combat' && !v.onBench) return false;
    return true;
  }

  pointerDown(e) {
    sfx.unlock();
    if (e.button === 2) return;
    // Safari: elegir opción.
    if (this.room?.phase === 'safari') {
      const v = this.pick(e, [...this.sviews.values()]);
      if (v && this.room.safari.order[this.room.safari.turn] === this.myId) this.send({ t: 'safari', id: v.safari.id });
      return;
    }
    // Dinamax: elegir unidad propia en combate.
    if (this.dynaArmed && this.fight) {
      const v = this.pick(e, [...this.cviews.values()].filter((x) => !x.enemy));
      if (v) {
        this.send({ t: 'dynamax', uid: v.uid });
        this.dynaArmed = false;
        clearTimeout(this._dynaT);
        return;
      }
    }
    const v = this.pick(e, this.planningViews());
    if (v && this.canDrag(v)) {
      this.drag = { v, start: { x: e.clientX, y: e.clientY }, moved: false, from: v.pos.clone() };
      this.hud.hideTip();
    }
  }

  pointerMove(e) {
    if (this.itemDrag) { this.moveItemDrag(e); return; }
    const d = this.drag;
    if (d) {
      if (!d.moved && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 6) {
        d.moved = true;
        d.v.dragging = true;
        sfx.play('pickup');
        const sz = $('sell-zone');
        sz.classList.add('show');
        const unit = d.v.unit;
        if (unit) {
          const cost = LINES[unit.line].cost;
          const copies = Math.pow(3, unit.star - 1);
          $('sell-val').textContent = `+${Math.max(1, cost * copies - (unit.star > 1 && cost > 1 ? 1 : 0))}💰`;
        }
        if (this.room?.phase !== 'combat') this.arena.tintMySide(true);
      }
      if (d.moved) {
        const p = this.engine.pickPlane(this.ndc(e).x, this.ndc(e).y, 0);
        if (p) d.v.group.position.set(p.x, 0.7, p.z);
        this.updateDropTarget(e, p);
      }
      return;
    }
    // Hover → tooltip.
    if (e.target !== this.engine.canvas) return;
    const pool = this.mode === 'combat' ? [...this.cviews.values(), ...this.planningViews().filter((v) => v.onBench)] : this.room?.phase === 'safari' ? [...this.sviews.values()] : this.planningViews();
    const v = this.pick(e, pool);
    this.hover = v;
    if (v && v !== this.companion) {
      const data = v.safari ? { form: v.form, star: 1, shiny: v.shiny, items: v.items } : v.unit ? { ...v.unit } : { form: v.form, star: v.star, shiny: v.shiny, items: v.items, hp: v.hp, maxHp: v.maxHp, mana: v.mana, fr: v.fr };
      if (!data.line) data.line = FORMS[data.form].line;
      this.hud.showFormTip(data, e.clientX, e.clientY);
      this.engine.canvas.style.cursor = this.canDrag(v) || v.safari ? 'grab' : 'help';
    } else {
      this.hud.hideTip();
      this.engine.canvas.style.cursor = this.dynaArmed ? 'crosshair' : '';
    }
  }

  updateDropTarget(e, p) {
    this.arena.clearHighlights();
    if (this.room?.phase !== 'combat') this.arena.tintMySide(true);
    const d = this.drag;
    d.target = null;
    const shop = $('shop').getBoundingClientRect();
    const overShop = e.clientY > shop.top - 4 && e.clientX > shop.left && e.clientX < shop.right;
    $('sell-zone').classList.toggle('hot', overShop);
    if (overShop) { d.target = { type: 'sell' }; return; }
    if (!p) return;
    // Banquillo.
    let best = null, bd = 1.0;
    for (let i = 0; i < 9; i++) {
      const b = benchToWorld(i);
      const dist = Math.hypot(b.x - p.x, b.z - p.z);
      if (dist < bd) { bd = dist; best = { type: 'bench', i }; }
    }
    if (this.room?.phase !== 'combat') {
      for (let y = 0; y < 4; y++) for (let x = 0; x < COLS; x++) {
        const h = hexToWorld(x, 4 + y);
        const dist = Math.hypot(h.x - p.x, h.z - p.z);
        if (dist < bd) { bd = dist; best = { type: 'board', x, y }; }
      }
    }
    d.target = best;
    if (best?.type === 'bench') this.arena.highlightBench(best.i);
    if (best?.type === 'board') this.arena.highlightHex(best.x, 4 + best.y);
  }

  pointerUp(e) {
    if (this.itemDrag) { this.endItemDrag(e); return; }
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    $('sell-zone').classList.remove('show', 'hot');
    this.arena.clearHighlights();
    d.v.dragging = false;
    if (!d.moved) {
      // clic simple: nada (tooltip ya visible)
      return;
    }
    const t = d.target;
    if (!t) { d.v.pos.copy(d.from); return; }
    if (t.type === 'sell') {
      this.send({ t: 'sell', uid: d.v.uid });
      sfx.play('sell');
      this.fx.coins(d.v.group.position.clone(), 8);
      d.v.group.visible = false;
      return;
    }
    if (t.type === 'bench') {
      d.v.pos.copy(benchToWorld(t.i));
      this.send({ t: 'move', uid: d.v.uid, to: { type: 'bench', i: t.i } });
    } else {
      d.v.pos.copy(hexToWorld(t.x, 4 + t.y));
      this.send({ t: 'move', uid: d.v.uid, to: { type: 'board', x: t.x, y: t.y } });
    }
    sfx.play('place');
    this.fx.burst(d.v.pos.clone().add(V3(0, 0.2, 0)), 0xffffff, 6, 2, 0.25, 0.3);
  }

  // Arrastre de objetos desde el HUD.
  startItemDrag(idx, e) {
    const id = this.me?.items[idx];
    if (!id) return;
    const d = ITEMS[id];
    const ghost = document.createElement('div');
    ghost.className = `item ${d.component || d.consumable ? '' : 'full'}`;
    ghost.style.cssText = `position:fixed;z-index:60;pointer-events:none;--ic:${d.color};--ic2:${d.color2 || d.color};transform:translate(-50%,-50%) scale(1.3)`;
    ghost.textContent = d.icon;
    document.body.appendChild(ghost);
    this.itemDrag = { idx, ghost };
    this.hud.hideTip();
    this.moveItemDrag(e);
  }

  moveItemDrag(e) {
    const g = this.itemDrag.ghost;
    g.style.left = e.clientX + 'px';
    g.style.top = e.clientY + 'px';
    const v = this.pick(e, this.planningViews().filter((x) => x.own));
    for (const x of this.views.values()) x.model.mat.emissive.setRGB(0, 0, 0);
    this.itemDrag.over = v;
    if (v) v.model.mat.emissive.setRGB(0.25, 0.25, 0.1);
  }

  endItemDrag(e) {
    const { idx, ghost, over } = this.itemDrag;
    ghost.remove();
    this.itemDrag = null;
    if (over) this.send({ t: 'equip', idx, uid: over.uid });
  }

  keyDown(e) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'd') this.send({ t: 'reroll' });
    else if (k === 'f') this.send({ t: 'xp' });
    else if (k === 'w') this.toggleReady();
    else if (k === 'e' && this.hover && this.canDrag(this.hover)) { this.send({ t: 'sell', uid: this.hover.uid }); sfx.play('sell'); this.hud.hideTip(); }
    else if (k === ' ') { e.preventDefault(); this.armDynamax(); }
    else if (k === 'enter') { e.preventDefault(); $('chat-input').focus(); }
    else if (k === 'escape') { this.scout(null); this.hud.hideTip(); }
    else if (k >= '1' && k <= '5') this.send({ t: 'buy', slot: +k - 1 });
  }

  toggleReady() {
    if (this.room?.phase !== 'planning') return;
    this.send({ t: 'ready', v: !this.me?.ready });
    sfx.play('click');
  }

  scout(id) {
    if (id === this.myId) id = null;
    if (this.scoutId === id) id = null;
    this.scoutId = id;
    this.send({ t: 'scout', id });
    const b = $('scout-banner');
    if (id) {
      const p = this.room.players.find((x) => x.id === id);
      b.textContent = `👀 Viendo a ${p?.name} — clic para volver`;
      b.classList.remove('hidden');
    } else b.classList.add('hidden');
    // Al cambiar de vista durante un combate, el servidor enviará el combate correspondiente.
    if (this.room?.phase === 'combat') { this.exitCombat(true); this.mode = 'combat'; }
    else this.exitCombat();
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    this.refreshBoard();
    this.updateCompanion();
    this.hud._plKey = null;
    this.hud.render(this.room, this.me);
  }

  // ───────────────────────── Bucle ─────────────────────────
  update(dt, t) {
    this.hud.tick();
    for (const v of this.views.values()) v.update(dt, t);
    for (const [id, v] of this.cviews) {
      v.update(dt, t);
    }
    // Safari: carrusel giratorio.
    if (this.sviews.size) {
      const rot = t * 0.25;
      for (const v of this.sviews.values()) {
        const a = v.angle + rot;
        v.pos.set(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.2 + 1.0);
        v.faceYaw(Math.atan2(-v.pos.x, -v.pos.z) + Math.PI);
        v.update(dt, t);
      }
    }
    if (this.companion) this.companion.update(dt, t);
  }

  dispose() {
    this.unsub && this.unsub();
    this.stopUpdate && this.stopUpdate();
    const c = this.engine.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    c.removeEventListener('wheel', this.onWheel);
    for (const v of this.views.values()) v.dispose();
    for (const v of this.cviews.values()) v.dispose();
    this.views.clear(); this.cviews.clear();
    this.clearSafari();
    this.companion?.dispose();
    this.hud.show(false);
    document.getElementById('recap')?.remove();
    this.net.close && this.net.close();
  }
}
