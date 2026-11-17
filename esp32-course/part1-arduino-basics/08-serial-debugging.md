# Part 1 · Lesson 8: Serial debugging

## Goal

Use the Serial Monitor as your main tool for finding bugs, and send **commands** from the PC to the board.

## The idea

You cannot see inside a running chip. `Serial.print` is your **window**: the program tells you what it is doing and what it believes.

The debugging method, every time:

1. **Say what you expect.** "After the button press, `level` should be 3."
2. **Print what actually is.** Print the value, with a label.
3. **Find the first place where the two differ.** The bug is just before that point.

Good print lines have a **label** and the **value**:

```text
 bad:   42
 good:  [pump] level=42 %  state=ON
```

Useful tools:

| Tool | What it does |
|---|---|
| `Serial.print(x)` / `println(x)` | Print without / with a new line |
| `Serial.printf("level=%d temp=%.1f\n", a, b)` | Print several values in one line. `%d` whole number, `%.1f` decimal with 1 place, `%s` text, `%lu` unsigned long |
| `Serial.available()` | How many characters are waiting from the PC |
| `Serial.readStringUntil('\n')` | Read one typed line |
| **Tools → Serial Plotter** | Draws a live graph of printed numbers |

## Wiring

Only the USB cable (the button on GPIO 27 from Lesson 7 can stay).

```text
 PC ====USB==== ESP32 DevKit   (on-board LED on GPIO 2)
   keyboard --> Serial --> board
   screen   <-- Serial <-- board
```

## Code

A small command console. Type a command in the Serial Monitor input box and press Enter. (Set the line-ending dropdown to **New Line**.)

```cpp
// Lesson 8: debug prints and serial commands.

const int LED_PIN = 2;

// A switch for debug messages. Change to false to silence them all at once.
const bool DEBUG = true;

int brightnessPercent = 50;      // a made-up setting we can change by command
unsigned long lastReportTime = 0;
bool reporting = false;

// Print only when DEBUG is true.
void debugLog(const char* label, long value) {
  if (DEBUG) {
    Serial.printf("[debug] %s = %ld\n", label, value);
  }
}

void printHelp() {
  Serial.println("Commands:");
  Serial.println("  on          LED on");
  Serial.println("  off         LED off");
  Serial.println("  set <n>     set brightness percent, 0-100");
  Serial.println("  report      start/stop a report every second");
  Serial.println("  help        show this list");
}

// Decide what to do with one line of typed text.
void handleCommand(String line) {
  line.trim();                   // remove spaces and the invisible end-of-line characters
  line.toLowerCase();
  debugLog("command length", line.length());

  if (line == "on") {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("OK: LED on");
  } else if (line == "off") {
    digitalWrite(LED_PIN, LOW);
    Serial.println("OK: LED off");
  } else if (line.startsWith("set ")) {
    int value = line.substring(4).toInt();   // the text after "set "
    debugLog("parsed value", value);
    if (value < 0 || value > 100) {
      Serial.println("ERROR: value must be 0-100");
    } else {
      brightnessPercent = value;
      Serial.printf("OK: brightness = %d %%\n", brightnessPercent);
    }
  } else if (line == "report") {
    reporting = !reporting;
    Serial.println(reporting ? "OK: reporting on" : "OK: reporting off");
  } else if (line == "help") {
    printHelp();
  } else if (line.length() > 0) {
    Serial.print("ERROR: unknown command: ");
    Serial.println(line);
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("=== Lesson 8 console ===");
  printHelp();
}

void loop() {
  // Has a full line arrived from the PC?
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    handleCommand(line);
  }

  // Optional once-per-second report, using the millis() pattern.
  unsigned long now = millis();
  if (reporting && now - lastReportTime >= 1000) {
    lastReportTime = now;
    Serial.printf("uptime=%lu s  brightness=%d %%  free memory=%lu bytes\n",
                  now / 1000, brightnessPercent, (unsigned long)ESP.getFreeHeap());
  }
}
```

## What to expect

```text
=== Lesson 8 console ===
Commands:
  on          LED on
  ...
```

Type `on` → `[debug] command length = 2` then `OK: LED on`, and the LED lights.
Type `set 75` → `OK: brightness = 75 %`.
Type `set 500` → `ERROR: value must be 0-100`.
Type `report` → one status line per second until you type `report` again.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Monitor baud ≠ `Serial.begin` baud | Garbage characters | Both 115200. |
| Line ending set to "No Line Ending" | Commands react only after a 1-second timeout | Choose **New Line**. |
| Comparing without `trim()` | `"on\r"` is not equal to `"on"`, command "unknown" | Always `trim()` typed text. |
| `%d` used for an `unsigned long` in `printf` | Wrong numbers or a compiler warning | `%lu` for `unsigned long`, `%d` for `int`, `%f` for `float`. |
| Printing inside a very fast loop | Thousands of lines per second, board slows down | Print on a timer (`millis()`), or only when a value changes. |
| First lines after reset are missing | Monitor was not open yet | `delay(1000)` after `Serial.begin`, or press the board's **EN** button to restart. |
| Serial Monitor open in another window | Upload fails: "port busy" | Only one program can use the port at a time. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-8)

1. Add a command `blink <n>` that blinks the LED *n* times (limit *n* to 1–20).
2. Add a command `status` that prints the uptime, the brightness setting, and whether the LED is on.
3. **Bug hunt.** This function should hand back the average of three readings but always gives a whole number. Add one debug print to prove where the decimals are lost, then fix it:
   `float average(int a, int b, int c) { return (a + b + c) / 3; }`
