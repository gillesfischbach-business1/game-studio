// Fotorealistische PBR-Materialien (CC0-Fotoscans von Poly Haven) mit Weltraum-Projektion,
// damit Texturen auf allen (auch zusammengefügten) Geometrien maßstabsgetreu kacheln.
import * as THREE from 'three';

const BASE = 'assets/tex/';
export const SETS = {
  asphalt: 'asphalt_02', road: 'asphalt_04', paving: 'rectangular_paving', grass: 'leafy_grass', plaster: 'plastered_wall_05',
  roof: 'grey_roof_tiles', wood: 'brown_planks_05', metal: 'metal_plate', fabric: 'fabric_pattern_07', concrete: 'concrete_floor_02',
  bark: 'bark_platanus', shutter: 'painted_metal_shutter',
};
const NO_DIFF = new Set(['fabric']);
const loader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 8, lowTex = false;
export function configureTextures(renderer, low) { maxAniso = renderer.capabilities.getMaxAnisotropy(); lowTex = low; }

function load(file, srgb) {
  if (texCache.has(file)) return texCache.get(file);
  const t = loader.load(BASE + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = lowTex ? 2 : Math.min(8, maxAniso);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; texCache.set(file, t); return t;
}
export const loadTex = load;

const matCache = new Map();
/**
 * PBR-Material mit Weltraum-UV.
 * @param {string} set   Schlüssel aus SETS
 * @param {object} o     tile (Meter pro Kachel), color (Tönung), roughness, metalness, normalScale, plane ('auto'|'xz'), emissive...
 */
export function pbr(set, o = {}) {
  const key = set + JSON.stringify(o, (k, v) => v instanceof THREE.Texture ? v.uuid : v);
  if (matCache.has(key)) return matCache.get(key);
  const id = SETS[set];
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? '#ffffff', roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
    map: NO_DIFF.has(set) ? null : load(`${id}_diff.jpg`, true),
    normalMap: lowTex && !o.forceNormal ? null : load(`${id}_nor.jpg`, false),
    roughnessMap: load(`${id}_rough.jpg`, false),
    normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1,
    emissive: o.emissive ?? '#000000', emissiveIntensity: o.emissiveIntensity ?? 1, emissiveMap: o.emissiveMap ?? null,
    envMapIntensity: o.envMapIntensity ?? 1, vertexColors: !!o.vertexColors,
  });
  m.userData.tile = o.tile ?? 2; m.userData.set = set; m.userData.wet = o.wet ?? 0;
  worldProject(m, o.tile ?? 2, o.windowMap, o.plane, o.reflect);
  matCache.set(key, m); PBR_MATS.push(m); return m;
}
export const PBR_MATS = [];
export const wetUniform = { value: 0 };
// Planare Spiegelung (wird von fx.js befüllt): nasse Straßen spiegeln die Kirmeslichter
export const reflU = { uRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uReflOn: { value: 0 } };

/** Ersetzt die UV-Koordinaten durch eine dominante-Achsen-Projektion der Weltposition. */
export function worldProject(m, tile, windowMap, plane, reflect) {
  const uTile = { value: 1 / tile };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTile = uTile; sh.uniforms.uWet = wetUniform; m.userData.shader = sh;
    if (reflect) Object.assign(sh.uniforms, reflU);
    if (windowMap) sh.uniforms.uWin = { value: windowMap };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;' + (reflect ? '\nuniform mat4 uReflMat; varying vec4 vRefl;' : ''))
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 _wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          _wp = instanceMatrix * _wp;
        #endif
        _wp = modelMatrix * _wp; vWP = _wp.xyz;
        vec3 _n = objectNormal;
        #ifdef USE_INSTANCING
          _n = mat3(instanceMatrix) * _n;
        #endif
        vWN = normalize(mat3(modelMatrix) * _n);
        ${reflect ? 'vRefl = uReflMat * vec4(vWP, 1.0);' : ''}`);
    let fs = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN; uniform float uTile; uniform float uWet; ${windowMap ? 'uniform sampler2D uWin;' : ''}
        ${reflect ? 'uniform sampler2D uRefl; uniform float uReflOn; varying vec4 vRefl;' : ''}`)
      .replace('void main() {', `void main() {
        vec3 _an = abs(vWN);
        vec2 wuv = ${plane === 'xz' ? 'vWP.xz' : '_an.y > 0.6 ? vWP.xz : (_an.x > _an.z ? vec2(vWP.z, vWP.y) : vec2(vWP.x, vWP.y))'} * uTile;
        ${windowMap ? 'vec4 _win = texture2D(uWin, vEmissiveMapUv);' : ''}`);
    fs = fs.replace(/vMapUv/g, 'wuv').replace(/vNormalMapUv/g, 'wuv').replace(/vRoughnessMapUv/g, 'wuv');
    if (windowMap) {
      fs = fs.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, _win.rgb, _win.a);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.12, _win.a * step(0.5, _win.b - _win.r + 0.5));');
    }
    // Nässe (Regen): dunkler & glänzender auf horizontalen Flächen
    fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float _wet = uWet * smoothstep(0.6, 0.95, _an.y); roughnessFactor = mix(roughnessFactor, 0.08, _wet * 0.85);`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 1.0 - 0.35 * uWet * smoothstep(0.6, 0.95, abs(vWN.y));');
    if (reflect) fs = fs.replace('#include <opaque_fragment>', `
      if (uReflOn > 0.0) {
        vec2 ruv = vRefl.xy / vRefl.w; vec2 off = normal.xy * 0.035; float rr = roughnessFactor;
        vec3 rc = texture2D(uRefl, ruv + off).rgb * 0.4 + texture2D(uRefl, ruv + off + vec2(0.004, 0.0) * rr).rgb * 0.15 + texture2D(uRefl, ruv + off - vec2(0.004, 0.0) * rr).rgb * 0.15 + texture2D(uRefl, ruv + off + vec2(0.0, 0.012) * rr).rgb * 0.15 + texture2D(uRefl, ruv + off - vec2(0.0, 0.012) * rr).rgb * 0.15;
        float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
        float k = uReflOn * (mix(0.08, 0.5, uWet) + fres * 0.3) * (1.0 - rr * 0.45);
        outgoingLight += rc * k;
      }
      #include <opaque_fragment>`);
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'wp' + (windowMap ? 'w' : '') + (plane || '') + (reflect ? 'r' : '');
  m.userData.uTile = uTile;
}

// ---------------- Himmel aus echten HDR-Fotos (Tag / Dämmerung / Nacht) ----------------
export function makeSky() {
  const tl = (f) => { const t = load(f, true); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { tDay: { value: tl('sky_day.jpg') }, tDusk: { value: tl('sky_dusk.jpg') }, tNight: { value: tl('sky_night.jpg') },
      wDay: { value: 1 }, wDusk: { value: 0 }, wNight: { value: 0 }, rot: { value: 0 }, overcast: { value: 0 }, t: { value: 0 }, horizon: { value: new THREE.Color('#1a1a2a') }, stars: { value: 1 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vD; uniform sampler2D tDay, tDusk, tNight; uniform float wDay, wDusk, wNight, rot, overcast, t, stars; uniform vec3 horizon;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.002);
        vec3 dd = normalize(vec3(d.x, y, d.z));
        vec2 uv = vec2(atan(dd.z, dd.x) * 0.15915494 + 0.5 + rot, asin(clamp(dd.y, -1., 1.)) * 0.31830989 + 0.5);
        vec3 c = texture2D(tDay, uv).rgb * wDay + texture2D(tDusk, uv).rgb * wDusk + texture2D(tNight, uv).rgb * wNight * vec3(0.32, 0.38, 0.55);
        float g = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(c, vec3(g) * vec3(0.75, 0.78, 0.82) * (1.0 - 0.4 * wNight), overcast);
        vec3 q = floor(dd * 520.0); float st = step(0.9972, h(q)) * wNight * stars * (1.0 - overcast) * smoothstep(0.08, 0.5, dd.y) * (0.6 + 0.4 * sin(t * 2.5 + h(q) * 50.0));
        c += vec3(st * 0.9);
        // Unterhalb des Horizonts: Dunst/Boden
        c = mix(c, horizon, smoothstep(0.0, -0.08, d.y));
        // warmes Licht der Stadt am Horizont bei Nacht
        c += vec3(0.55, 0.3, 0.12) * wNight * exp(-max(d.y, 0.0) * 18.0) * 0.35;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), mat);
}
