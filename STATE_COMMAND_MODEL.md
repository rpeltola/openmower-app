# V2 state & command model (build spec)

How the V2 app **renders and drives** the robot's state so the product feels alive: the state is
always visible, **every command changes visible state immediately** (press → ack → transition),
long operations show progress instead of a dead button, and disabled controls say *why*.

This is the app-side contract. The backend authority is OpenMowerNext
`docs/ux-state-architecture.md` (workstream **W9** — canonical states, `cmd/req→res` ack/nack,
`command_gate`, blockers-as-data, readiness, latency budgets). This doc consolidates the app half
(previously stranded as `state-and-command-ux.md` on the `ux-research` worktree, which V2 was
built blind to) and adds the **integration-phase availability model** (§4) that this project
needs when we map V2's UI surface onto what the current backend can actually support.

Status: the **mock scaffold** described here is built (canonical enum + copy table + a simulated
transition engine + `useCommand`/`useCommandAvailability`, wired into Home as the reference
surface). It is MOCK — no MQTT — and is the seam the real gateway drops onto in the data-wiring
phase.

---

## 1. The canonical state model (single source of truth)

One enum, replacing the two ad-hoc unions V2 shipped with (`MowingHero`'s
`'mowing'|'charging'|'docked'|'paused'|'idle'` and `DeviceHome`'s `PowerStatus`). The gateway
will publish this (retained) on `robot_state/json`:

```
state        : BOOTING | READY | IDLE | DOCKED | DOCKED_CHARGING | PLANNING_MISSION | MOWING |
               PAUSED | RECOVERING | HEADING_CALIBRATION | UNDOCKING | DOCKING | AREA_RECORDING |
               MANUAL_DRIVE | ERROR | AWAITING_HEIGHT_CONFIRM
state_detail : { progress?, phase?, eta? }                 # sub-progress rides along
reasons      : PausedReason[]  (EMERGENCY, COLLISION, POSE_UNTRUSTED, GPS_LOSS, RAIN, MANUAL,
                                BATTERY_LOW, NOT_READY)     # one PAUSED state, N visible reasons
commands     : { <cmd>: { allowed: bool, reasons: RejectCode[] } }   # blockers-as-data
readiness    : { board_comms, gps, estimator, nav2, map, safety }    # for BOOTING
error?       : { code }
```

The app **never infers state from side effects** — it renders exactly what's published. These
fields get added to `src/stores/schemas.ts` **with defaults** (defensive parse: old/partial
payloads stay valid) when we wire real data.

> Backend reality check (from the audit): today the robot only emits a free-string
> `current_state` from behavior classes (`IDLE/MOWING/PAUSED/DOCKING/UNDOCKING/AREA_RECORDING/
> HEADING_CALIBRATION`) — no `DOCKED/BOOTING/PLANNING_MISSION/ERROR/RECOVERING`. The one
> transitional signal that already exists on the wire is mission-level `planning`
> (`MissionState.msg` → `mow_mission/state`), already typed in `schemas.ts`. So the backend owes
> most of this enum; see §4 for how the app stays whole in the meantime.

## 2. Command protocol — no fire-and-forget

Commands go over `cmd/req→res` with correlation ids (reuse `src/lib/queryClient.ts`'s
`query/<name>/req→res` machinery):

```
cmd/req  {id, cmd, args}   →   cmd/res {id, accepted, reason?, state}   # ≤300 ms
```

A single **`useCommand()`** hook is the ONLY way controls issue commands:

1. **Press** → optimistic *pending* affordance (button busy + haptic) — a bridge to the ack, not
   a substitute for it.
2. **ACK** → stop pending; the retained `state` (≤200 ms) drives the UI. The transition IS the
   confirmation.
3. **NACK** → revert the optimistic affordance; surface `reason` via the copy table (§3) as a
   toast + on the control.
4. **Timeout** (>~800 ms) → "no response" toast, fall back to the last retained state (never a
   fake pending state).

Optimistic UI is always reconciled against the ack/state; it never stands alone. Today's
fire-and-forget `sendCommand()` publish (`mowersStore.ts`) is replaced by this at wiring time.

## 3. Blockers-as-data + one copy table

`commands.<cmd>` drives every command control via **`useCommandAvailability(cmd)`** →
`{allowed, reasons}`. A disabled Mow/Dock renders a **reason chip** ("Mow — waiting for GPS fix")
instead of a silently dead button. The app mirrors the gateway's one `command_gate`; it never
guesses.

**One copy table** (`robotState.ts`) keyed by every gateway enum — states, `RejectCode`s, PAUSED
`reasons`, readiness keys — maps each to `{label, description?, icon, tone, deepLink?}`. Button
state, disabled-reason chips, PAUSED banners, NACK toasts, and push copy all read from it, so they
can never disagree. Adding a new code = one row. A completeness gate (test) fails the build if the
gateway can emit a code with no row, so an unknown code never renders raw.

**State surfaces:**
- **PLANNING_MISSION** — the dead-Mow-button fix. On the Mow ack the robot goes
  IDLE→PLANNING_MISSION *immediately*; the app shows "Planning… area 2/5" from
  `state_detail.progress`. A cached re-mow skips straight to MOWING — no app special-case.
- **BOOTING** — a live `readiness` checklist screen (each subsystem `ok|waiting|converging|
  activating|error`), reused when a subsystem later degrades (→ PAUSED `NOT_READY`), not a
  one-shot splash. Wires the existing `states/BootingScreen.tsx` mockup.
- **PAUSED** — stacked reason banners, most-severe first (EMERGENCY/COLLISION red-blocking;
  POSE_UNTRUSTED/GPS_LOSS amber; RAIN/BATTERY_LOW/MANUAL neutral). Wires
  `states/PausedBlockerScreen.tsx`.
- **AWAITING_HEIGHT_CONFIRM** — a calm blocking sheet (no motorized deck → confirm the manual
  cut). Wires `states/HeightConfirmScreen.tsx`. Wait-states are first-class UI, never a bare
  spinner.
- **Position uncertainty** — a Map circle sized from the estimator's covariance/accuracy, growing
  as GPS degrades; POSE_UNTRUSTED styles the marker "not trusted" + the PAUSED banner. ("The pin
  lied" fix.)

## 4. Availability model — three DISTINCT reasons a control may be unusable

The core clarity this project needs for the coming integration: a control can be non-usable for
three unrelated reasons, and they must never be conflated. They compose in this order — a control
is shown/enabled only if it clears all three.

| Layer | Question | Source | When it changes | UI treatment |
|---|---|---|---|---|
| **1 · Hardware capability** | Does this robot physically have it? (blade-height motor, a camera, rain sensor) | `lib/v2/capabilities.ts` (exists; static, later capability-negotiated) | per device | **Hidden entirely** — a mower with no deck motor never shows a height control |
| **2 · Live blocker** | Is it allowed *right now*, and why not? | backend `commands` field (§3) | per state transition | **Disabled + reason chip** ("waiting for GPS fix") — the control exists, it's just gated now |
| **3 · Backend support** | Does the mower's *software* implement this at all yet? | `lib/v2/featureSupport.ts` registry, keyed by backend/protocol version (**new; the integration flag**) | per backend version | **Hidden by default**; a dev/power setting **"Show controls not yet supported by your mower"** reveals them greyed with a "Not supported by your mower's software yet" tag |

**Layer 3 is the integration mechanism.** V2 is being built ahead of the backend on purpose. When
we do the "map what V2 has vs. what the backend supports" pass, every UI field the backend can't
yet back gets a `featureSupport` entry (not deleted). Result:
- Normal users see a clean app of only things that work.
- Turning on the hidden toggle reveals the complete designed surface, greyed and labelled — which
  IS the live gap list: exactly what the backend still needs to implement, visible in-app.
- As the backend implements a feature (advertised by a version/capability bump), its
  `featureSupport` entry flips to supported and the control lights up with no app-code change.

Keep the three layers separate in code: `capabilities` (L1) and `featureSupport` (L3) are static
registries with one clear seam each to real negotiation; `commands` (L2) is live per-state. A
control asks all three; the *most fundamental* unmet layer wins the treatment (missing hardware
hides before "not supported yet" which hides before "blocked now").

## 5. Mock scaffold (what's built now, all MOCK)

- **`lib/v2/robotState.ts`** — the `RobotState`/`PausedReason`/`RejectCode`/`CommandName` types,
  the `RobotStateSnapshot` shape, the copy tables (`STATE_COPY`, `REASON_COPY`, `REJECT_COPY`),
  and `heroSceneForState()` mapping the full enum onto `MowingHero`'s scene vocabulary (+ a
  `planning` busy treatment).
- **`lib/v2/useRobotStateMock.ts`** — a dependency-free external store (`useSyncExternalStore`)
  holding the current `RobotStateSnapshot` + a simulated transition engine: `mow` →
  PLANNING_MISSION (progress ticks ~2.5 s) → MOWING; `dock` → DOCKING → DOCKED_CHARGING; `stop` →
  IDLE; `pause`/`resume`. Recomputes `commands` (blockers-as-data) from a mock `commandGate` on
  every transition. This is the seam the retained MQTT `robot_state/json` replaces.
- **`lib/v2/useCommand.ts`** — `useCommand()` → `{run, pending}`; optimistic pending + mock
  ack/nack/timeout against the engine. `useCommandAvailability(cmd)` → `{allowed, reasons}`.
- **`Home.tsx`** — reference surface: the Mow button now shows PLANNING_MISSION busy ("Planning…")
  before MOWING; command buttons disable with reason chips from availability. The old instant
  `setMowerState` flips are gone.

Deliberately NOT yet done (data phase / later screens): schema fields + real `cmd/req→res`;
wiring the other three `states/*` mockups; the `featureSupport` (L3) registry + hidden toggle
(design only, above); Map/other command surfaces; the copy-completeness build gate.

## 6. Build order (mirrors backend W9 migration)

1. **PLANNING_MISSION busy affordance** (mock, done) — kills the flagship "dead Mow button"
   complaint in the demo; render the already-typed mission `planning` first when wiring real data.
2. `cmd/req→res` + `useCommand` ack/nack over real MQTT; schema fields with defaults.
3. Readiness aggregator → wire BOOTING checklist; then PAUSED reasons, AWAITING_HEIGHT_CONFIRM,
   uncertainty circle.
4. `featureSupport` (L3) registry + the "show unsupported controls" setting — during the
   V2↔backend integration pass.

## Sources
- OpenMowerNext `docs/ux-state-architecture.md` (W9 — canonical model, ack/nack, blockers-as-data,
  latency), `docs/app.md` (wire contract), `docs/scheduling-and-jobs.md` §4
  (AWAITING_HEIGHT_CONFIRM), `ROADMAP.md` §2 (uncertainty circle).
- App-side origin: `ux-research` worktree `docs/state-and-command-ux.md` + `design-language.md` §4
  (the interaction law), consolidated here.
- KB: `openmower_knowledgebase/v2-app-robot-state-model.md` (research synthesis + gap list),
  `yarbo-app-feature-map.md` (Yarbo's "Calculating Your Map" modal — the PLANNING_MISSION analog).
