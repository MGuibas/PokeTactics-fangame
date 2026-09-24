// Prueba visual: carrusel, entrenador caminando y Poké Balls de botín.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.', W = 1400, H = 850] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
await page.goto(base + '?auto=solo&q=bajo', { waitUntil: 'domcontentloaded' });
const g = (fn, a) => page.evaluate(fn, a);
const phase = () => g(() => window.__pt3d.game?.room?.phase);
const wait = async (ph, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await phase() === ph) return true; await page.waitForTimeout(150); } return false; };
let n = 0;
const shot = async (name) => { await page.mouse.move(2, 2); await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); console.log('shot', name); };
await wait('safari');
await page.waitForTimeout(1200);
await shot('carousel-pens');
// Espera a que me suelten y hago clic en un Pokémon del carrusel.
for (let i = 0; i < 60; i++) {
  const rel = await g(() => { const gm = window.__pt3d.game; const s = gm.room.safari; return s ? (s.rel[gm.myId] - (performance.now() - gm._stateAt)) : -1; });
  if (rel <= 0) break;
  await page.waitForTimeout(150);
}
const pos = await g(() => { const gm = window.__pt3d.game; const v = [...gm.sviews.values()].find((x) => !x.heldBy); return v ? gm.engine.toScreen(v.midPos()) : null; });
if (pos) await page.mouse.click(pos.x, pos.y);
await page.waitForTimeout(700);
await shot('carousel-running');
await page.waitForTimeout(1600);
await shot('carousel-grabbed');
await wait('planning');
await page.waitForTimeout(800);
await g(() => { const gm = window.__pt3d.game; for (let i = 0; i < 5; i++) if (gm.me.gold >= 1) gm.send({ t: 'buy', slot: i }); gm.send({ t: 'autoplace' }); });
await page.mouse.click(300, 380, { button: 'right' });
await page.waitForTimeout(900);
await shot('walking');
await g(() => window.__pt3d.game.send({ t: 'ready', v: true }));
await wait('combat');
await wait('planning');
await page.waitForTimeout(1500);
await shot('orbs');
const orb = await g(() => { const gm = window.__pt3d.game; const o = [...gm.orbViews.values()][0]; return o ? gm.engine.toScreen(o.group.position) : null; });
console.log('orb', orb);
if (orb) { await page.mouse.click(orb.x, orb.y, { button: 'right' }); await page.waitForTimeout(2500); await shot('orb-picked'); }
const items = await g(() => window.__pt3d.game.me.items);
console.log('items', items);
// Tooltip de la tienda y de sinergia.
const card = await page.$('.card:not(.empty)');
if (card) { const b = await card.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + 30); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-tip-shop.png` }); }
const tr = await page.$('.trait');
if (tr) { const b = await tr.boundingBox(); await page.mouse.move(b.x + 20, b.y + 10); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-tip-trait.png` }); }
await browser.close();
