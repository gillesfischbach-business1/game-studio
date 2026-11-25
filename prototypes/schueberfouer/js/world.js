// Umgebung im Umkreis von ~300 m: Straßen, Häuser von Limpertsberg, Grand Théâtre,
// Tram, Bäume, Straßenlaternen, Kirchhof, Pont Rouge, Autos.
import * as THREE from 'three';
import { ROADS, TRAM, GLACIS_POLY, THEATRE_POLY, CEMETERY_POLY, BRIDGE, PARK_POLY } from './data.js';
import { Batcher, Bulbs, M, Glow, R, RI, pick, rand, canvasTex, noiseTex, signTex, distSeg, pointInPoly, clamp } from './util.js';
import { pbr } from './tex.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

export function buildWorld(G) {
  const { scene, colliders } = G;
  const B = new Batcher();
  const bulbs = new Bulbs();

  // ---------------- Boden ----------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), pbr('grass', { tile: 4, plane: 'xz', color: '#a8b896' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // Glacis-Asphalt (Fotoscan) + Parkplatz-Markierungen als Decal (die Glacis ist sonst ein Parkplatz!)
  const shape = new THREE.Shape(GLACIS_POLY.map(([x, z]) => new THREE.Vector2(x, -z)));
  const glacis = new THREE.Mesh(new THREE.ShapeGeometry(shape), pbr('asphalt', { tile: 5, plane: 'xz', color: '#a6a6a8', reflect: true, envMapIntensity: 0.45 }));
  glacis.rotation.x = -Math.PI / 2; glacis.position.y = 0.03; glacis.receiveShadow = true; scene.add(glacis);
  // Vorrang vor der Wiese darunter: bei geringer Tiefengenauigkeit (Handy, AO-Tiefenpuffer) schimmerte sonst Gras durch den Asphalt
  glacis.material.polygonOffset = true; glacis.material.polygonOffsetFactor = -1; glacis.material.polygonOffsetUnits = -4;
  const lines = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(214,211,200,0.7)'; g.lineWidth = 6;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4 + 3, 0); g.lineTo(i * w / 4 + 3, h * 0.42); g.stroke(); g.beginPath(); g.moveTo(i * w / 4 + 3, h * 0.58); g.lineTo(i * w / 4 + 3, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    // abgefahrene Farbe: fleckig weggeriebene Stellen statt sauberer Linien
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 420; i++) { g.globalAlpha = 0.25 + Math.random() * 0.55; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 14, 1 + Math.random() * 5, Math.random() * 3.14, 0, 6.29); g.fill(); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const img = g.getImageData(0, 0, w, h); for (let i = 3; i < img.data.length; i += 4) img.data[i] *= 0.5 + Math.random() * 0.3; g.putImageData(img, 0, 0);
  });
  lines.wrapS = lines.wrapT = THREE.RepeatWrapping; lines.repeat.set(1 / 10, 1 / 10); lines.rotation = 0.6524;
  const lineMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: lines, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 }));
  lineMesh.rotation.x = -Math.PI / 2; lineMesh.position.y = 0.045; lineMesh.receiveShadow = true; scene.add(lineMesh);

  // ---------------- Straßen ----------------
  const roadMat = pbr('road', { tile: 6, plane: 'xz', color: '#8a8a8e', reflect: true });
  const walkMat = pbr('paving', { tile: 2.4, color: '#c9c4ba' });
  const lineMat = M('#e6e6e6', { roughness: 0.6 });
  G.roadSegs = [];
  const seg = (a, b, w, name) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    B.add(new THREE.BoxGeometry(len + w * 0.4, 0.06, w), roadMat, mx, 0.04, mz, 0, ang);
    B.add(new THREE.BoxGeometry(len + w * 0.4, 0.16, 2.8), walkMat, mx + Math.sin(ang) * (w / 2 + 1.4), 0.08, mz + Math.cos(ang) * (w / 2 + 1.4), 0, ang);
    B.add(new THREE.BoxGeometry(len + w * 0.4, 0.16, 2.8), walkMat, mx - Math.sin(ang) * (w / 2 + 1.4), 0.08, mz - Math.cos(ang) * (w / 2 + 1.4), 0, ang);
    // Mittelstreifen gestrichelt
    for (let t = 2; t < len - 2; t += 7) { const px = a[0] + dx / len * t, pz = a[1] + dz / len * t; B.add(new THREE.BoxGeometry(3, 0.02, 0.15), lineMat, px, 0.08, pz, 0, ang); }
    G.roadSegs.push({ a, b, w, name });
  };
  for (const r of ROADS) {
    if (r.ring) {
      const { x, z, r: rad } = r.ring; const n = 24;
      for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; seg([x + Math.cos(a0) * rad, z + Math.sin(a0) * rad], [x + Math.cos(a1) * rad, z + Math.sin(a1) * rad], r.w, r.name); }
      // Mittelinsel mit Gras und Lëtzebuerger Fändel
      B.add(new THREE.CylinderGeometry(rad - r.w / 2 - 0.5, rad - r.w / 2 - 0.5, 0.35, 32), pbr('grass', { tile: 3, plane: 'xz', color: '#b8c8a0' }), x, 0.17, z);
      B.add(new THREE.CylinderGeometry(0.12, 0.15, 14, 8), M('#dddddd', { metalness: 0.6 }), x, 7, z);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.7), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: canvasTex(90, 54, (g) => { g.fillStyle = '#ed2939'; g.fillRect(0, 0, 90, 18); g.fillStyle = '#fff'; g.fillRect(0, 18, 90, 18); g.fillStyle = '#00a1de'; g.fillRect(0, 36, 90, 18); }) }));
      flag.position.set(x + 2.3, 12.4, z); scene.add(flag); G.flag = flag;
      colliders.circle(x, z, 2, 'flag');
      continue;
    }
    for (let i = 0; i < r.pts.length - 1; i++) seg(r.pts[i], r.pts[i + 1], r.w, r.name);
  }

  // ---------------- Tram (Linie T1) ----------------
  const railMat = M('#9a9a9a', { metalness: 0.8, roughness: 0.3 });
  const tramLen = []; let total = 0;
  for (let i = 0; i < TRAM.pts.length - 1; i++) {
    const a = TRAM.pts[i], b = TRAM.pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    tramLen.push(len); total += len;
    for (const off of [-0.72, 0.72]) B.add(new THREE.BoxGeometry(len + 0.3, 0.1, 0.12), railMat, (a[0] + b[0]) / 2 + Math.sin(ang) * off, 0.1, (a[1] + b[1]) / 2 + Math.cos(ang) * off, 0, ang);
    // Oberleitungsmasten
    for (let t = 0; t < len; t += 30) { const px = a[0] + dx / len * t + Math.sin(ang) * 3.2, pz = a[1] + dz / len * t + Math.cos(ang) * 3.2; B.add(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), M('#5a5f66', { metalness: 0.5 }), px, 3.5, pz); }
  }
  G.tramPath = { pts: TRAM.pts, lens: tramLen, total };
  // Haltestellen
  for (const s of TRAM.stops) {
    B.add(new THREE.BoxGeometry(18, 0.3, 3), M('#b0aca4'), s.x + 4, 0.15, s.z + 4);
    B.add(new THREE.BoxGeometry(12, 0.15, 3.2), M('#d7e7f2', { transparent: true, opacity: 0.5, metalness: 0.3 }), s.x + 4, 3.2, s.z + 4);
    for (const dx of [-5, 5]) B.add(new THREE.CylinderGeometry(0.08, 0.08, 3.1, 6), M('#333'), s.x + 4 + dx, 1.6, s.z + 4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.8), new THREE.MeshBasicMaterial({ map: signTex(s.name.toUpperCase(), { w: 384, h: 96, bg: '#00335f', fg: '#ffffff', border: '#e30613', bulbs: false }), side: THREE.DoubleSide }));
    sign.position.set(s.x + 4, 3.9, s.z + 4); scene.add(sign);
  }
  // Tramzug (2 Wagen), Farben angelehnt an die Luxtram-Optik (generisch)
  const tram = new THREE.Group();
  const tBody = M('#e9edf1', { metalness: 0.3, roughness: 0.4 }), tWin = M('#0f1a24', { metalness: 0.8, roughness: 0.1, emissive: '#2a4a66', emissiveIntensity: 0.6 });
  for (let k = 0; k < 3; k++) {
    const car = new THREE.Group(); car.position.x = -k * 15.2;
    car.add(new THREE.Mesh(new THREE.BoxGeometry(15, 3.2, 2.65), tBody)).position.y = 2;
    const w = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.2, 2.7), tWin); w.position.y = 2.5; car.add(w);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(15.05, 0.25, 2.7), M('#00a1de')); stripe.position.y = 1.2; car.add(stripe);
    const st2 = new THREE.Mesh(new THREE.BoxGeometry(15.05, 0.12, 2.7), M('#e30613')); st2.position.y = 1.45; car.add(st2);
    tram.add(car);
  }
  const front = new THREE.Mesh(new THREE.SphereGeometry(1.32, 12, 8, 0, Math.PI), tWin); front.rotation.y = -Math.PI / 2; front.scale.set(1, 1.2, 0.7); front.position.set(7.5, 2.2, 0); tram.add(front);
  scene.add(tram); G.tram = { mesh: tram, s: 260, speed: 9, wait: 0, dir: 1 };

  // ---------------- Grand Théâtre de Luxembourg (OSM-Umriss) ----------------
  {
    const sh = new THREE.Shape(THEATRE_POLY.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 13, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const th = new THREE.Mesh(geo, pbr('concrete', { tile: 4, color: '#f3efe6' })); th.castShadow = true; scene.add(th);
    // Glasfassade + Kolonnade (1964, Alain Bourbonnais)
    const fa = [[241, -55], [309, -71]]; const dx = fa[1][0] - fa[0][0], dz = fa[1][1] - fa[0][1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    for (let t = 2; t < len; t += 4) { const px = fa[0][0] + dx / len * t + Math.sin(ang) * -2.5, pz = fa[0][1] + dz / len * t + Math.cos(ang) * -2.5;
      B.add(new THREE.BoxGeometry(0.7, 12, 0.7), pbr('concrete', { tile: 3, color: '#ffffff' }), px + Math.sin(ang) * -3, 6, pz + Math.cos(ang) * -3); }
    B.add(new THREE.BoxGeometry(len, 10, 0.3), M('#1d2a33', { metalness: 0.7, roughness: 0.15, emissive: '#e8c27a', emissiveIntensity: 0.25 }), (fa[0][0] + fa[1][0]) / 2 - Math.sin(ang) * 0.2, 5.5, (fa[0][1] + fa[1][1]) / 2 - Math.cos(ang) * 0.2, 0, ang);
    B.add(new THREE.BoxGeometry(len + 2, 0.8, 8), M('#f4f2ec'), (fa[0][0] + fa[1][0]) / 2 - Math.sin(ang) * 3.5, 12.4, (fa[0][1] + fa[1][1]) / 2 - Math.cos(ang) * 3.5, 0, ang);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.2), new THREE.MeshBasicMaterial({ map: signTex('GRAND THÉÂTRE', { w: 1024, h: 88, bg: '#e8e4da', fg: '#202020', border: '#e8e4da', bulbs: false, font: 'Georgia, serif' }) }));
    s.position.set(275 - Math.sin(ang) * 7.6, 11, -63 - Math.cos(ang) * 7.6); s.rotation.y = ang; scene.add(s);
    addPolyCollider(colliders, THEATRE_POLY);
    G.landmarks = [{ name: 'Grand Théâtre', x: 272, z: -95 }];
  }

  // ---------------- Pont Grande-Duchesse Charlotte („Rout Bréck“) ----------------
  {
    const [a, b] = [BRIDGE.from, BRIDGE.to]; const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    const g = new THREE.Group(); g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2); g.rotation.y = ang; scene.add(g);
    const red = M('#c1121f', { metalness: 0.4, roughness: 0.5 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 4, 24), red); deck.position.y = -2; g.add(deck);
    for (let i = -3; i <= 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(5, 80, 8), M('#8c7f6a')); p.position.set(i * 48, -44, 0); g.add(p); }
    // Tal des Pfaffenthal darunter (dunkel)
    const val = new THREE.Mesh(new THREE.PlaneGeometry(len, 400), M('#1f2d1a')); val.rotation.x = -Math.PI / 2; val.position.y = -80; g.add(val);
    G.landmarks.push({ name: 'Pont Rouge', x: 550, z: -95 });
  }

  // ---------------- Kierfecht Notre-Dame (Teilbereich im Westen) ----------------
  {
    const poly = CEMETERY_POLY;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
      B.add(new THREE.BoxGeometry(len, 2.4, 0.5), pbr('concrete', { tile: 2, color: '#c9bfa9' }), (a[0] + b[0]) / 2, 1.2, (a[1] + b[1]) / 2, 0, ang); colliders.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len / 2, 0.4, ang); }
    for (let i = 0; i < 260; i++) { const x = R(-500, -270), z = R(-70, 230); if (!pointInPoly(x, z, poly)) continue; B.add(new THREE.BoxGeometry(0.9, R(0.8, 1.5), 0.25), pbr('concrete', { tile: 1, color: pick(['#9c978c', '#b5afa2', '#7d7870']) }), x, 0.5, z, 0, 0.6); }
    G.cemeteryPoly = poly;
  }

  // ---------------- Häuser (prozedural, aber außerhalb Straßen / Glacis / Theater) ----------------
  const facadeColors = ['#f3e7cf', '#ead6b5', '#e2cba6', '#f6f1e6', '#d6c4a4', '#efe0cb', '#d0d6d8', '#e4d7c3', '#f0e5d0', '#d8bf96'];
  const facTex = [0, 1, 2].map(i => makeFacade(facadeColors[i]));
  const roofMat = pbr('roof', { tile: 2.5, color: '#9aa0a8', roughness: 0.9 });
  const nearRoad = (x, z, pad) => { for (const s of G.roadSegs) if (distSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < s.w / 2 + pad) return s; return null; };
  const roadDir = (x, z) => { let best = null, bd = 1e9; for (const s of G.roadSegs) { const d = distSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]); if (d < bd) { bd = d; best = s; } } return best ? Math.atan2(-(best.b[1] - best.a[1]), best.b[0] - best.a[0]) : 0; };
  const blocked = (x, z, r) => {
    if (pointInPoly(x, z, GLACIS_POLY) || pointInPoly(x, z, PARK_POLY)) return true;
    for (let i = 0; i < GLACIS_POLY.length; i++) { const a = GLACIS_POLY[i], b = GLACIS_POLY[(i + 1) % GLACIS_POLY.length]; if (distSeg(x, z, a[0], a[1], b[0], b[1]) < r + 12) return true; }
    if (nearRoad(x, z, r + 4)) return true;
    if (pointInPoly(x, z, THEATRE_POLY) || Math.hypot(x - 272, z - 95 * -1) < 55) return true;
    if (pointInPoly(x, z, CEMETERY_POLY)) return true;
    if (Math.hypot(x - 133, z + 12) < 48) return true;
    if (x > 360) return true; // Pfaffenthal-Hang
    return false;
  };
  G.buildings = [];
  const placed = [];
  for (let gx = -460; gx <= 360; gx += 13) for (let gz = -360; gz <= 380; gz += 13) {
    const x = gx + R(-3, 3), z = gz + R(-3, 3);
    if (Math.hypot(x + 20, z) > 420) continue;
    if (blocked(x, z, 7)) continue;
    if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < 15)) continue;
    if (rand() < 0.12) { // kleiner Park / Hinterhof mit Bäumen
      G.treeSpots = G.treeSpots || []; G.treeSpots.push([x, z]); continue; }
    const ang = roadDir(x, z);
    const w = R(11, 16), d = R(10, 14), floors = RI(3, 6), h = floors * 3.2 + 1;
    const office = (z > 150 || x > 150) && rand() < 0.5;
    const ci = RI(0, facadeColors.length - 1);
    const mat = office ? officeMat() : facadeMat(facTex[ci % 3]);
    B.add(office ? new THREE.BoxGeometry(w, h, d) : facadeBox(w, h, d, floors, facadeColors[ci]), mat, x, h / 2, z, 0, ang);
    if (!office) { // Mansarddach (typisch Limpertsberg)
      const roof = new THREE.CylinderGeometry(0.7, 1, 1, 4, 1); roof.rotateY(Math.PI / 4);
      B.add(roof, roofMat, x, h + 1.6, z, 0, ang, 0, w * 0.74, 3.2, d * 0.74);
      if (rand() < 0.6) B.add(new THREE.BoxGeometry(0.9, 2, 0.9), M('#7a4b3a'), x + R(-3, 3), h + 3, z + R(-2, 2), 0, ang);
    } else B.add(new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4), M('#9aa3a8'), x, h + 0.3, z, 0, ang);
    colliders.box(x, z, w / 2 + 0.2, d / 2 + 0.2, ang, 'house');
    placed.push([x, z]); G.buildings.push({ x, z, w, d, h, ang });
  }
  // Das weiße Haus neben dem Tor (vgl. Foto vom Tor 2026)
  B.add(facadeBox(14, 9, 11, 3, '#ffffff'), facadeMat(facTex[0]), 92, 4.5, -72, 0, 0.65);
  const hip = new THREE.ConeGeometry(10, 5, 4, 1); hip.rotateY(Math.PI / 4);
  B.add(hip, roofMat, 92, 11.5, -72, 0, 0.65, 0, 1, 1, 0.8);
  colliders.box(92, -72, 7.2, 5.7, 0.65);

  // ---------------- Bäume (Platanen an den Alleen) ----------------
  const trunks = [], crowns = [];
  const addTree = (x, z, s = 1) => { trunks.push([x, z, s]); crowns.push([x, z, s]); colliders.circle(x, z, 0.45 * s, 'tree'); };
  for (const s of G.roadSegs) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz); if (len < 10) continue; const nx = -dz / len, nz = dx / len;
    for (let t = 6; t < len - 4; t += 11) for (const side of [-1, 1]) {
      const x = s.a[0] + dx / len * t + nx * side * (s.w / 2 + 3.4), z = s.a[1] + dz / len * t + nz * side * (s.w / 2 + 3.4);
      if (pointInPoly(x, z, GLACIS_POLY) || x > 360 || Math.hypot(x + 20, z) > 430) continue;
      if (rand() < 0.75) addTree(x, z, R(0.9, 1.3));
    }
  }
  for (const [x, z] of (G.treeSpots || [])) for (let i = 0; i < 3; i++) addTree(x + R(-5, 5), z + R(-5, 5), R(0.8, 1.4));
  // Park (laut Plan) mit Wegen, Bänken und großen Bäumen
  for (let i = 0; i < 260; i++) { const x = R(-230, 190), z = R(30, 280); if (!pointInPoly(x, z, PARK_POLY) || nearRoad(x, z, 3)) continue; addTree(x, z, R(1.1, 1.8)); }
  for (const [a, b] of [[[-150, 110], [100, 60]], [[-80, 170], [150, 120]], [[-20, 140], [10, 250]], [[90, 70], [120, 210]]]) { const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx); B.add(new THREE.BoxGeometry(len, 0.05, 3), M('#b9a98a', { roughness: 1 }), (a[0] + b[0]) / 2, 0.05, (a[1] + b[1]) / 2, 0, ang);
    for (let t = 10; t < len; t += 25) { const x = a[0] + dx * t / len + Math.sin(ang) * 2.5, z = a[1] + dz * t / len + Math.cos(ang) * 2.5; B.add(new THREE.BoxGeometry(1.8, 0.45, 0.5), M('#5b3a1e'), x, 0.45, z, 0, ang); } }
  for (let i = 0; i < 90; i++) { const x = R(-500, -270), z = R(-70, 230); if (pointInPoly(x, z, CEMETERY_POLY)) addTree(x, z, R(0.9, 1.5)); }
  // Bäume am Glacis-Rand (der Glacis ist von Bäumen gesäumt)
  for (let i = 0; i < GLACIS_POLY.length; i++) { const a = GLACIS_POLY[i], b = GLACIS_POLY[(i + 1) % GLACIS_POLY.length]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const cx = -21, cz = 16;
    for (let t = 4; t < len; t += 12) { let x = a[0] + (b[0] - a[0]) * t / len, z = a[1] + (b[1] - a[1]) * t / len; const ox = x - cx, oz = z - cz, ol = Math.hypot(ox, oz); x += ox / ol * 6; z += oz / ol * 6;
      if (Math.hypot(x - 91, z + 9) < 24) continue; // Platz vor dem Haupttor freihalten
      if (!nearRoad(x, z, 1)) addTree(x, z, R(1.1, 1.5)); } }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 4, 6); trunkGeo.translate(0, 2, 0);
  const crownGeo = new THREE.IcosahedronGeometry(3.2, 2); { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 3.1) * Math.cos(p.getZ(i) * 2.7) + Math.sin(p.getY(i) * 4.3)) * 0.09; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } crownGeo.computeVertexNormals(); } crownGeo.translate(0, 6.2, 0);
  const tIM = new THREE.InstancedMesh(trunkGeo, pbr('bark', { tile: 1.4, color: '#d8d0c0' }), trunks.length);
  const cIM = new THREE.InstancedMesh(crownGeo, pbr('grass', { tile: 1.2, color: '#ffffff', normalScale: 2.5 }), crowns.length);
  const mm = new THREE.Matrix4(), col = new THREE.Color();
  trunks.forEach(([x, z, s], i) => { mm.makeScale(s, s, s); mm.setPosition(x, 0, z); tIM.setMatrixAt(i, mm); });
  crowns.forEach(([x, z, s], i) => { const sy = s * R(0.9, 1.25); mm.makeScale(s * R(0.9, 1.2), sy, s * R(0.9, 1.2)); mm.setPosition(x, 0, z); cIM.setMatrixAt(i, mm); cIM.setColorAt(i, col.setHSL(R(0.22, 0.3), R(0.35, 0.55), R(0.17, 0.27))); });
  tIM.castShadow = cIM.castShadow = true; scene.add(tIM, cIM); G.trees = { list: crowns, trunks: tIM, crowns: cIM };

  // ---------------- Straßenlaternen ----------------
  const lampGeo = new THREE.CylinderGeometry(0.08, 0.12, 6, 6);
  for (const s of G.roadSegs) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz); if (len < 20) continue; const nx = -dz / len, nz = dx / len;
    for (let t = 10; t < len; t += 26) { const x = s.a[0] + dx / len * t + nx * (s.w / 2 + 1), z = s.a[1] + dz / len * t + nz * (s.w / 2 + 1);
      if (x > 370 || Math.hypot(x + 20, z) > 430) continue;
      G.lampSpots = G.lampSpots || []; G.lampSpots.push({ x, z, ang: Math.atan2(-dz, dx) + Math.PI / 2 });
      G.glowSpots = G.glowSpots || []; G.glowSpots.push([x, z, '#ffcf8a', 8]); }
  }

  // ---------------- Autos auf den Straßen ----------------
  G.cars = [];
  const carCols = ['#1b1b1b', '#e0e0e0', '#8a8f96', '#1d3557', '#9b2226', '#2a2a2a', '#f1f1f1', '#344e41'];
  const drivable = ROADS.filter(r => r.pts && !r.name.includes('Allée Scheffer (Nord)'));
  for (let i = 0; i < 26; i++) {
    const r = drivable[i % drivable.length]; const car = { position: new THREE.Vector3(), rotation: { y: 0 }, color: pick(carCols) };
    let lens = [], tot = 0; for (let k = 0; k < r.pts.length - 1; k++) { const l = Math.hypot(r.pts[k + 1][0] - r.pts[k][0], r.pts[k + 1][1] - r.pts[k][1]); lens.push(l); tot += l; }
    G.cars.push({ mesh: car, pts: r.pts, lens, tot, s: R(0, tot), v: R(7, 12), dir: rand() < 0.5 ? 1 : -1, lane: R(1.8, 2.6) });
  }
  // Geparkte Autos am Straßenrand
  for (const s of G.roadSegs) { const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz); if (len < 30 || s.name.startsWith('Rond') || s.name.startsWith('Boulevard')) continue; const nx = -dz / len, nz = dx / len, ang = Math.atan2(-dz, dx);
    for (let t = 8; t < len - 8; t += 6.5) { if (rand() < 0.45) continue; const x = s.a[0] + dx / len * t + nx * (s.w / 2 - 1.1), z = s.a[1] + dz / len * t + nz * (s.w / 2 - 1.1); if (x > 360 || pointInPoly(x, z, GLACIS_POLY)) continue;
      B.at(x, 0, z, ang); for (const [geo, mat] of carParts(pick(carCols))) B.add(geo, mat); B.at(null); colliders.box(x, z, 2.2, 0.95, ang, 'car'); } }
  // Fahrende Autos: instanziert (5 Draw-Calls für alle)
  G.carIM = carInstances(scene, G.cars);

  B.build(scene, { receive: true, cell: 120 });
  bulbs.build(scene);
}

function addPolyCollider(colliders, poly) {
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (const [x, z] of poly) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
  // grob: in Kreise zerlegen
  for (let x = minx; x <= maxx; x += 6) for (let z = minz; z <= maxz; z += 6) if (pointInPoly(x, z, poly)) colliders.circle(x, z, 4.3, 'theatre');
}

const facCache = new Map();
function makeFacade(color) {
  // Fenster-Overlay (transparent, nur Fenster) + Emissive-Map (beleuchtete Fenster in der Nacht)
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
  const em = document.createElement('canvas'); em.width = 256; em.height = 256; const e = em.getContext('2d');
  g.clearRect(0, 0, 256, 256); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const px = 20 + x * 60, py = 22 + y * 60, ww = 28, hh = 42;
    g.fillStyle = '#efe9dd'; g.fillRect(px - 5, py - 6, ww + 10, hh + 12);            // Fenstereinfassung (Sandstein)
    g.fillStyle = '#d9d2c3'; g.fillRect(px - 7, py + hh + 2, ww + 14, 5);             // Fensterbank
    const lit = Math.random() < 0.45; const curtain = Math.random() < 0.5;
    const gr = g.createLinearGradient(px, py, px + ww, py + hh); gr.addColorStop(0, '#5f7488'); gr.addColorStop(0.5, '#25313d'); gr.addColorStop(1, '#3d4c5a');
    g.fillStyle = gr; g.fillRect(px, py, ww, hh);
    if (curtain) { g.fillStyle = 'rgba(235,225,205,0.55)'; g.fillRect(px, py, 9, hh); g.fillRect(px + ww - 9, py, 9, hh); }
    g.fillStyle = '#f4f1ea'; g.fillRect(px + ww / 2 - 1.5, py, 3, hh); g.fillRect(px, py + hh * 0.38, ww, 3);    // Sprossen
    if (Math.random() < 0.25) { g.fillStyle = '#5b6f5a'; g.fillRect(px - 11, py - 2, 9, hh + 4); g.fillRect(px + ww + 2, py - 2, 9, hh + 4); } // Fensterläden
    if (lit) { const c = ['#ffcc80', '#ffe0a8', '#fff2cc', '#ffd59a', '#cfe6ff'][Math.floor(Math.random() * 5)]; const eg = e.createRadialGradient(px + ww / 2, py + hh / 2, 2, px + ww / 2, py + hh / 2, hh * 0.7); eg.addColorStop(0, c); eg.addColorStop(1, '#3a2a18'); e.fillStyle = eg; e.fillRect(px, py, ww, hh); e.fillStyle = '#000'; e.fillRect(px + ww / 2 - 1.5, py, 3, hh); e.fillRect(px, py + hh * 0.38, ww, 3); }
  }
  // Erdgeschoss-Sockel
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const te = new THREE.CanvasTexture(em); te.colorSpace = THREE.SRGBColorSpace; te.wrapS = te.wrapT = THREE.RepeatWrapping;
  return { t, te };
}
/** Hausquader: Fenster-UVs nach Stockwerken skaliert, Fassadenfarbe als Vertex-Farbe -> 1 Material für viele Häuser */
function facadeBox(w, h, d, floors, color) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * floors / 4);
  const c = new THREE.Color(color); const col = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
function facadeMat(ft) {
  const key = ft.t.id;
  if (!facCache.has(key)) {
    const m = pbr('plaster', { tile: 3, color: '#ffffff', vertexColors: true, windowMap: ft.t, emissiveMap: ft.te, emissive: '#ffffff', emissiveIntensity: 1, key: key });
    m.userData.night = true; facCache.set(key, m);
  }
  return facCache.get(key);
}
let _office;
function officeMat() {
  if (_office) return _office;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d');
  g.clearRect(0, 0, 128, 128); for (let y = 0; y < 4; y++) { const gr = g.createLinearGradient(0, y * 32, 0, y * 32 + 22); gr.addColorStop(0, '#7f9bb0'); gr.addColorStop(1, '#2c3e4d'); g.fillStyle = gr; g.fillRect(0, y * 32 + 5, 128, 21); g.fillStyle = '#c9d0d4'; for (let x = 0; x < 128; x += 16) g.fillRect(x, y * 32 + 5, 2, 21); }
  const em = document.createElement('canvas'); em.width = 128; em.height = 128; const e = em.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) if (Math.random() < 0.25) { e.fillStyle = '#dfeeff'; e.fillRect(x * 16 + 2, y * 32 + 5, 14, 21); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const te = new THREE.CanvasTexture(em); te.wrapS = te.wrapT = THREE.RepeatWrapping; te.repeat.set(3, 1.5); te.colorSpace = THREE.SRGBColorSpace;
  _office = pbr('concrete', { tile: 3, color: '#e9ecee', windowMap: t, emissiveMap: te, emissive: '#ffffff', emissiveIntensity: 0.8, key: 'office' });
  _office.userData.night = true; return _office;
}

// Auto aus wenigen Teilen; Karosserie mit Motorhaube, Kabine, Rädern, Lichtern
const CAR = {};
function carGeos() {
  if (CAR.body) return CAR;
  const sh = new THREE.Shape(); sh.moveTo(-2.15, 0.25); sh.lineTo(2.1, 0.25); sh.quadraticCurveTo(2.25, 0.3, 2.2, 0.7); sh.lineTo(1.2, 0.95); sh.lineTo(-1.9, 0.98); sh.quadraticCurveTo(-2.2, 0.95, -2.15, 0.25);
  const body = new THREE.ExtrudeGeometry(sh, { depth: 1.76, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 4 }); body.translate(0, 0, -0.88);
  const cab = new THREE.Shape(); cab.moveTo(-1.55, 0); cab.lineTo(0.95, 0); cab.lineTo(0.35, 0.6); cab.lineTo(-1.25, 0.62); cab.lineTo(-1.55, 0);
  const cabin = new THREE.ExtrudeGeometry(cab, { depth: 1.56, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }); cabin.translate(0, 0.95, -0.78);
  const wl = []; for (const [x, z] of [[1.4, 0.83], [1.4, -0.83], [-1.4, 0.83], [-1.4, -0.83]]) { const g = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12); g.rotateX(Math.PI / 2); g.translate(x, 0.33, z); wl.push(g); }
  const head = [], tail = []; for (const z of [-0.6, 0.6]) { const h = new THREE.BoxGeometry(0.05, 0.12, 0.35); h.translate(2.21, 0.62, z); head.push(h); const t = new THREE.BoxGeometry(0.05, 0.14, 0.4); t.translate(-2.2, 0.72, z); tail.push(t); }
  Object.assign(CAR, { body, cabin, wheels: BGU.mergeGeometries(wl), head: BGU.mergeGeometries(head), tail: BGU.mergeGeometries(tail) });
  return CAR;
}
const carMats = {};
function carPaint(color) { return carMats[color] ||= new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }); }
const glass = new THREE.MeshStandardMaterial({ color: '#0e161d', metalness: 0.9, roughness: 0.06 });
const tyre = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.8 });
export function carParts(color) { const c = carGeos(); return [[c.body, carPaint(color)], [c.cabin, glass], [c.wheels, tyre], [c.head, Glow('#fff4d6', 2.5)], [c.tail, Glow('#ff2020', 2)]]; }
function carInstances(scene, cars) {
  const c = carGeos(); const n = cars.length; const paint = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const ims = [[c.body, paint], [c.cabin, glass], [c.wheels, tyre], [c.head, Glow('#fff4d6', 2.5)], [c.tail, Glow('#ff2020', 2)]].map(([g, m]) => { const im = new THREE.InstancedMesh(g, m, n); im.castShadow = true; im.frustumCulled = false; scene.add(im); return im; });
  const col = new THREE.Color(); cars.forEach((car, i) => ims[0].setColorAt(i, col.set(car.mesh.color)));
  return ims;
}
export function makeCar(color) { const g = new THREE.Group(); for (const [geo, mat] of carParts(color)) g.add(new THREE.Mesh(geo, mat)); return g; }

/** Position entlang einer Polylinie */
export function alongPath(pts, lens, s, out) {
  let i = 0; while (i < lens.length - 1 && s > lens[i]) { s -= lens[i]; i++; }
  const a = pts[i], b = pts[i + 1], t = clamp(s / lens[i], 0, 1);
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); return out;
}

const _cm = new THREE.Matrix4();
export function updateWorld(G, dt) {
  const o = {};
  for (const c of G.cars) {
    c.s += c.v * dt * c.dir; if (c.s > c.tot) { c.s = c.tot; c.dir = -1; } if (c.s < 0) { c.s = 0; c.dir = 1; }
    alongPath(c.pts, c.lens, c.s, o); const ang = o.ang + (c.dir < 0 ? Math.PI : 0);
    c.mesh.position.set(o.x + Math.sin(ang) * -c.lane, 0, o.z + Math.cos(ang) * -c.lane); c.mesh.rotation.y = ang;
    _cm.makeRotationY(ang); _cm.setPosition(c.mesh.position); for (const im of G.carIM) im.setMatrixAt(G.cars.indexOf(c), _cm);
  }
  for (const im of G.carIM) im.instanceMatrix.needsUpdate = true;
  // Tram fährt hin und her und hält an den Haltestellen
  const T = G.tram, P = G.tramPath;
  if (T.wait > 0) T.wait -= dt; else {
    const prev = T.s; T.s += T.speed * dt * T.dir;
    if (T.s > P.total - 10) { T.dir = -1; } if (T.s < 10) T.dir = 1;
    for (const st of G.tramStopS) if ((prev - st) * (T.s - st) < 0) { T.wait = 14; T.atStop = st; }
  }
  alongPath(P.pts, P.lens, T.s, o); T.mesh.position.set(o.x, 0, o.z); T.mesh.rotation.y = o.ang + (T.dir < 0 ? Math.PI : 0);
  T.pos = o;
}
