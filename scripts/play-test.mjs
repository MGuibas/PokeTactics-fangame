// Prueba automática en navegador: juega unas rondas en solitario y hace capturas.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:3123/';
const out = process.argv[3] || '.';
const W = +(process.argv[4] || 1400), H = +(process.argv[5] || 850);
const maxRounds = +(process.argv[6] || 3);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) { errors.push(m.text()); console.log('[console]', m.text()); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')); });
await page.goto(base + '?auto=solo');
await page.waitForTimeout(2500);
const state = () => page.evaluate(() => { const g = window.__pt3d.game; return g && g.room ? { phase: g.room.phase, stage: g.room.stage, round: g.room.round, safari: g.room.safari, me: g.me, myId: g.myId } : null; });
let shots = 0;
const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++shots).padStart(2, '0')}-${name}.png` }); console.log('shot', name); };
let lastKey = '';
const t0 = Date.now();
let combatShots = 0;
while (Date.now() - t0 < 240000) {
  const s = await state();
  if (!s) { await page.waitForTimeout(300); continue; }
  const key = `${s.stage}-${s.round}-${s.phase}`;
  if (s.phase === 'safari' && s.safari) {
    if (key !== lastKey) await shot('safari');
    const opt = s.safari.options.find((o) => !o.takenBy);
    if (opt) await page.evaluate((id) => window.__pt3d.game.send({ t: 'safari', id }), opt.id);
  }
  if (s.phase === 'planning' && key !== lastKey) {
    await page.waitForTimeout(600);
    // compra y coloca
    await page.evaluate(() => {
      const g = window.__pt3d.game;
      for (let i = 0; i < 5; i++) if (g.me.gold >= 3) g.send({ t: 'buy', slot: i });
      if (g.me.pendingBadge) g.send({ t: 'badge', id: g.me.pendingBadge[0] });
      g.send({ t: 'autoplace' });
      for (let k = 0; k < g.me.items.length; k++) if (g.me.board[0]) g.send({ t: 'equip', idx: 0, uid: g.me.board[0].uid });
    });
    await page.waitForTimeout(900);
    await shot(`plan-${s.stage}-${s.round}`);
    const cap = await page.evaluate(() => !!window.__pt3d.game.me.capture);
    if (cap) {
      await page.evaluate(() => window.__pt3d.game.openCapture());
      await page.waitForTimeout(500);
      await shot('capture');
      await page.click('#cap-throw');
      await page.waitForTimeout(3500);
      await shot('capture-result');
    }
    await page.evaluate(() => window.__pt3d.game.send({ t: 'ready', v: true }));
    combatShots = 0;
  }
  if (s.phase === 'combat' && combatShots < 2) {
    await page.waitForTimeout(combatShots === 0 ? 1500 : 3500);
    await shot(`combat-${s.stage}-${s.round}-${combatShots}`);
    combatShots++;
  }
  lastKey = key;
  if (s.stage * 10 + s.round > maxRounds) break;
  await page.waitForTimeout(250);
}
console.log('errors:', errors.length);
await browser.close();
