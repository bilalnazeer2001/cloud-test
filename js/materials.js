// Material presets (paint, tile, wood, marble, brick, concrete) with small
// procedural textures drawn on a canvas - no image files needed.
import * as THREE from 'three';

export const PRESETS = {
  paint:    { name: 'Paint',    size: 0,   color: '#efe9dc' },
  tile:     { name: 'Tile',     size: 1.2, color: '#e6dfd2' },
  wood:     { name: 'Wood',     size: 1.6, color: '#c79a6b' },
  marble:   { name: 'Marble',   size: 2.4, color: '#f1efec' },
  brick:    { name: 'Brick',    size: 1.0, color: '#b8593e' },
  concrete: { name: 'Concrete', size: 2.0, color: '#a9a8a2' },
};

export const SWATCHES = [
  '#ffffff', '#efe9dc', '#e8dcc8', '#d9c7a8', '#c79a6b', '#8a5a3c', '#5b3a29',
  '#f3d9c9', '#e9b9a0', '#b8593e', '#a8553d', '#7d2f2a',
  '#f5e9a8', '#e8c95a', '#c9d8b6', '#8fb07a', '#4f7a56', '#2f4f3e',
  '#cfe3ee', '#8fb8d0', '#4f7fa6', '#2c4a6b', '#c9c3e0', '#8d7fb5',
  '#d9d9d6', '#a9a8a2', '#70706c', '#3a3a3a', '#1e1e1e',
];

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function drawTexture(preset) {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const r = rng(preset.length * 7919 + 13);
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  if (preset === 'tile') {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const v = 238 + Math.floor(r() * 14);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
    g.strokeStyle = '#b9b9b9'; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, S); g.moveTo(0, i * 128); g.lineTo(S, i * 128); g.stroke(); }
  } else if (preset === 'wood') {
    const rows = 8, h = S / rows;
    for (let j = 0; j < rows; j++) {
      const v = 215 + Math.floor(r() * 36);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, j * h, S, h);
      g.strokeStyle = 'rgba(90,90,90,0.18)'; g.lineWidth = 1;
      for (let k = 0; k < 5; k++) { const y = j * h + 3 + r() * (h - 6); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 4 - 2, 170, y + r() * 4 - 2, S, y); g.stroke(); }
      g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, j * h); g.lineTo(S, j * h); g.stroke();
      const x = Math.floor(r() * S); g.beginPath(); g.moveTo(x, j * h); g.lineTo(x, j * h + h); g.stroke();
    }
  } else if (preset === 'marble') {
    g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 9; k++) {
      g.strokeStyle = `rgba(120,120,125,${0.08 + r() * 0.16})`; g.lineWidth = 0.6 + r() * 2.2;
      let x = r() * S, y = 0; g.beginPath(); g.moveTo(x, y);
      while (y < S) { x += (r() - 0.5) * 70; y += 20 + r() * 40; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(150,150,150,0.5)'; g.lineWidth = 2; g.strokeRect(0, 0, S, S);
  } else if (preset === 'brick') {
    g.fillStyle = '#d9d2c8'; g.fillRect(0, 0, S, S);
    const rows = 8, h = S / rows, w = S / 2;
    for (let j = 0; j < rows; j++) for (let i = -1; i < 2; i++) {
      const v = 205 + Math.floor(r() * 50);
      g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      g.fillRect(i * w + (j % 2 ? w / 2 : 0) + 3, j * h + 3, w - 6, h - 6);
    }
  } else if (preset === 'concrete') {
    g.fillStyle = '#eeeeee'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 2600; k++) {
      const v = 190 + Math.floor(r() * 65);
      g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5);
    }
  }
  return c;
}

const textures = {};
function getTexture(preset) {
  if (!PRESETS[preset] || !PRESETS[preset].size) return null;
  if (!textures[preset]) {
    const t = new THREE.CanvasTexture(drawTexture(preset));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const s = 1 / PRESETS[preset].size;
    t.repeat.set(s, s);
    textures[preset] = t;
  }
  return textures[preset];
}

const mats = new Map();
export const matKey = m => `${m?.preset || 'paint'}|${m?.color || '#efe9dc'}`;

/** Shared THREE material for a key made by matKey(). */
export function getMaterial(key) {
  let m = mats.get(key);
  if (!m) {
    const [preset, color] = key.split('|');
    m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color), map: getTexture(preset), side: THREE.DoubleSide });
    m.shadowSide = THREE.DoubleSide;
    mats.set(key, m);
  }
  return m;
}

// Shared materials for objects made of coloured boxes (furniture, doors...).
export const vertexMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
export const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
