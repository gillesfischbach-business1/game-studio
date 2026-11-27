// Attraktionen: Grande Roue, Carrousel Galopant, Break Dance, Alpina Bahn, Kettekarussell,
// Fräifall-Tuerm, Pendel, Autoscooter Diamond, Geeschterbunn, Cinéma 5D + Kulissen-Attraktionen.
import * as THREE from 'three';
import { RIDES, EXTRA_RIDES, FOOTPRINT, L } from './data.js';
import { Batcher, Bulbs, M, Glow, R, RI, pick, rand, canvasTex, signTex, clamp, lerp, smooth, euro } from './util.js';
import { pbr } from './tex.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
/** Zylinder-Träger zwischen zwei Punkten */
function beam(B, a, b, r, mat, seg = 6) {
  _a.set(...a); _b.set(...b); const len = _a.distanceTo(_b); const dir = _b.clone().sub(_a).normalize();
  _q.setFromUnitVectors(UP, dir); _m.compose(_a.clone().add(_b).multiplyScalar(0.5), _q, _s);
  B.addM(new THREE.CylinderGeometry(r, r, len, seg), mat, _m);
}

// =============================================================
// Detail-Baukasten: Kleinteile (Geländer, Treppen, Kulissen, Kabinen, Packwagen …)
// Alle Kleinteile einer Attraktion werden je Material zu EINER Geometrie verschmolzen und gehen
// dann durch this.B -> höchstens 3 zusätzliche Draw-Calls je Attraktion (Lack, Riffelblech, Holz).
// WICHTIG: hier kein rand()/pick() benutzen (der Zufalls-Seed der restlichen Welt bliebe sonst nicht gleich).
const STEEL = '#c3c8d0', DARK = '#262930', RUB = '#101114', TIMB = '#8b6a45', YEL = '#ffc400', GLASS = '#bfe6ff', PLATE = '#a4abb6', CONC = '#8d9198';
const PLATE_GAIN = 1.6;   // Riffelblech-Foto ist dunkel -> Vertex-Farbe hellt auf
// Kulissen-Tafeln sind einseitig (von hinten unsichtbar), damit die Verfolger-Kamera (9 m Abstand) beim Mitfahren nie verdeckt wird.
// true = massive Tafeln (von hinten geschlossen, können dann aber die Kamera verdecken)
const BACKDROP_SOLID = false;
/** Lack-Material: Vertex-Farbe = Farbton, uv.x = Selbstleuchten (Fenster, Leuchtkästen) */
const detMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 });
detMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDetEm;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDetEm = uv.x;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDetEm;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vDetEm;');
};
detMat.customProgramCacheKey = () => 'rideDetail';
const _ug = {}, _dc = new THREE.Color(), _dI = new THREE.Matrix4();
const _dp = new THREE.Vector3(), _dq = new THREE.Quaternion(), _de = new THREE.Euler(), _ds = new THREE.Vector3(), _dm = new THREE.Matrix4();
const uBox = () => _ug.b || (_ug.b = new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
const uPlane = () => _ug.p || (_ug.p = new THREE.PlaneGeometry(1, 1).toNonIndexed());
const uCyl = (seg) => _ug[seg] || (_ug[seg] = new THREE.CylinderGeometry(1, 1, 1, seg, 1, true).toNonIndexed());
/** Punkte auf einem Kreisbogen (xz), ca. alle 1,5 m */
const arcPts = (r, y, a0, a1, step = 1.5) => { const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) * r / step)); return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.cos(a) * r, y, Math.sin(a) * r]; }); };
/** Drehung ry, damit lokales +z zur Mitte zeigt (für Teile auf einem Kreis beim Winkel a) */
const faceIn = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));
class Det {
  constructor() { this.L = { p: [], t: [], w: [] }; this.pm = null; this.walls = []; }
  /** Eltern-Rahmen (Position + Drehung um y) für die folgenden Teile; at(null) = aus */
  at(x, y, z, ry = 0) { this.pm = x === null ? null : new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)); return this; }
  /** o: k = 'p' Lack | 't' Riffelblech | 'w' Holz, em = Leuchtstärke */
  put(geo, m, col, o) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); if (this.pm) g.applyMatrix4(this.pm); this.L[o?.k || 'p'].push([g, col, o?.em || 0]); return this; }
  box(w, h, d, col, x, y, z, ry = 0, o) { _dm.compose(_dp.set(x, y, z), _dq.setFromEuler(_de.set(o?.rx || 0, ry, o?.rz || 0)), _ds.set(w, h, d)); return this.put(uBox(), _dm, col, o); }
  /** Einseitige Tafel (Sichtseite = lokales +z bei ry = 0), siehe BACKDROP_SOLID */
  panel(w, h, col, x, y, z, ry = 0, o) { if (BACKDROP_SOLID) return this.box(w, h, 0.05, col, x, y, z, ry, o); _dm.compose(_dp.set(x, y, z), _dq.setFromEuler(_de.set(0, ry, o?.rz || 0)), _ds.set(w, h, 1)); return this.put(uPlane(), _dm, col, o); }
  /** Zylinder/Kegel (o.r2 = oberer Radius, o.cap = Deckel, o.rx/o.rz = kippen) */
  cyl(r, h, col, x, y, z, seg = 6, o) { _dm.compose(_dp.set(x, y, z), _dq.setFromEuler(_de.set(o?.rx || 0, o?.ry || 0, o?.rz || 0)), _ds.set(1, 1, 1)); return this.put(new THREE.CylinderGeometry(o?.r2 ?? r, r, h, seg, 1, !o?.cap), _dm, col, o); }
  _seg(a, b) { _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); const len = _a.distanceTo(_b); if (len < 1e-4) return 0; _dq.setFromUnitVectors(UP, _dp.copy(_b).sub(_a).normalize()); _dp.copy(_a).add(_b).multiplyScalar(0.5); return len; }
  /** Vierkant-Stab von a nach b */
  bar(a, b, w, col, o) { const len = this._seg(a, b); if (!len) return this; _dm.compose(_dp, _dq, _ds.set(w, len, o?.d || w)); return this.put(uBox(), _dm, col, o); }
  /** Rohr von a nach b */
  tube(a, b, r, col, seg = 5, o) { const len = this._seg(a, b); if (!len) return this; _dm.compose(_dp, _dq, _ds.set(r, len, r)); return this.put(uCyl(seg), _dm, col, o); }
  /** Geländer entlang einer Polylinie (y = Fußpunkt). o: h Höhe, mid Zwischenholme, bars Stababstand (Absperrgitter), post Pfostenabstand */
  rail(pts, col = STEEL, o = {}) { const h = o.h || 1.05, s = o.s || 0.05, mid = o.mid ?? (o.bars ? 0 : 1);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const len = Math.hypot(dx, dz); if (len < 0.05) continue;
      // Bodennahe Geländer/Zäune merken: flush() macht daraus Kollisionswände (Podest-Geländer über 0,6 m und Treppenläufe nicht)
      if (o.col !== false && Math.abs(dy) < 0.05 && a[1] <= 0.6 && len > 0.4) { _a.set(a[0], 0, a[2]); _b.set(b[0], 0, b[2]); if (this.pm) { _a.applyMatrix4(this.pm); _b.applyMatrix4(this.pm); } this.walls.push([_a.x, _a.z, _b.x, _b.z]); }
      const m = Math.max(1, Math.round(len / (o.post || 1.8)));
      for (let j = i ? 1 : 0; j <= m; j++) { const t = j / m; this.box(s * 1.3, h, s * 1.3, col, a[0] + dx * t, a[1] + dy * t + h / 2, a[2] + dz * t); }
      this.bar([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], s * 1.4, col);
      for (let k = 1; k <= mid; k++) this.bar([a[0], a[1] + h * k / (mid + 1), a[2]], [b[0], b[1] + h * k / (mid + 1), b[2]], s * 0.8, col);
      if (o.bars) { this.bar([a[0], a[1] + 0.12, a[2]], [b[0], b[1] + 0.12, b[2]], s * 0.8, col); const nb = Math.round(len / o.bars); for (let j = 1; j < nb; j++) { const t = j / nb; this.box(s * 0.5, h - 0.12, s * 0.5, col, a[0] + dx * t, a[1] + dy * t + 0.06 + h / 2, a[2] + dz * t); } } }
    return this; }
  /** Leuchtpunkte (kleine selbstleuchtende Würfel) entlang einer Strecke: statische Lichterkette ohne zusätzlichen Draw-Call */
  dots(a, b, sp, col, em = 2.4, s = 0.13) { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / sp)); for (let i = 0; i <= n; i++) { const t = i / n; this.box(s, s, s, typeof col === 'function' ? col(i) : col, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 0, { em }); } return this; }
  /** Rundgeländer: Liste von Winkel-Abschnitten [a0, a1] */
  ring(r, y, parts, col, o) { for (const [a0, a1] of parts) this.rail(arcPts(r, y, a0, a1), col, o); return this; }
  /** Treppe im lokalen Rahmen (at): oberste Kante bei z = 0 auf Höhe H, läuft nach +z hinunter */
  stairs(w, H, n, run = 0.3, col = PLATE, o = {}) { const rise = H / (n + 1);
    for (let i = 0; i < n; i++) { const top = H - (i + 1) * rise; this.box(w, top, run, col, 0, top / 2, run * (i + 0.5), 0, { k: o.k || 'p' }); this.box(w + 0.02, 0.03, 0.05, YEL, 0, top + 0.005, run * (i + 1) - 0.025); }
    if (o.rail !== false) for (const sx of [-1, 1]) this.rail([[sx * (w / 2 - 0.03), H - rise, 0.05], [sx * (w / 2 - 0.03), 0, run * n + 0.05]], o.railCol || STEEL, { mid: 1 });
    return this; }
  /** Alles in den Batcher der Attraktion geben */
  flush(B, ride) {
    if (ride?.G?.fairBox) { for (const [x0, z0, x1, z1] of this.walls) { const dx = x1 - x0, dz = z1 - z0; ride.G.fairBox(ride.cfg.u + (x0 + x1) / 2, ride.cfg.v + (z0 + z1) / 2, Math.hypot(dx, dz) / 2, 0.1, Math.atan2(-dz, dx), 'rail'); } }
    this.walls.length = 0;
    for (const k of ['p', 't', 'w']) { const L = this.L[k]; if (!L.length) continue; let n = 0; for (const it of L) n += it[0].attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0; const gain = k === 't' ? PLATE_GAIN : 1;
      for (const [g, c, em] of L) { const cnt = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); _dc.set(c);
        for (let i = o; i < o + cnt; i++) { col[i * 3] = _dc.r * gain; col[i * 3 + 1] = _dc.g * gain; col[i * 3 + 2] = _dc.b * gain; uv[i * 2] = em; } o += cnt; }
      const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
      B.addM(m, k === 'p' ? detMat : k === 't' ? pbr('metal', { tile: 1.2, metalness: 0.55, vertexColors: true }) : pbr('wood', { tile: 1.5, vertexColors: true }), _dI); L.length = 0; } }
}
/** Unterpallung: Kanthölzer und Fußplatte */
function footPad(K, x, z, y = 0, s = 1) {
  K.box(1.5 * s, 0.14, 0.26, TIMB, x, y + 0.07, z - 0.3 * s); K.box(1.5 * s, 0.14, 0.26, TIMB, x, y + 0.07, z + 0.3 * s); K.box(0.9 * s, 0.07, 0.9 * s, DARK, x, y + 0.175, z);
}
/** Kabelstrang am Boden (3 Leitungen) mit gelb-schwarzer Kabelbrücke in der Mitte */
function cable(K, a, b, y = 0.04) { const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
  for (const o of [-0.09, 0, 0.09]) K.bar([a[0] + nx * o, y, a[1] + nz * o], [b[0] + nx * o, y, b[1] + nz * o], 0.06, RUB);
  K.box(0.5, 0.09, 0.9, YEL, (a[0] + b[0]) / 2, y + 0.03, (a[1] + b[1]) / 2, Math.atan2(nx, nz)); K.box(0.52, 0.1, 0.12, RUB, (a[0] + b[0]) / 2, y + 0.03, (a[1] + b[1]) / 2, Math.atan2(nx, nz));
}
/** Packwagen: Koffer auf Fahrgestell, Tandemachse, Deichsel, Türen, Lüftungsgitter, Stützen (Länge entlang lokalem x) */
function trailer(K, x, z, ry, len = 6, col = '#e9e9ec', acc = '#d90429') { K.at(x, 0, z, ry); const w = 2.3, h = 2.3, y0 = 0.75;
  K.box(len, h, w, col, 0, y0 + h / 2, 0); K.box(len + 0.04, 0.3, w + 0.04, acc, 0, y0 + 0.5, 0);
  K.box(len + 0.08, 0.08, w + 0.08, STEEL, 0, y0 + h + 0.04, 0); K.box(len + 0.06, 0.14, w + 0.06, DARK, 0, y0 - 0.07, 0);
  for (let i = 1; i < len / 1.2 - 0.2; i++) K.box(0.05, h - 0.1, w + 0.05, STEEL, -len / 2 + i * 1.2, y0 + h / 2 + 0.2, 0);
  K.box(0.03, h - 0.3, 0.05, DARK, len / 2 + 0.02, y0 + h / 2, 0); for (const s of [-1, 1]) { K.box(0.04, h - 0.3, 0.06, STEEL, len / 2 + 0.03, y0 + h / 2, s * (w / 2 - 0.08)); K.box(0.05, 0.9, 0.05, STEEL, len / 2 + 0.04, y0 + 1.1, s * 0.3); }
  for (const s of [-1, 1]) { K.box(1.3, 0.75, 0.04, DARK, -len / 4, y0 + 1.5, s * (w / 2 + 0.02)); for (let j = 0; j < 4; j++) K.box(1.2, 0.04, 0.05, STEEL, -len / 4, y0 + 1.25 + j * 0.17, s * (w / 2 + 0.03)); K.box(0.12, 0.12, 0.04, '#39ff14', -len / 4 + 0.95, y0 + 1.75, s * (w / 2 + 0.03), 0, { em: 3 });
    for (const ax of [-0.5, 0.5]) { K.cyl(0.42, 0.26, RUB, len * 0.08 + ax, 0.42, s * (w / 2 - 0.2), 10, { rx: Math.PI / 2, cap: true }); K.cyl(0.18, 0.28, STEEL, len * 0.08 + ax, 0.42, s * (w / 2 - 0.2), 8, { rx: Math.PI / 2, cap: true }); }
    K.box(2.1, 0.06, 0.34, DARK, len * 0.08, 0.9, s * (w / 2 - 0.18));
    for (const e of [-1, 1]) K.box(0.1, y0, 0.1, STEEL, e * (len / 2 - 0.35), y0 / 2, s * (w / 2 - 0.25));
    K.bar([-len / 2, 0.62, s * 0.7], [-len / 2 - 1.5, 0.55, 0], 0.1, DARK); }
  K.box(0.08, 0.55, 0.08, STEEL, -len / 2 - 1.3, 0.28, 0); K.box(0.2, 0.12, 0.2, STEEL, -len / 2 - 1.5, 0.55, 0);
  K.at(null);
}
/** Stromaggregat / Hydraulikaggregat: Haube mit Lüftungsschlitzen, Auspuff, Kontrolllampe */
function genset(K, x, y, z, ry, col = '#2f6b3a') { K.at(x, y, z, ry);
  K.box(2.2, 0.16, 1.1, DARK, 0, 0.08, 0); K.box(2.1, 1.25, 1.0, col, 0, 0.78, 0); K.box(2.16, 0.06, 1.06, DARK, 0, 1.43, 0);
  for (const s of [-1, 1]) { for (let j = 0; j < 5; j++) K.box(0.8, 0.04, 0.03, DARK, -0.5, 0.55 + j * 0.14, s * 0.51); K.box(0.6, 0.7, 0.03, DARK, 0.6, 0.85, s * 0.51); K.box(0.08, 0.08, 0.03, '#39ff14', 0.6, 1.05, s * 0.53, 0, { em: 3 }); K.box(0.08, 0.08, 0.03, '#ff3b30', 0.75, 1.05, s * 0.53, 0, { em: 2 }); }
  K.cyl(0.06, 0.5, STEEL, -0.8, 1.7, 0.2, 6); K.box(0.3, 0.3, 0.3, YEL, 0.85, 1.6, -0.25);
  K.at(null);
}
/** Lautsprecher-Turm */
function speakers(K, x, y, z, ry, n = 2) { K.at(x, y, z, ry);
  for (let i = 0; i < n; i++) { const b = i * 0.94; K.box(0.72, 0.9, 0.55, RUB, 0, b + 0.45, 0); K.box(0.66, 0.84, 0.02, '#2c2f36', 0, b + 0.45, 0.28); K.cyl(0.23, 0.03, '#4a4e57', 0, b + 0.32, 0.29, 8, { rx: Math.PI / 2, cap: true }); K.cyl(0.1, 0.03, '#4a4e57', 0, b + 0.72, 0.29, 8, { rx: Math.PI / 2, cap: true }); }
  K.at(null);
}
/** Bedienkabine (Rekommandeur): Brüstung, leuchtendes Fensterband, Dach mit Überstand, Pult, Strahler, Lautsprecher. Lokales +z = Blick zur Anlage */
function opCabin(K, x, y, z, ry, col = '#2b2d42', acc = '#ffd166', w = 2.4, d = 1.8) { K.at(x, y, z, ry); const h = 2.45;
  K.box(w, 0.95, d, col, 0, 0.475, 0); K.box(w + 0.03, 0.14, d + 0.03, acc, 0, 0.88, 0); K.box(w, 0.36, d, col, 0, h - 0.18, 0); K.box(w, 1.14, 0.06, col, 0, 1.52, -d / 2 + 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.1, h, 0.1, acc, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05));
  K.box(w - 0.2, 1.14, 0.03, GLASS, 0, 1.52, d / 2 - 0.04, 0, { em: 0.55 }); for (const sx of [-1, 1]) K.box(0.03, 1.14, d - 0.2, GLASS, sx * (w / 2 - 0.04), 1.52, 0.03, 0, { em: 0.45 });
  K.box(0.05, 1.14, 0.05, acc, 0, 1.52, d / 2 - 0.03);
  K.box(w + 0.5, 0.1, d + 0.5, acc, 0, h + 0.05, 0); K.box(w + 0.56, 0.05, d + 0.56, DARK, 0, h + 0.125, 0);
  K.box(w - 0.5, 0.12, 0.45, DARK, 0, 1.0, d / 2 - 0.35); K.box(0.3, 0.03, 0.15, '#ff3b30', -0.45, 1.07, d / 2 - 0.35, 0, { em: 2 }); K.box(0.3, 0.03, 0.15, '#39ff14', 0.05, 1.07, d / 2 - 0.35, 0, { em: 2 });
  for (const sx of [-1, 1]) { K.box(0.34, 0.22, 0.14, DARK, sx * (w / 2 - 0.3), h + 0.3, d / 2 + 0.12, 0, { rx: 0.35 }); K.box(0.28, 0.16, 0.03, '#fff4d6', sx * (w / 2 - 0.3), h + 0.27, d / 2 + 0.2, 0, { rx: 0.35, em: 2.5 }); }
  K.box(0.5, 0.4, 0.4, RUB, 0, h + 0.35, -d / 2 + 0.3); K.box(0.04, 1.2, 0.04, STEEL, w / 2 - 0.15, h + 0.7, -d / 2 + 0.15);
  K.at(null);
}
/** Ein-/Ausgangsportal: Pfosten, Querbalken mit Leuchtkasten (grün = Agank, rot = Ausgank), Schwenkbügel */
function gate(K, x, y, z, ry, w = 1.5, col = '#39d353') { K.at(x, y, z, ry);
  for (const s of [-1, 1]) { K.box(0.1, 2.3, 0.1, STEEL, s * w / 2, 1.15, 0); K.box(0.26, 0.05, 0.26, DARK, s * w / 2, 0.025, 0); }
  K.box(w + 0.3, 0.34, 0.14, DARK, 0, 2.45, 0); for (const s of [-1, 1]) K.box(w + 0.1, 0.2, 0.03, col, 0, 2.45, s * 0.08, 0, { em: 1.6 });
  K.box(w - 0.2, 0.05, 0.05, YEL, 0, 0.95, 0);
  K.at(null);
}
/** Kulisse/Rückwand im lokalen Rahmen: gerahmte Paneele entlang x (x0..x1) bei z, Schauseite nach +z·f; Zierleisten, Leuchtrauten, Streben nach hinten, Lichtleiste oben */
function backdrop(ride, K, x0, x1, z, f, y0, H, cols, o = {}) { const W = x1 - x0, n = Math.max(1, Math.round(W / (o.pw || 2.2))), pw = W / n, acc = o.acc || '#f5d76e', mid = (x0 + x1) / 2; const ry = f > 0 ? 0 : Math.PI;
  for (let i = 0; i < n; i++) { const cx = x0 + pw * (i + 0.5), c1 = cols[(i + (o.i0 || 0)) % cols.length], c2 = cols[(i + (o.i0 || 0) + 1) % cols.length];
    K.panel(pw - 0.1, H - 0.5, c1, cx, y0 + H / 2, z, ry); K.panel(pw - 0.7, H - 1.6, c2, cx, y0 + H / 2, z + f * 0.03, ry);
    if (o.lamp !== false) K.panel(0.5, 0.5, acc, cx, y0 + H * 0.62, z + f * 0.06, ry, { rz: Math.PI / 4, em: 1.3 }); }
  for (let i = 0; i <= n; i++) { const px = x0 + pw * i; K.box(0.14, H, 0.14, o.frame || STEEL, px, y0 + H / 2, z);
    if (o.strut) { K.bar([px, y0 + H * 0.75, z - f * 0.08], [px, y0 + 0.05, z - f * o.strut], 0.07, DARK); K.bar([px, y0 + 0.06, z], [px, y0 + 0.06, z - f * o.strut], 0.07, DARK); } }
  K.box(W + 0.3, 0.28, 0.2, acc, mid, y0 + H - 0.14, z); K.box(W + 0.3, 0.3, 0.2, acc, mid, y0 + 0.15, z); K.box(W, 0.08, 0.08, DARK, mid, y0 + H * 0.5, z - f * 0.1);
  if (o.bulb !== false) ride.bulbs.line([x0 + 0.2, y0 + H + 0.1, z + f * 0.08], [x1 - 0.2, y0 + H + 0.1, z + f * 0.08], 0.42, o.bulb || '#fff1b8', 1, 2.6);
}
const SHIRTS = ['#e63946', '#1d3557', '#457b9d', '#f1faee', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8338ec', '#ff006e', '#222222', '#6a994e', '#bc4749', '#ffffff'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f5d0b0'];
let riderGeo;
/** Sitzende Figur (eine Geometrie mit Vertex-Farben -> 1 Draw-Call) */
export function makeRider() {
  if (!riderGeo) {
    const parts = [];
    const body = new THREE.CapsuleGeometry(0.22, 0.45, 3, 8).toNonIndexed(); body.translate(0, 0.55, 0); parts.push([body, 0]);
    const head = new THREE.SphereGeometry(0.14, 10, 8).toNonIndexed(); head.translate(0, 1.02, 0.02); parts.push([head, 1]);
    const legs = new THREE.BoxGeometry(0.36, 0.16, 0.5).toNonIndexed(); legs.translate(0, 0.25, 0.25); parts.push([legs, 2]);
    const arms = new THREE.BoxGeometry(0.62, 0.1, 0.1).toNonIndexed(); arms.translate(0, 0.8, 0.12); parts.push([arms, 0]);
    riderGeo = parts;
  }
  const shirt = new THREE.Color(pick(SHIRTS)), skin = new THREE.Color(pick(SKINS)), pants = new THREE.Color(pick(['#1b263b', '#3d405b', '#222', '#6b705c', '#283618']));
  const cols = [shirt, skin, pants]; const geos = [];
  for (const [g, ci] of riderGeo) { const c = g.clone(); const arr = new Float32Array(c.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) { arr[i] = cols[ci].r; arr[i + 1] = cols[ci].g; arr[i + 2] = cols[ci].b; } c.setAttribute('color', new THREE.BufferAttribute(arr, 3)); c.deleteAttribute('uv'); geos.push(c); }
  const merged = mergeSimple(geos);
  const mesh = new THREE.Mesh(merged, riderMat); return mesh;
}
const riderMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
function mergeSimple(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3)); return m;
}
/** Setzt Mitfahrer in Sitze (Wahrscheinlichkeit p); Sitz-Vorwärts = -z, Figur schaut +z -> um PI drehen */
// Mitfahrer: leere Ankerpunkte; gezeichnet wird ALLES mit 3 InstancedMeshes (Hemd, Haut, Hose) -> 3 Draw-Calls statt ~130
const RIDERS = [];
function fillRiders(seats, p = 0.6) { for (const s of seats) if (rand() < p) { const r = new THREE.Object3D(); r.rotation.y = Math.PI; r.position.y = -0.1; s.add(r); s.userData.rider = r;
  RIDERS.push({ o: r, c: [new THREE.Color(pick(SHIRTS)), new THREE.Color(pick(SKINS)), new THREE.Color(pick(['#1b263b', '#3d405b', '#222', '#6b705c', '#283618']))] }); } }
function buildRiderInstances(G) {
  const body = new THREE.CapsuleGeometry(0.2, 0.42, 2, 7); body.scale(1, 1, 0.75); body.translate(0, 0.55, 0);
  const arms = new THREE.BoxGeometry(0.6, 0.09, 0.1); arms.translate(0, 0.8, 0.12);
  const shirt = BGU.mergeGeometries([body.toNonIndexed(), arms.toNonIndexed()].map(g => { g.deleteAttribute('uv'); return g; }));
  const skin = new THREE.SphereGeometry(0.13, 10, 8); skin.scale(0.9, 1.1, 1); skin.translate(0, 1.02, 0.02);
  const legs = new THREE.BoxGeometry(0.34, 0.15, 0.5); legs.translate(0, 0.25, 0.25);
  const mats = [new THREE.MeshStandardMaterial({ roughness: 0.85 }), new THREE.MeshStandardMaterial({ roughness: 0.5 }), new THREE.MeshStandardMaterial({ roughness: 0.8 })];
  G.riderIM = [shirt, skin, legs].map((g, k) => { const im = new THREE.InstancedMesh(g, mats[k], RIDERS.length); im.frustumCulled = false; RIDERS.forEach((rd, i) => im.setColorAt(i, rd.c[k])); G.scene.add(im); return im; });
}
const _rm = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function updateRiderInstances(G) {
  if (!G.riderIM) return;
  RIDERS.forEach((rd, i) => { const m = rd.o.parent ? (rd.o.updateWorldMatrix(true, false), rd.o.matrixWorld) : _zero; for (const im of G.riderIM) im.setMatrixAt(i, m); });
  for (const im of G.riderIM) im.instanceMatrix.needsUpdate = true;
}

// =============================================================
export class Ride {
  constructor(G, id, cfg) {
    this.G = G; this.id = id; this.cfg = cfg; this.name = cfg.name; this.price = cfg.price;
    this.g = new THREE.Group(); this.g.userData.rideId = id; this.g.position.set(cfg.u, 0, cfg.v); G.fairRoot.add(this.g);
    this.seats = []; this.phase = 'load'; this.t = R(0, 10); this.loadT = 12; this.runT = 50; this.k = 0; this.player = null; this.cam = 'third';
    this.B = new Batcher(); this.bulbs = new Bulbs();
  }
  /** Fortschritt 0..1 und Intensität (Anlauf/Auslauf) */
  cycle(dt) {
    this.t += dt;
    if (this.phase === 'load' && this.t > this.loadT) { this.phase = 'run'; this.t = 0; this.onStart?.(); }
    if (this.phase === 'run' && this.t > this.runT) { this.phase = 'load'; this.t = 0; this.onStop?.(); if (this.player) this.G.player.unboard(this); }
    const p = this.phase === 'run' ? this.t / this.runT : 0;
    const target = this.phase === 'run' ? Math.min(1, smooth(clamp(p / 0.15, 0, 1)), smooth(clamp((1 - p) / 0.18, 0, 1))) : 0;
    this.k = target; return p;
  }
  /** Ticket-Kasse an lokaler Position (du,dv relativ zur Attraktion), Blickrichtung ry */
  booth(du, dv, ry, signColor = '#ffd166') {
    const B = this.G.fairBatch; const u = this.cfg.u + du, v = this.cfg.v + dv;
    B.at(u, 0, v, ry);
    B.add(new THREE.BoxGeometry(1.8, 2.4, 1.6), pbr('shutter', { tile: 1.2, color: '#4a4e6a', metalness: 0.4 }), 0, 1.2, 0);
    B.add(new THREE.BoxGeometry(1.4, 0.9, 0.05), Glow('#a9def9', 0.7), 0, 1.5, 0.81);
    B.add(new THREE.BoxGeometry(2.2, 0.25, 2), M('#d90429'), 0, 2.5, 0);
    // Schild und Preistafel teilen sich EINE Textur (oben „KEESS“, unten der Preis) -> kein zusätzlicher Draw-Call
    const pr = euro(this.price);
    const kt = canvasTex(256, 128, (g) => { g.fillStyle = '#1a0a2e'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#d90429'; g.lineWidth = 5; g.strokeRect(4, 4, 248, 56); g.strokeRect(4, 68, 248, 56);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '38px Bungee, Impact, sans-serif'; g.shadowColor = signColor; g.shadowBlur = 9; g.fillStyle = signColor; g.fillText('KEESS', 128, 34);
      g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.font = '32px Bungee, Impact, sans-serif'; g.fillText(pr, 128, 98); });
    const km = new THREE.MeshBasicMaterial({ map: kt, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
    const half = (geo, v0) => { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setY(i, v0 + a.getY(i) * 0.5); return geo; };
    B.add(half(new THREE.BoxGeometry(1.9, 0.5, 0.08), 0.5), km, 0, 2.95, 0.9);
    B.add(half(new THREE.BoxGeometry(1.2, 0.5, 0.05), 0), km, 0, 0.6, 0.83);
    // Kasse-Details mit den Materialien von oben: Sockel, Eckprofile, Zahlbrett mit Konsolen, Fensterrahmen, Vordach, Seitenfenster
    const red = M('#d90429'), win = Glow('#a9def9', 0.7), bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    B.add(bx(1.96, 0.14, 1.76), red, 0, 0.07, 0);
    for (const sx of [-1, 1]) { for (const sz of [-1, 1]) B.add(bx(0.1, 2.38, 0.1), red, sx * 0.9, 1.19, sz * 0.8); B.add(bx(0.06, 0.26, 0.3), red, sx * 0.7, 0.86, 0.94); B.add(bx(0.07, 0.96, 0.07), red, sx * 0.745, 1.5, 0.83); B.add(bx(0.04, 0.6, 0.8), win, sx * 0.91, 1.55, 0); }
    B.add(bx(1.7, 0.07, 0.38), red, 0, 1.01, 0.97); B.add(bx(1.56, 0.07, 0.07), red, 0, 1.98, 0.83); B.add(bx(2.3, 0.06, 0.8), red, 0, 2.27, 1.3, 0.3);
    B.at(null);
    if (this.G.fairBulbs) { this.G.fairBulbs.at(u, 0, v, ry).line([-1.05, 2.68, 1.02], [1.05, 2.68, 1.02], 0.3, signColor, 1, 2.4); this.G.fairBulbs.at(null); }
    this.G.fairCircle(u, v, 1.2, 'booth');
    const f = L(u + Math.sin(ry) * 1.9, v + Math.cos(ry) * 1.9);
    this.boothPos = f;
    this.G.addInteract({ x: f.x, z: f.z, r: 2.4, kind: 'ride', need: 'ride', ref: this, icon: 'ride', label: () => `${this.name} – ${euro(this.G.price(this.price, 'ride'))}` });
    this.G.glow.paint(u + Math.sin(ry) * 2, v + Math.cos(ry) * 2, signColor, 5, 0.5);
  }
  exitPoint() { return this.boothPos; }
  sign(text, w, h, x, y, z, ry = 0, colors = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, { w: 1024, h: Math.round(1024 * h / w), ...colors }), toneMapped: false, color: new THREE.Color(1.7, 1.7, 1.7), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; this.g.add(m); return m;
  }
  finish() { this.B.build(this.g); this.bulbs.build(this.g); }
  /** Spieler steigt ein: gibt Sitz (Object3D) zurück */
  boardSeat() { const free = this.seats.filter(s => !s.userData.rider); const s = free.length ? pick(free) : this.seats[0]; if (s.userData.rider) { s.remove(s.userData.rider); s.userData.rider = null; } return s; }
  board() { this.player = true; this.phase = 'load'; this.t = Math.max(this.t, this.loadT - 3); return this.boardSeat(); }
}

// =============================================================
// Grande Roue Bellevue (Riesenrad) – Achse entlang v, Rad sichtbar von den Alleen
class Ferris extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg);
    const HUB = 30, RAD = 25, N = 28; this.N = N; this.HUB = HUB; this.RAD = RAD; this.cam = 'third';
    const white = M('#f4f4f4', { metalness: 0.6, roughness: 0.25 }), steel = M('#d9d9d9', { metalness: 0.6, roughness: 0.35 });
    // A-Böcke
    for (const z of [-3.2, 3.2]) { beam(this.B, [-16, 0, z * 1.6], [0, HUB, z], 0.45, white, 8); beam(this.B, [16, 0, z * 1.6], [0, HUB, z], 0.45, white, 8);
      beam(this.B, [-9, 13, z * 1.35], [9, 13, z * 1.35], 0.2, white); for (let k = 0; k < 9; k++) { const t = k / 9; beam(this.B, [-16 + 16 * t, HUB * t, z * (1.6 - 0.6 * t)], [16 - 16 * t, HUB * t, z * (1.6 - 0.6 * t)], 0.06, steel); } }
    this.B.add(new THREE.CylinderGeometry(0.9, 0.9, 8, 12), steel, 0, HUB, 0, Math.PI / 2);
    // Plattform & Treppe
    this.B.add(new THREE.BoxGeometry(12, 1.0, 6), pbr('metal', { tile: 1.5, color: '#b9a3d6', metalness: 0.6, roughness: 0.6 }), 0, 0.5, 0);
    for (let i = 0; i < 4; i++) this.B.add(new THREE.BoxGeometry(3, 0.25, 0.6), M('#777'), 0, 0.725 - i * 0.15, 3.3 + i * 0.6);   // Stufen: vom Podest (1,0) hinunter auf die Kufe (0,4)
    this.B.add(new THREE.BoxGeometry(32, 0.4, 2.2), M('#4a4e69'), 0, 0.2, -5.6); this.B.add(new THREE.BoxGeometry(32, 0.4, 2.2), M('#4a4e69'), 0, 0.2, 5.6);
    // --- Details: Riffelblech-Podest, Geländer, Unterpallung, Fachwerk-Diagonalen, Reibrad-Antrieb, Zaun, Packwagen, Aggregat
    const K = new Det(), WH = '#f4f4f4', GRN = '#35c759';
    K.box(12.3, 0.05, 6.3, PLATE, 0, 1.03, 0, 0, { k: 't' }); K.box(12.36, 0.16, 6.36, GRN, 0, 0.9, 0); K.box(12.2, 0.1, 6.2, DARK, 0, 0.05, 0);
    for (let x = -6; x <= 6.01; x += 1.5) for (const z of [-3.03, 3.03]) K.box(0.07, 0.72, 0.04, STEEL, x, 0.46, z);
    K.rail([[5.9, 1.05, -1.7], [5.9, 1.05, -2.9], [-5.9, 1.05, -2.9], [-5.9, 1.05, -1.7]], WH, { mid: 2 });
    for (const s of [-1, 1]) { K.rail([[s * 5.9, 1.05, 1.7], [s * 5.9, 1.05, 2.9], [s * 1.6, 1.05, 2.9]], WH, { mid: 2 }); K.rail([[s * 1.55, 0.95, 3.05], [s * 1.55, 0.4, 5.35]], WH);
      for (let i = 0; i < 4; i++) K.box(0.05, 0.03, 0.6, YEL, s * 1.45, 0.855 - i * 0.15, 3.3 + i * 0.6);
      // Fußpunkte der A-Böcke: Unterpallung + Querriegel; Nabenlager
      for (const t of [-1, 1]) footPad(K, s * 16, t * 5.12, 0.4, 1.2);
      K.bar([s * 16, 0.62, -5.1], [s * 16, 0.62, 5.1], 0.3, WH); K.box(1.5, 1.5, 0.9, WH, 0, HUB, s * 3.3); K.cyl(1.1, 0.3, DARK, 0, HUB, s * 4.1, 10, { rx: Math.PI / 2, cap: true });
      // Fachwerk-Diagonalen in den A-Böcken (zwischen den vorhandenen Sprossen)
      for (let k = 1; k < 8; k++) { const t0 = k / 9, t1 = (k + 1) / 9, d = k % 2 ? 1 : -1; K.tube([d * (-16 + 16 * t0), HUB * t0, s * 3.2 * (1.6 - 0.6 * t0)], [d * (16 - 16 * t1), HUB * t1, s * 3.2 * (1.6 - 0.6 * t1)], 0.06, STEEL); }
      // Reibrad-Antrieb: Ständer mit Strebe, Motor, Reifen seitlich am Radkranz (außerhalb der Gondelbahn)
      for (const t of [-1, 1]) { K.box(0.26, 3.9, 0.26, WH, s * 4.6, 3.0, t * 1.95); K.bar([s * 4.6, 3.3, t * 1.95], [s * 5.6, 1.06, t * 1.95], 0.14, WH); K.box(0.6, 0.55, 0.5, YEL, s * 4.6, 5.1, t * 1.88);
        K.cyl(0.34, 0.24, RUB, s * 4.6, 5.3, t * 1.3, 10, { rx: Math.PI / 2, cap: true }); K.tube([s * 4.6, 5.3, t * 1.3], [s * 4.6, 5.3, t * 1.9], 0.06, STEEL); }
      // Zaun: seitlich (ab Boden) und vorne (auf der Kufe, mit Lücke für Treppe und Kasse)
      K.rail([[s * 16.9, 0, -5.4], [s * 16.9, 0, 5.4]], STEEL, { h: 1.45, mid: 2, post: 2.2 });
      for (const t of [-1, 1]) K.dots([s * 15.3, 1.4, t * 5.62], [s * 0.9, 28.3, t * 3.75], 0.9, '#ffffff', 2.2, 0.16); }
    K.rail([[-16.9, 0.4, -5.4], [16.9, 0.4, -5.4]], STEEL, { mid: 2, post: 2.4 });
    for (const [x0, x1] of [[-16.9, -1.7], [1.7, 7.7], [10.3, 16.9]]) K.rail([[x0, 0.4, 5.4], [x1, 0.4, 5.4]], STEEL, { bars: 0.3, post: 2.4 });
    trailer(K, -11.5, -3.85, Math.PI, 6, WH, GRN); cable(K, [-8.3, -3.3], [-6.1, -2.2]);
    genset(K, 12, 0, -4.3, 0); cable(K, [10.9, -4.3], [6.1, -2.4]);
    K.flush(this.B, this);
    // Rotor
    this.rotor = new THREE.Group(); this.rotor.position.y = HUB; this.g.add(this.rotor);
    const RB = new Batcher(), rb = new Bulbs();
    for (const z of [-0.9, 0.9]) {
      RB.add(new THREE.TorusGeometry(RAD, 0.22, 6, 120), white, 0, 0, z); RB.add(new THREE.TorusGeometry(RAD - 1.6, 0.15, 6, 120), white, 0, 0, z);
      for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; beam(RB, [Math.cos(a) * 1.8, Math.sin(a) * 1.8, z * 2.2], [Math.cos(a) * RAD, Math.sin(a) * RAD, z], 0.11, white);
        const a2 = (i + 0.5) / N * Math.PI * 2; beam(RB, [Math.cos(a) * (RAD - 1.6), Math.sin(a) * (RAD - 1.6), z], [Math.cos(a2) * RAD, Math.sin(a2) * RAD, z], 0.07, white); }
      rb.circle(0, 0, z, RAD + 0.25, 240, '#c6ff3d', 1, 'xy', 3.0); rb.circle(0, 0, z, RAD - 1.6, 180, '#e9ff8a', 2, 'xy', 2.4);
      for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; for (let k = 3; k < 12; k++) { const rr = 1.8 + (RAD - 1.8) * k / 12; rb.add(Math.cos(a) * rr, Math.sin(a) * rr, z, i % 2 ? '#ffffff' : '#9dff5b', k / 12 + i * 0.1, 1, 2.6); } }
    }
    // Nabe in Rot mit Strahlen-Lichtern (wie im Foto)
    RB.add(new THREE.CylinderGeometry(5.2, 5.2, 0.4, 32), M('#b5121b', { roughness: 0.5 }), 0, 0, 1.25, Math.PI / 2);
    for (let r = 1.2; r < 5.2; r += 0.5) rb.circle(0, 0, 1.5, r, Math.round(r * 9), i => i % 2 ? '#ff3b30' : '#ffd166', 2, 'xy', 2.8);
    const emb = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#14532d'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#ffd166'; g.font = 'bold 54px Bungee, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GB', 64, 68); }), toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) }));
    emb.position.z = 1.6; this.rotor.add(emb);
    RB.build(this.rotor); rb.build(this.rotor);
    // Gondeln (instanziert)
    const cab = new THREE.CylinderGeometry(1.25, 1.25, 1.9, 14); const roof = new THREE.CylinderGeometry(0.2, 1.4, 0.6, 14); roof.translate(0, 1.25, 0);
    const hang = new THREE.BoxGeometry(0.12, 2.2, 0.12); hang.translate(0, 2.6, 0);
    const { mergeGeometries } = this.G.BGU; const cabGeo = mergeGeometries([cab, roof, hang].map(g => g.toNonIndexed()));
    const glass = new THREE.CylinderGeometry(1.28, 1.28, 0.8, 14, 1, true); glass.translate(0, 0.25, 0);
    this.cabIM = new THREE.InstancedMesh(cabGeo, M('#35c759', { roughness: 0.4, metalness: 0.2 }), N);
    this.glassIM = new THREE.InstancedMesh(glass, new THREE.MeshStandardMaterial({ color: '#0c2a1a', emissive: '#c6ff3d', emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.15 }), N);
    this.cabIM.frustumCulled = this.glassIM.frustumCulled = false;
    this.g.add(this.cabIM, this.glassIM);
    for (let i = 0; i < N; i++) { const s = new THREE.Object3D(); this.g.add(s); this.seats.push(s); }
    fillRiders(this.seats, 0.55);
    this.ang = 0; this.speed = Math.PI * 2 / 95; // 95 s pro Umdrehung
    this.booth(9, 5, 0, '#c6ff3d');
    this.sign('GRANDE ROUE BELLEVUE', 16, 1.6, 0, 3.2, 3.1, 0, { fg: '#c6ff3d', border: '#35c759' });
    G.fairBox(cfg.u - 16, cfg.v, 1.2, 4); G.fairBox(cfg.u + 16, cfg.v, 1.2, 4); G.fairBox(cfg.u, cfg.v, 6, 3);
    this.G.glow.paint(cfg.u, cfg.v, '#c6ff3d', 22, 0.45);
    this.finish();
  }
  update(dt) {
    this.ang += this.speed * dt; this.rotor.rotation.z = this.ang;
    for (let i = 0; i < this.N; i++) {
      const a = this.ang + i / this.N * Math.PI * 2; const x = Math.cos(a) * this.RAD, y = this.HUB + Math.sin(a) * this.RAD - 3.4;
      _m.makeRotationZ(Math.sin(this.ang * 3 + i) * 0.03); _m.setPosition(x, y, 0); this.cabIM.setMatrixAt(i, _m); this.glassIM.setMatrixAt(i, _m);
      const s = this.seats[i]; s.position.set(x, y - 0.6, 0); s.rotation.set(0, -Math.PI / 2, 0); // Blick Richtung +u (zum Haupttor)
    }
    this.cabIM.instanceMatrix.needsUpdate = true; this.glassIM.instanceMatrix.needsUpdate = true;
    if (this.player) {
      this.travel += this.speed * dt;
      const a = (this.ang + this.seatIdx / this.N * Math.PI * 2) % (Math.PI * 2);
      this.atTop = Math.abs(((a - Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.3;
      if (this.travel > Math.PI * 2 - 0.05) this.G.player.unboard(this);
    }
  }
  board() {
    // Gondel, die gerade unten ist
    let best = 0, bd = 9; for (let i = 0; i < this.N; i++) { const a = ((this.ang + i / this.N * Math.PI * 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); const d = Math.abs(a - Math.PI * 1.5); if (d < bd) { bd = d; best = i; } }
    this.seatIdx = best; this.travel = 0; this.player = true; const s = this.seats[best]; if (s.userData.rider) { s.remove(s.userData.rider); s.userData.rider = null; } return s;
  }
}

// =============================================================
// Carrousel Galopant (Doppelstock, nostalgisch, goldene Lichter)
class Carousel extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.runT = 70; this.loadT = 10;
    const gold = M('#d4a017', { metalness: 0.8, roughness: 0.3 }), cream = M('#f5e6c8'), red = M('#9b2226');
    this.B.add(new THREE.CylinderGeometry(8.6, 8.8, 0.5, 40), pbr('wood', { tile: 1.2, color: '#a46a4c' }), 0, 0.25, 0);
    // --- Details: Sockelblende (rot/creme), festes Geländer mit Ein-/Ausgangstor, Holzstufe
    const K = new Det();
    for (let i = 0; i < 28; i++) { const a = (i + 0.5) / 28 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), ry = -a + Math.PI / 2;
      K.box(1.95, 0.42, 0.05, i % 2 ? '#9b2226' : '#f5e6c8', c * 8.8, 0.23, sn * 8.8, ry); K.box(0.17, 0.17, 0.04, '#d4a017', c * 8.83, 0.24, sn * 8.83, ry, { rz: Math.PI / 4 }); K.box(1.95, 0.04, 0.3, '#d4a017', c * 8.68, 0.49, sn * 8.68, ry); }
    K.ring(8.45, 0.5, [[1.12, 1.356], [1.786, 7.023]], '#d4a017', { bars: 0.33, h: 1.0 });
    gate(K, -0.85, 0.5, 8.42, 0, 1.5, '#39d353'); gate(K, 0.85, 0.5, 8.42, 0, 1.5, '#ff3b30');
    K.box(3.6, 0.25, 0.4, '#8a5a3c', 0, 0.125, 9.0); K.box(3.62, 0.03, 0.05, YEL, 0, 0.255, 9.18);
    K.flush(this.B, this);
    this.rot = new THREE.Group(); this.g.add(this.rot);
    const RB = new Batcher(), rb = new Bulbs();
    RB.add(new THREE.CylinderGeometry(8.2, 8.2, 0.3, 40), pbr('wood', { tile: 1, color: '#c08a5c', roughness: 0.6 }), 0, 0.65, 0);
    RB.add(new THREE.CylinderGeometry(7.8, 7.8, 0.35, 40), pbr('wood', { tile: 1, color: '#c08a5c', roughness: 0.6 }), 0, 4.5, 0);
    RB.add(new THREE.CylinderGeometry(1.8, 1.8, 8, 16), red, 0, 4.6, 0);
    // Spiegel-/Bildpaneele an der Mittelsäule
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; RB.add(new THREE.BoxGeometry(0.9, 1.6, 0.05), Glow(i % 2 ? '#f6d365' : '#a1c4fd', 0.7), Math.cos(a) * 1.85, 2.4, Math.sin(a) * 1.85, 0, -a + Math.PI / 2); RB.add(new THREE.BoxGeometry(0.9, 1.6, 0.05), Glow(i % 2 ? '#a1c4fd' : '#f6d365', 0.7), Math.cos(a) * 1.85, 6.2, Math.sin(a) * 1.85, 0, -a + Math.PI / 2); }
    // Geländer oben, Treppe
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; RB.add(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), gold, Math.cos(a) * 7.7, 5.2, Math.sin(a) * 7.7); }
    RB.add(new THREE.TorusGeometry(7.7, 0.06, 4, 64), gold, 0, 5.7, 0, Math.PI / 2);
    // Baldachin
    const canopy = new THREE.ConeGeometry(9.2, 2.6, 40, 1, true); RB.add(canopy, M('#f1e3c6', { side: THREE.DoubleSide }), 0, 10.3, 0);
    RB.add(new THREE.CylinderGeometry(9.2, 9.2, 1.4, 40, 1, true), M('#c9a227', { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.35 }), 0, 8.4, 0);
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; RB.add(new THREE.CircleGeometry(0.9, 16, 0, Math.PI), M('#f6e7c1', { side: THREE.DoubleSide }), Math.cos(a) * 9.25, 7.7, Math.sin(a) * 9.25, Math.PI, -a + Math.PI / 2); }
    RB.add(new THREE.ConeGeometry(0.6, 2, 12), gold, 0, 12.6, 0);
    for (let k = 0; k < 4; k++) rb.circle(0, 7.75 + k * 0.42, 0, 9.3, 120, '#ffcf70', k % 2 ? 2 : 1, 'xz', 2.6);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rb.line([Math.cos(a) * 9.1, 9.1, Math.sin(a) * 9.1], [Math.cos(a) * 0.6, 11.5, Math.sin(a) * 0.6], 0.55, '#ffe29a', 1, 2.3); }
    rb.circle(0, 4.35, 0, 7.9, 90, '#ffd98a', 2, 'xz', 2.2); rb.circle(0, 0.85, 0, 8.25, 90, '#ffd98a', 2, 'xz', 2.2);
    // Pferde (Sitze) auf zwei Ebenen
    this.horses = [];
    const horseGeo = makeHorseGeo(this.G);
    const colors = ['#ffffff', '#f5e6c8', '#3b2a20', '#8d5524', '#d4a017', '#bfbfbf'];
    for (const [lvl, y, rr, n] of [[0, 0.8, 6.2, 16], [0, 0.8, 4.4, 12], [1, 4.65, 6.0, 14]]) {
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + lvl * 0.2 + rr * 0.1;
        const h = new THREE.Object3D(); h.userData.col = pick(colors); h.position.set(Math.cos(a) * rr, y + 1.1, Math.sin(a) * rr); h.rotation.y = -a; this.rot.add(h);
        RB.add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), gold, Math.cos(a) * rr, y + 1.6, Math.sin(a) * rr);
        const seat = new THREE.Object3D(); seat.position.set(0, 0.3, 0); seat.rotation.y = Math.PI / 2; h.add(seat); this.seats.push(seat); this.horses.push({ h, y0: y + 1.1, ph: rand() * 6 }); }
    }
    RB.build(this.rot); rb.build(this.rot);
    // alle Pferde in einem Draw-Call
    this.horseIM = new THREE.InstancedMesh(horseGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 }), this.horses.length); this.horseIM.frustumCulled = false;
    this.horses.forEach((o, i) => this.horseIM.setColorAt(i, new THREE.Color(o.h.userData.col))); this.g.add(this.horseIM);
    fillRiders(this.seats, 0.45);
    this.booth(5.5, 7.5, 0, '#ffcf70');
    this.sign('CARROUSEL GALOPANT', 9, 1.0, 0, 9.0, 9.4, 0, { fg: '#ffcf70', border: '#9b2226', bg: '#3b1d0e' });
    G.fairCircle(cfg.u, cfg.v, 8.8, 'ride'); this.G.glow.paint(cfg.u, cfg.v, '#ffcf70', 14, 0.6);
    this.finish(); this.a = 0;
  }
  update(dt) { this.cycle(dt); const sp = 0.12 + this.k * 0.33; this.a += sp * dt; this.rot.rotation.y = this.a;
    const inv = this.g.matrixWorld.clone().invert(); this.rot.updateMatrixWorld(true);
    this.horses.forEach((o, i) => { o.h.position.y = o.y0 + Math.sin(this.a * 6 + o.ph) * 0.35 * (0.3 + this.k); o.h.updateMatrixWorld(); _rm.multiplyMatrices(inv, o.h.matrixWorld); this.horseIM.setMatrixAt(i, _rm); }); this.horseIM.instanceMatrix.needsUpdate = true; }
}
function makeHorseGeo(G) {
  const { mergeGeometries } = G.BGU;
  const body = new THREE.BoxGeometry(1.4, 0.55, 0.42); const neck = new THREE.BoxGeometry(0.35, 0.8, 0.32); neck.rotateZ(-0.5); neck.translate(0.75, 0.45, 0);
  const head = new THREE.BoxGeometry(0.6, 0.28, 0.28); head.rotateZ(-0.3); head.translate(1.05, 0.8, 0);
  const legs = []; for (const [x, z] of [[0.5, 0.15], [0.5, -0.15], [-0.5, 0.15], [-0.5, -0.15]]) { const l = new THREE.BoxGeometry(0.12, 0.7, 0.12); l.rotateZ(x > 0 ? -0.6 : 0.6); l.translate(x + (x > 0 ? 0.2 : -0.2), -0.45, z); legs.push(l); }
  const tail = new THREE.BoxGeometry(0.1, 0.6, 0.1); tail.rotateZ(0.6); tail.translate(-0.82, 0, 0);
  return mergeGeometries([body, neck, head, tail, ...legs].map(g => g.toNonIndexed()));
}

// =============================================================
// Break Dance (Schachbrettboden, rotes Gerüst, Neon-Schild) + Bedienkabine
class BreakDance extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.runT = 55; this.loadT = 12; this.cam = 'third';
    const checker = canvasTex(512, 512, (g) => { const n = 16; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f2f2f2'; g.fillRect(i * 32, j * 32, 32, 32); } g.strokeStyle = '#c1121f'; g.lineWidth = 26; g.beginPath(); g.arc(256, 256, 242, 0, 7); g.stroke(); });
    this.B.add(new THREE.CylinderGeometry(11, 11.3, 0.5, 48), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 }), 0, 0.25, 0);
    // Rotes Fachwerk-Gerüst mit Schild
    const red = M('#d90429', { metalness: 0.5, roughness: 0.4 });
    for (const x of [-10.5, 10.5]) for (const z of [-7.5, -6.3]) beam(this.B, [x, 0, z], [x, 12, z], 0.13, red);
    for (const x of [-10.5, 10.5]) for (let y = 0; y < 12; y += 1.2) beam(this.B, [x, y, -7.5], [x, y + 1.2, -6.3], 0.05, red);
    for (const y of [11.4, 12.6]) for (const z of [-7.5, -6.3]) beam(this.B, [-10.5, y, z], [10.5, y, z], 0.13, red);
    for (let x = -10.5; x < 10.5; x += 1.5) beam(this.B, [x, 11.4, -7.5], [x + 1.5, 12.6, -7.5], 0.05, red);
    this.sign('BREAK DANCE', 12, 3, 0, 14.5, -6.9, 0, { fg: '#ff4fd8', border: '#3a86ff', bg: '#0b0221' });
    this.bulbs.line([-10.5, 12.65, -6.2], [10.5, 12.65, -6.2], 0.4, i => ['#ff006e', '#3a86ff', '#ffbe0b'][i % 3], 1, 3);
    this.bulbs.line([-10.5, 11.35, -6.2], [10.5, 11.35, -6.2], 0.4, i => ['#3a86ff', '#ffbe0b', '#ff006e'][i % 3], 1, 3);
    for (const x of [-10.5, 10.5]) this.bulbs.line([x, 0.5, -6.1], [x, 11.2, -6.1], 0.4, '#ff4fd8', 1, 2.6);
    this.bulbs.circle(0, 0.55, 0, 11.1, 140, i => i % 2 ? '#ff006e' : '#ffbe0b', 1, 'xz', 2.6);
    // --- Details: Rundgeländer mit Toren, Kulisse im Bogen hinter der Bahn (einseitig), Lautsprecher, Schildträger, Kabinen-Ausbau
    const K = new Det(), PKB = '#ff4fd8', dg = Math.PI / 180;
    K.ring(10.85, 0.5, [[-0.611, 0.942], [1.152, 1.431], [1.710, 3.752]], STEEL, { bars: 0.3 });
    gate(K, 0, 0.5, 10.85, 0, 2.6, '#39d353'); gate(K, Math.cos(60 * dg) * 10.85, 0.5, Math.sin(60 * dg) * 10.85, Math.PI / 6, 1.9, '#ff3b30');
    K.box(3.0, 0.25, 0.42, PLATE, 0, 0.125, 11.5); K.box(2.2, 0.25, 0.42, PLATE, Math.cos(60 * dg) * 11.5, 0.125, Math.sin(60 * dg) * 11.5, Math.PI / 6);
    for (let i = 0; i < 6; i++) { const a = (215 + (i + 0.5) * 110 / 6) * dg; K.at(Math.cos(a) * 10.317, 0.5, Math.sin(a) * 10.317, faceIn(a)); this.bulbs.at(Math.cos(a) * 10.317, 0.5, Math.sin(a) * 10.317, faceIn(a));
      backdrop(this, K, -1.665, 1.665, 0, 1, 0, 6.2, ['#3a0ca3', '#b5179e'], { pw: 3.4, i0: i, strut: 0.45, acc: '#ffbe0b', bulb: i % 2 ? '#ff006e' : '#3a86ff' }); }
    K.at(null); this.bulbs.at(null);
    for (const a of [211 * dg, 329 * dg]) speakers(K, Math.cos(a) * 10.25, 0.5, Math.sin(a) * 10.25, faceIn(a), 3);
    for (const x of [-10.5, 10.5]) { footPad(K, x, -6.9, 0, 1.3); for (let y = 1.2; y < 11.3; y += 1.2) K.tube([x, y, -7.5], [x, y, -6.3], 0.04, '#d90429'); }
    for (const x of [-5.8, 0, 5.8]) { K.box(0.12, 3.5, 0.12, '#d90429', x, 14.35, -7.02); K.bar([x, 15.4, -7.02], [x, 12.7, -7.5], 0.08, '#d90429'); }
    // Bedienkabine: nur Dach, Sockel, Zierband, Tür, Fensterrahmen auf der Publikumsseite – die Blickseite (+z) bleibt frei
    K.at(-9.5, 0, 9, Math.PI * 0.8);
    K.box(3.1, 0.12, 2.7, DARK, 0, 0.06, 0); K.box(3.04, 0.14, 2.64, PKB, 0, 1.05, 0); K.box(3.4, 0.12, 3.05, PKB, 0, 2.86, -0.08); K.box(3.46, 0.05, 3.11, DARK, 0, 2.945, -0.08);
    for (const sx of [-1, 1]) { K.box(0.12, 2.8, 0.12, PKB, sx * 1.5, 1.4, -1.3); K.box(0.07, 1.3, 0.07, DARK, sx * 1.22, 1.8, -1.34); K.box(0.3, 0.2, 0.12, '#fff4d6', sx * 0.9, 3.08, 1.3, 0, { em: 2.5 }); K.box(0.6, 0.45, 0.4, RUB, sx * 1.1, 3.2, -1.0); }
    K.box(2.5, 0.07, 0.07, DARK, 0, 2.43, -1.34); K.box(2.5, 0.07, 0.07, DARK, 0, 1.17, -1.34); K.box(0.04, 2.0, 0.85, '#3a3d5c', 1.52, 1.1, -0.3); K.box(0.06, 0.05, 0.12, STEEL, 1.55, 1.1, -0.02); K.box(0.04, 1.6, 0.04, STEEL, -1.3, 3.75, -1.2);
    K.at(null); K.flush(this.B, this);
    // Drehteile: Neigung (Hügel) -> Hauptkreuz -> 4 Teller -> 4 Wagen
    this.tilt = new THREE.Group(); this.tilt.position.y = 0.6; this.tilt.rotation.x = 0.1; this.g.add(this.tilt);
    this.main = new THREE.Group(); this.tilt.add(this.main);
    const RB = new Batcher();
    RB.add(new THREE.CylinderGeometry(1.6, 2, 2.2, 16), M('#3a0ca3', { metalness: 0.5 }), 0, 1.1, 0);
    this.plates = []; this.cars = [];
    const carCols = ['#ef233c', '#3a86ff', '#ffbe0b', '#8338ec'];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2; RB.add(new THREE.BoxGeometry(6, 0.35, 0.6), M('#c0c0c0', { metalness: 0.8, roughness: 0.3 }), Math.cos(a) * 3, 1.6, -Math.sin(a) * 3, 0, a);
      const p = new THREE.Group(); p.position.set(Math.cos(a) * 6, 1.6, -Math.sin(a) * 6); this.main.add(p); this.plates.push(p);
      const PB = new Batcher(); PB.add(new THREE.CylinderGeometry(3.2, 3.2, 0.25, 24), M('#1b1b1b', { metalness: 0.4 }), 0, 0, 0); const pb = new Bulbs(); pb.circle(0, 0.15, 0, 3.15, 32, carCols[i], 1, 'xz', 3); PB.build(p); pb.build(p);
      for (let j = 0; j < 4; j++) {
        const b = j / 4 * Math.PI * 2; const car = new THREE.Group(); car.position.set(Math.cos(b) * 2.1, 0.15, -Math.sin(b) * 2.1); p.add(car);
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.7, 16, 1, false, 0, Math.PI * 1.3), M(carCols[(i + j) % 4], { metalness: 0.4, roughness: 0.3 })); shell.position.y = 0.45; shell.rotation.y = Math.PI * 0.35; car.add(shell);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.18), M(carCols[(i + j + 1) % 4])); back.position.set(0, 0.9, -0.6); car.add(back);
        const seat = new THREE.Object3D(); seat.position.set(0, 0.3, -0.15); car.add(seat); this.seats.push(seat); this.cars.push({ car, w: R(-1, 1) });
      }
    }
    RB.build(this.main);
    fillRiders(this.seats, 0.7);
    // Bedienkabine (wie im Video) – Fenster zur Anlage
    const cabin = new THREE.Group(); cabin.position.set(-9.5, 0, 9); cabin.rotation.y = Math.PI * 0.8; this.g.add(cabin); this.cabin = cabin;
    const CB = new Batcher(); CB.add(new THREE.BoxGeometry(3, 2.8, 2.6), M('#22223b'), 0, 1.4, 0); CB.add(new THREE.BoxGeometry(2.4, 1.2, 0.05), M('#9ad1ff', { transparent: true, opacity: 0.35, metalness: 0.9, roughness: 0.05 }), 0, 1.8, -1.32); CB.build(cabin);
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.55), new THREE.MeshBasicMaterial({ map: signTex('BREAK DANCE', { w: 512, h: 100, fg: '#ff4fd8' }), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) })); cs.position.set(0, 3.05, -1.31); cs.rotation.y = Math.PI; cabin.add(cs);
    this.opCam = new THREE.Object3D(); this.opCam.position.set(0, 1.75, 0.4); cabin.add(this.opCam);
    G.fairCircle(cfg.u, cfg.v, 11.2, 'ride');
    const cw = L(cfg.u - 9.5, cfg.v + 9); G.colliders.circle(cw.x, cw.z, 1.7);
    this.booth(-4, 11.6, 0, '#ff4fd8');
    this.G.glow.paint(cfg.u, cfg.v, '#ff4fd8', 16, 0.55); this.G.glow.paint(cfg.u, cfg.v, '#3a86ff', 9, 0.35);
    this.finish(); this.aM = 0; this.aP = 0; this.manual = false;
  }
  update(dt) {
    if (!this.manual) this.cycle(dt); else { this.k += ((this.opRun ? 1 : 0) - this.k) * dt * 0.5; }
    const k = this.k;
    this.aM += dt * (0.08 + 0.55 * k); this.aP -= dt * (0.15 + 1.4 * k);
    this.main.rotation.y = this.aM; this.tilt.rotation.x = 0.1 * (0.3 + k);
    for (const p of this.plates) p.rotation.y = this.aP;
    for (const c of this.cars) { c.w += (Math.sin(this.aP * 2 + c.car.id) * 3 - c.w) * dt * 0.8; c.car.rotation.y += c.w * dt * (0.4 + k * 2.5); }
  }
}

// =============================================================
// Kettekarussell
class Swing extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.runT = 60; this.cam = 'first';
    const n = 24; this.n = n; this.RR = 5.6;
    this.B.add(new THREE.CylinderGeometry(7.6, 7.8, 0.4, 40), pbr('metal', { tile: 1.5, color: '#7fa7b5', metalness: 0.6 }), 0, 0.2, 0);
    this.B.add(new THREE.CylinderGeometry(0.75, 1.1, 14, 16), M('#e9c46a', { metalness: 0.4 }), 0, 7, 0);
    // --- Details: Rundgeländer mit Toren, Schildportal, Mastfuß mit Knotenblechen, Bildtafeln, Zierringe, Leiter, Bedienkabine
    const K = new Det(), PI = Math.PI, RD = '#e63946', ax = PI * 1.5 - 0.62;
    K.ring(7.45, 0.4, [[-PI / 2 + 0.2, PI * 1.5 - 0.74], [PI * 1.5 - 0.5, PI * 1.5 - 0.2]], STEEL, { bars: 0.3 });
    gate(K, 0, 0.4, -7.45, PI, 2.6, '#39d353'); gate(K, Math.cos(ax) * 7.45, 0.4, Math.sin(ax) * 7.45, Math.atan2(Math.cos(ax), Math.sin(ax)), 1.5, '#ff3b30');
    K.box(3.0, 0.2, 0.4, PLATE, 0, 0.1, -8.0);
    for (const s of [-1, 1]) { K.box(0.14, 4.25, 0.14, RD, s * 3.6, 2.5, -6.5); K.bar([s * 3.6, 4.5, -6.5], [s * 3.4, 4.5, -7.86], 0.1, RD); K.bar([s * 3.6, 3.5, -6.5], [s * 3.4, 3.5, -7.86], 0.1, RD); }
    K.box(7.2, 0.1, 0.1, RD, 0, 4.5, -7.84); K.box(7.2, 0.1, 0.1, RD, 0, 3.5, -7.84);
    K.cyl(1.55, 0.22, DARK, 0, 0.51, 0, 12, { cap: true });
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, b = a + PI / 8; K.box(0.08, 0.9, 0.6, '#e9c46a', Math.cos(a) * 1.3, 0.95, Math.sin(a) * 1.3, -a + PI / 2);
      K.box(0.78, 1.9, 0.04, i % 2 ? '#f6d365' : '#a1c4fd', Math.cos(b) * 1.1, 2.35, Math.sin(b) * 1.1, -b + PI / 2, { em: 0.6 }); }
    for (const y of [3.6, 7, 10.4]) K.cyl(1.15 - 0.025 * y, 0.28, RD, 0, y, 0, 12);
    for (const s of [-1, 1]) K.bar([s * 0.2, 3.8, 1.07], [s * 0.2, 12.6, 0.85], 0.04, STEEL);
    for (let y = 4; y < 12.6; y += 0.45) K.box(0.4, 0.03, 0.03, STEEL, 0, y, 1.07 - (y - 3.8) * 0.025);
    for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; K.dots([Math.cos(a) * 1.1, 3.9, Math.sin(a) * 1.1], [Math.cos(a) * 0.87, 12.6, Math.sin(a) * 0.87], 0.5, '#ffd166', 2.4, 0.12); }
    { const a = Math.atan2(4.3, 3.9); opCabin(K, 3.9, 0.4, 4.3, faceIn(a), '#1d3557', '#ffd166'); speakers(K, 1.9, 0.4, 5.9, faceIn(Math.atan2(5.9, 1.9)), 2); cable(K, [2.9, 3.2], [1.1, 1.2], 0.44); }
    K.flush(this.B, this);
    this.top = new THREE.Group(); this.top.position.y = 13.5; this.g.add(this.top);
    const TB = new Batcher(), tb = new Bulbs();
    TB.add(new THREE.ConeGeometry(6.4, 2.6, 32, 1, true), M('#e63946', { side: THREE.DoubleSide }), 0, 1.0, 0);
    TB.add(new THREE.CylinderGeometry(6.4, 6.4, 1.1, 32, 1, true), M('#f1faee', { side: THREE.DoubleSide }), 0, -0.6, 0);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; tb.line([Math.cos(a) * 6.3, -0.1, Math.sin(a) * 6.3], [Math.cos(a) * 0.4, 2.3, Math.sin(a) * 0.4], 0.5, '#ffd166', 1, 2.6); }
    tb.circle(0, -0.2, 0, 6.45, 90, i => i % 2 ? '#ffffff' : '#ff4d6d', 1, 'xz', 2.6); tb.circle(0, -1.1, 0, 6.45, 90, '#4cc9f0', 2, 'xz', 2.4);
    TB.build(this.top); tb.build(this.top);
    this.chainIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 4).translate(0, -0.5, 0), M('#cccccc', { metalness: 0.9 }), n * 2);
    this.seatIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.12, 0.55), M('#ffbe0b'), n);
    this.chainIM.frustumCulled = this.seatIM.frustumCulled = false;
    this.top.add(this.chainIM, this.seatIM);
    for (let i = 0; i < n; i++) { const s = new THREE.Object3D(); this.top.add(s); this.seats.push(s); }
    fillRiders(this.seats, 0.55);
    this.booth(5, -9, Math.PI, '#ffd166');
    this.sign('KETTEKARUSSELL', 7, 0.9, 0, 4, -7.9, Math.PI, { fg: '#ffd166', border: '#e63946' });
    G.fairCircle(cfg.u, cfg.v, 1.4, 'ride'); this.G.glow.paint(cfg.u, cfg.v, '#ffd166', 12, 0.5);
    this.finish(); this.a = 0; this.ang = 0;
  }
  update(dt) {
    this.cycle(dt); const w = 0.25 + this.k * 1.25; this.a += w * dt; this.top.rotation.y = this.a;
    this.top.rotation.z = Math.sin(this.a * 0.5) * 0.12 * this.k;
    const target = Math.atan(w * w * this.RR / 9.81) * 1.05; this.ang += (target - this.ang) * dt * 1.5;
    const L0 = 5.2; const e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, L0, 1);
    for (let i = 0; i < this.n; i++) {
      const a = i / this.n * Math.PI * 2; const px = Math.cos(a) * this.RR, pz = Math.sin(a) * this.RR;
      e.set(0, -a, 0, 'YXZ'); q.setFromEuler(e); const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.ang); q.multiply(q2);
      for (const o of [-0.25, 0.25]) { const tang = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(o); _m.compose(p.set(px + tang.x, -1.1, pz + tang.z), q, sc); this.chainIM.setMatrixAt(i * 2 + (o > 0 ? 1 : 0), _m); }
      const end = new THREE.Vector3(0, -L0, 0).applyQuaternion(q).add(p.set(px, -1.1, pz));
      _m.compose(end, q, _s); this.seatIM.setMatrixAt(i, _m);
      const s = this.seats[i]; s.position.copy(end); s.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)));
    }
    this.chainIM.instanceMatrix.needsUpdate = this.seatIM.instanceMatrix.needsUpdate = true;
  }
}

// =============================================================
// Fräifall-Tuerm
class FreeFall extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); const H = cfg.height || 62; this.H = H; this.cam = 'first'; this.loadT = 12; this.runT = 40;
    const tex = canvasTex(64, 256, (g) => { g.fillStyle = '#1b1b2f'; g.fillRect(0, 0, 64, 256); g.strokeStyle = '#8d99ae'; g.lineWidth = 3; for (let y = 0; y < 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 16); g.moveTo(64, y); g.lineTo(0, y + 16); g.stroke(); } }, { repeat: [1, 8] });
    this.B.add(new THREE.BoxGeometry(2.4, H, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.4 }), 0, H / 2, 0);
    this.B.add(new THREE.CylinderGeometry(4.6, 4.8, 0.5, 24), pbr('metal', { tile: 1.5, color: '#8a8ea8', metalness: 0.6 }), 0, 0.25, 0);
    this.B.add(new THREE.CylinderGeometry(2.2, 1.6, 3, 12), M('#ef233c'), 0, H + 1.5, 0);
    this.B.add(new THREE.ConeGeometry(1.5, 4, 12), M('#ffd166', { metalness: 0.6 }), 0, H + 5, 0);
    // --- Details: Rundgeländer mit Toren und Stufen, Turmschüsse mit Flanschen, Führungsschienen, Bremsschwerter, Wartungsbühne, Warnleuchte
    const K = new Det(), PI = Math.PI, RD = '#ef233c';
    K.ring(4.68, 0.5, [[-PI / 2 - 0.53, -PI / 2 + 0.53], [-PI / 2 + 0.87, PI * 1.5 - 0.87]], STEEL, { bars: 0.3 });
    for (const [da, c] of [[-0.7, '#39d353'], [0.7, '#ff3b30']]) { const a = -PI / 2 + da, ry = Math.atan2(Math.cos(a), Math.sin(a)); gate(K, Math.cos(a) * 4.68, 0.5, Math.sin(a) * 4.68, ry, 1.4, c);
      K.at(Math.cos(a) * 4.8, 0, Math.sin(a) * 4.8, ry).box(1.5, 0.25, 0.38, PLATE, 0, 0.125, 0.2); K.at(null); }
    for (let y = 6; y < H; y += 6) K.box(2.56, 0.16, 2.56, '#8d99ae', 0, y, 0);
    for (const s of [-1, 1]) for (const t of [-1, 1]) { K.box(0.1, H - 1, 0.07, STEEL, s * 0.6, H / 2 + 0.5, t * 1.235); K.box(0.07, H - 1, 0.1, STEEL, t * 1.235, H / 2 + 0.5, s * 0.6); }
    for (let y = 7; y < 15.5; y += 0.8) for (const t of [-1, 1]) { K.box(0.5, 0.05, 0.12, '#b87333', 0, y, t * 1.26); K.box(0.12, 0.05, 0.5, '#b87333', t * 1.26, y, 0); }
    K.cyl(2.5, 0.08, PLATE, 0, H - 1.2, 0, 10, { cap: true }); K.ring(2.4, H - 1.16, [[0, PI * 2]], STEEL, { h: 1.0, mid: 1 });
    for (const s of [-1, 1]) for (const t of [-1, 1]) K.bar([s * 1.2, H - 2.8, t * 1.2], [s * 1.7, H - 1.24, t * 1.7], 0.1, STEEL);
    K.box(0.3, 0.3, 0.3, '#ff2a2a', 0, H + 7.1, 0, 0, { em: 4 });
    K.flush(this.B, this);
    for (const [x, z] of [[1.25, 1.25], [-1.25, 1.25], [1.25, -1.25], [-1.25, -1.25]]) this.bulbs.line([x, 2, z], [x, H, z], 0.7, i => i % 4 === 0 ? '#ffffff' : '#ef233c', 1, 3);
    this.bulbs.circle(0, H + 3.1, 0, 2.3, 30, '#ffd166', 3, 'xz', 3);
    this.ring = new THREE.Group(); this.g.add(this.ring);
    const RB = new Batcher(); RB.add(new THREE.CylinderGeometry(3.2, 3.2, 1.2, 24, 1, true), M('#ef233c', { side: THREE.DoubleSide, metalness: 0.4 }), 0, 0.6, 0);
    const rb = new Bulbs(); rb.circle(0, 1.25, 0, 3.25, 40, '#ffffff', 1, 'xz', 3);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; RB.add(new THREE.BoxGeometry(0.6, 1.1, 0.5), M('#2b2d42'), Math.cos(a) * 3.55, 0.6, Math.sin(a) * 3.55, 0, -a + Math.PI / 2);
      const s = new THREE.Object3D(); s.position.set(Math.cos(a) * 3.8, 0.2, Math.sin(a) * 3.8); s.rotation.y = -a - Math.PI / 2; this.ring.add(s); this.seats.push(s); }
    RB.build(this.ring); rb.build(this.ring);
    fillRiders(this.seats, 0.6);
    this.booth(0, -6.3, Math.PI, '#ef233c');
    this.sign('FRÄIFALL – 62 m', 6, 1, 0, 3.4, -1.25, Math.PI, { fg: '#ffffff', border: '#ef233c' });
    G.fairCircle(cfg.u, cfg.v, 4.8, 'ride'); this.G.glow.paint(cfg.u, cfg.v, '#ef233c', 10, 0.5);
    this.finish(); this.y = 1;
  }
  update(dt) {
    this.cycle(dt); const p = this.phase === 'run' ? this.t : -1; let y;
    if (p < 0) y = 1; else if (p < 22) y = 1 + smooth(p / 22) * (this.H - 7); else if (p < 27) y = this.H - 6; else if (p < 30.2) { const f = (p - 27); y = Math.max(8, this.H - 6 - 0.5 * 9.81 * f * f * 0.62); } else y = lerp(8, 1, clamp((p - 30.2) / 6, 0, 1));
    this.ring.position.y = y; this.ring.rotation.y += dt * (p > 0 && p < 22 ? 0.12 : 0); this.height = y;
  }
}

// =============================================================
// Pendel (Riesenschaukel mit drehender Gondel)
class Pendulum extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.runT = 50; this.cam = 'first';
    const PIV = 17; const blue = M('#3a0ca3', { metalness: 0.5, roughness: 0.4 });
    for (const z of [-3.6, 3.6]) { beam(this.B, [-7.5, 0, z], [0, PIV, z * 0.55], 0.45, blue, 8); beam(this.B, [7.5, 0, z], [0, PIV, z * 0.55], 0.45, blue, 8);
      this.bulbs.line([-7.5, 0.5, z], [0, PIV, z * 0.55], 0.6, '#4cc9f0', 1, 3); this.bulbs.line([7.5, 0.5, z], [0, PIV, z * 0.55], 0.6, '#f72585', 1, 3); }
    this.B.add(new THREE.CylinderGeometry(6.5, 6.8, 0.5, 32), pbr('metal', { tile: 1.5, color: '#7b7b9a', metalness: 0.6 }), 0, 0.25, 0);
    this.B.add(new THREE.CylinderGeometry(0.8, 0.8, 4.2, 12), M('#adb5bd', { metalness: 0.8 }), 0, PIV, 0, Math.PI / 2);
    // --- Details: Rundgeländer mit Toren, Schildpfosten, Unterpallung, Querriegel, Abstrebungen, Lagergehäuse/Antrieb, Bedienkabine, Aggregat, Zaun
    const K = new Det(), PI = Math.PI, BL = '#3a0ca3';
    K.ring(6.4, 0.5, [[-PI / 2 - 0.39, -PI / 2 + 0.39], [-PI / 2 + 0.65, PI * 1.5 - 0.65]], STEEL, { bars: 0.3 });
    for (const [da, c] of [[-0.52, '#39d353'], [0.52, '#ff3b30']]) { const a = -PI / 2 + da, ry = Math.atan2(Math.cos(a), Math.sin(a)); gate(K, Math.cos(a) * 6.4, 0.5, Math.sin(a) * 6.4, ry, 1.45, c);
      K.at(Math.cos(a) * 6.8, 0, Math.sin(a) * 6.8, ry).box(1.6, 0.25, 0.4, PLATE, 0, 0.125, 0.2); K.at(null); }
    for (const s of [-1, 1]) { K.box(0.12, 3.5, 0.12, BL, s * 1.9, 1.75, -6.74);
      K.bar([s * 7.5, 0.5, -3.6], [s * 7.5, 0.5, 3.6], 0.3, BL);
      for (const t of [-1, 1]) { footPad(K, s * 7.5, t * 3.6, 0, 1.2); K.tube([s * 6.375, 2.55, t * 3.357], [s * 6.4, 0.2, t * 5.4], 0.12, BL, 6); footPad(K, s * 6.4, t * 5.4, 0, 0.8); }
      K.box(1.3, 1.3, 0.7, '#ffd60a', 0, PIV, s * 2.45); K.cyl(0.45, 0.9, DARK, 0, PIV, s * 3.2, 8, { rx: PI / 2, cap: true });
      K.rail([[s * 8.95, 0, -5.95], [s * 8.95, 0, 5.95]], STEEL, { mid: 2, post: 2.2 }); K.rail([[s * 3.6, 0, 5.95], [s * 8.95, 0, 5.95]], STEEL, { mid: 2, post: 2.2 }); }
    K.rail([[-8.95, 0, -5.95], [-4.6, 0, -5.95]], STEEL, { bars: 0.3 }); K.rail([[4.6, 0, -5.95], [6.4, 0, -5.95]], STEEL, { bars: 0.3 });
    opCabin(K, 0, 0.5, 5.35, PI, BL, '#f72585', 2.4, 1.5);
    genset(K, 7.9, 0, 5.2, 0); cable(K, [6.8, 5.2], [3.0, 5.6]);
    K.flush(this.B, this);
    this.arm = new THREE.Group(); this.arm.position.y = PIV; this.g.add(this.arm);
    const AB = new Batcher(); AB.add(new THREE.BoxGeometry(0.9, 14, 0.9), M('#f72585', { metalness: 0.4 }), 0, -7, 0); AB.add(new THREE.CylinderGeometry(1.6, 1.6, 1.4, 16), M('#ffd60a'), 0, 1.2, 0);
    const ab = new Bulbs(); ab.line([0.5, 0, 0.5], [0.5, -13.5, 0.5], 0.5, '#ffd60a', 1, 3); ab.line([-0.5, 0, -0.5], [-0.5, -13.5, -0.5], 0.5, '#4cc9f0', 1, 3); AB.build(this.arm); ab.build(this.arm);
    this.disc = new THREE.Group(); this.disc.position.y = -14.2; this.arm.add(this.disc);
    const DB = new Batcher(); DB.add(new THREE.CylinderGeometry(3.8, 3.4, 0.8, 32), M('#4361ee', { metalness: 0.4 }), 0, 0, 0); const db = new Bulbs(); db.circle(0, -0.45, 0, 3.5, 40, '#ffffff', 1, 'xz', 3);
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; DB.add(new THREE.BoxGeometry(0.55, 1.1, 0.5), M('#ffd60a'), Math.cos(a) * 3.6, 0.7, Math.sin(a) * 3.6, 0, -a + Math.PI / 2);
      const s = new THREE.Object3D(); s.position.set(Math.cos(a) * 3.75, 0.3, Math.sin(a) * 3.75); s.rotation.y = -a - Math.PI / 2; this.disc.add(s); this.seats.push(s); }
    DB.build(this.disc); db.build(this.disc);
    fillRiders(this.seats, 0.6);
    this.booth(7.5, -6.8, Math.PI, '#f72585');
    this.sign('PENDEL', 4, 1, 0, 3, -6.8, Math.PI, { fg: '#f72585', border: '#4cc9f0' });
    G.fairBox(cfg.u - 7.5, cfg.v, 1, 4); G.fairBox(cfg.u + 7.5, cfg.v, 1, 4); G.fairCircle(cfg.u, cfg.v, 4.2);
    this.G.glow.paint(cfg.u, cfg.v, '#f72585', 12, 0.5);
    this.finish(); this.th = 0; this.om = 0;
  }
  update(dt) { const p = this.cycle(dt); const amp = this.k * 2.05; this.th = Math.sin(this.t * 2 * Math.PI / 6.2) * amp * (this.phase === 'run' ? 1 : 0); this.arm.rotation.z = this.th; this.disc.rotation.y += dt * (0.3 + this.k * 1.4); }
}

// =============================================================
// Alpina Bahn – Achterbahn (Catmull-Rom-Strecke, Energieerhaltung)
class Coaster extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.cam = 'first'; this.loadT = 12; this.runT = 999;
    // lokale Strecke: x quer (u), z längs (v)
    const P = [[-12, 1.6, 14], [-12, 1.6, 6], [-12, 1.8, -2], [-12, 5, -8], [-12, 13, -15], [-12, 20, -21], [-11, 22, -24], [-6, 22.5, -26.5], [0, 21, -26], [4, 15, -23], [5, 6, -17], [5, 2.6, -10], [5, 3, -4], [5, 12, 3], [5, 13, 8], [5, 9, 13], [5, 3.2, 18], [8, 6, 23], [12, 9, 24.5], [14, 11, 21], [13, 11, 16], [12, 5, 10], [12, 3, 4], [12, 8, -2], [12, 9, -6], [13, 5, -13], [11, 4, -19], [7, 4, -21], [-1, 4.5, -19.5], [-5, 6, -14], [-5, 7, -8], [-4, 3, 0], [-4, 6, 6], [-5, 4, 12], [-6, 2.5, 18], [-9, 2, 21], [-12, 1.7, 19]];
    this.curve = new THREE.CatmullRomCurve3(P.map(p => new THREE.Vector3(...p)), true, 'centripetal');
    this.len = this.curve.getLength(); const N = Math.round(this.len * 1.2);
    // Abtasten
    const samples = []; for (let i = 0; i <= N; i++) { const u = i / N; const p = this.curve.getPointAt(u), t = this.curve.getTangentAt(u); samples.push({ p, t }); }
    this.samples = samples;
    const findS = (pt) => { let best = 0, bd = 1e9; samples.forEach((s, i) => { const d = s.p.distanceTo(new THREE.Vector3(...pt)); if (d < bd) { bd = d; best = i; } }); return best / N * this.len; };
    this.sStation = findS([-12, 1.6, 6]); this.sLiftA = findS([-12, 1.8, -2]); this.sLiftB = findS([-11, 22, -24]);
    // Schienen
    const railMat = M('#e9ecef', { metalness: 0.8, roughness: 0.3 }), spineMat = M('#f77f00', { metalness: 0.5, roughness: 0.4 });
    const rl = [], rr = [], sp = [];
    for (const s of samples) { const right = new THREE.Vector3().crossVectors(s.t, UP).normalize(); const up = new THREE.Vector3().crossVectors(right, s.t); rl.push(s.p.clone().addScaledVector(right, -0.55)); rr.push(s.p.clone().addScaledVector(right, 0.55)); sp.push(s.p.clone().addScaledVector(up, -0.45)); }
    for (const [pts, r, m] of [[rl, 0.08, railMat], [rr, 0.08, railMat], [sp, 0.2, spineMat]]) { const c = new THREE.CatmullRomCurve3(pts, true); this.B.add(new THREE.TubeGeometry(c, N, r, 6, true), m); }
    // Schwellen & Stützen
    for (let i = 0; i < N; i += 2) { const s = samples[i]; const ang = Math.atan2(-s.t.z, s.t.x); this.B.add(new THREE.BoxGeometry(0.2, 0.12, 1.3), spineMat, s.p.x, s.p.y - 0.3, s.p.z, 0, ang);
      if (i % 8 === 0 && s.p.y > 1.8) { this.B.add(new THREE.CylinderGeometry(0.16, 0.2, s.p.y - 0.4, 6), M('#f77f00', { metalness: 0.4 }), s.p.x, (s.p.y - 0.4) / 2, s.p.z); }
      if (i % 3 === 0) this.bulbs.add(s.p.x, s.p.y - 0.1, s.p.z, ['#ffd60a', '#ff006e', '#00f5d4'][(i / 3) % 3 | 0], i / 30, 1, 2.8); }
    // Station
    this.B.add(new THREE.BoxGeometry(5, 1.4, 14), pbr('wood', { tile: 1.5, color: '#a68b6a' }), -14.5, 0.7, 10); this.B.add(new THREE.BoxGeometry(7, 0.3, 16), M('#f77f00'), -12.5, 4.6, 10);
    for (const z of [3, 17]) for (const x of [-16, -9]) this.B.add(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 6), M('#555'), x, 2.3, z);
    this.bulbs.line([-16, 4.4, 2], [-16, 4.4, 18], 0.4, '#ffd60a', 1, 3); this.bulbs.line([-9, 4.4, 2], [-9, 4.4, 18], 0.4, '#ffd60a', 1, 3);
    this.sign('ALPINA BAHN', 14, 2.6, -16.1, 7, 10, -Math.PI / 2, { fg: '#ffffff', border: '#f77f00', bg: '#003049' });
    // --- Details: Fundamente + Abstrebung der Stützen, Laufsteg mit Geländer am Lift, Bahnhof (Satteldach, Holzwand, Treppen, Tore, Kabine), Zaun, Packwagen
    const K = new Det(), OR = '#f77f00', HP = Math.PI / 2;
    // frei = kein Gleis (außer dem eigenen Abschnitt) näher als ca. 1,6 m -> nur dort darf eine Strebe stehen
    const free = (x, y, z, own) => { for (let j = 0; j < N; j++) { const dj = Math.abs(j - own); if (dj < 7 || dj > N - 7) continue; const p = samples[j].p; if ((p.x - x) ** 2 + (p.y + 0.4 - y) ** 2 + (p.z - z) ** 2 < 2.6) return false; } return true; };
    for (let i = 0; i < N; i += 8) { const p = samples[i].p, t = samples[i].t; if (p.y <= 1.8) continue; const h = p.y - 0.4;
      K.box(0.8, 0.22, 0.8, CONC, p.x, 0.11, p.z); K.box(0.5, 0.06, 0.5, DARK, p.x, 0.25, p.z);
      if (h < 5) continue; const hl = Math.hypot(t.x, t.z) || 1, qx = -t.z / hl, qz = t.x / hl, off = Math.min(3, 0.9 + h * 0.14), top = h * 0.72;
      for (const sd of [-1, 1]) { const gx = p.x + qx * off * sd, gz = p.z + qz * off * sd; let ok = Math.abs(gx) < 15.4 && Math.abs(gz) < 25.4;
        for (let q = 0; q <= 6 && ok; q++) ok = free(lerp(gx, p.x, q / 6), lerp(0.2, top, q / 6), lerp(gz, p.z, q / 6), i);
        if (!ok) continue; K.tube([gx, 0.2, gz], [p.x, top, p.z], 0.09, OR); K.box(0.6, 0.2, 0.6, CONC, gx, 0.1, gz);
        if (h > 9) K.tube([lerp(gx, p.x, 0.5), top * 0.5 + 0.1, lerp(gz, p.z, 0.5)], [p.x, top * 0.5 + 0.1, p.z], 0.05, OR); } }
    // Lift: Laufsteg (Riffelblech) auf der Westseite, Geländer, Konsolen, Kette
    { const iA = Math.round(this.sLiftA / this.len * N), iB = Math.round(this.sLiftB / this.len * N); let pv = null;
      for (let i = iA; i <= iB; i++) { const p = samples[i].p, r = new THREE.Vector3().crossVectors(samples[i].t, UP).normalize();
        const c = [p.x - r.x * 1.3, p.y - 0.42, p.z - r.z * 1.3], e = [p.x - r.x * 1.68, p.y - 0.42, p.z - r.z * 1.68], m = [p.x, p.y - 0.2, p.z];
        if (pv) { K.bar(pv.c, c, 0.72, PLATE, { d: 0.05, k: 't' }); K.bar([pv.e[0], pv.e[1] + 1.05, pv.e[2]], [e[0], e[1] + 1.05, e[2]], 0.06, STEEL); K.bar([pv.e[0], pv.e[1] + 0.55, pv.e[2]], [e[0], e[1] + 0.55, e[2]], 0.04, STEEL); K.bar(pv.m, m, 0.1, DARK); }
        if ((i - iA) % 2 === 0) K.box(0.06, 1.05, 0.06, STEEL, e[0], e[1] + 0.525, e[2]);
        if ((i - iA) % 4 === 0) K.bar([p.x, p.y - 0.5, p.z], [e[0], e[1] - 0.05, e[2]], 0.08, OR);
        pv = { c, e, m }; } }
    genset(K, -14.3, 0, -1.3, HP, '#454a54');
    // Bahnhof: Riffelblech, Sicherheitslinie, Zwischenstützen, Satteldach, Schildträger
    K.box(5.04, 0.04, 14.04, PLATE, -14.5, 1.42, 10, 0, { k: 't' }); K.box(0.12, 0.02, 14, YEL, -12.25, 1.45, 10);
    for (const z of [7.67, 12.33]) for (const x of [-16, -9]) K.box(0.16, 4.6, 0.16, '#555555', x, 2.3, z);
    K.box(3.85, 0.08, 16.6, '#7a2e1a', -14.3, 5.24, 10, 0, { rz: 0.25 }); K.box(3.85, 0.08, 16.6, '#7a2e1a', -10.7, 5.24, 10, 0, { rz: -0.25 }); K.box(0.22, 0.12, 16.7, DARK, -12.5, 5.74, 10);
    for (const x of [-16.14, -8.86]) K.box(0.08, 0.26, 16.6, OR, x, 4.72, 10);
    for (const z of [1.75, 18.25]) for (const s of [-1, 1]) K.bar([-12.5 + s * 3.6, 4.8, z], [-12.5, 5.7, z], 0.14, OR);
    for (const z of [4, 10, 16]) { K.box(0.12, 3.7, 0.12, DARK, -15.95, 6.55, z); K.bar([-15.95, 8.0, z], [-14.3, 5.35, z], 0.08, DARK); }
    // Rückwand (Holz) mit Fenstern, Läden und Blumenkästen (Alpen-Deko wie die Bergkulisse)
    K.box(0.08, 4.4, 14, '#c9a070', -8.98, 2.2, 10, 0, { k: 'w' });
    for (const z of [5, 8.35, 11.65, 15]) { K.box(0.04, 1.1, 1.5, '#ffd9a0', -9.06, 2.7, z, 0, { em: 0.9 }); K.box(0.06, 1.1, 0.06, TIMB, -9.09, 2.7, z); K.box(0.06, 0.06, 1.5, TIMB, -9.09, 2.7, z);
      for (const s of [-1, 1]) K.box(0.05, 1.14, 0.4, '#2f6b3a', -9.07, 2.7, z + s * 0.97); K.box(0.2, 0.18, 1.6, TIMB, -9.14, 2.06, z); K.box(0.16, 0.12, 1.5, '#d62828', -9.14, 2.2, z); }
    // Bahnsteig: Geländer, Zugang (Süd) und Ausgang (Nord) über Treppen an den Stirnseiten -> nichts ragt in die Allee
    K.rail([[-16.92, 1.4, 3.05], [-16.92, 1.4, 16.95]], OR, { bars: 0.3 }); K.rail([[-13.0, 1.4, 3.6], [-13.0, 1.4, 16.4]], STEEL, { h: 0.9, post: 2.3 });
    for (const z of [3.05, 16.95]) { K.rail([[-15.05, 1.4, z], [-13.4, 1.4, z]], OR, { bars: 0.3 }); K.rail([[-16.92, 1.4, z], [-16.75, 1.4, z]], OR); }
    K.at(-15.9, 0, 3, Math.PI).stairs(1.6, 1.4, 5, 0.32, PLATE, { k: 't' }); K.at(-15.9, 0, 17, 0).stairs(1.6, 1.4, 5, 0.32, PLATE, { k: 't' }); K.at(null);
    gate(K, -15.9, 1.4, 3.12, Math.PI, 1.5, '#39d353'); gate(K, -15.9, 1.4, 16.88, 0, 1.5, '#ff3b30');
    opCabin(K, -16.0, 1.4, 10, HP, '#003049', OR, 2.0, 1.3);
    // Zaun ums Gelände (vorne zur Allee als Absperrgitter), Packwagen in der Südwest-Ecke
    K.rail([[-15.9, 0, -25.9], [15.9, 0, -25.9], [15.9, 0, 25.9], [-15.9, 0, 25.9]], STEEL, { mid: 2, post: 2.6 });
    K.rail([[-15.9, 0, 25.9], [-15.9, 0, 19.4]], STEEL, { bars: 0.33, post: 2.2 }); K.rail([[-15.9, 0, 0.9], [-15.9, 0, -25.9]], STEEL, { bars: 0.33, post: 2.2 });
    trailer(K, -14.6, 23, -HP, 5.2, '#e9e9ec', OR);
    K.flush(this.B, this);
    // Bergkulisse (die Alpina Bahn hat eine Alpen-Deko)
    const mtn = new THREE.ConeGeometry(7, 14, 5); this.B.add(mtn, M('#6c757d', { flatShading: true }), 2, 7, 0, 0, 0.3); this.B.add(new THREE.ConeGeometry(3.2, 5, 5), M('#f8f9fa', { flatShading: true }), 2, 12.6, 0, 0, 0.3);
    this.B.add(new THREE.ConeGeometry(5, 10, 5), M('#5c677d', { flatShading: true }), 9, 5, -14, 0, 1); this.B.add(new THREE.ConeGeometry(2.2, 3.5, 5), M('#f8f9fa', { flatShading: true }), 9, 9, -14, 0, 1);
    // Zug (3 Wagen à 4 Plätze)
    this.train = []; const cols = ['#d62828', '#003049', '#d62828'];
    for (let i = 0; i < 3; i++) { const car = new THREE.Group(); this.g.add(car);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), M(cols[i], { metalness: 0.5, roughness: 0.3 })); body.position.y = 0.15; car.add(body);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.4), M('#fcbf49')); nose.position.set(0, 0.3, -1.2); car.add(nose);
      for (const [x, z] of [[-0.4, -0.5], [0.4, -0.5], [-0.4, 0.5], [0.4, 0.5]]) { const s = new THREE.Object3D(); s.position.set(x, 0.2, z); car.add(s); this.seats.push(s); }
      this.train.push(car); }
    fillRiders(this.seats, 0.65);
    this.booth(-18.5, 4, -Math.PI / 2, '#f77f00');
    // Kollision: ganzes Gelände außer Station-Zugang
    G.fairBox(cfg.u + 2, cfg.v, 14, 26); G.fairBox(cfg.u - 14.5, cfg.v + 10, 2.5, 7);
    for (let z = -20; z <= 20; z += 10) this.G.glow.paint(cfg.u, cfg.v + z, ['#ffd60a', '#ff006e', '#00f5d4'][Math.abs(z / 10) % 3], 12, 0.35);
    this.finish(); this.s = this.sStation; this.v = 0; this.E = 0; this.run = false; this.screamed = false;
  }
  frameAt(s, car) {
    s = ((s % this.len) + this.len) % this.len; const u = s / this.len; const p = this.curve.getPointAt(u), t = this.curve.getTangentAt(u);
    const right = new THREE.Vector3().crossVectors(t, UP).normalize(); const up = new THREE.Vector3().crossVectors(right, t);
    _m.makeBasis(right, up, t.clone().negate()); car.quaternion.setFromRotationMatrix(_m); car.position.copy(p).addScaledVector(up, 0.25); return p;
  }
  update(dt) {
    const g = 9.81; this.t += dt;
    if (!this.run) { this.v = 0; if (this.t > this.loadT) { this.run = true; this.t = 0; this.passed = 0; } }
    else {
      const sMod = ((this.s % this.len) + this.len) % this.len; const y = this.curve.getPointAt(sMod / this.len).y;
      const inLift = sMod >= this.sLiftA && sMod < this.sLiftB;
      if (inLift) { this.v = Math.max(this.v * 0.98, 3.8); this.E = 0.5 * this.v * this.v + g * y; }
      else if (this.passed > 20 && this.passed < this.len - 30 && sMod > this.sLiftB - 1) { this.E -= dt * 1.2; this.v = Math.sqrt(Math.max(2 * (this.E - g * y), 9)); }
      else { this.v = Math.max(2.4, Math.min(this.v, 6)); if (this.passed > this.len - 30) this.v = Math.max(1.6, this.v * 0.97); }
      if (!inLift && sMod > this.sLiftB && !this.screamed && this.v > 12) { this.screamed = true; this.G.audio?.scream(this.G.fairPosToWorld(this.cfg.u, this.cfg.v)); }
      this.s += this.v * dt; this.passed += this.v * dt;
      if (this.passed >= this.len) { this.run = false; this.t = 0; this.s = this.sStation; this.screamed = false; if (this.player) this.G.player.unboard(this); }
    }
    for (let i = 0; i < 3; i++) this.frameAt(this.s - i * 2.5, this.train[i]);
    this.speedKmh = this.v * 3.6;
  }
  board() { this.player = true; if (this.run) { /* nächster Zug */ } this.t = Math.max(this.t, this.loadT - 4); this.run = false; this.s = this.sStation; this.passed = 0; return this.boardSeat(); }
}

// =============================================================
// Autoscooter Diamond – selber fahren!
class Scooter extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.W = 22, this.D = 13; const W = this.W, D = this.D;
    this.B.add(new THREE.BoxGeometry(W + 2, 0.35, D + 2), pbr('metal', { tile: 1.2, color: '#6a6e78', metalness: 0.7 }), 0, 0.17, 0);
    this.B.add(new THREE.BoxGeometry(W, 0.05, D), pbr('metal', { tile: 1.6, color: '#c8ccd4', metalness: 0.9, roughness: 0.55 }), 0, 0.37, 0);
    for (const [x, z, w, d] of [[0, -D / 2 - 0.3, W + 1, 0.4], [0, D / 2 + 0.3, W + 1, 0.4], [-W / 2 - 0.3, 0, 0.4, D + 1], [W / 2 + 0.3, 0, 0.4, D + 1]]) this.B.add(new THREE.BoxGeometry(w, 0.6, d), M('#ffbe0b'), x, 0.6, z);
    for (const x of [-W / 2 - 0.6, 0, W / 2 + 0.6]) for (const z of [-D / 2 - 0.6, D / 2 + 0.6]) this.B.add(new THREE.CylinderGeometry(0.18, 0.18, 5.2, 8), M('#adb5bd', { metalness: 0.8 }), x, 2.6, z);
    for (let x = -W / 2; x <= W / 2; x += 1.1) this.B.add(new THREE.BoxGeometry(0.05, 0.05, D + 1.2), M('#333'), x, 5.1, 0);
    this.B.add(new THREE.BoxGeometry(W + 2, 0.5, D + 2), M('#1d3557'), 0, 5.6, 0);
    for (let x = -W / 2; x <= W / 2; x += 1.5) for (let z = -D / 2; z <= D / 2; z += 1.5) this.bulbs.add(x, 5.3, z, pick(['#ffffff', '#4cc9f0', '#ff4d6d', '#ffd166']), rand() * 5, 3, 2.4);
    this.bulbs.line([-W / 2 - 1, 5.9, D / 2 + 1.05], [W / 2 + 1, 5.9, D / 2 + 1.05], 0.35, i => i % 2 ? '#4cc9f0' : '#ffffff', 1, 3);
    this.sign('AUTOSCOOTER DIAMOND', 14, 1.6, 0, 7, D / 2 + 1.1, 0, { fg: '#4cc9f0', border: '#ffffff', bg: '#0b132b' });
    // --- Details: Rückwand-Kulisse (einseitig), Säulenfüße/-köpfe, Leuchtblende, Schildträger, Dach-Diamanten, Umlauf-Riffelblech, Geländer mit Toren, Lautsprecher
    const K = new Det(), CY = '#4cc9f0', NV = '#1d3557', HP = Math.PI / 2, zb = -D / 2 - 0.72;
    backdrop(this, K, -W / 2 - 0.4, W / 2 + 0.4, zb, 1, 0.9, 4.45, [NV, '#274c77'], { pw: 2.85, acc: CY, bulb: false });
    for (const s of [-1, 1]) { K.panel(3, 4.45, '#274c77', s * (W / 2 + 0.72), 3.125, -D / 2 + 0.6, -s * HP); K.box(0.14, 4.45, 0.14, STEEL, s * (W / 2 + 0.72), 3.125, -D / 2 + 2.1);
      for (const z of [-D / 2 - 0.6, D / 2 + 0.6]) K.cyl(0.16, 5.2, '#adb5bd', s * 5.8, 2.6, z, 8);
      this.bulbs.line([s * (W / 2 + 1.05), 5.9, -D / 2 - 1], [s * (W / 2 + 1.05), 5.9, D / 2 + 1], 0.35, i => i % 2 ? CY : '#ffffff', 1, 3);
      for (const t of [-1, 1]) { K.box(0.06, 0.14, D + 2.1, t > 0 ? CY : '#ffffff', s * (W / 2 + 1.03), 5.6 + t * 0.18, 0, 0, { em: t > 0 ? 1 : 0.6 }); K.box(W + 2.1, 0.14, 0.06, s > 0 ? CY : '#ffffff', 0, 5.6 + s * 0.18, t * (D / 2 + 1.03), 0, { em: s > 0 ? 1 : 0.6 });
        K.box(0.9, 0.9, 0.9, CY, s * (W / 2 + 0.2), 6.75, t * (D / 2 + 0.2), 0, { rx: Math.PI / 4, rz: 0.6155, em: 1.4 }); K.box(0.1, 0.5, 0.1, DARK, s * (W / 2 + 0.2), 6.05, t * (D / 2 + 0.2));
        if (t > 0) speakers(K, s * (W / 2 + 0.6), 4.0, D / 2 + 0.05, Math.atan2(-s, -1), 1); }
      K.rail([[s * (W / 2 + 0.92), 0.35, -D / 2 - 0.9], [s * (W / 2 + 0.92), 0.35, D / 2 + 0.92]], STEEL, { bars: 0.3 });
      K.box(0.5, 0.03, D + 2, PLATE, s * (W / 2 + 0.75), 0.365, 0, 0, { k: 't' }); K.box(W + 1, 0.03, 0.5, PLATE, 0, 0.365, s * (D / 2 + 0.75), 0, { k: 't' });
      K.box(0.06, 0.14, D, RUB, s * (W / 2 + 0.08), 0.52, 0); K.box(W, 0.14, 0.06, RUB, 0, 0.52, s * (D / 2 + 0.08)); }
    for (const x of [-W / 2 - 0.6, -5.8, 0, 5.8, W / 2 + 0.6]) for (const z of [-D / 2 - 0.6, D / 2 + 0.6]) { K.box(0.5, 0.5, 0.5, NV, x, 0.6, z); K.box(0.46, 0.3, 0.46, NV, x, 5.2, z); }
    for (const x of [-6, -2, 2, 6]) { K.box(0.12, 2.0, 0.12, DARK, x, 6.85, D / 2 + 0.98); K.bar([x, 7.6, D / 2 + 0.98], [x, 5.9, D / 2 - 0.5], 0.08, DARK); }
    for (const [x0, x1] of [[-W / 2 - 0.92, -7], [-4.4, 5.4], [7.6, W / 2 + 0.92]]) K.rail([[x0, 0.35, D / 2 + 0.92], [x1, 0.35, D / 2 + 0.92]], STEEL, { bars: 0.3 });
    gate(K, -5.7, 0.35, D / 2 + 0.92, 0, 2.4, '#39d353'); gate(K, 6.5, 0.35, D / 2 + 0.92, 0, 2.0, '#ff3b30');
    K.box(2.0, 0.8, 1.2, STEEL, -6, 6.25, -3); K.box(1.8, 0.05, 1.0, DARK, -6, 6.67, -3); K.box(0.3, 0.2, 6, STEEL, -6, 5.95, 0.6);
    K.flush(this.B, this);
    this.cars = []; const cols = ['#e63946', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#ff006e', '#fb5607', '#ffffff', '#00b4d8', '#9ef01a'];
    for (let i = 0; i < 10; i++) { const c = makeBumper(cols[i]); c.position.set(R(-W / 2 + 2, W / 2 - 2), 0.4, R(-D / 2 + 2, D / 2 - 2)); this.g.add(c); const seat = new THREE.Object3D(); seat.position.set(0, 0.25, 0.15); c.add(seat);
      this.cars.push({ m: c, x: c.position.x, z: c.position.z, a: R(0, 6.28), v: R(1.5, 3), vx: 0, vz: 0, seat, ai: true, turn: 0 }); this.seats.push(seat); }
    fillRiders(this.seats.slice(1), 0.85);
    this.booth(9, D / 2 + 2.2, 0, '#4cc9f0');
    // Rand-Kollision (Zugang nur über Kasse/Fahrmodus)
    G.fairBox(cfg.u, cfg.v, W / 2 + 1, D / 2 + 1, 0, 'scooter');
    this.G.glow.paint(cfg.u, cfg.v, '#4cc9f0', 14, 0.5);
    this.finish(); this.runT = 75; this.bumps = 0;
  }
  update(dt) {
    const W = this.W / 2 - 0.9, D = this.D / 2 - 0.9;
    for (const c of this.cars) {
      if (c.ai) { c.turn += (R(-1, 1) * 2 - c.turn) * dt; c.a += c.turn * dt * 1.4; const tv = 2.6; c.vx += (Math.sin(c.a) * tv - c.vx) * dt * 1.5; c.vz += (Math.cos(c.a) * tv - c.vz) * dt * 1.5; }
      c.x += c.vx * dt; c.z += c.vz * dt;
      if (c.x < -W || c.x > W) { c.x = clamp(c.x, -W, W); c.vx *= -0.6; c.a = Math.atan2(c.vx, c.vz); if (!c.ai) this.hit(Math.abs(c.vx), true); }
      if (c.z < -D || c.z > D) { c.z = clamp(c.z, -D, D); c.vz *= -0.6; c.a = Math.atan2(c.vx, c.vz); if (!c.ai) this.hit(Math.abs(c.vz), true); }
    }
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j]; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.9 && d > 0.001) { const nx = dx / d, nz = dz / d, ov = 1.9 - d; a.x -= nx * ov / 2; a.z -= nz * ov / 2; b.x += nx * ov / 2; b.z += nz * ov / 2;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rel < 0) { const imp = -rel * 0.9; a.vx -= nx * imp; a.vz -= nz * imp; b.vx += nx * imp; b.vz += nz * imp; if (a.ai) a.a = Math.atan2(a.vx, a.vz); if (b.ai) b.a = Math.atan2(b.vx, b.vz);
          if (!a.ai || !b.ai) this.hit(imp, false); } }
    }
    for (const c of this.cars) { c.m.position.x = c.x; c.m.position.z = c.z; if (c.ai) c.m.rotation.y = c.a; else c.m.rotation.y = c.heading; }
    if (this.player) { this.t += dt; if (this.t > this.runT) this.G.player.unboard(this); }
  }
  hit(imp, wall) { if (imp > 1.2) { this.G.audio?.bump(Math.min(1, imp / 5)); this.G.player.shake = Math.min(0.6, imp * 0.08); if (!wall && imp > 1.6) { this.bumps++; this.G.emit('bump', this.bumps); } } }
  board() { this.player = true; this.t = 0; this.bumps = 0; const c = this.cars[0]; c.ai = false; c.heading = c.a; this.pc = c; c.m.children.forEach(ch => { if (ch.geometry?.type === 'CylinderGeometry' && ch.position.y > 2) ch.visible = false; }); if (c.seat.userData.rider) { c.seat.remove(c.seat.userData.rider); c.seat.userData.rider = null; } return c.seat; }
  drive(dt, fwd, steer) { const c = this.pc; if (!c) return; c.heading += steer * dt * 2.4 * (0.4 + Math.min(1, Math.hypot(c.vx, c.vz) / 3)); const acc = fwd * 7; c.vx += Math.sin(c.heading) * acc * dt; c.vz += Math.cos(c.heading) * acc * dt; c.vx *= (1 - dt * 1.4); c.vz *= (1 - dt * 1.4); }
  release() { if (this.pc) { this.pc.ai = true; this.pc.a = this.pc.heading; this.pc.m.children.forEach(ch => ch.visible = true); } this.pc = null; this.player = null; }
}
function makeBumper(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.35, 16), M('#222')); base.position.y = 0.15; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.7), M(color, { metalness: 0.5, roughness: 0.25 })); body.position.y = 0.55; g.add(body);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.25), M(color, { metalness: 0.5, roughness: 0.25 })); back.position.set(0, 0.95, -0.75); g.add(back);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 4), M('#999', { metalness: 0.9 })); pole.position.set(0, 2.9, -0.8); g.add(pole);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), Glow('#9be7ff', 4)); spark.position.set(0, 5.05, -0.8); g.add(spark);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12), M('#111')); wheel.position.set(0, 1.0, 0.35); wheel.rotation.x = -0.9; g.add(wheel);
  return g;
}

// =============================================================
// Geeschterbunn – dunkle Fahrt durchs Spukschlass
class Ghost extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.cam = 'first'; this.runT = 40;
    const W = 20, D = 12, H = 8; this.W = W; this.D = D;
    const fac = canvasTex(1024, 410, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120024'); gr.addColorStop(1, '#3c096c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b0033'; for (let i = 0; i < 7; i++) { const x = 60 + i * 150; g.fillRect(x, 120, 70, h); g.beginPath(); g.moveTo(x - 10, 120); g.lineTo(x + 35, 30); g.lineTo(x + 80, 120); g.fill(); }
      g.fillStyle = '#f9f871'; g.beginPath(); g.arc(880, 70, 45, 0, 7); g.fill();
      g.font = '120px Creepster, Bungee, Impact'; g.textAlign = 'center'; g.fillStyle = '#7CFC00'; g.shadowColor = '#7CFC00'; g.shadowBlur = 25; g.fillText('GEESCHTERBUNN', w / 2, 230);
      for (let i = 0; i < 6; i++) { const x = 120 + i * 160; g.fillStyle = '#f1faee'; g.beginPath(); g.arc(x, 330, 30, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(x - 10, 325, 8, 0, 7); g.arc(x + 10, 325, 8, 0, 7); g.fill(); }
    });
    const facMat = new THREE.MeshStandardMaterial({ map: fac, emissiveMap: fac, emissive: '#ffffff', emissiveIntensity: 0.45 });
    // Außenhülle mit zwei Türöffnungen in der Front (-z)
    const wallM = M('#2b0a3d');
    this.B.add(new THREE.BoxGeometry(W, H, 0.3), wallM, 0, H / 2, D / 2);
    this.B.add(new THREE.BoxGeometry(0.3, H, D), wallM, -W / 2, H / 2, 0); this.B.add(new THREE.BoxGeometry(0.3, H, D), wallM, W / 2, H / 2, 0);
    this.B.add(new THREE.BoxGeometry(W, 0.3, D), wallM, 0, H, 0);
    for (const [x0, x1] of [[-W / 2, -6], [-3, 3], [6, W / 2]]) this.B.add(new THREE.BoxGeometry(x1 - x0, H, 0.3), wallM, (x0 + x1) / 2, H / 2, -D / 2);
    this.B.add(new THREE.BoxGeometry(W, H - 3, 0.3), wallM, 0, 3 + (H - 3) / 2, -D / 2);
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(W, H), facMat); facade.position.set(0, H / 2, -D / 2 - 0.17); facade.rotation.y = Math.PI; this.g.add(facade);
    // Innen (unbeleuchtet, dunkel)
    const inner = new THREE.MeshBasicMaterial({ color: '#0d0612', side: THREE.BackSide }); const ib = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, H - 0.5, D - 0.7), inner); ib.position.y = H / 2 - 0.1; this.g.add(ib);
    // Dachfigur: riesiger Geist
    const ghostMat = M('#f1faee', { emissive: '#b8f2e6', emissiveIntensity: 0.5 });
    this.B.add(new THREE.ConeGeometry(2.2, 5, 16, 1, true), ghostMat, 0, H + 2.6, 1); this.B.add(new THREE.SphereGeometry(1.6, 16, 10), ghostMat, 0, H + 5, 1);
    this.B.add(new THREE.SphereGeometry(0.3, 8, 6), Glow('#ff0000', 4), -0.55, H + 5.2, -0.4); this.B.add(new THREE.SphereGeometry(0.3, 8, 6), Glow('#ff0000', 4), 0.55, H + 5.2, -0.4);
    this.bulbs.line([-W / 2, H + 0.2, -D / 2 - 0.3], [W / 2, H + 0.2, -D / 2 - 0.3], 0.4, '#7CFC00', 3, 3); this.bulbs.line([-W / 2, 0.3, -D / 2 - 0.3], [W / 2, 0.3, -D / 2 - 0.3], 0.4, '#9d4edd', 1, 3);
    // --- Details (flaches Relief, damit nichts über die Grundfläche ragt): Tunnelmäuler mit Portalen, Eckpfeiler, Gesims, Zinnen, Ecktürme, Strebepfeiler, Leuchtfenster, Dachgeräte
    const K = new Det(), ST = '#4a3a5c', ST2 = '#372a47', OG = '#ff9f1c', zf = -D / 2 - 0.3;
    for (const x of [-4.5, 4.5]) { K.box(3.0, 3.0, 0.04, '#050308', x, 1.5, -D / 2 - 0.2); for (const s of [-1, 1]) K.box(0.4, 3.4, 0.3, ST, x + s * 1.7, 1.7, zf); K.box(4.2, 0.45, 0.34, ST, x, 3.45, zf); K.box(0.9, 0.75, 0.32, ST2, x, 3.95, zf); K.box(2.8, 0.1, 0.03, '#7CFC00', x, 3.14, zf - 0.16, 0, { em: 2 }); }
    for (const s of [-1, 1]) { K.box(0.7, H, 0.3, ST, s * (W / 2 - 0.2), H / 2, zf);
      K.cyl(1.2, 3.4, ST, s * 8.6, H + 1.85, -4.6, 8, { cap: true, ry: Math.PI / 8 }); K.cyl(1.5, 2.4, '#1b0033', s * 8.6, H + 4.75, -4.6, 8, { r2: 0, cap: true, ry: Math.PI / 8 }); K.box(0.4, 0.9, 0.05, OG, s * 8.6, H + 2.2, -5.73, 0, { em: 1.6 });
      for (const z of [-4, 0, 4]) K.box(0.5, 6.5, 0.8, ST, s * (W / 2 + 0.4), 3.25, z);
      for (const z of [-2, 2]) { K.box(0.05, 1.8, 0.9, OG, s * (W / 2 + 0.18), 4.2, z, 0, { em: 1.1 }); K.box(0.07, 1.8, 0.08, '#120018', s * (W / 2 + 0.2), 4.2, z); K.box(0.07, 0.08, 0.9, '#120018', s * (W / 2 + 0.2), 4.5, z); K.box(0.1, 0.12, 1.1, ST, s * (W / 2 + 0.2), 3.24, z); }
      K.box(1.6, 0.9, 1.0, STEEL, s * 5, H + 0.6, 4.4); K.box(1.4, 0.05, 0.8, DARK, s * 5, H + 1.07, 4.4); }
    K.box(W + 0.6, 0.4, 0.36, ST, 0, H - 0.15, zf); K.box(W + 0.4, 0.2, 0.1, ST, 0, 0.1, -D / 2 - 0.22);
    for (let i = 0; i < 13; i++) K.box(0.8, 0.9, 0.5, i % 2 ? ST2 : ST, -9.6 + i * 1.6, H + 0.6, -D / 2 + 0.3);
    for (const x of [-7, 0, 7]) K.box(0.8, 6.5, 0.3, ST, x, 3.25, D / 2 + 0.3);
    K.flush(this.B, this);
    // Strecke
    const P = [[-8, 0, -8.5], [-4.5, 0, -8.5], [-4.5, 0, -4], [-7.5, 0, -1], [-7.5, 0, 3], [-3, 0, 4], [0, 0, 0], [3, 0, 4], [7.5, 0, 3], [7.5, 0, -1], [4.5, 0, -4], [4.5, 0, -8.5], [0, 0, -9.5]];
    this.curve = new THREE.CatmullRomCurve3(P.map(p => new THREE.Vector3(...p)), true); this.len = this.curve.getLength();
    this.B.add(new THREE.TubeGeometry(this.curve, 160, 0.06, 4, true), M('#888', { metalness: 0.8 }), 0, 0.15, 0);
    this.car = new THREE.Group(); this.g.add(this.car);
    const cb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), M('#6a040f', { metalness: 0.4 })); cb.position.y = 0.45; this.car.add(cb);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), M('#f1faee')); skull.position.set(0, 0.9, -1.0); this.car.add(skull);
    const seat = new THREE.Object3D(); seat.position.set(0, 0.35, 0.1); this.car.add(seat); this.seats.push(seat);
    // Schreck-Objekte (versteckt, springen auf)
    this.scares = [];
    const addScare = (obj, x, z, trigger) => { obj.position.set(x, -3, z); obj.userData.y0 = obj.position.y; this.g.add(obj); this.scares.push({ o: obj, x, z, t: trigger, up: 0 }); };
    const ghostObj = () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 12, 1, true), Glow('#e0fbfc', 0.9)); c.position.y = 1.1; g.add(c); const h = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), Glow('#e0fbfc', 0.9)); h.position.y = 2.3; g.add(h); for (const x of [-0.2, 0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), Glow('#000000', 0)); e.position.set(x, 2.35, 0.52); g.add(e); } return g; };
    const skel = () => { const g = new THREE.Group(); const bone = Glow('#fefae0', 1.1); const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.2), bone); t.position.y = 1.4; g.add(t); const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bone); h.position.y = 2.1; g.add(h); for (const x of [-0.45, 0.45]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), bone); a.position.set(x, 1.5, 0.2); a.rotation.x = -1; g.add(a); } for (const x of [-0.15, 0.15]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), bone); l.position.set(x, 0.5, 0); g.add(l); } for (const x of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), Glow('#ff0000', 5)); e.position.set(x, 2.15, 0.27); g.add(e); } return g; };
    const spider = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), M('#111')); b.position.y = 2.5; g.add(b); for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), M('#111')); l.position.set(Math.cos(i) * 0.8, 2.4, Math.sin(i) * 0.8); l.rotation.y = -i; l.rotation.z = 0.5; g.add(l); } for (const x of [-0.2, 0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), Glow('#ff2200', 5)); e.position.set(x, 2.6, 0.62); g.add(e); } return g; };
    addScare(ghostObj(), -6, -2.5, 0.2); addScare(skel(), -5.6, 4.6, 0.33); addScare(spider(), 0, 2, 0.46); addScare(ghostObj(), 5.8, 4.8, 0.6); addScare(skel(), 6, -2, 0.74);
    this.flicker = new THREE.PointLight('#7CFC00', 0, 12, 1.5); this.flicker.position.set(0, 5, 0); this.g.add(this.flicker);
    this.booth(-9, -9.6, Math.PI, '#7CFC00');
    // Kollision: Gebäude
    G.fairBox(cfg.u, cfg.v, W / 2, D / 2, 0, 'ghost');
    this.G.glow.paint(cfg.u, cfg.v - D / 2 - 2, '#9d4edd', 10, 0.6);
    this.finish(); this.s = 0;
  }
  update(dt) {
    const p = this.cycle(dt); const sp = this.phase === 'run' ? 1 : 0; this.s = this.phase === 'run' ? p : 0;
    const u = (this.s + 0.0) % 1; const pt = this.curve.getPointAt(u), tg = this.curve.getTangentAt(u);
    this.car.position.copy(pt); this.car.rotation.y = Math.atan2(-tg.x, -tg.z);
    for (const sc of this.scares) { const near = sp && Math.abs(u - sc.t) < 0.06; sc.up += ((near ? 1 : 0) - sc.up) * dt * (near ? 12 : 3); sc.o.position.y = -3 + sc.up * 3; if (near) sc.o.rotation.y = Math.atan2(pt.x - sc.x, pt.z - sc.z); if (near && !sc.done && this.player) { sc.done = true; this.G.audio?.boo(); this.G.player.shake = 0.5; } if (!sp) sc.done = false; }
    this.flicker.intensity = this.player && sp ? (rand() < 0.15 ? 40 : 3) : 0;
    this.inside = this.player && sp && Math.abs(pt.z) < this.D / 2 - 0.3;
  }
}

// =============================================================
// Cinéma 5D – VR-Achterbahn (Neon-Welt)
class VR extends Ride {
  constructor(G, id, cfg) {
    super(G, id, cfg); this.cam = 'vr';
    this.B.add(new THREE.BoxGeometry(9, 5, 8), M('#10002b'), 0, 2.5, 0);
    this.B.add(new THREE.SphereGeometry(4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#240046', { metalness: 0.6, roughness: 0.3 }), 0, 5, 0);
    this.sign('CINÉMA 5D', 7, 1.6, 0, 3.6, 4.05, 0, { fg: '#00f5d4', border: '#f15bb5', bg: '#10002b' });
    this.bulbs.circle(0, 5.05, 0, 4.05, 60, i => i % 2 ? '#00f5d4' : '#f15bb5', 1, 'xz', 3);
    // --- Details: Neon-Ecken, Eingang mit Vordach, Leuchtplakate, Paneel-Fugen, Kuppelrippen, Klimagerät, Aggregat
    const K = new Det(), CY = '#00f5d4', PK = '#f15bb5', VI = '#240046';
    K.box(9.2, 0.25, 8.2, DARK, 0, 0.125, 0);
    for (const sx of [-1, 1]) { for (const sz of [-1, 1]) { K.box(0.3, 5, 0.3, VI, sx * 4.45, 2.5, sz * 3.95); K.box(0.06, 4.5, 0.06, sx * sz > 0 ? CY : PK, sx * 4.62, 2.55, sz * 4.12, 0, { em: 1.8 }); }
      for (const z of [-2.67, -1.33, 0, 1.33, 2.67]) K.box(0.05, 4.6, 0.06, '#3c1a6e', sx * 4.52, 2.5, z); K.box(0.04, 0.08, 7.6, PK, sx * 4.53, 4.6, 0, 0, { em: 1.6 });
      K.box(0.12, 2.4, 0.12, CY, -2.4 + sx * 0.9, 1.2, 4.06, 0, { em: 1.2 }); }
    K.box(1.7, 2.3, 0.05, '#050308', -2.4, 1.15, 4.03); K.box(1.92, 0.12, 0.12, CY, -2.4, 2.4, 4.06, 0, { em: 1.2 }); K.box(2.6, 0.1, 0.55, VI, -2.4, 2.62, 4.3); K.box(2.6, 0.06, 0.04, PK, -2.4, 2.6, 4.58, 0, { em: 2 });
    K.box(2.0, 0.15, 0.4, PLATE, -2.4, 0.075, 4.25);
    for (const [x, c] of [[-0.35, '#7b2cbf'], [1.2, '#3a86ff']]) { K.box(1.3, 1.9, 0.06, DARK, x, 1.45, 4.03); K.box(1.14, 1.74, 0.03, c, x, 1.45, 4.07, 0, { em: 0.9 }); K.box(0.7, 0.7, 0.02, PK, x, 1.6, 4.09, 0, { rz: Math.PI / 4, em: 1.4 }); }
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; for (let j = 0; j < 5; j++) { const f0 = j * Math.PI / 10, f1 = (j + 1) * Math.PI / 10;
      K.tube([Math.cos(a) * Math.cos(f0) * 4.04, 5 + Math.sin(f0) * 4.04, Math.sin(a) * Math.cos(f0) * 4.04], [Math.cos(a) * Math.cos(f1) * 4.04, 5 + Math.sin(f1) * 4.04, Math.sin(a) * Math.cos(f1) * 4.04], 0.05, k % 2 ? CY : PK, 4, { em: 0.9 }); } }
    K.cyl(0.1, 1.2, STEEL, 0, 9.6, 0, 6); K.box(0.3, 0.3, 0.3, PK, 0, 10.3, 0, 0, { em: 3 });
    K.box(0.4, 0.7, 1.0, STEEL, -4.72, 3.2, -1.5); K.box(0.03, 0.5, 0.8, DARK, -4.93, 3.2, -1.5);
    genset(K, 1.5, 0, -4.6, Math.PI); cable(K, [0.2, -4.6], [-1.6, -4.15]);
    K.flush(this.B, this);
    const s = new THREE.Object3D(); s.position.set(0, 0.5, 0); this.g.add(s); this.seats.push(s);
    this.booth(3, 5.3, 0, '#00f5d4');
    G.fairBox(cfg.u, cfg.v, 4.5, 4, 0, 'vr'); this.G.glow.paint(cfg.u, cfg.v + 5, '#00f5d4', 8, 0.6);
    this.finish(); this.runT = 45;
  }
  update(dt) { if (this.player) { this.t += dt; if (this.t > this.runT) this.G.player.unboard(this); } }
  board() { this.player = true; this.t = 0; return this.seats[0]; }
}

// =============================================================
// Kulissen-Attraktionen mit echten Namen aus dem Lageplan (ebenfalls fahrbar)
class Generic extends Ride {
  constructor(G, id, cfg) {
    super(G, id, { ...cfg, price: cfg.price || 6 }); this.style = cfg.style; this.cam = 'third'; this.runT = 40;
    const col = pick(['#ff006e', '#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0', '#fb5607', '#00f5d4']); const col2 = pick(['#ffffff', '#ffd166', '#4cc9f0']);
    this.col = col; const big = !cfg.small; const front = cfg.v > 0 ? -1 : 1; // Front zur Mittelallee
    this.front = front;
    const K = new Det(), PI = Math.PI;   // Detail-Sammler (siehe Baukasten oben)
    if (this.style === 'spinner' || this.style === 'tagada' || this.style === 'drum') {
      const r = big ? 6.5 : 4.6; this.r = r;
      this.B.add(new THREE.CylinderGeometry(r + 0.4, r + 0.6, 0.5, 32), pbr('metal', { tile: 1.5, color: '#8f8fb0', metalness: 0.6 }), 0, 0.25, 0);
      this.bulbs.circle(0, 0.55, 0, r + 0.45, 70, i => i % 2 ? col : col2, 1, 'xz', 3);
      this.rot = new THREE.Group(); this.rot.position.y = 0.6; this.g.add(this.rot);
      const RB = new Batcher(), rb = new Bulbs();
      if (this.style === 'drum') { RB.add(new THREE.CylinderGeometry(r - 0.6, r - 0.6, 4.5, 28, 1, true), M(col, { side: THREE.DoubleSide, metalness: 0.4 }), 0, 2.3, 0); rb.circle(0, 4.6, 0, r - 0.55, 60, col2, 1, 'xz', 3); rb.circle(0, 0.2, 0, r - 0.55, 60, col2, 2, 'xz', 3);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const s = new THREE.Object3D(); s.position.set(Math.cos(a) * (r - 1.1), 1.2, Math.sin(a) * (r - 1.1)); s.rotation.y = -a + Math.PI / 2; this.rot.add(s); this.seats.push(s); } }
      else if (this.style === 'tagada') { RB.add(new THREE.CylinderGeometry(r, r - 0.5, 0.8, 32), M(col, { metalness: 0.4 }), 0, 0.4, 0); RB.add(new THREE.TorusGeometry(r - 0.4, 0.35, 8, 32), M(col2), 0, 1.1, 0, Math.PI / 2); rb.circle(0, 1.5, 0, r - 0.4, 60, col2, 1, 'xz', 3);
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const s = new THREE.Object3D(); s.position.set(Math.cos(a) * (r - 1), 0.9, Math.sin(a) * (r - 1)); s.rotation.y = -a - Math.PI / 2; this.rot.add(s); this.seats.push(s); } }
      else { RB.add(new THREE.CylinderGeometry(1, 1.2, 3, 12), M(col2, { metalness: 0.5 }), 0, 1.5, 0);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; RB.add(new THREE.BoxGeometry(r - 1, 0.3, 0.4), M(col, { metalness: 0.5 }), Math.cos(a) * (r - 1) / 2, 2.6, -Math.sin(a) * (r - 1) / 2, 0, a);
          RB.add(new THREE.CylinderGeometry(1.1, 0.9, 0.9, 12), M(i % 2 ? col : col2, { metalness: 0.4 }), Math.cos(a) * (r - 1.2), 2.2, -Math.sin(a) * (r - 1.2));
          rb.line([0, 2.8, 0], [Math.cos(a) * (r - 1), 2.8, -Math.sin(a) * (r - 1)], 0.4, col2, 1, 3);
          const s = new THREE.Object3D(); s.position.set(Math.cos(a) * (r - 1.2), 2.3, -Math.sin(a) * (r - 1.2)); this.rot.add(s); this.seats.push(s); } }
      RB.build(this.rot); rb.build(this.rot);
      G.fairCircle(cfg.u, cfg.v, r + 0.5, 'ride');
      this.sign(cfg.name.toUpperCase(), Math.min(10, r * 1.6), 1.3, 0, 5.8, front * (r + 0.7), front > 0 ? 0 : Math.PI, { fg: col2, border: col });
      for (const x of [-r * 0.8, r * 0.8]) this.B.add(new THREE.CylinderGeometry(0.1, 0.1, 6.4, 6), M('#888', { metalness: 0.8 }), x, 3.2, front * (r + 0.6));
      // --- Details: Rundgeländer mit Toren, Stufe, Kulisse im Bogen (einseitig) mit Bedienfenster, Lautsprecher, Schild-Fachwerk
      { const fa = front * PI / 2, rr = r + 0.35, e = front * 0.62, HB = this.style === 'drum' ? 6 : this.style === 'spinner' ? 5.4 : 5, rm = r + 0.45, hw = rm * Math.tan(PI / 12), zs = front * (r + 0.6), xs = r * 0.8;
        const parts = e > 0 ? [[-1.833, -0.2], [0.2, e - 0.13], [e + 0.13, 1.833]] : [[-1.833, e - 0.13], [e + 0.13, -0.2], [0.2, 1.833]];
        K.ring(rr, 0.5, parts.map(([a, b]) => [fa + a, fa + b]), STEEL, { bars: 0.3 });
        if (this.style !== 'drum') { const ax = fa + e; gate(K, 0, 0.5, front * rr, front > 0 ? 0 : PI, 2.4, '#39d353'); gate(K, Math.cos(ax) * rr, 0.5, Math.sin(ax) * rr, Math.atan2(Math.cos(ax), Math.sin(ax)), 1.5, '#ff3b30'); }
        K.box(2.6, 0.25, 0.4, PLATE, 0, 0.125, front * (r + 0.82));
        for (let i = 0; i < 5; i++) { const a = -fa - 1.309 + (i + 0.5) * 0.5236, cx = Math.cos(a) * rm, cz = Math.sin(a) * rm; K.at(cx, 0.3, cz, faceIn(a)); this.bulbs.at(cx, 0.3, cz, faceIn(a));
          backdrop(this, K, -hw, hw, 0, 1, 0, HB + 0.2, [col, '#1b1b2f'], { pw: 4, i0: i, acc: col2, bulb: col2, lamp: i !== 2 });
          if (i === 2) { K.panel(2.7, 1.5, DARK, 0, 2.5, 0.05); K.panel(2.3, 1.0, GLASS, 0, 2.5, 0.07, 0, { em: 0.6 }); K.panel(0.06, 1.0, DARK, 0, 2.5, 0.08); K.panel(2.7, 0.14, col2, 0, 3.32, 0.08, 0, { em: 0.5 });
            for (const t of [-1, 1]) K.panel(0.12, 0.12, t > 0 ? '#39ff14' : '#ff3b30', t * 0.5, 1.88, 0.08, 0, { em: 2.5 }); } }
        K.at(null); this.bulbs.at(null);
        for (const t of [-1, 1]) { const a = -fa + t * 1.19; speakers(K, Math.cos(a) * (rm - 0.32), HB - 1.0, Math.sin(a) * (rm - 0.32), faceIn(a), 1);
          footPad(K, t * xs, zs, 0, 0.7); K.bar([-xs, 5.8 + t * 0.7, zs], [xs, 5.8 + t * 0.7, zs], 0.07, '#888888'); }
        for (let k = 0; k < 8; k++) K.bar([-xs + k * xs / 4, k % 2 ? 6.5 : 5.1, zs], [-xs + (k + 1) * xs / 4, k % 2 ? 5.1 : 6.5, zs], 0.05, '#888888'); }
      this.booth(r * 0.75, front * (r + 0.4), front > 0 ? 0 : Math.PI, col2);
    } else if (this.style === 'tower') {
      const H = big ? 30 : 22; this.H = H;
      this.B.add(new THREE.CylinderGeometry(5.5, 5.8, 0.5, 28), M('#22223b'), 0, 0.25, 0);
      this.B.add(new THREE.BoxGeometry(1.6, H, 1.6), M(col2, { metalness: 0.5 }), 0, H / 2, 0);
      this.bulbs.line([0.85, 1, 0.85], [0.85, H, 0.85], 0.6, col, 1, 3); this.bulbs.line([-0.85, 1, -0.85], [-0.85, H, -0.85], 0.6, col, 1, 3);
      this.rot = new THREE.Group(); this.rot.position.set(0, H, front * 1.2); this.g.add(this.rot);
      const RB = new Batcher(), rb = new Bulbs(); RB.add(new THREE.BoxGeometry(1, H * 0.9 * 2, 0.6), M(col, { metalness: 0.4 }), 0, 0, 0);
      rb.line([0, -H * 0.9, 0.35], [0, H * 0.9, 0.35], 0.5, i => i % 2 ? col2 : '#ffffff', 1, 3);
      for (const sgn of [-1, 1]) { const end = new THREE.Group(); end.position.y = sgn * H * 0.88; this.rot.add(end); RB.add(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 14), M(col2), 0, sgn * H * 0.88, front * 0.9, Math.PI / 2);
        for (let i = 0; i < 4; i++) { const s = new THREE.Object3D(); s.position.set(-1.2 + i * 0.8, sgn * H * 0.88, front * 1.6); s.rotation.y = front > 0 ? Math.PI : 0; this.rot.add(s); this.seats.push(s); } }
      RB.build(this.rot); rb.build(this.rot);
      G.fairCircle(cfg.u, cfg.v, 2, 'ride');
      this.sign(cfg.name.toUpperCase(), 7, 1.4, 0, 4.2, front * 1.0, front > 0 ? 0 : Math.PI, { fg: col2, border: col });
      // --- Details: Rundgeländer mit Toren und Stufen, Turm-Flansche, Kreuzverbände, Abspannstreben, Maschinenhaus, Leiter, Bedienkabine, Aggregat
      { const fa = front * PI / 2, GR = '#8d99ae';
        K.ring(5.35, 0.5, [[fa - 0.19, fa + 0.19], [fa + 0.49, fa + PI * 2 - 0.49]], STEEL, { bars: 0.3 });
        for (const [da, c] of [[-0.34, '#39d353'], [0.34, '#ff3b30']]) { const a = fa + da, ry = Math.atan2(Math.cos(a), Math.sin(a)); gate(K, Math.cos(a) * 5.35, 0.5, Math.sin(a) * 5.35, ry, 1.4, c);
          K.at(Math.cos(a) * 5.75, 0, Math.sin(a) * 5.75, ry).box(1.5, 0.25, 0.38, PLATE, 0, 0.125, 0.2); K.at(null); }
        for (let y = 5; y < H; y += 5) { K.box(1.76, 0.14, 1.68, GR, 0, y, -front * 0.04);
          for (const s of [-1, 1]) { K.bar([s * 0.83, y - 5, -0.75], [s * 0.83, y, 0.75], 0.06, GR); K.bar([s * 0.83, y - 5, 0.75], [s * 0.83, y, -0.75], 0.06, GR); K.bar([-s * 0.75, y - 5, -front * 0.83], [s * 0.75, y, -front * 0.83], 0.06, GR); } }
        for (const s of [-1, 1]) { K.tube([s * 0.7, H * 0.45, -front * 0.8], [s * 2.6, 0.6, -front * 4.1], 0.13, GR, 6); footPad(K, s * 2.6, -front * 4.1, 0.5, 0.8); K.box(0.04, H - 2, 0.04, STEEL, s * 0.2, H / 2, -front * 0.92); }
        for (let y = 1.5; y < H - 1; y += 1) K.box(0.4, 0.03, 0.03, STEEL, 0, y, -front * 0.92);
        K.box(2.0, 2.2, 1.5, '#2b2d42', 0, H + 0.3, -front * 0.15); K.box(2.04, 0.3, 1.54, YEL, 0, H - 0.5, -front * 0.15); K.box(0.25, 0.25, 0.25, '#ff2a2a', 0, H + 1.55, -front * 0.15, 0, { em: 4 });
        opCabin(K, -3.4, 0.5, -front * 1.6, front > 0 ? 0 : PI, '#22223b', col, 2.2, 1.7);
        genset(K, 3.2, 0.5, -front * 1.2, PI / 2); cable(K, [2.6, -front * 1.2], [0.9, -front * 0.9], 0.54); }
      this.booth(3.8, front * 4.6, front > 0 ? 0 : Math.PI, col2);
    } else { // show: Fassade (Lachkabinett / Party-Halle / Wasserbahn)
      const hu = big ? 8.5 : 4.6, hv = 5.5, H = 7;
      const fac = canvasTex(1024, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, col); gr.addColorStop(1, '#10002b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) { g.fillStyle = `hsla(${Math.random() * 360},90%,60%,0.6)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 40 + 8, 0, 7); g.fill(); }
        g.font = '110px Bungee, Impact'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = col2; g.shadowBlur = 30; let s = 110; while (g.measureText(cfg.name.toUpperCase()).width > w * 0.9) { s -= 6; g.font = `${s}px Bungee, Impact`; } g.fillText(cfg.name.toUpperCase(), w / 2, h * 0.42); });
      const fm = new THREE.MeshStandardMaterial({ map: fac, emissiveMap: fac, emissive: '#ffffff', emissiveIntensity: 0.32 });
      this.B.add(new THREE.BoxGeometry(hu * 2, H, hv * 2), M('#1b1b2f'), 0, H / 2, 0);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(hu * 2, H), fm); f.position.set(0, H / 2, front * (hv + 0.02)); f.rotation.y = front > 0 ? 0 : Math.PI; this.g.add(f);
      this.bulbs.line([-hu, H, front * (hv + 0.1)], [hu, H, front * (hv + 0.1)], 0.35, i => i % 2 ? col2 : '#ffffff', 1, 3);
      this.bulbs.line([-hu, 0.3, front * (hv + 0.1)], [hu, 0.3, front * (hv + 0.1)], 0.35, col2, 3, 3);
      if (cfg.name === 'Big Splash') { this.B.add(new THREE.BoxGeometry(3, 0.6, 14), M('#00b4d8', { metalness: 0.3 }), 0, H + 3, 0, -0.5); this.B.add(new THREE.BoxGeometry(2.4, 0.2, 13), Glow('#90e0ef', 0.8), 0, H + 3.3, 0, -0.5); }
      if (cfg.name === 'Après-Ski Party') { this.B.add(new THREE.ConeGeometry(3, 3, 4), M('#ffffff'), -hu + 3, H + 1.5, 0, 0, Math.PI / 4); this.B.add(new THREE.ConeGeometry(2.4, 2.5, 4), M('#ffffff'), hu - 3, H + 1.2, 0, 0, Math.PI / 4); }
      G.fairBox(cfg.u, cfg.v, hu, hv, 0, 'show');
      // --- Details (flaches Relief): Eckpilaster mit Neon, Attika, Dach-Pylone, Eingang/Ausgang mit Leuchtkasten und Vordach, Paneel-Fugen, Sockel, Notausgang, Klimagerät
      { const TR = '#22223b', SM = '#2c2c48', gap = cfg.name === 'Big Splash' ? 1.9 : 0, zf = front * hv;
        K.box(hu * 2 + 0.12, 0.3, hv * 2 + 0.12, '#101018', 0, 0.15, 0); K.box(hu * 2 + 0.1, 0.12, hv * 2 + 0.1, TR, 0, H + 0.06, 0);
        for (const s of [-1, 1]) { K.box(0.5, H + 0.5, 0.34, TR, s * (hu - 0.2), (H + 0.5) / 2, zf + front * 0.05); K.box(0.08, H - 0.6, 0.04, col2, s * (hu - 0.2), H / 2, zf + front * 0.24, 0, { em: 1.6 });
          K.box(hu - gap + 0.15, 0.5, 0.3, TR, s * (hu + gap + 0.15) / 2, H + 0.25, zf - front * 0.2);
          K.box(0.9, 1.7, 0.9, TR, s * (hu - 0.45), H + 0.85, zf - front * 0.45); K.box(1.0, 0.14, 1.0, col2, s * (hu - 0.45), H + 1.77, zf - front * 0.45, 0, { em: 1.2 });
          for (let z = -hv + 1.83; z < hv - 0.5; z += 1.83) K.box(0.06, H - 0.4, 0.08, SM, s * (hu + 0.03), H / 2 + 0.1, z); }
        for (let x = -hu + 2; x < hu - 0.5; x += 2) K.box(0.08, H - 0.4, 0.06, SM, x, H / 2 + 0.1, -zf - front * 0.03);
        for (const [x, c] of [[-hu * 0.3, '#39d353'], [-hu * (big ? 0.72 : 0.68), '#ff3b30']]) { K.box(1.5, 2.3, 0.05, '#050308', x, 1.15, zf + front * 0.05);
          for (const s of [-1, 1]) K.box(0.12, 2.4, 0.14, col2, x + s * 0.81, 1.2, zf + front * 0.09); K.box(1.74, 0.3, 0.14, DARK, x, 2.5, zf + front * 0.09); K.box(1.5, 0.18, 0.03, c, x, 2.5, zf + front * 0.17, 0, { em: 1.6 });
          K.box(2.1, 0.08, 0.5, TR, x, 2.75, zf + front * 0.27); K.box(1.9, 0.15, 0.4, PLATE, x, 0.075, zf + front * 0.25); }
        K.box(0.05, 2.1, 1.0, SM, -(hu + 0.03), 1.05, -front * 1.5); K.box(0.04, 0.15, 0.4, '#39ff14', -(hu + 0.04), 2.3, -front * 1.5, 0, { em: 2.5 });
        K.box(1.6, 0.8, 1.0, STEEL, hu * 0.45, H + 0.52, -front * (hv - 1.2)); K.box(1.4, 0.05, 0.8, DARK, hu * 0.45, H + 0.95, -front * (hv - 1.2)); }
      const s = new THREE.Object3D(); s.position.set(0, 0.2, 0); this.g.add(s); this.seats.push(s);
      this.booth(hu - 1.6, front * (hv + 0.9), front > 0 ? 0 : Math.PI, col2); this.walk = true;
    }
    this.G.glow.paint(cfg.u, cfg.v, col, 10, 0.5);
    fillRiders(this.seats, 0.5); K.flush(this.B, this); this.finish(); this.a = 0;
  }
  update(dt) {
    this.cycle(dt); const k = this.k;
    if (!this.rot) return;
    if (this.style === 'spinner') { this.a += dt * (0.2 + 1.3 * k); this.rot.rotation.y = this.a; this.rot.rotation.x = Math.sin(this.a * 0.7) * 0.18 * k; }
    else if (this.style === 'drum') { this.a += dt * (0.2 + 2.2 * k); this.rot.rotation.y = this.a; this.rot.rotation.x = 0.35 * k; }
    else if (this.style === 'tagada') { this.a += dt * (0.3 + 1.2 * k); this.rot.rotation.y = this.a; this.rot.position.y = 0.6 + Math.max(0, Math.sin(this.t * 7)) * 0.7 * k; this.rot.rotation.z = Math.sin(this.t * 3) * 0.2 * k; }
    else if (this.style === 'tower') { this.a += dt * (0.15 + 1.4 * k); this.rot.rotation.z = this.a; }
  }
}

export function buildRides(G) {
  G.rides = {}; const map = { ferris: Ferris, carousel: Carousel, breakdance: BreakDance, swing: Swing, freefall: FreeFall, pendulum: Pendulum, coaster: Coaster, scooter: Scooter, ghost: Ghost, vr: VR };
  for (const [id, cfg] of Object.entries(RIDES)) G.rides[id] = new map[cfg.type](G, id, cfg);
  EXTRA_RIDES.forEach((cfg, i) => { G.rides['x' + i] = new Generic(G, 'x' + i, cfg); });
  buildRiderInstances(G);
}
export function updateRides(G, dt) { for (const r of Object.values(G.rides)) r.update(dt); updateRiderInstances(G); }
