// Pure 2D maths used by the plan view and the 3D builder.
// Plan coordinates: x to the right, y "down the screen" (y maps to z in 3D). Units are metres.

export const EPS = 1e-6;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const snapNum = (v, step) => (step > 0 ? Math.round(v / step) * step : v);

export function wallLength(w) { return dist(w.a, w.b); }
export function wallDir(w) {
  const l = wallLength(w) || 1;
  return { x: (w.b.x - w.a.x) / l, y: (w.b.y - w.a.y) / l };
}
/** "Left" normal of a wall (side L). */
export function wallNormal(w) { const d = wallDir(w); return { x: -d.y, y: d.x }; }

/** Closest point on segment ab to p. Returns {t, x, y, d}. */
export function projectOnSegment(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  let t = l2 < EPS ? 0 : ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2;
  t = clamp(t, 0, 1);
  const x = a.x + vx * t, y = a.y + vy * t;
  return { t, x, y, d: Math.hypot(p.x - x, p.y - y) };
}

/** Intersection of infinite lines p + s*u and q + r*v. Null when parallel. */
export function lineIntersect(p, u, q, v) {
  const c = cross(u, v);
  if (Math.abs(c) < 1e-9) return null;
  const s = cross(sub(q, p), v) / c;
  return { x: p.x + u.x * s, y: p.y + u.y * s, s };
}

/** Proper segment intersection (returns params t,u in 0..1) or null. */
export function segIntersect(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { t, u, x: a.x + r.x * t, y: a.y + r.y * t };
}

export function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

export function polyCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < EPS) return { x: poly[0].x, y: poly[0].y };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A point guaranteed to be inside the polygon (good spot for a label). */
export function interiorPoint(poly) {
  const c = polyCentroid(poly);
  if (pointInPoly(c, poly)) return c;
  const xs = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a.y > c.y) !== (b.y > c.y)) xs.push(a.x + ((c.y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  xs.sort((m, n) => m - n);
  let best = null, bw = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > bw) { bw = xs[i + 1] - xs[i]; best = (xs[i] + xs[i + 1]) / 2; }
  }
  return best === null ? c : { x: best, y: c.y };
}

/**
 * Offset a polygon. For a polygon with positive area, positive distances move
 * edges towards the inside. dists may be a number or one value per edge.
 */
export function insetPoly(poly, dists) {
  const n = poly.length;
  const sign = polyArea(poly) >= 0 ? 1 : -1;
  const d = i => (typeof dists === 'number' ? dists : dists[i]) * sign;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const l = dist(p, q) || 1;
    const u = { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
    const nrm = { x: -u.y, y: u.x };
    lines.push({ p: { x: p.x + nrm.x * d(i), y: p.y + nrm.y * d(i) }, u, nrm, d: d(i) });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n], cur = lines[i];
    const hit = lineIntersect(prev.p, prev.u, cur.p, cur.u);
    const fallback = { x: poly[i].x + (prev.nrm.x * prev.d + cur.nrm.x * cur.d) / 2, y: poly[i].y + (prev.nrm.y * prev.d + cur.nrm.y * cur.d) / 2 };
    const lim = (Math.abs(prev.d) + Math.abs(cur.d)) * 3 + 0.01;
    out.push(hit && dist(hit, poly[i]) < lim ? { x: hit.x, y: hit.y } : fallback);
  }
  return out;
}

export function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const h = [];
  for (const q of p) { while (h.length >= 2 && cross(sub(h[h.length - 1], h[h.length - 2]), sub(q, h[h.length - 1])) <= 0) h.pop(); h.push(q); }
  const lower = h.length + 1;
  for (let i = p.length - 2; i >= 0; i--) {
    const q = p[i];
    while (h.length >= lower && cross(sub(h[h.length - 1], h[h.length - 2]), sub(q, h[h.length - 1])) <= 0) h.pop();
    h.push(q);
  }
  h.pop();
  return h;
}

/** Smallest rotated rectangle around points: {cx, cy, angle, hw, hd} (hw along angle). */
export function minAreaRect(pts) {
  const hull = convexHull(pts);
  if (hull.length < 2) return null;
  let best = null;
  const tryAngle = ang => {
    const c = Math.cos(ang), s = Math.sin(ang);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * c + p.y * s, v = -p.x * s + p.y * c;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area - 1e-6) {
      const mu = (minU + maxU) / 2, mv = (minV + maxV) / 2;
      best = { area, angle: ang, hw: (maxU - minU) / 2, hd: (maxV - minV) / 2, cx: mu * c - mv * s, cy: mu * s + mv * c };
    }
  };
  tryAngle(0);
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    tryAngle(Math.atan2(b.y - a.y, b.x - a.x));
  }
  return best;
}

// ---------------------------------------------------------------------------
// Wall joins
// ---------------------------------------------------------------------------

/**
 * Works out the plan outline of every wall, mitring corners where walls meet.
 * Returns Map(wallId -> {aL,aR,bL,bR, joinA, joinB, poly}).
 */
export function computeWallPolys(walls) {
  const out = new Map();
  const arms = [];
  for (const w of walls) {
    const len = wallLength(w);
    if (len < 1e-4) continue;
    const d = wallDir(w), n = { x: -d.y, y: d.x }, h = w.thickness / 2;
    const o = {
      aL: { x: w.a.x + n.x * h, y: w.a.y + n.y * h }, aR: { x: w.a.x - n.x * h, y: w.a.y - n.y * h },
      bL: { x: w.b.x + n.x * h, y: w.b.y + n.y * h }, bR: { x: w.b.x - n.x * h, y: w.b.y - n.y * h },
      joinA: false, joinB: false,
    };
    out.set(w.id, o);
    arms.push({ w, o, end: 'a', p: w.a, u: d, t: w.thickness });
    arms.push({ w, o, end: 'b', p: w.b, u: { x: -d.x, y: -d.y }, t: w.thickness });
  }
  // group arms into nodes
  const used = new Array(arms.length).fill(false);
  for (let i = 0; i < arms.length; i++) {
    if (used[i]) continue;
    const node = [arms[i]]; used[i] = true;
    for (let j = i + 1; j < arms.length; j++) {
      if (!used[j] && dist(arms[i].p, arms[j].p) < 0.02) { node.push(arms[j]); used[j] = true; }
    }
    if (node.length < 2) continue;
    node.sort((m, k) => Math.atan2(m.u.y, m.u.x) - Math.atan2(k.u.y, k.u.x));
    const c = arms[i].p;
    for (let k = 0; k < node.length; k++) {
      const A = node[k], B = node[(k + 1) % node.length];
      if (A === B) continue;
      A.o[A.end === 'a' ? 'joinA' : 'joinB'] = true;
      B.o[B.end === 'a' ? 'joinA' : 'joinB'] = true;
      if (Math.abs(cross(A.u, B.u)) < 0.08) continue; // parallel: keep square ends
      const pa = { x: -A.u.y, y: A.u.x }, pb = { x: -B.u.y, y: B.u.x };
      const hit = lineIntersect(
        { x: c.x + pa.x * A.t / 2, y: c.y + pa.y * A.t / 2 }, A.u,
        { x: c.x - pb.x * B.t / 2, y: c.y - pb.y * B.t / 2 }, B.u);
      if (!hit || dist(hit, c) > Math.max(A.t, B.t) * 2.5) continue;
      const P = { x: hit.x, y: hit.y };
      A.o[A.end === 'a' ? 'aL' : 'bR'] = P; // CCW-side corner of arm A
      B.o[B.end === 'a' ? 'aR' : 'bL'] = P; // CW-side corner of arm B
    }
  }
  for (const w of walls) {
    const o = out.get(w.id);
    if (o) o.poly = [o.aL, o.bL, { x: w.b.x, y: w.b.y }, o.bR, o.aR, { x: w.a.x, y: w.a.y }];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Room detection (faces of the wall graph)
// ---------------------------------------------------------------------------

/**
 * Finds closed loops of walls.
 * Returns { rooms: [{poly, wallIds}], outers: [poly] } - polys have positive area.
 */
export function detectRooms(walls) {
  const segs = walls.filter(w => wallLength(w) > 0.01);
  const nodes = [];
  const nodeAt = p => {
    for (let i = 0; i < nodes.length; i++) if (dist(nodes[i], p) < 0.03) return i;
    nodes.push({ x: p.x, y: p.y }); return nodes.length - 1;
  };
  const splits = segs.map(w => [{ t: 0, n: nodeAt(w.a) }, { t: 1, n: nodeAt(w.b) }]);
  for (let i = 0; i < segs.length; i++) {
    for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const A = segs[i], B = segs[j];
      // endpoints of A touching the body of B
      for (const end of ['a', 'b']) {
        const pr = projectOnSegment(A[end], B.a, B.b);
        if (pr.d < B.thickness / 2 + 0.03 && pr.t > 1e-3 && pr.t < 1 - 1e-3 &&
            dist(A[end], B.a) > 0.03 && dist(A[end], B.b) > 0.03) {
          // only when wall A really ends at B (not merely passing near it)
          splits[j].push({ t: pr.t, n: nodeAt(A[end]) });
        }
      }
      if (j > i) {
        const x = segIntersect(A.a, A.b, B.a, B.b);
        if (x && x.t > 0.01 && x.t < 0.99 && x.u > 0.01 && x.u < 0.99) {
          const n = nodeAt(x);
          splits[i].push({ t: x.t, n }); splits[j].push({ t: x.u, n });
        }
      }
    }
  }
  const adj = new Map(); // node -> Map(neighbour -> wallId)
  const link = (u, v, id) => {
    if (u === v) return;
    if (!adj.has(u)) adj.set(u, new Map());
    if (!adj.has(v)) adj.set(v, new Map());
    if (!adj.get(u).has(v)) { adj.get(u).set(v, id); adj.get(v).set(u, id); }
  };
  segs.forEach((w, i) => {
    const s = splits[i].sort((m, n) => m.t - n.t);
    for (let k = 0; k + 1 < s.length; k++) link(s[k].n, s[k + 1].n, w.id);
  });
  // strip dead ends
  let changed = true;
  while (changed) {
    changed = false;
    for (const [u, m] of adj) {
      if (m.size === 1) { const v = m.keys().next().value; adj.get(v).delete(u); adj.delete(u); changed = true; }
      else if (m.size === 0) { adj.delete(u); changed = true; }
    }
  }
  const order = new Map();
  for (const [u, m] of adj) {
    const list = [...m.keys()].sort((p, q) =>
      Math.atan2(nodes[p].y - nodes[u].y, nodes[p].x - nodes[u].x) - Math.atan2(nodes[q].y - nodes[u].y, nodes[q].x - nodes[u].x));
    order.set(u, list);
  }
  const seen = new Set();
  const rooms = [], outers = [];
  for (const [u0, list] of order) {
    for (const v0 of list) {
      if (seen.has(u0 + '>' + v0)) continue;
      const loop = [], ids = [];
      let u = u0, v = v0, guard = 0;
      while (!seen.has(u + '>' + v) && guard++ < 10000) {
        seen.add(u + '>' + v);
        loop.push(u); ids.push(adj.get(u).get(v));
        const l = order.get(v);
        const k = l.indexOf(u);
        const nx = l[(k - 1 + l.length) % l.length];
        u = v; v = nx;
      }
      if (loop.length < 3) continue;
      const poly = loop.map(i => ({ x: nodes[i].x, y: nodes[i].y }));
      const area = polyArea(poly);
      if (area > 0.2) rooms.push({ poly, wallIds: ids });
      else if (area < -0.2) outers.push(poly.slice().reverse());
    }
  }
  return { rooms, outers };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export function fmtLen(m, units = 'm') {
  if (units === 'ft') {
    const totalIn = Math.round(m / 0.0254);
    return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
  }
  return `${m.toFixed(2)} m`;
}
export function fmtArea(m2, units = 'm') {
  return units === 'ft' ? `${(m2 * 10.7639).toFixed(0)} ft²` : `${m2.toFixed(1)} m²`;
}
export function fmtBoth(m) { return `${fmtLen(m, 'm')}  ·  ${fmtLen(m, 'ft')}`; }

/** Rotate a local furniture point into plan coordinates (matches THREE rotation.y). */
export function localToPlan(item, lx, lz) {
  const c = Math.cos(item.rot || 0), s = Math.sin(item.rot || 0);
  return { x: item.x + lx * c + lz * s, y: item.y - lx * s + lz * c };
}
export function planToLocal(item, p) {
  const c = Math.cos(item.rot || 0), s = Math.sin(item.rot || 0);
  const dx = p.x - item.x, dy = p.y - item.y;
  return { x: dx * c - dy * s, z: dx * s + dy * c };
}
