# Changelog

## 2026-07-17
- Added the app's first test suite (vitest + Testing Library) and swapped the v2 robot-state/command mock scaffold for a real MQTT binding: `robot_state/json`'s W9 state/commands/readiness/paused_reasons fields, a `cmd/req`→`cmd/res` command client, and the BOOTING/PAUSED screens now read live data (falling back to the legacy mapping on an old gateway).
