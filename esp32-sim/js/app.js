/* ESP32 Practice Bench - page logic: board drawing, editor, live run, lessons, saved progress. */
(function () {
  'use strict';
  const Sim = window.ESP32Sim;
  const LESSONS = Sim.LESSONS;
  const W = Sim.WIRING;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ------------------------------------------------------------ saved progress
  const KEY = 'esp32-practice-bench.v1';
  function loadProgress() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { p = null; }
    p = p && typeof p === 'object' ? p : {};
    return { done: p.done || {}, code: p.code || {}, hints: p.hints || {}, current: p.current || LESSONS[0].id };
  }
  const progress = loadProgress();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked: progress lasts for this visit only */ }
    }, 250);
  }

  let lessonIndex = Math.max(0, LESSONS.findIndex((l) => l.id === progress.current));
  const lesson = () => LESSONS[lessonIndex];

  // ------------------------------------------------------------ board drawing
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LEFT_PINS = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'];
  const RIGHT_PINS = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'];
  const padY = (k) => 70 + k * 17;
  const LED_COLORS = {
    red: { off: '#4a1f1c', on: '#ff4b3a', glow: '#ff3b2a' },
    yellow: { off: '#4a3d14', on: '#ffd23a', glow: '#ffc21a' },
    green: { off: '#173a22', on: '#3dff7a', glow: '#22e866' },
  };

  function wire(fromX, fromY, elbowX, rowY, toX) {
    return '<path class="wire" d="M' + fromX + ' ' + fromY + ' H' + elbowX + ' V' + rowY + ' H' + toX + '"/>';
  }
  function ledSvg(name, cx, cy, labelX, anchor) {
    const c = LED_COLORS[name];
    const title = name[0].toUpperCase() + name.slice(1) + ' LED';
    return '<g class="led" id="led-' + name + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="30" fill="' + c.glow + '" filter="url(#glow)" opacity="0" class="led-glow"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="15" fill="#2a3034"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="' + c.off + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="' + c.on + '" opacity="0" class="led-lit"/>' +
      '<circle cx="' + (cx - 4) + '" cy="' + (cy - 4) + '" r="3.5" fill="#ffffff" opacity="0.35"/>' +
      '<text class="partlabel" x="' + labelX + '" y="' + (cy - 2) + '" text-anchor="' + anchor + '">' + title + '</text>' +
      '<text class="partsub" x="' + labelX + '" y="' + (cy + 12) + '" text-anchor="' + anchor + '" id="led-' + name + '-pct">GPIO ' + W.leds[name] + '</text>' +
      '</g>';
  }
  function buttonSvg(name, cx, cy) {
    return '<g class="btn-part" id="btn-' + name + '" tabindex="0" role="button" aria-pressed="false" aria-label="Button ' + name + ' on GPIO ' + W.buttons[name] + '. Hold to press, or hold the ' + name + ' key.">' +
      '<rect x="' + (cx - 20) + '" y="' + (cy - 20) + '" width="40" height="40" rx="4" fill="#2a3034"/>' +
      '<circle cx="' + (cx - 15) + '" cy="' + (cy - 15) + '" r="2" fill="#151a1d"/><circle cx="' + (cx + 15) + '" cy="' + (cy - 15) + '" r="2" fill="#151a1d"/>' +
      '<circle cx="' + (cx - 15) + '" cy="' + (cy + 15) + '" r="2" fill="#151a1d"/><circle cx="' + (cx + 15) + '" cy="' + (cy + 15) + '" r="2" fill="#151a1d"/>' +
      '<circle class="btn-ring" cx="' + cx + '" cy="' + cy + '" r="14" fill="#1b2023" stroke="#151a1d" stroke-width="1"/>' +
      '<g class="btn-cap"><circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#55606a"/>' +
      '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" fill="#eef2f3" style="font:700 11px var(--font-display)">' + name + '</text></g>' +
      '<text class="partlabel" x="' + (cx + 32) + '" y="' + (cy - 2) + '">Button ' + name + '</text>' +
      '<text class="partsub" x="' + (cx + 32) + '" y="' + (cy + 12) + '" id="btn-' + name + '-state">GPIO ' + W.buttons[name] + ' · up</text>' +
      '</g>';
  }

  function buildBoard() {
    const bx = 200, bw = 140;
    let s = '<svg viewBox="0 0 560 362" role="img" aria-label="ESP32 board wired to three LEDs, two buttons, a knob and a buzzer">' +
      '<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '<filter id="glow-s" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter></defs>';

    // wires first so parts sit on top of them
    s += wire(bx + 8, padY(3), 152, 70, 141);                  // D34 -> knob
    s += wire(bx + 8, padY(7), 164, 150, 128);                 // D25 -> red
    s += wire(bx + 8, padY(8), 164, padY(8), 128);             // D26 -> yellow
    s += wire(bx + 8, padY(9), 164, 262, 128);                 // D27 -> green
    s += wire(bx + bw - 8, padY(0), 380, 70, 410);             // D23 -> buzzer
    s += wire(bx + bw - 8, padY(6), 380, 175, 410);            // D18 -> button A
    s += wire(bx + bw - 8, padY(10), 380, 262, 410);           // D4  -> button B

    // board body
    s += '<rect x="' + bx + '" y="16" width="' + bw + '" height="322" rx="7" fill="#1e2528"/>';
    s += '<rect x="' + (bx + 22) + '" y="22" width="' + (bw - 44) + '" height="34" rx="2" fill="#1e2528" stroke="#3a4448"/>';
    s += '<path d="M' + (bx + 30) + ' 46 v-16 h10 v12 h10 v-12 h10 v12 h10 v-12 h10 v12 h10 v-12 h6" fill="none" stroke="#b9773f" stroke-width="2"/>';
    s += '<rect x="' + (bx + 20) + '" y="56" width="' + (bw - 40) + '" height="96" rx="3" fill="#b8bec1" stroke="#8b9397"/>';
    s += '<text x="' + (bx + bw / 2) + '" y="96" text-anchor="middle" fill="#2c3336" style="font:700 15px var(--font-display);letter-spacing:.04em">ESP32</text>';
    s += '<text x="' + (bx + bw / 2) + '" y="113" text-anchor="middle" fill="#4a5357" style="font:500 8.5px var(--font-mono)">WROOM-32</text>';
    s += '<text x="' + (bx + bw / 2) + '" y="134" text-anchor="middle" fill="#4a5357" style="font:500 7.5px var(--font-mono)">240 MHz · 2 cores</text>';
    for (let k = 0; k < 15; k++) {
      const y = padY(k);
      s += '<rect x="' + (bx + 3) + '" y="' + (y - 5) + '" width="10" height="10" rx="1.5" fill="#d0a24a"/><circle cx="' + (bx + 8) + '" cy="' + y + '" r="2.4" fill="#1e2528"/>';
      s += '<rect x="' + (bx + bw - 13) + '" y="' + (y - 5) + '" width="10" height="10" rx="1.5" fill="#d0a24a"/><circle cx="' + (bx + bw - 8) + '" cy="' + y + '" r="2.4" fill="#1e2528"/>';
      const used = ['D34', 'D25', 'D26', 'D27'].includes(LEFT_PINS[k]);
      const usedR = ['D23', 'D18', 'D4', 'D2'].includes(RIGHT_PINS[k]);
      if (y > 152) {
        s += '<text x="' + (bx + 18) + '" y="' + (y + 3.5) + '" fill="' + (used ? '#f0b07a' : '#8f999d') + '" style="font:500 8.5px var(--font-mono)">' + LEFT_PINS[k] + '</text>';
        s += '<text x="' + (bx + bw - 18) + '" y="' + (y + 3.5) + '" text-anchor="end" fill="' + (usedR ? '#f0b07a' : '#8f999d') + '" style="font:500 8.5px var(--font-mono)">' + RIGHT_PINS[k] + '</text>';
      } else {
        // pins beside the metal module: label outside the board
        s += '<text x="' + (bx - 4) + '" y="' + (y - 5) + '" text-anchor="end" class="pinlabel"' + (used ? ' style="fill:var(--accent)"' : '') + '>' + LEFT_PINS[k] + '</text>';
        s += '<text x="' + (bx + bw + 4) + '" y="' + (y - 5) + '" class="pinlabel"' + (usedR ? ' style="fill:var(--accent)"' : '') + '>' + RIGHT_PINS[k] + '</text>';
      }
    }
    // on-board LED (GPIO 2), power LED, USB
    s += '<g id="led-builtin"><circle cx="' + (bx + 70) + '" cy="' + padY(11) + '" r="16" fill="#3d9bff" filter="url(#glow-s)" opacity="0" class="led-glow"/>' +
      '<rect x="' + (bx + 64) + '" y="' + (padY(11) - 4) + '" width="12" height="8" rx="1.5" fill="#1d3550"/>' +
      '<rect x="' + (bx + 64) + '" y="' + (padY(11) - 4) + '" width="12" height="8" rx="1.5" fill="#7cc4ff" opacity="0" class="led-lit"/></g>';
    s += '<text x="' + (bx + 70) + '" y="' + (padY(11) + 17) + '" text-anchor="middle" fill="#8f999d" style="font:500 7.5px var(--font-mono)">LED 2</text>';
    s += '<rect x="' + (bx + 44) + '" y="' + (padY(13) - 3) + '" width="8" height="6" rx="1" fill="#ff5b4a"/>';
    s += '<text x="' + (bx + 48) + '" y="' + (padY(13) + 13) + '" text-anchor="middle" fill="#8f999d" style="font:500 7px var(--font-mono)">PWR</text>';
    s += '<rect x="' + (bx + 82) + '" y="' + (padY(13) - 6) + '" width="16" height="12" rx="2" fill="#30393d"/><rect x="' + (bx + 102) + '" y="' + (padY(13) - 6) + '" width="16" height="12" rx="2" fill="#30393d"/>';
    s += '<rect x="' + (bx + 50) + '" y="326" width="40" height="24" rx="3" fill="#a9b0b4" stroke="#7f878b"/>';

    // left parts
    s += '<g class="knob-part" id="knob">' +
      '<rect x="88" y="43" width="54" height="54" rx="5" fill="#2a3034"/>' +
      '<circle cx="115" cy="70" r="23" fill="#1b2023"/>' +
      '<g class="knob" id="knob-dial"><circle cx="115" cy="70" r="20" fill="#5c666e"/><circle cx="115" cy="70" r="15" fill="#6c767e"/>' +
      '<rect x="113.2" y="52" width="3.6" height="13" rx="1.8" fill="#f2f4f5"/></g>' +
      '<text class="partlabel" x="80" y="66" text-anchor="end">Knob</text>' +
      '<text class="partsub" x="80" y="80" text-anchor="end" id="knob-val">GPIO 34</text></g>';
    s += ledSvg('red', 113, 150, 90, 'end');
    s += ledSvg('yellow', 113, padY(8), 90, 'end');
    s += ledSvg('green', 113, 262, 90, 'end');

    // right parts
    s += '<g class="buzz" id="buzzer">' +
      '<circle class="wave" cx="430" cy="70" r="27"/><circle class="wave w2" cx="430" cy="70" r="27"/><circle class="wave w3" cx="430" cy="70" r="27"/>' +
      '<circle cx="430" cy="70" r="21" fill="#22282b"/><circle cx="430" cy="70" r="15" fill="none" stroke="#343c40"/>' +
      '<circle cx="430" cy="70" r="4" fill="#0d1012"/>' +
      '<text class="partlabel" x="462" y="68">Buzzer</text>' +
      '<text class="partsub" x="462" y="82" id="buzz-freq">GPIO 23 · quiet</text></g>';
    s += buttonSvg('A', 430, 175);
    s += buttonSvg('B', 430, 262);
    s += '</svg>';
    $('board').innerHTML = s;
  }

  // ------------------------------------------------------------ board model + inputs
  const board = new Sim.Board();
  let potValue = 0;

  function setButton(name, down) {
    if (board.pressed[name] === !!down) return;
    board.setButton(name, down);
    const g = $('btn-' + name);
    g.classList.toggle('down', !!down);
    g.setAttribute('aria-pressed', down ? 'true' : 'false');
    $('btn-' + name + '-state').textContent = 'GPIO ' + W.buttons[name] + ' · ' + (down ? 'pressed' : 'up');
  }
  function setPot(v) {
    potValue = Math.max(0, Math.min(4095, Math.round(v)));
    board.setPot(potValue);
    $('pot-range').value = potValue;
    $('pot-out').textContent = potValue;
    $('knob').setAttribute('aria-label', 'Knob on GPIO 34, reading ' + potValue);
    const angle = -135 + (potValue / 4095) * 270;
    $('knob-dial').setAttribute('transform', 'rotate(' + angle.toFixed(1) + ' 115 70)');
  }

  function wireInputs() {
    for (const name of ['A', 'B']) {
      const g = $('btn-' + name);
      g.addEventListener('pointerdown', (e) => { e.preventDefault(); g.setPointerCapture(e.pointerId); setButton(name, true); });
      const up = () => setButton(name, false);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
      g.addEventListener('lostpointercapture', up);
      g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setButton(name, true); } });
      g.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') setButton(name, false); });
    }
    const typing = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
    document.addEventListener('keydown', (e) => {
      if (typing(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === 'A' || k === 'B') setButton(k, true);
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toUpperCase();
      if (k === 'A' || k === 'B') setButton(k, false);
    });
    window.addEventListener('blur', () => { setButton('A', false); setButton('B', false); });

    $('pot-range').addEventListener('input', (e) => setPot(Number(e.target.value)));
    const knob = $('knob-dial');
    const svg = $('board').querySelector('svg');
    const fromPointer = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let a = Math.atan2(p.x - 115, 70 - p.y) * 180 / Math.PI;
      a = Math.max(-135, Math.min(135, a));
      setPot(((a + 135) / 270) * 4095);
    };
    knob.addEventListener('pointerdown', (e) => { e.preventDefault(); knob.setPointerCapture(e.pointerId); fromPointer(e); });
    knob.addEventListener('pointermove', (e) => { if (knob.hasPointerCapture(e.pointerId)) fromPointer(e); });
  }

  function paintBoard() {
    for (const name of ['builtin', 'red', 'yellow', 'green']) {
      const v = board.ledLevel(name);
      const g = $('led-' + name);
      g.querySelector('.led-lit').setAttribute('opacity', v.toFixed(3));
      g.querySelector('.led-glow').setAttribute('opacity', (v * 0.85).toFixed(3));
      if (name !== 'builtin') {
        const pin = board.pin(W.leds[name]);
        const pct = pin.pwm != null ? ' · ' + Math.round(v * 100) + '%' : v ? ' · on' : '';
        $('led-' + name + '-pct').textContent = 'GPIO ' + W.leds[name] + pct;
      }
    }
    const f = running ? board.buzzerFreq() : 0;
    $('buzzer').classList.toggle('on', f > 0);
    $('buzz-freq').textContent = 'GPIO 23 · ' + (f > 0 ? f + ' Hz' : 'quiet');
    sound(f);
  }

  // ------------------------------------------------------------ sound
  let audio = null, osc = null, gain = null, soundOn = false;
  function sound(freq) {
    if (!soundOn || !audio) return;
    const t = audio.currentTime;
    if (freq > 0) {
      osc.frequency.setTargetAtTime(Math.min(freq, 12000), t, 0.005);
      gain.gain.setTargetAtTime(0.045, t, 0.01);
    } else gain.gain.setTargetAtTime(0, t, 0.01);
  }
  $('sound').addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn && !audio) {
      try {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        osc = audio.createOscillator();
        gain = audio.createGain();
        osc.type = 'square';
        gain.gain.value = 0;
        osc.connect(gain).connect(audio.destination);
        osc.start();
      } catch (e) { soundOn = false; }
    }
    if (audio) { if (soundOn) audio.resume(); else gain.gain.setTargetAtTime(0, audio.currentTime, 0.01); }
    $('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  });

  // ------------------------------------------------------------ serial monitor
  const out = $('serial-out');
  const MAX_CHARS = 40000;
  function serialAppend(text, cls) {
    const stick = out.scrollHeight - out.scrollTop - out.clientHeight < 30;
    const last = out.lastChild;
    if (!cls && last && last.nodeType === 3) last.appendData(text);
    else if (!cls) out.appendChild(document.createTextNode(text));
    else {
      if (last && !/\n$/.test(last.textContent)) out.appendChild(document.createTextNode('\n'));
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text + '\n';
      out.appendChild(span);
    }
    let over = out.textContent.length - MAX_CHARS;
    while (over > 0 && out.firstChild) {
      const n = out.firstChild;
      const len = n.textContent.length;
      if (n.nodeType === 3 && len > over) { n.deleteData(0, over); break; }
      out.removeChild(n);
      over -= len;
    }
    if (stick) out.scrollTop = out.scrollHeight;
  }
  board.onSerial = (t) => serialAppend(t);
  board.onWarn = (m) => serialAppend('! ' + m, 'sys');
  $('serial-clear').addEventListener('click', () => { out.textContent = ''; });
  $('serial-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('serial-text');
    const text = input.value;
    if (!running) { serialAppend('Press Run first, then send your message.', 'sys'); return; }
    board.serialSend(text + '\n');
    serialAppend('> ' + text, 'you');
    input.value = '';
  });

  // ------------------------------------------------------------ editor
  const src = $('src'), hl = $('hl'), gutter = $('gutter');
  const KW = new Set(Sim.words.keywords);
  const TYPES = new Set(Sim.words.types);
  const FNS = new Set(Sim.words.builtins);
  const CONSTS = new Set(Sim.words.consts);
  const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(^[ \t]*#[^\n]*)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/gm;
  let errLine = null;

  function highlight() {
    const text = src.value;
    let html = '', last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      html += esc(text.slice(last, m.index));
      let cls = null;
      if (m[1]) cls = 't-com';
      else if (m[2]) cls = 't-str';
      else if (m[3]) cls = 't-pre';
      else if (m[4]) cls = 't-num';
      else if (m[5]) {
        const w = m[5];
        cls = KW.has(w) ? 't-kw' : TYPES.has(w) ? 't-type' : FNS.has(w) ? 't-fn' : CONSTS.has(w) ? 't-const' : null;
      }
      html += cls ? '<span class="' + cls + '">' + esc(m[0]) + '</span>' : esc(m[0]);
      last = m.index + m[0].length;
    }
    html += esc(text.slice(last));
    hl.innerHTML = html + '\n ';
    const lines = text.split('\n').length;
    let g = '';
    for (let i = 1; i <= lines; i++) g += (i === errLine ? '<span class="bad">' + i + '</span>' : i) + '\n';
    gutter.innerHTML = g;
    const band = $('err-band');
    if (errLine && errLine <= lines) { band.hidden = false; band.style.top = (10 + (errLine - 1) * 21) + 'px'; } else band.hidden = true;
  }
  function setErrLine(n) { errLine = n; highlight(); }

  function insertText(text) {
    src.focus();
    if (!document.execCommand || !document.execCommand('insertText', false, text)) {
      src.setRangeText(text, src.selectionStart, src.selectionEnd, 'end');
      onEdit();
    }
  }
  src.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); toggleRun(true); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insertText('  '); return; }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const before = src.value.slice(0, src.selectionStart);
      const lineStart = before.lastIndexOf('\n') + 1;
      const indent = /^[ \t]*/.exec(before.slice(lineStart))[0];
      const extra = /\{\s*$/.test(before) ? '  ' : '';
      e.preventDefault();
      insertText('\n' + indent + extra);
    }
    if (e.key === '}') {
      const before = src.value.slice(0, src.selectionStart);
      const lineStart = before.lastIndexOf('\n') + 1;
      if (/^ {2,}$/.test(before.slice(lineStart)) && src.selectionStart === src.selectionEnd) {
        src.setSelectionRange(src.selectionStart - 2, src.selectionStart);
      }
    }
  });
  function onEdit() {
    if (errLine) { errLine = null; setStatus(''); }
    highlight();
    progress.code[lesson().id] = src.value;
    save();
  }
  src.addEventListener('input', onEdit);
  function setCode(text) {
    src.value = text;
    errLine = null;
    highlight();
  }

  // ------------------------------------------------------------ status + errors
  function setStatus(html, isError) {
    const st = $('status');
    st.innerHTML = html;
    st.classList.toggle('error', !!isError);
  }
  function showError(e) {
    const where = e.line ? 'Line <b>' + e.line + '</b>: ' : '';
    setStatus((e.kind === 'runtime' ? 'The program stopped. ' : '') + where + esc(e.message), true);
    setErrLine(e.line || null);
  }

  // ------------------------------------------------------------ running
  let running = false, rt = null, startReal = 0, raf = 0;
  const MAX_FRAME_US = 100000;

  function toggleRun(forceStart) {
    if (running && !forceStart) { stopRun(); return; }
    if (running) stopRun();
    let prog;
    try { prog = Sim.compile(src.value); } catch (e) {
      if (!(e instanceof Sim.SimError)) throw e;
      showError(e);
      return;
    }
    setErrLine(null);
    board.reset();
    board.setPot(potValue);
    out.textContent = '';
    rt = new Sim.Runtime(prog, board, { rand: Math.random });
    running = true;
    startReal = performance.now();
    $('run').textContent = 'Stop';
    $('clock').classList.add('live');
    setStatus('Running. Press the buttons, turn the knob, watch the serial monitor.');
    raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!running) return;
    let target = (now - startReal) * 1000;
    if (target - rt.now > MAX_FRAME_US) { // the tab was hidden: don't fast-forward
      startReal += (target - rt.now - MAX_FRAME_US) / 1000;
      target = rt.now + MAX_FRAME_US;
    }
    try { rt.run(target); } catch (e) {
      if (!(e instanceof Sim.SimError)) throw e;
      stopRun(true);
      showError(e);
      paintBoard();
      return;
    }
    if (board.serial.begun) $('baud').textContent = board.serial.baud + ' baud';
    $('clock').textContent = 'running · ' + (rt.now / 1e6).toFixed(1) + ' s';
    paintBoard();
    if (rt.dead) { stopRun(); return; }
    raf = requestAnimationFrame(tick);
  }
  function stopRun(keepStatus) {
    running = false;
    cancelAnimationFrame(raf);
    $('run').textContent = 'Run';
    $('clock').classList.remove('live');
    $('clock').textContent = rt ? 'stopped at ' + (rt.now / 1e6).toFixed(1) + ' s' : 'stopped';
    if (!keepStatus && !errLine) setStatus('Stopped.');
    paintBoard();
  }
  $('run').addEventListener('click', () => toggleRun(false));

  // ------------------------------------------------------------ lessons UI
  function renderSteps() {
    const nav = $('steps');
    nav.innerHTML = LESSONS.map((l, i) =>
      '<button type="button" class="step' + (progress.done[l.id] ? ' done' : '') + (i === lessonIndex ? ' current' : '') +
      '" data-i="' + i + '" title="' + (i + 1) + '. ' + esc(l.title) + (progress.done[l.id] ? ' (done)' : '') + '"' +
      (i === lessonIndex ? ' aria-current="step"' : '') + '>' + (i + 1) + '</button>').join('');
    const n = LESSONS.filter((l) => progress.done[l.id]).length;
    $('progress').innerHTML = '<b>' + n + '</b> of ' + LESSONS.length + ' done';
  }
  $('steps').addEventListener('click', (e) => {
    const b = e.target.closest('.step');
    if (b) openLesson(Number(b.dataset.i));
  });

  function renderLesson(results) {
    const L = lesson();
    const shown = progress.hints[L.id] || 0;
    const checks = L.checks.map((c, i) => {
      const r = results && results[i];
      const cls = r ? (r.ok ? 'ok' : 'bad') : '';
      const mark = r ? (r.ok ? '✓' : '✕') : '';
      return '<li class="' + cls + '"><span class="mark" aria-hidden="true">' + mark + '</span><span>' + esc(c.label) +
        (r && !r.ok && r.msg ? '<span class="why">' + esc(r.msg) + '</span>' : '') +
        (r ? '<span class="sr-only" style="position:absolute;left:-9999px">' + (r.ok ? ' passed' : ' not yet') + '</span>' : '') + '</span></li>';
    }).join('');
    let hints = '';
    for (let i = 0; i < Math.min(shown, L.hints.length); i++) hints += '<div class="hint"><span class="n">HINT ' + (i + 1) + '</span>' + esc(L.hints[i]) + '</div>';
    let hintBtn;
    if (shown < L.hints.length) hintBtn = '<button class="btn small" type="button" id="hint-btn">Show a hint (' + (shown + 1) + ' of ' + L.hints.length + ')</button>';
    else if (shown === L.hints.length) hintBtn = '<button class="btn small" type="button" id="hint-btn">Show the answer</button>';
    else {
      hints += '<div class="hint"><span class="n">ANSWER</span>One way to solve it:<pre>' + esc(L.solution) + '</pre>' +
        '<button class="btn small" type="button" id="use-answer">Put the answer in the editor</button></div>';
      hintBtn = '';
    }
    $('lesson').innerHTML =
      '<div class="eyebrow"><span class="num">LESSON ' + String(lessonIndex + 1).padStart(2, '0') + ' / ' + LESSONS.length + '</span><span class="label">' + esc(L.topic) + '</span></div>' +
      '<h1 id="lesson-title">' + esc(L.title) + (progress.done[L.id] ? ' <span style="color:var(--ok);font-size:.6em;vertical-align:middle">✓ done</span>' : '') + '</h1>' +
      '<div class="goal">' + L.goal + '</div>' +
      '<div class="body">' + L.body + '</div>' +
      '<h2>Checks</h2><ul class="checklist">' + checks + '</ul>' +
      '<h2>Stuck?</h2><div class="hints">' + hints + (hintBtn ? '<div>' + hintBtn + '</div>' : '') + '</div>' +
      '<div class="lesson-nav">' +
      (lessonIndex > 0 ? '<button class="btn small quiet" type="button" data-go="-1">Previous lesson</button>' : '') +
      (lessonIndex < LESSONS.length - 1 ? '<button class="btn small quiet" type="button" data-go="1">Next lesson</button>' : '') +
      '</div>';
  }
  $('lesson').addEventListener('click', (e) => {
    const L = lesson();
    if (e.target.id === 'hint-btn') {
      progress.hints[L.id] = (progress.hints[L.id] || 0) + 1;
      save();
      renderLesson(lastResults);
    } else if (e.target.id === 'use-answer') {
      setCode(L.solution);
      onEdit();
    } else if (e.target.dataset.go) openLesson(lessonIndex + Number(e.target.dataset.go));
  });

  let lastResults = null;
  function openLesson(i) {
    if (i < 0 || i >= LESSONS.length) return;
    if (running) stopRun(true);
    lessonIndex = i;
    progress.current = lesson().id;
    save();
    lastResults = null;
    const saved = progress.code[lesson().id];
    setCode(saved != null ? saved : lesson().starter);
    board.reset();
    rt = null;
    setButton('A', false); setButton('B', false);
    out.textContent = '';
    $('results').innerHTML = '';
    $('results').className = 'results';
    $('clock').textContent = 'stopped';
    setStatus('Press <b>Run</b> to try your code on the board, then <b>Check my code</b>.');
    renderSteps();
    renderLesson(null);
    paintBoard();
  }

  // ------------------------------------------------------------ checking
  function checkCode() {
    const L = lesson();
    const res = Sim.grade(L, src.value);
    lastResults = res.compileError ? null : res.results;
    const box = $('results');
    if (res.compileError) {
      showError(res.compileError);
      box.className = 'results';
      box.innerHTML = '<h3>Fix the error first</h3><p>The code has to make sense to the ESP32 before it can be checked. The line is marked in the editor.</p>';
      renderLesson(null);
      return;
    }
    setErrLine(null);
    const passed = res.results.filter((r) => r.ok).length;
    const notes = res.warnings.length ? '<div class="notes">' + res.warnings.map(esc).join('<br>') + '</div>' : '';
    if (res.passed) {
      const first = !progress.done[L.id];
      progress.done[L.id] = true;
      save();
      box.className = 'results pass';
      const next = lessonIndex < LESSONS.length - 1;
      box.innerHTML = '<h3>' + (next ? 'Lesson complete' : 'All 20 lessons complete') + '</h3>' +
        '<p>All ' + res.results.length + ' checks passed.' + (first ? ' Your progress is saved in this browser.' : '') + '</p>' + notes +
        '<div class="actions">' + (next ? '<button class="btn primary small" type="button" id="next-lesson">Next: ' + esc(LESSONS[lessonIndex + 1].title) + '</button>' : '') + '</div>';
      const nb = $('next-lesson');
      if (nb) nb.addEventListener('click', () => openLesson(lessonIndex + 1));
      setStatus('');
    } else {
      box.className = 'results';
      const firstBad = res.results.find((r) => !r.ok);
      box.innerHTML = '<h3>' + passed + ' of ' + res.results.length + ' checks passed</h3><p>' + esc(firstBad.msg || '') + '</p>' + notes;
      setStatus('');
    }
    renderSteps();
    renderLesson(res.results);
  }
  $('check').addEventListener('click', checkCode);

  let resetArmed = 0;
  $('reset-code').addEventListener('click', () => {
    const b = $('reset-code');
    if (!resetArmed) {
      b.textContent = 'Click again to replace your code';
      b.classList.add('armed');
      resetArmed = setTimeout(() => { resetArmed = 0; b.textContent = 'Start over'; b.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(resetArmed);
    resetArmed = 0;
    b.textContent = 'Start over';
    b.classList.remove('armed');
    setCode(lesson().starter);
    onEdit();
    setStatus('Back to the starting code.');
  });

  // ------------------------------------------------------------ start
  buildBoard();
  wireInputs();
  setPot(0);
  openLesson(lessonIndex);
})();
