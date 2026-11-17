# Part 1 · Lesson 2: Variables and decisions

## Goal

Store numbers and text in **variables**, do maths with them, and make the program choose between two paths with `if` / `else`.

## The idea

A **variable** is a labelled box. The label is its name, the contents can change, and the **type** says what kind of thing fits in the box.

| Type | Holds | Example | Size of box |
|---|---|---|---|
| `int` | Whole numbers, about ±2 billion | `int count = 12;` | 4 bytes |
| `float` | Numbers with a decimal point | `float volts = 3.3;` | 4 bytes |
| `bool` | `true` or `false` only | `bool pumpOn = false;` | 1 byte |
| `char` | One single character | `char grade = 'A';` | 1 byte |
| `unsigned long` | Big whole numbers, never negative | `unsigned long ms = 0;` | 4 bytes |
| `String` | Text | `String name = "Tank 1";` | varies |

Put `const` in front and the box is **sealed**: the value can never change. Use it for pin numbers and fixed settings.

**Decisions** use `if`:

```cpp
if (level < 20) {
  // runs only when level is less than 20
} else {
  // runs otherwise
}
```

Comparison signs: `<` `>` `<=` `>=` `==` (equal) `!=` (not equal). Combine with `&&` (and), `||` (or).

> **The most famous beginner trap:** `=` *puts a value in the box*. `==` *asks if two things are equal*. `if (x = 5)` is wrong; `if (x == 5)` is right.

## Wiring

Only the USB cable, as in Lesson 1.

```text
 PC ====USB==== ESP32 DevKit   (on-board LED on GPIO 2)
```

## Code

A pretend water tank that drains by 7 litres every second. The LED turns on as a "low level" warning.

```cpp
// Lesson 2: variables, maths and if/else.

const int LED_PIN = 2;
const float TANK_CAPACITY_L = 1000.0;  // const = this never changes
const int LOW_LEVEL_PERCENT = 20;      // warn below this

float litres = 250.0;                  // changes while the program runs
int secondsRunning = 0;
bool warningOn = false;
String tankName = "Roof tank";

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  // --- Maths ---
  litres = litres - 7.0;               // drain 7 litres
  if (litres < 0) {
    litres = TANK_CAPACITY_L;          // pretend someone refilled it
    Serial.println("--- refilled ---");
  }
  int percent = (int)(litres / TANK_CAPACITY_L * 100.0);  // (int) chops off the decimals
  secondsRunning = secondsRunning + 1;

  // --- Decision ---
  if (percent < LOW_LEVEL_PERCENT) {
    warningOn = true;
  } else {
    warningOn = false;
  }
  digitalWrite(LED_PIN, warningOn ? HIGH : LOW);  // short form of if/else: condition ? yes : no

  // --- Report ---
  Serial.print(tankName);
  Serial.print(": ");
  Serial.print(litres);                // floats print with 2 decimals
  Serial.print(" L = ");
  Serial.print(percent);
  Serial.print(" %  after ");
  Serial.print(secondsRunning);
  Serial.println(" s");

  delay(1000);
}
```

## What to expect

```text
Roof tank: 243.00 L = 24 %  after 1 s
Roof tank: 236.00 L = 23 %  after 2 s
...
Roof tank: 194.00 L = 19 %  after 8 s      <- LED turns on here
...
--- refilled ---
Roof tank: 1000.00 L = 100 %  after 36 s   <- LED turns off
```

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| `if (percent = 20)` | Always true, and it *overwrites* percent with 20 | Use `==` to compare. |
| `int percent = 7 / 2;` | Gives `3`, not `3.5`. Whole number ÷ whole number drops the remainder. | Make one side a decimal: `7 / 2.0`. |
| Declaring a variable inside `loop()` and expecting it to remember | It is created fresh on every pass | Declare it **above** `setup()` (a *global* variable) if it must remember. |
| Storing 3 000 000 000 in an `int` | Wraps around to a negative number (*overflow*) | Use `unsigned long` for big counts and for time. |
| `float` for money or exact counts | Tiny rounding errors (0.1 + 0.2 ≠ 0.3 exactly) | Count in whole units with `int` (e.g. paisa, millilitres). |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-2)

1. Add a second warning: print `"CRITICAL"` when the level is below 5 %.
2. Add a variable `float costPerLitre = 0.35;` and print the value of the water left in the tank.
3. Change `int percent = (int)(litres / TANK_CAPACITY_L * 100.0);` to use the whole numbers `250 / 1000 * 100`. What prints, and why?
