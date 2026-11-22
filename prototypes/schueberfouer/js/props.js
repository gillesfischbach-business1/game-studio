// Echte 3D-Requisiten (CC0-Fotoscans von Poly Haven, optimiert): Laternen, Bänke, Mülleimer, Fässer,
// Pflanzkästen, Kaffeewagen, Hängelampen. Alles instanziert -> wenige Draw-Calls.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { L, LANES, RESTAURANTS, RESTO_ROW, GATE, PARK_POLY } from './data.js';
import { Bulbs, R, rand, pick, pointInPoly, distSeg } from './util.js';

const FILES = ['street_lamp_01', 'painted_wooden_bench', 'metal_trash_can', 'wooden_barrels_01', 'wine_barrel_01', 'planter_box_01', 'CoffeeCart_01', 'caged_hanging_light'];

export async function loadProps() {
  const loader = new GLTFLoader(); const out = {};
  await Promise.all(FILES.map(f => loader.loadAsync(`assets/models/${f}.gltf.json`).then(g => { out[f] = g.scene; }).catch(e => console.warn('Modell fehlt', f, e))));
  return out;
}

/** Erzeugt InstancedMeshes für alle Teile eines Modells; transforms = [{x,y,z,ry,s}] */
function instance(scene, root, model, transforms, { cast = true, matFix } = {}) {
  if (!model || !transforms.length) return [];
  model.updateMatrixWorld(true); const res = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  model.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const mat = o.material; if (matFix) matFix(mat); mat.envMapIntensity = 1;
    const im = new THREE.InstancedMesh(geo, mat, transforms.length);
    transforms.forEach((t, i) => { e.set(0, t.ry || 0, 0); q.setFromEuler(e); m4.compose(p.set(t.x, t.y || 0, t.z), q, sc.setScalar(t.s || 1)); im.setMatrixAt(i, m4); });
    im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im); res.push(im);
  });
  return res;
}

export function placeProps(G, P) {
  const scene = G.scene, fr = G.fairRoot; const bulbs = new Bulbs();
  // ---------- Straßenlaternen (klassische Mast-Laterne, 3,9 m -> skaliert auf ~5 m) ----------
  const lamps = (G.lampSpots || []).map(s => ({ x: s.x, z: s.z, ry: s.ang, s: 1.3 }));
  instance(scene, scene, P.street_lamp_01, lamps);
  for (const l of lamps) { bulbs.add(l.x, 4.72, l.z, '#ffcf8a', 0, 0, 3.2); G.colliders.circle(l.x, l.z, 0.25, 'lamp'); }
  // ---------- Kirmes: Mülleimer, Bänke, Pflanzkästen entlang der Alleen (lokale Koordinaten) ----------
  const trash = [], bench = [], plant = [], crates = [], barrels = [], wine = [];
  const free = (u, v, r) => !G.footprints.some(f => f.r ? Math.hypot(u - f.u, v - f.v) < f.r + r : Math.abs(u - f.u) < f.hu + r && Math.abs(v - f.v) < f.hv + r);
  for (const ln of LANES) {
    const [ua, va] = ln.a, [ub, vb] = ln.b; const len = Math.hypot(ub - ua, vb - va); if (len < 25) continue; const du = (ub - ua) / len, dv = (vb - va) / len; const nu = -dv, nv = du;
    for (let t = 9; t < len - 5; t += 19) for (const side of [-1, 1]) {
      const u = ua + du * t + nu * side * (ln.w / 2 - 0.55), v = va + dv * t + nv * side * (ln.w / 2 - 0.55);
      if (!free(u, v, 0.6)) continue; const k = (Math.round(t) + (side > 0 ? 1 : 0)) % 3; const ry = Math.atan2(nu * -side, nv * -side);
      if (k === 0) trash.push({ u, v, ry }); else if (k === 1 && ln.w >= 7) bench.push({ u, v, ry }); else plant.push({ u, v, ry: Math.atan2(du, dv) });
    }
  }
  const toFair = arr => arr.map(o => ({ x: o.u, z: o.v, ry: o.ry, s: o.s || 1 }));
  instance(scene, fr, P.metal_trash_can, toFair(trash), { cast: true }); for (const o of trash) G.fairCircle(o.u, o.v, 0.45);
  instance(scene, fr, P.painted_wooden_bench, toFair(bench)); for (const o of bench) G.fairBox(o.u, o.v, 0.6, 0.3, o.ry);
  instance(scene, fr, P.planter_box_01, toFair(plant.map(o => ({ ...o, s: 1.4 })))); for (const o of plant) G.fairBox(o.u, o.v, 0.65, 0.3, o.ry);
  // Grün in den Pflanzkästen (kleine Büsche)
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f7a35', roughness: 0.85 });
  const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 1), leafMat, plant.length * 3); let bi = 0; const m4 = new THREE.Matrix4();
  for (const o of plant) for (let k = -1; k <= 1; k++) { const ox = Math.sin(o.ry) * k * 0.38, oz = Math.cos(o.ry) * k * 0.38; m4.makeScale(1, R(0.8, 1.2), 1); m4.setPosition(o.u + ox, 0.62, o.v + oz); bush.setMatrixAt(bi++, m4); }
  fr.add(bush);
  // Kisten & Fässer hinter Ständen / Restaurants
  for (const r0 of RESTAURANTS) { barrels.push({ u: r0.u - RESTO_ROW.w / 2 - 1.8, v: RESTO_ROW.v - 2, ry: R(0, 6), s: 0.9 }); wine.push({ u: r0.u + 4, v: RESTO_ROW.v + RESTO_ROW.d / 2 + 0.8, ry: R(0, 6) }); }
  instance(scene, fr, P.wooden_barrels_01, toFair(barrels.filter(o => free(o.u, o.v, 1)))); instance(scene, fr, P.wine_barrel_01, toFair(wine));
  for (const o of wine) G.fairCircle(o.u, o.v, 0.42);
  // Hängelampen & Laternen in den Restaurants
  const hang = [], lant = [];
  for (const r0 of RESTAURANTS) { for (const du of [-4, 0, 4]) hang.push({ x: r0.u + du, y: 4.0, z: RESTO_ROW.v, ry: 0 }); for (let x = -RESTO_ROW.w / 2 + 2.2; x < RESTO_ROW.w / 2 - 3.5; x += 3.2) lant.push({ x: r0.u + x, y: 0.81, z: RESTO_ROW.v - 1.1, ry: R(0, 6) }); }
  instance(scene, fr, P.caged_hanging_light, hang, { cast: false });
  const fb = new Bulbs(); for (const h of hang) fb.add(h.x, h.y - 0.45, h.z, '#ffd59a', 0, 0, 3.5); for (const l of lant) fb.add(l.x, l.y + 0.13, l.z, '#ffb347', Math.random(), 2, 2.6); fb.build(fr, 1.2);
  // Kaffeewagen am Haaptentrée
  const cc = { x: GATE.u - 12, z: GATE.v - 6.5, ry: Math.PI * 0.85 }; instance(scene, fr, P.CoffeeCart_01, [cc]); G.fairBox(cc.x, cc.z, 1.4, 0.7, cc.ry);
  const cw = L(cc.x - 1.6, cc.z - 1.2);
  const ref = { type: 'kaffi', T: { sign: 'KAFFISWEEN', items: ['kaffi', 'crepe', 'waasser', 'limonad'], need: 'drink', c1: '#c98a2b' }, x: cw.x, z: cw.z, name: 'Kaffiswee', need: 'drink' };
  G.stalls.push(ref); G.addInteract({ x: cw.x, z: cw.z, r: 2.4, kind: 'stall', need: 'drink', ref, label: () => 'Kaffiswee – Menü', icon: 'drink' });
  // Park: Bänke entlang der Wege
  const pb = []; for (let i = 0; i < 40; i++) { const x = R(-200, 170), z = R(40, 270); if (pointInPoly(x, z, PARK_POLY)) pb.push({ x, z, ry: R(0, 6) }); }
  instance(scene, scene, P.painted_wooden_bench, pb); for (const o of pb) G.colliders.box(o.x, o.z, 0.6, 0.3, o.ry);
  bulbs.build(scene);
}
