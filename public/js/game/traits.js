import { TRAITS } from './data/types.js';
import { traitsOfForm } from './data/pokemon.js';

// Cuenta sinergias: cada línea cuenta una vez (Eevee cuenta cada evolución distinta).
export function computeTraits(units, bonus = {}) {
  const seen = new Set();
  const counts = {};
  for (const u of units) {
    const k = u.line === 'eevee' ? u.form : u.line;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const t of traitsOfForm(u.form)) counts[t] = (counts[t] || 0) + 1;
  }
  for (const [t, n] of Object.entries(bonus)) counts[t] = (counts[t] || 0) + n;
  return counts;
}

export function traitLevel(id, count) {
  const th = TRAITS[id]?.th || [];
  let lv = 0;
  for (const x of th) if (count >= x) lv++;
  return lv;
}

export function activeTraits(counts) {
  const out = {};
  for (const [id, n] of Object.entries(counts)) {
    const lv = traitLevel(id, n);
    if (lv > 0) out[id] = lv;
  }
  return out;
}
