# ATC24 Flight Plan Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single `index.html` flight plan generator that produces a ready-to-copy `/createflightplan` command for ATC24.

**Architecture:** A self-contained HTML file with embedded CSS and JavaScript. The JS holds all airport data, handles region→airport dropdown filtering, generates the command string live as the user types, and copies it to clipboard on demand.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6+). No dependencies, no build tools.

---

## File Structure

| File | Purpose |
|---|---|
| `index.html` | Entire application — HTML structure, embedded `<style>`, embedded `<script>` |

---

## Task 1: HTML Skeleton

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html` with the basic shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ATC24 Flight Plan Generator</title>
  <style>
    /* styles added in Task 6 */
  </style>
</head>
<body>
  <div id="app">
    <h1>ATC24 Flight Plan Generator</h1>
    <form id="flight-form">
      <!-- fields added in Task 2 -->
    </form>
    <div id="output-section">
      <label>Generated Command</label>
      <div id="command-output"></div>
      <button type="button" id="copy-btn">Copy</button>
    </div>
  </div>
  <script>
    // JS added in Tasks 3–5
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `index.html` in a browser.
Expected: page loads, heading "ATC24 Flight Plan Generator" is visible, empty output section shows below.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add HTML skeleton"
```

---

## Task 2: Form Fields

**Files:**
- Modify: `index.html` — replace `<!-- fields added in Task 2 -->` inside `<form id="flight-form">`

- [ ] **Step 1: Add all form fields**

Replace `<!-- fields added in Task 2 -->` with:

```html
<div class="field-group">
  <label for="ingame-callsign">In-Game Callsign</label>
  <input type="text" id="ingame-callsign" placeholder="e.g. Striker 9212" />
</div>

<div class="field-group">
  <label for="callsign">Callsign</label>
  <input type="text" id="callsign" placeholder="e.g. VIR92" />
</div>

<div class="field-group">
  <label for="aircraft">Aircraft</label>
  <input type="text" id="aircraft" placeholder="e.g. A350" />
</div>

<div class="field-group">
  <label for="flight-rules">Flight Rules</label>
  <select id="flight-rules">
    <option value="">-- Select --</option>
    <option value="IFR">IFR</option>
    <option value="VFR">VFR</option>
  </select>
</div>

<div class="field-group">
  <label for="dep-region">Departing Region</label>
  <select id="dep-region">
    <option value="">-- Select Region --</option>
  </select>
</div>

<div class="field-group">
  <label for="dep-airport">Departing Airport</label>
  <select id="dep-airport" disabled>
    <option value="">-- Select Airport --</option>
  </select>
</div>

<div class="field-group">
  <label for="arr-region">Arriving Region</label>
  <select id="arr-region">
    <option value="">-- Select Region --</option>
  </select>
</div>

<div class="field-group">
  <label for="arr-airport">Arriving Airport</label>
  <select id="arr-airport" disabled>
    <option value="">-- Select Airport --</option>
  </select>
</div>

<div class="field-group">
  <label for="flight-level">Flight Level</label>
  <input type="number" id="flight-level" placeholder="e.g. 100" min="0" />
</div>

<div class="field-group">
  <label for="route">Route</label>
  <input type="text" id="route" placeholder="e.g. RDV" />
</div>
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected: all 10 fields are visible. Both region dropdowns show "-- Select Region --". Both airport dropdowns are disabled (greyed out).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add form fields"
```

---

## Task 3: Airport Data + Region→Airport Filtering

**Files:**
- Modify: `index.html` — replace `// JS added in Tasks 3–5` inside `<script>`

- [ ] **Step 1: Add airport data and region/airport population logic**

Replace `// JS added in Tasks 3–5` with:

```javascript
const AIRPORTS = {
  "Cyprus": [
    { name: "Barra Airport", icao: "IBAR" },
    { name: "Henstridge Airfield", icao: "IHEN" },
    { name: "Larnaca Intl.", icao: "ILAR" },
    { name: "Paphos Intl.", icao: "IPAP" },
  ],
  "Grindavik": [
    { name: "Keflavik Intl.", icao: "IKFL" },
    { name: "Pingeyri Airport", icao: "ITEY" },
  ],
  "Izolirani": [
    { name: "Al Najaf", icao: "IJAF" },
    { name: "Izolirani Intl.", icao: "ZOL" },
  ],
  "Orenji": [
    { name: "Bird Island Airfield", icao: "IBRD" },
    { name: "Saba Airport", icao: "IDCS" },
    { name: "Tokyo Intl.", icao: "ITKO" },
  ],
  "Perth": [
    { name: "Lukla Airport", icao: "ILKL" },
    { name: "Perth Intl.", icao: "IPPH" },
  ],
  "Rockford": [
    { name: "Boltic Airfield", icao: "IBLT" },
    { name: "Greater Rockford", icao: "IRFD" },
    { name: "Mellor Intl.", icao: "IMLR" },
    { name: "Training Centre", icao: "ITRC" },
  ],
  "Saint Barthelemy": [
    { name: "Saint Barthelemy", icao: "IBTH" },
    { name: "Skopelos Airfield", icao: "ISKP" },
  ],
  "Sauthamptona": [
    { name: "Sauthamptona Airport", icao: "ISAU" },
  ],
  "Airbases": [
    { name: "McConnell AFB", icao: "IIAB" },
    { name: "Air Base Garry", icao: "IGAR" },
    { name: "RAF Scampton", icao: "ISCM" },
  ],
};

function populateRegions(selectEl) {
  Object.keys(AIRPORTS).forEach(region => {
    const opt = document.createElement("option");
    opt.value = region;
    opt.textContent = region;
    selectEl.appendChild(opt);
  });
}

function populateAirports(regionSelectEl, airportSelectEl) {
  const region = regionSelectEl.value;
  airportSelectEl.innerHTML = '<option value="">-- Select Airport --</option>';
  if (!region) {
    airportSelectEl.disabled = true;
    return;
  }
  AIRPORTS[region].forEach(airport => {
    const opt = document.createElement("option");
    opt.value = airport.icao;
    opt.textContent = `${airport.name} (${airport.icao})`;
    airportSelectEl.appendChild(opt);
  });
  airportSelectEl.disabled = false;
}

const depRegionEl = document.getElementById("dep-region");
const depAirportEl = document.getElementById("dep-airport");
const arrRegionEl = document.getElementById("arr-region");
const arrAirportEl = document.getElementById("arr-airport");

populateRegions(depRegionEl);
populateRegions(arrRegionEl);

depRegionEl.addEventListener("change", () => populateAirports(depRegionEl, depAirportEl));
arrRegionEl.addEventListener("change", () => populateAirports(arrRegionEl, arrAirportEl));

// placeholders for Tasks 4–5
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected:
- Both region dropdowns list all 9 regions (Cyprus, Grindavik, Izolirani, Orenji, Perth, Rockford, Saint Barthelemy, Sauthamptona, Airbases)
- Selecting "Rockford" in the departing region enables the departing airport dropdown and shows: Boltic Airfield (IBLT), Greater Rockford (IRFD), Mellor Intl. (IMLR), Training Centre (ITRC)
- Departing and arriving region selectors are fully independent of each other
- Changing a region clears and repopulates the corresponding airport dropdown

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add airport data and region filtering"
```

---

## Task 4: Live Command Generation

**Files:**
- Modify: `index.html` — replace `// placeholders for Tasks 4–5` in `<script>`

- [ ] **Step 1: Add command generation and wire up listeners**

Replace `// placeholders for Tasks 4–5` with:

```javascript
const ingameCallsignEl = document.getElementById("ingame-callsign");
const callsignEl = document.getElementById("callsign");
const aircraftEl = document.getElementById("aircraft");
const flightRulesEl = document.getElementById("flight-rules");
const flightLevelEl = document.getElementById("flight-level");
const routeEl = document.getElementById("route");
const commandOutputEl = document.getElementById("command-output");

function buildCommand() {
  const ingameCallsign = ingameCallsignEl.value;
  const callsign = callsignEl.value;
  const aircraft = aircraftEl.value;
  const flightRules = flightRulesEl.value;
  const departing = depAirportEl.value;
  const arriving = arrAirportEl.value;
  const flightLevel = flightLevelEl.value;
  const route = routeEl.value;

  return `/createflightplan ingamecallsign:${ingameCallsign} callsign:${callsign} aircraft:${aircraft} flightrules:${flightRules} departing:${departing} arriving:${arriving} flightlevel:${flightLevel} route:${route}`;
}

function updateCommand() {
  commandOutputEl.textContent = buildCommand();
}

[ingameCallsignEl, callsignEl, aircraftEl, flightRulesEl,
 depAirportEl, arrAirportEl, flightLevelEl, routeEl
].forEach(el => el.addEventListener("input", updateCommand));

[depAirportEl, arrAirportEl, flightRulesEl
].forEach(el => el.addEventListener("change", updateCommand));

updateCommand();

// placeholder for Task 5
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected:
- Command output immediately shows `/createflightplan ingamecallsign: callsign: aircraft: flightrules: departing: arriving: flightlevel: route:` on load
- Typing "VIR92" in Callsign updates the command to `callsign:VIR92` instantly
- Selecting Rockford → Greater Rockford updates the command to `departing:IRFD`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add live command generation"
```

---

## Task 5: Copy Button

**Files:**
- Modify: `index.html` — replace `// placeholder for Task 5` in `<script>`

- [ ] **Step 1: Add copy-to-clipboard logic**

Replace `// placeholder for Task 5` with:

```javascript
const copyBtn = document.getElementById("copy-btn");

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(buildCommand()).then(() => {
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
  });
});
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Fill in a few fields. Expected:
- Clicking "Copy" copies the current command string to clipboard
- Button label changes to "Copied!" for 1.5 seconds then returns to "Copy"
- Paste into a text editor to confirm the command is correct

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add copy to clipboard"
```

---

## Task 6: CSS Styling

**Files:**
- Modify: `index.html` — replace `/* styles added in Task 6 */` inside `<style>`

- [ ] **Step 1: Add styles**

Replace `/* styles added in Task 6 */` with:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: #0d1117;
  color: #e6edf3;
  font-family: 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem 1rem;
}

#app {
  width: 100%;
  max-width: 680px;
}

h1 {
  font-size: 1.5rem;
  color: #58a6ff;
  margin-bottom: 1.5rem;
  letter-spacing: 0.03em;
}

#flight-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8b949e;
}

input, select {
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
}

input:focus, select:focus {
  border-color: #58a6ff;
}

select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

#output-section {
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 1rem;
}

#output-section label {
  display: block;
  margin-bottom: 0.5rem;
}

#command-output {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.9rem;
  color: #3fb950;
  word-break: break-all;
  margin-bottom: 0.75rem;
  min-height: 1.4em;
}

#copy-btn {
  background-color: #238636;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 1.1rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

#copy-btn:hover {
  background-color: #2ea043;
}

@media (max-width: 500px) {
  #flight-form {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected:
- Dark background (#0d1117) with a blue heading
- Form fields arranged in a 2-column grid
- Command output displayed in green monospace text
- Green "Copy" button at the bottom of the output section
- At < 500px width, form switches to single column

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add CSS styling"
```
