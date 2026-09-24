// Copia three.js desde node_modules a public/vendor para que el cliente
// funcione como sitio estático (sin bundler).
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three', 'build');
const dst = join(root, 'public', 'vendor', 'three');
mkdirSync(dst, { recursive: true });
for (const f of ['three.module.js', 'three.core.js']) {
  const p = join(src, f);
  if (existsSync(p)) copyFileSync(p, join(dst, f));
}
// Fuente Fredoka (auto-alojada, sin depender de Google Fonts).
const fsrc = join(root, 'node_modules', '@fontsource', 'fredoka', 'files');
const fdst = join(root, 'public', 'vendor', 'fonts');
mkdirSync(fdst, { recursive: true });
for (const w of [400, 500, 600, 700]) {
  const f = `fredoka-latin-${w}-normal.woff2`;
  if (existsSync(join(fsrc, f))) copyFileSync(join(fsrc, f), join(fdst, f));
}
console.log('[vendor] three.js y fuentes copiados a public/vendor');
