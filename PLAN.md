# Plan

## Goal
Off-grid "apocalypse communicator" on ESP32-S3: emergency messaging + basic pocket computer.

## Features
- ESP-NOW mesh messaging (long-range mode), optional LoRa, audio modem, Morse, phone hotspot chat
- SOS beacon with alarms on receivers
- Tools: calculator, flashlight, notes, timers, tally, supplies planner, survival guide

## Tasks
- [x] Firmware written (`firmware/apocalypse-comm`), compiles with ESP-IDF v5.3.2
- [ ] Wire up hardware and flash (Bilal, on PC)
- [ ] Test range between two units
- [ ] Later: encryption, RTC module, GPS location in SOS

## Notes
Default pins are in `firmware/apocalypse-comm/README.md`.
