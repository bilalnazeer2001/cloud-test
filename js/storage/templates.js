// Starter houses. Each template is plain data built with small helpers so it is
// easy to read and tweak. Coordinates are metres; y grows towards the back.
import { newProject, newLevel, uid } from '../state.js';
import { FURNITURE, defaultElev } from '../library/furniture.js';
import { projectOnSegment } from '../geometry.js';

const PI = Math.PI;
const INT = { preset: 'paint', color: '#efe9dc' };
const EXT = { preset: 'paint', color: '#e2cfae' };

function levelBuilder(lvl) {
  const W = (ax, ay, bx, by, t = 0.2) => {
    lvl.walls.push({ id: uid('w'), a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: t, height: null, matL: { ...INT }, matR: { ...INT } });
  };
  // opening at a point on a wall centre line
  const O = (type, x, y, opts = {}) => {
    const w = lvl.walls.find(w => projectOnSegment({ x, y }, w.a, w.b).d < 0.03);
    if (!w) throw new Error(`template: no wall at ${x},${y}`);
    const t = projectOnSegment({ x, y }, w.a, w.b).t;
    const base = type === 'door'
      ? { style: 'single', width: 0.9, height: 2.1, sill: 0, color: '#7a5234' }
      : { style: 'casement', width: 1.2, height: 1.2, sill: 0.9, color: '#f4f4f0' };
    lvl.openings.push({ id: uid('o'), wall: w.id, t, type, ...base, ...opts });
  };
  const F = (type, x, y, rot = 0, opts = {}) => {
    const def = FURNITURE[type];
    lvl.furniture.push({ id: uid('f'), type, x, y, rot, w: def.size[0], h: def.size[1], d: def.size[2], elev: defaultElev(def, lvl.height), main: def.main, accent: def.accent || null, ...opts });
  };
  const R = (name, x, y, mat) => lvl.rooms.push({ id: uid('r'), name, px: x, py: y, mat });
  const M = (kind, x, y, elev, label = '') => lvl.markers.push({ id: uid('m'), kind, x, y, elev, label });
  /** Paint the outside face of walls on the outline of the box (x0,y0)-(x1,y1). */
  const outside = (x0, y0, x1, y1, mat = EXT) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const on = p => Math.abs(p.x - x0) < 0.01 || Math.abs(p.x - x1) < 0.01 || Math.abs(p.y - y0) < 0.01 || Math.abs(p.y - y1) < 0.01;
    for (const w of lvl.walls) {
      const sameX = Math.abs(w.a.x - w.b.x) < 0.01 && (Math.abs(w.a.x - x0) < 0.01 || Math.abs(w.a.x - x1) < 0.01);
      const sameY = Math.abs(w.a.y - w.b.y) < 0.01 && (Math.abs(w.a.y - y0) < 0.01 || Math.abs(w.a.y - y1) < 0.01);
      if (!(on(w.a) && on(w.b) && (sameX || sameY))) continue;
      const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
      const nL = { x: -dy, y: dx }; // left normal
      const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
      const leftIsOut = nL.x * (mid.x - cx) + nL.y * (mid.y - cy) > 0;
      w[leftIsOut ? 'matL' : 'matR'] = { ...mat };
    }
  };
  return { W, O, F, R, M, outside };
}

const MAT = {
  marble: { preset: 'marble', color: '#f1efec' },
  tile: { preset: 'tile', color: '#e6dfd2' },
  wood: { preset: 'wood', color: '#c79a6b' },
  bath: { preset: 'tile', color: '#cfe3ee' },
  hall: { preset: 'tile', color: '#d9d2c4' },
};

// ---------------------------------------------------------------------------
export function template2BHK() {
  const p = newProject('2BHK starter house');
  p.roof = { type: 'gable', pitch: 25, overhang: 0.5, flip: false, mat: { preset: 'tile', color: '#a8553d' } };
  const L = p.levels[0];
  const { W, O, F, R, M, outside } = levelBuilder(L);
  // outer walls (clockwise on screen)
  W(0, 0, 10, 0); W(10, 0, 10, 8); W(10, 8, 0, 8); W(0, 8, 0, 0);
  // inner walls
  W(6, 0, 6, 8, 0.15); W(0, 4.5, 6, 4.5, 0.15); W(4, 4.5, 4, 8, 0.15); W(6, 3.3, 10, 3.3, 0.15);
  outside(0, 0, 10, 8);

  O('door', 1.0, 0, { width: 1.0, style: 'single', color: '#5b3a29' });   // main door
  O('window', 4.4, 0, { width: 1.4 });
  O('window', 7.4, 0, { width: 1.0, height: 1.0, sill: 1.1, style: 'sliding' });
  O('window', 0, 6.2, { width: 1.2 });
  O('window', 8.8, 8, { width: 1.4, style: 'grill' });
  O('window', 10, 7.3, { width: 0.9 });
  O('window', 5, 8, { width: 0.6, height: 0.5, sill: 1.7, style: 'louvre' });
  O('door', 6, 1.75, { width: 1.2, style: 'opening', height: 2.1 });       // living - kitchen
  O('door', 6, 3.9, { width: 0.8 });                                        // bedroom 2
  O('door', 0.9, 4.5, { width: 0.8 });                                      // bedroom 1
  O('door', 5.0, 4.5, { width: 0.7, color: '#f4f3ee' });                    // bathroom

  R('Living room', 3, 2.2, MAT.marble);
  R('Kitchen', 8, 1.7, MAT.tile);
  R('Bedroom 1', 2, 6.2, MAT.wood);
  R('Bathroom', 5, 6.2, MAT.bath);
  R('Bedroom 2', 8, 5.6, MAT.wood);

  // living
  F('sofa_3', 3.2, 3.97, PI); F('coffee_table', 3.2, 2.6); F('rug', 3.2, 2.7);
  F('tv_unit', 3.2, 0.31); F('tv_stand', 3.2, 0.3, 0, { elev: 0.5 });
  F('armchair', 0.6, 2.4, PI / 2); F('plant_tall', 5.55, 4.0); F('fan_ceiling', 3.2, 2.4);
  F('side_table', 0.45, 3.7);
  // kitchen
  F('fridge', 6.5, 0.45); F('counter_sink', 7.4, 0.4); F('counter_stove', 8.4, 0.4); F('counter', 9.4, 0.4);
  F('chimney', 8.4, 0.34); F('wall_cabinet', 9.4, 0.275);
  F('dining_4', 8.2, 2.2); F('chair', 7.4, 2.2, PI / 2); F('chair', 9.0, 2.2, -PI / 2); F('chair', 8.2, 1.55); F('chair', 8.2, 2.85, PI);
  F('light_tube', 8, 3.16, PI); F('washer', 6.5, 2.9, PI / 2);
  // bedroom 1
  F('bed_double', 2, 6.87, PI); F('bedside', 0.95, 7.68, PI); F('bedside', 3.05, 7.68, PI);
  F('wardrobe_2', 3.6, 5.4, -PI / 2); F('ac_indoor', 2, 7.79, PI); F('fan_ceiling', 2, 6.2); F('lamp_table', 0.95, 7.68, 0, { elev: 0.5 });
  // bathroom
  F('toilet', 4.55, 7.56, PI); F('basin', 5.69, 5.4, -PI / 2); F('shower', 5.4, 7.4); F('geyser', 5.715, 6.4, -PI / 2);
  // bedroom 2
  F('bed_double', 8.875, 5.9, -PI / 2); F('bedside', 9.68, 4.85, -PI / 2); F('bedside', 9.68, 6.95, -PI / 2);
  F('wardrobe_3', 7.0, 7.6, PI); F('ac_indoor', 9.79, 5.9, -PI / 2); F('light_ceiling', 8, 5.6); F('desk', 6.7, 4.4, PI / 2); F('office_chair', 7.3, 4.4, -PI / 2);
  // outside
  F('car', 3.5, -3.8, PI / 2); F('plant_small', -0.5, -0.4); F('plant_small', 2.0, -0.4); F('tree', 13, 2); F('bush', 11.2, 0.5);
  F('water_tank', 11.3, 7.2); F('water_pump', 11.0, 5.9, -PI / 2); F('ac_outdoor', 10.45, 4.6, PI / 2); F('gate', 3.5, -6.5);

  // electrical / automation points
  M('switch', 1.75, 0.12, 1.2, 'Main'); M('db_box', 0.12, 1.4, 1.6, 'DB'); M('socket', 2.2, 0.12, 0.3, 'TV');
  M('controller', 5.9, 3.2, 1.4, 'ESP32 living'); M('sensor_pir', 0.15, 4.35, 2.4);
  M('switch', 1.5, 4.63, 1.2); M('socket', 3.85, 7.0, 0.3); M('switch', 6.13, 4.45, 1.2);
  M('sensor_door', 1.0, 0.15, 2.2, 'Front door'); M('socket_hi', 9.85, 1.0, 1.2, 'Kitchen'); M('tap', 7.4, 0.12, 1.0);
  M('pump', 11.0, 5.5, 0.1, 'Borewell pump'); M('sensor_level', 11.3, 6.55, 1.2, 'Tank level');
  return p;
}

// ---------------------------------------------------------------------------
export function template3BHK() {
  const p = newProject('3BHK two-storey house');
  p.roof = { type: 'flat', pitch: 25, overhang: 0.3, flip: false, mat: { preset: 'concrete', color: '#c9c3b8' } };
  const G = p.levels[0];
  G.name = 'Ground floor';
  let b = levelBuilder(G);
  b.W(0, 0, 10, 0); b.W(10, 0, 10, 9); b.W(10, 9, 0, 9); b.W(0, 9, 0, 0);
  b.W(5.5, 0, 5.5, 9, 0.15); b.W(0, 5, 5.5, 5, 0.15); b.W(4, 5, 4, 9, 0.15);
  b.outside(0, 0, 10, 9, { preset: 'paint', color: '#f2efe6' });
  b.O('door', 1.0, 0, { width: 1.0, color: '#5b3a29', style: 'double' });
  b.O('window', 4.4, 0, { width: 1.4 });
  b.O('window', 7.4, 0, { width: 1.0, height: 1.0, sill: 1.1, style: 'sliding' });
  b.O('window', 0, 2.5, { width: 1.2 });
  b.O('window', 0, 7, { width: 1.2 });
  b.O('window', 3.3, 9, { width: 1.0 });
  b.O('window', 4.75, 9, { width: 0.6, height: 0.5, sill: 1.7, style: 'louvre' });
  b.O('window', 10, 2.5, { width: 1.2 });
  b.O('door', 7.0, 9, { width: 0.9, style: 'french', color: '#f4f3ee' });
  b.O('door', 5.5, 2.5, { width: 1.6, style: 'opening' });
  b.O('door', 1.0, 5, { width: 0.8 });
  b.O('door', 4.75, 5, { width: 0.7, color: '#f4f3ee' });
  b.R('Living room', 2.7, 2.4, MAT.marble);
  b.R('Kitchen & dining', 7.5, 3.0, MAT.tile);
  b.R('Bedroom 1', 2, 7, MAT.wood);
  b.R('Bathroom', 4.75, 7, MAT.bath);
  // living
  b.F('sofa_l', 2.4, 3.95, PI); b.F('tv_unit', 2.4, 0.31); b.F('tv_wall', 2.4, 0.135); b.F('coffee_table', 2.4, 2.3);
  b.F('rug', 2.4, 2.5, 0, { main: '#4f7fa6', accent: '#e8dcc8' }); b.F('plant_tall', 5.0, 4.5); b.F('fan_ceiling', 2.4, 2.4); b.F('lamp_floor', 0.4, 4.5);
  // kitchen & dining
  b.F('fridge_double', 6.15, 0.47); b.F('counter_sink', 7.4, 0.4); b.F('counter_stove', 8.4, 0.4); b.F('counter', 9.4, 0.4);
  b.F('chimney', 8.4, 0.34); b.F('wall_cabinet', 9.4, 0.275); b.F('microwave', 9.4, 0.35);
  b.F('dining_6', 7.3, 5.8, PI / 2);
  for (const y of [5.2, 5.8, 6.4]) { b.F('chair', 6.62, y, PI / 2); b.F('chair', 7.98, y, -PI / 2); }
  b.F('light_pendant', 7.3, 5.8); b.F('washer', 6.1, 8.55, PI); b.F('inverter', 5.9, 7.8, PI / 2);
  // bedroom 1
  b.F('bed_double', 2, 7.87, PI); b.F('bedside', 0.95, 8.68, PI); b.F('bedside', 3.05, 8.68, PI);
  b.F('wardrobe_3', 3.6, 6.1, -PI / 2); b.F('ac_indoor', 0.21, 8.3, PI / 2); b.F('fan_ceiling', 2, 7);
  // bathroom
  b.F('toilet', 4.75, 8.56, PI); b.F('basin', 5.19, 5.6, -PI / 2); b.F('shower', 4.75, 7.3);
  G.stairs.push({ id: uid('s'), x: 9.35, y: 6.6, rot: PI, w: 1.0, len: 3.6, color: '#d9c7a8' });
  // outside
  b.F('car', 3, -4, PI / 2, { main: '#a8553d' }); b.F('tree', -3, 3); b.F('tree', 13, 7); b.F('bush', 11.5, 1); b.F('plant_small', 1.8, -0.4); b.F('gate', 3, -6.5);
  b.F('water_tank', 11.6, 8.2); b.F('water_pump', 11.2, 6.8, -PI / 2); b.F('bench', 7, 11, PI);
  b.M('switch', 1.75, 0.12, 1.2, 'Main'); b.M('db_box', 0.12, 1.2, 1.6, 'DB'); b.M('controller', 5.38, 4.2, 1.4, 'ESP32 hub');
  b.M('sensor_pir', 0.15, 4.85, 2.4); b.M('camera', 0.2, -0.2, 2.6, 'Gate cam'); b.M('wifi', 5.38, 1.0, 1.8);
  b.M('socket', 3.3, 0.12, 0.3); b.M('socket_hi', 9.88, 1.4, 1.2); b.M('sensor_temp', 0.12, 6.0, 1.5);
  b.M('pump', 11.2, 6.4, 0.1, 'Pump'); b.M('sensor_level', 11.6, 7.55, 1.2, 'Tank level'); b.M('valve', 10.4, 7.8, 0.6);

  // first floor
  const F1 = newLevel('First floor', 2.8);
  p.levels.push(F1);
  b = levelBuilder(F1);
  b.W(0, 0, 10, 0); b.W(10, 0, 10, 9); b.W(10, 9, 0, 9); b.W(0, 9, 0, 0);
  b.W(5, 0, 5, 9, 0.15); b.W(0, 4.5, 5, 4.5, 0.15); b.W(5, 3, 10, 3, 0.15); b.W(5, 6.5, 8.4, 6.5, 0.15); b.W(8.4, 6.5, 8.4, 9, 0.15);
  b.outside(0, 0, 10, 9, { preset: 'paint', color: '#f2efe6' });
  b.O('window', 2.5, 0, { width: 1.4 });
  b.O('window', 0, 3.6, { width: 0.8 });
  b.O('window', 4.1, 9, { width: 1.0 });
  b.O('window', 0, 6.8, { width: 1.2 });
  b.O('window', 7.5, 0, { width: 1.4 });
  b.O('window', 6.7, 9, { width: 0.6, height: 0.5, sill: 1.7, style: 'louvre' });
  b.O('window', 10, 4.2, { width: 1.0, sill: 1.0 });
  b.O('door', 5, 3.75, { width: 0.8 });
  b.O('door', 5, 5.5, { width: 0.8 });
  b.O('door', 6.5, 6.5, { width: 0.75, color: '#f4f3ee' });
  b.O('door', 7.0, 3, { width: 0.8 });
  b.R('Bedroom 2', 2.5, 2.2, MAT.wood);
  b.R('Bedroom 3', 2.5, 6.8, MAT.wood);
  b.R('Study', 7.5, 1.5, MAT.wood);
  b.R('Bathroom 2', 6.7, 7.8, MAT.bath);
  b.R('Landing', 6.5, 4.6, MAT.hall);
  b.F('bed_king', 1.15, 2.25, PI / 2); b.F('bedside', 0.3, 0.95, PI / 2); b.F('bedside', 0.3, 3.55, PI / 2);
  b.F('wardrobe_2', 4.6, 1.0, -PI / 2); b.F('ac_indoor', 1.2, 0.21); b.F('fan_ceiling', 2.5, 2.2);
  b.F('bed_double', 2.5, 7.87, PI); b.F('bedside', 1.45, 8.68, PI); b.F('bedside', 3.55, 8.68, PI);
  b.F('dresser', 0.325, 5.4, PI / 2); b.F('wardrobe_2', 4.6, 7.6, -PI / 2); b.F('light_ceiling', 2.5, 6.8);
  b.F('desk', 7.5, 0.4); b.F('office_chair', 7.5, 1.0, PI); b.F('bookshelf', 9.74, 1.5, -PI / 2); b.F('light_ceiling', 7.5, 1.5);
  b.F('toilet', 5.6, 8.56, PI); b.F('basin', 5.31, 7.3, PI / 2); b.F('shower', 7.8, 8.4);
  b.F('plant_small', 5.4, 3.5); b.F('light_ceiling', 6.8, 4.6);
  b.M('switch', 4.88, 3.2, 1.2); b.M('switch', 4.88, 5.0, 1.2); b.M('sensor_pir', 9.85, 3.2, 2.4, 'Landing');
  return p;
}

export const TEMPLATES = [
  { id: '2bhk', name: 'Small 2BHK', desc: 'Single storey, 10 × 8 m, gable roof', make: template2BHK },
  { id: '3bhk', name: '3BHK two-storey', desc: '10 × 9 m, stairs, flat roof', make: template3BHK },
  { id: 'empty', name: 'Empty project', desc: 'Start from scratch', make: () => newProject('My house') },
];
