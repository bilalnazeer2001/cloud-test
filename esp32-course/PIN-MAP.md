# Kit list and pin map

The whole course uses **one board and one fixed set of pins**. A pin keeps the same job in every lesson, so you can leave parts wired on the breadboard.

## The board

**ESP32 DevKit V1** (also sold as "ESP32-WROOM-32 DevKit", 30 pins). Boards with 38 pins also work; the GPIO numbers are the same, only the positions on the board differ. Always go by the **label printed next to the pin**, not by its position.

## Shopping list

| Part | Used in | Notes |
|---|---|---|
| ESP32 DevKit V1 × 2 | everything (2 needed for wireless lessons) | Buy 3. One will die. That is normal. |
| Micro-USB **data** cable | everything | Many cheap cables are charge-only and will not work. |
| Breadboard + jumper wires | everything | |
| LEDs + 220 Ω resistors | Part 1–2 | |
| Push button × 2 | Part 1–4 | |
| 10 kΩ potentiometer | Part 2 ADC | |
| SSD1306 OLED 0.96" 128×64, I2C | Part 2 I2C, Project 3 | Address is usually 0x3C. |
| DS3231 RTC module, I2C | Part 2 I2C, Project 2 | With its coin cell. |
| MicroSD card module (SPI) + card | Part 2 SPI | Card formatted FAT32, 32 GB or less. |
| PCM5102A I2S DAC module | Part 2 I2S | Plus headphones or a powered speaker. |
| SX1278 "Ra-02" LoRa module × 2 **with antennas** | Part 2 LoRa | 433 MHz version. Check which band is legal where you live. |
| 1-channel 5 V relay module (opto-isolated) × 2 | Projects 1, 2 | "Active LOW" type is the most common. |
| Float switch | Project 1 | Any switch works for testing. |

## Pin map (same in every lesson)

| GPIO | Job | Used in |
|---|---|---|
| 2 | On-board blue LED | Part 1, everywhere as "status light" |
| 4 | External LED (PWM) | Part 2 GPIO, PWM |
| 5 | SPI chip select (CS) — SD card **or** LoRa NSS | Part 2 SPI, LoRa |
| 13 | Relay | Projects 1, 2, Part 3 |
| 14 | Float switch / second button | Project 1 |
| 16 | Serial2 RX (from Meshtastic radio TX) | Part 2 LoRa/Meshtastic |
| 17 | Serial2 TX (to Meshtastic radio RX) | Part 2 LoRa/Meshtastic |
| 18 | SPI clock (SCK) | Part 2 SPI, LoRa |
| 19 | SPI MISO | Part 2 SPI, LoRa |
| 21 | I2C data (SDA) | Part 2 I2C, Projects 2, 3 |
| 22 | I2C clock (SCL) | Part 2 I2C, Projects 2, 3 |
| 23 | SPI MOSI | Part 2 SPI, LoRa |
| 25 | I2S word select (LRCK / WS) | Part 2 I2S |
| 26 | I2S bit clock (BCK) | Part 2 I2S |
| 27 | Push button (to GND) — also the deep-sleep wake button | Part 1–4 |
| 32 | I2S data out (DIN on the DAC) | Part 2 I2S |
| 33 | LoRa reset (RST) | Part 2 LoRa |
| 34 | Potentiometer (analog input) | Part 2 ADC |
| 35 | LoRa DIO0 (interrupt from radio) | Part 2 LoRa |

## Pins to leave alone

| GPIO | Why |
|---|---|
| 0, 2, 5, 12, 15 | "Strapping" pins: the chip reads them at power-on to decide how to boot. 2 and 5 are fine for the jobs above. **Never** connect 12 to anything that pulls it HIGH at power-on. |
| 6–11 | Wired to the flash memory chip inside the module. Using them crashes the board. |
| 1, 3 | USB serial (TX, RX). Using them breaks uploading and the Serial Monitor. |
| 34, 35, 36, 39 | **Input only**. They cannot drive an LED or relay and have no internal pull-up. |

## Two rules that save boards

1. **ESP32 pins are 3.3 V.** Never connect a 5 V signal directly to a GPIO.
2. **A GPIO can give about 12 mA safely** (enough for an LED with a resistor). Motors, relays coils, pumps and bells always go through a relay module or transistor, never straight to a pin.
