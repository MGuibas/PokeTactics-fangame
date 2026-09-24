// Motor de render: escena, cámara, materiales toon con contorno (cel-shading).
import * as THREE from 'three';

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
    this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight(0xb8d8ff, 0.5);
    this.fill.position.set(10, 8, -10);
    this.scene.add(this.fill);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

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
    this.renderer.render(this.scene, this.camera);
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
