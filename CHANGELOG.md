# Changelog

## 2026-07-17
- Consolidated Home/AppShell/Map onto ONE real-state display hook (`useRobotState`, now built on `useRobotStateSnapshot`'s canonical `state`, with the legacy `current_state` mapping only as its R3/R6 fallback) so PLANNING_MISSION/RECOVERING/READY/ERROR actually render; routed AppShell to a live BootingScreen/ErrorScreen full-screen takeover and a dismissible-but-persistent PAUSED banner (red-blocking for EMERGENCY/COLLISION); wired Map's stat-card Pause/Resume/Stop/Dock buttons to the real `useCommand`/`useCommandAvailability` client, replacing the local `mockPaused` toggle and the dead Dock button.
- Added the app's first test suite (vitest + Testing Library) and swapped the v2 robot-state/command mock scaffold for a real MQTT binding: `robot_state/json`'s W9 state/commands/readiness/paused_reasons fields, a `cmd/req`→`cmd/res` command client, and the BOOTING/PAUSED screens now read live data (falling back to the legacy mapping on an old gateway).
- Guarded the nack reject-code lookup in Home so an out-of-contract `reject_code` from a newer gateway shows a generic toast instead of throwing.
- Add the L3 "backend support" availability registry (`lib/v2/featureSupport.ts`) + a Settings dev toggle ("Show controls not yet supported by your mower") + a `FeatureGate` wrapper, wired as a reference against Backup & Restore.
