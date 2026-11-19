# Plan

## Goal
A browser-based 3D house builder (Three.js, no backend) that works well on a phone and on desktop, hosted on GitHub Pages.

## Features
Walls, auto-detected rooms, doors/windows, roofs (flat/gable/hip), multi-storey + stairs, furniture library, paint/materials, undo/redo, multi-select, copy/paste, measurements (m/ft), walkthrough, day/night, save/load/export (JSON, PNG, GLB), 2BHK/3BHK templates, electrical/plumbing points layer.

## Tasks
- [x] Core model, geometry, room detection
- [x] 3D builder + 2D plan + tools
- [x] UI (mobile-first), storage, templates
- [x] Browser tests: console errors, save/load round trip, mobile layout
- [x] README for non-developers
- [ ] Merge branch into `main` and enable GitHub Pages (owner)
- [ ] Try it on a real phone and note anything awkward

## Ideas for later
- L-shaped / per-room roofs
- Curved walls, wall niches
- Railings around stair openings on upper floors
- Wiring routes between electrical points; export of points to a Home Assistant/ESPHome config
- Dimension input while drawing (type an exact length)

## Notes
- No build step: plain ES modules, Three.js vendored in `vendor/`.
- Furniture lives in `js/library/furniture.js` (one file).
