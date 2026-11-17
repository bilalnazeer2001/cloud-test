# Plan

## Goal
Offline, mobile-first web app of electronics and 3D-print tools.

## Features
- Searchable tool list; calculators remember the last values used
- Electronics calculators, ESP32 pinout viewers, 3D-print cost estimator with STL upload
- Works offline (service worker) and installs to the home screen

## Tasks
- [x] Build all tools and offline support
- [ ] Host it (e.g. GitHub Pages) and try it on a phone
- [ ] Check pinouts against the exact boards on the bench

## Notes
- No build step. Bump `VERSION` in `sw.js` after any change.
