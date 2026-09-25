// Multijugador: espiar durante combates salvajes y PvP (orden real de red) y volver al tuyo.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.'] = process.argv.slice(2);
const browsers = [];
const mk = async (name) => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  page.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log(`[${name}]`, m.text()); });
  await page.goto(base + '?q=bajo', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  await page.fill('#name-input', name);
  return page;
};
const a = await mk('Alicia');
const b = await mk('Bruno');
await a.click('#btn-multi'); await a.waitForTimeout(800);
await a.click('#btn-create');
await a.waitForSelector('#room-code:not(:empty)');
const code = await a.textContent('#room-code');
await b.click('#btn-multi'); await b.waitForTimeout(800);
await b.fill('#code-input', code); await b.click('#btn-join');
await a.waitForTimeout(800);
await a.click('#btn-start');
await a.waitForFunction(() => window.__pt3d?.game?.room, null, { timeout: 60000 });
await b.waitForFunction(() => window.__pt3d?.game?.room, null, { timeout: 60000 });
const st = (p) => p.evaluate(() => {
  const gm = window.__pt3d.game;
  const f = gm.fight;
  return { round: `${gm.room.stage}-${gm.room.round}`, phase: gm.room.phase, scout: gm.scoutId, fight: f && f.sides.map((s) => s.name + (s.ghost ? '(eco)' : '')).join(' vs '), views: gm.cviews.size, head: document.querySelector('.trait-owner')?.textContent || null };
});
const readyUp = async () => {
  for (const p of [a, b]) await p.evaluate(() => {
    const g = window.__pt3d.game;
    if (g.me?.pendingBadge) g.send({ t: 'badge', id: g.me.pendingBadge[0] });
    g.send({ t: 'buy', slot: 0 }); g.send({ t: 'autoplace' }); g.send({ t: 'ready', v: true });
    const s = g.room.safari; if (s) { const o = s.options.find((x) => !x.takenBy); if (o) g.send({ t: 'safari', id: o.id }); }
  });
};
const check = async (label, targetName) => {
  await a.waitForFunction(() => window.__pt3d.game.room.phase === 'combat' && window.__pt3d.game.fight, null, { timeout: 180000 });
  await a.waitForTimeout(1500);
  console.log(label, 'A mine   ', JSON.stringify(await st(a)));
  const target = await a.evaluate((n) => { const gm = window.__pt3d.game; return (gm.room.players.find((p) => p.name === n) || gm.room.players.find((p) => p.id !== gm.myId && p.alive)).id; }, targetName);
  await a.evaluate((id) => window.__pt3d.game.scout(id), target);
  await a.waitForTimeout(2000);
  console.log(label, 'A scout  ', JSON.stringify(await st(a)));
  await a.screenshot({ path: `${out}/mpspec-${label}-scout.png` });
  await a.evaluate(() => window.__pt3d.game.scout(null));
  await a.waitForTimeout(2000);
  console.log(label, 'A back   ', JSON.stringify(await st(a)));
  await a.screenshot({ path: `${out}/mpspec-${label}-back.png` });
};
// Hasta la primera ronda de salvajes.
for (let i = 0; i < 200; i++) {
  const s = await st(a);
  if (s.phase === 'planning' && s.round !== '1-1') break;
  await readyUp(); await a.waitForTimeout(700);
}
await readyUp();
await check('pve', 'Bruno');
// Hasta la primera ronda PvP (2-1).
for (let i = 0; i < 400; i++) {
  const s = await st(a);
  if (s.round.startsWith('2-') && s.phase === 'planning') break;
  await readyUp(); await a.waitForTimeout(700);
}
await readyUp();
await check('pvp', 'Bruno');
for (const br of browsers) await br.close();
