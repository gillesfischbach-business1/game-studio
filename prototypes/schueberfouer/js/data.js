// =============================================================
// SCHUEBERFOUER 2026 – Spieldaten (data-driven, keine Magic Numbers im Code)
// Koordinaten: 1 Einheit = 1 Meter. Welt: x = Osten, z = Süden.
// Ursprung = Mitte des Glacis (49.6169 N, 6.1241 E), aus OpenStreetMap.
// =============================================================

// Lokales Kirmes-Koordinatensystem: u = Längsachse (SW -> NO, Richtung Haupttor),
// v = Querachse (NW = negativ / Allée Scheffer, SO = positiv).
export const FAIR = {
  C: { x: -21, z: 16 },          // Mittelpunkt
  theta: 0.6524,                  // Drehung der Längsachse (rad)
};
const ca = Math.cos(FAIR.theta), sa = Math.sin(FAIR.theta);
/** Lokale Kirmes-Koordinaten (u,v) -> Welt (x,z). */
export function L(u, v) { return { x: FAIR.C.x + u * ca + v * sa, z: FAIR.C.z - u * sa + v * ca }; }
/** Welt (x,z) -> lokale Kirmes-Koordinaten (u,v). */
export function toLocal(x, z) { const dx = x - FAIR.C.x, dz = z - FAIR.C.z; return { u: dx * ca - dz * sa, v: dx * sa + dz * ca }; }

// Echter Umriss des Glacis-Parkplatzes (OSM way 9647317), vereinfacht
export const GLACIS_POLY = [[-155, 60], [-116, 99], [-92, 124], [-82, 121], [100, 3], [92, -5], [86, -12], [98, -29], [93, -34], [68, -108], [58, -119], [48, -119], [26, -106], [2, -91], [-15, -79], [-61, -33], [-70, -20], [-86, -8]];

// Straßen (OSM-Geometrie, Mittellinien) – name, Breite, Punkte [x,z]
export const ROADS = [
  { name: 'Allée Scheffer', w: 11, pts: [[-15, -101], [-39, -84], [-75, -47], [-88, -34], [-100, -22], [-165, 41], [-179, 56]] },
  { name: "Rue Jean l'Aveugle", w: 8, pts: [[-258, -183], [-178, -112], [-95, -39], [-88, -34]] },
  { name: 'Avenue de la Faïencerie', w: 12, pts: [[-179, 56], [-234, 0], [-287, -53], [-320, -86], [-358, -123], [-398, -160]] },
  { name: 'Allée des Résistants et des Déportés', w: 15, pts: [[-330, 244], [-244, 129], [-202, 92], [-186, 77], [-172, 63], [-179, 56]] },
  { name: 'Boulevard de la Foire', w: 12, pts: [[-172, 63], [-130, 112], [-95, 140], [-60, 132], [104, 26], [112, 14]] },
  { name: 'Rond-Point Robert Schuman', w: 13, ring: { x: 133, z: -12, r: 26 } },
  { name: 'Boulevard Robert Schuman', w: 16, pts: [[158, -22], [235, -24], [283, -39], [340, -51], [378, -60], [729, -132]] },
  { name: 'Rue des Glacis', w: 10, pts: [[118, -36], [123, -72], [98, -146], [80, -210]] },
  { name: 'Avenue de la Porte-Neuve', w: 13, pts: [[150, 12], [157, 29], [170, 67], [184, 106], [195, 140], [213, 190], [236, 261]] },
  { name: 'Allée Scheffer (Nord)', w: 9, pts: [[-15, -101], [16, -123], [40, -150], [60, -200]] },
  { name: 'Boulevard Prince Henri', w: 14, pts: [[75, 355], [104, 325], [151, 293], [236, 261], [313, 239]] },
];

// Tram-Linie T1 (Annäherung) + Haltestellen (OSM-Positionen)
export const TRAM = {
  pts: [[-330, 244], [-244, 129], [-195, 88], [-186, 72], [-168, 46], [-100, -22], [-88, -40], [-39, -90], [-15, -107], [16, -126], [55, -122], [84, -88], [97, -55], [118, -36], [158, -28], [235, -28], [283, -43], [378, -64], [729, -136]],
  stops: [{ name: 'Faïencerie', x: -186, z: 77 }, { name: 'Theater', x: 97, z: -55 }],
};

export const THEATRE_POLY = [[226, -125], [233, -93], [228, -92], [233, -71], [237, -73], [240, -62], [241, -55], [309, -71], [301, -106], [319, -110], [312, -139], [295, -135], [293, -140]];
export const CEMETERY_POLY = [[-514, -83], [-484, -37], [-481, -20], [-490, 18], [-509, 61], [-470, 90], [-401, 158], [-381, 219], [-360, 246], [-265, 144], [-248, 131], [-262, 110], [-300, 60], [-330, 10], [-380, -40], [-440, -80]];
// Park zwischen Boulevard de la Foire und Ville-Haute (laut Plan „PARC“)
export const PARK_POLY = [[-200, 100], [-150, 92], [-95, 152], [-60, 145], [104, 40], [150, 30], [175, 100], [190, 150], [150, 230], [40, 260], [-90, 280], [-230, 200]];
export const BRIDGE = { from: [380, -58], to: [729, -132], name: 'Pont Grande-Duchesse Charlotte' };

// ------------------------------------------------------------
// Spielzeit
// ------------------------------------------------------------
export const TIME = {
  open: 12 * 60, close: 25 * 60,          // 12:00 – 01:00
  start: 20 * 60 + 15,                     // Start 20:15 (blaue Stunde)
  minutesPerSecond: 1,                     // 1 Spielminute = 1 Sekunde
  sunset: 20 * 60 + 25, dusk: 21 * 60 + 10,
};
export const DAYS = [
  { id: 'open', label: 'Fr. 21.08.2026 – Ouverture (Hämmelsmarsch)', date: 'Fr. 21.08.2026', discount: 0, parade: true },
  { id: 'normal', label: 'Sa. 29.08.2026 – normale Fouerdag', date: 'Sa. 29.08.2026', discount: 0 },
  { id: 'family', label: 'Mi. 26.08.2026 – Familljendag (Attraktiounen −50 %)', date: 'Mi. 26.08.2026', rideDiscount: 0.5 },
  { id: 'last', label: 'Mi. 09.09.2026 – Leschten Dag (−50 % bis 20:00, Freedefeier 22:00)', date: 'Mi. 09.09.2026', discount: 0.5, discountUntil: 20 * 60, fireworks: 22 * 60 },
];

// ------------------------------------------------------------
// Essen & Drinken (Preise 2026, realistisch geschätzt)
// ------------------------------------------------------------
export const FOOD = {
  gromper: { name: 'Gromperekichelcher (3 Stéck)', price: 6.5, hunger: 35, icon: '🥔', color: '#c98a2b' },
  gromper_apfel: { name: 'Gromperekichelcher mat Äppelkompott', price: 7.5, hunger: 40, icon: '🍎', color: '#c98a2b' },
  fesch: { name: 'Gebakene Fësch (Fritür)', price: 18.5, hunger: 55, icon: '🐟', color: '#d9b25a' },
  grillwurscht: { name: 'Lëtzebuerger Grillwurscht', price: 5.5, hunger: 30, icon: '🌭', color: '#8a3b1d' },
  mettwurscht: { name: 'Mettwurscht mat Moschter', price: 5.5, hunger: 30, icon: '🌭', color: '#7a2e1a' },
  kniddelen: { name: 'Kniddelen mat Speck a Ram', price: 14.5, hunger: 60, icon: '🥟', color: '#efe1b0' },
  mandelen: { name: 'Gebrannte Mandelen (100 g)', price: 5, hunger: 12, icon: '🥜', color: '#8b5a2b' },
  crepe: { name: 'Crêpe mat Nutella', price: 5.5, hunger: 20, icon: '🥞', color: '#d9a066' },
  zockerwatt: { name: 'Zockerwatt', price: 5, hunger: 8, icon: '🍭', color: '#ff9ad5' },
  churros: { name: 'Churros mat Zocker', price: 6, hunger: 18, icon: '🥖', color: '#d9a066' },
  aebbel: { name: 'Schockela-Äppel', price: 4.5, hunger: 10, icon: '🍏', color: '#7a1d1d' },
  frites: { name: 'Fritten mat Mayo', price: 4.8, hunger: 25, icon: '🍟', color: '#f2c84b' },
};
export const DRINKS = {
  beier: { name: 'Lëtzebuerger Béier (0,3 l)', price: 4.8, thirst: 35, alcohol: 1, icon: '🍺' },
  beier_grouss: { name: 'Béier – grousse Mooss (0,5 l)', price: 7.2, thirst: 50, alcohol: 1.6, icon: '🍺' },
  cremant: { name: 'Glas Crémant de Luxembourg', price: 8, thirst: 25, alcohol: 1.2, icon: '🥂' },
  riesling: { name: 'Glas Riesling (Musel)', price: 6.5, thirst: 25, alcohol: 1, icon: '🍷' },
  limonad: { name: 'Limonad', price: 4, thirst: 40, icon: '🥤' },
  waasser: { name: 'Waasser (Mineralwaasser)', price: 3.5, thirst: 45, sober: 1, icon: '💧' },
  kaffi: { name: 'Kaffi', price: 3.2, thirst: 15, sober: 0.5, icon: '☕' },
  cola: { name: 'Cola', price: 4, thirst: 40, icon: '🥤' },
};

// Kleeder & Accessoiren (Slot: head, eyes, top, neck)
export const CLOTHES = {
  kap: { name: 'Fouer-Kap (rout)', price: 18, slot: 'head', icon: '🧢' },
  cowboy: { name: 'Cowboy-Hutt', price: 22, slot: 'head', icon: '🤠' },
  laemmy_ouer: { name: 'Lämmy-Ouer (Haarband)', price: 9, slot: 'head', icon: '🐑' },
  kroun: { name: 'Blummekranz', price: 12, slot: 'head', icon: '💐' },
  sonnebrell: { name: 'Sonnebrëll', price: 15, slot: 'eyes', icon: '🕶️' },
  led_brell: { name: 'LED-Party-Brëll', price: 10, slot: 'eyes', icon: '✨' },
  shirt_fouer: { name: 'T-Shirt „Ech war op der Fouer 2026“', price: 25, slot: 'top', icon: '👕', color: 0x1d4ea8 },
  hoodie_laemmy: { name: 'Lämmy-Hoodie (wäiss & flauscheg)', price: 45, slot: 'top', icon: '🧥', color: 0xf3efe6 },
  shirt_rout: { name: 'Rout Lëtzebuerg-Trikot', price: 39, slot: 'top', icon: '🎽', color: 0xd01c2a },
  schal: { name: 'Lëtzebuerg-Schal (rout-wäiss-blo)', price: 19, slot: 'neck', icon: '🧣' },
  ketten: { name: 'Leuchtkette', price: 6, slot: 'neck', icon: '📿' },
};
export const SOUVENIRS = {
  pluesch: { name: 'Lämmy-Plüschschof', price: 20, icon: '🐑' },
  herz: { name: 'Liebkuchenhäerz „Fouer 2026“', price: 8, icon: '❤️' },
  ballon: { name: 'Helium-Ballon', price: 7, icon: '🎈' },
};

// Stänn: id, Typ, Name auf dem Schild, Farben, Sortiment
export const STALL_TYPES = {
  gromper: { sign: 'GROMPEREKICHELCHER', items: ['gromper', 'gromper_apfel', 'limonad', 'waasser'], c1: '#f2c84b', c2: '#b8211f', need: 'food' },
  fesch: { sign: 'FËSCHERHAISCHEN', items: ['fesch', 'frites', 'riesling', 'cremant', 'waasser'], c1: '#2f7fd1', c2: '#ffffff', need: 'food' },
  wurscht: { sign: 'GRILLWURSCHT', items: ['grillwurscht', 'mettwurscht', 'frites', 'beier', 'cola'], c1: '#e8432e', c2: '#ffd76a', need: 'food' },
  mandelen: { sign: 'GEBRANNTE MANDELEN', items: ['mandelen', 'aebbel', 'zockerwatt'], c1: '#ff6fb1', c2: '#fff1a8', need: 'food' },
  crepe: { sign: 'CRÊPES & CHURROS', items: ['crepe', 'churros', 'kaffi', 'waasser'], c1: '#ffb347', c2: '#7b2cbf', need: 'food' },
  beier: { sign: 'BÉIERBUD', items: ['beier', 'beier_grouss', 'cremant', 'riesling', 'limonad', 'waasser'], c1: '#ffd23f', c2: '#1b5e20', need: 'drink' },
  bar: { sign: 'CRÉMANT BAR', items: ['cremant', 'riesling', 'beier', 'waasser', 'cola'], c1: '#e7c6ff', c2: '#3c096c', need: 'drink' },
  mode: { sign: 'FOUER-MODE', items: ['shirt_fouer', 'shirt_rout', 'hoodie_laemmy', 'schal', 'kap'], c1: '#4cc9f0', c2: '#f72585', need: 'shop' },
  hutt: { sign: 'HÜTT & BRËLLEN', items: ['cowboy', 'kroun', 'laemmy_ouer', 'sonnebrell', 'led_brell', 'ketten'], c1: '#80ffdb', c2: '#5e60ce', need: 'shop' },
  souvenir: { sign: 'LÄMMY-SHOP', items: ['pluesch', 'herz', 'ballon', 'laemmy_ouer'], c1: '#ffffff', c2: '#e63946', need: 'shop' },
  schéiss: { sign: 'SCHÉISSBUD', game: 'shooting', price: 5, c1: '#ff5400', c2: '#222222', need: 'game' },
  lukas: { sign: 'HAU DEN LUKAS', game: 'lukas', price: 3, c1: '#ffbe0b', c2: '#8338ec', need: 'game' },
  lous: { sign: 'LOUSBUD – all Lous gewënnt!', game: 'lous', price: 3, c1: '#ff006e', c2: '#ffd60a', need: 'game' },
  info: { sign: 'INFO & FONNBÜRO', info: true, c1: '#1d3557', c2: '#f1faee', need: 'info' },
};

// =============================================================
// LAYOUT nach dem offiziellen Lageplan der Schueberfouer
// lokale Koordinaten: u = West(E3/E4) -> Ost(E7/E9), v = Nord (Allée Scheffer) -> Süd (Bd de la Foire)
// =============================================================

// Fahrbare / begehbare Haupt-Attraktionen (detailliert modelliert)
export const RIDES = {
  riesenrad: { name: 'Grande Roue Bellevue', plan: 12, type: 'ferris', u: -78, v: -14.5, price: 7, thrill: 1, height: 55, desc: '55 m héich – de beschte Bléck iwwer d\'Stad.' },
  carousel: { name: 'Carrousel Galopant', plan: 9, type: 'carousel', u: -51, v: -14.5, price: 4, thrill: 0, desc: 'Nostalgesch Doppelstäck-Päerdskarussell.' },
  autoscooter: { name: 'Autoscooter Diamond', plan: 4, type: 'scooter', u: 4, v: -14.5, price: 5, thrill: 1, desc: 'Selwer fueren a bompen!' },
  breakdance: { name: 'Break Dance', plan: 8, type: 'breakdance', u: 33, v: -14.5, price: 6, thrill: 3, desc: 'Dréit sech, dréit sech, dréit sech …' },
  coaster: { name: 'Alpina Bahn', plan: 2, type: 'coaster', u: 97, v: -10.7, price: 9, thrill: 4, desc: 'Déi grouss Achterbunn um Ostenn vun der Fouer – Adrenalin pur.' },
  kette: { name: 'Kettekarussell', type: 'swing', u: -96, v: 20.0, price: 5, thrill: 2, desc: 'Fléien an 15 m Héicht.' },
  freefall: { name: 'Fräifall-Tuerm', type: 'freefall', u: -74, v: 20.0, price: 8, thrill: 5, height: 62, desc: '62 m – an 3 Sekonnen ënnen.' },
  pendel: { name: 'Pendel', type: 'pendulum', u: -50, v: 20.0, price: 8, thrill: 4, desc: '120° Schwong – fir déi Couragéiert.' },
  geescht: { name: 'Geeschterbunn', type: 'ghost', u: 42, v: 20.0, price: 6, thrill: 2, desc: 'Traut Dir Iech eran?' },
  vr: { name: 'Cinéma 5D', plan: 10, type: 'vr', u: -100, v: -44, price: 7, thrill: 3, desc: 'Virtuell Achterbunn mat 5D-Effekter.' },
};
// Weitere Attraktionen aus dem Lageplan (animierte Kulissen mit echtem Namen)
export const EXTRA_RIDES = [
  { name: 'Rotor', plan: 19, style: 'drum', u: -100, v: -18.4 },
  { name: 'Circus Circus', plan: 11, style: 'spinner', u: -30, v: -14.5 },
  { name: 'XXL', plan: 26, style: 'tower', u: -16, v: -14.5 },
  { name: 'Aeronaut', plan: 1, style: 'tower', u: 55, v: -14.5 },
  { name: 'Tagada', plan: 21, style: 'tagada', u: 69, v: -15.8 },
  { name: 'Shakers', plan: 20, style: 'spinner', u: -30, v: 20.0 },
  { name: 'Transformer', plan: 24, style: 'spinner', u: -15, v: 20.0 },
  { name: 'Après-Ski Party', plan: 3, style: 'show', u: 1, v: 20.0 },
  { name: 'BoosterMaxxx', plan: 7, style: 'tower', u: 17, v: 20.0 },
  { name: 'Big Splash', plan: 6, style: 'show', u: 60, v: 20.0 },
  { name: 'Bayern Kurve', plan: 5, style: 'spinner', u: 95, v: 27 },
  { name: 'Magic World', plan: 17, style: 'show', u: 26, v: 20.0, small: true },
];
// Restaurants (Gaststätten) aus dem Lageplan – Reihe entlang der Allée Scheffer
export const RESTAURANTS = [
  { name: "Schla'Winer", u: -86, items: ['cremant', 'riesling', 'kniddelen', 'grillwurscht', 'waasser'], c: '#7b2cbf' },
  { name: 'Taverne op der Fouer', u: -70, items: ['beier', 'beier_grouss', 'grillwurscht', 'kniddelen', 'gromper', 'waasser'], c: '#8a3b1d' },
  { name: 'Am Stall', u: -54, items: ['kniddelen', 'grillwurscht', 'mettwurscht', 'beier', 'cremant', 'waasser'], c: '#5a3d22' },
  { name: 'Kessel', u: -22, items: ['gromper', 'gromper_apfel', 'beier', 'riesling', 'waasser'], c: '#b8211f' },
  { name: 'Restaurant Kugener', u: -6, items: ['fesch', 'frites', 'riesling', 'cremant', 'beier', 'waasser'], c: '#1d4ea8' },
  { name: 'Friture Henriette', u: 10, items: ['fesch', 'frites', 'riesling', 'beier', 'waasser'], c: '#2f7fd1' },
  { name: 'Friture Armand', u: 32, items: ['fesch', 'frites', 'cremant', 'beier', 'waasser'], c: '#0077b6' },
  { name: 'Chez Irène', u: 48, items: ['fesch', 'kniddelen', 'riesling', 'beier', 'waasser'], c: '#e76f51' },
  { name: 'Crêperie bretonne', u: 64, items: ['crepe', 'churros', 'cremant', 'kaffi', 'limonad'], c: '#264653' },
];
export const RESTO_ROW = { v: -47, w: 14, d: 11 };

// Alleen (Laufwege); a, b in (u,v), w = Breite
export const LANES = [
  { a: [-110, -33.7], b: [74, -33.7], w: 7 },   // Nordallee (vor den Restaurants)
  { a: [-110, 3.4], b: [78, 3.4], w: 8 },       // Mëttelallee
  { a: [-110, 36.7], b: [86, 36.7], w: 7 },     // Südallee (Boulevard de la Foire)
  { a: [-110, -33.7], b: [-110, 36.7], w: 6 },  // Westende E3
  { a: [-40, -54.2], b: [-40, 36.7], w: 5 },    // E5 -> E2
  { a: [19, -54.2], b: [19, 3.4], w: 5 },       // E6
  { a: [78, 3.4], b: [78, 36.7], w: 6 },
  { a: [86, 36.7], b: [104, 48.2], w: 7 },      // zum Haupttor E1
];
export const GATE = { u: 104, v: 48.2, name: 'Haaptentrée E1 – Rond-Point Robert Schuman' };
export const ENTRANCES = [
  { id: 'E1', u: 104, v: 48.2 }, { id: 'E2', u: -40, v: 48.2 }, { id: 'E3', u: -116, v: 3.4 }, { id: 'E4', u: -110, v: -56.8 },
  { id: 'E5', u: -40, v: -59.3 }, { id: 'E6', u: 19, v: -59.3 }, { id: 'E9', u: 112, v: 30.3 },
];
// Grundflächen (für Stand-Verteilung & Kollision): r = Kreis, hu/hv = Rechteck
export const FOOTPRINT = { ferris: { hu: 17, hv: 5.5 }, carousel: { r: 8.5 }, scooter: { hu: 12, hv: 7.5 }, breakdance: { r: 11 }, coaster: { hu: 16, hv: 26 }, swing: { r: 8 }, freefall: { r: 5 }, pendulum: { hu: 9, hv: 6 }, ghost: { hu: 11, hv: 6.5 }, vr: { r: 5 },
  spinner: { r: 7 }, spinner_small: { r: 5 }, drum: { r: 6 }, tower: { r: 6 }, tagada: { r: 6 }, show: { hu: 9, hv: 6 }, show_small: { hu: 5, hv: 6 } };
// Stand-Typen, die automatisch entlang der Alleen verteilt werden (gewichtete Liste)
export const STALL_MIX = ['gromper', 'gromper', 'wurscht', 'mandelen', 'crepe', 'beier', 'beier', 'bar', 'mode', 'hutt', 'souvenir', 'schéiss', 'lous', 'lukas', 'gromper', 'wurscht', 'mandelen', 'beier'];
export const STALL_FIXED = [[98, 33, 'info', -1]];

// Golden Hämmelcher (Easter-Egg-Sammelobjekte) – Weltkoordinaten (x, y, z) + Hinweis
export const GOLDEN_SHEEP = [
  { id: 1, x: 262, y: 0.4, z: -50, hint: 'Virum Grand Théâtre' },
  { id: 2, x: 97, y: 0.4, z: -61, hint: 'Bei der Tramhaltestell Theater' },
  { id: 3, ride: 'riesenrad', hint: 'Ganz uewen am Riesenrad' },
  { id: 4, ride: 'freefall', hint: 'Uewen um Fräifall-Tuerm' },
  { id: 5, ride: 'geescht', hint: 'Am Däischteren vun der Geeschterbunn' },
  { id: 6, local: [-54, -48], y: 0.4, hint: 'Am Restaurant „Am Stall“ ënnert engem Dësch' },
  { id: 7, x: -176, y: 0.4, z: -110, hint: "Rue Jean l'Aveugle" },
];
