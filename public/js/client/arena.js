// Escenario: isla flotante, tablero hexagonal, banquillo, decoración y clima.
import * as THREE from 'three';
import { toonMaterial, outlineMaterial, hexToWorld, benchToWorld, HEX } from './engine.js';
import { COLS, ROWS } from '../game/hex.js';

const SKY = {
  despejado: { top: 0x58b4f0, bot: 0xcdeeff, fog: 0xbfe6ff, sun: 2.1, hemi: 1.15, sunCol: 0xfff2d8 },
  sol:       { top: 0x3aa0f0, bot: 0xfff0c0, fog: 0xffeec8, sun: 2.8, hemi: 1.25, sunCol: 0xffe2a8 },
  lluvia:    { top: 0x5a6a88, bot: 0xa8b8cc, fog: 0x9aabc0, sun: 1.1, hemi: 0.95, sunCol: 0xd0e0ff },
  arena:     { top: 0xc89a5a, bot: 0xf0d8a8, fog: 0xe0c090, sun: 1.7, hemi: 1.05, sunCol: 0xffd8a0 },
  nieve:     { top: 0x9ab8d8, bot: 0xf0f6ff, fog: 0xe8f0fa, sun: 1.6, hemi: 1.3, sunCol: 0xeaf4ff },
  niebla:    { top: 0xe0a8d8, bot: 0xfbe6f5, fog: 0xf5d8ee, sun: 1.6, hemi: 1.2, sunCol: 0xffe8f8 },
  electrico: { top: 0x3a3a6a, bot: 0x8a8ac0, fog: 0x7a7ab0, sun: 1.2, hemi: 1.0, sunCol: 0xf8f0a0 },
};

// ───────── Utilidades de geometría ─────────
function mulberry(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Desplaza vértices de forma coherente (mismos puntos, mismo desplazamiento) para un look rocoso.
function jitter(g, amt) {
  const pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    let d = map.get(k);
    if (!d) {
      const h = Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719) * 43758.5453;
      const f = (n) => ((Math.sin(h * n) * 43758.5453) % 1) * 2 - 1;
      d = [f(1.3) * amt, f(2.7) * amt, f(4.1) * amt];
      map.set(k, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

function roundedBox(w, h, d, r = 0.1) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r); shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d); shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(0.06, h / 4);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2 + bev, 0);
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function pokeballTexture() {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#efe2c0'; g.fillRect(0, 0, w, w);
    g.globalAlpha = 0.55;
    g.fillStyle = '#e3350d'; g.beginPath(); g.arc(64, 64, 48, Math.PI, 0); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 48, 0, Math.PI); g.fill();
    g.globalAlpha = 0.8;
    g.fillStyle = '#3a2a22'; g.fillRect(16, 60, 96, 8);
    g.beginPath(); g.arc(64, 64, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = '#3a2a22'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
  });
}

function bannerTexture(bg, fg) {
  return canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, 14);
    g.beginPath(); g.moveTo(0, h - 30); g.lineTo(w / 2, h); g.lineTo(w, h - 30); g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = fg;
    g.beginPath(); g.arc(64, 82, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = bg; g.fillRect(28, 78, 72, 8);
    g.beginPath(); g.arc(64, 82, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = fg; g.beginPath(); g.arc(64, 82, 7, 0, Math.PI * 2); g.fill();
  });
}

class Batch {
  constructor() { this.parts = []; }
  add(geo, pos, rot, scale, color, o = {}) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0, 'YXZ'));
    const sc = Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale ?? 1, scale ?? 1, scale ?? 1);
    m.compose(new THREE.Vector3(...pos), q, sc);
    this.parts.push({ geo, m, color, flat: !!o.flat, emit: o.emit || 0 });
    return this;
  }
  build(outline = 0x1a1420, px = 2.2) {
    if (!this.parts.length) return null;
    let count = 0;
    const geos = this.parts.map((p) => {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m);
      if (p.flat) g.computeVertexNormals();
      count += g.attributes.position.count;
      return g;
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), emit = new Float32Array(count);
    const c = new THREE.Color();
    let o = 0;
    geos.forEach((g, i) => {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      c.setHex(this.parts[i].color);
      for (let k = 0; k < n; k++) { col.set([c.r, c.g, c.b], (o + k) * 3); emit[o + k] = this.parts[i].emit; }
      o += n;
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('emit', new THREE.BufferAttribute(emit, 1));
    // Normales suavizadas para el contorno.
    const map = new Map();
    const key = (i) => `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
    for (let i = 0; i < count; i++) {
      const k = key(i);
      const a = map.get(k) || [0, 0, 0];
      a[0] += nor[i * 3]; a[1] += nor[i * 3 + 1]; a[2] += nor[i * 3 + 2];
      map.set(k, a);
    }
    const on = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = map.get(key(i));
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      on[i * 3] = a[0] / l; on[i * 3 + 1] = a[1] / l; on[i * 3 + 2] = a[2] / l;
    }
    geo.setAttribute('onormal', new THREE.BufferAttribute(on, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, toonMaterial({ vertexColors: true, emitAttr: true, rim: 0.12 }));
    if (outline !== null) {
      const ol = new THREE.Mesh(geo, outlineMaterial(outline, px));
      ol.renderOrder = -1;
      mesh.add(ol);
    }
    return mesh;
  }
}

export class Arena {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.weather = 'despejado';
    this.buildSky();
    this.buildWater();
    this.buildIsland();
    this.buildBoard();
    this.buildBench();
    this.buildDecor();
    this.buildWeather();
    this.buildMotes();
    // Sombras toon: todo recibe; los objetos con volumen (no el suelo ni la hierba) proyectan.
    this.group.traverse((o) => {
      if (!o.isMesh || o.material?.isShaderMaterial || o.material?.transparent) return;
      o.receiveShadow = true;
      o.castShadow = !o.userData.ground && !o.isInstancedMesh;
    });
    this.setWeather('despejado', true);
    engine.onUpdate((dt, t) => this.update(dt, t));
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(160, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(0x58b4f0) }, bot: { value: new THREE.Color(0xcdeeff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = smoothstep(-0.15, 0.6, vP.y); gl_FragColor = vec4(mix(bot, top, h), 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.scene.add(this.sky);
    // Nubes toon.
    this.clouds = new THREE.Group();
    const cm = toonMaterial({ color: 0xffffff, rim: 0.2 });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cm);
        s.scale.set(2 + Math.random() * 1.5, 1.2 + Math.random() * 0.6, 1.6 + Math.random());
        s.position.set(k * 2.2 - n, Math.random() * 0.6, Math.random() * 0.8);
        c.add(s);
      }
      const a = Math.random() * Math.PI * 2;
      const r = 45 + Math.random() * 40;
      c.position.set(Math.cos(a) * r, 8 + Math.random() * 14, Math.sin(a) * r - 10);
      c.userData.speed = 0.3 + Math.random() * 0.4;
      c.scale.setScalar(1 + Math.random() * 1.2);
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);
  }

  buildWater() {
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, col: { value: new THREE.Color(0x3aa8e0) }, deep: { value: new THREE.Color(0x2070b8) }, fogColor: { value: new THREE.Color(0xbfe6ff) } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform float time; uniform vec3 col; uniform vec3 deep; uniform vec3 fogColor; varying vec3 vW;
        void main(){
          float d = length(vW.xz);
          float waves = sin(vW.x*0.35 + time*0.8) + sin(vW.z*0.42 - time*0.6) + sin((vW.x+vW.z)*0.21 + time*0.5);
          float foam = step(2.35, waves);
          float ring = smoothstep(0.5, 0.0, abs(d - 19.2 - sin(time*1.4 + atan(vW.z, vW.x)*6.0)*0.25));
          vec3 c = mix(deep, col, smoothstep(60.0, 16.0, d));
          c = mix(c, vec3(1.0), max(foam*0.35, ring*0.9));
          float f = smoothstep(40.0, 130.0, d);
          gl_FragColor = vec4(mix(c, fogColor, f), 1.0);
        }`,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.6;
    this.scene.add(water);
  }

  // Mallas estáticas fusionadas (colores por vértice) + contorno.
  addBatch(batch, outline = 0x1a1420, px = 2.2) {
    const mesh = batch.build(outline, px);
    if (mesh) this.group.add(mesh);
    return mesh;
  }

  buildIsland() {
    const b = new Batch();
    const edge = (a) => 1 + 0.035 * Math.sin(a * 5 + 0.3) + 0.022 * Math.sin(a * 13 + 2) + 0.012 * Math.sin(a * 29);
    const organic = (g, jit = 0) => {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const r = Math.hypot(x, z);
        if (r < 1) continue;
        const k = edge(Math.atan2(z, x));
        pos.setX(i, x * k); pos.setZ(i, z * k);
      }
      if (jit) jitter(g, jit);
      return g;
    };
    // Césped superior, capas de acantilado y playa.
    b.add(organic(new THREE.CylinderGeometry(17, 17, 0.9, 96, 1)), [0, -0.55, 0], null, 1, 0x7ccb5a);
    b.add(organic(new THREE.CylinderGeometry(17.05, 16.5, 0.35, 96, 1)), [0, -1.1, 0], null, 1, 0x5ea848);
    b.add(organic(new THREE.CylinderGeometry(16.6, 15.8, 0.9, 64, 2), 0.22), [0, -1.65, 0], null, 1, 0xb07a4e, { flat: true });
    b.add(organic(new THREE.CylinderGeometry(15.9, 14.5, 1.4, 48, 2), 0.3), [0, -2.7, 0], null, 1, 0x8c6e5e, { flat: true });
    b.add(organic(new THREE.CylinderGeometry(18.6, 18.9, 0.3, 96, 1)), [0, -1.72, 0], null, 1, 0xf0d9a0);
    // Suelo del estadio.
    b.add(roundedBox(16.2, 0.36, 14.8, 0.5), [0, -0.22, -0.2], null, 1, 0xcfc6ae);
    b.add(roundedBox(15.4, 0.3, 14.0, 0.4), [0, -0.08, -0.2], null, 1, 0xe2dac4);
    this.addBatch(b, 0x1a1420, 2.4).userData.ground = true;
  }

  buildBoard() {
    const top = new THREE.CylinderGeometry(HEX * 0.9, HEX * 0.94, 0.16, 6);
    top.setAttribute('onormal', top.attributes.normal);
    const base = new THREE.CylinderGeometry(HEX * 0.99, HEX * 1.0, 0.14, 6);
    base.setAttribute('onormal', base.attributes.normal);
    this.tileMat = toonMaterial({ color: 0xffffff, rim: 0.05 });
    const n = COLS * ROWS;
    this.tiles = new THREE.InstancedMesh(top, this.tileMat, n);
    const bases = new THREE.InstancedMesh(base, toonMaterial({ color: 0xffffff, rim: 0 }), n);
    this.tileBase = [];
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const p = hexToWorld(x, y);
      m.makeTranslation(p.x, 0.06, p.z);
      this.tiles.setMatrixAt(i, m);
      m.makeTranslation(p.x, -0.02, p.z);
      bases.setMatrixAt(i, m);
      const mine = y >= 4;
      const alt = (x + y) % 2 === 0;
      c.setHex(mine ? (alt ? 0xf4ecd4 : 0xe9dfc1) : (alt ? 0xe3e9f1 : 0xd6dde8));
      this.tileBase[i] = c.getHex();
      this.tiles.setColorAt(i, c);
      bases.setColorAt(i, new THREE.Color(mine ? 0xb9a784 : 0x98a3b6));
    }
    this.tiles.instanceColor.needsUpdate = true;
    bases.instanceColor.needsUpdate = true;
    this.group.add(bases, this.tiles);
    const ol = new THREE.InstancedMesh(base, outlineMaterial(0x5a4a3a, 1.3), n);
    for (let i = 0; i < n; i++) { bases.getMatrixAt(i, m); ol.setMatrixAt(i, m); }
    ol.renderOrder = -1;
    this.group.add(ol);
    // Línea central con emblemas de Poké Ball.
    const b = new Batch();
    b.add(new THREE.BoxGeometry(13.6, 0.06, 0.14), [0, 0.15, 0], null, 1, 0xe3350d);
    for (const x of [-7.1, 7.1]) {
      b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 28), [x, 0.14, 0], null, 1, 0xffffff);
      b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.09, 28, 1, false, 0, Math.PI), [x, 0.145, 0], [0, Math.PI / 2, 0], 1, 0xe3350d);
      b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 20), [x, 0.15, 0], null, 1, 0x1a1420);
      b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.11, 20), [x, 0.155, 0], null, 1, 0xffffff);
    }
    this.addBatch(b, 0x1a1420, 1.6).userData.ground = true;
  }

  buildBench() {
    const b = new Batch();
    // Tarima de tablones.
    for (let k = 0; k < 6; k++) {
      b.add(roundedBox(15.8, 0.22, 0.3, 0.06), [0, -0.12, 7.15 + k * 0.33], [0, 0, (k % 2 ? 0.004 : -0.004)], 1, k % 2 ? 0xa86e42 : 0xb88050);
    }
    b.add(roundedBox(16.2, 0.3, 0.3, 0.08), [0, -0.05, 9.1], null, 1, 0x8a5634);
    for (const x of [-8.1, 8.1]) {
      b.add(new THREE.CylinderGeometry(0.16, 0.18, 1.0, 10), [x, 0.25, 8.05], null, 1, 0x8a5634);
      b.add(new THREE.SphereGeometry(0.2, 12, 8), [x, 0.8, 8.05], null, 1, 0xe3350d);
    }
    this.addBatch(b, 0x1a1420, 2.0);
    // Plataformas con emblema de Poké Ball.
    const padGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.12, 32);
    padGeo.setAttribute('onormal', padGeo.attributes.normal);
    const topMat = new THREE.MeshToonMaterial({ map: pokeballTexture(), gradientMap: this.tileMat.gradientMap });
    this.benchMat = [];
    this.benchRings = [];
    const ringGeo = new THREE.RingGeometry(0.72, 0.9, 40);
    for (let i = 0; i < 9; i++) {
      const rim = toonMaterial({ color: 0xe8d5a8, rim: 0.05 });
      const pad = new THREE.Mesh(padGeo, [rim, topMat, rim]);
      const p = benchToWorld(i);
      pad.position.set(p.x, 0.04, p.z);
      this.group.add(pad);
      const ol = new THREE.Mesh(padGeo, outlineMaterial(0x5a3a22, 1.4));
      ol.renderOrder = -1;
      pad.add(ol);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9be86a, transparent: true, opacity: 0.85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.12, p.z);
      ring.visible = false;
      this.group.add(ring);
      this.benchMat.push(rim);
      this.benchRings.push(ring);
    }
  }

  buildDecor() {
    const b = new Batch();
    const rnd = mulberry(7);
    const R = (a, z) => a + rnd() * (z - a);
    // ── Muro del estadio (bloques de piedra) y pilares ──
    const stone = [0xb8b2a4, 0xa8a294, 0xc4bdae, 0x9c968a];
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 1.15));
      const ang = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const g = roundedBox(len / n - 0.08, 0.5 + rnd() * 0.12, 0.62, 0.12);
        b.add(g, [x0 + (x1 - x0) * t, 0.12, z0 + (z1 - z0) * t], [0, ang + Math.PI / 2, 0], 1, stone[i % 4]);
      }
    };
    wall(-7.9, -7.6, 7.9, -7.6);
    wall(-8.2, -7.3, -8.2, 6.4);
    wall(8.2, -7.3, 8.2, 6.4);
    this.lanterns = [];
    for (const [x, z] of [[-8.2, -7.6], [8.2, -7.6], [-8.2, 6.6], [8.2, 6.6], [0, -7.9]]) {
      b.add(roundedBox(0.95, 1.5, 0.95, 0.12), [x, 0.5, z], null, 1, 0x9a9486);
      b.add(roundedBox(1.15, 0.22, 1.15, 0.08), [x, 1.3, z], null, 1, 0xd8d0bc);
      b.add(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 8), [x, 1.62, z], null, 1, 0x4a3a2a);
      b.add(new THREE.SphereGeometry(0.24, 12, 8), [x, 1.88, z], null, 1, 0xffd86a, { emit: 1 });
      b.add(new THREE.ConeGeometry(0.34, 0.28, 8), [x, 2.18, z], null, 1, 0x4a3a2a);
    }
    // ── Árboles ──
    const round = (x, z, s, cols) => {
      b.add(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 1.6 * s, 7), [x, 0.7 * s - 0.2, z], null, 1, 0x8a5a36, { flat: true });
      const k = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2;
        const rr = i === 0 ? 0 : 0.55 * s;
        b.add(jitter(new THREE.IcosahedronGeometry((0.75 + rnd() * 0.3) * s, 1), 0.06 * s), [x + Math.cos(a) * rr, (1.9 + (i === 0 ? 0.55 : rnd() * 0.3)) * s - 0.2, z + Math.sin(a) * rr], null, 1, cols[i % cols.length], { flat: true });
      }
    };
    const pine = (x, z, s) => {
      b.add(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.2 * s, 7), [x, 0.4 * s - 0.2, z], null, 1, 0x7a4a2a, { flat: true });
      const greens = [0x2f7d4a, 0x38905a, 0x46a468];
      for (let i = 0; i < 3; i++) {
        b.add(jitter(new THREE.ConeGeometry((1.1 - i * 0.28) * s, 1.3 * s, 8, 1), 0.05 * s), [x, (1.2 + i * 0.75) * s - 0.2, z], [0, rnd() * 3, 0], 1, greens[i], { flat: true });
      }
    };
    const leafy = [0x4fae4a, 0x5fbe56, 0x46a044];
    const blossom = [0xf2a0c0, 0xf8b8d0, 0xe890b0];
    const autumn = [0xf0a040, 0xe88a30, 0xf5c050];
    const treeSpots = [
      [-14.2, -6, 'r', leafy], [-13.2, 1.8, 'p'], [-12.6, 9.5, 'r', blossom], [14.2, -4.6, 'r', leafy], [13.8, 3.2, 'p'],
      [12.4, 10.6, 'r', autumn], [-9.5, -13.2, 'p'], [9.8, -13.4, 'r', blossom], [0.5, -15.2, 'r', leafy], [-15.6, -1.6, 'p'],
      [15.4, -10.2, 'p'], [-4.8, -14.8, 'p'], [5, -15, 'r', autumn], [-14.8, 5.8, 'r', leafy], [15.2, 7, 'p'], [-11.5, -11.2, 'r', autumn],
    ];
    for (const [x, z, k, cols] of treeSpots) {
      const sc = 0.9 + rnd() * 0.35;
      if (k === 'p') pine(x, z, sc); else round(x, z, sc, cols);
    }
    // ── Arbustos con bayas ──
    for (const [x, z] of [[-10.6, -3.5], [10.8, -1.8], [-11.8, 6.8], [11.5, 8.2], [-6.5, -11.5], [6.8, -11.2], [3, -12.8], [-13.4, -9]]) {
      for (let i = 0; i < 3; i++) {
        b.add(jitter(new THREE.IcosahedronGeometry(0.55 + rnd() * 0.2, 1), 0.05), [x + (i - 1) * 0.5, 0.25, z + rnd() * 0.3], null, 1, i === 1 ? 0x4a9e40 : 0x5cb04e, { flat: true });
      }
      for (let i = 0; i < 4; i++) b.add(new THREE.SphereGeometry(0.09, 8, 6), [x + R(-0.8, 0.8), R(0.4, 0.75), z + R(0.2, 0.5)], null, 1, i % 2 ? 0xe03a4a : 0x5a7ae8);
    }
    // ── Rocas ──
    for (const [x, z, sz] of [[-11.8, -7.2, 0.9], [11.4, 6.2, 0.7], [-10.4, 3.4, 0.55], [11.2, -8.8, 1.0], [6, -14, 0.8], [-15.3, 3.4, 0.7], [14.7, -2, 0.6]]) {
      b.add(jitter(new THREE.DodecahedronGeometry(sz, 1), 0.12 * sz), [x, sz * 0.35 - 0.1, z], [rnd(), rnd() * 3, 0], [1, 0.75, 1.1], 0xa8a49a, { flat: true });
      b.add(jitter(new THREE.DodecahedronGeometry(sz * 0.5, 0), 0.05), [x + sz * 0.9, sz * 0.15 - 0.1, z + 0.3], [rnd(), 0, rnd()], 1, 0x98948a, { flat: true });
    }
    // ── Setas ──
    for (const [x, z] of [[-9.2, -9.6], [-9.7, -9.1], [10.3, 4.6], [13, -7.4], [-13, 4.4]]) {
      b.add(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 8), [x, 0.08, z], null, 1, 0xf5ecd8);
      b.add(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), [x, 0.2, z], null, [1, 0.8, 1], 0xe0403a);
      b.add(new THREE.SphereGeometry(0.045, 6, 4), [x + 0.08, 0.34, z + 0.06], null, 1, 0xffffff);
      b.add(new THREE.SphereGeometry(0.04, 6, 4), [x - 0.08, 0.33, z - 0.02], null, 1, 0xffffff);
    }
    // ── Valla en el borde trasero ──
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + 0.22 + (i / 26) * (Math.PI - 0.44);
      const x = Math.cos(a) * 16.2, z = Math.sin(a) * 16.2;
      b.add(roundedBox(0.2, 0.9, 0.2, 0.05), [x, 0.3, z], [0, -a, 0], 1, 0xc49a6a);
      if (i < 26) {
        const a2 = Math.PI + 0.22 + ((i + 0.5) / 26) * (Math.PI - 0.44);
        const len = 16.2 * (Math.PI - 0.44) / 26;
        for (const y of [0.25, 0.55]) b.add(roundedBox(len + 0.05, 0.1, 0.08, 0.03), [Math.cos(a2) * 16.2, y, Math.sin(a2) * 16.2], [0, -a2 + Math.PI / 2, 0], 1, 0xb08a5a);
      }
    }
    // ── Centro Pokémon en miniatura ──
    const cx = -12.4, cz = -3.6, ry = 0.9;
    const rot = (dx, dz) => [cx + dx * Math.cos(ry) + dz * Math.sin(ry), cz - dx * Math.sin(ry) + dz * Math.cos(ry)];
    const at = (dx, y, dz) => { const [x, z] = rot(dx, dz); return [x, y, z]; };
    b.add(roundedBox(3, 1.7, 2.2, 0.15), at(0, 0.65, 0), [0, ry, 0], 1, 0xfaf6ee);
    b.add(roundedBox(3.3, 0.35, 2.5, 0.1), at(0, 1.6, 0), [0, ry, 0], 1, 0xe3350d);
    b.add(roundedBox(2.4, 0.3, 1.7, 0.1), at(0, 1.9, 0), [0, ry, 0], 1, 0xd02a0a);
    b.add(roundedBox(0.9, 1.1, 0.1, 0.05), at(0, 0.45, 1.12), [0, ry, 0], 1, 0x6ab0e8);
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), at(0, 1.15, 1.13), [Math.PI / 2, ry, 0], 1, 0xffffff);
    b.add(new THREE.CylinderGeometry(0.43, 0.43, 0.11, 24, 1, false, -Math.PI / 2, Math.PI), at(0, 1.15, 1.14), [Math.PI / 2, ry, 0], 1, 0xe3350d);
    this.addBatch(b, 0x1a1420, 2.2);

    // ── Hierba y flores instanciadas ──
    const tuftGeo = new THREE.ConeGeometry(0.07, 0.36, 4);
    tuftGeo.translate(0, 0.18, 0);
    const tuftMat = toonMaterial({ color: 0xffffff, rim: 0 });
    const N = 420;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const tcols = [0x5ab048, 0x6cc458, 0x4a9e3e, 0x82d266];
    let k = 0;
    while (k < N) {
      const a = rnd() * Math.PI * 2, r = 8 + rnd() * 8.6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 8.8 && z > -8 && z < 10) continue; // fuera del estadio y del banquillo
      for (let j = 0; j < 3 && k < N; j++, k++) {
        e.set(R(-0.35, 0.35), rnd() * 3, R(-0.35, 0.35));
        q.setFromEuler(e);
        const sc = 0.7 + rnd() * 0.8;
        m4.compose(new THREE.Vector3(x + R(-0.15, 0.15), -0.12, z + R(-0.15, 0.15)), q, new THREE.Vector3(sc, sc, sc));
        tufts.setMatrixAt(k, m4);
        tufts.setColorAt(k, col.setHex(tcols[(k * 7) % 4]));
      }
    }
    this.group.add(tufts);
    const flGeo = new THREE.IcosahedronGeometry(0.11, 0);
    const flowers = new THREE.InstancedMesh(flGeo, toonMaterial({ color: 0xffffff, rim: 0.2 }), 140);
    const fcols = [0xffe060, 0xff7aa8, 0xffffff, 0xa87aff, 0xff8a4a];
    for (let i = 0; i < 140; i++) {
      let x, z;
      do { const a = rnd() * Math.PI * 2, r = 9 + rnd() * 7.5; x = Math.cos(a) * r; z = Math.sin(a) * r; } while (Math.abs(x) < 8.8 && z > -8 && z < 10);
      m4.makeTranslation(x, 0.02, z);
      flowers.setMatrixAt(i, m4);
      flowers.setColorAt(i, col.setHex(fcols[i % 5]));
    }
    this.group.add(flowers);

    // ── Estanque con nenúfares y arroyo ──
    this.pondMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float time; varying vec3 vW; void main(){ float w = sin(vW.x*2.2+time*1.5)*sin(vW.z*2.6-time*1.2); vec3 c = mix(vec3(0.22,0.62,0.9), vec3(0.45,0.8,1.0), smoothstep(0.55,0.9,w)); gl_FragColor = vec4(c,1.0); }',
    });
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), this.pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(11.2, -0.07, -8.4);
    pond.scale.set(1.25, 0.9, 1);
    this.group.add(pond);
    const lp = new Batch();
    lp.add(new THREE.TorusGeometry(2.1, 0.18, 8, 40), [11.2, -0.08, -8.4], [Math.PI / 2, 0, 0], [1.25, 0.9, 1], 0x9a8e7a, { flat: true });
    for (const [dx, dz] of [[-0.8, 0.3], [0.9, -0.4], [0.2, 0.8]]) {
      lp.add(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 16, 1, false, 0.3, Math.PI * 1.75), [11.2 + dx, -0.04, -8.4 + dz], null, 1, 0x4fae4a);
    }
    lp.add(new THREE.SphereGeometry(0.1, 8, 6), [11.2 + 0.2, 0.02, -8.4 + 0.8], null, 1, 0xff9ac8);
    this.addBatch(lp, 0x1a1420, 1.6);

    // ── Estandartes ondeantes ──
    this.banners = [];
    const tex = [bannerTexture('#d8301a', '#ffffff'), bannerTexture('#2f6fd6', '#ffcb05')];
    for (const [x, z, ti] of [[-4.5, -7.95, 0], [4.5, -7.95, 1], [-8.6, -2, 1], [8.6, -2, 0]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), toonMaterial({ color: 0x6a5a4a }));
      pole.position.set(x, 1.6, z);
      this.group.add(pole);
      const geo = new THREE.PlaneGeometry(1.1, 1.6, 8, 8);
      geo.translate(0.58, -0.8, 0);
      const mat = new THREE.MeshToonMaterial({ map: tex[ti], side: THREE.DoubleSide, gradientMap: this.tileMat.gradientMap });
      const flag = new THREE.Mesh(geo, mat);
      flag.position.set(x + 0.05, 3.2, z);
      flag.rotation.y = x < -8 ? -Math.PI / 2 : x > 8 ? Math.PI / 2 : 0;
      this.group.add(flag);
      this.banners.push({ geo, base: geo.attributes.position.array.slice(), phase: rnd() * 6 });
    }

    // ── Montañas lejanas ──
    const mb = new Batch();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9;
      const r = 95 + rnd() * 25, h = 18 + rnd() * 22;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      mb.add(jitter(new THREE.ConeGeometry(h * 0.9, h, 7, 3), 1.2), [x, h / 2 - 2, z], [0, rnd() * 3, 0], 1, 0x7a9ab8, { flat: true });
      mb.add(new THREE.ConeGeometry(h * 0.27, h * 0.3, 7, 1), [x, h - 2 - h * 0.15 + 0.3, z], [0, rnd() * 3, 0], 1, 0xf4f8ff, { flat: true });
    }
    const mm = mb.build(null);
    mm && this.scene.add(mm);
  }

  // ───────── Clima ─────────
  buildWeather() {
    const N = 1400;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44;
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.wMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, mode: { value: 0 }, color: { value: new THREE.Color(0xffffff) }, size: { value: 6 } },
      vertexShader: `
        uniform float time; uniform float mode; uniform float size; attribute float seed; varying float vS;
        void main(){
          vec3 p = position; vS = seed;
          float speed = mode < 1.5 ? 16.0 : (mode < 2.5 ? 1.6 : 3.0);
          p.y = mod(p.y - time * speed * (0.7 + seed*0.6), 22.0);
          if (mode > 1.5 && mode < 2.5) { p.x += sin(time*0.8 + seed*20.0)*1.2; }
          if (mode > 2.5) { p.x = mod(p.x + time * 9.0 * (0.6+seed) + 22.0, 44.0) - 22.0; p.y = mod(p.y, 8.0); }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (mode < 1.5 ? 1.0 : (0.6 + seed)) * (30.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float mode; uniform vec3 color; varying float vS;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a;
          if (mode < 1.5) { a = step(abs(c.x), 0.06) * (1.0 - smoothstep(0.1, 0.5, abs(c.y))); }
          else { a = 1.0 - smoothstep(0.3, 0.5, length(c)); }
          if (a < 0.05) discard;
          gl_FragColor = vec4(color, a * 0.8);
        }`,
      transparent: true, depthWrite: false,
    });
    this.wPoints = new THREE.Points(geo, this.wMat);
    this.wPoints.frustumCulled = false;
    this.scene.add(this.wPoints);
    this.flash = 0;
  }

  // Partículas ambientales: polen/luciérnagas que flotan sobre la isla (brillan con el bloom).
  buildMotes() {
    const N = 110;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 16;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.4 + Math.random() * 4.5;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xfff2b0) }, glow: { value: 1 }, amount: { value: 1 } },
      vertexShader: `
        uniform float time; attribute float seed; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(time * 0.35 + seed * 40.0) * 1.2;
          p.z += cos(time * 0.3 + seed * 25.0) * 1.2;
          p.y += sin(time * 0.6 + seed * 12.0) * 0.5;
          vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * (1.2 + seed * 2.0) + seed * 30.0), 3.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.6 + seed * 1.8) * (30.0 / -mv.z) * 1.7;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 color; uniform float glow; uniform float amount; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          if (a < 0.02) discard;
          gl_FragColor = vec4(color * mix(1.0, glow, 0.6), a * vA * amount * 0.75);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, this.moteMat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  setWeather(w, instant = false) {
    this.weather = w;
    const s = SKY[w] || SKY.despejado;
    this.target = s;
    const modes = { lluvia: [1, 0xbcd4ff, 9], electrico: [1, 0xd8d8ff, 9], nieve: [2, 0xffffff, 7], arena: [3, 0xe8c080, 3.2], niebla: [2, 0xffd8f0, 5] };
    const md = modes[w];
    this.wPoints.visible = !!md;
    if (md) { this.wMat.uniforms.mode.value = md[0]; this.wMat.uniforms.color.value.setHex(md[1]); this.wMat.uniforms.size.value = md[2]; }
    if (instant) this.applySky(1);
    // Motas ambientales según el clima (chispas en tormenta, esporas rosas en niebla…).
    const mote = { despejado: [0xfff2b0, 1], sol: [0xffe08a, 1.2], lluvia: [0xcfe4ff, 0.35], electrico: [0xfff27a, 0.9], nieve: [0xffffff, 0], arena: [0xffd9a0, 0.4], niebla: [0xffc4ec, 1] }[w] || [0xfff2b0, 1];
    if (this.moteMat) { this.moteMat.uniforms.color.value.setHex(mote[0]); this.moteMat.uniforms.amount.value = mote[1]; }
  }

  applySky(k) {
    const s = this.target;
    const lerp = (col, hex) => col.lerp(new THREE.Color(hex), k);
    lerp(this.skyMat.uniforms.top.value, s.top);
    lerp(this.skyMat.uniforms.bot.value, s.bot);
    lerp(this.scene.fog.color, s.fog);
    this.waterMat.uniforms.fogColor.value.copy(this.scene.fog.color);
    const e = this.engine;
    e.sun.intensity += (s.sun - e.sun.intensity) * k;
    e.hemi.intensity += (s.hemi - e.hemi.intensity) * k;
    lerp(e.sun.color, s.sunCol);
    const dense = this.weather === 'niebla' || this.weather === 'arena' ? [22, 70] : [38, 90];
    this.scene.fog.near += (dense[0] - this.scene.fog.near) * k;
    this.scene.fog.far += (dense[1] - this.scene.fog.far) * k;
  }

  update(dt, t) {
    this.waterMat.uniforms.time.value = t;
    this.wMat.uniforms.time.value = t;
    if (this.moteMat) { this.moteMat.uniforms.time.value = t; this.moteMat.uniforms.glow.value = this.engine.glow; }
    this.applySky(Math.min(1, dt * 1.5));
    for (const c of this.clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 90) c.position.x = -90;
    }
    this.pondMat && (this.pondMat.uniforms.time.value = t);
    // Estandartes ondeando.
    if (this.banners) for (const bn of this.banners) {
      const p = bn.geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = bn.base[i * 3], y = bn.base[i * 3 + 1];
        p.setZ(i, Math.sin(x * 3.2 - t * 3.4 + bn.phase + y * 0.8) * 0.12 * x);
      }
      p.needsUpdate = true;
      bn.geo.computeVertexNormals();
    }
    // Relámpagos en tormenta eléctrica.
    if (this.weather === 'electrico' || this.weather === 'lluvia') {
      if (Math.random() < dt * (this.weather === 'electrico' ? 0.35 : 0.06)) this.flash = 1;
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.engine.hemi.intensity = this.target.hemi + this.flash * 2.5;
    }
  }

  // ───────── Resaltado de casillas ─────────
  clearHighlights() {
    const c = new THREE.Color();
    for (let i = 0; i < this.tileBase.length; i++) { c.setHex(this.tileBase[i]); this.tiles.setColorAt(i, c); }
    this.tiles.instanceColor.needsUpdate = true;
    for (const m of this.benchMat) m.color.setHex(0xe8d5a8);
    for (const r of this.benchRings) r.visible = false;
  }

  highlightHex(x, y, hex = 0x9be86a) {
    const i = y * COLS + x;
    this.tiles.setColorAt(i, new THREE.Color(hex));
    this.tiles.instanceColor.needsUpdate = true;
  }

  tintMySide(on) {
    const c = new THREE.Color();
    for (let y = 4; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      c.setHex(this.tileBase[i]);
      if (on) c.lerp(new THREE.Color(0xa8f090), 0.35);
      this.tiles.setColorAt(i, c);
    }
    this.tiles.instanceColor.needsUpdate = true;
  }

  highlightBench(i, hex = 0x9be86a) {
    if (!this.benchMat[i]) return;
    this.benchMat[i].color.setHex(hex);
    this.benchRings[i].visible = true;
    this.benchRings[i].material.color.setHex(hex);
  }
}
