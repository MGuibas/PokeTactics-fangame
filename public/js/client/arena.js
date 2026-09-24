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
          float ring = smoothstep(0.5, 0.0, abs(d - 18.2 - sin(time*1.4 + atan(vW.z, vW.x)*6.0)*0.25));
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

  buildIsland() {
    const ol = outlineMaterial(0x1a1420, 2.4);
    const grass = toonMaterial({ color: 0x7ccb5a, rim: 0.1 });
    const dirt = toonMaterial({ color: 0xa07048, rim: 0.1 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(17, 17.4, 0.9, 48), grass);
    top.position.y = -0.55;
    this.group.add(top);
    const side = new THREE.Mesh(new THREE.CylinderGeometry(17.2, 13.5, 3.2, 48), dirt);
    side.position.y = -2.4;
    this.group.add(side);
    for (const m of [top, side]) this.addOutline(m, ol);
    // Plataforma de piedra bajo el tablero.
    const stone = toonMaterial({ color: 0xd9d2bc, rim: 0.1 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.6, 0.5, 6), stone);
    plat.rotation.y = Math.PI / 6;
    plat.scale.set(1, 1, 0.98);
    plat.position.y = -0.25;
    this.group.add(plat);
    this.addOutline(plat, ol);
  }

  addOutline(mesh, mat) {
    const g = mesh.geometry;
    if (!g.attributes.onormal) g.setAttribute('onormal', g.attributes.normal);
    const o = new THREE.Mesh(g, mat);
    o.renderOrder = -1;
    mesh.add(o);
  }

  buildBoard() {
    const geo = new THREE.CylinderGeometry(HEX * 0.94, HEX * 0.98, 0.22, 6);
    geo.setAttribute('onormal', geo.attributes.normal);
    this.tileMat = toonMaterial({ color: 0xffffff, rim: 0.05 });
    const n = COLS * ROWS;
    this.tiles = new THREE.InstancedMesh(geo, this.tileMat, n);
    this.tileBase = [];
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const p = hexToWorld(x, y);
      m.makeTranslation(p.x, 0, p.z);
      this.tiles.setMatrixAt(i, m);
      const mine = y >= 4;
      const alt = (x + y) % 2 === 0;
      c.setHex(mine ? (alt ? 0xf2ead2 : 0xe6dcbe) : (alt ? 0xdfe6ef : 0xd0d9e6));
      this.tileBase[i] = c.getHex();
      this.tiles.setColorAt(i, c);
    }
    this.tiles.instanceColor.needsUpdate = true;
    this.group.add(this.tiles);
    const ol = new THREE.InstancedMesh(geo, outlineMaterial(0x6a5a4a, 1.4), n);
    for (let i = 0; i < n; i++) { this.tiles.getMatrixAt(i, m); ol.setMatrixAt(i, m); }
    ol.renderOrder = -1;
    this.group.add(ol);
    // Línea central decorativa (Poké Ball).
    const lineMat = toonMaterial({ color: 0xe3350d, rim: 0 });
    const line = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.05, 0.12), lineMat);
    line.position.set(0, 0.13, 0);
    this.group.add(line);
    const ballG = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24);
    const ball = new THREE.Mesh(ballG, toonMaterial({ color: 0xffffff }));
    ball.position.set(-6.6, 0.14, 0);
    const ball2 = ball.clone(); ball2.position.x = 6.6;
    this.group.add(ball, ball2);
  }

  buildBench() {
    const wood = toonMaterial({ color: 0xb07a4a, rim: 0.1 });
    const ol = outlineMaterial(0x1a1420, 2.0);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.35, 1.9), wood);
    plank.position.set(0, -0.2, 8.05);
    this.group.add(plank);
    this.addOutline(plank, ol);
    const padGeo = new THREE.CylinderGeometry(0.7, 0.74, 0.14, 20);
    padGeo.setAttribute('onormal', padGeo.attributes.normal);
    this.benchMat = [];
    this.benchPads = [];
    for (let i = 0; i < 9; i++) {
      const mat = toonMaterial({ color: 0xe8d5a8, rim: 0.05 });
      const pad = new THREE.Mesh(padGeo, mat);
      const p = benchToWorld(i);
      pad.position.set(p.x, 0.02, p.z);
      this.group.add(pad);
      this.addOutline(pad, outlineMaterial(0x6a4a2a, 1.4));
      this.benchPads.push(pad);
      this.benchMat.push(mat);
    }
  }

  buildDecor() {
    const ol = outlineMaterial(0x1a1420, 2.2);
    const trunk = toonMaterial({ color: 0x8a5a36 });
    const leafCols = [0x4fae4a, 0x3f9e5a, 0x6ac04a, 0xe890b0];
    const add = (mesh) => { this.group.add(mesh); this.addOutline(mesh, ol); return mesh; };
    const tree = (x, z, s, col) => {
      const t = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.25 * s, 1.4 * s, 8), trunk));
      t.position.set(x, 0.6 * s - 0.2, z);
      const lm = toonMaterial({ color: col });
      for (let k = 0; k < 3; k++) {
        const c = add(new THREE.Mesh(new THREE.SphereGeometry(0.9 * s * (1 - k * 0.2), 14, 10), lm));
        c.position.set(x + (k - 1) * 0.3 * s, 1.5 * s + k * 0.55 * s - 0.2, z + (k % 2) * 0.2 * s);
      }
    };
    const spots = [[-14, -6], [-13.5, 2], [-12, 10], [14, -5], [13.8, 3], [12.2, 11], [-9, -13.5], [9.5, -13], [0, -15.2], [-15.5, -1.5], [15.2, -10]];
    spots.forEach(([x, z], i) => tree(x, z, 0.9 + (i % 3) * 0.25, leafCols[i % leafCols.length]));
    const rockM = toonMaterial({ color: 0xa8a49a });
    for (const [x, z, s] of [[-11.5, -9, 0.8], [11, 7.5, 0.6], [-10.2, 5.5, 0.5], [10.5, -9.5, 0.9], [5, -14.8, 0.7]]) {
      const r = add(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockM));
      r.position.set(x, s * 0.4 - 0.1, z);
      r.rotation.set(Math.random(), Math.random(), 0);
    }
    // Flores.
    const fl = [0xffe060, 0xff7aa8, 0xffffff, 0xa87aff];
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10.2 + Math.random() * 6;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMaterial({ color: fl[i % 4] }));
      m.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      if (Math.abs(m.position.x) < 8.5 && m.position.z > 6) continue;
      this.group.add(m);
    }
    // Islas flotantes lejanas.
    const grass = toonMaterial({ color: 0x86d060 });
    const dirt = toonMaterial({ color: 0x9a6a44 });
    for (const [x, y, z, s] of [[-40, 4, -40, 1.4], [44, 7, -30, 1.1], [-30, 10, 30, 0.8], [38, 2, 26, 1.0]]) {
      const g = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.8, 16), grass);
      const b = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 16), dirt);
      b.rotation.x = Math.PI; b.position.y = -2.9;
      g.add(t, b);
      g.position.set(x, y, z); g.scale.setScalar(s);
      g.userData.bob = Math.random() * 6;
      this.scene.add(g);
      (this.floaters ||= []).push(g);
    }
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

  setWeather(w, instant = false) {
    this.weather = w;
    const s = SKY[w] || SKY.despejado;
    this.target = s;
    const modes = { lluvia: [1, 0xbcd4ff, 9], electrico: [1, 0xd8d8ff, 9], nieve: [2, 0xffffff, 7], arena: [3, 0xe8c080, 3.2], niebla: [2, 0xffd8f0, 5] };
    const md = modes[w];
    this.wPoints.visible = !!md;
    if (md) { this.wMat.uniforms.mode.value = md[0]; this.wMat.uniforms.color.value.setHex(md[1]); this.wMat.uniforms.size.value = md[2]; }
    if (instant) this.applySky(1);
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
    this.applySky(Math.min(1, dt * 1.5));
    for (const c of this.clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 90) c.position.x = -90;
    }
    if (this.floaters) for (const f of this.floaters) f.position.y += Math.sin(t * 0.6 + f.userData.bob) * 0.004;
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

  highlightBench(i, hex = 0x9be86a) { if (this.benchMat[i]) this.benchMat[i].color.setHex(hex); }
}
