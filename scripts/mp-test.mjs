// Prueba multijugador: dos navegadores crean/unen sala, juegan y uno se reconecta.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.'] = process.argv.slice(2);
const browsers = [];
const mk = async (name) => {
  // Un navegador por jugador (aislado, como en la vida real).
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  page.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) console.log(`[${name}]`, m.text()); });
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  await page.fill('#name-input', name);
  return page;
};
const a = await mk('Alicia');
const b = await mk('Bruno');
await a.click('#btn-multi');
await a.waitForTimeout(800);
await a.click('#btn-create');
await a.waitForSelector('#room-code:not(:empty)');
const code = await a.textContent('#room-code');
console.log('code', code);
await b.click('#btn-multi');
await b.waitForTimeout(800);
await b.fill('#code-input', code);
await b.click('#btn-join');
await a.waitForTimeout(800);
await a.click('#btn-addbot');
await a.waitForTimeout(400);
await a.screenshot({ path: `${out}/mp-lobby.png` });
const members = await a.$$eval('.member:not(.empty)', (els) => els.length);
console.log('members in lobby', members);
await a.click('#btn-start');
await a.waitForTimeout(3000);
const info = async (p) => p.evaluate(() => { const g = window.__pt3d.game; return g ? { phase: g.room?.phase, players: g.room?.players.map((x) => `${x.name}${x.isBot ? '(bot)' : ''}`), me: g.me?.id } : null; });
console.log('A', JSON.stringify(await info(a)));
console.log('B', JSON.stringify(await info(b)));
// Esperar a la fase de planificación y comprar algo en ambos.
for (let i = 0; i < 60; i++) {
  const ia = await info(a);
  if (ia?.phase === 'planning') break;
  for (const p of [a, b]) await p.evaluate(() => { const gm = window.__pt3d.game; const s = gm?.room?.safari; if (s) { const o = s.options.find((x) => !x.takenBy); if (o) gm.send({ t: 'safari', id: o.id }); } });
  await a.waitForTimeout(500);
}
for (const p of [a, b]) await p.evaluate(() => { const g = window.__pt3d.game; g.send({ t: 'buy', slot: 0 }); g.send({ t: 'autoplace' }); g.send({ t: 'ready', v: true }); g.send({ t: 'emote', e: '😂' }); g.send({ t: 'chat', text: 'hola!' }); });
await a.waitForTimeout(1500);
await a.screenshot({ path: `${out}/mp-a-planning.png` });
// Reconexión: B recarga la página.
await b.reload();
await b.waitForTimeout(4000);
console.log('B after reload', JSON.stringify(await info(b)));
for (let i = 0; i < 40; i++) { if ((await info(a))?.phase === 'combat') break; await a.waitForTimeout(500); }
await a.waitForTimeout(2000);
await a.screenshot({ path: `${out}/mp-a-combat.png` });
await b.screenshot({ path: `${out}/mp-b-combat.png` });
console.log('A', JSON.stringify(await info(a)));
for (const b of browsers) await b.close();
