# Map editor — Merge / Split / Subtract areas (v1 parity) — build spec

Port v1's boolean area operations to the v2 map editor. v1 lives in `src/components/map/edit/`
(`EditControls.tsx` handlers, `MergeDialog.tsx`, `SubtractDialog.tsx`, `src/utils/area-utils.ts`
`splitPolygonWithLine`/`removeMiniCoords`). You own the v2 map files — implement there.

## THE KEY SIMPLIFICATION — run turf directly on metric {x,y}
v1 runs these ops on lon/lat GeoJSON only because that's its live editing frame. `@turf/union`,
`@turf/difference`, `@turf/polygonize`, `@turf/polygon-to-line`, `@turf/boolean-point-in-polygon`,
`@turf/point-on-feature`, `@turf/nearest-point-on-line`, and `sweepline-intersections` are all
**planar / coordinate-system-agnostic** — they operate on raw `[a,b]` positions with no geodesic math.
So feed the v2 `Zone.outline` `{x,y}` points straight in as `[x,y]` — **NO datum round-trip.** Just:
- turf needs **closed** rings → append the first point to close before building a turf `polygon`;
- strip that closing duplicate on the way back to v2's **open-ring** `outline` convention;
- ensure a ring has ≥3 distinct points before storing.
All these packages are ALREADY installed (v1 deps) — import the specific `@turf/*` functions; no `npm i`.

## New geometry module — `src/components/v2/map/booleanOps.ts`
Pure functions on `Meters[]` rings (reuse `polygonArea` from geometry.ts). Port `removeMiniCoords`
(drop rings with area < 0.001; collapse turf Polygon/MultiPolygon into a list of rings).
- `mergeOutlines(rings: Meters[][]): Meters[] | null`
  `union(featureCollection(rings.map(toTurfPolygon)))` → `removeMiniCoords` → if the result is a
  single Polygon (one ring), return it as `Meters[]`; if MultiPolygon / >1 surviving ring (operands
  disjoint / non-contiguous) → **return null** (can't merge into one area).
- `splitOutlineWithLine(outline: Meters[], line: Meters[]): Meters[][] | null`
  Port `splitPolygonWithLine` verbatim: `polygonToLine(polygon)` → `sweeplineIntersections(fc([polyLine,
  cutLine]), true)` → insert each intersection onto BOTH lines via `nearestPointOnLine` + splice (the
  `insertPointsOnLine` helper) → `polygonize(fc([polyLine, cutLine]))` → keep candidates whose
  `pointOnFeature` is `booleanPointInPolygon` of the ORIGINAL outline → return the pieces if ≥2, else
  `null`. (v1 throws on holed input; v2 outlines are single-ring, so no holes possible — no guard needed.)
- `subtractOutlines(target: Meters[], others: Meters[][]): Meters[] | null`
  `difference(featureCollection([target, ...others]))` → `removeMiniCoords` → return the ring **only if
  it's a single-ring Polygon**; if the result has a HOLE (2 rings) or is a MultiPolygon/empty → **return
  null** (v2 `Zone.outline` is a single ring with no hole support — reject rather than lose data).

## Editor actions — `useMapEditor.ts` (funnel through the atomic history = one undo entry each)
- `mergeZones(targetId, otherIds: string[]): {ok:boolean, reason?:string}` — union target+others outlines;
  null → `{ok:false, reason:'Areas don't overlap — can't merge into one.'}`; else set `target.outline`
  = merged ring, **delete otherIds**, keep target's id/name/type/settings, commit, keep target selected.
- `splitZone(zoneId, cutLine: Meters[]): {ok:boolean, reason?:string}` — split; <2 pieces →
  `{ok:false, reason:'Draw a line that crosses the area boundary.'}`; else **replace** the zone with N
  new zones: fresh ids, **cloned type + settings**, name suffixed ` (1)`, ` (2)`, … ; commit; select piece 1.
- `subtractZones(targetId, otherIds, keepOthers: boolean)` — difference; null →
  `{ok:false, reason:'Result would be empty, split, or have a hole.'}`; else reshape target, delete
  others iff `!keepOthers`, commit.
All results must keep valid polygons (≥3 pts); drop degenerate pieces.

## UI — in the edit-mode dock (Map.tsx), a "Combine & split" surface
Don't crowd the tool row (we just fixed its overflow). Add a small **"Combine / split"** button in the
edit dock that opens a Sheet, OR extend the existing **Transform sheet** with an "Area operations"
section. It offers, for the currently-selected zone as the target:
- **Merge…** — opens a picker (multi-select the OTHER zones to merge in; the selected zone's
  name/type survive). Confirm → `mergeZones`. On failure show the reason (see toasts below).
- **Split** — enters a **split-draw mode**: user taps the map to place cut-line points (draw a live
  polyline on a MapCanvas "cut line" layer — reuse the recording-trace layer pattern), with **Finish
  split** + **Cancel** buttons (double-tap can also finish). On finish → `splitZone(selectedZoneId,
  points)`. Show the reason on failure.
- **Subtract…** (v1 also has this; include it — same turf machinery) — picker to choose the other
  zone(s) to cut away, plus a **"Keep the other areas"** toggle (default on, matches v1). → `subtractZones`.

Selection model: v2 selects one zone (`selectedZoneId`); the picker sheet is how you choose the
additional operands — you don't need area multi-select on the map. The selected zone is always the
merge/subtract **target** (its identity survives), matching v1's "biggest is default target" intent
closely enough (here it's the user's currently-selected one).

## Guards, messages, undo
- Merge/Subtract need the selected zone + ≥1 picked other. Split needs a cut line crossing the
  boundary ≥ twice.
- Surface failure reasons to the user (v1 only `console.error`'d — that was flagged as a UX gap). If
  there's no toast primitive in the kit, add a lightweight ephemeral inline banner in the dock, or a
  tiny `ui/Toast`. Keep it simple.
- Every successful op = exactly ONE undo entry; run the existing validation afterward so a malformed
  result surfaces in the issues list.
- All MOCK/local (no RPC).

## Verify (your usual rhythm)
tsc + build clean; `/` and `/v2/map` 200. Merge two overlapping mock zones → one; Split a zone with a
drawn line → two named pieces; Subtract → reshaped target; each undoable in one step; failure cases
show a message not a crash. Commit (no AI mention) + report to main. Note the split cut-line DRAW and
the merge/subtract pickers need a human real-browser pass (headless can't drive the draw), but the
turf math + non-draw paths you can reason through with the mock zones (Etupiha/Flowerbed overlap).
