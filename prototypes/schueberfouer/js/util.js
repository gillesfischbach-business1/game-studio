// Hilfsfunktionen: Zufall, Geometrie-Batching, Glühbirnen, Texturen, Kollision
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const rand = mulberry32(1340);           // 1340 = Grëndungsjoer vun der Fouer
export const R = (a, b) => a + rand() * (b - a);
export const RI = (a, b) => Math.floor(R(a, b + 1));
export const pick = arr => arr[Math.floor(rand() * arr.length)];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const euro = p => p.toFixed(2).replace('.', ',') + ' €';

// ---------------- Material-Cache ----------------
const matCache = new Map();
/** Gibt ein geteiltes MeshStandardMaterial zurück (spart Draw-Calls & Speicher). */
export function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }));
  return matCache.get(key);
}
/** Leuchtendes, unbeleuchtetes Material (Farbe > 1 => Bloom). */
export function Glow(color, k = 2.2) {
  const key = 'glow' + color + k;
  if (!matCache.has(key)) { const c = new THREE.Color(color).multiplyScalar(k); matCache.set(key, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); }
  return matCache.get(key);
}

// ---------------- Batcher: viele statische Teile -> wenige Meshes ----------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export class Batcher {
  constructor() { this.groups = new Map(); this.pm = null; }
  /** Setzt eine Eltern-Transformation (x,z,ry) für folgende add()-Aufrufe; null = keine */
  at(x, y, z, ry) { this.pm = x === null ? null : new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)); return this; }
  /** Fügt eine Geometrie mit Material und Transformation hinzu. */
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    return this.addM(geo, mat, _m);
  }
  addM(geo, mat, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k) && !(k === 'color' && mat.vertexColors)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(matrix); if (this.pm) g.applyMatrix4(this.pm);
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
    return this;
  }
  build(parent, { cast = false, receive = true, cell = 70 } = {}) {
    // Räumlich bündeln: je Material und je 70-m-Zelle ein Mesh -> Frustum-Culling & Schatten wirken
    const box = new THREE.Box3(), c = new THREE.Vector3();
    for (const [mat, list] of this.groups) {
      const cells = new Map();
      for (const g of list) { g.computeBoundingBox(); g.boundingBox.getCenter(c); const k = Math.floor(c.x / cell) + ',' + Math.floor(c.z / cell); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(g); }
      for (const arr of cells.values()) for (let i = 0; i < arr.length; i += 600) {
        const geo = mergeGeometries(arr.slice(i, i + 600), false);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        parent.add(mesh);
      }
    }
    this.groups.clear();
  }
}

// ---------------- Glühbirnen (Kirmes-Lichterketten) ----------------
export const bulbUniforms = { uTime: { value: 0 }, uOn: { value: 1 }, uCalm: { value: 0 } };
const bulbGeo = new THREE.IcosahedronGeometry(0.12, 0);
const bulbMat = new THREE.ShaderMaterial({
  uniforms: bulbUniforms,
  vertexShader: `
    attribute vec3 bColor; attribute vec2 bPhase; uniform float uTime; uniform float uOn; uniform float uCalm; varying vec3 vC;
    #include <fog_pars_vertex>
    void main(){
      float mode = bPhase.y; float k = 1.0;
      if (mode > 0.5 && mode < 1.5) k = 0.35 + 0.65 * step(0.5, fract(bPhase.x - uTime * 1.6));   // Lauflicht
      else if (mode > 1.5 && mode < 2.5) k = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 4.0 + bPhase.x * 6.2831)); // Pulsieren
      else if (mode > 2.5) k = step(0.5, fract(uTime * 1.2 + bPhase.x * 0.37)) * 0.8 + 0.2;           // Blinken
      k = mix(k, 0.85, uCalm);
      vC = bColor * k * uOn;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `
    varying vec3 vC;
    #include <fog_pars_fragment>
    void main(){ gl_FragColor = vec4(vC, 1.0);
      #include <fog_fragment>
    }`,
  fog: true,
});
bulbMat.uniforms = { ...THREE.UniformsLib.fog, ...bulbUniforms };
export class Bulbs {
  constructor() { this.p = []; this.c = []; this.ph = []; this.pm = null; this._v = new THREE.Vector3(); }
  at(x, y, z, ry) { this.pm = x === null ? null : new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)); return this; }
  /** Einzelne Birne. mode: 0 statisch, 1 Lauflicht, 2 Puls, 3 Blinken */
  add(x, y, z, color, phase = 0, mode = 1, k = 2.5) {
    if (this.pm) { this._v.set(x, y, z).applyMatrix4(this.pm); x = this._v.x; y = this._v.y; z = this._v.z; }
    const c = new THREE.Color(color); this.p.push(x, y, z); this.c.push(c.r * k, c.g * k, c.b * k); this.ph.push(phase, mode);
  }
  /** Lichterkette entlang einer Strecke */
  line(a, b, spacing, color, mode = 1, k) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const n = Math.max(1, Math.round(d / spacing));
    for (let i = 0; i <= n; i++) { const t = i / n; this.add(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, typeof color === 'function' ? color(i) : color, i / 6, mode, k); }
  }
  circle(cx, cy, cz, r, n, color, mode = 1, plane = 'xz', k) {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const col = typeof color === 'function' ? color(i) : color;
      if (plane === 'xz') this.add(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, col, i / 8, mode, k);
      else if (plane === 'xy') this.add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz, col, i / 8, mode, k);
      else this.add(cx, cy + Math.sin(a) * r, cz + Math.cos(a) * r, col, i / 8, mode, k); }
  }
  build(parent, scale = 1) {
    const n = this.p.length / 3; if (!n) return null;
    const mesh = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeScale(scale, scale, scale); m.setPosition(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); mesh.setMatrixAt(i, m); }
    mesh.geometry = bulbGeo.clone();
    mesh.geometry.setAttribute('bColor', new THREE.InstancedBufferAttribute(new Float32Array(this.c), 3));
    mesh.geometry.setAttribute('bPhase', new THREE.InstancedBufferAttribute(new Float32Array(this.ph), 2));
    mesh.frustumCulled = false; // Instanzen über großes Gebiet
    parent.add(mesh); return mesh;
  }
}

// ---------------- Canvas-Texturen ----------------
export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
/** Leuchtschild mit Text (Neon/Glühbirnen-Stil) */
export function signTex(text, { w = 512, h = 128, bg = '#1a0a2e', fg = '#ffe066', border = '#ff3d7f', font = 'Bungee, Impact, sans-serif', bulbs = true } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = border; g.lineWidth = h * 0.08; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    if (bulbs) { g.fillStyle = '#fff6c2'; const n = Math.floor(w / 22); for (let i = 0; i < n; i++) { g.beginPath(); g.arc(11 + i * (w - 22) / (n - 1), h * 0.06, 3.5, 0, 7); g.arc(11 + i * (w - 22) / (n - 1), h * 0.94, 3.5, 0, 7); g.fill(); } }
    let size = h * 0.55; g.font = `${size}px ${font}`;
    while (g.measureText(text).width > w * 0.88 && size > 8) { size -= 2; g.font = `${size}px ${font}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = h * 0.15; g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + h * 0.03);
    g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.5; g.fillText(text, w / 2, h / 2 + h * 0.03);
  });
}
/** Einfarbige Noise-Textur (Asphalt, Putz, Gras) */
export function noiseTex(size, base, vari, repeat, extra) {
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * vari; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0); if (extra) extra(g, w, h);
  }, { repeat });
}

// ---------------- Kollision: orientierte Boxen & Kreise im Raster ----------------
export class Colliders {
  constructor(cell = 16) { this.cell = cell; this.grid = new Map(); this.list = []; }
  _key(i, j) { return i * 100003 + j; }
  /** Orientierte Box: Mittelpunkt cx,cz, halbe Ausdehnung hx,hz, Drehung rot (wie Object3D.rotation.y) */
  box(cx, cz, hx, hz, rot = 0, tag) { this._insert({ t: 'b', cx, cz, hx, hz, c: Math.cos(rot), s: Math.sin(rot), r: Math.hypot(hx, hz), tag }); }
  circle(cx, cz, r, tag) { this._insert({ t: 'c', cx, cz, rad: r, r, tag }); }
  _insert(o) {
    this.list.push(o); const c = this.cell;
    for (let i = Math.floor((o.cx - o.r) / c); i <= Math.floor((o.cx + o.r) / c); i++)
      for (let j = Math.floor((o.cz - o.r) / c); j <= Math.floor((o.cz + o.r) / c); j++) {
        const k = this._key(i, j); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(o); }
  }
  /** Schiebt einen Kreis (Spieler) aus allen Hindernissen; gibt neue Position zurück. */
  resolve(pos, radius) {
    const k = this._key(Math.floor(pos.x / this.cell), Math.floor(pos.z / this.cell)); const arr = this.grid.get(k); if (!arr) return false;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) for (const o of arr) {
      if (o.t === 'c') { const dx = pos.x - o.cx, dz = pos.z - o.cz, d = Math.hypot(dx, dz), m = o.rad + radius;
        if (d < m && d > 1e-5) { pos.x = o.cx + dx / d * m; pos.z = o.cz + dz / d * m; hit = true; } continue; }
      // Box: in lokales System drehen (Three: lokal x -> Welt (c, -s))
      const dx = pos.x - o.cx, dz = pos.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz); let ex = lx - qx, ez = lz - qz; const d = Math.hypot(ex, ez);
      let nx, nz;
      if (d > 1e-5) { if (d >= radius) continue; nx = qx + ex / d * radius; nz = qz + ez / d * radius; }
      else { const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
        if (px < pz) { nx = Math.sign(lx || 1) * (o.hx + radius); nz = lz; } else { nz = Math.sign(lz || 1) * (o.hz + radius); nx = lx; } }
      pos.x = o.cx + nx * o.c + nz * o.s; pos.z = o.cz - nx * o.s + nz * o.c; hit = true;
    }
    return hit;
  }
}

/** Abstand Punkt-Strecke (2D) */
export function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside; }
  return inside;
}

// Tasten-Hinweise für Touch-Geräte umschreiben: "[Q]" -> Kompass-Knopf usw.
const TOUCH_KEYS = { Q: '🧭', E: 'E-Knäppchen', P: '📷', V: '👁', M: '🗺', J: '★', I: '☰', Esc: '☰' };
export function keyText(s) {
  if (!s || !(window.G && window.G.isMobile)) return s;
  return String(s)
    .replace(/\[(Esc|[A-Z])\]/g, (m, k) => TOUCH_KEYS[k] ? `[${TOUCH_KEYS[k]}]` : m)
    .replace(/WASD fueren/g, 'Joystick fueren')
    .replace(/ · Maus kucken/g, ' · wësch fir ze kucken')
    .replace(/\(Shift = lafen\)/g, '(Joystick ganz no baussen = lafen)');
}
