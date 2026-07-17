'use client';

import {Card} from '@/components/v2/ui/Card';
import {STATE_COPY} from '@/lib/v2/robotState';

export interface ErrorScreenProps {
  /** `robot_state/json.error.code` (W9 §0.6) -- shown as a raw diagnostic line since there's no
   *  per-code copy table for backend error codes yet (unlike RejectCode/PausedReason, which do
   *  have one). Undefined renders the screen with no diagnostic line at all rather than a blank
   *  placeholder. */
  code?: string;
}

/** ERROR -- a blocking full-screen surface, mounted by AppShell whenever state===ERROR. Uses
 *  STATE_COPY.ERROR verbatim for the label/sub (the one copy table every state reads from) plus
 *  the raw `error.code` as a diagnostic line underneath. */
export function ErrorScreen({code}: ErrorScreenProps) {
  const copy = STATE_COPY.ERROR;
  const Icon = copy.icon;

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center md:min-h-0 md:py-10">
      <div className="grid h-[60px] w-[60px] flex-none place-items-center rounded-[19px] bg-danger-wash text-danger">
        <Icon size={26} strokeWidth={2.1} />
      </div>

      <div className="text-[1.22rem] font-bold tracking-tight text-ink">{copy.label}</div>
      {copy.sub ? <p className="max-w-[320px] text-[.82rem] leading-[1.4] text-ink-soft">{copy.sub}</p> : null}

      {code ? (
        <Card className="px-3 py-2 font-mono text-[.72rem] text-ink-faint">{code}</Card>
      ) : null}
    </div>
  );
}
