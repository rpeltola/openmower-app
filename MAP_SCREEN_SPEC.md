# Map SCREEN feature-completeness — build spec (map builder, after editor + settings)

These are the remaining Map gaps from the full concept audit that live in files YOU own
(`MapCanvas.tsx`, `Map.tsx`, `map/**`) — so they route through you, not a parallel agent. Tackle
these AFTER the editor batches (MAP_EDITOR_SPEC.md) and the area-settings panel (AREA_SETTINGS_SPEC.md).
All data MOCK. Concept files: `../ux-research/docs/concept/openmower-app-concept.html` (mobile) +
`openmower-desktop-concept.html` (desktop).

## S1 — Live coverage-lane painting (concept "2 · LIVE MOW" / desktop "Map · live mow")
Add a **mowed-coverage layer** on MapCanvas: painted lanes showing progress-so-far, clipped to the
mowing zone, drawn in the fixed `--mowed`-equivalent color (readable on satellite; keep map colors
theme-independent). Mock a set of covered lanes for the active mow zone. This is the concept's
headline "progress you can watch" — currently absent from the real map. Toggle with edit mode (hidden
while editing).

## S2 — Position-uncertainty ring on the robot
Render a dashed uncertainty ring around the robot footprint (radius from a mock accuracy value).
Normal = accent, subtle; in a paused/RTK-lost state = larger, warn-colored (see S6). Pause the
animation when the tab is hidden.

## S3 — Create-object menu + full object-type set (concept "Map — create-object menu")
- Add a "＋ / Add to map" affordance (the concept's accent create button in edit mode) opening an
  **"Add to map" sheet** listing 5 object types: **Mowing area · No-go zone · Docking station ·
  Spot-mow region · Pathway**. Selecting one creates that object (square-at-center or draw), then
  drops into editing it.
- Extend the zone model beyond `mow|nav|obstacle`: add **docking-station** (point object, movable —
  you already have a dock marker; make it an editable object) and **spot-mow region** (a one-off mow
  patch). "Pathway" == the existing `nav` type (label it Pathway in UI). Keep colors fixed.

## S4 — Desktop "Areas" list panel (concept desktop "Map · live mow" right rail)
On desktop live-view (not editing), show a right-hand **Areas** panel: each area with name, size,
status (Mowing/Queued + %), a per-area **Mow** button, and a footer **Mow all now**. Mobile keeps the
floating stat card as-is. Mock data.

## S5 — Live-view Pause button (desktop concept has Pause alongside Stop)
Add a **Pause** action next to the existing "Stop & hold position" in the live-view stat card /
desktop card. Mock (toggles a paused visual). 

## S6 — Paused / blockers-as-data on the REAL map (concept "Map · blockers as data" / desktop "Map · paused state")
Give Map.tsx a paused/blocked rendering path (mock a `blocked` state, e.g. RTK-lost):
- growing **warn** uncertainty ring (S2), map chips "● RTK lost",
- a floating `statepill`-style banner "Paused · Waiting for GPS fix",
- the primary **Mow disabled** with a reason chip ("Needs a GPS fix"), **Dock** still available.
Reuse the visual language already in `states/PausedBlockerScreen.tsx` (that component is the faithful
mock) but render it as the Map's own state, not a separate gallery screen.

## S7 — Plan-preview (concept mobile "Preview" / desktop "Map · plan preview")
A preview mode that renders the **simulated coverage route** (serpentine boustrophedon draw-on) for
the selected area with a cost card (**Est. time / Area / Passes**) and a **Start this plan** button.
This builds directly on your coverage-preview batch (MAP_EDITOR_SPEC BATCH 6) — reuse that route
generation; this is the screen/flow around it (entered from the area-settings "Preview" button).

## S8 — Boundary-recording journey (concept "R1/R2/R3" mobile, desktop "recording a boundary") — LARGEST
There is currently NO way to add a new area except editing a pre-seeded zone. Build the record-a-
boundary flow:
- **R1 briefing / readiness** (GPS · RTK fixed / mower on lawn near edge / path clear checklist; Start
  recording + "Draw on map instead").
- **R2 drive-the-edge hero**: live trace on the map canvas (accent polyline + enclosed-area wash +
  dashed close-hint back to start + vertex dots), live perimeter/area readouts, a teleop joystick,
  speed stepper, "Mark no-go" + Undo + "Close loop".
- **R3 close & name**: name the area, pick type (Mowing/No-go/Nav-only), stats (m²/perimeter/points),
  Save + "Fine-tune the shape" (→ drops into vertex edit).
Mock the recorded track. This can be new files under `map/record/**` but it draws on MapCanvas, so
you own it. Consider adding a MapCanvas "recording trace" layer prop.

## Rhythm & rules
Same as your other specs: per item — tsc + build clean, render-verify 390/1440 light+dark, `/` still
200, commit (no AI mention), SendMessage main. Don't regress the vertex-drag fix or the editor tools.
Order suggestion: S1, S2, S5 (quick wins) → S3, S4, S6 → S7 → S8 (biggest last).
