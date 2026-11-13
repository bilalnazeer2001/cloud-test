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

**Basic computer (Tools menu)**: calculator, flashlight/strobe/SOS light, 8 saved notes, stopwatch, countdown timer, tally counter, supplies planner (water/food for N people x D days), survival guide (water, first aid, CPR, direction, signals), dice/coin, battery level.

## Parts
- ESP32-S3 dev board (e.g. ESP32-S3-DevKitC, 4 MB flash or more)
- 0.96" SSD1306 or 1.3" SH1106 I2C OLED (128x64)
- 7 push buttons (UP, DOWN, LEFT, RIGHT, OK, BACK, MORSE)
- 4 LEDs (red, green, blue, white) + 330 ohm resistors
- MAX98357A I2S amplifier + 4-8 ohm speaker
- INMP441 I2S microphone
- Optional: SX1276 LoRa module + antenna, 18650 battery + TP4056 charger + 2x 100k resistors

## Wiring (default pins - change in `idf.py menuconfig` > "Apocalypse Communicator - Wiring")
| Part | Pin on part | ESP32-S3 GPIO |
|---|---|---|
| OLED | SDA / SCL / VCC / GND | 8 / 9 / 3V3 / GND |
| Buttons (other leg to GND) | UP DOWN LEFT RIGHT OK BACK MORSE | 4 5 6 7 15 16 17 |
| LEDs (via 330 ohm to GND) | red green blue white | 38 39 40 41 |
| MAX98357A | BCLK / LRC / DIN / VIN / GND | 10 / 11 / 12 / 5V / GND |
| INMP441 | SCK / WS / SD / L/R / VDD / GND | 13 / 14 / 18 / GND / 3V3 / GND |
| Battery divider (100k + 100k) | middle point | 1 |
| LoRa SX1276 (optional) | SCK MISO MOSI NSS RST / 3V3 / GND | 21 47 48 42 2 / 3V3 / GND |

Avoid GPIO 0, 3, 19, 20, 26-37, 45, 46 (boot, USB and flash/PSRAM pins).

## Build and flash (on your PC)
1. Install ESP-IDF v5.3 (Espressif's installer / VS Code ESP-IDF extension).
2. In this folder: `idf.py set-target esp32s3`
3. Optional: `idf.py menuconfig` to change pins or enable LoRa.
4. `idf.py -p COM5 flash monitor` (use your board's port).

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
- Not tested on real hardware yet (this was written in the cloud). It compiles cleanly with ESP-IDF v5.3.2, and the audio modem and calculator were tested on a PC.
- Long Range Wi-Fi mode only talks to other ESP32s.
