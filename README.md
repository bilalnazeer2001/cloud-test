# Bench Tools

A phone-friendly web app with electronics and 3D-printing calculators. It is plain HTML, CSS and JavaScript with no build step and no internet needed after the first visit.

## Tools
- **PCB trace width & current** (IPC-2221), with voltage drop
- **Ohm's law & power**, **resistors in series/parallel**, **nearest standard resistor** (E12/E24/E96)
- **LED series resistor**, **voltage divider** (both directions)
- **Resistor colour code** (4/5/6 bands, both directions)
- **Buck and boost converter** helpers, **RC filter**
- **ESP32 pinouts**: ESP32 DevKitC, ESP32-S3-DevKitC-1, XIAO ESP32-S3, XIAO ESP32-C3, with strapping-pin notes
- **3D-print cost estimator** with STL upload (size, volume, area, weight estimate, 3D preview)

## Run it
Open it through any web server, for example `python3 -m http.server` in this folder, then visit http://localhost:8000.
To install on a phone, host it (for example on GitHub Pages) and use "Add to Home Screen". It then works offline.

## Updating
If you change any file, bump `VERSION` in `sw.js` so phones download the new copy.
