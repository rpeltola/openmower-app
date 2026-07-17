'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import type {ConnectionStatus} from '@/lib/v2/useConnectionStatus';
import {Loader2, WifiOff} from 'lucide-react';

export interface ConnectionBannerProps {
  status: ConnectionStatus;
  onReconnect: () => void;
  className?: string;
}

const COPY: Partial<Record<ConnectionStatus, {tone: 'warn' | 'danger'; message: string}>> = {
  reconnecting: {tone: 'warn', message: 'Reconnecting…'},
  disconnected: {tone: 'danger', message: 'Disconnected from mower'},
  offline: {tone: 'warn', message: "You're offline"},
};

/** Global, non-dismissible connection-problem strip — mounted once in AppShell, above every
 *  /v2 screen's own header. Hidden (zero height, not just invisible) for 'connecting'/
 *  'connected' so a healthy connection never nudges the layout; a height/opacity transition
 *  keeps the appear/disappear from being a jump cut. */
export function ConnectionBanner({status, onReconnect, className}: ConnectionBannerProps) {
  const entry = COPY[status];
  const reconnecting = status === 'reconnecting';

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out',
        entry ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
    >
      <div className="overflow-hidden">
        {entry ? (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-[.78rem] font-semibold',
              entry.tone === 'danger' ? 'bg-danger-wash text-danger' : 'bg-warn-wash text-warn',
            )}
          >
            {reconnecting ? (
              <Loader2 size={14} strokeWidth={2.4} className="flex-none animate-spin" />
            ) : (
              <WifiOff size={14} strokeWidth={2.4} className="flex-none" />
            )}
            <span className="min-w-0 flex-1 truncate">{entry.message}</span>
            {reconnecting ? null : (
              <Button
                variant="ghost"
                size="sm"
                noHaptic
                onClick={onReconnect}
                className="h-6 flex-none border-current/35 bg-transparent px-2 text-[.72rem] text-current hover:border-current hover:text-current"
              >
                Reconnect
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
