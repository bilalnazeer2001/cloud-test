// =============================================================================
//  FURNITURE & APPLIANCE LIBRARY  -  the one file to edit to add new items
// =============================================================================
//
//  To add an item, copy any entry below, give it a new key and change the parts.
//
//    my_item: {
//      name: 'Shown in the library',
//      cat:  'Living',                 // one of CATEGORIES (or add a new one)
//      size: [width, height, depth],   // metres - the footprint shown in the 2D plan
//      main: '#8a5a3c',                // default colour of parts coloured 'main'
//      accent: '#d9d2c4',              // default colour of parts coloured 'accent' (optional)
//      mount: 'floor' | 'wall' | 'ceiling',   // wall items snap to walls, ceiling items hang
//      elev: 1.0,                      // height above the floor for wall items (optional)
//      light: { y: 0.3, power: 1 },    // makes it a lamp that glows at night (optional)
//      parts: (w, h, d) => [ box(...), cyl(...), ball(...) ],
//    }
//
//  Shapes (see parts.js):  box(w, h, d, x, y, z, colour, options)
//                          cyl(radius, h, x, y, z, colour, options)
//                          ball(radius, x, y, z, colour, options)
//  x is left/right, z is back(-)/front(+), y is the height of the part's bottom.
//  The back of an item (the side that goes against a wall) is at z = -depth/2.
// =============================================================================
import { box, cyl, ball } from './parts.js';

export const CATEGORIES = ['Bedroom', 'Living', 'Dining', 'Kitchen', 'Bathroom', 'Appliances', 'Lighting', 'Storage', 'Outdoor'];

const WHITE = '#f4f3ee', STEEL = '#b9bdc2', DARK = '#2b2d30', CHROME = '#d5d9dd', GREEN = '#4f8a4b', LEAF = '#3f7a45';

// ---- reusable recipes ------------------------------------------------------
const bed = pillows => (w, h, d) => [
  box(w, 0.28, d, 0, 0, 0),
  box(w - 0.06, 0.2, d - 0.12, 0, 0.28, 0.03, WHITE),
  box(w, h, 0.07, 0, 0, -d / 2 + 0.035),
  ...Array.from({ length: pillows }, (_, i) => box(0.52, 0.1, 0.34, (i - (pillows - 1) / 2) * (w / pillows), 0.48, -d / 2 + 0.32, '#ffffff')),
  box(w - 0.02, 0.04, d * 0.56, 0, 0.47, d * 0.2, 'accent'),
];

const sofa = seats => (w, h, d) => [
  box(w, 0.2, d, 0, 0.06, 0),
  box(w, h - 0.26, 0.2, 0, 0.26, -d / 2 + 0.1),
  box(0.16, 0.4, d, -w / 2 + 0.08, 0.2, 0), box(0.16, 0.4, d, w / 2 - 0.08, 0.2, 0),
  ...Array.from({ length: seats }, (_, i) => {
    const sw = (w - 0.36) / seats, x = -w / 2 + 0.18 + sw * (i + 0.5);
    return [box(sw - 0.03, 0.16, d - 0.24, x, 0.26, 0.1, 'accent'), box(sw - 0.05, 0.34, 0.14, x, 0.4, -d / 2 + 0.26, 'accent', { rx: -0.18 })];
  }).flat(),
  ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.06, 0.06, 0.06, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), DARK))),
];

const table = (round = false) => (w, h, d) => round
  ? [cyl(w / 2, 0.04, 0, h - 0.04, 0, 'main', { seg: 28 }), cyl(0.05, h - 0.06, 0, 0.02, 0, 'accent'), cyl(w * 0.28, 0.03, 0, 0, 0, 'accent', { seg: 20 })]
  : [box(w, 0.04, d, 0, h - 0.04, 0),
     ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.06, h - 0.04, 0.06, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07), 'accent')))];

const chair = (w, h, d) => [
  box(w, 0.05, d, 0, 0.42, 0),
  box(w, h - 0.5, 0.04, 0, 0.5, -d / 2 + 0.02),
  ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.04, 0.42, 0.04, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), 'accent'))),
];

const cupboard = doors => (w, h, d) => [
  box(w, h, d - 0.02, 0, 0, -0.01),
  ...Array.from({ length: doors }, (_, i) => {
    const dw = w / doors, x = -w / 2 + dw * (i + 0.5);
    return [box(dw - 0.02, h - 0.1, 0.02, x, 0.07, d / 2 - 0.01, 'accent'),
            box(0.02, 0.18, 0.025, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), h * 0.5, d / 2 + 0.01, CHROME)];
  }).flat(),
];

const handles = (w, h, d) => {
  const n = Math.max(1, Math.round(w / 0.5));
  return Array.from({ length: n }, (_, i) => box(0.14, 0.02, 0.02, -w / 2 + (w / n) * (i + 0.5), h - 0.16, d / 2 - 0.02, CHROME));
};
const counter = (extra = () => []) => (w, h, d) => [
  box(w, h - 0.14, d - 0.04, 0, 0.1, -0.02),
  box(w, 0.1, d - 0.1, 0, 0, -0.03, DARK),
  box(w, 0.04, d, 0, h - 0.04, 0, 'accent'),
  ...handles(w, h, d),
  ...extra(w, h, d),
];

const plant = (potR, leafR, tall) => (w, h) => [
  cyl(potR, h * 0.28, 0, 0, 0, 'accent', { r2: potR * 1.25 }),
  cyl(potR * 1.15, 0.02, 0, h * 0.27, 0, '#4a3526'),
  ...(tall ? [cyl(0.025, h * 0.4, 0, h * 0.28, 0, '#6b4a2e'), ball(leafR, 0, h - leafR * 2.1, 0, 'main', { sy: 1.05 }), ball(leafR * 0.7, leafR * 0.5, h * 0.5, 0.05, 'main')]
           : [ball(leafR, 0, h * 0.26, 0, 'main', { sy: (h * 0.74) / (leafR * 2) })]),
];

// ---- the library -----------------------------------------------------------
export const FURNITURE = {
  // Bedroom
  bed_single: { name: 'Single bed', cat: 'Bedroom', size: [1.0, 0.9, 2.0], main: '#8a5a3c', accent: '#7f9bb5', parts: bed(1) },
  bed_double: { name: 'Double bed', cat: 'Bedroom', size: [1.6, 0.95, 2.05], main: '#8a5a3c', accent: '#b5846f', parts: bed(2) },
  bed_king:   { name: 'King bed', cat: 'Bedroom', size: [1.9, 1.05, 2.1], main: '#5b3a29', accent: '#8d9a80', parts: bed(2) },
  bedside:    { name: 'Bedside table', cat: 'Bedroom', size: [0.45, 0.5, 0.4], main: '#8a5a3c', accent: '#a37350', parts: (w, h, d) => [box(w, h - 0.08, d, 0, 0.08, 0), box(w - 0.06, 0.08, d - 0.06, 0, 0, 0, DARK), box(w - 0.06, 0.15, 0.02, 0, h - 0.2, d / 2, 'accent'), box(w - 0.06, 0.15, 0.02, 0, h - 0.38, d / 2, 'accent')] },
  wardrobe_2: { name: 'Wardrobe 2-door', cat: 'Bedroom', size: [1.0, 2.1, 0.6], main: '#a37350', accent: '#c79a6b', parts: cupboard(2) },
  wardrobe_3: { name: 'Wardrobe 3-door', cat: 'Bedroom', size: [1.5, 2.1, 0.6], main: '#a37350', accent: '#c79a6b', parts: cupboard(3) },
  dresser:    { name: 'Dressing table', cat: 'Bedroom', size: [1.0, 1.5, 0.45], main: '#a37350', accent: '#c79a6b', parts: (w, h, d) => [box(w, 0.75, d, 0, 0, 0), box(w - 0.06, 0.14, 0.02, 0, 0.55, d / 2, 'accent'), box(w * 0.6, 0.7, 0.03, 0, 0.78, -d / 2 + 0.03, '#cfe3ee'), box(w * 0.66, 0.76, 0.02, 0, 0.75, -d / 2 + 0.01, 'accent')] },
  desk:       { name: 'Study desk', cat: 'Bedroom', size: [1.2, 0.75, 0.6], main: '#c79a6b', accent: '#3a3a3a', parts: (w, h, d) => [...table()(w, h, d), box(0.4, 0.4, d - 0.1, w / 2 - 0.25, h - 0.45, 0)] },
  office_chair: { name: 'Office chair', cat: 'Bedroom', size: [0.55, 1.0, 0.55], main: '#3a3a3a', accent: '#70706c', parts: (w, h, d) => [cyl(0.25, 0.04, 0, 0, 0, 'accent', { seg: 5 }), cyl(0.03, 0.4, 0, 0.04, 0, CHROME), box(w - 0.08, 0.08, d - 0.08, 0, 0.44, 0), box(w - 0.12, 0.5, 0.06, 0, 0.5, -d / 2 + 0.08, 'main', { rx: -0.1 })] },

  // Living
  sofa_2:   { name: 'Sofa 2-seat', cat: 'Living', size: [1.6, 0.8, 0.85], main: '#6f7f8f', accent: '#8696a6', parts: sofa(2) },
  sofa_3:   { name: 'Sofa 3-seat', cat: 'Living', size: [2.2, 0.8, 0.85], main: '#6f7f8f', accent: '#8696a6', parts: sofa(3) },
  armchair: { name: 'Armchair', cat: 'Living', size: [0.9, 0.8, 0.85], main: '#a8553d', accent: '#bb6a52', parts: sofa(1) },
  sofa_l:   { name: 'L-shaped sofa', cat: 'Living', size: [2.6, 0.8, 1.7], main: '#70706c', accent: '#8a8a86', parts: (w, h, d) => [
    box(w, 0.2, 0.85, 0, 0.06, -d / 2 + 0.425), box(w, h - 0.26, 0.2, 0, 0.26, -d / 2 + 0.1),
    box(0.9, 0.2, d - 0.85, -w / 2 + 0.45, 0.06, 0.425), box(0.2, h - 0.26, d, -w / 2 + 0.1, 0.26, 0),
    box(0.16, 0.4, 0.85, w / 2 - 0.08, 0.2, -d / 2 + 0.425),
    box(w - 0.4, 0.16, 0.6, 0.1, 0.26, -d / 2 + 0.52, 'accent'), box(0.66, 0.16, d - 0.9, -w / 2 + 0.55, 0.26, 0.42, 'accent'),
    box(w - 0.5, 0.32, 0.13, 0.12, 0.42, -d / 2 + 0.27, 'accent', { rx: -0.18 })] },
  coffee_table: { name: 'Coffee table', cat: 'Living', size: [1.1, 0.42, 0.6], main: '#8a5a3c', accent: '#3a3a3a', parts: (w, h, d) => [...table()(w, h, d), box(w - 0.16, 0.03, d - 0.16, 0, 0.12, 0)] },
  side_table: { name: 'Side table', cat: 'Living', size: [0.5, 0.55, 0.5], main: '#c79a6b', accent: '#3a3a3a', parts: table(true) },
  tv_unit:  { name: 'TV unit', cat: 'Living', size: [1.6, 0.5, 0.42], main: '#5b3a29', accent: '#8a5a3c', parts: cupboard(3) },
  tv_stand: { name: 'TV on stand', cat: 'Living', size: [1.25, 0.8, 0.25], main: DARK, accent: '#3a3a3a', parts: (w, h, d) => [box(w * 0.4, 0.03, d, 0, 0, 0, 'accent'), box(0.08, 0.1, 0.05, 0, 0.03, 0, 'accent'), box(w, h - 0.1, 0.05, 0, 0.1, 0), box(w - 0.04, h - 0.14, 0.01, 0, 0.12, 0.03, '#10151c')] },
  tv_wall:  { name: 'TV (wall)', cat: 'Living', size: [1.25, 0.72, 0.07], main: DARK, mount: 'wall', elev: 1.1, parts: (w, h, d) => [box(w, h, d, 0, 0, 0), box(w - 0.04, h - 0.04, 0.01, 0, 0.02, d / 2, '#10151c')] },
  bookshelf: { name: 'Bookshelf', cat: 'Living', size: [0.9, 1.9, 0.32], main: '#a37350', accent: '#4f7fa6', parts: (w, h, d) => [
    box(0.03, h, d, -w / 2 + 0.015, 0, 0), box(0.03, h, d, w / 2 - 0.015, 0, 0), box(w, h, 0.02, 0, 0, -d / 2 + 0.01),
    ...Array.from({ length: 6 }, (_, i) => box(w - 0.06, 0.03, d - 0.02, 0, i * (h - 0.03) / 5, 0.01)),
    ...Array.from({ length: 5 }, (_, i) => box(w * (0.45 + (i * 37 % 40) / 100), 0.24, d * 0.6, -w * 0.12 + (i % 2) * w * 0.14, 0.03 + i * (h - 0.03) / 5, 0, ['accent', '#b8593e', '#e8c95a', '#4f7a56', '#8d7fb5'][i]))] },
  rug:      { name: 'Rug', cat: 'Living', size: [2.0, 0.015, 1.4], main: '#b8593e', accent: '#e8dcc8', parts: (w, h, d) => [box(w, h, d, 0, 0, 0), box(w - 0.3, h + 0.002, d - 0.3, 0, 0, 0, 'accent'), box(w - 0.5, h + 0.004, d - 0.5, 0, 0, 0)] },

  // Dining
  dining_4: { name: 'Dining table (4)', cat: 'Dining', size: [1.2, 0.75, 0.8], main: '#8a5a3c', accent: '#5b3a29', parts: table() },
  dining_6: { name: 'Dining table (6)', cat: 'Dining', size: [1.8, 0.75, 0.9], main: '#8a5a3c', accent: '#5b3a29', parts: table() },
  dining_round: { name: 'Round table', cat: 'Dining', size: [1.1, 0.75, 1.1], main: '#c79a6b', accent: '#5b3a29', parts: table(true) },
  chair:    { name: 'Chair', cat: 'Dining', size: [0.45, 0.9, 0.45], main: '#c79a6b', accent: '#5b3a29', parts: chair },
  stool:    { name: 'Stool', cat: 'Dining', size: [0.36, 0.48, 0.36], main: '#c79a6b', accent: '#3a3a3a', parts: (w, h) => [cyl(w / 2, 0.05, 0, h - 0.05, 0, 'main', { seg: 18 }), ...[0, 1, 2].map(i => cyl(0.018, h - 0.05, Math.cos(i * 2.1) * w * 0.33, 0, Math.sin(i * 2.1) * w * 0.33, 'accent'))] },

  // Kitchen
  counter:  { name: 'Kitchen counter', cat: 'Kitchen', size: [1.0, 0.9, 0.6], main: '#e8dcc8', accent: '#3a3a3a', parts: counter() },
  counter_sink: { name: 'Sink counter', cat: 'Kitchen', size: [1.0, 0.9, 0.6], main: '#e8dcc8', accent: '#3a3a3a', parts: counter((w, h, d) => [
    box(0.5, 0.012, 0.4, -0.08, h - 0.005, 0.02, STEEL), box(0.44, 0.01, 0.34, -0.08, h + 0.004, 0.02, '#8d9298'),
    cyl(0.015, 0.22, -0.08, h, -d / 2 + 0.08, CHROME), cyl(0.012, 0.14, -0.08, h + 0.2, -d / 2 + 0.08, CHROME, { axis: 'z' })].map(p => p.axis === 'z' ? { ...p, z: p.z + 0.07 } : p)) },
  counter_stove: { name: 'Stove counter', cat: 'Kitchen', size: [1.0, 0.9, 0.6], main: '#e8dcc8', accent: '#3a3a3a', parts: counter((w, h, d) => [
    box(0.62, 0.03, 0.42, 0, h, 0, STEEL),
    ...[-1, 1].map(s => cyl(0.085, 0.025, s * 0.15, h + 0.03, 0, DARK, { seg: 16 })),
    ...[-1, 1].map(s => cyl(0.018, 0.02, s * 0.08, h + 0.01, 0.23, DARK, { axis: 'z' }))]) },
  wall_cabinet: { name: 'Wall cabinet', cat: 'Kitchen', size: [1.0, 0.7, 0.35], main: '#e8dcc8', accent: '#d9c7a8', mount: 'wall', elev: 1.45, parts: cupboard(2) },
  island:   { name: 'Kitchen island', cat: 'Kitchen', size: [1.6, 0.9, 0.9], main: '#4f7a56', accent: '#f1efec', parts: counter() },
  cooker:   { name: 'Cooking range', cat: 'Kitchen', size: [0.6, 0.9, 0.6], main: STEEL, accent: DARK, parts: (w, h, d) => [box(w, h, d - 0.02, 0, 0, -0.01), box(w - 0.1, 0.4, 0.02, 0, 0.2, d / 2 - 0.01, '#15181c'), box(w - 0.14, 0.02, 0.03, 0, 0.66, d / 2 + 0.01, CHROME),
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(0.075, 0.02, sx * 0.14, h, sz * 0.13, 'accent', { seg: 14 }))),
    box(w, 0.1, 0.03, 0, h, -d / 2 + 0.015)] },
  chimney:  { name: 'Chimney hood', cat: 'Kitchen', size: [0.6, 0.6, 0.48], main: STEEL, mount: 'wall', elev: 1.6, parts: (w, h, d) => [box(w, 0.08, d, 0, 0, 0), box(w * 0.7, 0.12, d * 0.7, 0, 0.08, -d * 0.15), box(0.24, h - 0.2, 0.22, 0, 0.2, -d / 2 + 0.11)] },
  fridge:   { name: 'Fridge', cat: 'Kitchen', size: [0.7, 1.75, 0.68], main: STEEL, accent: CHROME, parts: (w, h, d) => [box(w, h, d - 0.04, 0, 0, -0.02), box(w - 0.02, h * 0.36, 0.03, 0, h * 0.63, d / 2 - 0.015), box(w - 0.02, h * 0.6, 0.03, 0, 0.02, d / 2 - 0.015), box(0.025, 0.3, 0.03, -w / 2 + 0.07, h * 0.68, d / 2 + 0.015, 'accent'), box(0.025, 0.4, 0.03, -w / 2 + 0.07, h * 0.36, d / 2 + 0.015, 'accent')] },
  fridge_double: { name: 'Fridge (2-door)', cat: 'Kitchen', size: [0.92, 1.8, 0.72], main: '#3a3a3a', accent: CHROME, parts: (w, h, d) => [box(w, h, d - 0.04, 0, 0, -0.02), box(w / 2 - 0.015, h - 0.06, 0.03, -w / 4, 0.03, d / 2 - 0.015), box(w / 2 - 0.015, h - 0.06, 0.03, w / 4, 0.03, d / 2 - 0.015), box(0.025, 0.6, 0.03, -0.05, h * 0.45, d / 2 + 0.015, 'accent'), box(0.025, 0.6, 0.03, 0.05, h * 0.45, d / 2 + 0.015, 'accent')] },
  microwave: { name: 'Microwave', cat: 'Kitchen', size: [0.5, 0.3, 0.38], main: STEEL, elev: 0.9, parts: (w, h, d) => [box(w, h, d, 0, 0, 0), box(w * 0.62, h - 0.08, 0.01, -w * 0.14, 0.04, d / 2, '#15181c'), box(w * 0.18, h - 0.08, 0.01, w * 0.36, 0.04, d / 2, DARK)] },

  // Bathroom
  toilet:   { name: 'Toilet', cat: 'Bathroom', size: [0.4, 0.78, 0.68], main: WHITE, accent: '#e2e0d8', parts: (w, h, d) => [box(w, 0.36, 0.18, 0, 0.4, -d / 2 + 0.09), box(w + 0.02, 0.03, 0.2, 0, 0.76, -d / 2 + 0.09, 'accent'), cyl(0.13, 0.36, 0, 0, 0.02, 'main', { r2: 0.17 }), ball(0.2, 0, 0.3, 0.1, 'main', { sy: 0.28, sz: 1.25 }), ball(0.19, 0, 0.36, 0.1, 'accent', { sy: 0.1, sz: 1.22 })] },
  toilet_squat: { name: 'Squat toilet', cat: 'Bathroom', size: [0.5, 0.12, 0.7], main: WHITE, accent: '#cfd3d6', parts: (w, h, d) => [box(w, 0.1, d, 0, 0, 0), box(0.12, 0.02, d * 0.6, -0.16, 0.1, 0, 'accent'), box(0.12, 0.02, d * 0.6, 0.16, 0.1, 0, 'accent'), ball(0.1, 0, 0.06, 0.02, '#9aa0a5', { sy: 0.25, sz: 2.2 })] },
  basin:    { name: 'Wash basin', cat: 'Bathroom', size: [0.5, 0.86, 0.42], main: WHITE, accent: CHROME, parts: (w, h, d) => [cyl(0.07, h - 0.18, 0, 0, -0.06, 'main', { r2: 0.1 }), box(w, 0.16, d, 0, h - 0.18, 0), box(w - 0.1, 0.01, d - 0.14, 0, h - 0.015, 0.02, '#d5dde2'), cyl(0.014, 0.12, 0, h - 0.02, -d / 2 + 0.06, 'accent'), cyl(0.011, 0.1, 0, h + 0.08, -d / 2 + 0.11, 'accent', { axis: 'z' })] },
  vanity:   { name: 'Vanity + mirror', cat: 'Bathroom', size: [0.8, 1.9, 0.48], main: '#a37350', accent: WHITE, parts: (w, h, d) => [box(w, 0.6, d - 0.04, 0, 0.22, -0.02), box(w + 0.02, 0.05, d, 0, 0.82, 0, 'accent'), ball(0.19, 0, 0.84, 0.03, 'accent', { sy: 0.22 }), cyl(0.014, 0.14, 0, 0.87, -d / 2 + 0.07, CHROME), box(w - 0.1, 0.8, 0.02, 0, 1.1, -d / 2 + 0.01, '#cfe3ee'), box(w - 0.04, 0.86, 0.015, 0, 1.07, -d / 2 + 0.005, 'main')] },
  shower:   { name: 'Shower', cat: 'Bathroom', size: [0.9, 2.1, 0.9], main: WHITE, accent: CHROME, parts: (w, h, d) => [box(w, 0.06, d, 0, 0, 0), cyl(0.014, h - 0.1, -w / 2 + 0.06, 0.06, -d / 2 + 0.06, 'accent'), box(0.024, 0.024, 0.34, -w / 2 + 0.06, h - 0.06, -d / 2 + 0.22, 'accent'), cyl(0.1, 0.02, -w / 2 + 0.06, h - 0.09, -d / 2 + 0.38, 'accent', { seg: 16 }), box(0.01, h - 0.1, d, w / 2 - 0.005, 0.06, 0, '#ffffff', { glass: true }), box(w * 0.55, h - 0.1, 0.01, w / 2 - w * 0.275, 0.06, d / 2 - 0.005, '#ffffff', { glass: true })] },
  bathtub:  { name: 'Bathtub', cat: 'Bathroom', size: [1.7, 0.55, 0.75], main: WHITE, accent: '#cfe3ee', parts: (w, h, d) => [box(w, h, d, 0, 0, 0), box(w - 0.14, 0.02, d - 0.14, 0, h - 0.015, 0, 'accent'), cyl(0.015, 0.14, -w / 2 + 0.07, h, 0, CHROME)] },
  geyser:   { name: 'Water heater', cat: 'Bathroom', size: [0.42, 0.6, 0.42], main: WHITE, accent: '#b8593e', mount: 'wall', elev: 1.9, parts: (w, h) => [cyl(w / 2, h, 0, 0, 0, 'main', { seg: 18 }), cyl(w / 2 + 0.004, 0.05, 0, 0.04, 0, 'accent', { seg: 18 }), cyl(0.012, 0.1, -0.08, -0.1, 0, CHROME), cyl(0.012, 0.1, 0.08, -0.1, 0, CHROME)] },

  // Appliances
  washer:   { name: 'Washing machine', cat: 'Appliances', size: [0.6, 0.85, 0.6], main: WHITE, accent: STEEL, parts: (w, h, d) => [box(w, h, d - 0.02, 0, 0, -0.01), cyl(0.2, 0.03, 0, h * 0.42 - 0.2, d / 2 - 0.02, 'accent', { axis: 'z', seg: 20 }), cyl(0.15, 0.035, 0, h * 0.42 - 0.15, d / 2 - 0.02, '#2a3440', { axis: 'z', seg: 20 }), box(w - 0.06, 0.09, 0.01, 0, h - 0.13, d / 2 - 0.005, 'accent')] },
  ac_indoor: { name: 'AC (split unit)', cat: 'Appliances', size: [0.9, 0.3, 0.22], main: WHITE, accent: '#d5d9dd', mount: 'wall', elev: 2.2, parts: (w, h, d) => [box(w, h, d, 0, 0, 0), box(w - 0.06, 0.03, 0.02, 0, 0.03, d / 2, 'accent'), box(w - 0.06, 0.012, 0.02, 0, 0.1, d / 2, 'accent'), box(0.03, 0.015, 0.01, w / 2 - 0.08, h - 0.08, d / 2, '#59c36a', { glow: true })] },
  ac_outdoor: { name: 'AC outdoor unit', cat: 'Appliances', size: [0.85, 0.6, 0.32], main: '#e2e0d8', accent: '#70706c', parts: (w, h, d) => [box(w, h, d, 0, 0.05, 0), cyl(0.24, 0.02, -0.1, h / 2 - 0.19, d / 2 - 0.005, 'accent', { axis: 'z', seg: 20 }), box(0.06, 0.05, d, -w / 2 + 0.1, 0, 0, DARK), box(0.06, 0.05, d, w / 2 - 0.1, 0, 0, DARK)] },
  fan_ceiling: { name: 'Ceiling fan', cat: 'Appliances', size: [1.2, 0.35, 1.2], main: '#f4f3ee', accent: '#8a5a3c', mount: 'ceiling', parts: (w, h) => [cyl(0.015, h - 0.08, 0, 0.08, 0, CHROME), cyl(0.09, 0.08, 0, 0, 0, 'main', { seg: 16 }), ...[0, 1, 2].map(i => box(w / 2 - 0.06, 0.012, 0.12, Math.cos(i * 2.094) * (w / 4 + 0.03), 0.03, -Math.sin(i * 2.094) * (w / 4 + 0.03), 'accent', { ry: i * 2.094 }))] },
  fan_stand: { name: 'Pedestal fan', cat: 'Appliances', size: [0.45, 1.3, 0.4], main: '#f4f3ee', accent: '#70706c', parts: (w, h, d) => [cyl(0.2, 0.04, 0, 0, 0, 'accent', { seg: 18 }), cyl(0.02, h - 0.4, 0, 0.04, 0, CHROME), cyl(0.21, 0.1, 0, h - 0.42, 0.02, 'main', { axis: 'z', seg: 20 }), cyl(0.05, 0.16, 0, h - 0.26, -0.05, 'accent', { axis: 'z' })] },
  water_pump: { name: 'Water pump', cat: 'Appliances', size: [0.45, 0.35, 0.25], main: '#4f7fa6', accent: '#70706c', parts: (w, h, d) => [box(w, 0.04, d, 0, 0, 0, 'accent'), cyl(0.1, w * 0.55, -w * 0.12, 0.06, 0, 'main', { axis: 'x', seg: 16 }), cyl(0.12, 0.12, w * 0.28, 0.04, 0, 'accent', { axis: 'x', seg: 16 }), cyl(0.03, 0.14, w * 0.28, 0.24, 0, 'accent')] },
  inverter: { name: 'Inverter / UPS', cat: 'Appliances', size: [0.4, 0.5, 0.45], main: '#3a3a3a', accent: '#59c36a', parts: (w, h, d) => [box(w, h * 0.55, d, 0, 0, 0, '#22262b'), box(w - 0.04, h * 0.42, d - 0.08, 0, h * 0.56, 0), box(0.05, 0.02, 0.01, 0, h * 0.8, d / 2 - 0.04, 'accent', { glow: true })] },

  // Lighting
  light_ceiling: { name: 'Ceiling light', cat: 'Lighting', size: [0.36, 0.1, 0.36], main: '#fff6dc', accent: '#d5d9dd', mount: 'ceiling', light: { y: -0.15, power: 1 }, parts: (w, h) => [cyl(w / 2, 0.03, 0, h - 0.03, 0, 'accent', { seg: 20 }), cyl(w / 2 - 0.03, h - 0.03, 0, 0, 0, 'main', { seg: 20, r2: w / 2 - 0.01, glow: true })] },
  light_pendant: { name: 'Pendant lamp', cat: 'Lighting', size: [0.4, 0.8, 0.4], main: '#3a3a3a', accent: '#fff2c4', mount: 'ceiling', light: { y: -0.1, power: 0.9 }, parts: (w, h) => [cyl(0.006, h - 0.22, 0, 0.22, 0, DARK), cyl(w / 2, 0.22, 0, 0, 0, 'main', { r2: 0.05, seg: 18 }), ball(0.06, 0, -0.02, 0, 'accent', { glow: true })] },
  light_tube: { name: 'Tube light', cat: 'Lighting', size: [1.2, 0.06, 0.08], main: '#ffffff', accent: '#d5d9dd', mount: 'wall', elev: 2.3, light: { y: 0, power: 1 }, parts: (w, h, d) => [box(w, h, d * 0.5, 0, 0, -d / 4, 'accent'), cyl(0.018, w - 0.06, 0, 0.01, d / 4, 'main', { axis: 'x', glow: true })] },
  light_wall: { name: 'Wall light', cat: 'Lighting', size: [0.18, 0.28, 0.14], main: '#fff2c4', accent: '#3a3a3a', mount: 'wall', elev: 1.8, light: { y: 0.15, power: 0.6 }, parts: (w, h, d) => [box(0.1, 0.16, 0.03, 0, 0.04, -d / 2 + 0.015, 'accent'), cyl(w / 2, h * 0.6, 0, h * 0.3, 0.01, 'main', { r2: w / 2 - 0.03, glow: true, seg: 12 })] },
  lamp_floor: { name: 'Floor lamp', cat: 'Lighting', size: [0.4, 1.6, 0.4], main: '#f5e9c8', accent: '#3a3a3a', light: { y: 1.4, power: 0.8 }, parts: (w, h) => [cyl(0.14, 0.03, 0, 0, 0, 'accent', { seg: 16 }), cyl(0.014, h - 0.3, 0, 0.03, 0, 'accent'), cyl(w / 2, 0.3, 0, h - 0.3, 0, 'main', { r2: w / 2 - 0.07, glow: true, seg: 16 })] },
  lamp_table: { name: 'Table lamp', cat: 'Lighting', size: [0.26, 0.45, 0.26], main: '#f5e9c8', accent: '#8a5a3c', elev: 0.5, light: { y: 0.35, power: 0.5 }, parts: (w, h) => [cyl(0.07, 0.03, 0, 0, 0, 'accent'), cyl(0.02, h - 0.22, 0, 0.03, 0, 'accent'), cyl(w / 2, 0.2, 0, h - 0.2, 0, 'main', { r2: w / 2 - 0.05, glow: true, seg: 14 })] },

  // Storage
  drawers:  { name: 'Chest of drawers', cat: 'Storage', size: [0.9, 0.9, 0.45], main: '#a37350', accent: '#c79a6b', parts: (w, h, d) => [box(w, h, d - 0.02, 0, 0, -0.01), ...[0, 1, 2, 3].flatMap(i => [box(w - 0.06, (h - 0.1) / 4 - 0.02, 0.02, 0, 0.06 + i * (h - 0.1) / 4, d / 2 - 0.01, 'accent'), box(0.14, 0.02, 0.02, 0, 0.06 + (i + 0.5) * (h - 0.1) / 4 - 0.01, d / 2 + 0.01, CHROME)])] },
  shoe_rack: { name: 'Shoe rack', cat: 'Storage', size: [0.8, 1.0, 0.32], main: '#c79a6b', accent: '#a37350', parts: cupboard(2) },
  shelf_wall: { name: 'Wall shelf', cat: 'Storage', size: [0.9, 0.04, 0.22], main: '#8a5a3c', mount: 'wall', elev: 1.5, parts: (w, h, d) => [box(w, h, d, 0, 0, 0)] },
  storage_box: { name: 'Storage box', cat: 'Storage', size: [0.6, 0.45, 0.4], main: '#4f7fa6', accent: '#2c4a6b', parts: (w, h, d) => [box(w, h - 0.05, d, 0, 0, 0), box(w + 0.03, 0.05, d + 0.03, 0, h - 0.05, 0, 'accent')] },

  // Outdoor
  water_tank: { name: 'Water tank', cat: 'Outdoor', size: [1.2, 1.4, 1.2], main: '#22252a', accent: '#3a3f46', parts: (w, h) => [cyl(w / 2, h * 0.78, 0, 0, 0, 'main', { seg: 22 }), cyl(w / 2, h * 0.14, 0, h * 0.78, 0, 'main', { r2: w * 0.22, seg: 22 }), cyl(w * 0.2, h * 0.08, 0, h * 0.92, 0, 'accent', { seg: 16 }), ...[0.2, 0.4, 0.6].map(f => cyl(w / 2 + 0.012, 0.03, 0, h * f, 0, 'accent', { seg: 22 }))] },
  plant_small: { name: 'Potted plant', cat: 'Outdoor', size: [0.4, 0.6, 0.4], main: GREEN, accent: '#b8593e', parts: plant(0.12, 0.2, false) },
  plant_tall: { name: 'Tall plant', cat: 'Outdoor', size: [0.6, 1.6, 0.6], main: LEAF, accent: '#e8dcc8', parts: plant(0.15, 0.3, true) },
  bush:     { name: 'Bush', cat: 'Outdoor', size: [1.0, 0.8, 1.0], main: GREEN, parts: (w, h) => [ball(w * 0.42, 0, -0.05, 0, 'main', { sy: h / (w * 0.84) }), ball(w * 0.28, w * 0.2, 0, w * 0.1), ball(w * 0.26, -w * 0.22, 0, -w * 0.08)] },
  tree:     { name: 'Tree', cat: 'Outdoor', size: [2.4, 4.2, 2.4], main: LEAF, accent: '#6b4a2e', parts: (w, h) => [cyl(0.14, h * 0.5, 0, 0, 0, 'accent', { r2: 0.09 }), ball(w * 0.42, 0, h * 0.4, 0, 'main', { sy: (h * 0.6) / (w * 0.84) }), ball(w * 0.3, w * 0.2, h * 0.38, w * 0.12), ball(w * 0.28, -w * 0.2, h * 0.45, -w * 0.1)] },
  bench:    { name: 'Garden bench', cat: 'Outdoor', size: [1.4, 0.85, 0.55], main: '#8a5a3c', accent: '#3a3a3a', parts: (w, h, d) => [...[0, 1, 2].map(i => box(w, 0.03, 0.14, 0, 0.42, -d / 2 + 0.16 + i * 0.16)), ...[0, 1].map(i => box(w, 0.12, 0.03, 0, 0.55 + i * 0.16, -d / 2 + 0.03)), ...[-1, 1].flatMap(s => [box(0.05, 0.42, d - 0.06, s * (w / 2 - 0.1), 0, 0, 'accent'), box(0.05, h - 0.42, 0.05, s * (w / 2 - 0.1), 0.42, -d / 2 + 0.03, 'accent')])] },
  car:      { name: 'Car', cat: 'Outdoor', size: [1.8, 1.45, 4.2], main: '#4f7fa6', accent: '#1e1e1e', parts: (w, h, d) => [box(w, 0.55, d, 0, 0.3, 0), box(w - 0.16, 0.5, d * 0.5, 0, 0.85, -d * 0.04), box(w - 0.2, 0.36, 0.02, 0, 0.9, d * 0.21, '#1c2a36'), box(w - 0.2, 0.36, 0.02, 0, 0.9, -d * 0.29, '#1c2a36'), box(0.02, 0.34, d * 0.44, w / 2 - 0.08, 0.9, -d * 0.04, '#1c2a36'), box(0.02, 0.34, d * 0.44, -w / 2 + 0.08, 0.9, -d * 0.04, '#1c2a36'),
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(0.32, 0.22, sx * (w / 2 - 0.1), 0, sz * d * 0.3, 'accent', { axis: 'x', seg: 16 }))),
    box(0.3, 0.1, 0.02, -w / 2 + 0.3, 0.6, d / 2, '#fff6dc', { glow: true }), box(0.3, 0.1, 0.02, w / 2 - 0.3, 0.6, d / 2, '#fff6dc', { glow: true })] },
  gate:     { name: 'Gate', cat: 'Outdoor', size: [3.0, 1.6, 0.08], main: '#3a3a3a', accent: '#70706c', parts: (w, h, d) => [box(0.1, h + 0.1, 0.1, -w / 2 + 0.05, 0, 0, 'accent'), box(0.1, h + 0.1, 0.1, w / 2 - 0.05, 0, 0, 'accent'), box(w - 0.2, 0.05, 0.04, 0, 0.1, 0), box(w - 0.2, 0.05, 0.04, 0, h - 0.1, 0), ...Array.from({ length: 13 }, (_, i) => box(0.03, h - 0.2, 0.03, -w / 2 + 0.2 + i * (w - 0.4) / 12, 0.1, 0))] },
};

/** Default height above the floor for an item on a level with the given ceiling height. */
export function defaultElev(def, ceiling) {
  if (def.mount === 'ceiling') return Math.max(0, ceiling - def.size[1]);
  return def.elev || 0;
}
