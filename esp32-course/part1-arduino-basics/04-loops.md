# Part 1 · Lesson 4: Loops

## Goal

Repeat a block of code a set number of times (`for`) or until something changes (`while`).

## The idea

`loop()` already repeats forever. But often you want to repeat something *inside* one pass: blink 5 times, add up 10 readings, wait until a button is pressed.

**`for` — "do this N times"**

```text
 for (int i = 0;  i < 5;  i++) { ... }
        |          |       |
     start at 0    |    add 1 after each pass
              keep going while this is true
```

`i` counts 0, 1, 2, 3, 4 — five passes. Programmers count from 0. Get used to it now; arrays (next lesson) depend on it.

**`while` — "keep doing this as long as..."**

```cpp
while (digitalRead(BUTTON_PIN) == HIGH) {
  // keeps repeating until the button is pressed
}
```

Two extra words:

- `break;` — leave the loop right now.
- `continue;` — skip the rest of this pass, go to the next one.

## Wiring

Only the USB cable.

```text
 PC ====USB==== ESP32 DevKit   (on-board LED on GPIO 2)
```

## Code

```cpp
// Lesson 4: for and while loops.

const int LED_PIN = 2;

void blink(int times, int onOffMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(onOffMs);
    digitalWrite(LED_PIN, LOW);
    delay(onOffMs);
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  delay(1000);                       // give the Serial Monitor a moment to open

  // 1) Count up.
  Serial.println("Counting up:");
  for (int i = 1; i <= 5; i++) {
    Serial.println(i);
  }

  // 2) Count down in steps of 2.
  Serial.println("Countdown:");
  for (int i = 10; i >= 0; i = i - 2) {
    Serial.println(i);
  }

  // 3) Add up the numbers 1 to 100.
  int total = 0;
  for (int i = 1; i <= 100; i++) {
    total = total + i;               // short form: total += i;
  }
  Serial.print("Sum of 1..100 = ");
  Serial.println(total);

  // 4) while: keep halving until the number is small.
  int value = 1000;
  int steps = 0;
  while (value > 10) {
    value = value / 2;
    steps++;
  }
  Serial.print("Halved ");
  Serial.print(steps);
  Serial.print(" times, ended at ");
  Serial.println(value);

  // 5) break: stop at the first number divisible by 7.
  for (int i = 50; i < 100; i++) {
    if (i % 7 == 0) {                // % gives the remainder of a division
      Serial.print("First multiple of 7 after 50: ");
      Serial.println(i);
      break;
    }
  }
}

int round_number = 1;

void loop() {
  // Blink once, then twice, then three times... up to 5, then start again.
  blink(round_number, 150);
  delay(1000);
  round_number++;
  if (round_number > 5) {
    round_number = 1;
  }
}
```

## What to expect

```text
Counting up:
1
2
3
4
5
Countdown:
10
8
6
4
2
0
Sum of 1..100 = 5050
Halved 7 times, ended at 7
First multiple of 7 after 50: 56
```

Then the LED blinks 1, 2, 3, 4, 5 times with a pause between groups, and repeats.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| `for (int i = 0; i <= 5; i++)` when you want 5 passes | 6 passes (0,1,2,3,4,5) — the "off-by-one" error | Start at 0 and use `<`. |
| `while (x > 10) { }` where `x` never changes | Program freezes there forever | Something inside the loop must move toward the exit. |
| `for (...);` with a semicolon before `{` | The loop runs with an empty body; the block runs once | No semicolon after the `)`. |
| A long `while` loop that waits for something | The ESP32 watchdog may reset the board | Put `delay(10);` inside waiting loops. |
| Using `i` after the loop ends | `was not declared in this scope` | `i` only exists inside the loop. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-4)

1. Print the 7-times table from 7 × 1 to 7 × 12, one line each, like `7 x 3 = 21`.
2. Print only the even numbers from 2 to 20 using a `for` loop.
3. Using a `while` loop, find how many years it takes for 1000 to grow past 2000 at 8 % growth per year.
