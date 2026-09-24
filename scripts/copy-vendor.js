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
console.log('[vendor] three.js copiado a public/vendor/three');
