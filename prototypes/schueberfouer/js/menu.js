// Menüs im Stil moderner Open-World-Spiele: Titelbildschirm, Pausenmenü mit Reitern,
// Charakter-/Outfit-Editor mit Drehteller-Kamera, vollständige Optionen inkl. Tastenbelegung.
import * as THREE from 'three';
import { DAYS, TIME, CLOTHES, SOUVENIRS, GLACIS_POLY, TRAM, ENTRANCES, RESTAURANTS, L } from './data.js';
import { OPTION_PAGES, KEY_LABELS, PRESETS, DEFAULTS } from './settings.js';
import { MISSIONS, EGGS } from './game.js';
import { euro } from './util.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SKINS = ['#ffe0c4', '#f1c27d', '#e8b98f', '#e0ac69', '#c68642', '#a0663f', '#8d5524', '#5c3a21'];
const HAIRS = ['#111111', '#2b1b0e', '#4a2f1b', '#7a5230', '#b5651d', '#c9a66b', '#e6c98f', '#8d8d8d', '#d8d8d8', '#a83232', '#3a6fd8', '#ff5fa2'];
const CLOTH = ['#2b2d42', '#1d3557', '#457b9d', '#e63946', '#f1faee', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8338ec', '#ff006e', '#222222', '#6a994e', '#bc4749', '#ffffff', '#d4a373'];
const KEYNAME = c => ({ Space: 'Leerzeechen', ShiftLeft: 'Shift', ShiftRight: 'Shift R', ControlLeft: 'Strg', AltLeft: 'Alt', Tab: 'Tab', Enter: 'Enter', Escape: 'Esc' }[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑ ').replace('↑ Down', '↓').replace('↑ Left', '←').replace('↑ Right', '→'));

/** Hinweis je nach Umgebung: Android-App, claude.ai-Artifact oder eigener Webserver */
function cloudHint() {
  if (window.Capacitor?.isNativePlatform?.()) return 'An der Android-App funktionéiert Cloud Gaming, soubal en WHEP-Server ugi gëtt an den Handy Internet huet.';
  if (/claude\.ai|claudeusercontent/.test(location.hostname) || window.self !== window.top) return 'Hiweis: An dëser Artifact-Versioun blockéiert d\'Sécherheetsrichtlinn Verbindunge mat friemen Serveren. Cloud Gaming funktionéiert, soubal d\'Spill op engem eegene Webserver läit.';
  return 'Cloud Gaming brauch e WHEP-kompatibele Server (Detailer: docs/architecture/ADR-0001-cloud-rendering.md).';
}

export class Menu {
  constructor(ui) { this.ui = ui; this.G = ui.G; this.tab = 'kaart'; this.optPage = 'grafik'; this.wardCat = 'figur'; }

  // =================== Titelbildschirm ===================
  title() {
    const G = this.G; const hasSave = G.game.spent > 0 || G.game.done.size > 0;
    const root = this.ui.el.overlay; root.className = 'title'; this.ui.modal = root; document.exitPointerLock?.();
    root.innerHTML = `<div class="tl-shade"></div>
      <div class="tl-left">
        <div class="tl-logo"><span class="k">SCHUEBERFOUER</span><span class="y">2026</span><small>Glacis · Stad Lëtzebuerg · zënter 1340</small></div>
        <nav class="tl-nav" id="tlnav">
          ${hasSave ? '<button data-a="cont">Weiderspillen</button>' : ''}
          <button data-a="new">${hasSave ? 'Neie Fouerdag' : 'Spill ufänken'}</button>
          <button data-a="opt">Optiounen</button>
          <button data-a="ctl">Steierung</button>
          <button data-a="cred">Crediten</button>
        </nav>
        <div class="tl-sub" id="tlsub"></div>
      </div>
      <div class="tl-foot"><span>21.08. – 09.09.2026 · 12:00 – 01:00 · Entrée gratis</span><span class="hint"><kbd>Klick</kbd> Wielen</span></div>`;
    root.querySelectorAll('#tlnav button').forEach(b => b.onclick = () => this.titleAction(b.dataset.a, b));
  }
  titleAction(a, btn) {
    const G = this.G; const sub = $('#tlsub'); document.querySelectorAll('#tlnav button').forEach(x => x.classList.toggle('on', x === btn));
    if (a === 'cont') return this.startGame(DAYS.indexOf(G.day) >= 0 ? DAYS.indexOf(G.day) : 0, true);
    if (a === 'new') { sub.innerHTML = `<h4>Wéi en Dag op der Fouer?</h4>${DAYS.map((d, i) => `<button class="tl-day" data-i="${i}"><b>${d.date}</b><span>${esc(d.label.split('–').slice(1).join('–').trim())}</span></button>`).join('')}`; sub.querySelectorAll('.tl-day').forEach(b => b.onclick = () => this.startGame(+b.dataset.i)); return; }
    if (a === 'opt') { this.openPause('optiounen', true); return; }
    if (a === 'ctl') { this.optPage = 'steierung'; this.openPause('optiounen', true); return; }
    if (a === 'cred') sub.innerHTML = `<h4>Crediten</h4><p>Spill-Design & Programméierung: Claude (Anthropic) mam Studio-Team.<br>Kaartendaten: © OpenStreetMap-Contributeuren (ODbL).<br>Fotorealistesch Texturen & HDR-Himmel: Poly Haven (CC0).<br>3D-Engine: three.js (MIT). Schrëften: Google Fonts.<br>Tor-Motiv 2026: Foto vum Spiller.<br>Fouer-Lageplang: Ville de Luxembourg.</p>`;
  }
  startGame(dayIdx, cont = false) {
    const G = this.G, ui = this.ui;
    G.day = DAYS[dayIdx]; if (!cont) { G.minutes = TIME.start; if (G.day.id === 'last') G.minutes = 21 * 60 + 40; if (G.day.id === 'open') G.minutes = 20 * 60 + 55; }
    ui.closeAll(); ui.started = true; G.running = true; ui.el.hud.classList.remove('hidden'); if (G.isMobile) $('#touch').classList.remove('hidden');
    G.audio.start(); G.audio.setVolumes(G.settings); G.player.rebuild(); ui.refreshMission(); ui.applyHud();
    ui.toast('Wëllkomm op der Schueberfouer 2026!', `${G.day.date} – Haaptentrée E1, Rond-Point Robert Schuman`);
    setTimeout(() => ui.toast('Tipp: Dréck [Q]', 'De Fouer-Kompass weist dir de Wee. [Esc] fir Kaart, Garderob an Optiounen.'), 4500);
    if (!G.isMobile) G.renderer.domElement.requestPointerLock?.();
  }

  // =================== Pausenmenü ===================
  openPause(tab = this.tab, fromTitle = false) {
    const G = this.G, ui = this.ui; this.tab = tab; this.fromTitle = fromTitle; ui.menuOpen = true; document.exitPointerLock?.(); document.body.classList.add('menu-open');
    const root = ui.el.overlay; root.className = 'pm' + (tab === 'garderob' ? ' pm-ward' : ''); ui.modal = root;
    const tabs = fromTitle ? [['optiounen', 'Optiounen']] : [['kaart', 'Kaart'], ['missiounen', 'Missiounen'], ['garderob', 'Garderob'], ['statistik', 'Statistiken'], ['optiounen', 'Optiounen'], ['spill', 'Spill']];
    const m = Math.floor(G.minutes) % 1440;
    root.innerHTML = `<div class="pm-bg"></div>
      <header class="pm-top"><div class="pm-brand">SCHUEBERFOUER <b>2026</b></div>
        <nav class="pm-tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</nav>
        <div class="pm-info"><span>${G.day.date}</span><span>${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</span><span>∞ € · ausgi ${euro(G.game.spent)}</span></div></header>
      <main class="pm-body" id="pmbody"></main>
      <button class="pm-close" id="pmclose" aria-label="Zou">✕</button>
      <footer class="pm-foot"><span><kbd>Esc</kbd> ${fromTitle ? 'Zréck' : 'Weiderspillen'}</span><span><kbd>←</kbd><kbd>→</kbd> Reiter</span><span><kbd>Klick</kbd> Wielen</span></footer>`;
    root.querySelectorAll('.pm-tabs button').forEach(b => b.onclick = () => { G.audio.click(); this.openPause(b.dataset.t, fromTitle); });
    $('#pmclose').onclick = () => this.close(); root.querySelector('.pm-tabs .on')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    ui.menuCam = null;
    const body = $('#pmbody');
    ({ kaart: () => this.mapTab(body), missiounen: () => this.missionTab(body), garderob: () => this.wardTab(body), statistik: () => this.statTab(body), optiounen: () => this.optTab(body), spill: () => this.gameTab(body) })[tab]();
  }
  close() { const ui = this.ui; ui.menuCam = null; this.G.player.human.rotation.y = this.G.player.yaw; if (this.fromTitle) { this.fromTitle = false; ui.menuOpen = false; this.title(); return; } ui.closeAll(); }
  cycleTab(d) { const order = this.fromTitle ? ['optiounen'] : ['kaart', 'missiounen', 'garderob', 'statistik', 'optiounen', 'spill']; const i = order.indexOf(this.tab); this.openPause(order[(i + d + order.length) % order.length], this.fromTitle); }

  // ---------- Kaart ----------
  mapTab(body) {
    const G = this.G;
    body.innerHTML = `<div class="pm-map"><canvas id="pmcv" width="1400" height="820"></canvas>
      <aside class="pm-legend"><h3>Legend</h3><p><i style="background:#ff6b35"></i>Attraktiounen</p><p><i style="background:#7fd1b9"></i>Restauranten</p><p><i style="background:#ffb703"></i>Iessen</p><p><i style="background:#8ecae6"></i>Drénken</p><p><i style="background:#f72585"></i>Shopping</p><p><i style="background:#06d6a0"></i>Spiller</p><p><i style="background:#ffe066"></i>Wee-Zil</p><p><i style="background:#00f5d4"></i>Du</p>
      <h3>Séier Ziler</h3>${Object.values(G.rides).slice(0, 10).map(r => `<button class="pm-link" data-r="${r.id}">${esc(r.name)}</button>`).join('')}</aside></div>`;
    const cv = $('#pmcv'), g = cv.getContext('2d'); const W = 1400, H = 820; const S = W / 430, ox = 230, oz = 160; const X = x => (x + ox) * S, Z = z => (z + oz) * S - 40;
    g.fillStyle = '#16210f'; g.fillRect(0, 0, W, H);
    for (const b of G.buildings) { g.save(); g.translate(X(b.x), Z(b.z)); g.rotate(-b.ang); g.fillStyle = '#343a44'; g.fillRect(-b.w * S / 2, -b.d * S / 2, b.w * S, b.d * S); g.restore(); }
    g.strokeStyle = '#5f6672'; g.lineCap = 'round'; for (const s of G.roadSegs) { g.lineWidth = s.w * S; g.beginPath(); g.moveTo(X(s.a[0]), Z(s.a[1])); g.lineTo(X(s.b[0]), Z(s.b[1])); g.stroke(); }
    g.strokeStyle = '#d7263d'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); TRAM.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#463f55'; g.beginPath(); GLACIS_POLY.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.fill();
    for (const st of G.stalls) { g.fillStyle = st.need === 'food' ? '#ffb703' : st.need === 'drink' ? '#8ecae6' : st.need === 'shop' ? '#f72585' : st.need === 'game' ? '#06d6a0' : '#fff'; g.fillRect(X(st.x) - 3, Z(st.z) - 3, 6, 6); }
    for (const rs of RESTAURANTS) { const w = L(rs.u, -47); g.fillStyle = '#7fd1b9'; g.fillRect(X(w.x) - 6, Z(w.z) - 6, 12, 12); }
    const lab = (t, x, z, c = '#fff', sz = 13) => { g.font = `${sz}px Oswald, sans-serif`; const w = g.measureText(t).width; g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(X(x) - w / 2 - 4, Z(z) - sz, w + 8, sz + 6); g.fillStyle = c; g.textAlign = 'center'; g.fillText(t, X(x), Z(z)); };
    for (const r of Object.values(G.rides)) { const w = L(r.cfg.u, r.cfg.v); g.fillStyle = '#ff6b35'; g.beginPath(); g.arc(X(w.x), Z(w.z), 8, 0, 7); g.fill(); lab(r.name.toUpperCase(), w.x, w.z - 6, '#ffd166', 12); }
    for (const e of ENTRANCES) { const w = L(e.u, e.v); lab(e.id, w.x, w.z, '#fff', 13); }
    for (const st of TRAM.stops) lab('TRAM ' + st.name.toUpperCase(), st.x, st.z + 10, '#ff8fa3', 12);
    lab('GRAND THÉÂTRE', 272, -95, '#fff', 13); lab('ALLÉE SCHEFFER', -60, -62, '#bbb', 12); lab('BOULEVARD DE LA FOIRE', 20, 100, '#bbb', 12); lab('ROND-POINT R. SCHUMAN', 150, 22, '#bbb', 12); lab("RUE JEAN L'AVEUGLE", -170, -125, '#bbb', 12); lab('AV. DE LA FAÏENCERIE', -200, 10, '#bbb', 12); lab('PARC', 20, 190, '#9bc28a', 14);
    if (G.game.guide) { g.fillStyle = '#ffe066'; g.beginPath(); g.arc(X(G.game.guide.x), Z(G.game.guide.z), 9, 0, 7); g.fill(); }
    const p = G.player.pos; g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-G.player.yaw + Math.PI); g.fillStyle = '#00f5d4'; g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.fill(); g.restore();
    cv.onclick = e => { const b = cv.getBoundingClientRect(); const mx = (e.clientX - b.left) / b.width * W, mz = (e.clientY - b.top) / b.height * H; const x = mx / S - ox, z = (mz + 40) / S - oz; G.game.setGuide({ x, z, name: 'Kaartepunkt' }); this.mapTab(body); };
    body.querySelectorAll('.pm-link').forEach(b => b.onclick = () => { const r = G.rides[b.dataset.r]; G.game.setGuide({ x: r.boothPos.x, z: r.boothPos.z, name: r.name }); this.close(); });
  }

  // ---------- Missiounen ----------
  missionTab(body) {
    const g = this.G.game; const vis = MISSIONS.filter(m => !m.hidden || g.prog[m.id + ':seen'] || g.done.has(m.id));
    const sel = this.selMission && vis.find(m => m.id === this.selMission) ? this.selMission : (g.active || vis[0].id);
    const M = vis.find(m => m.id === sel);
    body.innerHTML = `<div class="pm-cols"><div class="pm-list">${vis.map(m => `<button data-id="${m.id}" class="${m.id === sel ? 'on' : ''} ${g.done.has(m.id) ? 'done' : ''}"><span>${g.done.has(m.id) ? '✔' : g.active === m.id ? '◆' : '○'}</span>${esc(m.title)}</button>`).join('')}
      <h3>Easter Eggs ${g.eggs.size}/${Object.keys(EGGS).length}</h3><div class="pm-eggs">${Object.entries(EGGS).map(([k, e]) => `<span class="${g.eggs.has(k) ? 'on' : ''}" title="${g.eggs.has(k) ? esc(e.d) : ''}">${g.eggs.has(k) ? esc(e.t) : '???'}</span>`).join('')}</div></div>
      <div class="pm-detail"><h2>${esc(M.title)}</h2><p>${esc(M.desc)}</p><ul class="pm-steps">${M.steps.map((s, i) => `<li class="${g.prog[M.id + ':' + i] === true ? 'ok' : ''}">${esc(s[2])}</li>`).join('')}</ul><p class="pm-rew">Belounung: ${esc(M.reward)}</p>
      ${g.done.has(M.id) ? '<p class="pm-ok">Erfëllt ✔</p>' : `<button class="pm-cta" id="track">${g.active === M.id ? 'Gëtt verfollegt' : 'Missioun verfollegen'}</button>`}</div></div>`;
    body.querySelectorAll('.pm-list button').forEach(b => b.onclick = () => { this.selMission = b.dataset.id; this.missionTab(body); });
    const t = $('#track'); if (t) t.onclick = () => { g.active = M.id; g.save(); this.ui.refreshMission(); this.missionTab(body); };
  }

  // ---------- Garderob / Charakter-Editor ----------
  wardTab(body) {
    const G = this.G, g = G.game, look = G.settings.look; const P = G.player;
    // Drehteller-Kamera vor der Figur
    let rot = 0; this.ui.menuCam = (dt) => { rot += dt * 0.35; const h = P.human; h.rotation.y = P.yaw + Math.sin(rot) * 0.8; const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); const zoom = this.wardCat === 'kapp' || this.wardCat === 'brell' ? 1.6 : 3.1; const y = this.wardCat === 'kapp' || this.wardCat === 'brell' ? 1.7 : 1.15;
      G.camera.position.set(P.pos.x + fx * zoom - fz * 0.7, y + 0.15, P.pos.z + fz * zoom + fx * 0.7); G.camera.lookAt(P.pos.x - fz * 0.6, y, P.pos.z + fx * 0.6); };
    const cats = [['figur', 'Figur'], ['uewen', 'Uewendeel'], ['hosen', 'Hosen & Schong'], ['kapp', 'Kapp & Hoer'], ['brell', 'Brëll'], ['hals', 'Hals'], ['tasch', 'Täsch']];
    const sw = (key, list, cur) => `<div class="sw">${list.map(c => `<button data-k="${key}" data-v="${c}" style="background:${c}" class="${c === cur ? 'on' : ''}"></button>`).join('')}</div>`;
    const items = slot => Object.entries(CLOTHES).filter(([, c]) => c.slot === slot).map(([id, c]) => { const own = g.owned.has(id), eq = g.equipped[slot] === id; return `<button class="wi ${eq ? 'eq' : ''}" data-id="${id}"><span class="ic">${c.icon}</span><span class="nm">${esc(c.name)}<small>${eq ? 'Un – klick fir auszedoen' : own ? 'An der Garderob' : euro(g.price(c.price, 'shop')) + ' · direkt kafen'}</small></span></button>`; }).join('');
    let html = '';
    const c = this.wardCat;
    if (c === 'figur') html = `<h4>Hautfaarf</h4>${sw('skin', SKINS, look.skin)}<h4>Gréisst</h4><input type="range" id="wh" min="0.88" max="1.12" step="0.01" value="${look.height}"><p class="pm-note">De Look gëtt gespäichert a gëllt och fir den nächste Fouerdag.</p>`;
    if (c === 'uewen') html = `<h4>Faarf vum T-Shirt</h4>${sw('shirt', CLOTH, look.shirt)}<h4>Fouer-Kleeder</h4>${items('top')}`;
    if (c === 'hosen') html = `<h4>Hosen</h4>${sw('pants', CLOTH, look.pants)}<h4>Schong</h4>${sw('shoes', ['#1a1a1a', '#f5f5f5', '#8b5a2b', '#d01c2a', '#1d4ea8', '#e9c46a'], look.shoes)}`;
    if (c === 'kapp') html = `<h4>Frisur</h4><div class="seg">${['Kuerz', 'Päerdsschwanz', 'Voll'].map((t, i) => `<button data-hs="${i}" class="${look.hairStyle === i ? 'on' : ''}">${t}</button>`).join('')}</div><h4>Hoerfaarf</h4>${sw('hair', HAIRS, look.hair)}<h4>Kappbedeckung</h4>${items('head')}`;
    if (c === 'brell') html = `<h4>Brëllen</h4>${items('eyes')}`;
    if (c === 'hals') html = `<h4>Schal & Ketten</h4>${items('neck')}`;
    if (c === 'tasch') html = `<h4>An der Täsch</h4><p>${g.souvenirs.length ? g.souvenirs.map(s => SOUVENIRS[s] ? SOUVENIRS[s].icon + ' ' + esc(SOUVENIRS[s].name) : esc(s)).join('<br>') : 'Nach eidel – kuck beim Lämmy-Shop oder an der Lousbud.'}</p><p class="pm-note">Fouerbichelcher (Gratis-Tickets): ${g.freeTickets}</p>`;
    body.innerHTML = `<div class="pm-ward"><div class="pm-wl">${cats.map(([k, l]) => `<button data-c="${k}" class="${k === c ? 'on' : ''}">${l}</button>`).join('')}</div><div class="pm-wp">${html}<button class="pm-sec" id="wreset">Standard-Look</button></div></div>`;
    body.querySelectorAll('.pm-wl button').forEach(b => b.onclick = () => { this.wardCat = b.dataset.c; this.wardTab(body); });
    body.querySelectorAll('.sw button').forEach(b => b.onclick = () => { look[b.dataset.k] = b.dataset.v; G.saveSettings(); P.rebuild(); this.wardTab(body); });
    body.querySelectorAll('[data-hs]').forEach(b => b.onclick = () => { look.hairStyle = +b.dataset.hs; G.saveSettings(); P.rebuild(); this.wardTab(body); });
    const wh = $('#wh'); if (wh) wh.oninput = () => { look.height = +wh.value; G.saveSettings(); P.rebuild(); };
    body.querySelectorAll('.wi').forEach(b => b.onclick = () => { const id = b.dataset.id; if (!g.owned.has(id)) { g.pay(g.price(CLOTHES[id].price, 'shop'), CLOTHES[id].name); g.owned.add(id); } g.equip(id); this.wardTab(body); });
    $('#wreset').onclick = () => { G.settings.look = structuredClone(DEFAULTS.look); g.equipped = {}; g.save(); G.saveSettings(); P.rebuild(); this.wardTab(body); };
  }

  // ---------- Statistiken ----------
  statTab(body) {
    const g = this.G.game, s = g.stats; const h = Math.floor(s.play / 3600), mi = Math.floor(s.play / 60) % 60;
    const rows = [['Ausgi Suen', euro(g.spent)], ['Gespillt Zäit', `${h} h ${mi} min`], ['Gelaf', `${(s.dist / 1000).toFixed(2)} km`], ['Verschidden Attraktiounen', `${g.ridden.size}`], ['Spezialitéiten probéiert', `${g.eaten.size}`], ['Missiounen erfëllt', `${g.done.size} / ${MISSIONS.length}`], ['Easter Eggs', `${g.eggs.size} / ${Object.keys(EGGS).length}`], ['Gëlle Hämmelcher', `${g.sheepFound.size} / 7`], ['Fotoen', `${s.photos}`], ['Béier gedronk', `${g.beers}`], ['Kleeder an der Garderob', `${g.owned.size}`]];
    body.innerHTML = `<div class="pm-stats">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  }

  // ---------- Spill ----------
  gameTab(body) {
    const G = this.G;
    body.innerHTML = `<div class="pm-game"><button class="pm-cta" data-a="go">Weiderspillen</button><button data-a="save">Spillstand späicheren</button><button data-a="title">An d'Haaptmenü</button><button data-a="reset" class="danger">Spillstand zrécksetzen …</button><p id="gmsg" class="pm-note"></p></div>`;
    body.querySelectorAll('button').forEach(b => b.onclick = () => { const a = b.dataset.a;
      if (a === 'go') this.close(); if (a === 'save') { G.game.save(); $('#gmsg').textContent = 'Gespäichert (an dësem Browser).'; }
      if (a === 'title') { this.ui.closeAll(); this.ui.started = false; G.running = false; this.ui.el.hud.classList.add('hidden'); $('#touch').classList.add('hidden'); this.title(); }
      if (a === 'reset') { $('#gmsg').innerHTML = 'Wierklech alles läschen (Missiounen, Kleeder, Statistiken)? <button id="yes" class="danger">Jo, läschen</button>'; $('#yes').onclick = () => G.game.reset(); } });
  }

  // ---------- Optiounen ----------
  optTab(body) {
    const G = this.G, S = G.settings; const page = OPTION_PAGES.find(p => p.id === this.optPage) || OPTION_PAGES[0];
    const dayOpts = DAYS.map((d, i) => [i, d.label]);
    const val = (it) => it.k === '_time' ? (G.minutes % 1440) / 60 + ((G.minutes % 1440) < 60 ? 24 : 0) : it.k === '_day' ? DAYS.indexOf(G.day) : it.k === '_daypreset' ? '' : S[it.k];
    let rows = '';
    if (page.id === 'cloud') {
      const st = G.cloud?.state || 'aus';
      rows = `<div class="pm-cloud"><p>Mat Cloud Gaming leeft d'Spill op enger Grafikkaart am Rechenzentrum (z. B. eng High-End-Versioun an Unity oder Unreal) an Dir kritt just d'Bild als Video gestreamt – och op schwaachen Handyen. Ënnerstëtzt gëtt de WebRTC-Standard <b>WHEP</b>.</p>
        <div class="opt"><label>WHEP-Server-URL</label><input id="curl" type="url" placeholder="https://mäin-server.lu/whep/schueberfouer" value="${esc(S.cloudUrl)}"></div>
        <div class="opt"><label>Zougangs-Token (optional)</label><input id="ctok" type="password" value="${esc(S.cloudToken)}"></div>
        <div class="opt"><label>Status</label><span class="ro">${esc(st)}</span></div>
        <button class="pm-cta" id="cgo">${G.cloudActive ? 'Trennen' : 'Verbannen'}</button>
        <p class="pm-note">${cloudHint()}</p><p class="pm-note" id="cmsg"></p></div>`;
    } else if (page.id === 'steierung') {
      rows = Object.entries(KEY_LABELS).map(([k, l]) => `<div class="opt" data-key="${k}"><label>${l}</label><button class="kb" data-bind="${k}">${KEYNAME(S.keys[k])}</button></div>`).join('') +
        `<div class="opt"><label>Gamepad</label><span class="ro">${navigator.getGamepads && [...navigator.getGamepads()].some(p => p) ? 'Verbonnen ✔' : 'Xbox/PlayStation-Controller ënnerstëtzt – einfach uschléissen'}</span></div>
         <div class="pm-pad"><b>Gamepad:</b> Lénke Stick lafen · Rietse Stick kucken · A Aktioun · X sprangen · Y Kompass · B zeréck · LB Kaart · RB Kamera · LT lafen · Start Menü</div>
         <button class="pm-sec" id="kreset">Tastebelegung zrécksetzen</button>`;
    } else rows = page.items.map(it => {
      const v = val(it); const desc = it.d ? ` data-d="${esc(it.d)}"` : '';
      if (it.t === 'tog') return `<div class="opt"${desc}><label>${it.l}</label><button class="tg ${v ? 'on' : ''}" data-k="${it.k}">${v ? 'Un' : 'Aus'}</button></div>`;
      if (it.t === 'sel') { const o = it.k === '_day' ? dayOpts : it.o; const i = Math.max(0, o.findIndex(x => String(x[0]) === String(v))); return `<div class="opt"${desc}><label>${it.l}</label><div class="sel"><button data-k="${it.k}" data-d="-1">‹</button><span>${esc(o[i][1])}</span><button data-k="${it.k}" data-d="1">›</button></div></div>`; }
      if (it.t === 'sld') return `<div class="opt"${desc}><label>${it.l}</label><div class="sld"><input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}" data-k="${it.k}"><span>${it.fmt(+v)}</span></div></div>`;
      return '';
    }).join('');
    body.innerHTML = `<div class="pm-opt"><div class="pm-ol">${OPTION_PAGES.map(p => `<button data-p="${p.id}" class="${p.id === page.id ? 'on' : ''}">${p.label}</button>`).join('')}<button class="pm-sec" id="odef">Standardwäerter</button></div>
      <div class="pm-oi">${rows}</div><aside class="pm-od" id="odesc"><h3>${page.label}</h3><p>Fuer mat der Maus iwwer eng Optioun fir eng Erklärung. Ännerunge gëllen direkt a ginn automatesch gespäichert.</p><p class="pm-note">FPS elo: ${Math.round(G.fps || 0)}</p></aside></div>`;
    body.querySelectorAll('.pm-ol button[data-p]').forEach(b => b.onclick = () => { this.optPage = b.dataset.p; this.optTab(body); });
    $('#odef').onclick = () => { const keys = S.keys, look = S.look; Object.assign(S, structuredClone(DEFAULTS), { look }); G._lastPreset = null; G.applySettings(); this.optTab(body); };
    body.querySelectorAll('.opt').forEach(o => o.onmouseenter = () => { if (o.dataset.d) $('#odesc').innerHTML = `<h3>${o.querySelector('label').textContent}</h3><p>${o.dataset.d}</p>`; });
    const set = (k, v) => {
      if (k === '_time') { G.minutes = Math.floor(G.minutes / 1440) * 1440 + v * 60; G.applyTimeNow(); return; }
      if (k === '_daypreset') { if (v) { G.minutes = Math.floor(G.minutes / 1440) * 1440 + +v * 60; G.applyTimeNow(); } return; }
      if (k === '_day') { G.day = DAYS[v]; return; }
      S[k] = v; if (k !== 'preset') S.preset = PRESETS[S.preset] && Object.entries(PRESETS[S.preset]).every(([a, b]) => S[a] === b) ? S.preset : S.preset;
      G.applySettings();
    };
    body.querySelectorAll('.tg').forEach(b => b.onclick = () => { set(b.dataset.k, !S[b.dataset.k]); G.audio.click(); this.optTab(body); });
    body.querySelectorAll('.sel button').forEach(b => b.onclick = () => { const it = page.items.find(x => x.k === b.dataset.k); const o = it.k === '_day' ? dayOpts : it.o; const cur = val(it); let i = o.findIndex(x => String(x[0]) === String(cur)); i = (i + +b.dataset.d + o.length) % o.length; set(it.k, o[i][0]); G.audio.click(); this.optTab(body); });
    body.querySelectorAll('.sld input').forEach(inp => inp.oninput = () => { const it = page.items.find(x => x.k === inp.dataset.k); set(it.k, +inp.value); inp.nextElementSibling.textContent = it.fmt(+inp.value); });
    body.querySelectorAll('.kb').forEach(b => b.onclick = () => { b.textContent = 'Dréck eng Tast …'; b.classList.add('wait'); this.capture = (code) => { S.keys[b.dataset.bind] = code; G.saveSettings(); this.capture = null; this.optTab(body); }; });
    const cg = $('#cgo'); if (cg) cg.onclick = async () => { S.cloudUrl = $('#curl').value.trim(); S.cloudToken = $('#ctok').value; G.saveSettings();
      try { if (G.cloudActive) await G.cloud.disconnect(); else { if (!S.cloudUrl) throw new Error('Gëff eng Server-URL an.'); await G.cloud.connect(S.cloudUrl, S.cloudToken); this.close(); return; } } catch (e) { $('#cmsg').textContent = 'Konnt net verbannen: ' + e.message; return; } this.optTab(body); };
    const kr = $('#kreset'); if (kr) kr.onclick = () => { S.keys = structuredClone(DEFAULTS.keys); G.saveSettings(); this.optTab(body); };
  }
  onKey(e) {
    if (!this.ui.started && !this.ui.menuOpen && e.code === 'Escape') { const sub = $('#tlsub'); if (sub && sub.innerHTML.trim()) { sub.innerHTML = ''; document.querySelectorAll('#tlnav button').forEach(x => x.classList.remove('on')); return true; } }
    if (this.capture) { if (e.code !== 'Escape') this.capture(e.code); else { this.capture = null; this.openPause(this.tab, this.fromTitle); } return true; }
    if (!this.ui.menuOpen) return false;
    if (e.code === 'Escape') { this.close(); return true; }
    if (e.code === 'ArrowRight') { this.cycleTab(1); return true; } if (e.code === 'ArrowLeft') { this.cycleTab(-1); return true; }
    return true;
  }
}
