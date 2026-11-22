// Benutzeroberfläche: Startmenü, HUD, Minikarte, Menüs, Mini-Spiele, Touch-Steuerung
import { FOOD, DRINKS, CLOTHES, SOUVENIRS, DAYS, GLACIS_POLY, ROADS, TRAM, RIDES, ENTRANCES, L, toLocal, RESTAURANTS, TIME } from './data.js';
import { euro, clamp, R, pick, keyText } from './util.js';
import { MISSIONS, EGGS } from './game.js';
import { Menu } from './menu.js';
import { KEY_LABELS } from './settings.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const ITEM = id => FOOD[id] || DRINKS[id] || CLOTHES[id] || SOUVENIRS[id];

export class UI {
  constructor(G) {
    this.G = G; this.root = $('#ui'); this.modal = null; this.started = false; this.menuOpen = false;
    this.root.innerHTML = `
      <div id="loading"><div class="logo">SCHUEBERFOUER<span>2026</span></div><div class="bar"><i></i></div><p></p></div>
      <div id="hud" class="hidden">
        <div id="clock"><b></b><span></span></div>
        <div id="wallet"><div>Portmonni <b>∞ €</b></div><small>Ausgi: <span id="spent">0,00 €</span></small></div>
        <div id="stats"></div>
        <canvas id="minimap" width="200" height="200"></canvas>
        <div id="mission"></div>
        <div id="prompt"></div>
        <div id="rideHud"></div>
        <div id="guideDist"></div>
        <div id="toasts"></div>
        <div id="keys"></div><div id="fps"></div>
      </div>
      <div id="touch" class="hidden"><div id="stick"><i></i></div><button data-k="E" class="big">E</button><button data-k="Q">🧭</button><button data-k="Space">⤒</button><button data-k="V">👁</button><button data-k="M">🗺</button><button data-k="P">📷</button><button data-k="J">★</button><button data-k="Escape">☰</button></div>
      <div id="fade"></div><div id="flash"></div>
      <div id="overlay" class="hidden"></div>`;
    this.el = { hud: $('#hud'), clock: $('#clock'), spent: $('#spent'), stats: $('#stats'), mini: $('#minimap'), mission: $('#mission'), prompt: $('#prompt'), rideHud: $('#rideHud'), toasts: $('#toasts'), overlay: $('#overlay'), fade: $('#fade'), guide: $('#guideDist') };
    this.mctx = this.el.mini.getContext('2d');
    G.canLock = () => this.started && !this.modal && !this.menuOpen && !G.isMobile && G.player?.mode !== 'operator';
    this.menuCam = null;
    this.setupTouch(); this.menu = new Menu(this);
  }
  applyHud() {
    const S = this.G.settings, K = S.keys, n = c => c.replace(/^Key/, '').replace('ShiftLeft', 'Shift').replace('Space', 'Space');
    $('#minimap').style.display = S.hudMini ? '' : 'none'; this.el.mission.style.display = S.hudMission ? '' : 'none'; $('#keys').style.display = S.hudKeys && !this.G.isMobile ? '' : 'none'; $('#fps').style.display = S.showFps ? '' : 'none';
    $('#keys').innerHTML = [[K.act, 'Aktioun'], [K.compass, 'Kompass'], [K.map, 'Kaart'], [K.journal, 'Missiounen'], [K.wardrobe, 'Garderob'], [K.view, 'Kamera'], [K.photo, 'Foto'], ['Esc', 'Menü']].map(([k, l]) => `<span><kbd>${n(k)}</kbd>${l}</span>`).join('');
  }
  loading(p, t) { const l = $('#loading'); if (!l) return; $('.bar i', l).style.width = (p * 100) + '%'; $('p', l).textContent = t; if (p >= 1) setTimeout(() => l.classList.add('gone'), 300); }
  ready() { this.menu.title(); }
  paused() { return !this.started || this.menuOpen; }
  blockInput() { return !!this.modal || this.menuOpen; }

  // ---------------- Startmenü ----------------
  startMenu() {
    const G = this.G; let day = 0;
    const o = this.open(`<div class="start">
      <div class="logo big">SCHUEBERFOUER<span>2026</span></div>
      <p class="sub">Glacis · Stad Lëtzebuerg · 21.08. – 09.09.2026 · zënter 1340</p>
      <div class="days">${DAYS.map((d, i) => `<button class="day ${i === 0 ? 'on' : ''}" data-i="${i}">${d.label}</button>`).join('')}</div>
      <div class="ctrl"><div><b>PC</b> WASD lafen · Shift sprinten · Maus kucken · Space sprangen · <b>E</b> alles benotzen · <b>Q</b> Fouer-Kompass (féiert dech bei Iessen, Drénken, Attraktiounen …) · M Kaart · J Missiounen · I Garderob · V 1./3. Persoun · P Foto · T Zäit · Esc Menü</div>
      <div><b>Handy</b> lénks Joystick · riets wëschen fir ze kucken · Knäppercher fir Aktiounen</div></div>
      <div class="q">Qualitéit: ${['low', 'mid', 'high'].map(q => `<button class="ql ${G.quality === q ? 'on' : ''}" data-q="${q}">${{ low: 'Niddreg', mid: 'Mëttel', high: 'Héich' }[q]}</button>`).join('')}</div>
      <button class="play">▶ SPILLEN</button>
      <p class="tiny">Portmonni: ∞ € – du hues onendlech vill Suen. Gutt Fouer!</p></div>`, { noClose: true, cls: 'startbox' });
    o.querySelectorAll('.day').forEach(b => b.onclick = () => { day = +b.dataset.i; o.querySelectorAll('.day').forEach(x => x.classList.toggle('on', x === b)); });
    o.querySelectorAll('.ql').forEach(b => b.onclick = () => { const u = new URL(location.href); u.searchParams.set('q', b.dataset.q); location.href = u; });
    $('.play', o).onclick = () => {
      G.day = DAYS[day]; G.minutes = TIME.start; if (G.day.id === 'last') G.minutes = 21 * 60 + 40; if (G.day.id === 'open') G.minutes = 20 * 60 + 55;
      this.closeAll(); this.started = true; G.running = true; this.el.hud.classList.remove('hidden'); if (G.isMobile) $('#touch').classList.remove('hidden');
      G.audio.start(); G.game.applyOutfit(); this.refreshMission();
      this.toast('Wëllkomm op der Schueberfouer 2026!', `${G.day.date} – Haaptentrée E1, Rond-Point Robert Schuman`);
      setTimeout(() => this.toast('Tipp: Dréck [Q]', 'De Fouer-Kompass weist dir de Wee – zum Beispill bei déi nächst Gromperekichelcher.'), 4500);
      if (!G.isMobile) G.renderer.domElement.requestPointerLock?.();
    };
  }
  // ---------------- Overlays ----------------
  open(html, { noClose = false, cls = '' } = {}) {
    document.exitPointerLock?.();
    const ov = this.el.overlay; ov.className = ''; ov.innerHTML = `<div class="panel ${cls}">${noClose ? '' : '<button class="x">✕</button>'}${html}</div>`; this.modal = ov;
    const x = $('.x', ov); if (x) x.onclick = () => this.closeAll(); return $('.panel', ov);
  }
  closeAll() { document.body.classList.remove('menu-open'); this.el.overlay.className = 'hidden'; this.el.overlay.innerHTML = ''; this.modal = null; this.menuOpen = false; this.mini = null; if (this.onClose) { const f = this.onClose; this.onClose = null; f(); } }
  fade(cb) { const f = this.el.fade; f.classList.add('on'); setTimeout(() => { cb(); setTimeout(() => f.classList.remove('on'), 250); }, 380); }
  toast(t, s = '') { const e = h('div', 'toast', `<b>${keyText(t)}</b><span>${keyText(s)}</span>`); this.el.toasts.prepend(e); setTimeout(() => e.classList.add('out'), 4200); setTimeout(() => e.remove(), 4800); while (this.el.toasts.children.length > 4) this.el.toasts.lastChild.remove(); }
  achievement(t, s) { const e = h('div', 'ach', `<div class="medal">★</div><div><b>${t}</b><span>${s}</span></div>`); document.body.appendChild(e); setTimeout(() => e.classList.add('out'), 5000); setTimeout(() => e.remove(), 5800); }
  money(a, what) { const e = h('div', 'money', `−${euro(a)}`); this.el.hud.appendChild(e); setTimeout(() => e.remove(), 1500); }
  prompt(text) { const p = this.el.prompt; if (!text || !this.G.settings.hudPrompt) { p.classList.remove('on'); return; } p.innerHTML = `<kbd>${this.G.isMobile ? 'E' : 'E'}</kbd> ${text}`; p.classList.add('on'); }
  dialog(name, text, opts) {
    const o = this.open(`<div class="dlg"><h3>${name}</h3><p>${text}</p><div class="opts">${opts.map((x, i) => `<button data-i="${i}">${x.t}</button>`).join('')}</div></div>`, { cls: 'dialog' });
    o.querySelectorAll('.opts button').forEach(b => b.onclick = () => { this.closeAll(); opts[+b.dataset.i].f(); });
  }

  // ---------------- Shop ----------------
  openShop(stall) {
    const G = this.G; const items = stall.T.items;
    const o = this.open(`<h2>${stall.T.sign}</h2><p class="sub">Wat däerf et sinn? Bezuelt gëtt mam onendleche Portmonni.</p>
      <div class="items">${items.map(id => { const it = ITEM(id); const owned = G.game.owned.has(id); const eq = Object.values(G.game.equipped).includes(id);
        return `<button class="item" data-id="${id}"><span class="ic">${it.icon}</span><span class="nm">${it.name}${CLOTHES[id] ? `<small>${owned ? (eq ? 'ugedoen ✓' : 'kaaft – undoen') : 'Kleedung · ' + { head: 'Kapp', eyes: 'Aen', top: 'Uewendeel', neck: 'Hals' }[CLOTHES[id].slot]}</small>` : FOOD[id] ? `<small>Honger +${it.hunger}</small>` : DRINKS[id] ? `<small>Duuscht +${it.thirst}${it.alcohol ? ' · Alkohol' : ''}</small>` : ''}</span><span class="pr">${owned ? '' : euro(G.game.price(it.price, 'food'))}</span></button>`; }).join('')}</div>`, { cls: 'shop' });
    o.querySelectorAll('.item').forEach(b => b.onclick = () => { G.game.buy(b.dataset.id, stall); if (CLOTHES[b.dataset.id]) this.openShop(stall); else { b.classList.add('bought'); setTimeout(() => b.classList.remove('bought'), 400); } });
  }
  openRide(ride) {
    const G = this.G; const c = ride.cfg; const pr = G.game.price(ride.price, 'ride'); const done = G.game.ridden.has(ride.id);
    const o = this.open(`<h2>${ride.name}</h2>${c.plan ? `<p class="sub">Nr. ${c.plan} um offizielle Plang</p>` : ''}<p>${c.desc || 'Eng vun de Klassiker op der Schueberfouer.'}</p>
      <div class="thrill">Adrenalin ${'🔥'.repeat(c.thrill ?? 2)}${'·'.repeat(5 - (c.thrill ?? 2))}</div>
      <div class="opts"><button class="go">🎟️ Fueren – ${G.game.freeTickets ? 'Gratis-Ticket' : euro(pr)}</button>${c.type === 'breakdance' ? '<button class="op">🎛️ Als Operateur bedéngen</button>' : ''}${done ? '<small>✓ schonn gefuer</small>' : ''}</div>`, { cls: 'ride' });
    $('.go', o).onclick = () => G.game.startRide(ride); const op = $('.op', o); if (op) op.onclick = () => G.game.startRide(ride, true);
  }
  rideHud(ride) { this.curRide = ride; this.el.rideHud.classList.toggle('on', !!ride); if (ride) this.el.rideHud.innerHTML = `<b>${ride.name}</b><span id="rideInfo">${keyText((ride.cfg.type === 'scooter' ? 'WASD fueren – bomp se all!' : 'Genéiss d\'Fahrt! [V] Kamera · Maus kucken') + (ride.cfg.type === 'ferris' ? ' · uewen [P] Foto!' : ''))}</span>`; }
  rideInfo(t) { const e = $('#rideInfo'); if (e) e.textContent = keyText(t); }

  // ---------------- Mini-Spiele ----------------
  openGame(kind, stall) {
    const G = this.G; G.game.pay(G.game.price(stall.T.price, 'game'), stall.T.sign);
    if (kind === 'shooting') return this.shooting();
    if (kind === 'lukas') return this.lukas();
    if (kind === 'lous') return this.lous();
  }
  shooting() {
    const G = this.G; const o = this.open(`<h2>Schéissbud</h2><canvas id="mg" width="900" height="500"></canvas><p class="sub" id="mgs">10 Schëss · Klick op d'Ziler!</p>`, { cls: 'mini' });
    const cv = $('#mg', o), g = cv.getContext('2d'); let shots = 10, hits = 0, mx = 450, my = 250, flash = 0, over = false; const targets = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) targets.push({ row: r, x: i * 170 + r * 60, y: 120 + r * 120, sp: (r % 2 ? -1 : 1) * (90 + r * 40), kind: pick(['sheep', 'duck', 'star']), hit: 0 });
    const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * 900, (e.clientY - b.top) / b.height * 500]; };
    cv.onmousemove = e => [mx, my] = pos(e); cv.ontouchstart = e => { const t = e.touches[0]; [mx, my] = pos(t); shoot(); e.preventDefault(); };
    const shoot = () => { if (over || shots <= 0) return; shots--; flash = 0.12; G.audio.shot(); for (const t of targets) if (!t.hit && Math.hypot(t.x - mx, t.y - my) < 34) { t.hit = 1; hits++; G.audio.pop(); break; }
      $('#mgs', o).textContent = `${shots} Schëss · ${hits} Treffer`; if (shots === 0) { over = true; setTimeout(end, 700); } };
    cv.onmousedown = shoot;
    const end = () => { G.game.check('shoot', hits); const win = hits >= 7; this.dialog('Schéissbud', win ? `Bravo! ${hits} Treffer – du gewënns e Lämmy-Plüschschof! 🐑` : `${hits} Treffer. Fir de Plüschschof brauchs de 7. Nach eng Kéier?`, [{ t: 'Nach eng Kéier', f: () => this.openGame('shooting', { T: { price: 5, sign: 'Schéissbud' } }) }, { t: 'Merci', f: () => { } }]); };
    let last = performance.now();
    const loop = () => { if (!this.modal || !$('#mg')) return; const now = performance.now(), dt = (now - last) / 1000; last = now;
      const gr = g.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#3b1d0e'); gr.addColorStop(1, '#1a0b05'); g.fillStyle = gr; g.fillRect(0, 0, 900, 500);
      for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#c1121f' : '#fdf0d5'; g.fillRect(i * 50, 0, 50, 40); }
      for (let r = 0; r < 3; r++) { g.fillStyle = '#6b4226'; g.fillRect(0, 150 + r * 120, 900, 12); }
      for (const t of targets) { t.x += t.sp * dt; if (t.x > 960) t.x -= 1020; if (t.x < -60) t.x += 1020; if (t.hit) { t.hit += dt * 3; if (t.hit > 6) t.hit = 0; }
        g.save(); g.translate(t.x, t.y); if (t.hit) g.rotate(Math.min(1.5, t.hit)); g.globalAlpha = t.hit ? 0.4 : 1;
        if (t.kind === 'sheep') { g.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(-16 + k * 7, -4 + (k % 2) * 6, 13, 0, 7); g.fill(); } g.fillStyle = '#222'; g.beginPath(); g.arc(24, -6, 9, 0, 7); g.fill(); g.fillRect(-14, 10, 4, 14); g.fillRect(10, 10, 4, 14); }
        else if (t.kind === 'duck') { g.fillStyle = '#ffd60a'; g.beginPath(); g.ellipse(0, 4, 26, 15, 0, 0, 7); g.fill(); g.beginPath(); g.arc(18, -12, 11, 0, 7); g.fill(); g.fillStyle = '#fb5607'; g.fillRect(27, -13, 11, 5); }
        else { g.fillStyle = '#4cc9f0'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 12 : 28; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); }
        g.fillStyle = '#e63946'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.restore(); }
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 18, 0, 7); g.moveTo(mx - 28, my); g.lineTo(mx + 28, my); g.moveTo(mx, my - 28); g.lineTo(mx, my + 28); g.stroke();
      if (flash > 0) { flash -= dt; g.fillStyle = `rgba(255,240,200,${flash * 4})`; g.fillRect(0, 0, 900, 500); }
      requestAnimationFrame(loop); };
    loop();
  }
  lukas() {
    const G = this.G; const o = this.open(`<h2>Hau den Lukas</h2><canvas id="mg" width="420" height="520"></canvas><p class="sub">Klick (oder Space) wann de Balken ganz uewen ass!</p>`, { cls: 'mini' });
    const cv = $('#mg', o), g = cv.getContext('2d'); let t = 0, power = 0, state = 'aim', puck = 0, vy = 0, res = 0;
    const hit = () => { if (state !== 'aim') return; state = 'fly'; res = power; vy = res * 1.25; G.audio.bump(1); };
    cv.onmousedown = hit; cv.ontouchstart = e => { hit(); e.preventDefault(); }; this.spaceAction = hit;
    let last = performance.now();
    const loop = () => { if (!this.modal || !$('#mg')) { this.spaceAction = null; return; } const now = performance.now(), dt = (now - last) / 1000; last = now; t += dt;
      if (state === 'aim') power = (Math.sin(t * 3.4) * 0.5 + 0.5);
      if (state === 'fly') { puck += vy * dt * 1.8; vy -= dt * 1.5; if (puck >= 1) { puck = 1; state = 'done'; G.audio.bell(); G.game.check('lukas', 1); setTimeout(() => this.dialog('Hau den Lukas', '🔔 DING! Du bass de Staarkste vun der Fouer!', [{ t: 'Nach eng Kéier', f: () => this.openGame('lukas', { T: { price: 3, sign: 'Hau den Lukas' } }) }, { t: 'Super', f: () => { } }]), 900); } else if (vy < 0 && puck <= 0) { puck = 0; state = 'done'; setTimeout(() => this.dialog('Hau den Lukas', `${Math.round(res * 100)} % – bal! Probéier nach eng Kéier.`, [{ t: 'Nach eng Kéier', f: () => this.openGame('lukas', { T: { price: 3, sign: 'Hau den Lukas' } }) }, { t: 'Spéider', f: () => { } }]), 400); } }
      g.fillStyle = '#1b0f2e'; g.fillRect(0, 0, 420, 520); g.fillStyle = '#ffbe0b'; g.fillRect(190, 40, 40, 440);
      for (let i = 0; i <= 10; i++) { g.fillStyle = '#8338ec'; g.fillRect(232, 470 - i * 43, 20, 3); g.fillStyle = '#fff'; g.font = '14px Bungee, sans-serif'; g.fillText(['Mini', '', 'Schwaach', '', 'OK', '', 'Gutt', '', 'Staark', '', 'HELD'][i], 258, 475 - i * 43); }
      g.fillStyle = state === 'done' && puck >= 1 ? '#fff6a0' : '#d4af37'; g.beginPath(); g.arc(210, 30, 24, 0, 7); g.fill();
      g.fillStyle = '#e63946'; g.fillRect(180, 470 - puck * 430, 60, 16);
      g.fillStyle = '#333'; g.fillRect(40, 60, 40, 400); const pc = power > 0.92 ? '#06d6a0' : power > 0.7 ? '#ffd60a' : '#e63946'; g.fillStyle = pc; g.fillRect(44, 456 - power * 392, 32, power * 392); g.strokeStyle = '#06d6a0'; g.strokeRect(40, 60, 40, 32);
      requestAnimationFrame(loop); };
    loop();
  }
  lous() {
    const G = this.G; const prizes = ['🐑 Lämmy-Plüschschof', '🔑 Schlësselunhänger „Fouer 2026“', '🍬 Bonbon (Trouschtpräis)', '🎈 Ballon', '❤️ Liebkuchenhäerz', '🦄 Rieseneenhoorn'];
    const o = this.open(`<h2>Lousbud</h2><p class="sub">All Lous gewënnt! Wiel eent aus:</p><div class="lous">${[0, 1, 2].map(i => `<button data-i="${i}">🎫<small>Lous ${i + 1}</small></button>`).join('')}</div>`, { cls: 'mini' });
    o.querySelectorAll('.lous button').forEach(b => b.onclick = () => { const p = pick(prizes); G.audio.fanfare(); G.game.souvenirs.push(p); G.game.save(); this.dialog('Lousbud', `Gewonnen: <b>${p}</b>!`, [{ t: 'Nach e Lous', f: () => this.openGame('lous', { T: { price: 3, sign: 'Lousbud' } }) }, { t: 'Merci', f: () => { } }]); });
  }
  operatorPanel(ride, H) {
    const old = $('#opPanel'); if (old) old.remove(); if (!ride) return;
    const p = h('div', '', `<div class="opTop">BREAK DANCE – OPERATEUR</div><div class="opRow">
      <div class="lamp" id="lBars"></div><div class="lamp g" id="lRun"></div><div class="opInfo" id="opInfo">Bigelen zou → START → ~20 s → STOP</div></div>
      <div class="opRow btns"><button class="yb" data-a="bars">BIGELEN</button><button class="gb" data-a="start">START</button><button class="rb" data-a="stop">STOP</button><button class="bb" data-a="horn">HUPP</button><button class="bb" data-a="music">MUSEK</button><button class="xb" data-a="exit">ERAUS</button></div>`);
    p.id = 'opPanel'; document.body.appendChild(p); document.exitPointerLock?.();
    p.querySelectorAll('button').forEach(b => b.onclick = () => H[b.dataset.a]());
    const upd = () => { if (!document.body.contains(p)) return; $('#lBars', p).classList.toggle('on', !!ride.bars); $('#lRun', p).classList.toggle('on', !!ride.opRun); $('#opInfo', p).textContent = ride.opRun ? `Leeft … ${Math.floor(this.G.time - ride.runStart)} s · Rontwe: ${this.G.game.operated}/3` : `Rontwe: ${this.G.game.operated}/3 · ${ride.bars ? 'Bigelen zou ✓ – START!' : 'Éischt BIGELEN zoumaachen'}`; requestAnimationFrame(upd); };
    upd();
  }
  vrOverlay(on) { document.body.classList.toggle('vr', on); }

  // ---------------- Menüs ----------------
  journal() {
    const G = this.G; const g = G.game; const vis = MISSIONS.filter(m => !m.hidden || g.prog[m.id + ':seen'] || g.done.has(m.id));
    const o = this.open(`<h2>Missiounen</h2><div class="miss">${vis.map(m => `<div class="m ${g.done.has(m.id) ? 'done' : ''} ${g.active === m.id ? 'act' : ''}" data-id="${m.id}"><b>${g.done.has(m.id) ? '✅' : g.active === m.id ? '▶' : '○'} ${m.title}</b><p>${keyText(m.desc)}</p><ul>${m.steps.map((s, i) => `<li class="${g.prog[m.id + ':' + i] === true ? 'ok' : ''}">${s[2]}${g.prog[m.id + i] && g.prog[m.id + ':' + i] !== true ? ` (${g.prog[m.id + i]}/${s[1]})` : ''}</li>`).join('')}</ul><small>Belounung: ${m.reward}</small></div>`).join('')}</div>
      <h3>Easter Eggs (${g.eggs.size}/${Object.keys(EGGS).length})</h3><div class="eggs">${Object.entries(EGGS).map(([k, e]) => `<span class="${g.eggs.has(k) ? 'on' : ''}">${g.eggs.has(k) ? '🥚 ' + e.t : '🔒 ???'}</span>`).join('')}</div>
      <p class="sub">Klick op eng Missioun fir se ze verfollegen.</p>`, { cls: 'journal' });
    o.querySelectorAll('.m').forEach(e => e.onclick = () => { if (g.done.has(e.dataset.id)) return; g.active = e.dataset.id; g.save(); this.refreshMission(); this.closeAll(); this.toast('▶ Aktiv Missioun', MISSIONS.find(m => m.id === g.active).title); });
  }
  wardrobe() {
    const G = this.G; const g = G.game; const own = [...g.owned];
    const o = this.open(`<h2>Garderob & Täsch</h2><div class="items">${own.length ? own.map(id => `<button class="item ${Object.values(g.equipped).includes(id) ? 'eq' : ''}" data-id="${id}"><span class="ic">${CLOTHES[id].icon}</span><span class="nm">${CLOTHES[id].name}<small>${Object.values(g.equipped).includes(id) ? 'ugedoen – klick fir auszedoen' : 'klick fir unzedoen'}</small></span></button>`).join('') : '<p>Nach keng Kleeder. Kuck bei „Fouer-Mode“ oder „Hütt & Brëllen“ laanscht!</p>'}</div>
      <h3>An der Täsch</h3><p>${g.souvenirs.length ? g.souvenirs.map(s => SOUVENIRS[s] ? SOUVENIRS[s].icon + ' ' + SOUVENIRS[s].name : s).join(' · ') : 'eidel'}</p>
      <p class="sub">Fouerbichelcher (Gratis-Tickets): ${g.freeTickets} · Ausgi bis elo: ${euro(g.spent)}</p>`, { cls: 'shop' });
    o.querySelectorAll('.item').forEach(b => b.onclick = () => { g.equip(b.dataset.id); this.wardrobe(); });
  }
  compass() {
    const G = this.G; const g = G.game;
    const opts = [['food', '🍟', 'Honger'], ['drink', '🍺', 'Duuscht'], ['ride', '🎢', 'Attraktioun'], ['shop', '🛍️', 'Shopping'], ['game', '🎯', 'Spiller'], ['mission', '★', 'Missioun'], ['gate', '🚪', 'Haaptentrée'], ['off', '✕', 'Aus']];
    const o = this.open(`<div class="radial">${opts.map((x, i) => { const a = i / opts.length * Math.PI * 2 - Math.PI / 2; return `<button data-k="${x[0]}" style="left:${50 + Math.cos(a) * 38}%;top:${50 + Math.sin(a) * 38}%"><span>${x[1]}</span>${x[2]}</button>`; }).join('')}<div class="hub">🧭<small>Fouer-<br>Kompass</small></div></div>`, { cls: 'compass' });
    o.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; this.closeAll(); let t = null;
      if (k === 'off') { g.setGuide(null); return; }
      if (k === 'gate') { const w = L(104, 36); t = { x: w.x, z: w.z, name: 'Haaptentrée E1' }; }
      else if (k === 'mission') { const m = MISSIONS.find(m => m.id === g.active); if (m?.targetRide) { const r = G.rides[m.targetRide]; t = { x: r.boothPos.x, z: r.boothPos.z, name: r.name }; } else if (m?.target) t = g.findNearest(m.target); else if (m?.id === 'kand') t = { ...g.findInfo(), name: 'Info-Stand' }; }
      else if (k === 'ride') { const m = MISSIONS.find(m => m.id === g.active); const pool = Object.values(G.rides).filter(r => !g.ridden.has(r.id)); const r = pool.length ? pool.sort((a, b) => Math.hypot(a.boothPos.x - G.player.pos.x, a.boothPos.z - G.player.pos.z) - Math.hypot(b.boothPos.x - G.player.pos.x, b.boothPos.z - G.player.pos.z))[0] : null; t = r ? { x: r.boothPos.x, z: r.boothPos.z, name: r.name } : g.findNearest('ride'); }
      else t = g.findNearest(k);
      g.setGuide(t); });
  }
  map() {
    const G = this.G; const o = this.open(`<h2>Plang – Schueberfouer 2026</h2><canvas id="bigmap" width="1100" height="700"></canvas><p class="sub">Klick op d'Kaart: de Fouer-Kompass féiert dech dohin.</p>`, { cls: 'mapbox' });
    const cv = $('#bigmap', o), g = cv.getContext('2d'); const S = 1100 / 400, ox = 215, oz = 150; const X = x => (x + ox) * S * 0.98, Z = z => (z + oz) * S * 0.98 - 60;
    // Hintergrund
    g.fillStyle = '#1d2b1a'; g.fillRect(0, 0, 1100, 700);
    for (const b of G.buildings) { g.fillStyle = '#3a3f4a'; g.save(); g.translate(X(b.x), Z(b.z)); g.rotate(-b.ang); g.fillRect(-b.w * S / 2, -b.d * S / 2, b.w * S, b.d * S); g.restore(); }
    g.strokeStyle = '#5d6470'; g.lineCap = 'round'; for (const s of G.roadSegs) { g.lineWidth = s.w * S; g.beginPath(); g.moveTo(X(s.a[0]), Z(s.a[1])); g.lineTo(X(s.b[0]), Z(s.b[1])); g.stroke(); }
    g.strokeStyle = '#d7263d'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); TRAM.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#4a4458'; g.beginPath(); GLACIS_POLY.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.fill();
    g.fillStyle = '#e8e4da'; g.font = '12px Bungee, sans-serif';
    const lab = (t, x, z, c = '#fff', sz = 11) => { g.font = `${sz}px Bungee, sans-serif`; g.fillStyle = 'rgba(0,0,0,.6)'; const w = g.measureText(t).width; g.fillRect(X(x) - w / 2 - 3, Z(z) - sz, w + 6, sz + 5); g.fillStyle = c; g.textAlign = 'center'; g.fillText(t, X(x), Z(z)); };
    for (const r of Object.values(G.rides)) { const w = L(r.cfg.u, r.cfg.v); g.fillStyle = r.col || '#f77f00'; g.beginPath(); g.arc(X(w.x), Z(w.z), 6, 0, 7); g.fill(); lab(r.name, w.x, w.z - 5, '#ffd166', 9); }
    for (const rs of RESTAURANTS) { const w = L(rs.u, -36); g.fillStyle = '#7fd1b9'; g.fillRect(X(w.x) - 4, Z(w.z) - 4, 8, 8); }
    for (const e of ENTRANCES) { const w = L(e.u, e.v); lab(e.id, w.x, w.z, '#ffffff', 10); }
    for (const st of TRAM.stops) lab('🚋 ' + st.name, st.x, st.z + 8, '#ff8fa3', 10);
    lab('GRAND THÉÂTRE', 272, -95, '#fff', 10); lab('ALLÉE SCHEFFER', -60, -60, '#bbb', 9); lab('BD DE LA FOIRE', 20, 95, '#bbb', 9); lab('ROND-POINT SCHUMAN', 150, 20, '#bbb', 9); lab("RUE JEAN L'AVEUGLE", -190, -130, '#bbb', 9); lab('AV. DE LA FAÏENCERIE', -300, -60, '#bbb', 9); lab('PONT ROUGE →', 330, -75, '#ff6b6b', 9);
    const p = G.player.pos; g.fillStyle = '#00f5d4'; g.beginPath(); g.arc(X(p.x), Z(p.z), 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    cv.onclick = e => { const b = cv.getBoundingClientRect(); const mx = (e.clientX - b.left) / b.width * 1100, mz = (e.clientY - b.top) / b.height * 700; const x = mx / (S * 0.98) - ox, z = (mz + 60) / (S * 0.98) - oz; this.closeAll(); G.game.setGuide({ x, z, name: 'Kaartepunkt' }); };
  }
  pauseMenu() { this.menu.openPause('optiounen'); }
  pauseMenuOld() {
    const G = this.G; this.menuOpen = true;
    const o = this.open(`<h2>Paus</h2><div class="opts col">
      <button data-a="go">▶ Weiderspillen</button><button data-a="t">⏩ +1 Stonn (${this.clockStr()})</button><button data-a="night">🌙 Direkt 22:00</button><button data-a="day">☀️ Direkt 15:00</button>
      <button data-a="j">★ Missiounen</button><button data-a="snd">🔊 Toun: ${G.audio.muted ? 'aus' : 'un'}</button><button data-a="fps">FPS: ${Math.round(G.fps || 0)} · Qualitéit: ${G.quality}</button><button data-a="reset">🗑️ Spillstand zrécksetzen</button></div>`, { cls: 'pause' });
    this.menuOpen = true;
    o.querySelectorAll('button').forEach(b => b.onclick = () => { const a = b.dataset.a;
      if (a === 'go') return this.closeAll(); if (a === 't') { G.minutes += 60; this.pauseMenu(); } if (a === 'night') { G.minutes = Math.floor(G.minutes / 1440) * 1440 + 22 * 60; this.closeAll(); } if (a === 'day') { G.minutes = Math.floor(G.minutes / 1440) * 1440 + 15 * 60; this.closeAll(); }
      if (a === 'j') this.journal(); if (a === 'snd') { G.audio.mute(!G.audio.muted); this.pauseMenu(); } if (a === 'reset') G.game.reset(); });
  }
  onKey(e) {
    const G = this.G; if (this.menu.onKey(e)) return; if (!this.started) return;
    const K = G.settings.keys;
    if (e.code === 'Escape') { if (this.modal) this.closeAll(); else this.menu.openPause('kaart'); return; }
    if (e.code === 'Space' && this.spaceAction) { this.spaceAction(); return; }
    if (this.modal) { if ([K.map, K.journal, K.wardrobe, K.compass].includes(e.code)) this.closeAll(); else return; }
    if (e.code === K.map) this.menu.openPause('kaart'); if (e.code === K.journal) this.menu.openPause('missiounen'); if (e.code === K.wardrobe) this.menu.openPause('garderob'); if (e.code === K.compass) this.compass();
    if (e.code === K.photo) this.photo(); if (e.code === K.time) { G.minutes += 30; this.toast('⏩ +30 Minutten', this.clockStr()); }
  }
  photo() {
    const G = this.G; const top = G.player.ride?.id === 'riesenrad' && G.player.ride.atTop; document.body.classList.add('shot');
    G.wantShot = (url) => { document.body.classList.remove('shot'); const f = $('#flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 200); G.audio.shutter();
      G.emit('photo', { top }); G.game.stats.photos++; const o = this.open(`<h2>📷 Fouer-Foto</h2><img src="${url}" style="width:100%;border-radius:10px" alt="Foto vun der Schueberfouer"><p class="sub">${top ? 'Wat fir e Bléck iwwer d\'Stad! ' : ''}Rietsklick (oder laang drécken) op d'Bild → „Bild späicheren“.</p>`, { cls: 'mini' }); };
  }
  refreshMission() {
    const g = this.G.game; const m = MISSIONS.find(x => x.id === g.active);
    if (!m) { this.el.mission.innerHTML = `<b>★ All Missiounen</b><span>Kuck am Journal [J] no Easter Eggs!</span>`; return; }
    this.el.mission.innerHTML = `<b>★ ${m.title}</b>${m.steps.map((s, i) => `<span class="${g.prog[m.id + ':' + i] === true ? 'ok' : ''}">${g.prog[m.id + ':' + i] === true ? '✔' : '○'} ${s[2]}${m.id === 'haemmel' ? ` (${g.sheepFound.size}/7)` : m.id === 'profi' ? ` (${g.ridden.size}/10)` : m.id === 'operator' ? ` (${g.operated}/3)` : ''}</span>`).join('')}`;
  }
  clockStr() { const m = Math.floor(this.G.minutes) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

  // ---------------- HUD jedes Frame ----------------
  update(dt) {
    const G = this.G; if (!this.started) return;
    const m = Math.floor(G.minutes) % 1440; const closed = m >= 60 && m < 12 * 60;
    this.el.clock.innerHTML = `<b>${this.clockStr()}</b><span>${G.day.date}${closed ? ' · Fouer zou' : ''}</span>`;
    this.el.spent.textContent = euro(G.game.spent);
    const s = G.player.stats; this.el.stats.innerHTML = [['🍟', s.hunger, 'Honger'], ['🥤', s.thirst, 'Duuscht'], ['😄', s.fun, 'Spaass']].map(([i, v, t]) => `<div title="${t}"><span>${i}</span><i style="width:${v}%;background:${v < 25 ? '#e63946' : v < 50 ? '#ffd166' : '#06d6a0'}"></i></div>`).join('') + (s.promille > 0.3 ? `<div class="pr">🍺 ${s.promille.toFixed(1)} ‰</div>` : '');
    if (G.game.guide && G.game.guideDist && G.player.mode === 'walk') { this.el.guide.classList.add('on'); this.el.guide.textContent = `🧭 ${G.game.guide.name} · ${Math.round(G.game.guideDist)} m`; } else this.el.guide.classList.remove('on');
    if (this.curRide && G.player.ride === this.curRide) { const r = this.curRide; const info = r.cfg.type === 'coaster' ? `${Math.round(r.speedKmh || 0)} km/h` : r.cfg.type === 'freefall' ? `${Math.round(r.height || 0)} m` : r.cfg.type === 'ferris' ? (r.atTop ? '📷 Uewen! [P] Foto' : `${Math.round((r.travel / (Math.PI * 2)) * 100)} %`) : r.cfg.type === 'scooter' ? `Bomps: ${r.bumps} · ${Math.max(0, Math.round(r.runT - r.t))} s` : ''; if (info && r.cfg.type !== 'scooter') this.rideInfo(info + ' · [V] Kamera'); else if (info) this.rideInfo(info); }
    else if (this.curRide) this.rideHud(null);
    if (G.settings.showFps) $('#fps').textContent = Math.round(G.fps || 0) + ' FPS';
    if (G.settings.hudMini) this.minimap();
  }
  minimap() {
    const G = this.G, g = this.mctx, p = G.player.pos; const W = 200, sc = 1.35; const yaw = Math.atan2(G.camera.getWorldDirection(this._d || (this._d = new G.THREE.Vector3())).x, this._d.z);
    g.save(); g.clearRect(0, 0, W, W); g.beginPath(); g.arc(100, 100, 98, 0, 7); g.clip(); g.fillStyle = 'rgba(20,24,30,.82)'; g.fillRect(0, 0, W, W);
    g.translate(100, 100); g.rotate(Math.PI + yaw); g.scale(sc, sc); g.translate(-p.x, -p.z);
    g.strokeStyle = '#59606b'; g.lineCap = 'round'; for (const s of G.roadSegs) { if (Math.hypot(s.a[0] - p.x, s.a[1] - p.z) > 260 && Math.hypot(s.b[0] - p.x, s.b[1] - p.z) > 260) continue; g.lineWidth = s.w; g.beginPath(); g.moveTo(s.a[0], s.a[1]); g.lineTo(s.b[0], s.b[1]); g.stroke(); }
    g.fillStyle = '#463f55'; g.beginPath(); GLACIS_POLY.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.fill();
    for (const b of G.buildings) { if (Math.abs(b.x - p.x) > 90 || Math.abs(b.z - p.z) > 90) continue; g.save(); g.translate(b.x, b.z); g.rotate(-b.ang); g.fillStyle = '#2f343c'; g.fillRect(-b.w / 2, -b.d / 2, b.w, b.d); g.restore(); }
    for (const st of G.stalls) { g.fillStyle = st.need === 'food' ? '#ffb703' : st.need === 'drink' ? '#8ecae6' : st.need === 'shop' ? '#f72585' : st.need === 'game' ? '#06d6a0' : '#fff'; g.fillRect(st.x - 1.5, st.z - 1.5, 3, 3); }
    for (const r of Object.values(G.rides)) { if (!r.boothPos) continue; const w = L(r.cfg.u, r.cfg.v); g.fillStyle = '#ff6b35'; g.beginPath(); g.arc(w.x, w.z, 4, 0, 7); g.fill(); }
    if (G.game.guide) { g.fillStyle = '#ffe066'; g.beginPath(); g.arc(G.game.guide.x, G.game.guide.z, 4, 0, 7); g.fill(); }
    for (const s of G.game.specials) if (s.type === 'laemmy') { g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.z, 2.5, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = '#00f5d4'; g.beginPath(); g.moveTo(100, 90); g.lineTo(107, 108); g.lineTo(100, 104); g.lineTo(93, 108); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(100, 100, 97, 0, 7); g.stroke();
    // Norden
    const na = Math.PI + yaw; g.fillStyle = '#ff6b6b'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('N', 100 + Math.sin(-na) * 86, 100 - Math.cos(-na) * 86 + 5);
  }
  // ---------------- Touch ----------------
  setupTouch() {
    const G = this.G; const t = $('#touch'); const st = $('#stick'), knob = $('#stick i'); let id = null, cx = 0, cy = 0;
    st.addEventListener('touchstart', e => { const k = e.changedTouches[0]; id = k.identifier; const b = st.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; e.preventDefault(); }, { passive: false });
    st.addEventListener('touchmove', e => { for (const k of e.changedTouches) if (k.identifier === id) { let dx = (k.clientX - cx) / 50, dy = (k.clientY - cy) / 50; const l = Math.hypot(dx, dy); if (l > 1.2) { dx /= l / 1.2; dy /= l / 1.2; } knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; G.input.setJoystick(dx, -dy); } e.preventDefault(); }, { passive: false });
    const end = () => { id = null; knob.style.transform = ''; G.input.setJoystick(0, 0); }; st.addEventListener('touchend', end); st.addEventListener('touchcancel', end);
    t.querySelectorAll('button').forEach(b => b.addEventListener('touchstart', e => { e.preventDefault(); const k = b.dataset.k;
      if (k === 'E') G.input.touchE = true; else if (k === 'Space') { if (this.spaceAction) this.spaceAction(); else G.input.touchJump = true; } else if (k === 'V') G.player.view = G.player.view === 'first' ? 'third' : 'first'; else this.onKey({ code: k === 'Escape' ? 'Escape' : 'Key' + k }); }, { passive: false }));
  }
}
