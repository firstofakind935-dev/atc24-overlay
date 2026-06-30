# Flaps & Thrust Performance — Design

**Date:** 2026-06-30
**Status:** Approved design — pending implementation plan

## Summary

Add a computed performance reference to the iPad: **flap settings** (takeoff
notch + landing notch) and **N1% thrust** for five phases (Takeoff, Climb,
Cruise, Descent, Landing). Values are derived live from the aircraft baseline,
the planned takeoff/landing weight, the runway, and the cruise flight level —
the same "plausible estimate" philosophy already used by the V-speed model.

The result appears in two places:

1. A compact `[ FLAPS & THRUST ]` block on the iPad **Dispatch** OFP sheet,
   under the existing V-speeds.
2. A dedicated **Perf** iPad tab with flap cards and a phase-by-phase thrust
   schedule.

All work is contained in `ipad.html`, plus one small payload addition in
`index.html`. No changes to the main bar UI, ATC station, or scope window.

## Goals / Non-goals

**Goals**
- Per-phase N1% thrust and takeoff/landing flap notch, computed from real
  inputs already in the app.
- Read the same planned weights the Dispatch sheet already uses, so the numbers
  agree across tabs.
- Degrade gracefully (unknown aircraft → placeholder; missing runway/FL → those
  factors contribute zero).

**Non-goals**
- No real engine/aero model. Numbers are intentionally plausible estimates,
  consistent with the existing V-speed disclaimer ("Estimated from aircraft type
  + runway").
- No TOGA/FLEX rating, no FLEX temperature, no derate label — takeoff thrust is
  expressed solely as N1%.
- No manufacturer-specific flap configs — a generic notch number for every
  aircraft.
- No main-bar changes; no new windows.

## Inputs (drivers)

| Driver | Source | Effect |
|---|---|---|
| Aircraft baseline | new `PERF` table keyed by aircraft (UPPER) | base flap notches + base N1 per phase |
| Takeoff weight (TOW) | computed in `renderDispatch` from `bdState` + `estimateFuel` | heavier → more T/O flap, higher T/O & climb N1 |
| Landing weight (LDW) | computed in `renderDispatch` | heavier → more landing N1; lighter → one notch less landing flap |
| Runway (dep/arr) | **new** `depRwy`/`arrRwy` strings added to dispatch payload | deterministic ±0/+1 notch nudge via existing hash idea |
| Cruise FL | `d.fl` (already in payload) | higher FL → slightly higher climb & cruise N1 |

**Weight availability.** `bdState` is computed automatically by `bdOnFlight(d)`
whenever a known aircraft is set, and the Dispatch sheet's weights use the
*planned* target (`bs.target`), not the live boarded count. Therefore TOW/LDW are
available whenever the Dispatch weights are (`bs && fu`). Perf shows under exactly
the same condition — no separate "nominal load" fallback is required.

## Architecture & data flow

```
index.html (main bar)
  updateCommand() → sendDispatchData({ ..., fl, speeds, depRwy, arrRwy })   ← ADD depRwy/arrRwy
        │  IPC 'dispatch-data'  (cached in main.js as lastDispatchData)
        ▼
ipad.html
  onDispatchData(renderDispatch)
        renderDispatch(d):
          bdOnFlight(d)                       // refresh bdState (existing)
          ...compute TOW/LDW/MTOW/MLW (existing weights block)...
          const perf = computePerf(d, bdState, { tow, ldw, mtow, mlw })   ← NEW
          renderPerfDispatch(perf)            // fills [ FLAPS & THRUST ] block on OFP  ← NEW
          renderPerfTab(d, perf, inputs)      // fills the Perf tab                     ← NEW
```

`computePerf` is a **pure function** — no DOM, no globals — so it is independently
testable. The two render functions only write to the DOM.

To avoid recomputing weights, `renderDispatch` will capture the TOW/LDW/MTOW/MLW
it already calculates into locals and pass them to `computePerf`. (Today those
values are written straight to DOM via `fmt(...)`; we lift them into named
variables first, then both the existing weight block and `computePerf` use them.)

## Computation model (`computePerf`)

### Baseline table

A new `PERF` const alongside `ACFT`, one entry per aircraft (24 rows), e.g.:

```js
const PERF = {
  // flapMax = number of flap notches (landing/full = flapMax)
  // n1: baseline % for each phase at nominal load
  'A350': { flapMax: 4, toFlapBase: 2, n1: { to: 90, clb: 85, crz: 80, des: 38, ldg: 60 } },
  'B737': { flapMax: 5, toFlapBase: 1, n1: { to: 92, clb: 86, crz: 81, des: 40, ldg: 62 } },
  'ATR-72':{ flapMax: 3, toFlapBase: 1, n1: { to: 88, clb: 82, crz: 70, des: 35, ldg: 55 } },
  // ...all 24 aircraft, props get lower cruise N1
};
```

Baselines are authored by category (super / heavy / narrowbody / regional-prop),
mirroring how `estimateFuel` and the V-speed table already bucket aircraft.

### Derived factors

```js
const loadTO = clamp(tow / mtow, 0.5, 1.05);   // 1.0 ≈ at MTOW
const loadLD = clamp(ldw / mlw, 0.5, 1.05);
const heavyTO = loadTO > 0.90;                  // near max → more flap
const lightLD = loadLD < 0.70;                  // light → one notch less landing flap
const rwyTO = rwyFactor(d.depRwy);              // 0 or +1, deterministic per runway
const rwyLD = rwyFactor(d.arrRwy);
const flHi  = Number(d.fl) >= 300;              // high cruise → small N1 bump
```

`rwyFactor(rwy)` reuses the existing deterministic-hash approach from
`index.html`'s `rwyAdjust` (a given runway string always yields the same nudge,
so values are stable rather than random). Empty runway → 0.

### Outputs

```js
toFlap = clamp(base.toFlapBase + (heavyTO ? 1 : 0) + rwyTO, 1, base.flapMax - 1);
ldgFlap = base.flapMax - (lightLD ? 1 : 0);

n1.to  = round(base.n1.to  + (loadTO - 0.85) * 18);   // ~85–96, heavier → higher
n1.clb = round(base.n1.clb + (loadTO - 0.85) * 6 + (flHi ? 1 : 0));
n1.crz = round(base.n1.crz + (flHi ? 2 : 0));
n1.des = base.n1.des;                                  // ~idle, condition-independent
n1.ldg = round(base.n1.ldg + (loadLD - 0.85) * 10 + (lightLD ? -1 : 0));
```

All N1 outputs clamped to a sane band (e.g. `clamp(x, 30, 100)`). Exact
coefficients will be tuned during implementation so the bands land where the
table comments claim; the structure above is the contract.

Returns:
```js
{ toFlap, ldgFlap, n1: { to, clb, crz, des, ldg } }   // or null if aircraft unknown
```

## UI

### Dispatch OFP block (`renderPerfDispatch`)

A new `ofp-sec` inserted after the existing `[ PERFORMANCE — V-SPEEDS / KT ]`
section in the `dispatch-sheet` markup:

```
[ FLAPS & THRUST ]
T/O FLAPS  2          LDG FLAPS  4
N1  T/O 92  CLB 85  CRZ 80  DES 38  LDG 61
```

Styled with the existing `ofp-h` / `ofp-row` / `ds-speeds` classes (no new CSS).
Shows "—" when `perf` is null, matching the rest of the sheet.

### Perf tab (`renderPerfTab`)

- New tab button in `#ipad-tabbar`: `⚙ Perf` (placed after Dispatch).
- New `<div class="panel" id="panel-perf">` with:
  - Two flap cards (T/O notch, LDG notch) — reuse the boarding `bd-zone`/card
    visual language so it fits the dark theme.
  - A 5-row thrust schedule (Takeoff → Landing) showing `NN% N1` per phase.
  - A footer line describing the inputs used:
    *"Based on TOW 78,300 kg · RWY 27L · FL350"* (omit pieces that are absent).
  - Placeholder (reuse the boarding/dispatch placeholder pattern) when aircraft
    is unknown.
- Tab wiring: add `if (t === 'perf') renderPerfTab(...)` to the existing tab
  click handler so it lazy-renders, and it also updates on every
  `dispatch-data` via `renderDispatch`.
- A modest amount of new CSS for `#panel-perf` (cards + schedule rows),
  following the existing boarding/loadsheet styles.

## Payload change (`index.html`)

In `sendDispatchData` (inside `updateCommand`), add the raw runway strings:

```js
window.electronAPI?.sendDispatchData({
  ...,
  depRwy: depRunwayEl.value.trim(),
  arrRwy: arrRunwayEl.value.trim(),
});
```

These are independent of the already-sent runway-*adjusted* `speeds`. No other
main-bar change. `main.js` forwards the payload unchanged (and caches it), so no
main-process change is required.

## Edge cases

| Situation | Behavior |
|---|---|
| Unknown / empty aircraft | `computePerf` returns null → Dispatch block shows "—", Perf tab shows placeholder |
| No runway entered | `rwyFactor` = 0; flaps/thrust use baseline + weight/FL only |
| No FL entered | `flHi` = false; no cruise/climb bump |
| FL present but weights unavailable | Same `bs && fu` guard as the weights block — Perf shows "—" / placeholder (rare, since bdState auto-computes) |
| Cargo/freighter aircraft | Uses freight TOW/LDW already produced by the weights block; flap/thrust formulas are weight-driven and work unchanged |

## Testing

`computePerf` is pure and table-driven, so verify by calling it with crafted
inputs (no Electron needed):

- Known light aircraft at low load + long-ish runway → lower T/O flap notch and
  lower T/O N1 than the same aircraft near MTOW.
- Landing flap drops exactly one notch when `loadLD < 0.70`, else equals
  `flapMax`.
- High FL (≥300) raises cruise N1 by the fixed bump; FL absent leaves it at base.
- Unknown aircraft → returns null.
- All N1 outputs stay within the clamp band for extreme weights.
- Same runway string always yields the same factor (determinism).

Manual smoke test in the running app: pick an aircraft, confirm the Dispatch
block and Perf tab agree and update together as aircraft/runway/FL change.

## Files touched

- `ipad.html` — `PERF` table, `computePerf`, `renderPerfDispatch`,
  `renderPerfTab`; new Perf tab markup + CSS; tab wiring; lift TOW/LDW locals in
  `renderDispatch`; new `[ FLAPS & THRUST ]` block in the OFP.
- `index.html` — add `depRwy`/`arrRwy` to the dispatch payload.
- `.gitignore` — add `.superpowers/`.
