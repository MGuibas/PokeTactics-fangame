// HUD de la partida: tienda, sinergias, jugadores, objetos, tooltips y modales.
import { LINES, FORMS, formFor, moveDesc, moveOf, baseStats, LINE_LIST } from '../game/data/pokemon.js';
import { TYPES, ROLES, TRAITS, traitInfo, typeMatchups } from '../game/data/types.js';
import { ITEMS, statText, combine, COMPONENTS } from '../game/data/items.js';
import { WEATHERS, BADGES, EVENTS, roundType, roundsInStage, PHASE_TIME } from '../game/data/world.js';
import { traitLevel } from '../game/traits.js';
import { portrait } from './portraits.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const COST_COLOR = { 1: '#9aa7b8', 2: '#3fbf6a', 3: '#3c8ee8', 4: '#b25ce8', 5: '#f5b52a' };
const COST_BG = { 1: ['#5a6478', '#39404f'], 2: ['#3a8a58', '#234a36'], 3: ['#3a6aa8', '#22385e'], 4: ['#7a4aa8', '#3e2660'], 5: ['#b88a2a', '#5e4210'] };
const RT_ICON = { pvp: '⚔️', pve: '🌿', safari: '🦁' };
export const EMOTES = ['👍', '😂', '😡', '😭', '😎', '❤️', 'GG', '⚡'];

function chip(id) {
  const t = traitInfo(id);
  if (!t) return '';
  return `<span class="chip" style="--cc:${t.color}">${t.icon} ${t.name}</span>`;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    this.tip = $('tooltip');
    this.timer = { left: 0, total: 1 };
    this.lastPhase = '';
    this.bind();
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  bind() {
    const g = this.game;
    $('btn-reroll').onclick = () => { g.send({ t: 'reroll' }); };
    $('btn-xp').onclick = () => { g.send({ t: 'xp' }); };
    $('btn-lock').onclick = () => { g.send({ t: 'lock' }); sfx.play('click'); };
    $('btn-ready').onclick = () => g.toggleReady();
    $('btn-auto').onclick = () => { g.send({ t: 'autoplace' }); sfx.play('place'); };
    $('btn-sound').onclick = () => {
      const on = sfx.toggle();
      $('btn-sound').firstChild.textContent = on ? '🔊' : '🔇';
    };
    $('btn-sound').firstChild.textContent = sfx.enabled ? '🔊' : '🔇';
    $('btn-sound').oncontextmenu = (e) => { e.preventDefault(); sfx.toggleMusic(); this.toast(sfx.musicOn ? '🎵 Música activada' : '🎵 Música desactivada'); };
    $('btn-dex').onclick = () => this.showDex();
    $('btn-emote').onclick = () => $('emote-wheel').classList.toggle('hidden');
    $('emote-wheel').innerHTML = EMOTES.map((e) => `<button data-e="${e}">${e}</button>`).join('');
    $('emote-wheel').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      g.send({ t: 'emote', e: b.dataset.e });
      $('emote-wheel').classList.add('hidden');
    };
    $('btn-dyna').onclick = () => g.armDynamax();
    const ci = $('chat-input');
    ci.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = ci.value.trim();
        if (v) g.send({ t: 'chat', text: v });
        ci.value = '';
        ci.blur();
      } else if (e.key === 'Escape') ci.blur();
    };
    $('shop-cards').addEventListener('click', (e) => {
      const c = e.target.closest('.card');
      if (!c || c.classList.contains('empty')) return;
      g.send({ t: 'buy', slot: +c.dataset.slot });
    });
    $('shop-cards').addEventListener('pointermove', (e) => {
      const c = e.target.closest('.card');
      if (!c || c.classList.contains('empty')) { this.hideTip(); return; }
      const s = g.me?.shop?.[+c.dataset.slot];
      if (s) this.showFormTip({ line: s.line, form: formFor(s.line, 1), star: 1, shiny: s.shiny, items: [] }, e.clientX, e.clientY, true);
    });
    $('shop-cards').addEventListener('pointerleave', () => this.hideTip());
    // Objetos: arrastrar hacia un Pokémon.
    $('items').addEventListener('pointerdown', (e) => {
      const it = e.target.closest('.item');
      if (!it) return;
      e.preventDefault();
      g.startItemDrag(+it.dataset.idx, e);
    });
    $('items').addEventListener('pointermove', (e) => {
      const it = e.target.closest('.item');
      if (!it || g.itemDrag) return;
      this.showItemTip(g.me.items[+it.dataset.idx], e.clientX, e.clientY);
    });
    $('items').addEventListener('pointerleave', () => this.hideTip());
    $('traits').addEventListener('pointermove', (e) => {
      const t = e.target.closest('.trait');
      if (!t) { this.hideTip(); return; }
      this.showTraitTip(t.dataset.id, +t.dataset.n, e.clientX, e.clientY);
    });
    $('traits').addEventListener('pointerleave', () => this.hideTip());
    $('players').addEventListener('click', (e) => {
      const p = e.target.closest('.pl');
      if (p) g.scout(p.dataset.id);
    });
    $('scout-banner').onclick = () => g.scout(null);
    $('weather-card').onpointermove = (e) => this.showWeatherTip(e.clientX, e.clientY);
    $('weather-card').onpointerleave = () => this.hideTip();
    $('event-card').onpointermove = (e) => this.showEventTip(e.clientX, e.clientY);
    $('event-card').onpointerleave = () => this.hideTip();
  }

  // ───────────── Render general ─────────────
  render(room, me) {
    if (!room || !me) return;
    this.renderTop(room);
    this.renderPlayers(room, me);
    this.renderMe(me, room);
  }

  renderMe(me, room = this.game.room) {
    if (!me) return;
    this.renderShop(me);
    this.renderTraits(me.traits || {});
    this.renderItems(me.items || []);
    $('gold-val').textContent = me.gold;
    $('level-label').textContent = `Nv. ${me.level}  ·  ${me.board.length}/${me.maxBoard}`;
    const pct = me.xpNeed ? (me.xp / me.xpNeed) * 100 : 100;
    $('xp-fill').style.width = pct + '%';
    $('xp-text').textContent = me.xpNeed ? `${me.xp}/${me.xpNeed}` : 'MÁX';
    $('reroll-cost').textContent = me.rerollCost + '💰';
    $('btn-xp').disabled = me.gold < 4 || !me.xpNeed;
    $('btn-reroll').disabled = me.gold < me.rerollCost;
    $('btn-lock').classList.toggle('on', !!me.locked);
    $('btn-lock').textContent = me.locked ? '🔒' : '🔓';
    const s = me.streak;
    $('streak').textContent = s >= 2 ? `🔥 Racha ${s}` : s <= -2 ? `🧊 Racha ${-s}` : '';
    $('btn-ready').classList.toggle('on', !!me.ready);
    $('dex-count').textContent = me.dex;
    // Botones de captura / medalla.
    const cap = $('capture-btn');
    if (me.capture && room?.phase === 'planning') {
      cap.classList.remove('hidden');
      if (cap.dataset.form !== me.capture.form) {
        cap.dataset.form = me.capture.form;
        cap.innerHTML = `<button class="btn primary">🎯 ¡Un ${esc(FORMS[me.capture.form].name)}${me.capture.shiny ? ' ✨' : ''} salvaje! Lanzar Poké Ball</button>`;
        cap.firstChild.onclick = () => this.game.openCapture();
      }
    } else { cap.classList.add('hidden'); cap.dataset.form = ''; }
    if (this.game.badgeOpen && !me.pendingBadge) this.closeModal();
    const bb = $('badge-btn');
    if (me.pendingBadge && !this.game.badgeOpen) {
      bb.classList.remove('hidden');
      if (!bb.firstChild) {
        bb.innerHTML = '<button class="btn secondary">🏅 ¡Elige tu medalla!</button>';
        bb.firstChild.onclick = () => this.showBadges(me.pendingBadge);
      }
    } else { bb.classList.add('hidden'); bb.innerHTML = ''; }
    this.renderDyna(me, room);
  }

  renderDyna(me, room) {
    const wrap = $('dyna-wrap');
    const inFight = room?.phase === 'combat' && me.fightId && !this.game.scoutId;
    if (!inFight || me.dyna <= 0 && !this.game.dynaUsed) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    const ready = me.dyna >= me.dynaNeed;
    const b = $('btn-dyna');
    b.disabled = !ready;
    b.classList.toggle('armed', !!this.game.dynaArmed);
    $('dyna-sub').textContent = this.game.dynaArmed ? '¡Toca uno de tus Pokémon!' : ready ? 'Pulsa y elige un Pokémon (Espacio)' : `Carga ${Math.floor(me.dyna)}/${me.dynaNeed}`;
  }

  renderTop(room) {
    const rt = room.rtype;
    const isGym = rt === 'pve' && room.stage >= 2;
    const title = rt === 'pvp' ? 'Combate' : rt === 'safari' ? 'Zona Safari' : room.stage === 1 ? 'Pokémon salvajes' : room.stage <= 3 ? 'Gimnasio' : room.stage === 4 ? 'Alto Mando' : 'Incursión Dinamax';
    const phaseTxt = { planning: 'Prepárate', results: 'Resultados', ended: 'Fin' }[room.phase];
    $('stage-label').innerHTML = `Etapa ${room.stage}-${room.round} <small>${title}${phaseTxt ? ' · ' + phaseTxt : ''}</small>`;
    const n = roundsInStage(room.stage);
    let track = '';
    for (let r = 1; r <= n; r++) {
      const t = roundType(room.stage, r);
      const ic = t === 'pve' && room.stage >= 2 ? (room.stage >= 5 ? '🔴' : '🏟️') : RT_ICON[t];
      track += `<span class="${r === room.round ? 'cur' : r < room.round ? 'done' : ''}">${ic}</span>`;
    }
    $('round-track').innerHTML = track;
    const w = WEATHERS[room.weather];
    const f = WEATHERS[room.forecast];
    $('weather-card').innerHTML = `<span class="ic">${w.icon}</span><div><div class="t">${w.name}</div><div class="s">Próximo: ${f.icon} ${f.name}</div></div>`;
    const ev = room.event ? EVENTS[room.event.id] : null;
    $('event-card').classList.toggle('hidden', !ev);
    if (ev) {
      const extra = room.event.type ? ` ${TYPES[room.event.type].icon}` : '';
      $('event-card').innerHTML = `<span class="ic">${ev.icon}</span><div><div class="t">${ev.name}${extra}</div><div class="s">Noticias del Profesor</div></div>`;
    }
    const total = room.phase === 'planning' ? (room.stage === 1 ? PHASE_TIME.planningShort : PHASE_TIME.planning)
      : room.phase === 'combat' ? PHASE_TIME.combatMax : room.phase === 'safari' ? PHASE_TIME.safariPick : PHASE_TIME.results;
    this.timer = { left: room.timeLeft, total, at: performance.now() };
    if (room.phase !== this.lastPhase) {
      this.lastPhase = room.phase;
    }
  }

  tick() {
    const tm = this.timer;
    const left = Math.max(0, tm.left - (performance.now() - (tm.at || 0)));
    const k = Math.min(1, left / tm.total);
    const fill = $('timer-fill');
    fill.style.width = k * 100 + '%';
    fill.classList.toggle('warn', left < 5000);
  }

  renderShop(me) {
    const key = JSON.stringify(me.shop) + me.gold + '|' + me.board.map((u) => u.line + u.star).join() + me.bench.map((u) => u ? u.line + u.star : '').join();
    if (this._shopKey === key) return;
    this._shopKey = key;
    const owned = {};
    for (const u of [...me.board, ...me.bench.filter(Boolean)]) {
      if (u.star === 1) owned[u.line] = (owned[u.line] || 0) + 1;
    }
    $('shop-cards').innerHTML = me.shop.map((s, i) => {
      if (!s) return `<div class="card empty" data-slot="${i}"></div>`;
      const l = LINES[s.line];
      const f = FORMS[formFor(s.line, 1)];
      const cant = me.gold < l.cost;
      const n = owned[s.line] || 0;
      const dots = n ? `<div class="own">${[0, 1].map((k) => `<b class="${k < n ? 'on' : ''}"></b>`).join('')}</div>` : '';
      const [b1, b2] = COST_BG[l.cost];
      return `<div class="card ${cant ? 'cant' : ''} ${n >= 2 ? 'hot' : ''} ${s.shiny ? 'shiny' : ''}" data-slot="${i}" style="--cc:${COST_COLOR[l.cost]};--bg1:${b1};--bg2:${b2}">
        <div class="por"><img src="${portrait(f.id, s.shiny)}" alt=""/>
          <div class="types">${[...f.types, f.role].map((t) => `<i style="background:${traitInfo(t).color}cc">${traitInfo(t).icon} ${traitInfo(t).name}</i>`).join('')}</div>
          ${s.shiny ? '<span class="shinytag">✨</span>' : ''}${dots}
        </div>
        <div class="bottom"><span>${esc(f.name)}</span><span class="cost"><span class="coin" style="width:13px;height:13px;border-width:1px"></span>${l.cost}</span></div>
      </div>`;
    }).join('');
  }

  renderTraits(counts) {
    const key = JSON.stringify(counts);
    if (this._traitsKey === key) return;
    this._traitsKey = key;
    const list = Object.entries(counts).filter(([id]) => TRAITS[id]).map(([id, n]) => ({ id, n, lv: traitLevel(id, n) }));
    list.sort((a, b) => b.lv - a.lv || b.n - a.n);
    $('traits').innerHTML = list.map(({ id, n, lv }) => {
      const t = traitInfo(id);
      const th = TRAITS[id].th.map((x, i) => (i < lv ? `<b>${x}</b>` : x)).join(' › ');
      const maxLv = TRAITS[id].th.length;
      return `<div class="trait ${lv ? 'on' : ''} ${lv >= 2 ? 'lv2' : ''} ${lv >= maxLv && maxLv > 1 ? 'lv3' : ''}" data-id="${id}" data-n="${n}" style="--tc:${t.color}">
        <div class="hex">${t.icon}</div><span class="cnt">${n}</span><div><div>${t.name}</div><div class="th">${th}</div></div></div>`;
    }).join('');
  }

  renderItems(items) {
    const key = items.join(',');
    if (this._itemsKey === key) return;
    this._itemsKey = key;
    $('items').innerHTML = items.map((id, i) => {
      const d = ITEMS[id];
      return `<div class="item ${d.component || d.consumable ? '' : 'full'}" data-idx="${i}" style="--ic:${d.color};--ic2:${d.color2 || d.color}">${d.icon}</div>`;
    }).join('') || '<span class="muted" style="font-size:11px;grid-column:1/-1;padding:4px">Sin objetos</span>';
  }

  renderPlayers(room, me) {
    const opp = this.game.currentOpponent();
    const sorted = [...room.players].sort((a, b) => (b.alive - a.alive) || b.hp - a.hp || a.place - b.place);
    const key = JSON.stringify(sorted.map((p) => [p.id, p.hp, p.level, p.alive, p.connected, p.ready])) + opp + this.game.scoutId;
    if (this._plKey === key) return;
    this._plKey = key;
    const el = $('players');
    const emotes = {};
    for (const e of el.querySelectorAll('.emote')) emotes[e.parentElement.dataset.id] = e;
    el.innerHTML = sorted.map((p) => {
      const av = portrait(p.avatar === 'pikachu' ? 'pikachu' : p.avatar, false);
      const hp = Math.max(0, p.hp);
      return `<div class="pl ${p.id === me.id ? 'me' : ''} ${p.alive ? '' : 'dead'} ${this.game.scoutId === p.id ? 'scouted' : ''}" data-id="${p.id}" title="Ver tablero de ${esc(p.name)}">
        ${p.id === opp ? '<span class="vs">⚔️</span>' : ''}
        <div class="av"><img src="${av}" alt=""/></div>
        <div class="info"><div class="nm">${p.isBot ? '🤖 ' : ''}${!p.connected && !p.isBot ? '📴 ' : ''}${esc(p.name)}</div>
          <div class="hpbar"><i style="width:${hp}%"></i></div><div class="lvl">Nv. ${p.level}${p.alive ? '' : ` · ${p.place}º`}${p.ready && room.phase === 'planning' ? ' · ✅' : ''}</div></div>
        <div class="hpv">${hp}</div>
      </div>`;
    }).join('');
  }

  emote(pid, e) {
    const row = document.querySelector(`.pl[data-id="${CSS.escape(pid)}"]`);
    if (!row) return;
    row.querySelector('.emote')?.remove();
    const s = document.createElement('span');
    s.className = 'emote';
    s.textContent = e;
    row.appendChild(s);
    setTimeout(() => s.remove(), 2500);
  }

  chat(name, text) {
    const d = document.createElement('div');
    d.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    $('chat-log').appendChild(d);
    while ($('chat-log').children.length > 8) $('chat-log').firstChild.remove();
  }

  // ───────────── Tooltips ─────────────
  place(x, y) {
    const t = this.tip;
    t.classList.remove('hidden');
    const r = t.getBoundingClientRect();
    let px = x + 18, py = y + 12;
    if (px + r.width > innerWidth - 8) px = x - r.width - 18;
    if (py + r.height > innerHeight - 8) py = innerHeight - r.height - 8;
    t.style.left = Math.max(8, px) + 'px';
    t.style.top = Math.max(8, py) + 'px';
  }

  hideTip() { this.tip.classList.add('hidden'); this.tipKey = null; }

  showFormTip(u, x, y, shop = false) {
    const key = JSON.stringify([u.form, u.star, u.items, u.shiny, u.fr, u.hp | 0, u.mana | 0]);
    if (this.tipKey !== key) {
      this.tipKey = key;
      const f = FORMS[u.form];
      const l = LINES[f.line];
      const st = baseStats(f.line, f.id, u.star);
      const m = moveOf(f, u.star);
      const types = f.types.map((t) => {
        const mu = typeMatchups(t);
        return `${chip(t)}`;
      }).join('');
      const strong = f.types.flatMap((t) => typeMatchups(t).strong);
      const next = l.forms[u.star] && l.forms[u.star] !== f.id && u.star < 3 ? FORMS[l.forms[u.star]]?.name : null;
      const evoTxt = f.line === 'eevee' && u.star === 1 ? 'Evoluciona según tu tipo dominante' : next ? `Evoluciona a ${next}` : u.star < 3 ? 'Sube de estrellas' : '';
      const items = (u.items || []).map((it) => `<div class="sub">${ITEMS[it].icon} <b>${ITEMS[it].name}</b>: ${ITEMS[it].desc}</div>`).join('');
      this.tip.innerHTML = `
        <h4>${u.shiny ? '✨' : ''}${esc(f.name)} <span style="color:${COST_COLOR[l.cost]}">${'★'.repeat(u.star)}</span> <span class="sub">· ${l.cost}💰</span></h4>
        <div class="row">${types}${chip(f.role)}</div>
        ${strong.length ? `<div class="sub">Súper eficaz contra: ${[...new Set(strong)].map((t) => TYPES[t].icon).join(' ')}</div>` : ''}
        <div class="stats">
          <span>❤️ ${u.maxHp ? `${u.hp | 0}/${u.maxHp}` : st.hp}</span><span>⚔️ ${st.atk}</span><span>⚡ ${st.as}</span>
          <span>🛡️ ${st.def}</span><span>💠 ${st.mdef}</span><span>🎯 ${st.range}</span>
          <span>💧 ${st.mana0}/${st.mana}</span>${u.fr ? `<span>💞 ${Math.min(5, u.fr)}/5</span>` : ''}${u.shiny ? '<span>✨ +15%</span>' : ''}
        </div>
        <div class="move"><b>${esc(m.name)}</b> ${TYPES[m.type] ? TYPES[m.type].icon : ''}<br>${moveDesc(f, u.star)}</div>
        ${f.passive === 'disfraz' ? '<div class="sub">🎭 Disfraz: bloquea el primer golpe recibido.</div>' : ''}
        ${items}
        ${evoTxt ? `<div class="sub" style="margin-top:4px">✨ ${evoTxt}${shop ? ' (3 copias)' : ''}</div>` : ''}`;
    }
    this.place(x, y);
  }

  showItemTip(id, x, y) {
    const d = ITEMS[id];
    if (!d) return;
    const key = 'i' + id;
    if (this.tipKey !== key) {
      this.tipKey = key;
      let recipes = '';
      if (d.component) {
        recipes = '<div class="sub" style="margin-top:6px">Combina con:</div>' + COMPONENTS.map((c) => {
          const r = ITEMS[combine(id, c)];
          return `<div class="sub">${ITEMS[c].icon} → ${r.icon} ${r.name}</div>`;
        }).join('');
      }
      this.tip.innerHTML = `<h4>${d.icon} ${esc(d.name)}</h4>
        ${d.stats ? `<div class="sub">${statText(d.stats)}</div>` : ''}
        <div style="margin-top:4px">${d.desc}</div>
        ${d.from ? `<div class="sub" style="margin-top:4px">Receta: ${ITEMS[d.from[0]].icon} + ${ITEMS[d.from[1]].icon}</div>` : ''}${recipes}
        <div class="sub" style="margin-top:6px">Arrástralo sobre un Pokémon para equiparlo.</div>`;
    }
    this.place(x, y);
  }

  showTraitTip(id, n, x, y) {
    const key = 't' + id + n;
    if (this.tipKey !== key) {
      this.tipKey = key;
      const t = traitInfo(id);
      const tr = TRAITS[id];
      const lv = traitLevel(id, n);
      const lines = LINE_LIST.filter((l) => l.types.includes(id) || l.role === id);
      const mine = new Set([...this.game.me.board, ...this.game.me.bench.filter(Boolean)].map((u) => u.line));
      const onBoard = new Set(this.game.me.board.map((u) => u.line));
      this.tip.innerHTML = `<h4>${t.icon} ${t.name} <span class="sub">(${n})</span></h4>
        <div>${tr.desc}</div>
        ${tr.th.map((x, i) => `<div class="lv ${i < lv ? 'on' : ''}">(${x}) ${tr.lv[i]}</div>`).join('')}
        <div class="row" style="margin-top:6px">${lines.map((l) => `<img src="${portrait(l.forms[0], false)}" title="${FORMS[l.forms[0]].name}" style="width:34px;height:34px;border-radius:8px;background:${onBoard.has(l.id) ? '#4fd36b55' : mine.has(l.id) ? '#ffffff22' : '#00000044'};border:2px solid ${COST_COLOR[l.cost]}"/>`).join('')}</div>`;
    }
    this.place(x, y);
  }

  showWeatherTip(x, y) {
    const r = this.game.room;
    if (!r) return;
    const w = WEATHERS[r.weather], f = WEATHERS[r.forecast];
    this.tipKey = 'w';
    this.tip.innerHTML = `<h4>${w.icon} ${w.name}</h4><div>${w.desc}</div><div class="sub" style="margin-top:8px">Pronóstico para la próxima etapa:</div><div><b>${f.icon} ${f.name}</b>: ${f.desc}</div>`;
    this.place(x, y);
  }

  showEventTip(x, y) {
    const r = this.game.room;
    if (!r?.event) return;
    const ev = EVENTS[r.event.id];
    this.tipKey = 'e';
    this.tip.innerHTML = `<h4>${ev.icon} ${ev.name}</h4><div>${ev.desc.replace('{type}', r.event.type ? TYPES[r.event.type].name : '')}</div>`;
    this.place(x, y);
  }

  // ───────────── Mensajes ─────────────
  banner(text, cls = '', sub = '') {
    const b = $('banner');
    b.className = cls;
    b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.add('hidden'), 2300);
  }

  toast(text, big = false) {
    const d = document.createElement('div');
    d.className = 'toast' + (big ? ' big' : '');
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 3500);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  modal(html, closable = true) {
    const m = $('modal');
    m.innerHTML = `<div class="modal-box">${html}</div>`;
    m.classList.remove('hidden');
    m.onclick = closable ? (e) => { if (e.target === m) this.closeModal(); } : null;
    return m.firstChild;
  }

  closeModal() {
    $('modal').classList.add('hidden');
    $('modal').innerHTML = '';
    this.game.badgeOpen = false;
    this.renderMe(this.game.me);
  }

  showBadges(opts) {
    this.game.badgeOpen = true;
    const box = this.modal(`<h2>🏅 Elige una medalla</h2><p>Te acompañará el resto de la partida.</p>
      <div class="badge-opts">${opts.map((id) => {
        const b = BADGES[id];
        return `<div class="badge-opt" data-id="${id}"><div class="bi">${b.icon}</div><h3>${b.name}</h3><p>${b.desc}</p><div class="kind">${b.kind === 'eco' ? 'Economía' : b.kind === 'trait' ? 'Sinergia' : 'Combate'}</div></div>`;
      }).join('')}</div><div class="row-btns"><button class="btn ghost" id="badge-later">Decidir luego</button></div>`);
    box.querySelectorAll('.badge-opt').forEach((el) => {
      el.onclick = () => { this.game.send({ t: 'badge', id: el.dataset.id }); sfx.play('badge'); this.closeModal(); };
    });
    box.querySelector('#badge-later').onclick = () => this.closeModal();
  }

  showDex() {
    const me = this.game.me;
    const next = me.dexNext ? `Próxima recompensa con ${me.dexNext} especies.` : '¡Has conseguido todas las recompensas!';
    const badges = me.badges.map((b) => `<span class="chip" style="--cc:#3d4c8a">${BADGES[b].icon} ${BADGES[b].name}</span>`).join(' ') || '<span class="muted">Ninguna todavía</span>';
    this.modal(`<h2>📕 Pokédex y medallas</h2><p>Has registrado <b>${me.dex}</b> especies. ${next}</p>
      <h3 style="text-align:left">Medallas</h3><div class="row" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">${badges}</div>
      <h3 style="text-align:left;margin-top:14px">Copias restantes en la reserva</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px">${LINE_LIST.map((l) => `<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:4px;border:2px solid ${COST_COLOR[l.cost]}"><img src="${portrait(l.forms[0], false)}" style="width:48px;height:48px"/><div style="font-size:11px">${me.pool?.[l.id] ?? '?'}</div></div>`).join('')}</div>
      <div class="row-btns"><button class="btn primary" onclick="document.getElementById('modal').classList.add('hidden')">Cerrar</button></div>`);
  }

  showGameOver(msg, meId, onExit) {
    const rows = [...msg.players].sort((a, b) => a.place - b.place).map((p) => `
      <div class="rank ${p.id === meId ? 'me' : ''}"><span class="pos">${p.place === 1 ? '🏆' : p.place + 'º'}</span>
      <img src="${portrait(p.avatar, false)}"/><div><b>${esc(p.name)}</b><div class="sub" style="font-size:11px;color:var(--muted)">Evoluciones ${p.stats.evolutions} · Capturas ${p.stats.captured} · Shinies ${p.stats.shinies}</div></div>
      <div class="team">${p.board.slice(0, 8).map((u) => `<img src="${portrait(u.form, u.shiny)}" title="${FORMS[u.form].name}"/>`).join('')}</div></div>`).join('');
    const me = msg.players.find((p) => p.id === meId);
    const title = me?.place === 1 ? '🏆 ¡Eres el Campeón!' : `Has quedado ${me?.place}º`;
    const box = this.modal(`<h2>${title}</h2><p>¡Gracias por jugar!</p><div class="ranking">${rows}</div>
      <div class="row-btns"><button class="btn primary big" id="go-exit">Volver al menú</button></div>`, false);
    box.querySelector('#go-exit').onclick = onExit;
  }
}

export { esc };
