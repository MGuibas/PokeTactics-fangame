// Efectos visuales: partículas, proyectiles, rayos, ondas y textos flotantes.
import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from './engine.js';

export const TYPE_COLOR = {
  normal: 0xe8e0c0, fuego: 0xff7b2e, agua: 0x3d9bff, planta: 0x5fd35a, electrico: 0xffe14a, hielo: 0x9ef0ff,
  lucha: 0xe0503a, tierra: 0xd9a44e, volador: 0xb8c8ff, psiquico: 0xff6aa8, roca: 0xc6b050, fantasma: 0x9a6ae0,
  dragon: 0x8a5aff, siniestro: 0x6a5a6a, acero: 0xd8e4f0, hada: 0xffa8ea,
};

class Particles {
  constructor(scene, max = 3000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5 || vA < 0.01) discard;
          float edge = smoothstep(0.5, 0.36, d); vec3 col = mix(vC * 0.55, vC, edge); gl_FragColor = vec4(col, vA); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p, v, color, size, life, grav = -6) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    const c = new THREE.Color(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.size[i] = size; this.baseSize[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = grav;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      const drag = 1 - dt * 1.5;
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = Math.min(1, k * 2);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

const tmpV = new THREE.Vector3();
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;

export class FX {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.parts = new Particles(this.scene);
    this.items = [];
    this.texts = [];
    this.layer = document.getElementById('fxlayer');
    this.sphereGeo = new THREE.SphereGeometry(1, 14, 10);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    this.cylGeo.rotateX(Math.PI / 2);
    engine.onUpdate((dt) => this.update(dt));
  }

  update(dt) {
    this.parts.update(dt);
    // Los efectos creados durante la actualización se añaden a la lista nueva.
    const cur = this.items;
    this.items = [];
    const keep = cur.filter((it) => {
      it.t += dt;
      let alive = false;
      try { alive = it.update(it.t, dt); } catch (e) { console.warn(e); }
      if (!alive) { this.scene.remove(it.obj); it.dispose?.(); }
      return alive;
    });
    this.items = keep.concat(this.items);
    // Textos flotantes anclados a posiciones 3D.
    this.texts = this.texts.filter((tx) => {
      tx.t += dt;
      if (tx.t > tx.life) { tx.el.remove(); return false; }
      const s = this.engine.toScreen(tx.pos);
      tx.el.style.left = s.x + tx.ox + 'px';
      tx.el.style.top = s.y + 'px';
      return true;
    });
  }

  burst(pos, color, n = 14, speed = 4, size = 0.35, life = 0.6, grav = -6) {
    for (let i = 0; i < n; i++) {
      tmpV.set(rnd(), Math.random() * 0.9 + 0.2, rnd()).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.parts.emit(pos, tmpV, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), grav);
    }
  }

  sparkle(pos, color = 0xffffff, n = 8, spread = 0.6) {
    for (let i = 0; i < n; i++) {
      const p = pos.clone().add(new THREE.Vector3(rnd(spread), Math.random() * spread * 1.5, rnd(spread)));
      this.parts.emit(p, new THREE.Vector3(0, 0.8 + Math.random(), 0), color, 0.22 + Math.random() * 0.2, 0.6 + Math.random() * 0.5, 0);
    }
  }

  rising(pos, color, n = 10, spread = 0.5) {
    for (let i = 0; i < n; i++) {
      const p = pos.clone().add(new THREE.Vector3(rnd(spread), Math.random() * 0.3, rnd(spread)));
      this.parts.emit(p, new THREE.Vector3(rnd(0.2), 1.6 + Math.random() * 1.4, rnd(0.2)), color, 0.3, 0.8, 0);
    }
  }

  // Proyectil con estela desde a hasta b en d segundos.
  projectile(a, b, color, d = 0.3, size = 0.18, arc = 0.6) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    const from = a.clone(), to = b.clone();
    this.items.push({
      obj: mesh, t: 0,
      update: (t) => {
        const k = Math.min(1, t / d);
        mesh.position.lerpVectors(from, to, k);
        mesh.position.y += Math.sin(k * Math.PI) * arc;
        if (Math.random() < 0.8) this.parts.emit(mesh.position, new THREE.Vector3(rnd(0.3), rnd(0.3), rnd(0.3)), color, size * 2.2, 0.25, 0);
        return k < 1;
      },
      dispose: () => mat.dispose(),
    });
  }

  ring(pos, radius, color, dur = 0.5, y = 0.15) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, y, pos.z);
    this.scene.add(m);
    this.items.push({
      obj: m, t: 0,
      update: (t) => {
        const k = Math.min(1, t / dur);
        const e = 1 - Math.pow(1 - k, 3);
        m.scale.setScalar(0.2 + radius * e);
        mat.opacity = 1 - k;
        return k < 1;
      },
      dispose: () => mat.dispose(),
    });
  }

  dome(pos, radius, color, dur = 0.45) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(this.sphereGeo, mat);
    m.position.copy(pos);
    this.scene.add(m);
    this.items.push({
      obj: m, t: 0,
      update: (t) => {
        const k = Math.min(1, t / dur);
        m.scale.set(radius * (0.3 + k * 0.7), radius * (0.2 + k * 0.45), radius * (0.3 + k * 0.7));
        mat.opacity = 0.32 * (1 - k) * (1 - k);
        return k < 1;
      },
      dispose: () => mat.dispose(),
    });
  }

  beam(a, b, color, width = 0.35, dur = 0.45) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const inner = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.cylGeo, mat);
    const m2 = new THREE.Mesh(this.cylGeo, inner);
    g.add(m, m2);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    g.position.copy(mid);
    g.lookAt(b);
    const len = a.distanceTo(b);
    this.scene.add(g);
    this.items.push({
      obj: g, t: 0,
      update: (t) => {
        const k = Math.min(1, t / dur);
        const w = width * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
        m.scale.set(w, w, len);
        m2.scale.set(w * 0.4, w * 0.4, len);
        mat.opacity = 0.85 * (1 - k * 0.5);
        inner.opacity = 0.9 * (1 - k);
        return k < 1;
      },
      dispose: () => { mat.dispose(); inner.dispose(); },
    });
    // chispas a lo largo
    for (let i = 0; i < 12; i++) {
      const p = a.clone().lerp(b, Math.random());
      this.parts.emit(p, new THREE.Vector3(rnd(1.5), Math.random() * 2, rnd(1.5)), color, 0.3, 0.5, -2);
    }
  }

  lightning(points, color = 0xffe14a, dur = 0.28) {
    const pts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const segs = 6;
      for (let s = 0; s <= segs; s++) {
        const p = a.clone().lerp(b, s / segs);
        if (s > 0 && s < segs) p.add(new THREE.Vector3(rnd(0.25), rnd(0.25), rnd(0.25)));
        pts.push(p);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.items.push({
      obj: line, t: 0,
      update: (t) => { mat.opacity = 1 - t / dur; return t < dur; },
      dispose: () => { geo.dispose(); mat.dispose(); },
    });
    for (const p of points) this.burst(p, color, 5, 3, 0.25, 0.3, 0);
  }

  // Burbuja de escudo que sigue a una unidad.
  bubble(obj, radius, color = 0xcfe8ff, dur = 0.9) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false });
    const m = new THREE.Mesh(this.sphereGeo, mat);
    this.scene.add(m);
    this.items.push({
      obj: m, t: 0,
      update: (t) => {
        m.position.copy(obj.position).add(new THREE.Vector3(0, radius * 0.8, 0));
        const k = t / dur;
        m.scale.setScalar(radius * (0.9 + Math.sin(t * 12) * 0.03));
        mat.opacity = 0.35 * (1 - k);
        return k < 1;
      },
      dispose: () => mat.dispose(),
    });
  }

  // Poké Ball que se abre (aparición de unidades).
  pokeball(pos, cb) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial({ color: 0xe3350d }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toonMaterial({ color: 0xffffff }));
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toonMaterial({ color: 0xffffff }));
    btn.position.z = 0.21;
    g.add(top, bot, btn);
    g.position.set(pos.x, 3, pos.z);
    this.scene.add(g);
    let opened = false;
    this.items.push({
      obj: g, t: 0,
      update: (t) => {
        if (t < 0.35) {
          const k = t / 0.35;
          g.position.y = 3 - 2.8 * k * k;
          g.rotation.x = k * 8;
        } else if (!opened) {
          opened = true;
          this.burst(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffffff, 14, 3, 0.3, 0.35, 0);
          this.ring(pos, 1.1, 0xffffff, 0.35);
          cb && cb();
        } else {
          top.rotation.x = -Math.min(1.5, (t - 0.35) * 8);
          g.scale.setScalar(Math.max(0.01, 1 - (t - 0.35) * 3));
        }
        return t < 0.7;
      },
    });
  }

  coins(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      tmpV.set(rnd(1.5), 4 + Math.random() * 2, rnd(1.5));
      this.parts.emit(pos, tmpV, 0xffcb05, 0.4, 0.9, -12);
    }
  }

  // Texto HTML anclado a un punto 3D.
  text(pos, str, cls = '', life = 0.95, ox = 0) {
    const el = document.createElement('div');
    el.className = 'dmg ' + cls;
    el.textContent = str;
    this.layer.appendChild(el);
    const s = this.engine.toScreen(pos);
    el.style.left = s.x + ox + 'px';
    el.style.top = s.y + 'px';
    this.texts.push({ el, pos: pos.clone(), t: 0, life: cls.includes('txt') ? 1.6 : life, ox });
    if (this.texts.length > 90) { const old = this.texts.shift(); old.el.remove(); }
  }

  // Efecto de golpe según tipo.
  impact(pos, type, big = false) {
    const c = TYPE_COLOR[type] || 0xffffff;
    this.burst(pos, c, big ? 22 : 8, big ? 5 : 3, big ? 0.45 : 0.3, 0.45);
    if (big) this.ring(pos, 1.6, c, 0.4);
  }

  // Efectos por habilidad.
  cast(kind, type, from, to, radius = 1, extra = {}) {
    const c = TYPE_COLOR[type] || 0xffffff;
    switch (kind) {
      case 'blast': case 'status':
        this.projectile(from.clone().add(new THREE.Vector3(0, 0.8, 0)), to.clone().add(new THREE.Vector3(0, 0.5, 0)), c, 0.25, 0.3, 1.2);
        setTimeout(() => {
          this.ring(to, 1.7 * Math.max(1, radius) + 0.3, c, 0.5);
          this.dome(to.clone().add(new THREE.Vector3(0, 0.3, 0)), 1.1 * Math.max(1, radius), c, 0.4);
          this.burst(to.clone().add(new THREE.Vector3(0, 0.5, 0)), c, 26, 5, 0.5, 0.6);
        }, 250);
        break;
      case 'bolt': case 'payday':
        this.projectile(from.clone().add(new THREE.Vector3(0, 0.8, 0)), to.clone().add(new THREE.Vector3(0, 0.6, 0)), kind === 'payday' ? 0xffcb05 : c, (extra.d || 300) / 1000, 0.3, 0.4);
        break;
      case 'beam':
        this.beam(from.clone().add(new THREE.Vector3(0, 0.7, 0)), to.clone().add(new THREE.Vector3(0, 0.7, 0)), c, 0.55, 0.55);
        break;
      case 'nova': case 'global':
        this.ring(from, kind === 'global' ? 14 : 1.8 * radius + 0.5, c, 0.55);
        this.dome(from.clone().add(new THREE.Vector3(0, 0.3, 0)), kind === 'global' ? 4 : 1.4 * radius + 0.4, c, 0.5);
        this.burst(from.clone().add(new THREE.Vector3(0, 0.5, 0)), c, 30, 6, 0.5, 0.7);
        break;
      case 'heal':
        this.ring(from, 1.8 * Math.min(4, radius) + 0.5, 0x6cf07e, 0.6);
        break;
      case 'shield':
        this.ring(from, 2.2, 0xcfe8ff, 0.5);
        break;
      case 'buff':
        this.rising(from.clone().add(new THREE.Vector3(0, 0.3, 0)), c, 16, 0.5);
        this.ring(from, 1.2, c, 0.4);
        break;
      case 'dash': case 'teleport':
        this.burst(from.clone().add(new THREE.Vector3(0, 0.5, 0)), c, 12, 3, 0.4, 0.4);
        this.burst(to.clone().add(new THREE.Vector3(0, 0.5, 0)), c, 16, 4, 0.4, 0.5);
        break;
      case 'splash':
        this.burst(from.clone().add(new THREE.Vector3(0, 0.3, 0)), 0x7ac8ff, 12, 3, 0.3, 0.5);
        break;
      case 'rest':
        this.rising(from.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x9ad0ff, 8, 0.3);
        break;
    }
  }
}
