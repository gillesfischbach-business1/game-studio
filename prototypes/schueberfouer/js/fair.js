// Kirmesgelände: Haupttor E1, Zaun, Stände, Brasserie, Deko, Lichtteppich
import * as THREE from 'three';
import { FAIR, L, toLocal, GLACIS_POLY, STALL_TYPES, LANES, GATE, ENTRANCES, RIDES, EXTRA_RIDES, RESTAURANTS, RESTO_ROW, FOOTPRINT, STALL_MIX, STALL_FIXED } from './data.js';
import { pointInPoly, distSeg } from './util.js';
import { pbr, loadTex } from './tex.js';
import { Batcher, Bulbs, M, Glow, R, RI, pick, rand, canvasTex, signTex, euro } from './util.js';

export function buildFair(G) {
  const { scene, colliders } = G;
  const root = new THREE.Group(); root.position.set(FAIR.C.x, 0, FAIR.C.z); root.rotation.y = FAIR.theta; scene.add(root);
  G.fairRoot = root;
  const B = new Batcher(); const bulbs = new Bulbs();
  const glow = new GlowPainter();
  G.glow = glow;

  /** Collider in lokalen Kirmes-Koordinaten (u,v), Box mit halber Größe hu,hv und Zusatzdrehung ry */
  G.fairBox = (u, v, hu, hv, ry = 0, tag) => { const w = L(u, v); colliders.box(w.x, w.z, hu, hv, FAIR.theta + ry, tag); };
  G.fairCircle = (u, v, r, tag) => { const w = L(u, v); colliders.circle(w.x, w.z, r, tag); };

  // ---------------- Zaun (Bauzaun) entlang des Glacis, mit Eingängen ----------------
  const gateW = L(GATE.u, GATE.v);
  const sideEntrances = [L(-108, -25), L(-112, 8), L(-104, 8), { x: -60, z: -30 }, { x: -125, z: 112 }];
  const fenceB = new Batcher(); G.fenceB = fenceB;
  const postMat = M('#7b8288', { metalness: 0.7, roughness: 0.4 });
  const meshMat = new THREE.MeshStandardMaterial({ color: '#9aa1a6', metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < GLACIS_POLY.length; i++) {
    const a = GLACIS_POLY[i], b = GLACIS_POLY[(i + 1) % GLACIS_POLY.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    const n = Math.max(1, Math.round(len / 3.5));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n; const mx = a[0] + dx * (t0 + t1) / 2, mz = a[1] + dz * (t0 + t1) / 2;
      if (Math.hypot(mx - gateW.x, mz - gateW.z) < 16) continue;
      if (sideEntrances.some(e => Math.hypot(mx - e.x, mz - e.z) < 7)) continue;
      const pl = len / n;
      fenceB.add(new THREE.PlaneGeometry(pl, 2), meshMat, mx, 1.1, mz, 0, ang);
      B.add(new THREE.BoxGeometry(0.06, 2.1, 0.06), postMat, a[0] + dx * t0, 1.05, a[1] + dz * t0);
      B.add(new THREE.BoxGeometry(0.7, 0.15, 0.25), M('#d4d4d4'), a[0] + dx * t0, 0.08, a[1] + dz * t0, 0, ang);
      colliders.box(mx, mz, pl / 2, 0.15, ang, 'fence');
    }
  }

  fenceB.build(scene);

  // ---------------- Haupttor E1 mit dem echten Tor-Motiv 2026 ----------------
  {
    const phi = Math.atan2(18, 9); const g = new THREE.Group(); const p = L(GATE.u, GATE.v); g.position.set(p.x, 0, p.z); g.rotation.y = FAIR.theta + phi; scene.add(g);
    const tex = new THREE.TextureLoader().load('assets/tor2026.jpg'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const panelMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.6, side: THREE.DoubleSide });
    G.gatePanelMat = panelMat;
    const W = 27, H = 14.5, Y = 6;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), panelMat); panel.position.y = Y + H / 2; g.add(panel);
    const steel = M('#9aa0a5', { metalness: 0.8, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      const px = sx * (W / 2 - 3.2);
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, Y + H + 2, 1.4), steel); col.position.set(px, (Y + H + 2) / 2, -0.8); col.castShadow = true; g.add(col);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 3), M('#5c6166')); foot.position.set(px, 0.3, -0.8); g.add(foot);
      G.fairBox(GATE.u + Math.cos(phi) * (px) - Math.sin(phi) * 0.8 * 0, GATE.v - Math.sin(phi) * px, 1.6, 1.6, phi, 'gate');
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 0.6, 0.6), steel); beam.position.set(0, Y - 0.3, -0.8); g.add(beam);
    // Lichterkette rund ums Tor
    const gb = new Bulbs();
    gb.line([-W / 2, Y, 0.1], [W / 2, Y, 0.1], 0.5, i => ['#ffd166', '#ff4d6d', '#4cc9f0'][i % 3], 1);
    gb.line([-W / 2, Y, 0.1], [-W / 2, Y + H, 0.1], 0.5, '#ffd166', 1); gb.line([W / 2, Y, 0.1], [W / 2, Y + H, 0.1], 0.5, '#ffd166', 1);
    gb.line([-W / 2, Y + H, 0.1], [W / 2, Y + H, 0.1], 0.5, i => ['#ffd166', '#ff4d6d', '#4cc9f0'][i % 3], 1);
    gb.build(g);
    const spot = new THREE.SpotLight('#fff1d0', 60, 40, 0.6, 0.5); spot.position.set(0, 2, 14); spot.target = panel; g.add(spot);
    glow.paint(GATE.u - 6, GATE.v - 3, '#ffcf80', 16, 0.6);
  }

  // ---------------- Stände: automatisch entlang der Alleen verteilt ----------------
  const foot = [];
  for (const r of Object.values(RIDES)) foot.push({ u: r.u, v: r.v, ...FOOTPRINT[r.type] });
  for (const r of EXTRA_RIDES) foot.push({ u: r.u, v: r.v, ...FOOTPRINT[r.style + (r.small ? '_small' : '')] || FOOTPRINT[r.style] });
  for (const r of RESTAURANTS) foot.push({ u: r.u, v: RESTO_ROW.v, hu: RESTO_ROW.w / 2, hv: RESTO_ROW.d / 2 });
  G.footprints = foot;
  const overlaps = (u, v, hu, hv, m = 0.8) => foot.some(f => f.r ? (Math.max(Math.abs(u - f.u) - hu, 0) ** 2 + Math.max(Math.abs(v - f.v) - hv, 0) ** 2 < (f.r + m) ** 2)
    : (Math.abs(u - f.u) < hu + f.hu + m && Math.abs(v - f.v) < hv + f.hv + m));
  const onLane = (u, v, own, pad) => LANES.some(l => l !== own && distSeg(u, v, l.a[0], l.a[1], l.b[0], l.b[1]) < l.w / 2 + pad);
  const inFair = (u, v, m) => { for (const [du, dv] of [[-m, -m], [m, -m], [-m, m], [m, m]]) { const w = L(u + du, v + dv); if (!pointInPoly(w.x, w.z, GLACIS_POLY)) return false; } return true; };
  const nearEntrance = (u, v) => ENTRANCES.some(e => Math.hypot(e.u - u, e.v - v) < 9);
  const plan = STALL_FIXED.map(([u, v, t, f]) => ({ u, v, type: t, facing: f, w: 7, horiz: true }));
  for (const p of plan) foot.push({ u: p.u, v: p.v, hu: 3.6, hv: 2.2 });
  let mixI = 0;
  for (const ln of LANES) {
    const [ua, va] = ln.a, [ub, vb] = ln.b; const len = Math.hypot(ub - ua, vb - va); if (len < 20) continue;
    const du = (ub - ua) / len, dv = (vb - va) / len; const horiz = Math.abs(du) > 0.9; if (!horiz && Math.abs(dv) < 0.9) continue;
    for (const side of [-1, 1]) for (let t = 5; t < len - 4; t += 7.6) {
      const off = ln.w / 2 + 2.4; const u = ua + du * t + (horiz ? 0 : side * off), v = va + dv * t + (horiz ? side * off : 0);
      const hu = horiz ? 3.6 : 2.2, hv = horiz ? 2.2 : 3.6;
      if (overlaps(u, v, hu, hv) || onLane(u, v, ln, horiz ? 2.4 : 2.4) || !inFair(u, v, 4) || nearEntrance(u, v)) continue;
      const type = STALL_MIX[mixI++ % STALL_MIX.length];
      plan.push({ u, v, type, horiz, facing: -side }); foot.push({ u, v, hu, hv });
    }
  }
  G.stalls = [];
  const awningTex = {}; const signMat = {};
  for (const P of plan) {
    const { u, v, type } = P; const T = STALL_TYPES[type]; const w = 7, d = 4.2, h = 3.1;
    if (!awningTex[type]) {
      { const at = canvasTex(128, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? T.c1 : T.c2; g.fillRect(i * 16, 0, 16, 32); } g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 24, 128, 8); }); const fn = loadTex('fabric_pattern_07_nor.jpg', false).clone(); fn.repeat.set(4, 1); fn.needsUpdate = true; awningTex[type] = new THREE.MeshStandardMaterial({ map: at, emissiveMap: at, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.85, normalMap: fn, normalScale: new THREE.Vector2(1.5, 1.5), side: THREE.DoubleSide }); }
      signMat[type] = new THREE.MeshBasicMaterial({ map: signTex(T.sign, { bg: '#120a1f', fg: T.c1, border: T.c2 }), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    }
    // Front (lokal +z) zeigt Richtung Allee
    const ry = P.horiz ? (P.facing > 0 ? 0 : Math.PI) : (P.facing > 0 ? Math.PI / 2 : -Math.PI / 2);
    const fu = P.horiz ? 0 : P.facing, fv = P.horiz ? P.facing : 0;
    const wall = pbr('wood', { tile: 1.6, color: T.c2 === '#ffffff' ? '#e6e9ee' : T.c2 });
    const b2 = B.at(u, 0, v, ry);
    b2.add(new THREE.BoxGeometry(w, h, 0.15), wall, 0, h / 2, -d / 2);
    b2.add(new THREE.BoxGeometry(0.15, h, d), wall, -w / 2, h / 2, 0); b2.add(new THREE.BoxGeometry(0.15, h, d), wall, w / 2, h / 2, 0);
    b2.add(new THREE.BoxGeometry(w, 1.05, 0.7), pbr('wood', { tile: 1.2, color: '#f2ead8' }), 0, 0.53, d / 2 - 0.35);
    b2.add(new THREE.BoxGeometry(w + 0.2, 0.08, 0.9), pbr('wood', { tile: 1, color: '#c98b55', roughness: 0.7 }), 0, 1.08, d / 2 - 0.35);
    b2.add(new THREE.BoxGeometry(w + 0.3, 0.12, d + 0.3), pbr('shutter', { tile: 1.5, color: '#6a6e74', metalness: 0.5 }), 0, h + 0.06, 0);
    b2.add(new THREE.PlaneGeometry(w + 0.6, 1.6), awningTex[type], 0, h - 0.25, d / 2 + 0.6, -1.0, 0, 0);
    b2.add(new THREE.BoxGeometry(w, 1.1, 0.12), signMat[type], 0, h + 0.75, d / 2 - 0.1);
    b2.add(new THREE.PlaneGeometry(w - 0.4, 2.0), Glow(T.c1, 0.55), 0, 2.0, -d / 2 + 0.1);
    decorateStall(b2, type, w, d, T);
    B.at(null);
    const sb = bulbs.at(u, 0, v, ry);
    sb.line([-w / 2, h + 1.33, d / 2 - 0.05], [w / 2, h + 1.33, d / 2 - 0.05], 0.35, '#fff1b8', RI(1, 3));
    sb.line([-w / 2, h + 0.17, d / 2 - 0.05], [w / 2, h + 0.17, d / 2 - 0.05], 0.35, T.c1, 1);
    bulbs.at(null);
    G.fairBox(u, v, w / 2, d / 2, ry, 'stall');
    glow.paint(u + fu * (d / 2 + 2), v + fv * (d / 2 + 2), T.c1, 9, 0.8); glow.paint(u + fu * (d / 2 + 1), v + fv * (d / 2 + 1), '#fff1c8', 5, 0.5);
    const front = L(u + fu * (d / 2 + 1.4), v + fv * (d / 2 + 1.4));
    const stall = { type, T, u, v, x: front.x, z: front.z, name: T.sign, need: T.need };
    G.stalls.push(stall);
    G.addInteract({ x: front.x, z: front.z, r: 2.6, kind: 'stall', need: T.need, ref: stall, label: () => T.game ? `${titleCase(T.sign)} – ${euro(G.price(T.price, 'game'))}` : T.info ? 'Info & Fonnbüro' : `${titleCase(T.sign)} – Menü`, icon: T.need });
    G.vendors = G.vendors || []; G.vendors.push({ u: u - fu * 0.8, v: v - fv * 0.8, ry: ry, color: T.c2 });
  }

  // ---------------- Restaurants (Gaststätten) entlang der Allée Scheffer ----------------
  for (const R0 of RESTAURANTS) buildRestaurant(G, root, glow, R0, B, bulbs);

  // ---------------- Lichtergirlanden über den Alleen, Masten, Mülleimer, Bänke ----------------
  for (const ln of LANES) {
    const [ua, va] = ln.a, [ub, vb] = ln.b; const len = Math.hypot(ub - ua, vb - va); const du = (ub - ua) / len, dv = (vb - va) / len;
    const nu = -dv, nv = du;
    for (let t = 6; t < len; t += 12) {
      const cu = ua + du * t, cv = va + dv * t;
      const p1 = [cu + nu * ln.w / 2, cv + nv * ln.w / 2], p2 = [cu - nu * ln.w / 2, cv - nv * ln.w / 2];
      for (const p of [p1, p2]) { B.add(new THREE.CylinderGeometry(0.07, 0.09, 6.2, 6), M('#3a3f45', { metalness: 0.6 }), p[0], 3.1, p[1]); }
      // durchhängende Girlande
      const N = 14; for (let k = 0; k <= N; k++) { const f = k / N; const sag = Math.sin(f * Math.PI) * 0.9; bulbs.add(p1[0] + (p2[0] - p1[0]) * f, 6 - sag, p1[1] + (p2[1] - p1[1]) * f, pick(['#ffd166', '#ff6b6b', '#4cc9f0', '#80ffdb', '#f72585']), k / 5, 2, 2.4); }
      if (ln.w > 7 && rand() < 0.5) { B.add(new THREE.CylinderGeometry(0.3, 0.27, 0.9, 10), M('#2f6f3e'), p1[0] - nu * 0.6, 0.45, p1[1] - nv * 0.6); G.fairCircle(p1[0] - nu * 0.6, p1[1] - nv * 0.6, 0.35); }
      glow.paint(cu, cv, '#ffd9a0', 9, 0.3);
    }
  }
  // Lichterbögen über den Alleen (typisch Kirmes)
  const archCols = [['#ffd166', '#ff4d6d'], ['#4cc9f0', '#f72585'], ['#80ffdb', '#ffbe0b'], ['#ffffff', '#ff006e']];
  const arch = (u, v0, v1, H, ci) => { const [c1, c2] = archCols[ci % archCols.length]; const mid = (v0 + v1) / 2, half = (v1 - v0) / 2;
    for (const vv of [v0, v1]) { B.add(new THREE.BoxGeometry(0.35, H, 0.35), M('#2b2d42', { metalness: 0.6 }), u, H / 2, vv); bulbs.line([u + 0.2, 0.4, vv], [u + 0.2, H, vv], 0.35, c1, 1); bulbs.line([u - 0.2, 0.4, vv], [u - 0.2, H, vv], 0.35, c1, 1); }
    for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40; const vv = mid - Math.cos(a) * half, y = H + Math.sin(a) * half * 0.55; bulbs.add(u + 0.2, y, vv, i % 2 ? c1 : c2, i / 7, 1, 2.8); bulbs.add(u - 0.2, y, vv, i % 2 ? c2 : c1, i / 7 + 0.5, 1, 2.8);
      if (i % 4 === 0) bulbs.add(u, y - 0.5, vv, '#ffffff', i / 5, 3, 3); }
    for (let k = 1; k < 6; k++) { const a = Math.PI * k / 6; bulbs.line([u, H, mid - Math.cos(a) * half * 0.2], [u, H + Math.sin(a) * half * 0.55 - 0.1, mid - Math.cos(a) * half], 0.5, c2, 2, 2.8); }
    glow.paint(u, mid, c1, half + 4, 0.35); };
  let ai = 0;
  for (let u = -100; u <= 70; u += 24) arch(u, LANES[1].a[1] - 4.3, LANES[1].a[1] + 4.3, 6.5, ai++);
  for (let u = -96; u <= 70; u += 32) arch(u, LANES[0].a[1] - 3.8, LANES[0].a[1] + 3.8, 5.5, ai++);
  for (let u = -92; u <= 80; u += 32) arch(u, LANES[2].a[1] - 3.8, LANES[2].a[1] + 3.8, 5.5, ai++);

  // Wimpelketten (Fähnchen) über der Haaptallee
  {
    const flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.5, 3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 400);
    let n = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let u = -78; u < 110 && n < 390; u += 0.7) { const y = 7.4 - Math.abs(Math.sin(u * 0.26)) * 0.8; const p = new THREE.Vector3(u, y, 8);
      q.setFromEuler(new THREE.Euler(Math.PI, 0, 0)); m.compose(p, q, new THREE.Vector3(1, 1, 1)); flags.setMatrixAt(n, m); flags.setColorAt(n, c.set(['#ed2939', '#ffffff', '#00a1de'][n % 3])); n++; }
    flags.count = n; root.add(flags);
    for (let u = -78; u < 110; u += 24) B.add(new THREE.CylinderGeometry(0.05, 0.05, 7.6, 5), M('#555'), u, 3.8, 3.6 + 0.0);
  }
  // Abschluss erst nach den Attraktionen (die ihre Kassen in denselben Batch legen)
  G.fairBatch = B; G.fairBulbs = bulbs;
  G.finishFair = () => { B.build(root, { cell: 150 }); bulbs.build(root); G.glowMat = glow.build(root); };
}


function buildRestaurant(G, root, glow, R0, B, bulbs) {
  const u = R0.u, v = RESTO_ROW.v, w = RESTO_ROW.w, d = RESTO_ROW.d;
  const g = new THREE.Group(); g.position.set(u, 0, v); root.add(g); // Front zeigt auf +v (Nordallee)
  const b2 = B.at(u, 0, v, 0);
  const tentTex = canvasTex(256, 64, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#ffffff' : R0.c; c.fillRect(i * 16, 0, 16, 64); } });
  const fn = loadTex('fabric_pattern_07_nor.jpg', false).clone(); fn.repeat.set(6, 2); fn.needsUpdate = true;
  const tent = new THREE.MeshStandardMaterial({ map: tentTex, roughness: 0.9, normalMap: fn, normalScale: new THREE.Vector2(1.2, 1.2), side: THREE.DoubleSide });
  const H = 4.0, a = 0.42;
  const roofG = new THREE.PlaneGeometry(w + 0.8, d / 2 / Math.cos(a) + 0.4);
  b2.add(roofG, tent, 0, H + Math.tan(a) * d / 4, -d / 4, -Math.PI / 2 + a, 0, 0);
  b2.add(roofG, tent, 0, H + Math.tan(a) * d / 4, d / 4, -Math.PI / 2 - a, 0, 0);
  const wallM = pbr('wood', { tile: 1.8, color: '#f5efe4' });
  b2.add(new THREE.BoxGeometry(w, H, 0.2), wallM, 0, H / 2, -d / 2);
  for (const sx of [-1, 1]) { b2.add(new THREE.BoxGeometry(0.2, H, d), wallM, sx * w / 2, H / 2, 0);
    const gable = new THREE.BufferGeometry(); const top = H + Math.tan(a) * d / 2;
    gable.setAttribute('position', new THREE.Float32BufferAttribute([sx * w / 2, H, -d / 2, sx * w / 2, H, d / 2, sx * w / 2, top, 0], 3)); gable.computeVertexNormals();
    b2.add(gable, new THREE.MeshStandardMaterial({ color: '#efe8db', side: THREE.DoubleSide })); }
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) b2.add(new THREE.BoxGeometry(0.22, H, 0.22), M('#6b4f2a'), x, H / 2, d / 2);
  b2.add(new THREE.BoxGeometry(w, 0.15, d), pbr('wood', { tile: 1.5, color: '#b08660', roughness: 0.8 }), 0, 0.08, 0);
  for (let x = -w / 2 + 2.2; x < w / 2 - 3.5; x += 3.2) for (let z = -d / 2 + 2.6; z < d / 2 - 1; z += 3) {
    b2.add(new THREE.BoxGeometry(0.8, 0.06, 2.0), pbr('wood', { tile: 0.8, color: '#d6a874', roughness: 0.75 }), x, 0.78, z); b2.add(new THREE.BoxGeometry(0.06, 0.75, 1.5), M('#555'), x, 0.4, z);
    for (const o of [-0.65, 0.65]) b2.add(new THREE.BoxGeometry(0.3, 0.05, 2.0), pbr('wood', { tile: 0.8, color: '#d6a874', roughness: 0.75 }), x + o, 0.47, z);
  }
  b2.add(new THREE.BoxGeometry(1.2, 1.1, d - 3.5), pbr('wood', { tile: 1, color: '#8a5a35', roughness: 0.6 }), w / 2 - 2.2, 0.55, -0.8);
  b2.add(new THREE.BoxGeometry(0.3, 2.4, d - 3.5), Glow('#ffb347', 0.6), w / 2 - 0.4, 1.6, -0.8);
  B.at(null);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, 1.6), new THREE.MeshBasicMaterial({ map: signTex(R0.name.toUpperCase(), { w: 1024, h: 160, bg: '#1b0f05', fg: '#ffd166', border: R0.c }), toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
  sign.position.set(0, H + 1.1, d / 2 + 0.12); g.add(sign);
  const tb = bulbs.at(u, 0, v, 0);
  for (let x = -w / 2 + 1; x < w / 2; x += 2.6) tb.line([x, H - 0.1, -d / 2 + 1], [x, H - 0.1, d / 2], 0.6, '#ffd59a', 2);
  tb.line([-w / 2, H, d / 2 + 0.1], [w / 2, H, d / 2 + 0.1], 0.4, '#ffe08a', 1);
  bulbs.at(null);
  G.fairBox(u, v - d / 2, w / 2, 0.3); G.fairBox(u - w / 2, v, 0.3, d / 2); G.fairBox(u + w / 2, v, 0.3, d / 2);
  G.fairBox(u + w / 2 - 2.2, v - 0.8, 0.7, (d - 3.5) / 2);
  const bar = L(u + w / 2 - 3.6, v - 0.8);
  const ref = { type: 'restaurant', T: { sign: R0.name, items: R0.items, need: 'food' }, x: bar.x, z: bar.z, name: R0.name, need: 'food' };
  G.stalls.push(ref);
  G.addInteract({ x: bar.x, z: bar.z, r: 2.6, kind: 'stall', need: 'food', ref, label: () => `${R0.name} – Kaart`, icon: 'food' });
  glow.paint(u, v + d / 2 + 2, '#ffb347', 8, 0.5); glow.paint(u, v, '#ffcf8a', 8, 0.45);
  G.vendors.push({ u: u + w / 2 - 1.3, v: v - 0.8, ry: -Math.PI / 2, color: R0.c });
  G.lightSpots = G.lightSpots || []; G.lightSpots.push({ u, v, color: '#ffc98a' });
}

function titleCase(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }

/** Warenauslage pro Standtyp – kleine Details für Atmosphäre */
function decorateStall(b, type, w, d, T) {
  const z = d / 2 - 0.35;
  if (type === 'gromper' || type === 'wurscht' || type === 'fesch') {
    b.add(new THREE.BoxGeometry(1.6, 0.9, 0.9), M('#c0c4c8', { metalness: 0.8, roughness: 0.3 }), -w / 4, 1.55, -d / 2 + 0.8); // Fritteuse/Grill
    for (let i = 0; i < 8; i++) b.add(new THREE.SphereGeometry(0.09, 6, 4), M(type === 'wurscht' ? '#7a2e1a' : '#c98a2b'), R(-w / 3, w / 3), 1.18, z + R(-0.15, 0.15), 0, 0, 0, type === 'wurscht' ? 2.5 : 1.3, 0.5, 1);
    if (type === 'fesch') for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(0.6, 0.4, 0.4), M('#2f7fd1'), -w / 3 + i * 0.8, 1.3, z);
  } else if (type === 'mandelen' || type === 'souvenir') {
    for (let i = 0; i < 14; i++) b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), M(pick(['#ff9ad5', '#ffd166', '#8b5a2b', '#e63946', '#ffffff'])), R(-w / 2.4, w / 2.4), 1.27, z + R(-0.2, 0.2));
    for (let i = 0; i < 10; i++) b.add(new THREE.SphereGeometry(0.28, 8, 6), M(pick(['#ffffff', '#f1e9da'])), -w / 2 + 0.6 + i * (w - 1.2) / 9, 2.6, -d / 2 + 0.4); // Plüschschof
  } else if (type === 'mode' || type === 'hutt') {
    for (let i = 0; i < 9; i++) { const c = pick(['#1d4ea8', '#d01c2a', '#f3efe6', '#2a9d8f', '#ffb703', '#222']); const x = -w / 2 + 0.7 + i * (w - 1.4) / 8;
      if (type === 'mode') b.add(new THREE.BoxGeometry(0.6, 0.75, 0.05), M(c), x, 2.3, -d / 2 + 0.3);
      else b.add(new THREE.CylinderGeometry(0.25, 0.32, 0.25, 10), M(c), x, 2.3, -d / 2 + 0.4); }
    b.add(new THREE.BoxGeometry(0.05, 0.05, d - 0.8), M('#888'), 0, 2.7, -0.2);
  } else if (type === 'beier' || type === 'bar') {
    b.add(new THREE.BoxGeometry(w - 1, 0.5, 0.4), M('#6b4f2a'), 0, 1.6, -d / 2 + 0.4);
    for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6), M('#d9d9d9', { metalness: 0.9, roughness: 0.2 }), -1 + i * 0.6, 1.32, z - 0.15); // Zapfhähne
    for (let i = 0; i < 12; i++) b.add(new THREE.CylinderGeometry(0.06, 0.05, 0.18, 8), M('#f4c542', { emissive: '#7a5a00', emissiveIntensity: 0.4 }), R(-w / 2.5, w / 2.5), 1.2, z + R(-0.2, 0.2));
  } else if (type === 'schéiss') {
    for (let i = 0; i < 6; i++) b.add(new THREE.CircleGeometry(0.25, 16), Glow(i % 2 ? '#ffffff' : '#ff3b3b', 1.2), -w / 2 + 1 + i * (w - 2) / 5, 2.1, -d / 2 + 0.2);
    for (let i = 0; i < 8; i++) b.add(new THREE.SphereGeometry(0.35, 8, 6), M('#f3efe6'), -w / 2 + 0.6 + i * (w - 1.2) / 7, 2.9, -d / 2 + 0.6); // Preise: Plüschschof
  } else if (type === 'lukas') {
    b.add(new THREE.BoxGeometry(0.35, 6, 0.35), M('#ffbe0b'), w / 2 + 0.8, 3, 0.5);
    b.add(new THREE.SphereGeometry(0.45, 10, 8), M('#d4af37', { metalness: 0.9, roughness: 0.2 }), w / 2 + 0.8, 6.3, 0.5);
    b.add(new THREE.BoxGeometry(1, 0.3, 1), M('#444'), w / 2 + 0.8, 0.15, 1.2);
  } else if (type === 'lous') {
    for (let i = 0; i < 30; i++) b.add(new THREE.BoxGeometry(0.3, 0.3, 0.3), M(pick(['#ff006e', '#ffd60a', '#3a86ff', '#8338ec', '#fb5607'])), R(-w / 2.3, w / 2.3), R(1.6, 2.8), -d / 2 + 0.5);
  } else if (type === 'info') {
    b.add(new THREE.BoxGeometry(1, 1, 0.1), Glow('#4cc9f0', 1.5), 0, 4.8, d / 2 - 0.1);
  } else if (type === 'crepe') {
    for (let i = 0; i < 2; i++) b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16), M('#333', { metalness: 0.7 }), -1 + i * 1.6, 1.2, z - 0.1);
  }
}

/** Malt farbige Lichtpfützen auf den Asphalt (billiges „Global Illumination“) */
class GlowPainter {
  constructor() { this.W = 2048; this.H = 1024; this.ppm = 8; this.cv = document.createElement('canvas'); this.cv.width = this.W; this.cv.height = this.H; this.g = this.cv.getContext('2d'); this.g.fillStyle = '#000'; this.g.fillRect(0, 0, this.W, this.H); this.g.globalCompositeOperation = 'lighter'; }
  paint(u, v, color, radius, alpha = 0.5) {
    const x = (u + 128) * this.ppm, y = (v + 64) * this.ppm, r = radius * this.ppm; const g = this.g;
    const c = new THREE.Color(color); const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${alpha})`); gr.addColorStop(0.5, `rgba(${rgb},${alpha * 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  build(root) {
    const t = new THREE.CanvasTexture(this.cv); t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(256, 128), mat); plane.rotation.x = -Math.PI / 2; plane.position.y = 0.06; plane.renderOrder = 1; root.add(plane);
    this.mat = mat; return mat;
  }
}
