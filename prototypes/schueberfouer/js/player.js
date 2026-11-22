// Spielfigur, Kamera und Steuerung (Tastatur/Maus + Touch)
import * as THREE from 'three';
import { makeHuman, animateHuman } from './npc.js';
import { clamp, lerp } from './util.js';

export class Player {
  constructor(G) {
    this.G = G;
    this.human = this.makeBody(); G.scene.add(this.human);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0; this.y = 0;
    this.yaw = 0; this.camYaw = 0; this.camPitch = 0.28; this.camDist = 5.2; this.camDistT = 5.2;
    this.mode = 'walk'; this.view = 'third'; this.ride = null; this.seat = null; this.shake = 0;
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.lookYaw = 0; this.lookPitch = 0; // Blick-Offset im Fahrgeschäft
    this.stats = { hunger: 70, thirst: 70, fun: 50, promille: 0 };
    this.radius = 0.35;
  }
  makeBody() { const l = this.G.settings.look; const h = makeHuman({ skin: l.skin, shirt: l.shirt, pants: l.pants, hair: l.hair, hairStyle: l.hairStyle, shoes: l.shoes, scale: l.height, unique: true }); h.userData.baseShirt = l.shirt; return h; }
  /** Figur nach Look-Änderung neu aufbauen (Position & Ausrüstung bleiben) */
  rebuild() { const old = this.human; const h = this.makeBody(); const par = old.parent || this.G.scene; h.position.copy(old.position); h.rotation.copy(old.rotation); h.visible = old.visible; par.remove(old); par.add(h); this.human = h; if (this.mode !== 'walk') animateHuman(h, 0, 0, 'sit'); this.G.game?.applyOutfit(); }
  spawn(x, z, yaw) { this.pos.set(x, 0, z); this.yaw = yaw; this.camYaw = yaw + Math.PI; this.human.position.copy(this.pos); this.human.rotation.y = yaw; this.camPos.set(x - Math.sin(yaw) * 5, 2.5, z - Math.cos(yaw) * 5); }

  update(dt, input) {
    const G = this.G, cam = G.camera;
    // Bedürfnisse
    const s = this.stats; s.hunger = Math.max(0, s.hunger - dt * 0.18); s.thirst = Math.max(0, s.thirst - dt * 0.25); s.promille = Math.max(0, s.promille - dt * 0.004);
    // Blick mit Maus / Touch
    const S = G.settings; const sx = input.lookX * S.sens, sy = input.lookY * S.sens * (S.invertY ? -1 : 1);
    this.camYaw -= sx * 0.0032; this.camPitch = clamp(this.camPitch + sy * 0.0028, -0.6, 1.3);
    this.lookYaw = clamp(this.lookYaw - sx * 0.003, -2.4, 2.4); this.lookPitch = clamp(this.lookPitch - sy * 0.003, -1.2, 1.2);
    if (S.autoCenter && this.mode === 'walk' && Math.abs(input.lookX) < 0.01 && this.speed > 1) { let d = (this.yaw + Math.PI) - this.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.camYaw += d * Math.min(1, dt * 1.5); }
    if (S.reduceMotion || !S.shake) this.shake = 0;
    this.camDistT = clamp(this.camDistT + input.wheel * 0.004, 2.2, 14);
    this.camDist = lerp(this.camDist, this.camDistT, Math.min(1, dt * 8));
    const drunk = G.settings.reduceMotion ? Math.min(s.promille, 0.4) : s.promille;

    if (this.mode === 'walk') {
      let mx = input.moveX, mz = input.moveY; // mz: vorwärts
      if (drunk > 0.5) { mx += Math.sin(G.time * 1.3) * Math.min(0.6, (drunk - 0.5) * 0.4); }
      const len = Math.hypot(mx, mz); const run = input.run;
      const maxV = (run ? 6.2 : 3.0) * Math.min(1, len);
      const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw); // Kamera-Vorwärts (Kamera schaut auf Figur)
      const rx = -fz, rz = fx;
      let dx = 0, dz = 0;
      if (len > 0.05) { dx = (fx * mz + rx * mx) / Math.max(1, len); dz = (fz * mz + rz * mx) / Math.max(1, len); }
      const tvx = dx * maxV, tvz = dz * maxV;
      this.vel.x = lerp(this.vel.x, tvx, Math.min(1, dt * 10)); this.vel.z = lerp(this.vel.z, tvz, Math.min(1, dt * 10));
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      G.colliders.resolve(this.pos, this.radius);
      this.pos.x = clamp(this.pos.x, -470, 360); this.pos.z = clamp(this.pos.z, -380, 420);
      // Springen
      if (input.jump && this.y <= 0.001) { this.vy = 4.6; G.emit('jump'); }
      this.vy -= 12 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y === 0) this.vy = 0;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.2) { const ty = Math.atan2(this.vel.x, this.vel.z); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 10); }
      this.human.position.set(this.pos.x, this.y, this.pos.z); this.human.rotation.y = this.yaw;
      animateHuman(this.human, sp, dt, drunk > 1 ? 'drunk' : run && sp > 4 ? 'run' : 'walk');
      this.speed = sp;
      // Kamera
      const target = new THREE.Vector3(this.pos.x, this.y + 1.55, this.pos.z);
      if (this.view === 'first') {
        this.human.visible = false;
        const bob = G.settings.headBob && !G.settings.reduceMotion ? Math.sin(this.human.userData.walk * 2) * 0.04 * Math.min(1, this.speed / 3) : 0;
        cam.position.set(this.pos.x, this.y + 1.68 + bob, this.pos.z);
        cam.rotation.set(clamp(-(this.camPitch - 0.28) * 1.4, -1.3, 1.3), this.camYaw, 0, 'YXZ');
        this.yaw = this.camYaw + Math.PI;
      } else {
        this.human.visible = true;
        const d = this.camDist; const cp = new THREE.Vector3(target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * d, target.y + Math.sin(this.camPitch) * d, target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * d);
        cp.y = Math.max(0.4, cp.y);
        this.camPos.lerp(cp, Math.min(1, dt * 12)); cam.position.copy(this.camPos); cam.lookAt(target);
      }
    } else if (this.mode === 'ride' || this.mode === 'drive' || this.mode === 'tram') {
      const seat = this.seat; seat.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3(); seat.getWorldPosition(wp); this.pos.set(wp.x, 0, wp.z);
      if (this.mode === 'drive') {
        this.ride.drive(dt, input.moveY, -input.moveX);
        const c = this.ride.pc; const head = c.heading + this.ride.g.parent.rotation.y;
        const tgt = wp.clone().add(new THREE.Vector3(0, 1.2, 0));
        const cp = tgt.clone().add(new THREE.Vector3(-Math.sin(head) * 6.5, 3.2, -Math.cos(head) * 6.5));
        this.camPos.lerp(cp, Math.min(1, dt * 5)); cam.position.copy(this.camPos); cam.lookAt(tgt);
      } else if (this.view === 'first' || (this.ride && this.ride.cam === 'first' && this.view !== 'third')) {
        const q = new THREE.Quaternion(); seat.getWorldQuaternion(q);
        const eye = new THREE.Vector3(0, 1.2, 0).applyQuaternion(q).add(wp);
        cam.position.copy(eye); cam.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lookPitch, this.lookYaw, 0, 'YXZ')));
        this.human.visible = false;
      } else {
        this.human.visible = true;
        const tgt = wp.clone().add(new THREE.Vector3(0, 1.1, 0)); const d = this.rideDist || 9;
        const cp = new THREE.Vector3(tgt.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * d, tgt.y + Math.sin(this.camPitch) * d, tgt.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * d);
        this.camPos.lerp(cp, Math.min(1, dt * 6)); cam.position.copy(this.camPos); cam.lookAt(tgt);
      }
    } else if (this.mode === 'operator') {
      const o = this.ride.opCam; const wp = new THREE.Vector3(); o.getWorldPosition(wp); cam.position.copy(wp);
      const c = new THREE.Vector3(); this.ride.g.getWorldPosition(c); c.y = 2.5; cam.lookAt(c);
      cam.rotateY(this.lookYaw * 0.4); cam.rotateX(this.lookPitch * 0.4);
    } else if (this.mode === 'fixed') {
      cam.position.copy(this.fixedCam.pos); cam.lookAt(this.fixedCam.look);
    }
    // Wackeln (Stöße, Schwindel)
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake * 0.3; cam.position.y += (Math.random() - 0.5) * this.shake * 0.3; this.shake = Math.max(0, this.shake - dt * 1.5); }
    if (drunk > 0.8) { cam.rotation.z += Math.sin(G.time * 0.9) * Math.min(0.12, (drunk - 0.8) * 0.05); }
  }

  board(ride) {
    const seat = ride.board(); this.ride = ride; this.seat = seat;
    this.mode = ride.cfg.type === 'scooter' ? 'drive' : 'ride';
    seat.add(this.human); this.human.position.set(0, 0, 0); this.human.rotation.set(0, Math.PI, 0);
    animateHuman(this.human, 0, 0, 'sit');
    this.lookYaw = 0; this.lookPitch = 0; this.view = ride.cam === 'first' ? 'first' : 'third'; this.rideDist = ride.cfg.type === 'ferris' ? 12 : 9;
    if (ride.cfg.type === 'scooter') { this.human.rotation.set(0, 0, 0); }
    this.camYaw = this.G.fairRoot.rotation.y + Math.PI * 0.6; this.camPitch = 0.35;
  }
  unboard(ride) {
    if (this.ride !== ride) return;
    ride.player = null; ride.release?.();
    this.G.scene.add(this.human); this.human.rotation.set(0, 0, 0); this.human.visible = true;
    const e = ride.exitPoint(); this.pos.set(e.x, 0, e.z); this.mode = 'walk'; this.ride = null; this.seat = null; this.view = 'third';
    this.camPos.set(e.x + 3, 3, e.z + 3);
    this.stats.fun = Math.min(100, this.stats.fun + 12 + (ride.cfg.thrill || 0) * 4);
    this.G.emit('rideDone', ride.id);
  }
}

// =============================================================
// Eingabe: Tastatur, Maus (Pointer Lock), Touch-Joystick
export class Input {
  constructor(G, el) {
    this.G = G; this.keys = new Set(); this.lookX = 0; this.lookY = 0; this.wheel = 0; this.moveX = 0; this.moveY = 0; this.run = false; this.jump = false;
    this.pressed = new Set(); this.touchMove = { x: 0, y: 0 }; this.dragging = false;
    addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (!this.keys.has(e.code)) this.pressed.add(e.code); this.keys.add(e.code); if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); this.G.onKey?.(e); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', e => { if (e.button === 0 && this.G.canLock?.()) el.requestPointerLock?.(); this.dragging = true; this.lx = e.clientX; this.ly = e.clientY; this.G.onClick?.(e); });
    addEventListener('mouseup', () => this.dragging = false);
    addEventListener('mousemove', e => { if (document.pointerLockElement === el) { this.lookX += e.movementX; this.lookY += e.movementY; } else if (this.dragging && this.G.canLock?.()) { this.lookX += e.clientX - this.lx; this.lookY += e.clientY - this.ly; this.lx = e.clientX; this.ly = e.clientY; } });
    el.addEventListener('wheel', e => { this.wheel += e.deltaY; }, { passive: true });
    // Touch: rechte Bildschirmhälfte = Umschauen
    el.addEventListener('touchstart', e => { for (const t of e.changedTouches) if (t.clientX > innerWidth * 0.4) { this.lookTouch = t.identifier; this.lx = t.clientX; this.ly = t.clientY; } }, { passive: true });
    el.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === this.lookTouch) { this.lookX += (t.clientX - this.lx) * 1.6; this.lookY += (t.clientY - this.ly) * 1.6; this.lx = t.clientX; this.ly = t.clientY; } }, { passive: true });
    el.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === this.lookTouch) this.lookTouch = null; });
  }
  setJoystick(x, y) { this.touchMove.x = x; this.touchMove.y = y; }
  poll() {
    const k = this.keys, K = this.G.settings.keys;
    this.moveX = (k.has(K.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(K.left) || k.has('ArrowLeft') ? 1 : 0) + this.touchMove.x;
    this.moveY = (k.has(K.fwd) || k.has('ArrowUp') ? 1 : 0) - (k.has(K.back) || k.has('ArrowDown') ? 1 : 0) + this.touchMove.y;
    this.run = k.has(K.run) || k.has('ShiftRight') || Math.hypot(this.touchMove.x, this.touchMove.y) > 0.95;
    this.jump = this.pressed.has(K.jump) || this.touchJump; this.touchJump = false;
    // Gamepad (Xbox/PlayStation): linker Stick laufen, rechter Stick kucken, A=Aktioun, X=sprangen, Y=Kompass, B=zeréck, Start=Menü, LB=Kaart, RB=Kamera, LT=lafen
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p) : null;
    if (gp) {
      const dz = v => Math.abs(v) < 0.15 ? 0 : v; const ax = gp.axes;
      this.moveX += dz(ax[0]); this.moveY -= dz(ax[1]); this.lookX += dz(ax[2] ?? 0) * 14; this.lookY += dz(ax[3] ?? 0) * 10;
      const b = i => gp.buttons[i]?.pressed; const prev = this._gp || []; const edge = i => b(i) && !prev[i];
      if (b(6) || b(10)) this.run = true; if (edge(2)) this.jump = true; if (edge(0)) this.touchE = true;
      if (edge(3)) this.G.ui.onKey({ code: K.compass }); if (edge(9)) this.G.ui.onKey({ code: 'Escape' }); if (edge(1) && (this.G.ui.modal || this.G.ui.menuOpen)) this.G.ui.onKey({ code: 'Escape' });
      if (edge(4)) this.G.ui.onKey({ code: K.map }); if (edge(5)) this.pressed.add(K.view);
      this._gp = gp.buttons.map(x => x.pressed); this.gamepad = true;
    }
  }
  endFrame() { this.lookX = 0; this.lookY = 0; this.wheel = 0; this.pressed.clear(); }
  was(code) { return this.pressed.has(code); }
}
