// The live 3D view: renderer, camera controls (touch + mouse), lighting with a
// sun-time slider, picking, selection highlight and furniture dragging.
import * as THREE from 'three';
import { app, bus, level, levelElevation, findItem, SLAB } from '../state.js';
import { buildLevel, buildRoof, disposeLevelGroup } from './builder.js';
import { Walker } from './walk.js';

export const view3d = {
  onTap: null,        // (pick, hit, event) => void
  onDragStart: null,  // (pick, hit) => bool  (return true to take over the drag)
  onDrag: null,       // (floorPoint) => void
  onDragEnd: null,
};

let renderer, scene, camera, container;
let sun, hemi, ambient;
const lightPool = [];
let levelsRoot, roofRoot, highlight;
const levelCache = new Map(); // idx -> {key, group, lights}
let roofKey = '';
let dirty = true, needsRender = true;
let ground;

// orbit state
const orbit = { target: new THREE.Vector3(5, 1, 4), radius: 22, theta: -0.7, phi: 0.95 };
let walker = null;

export function initView3D(el) {
  container = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);

  hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7f6a, 1.1);
  ambient = new THREE.AmbientLight(0xffffff, 0.35);
  sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, ambient, sun, sun.target);
  for (let i = 0; i < 8; i++) {
    const p = new THREE.PointLight(0xffe2b0, 0, 7, 1.6);
    p.visible = false; lightPool.push(p); scene.add(p);
  }

  const gGeo = new THREE.PlaneGeometry(400, 400);
  gGeo.rotateX(-Math.PI / 2);
  ground = new THREE.Mesh(gGeo, new THREE.MeshLambertMaterial({ color: 0x8fae6f }));
  ground.position.y = -0.3;
  ground.receiveShadow = true;
  ground.userData.pick = { kind: 'ground' };
  scene.add(ground);

  levelsRoot = new THREE.Group(); roofRoot = new THREE.Group();
  highlight = new THREE.Group();
  scene.add(levelsRoot, roofRoot, highlight);

  walker = new Walker(camera, renderer.domElement, () => { needsRender = true; });

  setupPointer(renderer.domElement);
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(el);
  bus.on('change', () => { dirty = true; needsRender = true; });
  bus.on('selection', () => { updateHighlight(); needsRender = true; });
  bus.on('level', () => { dirty = true; needsRender = true; });
  bus.on('project', () => { levelCache.forEach(c => { levelsRoot.remove(c.group); disposeLevelGroup(c.group); }); levelCache.clear(); roofKey = ''; dirty = true; });
  bus.on('view', () => setTimeout(resize, 0));
  resize();
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (dirty) rebuild();
    if (app.mode === 'walk') { walker.update(dt); needsRender = true; }
    if (needsRender && container.offsetParent !== null) {
      if (app.mode !== 'walk') applyOrbit();
      renderer.render(scene, camera);
      needsRender = false;
    }
  });
}

export function requestRender() { needsRender = true; }

function resize() {
  if (!container) return;
  const w = container.clientWidth || 1, h = container.clientHeight || 1;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  camera.aspect = w / h; camera.updateProjectionMatrix();
  needsRender = true;
}

// ---------------------------------------------------------------------------
// Scene (re)building
// ---------------------------------------------------------------------------
function visibleLevels() {
  const n = app.project.levels.length;
  if (app.mode === 'walk' || app.showAllLevels) return [...Array(n).keys()];
  return [...Array(app.levelIdx + 1).keys()];
}

function rebuild() {
  dirty = false;
  const p = app.project;
  const want = new Set(visibleLevels());
  const shadows = !!p.settings.shadows;
  for (const [idx, c] of levelCache) {
    if (!want.has(idx) || idx >= p.levels.length) { levelsRoot.remove(c.group); disposeLevelGroup(c.group); levelCache.delete(idx); }
  }
  for (const idx of want) {
    const lvl = p.levels[idx];
    const below = idx > 0 ? p.levels[idx - 1].stairs : [];
    const key = JSON.stringify([lvl, below, levelElevation(idx), p.settings.showMarkers, shadows]);
    const c = levelCache.get(idx);
    if (c && c.key === key) continue;
    if (c) { levelsRoot.remove(c.group); disposeLevelGroup(c.group); }
    const built = buildLevel(idx, { shadows });
    levelsRoot.add(built.group);
    levelCache.set(idx, { key, ...built });
  }
  // fade levels below the current one slightly in build mode? keep simple: all opaque.
  const top = p.levels.length - 1;
  const showRoof = app.showRoof && (app.mode === 'walk' || app.showAllLevels || app.levelIdx === top);
  const rk = showRoof ? JSON.stringify([p.roof, p.levels[top].walls, levelElevation(top), p.levels[top].height]) : '';
  if (rk !== roofKey) {
    roofKey = rk;
    roofRoot.children.slice().forEach(m => { roofRoot.remove(m); m.geometry?.dispose(); });
    if (showRoof) buildRoof(roofRoot);
  }
  updateLighting();
  updateHighlight();
  renderer.shadowMap.needsUpdate = true;
  needsRender = true;
}

function houseBounds() {
  const box = new THREE.Box3();
  levelsRoot.children.forEach(g => box.expandByObject(g));
  if (box.isEmpty()) box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
  return box;
}

// ---------------------------------------------------------------------------
// Lighting / sun
// ---------------------------------------------------------------------------
export function updateLighting() {
  const s = app.project.settings;
  const t = s.time;
  const dayF = Math.max(0, Math.sin(Math.PI * (t - 6) / 12)); // 0 at 6:00/18:00, 1 at noon
  const isNight = t < 6.3 || t > 18.7;
  const box = houseBounds();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length() / 2 + 4;
  // sun path: rises in the east (+x), sets in the west (-x), passes south (+z)
  const az = Math.PI * (t - 6) / 12; // 0..PI
  const el = Math.max(0.05, dayF) * 1.25;
  const dir = new THREE.Vector3(Math.cos(az), Math.sin(el) + 0.05, 0.45).normalize();
  sun.position.copy(center).addScaledVector(dir, size * 2);
  sun.target.position.copy(center);
  const cam = sun.shadow.camera;
  cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size; cam.near = 0.5; cam.far = size * 4;
  cam.updateProjectionMatrix();
  sun.castShadow = !!s.shadows && !isNight;
  const warm = 1 - dayF;
  sun.color.setRGB(1, 0.92 - warm * 0.25, 0.85 - warm * 0.45);
  sun.intensity = isNight ? 0 : 0.6 + dayF * 1.9;
  hemi.intensity = isNight ? 0.25 : 0.55 + dayF * 0.7;
  ambient.intensity = isNight ? 0.12 : 0.25;
  const day = new THREE.Color(0xa9d3f5), dusk = new THREE.Color(0xf2b27a), night = new THREE.Color(0x0e1630);
  const sky = isNight ? night : day.clone().lerp(dusk, Math.pow(warm, 3));
  scene.background = sky;
  hemi.color.copy(isNight ? new THREE.Color(0x4a5a8a) : new THREE.Color(0xdfefff));
  ground.material.color.set(isNight ? 0x2c3a2a : 0x8fae6f);
  // indoor lamps at night/dusk (nearest to the current level first)
  const lampsOn = s.lights && (isNight || dayF < 0.2);
  const lamps = [];
  for (const [idx, c] of levelCache) for (const l of c.lights) lamps.push({ ...l, d: Math.abs(idx - app.levelIdx) });
  lamps.sort((a, b) => a.d - b.d);
  lightPool.forEach((pl, i) => {
    const l = lamps[i];
    pl.visible = !!(lampsOn && l);
    if (pl.visible) { pl.position.set(l.x, l.y, l.z); pl.intensity = 3.2 * l.power; }
  });
  renderer.shadowMap.needsUpdate = true;
  needsRender = true;
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
function applyOrbit() {
  const o = orbit;
  o.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, o.phi));
  o.radius = Math.max(2, Math.min(150, o.radius));
  camera.position.set(
    o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
    o.target.y + o.radius * Math.cos(o.phi),
    o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta));
  camera.lookAt(o.target);
}

export function frameHouse() {
  const box = houseBounds();
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  orbit.target.set(c.x, levelElevation(app.levelIdx) + 1, c.z);
  orbit.radius = Math.max(8, Math.max(s.x, s.z) * 1.25 + 4);
  needsRender = true;
}
export function setOrbitTop() { orbit.phi = 0.06; needsRender = true; }

function pan(dx, dy) {
  const k = orbit.radius * 0.0018;
  const right = new THREE.Vector3(Math.cos(orbit.theta), 0, -Math.sin(orbit.theta));
  const fwd = new THREE.Vector3(-Math.sin(orbit.theta), 0, -Math.cos(orbit.theta));
  orbit.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
  needsRender = true;
}

// ---------------------------------------------------------------------------
// Pointer handling
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
function ndc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

/** Returns {pick, point, normal, object} for what is under the pointer. */
export function pickAt(e) {
  raycaster.setFromCamera(ndc(e), camera);
  const hits = raycaster.intersectObjects([levelsRoot, roofRoot, ground], true);
  for (const h of hits) {
    if (!h.object.visible) continue;
    let pick = null;
    if (h.object.userData.picks) pick = h.object.userData.picks[h.faceIndex];
    else { let o = h.object; while (o && !o.userData.pick) o = o.parent; pick = o?.userData.pick; }
    if (!pick) continue;
    const normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null;
    return { pick, point: h.point, normal, object: h.object };
  }
  return null;
}

/** Point on the horizontal plane of the current floor under the pointer. */
export function floorPointAt(e, elev = levelElevation(app.levelIdx)) {
  raycaster.setFromCamera(ndc(e), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, p) ? { x: p.x, y: p.z } : null;
}

function setupPointer(el) {
  const pts = new Map();
  let mode = null; // 'orbit' | 'pan' | 'pinch' | 'drag'
  let start = null, moved = 0, lastPinch = null;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (app.mode === 'walk') return;
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY, t: performance.now(), e };
      mode = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit';
      if (mode === 'orbit' && view3d.onDragStart) {
        const hit = pickAt(e);
        if (hit && view3d.onDragStart(hit.pick, hit, e)) mode = 'drag';
      }
    } else if (pts.size === 2) {
      if (mode === 'drag') view3d.onDragEnd?.(true);
      mode = 'pinch'; lastPinch = null;
    }
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'orbit') { orbit.theta -= dx * 0.008; orbit.phi -= dy * 0.008; needsRender = true; }
    else if (mode === 'pan') pan(dx, dy);
    else if (mode === 'drag') { if (moved > 4) { const fp = floorPointAt(e); if (fp) view3d.onDrag?.(fp, e); } }
    else if (mode === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const cur = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (lastPinch) {
        orbit.radius *= lastPinch.d / Math.max(1, cur.d);
        pan(cur.x - lastPinch.x, cur.y - lastPinch.y);
      }
      lastPinch = cur;
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (mode === 'drag' && pts.size === 0) view3d.onDragEnd?.(moved <= 6);
    if (pts.size === 0) {
      if (moved < 8 && start && performance.now() - start.t < 600 && mode !== 'pinch' && e.type === 'pointerup') {
        const hit = pickAt(e);
        view3d.onTap?.(hit?.pick || null, hit, e);
      }
      mode = null;
    } else if (pts.size === 1) { mode = 'none'; }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { e.preventDefault(); if (app.mode === 'walk') return; orbit.radius *= Math.exp(e.deltaY * 0.001); needsRender = true; }, { passive: false });
}

// ---------------------------------------------------------------------------
// Selection highlight
// ---------------------------------------------------------------------------
const hlMat = new THREE.LineBasicMaterial({ color: 0x1e88ff, depthTest: false, transparent: true });
function updateHighlight() {
  if (!highlight) return;
  highlight.children.slice().forEach(c => { highlight.remove(c); c.geometry?.dispose(); });
  const lvl = level();
  const elev = levelElevation(app.levelIdx);
  for (const s of app.selection) {
    const it = findItem(s, lvl);
    if (!it) continue;
    if (s.kind === 'wall') {
      const H = it.height || lvl.height;
      const dx = it.b.x - it.a.x, dy = it.b.y - it.a.y, len = Math.hypot(dx, dy);
      const g = new THREE.BoxGeometry(len, H, it.thickness + 0.04);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), hlMat); g.dispose();
      e.position.set((it.a.x + it.b.x) / 2, elev + H / 2, (it.a.y + it.b.y) / 2);
      e.rotation.y = Math.atan2(-dy, dx);
      e.renderOrder = 10; highlight.add(e);
    } else {
      let target = null;
      for (const c of levelCache.values()) c.group.children.forEach(o => { if (o.userData.pick && o.userData.pick.kind === s.kind && o.userData.pick.id === s.id) target = o; });
      if (target) { const h = new THREE.Box3Helper(new THREE.Box3().setFromObject(target).expandByScalar(0.03), 0x1e88ff); h.material.depthTest = false; h.renderOrder = 10; highlight.add(h); }
    }
  }
}

// ---------------------------------------------------------------------------
// Walk mode, screenshots, export
// ---------------------------------------------------------------------------
export function startWalk() {
  app.mode = 'walk';
  dirty = true;
  const lvl = level();
  // start in the middle of the biggest room of the current level, or in front of the house
  const box = houseBounds();
  const c = box.getCenter(new THREE.Vector3());
  walker.start({ x: c.x, y: c.z }, app.levelIdx);
  bus.emit('mode');
}
export function stopWalk() { app.mode = 'build'; walker.stop(); dirty = true; bus.emit('mode'); }
export const getWalker = () => walker;

export function screenshot(scale = 2) {
  const w = container.clientWidth, h = container.clientHeight;
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(Math.min(3, pr * scale));
  renderer.setSize(w, h, false);
  if (app.mode !== 'walk') applyOrbit();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  needsRender = true;
  return url;
}

export function exportRoot() {
  const root = new THREE.Group();
  root.add(levelsRoot.clone(true), roofRoot.clone(true));
  return root;
}
export function showAllForExport(on) { app.showAllLevels = on; dirty = true; rebuild(); }
export { SLAB };
