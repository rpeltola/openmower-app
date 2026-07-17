'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {REASON_COPY, type PausedReason} from '@/lib/v2/robotState';
import {TriangleAlert, X} from 'lucide-react';
import {useEffect, useState} from 'react';

export interface PausedBannerProps {
  /** Most-severe-first (W9 §0.2 -- the gateway pre-orders this). Empty renders nothing. */
  reasons: PausedReason[];
  className?: string;
}

const DANGER_REASONS = new Set<PausedReason>(['EMERGENCY', 'COLLISION']);

/** AppShell's global PAUSED surface (STATE_COMMAND_MODEL.md §3) -- mounted above every /v2
 *  screen's own content, next to ConnectionBanner. EMERGENCY/COLLISION render "red-blocking":
 *  danger tone, no dismiss, since the mower stopped for a safety reason, not a nicety. Every
 *  other reason combo is an amber/neutral strip that's dismissible but persistent -- a dismissal
 *  only ever applies to the exact reason combo it was shown for, so it resurfaces the instant the
 *  active reasons change (a new reason appears, one clears, or the severity tier changes), even
 *  though the screen never fully leaves PAUSED. This is the compact, always-visible echo of the
 *  full states/PausedBlockerScreen.tsx surface (reserved for a dedicated blocked view). */
export function PausedBanner({reasons, className}: PausedBannerProps) {
  const key = reasons.join(',');
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    setDismissedKey((prev) => (prev !== null && prev !== key ? null : prev));
  }, [key]);

  if (reasons.length === 0 || dismissedKey === key) return null;

  const blocking = reasons.some((r) => DANGER_REASONS.has(r));

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-2 px-3 py-1.5 text-[.78rem] font-semibold',
        blocking ? 'bg-danger-wash text-danger' : 'bg-warn-wash text-warn',
        className,
      )}
    >
      <TriangleAlert size={14} strokeWidth={2.4} className="flex-none" />
      <span className="min-w-0 flex-1">{reasons.map((r) => REASON_COPY[r].label).join(' · ')}</span>
      {blocking ? null : (
        <Button
          variant="ghost"
          size="sm"
          noHaptic
          aria-label="Dismiss"
          onClick={() => setDismissedKey(key)}
          className="h-6 w-6 flex-none border-current/35 bg-transparent p-0 text-current hover:border-current hover:text-current"
        >
          <X size={13} strokeWidth={2.4} />
        </Button>
      )}
    </div>
  );
}
