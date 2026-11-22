// Spiel-Logik: Einkaufen, Essen & Trinken, Kleider, Fahrgeschäfte, Missionen, Easter Eggs
import * as THREE from 'three';
import { FOOD, DRINKS, CLOTHES, SOUVENIRS, DAYS, L, toLocal, GOLDEN_SHEEP, RIDES, STALL_TYPES, GATE, TIME } from './data.js';
import { M, Glow, R, pick, rand, clamp, euro, lerp } from './util.js';
import { makeHuman, makeSheep, animateHuman } from './npc.js';

export const MISSIONS = [
  { id: 'lokal', title: 'Wéi e richtege Lëtzebuerger', desc: 'Iess Gromperekichelcher, Gebakene Fësch an eng Grillwurscht – a drénk e Béier oder e Crémant.', steps: [['eat', 'gromper', 'Gromperekichelcher'], ['eat', 'fesch', 'Gebakene Fësch'], ['eat', 'grillwurscht', 'Grillwurscht'], ['drink', 'beier|beier_grouss|cremant', 'Béier oder Crémant']], reward: 'Medaille „Lokalpatriot“', target: 'food' },
  { id: 'riesenrad', title: 'D\'Stad vun uewen', desc: 'Fuer mat der Grande Roue Bellevue a maach ganz uewen eng Foto mat [P].', steps: [['ride', 'riesenrad', 'Mat der Grande Roue fueren'], ['photoTop', '', 'Foto vun uewen']], reward: 'Postkaart „Lëtzebuerg vun uewen“', targetRide: 'riesenrad' },
  { id: 'operator', title: 'Hannert dem Steierpult', desc: 'De Break-Dance-Operateur brauch eng Paus. Iwwerhuel d\'Kabin a fuer 3 Rontwe mat de Passagéier.', steps: [['operate', 3, '3 Rontwe bedéngen']], reward: 'Operateur-Badge', targetRide: 'breakdance' },
  { id: 'adrenalin', title: 'Adrenalin-Junkie', desc: 'Fuer mat der Alpina Bahn, dem Fräifall-Tuerm, dem Pendel an dem Break Dance.', steps: [['ride', 'coaster', 'Alpina Bahn'], ['ride', 'freefall', 'Fräifall-Tuerm'], ['ride', 'pendel', 'Pendel'], ['ride', 'breakdance', 'Break Dance']], reward: 'T-Shirt „Ech hu kee Bammel“', targetRide: 'coaster' },
  { id: 'scooter', title: 'Bomper-Champion', desc: 'Bomp 10 Autoen an enger eenzeger Autoscooter-Fahrt.', steps: [['bumps', 10, '10 Bomps']], reward: 'Pokal „Bomper-Kinnek“', targetRide: 'autoscooter' },
  { id: 'schéiss', title: 'Schéisskinnek', desc: 'Triff mindestens 7 vun 10 Ziler an der Schéissbud.', steps: [['shoot', 7, '7 Treffer']], reward: 'Lämmy-Plüschschof', target: 'game' },
  { id: 'lukas', title: 'Hau den Lukas', desc: 'Loos d\'Klack uewen um Lukas lauden.', steps: [['lukas', 1, 'Klack!']], reward: 'Titel „Staarke Mann“', target: 'game' },
  { id: 'mode', title: 'Fouer-Fashion', desc: 'Kaf dir Kleeder & Accessoiren an droen der 3 gläichzäiteg.', steps: [['outfit', 3, '3 Saachen undoen']], reward: 'Stil-Ikon', target: 'shop' },
  { id: 'dief', title: 'Haalt den Dief!', desc: 'Engem Tourist gouf d\'Täsch geklaut! Lass hannert dem Dief hier (Shift = lafen) an tackel hien mat [E].', steps: [['thief', 1, 'Dief gefaangen']], reward: 'Merci vun der Police grand-ducale', hidden: true },
  { id: 'kand', title: 'Wou ass d\'Mamm?', desc: 'E klengt Meedchen huet seng Mamm verluer. Bréng et bei den Info-Stand beim Haaptentrée E1.', steps: [['child', 1, 'Kand beim Info-Stand']], reward: 'Häerzlechen Dank', hidden: true },
  { id: 'haemmel', title: 'Hämmelsjuegd', desc: 'Iwwerall um Fouer-Terrain sinn 7 gëlle Hämmelcher verstoppt. Fann se all!', steps: [['sheep', 7, '7 gëlle Hämmelcher']], reward: 'Gëllene Lämmy' },
  { id: 'profi', title: 'Fouer-Profi', desc: 'Probéier 10 verschidden Attraktiounen.', steps: [['rides', 10, '10 Attraktiounen']], reward: 'Dauerkaart (symbolesch)' },
];
export const EGGS = {
  johann: { t: 'Jhang de Blannen', d: 'Du hues de Geescht vum Grënner vun der Fouer (1340) getraff.' },
  konami: { t: 'Gromperekichelcher-Reen', d: '↑↑↓↓←→←→BA' },
  vr: { t: 'Virtuell Welten', d: 'Cinéma 5D erlieft.' },
  feier: { t: 'Freedefeier', d: 'Dat grousst Feierwierk um leschten Dag gesinn.' },
  laemmy: { t: 'Lämmy-Knuddel', d: 'Lämmy, d\'Maskottchen, gedréckt.' },
  parade: { t: 'Hämmelsmarsch', d: 'Mat der Blosmusek an de Schof matmarschéiert.' },
  tram: { t: 'Gratis Tram', d: 'Mam Tram gefuer – zu Lëtzebuerg ass den ëffentlechen Transport gratis!' },
  schwindel: { t: 'E bësse vill …', d: '5 Béier gedronk. Drénk e Waasser!' },
  mitternacht: { t: 'Mëtternuecht uewen', d: 'Um 0:00 Auer an der Grande Roue.' },
  geescht: { t: 'Ouni Angscht', d: 'D\'Geeschterbunn iwwerlieft.' },
  theater: { t: 'Kultur-Fan', d: 'De Grand Théâtre besicht.' },
  piwitsch: { t: 'Fouer-Gourmet', d: '10 verschidde Spezialitéiten probéiert.' },
};

export class Game {
  constructor(G) {
    this.G = G; this.spent = 0; this.owned = new Set(); this.equipped = {}; this.souvenirs = []; this.freeTickets = 0;
    this.prog = {}; this.done = new Set(); this.eggs = new Set(); this.ridden = new Set(); this.eaten = new Set(); this.beers = 0; this.sheepFound = new Set(); this.operated = 0;
    this.active = 'lokal'; this.stats = { dist: 0, play: 0, photos: 0 };
    this.load();
    G.on('rideDone', id => this.onRide(id)); G.on('bump', n => { if (n >= 10) this.stepDone('scooter', 0); this.G.ui.rideInfo(`Bomps: ${n}`); });
    this.specials = []; this.buildSpecials();
    this.konami = []; G.onKey = e => this.onKey(e);
    this.guide = null; this.guideMeshes = this.buildGuide();
    G.on('photo', info => { if (info.top) this.stepDone('riesenrad', 1); });
  }
  // ---------------- Speichern (nur Komfort, darf fehlen) ----------------
  save() { try { localStorage.setItem('fouer2026', JSON.stringify({ spent: this.spent, owned: [...this.owned], equipped: this.equipped, done: [...this.done], eggs: [...this.eggs], prog: this.prog, ridden: [...this.ridden], eaten: [...this.eaten], sheep: [...this.sheepFound], souvenirs: this.souvenirs, active: this.active, stats: this.stats, equipped2: this.equipped, beers: this.beers })); } catch (e) { } }
  load() { try { const d = JSON.parse(localStorage.getItem('fouer2026') || 'null'); if (!d) return; this.spent = d.spent || 0; this.owned = new Set(d.owned || []); this.equipped = d.equipped || {}; this.done = new Set(d.done || []); this.eggs = new Set(d.eggs || []); this.prog = d.prog || {}; this.ridden = new Set(d.ridden || []); this.eaten = new Set(d.eaten || []); this.sheepFound = new Set(d.sheep || []); this.souvenirs = d.souvenirs || []; this.active = d.active || 'lokal'; this.stats = { ...this.stats, ...(d.stats || {}) }; this.beers = d.beers || 0; } catch (e) { } }
  reset() { try { localStorage.removeItem('fouer2026'); } catch (e) { } location.reload(); }

  // ---------------- Preise (Rabatt-Tage 2026) ----------------
  price(p, kind) {
    const d = this.G.day || DAYS[0]; let f = 1;
    if (d.discount && (!d.discountUntil || this.G.minutes < d.discountUntil)) f *= 1 - d.discount;
    if (d.rideDiscount && (kind === 'ride' || kind === 'game')) f *= 1 - d.rideDiscount;
    return Math.round(p * f * 100) / 100;
  }
  pay(amount, what) { this.spent += amount; this.G.audio.kaching(); this.G.ui.money(amount, what); this.save(); }

  // ---------------- Interaktion ----------------
  interact(it) {
    const G = this.G;
    if (it.kind === 'stall') { const T = it.ref.T; if (T.game) return G.ui.openGame(T.game, it.ref); if (T.info) return this.infoStand(); return G.ui.openShop(it.ref); }
    if (it.kind === 'ride') return G.ui.openRide(it.ref);
    if (it.kind === 'npc') return it.action();
  }
  buy(id, stall) {
    const G = this.G; const P = G.player;
    if (FOOD[id]) { const f = FOOD[id]; const pr = this.price(f.price, 'food'); this.pay(pr, f.name); P.stats.hunger = Math.min(100, P.stats.hunger + f.hunger); P.stats.fun = Math.min(100, P.stats.fun + 4); this.eaten.add(id); this.handItem(f.color, 'food'); G.audio.eat(); G.ui.toast(`${f.icon} Mmmh! ${f.name}`, 'Gutt Appetit!');
      this.check('eat', id); if (this.eaten.size >= 10) this.egg('piwitsch'); }
    else if (DRINKS[id]) { const d = DRINKS[id]; const pr = this.price(d.price, 'food'); this.pay(pr, d.name); P.stats.thirst = Math.min(100, P.stats.thirst + d.thirst); if (d.alcohol) { P.stats.promille += d.alcohol * 0.35; this.beers++; if (this.beers >= 5) this.egg('schwindel'); } if (d.sober) P.stats.promille = Math.max(0, P.stats.promille - d.sober * 0.6);
      this.eaten.add(id); this.handItem(id.startsWith('beier') ? '#f4c542' : id === 'cremant' ? '#f7e7b4' : id === 'riesling' ? '#e9e4a6' : '#7ec8e3', 'drink'); G.audio.drink(); G.ui.toast(`${d.icon} Prost! ${d.name}`, d.alcohol ? 'Gesondheet! (Mat Moossen …)' : 'Erfrëschend!'); this.check('drink', id); }
    else if (CLOTHES[id]) { const c = CLOTHES[id]; if (this.owned.has(id)) { this.equip(id); return; } this.pay(this.price(c.price, 'shop'), c.name); this.owned.add(id); this.equip(id); G.ui.toast(`${c.icon} Kaaft: ${c.name}`, 'Schonn ugedoen – [I] fir d\'Garderob'); }
    else if (SOUVENIRS[id]) { const s = SOUVENIRS[id]; this.pay(this.price(s.price, 'shop'), s.name); this.souvenirs.push(id); G.ui.toast(`${s.icon} ${s.name}`, 'An der Täsch!'); if (id === 'ballon') this.balloon(); }
    this.save();
  }
  infoStand() {
    const G = this.G; const kid = this.specials.find(s => s.type === 'kid');
    if (kid && kid.following) { kid.following = false; kid.done = true; this.reunite(kid); return; }
    G.ui.dialog('Info & Fonnbüro', 'Moien! Hei kritt Dir Infoe zur Schueberfouer 2026: 21. August bis 9. September, all Dag vu 12 bis 1 Auer. Entrée gratis. Familljendag: Mëttwoch 26.08. (Attraktiounen) an 2.09. (Iessen). Leschten Dag: −50 % bis 20 Auer, Feierwierk um 22 Auer. De Lämmy deelt dënschdes a donneschdes Fouerbichelcher aus!', [{ t: 'Merci!', f: () => { } }]);
  }

  // ---------------- Fahrgeschäfte ----------------
  startRide(ride, operator = false) {
    const G = this.G; let pr = this.price(ride.price, 'ride');
    if (operator) { G.ui.closeAll(); this.startOperator(ride); return; }
    if (this.freeTickets > 0) { this.freeTickets--; G.ui.toast('🎟️ Fouerbichelchen agesat', `Gratis-Fahrt! Nach ${this.freeTickets} Ticket(en).`); }
    else this.pay(pr, ride.name);
    G.ui.closeAll(); G.ui.fade(() => {
      if (ride.cfg.type === 'vr') return this.startVR(ride);
      if (ride.walk) { G.ui.dialog(ride.name, ride.name === 'Big Splash' ? 'Platsch! Am Boot geet et de Waasserkanal erof – Du bass klatschnaass, awer glécklech.' : ride.name === 'Après-Ski Party' ? 'Bass, Disco-Kugel an Après-Ski-Hits am August – d\'Party-Hal kacht!' : 'Spigelen, wackeleg Biedem a Loftdüsen – d\'Laachkabinett ass e Klassiker.', [{ t: 'Super!', f: () => { } }]); G.player.stats.fun = Math.min(100, G.player.stats.fun + 15); this.onRide(ride.id); return; }
      G.player.board(ride); G.audio.whoosh(); G.ui.rideHud(ride);
    });
  }
  onRide(id) {
    const G = this.G; this.ridden.add(id); this.check('ride', id); this.prog.rides = this.ridden.size; if (this.ridden.size >= 10) this.stepDone('profi', 0); else this.G.ui.refreshMission();
    if (id === 'geescht') this.egg('geescht');
    G.ui.rideHud(null); this.save();
  }
  startOperator(ride) {
    const G = this.G; ride.manual = true; ride.opRun = false; ride.k = 0; G.player.mode = 'operator'; G.player.ride = ride; G.player.human.visible = false;
    G.ui.operatorPanel(ride, {
      start: () => { if (!ride.bars) return G.ui.toast('⚠️ Sécherheetsbiggelen!', 'Éischt d\'Bigelen zoumaachen.'); ride.opRun = true; ride.runStart = G.time; G.audio.horn(); },
      stop: () => { if (ride.opRun && G.time - ride.runStart > 15) { this.operated++; this.check('operate', this.operated); G.ui.toast('✅ Ronn fäerdeg', `${this.operated}/3 Rontwe`); } ride.opRun = false; ride.bars = false; },
      bars: () => { if (ride.opRun) return; ride.bars = !ride.bars; G.audio.click(); },
      horn: () => G.audio.horn(), music: () => G.audio.toggleRideMusic(),
      exit: () => { ride.manual = false; ride.opRun = false; G.player.mode = 'walk'; G.player.ride = null; G.player.human.visible = true; G.ui.operatorPanel(null); },
    });
  }
  startVR(ride) {
    const G = this.G; G.player.mode = 'fixed'; G.player.fixedCam = { pos: G.camera.position.clone(), look: G.camera.position.clone().add(new THREE.Vector3(0, 0, -1)) };
    // eigene Neon-Welt
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#05000f'); sc.fog = new THREE.Fog('#05000f', 20, 160);
    const cam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
    const grid = new THREE.GridHelper(600, 120, '#ff00ff', '#00ffff'); sc.add(grid);
    const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 60 + Math.sin(a * 3) * 15, 12 + Math.sin(a * 5) * 10 + Math.cos(a * 2) * 6, Math.sin(a) * 60)); }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    sc.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.4, 6, true), new THREE.MeshBasicMaterial({ color: '#00f5d4', wireframe: true })));
    for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(R(2, 6)), new THREE.MeshBasicMaterial({ color: pick(['#f15bb5', '#fee440', '#00bbf9', '#9b5de5']), wireframe: true })); m.position.set(R(-150, 150), R(10, 60), R(-150, 150)); sc.add(m); }
    const sun = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: '#ff6ec7' })); sun.position.set(0, 30, -250); sc.add(sun);
    const txt = document.createElement('div'); let t = 0; this.G.ui.toast('🥽 Cinéma 5D', 'Kuck ronderëm mat der Maus / dem Fanger!');
    G.ui.vrOverlay(true);
    G.altRender = (dt) => { t += 1 / 60; const u = (t / 30) % 1; const p = curve.getPointAt(u), tg = curve.getTangentAt(u); cam.position.copy(p).add(new THREE.Vector3(0, 1.5, 0)); cam.lookAt(p.clone().add(tg));
      cam.rotateY(G.player.lookYaw); cam.rotateX(G.player.lookPitch); sc.children.forEach((c, i) => { if (c.geometry?.type === 'OctahedronGeometry') c.rotation.y += 0.01 + i * 0.0003; });
      G.renderer.render(sc, cam); if (t > 30) { G.altRender = null; G.ui.vrOverlay(false); G.player.mode = 'walk'; this.egg('vr'); this.onRide('vr'); } };
  }
  rideTram() {
    const G = this.G; const T = G.tram; const seat = new THREE.Object3D(); seat.position.set(-2, 0.9, 0); seat.rotation.y = -Math.PI / 2; T.mesh.add(seat);
    const fake = { cfg: { type: 'tram', thrill: 0 }, cam: 'third', id: 'tram', board: () => seat, player: true, exitPoint: () => ({ x: T.pos.x + Math.sin(T.pos.ang) * 5, z: T.pos.z + Math.cos(T.pos.ang) * 5 }) };
    G.player.board(fake); G.player.mode = 'tram'; G.player.rideDist = 14; this.tramFrom = T.atStop; this.tramRide = fake;
    G.ui.toast('🚋 Tram T1', 'Gratis – wéi all ëffentlechen Transport zu Lëtzebuerg!'); this.egg('tram');
  }

  // ---------------- Kleider ----------------
  equip(id) {
    const c = CLOTHES[id]; if (!c) return;
    if (this.equipped[c.slot] === id) delete this.equipped[c.slot]; else this.equipped[c.slot] = id;
    this.applyOutfit(); this.check('outfit', Object.keys(this.equipped).length); this.save();
  }
  applyOutfit() {
    const P = this.G.player.human.userData.P;
    for (const s of Object.values(P.slot)) s.clear?.() ?? s.children.slice().forEach(ch => s.remove(ch));
    P.shirtM.color.set(this.G.player.human.userData.baseShirt || '#2b2d42');
    for (const [slot, id] of Object.entries(this.equipped)) {
      const c = CLOTHES[id]; const g = P.slot[slot] || P.slot.head;
      if (slot === 'top') { P.shirtM.color.set(c.color); if (id === 'hoodie_laemmy') { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), M('#f3efe6')); hood.position.set(0, 0.02, -0.05); hood.rotation.x = -0.6; P.head.add(hood); P.slot.head.add(hood); } continue; }
      if (id === 'kap') { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), M('#d01c2a')); cap.position.y = 0.03; g.add(cap); const vis = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.13), M('#d01c2a')); vis.position.set(0, 0.04, 0.17); g.add(vis); }
      if (id === 'cowboy') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), M('#8b5a2b')); b.position.y = 0.09; g.add(b); const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.16, 14), M('#8b5a2b')); cr.position.y = 0.17; g.add(cr); }
      if (id === 'laemmy_ouer') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 20, Math.PI), M('#ffffff')); band.position.y = 0.02; band.rotation.y = Math.PI / 2; g.add(band); for (const x of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M('#f8f4ea')); e.scale.set(1, 0.6, 1.6); e.position.set(x * 0.15, 0.1, 0); e.rotation.z = x * 0.6; g.add(e); } }
      if (id === 'kroun') { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M(pick(['#ff006e', '#ffbe0b', '#fb5607', '#8338ec', '#ffffff']))); f.position.set(Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.13); g.add(f); } }
      if (id === 'sonnebrell' || id === 'led_brell') { const mat = id === 'led_brell' ? Glow('#ff4fd8', 3) : M('#111', { metalness: 0.8, roughness: 0.1 }); for (const x of [-0.045, 0.045]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.01), mat); l.position.set(x, 0.025, 0.128); g.add(l); } const br = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.01), mat); br.position.set(0, 0.04, 0.128); g.add(br); }
      if (id === 'schal') { for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.1 - i * 0.004, 0.022, 6, 16), M(['#ed2939', '#ffffff', '#00a1de'][i])); t.rotation.x = Math.PI / 2; t.position.y = 0.66 - i * 0.035; g.add(t); } const end = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.02), M('#ed2939')); end.position.set(0.06, 0.5, 0.11); g.add(end); }
      if (id === 'ketten') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 20), Glow('#80ffdb', 3)); t.rotation.x = 1.2; t.position.set(0, 0.6, 0.03); g.add(t); }
    }
  }
  handItem(color, kind) {
    const P = this.G.player.human.userData.P; P.slot.hand.clear();
    const m = kind === 'drink' ? new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.14, 10), M(color, { transparent: true, opacity: 0.85, emissive: color, emissiveIntensity: 0.2 })) : new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.1), M(color));
    m.position.y = -0.05; P.slot.hand.add(m); this.G.player.human.userData.holding = true; clearTimeout(this._hand);
    this._hand = setTimeout(() => { P.slot.hand.clear(); this.G.player.human.userData.holding = false; }, 6000);
  }
  balloon() { const P = this.G.player.human.userData.P; const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), M(pick(['#ff006e', '#3a86ff', '#ffbe0b']), { roughness: 0.2 })); b.position.set(0, 1.3, 0); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2), M('#fff')); s.position.y = 0.65; const g = new THREE.Group(); g.add(b, s); P.slot.hand.add(g); }

  // ---------------- Missionen ----------------
  check(kind, val) {
    for (const m of MISSIONS) { if (this.done.has(m.id)) continue; m.steps.forEach((s, i) => {
      if (s[0] !== kind) return;
      if (kind === 'eat' && s[1] === val) this.stepDone(m.id, i);
      else if (kind === 'drink' && s[1].split('|').includes(val)) this.stepDone(m.id, i);
      else if (kind === 'ride' && s[1] === val) this.stepDone(m.id, i);
      else if (['operate', 'outfit', 'shoot', 'lukas', 'sheep', 'thief', 'child'].includes(kind) && val >= s[1]) this.stepDone(m.id, i);
      else if (['operate', 'outfit', 'sheep'].includes(kind)) { this.prog[m.id + i] = val; this.G.ui.refreshMission(); }
    }); }
  }
  stepDone(mid, i) {
    const m = MISSIONS.find(x => x.id === mid); if (!m || this.done.has(mid)) return; const key = mid + ':' + i; if (this.prog[key] === true) return; this.prog[key] = true;
    const all = m.steps.every((s, j) => this.prog[mid + ':' + j] === true);
    if (all) { this.done.add(mid); this.G.audio.fanfare(); this.G.ui.achievement('Missioun erfëllt!', `${m.title} – ${m.reward}`); if (mid === 'schéiss') this.souvenirs.push('pluesch'); if (this.active === mid) this.nextMission(); }
    else this.G.ui.toast('✔️ ' + m.steps[i][2], m.title);
    this.G.ui.refreshMission(); this.save();
  }
  nextMission() { const n = MISSIONS.find(m => !this.done.has(m.id) && (!m.hidden || this.prog[m.id + ':seen'])); this.active = n ? n.id : null; }
  egg(id) { if (this.eggs.has(id)) return; this.eggs.add(id); const e = EGGS[id]; this.G.audio.fanfare(); this.G.ui.achievement('🥚 Easter Egg!', `${e.t} – ${e.d}`); this.save(); }

  // ---------------- Wegweiser (Fouer-Kompass) ----------------
  buildGuide() { const arr = []; const mat = Glow('#ffe066', 3); const geo = new THREE.ConeGeometry(0.45, 1.0, 3); geo.rotateX(Math.PI / 2); geo.scale(1, 0.25, 1); for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; this.G.scene.add(m); arr.push(m); } return arr; }
  setGuide(target) { this.guide = target; this.guideT = 0; if (target) this.G.ui.toast('🧭 Fouer-Kompass', `Gëllen Pfeiler féieren dech bei: ${target.name}`); }
  findNearest(need) {
    const p = this.G.player.pos; let best = null, bd = 1e9;
    for (const it of this.G.interacts) { if (need && it.need !== need) continue; const d = (it.x - p.x) ** 2 + (it.z - p.z) ** 2; if (d < bd && d > 9) { bd = d; best = it; } }
    return best && { x: best.x, z: best.z, name: best.label ? best.label().split(' – ')[0] : need };
  }
  updateGuide(dt) {
    const ms = this.guideMeshes; if (!this.guide || this.G.player.mode !== 'walk') { ms.forEach(m => m.visible = false); return; }
    const p = this.G.player.pos, g = this.guide; const dist = Math.hypot(g.x - p.x, g.z - p.z);
    if (dist < 3) { this.G.ui.toast('🎯 Do bass de!', g.name); this.guide = null; return; }
    this.guideT -= dt; if (this.guideT <= 0) { this.guideT = 1; const C = this.G.crowd; const a = C.nearestNode(p.x, p.z), b = C.nearestNode(g.x, g.z); this.gpath = [{ x: p.x, z: p.z }, ...C.path(a, b).map(i => C.nodes[i]), { x: g.x, z: g.z }]; }
    // Pfeile entlang des Weges
    const pts = this.gpath; let k = 0; const t0 = (this.G.time * 2) % 2.5;
    for (let i = 0; i < pts.length - 1 && k < ms.length; i++) { const a = pts[i], b = pts[i + 1]; const len = Math.hypot(b.x - a.x, b.z - a.z); const ang = Math.atan2(b.x - a.x, b.z - a.z);
      for (let s = (i === 0 ? 1.5 : 0) + t0; s < len && k < ms.length; s += 2.5) { const m = ms[k++]; m.visible = this.G.settings.guideArrows; m.position.set(a.x + (b.x - a.x) * s / len, 0.2 + Math.sin(this.G.time * 4 + k) * 0.04, a.z + (b.z - a.z) * s / len); m.rotation.y = ang; } }
    for (; k < ms.length; k++) ms[k].visible = false;
    this.guideDist = dist;
  }

  // ---------------- Sonder-NPCs & Easter Eggs ----------------
  buildSpecials() {
    const G = this.G;
    // Lämmy, das Maskottchen
    const laemmy = makeSheep({ mascot: true, scale: 1 }); G.scene.add(laemmy);
    const lm = { type: 'laemmy', mesh: laemmy, node: 0, next: 1, speed: 0.9, x: 0, z: 0 };
    const n0 = G.crowd.nodes[G.crowd.nearestNode(L(0, 5).x, L(0, 5).z)]; lm.x = n0.x; lm.z = n0.z; lm.node = G.crowd.nodes.indexOf(n0); lm.next = n0.n[0];
    this.specials.push(lm);
    lm.it = G.addInteract({ x: 0, z: 0, r: 2.5, kind: 'npc', need: 'info', label: () => 'Lämmy drécken 🐑', action: () => { G.audio.fanfare(); this.freeTickets += 3; G.ui.toast('🐑 Lämmy knuddelt dech!', 'Du kriss e Fouerbichelchen mat 3 Gratis-Tickets.'); this.egg('laemmy'); lm.hug = 2.5; } });
    // Gëlle Hämmelcher
    this.goldSheep = [];
    for (const s of GOLDEN_SHEEP) {
      if (this.sheepFound.has(s.id)) continue;
      if (s.ride) { this.goldSheep.push({ ...s }); continue; }
      let x = s.x, z = s.z; if (s.local) { const w = L(s.local[0], s.local[1]); x = w.x; z = w.z; }
      const m = makeSheep({ golden: true, scale: 0.7 }); m.position.set(x, s.y || 0, z); G.scene.add(m);
      this.goldSheep.push({ ...s, x, z, mesh: m });
    }
    // Verlorenes Kind beim Kettekarussell
    const kidPos = L(-88, 5); const kid = makeHuman({ scale: 0.58, shirt: '#ff8fab', pants: '#3a86ff', hair: '#c9a66b', hairStyle: 1 }); kid.position.set(kidPos.x, 0, kidPos.z); G.scene.add(kid);
    const K = { type: 'kid', mesh: kid, x: kidPos.x, z: kidPos.z, following: false, done: this.done.has('kand') }; if (K.done) kid.visible = false; this.specials.push(K);
    K.it = G.addInteract({ x: K.x, z: K.z, r: 2, kind: 'npc', need: 'info', label: () => K.following ? 'D\'Kand follegt dir' : 'Kräischend Kand – froen wat lass ass', action: () => {
      if (K.done || K.following) return; G.ui.dialog('Klengt Meedchen', '*schnuff* … Ech fannen meng Mamm net méi! Mir waren bei de Gromperekichelcher an elo … *schnuff*', [{ t: 'Komm mat, mir ginn bei den Info-Stand!', f: () => { K.following = true; this.prog['kand:seen'] = true; this.active = 'kand'; G.ui.refreshMission(); this.setGuide({ ...this.findInfo(), name: 'Info-Stand (E1)' }); } }, { t: 'Spéider', f: () => { } }]); } });
    // Dieb-Mission
    this.thief = null;
    // Hämmelsmarsch-Parade
    this.parade = null;
    // Geist von Jhang de Blannen (Johann der Blinde, Gründer der Fouer 1340) – bei der Rue Jean l'Aveugle
    const gh = new THREE.Group(); const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.9, 1.4), transparent: true, opacity: 0.55, depthWrite: false });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 16, 1, true), gm); body.position.y = 1.1; gh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), gm); head.position.y = 2.15; gh.add(head);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.14, 8, 1, true), Glow('#ffd700', 2)); crown.position.y = 2.38; gh.add(crown);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), Glow('#cfe8ff', 1.5)); sword.position.set(0.45, 1.1, 0.1); gh.add(sword);
    gh.position.set(-93, 0, -38); G.scene.add(gh); gh.visible = false;
    const J = { type: 'johann', mesh: gh }; this.specials.push(J);
    J.it = G.addInteract({ x: -93, z: -38, r: 3, kind: 'npc', need: 'none', label: () => gh.visible ? '👻 Geeschtereg Gestalt uschwätzen' : '', action: () => { if (!gh.visible) return; G.ui.dialog('Jhang de Blannen (Jean l\'Aveugle)', 'Ech sinn de Jhang, Grof vu Lëtzebuerg a Kinnek vu Béimen. 1340 hunn ech dës Fouer gegrënnt – als Maart fir Véi, Stoff a Wueren, ëm Bartholomäusdag. Bal 700 Joer méi spéit danzt Dir hei an der Nuecht … Ech gesinn näischt, mee ech héieren d\'Laachen. Dat geet mer duer.', [{ t: 'Merci, Här Grof!', f: () => this.egg('johann') }]); } });
    // Theater-Besuch
    G.addInteract({ x: 262, z: -52, r: 4, kind: 'npc', need: 'none', label: () => 'Grand Théâtre – Programm kucken', action: () => { G.ui.dialog('Grand Théâtre de la Ville de Luxembourg', 'Eröffnet 1964, Architekt Alain Bourbonnais. Haut Owend: Kee Spektakel – all d\'Leit sinn op der Fouer!', [{ t: 'Logesch!', f: () => this.egg('theater') }]); } });
    // Tram
    this.tramIt = G.addInteract({ x: 0, z: 0, r: 7, kind: 'npc', need: 'none', label: () => G.tram.wait > 0 ? '🚋 Tram T1 – aklammen (gratis)' : '', action: () => { if (G.tram.wait > 0) this.rideTram(); } });
    // Feuerwerk-Partikel
    this.fw = new Fireworks(G);
  }
  findInfo() { const s = this.G.stalls.find(s => s.T.info); return { x: s.x, z: s.z }; }
  reunite(K) {
    const G = this.G; const mom = makeHuman({ shirt: '#ff8fab', pants: '#3d405b', hair: '#c9a66b', hairStyle: 1 }); const p = this.findInfo(); mom.position.set(p.x + 1.5, 0, p.z + 1); G.scene.add(mom);
    G.ui.dialog('Mamm', 'Lena!! Do bass du jo! Ech war sou voller Suerg … Villmools Merci, Dir sidd en Engel!', [{ t: 'Gär geschitt 😊', f: () => { } }]);
    this.check('child', 1); setTimeout(() => { G.scene.remove(mom); K.mesh.visible = false; }, 9000);
  }
  startThief() {
    const G = this.G; if (this.thief || this.done.has('dief')) return;
    const C = G.crowd; const startN = C.nearestNode(G.player.pos.x + 12, G.player.pos.z + 12);
    const exits = [L(-110, -24), L(-110, 31), L(19, -38)]; const ex = pick(exits); const goalN = C.nearestNode(ex.x, ex.z);
    const path = C.path(startN, goalN).map(i => C.nodes[i]); if (path.length < 3) return;
    const m = makeHuman({ shirt: '#111111', pants: '#222222', hair: '#111', hairStyle: 0 }); const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), M('#111')); m.userData.P.head.add(hood);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.1), M('#c1121f')); m.userData.P.slot.hand.add(bag);
    m.position.set(path[0].x, 0, path[0].z); G.scene.add(m);
    this.thief = { mesh: m, path, i: 1, x: path[0].x, z: path[0].z, speed: 4.6, t: 0 };
    this.prog['dief:seen'] = true; this.active = 'dief'; G.ui.refreshMission();
    G.audio.scream(G.player.pos); G.ui.toast('😱 „Hëllef! Meng Täsch!“', 'En Dief leeft fort – hannendrun! (Shift)');
    this.thief.it = G.addInteract({ x: 0, z: 0, r: 1.8, kind: 'npc', need: 'none', label: () => this.thief ? '🫳 Dief tacklen!' : '', action: () => { if (!this.thief) return; this.caught(); } });
  }
  caught() { const G = this.G; const T = this.thief; T.mesh.rotation.x = -1.4; T.mesh.position.y = 0.25; G.player.shake = 0.6; G.audio.bump(1); this.check('thief', 1); G.ui.dialog('Tourist', 'Meng Täsch! Mäi Pass, mäi Portmonni … Dir sidd en Held! Thank you, merci, villmools merci!', [{ t: 'Keen Problem', f: () => { } }]);
    setTimeout(() => { G.scene.remove(T.mesh); }, 5000); T.it.r = 0; this.thief = null; }
  startParade() {
    const G = this.G; const C = G.crowd; const a = C.nearestNode(L(GATE.u - 14, GATE.v - 8).x, L(GATE.u - 14, GATE.v - 8).z), b = C.nearestNode(L(-100, 5).x, L(-100, 5).z);
    const path = C.path(a, b).map(i => C.nodes[i]); const members = [];
    for (let i = 0; i < 8; i++) { const h = makeHuman({ shirt: '#1d3557', pants: '#111', hairStyle: 0 }); const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12), M('#1d3557')); hat.position.y = 0.1; h.userData.P.slot.head.add(hat);
      const inst = new THREE.Mesh(i % 3 === 0 ? new THREE.TorusGeometry(0.18, 0.05, 6, 16) : new THREE.ConeGeometry(0.1, 0.5, 10, 1, true), M('#d4af37', { metalness: 0.9, roughness: 0.2 })); inst.rotation.x = Math.PI / 2; inst.position.set(0, 0.55, 0.25); h.userData.P.hips.add(inst); G.scene.add(h); members.push({ m: h, off: -i * 1.3 - Math.floor(i / 2) * 0.2, side: i % 2 ? 0.8 : -0.8 }); }
    for (let i = 0; i < 5; i++) { const s = makeSheep({ scale: 0.9 }); G.scene.add(s); members.push({ m: s, off: -12 - i * 1.4, side: R(-1, 1), sheep: true }); }
    this.parade = { path, s: 0, members, follow: 0, len: path.reduce((acc, n, i) => i ? acc + Math.hypot(n.x - path[i - 1].x, n.z - path[i - 1].z) : 0, 0) };
    G.ui.toast('🎺 Hämmelsmarsch!', 'D\'Blosmusek mat de Schof zitt duerch d\'Haaptallee. Marschéier mat!'); G.audio.parade(true);
  }
  update(dt) {
    const G = this.G, P = G.player; const p = P.pos;
    this.stats.play += dt; if (this._lp) this.stats.dist += Math.min(5, Math.hypot(p.x - this._lp.x, p.z - this._lp.z)); this._lp = { x: p.x, z: p.z }; this._saveT = (this._saveT || 0) + dt; if (this._saveT > 20 && G.settings.autosave) { this._saveT = 0; this.save(); }
    // nächstes Interaktionsziel
    let best = null, bd = 1e9;
    if (P.mode === 'walk' && !G.ui.blockInput()) for (const it of G.interacts) { if (!it.r) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < it.r && d < bd) { const lab = it.label(); if (!lab) continue; bd = d; best = it; } }
    this.focus = best; G.ui.prompt(best ? best.label() : null);
    if (G.input.was(G.settings.keys.act) || G.input.touchE) { G.input.touchE = false; if (P.mode === 'walk' && best) this.interact(best); else if (P.mode === 'ride' && P.ride?.cfg.type === 'tram') { } }
    if (G.input.was(G.settings.keys.view)) P.view = P.view === 'first' ? 'third' : 'first';
    // Specials
    for (const s of this.specials) {
      if (s.type === 'laemmy') {
        if (s.hug > 0) { s.hug -= dt; s.mesh.rotation.y += dt * 6; }
        else { const B = G.crowd.nodes[s.next]; const dx = B.x - s.x, dz = B.z - s.z, d = Math.hypot(dx, dz); if (d < 0.8) { const nb = B.n.filter(n => n !== s.node); s.node = s.next; s.next = pick(nb.length ? nb : B.n); } else { s.x += dx / d * s.speed * dt; s.z += dz / d * s.speed * dt; s.mesh.rotation.y = Math.atan2(dx, dz); } }
        s.mesh.position.set(s.x, Math.abs(Math.sin(G.time * 5)) * 0.08, s.z); s.it.x = s.x; s.it.z = s.z;
        s.mesh.userData.legs.forEach((l, i) => l.rotation.x = Math.sin(G.time * 5 + i * Math.PI) * 0.4);
      } else if (s.type === 'kid' && !s.done) {
        if (s.following) { const tx = p.x - Math.sin(P.yaw) * 1.4, tz = p.z - Math.cos(P.yaw) * 1.4; const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz); if (d > 0.3) { const v = Math.min(d * 2.5, 6.5); s.x += dx / d * v * dt; s.z += dz / d * v * dt; s.mesh.rotation.y = Math.atan2(dx, dz); } animateHuman(s.mesh, d > 0.3 ? Math.min(d * 2, 4) : 0, dt); s.mesh.position.set(s.x, 0, s.z); }
        else { s.mesh.rotation.y = Math.sin(G.time * 0.7) * 0.8; s.mesh.userData.P.head.rotation.x = 0.3 + Math.sin(G.time * 8) * 0.05; s.mesh.userData.P.armL.rotation.x = s.mesh.userData.P.armR.rotation.x = -2.2; }
        s.it.x = s.x; s.it.z = s.z;
      } else if (s.type === 'johann') {
        const m = G.minutes % 1440; s.mesh.visible = m < 60 || m >= 1440; s.mesh.position.y = 0.2 + Math.sin(G.time * 1.5) * 0.15; s.mesh.rotation.y += dt * 0.3;
      }
    }
    // Gëlle Hämmelcher
    for (const s of this.goldSheep) {
      if (this.sheepFound.has(s.id)) continue;
      let hit = false;
      if (s.mesh) { s.mesh.rotation.y += dt * 1.5; s.mesh.position.y = (s.y || 0) + Math.sin(G.time * 2 + s.id) * 0.1; if (Math.hypot(s.x - p.x, s.z - p.z) < 1.6 && P.mode === 'walk') hit = true; }
      else if (P.ride && P.ride.id === s.ride) { const r = P.ride; if ((s.ride === 'riesenrad' && r.atTop) || (s.ride === 'freefall' && r.height > r.H - 10) || (s.ride === 'geescht' && r.inside && r.t / r.runT > 0.45)) hit = true; }
      if (hit) { this.sheepFound.add(s.id); if (s.mesh) G.scene.remove(s.mesh); G.audio.coin(); G.ui.toast(`🐑✨ Gëllent Hämmelchen ${this.sheepFound.size}/7`, s.hint); this.check('sheep', this.sheepFound.size); this.save(); }
    }
    // Tram-Interaktion folgt dem Zug
    if (G.tram.pos) { this.tramIt.x = G.tram.pos.x; this.tramIt.z = G.tram.pos.z; }
    if (P.mode === 'tram' && G.tram.wait > 0 && G.tram.atStop !== this.tramFrom && this.tramRide) { const fr = this.tramRide; this.tramRide = null; P.ride = fr; P.unboard(fr); }
    // Dieb
    if (!this.thief && !this.done.has('dief') && G.minutes > 21 * 60 + 30 && P.mode === 'walk' && rand() < dt * 0.02 && this.done.size >= 1) this.startThief();
    if (this.thief) { const T = this.thief; const n = T.path[T.i]; const dx = n.x - T.x, dz = n.z - T.z, d = Math.hypot(dx, dz);
      const near = Math.hypot(T.x - p.x, T.z - p.z); const sp = near < 4 ? T.speed * 0.82 : T.speed; // erschöpft
      if (d < 1) { T.i++; if (T.i >= T.path.length) { G.scene.remove(T.mesh); G.ui.toast('💨 Den Dief ass fort …', 'Hie kënnt bestëmmt erëm. Bleif opmierksam!'); T.it.r = 0; this.thief = null; } }
      else { T.x += dx / d * sp * dt; T.z += dz / d * sp * dt; T.mesh.rotation.y = Math.atan2(dx, dz); }
      if (this.thief) { T.mesh.position.set(T.x, 0, T.z); animateHuman(T.mesh, sp, dt, 'run'); T.it.x = T.x; T.it.z = T.z; this.guide = { x: T.x, z: T.z, name: 'Dief' }; }
    }
    // Parade um 21:00 am Eröffnungstag
    if (G.day?.parade && !this.parade && !this.paradeDone && G.minutes >= 21 * 60 && G.minutes < 21 * 60 + 40) this.startParade();
    if (this.parade) { const Pa = this.parade; Pa.s += dt * 1.05;
      for (const mb of Pa.members) { const o = this.along(Pa.path, Math.max(0, Pa.s + mb.off)); mb.m.position.set(o.x + Math.cos(o.ang) * mb.side, 0, o.z - Math.sin(o.ang) * mb.side); mb.m.rotation.y = o.ang; if (!mb.sheep) animateHuman(mb.m, 1.05, dt); else mb.m.userData.legs.forEach((l, i) => l.rotation.x = Math.sin(G.time * 6 + i * Math.PI) * 0.5); }
      const lead = this.along(Pa.path, Pa.s); G.audio.paradePos = lead; if (Math.hypot(lead.x - p.x, lead.z - p.z) < 9) { Pa.follow += dt; if (Pa.follow > 30) this.egg('parade'); }
      if (Pa.s > Pa.len + 20) { for (const mb of Pa.members) G.scene.remove(mb.m); this.parade = null; this.paradeDone = true; G.audio.parade(false); } }
    // Mitternacht im Riesenrad
    if (P.ride?.id === 'riesenrad' && Math.floor(G.minutes) % 1440 === 0) this.egg('mitternacht');
    // Feuerwerk am letzten Tag
    if (G.day?.fireworks && G.minutes >= G.day.fireworks && G.minutes < G.day.fireworks + 8) { this.fw.active = true; if (G.minutes > G.day.fireworks + 1) this.egg('feier'); } else this.fw.active = false;
    this.fw.update(dt);
    // Konami-Regen
    if (this.rain) this.updateRain(dt);
    this.updateGuide(dt);
    // Promille-Hinweis
    if (P.stats.promille > 1.6 && !this._warned) { this._warned = true; G.ui.toast('🥴 Alles dréit sech …', 'Och ouni Break Dance. Zäit fir e Waasser!'); }
    if (P.stats.promille < 0.8) this._warned = false;
  }
  along(path, s) { for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i]; const l = Math.hypot(b.x - a.x, b.z - a.z); if (s <= l) return { x: a.x + (b.x - a.x) * s / l, z: a.z + (b.z - a.z) * s / l, ang: Math.atan2(b.x - a.x, b.z - a.z) }; s -= l; } const b = path[path.length - 1]; return { x: b.x, z: b.z, ang: 0 }; }
  onKey(e) {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    this.konami.push(e.code); this.konami = this.konami.slice(-10); if (this.konami.join() === seq.join()) this.startRain();
    this.G.ui.onKey(e);
  }
  startRain() {
    const G = this.G; this.egg('konami'); const n = 300; const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10), M('#c98a2b', { roughness: 0.6 }), n); im.frustumCulled = false; G.scene.add(im);
    this.rain = { im, t: 12, d: Array.from({ length: n }, () => ({ x: R(-25, 25), y: R(5, 40), z: R(-25, 25), v: R(3, 8), r: R(0, 6) })) }; G.audio.fanfare();
  }
  updateRain(dt) {
    const r = this.rain, p = this.G.player.pos, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); r.t -= dt;
    r.d.forEach((o, i) => { o.y -= o.v * dt; o.r += dt * 3; if (o.y < 0.05) { o.y = 0.05; o.v = 0; } e.set(o.r, o.r * 0.5, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(p.x + o.x, o.y, p.z + o.z), q, new THREE.Vector3(1, 1, 1)); r.im.setMatrixAt(i, m); });
    r.im.instanceMatrix.needsUpdate = true; if (r.t < 0) { this.G.scene.remove(r.im); this.rain = null; }
  }
}

// Feuerwerk über dem Pont Grande-Duchesse Charlotte
class Fireworks {
  constructor(G) {
    this.G = G; this.active = false; const N = 3000; this.N = N;
    const geo = new THREE.BufferGeometry(); this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.life = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const spr = document.createElement('canvas'); spr.width = spr.height = 64; const sg = spr.getContext('2d'); const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(spr), size: 9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
    this.pts.frustumCulled = false; G.scene.add(this.pts); this.next = 0; this.cursor = 0;
  }
  burst() {
    const c = new THREE.Color().setHSL(rand(), 1, 0.6).multiplyScalar(4); const cx = R(380, 560), cy = R(90, 170), cz = R(-140, -50); const n = 260;
    for (let k = 0; k < n; k++) { const i = this.cursor++ % this.N; const th = rand() * Math.PI * 2, ph = Math.acos(R(-1, 1)), sp = R(18, 30);
      this.pos.set([cx, cy, cz], i * 3); this.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], i * 3); this.col.set([c.r, c.g, c.b], i * 3); this.life[i] = R(1.6, 2.6); }
    this.G.audio.boom(Math.hypot(cx - this.G.player.pos.x, cz - this.G.player.pos.z));
  }
  update(dt) {
    if (this.active) { this.next -= dt; if (this.next < 0) { this.next = R(0.25, 1.1); this.burst(); if (rand() < 0.3) this.burst(); } }
    for (let i = 0; i < this.N; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt; const j = i * 3; this.vel[j + 1] -= 9.81 * dt * 0.6; for (let a = 0; a < 3; a++) { this.vel[j + a] *= 1 - dt * 0.9; this.pos[j + a] += this.vel[j + a] * dt; } const f = this.life[i] < 0.6 ? 0.92 : 1; this.col[j] *= f; this.col[j + 1] *= f; this.col[j + 2] *= f; if (this.life[i] <= 0) this.pos[j + 1] = -999; }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}
