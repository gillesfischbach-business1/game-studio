// Menschen: Spielfigur-Modell, Besuchermenge (instanziert), Verkäufer, Lämmy, Schafe
import * as THREE from 'three';
import { LANES, L, toLocal, ROADS } from './data.js';
import { M, Glow, R, RI, pick, rand, clamp } from './util.js';
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
function lathe(profile, seg = 12, sz = 1) { const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); if (sz !== 1) g.scale(1, 1, sz); return g; }
function vcol(geo, fn) { const p = geo.attributes.position; const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
const W1 = [1, 1, 1];
/** Oberkörper (Hemd) relativ zur Brustmitte, inkl. kurzer Ärmel */
export function torsoGeo() {
  const t = lathe([[0.001, -0.36], [0.165, -0.35], [0.158, -0.22], [0.15, -0.12], [0.165, 0.02], [0.185, 0.13], [0.19, 0.19], [0.16, 0.25], [0.085, 0.29], [0.06, 0.31], [0.001, 0.31]], 10, 0.64);
  const parts = [t.toNonIndexed()];
  for (const sx of [-1, 1]) { const s = new THREE.CylinderGeometry(0.068, 0.062, 0.16, 7); s.rotateZ(sx * 0.35); s.translate(sx * 0.205, 0.16, 0); parts.push(s.toNonIndexed()); const c = new THREE.SphereGeometry(0.07, 7, 5); c.translate(sx * 0.19, 0.22, 0); parts.push(c.toNonIndexed()); }
  for (const p of parts) p.deleteAttribute('uv');
  return BGU.mergeGeometries(parts);
}
/** Bein (Hose) mit Schuh; Drehpunkt an der Hüfte, Länge ~0.9 */
export function legGeo() {
  const l = lathe([[0.001, 0.06], [0.09, 0.05], [0.1, -0.05], [0.085, -0.3], [0.066, -0.45], [0.07, -0.55], [0.058, -0.75], [0.05, -0.84], [0.001, -0.86]], 7);
  const shoe = new THREE.BoxGeometry(0.1, 0.07, 0.25); shoe.translate(0, -0.875, 0.05);
  const g = BGU.mergeGeometries([l.toNonIndexed(), shoe.toNonIndexed()].map(x => { x.deleteAttribute('uv'); return x; }));
  return vcol(g, (x, y) => y < -0.84 ? [0.13, 0.13, 0.14] : W1);
}
/** Arm (Haut) mit Hand; Drehpunkt an der Schulter */
export function armGeo() {
  const a = lathe([[0.001, 0.02], [0.05, 0.0], [0.048, -0.22], [0.04, -0.3], [0.038, -0.5], [0.03, -0.56], [0.001, -0.57]], 6);
  const hand = new THREE.SphereGeometry(0.045, 6, 4); hand.scale(0.8, 1.2, 0.55); hand.translate(0, -0.62, 0.01);
  return BGU.mergeGeometries([a.toNonIndexed(), hand.toNonIndexed()].map(x => { x.deleteAttribute('uv'); return x; }));
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
    const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.5 }); const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.5, map: faceTex() }); const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
    const hairs = [hairGeo(0), hairGeo(1), hairGeo(2)];
    this.im = {}; for (const [k, geo, mat] of [['torso', torsoGeo(), clothT], ['head', headGeo(), faceMat], ['hair', hairs[0], hairMat], ['hair2', hairs[2], hairMat], ['legL', legGeo(), cloth], ['legR', legGeo(), cloth], ['armL', armGeo(), skinMat], ['armR', armGeo(), skinMat]]) { const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; G.scene.add(m); this.im[k] = m; }
    const c = new THREE.Color();
    this.a = [];
    const nOut = Math.round(count * 0.1); const vendors = G.vendors || [];
    for (let i = 0; i < count; i++) {
      const isVendor = i < vendors.length; const isOut = !isVendor && i < vendors.length + nOut;
      const kid = !isVendor && rand() < 0.12; const s = kid ? R(0.55, 0.7) : R(0.88, 1.1);
      const shirt = pick(SHIRTS), pants = pick(PANTS), skin = pick(SKINS), hairC = pick(HAIR);
      const o = { s, kid, ph: R(0, 6), speed: kid ? R(1.1, 1.6) : R(0.9, 1.45), state: 'walk', x: 0, z: 0, yaw: 0, ofs: R(-0.4, 0.4), idle: 0 };
      if (isVendor) { const vd = vendors[i]; const w = L(vd.u, vd.v); o.x = w.x; o.z = w.z; o.yaw = vd.ry + G.FAIR.theta; o.state = 'static'; o.s = R(0.95, 1.05); this.im.torso.setColorAt(i, c.set(vd.color === '#ffffff' ? '#f1faee' : '#ffffff')); }
      else if (isOut) { o.state = 'out'; o.road = pick(this.walkRoads); o.sp = R(0, o.road.tot); o.dir = rand() < 0.5 ? 1 : -1; o.side = rand() < 0.5 ? 1 : -1; this.im.torso.setColorAt(i, c.set(shirt)); }
      else { const ni = RI(0, nodes.length - 1); const nd = nodes[ni]; o.from = ni; o.to = pick(nd.n.length ? nd.n : [ni]); o.x = nd.x + R(-2, 2); o.z = nd.z + R(-2, 2); o.t = rand(); this.im.torso.setColorAt(i, c.set(shirt)); }
      this.im.head.setColorAt(i, c.set(skin)); this.im.hair.setColorAt(i, c.set(hairC)); this.im.hair2.setColorAt(i, c.set(hairC)); this.im.legL.setColorAt(i, c.set(pants)); this.im.legR.setColorAt(i, c.set(pants));
      this.im.armL.setColorAt(i, c.set(skin)); this.im.armR.setColorAt(i, c.set(skin)); o.long = rand() < 0.4;
      this.a.push(o);
    }
    for (const m of Object.values(this.im)) m.instanceColor.needsUpdate = true;
    this.grid = new Map(); this.frame = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  /** Anzahl sichtbarer Besucher (Optionen) */
  setActive(n) { const v = (this.G.vendors || []).length; this.active = Math.min(this.a.length, Math.max(v, Math.round(n) + v)); for (const m of Object.values(this.im)) m.count = this.active; }
  update(dt, player) {
    const G = this.G, nodes = this.nodes; this.frame++; const N = this.active ?? this.a.length;
    // räumliches Raster für Abstand halten
    const grid = this.grid; grid.clear(); const cs = 2;
    for (let i = 0; i < N; i++) { const o = this.a[i]; const k = Math.floor(o.x / cs) * 73856 + Math.floor(o.z / cs); let arr = grid.get(k); if (!arr) grid.set(k, arr = []); arr.push(i); }
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
      if (d2 > cut2) { if (!o.hid) { o.hid = true; this.hide(i); } continue; }
      if (o.hid) o.hid = false; else if (d2 > 1600 && (this.frame + i) % 3 !== 0) continue;
      let s = o.s; if (d2 < 3.2 && camP.y < 3) s = 0.0001; o.ph += dt * moving * 5.4 * (d2 > 1600 ? 3 : 1); const sw = Math.sin(o.ph) * 0.5 * Math.min(1, moving);
      const bob = Math.abs(Math.cos(o.ph)) * 0.03 * Math.min(1, moving);
      const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw); const m = this._m;
      this.set('torso', i, o.x, (1.32 + bob) * s, o.z, 0, o.yaw, s);
      this.set('head', i, o.x, (1.76 + bob) * s, o.z, 0, o.yaw, s);
      this.set('hair', i, o.x, (1.76 + bob) * s, o.z, 0, o.yaw, o.long ? 0.0001 : s);
      this.set('hair2', i, o.x, (1.76 + bob) * s, o.z, 0, o.yaw, o.long ? s : 0.0001);
      this.set('legL', i, o.x - cy * 0.095 * s, (0.93 + bob) * s, o.z + sy * 0.095 * s, sw, o.yaw, s);
      this.set('legR', i, o.x + cy * 0.095 * s, (0.93 + bob) * s, o.z - sy * 0.095 * s, -sw, o.yaw, s);
      const armSw = o.state === 'static' ? -0.4 - Math.sin(G.time * 2 + i) * 0.2 : -sw * 0.8;
      this.set('armL', i, o.x - cy * 0.235 * s, (1.52 + bob) * s, o.z + sy * 0.235 * s, armSw, o.yaw, s);
      this.set('armR', i, o.x + cy * 0.235 * s, (1.52 + bob) * s, o.z - sy * 0.235 * s, o.state === 'static' ? armSw : sw * 0.8, o.yaw, s);
    }
    for (const m of Object.values(this.im)) m.instanceMatrix.needsUpdate = true;
  }
  hide(i) { this._m.makeScale(0, 0, 0); for (const m of Object.values(this.im)) m.setMatrixAt(i, this._m); }
  set(k, i, x, y, z, rx, ry, s) { this._e.set(rx, ry, 0, 'YXZ'); this._q.setFromEuler(this._e); this._m.compose(this._p.set(x, y, z), this._q, this._s.set(s, s, s)); this.im[k].setMatrixAt(i, this._m); }
  /** nächster Knoten zu einer Weltposition */
  nearestNode(x, z) { let b = 0, bd = 1e9; this.nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; }
  /** Kürzester Weg (BFS) zwischen Knoten */
  path(a, b) { const prev = new Map([[a, -1]]); const q = [a]; while (q.length) { const c = q.shift(); if (c === b) break; for (const n of this.nodes[c].n) if (!prev.has(n)) { prev.set(n, c); q.push(n); } } if (!prev.has(b)) return [b]; const out = []; let c = b; while (c !== -1) { out.unshift(c); c = prev.get(c); } return out; }
}
