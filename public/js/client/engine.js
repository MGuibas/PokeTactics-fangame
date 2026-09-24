// Motor de render: escena, cámara, materiales toon con contorno (cel-shading),
// sombras toon, post-procesado (bloom + gradación de color) y niveles de calidad.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Gradación final (en sRGB): saturación, contraste suave, tono cálido y viñeta.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, sat: { value: 1.1 }, contrast: { value: 1.05 }, warm: { value: 0.025 },
    vignette: { value: 0.32 }, lift: { value: 0.012 }, tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float sat; uniform float contrast; uniform float warm; uniform float vignette; uniform float lift; uniform vec3 tint;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      c += vec3(warm, warm * 0.4, -warm * 0.6);
      c = c * tint + lift;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.8)));
      c *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export const QUALITIES = {
  alto: { name: 'Alta', desc: 'Sombras, bloom, antialiasing y máxima resolución.' },
  medio: { name: 'Media', desc: 'Sombras y bloom con menos resolución.' },
  bajo: { name: 'Baja', desc: 'Sin efectos: para equipos modestos o móviles.' },
};

export const SQRT3 = Math.sqrt(3);
export const HEX = 1.0;

// Posición en el mundo de una casilla de combate (x 0..6, y 0..7).
export function hexToWorld(x, y) {
  return new THREE.Vector3((x + 0.5 * (y & 1) - 3.25) * SQRT3 * HEX, 0, (y - 3.5) * 1.5 * HEX);
}
export function benchToWorld(i) {
  return new THREE.Vector3((i - 4) * 1.62, 0, 8.05);
}

let gradientMap = null;
export function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export function toonMaterial(opts = {}) {
  const { rim, emitAttr, ...rest } = opts;
  const m = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...rest });
  // Borde de luz (rim light) para el look anime.
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(0xffffff) };
    shader.uniforms.rimStrength = { value: rim ?? 0.35 };
    if (emitAttr) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float emit;\nvarying float vEmit;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmit = emit;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vEmit;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vColor.rgb * 1.15 + emissive * 0.5, vEmit);');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float rimF = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        float rim = smoothstep(0.62, 0.72, rimF) * rimStrength;
        gl_FragColor.rgb += rimColor * rim;`
      );
  };
  m.customProgramCacheKey = () => 'toon' + (emitAttr ? 'E' : '') + (rim ?? 0.35);
  return m;
}

// Contorno en espacio de pantalla (grosor constante en píxeles).
const outlineMats = new Map();
export function outlineMaterial(color = 0x1a1420, px = 2.2) {
  const k = color + ':' + px;
  if (outlineMats.has(k)) return outlineMats.get(k);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      thickness: { value: px },
      resolution: { value: new THREE.Vector2(1280, 720) },
    },
    vertexShader: `
      uniform float thickness;
      uniform vec2 resolution;
      attribute vec3 onormal;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * onormal);
        vec4 cn = projectionMatrix * vec4(n, 0.0);
        vec2 dir = cn.xy;
        float l = length(dir);
        if (l > 0.0001) dir /= l;
        clip.xy += dir * thickness * 2.0 / resolution * clip.w;
        clip.z += 0.0004 * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
  });
  outlineMats.set(k, m);
  return m;
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.glow = 1; // multiplicador HDR de los efectos (brillan con el bloom)
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe6ff, 38, 90);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
    this.camTarget = new THREE.Vector3(0, 0, 3.3);
    this.camBase = new THREE.Vector3(0, 19, 13.5);
    this.camOffset = new THREE.Vector3();
    this.camZoom = 1;
    this.shake = 0;
    this.clock = new THREE.Clock();
    this.updaters = new Set();
    this.raycaster = new THREE.Raycaster();

    this.hemi = new THREE.HemisphereLight(0xdff3ff, 0x6b8f5a, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
    this.sun.position.set(-8, 20, 10);
    const sc = this.sun.shadow.camera;
    sc.left = -19; sc.right = 19; sc.top = 19; sc.bottom = -19; sc.near = 2; sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0xb8d8ff, 0.5);
    this.fill.position.set(10, 8, -10);
    this.scene.add(this.fill);

    this.qualityListeners = new Set();
    let q = null, forced = false;
    try { q = new URLSearchParams(location.search).get('q'); forced = !!q; q ||= localStorage.getItem('pt3d-quality'); } catch {}
    this.userQuality = !!q;
    if (!QUALITIES[q]) q = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820 ? 'medio' : 'alto';
    this.fpsWatch = { t: 0, n: 0, low: 0, done: forced || this.userQuality };
    this.setQuality(q, false);
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  buildComposer() {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.32, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  // Calidad gráfica: alto / medio / bajo.
  setQuality(q, save = true) {
    if (!QUALITIES[q]) q = 'alto';
    this.quality = q;
    if (save) { this.userQuality = true; this.fpsWatch.done = true; try { localStorage.setItem('pt3d-quality', q); } catch {} }
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'alto' ? Math.min(dpr, 2) : q === 'medio' ? Math.min(dpr, 1.25) : Math.min(dpr, 1));
    const shadows = q !== 'bajo';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    this.sun.castShadow = shadows;
    const ms = q === 'alto' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== ms) {
      this.sun.shadow.mapSize.set(ms, ms);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.post = q !== 'bajo';
    if (this.post && !this.composer) this.buildComposer();
    this.glow = this.post ? 1.7 : 1;
    this.resize();
    for (const fn of this.qualityListeners) fn(q);
  }

  onQuality(fn) { this.qualityListeners.add(fn); return () => this.qualityListeners.delete(fn); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // En pantallas estrechas alejamos la cámara para que quepa el tablero.
    const narrow = Math.max(1, 1.45 / this.camera.aspect);
    this.aspectZoom = narrow;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    for (const m of outlineMats.values()) m.uniforms.resolution.value.set(w * pr, h * pr);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
      // En calidad media el bloom se calcula a menos resolución.
      if (this.quality === 'medio') this.bloom.setSize(Math.round(w * pr * 0.6), Math.round(h * pr * 0.6));
    }
    this.width = w;
    this.height = h;
  }

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    for (const fn of this.updaters) fn(dt, t);
    // Cámara con suavizado y temblor.
    const z = this.camZoom * this.aspectZoom;
    const desired = this.camTarget.clone().add(this.camBase.clone().multiplyScalar(z)).add(this.camOffset);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camTarget);
    if (this.post && this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.watchFps(dt);
  }

  // Si el equipo no llega a ~28 FPS con calidad alta, baja a media automáticamente (una vez).
  watchFps(dt) {
    const w = this.fpsWatch;
    if (w.done || document.hidden) return;
    w.t += dt; w.n++;
    if (w.t < 4) return;
    const fps = w.n / w.t;
    w.t = 0; w.n = 0;
    w.low = fps < 28 ? w.low + 1 : 0;
    if (w.low >= 2) {
      w.done = true;
      if (this.quality === 'alto') this.setQuality('medio', false);
      else if (this.quality === 'medio' && fps < 18) this.setQuality('bajo', false);
    }
  }

  // Punto del plano y=h bajo el puntero.
  pickPlane(ndcX, ndcY, h = 0) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -h);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  // Proyección a coordenadas de pantalla (px).
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, behind: p.z > 1 };
  }
}
