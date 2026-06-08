# TCAS / 24 Pilot Integration — Design Spec
**Date:** 2026-06-08

---

## Overview

Add a TCAS view to the large Flight Eye popup by introducing a two-tab interface. The first tab shows the existing Flight Eye map; the second tab shows the 24 Pilot site (https://24pilot.ptfsrp.com/) which has a built-in TCAS system for ATC24 pilots. The small bottom-right widget is unchanged.

---

## Scope

- **In scope:** Tab bar on the large popup (`flighteye-large.html`), two webviews (one per tab), tab switching
- **Out of scope:** Small widget changes, main bar changes, any custom TCAS logic, reading data from either site programmatically

---

## Design

### Tab Bar
A tab bar is inserted between the existing title bar and the webview content area in `flighteye-large.html`.

Two tabs:
| Tab | Label | Colour | URL |
|---|---|---|---|
| 1 (default) | 🗺 Flight Eye | Blue (`#58a6ff`) | `https://flighteye.org/flighteye/map` |
| 2 | 🛡 TCAS — 24 Pilot | Green (`#3fb950`) | `https://24pilot.ptfsrp.com/` |

The active tab has a coloured bottom border and coloured label. Inactive tabs are grey.

### Webview Strategy
Two `<webview>` elements are rendered simultaneously, stacked in the same content area. The active tab's webview has `display: block`; the inactive one has `display: none`. This avoids reloading the page on every tab switch — both sites stay live in the background once initially loaded.

### Tab Switching
Pure CSS class toggle + JS `display` swap. No IPC required — all logic stays in `flighteye-large.html`.

### Slide Animation
Active tab content fades in with a quick `opacity` + `translateY` transition (0.2s) matching the existing overlay animation style.

---

## Files Changed

| File | Change |
|---|---|
| `flighteye-large.html` | Add tab bar HTML + CSS, add second `<webview>`, add tab-switch JS |

No changes to `main.js`, `preload.js`, or `index.html`.

---

## Implementation Steps

1. Add tab bar HTML (two `.tab` divs) between `#titlebar` and the existing `<webview>`
2. Add CSS for tab bar, active/inactive states, and fade-in animation
3. Add second `<webview>` for 24 Pilot beneath the existing one
4. Add JS to toggle `display` on both webviews when a tab is clicked
5. Delete `mockup-tcas.html` (temp file)
