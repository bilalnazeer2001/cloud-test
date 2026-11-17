// The project model (plain JSON), app state, undo/redo and change events.
import { computeWallPolys, detectRooms, insetPoly, polyArea, interiorPoint, pointInPoly, wallLength } from './geometry.js';

export const SLAB = 0.2; // thickness of the slab between storeys (m)

// ---- tiny event bus --------------------------------------------------------
const listeners = {};
export const bus = {
  on(evt, fn) { (listeners[evt] ||= []).push(fn); },
  emit(evt, data) { (listeners[evt] || []).forEach(fn => fn(data)); },
};

let idCounter = Date.now() % 100000;
export const uid = (p = 'i') => p + (++idCounter).toString(36) + Math.floor(Math.random() * 1296).toString(36);

// ---- app (non-saved) state -------------------------------------------------
export const app = {
  project: null,
  levelIdx: 0,
  selection: [],          // [{kind, id, side?}]
  tool: 'select',
  panel: null,            // extra panel shown in the sheet: 'roof' | 'sun' | 'levels' | null
  view: '3d',             // '2d' | '3d' | 'split'
  mode: 'build',          // 'build' | 'walk'
  multi: false,
  showRoof: true,
  paint: { preset: 'paint', color: '#e8dcc8' },
  wallOpts: { thickness: 0.2 },
  doorOpts: { style: 'single', width: 0.9, height: 2.1, sill: 0 },
  windowOpts: { style: 'casement', width: 1.2, height: 1.2, sill: 0.9 },
  markerKind: 'switch',
  clipboard: null,
};

// ---- project ---------------------------------------------------------------
export function newLevel(name, height = 2.8) {
  return { id: uid('L'), name, height, walls: [], openings: [], rooms: [], furniture: [], markers: [], stairs: [], measures: [] };
}

export function newProject(name = 'My house') {
  return {
    app: 'house-builder-3d', version: 1, name,
    settings: { units: 'm', grid: 0.1, showDims: true, showMarkers: true, time: 14, shadows: true, lights: true },
    roof: { type: 'gable', pitch: 28, overhang: 0.4, flip: false, mat: { preset: 'tile', color: '#a8553d' } },
    levels: [newLevel('Ground floor')],
  };
}

/** Fill in anything missing so older/hand-edited files still load. */
export function sanitizeProject(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.levels) || !p.levels.length) throw new Error('This file is not a House Builder project.');
  const base = newProject(p.name || 'My house');
  p.settings = { ...base.settings, ...(p.settings || {}) };
  p.roof = { ...base.roof, ...(p.roof || {}) };
  p.version = 1; p.app = base.app;
  for (const l of p.levels) {
    l.id ||= uid('L'); l.name ||= 'Floor'; l.height = +l.height || 2.8;
    for (const k of ['walls', 'openings', 'rooms', 'furniture', 'markers', 'stairs', 'measures']) if (!Array.isArray(l[k])) l[k] = [];
    l.walls = l.walls.filter(w => w && w.a && w.b && isFinite(w.a.x + w.a.y + w.b.x + w.b.y));
    for (const w of l.walls) { w.id ||= uid('w'); w.thickness = +w.thickness || 0.2; }
    const ids = new Set(l.walls.map(w => w.id));
    l.openings = l.openings.filter(o => ids.has(o.wall));
  }
  return p;
}

export const level = () => app.project.levels[app.levelIdx];
export const settings = () => app.project.settings;

export function levelElevation(idx) {
  let e = 0;
  for (let i = 0; i < idx; i++) e += app.project.levels[i].height + SLAB;
  return e;
}
export const wallHeight = (w, lvl) => (w.height ? w.height : lvl.height);

// ---- derived data (wall outlines, rooms) -----------------------------------
let rev = 0;
const cache = new WeakMap();

export function derived(lvl = level()) {
  const c = cache.get(lvl);
  if (c && c.rev === rev) return c;
  const wallPolys = computeWallPolys(lvl.walls);
  const det = detectRooms(lvl.walls);
  const byId = new Map(lvl.walls.map(w => [w.id, w]));
  const claimed = new Set();
  const rooms = [];
  for (const r of det.rooms) {
    let meta = lvl.rooms.find(m => !claimed.has(m.id) && pointInPoly({ x: m.px, y: m.py }, r.poly));
    if (!meta) {
      let n = lvl.rooms.length + 1;
      while (lvl.rooms.some(m => m.name === 'Room ' + n)) n++;
      meta = { id: uid('r'), name: 'Room ' + n, mat: { preset: 'tile', color: '#e6dfd2' } };
      lvl.rooms.push(meta);
    }
    claimed.add(meta.id);
    const inner = insetPoly(r.poly, r.wallIds.map(id => (byId.get(id)?.thickness || 0.2) / 2));
    const label = interiorPoint(inner);
    meta.px = +label.x.toFixed(3); meta.py = +label.y.toFixed(3);
    rooms.push({ id: meta.id, meta, poly: r.poly, inner, area: Math.abs(polyArea(inner)), label });
  }
  const d = { rev, wallPolys, rooms, outers: det.outers, claimed };
  cache.set(lvl, d);
  return d;
}

/** Forget names/materials of rooms that no longer exist. */
function pruneRooms() {
  for (const l of app.project.levels) { const d = derived(l); l.rooms = l.rooms.filter(m => d.claimed.has(m.id)); }
}

// ---- change + history ------------------------------------------------------
let history = [], hIdx = -1;
let saveTimer = null;

/** Call after any live edit (e.g. while dragging). */
export function changed() { rev++; bus.emit('change'); }

/** Call when an edit is finished: records an undo step and autosaves. */
export function commit() {
  rev++;
  pruneRooms();
  const snap = JSON.stringify(app.project);
  if (history[hIdx] !== snap) {
    history = history.slice(0, hIdx + 1);
    history.push(snap);
    if (history.length > 80) history.shift();
    hIdx = history.length - 1;
  }
  bus.emit('change');
  bus.emit('commit');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => bus.emit('autosave'), 400);
}

/** Settings-style changes that should save but not create undo steps. */
export function touch() { rev++; bus.emit('change'); clearTimeout(saveTimer); saveTimer = setTimeout(() => bus.emit('autosave'), 400); }

function restore(snap) {
  app.project = JSON.parse(snap);
  app.levelIdx = Math.min(app.levelIdx, app.project.levels.length - 1);
  rev++;
  const lvl = level();
  app.selection = app.selection.filter(s => findItem(s, lvl));
  bus.emit('project'); bus.emit('change'); bus.emit('selection'); bus.emit('commit');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => bus.emit('autosave'), 400);
}
export const canUndo = () => hIdx > 0;
export const canRedo = () => hIdx < history.length - 1;
export function undo() { if (canUndo()) restore(history[--hIdx]); }
export function redo() { if (canRedo()) restore(history[++hIdx]); }

export function setProject(p, { keepHistory = false } = {}) {
  app.project = sanitizeProject(p);
  app.levelIdx = 0; app.selection = []; rev++;
  if (!keepHistory) { history = []; hIdx = -1; }
  bus.emit('project');
  commit();
  bus.emit('selection'); bus.emit('level');
}

// ---- selection -------------------------------------------------------------
const LIST = { wall: 'walls', opening: 'openings', furniture: 'furniture', marker: 'markers', stairs: 'stairs', measure: 'measures' };

export function findItem(sel, lvl = level()) {
  if (!sel) return null;
  if (sel.kind === 'roof') return app.project.roof;
  if (sel.kind === 'room') return lvl.rooms.find(r => r.id === sel.id) || null;
  const list = lvl[LIST[sel.kind]];
  return list ? list.find(o => o.id === sel.id) || null : null;
}
export const isSelected = (kind, id) => app.selection.some(s => s.kind === kind && s.id === id);

export function select(sel, { toggle = false } = {}) {
  if (!sel) app.selection = [];
  else if (toggle) {
    const i = app.selection.findIndex(s => s.kind === sel.kind && s.id === sel.id);
    if (i >= 0) app.selection.splice(i, 1); else app.selection.push(sel);
  } else app.selection = Array.isArray(sel) ? sel : [sel];
  bus.emit('selection');
}

export function setTool(tool) {
  app.tool = tool; app.panel = null;
  if (tool !== 'select') app.selection = [];
  bus.emit('tool'); bus.emit('selection');
}
export function setPanel(panel) { app.panel = app.panel === panel ? null : panel; bus.emit('tool'); }
export function setLevel(idx) {
  app.levelIdx = Math.max(0, Math.min(app.project.levels.length - 1, idx));
  app.selection = [];
  bus.emit('level'); bus.emit('change'); bus.emit('selection');
}
export function setView(v) { app.view = v; bus.emit('view'); }

// ---- editing operations ----------------------------------------------------
export function addWall(a, b, opts = {}) {
  const w = {
    id: uid('w'), a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y },
    thickness: opts.thickness || app.wallOpts.thickness, height: opts.height || null,
    matL: opts.matL || { preset: 'paint', color: '#efe9dc' }, matR: opts.matR || { preset: 'paint', color: '#efe9dc' },
  };
  level().walls.push(w);
  return w;
}

export function addOpening(wall, t, type, opts = {}) {
  const o = { id: uid('o'), wall: wall.id, t, type, color: type === 'door' ? '#7a5234' : '#f4f4f0', ...(type === 'door' ? app.doorOpts : app.windowOpts), ...opts };
  clampOpening(o, wall);
  level().openings.push(o);
  return o;
}

export function clampOpening(o, wall, lvl = level()) {
  const len = wallLength(wall);
  o.width = Math.max(0.3, Math.min(o.width, Math.max(0.3, len - 0.2)));
  const half = (o.width / 2 + 0.08) / (len || 1);
  o.t = half >= 0.5 ? 0.5 : Math.max(half, Math.min(1 - half, o.t));
  const h = wallHeight(wall, lvl);
  o.sill = Math.max(0, Math.min(o.sill, h - 0.4));
  o.height = Math.max(0.3, Math.min(o.height, h - o.sill - 0.05));
}

export function removeSelection() {
  const lvl = level();
  let n = 0;
  for (const s of app.selection) {
    const key = LIST[s.kind];
    if (!key) continue;
    const i = lvl[key].findIndex(o => o.id === s.id);
    if (i < 0) continue;
    lvl[key].splice(i, 1); n++;
    if (s.kind === 'wall') lvl.openings = lvl.openings.filter(o => o.wall !== s.id);
  }
  app.selection = [];
  if (n) commit();
  bus.emit('selection');
  return n;
}

export function copySelection() {
  const lvl = level();
  const items = [];
  for (const s of app.selection) {
    const it = findItem(s, lvl);
    if (!it || !LIST[s.kind] || s.kind === 'measure') continue;
    const entry = { kind: s.kind, data: JSON.parse(JSON.stringify(it)) };
    if (s.kind === 'wall') entry.openings = JSON.parse(JSON.stringify(lvl.openings.filter(o => o.wall === it.id)));
    if (s.kind === 'opening') continue; // openings travel with their wall
    items.push(entry);
  }
  if (items.length) app.clipboard = items;
  return items.length;
}

export function pasteClipboard(offset = 0.5) {
  if (!app.clipboard) return 0;
  const lvl = level();
  const sel = [];
  for (const e of app.clipboard) {
    const d = JSON.parse(JSON.stringify(e.data));
    d.id = uid(e.kind[0]);
    if (e.kind === 'wall') {
      d.a.x += offset; d.a.y += offset; d.b.x += offset; d.b.y += offset;
      for (const o of e.openings || []) lvl.openings.push({ ...o, id: uid('o'), wall: d.id });
    } else { d.x += offset; d.y += offset; }
    lvl[LIST[e.kind]].push(d);
    sel.push({ kind: e.kind, id: d.id });
    // so that pasting again keeps stepping away
    if (e.kind === 'wall') { e.data.a.x += offset; e.data.a.y += offset; e.data.b.x += offset; e.data.b.y += offset; }
    else { e.data.x += offset; e.data.y += offset; }
  }
  app.selection = sel;
  commit();
  bus.emit('selection');
  return sel.length;
}

export function duplicateSelection() {
  const keep = app.clipboard;
  const n = copySelection() ? pasteClipboard() : 0;
  app.clipboard = keep;
  return n;
}

export function addLevel() {
  const p = app.project;
  const top = p.levels[p.levels.length - 1];
  const names = ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor'];
  const l = newLevel(names[p.levels.length] || `Floor ${p.levels.length}`, top.height);
  // start the new storey with a copy of the outside walls so it lines up
  const d = derived(top);
  const outerIds = new Set();
  for (const w of top.walls) {
    const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    const n = { x: -(w.b.y - w.a.y), y: w.b.x - w.a.x }; const nl = Math.hypot(n.x, n.y) || 1;
    const p1 = { x: mid.x + n.x / nl * (w.thickness / 2 + 0.05), y: mid.y + n.y / nl * (w.thickness / 2 + 0.05) };
    const p2 = { x: mid.x - n.x / nl * (w.thickness / 2 + 0.05), y: mid.y - n.y / nl * (w.thickness / 2 + 0.05) };
    const in1 = d.rooms.some(r => pointInPoly(p1, r.poly)), in2 = d.rooms.some(r => pointInPoly(p2, r.poly));
    if (in1 !== in2) outerIds.add(w.id);
  }
  for (const w of top.walls) if (outerIds.has(w.id)) l.walls.push({ ...JSON.parse(JSON.stringify(w)), id: uid('w'), height: null });
  p.levels.push(l);
  app.levelIdx = p.levels.length - 1;
  app.selection = [];
  commit();
  bus.emit('level'); bus.emit('selection');
}

export function removeLevel(idx) {
  const p = app.project;
  if (p.levels.length <= 1) return;
  p.levels.splice(idx, 1);
  app.levelIdx = Math.min(app.levelIdx, p.levels.length - 1);
  app.selection = [];
  commit();
  bus.emit('level'); bus.emit('selection');
}
