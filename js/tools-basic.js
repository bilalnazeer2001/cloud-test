'use strict';
/* PCB trace width, Ohm's law, resistor combos, standard values, LED resistor, voltage divider */
(() => {
  const U = BT.UNITS, RATINGS = [0.125, 0.25, 0.5, 1, 2, 5];
  const rating = p => { const r = RATINGS.find(x => x >= p * 2); return r ? (r < 1 ? `1/${1 / r} W` : r + ' W') : 'over 5 W — use a power resistor'; };

  BT.add({
    id: 'trace-width', cat: 'PCB', title: 'PCB trace width & current',
    desc: 'IPC-2221 trace width for a current, or the current a trace can carry.',
    keys: 'ipc 2221 copper track amps ampacity temperature rise oz mil voltage drop',
    notes: [
      'Formula (IPC-2221): I = k × ΔT^0.44 × A^0.725, with A the copper cross-section in mil². k = 0.048 for outer layers and 0.024 for inner layers, which shed heat less well.',
      'The charts behind it cover up to 35 A, 10–100 °C rise, 0.5–3 oz copper and widths up to 400 mil (10 mm). Outside that, treat the answer as a rough guide.',
      'It is a conservative rule of thumb. Nearby copper planes cool a trace, so real boards usually run cooler. Add margin for traces that matter, and check your PCB maker’s minimum width.',
    ],
    render(root) {
      BT.form(root, this.id, [
        { id: 'mode', type: 'seg', label: 'I want to find', value: 'w', options: [['w', 'Trace width'], ['i', 'Max current']] },
        { id: 'i', label: 'Current', value: '2', unit: 'A', show: v => v.mode === 'w' },
        { id: 'w', label: 'Trace width', value: '0.5', units: [['mm', 1], ['mil', 0.0254]], show: v => v.mode === 'i' },
        { id: 'oz', type: 'select', label: 'Copper thickness', value: '1', options: [['0.5', '0.5 oz (17.5 µm)'], ['1', '1 oz (35 µm)'], ['2', '2 oz (70 µm)'], ['3', '3 oz (105 µm)']] },
        { id: 'dt', label: 'Allowed temp rise', value: '10', unit: '°C', hint: '10 °C is the usual safe choice' },
        { id: 'layer', type: 'select', label: 'Layer', value: 'ext', options: [['ext', 'Outer (top/bottom)'], ['int', 'Inner']] },
        { id: 'len', label: 'Trace length', value: '50', unit: 'mm', opt: true, hint: 'Optional — for voltage drop' },
        { id: 'ta', label: 'Ambient temp', value: '25', unit: '°C', opt: true },
      ], v => {
        if (!(v.dt > 0)) return 'Temperature rise must be above 0 °C.';
        const thMil = +v.oz * 1.378, K = { ext: 0.048, int: 0.024 };
        const area = (I, k) => (I / (k * v.dt ** 0.44)) ** (1 / 0.725);            // mil²
        const amps = (wMil, k) => k * v.dt ** 0.44 * (wMil * thMil) ** 0.725;
        const other = v.layer === 'ext' ? 'int' : 'ext', name = { ext: 'outer', int: 'inner' };
        const rows = [];
        let I, wMil;
        if (v.mode === 'w') {
          if (!(v.i > 0)) return 'Current must be above 0 A.';
          I = v.i; wMil = area(I, K[v.layer]) / thMil;
          const w2 = area(I, K[other]) / thMil;
          rows.push({ main: 1, l: 'Minimum trace width', v: `${fmt(wMil * 0.0254, 3)} mm`, n: `${fmt(wMil, 3)} mil on an ${name[v.layer]} layer` },
            { l: `Same current, ${name[other]} layer`, v: `${fmt(w2 * 0.0254, 3)} mm`, n: `${fmt(w2, 3)} mil` });
        } else {
          if (!(v.w > 0)) return 'Width must be above 0.';
          wMil = v.w / 0.0254; I = amps(wMil, K[v.layer]);
          rows.push({ main: 1, l: 'Maximum current', v: `${fmt(I, 3)} A`, n: `${fmt(v.w, 3)} mm (${fmt(wMil, 3)} mil) on an ${name[v.layer]} layer` },
            { l: `Same width, ${name[other]} layer`, v: `${fmt(amps(wMil, K[other]), 3)} A` });
        }
        if (v.len > 0) {
          const A = wMil * thMil * (25.4e-6) ** 2;                                  // m²
          const R = 1.724e-8 * (v.len / 1000) / A * (1 + 0.00393 * (z(v.ta) + v.dt - 20));
          rows.push({ head: `Over ${fmt(v.len)} mm at ${fmt(I, 3)} A` },
            { l: 'Trace resistance', v: fmtSI(R, 'Ω'), n: `At ${fmt(z(v.ta) + v.dt)} °C copper temperature` },
            { l: 'Voltage drop', v: fmtSI(I * R, 'V') }, { l: 'Heat in the trace', v: fmtSI(I * I * R, 'W') });
        }
        if (I > 35 || wMil > 400 || v.dt > 100 || v.dt < 10) rows.push({ warn: 1, l: 'Outside IPC-2221 range', v: '!', n: 'The standard covers up to 35 A, 400 mil width and 10–100 °C rise. Treat this as a rough guide.' });
        return rows;
      });
    },
  });

  BT.add({
    id: 'ohms-law', cat: 'Basics', title: 'Ohm’s law & power',
    desc: 'Enter any two of voltage, current, resistance, power.',
    keys: 'volts amps watts v=ir p=vi resistor',
    notes: ['V = I × R and P = V × I. Leave two boxes empty and the tool fills in the rest.'],
    render(root) {
      BT.form(root, this.id, [
        { id: 'v', label: 'Voltage', value: '5', unit: 'V', opt: true },
        { id: 'i', label: 'Current', value: '', units: U.amp, u: 'mA', opt: true },
        { id: 'r', label: 'Resistance', value: '220', units: U.ohm, opt: true },
        { id: 'p', label: 'Power', value: '', units: [['W', 1], ['mW', 1e-3]], opt: true },
      ], x => {
        const has = ['v', 'i', 'r', 'p'].filter(k => isFinite(x[k]));
        if (has.length !== 2) return `Enter exactly two values and leave the other two empty (${has.length} filled in now).`;
        if (has.some(k => !(x[k] > 0))) return 'Values must be above zero.';
        let { v, i, r, p } = x;
        const k = has.join('');
        if (k === 'vi') { r = v / i; p = v * i; } else if (k === 'vr') { i = v / r; p = v * v / r; }
        else if (k === 'vp') { i = p / v; r = v * v / p; } else if (k === 'ir') { v = i * r; p = i * i * r; }
        else if (k === 'ip') { v = p / i; r = p / (i * i); } else { v = Math.sqrt(p * r); i = Math.sqrt(p / r); }
        const row = (key, l, val) => ({ l, v: val, main: !has.includes(key) });
        return [row('v', 'Voltage', fmtSI(v, 'V')), row('i', 'Current', fmtSI(i, 'A')), row('r', 'Resistance', fmtSI(r, 'Ω')),
          { ...row('p', 'Power', fmtSI(p, 'W')), n: `Resistor rating to pick: ${rating(p)} (2× safety margin)` }];
      });
    },
  });

  BT.add({
    id: 'resistor-combos', cat: 'Basics', title: 'Resistors in series & parallel',
    desc: 'Total of several resistors, both ways.',
    keys: 'combine total equivalent 4k7 parallel series',
    notes: ['Series adds up: R = R1 + R2 + …  Parallel: 1/R = 1/R1 + 1/R2 + …', 'Capacitors work the other way round — parallel adds up, series uses the reciprocal formula — so the same numbers apply with the labels swapped.'],
    render(root) {
      BT.form(root, this.id, [
        { id: 'list', type: 'text', wide: true, label: 'Values, separated by commas or spaces', value: '10k, 4k7, 220', hint: 'Shorthand works: 220, 4k7, 4.7k, 1M' },
      ], v => {
        const parts = v.list.split(/[,;\s]+/).filter(Boolean), vals = parts.map(parseNum);
        const bad = parts.filter((_, i) => !(vals[i] > 0));
        if (bad.length) return `Can’t read “${bad[0]}”. Use forms like 220, 4k7 or 1M.`;
        if (vals.length < 2) return 'Enter at least two values.';
        const s = vals.reduce((a, b) => a + b, 0), p = 1 / vals.reduce((a, b) => a + 1 / b, 0);
        return [{ main: 1, l: 'In series', v: fmtSI(s, 'Ω', 4) }, { main: 1, l: 'In parallel', v: fmtSI(p, 'Ω', 4) },
          { l: 'Values read', v: String(vals.length), n: vals.map(x => fmtSI(x, 'Ω', 4)).join(' · ') }];
      });
    },
  });

  BT.add({
    id: 'standard-values', cat: 'Basics', title: 'Nearest standard resistor',
    desc: 'Closest E12 / E24 / E96 value you can actually buy.',
    keys: 'e series preferred value e12 e24 e96 1% 5%',
    notes: ['E12 is the common 10 % range, E24 is 5 %, and E96 is the 1 % range. Most hobby kits are E12 or E24.'],
    render(root) {
      BT.form(root, this.id, [{ id: 'r', label: 'Calculated value', value: '3.4', units: U.ohm, u: 'kΩ', wide: true }], v => {
        if (!(v.r > 0)) return 'Value must be above zero.';
        return ['E12', 'E24', 'E96'].map(s => {
          const n = BT.nearestE(v.r, s);
          return { main: s === 'E24', l: s, v: fmtSI(n, 'Ω', 4), n: `${n >= v.r ? '+' : '−'}${Math.abs((n / v.r - 1) * 100).toFixed(2)} % from your value` };
        });
      });
    },
  });

  BT.add({
    id: 'led-resistor', cat: 'Basics', title: 'LED series resistor',
    desc: 'Resistor value and wattage for one or more LEDs.',
    keys: 'current limiting forward voltage vf brightness gpio',
    notes: ['R = (supply − LEDs × forward voltage) ÷ current. The tool rounds up to the next standard value so the LED never gets more current than you asked for.',
      'Typical forward voltages: red 1.8–2.1 V, yellow 2.0 V, green 2.0–3.2 V, blue and white 3.0–3.3 V, infrared 1.2–1.5 V. Check the LED’s datasheet if you have it.'],
    render(root) {
      BT.form(root, this.id, [
        { id: 'vs', label: 'Supply voltage', value: '3.3', unit: 'V' },
        { id: 'vf', label: 'LED forward voltage', value: '2.0', unit: 'V', hint: 'Red ≈ 2.0 · Blue/White ≈ 3.2' },
        { id: 'i', label: 'LED current', value: '10', unit: 'mA', hint: 'ESP32 pin: stay at 20 mA or less' },
        { id: 'n', label: 'LEDs in series', value: '1', unit: 'pcs' },
        { id: 'ser', type: 'select', label: 'Resistor range', value: 'E12', options: [['E12', 'E12 (common)'], ['E24', 'E24'], ['E96', 'E96 (1 %)']] },
      ], v => {
        const n = Math.round(v.n), I = v.i / 1000, drop = v.vs - n * v.vf;
        if (!(n >= 1) || !(I > 0) || !(v.vf > 0)) return 'Current, forward voltage and LED count must be above zero.';
        if (drop <= 0) return `The supply (${fmt(v.vs)} V) is not higher than the LEDs need (${fmt(n * v.vf)} V), so they will not light. Use fewer LEDs in series or a higher supply.`;
        const R = drop / I, Rs = BT.nearestE(R, v.ser, 'up'), Ia = drop / Rs, P = Ia * Ia * Rs;
        return [{ main: 1, l: 'Use this resistor', v: fmtSI(Rs, 'Ω', 4), n: `Next ${v.ser} value above the exact ${fmtSI(R, 'Ω')}` },
          { l: 'Actual LED current', v: fmtSI(Ia, 'A') },
          { l: 'Resistor heat', v: fmtSI(P, 'W'), n: `Pick a ${rating(P)} resistor or bigger` },
          { l: 'Power in the LEDs', v: fmtSI(Ia * n * v.vf, 'W') },
          drop < 0.5 && { warn: 1, l: 'Little headroom', v: '!', n: 'Under 0.5 V across the resistor: brightness will change a lot with small supply or LED differences.' },
          v.i > 20 && { warn: 1, l: 'Above 20 mA', v: '!', n: 'Too much for a microcontroller pin. Drive the LED through a transistor or MOSFET.' }];
      });
    },
  });

  BT.add({
    id: 'voltage-divider', cat: 'Basics', title: 'Voltage divider',
    desc: 'Output voltage from two resistors, or resistors for a target voltage.',
    keys: 'adc level shift battery sense r1 r2 vout scale 5v to 3.3v',
    notes: ['Vout = Vin × R2 ÷ (R1 + R2). R1 goes from Vin to the output, R2 from the output to ground.',
      'Anything connected to the output acts as a resistor in parallel with R2 and pulls the voltage down. Fill in “Load” to see the effect.',
      'For an ESP32 analog input, keep R1 ∥ R2 under about 10 kΩ, or add a 100 nF capacitor from the output to ground so readings stay steady. Never feed a pin more than 3.3 V.'],
    render(root) {
      BT.form(root, this.id, [
        { id: 'mode', type: 'seg', label: 'I want to find', value: 'v', options: [['v', 'Output voltage'], ['r', 'Resistor values']] },
        { id: 'vin', label: 'Input voltage (Vin)', value: '5', unit: 'V' },
        { id: 'r1', label: 'R1 (Vin → output)', value: '10', units: U.ohm, u: 'kΩ', show: v => v.mode === 'v' },
        { id: 'r2', label: 'R2 (output → GND)', value: '20', units: U.ohm, u: 'kΩ', show: v => v.mode === 'v' },
        { id: 'rl', label: 'Load on output', value: '', units: U.ohm, u: 'kΩ', opt: true, hint: 'Optional', show: v => v.mode === 'v' },
        { id: 'vout', label: 'Wanted output (Vout)', value: '3.3', unit: 'V', show: v => v.mode === 'r' },
        { id: 'tot', label: 'Roughly R1 + R2', value: '30', units: U.ohm, u: 'kΩ', hint: 'Higher wastes less power', show: v => v.mode === 'r' },
        { id: 'ser', type: 'select', label: 'Resistor range', value: 'E24', options: [['E12', 'E12 (common)'], ['E24', 'E24'], ['E96', 'E96 (1 %)']], show: v => v.mode === 'r' },
      ], v => {
        if (!(v.vin > 0)) return 'Input voltage must be above zero.';
        if (v.mode === 'v') {
          if (!(v.r1 > 0 && v.r2 > 0)) return 'R1 and R2 must be above zero.';
          const vo = v.vin * v.r2 / (v.r1 + v.r2), th = v.r1 * v.r2 / (v.r1 + v.r2), rows = [];
          if (v.rl > 0) {
            const rb = v.r2 * v.rl / (v.r2 + v.rl), vl = v.vin * rb / (v.r1 + rb);
            rows.push({ main: 1, l: 'Output with load', v: `${fmt(vl)} V`, n: `${fmt(vo)} V with nothing connected — the load pulls it down ${pct((1 - vl / vo) * 100)}` });
          } else rows.push({ main: 1, l: 'Output voltage', v: `${fmt(vo)} V`, n: `${pct(vo / v.vin * 100)} of the input` });
          rows.push({ l: 'Current through divider', v: fmtSI(v.vin / (v.r1 + v.r2), 'A') },
            { l: 'Power wasted', v: fmtSI(v.vin ** 2 / (v.r1 + v.r2), 'W') },
            { l: 'Output impedance (R1 ∥ R2)', v: fmtSI(th, 'Ω'), warn: th > 10e3, n: th > 10e3 ? 'High for an ADC input — add a 100 nF capacitor from the output to GND.' : null });
          return rows;
        }
        if (!(v.vout > 0 && v.vout < v.vin)) return 'The wanted output must be above zero and below the input voltage.';
        if (!(v.tot > 0)) return 'R1 + R2 must be above zero.';
        const ratio = v.vin / v.vout - 1, found = [], seen = new Set();
        for (let d = -1; d <= 7; d++) for (const m of BT.E[v.ser]) {
          const r2 = parseFloat((m * 10 ** d).toPrecision(4)), r1 = BT.nearestE(r2 * ratio, v.ser), sum = r1 + r2;
          if (sum < v.tot / 3 || sum > v.tot * 3 || seen.has(r1 + '/' + r2)) continue;
          seen.add(r1 + '/' + r2);
          const vo = v.vin * r2 / sum;
          found.push({ r1, r2, vo, err: Math.abs(vo / v.vout - 1) * 100, far: Math.abs(Math.log(sum / v.tot)) });
        }
        if (!found.length) return 'No resistor pair in that range. Try a different R1 + R2.';
        found.sort((a, b) => (a.err - b.err) || (a.far - b.far));
        const best = found[0].err, top = found.filter(f => f.err <= best + 0.05).sort((a, b) => a.far - b.far).slice(0, 1)
          .concat(found).filter((f, i, a) => a.indexOf(f) === i).slice(0, 3);
        return top.map((f, i) => ({ main: i === 0, l: i === 0 ? 'Best match' : `Option ${i + 1}`, v: `R1 ${fmtSI(f.r1, 'Ω', 4)} · R2 ${fmtSI(f.r2, 'Ω', 4)}`,
          n: `Gives ${fmt(f.vo)} V (${f.err.toFixed(2)} % off) and draws ${fmtSI(v.vin / (f.r1 + f.r2), 'A')}` }));
      });
    },
  });
})();
