// Escenario de prueba visual con trucos de depuración (?debug=1).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.', W = 1400, H = 850] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
await page.goto(base + '?auto=solo&debug=1');
const g = (fn, arg) => page.evaluate(fn, arg);
const waitPhase = async (ph, timeout = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await g(() => window.__pt3d.game?.room?.phase);
    if (p === ph) return true;
    // Safari: elige si es mi turno.
    await g(() => { const gm = window.__pt3d.game; const s = gm?.room?.safari; if (s && s.turn >= 0 && s.order[s.turn] === gm.myId) { const o = s.options.find((x) => !x.takenBy); if (o) gm.send({ t: 'safari', id: o.id }); } });
    await page.waitForTimeout(200);
  }
  return false;
};
let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); console.log('shot', name); };

await waitPhase('planning');
await g(() => window.__pt3d.game.send({ t: 'cheat', gold: 200, level: 8, dyna: 1, give: [
  { line: 'charmander', star: 2 }, { line: 'charmander', star: 2 }, { line: 'pichu', star: 2, shiny: true },
  { line: 'gastly', star: 3 }, { line: 'dratini', star: 2 }, { line: 'lapras', star: 1 }, { line: 'eevee', star: 1 }, { line: 'eevee', star: 1 },
], items: ['proteina', 'calcio', 'cintaelegida', 'restos', 'caramelo'] }));
await page.waitForTimeout(400);
await g(() => window.__pt3d.game.send({ t: 'autoplace' }));
await page.waitForTimeout(600);
await shot('board-before-evo');
// Tercer Charmeleon → Charizard; tercer Eevee → evolución.
await g(() => window.__pt3d.game.send({ t: 'cheat', give: [{ line: 'charmander', star: 2 }, { line: 'eevee', star: 1 }] }));
await page.waitForTimeout(700);
await shot('evolving');
await page.waitForTimeout(1800);
await g(() => window.__pt3d.game.send({ t: 'autoplace' }));
await page.waitForTimeout(500);
// Tooltip sobre una unidad del tablero.
const pos = await g(() => { const gm = window.__pt3d.game; const v = [...gm.views.values()].find((x) => !x.onBench); const s = gm.engine.toScreen(v.midPos()); return s; });
await page.mouse.move(pos.x, pos.y);
await page.waitForTimeout(300);
await shot('board-after-evo-tooltip');
await g(() => window.__pt3d.game.send({ t: 'ready', v: true }));
await waitPhase('combat');
await page.waitForTimeout(1200);
await shot('combat-start');
await g(() => window.__pt3d.game.armDynamax());
await page.waitForTimeout(300);
await g(() => window.__pt3d.game.armDynamax());
await page.waitForTimeout(2000);
await shot('combat-dynamax');
await page.waitForTimeout(3000);
await shot('combat-late');
await waitPhase('results', 50000);
await page.waitForTimeout(600);
await shot('results');
// Salta a la incursión (etapa 5-6) con clima de nieve.
await waitPhase('planning');
await g(() => window.__pt3d.game.send({ t: 'cheat', stage: 5, round: 5, weather: 'nieve' }));
await g(() => window.__pt3d.game.send({ t: 'ready', v: true }));
await waitPhase('results', 60000);
await waitPhase('planning', 60000);
await page.waitForTimeout(800);
await shot('stage5-planning');
await g(() => window.__pt3d.game.send({ t: 'ready', v: true }));
await waitPhase('combat');
await page.waitForTimeout(2500);
await shot('raid');
await page.waitForTimeout(4000);
await shot('raid-late');
await browser.close();
