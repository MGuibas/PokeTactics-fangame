// Ficha detallada de un Pokémon: estadísticas por estrella y con bonificaciones, habilidad,
// tabla de tipos, cadena evolutiva, objetos, amistad y personalidad.
import { LINES, FORMS, formFor, moveOf, moveDesc, movePower, baseStats, EEVEE_BRANCH } from '../game/data/pokemon.js';
import { TYPES, traitInfo, effectiveness, TRAITS } from '../game/data/types.js';
import { ITEMS } from '../game/data/items.js';
import { WEATHERS } from '../game/data/world.js';
import { loreOf, dexOf } from '../game/data/lore.js';
import { computeStats } from '../game/combat.js';
import { traitLevel } from '../game/traits.js';
import { portrait } from './portraits.js';
import { icon, itemIcon } from './icons.js';
import { esc, COST_COLOR, traitBadge } from './ui.js';
import { sfx } from './audio.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const chip = (id) => {
  const t = traitInfo(id);
  return t ? `<span class="chip" style="--cc:${t.color}">${icon(id)}${t.name}</span>` : '';
};

// Formas de la línea por estrella (Eevee muestra sus ramas).
function chain(line, u) {
  const l = LINES[line];
  if (line === 'eevee') {
    const evo = Object.values(EEVEE_BRANCH);
    return `<div class="evo-chain eevee">
      <div class="evo ${u.star === 1 ? 'cur' : ''}"><img src="${portrait('eevee', u.shiny)}"/><span>Eevee<br><small>★</small></span></div>
      <span class="evo-arrow">${icon('up')}</span>
      <div class="evo-branch">${evo.map((f) => `<img class="${u.form === f ? 'cur' : ''}" src="${portrait(f, u.shiny)}" title="${FORMS[f].name}"/>`).join('')}</div>
    </div><div class="sub">Al llegar a ★★, Eevee evoluciona según el tipo que más abunde en tu tablero.</div>`;
  }
  const forms = [1, 2, 3].map((s) => formFor(line, s));
  return `<div class="evo-chain">${forms.map((f, i) => `${i ? `<span class="evo-arrow">${icon('up')}<small>×3</small></span>` : ''}
    <div class="evo ${u.star === i + 1 ? 'cur' : ''}"><img src="${portrait(f, u.shiny)}"/><span>${esc(FORMS[f].name)}<br><small>${'★'.repeat(i + 1)}</small></span></div>`).join('')}</div>`;
}

// Tabla de efectividades: qué tipos le hacen más/menos daño y contra cuáles pega fuerte su habilidad.
function matchups(f, m) {
  const weak = [], resist = [];
  for (const t of Object.keys(TYPES)) {
    const e = effectiveness(t, f.types);
    if (e > 1.01) weak.push([t, e]);
    else if (e < 0.99) resist.push([t, e]);
  }
  const strong = [], poor = [];
  for (const t of Object.keys(TYPES)) {
    const e = effectiveness(m.type, [t]);
    if (e > 1.01) strong.push(t); else if (e < 0.99) poor.push(t);
  }
  const row = (lbl, list, cls) => (list.length ? `<div class="mu ${cls}"><b>${lbl}</b><span>${list.map((x) => (Array.isArray(x) ? `${traitBadge(x[0], 'sm')}<i>×${x[1].toFixed(2).replace(/\.?0+$/, '')}</i>` : traitBadge(x, 'sm'))).join('')}</span></div>` : '');
  return row('Su habilidad es eficaz contra', strong, 'good') + row('Su habilidad es poco eficaz contra', poor, 'meh')
    + row('Recibe más daño de', weak, 'bad') + row('Resiste', resist, 'good');
}

export function showUnitPanel(hud, u, owner) {
  const game = hud.game;
  const f = FORMS[u.form];
  const line = f.line;
  const l = LINES[line];
  const lore = loreOf(line, u.form);
  const room = game.room;
  const star = u.star || 1;
  const m = moveOf(f, star);
  // Bonificaciones actuales del dueño (sinergias, medallas y clima).
  const counts = owner?.traits || {};
  const tl = {};
  for (const [id, n] of Object.entries(counts)) { const lv = traitLevel(id, n); if (lv) tl[id] = lv; }
  const onBoard = !!owner?.board?.some((x) => x.uid === u.uid);
  const now = computeStats({ ...u, line, star, items: u.items || [] }, { tl: onBoard ? tl : {}, badges: owner?.badges || [], weather: room?.weather || 'despejado', stage: room?.stage || 1 });
  const fid = (s) => formFor(line, s, line === 'eevee' && u.star > 1 ? u.form : undefined);
  const per = [1, 2, 3].map((s) => ({ s, f: FORMS[fid(s)], st: baseStats(line, fid(s), s) }));
  const rows = [
    ['PS', (b) => b.hp, now.maxHp],
    ['Ataque', (b) => b.atk, Math.round(now.atk)],
    ['Vel. ataque', (b) => b.as.toFixed(2), now.as.toFixed(2)],
    ['Defensa', (b) => b.def, now.def],
    ['Def. Esp.', (b) => b.mdef, now.mdef],
    ['Alcance', (b) => b.range, now.range],
    ['PP inicial / máx.', (b) => `${b.mana0}/${b.mana}`, `${Math.min(now.maxMana - 1, now.mana0)}/${now.maxMana}`],
    ['Poder', () => 100, now.ap],
    ['Crítico', (b) => pct(b.crit), pct(now.crit)],
    ['Daño crítico', (b) => pct(b.critDmg), pct(now.critDmg)],
  ];
  const extra = [];
  if (now.dodge) extra.push(['Esquiva', pct(now.dodge)]);
  if (now.dmgAmp) extra.push(['Daño extra', '+' + pct(now.dmgAmp)]);
  if (now.dmgRed) extra.push(['Daño recibido', '-' + pct(now.dmgRed)]);
  if (now.vamp) extra.push(['Robo de vida', pct(now.vamp)]);
  if (now.waterRegen) extra.push(['PP por segundo', '+' + now.waterRegen]);
  if (now.fireBurn) extra.push(['Quemadura al golpear', pct(now.fireBurn) + ' PS/s']);
  if (!now.cc) extra.push(['Inmune a control', 'Sí']);
  const cur = (v, base) => {
    const n = parseFloat(String(v)), b = parseFloat(String(base));
    const cls = n > b + 1e-6 ? 'up' : n < b - 1e-6 ? 'down' : '';
    return `<td class="now ${cls}">${v}</td>`;
  };
  const table = `<table class="stat-table"><thead><tr><th></th>${per.map((p) => `<th class="${p.s === star ? 'cur' : ''}">${'★'.repeat(p.s)}</th>`).join('')}<th class="now">Ahora</th></tr></thead>
    <tbody>${rows.map(([lbl, fn, v]) => `<tr><td>${lbl}</td>${per.map((p) => `<td class="${p.s === star ? 'cur' : ''}">${fn(p.st)}</td>`).join('')}${cur(v, fn(per[star - 1].st))}</tr>`).join('')}</tbody></table>
    ${extra.length ? `<div class="extra-stats">${extra.map(([a, b]) => `<span><i>${a}</i>${b}</span>`).join('')}</div>` : ''}
    <div class="sub">«Ahora» incluye objetos, shiny, amistad${onBoard ? ', sinergias activas' : ''}, medallas y clima (${WEATHERS[room?.weather]?.name || 'Despejado'}).${onBoard ? '' : ' Las sinergias solo cuentan en el tablero.'}</div>`;
  // Habilidad por estrella.
  const moves = per.map((p) => {
    const mv = moveOf(p.f, p.s);
    return `<div class="mv ${p.s === star ? 'cur' : ''}"><div class="mh">${traitBadge(mv.type, 'sm')}<b>${esc(mv.name || '—')}</b><span class="stars">${'★'.repeat(p.s)}</span>${mv.power ? `<span class="pw">Potencia ${movePower(p.f, p.s, mv)}</span>` : ''}</div><div>${moveDesc(p.f, p.s)}</div></div>`;
  }).join('');
  const syn = [...f.types, f.role].map((t) => {
    const n = counts[t] || 0;
    const lv = traitLevel(t, n);
    const th = TRAITS[t].th;
    return `<div class="syn ${lv ? 'on' : ''}" style="--tc:${traitInfo(t).color}">${traitBadge(t, 'sm')}<b>${traitInfo(t).name}</b><span>${th.map((x, i) => `<i class="${i < lv ? 'on' : ''}">${x}</i>`).join('')}</span><small>${lv ? TRAITS[t].lv[lv - 1] : TRAITS[t].desc}</small></div>`;
  }).join('');
  const items = (u.items || []).length
    ? u.items.map((it) => `<div class="tip-item">${itemIcon(ITEMS[it], true)}<div><b>${ITEMS[it].name}</b> ${ITEMS[it].desc}</div></div>`).join('')
    : '<div class="muted">Sin objetos. Arrastra uno desde tu mochila (también en pleno combate).</div>';
  const fr = Math.min(5, u.fr || 0);
  const dex = dexOf(u.form, line, star);
  const box = hud.modal(`<div class="unit-panel">
    <div class="up-head" style="--cc:${COST_COLOR[l.cost]}">
      <div class="up-por ${u.shiny ? 'shiny' : ''}"><img src="${portrait(u.form, u.shiny)}"/>${dex ? `<span class="dex">Nº ${String(dex).padStart(4, '0')}</span>` : ''}</div>
      <div class="up-title">
        <h2>${esc(f.name)} <span class="stars" style="color:${COST_COLOR[l.cost]}">${'★'.repeat(star)}</span>${u.shiny ? `<span class="shiny-tag">${icon('sparkle')}Shiny</span>` : ''}</h2>
        <div class="row">${f.types.map(chip).join('')}${chip(f.role)}<span class="cost-pill">${icon('coin')}${l.cost}</span>${owner ? `<span class="owner">de ${esc(owner.name)}</span>` : ''}</div>
        <p class="flavor">${esc(lore.flavor)}</p>
        <div class="nature">${icon('heart')}<b>${esc(lore.nature)}</b> · ${esc(lore.quirk.txt)}</div>
      </div>
      <button class="btn ghost up-close" title="Cerrar">${icon('close')}</button>
    </div>
    <div class="up-grid">
      <section><h3>Estadísticas</h3>${table}</section>
      <section><h3>Habilidad</h3>${moves}${f.passive === 'disfraz' ? '<div class="sub">Pasiva — Disfraz: bloquea el primer golpe que recibe en cada combate.</div>' : ''}
        <h3>Tabla de tipos</h3>${matchups(f, m)}</section>
      <section><h3>Evolución</h3>${chain(line, u)}
        <h3>Sinergias</h3><div class="syns">${syn}</div></section>
      <section><h3>Objetos</h3>${items}
        <h3>Amistad</h3><div class="friend">${[0, 1, 2, 3, 4].map((i) => `<span class="${i < fr ? 'on' : ''}">${icon('heart')}</span>`).join('')}<small>${fr >= 5 ? '¡Amistad máxima! +10% PS, Ataque y Poder.' : 'Sube 1 punto por cada combate que pasa en el tablero. Con 5: +10% PS, Ataque y Poder.'}</small></div>
        ${u.shiny ? '<div class="sub">Shiny: +15% PS y Ataque, +15 Poder.</div>' : ''}</section>
    </div></div>`);
  box.classList.add('wide');
  box.querySelector('.up-close').onclick = () => hud.closeModal();
  sfx.cry?.(u.form, line, star);
}
