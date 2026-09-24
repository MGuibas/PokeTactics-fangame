// Personalidad de cada línea: número de Pokédex, texto de ambiente, manía en reposo y estilo de ataque básico.
// quirk.act: animación en reposo (hop, spin, shake, flex, nap, blink, flop, roar, dance, look, float)
// quirk.fx: partículas que acompañan (flame, spark, bubble, leaf, snow, shadow, sparkle, dust, coin, psy, wind, steam, note, heart)
// shot: forma del proyectil de su ataque básico a distancia.

export const LORE = {
  charmander: { dex: [4, 5, 6], nature: 'Temperamental', flavor: 'La llama de su cola delata su humor: crece cuando se emociona y chisporrotea cuando se enfada.', quirk: { act: 'flex', fx: 'flame', txt: 'Aviva la llama de su cola' }, shot: 'flame' },
  squirtle: { dex: [7, 8, 9], nature: 'Firme', flavor: 'Se esconde en su caparazón al menor peligro, pero sale disparando agua a presión en cuanto ve un hueco.', quirk: { act: 'hop', fx: 'bubble', txt: 'Suelta pompas de agua' }, shot: 'bubble' },
  bulbasaur: { dex: [1, 2, 3], nature: 'Tranquilo', flavor: 'Toma el sol a ratos para cargar el bulbo de su espalda. Cuanta más luz, más generoso con sus aliados.', quirk: { act: 'look', fx: 'leaf', txt: 'Se estira hacia el sol' }, shot: 'leaf' },
  pichu: { dex: [172, 25, 26], nature: 'Juguetón', flavor: 'Acumula electricidad en las mejillas; cuando se pone nervioso se le escapan chispas sin querer.', quirk: { act: 'hop', fx: 'spark', txt: 'Chispas en las mejillas' }, shot: 'spark' },
  machop: { dex: [66, 67, 68], nature: 'Disciplinado', flavor: 'Entrena sin descanso entre combate y combate. Presume de músculos ante cualquiera que le mire.', quirk: { act: 'flex', fx: 'dust', txt: 'Saca músculo' }, shot: 'fist' },
  geodude: { dex: [74, 75, 76], nature: 'Terco', flavor: 'Rueda colina abajo cuando tiene prisa. Su cuerpo de roca aguanta golpes que tumbarían a cualquiera.', quirk: { act: 'shake', fx: 'dust', txt: 'Se sacude el polvo' }, shot: 'rock' },
  pidgey: { dex: [16, 17, 18], nature: 'Vigilante', flavor: 'Otea el campo de batalla desde lo alto y levanta ráfagas de viento con un solo aleteo.', quirk: { act: 'look', fx: 'wind', txt: 'Vigila el cielo' }, shot: 'wind' },
  gastly: { dex: [92, 93, 94], nature: 'Bromista', flavor: 'Adora asustar a los rivales apareciendo de golpe. Se ríe solo en los rincones oscuros.', quirk: { act: 'blink', fx: 'shadow', txt: 'Se desvanece y reaparece' }, shot: 'shadow' },
  magikarp: { dex: [129, 130, 130], nature: 'Incomprendido', flavor: 'Todos se ríen de sus saltos inútiles… hasta el día en que evoluciona y ya nadie se atreve a reír.', quirk: { act: 'flop', fx: 'bubble', txt: '¡Salpica sin parar!' }, shot: 'bubble' },
  poliwag: { dex: [60, 61, 62], nature: 'Hipnótico', flavor: 'La espiral de su barriga marea a quien la mira fijamente. Nada con una energía incansable.', quirk: { act: 'spin', fx: 'bubble', txt: 'Gira su espiral' }, shot: 'bubble' },
  meowth: { dex: [52, 53, 52], nature: 'Codicioso', flavor: 'No puede resistirse a nada que brille. Si hay una moneda cerca, la encontrará.', quirk: { act: 'look', fx: 'coin', txt: 'Busca monedas' }, shot: 'coin' },
  abra: { dex: [63, 64, 65], nature: 'Dormilón', flavor: 'Duerme casi todo el día, pero se teletransporta antes de que puedas tocarlo.', quirk: { act: 'nap', fx: 'psy', txt: 'Echa una cabezada' }, shot: 'psy' },
  cyndaquil: { dex: [155, 156, 157], nature: 'Tímido', flavor: 'Parece asustadizo, pero las llamas de su lomo estallan en cuanto alguien le provoca.', quirk: { act: 'shake', fx: 'flame', txt: 'Enciende su lomo' }, shot: 'flame' },
  totodile: { dex: [158, 159, 160], nature: 'Travieso', flavor: 'Muerde todo lo que se mueve, a veces por hambre y a veces solo por diversión.', quirk: { act: 'dance', fx: 'bubble', txt: 'Baila y chasquea las fauces' }, shot: 'bubble' },
  chikorita: { dex: [152, 153, 154], nature: 'Cariñoso', flavor: 'La hoja de su cabeza desprende un aroma dulce que calma a los aliados heridos.', quirk: { act: 'spin', fx: 'leaf', txt: 'Agita su hoja' }, shot: 'leaf' },
  mareep: { dex: [179, 180, 181], nature: 'Afable', flavor: 'Su lana se carga de electricidad estática. Los días secos se le eriza entera.', quirk: { act: 'shake', fx: 'spark', txt: 'Se carga de estática' }, shot: 'spark' },
  swinub: { dex: [220, 221, 473], nature: 'Glotón', flavor: 'Hurga en el suelo helado buscando comida y no levanta el hocico ni en pleno combate.', quirk: { act: 'look', fx: 'snow', txt: 'Hurga en la nieve' }, shot: 'ice' },
  cleffa: { dex: [173, 35, 36], nature: 'Soñador', flavor: 'Baila a la luz de la luna. Dicen que trae suerte a quien lo ve girar.', quirk: { act: 'dance', fx: 'sparkle', txt: 'Baila bajo las estrellas' }, shot: 'star' },
  eevee: { dex: [133, 133, 133], nature: 'Adaptable', flavor: 'Su código genético es inestable: el entorno de su equipo decide en qué evolucionará.', quirk: { act: 'hop', fx: 'heart', txt: 'Mueve la cola contento' }, shot: 'star' },
  houndour: { dex: [228, 229, 229], nature: 'Leal', flavor: 'Caza en manada y se comunica con aullidos. Su aliento huele a azufre.', quirk: { act: 'roar', fx: 'flame', txt: 'Aúlla a la luna' }, shot: 'flame' },
  mankey: { dex: [56, 57, 979], nature: 'Irascible', flavor: 'Se enfada por cualquier cosa, y cuando se enfada no hay quien lo pare.', quirk: { act: 'shake', fx: 'dust', txt: 'Patalea de rabia' }, shot: 'fist' },
  trapinch: { dex: [328, 329, 330], nature: 'Paciente', flavor: 'Espera inmóvil en su trampa de arena. Cuando evoluciona, sus alas levantan tormentas de polvo.', quirk: { act: 'look', fx: 'dust', txt: 'Excava en la arena' }, shot: 'rock' },
  sneasel: { dex: [215, 461, 461], nature: 'Astuto', flavor: 'Ataca por sorpresa con sus garras heladas y desaparece antes de que reacciones.', quirk: { act: 'blink', fx: 'snow', txt: 'Afila sus garras' }, shot: 'ice' },
  ralts: { dex: [280, 281, 282], nature: 'Empático', flavor: 'Percibe las emociones de su entrenador y lucha con más fuerza cuando este está contento.', quirk: { act: 'float', fx: 'psy', txt: 'Siente tus emociones' }, shot: 'psy' },
  riolu: { dex: [447, 448, 448], nature: 'Valiente', flavor: 'Lee el aura de los demás para adivinar su siguiente movimiento.', quirk: { act: 'flex', fx: 'psy', txt: 'Concentra su aura' }, shot: 'aura' },
  froakie: { dex: [656, 657, 658], nature: 'Sigiloso', flavor: 'Se mueve como un ninja y lanza estrellas de agua afiladas desde las sombras.', quirk: { act: 'hop', fx: 'bubble', txt: 'Salta como un ninja' }, shot: 'shuriken' },
  magnemite: { dex: [81, 82, 462], nature: 'Metódico', flavor: 'Flota gracias al magnetismo y zumba cuando detecta electricidad cerca.', quirk: { act: 'spin', fx: 'spark', txt: 'Gira sus imanes' }, shot: 'spark' },
  scyther: { dex: [123, 212, 212], nature: 'Orgulloso', flavor: 'Sus cuchillas cortan el aire tan rápido que apenas se ven.', quirk: { act: 'flex', fx: 'wind', txt: 'Afila sus guadañas' }, shot: 'blade' },
  snorunt: { dex: [361, 478, 478], nature: 'Misterioso', flavor: 'Aparece en las noches de nieve. Su mirada congela a quien se cruza con ella.', quirk: { act: 'float', fx: 'snow', txt: 'Deja caer copos' }, shot: 'ice' },
  duskull: { dex: [355, 356, 477], nature: 'Sombrío', flavor: 'Vaga en silencio y persigue a sus presas hasta el amanecer.', quirk: { act: 'float', fx: 'shadow', txt: 'Mira con su único ojo' }, shot: 'shadow' },
  munchlax: { dex: [446, 143, 143], nature: 'Perezoso', flavor: 'Come, duerme y vuelve a comer. Pero, ay de quien intente moverlo de su sitio.', quirk: { act: 'nap', fx: 'note', txt: 'Ronca tan tranquilo' }, shot: 'star' },
  growlithe: { dex: [58, 59, 59], nature: 'Fiel', flavor: 'Protege a su entrenador con uñas y dientes. Ladra a cualquier desconocido.', quirk: { act: 'hop', fx: 'flame', txt: 'Ladra animado' }, shot: 'flame' },
  treecko: { dex: [252, 253, 254], nature: 'Sereno', flavor: 'Mantiene la calma en cualquier situación y trepa por donde nadie puede.', quirk: { act: 'look', fx: 'leaf', txt: 'Mordisquea una ramita' }, shot: 'leaf' },
  snover: { dex: [459, 460, 460], nature: 'Hospitalario', flavor: 'Vive en montañas nevadas y ofrece sus bayas heladas a quien se pierde.', quirk: { act: 'shake', fx: 'snow', txt: 'Se sacude la nieve' }, shot: 'ice' },
  rhyhorn: { dex: [111, 112, 464], nature: 'Impulsivo', flavor: 'Embiste en línea recta sin pensar. A veces se olvida de por qué corría.', quirk: { act: 'roar', fx: 'dust', txt: 'Rasca el suelo' }, shot: 'rock' },
  aerodactyl: { dex: [142, 142, 142], nature: 'Salvaje', flavor: 'Un Pokémon prehistórico que surca el cielo con un chillido estremecedor.', quirk: { act: 'roar', fx: 'wind', txt: 'Chilla desde el cielo' }, shot: 'rock' },
  mimikyu: { dex: [778, 778, 778], nature: 'Solitario', flavor: 'Se cubre con un disfraz para parecer adorable y así hacer amigos. Nadie ha visto lo que hay debajo.', quirk: { act: 'shake', fx: 'shadow', txt: 'Se recoloca el disfraz' }, shot: 'shadow' },
  dratini: { dex: [147, 148, 149], nature: 'Noble', flavor: 'Mudó la piel tantas veces que ahora irradia un aura serena. Solo pelea para proteger.', quirk: { act: 'float', fx: 'sparkle', txt: 'Se enrosca con elegancia' }, shot: 'dragon' },
  gible: { dex: [443, 444, 445], nature: 'Impetuoso', flavor: 'Muerde todo lo que brilla. De mayor surca el cielo a la velocidad de un reactor.', quirk: { act: 'hop', fx: 'dust', txt: 'Muerde el aire' }, shot: 'dragon' },
  larvitar: { dex: [246, 247, 248], nature: 'Hambriento', flavor: 'Se come montañas enteras para crecer. Adulto, cambia la forma del paisaje al pelear.', quirk: { act: 'roar', fx: 'dust', txt: 'Mastica rocas' }, shot: 'rock' },
  beldum: { dex: [374, 375, 376], nature: 'Calculador', flavor: 'Sus cerebros de acero calculan cada golpe con precisión de superordenador.', quirk: { act: 'spin', fx: 'psy', txt: 'Calcula trayectorias' }, shot: 'steel' },
  lapras: { dex: [131, 131, 131], nature: 'Amable', flavor: 'Lleva a los viajeros por el mar mientras canta melodías que calman a cualquiera.', quirk: { act: 'look', fx: 'note', txt: 'Canta una melodía' }, shot: 'bubble' },
  togepi: { dex: [175, 176, 468], nature: 'Alegre', flavor: 'Reparte felicidad a quien lo cuida. Su cáscara está llena de buena suerte.', quirk: { act: 'dance', fx: 'heart', txt: 'Reparte alegría' }, shot: 'star' },
  mewtwo: { dex: [150, 150, 150], nature: 'Imponente', flavor: 'Creado para ser el más fuerte. Su mente puede doblar el mundo a su voluntad.', quirk: { act: 'float', fx: 'psy', txt: 'Levita con los ojos cerrados' }, shot: 'psy' },
  rayquaza: { dex: [384, 384, 384], nature: 'Soberano', flavor: 'Vive en la capa de ozono y baja a la tierra solo cuando dos titanes se enfrentan.', quirk: { act: 'roar', fx: 'wind', txt: 'Ruge a los cielos' }, shot: 'dragon' },
  kyogre: { dex: [382, 382, 382], nature: 'Colosal', flavor: 'Se dice que creó los océanos. Cuando despierta, trae lluvias torrenciales.', quirk: { act: 'float', fx: 'bubble', txt: 'Invoca la lluvia' }, shot: 'bubble' },
  groudon: { dex: [383, 383, 383], nature: 'Colosal', flavor: 'Se dice que alzó los continentes. Su calor evapora el agua a su alrededor.', quirk: { act: 'roar', fx: 'steam', txt: 'Hace temblar la tierra' }, shot: 'flame' },
  zapdos: { dex: [145, 145, 145], nature: 'Salvaje', flavor: 'Aparece entre nubes de tormenta, envuelto en relámpagos que ciegan.', quirk: { act: 'roar', fx: 'spark', txt: 'Crepita entre relámpagos' }, shot: 'spark' },
  articuno: { dex: [144, 144, 144], nature: 'Sereno', flavor: 'Su aleteo congela el aire y cubre de escarcha las montañas.', quirk: { act: 'float', fx: 'snow', txt: 'Deja una estela helada' }, shot: 'ice' },
};

// Eeveeluciones (estilo propio).
export const FORM_LORE = {
  vaporeon: { dex: 134, flavor: 'Se funde con el agua hasta volverse invisible.', fx: 'bubble', shot: 'bubble' },
  jolteon: { dex: 135, flavor: 'Su pelaje se eriza en agujas cargadas de electricidad.', fx: 'spark', shot: 'spark' },
  flareon: { dex: 136, flavor: 'Guarda en su interior un fuego que alcanza temperaturas enormes.', fx: 'flame', shot: 'flame' },
  espeon: { dex: 196, flavor: 'Predice los movimientos del rival leyendo las corrientes de aire.', fx: 'psy', shot: 'psy' },
  umbreon: { dex: 197, flavor: 'Sus anillos brillan en la oscuridad cuando se enfada.', fx: 'shadow', shot: 'shadow' },
  leafeon: { dex: 470, flavor: 'Hace la fotosíntesis como una planta y huele a hierba fresca.', fx: 'leaf', shot: 'leaf' },
  glaceon: { dex: 471, flavor: 'Congela su pelaje en afiladas agujas de hielo.', fx: 'snow', shot: 'ice' },
  sylveon: { dex: 700, flavor: 'Envuelve a sus amigos con sus lazos para calmarlos.', fx: 'heart', shot: 'star' },
};

// Número nacional de una forma (las Mega, Gigamax y Primigenias usan el de su especie).
export function dexOf(formId, lineId, star = 1) {
  if (FORM_LORE[formId]) return FORM_LORE[formId].dex;
  const l = LORE[lineId];
  return l ? l.dex[Math.max(0, Math.min(2, star - 1))] : 0;
}

export function loreOf(lineId, formId) {
  const base = LORE[lineId] || { nature: '', flavor: '', quirk: { act: 'hop', fx: null, txt: '' }, shot: 'orb' };
  const f = FORM_LORE[formId];
  if (!f) return base;
  return { ...base, flavor: f.flavor, quirk: { ...base.quirk, fx: f.fx }, shot: f.shot };
}
