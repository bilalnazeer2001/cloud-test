# Part 1 · Lesson 5: Arrays

## Goal

Keep a **list** of values under one name, and walk through the list with a loop.

## The idea

An array is a **row of numbered lockers**. All lockers hold the same type of thing. The numbers start at **0**.

```text
 int readings[5] = { 12, 15, 11, 19, 14 };

 locker number (index):   [0]  [1]  [2]  [3]  [4]
 contents:                 12   15   11   19   14
```

- `readings[0]` is the first item (12).
- `readings[4]` is the last item (14).
- `readings[5]` **does not exist**. C++ will not stop you from touching it. You will read rubbish or damage another variable. This is the single most common cause of "my program does random things".

**Counting the items automatically:**

```cpp
const int COUNT = sizeof(readings) / sizeof(readings[0]);
```

Read it as "size of the whole row ÷ size of one locker". Use this instead of typing `5`, so adding an item never breaks your loops.

**Text is an array too.** `char name[] = "Pump";` is 5 lockers: `P` `u` `m` `p` and a hidden end marker `\0`.

## Wiring

Only the USB cable.

```text
 PC ====USB==== ESP32 DevKit   (on-board LED on GPIO 2)
```

## Code

```cpp
// Lesson 5: arrays and loops together.

const int LED_PIN = 2;

// Seven daily water-meter readings, in litres.
int litresPerDay[] = { 420, 388, 455, 610, 402, 395, 440 };
const int DAY_COUNT = sizeof(litresPerDay) / sizeof(litresPerDay[0]);

// An array of text labels, same order as the readings.
const char* DAY_NAMES[] = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };

// A blink pattern: on-time, off-time, on-time, off-time... in milliseconds.
const int PATTERN_MS[] = { 100, 100, 100, 100, 600, 400 };
const int PATTERN_COUNT = sizeof(PATTERN_MS) / sizeof(PATTERN_MS[0]);

// Arrays are handed to functions together with their length.
int totalOf(int values[], int count) {
  int total = 0;
  for (int i = 0; i < count; i++) {
    total += values[i];
  }
  return total;
}

// Hands back the INDEX (locker number) of the biggest value.
int indexOfLargest(int values[], int count) {
  int best = 0;
  for (int i = 1; i < count; i++) {
    if (values[i] > values[best]) {
      best = i;
    }
  }
  return best;
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  delay(1000);

  for (int i = 0; i < DAY_COUNT; i++) {
    Serial.print(DAY_NAMES[i]);
    Serial.print(": ");
    Serial.println(litresPerDay[i]);
  }

  int total = totalOf(litresPerDay, DAY_COUNT);
  Serial.print("Total: ");
  Serial.println(total);
  Serial.print("Average: ");
  Serial.println((float)total / DAY_COUNT);   // (float) so we keep the decimals

  int peak = indexOfLargest(litresPerDay, DAY_COUNT);
  Serial.print("Highest day: ");
  Serial.print(DAY_NAMES[peak]);
  Serial.print(" with ");
  Serial.println(litresPerDay[peak]);

  litresPerDay[3] = 400;                      // you can change one locker
  Serial.print("Thu corrected to ");
  Serial.println(litresPerDay[3]);
}

void loop() {
  // Play the blink pattern: even positions = LED on, odd positions = LED off.
  for (int i = 0; i < PATTERN_COUNT; i++) {
    digitalWrite(LED_PIN, (i % 2 == 0) ? HIGH : LOW);
    delay(PATTERN_MS[i]);
  }
}
```

## What to expect

```text
Mon: 420
Tue: 388
Wed: 455
Thu: 610
Fri: 402
Sat: 395
Sun: 440
Total: 3110
Average: 444.29
Highest day: Thu with 610
Thu corrected to 400
```

The LED plays "short, short, long" on repeat.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| `for (int i = 0; i <= COUNT; i++)` | Reads one locker past the end: rubbish value or a crash | Use `<`, never `<=`, with the count. |
| `readings[5]` on a 5-item array | Same problem | Last valid index is always `count - 1`. |
| Using `sizeof(values)` **inside** a function that received the array | Gives the wrong number (size of an address, not the list) | Work out the count where the array is declared and pass it in. |
| `if (name == "Pump")` with `char` arrays | Compares memory addresses, not letters | Use `strcmp(name, "Pump") == 0`, or use `String`. |
| Changing the list of names but not the list of values | The two lists go out of step | Next lesson: structs keep related things together. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-5)

1. Write `int smallestOf(int values[], int count)` that hands back the smallest **value** and print it for `litresPerDay`.
2. Count and print how many days used more than 410 litres.
3. Print the days in reverse order, Sunday first.
