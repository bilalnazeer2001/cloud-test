# Safety and bug review

Reviewed the whole firmware (3,500 lines), the web flasher and the kit guide. Every item below was checked in the
code or by a test before it was changed. Tests ran on a PC (real firmware code with hardware stand-ins), because
nothing has run on a real board yet.

## Fixed in this review

| # | Problem | Why it mattered | Fix |
|---|---|---|---|
| 1 | **Speaker-only mode ate button presses.** After 60 s idle it acted as if a screen had gone to sleep and swallowed the next press. | The "no screen" mode you asked for was unreliable. | Screen sleep only happens when a screen exists. |
| 2 | **A sender could set an enormous hop count (255)** and make every unit repeat a message again and again. | Radio flooding, dead batteries. | Hop count is capped at 6 on receipt. |
| 3 | **Unknown packet types were repeated** by every unit. | Junk could travel the mesh. | Unknown types are ignored. |
| 4 | **Duplicate memory held only 64 messages**, so on a busy network a message could come back and be repeated again. | Repeat storms. | Now 256, with a lock (three tasks used it at once). |
| 5 | **SOS beacon filled the inbox**: one entry every 30 s pushed all real messages out in 12 minutes, on the sender and on every receiver. It also rewrote flash every time. | You could lose important messages and wear the flash. | Only the first SOS is saved; receivers save a repeated SOS once. |
| 6 | **Alarm spam**: a stranger could keep every unit beeping and popping up. | Denial of service. | At most one alarm per 10 s. Ping answers limited to one per 5 s. |
| 7 | **Button and battery reader could start at the same time** and leave the analog reader dead (no buttons on the ladder, no battery %). | Random "buttons don't work" after boot. | Analog reader is set up first, in order. |
| 8 | **Possible crash** if the screen's bus failed to open, then a later hot-plug check. | Reboot loop. | Fixed order of set-up. |
| 9 | **Saved settings were trusted blindly.** A bad volume value overflowed into loud noise, a zero Morse speed divided by zero. | Crash or deafening speaker after a firmware update. | All settings are checked and corrected on load. |
| 10 | **Wi-Fi hotspot password made too early** (random generator is only fully random once Wi-Fi runs) and only 8 characters. | Easier to guess. | Made on first hotspot start, 10 characters (about 50 bits). |
| 11 | **Two parts could be wired to one pin** by the default settings (ESP32 without the ladder, S3 with the ladder). | Parts silently don't work or fight each other. | Defaults fixed, and **the build now stops with a clear message** if two parts use one pin, or a flash pin is chosen. |
| 12 | **"BACK = stop" on Morse playback did nothing.** | A 2-minute message you couldn't stop. | Holding BACK stops it. |
| 13 | **Calculator: -2^2 gave 4.** | Wrong answer. | Gives -4. |
| 14 | **LoRa power setting above 17 dBm** on the older chip wrote a wrong register value. **Default 20 dBm** was over the EU limit. | Illegal power, odd behaviour. | Capped at 17; default is now 14 dBm. |
| 15 | Small stacks for audio tasks, main task. | Possible crash in long Morse playback. | Stacks increased. |
| 16 | Survival guide wording: Big Dipper pointer stars, sun direction in the tropics, shock position with injuries. | Misleading advice. | Reworded. |

## Tested

- **Hostile traffic (PC, memory checkers on):** 200,000 random packets and 100 seconds of random audio noise: no memory errors.
- **8 attack scenarios** all pass: hop-count abuse, unknown types, duplicates, 200-packet churn, SOS repeats and alarm spam, ping flood, truncated packets.
- Button ladder: 160,000 simulated presses with cheap 5% resistors, 0 misreads.
- Audio modem: decodes correctly up to moderate noise. Calculator: 17 edge cases correct.
- Builds: 6 hardware setups with **0 errors and 0 warnings**; a deliberately wrong pin setup is rejected.
- Flasher library: the bundled copy is **byte-identical** to the official npm package (checked every file). Firmware images contain no personal data or passwords.

## Still open (not fixed)

1. **No encryption or sender check.** Anyone in radio range can read messages, and can fake a message or an SOS (the new limits only slow down floods). The fix is a shared group key (encrypt + signature). I can add it if you want; all units would need the same key.
2. **No airtime limit on LoRa.** In the EU the 868 MHz band allows about 1% airtime. A long SOS beacon plus relaying can go over it. You are responsible for legal settings.
3. **No software shut-off for a nearly empty battery.** It only warns. Use a protected cell.
4. **Not tested on real hardware.** Needs a hands-on test: the SX1262 radio driver, the shared speaker/mic I2S wires, the Morse listening thresholds, battery-life figures.
5. **Microphone check can say "present" on a classic ESP32** if the mic pin floats. Add a 100k resistor from the mic data pin to GND.
6. **Inbox list can open the wrong message** if a new message arrives while the list is open.
7. **Settings reset** when a firmware update changes the saved settings layout (name and password are lost). The flasher's "erase device" does the same.
8. **No secure boot or flash encryption.** Someone holding the device can reflash it or read the hotspot password.
9. **Phone hotspot uses plain HTTP**, and any phone that joins can send messages and SOS (it needs the Wi-Fi password).
