// Kirmesgelände: Haupttor E1, Zaun, Stände, Brasserie, Deko, Lichtteppich
import * as THREE from 'three';
import { FAIR, L, toLocal, GLACIS_POLY, STALL_TYPES, LANES, GATE, ENTRANCES, RIDES, EXTRA_RIDES, RESTAURANTS, RESTO_ROW, FOOTPRINT, STALL_MIX, STALL_FIXED, FOOD, DRINKS, CLOTHES, SOUVENIRS } from './data.js';
import { pointInPoly, distSeg, mulberry32 } from './util.js';
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
  // Freihaltezone vor jedem Fahrgeschäft (Kasse, Ein-/Ausstieg): ohne sie stand z. B. vor Geisterbahn und Magic World eine Bude auf dem Ausstiegspunkt
  for (const f of foot.slice(0, Object.keys(RIDES).length + EXTRA_RIDES.length)) { const hu = f.hu ?? f.r, hv = f.hv ?? f.r, sg = f.v > 0 ? -1 : 1; foot.push({ u: f.u, v: f.v + sg * (hv + 2.4), hu: Math.min(hu, 6), hv: 2.4 }); }
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
    detailStall(b2, type, w, d, h, T, awningTex[type], G.stalls.length);
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
  RESTAURANTS.forEach((R0, i) => buildRestaurant(G, root, glow, R0, B, bulbs, i));

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


function buildRestaurant(G, root, glow, R0, B, bulbs, idx = 0) {
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
    b2.add(gable, M('#efe8db', { side: THREE.DoubleSide })); } // geteiltes Material statt 18 einzelner (spart Draw-Calls)
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) b2.add(new THREE.BoxGeometry(0.22, H, 0.22), M('#6b4f2a'), x, H / 2, d / 2);
  b2.add(new THREE.BoxGeometry(w, 0.15, d), pbr('wood', { tile: 1.5, color: '#b08660', roughness: 0.8 }), 0, 0.08, 0);
  for (let x = -w / 2 + 2.2; x < w / 2 - 3.5; x += 3.2) for (let z = -d / 2 + 2.6; z < d / 2 - 1; z += 3) {
    b2.add(new THREE.BoxGeometry(0.8, 0.06, 2.0), pbr('wood', { tile: 0.8, color: '#d6a874', roughness: 0.75 }), x, 0.78, z); b2.add(new THREE.BoxGeometry(0.06, 0.75, 1.5), M('#555'), x, 0.4, z);
    for (const o of [-0.65, 0.65]) b2.add(new THREE.BoxGeometry(0.3, 0.05, 2.0), pbr('wood', { tile: 0.8, color: '#d6a874', roughness: 0.75 }), x + o, 0.47, z);
  }
  b2.add(new THREE.BoxGeometry(1.2, 1.1, d - 3.5), pbr('wood', { tile: 1, color: '#8a5a35', roughness: 0.6 }), w / 2 - 2.2, 0.55, -0.8);
  b2.add(new THREE.BoxGeometry(0.3, 2.4, d - 3.5), Glow('#ffb347', 0.6), w / 2 - 0.4, 1.6, -0.8);
  detailRestaurant(b2, R0, w, d, H, a, tent, idx);
  B.at(null);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, 1.6), new THREE.MeshBasicMaterial({ map: signTex(R0.name.toUpperCase(), { w: 1024, h: 160, bg: '#1b0f05', fg: '#ffd166', border: R0.c }), toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
  sign.position.set(0, H + 1.1, d / 2 + 0.12); g.add(sign);
  const tb = bulbs.at(u, 0, v, 0);
  for (let x = -w / 2 + 1; x < w / 2; x += 2.6) tb.line([x, H - 0.1, -d / 2 + 1], [x, H - 0.1, d / 2], 0.6, '#ffd59a', 2);
  tb.line([-w / 2, H, d / 2 + 0.1], [w / 2, H, d / 2 + 0.1], 0.4, '#ffe08a', 1);
  restoLights(tb, w, d, H, a);
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

// =====================================================================================
// Detail-Baukasten für Stände und Gaststätten
// Kleinteile werden je Stand und Material zu EINER Geometrie gebündelt und erst dann an den
// Batcher übergeben. Sonst sprengen tausende Einzelteile das 600er-Limit pro Batch-Mesh
// (=> zusätzliche Draw-Calls). Farbige Teile teilen sich zwei Vertex-Color-Materialien.
// =====================================================================================
const _km = new THREE.Matrix4(), _kq = new THREE.Quaternion(), _ke = new THREE.Euler(), _kp = new THREE.Vector3(), _ks = new THREE.Vector3(), _kn = new THREE.Matrix3(), _kv = new THREE.Vector3(), _kc = new THREE.Color();
const _kq2 = new THREE.Quaternion(), _ke2 = new THREE.Euler(), _kd = new THREE.Vector3(), _kY = new THREE.Vector3(0, 1, 0), _kb = new THREE.Vector3(), _kcc = new THREE.Vector3();
const _ug = new Map();
const ugeo = (key, make) => { let g = _ug.get(key); if (!g) { g = make(); if (g.index) g = g.toNonIndexed(); _ug.set(key, g); } return g; };
class Kit {
  constructor() { this.m = new Map(); }
  _a(mat) { let a = this.m.get(mat); if (!a) this.m.set(mat, a = { p: [], n: [], u: [], c: [] }); return a; }
  /** Geometrie transformiert einsammeln. col = Vertexfarbe (nur für Vertex-Color-Materialien), uv = [u0,v0,u1,v1] Atlas-Ausschnitt */
  put(mat, col, geo, x, y, z, rx, ry, rz, sx, sy, sz, uv) {
    const a = this._a(mat); _km.compose(_kp.set(x, y, z), _kq.setFromEuler(_ke.set(rx, ry, rz)), _ks.set(sx, sy, sz)); _kn.getNormalMatrix(_km);
    if (col) _kc.set(col); else _kc.setRGB(1, 1, 1);
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      _kv.fromBufferAttribute(P, i).applyMatrix4(_km); a.p.push(_kv.x, _kv.y, _kv.z);
      _kv.fromBufferAttribute(N, i).applyMatrix3(_kn).normalize(); a.n.push(_kv.x, _kv.y, _kv.z);
      if (uv) a.u.push(uv[0] + U.getX(i) * (uv[2] - uv[0]), uv[1] + U.getY(i) * (uv[3] - uv[1])); else a.u.push(U.getX(i), U.getY(i));
      a.c.push(_kc.r, _kc.g, _kc.b);
    }
    return this;
  }
  box(mat, col, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) { return this.put(mat, col, ugeo('b', () => new THREE.BoxGeometry(1, 1, 1)), x, y, z, rx, ry, rz, sx, sy, sz); }
  /** Zylinder (Achse y): r = Radius unten, top = Verhältnis Radius oben/unten, n = Seiten */
  cyl(mat, col, r, h, x, y, z, rx = 0, ry = 0, rz = 0, n = 6, top = 1) { return this.put(mat, col, ugeo('c' + n + '_' + top, () => new THREE.CylinderGeometry(top, 1, 1, n)), x, y, z, rx, ry, rz, r, h, r); }
  ball(mat, col, r, x, y, z, sx = 1, sy = 1, sz = 1, hi = false) { return this.put(mat, col, ugeo(hi ? 's8' : 's6', () => new THREE.SphereGeometry(1, hi ? 8 : 6, hi ? 6 : 4)), x, y, z, 0, 0, 0, r * sx, r * sy, r * sz); }
  quad(mat, col, w, h, x, y, z, rx = 0, ry = 0, rz = 0, uv) { return this.put(mat, col, ugeo('q', () => new THREE.PlaneGeometry(1, 1)), x, y, z, rx, ry, rz, w, h, 1, uv); }
  /** Stab zwischen zwei Punkten (quadratisch, oder rund mit n Seiten) */
  rod(mat, col, t, x0, y0, z0, x1, y1, z1, n = 0) {
    _kd.set(x1 - x0, y1 - y0, z1 - z0); const len = _kd.length(); _kq2.setFromUnitVectors(_kY, _kd.normalize()); _ke2.setFromQuaternion(_kq2);
    const ex = _ke2.x, ey = _ke2.y, ez = _ke2.z, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    return n ? this.cyl(mat, col, t, len, mx, my, mz, ex, ey, ez, n) : this.box(mat, col, t, len, t, mx, my, mz, ex, ey, ez);
  }
  /** Balken in der yz-Ebene (Querschnitt tx × ty) */
  rodYZ(mat, col, tx, ty, x, y0, z0, y1, z1) { return this.box(mat, col, tx, ty, Math.hypot(y1 - y0, z1 - z0), x, (y0 + y1) / 2, (z0 + z1) / 2, -Math.atan2(y1 - y0, z1 - z0)); }
  /** Balken in der xy-Ebene (Querschnitt ty × tz) */
  rodXY(mat, col, ty, tz, z, x0, y0, x1, y1) { return this.box(mat, col, Math.hypot(x1 - x0, y1 - y0), ty, tz, (x0 + x1) / 2, (y0 + y1) / 2, z, 0, 0, Math.atan2(y1 - y0, x1 - x0)); }
  /** Rohe Dreiecke (P: 9 Werte je Dreieck, U: 6 Werte je Dreieck), flache Normalen */
  tris(mat, P, U) {
    const a = this._a(mat);
    for (let i = 0; i < P.length; i += 9) {
      _kv.set(P[i], P[i + 1], P[i + 2]); _kb.set(P[i + 3], P[i + 4], P[i + 5]).sub(_kv); _kcc.set(P[i + 6], P[i + 7], P[i + 8]).sub(_kv); _kb.cross(_kcc).normalize();
      for (let j = 0; j < 3; j++) { a.p.push(P[i + j * 3], P[i + j * 3 + 1], P[i + j * 3 + 2]); a.n.push(_kb.x, _kb.y, _kb.z); a.u.push(U[i / 9 * 6 + j * 2], U[i / 9 * 6 + j * 2 + 1]); a.c.push(1, 1, 1); }
    }
    return this;
  }
  /** Alles an den Batcher übergeben: genau eine Geometrie je Material */
  flush(b) {
    for (const [mat, a] of this.m) { if (!a.p.length) continue; const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2));
      if (mat.vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(a.c, 3));
      b.add(g, mat); }
    this.m.clear();
  }
}

/** Geteilte Materialien für alle Details (jedes zusätzliche Material kostet Draw-Calls pro Batch-Zelle) */
let _KM = null;
function kitMats() {
  if (_KM) return _KM;
  const win = M('#2a2622', { emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.25, metalness: 0.2 }); win.userData.night = true; // leuchtet nur nachts (wie Stadtfenster)
  return _KM = {
    paint: M('#ffffff', { vertexColors: true, roughness: 0.8 }),                          // lackierte / matte Teile
    metal: M('#ffffff', { vertexColors: true, metalness: 0.85, roughness: 0.32 }),        // Alu, Edelstahl, Kupfer
    glass: M('#cfe6ee', { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, depthWrite: false }),
    plate: pbr('metal', { tile: 1.2, color: '#aeb4ba', metalness: 0.5, roughness: 0.6 }), // Sockelblech
    cream: pbr('wood', { tile: 1.2, color: '#f2ead8' }),                                   // = Thekenfront (bestehend)
    top: pbr('wood', { tile: 1, color: '#c98b55', roughness: 0.7 }),                       // = Thekenplatte (bestehend)
    deck: pbr('wood', { tile: 1.5, color: '#b08660', roughness: 0.8 }),                    // = Restaurantboden (bestehend)
    tim: M('#6b4f2a'),                                                                     // = Holzpfosten (bestehend)
    tube: Glow('#fff1c8', 1.3),                                                            // Leuchtröhren
    board: new THREE.MeshBasicMaterial({ map: boardAtlas(), toneMapped: false }),          // Preistafeln (ein Atlas für alle)
    win,
  };
}

/** Atlas-Kachel i (8 × 4 Kacheln) als UV-Rechteck */
const tileUV = i => { const c = i % 8, r = Math.floor(i / 8), e = 0.002; return [c / 8 + e, 1 - (r + 1) / 4 + e, (c + 1) / 8 - e, 1 - r / 4 - e]; };
/** Ein Canvas-Atlas mit allen Preistafeln: Kachel 0–13 Standtypen, 16–24 Gaststätten */
function boardAtlas() {
  const all = { ...FOOD, ...DRINKS, ...CLOTHES, ...SOUVENIRS };
  const short = s => { s = s.replace(/\s*\(.*?\)/g, '').replace(/[„“]/g, ''); return s.length > 24 ? s.slice(0, 23) + '…' : s; };
  const rows = ids => ids.slice(0, 6).map(id => all[id] ? [short(all[id].name), euro(all[id].price)] : [id, '']);
  return canvasTex(2048, 1024, (g) => {
    g.fillStyle = '#0c0e0d'; g.fillRect(0, 0, 2048, 1024);
    const tile = (i, title, lines, col) => {
      const x = (i % 8) * 256, y = Math.floor(i / 8) * 256;
      g.fillStyle = '#17231d'; g.fillRect(x + 3, y + 3, 250, 250); g.strokeStyle = col; g.lineWidth = 5; g.strokeRect(x + 9, y + 9, 238, 238);
      g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = col; g.font = 'bold 25px "Trebuchet MS", Arial, sans-serif'; g.fillText(title, x + 128, y + 36, 214);
      g.fillRect(x + 24, y + 56, 208, 2);
      lines.forEach(([name, price], k) => { const yy = y + 82 + k * 29; g.font = '18px "Trebuchet MS", Arial, sans-serif';
        g.textAlign = 'left'; g.fillStyle = '#f4f1e6'; g.fillText(name, x + 20, yy, price ? 148 : 216);
        if (price) { g.textAlign = 'right'; g.fillStyle = '#ffe08a'; g.font = 'bold 18px "Trebuchet MS", Arial, sans-serif'; g.fillText(price, x + 238, yy); } });
    };
    const light = c => { const k = new THREE.Color(c); return k.r + k.g + k.b < 0.9 ? '#ffe08a' : c; }; // dunkle Standfarben wären auf der Tafel unlesbar
    Object.keys(STALL_TYPES).forEach((id, i) => { const T = STALL_TYPES[id]; const title = T.sign.split(' – ')[0];
      const lines = T.items ? rows(T.items) : T.game === 'shooting' ? [['1 Partie', euro(T.price)], ['All Treffer zielt!', '']] : T.game === 'lukas' ? [['1 Schlag', euro(T.price)], ['Wien ass dee Stäerksten?', '']]
        : T.game === 'lous' ? [['1 Lous', euro(T.price)], ['All Lous gewënnt!', '']] : [['Fonnbüro', ''], ['Éischt Hëllef', ''], ['Plang vun der Fouer', '']];
      tile(i, title, lines, light(T.c1)); });
    RESTAURANTS.forEach((R0, i) => tile(16 + i, R0.name, rows(R0.items), '#ffd166'));
  });
}

/** Bogenkante (Volant): n Bögen über die Breite W, hängt ab y0 in der Ebene z; UV quer 0..1, längs v0..v1 */
function scallop(k, mat, W, n, y0, z, hRect, hArc, v0, v1) {
  const P = [], U = [], sw = W / n, H = hRect + hArc, uv = (x, y) => { U.push(x / W + 0.5, v0 + (y - (y0 - H)) / H * (v1 - v0)); };
  const tri = (ax, ay, bx, by, cx, cy) => { P.push(ax, ay, z, bx, by, z, cx, cy, z); uv(ax, ay); uv(bx, by); uv(cx, cy); };
  for (let i = 0; i < n; i++) { const x0 = -W / 2 + i * sw, x1 = x0 + sw, xm = x0 + sw / 2, yl = y0 - hRect;
    tri(x0, yl, x1, yl, x1, y0); tri(x0, yl, x1, y0, x0, y0);
    for (let j = 0; j < 4; j++) { const t0 = j * Math.PI / 4, t1 = (j + 1) * Math.PI / 4;
      tri(xm, yl, xm + Math.cos(t1) * sw / 2, yl - Math.sin(t1) * hArc, xm + Math.cos(t0) * sw / 2, yl - Math.sin(t0) * hArc); } }
  k.tris(mat, P, U);
}

// ---- kleine Requisiten (alle über Kit) ----
const kBottle = (k, P, x, y, z, col, s = 1, cap) => { k.cyl(P, col, 0.04 * s, 0.2 * s, x, y + 0.1 * s, z); k.cyl(P, cap || col, 0.016 * s, 0.1 * s, x, y + 0.25 * s, z, 0, 0, 0, 5); };
const kTeddy = (k, P, x, y, z, col, s = 1) => { k.ball(P, col, 0.2 * s, x, y + 0.2 * s, z, 1, 1.1, 0.9); k.ball(P, col, 0.14 * s, x, y + 0.5 * s, z + 0.02 * s); k.ball(P, '#f1e3cf', 0.06 * s, x, y + 0.47 * s, z + 0.12 * s);
  for (const e of [-1, 1]) { k.ball(P, col, 0.055 * s, x + e * 0.1 * s, y + 0.63 * s, z); k.ball(P, col, 0.07 * s, x + e * 0.2 * s, y + 0.28 * s, z + 0.08 * s); k.ball(P, col, 0.075 * s, x + e * 0.12 * s, y + 0.06 * s, z + 0.16 * s); } };
const kHat = (k, P, x, y, z, col, s = 1) => { k.cyl(P, col, 0.2 * s, 0.015, x, y, z, 0, 0, 0, 8); k.cyl(P, col, 0.125 * s, 0.13 * s, x, y + 0.07 * s, z, 0, 0, 0, 8, 0.85); k.cyl(P, '#2a2422', 0.128 * s, 0.03 * s, x, y + 0.025 * s, z, 0, 0, 0, 8); };
const ALU = '#b9bec4', DRK = '#2b2e33', STL = '#c9cdd2', WHT = '#f4f2ec';
const PLUSH = ['#c98a5a', '#f3b6c8', '#f3efe6', '#8fc7e8', '#ffd166', '#b497e0'];
const CLOTH = ['#1d4ea8', '#d01c2a', '#f3efe6', '#2a9d8f', '#ffb703', '#222222'];
const BRIGHT = ['#ff006e', '#ffd60a', '#3a86ff', '#8338ec', '#fb5607', '#2ec4b6'];
const FLOWERS = ['#d81e2c', '#e63946', '#ff6fa3', '#ffffff', '#ffd23f'];

/** Aufbau + Warenauslage eines Standes: Pfosten, Sockel, Blenden, Markise mit Volant, Preistafeln, typische Ware */
function detailStall(b, type, w, d, h, T, awn, idx) {
  const m = kitMats(), k = new Kit(), rnd = mulberry32(9173 + idx * 613), r = (a, c) => a + rnd() * (c - a), pk = a => a[Math.floor(rnd() * a.length)];
  const P = m.paint, S = m.metal, c1 = T.c1, hw = w / 2, hd = d / 2, zc = hd - 0.35, ct = 1.12, bt = 0.95, bz = -hd + 0.45; // ct = Oberkante Theke, bt/bz = Rückbuffet
  const uvT = tileUV(Object.keys(STALL_TYPES).indexOf(type)), gl = Glow(c1, 0.55);
  const yb = h - 0.25 - 0.8 * Math.cos(1), zb = hd + 0.6 + 0.8 * Math.sin(1);   // Vorderkante der Markise

  // --- Sockelblech, Eckpfosten, Paneelfugen, Dachblende ---
  k.box(m.plate, 0, w + 0.26, 0.2, 0.05, 0, 0.1, hd + 0.03);
  for (const sx of [-1, 1]) {
    k.box(m.plate, 0, 0.05, 0.2, d + 0.1, sx * (hw + 0.1), 0.1, 0);
    for (const sz of [-1, 1]) k.box(S, ALU, 0.16, h + 0.1, 0.16, sx * hw, (h + 0.1) / 2, sz * hd);
    for (let i = 1; i < 4; i++) k.box(S, ALU, 0.03, h - 0.4, 0.05, sx * (hw + 0.09), h / 2, -hd + i * d / 4);
    k.box(S, ALU, 0.03, 0.06, d - 0.16, sx * (hw + 0.09), 1.1, 0);
    k.box(P, c1, 0.02, 0.24, d - 0.16, sx * (hw + 0.086), h - 0.42, 0);
    k.box(S, DRK, 0.02, 0.98, 0.98, sx * (hw + 0.09), 1.9, 0.525);                                              // Plakat an der Seitenwand
    k.quad(m.board, 0, 0.9, 0.9, sx * (hw + 0.104), 1.9, 0.525, 0, sx * Math.PI / 2, 0, uvT);
    k.box(P, c1, 0.05, 0.3, d + 0.4, sx * (hw + 0.175), h + 0.03, 0); k.box(S, ALU, 0.07, 0.04, d + 0.44, sx * (hw + 0.175), h + 0.2, 0);
    k.box(S, ALU, 0.06, 1.22, 0.2, sx * (hw + 0.03), h + 0.75, hd - 0.1);                                       // Schildwange
    k.rod(S, ALU, 0.03, sx * (hw + 0.2), h + 1.3, hd - 0.1, sx * (hw + 0.2), yb + 0.02, zb);                     // Abspannung der Markise
  }
  k.box(P, c1, w + 0.4, 0.3, 0.05, 0, h + 0.03, -hd - 0.175); k.box(S, ALU, w + 0.44, 0.04, 0.07, 0, h + 0.2, -hd - 0.175);
  for (let i = 1; i < 6; i++) k.box(S, ALU, 0.05, h - 0.4, 0.03, -hw + i * w / 6, h / 2, -hd - 0.09);
  k.box(S, ALU, w - 0.16, 0.06, 0.03, 0, 1.1, -hd - 0.09);
  // --- Schild: Rückwand + Streben ---
  k.box(P, DRK, w, 1.1, 0.02, 0, h + 0.75, hd - 0.172);
  for (const x of [-hw + 0.6, 0, hw - 0.6]) k.rod(S, ALU, 0.05, x, h + 0.12, hd - 1.2, x, h + 1.2, hd - 0.19);
  // --- Markise: Sparren, Frontrohr, Volant mit Bogenkante ---
  for (const x of [-hw - 0.26, -hw / 2, 0, hw / 2, hw + 0.26]) k.box(S, ALU, 0.04, 1.6, 0.04, x, h - 0.275, hd + 0.584, -1.0);
  k.cyl(S, ALU, 0.03, w + 0.6, 0, yb, zb, 0, 0, Math.PI / 2);
  scallop(k, awn, w + 0.6, 16, yb, zb, 0.08, 0.14, 0, 0.6);
  // --- Thekenfront: Lisenen, Farbband, Kantenprofil, Preistafel ---
  for (let i = 0; i < 7; i++) k.box(P, c1, 0.07, 0.84, 0.025, -hw + 0.1 + i * (w - 0.2) / 6, 0.62, hd + 0.012);
  k.box(P, c1, w, 0.07, 0.02, 0, 0.99, hd + 0.014);
  k.box(S, ALU, w + 0.22, 0.035, 0.03, 0, 1.1, hd + 0.105);
  const bx = -hw + 0.1 + 4.5 * (w - 0.2) / 6;
  k.box(S, DRK, 0.74, 0.74, 0.02, bx, 0.585, hd + 0.01); k.quad(m.board, 0, 0.68, 0.68, bx, 0.585, hd + 0.022, 0, 0, 0, uvT);
  // --- innen: Leuchtröhren, Rückbuffet, Kasse ---
  k.box(m.tube, 0, w - 1.4, 0.05, 0.1, 0, h - 0.05, hd - 0.9); k.box(m.tube, 0, w - 1.4, 0.05, 0.1, 0, h - 0.05, -0.7);
  k.box(m.cream, 0, w - 0.5, bt - 0.05, 0.7, 0, (bt - 0.05) / 2, bz); k.box(m.top, 0, w - 0.4, 0.05, 0.76, 0, bt - 0.025, bz + 0.01);
  k.box(S, DRK, 0.34, 0.2, 0.3, 0.9, bt + 0.1, bz); k.box(S, ALU, 0.3, 0.02, 0.16, 0.9, bt + 0.26, bz - 0.05, 0.5);

  // ---- Helfer für die Ware ----
  const bottle = (x, y, z, col, s, cap) => kBottle(k, P, x, y, z, col, s, cap);
  const teddy = (x, y, z, col, s) => kTeddy(k, P, x, y, z, col, s);
  const plates = (x, z, n) => { for (let i = 0; i < n; i++) { const hh = r(0.08, 0.26); k.cyl(P, WHT, 0.11, hh, x + i * 0.26, ct + hh / 2, z, 0, 0, 0, 8); } };
  /** Abzugshaube + Kamin über dem Gerät bei x, dazu Unterbau */
  const hood = (x) => { const z = -hd + 0.8; k.box(S, STL, 1.8, 0.28, 1.0, x, 2.72, z); k.box(S, STL, 0.9, 0.24, 0.6, x, 2.96, z); k.cyl(S, STL, 0.13, 0.9, x, h + 0.55, z, 0, 0, 0, 8); k.cyl(S, STL, 0.22, 0.1, x, h + 1.03, z, 0, 0, 0, 8, 0.3);
    k.box(S, STL, 1.5, 0.15, 0.8, x, 1.025, z); k.box(S, STL, 1.5, 0.95, 0.4, x, 0.475, -hd + 1.0); };
  /** Spuckschutz aus Glas auf der Theke */
  const guard = (x0, x1) => { const xm = (x0 + x1) / 2; k.box(m.glass, 0, x1 - x0, 0.42, 0.015, xm, ct + 0.3, zc + 0.36, -0.25); for (const x of [x0, x1]) k.box(S, ALU, 0.03, 0.46, 0.03, x, ct + 0.28, zc + 0.36, -0.25); k.box(S, ALU, x1 - x0 + 0.03, 0.025, 0.03, xm, ct + 0.5, zc + 0.31); };
  /** Plüschdéier als Präis, hängt an einer Schnur in der Frontöffnung */
  const hang = (x, col) => { const y = 2.1 + r(0, 0.2), z = hd - 0.12; k.box(P, '#d8d8d8', 0.01, h - y - 0.42, 0.01, x, (h + y + 0.42) / 2, z); k.ball(P, col, 0.15, x, y + 0.14, z, 1, 1.1, 0.9); k.ball(P, col, 0.11, x, y + 0.34, z + 0.02); for (const e of [-1, 1]) k.ball(P, col, 0.045, x + e * 0.08, y + 0.44, z); };
  /** Regal an der Rückwand */
  const shelf = (y) => k.box(S, DRK, w - 1, 0.04, 0.24, 0, y, -hd + 0.22);

  if (type === 'gromper' || type === 'wurscht' || type === 'fesch') {
    const fx = -w / 4; hood(fx);
    k.box(S, '#d3d7db', w * 0.72, 0.03, 0.5, 0, ct + 0.015, zc);                         // Blech unter der Ware
    guard(-2.55, 2.55); plates(2.74, zc - 0.05, 3);                                       // Pabeiertelleren
    for (let i = 0; i < 3; i++) bottle(-2.78 - i * 0.2, ct, zc + r(-0.08, 0.12), ['#c8102e', '#e8b923', '#f3efe6'][i], 1.2);  // Sossen
    k.box(P, WHT, 0.22, 0.12, 0.16, -2.98, ct + 0.06, zc - 0.3);                           // Serviettenspender
    if (type === 'wurscht') {
      k.box(S, '#1b1b1d', 1.5, 0.03, 0.8, fx, 2.015, -hd + 0.8);                           // Grillrost
      for (let i = 0; i < 7; i++) k.cyl(P, i % 3 ? '#8a3b1d' : '#6e2413', 0.035, 0.3, fx - 0.6 + i * 0.2, 2.065, -hd + 0.8 + r(-0.15, 0.15), Math.PI / 2, 0, 0, 5);
      k.box(gl, 0, 1.4, 0.06, 0.02, fx, 1.5, -hd + 1.26);                                  // Glutschlitz
      k.box(P, '#a9753f', 0.6, 0.16, 0.4, 1.9, bt + 0.08, bz);                             // Bréitercherskuerf
      for (let i = 0; i < 6; i++) k.ball(P, '#e2b877', 0.085, 1.68 + (i % 3) * 0.22, bt + 0.2, bz - 0.09 + Math.floor(i / 3) * 0.18, 1.3, 0.8, 1);
    } else {
      for (const o of [-0.38, 0.38]) k.box(S, '#4a3716', 0.62, 0.02, 0.66, fx + o, 2.005, -hd + 0.8);  // Fettbecken
      for (const o of [-0.38, 0.38]) k.rod(S, DRK, 0.012, fx + o, 2.02, -hd + 0.8, fx + o + 0.1, 2.3, -hd + 1.25); // Korbgriff
    }
    if (type === 'gromper') {
      for (let i = 0; i < 2; i++) k.cyl(P, '#f1efe8', 0.16, 0.32, 1.6 + i * 0.45, bt + 0.16, bz, 0, 0, 0, 8);   // Deegeemer
      k.ball(P, '#9c7a4d', 0.3, 2.75, bt + 0.2, bz, 1, 0.7, 0.8);                                             // Gromperesak
      for (let i = 0; i < 3; i++) k.cyl(P, '#cfa94a', 0.07, 0.16, -1.9 - i * 0.2, ct + 0.11, zc - 0.32);        // Äppelkompott
    }
    if (type === 'fesch') {
      for (let i = 0; i < 4; i++) k.ball(P, '#9fb2bd', 0.13, 1.0 + i * 0.4, ct + 0.07, zc + 0.14, 1.7, 0.3, 0.55);   // Fësch
      for (let i = 0; i < 3; i++) k.ball(P, '#f2d21f', 0.05, 1.2 + i * 0.4, ct + 0.07, zc - 0.12);                    // Zitroun
      for (let i = 0; i < 5; i++) bottle(1.5 + i * 0.22, bt, bz + 0.1, '#31572c', 1.5, '#d4af37');                   // Riesling
    }
  } else if (type === 'mandelen') {
    const gw = w - 0.5;                                                                   // Glasvitrine über der Auslage
    k.box(m.glass, 0, gw, 0.5, 0.012, 0, ct + 0.25, zc + 0.36); k.box(m.glass, 0, gw, 0.012, 0.72, 0, ct + 0.5, zc);
    for (const sx of [-1, 1]) { k.box(m.glass, 0, 0.012, 0.5, 0.72, sx * gw / 2, ct + 0.25, zc); k.box(S, ALU, 0.03, 0.03, 0.72, sx * gw / 2, ct + 0.5, zc);
      for (const sz of [-1, 1]) k.box(S, ALU, 0.03, 0.5, 0.03, sx * gw / 2, ct + 0.25, zc + sz * 0.36); }
    for (const sz of [-1, 1]) k.box(S, ALU, gw, 0.03, 0.03, 0, ct + 0.5, zc + sz * 0.36);
    k.box(S, STL, 0.7, 0.1, 0.6, -1.9, bt + 0.05, bz); k.cyl(S, '#b87333', 0.3, 0.3, -1.9, bt + 0.25, bz, 0, 0, 0, 8, 1.25); k.rod(S, DRK, 0.02, -1.9, bt + 0.3, bz, -1.72, bt + 0.85, bz);  // Kupferkessel
    for (let i = 0; i < 4; i++) { const x = -2.7 + i * 0.42; k.cyl(P, '#e9dcc0', 0.012, 0.4, x, ct + 0.71, zc, 0, 0, 0, 5); k.ball(P, i % 2 ? '#ff9ad5' : '#9ad8ff', 0.17, x, ct + 1.0, zc, 1, 1.25, 1); } // Zockerwatt
    k.box(S, '#d3d7db', 1.7, 0.02, 0.4, 1.95, ct + 0.52, zc + 0.07);
    for (let i = 0; i < 6; i++) { const x = 1.3 + i * 0.26, z = zc + (i % 2) * 0.14; k.ball(P, '#8f1218', 0.07, x, ct + 0.6, z); k.cyl(P, '#e9dcc0', 0.008, 0.16, x, ct + 0.73, z, 0, 0, 0, 5); }        // Schockela-Äppel
  } else if (type === 'souvenir') {
    for (let i = 0; i < 10; i++) { const x = -hw + 0.6 + i * (w - 1.2) / 9; k.ball(P, '#2a2422', 0.13, x, 2.56, -hd + 0.63); for (const e of [-1, 1]) k.ball(P, '#2a2422', 0.06, x + e * 0.2, 2.72, -hd + 0.5, 1, 0.6, 1); } // Schofsgesiichter
    for (let i = 0; i < 7; i++) { const x = hw - 1.3 + r(-0.7, 0.7), z = 0.4 + r(-0.5, 0.5), y = h + 1.7 + r(0, 1.0);      // Heliumballonen iwwer dem Daach
      k.ball(P, pk(BRIGHT), 0.24, x, y, z, 1, 1.2, 1, true); k.rod(P, '#d8d8d8', 0.008, hw - 1.3, h + 0.12, 0.4, x, y - 0.28, z); }
    for (let i = 0; i < 6; i++) { const x = -2.6 + i * 0.62, y = 2.18 + (i % 2) * 0.12, z = hd - 0.12;                       // Liebkuchenhäerzer
      k.box(P, '#d8d8d8', 0.01, h - y - 0.2, 0.01, x, (h + y + 0.2) / 2, z); k.box(P, '#7a3b1e', 0.2, 0.2, 0.05, x, y, z, 0, 0, Math.PI / 4);
      for (const e of [-1, 1]) k.ball(P, '#7a3b1e', 0.1, x + e * 0.075, y + 0.085, z, 1, 1, 0.25); k.ball(P, i % 2 ? '#ff9ad5' : '#ffffff', 0.05, x, y + 0.04, z + 0.03, 1, 1, 0.3); }
    teddy(3.1, ct, zc - 0.1, '#f3efe6', 0.8);
  } else if (type === 'mode') {
    k.cyl(S, ALU, 0.02, w - 0.6, 0, 2.72, -hd + 0.3, 0, 0, Math.PI / 2);                 // Kleederstaang
    for (let i = 0; i < 9; i++) { const x = -3.0 + i * 0.62, n = 3 + Math.floor(rnd() * 4);   // gefaalt T-Shirten
      for (let j = 0; j < n; j++) k.box(P, pk(CLOTH), 0.36, 0.045, 0.3, x + r(-0.015, 0.015), ct + 0.024 + j * 0.047, zc + 0.05, 0, r(-0.06, 0.06)); }
    const mx = 2.85; k.cyl(S, DRK, 0.14, 0.02, mx, ct + 0.01, zc, 0, 0, 0, 8); k.cyl(S, ALU, 0.02, 0.24, mx, ct + 0.12, zc);     // Büste
    k.box(P, '#1d4ea8', 0.42, 0.5, 0.22, mx, ct + 0.47, zc); for (const e of [-1, 1]) k.box(P, '#1d4ea8', 0.14, 0.28, 0.17, mx + e * 0.26, ct + 0.56, zc, 0, 0, e * 0.4);
    k.ball(P, '#e9e4da', 0.1, mx, ct + 0.85, zc, 1, 1.2, 1);
    k.cyl(S, ALU, 0.015, w - 0.4, 0, 2.66, hd - 0.12, 0, 0, Math.PI / 2);                // Staang an der Frontöffnung
    for (let i = 0; i < 5; i++) { const x = -2.8 + i * 0.5; ['#d01c2a', '#ffffff', '#00a1de'].forEach((c, j) => k.box(P, c, 0.045, 0.5, 0.02, x + (j - 1) * 0.045, 2.4, hd - 0.12)); }  // Schalen rout-wäiss-blo
    for (let i = 0; i < 4; i++) { const x = 0.5 + i * 0.7, c = pk(['#d01c2a', '#1d4ea8', '#222222']); k.box(P, '#d8d8d8', 0.01, 0.3, 0.01, x, 2.5, hd - 0.12); k.ball(P, c, 0.12, x, 2.27, hd - 0.12, 1, 0.75, 1); k.box(P, c, 0.2, 0.015, 0.14, x, 2.24, hd + 0.0); } // Kapen
  } else if (type === 'hutt') {
    const HATS = ['#8b5a2b', '#d9c7a0', '#222222', '#f3efe6', '#b3261e'];
    for (let i = 0; i < 6; i++) { const x = -3.0 + i * 0.72, hh = 0.22 + (i % 2) * 0.16; k.cyl(S, DRK, 0.09, 0.015, x, ct + 0.008, zc, 0, 0, 0, 8); k.cyl(S, ALU, 0.012, hh, x, ct + hh / 2, zc, 0, 0, 0, 5); kHat(k, P, x, ct + hh, zc, pk(HATS)); }
    const cx = 2.75; k.cyl(S, DRK, 0.2, 0.03, cx, ct + 0.015, zc, 0, 0, 0, 8); k.cyl(P, '#f3efe6', 0.15, 0.75, cx, ct + 0.4, zc); k.cyl(S, DRK, 0.17, 0.02, cx, ct + 0.78, zc, 0, 0, 0, 8);  // Brëllekarussell
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6, led = (i + j) % 4 === 0;
      k.box(led ? gl : P, led ? 0 : '#15171a', 0.12, 0.04, 0.012, cx + Math.sin(a) * 0.137, ct + 0.15 + j * 0.17, zc + Math.cos(a) * 0.137, 0, a, 0); }
    k.box(S, ALU, 0.34, 0.44, 0.03, 1.75, ct + 0.24, zc - 0.2, -0.15, 0.3); k.box(P, '#cfe3ea', 0.28, 0.38, 0.034, 1.75, ct + 0.24, zc - 0.2, -0.15, 0.3);     // Spigel
    for (let i = 0; i < 5; i++) { const x = -2.4 + i * 1.2, y = 2.2 + (i % 2) * 0.12; k.box(P, '#d8d8d8', 0.01, h - y - 0.14, 0.01, x, (h + y + 0.14) / 2, hd - 0.12); kHat(k, P, x, y, hd - 0.12, pk(HATS), 1.1); }
  } else if (type === 'beier' || type === 'bar') {
    const beer = type === 'beier';
    k.box(S, '#d9d9d9', 2.1, 0.07, 0.1, -0.1, ct + 0.44, zc - 0.15); k.box(S, DRK, 2.3, 0.02, 0.36, -0.1, ct + 0.01, zc - 0.1);   // Zapfsail + Ofdrëpsblech
    for (let i = 0; i < 4; i++) { const x = -1 + i * 0.6; k.box(P, i % 2 ? c1 : '#1c1c1e', 0.05, 0.16, 0.04, x, ct + 0.555, zc - 0.13); k.rod(S, '#d9d9d9', 0.012, x, ct + 0.42, zc - 0.11, x, ct + 0.32, zc - 0.03); }
    for (let i = 0; i < 14; i++) bottle(-2.8 + i * 0.43, 1.85, -hd + 0.42 + (i % 2) * 0.06, beer ? pk(['#3b5d2a', '#6b3f1d', '#2f4a22']) : pk(['#1f3d1c', '#27331f', '#3a2a12']), 1.4, beer ? '#d9d9d9' : '#d4af37');
    k.box(S, STL, 0.5, 0.02, 0.5, 3.1, ct + 0.01, zc);                                    // Gliesertablett
    for (let i = 0; i < 9; i++) k.cyl(P, '#e6eef0', 0.035, 0.14, 2.95 + (i % 3) * 0.15, ct + 0.09, zc - 0.15 + Math.floor(i / 3) * 0.15);
    for (let i = 0; i < 2; i++) { const x = 2.2 + i * 0.5, z = -0.35 - i * 0.15; k.cyl(S, '#aab0b5', 0.2, 0.52, x, 0.27, z, 0, 0, 0, 8); for (const y of [0.02, 0.27, 0.52]) k.cyl(S, '#8f969b', 0.215, 0.03, x, y, z, 0, 0, 0, 8); }  // Fässer
    for (let j = 0; j < 3; j++) k.box(P, beer ? '#e8b923' : '#6b1d2a', 0.42, 0.28, 0.32, -2.9, 0.14 + j * 0.29, -0.6);   // Këschten
    if (!beer) { k.cyl(S, '#cfd3d6', 0.13, 0.24, -3.12, ct + 0.12, zc, 0, 0, 0, 8, 1.25); bottle(-3.12, ct + 0.1, zc, '#1f3d1c', 1.5, '#d4af37'); }  // Äiseemer mat Crémant
  } else if (type === 'crepe') {
    for (const x of [-1, 0.6]) k.box(S, STL, 0.9, 0.05, 0.9, x, ct + 0.02, zc - 0.1);      // Sockel der Crêpe-Platten
    k.cyl(P, '#e8c88a', 0.36, 0.012, -1, 1.247, zc - 0.1, 0, 0, 0, 8); guard(-1.6, 1.2);
    for (let i = 0; i < 5; i++) { const x = 1.6 + i * 0.2, z = zc + (i % 2) * 0.1; k.cyl(P, '#4a2a14', 0.07, 0.16, x, ct + 0.08, z); k.cyl(P, '#f1efe8', 0.072, 0.03, x, ct + 0.175, z); }   // Nutella
    k.cyl(S, STL, 0.17, 0.3, -2.05, ct + 0.15, zc - 0.05, 0, 0, 0, 8); k.rod(S, DRK, 0.012, -2.05, ct + 0.2, zc - 0.05, -1.9, ct + 0.5, zc - 0.15);                                   // Deegeemer
    k.box(S, DRK, 0.95, 0.04, 0.2, -2.85, ct + 0.02, zc);                                 // Churros an Tuten
    for (let i = 0; i < 4; i++) { const x = -3.18 + i * 0.22; k.cyl(P, WHT, 0.03, 0.2, x, ct + 0.14, zc, 0, 0, 0, 6, 2.6); for (let j = 0; j < 3; j++) k.cyl(P, '#c98a3c', 0.012, 0.18, x + (j - 1) * 0.03, ct + 0.26, zc + (j % 2) * 0.03, 0, 0, (j - 1) * 0.15, 5); }
    k.box(S, STL, 1.6, 0.9, 0.9, -w / 4, 1.55, -hd + 0.8); hood(-w / 4);                   // Churros-Fritteuse
    k.box(S, DRK, 0.5, 0.45, 0.4, 2.0, bt + 0.225, bz); k.box(S, STL, 0.52, 0.04, 0.42, 2.0, bt + 0.47, bz); for (let i = 0; i < 3; i++) k.cyl(P, WHT, 0.045, 0.1 + i * 0.05, 2.5 + i * 0.12, bt + 0.05 + i * 0.025, bz);  // Kaffismaschinn
    plates(2.74, zc - 0.05, 3);
  } else if (type === 'schéiss') {
    k.box(P, '#7a1f1f', w - 0.4, 0.05, 0.16, 0, ct + 0.025, zc + 0.3);                     // gepolstert Oplag
    for (let i = 0; i < 4; i++) { const x = -2.2 + i * 1.45, ry = r(-0.12, 0.12), at = o => [x + Math.sin(ry) * o, zc + Math.cos(ry) * o];   // Loftgewierer
      const [sx, sz] = at(0.28), [rx, rz] = at(-0.04), [b0x, b0z] = at(-0.19), [b1x, b1z] = at(-0.72);
      k.box(P, '#5a3a1e', 0.05, 0.11, 0.34, sx, ct + 0.1, sz, 0, ry); k.box(S, DRK, 0.045, 0.07, 0.3, rx, ct + 0.12, rz, 0, ry); k.rod(S, '#1f2023', 0.014, b0x, ct + 0.135, b0z, b1x, ct + 0.135, b1z, 5); }
    [1.2, 1.62].forEach((y, j) => { shelf(y); for (let i = 0; i < 12; i++) { const x = -2.75 + i * 0.5;                          // Zieler op Regaler
      if (j) k.cyl(P, i % 2 ? WHT : '#d01c2a', 0.08, 0.02, x, y + 0.11, -hd + 0.24, Math.PI / 2, 0, 0, 8); else k.box(P, i % 2 ? '#ffd23f' : WHT, 0.14, 0.12, 0.02, x, y + 0.08, -hd + 0.24); } });
    for (let i = 0; i < 7; i++) hang(-2.7 + i * 0.9, PLUSH[i % PLUSH.length]);
    teddy(-3.1, ct, zc - 0.1, '#c98a5a', 0.9); teddy(3.1, ct, zc - 0.1, '#f3b6c8', 0.9);
  } else if (type === 'lukas') {
    const tx = hw + 0.8, tz = 0.5;                                                        // Skala um Tuerm
    for (let i = 0; i < 11; i++) k.box(P, i % 2 ? WHT : T.c2, 0.3, 0.36, 0.02, tx, 1.2 + i * 0.42, tz + 0.18);
    k.box(S, DRK, 0.06, 4.9, 0.03, tx, 3.3, tz + 0.2); k.box(P, '#d01c2a', 0.16, 0.12, 0.08, tx, 1.25, tz + 0.24);
    k.cyl(S, '#d4af37', 0.22, 0.2, tx, 5.75, tz + 0.32, 0, 0, 0, 8, 0.45);                 // Klack
    k.cyl(P, '#b3261e', 0.2, 0.1, tx, 0.35, 1.2, 0, 0, 0, 8);                              // Schlagpolster
    k.cyl(S, '#2b2b2e', 0.1, 0.26, tx + 0.3, 0.4, 1.35, 0, 0, Math.PI / 2, 8); k.rod(P, '#8b5a2b', 0.02, tx + 0.3, 0.4, 1.35, tx + 0.3, 1.25, 0.72, 5);   // Hummer
    for (let i = 0; i < 4; i++) teddy(-2.4 + i * 1.6, ct, zc, PLUSH[(i + 1) % PLUSH.length], 0.85 + (i % 2) * 0.2);
    for (let i = 0; i < 5; i++) hang(-2.2 + i * 1.1, PLUSH[(i + 3) % PLUSH.length]);
    [1.25, 1.75].forEach((y) => { shelf(y); for (let i = 0; i < 9; i++) { const s = r(0.2, 0.32); k.box(P, pk(BRIGHT), s, s, 0.18, -2.6 + i * 0.65, y + 0.02 + s / 2, -hd + 0.22); } });
  } else if (type === 'lous') {
    k.cyl(m.glass, 0, 0.3, 0.6, 0, ct + 0.48, zc, 0, 0, Math.PI / 2, 8);                   // Loustrommel
    for (const sx of [-1, 1]) { k.cyl(S, ALU, 0.31, 0.03, sx * 0.31, ct + 0.48, zc, 0, 0, Math.PI / 2, 8); k.box(S, DRK, 0.04, 0.5, 0.3, sx * 0.36, ct + 0.25, zc); }
    k.rod(S, DRK, 0.025, 0.36, ct + 0.48, zc, 0.54, ct + 0.48, zc); k.box(S, DRK, 0.03, 0.2, 0.03, 0.54, ct + 0.4, zc);
    for (let i = 0; i < 14; i++) k.box(P, pk(BRIGHT), 0.07, 0.012, 0.04, r(-0.24, 0.24), ct + 0.26 + r(0, 0.12), zc + r(-0.18, 0.18), r(0, 3), r(0, 3), 0);
    for (const x of [-1.6, -1.1, 1.1, 1.6]) { k.cyl(P, T.c2, 0.15, 0.22, x, ct + 0.11, zc, 0, 0, 0, 8, 1.2); k.cyl(P, '#ff8fc0', 0.165, 0.02, x, ct + 0.2, zc, 0, 0, 0, 8); }   // Eemere mat Lousen
    teddy(-2.6, ct, zc, PLUSH[0], 1.2); teddy(2.6, ct, zc, PLUSH[3], 1.2); teddy(-3.1, ct, zc + 0.1, PLUSH[1], 0.7); teddy(3.1, ct, zc + 0.1, PLUSH[4], 0.7);
    for (let i = 0; i < 6; i++) hang(-2.5 + i, PLUSH[(i + 2) % PLUSH.length]);
    for (let i = 0; i < 10; i++) { const s = r(0.22, 0.36); k.box(P, pk(BRIGHT), s, s, s, -2.9 + i * 0.62, bt + s / 2, bz + r(-0.08, 0.08), 0, r(-0.3, 0.3)); }     // Präisser um Rückbuffet
  } else if (type === 'info') {
    k.box(S, DRK, 0.9, 0.6, 0.04, -2.2, ct + 0.3, zc - 0.1, -0.25);                        // Prospektstänner
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const t = -0.2 + j * 0.2; k.box(P, pk(['#f1faee', '#e63946', '#a8dadc', '#ffd166', '#457b9d']), 0.17, 0.15, 0.012, -2.2 + (i - 1.5) * 0.21, ct + 0.3 + 0.969 * t + 0.0064, zc - 0.1 - 0.247 * t + 0.025, -0.25); }
    k.cyl(S, DRK, 0.12, 0.02, 1.2, ct + 0.01, zc - 0.15, 0, 0, 0, 8); k.cyl(S, DRK, 0.02, 0.2, 1.2, ct + 0.1, zc - 0.15); k.box(S, DRK, 0.55, 0.36, 0.04, 1.2, ct + 0.36, zc - 0.15, 0, 0.3);   // Monitor
    k.box(P, WHT, 0.5, 0.4, 0.14, 2.3, 1.6, -hd + 0.15); k.box(P, '#d01c2a', 0.26, 0.08, 0.02, 2.3, 1.6, -hd + 0.23); k.box(P, '#d01c2a', 0.08, 0.26, 0.02, 2.3, 1.6, -hd + 0.23);            // Éischt Hëllef
    teddy(-1.5, bt, bz, '#c98a5a', 0.8); k.box(P, '#3b5b8c', 0.5, 0.34, 0.2, -2.3, bt + 0.17, bz); k.box(P, '#7a4b2a', 0.4, 0.28, 0.3, 2.4, bt + 0.14, bz); k.rod(P, '#222222', 0.02, 1.6, bt + 0.03, bz - 0.2, 2.1, bt + 0.03, bz + 0.3, 5); // Fundsaachen
  }
  k.flush(b);
}

/** Gaststätte: Fachwerk, Fenster mit Blummekëschten, Volant, Dachrinne, First, Schildrahmen, Menütafeln, Theke */
function detailRestaurant(b, R0, w, d, H, a, tent, idx) {
  const m = kitMats(), k = new Kit(), rnd = mulberry32(4421 + idx * 977), r = (p, q) => p + rnd() * (q - p), pk = arr => arr[Math.floor(rnd() * arr.length)];
  const P = m.paint, S = m.metal, TIM = m.tim, hw = w / 2, hd = d / 2, rise = Math.tan(a) * hd, top = H + rise, FR = '#f3efe6', GUT = '#7d848a';
  // --- Fachwerk, Fenster und Blummekëschten an den Giebelseiten ---
  for (const sx of [-1, 1]) { const xo = sx * (hw + 0.13);
    for (let i = 0; i <= 6; i++) k.box(TIM, 0, 0.06, H, 0.18, xo, H / 2, -hd + i * d / 6);
    for (const y of [0.3, 1.0, 2.35, H - 0.09]) k.box(TIM, 0, 0.06, 0.18, d, xo, y, 0);
    k.box(TIM, 0, 0.06, rise, 0.18, xo, H + rise / 2, 0);
    for (const sz of [-1, 1]) { k.rodYZ(TIM, 0, 0.06, 0.16, xo, 1.09, sz * hd, 2.26, sz * (hd - d / 6));       // Strebe im Endfeld
      k.rodYZ(TIM, 0, 0.06, 0.2, xo, H, sz * (hd + 0.1), top, 0);                                              // Ortgang
      k.box(TIM, 0, 0.06, rise / 2, 0.16, xo, H + rise / 4, sz * hd / 2); }
    for (const j of [1, 4]) { const zw = -hd + (j + 0.5) * d / 6, xw = sx * (hw + 0.11), xf = sx * (hw + 0.27);
      k.box(m.win, 0, 0.03, 1.17, 1.2, xw, 1.675, zw);
      for (const o of [-0.6, 0, 0.6]) k.box(P, FR, 0.05, 1.17, 0.06, xw + sx * 0.01, 1.675, zw + o);
      for (const y of [1.12, 1.675, 2.23]) k.box(P, FR, 0.05, 0.06, 1.2, xw + sx * 0.01, y, zw);
      k.box(P, '#5a3d22', 0.22, 0.18, 1.3, xf, 0.98, zw); k.box(P, '#2f6b2a', 0.2, 0.12, 1.26, xf, 1.11, zw);
      for (let i = 0; i < 8; i++) k.ball(P, pk(FLOWERS), 0.075, xf + sx * r(-0.04, 0.08), 1.19 + r(0, 0.05), zw - 0.55 + i * 0.157); }
  }
  // --- Rückwand ---
  for (let i = 0; i <= 8; i++) k.box(TIM, 0, 0.18, H, 0.06, -hw + i * w / 8, H / 2, -hd - 0.13);
  for (const y of [0.3, 2.0, H - 0.09]) k.box(TIM, 0, w, 0.18, 0.06, 0, y, -hd - 0.13);
  // --- Front: Rähm, Kopfbänder, Pfostensockel, Stufe ---
  k.box(TIM, 0, w + 0.3, 0.26, 0.26, 0, H - 0.13, hd);
  for (let i = 0; i <= 4; i++) { const x = -hw + i * w / 4; k.box(P, '#8d8f91', 0.36, 0.3, 0.36, x, 0.15, hd);
    for (const s of [-1, 1]) if (Math.abs(x + s * 0.8) < hw) k.rodXY(TIM, 0, 0.12, 0.1, hd, x + s * 0.11, H - 1.0, x + s * 0.85, H - 0.26);
    // Blummenampel um Pfosten (iwwer Kappheicht)
    const bzz = hd + 0.5; k.rod(TIM, 0, 0.05, x, 3.05, hd + 0.1, x, 3.05, bzz + 0.08); k.rod(S, DRK, 0.012, x, 3.05, bzz, x, 2.7, bzz);
    k.cyl(P, '#5a3d22', 0.14, 0.2, x, 2.6, bzz, 0, 0, 0, 8, 1.45); k.ball(P, '#2f6b2a', 0.27, x, 2.74, bzz, 1, 0.55, 1);
    for (let j = 0; j < 7; j++) { const an = j * 0.9 + r(0, 0.4); k.ball(P, pk(FLOWERS), 0.07, x + Math.cos(an) * 0.19, 2.8 + r(0, 0.06), bzz + Math.sin(an) * 0.19); }
    for (let j = 0; j < 3; j++) { const an = j * 2.1 + r(0, 0.6); k.ball(P, '#2f6b2a', 0.08, x + Math.cos(an) * 0.24, 2.52 + r(0, 0.08), bzz + Math.sin(an) * 0.24, 1, 1.5, 1); } }
  k.box(m.deck, 0, w, 0.08, 0.45, 0, 0.04, hd + 0.225);
  // --- Traufe: Volant mit Bogenkante, Dachrinnen, Fallrohre, First ---
  const ez = hd + 0.2 * Math.cos(a), ey = H - 0.2 * Math.sin(a);
  scallop(k, tent, w + 0.8, 32, ey, ez, 0.2, 0.16, 0, 1);
  for (const sz of [-1, 1]) { k.box(S, GUT, w + 0.9, 0.08, 0.12, 0, ey, sz * (ez + 0.07)); for (const sx of [-1, 1]) k.cyl(S, GUT, 0.045, ey, sx * (hw + 0.3), ey / 2, sz * (ez + 0.07)); }
  k.box(P, '#3b3f44', w + 0.9, 0.1, 0.36, 0, top + 0.02, 0); for (const sx of [-1, 1]) k.ball(S, '#d4af37', 0.12, sx * (hw + 0.4), top + 0.2, 0);
  // --- Schild: Rückwand, Rahmen, Streben zum Dach ---
  k.box(P, '#1b0f05', w - 0.8, 1.76, 0.05, 0, H + 1.1, hd + 0.08);
  for (const y of [H + 0.24, H + 1.96]) k.box(TIM, 0, w - 0.6, 0.12, 0.16, 0, y, hd + 0.06);
  for (const sx of [-1, 1]) k.box(TIM, 0, 0.12, 1.84, 0.16, sx * (hw - 0.36), H + 1.1, hd + 0.06);
  for (const x of [-hw + 2, 0, hw - 2]) k.rodYZ(TIM, 0, 0.1, 0.1, x, H + Math.tan(a) * 2.2, hd - 2.2, H + 1.9, hd - 0.02);
  // --- Menütafeln, hängen unter dem Rähm (iwwer Kappheicht) ---
  const uvR = tileUV(16 + idx);
  for (const sx of [-1, 1]) { const x = sx * (hw - 1.75); k.box(TIM, 0, 0.86, 0.86, 0.05, x, 2.6, hd); k.quad(m.board, 0, 0.76, 0.76, x, 2.6, hd + 0.03, 0, 0, 0, uvR);
    for (const o of [-0.3, 0.3]) k.box(S, DRK, 0.015, H - 0.26 - 3.03, 0.015, x + o, (H - 0.26 + 3.03) / 2, hd); }
  // --- Theke: Platte, Zapfsail, Glieser, Flaschenregal vor der Leuchtwand ---
  const bx = hw - 2.2, bz0 = -0.8, bl = d - 3.5;
  k.box(m.top, 0, 1.32, 0.05, bl + 0.1, bx, 1.125, bz0);
  k.cyl(S, '#d9d9d9', 0.06, 0.45, bx, 1.37, bz0, 0, 0, 0, 8); k.box(S, '#d9d9d9', 0.12, 0.1, 0.9, bx, 1.62, bz0); k.box(S, DRK, 0.4, 0.02, 1.0, bx - 0.25, 1.16, bz0);
  for (let i = 0; i < 3; i++) { const z = bz0 + (i - 1) * 0.3; k.box(P, i === 1 ? R0.c : '#1c1c1e', 0.04, 0.15, 0.04, bx, 1.74, z); k.rod(S, '#d9d9d9', 0.012, bx - 0.05, 1.6, z, bx - 0.14, 1.5, z); }
  for (let i = 0; i < 10; i++) k.cyl(P, '#e6eef0', 0.035, 0.14, bx + r(-0.4, 0.4), 1.22, bz0 + 1 + r(0, 2));
  for (const y of [1.35, 1.95]) { k.box(TIM, 0, 0.2, 0.04, bl - 0.2, hw - 0.66, y, bz0);
    for (let i = 0; i < 13; i++) kBottle(k, P, hw - 0.66, y + 0.02, bz0 - bl / 2 + 0.4 + i * (bl - 0.8) / 12, pk(['#1f3d1c', '#3a2a12', '#27331f', '#5a1d1d']), 1.5, pk(['#d4af37', '#d9d9d9', '#b3261e'])); }
  k.flush(b);
}

/** Lichterketten der Gaststätte: Ortgänge, First, Girlanden zwischen den Frontpfosten */
function restoLights(tb, w, d, H, a) {
  const hw = w / 2, hd = d / 2, top = H + Math.tan(a) * hd;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tb.line([sx * (hw + 0.22), H + 0.14, sz * hd], [sx * (hw + 0.22), top + 0.14, 0], 0.55, '#ffe08a', 0);
  tb.line([-hw, top + 0.2, 0], [hw, top + 0.2, 0], 0.6, i => i % 2 ? '#ffd166' : '#fff1c8', 1);
  for (let s = 0; s < 4; s++) for (let i = 1; i < 8; i++) { const f = i / 8; tb.add(-hw + (s + f) * w / 4, H - 0.34 - Math.sin(f * Math.PI) * 0.28, hd + 0.16, '#ffd59a', i / 5, 2, 2.2); }
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
