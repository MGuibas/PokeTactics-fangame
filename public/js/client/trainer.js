// Entrenador controlable (como la "Little Legend" de TFT) y Poké Balls de botín.
import * as THREE from 'three';
import { UnitView } from './units.js';
import { toonMaterial, outlineMaterial } from './engine.js';
import { FORMS } from '../game/data/pokemon.js';
import { AV_SPEED } from '../game/room.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class TrainerView {
  constructor(ctx, { pid, form, name, me = false, x = 0, z = 0 }) {
    this.ctx = ctx;
    this.pid = pid;
    this.form = form;
    this.view = new UnitView(ctx, { id: 't' + pid, form, line: FORMS[form]?.line || 'pichu', star: 1, bench: true, scaleMul: 1.15 });
    this.view.hideBar = true;
    this.pos = V3(x, 0, z);
    this.target = this.pos.clone();
    this.view.place(this.pos);
    this.view.yaw = this.view.targetYaw = 0;
    this.label = document.createElement('div');
    this.label.className = 'tlabel' + (me ? ' me' : '');
    this.label.textContent = name || '';
    ctx.overlay.appendChild(this.label);
    this.showLabel = true;
    this.held = null;
    this.moving = false;
  }

  // Posición autoritativa del servidor (con su destino para interpolar a velocidad constante).
  setServer(x, z, tx, tz, predict = false) {
    const sp = V3(x, 0, z);
    if (tx !== undefined && !predict) this.target.set(tx, 0, tz);
    // Corrige solo si nos hemos desviado mucho (predicción local).
    if (this.pos.distanceTo(sp) > (predict ? 1.8 : 0.9)) this.pos.copy(sp);
  }

  walkTo(x, z) { this.target.set(x, 0, z); }

  teleport(x, z) {
    this.pos.set(x, 0, z);
    this.target.set(x, 0, z);
    this.view.place(this.pos);
  }

  update(dt, t) {
    const d = this.target.clone().sub(this.pos);
    const dist = d.length();
    const step = AV_SPEED * dt;
    this.moving = dist > 0.02;
    if (this.moving) {
      if (dist <= step) this.pos.copy(this.target);
      else this.pos.add(d.multiplyScalar(step / dist));
      this.view.faceTo(this.target);
    }
    this.view.pos.copy(this.pos);
    this.view.walkAmt += ((this.moving ? 1 : 0) - this.view.walkAmt) * Math.min(1, dt * 10);
    this.view.update(dt, t);
    // Pokémon agarrado (carrusel): le sigue por detrás.
    if (this.held) {
      const yaw = this.view.yaw;
      const back = V3(-Math.sin(yaw) * 0.95, 0, -Math.cos(yaw) * 0.95);
      this.held.pos.copy(this.pos).add(back);
      this.held.faceYaw(yaw);
    }
    const s = this.ctx.engine.toScreen(this.view.group.position.clone().add(V3(0, this.view.height + 0.35, 0)));
    this.label.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    this.label.style.display = this.showLabel && !s.behind ? '' : 'none';
  }

  dispose() {
    this.view.dispose();
    this.label.remove();
  }
}

// ── Poké Balls de botín ──
const ballGeoTop = new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const ballGeoBot = new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const bandGeo = new THREE.TorusGeometry(0.34, 0.035, 8, 28);
const btnGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16);
for (const g of [ballGeoTop, ballGeoBot, bandGeo, btnGeo]) g.setAttribute('onormal', g.attributes.normal);
const matCache = {};
const mat = (c) => (matCache[c] ||= toonMaterial({ color: c, rim: 0.3 }));
const COLORS = { normal: [0xe3350d, 0xffffff], gold: [0xf5c030, 0xfff4c0], rare: [0x7a3ab8, 0xffffff] };

export class OrbView {
  constructor(ctx, orb) {
    this.ctx = ctx;
    this.id = orb.id;
    const [top, bot] = COLORS[orb.gold ? 'gold' : orb.rare ? 'rare' : 'normal'];
    const g = new THREE.Group();
    const ol = outlineMaterial(0x1a1420, 2);
    const parts = [
      new THREE.Mesh(ballGeoTop, mat(top)),
      new THREE.Mesh(ballGeoBot, mat(bot)),
    ];
    const band = new THREE.Mesh(bandGeo, mat(0x1a1420));
    band.rotation.x = Math.PI / 2;
    const btn = new THREE.Mesh(btnGeo, mat(0xffffff));
    btn.rotation.x = Math.PI / 2;
    btn.position.z = 0.34;
    for (const m of parts) { const o = new THREE.Mesh(m.geometry, ol); o.renderOrder = -1; m.add(o); }
    g.add(...parts, band, btn);
    this.ball = g;
    this.group = new THREE.Group();
    this.group.add(g);
    this.group.position.set(orb.x, 0, orb.z);
    this.phase = Math.random() * 6;
    this.t = 0;
    ctx.scene.add(this.group);
    // Aparece cayendo del cielo.
    this.drop = 1;
  }

  update(dt, t) {
    this.t += dt;
    this.drop = Math.max(0, this.drop - dt * 2.2);
    const bounce = Math.abs(Math.sin(t * 2.4 + this.phase)) * 0.18;
    this.ball.position.y = 0.42 + bounce + this.drop * this.drop * 6;
    this.ball.rotation.y = t * 1.2 + this.phase;
    this.ball.rotation.z = Math.sin(t * 3 + this.phase) * 0.2;
    if (Math.random() < dt * 3) this.ctx.fx.sparkle(this.group.position.clone().add(V3(0, 0.5, 0)), 0xffffff, 1, 0.4);
  }

  dispose(burst = true) {
    if (burst) {
      this.ctx.fx.burst(this.group.position.clone().add(V3(0, 0.5, 0)), 0xffffff, 16, 4, 0.35, 0.45);
      this.ctx.fx.ring(this.group.position, 1.2, 0xffffff, 0.35);
    }
    this.ctx.scene.remove(this.group);
  }
}
