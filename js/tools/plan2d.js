// The 2D top view: grid, walls, rooms, openings, furniture and markers, plus all
// the tools that work by tapping/dragging in the plan.
import { app, bus, level, derived, commit, changed, select, isSelected, findItem, addWall, clampOpening, settings, wallHeight } from '../state.js';
import { dist, projectOnSegment, wallLength, wallDir, wallNormal, snapNum, pointInPoly, planToLocal, localToPlan, fmtLen, fmtArea, polyArea } from '../geometry.js';
import { FURNITURE } from '../library/furniture.js';
import { MARKERS } from '../library/markers.js';
import { applyPaint, placeOpeningAt, addMarker, addStairs, addMeasure, snapToWall, toast, nearestWall } from './actions.js';

let canvas, ctx, wrap;
let W = 1, H = 1, DPR = 1;
const view = { scale: 40, ox: 0, oy: 0 }; // px per metre, screen offset of origin (CSS px)
let needsDraw = true;
let preview = null;   // tool preview (wall being drawn etc.)
let snapMark = null;  // last snap indicator
let hover = null;

const toS = p => ({ x: p.x * view.scale + view.ox, y: p.y * view.scale + view.oy });
const toW = (sx, sy) => ({ x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale });

export function initPlan(el) {
  wrap = el;
  canvas = document.createElement('canvas');
  canvas.style.touchAction = 'none';
  el.appendChild(canvas);
  ctx = canvas.getContext('2d');
  new ResizeObserver(resize).observe(el);
  ['change', 'selection', 'level', 'tool', 'project'].forEach(e => bus.on(e, () => { needsDraw = true; }));
  setupPointer();
  resize();
  const loop = () => { if (needsDraw && wrap.offsetParent !== null) { draw(); needsDraw = false; } requestAnimationFrame(loop); };
  loop();
}
export const redrawPlan = () => { needsDraw = true; };

let fitted = false;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = wrap.clientWidth || 1; H = wrap.clientHeight || 1;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  if (!fitted && W > 50 && H > 50 && app.project) fitPlan();
  needsDraw = true;
}

/** Zoom/pan so that the whole level fits. */
export function fitPlan() {
  const pts = [];
  for (const l of app.project.levels) for (const w of l.walls) pts.push(w.a, w.b);
  if (W > 50 && H > 50) fitted = true;
  if (!pts.length) { view.scale = 40; view.ox = W / 2; view.oy = H / 2; needsDraw = true; return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const pad = 48;
  view.scale = Math.max(8, Math.min(200, Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, y1 - y0))));
  view.ox = W / 2 - ((x0 + x1) / 2) * view.scale;
  view.oy = H / 2 - ((y0 + y1) / 2) * view.scale;
  needsDraw = true;
}
export const planCenter = () => toW(W / 2, H / 2);

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function draw() {
  const c = ctx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = css('--plan-bg') || '#f7f6f2';
  c.fillRect(0, 0, W, H);
  drawGrid(c);
  const lvl = level(), d = derived(lvl), units = settings().units;

  // level below as a ghost
  if (app.levelIdx > 0) {
    const below = app.project.levels[app.levelIdx - 1];
    const bd = derived(below);
    c.fillStyle = 'rgba(120,120,120,0.18)';
    for (const w of below.walls) { const wp = bd.wallPolys.get(w.id); if (wp) fillPoly(c, wp.poly); }
    for (const s of below.stairs) drawStairs(c, s, true);
  }

  // rooms
  for (const r of d.rooms) {
    c.fillStyle = tint(r.meta.mat?.color || '#e6dfd2', isSelected('room', r.id) ? 0.55 : 0.35);
    fillPoly(c, r.inner);
    if (isSelected('room', r.id)) { c.strokeStyle = '#1e88ff'; c.lineWidth = 2; strokePoly(c, r.inner); }
  }
  // stairs
  for (const s of lvl.stairs) drawStairs(c, s, false);
  // furniture (floor items first, then wall / ceiling items)
  const order = lvl.furniture.slice().sort((a, b) => (a.elev || 0) - (b.elev || 0));
  for (const f of order) drawFurniture(c, f);
  // walls
  for (const w of lvl.walls) {
    const wp = d.wallPolys.get(w.id);
    if (!wp) continue;
    const sel = isSelected('wall', w.id);
    c.fillStyle = sel ? '#1e88ff' : (css('--wall') || '#3b3a36');
    fillPoly(c, wp.poly);
    if (w.height && w.height < lvl.height - 0.01) { c.fillStyle = 'rgba(255,255,255,0.45)'; fillPoly(c, wp.poly); }
  }
  // openings
  for (const o of lvl.openings) drawOpening(c, lvl, o);
  // labels
  if (settings().showDims) for (const w of lvl.walls) drawWallDim(c, w, units);
  for (const r of d.rooms) {
    const s = toS(r.label);
    const fs = Math.max(10, Math.min(15, view.scale * 0.32));
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `600 ${fs}px system-ui, sans-serif`;
    const tw = Math.max(c.measureText(r.meta.name).width, fs * 3.2) + 10;
    c.fillStyle = 'rgba(255,255,255,0.72)';
    c.beginPath(); c.roundRect ? c.roundRect(s.x - tw / 2, s.y - fs * 1.25, tw, fs * 2.5, 6) : c.rect(s.x - tw / 2, s.y - fs * 1.25, tw, fs * 2.5); c.fill();
    c.fillStyle = '#2b2a27';
    c.fillText(r.meta.name, s.x, s.y - fs * 0.6);
    c.font = `${fs * 0.85}px system-ui, sans-serif`;
    c.fillStyle = '#5c5a55';
    c.fillText(fmtArea(r.area, units), s.x, s.y + fs * 0.6);
  }
  // markers
  if (settings().showMarkers) for (const m of lvl.markers) drawMarker(c, m);
  // measures
  for (const m of lvl.measures) drawMeasure(c, m.a, m.b, isSelected('measure', m.id), units);
  // selection handles
  for (const s of app.selection) {
    const it = findItem(s, lvl);
    if (!it) continue;
    if (s.kind === 'wall') { handle(c, it.a); handle(c, it.b); }
    if (s.kind === 'furniture' || s.kind === 'stairs') {
      const hp = rotHandlePos(it, s.kind);
      const ctr = toS(it);
      c.strokeStyle = '#1e88ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ctr.x, ctr.y); c.lineTo(hp.x, hp.y); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(hp.x, hp.y, 11, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#1e88ff'; c.font = '14px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('↻', hp.x, hp.y + 1);
    }
  }
  // tool preview
  if (preview) {
    if (preview.type === 'wall') {
      c.strokeStyle = 'rgba(30,136,255,0.85)'; c.lineCap = 'butt';
      c.lineWidth = Math.max(3, app.wallOpts.thickness * view.scale);
      line(c, preview.a, preview.b);
      drawMeasure(c, preview.a, preview.b, true, units, 22);
    } else if (preview.type === 'room') {
      const { a, b } = preview;
      c.strokeStyle = 'rgba(30,136,255,0.85)'; c.lineWidth = Math.max(3, app.wallOpts.thickness * view.scale);
      strokePoly(c, [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]);
      drawMeasure(c, a, { x: b.x, y: a.y }, true, units, -20);
      drawMeasure(c, { x: b.x, y: a.y }, b, true, units, 20);
      const s = toS({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      c.fillStyle = '#1e88ff'; c.font = '600 13px system-ui'; c.textAlign = 'center';
      c.fillText(fmtArea(Math.abs((b.x - a.x) * (b.y - a.y)), units), s.x, s.y);
    } else if (preview.type === 'measure') drawMeasure(c, preview.a, preview.b, true, units);
    else if (preview.type === 'box') {
      const a = toS(preview.a), b = toS(preview.b);
      c.fillStyle = 'rgba(30,136,255,0.12)'; c.strokeStyle = '#1e88ff'; c.lineWidth = 1; c.setLineDash([5, 4]);
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); c.setLineDash([]);
    }
  }
  if (snapMark) {
    const s = toS(snapMark);
    c.strokeStyle = '#ff5a1f'; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, 8, 0, Math.PI * 2); c.stroke();
  }
  if (hover && app.tool !== 'select') {
    const s = toS(hover);
    c.strokeStyle = 'rgba(30,136,255,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(s.x - 8, s.y); c.lineTo(s.x + 8, s.y); c.moveTo(s.x, s.y - 8); c.lineTo(s.x, s.y + 8); c.stroke();
  }
  drawScaleBar(c, units);
}

function drawGrid(c) {
  const g = settings().grid || 0.1;
  let step = g;
  while (step * view.scale < 9) step *= step === g ? 5 : 2;
  const tl = toW(0, 0), br = toW(W, H);
  c.lineWidth = 1;
  const drawLines = (st, color) => {
    c.strokeStyle = color; c.beginPath();
    for (let x = Math.floor(tl.x / st) * st; x <= br.x; x += st) { const s = Math.round(x * view.scale + view.ox) + 0.5; c.moveTo(s, 0); c.lineTo(s, H); }
    for (let y = Math.floor(tl.y / st) * st; y <= br.y; y += st) { const s = Math.round(y * view.scale + view.oy) + 0.5; c.moveTo(0, s); c.lineTo(W, s); }
    c.stroke();
  };
  drawLines(step, css('--grid-minor') || '#ebe8e1');
  const major = step < 1 ? 1 : step * 5;
  if (major * view.scale > 20) drawLines(major, css('--grid-major') || '#d9d5cb');
}

function drawScaleBar(c, units) {
  const target = 90 / view.scale;
  const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find(v => v >= target) || 50;
  const px = nice * view.scale;
  const x = 12, y = H - 14;
  c.strokeStyle = '#555'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y); c.lineTo(x + px, y); c.lineTo(x + px, y - 5); c.stroke();
  c.fillStyle = '#555'; c.font = '11px system-ui'; c.textAlign = 'left'; c.textBaseline = 'bottom';
  c.fillText(fmtLen(nice, units).replace(/\.00 m/, ' m'), x + 4, y - 4);
}

function fillPoly(c, poly) { c.beginPath(); poly.forEach((p, i) => { const s = toS(p); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); }); c.closePath(); c.fill(); }
function strokePoly(c, poly) { c.beginPath(); poly.forEach((p, i) => { const s = toS(p); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); }); c.closePath(); c.stroke(); }
function line(c, a, b) { const s = toS(a), e = toS(b); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(e.x, e.y); c.stroke(); }
function handle(c, p) { const s = toS(p); c.fillStyle = '#fff'; c.strokeStyle = '#1e88ff'; c.lineWidth = 2.5; c.beginPath(); c.arc(s.x, s.y, 9, 0, Math.PI * 2); c.fill(); c.stroke(); }
function tint(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function drawFurniture(c, f) {
  const def = FURNITURE[f.type];
  if (!def) return;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => toS(localToPlan(f, u * f.w / 2, v * f.d / 2)));
  const sel = isSelected('furniture', f.id);
  c.globalAlpha = def.mount === 'ceiling' ? 0.45 : 1;
  c.fillStyle = tint(f.main || def.main, 0.55);
  c.strokeStyle = sel ? '#1e88ff' : 'rgba(40,40,40,0.75)';
  c.lineWidth = sel ? 2.5 : 1;
  if (def.mount === 'ceiling') c.setLineDash([4, 3]);
  c.beginPath(); corners.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill(); c.stroke();
  c.setLineDash([]);
  // front edge marker
  c.strokeStyle = sel ? '#1e88ff' : 'rgba(40,40,40,0.9)'; c.lineWidth = sel ? 3 : 2;
  c.beginPath(); c.moveTo(corners[3].x, corners[3].y); c.lineTo(corners[2].x, corners[2].y); c.stroke();
  c.globalAlpha = 1;
  const minSide = Math.min(f.w, f.d) * view.scale;
  if (!def.mount && minSide > 18 && Math.max(f.w, f.d) * view.scale > 44) {
    const s = toS(f);
    c.save(); c.translate(s.x, s.y);
    let ang = -(f.rot || 0);
    if (f.d > f.w * 1.3) ang += Math.PI / 2;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    c.rotate(ang);
    c.fillStyle = '#222'; c.font = `${Math.max(9, Math.min(12, minSide * 0.3))}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(def.name, 0, 0);
    c.restore();
  }
}

function drawStairs(c, s, ghost) {
  const sel = !ghost && isSelected('stairs', s.id);
  const P = (u, v) => toS(localToPlan(s, u, v));
  const corners = [P(-s.w / 2, -s.len / 2), P(s.w / 2, -s.len / 2), P(s.w / 2, s.len / 2), P(-s.w / 2, s.len / 2)];
  c.fillStyle = ghost ? 'rgba(255,255,255,0.4)' : tint(s.color || '#d9c7a8', 0.7);
  c.strokeStyle = sel ? '#1e88ff' : ghost ? 'rgba(80,80,80,0.5)' : '#444';
  c.lineWidth = sel ? 2.5 : 1;
  c.beginPath(); corners.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill(); c.stroke();
  const n = 16;
  c.beginPath();
  for (let i = 1; i < n; i++) { const z = -s.len / 2 + s.len * i / n; const a = P(-s.w / 2, z), b = P(s.w / 2, z); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  c.stroke();
  // arrow pointing up the stairs
  const a = P(0, -s.len / 2 + 0.2), b = P(0, s.len / 2 - 0.2), l = P(-0.18, s.len / 2 - 0.5), r = P(0.18, s.len / 2 - 0.5);
  c.strokeStyle = ghost ? 'rgba(80,80,80,0.5)' : '#1b1b1b'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.moveTo(l.x, l.y); c.lineTo(b.x, b.y); c.lineTo(r.x, r.y); c.stroke();
  if (!ghost) { const m = P(0, -s.len / 2 + 0.35); c.fillStyle = '#1b1b1b'; c.font = '600 11px system-ui'; c.textAlign = 'center'; c.fillText('UP', m.x, m.y); }
}

function drawOpening(c, lvl, o) {
  const w = lvl.walls.find(x => x.id === o.wall);
  if (!w) return;
  const len = wallLength(w), d = wallDir(w), n = wallNormal(w), h = w.thickness / 2 + 0.01;
  const s0 = o.t * len - o.width / 2, s1 = o.t * len + o.width / 2;
  const P = (s, k) => ({ x: w.a.x + d.x * s + n.x * k, y: w.a.y + d.y * s + n.y * k });
  const sel = isSelected('opening', o.id);
  c.fillStyle = css('--plan-bg') || '#f7f6f2';
  fillPoly(c, [P(s0, h), P(s1, h), P(s1, -h), P(s0, -h)]);
  c.strokeStyle = sel ? '#1e88ff' : '#333'; c.lineWidth = sel ? 2.5 : 1.2;
  if (o.type === 'window') {
    strokePoly(c, [P(s0, h), P(s1, h), P(s1, -h), P(s0, -h)]);
    line(c, P(s0, 0), P(s1, 0));
    if (o.style !== 'fixed') { line(c, P(s0, h * 0.4), P(s1, h * 0.4)); }
  } else {
    line(c, P(s0, h), P(s0, -h)); line(c, P(s1, h), P(s1, -h));
    if (o.style === 'opening') return;
    const side = o.flip ? -1 : 1;
    const arcs = o.style === 'double' || o.style === 'french' ? [[s0, o.width / 2, 1], [s1, o.width / 2, -1]] : o.style === 'sliding' ? [] : [[o.hinge ? s1 : s0, o.width, o.hinge ? -1 : 1]];
    if (o.style === 'sliding') { line(c, P(s0, h * 0.3), P((s0 + s1) / 2 + 0.05, h * 0.3)); line(c, P((s0 + s1) / 2 - 0.05, -h * 0.3), P(s1, -h * 0.3)); }
    for (const [hs, r, dirS] of arcs) {
      const hinge = toS(P(hs, side * h)), tip = toS(P(hs, side * (h + r)));
      c.beginPath(); c.moveTo(hinge.x, hinge.y); c.lineTo(tip.x, tip.y); c.stroke();
      const a0 = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
      const closed = toS(P(hs + dirS * r, side * h));
      const a1 = Math.atan2(closed.y - hinge.y, closed.x - hinge.x);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      c.setLineDash([3, 3]); c.beginPath(); c.arc(hinge.x, hinge.y, r * view.scale, a0, a0 + da, da < 0); c.stroke(); c.setLineDash([]);
    }
  }
}

function drawWallDim(c, w, units) {
  const len = wallLength(w);
  if (len * view.scale < 46) return;
  const d = wallDir(w), n = wallNormal(w);
  const off = w.thickness / 2 + 12 / view.scale;
  const mid = { x: (w.a.x + w.b.x) / 2 + n.x * off, y: (w.a.y + w.b.y) / 2 + n.y * off };
  const s = toS(mid);
  let ang = Math.atan2(d.y, d.x);
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
  c.save(); c.translate(s.x, s.y); c.rotate(ang);
  c.font = '11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const txt = fmtLen(len, units);
  const tw = c.measureText(txt).width + 6;
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(-tw / 2, -7, tw, 14);
  c.fillStyle = '#1d5fa8'; c.fillText(txt, 0, 0);
  c.restore();
}

function drawMeasure(c, a, b, sel, units, offPx = 0) {
  const sa = toS(a), sb = toS(b);
  const dx = sb.x - sa.x, dy = sb.y - sa.y, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l * offPx, ny = dx / l * offPx;
  c.strokeStyle = sel ? '#ff5a1f' : '#c2410c'; c.fillStyle = c.strokeStyle; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(sa.x + nx, sa.y + ny); c.lineTo(sb.x + nx, sb.y + ny); c.stroke();
  for (const p of [sa, sb]) { c.beginPath(); c.moveTo(p.x + nx - dy / l * 6, p.y + ny + dx / l * 6); c.lineTo(p.x + nx + dy / l * 6, p.y + ny - dx / l * 6); c.stroke(); }
  const m = { x: (sa.x + sb.x) / 2 + nx, y: (sa.y + sb.y) / 2 + ny };
  const txt = units === 'ft' ? fmtLen(dist(a, b), 'ft') : `${fmtLen(dist(a, b), 'm')} (${fmtLen(dist(a, b), 'ft')})`;
  c.font = '600 12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tw = c.measureText(txt).width + 8;
  c.fillStyle = 'rgba(255,255,255,0.92)'; c.fillRect(m.x - tw / 2, m.y - 9, tw, 18);
  c.fillStyle = sel ? '#ff5a1f' : '#c2410c'; c.fillText(txt, m.x, m.y);
}

function drawMarker(c, m) {
  const def = MARKERS[m.kind] || MARKERS.switch;
  const s = toS(m), sel = isSelected('marker', m.id);
  const r = 10;
  c.fillStyle = def.color; c.strokeStyle = sel ? '#1e88ff' : '#fff'; c.lineWidth = sel ? 3 : 2;
  c.beginPath(); c.arc(s.x, s.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = `700 ${def.icon.length > 1 ? 8 : 10}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(def.icon, s.x, s.y + 0.5);
  if (m.label && view.scale > 30) { c.fillStyle = '#222'; c.font = '10px system-ui'; c.fillText(m.label, s.x, s.y + r + 8); }
}

function rotHandlePos(it, kind) {
  const depth = kind === 'stairs' ? it.len : it.d;
  const p = localToPlan(it, 0, -depth / 2);
  const s = toS(p), c = toS(it);
  const dx = s.x - c.x, dy = s.y - c.y, l = Math.hypot(dx, dy) || 1;
  return { x: s.x + dx / l * 26, y: s.y + dy / l * 26 };
}

// ---------------------------------------------------------------------------
// Hit testing and snapping
// ---------------------------------------------------------------------------
export function hitTest(p, { kinds = null } = {}) {
  const lvl = level(), tol = 8 / view.scale;
  const ok = k => !kinds || kinds.includes(k);
  if (ok('marker') && settings().showMarkers) for (const m of lvl.markers.slice().reverse()) if (dist(m, p) < 14 / view.scale) return { kind: 'marker', id: m.id };
  if (ok('opening')) for (const o of lvl.openings) {
    const w = lvl.walls.find(x => x.id === o.wall); if (!w) continue;
    const pr = projectOnSegment(p, w.a, w.b), len = wallLength(w);
    if (pr.d < w.thickness / 2 + tol && Math.abs(pr.t * len - o.t * len) < o.width / 2) return { kind: 'opening', id: o.id };
  }
  if (ok('measure')) for (const m of lvl.measures) if (projectOnSegment(p, m.a, m.b).d < tol) return { kind: 'measure', id: m.id };
  if (ok('furniture')) {
    const order = lvl.furniture.slice().sort((a, b) => (b.elev || 0) - (a.elev || 0));
    for (const f of order) { const l = planToLocal(f, p); if (Math.abs(l.x) <= f.w / 2 + tol * 0.5 && Math.abs(l.z) <= f.d / 2 + tol * 0.5) return { kind: 'furniture', id: f.id }; }
  }
  if (ok('wall')) {
    let best = null;
    for (const w of lvl.walls) {
      const pr = projectOnSegment(p, w.a, w.b);
      if (pr.d < w.thickness / 2 + tol && (!best || pr.d < best.d)) {
        const n = wallNormal(w);
        best = { d: pr.d, pick: { kind: 'wall', id: w.id, side: (p.x - pr.x) * n.x + (p.y - pr.y) * n.y >= 0 ? 'L' : 'R' } };
      }
    }
    if (best) return best.pick;
  }
  if (ok('stairs')) for (const s of lvl.stairs) { const l = planToLocal(s, p); if (Math.abs(l.x) <= s.w / 2 && Math.abs(l.z) <= s.len / 2) return { kind: 'stairs', id: s.id }; }
  if (ok('room')) for (const r of derived(lvl).rooms) if (pointInPoly(p, r.inner)) return { kind: 'room', id: r.id };
  return null;
}

/** Snap a point: wall ends > wall bodies > grid. `from` enables angle snapping. */
function snapPoint(p, { from = null, exclude = null } = {}) {
  const lvl = level(), tol = 14 / view.scale;
  snapMark = null;
  let best = null;
  for (const w of lvl.walls) {
    if (exclude && exclude.has(w.id)) continue;
    for (const e of [w.a, w.b]) { const d = dist(e, p); if (d < tol && (!best || d < best.d)) best = { d, p: { x: e.x, y: e.y } }; }
  }
  if (best) { snapMark = best.p; return best.p; }
  const g = settings().grid || 0.1;
  let q = { x: snapNum(p.x, g), y: snapNum(p.y, g) };
  if (from) {
    // keep lines straight: snap to 0/45/90 degree directions when close
    const dx = q.x - from.x, dy = q.y - from.y, len = Math.hypot(dx, dy);
    if (len > 0.05) {
      const ang = Math.atan2(dy, dx), st = Math.PI / 4, sa = Math.round(ang / st) * st;
      if (Math.abs(ang - sa) < 0.12) {
        const L = snapNum(len, g);
        q = { x: from.x + Math.cos(sa) * L, y: from.y + Math.sin(sa) * L };
        if (Math.abs(Math.cos(sa)) < 1e-9) q.x = from.x; if (Math.abs(Math.sin(sa)) < 1e-9) q.y = from.y;
      }
    }
  }
  for (const w of lvl.walls) {
    if (exclude && exclude.has(w.id)) continue;
    const pr = projectOnSegment(p, w.a, w.b);
    if (pr.d < tol * 0.6 && pr.t > 0.02 && pr.t < 0.98) {
      // land exactly on the wall centre line (T-junction) but keep grid along the wall
      const pg = projectOnSegment(q, w.a, w.b);
      snapMark = { x: pg.x, y: pg.y };
      return snapMark;
    }
  }
  return q;
}

// ---------------------------------------------------------------------------
// Pointer handling
// ---------------------------------------------------------------------------
let drag = null;

function evtPoint(e) { const r = canvas.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }

function setupPointer() {
  const pts = new Map();
  let pinch = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const { sx, sy } = evtPoint(e);
    pts.set(e.pointerId, { sx, sy });
    if (pts.size === 2) {
      // second finger: cancel any tool action and start pinch/pan
      if (drag && drag.cancel) drag.cancel();
      drag = null; preview = null; snapMark = null;
      pinch = null; needsDraw = true;
      return;
    }
    if (pts.size > 2) return;
    if (e.button === 1 || e.button === 2) { drag = { type: 'pan', last: { sx, sy } }; return; }
    pointerDown(toW(sx, sy), sx, sy, e);
  });
  canvas.addEventListener('pointermove', e => {
    const { sx, sy } = evtPoint(e);
    if (!pts.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { hover = app.tool === 'wall' || app.tool === 'room' ? snapPoint(toW(sx, sy)) : null; if (!hover) snapMark = null; needsDraw = true; }
      return;
    }
    pts.set(e.pointerId, { sx, sy });
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const cur = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), x: (a.sx + b.sx) / 2, y: (a.sy + b.sy) / 2 };
      if (pinch) {
        const k = cur.d / Math.max(1, pinch.d);
        zoomAt(cur.x, cur.y, k);
        view.ox += cur.x - pinch.x; view.oy += cur.y - pinch.y;
      }
      pinch = cur; needsDraw = true;
      return;
    }
    if (drag) pointerMove(toW(sx, sy), sx, sy, e);
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size > 0) { pinch = null; return; }
    const { sx, sy } = evtPoint(e);
    if (drag) pointerUp(toW(sx, sy), sx, sy, e, e.type === 'pointercancel');
    drag = null; snapMark = null; needsDraw = true;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { hover = null; needsDraw = true; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const { sx, sy } = evtPoint(e);
    if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015));
    else { view.ox -= e.deltaX; view.oy -= e.deltaY; }
    needsDraw = true;
  }, { passive: false });
}

function zoomAt(sx, sy, k) {
  const ns = Math.max(4, Math.min(400, view.scale * k));
  const w = toW(sx, sy);
  view.scale = ns;
  view.ox = sx - w.x * ns; view.oy = sy - w.y * ns;
}
export function zoomPlan(k) { zoomAt(W / 2, H / 2, k); needsDraw = true; }

function pointerDown(p, sx, sy, e) {
  const tool = app.tool;
  const start = { p, sx, sy, t: performance.now() };
  if (tool === 'wall') { const a = snapPoint(p); drag = { type: 'wall', start, a }; preview = { type: 'wall', a, b: a }; needsDraw = true; return; }
  if (tool === 'room') { const g = settings().grid || 0.1; const a = snapPoint(p); drag = { type: 'room', start, a }; preview = { type: 'room', a, b: a }; return; }
  if (tool === 'measure') { const a = snapPoint(p); drag = { type: 'measure', start, a }; preview = { type: 'measure', a, b: a }; return; }
  if (tool !== 'select') { drag = { type: 'tap', start }; return; }

  // --- select tool ---
  // handles of selected items first
  const lvl = level();
  for (const s of app.selection) {
    const it = findItem(s, lvl);
    if (!it) continue;
    if (s.kind === 'wall') {
      for (const end of ['a', 'b']) {
        if (dist(toS(it[end]), { x: sx, y: sy }) < 18) {
          const pt = { x: it[end].x, y: it[end].y };
          const linked = [];
          for (const w of lvl.walls) for (const e2 of ['a', 'b']) if (dist(w[e2], pt) < 0.02) linked.push([w, e2]);
          drag = { type: 'endpoint', start, linked, exclude: new Set(linked.map(l => l[0].id)) };
          return;
        }
      }
    }
    if (s.kind === 'furniture' || s.kind === 'stairs') {
      const hp = rotHandlePos(it, s.kind);
      if (Math.hypot(hp.x - sx, hp.y - sy) < 20) { drag = { type: 'rotate', start, item: it }; return; }
    }
  }
  const hit = hitTest(p);
  if (app.multi) {
    if (!hit) drag = { type: 'box', start, a: p };
    else drag = { type: 'tap', start, hit };
    return;
  }
  if (hit && hit.kind !== 'room') {
    if (!isSelected(hit.kind, hit.id)) select(hit);
    drag = { type: 'move', start, hit, last: p, items: movables() };
    return;
  }
  drag = { type: 'pan', start, last: { sx, sy }, hit };
}

/** Snapshot of everything that moves with the selection. */
function movables() {
  const lvl = level();
  const pts = new Map(); // key "x,y" -> {pt, refs}
  const items = [];
  const walls = new Set();
  for (const s of app.selection) {
    const it = findItem(s, lvl);
    if (!it) continue;
    if (s.kind === 'wall') { walls.add(it.id); for (const e of ['a', 'b']) { const k = `${it[e].x.toFixed(3)},${it[e].y.toFixed(3)}`; if (!pts.has(k)) pts.set(k, { x0: it[e].x, y0: it[e].y }); } }
    else if (s.kind === 'measure') items.push({ it, kind: s.kind, a0: { ...it.a }, b0: { ...it.b } });
    else if (s.kind === 'opening') items.push({ it, kind: s.kind, t0: it.t });
    else items.push({ it, kind: s.kind, x0: it.x, y0: it.y });
  }
  // endpoints of all walls touching the moved points follow (keeps corners joined)
  const refs = [];
  for (const P of pts.values()) for (const w of lvl.walls) for (const e of ['a', 'b']) if (Math.abs(w[e].x - P.x0) < 0.02 && Math.abs(w[e].y - P.y0) < 0.02) refs.push({ w, e, x0: w[e].x, y0: w[e].y });
  return { items, refs, walls };
}

function pointerMove(p, sx, sy, e) {
  const g = settings().grid || 0.1;
  if (drag.type === 'pan') { view.ox += sx - drag.last.sx; view.oy += sy - drag.last.sy; drag.last = { sx, sy }; drag.moved = true; needsDraw = true; return; }
  const moved = Math.hypot(sx - drag.start.sx, sy - drag.start.sy) > 6;
  if (moved) drag.moved = true;
  if (drag.type === 'wall') { preview.b = snapPoint(p, { from: drag.a }); needsDraw = true; return; }
  if (drag.type === 'room') { preview.b = snapPoint(p); needsDraw = true; return; }
  if (drag.type === 'measure') { preview.b = snapPoint(p, { from: drag.a }); needsDraw = true; return; }
  if (drag.type === 'box') { preview = { type: 'box', a: drag.a, b: p }; needsDraw = true; return; }
  if (!drag.moved) return;
  if (drag.type === 'endpoint') {
    const q = snapPoint(p, { exclude: drag.exclude });
    for (const [w, end] of drag.linked) { w[end] = { x: q.x, y: q.y }; }
    changed();
  } else if (drag.type === 'rotate') {
    const it = drag.item;
    // handle sits behind the item (local -z) => rot = atan2(-dx, -dy)
    let ang = Math.atan2(-(p.x - it.x), -(p.y - it.y));
    const st = Math.PI / 12;
    if (!e.altKey) ang = Math.round(ang / st) * st;
    it.rot = ang; changed();
  } else if (drag.type === 'move') {
    const { items, refs } = drag.items;
    let dx = p.x - drag.start.p.x, dy = p.y - drag.start.p.y;
    if (refs.length) { dx = snapNum(dx, g); dy = snapNum(dy, g); }
    for (const r of refs) r.w[r.e] = { x: r.x0 + dx, y: r.y0 + dy };
    for (const m of items) {
      if (m.kind === 'opening') {
        const w = level().walls.find(x => x.id === m.it.wall);
        const hit = nearestWall(p, 0.6);
        if (hit && hit.wall.id !== m.it.wall && items.length === 1) { m.it.wall = hit.wall.id; m.it.t = hit.pr.t; clampOpening(m.it, hit.wall); }
        else if (w) { const len = wallLength(w); const pr = projectOnSegment(p, w.a, w.b); m.it.t = snapNum(pr.t * len, g / 2) / len; clampOpening(m.it, w); }
      } else if (m.kind === 'measure') {
        m.it.a = { x: m.a0.x + dx, y: m.a0.y + dy }; m.it.b = { x: m.b0.x + dx, y: m.b0.y + dy };
      } else {
        const def = m.kind === 'furniture' ? FURNITURE[m.it.type] : null;
        const tx = m.x0 + dx, ty = m.y0 + dy;
        if (def && def.mount === 'wall' && items.length === 1 && snapToWall(m.it, { x: tx, y: ty }, 0.5)) continue;
        m.it.x = refs.length ? tx : snapNum(tx, g / 2); m.it.y = refs.length ? ty : snapNum(ty, g / 2);
      }
    }
    // keep openings inside their (possibly resized) walls
    for (const o of level().openings) { const w = level().walls.find(x => x.id === o.wall); if (w && drag.items.walls.size === 0 && refs.length) clampOpening(o, w); }
    changed();
  }
}

function pointerUp(p, sx, sy, e, cancelled) {
  const d = drag;
  const isTap = !d.moved && performance.now() - d.start.t < 700;
  if (d.type === 'wall') {
    const b = preview.b; preview = null;
    if (!cancelled && dist(d.a, b) >= 0.1) {
      addWall(d.a, b); commit();
    } else if (isTap) {
      // tap-tap drawing: first tap sets start, next tap ends a wall
      if (drag.chain) {/* not used */}
      if (lastTapPt && dist(lastTapPt, d.a) >= 0.1 && performance.now() - lastTapT < 15000) { addWall(lastTapPt, d.a); commit(); lastTapPt = d.a; lastTapT = performance.now(); }
      else { lastTapPt = d.a; lastTapT = performance.now(); toast('Tap again to finish the wall, or drag to draw'); }
      snapMark = lastTapPt;
    }
    return;
  }
  lastTapPt = null;
  if (d.type === 'room') {
    const a = d.a, b = preview.b; preview = null;
    if (!cancelled && Math.abs(b.x - a.x) >= 0.5 && Math.abs(b.y - a.y) >= 0.5) {
      addRectRoom(a, b); commit();
    } else if (!cancelled) toast('Drag a rectangle to make a room');
    return;
  }
  if (d.type === 'measure') {
    const b = preview.b; preview = null;
    if (!cancelled && dist(d.a, b) > 0.05) addMeasure(d.a, b);
    return;
  }
  if (d.type === 'box') {
    preview = null;
    const x0 = Math.min(d.a.x, p.x), x1 = Math.max(d.a.x, p.x), y0 = Math.min(d.a.y, p.y), y1 = Math.max(d.a.y, p.y);
    const lvl = level();
    const inBox = q => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
    const sel = [...app.selection];
    const addSel = s => { if (!sel.some(x => x.kind === s.kind && x.id === s.id)) sel.push(s); };
    lvl.walls.forEach(w => { if (inBox(w.a) && inBox(w.b)) addSel({ kind: 'wall', id: w.id }); });
    lvl.furniture.forEach(f => inBox(f) && addSel({ kind: 'furniture', id: f.id }));
    lvl.markers.forEach(m => inBox(m) && addSel({ kind: 'marker', id: m.id }));
    lvl.stairs.forEach(s => inBox(s) && addSel({ kind: 'stairs', id: s.id }));
    select(sel);
    return;
  }
  if (d.type === 'endpoint' || d.type === 'rotate' || d.type === 'move') {
    if (d.moved) {
      if (d.type === 'endpoint') mergeDuplicateWalls();
      commit();
    } else if (d.type === 'move' && isTap && d.hit) select(d.hit);
    return;
  }
  if (d.type === 'pan') { if (isTap) select(d.hit || null); return; }
  if (d.type === 'tap' && isTap) {
    if (app.multi && d.hit) { select(d.hit, { toggle: true }); return; }
    toolTap(p);
  }
}
let lastTapPt = null, lastTapT = 0;
export function resetWallChain() { lastTapPt = null; snapMark = null; needsDraw = true; }

function toolTap(p) {
  const tool = app.tool;
  if (tool === 'door' || tool === 'window') placeOpeningAt(p, tool, 12 / view.scale + 0.15);
  else if (tool === 'paint') {
    const hit = hitTest(p);
    if (!hit || !applyPaint(hit)) toast('Tap a wall side, floor, door, window or furniture');
  } else if (tool === 'marker') addMarker(app.markerKind, p);
  else if (tool === 'stairs') addStairs(p);
}

function addRectRoom(a, b) {
  const pts = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  const lvl = level();
  for (let i = 0; i < 4; i++) {
    const p = pts[i], q = pts[(i + 1) % 4];
    // skip sides that already exist (shared walls between neighbouring rooms)
    const covered = lvl.walls.some(w => projectOnSegment(p, w.a, w.b).d < 0.05 && projectOnSegment(q, w.a, w.b).d < 0.05);
    if (!covered) addWall(p, q);
  }
}

/** After dragging an endpoint onto another, remove zero-length walls. */
function mergeDuplicateWalls() {
  const lvl = level();
  const gone = new Set(lvl.walls.filter(w => wallLength(w) < 0.05).map(w => w.id));
  if (!gone.size) return;
  lvl.walls = lvl.walls.filter(w => !gone.has(w.id));
  lvl.openings = lvl.openings.filter(o => !gone.has(o.wall));
  app.selection = app.selection.filter(s => !(s.kind === 'wall' && gone.has(s.id)));
}
