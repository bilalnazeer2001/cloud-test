# Part 1 · Lesson 7: Timing with millis()

## Goal

Do several things "at the same time" by replacing `delay()` with `millis()`. This is the most important habit in the whole course.

## The idea

`delay(1000)` means **"stand still and do nothing for one second."** During that second the board cannot read a button, check a sensor, or answer a message. A pump controller that is blind for seconds at a time is dangerous.

`millis()` hands back **how many milliseconds have passed since power-on**. It is a wall clock.

| With `delay()` | With `millis()` |
|---|---|
| A cook who stares at the oven until the cake is done | A cook who glances at the clock, then keeps chopping |

The pattern, which you will reuse forever:

```text
 if (now - lastTime >= INTERVAL) {    "has enough time passed?"
     lastTime = now;                   "note when I did it"
     ...do the job...
 }
```

Three rules:

1. Time variables are always `unsigned long`.
2. Always write it as **`now - lastTime >= INTERVAL`** (subtraction). The `millis()` counter restarts from zero after about 49 days; this form keeps working across the restart, other forms do not.
3. `loop()` must run fast. No long `delay()` anywhere.

## Wiring

Add one push button between **GPIO 27** and **GND**. No resistor needed: we switch on the chip's built-in pull-up resistor, so the pin reads `HIGH` normally and `LOW` when pressed.

```text
        ESP32 DevKit
      +--------------+
      |          G27 |-----+
      |              |     |
      |              |   [button]
      |              |     |
      |          GND |-----+
      |              |
      |  (LED on G2) |
      +--------------+
```

## Code

Three jobs run side by side: a heartbeat blink, a status line every 2 seconds, and a button that is checked thousands of times per second.

```cpp
// Lesson 7: doing several things at once with millis().

const int LED_PIN = 2;
const int BUTTON_PIN = 27;

const unsigned long BLINK_INTERVAL_MS = 300;
const unsigned long REPORT_INTERVAL_MS = 2000;
const unsigned long DEBOUNCE_MS = 50;

unsigned long lastBlinkTime = 0;
unsigned long lastReportTime = 0;
unsigned long lastButtonChangeTime = 0;

bool ledOn = false;
bool blinkingEnabled = true;
bool lastButtonPressed = false;
int pressCount = 0;

// Job 1: toggle the LED every BLINK_INTERVAL_MS.
void updateBlink(unsigned long now) {
  if (now - lastBlinkTime >= BLINK_INTERVAL_MS) {
    lastBlinkTime = now;
    if (blinkingEnabled) {
      ledOn = !ledOn;                    // ! means "the opposite of"
    } else {
      ledOn = false;
    }
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
  }
}

// Job 2: print a status line every REPORT_INTERVAL_MS.
void updateReport(unsigned long now) {
  if (now - lastReportTime >= REPORT_INTERVAL_MS) {
    lastReportTime = now;
    Serial.print("Uptime ");
    Serial.print(now / 1000);
    Serial.print(" s, button presses: ");
    Serial.print(pressCount);
    Serial.print(", blinking: ");
    Serial.println(blinkingEnabled ? "on" : "off");
  }
}

// Job 3: notice the moment the button goes from "not pressed" to "pressed".
void updateButton(unsigned long now) {
  bool pressed = (digitalRead(BUTTON_PIN) == LOW);   // LOW = pressed (pull-up wiring)

  // A mechanical button "bounces" for a few ms. Ignore changes that come too quickly.
  if (pressed != lastButtonPressed && now - lastButtonChangeTime >= DEBOUNCE_MS) {
    lastButtonChangeTime = now;
    lastButtonPressed = pressed;
    if (pressed) {
      pressCount++;
      blinkingEnabled = !blinkingEnabled;
      Serial.println("Button pressed");
    }
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(115200);
}

void loop() {
  unsigned long now = millis();   // read the clock once per pass
  updateBlink(now);
  updateReport(now);
  updateButton(now);
  // No delay() here. loop() runs thousands of times per second.
}
```

## What to expect

- The LED blinks steadily.
- Every 2 seconds: `Uptime 4 s, button presses: 0, blinking: on`.
- Press the button: `Button pressed` appears **instantly**, the blinking stops. Press again: it resumes.
- Compare with Lesson 1, where a button press during `delay(500)` would have been missed.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| `int lastTime` instead of `unsigned long` | Works for 24 days, then breaks | Always `unsigned long` for time. |
| `if (now >= lastTime + INTERVAL)` | Breaks when the counter restarts (≈49 days) | `if (now - lastTime >= INTERVAL)`. |
| Forgetting `lastTime = now;` | The job runs on every pass | Note the time each time the job runs. |
| One leftover `delay(1000)` somewhere | Everything else becomes sluggish | Search the sketch for `delay(`. Short ones (≤10 ms) are fine. |
| `INPUT` instead of `INPUT_PULLUP` | Pin "floats"; random presses appear | Use `INPUT_PULLUP` with a button to GND. |
| One press counts as several | Contact bounce | Keep the debounce check. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-7)

1. Add a fourth job that prints `"tick"` every 5 seconds, without changing the other three.
2. Make the LED do a short flash: on for 50 ms, off for 950 ms. (Hint: the interval changes depending on whether the LED is currently on.)
3. Detect a **long press**: if the button is held for more than 2 seconds, print `"Long press"` once.
