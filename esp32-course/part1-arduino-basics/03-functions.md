# Part 1 · Lesson 3: Functions

## Goal

Package a job into a named **function** so you can use it again and again, give it inputs, and get an answer back.

## The idea

A function is a **recipe card**. You write the recipe once, give it a name, and from then on you just say the name.

```text
   return type   name        inputs (parameters)
        |          |              |
      float  celsiusToF  (float celsius)  {
          return celsius * 9.0 / 5.0 + 32.0;     <- the answer handed back
      }
```

- **Parameters** are the ingredients you hand in.
- **`return`** is the finished dish handed back.
- **`void`** means "hands nothing back" (like `setup` and `loop`).

**House rule for this course: write a function *above* the place where you use it.** The Arduino IDE often forgives the wrong order, but other tools (including ESP-IDF in Part 3) do not.

Why bother?

1. **No copy-paste.** Fix a bug in one place.
2. **Readable.** `blink(3, 200);` explains itself.
3. **Testable.** You can try one small piece on its own.

## Wiring

Only the USB cable.

```text
 PC ====USB==== ESP32 DevKit   (on-board LED on GPIO 2)
```

## Code

```cpp
// Lesson 3: writing and calling functions.

const int LED_PIN = 2;

// Takes a temperature in Celsius, hands back Fahrenheit.
float celsiusToF(float celsius) {
  return celsius * 9.0 / 5.0 + 32.0;
}

// Hands back true or false. Good names for these start with "is".
bool isTooHot(float celsius, float limit) {
  return celsius > limit;
}

// Hands nothing back (void); it just does a job.
void blink(int times, int onOffMs) {
  for (int i = 0; i < times; i++) {   // repeat "times" times (loops: next lesson)
    digitalWrite(LED_PIN, HIGH);
    delay(onOffMs);
    digitalWrite(LED_PIN, LOW);
    delay(onOffMs);
  }
}

// A function can call other functions.
void reportTemperature(float celsius) {
  Serial.print(celsius);
  Serial.print(" C = ");
  Serial.print(celsiusToF(celsius));
  Serial.print(" F");
  if (isTooHot(celsius, 40.0)) {
    Serial.println("  TOO HOT!");
    blink(5, 80);                     // fast alarm blink
  } else {
    Serial.println("  ok");
    blink(1, 300);                    // one calm blink
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

float temperature = 30.0;

void loop() {
  reportTemperature(temperature);
  temperature = temperature + 2.5;    // pretend it is heating up
  if (temperature > 50.0) {
    temperature = 30.0;
  }
  delay(1500);
}
```

## What to expect

```text
30.00 C = 86.00 F  ok
32.50 C = 90.50 F  ok
...
42.50 C = 108.50 F  TOO HOT!
```

One slow blink while "ok", five fast blinks while "TOO HOT!".

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Forgetting `return` in a non-void function | Garbage value comes back | Every path through the function must end in `return something;`. |
| `blink;` without brackets | Compiles, does nothing | Calling a function always needs `()`: `blink(3, 200);`. |
| Wrong order of inputs: `blink(200, 3)` | 200 blinks of 3 ms | Inputs are matched by **position**, not by name. |
| Expecting a function to change your variable | The function gets a **copy** of the value | Use the returned value: `x = doubleIt(x);`. |
| Using a variable made inside one function in another | `was not declared in this scope` | Variables live only inside the `{ }` where they are made. Pass them as parameters. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-3)

1. Write `float litresToGallons(float litres)` (1 gallon = 3.785 litres) and print 100 litres in gallons.
2. Write `int largerOf(int a, int b)` that hands back the bigger of two numbers.
3. Write `void sos()` that blinks SOS in Morse code (3 short, 3 long, 3 short) by calling `blink()` three times.
