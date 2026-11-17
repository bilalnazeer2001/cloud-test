/*
 * ESP32 Practice Bench - the virtual board.
 *
 * A plain data model with no drawing code, so lesson checks can use it without
 * a screen. Fixed wiring (the same in every lesson):
 *
 *   GPIO 2   on-board LED          GPIO 18  Button A (to GND)
 *   GPIO 25  red LED               GPIO 4   Button B (to GND)
 *   GPIO 26  yellow LED            GPIO 34  potentiometer (0-4095)
 *   GPIO 27  green LED             GPIO 23  buzzer
 */
(function (root) {
  'use strict';
  const Sim = (root.ESP32Sim = root.ESP32Sim || {});

  const MODE = { NONE: 0, INPUT: 1, OUTPUT: 3, INPUT_PULLUP: 5, INPUT_PULLDOWN: 9 };
  const VALID = new Set([0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39]);
  const INPUT_ONLY = new Set([34, 35, 36, 39]);
  const ADC = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 39]);
  const WIRING = {
    leds: { builtin: 2, red: 25, yellow: 26, green: 27 },
    buttons: { A: 18, B: 4 },
    pot: 34,
    buzzer: 23,
  };
  const MAX_SERIAL = 200000;

  class Board {
    constructor(opts) {
      opts = opts || {};
      this.rand = opts.rand || Math.random;
      this.onSerial = null;   // (text) => void
      this.onWarn = null;     // (message) => void
      this.pressed = { A: false, B: false };
      this.potValue = 0;
      this.reset();
    }

    /** Back to power-on state. Button and potentiometer positions are kept. */
    reset() {
      this.pins = {};
      this.tones = {};
      this.events = [];
      this.warnings = [];
      this.warned = new Set();
      this.serial = { begun: false, baud: 0, out: '', inBuf: '' };
    }

    pin(p) {
      return this.pins[p] || (this.pins[p] = { mode: MODE.NONE, out: 0, pwm: null, lvl: 0 });
    }
    warn(key, msg) {
      if (this.warned.has(key)) return;
      this.warned.add(key);
      this.warnings.push(msg);
      if (this.onWarn) this.onWarn(msg);
    }
    valid(p, what) {
      if (VALID.has(p)) return true;
      if (p >= 6 && p <= 11) this.warn('pin' + p, 'GPIO ' + p + " is used by the ESP32's own memory chip. Pick another pin for " + what + '.');
      else this.warn('pin' + p, 'There is no GPIO ' + p + ' on this board, so ' + what + ' does nothing.');
      return false;
    }
    note(p, t) {
      const pin = this.pin(p);
      const v = pin.mode === MODE.OUTPUT ? (pin.pwm != null ? pin.pwm / 255 : pin.out) : 0;
      if (v !== pin.lvl) { pin.lvl = v; this.events.push({ t, type: 'level', pin: p, v }); }
    }

    // ---- called by the learner's program
    pinMode(p, mode, t) {
      if (!this.valid(p, 'pinMode()')) return;
      if (mode !== MODE.INPUT && mode !== MODE.OUTPUT && mode !== MODE.INPUT_PULLUP && mode !== MODE.INPUT_PULLDOWN) {
        this.warn('mode' + p, 'pinMode(' + p + ', ...) needs INPUT, OUTPUT or INPUT_PULLUP as its second value.');
        return;
      }
      if (mode === MODE.OUTPUT && INPUT_ONLY.has(p)) {
        this.warn('ionly' + p, 'GPIO ' + p + ' can only be an input on the ESP32. It cannot switch anything on.');
        return;
      }
      const pin = this.pin(p);
      pin.mode = mode;
      if (mode !== MODE.OUTPUT) pin.pwm = null;
      this.note(p, t);
    }
    digitalWrite(p, v, t) {
      if (!this.valid(p, 'digitalWrite()')) return;
      const pin = this.pin(p);
      if (pin.mode !== MODE.OUTPUT) {
        this.warn('dw' + p, 'digitalWrite(' + p + ', ...) had no effect because GPIO ' + p + ' is not an output yet. Add pinMode(' + p + ', OUTPUT); in setup().');
      }
      pin.out = v ? 1 : 0;
      pin.pwm = null;
      this.note(p, t);
    }
    external(p) {
      if (p === WIRING.buttons.A) return this.pressed.A ? 0 : null;
      if (p === WIRING.buttons.B) return this.pressed.B ? 0 : null;
      if (p === WIRING.pot) return this.potValue > 2047 ? 1 : 0;
      return null;
    }
    digitalRead(p) {
      if (!this.valid(p, 'digitalRead()')) return 0;
      const pin = this.pin(p);
      if (pin.mode === MODE.OUTPUT) return pin.out;
      const ext = this.external(p);
      if (ext !== null) return ext;
      if (pin.mode === MODE.INPUT_PULLUP) return 1;
      if (pin.mode === MODE.INPUT_PULLDOWN) return 0;
      if (p === WIRING.buttons.A || p === WIRING.buttons.B) {
        this.warn('float' + p, 'GPIO ' + p + ' is "floating": the button only connects it to GND while pressed, so released it reads random values. Use pinMode(' + p + ', INPUT_PULLUP); in setup().');
        return this.rand() < 0.5 ? 0 : 1;
      }
      return 0;
    }
    analogRead(p) {
      if (!this.valid(p, 'analogRead()')) return 0;
      if (p === WIRING.pot) return this.potValue;
      if (!ADC.has(p)) { this.warn('adc' + p, 'GPIO ' + p + ' cannot measure analog values. The potentiometer is on GPIO ' + WIRING.pot + '.'); return 0; }
      return this.digitalRead(p) ? 4095 : 0;
    }
    analogWrite(p, v, t) {
      if (!this.valid(p, 'analogWrite()')) return;
      if (INPUT_ONLY.has(p)) { this.warn('ionly' + p, 'GPIO ' + p + ' can only be an input on the ESP32. It cannot switch anything on.'); return; }
      if (v < 0 || v > 255) this.warn('pwm' + p, 'analogWrite() expects 0 to 255. ' + Math.trunc(v) + ' was limited to that range. map() can convert a bigger range.');
      const pin = this.pin(p);
      pin.mode = MODE.OUTPUT;
      pin.pwm = Math.max(0, Math.min(255, Math.trunc(v)));
      this.note(p, t);
    }
    tone(p, freq, t, durMs) {
      if (!this.valid(p, 'tone()')) return;
      if (p !== WIRING.buzzer) this.warn('tone' + p, 'tone(' + p + ', ...) makes no sound: the buzzer is connected to GPIO ' + WIRING.buzzer + '.');
      freq = Math.max(0, Math.trunc(freq));
      this.tones[p] = { freq, end: durMs != null && durMs > 0 ? t + durMs * 1000 : Infinity };
      this.events.push({ t, type: 'tone', pin: p, freq });
    }
    noTone(p, t) {
      if (this.tones[p]) {
        delete this.tones[p];
        this.events.push({ t, type: 'tone', pin: p, freq: 0 });
      }
    }
    /** Stop any tone whose duration has run out. */
    sync(t) {
      for (const p in this.tones) {
        const tn = this.tones[p];
        if (tn.end <= t) {
          delete this.tones[p];
          this.events.push({ t: tn.end, type: 'tone', pin: Number(p), freq: 0 });
        }
      }
    }
    serialBegin(baud) {
      this.serial.begun = true;
      this.serial.baud = baud;
    }
    serialWrite(text) {
      if (!this.serial.begun) {
        this.warn('serial', 'Serial.print() was used before Serial.begin(115200); so nothing is shown. Add Serial.begin(115200); in setup().');
        return;
      }
      if (!text) return;
      if (this.serial.out.length < MAX_SERIAL) this.serial.out += text;
      if (this.onSerial) this.onSerial(text);
    }

    // ---- called by the screen and by lesson checks
    ledLevel(name) { return this.pin(WIRING.leds[name]).lvl; }
    buzzerFreq() { const tn = this.tones[WIRING.buzzer]; return tn ? tn.freq : 0; }
    setButton(name, down) { this.pressed[name] = !!down; }
    setPot(v) { this.potValue = Math.max(0, Math.min(4095, Math.round(v))); }
    serialSend(text) { this.serial.inBuf += text; }
  }

  Sim.Board = Board;
  Sim.MODE = MODE;
  Sim.WIRING = WIRING;
})(typeof window !== 'undefined' ? window : globalThis);
