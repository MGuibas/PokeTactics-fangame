// Ajustes: calidad gráfica, volúmenes y audio propio.
import { QUALITIES } from './engine.js';
import { sfx } from './audio.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);

export function openSettings(engine, onClose) {
  const m = $('modal');
  const c = sfx.counts();
  const slider = (id, label, v) => `<label class="set-row"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(v * 100)}" data-vol="${id}"/><b>${Math.round(v * 100)}</b></label>`;
  m.innerHTML = `<div class="modal-box settings">
    <h2>${icon('gear')}Ajustes</h2>
    <h3 class="mh3">Calidad gráfica</h3>
    <div class="q-opts">${Object.entries(QUALITIES).map(([id, q]) => `<button class="q-opt ${engine.quality === id ? 'on' : ''}" data-q="${id}"><b>${q.name}</b><small>${q.desc}</small></button>`).join('')}</div>
    <h3 class="mh3">Sonido</h3>
    <label class="set-row toggle"><span>Sonido activado</span><input type="checkbox" id="set-sound" ${sfx.enabled ? 'checked' : ''}/></label>
    <label class="set-row toggle"><span>Música</span><input type="checkbox" id="set-music" ${sfx.musicOn ? 'checked' : ''}/></label>
    ${slider('master', 'General', sfx.vol.master)}
    ${slider('music', 'Música', sfx.vol.music)}
    ${slider('sfx', 'Efectos', sfx.vol.sfx)}
    ${slider('cries', 'Gritos de Pokémon', sfx.vol.cries)}
    <div class="audio-info">${icon('music')}<div>
      <b>Tu propia música y sonidos</b>
      <p>Pon archivos en la carpeta <code>public/audio</code> del servidor y el juego los usará automáticamente (lo que falte se sintetiza):
      <code>music/planning.mp3</code>, <code>music/battle.mp3</code>, <code>sfx/buy.ogg</code>, <code>cries/25.ogg</code>… La lista completa está en <code>public/audio/LEEME.txt</code>.</p>
      <p class="found">Encontrados ahora: <b>${c.music}</b> pistas de música, <b>${c.sfx}</b> efectos y <b>${c.cries}</b> gritos.</p>
    </div></div>
    <div class="row-btns"><button class="btn primary" id="set-close">Cerrar</button></div>
  </div>`;
  m.classList.remove('hidden');
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; onClose && onClose(); };
  m.onclick = (e) => { if (e.target === m) close(); };
  m.querySelector('#set-close').onclick = close;
  m.querySelectorAll('.q-opt').forEach((b) => (b.onclick = () => {
    engine.setQuality(b.dataset.q);
    m.querySelectorAll('.q-opt').forEach((x) => x.classList.toggle('on', x === b));
    sfx.play('click');
  }));
  m.querySelectorAll('input[data-vol]').forEach((inp) => {
    inp.oninput = () => {
      sfx.setVolume(inp.dataset.vol, inp.value / 100);
      inp.nextElementSibling.textContent = inp.value;
    };
    inp.onchange = () => { sfx.unlock(); if (inp.dataset.vol === 'cries') sfx.cry('pikachu', 'pichu', 2); else sfx.play('coin'); };
  });
  m.querySelector('#set-sound').onchange = (e) => { sfx.unlock(); if (e.target.checked !== sfx.enabled) sfx.toggle(); };
  m.querySelector('#set-music').onchange = (e) => { sfx.unlock(); if (e.target.checked !== sfx.musicOn) sfx.toggleMusic(); };
}
