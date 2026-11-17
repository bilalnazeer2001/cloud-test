# ESP32 Practice Bench

A browser-based ESP32 simulator for learners. Open `index.html` in any modern browser — no install, no internet needed (fonts fall back if offline).

## What's in it
- **Virtual board** with fixed wiring:

  | Part | Pin |
  |---|---|
  | On-board LED | GPIO 2 |
  | Red / yellow / green LED | GPIO 25 / 26 / 27 |
  | Button A / Button B (to GND, use `INPUT_PULLUP`) | GPIO 18 / 4 |
  | Potentiometer (0–4095) | GPIO 34 |
  | Buzzer | GPIO 23 |

- **Editor** for simplified Arduino code: `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `analogWrite`, `delay`, `millis`, `tone`/`noTone`, `map`, `Serial.begin/print/println/read...`, variables, `if`, `for`, `while`, `switch`, functions, arrays, `String`, `#define`.
- **Serial monitor** that works both ways (send text to the board).
- **20 guided lessons**, each with automatic checks, step-by-step hints and an answer as a last resort.
- **Progress** (finished lessons, your code, hints) is saved in the browser on this device.

## Files
- `js/interpreter.js` — reads and runs the learner's code (time is simulated, so `delay()` never freezes the page).
- `js/board.js` — the virtual board and its parts.
- `js/lessons.js` — the 20 lessons and the checker.
- `js/app.js`, `css/style.css`, `index.html` — the page.

## Tests
```
node tests/lessons.test.js    # every answer passes, every starter fails
node tests/mistakes.test.js   # common mistakes give clear messages
```

## Limits
It is a learning tool, not an exact ESP32 emulator: no Wi-Fi, no pointers or classes, and timing is approximate (each line takes about 20 µs).
