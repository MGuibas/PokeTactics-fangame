// Prueba visual de la ronda de pulido: ficha de Pokémon, visitas, objetos en combate, entrenadores en combate.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.', W = 1400, H = 850] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('404')) console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
await page.goto(base + '?auto=solo&debug=1&q=bajo');
const g = (fn, arg) => page.evaluate(fn, arg);
const waitPhase = async (ph, timeout = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await g(() => window.__pt3d.game?.room?.phase);
    if (p === ph) return true;
    await g(() => { const gm = window.__pt3d.game; const s = gm?.room?.safari; if (s) { const o = s.options.find((x) => !x.takenBy); if (o) gm.send({ t: 'safari', id: o.id }); } });
    await page.waitForTimeout(200);
  }
  return false;
};
let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); console.log('shot', name); };

await waitPhase('planning');
// La 1-1 es la Zona Safari: espera a la primera planificación de verdad.
for (let i = 0; i < 300 && !(await g(() => window.__pt3d.game?.room?.round >= 2 && window.__pt3d.game.room.phase === 'planning')); i++) await waitPhase('planning', 400);
const shopLine = await g(() => window.__pt3d.game.me.shop.find(Boolean)?.line);
await g((shopLine) => window.__pt3d.game.send({ t: 'cheat', gold: 200, level: 8, give: [
  { line: 'charmander', star: 2 }, { line: 'pichu', star: 2, shiny: true }, { line: 'gastly', star: 3 }, { line: 'dratini', star: 2 }, { line: 'lapras', star: 1 }, { line: shopLine, star: 1 },
], items: ['proteina', 'calcio', 'cintaelegida', 'restos', 'iman', 'hierro', 'masps'] }), shopLine);
await page.waitForTimeout(400);
await g(() => window.__pt3d.game.send({ t: 'autoplace' }));
await page.waitForTimeout(800);
await shot('shop-owned');
// Ficha de una unidad del tablero (clic).
const pos = await g(() => { const gm = window.__pt3d.game; const v = [...gm.views.values()].find((x) => !x.onBench && x.form === 'gengar') || [...gm.views.values()].find((x) => !x.onBench); const s = gm.engine.toScreen(v.midPos()); return s; });
await page.mouse.move(pos.x, pos.y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(500);
await shot('unit-panel');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
// Ficha desde la tienda (clic derecho).
const card = await page.$('#shop-cards .card:not(.empty)');
await card.click({ button: 'right' });
await page.waitForTimeout(400);
await shot('shop-panel');
await page.keyboard.press('Escape');
// Imán: quita objetos.
await g(() => { const gm = window.__pt3d.game; const u = gm.me.board[0]; gm.send({ t: 'equip', idx: gm.me.items.indexOf('proteina'), uid: u.uid }); });
await page.waitForTimeout(300);
await g(() => { const gm = window.__pt3d.game; const u = gm.me.board[0]; gm.send({ t: 'equip', idx: gm.me.items.indexOf('iman'), uid: u.uid }); });
await page.waitForTimeout(500);
console.log('after iman items', await g(() => JSON.stringify([window.__pt3d.game.me.board[0].items, window.__pt3d.game.me.items])));
// Visita a otro jugador.
const other = await g(() => window.__pt3d.game.room.players.find((p) => p.id !== window.__pt3d.game.myId).id);
await g((id) => window.__pt3d.game.scout(id), other);
await page.waitForTimeout(1500);
console.log('trainers visiting', await g(() => JSON.stringify([...window.__pt3d.game.trainers.entries()].map(([k, t]) => [k, t.mirror, +t.pos.x.toFixed(1), +t.pos.z.toFixed(1)]))));
await shot('visiting');
await g(() => window.__pt3d.game.scout(null));
await page.waitForTimeout(1200);
await g(() => window.__pt3d.game.send({ t: 'ready', v: true }));
// Avanza hasta un combate PvP.
for (let i = 0; i < 12; i++) {
  await waitPhase('combat', 90000);
  const k = await g(() => window.__pt3d.game.fight?.kind);
  if (k === 'pvp') break;
  await waitPhase('planning', 90000);
  await g(() => window.__pt3d.game.send({ t: 'ready', v: true }));
}
await page.waitForTimeout(1500);
console.log('trainers in combat', await g(() => JSON.stringify([...window.__pt3d.game.trainers.entries()].map(([k, t]) => [k, t.mirror, +t.pos.x.toFixed(1), +t.pos.z.toFixed(1)]))));
// Objeto en pleno combate.
await g(() => { const gm = window.__pt3d.game; const v = [...gm.cviews.values()].find((x) => !x.enemy && !x.dead); gm.send({ t: 'equip', idx: gm.me.items.findIndex((i) => i !== 'caramelo' && i !== 'iman'), uid: v.uid }); });
await page.waitForTimeout(700);
await shot('combat-trainers-item');
await page.waitForTimeout(1500);
// Ficha de un rival en combate.
const epos = await g(() => { const gm = window.__pt3d.game; const v = [...gm.cviews.values()].find((x) => x.enemy && !x.dead); return v ? gm.engine.toScreen(v.midPos()) : null; });
if (epos) { await page.mouse.move(epos.x, epos.y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(400); await shot('enemy-panel'); }
await browser.close();
