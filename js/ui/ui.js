// User interface: top bar, bottom toolbar, the options sheet, menus and dialogs.
import {
  app, bus, level, settings, commit, touch, select, setTool, setPanel, setLevel, setView, findItem,
  undo, redo, canUndo, canRedo, removeSelection, copySelection, pasteClipboard, duplicateSelection,
  addLevel, removeLevel, clampOpening, derived, setProject,
} from '../state.js';
import { h, numField, textField, rangeField, chips, toggle } from './dom.js';
import { PRESETS, SWATCHES } from '../materials.js';
import { FURNITURE, CATEGORIES } from '../library/furniture.js';
import { MARKERS } from '../library/markers.js';
import { addFurniture, rotateSelection, toast, levelCenter } from '../tools/actions.js';
import { planCenter, fitPlan, resetWallChain } from '../tools/plan2d.js';
import { wallLength, wallDir, fmtLen, fmtArea, dist } from '../geometry.js';
import { startWalk, stopWalk, getWalker, screenshot, frameHouse, reframeOnNextBuild, updateLighting, exportRoot, showAllForExport, requestRender } from '../scene/view3d.js';
import { exportJSON, importJSONFile, exportPNG, exportGLB } from '../storage/storage.js';
import { TEMPLATES } from '../storage/templates.js';
import { createJoystick } from './joystick.js';

const $ = s => document.querySelector(s);
const PI = Math.PI;

const TOOLS = [
  { id: 'select', label: 'Select', icon: '👆' },
  { id: 'wall', label: 'Walls', icon: '🧱', also: ['room'] },
  { id: 'door', label: 'Doors', icon: '🚪', also: ['window'] },
  { id: 'furniture', label: 'Furnish', icon: '🛋️' },
  { id: 'paint', label: 'Paint', icon: '🎨' },
  { id: 'measure', label: 'Measure', icon: '📏' },
  { id: 'more', label: 'More', icon: '⋯', also: ['marker', 'stairs'] },
];
const PLAN_ONLY = new Set(['wall', 'room', 'measure']);

let furnCat = CATEGORIES[0];
let sheetOpen = true;

export function initUI() {
  buildTopbar();
  buildToolbar();
  buildWalkOverlay();
  ['selection', 'tool', 'level', 'project', 'commit'].forEach(e => bus.on(e, renderAll));
  bus.on('view', renderTopbar);
  bus.on('mode', renderMode);
  bus.on('toast', ({ msg, ms }) => showToast(msg, ms));
  bus.on('saved', () => { const s = $('#saveState'); if (s) { s.textContent = 'Saved'; s.classList.add('flash'); setTimeout(() => s.classList.remove('flash'), 600); } });
  window.addEventListener('keydown', onKey);
  renderAll();
}

function renderAll() { renderTopbar(); renderToolbar(); renderSheet(); }

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------
function buildTopbar() {
  const bar = $('#topbar');
  bar.append(
    h('button', { class: 'icon', id: 'menuBtn', title: 'Menu', 'aria-label': 'Menu', onclick: openMenu }, '☰'),
    h('div', { class: 'title' }, h('span', { id: 'projName' }), h('small', { id: 'saveState' }, 'Saved')),
    h('button', { class: 'icon', id: 'undoBtn', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: () => undo() }, '↶'),
    h('button', { class: 'icon', id: 'redoBtn', title: 'Redo (Ctrl+Y)', 'aria-label': 'Redo', onclick: () => redo() }, '↷'),
    h('div', { class: 'seg', id: 'viewSeg' }, ['2d', 'split', '3d'].map(v =>
      h('button', { 'data-v': v, onclick: () => setView(v) }, v === 'split' ? '⇅' : v.toUpperCase()))),
    h('button', { class: 'levelBtn', id: 'levelBtn', onclick: openLevels }),
  );
}
function renderTopbar() {
  $('#projName').textContent = app.project.name;
  $('#undoBtn').disabled = !canUndo();
  $('#redoBtn').disabled = !canRedo();
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === app.view));
  document.body.dataset.view = app.view;
  $('#levelBtn').textContent = `${app.project.levels[app.levelIdx].name} ▾`;
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------
function buildToolbar() {
  const bar = $('#toolbar');
  for (const t of TOOLS) {
    bar.append(h('button', { 'data-tool': t.id, onclick: () => pickTool(t.id) }, h('span', { class: 'ti' }, t.icon), h('span', { class: 'tl' }, t.label)));
  }
}
function toolGroup(tool) { return TOOLS.find(t => t.id === tool || (t.also || []).includes(tool))?.id || 'select'; }
function renderToolbar() {
  const g = app.panel ? 'more' : toolGroup(app.tool);
  document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('on', b.dataset.tool === g));
}

export function pickTool(id) {
  resetWallChain();
  if (id === 'more') { setTool('more'); sheetOpen = true; renderAll(); return; }
  const current = toolGroup(app.tool);
  if (current === id && !app.panel && app.tool !== 'more') { sheetOpen = !sheetOpen; renderSheet(); return; }
  sheetOpen = true;
  setTool(id === 'door' && app.tool === 'window' ? 'window' : id);
  if (PLAN_ONLY.has(app.tool) && app.view === '3d') { setView('split'); toast('Drawing works in the 2D plan – switched to split view'); }
}

// ---------------------------------------------------------------------------
// The sheet (tool options / selection properties)
// ---------------------------------------------------------------------------
function renderSheet() {
  const sheet = $('#sheet');
  sheet.innerHTML = '';
  sheet.classList.toggle('closed', !sheetOpen);
  if (app.mode === 'walk') return;
  let body;
  if (app.panel) body = panelContent(app.panel);
  else if (app.selection.length) body = selectionContent();
  else body = toolContent(app.tool);
  const head = h('div', { class: 'sheet-head', onclick: () => { sheetOpen = !sheetOpen; renderSheet(); } },
    h('span', { class: 'grip' }), h('b', {}, body.title || ''), h('span', { class: 'hint' }, sheetOpen ? '' : 'tap to open'));
  sheet.append(head, h('div', { class: 'sheet-body' }, body.nodes));
}

function hint(text) { return h('p', { class: 'hint-text' }, text); }

function toolContent(tool) {
  switch (tool) {
    case 'select': return {
      title: 'Select',
      nodes: [hint('Tap something to select it, drag to move it. One finger pans the plan; two fingers zoom. In 3D: drag to orbit, pinch to zoom, two fingers to pan.'),
        h('div', { class: 'row' },
          toggle('Multi-select', app.multi, v => { app.multi = v; renderSheet(); }),
          app.clipboard ? h('button', { class: 'btn', onclick: () => pasteClipboard() }, '📋 Paste') : null,
          h('button', { class: 'btn', onclick: () => { fitPlan(); frameHouse(); } }, '⤢ Fit view'))],
    };
    case 'wall': case 'room': return {
      title: 'Walls',
      nodes: [
        chips([{ value: 'wall', label: 'Draw walls', icon: '✏️' }, { value: 'room', label: 'Rectangle room', icon: '▭' }], tool, v => setTool(v)),
        hint(tool === 'wall' ? 'Drag in the plan to draw a wall, or tap the start then tap the end. Walls snap to the grid and to other walls so corners join.' : 'Drag a rectangle in the plan to create four walls at once.'),
        h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Thickness'),
          chips([0.1, 0.15, 0.2, 0.23, 0.3].map(v => ({ value: v, label: `${Math.round(v * 100)} cm` })), app.wallOpts.thickness, v => { app.wallOpts.thickness = v; renderSheet(); }, 'small')),
        h('div', { class: 'row' }, numField('Floor height', level().height, v => { level().height = v; commit(); }, { min: 2, max: 6, step: 0.1 })),
      ],
    };
    case 'door': case 'window': {
      const o = tool === 'door' ? app.doorOpts : app.windowOpts;
      const styles = tool === 'door' ? DOOR_STYLES : WINDOW_STYLES;
      return {
        title: 'Doors & windows',
        nodes: [
          chips([{ value: 'door', label: 'Door', icon: '🚪' }, { value: 'window', label: 'Window', icon: '🪟' }], tool, v => setTool(v)),
          hint(`Tap a wall to add a ${tool}. Drag it along the wall to move it.`),
          h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Style'), chips(styles, o.style, v => { o.style = v; renderSheet(); }, 'small')),
          h('div', { class: 'row fields' },
            numField('Width', o.width, v => { o.width = v; }, { min: 0.3, max: 5 }),
            numField('Height', o.height, v => { o.height = v; }, { min: 0.3, max: 3 }),
            tool === 'window' ? numField('Sill', o.sill, v => { o.sill = v; }, { min: 0, max: 2.5 }) : null),
        ],
      };
    }
    case 'furniture': return { title: 'Furniture & appliances', nodes: furnitureLibrary() };
    case 'paint': return { title: 'Paint & materials', nodes: [hint('Pick a finish, then tap a wall side, floor, roof, door, window or furniture. Each side of a wall is painted separately.'), ...paintPicker()] };
    case 'measure': return {
      title: 'Measure',
      nodes: [hint('Drag in the plan to measure a distance. Tap a measurement with Select to move or delete it.'),
        h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Units'), unitsChips(),
          level().measures.length ? h('button', { class: 'btn', onclick: () => { level().measures = []; commit(); } }, 'Clear all') : null),
        h('div', { class: 'row' }, toggle('Show wall lengths', settings().showDims, v => { settings().showDims = v; touch(); }))],
    };
    case 'marker': return { title: 'Electrical & plumbing points', nodes: markerPicker() };
    case 'stairs': return { title: 'Stairs', nodes: [hint('Tap in the plan (or on the floor in 3D) to place a staircase. It rises to the floor above. Rotate it so the arrow points up the stairs.'),
      app.levelIdx === app.project.levels.length - 1 ? h('button', { class: 'btn', onclick: () => addLevel() }, '➕ Add a floor above') : null] };
    case 'more': default: return { title: 'More tools', nodes: [moreGrid()] };
  }
}

const DOOR_STYLES = [{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'french', label: 'Glass' }, { value: 'sliding', label: 'Sliding' }, { value: 'opening', label: 'Opening' }];
const WINDOW_STYLES = [{ value: 'casement', label: 'Casement' }, { value: 'sliding', label: 'Sliding' }, { value: 'fixed', label: 'Fixed' }, { value: 'grill', label: 'Grill' }, { value: 'louvre', label: 'Louvre' }];

function unitsChips() {
  return chips([{ value: 'm', label: 'Metres' }, { value: 'ft', label: 'Feet' }], settings().units, v => { settings().units = v; touch(); renderSheet(); }, 'small');
}

function moreGrid() {
  const item = (icon, label, fn) => h('button', { class: 'tile', onclick: fn }, h('span', { class: 'ti' }, icon), h('span', {}, label));
  return h('div', { class: 'tiles' },
    item('🪜', 'Stairs', () => setTool('stairs')),
    item('🔌', 'Electrical & plumbing', () => setTool('marker')),
    item('🏠', 'Roof', () => { setTool('select'); setPanel('roof'); }),
    item('🏢', 'Floors', openLevels),
    item('☀️', 'Sun & lights', () => { setTool('select'); setPanel('sun'); }),
    item('🚶', 'Walk through', enterWalk),
    item('📷', 'Screenshot', doScreenshot),
    item('💾', 'Save / open', openMenu),
  );
}

function furnitureLibrary() {
  const items = Object.entries(FURNITURE).filter(([, d]) => d.cat === furnCat);
  return [
    h('div', { class: 'tabs' }, CATEGORIES.map(c => h('button', { class: c === furnCat ? 'on' : '', onclick: () => { furnCat = c; renderSheet(); } }, c))),
    h('div', { class: 'lib' }, items.map(([key, d]) =>
      h('button', { class: 'libitem', onclick: () => placeFurniture(key) },
        h('span', { class: 'sw', style: { background: d.main } }),
        h('span', { class: 'nm' }, d.name),
        h('small', {}, `${Math.round(d.size[0] * 100)}×${Math.round(d.size[2] * 100)}`)))),
    hint('Tap an item to add it, then drag it into place.'),
  ];
}

function placeFurniture(key) {
  let at = app.view === '3d' ? levelCenter() : planCenter();
  const f = addFurniture(key, at);
  if (f) { setTool('select'); select({ kind: 'furniture', id: f.id }); toast(`${FURNITURE[key].name} added – drag to move`); }
}

function markerPicker() {
  const groups = {};
  for (const [k, d] of Object.entries(MARKERS)) (groups[d.group] ||= []).push([k, d]);
  return [
    hint('Choose a point type, then tap in the plan (or on a wall in 3D) to place it. Near a wall it sticks to the wall.'),
    ...Object.entries(groups).map(([g, list]) => h('div', { class: 'mgroup' }, h('span', { class: 'lbl' }, g),
      h('div', { class: 'chips small' }, list.map(([k, d]) => h('button', { class: 'chip' + (app.markerKind === k ? ' on' : ''), onclick: () => { app.markerKind = k; renderSheet(); } },
        h('span', { class: 'dot', style: { background: d.color } }, d.icon), d.name))))),
    h('div', { class: 'row' }, toggle('Show points layer', settings().showMarkers, v => { settings().showMarkers = v; touch(); }),
      h('button', { class: 'btn', onclick: exportMarkerList }, '📄 Points list (CSV)')),
  ];
}

function exportMarkerList() {
  const rows = [['Floor', 'Type', 'Label', 'X (m)', 'Y (m)', 'Height (m)']];
  for (const l of app.project.levels) for (const m of l.markers) rows.push([l.name, MARKERS[m.kind]?.name || m.kind, m.label || '', m.x.toFixed(2), m.y.toFixed(2), (+m.elev).toFixed(2)]);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  import('../storage/storage.js').then(s => s.download(new Blob([csv], { type: 'text/csv' }), 'points.csv'));
}

// ---- paint -----------------------------------------------------------------
function matEditor(mat, onChange, { presets = true } = {}) {
  const color = h('input', { type: 'color', value: mat.color || '#ffffff' });
  color.addEventListener('input', () => onChange({ ...mat, color: color.value }, false));
  color.addEventListener('change', () => onChange({ ...mat, color: color.value }, true));
  return h('div', { class: 'mat' },
    presets ? chips(Object.entries(PRESETS).map(([k, p]) => ({ value: k, label: p.name })), mat.preset || 'paint',
      v => onChange({ preset: v, color: mat.preset === v ? mat.color : PRESETS[v].color }, true), 'small') : null,
    h('div', { class: 'swatches' },
      SWATCHES.map(c => h('button', { class: 'swatch' + (c === mat.color ? ' on' : ''), style: { background: c }, title: c, onclick: () => onChange({ ...mat, color: c }, true) })),
      h('label', { class: 'swatch custom', title: 'Custom colour' }, '+', color)));
}

function paintPicker() {
  return [matEditor(app.paint, (m) => { app.paint = m; renderSheet(); })];
}

// ---------------------------------------------------------------------------
// Selection properties
// ---------------------------------------------------------------------------
function selectionContent() {
  const lvl = level();
  const sel = app.selection;
  const first = sel[0];
  const it = findItem(first, lvl);
  if (!it) { app.selection = []; return toolContent(app.tool); }
  const actions = h('div', { class: 'row actions' },
    first.kind !== 'roof' && first.kind !== 'room' ? h('button', { class: 'btn danger', onclick: () => removeSelection() }, '🗑 Delete') : null,
    !['roof', 'room', 'opening', 'measure'].includes(first.kind) ? h('button', { class: 'btn', onclick: () => duplicateSelection() }, '⧉ Duplicate') : null,
    !['roof', 'room', 'opening', 'measure'].includes(first.kind) ? h('button', { class: 'btn', onclick: () => { const n = copySelection(); toast(n ? `Copied ${n}` : 'Nothing to copy'); renderSheet(); } }, '⎘ Copy') : null,
    app.clipboard ? h('button', { class: 'btn', onclick: () => pasteClipboard() }, '📋 Paste') : null,
    h('button', { class: 'btn', onclick: () => select(null) }, '✕ Done'),
  );
  if (sel.length > 1) {
    return { title: `${sel.length} items selected`, nodes: [
      hint('Drag any selected item to move them together.'),
      toggle('Multi-select (tap to add/remove)', app.multi, v => { app.multi = v; renderSheet(); }),
      sel.some(s => s.kind === 'furniture' || s.kind === 'stairs') ? rotateRow() : null, actions] };
  }
  const multi = toggle('Multi-select', app.multi, v => { app.multi = v; renderSheet(); });
  switch (first.kind) {
    case 'wall': return { title: 'Wall', nodes: [wallProps(it, first), actions, multi] };
    case 'opening': return { title: it.type === 'door' ? 'Door' : 'Window', nodes: [openingProps(it), actions] };
    case 'room': return { title: 'Room', nodes: [roomProps(it), actions] };
    case 'furniture': return { title: FURNITURE[it.type]?.name || 'Item', nodes: [furnitureProps(it), actions, multi] };
    case 'marker': return { title: MARKERS[it.kind]?.name || 'Point', nodes: [markerProps(it), actions] };
    case 'stairs': return { title: 'Stairs', nodes: [stairProps(it), actions] };
    case 'measure': return { title: 'Measurement', nodes: [h('p', { class: 'big' }, `${fmtLen(dist(it.a, it.b), 'm')}  =  ${fmtLen(dist(it.a, it.b), 'ft')}`), actions] };
    case 'roof': return { title: 'Roof', nodes: panelContent('roof').nodes };
  }
  return { title: '', nodes: [actions] };
}

function rotateRow() {
  return h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Rotate'),
    [-90, -15, 15, 90].map(d => h('button', { class: 'btn', onclick: () => rotateSelection(d * PI / 180) }, `${d > 0 ? '+' : ''}${d}°`)));
}

function wallProps(w, s) {
  const len = wallLength(w);
  const side = s.side || 'L';
  return h('div', {},
    h('div', { class: 'row fields' },
      numField('Length', len, v => { const d = wallDir(w); w.b = { x: w.a.x + d.x * v, y: w.a.y + d.y * v }; lvlOpeningsClamp(w); commit(); }, { min: 0.1, max: 100 }),
      numField('Thickness', w.thickness, v => { w.thickness = v; commit(); }, { min: 0.05, max: 1 }),
      numField('Height', w.height || level().height, v => { w.height = Math.abs(v - level().height) < 0.001 ? null : v; lvlOpeningsClamp(w); commit(); }, { min: 0.3, max: 8 })),
    h('p', { class: 'hint-text' }, `${fmtLen(len, 'm')} · ${fmtLen(len, 'ft')}. Drag the round handles to resize; connected walls follow.`),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Colour of'),
      chips([{ value: 'L', label: 'Side A' }, { value: 'R', label: 'Side B' }], side, v => { app.selection = [{ ...s, side: v }]; renderSheet(); }, 'small')),
    matEditor(w[side === 'R' ? 'matR' : 'matL'], (m, done) => { w[side === 'R' ? 'matR' : 'matL'] = m; done ? commit() : touch(); if (done) renderSheet(); }),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { w.matL = { ...w[side === 'R' ? 'matR' : 'matL'] }; w.matR = { ...w.matL }; commit(); } }, 'Same colour both sides')));
}
function lvlOpeningsClamp(w) { for (const o of level().openings) if (o.wall === w.id) clampOpening(o, w); }

function openingProps(o) {
  const w = level().walls.find(x => x.id === o.wall);
  const up = () => { if (w) clampOpening(o, w); commit(); };
  const styles = o.type === 'door' ? DOOR_STYLES : WINDOW_STYLES;
  return h('div', {},
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Style'), chips(styles, o.style, v => { o.style = v; up(); }, 'small')),
    h('div', { class: 'row fields' },
      numField('Width', o.width, v => { o.width = v; up(); }, { min: 0.3, max: 5 }),
      numField('Height', o.height, v => { o.height = v; up(); }, { min: 0.3, max: 4 }),
      numField(o.type === 'door' ? 'Raise' : 'Sill', o.sill, v => { o.sill = v; up(); }, { min: 0, max: 3 })),
    o.type === 'door' ? h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { o.flip = !o.flip; commit(); } }, '⇅ Swing side'),
      h('button', { class: 'btn', onclick: () => { o.hinge = !o.hinge; commit(); } }, '⇆ Hinge side')) : null,
    h('span', { class: 'lbl' }, 'Frame colour'),
    matEditor({ preset: 'paint', color: o.color }, (m, done) => { o.color = m.color; done ? commit() : touch(); if (done) renderSheet(); }, { presets: false }));
}

function roomProps(r) {
  const d = derived().rooms.find(x => x.id === r.id);
  return h('div', {},
    h('div', { class: 'row fields' }, textField('Name', r.name, v => { r.name = v || r.name; commit(); })),
    h('p', { class: 'big' }, d ? `${fmtArea(d.area, 'm')}  ·  ${fmtArea(d.area, 'ft')}` : ''),
    h('span', { class: 'lbl' }, 'Floor finish'),
    matEditor(r.mat || { preset: 'tile', color: '#e6dfd2' }, (m, done) => { r.mat = m; done ? commit() : touch(); if (done) renderSheet(); }),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Quick names'),
      chips(['Living room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining', 'Study', 'Store', 'Balcony'].map(n => ({ value: n, label: n })), r.name, v => { r.name = v; commit(); }, 'small')));
}

function furnitureProps(f) {
  const def = FURNITURE[f.type];
  return h('div', {},
    rotateRow(),
    h('div', { class: 'row fields' },
      numField('Width', f.w, v => { f.w = v; commit(); }, { min: 0.05, max: 10 }),
      numField('Depth', f.d, v => { f.d = v; commit(); }, { min: 0.02, max: 10 }),
      numField('Height', f.h, v => { f.h = v; commit(); }, { min: 0.01, max: 6 }),
      numField('Above floor', f.elev || 0, v => { f.elev = v; commit(); }, { min: 0, max: 6 })),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { f.w = def.size[0]; f.h = def.size[1]; f.d = def.size[2]; commit(); } }, '↺ Default size'),
      h('button', { class: 'btn', onclick: () => { for (const k of ['w', 'h', 'd']) f[k] = +(f[k] * 1.1).toFixed(3); commit(); } }, '＋ 10%'),
      h('button', { class: 'btn', onclick: () => { for (const k of ['w', 'h', 'd']) f[k] = +(f[k] / 1.1).toFixed(3); commit(); } }, '－ 10%')),
    h('span', { class: 'lbl' }, 'Main colour'),
    matEditor({ preset: 'paint', color: f.main || def.main }, (m, done) => { f.main = m.color; done ? commit() : touch(); if (done) renderSheet(); }, { presets: false }),
    def.accent ? h('span', { class: 'lbl' }, 'Second colour') : null,
    def.accent ? matEditor({ preset: 'paint', color: f.accent || def.accent }, (m, done) => { f.accent = m.color; done ? commit() : touch(); if (done) renderSheet(); }, { presets: false }) : null);
}

function markerProps(m) {
  return h('div', {},
    h('div', { class: 'row fields' },
      textField('Label', m.label, v => { m.label = v; commit(); }),
      numField('Height', m.elev ?? 1, v => { m.elev = v; commit(); }, { min: 0, max: 6 })),
    h('div', { class: 'chips small' }, Object.entries(MARKERS).map(([k, d]) => h('button', { class: 'chip' + (m.kind === k ? ' on' : ''), onclick: () => { m.kind = k; commit(); } },
      h('span', { class: 'dot', style: { background: d.color } }, d.icon), d.name))));
}

function stairProps(s) {
  return h('div', {},
    rotateRow(),
    h('div', { class: 'row fields' },
      numField('Width', s.w, v => { s.w = v; commit(); }, { min: 0.6, max: 3 }),
      numField('Length', s.len, v => { s.len = v; commit(); }, { min: 1.5, max: 8 })),
    hint(`Rises ${(level().height + 0.2).toFixed(2)} m to the floor above. Steps are worked out automatically.`),
    h('span', { class: 'lbl' }, 'Colour'),
    matEditor({ preset: 'paint', color: s.color || '#d9c7a8' }, (m, done) => { s.color = m.color; done ? commit() : touch(); if (done) renderSheet(); }, { presets: false }));
}

// ---------------------------------------------------------------------------
// Panels: roof, sun
// ---------------------------------------------------------------------------
function panelContent(p) {
  if (p === 'roof') {
    const r = app.project.roof;
    return { title: 'Roof', nodes: [
      chips([{ value: 'gable', label: 'Gable' }, { value: 'hip', label: 'Hip' }, { value: 'flat', label: 'Flat' }], r.type, v => { r.type = v; commit(); }),
      h('div', { class: 'row' }, toggle('Show roof', app.showRoof, v => { app.showRoof = v; touch(); renderSheet(); }),
        r.type !== 'flat' ? h('button', { class: 'btn', onclick: () => { r.flip = !r.flip; commit(); } }, '↻ Turn ridge') : null),
      r.type !== 'flat' ? rangeField('Pitch', r.pitch, v => { r.pitch = v; touch(); }, { min: 10, max: 50, step: 1, fmt: v => `${v}°`, onChange: () => commit() }) : null,
      rangeField('Overhang', r.overhang, v => { r.overhang = v; touch(); }, { min: 0, max: 1.2, step: 0.05, fmt: v => `${(+v).toFixed(2)} m`, onChange: () => commit() }),
      hint('The roof is built over the top floor automatically. It shows when you are on the top floor.'),
      h('span', { class: 'lbl' }, 'Roof finish'),
      matEditor(r.mat, (m, done) => { r.mat = m; done ? commit() : touch(); if (done) renderSheet(); }),
      h('button', { class: 'btn', onclick: () => setPanel(null) }, '✕ Close')] };
  }
  if (p === 'sun') {
    const s = settings();
    const fmt = v => { const hh = Math.floor(v), mm = Math.round((v - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
    return { title: 'Sun & lights', nodes: [
      rangeField('Time of day', s.time, v => { s.time = v; updateLighting(); }, { min: 5, max: 22, step: 0.25, fmt, onChange: () => touch() }),
      h('div', { class: 'row' },
        chips([{ value: 7, label: '🌅 Morning' }, { value: 13, label: '☀️ Noon' }, { value: 18, label: '🌇 Evening' }, { value: 21, label: '🌙 Night' }], s.time, v => { s.time = v; updateLighting(); touch(); renderSheet(); }, 'small')),
      h('div', { class: 'row' },
        toggle('Shadows', s.shadows, v => { s.shadows = v; touch(); }),
        toggle('Lamps at night', s.lights, v => { s.lights = v; updateLighting(); touch(); })),
      hint('Shadows look nicer but use more battery. Turn them off if your phone gets slow.'),
      h('button', { class: 'btn', onclick: () => setPanel(null) }, '✕ Close')] };
  }
  return { title: '', nodes: [] };
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------
function openLevels() {
  const list = () => h('div', { class: 'levels' }, app.project.levels.map((l, i) => h('div', { class: 'levelrow' + (i === app.levelIdx ? ' on' : '') },
    h('button', { class: 'btn grow', onclick: () => { setLevel(i); closeModal(); } }, `${i === app.levelIdx ? '● ' : ''}${l.name}`),
    h('button', { class: 'btn', title: 'Rename', onclick: () => { const n = prompt('Floor name', l.name); if (n) { l.name = n; commit(); refresh(); } } }, '✎'),
    h('button', { class: 'btn', title: 'Height', onclick: () => { const n = parseFloat(prompt('Floor-to-ceiling height in metres', l.height)); if (n >= 2 && n <= 8) { l.height = n; commit(); refresh(); } } }, `${l.height} m`),
    app.project.levels.length > 1 ? h('button', { class: 'btn danger', title: 'Delete floor', onclick: () => { if (confirm(`Delete "${l.name}" and everything on it?`)) { removeLevel(i); refresh(); } } }, '🗑') : null)));
  let box;
  const refresh = () => { box.querySelector('.levels').replaceWith(list()); };
  box = modal('Floors', [
    list(),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => { addLevel(); closeModal(); toast('New floor added (outside walls copied). Add stairs from the floor below.'); } }, '➕ Add floor above'),
      toggle('Show all floors', !!app.showAllLevels, v => { app.showAllLevels = v; touch(); })),
    hint('Floors above the one you are editing are hidden so you can see inside. The roof sits on the top floor.'),
  ]);
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function openMenu() {
  const s = settings();
  modal('Menu', [
    h('div', { class: 'row fields' }, textField('Project name', app.project.name, v => { app.project.name = v || 'My house'; commit(); })),
    h('h4', {}, 'Start from'),
    h('div', { class: 'tiles' }, TEMPLATES.map(t => h('button', { class: 'tile', onclick: () => {
      if (confirm(`Replace the current project with "${t.name}"? (Export it first if you want to keep it.)`)) { setProject(t.make()); closeModal(); setTimeout(() => { fitPlan(); reframeOnNextBuild(); }, 50); }
    } }, h('b', {}, t.name), h('small', {}, t.desc)))),
    h('h4', {}, 'Save & share'),
    h('div', { class: 'tiles' },
      h('button', { class: 'tile', onclick: () => { exportJSON(); } }, h('span', { class: 'ti' }, '💾'), h('span', {}, 'Export project (.json)')),
      h('button', { class: 'tile', onclick: async () => { try { if (await importJSONFile()) { closeModal(); toast('Project loaded'); setTimeout(() => { fitPlan(); reframeOnNextBuild(); }, 50); } } catch (e) { alert(e.message); } } }, h('span', { class: 'ti' }, '📂'), h('span', {}, 'Open project (.json)')),
      h('button', { class: 'tile', onclick: () => { closeModal(); doScreenshot(); } }, h('span', { class: 'ti' }, '📷'), h('span', {}, 'Screenshot (.png)')),
      h('button', { class: 'tile', onclick: async () => { closeModal(); toast('Preparing 3D model…'); try { showAllForExport(true); await exportGLB(exportRoot()); } catch (e) { console.error(e); alert('GLB export failed: ' + e.message); } finally { showAllForExport(false); } } }, h('span', { class: 'ti' }, '🧊'), h('span', {}, '3D model (.glb)'))),
    hint('Your work is saved automatically in this browser. Export a .json file to keep a backup or move it to another device.'),
    h('h4', {}, 'Settings'),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Units'), unitsChips()),
    h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Grid snap'),
      chips([0.05, 0.1, 0.25, 0.5].map(v => ({ value: v, label: `${v * 100} cm` })), s.grid, v => { s.grid = v; touch(); closeModal(); openMenu(); }, 'small')),
    h('div', { class: 'row wrap' },
      toggle('Wall lengths', s.showDims, v => { s.showDims = v; touch(); }),
      toggle('Points layer', s.showMarkers, v => { s.showMarkers = v; touch(); }),
      toggle('Shadows', s.shadows, v => { s.shadows = v; touch(); })),
    h('h4', {}, 'Help'),
    h('div', { class: 'help' }, helpText()),
  ]);
}

function helpText() {
  return h('ul', {},
    h('li', {}, 'Bottom bar: pick a tool. Tap the same tool again to hide/show its options.'),
    h('li', {}, 'Plan (2D): one finger draws or moves, two fingers zoom and pan. Mouse: wheel zooms, right-drag pans.'),
    h('li', {}, '3D: one finger orbits, pinch zooms, two fingers pan. Tap to select; drag a selected item to move it.'),
    h('li', {}, 'Keyboard: Ctrl+Z / Ctrl+Y undo/redo, Delete, Ctrl+C / Ctrl+V, Ctrl+D duplicate, R rotate, Esc cancel.'),
    h('li', {}, 'Walk: joystick (or WASD / arrows) to move, drag to look around. Doors let you through, walls do not.'));
}

let modalEl = null;
function modal(title, nodes) {
  closeModal();
  modalEl = h('div', { class: 'modal-wrap', onclick: e => { if (e.target === modalEl) closeModal(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('b', {}, title), h('button', { class: 'icon', 'aria-label': 'Close', onclick: closeModal }, '✕')),
      h('div', { class: 'modal-body' }, nodes)));
  document.body.appendChild(modalEl);
  return modalEl;
}
export function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }

// ---------------------------------------------------------------------------
// Walk mode, screenshot, toast, keys
// ---------------------------------------------------------------------------
function buildWalkOverlay() {
  const ov = $('#walkOverlay');
  ov.append(
    h('button', { class: 'btn exit', onclick: () => stopWalk() }, '✕ Exit walk'),
    h('div', { class: 'walk-hint' }, 'Move: joystick or WASD · Look: drag'),
    h('button', { class: 'btn photo', onclick: doScreenshot }, '📷'));
  createJoystick(ov, (x, y) => { const w = getWalker(); w.move.x = x; w.move.y = y; });
}
function enterWalk() {
  setTool('select');
  if (app.view === '2d') setView('3d');
  startWalk();
}
function renderMode() {
  document.body.classList.toggle('walking', app.mode === 'walk');
  if (app.mode === 'walk' && app.view !== '3d') setView('3d');
  renderSheet();
}

function doScreenshot() {
  let url;
  if (app.view === '2d') url = document.querySelector('#plan canvas').toDataURL('image/png');
  else url = screenshot(2);
  exportPNG(url);
  toast('Screenshot saved');
}

let toastTimer;
function showToast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function onKey(e) {
  if (e.target.closest('input,textarea,select')) return;
  if (app.mode === 'walk') { if (e.key === 'Escape') stopWalk(); return; }
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (ctrl && k === 'c') { if (copySelection()) toast('Copied'); renderSheet(); }
  else if (ctrl && k === 'v') { e.preventDefault(); pasteClipboard(); }
  else if (ctrl && k === 'd') { e.preventDefault(); duplicateSelection(); }
  else if (ctrl && k === 'a') { e.preventDefault(); const l = level(); select([...l.walls.map(w => ({ kind: 'wall', id: w.id })), ...l.furniture.map(f => ({ kind: 'furniture', id: f.id }))]); }
  else if (k === 'delete' || k === 'backspace') { if (app.selection.length) { e.preventDefault(); removeSelection(); } }
  else if (k === 'escape') { closeModal(); resetWallChain(); if (app.selection.length) select(null); else if (app.panel) setPanel(null); else setTool('select'); }
  else if (k === 'r' && !ctrl) rotateSelection(e.shiftKey ? -PI / 2 : PI / 2);
  else if (!ctrl && !e.altKey) {
    const map = { v: 'select', w: 'wall', d: 'door', f: 'furniture', p: 'paint', m: 'measure' };
    if (map[k]) pickTool(map[k]);
  }
}
export { requestRender };
