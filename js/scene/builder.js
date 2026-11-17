// Turns the project model into Three.js meshes.
// Walls, floors and roofs are merged into one mesh per material; each mesh keeps
// a list of "picks" (one per triangle) so taps can be traced back to the model.
import * as THREE from 'three';
import { app, derived, levelElevation, wallHeight, SLAB } from '../state.js';
import { wallLength, wallDir, wallNormal, insetPoly, minAreaRect, pointInPoly, polyArea, dot, sub } from '../geometry.js';
import { getMaterial, matKey } from '../materials.js';
import { FURNITURE } from '../library/furniture.js';
import { MARKERS } from '../library/markers.js';
import { buildParts, box, cyl, ball, disposeGroup } from '../library/parts.js';

// ---------------------------------------------------------------------------
// Accumulator for merged geometry
// ---------------------------------------------------------------------------
class Acc {
  constructor() { this.buckets = new Map(); }
  bucket(key) {
    let b = this.buckets.get(key);
    if (!b) { b = { pos: [], nor: [], uv: [], picks: [] }; this.buckets.set(key, b); }
    return b;
  }
  /** Triangle with explicit normal; flips winding to match. */
  tri(key, a, b, c, n, uva, uvb, uvc, pick) {
    const B = this.bucket(key);
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { [b, c] = [c, b]; [uvb, uvc] = [uvc, uvb]; }
    B.pos.push(...a, ...b, ...c); B.nor.push(...n, ...n, ...n); B.uv.push(...uva, ...uvb, ...uvc); B.picks.push(pick);
  }
  quad(key, a, b, c, d, n, uvs, pick) {
    this.tri(key, a, b, c, n, uvs[0], uvs[1], uvs[2], pick);
    this.tri(key, a, c, d, n, uvs[0], uvs[2], uvs[3], pick);
  }
  /** Flat polygon (with optional holes) at height y, facing up or down. */
  poly(key, outer, holes, y, up, pick) {
    const shape = new THREE.Shape(outer.map(p => new THREE.Vector2(p.x, p.y)));
    for (const h of holes || []) shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p.x, p.y))));
    const g = new THREE.ShapeGeometry(shape);
    const P = g.attributes.position, I = g.index;
    const n = [0, up ? 1 : -1, 0];
    for (let i = 0; i < I.count; i += 3) {
      const v = [I.getX(i), I.getX(i + 1), I.getX(i + 2)].map(k => [P.getX(k), y, P.getY(k)]);
      this.tri(key, v[0], v[1], v[2], n, [v[0][0], v[0][2]], [v[1][0], v[1][2]], [v[2][0], v[2][2]], pick);
    }
    g.dispose();
  }
  /** Vertical extrusion of a polygon from y0 to y1 (sides + top + bottom). */
  prism(key, outer, y0, y1, pick, sideKey = key) {
    for (let i = 0; i < outer.length; i++) {
      const p = outer[i], q = outer[(i + 1) % outer.length];
      const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
      const sign = polyArea(outer) >= 0 ? 1 : -1;
      const n = [dy / l * sign, 0, -dx / l * sign];
      this.quad(sideKey, [p.x, y0, p.y], [q.x, y0, q.y], [q.x, y1, q.y], [p.x, y1, p.y], n, [[0, y0], [l, y0], [l, y1], [0, y1]], pick);
    }
    this.poly(key, outer, null, y1, true, pick);
    this.poly(key, outer, null, y0, false, pick);
  }
  toMeshes(group, { shadows = true } = {}) {
    for (const [key, b] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, getMaterial(key));
      m.castShadow = shadows; m.receiveShadow = true;
      m.userData.picks = b.picks;
      group.add(m);
    }
  }
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------
const CAP = '#ded8cc';

function buildWalls(acc, lvl, elev, d) {
  for (const w of lvl.walls) {
    const wp = d.wallPolys.get(w.id);
    if (!wp) continue;
    const len = wallLength(w), dir = wallDir(w), n = wallNormal(w), h = w.thickness / 2;
    const H = wallHeight(w, lvl);
    const s = p => dot(sub(p, w.a), dir);
    const sL0 = s(wp.aL), sL1 = s(wp.bL), sR0 = s(wp.aR), sR1 = s(wp.bR);
    const kL = matKey(w.matL), kR = matKey(w.matR), kC = matKey({ preset: 'paint', color: CAP });
    const pL = { kind: 'wall', id: w.id, side: 'L' }, pR = { kind: 'wall', id: w.id, side: 'R' };
    const Lp = sv => ({ x: w.a.x + dir.x * sv + n.x * h, y: w.a.y + dir.y * sv + n.y * h });
    const Rp = sv => ({ x: w.a.x + dir.x * sv - n.x * h, y: w.a.y + dir.y * sv - n.y * h });
    const V = (p, y) => [p.x, elev + y, p.y];
    const nL = [n.x, 0, n.y], nR = [-n.x, 0, -n.y];

    // intervals along the wall
    const ops = lvl.openings.filter(o => o.wall === w.id)
      .map(o => ({ o, s0: o.t * len - o.width / 2, s1: o.t * len + o.width / 2 }))
      .sort((a, b) => a.s0 - b.s0);
    const pieces = [];
    let cur = 0;
    for (const { o, s0, s1 } of ops) {
      if (s0 > cur + 1e-4) pieces.push({ s0: cur, s1: s0, y0: 0, y1: H });
      const a0 = Math.max(s0, cur);
      if (o.sill > 0.001) pieces.push({ s0: a0, s1, y0: 0, y1: o.sill, open: 'top' });
      if (o.sill + o.height < H - 0.001) pieces.push({ s0: a0, s1, y0: o.sill + o.height, y1: H, open: 'bottom' });
      pieces.push({ jamb: true, s0: a0, s1, y0: o.sill, y1: o.sill + o.height });
      cur = Math.max(cur, s1);
    }
    if (cur < len - 1e-4 || !pieces.length) pieces.push({ s0: cur, s1: len, y0: 0, y1: H });

    for (const pc of pieces) {
      if (pc.jamb) {
        // reveals at the sides of the opening
        for (const [sv, sg] of [[pc.s0, 1], [pc.s1, -1]]) {
          if (sv <= 1e-4 || sv >= len - 1e-4) continue;
          const nn = [dir.x * sg, 0, dir.y * sg];
          acc.quad(kL, V(Lp(sv), pc.y0), V(Rp(sv), pc.y0), V(Rp(sv), pc.y1), V(Lp(sv), pc.y1), nn,
            [[0, pc.y0], [w.thickness, pc.y0], [w.thickness, pc.y1], [0, pc.y1]], pL);
        }
        continue;
      }
      const l0 = pc.s0 <= 1e-4 ? sL0 : pc.s0, l1 = pc.s1 >= len - 1e-4 ? sL1 : pc.s1;
      const r0 = pc.s0 <= 1e-4 ? sR0 : pc.s0, r1 = pc.s1 >= len - 1e-4 ? sR1 : pc.s1;
      const A = Lp(l0), B = Lp(l1), C = Rp(r1), D = Rp(r0);
      acc.quad(kL, V(A, pc.y0), V(B, pc.y0), V(B, pc.y1), V(A, pc.y1), nL, [[l0, pc.y0], [l1, pc.y0], [l1, pc.y1], [l0, pc.y1]], pL);
      acc.quad(kR, V(D, pc.y0), V(C, pc.y0), V(C, pc.y1), V(D, pc.y1), nR, [[-r0, pc.y0], [-r1, pc.y0], [-r1, pc.y1], [-r0, pc.y1]], pR);
      // top (wall cap or window sill) and bottom (lintel soffit)
      const midA = pc.s0 <= 1e-4 ? w.a : null, midB = pc.s1 >= len - 1e-4 ? w.b : null;
      const top = [A, B, ...(midB ? [midB] : []), C, D, ...(midA ? [midA] : [])];
      if (pc.y1 >= H - 1e-4) acc.poly(kC, top, null, elev + pc.y1, true, pL);
      else acc.poly(kL, top, null, elev + pc.y1, true, pL);
      if (pc.open === 'bottom') acc.poly(kL, top, null, elev + pc.y0, false, pL);
      // end caps on free ends
      if (pc.s0 <= 1e-4 && !wp.joinA) acc.quad(kL, V(A, pc.y0), V(D, pc.y0), V(D, pc.y1), V(A, pc.y1), [-dir.x, 0, -dir.y], [[0, pc.y0], [w.thickness, pc.y0], [w.thickness, pc.y1], [0, pc.y1]], pL);
      if (pc.s1 >= len - 1e-4 && !wp.joinB) acc.quad(kL, V(B, pc.y0), V(C, pc.y0), V(C, pc.y1), V(B, pc.y1), [dir.x, 0, dir.y], [[0, pc.y0], [w.thickness, pc.y0], [w.thickness, pc.y1], [0, pc.y1]], pL);
    }
  }
}

// ---------------------------------------------------------------------------
// Doors and windows (frames, leaves, glass)
// ---------------------------------------------------------------------------
export function openingParts(o, thick) {
  const W = o.width, H = o.height, f = 0.06, fd = Math.min(thick, 0.14);
  const parts = [
    box(f, H, fd, -W / 2 + f / 2, 0, 0, 'main'), box(f, H, fd, W / 2 - f / 2, 0, 0, 'main'),
    box(W, f, fd, 0, H - f, 0, 'main'),
  ];
  if (o.type === 'door') {
    const lw = W - 2 * f, lh = H - f, t = 0.04;
    const leaf = (w, x, ry = 0, color = 'main', glassPanel = false) => {
      const ps = [box(w, lh, t, x, 0, 0, color, { ry })];
      if (glassPanel) ps.push(box(w * 0.6, lh * 0.5, t + 0.01, x, lh * 0.4, 0, '#cfe3ee', { glass: true, ry }));
      return ps;
    };
    if (o.style === 'double') {
      parts.push(...leaf(lw / 2 - 0.005, -lw / 4), ...leaf(lw / 2 - 0.005, lw / 4));
      parts.push(box(0.02, 0.15, 0.06, -0.03, lh * 0.48, 0, '#d5d9dd'), box(0.02, 0.15, 0.06, 0.03, lh * 0.48, 0, '#d5d9dd'));
    } else if (o.style === 'sliding') {
      parts.push(box(lw / 2 + 0.03, lh, 0.03, -lw / 4, 0, -0.025, 'main'), box(lw / 2 * 0.8, lh * 0.85, 0.035, -lw / 4, lh * 0.07, -0.025, '#cfe3ee', { glass: true }));
      parts.push(box(lw / 2 + 0.03, lh, 0.03, lw / 4, 0, 0.025, 'main'), box(lw / 2 * 0.8, lh * 0.85, 0.035, lw / 4, lh * 0.07, 0.025, '#cfe3ee', { glass: true }));
    } else if (o.style === 'french') {
      parts.push(...leaf(lw / 2 - 0.005, -lw / 4, 0, 'main', true), ...leaf(lw / 2 - 0.005, lw / 4, 0, 'main', true));
    } else if (o.style === 'opening') {
      parts.length = 0;
      parts.push(box(W, 0.02, fd, 0, H - 0.02, 0, 'main'));
    } else {
      parts.push(...leaf(lw, 0));
      parts.push(box(0.12, 0.025, 0.07, lw / 2 - 0.12, lh * 0.47, 0, '#d5d9dd'));
    }
  } else {
    parts.push(box(W, f, fd, 0, 0, 0, 'main'));
    const iw = W - 2 * f, ih = H - 2 * f;
    const g = (w, h, x, y, z = 0) => box(w, h, 0.012, x, y, z, '#cfe3ee', { glass: true });
    if (o.style === 'sliding') {
      parts.push(box(0.04, ih, 0.04, -0.02, f, -0.02, 'main'), box(0.04, ih, 0.04, 0.02, f, 0.02, 'main'));
      parts.push(g(iw / 2, ih, -iw / 4, f, -0.02), g(iw / 2, ih, iw / 4, f, 0.02));
    } else if (o.style === 'fixed') {
      parts.push(g(iw, ih, 0, f));
    } else if (o.style === 'grill') {
      parts.push(g(iw, ih, 0, f));
      for (let i = 1; i < Math.round(iw / 0.12); i++) parts.push(box(0.012, ih, 0.012, -iw / 2 + i * iw / Math.round(iw / 0.12), f, fd / 2 - 0.01, '#3a3a3a'));
    } else if (o.style === 'louvre') {
      const k = Math.max(3, Math.round(ih / 0.1));
      for (let i = 0; i < k; i++) parts.push(box(iw, 0.012, 0.08, 0, f + (i + 0.5) * ih / k, 0, '#cfe3ee', { glass: true, rx: 0.5 }));
    } else {
      // casement: two panes with a central mullion
      parts.push(box(0.04, ih, fd * 0.8, 0, f, 0, 'main'));
      parts.push(g(iw / 2 - 0.02, ih, -iw / 4 - 0.01, f), g(iw / 2 - 0.02, ih, iw / 4 + 0.01, f));
    }
  }
  return parts;
}

function buildOpenings(group, lvl, elev) {
  for (const o of lvl.openings) {
    const w = lvl.walls.find(x => x.id === o.wall);
    if (!w) continue;
    const len = wallLength(w), d = wallDir(w);
    const g = buildParts(openingParts(o, w.thickness), { main: o.color });
    g.position.set(w.a.x + d.x * o.t * len, elev + o.sill, w.a.y + d.y * o.t * len);
    g.rotation.y = Math.atan2(-d.y, d.x);
    g.userData.pick = { kind: 'opening', id: o.id };
    group.add(g);
  }
}

// ---------------------------------------------------------------------------
// Floors and slabs
// ---------------------------------------------------------------------------
function stairHoles(lvlBelow) {
  if (!lvlBelow) return [];
  return lvlBelow.stairs.map(s => {
    const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const lx = u * s.w / 2, lz = v * s.len / 2;
      return { x: s.x + lx * c + lz * sn, y: s.y - lx * sn + lz * c };
    });
    return polyArea(pts) < 0 ? pts.reverse() : pts;
  });
}

function buildFloors(acc, lvl, idx, elev, d) {
  const below = idx > 0 ? app.project.levels[idx - 1] : null;
  const holes = stairHoles(below);
  const ownHoles = poly => holes.filter(h => pointInPoly(h.reduce((m, p) => ({ x: m.x + p.x / 4, y: m.y + p.y / 4 }), { x: 0, y: 0 }), poly));
  const slabKey = matKey({ preset: 'concrete', color: '#cfcac0' });
  const ceilKey = matKey({ preset: 'paint', color: '#f7f5f0' });
  for (const outer of d.outers) {
    const thick = 0.1;
    const shell = insetPoly(outer, -thick);
    const hs = ownHoles(shell);
    if (idx === 0) {
      // plinth
      acc.prism(slabKey, shell, -0.3, -0.005, { kind: 'plinth' });
    } else {
      acc.poly(ceilKey, shell, hs, elev - SLAB, false, { kind: 'slab' });
      acc.poly(slabKey, shell, hs, elev - 0.005, true, { kind: 'slab' });
      for (let i = 0; i < shell.length; i++) {
        const p = shell[i], q = shell[(i + 1) % shell.length];
        const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
        acc.quad(slabKey, [p.x, elev - SLAB, p.y], [q.x, elev - SLAB, q.y], [q.x, elev, q.y], [p.x, elev, p.y], [dy / l, 0, -dx / l], [[0, 0], [l, 0], [l, SLAB], [0, SLAB]], { kind: 'slab' });
      }
    }
  }
  for (const r of d.rooms) {
    const hs = ownHoles(r.inner);
    acc.poly(matKey(r.meta.mat), r.inner, hs, elev + 0.005, true, { kind: 'room', id: r.id });
  }
}

// ---------------------------------------------------------------------------
// Stairs
// ---------------------------------------------------------------------------
export function stairParts(s, rise) {
  const n = Math.max(3, Math.round(rise / 0.18));
  const sh = rise / n, sd = s.len / n;
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(box(s.w, sh * (i + 1), sd, 0, 0, -s.len / 2 + sd * (i + 0.5), 'main'));
    parts.push(box(s.w, 0.02, sd + 0.02, 0, sh * (i + 1), -s.len / 2 + sd * (i + 0.5), 'accent'));
  }
  // simple hand rail
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const z = -s.len / 2 + (s.len * i) / steps;
    parts.push(cyl(0.015, 0.9, s.w / 2 - 0.04, rise * (i / steps) + sh * 0.5, z, '#3a3a3a'));
  }
  const ang = Math.atan2(rise, s.len), L = Math.hypot(rise, s.len);
  parts.push(box(0.05, 0.05, L, s.w / 2 - 0.04, rise / 2 + 0.9 + sh * 0.5 - 0.025, 0, 'accent', { rx: -ang }));
  return parts;
}

// ---------------------------------------------------------------------------
// Roof
// ---------------------------------------------------------------------------
export function buildRoof(group) {
  const p = app.project, roof = p.roof;
  const top = p.levels.length - 1, lvl = p.levels[top];
  const d = derived(lvl);
  if (!d.outers.length) return;
  const base = levelElevation(top) + lvl.height;
  const acc = new Acc();
  const k = matKey(roof.mat), under = matKey({ preset: 'paint', color: '#f2efe8' });
  const pick = { kind: 'roof' };
  const wallKey = matKey(lvl.walls[0]?.matR || { preset: 'paint', color: '#efe9dc' });
  const pitch = Math.max(5, Math.min(60, roof.pitch)) * Math.PI / 180;
  const ov = Math.max(0, roof.overhang);
  for (const outer of d.outers) {
    const shell = insetPoly(outer, -0.11);
    if (roof.type === 'flat') {
      const slab = insetPoly(outer, -(0.11 + ov));
      acc.prism(k, slab, base, base + 0.15, pick, under);
      // parapet
      const inner = insetPoly(outer, -0.0);
      for (let i = 0; i < shell.length; i++) {
        const a = shell[i], b = shell[(i + 1) % shell.length], c = inner[(i + 1) % inner.length], e = inner[i];
        acc.prism(wallKey, [a, b, c, e], base + 0.15, base + 0.65, pick);
      }
      continue;
    }
    const r = minAreaRect(shell);
    if (!r) continue;
    let ang = r.angle, hw = r.hw, hd = r.hd;
    if ((hd > hw) !== !!roof.flip) { ang += Math.PI / 2; [hw, hd] = [hd, hw]; }
    const ux = { x: Math.cos(ang), y: Math.sin(ang) }, uy = { x: -Math.sin(ang), y: Math.cos(ang) };
    const P = (u, v, y) => [r.cx + ux.x * u + uy.x * v, y, r.cy + ux.y * u + uy.y * v];
    const rise = hd * Math.tan(pitch);
    const drop = ov * Math.tan(pitch);
    const eave = base - drop, ridge = base + rise;
    const HW = hw + ov, HD = hd + ov;
    const nrm = (a, b, c) => {
      const v1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), v2 = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      const n = v1.cross(v2).normalize(); if (n.y < 0) n.negate(); return [n.x, n.y, n.z];
    };
    const slope = Math.hypot(HD, rise + drop);
    const face = (pts, uvs) => {
      const n = nrm(pts[0], pts[1], pts[2]);
      for (let i = 1; i + 1 < pts.length; i++) {
        acc.tri(k, pts[0], pts[i], pts[i + 1], n, uvs[0], uvs[i], uvs[i + 1], pick);
        const dn = p => [p[0] - n[0] * 0.04, p[1] - n[1] * 0.04, p[2] - n[2] * 0.04];
        acc.tri(under, dn(pts[0]), dn(pts[i]), dn(pts[i + 1]), [-n[0], -n[1], -n[2]], uvs[0], uvs[i], uvs[i + 1], pick);
      }
    };
    if (roof.type === 'hip') {
      const rl = Math.max(0, hw - hd); // half ridge length
      face([P(-HW, -HD, eave), P(HW, -HD, eave), P(rl, 0, ridge), P(-rl, 0, ridge)], [[-HW, 0], [HW, 0], [rl, slope], [-rl, slope]]);
      face([P(HW, HD, eave), P(-HW, HD, eave), P(-rl, 0, ridge), P(rl, 0, ridge)], [[HW, 0], [-HW, 0], [-rl, slope], [rl, slope]]);
      face([P(HW, -HD, eave), P(HW, HD, eave), P(rl, 0, ridge)], [[-HD, 0], [HD, 0], [0, slope]]);
      face([P(-HW, HD, eave), P(-HW, -HD, eave), P(-rl, 0, ridge)], [[-HD, 0], [HD, 0], [0, slope]]);
    } else {
      face([P(-HW, -HD, eave), P(HW, -HD, eave), P(HW, 0, ridge), P(-HW, 0, ridge)], [[-HW, 0], [HW, 0], [HW, slope], [-HW, slope]]);
      face([P(HW, HD, eave), P(-HW, HD, eave), P(-HW, 0, ridge), P(HW, 0, ridge)], [[HW, 0], [-HW, 0], [-HW, slope], [HW, slope]]);
      // gable end walls
      for (const sgn of [-1, 1]) {
        const n = [ux.x * sgn, 0, ux.y * sgn];
        acc.tri(wallKey, P(sgn * hw, -hd, base), P(sgn * hw, hd, base), P(sgn * hw, 0, ridge), n, [-hd, 0], [hd, 0], [0, rise], pick);
        acc.tri(wallKey, P(sgn * hw, -hd, base), P(sgn * hw, hd, base), P(sgn * hw, 0, ridge), [-n[0], 0, -n[2]], [-hd, 0], [hd, 0], [0, rise], pick);
      }
    }
  }
  acc.toMeshes(group);
}

// ---------------------------------------------------------------------------
// Furniture, markers, stairs (cached per item)
// ---------------------------------------------------------------------------
const itemCache = new Map(); // id -> {key, group}
export function furnitureGroup(f) {
  const def = FURNITURE[f.type];
  if (!def) return null;
  const key = JSON.stringify([f.type, f.w, f.h, f.d, f.main, f.accent]);
  let c = itemCache.get(f.id);
  if (!c || c.key !== key) {
    if (c) disposeGroup(c.group);
    const g = buildParts(def.parts(f.w, f.h, f.d), { main: f.main || def.main, accent: f.accent || def.accent });
    c = { key, group: g };
    itemCache.set(f.id, c);
  }
  return c.group;
}

function markerGroup(m) {
  const def = MARKERS[m.kind] || MARKERS.switch;
  const key = 'm' + m.kind;
  let c = itemCache.get(key);
  if (!c) {
    c = { key, group: buildParts([box(0.12, 0.12, 0.04, 0, -0.06, 0, def.color, { glow: true }), ball(0.035, 0, 0.07, 0, def.color, { glow: true })]) };
    itemCache.set(key, c);
  }
  return c.group.clone();
}

export function clearItemCache() { for (const c of itemCache.values()) disposeGroup(c.group); itemCache.clear(); }

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------
/** Build everything for level idx. Returns {group, lights: [{x,y,z,power}]} */
export function buildLevel(idx, opts = {}) {
  const lvl = app.project.levels[idx];
  const elev = levelElevation(idx);
  const d = derived(lvl);
  const group = new THREE.Group();
  group.userData.level = idx;
  const acc = new Acc();
  buildWalls(acc, lvl, elev, d);
  buildFloors(acc, lvl, idx, elev, d);
  acc.toMeshes(group, opts);
  buildOpenings(group, lvl, elev);
  const lights = [];
  for (const f of lvl.furniture) {
    const src = furnitureGroup(f);
    if (!src) continue;
    const g = src.clone();
    g.position.set(f.x, elev + (f.elev || 0), f.y);
    g.rotation.y = f.rot || 0;
    g.userData.pick = { kind: 'furniture', id: f.id };
    group.add(g);
    const def = FURNITURE[f.type];
    if (def.light) lights.push({ x: f.x, y: elev + (f.elev || 0) + f.h + def.light.y * (f.h / def.size[1]), z: f.y, power: def.light.power });
  }
  const rise = lvl.height + SLAB;
  for (const s of lvl.stairs) {
    const g = buildParts(stairParts(s, rise), { main: s.color || '#d9c7a8', accent: '#8a5a3c' });
    g.position.set(s.x, elev, s.y); g.rotation.y = s.rot || 0;
    g.userData.pick = { kind: 'stairs', id: s.id };
    group.add(g);
  }
  if (app.project.settings.showMarkers) {
    for (const m of lvl.markers) {
      const g = markerGroup(m);
      g.position.set(m.x, elev + (m.elev ?? 1), m.y);
      g.userData.pick = { kind: 'marker', id: m.id };
      group.add(g);
    }
  }
  return { group, lights };
}

export function disposeLevelGroup(group) {
  group.traverse(o => {
    // furniture/marker clones share cached geometry - only dispose merged level meshes
    if (o.isMesh && o.userData.picks) o.geometry.dispose();
    else if (o.isMesh && o.parent && o.parent.userData.pick && (o.parent.userData.pick.kind === 'opening' || o.parent.userData.pick.kind === 'stairs')) o.geometry.dispose();
  });
}
