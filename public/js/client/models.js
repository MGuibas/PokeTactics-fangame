// Constructor procedural de Pokémon a partir de primitivas (estilo juguete cel-shading).
// Cada forma se describe con una "spec" (ver specs.js). Las piezas se fusionan por grupo
// (torso, cabeza, cola, alas, brazos) en una única geometría con colores por vértice.
import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from './engine.js';
import { SPECS } from './specs.js';

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ───────────── Geometrías base ─────────────
const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  cone: new THREE.ConeGeometry(1, 1, 16, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.28, 10, 24),
  ring: new THREE.TorusGeometry(1, 0.14, 8, 28),
  halfTorus: new THREE.TorusGeometry(1, 0.28, 10, 16, Math.PI),
  oct: new THREE.OctahedronGeometry(1, 0),
  ico: new THREE.IcosahedronGeometry(1, 0),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
};
const capsCache = new Map();
function capsule(r, len) {
  const k = r.toFixed(3) + ':' + len.toFixed(3);
  if (!capsCache.has(k)) capsCache.set(k, new THREE.CapsuleGeometry(r, Math.max(0.001, len), 5, 12));
  return capsCache.get(k);
}
function extrudeShape(shape, depth = 0.06, bevel = 0.02) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}
// Rayo de la cola de Pikachu (en plano XY, sale hacia +Y).
G.bolt = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.12, 0); s.lineTo(0.12, 0); s.lineTo(0.05, 0.35); s.lineTo(0.32, 0.42);
  s.lineTo(0.18, 0.75); s.lineTo(0.5, 0.82); s.lineTo(0.3, 1.2); s.lineTo(-0.2, 1.1);
  s.lineTo(-0.02, 0.85); s.lineTo(-0.3, 0.8); s.lineTo(-0.1, 0.5); s.lineTo(-0.32, 0.45); s.closePath();
  return extrudeShape(s, 0.08, 0.025);
})();
// Ala de murciélago (plano XY, hacia +X).
G.batWing = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.35, 0.55); s.lineTo(1.0, 0.75);
  s.quadraticCurveTo(0.9, 0.45, 1.0, 0.2);
  s.quadraticCurveTo(0.78, 0.18, 0.7, -0.05);
  s.quadraticCurveTo(0.52, 0.0, 0.45, -0.28);
  s.quadraticCurveTo(0.22, -0.12, 0, -0.2);
  s.closePath();
  return extrudeShape(s, 0.04, 0.02);
})();
// Hoja (plano XY, hacia +Y).
G.leaf = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.42, 0.35, 0, 1);
  s.quadraticCurveTo(-0.42, 0.35, 0, 0);
  return extrudeShape(s, 0.05, 0.02);
})();
// Pluma (plano XY, hacia +Y), más ancha.
G.feather = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.08, 0);
  s.quadraticCurveTo(-0.32, 0.55, -0.12, 1);
  s.quadraticCurveTo(0.05, 1.08, 0.2, 0.95);
  s.quadraticCurveTo(0.3, 0.45, 0.08, 0);
  s.closePath();
  return extrudeShape(s, 0.05, 0.02);
})();
// Hoja de guadaña (Scyther).
G.blade = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.35, 0.3, 0.3, 1.0);
  s.quadraticCurveTo(0.1, 0.55, -0.1, 0.1);
  s.closePath();
  return extrudeShape(s, 0.05, 0.015);
})();
// Estrella de 5 puntas.
G.star = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.42 : 1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return extrudeShape(s, 0.25, 0.08);
})();
// Llama (gota puntiaguda).
G.flame = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - t * 0.55) * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, r), t));
  }
  pts[pts.length - 1].x = 0.001;
  return new THREE.LatheGeometry(pts, 14);
})();
G.halfSphere = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);

// ───────────── Paletas / colores ─────────────
function hsl(hex, dh = 0, ds = 0, dl = 0) {
  const c = new THREE.Color(hex);
  const o = {};
  c.getHSL(o);
  c.setHSL((o.h + dh + 1) % 1, Math.min(1, Math.max(0, o.s + ds)), Math.min(1, Math.max(0, o.l + dl)));
  return c.getHex();
}

// ───────────── Builder ─────────────
class Builder {
  constructor(spec, pal) {
    this.spec = spec;
    this.pal = pal;
    this.parts = [];
    this.pivots = { torso: V(), head: V(), tail: V(), wingL: V(), wingR: V(), armL: V(), armR: V(), aura: V() };
    this.maxY = 0;
  }
  col(c) {
    if (c === undefined || c === null) return this.pal.m;
    if (typeof c === 'number') return c;
    if (typeof c === 'string' && c[0] === '#') return parseInt(c.slice(1), 16);
    return this.pal[c] ?? this.pal.m;
  }
  add(group, geo, pos, scale, rot, color, opts = {}) {
    const m = new THREE.Matrix4();
    const q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler((rot?.[0] || 0) * D2R, (rot?.[1] || 0) * D2R, (rot?.[2] || 0) * D2R, 'YXZ'));
    const sc = typeof scale === 'number' ? V(scale, scale, scale) : Array.isArray(scale) ? V(...scale) : scale;
    m.compose(Array.isArray(pos) ? V(...pos) : pos, q, sc);
    this.parts.push({ group, geo, m, color: this.col(color), emit: opts.emit ? 1 : 0, alpha: opts.alpha });
    return this;
  }
  // Pieza con simetría en X.
  addM(group, geo, pos, scale, rot, color, opts) {
    const p = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z];
    const r = rot || [0, 0, 0];
    const gL = group === 'arm' ? 'armL' : group === 'wing' ? 'wingL' : group;
    const gR = group === 'arm' ? 'armR' : group === 'wing' ? 'wingR' : group;
    this.add(gL, geo, [p[0], p[1], p[2]], scale, [r[0], r[1], r[2]], color, opts);
    const sc = Array.isArray(scale) ? scale : scale;
    this.add(gR, geo, [-p[0], p[1], p[2]], sc, [r[0], -r[1], -r[2]], color, opts);
    return this;
  }
  // Extremidad (cápsula) entre dos puntos.
  limb(group, a, b, r, color, opts) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    const mid = a.clone().add(b).multiplyScalar(0.5);
    return this.add(group, capsule(r, Math.max(0.001, len)), mid, 1, q, color, opts);
  }
  // Cono apuntando en una dirección desde la base.
  spike(group, base, dir, len, r, color, opts) {
    const d = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d);
    const pos = base.clone().add(d.clone().multiplyScalar(len / 2));
    return this.add(group, G.cone, pos, [r, len, r], q, color, opts);
  }
  // Forma plana (hoja/pluma/rayo) orientada: sale del punto base en dirección dir, con normal aproximada n.
  flat(group, geo, base, dir, len, width, color, roll = 0, opts) {
    const d = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d);
    if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), roll * D2R));
    return this.add(group, geo, base, [width, len, Math.min(1, Math.max(0.35, width))], q, color, opts);
  }
}

// Punto sobre una esfera: az (grados, 0 = frente, + = izquierda del modelo (+x)), el (grados, 0 = ecuador).
function onSphere(c, r, az, el) {
  const a = az * D2R, e = el * D2R;
  return V(c.x + Math.sin(a) * Math.cos(e) * r.x, c.y + Math.sin(e) * r.y, c.z + Math.cos(a) * Math.cos(e) * r.z);
}
function dirOnSphere(az, el) {
  const a = az * D2R, e = el * D2R;
  return V(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}
const R3 = (r) => (typeof r === 'number' ? V(r, r, r) : r);

// ───────────── Arquetipos ─────────────
function layout(b, s) {
  const A = {};
  const bo = s.body || {};
  const he = s.head || {};
  const le = s.legs || {};
  switch (s.arch || 'biped') {
    case 'biped': {
      const bw = 0.26 * (bo.w ?? 1), bh = 0.3 * (bo.h ?? 1), bd = 0.23 * (bo.d ?? 1);
      const legLen = 0.12 * (le.len ?? 1), legR = 0.085 * (le.r ?? 1);
      const hipY = le.k === 'none' ? 0.05 : legLen + legR * 1.2;
      A.body = { c: V(0, hipY + bh * 0.85 + (bo.y ?? 0), bo.z ?? 0), r: V(bw, bh, bd) };
      const hr = 0.27 * (he.r ?? 1);
      A.head = { c: V(he.x ?? 0, A.body.c.y + bh * 0.78 + hr * 0.72 + (he.y ?? 0), 0.03 + (he.z ?? 0) + A.body.c.z), r: V(hr * (he.sx ?? 1), hr * (he.sy ?? 1), hr * (he.sz ?? 1)) };
      A.neck = V(0, A.body.c.y + bh * 0.6, A.body.c.z);
      A.shoulder = V(bw * 0.86, A.body.c.y + bh * 0.3, A.body.c.z + 0.03);
      A.hip = V(bw * 0.5, hipY, 0);
      A.legLen = legLen; A.legR = legR;
      A.tail = V(0, A.body.c.y - bh * 0.5, A.body.c.z - bd * 0.85);
      A.tailDir = V(0, 0.25, -1);
      A.back = V(0, A.body.c.y + bh * 0.15, A.body.c.z - bd * 0.92);
      break;
    }
    case 'quad': {
      const bw = 0.22 * (bo.w ?? 1), bh = 0.2 * (bo.h ?? 1), bd = 0.34 * (bo.d ?? 1);
      const legLen = 0.16 * (le.len ?? 1), legR = 0.075 * (le.r ?? 1);
      A.body = { c: V(0, legLen + bh * 0.95 + (bo.y ?? 0), 0), r: V(bw, bh, bd) };
      const hr = 0.24 * (he.r ?? 1);
      A.head = { c: V(0, A.body.c.y + bh * 0.85 + hr * 0.55 + (he.y ?? 0), bd * 0.85 + hr * 0.35 + (he.z ?? 0)), r: V(hr * (he.sx ?? 1), hr * (he.sy ?? 1), hr * (he.sz ?? 1)) };
      A.neck = V(0, A.body.c.y + bh * 0.4, bd * 0.6);
      A.shoulder = V(bw * 0.7, A.body.c.y, bd * 0.55);
      A.legs4 = [V(bw * 0.6, 0, bd * 0.55), V(bw * 0.6, 0, -bd * 0.55)];
      A.legLen = legLen; A.legR = legR;
      A.tail = V(0, A.body.c.y + bh * 0.3, -bd * 0.92);
      A.tailDir = V(0, 0.6, -1);
      A.back = V(0, A.body.c.y + bh * 0.92, -bd * 0.05);
      break;
    }
    case 'float': {
      const r = 0.3 * (bo.w ?? 1);
      A.body = { c: V(0, 0.62 + (bo.y ?? 0), 0), r: V(r, r * (bo.h ?? 1), r * (bo.d ?? 1)) };
      if (he.sep) {
        const hr = 0.24 * (he.r ?? 1);
        A.head = { c: V(0, A.body.c.y + A.body.r.y * 0.8 + hr * 0.7 + (he.y ?? 0), 0.02 + (he.z ?? 0)), r: V(hr * (he.sx ?? 1), hr * (he.sy ?? 1), hr * (he.sz ?? 1)) };
      } else {
        A.head = { c: A.body.c.clone(), r: A.body.r.clone(), same: true };
      }
      A.neck = A.body.c.clone();
      A.shoulder = V(A.body.r.x * 0.95, A.body.c.y - A.body.r.y * 0.1, 0.05);
      A.tail = V(0, A.body.c.y - A.body.r.y * 0.6, -A.body.r.z * 0.8);
      A.tailDir = V(0, -0.2, -1);
      A.back = V(0, A.body.c.y + A.body.r.y * 0.3, -A.body.r.z * 0.9);
      A.float = true;
      break;
    }
    case 'bird': {
      const bw = 0.2 * (bo.w ?? 1), bh = 0.22 * (bo.h ?? 1), bd = 0.28 * (bo.d ?? 1);
      const legLen = 0.16 * (le.len ?? 1);
      A.body = { c: V(0, legLen + bh * 0.9 + (bo.y ?? 0), 0), r: V(bw, bh, bd), tilt: -20 };
      const hr = 0.18 * (he.r ?? 1);
      A.head = { c: V(0, A.body.c.y + bh * 0.9 + hr * 0.5 + (he.y ?? 0), bd * 0.55 + (he.z ?? 0)), r: V(hr * (he.sx ?? 1), hr * (he.sy ?? 1), hr * (he.sz ?? 1)) };
      A.neck = V(0, A.body.c.y + bh * 0.5, bd * 0.4);
      A.shoulder = V(bw * 0.8, A.body.c.y + bh * 0.35, bd * 0.1);
      A.hip = V(bw * 0.45, legLen, 0);
      A.legLen = legLen; A.legR = 0.03;
      A.tail = V(0, A.body.c.y - bh * 0.1, -bd * 0.9);
      A.tailDir = V(0, -0.1, -1);
      A.back = V(0, A.body.c.y + bh * 0.6, -bd * 0.3);
      break;
    }
    case 'serpent': {
      const r = 0.16 * (bo.w ?? 1);
      const hr = 0.22 * (he.r ?? 1);
      const hgt = bo.h ?? 1;
      const pts = [];
      const n = 11;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = Math.sin(t * Math.PI * 2.1) * 0.22 * (1 - t);
        const z = -0.45 + t * 0.7 + Math.cos(t * Math.PI * 1.4) * -0.18;
        const y = r * 0.7 + Math.pow(t, 1.8) * 0.75 * hgt;
        pts.push({ p: V(x, y, z), r: r * (0.35 + 0.75 * Math.sin(Math.PI * (0.15 + t * 0.75))) });
      }
      A.segs = pts;
      A.body = { c: pts[3].p.clone(), r: V(r, r, r) };
      const last = pts[n - 1].p;
      A.head = { c: V(0, last.y + hr * 0.6 + (he.y ?? 0), last.z + hr * 0.5 + (he.z ?? 0)), r: V(hr * (he.sx ?? 1), hr * (he.sy ?? 1), hr * (he.sz ?? 1.1)) };
      A.neck = last.clone();
      A.shoulder = V(r * 1.1, pts[7].p.y, pts[7].p.z);
      A.tail = pts[0].p.clone();
      A.tailDir = V(0, 0, -1);
      A.back = pts[6].p.clone().add(V(0, pts[6].r * 0.8, 0));
      break;
    }
    case 'fish': {
      const bw = 0.18 * (bo.w ?? 1), bh = 0.3 * (bo.h ?? 1), bd = 0.34 * (bo.d ?? 1);
      A.body = { c: V(0, 0.45 + (bo.y ?? 0), 0), r: V(bw, bh, bd) };
      A.head = { c: A.body.c.clone().add(V(0, 0.02, bd * 0.35)), r: V(bw, bh * 0.8, bd * 0.7), same: true };
      A.neck = A.body.c.clone();
      A.shoulder = V(bw * 0.9, A.body.c.y - bh * 0.2, bd * 0.2);
      A.tail = V(0, A.body.c.y, -bd * 0.9);
      A.tailDir = V(0, 0, -1);
      A.back = V(0, A.body.c.y + bh * 0.95, 0);
      A.float = true;
      break;
    }
  }
  return A;
}

function buildBody(b, s, A) {
  const arch = s.arch || 'biped';
  const bo = s.body || {};
  if (arch === 'serpent') {
    // Segmentos: la mitad inferior al torso, los últimos 3 al grupo cabeza (cuello).
    A.segs.forEach((sg, i) => {
      const grp = i >= A.segs.length - 3 ? 'head' : i < 3 ? 'tail' : 'torso';
      b.add(grp, G.sphere, sg.p, [sg.r * 1.05, sg.r, sg.r * 1.1], null, 'm');
      if (s.belly !== false) b.add(grp, G.sphere, sg.p.clone().add(V(0, -sg.r * 0.12, sg.r * 0.28)), [sg.r * 0.82, sg.r * 0.8, sg.r * 0.85], null, 'b');
    });
    return;
  }
  const c = A.body.c, r = A.body.r;
  const tilt = A.body.tilt || bo.tilt || 0;
  if (!(arch === 'float' && s.body?.hide)) {
    b.add('torso', G[bo.shape || 'sphere'], c, r, [tilt, 0, 0], bo.c || 'm');
  }
  // Barriga.
  if (s.belly && arch !== 'fish') {
    const bl = s.belly === true ? {} : s.belly;
    const off = arch === 'quad' ? V(0, -r.y * 0.3, r.z * 0.2) : V(0, -r.y * 0.1 + (bl.y ?? 0), r.z * 0.32);
    const sc = arch === 'quad' ? V(r.x * 0.85, r.y * 0.78, r.z * 0.85) : V(r.x * (bl.w ?? 0.8), r.y * (bl.h ?? 0.78), r.z * 0.75);
    b.add('torso', G.sphere, c.clone().add(off), sc, [tilt, 0, 0], bl.c || 'b');
  }
  if (arch === 'fish' && s.belly) {
    b.add('torso', G.sphere, c.clone().add(V(0, -r.y * 0.25, r.z * 0.1)), V(r.x * 0.92, r.y * 0.72, r.z * 0.85), null, 'b');
  }
}

function buildHead(b, s, A) {
  const he = s.head || {};
  const h = A.head;
  if (!h.same) {
    b.add('head', G.sphere, h.c, h.r, [he.tilt || 0, 0, 0], he.c || 'm');
  }
  // Hocico.
  if (s.snout) {
    const sn = s.snout;
    const sp = h.c.clone().add(V(0, -h.r.y * (sn.y ?? 0.28), h.r.z * (sn.z ?? 0.72)));
    b.add('head', G.sphere, sp, [h.r.x * (sn.w ?? 0.55), h.r.y * (sn.h ?? 0.42), h.r.z * (sn.len ?? 0.55)], null, sn.c || 'm');
    if (sn.nose) b.add('head', G.sphere, sp.clone().add(V(0, h.r.y * (sn.h ?? 0.42) * 0.55, h.r.z * (sn.len ?? 0.55) * 0.85)), h.r.x * 0.1, null, sn.nose);
  }
  // Pico.
  if (s.beak) {
    const bk = s.beak;
    const bp = h.c.clone().add(V(0, -h.r.y * (bk.y ?? 0.15), h.r.z * 0.85));
    b.add('head', G.cone, bp.clone().add(V(0, 0, (bk.len ?? 0.14) * 0.45)), [bk.w ?? 0.07, bk.len ?? 0.14, (bk.w ?? 0.07) * 0.8], [90 + (bk.down ?? 15), 0, 0], bk.c || '#e8b040');
  }
  // Cara (zona de color en la parte baja/frontal).
  if (s.face) {
    const f = s.face === true ? {} : s.face;
    b.add('head', G.sphere, h.c.clone().add(V(0, -h.r.y * (f.y ?? 0.2), h.r.z * (f.z ?? 0.35))), [h.r.x * (f.w ?? 0.8), h.r.y * (f.h ?? 0.7), h.r.z * 0.7], null, f.c || 'b');
  }
  // Ojos.
  const ey = s.eyes || {};
  if (ey.k !== 'none') {
    const az = ey.spread ?? 30, el = ey.el ?? 8;
    const size = (ey.size ?? 1) * Math.min(h.r.x, h.r.y) * 0.2;
    for (const sgn of ey.one ? [0] : [1, -1]) {
      const p = onSphere(h.c, h.r, az * sgn, el);
      const n = dirOnSphere(az * sgn, el);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n);
      if (ey.k === 'closed') {
        const q2 = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), sgn * (ey.angle ?? 0) * D2R));
        b.add('head', G.box, p, [size * 1.8, size * 0.28, size * 0.4], q2, '#1a1420');
        continue;
      }
      if (ey.sclera) {
        b.add('head', G.sphere, p.clone().add(n.clone().multiplyScalar(-size * 0.2)), [size * 1.25, size * (ey.tall ?? 1.25) * 1.1, size * 0.55], q, ey.sclera);
      }
      const ec = ey.c ?? '#1a1420';
      const ep = p.clone().add(n.clone().multiplyScalar(size * 0.08));
      b.add('head', G.sphere, ep, [size * (ey.sclera ? 0.62 : 0.85), size * (ey.tall ?? 1.25) * (ey.sclera ? 0.8 : 1), size * 0.55], q, ec);
      if (ey.pupil) b.add('head', G.sphere, ep.clone().add(n.clone().multiplyScalar(size * 0.25)), [size * 0.3, size * 0.45, size * 0.3], q, ey.pupil);
      // Brillo.
      const hl = ep.clone().add(n.clone().multiplyScalar(size * 0.42)).add(V(sgn * size * 0.2, size * 0.35, 0));
      b.add('head', G.sphere, hl, size * 0.28, null, '#ffffff', { emit: true });
      if (ey.angry) {
        const bp = p.clone().add(V(0, size * 1.25, 0)).add(n.clone().multiplyScalar(size * 0.2));
        const qb = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), sgn * -22 * D2R));
        b.add('head', G.box, bp, [size * 1.9, size * 0.35, size * 0.5], qb, ey.brow ?? '#1a1420');
      }
    }
  }
  // Mejillas.
  if (s.cheeks) {
    for (const sgn of [1, -1]) {
      const p = onSphere(h.c, h.r, 52 * sgn, -18);
      const n = dirOnSphere(52 * sgn, -18);
      b.add('head', G.sphere, p, [h.r.x * 0.2, h.r.y * 0.2, h.r.z * 0.08], new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n), s.cheeks);
    }
  }
  // Boca.
  if (s.mouth) {
    const mo = s.mouth === true ? { k: 'smile' } : s.mouth;
    const p = onSphere(h.c, h.r, 0, mo.el ?? -30);
    const n = dirOnSphere(0, mo.el ?? -30);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n);
    if (mo.k === 'grin') {
      b.add('head', G.sphere, p, [h.r.x * 0.55, h.r.y * 0.18, h.r.z * 0.1], q, '#2a0a1a');
      for (const sgn of [1, -1]) b.add('head', G.cone, p.clone().add(V(sgn * h.r.x * 0.22, h.r.y * 0.06, h.r.z * 0.04)), [h.r.x * 0.07, h.r.y * 0.14, h.r.x * 0.05], [180, 0, 0], '#ffffff');
    } else if (mo.k === 'jaw') {
      b.add('head', G.sphere, p.clone().add(V(0, -h.r.y * 0.05, 0)), [h.r.x * 0.42, h.r.y * 0.2, h.r.z * 0.2], q, '#b83040');
    } else if (mo.k === 'fangs') {
      for (const sgn of [1, -1]) b.add('head', G.cone, p.clone().add(V(sgn * h.r.x * 0.12, 0, 0)), [h.r.x * 0.06, h.r.y * 0.15, h.r.x * 0.05], [180, 0, 0], '#ffffff');
    } else {
      b.add('head', G.sphere, p, [h.r.x * 0.16, h.r.y * 0.08, h.r.z * 0.05], q, '#5a1a2a');
    }
  }
  // Orejas.
  if (s.ears) {
    const e = s.ears;
    const az = e.spread ?? 40, el = e.el ?? 55;
    for (const sgn of [1, -1]) {
      const base = onSphere(h.c, h.r, az * sgn, el);
      const out = dirOnSphere(az * sgn, el);
      const dir = out.clone().add(V(0, e.up ?? 0.6, -(e.back ?? 0.1))).normalize();
      const len = (e.len ?? 0.25), w = (e.w ?? 0.08);
      const col = e.c || 'm';
      switch (e.k) {
        case 'round':
          b.add('head', G.sphere, base.clone().add(dir.clone().multiplyScalar(len * 0.4)), [w * 1.4, len * 0.6, w * 0.6], new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir), col);
          if (e.inner) b.add('head', G.sphere, base.clone().add(dir.clone().multiplyScalar(len * 0.42)).add(V(0, 0, w * 0.25)), [w * 0.9, len * 0.4, w * 0.35], new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir), e.inner);
          break;
        case 'fin':
        case 'leaf':
          b.flat('head', G.leaf, base, dir, len, w * 4, col, sgn * 90);
          break;
        case 'fluffy':
          for (let k = 0; k < 4; k++) {
            const d2 = dir.clone().add(V(0, 0, -k * 0.35)).normalize();
            b.add('head', G.sphere, base.clone().add(d2.clone().multiplyScalar(len * (0.3 + k * 0.22))), w * (1.3 - k * 0.15), null, col);
          }
          break;
        default: {
          b.spike('head', base, dir, len, w, col);
          if (e.tip) {
            const tipBase = base.clone().add(dir.clone().multiplyScalar(len * (1 - (e.tipLen ?? 0.35))));
            b.spike('head', tipBase, dir, len * (e.tipLen ?? 0.35) * 1.02, w * (e.tipLen ?? 0.35) * 1.08, e.tip);
          }
          if (e.inner) b.spike('head', base.clone().add(V(0, 0, w * 0.35)), dir, len * 0.75, w * 0.55, e.inner);
        }
      }
    }
  }
  // Cuernos / crestas (lista).
  for (const hn of s.horns || []) {
    const az = hn.az ?? 0, el = hn.el ?? 70;
    const pairs = hn.pair ? [1, -1] : [1];
    for (const sgn of pairs) {
      const base = onSphere(h.c, h.r, az * sgn, el);
      const dir = (hn.dir ? V(hn.dir[0] * sgn, hn.dir[1], hn.dir[2]) : dirOnSphere(az * sgn, el)).normalize();
      if (hn.k === 'leaf') b.flat('head', G.leaf, base, dir, hn.len ?? 0.3, (hn.w ?? 0.1) * 4, hn.c || 'a', hn.roll ?? 0);
      else if (hn.k === 'feather') b.flat('head', G.feather, base, dir, hn.len ?? 0.3, (hn.w ?? 0.1) * 3, hn.c || 'a', hn.roll ?? 90);
      else if (hn.k === 'ball') b.add('head', G.sphere, base.clone().add(dir.clone().multiplyScalar(hn.len ?? 0.08)), hn.w ?? 0.06, null, hn.c || 'a', { emit: hn.emit });
      else b.spike('head', base, dir, hn.len ?? 0.2, hn.w ?? 0.05, hn.c || 'a', { emit: hn.emit });
    }
  }
}

function buildLimbs(b, s, A) {
  const arch = s.arch || 'biped';
  const le = s.legs || {};
  const lc = le.c || 'm';
  if (le.k !== 'none') {
    if (arch === 'biped') {
      for (const sgn of [1, -1]) {
        const hip = V(A.hip.x * sgn * (le.spread ?? 1), A.hip.y + 0.02, A.body.c.z);
        const foot = V(hip.x, A.legR * 0.9, A.body.c.z + 0.02);
        b.limb('torso', hip, foot, A.legR, lc);
        b.add('torso', G.sphere, V(foot.x, A.legR * 0.55, foot.z + A.legR * 0.5), [A.legR * 1.25, A.legR * 0.7, A.legR * 1.7], null, le.foot || lc);
        if (le.claws) for (const k of [-1, 0, 1]) b.spike('torso', V(foot.x + k * A.legR * 0.55, A.legR * 0.4, foot.z + A.legR * 1.9), V(0, -0.2, 1), A.legR * 0.7, A.legR * 0.22, le.claws);
      }
    } else if (arch === 'quad') {
      for (const lp of A.legs4) for (const sgn of [1, -1]) {
        const top = V(lp.x * sgn, A.body.c.y - A.body.r.y * 0.3, lp.z);
        const bot = V(lp.x * sgn, A.legR * 0.9, lp.z + 0.02);
        b.limb('torso', top, bot, A.legR, lc);
        b.add('torso', G.sphere, V(bot.x, A.legR * 0.6, bot.z + A.legR * 0.35), [A.legR * 1.2, A.legR * 0.7, A.legR * 1.45], null, le.foot || lc);
      }
    } else if (arch === 'bird') {
      for (const sgn of [1, -1]) {
        const hip = V(A.hip.x * sgn, A.body.c.y - A.body.r.y * 0.6, 0.02);
        const foot = V(A.hip.x * sgn, 0.03, 0.06);
        b.limb('torso', hip, foot, 0.028, le.c || '#e0a040');
        for (const k of [-1, 0, 1]) b.spike('torso', foot, V(k * 0.5, -0.05, 1), 0.09, 0.02, le.c || '#e0a040');
      }
    } else if (arch === 'float' && le.k === 'stub') {
      for (const sgn of [1, -1]) {
        b.add('torso', G.sphere, V(A.body.r.x * 0.45 * sgn, A.body.c.y - A.body.r.y * 0.92, 0.05), [0.08, 0.06, 0.11], null, lc);
      }
    }
  }
  // Brazos.
  const ar = s.arms || {};
  const armsAllowed = arch === 'biped' || (['float', 'serpent', 'bird'].includes(arch) && ar.k && ar.k !== 'none');
  if (!armsAllowed || ar.k === 'none') return;
  const ac = ar.c || 'm';
  const r = 0.055 * (ar.r ?? 1);
  const len = 0.17 * (ar.len ?? 1);
  const sh = A.shoulder.clone();
  if (ar.y) sh.y += ar.y;
  if (ar.x) sh.x += ar.x;
  b.pivots.armL.copy(V(sh.x, sh.y, sh.z));
  b.pivots.armR.copy(V(-sh.x, sh.y, sh.z));
  const sets = ar.k === 'four' ? [0, -0.14] : [0];
  for (const dy of sets) {
    const s0 = sh.clone().add(V(0, dy, 0));
    const hand = ar.dir ? s0.clone().add(V(...ar.dir).multiplyScalar(len)) : s0.clone().add(V(0.07 * (ar.out ?? 1), -len, 0.08 + (ar.fwd ?? 0)));
    for (const sgn of [1, -1]) {
      const g = sgn > 0 ? 'armL' : 'armR';
      const a = V(s0.x * sgn, s0.y, s0.z), h = V(hand.x * sgn, hand.y, hand.z);
      if (ar.k === 'blade') {
        b.limb(g, a, h, r * 0.8, ac);
        b.flat(g, G.blade, h, V(0.2 * sgn, 0.9, 0.5), 0.35 * (ar.bl ?? 1), 0.35, ar.c2 || '#e8f0e0', sgn * 90);
        continue;
      }
      if (ar.k === 'pincer') {
        b.limb(g, a, h, r * 0.9, ac);
        b.add(g, G.sphere, h.clone().add(V(0, -0.02, 0.08)), [0.1 * (ar.big ?? 1), 0.09 * (ar.big ?? 1), 0.14 * (ar.big ?? 1)], null, ar.c2 || ac);
        b.add(g, G.sphere, h.clone().add(V(0, 0.06, 0.12)), [0.06, 0.04, 0.1], null, ar.c2 || ac);
        continue;
      }
      if (ar.k === 'fin') {
        b.limb(g, a, h, r, ac);
        b.flat(g, G.leaf, a.clone().add(h).multiplyScalar(0.5), V(0.8 * sgn, -0.3, -0.5), 0.3, 0.35, ar.c2 || ac, sgn * 90);
        continue;
      }
      b.limb(g, a, h, r, ac);
      if (ar.hold === 'spoons' || (ar.hold === 'spoon' && sgn > 0)) {
        b.limb(g, h.clone().add(V(0, 0.02, 0)), h.clone().add(V(0.02 * sgn, 0.2, 0.06)), 0.014, '#c8d0d8');
        b.add(g, G.sphere, h.clone().add(V(0.025 * sgn, 0.25, 0.07)), [0.045, 0.06, 0.018], null, '#dfe6ee');
      }
      if (ar.k === 'fist' || ar.hand) b.add(g, G.sphere, h, r * (ar.fist ?? 1.5), null, ar.hand || ac);
      if (ar.k === 'claw' || ar.claws) for (const k of [-1, 0, 1]) b.spike(g, h, V(k * 0.35, -0.6, 0.8), r * 1.3, r * 0.3, ar.claws || '#f5f0e6');
    }
  }
}

function buildTail(b, s, A) {
  const t = s.tail;
  if (!t) return;
  const base = A.tail.clone();
  if (t.y) base.y += t.y;
  b.pivots.tail.copy(base);
  const dir = (t.dir ? V(...t.dir) : A.tailDir.clone()).normalize();
  const len = t.len ?? 0.35;
  const r = t.r ?? 0.07;
  const col = t.c || 'm';
  switch (t.k) {
    case 'flame': {
      const end = base.clone().add(dir.clone().multiplyScalar(len));
      b.limb('tail', base, end, r, col);
      b.add('tail', G.flame, end.clone().add(V(0, -0.02, 0)), [0.22 * (t.fs ?? 1), 0.38 * (t.fs ?? 1), 0.22 * (t.fs ?? 1)], null, '#ff9a2a', { emit: true });
      b.add('tail', G.flame, end.clone().add(V(0, 0.0, 0.01)), [0.13 * (t.fs ?? 1), 0.26 * (t.fs ?? 1), 0.13 * (t.fs ?? 1)], null, '#ffe46a', { emit: true });
      break;
    }
    case 'bolt': {
      if (t.stem) {
        const end = base.clone().add(dir.clone().multiplyScalar(len * 0.5));
        b.limb('tail', base, end, r * 0.6, t.stem);
        b.flat('tail', G.bolt, end, V(0, 1, -0.5), len * 0.8, len * 0.55, col, 90);
      } else {
        b.flat('tail', G.bolt, base, V(0, 1, -0.7), len, len * 0.7, col, 90);
        if (t.base) b.flat('tail', G.bolt, base, V(0, 1, -0.7), len * 0.3, len * 0.72, t.base, 90);
      }
      break;
    }
    case 'curl': {
      const c = base.clone().add(V(0, 0.08, -0.08));
      b.add('tail', G.halfTorus, c, [0.12 * len * 3, 0.12 * len * 3, 0.3], [0, 90, 90], col);
      b.add('tail', G.sphere, base.clone().add(V(0, 0.2 * len * 3, -0.05)), r * 1.1, null, col);
      break;
    }
    case 'fluffy': {
      const c = base.clone().add(dir.clone().multiplyScalar(len * 0.55)).add(V(0, len * 0.35, 0));
      b.add('tail', G.sphere, c, [len * 0.32 * (t.w ?? 1), len * 0.6, len * 0.4], [-(t.tilt ?? 35), 0, 0], col);
      if (t.tip) b.add('tail', G.sphere, c.clone().add(V(0, len * 0.42, -len * 0.18)), [len * 0.26, len * 0.3, len * 0.28], null, t.tip);
      break;
    }
    case 'leaf': {
      b.flat('tail', G.leaf, base, dir.clone().add(V(0, 0.6, 0)), len, len * 0.9, col, 90);
      break;
    }
    case 'fin': {
      const end = base.clone().add(dir.clone().multiplyScalar(len * 0.3));
      for (const sgn of [1, -1]) b.flat('tail', G.leaf, end, V(0, sgn * 0.8, -1), len * 0.7, len * 0.7, col, 90);
      break;
    }
    case 'feather': {
      for (const k of [-1, 0, 1]) b.flat('tail', G.feather, base, V(k * 0.35, -0.1, -1), len, len * 0.55, k === 0 ? (t.c2 || col) : col, 0);
      break;
    }
    case 'orb': {
      // Cola fina con bola al final.
      const mid = base.clone().add(dir.clone().multiplyScalar(len * 0.6)).add(V(0, len * 0.2, 0));
      const end = mid.clone().add(V(0, len * 0.35, -len * 0.25));
      b.limb('tail', base, mid, r, col);
      b.limb('tail', mid, end, r * 0.85, t.c2 || col);
      b.add('tail', G.sphere, end, t.orb ?? 0.08, null, t.tip || '#ff5a3a', { emit: !!t.glow });
      break;
    }
    default: {
      // Cola cónica curvada hecha de segmentos.
      const n = 5;
      let prev = base.clone();
      for (let i = 1; i <= n; i++) {
        const tt = i / n;
        const p = base.clone().add(dir.clone().multiplyScalar(len * tt)).add(V(0, Math.sin(tt * Math.PI * 0.8) * len * (t.curve ?? 0.25), 0));
        const rr = r * (1 - tt * 0.7);
        b.limb('tail', prev, p, Math.max(0.012, rr), i === n && t.tip ? t.tip : col);
        prev = p;
      }
      if (t.end === 'spike') b.spike('tail', prev, dir, 0.1, r * 0.6, t.tip || col);
      if (t.end === 'ball') b.add('tail', G.sphere, prev, r * 1.1, null, t.tip || col);
    }
  }
}

function buildWings(b, s, A) {
  const w = s.wings;
  if (!w) return;
  const sh = A.shoulder.clone().add(V(-0.02, 0.05 + (w.y ?? 0), -0.05 + (w.z ?? 0)));
  if (s.arch === 'serpent') sh.set(A.head.r.x * 0.5, A.head.c.y, A.head.c.z - 0.05);
  b.pivots.wingL.copy(V(sh.x, sh.y, sh.z));
  b.pivots.wingR.copy(V(-sh.x, sh.y, sh.z));
  const span = w.span ?? 0.5;
  const col = w.c || 'a';
  const grpOf = (sgn) => (s.arch === 'serpent' ? 'head' : sgn > 0 ? 'wingL' : 'wingR');
  for (const sgn of [1, -1]) {
    const g = grpOf(sgn);
    const base = V(sh.x * sgn, sh.y, sh.z);
    switch (w.k) {
      case 'bat': {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sgn > 0 ? -0.5 : Math.PI + 0.5, sgn > 0 ? 0.35 : -0.35, 'YXZ'));
        b.add(g, G.batWing, base, [span, span * 0.8, span], q, col);
        if (w.c2) b.add(g, G.batWing, base.clone().add(V(0, 0, -0.012)), [span * 0.8, span * 0.62, span * 1.2], q, w.c2);
        b.limb(g, base, base.clone().add(V(0.35 * span * sgn, 0.55 * span * 0.8, -0.2 * span)), 0.03, col);
        break;
      }
      case 'insect': {
        for (const k of [0, 1]) {
          const d = V(sgn * 1, 0.25 - k * 0.45, -0.6).normalize();
          b.flat(g, G.leaf, base, d, span * (1 - k * 0.2), span * 0.5, col, 90, { alpha: 0.55 });
        }
        break;
      }
      case 'diamond': {
        const d = V(sgn * 1, 0.1, -0.35).normalize();
        b.add(g, G.oct, base.clone().add(d.clone().multiplyScalar(span * 0.55)), [span * 0.5, 0.02, span * 0.3], new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d), col);
        if (w.c2) b.add(g, G.oct, base.clone().add(d.clone().multiplyScalar(span * 0.9)), [span * 0.14, 0.03, span * 0.1], new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d), w.c2);
        break;
      }
      case 'small': {
        const d = V(sgn * 0.8, 0.5, -0.5).normalize();
        b.flat(g, G.leaf, base, d, span, span * 0.8, col, 90);
        break;
      }
      default: {
        // Plumas en abanico.
        const n = w.n ?? 5;
        for (let k = 0; k < n; k++) {
          const tt = k / (n - 1);
          const d = V(sgn * (0.95 - tt * 0.3), 0.35 - tt * 0.75, -0.25 - tt * 0.35).normalize();
          const len = span * (1 - tt * 0.35);
          b.flat(g, G.feather, base, d, len, len * 0.45, k >= n - 2 && w.c2 ? w.c2 : col, 90);
        }
      }
    }
  }
}

function buildBack(b, s, A) {
  for (const bk of s.back || []) {
    const base = A.back.clone();
    if (bk.y) base.y += bk.y;
    if (bk.z) base.z += bk.z;
    const g = bk.g || 'torso';
    switch (bk.k) {
      case 'shell': {
        const r = A.body.r;
        b.add(g, G.sphere, V(0, A.body.c.y + (bk.y ?? 0), A.body.c.z - r.z * 0.35), [r.x * 1.12, r.y * 1.05, r.z * 0.95], null, bk.c || 'a');
        b.add(g, G.ring, V(0, A.body.c.y + (bk.y ?? 0), A.body.c.z - r.z * 0.3), [r.x * 1.1, r.y * 1.03, 0.6], [0, 0, 0], bk.rim || 'b');
        break;
      }
      case 'bulb': {
        const sz = bk.size ?? 0.2;
        b.add(g, G.sphere, base.clone().add(V(0, sz * 0.55, 0)), [sz, sz * 1.1, sz], null, bk.c || 'a');
        if (bk.stripes) for (let k = 0; k < 6; k++) {
          const a = (k / 6) * 360;
          b.add(g, G.sphere, base.clone().add(V(Math.sin(a * D2R) * sz * 0.6, sz * 0.7, Math.cos(a * D2R) * sz * 0.6)), [sz * 0.35, sz * 0.75, sz * 0.35], null, bk.stripes);
        }
        break;
      }
      case 'flower': {
        const sz = bk.size ?? 0.3;
        for (let k = 0; k < (bk.n ?? 5); k++) {
          const a = (k / (bk.n ?? 5)) * 360;
          const d = V(Math.sin(a * D2R), 0.25, Math.cos(a * D2R)).normalize();
          b.flat(g, G.leaf, base.clone().add(V(0, sz * 0.25, 0)), d, sz * 1.2, sz * 1.4, bk.c || '#f07898', 0);
        }
        b.add(g, G.sphere, base.clone().add(V(0, sz * 0.4, 0)), sz * 0.35, null, bk.center || '#f5e060');
        if (bk.leaves) for (let k = 0; k < 4; k++) {
          const a = (k / 4) * 360 + 45;
          const d = V(Math.sin(a * D2R), -0.1, Math.cos(a * D2R)).normalize();
          b.flat(g, G.leaf, base.clone().add(V(0, sz * 0.05, 0)), d, sz * 1.5, sz * 1.1, bk.leaves, 0);
        }
        break;
      }
      case 'spikes': {
        const n = bk.n ?? 3;
        for (let k = 0; k < n; k++) {
          const tt = n === 1 ? 0.5 : k / (n - 1);
          const pos = V(0, A.body.c.y + A.body.r.y * (0.8 - tt * 0.9), A.body.c.z - A.body.r.z * (0.35 + tt * 0.55));
          if (s.arch === 'quad') pos.set(0, A.body.c.y + A.body.r.y * 0.9, A.body.c.z + A.body.r.z * (0.5 - tt * 1.1));
          if (bk.pos) pos.add(V(...bk.pos));
          const d = V(0, 1, -0.6 - (bk.back ?? 0)).normalize();
          b.spike(g, pos, d, (bk.len ?? 0.15) * (1 - Math.abs(tt - 0.3) * (bk.taper ?? 0.4)), bk.w ?? 0.05, bk.c || 'a', { emit: bk.emit });
          if (bk.pair) for (const sgn of [1, -1]) b.spike(g, pos.clone().add(V(sgn * (bk.pair), -0.03, 0)), V(sgn * 0.5, 1, -0.6).normalize(), (bk.len ?? 0.15) * 0.8, bk.w ?? 0.05, bk.c || 'a', { emit: bk.emit });
        }
        break;
      }
      case 'flames': {
        const n = bk.n ?? 3;
        for (let k = 0; k < n; k++) {
          const a = n === 1 ? 0 : (k / (n - 1) - 0.5) * (bk.spread ?? 60);
          const p = base.clone().add(V(Math.sin(a * D2R) * 0.12, 0, 0));
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, -a * D2R * 0.8));
          b.add(g, G.flame, p, [0.2 * (bk.size ?? 1), 0.38 * (bk.size ?? 1), 0.2 * (bk.size ?? 1)], q, '#ff6a2a', { emit: true });
          b.add(g, G.flame, p.clone().add(V(0, 0.01, 0.02)), [0.12 * (bk.size ?? 1), 0.26 * (bk.size ?? 1), 0.12 * (bk.size ?? 1)], q, '#ffd84a', { emit: true });
        }
        break;
      }
      case 'collar': {
        // Anillo de llamas/pelo alrededor del cuello.
        const n = bk.n ?? 8;
        const c = A.neck.clone().add(V(0, bk.y ?? 0, bk.z ?? 0));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * 360;
          const d = V(Math.sin(a * D2R), 0.1, Math.cos(a * D2R));
          const p = c.clone().add(d.clone().multiplyScalar(bk.r ?? 0.2));
          if (bk.petals) {
            b.flat(g, G.leaf, c.clone().add(d.clone().multiplyScalar((bk.r ?? 0.2) * 0.5)), d.clone().add(V(0, 0.35, 0)), bk.size ?? 0.22, (bk.size ?? 0.22) * 1.3, bk.c || '#f07898', 0);
          } else if (bk.fire) {
            b.add(g, G.flame, p, [0.12, 0.3, 0.12], new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().add(V(0, 1.2, 0)).normalize()), k % 2 ? '#ffd84a' : '#ff6a2a', { emit: true });
          } else {
            b.add(g, G.sphere, p, bk.size ?? 0.1, null, bk.c || 'b');
          }
        }
        break;
      }
      case 'cannons': {
        for (const sgn of [1, -1]) {
          const p = V(sgn * A.body.r.x * 0.55, A.body.c.y + A.body.r.y * 0.85, A.body.c.z - A.body.r.z * 0.3);
          b.add(g, G.cyl, p.clone().add(V(0, 0.02, 0.05)), [0.055, 0.28, 0.055], [70, 0, 0], '#9aa4b0');
          b.add(g, G.ring, p.clone().add(V(0, 0.06, 0.16)), [0.06, 0.06, 0.6], [70 - 90, 0, 0], '#6a7480');
        }
        break;
      }
      case 'wool': {
        const n = bk.n ?? 7;
        const r = A.body.r;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * 360;
          const p = A.body.c.clone().add(V(Math.sin(a * D2R) * r.x * 0.7, r.y * (0.3 + (k % 2) * 0.25), Math.cos(a * D2R) * r.z * 0.6));
          b.add(g, G.sphere, p, (bk.size ?? 0.14) * (1 + (k % 3) * 0.12), null, bk.c || 'b');
        }
        b.add(g, G.sphere, A.body.c.clone().add(V(0, r.y * 0.45, 0)), [r.x * 1.05, r.y * 0.9, r.z * 1.05], null, bk.c || 'b');
        break;
      }
      case 'plates': {
        const n = bk.n ?? 3;
        for (let k = 0; k < n; k++) {
          const tt = k / Math.max(1, n - 1);
          const p = V(0, A.body.c.y + A.body.r.y * (0.7 - tt * 0.4), A.body.c.z + A.body.r.z * (0.3 - tt * 0.9));
          b.add(g, G.oct, p, [bk.w ?? 0.12, bk.len ?? 0.14, 0.04], [-(20 + tt * 20), 0, 0], bk.c || 'a');
        }
        break;
      }
      case 'seeds': {
        for (let k = 0; k < (bk.n ?? 6); k++) {
          const tt = k / ((bk.n ?? 6) - 1);
          const sgn = k % 2 ? 1 : -1;
          b.add(g, G.sphere, V(sgn * 0.06, A.body.c.y + A.body.r.y * (0.6 - tt * 0.8), A.body.c.z - A.body.r.z * 0.95), bk.size ?? 0.06, null, bk.c || '#f0d040');
        }
        break;
      }
    }
  }
}

function buildParts(b, s, A) {
  for (const p of s.parts || []) {
    const anchor = p.at === 'head' ? A.head.c : p.at === 'body' ? A.body.c : p.at === 'tail' ? A.tail : p.at === 'neck' ? A.neck : V();
    const rel = p.at === 'head' ? A.head.r.x / 0.27 : 1; // escala relativa a la cabeza estándar
    const pos = anchor.clone().add(V(...(p.p || [0, 0, 0])).multiplyScalar(p.abs ? 1 : rel));
    const geo = p.s === 'caps' ? capsule(p.cr ?? 0.05, p.cl ?? 0.2) : G[p.s || 'sphere'];
    const sc = typeof p.sc === 'number' ? p.sc * (p.abs ? 1 : rel) : V(...(p.sc || [0.1, 0.1, 0.1])).multiplyScalar(p.abs ? 1 : rel);
    const grp = p.g || (p.at === 'head' ? 'head' : 'torso');
    const opts = { emit: p.emit, alpha: p.alpha };
    b.add(grp, geo, pos, sc, p.r || [0, 0, 0], p.c, opts);
    if (p.m) {
      const g2 = grp === 'armL' ? 'armR' : grp === 'wingL' ? 'wingR' : grp;
      const pr = p.p || [0, 0, 0];
      const pos2 = anchor.clone().add(V(-pr[0], pr[1], pr[2]).multiplyScalar(p.abs ? 1 : rel));
      const r = p.r || [0, 0, 0];
      b.add(g2, geo, pos2, sc, [r[0], -r[1], -r[2]], p.c, opts);
    }
  }
}

// Aura translúcida (fantasmas, gigamax…)
function buildAura(b, s, A) {
  if (!s.aura) return;
  const a = s.aura;
  const c = A.body.c.clone();
  const r = Math.max(A.body.r.x, A.body.r.y) * (a.size ?? 1.35);
  b.add('aura', G.sphere, c, [r, r * (a.h ?? 1), r], null, a.c || 'a', { alpha: a.alpha ?? 0.35 });
}

// ───────────── Merge y caché ─────────────
function mergeGroup(parts) {
  let count = 0;
  const geos = parts.map((p) => {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.applyMatrix4(p.m);
    count += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const emit = new Float32Array(count);
  let o = 0;
  const c = new THREE.Color();
  geos.forEach((g, i) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    c.setHex(parts[i].color);
    for (let k = 0; k < n; k++) {
      col[(o + k) * 3] = c.r; col[(o + k) * 3 + 1] = c.g; col[(o + k) * 3 + 2] = c.b;
      emit[o + k] = parts[i].emit;
    }
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
  const on = new Float32Array(count * 3);
  const keyOf = (i) => `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
  for (let i = 0; i < count; i++) {
    const k = keyOf(i);
    let a = map.get(k);
    if (!a) { a = [0, 0, 0]; map.set(k, a); }
    a[0] += nor[i * 3]; a[1] += nor[i * 3 + 1]; a[2] += nor[i * 3 + 2];
  }
  for (let i = 0; i < count; i++) {
    const a = map.get(keyOf(i));
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    on[i * 3] = a[0] / l; on[i * 3 + 1] = a[1] / l; on[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('onormal', new THREE.BufferAttribute(on, 3));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

function paletteFor(spec, shiny) {
  const p = { m: 0xcccccc, b: 0xf0f0f0, a: 0x888888, d: 0x333333, e: 0xffffff, ...spec.pal };
  if (shiny) {
    if (spec.shiny) Object.assign(p, spec.shiny);
    else for (const k of ['m', 'a']) p[k] = hsl(p[k], 0.42, 0.05, 0.02);
  }
  return p;
}

function resolveSpec(id) {
  let s = SPECS[id];
  if (!s) return { arch: 'biped', pal: { m: 0xaaaaaa }, size: 1, missing: true };
  if (s.base) {
    const parent = resolveSpec(s.base);
    const merged = { ...parent, ...s };
    for (const k of ['pal', 'body', 'head', 'legs', 'arms', 'eyes', 'tail', 'wings', 'ears', 'snout']) {
      if (s[k] === null) merged[k] = null;
      else if (parent[k] && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) merged[k] = { ...parent[k], ...s[k] };
    }
    delete merged.base;
    return merged;
  }
  return s;
}

const cache = new Map();
export function buildModelData(formId, shiny = false) {
  const k = formId + (shiny ? ':s' : '');
  if (cache.has(k)) return cache.get(k);
  const spec = resolveSpec(formId);
  const pal = paletteFor(spec, shiny);
  const b = new Builder(spec, pal);
  const A = layout(b, spec);
  b.pivots.head.copy(A.neck);
  b.pivots.tail.copy(A.tail);
  buildBody(b, spec, A);
  buildHead(b, spec, A);
  buildLimbs(b, spec, A);
  buildTail(b, spec, A);
  buildWings(b, spec, A);
  buildBack(b, spec, A);
  buildParts(b, spec, A);
  buildAura(b, spec, A);
  const groups = {};
  for (const p of b.parts) {
    const g = p.alpha ? 'aura' : p.group;
    (groups[g] ||= []).push(p);
  }
  const out = { groups: [], size: spec.size ?? 1, float: !!A.float || !!spec.float, arch: spec.arch || 'biped', spec };
  let minY = Infinity, maxY = -Infinity, maxR = 0;
  for (const [name, parts] of Object.entries(groups)) {
    const geo = mergeGroup(parts);
    const pivot = b.pivots[name] || V();
    geo.translate(-pivot.x, -pivot.y, -pivot.z);
    const bb = geo.boundingBox;
    minY = Math.min(minY, bb.min.y + pivot.y);
    maxY = Math.max(maxY, bb.max.y + pivot.y);
    maxR = Math.max(maxR, Math.abs(bb.min.x + pivot.x), Math.abs(bb.max.x + pivot.x), Math.abs(bb.min.z + pivot.z), Math.abs(bb.max.z + pivot.z));
    out.groups.push({ name, geo, pivot, alpha: name === 'aura' ? (parts[0].alpha ?? 0.4) : 0 });
  }
  out.height = maxY;
  out.minY = minY;
  out.radius = maxR;
  cache.set(k, out);
  return out;
}

// Instancia un modelo con su propio material (para destellos/tintes).
export function createModel(formId, shiny = false, opts = {}) {
  const data = buildModelData(formId, shiny);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mat = toonMaterial({ vertexColors: true, emitAttr: true, rim: 0.3 });
  mat.emissive = new THREE.Color(0x000000);
  const outline = outlineMaterial(0x1a1420, opts.outline ?? 2.2);
  const rig = {};
  let auraMat = null;
  const meshes = [];
  for (const g of data.groups) {
    const pivot = new THREE.Group();
    pivot.position.copy(g.pivot);
    let mesh;
    if (g.name === 'aura') {
      auraMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: g.alpha, depthWrite: false });
      mesh = new THREE.Mesh(g.geo, auraMat);
    } else {
      mesh = new THREE.Mesh(g.geo, mat);
      const ol = new THREE.Mesh(g.geo, outline);
      ol.renderOrder = -1;
      mesh.add(ol);
      meshes.push(ol);
    }
    pivot.add(mesh);
    body.add(pivot);
    rig[g.name] = pivot;
  }
  // La cabeza, cola, alas y brazos deben colgar del cuerpo para heredar su animación.
  // Comprime el rango de tamaños: bebés no diminutos, legendarios no gigantes.
  const scale = (0.5 + data.size * 0.5) * (opts.scale ?? 1);
  root.scale.setScalar(scale);
  return { root, body, rig, mat, auraMat, outlineMeshes: meshes, data, height: data.height * scale, radius: data.radius * scale, float: data.float };
}

export function hasSpec(formId) { return !!SPECS[formId]; }
