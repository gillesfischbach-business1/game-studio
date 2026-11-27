// Klangkulisse der Fouer (WebAudio, 3D):
// - echte Aufnahmen (CC0 / CC BY / CC BY-SA, siehe assets/audio/CREDITS.md): Menschenmenge, Musik an den
//   Fahrgeschäften, Gläser, Geschirr, Küche, Ausrufer, Gesprächsfetzen (lb/fr/de/pt), Regen, Feuerwerk
// - jede Quelle sitzt räumlich an ihrem Ort (PannerNode, HRTF am PC), Entfernung dämpft Höhen (Luftabsorption)
// - gemeinsamer Hall-Bus für Lautsprecher-Musik und Stimmen
// - prozedurale Effekte bleiben für Kassen, Fahrten, Mini-Spiele und die Blosmusek (Hämmelsmarsch)
import { L, RIDES, EXTRA_RIDES, RESTAURANTS, RESTO_ROW } from './data.js';

const BASE = 'assets/audio/';
const BEDS = ['crowd_murmur', 'crowd_busy', 'crowd_cheer', 'kitchen', 'rain_roof', 'motor'];
const SHOTS = ['glass', 'dishes', 'shot', 'voices', 'giggle', 'barker1', 'barker2'];
// Musik pro Fahrgeschäft: Datei + Lautstärke der Anlage (1 = sehr laut)
const RIDE_MUSIC = {
  breakdance: ['mus_groove', 1.0], autoscooter: ['mus_house', 1.0], coaster: ['mus_celeb', 0.75], pendel: ['mus_dance', 0.9],
  freefall: ['mus_layers', 0.7], kette: ['mus_choro', 0.5], carousel: ['mus_organ', 0.6], vr: ['mus_layers', 0.35],
};
const EXTRA_MUSIC = {
  'Rotor': ['mus_house', 0.7], 'Circus Circus': ['mus_choro', 0.55], 'XXL': ['mus_layers', 0.95], 'Aeronaut': ['mus_celeb', 0.6],
  'Tagada': ['mus_groove', 0.9], 'Shakers': ['mus_celeb', 0.8], 'Transformer': ['mus_layers', 0.8], 'Après-Ski Party': ['mus_polka', 1.0],
  'BoosterMaxxx': ['mus_dance', 0.95], 'Big Splash': ['mus_house', 0.6], 'Bayern Kurve': ['mus_polka', 0.75], 'Magic World': ['mus_organ', 0.45],
};
const MUSIC_SLOTS = 3;        // so viele Anlagen spielen gleichzeitig (die nächsten)
const MUSIC_RANGE = 85;       // m
const pick = a => a[Math.floor(Math.random() * a.length)];

export class Audio {
  constructor(G) { this.G = G; this.ok = false; this.muted = false; this.paradeOn = false; this.buf = {}; this.sprites = {}; this.rideMusic = true; }
  start() {
    if (this.ok) return;
    const mobile = this.G.isMobile;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: mobile ? 32000 : 44100, latencyHint: 'playback' }); }
    catch (e) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e2) { return; } }
    const c = this.ctx; this.ok = true;
    this.panModel = mobile ? 'equalpower' : 'HRTF';
    // Ausgang mit Limiter, damit laute Anlagen nicht übersteuern
    this.out = c.createGain(); this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 6; this.limiter.attack.value = 0.004; this.limiter.release.value = 0.25;
    this.out.connect(this.limiter).connect(c.destination);
    this.musicBus = c.createGain(); this.sfxBus = c.createGain(); this.ambBus = c.createGain();
    for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.out);
    this.master = this.sfxBus; this.setVolumes(this.G.settings);
    // Hall (offener Platz zwischen Fassaden): kurzer, dunkler Nachhall
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(mobile ? 1.1 : 1.7); this.verbOut = c.createGain(); this.verbOut.gain.value = 0.55;
    this.verb.connect(this.verbOut).connect(this.out);
    // Rauschen-Puffer für prozedurale Effekte
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate); const d = this.noise.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.15; }
    // Ersatz-Menge (falls Aufnahmen fehlen), wird stumm, sobald echte Aufnahmen da sind
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6; this.crowdG = c.createGain(); this.crowdG.gain.value = 0;
    src.connect(bp).connect(this.crowdG).connect(this.ambBus); src.start();
    // Blosmusek (Hämmelsmarsch) bleibt prozedural; Ersatz-Zonen nur ohne Aufnahmen
    this.zones = {
      techno: { g: c.createGain(), pos: ['breakdance', 'coaster', 'autoscooter'], bpm: 128 },
      orgel: { g: c.createGain(), pos: ['carousel', 'riesenrad'], bpm: 150 },
      blos: { g: c.createGain(), pos: [], bpm: 112 },
    };
    for (const z of Object.values(this.zones)) { z.g.gain.value = 0; z.g.connect(this.musicBus); z.next = c.currentTime + 0.1; z.step = 0; }
    this.buildEmitters();
    this.nextT = { voice: 4, glass: 2, dish: 6, barker: 20, shot: 8, giggle: 30, scream: 5 }; this.lastVoices = [];
    this.load();
    setInterval(() => this.schedule(), 60);
    setInterval(() => this.listen(), 50);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (!this.muted) this.ctx.resume(); });
    this.loop();
  }
  // ---------------- Laden ----------------
  async load() {
    const c = this.ctx;
    const get = async k => { try { const r = await fetch(BASE + k + '.mp3'); if (!r.ok) throw new Error(r.status); const ab = await r.arrayBuffer(); this.buf[k] = await c.decodeAudioData(ab); } catch (e) { console.warn('Toun fehlt', k, e); } };
    try { this.sprites = await (await fetch(BASE + 'sprites.json')).json(); } catch (e) { this.sprites = {}; }
    await get('crowd_murmur'); this.startBeds();           // zuerst die Menge, damit es sofort lebt
    for (const k of ['crowd_busy', 'glass', 'voices', 'kitchen']) await get(k);
    this.startBeds();
    for (const k of ['crowd_cheer', 'dishes', 'shot', 'giggle', 'barker1', 'barker2', 'rain_roof', 'scream', 'motor']) await get(k);
    this.startBeds();
    this.assetsOk = !!this.buf.crowd_murmur;
  }
  startBeds() {
    const c = this.ctx; this.beds ||= {};
    for (const k of BEDS) {
      if (this.beds[k] || !this.buf[k]) continue;
      const s = c.createBufferSource(); s.buffer = this.buf[k]; s.loop = true; s.playbackRate.value = 0.97 + Math.random() * 0.06;
      const g = c.createGain(); g.gain.value = 0; s.connect(g);
      let node = g;
      if (k === 'kitchen' || k === 'motor') { node = this.panner(k === 'motor' ? 5 : 4, 1.3); g.connect(node); }   // Küche: räumlich an der Restaurantreihe
      node.connect(k === 'rain_roof' ? this.ambBus : this.ambBus);
      s.start(0, Math.random() * this.buf[k].duration);
      this.beds[k] = { s, g, p: node !== g ? node : null };
    }
  }
  // ---------------- Bausteine ----------------
  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / n; const w = (Math.random() * 2 - 1); lp += (w - lp) * (0.35 - 0.25 * t); d[i] = lp * Math.pow(1 - t, 3.2) * (i < c.sampleRate * 0.012 ? 0 : 1); }
      // frühe Reflexionen der Fassaden
      for (const [ms, a] of [[23, 0.5], [41, 0.35], [67, 0.28], [97, 0.2]]) { const j = Math.floor(c.sampleRate * ms / 1000) + ch * 7; if (j < n) d[j] += a; } }
    return ir;
  }
  panner(ref = 6, roll = 1.1) {
    const p = this.ctx.createPanner(); p.panningModel = this.panModel; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = 400; p.rolloffFactor = roll;
    return p;
  }
  setPos(p, x, y, z) { if (!isFinite(x + y + z)) return; const t = this.ctx.currentTime; if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.05); p.positionY.setTargetAtTime(y, t, 0.05); p.positionZ.setTargetAtTime(z, t, 0.05); } else p.setPosition(x, y, z); }
  listen() {
    const cam = this.G.camera; if (!cam || !this.ctx) return; const l = this.ctx.listener, t = this.ctx.currentTime;
    cam.getWorldDirection(this._dir ||= new this.G.THREE.Vector3()); const p = cam.position; if (!isFinite(p.x + p.y + p.z + this._dir.x + this._dir.y + this._dir.z)) return;   // Kamera kann beim Umsetzen ein Bild lang ungültig sein
    if (l.positionX) { l.positionX.setTargetAtTime(p.x, t, 0.03); l.positionY.setTargetAtTime(p.y, t, 0.03); l.positionZ.setTargetAtTime(p.z, t, 0.03);
      l.forwardX.setTargetAtTime(this._dir.x, t, 0.03); l.forwardY.setTargetAtTime(this._dir.y, t, 0.03); l.forwardZ.setTargetAtTime(this._dir.z, t, 0.03); l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(p.x, p.y, p.z); l.setOrientation(this._dir.x, this._dir.y, this._dir.z, 0, 1, 0); }
  }
  buildEmitters() {
    const G = this.G; this.music = [];
    for (const [id, cfg] of Object.entries(RIDES)) { const m = RIDE_MUSIC[id]; if (!m) continue; const w = L(cfg.u, cfg.v); this.music.push({ id, x: w.x, z: w.z, track: m[0], loud: m[1] }); }
    EXTRA_RIDES.forEach((cfg, i) => { const m = EXTRA_MUSIC[cfg.name]; if (!m) return; const w = L(cfg.u, cfg.v); this.music.push({ id: 'x' + i, x: w.x, z: w.z, track: m[0], loud: m[1] }); });
    this.restos = RESTAURANTS.map(r => { const w = L(r.u, RESTO_ROW.v); return { x: w.x, z: w.z, name: r.name }; });
    this.slots = [];
    const c = this.ctx;
    for (let i = 0; i < MUSIC_SLOTS; i++) {
      // Lautsprecher-Charakter: Bass-Schnitt, Präsenz, leichte Sättigung
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 75;
      const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.gain.value = 3; pk.Q.value = 0.8;
      const sat = c.createWaveShaper(); sat.curve = this.satCurve(); sat.oversample = 'none';
      const air = c.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 16000;
      const g = c.createGain(); g.gain.value = 0; const p = this.panner(9, 1.0); const send = c.createGain(); send.gain.value = 0.22;
      hp.connect(pk).connect(sat).connect(air).connect(g).connect(p).connect(this.musicBus); g.connect(send).connect(this.verb);
      this.slots.push({ hp, g, p, air, em: null, src: null });
    }
    this.musicCache = new Map();   // höchstens 4 dekodierte Titel im Speicher
  }
  async track(name) {
    if (this.musicCache.has(name)) { const b = this.musicCache.get(name); this.musicCache.delete(name); this.musicCache.set(name, b); return b; }
    const r = await fetch(BASE + name + '.mp3'); if (!r.ok) throw new Error(r.status);
    const b = await this.ctx.decodeAudioData(await r.arrayBuffer());
    this.musicCache.set(name, b); while (this.musicCache.size > 4) this.musicCache.delete(this.musicCache.keys().next().value);
    return b;
  }
  satCurve() { if (this._sat) return this._sat; const n = 1024, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } return (this._sat = a); }
  mute(m) { this.muted = m; this.setVolumes(this.G.settings); }
  setVolumes(S) { if (!this.out) return; this.out.gain.value = this.muted ? 0 : S.vMaster; this.musicBus.gain.value = S.vMusic; this.sfxBus.gain.value = S.vSfx; this.ambBus.gain.value = S.vAmb; }
  toggleRideMusic() { this.rideMusic = !this.rideMusic; }
  parade(on) { this.paradeOn = on; }
  // ---------------- Steuerung (5x pro Sekunde) ----------------
  loop() {
    if (!this.ok) return;
    const now = this.ctx.currentTime, dt = Math.min(1, Math.max(0.05, now - (this._lastTick ?? now - 0.2))); this._lastTick = now;   // echte Zeit, auch wenn die Grafik ruckelt
    try { this.tick(dt); } catch (e) { console.warn('Toun', e); }
    setTimeout(() => this.loop(), 200);
  }
  tick(dt) {
    const G = this.G, c = this.ctx, t = c.currentTime; const p = G.player?.pos; if (!p) return;
    const night = G.night ?? 1, eve = 0.75 + 0.35 * night;
    // Dichte der Menge um den Spieler
    let near = 0; const A = G.crowd?.a; if (A) for (let i = 0; i < A.length; i += 2) { const o = A[i]; if (o.state === 'static') continue; const dx = o.x - p.x, dz = o.z - p.z; if (dx * dx + dz * dz < 400) near++; }
    const dens = Math.min(1, near / (G.isMobile ? 14 : 24));
    const inFair = G.crowd ? Math.max(0, 1 - Math.min(...G.crowd.nodes.slice(0, 60).map(n => Math.hypot(n.x - p.x, n.z - p.z))) / 90) : 0.5;
    this.inFair = inFair; this.dens = dens;
    const B = this.beds || {};
    if (B.crowd_murmur) {
      this.crowdG.gain.setTargetAtTime(0, t, 0.5);
      B.crowd_murmur.g.gain.setTargetAtTime((0.25 + 0.55 * inFair) * (0.6 + 0.5 * dens) * eve, t, 0.6);
      B.crowd_busy?.g.gain.setTargetAtTime(inFair * dens * 0.55 * (0.5 + 0.5 * night), t, 0.8);
    } else this.crowdG.gain.setTargetAtTime(0.05 + inFair * 0.22, t, 0.3);
    // Jubel in der Nähe laufender Thrill-Fahrten
    let thrill = 0; for (const r of Object.values(G.rides || {})) { if (!r.k || !(r.cfg.thrill >= 3 || r.style === 'tower')) continue; const w = L(r.cfg.u, r.cfg.v); const d = Math.hypot(w.x - p.x, w.z - p.z); const v = r.k * Math.max(0, 1 - d / 45); if (v > thrill) { thrill = v; this.thrillPos = w; } }
    this.thrill = thrill;
    B.crowd_cheer?.g.gain.setTargetAtTime(thrill * 0.45, t, 0.7);
    // Restaurant-Küche: an das nächste Lokal setzen
    let rn = null, rd = 1e9; for (const r of this.restos) { const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < rd) { rd = d; rn = r; } }
    if (B.kitchen && rn) { this.setPos(B.kitchen.p, rn.x, 1.5, rn.z); B.kitchen.g.gain.setTargetAtTime(rd < 40 ? 0.5 * eve : 0, t, 0.8); }
    // Regen aufs Budendach
    // Antriebsbrummen des nächsten laufenden Fahrgeschäfts
    if (B.motor) { let mr = null, md = 1e9, mk = 0; for (const r of Object.values(G.rides || {})) { if (!(r.k > 0.05)) continue; const w = L(r.cfg.u, r.cfg.v); const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < md) { md = d; mr = w; mk = r.k; } }
      if (mr && md < 40) { this.setPos(B.motor.p, mr.x, 2, mr.z); B.motor.s.playbackRate.setTargetAtTime(0.8 + mk * 0.5, t, 0.5); B.motor.g.gain.setTargetAtTime(0.5 * mk, t, 0.5); } else B.motor.g.gain.setTargetAtTime(0, t, 0.5); }
    this.updateMarch(p, t);
    const rain = G.settings.weather === 'reen' ? 1 : 0; B.rain_roof?.g.gain.setTargetAtTime(rain * (0.25 + 0.45 * inFair), t, 1.2);
    this.updateMusic(p, t, eve);
    this.updateZones(p, t);
    this.events(dt, p, rd, rn, night, dens);
  }
  updateMusic(p, t, eve) {
    if (!this.slots) return; const G = this.G;
    if (!this.assetsOk) return;            // Ersatz-Zonen übernehmen
    const op = G.player.mode === 'operator' ? G.player.ride?.id : null;
    const cand = this.music.map(e => ({ e, d: Math.hypot(e.x - p.x, e.z - p.z) })).filter(o => o.d < MUSIC_RANGE).sort((a, b) => a.d - b.d).slice(0, MUSIC_SLOTS);
    const want = new Set(cand.map(o => o.e));
    for (const s of this.slots) if (s.em && !want.has(s.em)) { s.em = null; s.g.gain.setTargetAtTime(0, t, 0.25); const old = s.src; s.src = null; if (old) setTimeout(() => { try { old.stop(); old.disconnect(); } catch (e) {} }, 1500); }
    for (const o of cand) {
      let s = this.slots.find(x => x.em === o.e);
      if (!s) { s = this.slots.find(x => !x.em && !x.src && !x.busy); if (!s) continue;
        s.em = o.e; s.busy = true; this.setPos(s.p, o.e.x, 6, o.e.z);
        const em = o.e;
        this.track(em.track).then(b => { s.busy = false; if (s.em !== em) return; const src = this.ctx.createBufferSource(); src.buffer = b; src.loop = true; src.connect(s.hp); src.start(0, Math.random() * b.duration); s.src = src; })
          .catch(e => { s.busy = false; s.em = null; console.warn('Musek fehlt', em.track, e); }); }
      const r = G.rides?.[o.e.id]; const run = r ? (r.phase === 'run' ? 1 : 0.7) : 0.8;
      let v = o.e.loud * run * eve * 0.9; if (o.e.id === op) v = this.rideMusic ? 1.0 : 0.08; else if (!this.rideMusic && o.e.loud > 0.8 && o.d < 20) v *= 0.4;
      s.g.gain.setTargetAtTime(s.src ? v : 0, t, 0.35);
      s.air.frequency.setTargetAtTime(600 + 15000 * Math.exp(-o.d / 38), t, 0.3);
    }
  }
  /** Hämmelsmarsch: echte Blaskapelle, die räumlich mit dem Umzug mitzieht */
  updateMarch(p, t) {
    if (this.paradeOn && this.paradePos) {
      if (!this.march) { const c = this.ctx; const g = c.createGain(); g.gain.value = 0; const pn = this.panner(10, 1.0); const send = c.createGain(); send.gain.value = 0.18; g.connect(pn).connect(this.musicBus); g.connect(send).connect(this.verb); this.march = { g, pn, src: null };
        this.track('mus_march').then(b => { if (!this.march) return; const src = c.createBufferSource(); src.buffer = b; src.loop = true; src.connect(g); src.start(); this.march.src = src; }).catch(e => console.warn('Musek fehlt', 'mus_march', e)); }
      this.setPos(this.march.pn, this.paradePos.x, 2, this.paradePos.z); this.march.g.gain.setTargetAtTime(this.march.src ? 1.0 : 0, t, 0.5);
    } else if (this.march) { const m = this.march; this.march = null; m.g.gain.setTargetAtTime(0, t, 0.8); setTimeout(() => { try { m.src?.stop(); m.g.disconnect(); } catch (e) {} }, 4000); }
  }
  updateZones(p, t) {
    const G = this.G;
    for (const [k, z] of Object.entries(this.zones)) {
      let dmin = 1e9; if (k === 'blos') { if (this.paradeOn && this.paradePos && !this.march?.src) dmin = Math.hypot(this.paradePos.x - p.x, this.paradePos.z - p.z); }
      else if (!this.assetsOk) for (const id of z.pos) { const r = G.rides?.[id]; if (!r) continue; const w = L(r.cfg.u, r.cfg.v); dmin = Math.min(dmin, Math.hypot(w.x - p.x, w.z - p.z)); }
      let v = Math.max(0, 1 - dmin / (k === 'blos' ? 60 : 70)); v = v * v * (k === 'techno' && !this.rideMusic ? 0.2 : 1);
      if (G.player.mode === 'operator' && k === 'techno' && !this.assetsOk) v = this.rideMusic ? 0.8 : 0.1;
      z.g.gain.setTargetAtTime(v * (k === 'blos' ? 0.5 : 0.32), t, 0.4);
    }
  }
  // ---------------- zufällige Ereignisse: Gläser, Stimmen, Ausrufer ----------------
  events(dt, p, rd, rn, night, dens) {
    const G = this.G, N = this.nextT; for (const k in N) N[k] -= dt;
    // Gesprächsfetzen von Leuten in der Nähe
    if (N.voice <= 0 && this.buf.voices && this.sprites.voices) {
      N.voice = 5 + Math.random() * (dens > 0.4 ? 7 : 14);
      const A = G.crowd?.a; let who = null;
      if (A) { const cand = []; for (const o of A) { if (o.state === 'static') continue; const dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz; if (d2 > 6 && d2 < 144) cand.push(o); } if (cand.length) who = cand[Math.floor(Math.random() * cand.length)]; }
      if (who) { const list = this.sprites.voices; let i, n = 0; do { i = Math.floor(Math.random() * list.length); } while (this.lastVoices.includes(i) && n++ < 10);
        this.lastVoices.push(i); if (this.lastVoices.length > 6) this.lastVoices.shift();
        this.spot('voices', i, who.x, 1.6, who.z, 0.55 + Math.random() * 0.25, 0.94 + Math.random() * 0.12, 2.5, 0.12); }
    }
    if (N.giggle <= 0 && this.buf.giggle) { N.giggle = 35 + Math.random() * 50; if (dens > 0.3) { const a = Math.random() * 6.28; this.spot('giggle', 0, p.x + Math.cos(a) * 7, 1.5, p.z + Math.sin(a) * 7, 0.35, 0.95 + Math.random() * 0.1, 3, 0.1); } }
    // Schreie von den wilden Fahrgeschäften, solange sie laufen
    if (N.scream <= 0) { N.scream = 2.5 + Math.random() * 5; if (this.thrill > 0.12 && this.thrillPos) this.scream(this.thrillPos); }
    // Gläser und Geschirr an Restaurants und Bierbuden
    let bar = null, bd = 1e9; for (const s of G.stalls || []) { if (s.type !== 'beier' && s.type !== 'bar') continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; bar = s; } }
    const nearDrink = Math.min(rd, bd);
    if (N.glass <= 0 && this.buf.glass) {
      N.glass = (nearDrink < 30 ? 1.3 : 3.5) + Math.random() * (nearDrink < 30 ? 3 : 6) / (0.7 + night * 0.6);
      const src = rd < bd ? rn : bar; if (src && nearDrink < 45) {
        const n = Math.random() < 0.35 ? 2 : 1;   // manchmal stößt man an: zwei Gläser kurz nacheinander
        for (let k = 0; k < n; k++) this.spot('glass', null, src.x + (Math.random() - 0.5) * 10, 1.1, src.z + (Math.random() - 0.5) * 6, 0.5 + Math.random() * 0.4, 0.9 + Math.random() * 0.25, 2, 0.1, k * (0.06 + Math.random() * 0.05)); }
    }
    if (N.dish <= 0 && this.buf.dishes) { N.dish = 4 + Math.random() * 8; if (rn && rd < 30) this.spot('dishes', null, rn.x + (Math.random() - 0.5) * 10, 1, rn.z, 0.35 + Math.random() * 0.3, 0.9 + Math.random() * 0.2, 2.5, 0.08); }
    // Ausrufer an den Spielbuden, Luftgewehr an der Schéissbud
    let game = null, gd = 1e9; for (const s of G.stalls || []) { if (!s.T.game) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < gd) { gd = d; game = s; } }
    if (N.barker <= 0) { N.barker = 45 + Math.random() * 60; if (game && gd < 28 && gd > 3) this.spot(Math.random() < 0.5 ? 'barker1' : 'barker2', -1, game.x, 2.2, game.z, 0.8, 1, 4, 0.15); }
    if (N.shot <= 0 && this.buf.shot) { N.shot = 1.5 + Math.random() * 6; for (const s of G.stalls || []) { if (s.type !== 'schéiss') continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 30 && d > 2.5) { const n = 1 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) this.spot('shot', null, s.x, 1.3, s.z, 0.45, 0.95 + Math.random() * 0.1, 2, 0.05, k * (0.5 + Math.random() * 0.6)); break; } } }
  }
  /** Spielt eine Aufnahme (oder einen Sprite-Abschnitt) einmalig an einer Weltposition. i = Sprite-Index, null = zufällig, -1 = ganze Datei */
  spot(key, i, x, y, z, vol = 0.6, rate = 1, ref = 3, verb = 0.1, delay = 0) {
    const b = this.buf[key]; if (!b || this.muted) return; const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol; const pn = this.panner(ref, 1.2); pn.positionX ? (pn.positionX.value = x, pn.positionY.value = y, pn.positionZ.value = z) : pn.setPosition(x, y, z);
    s.connect(g).connect(pn).connect(this.ambBus); if (verb) { const sg = c.createGain(); sg.gain.value = verb; g.connect(sg).connect(this.verb); }
    const sp = this.sprites[key];
    if (sp && i !== -1) { const [off, dur] = sp[i == null ? Math.floor(Math.random() * sp.length) : i]; s.start(t, Math.max(0, off - 0.02), dur + 0.06); }
    else s.start(t);
    s.onended = () => { s.disconnect(); g.disconnect(); pn.disconnect(); };
  }
  /** Feuerwerk-Aufnahme als Teppich unter den synchronen Knallern (nur am letzten Tag) */
  fireworksBed(on) {
    if (!this.ok) return;
    if (on && !this.fwSrc) {
      const play = () => { if (this.fwSrc || !this.buf.fireworks) return; const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.buf.fireworks; s.loop = true; const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.5, c.currentTime, 2); s.connect(g).connect(this.ambBus); s.start(); this.fwSrc = { s, g }; };
      if (this.buf.fireworks) play(); else if (!this._fwLoading) { this._fwLoading = true; fetch(BASE + 'fireworks.mp3').then(r => r.arrayBuffer()).then(ab => this.ctx.decodeAudioData(ab)).then(b => { this.buf.fireworks = b; if (this.fwWanted) play(); }).catch(() => {}); }
    } else if (!on && this.fwSrc) { const { s, g } = this.fwSrc; g.gain.setTargetAtTime(0, this.ctx.currentTime, 1.5); setTimeout(() => s.stop(), 6000); this.fwSrc = null; }
    this.fwWanted = on;
  }
  // ---------------- Sequenzer (Blosmusek + Ersatzmusik) ----------------
  schedule() {
    const c = this.ctx; const ahead = c.currentTime + 0.25;
    for (const [k, z] of Object.entries(this.zones)) {
      const spb = 60 / z.bpm / 2; // Achtel
      if (z.g.gain.value < 0.001 && z.next < c.currentTime) { z.next = c.currentTime + 0.05; continue; }   // stumme Zonen kosten nichts
      while (z.next < ahead) { this.play(k, z, z.step, z.next, spb); z.next += spb; z.step++; }
    }
  }
  play(k, z, s, t, spb) {
    const out = z.g;
    if (k === 'techno') {
      const bar = Math.floor(s / 8) % 4; const prog = [0, 0, 5, 3][bar]; const root = 45 + prog;
      if (s % 2 === 0) this.kick(out, t);
      if (s % 2 === 1) this.hat(out, t, 0.25);
      if (s % 8 === 4) this.snare(out, t);
      this.tone(out, 'sawtooth', this.f(root - 12 + (s % 2 ? 12 : 0)), t, spb * 0.8, 0.12, 900);
      if ([0, 3, 6].includes(s % 8)) this.tone(out, 'square', this.f(root + 12 + [0, 7, 12, 15][s % 4]), t, spb * 0.6, 0.05, 2500);
    } else if (k === 'orgel') { // Walzer 3/4
      const beat = s % 6; const bar = Math.floor(s / 6) % 4; const root = [57, 62, 64, 57][bar];
      if (beat === 0) this.tone(out, 'triangle', this.f(root - 24), t, spb * 1.6, 0.25);
      if (beat === 2 || beat === 4) for (const iv of [0, 4, 7]) this.tone(out, 'square', this.f(root + iv), t, spb * 0.9, 0.04, 1800);
      const mel = [76, 74, 72, 74, 76, 76, 76, 74, 74, 76, 79, 79]; if (s % 2 === 0) this.tone(out, 'sine', this.f(mel[(s / 2) % mel.length]), t, spb * 1.6, 0.09);
    } else if (k === 'blos') { // Oompah-Marsch
      const beat = s % 4; const bar = Math.floor(s / 8) % 4; const root = [53, 48, 53, 48][bar];
      if (beat === 0) this.tone(out, 'sawtooth', this.f(root - 12), t, spb * 0.9, 0.22, 600);
      if (beat === 2) for (const iv of [4, 7, 12]) this.tone(out, 'sawtooth', this.f(root + iv), t, spb * 0.6, 0.06, 1400);
      const mel = [65, 67, 69, 70, 72, 72, 72, 70, 69, 70, 72, 69, 67, 65, 67, 69]; if (s % 2 === 0) this.tone(out, 'sawtooth', this.f(mel[(s / 2) % mel.length] + 12), t, spb * 1.7, 0.07, 2200);
      if (beat === 0) this.kick(out, t, 0.5);
    }
  }
  // ---------------- prozedurale Effekte ----------------
  f(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  tone(out, type, freq, t, dur, vol, lp) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.value = freq; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f).connect(g); } else o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  kick(out, t, v = 0.9) { const c = this.ctx; const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(out); o.start(t); o.stop(t + 0.3); }
  hat(out, t, v = 0.2) { this.noiseHit(out, t, 0.04, v, 'highpass', 7000); }
  snare(out, t) { this.noiseHit(out, t, 0.15, 0.4, 'bandpass', 1800); }
  noiseHit(out, t, dur, v, type, freq, q = 1) { const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  // ---------------- Effekte ----------------
  now() { return this.ctx.currentTime; }
  sfx(fn) { if (!this.ok || this.muted) return; fn(this.now(), this.master); }
  kaching() { this.sfx((t, o) => { this.tone(o, 'square', 1318, t, 0.08, 0.12, 4000); this.tone(o, 'square', 1760, t + 0.07, 0.25, 0.12, 4000); this.noiseHit(o, t, 0.05, 0.15, 'highpass', 5000); }); }
  coin() { this.sfx((t, o) => { [988, 1319, 1568, 1976].forEach((f, i) => this.tone(o, 'triangle', f, t + i * 0.07, 0.2, 0.15)); }); }
  eat() { this.sfx((t, o) => { for (let i = 0; i < 4; i++) this.noiseHit(o, t + i * 0.13, 0.07, 0.35, 'bandpass', 2500 + Math.random() * 1500, 2); }); }
  drink() { this.sfx((t, o) => { for (let i = 0; i < 5; i++) this.tone(o, 'sine', 300 + i * 40 + Math.random() * 50, t + i * 0.12, 0.1, 0.15); }); }
  bump(v = 0.6) { this.sfx((t, o) => { this.kick(o, t, v * 0.8); this.noiseHit(o, t, 0.12, v * 0.4, 'lowpass', 900); }); }
  click() { this.sfx((t, o) => this.noiseHit(o, t, 0.02, 0.4, 'highpass', 3000)); }
  horn() { this.sfx((t, o) => { this.tone(o, 'sawtooth', 220, t, 0.7, 0.18, 1500); this.tone(o, 'sawtooth', 277, t, 0.7, 0.14, 1500); }); }
  whoosh() { this.sfx((t, o) => { const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6); const g = c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8); s.connect(f).connect(g).connect(o); s.start(t); s.stop(t + 0.9); }); }
  scream(pos) { if (this.buf.scream && pos) { const n = 2 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) this.spot('scream', null, pos.x + (Math.random() - 0.5) * 6, 4, pos.z + (Math.random() - 0.5) * 6, 0.3 + Math.random() * 0.2, 0.95 + Math.random() * 0.25, 6, 0.15, k * (0.15 + Math.random() * 0.4)); return; } this.sfx((t, o) => { const c = this.ctx; const p = this.G.player.pos; const d = pos ? Math.hypot(pos.x - p.x, pos.z - p.z) : 10; const vol = Math.max(0.03, 0.4 * (1 - d / 120)); for (let k = 0; k < 4; k++) { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; const st = t + k * 0.05; f.frequency.setValueAtTime(900 + k * 300, st); f.frequency.linearRampToValueAtTime(1600 + k * 200, st + 0.4); f.frequency.linearRampToValueAtTime(700, st + 1.4); const g = c.createGain(); g.gain.setValueAtTime(0.001, st); g.gain.linearRampToValueAtTime(vol, st + 0.1); g.gain.exponentialRampToValueAtTime(0.001, st + 1.5); s.connect(f).connect(g).connect(o); s.start(st, Math.random()); s.stop(st + 1.6); } }); }
  boo() { this.sfx((t, o) => { this.tone(o, 'sawtooth', 90, t, 0.9, 0.3, 500); this.noiseHit(o, t, 0.6, 0.35, 'lowpass', 400); }); }
  bell() { this.sfx((t, o) => { [1, 2.76, 5.4].forEach((m, i) => this.tone(o, 'sine', 880 * m, t, 2.2 / (i + 1), 0.25 / (i + 1))); }); }
  shot() { this.sfx((t, o) => this.noiseHit(o, t, 0.12, 0.6, 'lowpass', 2500)); }
  pop() { this.sfx((t, o) => this.tone(o, 'square', 660, t, 0.08, 0.12, 3000)); }
  shutter() { this.sfx((t, o) => { this.noiseHit(o, t, 0.03, 0.5, 'highpass', 4000); this.noiseHit(o, t + 0.08, 0.03, 0.4, 'highpass', 3000); }); }
  fanfare() { this.sfx((t, o) => { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, d]) => this.tone(o, 'square', f, t + d, d === 0.36 ? 0.6 : 0.14, 0.09, 3000)); }); }
  boom(dist) { this.sfx((t, o) => { const delay = dist / 343; const v = Math.max(0.15, 0.9 - dist / 900); this.kick(o, t + delay, v); this.noiseHit(o, t + delay, 1.2, v * 0.4, 'lowpass', 300); }); }
}
