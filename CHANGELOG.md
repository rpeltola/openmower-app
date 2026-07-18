# Changelog

## 2026-07-18 (5)
- Real-mower map-recording UX + teleop-safety + connection pass (11 fixes). Emergency reset is
  now reachable from the GLOBAL paused banner + blocker screen (was control-page only). An
  in-progress area recording now RESUMES its driving view after navigating away and back (reads
  the retained `record_area/status`). Connection loss surfaces fast now — MQTT `keepalive` 5s /
  `reconnectPeriod` 2s, plus a `degraded` state when a "connected" link goes >3s without a
  message — and the Reconnect banner stays visible whenever the link isn't healthy (degraded is
  cosmetic and does not lock out manual drive). Teleop stop is hardened against poor wifi: on
  joystick release the app now repeats the zero-twist at 10Hz for ~1.2s so the mower's 1s
  watchdog reliably catches the stop instead of the mower coasting on a drained command backlog.
  Accidental browser page-zoom is disabled (the Leaflet map keeps its own pinch-zoom). Toasts
  moved top-center with an X and a circular countdown ring. The Manual-control viewport map is
  now a real Leaflet follow-cam (follows the mower, pinch-zoom, reset-view button) instead of the
  static SVG mini-map; map max zoom raised 22→24. The map editor's "Discard changes" is wired up
  (revert to the loaded-map baseline, behind a confirm) — it was a placeholder. Area-recording
  "Done" now shows immediate "Saving…" feedback and a 15s watchdog that offers a safe Close if no
  save result arrives, so the dialog can never silently hang.

## 2026-07-18 (4)
- Three more Manual Control fixes found on real-mower testing: "Fast" now reaches the mower's
  actual ~0.5 m/s wheel top speed (was throttled to 0.35 m/s); a big "EMERGENCY — Clear & resume"
  button now appears on the page whenever an emergency is active (`state.emergency`, or
  `ERROR`/`PAUSED`+`EMERGENCY`), sending the legacy `reset_emergency` command without leaving the
  page; and the hold-to-unlock control no longer triggers browser text-selection/callout in
  landscape (was blocking the unlock gesture entirely on some devices).

## 2026-07-18 (3)
- Fixed three real-hardware bugs on the v2 UI: Manual control's Close buttons (mobile icon +
  desktop) were wired to nothing, now they exit fullscreen if active and navigate back (or to
  `/v2` with no history to return to). Manual control's viewport map (`MiniMap`) was a static
  mock SVG with a hardcoded heading — it now renders the real garden outline(s), dock, and live
  mower pose/heading from the store, fit to bounds, with a position-uncertainty ring only when a
  real `sensors.gps.position_accuracy` reading exists (never fabricated), degrading to a "Map
  loading…" placeholder with no map/pose yet. Settings no longer shows nav entries for the three
  fully-gated categories (Backup & Restore, Notifications, Safety) when unsupported — they were
  reachable but landed on an empty gated pane; hidden behind the same `isFeatureSupported`/dev-
  toggle mechanism as everything else.

## 2026-07-18 (2)
- Wired Manual control's blade on/off toggle E2E against the new OpenMowerNext
  `feature/manual-blade` backend: entering `/v2/control` sends `manual_drive` (robot state
  becomes `MANUAL_DRIVE`, `/joy_vel` teleop starts flowing), leaving sends `manual_stop`. The
  blade toggle now issues real `blade_on`/`blade_off` commands through `useCommand`, reflects
  the actual `sensors.mower.mow_enabled` sensor (not local optimistic state), is disabled with a
  reason chip when the backend's `command_gate` rejects it (only accepted in `MANUAL_DRIVE`), and
  a pulsing "BLADE SPINNING" alert banner shows whenever the blade is actually on. Flipped
  `bladeToggle` to `supported: true` in `featureSupport.ts`.

## 2026-07-18
- R1 honesty pass: wired `FeatureGate` onto every mock/unbacked v2 control (previously only
  Backup & Restore used it). With the Settings → General "Show controls not yet supported"
  toggle off, unbacked controls (Schedule, push notifications, safety-toggle writes, the camera
  feed, cutting-height controls, per-area planner params, position-accuracy/RTK readouts, the
  basemap picker, Device home, onboarding) now hide entirely instead of rendering bare; the
  toggle reveals them greyed + labelled. Wired Map's "Mow all now" buttons and
  `PausedBlockerScreen`'s Dock button to the real command client, and ManualControl's battery/
  connection chips to real state. Retired the mock boundary-recording flow in favor of the
  already-real `RecordAreaFlow`. Removed several controls that fabricated live state with no
  backend to represent (per-area "Mow" + fake per-zone progress, mowed-so-far lane painting,
  Diagnostics' decorative sparklines, RunDetail's GPX export + always-empty event feed,
  MowerSelector's fake multi-mower picker, the Activity tab's fake unread dot).
- Added three more real map features (W9 Lane A2b follow-up), all on `/v2/map`: **Record dock** — name a new docking station, then watch it record end-to-end against the existing `record_docking/*` gateway bridge; unlike Record area the mower drives itself (`driving`/`waiting_for_charging`/`recording`/`saving` are the robot's own docking-approach phases, confirmed against `RecordDockingStation.action` and v1's working `MowerControls.tsx` reference), so there's no teleop pad, just a live phase readout that auto-completes on `success` (or stays open with the reason on `failed`). **Dock settings** — a new sheet (tap the dock marker, or "Dock settings…" in the command palette) finally lets the user edit the physical dock's `heading` and `approach_distance`, not just drag its position; edits commit through the same `useMapEditor` undo history as a zone edit and ride the existing Save-map path to `rpc.map.replace` unchanged. **GeoJSON import/export** — Export (command palette) downloads the mower's current map as a GeoJSON file via the same `mapToFeatures` conversion the backend's own map.geojson uses; Import parses + lightly validates a picked file, shows a "this replaces the whole map" confirm sheet, then converts it back with `featuresToMap` and calls `rpc.map.replace` — a malformed or non-GeoJSON file toasts an error instead of crashing.
- Ported the mission composer (W9, largest remaining v1→v2 cutover-parity blocker): a multi-area ordered mow-job queue reachable from the Map screen (a "Mission" FAB + a matching entry on the Areas rail/sheet) alongside the existing single "Mow all now". Reuses v1's `useMissionComposer`/`mission-utils.ts` (already ROS/MUI-free) and the real `mow_mission/start|add|continue|cancel` store publishers untouched — only the presentation (`components/v2/mission/`) is new, ported from MUI to the v2 kit with dnd-kit drag-reorder, a per-job direction/repeats control, and a live `mow_mission/state` progress readout.
- Surfaced the robot's capabilities (previously a v1-only `/debug` page badge list) on v2's Diagnostics screen as a "Capabilities" card — reuses the existing live `capabilities/json` store data and schema, degrading to an explicit empty state on an old gateway instead of hiding or crashing.
- Added the "Record area" map control (W9 Lane A2b follow-up): drive a new mowing area or obstacle boundary end-to-end against the new `record_area/*` gateway MQTT bridge (`start`/`finish`/`cancel` + a retained `status`), reusing the real teleop drive input and Joystick glyph from Manual control; picks the area type up front, shows a live point count while recording, and toasts + closes on success or stays open with the failure reason on a reject.

## 2026-07-17
- Wired the app's write-paths onto the real store (W9 Lane A2b): Manual control's drive input (d-pad/analog stick/gamepad) now publishes real `teleop{vx,vz}` over the same store path v1's map joystick uses, and Dock/Stop go through the real `cmd/req`→`cmd/res` command client instead of a local mock. Map save/versioning: the "Save map"/"Version history" sheets (previously an honest no-op placeholder) now call `rpc.map.replace` for save and `query/mapversions`/`query/mapversion` for version history, restore, and preview — including carrying the real dock's `heading`/`approach_distance` through a save (the schema-skew the integration plan flagged) instead of dropping them, and passing through any additional docking stations the v2 editor can't yet see. Area-boundary recording stays out of scope (needs a backend gateway bridge).
- Consolidated Home/AppShell/Map onto ONE real-state display hook (`useRobotState`, now built on `useRobotStateSnapshot`'s canonical `state`, with the legacy `current_state` mapping only as its R3/R6 fallback) so PLANNING_MISSION/RECOVERING/READY/ERROR actually render; routed AppShell to a live BootingScreen/ErrorScreen full-screen takeover and a dismissible-but-persistent PAUSED banner (red-blocking for EMERGENCY/COLLISION); wired Map's stat-card Pause/Resume/Stop/Dock buttons to the real `useCommand`/`useCommandAvailability` client, replacing the local `mockPaused` toggle and the dead Dock button.
- Added the app's first test suite (vitest + Testing Library) and swapped the v2 robot-state/command mock scaffold for a real MQTT binding: `robot_state/json`'s W9 state/commands/readiness/paused_reasons fields, a `cmd/req`→`cmd/res` command client, and the BOOTING/PAUSED screens now read live data (falling back to the legacy mapping on an old gateway).
- Guarded the nack reject-code lookup in Home so an out-of-contract `reject_code` from a newer gateway shows a generic toast instead of throwing.
- Add the L3 "backend support" availability registry (`lib/v2/featureSupport.ts`) + a Settings dev toggle ("Show controls not yet supported by your mower") + a `FeatureGate` wrapper, wired as a reference against Backup & Restore.
