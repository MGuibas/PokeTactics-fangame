// Tipos, roles, sinergias y tabla de efectividad.

export const TYPES = {
  normal:    { name: 'Normal',    color: '#b8b08d', icon: '⭐' },
  fuego:     { name: 'Fuego',     color: '#ff7b2e', icon: '🔥' },
  agua:      { name: 'Agua',      color: '#3d9bff', icon: '💧' },
  planta:    { name: 'Planta',    color: '#4fc25a', icon: '🌿' },
  electrico: { name: 'Eléctrico', color: '#f7d02c', icon: '⚡' },
  hielo:     { name: 'Hielo',     color: '#7fdcf0', icon: '❄️' },
  lucha:     { name: 'Lucha',     color: '#d0443a', icon: '🥊' },
  tierra:    { name: 'Tierra',    color: '#d9a44e', icon: '⛰️' },
  volador:   { name: 'Volador',   color: '#98a8f0', icon: '🪶' },
  psiquico:  { name: 'Psíquico',  color: '#f95587', icon: '🔮' },
  roca:      { name: 'Roca',      color: '#b6a136', icon: '🪨' },
  fantasma:  { name: 'Fantasma',  color: '#7a5bb3', icon: '👻' },
  dragon:    { name: 'Dragón',    color: '#6f35fc', icon: '🐉' },
  siniestro: { name: 'Siniestro', color: '#5a4a44', icon: '🌙' },
  acero:     { name: 'Acero',     color: '#a8b8cc', icon: '⚙️' },
  hada:      { name: 'Hada',      color: '#f29fe0', icon: '✨' },
};

export const ROLES = {
  defensor: { name: 'Defensor', color: '#6b8fb3', icon: '🛡️' },
  atacante: { name: 'Atacante', color: '#e0664a', icon: '⚔️' },
  veloz:    { name: 'Veloz',    color: '#41c9a8', icon: '💨' },
  tirador:  { name: 'Tirador',  color: '#c8a23c', icon: '🎯' },
  mistico:  { name: 'Místico',  color: '#9b6ce0', icon: '🌀' },
  soporte:  { name: 'Soporte',  color: '#58b86b', icon: '💚' },
};

// Sinergias: umbrales y descripción por nivel.
export const TRAITS = {
  normal:    { th: [2, 4], desc: 'Adaptabilidad: los Pokémon Normal ganan PS y Ataque.', lv: ['+15% PS y Atq', '+35% PS y Atq'] },
  fuego:     { th: [2, 4], desc: 'Los golpes de tipo Fuego queman al objetivo (daño por segundo).', lv: ['Queman 1,5% PS/s', 'Queman 3% PS/s y +25% daño'] },
  agua:      { th: [2, 4, 6], desc: 'Los Pokémon Agua regeneran PP cada segundo.', lv: ['+3 PP/s', '+6 PP/s', '+10 PP/s y todo el equipo +3'] },
  planta:    { th: [2, 4], desc: 'Fotosíntesis: todo el equipo regenera PS.', lv: ['1,5% PS/s', '3% PS/s'] },
  electrico: { th: [2, 4], desc: 'Los ataques Eléctricos pueden soltar una descarga en cadena.', lv: ['25%: 70 daño', '40%: 140 daño y paraliza'] },
  hielo:     { th: [2, 4, 6], desc: 'Los ataques de Hielo ralentizan y pueden congelar.', lv: ['Ralentizan 25%', '+15% congelar', 'Todo el equipo congela'] },
  lucha:     { th: [2, 4], desc: 'Los luchadores pegan más fuerte y se curan al golpear.', lv: ['+20% Atq, 10% robo', '+45% Atq, 20% robo'] },
  tierra:    { th: [2, 4, 6], desc: 'Tierra gana Defensa; a 4, provoca temblores (no afectan a Voladores).', lv: ['+20 Def', '+40 Def y Temblor', '+70 Def y Temblor x2'] },
  volador:   { th: [2, 4, 6], desc: 'Los Voladores esquivan y atacan más rápido.', lv: ['10% esquiva, +10% VA', '20% esquiva, +20% VA', '35% esquiva, +35% VA'] },
  psiquico:  { th: [2, 4], desc: 'El equipo gana Poder (potencia de habilidades).', lv: ['+15 Poder (Psíquicos +30)', '+40 Poder (Psíquicos +70)'] },
  roca:      { th: [2, 4], desc: 'Robustez: los Roca empiezan con un escudo.', lv: ['Escudo 25% PS', 'Escudo 55% PS'] },
  fantasma:  { th: [2, 4], desc: 'Los Fantasma esquivan y sus habilidades confunden.', lv: ['20% esquiva', '35% esquiva y confusión'] },
  dragon:    { th: [2, 4], desc: 'Los Dragones ganan PS y daño.', lv: ['+300 PS, +15% daño', '+650 PS, +35% daño'] },
  siniestro: { th: [2, 4], desc: 'Los Siniestro ganan crítico; a 4 saltan a la retaguardia.', lv: ['+25% crít.', '+45% crít. y emboscada'] },
  acero:     { th: [2, 4], desc: 'Los Acero reciben menos daño.', lv: ['-15% daño recibido', '-32% daño recibido'] },
  hada:      { th: [2, 4], desc: 'El equipo gana Def. Esp.; los Hada curan con sus habilidades.', lv: ['+20 DefEsp, cura 20%', '+45 DefEsp, cura 40%'] },
  defensor:  { th: [2, 4, 6], desc: 'Los Defensores ganan Defensa y Def. Esp.', lv: ['+20', '+45', '+80 (aliados +20)'] },
  atacante:  { th: [2, 4, 6], desc: 'Los Atacantes ganan Ataque.', lv: ['+15% Atq', '+35% Atq', '+60% Atq'] },
  veloz:     { th: [2, 4, 6], desc: 'Los Veloces ganan velocidad de ataque.', lv: ['+15% VA', '+35% VA', '+60% VA'] },
  tirador:   { th: [2, 4], desc: 'Los Tiradores ganan alcance y daño.', lv: ['+1 alcance, +15% daño', '+1 alcance, +35% daño'] },
  mistico:   { th: [2, 4, 6], desc: 'Los Místicos ganan Poder y empiezan con PP.', lv: ['+20 Poder', '+50 Poder, +10 PP', '+90 Poder, +20 PP (equipo +25)'] },
  soporte:   { th: [2, 4], desc: 'Todo el equipo recibe escudos al inicio y a los 8 s.', lv: ['Escudo 150', 'Escudo 350'] },
};

export const traitInfo = (id) => TYPES[id] || ROLES[id];

// Tabla oficial simplificada: 2 = súper eficaz, 0.5 = poco eficaz, 0 = inmune.
const CHART = {
  normal:    { roca: .5, fantasma: 0, acero: .5 },
  fuego:     { fuego: .5, agua: .5, planta: 2, hielo: 2, roca: .5, dragon: .5, acero: 2 },
  agua:      { fuego: 2, agua: .5, planta: .5, tierra: 2, roca: 2, dragon: .5 },
  planta:    { fuego: .5, agua: 2, planta: .5, tierra: 2, volador: .5, roca: 2, dragon: .5, acero: .5 },
  electrico: { agua: 2, planta: .5, electrico: .5, tierra: 0, volador: 2, dragon: .5 },
  hielo:     { fuego: .5, agua: .5, planta: 2, hielo: .5, tierra: 2, volador: 2, dragon: 2, acero: .5 },
  lucha:     { normal: 2, hielo: 2, volador: .5, psiquico: .5, roca: 2, fantasma: 0, siniestro: 2, acero: 2, hada: .5 },
  tierra:    { fuego: 2, planta: .5, electrico: 2, volador: 0, roca: 2, acero: 2 },
  volador:   { planta: 2, electrico: .5, lucha: 2, roca: .5, acero: .5 },
  psiquico:  { lucha: 2, psiquico: .5, siniestro: 0, acero: .5 },
  roca:      { fuego: 2, hielo: 2, lucha: .5, tierra: .5, volador: 2, acero: .5 },
  fantasma:  { normal: 0, psiquico: 2, fantasma: 2, siniestro: .5 },
  dragon:    { dragon: 2, acero: .5, hada: 0 },
  siniestro: { lucha: .5, psiquico: 2, fantasma: 2, siniestro: .5, hada: .5 },
  acero:     { fuego: .5, agua: .5, electrico: .5, hielo: 2, roca: 2, acero: .5, hada: 2 },
  hada:      { fuego: .5, lucha: 2, dragon: 2, siniestro: 2, acero: .5 },
};

// En juego las diferencias se suavizan para no romper el equilibrio.
const SOFT = { 2: 1.5, 0.5: 0.7, 0: 0.5 };

export function effectiveness(atkType, defTypes) {
  if (!atkType) return 1;
  const row = CHART[atkType] || {};
  let m = 1;
  for (const t of defTypes) {
    const v = row[t];
    if (v !== undefined) m *= SOFT[v];
  }
  return Math.max(0.35, Math.min(2.25, m));
}

// Para tooltips: contra qué tipos es fuerte / débil un tipo.
export function typeMatchups(t) {
  const strong = [], weak = [];
  const row = CHART[t] || {};
  for (const [d, v] of Object.entries(row)) {
    if (v === 2) strong.push(d);
    else weak.push(d);
  }
  return { strong, weak };
}
