// Building blocks for the furniture library: simple shapes that get merged
// into one mesh per object so that phones only have to draw a few things.
import * as THREE from 'three';
import { vertexMat, glowMat, glassMat } from '../materials.js';

// All positions: x = left/right, z = back(-)/front(+), y = height of the BOTTOM of the part.
// color: 'main' | 'accent' (user can recolour these) or a fixed '#rrggbb'.
// options: { glow: true } always bright (bulbs, screens), { glass: true } see-through,
//          { ry: radians } turn around the vertical axis, { rx, rz } tilt.

/** Box: width, height, depth, then position. */
export const box = (w, h, d, x = 0, y = 0, z = 0, color = 'main', o = {}) => ({ shape: 'box', w, h, d, x, y, z, color, ...o });
/** Upright cylinder: radius, height, then position. Options: r2 (top radius), axis:'x'|'z' to lay it down. */
export const cyl = (r, h, x = 0, y = 0, z = 0, color = 'main', o = {}) => ({ shape: 'cyl', r, h, x, y, z, color, ...o });
/** Ball: radius, then position (y = bottom of the ball). Options: sy to squash/stretch. */
export const ball = (r, x = 0, y = 0, z = 0, color = 'main', o = {}) => ({ shape: 'ball', r, x, y, z, color, ...o });

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

function partGeometry(p) {
  let g;
  if (p.shape === 'box') {
    g = new THREE.BoxGeometry(p.w, p.h, p.d);
    _e.set(p.rx || 0, p.ry || 0, p.rz || 0);
    _m.compose(new THREE.Vector3(p.x, p.y + p.h / 2, p.z), _q.setFromEuler(_e), new THREE.Vector3(1, 1, 1));
  } else if (p.shape === 'cyl') {
    g = new THREE.CylinderGeometry(p.r2 ?? p.r, p.r, p.h, p.seg || 14);
    if (p.axis === 'x') { _e.set(0, 0, Math.PI / 2); _m.compose(new THREE.Vector3(p.x, p.y + p.r, p.z), _q.setFromEuler(_e), new THREE.Vector3(1, 1, 1)); }
    else if (p.axis === 'z') { _e.set(Math.PI / 2, 0, 0); _m.compose(new THREE.Vector3(p.x, p.y + p.r, p.z), _q.setFromEuler(_e), new THREE.Vector3(1, 1, 1)); }
    else { _e.set(p.rx || 0, 0, p.rz || 0); _m.compose(new THREE.Vector3(p.x, p.y + p.h / 2, p.z), _q.setFromEuler(_e), new THREE.Vector3(1, 1, 1)); }
  } else {
    g = new THREE.SphereGeometry(p.r, 12, 9);
    const sy = p.sy || 1;
    _m.compose(new THREE.Vector3(p.x, p.y + p.r * sy, p.z), _q.identity(), new THREE.Vector3(p.sx || 1, sy, p.sz || 1));
  }
  g.applyMatrix4(_m);
  const ni = g.toNonIndexed(); g.dispose();
  return ni;
}

function merge(list) {
  let n = 0;
  for (const e of list) n += e.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const e of list) {
    const c = e.g.attributes.position.count;
    pos.set(e.g.attributes.position.array, o * 3);
    nor.set(e.g.attributes.normal.array, o * 3);
    _c.set(e.color);
    for (let i = 0; i < c; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; }
    o += c; e.g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Turn a list of parts into a THREE.Group (max. three meshes). */
export function buildParts(parts, colors = {}) {
  const solid = [], glow = [], glass = [];
  for (const p of parts) {
    if (!p) continue;
    const color = p.color === 'main' ? (colors.main || '#bbbbbb') : p.color === 'accent' ? (colors.accent || '#888888') : p.color;
    (p.glass ? glass : p.glow ? glow : solid).push({ g: partGeometry(p), color });
  }
  const group = new THREE.Group();
  if (solid.length) { const m = new THREE.Mesh(merge(solid), vertexMat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (glow.length) group.add(new THREE.Mesh(merge(glow), glowMat));
  if (glass.length) { const m = new THREE.Mesh(merge(glass), glassMat); m.renderOrder = 2; group.add(m); }
  return group;
}

export function disposeGroup(group) {
  group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}
