'use client';

import {
  ALL_COMMAND_NAMES,
  ALL_PAUSED_REASONS,
  ALL_REJECT_CODES,
  ALL_ROBOT_STATES,
  toRobotState,
  type CommandAvailability,
  type CommandName,
  type PausedReason,
  type RejectCode,
  type RobotState,
  type RobotStateSnapshot,
} from '@/lib/v2/robotState';
import {useSelectedMower} from '@/stores/mowersStore';
import type {CommandsMapWire} from '@/stores/schemas';

// A stable empty-array reference for the `paused_reasons` selector fallback below. useStore's
// useSyncExternalStore plumbing requires a selector to return a referentially stable value when
// nothing changed (it calls the selector more than once per render to check); a fresh `[]`
// literal on every call (e.g. no mower selected -- state.mowers is empty) would be a "new" array
// every time and spin into "Maximum update depth exceeded".
const EMPTY_PAUSED_REASONS: string[] = [];

const KNOWN_STATES = new Set<string>(ALL_ROBOT_STATES);
const KNOWN_REASONS = new Set<string>(ALL_PAUSED_REASONS);
const KNOWN_REJECT_CODES = new Set<string>(ALL_REJECT_CODES);

function isKnownPausedReason(reason: string): reason is PausedReason {
  return KNOWN_REASONS.has(reason);
}

function isKnownRejectCode(code: string): code is RejectCode {
  return KNOWN_REJECT_CODES.has(code);
}

// A small state-only heuristic -- NOT a real gate -- used ONLY as the R3 fallback for a gateway
// that predates the `commands` blockers-as-data field. It mirrors the busy/docked/mowing checks
// Home.tsx computed locally before this field existed (useRobotStateMock.ts's mockCommandGate is
// the same shape), so an old gateway keeps today's UX instead of a naive "everything's always
// allowed" that could let Mow fire mid-DOCKING. Once a gateway sends `commands`, this is never
// consulted -- the app renders exactly what the one real command_gate says, never guessing.
function legacyCommandGate(state: RobotState, cmd: CommandName): CommandAvailability {
  const busy =
    state === 'DOCKING' ||
    state === 'UNDOCKING' ||
    state === 'BOOTING' ||
    state === 'AREA_RECORDING' ||
    state === 'MANUAL_DRIVE' ||
    state === 'HEADING_CALIBRATION' ||
    state === 'RECOVERING' ||
    state === 'ERROR';

  switch (cmd) {
    case 'mow':
      if (state === 'MOWING' || state === 'PLANNING_MISSION') return {allowed: false, reasons: ['ALREADY_RUNNING']};
      if (busy) return {allowed: false, reasons: ['NOT_READY']};
      return {allowed: true, reasons: []};
    case 'pause':
      return state === 'MOWING' ? {allowed: true, reasons: []} : {allowed: false, reasons: ['NOT_READY']};
    case 'resume':
      return state === 'PAUSED' ? {allowed: true, reasons: []} : {allowed: false, reasons: ['NOT_READY']};
    case 'dock':
      if (state === 'DOCKED' || state === 'DOCKED_CHARGING' || state === 'DOCKING') {
        return {allowed: false, reasons: ['ALREADY_DOCKED']};
      }
      return {allowed: true, reasons: []};
    case 'stop':
      return state === 'MOWING' ||
        state === 'PAUSED' ||
        state === 'PLANNING_MISSION' ||
        state === 'RECOVERING' ||
        state === 'UNDOCKING' ||
        state === 'DOCKING' ||
        state === 'MANUAL_DRIVE'
        ? {allowed: true, reasons: []}
        : {allowed: false, reasons: ['NOT_READY']};
    case 'undock':
      return state === 'DOCKED' || state === 'DOCKED_CHARGING' ? {allowed: true, reasons: []} : {allowed: false, reasons: ['NOT_READY']};
  }
}

function legacyCommands(state: RobotState): Record<CommandName, CommandAvailability> {
  const commands = {} as Record<CommandName, CommandAvailability>;
  for (const cmd of ALL_COMMAND_NAMES) commands[cmd] = legacyCommandGate(state, cmd);
  return commands;
}

// The wire's `commands` map is a plain string record (schemas.ts's commandsMapSchema, so an
// unrecognized command key from a newer gateway doesn't fail the whole parse); narrow it down to
// exactly the 6 CommandName slots the app renders, defaulting any missing one to allowed (rather
// than silently disabling a control the gateway just didn't mention yet) and dropping any
// reject_code string this build doesn't have a REJECT_COPY row for.
function toCommandsRecord(wire: CommandsMapWire): Record<CommandName, CommandAvailability> {
  const commands = {} as Record<CommandName, CommandAvailability>;
  for (const cmd of ALL_COMMAND_NAMES) {
    const entry = wire[cmd];
    commands[cmd] = entry
      ? {allowed: entry.allowed, reasons: entry.reasons.filter(isKnownRejectCode)}
      : {allowed: true, reasons: []};
  }
  return commands;
}

/** The real `RobotStateSnapshot` binding (W9 B4.1) -- the seam `useRobotStateMock.ts` stood in
 *  for. Same shape as the mock so command surfaces (`useCommand`/`useCommandAvailability`, the
 *  BOOTING/PAUSED screens) swap cleanly. Reads `robot_state/json`'s W9 fields (`state`,
 *  `state_detail`, `paused_reasons`, `commands`, `readiness`, `error`) when the gateway sends
 *  them; falls back to the legacy `current_state`+`is_charging` mapping (`robotState.ts`'s
 *  `toRobotState`) when they're absent, so an OLD gateway still renders a sane state (R3/R6) --
 *  just without paused-reason detail, live command blockers, or a BOOTING readiness checklist.
 *  `useRobotState.ts` (Home/AppShell/Map's display hook) builds on top of this. */
export function useRobotStateSnapshot(): RobotStateSnapshot {
  const rawState = useSelectedMower((s) => s?.state.state);
  const currentState = useSelectedMower((s) => s?.state.current_state);
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);
  const stateDetail = useSelectedMower((s) => s?.state.state_detail);
  const pausedReasonsWire = useSelectedMower((s) => s?.state.paused_reasons ?? EMPTY_PAUSED_REASONS);
  const commandsWire = useSelectedMower((s) => s?.state.commands);
  const readiness = useSelectedMower((s) => s?.state.readiness);
  const error = useSelectedMower((s) => s?.state.error);

  const state: RobotState =
    rawState && KNOWN_STATES.has(rawState) ? (rawState as RobotState) : toRobotState(currentState, isCharging);

  return {
    state,
    stateDetail: stateDetail,
    reasons: pausedReasonsWire.filter(isKnownPausedReason),
    commands: commandsWire ? toCommandsRecord(commandsWire) : legacyCommands(state),
    readiness,
    error,
  };
}
