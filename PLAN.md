# Plan

## Goal
Off-grid "apocalypse communicator" on ESP32-S3: emergency messaging + basic pocket computer.

## Features
- ESP-NOW mesh messaging (long-range mode), optional LoRa, audio modem, Morse, phone hotspot chat
- SOS beacon with alarms on receivers
- Tools: calculator, flashlight, notes, timers, tally, supplies planner, survival guide

## Tasks
- [x] Firmware written (`firmware/apocalypse-comm`), compiles with ESP-IDF v5.3.2
- [x] v2: XIAO ESP32S3 + Wio-SX1262 profile, works with any part missing, speaker-only Morse mode, self test, power saver
- [x] Kit guide: power (18650, solar, crank, AA, TEG), antennas, box (`firmware/apocalypse-comm/HARDWARE_KIT.md`)
- [ ] Buy parts, wire up hardware and flash (Bilal, on PC)
- [ ] Run Tools > Self test and the remove-one-part test
- [ ] Test range between two units
- [ ] Measure real battery life in normal and power-saver mode
- [ ] Later: encryption, deep-sleep standby, RTC module, GPS location in SOS, recorded voice prompts

## Notes
Default pins are in `firmware/apocalypse-comm/README.md`.
