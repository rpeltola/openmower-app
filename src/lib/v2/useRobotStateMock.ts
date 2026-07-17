'use client';

import {useSyncExternalStore} from 'react';
import type {CommandAvailability, CommandName, PausedReason, RejectCode, RobotStateSnapshot} from '@/lib/v2/robotState';

// A dependency-free external store (useSyncExternalStore, no zustand/mobx) holding the mock
// RobotStateSnapshot + a simulated transition engine. This is the seam the retained MQTT
// `robot_state/json` replaces at wiring time (STATE_COMMAND_MODEL.md §5).

const ALL_COMMANDS: CommandName[] = ['mow', 'stop', 'dock', 'pause', 'resume', 'undock'];

// MOCK: starts MOWING mid-job (62%) so Home looks populated by default, same as the mock world
// Home.tsx already renders (MOW.coverage 62 / Etupiha) instead of opening on a blank IDLE.
const initialSnapshot: RobotStateSnapshot = {
  state: 'MOWING',
  stateDetail: {progress: 62, phase: 'Mowing Etupiha'},
  reasons: [],
  commands: {} as Record<CommandName, CommandAvailability>,
};
initialSnapshot.commands = computeCommands(initialSnapshot);
let snapshot: RobotStateSnapshot = initialSnapshot;

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): RobotStateSnapshot {
  return snapshot;
}

// Same initial snapshot for SSR — no client-only mock state leaking into the first render.
function getServerSnapshot(): RobotStateSnapshot {
  return snapshot;
}

function emit() {
  for (const listener of listeners) listener();
}

// MOCK: a dev seam for demoing reason chips — unused by default. Call
// `mockSetBlocker('GPS_LOSS')` from the console to make `mow` report NO_GPS_FIX until cleared
// with `mockSetBlocker(null)`. Not wired into any UI (nothing in Home calls it).
let activeBlocker: PausedReason | null = null;
export function mockSetBlocker(reason: PausedReason | null): void {
  activeBlocker = reason;
}

/** Pure: given the current snapshot's state (+ the GPS_LOSS dev-seam blocker), compute whether
 *  `cmd` is allowed right now and why not. */
export function mockCommandGate(snap: RobotStateSnapshot, cmd: CommandName): CommandAvailability {
  const state = snap.state;
  const busy = state === 'DOCKING' || state === 'UNDOCKING' || state === 'BOOTING' || state === 'AREA_RECORDING' || state === 'MANUAL_DRIVE' || state === 'HEADING_CALIBRATION' || state === 'RECOVERING' || state === 'ERROR';

  switch (cmd) {
    case 'mow':
      if (activeBlocker === 'GPS_LOSS') return {allowed: false, reasons: ['NO_GPS_FIX']};
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
      // "Moving" states — anything the robot can meaningfully be stopped out of.
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
    default:
      return {allowed: false, reasons: ['NOT_READY']};
  }
}

function computeCommands(snap: RobotStateSnapshot): Record<CommandName, CommandAvailability> {
  const commands = {} as Record<CommandName, CommandAvailability>;
  for (const cmd of ALL_COMMANDS) commands[cmd] = mockCommandGate(snap, cmd);
  return commands;
}

/** Merges `partial` into the snapshot, recomputes `commands` for every CommandName from the
 *  new state, and emits a new object reference (useSyncExternalStore needs referential
 *  change — never mutate `snapshot` in place). */
function setState(partial: Partial<RobotStateSnapshot>) {
  const next: RobotStateSnapshot = {...snapshot, ...partial};
  next.commands = computeCommands(next);
  snapshot = next;
  emit();
}

// Pending setTimeout ids for the currently-running transition timeline — cleared at the start
// of every newly accepted dispatch so overlapping commands (e.g. Stop pressed mid-"Planning…")
// never fight each other.
let pendingTimers: ReturnType<typeof setTimeout>[] = [];

function clearPendingTimers() {
  for (const id of pendingTimers) clearTimeout(id);
  pendingTimers = [];
}

function schedule(delayMs: number, fn: () => void) {
  pendingTimers.push(setTimeout(fn, delayMs));
}

function runMowTimeline() {
  setState({state: 'PLANNING_MISSION', stateDetail: {progress: 0, phase: 'Planning coverage'}, reasons: []});
  schedule(650, () => setState({stateDetail: {progress: 30, phase: 'Planning coverage'}}));
  schedule(1350, () => setState({stateDetail: {progress: 65, phase: 'Planning coverage'}}));
  schedule(2050, () => setState({stateDetail: {progress: 100, phase: 'Planning coverage'}}));
  schedule(2400, () => setState({state: 'MOWING', stateDetail: {progress: 62, phase: 'Mowing Etupiha'}, reasons: []}));
}

function runPauseTimeline() {
  setState({state: 'PAUSED', reasons: ['MANUAL']});
}

function runResumeTimeline() {
  // Reuse whatever progress/phase was already showing (falls back to the mock 62% default).
  const {progress = 62, phase = 'Mowing Etupiha'} = snapshot.stateDetail ?? {};
  setState({state: 'MOWING', stateDetail: {progress, phase}, reasons: []});
}

function runDockTimeline() {
  setState({state: 'DOCKING', stateDetail: {phase: 'Returning to dock'}, reasons: []});
  schedule(1800, () => setState({state: 'DOCKED_CHARGING', stateDetail: undefined, reasons: []}));
}

function runUndockTimeline() {
  setState({state: 'UNDOCKING', stateDetail: {phase: 'Leaving dock'}, reasons: []});
  schedule(1500, () => setState({state: 'READY', stateDetail: undefined, reasons: []}));
}

function runStopTimeline() {
  setState({state: 'IDLE', stateDetail: undefined, reasons: []});
}

/** The only entry point that mutates robot state — mirrors the real `cmd/req→res` contract's
 *  synchronous accept/reject half (STATE_COMMAND_MODEL.md §2). Rejects leave the snapshot and
 *  any in-flight timeline untouched; an accept clears any pending timers first so a new command
 *  always wins over whatever was mid-transition. */
export function dispatchCommand(cmd: CommandName): {accepted: boolean; reason?: RejectCode} {
  const gate = mockCommandGate(snapshot, cmd);
  if (!gate.allowed) {
    return {accepted: false, reason: gate.reasons[0]};
  }

  clearPendingTimers();
  switch (cmd) {
    case 'mow':
      runMowTimeline();
      break;
    case 'pause':
      runPauseTimeline();
      break;
    case 'resume':
      runResumeTimeline();
      break;
    case 'dock':
      runDockTimeline();
      break;
    case 'undock':
      runUndockTimeline();
      break;
    case 'stop':
      runStopTimeline();
      break;
  }
  return {accepted: true};
}

export function useRobotStateMock(): RobotStateSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
