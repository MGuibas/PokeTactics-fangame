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
import { CAROUSEL, AV_HOME } from '../game/room.js';
import { TrainerView, OrbView } from './trainer.js';
import { itemIcon } from './icons.js';

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
    try { if (localStorage.getItem('pt3d-walked')) $('walk-hint')?.remove(); } catch {}
    this.unsub = net.on((m) => this.onMsg(m));
    this.bindInput();
    this.stopUpdate = engine.onUpdate((dt, t) => this.update(dt, t));
    this.trainer = null; // entrenador del jugador mostrado (propio o espiado)
    this.carTrainers = new Map(); // entrenadores en el carrusel
    this.orbViews = new Map();
    this.carRot = 0;
    this.carDeco = null;
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
      case 'avs': this.onAvatars(m.a); break;
      case 'car': this.onCarousel(m); break;
      case '_close': if (!this.solo) this.hud.toast('Conexión perdida. Reconectando…'); break;
    }
  }

  onState(room, me) {
    this._stateAt = performance.now();
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
    this.updateTrainer();
    this.syncOrbs();
  }

  onMe(me) {
    const prev = this.me;
    this.me = me;
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
      this.hud.banner('¡Zona Safari!', '', 'Los entrenadores con menos vida salen primero');
      this.engine.camTarget.set(0, 0, 1.2);
      this.engine.camBase.set(0, 22, 16);
    }
    if (from === 'safari') {
      this.engine.camTarget.set(0, 0, 3.3);
      this.engine.camBase.set(0, 19, 13.5);
    }
  }

  onRound(m) {
    const w = WEATHERS[m.weather];
    const t = m.rtype === 'pvp' ? 'Combate' : m.rtype === 'safari' ? 'Zona Safari' : m.stage === 1 ? 'Pokémon salvajes' : m.stage <= 3 ? 'Gimnasio' : m.stage === 4 ? 'Alto Mando' : 'Incursión Dinamax';
    if (m.rtype !== 'safari') this.hud.banner(`Etapa ${m.stage}-${m.round}`, '', t);
    sfx.play('round');
    if (m.round === 1 && m.stage >= 2) {
      setTimeout(() => this.hud.toast(`El clima cambia: ${w.name}. ${w.desc}`, true), 1200);
      if (m.event) {
        import('../game/data/world.js').then(({ EVENTS }) => {
          const ev = EVENTS[m.event.id];
          const desc = ev.desc.replace('{type}', m.event.type ? m.event.type : '');
          setTimeout(() => this.hud.toast(`Noticias del Profesor: ${ev.name}. ${desc}`, true), 2600);
        });
      }
    }
  }

  onFx(m) {
    switch (m.kind) {
      case 'evolve': {
        sfx.play('evolve');
        this.hud.toast(m.text, true);
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
      case 'levelup': sfx.play('level'); this.hud.toast(`¡Nivel ${m.level}! Ya caben ${m.level} Pokémon en el tablero.`); break;
      case 'toast': this.hud.toast(m.text, m.big); if (m.text.includes('lleno') || m.text.includes('Máximo')) sfx.play('error'); break;
      case 'item': sfx.play('place'); break;
      case 'badge': sfx.play('badge'); this.hud.toast(`Medalla obtenida: ${BADGES[m.id].name}`, true); break;
      case 'capture': this.onCaptureResult(m); break;
      case 'eliminated': this.hud.banner('Eliminado', 'lose', `Has quedado ${m.place}º`); sfx.play('lose'); break;
      case 'orb': {
        sfx.play('coin');
        const pos = V3(m.x, 1.2, m.z);
        const names = m.items.map((it) => ITEMS[it]?.name).filter(Boolean);
        if (m.gold) names.push(`+${m.gold} oro`);
        names.forEach((n, i) => setTimeout(() => this.fx.text(pos.clone().add(V3(0, i * 0.5, 0)), n, 'txt', 1.6), i * 180));
        if (m.gold) this.fx.coins(pos, 10);
        break;
      }
    }
  }

  onEmote(m) {
    this.hud.emote(m.from, m.e);
    const viewed = this.scoutId || this.myId;
    if (m.from === viewed && this.trainer) {
      this.fx.text(this.trainer.view.topPos().add(V3(0, 0.6, 0)), m.e, 'txt big', 2);
      this.trainer.view.jump();
    }
    const ct = this.carTrainers.get(m.from);
    if (ct) { this.fx.text(ct.view.topPos().add(V3(0, 0.6, 0)), m.e, 'txt big', 2); ct.view.jump(); }
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
    const showBench = this.room.phase !== 'safari';
    const wanted = new Map();
    if (showBoard) for (const u of board) wanted.set(u.uid, { u, pos: hexToWorld(u.x, 4 + u.y), bench: false });
    if (showBench) bench.forEach((u, i) => { if (u) wanted.set(u.uid, { u, pos: benchToWorld(i), bench: true }); });
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
      } else this.hud.banner(m.kind === 'raid' ? '¡Incursión Dinamax!' : m.kind === 'gym' ? '¡Desafío!' : '¡Pokémon salvajes!', '', esc(m.title));
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
        if (t) { this.fx.coins(t.midPos(), 10); this.fx.text(t.topPos(), '+1 oro', 'coin', 1.2); sfx.play('coin'); }
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
      if (l.legend) parts.push(`¡${FORMS[l.legend].name}!`);
      if (l.orbs) parts.push(`${l.orbs} Poké Ball${l.orbs > 1 ? 's' : ''} de botín`);
      if (parts.length) sub = (sub ? sub + ' · ' : '') + parts.join(', ');
      if (l.orbs) setTimeout(() => this.hud.toast('Recoge las Poké Balls con tu entrenador (clic derecho o toca el suelo para caminar).', true), 900);
      if (l.capture) setTimeout(() => this.hud.toast(`¡Un ${FORMS[l.capture.form].name}${l.capture.shiny ? ' shiny' : ''} salvaje se ha quedado! Intenta capturarlo.`, true), 2600);
    }
    const g = m.gold?.[mySide];
    if (g) sub = (sub ? sub + ' · ' : '') + `Día de Pago: +${g} oro`;
    this.hud.banner(txt, cls, sub);
    if (target === this.myId) sfx.play(cls === 'win' ? 'win' : cls === 'lose' ? 'lose' : 'round');
    for (const v of this.cviews.values()) {
      if (v.dead) continue;
      const won = (v.enemy ? 1 - mySide : mySide) === m.winner;
      if (won) setTimeout(() => v.celebrate(), Math.random() * 300);
    }
    this.showRecap(m.stats, mySide);
    if (this.trainer) { if (cls === 'win') this.trainer.view.celebrate(); else if (cls === 'lose') this.trainer.view.hitFlash(); }
  }

  showRecap(stats, mySide) {
    document.getElementById('recap')?.remove();
    if (!stats?.length) return;
    const mine = stats.filter((s) => s.side === mySide).sort((a, b) => b.dmg - a.dmg).slice(0, 6);
    const max = Math.max(1, ...mine.map((s) => s.dmg));
    const d = document.createElement('div');
    d.id = 'recap';
    d.innerHTML = `<h4>Daño infligido</h4>` + mine.map((s) => `<div class="r"><img src="${portrait(s.form, s.shiny)}"/><div class="bar"><i style="width:${(s.dmg / max) * 100}%"></i></div><span>${s.dmg}</span></div>`).join('');
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
    this.hud.toast('Toca a uno de tus Pokémon para Dinamaxizarlo');
    clearTimeout(this._dynaT);
    this._dynaT = setTimeout(() => { if (this.dynaArmed) { this.send({ t: 'dynamax', uid: null }); this.dynaArmed = false; } }, 5000);
    this.hud.renderMe(this.me);
  }

  // ───────────────────────── Captura ─────────────────────────
  openCapture() {
    const c = this.me?.capture;
    if (!c) return;
    const box = this.hud.modal(`<h2>¡${esc(FORMS[c.form].name)}${c.shiny ? ' shiny' : ''} salvaje!</h2>
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
    if (!ball || !msg) { this.hud.toast(m.ok ? `¡Has capturado a ${FORMS[m.form].name}!` : `${FORMS[m.form].name} escapó…`, true); return; }
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
        msg.textContent = `¡${FORMS[m.form].name} atrapado!`;
        sfx.play('caught');
        setTimeout(() => this.hud.closeModal(), 1600);
      } else {
        msg.textContent = `¡Oh, no! ¡${FORMS[m.form].name} escapó!`;
        sfx.play('escape');
        ball.style.display = 'none';
        const img = area.querySelector('img');
        img.style.transform = 'scale(1)'; img.style.opacity = '1';
        setTimeout(() => this.hud.closeModal(), 1600);
      }
    };
    setTimeout(shake, 300);
  }

  // ───────────────────────── Zona Safari (carrusel) ─────────────────────────
  carouselOptPos(o) {
    const a = o.a + this.carRot;
    return V3(CAROUSEL.cx + Math.cos(a) * CAROUSEL.r, 0, CAROUSEL.cz + Math.sin(a) * CAROUSEL.r);
  }

  renderSafari() {
    const s = this.room.safari;
    if (!s) return;
    if (this.carRot === 0 || Math.abs(this.carRot - s.rot) > 0.3) this.carRot = s.rot;
    this.buildCarouselDeco();
    if (this.trainer) { this.trainer.dispose(); this.trainer = null; }
    for (const [id, v] of this.orbViews) { v.dispose(false); this.orbViews.delete(id); }
    // Pokémon del carrusel.
    for (const o of s.options) {
      let v = this.sviews.get(o.id);
      if (!v) {
        v = new UnitView(this.ctx, { id: o.id, form: o.form, line: o.line, star: 1, shiny: o.shiny, items: [o.item], bench: true });
        v.safari = o;
        v.place(this.carouselOptPos(o));
        this.sviews.set(o.id, v);
      }
      v.safari = o;
      if (o.takenBy && !v.heldBy) {
        v.heldBy = o.takenBy;
        const tr = this.carTrainers.get(o.takenBy);
        if (tr) tr.held = v;
      }
    }
    // Entrenadores de todos los jugadores.
    for (const pid of s.order) {
      if (this.carTrainers.has(pid)) continue;
      const p = this.room.players.find((x) => x.id === pid);
      if (!p) continue;
      const i = s.order.indexOf(pid);
      const ang = Math.PI / 2 + (i / s.order.length) * Math.PI * 2;
      const x = CAROUSEL.cx + Math.cos(ang) * CAROUSEL.pen, z = CAROUSEL.cz + Math.sin(ang) * CAROUSEL.pen;
      const tr = new TrainerView(this.ctx, { pid, form: p.avatar, name: p.name, me: pid === this.myId, x, z });
      tr.view.faceTo(V3(CAROUSEL.cx, 0, CAROUSEL.cz));
      this.carTrainers.set(pid, tr);
    }
    this.renderSafariUi();
  }

  renderSafariUi() {
    const s = this.room?.safari;
    if (!s) return;
    let ui = document.getElementById('safari-ui');
    if (!ui) { ui = document.createElement('div'); ui.id = 'safari-ui'; document.body.appendChild(ui); this._safariAt = performance.now(); }
    const relMs = (s.rel?.[this.myId] ?? 0) - (performance.now() - (this._stateAt || performance.now()));
    const mine = s.options.find((o) => o.takenBy === this.myId);
    let title;
    if (mine) title = `¡Tienes a ${FORMS[mine.form].name}!`;
    else if (relMs > 150) title = `Sales en ${Math.ceil(relMs / 1000)} s`;
    else title = '¡Corre! Toca un Pokémon para agarrarlo';
    const waves = {};
    for (const pid of s.order) (waves[s.wave?.[pid] ?? 0] ||= []).push(pid);
    const key = title + JSON.stringify(s.options.map((o) => o.takenBy));
    if (ui._key === key) return;
    ui._key = key;
    ui.innerHTML = `<h3>${title}</h3><div class="order">${Object.values(waves).map((g) => `<div class="wave">${g.map((pid) => {
      const p = this.room.players.find((x) => x.id === pid);
      const got = s.options.find((o) => o.takenBy === pid);
      return `<span class="${pid === this.myId ? 'me' : ''} ${got ? 'done' : ''}" title="${esc(p?.name || '')}"><img src="${portrait(p?.avatar || 'pikachu')}"/></span>`;
    }).join('')}</div>`).join('')}</div>`;
  }

  buildCarouselDeco() {
    if (this.carDeco) return;
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.55, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(CAROUSEL.r - 0.35, CAROUSEL.r + 0.35, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(CAROUSEL.cx, 0.16, CAROUSEL.cz);
    g.add(ring);
    const pen = new THREE.Mesh(new THREE.RingGeometry(CAROUSEL.pen - 0.9, CAROUSEL.pen + 0.9, 64), new THREE.MeshBasicMaterial({ color: 0x3d7dca, transparent: true, opacity: 0.18, depthWrite: false }));
    pen.rotation.x = -Math.PI / 2;
    pen.position.set(CAROUSEL.cx, 0.05, CAROUSEL.cz);
    g.add(pen);
    this.engine.scene.add(g);
    this.carDeco = g;
  }

  onCarousel(m) {
    if (this.room?.phase !== 'safari') return;
    this.carRot = m.rot;
    for (const [pid, x, z, hold, tx, tz] of m.a) {
      const tr = this.carTrainers.get(pid);
      if (!tr) continue;
      const mine = pid === this.myId;
      tr.setServer(x, z, tx, tz, mine && this.carWalking);
      if (!mine || !this.carWalking) tr.walkTo(tx, tz);
      if (hold && !tr.held) {
        const v = this.sviews.get(hold);
        if (v) { tr.held = v; v.heldBy = pid; }
      }
    }
    this.renderSafariUi();
  }

  onSafariPick(m) {
    const p = this.room?.players.find((x) => x.id === m.pid);
    const v = this.sviews.get(m.opt);
    const tr = this.carTrainers.get(m.pid);
    if (v && tr) { tr.held = v; v.heldBy = m.pid; }
    if (v && p) {
      this.fx.burst(v.midPos(), 0xffffff, 14, 3, 0.35, 0.4);
      this.fx.text(v.topPos().add(V3(0, 0.5, 0)), p.name, 'txt', 1.4);
      if (m.pid === this.myId) { sfx.play('buy'); this.carWalking = false; }
    }
  }

  clearSafari() {
    for (const v of this.sviews.values()) v.dispose();
    this.sviews.clear();
    for (const t of this.carTrainers.values()) t.dispose();
    this.carTrainers.clear();
    if (this.carDeco) { this.engine.scene.remove(this.carDeco); this.carDeco = null; }
    document.getElementById('safari-ui')?.remove();
    this.carWalking = false;
    this.updateTrainer();
  }

  // ───────────────────────── Entrenador y botín ─────────────────────────
  updateTrainer() {
    if (!this.room || this.room.phase === 'safari') return;
    const p = this.scoutId ? this.viewedPlayer() : this.room.players.find((x) => x.id === this.myId);
    if (!p) return;
    if (!this.trainer || this.trainer.form !== p.avatar || this.trainer.pid !== p.id) {
      this.trainer?.dispose();
      const [x, z] = p.av || [AV_HOME.x, AV_HOME.z];
      this.trainer = new TrainerView(this.ctx, { pid: p.id, form: p.avatar, name: p.name, me: p.id === this.myId, x, z });
      this.trainer.showLabel = false;
      this.trainer.view.yaw = this.trainer.view.targetYaw = 2.2;
      if (p.av) this.trainer.walkTo(p.av[2], p.av[3]);
    }
  }

  onAvatars(list) {
    if (!this.trainer || this.room?.phase === 'safari') return;
    for (const [pid, x, z, tx, tz] of list) {
      if (pid !== this.trainer.pid) continue;
      const mine = pid === this.myId;
      this.trainer.setServer(x, z, tx, tz, mine && this.walkingLocal);
      if (!mine || !this.walkingLocal) this.trainer.walkTo(tx, tz);
      if (mine && Math.hypot(tx - this.trainer.target.x, tz - this.trainer.target.z) < 0.05) this.walkingLocal = false;
    }
  }

  syncOrbs() {
    if (!this.room || this.room.phase === 'safari') return;
    const p = this.scoutId ? this.viewedPlayer() : this.room.players.find((x) => x.id === this.myId);
    const list = p?.orbs || [];
    const ids = new Set(list.map((o) => o.id));
    for (const [id, v] of this.orbViews) if (!ids.has(id)) { v.dispose(true); this.orbViews.delete(id); }
    for (const o of list) if (!this.orbViews.has(o.id)) this.orbViews.set(o.id, new OrbView(this.ctx, o));
  }

  // Ordena caminar al entrenador (clic derecho o toque en el suelo).
  walkTo(e) {
    if (!this.me?.alive || this.scoutId) return false;
    const p = this.engine.pickPlane(this.ndc(e).x, this.ndc(e).y, 0);
    if (!p) return false;
    if (this.room?.phase === 'safari') {
      const tr = this.carTrainers.get(this.myId);
      const s = this.room.safari;
      if (!tr || s.options.some((o) => o.takenBy === this.myId)) return false;
      this.send({ t: 'walk', x: p.x, z: p.z });
      const dx = p.x - CAROUSEL.cx, dz = p.z - CAROUSEL.cz, d = Math.hypot(dx, dz), R = CAROUSEL.pen + 0.6;
      if (d > R) { p.x = CAROUSEL.cx + (dx / d) * R; p.z = CAROUSEL.cz + (dz / d) * R; }
      tr.walkTo(p.x, p.z);
      this.carWalking = true;
    } else {
      if (!this.trainer) return false;
      const d = Math.hypot(p.x, p.z);
      if (d > 13.2) { p.x *= 13.2 / d; p.z *= 13.2 / d; }
      this.send({ t: 'walk', x: p.x, z: p.z });
      this.trainer.walkTo(p.x, p.z);
      this.walkingLocal = true;
    }
    this.fx.ring(V3(p.x, 0, p.z), 0.9, 0x9be86a, 0.4, 0.2);
    $('walk-hint')?.remove();
    try { localStorage.setItem('pt3d-walked', '1'); } catch {}
    return true;
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
    if (e.button === 2) { this.walkTo(e); return; }
    // Safari: perseguir un Pokémon o caminar.
    if (this.room?.phase === 'safari') {
      const v = this.pick(e, [...this.sviews.values()].filter((x) => !x.heldBy));
      const tr = this.carTrainers.get(this.myId);
      if (v && tr) {
        this.send({ t: 'safari', id: v.safari.id });
        tr.walkTo(v.pos.x, v.pos.z);
        this.carChase = v;
        this.carWalking = true;
        this.fx.ring(v.pos, 1.1, 0xffe07a, 0.4, 0.2);
      } else { this.carChase = null; this.walkTo(e); }
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
      return;
    }
    // Clic en el suelo vacío: el entrenador camina hasta allí.
    if (!v && e.pointerType !== 'mouse') this.walkTo(e);
    else if (!v) this.pendingWalk = { x: e.clientX, y: e.clientY, e };
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
          $('sell-val').textContent = `+${Math.max(1, cost * copies - (unit.star > 1 && cost > 1 ? 1 : 0))} de oro`;
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
    if (v) {
      const data = v.safari ? { form: v.form, star: 1, shiny: v.shiny, items: v.items } : v.unit ? { ...v.unit } : { form: v.form, star: v.star, shiny: v.shiny, items: v.items, hp: v.hp, maxHp: v.maxHp, mana: v.mana, fr: v.fr };
      if (!data.line) data.line = FORMS[data.form].line;
      this.hud.showFormTip(data, e.clientX, e.clientY);
      this.engine.canvas.style.cursor = this.canDrag(v) || v.safari ? 'grab' : 'help';
    } else {
      this.hud.hideTip();
      this.engine.canvas.style.cursor = this.dynaArmed ? 'crosshair' : 'pointer';
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
    if (this.pendingWalk) {
      const pw = this.pendingWalk;
      this.pendingWalk = null;
      if (Math.hypot(e.clientX - pw.x, e.clientY - pw.y) < 8 && e.target === this.engine.canvas) this.walkTo(e);
    }
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
    ghost.className = 'drag-ghost';
    ghost.innerHTML = itemIcon(d);
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
      b.textContent = `Viendo a ${p?.name} · clic para volver`;
      b.classList.remove('hidden');
    } else b.classList.add('hidden');
    // Al cambiar de vista durante un combate, el servidor enviará el combate correspondiente.
    if (this.room?.phase === 'combat') { this.exitCombat(true); this.mode = 'combat'; }
    else this.exitCombat();
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    this.refreshBoard();
    this.trainer?.dispose();
    this.trainer = null;
    this.updateTrainer();
    for (const v of this.orbViews.values()) v.dispose(false);
    this.orbViews.clear();
    this.syncOrbs();
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
    // Carrusel: los Pokémon libres giran; los agarrados siguen a su entrenador.
    if (this.sviews.size) {
      this.carRot += CAROUSEL.rot * dt;
      for (const v of this.sviews.values()) {
        if (!v.heldBy) {
          v.pos.copy(this.carouselOptPos(v.safari));
          v.faceYaw(this.carRot + v.safari.a + Math.PI / 2 + Math.PI);
        }
        v.update(dt, t);
      }
      // Persecución local del Pokémon elegido.
      const tr = this.carTrainers.get(this.myId);
      if (tr && this.carChase && !this.carChase.heldBy) tr.walkTo(this.carChase.pos.x, this.carChase.pos.z);
      for (const tr2 of this.carTrainers.values()) tr2.update(dt, t);
      if (!this._uiT || t - this._uiT > 0.25) { this._uiT = t; this.renderSafariUi(); }
    }
    if (this.trainer) this.trainer.update(dt, t);
    for (const o of this.orbViews.values()) o.update(dt, t);
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
    this.trainer?.dispose();
    for (const o of this.orbViews.values()) o.dispose(false);
    this.hud.show(false);
    document.getElementById('recap')?.remove();
    this.net.close && this.net.close();
  }
}
