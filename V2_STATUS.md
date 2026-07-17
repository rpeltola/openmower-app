# V2 redesign — build tracker (resume here)

Single source of truth for continuing the OpenMower app UI redesign build. Read this first.

## ✅ SESSION 5 (2026-07-17) — W9 Lane A-core: first test suite + real robot-state/command binding
Branch **`feature/w9-app`** (worktree, off `personal`). Implements openmower-app's app-side half
(B4) of `OpenMowerNext/docs/w9-implementation.md`'s frozen wire contract (§0).

- **First test suite** (vitest + `@testing-library/react`/jsdom, `npx vitest run`, 38 tests): the
  R4 copy-table completeness gate (`robotState.completeness.test.ts`), a state×reason×readiness
  render table driven off `robotState.ts`'s canonical enum lists (`stateRender.test.tsx`), and
  `useCommand`'s ack/nack/timeout+retry (`useCommand.test.tsx`).
- **`stateSchema` (schemas.ts)** gained the §0.6 fields (`state`, `state_detail`, `paused_reasons`,
  `commands`, `readiness`, `error`) — all optional/defaulted so an old gateway still parses (R3).
- **Real `RobotStateSnapshot` binding** (`lib/v2/useRobotStateSnapshot.ts`) replaces the mock as
  the command surfaces' data source (same shape as `useRobotStateMock.ts`, which stays in the
  tree for the `/v2/states` dev gallery); falls back to the legacy `current_state`+`is_charging`
  mapping when the gateway doesn't send `state` yet.
- **Real `cmd/req`→`cmd/res` client** (`lib/commandClient.ts`, wired into `Mower`/`mowersStore.ts`)
  and a rewritten `useCommand.ts`: optimistic pending → ack clears it → nack reverts + surfaces
  `reject_code` via `REJECT_COPY` → ~800 ms unacked ⇒ provisional badge + `retry()`. `Home.tsx`'s
  Mow/Stop/Dock now go through this (no more fire-and-forget `mower.sendCommand`, R2) and show
  real per-command blocker reason chips.
- Added the frozen contract's `UNSUPPORTED` reject code + `REJECT_COPY` row.
- **BootingScreen/PausedBlockerScreen** now render from the real snapshot's `readiness`/
  `paused_reasons` (via optional props, so the `/v2/states` gallery and tests still get a demo
  default) — PAUSED renders every active reason as its own stacked banner, most-severe-first.
- **NOT done this session:** wiring AppShell to actually SWITCH to BootingScreen/PausedBlocker-
  Screen when the robot enters those states (they're bound to live data but not yet mounted
  anywhere outside `/v2/states`) — that routing decision is left for the next wave. Map.tsx's own
  Pause/Resume/Stop/Dock stat-card buttons are still a local UI mock (`mockPaused`), untouched.

## ✅ SESSION 4 (2026-07-17) — MERGED to `personal` + Track A data-wiring STARTED + LIVE-VERIFIED
Branch **`feature/v2-data-wiring`** (worktree, off `personal`). The whole V2 redesign was **merged
into `personal`** (the app's integration branch) — v2 now coexists with v1 there, cut over later.
Then began **Track A of the integration plan** (`OpenMowerNext/docs/v2-integration-plan.md`): wire
V2 off its mocks onto the REAL Zustand store (`useSelectedMower`) — app-only, the backend already
serves it (the v1 store already consumed the whole contract; V2 just wasn't using it).

**Landed + LIVE-VERIFIED against the real mower** (dev server pointed at `ws://192.168.1.200:9001`,
Playwright screenshots — the mower was **DOCKED/charging**, which the app now shows correctly):
- **Diagnostics** ← real `state.sensors` (GPS/IMU/battery/power/pose/drive-ESCs/mow-ESC) + **ESC
  fault chips** (`utils/esc-faults`); nulls render `—` not `0` (R1). Confirmed live: 28.3 V, RTK
  3.0 cm, real pose, ESC 28.5/28.6 V, faults OK.
- **Activity History + Replay** ← `useMowJobs` + `useJobTimedTrack` (real driven track projected;
  the old hardcoded SVG is gone). Events/Stats sub-tabs still mock (next).
- **`/v2` map — full DISPLAY** ← real areas/dock (via new `map/realData.ts` + `useMapEditor.reset`),
  robot pose+heading+footprint, driven track, discovered obstacles, coverage-plan overlay, heatmap
  (toggle+picker). Ported from the working MowerMap hooks. Confirmed live: real garden areas render.
- **Real robot state, GLOBAL** ← new `lib/v2/useRobotState.ts` from `current_state`+`is_charging`.
  Home hero/pill/KPIs, AppShell sidebar, Map pill all show the REAL state → **docked hero, no
  phantom "Mowing 62%"**; mowing-only UI hidden off-lawn; commands dispatch the real store verb.
  The mock `useRobotStateMock`/`useCommand` stay only for the states-showcase/W9 demo.
- **Esri basemap overzoom FIXED** — Esri serves a placeholder tile from z19 over rural Finland
  (measured at the datum: z13-18 real, z19+ the 2521-byte "no data" tile); capped
  `maxNativeZoom:18` so Leaflet overzooms REAL imagery. Confirmed live: real satellite now renders.

**READ-ONLY wiring is now COMPLETE (`6229a45`)** — Activity Events (list+map pins) + Stats
(`useStatsRange`+blade, live-confirmed 13.9 h/895 m²/28 mows/17.7-of-40 h), Home recent-activity
feed + the mini-map tile (draws the REAL garden now), connection status (`mqttStatuses`/`reconnectNow`),
and Settings read displays (broker/RTK-datum/docking/blade; genuinely-absent fields removed not faked).
New `lib/v2/events.ts` (shared MowerEvent→display adapter). **Live-test caught a real bug + fix:** the
events feed hung on "Loading" — this deployed gateway returns **"Method not found" for `events.history`**
(probed the mower's `rpc.methods`), so historical events can't be fetched; gated loading on an
"attempted" flag → degrades to "No events yet" (live events still stream via `events/json`).

**POLISH + THEME BATCH (from live-testing on the real device):** `c8a8303` obstacle z-order (mow→nav
→obstacle so nested no-go zones stay clickable) + `L.svg({padding:2})` zoom-twitch fix · `2bf7963`
Areas panel "No-go zones" toggle (obstacles selectable from the list — 35 of them, hard to tap on
map) · `2762e38` blade wear removed from Activity/Stats (lives in Settings) + `/v2/onboarding` crash
fixed (missing `'use client'` → 500) · `a844093` run replay now plays over the REAL map (satellite +
areas + driven track + moving marker) + 0.5×/1×/2× speed switcher · `7c16b79` **Minimal (no-tile)
basemap = new map default + theme-aware zone colors (CSS `.v2-zone-*` → design tokens) + in-app THEME
SWITCHER (Settings›General System/Light/Dark, `lib/v2/theme.ts`, root boot-script honors it)** — the
map now reads like the concept mockups in both light + dark (live-verified). STILL FIXED-COLOR (satellite-
tuned): the Home mini-map + ReplayMap (`ZONE_STYLE`). KNOWN: Stats page is sparse now (design pass owed).

Every increment tsc+build clean, opus-validator/live-verified. Commits on `feature/v2-data-wiring`:
`b7ae131` (diag+activity) · `515b4a0` (map display) · `96fcbb2` (map plan+heatmap) · `5a8696c`
(global state + Esri) · `6229a45` (read-only domains: events/stats/home-feed/mini-map/connection/settings).

**Track A remaining:** map **edit→save + versioning** (the one risky piece — the V2 editor's phantom
per-area settings + `spot` type + single-dock diverge from the server, needs field-by-field
reconciliation, ties to the plan's D7 L3-flag decision); **Manual teleop** (app-only but *commands*
the robot). **Untested live:** the *mowing*-state path (coverage %, mowing hero) — robot is docked,
renders only when it mows; and the Settings *detail pane* (tsc-clean, not visually confirmed).
**Backend-gap surfaced:** `events.history` RPC absent on the deployed gateway (older than OMN main) —
event *history* needs it; candidate for the L3 "not-yet-supported" flag or a gateway update.
**Deferred to W9:** command ack/nack + PLANNING_MISSION progress (backend work).

## ✅ SESSION 3 (2026-07-17) — audit + gap-close + robot-state model. Head: **`4efa68d`** (clean, tsc+build green)
- Ran a **full-state audit** (see the AUDIT block below) — map editor turned out ~93% ported vs the
  build specs (tracker was stale), the deferred phases named, non-map gaps found.
- **Closed the accidental gaps** (`f95f860`): Home Stop buttons wired, rect/circle draw type-pick,
  desktop Settings Safety category, dead About chevrons removed, stray raw buttons migrated.
- **Backup & Restore** settings page added as a **placeholder** (`f95f860`) — download/restore
  layout with honest "not wired yet" inline status; NO zip/backend logic (deferred by request).
- **Robot-state & command-feedback model** (`4efa68d`) — the big one. Press Mow now enters a
  **PLANNING_MISSION** busy state ("Planning…" hero sweep + progress) before MOWING; command
  buttons disable with reason chips. New `src/lib/v2/{robotState,useRobotStateMock,useCommand}.ts`
  (canonical 16-state enum + copy table + mock transition engine + blockers-as-data), Home rewired.
  **All MOCK** — the store is the seam the gateway drops onto in the data phase. **Spec:
  `STATE_COMMAND_MODEL.md`** (consolidated from the stranded `ux-research/docs/state-and-command-ux.md`
  + backend W9 `OpenMowerNext/docs/ux-state-architecture.md`); it also defines the **3-layer
  availability model** (hardware-capability=hidden · live-blocker=disabled+reason · **backend-support
  flag = hidden + "show controls not yet supported" dev toggle**) for the coming V2↔backend integration.
  KB: `openmower_knowledgebase/v2-app-robot-state-model.md`. opus-validator: APPROVE.
- **Next up (state model):** wire the other 3 `states/*` mockups to the store (BOOTING readiness,
  PausedBlocker reasons, HeightConfirm), then real `cmd/req→res` + schema fields in the data phase,
  then the L3 `featureSupport` registry + hidden toggle during integration. Also owed: the human
  real-browser DRAG QA pass.

## 🔎 AUDIT (2026-07-17) — full state audit, no code changed. Head: **`4e14479`** (clean, tsc+build green)
Three parallel audits (map editor / map screen+area settings / non-map screens) against every spec.
Findings that CORRECT stale lines below — read this before trusting the checklist:
- **Map editor §C–I are BUILT, not open.** The `[ ]` "next map-editor batches" line and §C–I items
  further down are STALE — vertex tools, snap-to-line, smear brush, multi/box-select, all transforms
  (rotate/scale/duplicate/buffer/simplify), measurements, validation (5 checks), boolean ops
  (merge/split/subtract), command palette+shortcuts, coverage preview, atomic undo/redo are ALL wired
  and non-stub. **~93% complete vs the build specs** (`MAP_EDITOR_SPEC` b2–6 + `MAP_BOOLEAN_OPS_SPEC`).
- **vs the full KB wishlist (§A–J) it's ~70%**, because two phases were DELIBERATELY deferred (not missed):
  **§I persistence/save = 0%** (no Save/versioning/backups/unsaved-guard — belongs to the data phase) and
  **§H MQTT robot-state coloring = ~25%** (footprint/heading/ring done; 6-state color model is a binary mock).
- **Small real editor gaps** (cosmetic/fidelity, capability present): rect/circle draw always makes a `mow`
  zone (no in-flow type pick) · no type-aware dashed render of non-relevant zones while editing ·
  net-mowable uses obstacle-CENTROID containment not true intersection · no custom XYZ/WMS basemap entry ·
  type badge is text-only · zoom FABs top-right vs spec bottom-right · no mini-map inset in the editor.
- **3 of 5 tracker-flagged non-map gaps are ALREADY FIXED (stale notes below):** desktop Settings now
  renders real per-category content (not Notifications-only); ManualControl has 0 raw `<button>` left;
  Activity replay scrubber is LIVE (not a disabled placeholder). Remove those debt notes on next pass.
- **NEW actionable gaps found:** (1) desktop Settings rail OMITS the "Safety" category mobile has →
  desktop has no path to geofence/tilt-lift toggles (real parity dead-end); (2) both Home "Stop" buttons
  (desktop header + mobile) have NO `onClick` while sibling Pause/Mow/Dock are wired; (3) Settings→About
  sub-rows are dead chevrons; (4) raw `<button>` outside `ui/**` in AppShell/MowerSelector/AreaPickerList;
  (5) RunDetail "Export GPX" + onboarding/height CTAs unwired (mock-stage, low-pri).
- **Still owed regardless:** the human real-browser DRAG QA pass (headless can't drive Leaflet pointer-drag).

## ✅ SESSION 2 (2026-07-17) — real-device / native-feel / PWA hardening pass. Head: **`d0cfe34`** (pushed)
Driven by live on-device testing (user on an Android phone + a USB PS5 controller). Full production
build clean at `d0cfe34`. All parallel Sonnet builders, disjoint file-sets. Landed this session:
- **Gamepad control** (`useGamepad` hook, PS5/Xbox brand detect, drive on left stick, A/B/X/LB/RB→Stop/
  Dock/Blade/Speed, brand glyph badges ON the buttons, auto-switch to analog stick on connect) —
  **confirmed working on a real PS5 pad over USB.**
- **Analog thumbstick** input option (D-pad ↔ Joystick toggle, shared Speed); **orientation-aware
  landscape cockpit**; **fullscreen** = a corner button on the video feed (auto-fullscreen was removed —
  too aggressive); **HTTPS dev server** (`corepack npm run dev:https`, self-signed).
- **Hardware capabilities gating** (`lib/v2/capabilities.ts`, mock now, shaped for the gateway): blade-
  HEIGHT control hidden (YardForce has no motorized deck), **per-camera** `cameras:{front,…}` gates the
  **DJI-style map⇄camera viewport** (front-only shows front FPV + map PiP, tap-to-swap).
- **Haptics** (Android `navigator.vibrate` + iOS switch-trick fallback + Settings→General toggle + Test) —
  **confirmed working on Android**; **pull-to-refresh disabled**; **round buttons no longer flash square**.
- **Draggable bottom sheets** + **sheet is now a stable frame w/ scrolling body** (accordions expand IN
  place, no grow-up); **wheel time picker** (Schedule); **Schedule Areas accordion animated**.
- **Disconnected banner + reconnect** (mock, shaped to `mowersStore`); **state-driven Home hero**
  (charging/docked/paused scenes + real driving+cutting mowing anim) + **Home quick-actions row**.
- **Settings → Maintenance** area (blade wear moved out of Stats); **History cards clickable**;
  **Events-on-map** (Roborock-style: Events List/Map toggle, pins per event, tap→detail w/ mini-map).
- **PWA/SW**: the SW now registers on v2 too (was v1-only, `V2PwaRegister`) but PRODUCTION-ONLY (dev
  disables it + self-signed cert = SSL error). Manifest already `display:standalone`.

**HUMAN passes owed** (headless can't drive these): all pointer/touch **drag** gestures (map vertex/brush/
box-select/rect-circle/move/dock, recording sim, plan-preview draw-on, replay scrubber, **sheet drag**,
**time-picker wheel scroll**), gamepad **feel/deadzone**, and general on-device visual QA.

**Roadmap (researched, KB docs, NOT built — user deferred):** trusted TLS cert on the mower
(`openmower-lan-https-cert.md`, the enabler for install/offline/gamepad/push on a phone) · Web Push
(`v2-app-push-notifications.md`) · cloud-vs-mower-served hosting decision
(`v2-app-hosting-cloud-vs-mower-served.md` — cloud hosting solves app-serving but mixed-content means the
mower STILL needs a per-device cert for the data socket; + version-skew via capability negotiation).

**Preview:** verify worktree (`.claude/worktrees/verify`, `node_modules` symlinked) → `corepack npm run
dev:https` on **:3020** (`https://192.168.1.132:3020` for the phone; accept the self-signed warning).
**Shared-worktree hazard for future parallel agents:** `git add <specific files>` + `git show --stat`
before/after every commit — concurrent commits can race (dropped one this session, recovered).

## ✅ DONE (2026-07-16) — feature-completeness push vs the mockups (parallelized, validated)
Filled every gap the concept mockups promised, via parallel agents on disjoint file-sets (one
dedicated agent owned all `map/**` + `Map.tsx`; four others took non-map screens). Head: **`ee0568e`**.
Full production build clean (tsc + `next build`, `/` v1 + all `/v2/*`). **Two `opus-validator` rounds**
run against an isolated verify worktree — both found real bugs, all fixed:
- **Non-map** (`69aec3d` Schedule picker + Diagnostics fade · `a3a1d8c` Activity replay scrubber ·
  `a221462` chrome/reachability: fixed the 404'd mobile More tab, mower selector, notification center,
  Manual-Control launch, `/v2/onboarding` · `6413eb3` device-home `/v2/mower`).
- **Map** (14 commits): MAP_EDITOR_SPEC batches 2–6 (vertex tools, transforms, measurements/validation,
  ⌘K command palette, coverage preview) + AREA_SETTINGS_SPEC (per-area settings: v1 overrides ∪ concept
  fields ∪ Yarbo net-new, inherit-by-absence) + MAP_SCREEN_SPEC S1–S8 (coverage paint, uncertainty ring,
  create-object menu + `spot` type, desktop Areas panel, Pause, paused/blocked state, plan-preview,
  boundary-recording journey). Specs: `MAP_EDITOR_SPEC.md` / `AREA_SETTINGS_SPEC.md` / `MAP_SCREEN_SPEC.md`.
- **Validation fixes**: (round 1) inverted `offsetPolygon` grow/shrink — RevLaw y-down vs our ENU
  y-up — corrected at source (`768e897`), fixed both buffer tool + coverage laps; + atomic undo/redo
  history, highlight-after-commit, inherited-hint. (round 2) recording **Save silently dropped the new
  zone** (stale-closure `createZone`+`renameZone` two-commit) → single-commit `createZone(name)`
  (`ee0568e`); + record/preview/blocked state-cleanup + nits.

Isolated **verify worktree** at `openmower-app/.claude/worktrees/verify` (detached at `ee0568e`,
`node_modules` symlinked) serves a stable preview on **:3020** — used for build/typecheck without
touching the live tree.

**Still OWED (not mockup features, so out of this push):** (1) HUMAN real-browser drag pass — headless
can't drive Leaflet/pointer drag (vertex/brush/box-select/rect-circle/move/dock drags, recording drive
sim, plan-preview draw-on animation, replay scrubber). (2) Wire REAL MQTT data (all mock now). (3) Cutover
v2 → `/` + delete v1/MUI. See build-order checklist below.

## TL;DR
Rebuilding the app UI ("v2") on **Tailwind + shadcn-style kit**, served at **`/v2/*`**, **coexisting**
with the working **MUI v1** app at `/`. Build screen-by-screen; at parity, cut over (v2 → `/`,
delete v1 + MUI). Branch: **`feature/redesign-ui`** (this worktree). Not pushed.

**Run:** `corepack npm run dev` (apt npm is broken — use corepack) → `/v2` (Home), `/v2/control`
(manual control), `/` (v1, must stay working). Prod build: `corepack npm run build` (`next build --webpack`).
**`corepack npm run dev:https`** — same dev server over HTTPS (`next dev --experimental-https`,
auto self-signed cert via mkcert, cached under `certificates/` which is gitignored). Needed to test
gamepad control from a phone on the LAN: the W3C Gamepad API is restricted to secure contexts, so
plain `http://<lan-ip>` silently returns no gamepads (only `http://localhost` is exempt) — see KB
`v2-app-gamepad-control.md`. On first run it downloads mkcert and prompts for sudo once to trust
the local CA; the phone will still show a self-signed-certificate browser warning (expected in
dev — accept/proceed) since the phone doesn't have that CA installed.

## Where the spec + visual target live (other worktree)
Design docs + the 1:1 visual source are on the **`feature/app-ux-research`** worktree
(`../ux-research/docs/` — reference by absolute path since it's a different branch):
- `component-library.md` — stack + migration strategy + layering + responsive model + build order.
- `design-language.md` — token/colour contract (accent green = action; amber/red/blue = state,
  **blue reserved for dock/charging/connection**; neutrals; light/dark).
- `mobile-architecture.md` — 5-tab IA + phased build order (§8).
- `concept/openmower-app-concept.html` (MOBILE) + `concept/openmower-desktop-concept.html`
  (DESKTOP) — the **1:1 visual target** for every screen. Live Artifacts:
  mobile https://claude.ai/code/artifact/d97c637d-1ee1-4bca-a83f-85960816afef ·
  desktop https://claude.ai/code/artifact/37973b10-7b7e-4325-b596-631f54268c38

## Stack (this worktree)
- **Tailwind v4** — tokens as CSS vars in `src/app/v2/tailwind.css` (from design-language.md);
  **preflight intentionally omitted** so it doesn't clobber v1's MUI reset (re-enable at cutover).
- **Kit**: `src/components/v2/` — `ui/{Button,SegmentedToggle,Chip,Card,Stepper,HoldToUnlock,
  StatePill,KpiTile,ProgressBar,MowingHero,FeedRow,MapCard}`, `Joystick`, `CameraSlot`, `MiniMap`,
  `AppShell`, `ManualControl`, `Home`; `lib/{cn,useBreakpoint}`.
- **`src/components/AppChrome.tsx`** — renders v1's MUI shell for non-`/v2` routes, leaves `/v2/*`
  to the new stack. **Never touch v1.**
- **Responsive**: one component tree; only the ~5 layout patterns (`AppShell`, `ResponsiveSheet`,
  `SplitView`, `MapCanvas`) adapt mobile↔desktop; most components identical on both.

## ✅ Map vertex DRAG — FIXED + user-confirmed in a real browser
- Removed the `marker.on('dragstart', …onSelectVertex…)` call in `map/MapCanvas.tsx` (handles effect).
- **Confirmed root mechanism** (the prior "replaces the icon DOM element" note was close but not the
  real cause): selecting a vertex mutates React `selectedVertex` → the restyle effect calls
  `marker.setIcon(...)` → Leaflet `Marker._initIcon` → **`_initInteraction`**, which runs
  `this.dragging.disable(); this.dragging = new MarkerDrag(this)` — tearing down the drag handler
  **mid-gesture**, so the drag died on the first move. Firing selection on `dragstart` triggered this
  every drag. Now nothing calls `setIcon` during a drag.
- **Behavior:** a vertex is selected by a plain **click**; dragging only **moves** it (no selection
  highlight during/after drag). If drag-to-select is ever wanted, fire `onSelectVertex` from the
  `dragend` handler (runs after the gesture, so it won't tear down the drag).

## Progress
- ✅ **`6b3ec8c`** — scaffold Tailwind + tokens + kit + **manual-control PoC** (`/v2/control`),
  verified ~1:1 on mobile + desktop, v1 untouched.
- ✅ **AppShell + Home** (`/v2`) + Home primitives (StatePill, KpiTile, ProgressBar, MowingHero,
  FeedRow, MapCard) — **built by an agent, UNCOMMITTED** (owner reviews before committing).
  `AppShell` = responsive layout pattern (mobile bottom tab bar ↔ desktop sidebar w/ sidestate
  card), wraps the tabbed v2 routes via the `src/app/v2/(shell)/` route group; `/v2/control`
  stays a sibling outside the group. Home is responsive from one tree (mobile glance dashboard ↔
  desktop multi-pane), canonical mock data, theme-aware, no horizontal overflow at 390px.
  Verified: `tsc --noEmit` clean, `npm run build` clean, `/`, `/v2`, `/v2/control` all 200,
  Playwright screenshots at 390×844 + 1440×900 light/dark checked against the concept.
  Nav items for not-yet-built screens (Map/Schedule/Activity/Diagnostics/Settings/More) link out
  but 404 until those steps land — expected at this stage.
- ✅ **Pixel pass vs concept** (UNCOMMITTED) — diffed `/v2` render against the mobile concept and
  fixed the drifts at the **primitive level** so every future screen inherits them. **Headline fix:
  all padding/margin utilities were dead app-wide** (see the CRITICAL gotcha below) — restored by
  importing utilities unlayered; that alone fixed missing page margins, squashed tiles, and the
  clipped header. Also:
  - `Button`: base radius pill→`--radius-control` (14px; the concept has **zero** pill buttons —
    all 11–16px rects; icon sizes keep `rounded-full`). `danger` variant → `bg-danger-wash`
    (concept `.btn-danger`), not grey+red-outline. Added a borderless `soft` variant for icon
    chrome (bell / map FABs, concept `.ico`/`.fab`). Added `border-0` to the base (see gotcha).
  - `AppShell`: mobile content sits on **`bg-surface`** (white) — concept `.screen{background:
    var(--surface)}`; desktop keeps the tinted `--bg` canvas. This was the "washed-out tiles" bug
    (surface-2 tiles on a surface-2-ish `--bg` had no contrast).
  - `MowingHero` radius 16→**18px** (concept `.mowhero`); mono label/kicker letter-spacing widened
    (`.kick`=.1em, `.metric .l`=.06em).
  - Verified: tsc + `npm run build` clean; `/`,`/v2`,`/v2/control` 200; mobile+desktop, light+dark
    rendered vs concept; control PoC unregressed; no h-overflow (390/1440).

## Gamepad (Xbox/PS5) support — Manual control (`/v2/control`)
- **`src/lib/v2/useGamepad.ts`** — SSR-safe rAF-polling hook (W3C Gamepad API), deadzone
  ~0.12 on sticks, pauses on tab-hidden (Page Visibility), exposes `{connected, id, axes,
  buttons}`. Shared by any future consumer (KB flags map-recording R2 as a candidate reuse).
- **`ManualControl.tsx`** — left stick feeds the *same* command path as the touch d-pad
  (`Joystick`'s `onDirectionChange`, now lifted to `touchDirection` state; touch wins if both
  are active). Buttons: A → Stop, B → Dock, X → toggle blade (gated on `unlocked`, matching
  the on-screen blade button), LB/RB → step the existing 3-position Speed control — all
  edge-triggered so a held button fires once, not once per animation frame. `Joystick` grew
  an optional `activeOverride` prop so a gamepad-driven direction highlights the same arrow a
  touch press would (`ui/Joystick.tsx`, additive/back-compat). A small chip (gamepad icon +
  controller name, vendor/product suffix stripped) shows in the header while connected; a
  `Toast` confirms "Controller connected: <name>" once.
- **`ui/GamepadTip.tsx`** — dismissible "Did you know?" info card, shown only while no
  controller is connected; dismissal remembered in `localStorage`
  (`v2.control.gamepadTipDismissed`, same pattern as Map.tsx's basemap/coverage prefs).
  Disappears the instant a controller connects.
- Real-controller behavior (button/stick feel, brand quirks, Bluetooth pairing UX) still
  needs a **human hardware pass** — headless verification stubbed `navigator.getGamepads`
  and dispatched a synthetic `gamepadconnected` event to confirm the wiring (chip/toast/tip
  swap, direction highlight, Stop/Dock/blade/speed edge-triggering) but can't exercise a real
  pad.
- **`ui/AnalogStick.tsx`** — a true analog thumbstick alternative to the `Joystick` d-pad
  (which is a 4-direction clickpad, not analog): draggable thumb reports proportional
  `{x,y}` in [-1,1], snaps to center on release, pointer-based (mouse/touch). An "Input"
  `SegmentedToggle` (D-pad/Joystick) on the control page switches between the two,
  remembered in `localStorage` (`v2.control.inputMode`); both modes share the same Speed
  control. The gamepad left stick drives whichever mode is active (`DriveInput` in
  `ManualControl.tsx` picks the control + feeds it the right shape).
- **Brand-aware glyphs** — `useGamepad` sniffs `Gamepad.id` (`detectBrand`: Sony vendor
  `054c`/DualSense/DualShock/PlayStation → `playstation`; Microsoft vendor `045e`/Xbox →
  `xbox`; else `generic`) and exposes `brand` + `gamepadButtonLabels(brand)`.
- **Per-button badges (superseded the standalone hints caption)** — instead of a separate
  legend, each mapped `ActionItem` (Dock/Stop/Blade) grows a small `GamepadBadge` pill on
  the icon button's corner showing its own brand glyph, only while connected; the Speed
  control gets a compact "LB slower · RB faster" (or `L1`/`R1`) line under it (desktop
  `SegmentedToggle`) / corner badges on the +/− stepper buttons (mobile). No controller →
  no badges, no line — layout is identical to before gamepad support landed.
- **Auto-switch to Joystick input mode on connect** — a physical stick is analog, so the
  connect-edge effect (the same one that fires the "Controller connected" toast) also calls
  `setInputMode('joystick')` once. It's edge-triggered, not enforced: switch back to D-pad
  manually and it sticks for the rest of that connected session (no fight-the-UI loop);
  a fresh disconnect→reconnect re-triggers the one-time switch. The on-screen `AnalogStick`
  already mirrors the gamepad's raw stick position via `activeOverride` when in Joystick
  mode (same `driveVector` plumbing from the analog-mode work above) — no extra wiring
  needed for that "nice to have".
- **Orientation-aware landscape cockpit** — new `lib/useMediaQuery.ts` (generalizes
  `useBreakpoint`'s matchMedia pattern to any query). A phone held sideways can be WIDER
  than the `md` breakpoint (844px is common), so "desktop vs. phone" can't be gated on
  width alone anymore — `isLandscapeCockpit = useMediaQuery('(orientation: landscape) and
  (max-height: 500px)')` catches "a short, wide, landscape viewport" (phones) without
  tripping on an actually-wide desktop/laptop screen (those are also "landscape" but
  taller). `isDesktop = isDesktopWidth && !isLandscapeCockpit` — the landscape case wins
  even at ≥768px width. The top-level `<main>`/`<aside>`/console branch is now a JS
  three-way (`isLandscapeCockpit` / `isDesktop` / else-portrait) instead of raw `md:`
  classes, so the phone-landscape branch can't be shadowed by the width-only breakpoint.
  The landscape-with-no-camera cockpit reuses the exact same controls as portrait laid out
  in a row, with the action row wrapped 2×2 (not a 4-tall column — a landscape phone is
  short). The header chrome (chips, Close button) is intentionally left on the plain `md:`
  breakpoint — out of scope, cosmetic-only difference in landscape.
- **Hardware capabilities gating** — new `lib/v2/capabilities.ts`: a typed
  `HardwareCapabilities` (`mowHeightAdjustment`, `bladeMotor`, `rainSensor`, per-position
  `cameras: {front,left,rear,right}`) + a mock `DEVICE_CAPABILITIES` for the real hardware
  (YardForce SA-series: no height motor, blade motor + rain sensor present, one front
  camera only) + `useCapabilities()`. Clearly commented as MOCK — swapping in the real
  gateway/MQTT-advertised capabilities only touches this one file, no call site. Blade
  HEIGHT (the `BladeColumn`/`Stepper`) is now gated on `mowHeightAdjustment` everywhere it
  appears (mobile, desktop, both landscape variants) — blade ON/OFF (a different
  capability, `bladeMotor`, true here) is untouched. The grid/flex tracks are left in place
  when hidden rather than restructured, so the drive input stays centered either way — no
  layout jump, just an empty column.
- **DJI Fly-style camera/map viewport** — replaced the old always-desktop, always-"reserved"
  camera-slot grid with `ui/MainViewport.tsx` + `ui/CameraFeed.tsx`: one big view (camera
  FPV or map) with the other inset as a small tappable PiP that swaps to become the main
  view. Capability-gated on `cameras.front` — no front camera → just the map, no PiP,
  nothing to swap to (desktop still gets a full map view; mobile/landscape get NOTHING new,
  matching the pre-existing no-camera behavior exactly). With the mock (front-only): the
  viewport now shows on **mobile too** (an FPV top strip, `aspect-video`, since a front
  camera is for driving) not just desktop; the desktop aside's old standalone `MiniMap`
  panel is gone (its job is now the viewport's map/PiP). Landscape + a front camera gets its
  own compact bespoke console (not the shared `portraitConsole` — that didn't fit a
  ~390px-tall viewport height-wise; trimmed drive-input size, one action row instead of
  2×2, no "Input" caption) so Stop/Dock aren't a scroll away. `CameraFeed` is deliberately
  hardcoded black/white (not theme tokens) — a camera viewfinder stays dark regardless of
  the app's light/dark theme.

## Build order (checklist)
- [x] Scaffold Tailwind + tokens + kit
- [x] Manual-control PoC (`/v2/control`)
- [x] **AppShell + Home (`/v2`)** ← built + verified, UNCOMMITTED (owner to review + commit)
- [x] **Home componentized** — inline blocks extracted to `ScreenHeader`, `PositionTrustCard`,
      `NextScheduledCard`, `ActivityFeedCard`, `OverlayChip`; verified pixel-identical (per-pixel
      diff vs baseline: only the animated mower differs). Position-trust card pinned to bottom
      (concept anchors it above the tab bar).
- [x] **Shared kit expansion** — `Switch`, `Slider`, `FormField`, `ListRow`, `Sheet`, `Fab`,
      `StatCard` (concept-faithful; `--shadow-s/m` tokens added). Mounted + QA'd on **`/v2/kit`**
      (dev-only gallery, the visual-regression surface). Light+dark verified; Sheet open verified.
- [x] **Diagnostics (`/v2/diagnostics`)** — first view through the agent pipeline (delegate w/
      concept as spec → I verify vs concept). All 6 sensor cards, sparklines, L/R ESC grid;
      mobile stack + desktop 3-col grid; light+dark verified vs concept; tsc+build clean. New kit
      primitives: `DiagCard`, `StatRow`, `Sparkline`. Central button reset proven (bare button clean).
- [~] **Map (`/v2/map`)** — **on Leaflet, not MapLibre** (client GPU/battery: v1's MapLibre pins
      ~30% iGPU; map renders client-side, NOT on the CM4). **Phase 1 foundation DONE + verified**:
      real Esri-satellite Leaflet canvas, projected zones (mow/obstacle/nav) + dock + **to-scale
      footprint robot marker** (real metres, heading-rotated), concept chrome (pills/FABs/stat card),
      tsc+build clean. Data mocked to the real gateway/store schemas. Remaining phases = porting ALL
      RevLaw editor features — see KB `openmower-map-editor-feature-port.md` (basemap switcher [Esri/
      MML-Finland/OSM] is next; then vertex tools, transforms, measurements/validation, command
      palette, coverage preview, versioned save/backups). NOTE: Esri has no deep imagery at the rural
      Finland datum ("Map data not yet available") — the MML basemap fixes it (feature A).
      - [x] Basemap switcher DONE (Esri / MML-Finland / OSM); MML wired w/ key, maxNativeZoom 18.
      - [ ] **BACKLOG (low priority): MML sharpening** — MML ortokuva is ~0.5 m/px source, so it
            upscales/blurs at garden closeup (fundamental, not a bug). Optional nicety: switch MML
            from WMTS to **WMS** (server renders exact bbox at screen res → smooth, not pixelated;
            RevLaw: "WMS renders crisp at any zoom"), and/or cap overzoom to ~native+1. Deferred.
      - [x] **Vertex tools batch 1** (`466108f` + drag fix): edit mode + handles + tool dock; add/
            delete/undo/redo/selection/**drag** all WORK (drag fixed — see ✅ section above).
            `map/geometry.ts` (nearest-edge, ported from RevLaw), `map/useMapEditor.ts` (state +
            snapshot undo/redo).
      - [ ] Next map-editor batches (KB checklist §C–I): fix drag → snap-to-line, smear brush,
            multi/box-select, transforms (rotate/scale/duplicate/buffer/simplify), measurements,
            validation, command palette + shortcuts, coverage preview, versioned save + backups.
- [x] **Schedule (`/v2/schedule`)** — weekly plan + rain-skip + mow-all-now (mobile), week calendar
      + policy card (desktop), editor as a Sheet. Verified mobile/desktop/dark + sheet. Committed.
- [x] **Activity (`/v2/activity`)** — Events/History/Stats sub-tabs; desktop History list+detail.
      Verified. Committed. DEFERRED: replay scrubber (disabled placeholder, needs map stack).
      Minor polish TODO: desktop Events tab is sparse.
- [x] **Diagnostics** — see above.
- [x] **Settings (`/v2/settings`)** — grouped list (mobile) + rail/detail two-pane (desktop).
      Verified. Committed. TODO: desktop detail pane only renders Notifications for any category.
- [ ] State screens (booting, paused-GPS, height-confirm, onboarding)
- [x] **State screens** (`/v2/states` showcase) — booting, height-confirm, paused-blocker (disabled
      Mow + reason + growing uncertainty ring), onboarding. Verified.
- [x] **Mobile parity pass** — Activity/History + Settings now have mobile drill-ins (tap → detail →
      back) instead of dropping the desktop detail pane. **PRINCIPLE (apply to every screen): mobile-
      first, FULL feature parity — never hide features on mobile; give each a mobile idiom (drill-in/
      sheet).** Still audit: Schedule mobile lacks the full week-calendar (has the plan); fine-ish.
- [ ] Wire REAL data (MQTT store/hooks/schemas — currently ALL MOCK; the stores/lib/hooks are
      shared with v1 and library-agnostic)
- [ ] Cut over: v2 → `/`, delete v1 + MUI + the Tailwind-preflight workaround

## The rhythm (per screen)
build (delegate to `sonnet-coder`, concept as the spec) → **verify** (render `/v2/<screen>` at
390 + 1440, light+dark, against `concept/`) → **commit** (no AI mention in messages) → next.
Everything is MOCK data until the "wire real data" phase.

## Verify tooling
`PORT=<n> corepack npm run dev` then Playwright (browsers cached at `~/.cache/ms-playwright`,
run from `/tmp/pw-test`). Confirm `/v2`, `/v2/control`, and `/` all 200. **Stop the server by
port**: `lsof -ti tcp:<n> | xargs -r kill` (don't `pkill -f "next dev"` — it matches its own cmd).

## Gotchas
- **v1's global reset kills v2 padding/margin utilities (CRITICAL — was silently breaking every
  screen).** `src/app/globals.css` has an **unlayered** `* { margin:0; padding:0 }`. It leaks into
  /v2, and an unlayered rule beats a layered one regardless of specificity — so while utilities were
  imported as `@import 'tailwindcss/utilities.css' layer(utilities)`, EVERY `p-*`/`px-*`/`m-*`/`mt-*`
  lost to that `*` reset (only `gap-*` survived, which masked it → no page margins, squashed tiles,
  clipped header). Fix: **import utilities UNLAYERED** (drop `layer(utilities)`) so `.p-4` (0,1,0)
  beats `*` (0,0,0). Only loaded on /v2, only matches v2 classes → no v1/MUI impact. **Do not
  re-add the layer.** Always measure real geometry (bounding boxes / computed padding) when
  verifying, not just eyeballed thumbnails — this bug is invisible in a quick glance.
- **Native button chrome is now handled centrally — use `<Button>`, never raw `<button>` in app
  code.** The reset in `tailwind.css` is `:where(.v2-root button){appearance:none;border:0;
  padding:0;background:transparent;…}` — zero specificity, so (since utilities are unlayered) any
  `bg-*`/`border-*`/`p-*` utility overrides it, but a bare `<button>` renders clean (no UA border/
  buttonface/padding) in BOTH themes. This is Tailwind-preflight-for-buttons without preflight.
  Verified: bare button = transparent/0-border/0-pad; primary/ghost/danger keep their utilities.
  So authored buttons no longer need per-instance `border-0`/`bg-transparent`. **Rule:** raw
  `<button>` lives ONLY in `components/v2/ui/**`; app/composite code uses `<Button>` or a kit
  component. Enforced by an eslint `no-restricted-syntax` rule (eslint.config.mjs) — but note the
  project's ESLint currently CRASHES on a pre-existing upstream `@eslint/eslintrc` config-validator
  bug, so the rule can't run via CLI until that's fixed. Known debt: `ManualControl.tsx` (early PoC)
  still has 4 raw `<button>`s to migrate to the kit (they render fine now thanks to the reset).
- **Preflight-omitted button reset (IMPORTANT).** Because Tailwind preflight is skipped, native
  `<button>` UA chrome leaks. The reset in `tailwind.css` is deliberately **minimal**
  (`appearance:none` + `cursor` + `font-family:inherit` only) and **unlayered**. Do NOT add
  `border/background/padding/color` to it: an unlayered (or wrongly-ordered) reset **beats**
  `@layer utilities` — layers sort before specificity — silently blanking `bg-*`/`text-*`/`px-*`.
  Turbopack also **drops bare `@layer a,b,c;` order statements**, so you can't reliably force a
  `base` layer below `utilities`. Instead, **each button variant owns its border/bg/padding via
  utilities** (that's why `Button` base carries `border-0`). Same rule for any new `<button>`-based
  primitive: give it explicit `border-0`/bg utilities, don't lean on a global reset.
- **Restart dev server after CSS edits if HMR looks stale** — `tailwind.css` changes sometimes
  don't recompile in-place (kill by PID/port, `rm -rf .next/cache .next/dev`, restart). Verify the
  served CSS (`_next/static/chunks/*tailwind*.css`), not just the class strings.
- **Never touch v1** (`/`, MUI) — re-check `/` returns 200 + renders after any change.
- `corepack npm` (apt npm broken). `npm run lint` fails on a known upstream ESLint circular-JSON
  bug — not ours, ignore.
- Tailwind preflight omitted (coexistence) — re-enable only at cutover.
- Design docs/concepts are on the `ux-research` worktree (different branch) — absolute paths.
- Workflow: architecture on Opus; screen/component code via `sonnet-coder`; verify render-vs-concept.
