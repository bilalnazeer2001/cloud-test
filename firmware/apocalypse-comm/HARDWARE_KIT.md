# Emergency Kit Build Guide

The goal: a **handheld communicator** that lives in a **first-aid-box sized kit** (about 20 x 13 x 7 cm)
together with everything needed to keep it powered: battery, solar, hand crank, AA backup and heat.

> Numbers marked *(est.)* are estimates. Measure your own build with a USB power meter
> (see "Test plan" at the end). Check your local radio laws before using LoRa.

---

## 1. The handheld unit

About **95 x 55 x 28 mm** (a 3D-printed or small project-box case), holding:

| Part | Suggested module | Size |
|---|---|---|
| Brain + Wi-Fi + LoRa | **Seeed XIAO ESP32S3 & Wio-SX1262 kit** (the LoRa board plugs onto the XIAO) | ~21 x 18 mm stack |
| Screen | 0.96" SSD1306 OLED, bare module (smaller than the Grove version) | 27 x 27 mm |
| Navigation | **5-way navigation switch** (up/down/left/right/press = OK) | ~10 x 10 mm |
| BACK + MORSE | 6 x 6 mm tactile buttons (a bigger 12 x 12 mm one for MORSE is nicer to key) | |
| Speaker | MAX98357A amp + 20 x 30 mm 8-ohm speaker | |
| Microphone | INMP441 module | 14 mm round |
| Battery | 1x protected 18650 Li-ion, 3000-3500 mAh | 18 x 68 mm |
| Antennas | two U.FL-to-SMA pigtails to sockets on the top edge | |
| Flashlight | white LED + its own switch, wired straight to the battery (works even if the ESP32 is dead) | |
| Power switch | slide switch in the battery line, **OFF for storage** | |

Use **RP-SMA for 2.4 GHz** and **SMA for LoRa**, so the antennas can't be swapped by mistake.

**Don't use the XIAO "Sense" camera board here.** It plugs into the same small connector as the Wio-SX1262 LoRa board, so you can't fit both.

### XIAO wiring (this is the firmware's default "XIAO" setting)

| XIAO pin | GPIO | Goes to |
|---|---|---|
| D0 | 1 | **All buttons** (resistor ladder, see below) |
| D1 | 2 | Battery voltage: middle of 100k + 100k from battery + to GND |
| D2 | 3 | Mic SD |
| D3 | 4 | Amp BCLK **and** mic SCK (shared wire) |
| D4 | 5 | OLED SDA |
| D5 | 6 | OLED SCL |
| D6 | 43 | Amp LRC **and** mic WS (shared wire) |
| D7 | 44 | Amp DIN |
| D8-D10 + small connector | 7-9, 38-42 | Wio-SX1262 (just plug it on) |
| built-in LED | 21 | status / signal light |
| 3V3 | | OLED VCC, mic VDD, ladder 10k pull-up |
| BAT+ pad | | Amp VIN (louder), battery + after switch |
| GND | | everything's GND, mic L/R pin |

### Button ladder (7 buttons on one pin)

A 10k resistor goes from D0 to 3V3. Each button connects D0 to GND **through its own resistor**:

| Button | Resistor to GND |
|---|---|
| OK (centre of 5-way) | 0 ohm (wire) |
| UP | 1k |
| DOWN | 2.2k |
| LEFT | 3.9k |
| RIGHT | 6.8k |
| BACK | 12k |
| MORSE | 22k |

I simulated 160,000 random presses using cheap 5% resistors and ±40 mV ADC error: every press was read correctly.

---

## 2. Power: 1 main + 3 backup sources

```
 Solar panel 6V ──► CN3791 MPPT charger ──────┐
                                              ├──► 18650 (protected) ──► switch ──► XIAO BAT pads
 Any 5V USB (crank / heat / car / powerbank)  │
          ──► USB-C TP4056 charger (with      ┘
              protection)
 3x AA lithium ──► Schottky diode (1N5817) ──► XIAO 5V pin   (emergency bypass, no charging needed)
```

### Main: 18650 Li-ion battery
- 3000-3500 mAh, about 11-12 Wh, about the size of a finger. Buy a **protected** cell from a good brand.
- For the kit: store it at **50-60% charge** with the switch OFF, and top it up every 6 months.
- Don't use LiFePO4 cells with these chargers. They need a different charge voltage.

### Backup 1: Solar (best size-to-power)
- A **6 V, 1.5-2 W monocrystalline panel** (about 110 x 135 mm) glued to the box lid, so it charges while the box sits in the sun.
- Use a **CN3791 MPPT charger** board (set for a 6 V panel). It gets noticeably more from a small panel than a plain TP4056.
- About 1.5 W x 4 hours of good sun x 70% ≈ **4 Wh/day** *(est.)*. That's enough to run the unit all day in power-saver mode.

### Backup 2: Hand crank
- A small **USB hand-crank generator** (5 V out). Plug it into the USB-C charger.
- It works at night and in rain. This is the most reliable backup.

### Backup 3: AA batteries (works with no charging at all)
- A 3xAA holder with **lithium AA cells** (Energizer says about 20 years of shelf life). Alkaline AA also work.
- In a real emergency you can take AAs from remotes, toys or radios.

### Heat power: Stirling / steam / TEG, my honest advice
- **Stirling and steam engines:** small ones make only milliwatts, are fragile and won't fit the box. They're a fun project, not a survival tool.
- **Thermoelectric generator (TEG): do this instead.** It is a 40 x 40 mm SP1848-27145 module between a metal cup of water (cold side) and a candle or campfire (hot side), feeding a low-voltage step-up converter (to 5 V USB).
  - Expect roughly a few hundred mW from one module *(est.)*. That's a slow trickle charge, but it works at night and in winter. Two modules in series work better.
  - Keep the cold side cool (water). With no cooling, the power drops to almost nothing.

### How long will it run? *(est. — measure yours)*

| Mode | Current | 3000 mAh battery lasts |
|---|---|---|
| Normal (Wi-Fi radio listening) | ~100 mA | ~1-1.5 days |
| **Power saver** (Wi-Fi off, LoRa listening, screen off) | ~30-40 mA | ~3-4 days |
| Switched OFF in storage | 0 | years (battery self-discharge only) |

Power saver is in **Settings → Power saver**. It's new in this version.

---

## 3. Antennas

| Band | Carry antenna | Range antenna |
|---|---|---|
| LoRa 868/915 MHz | short stubby (~5 cm) | ½-wave flexible whip (~16-17 cm) |
| 2.4 GHz (Wi-Fi/ESP-NOW) | 2-3 dBi rubber duck (~10 cm) | small directional patch for point-to-point |

- **Height beats antenna gain.** Pack a 5 m cord and a clip so you can hang the unit in a tree or from a window.
- **Never transmit LoRa without an antenna fitted.** It can damage the radio chip.
- The Wio-SX1262 covers **862-930 MHz only**. If your country uses 433 MHz, use an SX1276/Ra-02 module instead (the firmware supports it).

---

## 4. The kit box

A waterproof (IP67) hard case, about **20 x 13 x 7 cm**, with foam cut-outs:

- **Lid:** solar panel (outside), laminated quick-reference card (inside)
- **Main layer:** handheld unit, hand-crank generator, 3xAA holder + spare lithium AAs
- **Small pockets:** whip antennas, TEG + step-up board, USB-C cable, 5 m cord + clip, pencil, silica-gel bag

### Quick-reference card (print, laminate, keep in the lid)
```
POWER: slide switch ON. Wait for 2 beeps.
NAV:   5-way = move / press OK.  BACK = back.  Hold OK = done typing.
SOS:   Main menu > SOS beacon > hold BACK to stop.
NO SCREEN? Device reads menus in Morse. Each button clicks a different pitch.
CHANNEL: all units on the SAME channel (Radio menu). Ours: ___
CHECK-IN TIME: every ___ hours at :00
CHARGE: sun on lid / crank into USB-C / AA pack into 5V
MORSE: A .-  E .  I ..  O ---  S ...  T -  N -.  SOS ...---...
```

---

## 5. What the firmware now does when parts are missing

| Missing part | What happens |
|---|---|
| Screen | Runs "speaker-only": every button clicks a different pitch, and menus, numbers, messages and SOS alerts are read out in Morse. Plug the screen in later and it's picked up within 3 s. |
| Speaker | Everything works silently, with timing kept for Morse/light. |
| Microphone | Audio-modem / Morse listening are simply unavailable. |
| Buttons | Works as an automatic **relay + listener**: repeats everyone's messages, and SOS alarms are announced. |
| A stuck or shorted button | Ignored until it's released once. |
| LoRa module | Detected at boot and skipped. |
| LEDs | All light signals use whatever LED exists, plus a screen flash. |
| Battery divider | Battery % is just not shown. |

On every boot the hardware report shows on screen and on the USB serial log. With no screen, the device says **"OK"** in Morse (**"OK RELAY"** if no buttons were found).

The phone hotspot is still there, but it's **off by default** and nothing depends on it.

---

## 6. Test plan

1. **Flash and watch the log:** `idf.py -p PORT flash monitor`. Check the `selftest:` lines for each part.
2. **Self test:** *Tools → Self test*. It checks screen, speaker, mic, every button, LEDs and the radio, then gives a pass/fail list.
3. **Remove-one-part test:** power on with each part unplugged in turn (screen, speaker, mic, LoRa, buttons). The unit must boot, report the part missing and keep working.
4. **Two-unit range test:** one unit stays put, then walk away sending "Quick message" until replies stop. Write down the distance for normal, Long range and LoRa.
5. **Battery test:** full charge, Power saver ON, note the time until it shuts down.
6. **Solar test:** put a USB meter or multimeter in line at noon and note the charge current.
7. **Walkie-talkie test:** audio modem through two walkie-talkies.
8. **Box test:** pack everything, shake it, carry it for a day, then unpack and run the self test.
