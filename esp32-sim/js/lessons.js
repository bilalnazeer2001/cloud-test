/*
 * ESP32 Practice Bench - lessons and the checker that grades them.
 *
 * A check runs the learner's program on a fresh virtual board, in virtual time
 * (so 15 simulated seconds take a fraction of a real second), while a
 * "scenario" presses buttons, turns the potentiometer or types into the serial
 * monitor at set moments. Each check then looks at what happened.
 */
(function (root) {
  'use strict';
  const Sim = (root.ESP32Sim = root.ESP32Sim || {});

  // ------------------------------------------------------------ test runner
  /**
   * Run a compiled program against a scenario.
   *   scenario.ms    how long to run (virtual milliseconds)
   *   scenario.start initial inputs, e.g. { pot: 0 }
   *   scenario.at    [{ t: ms, pot, A, B, send }]  input changes over time
   */
  function runScenario(prog, scenario) {
    const board = new Sim.Board({ rand: Sim.mulberry32(7) });
    const st = scenario.start || {};
    if (st.pot != null) board.setPot(st.pot);
    board.setButton('A', !!st.A);
    board.setButton('B', !!st.B);
    const rt = new Sim.Runtime(prog, board, { seed: 99 });
    const steps = (scenario.at || []).slice().sort((a, b) => a.t - b.t);
    let error = null;
    try {
      for (const s of steps) {
        rt.run(s.t * 1000);
        if (rt.dead) break;
        if (s.pot != null) board.setPot(s.pot);
        if (s.A != null) board.setButton('A', s.A);
        if (s.B != null) board.setButton('B', s.B);
        if (s.send != null) board.serialSend(s.send);
      }
      if (!rt.dead) rt.run(scenario.ms * 1000);
    } catch (e) {
      if (!(e instanceof Sim.SimError)) throw e;
      error = e;
    }
    return makeTrace(board, error, scenario.ms);
  }

  function makeTrace(board, error, ms) {
    const W = Sim.WIRING;
    const levelEvents = (pin) => board.events.filter((e) => e.type === 'level' && e.pin === pin);
    const tr = {
      board, error, ms,
      serial: board.serial.out,
      lines: board.serial.out.split('\n').map((l) => l.trim()).filter(Boolean),
      warnings: board.warnings,
      /** Brightness 0..1 of a named LED at time t (ms). */
      level(name, t) {
        let v = 0;
        for (const e of levelEvents(W.leds[name])) { if (e.t / 1000 <= t) v = e.v; else break; }
        return v;
      },
      on(name, t) { return tr.level(name, t) > 0.5; },
      /** List of [timeMs, level] each time the LED changed. */
      changes(name) { return levelEvents(W.leds[name]).map((e) => [e.t / 1000, e.v]); },
      /** Buzzer frequency at time t (ms), 0 when silent. */
      freq(t) {
        let v = 0;
        for (const e of board.events) {
          if (e.type !== 'tone' || e.pin !== W.buzzer) continue;
          if (e.t / 1000 <= t) v = e.freq; else break;
        }
        return v;
      },
      numbers() {
        const out = [];
        for (const l of tr.lines) {
          const m = l.match(/-?\d+(\.\d+)?/g);
          if (m) out.push(Number(m[m.length - 1]));
        }
        return out;
      },
    };
    return tr;
  }

  // ------------------------------------------------------- check helpers
  const LED_NAMES = { builtin: 'on-board LED', red: 'red LED', yellow: 'yellow LED', green: 'green LED' };
  const sec = (ms) => (ms / 1000).toFixed(ms % 1000 ? 1 : 0) + ' s';
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const onWord = (b) => (b ? 'ON' : 'OFF');

  /** The LED must blink with the given on/off times (ms). */
  function blinks(tr, name, onMs, offMs) {
    const ch = tr.changes(name);
    const label = LED_NAMES[name];
    if (ch.length === 0) {
      const pin = Sim.WIRING.leds[name];
      if (tr.board.pin(pin).mode !== Sim.MODE.OUTPUT) return 'The ' + label + ' never turned on. Did you set pinMode(' + pin + ', OUTPUT); in setup()?';
      return 'The ' + label + ' never turned on.';
    }
    if (ch.length < 4) return 'The ' + label + ' changed only ' + ch.length + ' time' + (ch.length === 1 ? '' : 's') + '. It should keep blinking. Is the second delay() missing?';
    const tolOn = Math.max(25, onMs * 0.1), tolOff = Math.max(25, offMs * 0.1);
    for (let i = 1; i < ch.length - 1; i++) {
      const dur = ch[i + 1][0] - ch[i][0];
      const isOn = ch[i][1] > 0.5;
      if (isOn && !near(dur, onMs, tolOn)) return 'The ' + label + ' stayed ON for about ' + Math.round(dur) + ' ms. It should stay on for ' + onMs + ' ms.';
      if (!isOn && dur < 5) return 'The ' + label + ' goes off for only an instant, so it looks always on. Add a delay() after switching it off.';
      if (!isOn && !near(dur, offMs, tolOff)) return 'The ' + label + ' stayed OFF for about ' + Math.round(dur) + ' ms. It should stay off for ' + offMs + ' ms.';
    }
    return true;
  }
  /** At each [timeMs, {red:1, yellow:0...}] the named LEDs must match. */
  function states(tr, samples, explain) {
    for (const [t, want] of samples) {
      for (const name in want) {
        const got = tr.on(name, t);
        if (got !== !!want[name]) {
          return 'At ' + sec(t) + (explain ? ' (' + explain(t) + ')' : '') + ' the ' + LED_NAMES[name] + ' was ' + onWord(got) + ' but should be ' + onWord(!!want[name]) + '.';
        }
      }
    }
    return true;
  }
  const noError = (tr) => (tr.error ? 'The program stopped with an error on line ' + tr.error.line + ': ' + tr.error.message : true);
  const pullup = (tr, pin) => (tr.board.pin(pin).mode === Sim.MODE.INPUT_PULLUP
    ? true
    : 'GPIO ' + pin + ' should be set with pinMode(' + pin + ', INPUT_PULLUP); so the button reads HIGH when released.');
  const usesCall = (name, why) => (T) => (T.prog.calls.has(name) ? true : why);

  // ------------------------------------------------------------- lessons
  // Each check: { label, scenario?, test(tr, T) -> true | 'what went wrong' }
  const LESSONS = [
    {
      id: 'hello', title: 'Say hello', topic: 'Serial monitor',
      goal: 'Print <b>Hello ESP32</b> to the serial monitor once.',
      body: '<p>Every sketch has two parts. <code>setup()</code> runs once when the board starts. <code>loop()</code> runs again and again forever.</p>' +
        '<p>The <b>serial monitor</b> is how the board talks back to you. Start it with <code>Serial.begin(115200);</code> where 115200 is the speed. Then <code>Serial.println("text");</code> prints a line.</p>',
      starter: 'void setup() {\n  Serial.begin(115200);\n  // print your message here\n\n}\n\nvoid loop() {\n  // nothing to repeat yet\n}\n',
      hints: [
        'Write the print command inside setup(), below Serial.begin.',
        'Text goes inside double quotes, and every command ends with a semicolon ;',
        'The line you need is:  Serial.println("Hello ESP32");',
      ],
      solution: 'void setup() {\n  Serial.begin(115200);\n  Serial.println("Hello ESP32");\n}\n\nvoid loop() {\n}\n',
      checks: [
        { label: 'Serial monitor is started', scenario: { ms: 500 }, test: (tr) => noError(tr) !== true ? noError(tr) : (tr.board.serial.begun ? true : 'Serial.begin(115200); is missing from setup().') },
        { label: 'Prints "Hello ESP32"', scenario: { ms: 500 }, test: (tr) => (/hello\s*esp32/i.test(tr.serial) ? true : (tr.serial ? 'The monitor shows "' + tr.lines[0] + '" instead of Hello ESP32.' : 'Nothing was printed.')) },
        { label: 'Prints it only once', scenario: { ms: 500 }, test: (tr) => ((tr.serial.match(/hello\s*esp32/gi) || []).length === 1 ? true : 'The message was printed many times. Put it in setup(), not loop().') },
      ],
    },
    {
      id: 'led-on', title: 'Light an LED', topic: 'pinMode and digitalWrite',
      goal: 'Turn on the <b>on-board LED</b> (GPIO 2) and leave it on.',
      body: '<p>Each pin is numbered (GPIO 2, GPIO 25...). Before a pin can switch something on, tell the ESP32 it is an <b>output</b>: <code>pinMode(2, OUTPUT);</code></p>' +
        '<p>Then <code>digitalWrite(2, HIGH);</code> puts 3.3 volts on the pin and the LED lights. <code>LOW</code> turns it off.</p>',
      starter: 'void setup() {\n  // 1. make GPIO 2 an output\n\n  // 2. switch it on\n\n}\n\nvoid loop() {\n}\n',
      hints: [
        'You need two lines in setup(): one pinMode and one digitalWrite.',
        'pinMode(2, OUTPUT); comes first.',
        'Then digitalWrite(2, HIGH);',
      ],
      solution: 'void setup() {\n  pinMode(2, OUTPUT);\n  digitalWrite(2, HIGH);\n}\n\nvoid loop() {\n}\n',
      checks: [
        { label: 'GPIO 2 is an output', scenario: { ms: 300 }, test: (tr) => (tr.board.pin(2).mode === Sim.MODE.OUTPUT ? true : 'Use pinMode(2, OUTPUT); in setup().') },
        { label: 'On-board LED is on', scenario: { ms: 1000 }, test: (tr) => noError(tr) !== true ? noError(tr) : (tr.on('builtin', 1000) ? true : 'The on-board LED is off. Use digitalWrite(2, HIGH);') },
      ],
    },
    {
      id: 'blink', title: 'Blink', topic: 'delay()',
      goal: 'Blink the on-board LED: <b>1 second on, 1 second off</b>, forever.',
      body: '<p><code>delay(1000);</code> pauses the program for 1000 milliseconds, which is 1 second.</p>' +
        '<p>Because <code>loop()</code> repeats, you only need to describe one blink: on, wait, off, wait.</p>',
      starter: 'void setup() {\n  pinMode(2, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(2, HIGH);\n  // wait here\n\n  // switch off and wait again\n\n}\n',
      hints: [
        'After switching the LED on, wait with delay(1000);',
        'Then digitalWrite(2, LOW); and another delay(1000);',
        'Without the second delay the LED is off for only a few microseconds, so it looks always on.',
      ],
      solution: 'void setup() {\n  pinMode(2, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(2, HIGH);\n  delay(1000);\n  digitalWrite(2, LOW);\n  delay(1000);\n}\n',
      checks: [
        { label: 'Uses delay()', test: (tr, T) => usesCall('delay', 'Use delay(1000); to wait.')(T) },
        { label: 'LED is on for 1 s, off for 1 s', scenario: { ms: 6000 }, test: (tr) => noError(tr) !== true ? noError(tr) : blinks(tr, 'builtin', 1000, 1000) },
      ],
    },
    {
      id: 'heartbeat', title: 'Heartbeat', topic: 'Choosing times',
      goal: 'Flash the <b>red LED</b> (GPIO 25): <b>on for 200 ms, off for 800 ms</b>.',
      body: '<p>The board has external LEDs too. The red one is wired to <b>GPIO 25</b>, yellow to <b>26</b>, green to <b>27</b>.</p>' +
        '<p>On and off times do not have to match. A short flash with a long pause looks like a heartbeat.</p>' +
        '<p>Tip: give pins a name with <code>#define RED 25</code> at the top. Then write <code>RED</code> instead of 25.</p>',
      starter: '#define RED 25\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n}\n\nvoid loop() {\n  // on for 200 ms, off for 800 ms\n\n}\n',
      hints: [
        'It is the Blink lesson again, with a different pin and different times.',
        'digitalWrite(RED, HIGH); delay(200); then LOW and delay(800);',
      ],
      solution: '#define RED 25\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(RED, HIGH);\n  delay(200);\n  digitalWrite(RED, LOW);\n  delay(800);\n}\n',
      checks: [
        { label: 'Red LED flashes 200 ms on, 800 ms off', scenario: { ms: 5000 }, test: (tr) => noError(tr) !== true ? noError(tr) : blinks(tr, 'red', 200, 800) },
      ],
    },
    {
      id: 'traffic', title: 'Traffic light', topic: 'Sequences',
      goal: 'Loop through <b>green 3 s</b>, then <b>yellow 1 s</b>, then <b>red 3 s</b>. Only one light on at a time.',
      body: '<p>A traffic light is a sequence: switch one light on, wait, switch it off, switch the next one on.</p>' +
        '<p>Set all three pins as outputs in <code>setup()</code>. Remember to turn each light <b>off</b> before the next one comes on.</p>',
      starter: '#define RED 25\n#define YELLOW 26\n#define GREEN 27\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  // green for 3 seconds\n\n  // yellow for 1 second\n\n  // red for 3 seconds\n\n}\n',
      hints: [
        'Each step is three lines: light on, delay, light off.',
        'Green step: digitalWrite(GREEN, HIGH); delay(3000); digitalWrite(GREEN, LOW);',
        'Repeat that for YELLOW with 1000 and RED with 3000.',
      ],
      solution: '#define RED 25\n#define YELLOW 26\n#define GREEN 27\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(GREEN, HIGH);\n  delay(3000);\n  digitalWrite(GREEN, LOW);\n\n  digitalWrite(YELLOW, HIGH);\n  delay(1000);\n  digitalWrite(YELLOW, LOW);\n\n  digitalWrite(RED, HIGH);\n  delay(3000);\n  digitalWrite(RED, LOW);\n}\n',
      checks: [
        {
          label: 'Lights follow green, yellow, red', scenario: { ms: 16000 },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [
            [1500, { green: 1, yellow: 0, red: 0 }], [3500, { green: 0, yellow: 1, red: 0 }],
            [5500, { green: 0, yellow: 0, red: 1 }], [8500, { green: 1, yellow: 0, red: 0 }],
            [10500, { green: 0, yellow: 1, red: 0 }], [12500, { green: 0, yellow: 0, red: 1 }],
          ]),
        },
        {
          label: 'Times are 3 s, 1 s, 3 s', scenario: { ms: 16000 },
          test: (tr) => states(tr, [[2900, { green: 1 }], [3100, { green: 0, yellow: 1 }], [3900, { yellow: 1 }], [4100, { yellow: 0, red: 1 }], [6900, { red: 1 }], [7100, { red: 0, green: 1 }]]),
        },
      ],
    },
    {
      id: 'counter', title: 'Count the blinks', topic: 'Variables',
      goal: 'Blink the on-board LED (500 ms on, 500 ms off) and print the blink number each time: <b>1, 2, 3...</b>',
      body: '<p>A <b>variable</b> is a named box that holds a value. <code>int count = 0;</code> makes a whole-number box called <code>count</code> that starts at 0.</p>' +
        '<p>Create it <b>above</b> <code>setup()</code> so it keeps its value between loops. <code>count = count + 1;</code> (or the short form <code>count++;</code>) adds one.</p>',
      starter: 'int count = 0;\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(2, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(2, HIGH);\n  delay(500);\n  digitalWrite(2, LOW);\n  delay(500);\n  // add one to count, then print it\n\n}\n',
      hints: [
        'count++; adds one to count.',
        'Serial.println(count); prints the number.',
        'If every line says 1, the variable is probably created inside loop(). It must be above setup().',
      ],
      solution: 'int count = 0;\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(2, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(2, HIGH);\n  delay(500);\n  digitalWrite(2, LOW);\n  delay(500);\n  count++;\n  Serial.println(count);\n}\n',
      checks: [
        { label: 'LED blinks 500 ms on, 500 ms off', scenario: { ms: 5000 }, test: (tr) => noError(tr) !== true ? noError(tr) : blinks(tr, 'builtin', 500, 500) },
        {
          label: 'Prints 1, 2, 3, 4...', scenario: { ms: 5000 },
          test: (tr) => {
            const n = tr.numbers();
            if (n.length < 3) return 'Expected a number for each blink. Only ' + n.length + ' printed in 5 seconds.';
            for (let i = 0; i < n.length; i++) if (n[i] !== i + 1) return 'Line ' + (i + 1) + ' printed ' + n[i] + ' but should print ' + (i + 1) + '.';
            return true;
          },
        },
        { label: 'One number per blink', scenario: { ms: 5000 }, test: (tr) => (tr.numbers().length >= 4 && tr.numbers().length <= 5 ? true : 'In 5 seconds there should be 5 blinks, but ' + tr.numbers().length + ' numbers were printed.') },
      ],
    },
    {
      id: 'for-loop', title: 'Exactly five', topic: 'for loops',
      goal: 'When the board starts, blink the <b>yellow LED</b> (GPIO 26) exactly <b>5 times</b> (300 ms on, 300 ms off), then stop.',
      body: '<p>A <code>for</code> loop repeats a block a set number of times:</p>' +
        '<pre>for (int i = 0; i &lt; 5; i++) {\n  // runs 5 times: i is 0,1,2,3,4\n}</pre>' +
        '<p>Put it in <code>setup()</code> so it happens once. Leave <code>loop()</code> empty.</p>',
      starter: '#define YELLOW 26\n\nvoid setup() {\n  pinMode(YELLOW, OUTPUT);\n  // repeat a blink 5 times\n\n}\n\nvoid loop() {\n}\n',
      hints: [
        'Start the loop with: for (int i = 0; i < 5; i++) {',
        'Inside the braces, write one blink: HIGH, delay(300), LOW, delay(300).',
        'Close the loop with } before the } that ends setup().',
      ],
      solution: '#define YELLOW 26\n\nvoid setup() {\n  pinMode(YELLOW, OUTPUT);\n  for (int i = 0; i < 5; i++) {\n    digitalWrite(YELLOW, HIGH);\n    delay(300);\n    digitalWrite(YELLOW, LOW);\n    delay(300);\n  }\n}\n\nvoid loop() {\n}\n',
      checks: [
        { label: 'Uses a for loop', test: (tr, T) => (T.prog.kinds.has('for') ? true : 'Use a for loop instead of writing the blink five times.') },
        {
          label: 'Yellow blinks exactly 5 times', scenario: { ms: 8000 },
          test: (tr) => {
            if (noError(tr) !== true) return noError(tr);
            const ons = tr.changes('yellow').filter((c) => c[1] > 0.5).length;
            return ons === 5 ? true : 'The yellow LED blinked ' + ons + ' time' + (ons === 1 ? '' : 's') + ', not 5.';
          },
        },
        { label: 'Blink is 300 ms on, 300 ms off', scenario: { ms: 8000 }, test: (tr) => states(tr, [[150, { yellow: 1 }], [450, { yellow: 0 }], [750, { yellow: 1 }], [2550, { yellow: 1 }], [2850, { yellow: 0 }]]) },
        { label: 'Stays off afterwards', scenario: { ms: 8000 }, test: (tr) => (tr.on('yellow', 7900) ? 'The yellow LED is still on at the end. Switch it off inside the loop.' : true) },
      ],
    },
    {
      id: 'button', title: 'Press to light', topic: 'digitalRead and if',
      goal: 'Make the <b>red LED</b> light only <b>while Button A is held down</b>.',
      body: '<p>Button A is wired between <b>GPIO 18</b> and ground (0 V). <code>pinMode(18, INPUT_PULLUP);</code> turns on a resistor inside the ESP32 that holds the pin HIGH, so:</p>' +
        '<ul><li>released: <code>digitalRead(18)</code> is <code>HIGH</code></li><li>pressed: it is <code>LOW</code></li></ul>' +
        '<p>Use <code>if (...) { } else { }</code> to choose what to do. Compare with <b>two</b> equals signs: <code>==</code>.</p>' +
        '<p>Click Button A on the board, or hold the <kbd>A</kbd> key.</p>',
      starter: '#define RED 25\n#define BUTTON_A 18\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(BUTTON_A) == LOW) {\n    // pressed\n\n  } else {\n    // released\n\n  }\n}\n',
      hints: [
        'Pressed means LOW because the button connects the pin to ground.',
        'In the first block: digitalWrite(RED, HIGH);  In the else block: digitalWrite(RED, LOW);',
      ],
      solution: '#define RED 25\n#define BUTTON_A 18\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(BUTTON_A) == LOW) {\n    digitalWrite(RED, HIGH);\n  } else {\n    digitalWrite(RED, LOW);\n  }\n}\n',
      checks: [
        { label: 'Button pin uses INPUT_PULLUP', scenario: { ms: 200 }, test: (tr) => pullup(tr, 18) },
        {
          label: 'Red LED follows Button A',
          scenario: { ms: 3500, at: [{ t: 500, A: true }, { t: 1500, A: false }, { t: 2500, A: true }, { t: 3000, A: false }] },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [[400, { red: 0 }], [1000, { red: 1 }], [2000, { red: 0 }], [2800, { red: 1 }], [3400, { red: 0 }]],
            (t) => ((t > 500 && t < 1500) || (t > 2500 && t < 3000) ? 'button held' : 'button released')),
        },
      ],
    },
    {
      id: 'toggle', title: 'Click on, click off', topic: 'Remembering the last state',
      goal: 'Each <b>press</b> of Button A switches the <b>green LED</b> between on and off. Holding the button must not make it flicker.',
      body: '<p>To react to a <i>press</i> (not to <i>being held</i>), remember what the button was last time and act only when it changes from HIGH to LOW.</p>' +
        '<pre>int now = digitalRead(18);\nif (lastButton == HIGH &amp;&amp; now == LOW) {\n  // it was just pressed\n}\nlastButton = now;</pre>' +
        '<p><code>ledOn = !ledOn;</code> flips a true/false value. A short <code>delay(20);</code> in loop() also hides the "bounce" of real buttons.</p>',
      starter: '#define GREEN 27\n#define BUTTON_A 18\n\nint lastButton = HIGH;\nbool ledOn = false;\n\nvoid setup() {\n  pinMode(GREEN, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  int now = digitalRead(BUTTON_A);\n  // if it was just pressed, flip ledOn\n\n  lastButton = now;\n  digitalWrite(GREEN, ledOn);\n  delay(20);\n}\n',
      hints: [
        '"Just pressed" means: last time it was HIGH, now it is LOW.',
        'if (lastButton == HIGH && now == LOW) { ledOn = !ledOn; }',
      ],
      solution: '#define GREEN 27\n#define BUTTON_A 18\n\nint lastButton = HIGH;\nbool ledOn = false;\n\nvoid setup() {\n  pinMode(GREEN, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  int now = digitalRead(BUTTON_A);\n  if (lastButton == HIGH && now == LOW) {\n    ledOn = !ledOn;\n  }\n  lastButton = now;\n  digitalWrite(GREEN, ledOn);\n  delay(20);\n}\n',
      checks: [
        { label: 'Button pin uses INPUT_PULLUP', scenario: { ms: 200 }, test: (tr) => pullup(tr, 18) },
        {
          label: 'Each press toggles the green LED',
          scenario: { ms: 4000, at: [{ t: 500, A: true }, { t: 700, A: false }, { t: 1500, A: true }, { t: 1700, A: false }, { t: 2500, A: true }, { t: 3300, A: false }] },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [[400, { green: 0 }], [1000, { green: 1 }], [2000, { green: 0 }], [3000, { green: 1 }], [3900, { green: 1 }]], (t) => 'after ' + (t < 500 ? 0 : t < 1500 ? 1 : t < 2500 ? 2 : 3) + ' press(es)'),
        },
        {
          label: 'Holding the button does not flicker',
          scenario: { ms: 4000, at: [{ t: 500, A: true }, { t: 700, A: false }, { t: 1500, A: true }, { t: 1700, A: false }, { t: 2500, A: true }, { t: 3300, A: false }] },
          test: (tr) => {
            const n = tr.changes('green').length;
            return n === 3 ? true : 'Three presses should make 3 changes, but the green LED changed ' + n + ' times. React only when the button goes from HIGH to LOW.';
          },
        },
      ],
    },
    {
      id: 'two-buttons', title: 'On and off buttons', topic: 'Two inputs',
      goal: '<b>Button A</b> (GPIO 18) turns the <b>yellow LED</b> on. <b>Button B</b> (GPIO 4) turns it off. The LED stays as it is after the button is released.',
      body: '<p>Two separate <code>if</code> statements can watch two buttons. You do not need a variable here: the LED itself remembers its state until you change it.</p>' +
        '<p>Button B is on <b>GPIO 4</b> and also needs <code>INPUT_PULLUP</code>. Keyboard: <kbd>A</kbd> and <kbd>B</kbd>.</p>',
      starter: '#define YELLOW 26\n#define BUTTON_A 18\n#define BUTTON_B 4\n\nvoid setup() {\n  pinMode(YELLOW, OUTPUT);\n  // set up both buttons\n\n}\n\nvoid loop() {\n  // A pressed -> on\n\n  // B pressed -> off\n\n}\n',
      hints: [
        'In setup(): pinMode(BUTTON_A, INPUT_PULLUP); and the same for BUTTON_B.',
        'if (digitalRead(BUTTON_A) == LOW) { digitalWrite(YELLOW, HIGH); }',
        'Do not add an else. That would switch the LED off as soon as you let go.',
      ],
      solution: '#define YELLOW 26\n#define BUTTON_A 18\n#define BUTTON_B 4\n\nvoid setup() {\n  pinMode(YELLOW, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n  pinMode(BUTTON_B, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(BUTTON_A) == LOW) {\n    digitalWrite(YELLOW, HIGH);\n  }\n  if (digitalRead(BUTTON_B) == LOW) {\n    digitalWrite(YELLOW, LOW);\n  }\n}\n',
      checks: [
        { label: 'Both buttons use INPUT_PULLUP', scenario: { ms: 200 }, test: (tr) => (pullup(tr, 18) !== true ? pullup(tr, 18) : pullup(tr, 4)) },
        {
          label: 'A switches on, B switches off',
          scenario: { ms: 4500, at: [{ t: 500, A: true }, { t: 700, A: false }, { t: 2000, B: true }, { t: 2200, B: false }, { t: 3500, A: true }, { t: 3600, A: false }] },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [[400, { yellow: 0 }], [600, { yellow: 1 }], [1500, { yellow: 1 }], [3000, { yellow: 0 }], [4400, { yellow: 1 }]],
            (t) => (t < 500 ? 'nothing pressed yet' : t < 2000 ? 'A was pressed and released' : t < 3500 ? 'B was pressed' : 'A was pressed again')),
        },
      ],
    },
    {
      id: 'pot-read', title: 'Read the knob', topic: 'analogRead',
      goal: 'Print the <b>potentiometer</b> reading about <b>5 times a second</b> (every 200 ms).',
      body: '<p>A potentiometer is a knob. It gives a voltage between 0 and 3.3 V. <code>analogRead(34)</code> measures it and returns a number from <b>0</b> (fully left) to <b>4095</b> (fully right).</p>' +
        '<p>Store the result in a variable, print it, then wait. Drag the knob on the board while it runs.</p>',
      starter: '#define POT 34\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  // print value, then wait 200 ms\n\n}\n',
      hints: [
        'Serial.println(value);',
        'Then delay(200);',
      ],
      solution: '#define POT 34\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  Serial.println(value);\n  delay(200);\n}\n',
      checks: [
        { label: 'Uses analogRead()', test: (tr, T) => usesCall('analogRead', 'Use analogRead(34) to read the knob.')(T) },
        {
          label: 'Printed values follow the knob',
          scenario: { ms: 3000, start: { pot: 0 }, at: [{ t: 1000, pot: 2048 }, { t: 2000, pot: 4095 }] },
          test: (tr) => {
            if (noError(tr) !== true) return noError(tr);
            const n = tr.numbers();
            if (!n.length) return 'Nothing was printed.';
            if (!n.includes(0)) return 'With the knob fully left the reading should be 0.';
            if (!n.includes(2048)) return 'With the knob in the middle the reading should be 2048. Print analogRead(34).';
            if (n[n.length - 1] !== 4095) return 'With the knob fully right the last reading should be 4095.';
            return true;
          },
        },
        {
          label: 'About 5 readings per second', scenario: { ms: 3000, start: { pot: 1000 } },
          test: (tr) => { const c = tr.numbers().length; return c >= 12 && c <= 18 ? true : c + ' readings in 3 seconds. Expected about 15: use delay(200);'; },
        },
      ],
    },
    {
      id: 'bar-graph', title: 'Level meter', topic: 'if / else if',
      goal: 'Show the knob position on the LEDs: <b>green</b> above 1000, <b>green + yellow</b> above 2000, <b>all three</b> above 3000. Below 1000, all off.',
      body: '<p>Each LED gets its own question. Comparison operators: <code>&gt;</code> greater, <code>&lt;</code> less, <code>&gt;=</code> greater or equal.</p>' +
        '<p>A neat trick: <code>digitalWrite(GREEN, value &gt; 1000);</code> works because a comparison is 1 (true) or 0 (false), the same as HIGH and LOW.</p>',
      starter: '#define RED 25\n#define YELLOW 26\n#define GREEN 27\n#define POT 34\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  // light the right LEDs for this value\n\n  delay(20);\n}\n',
      hints: [
        'if (value > 1000) { digitalWrite(GREEN, HIGH); } else { digitalWrite(GREEN, LOW); }',
        'Write the same for YELLOW with 2000 and RED with 3000.',
        'Or shorter: digitalWrite(GREEN, value > 1000);',
      ],
      solution: '#define RED 25\n#define YELLOW 26\n#define GREEN 27\n#define POT 34\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  digitalWrite(GREEN, value > 1000);\n  digitalWrite(YELLOW, value > 2000);\n  digitalWrite(RED, value > 3000);\n  delay(20);\n}\n',
      checks: [
        {
          label: 'LEDs match the knob position',
          scenario: { ms: 2500, start: { pot: 500 }, at: [{ t: 500, pot: 1500 }, { t: 1000, pot: 2500 }, { t: 1500, pot: 3500 }, { t: 2000, pot: 200 }] },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [
            [400, { green: 0, yellow: 0, red: 0 }], [900, { green: 1, yellow: 0, red: 0 }], [1400, { green: 1, yellow: 1, red: 0 }],
            [1900, { green: 1, yellow: 1, red: 1 }], [2400, { green: 0, yellow: 0, red: 0 }],
          ], (t) => 'knob at ' + (t < 500 ? 500 : t < 1000 ? 1500 : t < 1500 ? 2500 : t < 2000 ? 3500 : 200)),
        },
      ],
    },
    {
      id: 'dimmer', title: 'Dimmer', topic: 'analogWrite and map()',
      goal: 'Use the knob to set the <b>brightness of the red LED</b>, from fully off (knob left) to full brightness (knob right).',
      body: '<p><code>analogWrite(pin, value)</code> sets brightness from <b>0</b> (off) to <b>255</b> (full). It works by switching the pin on and off very fast (called PWM).</p>' +
        '<p>The knob gives 0 to 4095 but brightness needs 0 to 255. <code>map()</code> converts between ranges:</p>' +
        '<pre>int b = map(value, 0, 4095, 0, 255);</pre>',
      starter: '#define RED 25\n#define POT 34\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  // convert to 0-255 and set the brightness\n\n  delay(20);\n}\n',
      hints: [
        'int brightness = map(value, 0, 4095, 0, 255);',
        'analogWrite(RED, brightness);',
      ],
      solution: '#define RED 25\n#define POT 34\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  int brightness = map(value, 0, 4095, 0, 255);\n  analogWrite(RED, brightness);\n  delay(20);\n}\n',
      checks: [
        { label: 'Uses analogWrite()', test: (tr, T) => usesCall('analogWrite', 'Use analogWrite(RED, brightness); to set a brightness.')(T) },
        {
          label: 'Brightness follows the knob',
          scenario: { ms: 1500, start: { pot: 0 }, at: [{ t: 500, pot: 4095 }, { t: 1000, pot: 2048 }] },
          test: (tr) => {
            if (noError(tr) !== true) return noError(tr);
            const pct = (t) => Math.round(tr.level('red', t) * 100);
            if (pct(400) > 2) return 'With the knob fully left the LED should be off, but it is at ' + pct(400) + '%.';
            if (pct(900) < 98) return 'With the knob fully right the LED should be at full brightness, but it is at ' + pct(900) + '%. Is the value mapped to 0-255?';
            if (Math.abs(pct(1400) - 50) > 4) return 'With the knob in the middle the LED should be about half bright, but it is at ' + pct(1400) + '%.';
            return true;
          },
        },
      ],
    },
    {
      id: 'beep', title: 'Beep', topic: 'tone()',
      goal: 'Make the <b>buzzer</b> (GPIO 23) beep at <b>1000 Hz</b>: 200 ms of sound, then 800 ms of silence, repeating.',
      body: '<p><code>tone(23, 1000);</code> starts a sound of 1000 Hz (vibrations per second). Higher numbers mean higher notes. <code>noTone(23);</code> stops it.</p>' +
        '<p>Click <b>Sound on</b> above the board to hear it. The checks work with sound off too.</p>',
      starter: '#define BUZZER 23\n\nvoid setup() {\n}\n\nvoid loop() {\n  // 200 ms of 1000 Hz, then 800 ms of silence\n\n}\n',
      hints: [
        'tone(BUZZER, 1000); delay(200);',
        'noTone(BUZZER); delay(800);',
      ],
      solution: '#define BUZZER 23\n\nvoid setup() {\n}\n\nvoid loop() {\n  tone(BUZZER, 1000);\n  delay(200);\n  noTone(BUZZER);\n  delay(800);\n}\n',
      checks: [
        {
          label: '1000 Hz for 200 ms, then silent for 800 ms', scenario: { ms: 3000 },
          test: (tr) => {
            if (noError(tr) !== true) return noError(tr);
            const want = [[100, 1000], [500, 0], [900, 0], [1100, 1000], [1500, 0], [2100, 1000]];
            for (const [t, f] of want) {
              const got = tr.freq(t);
              if (got !== f) return 'At ' + sec(t) + ' the buzzer was ' + (got ? 'playing ' + got + ' Hz' : 'silent') + ' but should be ' + (f ? 'playing ' + f + ' Hz' : 'silent') + '.';
            }
            return true;
          },
        },
      ],
    },
    {
      id: 'doorbell', title: 'Doorbell', topic: 'Inputs and sound',
      goal: 'Play <b>440 Hz</b> on the buzzer only <b>while Button A is held</b>.',
      body: '<p>Combine the button lesson with the buzzer. When the button is pressed, call <code>tone()</code>. When it is released, call <code>noTone()</code>.</p>',
      starter: '#define BUZZER 23\n#define BUTTON_A 18\n\nvoid setup() {\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n\n}\n',
      hints: [
        'Use the same if / else shape as the "Press to light" lesson.',
        'if (digitalRead(BUTTON_A) == LOW) { tone(BUZZER, 440); } else { noTone(BUZZER); }',
      ],
      solution: '#define BUZZER 23\n#define BUTTON_A 18\n\nvoid setup() {\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(BUTTON_A) == LOW) {\n    tone(BUZZER, 440);\n  } else {\n    noTone(BUZZER);\n  }\n}\n',
      checks: [
        { label: 'Button pin uses INPUT_PULLUP', scenario: { ms: 200 }, test: (tr) => pullup(tr, 18) },
        {
          label: 'Rings only while Button A is held',
          scenario: { ms: 3000, at: [{ t: 500, A: true }, { t: 1500, A: false }, { t: 2200, A: true }, { t: 2600, A: false }] },
          test: (tr) => {
            if (noError(tr) !== true) return noError(tr);
            for (const [t, f] of [[300, 0], [1000, 440], [2000, 0], [2400, 440], [2900, 0]]) {
              const got = tr.freq(t);
              if (got !== f) return 'At ' + sec(t) + ' (button ' + (f ? 'held' : 'released') + ') the buzzer was ' + (got ? 'playing ' + got + ' Hz' : 'silent') + '.';
            }
            return true;
          },
        },
      ],
    },
    {
      id: 'theremin', title: 'Knob synth', topic: 'map() for sound',
      goal: 'Play a continuous note whose pitch follows the knob: <b>200 Hz</b> fully left, <b>2000 Hz</b> fully right.',
      body: '<p>This is the dimmer idea applied to sound. Read the knob, <code>map()</code> it to a frequency range, then call <code>tone()</code> with that frequency.</p>' +
        '<p>Calling <code>tone()</code> again with a new number simply changes the note.</p>',
      starter: '#define BUZZER 23\n#define POT 34\n\nvoid setup() {\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  // map to 200..2000 and play it\n\n  delay(20);\n}\n',
      hints: [
        'int freq = map(value, 0, 4095, 200, 2000);',
        'tone(BUZZER, freq);',
      ],
      solution: '#define BUZZER 23\n#define POT 34\n\nvoid setup() {\n}\n\nvoid loop() {\n  int value = analogRead(POT);\n  int freq = map(value, 0, 4095, 200, 2000);\n  tone(BUZZER, freq);\n  delay(20);\n}\n',
      checks: [
        {
          label: 'Pitch follows the knob',
          scenario: { ms: 1500, start: { pot: 0 }, at: [{ t: 500, pot: 4095 }, { t: 1000, pot: 2048 }] },
          test: (tr) => {
            if (noError(tr) !== true) return noError(tr);
            for (const [t, f, where] of [[400, 200, 'fully left'], [900, 2000, 'fully right'], [1400, 1100, 'in the middle']]) {
              const got = tr.freq(t);
              if (Math.abs(got - f) > 5) return 'With the knob ' + where + ' the note should be about ' + f + ' Hz, but it was ' + (got ? got + ' Hz' : 'silent') + '.';
            }
            return true;
          },
        },
      ],
    },
    {
      id: 'millis', title: 'Two jobs at once', topic: 'millis() instead of delay()',
      goal: 'Blink the <b>red LED</b> (500 ms on, 500 ms off) while the <b>green LED</b> follows Button A instantly. <b>No delay()</b> allowed.',
      body: '<p>During <code>delay()</code> the ESP32 does nothing else, so a button press would be missed. The fix: check the clock instead of waiting.</p>' +
        '<p><code>millis()</code> returns the milliseconds since the board started. Remember when you last toggled, and toggle again once 500 ms have passed:</p>' +
        '<pre>if (millis() - lastToggle &gt;= 500) {\n  lastToggle = millis();\n  redOn = !redOn;\n}</pre>' +
        '<p>Use <code>unsigned long</code> for time variables: they hold big numbers.</p>',
      starter: '#define RED 25\n#define GREEN 27\n#define BUTTON_A 18\n\nunsigned long lastToggle = 0;\nbool redOn = true;\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  // job 1: toggle red every 500 ms using millis()\n\n  digitalWrite(RED, redOn);\n\n  // job 2: green follows Button A\n\n}\n',
      hints: [
        'Job 1 is the code shown in the lesson text.',
        'Job 2: digitalWrite(GREEN, digitalRead(BUTTON_A) == LOW);',
        'Make sure there is no delay() anywhere in the sketch.',
      ],
      solution: '#define RED 25\n#define GREEN 27\n#define BUTTON_A 18\n\nunsigned long lastToggle = 0;\nbool redOn = true;\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n  pinMode(BUTTON_A, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (millis() - lastToggle >= 500) {\n    lastToggle = millis();\n    redOn = !redOn;\n  }\n  digitalWrite(RED, redOn);\n\n  digitalWrite(GREEN, digitalRead(BUTTON_A) == LOW);\n}\n',
      checks: [
        { label: 'Uses millis()', test: (tr, T) => usesCall('millis', 'Use millis() to check how much time has passed.')(T) },
        { label: 'No delay() in the sketch', test: (tr, T) => (T.prog.calls.has('delay') ? 'Remove every delay(). While it waits, button presses are missed.' : true) },
        { label: 'Red blinks 500 ms on, 500 ms off', scenario: { ms: 4000 }, test: (tr) => noError(tr) !== true ? noError(tr) : blinks(tr, 'red', 500, 500) },
        {
          label: 'Green reacts to a quick tap at once',
          scenario: { ms: 2000, at: [{ t: 1230, A: true }, { t: 1270, A: false }] },
          test: (tr) => states(tr, [[1200, { green: 0 }], [1250, { green: 1 }], [1320, { green: 0 }]], (t) => (t < 1230 ? 'before the tap' : t < 1270 ? 'during a 40 ms tap' : 'after the tap')),
        },
      ],
    },
    {
      id: 'functions', title: 'Your own function', topic: 'Functions with inputs',
      goal: 'Write a function <code>flash(int pin)</code> that lights a pin for 200 ms then waits 100 ms off. Use it to flash <b>red, yellow, green</b> in turn, forever.',
      body: '<p>A <b>function</b> is a named recipe you can reuse. Inputs go in the brackets:</p>' +
        '<pre>void flash(int pin) {\n  // use pin here\n}</pre>' +
        '<p>Write it outside <code>setup()</code> and <code>loop()</code>. Then call it like a built-in: <code>flash(RED);</code></p>',
      starter: '#define RED 25\n#define YELLOW 26\n#define GREEN 27\n\n// write void flash(int pin) here\n\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  // call flash for each colour\n\n}\n',
      hints: [
        'Inside flash: digitalWrite(pin, HIGH); delay(200); digitalWrite(pin, LOW); delay(100);',
        'In loop(): flash(RED); flash(YELLOW); flash(GREEN);',
      ],
      solution: '#define RED 25\n#define YELLOW 26\n#define GREEN 27\n\nvoid flash(int pin) {\n  digitalWrite(pin, HIGH);\n  delay(200);\n  digitalWrite(pin, LOW);\n  delay(100);\n}\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  flash(RED);\n  flash(YELLOW);\n  flash(GREEN);\n}\n',
      checks: [
        {
          label: 'Defines a function with an input', test: (tr, T) => {
            const own = [...T.prog.fns.values()].filter((f) => f.name !== 'setup' && f.name !== 'loop');
            if (!own.length) return 'Write your own function, like void flash(int pin) { ... }';
            if (!own.some((f) => f.params.length >= 1)) return 'Your function needs an input in the brackets: (int pin)';
            if (!own.some((f) => T.prog.calls.has(f.name))) return 'You wrote ' + own[0].name + '() but never call it.';
            return true;
          },
        },
        {
          label: 'Red, yellow, green, 200 ms each with 100 ms gaps', scenario: { ms: 2000 },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [
            [100, { red: 1, yellow: 0, green: 0 }], [250, { red: 0, yellow: 0, green: 0 }], [400, { red: 0, yellow: 1, green: 0 }],
            [700, { red: 0, yellow: 0, green: 1 }], [1000, { red: 1, yellow: 0, green: 0 }], [1150, { red: 0, yellow: 0, green: 0 }],
          ]),
        },
      ],
    },
    {
      id: 'arrays', title: 'Running light', topic: 'Arrays',
      goal: 'Keep the pins in an array and light them one after another: <b>red, yellow, green</b>, <b>250 ms</b> each, with only one on at a time.',
      body: '<p>An <b>array</b> is a numbered list: <code>int leds[] = {25, 26, 27};</code></p>' +
        '<p>Items are counted from 0, so <code>leds[0]</code> is 25 and <code>leds[2]</code> is 27. A <code>for</code> loop can walk through them:</p>' +
        '<pre>for (int i = 0; i &lt; 3; i++) {\n  // leds[i] is the current pin\n}</pre>',
      starter: 'int leds[] = {25, 26, 27};\n\nvoid setup() {\n  for (int i = 0; i < 3; i++) {\n    pinMode(leds[i], OUTPUT);\n  }\n}\n\nvoid loop() {\n  // light each LED for 250 ms, one after another\n\n}\n',
      hints: [
        'Copy the for loop from setup() into loop().',
        'Inside it: digitalWrite(leds[i], HIGH); delay(250); digitalWrite(leds[i], LOW);',
      ],
      solution: 'int leds[] = {25, 26, 27};\n\nvoid setup() {\n  for (int i = 0; i < 3; i++) {\n    pinMode(leds[i], OUTPUT);\n  }\n}\n\nvoid loop() {\n  for (int i = 0; i < 3; i++) {\n    digitalWrite(leds[i], HIGH);\n    delay(250);\n    digitalWrite(leds[i], LOW);\n  }\n}\n',
      checks: [
        { label: 'Uses an array with a loop', test: (tr, T) => (T.prog.kinds.has('index') && (T.prog.kinds.has('for') || T.prog.kinds.has('while')) ? true : 'Use the leds[] array inside a for loop, like leds[i].') },
        {
          label: 'Red, yellow, green, 250 ms each', scenario: { ms: 2000 },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [
            [125, { red: 1, yellow: 0, green: 0 }], [375, { red: 0, yellow: 1, green: 0 }], [625, { red: 0, yellow: 0, green: 1 }],
            [875, { red: 1, yellow: 0, green: 0 }], [1375, { red: 0, yellow: 0, green: 1 }],
          ]),
        },
      ],
    },
    {
      id: 'commands', title: 'Talk to the board', topic: 'Reading serial input',
      goal: 'Type <b>on</b> or <b>off</b> in the serial monitor to control the <b>green LED</b>. Reply <b>OK</b> after each command.',
      body: '<p>The serial monitor works both ways. <code>Serial.available()</code> tells you how many characters have arrived. When you press Send, your text arrives followed by a new line.</p>' +
        '<pre>String cmd = Serial.readStringUntil(\'\\n\');\ncmd.trim();   // remove spaces and line endings</pre>' +
        '<p>Compare text with <code>==</code>: <code>if (cmd == "on")</code></p>',
      starter: '#define GREEN 27\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(GREEN, OUTPUT);\n  Serial.println("Type on or off");\n}\n\nvoid loop() {\n  if (Serial.available() > 0) {\n    String cmd = Serial.readStringUntil(\'\\n\');\n    cmd.trim();\n    // act on the command and reply OK\n\n  }\n}\n',
      hints: [
        'if (cmd == "on") { digitalWrite(GREEN, HIGH); Serial.println("OK"); }',
        'Add a second if for "off" that writes LOW.',
      ],
      solution: '#define GREEN 27\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(GREEN, OUTPUT);\n  Serial.println("Type on or off");\n}\n\nvoid loop() {\n  if (Serial.available() > 0) {\n    String cmd = Serial.readStringUntil(\'\\n\');\n    cmd.trim();\n    if (cmd == "on") {\n      digitalWrite(GREEN, HIGH);\n      Serial.println("OK");\n    }\n    if (cmd == "off") {\n      digitalWrite(GREEN, LOW);\n      Serial.println("OK");\n    }\n  }\n}\n',
      checks: [
        {
          label: '"on" and "off" control the green LED',
          scenario: { ms: 3000, at: [{ t: 500, send: 'on\n' }, { t: 1500, send: 'off\n' }, { t: 2500, send: 'on\n' }] },
          test: (tr) => noError(tr) !== true ? noError(tr) : states(tr, [[400, { green: 0 }], [1000, { green: 1 }], [2000, { green: 0 }], [2900, { green: 1 }]],
            (t) => (t < 500 ? 'before any command' : t < 1500 ? 'after "on"' : t < 2500 ? 'after "off"' : 'after "on" again')),
        },
        {
          label: 'Replies OK to each command',
          scenario: { ms: 3000, at: [{ t: 500, send: 'on\n' }, { t: 1500, send: 'off\n' }, { t: 2500, send: 'on\n' }] },
          test: (tr) => { const ok = tr.lines.filter((l) => /^ok\b/i.test(l)).length; return ok === 3 ? true : 'Three commands were sent but OK was printed ' + ok + ' time' + (ok === 1 ? '' : 's') + '.'; },
        },
        {
          label: 'Ignores unknown words',
          scenario: { ms: 1500, at: [{ t: 300, send: 'on\n' }, { t: 800, send: 'banana\n' }] },
          test: (tr) => (tr.on('green', 1400) ? true : 'After "on" then an unknown word, the LED should stay on.'),
        },
      ],
    },
  ];

  /** Grade a program. Returns { compileError, results: [{label, ok, msg}], passed }. */
  function grade(lesson, src) {
    let prog;
    try { prog = Sim.compile(src); } catch (e) {
      if (!(e instanceof Sim.SimError)) throw e;
      return { compileError: e, results: lesson.checks.map((c) => ({ label: c.label, ok: false, msg: null })), warnings: [], passed: false };
    }
    const T = { prog };
    const cache = new Map();
    const warnings = new Set();
    const results = lesson.checks.map((c) => {
      let tr = null;
      if (c.scenario) {
        const key = JSON.stringify(c.scenario);
        if (!cache.has(key)) cache.set(key, runScenario(prog, c.scenario));
        tr = cache.get(key);
        for (const w of tr.warnings) warnings.add(w);
      }
      let r;
      try { r = c.test(tr, T); } catch (e) {
        if (!(e instanceof Sim.SimError)) throw e;
        r = 'Line ' + e.line + ': ' + e.message;
      }
      return { label: c.label, ok: r === true, msg: r === true ? null : r };
    });
    return { compileError: null, results, warnings: [...warnings], passed: results.every((r) => r.ok) };
  }

  Sim.LESSONS = LESSONS;
  Sim.grade = grade;
  Sim.runScenario = runScenario;
})(typeof window !== 'undefined' ? window : globalThis);
