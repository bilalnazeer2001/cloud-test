// Editing actions shared by the 2D plan and the 3D view.
import { app, bus, level, commit, select, findItem, addOpening, uid, settings, levelElevation, derived } from '../state.js';
import { FURNITURE, defaultElev } from '../library/furniture.js';
import { MARKERS } from '../library/markers.js';
import { projectOnSegment, wallLength, wallNormal, wallDir, snapNum, dist } from '../geometry.js';

export function toast(msg, ms = 2200) { bus.emit('toast', { msg, ms }); }

/** Paint whatever was tapped with the current paint (app.paint). */
export function applyPaint(pick) {
  if (!pick) return false;
  const lvl = level();
  const m = { preset: app.paint.preset, color: app.paint.color };
  const it = findItem(pick, lvl);
  if (pick.kind === 'wall' && it) it[pick.side === 'R' ? 'matR' : 'matL'] = m;
  else if (pick.kind === 'room' && it) it.mat = m;
  else if (pick.kind === 'roof') app.project.roof.mat = m;
  else if (pick.kind === 'opening' && it) it.color = m.color;
  else if (pick.kind === 'furniture' && it) it.main = m.color;
  else if (pick.kind === 'stairs' && it) it.color = m.color;
  else return false;
  commit();
  return true;
}

/** Sample the material of a tapped thing into the paint brush ("eyedropper"). */
export function samplePaint(pick) {
  const it = findItem(pick, level());
  let m = null;
  if (pick?.kind === 'wall' && it) m = it[pick.side === 'R' ? 'matR' : 'matL'];
  else if (pick?.kind === 'room' && it) m = it.mat;
  else if (pick?.kind === 'roof') m = app.project.roof.mat;
  else if (it && (it.main || it.color)) m = { preset: 'paint', color: it.main || it.color };
  if (m) { app.paint = { ...m }; bus.emit('tool'); }
}

/** Find the wall nearest to plan point p within maxDist metres. */
export function nearestWall(p, maxDist = 0.5, lvl = level()) {
  let best = null;
  for (const w of lvl.walls) {
    const pr = projectOnSegment(p, w.a, w.b);
    const lim = w.thickness / 2 + maxDist;
    if (pr.d < lim && (!best || pr.d < best.pr.d)) best = { wall: w, pr };
  }
  return best;
}

export function placeOpeningAt(p, type, maxDist = 0.4) {
  const hit = nearestWall(p, maxDist);
  if (!hit) { toast(`Tap on a wall to add a ${type}`); return null; }
  const o = addOpening(hit.wall, hit.pr.t, type);
  commit();
  select({ kind: 'opening', id: o.id });
  return o;
}

/** Snap a wall-mounted item against the nearest wall face. Returns true if snapped. */
export function snapToWall(f, p, maxDist = 0.6) {
  const hit = nearestWall(p, maxDist);
  if (!hit) return false;
  const w = hit.wall, n = wallNormal(w);
  const side = (p.x - hit.pr.x) * n.x + (p.y - hit.pr.y) * n.y >= 0 ? 1 : -1;
  const off = w.thickness / 2 + f.d / 2 + 0.005;
  const len = wallLength(w), dir = wallDir(w);
  const s = Math.max(f.w / 2, Math.min(len - f.w / 2, hit.pr.t * len));
  f.x = w.a.x + dir.x * s + n.x * side * off;
  f.y = w.a.y + dir.y * s + n.y * side * off;
  // local +z (front) should point away from the wall: front = (sin rot, cos rot) in plan
  f.rot = Math.atan2(n.x * side, n.y * side);
  return true;
}

export function addFurniture(type, at) {
  const def = FURNITURE[type];
  if (!def) return null;
  const lvl = level();
  const f = {
    id: uid('f'), type, x: at.x, y: at.y, rot: 0,
    w: def.size[0], h: def.size[1], d: def.size[2],
    elev: defaultElev(def, lvl.height),
    main: def.main, accent: def.accent || null,
  };
  if (def.mount === 'wall') snapToWall(f, at, 3);
  lvl.furniture.push(f);
  commit();
  select({ kind: 'furniture', id: f.id });
  return f;
}

export function addMarker(kind, p, elev) {
  const def = MARKERS[kind] || MARKERS.switch;
  const m = { id: uid('m'), kind, x: p.x, y: p.y, elev: elev ?? def.elev, label: '' };
  // stick to a wall face when close to one
  const hit = nearestWall(p, 0.35);
  if (hit && elev === undefined) {
    const n = wallNormal(hit.wall);
    const side = (p.x - hit.pr.x) * n.x + (p.y - hit.pr.y) * n.y >= 0 ? 1 : -1;
    m.x = hit.pr.x + n.x * side * (hit.wall.thickness / 2 + 0.02);
    m.y = hit.pr.y + n.y * side * (hit.wall.thickness / 2 + 0.02);
  }
  level().markers.push(m);
  commit();
  select({ kind: 'marker', id: m.id });
  return m;
}

export function addStairs(p) {
  if (app.levelIdx === app.project.levels.length - 1) toast('Tip: add a floor above (Floors menu) so the stairs lead somewhere.', 3500);
  const g = settings().grid || 0.1;
  const s = { id: uid('s'), x: snapNum(p.x, g), y: snapNum(p.y, g), rot: 0, w: 1.0, len: 3.6, color: '#d9c7a8' };
  level().stairs.push(s);
  commit();
  select({ kind: 'stairs', id: s.id });
  return s;
}

export function addMeasure(a, b) {
  if (dist(a, b) < 0.05) return null;
  const m = { id: uid('d'), a: { ...a }, b: { ...b } };
  level().measures.push(m);
  commit();
  return m;
}

/** Rotate selected furniture/stairs by an angle (radians). */
export function rotateSelection(delta) {
  const lvl = level();
  let n = 0;
  for (const s of app.selection) {
    const it = findItem(s, lvl);
    if (it && (s.kind === 'furniture' || s.kind === 'stairs')) { it.rot = ((it.rot || 0) + delta) % (Math.PI * 2); n++; }
  }
  if (n) commit();
}

/** Centre of the current level's rooms (to drop new items somewhere sensible). */
export function levelCenter() {
  const d = derived(level());
  if (d.rooms.length) {
    let x = 0, y = 0;
    for (const r of d.rooms) { x += r.label.x; y += r.label.y; }
    return { x: x / d.rooms.length, y: y / d.rooms.length };
  }
  return { x: 0, y: 0 };
}
export { levelElevation };
