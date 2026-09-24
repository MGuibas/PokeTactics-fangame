// Rejilla hexagonal "odd-r" (filas impares desplazadas a la derecha).
// Tablero de combate: 7 columnas x 8 filas. Filas 0-3 = rival, 4-7 = local.

export const COLS = 7;
export const ROWS = 8;
export const HALF_ROWS = 4;
export const BENCH_SIZE = 9;

export const key = (x, y) => y * COLS + x;
export const inBounds = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

export function toCube(x, y) {
  const q = x - (y - (y & 1)) / 2;
  const r = y;
  return [q, r, -q - r];
}

export function dist(ax, ay, bx, by) {
  const a = toCube(ax, ay);
  const b = toCube(bx, by);
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

const EVEN_N = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD_N = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

export function neighbors(x, y) {
  const d = y & 1 ? ODD_N : EVEN_N;
  const out = [];
  for (const [dx, dy] of d) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(nx, ny)) out.push([nx, ny]);
  }
  return out;
}

// Espejo de 180° (vista del jugador visitante).
export const mirror = (x, y) => [COLS - 1 - x, ROWS - 1 - y];

// Hexes dentro de un radio.
export function hexesInRadius(x, y, r) {
  const out = [];
  for (let yy = 0; yy < ROWS; yy++)
    for (let xx = 0; xx < COLS; xx++)
      if (dist(x, y, xx, yy) <= r) out.push([xx, yy]);
  return out;
}

// Posición "pixel" continua (para cálculos geométricos, p.ej. líneas).
export function hexCenter(x, y) {
  return [x + 0.5 * (y & 1), y * 0.8660254];
}

// Hexes atravesados por una línea desde (ax,ay) en dirección a (bx,by), longitud len.
export function hexLine(ax, ay, bx, by, len) {
  const [x0, y0] = hexCenter(ax, ay);
  const [x1, y1] = hexCenter(bx, by);
  let dx = x1 - x0, dy = y1 - y0;
  const L = Math.hypot(dx, dy) || 1;
  dx /= L; dy /= L;
  const out = [];
  const seen = new Set([key(ax, ay)]);
  for (let s = 0.5; s <= len + 0.01; s += 0.25) {
    const px = x0 + dx * s, py = y0 + dy * s;
    // hex más cercano
    let best = null, bd = 1e9;
    const ry = Math.round(py / 0.8660254);
    for (let yy = ry - 1; yy <= ry + 1; yy++) {
      if (yy < 0 || yy >= ROWS) continue;
      for (let xx = 0; xx < COLS; xx++) {
        const [cx, cy] = hexCenter(xx, yy);
        const d = (cx - px) ** 2 + (cy - py) ** 2;
        if (d < bd) { bd = d; best = [xx, yy]; }
      }
    }
    if (best && bd < 0.5) {
      const k = key(best[0], best[1]);
      if (!seen.has(k)) { seen.add(k); out.push(best); }
    }
  }
  return out;
}

// BFS: primer paso desde (sx,sy) hacia cualquier hex que cumpla goal(x,y).
export function bfsStep(sx, sy, blocked, goal) {
  const start = key(sx, sy);
  const prev = new Map([[start, -1]]);
  const q = [[sx, sy]];
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    const k = key(x, y);
    if (k !== start && goal(x, y)) {
      // reconstruir
      let cur = k, p = prev.get(cur);
      while (p !== start && p !== -1) { cur = p; p = prev.get(cur); }
      return [cur % COLS, Math.floor(cur / COLS)];
    }
    for (const [nx, ny] of neighbors(x, y)) {
      const nk = key(nx, ny);
      if (prev.has(nk) || blocked(nx, ny)) continue;
      prev.set(nk, k);
      q.push([nx, ny]);
    }
  }
  return null;
}
