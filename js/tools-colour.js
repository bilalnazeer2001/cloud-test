'use strict';
/* Resistor colour code: bands -> value and value -> bands */
(() => {
  // name, css colour, text colour, digit, tolerance %, tempco ppm/K
  const COL = [
    ['Black', '#151515', '#fff', 0, null, null], ['Brown', '#7a4a21', '#fff', 1, 1, 100], ['Red', '#d32f2f', '#fff', 2, 2, 50],
    ['Orange', '#f57c00', '#000', 3, null, 15], ['Yellow', '#fdd835', '#000', 4, null, 25], ['Green', '#2e9e4f', '#fff', 5, 0.5, null],
    ['Blue', '#1e63c9', '#fff', 6, 0.25, 10], ['Violet', '#8e44ad', '#fff', 7, 0.1, 5], ['Grey', '#8a8a8a', '#000', 8, 0.05, null],
    ['White', '#f5f5f5', '#000', 9, null, null], ['Gold', '#c9a227', '#000', -1, 5, null], ['Silver', '#b8bcc0', '#000', -2, 10, null],
  ];
  const DEF = { 4: [1, 0, 2, 10], 5: [1, 0, 0, 1, 1], 6: [1, 0, 0, 1, 1, 1] };

  BT.add({
    id: 'colour-code', cat: 'Basics', title: 'Resistor colour code',
    desc: 'Read the bands on a resistor, or see the bands for a value.',
    keys: 'color bands stripes 4 band 5 band 6 band tolerance read identify',
    notes: ['Hold the resistor so the bands are bunched towards the left. The tolerance band (often gold or silver) sits apart on the right.',
      '4-band: two digits, multiplier, tolerance. 5-band: three digits, multiplier, tolerance. 6-band adds a temperature coefficient.',
      'If a reading looks wrong, try it the other way round, and check with a multimeter when it matters.'],
    render(root) {
      let n = +BT.store.get('cc:n', '4');
      let sel = JSON.parse(BT.store.get('cc:sel', 'null')) || DEF[n].slice();
      const svg = h('div'), bands = h('div'), out = h('div', { class: 'results', 'aria-live': 'polite' });
      const kinds = () => [...Array(n - 2 - (n === 6)).fill('d'), 'm', 't', ...(n === 6 ? ['c'] : [])];
      const choices = k => COL.map((c, i) => i).filter(i => k === 'd' ? COL[i][3] >= 0 : k === 'm' ? true : k === 't' ? COL[i][4] != null : COL[i][5] != null);
      const label = (k, i) => k === 'd' ? String(COL[i][3]) : k === 'm' ? '×' + fmtSI(10 ** COL[i][3], '').trim() : k === 't' ? '±' + COL[i][4] + '%' : COL[i][5] + '';
      const value = () => { const ks = kinds(), nd = ks.filter(k => k === 'd').length; return sel.slice(0, nd).reduce((a, i) => a * 10 + COL[i][3], 0) * 10 ** COL[sel[nd]][3]; };

      const valIn = h('input', { id: 'cc-val', type: 'text', autocomplete: 'off', placeholder: 'e.g. 4k7' });
      const draw = () => {
        const ks = kinds(), nd = ks.filter(k => k === 'd').length, val = value(), tol = COL[sel[nd + 1]][4];
        const xs = n === 4 ? [78, 104, 130, 196] : n === 5 ? [72, 96, 120, 144, 200] : [66, 88, 110, 132, 168, 204];
        svg.innerHTML = `<svg class="res-svg" viewBox="0 0 280 80" role="img" aria-label="Resistor with ${sel.map(i => COL[i][0]).join(', ')} bands">
          <path d="M0 40h50M230 40h50" stroke="#9aa0a6" stroke-width="5"/><rect x="46" y="14" width="188" height="52" rx="22" fill="#e3c9a0" stroke="#a88b5d"/>
          ${sel.map((i, b) => `<rect x="${xs[b]}" y="14.5" width="13" height="51" fill="${COL[i][1]}" stroke="rgba(0,0,0,.35)" stroke-width=".7"/>`).join('')}</svg>`;
        bands.replaceChildren(...ks.map((k, b) => h('div', { class: 'band' },
          h('div', { class: 'band-h' }, { d: `Digit ${b + 1}`, m: 'Multiplier', t: 'Tolerance', c: 'Temp. coefficient (ppm/K)' }[k], h('span', null, COL[sel[b]][0])),
          h('div', { class: 'sw-row' }, choices(k).map(i => h('button', {
            type: 'button', class: 'sw', style: `background:${COL[i][1]};color:${COL[i][2]}`, 'aria-pressed': String(sel[b] === i), 'aria-label': `${COL[i][0]} (${label(k, i)})`,
            onclick: () => { sel[b] = i; save(); draw(); valIn.value = ''; },
          }, label(k, i)))))));
        BT.renderRows(out, [
          { main: 1, l: 'Resistance', v: `${fmtSI(val, 'Ω', 4)} ±${tol} %` },
          { l: 'Allowed range', v: `${fmtSI(val * (1 - tol / 100), 'Ω', 4)} – ${fmtSI(val * (1 + tol / 100), 'Ω', 4)}` },
          n === 6 && { l: 'Temperature coefficient', v: `${COL[sel[5]][5]} ppm/K` },
          { l: 'Bands', v: sel.map(i => COL[i][0]).join(' · ') },
        ]);
      };
      const save = () => { BT.store.set('cc:n', n); BT.store.set('cc:sel', JSON.stringify(sel)); };
      const fromValue = () => {
        const v = parseNum(valIn.value), nd = n === 4 ? 2 : 3;
        if (!(v > 0)) return;
        let e = Math.floor(Math.log10(v)) - (nd - 1), m = Math.round(v / 10 ** e);
        if (m >= 10 ** nd) { m /= 10; e++; }
        if (e < -2 || e > 9) return void BT.renderRows(out, 'That value is outside what colour bands can show (0.1 Ω to 999 GΩ).');
        const digits = String(m).padStart(nd, '0').split('').map(Number);
        sel = [...digits, e === -1 ? 10 : e === -2 ? 11 : e, ...sel.slice(nd + 1)];
        save(); draw();
      };
      valIn.addEventListener('input', fromValue);
      const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Number of bands' }, [4, 5, 6].map(k => {
        const r = h('input', { type: 'radio', name: 'cc-n', value: k, checked: k === n });
        r.addEventListener('change', () => { const tol = sel[n === 4 ? 3 : 4]; n = k; sel = DEF[n].slice(); sel[n === 4 ? 3 : 4] = tol; save(); draw(); if (valIn.value) fromValue(); });
        return h('label', null, r, `${k} bands`);
      }));
      if (sel.length !== n) sel = DEF[n].slice();
      root.append(h('div', { class: 'fields' },
        h('div', { class: 'field wide' }, h('span', { class: 'lbl' }, 'Bands on the resistor'), seg),
        h('div', { class: 'field wide' }, h('label', { class: 'lbl', for: 'cc-val' }, 'Or type a value to see its bands'), h('div', { class: 'ctl' }, valIn, h('span', { class: 'unit' }, 'Ω')))),
        svg, out, bands);
      draw();
    },
  });
})();
