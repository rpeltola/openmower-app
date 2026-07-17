'use client';

import {Sheet} from '@/components/v2/ui/Sheet';
import {FeedRow, type FeedRowProps} from '@/components/v2/ui/FeedRow';
import {BatteryWarning, CheckCircle2, CloudRain, Sprout, TriangleAlert} from 'lucide-react';
import {type ReactNode} from 'react';

interface MockNotification {
  icon: ReactNode;
  tone: FeedRowProps['tone'];
  text: string;
  time: string;
}

interface NotificationGroup {
  label: string;
  items: MockNotification[];
}

// Mock notifications matching notifications.md's category set (safety/complete/stuck/
// rain-skip/low-battery), grouped by recency the way the concept groups Activity's day feed.
const GROUPS: NotificationGroup[] = [
  {
    label: 'Today',
    items: [
      {
        icon: <CheckCircle2 size={14} strokeWidth={2.4} />,
        tone: 'accent',
        text: 'Mowing complete · Etupiha',
        time: '09:32',
      },
      {
        icon: <CloudRain size={13} strokeWidth={2.2} />,
        tone: 'info',
        text: 'Rain-skip — this morning’s run was postponed',
        time: '07:15',
      },
    ],
  },
  {
    label: 'Yesterday',
    items: [
      {
        icon: <TriangleAlert size={13} strokeWidth={2.2} />,
        tone: 'danger',
        text: 'RTK lost mid-mow — position degraded',
        time: '18:42',
      },
      {
        icon: <BatteryWarning size={13} strokeWidth={2.2} />,
        tone: 'warn',
        text: 'Low battery — returned to dock early',
        time: '14:03',
      },
      {
        icon: <Sprout size={13} strokeWidth={2.2} />,
        tone: 'accent',
        text: 'Mowing started · Etupiha',
        time: '13:10',
      },
    ],
  },
];

export interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

/** Sheet opened from Home's bell icon. Concept has no dedicated notification-list mockup —
 *  this follows the Activity feed's day-grouped, semantic-icon language (FeedRow) instead of
 *  inventing a new visual system. Mock data only; real delivery is notifications.md's W10
 *  push work, not this sheet. */
export function NotificationCenter({open, onClose}: NotificationCenterProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Notifications" className="max-h-[75vh] gap-4 overflow-y-auto">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <div className="font-mono text-[.62rem] font-semibold uppercase tracking-[.08em] text-ink-faint">
            {group.label}
          </div>
          <div className="divide-y divide-border">
            {group.items.map((item) => (
              <FeedRow key={item.text} icon={item.icon} tone={item.tone} text={item.text} time={item.time} />
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
