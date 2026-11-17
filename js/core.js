'use strict';
/* Shared helpers: DOM builder, number parsing/formatting, E-series, and the form builder
   every calculator uses. Each tool file calls BT.add({...}) to register itself. */
const BT = { tools: [] };
BT.add = t => BT.tools.push(t);

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
}

/* "4.7k", "4k7", "100n", "2,5" -> number. Returns NaN when it is not a number. */
function parseNum(s) {
  s = String(s).trim().replace(',', '.').replace(/\s+/g, '');
  if (!s) return NaN;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([pnuµmkKMGR]?)(\d*)$/.exec(s);
  if (!m) return NaN;
  const mult = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, '': 1 }[m[2]];
  if (m[3] && (m[1].includes('.') || !m[2])) return NaN;
  return parseFloat(m[3] ? m[1] + '.' + m[3] : m[1]) * mult;
}

function fmt(x, sig = 4) {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e9 || a < 1e-6) return x.toExponential(sig - 1);
  return String(parseFloat(x.toPrecision(sig)));
}
function fmtSI(x, unit, sig = 3) {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0 ' + unit;
  const P = ['p', 'n', 'µ', 'm', '', 'k', 'M', 'G'];
  let i = Math.floor(Math.log10(Math.abs(x)) / 3);
  i = Math.max(-4, Math.min(3, i));
  let v = parseFloat((x / 10 ** (3 * i)).toPrecision(sig));
  if (Math.abs(v) >= 1000 && i < 3) { v /= 1000; i++; }
  return v + ' ' + P[i + 4] + unit;
}
const pct = (x, d = 1) => isFinite(x) ? x.toFixed(d) + ' %' : '—';
const z = x => (isFinite(x) ? x : 0);

/* Standard resistor series, as mantissas 1.0 – 9.x */
BT.E = {
  E6: [1, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
  E96: Array.from({ length: 96 }, (_, i) => Math.round(10 ** (i / 96) * 100) / 100),
};
/* mode: 'near' | 'up' | 'down' */
BT.nearestE = (v, series = 'E24', mode = 'near') => {
  if (!(v > 0)) return NaN;
  const d = 10 ** Math.floor(Math.log10(v));
  const c = [...BT.E[series].map(m => m * d), 10 * d, BT.E[series].at(-1) * d / 10];
  const ok = c.filter(x => mode === 'up' ? x >= v * (1 - 1e-9) : mode === 'down' ? x <= v * (1 + 1e-9) : true);
  const best = ok.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
  return parseFloat(best.toPrecision(4));
};

BT.store = {
  get(k, d) { try { const s = localStorage.getItem('bt:' + k); return s === null ? d : s; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bt:' + k, v); } catch (e) { /* private mode */ } },
};

BT.UNITS = {
  ohm: [['Ω', 1], ['kΩ', 1e3], ['MΩ', 1e6]],
  amp: [['A', 1], ['mA', 1e-3]],
  cap: [['µF', 1e-6], ['nF', 1e-9], ['pF', 1e-12]],
  freq: [['Hz', 1], ['kHz', 1e3], ['MHz', 1e6]],
};

BT.renderRows = (out, rows) => {
  out.replaceChildren();
  if (typeof rows === 'string') return void out.append(h('p', { class: 'msg' }, rows));
  for (const r of rows) {
    if (!r) continue;
    if (r.head) { out.append(h('h3', null, r.head)); continue; }
    out.append(h('div', { class: 'row' + (r.main ? ' main' : '') + (r.warn ? ' warn' : '') + (r.bad ? ' bad' : '') },
      h('span', { class: 'k' }, r.l), h('span', { class: 'v' }, r.v), r.n && h('small', null, r.n)));
  }
};

/* Build a form. fields: [{id, label, value, type:'num'|'select'|'seg'|'text', unit, units, u,
   options, hint, opt, wide, show(v)}]. compute(v) returns result rows or a message string. */
BT.form = (root, tid, fields, compute) => {
  const wrap = h('div', { class: 'fields' });
  const out = h('div', { class: 'results', 'aria-live': 'polite' });
  const C = {};
  const sv = (f, d) => BT.store.get(`${tid}:${f.id}`, d);
  const update = () => {
    const v = {};
    for (const f of fields) {
      const c = C[f.id];
      if (f.type === 'seg') v[f.id] = c.box.querySelector('input:checked').value;
      else if (f.type === 'select' || f.type === 'text') v[f.id] = c.inp.value;
      else v[f.id] = parseNum(c.inp.value) * (c.sel ? +c.sel.value : 1);
    }
    let missing = false;
    for (const f of fields) {
      const vis = !f.show || f.show(v);
      C[f.id].box.hidden = !vis;
      if (vis && !f.opt && (!f.type || f.type === 'num') && !isFinite(v[f.id])) missing = true;
    }
    BT.renderRows(out, missing ? 'Fill in the fields above to see the result.' : compute(v));
  };
  for (const f of fields) {
    const id = `f-${tid}-${f.id}`, c = C[f.id] = {};
    const keep = el => el.addEventListener('input', () => { BT.store.set(`${tid}:${f.id}${el === c.sel ? ':u' : ''}`, el.value); update(); });
    let ctl;
    if (f.type === 'seg') {
      const cur = sv(f, f.value);
      ctl = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': f.label }, f.options.map(([val, lab]) => {
        const r = h('input', { type: 'radio', name: id, value: val, checked: val === cur });
        keep(r);
        return h('label', null, r, lab);
      }));
      if (!ctl.querySelector('input:checked')) ctl.querySelector('input').checked = true;
    } else if (f.type === 'select') {
      c.inp = h('select', { id }, f.options.map(([val, lab]) => h('option', { value: val }, lab)));
      c.inp.value = sv(f, f.value);
      if (c.inp.selectedIndex < 0) c.inp.selectedIndex = 0;
      keep(c.inp);
      ctl = h('div', { class: 'ctl' }, c.inp);
    } else {
      c.inp = h('input', { id, type: 'text', inputmode: f.type === 'text' ? null : 'decimal', autocomplete: 'off', value: sv(f, f.value ?? '') });
      keep(c.inp);
      if (f.units) {
        c.sel = h('select', { 'aria-label': f.label + ' unit' }, f.units.map(([lab, sc]) => h('option', { value: sc }, lab)));
        const def = f.units.find(u => u[0] === f.u) || f.units[0];
        c.sel.value = BT.store.get(`${tid}:${f.id}:u`, String(def[1]));
        if (c.sel.selectedIndex < 0) c.sel.value = String(def[1]);
        keep(c.sel);
      }
      ctl = h('div', { class: 'ctl' }, c.inp, c.sel, f.unit && h('span', { class: 'unit' }, f.unit));
    }
    c.box = h('div', { class: 'field' + (f.wide || f.type === 'seg' ? ' wide' : '') },
      h(f.type === 'seg' ? 'span' : 'label', { class: 'lbl', for: f.type === 'seg' ? null : id }, f.label), ctl,
      f.hint && h('span', { class: 'hint' }, f.hint));
    wrap.append(c.box);
  }
  root.append(wrap, out);
  update();
  return {
    update,
    set(fid, val) { C[fid].inp.value = val; BT.store.set(`${tid}:${fid}`, val); update(); },
  };
};
