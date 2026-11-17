# Part 1 · Lesson 1: Setup and your first upload

## Goal

Install the Arduino IDE, connect the ESP32, and make the on-board LED blink. After this lesson you know the full loop you will repeat hundreds of times: **write → upload → watch**.

## The idea

- A **sketch** is the Arduino word for a program.
- **Uploading** (also called *flashing*) copies your sketch into the ESP32's memory. It stays there even without power.
- The **Serial Monitor** is a text window where the board can talk back to you over the USB cable. Think of it as the board's notepad.

Every sketch has two parts:

| Part | Runs | Analogy |
|---|---|---|
| `setup()` | Once, at power-on | Opening the shop in the morning |
| `loop()` | Again and again, forever | Serving customers all day |

## One-time installation (needs internet)

1. Download and install **Arduino IDE 2** from arduino.cc.
2. Open **File → Preferences**. In *Additional boards manager URLs* paste:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. Open **Tools → Board → Boards Manager**, search `esp32`, install **esp32 by Espressif Systems**, version **3.x**. (This course is written for version 3. Version 2 uses different names for a few functions.)
4. Plug in the board. If no port appears in **Tools → Port**, install the USB driver for the chip next to the USB socket: **CP210x** (square chip marked "SILABS") or **CH340** (long chip marked "CH340").

## Settings for every lesson

- **Tools → Board:** `ESP32 Dev Module`
- **Tools → Port:** the port that appears when you plug the board in
- **Serial Monitor speed:** `115200 baud` (bottom-right of the Serial Monitor)

## Wiring

Nothing to wire. Only the USB cable.

```text
   PC                     ESP32 DevKit
 +------+   USB cable   +--------------+
 |      |===============| USB      [o] |  <- blue LED (GPIO 2)
 +------+               +--------------+
```

## Code

```cpp
// Lesson 1: blink the on-board LED and say hello.

const int LED_PIN = 2;          // The blue on-board LED is wired to GPIO 2.

void setup() {
  // Runs once at power-on.
  pinMode(LED_PIN, OUTPUT);     // Tell the chip: this pin sends electricity out.
  Serial.begin(115200);         // Open the "notepad" at 115200 baud.
  Serial.println("Hello from ESP32!");
}

void loop() {
  // Runs forever.
  digitalWrite(LED_PIN, HIGH);  // LED on  (HIGH = 3.3 volts)
  Serial.println("LED on");
  delay(500);                   // Wait 500 milliseconds = half a second.

  digitalWrite(LED_PIN, LOW);   // LED off (LOW = 0 volts)
  Serial.println("LED off");
  delay(500);
}
```

Click the **→ (Upload)** button. Then open **Tools → Serial Monitor**.

## What to expect

- The bottom panel shows `Connecting....` then percentages, then `Hard resetting via RTS pin...`. That last line means **success**, not an error.
- The blue LED blinks: half a second on, half a second off.
- The Serial Monitor prints:

```text
Hello from ESP32!
LED on
LED off
LED on
```

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Stuck at `Connecting........` then fails | Board did not enter upload mode | Hold the **BOOT** button on the board when `Connecting...` appears; release when percentages start. |
| No port in the Tools menu | Charge-only cable, or missing driver | Try another cable first. Then install the CP210x / CH340 driver. |
| Serial Monitor shows `⸮⸮x⸮⸮` garbage | Wrong speed | Set the monitor to **115200 baud**. |
| `expected ';' before ...` | Missing semicolon on the line **above** the one shown | Every instruction ends with `;`. |
| `'LED_pin' was not declared` | Spelling or capital letters differ | C++ is case-sensitive: `LED_PIN` ≠ `LED_pin`. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-1)

1. Make the LED blink fast: 100 ms on, 100 ms off.
2. Make a "heartbeat": two quick flashes, then a one-second pause, repeating.
3. Move the line `Serial.println("Hello from ESP32!");` from `setup()` into `loop()`. Predict what changes before you upload. Were you right?
