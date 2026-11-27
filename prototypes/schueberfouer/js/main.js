// SCHUEBERFOUER 2026 – Hauptprogramm: Renderer, PBR-Licht, HDR-Himmel, Post-FX, Wetter, Spielschleife
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { FAIR, L, TIME, DAYS, TRAM, GATE } from './data.js';
import { Colliders, bulbUniforms, clamp, lerp, smooth } from './util.js';
import { buildWorld, updateWorld, alongPath } from './world.js';
import { buildFair } from './fair.js';
import { buildRides, updateRides } from './rides.js';
import { Crowd } from './npc.js';
import { Player, Input } from './player.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { configureTextures, makeSky, wetUniform, reflU } from './tex.js';
import { loadSettings, saveSettings, PRESETS } from './settings.js';
import { loadProps, placeProps } from './props.js';
import { CloudClient } from './cloud.js';
import { setupReflection, buildFoliage, buildGrass, buildSearchlights, buildSteam, buildLensflare, updateFx, tagReflective } from './fx.js';

const params = new URLSearchParams(location.search);
const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer:coarse)').matches && innerWidth < 1100);

export const G = {
  THREE, BGU, FAIR, isMobile, time: 0, listeners: {}, interacts: [],
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
  emit(ev, ...a) { for (const fn of this.listeners[ev] || []) fn(...a); },
  addInteract(o) { this.interacts.push(o); return o; },
  fairPosToWorld(u, v) { const w = L(u, v); return new THREE.Vector3(w.x, 0, w.z); },
};
window.G = G;
G.settings = loadSettings(isMobile);
G.quality = G.settings.preset;
G.saveSettings = () => saveSettings(G.settings);

// Farbkorrektur, Vignette, Filmkorn, chromatische Aberration, Farbenblind-Korrektur
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.35 }, uGrain: { value: 0.04 }, uSat: { value: 1.05 }, uCon: { value: 1.04 }, uCA: { value: 0.15 }, uCB: { value: new THREE.Matrix3() }, uRain: { value: 0 }, uStyle: { value: 1 }, uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, uNight: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uSat, uCon, uCA, uRain, uStyle, uNight; uniform vec2 uTexel; uniform mat3 uCB; varying vec2 vUv;
    float lum(vec2 p){ return dot(texture2D(tDiffuse, p).rgb, vec3(0.2126, 0.7152, 0.0722)); }
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 3.1) * 43758.5453); }
    void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 o = d * r2 * 0.012 * uCA;
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat); c = (c - 0.5) * uCon + 0.5;
      c = mix(c, c * vec3(0.9, 0.95, 1.05), uRain * 0.4);
      if (uStyle < 0.5) {   // Realistisch: Kino-Farbgebung (warme Lichter, kühle Schatten, weiche S-Kurve)
        float lf = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, c * vec3(1.07, 1.0, 0.9), smoothstep(0.35, 0.95, lf) * 0.55 * (1.0 - uNight));
        c = mix(c, c * vec3(0.93, 0.99, 1.07), (1.0 - smoothstep(0.0, 0.4, lf)) * 0.5);
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
      }
      if (uStyle > 0.5) {   // Neon-Comic: Tuschekonturen, Farbstufen, blaugrüne Schatten, leuchtende Neonfarben
        vec2 e = uTexel * 1.4;
        float tl = lum(vUv + vec2(-e.x, e.y)), tc = lum(vUv + vec2(0.0, e.y)), tr = lum(vUv + e), ml = lum(vUv + vec2(-e.x, 0.0)), mr = lum(vUv + vec2(e.x, 0.0)), bl = lum(vUv - e), bc = lum(vUv - vec2(0.0, e.y)), br = lum(vUv + vec2(e.x, -e.y));
        float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl), gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
        float edge = smoothstep(0.16, 0.42, sqrt(gx * gx + gy * gy) / (0.25 + l));
        float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / (mx + 0.001);
        float steps = 5.0; float q = (floor(l2 * steps) + smoothstep(0.35, 0.65, fract(l2 * steps))) / steps;   // weiche Farbstufen
        c *= (q + 0.02) / (l2 + 0.02);
        vec3 teal = vec3(0.05, 0.36, 0.42);
        float neon = smoothstep(0.22, 0.6, sat) * smoothstep(0.18, 0.55, mx);          // bunte, helle Flächen bleiben Neon
        vec3 base = mix(vec3(l2) * teal * 2.6 + teal * 0.05, c, 0.66);               // der Rest kippt ins Blaugrün
        c = mix(base, c * 1.3, neon) * 1.12;
        c = mix(c, c * vec3(0.9, 1.0, 1.05), 0.5 * (1.0 - uNight));
        c = mix(c, vec3(0.01, 0.035, 0.05), edge * 0.92);                             // Tusche
      }
      c *= 1.0 - uVig * smoothstep(0.15, 0.75, r2 * 1.6);
      c += (rnd(vUv * 1000.0) - 0.5) * uGrain;
      c = uCB * c;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
};
const CB = {
  keen: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  deutan: [0.8, 0.2, 0, 0.26, 0.74, 0, 0.0, 0.14, 0.86], protan: [0.57, 0.43, 0, 0.56, 0.44, 0, 0, 0.24, 0.76], tritan: [0.95, 0.05, 0, 0, 0.43, 0.57, 0, 0.48, 0.52],
};

async function boot() {
  const setLoad = (p, t) => G.ui?.loading(p, t);
  G.ui = new UI(G); setLoad(0.05, 'Schrëften lueden …');
  try { await Promise.race([Promise.all([document.fonts.load('40px Bungee'), document.fonts.load('40px Creepster'), document.fonts.load('40px Oswald')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  const S = G.settings;
  const renderer = new THREE.WebGLRenderer({ stencil: false, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
  renderer.setSize(innerWidth, innerHeight); renderer.info.autoReset = false;
  renderer.shadowMap.type = parseInt(THREE.REVISION) > 180 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;   // PCFSoft wurde in neuen three-Versionen entfernt
  document.getElementById('game').appendChild(renderer.domElement);
  configureTextures(renderer, !S.texHigh);
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, 0.1, 2200);
  Object.assign(G, { renderer, scene, camera, colliders: new Colliders(16) });
  scene.fog = new THREE.FogExp2('#0b1026', 0.0028);
  const sky = makeSky(); scene.add(sky); G.sky = sky;
  const pmrem = new THREE.PMREMGenerator(renderer);
  G.env = {};
  for (const k of ['day', 'night']) new THREE.TextureLoader().load(`assets/tex/env_${k}.jpg`, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; G.env[k] = pmrem.fromEquirectangular(t).texture; t.dispose(); });
  const hemi = new THREE.HemisphereLight('#bcd4ff', '#5a5650', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
  scene.add(sun, sun.target);
  Object.assign(G, { hemi, sun, lightPool: [] });
  setLoad(0.2, 'Stad Lëtzebuerg bauen …'); await frame();
  G.price = (p, kind) => G.game ? G.game.price(p, kind) : p;
  buildWorld(G);
  setLoad(0.4, 'Fouer opriichten …'); await frame();
  buildFair(G);
  setLoad(0.55, 'Attraktiounen montéieren …'); await frame();
  buildRides(G);
  G.finishFair();
  setLoad(0.62, '3D-Modeller & Beem lueden …');
  try { placeProps(G, await loadProps()); } catch (e) { console.warn('Props', e); }
  try { await buildFoliage(G); } catch (e) { console.warn('Foliage', e); }
  buildGrass(G); buildSearchlights(G); buildSteam(G); buildLensflare(G);
  scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.material?.transparent && !(o.material instanceof THREE.ShaderMaterial) && !(o.material instanceof THREE.MeshBasicMaterial)) { o.geometry.computeBoundingSphere?.(); o.castShadow = (o.geometry.boundingSphere?.radius ?? 0) < 70; o.receiveShadow = true; } });
  G.lightSpots = (G.lightSpots || []).concat(Object.values(G.rides).map(r => ({ u: r.cfg.u, v: r.cfg.v, color: r.col || '#ffd9a0' })));
  G.lightSpotsW = G.lightSpots.map(s => { const w = L(s.u, s.v); return { x: w.x, z: w.z, color: new THREE.Color(s.color) }; });
  for (const s of G.stalls) G.lightSpotsW.push({ x: s.x, z: s.z, color: new THREE.Color(s.T.c1 || '#ffd59a') });
  G.tramStopS = TRAM.stops.map(st => { let best = 0, bd = 1e9; for (let s = 0; s < G.tramPath.total; s += 1) { const o = alongPath(G.tramPath.pts, G.tramPath.lens, s, {}); const d = Math.hypot(o.x - st.x, o.z - st.z); if (d < bd) { bd = d; best = s; } } return best; });

  setLoad(0.7, 'Leit op d\'Fouer schécken …'); await frame();
  G.crowd = new Crowd(G, isMobile ? Math.max(S.crowd, 150) : 1200);
  G.player = new Player(G);
  const start = L(GATE.u + 9, GATE.v + 4.5); const look = L(60, 30);
  G.player.spawn(start.x, start.z, Math.atan2(look.x - start.x, look.z - start.z));
  G.input = new Input(G, renderer.domElement);
  G.audio = new Audio(G);
  G.game = new Game(G);
  G.rain = makeRain(); scene.add(G.rain); G.cloud = new CloudClient(G);
  setLoad(0.9, 'Luuchten unmaachen …'); await frame();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.blendIntensity = 0.85; composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.3, 0.88); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
  const smaa = new SMAAPass(innerWidth, innerHeight); composer.addPass(smaa);
  Object.assign(G, { composer, bloom, gtao, grade, fxaa, smaa });
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const pr = Math.min(devicePixelRatio, isMobile ? 1.5 : 2) * G.settings.renderScale * (G.dynScale || 1); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); grade.uniforms.uTexel.value.set(1 / Math.max(640, innerWidth), 1 / Math.max(360, innerHeight)); };
  addEventListener('resize', resize); G.resize = resize;
  G.applySettings = applySettings; applySettings(true); tagReflective(G); setupReflection(G); G._refl = G.settings.reflections;

  G.minutes = TIME.start; G.day = DAYS[0];
  applyTime(0);
  G.running = params.has('shot');
  G.ui.ready();
  G.ui.loading(1, '');
  let last = performance.now(); let acc = 0, frames = 0, ema = 16.7, dynT = 0; G.dynScale = 1; renderer.shadowMap.autoUpdate = false; const lastShadowPos = new THREE.Vector3(1e9, 0, 0); let shadowAge = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(); const raw = now - last;
    if (G.settings.fpsCap && raw < 1000 / G.settings.fpsCap - 1.5) return; // Bildrate-Limit (Akku)
    let dt = Math.min(0.05, raw / 1000); last = now; acc += raw / 1000; frames++;
    if (acc > 0.5) { G.fps = frames / acc; acc = 0; frames = 0; }
    // Dynamische Auflösung: Ziel ~60 FPS (16,7 ms); mehr Spielraum bei Bildrate-Limit
    ema = ema * 0.94 + raw * 0.06; dynT += raw;
    if (G.settings.dynRes && G.ui.started && dynT > 700) { dynT = 0; const target = G.settings.fpsCap ? 1000 / G.settings.fpsCap : 16.7;
      const prev = G.dynScale; if (ema > target * 1.12) G.dynScale = Math.max(0.5, G.dynScale - 0.08); else if (ema < target * 0.8) G.dynScale = Math.min(1, G.dynScale + 0.04);
      if (prev !== G.dynScale) G.resize(); }
    // Schatten nur neu berechnen, wenn nötig (Bewegung, Zeit, alle paar Bilder für Fahrgeschäfte)
    shadowAge++; const pp = G.player?.pos; const moved = pp ? pp.distanceToSquared(lastShadowPos) > 4 : true;
    if (renderer.shadowMap.enabled && (moved || shadowAge >= (G.night > 0.5 ? 8 : 3))) { renderer.shadowMap.needsUpdate = true; shadowAge = 0; if (pp) lastShadowPos.copy(pp); }
    G.frameNo = (G.frameNo || 0) + 1; const f0 = performance.now(); step(dt); pt('step', f0);
    const r0 = performance.now(); renderer.info.reset(); if (G.cloudActive) { /* Bild kommt aus der Cloud */ } else if (G.altRender) G.altRender(dt); else composer.render(); pt('render', r0); G.drawCalls = renderer.info.render.calls; G.tris = renderer.info.render.triangles;
    if (G.wantShot) { const f = G.wantShot; G.wantShot = null; f(renderer.domElement.toDataURL('image/png')); }
  });
}
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

/** Übernimmt alle Einstellungen (Grafik, Kamera, Ton, Spiel, Barrierefreiheit). */
function applySettings(first = false) {
  const S = G.settings, r = G.renderer;
  if (S.preset && PRESETS[S.preset] && G._lastPreset !== S.preset && !first) Object.assign(S, PRESETS[S.preset]);
  G._lastPreset = S.preset;
  r.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[S.tonemap] || THREE.ACESFilmicToneMapping;
  const sm = { aus: 0, niddreg: 1024, heich: 2048, ultra: 4096 }[S.shadows] || 0; const was = r.shadowMap.enabled;
  r.shadowMap.enabled = sm > 0; G.sun.castShadow = sm > 0;
  if (sm && G.sun.shadow.mapSize.x !== sm) { G.sun.shadow.mapSize.set(sm, sm); G.sun.shadow.map?.dispose(); G.sun.shadow.map = null; }
  const ext = { 1024: 45, 2048: 60, 4096: 80 }[sm] || 60; Object.assign(G.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); G.sun.shadow.camera.updateProjectionMatrix();
  if (was !== r.shadowMap.enabled) G.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
  while (G.lightPool.length < S.lights) { const p = new THREE.PointLight('#ffffff', 0, 26, 1.6); p.layers.enable(1); G.scene.add(p); G.lightPool.push(p); }
  while (G.lightPool.length > S.lights) G.scene.remove(G.lightPool.pop());
  G.gtao.enabled = !!S.ao; G.fxaa.enabled = S.aa === 'fxaa'; G.smaa.enabled = S.aa === 'smaa';
  const u = G.grade.uniforms; u.uVig.value = S.vignette; u.uGrain.value = S.grain; u.uSat.value = S.saturation; u.uCon.value = S.contrast; u.uCA.value = S.chroma; u.uCB.value.fromArray(CB[S.colorblind] || CB.keen).transpose(); u.uStyle.value = S.artStyle === 'neon' ? 1 : 0; document.body.classList.toggle('neon', S.artStyle === 'neon');
  G.camera.fov = S.fov; G.camera.updateProjectionMatrix();
  G.resize?.();
  if (G.crowd) G.crowd.setActive(S.crowd);
  bulbUniforms.uCalm.value = S.reduceFlash ? 1 : 0;
  G.audio?.setVolumes(S);
  document.documentElement.style.setProperty('--ui-scale', S.uiScale);
  document.body.classList.toggle('hc', !!S.highContrast);
  G.ui?.applyHud?.();
  if (G.player) G.player.camDistT = S.camDist;
  if (!first && G._refl !== S.reflections) { G._refl = S.reflections; setupReflection(G); }
  if (!first) G.saveSettings();
}

const _c2 = new THREE.Color();
/** Tageszeit + Wetter -> Himmel, Licht, Nebel, Reflexionen, Bloom */
function applyTime(dt) {
  const S = G.settings; const m = G.minutes % (24 * 60);
  const dayFrac = (m - 6.8 * 60) / ((20.55 - 6.8) * 60); const elev = Math.sin(clamp(dayFrac, -0.25, 1.25) * Math.PI) * 0.95;
  const night = smooth(clamp((-elev + 0.05) / 0.32, 0, 1)); G.night = night;
  const dusk = clamp(1 - Math.abs(elev - 0.03) / 0.2, 0, 1) * (1 - night * 0.7);
  const w = S.weather; const over = w === 'reen' ? 1 : w === 'wolleken' ? 0.55 : 0; G._over = G._over === undefined || !dt ? over : lerp(G._over, over, Math.min(1, dt * 0.5));
  const ov = G._over;
  const az = Math.PI * (0.35 + dayFrac * 1.2);
  const sd = new THREE.Vector3(Math.cos(az) * Math.cos(Math.max(elev, -0.2)), Math.sin(elev), Math.sin(az) * Math.cos(Math.max(elev, -0.2))).normalize();
  const su = G.sky.material.uniforms; const wd = Math.max(0, 1 - night - dusk), wk = dusk, wn = night; const sum = wd + wk + wn || 1;
  su.wDay.value = wd / sum; su.wDusk.value = wk / sum; su.wNight.value = wn / sum; su.overcast.value = ov * 0.85; su.t.value = G.time; su.rot.value = -az / (Math.PI * 2) + 0.2 + (G.cloudDrift || 0); G.sunDir = sd;
  su.horizon.value.set('#7d8a96').lerp(_c2.set('#ff9a62'), dusk * 0.5).lerp(_c2.set('#0c0d1a'), night);
  G.scene.fog.color.copy(su.horizon.value).lerp(_c2.set('#8a8f96'), ov * (1 - night) * 0.6);
  G.scene.fog.density = lerp(0.0019, 0.0022, night) * (1 + ov * 1.4) / S.drawDist;
  const sunI = Math.max(0, elev) * 2.8 * (1 - ov * 0.7); G.sun.intensity = night > 0.5 ? 0.3 : sunI + 0.05;
  G.sun.color.set(night > 0.5 ? '#8fa6ff' : '#fff1dc').lerp(_c2.set('#ff8c4a'), dusk * 0.6);
  const P = G.player?.pos || new THREE.Vector3();
  const lightDir = night > 0.5 ? new THREE.Vector3(-0.4, 0.8, -0.5).normalize() : sd;
  G.sun.position.set(P.x + lightDir.x * 150, Math.max(25, lightDir.y * 150), P.z + lightDir.z * 150); G.sun.target.position.set(P.x, 0, P.z);
  // Nachts hellen tausende Lampen die Fouer auf: warmes Streulicht vom Boden, im Gelände stärker als draußen
  const fairLit = night * (G.audio?.inFair ?? 0.8);
  G.hemi.intensity = (lerp(0.55, 0.2, night) + fairLit * 0.12) * (1 - ov * 0.2); G.hemi.color.set('#bcd4ff').lerp(_c2.set('#4b4f8a'), night); G.hemi.groundColor.set('#5a5650').lerp(_c2.set('#7a5232'), fairLit);
  const env = night > 0.5 ? G.env.night : G.env.day; if (env && G.scene.environment !== env) G.scene.environment = env;
  G.scene.environmentIntensity = night > 0.5 ? lerp(0.25, 0.45, ov) : lerp(1.0, 0.7, ov) * (0.35 + 0.65 * Math.max(0.2, 1 - dusk * 0.6));
  const neonSt = S.artStyle === 'neon'; G.grade.uniforms.uNight.value = night;
  if (neonSt) G.scene.fog.color.lerp(_c2.set('#0b3a44'), lerp(0.3, 0.12, night));
  G.renderer.toneMappingExposure = lerp(0.9, 1.0, night) * S.exposure;
  if (G.bloom) { G.bloom.strength = lerp(0.18, 0.62, night) * S.bloom * (neonSt ? 1.2 : 1); G.bloom.threshold = lerp(0.97, 0.88, night); G.bloom.radius = 0.28; }
  bulbUniforms.uOn.value = lerp(0.6, 1, night);
  if (G.glowMat) G.glowMat.opacity = lerp(0.04, 0.56, night) * (1 - wetUniform.value * 0.35);
  if (!G._nightMats) { G._nightMats = []; G.scene.traverse(o => { if (o.material?.userData?.night && !G._nightMats.includes(o.material)) G._nightMats.push(o.material); }); }
  for (const mt of G._nightMats) mt.emissiveIntensity = night * 0.9;
  if (G.gatePanelMat) G.gatePanelMat.emissiveIntensity = 0.05 + night * 0.3;
  const raining = w === 'reen'; wetUniform.value = dt ? lerp(wetUniform.value, raining ? 1 : 0, Math.min(1, dt * 0.3)) : (raining ? 1 : 0);
  G.rain.visible = raining; G.rain.material.uniforms.uTime.value = G.time; G.rain.position.copy(G.camera.position);
  G.grade.uniforms.uRain.value = wetUniform.value; G.grade.uniforms.uTime.value = G.time;
  reflU.uReflOn.value = G.reflector ? Math.min(1, 0.25 + 0.75 * night + wetUniform.value) : 0;
}
G.applyTimeNow = () => applyTime(0);

function makeRain() {
  const N = 5000; const base = new Float32Array(N * 2 * 3); const end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 70, y = Math.random() * 30, z = (Math.random() - 0.5) * 70; for (let k = 0; k < 2; k++) { base.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(base, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aEnd; uniform float uTime; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uTime * 14.0, 30.0) - 8.0 - aEnd * 0.7; p.x -= aEnd * 0.12; vA = 0.35 - aEnd * 0.25; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.8, 0.9, vA); }` });
  const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.visible = false; return l;
}

let lightTimer = 0, flyT = 0;
const PT = {}; const pt = (k, t0) => { PT[k] = (PT[k] || 0) * 0.9 + (performance.now() - t0) * 0.1; };
G.prof = PT;
function step(dt) {
  const S = G.settings; const realDt = dt; G.time += dt; bulbUniforms.uTime.value = G.time; let t0;
  const paused = G.ui.paused();
  if (paused) dt = 0;
  if (!paused && G.running && S.cycle) G.minutes += dt * TIME.minutesPerSecond * S.timeScale;
  const inp = G.input; inp.poll();
  if (!G.ui.started) { // Titelbildschirm: Kameraflug über die Fouer
    flyT += realDt * 0.035; updateWorld(G, realDt); updateRides(G, realDt); G.crowd.update(realDt, G.player);
    const c = G.fairPosToWorld(-10, 0); G.camera.position.set(c.x + Math.cos(flyT) * 120, 42 + Math.sin(flyT * 0.7) * 8, c.z + Math.sin(flyT) * 95); G.camera.lookAt(c.x, 8, c.z);
  } else if (!paused) {
    t0 = performance.now(); updateWorld(G, dt); pt('world', t0); t0 = performance.now(); updateRides(G, dt); pt('rides', t0);
    t0 = performance.now(); G.player.update(dt, G.ui.blockInput() ? { lookX: 0, lookY: 0, wheel: 0, moveX: 0, moveY: 0 } : inp); pt('player', t0);
    t0 = performance.now(); G.crowd.update(dt, G.player); pt('crowd', t0);
    t0 = performance.now(); G.game.update(dt); pt('game', t0);
  } else if (G.ui.menuCam) G.ui.menuCam(realDt);
  t0 = performance.now(); updateFx(G, realDt); pt('fx', t0);
  t0 = performance.now(); applyTime(realDt); pt('time', t0);
  lightTimer -= realDt;
  if (lightTimer < 0 && G.lightSpotsW) {
    lightTimer = 0.35; const p = G.ui.started ? G.player.pos : G.camera.position;
    const near = G.lightSpotsW.map(s => [s, (s.x - p.x) ** 2 + (s.z - p.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, G.lightPool.length);
    G.lightPool.forEach((l, i) => { const s = near[i]?.[0]; if (!s) { l.intensity = 0; return; } l.position.set(s.x, 4.5, s.z); l.color.copy(s.color); l.intensity = 38 * G.night; });
  }
  t0 = performance.now(); G.ui.update(realDt); pt('ui', t0);
  inp.endFrame();
}

boot().catch(e => { console.error(e); const el = document.getElementById('err'); if (el) { el.style.display = 'block'; el.textContent = 'Feeler beim Lueden: ' + e.message; } });
