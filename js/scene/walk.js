// First-person walkthrough: virtual joystick + drag-to-look on touch,
// WASD / arrow keys + mouse drag on desktop. Walls block you, doors let you through,
// stairs carry you between floors.
import { app, derived, levelElevation, wallHeight, SLAB } from '../state.js';
import { projectOnSegment, wallLength, wallDir, planToLocal, clamp } from '../geometry.js';
import { FURNITURE } from '../library/furniture.js';

const EYE = 1.6, RADIUS = 0.22, SPEED = 1.6;

export class Walker {
  constructor(camera, dom, onChange) {
    this.camera = camera; this.dom = dom; this.onChange = onChange;
    this.active = false;
    this.pos = { x: 0, y: 0 }; this.level = 0; this.y = 0;
    this.yaw = 0; this.pitch = 0;
    this.move = { x: 0, y: 0 };     // joystick (-1..1)
    this.keys = new Set();
    this.look = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => {
      if (!this.active || e.target.closest?.('input,textarea,select')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    const el = this.dom;
    el.addEventListener('pointerdown', e => {
      if (!this.active) return;
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!this.active || !this.look || this.look.id !== e.pointerId) return;
      this.yaw -= (e.clientX - this.look.x) * 0.005;
      this.pitch = clamp(this.pitch - (e.clientY - this.look.y) * 0.004, -1.2, 1.2);
      this.look.x = e.clientX; this.look.y = e.clientY;
    });
    const up = e => { if (this.look && this.look.id === e.pointerId) this.look = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  start(fallback, levelIdx) {
    this.active = true;
    this.level = levelIdx;
    const rooms = derived(app.project.levels[levelIdx]).rooms.slice().sort((a, b) => b.area - a.area);
    const p = rooms[0]?.label || fallback;
    this.pos = { x: p.x, y: p.y };
    this.y = levelElevation(levelIdx);
    this.yaw = 0; this.pitch = -0.05;
    this.update(0);
  }
  stop() { this.active = false; this.keys.clear(); this.move = { x: 0, y: 0 }; }

  update(dt) {
    if (!this.active) return;
    let fx = this.move.y, sx = this.move.x; // forward, strafe
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) fx += 1;
    if (k.has('s') || k.has('arrowdown')) fx -= 1;
    if (k.has('a')) sx -= 1;
    if (k.has('d')) sx += 1;
    if (k.has('arrowleft') || k.has('q')) this.yaw += dt * 1.8;
    if (k.has('arrowright') || k.has('e')) this.yaw -= dt * 1.8;
    const mag = Math.hypot(fx, sx);
    if (mag > 1) { fx /= mag; sx /= mag; }
    const speed = SPEED * (k.has('shift') ? 2 : 1);
    // camera looks along (-sin yaw, -cos yaw) in plan
    const fwd = { x: -Math.sin(this.yaw), y: -Math.cos(this.yaw) }, right = { x: Math.cos(this.yaw), y: -Math.sin(this.yaw) };
    const step = { x: (fwd.x * fx + right.x * sx) * speed * dt, y: (fwd.y * fx + right.y * sx) * speed * dt };
    // sub-steps keep collision stable
    const n = Math.max(1, Math.ceil(Math.hypot(step.x, step.y) / 0.08));
    for (let i = 0; i < n; i++) {
      this.pos.x += step.x / n; this.pos.y += step.y / n;
      this._stairs();
      this._collide();
    }
    this._stairs();
    const c = this.camera;
    c.position.set(this.pos.x, this.y + EYE, this.pos.y);
    c.rotation.order = 'YXZ';
    c.rotation.set(this.pitch, this.yaw, 0);
  }

  /** Follow stairs up or down and switch level. */
  _stairs() {
    const levels = app.project.levels;
    let onStairs = false;
    for (const L of [this.level, this.level - 1]) {
      if (L < 0 || L >= levels.length - 1 + 1) continue;
      const lvl = levels[L];
      if (!lvl) continue;
      for (const s of lvl.stairs) {
        const p = planToLocal(s, this.pos);
        if (Math.abs(p.x) <= s.w / 2 && Math.abs(p.z) <= s.len / 2 + 0.05) {
          if (L + 1 >= levels.length) continue; // nowhere to go
          const prog = clamp((p.z + s.len / 2) / s.len, 0, 1);
          this.y = levelElevation(L) + prog * (lvl.height + SLAB);
          this.level = prog > 0.5 ? L + 1 : L;
          onStairs = true;
        }
      }
    }
    if (!onStairs) this.y = levelElevation(this.level);
  }

  _collide() {
    const lvl = app.project.levels[this.level];
    if (!lvl) return;
    for (const w of lvl.walls) {
      const len = wallLength(w);
      if (len < 0.01) continue;
      const pr = projectOnSegment(this.pos, w.a, w.b);
      const lim = w.thickness / 2 + RADIUS;
      if (pr.d >= lim) continue;
      // inside a door opening? let the walker through
      const s = pr.t * len;
      const door = lvl.openings.some(o => o.wall === w.id && o.sill < 0.1 && o.height > 1.7 &&
        s > o.t * len - o.width / 2 + RADIUS * 0.6 && s < o.t * len + o.width / 2 - RADIUS * 0.6);
      if (door) continue;
      if (wallHeight(w, lvl) < 1.0) continue; // low parapets can be stepped over... almost
      let nx = this.pos.x - pr.x, ny = this.pos.y - pr.y, d = Math.hypot(nx, ny);
      if (d < 1e-6) { const dir = wallDir(w); nx = -dir.y; ny = dir.x; d = 1; }
      this.pos.x = pr.x + (nx / d) * lim; this.pos.y = pr.y + (ny / d) * lim;
    }
    for (const f of lvl.furniture) {
      const def = FURNITURE[f.type];
      if (!def || def.mount === 'ceiling' || def.mount === 'wall' || f.h < 0.35 || (f.elev || 0) > 1.2) continue;
      const p = planToLocal(f, this.pos);
      const hx = f.w / 2 + RADIUS, hz = f.d / 2 + RADIUS;
      if (Math.abs(p.x) >= hx || Math.abs(p.z) >= hz) continue;
      // push out along the shallowest axis
      const ox = hx - Math.abs(p.x), oz = hz - Math.abs(p.z);
      if (ox < oz) p.x = Math.sign(p.x || 1) * hx; else p.z = Math.sign(p.z || 1) * hz;
      const c = Math.cos(f.rot || 0), sn = Math.sin(f.rot || 0);
      this.pos.x = f.x + p.x * c + p.z * sn; this.pos.y = f.y - p.x * sn + p.z * c;
    }
  }
}
