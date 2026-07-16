# V2 redesign — build tracker (resume here)

Single source of truth for continuing the OpenMower app UI redesign build. Read this first.

## TL;DR
Rebuilding the app UI ("v2") on **Tailwind + shadcn-style kit**, served at **`/v2/*`**, **coexisting**
with the working **MUI v1** app at `/`. Build screen-by-screen; at parity, cut over (v2 → `/`,
delete v1 + MUI). Branch: **`feature/redesign-ui`** (this worktree). Not pushed.

**Run:** `corepack npm run dev` (apt npm is broken — use corepack) → `/v2` (Home), `/v2/control`
(manual control), `/` (v1, must stay working). Prod build: `corepack npm run build` (`next build --webpack`).

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
- [x] **Schedule (`/v2/schedule`)** — weekly plan + rain-skip + mow-all-now (mobile), week calendar
      + policy card (desktop), editor as a Sheet. Verified mobile/desktop/dark + sheet. Committed.
- [x] **Activity (`/v2/activity`)** — Events/History/Stats sub-tabs; desktop History list+detail.
      Verified. Committed. DEFERRED: replay scrubber (disabled placeholder, needs map stack).
      Minor polish TODO: desktop Events tab is sparse.
- [x] **Diagnostics** — see above.
- [x] **Settings (`/v2/settings`)** — grouped list (mobile) + rail/detail two-pane (desktop).
      Verified. Committed. TODO: desktop detail pane only renders Notifications for any category.
- [ ] State screens (booting, paused-GPS, height-confirm, onboarding)
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
