'use client';

import type {CommandAvailability, CommandName, RejectCode} from '@/lib/v2/robotState';
import {useRobotStateSnapshot} from '@/lib/v2/useRobotStateSnapshot';
import {useSelectedMower} from '@/stores/mowersStore';
import type {Mower} from '@/stores/mowersStore';
import {useCallback, useEffect, useRef, useState} from 'react';

export interface CommandResult {
  accepted: boolean;
  reason?: RejectCode;
}

// Timeout after which an un-acked command shows the "no response" provisional badge instead of
// staying a spinner forever (STATE_COMMAND_MODEL.md §2 step 4 / W9 §0.9's ~300ms ack budget --
// 800ms gives real MQTT round-trip jitter some room before calling it out).
const ACK_TIMEOUT_MS = 800;

interface PendingCall {
  cmd: CommandName;
  args?: object;
}

/** The single entry point every v2 command control uses to issue a command (W9 §0.9 /
 *  STATE_COMMAND_MODEL.md §2) -- press → optimistic pending affordance → real `cmd/req`→`cmd/res`
 *  ack/nack over MQTT (`Mower.commandClient`, lib/commandClient.ts). No fire-and-forget: every
 *  call resolves to an accept/reject, and the caller finds out which (R2). The retained
 *  `robot_state/json.state` transition -- not this ack -- is the actual state confirmation; the
 *  ack only unblocks the optimistic affordance. */
export function useCommand(): {
  run: (cmd: CommandName, args?: object) => Promise<CommandResult>;
  pending: CommandName | null;
  /** Set once a command has gone unacked past ACK_TIMEOUT_MS -- "no response yet", not a nack. */
  provisional: CommandName | null;
  /** Re-sends the command that's currently provisional (no-op if nothing is). */
  retry: () => void;
} {
  const mower = useSelectedMower<Mower | undefined>((s) => s);
  const [pending, setPending] = useState<CommandName | null>(null);
  const [provisional, setProvisional] = useState<CommandName | null>(null);
  const lastCall = useRef<PendingCall | null>(null);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    };
  }, []);

  const run = useCallback(
    async (cmd: CommandName, args?: object): Promise<CommandResult> => {
      if (!mower) return {accepted: false};

      lastCall.current = {cmd, args};
      setPending(cmd);
      setProvisional(null);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      timeoutTimer.current = setTimeout(() => {
        if (mounted.current) setProvisional(cmd);
      }, ACK_TIMEOUT_MS);

      try {
        const res = await mower.commandClient.send(cmd, args);
        if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
        if (mounted.current) {
          setPending((p) => (p === cmd ? null : p));
          setProvisional((p) => (p === cmd ? null : p));
        }
        return {accepted: res.accepted, reason: res.reject_code};
      } catch {
        // The client's own send() timeout (distinct from ACK_TIMEOUT_MS's UI cue above) --
        // leave `provisional` set so the control shows "no response" + a retry affordance
        // rather than reverting to a plain disabled state.
        if (mounted.current) setPending((p) => (p === cmd ? null : p));
        return {accepted: false};
      }
    },
    [mower],
  );

  const retry = useCallback(() => {
    if (lastCall.current) void run(lastCall.current.cmd, lastCall.current.args);
  }, [run]);

  return {run, pending, provisional, retry};
}

export function useCommandAvailability(cmd: CommandName): CommandAvailability {
  const snap = useRobotStateSnapshot();
  return snap.commands[cmd] ?? {allowed: true, reasons: []};
}
