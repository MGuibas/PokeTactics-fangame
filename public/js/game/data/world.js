// Clima, medallas (aumentos), eventos de etapa, líderes de gimnasio y economía.

export const WEATHERS = {
  despejado: { name: 'Despejado', icon: '🌤️', desc: 'Sin efectos. Un buen día para combatir.' },
  sol:       { name: 'Día soleado', icon: '☀️', desc: 'Fuego +30% daño, Agua −25%. Planta +3 PP/s.' },
  lluvia:    { name: 'Lluvia', icon: '🌧️', desc: 'Agua +30% daño, Fuego −25%. Eléctrico +20% vel. ataque.' },
  arena:     { name: 'Tormenta de arena', icon: '🌪️', desc: 'Roca, Tierra y Acero +25 Def/DefEsp. El resto pierde 1% PS/s.' },
  nieve:     { name: 'Nevada', icon: '❄️', desc: 'Hielo +30% daño y +20 Def. El resto −10% vel. ataque.' },
  niebla:    { name: 'Campo de Niebla', icon: '🌫️', desc: 'Hada y Psíquico +30 Poder. Dragón −20% daño.' },
  electrico: { name: 'Campo Eléctrico', icon: '🌩️', desc: 'Eléctrico +30% daño. Nadie puede dormirse.' },
};
export const WEATHER_IDS = Object.keys(WEATHERS);

// Medallas: se eligen al inicio de las etapas 2, 3 y 4.
export const BADGES = {
  // Economía
  amuleto:   { name: 'Amuleto Moneda', icon: '🪙', kind: 'eco', desc: 'Ganas +2 de oro al inicio de cada ronda.' },
  bolsa:     { name: 'Bolsa de Pepitas', icon: '💰', kind: 'eco', desc: 'Recibes 18 de oro ahora mismo.' },
  caramelos: { name: 'Lluvia de Caramelos', icon: '🍬', kind: 'eco', desc: 'Recibes 2 Caramelos Raros.' },
  maletin:   { name: 'Maletín del Profesor', icon: '🧳', kind: 'eco', desc: 'Recibes 3 componentes aleatorios y un Imán Extractor.' },
  mochila:   { name: 'Mochila Grande', icon: '🎒', kind: 'eco', desc: '+1 al tamaño máximo de tu equipo.' },
  estudio:   { name: 'Repartir Experiencia', icon: '📘', kind: 'eco', desc: 'Ganas +3 de experiencia cada ronda.' },
  descuento: { name: 'Tarjeta Socio', icon: '💳', kind: 'eco', desc: 'La primera actualización de tienda de cada ronda es gratis.' },
  ultraball: { name: 'Ultra Ball', icon: '🟡', kind: 'eco', desc: 'Tus capturas nunca fallan. Recibes 6 de oro.' },
  iris:      { name: 'Amuleto Iris', icon: '🌈', kind: 'eco', desc: 'Shinies x6 más frecuentes. Tus shinies ganan +25% de estadísticas.' },
  // Combate
  roca:      { name: 'Medalla Roca', icon: '🪨', kind: 'combat', desc: 'Tu equipo gana +25 Def y +25 Def. Esp.' },
  cascada:   { name: 'Medalla Cascada', icon: '💧', kind: 'combat', desc: 'Tu equipo empieza el combate con +25 PP.' },
  trueno:    { name: 'Medalla Trueno', icon: '⚡', kind: 'combat', desc: 'Tu equipo gana +20% de velocidad de ataque.' },
  arcoiris:  { name: 'Medalla Arcoíris', icon: '🌈', kind: 'combat', desc: 'Tu equipo regenera 1,5% de PS por segundo.' },
  alma:      { name: 'Medalla Alma', icon: '💜', kind: 'combat', desc: 'Tu equipo gana +30 de Poder.' },
  pantano:   { name: 'Medalla Pantano', icon: '🟠', kind: 'combat', desc: 'Tu equipo inflige +15% de daño.' },
  volcan:    { name: 'Medalla Volcán', icon: '🌋', kind: 'combat', desc: 'Los ataques de tu equipo queman a los enemigos.' },
  tierra:    { name: 'Medalla Tierra', icon: '🌍', kind: 'combat', desc: 'Tu equipo gana +250 PS.' },
  emblema:   { name: 'Emblema de Tipo', icon: '🏅', kind: 'trait', desc: '+1 a un tipo aleatorio para las sinergias.' },
  amistad:   { name: 'Lazo de Amistad', icon: '💞', kind: 'combat', desc: 'La amistad sube el doble de rápido y da el doble de bonus.' },
  dinamax:   { name: 'Pulsera Dinamax+', icon: '🔴', kind: 'combat', desc: 'El Dinamax se carga más rápido y dura más.' },
};
export const BADGE_IDS = Object.keys(BADGES);

// Noticias del Profesor: evento aleatorio al inicio de cada etapa (≥2).
export const EVENTS = {
  calma:     { name: 'Día tranquilo', icon: '🍃', desc: 'No hay noticias. ¡A entrenar!' },
  enjambre:  { name: 'Enjambre', icon: '🐝', desc: 'Aparecen muchos Pokémon de tipo {type} en la tienda esta etapa.' },
  rebajas:   { name: 'Rebajas en la tienda', icon: '🏷️', desc: 'Actualizar la tienda cuesta 1 de oro esta etapa.' },
  caramelos: { name: 'Reparto de caramelos', icon: '🍬', desc: '¡Todos reciben un Caramelo Raro!' },
  regalo:    { name: 'Regalo del Profesor', icon: '🎁', desc: '¡Todos reciben un componente!' },
  shiny:     { name: 'Fiebre Shiny', icon: '✨', desc: 'Los shinies son 8 veces más frecuentes esta etapa.' },
  entreno:   { name: 'Campamento de entreno', icon: '🏕️', desc: '+2 de experiencia extra cada ronda esta etapa.' },
};

// Rivales PvE.
export const WILD_ROUNDS = {
  // [línea, estrella, x, y(local 0..3 desde el frente del rival)]
  '1-2': { title: 'Pokémon salvajes', units: [['random1', 1, 2, 0], ['random1', 1, 4, 0]] },
  '1-3': { title: 'Pokémon salvajes', units: [['random1', 1, 1, 0], ['random1', 1, 3, 0], ['random1', 1, 5, 1]] },
  '1-4': { title: 'Pokémon salvajes', units: [['random1', 1, 2, 0], ['random1', 1, 4, 0], ['random2', 1, 3, 1], ['random1', 1, 3, 2]] },
};

export const GYMS = [
  { name: 'Brock', title: 'Líder Brock', icon: '🪨', units: [['geodude', 2, 3, 0], ['rhyhorn', 1, 2, 0], ['geodude', 1, 4, 0], ['aerodactyl', 1, 3, 2]] },
  { name: 'Misty', title: 'Líder Misty', icon: '💧', units: [['squirtle', 2, 3, 0], ['poliwag', 1, 2, 0], ['froakie', 1, 4, 1], ['totodile', 1, 3, 2]] },
  { name: 'Lt. Surge', title: 'Líder Lt. Surge', icon: '⚡', units: [['pichu', 2, 3, 0], ['mareep', 1, 2, 2], ['magnemite', 1, 4, 2], ['pichu', 1, 1, 0]] },
  { name: 'Erika', title: 'Líder Erika', icon: '🌸', units: [['bulbasaur', 2, 3, 2], ['chikorita', 1, 2, 0], ['treecko', 1, 4, 0], ['snover', 1, 3, 0]] },
  { name: 'Sabrina', title: 'Líder Sabrina', icon: '🔮', units: [['abra', 2, 3, 3], ['ralts', 1, 2, 2], ['duskull', 1, 3, 0], ['gastly', 2, 4, 2]] },
  { name: 'Blaine', title: 'Líder Blaine', icon: '🔥', units: [['growlithe', 1, 3, 0], ['charmander', 2, 2, 0], ['cyndaquil', 1, 3, 2], ['houndour', 1, 4, 0]] },
];
export const ELITE = [
  { name: 'Lance', title: 'Alto Mando Lance', icon: '🐉', units: [['dratini', 2, 3, 1], ['gible', 1, 2, 0], ['trapinch', 2, 4, 2], ['magikarp', 2, 3, 0], ['dratini', 1, 1, 2]] },
  { name: 'Karen', title: 'Alto Mando Karen', icon: '🌙', units: [['larvitar', 2, 3, 0], ['houndour', 2, 2, 0], ['sneasel', 2, 4, 0], ['eevee', 2, 3, 2, 'umbreon'], ['gastly', 2, 1, 2]] },
  { name: 'Lorelei', title: 'Alto Mando Lorelei', icon: '❄️', units: [['lapras', 2, 3, 2], ['swinub', 2, 3, 0], ['snover', 2, 2, 0], ['snorunt', 1, 4, 2], ['sneasel', 2, 5, 0]] },
];
export const RAID_BOSSES = ['mewtwo', 'rayquaza', 'kyogre', 'groudon', 'zapdos', 'articuno'];

// ── Economía (estilo TFT) ──
export const XP_TO_LEVEL = [0, 2, 2, 6, 10, 20, 36, 48, 76, 84, 999]; // xp para pasar de nivel i a i+1
export const MAX_LEVEL = 10;
export const SHOP_ODDS = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [18, 25, 32, 22, 3],
  9: [10, 20, 25, 35, 10],
  10: [5, 10, 20, 40, 25],
};
export const SHOP_SIZE = 5;
export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_PER_BUY = 4;
export const MAX_ITEMS = 10;
export const SHINY_CHANCE = 1 / 40;
export const STAGE_DAMAGE = [0, 0, 3, 6, 9, 12, 16, 20, 25, 30];

// Estructura de rondas por etapa.
export function roundType(stage, round) {
  if (stage === 1) return round === 1 ? 'safari' : 'pve';
  switch (round) {
    case 3: return 'safari';
    case 6: return 'pve';
    default: return 'pvp';
  }
}
export function roundsInStage(stage) { return stage === 1 ? 4 : 6; }

export const PHASE_TIME = {
  planning: 30000,
  planningShort: 20000,
  combatMax: 42000,
  overtime: 30000,
  results: 3500,
  safariIntro: 3000,
  safariPick: 7000,
};
