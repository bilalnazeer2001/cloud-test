// Tiny DOM helpers.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Number field with a label. onChange gets a finite number. */
export function numField(label, value, onChange, { step = 0.05, min = -1e9, max = 1e9, unit = 'm', digits = 2 } = {}) {
  const input = h('input', { type: 'number', inputmode: 'decimal', step, min, max, value: (+value).toFixed(digits) });
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    if (isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
  });
  return h('label', { class: 'field' }, h('span', {}, label), h('div', { class: 'num' }, input, unit ? h('em', {}, unit) : null));
}

export function textField(label, value, onChange) {
  const input = h('input', { type: 'text', value: value || '' });
  input.addEventListener('change', () => onChange(input.value));
  return h('label', { class: 'field wide' }, h('span', {}, label), input);
}

export function rangeField(label, value, onInput, { min = 0, max = 1, step = 0.01, fmt = v => v, onChange } = {}) {
  const out = h('b', {}, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); onInput(+input.value); });
  if (onChange) input.addEventListener('change', () => onChange(+input.value));
  return h('label', { class: 'field wide range' }, h('span', {}, label, ' ', out), input);
}

/** Row of toggle chips. options: [{value,label}] */
export function chips(options, value, onPick, cls = '') {
  return h('div', { class: 'chips ' + cls }, options.map(o =>
    h('button', { class: 'chip' + (o.value === value ? ' on' : ''), title: o.title || o.label, onclick: () => onPick(o.value) }, o.icon ? h('span', { class: 'ci' }, o.icon) : null, o.label)));
}

export function toggle(label, on, onChange) {
  const input = h('input', { type: 'checkbox' });
  input.checked = !!on;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'toggle' }, input, h('span', {}, label));
}
