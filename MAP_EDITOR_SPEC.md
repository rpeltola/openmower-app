# Map editor — build spec (dedicated agent)

You are the **single dedicated builder for the v2 Map editor**. You own these files exclusively;
no other agent edits them, so commit freely:
- `src/components/v2/Map.tsx` (screen chrome + tool dock + sheets)
- `src/components/v2/map/MapCanvas.tsx` (vanilla-Leaflet canvas, imperative)
- `src/components/v2/map/useMapEditor.ts` (editor state + undo/redo)
- `src/components/v2/map/geometry.ts` (pure geometry helpers)
- `src/components/v2/map/mockMap.ts` (mock world / types)
- new files under `src/components/v2/map/**` as needed

## Goal
Make the Map editor **feature-complete** vs the RevLaw OpenmowerMapEditor, following the full
checklist in `../../../../openmower_knowledgebase/openmower-map-editor-feature-port.md` (KB §A–J).
§A (basemap), §B (zone model/selection basics), and §C batch-1 (edit mode, handles,
select/drag/add/delete, undo/redo) are DONE. Build the rest in the batches below.

## Rules (READ FIRST — from V2_STATUS.md gotchas)
- Run with `corepack npm run dev` / `corepack npm run build` (apt npm is broken). `npm run lint`
  is known-broken upstream — ignore it.
- **Never touch v1** (anything outside `src/**/v2/**`). Re-check `/` returns 200 after changes.
- Use the existing kit (`src/components/v2/ui/**`): `Button`, `SegmentedToggle`, `Slider`,
  `Switch`, `Sheet`, `ListRow`, `Fab`, `FormField`, `StatCard`, `OverlayChip`. **Never raw
  `<button>`** in app code — use `<Button>`. New `<button>`-based primitives go in `ui/**` with
  explicit `border-0`/bg utilities (preflight is omitted — see V2_STATUS gotchas).
- Map geometry colors are FIXED across light/dark (theme changes only UI chrome). Handle/vertex
  colors already defined in MapCanvas.
- **Vertex-drag gotcha (do not regress):** never call `marker.setIcon()` on a marker mid-drag —
  it re-inits Leaflet's MarkerDrag and kills the gesture. Selection is a click concern; don't fire
  selection on `dragstart`. (See the fix already in MapCanvas `dragstart` note.)
- All data stays MOCK for now (real MQTT wiring is a later, separate phase). Shape any new state to
  the real gateway schemas where known (see mockMap.ts header).
- **Port the MATH from RevLaw's `src/lib/geo/` verbatim** where the KB says so (projection,
  offset/buffer, simplify, brush, snap). Reimplement UI in our React/kit idiom.

## The rhythm (do this per batch)
build → `corepack npx tsc --noEmit` clean → `corepack npm run build` clean → **render-verify**
(dev server, open `/v2/map`, exercise the new tool by hand at mobile 390 + desktop 1440, light+dark)
→ `git commit` (concise message, **no AI/Claude mention**) → next batch. Report progress back to
main after each committed batch (SendMessage to `main`), so I can verify/validate incrementally.

Note: headless browsers can't drive Leaflet pointer-drag reliably; for drag-based tools, verify the
non-drag paths headlessly and clearly flag that the drag path needs a human real-browser check.

---

## BATCH 2 — finish vertex tools (KB §C)
Extend `EditTool`, `useMapEditor`, `MapCanvas`, and the `Map.tsx` tool dock.
1. **Arrow-key nudge** (select tool, a vertex selected): ←→↑↓ move the selected vertex by a small
   metric step (e.g. 0.05 m); Shift = 10× step. Commit one undo entry per keydown (or coalesce a
   burst — your call, document it). Ignore when focus is in an input.
2. **Snap-line tool** (`S`): user picks a start vertex then an end vertex on the selected zone; snap
   that inclusive index range onto a straight, equally-spaced line between the two endpoints. Show
   which two are chosen (highlight). One undo entry on apply.
3. **Push/smear brush tool** (`B`): drag across the map; every outline vertex within `radius` (m) of
   the cursor is pushed along the drag delta, falloff by distance × `strength`. Radius + strength
   **sliders** appear only in brush mode (contextual). Live cursor circle preview. One undo entry per
   stroke (on pointer-up). Touch/finger support.
4. **Multi-select** (`M`): click vertices to toggle them into a selection set; Shift+drag a box to
   box-select all vertices inside. Selected set is highlighted. **Delete** removes the whole set
   (keep ≥3 points). Dragging any selected handle moves the whole set together (group drag). One undo
   entry per group op.
5. **Closed-loop endpoint lock**: if a zone outline is a closed ring, keep first/last logically
   synced (our outlines are implicit-closed — confirm in mockMap; if first≠last, this is a no-op,
   document it).

Extend the tool dock: the current 3-segment toggle grows to the full tool set — consider an icon
tool row/palette (RevLaw-style) instead of one wide segmented control if it gets crowded; keep it
usable at 390px. Contextual sliders (brush) render below the tool row only for the active tool.

## BATCH 3 — zone create & transforms (KB §D)
6. **Add zone** (square at map center, typed mow by default) + **Rectangle** (`R`) and **Circle**
   (`O`) draw-by-drag. New zone gets a generated id + editable name/type.
7. **Place dock** by clicking (move `MOCK_DOCK.position`); dock marker draggable.
8. **Duplicate zone** (offset copy), **Delete zone**, **retype** (mow/nav/obstacle), **rename**,
   **reorder** (firmware selects by order — expose order).
9. **Move whole zone** (`G`): centroid-handle drag translates all vertices.
10. **Rotate** ±15° and **Scale** ±5% about the zone centroid (buttons; optionally a rotate handle).
11. **Grow/Shrink** = uniform polygon **buffer offset** of every edge (port RevLaw offset math;
    grow mow / shrink obstacle). Adjustable distance.
12. **Simplify outline** = Douglas–Peucker with an adjustable tolerance slider (port RevLaw simplify).

Put transform actions in a **transform panel/section** of the edit dock (or a Sheet), with the
contextual sliders (buffer distance, simplify tolerance, rotate/scale step) shown only there.

## BATCH 4 — measurements & validation (KB §E)
13. **Live measurements** for the selected zone: area (m² and ha), perimeter (m), and **net mowable**
    (mow area minus contained obstacle areas). Show in the edit panel, update live during edits.
14. **Geometry validation**: detect self-intersections, <3 points, duplicate/degenerate vertices,
    dock-inside-obstacle, orphan obstacle (obstacle not inside any mow). List issues; clicking an
    issue **zooms/pans** the map to it. Port RevLaw's checks.

## BATCH 5 — command surface & shortcuts (KB §G)
15. **Keyboard shortcuts** for every tool/action (V/A/B/S/M/R/O/G, Del, Ctrl+Z / Ctrl+Shift+Z,
    Ctrl+D, etc.) + an on-screen **cheat sheet** (`?`).
16. **Command palette** (`Ctrl/Cmd+K`) listing every action, filterable, runs the action. Build a
    small `ui/CommandPalette` primitive if none exists.

## BATCH 6 — coverage preview (KB §F)
17. **Coverage preview** overlay (visual only): outline laps (edge-first, `outline_overlap_count`) +
    back-and-forth fill at `mow_angle_offset` / `mow_angle_offset_is_absolute` + tool-width spacing,
    obstacles carved out. Toggle + the few controls in a panel; settings remembered in localStorage,
    NOT written to the map.

## Area-settings panel (SEPARATE spec — WAIT for it)
The per-area **mowing/navigation settings overrides** (from v1 + Yarbo/competitor research) get their
own spec I will SendMessage to you after batches 2–3. It plugs into the zone/area settings Sheet
(the `Edit zone` sheet in Map.tsx today). Don't design those fields yet — leave the zone sheet as-is
until I send the field list, then wire it as its own batch.

## Deferred (needs real data / persistence phases — do NOT build now)
- §H live robot state colors from MQTT, §I versioned save + backups/diff + unsaved-guard. Stub the
  Save button to a no-op toast for now if the concept shows one.

Start at BATCH 2. Keep going through the batches; commit each; report after each.
