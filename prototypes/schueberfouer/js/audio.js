// Prozeduraler Sound (WebAudio): Menge, Kirmes-Musik in Zonen, Blosmusek, Effekte
import { L } from './data.js';

export class Audio {
  constructor(G) { this.G = G; this.ok = false; this.muted = false; this.paradeOn = false; }
  start() {
    if (this.ok) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx; this.ok = true;
    this.out = c.createGain(); this.out.connect(c.destination); this.musicBus = c.createGain(); this.sfxBus = c.createGain(); this.ambBus = c.createGain();
    for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.out); this.master = this.sfxBus; this.setVolumes(this.G.settings);
    // Rauschen-Puffer
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate); const d = this.noise.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.15; }
    // Menschenmenge
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6; this.crowdG = c.createGain(); this.crowdG.gain.value = 0.0;
    src.connect(bp).connect(this.crowdG).connect(this.ambBus); src.start();
    // Musikzonen: Techno (Break Dance / Coaster), Orgel (Karussell), Blosmusek (Parade)
    this.zones = {
      techno: { g: c.createGain(), pos: ['breakdance', 'coaster', 'autoscooter'], bpm: 128 },
      orgel: { g: c.createGain(), pos: ['carousel', 'riesenrad'], bpm: 150 },
      blos: { g: c.createGain(), pos: [], bpm: 112 },
    };
    for (const z of Object.values(this.zones)) { z.g.gain.value = 0; z.g.connect(this.musicBus); z.next = c.currentTime + 0.1; z.step = 0; }
    this.rideMusic = true;
    setInterval(() => this.schedule(), 60);
    this.loop();
  }
  mute(m) { this.muted = m; this.setVolumes(this.G.settings); }
  setVolumes(S) { if (!this.out) return; this.out.gain.value = this.muted ? 0 : S.vMaster; this.musicBus.gain.value = S.vMusic; this.sfxBus.gain.value = S.vSfx; this.ambBus.gain.value = S.vAmb; }
  toggleRideMusic() { this.rideMusic = !this.rideMusic; }
  parade(on) { this.paradeOn = on; }
  loop() {
    if (!this.ok) return; const G = this.G; const p = G.player?.pos; if (p) {
      const loc = p; const night = G.night ?? 1;
      const inFair = G.crowd ? Math.max(0, 1 - Math.min(...G.crowd.nodes.slice(0, 60).map(n => Math.hypot(n.x - loc.x, n.z - loc.z))) / 80) : 0.5;
      this.crowdG.gain.setTargetAtTime(0.05 + inFair * 0.22, this.ctx.currentTime, 0.3);
      for (const [k, z] of Object.entries(this.zones)) {
        let dmin = 1e9; if (k === 'blos') { if (this.paradeOn && this.paradePos) dmin = Math.hypot(this.paradePos.x - loc.x, this.paradePos.z - loc.z); }
        else for (const id of z.pos) { const r = G.rides?.[id]; if (!r) continue; const w = L(r.cfg.u, r.cfg.v); dmin = Math.min(dmin, Math.hypot(w.x - loc.x, w.z - loc.z)); }
        let v = Math.max(0, 1 - dmin / (k === 'blos' ? 60 : 70)); v = v * v * (k === 'techno' && !this.rideMusic ? 0.2 : 1);
        if (G.player.mode === 'operator' && k === 'techno') v = this.rideMusic ? 0.8 : 0.1;
        z.g.gain.setTargetAtTime(v * (k === 'blos' ? 0.5 : 0.32), this.ctx.currentTime, 0.4);
      }
    }
    setTimeout(() => this.loop(), 200);
  }
  // ---------------- Sequenzer ----------------
  schedule() {
    const c = this.ctx; const ahead = c.currentTime + 0.25;
    for (const [k, z] of Object.entries(this.zones)) {
      const spb = 60 / z.bpm / 2; // Achtel
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
  scream(pos) { this.sfx((t, o) => { const c = this.ctx; const p = this.G.player.pos; const d = pos ? Math.hypot(pos.x - p.x, pos.z - p.z) : 10; const vol = Math.max(0.03, 0.4 * (1 - d / 120)); for (let k = 0; k < 4; k++) { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; const st = t + k * 0.05; f.frequency.setValueAtTime(900 + k * 300, st); f.frequency.linearRampToValueAtTime(1600 + k * 200, st + 0.4); f.frequency.linearRampToValueAtTime(700, st + 1.4); const g = c.createGain(); g.gain.setValueAtTime(0.001, st); g.gain.linearRampToValueAtTime(vol, st + 0.1); g.gain.exponentialRampToValueAtTime(0.001, st + 1.5); s.connect(f).connect(g).connect(o); s.start(st, Math.random()); s.stop(st + 1.6); } }); }
  boo() { this.sfx((t, o) => { this.tone(o, 'sawtooth', 90, t, 0.9, 0.3, 500); this.noiseHit(o, t, 0.6, 0.35, 'lowpass', 400); }); }
  bell() { this.sfx((t, o) => { [1, 2.76, 5.4].forEach((m, i) => this.tone(o, 'sine', 880 * m, t, 2.2 / (i + 1), 0.25 / (i + 1))); }); }
  shot() { this.sfx((t, o) => this.noiseHit(o, t, 0.12, 0.6, 'lowpass', 2500)); }
  pop() { this.sfx((t, o) => this.tone(o, 'square', 660, t, 0.08, 0.12, 3000)); }
  shutter() { this.sfx((t, o) => { this.noiseHit(o, t, 0.03, 0.5, 'highpass', 4000); this.noiseHit(o, t + 0.08, 0.03, 0.4, 'highpass', 3000); }); }
  fanfare() { this.sfx((t, o) => { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, d]) => this.tone(o, 'square', f, t + d, d === 0.36 ? 0.6 : 0.14, 0.09, 3000)); }); }
  boom(dist) { this.sfx((t, o) => { const delay = dist / 343; const v = Math.max(0.15, 0.9 - dist / 900); this.kick(o, t + delay, v); this.noiseHit(o, t + delay, 1.2, v * 0.4, 'lowpass', 300); }); }
}
