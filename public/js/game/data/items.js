// Objetos equipables: 7 componentes (vitaminas) y 28 objetos combinados.

export const COMPONENTS = ['proteina', 'calcio', 'carburante', 'hierro', 'zinc', 'masps', 'maspp'];

const C = {
  proteina:   { name: 'Proteína',   icon: '💪', color: '#e8574a', stats: { atkPct: 0.15 }, desc: '+15% Ataque' },
  calcio:     { name: 'Calcio',     icon: '🧪', color: '#9b6ce0', stats: { ap: 15 }, desc: '+15 Poder' },
  carburante: { name: 'Carburante', icon: '⚡', color: '#f2c230', stats: { asPct: 0.15 }, desc: '+15% Vel. ataque' },
  hierro:     { name: 'Hierro',     icon: '🛡️', color: '#8c9aab', stats: { def: 20 }, desc: '+20 Defensa' },
  zinc:       { name: 'Zinc',       icon: '💠', color: '#4a9be8', stats: { mdef: 20 }, desc: '+20 Def. Esp.' },
  masps:      { name: 'Más PS',     icon: '❤️', color: '#4cbf6a', stats: { hp: 150 }, desc: '+150 PS' },
  maspp:      { name: 'Más PP',     icon: '💧', color: '#36c6d9', stats: { mana0: 15 }, desc: '+15 PP iniciales' },
};

// Objetos completos: clave = par de componentes ordenado.
const FULL = [
  ['proteina', 'proteina', 'cintaelegida', 'Cinta Elegida', '🎀', 'Ataque masivo: +20% prob. de crítico extra.', { crit: 0.2, atkPct: 0.2 }],
  ['proteina', 'calcio', 'vidasfera', 'Vidasfera', '🔴', 'Todo su daño +25%, pero pierde 2% de PS al atacar.', { dmgAmp: 0.25 }],
  ['proteina', 'carburante', 'garrarapida', 'Garra Rápida', '🦅', '25% de probabilidad de atacar dos veces.', {}],
  ['proteina', 'hierro', 'cintaexperto', 'Cinta Experto', '🥋', 'Los golpes súper eficaces hacen +40% de daño.', {}],
  ['proteina', 'zinc', 'rocadelrey', 'Roca del Rey', '👑', 'Sus ataques tienen 20% de amedrentar (aturdir 1 s).', {}],
  ['proteina', 'masps', 'campanaconcha', 'Campana Concha', '🐚', 'Se cura el 25% del daño que inflige.', { vamp: 0.25 }],
  ['proteina', 'maspp', 'periscopio', 'Periscopio', '🔭', '+35% crítico y sus habilidades pueden ser críticas.', { crit: 0.35 }],
  ['calcio', 'calcio', 'gafaselegidas', 'Gafas Elegidas', '🥽', 'Poder masivo: +30 Poder extra.', { ap: 30 }],
  ['calcio', 'carburante', 'metronomo', 'Metrónomo', '🎵', 'Cada ataque le da +6% vel. ataque (acumulable).', {}],
  ['calcio', 'hierro', 'hierbablanca', 'Hierba Blanca', '🌼', 'Al empezar, él y sus aliados adyacentes ganan un escudo de 250.', {}],
  ['calcio', 'zinc', 'gafasespeciales', 'Gafas Especiales', '👓', 'Sus habilidades reducen 40% la Def. Esp. del objetivo.', {}],
  ['calcio', 'masps', 'llamasfera', 'Llamasfera', '🔥', 'Sus habilidades queman (3% PS/s) y reducen la curación.', {}],
  ['calcio', 'maspp', 'cristalz', 'Cristal Z', '💎', 'Su primera habilidad es un MOVIMIENTO Z: ¡doble de daño!', {}],
  ['carburante', 'carburante', 'panueloelegido', 'Pañuelo Elegido', '🧣', 'Se mueve el doble de rápido y +15% esquiva.', { asPct: 0.15, dodge: 0.15 }],
  ['carburante', 'hierro', 'cintaaguante', 'Cinta Aguante', '🎗️', 'Cada golpe dado o recibido: +2% daño y +2 Def (máx. 25).', {}],
  ['carburante', 'zinc', 'hierbamental', 'Hierba Mental', '🍀', 'Inmune a sueño, parálisis, congelación y confusión.', {}],
  ['carburante', 'masps', 'bayazidra', 'Baya Zidra', '🍋', 'Al bajar del 50% de PS, cura el 35% de sus PS (una vez).', {}],
  ['carburante', 'maspp', 'pila', 'Pila', '🔋', 'Gana +6 PP extra por ataque.', {}],
  ['hierro', 'hierro', 'cascodentado', 'Casco Dentado', '⛑️', 'Quien le ataca recibe 30 de daño. Inmune a críticos.', { def: 20 }],
  ['hierro', 'zinc', 'protector', 'Protector', '🧱', '+12 Def y Def. Esp. por cada enemigo que le apunta.', {}],
  ['hierro', 'masps', 'bandafocus', 'Banda Focus', '🎽', 'Sobrevive a un golpe letal con 1 PS, invulnerable 1,5 s y cura 30%.', {}],
  ['hierro', 'maspp', 'bolaluminosa', 'Bola Luminosa', '🟡', 'Si es de la línea de Pikachu: ¡doble Ataque y Poder! Si no, +20% Atq y +20 Poder.', {}],
  ['zinc', 'zinc', 'chalecoasalto', 'Chaleco Asalto', '🦺', 'Recibe 25% menos daño especial.', { mdef: 20 }],
  ['zinc', 'masps', 'cascabelalivio', 'Cascabel Alivio', '🔔', 'Al bajar del 40% PS, cura 25% de PS a aliados cercanos (una vez).', {}],
  ['zinc', 'maspp', 'lentezoom', 'Lente Zoom', '🔍', '+1 de alcance y +15% de daño.', { range: 1, dmgAmp: 0.15 }],
  ['masps', 'masps', 'restos', 'Restos', '🍎', 'Regenera 3% de sus PS máximos cada segundo.', { hp: 150 }],
  ['masps', 'maspp', 'semillamilagro', 'Semilla Milagro', '🌱', 'Sus curaciones y escudos son un 40% más fuertes.', {}],
  ['maspp', 'maspp', 'etermaximo', 'Éter Máximo', '🫧', 'Tras usar su habilidad recupera 25 PP.', {}],
];

export const CONSUMABLES = {
  caramelo: { name: 'Caramelo Raro', icon: '🍬', color: '#6fb7ff', desc: 'Úsalo sobre un Pokémon para conseguir otra copia básica de su línea.', consumable: true },
};

export const ITEMS = {};
const RECIPES = {};
for (const [id, v] of Object.entries(C)) ITEMS[id] = { id, ...v, component: true };
for (const [a, b, id, name, icon, desc, extra] of FULL) {
  const stats = {};
  for (const src of [C[a].stats, C[b].stats, extra]) {
    for (const [k, v] of Object.entries(src)) stats[k] = (stats[k] || 0) + v;
  }
  ITEMS[id] = { id, name, icon, desc, stats, from: [a, b], color: C[a].color, color2: C[b].color };
  RECIPES[[a, b].sort().join('+')] = id;
}
for (const [id, v] of Object.entries(CONSUMABLES)) ITEMS[id] = { id, ...v };

export function combine(a, b) {
  return RECIPES[[a, b].sort().join('+')] || null;
}

export function isComponent(id) { return !!ITEMS[id]?.component; }

export const FULL_ITEMS = FULL.map((f) => f[2]);

export function statText(stats) {
  const out = [];
  if (stats.atkPct) out.push(`+${Math.round(stats.atkPct * 100)}% Atq`);
  if (stats.ap) out.push(`+${stats.ap} Poder`);
  if (stats.asPct) out.push(`+${Math.round(stats.asPct * 100)}% VA`);
  if (stats.def) out.push(`+${stats.def} Def`);
  if (stats.mdef) out.push(`+${stats.mdef} DefEsp`);
  if (stats.hp) out.push(`+${stats.hp} PS`);
  if (stats.mana0) out.push(`+${stats.mana0} PP`);
  if (stats.crit) out.push(`+${Math.round(stats.crit * 100)}% crít.`);
  if (stats.dodge) out.push(`+${Math.round(stats.dodge * 100)}% esquiva`);
  if (stats.range) out.push(`+${stats.range} alcance`);
  return out.join(' · ');
}
