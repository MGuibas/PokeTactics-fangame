// Simula partidas completas entre 8 bots para comprobar estabilidad y equilibrio.
import { GameRoom } from '../public/js/game/room.js';
import { FORMS } from '../public/js/game/data/pokemon.js';

const games = +(process.argv[2] || 3);
const winsByTrait = {};
const lengths = [];
const combatTimes = [];
let draws = 0, fights = 0;
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const room = new GameRoom({ seed: 1000 + g * 7919, options: { fast: true }, send: (pid, msg) => {
    if (msg.t === 'ce') { fights++; if (msg.winner === -1) draws++; }
  } });
  for (let i = 0; i < 8; i++) room.addPlayer({ id: 'b' + i, name: 'Bot' + i, isBot: true });
  room.start();
  let ticks = 0;
  let lastPhase = '';
  while (room.phase !== 'ended' && ticks < 400000) {
    room.tick(50);
    ticks++;
    if (room.phase === 'combat') {
      for (const e of room.combats.values()) if (e.combat.done && !e._logged) { e._logged = true; combatTimes.push(e.combat.result.time); }
    }
  }
  const winner = room.players.find((p) => p.place === 1);
  lengths.push(`${room.stage}-${room.round}`);
  console.log(`Partida ${g + 1}: ganador ${winner?.name} (nivel ${winner?.level}, ${winner?.hp} PS) en ${room.stage}-${room.round}, ticks ${ticks}`);
  if (winner) console.log('   equipo:', winner.board.map((u) => `${FORMS[u.form].name}${'★'.repeat(u.star)}${u.shiny ? '✨' : ''}[${u.items.join(',')}]`).join(' '));
  for (const p of room.players) {
    console.log(`   ${p.place}º ${p.name} lv${p.level} evol:${p.stats.evolutions} capt:${p.stats.captured} badges:${p.badges.join(',')} prefs:${p.brain?.prefs}`);
  }
}
const avg = combatTimes.reduce((a, b) => a + b, 0) / combatTimes.length;
console.log(`\nDuración media de combate: ${(avg / 1000).toFixed(1)}s; empates ${draws}/${fights}; tiempo real ${(Date.now() - t0) / 1000}s`);
