import {cn} from '@/components/v2/lib/cn';
import {Card} from '@/components/v2/ui/Card';
import {FeedRow, type FeedRowProps} from '@/components/v2/ui/FeedRow';
import {type ReactNode} from 'react';

export interface ActivityEvent {
  /** Stable key for selection (map pins, detail sheets) — optional since most feeds only
   *  ever render passively and key off `text`. */
  id?: string;
  icon: ReactNode;
  tone: FeedRowProps['tone'];
  text: string;
  time: string;
  /** Short category shown as the event-detail sheet's kicker, e.g. "Safety", "Docking". */
  type?: string;
  /** Mock garden-canvas position (percent, 0-100 on each axis) — where the event happened,
   *  for the Activity · Events map view. */
  location?: {x: number; y: number};
}

export interface ActivityFeedCardProps {
  title?: string;
  events: ActivityEvent[];
  className?: string;
}

/** Desktop "Recent activity" card: label + divided list of FeedRow events. */
export function ActivityFeedCard({title = 'Recent activity', events, className}: ActivityFeedCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-2.5 font-mono text-[.7rem] font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </div>
      <div className="divide-y divide-border">
        {events.map((event) => (
          <FeedRow key={event.text} icon={event.icon} tone={event.tone} text={event.text} time={event.time} />
        ))}
      </div>
    </Card>
  );
}
