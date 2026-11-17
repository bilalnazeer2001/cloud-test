'use strict';
/* 3D-print cost estimator with STL upload (dimensions, volume, area, weight estimate, 3D preview) */
(() => {
  const MAT = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21, 'PA (Nylon)': 1.14, PC: 1.20, 'PLA-CF': 1.29 };

  /* Parse binary or ASCII STL -> Float32Array of vertices (9 per triangle) */
  function parseSTL(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength >= 84) {
      const n = dv.getUint32(80, true);
      if (84 + n * 50 === buf.byteLength) {
        const v = new Float32Array(n * 9);
        for (let i = 0; i < n; i++) for (let j = 0; j < 9; j++) v[i * 9 + j] = dv.getFloat32(84 + i * 50 + 12 + j * 4, true);
        return v;
      }
    }
    const text = new TextDecoder().decode(buf);
    if (!/^\s*solid/i.test(text) || !/facet/i.test(text)) throw new Error('This doesn’t look like an STL file.');
    const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi, out = [];
    let m;
    while ((m = re.exec(text))) out.push(+m[1], +m[2], +m[3]);
    if (!out.length || out.length % 9 || out.some(x => !isFinite(x))) throw new Error('The STL file looks damaged.');
    return new Float32Array(out);
  }

  function measure(v) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    let vol = 0, area = 0;
    for (let i = 0; i < v.length; i += 9) {
      const ax = v[i], ay = v[i + 1], az = v[i + 2], bx = v[i + 3], by = v[i + 4], bz = v[i + 5], cx = v[i + 6], cy = v[i + 7], cz = v[i + 8];
      for (let k = 0; k < 9; k += 3) for (let d = 0; d < 3; d++) { const x = v[i + k + d]; if (x < min[d]) min[d] = x; if (x > max[d]) max[d] = x; }
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
      area += Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    }
    return { tris: v.length / 9, min, max, size: max.map((x, i) => x - min[i]), vol: Math.abs(vol), area, inverted: vol < 0 };
  }

  /* Small software renderer: orthographic, flat shaded, drag to rotate */
  function viewer(canvas, v, info) {
    const ctx = canvas.getContext('2d'), N = v.length / 9, step = Math.max(1, Math.ceil(N / 40000));
    const c = info.min.map((m, i) => m + info.size[i] / 2), R = Math.hypot(...info.size) / 2 || 1;
    let yaw = -0.6, pitch = 0.5, drag = null, raf = 0;
    const col = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a8501a';
    const hex = s => { const m = /^#?([\da-f]{6})$/i.exec(s); const n = m ? parseInt(m[1], 16) : 0xa8501a; return [n >> 16, (n >> 8) & 255, n & 255]; };
    const draw = () => {
      raf = 0;
      const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const s = Math.min(W, H) * 0.44 / R, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const P = (x, y, z) => { x -= c[0]; y -= c[1]; z -= c[2];            // Z up (printer coords)
        const x1 = x * cy - y * sy, y1 = x * sy + y * cy;                     // spin around Z
        return [x1, z * cp - y1 * sp, y1 * cp + z * sp]; };                   // tilt: [screen x, screen y, depth]
      const tris = [], base = hex(col());
      for (let i = 0; i < N; i += step) {
        const o = i * 9, a = P(v[o], v[o + 1], v[o + 2]), b = P(v[o + 3], v[o + 4], v[o + 5]), d = P(v[o + 6], v[o + 7], v[o + 8]);
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const L = Math.hypot(nx, ny, nz) || 1;
        nx /= L; ny /= L; nz /= L;
        tris.push([a, b, d, (a[2] + b[2] + d[2]) / 3, 0.35 + 0.65 * Math.abs(nx * 0.3 + ny * 0.5 - nz * 0.81)]);
      }
      tris.sort((p, q) => q[3] - p[3]);
      for (const [a, b, d, , l] of tris) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + a[0] * s, H / 2 - a[1] * s); ctx.lineTo(W / 2 + b[0] * s, H / 2 - b[1] * s); ctx.lineTo(W / 2 + d[0] * s, H / 2 - d[1] * s);
        const f = `rgb(${base.map(x => Math.round(x * l)).join(',')})`;
        ctx.fillStyle = f; ctx.strokeStyle = f; ctx.lineWidth = 0.5; ctx.fill(); ctx.stroke();
      }
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
    canvas.onpointerdown = e => { drag = [e.clientX, e.clientY, yaw, pitch]; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (!drag) return; yaw = drag[2] + (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.5, Math.min(1.5, drag[3] + (e.clientY - drag[1]) * 0.01)); req(); };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
    new ResizeObserver(req).observe(canvas);
    req();
  }

  BT.add({
    id: 'print-cost', cat: '3D printing', title: '3D-print cost estimator',
    desc: 'Filament, power, machine time and margin — with STL size and volume.',
    keys: 'stl filament price quote pla petg grams kwh electricity profit markup volume dimensions bounding box upload model',
    notes: ['Best accuracy: copy the filament weight (grams) and print time from your slicer. The STL estimate is a quick guess for quoting before slicing.',
      'The STL estimate counts the outer shell (walls, top and bottom) as solid and the inside at your infill %. It assumes the model is in millimetres and is a closed (watertight) shape.',
      'Price = (filament + electricity + machine wear + labour) × (1 + failure allowance), then the profit margin is added on top as a markup.'],
    render(root) {
      const status = h('span', null, 'Opens .stl files on this device — nothing is uploaded.');
      const file = h('input', { type: 'file', accept: '.stl,model/stl,application/sla', class: 'sr' });
      const drop = h('label', { class: 'drop' }, file, h('b', null, 'Choose an STL file'), status);
      const canvas = h('canvas', { class: 'stl-view', hidden: true, 'aria-label': '3D preview of the model. Drag to rotate.' });
      const stlOut = h('div', { class: 'results', hidden: true, 'aria-live': 'polite' });
      const formBox = h('div');
      root.append(drop, canvas, stlOut, h('h2', { class: 'sec' }, 'Cost'), formBox);
      let model = null;

      const form = BT.form(formBox, this.id, [
        { id: 'cur', type: 'text', label: 'Currency', value: 'Rs' },
        { id: 'mat', type: 'select', label: 'Material', value: 'PLA', options: Object.keys(MAT).map(k => [k, `${k} (${MAT[k]} g/cm³)`]) },
        { id: 'spool', label: 'Spool price', value: '4500', hint: 'Price of one spool' },
        { id: 'spoolg', label: 'Spool weight', value: '1000', unit: 'g' },
        { id: 'g', label: 'Filament used', value: '50', unit: 'g', hint: 'From the slicer, or use the STL estimate' },
        { id: 'hrs', label: 'Print time', value: '3.5', unit: 'h', hint: '2h 30m = 2.5' },
        { id: 'w', label: 'Printer power', value: '150', unit: 'W', hint: 'Average draw; ~100–150 W for a PLA printer' },
        { id: 'kwh', label: 'Electricity price', value: '60', unit: 'per kWh' },
        { id: 'wear', label: 'Machine wear', value: '30', unit: 'per h', opt: true, hint: 'Nozzles, belts, printer cost ÷ lifetime hours' },
        { id: 'lab', label: 'Labour / prep', value: '0', unit: 'total', opt: true, hint: 'Setup, removal, cleanup' },
        { id: 'fail', label: 'Failure allowance', value: '10', unit: '%', opt: true },
        { id: 'margin', label: 'Profit margin', value: '30', unit: '%', opt: true },
        { id: 'qty', label: 'Copies', value: '1', unit: 'pcs', opt: true },
        { id: 'infill', label: 'Infill (for STL estimate)', value: '15', unit: '%', opt: true },
        { id: 'walls', label: 'Wall thickness (for STL)', value: '1.2', unit: 'mm', opt: true, hint: '3 walls × 0.4 mm nozzle' },
      ], v => {
        if (model) showModel(v);
        if (!(v.spoolg > 0) || !(v.g >= 0) || !(v.hrs >= 0)) return 'Spool weight must be above zero; grams and hours can’t be negative.';
        const cur = (v.cur || '').trim(), m = x => isFinite(x) ? `${cur} ${x.toFixed(2)}`.trim() : '—';
        const qty = Math.max(1, Math.round(z(v.qty) || 1));
        const fil = v.g / v.spoolg * v.spool, kwhUsed = v.w * v.hrs / 1000, en = kwhUsed * v.kwh, wear = z(v.wear) * v.hrs, lab = z(v.lab);
        const base = fil + en + wear + lab, risk = base * z(v.fail) / 100, cost = base + risk, price = cost * (1 + z(v.margin) / 100);
        const metres = v.g / MAT[v.mat] / (Math.PI * 0.0875 ** 2) / 100;  // 1.75 mm filament, cm³ → m
        return [
          { main: 1, l: qty > 1 ? 'Price per copy' : 'Price to charge', v: m(price), n: `Profit ${m(price - cost)} on a cost of ${m(cost)}` },
          qty > 1 && { main: 1, l: `Total for ${qty}`, v: m(price * qty) },
          { head: 'Breakdown (per copy)' },
          { l: 'Filament', v: m(fil), n: `${fmt(v.g)} g ≈ ${fmt(metres, 3)} m of 1.75 mm ${v.mat}` },
          { l: 'Electricity', v: m(en), n: `${fmt(kwhUsed, 3)} kWh` },
          { l: 'Machine wear', v: m(wear) },
          { l: 'Labour', v: m(lab) },
          { l: 'Failure allowance', v: m(risk) },
          { l: 'Cost per hour of printing', v: v.hrs > 0 ? m(cost / v.hrs) : '—' },
        ];
      });

      function estimate(v) {
        const dens = MAT[v.mat], vol = model.info.vol / 1000;                 // cm³
        const shell = Math.min(vol, model.info.area / 100 * (z(v.walls) / 10)); // cm³
        const used = shell + (vol - shell) * Math.min(1, Math.max(0, z(v.infill) / 100));
        return { vol, solid: vol * dens, g: used * dens };
      }
      function showModel(v) {
        const I = model.info, e = estimate(v), d = I.size.map(x => fmt(x, 4));
        BT.renderRows(stlOut, [
          { main: 1, l: 'Size (X × Y × Z)', v: `${d[0]} × ${d[1]} × ${d[2]} mm`, n: `${fmt(I.size[0] / 25.4, 3)} × ${fmt(I.size[1] / 25.4, 3)} × ${fmt(I.size[2] / 25.4, 3)} in` },
          { l: 'Volume', v: `${fmt(e.vol, 4)} cm³`, n: `${fmt(I.vol, 5)} mm³` },
          { l: 'Surface area', v: `${fmt(I.area / 100, 4)} cm²` },
          { l: 'Weight if 100 % solid', v: `${fmt(e.solid, 4)} g`, n: `${v.mat}` },
          { main: 1, l: `Estimated filament`, v: `${fmt(e.g, 3)} g`, n: `${fmt(z(v.infill))} % infill, ${fmt(z(v.walls))} mm walls. Your slicer’s number will be more accurate.` },
          { l: 'Triangles', v: I.tris.toLocaleString() },
          (I.size.some(x => x > 0 && x < 1) || I.size.every(x => x < 5)) && { warn: 1, l: 'Very small model', v: '!', n: 'Is it in inches or metres? Most slicers expect millimetres; scale it up if so.' },
          I.size.some(x => x > 300) && { warn: 1, l: 'Large model', v: '!', n: 'Bigger than 300 mm on one side — check it fits your printer bed.' },
        ]);
        stlOut.append(h('p', { style: 'padding:4px 0 12px' }, h('button', { type: 'button', class: 'btn', onclick: () => form.set('g', fmt(e.g, 3)) }, `Use ${fmt(e.g, 3)} g in the cost`)));
      }
      async function load(f) {
        if (!f) return;
        status.textContent = `Reading ${f.name}…`;
        try {
          const verts = parseSTL(await f.arrayBuffer());
          if (!verts.length) throw new Error('The file has no triangles.');
          model = { verts, info: measure(verts), name: f.name };
          status.textContent = `${f.name} · ${f.size < 1048576 ? Math.ceil(f.size / 1024) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB'} — choose another file to replace it`;
          stlOut.hidden = false; canvas.hidden = false;
          viewer(canvas, verts, model.info);
          form.update();
        } catch (err) {
          model = null; stlOut.hidden = false; canvas.hidden = true;
          status.textContent = 'Choose an STL file';
          BT.renderRows(stlOut, `Couldn’t open “${f.name}”: ${err.message}`);
        }
      }
      file.addEventListener('change', () => load(file.files[0]));
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); });
    },
  });
  BT.stl = { parseSTL, measure };
})();
