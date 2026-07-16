'use client';

import {useEffect, useRef, useState} from 'react';

const DEADZONE = 0.12;

export interface GamepadAxes {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

export interface GamepadButtons {
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  lb: boolean;
  rb: boolean;
  /** Digital (pressed past ~50%) trigger reads — see `ltValue`/`rtValue` for the analog pull. */
  lt: boolean;
  rt: boolean;
  ltValue: number;
  rtValue: number;
  back: boolean;
  start: boolean;
  ls: boolean;
  rs: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface GamepadState {
  connected: boolean;
  id: string | null;
  axes: GamepadAxes;
  buttons: GamepadButtons;
}

const IDLE_AXES: GamepadAxes = {lx: 0, ly: 0, rx: 0, ry: 0};

const IDLE_BUTTONS: GamepadButtons = {
  a: false,
  b: false,
  x: false,
  y: false,
  lb: false,
  rb: false,
  lt: false,
  rt: false,
  ltValue: 0,
  rtValue: 0,
  back: false,
  start: false,
  ls: false,
  rs: false,
  up: false,
  down: false,
  left: false,
  right: false,
};

const IDLE_STATE: GamepadState = {connected: false, id: null, axes: IDLE_AXES, buttons: IDLE_BUTTONS};

// Standard-mapping button indices (Xbox/PS5/MFi all report through this layout in the
// W3C Gamepad API) — see openmower_knowledgebase/v2-app-gamepad-control.md.
function readButtons(pad: Gamepad): GamepadButtons {
  const b = pad.buttons;
  const pressed = (i: number) => b[i]?.pressed ?? false;
  const value = (i: number) => b[i]?.value ?? 0;
  return {
    a: pressed(0),
    b: pressed(1),
    x: pressed(2),
    y: pressed(3),
    lb: pressed(4),
    rb: pressed(5),
    lt: pressed(6),
    rt: pressed(7),
    ltValue: value(6),
    rtValue: value(7),
    back: pressed(8),
    start: pressed(9),
    ls: pressed(10),
    rs: pressed(11),
    up: pressed(12),
    down: pressed(13),
    left: pressed(14),
    right: pressed(15),
  };
}

function applyDeadzone(v: number): number {
  if (Math.abs(v) < DEADZONE) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE));
}

function readAxes(pad: Gamepad): GamepadAxes {
  return {
    lx: applyDeadzone(pad.axes[0] ?? 0),
    ly: applyDeadzone(pad.axes[1] ?? 0),
    rx: applyDeadzone(pad.axes[2] ?? 0),
    ry: applyDeadzone(pad.axes[3] ?? 0),
  };
}

function axesEqual(a: GamepadAxes, b: GamepadAxes): boolean {
  return a.lx === b.lx && a.ly === b.ly && a.rx === b.rx && a.ry === b.ry;
}

function buttonsEqual(a: GamepadButtons, b: GamepadButtons): boolean {
  return (Object.keys(a) as (keyof GamepadButtons)[]).every((k) => a[k] === b[k]);
}

/** Polls the W3C Gamepad API (Xbox/PS5, secure-context only — see the KB doc) and exposes a
 *  normalized, deadzone-applied snapshot. SSR-safe: `navigator` is only touched from effects,
 *  so the server/first-client render both yield the disconnected default. */
export function useGamepad(): GamepadState {
  const [state, setState] = useState<GamepadState>(IDLE_STATE);
  const indexRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const poll = () => {
      const index = indexRef.current;
      const pad = index !== null ? navigator.getGamepads()[index] : null;
      if (pad) {
        const axes = readAxes(pad);
        const buttons = readButtons(pad);
        const prev = stateRef.current;
        if (!prev.connected || prev.id !== pad.id || !axesEqual(prev.axes, axes) || !buttonsEqual(prev.buttons, buttons)) {
          setState({connected: true, id: pad.id, axes, buttons});
        }
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    const startLoop = () => {
      if (rafRef.current === null && document.visibilityState !== 'hidden') {
        rafRef.current = requestAnimationFrame(poll);
      }
    };

    const onConnect = (e: GamepadEvent) => {
      indexRef.current = e.gamepad.index;
      setState({connected: true, id: e.gamepad.id, axes: readAxes(e.gamepad), buttons: readButtons(e.gamepad)});
      startLoop();
    };

    const onDisconnect = (e: GamepadEvent) => {
      if (indexRef.current === e.gamepad.index) {
        indexRef.current = null;
        stopLoop();
        setState(IDLE_STATE);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopLoop();
      } else {
        startLoop();
      }
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Some browsers only fire `gamepadconnected` on a fresh user gesture — pick up a pad
    // that was already connected before this hook mounted (e.g. after a client navigation).
    const existing = Array.from(navigator.getGamepads()).find((p): p is Gamepad => p !== null);
    if (existing) onConnect({gamepad: existing} as GamepadEvent);

    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopLoop();
    };
  }, []);

  return state;
}
