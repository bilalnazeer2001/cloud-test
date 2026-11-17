'use strict';
/* Buck / boost converter helpers and RC filter */
(() => {
  const U = BT.UNITS;
  const common = (vin, vout, iout, f) => [
    { id: 'vin', label: 'Input voltage', value: vin, unit: 'V' },
    { id: 'vout', label: 'Output voltage', value: vout, unit: 'V' },
    { id: 'iout', label: 'Output current', value: iout, unit: 'A' },
    { id: 'f', label: 'Switching frequency', value: f, units: [['kHz', 1e3], ['MHz', 1e6]], hint: 'From the chip’s datasheet' },
    { id: 'rip', label: 'Inductor ripple', value: '30', unit: '%', hint: '20–40 % is normal' },
    { id: 'dv', label: 'Output ripple allowed', value: '30', unit: 'mV' },
    { id: 'eff', label: 'Efficiency', value: '90', unit: '%', hint: 'Guess 85–95 %' },
    { id: 'vref', label: 'Feedback voltage (Vref)', value: '', unit: 'V', opt: true, hint: 'Optional — e.g. 0.8 or 1.25' },
    { id: 'rb', label: 'Lower feedback resistor', value: '10', units: U.ohm, u: 'kΩ', opt: true },
  ];
  const check = v => (!(v.vin > 0 && v.vout > 0 && v.iout > 0 && v.f > 0 && v.dv > 0) ? 'Voltages, current, frequency and ripple must be above zero.'
    : !(v.rip > 0 && v.rip <= 100) ? 'Inductor ripple should be between 1 and 100 %.' : !(v.eff > 0 && v.eff <= 100) ? 'Efficiency should be between 1 and 100 %.' : null);
  const feedback = v => (v.vref > 0 && v.rb > 0 && v.vref < v.vout) ? (() => {
    const rt = v.rb * (v.vout / v.vref - 1), n = BT.nearestE(rt, 'E96');
    return [{ head: 'Feedback divider' }, { l: 'Upper resistor (Vout → FB)', v: fmtSI(n, 'Ω', 4), n: `Exact ${fmtSI(rt, 'Ω', 4)}; nearest 1 % value gives ${fmt(v.vref * (1 + n / v.rb))} V out` }];
  })() : [];
  const tail = (L, dI, ipk, C, pin, v) => [
    { main: 1, l: 'Inductor (minimum)', v: fmtSI(L, 'H'), n: `Next common value up: ${fmtSI(BT.nearestE(L, 'E6', 'up'), 'H')}` },
    { l: 'Inductor ripple current', v: fmtSI(dI, 'A') + ' p-p' },
    { l: 'Peak inductor current', v: fmtSI(ipk, 'A'), n: `Choose an inductor with saturation current of ${fmtSI(ipk * 1.3, 'A')} or more` },
    { main: 1, l: 'Output capacitor (minimum)', v: fmtSI(C, 'F'), n: 'Ceramic capacitors lose capacitance under DC voltage — fit at least double this.' },
    { head: 'Power' },
    { l: 'Input current (average)', v: fmtSI(pin / v.vin, 'A') },
    { l: 'Heat lost in the converter', v: fmtSI(pin - v.vout * v.iout, 'W') },
    ...feedback(v),
  ];
  const NOTE = 'These are first-pass numbers for continuous conduction with ideal parts. Always follow the converter chip’s datasheet for final values and layout.';

  BT.add({
    id: 'buck', cat: 'Power', title: 'Buck converter (step-down)',
    desc: 'Duty cycle, inductor and output capacitor for a step-down regulator.',
    keys: 'switching regulator smps dc-dc step down inductor 12v to 5v 3.3v',
    notes: ['Duty = Vout ÷ Vin. Inductor L = (Vin − Vout) × Duty ÷ (frequency × ripple current). Capacitor C = ripple current ÷ (8 × frequency × ripple voltage).', NOTE],
    render(root) {
      BT.form(root, this.id, common('12', '5', '2', '500'), v => {
        const e = check(v); if (e) return e;
        if (v.vout >= v.vin) return 'A buck converter can only step down: the output must be lower than the input. Use the boost tool to step up.';
        const D = v.vout / v.vin, dI = v.rip / 100 * v.iout, L = (v.vin - v.vout) * D / (v.f * dI);
        return [{ l: 'Duty cycle', v: pct(D * 100) }, ...tail(L, dI, v.iout + dI / 2, dI / (8 * v.f * v.dv / 1000), v.vout * v.iout / (v.eff / 100), v)];
      });
    },
  });

  BT.add({
    id: 'boost', cat: 'Power', title: 'Boost converter (step-up)',
    desc: 'Duty cycle, inductor and output capacitor for a step-up regulator.',
    keys: 'switching regulator smps dc-dc step up inductor battery 3.7v to 5v lipo',
    notes: ['Duty = 1 − Vin × efficiency ÷ Vout. Inductor L = Vin × Duty ÷ (frequency × ripple current). Capacitor C = Iout × Duty ÷ (frequency × ripple voltage).',
      'In a boost converter the inductor and switch carry the input current, which is larger than the output current. Size parts for the peak current shown.', NOTE],
    render(root) {
      BT.form(root, this.id, common('3.7', '5', '1', '1000'), v => {
        const e = check(v); if (e) return e;
        if (v.vout <= v.vin) return 'A boost converter can only step up: the output must be higher than the input. Use the buck tool to step down.';
        const eff = v.eff / 100, D = 1 - v.vin * eff / v.vout, iin = v.vout * v.iout / (v.vin * eff), dI = v.rip / 100 * iin;
        return [{ l: 'Duty cycle', v: pct(D * 100), warn: D > 0.85, n: D > 0.85 ? 'Very high duty cycle — most chips struggle here. Consider a smaller step.' : null },
          ...tail(v.vin * D / (v.f * dI), dI, iin + dI / 2, v.iout * D / (v.f * v.dv / 1000), v.vout * v.iout / eff, v)];
      });
    },
  });

  BT.add({
    id: 'rc-filter', cat: 'Power', title: 'RC filter',
    desc: 'Cutoff frequency, time constant, or the part value for a target cutoff.',
    keys: 'low pass high pass cutoff corner frequency time constant tau debounce smoothing pwm adc',
    notes: ['Cutoff frequency fc = 1 ÷ (2π × R × C). At fc the signal is down to 70.7 % (−3 dB).',
      'Low-pass: resistor in series, capacitor to ground — smooths a signal (PWM to voltage, noisy ADC, button debounce). High-pass: capacitor in series, resistor to ground — blocks DC.',
      'Time constant τ = R × C. After one τ a step reaches 63 %; after about five it has settled.'],
    render(root) {
      BT.form(root, this.id, [
        { id: 'mode', type: 'seg', label: 'I want to find', value: 'f', options: [['f', 'Cutoff'], ['r', 'Resistor'], ['c', 'Capacitor']] },
        { id: 'fc', label: 'Cutoff frequency', value: '1', units: U.freq, u: 'kHz', show: v => v.mode !== 'f' },
        { id: 'r', label: 'Resistor', value: '10', units: U.ohm, u: 'kΩ', show: v => v.mode !== 'r' },
        { id: 'c', label: 'Capacitor', value: '100', units: U.cap, u: 'nF', show: v => v.mode !== 'c' },
        { id: 'type', type: 'select', label: 'Filter type', value: 'lp', options: [['lp', 'Low-pass'], ['hp', 'High-pass']] },
        { id: 'ft', label: 'Check a frequency', value: '', units: U.freq, u: 'kHz', opt: true, hint: 'Optional — how much gets through' },
      ], v => {
        let { r, c, fc } = v;
        const rows = [], w = 2 * Math.PI;
        if (v.mode === 'f') { if (!(r > 0 && c > 0)) return 'Resistor and capacitor must be above zero.'; fc = 1 / (w * r * c); rows.push({ main: 1, l: 'Cutoff frequency', v: fmtSI(fc, 'Hz') }); }
        else if (v.mode === 'r') { if (!(fc > 0 && c > 0)) return 'Frequency and capacitor must be above zero.'; r = 1 / (w * fc * c); const n = BT.nearestE(r, 'E24');
          rows.push({ main: 1, l: 'Resistor', v: fmtSI(r, 'Ω'), n: `Nearest E24: ${fmtSI(n, 'Ω', 4)} → cutoff ${fmtSI(1 / (w * n * c), 'Hz')}` }); }
        else { if (!(fc > 0 && r > 0)) return 'Frequency and resistor must be above zero.'; c = 1 / (w * fc * r); const n = BT.nearestE(c, 'E6');
          rows.push({ main: 1, l: 'Capacitor', v: fmtSI(c, 'F'), n: `Nearest common value: ${fmtSI(n, 'F')} → cutoff ${fmtSI(1 / (w * r * n), 'Hz')}` }); }
        const tau = r * c;
        rows.push({ l: 'Time constant (τ)', v: fmtSI(tau, 's') }, { l: 'Rise time (10 → 90 %)', v: fmtSI(2.197 * tau, 's') }, { l: 'Settled to 1 %', v: fmtSI(4.605 * tau, 's') });
        if (v.ft > 0) {
          const x = v.ft / fc, g = (v.type === 'lp' ? 1 : x) / Math.sqrt(1 + x * x);
          rows.push({ head: `At ${fmtSI(v.ft, 'Hz')}` }, { l: 'Signal passed', v: pct(g * 100), n: `${(20 * Math.log10(g)).toFixed(1)} dB` });
        }
        return rows;
      });
    },
  });
})();
