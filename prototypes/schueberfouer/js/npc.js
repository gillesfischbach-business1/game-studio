// Menschen: Spielfigur-Modell, Besuchermenge (instanziert), Verkäufer, Lämmy, Schafe
import * as THREE from 'three';
import { LANES, L, toLocal, ROADS } from './data.js';
import { M, Glow, R, RI, pick, rand, clamp, mulberry32 } from './util.js';
import { alongPath } from './world.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { loadTex } from './tex.js';

export const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f5d0b0', '#d1a17a'];
export const SHIRTS = ['#e63946', '#1d3557', '#457b9d', '#f1faee', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8338ec', '#ff006e', '#222222', '#6a994e', '#bc4749', '#ffffff', '#3d405b', '#81b29a', '#b5838d', '#ffb4a2'];
export const PANTS = ['#1b263b', '#3d405b', '#222222', '#6b705c', '#283618', '#415a77', '#5e503f', '#14213d'];
export const HAIR = ['#2b1b0e', '#4a2f1b', '#7a5230', '#c9a66b', '#111111', '#8d8d8d', '#b5651d', '#e6c98f'];

// ---------- Gemeinsame Körperteile (anatomisch geformt) ----------
let FACE;
/** Gesichtstextur (wird mit der Hautfarbe multipliziert) */
export function faceTex() {
  if (FACE) return FACE;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128);
  const cx = 64; // u = 0.25 -> Vorderseite (+z)
  const sh = g.createRadialGradient(cx, 64, 10, cx, 64, 70); sh.addColorStop(0, 'rgba(255,240,235,0)'); sh.addColorStop(1, 'rgba(120,80,70,0.25)'); g.fillStyle = sh; g.fillRect(0, 0, 256, 128);
  for (const dx of [-13, 13]) { g.fillStyle = '#fbfbf8'; g.beginPath(); g.ellipse(cx + dx, 58, 6, 3.6, 0, 0, 7); g.fill(); g.fillStyle = '#3b2a20'; g.beginPath(); g.arc(cx + dx, 58, 2.6, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(cx + dx, 58, 1.2, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,40,30,0.85)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx + dx - 7, 51 - (dx > 0 ? 0 : 0)); g.quadraticCurveTo(cx + dx, 47, cx + dx + 7, 51); g.stroke();
    g.strokeStyle = 'rgba(90,60,50,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + dx - 6, 61); g.quadraticCurveTo(cx + dx, 63, cx + dx + 6, 61); g.stroke(); }
  g.fillStyle = 'rgba(150,90,80,0.25)'; g.beginPath(); g.ellipse(cx, 68, 3.5, 6, 0, 0, 7); g.fill(); // Nase
  g.fillStyle = 'rgba(170,80,80,0.75)'; g.beginPath(); g.ellipse(cx, 81, 8, 2.4, 0, 0, 7); g.fill(); // Mund
  g.fillStyle = 'rgba(220,120,110,0.18)'; for (const dx of [-20, 20]) { g.beginPath(); g.arc(cx + dx, 72, 7, 0, 7); g.fill(); }
  FACE = new THREE.CanvasTexture(cv); FACE.colorSpace = THREE.SRGBColorSpace; return FACE;
}
/** Gesichter übereinander (Atlas mit 8 Zeilen, 6 belegt): 0 neutral, 1 Bart, 2 Brille, 3 Lippenstift/Wimpern, 4 Sonnenbrille getönt (auf 0), 5 Sonnenbrille dunkel (auf 3) */
let FACES;
export function crowdFaceTex() {
  if (FACES) return FACES;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 1024; const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 1024);
  for (let row = 0; row < 6; row++) { const k = row < 4 ? row : row === 4 ? 0 : 3; const oy = (7 - row) * 128; const cx = 64; g.save(); g.translate(0, oy);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128);
    const sh = g.createRadialGradient(cx, 64, 10, cx, 64, 70); sh.addColorStop(0, 'rgba(255,240,235,0)'); sh.addColorStop(1, 'rgba(120,80,70,0.28)'); g.fillStyle = sh; g.fillRect(0, 0, 256, 128);
    const brow = k === 1 ? 3.2 : k === 3 ? 1.6 : 2.3;
    for (const dx of [-13, 13]) { g.fillStyle = '#f7f7f2'; g.beginPath(); g.ellipse(cx + dx, 58, 5.6, 3.2, 0, 0, 7); g.fill();
      g.fillStyle = ['#3b2a20', '#2b3a4a', '#4a3a22', '#2f4a36'][k]; g.beginPath(); g.arc(cx + dx, 58, 2.6, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(cx + dx, 58, 1.2, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(cx + dx + 0.9, 57.2, 0.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(50,34,26,0.9)'; g.lineWidth = brow; g.beginPath(); g.moveTo(cx + dx - 7, 51.5); g.quadraticCurveTo(cx + dx, 47.5 - (k === 3 ? 1 : 0), cx + dx + 7, 51 + (k === 1 ? Math.sign(dx) * -1 : 0)); g.stroke();
      g.strokeStyle = k === 3 ? 'rgba(20,14,12,0.9)' : 'rgba(70,45,38,0.45)'; g.lineWidth = k === 3 ? 1.5 : 1; g.beginPath(); g.moveTo(cx + dx - 6, 55.6); g.quadraticCurveTo(cx + dx, 53.4, cx + dx + 6, 55.6); g.stroke();
      g.strokeStyle = 'rgba(90,60,50,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + dx - 6, 61.5); g.quadraticCurveTo(cx + dx, 63.5, cx + dx + 6, 61.5); g.stroke(); }
    g.fillStyle = 'rgba(150,90,80,0.22)'; g.beginPath(); g.ellipse(cx, 68, 3.5, 6, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(90,50,45,0.35)'; for (const dx of [-2.2, 2.2]) { g.beginPath(); g.ellipse(cx + dx, 73, 1.2, 0.8, 0, 0, 7); g.fill(); }
    if (k === 1) { g.fillStyle = 'rgba(45,32,26,0.55)'; g.beginPath(); g.ellipse(cx, 88, 21, 15, 0, 0, Math.PI); g.fill(); g.beginPath(); g.ellipse(cx, 77.5, 10, 2.6, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(45,32,26,0.4)'; for (const dx of [-21, 21]) g.fillRect(cx + dx - 3, 62, 6, 26); }
    g.fillStyle = k === 3 ? 'rgba(190,40,60,0.9)' : 'rgba(165,85,82,0.75)'; g.beginPath(); g.ellipse(cx, 81, k === 3 ? 7.5 : 8, k === 3 ? 3 : 2.2, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,40,40,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 7, 81); g.quadraticCurveTo(cx, 82.4, cx + 7, 81); g.stroke();
    g.fillStyle = 'rgba(220,120,110,' + (k === 3 ? 0.3 : 0.16) + ')'; for (const dx of [-20, 20]) { g.beginPath(); g.arc(cx + dx, 72, 7, 0, 7); g.fill(); }
    if (k === 2) { g.strokeStyle = 'rgba(20,20,24,0.95)'; g.lineWidth = 1.8; for (const dx of [-13, 13]) { g.beginPath(); g.roundRect(cx + dx - 8.5, 52, 17, 12, 3); g.stroke(); } g.beginPath(); g.moveTo(cx - 4.5, 57); g.lineTo(cx + 4.5, 57); g.stroke(); for (const dx of [-21.5, 21.5]) { g.beginPath(); g.moveTo(cx + dx, 56); g.lineTo(cx + dx * 1.7, 55); g.stroke(); } }
    if (row >= 4) { const dk = row === 5; g.fillStyle = dk ? 'rgba(12,12,16,0.97)' : 'rgba(74,52,34,0.9)'; g.strokeStyle = dk ? 'rgba(10,10,12,1)' : 'rgba(150,120,70,0.95)'; g.lineWidth = dk ? 2.4 : 1.4;
      for (const dx of [-13, 13]) { g.beginPath(); g.roundRect(cx + dx - 10, 50.5, 20, dk ? 15 : 13, dk ? 6 : 4); g.fill(); g.stroke(); }
      g.beginPath(); g.moveTo(cx - 3.5, 55); g.lineTo(cx + 3.5, 55); g.stroke(); for (const dx of [-23, 23]) { g.beginPath(); g.moveTo(cx + dx, 55); g.lineTo(cx + dx * 1.7, 54); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.22)'; for (const dx of [-13, 13]) { g.beginPath(); g.ellipse(cx + dx - 3, 54, 3.5, 1.6, -0.5, 0, 7); g.fill(); } }
    g.restore(); }
  FACES = new THREE.CanvasTexture(cv); FACES.colorSpace = THREE.SRGBColorSpace; FACES.anisotropy = 4; return FACES;
}
/** Shader-Zusatz für die Menge: Haut an Hals, Händen und Beinen, Jacke, helle Schuhe (pro Instanz über aSkin / aStyle).
 * aStyle-Bits: 1 lange Ärmel, 2 kurze Hose / nackte Unterschenkel, 4 Jacke (Oberteil dunkler, helle Knopfleiste), 8 helle Schuhe, 16 ärmellos (Ärmel und Schulter des Oberkörpers als Haut) */
function dress(mat, kind) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aPart; attribute vec3 aSkin; attribute float aStyle; varying vec3 vPart; varying vec3 vSkin; varying float vStyle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vPart = aPart; vSkin = aSkin; vStyle = aStyle;');
    const body = kind === 'torso' ? 'if (vPart.x > 0.5 || (vPart.y > 0.5 && bS > 0.5)) diffuseColor.rgb = vSkin; else if (vPart.z > 0.5 && bJ > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86), 0.82); else if (bJ > 0.5) diffuseColor.rgb *= 0.62;'
      : kind === 'leg' ? 'if (vPart.y > 0.5 && bL > 0.5) diffuseColor.rgb = vSkin; else if (vPart.z > 0.5 && bW > 0.5) diffuseColor.rgb = vec3(0.8, 0.8, 0.78);'
      : 'if (vPart.x > 0.5) diffuseColor.rgb = vSkin;';
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPart; varying vec3 vSkin; varying float vStyle;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n float bL = mod(floor(vStyle / 2.0), 2.0), bJ = mod(floor(vStyle / 4.0), 2.0), bW = mod(floor(vStyle / 8.0), 2.0), bS = mod(floor(vStyle / 16.0), 2.0); ${body}`);
  };
  mat.customProgramCacheKey = () => 'dress-' + kind; return mat;
}
function faceAtlas(mat) {
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFace;').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv.y = (vMapUv.y + aFace) * 0.125;\n#endif'); };
  mat.customProgramCacheKey = () => 'face-atlas'; return mat;
}
function lathe(profile, seg = 12, sz = 1) { const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); if (sz !== 1) g.scale(1, 1, sz); return g; }
/** Masken pro Vertex für die Kleidung der Menge: x = immer Haut, y = unterer Abschnitt (Bein: Haut bei kurzer Hose; Oberkörper: Ärmel, Haut bei ärmellos), z = Extra (Schuh / Knopfleiste) */
function part(geo, fn) { const p = geo.attributes.position; const a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; } geo.setAttribute('aPart', new THREE.BufferAttribute(a, 3)); return geo; }
function vcol(geo, fn) { const p = geo.attributes.position; const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
const W1 = [1, 1, 1];
/** Oberkörper (Hemd) relativ zur Brustmitte, inkl. kurzer Ärmel */
export function torsoGeo() {
  const t = lathe([[0.001, -0.36], [0.165, -0.35], [0.158, -0.22], [0.15, -0.12], [0.165, 0.02], [0.185, 0.13], [0.19, 0.19], [0.16, 0.25], [0.085, 0.29], [0.06, 0.31], [0.001, 0.31]], 10, 0.64);
  const parts = [t.toNonIndexed()];
  for (const sx of [-1, 1]) { const s = new THREE.CylinderGeometry(0.068, 0.062, 0.16, 7); s.rotateZ(sx * 0.35); s.translate(sx * 0.205, 0.16, 0); parts.push(s.toNonIndexed()); const c = new THREE.SphereGeometry(0.07, 7, 5); c.translate(sx * 0.19, 0.22, 0); parts.push(c.toNonIndexed()); }
  for (const p of parts) p.deleteAttribute('uv');
  const g = part(BGU.mergeGeometries(parts), (x, y, z) => [y > 0.2 && z > 0.02 && Math.abs(x) < 0.075 ? 1 : 0, 0, z > 0.04 && Math.abs(x) < 0.05 && y < 0.24 ? 1 : 0]);
  const a = g.attributes.aPart; for (let i = parts[0].attributes.position.count; i < a.count; i++) a.setY(i, 1); // Ärmel + Schulterkappen (nur Menge, Bit 16)
  return g;
}
/** Bein (Hose) mit Schuh; Drehpunkt an der Hüfte, Länge ~0.9 */
export function legGeo() {
  const l = lathe([[0.001, 0.06], [0.09, 0.05], [0.1, -0.05], [0.085, -0.3], [0.066, -0.45], [0.07, -0.55], [0.058, -0.75], [0.05, -0.84], [0.001, -0.86]], 7);
  const shoe = new THREE.BoxGeometry(0.1, 0.07, 0.25); shoe.translate(0, -0.875, 0.05);
  const g = BGU.mergeGeometries([l.toNonIndexed(), shoe.toNonIndexed()].map(x => { x.deleteAttribute('uv'); return x; }));
  part(g, (x, y) => [0, y < -0.42 && y >= -0.84 ? 1 : 0, y < -0.84 ? 1 : 0]);
  return vcol(g, (x, y) => y < -0.84 ? [0.13, 0.13, 0.14] : W1);
}
/** Menge: Oberschenkel (Kontur wie legGeo), Drehpunkt Hüfte, Knie bei y = -0.45, unten mit Kappe geschlossen */
export function thighGeo() {
  const g = lathe([[0.001, 0.06], [0.09, 0.05], [0.1, -0.05], [0.085, -0.3], [0.066, -0.45], [0.001, -0.48]], 7).toNonIndexed(); g.deleteAttribute('uv');
  part(g, (x, y) => [0, y < -0.42 ? 1 : 0, 0]); return vcol(g, () => W1);
}
/** Menge: Unterschenkel mit Schuh, Drehpunkt Knie (= legGeo um 0.45 nach oben), oben mit Kappe geschlossen. Masken pro Teilstück vor dem Zusammenfügen */
export function shinGeo() {
  const SHOE = [0.13, 0.13, 0.14], isShoe = [0, 0, 1], isLow = [0, 1, 0];
  const l = lathe([[0.001, 0.03], [0.066, 0], [0.07, -0.1], [0.058, -0.3], [0.05, -0.39], [0.001, -0.41]], 7).toNonIndexed(); l.deleteAttribute('uv');
  const shoe = new THREE.BoxGeometry(0.1, 0.07, 0.25).toNonIndexed(); shoe.deleteAttribute('uv'); shoe.translate(0, -0.425, 0.05);
  part(l, (x, y) => y < -0.4 ? isShoe : isLow); vcol(l, (x, y) => y < -0.4 ? SHOE : W1); part(shoe, () => isShoe); vcol(shoe, () => SHOE);
  return BGU.mergeGeometries([l, shoe]);
}
/** Menge: Rock / Kleid / Mantelschoß – offener Kegelstumpf, Oberkante y = 0 (steckt im Oberkörper), Saum y = -1; Länge über Skalierung in y */
export function skirtGeo() {
  const g = new THREE.CylinderGeometry(0.168, 0.215, 1, 8, 1, true); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (p.getY(i) > 0 ? 0.56 : 0.72));
  g.translate(0, -0.5, 0); g.computeVertexNormals(); g.deleteAttribute('uv'); return g;
}
/** Menge: Gehstock, Ursprung am Griff (Hand), Spitze bei y = -0.9 */
export function caneGeo() {
  const st = new THREE.CylinderGeometry(0.011, 0.009, 0.9, 5); st.translate(0, -0.45, 0);
  const h = new THREE.CylinderGeometry(0.014, 0.014, 0.12, 5); h.rotateX(Math.PI / 2); h.translate(0, 0.012, 0.015);
  return BGU.mergeGeometries([st, h].map(x => { x = x.toNonIndexed(); x.deleteAttribute('uv'); return x; }));
}
/** Menge: Kinderwagen (Wanne, Verdeck, Schiebegriff, Gestell, vier Räder), Ursprung am Boden unter der Mitte, Fahrtrichtung +z, Griff bei y 0.98 / z -0.52 */
export function strollerGeo() {
  const P = [], add = (g, col) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); P.push(vcol(g, () => col)); };
  const GREY = [0.36, 0.38, 0.42], DARK = [0.2, 0.21, 0.24], MET = [0.7, 0.7, 0.72], BLK = [0.05, 0.05, 0.05];
  let g = new THREE.BoxGeometry(0.42, 0.26, 0.72); g.translate(0, 0.56, 0); add(g, GREY);
  g = new THREE.CylinderGeometry(0.25, 0.25, 0.43, 6, 1, false, 0.9, 2.5); g.rotateZ(Math.PI / 2); g.translate(0, 0.66, -0.1); add(g, DARK);
  g = new THREE.BoxGeometry(0.44, 0.028, 0.028); g.translate(0, 0.98, -0.52); add(g, DARK);
  for (const sx of [-1, 1]) {
    g = new THREE.BoxGeometry(0.02, 0.4, 0.02); g.rotateX(-0.63); g.translate(sx * 0.2, 0.83, -0.41); add(g, MET);
    g = new THREE.BoxGeometry(0.02, 0.3, 0.46); g.translate(sx * 0.2, 0.29, 0); add(g, MET);
    for (const sz of [-1, 1]) { g = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 7); g.rotateZ(Math.PI / 2); g.translate(sx * 0.235, 0.11, sz * 0.27); add(g, BLK); }
  }
  return BGU.mergeGeometries(P);
}
/** Arm (Haut) mit Hand; Drehpunkt an der Schulter */
export function armGeo() {
  const a = lathe([[0.001, 0.02], [0.05, 0.0], [0.048, -0.22], [0.04, -0.3], [0.038, -0.5], [0.03, -0.56], [0.001, -0.57]], 6);
  const hand = new THREE.SphereGeometry(0.045, 6, 4); hand.scale(0.8, 1.2, 0.55); hand.translate(0, -0.62, 0.01);
  return part(BGU.mergeGeometries([a.toNonIndexed(), hand.toNonIndexed()].map(x => { x.deleteAttribute('uv'); return x; })), (x, y) => [y < -0.55 ? 1 : 0, 0, 0]);
}
/** Kopf mit Hals; Ursprung = Kopfmitte. UV vom Kugel-Teil -> Gesichtstextur */
export function headGeo() {
  const h = new THREE.SphereGeometry(0.115, 14, 10); h.scale(0.9, 1.1, 1.0);
  const neck = new THREE.CylinderGeometry(0.05, 0.058, 0.14, 10); neck.translate(0, -0.15, -0.01);
  const ears = []; for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(0.025, 6, 6); e.scale(0.5, 1, 0.8); e.translate(sx * 0.103, 0.0, -0.005); ears.push(e); }
  const nose = new THREE.ConeGeometry(0.018, 0.045, 6); nose.rotateX(Math.PI / 2); nose.translate(0, -0.008, 0.118);
  return BGU.mergeGeometries([h, neck, ...ears, nose].map(x => x.index ? x.toNonIndexed() : x));
}
export function hairGeo(style = 0) {
  const cap = new THREE.SphereGeometry(0.124, 12, 7, 0, Math.PI * 2, 0, Math.PI * (style === 2 ? 0.62 : 0.5)); cap.scale(0.92, 1.1, 1.04); cap.rotateX(-0.28); cap.translate(0, 0.012, -0.006);
  const parts = [cap.toNonIndexed()];
  if (style === 1) { const p = new THREE.CapsuleGeometry(0.04, 0.16, 3, 6); p.rotateX(0.35); p.translate(0, -0.06, -0.12); parts.push(p.toNonIndexed()); }
  if (style === 2) { const b = new THREE.BoxGeometry(0.2, 0.24, 0.06); b.translate(0, -0.08, -0.095); parts.push(b.toNonIndexed()); }
  for (const p of parts) { if (p.attributes.uv) p.deleteAttribute('uv'); }
  return BGU.mergeGeometries(parts);
}

/** Detaillierte Figur (Spieler, Sonder-NPCs). Blickrichtung +z. */
export function makeHuman({ skin = pick(SKINS), shirt = pick(SHIRTS), pants = pick(PANTS), hair = pick(HAIR), scale = 1, hairStyle = RI(0, 2), shoes = '#1a1a1a', unique = false } = {}) {
  const g = new THREE.Group(); const P = {};
  const fab = loadTex('fabric_pattern_07_nor.jpg', false);
  const skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5 }), faceM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5, map: faceTex() });
  const shirtM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85, normalMap: fab, normalScale: new THREE.Vector2(0.7, 0.7) });
  const pantsM = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.8, normalMap: fab, normalScale: new THREE.Vector2(1, 1), vertexColors: true });
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips); P.hips = hips;
  const torso = new THREE.Mesh(torsoGeo(), shirtM); torso.position.y = 0.38; hips.add(torso); P.torso = torso; P.shirtM = shirtM;
  const pelvis = new THREE.Mesh(lathe([[0.001, 0.1], [0.162, 0.1], [0.17, 0.0], [0.15, -0.08], [0.001, -0.09]], 12, 0.68), pantsM); pantsM.vertexColors = false; hips.add(pelvis);
  const head = new THREE.Group(); head.position.y = 0.82; hips.add(head); P.head = head;
  head.add(new THREE.Mesh(headGeo(), faceM));
  const hairM = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.65 });
  const hm = new THREE.Mesh(hairGeo(hairStyle), hairM); head.add(hm); P.hair = hm;
  const limb = (parent, x, y, up, low, rad, mat, foot) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); parent.add(pivot);
    const u = new THREE.Mesh(lathe([[0.001, 0.02], [rad, 0], [rad * 0.9, -up * 0.6], [rad * 0.75, -up], [0.001, -up - 0.01]], 10), mat); pivot.add(u);
    const knee = new THREE.Group(); knee.position.y = -up; pivot.add(knee);
    const l = new THREE.Mesh(lathe([[0.001, 0.02], [rad * 0.78, 0], [rad * 0.72, -low * 0.4], [rad * 0.55, -low], [0.001, -low - 0.01]], 10), mat); knee.add(l);
    if (foot === 'shoe') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.26), new THREE.MeshStandardMaterial({ color: shoes, roughness: 0.45 })); s.position.set(0, -low - 0.02, 0.05); knee.add(s); }
    else { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), skinM); hd.scale.set(0.8, 1.2, 0.55); hd.position.set(0, -low - 0.05, 0.01); knee.add(hd); }
    pivot.userData.knee = knee; return pivot;
  };
  // Arme: kurze Ärmel sind am Oberkörper, Arme sind Haut
  P.armL = limb(hips, -0.235, 0.6, 0.28, 0.27, 0.05, skinM, 'hand'); P.armR = limb(hips, 0.235, 0.6, 0.28, 0.27, 0.05, skinM, 'hand');
  P.legL = limb(hips, -0.095, 0.0, 0.45, 0.42, 0.092, pantsM, 'shoe'); P.legR = limb(hips, 0.095, 0.0, 0.45, 0.42, 0.092, pantsM, 'shoe');
  P.slot = { head: new THREE.Group(), eyes: new THREE.Group(), neck: new THREE.Group(), hand: new THREE.Group() };
  head.add(P.slot.head); head.add(P.slot.eyes); hips.add(P.slot.neck); P.armR.userData.knee.add(P.slot.hand); P.slot.hand.position.set(0, -0.32, 0.06);
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.P = P; g.userData.walk = 0;
  return g;
}
/** Lauf-/Sitz-Animation mit Knie- und Ellbogenbeugung */
export function animateHuman(h, speed, dt, mode = 'walk') {
  const P = h.userData.P; if (!P) return; const kL = P.legL.userData.knee, kR = P.legR.userData.knee, eL = P.armL.userData.knee, eR = P.armR.userData.knee;
  if (mode === 'sit') { P.legL.rotation.x = P.legR.rotation.x = -1.45; kL.rotation.x = kR.rotation.x = 1.4; P.armL.rotation.x = P.armR.rotation.x = -0.5; eL.rotation.x = eR.rotation.x = -0.6; P.hips.position.y = 0.48; return; }
  P.hips.position.y = 0.92;
  h.userData.walk += dt * speed * 5.2; const ph = h.userData.walk; const amp = Math.min(1, speed / 1.5) * (mode === 'run' ? 0.85 : 0.5); const s = Math.sin(ph) * amp;
  P.legL.rotation.x = s; P.legR.rotation.x = -s;
  kL.rotation.x = Math.max(0, Math.sin(ph - 1.2)) * amp * 1.5; kR.rotation.x = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * amp * 1.5;
  P.armL.rotation.x = -s * 0.8; P.armR.rotation.x = h.userData.holding ? -0.5 : s * 0.8; eL.rotation.x = -0.25 - amp * 0.4; eR.rotation.x = h.userData.holding ? -1.3 : -0.25 - amp * 0.4;
  P.armL.rotation.z = 0.08; P.armR.rotation.z = -0.08;
  P.hips.position.y = 0.92 + Math.abs(Math.cos(ph)) * 0.03 * Math.min(1, speed);
  P.hips.rotation.y = Math.sin(ph) * 0.08 * amp; P.torso.rotation.y = -Math.sin(ph) * 0.12 * amp;
  P.torso.rotation.x = mode === 'run' ? 0.15 : 0.02;
  if (mode === 'drunk') { P.hips.rotation.z = Math.sin(ph * 0.5) * 0.1; } else P.hips.rotation.z = 0;
}

/** Lämmy – das Maskottchen der Fouer (Schaf-Kostüm) */
export function makeSheep({ scale = 1, golden = false, mascot = false } = {}) {
  const g = new THREE.Group();
  const wool = golden ? M('#ffd700', { metalness: 0.9, roughness: 0.25, emissive: '#7a5a00', emissiveIntensity: 0.5 }) : M('#f8f4ea', { roughness: 1 });
  const face = golden ? wool : M('#2b2b2b', { roughness: 0.7 });
  const bodyY = mascot ? 1.1 : 0.55;
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(mascot ? 0.42 : 0.26, 10, 8), wool); s.position.set(R(-0.2, 0.2) * (mascot ? 1.4 : 1), bodyY + R(-0.1, 0.15), (i / 8 - 0.5) * (mascot ? 0.5 : 0.75)); g.add(s); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(mascot ? 0.36 : 0.17, 12, 10), face); head.scale.set(0.85, 1, 1.15); head.position.set(0, mascot ? 2.05 : 0.78, mascot ? 0.1 : 0.48); g.add(head);
  const top = new THREE.Mesh(new THREE.SphereGeometry(mascot ? 0.3 : 0.12, 10, 8), wool); top.position.set(0, mascot ? 2.3 : 0.9, mascot ? 0.05 : 0.44); g.add(top);
  for (const x of [-1, 1]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(mascot ? 0.32 : 0.14, 0.06, 0.08), face); ear.position.set(x * (mascot ? 0.42 : 0.18), mascot ? 2.1 : 0.8, mascot ? 0.05 : 0.44); ear.rotation.z = x * 0.4; g.add(ear); }
  for (const x of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.SphereGeometry(mascot ? 0.06 : 0.025, 6, 4), mascot ? M('#ffffff') : M('#000')); e.position.set(x * (mascot ? 2 : 1), mascot ? 2.12 : 0.82, mascot ? 0.4 : 0.64); g.add(e); if (mascot) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M('#000')); p.position.set(x * 2, 2.12, 0.45); g.add(p); } }
  const legs = []; for (const [x, z] of [[-0.12, 0.25], [0.12, 0.25], [-0.12, -0.25], [0.12, -0.25]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(mascot ? 0.1 : 0.04, mascot ? 0.1 : 0.04, mascot ? 0.8 : 0.4, 6), face); l.position.set(x * (mascot ? 1.5 : 1), mascot ? 0.4 : 0.2, z * (mascot ? 0.5 : 1)); g.add(l); legs.push(l); }
  if (mascot) { // Arme + T-Shirt-Schärpe
    for (const x of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 3, 8), wool); a.position.set(x * 0.65, 1.3, 0.1); a.rotation.z = x * 0.5; g.add(a); }
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 24), M('#ed2939')); sash.position.set(0, 1.2, 0); sash.rotation.set(Math.PI / 2, 0.5, 0); g.add(sash);
  }
  g.scale.setScalar(scale); g.userData.legs = legs; g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// =============================================================
// Besuchermenge (instanziert)
export class Crowd {
  constructor(G, count) {
    this.G = G; this.n = count;
    // Wegenetz aus den Alleen
    const nodes = []; const edges = [];
    const addNode = (u, v) => { for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].u - u, nodes[i].v - v) < 3.5) return i; nodes.push({ u, v, n: [] }); return nodes.length - 1; };
    for (const ln of LANES) { const [ua, va] = ln.a, [ub, vb] = ln.b; const len = Math.hypot(ub - ua, vb - va); const k = Math.max(1, Math.round(len / 7)); let prev = -1;
      for (let i = 0; i <= k; i++) { const id = addNode(ua + (ub - ua) * i / k, va + (vb - va) * i / k); nodes[id].w = Math.max(nodes[id].w || 0, ln.w); if (prev >= 0 && prev !== id) { nodes[prev].n.push(id); nodes[id].n.push(prev); } prev = id; } }
    // Kreuzungen verbinden
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].u - nodes[j].u, nodes[i].v - nodes[j].v) < 7.5 && !nodes[i].n.includes(j)) { nodes[i].n.push(j); nodes[j].n.push(i); }
    for (const nd of nodes) { const w = L(nd.u, nd.v); nd.x = w.x; nd.z = w.z; }
    this.nodes = nodes;
    // Außen-Fußgänger auf Gehwegen
    this.walkRoads = ROADS.filter(r => r.pts).map(r => { const lens = []; let tot = 0; for (let i = 0; i < r.pts.length - 1; i++) { const l = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]); lens.push(l); tot += l; } return { pts: r.pts, lens, tot, w: r.w }; });
    // Geometrien (anatomisch geformt)
    const fn = loadTex('fabric_pattern_07_nor.jpg', false);
    const cloth = new THREE.MeshStandardMaterial({ roughness: 0.85, normalMap: fn, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true });
    const clothT = new THREE.MeshStandardMaterial({ roughness: 0.85, normalMap: fn, normalScale: new THREE.Vector2(0.8, 0.8) });
    const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.5 }); const faceMat = faceAtlas(new THREE.MeshStandardMaterial({ roughness: 0.5, map: crowdFaceTex() })); const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
    const hairs = [hairGeo(0), hairGeo(1), hairGeo(2)];
    const legMat = dress(cloth, 'leg'), torsoMat = dress(clothT, 'torso'), armMat = dress(new THREE.MeshStandardMaterial({ roughness: 0.7 }), 'arm');
    const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
    const blobGeo = new THREE.PlaneGeometry(0.95, 0.95); blobGeo.rotateX(-Math.PI / 2);
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    const skirtMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), caneMat = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.55 }), strollerMat = new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: true });
    this.im = {}; for (const [k, geo, mat] of [['torso', torsoGeo(), torsoMat], ['head', headGeo(), faceMat], ['hair', hairs[0], hairMat], ['hair2', hairs[2], hairMat], ['hair3', hairs[1], hairMat], ['legL', thighGeo(), legMat], ['legR', thighGeo(), legMat], ['shinL', shinGeo(), legMat], ['shinR', shinGeo(), legMat], ['armL', armGeo(), armMat], ['armR', armGeo(), armMat], ['blob', blobGeo, blobMat], ['skirt', skirtGeo(), skirtMat], ['cane', caneGeo(), caneMat], ['stroller', strollerGeo(), strollerMat]]) { const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; G.scene.add(m); this.im[k] = m; }
    for (const k of ['skirt', 'cane', 'stroller']) this.im[k].instanceMatrix.array.fill(0); // Zubehör: standardmäßig unsichtbar (Null-Matrix), update() schreibt nur die Träger
    const c = new THREE.Color();
    const aSkin = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3), aStyle = new THREE.InstancedBufferAttribute(new Float32Array(count), 1), aFace = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    for (const k of ['torso', 'legL', 'legR', 'shinL', 'shinR', 'armL', 'armR']) { this.im[k].geometry.setAttribute('aSkin', aSkin); this.im[k].geometry.setAttribute('aStyle', aStyle); }
    this.im.head.geometry.setAttribute('aFace', aFace);
    this.a = [];
    const nOut = Math.round(count * 0.1); const vendors = G.vendors || [];
    // Eigener Zufallsgenerator für Typen und Plaudergruppen: die Reihenfolge von rand() bleibt wie bisher
    const rnd = mulberry32(1873), pk = arr => arr[Math.floor(rnd() * arr.length)];
    // Plaudergruppen: 3–4 Erwachsene im lockeren Kreis am Rand einer Allee (seitlich versetzt um die halbe Wegbreite), Blick zur Mitte
    const slots = []; let slot = 0; const nG = Math.min(10, Math.floor((count - vendors.length - nOut) / 30)); const used = [];
    for (let gi = 0, tries = 0; gi < nG && tries < 600; tries++) {
      const nd = nodes[Math.floor(rnd() * nodes.length)]; if (!nd.n.length || (tries < 300 && nd.n.length !== 2) || used.some(q => Math.hypot(q.x - nd.x, q.z - nd.z) < 14)) continue;
      const nb = nodes[nd.n[0]], dx = nb.x - nd.x, dz = nb.z - nd.z, len = Math.hypot(dx, dz) || 1, off = Math.max(1.2, (nd.w || 6) * 0.5 - 0.45) * (rnd() < 0.5 ? 1 : -1);
      const gx = nd.x - dz / len * off, gz = nd.z + dx / len * off, n = rnd() < 0.5 ? 3 : 4, rad = n === 3 ? 0.55 : 0.68, a0 = rnd() * 6.283, mem = [];
      for (let k = 0; k < n; k++) { const a = a0 + (k + (rnd() - 0.5) * 0.3) / n * 6.283, r = rad * (0.9 + rnd() * 0.25); mem.push({ x: gx + Math.sin(a) * r, z: gz + Math.cos(a) * r }); }
      for (let k = 0; k < n; k++) { const p = mem[k]; p.yaw = Math.atan2(gx - p.x, gz - p.z) + (rnd() - 0.5) * 0.3;
        const lk = q => { let d = Math.atan2(q.x - p.x, q.z - p.z) - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return clamp(d, -1, 1); };
        p.lk1 = lk(mem[(k + 1) % n]); p.lk2 = lk(mem[(k + n - 1) % n]); p.lph = rnd() * 6.283; slots.push(p); }
      used.push(nd); gi++;
    }
    // Sitzende Gäste (G.seats aus fair.js: { u, v, y = Oberkante Bank, ry, table = Höhe Tischplatte }): rund 40 % der Plätze, höchstens 15 % der Menge,
    // tischweise zu zweit bis viert. Eigener Generator rs; jeder sitStride-te geeignete Erwachsene setzt sich, damit Sitzende über alle Indizes verteilt sind (setActive).
    const sits = []; let sitI = 0, elig = 0, sitStride = 2;
    { const seats = G.seats || [], rs = mulberry32(4711), nSit = Math.min(Math.round(seats.length * 0.4), Math.floor(count * 0.15)), tables = []; let cur = null;
      const rel = (p, q) => { const d = Math.atan2(q.x - p.x, q.z - p.z) - p.yaw; return Math.atan2(Math.sin(d), Math.cos(d)); };
      for (const st of seats) { const p = L(st.u, st.v), q = { x: p.x, z: p.z, y: st.y, table: st.table, yaw: st.ry + G.FAIR.theta }; if (!cur || cur.length >= 4 || Math.hypot(q.x - cur[0].x, q.z - cur[0].z) > 1.75) tables.push(cur = []); cur.push(q); }
      for (let k = tables.length - 1; k > 0; k--) { const j = Math.floor(rs() * (k + 1)), t = tables[k]; tables[k] = tables[j]; tables[j] = t; }
      for (const tb of tables) { const left = nSit - sits.length; if (left < 2 || tb.length < 2) { if (left < 2) break; continue; }
        const n = Math.min(tb.length, left, [2, 2, 2, 3, 4, 4][Math.floor(rs() * 6)]), first = tb[Math.floor(rs() * tb.length)], rest = tb.filter(q => q !== first), opp = rs() < 0.7;
        // Zweiter Gast: meist gegenüber (kleinster Winkel zur Blickrichtung), sonst daneben (kleinster Abstand)
        rest.sort((a, b) => opp ? Math.abs(rel(first, a)) - Math.abs(rel(first, b)) : Math.hypot(a.x - first.x, a.z - first.z) - Math.hypot(b.x - first.x, b.z - first.z));
        const mate = rest.shift(); for (let k = rest.length - 1; k > 0; k--) { const j = Math.floor(rs() * (k + 1)), t = rest[k]; rest[k] = rest[j]; rest[j] = t; }
        const sel = [first, mate, ...rest].slice(0, n);
        for (const p of sel) { const ang = sel.filter(q => q !== p).map(q => rel(p, q)).filter(d => Math.abs(d) > 0.25); // gegenüber = geradeaus, Kopf dreht nur zu Nachbar / Diagonale
          p.lk1 = ang.length ? clamp(ang[0], -1, 1) : rs() - 0.5; p.lk2 = ang.length > 1 ? clamp(ang[1], -1, 1) : (rs() - 0.5) * 0.8; p.lph = rs() * 6.283; p.lap = rs() < 0.4; p.gT = 6 + rs() * 9; p.go = rs() * 15; sits.push(p); } }
      if (sits.length) sitStride = clamp(Math.floor(((count - vendors.length - nOut) * 0.85 - slots.length) / sits.length), 2, 8); }
    for (let i = 0; i < count; i++) {
      const isVendor = i < vendors.length; const isOut = !isVendor && i < vendors.length + nOut;
      const kid = !isVendor && rand() < 0.12; const s = kid ? R(0.55, 0.7) : R(0.88, 1.1);
      let shirt = pick(SHIRTS), pants = pick(PANTS), skin = pick(SKINS), hairC = pick(HAIR);
      const o = { s, kid, ph: R(0, 6), speed: kid ? R(1.1, 1.6) : R(0.9, 1.45), state: 'walk', x: 0, z: 0, yaw: 0, ofs: R(-0.4, 0.4), idle: 0 };
      if (isVendor) { const vd = vendors[i]; const w = L(vd.u, vd.v); o.x = w.x; o.z = w.z; o.yaw = vd.ry + G.FAIR.theta; o.state = 'static'; o.s = R(0.95, 1.05); this.im.torso.setColorAt(i, c.set(vd.color === '#ffffff' ? '#f1faee' : '#ffffff')); }
      else if (isOut) { o.state = 'out'; o.road = pick(this.walkRoads); o.sp = R(0, o.road.tot); o.dir = rand() < 0.5 ? 1 : -1; o.side = rand() < 0.5 ? 1 : -1; this.im.torso.setColorAt(i, c.set(shirt)); }
      else { const ni = RI(0, nodes.length - 1); const nd = nodes[ni]; o.from = ni; o.to = pick(nd.n.length ? nd.n : [ni]); o.x = nd.x + R(-2, 2); o.z = nd.z + R(-2, 2); o.t = rand(); this.im.torso.setColorAt(i, c.set(shirt)); }
      // Kleidung und Statur: lange Ärmel, kurze Hose, offene Jacke, helle Schuhe
      let longSl = rand() < 0.38, shorts = rand() < (kid ? 0.55 : 0.28), jacket = longSl && rand() < 0.6, lightShoe = rand() < 0.42;
      c.set(skin); aSkin.setXYZ(i, c.r, c.g, c.b);
      const fem = rand() < 0.5; aFace.setX(i, kid ? pick([0, 3]) : fem ? pick([0, 2, 3, 3]) : pick([0, 0, 1, 1, 2]));
      o.w = kid ? R(0.92, 1.02) : fem ? R(0.86, 1.0) : R(0.98, 1.16); o.hairK = !fem && rand() < 0.1 ? -1 : fem ? pick([1, 1, 2, 2, 0]) : pick([0, 0, 0, 2]);
      // ---- ab hier nur noch rnd(): Plaudergruppe, Typ, Zubehör
      // sk = Länge des Rockteils (0 = keiner), ln = Grundneigung des Oberkörpers, cane = Gehstock, st = schiebt Kinderwagen
      o.sk = 0; o.ln = 0; o.cane = false; o.st = false; const adult = !kid && !isVendor;
      if (adult && !isOut && slot < slots.length) { const sl = slots[slot++]; o.state = 'chat'; o.x = sl.x; o.z = sl.z; o.yaw = sl.yaw; o.lk1 = sl.lk1; o.lk2 = sl.lk2; o.lph = sl.lph; }
      const chat = o.state === 'chat';
      // Typ: 1 älter, 2 Anzug, 3 Kleid / Rock, 5 langer Mantel, 0 wie bisher (Plaudergruppen: zur Hälfte Anzüge)
      let arch = 0, torsoC = null, armC = null, skirtC = null, thighC = null, sleeveless = false;
      if (adult) { const u = chat && rnd() < 0.5 ? 0.15 : rnd(); arch = u < 0.12 ? 1 : fem ? (u < 0.18 ? 2 : u < 0.46 ? 3 : u < 0.57 ? 5 : 0) : (u < 0.30 ? 2 : u < 0.35 ? 5 : 0); }
      if (arch === 1) { // älter: graues Haar, langsam, gebeugt, Strickjacke oder Mantel in gedeckten Farben, die Hälfte mit Stock
        hairC = pk(['#f2f2ee', '#dcdcd8', '#b9b9b6', '#9a9a98']); o.speed *= 0.6; o.ln = 0.14; o.cane = rnd() < 0.5; longSl = true; shorts = false; jacket = true; lightShoe = false;
        torsoC = armC = pk(['#6b6257', '#7a7466', '#4f5a52', '#5a4d48', '#8a7f6d', '#59606b', '#c8b79a']); pants = pk(['#3b3a38', '#4a4640', '#2f3338', '#5a5348']);
        if (fem && rnd() < 0.5) { o.sk = 0.72; skirtC = thighC = torsoC; }
      } else if (arch === 2) { // Anzug: Jacke und Hose in derselben dunklen Farbe, helles Hemd an der Knopfleiste, dunkle Schuhe
        torsoC = armC = pants = pk(['#1c2740', '#262a30', '#4d5560', '#16203a', '#3a4048']); longSl = true; shorts = false; jacket = true; lightShoe = false;
      } else if (arch === 3) { shorts = true; // nackte Unterschenkel
        if (rnd() < 0.5) { // Kleid: Oberteil und Rock in einer Farbe, meist ärmellos oder kurze Ärmel
          torsoC = skirtC = thighC = pk(['#c1121f', '#e63946', '#1d3557', '#2a9d8f', '#f4a261', '#222222', '#ffb4a2', '#6a4c93', '#f1faee']); jacket = false; longSl = rnd() < 0.2; sleeveless = !longSl && rnd() < 0.6;
          armC = longSl ? torsoC : skin; o.sk = rnd() < 0.2 ? 0.72 : 0.47;
        } else { // Rock in eigener Farbe; mit Jacke zur Hälfte Jeansjacke
          skirtC = thighC = pk(['#222222', '#3d405b', '#5e503f', '#8d99ae', '#bc4749', '#e9c46a', '#14213d', '#6b705c']); o.sk = 0.44;
          if (jacket && rnd() < 0.5) torsoC = armC = '#4a6fa5'; }
      } else if (arch === 5) { // langer Mantel: Rockteil in Mantelfarbe, vorn offen (Knopfleiste zeigt die Lage darunter)
        torsoC = armC = skirtC = thighC = pk(['#c8b79a', '#b9a583', '#3a3f4a', '#5b4636', '#2b2b2b', '#7d6b58', '#8a8f7a']); longSl = true; jacket = true; o.sk = 0.72; if (!fem) shorts = false;
      }
      if (adult && rnd() < (arch === 1 ? (fem ? 0.35 : 0.1) : 0.13)) aFace.setX(i, fem ? 5 : 4); // Sonnenbrille
      if (adult && !chat && arch !== 1 && rnd() < 0.02) { o.st = true; o.speed *= 0.82; } // Kinderwagen
      // Sitzplatz: by = Bankhöhe, tb = Knie über der Waagrechten (Unterschenkel senkrecht, Schuhe auf dem Podest, y = 0.155), ar = Armwinkel zur Tischplatte, lap = linke Hand im Schoß, gT / go = Takt der Trinkgeste
      if (adult && !isOut && !chat && !o.st && sitI < sits.length && ++elig % sitStride === 0) { const q = sits[sitI++]; o.state = 'sit'; o.x = q.x; o.z = q.z; o.yaw = q.yaw; o.by = q.y; o.cane = false; o.lk1 = q.lk1; o.lk2 = q.lk2; o.lph = q.lph; o.lap = q.lap; o.gT = q.gT; o.go = q.go; o.lp = 0; o.fp = false;
        const hip = q.y + 0.085 * o.s; o.tb = Math.asin(clamp((0.16 + 0.46 * o.s - hip) / (0.45 * o.s), 0, 0.4)); // Große: Knie etwas höher, damit die Schuhe auf dem Podest stehen
        o.ar = -Math.acos(clamp((hip + 0.57 * o.s - q.table - 0.03) / (0.62 * o.s), 0.2, 1)); }
      aStyle.setX(i, (longSl ? 1 : 0) + (shorts ? 2 : 0) + (jacket ? 4 : 0) + (lightShoe ? 8 : 0) + (sleeveless ? 16 : 0));
      o.sleeve = longSl ? (isVendor ? '#f1faee' : shirt) : skin;
      // Farben: die Jacke dunkelt das Oberteil im Shader auf 62 % ab, deshalb Wunschfarbe / 0.62; Ärmel in sichtbarer Jackenfarbe
      if (torsoC) this.im.torso.setColorAt(i, jacket ? c.set(torsoC).multiplyScalar(1 / 0.62) : c.set(torsoC));
      this.im.head.setColorAt(i, c.set(skin)); this.im.hair.setColorAt(i, c.set(hairC)); this.im.hair2.setColorAt(i, c.set(hairC)); this.im.hair3.setColorAt(i, c.set(hairC));
      c.set(thighC || pants); this.im.legL.setColorAt(i, c); this.im.legR.setColorAt(i, c); c.set(pants); this.im.shinL.setColorAt(i, c); this.im.shinR.setColorAt(i, c);
      if (armC) c.set(armC); else if (jacket && !isVendor) c.set(o.sleeve).multiplyScalar(0.62); else c.set(o.sleeve); this.im.armL.setColorAt(i, c); this.im.armR.setColorAt(i, c);
      this.im.skirt.setColorAt(i, c.set(skirtC || '#000000'));
      // Gang: gf = Schrittfrequenz (rad pro Meter), ga = Hüftausschlag, gb = Wippen, gk = Kniebeugung, g = geglättetes Gehgewicht 0..1 (Kinder: schneller, federnder)
      o.gf = kid ? 7.6 : 5.4 / o.s; o.ga = kid ? 0.5 : 0.36 + 0.07 * o.speed; o.gb = kid ? 0.048 : 0.035; o.gk = kid ? 1.0 : 0.9; o.g = 0;
      if (arch === 1) { o.ga = 0.3; o.gf = 7.4 / o.s; o.gb = 0.022; o.gk = 0.7; } // kurze, flache Schritte
      else if (o.sk) { const k = o.sk > 0.6 ? 0.9 : 0.85; o.ga *= k; o.gf /= k; } // im Rock etwas kürzere Schritte
      this.a.push(o);
    }
    for (const m of Object.values(this.im)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.grid = new Map(); this.frame = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._z = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  /** Anzahl sichtbarer Besucher (Optionen) */
  setActive(n) { const v = (this.G.vendors || []).length; this.active = Math.min(this.a.length, Math.max(v, Math.round(n) + v)); for (const m of Object.values(this.im)) m.count = this.active; }
  update(dt, player) {
    const G = this.G, nodes = this.nodes; this.frame++; const N = this.active ?? this.a.length;
    // räumliches Raster für Abstand halten
    const grid = this.grid; grid.clear(); const cs = 2;
    for (let i = 0; i < N; i++) { const o = this.a[i]; if (o.state === 'sit') continue; const k = Math.floor(o.x / cs) * 73856 + Math.floor(o.z / cs); let arr = grid.get(k); if (!arr) grid.set(k, arr = []); arr.push(i); }
    const px = player.pos.x, pz = player.pos.z; const crowdFactor = G.crowdFactor ?? 1; const camP = G.camera.position; const cut = 85 * (G.settings.drawDist || 1); const cut2 = cut * cut;
    for (let i = 0; i < N; i++) {
      const o = this.a[i]; let moving = 0;
      if (o.state === 'walk') {
        if (o.idle > 0) { o.idle -= dt; }
        else {
          const A = nodes[o.from], B = nodes[o.to]; const wHalf = (B.w || 6) * 0.38;
          const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz) || 1; const nx = -dz / len, nz = dx / len;
          const tx = B.x + nx * o.ofs * wHalf * 2, tz = B.z + nz * o.ofs * wHalf * 2;
          let vx = tx - o.x, vz = tz - o.z; const d = Math.hypot(vx, vz);
          if (d < 1.2) { const nb = B.n.filter(n => n !== o.from); o.from = o.to; o.to = nb.length && rand() < 0.93 ? pick(nb) : pick(B.n); o.ofs = clamp(o.ofs + R(-0.3, 0.3), -0.5, 0.5); if (rand() < 0.12) { o.idle = R(2, 9); o.yaw += R(-2, 2); } }
          else { vx /= d; vz /= d;
            // Abstand zu Nachbarn
            const k0x = Math.floor(o.x / cs), k0z = Math.floor(o.z / cs); let sx = 0, sz = 0;
            for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const arr = grid.get((k0x + a) * 73856 + k0z + b); if (!arr) continue; for (const j of arr) { if (j === i) continue; const q = this.a[j]; const ex = o.x - q.x, ez = o.z - q.z, e2 = ex * ex + ez * ez; if (e2 < 0.7 && e2 > 1e-4) { const e = Math.sqrt(e2); sx += ex / e * (0.84 - e); sz += ez / e * (0.84 - e); } } }
            const pdx = o.x - px, pdz = o.z - pz, pd = Math.hypot(pdx, pdz); if (pd < 1.6 && pd > 0.01) { sx += pdx / pd * (1.6 - pd) * 2; sz += pdz / pd * (1.6 - pd) * 2; }
            const sp = o.speed * (0.75 + 0.25 * crowdFactor);
            o.x += (vx * sp + sx * 2) * dt; o.z += (vz * sp + sz * 2) * dt; moving = sp;
            const ty = Math.atan2(vx, vz); let dy = ty - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 6);
          }
        }
      } else if (o.state === 'out') {
        o.sp += o.speed * dt * o.dir; if (o.sp > o.road.tot) { o.sp = o.road.tot; o.dir = -1; } if (o.sp < 0) { o.sp = 0; o.dir = 1; }
        const r = {}; alongPath(o.road.pts, o.road.lens, o.sp, r); const off = (o.road.w / 2 + 1.4) * o.side; o.x = r.x + Math.sin(r.ang) * off; o.z = r.z + Math.cos(r.ang) * off; o.yaw = r.ang + (o.dir > 0 ? Math.PI / 2 : -Math.PI / 2); moving = o.speed;
      }
      // Instanz-Matrizen
      const cdx = o.x - camP.x, cdz = o.z - camP.z, d2 = cdx * cdx + cdz * cdz;
      // Detailstufen: weit weg -> unsichtbar, mittel -> nur jedes 3. Bild aktualisieren
      if (d2 > cut2) { if (!o.hid) { o.hid = true; o.lp = 0; o.fp = false; this.hide(i); } continue; }
      if (o.hid) o.hid = false; else if (d2 > 1600 && (this.frame + i) % 3 !== 0) continue;
      let s = o.s; if (d2 < 3.2 && camP.y < 3) s = 0.0001;
      if (o.state === 'sit') { this.sit(i, o, s, d2 > 1600, G.time); continue; }
      // Gang: Phase läuft mit der Strecke, g blendet weich zwischen Stehen und Gehen
      const far = d2 > 1600, kt = far ? 3 : 1; o.ph += dt * moving * o.gf * kt; o.g += (Math.min(1, moving) - o.g) * Math.min(1, dt * 7 * kt); const g = o.g;
      const sn = Math.sin(o.ph), cn = Math.cos(o.ph), sw = sn * o.ga * g;
      const bob = (Math.abs(cn) - 1) * o.gb * g; // Hüfte sinkt im Doppelstand, höchster Punkt über dem Standbein
      const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw); const m = this._m;
      const w = o.w || 1, sw_ = s * w, stat = o.state === 'static';
      // nah: Oberkörper dreht gegen die Beine und neigt sich leicht vor; im Stehen Gewichtsverlagerung, Kopf schaut sich um, Spielbein locker
      let tw = 0, lean = o.ln, lat = 0, roll = 0, hyaw = o.yaw, relL = 0, relR = 0, aIdle = 0, kL = 0, kR = 0;
      if (!far) {
        tw = o.st ? 0 : sn * 0.09 * g; lean += 0.045 * g;
        const kb = sn * 0.3624 - cn * 0.932; // = sin(ph - 1.2): Kniebeugung beginnt mit dem Abheben der Ferse, Maximum kurz vor Schwungmitte
        kL = (0.05 + Math.max(0, kb) * o.gk) * g; kR = (0.05 + Math.max(0, -kb) * o.gk) * g;
        if (g < 0.95) { const iw = 1 - g, t = G.time, ws = Math.sin(t * 0.55 + i * 1.7);
          lat = ws * 0.024 * iw; roll = -lat / 0.91; aIdle = Math.sin(t * 0.8 + i) * 0.05 * iw;
          relL = Math.max(0, ws - 0.3) * 0.2 * iw; relR = Math.max(0, -ws - 0.3) * 0.2 * iw; kL += relL * 2; kR += relR * 2;
          // Plaudergruppe: Kopf dreht sich abwechselnd zu den beiden Nachbarn, sonst langsames Umschauen
          if (o.state === 'chat') { const u = Math.sin(t * 0.33 + o.lph) * 3; hyaw += (o.lk1 * Math.max(0, Math.min(1, u - 1.5)) + o.lk2 * Math.max(0, Math.min(1, -u - 1.5))) * iw; } else hyaw += Math.sin(t * 0.23 + i * 2.3) * 0.3 * iw; }
      }
      const bx = o.x + cy * lat * s, bz = o.z - sy * lat * s; // Becken seitlich verschoben, Füße bleiben stehen (roll)
      const tf = lean * 0.36 * s; // Neigung um die Hüfte: Unterkante des Oberkörpers bleibt über dem Becken
      this.set('torso', i, bx + sy * tf, (1.32 + bob) * s, bz + cy * tf, lean, o.yaw + tw, s, w, lat * 0.8);
      this.set('blob', i, o.x, 0.075, o.z, 0, 0, s * w);
      const hf = lean * 0.8 * s; this.set('head', i, bx + sy * hf, (1.76 + bob) * s, bz + cy * hf, 0, hyaw, s);
      // Haare: gleiche Matrix wie der Kopf, die beiden anderen Frisuren auf Null
      const hk = o.hairK, zm = this._z; this.im.hair.setMatrixAt(i, hk === 0 ? m : zm); this.im.hair2.setMatrixAt(i, hk === 2 ? m : zm); this.im.hair3.setMatrixAt(i, hk === 1 ? m : zm);
      // Beine: Oberschenkel an der Hüfte, Unterschenkel am Kniepunkt
      const hy = (0.93 + bob) * s, hx = cy * 0.095 * sw_, hz = sy * 0.095 * sw_;
      this.leg('legL', 'shinL', i, bx - hx, hy, bz + hz, sw - 0.05 * g - relL, kL, roll, cy, sy, o.yaw, s, w, far);
      this.leg('legR', 'shinR', i, bx + hx, hy, bz - hz, -sw - 0.05 * g - relR, kR, roll, cy, sy, o.yaw, s, w, far);
      // Arme gegenläufig zu den Beinen, leicht nach vorn (Ellbogen); Schultern folgen der Oberkörperdrehung
      const c2 = cy - tw * sy, s2 = sy + tw * cy, ax = c2 * 0.235 * sw_, az = s2 * 0.235 * sw_, af = lean * 0.56 * s, ay = (1.52 + bob) * s;
      const ab = -0.05 - 0.1 * g; let rL = -sw * 0.8 + ab + aIdle, rR = sw * 0.8 + ab - aIdle;
      if (stat) rL = rR = -0.4 - Math.sin(G.time * 2 + i) * 0.2; else if (o.st) rL = rR = -0.52; else if (o.cane) rR = sw * 0.5 - 0.15 - 0.07 * g;
      const sRx = bx + ax + sy * af, sRz = bz - az + cy * af;
      this.set('armL', i, bx - ax + sy * af, ay, bz + az + cy * af, rL, o.yaw + tw, s);
      this.set('armR', i, sRx, ay, sRz, rR, o.yaw + tw, s);
      // Rockteil am Becken: Saum weitet sich mit dem Schritt, leichtes Schwingen (nur nah)
      if (o.sk) this.put('skirt', i, bx, (1.02 + bob) * s, bz, far ? 0 : cn * 0.04 * g, o.yaw - tw * 0.5, sw_, s * o.sk, sw_ * (1 + 0.75 * Math.abs(sw)), lat * 0.4);
      // Gehstock: Griff in der rechten Hand, Länge so gestreckt, dass die Spitze am Boden steht (beim Vorschwingen leicht angehoben)
      if (o.cane) { const ca = -0.06 + sn * 0.13 * g, r2 = rR * rR, hY = ay - 0.62 * (1 - r2 / 2) * s, hF = (0.035 - 0.62 * rR * (1 - r2 / 6)) * s, lift = Math.max(0, -cn) * 0.06 * g * s;
        this.put('cane', i, sRx + sy * hF, hY, sRz + cy * hF, ca, o.yaw, s, (hY - lift) / (0.9 * (1 - ca * ca / 2)), s); }
      // Kinderwagen vor der Person, Griff in den Händen
      if (o.st) { const D = 0.845 * o.s; this.put('stroller', i, o.x + sy * D, 0, o.z + cy * D, 0, o.yaw, o.s, o.s, o.s); }
    }
    for (const m of Object.values(this.im)) m.instanceMatrix.needsUpdate = true;
  }
  hide(i) { this._m.makeScale(0, 0, 0); for (const m of Object.values(this.im)) m.setMatrixAt(i, this._m); }
  set(k, i, x, y, z, rx, ry, s, w = 1, rz = 0) { this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e); this._m.compose(this._p.set(x, y, z), this._q, this._s.set(s * w, s, s * w)); this.im[k].setMatrixAt(i, this._m); }
  /** Sitzender Gast: Becken auf der Bank, Oberschenkel waagrecht zum Tisch, Unterschenkel senkrecht bis aufs Podest, Hände auf dem Tisch (oder links im Schoß).
   * Beine, Rock und Schatten werden nur einmal geschrieben (lp merkt die Skalierung), fern auch der Oberkörper (fp). Nah: leichtes Wiegen, Kopf zu den Tischnachbarn, Trinkgeste. */
  sit(i, o, s, far, t) {
    const zm = this._z, yaw = o.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw), w = o.w || 1, sw_ = s * w, x = o.x, z = o.z, hy = o.by + 0.085 * s;
    if (o.lp !== s) { o.lp = s; const hx = cy * 0.095 * sw_, hz = sy * 0.095 * sw_;
      this.leg('legL', 'shinL', i, x - hx, hy, z + hz, -1.5708 - o.tb, 1.5708 + o.tb, 0, cy, sy, yaw, s, w, false);
      this.leg('legR', 'shinR', i, x + hx, hy, z - hz, -1.5708 - o.tb, 1.5708 + o.tb, 0, cy, sy, yaw, s, w, false);
      // Rock / Mantel liegt gekürzt über den Oberschenkeln; kein Bodenschatten (Podest unter Dach)
      if (o.sk) this.put('skirt', i, x - sy * 0.03 * s, hy + 0.02 * s, z - cy * 0.03 * s, -1.5708, yaw, sw_, s * Math.min(o.sk, 0.47) * 0.92, sw_ * 0.85);
      this.im.blob.setMatrixAt(i, zm); }
    if (far) { if (o.fp) return; o.fp = true; } else o.fp = false;
    let lean = 0.08, rz = 0, hyaw = yaw, e = 0;
    if (!far) { const sw1 = Math.sin(t * 0.4 + i * 1.7), u = Math.sin(t * 0.27 + o.lph) * 3; lean += sw1 * 0.025; rz = sw1 * 0.015;
      hyaw += o.lk1 * Math.max(0, Math.min(1, u - 1.5)) + o.lk2 * Math.max(0, Math.min(1, -u - 1.5));
      const q = (t + o.go) % o.gT; if (q < 1.8) { const k = q / 1.8; e = Math.min(1, 5 * k * (1 - k)); } } // Trinkgeste: 1.8 s alle gT Sekunden
    const tf = lean * 0.36 * s, hf = lean * 0.8 * s, af = lean * 0.56 * s;
    this.set('torso', i, x + sy * tf, hy + 0.37 * s, z + cy * tf, lean, yaw, s, w, rz);
    this.set('head', i, x + sy * hf, hy + 0.81 * s, z + cy * hf, 0, hyaw, s);
    const hk = o.hairK, m = this._m; this.im.hair.setMatrixAt(i, hk === 0 ? m : zm); this.im.hair2.setMatrixAt(i, hk === 2 ? m : zm); this.im.hair3.setMatrixAt(i, hk === 1 ? m : zm);
    const ax = cy * 0.235 * sw_, az = sy * 0.235 * sw_, ay = hy + 0.57 * s, fx = sy * af, fz = cy * af;
    this.set('armL', i, x - ax + fx, ay, z + az + fz, o.lap ? -0.55 : o.ar, yaw, s);
    // rechte Hand zum Mund: der starre Arm wird dabei verkürzt (ersetzt den gebeugten Ellbogen) und nach innen gedreht
    if (e > 0) this.put('armR', i, x + ax + fx, ay, z - az + fz, o.ar + (-2.16 - o.ar) * e, yaw - 0.38 * e, s, s * (1 - 0.38 * e), s);
    else this.set('armR', i, x + ax + fx, ay, z - az + fz, o.ar, yaw, s);
  }
  /** wie set(), aber mit freier Skalierung je Achse (Rock, Stock, Kinderwagen) */
  put(k, i, x, y, z, rx, ry, sx, sy, sz, rz = 0) { this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e); this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx, sy, sz)); this.im[k].setMatrixAt(i, this._m); }
  /** Zweiteiliges Bein: a = Hüftwinkel (+ = nach hinten), k = Kniebeugung (>= 0, Fuß nach hinten), rz = seitliche Neigung (klein). Kniepunkt = Hüfte + Ry(yaw)·Rx(a)·Rz(rz)·(0, -0.45 s, 0) */
  leg(kT, kS, i, x, y, z, a, k, rz, cy, sy, yaw, s, w, far) {
    let sa, ca; if (far) { const a2 = a * a; sa = a * (1 - a2 / 6); ca = 1 - a2 / 2; } else { sa = Math.sin(a); ca = Math.cos(a); }
    const l = 0.45 * s, lx = l * rz, lz = -l * sa;
    this.set(kT, i, x, y, z, a, yaw, s, w, rz);
    this.set(kS, i, x + lx * cy + lz * sy, y - l * ca, z - lx * sy + lz * cy, a + k, yaw, s, w, rz);
  }
  /** nächster Knoten zu einer Weltposition */
  nearestNode(x, z) { let b = 0, bd = 1e9; this.nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; }
  /** Kürzester Weg (BFS) zwischen Knoten */
  path(a, b) { const prev = new Map([[a, -1]]); const q = [a]; while (q.length) { const c = q.shift(); if (c === b) break; for (const n of this.nodes[c].n) if (!prev.has(n)) { prev.set(n, c); q.push(n); } } if (!prev.has(b)) return [b]; const out = []; let c = b; while (c !== -1) { out.unshift(c); c = prev.get(c); } return out; }
}
