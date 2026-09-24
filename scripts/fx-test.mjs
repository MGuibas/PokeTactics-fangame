// Vista rápida de efectos con calidad alta (bloom): habilidades y proyectiles por estilo.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base = 'http://localhost:3123/', out = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(base + '?auto=solo&q=alto');
await page.waitForFunction(() => window.__pt3d?.game?.room, null, { timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const g = window.__pt3d.game;
  const V = g.engine.camTarget.constructor;
  const fx = g.fx;
  const styles = ['flame', 'bubble', 'leaf', 'spark', 'rock', 'wind', 'shadow', 'psy', 'ice', 'star', 'coin', 'aura', 'shuriken', 'blade', 'dragon', 'steel'];
  styles.forEach((st, i) => {
    const x = -6 + (i % 8) * 1.7, z = i < 8 ? -3 : 1;
    fx.projectile(new V(x, 0.8, z + 2), new V(x + 0.2, 0.8, z - 1.5), 0xffffff, 60, 0.13, 0.3, st);
  });
  fx.cast('beam', 'electrico', new V(-5, 0, 4.5), new V(5, 0, 4.5));
  fx.cast('nova', 'fuego', new V(-3, 0, 6), new V(-3, 0, 6), 1);
  fx.cast('blast', 'psiquico', new V(3, 0, 6), new V(3, 0, 6.5), 1);
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/fx-alto.png` });
await browser.close();
