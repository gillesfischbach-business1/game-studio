// Exportiert die statische Spielwelt als glTF-Binary (GLB) + layout.json für Unity/Unreal/Blender.
// Aufruf (im Ordner prototypes/schueberfouer):  node tools/export-world.mjs
// Benötigt Playwright + Chromium (in der Entwicklungsumgebung vorinstalliert) und three in node_modules.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = path.join(ROOT, 'exports');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => console.error('Seitenfehler:', e.message));
await page.route('**/*', async route => {
  const url = route.request().url();
  if (url.startsWith('http://game.local/')) { const p = path.join(ROOT, decodeURIComponent(new URL(url).pathname)); return fs.existsSync(p) ? route.fulfill({ path: p, contentType: p.endsWith('.js') || p.endsWith('.mjs') ? 'text/javascript' : undefined }) : route.fulfill({ status: 404, body: '' }); }
  const m = url.match(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)$/); if (m) return route.fulfill({ path: path.join(ROOT, 'node_modules/three', m[1]), contentType: 'text/javascript' });
  return route.continue().catch(() => route.abort());
});
await page.goto('http://game.local/index.html?q=low', { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#loading.gone'), null, { timeout: 300000 });
const res = await page.evaluate(async () => {
  const THREE = G.THREE; const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const root = new THREE.Scene(); root.name = 'Schueberfouer2026';
  const matCache = new Map();
  const plainMat = (m) => { // PBR-Material ohne Weltraum-Shader: Name = Poly-Haven-Set, damit die Engine das passende Material zuweisen kann
    const key = m.uuid; if (matCache.has(key)) return matCache.get(key);
    const n = new THREE.MeshStandardMaterial({ name: m.userData?.set ? 'PH_' + m.userData.set : (m.name || 'mat'), color: m.color, roughness: m.roughness, metalness: m.metalness, emissive: m.emissive, emissiveIntensity: m.userData?.night ? 0 : m.emissiveIntensity, map: m.userData?.set ? null : (m.map?.image instanceof HTMLCanvasElement && m.map.image.width > 1024 ? null : m.map), side: m.side });
    matCache.set(key, n); return n; };
  const glowMat = (m) => { // Leuchtmaterial (Farbe > 1 für Bloom) -> Standard-PBR mit Emission (KHR_materials_emissive_strength)
    if (matCache.has(m.uuid)) return matCache.get(m.uuid); const c = m.color.clone(); const k = Math.max(1, c.r, c.g, c.b); c.multiplyScalar(1 / k);
    const n = new THREE.MeshStandardMaterial({ name: 'Glow', color: '#000000', emissive: c, emissiveIntensity: k, emissiveMap: m.map, map: null, side: m.side }); matCache.set(m.uuid, n); return n; };
  let meshes = 0;
  G.scene.updateMatrixWorld(true);
  G.scene.traverse(o => {
    if (!(o.isMesh) || !o.visible) return; const m = o.material; if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial) && !(m instanceof THREE.MeshBasicMaterial)) return;
    if (Object.values(G.crowd.im).includes(o)) return; // Menge wird in der Engine animiert neu erzeugt
    let c; if (o.isInstancedMesh) { c = new THREE.InstancedMesh(o.geometry, plainMat(m), o.count); c.instanceMatrix.copy(o.instanceMatrix); if (o.instanceColor) c.instanceColor = o.instanceColor.clone(); }
    else c = new THREE.Mesh(o.geometry, m instanceof THREE.MeshBasicMaterial ? glowMat(m) : plainMat(m));
    c.name = o.name || o.geometry.type; o.matrixWorld.decompose(c.position, c.quaternion, c.scale); root.add(c); meshes++;
  });
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 1024, onlyVisible: true });
  const bytes = new Uint8Array(glb); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const layout = { units: 'meter', axes: 'x = Osten, y = oben, z = Süden; Ursprung = Mitte Glacis (49.6169 N, 6.1241 E)', fairFrame: { center: G.FAIR.C, thetaRad: G.FAIR.theta },
    roads: G.roadSegs.map(s => ({ name: s.name, a: s.a, b: s.b, width: s.w })), tram: G.tramPath.pts,
    rides: Object.values(G.rides).map(r => ({ id: r.id, name: r.name, type: r.cfg.type || r.cfg.style, u: r.cfg.u, v: r.cfg.v, world: G.fairPosToWorld(r.cfg.u, r.cfg.v), price: r.price })),
    stalls: G.stalls.map(s => ({ type: s.type, name: s.name, x: s.x, z: s.z, items: s.T.items || null })),
    buildings: G.buildings, lamps: G.lampSpots, trees: G.trees.list.map(([x, z, s]) => ({ x, z, s })) };
  return { b64: btoa(s), meshes, layout };
});
fs.writeFileSync(path.join(OUT, 'world_raw.glb'), Buffer.from(res.b64, 'base64'));
fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(res.layout, null, 1));
console.log(`Export: ${res.meshes} Meshes -> exports/world_raw.glb, exports/layout.json`);
console.log('Komprimieren: npx @gltf-transform/cli optimize exports/world_raw.glb exports/schueberfouer_world.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false');
await browser.close();
