# House Builder 3D

Design a house in your web browser. Draw walls on a 2D plan and watch them appear in 3D. Then add doors, windows, furniture and a roof, and walk through the house.
It works on a phone and on a computer, needs no installation and no account, and keeps your work saved in the browser.

---

## 1. How to use it

### The screen

| Area | What it is |
|---|---|
| **Top bar** | ☰ menu · project name · ↶ undo · ↷ redo · **2D / ⇅ / 3D** view switch · floor picker |
| **Main area** | The 2D plan, the 3D view, or both (⇅ = split screen) |
| **Options panel** | Settings for the tool you picked, or for the thing you selected. Tap its title bar to hide or show it. On a computer it sits on the right. |
| **Bottom toolbar** | Select · Walls · Doors · Furnish · Paint · Measure · More |

### Moving around

| | Phone / tablet | Computer |
|---|---|---|
| **2D plan** | One finger: pan (with Select) · Two fingers: pinch to zoom and pan | Mouse wheel zooms · right-drag pans |
| **3D view** | One finger: orbit · Pinch: zoom · Two fingers: pan | Drag: orbit · wheel: zoom · right-drag or Shift-drag: pan |

### Building, step by step

1. **Walls**: tap **Walls**.
   - *Draw walls*: drag from one point to another. You can also tap the start point and then tap the end point. Walls snap to the grid and to other walls, so corners join up by themselves.
   - *Rectangle room*: drag a box to create four walls at once.
   - Choose the wall thickness (10 to 30 cm) before you draw. Select a wall to change its length, thickness or height. Drag its round end handles to resize it, and the walls joined to it follow.
2. **Rooms** appear by themselves when walls close a space. Their area is shown in the middle. Tap a room with **Select** to rename it (for example *Kitchen*) and to pick its floor finish.
3. **Doors and windows**: tap **Doors**, choose *Door* or *Window* and a style, then tap on a wall. Drag one along the wall to move it. Select it to change its width, height, sill height, swing side or colour.
4. **Furniture**: tap **Furnish**, pick a category, and tap an item to add it. Then:
   - **Plan**: drag it to move it. Drag the round ↻ handle to rotate it.
   - **3D**: tap it once to select it, then drag it.
   - **Options panel**: rotate it (±15° or 90°), change its size, colours or height above the floor, or duplicate or delete it.
   - Wall items (TV, AC, cabinets, wall lights) stick to the nearest wall by themselves.
5. **Paint**: tap **Paint**, pick a finish (paint, tile, wood, marble, brick or concrete) and a colour. You can also use **+** for any custom colour. Then tap what you want to paint: a wall, floor, roof, door, window or piece of furniture.
   **Each side of a wall is painted separately**, so the inside and outside can have different colours.
6. **Measure**: tap **Measure** and drag across the plan. The distance shows in metres and feet. Wall lengths and room areas are shown all the time. You can switch between metres and feet in the Measure options or in ☰ → Settings.
7. **More** (⋯):
   - **Stairs**: tap to place a staircase, which rises to the floor above. Rotate it so the arrow points up.
   - **Electrical and plumbing points**: switches, sockets, light points, the distribution board, ESP32/controller, motion, door, temperature and water-level sensors, cameras, Wi-Fi, pumps, valves, taps and drains.
     - Near a wall they stick to it. In 3D, tap the wall at the height you want.
     - Give each point a label (for example *Borewell pump*).
     - *Points list (CSV)* downloads a table of every point, which you can open in Excel or Google Sheets.
   - **Roof**: choose flat, gable or hip, and set the pitch, overhang and finish. *Turn ridge* turns the ridge 90°. The roof sits on the top floor.
   - **Floors**: add a floor above (its outside walls are copied for you), switch between floors, rename them or change their height.
   - **Sun & lights**: the time-of-day slider moves the sun. At night, the lamps you placed light up.
   - **Walk through**: explore the house in first person.
     - **Phone**: joystick bottom-left, drag anywhere else to look around.
     - **Computer**: W A S D or the arrow keys, drag to look, hold Shift to run.
     - Walls stop you, doorways let you through, and stairs take you up or down.
8. **Select tricks**:
   - Turn on **Multi-select** and tap several things. In the plan you can also drag a box around them.
   - Then **Copy**, **Paste**, **Duplicate** or **Delete** them together.
   - Undo and redo cover every change.

### Saving your work

* **Auto-save**: every change is saved in your browser. Close the tab, come back later, and your house is still there. ("Saved" in the top bar flashes green.)
* **☰ → Export project (.json)**: download a backup file. Use it to move your design to another phone or computer, or to keep several versions.
* **☰ → Open project (.json)**: load a backup file.
* **☰ → Screenshot (.png)**: saves a picture of the current view. In walk mode, use the 📷 button.
* **☰ → 3D model (.glb)**: exports the whole house as a 3D file. It opens in Blender, in Windows 3D Viewer or on websites such as gltf-viewer.donmccurdy.com.

> ⚠️ Auto-save lives in *this browser on this device*. Clearing your browser data deletes it, so export a .json backup now and then.

### Starter houses

**☰ → Start from** offers:
* **Small 2BHK**: one storey, 10 × 8 m, gable roof, furnished, with example electrical and plumbing points.
* **3BHK two-storey**: 10 × 9 m, stairs, flat roof with parapet.
* **Empty project**: start from scratch.

### Keyboard shortcuts (computer)

| Keys | Action |
|---|---|
| Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) | Undo / redo |
| Ctrl+C / Ctrl+V / Ctrl+D | Copy / paste / duplicate |
| Delete or Backspace | Delete selection |
| R / Shift+R | Rotate selection 90° |
| V W D F P M | Select, Walls, Doors, Furnish, Paint and Measure tools |
| Esc | Cancel / deselect / back to Select |
| Alt + click in 3D | Pick up the colour of what you click |

---

## 2. How to run it on your own computer

The builder is just a folder of files. It has no build step and needs no internet once it is open. The only catch is that browsers won't run it straight from a double-clicked file, so you need a tiny local web server:

1. Download the project: on GitHub press the green **Code** button → **Download ZIP**, then unzip it.
2. Open a terminal in that folder (on Windows, right-click inside the folder → *Open in Terminal*).
3. Run **one** of these:
   * `python -m http.server 8000` (Python comes with Mac and Linux; on Windows install it from python.org), or
   * `npx serve .` (needs Node.js from nodejs.org)
4. Open **http://localhost:8000** in your browser.

To try it on your phone over home Wi-Fi, start the server on your computer. Then, on the phone, open `http://<your-computer's-IP>:8000`. On Windows, `ipconfig` shows the IP address.

---

## 3. How to put it on the internet with GitHub Pages (free)

You'll get a link like `https://<your-username>.github.io/<repo-name>/` that works on any phone.

1. **Get the code onto the `main` branch.** This work is on the branch `ccr-b2cf3f4c-hlqda0`. On GitHub, open the repository and click **Pull requests → New pull request**. Choose `base: main` and `compare: ccr-b2cf3f4c-hlqda0`, then press **Create pull request** and **Merge pull request**.
2. Click **Settings** at the top of the repository.
3. In the left menu, click **Pages**.
4. Under **Build and deployment**:
   * **Source**: *Deploy from a branch*
   * **Branch**: `main`, folder `/ (root)`, then **Save**.
5. Wait 1–2 minutes and refresh the page. A box appears at the top saying **"Your site is live at …"**. Open that link.
6. Optional: on your phone, open the link and choose **Add to Home screen**. It then opens like an app.

Every time new changes are merged into `main`, the site updates by itself within a minute or two.

> **Private repository?** GitHub Pages on a private repo needs a paid GitHub plan. If the Pages option is greyed out, either make the repository public (Settings → General → Danger Zone → Change visibility) or use another free static host such as Netlify Drop or Cloudflare Pages: drag the folder onto their website.

---

## 4. Adding your own furniture

Every item is defined in **one file: `js/library/furniture.js`**. Each item is a short list of boxes, cylinders and balls. To add one:

1. Open `js/library/furniture.js`.
2. Copy an existing entry, for example `bedside`, and paste it below with a new name such as `my_cabinet`.
3. Change `name`, `cat` (category), `size: [width, height, depth]` in metres, the colours and the `parts`.
4. Save and reload the page. It appears in the library straight away.

The comment at the top of that file explains every option. Markers for the electrical layer are in `js/library/markers.js` and work the same way.

---

## 5. For the curious: how the code is organised

```
index.html            the page
css/style.css         all styling (mobile first, desktop layout from 900 px)
vendor/               Three.js r170 + GLTF exporter (MIT licence), so no CDN is needed
js/main.js            start-up, connects 3D taps to the tools
js/state.js           the project data, undo/redo, selection, change events
js/geometry.js        maths: wall corners, room detection, areas, units
js/materials.js       paint/tile/wood/marble/brick/concrete textures (drawn in code)
js/scene/builder.js   turns the project into 3D meshes (merged per material for speed)
js/scene/view3d.js    renderer, camera gestures, sun and lights, picking
js/scene/walk.js      first-person walking with collisions and stairs
js/tools/plan2d.js    the 2D plan and its drawing/editing tools
js/tools/actions.js   shared edits (paint, place door, add furniture…)
js/library/           furniture.js, markers.js, parts.js (shape helpers)
js/ui/                toolbar, panels, menus, joystick
js/storage/           auto-save, import/export, starter templates
```

**Phone speed tricks.**
- Walls and floors are merged into one mesh per material.
- Each piece of furniture is a single mesh.
- Only the sun casts shadows, and its shadow map updates only when something changes.
- At most 8 lamps light up at night.
- The screen only redraws when something changes.
- Shadows can be switched off in ☰ → Settings.

## Known limits

* Roofs are built over the rectangle that best fits each building outline. L-shaped houses get one roof over the whole rectangle (or use a flat roof).
* Walls are straight. There are no curved walls.
* The project is saved per browser. Use export/import to move it between devices.
