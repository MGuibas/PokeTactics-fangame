// Retratos de Pokémon renderizados en 3D a imagen (para tienda, listas y menús).
import * as THREE from 'three';
import { createModel } from './models.js';

let renderer = null, scene = null, camera = null;
const cache = new Map();
const SIZE = 160;

function init() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x7a8a6a, 1.3));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
  sun.position.set(-2, 4, 5);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
}

export function portrait(form, shiny = false, opts = {}) {
  const key = form + (shiny ? ':s' : '') + (opts.full ? ':f' : '');
  if (cache.has(key)) return cache.get(key);
  if (!renderer) init();
  const m = createModel(form, shiny, { outline: 1.6 });
  m.root.scale.setScalar(1);
  m.root.rotation.y = opts.angle ?? 0.45;
  scene.add(m.root);
  const h = m.data.height;
  const r = Math.max(m.data.radius, h * 0.5);
  const box = new THREE.Box3().setFromObject(m.root);
  const center = box.getCenter(new THREE.Vector3());
  const sizeV = box.getSize(new THREE.Vector3());
  // Encuadre: centrado en la cabeza para retratos, cuerpo entero si opts.full.
  const span = Math.max(sizeV.x, sizeV.y) * (opts.full ? 0.62 : 0.52);
  const target = opts.full ? center : new THREE.Vector3(center.x, center.y + sizeV.y * 0.12, center.z);
  const dist = span / Math.tan((camera.fov / 2) * Math.PI / 180) * 1.05;
  camera.position.set(target.x + dist * 0.12, target.y + dist * 0.18, target.z + dist);
  camera.lookAt(target);
  // Las líneas de contorno usan la resolución del renderer.
  m.outlineMeshes.forEach((o) => o.material.uniforms && o.material.uniforms.resolution.value.set(SIZE, SIZE));
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(m.root);
  m.mat.dispose();
  cache.set(key, url);
  return url;
}

// Pre-renderiza en segundo plano para evitar tirones.
export function warmPortraits(list) {
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < list.length && performance.now() - t0 < 12) {
      const [f, s] = list[i++];
      portrait(f, s);
    }
    if (i < list.length) setTimeout(step, 30);
  };
  step();
}
