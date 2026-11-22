// Fortgeschrittene Effekte: planare Spiegelungen, Blätter-Bäume mit Wind, Gras, Suchscheinwerfer,
// Dampf über Essensständen, Linsenreflexe, ziehende Wolken.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { reflU } from './tex.js';
import { R, rand, pick, pointInPoly } from './util.js';
import { PARK_POLY, GLACIS_POLY, CEMETERY_POLY, L } from './data.js';

export const windU = { uTime: { value: 0 }, uWind: { value: 1 } };

// ---------------- Planare Spiegelung ----------------
export function setupReflection(G) {
  const S = G.settings; const scale = { aus: 0, niddreg: 0.35, heich: 0.55, ultra: 0.8 }[S.reflections] || 0;
  if (G.reflector) { G.reflector.parent?.remove(G.reflector); G.reflector.dispose(); G.reflector = null; }
  reflU.uReflOn.value = 0; if (!scale) return;
  const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale);
  const r = new Reflector(new THREE.PlaneGeometry(1400, 1400), { textureWidth: w, textureHeight: h, clipBias: 0.02, color: 0xffffff });
  r.camera.layers.set(1); if (S.reflections === 'ultra') r.camera.layers.enable(0);
  r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, 0); r.material.colorWrite = false; r.material.depthWrite = false; r.renderOrder = -10; r.castShadow = false; r.receiveShadow = false;
  const dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); dummy.needsUpdate = true;
  const orig = r.onBeforeRender.bind(r); const inv = new THREE.Matrix4(); let last = -1;
  r.onBeforeRender = (renderer, scene, camera) => {
    if (G.frameNo === last || camera !== G.camera) return; last = G.frameNo;
    reflU.uRefl.value = dummy; const sh = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    orig(renderer, scene, camera); renderer.shadowMap.autoUpdate = sh;
    r.updateMatrixWorld(); inv.copy(r.matrixWorld).invert(); reflU.uReflMat.value.copy(r.material.uniforms.textureMatrix.value).multiply(inv);
    reflU.uRefl.value = r.getRenderTarget().texture;
  };
  G.scene.add(r); G.reflector = r; reflU.uReflOn.value = 1;
}

/** Markiert alles, was sich im nassen Asphalt spiegeln soll (Layer 1): Licht, Schilder, Fahrgeschäfte, Himmel */
export function tagReflective(G) {
  const on = o => o.layers.enable(1);
  G.scene.traverse(o => { if (o.isLight) on(o); const m = o.material; if (!m) return;
    if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial || m.emissiveIntensity > 0.3 && m.emissiveMap || m.map?.isCanvasTexture && (m.emissiveMap || m.toneMapped === false)) on(o); });
  for (const r of Object.values(G.rides || {})) r.g.traverse(on);
  if (G.sky) on(G.sky); G.lightPool?.forEach(on);
}

// ---------------- Blätter-Bäume (CC0-Blattatlas von ambientCG) ----------------
function clusterTexture(img) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  const cw = img.width / 3, ch = img.height / 3;
  // Zweig
  g.strokeStyle = 'rgba(70,52,35,0.9)'; g.lineWidth = 6; g.beginPath(); g.moveTo(256, 500); g.quadraticCurveTo(250, 300, 270, 60); g.stroke();
  for (let i = 0; i < 70; i++) {
    const t = rand(); const x = 256 + (rand() - 0.5) * 360 * Math.sin(t * Math.PI) + 10, y = 470 - t * 420; const s = 70 + rand() * 60;
    g.save(); g.translate(x, y); g.rotate((rand() - 0.5) * 2.4 + (x < 256 ? -0.6 : 0.6)); g.globalAlpha = 1;
    g.filter = `brightness(${0.75 + rand() * 0.5}) hue-rotate(${(rand() - 0.5) * 20}deg)`;
    const cx = Math.floor(rand() * 3), cy = Math.floor(rand() * 3); g.drawImage(img, cx * cw, cy * ch, cw, ch, -s / 2, -s / 2, s, s); g.restore();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function crownGeo(n, rx, ry, cy, card) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    // Punkt in einem Ellipsoid, eher an der Oberfläche
    const u = rand() * Math.PI * 2, v = Math.acos(rand() * 2 - 1), k = 0.55 + Math.pow(rand(), 0.5) * 0.45;
    const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    const p = new THREE.Vector3(dir.x * rx * k, cy + dir.y * ry * k, dir.z * rx * k);
    const q = new THREE.PlaneGeometry(card, card); q.rotateZ(rand() * Math.PI * 2); q.rotateX(rand() * Math.PI); q.rotateY(rand() * Math.PI * 2); q.translate(p.x, p.y, p.z);
    // Normale radial -> weiche, kugelige Beleuchtung wie bei echtem Laub
    const nrm = q.attributes.normal; for (let j = 0; j < nrm.count; j++) nrm.setXYZ(j, dir.x, dir.y * 0.8 + 0.2, dir.z);
    const ph = new Float32Array(nrm.count).fill(rand() * 6.28); q.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    parts.push(q);
  }
  return BGU.mergeGeometries(parts);
}
function windify(mat, amp = 0.12, base = 3) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, windU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; attribute float aPh;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 _iw = vec4(0.0);
        #ifdef USE_INSTANCING
          _iw = instanceMatrix[3];
        #endif
        float _h = max(0.0, position.y - ${base.toFixed(1)});
        transformed.x += sin(uTime * 1.4 + _iw.x * 0.21 + aPh) * ${amp.toFixed(3)} * _h * uWind * 0.25;
        transformed.z += cos(uTime * 1.1 + _iw.z * 0.17 + aPh * 1.3) * ${amp.toFixed(3)} * _h * uWind * 0.2;`);
  };
}
export async function buildFoliage(G) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/tex/leafset_rgba.webp'; });
  const tex = clusterTexture(img);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, color: '#ffffff' }); windify(mat, 0.12, 3.5);
  const list = G.trees.list; const variants = [crownGeo(80, 3.3, 2.7, 6.6, 1.9), crownGeo(70, 2.8, 3.2, 7.0, 1.8), crownGeo(90, 3.6, 2.5, 6.3, 2.0)];
  const groups = [[], [], []]; list.forEach((t, i) => groups[i % 3].push(t));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  G.foliage = variants.map((geo, vi) => {
    const im = new THREE.InstancedMesh(geo, mat, groups[vi].length);
    groups[vi].forEach(([x, z, s], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * R(0.9, 1.15), s)); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(R(0.2, 0.28), R(0.25, 0.45), R(0.42, 0.6))); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); G.scene.add(im); return im;
  });
  G.trees.crowns.visible = false;
  // Äste
  const br = []; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const b = new THREE.CylinderGeometry(0.06, 0.13, 3.2, 5); b.translate(0, 1.6, 0); b.rotateZ(0.65); b.rotateY(a); b.translate(0, 3.6 + k * 0.25, 0); br.push(b.toNonIndexed()); }
  const brIM = new THREE.InstancedMesh(BGU.mergeGeometries(br), G.trees.trunks.material, list.length);
  list.forEach(([x, z, s], i) => { m4.makeScale(s, s, s); m4.setPosition(x, 0, z); brIM.setMatrixAt(i, m4); }); brIM.castShadow = true; G.scene.add(brIM);
}

// ---------------- Gras ----------------
export function buildGrass(G) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d');
  for (let i = 0; i < 46; i++) { const x = 8 + rand() * 112, h = 50 + rand() * 76, bend = (rand() - 0.5) * 30; g.strokeStyle = `hsl(${85 + rand() * 30},${35 + rand() * 25}%,${22 + rand() * 25}%)`; g.lineWidth = 2 + rand() * 2.5; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + bend * 0.3, 128 - h * 0.6, x + bend, 128 - h); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const parts = []; for (let k = 0; k < 3; k++) { const q = new THREE.PlaneGeometry(0.9, 0.55); q.translate(0, 0.27, 0); q.rotateY(k * Math.PI / 3); const n = q.attributes.normal; for (let j = 0; j < n.count; j++) n.setXYZ(j, 0, 1, 0); q.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(n.count).fill(rand() * 6), 1)); parts.push(q); }
  const geo = BGU.mergeGeometries(parts);
  const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95 }); windify(mat, 0.5, 0.05);
  const pts = []; const tries = G.settings.grass === 'heich' ? 26000 : G.settings.grass === 'niddreg' ? 7000 : 0;
  for (let i = 0; i < tries && pts.length < tries * 0.6; i++) { const x = R(-330, 260), z = R(-260, 300);
    if (pointInPoly(x, z, GLACIS_POLY)) continue; const inPark = pointInPoly(x, z, PARK_POLY); const near = Math.hypot(x + 20, z - 10) < 210;
    if (!inPark && !near) continue; if (G.roadSegs.some(s => distToSeg(x, z, s) < s.w / 2 + 3.2)) continue;
    if (G.buildings.some(b => Math.abs(b.x - x) < b.w * 0.8 && Math.abs(b.z - z) < b.d * 0.8)) continue; pts.push([x, z]); }
  if (!pts.length) return;
  const im = new THREE.InstancedMesh(geo, mat, pts.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  pts.forEach(([x, z], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28); const s = R(0.7, 1.4); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * R(0.7, 1.3), s)); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(R(0.2, 0.27), R(0.3, 0.5), R(0.55, 0.8))); });
  im.receiveShadow = true; im.computeBoundingSphere(); G.scene.add(im); G.grass = im;
}
function distToSeg(px, pz, s) { const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1]; const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, pz - az - t * dz); }

// ---------------- Suchscheinwerfer (Lichtkegel in den Himmel) ----------------
export function buildSearchlights(G) {
  const geo = new THREE.CylinderGeometry(7, 0.35, 160, 24, 1, true); geo.translate(0, 80, 0);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color('#bcd7ff') } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = position.y / 160.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOn; uniform vec3 uCol; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 2.0); float a = pow(1.0 - vH, 1.6) * f * 0.16 * uOn; gl_FragColor = vec4(uCol * a, a); }` });
  G.searchMat = mat; G.searchlights = [];
  const spots = [[97, -6, '#cfe3ff'], [-74, 20, '#ffd6f2'], [33, -14.5, '#d6ffe9'], [104, 48.2, '#fff2c8']];
  for (const [u, v, col] of spots) { const w = L(u, v); const m = new THREE.Mesh(geo, mat.clone()); m.material.uniforms.uCol.value.set(col); m.position.set(w.x, 1, w.z); m.userData.ph = rand() * 6; m.frustumCulled = false; G.scene.add(m); G.searchlights.push(m); }
}

// ---------------- Dampf über Essensständen ----------------
export function buildSteam(G) {
  const emit = G.stalls.filter(s => ['gromper', 'wurscht', 'fesch', 'crepe', 'restaurant', 'kaffi'].includes(s.type)).slice(0, 40);
  const per = 14, N = emit.length * per; const pos = new Float32Array(N * 3), life = new Float32Array(N), seed = new Float32Array(N);
  const P = []; emit.forEach((s, ei) => { for (let k = 0; k < per; k++) { const i = ei * per + k; P.push({ s, t: rand() * 4, i }); seed[i] = rand(); } });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uNight: { value: 0 } },
    vertexShader: `attribute float aLife; attribute float aSeed; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (60.0 + aLife * 140.0) * (1.0 + aSeed) / -mv.z; vA = sin(aLife * 3.14159) * 0.22; }`,
    fragmentShader: `varying float vA; uniform float uNight; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; float a = exp(-r * 3.0) * vA; gl_FragColor = vec4(mix(vec3(0.85), vec3(1.0, 0.85, 0.7), uNight), a); }` });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; G.scene.add(pts);
  G.steam = { pts, P, pos, life, mat };
}

// ---------------- Linsenreflex (Sonne) ----------------
export function buildLensflare(G) {
  const mk = (r, col, ring) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, ring ? 40 : 0, 64, 64, 64); gr.addColorStop(0, ring ? 'rgba(0,0,0,0)' : col); gr.addColorStop(ring ? 0.8 : 0.2, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };
  const lf = new Lensflare();
  lf.addElement(new LensflareElement(mk(1, 'rgba(255,240,210,1)'), 420, 0, new THREE.Color(1, 0.95, 0.85)));
  lf.addElement(new LensflareElement(mk(1, 'rgba(255,200,140,0.5)', true), 120, 0.4));
  lf.addElement(new LensflareElement(mk(1, 'rgba(160,200,255,0.35)'), 70, 0.6));
  lf.addElement(new LensflareElement(mk(1, 'rgba(255,170,120,0.3)'), 160, 0.9));
  const holder = new THREE.PointLight(0xffffff, 0, 1); holder.add(lf); G.scene.add(holder); G.flare = holder;
}

export function updateFx(G, dt) {
  const S = G.settings; windU.uTime.value = G.time; windU.uWind.value = S.weather === 'reen' ? 2.2 : S.weather === 'wolleken' ? 1.4 : 1;
  const night = G.night || 0;
  if (G.searchlights) G.searchlights.forEach((m, i) => { m.visible = S.searchlights && night > 0.2; m.material.uniforms.uOn.value = night * (S.reduceFlash ? 0.5 : 1); const t = G.time * 0.25 + m.userData.ph; m.rotation.set(Math.sin(t) * 0.38, 0, Math.cos(t * 0.8) * 0.38); });
  if (G.steam) { const st = G.steam; st.pts.visible = !!S.steam; st.mat.uniforms.uNight.value = night;
    if (S.steam) for (const p of st.P) { p.t += dt; const L = 4.5; if (p.t > L) p.t -= L; const f = p.t / L; const j = p.i * 3; st.pos[j] = p.s.x + Math.sin(p.i * 1.7 + p.t) * 0.4 * f; st.pos[j + 1] = 3.2 + f * 4.5; st.pos[j + 2] = p.s.z + Math.cos(p.i * 2.3 + p.t * 0.7) * 0.4 * f - 0.6; st.life[p.i] = f; }
    st.pts.geometry.attributes.position.needsUpdate = true; st.pts.geometry.attributes.aLife.needsUpdate = true; }
  if (G.flare) { const sd = G.sunDir; const show = S.lensflare && sd && sd.y > 0.02 && night < 0.3 && (S.weather === 'kloer'); G.flare.visible = !!show; if (show) G.flare.position.copy(G.camera.position).addScaledVector(sd, 1500); }
  G.cloudDrift = (G.cloudDrift || 0) + dt * 0.0006 * windU.uWind.value; // ziehende Wolken
}
