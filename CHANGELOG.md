# Changelog

## 2026-07-17
- Added the app's first test suite (vitest + Testing Library) and swapped the v2 robot-state/command mock scaffold for a real MQTT binding: `robot_state/json`'s W9 state/commands/readiness/paused_reasons fields, a `cmd/req`→`cmd/res` command client, and the BOOTING/PAUSED screens now read live data (falling back to the legacy mapping on an old gateway).
- Guarded the nack reject-code lookup in Home so an out-of-contract `reject_code` from a newer gateway shows a generic toast instead of throwing.
- Add the L3 "backend support" availability registry (`lib/v2/featureSupport.ts`) + a Settings dev toggle ("Show controls not yet supported by your mower") + a `FeatureGate` wrapper, wired as a reference against Backup & Restore.
