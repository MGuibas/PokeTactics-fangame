// Plantel de Pokémon: líneas evolutivas, estadísticas y movimientos.
// 3 copias de una línea = siguiente evolución (★★), 3 evoluciones = forma final (★★★).
// Líneas de 2 etapas terminan en Mega/Gigamax; los legendarios suben de estrellas.

import { TYPES, ROLES } from './types.js';

export const COSTS = [1, 2, 3, 4, 5];
export const POOL_SIZE = { 1: 29, 2: 22, 3: 18, 4: 12, 5: 10 };
export const COST_MUL = { 1: 1, 2: 1.12, 3: 1.26, 4: 1.42, 5: 1.62 };
export const STAR_MUL = [1, 1.8, 3.24];
export const POWER_STAR = [1, 1.5, 2.35];

export const ROLE_STATS = {
  defensor: { hp: 720, atk: 48, as: 0.6, def: 40, mdef: 40, range: 1, mana: 90, mana0: 30 },
  atacante: { hp: 640, atk: 60, as: 0.7, def: 28, mdef: 28, range: 1, mana: 75, mana0: 15 },
  veloz:    { hp: 580, atk: 52, as: 0.82, def: 25, mdef: 25, range: 1, mana: 65, mana0: 10 },
  tirador:  { hp: 520, atk: 58, as: 0.72, def: 15, mdef: 15, range: 4, mana: 80, mana0: 20 },
  mistico:  { hp: 520, atk: 38, as: 0.65, def: 15, mdef: 20, range: 3, mana: 65, mana0: 25 },
  soporte:  { hp: 560, atk: 40, as: 0.6, def: 20, mdef: 25, range: 3, mana: 80, mana0: 30 },
};

const S = (kind, dur, extra = {}) => ({ kind, dur, ...extra });

// L(id, coste, tipos, rol, formas, nombres, movimiento, extra)
const LINES_RAW = [
  // ───────────── Coste 1 ─────────────
  ['charmander', 1, ['fuego'], 'atacante', ['charmander', 'charmeleon', 'charizard'], ['Charmander', 'Charmeleon', 'Charizard'],
    { kind: 'blast', names: ['Ascuas', 'Lanzallamas', 'Llamarada'], power: [215, 225, 240], radius: [0, 1, 1], status: S('burn', 3, { pct: 0.02 }) },
    { formTypes: { charizard: ['fuego', 'volador'] } }],
  ['squirtle', 1, ['agua'], 'defensor', ['squirtle', 'wartortle', 'blastoise'], ['Squirtle', 'Wartortle', 'Blastoise'],
    { kind: 'nova', names: ['Refugio', 'Hidropulso', 'Hidrobomba'], power: [110, 120, 130], radius: [1, 1, 2], selfShield: [220, 240, 260] }],
  ['bulbasaur', 1, ['planta'], 'soporte', ['bulbasaur', 'ivysaur', 'venusaur'], ['Bulbasaur', 'Ivysaur', 'Venusaur'],
    { kind: 'drain', names: ['Absorber', 'Megaagotar', 'Gigadrenado'], power: [170, 180, 190], heal: 0.8, healTarget: 'ally' }],
  ['pichu', 1, ['electrico'], 'veloz', ['pichu', 'pikachu', 'raichu'], ['Pichu', 'Pikachu', 'Raichu'],
    { kind: 'chain', names: ['Impactrueno', 'Rayo', 'Trueno'], power: [150, 160, 170], bounces: [2, 3, 4], status: S('para', 0.6) }],
  ['machop', 1, ['lucha'], 'atacante', ['machop', 'machoke', 'machamp'], ['Machop', 'Machoke', 'Machamp'],
    { kind: 'multi', names: ['Golpe Kárate', 'Tajo Cruzado', 'Puño Dinámico'], power: [80, 80, 85], hits: [2, 3, 4], same: true, phys: true }],
  ['geodude', 1, ['roca', 'tierra'], 'defensor', ['geodude', 'graveler', 'golem'], ['Geodude', 'Graveler', 'Golem'],
    { kind: 'nova', names: ['Lanzarrocas', 'Avalancha', 'Terremoto'], power: [100, 110, 120], radius: [1, 1, 2], status: S('flinch', 1.0) },
    { st: { hp: 1.05, as: 0.95 } }],
  ['pidgey', 1, ['normal', 'volador'], 'tirador', ['pidgey', 'pidgeotto', 'pidgeot'], ['Pidgey', 'Pidgeotto', 'Pidgeot'],
    { kind: 'beam', names: ['Tornado', 'Aire Afilado', 'Vendaval'], power: [210, 220, 235], len: [3, 4, 5], phys: false }],
  ['gastly', 1, ['fantasma'], 'mistico', ['gastly', 'haunter', 'gengar'], ['Gastly', 'Haunter', 'Gengar'],
    { kind: 'blast', names: ['Lengüetazo', 'Tinieblas', 'Bola Sombra'], power: [230, 240, 255], radius: [0, 1, 1], status: S('confuse', 2) }],
  ['magikarp', 1, ['agua'], 'atacante', ['magikarp', 'gyarados', 'gyarados-mega'], ['Magikarp', 'Gyarados', 'Mega-Gyarados'],
    { kind: 'splash', names: ['Salpicadura', 'Cascada', 'Hiperrayo'], power: [0, 0, 0] },
    { formTypes: { gyarados: ['agua', 'volador'], 'gyarados-mega': ['agua', 'siniestro'] },
      formStats: { magikarp: { hp: 0.55, atk: 0.35, as: 0.8 }, gyarados: { hp: 1.4, atk: 1.45 }, 'gyarados-mega': { hp: 1.55, atk: 1.65 } },
      formMoves: {
        gyarados: { kind: 'dash', name: 'Cascada', power: [0, 320, 0], target: 'current', landRadius: 1, status: S('flinch', 0.8), phys: true },
        'gyarados-mega': { kind: 'beam', name: 'Hiperrayo', power: [0, 0, 420], len: 6 },
      } }],
  ['poliwag', 1, ['agua', 'lucha'], 'defensor', ['poliwag', 'poliwhirl', 'poliwrath'], ['Poliwag', 'Poliwhirl', 'Poliwrath'],
    { kind: 'bolt', names: ['Hipnosis', 'Hidropulso', 'Puño Dinámico'], power: [110, 120, 140], status: S('sleep', 1.6) }],
  ['meowth', 1, ['normal'], 'veloz', ['meowth', 'persian', 'meowth-gmax'], ['Meowth', 'Persian', 'Meowth Gigamax'],
    { kind: 'payday', names: ['Día de Pago', 'Día de Pago', 'Monedas G-Max'], power: [150, 160, 170], gold: [0.35, 0.55, 1] }],

  // ───────────── Coste 2 ─────────────
  ['abra', 2, ['psiquico'], 'mistico', ['abra', 'kadabra', 'alakazam'], ['Abra', 'Kadabra', 'Alakazam'],
    { kind: 'blast', names: ['Teletransporte', 'Psicorrayo', 'Psíquico'], power: [0, 250, 270], radius: [0, 1, 1], status: S('confuse', 1.5) },
    { formMoves: { abra: { kind: 'teleport', name: 'Teletransporte', power: [180, 0, 0] } } }],
  ['cyndaquil', 2, ['fuego'], 'mistico', ['cyndaquil', 'quilava', 'typhlosion'], ['Cyndaquil', 'Quilava', 'Typhlosion'],
    { kind: 'blast', names: ['Ascuas', 'Rueda Fuego', 'Erupción'], power: [220, 230, 245], radius: [1, 1, 2], status: S('burn', 3, { pct: 0.02 }) }],
  ['totodile', 2, ['agua'], 'atacante', ['totodile', 'croconaw', 'feraligatr'], ['Totodile', 'Croconaw', 'Feraligatr'],
    { kind: 'buff', names: ['Furia', 'Colmillo Hielo', 'Danza Dragón'], power: [0, 0, 0], atk: [0.35, 0.45, 0.6], as: [0.3, 0.4, 0.55], dur: 5, vamp: 0.25 }],
  ['chikorita', 2, ['planta'], 'soporte', ['chikorita', 'bayleef', 'meganium'], ['Chikorita', 'Bayleef', 'Meganium'],
    { kind: 'heal', names: ['Síntesis', 'Pantalla de Luz', 'Aromaterapia'], power: [170, 180, 190], radius: [2, 2, 3], cleanse: true },
    { st: { hp: 1.12, def: 1.3, range: 1 / 3 } }],
  ['mareep', 2, ['electrico'], 'tirador', ['mareep', 'flaaffy', 'ampharos'], ['Mareep', 'Flaaffy', 'Ampharos'],
    { kind: 'bolt', names: ['Onda Trueno', 'Chispazo', 'Electrocañón'], power: [200, 210, 220], status: S('para', 1.5) }],
  ['swinub', 2, ['hielo', 'tierra'], 'defensor', ['swinub', 'piloswine', 'mamoswine'], ['Swinub', 'Piloswine', 'Mamoswine'],
    { kind: 'nova', names: ['Nieve Polvo', 'Colmillo Hielo', 'Terratemblor'], power: [120, 130, 140], radius: [1, 1, 2], status: S('slow', 3, { pct: 0.35 }) }],
  ['cleffa', 2, ['hada'], 'soporte', ['cleffa', 'clefairy', 'clefable'], ['Cleffa', 'Clefairy', 'Clefable'],
    { kind: 'metronome', names: ['Encanto', 'Metrónomo', 'Metrónomo'], power: [170, 180, 190] },
    { formMoves: { cleffa: { kind: 'shield', name: 'Encanto', power: [170, 0, 0], targets: 'allies', radius: 2, dur: 4 } } }],
  ['eevee', 2, ['normal'], 'veloz', ['eevee', 'eevee-evo', 'eevee-evo'], ['Eevee', '—', '—'],
    { kind: 'dash', names: ['Ataque Rápido', '', ''], power: [200, 0, 0], target: 'low', phys: true },
    { eevee: true }],
  ['houndour', 2, ['fuego', 'siniestro'], 'atacante', ['houndour', 'houndoom', 'houndoom-mega'], ['Houndour', 'Houndoom', 'Mega-Houndoom'],
    { kind: 'beam', names: ['Ascuas', 'Lanzallamas', 'Pulso Umbrío'], power: [180, 190, 200], len: [2, 3, 4], status: S('burn', 3, { pct: 0.025 }) }],
  ['mankey', 2, ['lucha'], 'atacante', ['mankey', 'primeape', 'annihilape'], ['Mankey', 'Primeape', 'Annihilape'],
    { kind: 'buff', names: ['Golpes Furia', 'Enfado', 'Puño Furia'], power: [0, 0, 0], atk: [0.25, 0.3, 0.4], as: [0.5, 0.65, 0.85], dur: 6, stack: true },
    { formTypes: { annihilape: ['lucha', 'fantasma'] } }],
  ['trapinch', 2, ['tierra', 'dragon'], 'tirador', ['trapinch', 'vibrava', 'flygon'], ['Trapinch', 'Vibrava', 'Flygon'],
    { kind: 'blast', names: ['Bucle Arena', 'Dragoaliento', 'Tierra Viva'], power: [180, 190, 200], radius: [1, 1, 1], status: S('slow', 2.5, { pct: 0.3 }) }],
  ['sneasel', 2, ['siniestro', 'hielo'], 'veloz', ['sneasel', 'weavile', 'weavile'], ['Sneasel', 'Weavile', 'Weavile'],
    { kind: 'dash', names: ['Finta', 'Tajo Umbrío', 'Puño Hielo'], power: [220, 230, 240], target: 'far', phys: true, crit: true }],

  // ───────────── Coste 3 ─────────────
  ['ralts', 3, ['psiquico', 'hada'], 'mistico', ['ralts', 'kirlia', 'gardevoir'], ['Ralts', 'Kirlia', 'Gardevoir'],
    { kind: 'blast', names: ['Confusión', 'Psicorrayo', 'Fuerza Lunar'], power: [230, 240, 250], radius: [1, 1, 2] }],
  ['riolu', 3, ['lucha', 'acero'], 'atacante', ['riolu', 'lucario', 'lucario-mega'], ['Riolu', 'Lucario', 'Mega-Lucario'],
    { kind: 'bolt', names: ['Palmeo', 'Esfera Aural', 'Esfera Aural'], power: [260, 270, 290], target: 'low', proj: true }],
  ['froakie', 3, ['agua', 'siniestro'], 'veloz', ['froakie', 'frogadier', 'greninja'], ['Froakie', 'Frogadier', 'Greninja'],
    { kind: 'multi', names: ['Burbuja', 'Shuriken de Agua', 'Shuriken de Agua'], power: [95, 100, 105], hits: [3, 4, 6] }],
  ['magnemite', 3, ['electrico', 'acero'], 'tirador', ['magnemite', 'magneton', 'magnezone'], ['Magnemite', 'Magneton', 'Magnezone'],
    { kind: 'beam', names: ['Impactrueno', 'Bomba Imán', 'Electrocañón'], power: [200, 210, 220], len: [4, 5, 6], status: S('para', 1) }],
  ['scyther', 3, ['volador', 'acero'], 'veloz', ['scyther', 'scizor', 'scizor-mega'], ['Scyther', 'Scizor', 'Mega-Scizor'],
    { kind: 'dash', names: ['Corte Furia', 'Puño Bala', 'Puño Bala'], power: [240, 250, 270], target: 'low', phys: true, crit: true }],
  ['snorunt', 3, ['hielo', 'fantasma'], 'mistico', ['snorunt', 'froslass', 'froslass'], ['Snorunt', 'Froslass', 'Froslass'],
    { kind: 'blast', names: ['Viento Hielo', 'Ventisca', 'Ventisca'], power: [210, 220, 230], radius: [1, 1, 2], status: S('freeze', 1.2) }],
  ['duskull', 3, ['fantasma'], 'defensor', ['duskull', 'dusclops', 'dusknoir'], ['Duskull', 'Dusclops', 'Dusknoir'],
    { kind: 'nova', names: ['Rayo Confuso', 'Tinieblas', 'Puño Sombra'], power: [120, 130, 140], radius: [1, 1, 2], status: S('confuse', 2.5), selfShield: [250, 260, 280] }],
  ['munchlax', 3, ['normal'], 'defensor', ['munchlax', 'snorlax', 'snorlax-gmax'], ['Munchlax', 'Snorlax', 'Snorlax Gigamax'],
    { kind: 'rest', names: ['Engullir', 'Descanso', 'Descanso G-Max'], power: [0, 0, 0], heal: [0.45, 0.6, 0.8], sleep: [1.5, 2, 1.5], allyHeal: [0, 0, 0.25] },
    { st: { hp: 1.25, as: 0.85 } }],
  ['growlithe', 3, ['fuego'], 'atacante', ['growlithe', 'arcanine', 'arcanine'], ['Growlithe', 'Arcanine', 'Arcanine'],
    { kind: 'dash', names: ['Colmillo Ígneo', 'Velocidad Extrema', 'Envite Ígneo'], power: [270, 280, 300], target: 'current', landRadius: 1, phys: true, status: S('burn', 3, { pct: 0.02 }) },
    { st: { hp: 1.1 } }],
  ['treecko', 3, ['planta'], 'veloz', ['treecko', 'grovyle', 'sceptile'], ['Treecko', 'Grovyle', 'Sceptile'],
    { kind: 'beam', names: ['Hoja Afilada', 'Hoja Aguda', 'Lluevehojas'], power: [220, 230, 240], len: [3, 4, 5], phys: true }],
  ['snover', 3, ['planta', 'hielo'], 'defensor', ['snover', 'abomasnow', 'abomasnow-mega'], ['Snover', 'Abomasnow', 'Mega-Abomasnow'],
    { kind: 'nova', names: ['Nieve Polvo', 'Ventisca', 'Ventisca'], power: [130, 140, 150], radius: [1, 2, 2], status: S('freeze', 1) }],
  ['rhyhorn', 3, ['tierra', 'roca'], 'defensor', ['rhyhorn', 'rhydon', 'rhyperior'], ['Rhyhorn', 'Rhydon', 'Rhyperior'],
    { kind: 'dash', names: ['Placaje', 'Taladradora', 'Romperrocas'], power: [170, 180, 200], target: 'current', landRadius: 1, status: S('flinch', 1.2), phys: true }],
  ['aerodactyl', 3, ['roca', 'volador'], 'tirador', ['aerodactyl', 'aerodactyl', 'aerodactyl-mega'], ['Aerodactyl', 'Aerodactyl', 'Mega-Aerodactyl'],
    { kind: 'multi', names: ['Avalancha', 'Avalancha', 'Roca Afilada'], power: [110, 115, 120], hits: [3, 4, 6], status: S('flinch', 0.4) }],
  ['mimikyu', 3, ['fantasma', 'hada'], 'veloz', ['mimikyu', 'mimikyu', 'mimikyu'], ['Mimikyu', 'Mimikyu', 'Mimikyu'],
    { kind: 'dash', names: ['Garra Umbría', 'Carantoña', 'Carantoña'], power: [250, 260, 280], target: 'low', crit: true },
    { passive: 'disfraz' }],

  // ───────────── Coste 4 ─────────────
  ['dratini', 4, ['dragon', 'volador'], 'atacante', ['dratini', 'dragonair', 'dragonite'], ['Dratini', 'Dragonair', 'Dragonite'],
    { kind: 'blast', names: ['Dragoaliento', 'Pulso Dragón', 'Enfado'], power: [230, 240, 260], radius: [1, 1, 2], phys: true }],
  ['gible', 4, ['dragon', 'tierra'], 'veloz', ['gible', 'gabite', 'garchomp'], ['Gible', 'Gabite', 'Garchomp'],
    { kind: 'dash', names: ['Excavar', 'Garra Dragón', 'Terremoto'], power: [230, 240, 260], target: 'far', landRadius: 1, phys: true }],
  ['larvitar', 4, ['roca', 'siniestro'], 'defensor', ['larvitar', 'pupitar', 'tyranitar'], ['Larvitar', 'Pupitar', 'Tyranitar'],
    { kind: 'nova', names: ['Avalancha', 'Roca Afilada', 'Roca Afilada'], power: [150, 160, 170], radius: [1, 2, 2], status: S('flinch', 1.3), selfShield: [200, 220, 240] }],
  ['beldum', 4, ['acero', 'psiquico'], 'defensor', ['beldum', 'metang', 'metagross'], ['Beldum', 'Metang', 'Metagross'],
    { kind: 'dash', names: ['Derribo', 'Puño Meteoro', 'Puño Meteoro'], power: [190, 200, 220], target: 'current', landRadius: 1, phys: true, selfShield: [260, 280, 300], status: S('flinch', 0.8) }],
  ['lapras', 4, ['agua', 'hielo'], 'soporte', ['lapras', 'lapras', 'lapras-gmax'], ['Lapras', 'Lapras', 'Lapras Gigamax'],
    { kind: 'status', names: ['Canto', 'Canto', 'Canto G-Max'], power: [120, 130, 140], radius: [1, 1, 2], status: S('sleep', 2), allyHeal: 0.12 },
    { st: { hp: 1.15 } }],
  ['togepi', 4, ['hada', 'volador'], 'soporte', ['togepi', 'togetic', 'togekiss'], ['Togepi', 'Togetic', 'Togekiss'],
    { kind: 'heal', names: ['Metrónomo', 'Deseo', 'Deseo'], power: [0, 150, 160], all: true },
    { formMoves: { togepi: { kind: 'metronome', name: 'Metrónomo', power: [210, 0, 0] } } }],

  // ───────────── Coste 5 (Legendarios) ─────────────
  ['mewtwo', 5, ['psiquico'], 'mistico', ['mewtwo', 'mewtwo', 'mewtwo-mega'], ['Mewtwo', 'Mewtwo', 'Mega-Mewtwo Y'],
    { kind: 'blast', names: ['Onda Mental', 'Onda Mental', 'Onda Mental'], power: [300, 310, 330], radius: [2, 2, 2], status: S('confuse', 1.5) }],
  ['rayquaza', 5, ['dragon', 'volador'], 'atacante', ['rayquaza', 'rayquaza', 'rayquaza-mega'], ['Rayquaza', 'Rayquaza', 'Mega-Rayquaza'],
    { kind: 'beam', names: ['Ascenso Draco', 'Ascenso Draco', 'Ascenso Draco'], power: [330, 340, 360], len: [7, 7, 7], phys: true }],
  ['kyogre', 5, ['agua'], 'mistico', ['kyogre', 'kyogre', 'kyogre-primal'], ['Kyogre', 'Kyogre', 'Kyogre Primigenio'],
    { kind: 'global', names: ['Pulso Primigenio', 'Pulso Primigenio', 'Pulso Primigenio'], power: [170, 175, 185] },
    { mana: [100, 40] }],
  ['groudon', 5, ['tierra', 'fuego'], 'defensor', ['groudon', 'groudon', 'groudon-primal'], ['Groudon', 'Groudon', 'Groudon Primigenio'],
    { kind: 'nova', names: ['Filo del Abismo', 'Filo del Abismo', 'Filo del Abismo'], power: [200, 210, 220], radius: [2, 2, 3], status: S('flinch', 1.5), selfShield: [350, 360, 380] }],
  ['zapdos', 5, ['electrico', 'volador'], 'tirador', ['zapdos', 'zapdos', 'zapdos'], ['Zapdos', 'Zapdos', 'Zapdos'],
    { kind: 'chain', names: ['Trueno', 'Trueno', 'Trueno'], power: [230, 240, 260], bounces: [5, 6, 8], status: S('para', 0.8) }],
  ['articuno', 5, ['hielo', 'volador'], 'mistico', ['articuno', 'articuno', 'articuno'], ['Articuno', 'Articuno', 'Articuno'],
    { kind: 'global', names: ['Ventisca', 'Ventisca', 'Ventisca'], power: [140, 145, 150], status: S('freeze', 1.2) },
    { mana: [110, 40] }],
];

// Eeveeluciones: Eevee evoluciona según el tipo dominante de tu equipo.
export const EEVEE_BRANCH = {
  agua: 'vaporeon', electrico: 'jolteon', fuego: 'flareon', psiquico: 'espeon',
  siniestro: 'umbreon', planta: 'leafeon', hielo: 'glaceon', hada: 'sylveon',
};
const EEVEELUTIONS = {
  vaporeon: { name: 'Vaporeon', types: ['agua'], move: { kind: 'nova', name: 'Hidropulso', power: [0, 200, 210], radius: 1, selfShield: [0, 250, 270] }, st: { hp: 1.25 } },
  jolteon:  { name: 'Jolteon', types: ['electrico'], move: { kind: 'chain', name: 'Pin Misil', power: [0, 180, 190], bounces: [0, 4, 6], status: S('para', 0.6) }, st: { as: 1.15 } },
  flareon:  { name: 'Flareon', types: ['fuego'], move: { kind: 'dash', name: 'Envite Ígneo', power: [0, 300, 320], target: 'current', landRadius: 1, phys: true, status: S('burn', 3, { pct: 0.03 }) }, st: { atk: 1.2 } },
  espeon:   { name: 'Espeon', types: ['psiquico'], move: { kind: 'blast', name: 'Psíquico', power: [0, 260, 270], radius: 1 }, st: { range: 3 } },
  umbreon:  { name: 'Umbreon', types: ['siniestro'], move: { kind: 'drain', name: 'Juego Sucio', power: [0, 220, 230], heal: 1.0, healTarget: 'self' }, st: { hp: 1.2, def: 1.5, mdef: 1.5 } },
  leafeon:  { name: 'Leafeon', types: ['planta'], move: { kind: 'beam', name: 'Hoja Aguda', power: [0, 260, 280], len: 4, phys: true }, st: { atk: 1.1 } },
  glaceon:  { name: 'Glaceon', types: ['hielo'], move: { kind: 'blast', name: 'Ventisca', power: [0, 230, 240], radius: 1, status: S('freeze', 1.2) }, st: { range: 3 } },
  sylveon:  { name: 'Sylveon', types: ['hada'], move: { kind: 'heal', name: 'Voz Cautivadora', power: [0, 200, 220], all: true }, st: { range: 3 } },
};

export const LINES = {};
export const FORMS = {};

function buildMove(line, raw, stageIdx, override) {
  const m = { ...raw, ...(override || {}) };
  const pick = (v) => (Array.isArray(v) ? v : [v, v, v]);
  const out = {
    kind: m.kind,
    name: override?.name || (m.names ? m.names[stageIdx] : m.name),
    type: m.type || line.types[0],
    phys: !!m.phys,
  };
  for (const k of ['power', 'radius', 'len', 'hits', 'bounces', 'heal', 'selfShield', 'atk', 'as', 'gold', 'sleep', 'allyHeal']) {
    if (m[k] !== undefined) out[k] = pick(m[k]);
  }
  for (const k of ['status', 'target', 'same', 'healTarget', 'landRadius', 'crit', 'dur', 'vamp', 'stack', 'targets', 'all', 'cleanse', 'proj']) {
    if (m[k] !== undefined) out[k] = m[k];
  }
  return out;
}

for (const [id, cost, types, role, forms, names, move, extra = {}] of LINES_RAW) {
  const line = { id, cost, types, role, forms, extra, stats: { ...ROLE_STATS[role] } };
  if (extra.st) for (const [k, v] of Object.entries(extra.st)) line.stats[k] = line.stats[k] * v;
  if (extra.mana) { line.stats.mana = extra.mana[0]; line.stats.mana0 = extra.mana[1]; }
  line.stats.range = Math.max(1, Math.round(line.stats.range));
  LINES[id] = line;
  forms.forEach((fid, i) => {
    if (fid === 'eevee-evo') return;
    const ftypes = extra.formTypes?.[fid] || types;
    if (!FORMS[fid]) {
      FORMS[fid] = {
        id: fid, line: id, stage: i, name: names[i], types: ftypes, role, cost,
        st: extra.formStats?.[fid] || null,
        passive: extra.passive || null,
        moves: {},
      };
    }
    FORMS[fid].moves[i + 1] = buildMove({ types: ftypes }, move, i, extra.formMoves?.[fid]);
  });
}
for (const [fid, e] of Object.entries(EEVEELUTIONS)) {
  FORMS[fid] = {
    id: fid, line: 'eevee', stage: 1, name: e.name, types: e.types, role: 'veloz', cost: 2,
    st: e.st, passive: null, eeveelution: true,
    moves: { 2: buildMove({ types: e.types }, e.move, 1), 3: buildMove({ types: e.types }, e.move, 2) },
  };
}

// Movimiento de una forma a cierta estrella.
export function moveOf(form, star) {
  if (typeof form === 'string') form = FORMS[form];
  return form.moves[star] || form.moves[Object.keys(form.moves)[0]];
}

export const LINE_LIST = Object.values(LINES);
export const LINES_BY_COST = { 1: [], 2: [], 3: [], 4: [], 5: [] };
for (const l of LINE_LIST) LINES_BY_COST[l.cost].push(l.id);

// Forma correspondiente a una estrella (1..3) en una línea.
export function formFor(lineId, star, chosen) {
  const line = LINES[lineId];
  if (lineId === 'eevee' && star >= 2) return chosen && FORMS[chosen] ? chosen : 'vaporeon';
  return line.forms[star - 1];
}

// Tamaño visual por estrella (las formas repetidas crecen).
export function formScale(lineId, star) {
  const line = LINES[lineId];
  const f = line.forms;
  let s = 1;
  if (star >= 2 && f[star - 1] === f[star - 2]) s = 1.18;
  if (star === 3 && f[2] === f[0]) s = 1.32;
  return s;
}

// Estadísticas base de una unidad (sin objetos ni sinergias).
export function baseStats(lineId, formId, star) {
  const line = LINES[lineId];
  const form = FORMS[formId];
  const cm = COST_MUL[line.cost];
  const sm = STAR_MUL[star - 1];
  const st = { ...line.stats };
  if (form?.st) for (const [k, v] of Object.entries(form.st)) st[k] = st[k] * v;
  return {
    hp: Math.round(st.hp * cm * sm),
    atk: Math.round(st.atk * cm * sm),
    as: +st.as.toFixed(2),
    def: Math.round(st.def),
    mdef: Math.round(st.mdef),
    range: Math.max(1, Math.round(st.range)),
    mana: st.mana,
    mana0: st.mana0,
    ap: 100,
    crit: 0.25,
    critDmg: 1.4,
  };
}

export function movePower(form, star, m = moveOf(form, star)) {
  if (!m.power) return 0;
  const cm = COST_MUL[form.cost];
  // Para líneas de formas distintas, la potencia ya refleja la evolución por POWER_STAR.
  const base = m.power[star - 1] || m.power.find((p) => p > 0) || 0;
  return Math.round(base * cm * POWER_STAR[star - 1]);
}

const STATUS_TXT = {
  burn: 'quema', sleep: 'duerme', para: 'paraliza', freeze: 'congela', confuse: 'confunde',
  slow: 'ralentiza', flinch: 'aturde', poison: 'envenena',
};

// Descripción legible del movimiento.
export function moveDesc(form, star) {
  const m = moveOf(form, star);
  const p = movePower(form, star, m);
  const i = star - 1;
  const dmg = m.phys ? 'daño físico' : 'daño especial';
  const st = m.status ? `, ${STATUS_TXT[m.status.kind]}${m.status.dur ? ` (${m.status.dur}s)` : ''}` : '';
  const sh = m.selfShield ? ` y gana un escudo de ${Math.round(m.selfShield[i] * COST_MUL[form.cost])}` : '';
  switch (m.kind) {
    case 'blast': return m.radius[i] > 0
      ? `Inflige ${p} de ${dmg} al objetivo y alrededor (radio ${m.radius[i]})${st}.`
      : `Inflige ${p} de ${dmg} al objetivo${st}.`;
    case 'bolt': return `Lanza un ataque que inflige ${p} de ${dmg}${m.target === 'low' ? ' al enemigo más débil' : ''}${st}.`;
    case 'beam': return `Rayo en línea de ${m.len[i]} casillas: ${p} de ${dmg}${st}.`;
    case 'nova': return `Onda alrededor (radio ${m.radius[i]}): ${p} de ${dmg}${st}${sh}.`;
    case 'dash': return `Salta ${m.target === 'far' ? 'a la retaguardia enemiga' : m.target === 'low' ? 'al enemigo más débil' : 'contra su objetivo'} e inflige ${p} de ${dmg}${m.landRadius ? ' en área' : ''}${st}${sh}.`;
    case 'multi': return `Golpea ${m.hits[i]} veces${m.same ? ' a su objetivo' : ' a enemigos al azar'} (${p} de ${dmg} cada golpe)${st}.`;
    case 'chain': return `Descarga que salta entre ${m.bounces[i]} enemigos: ${p} de ${dmg}${st}.`;
    case 'drain': return `Absorbe ${p} de PS del objetivo y cura ${m.healTarget === 'ally' ? 'al aliado más herido' : 'a sí mismo'}.`;
    case 'heal': return m.all ? `Cura ${p} PS a todo el equipo.` : `Cura ${p} PS a los aliados cercanos (radio ${m.radius[i]})${m.cleanse ? ' y elimina estados' : ''}.`;
    case 'shield': return `Da un escudo de ${p} a los aliados cercanos.`;
    case 'buff': return `Se potencia ${m.dur}s: +${Math.round(m.atk[i] * 100)}% Atq y +${Math.round(m.as[i] * 100)}% vel. ataque${m.vamp ? ', con robo de vida' : ''}${m.stack ? ' (acumulable)' : ''}.`;
    case 'status': return `Canta: duerme a los enemigos en radio ${m.radius[i]} alrededor del objetivo (${p} de daño) y cura a los aliados.`;
    case 'splash': return '¡Salpica! ...pero no pasa nada. (¡Evoluciónalo!)';
    case 'payday': return `Lanza monedas: ${p} de daño; ${Math.round(m.gold[i] * 100)}% de soltar 1 de oro (máx. 3 por combate).`;
    case 'global': return `Golpea a TODOS los enemigos: ${p} de ${dmg}${st}.`;
    case 'rest': return `Se echa a dormir ${m.sleep[i]}s y recupera ${Math.round(m.heal[i] * 100)}% de sus PS${m.allyHeal[i] ? ' (y cura al equipo)' : ''}.`;
    case 'teleport': return `Se teletransporta a una esquina segura y gana un escudo de ${p}.`;
    case 'metronome': return '¡Metrónomo! Usa un movimiento aleatorio de cualquier Pokémon.';
    default: return '';
  }
}

export function typesOf(formId) { return FORMS[formId]?.types || []; }
export function traitsOfForm(formId) {
  const f = FORMS[formId];
  return f ? [...f.types, f.role] : [];
}

export { TYPES, ROLES };
