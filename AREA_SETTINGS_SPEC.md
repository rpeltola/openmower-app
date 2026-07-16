# Per-area settings panel — build spec (map-editor builder, one batch)

This replaces today's placeholder "Edit zone" sheet in `Map.tsx` with a real **per-area settings
editor**. Synthesis of THREE sources: v1's "Mowing settings overrides", the v2 concept's area-
settings screen (mobile M2 / desktop D2), and Yarbo/competitor per-area settings research. All data
is **MOCK/local** for now (no RPC) — you're building the controls + local state; real persistence is
a later phase.

## Core model
- Extend the `Zone` type (mockMap.ts) with an optional per-area settings bag; EVERY field optional.
  **Absence = inherit the global default** (v1's exact model — no explicit enabled flag). Show the
  global default as the control's placeholder/"Auto" state.
  ```ts
  export interface AreaSettings {
    // v1 overrides (keep the real keys + semantics so wiring later is a swap)
    angle?: number;                 // RADIANS stored; UI edits DEGREES (0°=east). undefined = auto-detect
    outline_count?: number;         // int >=0
    outline_overlap_count?: number; // int >=0
    outline_offset?: number;        // meters, + = inward safety margin
    // concept + net-new (mock keys; naming is ours)
    route_pattern?: 'parallel' | 'spiral' | 'grid' | 'adaptive';
    mow_speed?: 'slow' | 'normal' | 'fast';
    turning_mode?: 'smart' | 'uturn' | 'zeroturn';
    perimeter_direction?: 'auto' | 'cw' | 'ccw';
    perimeter_first?: boolean;      // true = perimeter before infill (default), false = infill first
    rotate_between_sessions?: boolean;   // anti-rut
    mow_ngz_edges?: boolean;        // mow along no-go/obstacle edges
    cutting_height_mm?: number;     // display/aspirational — see hardware caveat below
  }
  ```
  Add `settings?: AreaSettings` to `Zone`. Provide a `GLOBAL_DEFAULTS: Required<AreaSettings>` mock
  (e.g. angle auto, outline_count 4, overlap 0, offset 0.10, pattern 'parallel', speed 'normal',
  turning 'smart', perimeter_direction 'auto', perimeter_first true, rotate false, ngz_edges false,
  cutting_height_mm 45) to source placeholders/"inherited" values.
- Edits commit through `useMapEditor.commitZones` so they ride the **same undo/redo** as geometry
  edits (each settings change = one history entry; debounce slider drags to one entry on release).
- **Angle unit conversion (match v1 exactly):** UI shows degrees; store radians. Empty/"Auto" =
  `undefined` = auto-detect from first 2 m of outline. Round-trip: `deg = rad*180/π`, clamp ±180.
- **Type rule (from v1):** the full mowing settings block shows ONLY when `type === 'mow'`. Switching
  a zone away from `mow` clears the mowing overrides (deletes those keys). nav/obstacle zones show
  only the basics (+ obstacle may show `mow_ngz_edges` context later — skip for now).

## UI — concept-faithful
The concept models this as a **mobile bottom Sheet** (M2) and a **desktop right side-panel with the
map still visible** (D2). Ship it responsive:
- **Mobile:** reuse the existing `Sheet` (as the current Edit-zone sheet does), titled with the zone
  name + subtitle "<type> · <area> m²" and a right-aligned `Preview <NN> min` chip.
- **Desktop (md+):** render the same content as a persistent right-hand panel (card) instead of a
  modal sheet, map stays interactive. (If a clean split is too big this batch, ship the Sheet for
  both and leave a TODO for the desktop side-panel — but prefer the split, it's the concept.)

### Sections (top→bottom)
1. **Basics** (all zone types): Name (`FormField`/text), Type (`SegmentedToggle` or select:
   Mowing / Navigation / Obstacle), Active (`Switch`).
2. **Primary mowing settings** (mow only — the concept's visible set):
   - **Route pattern** — pills (`SegmentedToggle`): Parallel · Spiral · Grid · Adaptive.
   - **Mow angle** — ±stepper (a `–  30°  +` pill group like the concept), step 5°, range ±180, plus
     an "Auto" state (clear → auto-detect). tnum/mono value.
   - **Outline offset** — `Slider` in meters (0–0.50, step 0.01), value badge "0.15 m".
   - **Cutting height** — `Slider` in mm (20–80), value "45 mm", WITH the explainer note verbatim in
     spirit: *"No motorized deck — you'll confirm this on the mower before a lower cut."* (mark it
     visually as advisory/aspirational).
3. **Advanced** (mow only; collapsible, collapsed by default — keeps mobile clean): holds the rest of
   the v1 overrides + net-new Yarbo knobs:
   - **Outline count** — stepper/number (int ≥0; help "≥4 recommended").
   - **Outline overlap count** — stepper/number (int ≥0).
   - **Mowing speed** — pills Slow · Normal · Fast.
   - **Turning mode** — pills Smart · U-turn · Zero-turn.
   - **Perimeter direction** — pills Auto · CW · CCW.
   - **Mowing order** — toggle/segmented: Perimeter first ↔ Infill first.
   - **Rotate pattern between sessions** (anti-rut) — `Switch`.
   - **Mow along no-go / obstacle edges** — `Switch`.
   Each advanced control shows its inherited/global value as placeholder when unset, and a small
   "inherited" affordance; setting it marks it as an override (like v1's count chip — show a count of
   active overrides on the Advanced header).
4. **Footer**: `Restore defaults` (ghost — clears ALL overrides back to inherit) + `Preview`
   (primary, eye icon). Preview computes a MOCK estimate from the real polygon area (you have area
   math / add it to geometry.ts): show a `Preview <NN> min` chip and, if cheap, a 3-up mini
   estimate (Est. time / Area / Passes) like the concept's plan preview. Keep it local + mock; do
   NOT wire to ROS. A full animated plan-preview screen (concept D3) is a SEPARATE later item — just
   the estimate chip here.

## Wiring
- Selecting a zone (existing zone list / tapping a zone in edit mode) opens this editor for that zone.
- Keep the zone-list picker too (switch which zone you're editing).
- `useMapEditor` gains helpers: `updateZoneSettings(zoneId, patch)` and `resetZoneSettings(zoneId)`
  (both funnel through commitZones for undo/redo). `renameZone`, `setZoneType`, `setZoneActive`
  similarly.

## Skipped / gated (do NOT build; note as TODO)
- Cutting height / target-height ramp / module gap / attachment labels are **hardware-gated** (no
  motorized deck) — cutting height is included as an advisory control per the concept; the rest are
  out.
- Transit/pathway per-corridor settings (blade-on-transit, pathway offset) = future "Pathway" object
  type; out of this batch.
- Real MQTT `map.replace` persistence (v1 uses `rpc.map.replace`) = later data-wiring phase.

## Done = 
tsc + build clean; `/v2/map` edit a mow zone → all controls work, override-vs-inherit visible,
undo/redo covers settings edits, Restore defaults clears to inherit, nav/obstacle show only basics,
Preview shows a mock estimate; `/` still 200. Commit (no AI mention) + report to main.
