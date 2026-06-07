# ATC24 Electron Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing ATC24 flight plan generator as an always-on-top Electron overlay with a thin bar at the top of the screen that shows phase-aware V-speeds, and expands into the full app on click.

**Architecture:** Three new files (package.json, main.js, preload.js) set up the Electron shell with a frameless, always-on-top window positioned at the very top of the screen. index.html gains a persistent `#bar` element above the existing `#app` panel. The bar shows the current aircraft name, a TAKEOFF/LANDING phase toggle, and the relevant V-speeds (V1/VR/V2 or Vapp/Vref). Clicking ▼/▲ expands or collapses the panel by sending an IPC message to main.js which resizes the window. The optional-chaining call `window.electronAPI?.resizeWindow()` means the file still works as a plain browser page.

**Tech Stack:** Electron 28, vanilla HTML/CSS/JS (existing), Node.js IPC via contextBridge.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `package.json` | Create | npm entry point, `npm start` script |
| `main.js` | Create | BrowserWindow setup, IPC resize handler |
| `preload.js` | Create | Expose `electronAPI.resizeWindow` to renderer safely |
| `index.html` | Modify | Add bar HTML, update body/app CSS, add bar JS |

---

## Task 1: Electron Scaffold

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `preload.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "atc24-overlay",
  "version": "1.0.0",
  "description": "ATC24 Flight Plan Generator Overlay",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^28.0.0"
  }
}
```

- [ ] **Step 2: Create `preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (expanded) => ipcRenderer.send('resize-window', expanded)
});
```

- [ ] **Step 3: Create `main.js`**

```js
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const BAR_HEIGHT  = 52;
const FULL_HEIGHT = 820;

let win;

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height: BAR_HEIGHT,
    x: 0,
    y: 0,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'screen-saver');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('resize-window', (_event, expanded) => {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(width, expanded ? FULL_HEIGHT : BAR_HEIGHT);
});
```

- [ ] **Step 4: Install Electron**

Run from `C:\Users\nilam\flight plan generator`:
```bash
npm install
```
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 5: Verify Electron launches**

```bash
npm start
```
Expected: a narrow (~52px tall) frameless window appears at the very top of the screen, full screen width. Close with Alt+F4.

- [ ] **Step 6: Add `node_modules` to `.gitignore`**

Create `.gitignore`:
```
node_modules/
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json main.js preload.js .gitignore
git commit -m "feat: add Electron scaffold with always-on-top overlay window"
```

---

## Task 2: Bar HTML + CSS

**Files:**
- Modify: `index.html` — add bar HTML, update `body` and `#app` CSS, add bar CSS

- [ ] **Step 1: Add bar HTML**

In `index.html`, immediately after `<body>` and before `<div id="app">`, insert:

```html
<div id="bar">
  <div id="bar-phase-toggle">
    <button class="phase-btn active" id="phase-takeoff">🛫 TAKEOFF</button>
    <button class="phase-btn" id="phase-landing">🛬 LANDING</button>
  </div>
  <div id="bar-aircraft">— No aircraft —</div>
  <div id="bar-vspeeds">
    <span class="bar-vspeed"><span class="bar-vname" id="bar-name1">V1</span><span class="bar-vval" id="bar-val1">—</span></span>
    <span class="bar-vspeed"><span class="bar-vname" id="bar-name2">VR</span><span class="bar-vval" id="bar-val2">—</span></span>
    <span class="bar-vspeed"><span class="bar-vname" id="bar-name3">V2</span><span class="bar-vval" id="bar-val3">—</span></span>
  </div>
  <button id="bar-expand-btn">▼</button>
</div>
```

- [ ] **Step 2: Update `body` CSS — make it a flex column and remove padding**

Find the existing `body` rule and replace it with:

```css
body {
  background-color: #0d1117;
  color: #e6edf3;
  font-family: 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  overflow: hidden;
}
```

- [ ] **Step 3: Move padding onto `#app` and hide it by default**

Find the existing `#app` rule and replace it with:

```css
#app {
  width: 100%;
  max-width: 680px;
  padding: 2rem 1rem;
  display: none;
  overflow-y: auto;
}
```

- [ ] **Step 4: Add bar CSS**

Add the following inside `<style>`, before the `@media` query:

```css
#bar {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  background-color: #161b22;
  border-bottom: 2px solid #30363d;
  flex-shrink: 0;
  user-select: none;
}

#bar-phase-toggle {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.phase-btn {
  background: none;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
  transition: all 0.15s;
}

.phase-btn.active {
  background-color: #1f6feb;
  border-color: #1f6feb;
  color: #ffffff;
}

.phase-btn:hover:not(.active) {
  border-color: #58a6ff;
  color: #58a6ff;
}

#bar-aircraft {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e6edf3;
  min-width: 60px;
  flex-shrink: 0;
}

#bar-vspeeds {
  display: flex;
  gap: 1.5rem;
  flex: 1;
}

.bar-vspeed {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.bar-vname {
  font-size: 0.7rem;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 2.2rem;
}

.bar-vval {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.95rem;
  color: #3fb950;
}

#bar-expand-btn {
  background: none;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: auto;
  transition: all 0.15s;
}

#bar-expand-btn:hover {
  border-color: #58a6ff;
  color: #58a6ff;
}
```

- [ ] **Step 5: Verify in browser**

Open `index.html` in a browser. Expected: only the dark bar is visible. The ▼ button is on the right. Phase toggle shows 🛫 TAKEOFF highlighted blue, 🛬 LANDING grey. V-speed slots show "—". Full form is hidden.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add overlay bar HTML and CSS"
```

---

## Task 3: Bar JS — Expand/Collapse, Phase Toggle, Live V-Speed Display

**Files:**
- Modify: `index.html` — append bar JS at the end of the `<script>` block

- [ ] **Step 1: Append bar JS to the end of the `<script>` block**

Add the following after the closing `}` of `fallbackCopy`:

```javascript
// ── Bar ────────────────────────────────────────────────────
const barAircraftEl = document.getElementById("bar-aircraft");
const barName1El    = document.getElementById("bar-name1");
const barName2El    = document.getElementById("bar-name2");
const barName3El    = document.getElementById("bar-name3");
const barVal1El     = document.getElementById("bar-val1");
const barVal2El     = document.getElementById("bar-val2");
const barVal3El     = document.getElementById("bar-val3");
const barExpandBtn  = document.getElementById("bar-expand-btn");
const phaseTakeoff  = document.getElementById("phase-takeoff");
const phaseLanding  = document.getElementById("phase-landing");
const appPanel      = document.getElementById("app");

let isExpanded = false;
let barPhase   = "takeoff"; // "takeoff" | "landing"

function updateBar() {
  const aircraft = aircraftEl.value.trim();
  barAircraftEl.textContent = aircraft || "— No aircraft —";

  const speeds = Object.entries(V_SPEEDS).find(
    ([k]) => k.toLowerCase() === aircraft.toLowerCase()
  )?.[1];

  if (barPhase === "takeoff") {
    barName1El.textContent = "V1";
    barName2El.textContent = "VR";
    barName3El.textContent = "V2";
    barVal1El.textContent = speeds ? `${speeds.v1} kts` : "—";
    barVal2El.textContent = speeds ? `${speeds.vr} kts` : "—";
    barVal3El.textContent = speeds ? `${speeds.v2} kts` : "—";
  } else {
    barName1El.textContent = "Vapp";
    barName2El.textContent = "Vref";
    barName3El.textContent = "";
    barVal1El.textContent = speeds ? `${speeds.vapp} kts` : "—";
    barVal2El.textContent = speeds ? `${speeds.vref} kts` : "—";
    barVal3El.textContent = "";
  }
}

function setExpanded(expanded) {
  isExpanded = expanded;
  appPanel.style.display = expanded ? "block" : "none";
  barExpandBtn.textContent = expanded ? "▲" : "▼";
  window.electronAPI?.resizeWindow(expanded);
}

function setBarPhase(newPhase) {
  barPhase = newPhase;
  phaseTakeoff.classList.toggle("active", barPhase === "takeoff");
  phaseLanding.classList.toggle("active", barPhase === "landing");
  updateBar();
}

barExpandBtn.addEventListener("click", () => setExpanded(!isExpanded));
phaseTakeoff.addEventListener("click", () => setBarPhase("takeoff"));
phaseLanding.addEventListener("click", () => setBarPhase("landing"));
aircraftEl.addEventListener("input",  updateBar);
aircraftEl.addEventListener("change", updateBar);

updateBar();
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected:
1. Clicking ▼ reveals the full form; clicking ▲ hides it
2. With form expanded, type "A350" in Aircraft field → bar immediately shows `V1 159 kts · VR 169 kts · V2 173 kts` and aircraft name updates to "A350"
3. Click 🛬 LANDING → bar switches to `Vapp 158 kts · Vref 153 kts`, third slot goes blank
4. Click 🛫 TAKEOFF → switches back to V1/VR/V2
5. Clicking Reset clears aircraft → bar reverts to "— No aircraft —" and dashes

- [ ] **Step 3: Verify in Electron**

```bash
npm start
```
Expected:
- Bar appears at top of screen, full screen width, always on top of other windows
- Clicking ▼ expands window to ~820px, showing full flight plan form + V-speed calculator
- Clicking ▲ collapses back to 52px bar
- Typing an aircraft in the expanded form updates the bar in real time
- The game / other apps are fully usable below the bar when collapsed

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: bar expand/collapse, phase toggle, live V-speed display"
```
