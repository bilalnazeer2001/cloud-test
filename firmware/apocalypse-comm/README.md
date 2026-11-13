# Field Communicator (ESP32-S3)

An off-grid emergency messenger and pocket computer. No internet, no phone towers, no router needed.

## What it can do

**Talk to other units**
| Link | Hardware | Range (rough) |
|---|---|---|
| ESP-NOW radio (built in) | nothing extra | 100-200 m, up to ~1 km line-of-sight in Long Range mode |
| LoRa radio (optional) | SX1276 / RFM95 / Ra-02 module | 2-10 km line-of-sight |
| Audio modem | speaker + microphone | across a room, or **through any walkie-talkie/CB** |
| Morse code | speaker, white LED, Morse key button | as far as sound/light carries |
| Phone link | your phone | phone joins the unit's Wi-Fi hotspot, chat at 192.168.4.1 |

- Every unit **relays** messages it hears (mesh), so 3 units in a line cover 3x the distance. Messages heard on LoRa are repeated on ESP-NOW and vice versa.
- **SOS beacon**: repeats SOS on radio every 30 s plus Morse SOS on speaker and light. Receivers sound an alarm and show a pop-up.
- Inbox of the last 24 messages, saved across power loss. Quick preset messages ("I AM OK", "NEED WATER"...).
- Morse decoder (listens with the mic), Morse practice with the key button, type with Morse in any text box.

**Basic computer (Tools menu)**: calculator, flashlight/strobe/SOS light, 8 saved notes, stopwatch, countdown timer, tally counter, supplies planner (water/food for N people x D days), survival guide (water, first aid, CPR, direction, signals), dice/coin, battery level, **self test**.

**Power saver** (Settings): turns the Wi-Fi radio off and keeps LoRa + audio listening. Battery lasts about 3x longer (estimate).

## Hardware
**Recommended compact build: Seeed XIAO ESP32S3 + Wio-SX1262.** See **[HARDWARE_KIT.md](HARDWARE_KIT.md)** for:
the wiring, the 7-buttons-on-1-pin ladder, power sources (battery, solar, crank, AA, heat), antennas,
the kit box layout and a full test plan.

Every part is optional. The firmware detects what is connected, and with no screen it reads everything out in Morse.

Pin defaults come from `idf.py menuconfig` > "Apocalypse Communicator - Wiring" > **Board**:
- **XIAO ESP32S3 + Wio-SX1262** (default): see the table in HARDWARE_KIT.md.
- **Generic ESP32-S3 DevKit:** one pin per button/LED, as below.

| Part (DevKit option) | Pin on part | ESP32-S3 GPIO |
|---|---|---|
| OLED | SDA / SCL | 8 / 9 |
| Buttons (other leg to GND) | UP DOWN LEFT RIGHT OK BACK MORSE | 4 5 6 7 15 16 17 |
| LEDs (via 330 ohm to GND) | red green blue white | 38 39 40 41 |
| MAX98357A | BCLK / LRC / DIN | 10 / 11 / 12 |
| INMP441 | SCK / WS / SD / L/R | 13 / 14 / 18 / GND |
| Battery divider (100k + 100k) | middle point | 1 |
| LoRa SX1276 (optional) | SCK MISO MOSI NSS RST | 21 47 48 42 2 |

### ESP32-WROOM-32 DevKit (classic ESP32)
Uses the button ladder (all 7 buttons on GPIO36, plus a 10k pull-up to 3V3, resistor values in HARDWARE_KIT.md).

| Part | Pin on part | ESP32 GPIO |
|---|---|---|
| OLED | SDA / SCL | 21 / 22 |
| Button ladder | | 36 |
| LEDs | red green blue white | 32 2 33 16 (2 = on-board LED) |
| MAX98357A | BCLK / LRC / DIN | 26 / 25 / 27 |
| INMP441 | SCK / WS / SD / L/R | 14 / 13 / 34 / GND (add 100k from SD to GND) |
| Battery divider | middle point | 39 |
| LoRa SX1276/Ra-02 | SCK MISO MOSI NSS RST | 18 19 23 5 4 |

The classic ESP32 has no USB port of its own; logs come through the board's USB-serial chip as usual.

Avoid GPIO 0, 3, 19, 20, 26-37, 45, 46 on an S3 DevKit (boot, USB and flash/PSRAM pins).
If the XIAO's built-in LED works backwards (on when it should be off), switch "LEDs light when pin is LOW" in menuconfig.

## Flash from Chrome (no install needed)
Open the flasher page (`docs/index.html`, hosted with GitHub Pages), click **Install** for your board, pick the USB port.
To rebuild the images after changing code: `tools/build_web_flasher.sh`.

## Build and flash (on your PC)
1. Install ESP-IDF v5.3 (Espressif's installer / VS Code ESP-IDF extension).
2. In this folder: `idf.py set-target esp32s3` (or `esp32` for a WROOM-32 board)
3. Optional: `idf.py menuconfig` to change pins or enable LoRa.
4. `idf.py -p COM5 flash monitor` (use your board's port). Logs come out of the board's native USB port.
5. Run **Tools > Self test** on the device.

## Using it
- Arrows move, **OK** selects, **BACK** goes back. **Hold OK** = done when typing. **Hold BACK** = cancel / stop SOS.
- Typing: pick letters on the grid, or tap Morse on the MORSE button.
- All units must be on the **same channel** (Radio menu). Long Range mode must be ON on all or OFF on all.
- Phone link: the screen shows the hotspot name and a password made randomly on first boot.
- Audio modem through a walkie-talkie: hold the speaker to the radio's mic while pressing its talk button; the receiving unit's mic listens to the other radio's speaker (turn on Settings > Modem listen).

## About "other frequencies" (oscillators)
Don't build your own transmitter from loose crystal oscillators: it will be weak, drift, and can jam emergency services (illegal almost everywhere). Use ready-made, certified radio modules instead:
- **Best add-on: LoRa SX1276/SX1262 module** (433 MHz in Asia/EU, 868 MHz EU, 915 MHz Americas). Kilometres of range on a coin of power. Supported by this firmware.
- **Walkie-talkie (PMR446 / FRS) or CB radio** + this unit's audio modem: works today, no extra code.
- A licensed ham radio operator can also use the audio modem over VHF/UHF/HF for much longer range.
- 32.768 kHz crystal is useful though: add a DS3231 real-time clock module later to keep time without a phone.

## Limits / honest notes
- Messages are **not encrypted** - anyone with this firmware can read them. Don't send secrets.
- Not tested on real hardware yet (this was written in the cloud). It compiles cleanly with ESP-IDF v5.3.2 for XIAO, DevKit, both LoRa chips and an "everything missing" setup. The audio modem, calculator and button ladder were tested on a PC.
- The SX1262 driver follows the datasheet and the Wio-SX1262 pinout. Confirm it on hardware with two units.
- Long Range Wi-Fi mode only talks to other ESP32s.
