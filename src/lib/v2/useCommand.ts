'use client';

import {useEffect, useRef, useState} from 'react';
import type {CommandAvailability, CommandName, RejectCode} from '@/lib/v2/robotState';
import {dispatchCommand, useRobotStateMock} from '@/lib/v2/useRobotStateMock';

// The single entry point every command control uses to issue a command (STATE_COMMAND_MODEL.md
// §2) — press → optimistic pending affordance → ack/nack. The mock ack window below stands in
// for the real `cmd/req→res` round trip; the actual state transition rides the store separately
// (dispatchCommand already kicked it off by the time this returns).
export function useCommand(): {run: (cmd: CommandName) => {accepted: boolean; reason?: RejectCode}; pending: CommandName | null} {
  const [pending, setPending] = useState<CommandName | null>(null);
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (ackTimer.current) clearTimeout(ackTimer.current);
    };
  }, []);

  const run = (cmd: CommandName): {accepted: boolean; reason?: RejectCode} => {
    setPending(cmd);
    const result = dispatchCommand(cmd);

    if (ackTimer.current) clearTimeout(ackTimer.current);

    if (!result.accepted) {
      setPending(null);
      return result;
    }

    // Simulated ack window — the pending affordance clears here, independent of however long
    // the transition timeline itself takes.
    ackTimer.current = setTimeout(() => setPending(null), 280);
    return {accepted: true};
  };

  return {run, pending};
}

export function useCommandAvailability(cmd: CommandName): CommandAvailability {
  const snap = useRobotStateMock();
  return snap.commands[cmd] ?? {allowed: true, reasons: []};
}
