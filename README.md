# ⚡ PokéTactics 3D

**Auto-battler multijugador estilo _Teamfight Tactics_ reimaginado con Pokémon, en 3D cel-shading y para navegador.**

Recluta Pokémon en la tienda, colócalos en el tablero hexagonal, combina tres copias para **evolucionarlos** y
sobrevive a los combates automáticos contra otros 7 entrenadores (personas o bots). El último en pie es el Campeón.

> Proyecto fan sin ánimo de lucro. Pokémon y sus personajes son marcas de Nintendo, Game Freak y Creatures.
> Todos los modelos 3D se generan proceduralmente a partir de primitivas; no se usa ningún recurso oficial.

---

## 🚀 Cómo jugar

```bash
npm install      # instala three.js y ws (y copia three.js a public/vendor)
npm start        # servidor en http://localhost:3000
```

- **Jugar contra bots**: funciona incluso sin servidor (la partida se simula en el navegador).
- **Multijugador**: crea una sala, comparte el código de 5 letras (o el enlace `?sala=CODIGO`) y pulsa *Empezar*.
  Los huecos libres se rellenan con bots. Si te desconectas, un bot juega por ti hasta que vuelvas.

Puerto configurable con `PORT=8080 npm start`.

### Controles

| Acción | Cómo |
| --- | --- |
| Comprar | Clic en una carta de la tienda (o teclas **1-5**) |
| Mover | Arrastra un Pokémon entre banquillo y tablero |
| Vender | Arrástralo sobre la tienda, o **E** con el ratón encima |
| Actualizar tienda | **D** |
| Subir nivel | **F** |
| Listo (acelera la ronda) | **W** |
| Dinamax | **Espacio** y clic en tu Pokémon |
| Equipar objeto | Arrástralo del panel de objetos a un Pokémon |
| Mover a tu entrenador | **Clic derecho** en el suelo (en móvil, toca el suelo) |
| Espiar a un rival | Clic en su nombre (Esc para volver) |
| Chat / emotes | **Enter** / botón 😄 |
| Música on/off | Clic derecho en 🔊 |

---

## 🆕 Qué tiene que TFT no tiene

| Novedad | Descripción |
| --- | --- |
| ✨ **Evoluciones reales** | 3 Charmander → Charmeleon, 3 Charmeleon → Charizard, con animación de evolución de los juegos. Las líneas de 2 etapas terminan en **Mega** o **Gigamax**; los legendarios suben de estrellas. |
| 🔥 **Tabla de tipos** | Además de sinergias, cada golpe aplica efectividad de tipo: _¡Es súper eficaz!_ Posicionar contra el rival importa. |
| 🌦️ **Clima dinámico** | Cada etapa tiene un clima (Sol, Lluvia, Arena, Nevada, Campo de Niebla, Campo Eléctrico) con efectos y **pronóstico** de la siguiente. Se ve en 3D: lluvia, nieve, arena, relámpagos… |
| 🎯 **Capturas** | Tras vencer a Pokémon salvajes aparece uno para capturar con un minijuego de Poké Ball (pulsa cuando el anillo es pequeño). |
| 🔴 **Dinamax en directo** | La única acción **durante** el combate: carga el Dinamax y elige qué Pokémon se vuelve gigante (más PS, ataques en área, inmune a control). |
| 🏅 **Medallas de gimnasio** | Aumentos temáticos al inicio de las etapas 2, 3 y 4 (Medalla Roca, Amuleto Iris, Ultra Ball, Mochila Grande…). |
| 🏟️ **Gimnasios, Alto Mando e Incursiones** | Las rondas PvE son contra líderes (Brock, Misty, Lt. Surge…), el Alto Mando y, al final, una **Incursión Dinamax** contra un legendario gigante que puedes conseguir. |
| 🦁 **Zona Safari** | Carrusel compartido como en TFT: los entrenadores salen por tandas (menos vida primero) y corren a **agarrar** el Pokémon que quieran mientras gira. Haz clic en uno para perseguirlo. |
| 🚶 **Entrenador controlable** | Tu compañero camina por la isla (clic derecho) y recoge las **Poké Balls de botín** que caen tras vencer a los salvajes, gimnasios e incursiones. Los rivales lo ven si te espían. |
| 🌟 **Shinies** | 1/40 de probabilidad en la tienda: colores alternativos, brillos y +15 % de estadísticas. Las evoluciones heredan el shiny. |
| 🦊 **Eevee** | Evoluciona en la Eeveelución de tu **tipo dominante** (Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon o Sylveon). Cada evolución distinta cuenta por separado en las sinergias. |
| 🐟 **Magikarp** | Cuesta 1 y solo usa Salpicadura… _¡pero no pasa nada!_ Hasta que evoluciona a un Gyarados de nivel legendario. |
| 🪙 **Día de Pago** | Meowth genera oro al usar su habilidad. |
| 🎵 **Metrónomo** | Clefairy y Togepi usan un movimiento aleatorio de cualquier Pokémon. |
| 🎭 **Pasivas únicas** | Mimikyu bloquea el primer golpe con su Disfraz; Snorlax se echa a dormir para curarse; Abra solo sabe Teletransporte. |
| 💞 **Amistad** | Los Pokémon que combaten 5 rondas contigo ganan +10 % de estadísticas. |
| 📕 **Pokédex** | Registrar especies distintas da premios (oro, objetos, Caramelos Raros). |
| 📰 **Noticias del Profesor** | Evento aleatorio por etapa: Enjambres de un tipo, Rebajas, Fiebre Shiny, Reparto de caramelos… |
| 🍬 **Caramelo Raro** | Consumible que te da otra copia de un Pokémon para acelerar su evolución. |
| ✅ **Botón "Listo"** | Si todos los humanos están listos, la ronda avanza sin esperar el temporizador. |
| 🪄 **Auto-colocar** | Rellena tu tablero con los mejores Pokémon del banquillo en un clic. |
| 📊 **Resumen de daño** | Tras cada combate ves qué Pokémon ha hecho más daño. |
| 🗣️ **Emotes y chat** | Tu entrenador reacciona a victorias y emotes. |

---

## 🧩 Contenido

- **49 líneas evolutivas / 138 formas** modeladas proceduralmente (Charmander, Pikachu, Gengar, Lucario, Garchomp,
  Tyranitar, Mewtwo, Rayquaza, Kyogre, Groudon, Zapdos, Articuno, las 8 Eeveeluciones…).
- **16 tipos + 6 roles** (Defensor, Atacante, Veloz, Tirador, Místico, Soporte) con 2-3 niveles de bonus.
- **7 componentes (vitaminas) y 28 objetos** combinados con nombres de objetos Pokémon: Cinta Elegida, Vidasfera,
  Restos, Banda Focus, Casco Dentado, Cristal Z, Bola Luminosa (¡doble poder para la línea de Pikachu!)…
- **20 medallas**, **7 climas**, **7 eventos**, 6 líderes de gimnasio y 3 miembros del Alto Mando.
- Economía de TFT: interés, rachas, niveles, probabilidades de tienda por nivel y reserva compartida de copias.

---

## 🏗️ Arquitectura

Sin bundler: módulos ES nativos y `importmap`.

```
server/server.js          HTTP estático + WebSocket (salas, reconexión, bucle a 20 ticks/s)
public/
  index.html, css/        interfaz
  js/game/                lógica compartida servidor/navegador (autoritativa)
    room.js               fases, rondas, tienda, economía, evoluciones, safari, capturas
    combat.js             simulación de combate en tiempo real con semilla
    bot.js                IA de los entrenadores bot
    hex.js, traits.js     rejilla hexagonal y sinergias
    data/                 Pokémon, tipos, objetos, clima, medallas…
  js/client/              render y UI (three.js)
    engine.js             renderer, materiales toon + contorno en espacio de pantalla
    models.js, specs.js   constructor procedural de Pokémon y sus especificaciones
    arena.js, fx.js       escenario, clima, partículas y efectos
    units.js, game.js     vistas de unidades, entrada, combate en vivo
    trainer.js            entrenador controlable y Poké Balls de botín
    icons.js              iconos SVG de la interfaz
    ui.js, audio.js       HUD y sonido/música sintetizados (WebAudio)
scripts/
  sim-test.js             simula partidas completas de 8 bots (npm run sim)
  play-test.mjs, shot.mjs pruebas visuales con Playwright
  carousel-test.mjs       carrusel, entrenador caminando y botín
  mp-test.mjs             dos navegadores en la misma sala (y reconexión)
```

- El servidor es **autoritativo**: los clientes solo envían intenciones (comprar, mover, Dinamax…) y reciben estado
  y eventos del combate, que se reproducen con interpolación y efectos.
- El mismo `GameRoom` corre en el navegador para el modo solitario (`LocalTransport`), así que el juego funciona
  también como sitio estático.
- Escenario: isla con acantilados facetados, playa, estadio de piedra con farolillos y estandartes que ondean,
  Centro Pokémon, estanque, pinos, árboles frutales, arbustos con bayas, vallas y hierba instanciada. Casi todo
  el decorado se fusiona en unas pocas mallas con colores por vértice.
- Interfaz sin emojis: iconos SVG propios (`public/js/client/icons.js`) para tipos, roles, clima, objetos,
  medallas y botones, y fuente Fredoka incluida en el proyecto (`@fontsource/fredoka`).
- Estética **cel-shading**: `MeshToonMaterial` con rampa de 4 tonos, borde de luz (rim light) y contornos por
  extrusión de normales en espacio de pantalla (grosor constante en píxeles). Cada Pokémon se fusiona en pocas
  geometrías con colores por vértice para que dibujar 20+ criaturas sea barato.

### Probar el equilibrio y la interfaz

```bash
npm run sim -- 5   # 5 partidas completas de 8 bots, sin navegador
```

Para desarrollo, `?auto=solo` arranca una partida directamente y `?auto=solo&debug=1` habilita el mensaje
`cheat` (solo en la partida local del navegador) que usan los scripts de Playwright de `scripts/` para saltar
etapas, dar oro o Pokémon y probar evoluciones, incursiones y el final de partida.
