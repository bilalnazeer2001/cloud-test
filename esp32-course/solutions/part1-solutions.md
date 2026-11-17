# Part 1 solutions

Try each exercise for at least 15 minutes before looking. Your answer does not need to match word for word; if it behaves the same, it is correct.

Short answers show only the lines that change. Longer answers are complete sketches you can upload.

---

## Lesson 1

**1. Fast blink.** Change both delays:

```cpp
// In loop(): replace both delay(500); lines with
delay(100);
```

**2. Heartbeat.**

```cpp
const int LED_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);   // first quick flash
  delay(100);
  digitalWrite(LED_PIN, LOW);
  delay(100);
  digitalWrite(LED_PIN, HIGH);   // second quick flash
  delay(100);
  digitalWrite(LED_PIN, LOW);
  delay(1000);                   // long pause
}
```

**3. Hello moved into loop().** "Hello from ESP32!" now prints on every pass, once per second, instead of once at power-on. That is the whole difference between `setup()` (once) and `loop()` (forever).

---

## Lesson 2

**1. Critical warning.** Add after the report lines, inside `loop()`:

```cpp
if (percent < 5) {
  Serial.println("CRITICAL");
}
```

**2. Value of the water.** Add a global variable and one print:

```cpp
// Above setup():
float costPerLitre = 0.35;

// Inside loop(), after the report:
Serial.print("Value of water left: ");
Serial.println(litres * costPerLitre);
```

**3. Whole-number division.** It prints **0**. `250 / 1000` is whole number ÷ whole number, so the answer is 0 (the remainder is thrown away), and `0 * 100` is still 0. Fixes: multiply first (`250 * 100 / 1000` gives 25), or use a decimal (`250 / 1000.0 * 100`).

---

## Lesson 3

**1 and 2 and 3 together**, as one sketch:

```cpp
const int LED_PIN = 2;

float litresToGallons(float litres) {
  return litres / 3.785;
}

int largerOf(int a, int b) {
  if (a > b) {
    return a;
  }
  return b;
}

void blink(int times, int onOffMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(onOffMs);
    digitalWrite(LED_PIN, LOW);
    delay(onOffMs);
  }
}

void sos() {
  blink(3, 150);   // S: three short
  blink(3, 450);   // O: three long
  blink(3, 150);   // S: three short
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  delay(1000);

  Serial.print("100 litres = ");
  Serial.print(litresToGallons(100.0));   // 26.42
  Serial.println(" gallons");

  Serial.print("Larger of 7 and 12: ");
  Serial.println(largerOf(7, 12));        // 12
}

void loop() {
  sos();
  delay(2000);
}
```

---

## Lesson 4

All three in one sketch:

```cpp
void setup() {
  Serial.begin(115200);
  delay(1000);

  // 1. Seven-times table.
  for (int i = 1; i <= 12; i++) {
    Serial.print("7 x ");
    Serial.print(i);
    Serial.print(" = ");
    Serial.println(7 * i);
  }

  // 2. Even numbers 2..20: start at 2, step by 2.
  for (int i = 2; i <= 20; i += 2) {
    Serial.println(i);
  }

  // 3. Years to double at 8 % growth.
  float amount = 1000.0;
  int years = 0;
  while (amount <= 2000.0) {
    amount = amount * 1.08;
    years++;
  }
  Serial.print("Years to pass 2000: ");
  Serial.println(years);                  // 10
}

void loop() {
}
```

---

## Lesson 5

All three in one sketch:

```cpp
int litresPerDay[] = { 420, 388, 455, 610, 402, 395, 440 };
const int DAY_COUNT = sizeof(litresPerDay) / sizeof(litresPerDay[0]);
const char* DAY_NAMES[] = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };

// 1. Smallest value.
int smallestOf(int values[], int count) {
  int smallest = values[0];               // start by assuming the first is smallest
  for (int i = 1; i < count; i++) {
    if (values[i] < smallest) {
      smallest = values[i];
    }
  }
  return smallest;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.print("Smallest: ");
  Serial.println(smallestOf(litresPerDay, DAY_COUNT));   // 388

  // 2. Count the days above 410.
  int highDays = 0;
  for (int i = 0; i < DAY_COUNT; i++) {
    if (litresPerDay[i] > 410) {
      highDays++;
    }
  }
  Serial.print("Days above 410: ");
  Serial.println(highDays);                              // 4

  // 3. Reverse order: start at the last index, count down to 0.
  for (int i = DAY_COUNT - 1; i >= 0; i--) {
    Serial.print(DAY_NAMES[i]);
    Serial.print(": ");
    Serial.println(litresPerDay[i]);
  }
}

void loop() {
}
```

---

## Lesson 6

**1.** Add the line `{ 12, 0, 6, "Lunch" },` between "Break" and "School over". Nothing else changes, because `EVENT_COUNT` is worked out with `sizeof`. That is exactly why we never type the count by hand.

**2 and 3**, complete sketch:

```cpp
struct BellEvent {
  int hour;
  int minute;
  int ringSeconds;
  const char* label;
  bool enabled;                    // new field
};

BellEvent schedule[] = {
  {  8,  0, 5, "Assembly",    true  },
  {  8, 15, 3, "Period 1",    true  },
  {  9,  0, 3, "Period 2",    false },   // switched off
  { 10, 30, 6, "Break",       true  },
  { 12,  0, 6, "Lunch",       true  },
  { 13, 30, 8, "School over", true  },
};
const int EVENT_COUNT = sizeof(schedule) / sizeof(schedule[0]);

// 3. Add up all ring times.
int totalRingSeconds() {
  int total = 0;
  for (int i = 0; i < EVENT_COUNT; i++) {
    total += schedule[i].ringSeconds;
  }
  return total;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  for (int i = 0; i < EVENT_COUNT; i++) {
    if (!schedule[i].enabled) {
      continue;                    // 2. skip this one, go to the next
    }
    Serial.printf("%02d:%02d  %s\n", schedule[i].hour, schedule[i].minute, schedule[i].label);
  }

  Serial.print("Total ring time: ");
  Serial.println(totalRingSeconds());    // 31
}

void loop() {
}
```

`%02d` in `printf` means "whole number, at least 2 digits, pad with a zero" — a shorter way to print `08`.

---

## Lesson 7

**1. A fourth job.** Add one variable, one function, and one call:

```cpp
// Above setup():
unsigned long lastTickTime = 0;

void updateTick(unsigned long now) {
  if (now - lastTickTime >= 5000) {
    lastTickTime = now;
    Serial.println("tick");
  }
}

// Inside loop(), add:
//   updateTick(now);
```

**2. Short flash (50 ms on, 950 ms off).**

```cpp
const int LED_PIN = 2;
const unsigned long ON_MS = 50;
const unsigned long OFF_MS = 950;

unsigned long lastChangeTime = 0;
bool ledOn = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  unsigned long now = millis();
  // How long to wait depends on the state we are in right now.
  unsigned long interval = ledOn ? ON_MS : OFF_MS;
  if (now - lastChangeTime >= interval) {
    lastChangeTime = now;
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
  }
}
```

**3. Long press.**

```cpp
const int BUTTON_PIN = 27;
const unsigned long LONG_PRESS_MS = 2000;

unsigned long pressStartTime = 0;
bool wasPressed = false;
bool longPressReported = false;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(115200);
}

void loop() {
  unsigned long now = millis();
  bool pressed = (digitalRead(BUTTON_PIN) == LOW);

  if (pressed && !wasPressed) {          // the moment it goes down
    pressStartTime = now;
    longPressReported = false;
  }
  if (pressed && !longPressReported && now - pressStartTime >= LONG_PRESS_MS) {
    Serial.println("Long press");
    longPressReported = true;            // so it prints only once per hold
  }
  wasPressed = pressed;
  delay(10);                             // a tiny delay is a simple debounce
}
```

---

## Lesson 8

**1 and 2.** Add these branches inside `handleCommand()`, before the final `else if (line.length() > 0)`:

```cpp
} else if (line.startsWith("blink ")) {
  int n = line.substring(6).toInt();
  if (n < 1 || n > 20) {
    Serial.println("ERROR: blink count must be 1-20");
  } else {
    for (int i = 0; i < n; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(150);
      digitalWrite(LED_PIN, LOW);
      delay(150);
    }
    Serial.println("OK: blink done");
  }
} else if (line == "status") {
  Serial.printf("uptime=%lu s  brightness=%d %%  led=%s\n",
                millis() / 1000, brightnessPercent,
                digitalRead(LED_PIN) == HIGH ? "on" : "off");
```

(Using `delay()` inside the blink command is acceptable here because it is short and you asked for it. In a real controller you would use the `millis()` pattern.)

**3. Bug hunt.**

```cpp
float averageBroken(int a, int b, int c) {
  int sum = a + b + c;
  Serial.printf("[debug] sum=%d  sum/3=%d\n", sum, sum / 3);   // proves the decimals are gone here
  return sum / 3;                 // whole ÷ whole = whole. The float comes too late.
}

float averageFixed(int a, int b, int c) {
  return (a + b + c) / 3.0;       // 3.0 makes it a decimal division
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(averageBroken(1, 2, 2));   // 1.00  (wrong)
  Serial.println(averageFixed(1, 2, 2));    // 1.67  (right)
}

void loop() {
}
```

The lesson: the return type `float` does not help if the maths *before* the return was done with whole numbers.
