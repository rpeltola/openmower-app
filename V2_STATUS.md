# V2 redesign — build tracker (resume here)

Single source of truth for continuing the OpenMower app UI redesign build. Read this first.

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
  `xbox`; else `generic`) and exposes `brand` + `gamepadButtonLabels(brand)`. A `GamepadHints`
  caption on the control page (shown only while connected) renders the actual mapping in the
  connected pad's own glyphs — PlayStation `✕ ○ □ △` + `L1/R1/L2/R2`, Xbox/generic
  `A B X Y` + `LB/RB/LT/RT`.

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
