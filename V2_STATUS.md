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

## Build order (checklist)
- [x] Scaffold Tailwind + tokens + kit
- [x] Manual-control PoC (`/v2/control`)
- [x] **AppShell + Home (`/v2`)** ← built + verified, UNCOMMITTED (owner to review + commit)
- [ ] Map (live + area-settings + edit + create + recording + preview)
- [ ] Schedule (calendar + editor)
- [ ] Activity (events + history + replay + stats)
- [ ] Diagnostics
- [ ] Settings + Notifications
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
- **Never touch v1** (`/`, MUI) — re-check `/` returns 200 + renders after any change.
- `corepack npm` (apt npm broken). `npm run lint` fails on a known upstream ESLint circular-JSON
  bug — not ours, ignore.
- Tailwind preflight omitted (coexistence) — re-enable only at cutover.
- Design docs/concepts are on the `ux-research` worktree (different branch) — absolute paths.
- Workflow: architecture on Opus; screen/component code via `sonnet-coder`; verify render-vs-concept.
