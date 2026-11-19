// App start-up: load the saved project (or a template), create the views and
// connect 3D taps/drags to the editing tools.
import { app, bus, setProject, select, level, levelElevation, findItem, addOpening, commit, changed, settings } from './state.js';
import { initView3D, view3d } from './scene/view3d.js';
import { initPlan, fitPlan } from './tools/plan2d.js';
import { initUI } from './ui/ui.js';
import { applyPaint, addMarker, addStairs, snapToWall, toast, samplePaint } from './tools/actions.js';
import { autosave, loadAutosave } from './storage/storage.js';
import { template2BHK } from './storage/templates.js';
import { FURNITURE } from './library/furniture.js';
import { projectOnSegment, snapNum } from './geometry.js';

function start() {
  const saved = loadAutosave();
  setProject(saved || template2BHK());
  app.view = window.innerWidth >= 900 ? 'split' : '3d';
  initPlan(document.getElementById('plan'));
  initView3D(document.getElementById('view3d'));
  initUI();
  bus.on('autosave', autosave);
  bus.emit('view');
  setTimeout(() => fitPlan(), 60);
  if (!saved) setTimeout(() => toast('Welcome! This starter house is a template – change anything, or open the ☰ menu to start fresh.', 5000), 400);
  wire3D();
  window.__houseBuilder = { app }; // handy for debugging in the browser console
}

const SELECTABLE = new Set(['wall', 'opening', 'furniture', 'room', 'stairs', 'marker', 'roof']);

function wire3D() {
  view3d.onTap = (pick, hit, e) => {
    const tool = app.tool;
    const elev = levelElevation(app.levelIdx);
    if (tool === 'paint') {
      if (!pick || !applyPaint(pick)) toast('Tap a wall, floor, roof, door, window or furniture');
      return;
    }
    if ((tool === 'door' || tool === 'window') && hit) {
      if (pick?.kind !== 'wall') { toast(`Tap on a wall to add a ${tool}`); return; }
      const w = level().walls.find(x => x.id === pick.id);
      if (!w) { toast('Switch to the floor that wall is on first'); return; }
      const pr = projectOnSegment({ x: hit.point.x, y: hit.point.z }, w.a, w.b);
      const o = addOpening(w, pr.t, tool);
      commit(); select({ kind: 'opening', id: o.id });
      return;
    }
    if (tool === 'marker' && hit) {
      const p = { x: hit.point.x, y: hit.point.z };
      if (pick?.kind === 'wall' && hit.normal) {
        addMarker(app.markerKind, { x: p.x + hit.normal.x * 0.02, y: p.y + hit.normal.z * 0.02 }, Math.max(0, hit.point.y - elev));
      } else addMarker(app.markerKind, p);
      return;
    }
    if (tool === 'stairs' && hit) { addStairs({ x: hit.point.x, y: hit.point.z }); return; }
    if (['wall', 'room', 'measure'].includes(tool)) { toast('Use the 2D plan for this tool'); return; }
    // select
    if (pick && SELECTABLE.has(pick.kind)) {
      if (pick.kind !== 'roof' && !findItem(pick)) { toast('That is on another floor – switch floors to edit it'); return; }
      if (e && (e.altKey)) { samplePaint(pick); toast('Colour picked'); return; }
      select(pick, { toggle: app.multi });
    } else select(null);
  };

  let drag = null;
  view3d.onDragStart = (pick) => {
    if (app.tool !== 'select' || !pick || !['furniture', 'stairs', 'marker'].includes(pick.kind)) return false;
    if (!app.selection.some(s => s.kind === pick.kind && s.id === pick.id)) return false;
    const it = findItem(pick);
    if (!it) return false;
    drag = { it, kind: pick.kind, moved: false, off: null };
    return true;
  };
  view3d.onDrag = (fp) => {
    if (!drag) return;
    const { it } = drag;
    if (!drag.off) drag.off = { x: it.x - fp.x, y: it.y - fp.y };
    const g = (settings().grid || 0.1) / 2;
    const tx = fp.x + drag.off.x, ty = fp.y + drag.off.y;
    const def = drag.kind === 'furniture' ? FURNITURE[it.type] : null;
    if (!(def && def.mount === 'wall' && snapToWall(it, { x: tx, y: ty }, 0.5))) { it.x = snapNum(tx, g); it.y = snapNum(ty, g); }
    drag.moved = true;
    changed();
  };
  view3d.onDragEnd = () => { if (drag && drag.moved) commit(); drag = null; };
}

window.addEventListener('error', e => console.error('Uncaught error:', e.message));
start();
