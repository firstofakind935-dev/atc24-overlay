# ATC24 Flight Plan Generator — Design Spec

**Date:** 2026-06-06  
**Status:** Approved

---

## Overview

A custom flight plan generator for the game ATC24. The user fills in a form with flight details and the app produces a ready-to-copy `/createflightplan` command to paste directly into the game.

---

## Platform

- **Phase 1:** Single `index.html` file — HTML, CSS, and vanilla JavaScript. No build tools, no dependencies. Opens in any browser.
- **Phase 2 (future):** Wrap in Electron or Tauri for a proper desktop app once features are finalised.

---

## Form Fields

| Field | Input Type | Notes |
|---|---|---|
| In-Game Callsign | Text | e.g. `Striker 9212` |
| Callsign | Text | e.g. `VIR92` |
| Aircraft | Text | e.g. `A350`, `B737` |
| Flight Rules | Dropdown | IFR / VFR |
| Departing Region | Dropdown | Filters the Departing Airport dropdown |
| Departing Airport | Dropdown | Shows full name + ICAO code, outputs ICAO code |
| Arriving Region | Dropdown | Filters the Arriving Airport dropdown |
| Arriving Airport | Dropdown | Shows full name + ICAO code, outputs ICAO code |
| Flight Level | Number | e.g. `100` for FL100 |
| Route | Text | Waypoints, e.g. `RDV` |

Departing and Arriving each have their own independent region selector.

---

## Output Command Format

```
/createflightplan ingamecallsign:<value> callsign:<value> aircraft:<value> flightrules:<value> departing:<ICAO> arriving:<ICAO> flightlevel:<value> route:<value>
```

Example:
```
/createflightplan ingamecallsign:Striker 9212 callsign:VIR92 aircraft:A350 flightrules:IFR departing:IRFD arriving:ITKO flightlevel:100 route:RDV
```

The command preview updates live as the user types. A **Copy** button copies the full command to clipboard and briefly shows "Copied!" as confirmation.

---

## Airport Data

Airports are grouped by region. The region dropdown filters the airport dropdown. Each airport entry displays as `Full Name (ICAO)` in the UI but only the ICAO code is written into the command.

### Cyprus
| Airport Name | ICAO Code |
|---|---|
| Barra Airport | IBAR |
| Henstridge Airfield | IHEN |
| Larnaca Intl. | ILAR |
| Paphos Intl. | IPAP |

### Grindavik
| Airport Name | ICAO Code |
|---|---|
| Keflavik Intl. | IKFL |
| Pingeyri Airport | ITEY |

### Izolirani
| Airport Name | ICAO Code |
|---|---|
| Al Najaf | IJAF |
| Izolirani Intl. | ZOL |

### Orenji
| Airport Name | ICAO Code |
|---|---|
| Bird Island Airfield | IBRD |
| Saba Airport | IDCS |
| Tokyo Intl. | ITKO |

### Perth
| Airport Name | ICAO Code |
|---|---|
| Lukla Airport | ILKL |
| Perth Intl. | IPPH |

### Rockford
| Airport Name | ICAO Code |
|---|---|
| Boltic Airfield | IBLT |
| Greater Rockford | IRFD |
| Mellor Intl. | IMLR |
| Training Centre | ITRC |

### Saint Barthelemy
| Airport Name | ICAO Code |
|---|---|
| Saint Barthelemy | IBTH |
| Skopelos Airfield | ISKP |

### Sauthamptona
| Airport Name | ICAO Code |
|---|---|
| Sauthamptona Airport | ISAU |

### Airbases
| Airport Name | ICAO Code |
|---|---|
| McConnell AFB | IIAB |
| Air Base Garry | IGAR |
| RAF Scampton | ISCM |

---

## Architecture

Everything lives in a single `index.html` file:

- **HTML** — form layout and output area
- **CSS** — styling (embedded in `<style>` tag)
- **JS** — airport data, event listeners, live command generation, clipboard copy (embedded in `<script>` tag)

The airport data is a plain JS object keyed by region name, each containing an array of `{ name, icao }` entries. When the user selects a region, the corresponding airport dropdown is rebuilt from that array.

---

## Key Behaviours

- Command preview updates on every input/change event — no submit button needed
- Copy button uses the `navigator.clipboard.writeText` API; button label briefly changes to "Copied!" then resets after 1.5 seconds
- If any field is empty, the command still renders with blank values (no validation blocking the copy — the user decides when it's ready)

---

## Out of Scope (Phase 1)

- Saved/history of past flight plans
- Random flight plan generation
- Desktop packaging (Electron/Tauri)
- Backend or server of any kind
