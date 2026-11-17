# Part 1 · Lesson 6: Structs

## Goal

Group related values into one package with a **struct**, and keep a list of those packages.

## The idea

In Lesson 5 we had two separate arrays, names and readings, that had to stay in step. That is fragile.

A **struct** is a **form with labelled fields**. You design the form once, then fill in as many copies as you like.

```text
 struct BellEvent            <- the blank form
 +---------------------+
 | hour        : int   |
 | minute      : int   |
 | ringSeconds : int   |
 | label       : text  |
 +---------------------+
```

You reach a field with a dot: `event.hour`, `event.label`.

An **array of structs** is a stack of filled-in forms: a timetable, a list of pumps, a list of sensors. This pattern is the backbone of the school-bell and prayer-time projects in Part 4.

## Wiring

Only the USB cable.

```text
 PC ====USB==== ESP32 DevKit   (on-board LED on GPIO 2)
```

## Code

```cpp
// Lesson 6: structs and arrays of structs.

const int LED_PIN = 2;

// Design the form. Note the semicolon after the closing brace.
struct BellEvent {
  int hour;            // 0-23
  int minute;          // 0-59
  int ringSeconds;     // how long the bell rings
  const char* label;   // what this bell is for
};

// A stack of filled-in forms. Each { } is one form, fields in the same order as above.
BellEvent schedule[] = {
  {  8,  0, 5, "Assembly"     },
  {  8, 15, 3, "Period 1"     },
  {  9,  0, 3, "Period 2"     },
  { 10, 30, 6, "Break"        },
  { 13, 30, 8, "School over"  },
};
const int EVENT_COUNT = sizeof(schedule) / sizeof(schedule[0]);

// A struct can be handed to a function like any other value.
void printEvent(BellEvent e) {
  if (e.hour < 10) Serial.print("0");      // print 08 instead of 8
  Serial.print(e.hour);
  Serial.print(":");
  if (e.minute < 10) Serial.print("0");
  Serial.print(e.minute);
  Serial.print("  ");
  Serial.print(e.label);
  Serial.print("  (");
  Serial.print(e.ringSeconds);
  Serial.println(" s)");
}

// Turn "hours and minutes" into one number so times are easy to compare.
int minutesSinceMidnight(int hour, int minute) {
  return hour * 60 + minute;
}

// Hands back the index of the next event after the given time, or -1 if none is left today.
int nextEventIndex(int hour, int minute) {
  int now = minutesSinceMidnight(hour, minute);
  for (int i = 0; i < EVENT_COUNT; i++) {
    if (minutesSinceMidnight(schedule[i].hour, schedule[i].minute) > now) {
      return i;
    }
  }
  return -1;
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  delay(1000);

  Serial.println("Today's bells:");
  for (int i = 0; i < EVENT_COUNT; i++) {
    printEvent(schedule[i]);
  }

  // Change one field of one form.
  schedule[3].ringSeconds = 10;
  Serial.println("Break bell made longer:");
  printEvent(schedule[3]);

  // Ask a question of the timetable.
  int next = nextEventIndex(9, 20);
  Serial.print("At 09:20 the next bell is: ");
  if (next >= 0) {
    printEvent(schedule[next]);
  } else {
    Serial.println("none today");
  }
}

void loop() {
  // Flash the LED once for each second of each bell, as a preview.
  for (int i = 0; i < EVENT_COUNT; i++) {
    for (int s = 0; s < schedule[i].ringSeconds; s++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
    delay(1500);
  }
}
```

## What to expect

```text
Today's bells:
08:00  Assembly  (5 s)
08:15  Period 1  (3 s)
09:00  Period 2  (3 s)
10:30  Break  (6 s)
13:30  School over  (8 s)
Break bell made longer:
10:30  Break  (10 s)
At 09:20 the next bell is: 10:30  Break  (10 s)
```

The LED flashes in groups of 5, 3, 3, 10, 8.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| No `;` after the struct's closing `}` | A confusing error on the *next* line | `struct Name { ... };` always ends with a semicolon. |
| Values in the wrong order inside `{ }` | Hour and minute swapped, no error shown | Order must match the order of the fields in the struct. |
| Declaring the struct *below* the function that uses it | `'BellEvent' was not declared` | Put struct definitions near the top of the file. |
| Comparing times with `hour > h && minute > m` | 10:05 is wrongly "not after" 09:30 | Convert to minutes since midnight, then compare one number. |
| Changing a struct inside a function and expecting the original to change | The function got a copy | Change it through the array: `schedule[i].field = ...`. |

## Exercises

Answers: [solutions/part1-solutions.md](../solutions/part1-solutions.md#lesson-6)

1. Add a sixth bell, "Lunch" at 12:00 for 6 seconds, **in the correct time order**. Does the rest of the program need any change?
2. Add a field `bool enabled` to the struct, set "Period 2" to disabled, and make the print loop skip disabled bells.
3. Write `int totalRingSeconds()` that adds up the ring time of all bells in the schedule.
