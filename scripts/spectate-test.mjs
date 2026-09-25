// Espiar durante el combate: ver el combate y las sinergias del otro, y volver al tuyo sin perderlo.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
await page.goto(base + '?auto=solo&debug=1&q=bajo');
const g = (fn, arg) => page.evaluate(fn, arg);
await page.waitForFunction(() => window.__pt3d?.game?.room, null, { timeout: 60000 });
// Registra avisos y carteles desde el principio.
await g(() => {
  const hud = window.__pt3d.game.hud;
  window.__toasts = []; window.__banners = [];
  const t = hud.toast.bind(hud), b = hud.banner.bind(hud);
  hud.toast = (text, big) => { window.__toasts.push(text); return t(text, big); };
  hud.banner = (text, cls, sub) => { window.__banners.push([text, cls, sub]); return b(text, cls, sub); };
});
// Salta la 1-1 y prepara un equipo.
await page.waitForFunction(() => window.__pt3d.game.room.round >= 2 && window.__pt3d.game.room.phase === 'planning', null, { timeout: 300000 });
await g(() => window.__pt3d.game.send({ t: 'cheat', gold: 100, level: 6, give: [{ line: 'charmander', star: 2 }, { line: 'squirtle', star: 2 }, { line: 'gastly', star: 2 }, { line: 'pidgey', star: 2 }] }));
await page.waitForTimeout(300);
await g(() => { window.__pt3d.game.send({ t: 'autoplace' }); window.__pt3d.game.send({ t: 'ready', v: true }); });
await page.waitForFunction(() => window.__pt3d.game.room.phase === 'combat' && window.__pt3d.game.fight, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const state = () => g(() => {
  const gm = window.__pt3d.game;
  const f = gm.fight;
  return {
    scout: gm.scoutId, mode: gm.mode, fight: f && f.id, sides: f && f.sides.map((s) => s.name), views: gm.cviews.size,
    stored: [...gm.combats.keys()], traitsHead: document.querySelector('.trait-owner')?.textContent || null,
    traits: [...document.querySelectorAll('#traits .trait .tn')].map((x) => x.textContent).slice(0, 4),
  };
});
console.log('mine    ', JSON.stringify(await state()));
const other = await g(() => { const gm = window.__pt3d.game; return gm.room.players.find((p) => p.id !== gm.myId && p.alive).id; });
await g((id) => window.__pt3d.game.scout(id), other);
await page.waitForTimeout(1200);
console.log('scouting', JSON.stringify(await state()));
await page.screenshot({ path: `${out}/spec-1-scouting.png` });
await g(() => window.__pt3d.game.scout(null));
await page.waitForTimeout(1200);
console.log('back    ', JSON.stringify(await state()));
await page.screenshot({ path: `${out}/spec-2-back.png` });
// Mirar a otro hasta que termine tu combate: el resultado debe llegar igualmente.
await g(() => { window.__banners = []; });
await g((id) => window.__pt3d.game.scout(id), other);
await page.waitForFunction(() => { const gm = window.__pt3d.game; const mine = gm.combatFor(gm.myId); return !mine || mine.ended; }, null, { timeout: 180000 });
await page.waitForTimeout(800);
console.log('toasts while scouting', JSON.stringify(await g(() => window.__toasts.filter((t) => t.startsWith('Tu combate')))));
console.log('banners while scouting', JSON.stringify(await g(() => window.__banners)));
console.log('scouting after end', JSON.stringify(await state()));
await g(() => window.__pt3d.game.scout(null));
await page.waitForTimeout(800);
console.log('back after end', JSON.stringify(await state()));
await page.screenshot({ path: `${out}/spec-3-back-ended.png` });
await browser.close();
