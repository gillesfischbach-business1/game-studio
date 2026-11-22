// Cloud-Gaming-Client (Beta): empfängt das Spielbild per WebRTC (WHEP-Standard, RFC-Entwurf
// „WebRTC-HTTP Egress Protocol“) von einem Cloud-GPU-Server und schickt Eingaben über einen
// DataChannel zurück. Gedacht für eine spätere High-End-Version (Unity Render Streaming oder
// Unreal Pixel Streaming hinter einem WHEP-Gateway). Siehe docs/architecture/ADR-0001-cloud-rendering.md
//
// Wichtig: Im claude.ai-Artifact blockiert die Sicherheitsrichtlinie Verbindungen zu fremden
// Servern. Der Cloud-Modus funktioniert daher nur, wenn das Spiel selbst gehostet wird.

export class CloudClient {
  constructor(G) { this.G = G; this.pc = null; this.dc = null; this.video = null; this.state = 'aus'; this.handlers = []; }

  async connect(url, token) {
    if (this.pc) this.disconnect();
    this.setState('verbannen …');
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); this.pc = pc;
    pc.addTransceiver('video', { direction: 'recvonly' }); pc.addTransceiver('audio', { direction: 'recvonly' });
    this.dc = pc.createDataChannel('input', { ordered: true });
    const video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = false; video.id = 'cloudVideo';
    Object.assign(video.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', objectFit: 'cover', zIndex: 4, background: '#000' });
    pc.ontrack = (e) => { if (!video.srcObject) video.srcObject = new MediaStream(); video.srcObject.addTrack(e.track); };
    pc.onconnectionstatechange = () => { this.setState({ connected: 'verbonnen', failed: 'Feeler', disconnected: 'getrennt', closed: 'aus' }[pc.connectionState] || pc.connectionState); if (pc.connectionState === 'failed') this.disconnect(); };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await new Promise(r => { if (pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 2500); pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }; });
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: pc.localDescription.sdp });
    if (!res.ok) { this.disconnect(); throw new Error('WHEP-Server äntwert ' + res.status); }
    this.resource = res.headers.get('Location'); this.url = url;
    await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
    document.body.appendChild(video); this.video = video; this.bindInput(); this.G.cloudActive = true;
  }
  /** Eingaben als kompakte JSON-Nachrichten an den Server */
  bindInput() {
    const send = (m) => { if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(m)); };
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); this.handlers.push([t, ev, fn, opt]); };
    on(window, 'keydown', e => send({ t: 'kd', c: e.code }));
    on(window, 'keyup', e => send({ t: 'ku', c: e.code }));
    on(this.video, 'mousemove', e => send({ t: 'mm', x: e.offsetX / this.video.clientWidth, y: e.offsetY / this.video.clientHeight, dx: e.movementX, dy: e.movementY }));
    on(this.video, 'mousedown', e => { this.video.requestPointerLock?.(); send({ t: 'md', b: e.button }); });
    on(this.video, 'mouseup', e => send({ t: 'mu', b: e.button }));
    on(this.video, 'wheel', e => send({ t: 'wh', d: e.deltaY }), { passive: true });
    this.padTimer = setInterval(() => { const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p) : null; if (gp) send({ t: 'gp', a: gp.axes.map(v => +v.toFixed(3)), b: gp.buttons.map(b => b.pressed ? 1 : 0) }); }, 33);
  }
  async disconnect() {
    for (const [t, ev, fn, opt] of this.handlers) t.removeEventListener(ev, fn, opt); this.handlers = []; clearInterval(this.padTimer);
    try { if (this.resource) await fetch(new URL(this.resource, this.url), { method: 'DELETE' }); } catch (e) { }
    this.pc?.close(); this.pc = null; this.dc = null; this.video?.remove(); this.video = null; this.G.cloudActive = false; this.setState('aus');
  }
  setState(s) { this.state = s; this.G.ui?.toast?.('☁️ Cloud-Gaming', 'Status: ' + s); }
}
