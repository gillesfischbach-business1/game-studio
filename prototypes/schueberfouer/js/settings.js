// Einstellungen: Standardwerte, Presets, Speichern (localStorage, optional) und Beschreibung fürs Optionsmenü
export const PRESETS = {
  niddreg: { reflections: 'aus', grass: 'aus', steam: false, renderScale: 0.75, shadows: 'aus', ao: false, bloom: 0.8, aa: 'fxaa', crowd: 220, lights: 2, texHigh: false, drawDist: 0.8, grain: 0, vignette: 0.25 },
  mettel: { reflections: 'niddreg', grass: 'niddreg', steam: true, renderScale: 1, shadows: 'niddreg', ao: false, bloom: 1, aa: 'fxaa', crowd: 450, lights: 4, texHigh: true, drawDist: 1, grain: 0.04, vignette: 0.35 },
  heich: { reflections: 'heich', grass: 'heich', steam: true, renderScale: 1, shadows: 'heich', ao: false, bloom: 1, aa: 'smaa', crowd: 750, lights: 6, texHigh: true, drawDist: 1.2, grain: 0.05, vignette: 0.35 },
  ultra: { reflections: 'ultra', grass: 'heich', steam: true, renderScale: 1.25, shadows: 'ultra', ao: true, bloom: 1.1, aa: 'smaa', crowd: 1100, lights: 10, texHigh: true, drawDist: 1.4, grain: 0.05, vignette: 0.4 },
};
export const DEFAULTS = {
  // Grafik
  preset: 'heich', ...PRESETS.heich, fov: 65, tonemap: 'aces', searchlights: true, lensflare: true, dynRes: true, fpsCap: 0, exposure: 1, saturation: 1.05, contrast: 1.04, chroma: 0.15, showFps: false,
  // Kamera
  sens: 1, invertY: false, camDist: 5.2, headBob: true, shake: true, autoCenter: false,
  // Toun
  vMaster: 0.8, vMusic: 0.7, vSfx: 0.9, vAmb: 0.8,
  // Spill
  timeScale: 1, cycle: true, weather: 'kloer', hudMini: true, hudMission: true, hudKeys: true, hudPrompt: true, guideArrows: true, autosave: true,
  // Accessibilitéit
  artStyle: 'real', uiScale: 1, reduceFlash: false, reduceMotion: false, colorblind: 'keen', subtitles: true, highContrast: false,
  // Steierung
  cloudUrl: '', cloudToken: '',
  keys: { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', jump: 'Space', act: 'KeyE', compass: 'KeyQ', map: 'KeyM', journal: 'KeyJ', wardrobe: 'KeyI', view: 'KeyV', photo: 'KeyP', time: 'KeyT' },
  // Aussehen der Figur
  look: { skin: '#e8b98f', hair: '#3b2a1a', hairStyle: 0, shirt: '#2b2d42', pants: '#1d3557', shoes: '#1a1a1a', height: 1.0 },
};
export const KEY_LABELS = { fwd: 'Vir', back: 'Zeréck', left: 'Lénks', right: 'Riets', run: 'Lafen', jump: 'Sprangen', act: 'Aktioun', compass: 'Fouer-Kompass', map: 'Kaart', journal: 'Missiounen', wardrobe: 'Garderob', view: 'Kamera 1./3. Persoun', photo: 'Foto', time: '+30 Minutten' };

export function loadSettings(isMobile) {
  let s = structuredClone(DEFAULTS);
  if (isMobile) Object.assign(s, { preset: 'mettel', ...PRESETS.mettel, renderScale: 0.85, shadows: 'aus', reflections: 'aus', grass: 'aus', crowd: 280, lights: 2, steam: false });
  try { const d = JSON.parse(localStorage.getItem('fouer2026_settings') || 'null'); if (d) { s = { ...s, ...d, keys: { ...s.keys, ...(d.keys || {}) }, look: { ...s.look, ...(d.look || {}) } }; } } catch (e) { /* ohne Speicher */ }
  const q = new URLSearchParams(location.search).get('q'); const map = { low: 'niddreg', mid: 'mettel', high: 'heich', ultra: 'ultra' };
  if (q && map[q]) Object.assign(s, { preset: map[q], ...PRESETS[map[q]] });
  return s;
}
export function saveSettings(s) { try { localStorage.setItem('fouer2026_settings', JSON.stringify(s)); } catch (e) { } }

// Beschreibung der Optionen für das Menü (Kategorie -> Einträge)
// t: 'sel' Auswahl, 'sld' Schieberegler, 'tog' Schalter, 'btn' Knopf
export const OPTION_PAGES = [
  { id: 'grafik', label: 'Grafik', items: [
    { k: 'artStyle', t: 'sel', l: 'Grafikstil', o: [['real', 'Realistesch'], ['neon', 'Neon-Comic']], d: 'Neon-Comic: Tuschekonturen, Faarfstufen an Neonfaarwen. Realistesch: fotorealistesch Duerstellung.' },
    { k: 'preset', t: 'sel', l: 'Qualitéits-Preset', o: [['niddreg', 'Niddreg'], ['mettel', 'Mëttel'], ['heich', 'Héich'], ['ultra', 'Ultra']], d: 'Setzt all Grafik-Optiounen op eemol.' },
    { k: 'dynRes', t: 'tog', l: 'Dynamesch Opléisung (flësseg 60 FPS)', d: 'Reduzéiert d\'Opléisung automatesch, wann d\'Bildrate ënner 55 FPS fält, a geet erëm erop, soubal et flësseg leeft.' },
    { k: 'fpsCap', t: 'sel', l: 'Bildrate-Limit', o: [[0, 'Keen'], [30, '30 FPS (Akku spueren)'], [60, '60 FPS']] },
    { k: 'renderScale', t: 'sld', l: 'Opléisungs-Skaléierung', min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + ' %', d: 'Méi niddreg = méi séier, méi héich = méi scharf.' },
    { k: 'shadows', t: 'sel', l: 'Schatten', o: [['aus', 'Aus'], ['niddreg', 'Niddreg'], ['heich', 'Héich'], ['ultra', 'Ultra']] },
    { k: 'ao', t: 'tog', l: 'Ambient Occlusion (GTAO)', d: 'Realistesch Kontaktschatten an Ecken. Brauch eng staark Grafikkaart.' },
    { k: 'reflections', t: 'sel', l: 'Spigelungen (Asphalt & Stroossen)', o: [['aus', 'Aus'], ['niddreg', 'Niddreg'], ['heich', 'Héich'], ['ultra', 'Ultra (mat Leit)']], d: 'Planar Reflexiounen: d\'Kirmesluuchten spigele sech am Asphalt – besonnesch bei Reen.' },
    { k: 'grass', t: 'sel', l: 'Gras & Vegetatioun', o: [['aus', 'Aus'], ['niddreg', 'Niddreg'], ['heich', 'Héich']], d: 'Gëllt nom Neistart.' },
    { k: 'searchlights', t: 'tog', l: 'Sichscheinwerfer am Himmel' },
    { k: 'steam', t: 'tog', l: 'Damp iwwer de Fritten- a Fëschstänn' },
    { k: 'lensflare', t: 'tog', l: 'Lens-Flare (Sonn)' },
    { k: 'aa', t: 'sel', l: 'Kantenglättung', o: [['aus', 'Aus'], ['fxaa', 'FXAA'], ['smaa', 'SMAA']] },
    { k: 'bloom', t: 'sld', l: 'Luucht-Bloom', min: 0, max: 1.6, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'lights', t: 'sld', l: 'Dynamesch Luuchten', min: 2, max: 16, step: 1, fmt: v => v, d: 'Zuel vun echte Liichtquellen ronderëm dech.' },
    { k: 'crowd', t: 'sld', l: 'Visiteuren op der Fouer', min: 0, max: 1200, step: 50, fmt: v => v },
    { k: 'drawDist', t: 'sld', l: 'Siichtwäit / Niwwel', min: 0.6, max: 1.6, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'texHigh', t: 'tog', l: 'Héichopléisend Texturen (Normal-Maps)', d: 'Gëllt nom Neistart.' },
    { k: 'fov', t: 'sld', l: 'Siichtfeld (FOV)', min: 50, max: 100, step: 1, fmt: v => v + '°' },
    { k: 'tonemap', t: 'sel', l: 'Tone-Mapping', o: [['aces', 'Filmesch (ACES)'], ['agx', 'Neutral (AgX)'], ['neutral', 'Khronos Neutral']] },
    { k: 'exposure', t: 'sld', l: 'Hellegkeet', min: 0.5, max: 1.8, step: 0.05, fmt: v => v.toFixed(2) },
    { k: 'contrast', t: 'sld', l: 'Kontrast', min: 0.8, max: 1.3, step: 0.01, fmt: v => v.toFixed(2) },
    { k: 'saturation', t: 'sld', l: 'Faarfsättegung', min: 0.5, max: 1.5, step: 0.01, fmt: v => v.toFixed(2) },
    { k: 'vignette', t: 'sld', l: 'Vignette', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'grain', t: 'sld', l: 'Filmkär', min: 0, max: 0.15, step: 0.01, fmt: v => Math.round(v * 100) },
    { k: 'chroma', t: 'sld', l: 'Chromatesch Aberratioun', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'showFps', t: 'tog', l: 'FPS uweisen' },
  ] },
  { id: 'kamera', label: 'Kamera & Maus', items: [
    { k: 'sens', t: 'sld', l: 'Maus-/Touch-Empfindlechkeet', min: 0.2, max: 3, step: 0.05, fmt: v => v.toFixed(2) },
    { k: 'invertY', t: 'tog', l: 'Y-Achs ëmdréinen' },
    { k: 'camDist', t: 'sld', l: 'Kameradistanz (3. Persoun)', min: 2.2, max: 12, step: 0.1, fmt: v => v.toFixed(1) + ' m' },
    { k: 'headBob', t: 'tog', l: 'Kapp-Wippen (1. Persoun)' },
    { k: 'shake', t: 'tog', l: 'Kamera-Wackelen bei Stéiss' },
    { k: 'autoCenter', t: 'tog', l: 'Kamera automatesch hannert d\'Figur' },
  ] },
  { id: 'toun', label: 'Toun', items: [
    { k: 'vMaster', t: 'sld', l: 'Gesamtlautstäerkt', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'vMusic', t: 'sld', l: 'Musek (Attraktiounen, Blosmusek)', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'vSfx', t: 'sld', l: 'Effekter', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'vAmb', t: 'sld', l: 'Ambiance (Leit, Stad)', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'subtitles', t: 'tog', l: 'Ënnertitel fir Geräischer' },
  ] },
  { id: 'spill', label: 'Spill & Zäit', items: [
    { k: '_time', t: 'sld', l: 'Auerzäit', min: 12, max: 25, step: 0.25, fmt: v => { const m = Math.round(v * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }, d: 'Dag/Nuecht direkt astellen (Fouer: 12:00 – 01:00).' },
    { k: '_daypreset', t: 'sel', l: 'Liichtstëmmung', o: [['', '–'], ['15', 'Nomëtteg (15:00)'], ['19.5', 'Owend (19:30)'], ['20.7', 'Sonnenënnergang (20:40)'], ['21.5', 'Blo Stonn (21:30)'], ['23', 'Nuecht (23:00)']] },
    { k: 'cycle', t: 'tog', l: 'Dag/Nuecht-Zyklus leeft', d: 'Aus = d\'Zäit bleift stoen.' },
    { k: 'timeScale', t: 'sel', l: 'Zäitgeschwindegkeet', o: [[0.5, '½ Minutt / Sek.'], [1, '1 Minutt / Sek.'], [2, '2 Minutten / Sek.'], [5, '5 Minutten / Sek.'], [15, '15 Minutten / Sek.']] },
    { k: 'weather', t: 'sel', l: 'Wieder', o: [['kloer', 'Kloer'], ['wolleken', 'Wolleken'], ['reen', 'Reen (naass Buedem)']] },
    { k: '_day', t: 'sel', l: 'Fouer-Dag', o: [] },
    { k: 'hudMini', t: 'tog', l: 'HUD: Minikaart' }, { k: 'hudMission', t: 'tog', l: 'HUD: Missiounsfenster' }, { k: 'hudKeys', t: 'tog', l: 'HUD: Tastenhiweiser' }, { k: 'hudPrompt', t: 'tog', l: 'HUD: Aktiouns-Hiweis' }, { k: 'guideArrows', t: 'tog', l: 'Fouer-Kompass: Pfeiler um Buedem' },
    { k: 'autosave', t: 'tog', l: 'Automatesch späicheren' },
  ] },
  { id: 'steierung', label: 'Steierung', items: [] },
  { id: 'cloud', label: 'Cloud Gaming', items: [] },
  { id: 'access', label: 'Accessibilitéit', items: [
    { k: 'uiScale', t: 'sld', l: 'Gréisst vun der Benotzeruewerfläch', min: 0.8, max: 1.4, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'reduceFlash', t: 'tog', l: 'Blëtzer & Blinklicht reduzéieren', d: 'Fir Leit mat Photosensibilitéit: keng Blinklichter, mëllt Freedefeier.' },
    { k: 'reduceMotion', t: 'tog', l: 'Bewegung reduzéieren', d: 'Kee Wackelen, kee Kapp-Wippen, kee Schwindel-Effekt.' },
    { k: 'colorblind', t: 'sel', l: 'Faarfblannheet-Filter', o: [['keen', 'Keen'], ['deutan', 'Deuteranopie'], ['protan', 'Protanopie'], ['tritan', 'Tritanopie']] },
    { k: 'highContrast', t: 'tog', l: 'HUD mat héijem Kontrast' },
  ] },
];
