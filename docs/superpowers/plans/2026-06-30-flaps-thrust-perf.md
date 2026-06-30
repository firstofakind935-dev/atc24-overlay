# Flaps & Thrust Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add computed flap settings (takeoff/landing notch) and per-phase N1% thrust (Takeoff, Climb, Cruise, Descent, Landing) to the iPad — shown both on the Dispatch OFP and on a new dedicated Perf tab.

**Architecture:** A standalone pure module `perf.js` holds the per-aircraft baseline table and `computePerf(d, weights)`. `ipad.html` loads it via `<script src>` and calls it from the existing `renderDispatch`, passing the takeoff/landing weights it already computes; two render functions paint the Dispatch block and the Perf tab. `index.html` adds the raw runway strings to the dispatch payload so a deterministic runway factor can apply.

**Tech Stack:** Vanilla JS, Electron renderer (HTML files), Node `node:assert` for unit tests (no new dependencies).

---

## File Structure

- **Create** `perf.js` — `PERF` baseline table, `clamp`, `rwyFactor`, `computePerf`. Dual export: `module.exports` under Node, `window.PerfModel` in the renderer. Pure logic, no DOM.
- **Create** `test/perf.test.js` — zero-dependency Node tests for `computePerf` / `rwyFactor`.
- **Modify** `package.json` — add `"test"` script; add `perf.js` to `build.files`.
- **Modify** `index.html` — add `depRwy`/`arrRwy` to the dispatch payload.
- **Modify** `ipad.html` — load `perf.js`; new Perf tab markup + CSS; `[ FLAPS & THRUST ]` block on the OFP; `renderPerfDispatch` + `renderPerfTab`; lift weight locals in `renderDispatch` and call `computePerf`.

---

## Task 1: Pure performance module (`perf.js`) with unit tests

**Files:**
- Create: `test/perf.test.js`
- Create: `perf.js`
- Modify: `package.json` (scripts + build.files)

- [ ] **Step 1: Write the failing test**

Create `test/perf.test.js`:

```js
const assert = require('node:assert/strict');
const { computePerf, rwyFactor, PERF } = require('../perf.js');

// Nominal load (loadTO = loadLD = 0.85), no runway, no FL → baseline values
{
  const p = computePerf({ aircraft: 'B737' }, { tow: 85, ldw: 85, mtow: 100, mlw: 100 });
  assert.deepEqual(p, { toFlap: 1, ldgFlap: 5, n1: { to: 92, clb: 86, crz: 81, des: 40, ldg: 62 } });
}

// Heavy takeoff (loadTO 0.95 > 0.90) + high cruise FL (>=300)
{
  const p = computePerf({ aircraft: 'B737', fl: '350' }, { tow: 95, ldw: 85, mtow: 100, mlw: 100 });
  assert.equal(p.toFlap, 2);          // +1 notch when heavy
  assert.equal(p.ldgFlap, 5);
  assert.equal(p.n1.to, 94);          // round(92 + (0.95-0.85)*18)
  assert.equal(p.n1.clb, 88);         // round(86 + 0.10*6 + 1)
  assert.equal(p.n1.crz, 83);         // 81 + 2 (high FL)
}

// Light landing (loadLD 0.65 < 0.70) → one notch less landing flap + lower landing N1
{
  const p = computePerf({ aircraft: 'B737' }, { tow: 85, ldw: 65, mtow: 100, mlw: 100 });
  assert.equal(p.ldgFlap, 4);
  assert.equal(p.n1.ldg, 59);         // round(62 + (0.65-0.85)*10 - 1)
}

// Unknown aircraft → null
assert.equal(computePerf({ aircraft: 'F16' }, { tow: 50, ldw: 50, mtow: 100, mlw: 100 }), null);

// Missing weights → null
assert.equal(computePerf({ aircraft: 'B737' }, null), null);
assert.equal(computePerf({ aircraft: 'B737' }, { tow: 0, ldw: 0, mtow: 0, mlw: 0 }), null);

// rwyFactor is deterministic and 0-or-1
{
  const a = rwyFactor('27L'), b = rwyFactor('27L');
  assert.equal(a, b);
  assert.ok(a === 0 || a === 1);
  assert.equal(rwyFactor(''), 0);
  assert.equal(rwyFactor(undefined), 0);
}

// computePerf is deterministic for the same inputs (incl. runway)
{
  const d = { aircraft: 'A320', depRwy: '09R', fl: '120' };
  const w = { tow: 70, ldw: 60, mtow: 90, mlw: 80 };
  assert.deepEqual(computePerf(d, w), computePerf(d, w));
}

// All N1 outputs stay within [30, 100] even at extreme weight
for (const ac of Object.keys(PERF)) {
  const p = computePerf({ aircraft: ac, fl: '400' }, { tow: 999, ldw: 999, mtow: 100, mlw: 100 });
  for (const phase of ['to', 'clb', 'crz', 'des', 'ldg']) {
    assert.ok(p.n1[phase] >= 30 && p.n1[phase] <= 100, `${ac} ${phase}=${p.n1[phase]} out of band`);
  }
  assert.ok(p.toFlap >= 1 && p.toFlap <= PERF[ac].flapMax - 1, `${ac} toFlap out of band`);
}

console.log('perf.test.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/perf.test.js`
Expected: FAIL — `Cannot find module '../perf.js'`.

- [ ] **Step 3: Create the module**

Create `perf.js`:

```js
// Computed flap & thrust performance. Pure logic — no DOM.
// Estimates in the same spirit as the V-speed model: plausible, deterministic,
// driven by aircraft baseline + weight + runway + cruise FL. Not a real engine model.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // flapMax  = number of flap notches (landing/full = flapMax)
  // toFlapBase = baseline takeoff notch at nominal load
  // n1       = baseline thrust % per phase at nominal load (loadTO/LD = 0.85)
  const PERF = {
    'A220':    { flapMax: 4, toFlapBase: 1, n1: { to: 89, clb: 84, crz: 79, des: 37, ldg: 59 } },
    'A320':    { flapMax: 4, toFlapBase: 1, n1: { to: 90, clb: 85, crz: 80, des: 38, ldg: 60 } },
    'A330':    { flapMax: 4, toFlapBase: 2, n1: { to: 91, clb: 86, crz: 81, des: 38, ldg: 61 } },
    'A340':    { flapMax: 4, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 82, des: 38, ldg: 61 } },
    'A350':    { flapMax: 4, toFlapBase: 2, n1: { to: 90, clb: 85, crz: 80, des: 38, ldg: 60 } },
    'A380':    { flapMax: 4, toFlapBase: 2, n1: { to: 90, clb: 86, crz: 82, des: 38, ldg: 60 } },
    'BELUGAXL':{ flapMax: 4, toFlapBase: 2, n1: { to: 91, clb: 86, crz: 81, des: 38, ldg: 61 } },
    'B707':    { flapMax: 5, toFlapBase: 1, n1: { to: 92, clb: 87, crz: 82, des: 40, ldg: 62 } },
    'B727':    { flapMax: 5, toFlapBase: 2, n1: { to: 93, clb: 88, crz: 82, des: 40, ldg: 63 } },
    'B737':    { flapMax: 5, toFlapBase: 1, n1: { to: 92, clb: 86, crz: 81, des: 40, ldg: 62 } },
    'B747':    { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 83, des: 40, ldg: 62 } },
    'B757':    { flapMax: 5, toFlapBase: 1, n1: { to: 91, clb: 86, crz: 81, des: 40, ldg: 61 } },
    'B767':    { flapMax: 5, toFlapBase: 1, n1: { to: 91, clb: 86, crz: 81, des: 40, ldg: 61 } },
    'B777':    { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 83, des: 40, ldg: 62 } },
    'B787':    { flapMax: 5, toFlapBase: 2, n1: { to: 90, clb: 86, crz: 82, des: 39, ldg: 61 } },
    'ATR-72':  { flapMax: 3, toFlapBase: 1, n1: { to: 88, clb: 82, crz: 70, des: 35, ldg: 55 } },
    'CRJ700':  { flapMax: 4, toFlapBase: 1, n1: { to: 90, clb: 84, crz: 78, des: 37, ldg: 59 } },
    'Q400':    { flapMax: 3, toFlapBase: 1, n1: { to: 88, clb: 82, crz: 71, des: 35, ldg: 56 } },
    'L-1011':  { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 82, des: 40, ldg: 62 } },
    'DC-10':   { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 82, des: 40, ldg: 62 } },
    'MD-11':   { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 83, des: 40, ldg: 62 } },
    'MD-90':   { flapMax: 5, toFlapBase: 1, n1: { to: 91, clb: 86, crz: 81, des: 40, ldg: 61 } },
    'AN-22':   { flapMax: 3, toFlapBase: 1, n1: { to: 90, clb: 84, crz: 72, des: 36, ldg: 58 } },
    'AN-225':  { flapMax: 4, toFlapBase: 2, n1: { to: 93, clb: 88, crz: 84, des: 40, ldg: 63 } },
    'COMET':   { flapMax: 4, toFlapBase: 1, n1: { to: 90, clb: 85, crz: 80, des: 40, ldg: 60 } },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Deterministic per-runway nudge: 0 or +1, stable for a given runway string.
  function rwyFactor(rwy) {
    if (!rwy) return 0;
    let h = 0;
    const s = String(rwy).toUpperCase();
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2;
  }

  // d:       dispatch payload ({ aircraft, depRwy, arrRwy, fl, ... })
  // weights: { tow, ldw, mtow, mlw } in kg. Any falsy → null returned.
  function computePerf(d, weights) {
    const ac = ((d && d.aircraft) || '').toUpperCase();
    const base = PERF[ac];
    if (!base) return null;
    const w = weights || {};
    if (!w.tow || !w.ldw || !w.mtow || !w.mlw) return null;

    const loadTO = clamp(w.tow / w.mtow, 0.5, 1.05);
    const loadLD = clamp(w.ldw / w.mlw, 0.5, 1.05);
    const heavyTO = loadTO > 0.90;
    const lightLD = loadLD < 0.70;
    const rwyTO = rwyFactor(d && d.depRwy);
    const flHi = Number(d && d.fl) >= 300;

    const toFlap = clamp(base.toFlapBase + (heavyTO ? 1 : 0) + rwyTO, 1, base.flapMax - 1);
    const ldgFlap = base.flapMax - (lightLD ? 1 : 0);

    const n1 = {
      to:  clamp(Math.round(base.n1.to  + (loadTO - 0.85) * 18), 30, 100),
      clb: clamp(Math.round(base.n1.clb + (loadTO - 0.85) * 6 + (flHi ? 1 : 0)), 30, 100),
      crz: clamp(Math.round(base.n1.crz + (flHi ? 2 : 0)), 30, 100),
      des: clamp(Math.round(base.n1.des), 30, 100),
      ldg: clamp(Math.round(base.n1.ldg + (loadLD - 0.85) * 10 + (lightLD ? -1 : 0)), 30, 100),
    };

    return { toFlap, ldgFlap, n1 };
  }

  return { PERF, clamp, rwyFactor, computePerf };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/perf.test.js`
Expected: PASS — prints `perf.test.js: all assertions passed`.

- [ ] **Step 5: Wire up `npm test` and packaging**

In `package.json`, add a test script (under `"scripts"`, after `"dist"`):

```json
    "dist": "electron-builder --win --x64",
    "test": "node test/perf.test.js"
```

And add `perf.js` to `build.files` so it ships with the app:

```json
    "files": [
      "index.html",
      "main.js",
      "preload.js",
      "perf.js",
      "icon.png"
    ],
```

- [ ] **Step 6: Commit**

```bash
git add perf.js test/perf.test.js package.json
git commit -m "feat: add pure flap & thrust performance module with tests"
```

---

## Task 2: Send raw runway strings in the dispatch payload (`index.html`)

**Files:**
- Modify: `index.html` (the `sendDispatchData` call inside `updateCommand`, ~line 868)

- [ ] **Step 1: Add `depRwy`/`arrRwy` to the payload**

Find this block in `index.html`:

```js
      window.electronAPI?.sendDispatchData({
        callsign,
        ingame:   ingameCallsign,
        aircraft,
        rules:    flightRules,
        depName:  departing,
        depIcao:  getIcao(departing),
        arrName:  arriving,
        arrIcao:  getIcao(arriving),
        fl:       flightLevel,
        route,
        speeds,
        cargo:    isCargo,
        command:  allFilled ? buildCommand() : '',
      });
```

Replace it with (adds two fields; the runway inputs already trigger `updateCommand` on input, so no new listeners are needed):

```js
      window.electronAPI?.sendDispatchData({
        callsign,
        ingame:   ingameCallsign,
        aircraft,
        rules:    flightRules,
        depName:  departing,
        depIcao:  getIcao(departing),
        arrName:  arriving,
        arrIcao:  getIcao(arriving),
        fl:       flightLevel,
        route,
        speeds,
        depRwy:   depRunwayEl.value.trim(),
        arrRwy:   arrRunwayEl.value.trim(),
        cargo:    isCargo,
        command:  allFilled ? buildCommand() : '',
      });
```

- [ ] **Step 2: Verify the app still launches and dispatch still flows**

Run: `npm start`
Expected: app opens; expand the bar, pick an aircraft + airports + FL, open the iPad (📱) — the Dispatch sheet still renders as before (no visible change yet). Close the app.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: include raw runway strings in dispatch payload"
```

---

## Task 3: Perf tab markup, Dispatch block, and CSS (`ipad.html`)

**Files:**
- Modify: `ipad.html` (CSS before `</style>` ~line 897; tabbar ~line 924; Dispatch OFP ~line 1009; panels ~line 1035)

- [ ] **Step 1: Add the Perf tab button**

Find in the tab bar:

```html
  <div id="ipad-tabbar">
    <div class="ipad-tab active" data-tab="dispatch">📄 Dispatch</div>
    <div class="ipad-tab"        data-tab="boarding">🧳 Boarding</div>
```

Insert the Perf tab right after the Dispatch tab:

```html
  <div id="ipad-tabbar">
    <div class="ipad-tab active" data-tab="dispatch">📄 Dispatch</div>
    <div class="ipad-tab"        data-tab="perf">⚙ Perf</div>
    <div class="ipad-tab"        data-tab="boarding">🧳 Boarding</div>
```

- [ ] **Step 2: Add the `[ FLAPS & THRUST ]` block to the Dispatch OFP**

Find the end of the V-speeds section and the start of the ATC flight plan section:

```html
          <div class="ofp-sec">
            <div class="ofp-h">[ PERFORMANCE — V-SPEEDS / KT ]</div>
            <div class="ds-speeds">
              <div class="ds-speed"><div class="sp-name">V1</div><div class="sp-val" id="ds-v1">—</div></div>
              <div class="ds-speed"><div class="sp-name">VR</div><div class="sp-val" id="ds-vr">—</div></div>
              <div class="ds-speed"><div class="sp-name">V2</div><div class="sp-val" id="ds-v2">—</div></div>
              <div class="ds-speed"><div class="sp-name">VREF</div><div class="sp-val" id="ds-vref">—</div></div>
              <div class="ds-speed"><div class="sp-name">VAPP</div><div class="sp-val" id="ds-vapp">—</div></div>
            </div>
          </div>

          <div class="ofp-sec">
            <div class="ofp-h">[ ATC FLIGHT PLAN ]</div>
```

Insert a new section between them:

```html
          <div class="ofp-sec">
            <div class="ofp-h">[ PERFORMANCE — V-SPEEDS / KT ]</div>
            <div class="ds-speeds">
              <div class="ds-speed"><div class="sp-name">V1</div><div class="sp-val" id="ds-v1">—</div></div>
              <div class="ds-speed"><div class="sp-name">VR</div><div class="sp-val" id="ds-vr">—</div></div>
              <div class="ds-speed"><div class="sp-name">V2</div><div class="sp-val" id="ds-v2">—</div></div>
              <div class="ds-speed"><div class="sp-name">VREF</div><div class="sp-val" id="ds-vref">—</div></div>
              <div class="ds-speed"><div class="sp-name">VAPP</div><div class="sp-val" id="ds-vapp">—</div></div>
            </div>
          </div>

          <div class="ofp-sec">
            <div class="ofp-h">[ FLAPS &amp; THRUST ]</div>
            <div class="ofp-row"><span class="k">T/O FLAPS</span><span class="v" id="dsp-toflap">—</span></div>
            <div class="ofp-row"><span class="k">LDG FLAPS</span><span class="v" id="dsp-ldgflap">—</span></div>
            <div class="ds-speeds" style="margin-top:7px">
              <div class="ds-speed"><div class="sp-name">T/O</div><div class="sp-val" id="dsp-n1-to">—</div></div>
              <div class="ds-speed"><div class="sp-name">CLB</div><div class="sp-val" id="dsp-n1-clb">—</div></div>
              <div class="ds-speed"><div class="sp-name">CRZ</div><div class="sp-val" id="dsp-n1-crz">—</div></div>
              <div class="ds-speed"><div class="sp-name">DES</div><div class="sp-val" id="dsp-n1-des">—</div></div>
              <div class="ds-speed"><div class="sp-name">LDG</div><div class="sp-val" id="dsp-n1-ldg">—</div></div>
            </div>
          </div>

          <div class="ofp-sec">
            <div class="ofp-h">[ ATC FLIGHT PLAN ]</div>
```

- [ ] **Step 3: Add the Perf panel markup**

Find the closing of the Dispatch panel and the start of the Checklist panel:

```html
        </div>
      </div>
    </div>

    <!-- CHECKLIST -->
    <div class="panel" id="panel-checklist">
```

Insert the Perf panel between the Dispatch panel's closing `</div>` and the `<!-- CHECKLIST -->` comment:

```html
        </div>
      </div>
    </div>

    <!-- PERF -->
    <div class="panel" id="panel-perf">
      <div id="perf-placeholder">
        <div class="ph-icon">⚙</div>
        <p>Select an aircraft in the flight plan generator to compute flap &amp; thrust settings.</p>
      </div>
      <div id="perf-body">
        <div class="perf-flaps">
          <div class="perf-flap-card"><div class="lbl">T/O Flaps</div><div class="val">FLAPS <span id="perf-toflap">—</span></div></div>
          <div class="perf-flap-card"><div class="lbl">LDG Flaps</div><div class="val">FLAPS <span id="perf-ldgflap">—</span></div></div>
        </div>
        <div class="perf-sched">
          <div class="perf-sched-title">Thrust Schedule — N1</div>
          <div class="perf-row"><span class="ph">🛫 Takeoff</span><span class="n1" id="perf-n1-to">—</span></div>
          <div class="perf-row"><span class="ph">⬆ Climb</span><span class="n1" id="perf-n1-clb">—</span></div>
          <div class="perf-row"><span class="ph">✈ Cruise</span><span class="n1" id="perf-n1-crz">—</span></div>
          <div class="perf-row"><span class="ph">⬇ Descent</span><span class="n1" id="perf-n1-des">—</span></div>
          <div class="perf-row"><span class="ph">🛬 Landing</span><span class="n1" id="perf-n1-ldg">—</span></div>
        </div>
        <div class="perf-basis" id="perf-basis"></div>
      </div>
    </div>

    <!-- CHECKLIST -->
    <div class="panel" id="panel-checklist">
```

- [ ] **Step 4: Add Perf CSS**

Find the end of the boarding styles, just before the closing `</style>` (the last rule before `</style>` is `.bd-count-label.secured`). Insert this block immediately before `</style>`:

```css
    /* ════════════════════════════════════
       PERF PANEL
    ════════════════════════════════════ */
    #panel-perf {
      overflow-y: auto;
      background: #0d1117;
      padding: 16px;
      scrollbar-width: thin;
      scrollbar-color: #30363d transparent;
    }
    #panel-perf::-webkit-scrollbar { width: 4px; }
    #panel-perf::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

    #perf-placeholder {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #8b949e;
      text-align: center;
    }
    #perf-placeholder .ph-icon { font-size: 2.5rem; }
    #perf-placeholder p { font-size: 0.82rem; line-height: 1.5; max-width: 260px; }

    #perf-body { display: none; }

    .perf-flaps { display: flex; gap: 8px; margin-bottom: 14px; }
    .perf-flap-card {
      flex: 1;
      text-align: center;
      padding: 10px 0;
      border-radius: 8px;
      border: 1px solid #30363d;
      background: #161b22;
    }
    .perf-flap-card .lbl {
      font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: #8b949e;
    }
    .perf-flap-card .val {
      font-size: 1.6rem; font-weight: 900; color: #3fb950; line-height: 1.1; margin-top: 2px;
    }

    .perf-sched { border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
    .perf-sched-title {
      background: #161b22; padding: 7px 12px;
      font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase;
      color: #58a6ff; font-weight: 700; border-bottom: 1px solid #30363d;
    }
    .perf-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px; font-size: 0.82rem; color: #e6edf3;
      border-bottom: 1px solid #161b22;
    }
    .perf-row:last-child { border-bottom: none; }
    .perf-row .ph { color: #8b949e; }
    .perf-row .n1 {
      font-family: 'Consolas', monospace; font-weight: 700; color: #e6edf3;
      font-variant-numeric: tabular-nums;
    }
    .perf-basis { margin-top: 12px; font-size: 0.68rem; color: #8b949e; text-align: center; }
```

- [ ] **Step 5: Commit**

```bash
git add ipad.html
git commit -m "feat: add Perf tab markup, dispatch flaps/thrust block, and styles"
```

---

## Task 4: Load the module and render the values (`ipad.html`)

**Files:**
- Modify: `ipad.html` (script include ~line 1197; `renderDispatch` weights block ~line 1359; new render functions after `renderDispatch`)

- [ ] **Step 1: Load `perf.js` before the inline script**

Find the start of the inline script:

```html
  <script>
    // ── Status bar clock ─────────────────────────────────────────────────────
```

Add the module script tag immediately before it:

```html
  <script src="perf.js"></script>
  <script>
    // ── Status bar clock ─────────────────────────────────────────────────────
```

- [ ] **Step 2: Lift weight locals and compute perf inside `renderDispatch`**

In `renderDispatch`, find the weights block. Change the two `MAX` DOM writes to use named locals, and capture the planned weights. Find:

```js
        const oew     = bs.oew;
        const zfw     = oew + payload;
        const taxi    = Math.round(fu.block * 0.03);
        const tof     = fu.block - taxi;          // takeoff fuel
        const tow     = zfw + tof;
        const ldw     = tow - fu.trip;
```

Replace with (adds `mtow`/`mlw` locals and assigns the outer `perfWeights`):

```js
        const oew     = bs.oew;
        const zfw     = oew + payload;
        const taxi    = Math.round(fu.block * 0.03);
        const tof     = fu.block - taxi;          // takeoff fuel
        const tow     = zfw + tof;
        const ldw     = tow - fu.trip;
        const mtow    = oew * 1.95;
        const mlw     = oew * 1.55;
        perfWeights = { tow, ldw, mtow, mlw };
```

Then find these two lines in the same block:

```js
        document.getElementById('w-mtow').textContent    = fmt(oew * 1.95);
```
Replace with:
```js
        document.getElementById('w-mtow').textContent    = fmt(mtow);
```

```js
        document.getElementById('w-mlw').textContent     = fmt(oew * 1.55);
```
Replace with:
```js
        document.getElementById('w-mlw').textContent     = fmt(mlw);
```

Next, declare `perfWeights` before the `if (bs && fu)` line. Find:

```js
      const wIds = ['w-oew','w-pax','w-cargo','w-payload','w-zfw','w-mzfw','w-tof','w-tow','w-mtow','w-ldw'];
      const fIds = ['f-trip','f-cont','f-altn','f-res','f-block','f-trip-t','f-cont-t','f-altn-t','f-res-t','f-block-t'];

      if (bs && fu) {
```

Replace with:

```js
      const wIds = ['w-oew','w-pax','w-cargo','w-payload','w-zfw','w-mzfw','w-tof','w-tow','w-mtow','w-ldw'];
      const fIds = ['f-trip','f-cont','f-altn','f-res','f-block','f-trip-t','f-cont-t','f-altn-t','f-res-t','f-block-t'];

      let perfWeights = null;
      if (bs && fu) {
```

Finally, render perf after the weights `if/else`. Find:

```js
      document.getElementById('sig-pic').textContent = d.ingame || d.callsign || '—';
```

Insert immediately before that line:

```js
      const perf = window.PerfModel ? window.PerfModel.computePerf(d, perfWeights) : null;
      renderPerfDispatch(perf);
      renderPerfTab(d, perf, perfWeights);

```

- [ ] **Step 3: Add the two render functions**

Find the end of `renderDispatch` and the line that registers it:

```js
      const hasData = d.callsign || d.depName || d.arrName;
      document.getElementById('dispatch-placeholder').style.display = hasData ? 'none' : 'flex';
      document.getElementById('dispatch-sheet').style.display = hasData ? 'block' : 'none';
    }

    window.ipadAPI?.onDispatchData(renderDispatch);
```

Insert the two functions between the closing `}` of `renderDispatch` and the `window.ipadAPI?.onDispatchData(...)` line:

```js
      const hasData = d.callsign || d.depName || d.arrName;
      document.getElementById('dispatch-placeholder').style.display = hasData ? 'none' : 'flex';
      document.getElementById('dispatch-sheet').style.display = hasData ? 'block' : 'none';
    }

    // Fill the [ FLAPS & THRUST ] block on the dispatch OFP
    function renderPerfDispatch(perf) {
      const f = (v) => (v || v === 0) ? v : '—';
      const n = (perf && perf.n1) || {};
      document.getElementById('dsp-toflap').textContent  = perf ? perf.toFlap  : '—';
      document.getElementById('dsp-ldgflap').textContent = perf ? perf.ldgFlap : '—';
      document.getElementById('dsp-n1-to').textContent   = f(n.to);
      document.getElementById('dsp-n1-clb').textContent  = f(n.clb);
      document.getElementById('dsp-n1-crz').textContent  = f(n.crz);
      document.getElementById('dsp-n1-des').textContent  = f(n.des);
      document.getElementById('dsp-n1-ldg').textContent  = f(n.ldg);
    }

    // Fill the dedicated Perf tab
    function renderPerfTab(d, perf, weights) {
      const ph   = document.getElementById('perf-placeholder');
      const body = document.getElementById('perf-body');
      if (!perf) { ph.style.display = 'flex'; body.style.display = 'none'; return; }
      ph.style.display = 'none'; body.style.display = 'block';

      document.getElementById('perf-toflap').textContent  = perf.toFlap;
      document.getElementById('perf-ldgflap').textContent = perf.ldgFlap;
      document.getElementById('perf-n1-to').textContent   = `${perf.n1.to}% N1`;
      document.getElementById('perf-n1-clb').textContent  = `${perf.n1.clb}% N1`;
      document.getElementById('perf-n1-crz').textContent  = `${perf.n1.crz}% N1`;
      document.getElementById('perf-n1-des').textContent  = `${perf.n1.des}% N1`;
      document.getElementById('perf-n1-ldg').textContent  = `${perf.n1.ldg}% N1`;

      const parts = [];
      if (weights && weights.tow) parts.push(`TOW ${Math.round(weights.tow).toLocaleString('en-US')} kg`);
      const rwy = ((d && d.depRwy) || '').trim();
      if (rwy) parts.push(`RWY ${rwy.toUpperCase()}`);
      if (d && d.fl) parts.push(`FL${d.fl}`);
      document.getElementById('perf-basis').textContent = parts.length ? `Based on ${parts.join(' · ')}` : '';
    }

    window.ipadAPI?.onDispatchData(renderDispatch);
```

- [ ] **Step 4: Manual verification in the running app**

Run: `npm start`
Then:
1. Expand the overlay bar, set: Aircraft `B737`, both regions/airports, Flight Level `350`, Departure Runway `27L`.
2. Click 📱 iPad → **Dispatch** tab: the `[ FLAPS & THRUST ]` block shows a `T/O FLAPS`, `LDG FLAPS`, and five N1 numbers (not all `—`).
3. Click the **⚙ Perf** tab: two flap cards + the five-row thrust schedule are populated, and the footer reads e.g. `Based on TOW … kg · RWY 27L · FL350`.
4. Change the aircraft to `A320` and confirm both the Dispatch block and Perf tab update together.
5. Clear the Aircraft field → Perf tab shows the placeholder.

Expected: all of the above hold; no console errors (open DevTools if unsure).

- [ ] **Step 5: Commit**

```bash
git add ipad.html
git commit -m "feat: compute and render flaps/thrust on dispatch sheet and Perf tab"
```

---

## Task 5: Full verification and wrap-up

- [ ] **Step 1: Run the unit tests**

Run: `npm test`
Expected: PASS — `perf.test.js: all assertions passed`.

- [ ] **Step 2: Final manual smoke test**

Run: `npm start`. Verify a freighter (`AN-225`, set Flight Type → 📦 Cargo in the bar) also produces flap/thrust numbers on both the Dispatch block and Perf tab (weight-driven path works for freight). Close the app.

- [ ] **Step 3: Confirm clean tree**

Run: `git status`
Expected: working tree clean (all changes committed).

---

## Self-Review Notes

- **Spec coverage:** flaps (notch) ✓ Task 1/3/4; per-phase N1 incl. takeoff & landing thrust ✓ Task 1/3/4; drivers aircraft+weight+runway+FL ✓ Task 1 (`computePerf`), Task 2 (runway payload); Dispatch block + Perf tab (option C) ✓ Task 3/4; no main-bar changes ✓; no nominal-load fallback needed ✓ (perf shows under the same `bs && fu` guard as weights).
- **Determinism:** runway factor reuses the hash approach from the V-speed model; tested for stability.
- **Naming consistency:** `computePerf`, `PERF`, `rwyFactor`, `renderPerfDispatch`, `renderPerfTab`, `perfWeights`, and the `dsp-*` / `perf-*` element ids are used identically across tasks.
