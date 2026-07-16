import {cn} from '@/components/v2/lib/cn';
import {type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Card} from '@/components/v2/ui/Card';
import {FeedRow} from '@/components/v2/ui/FeedRow';

export interface TimelineGroup {
  /** Mono day header, e.g. "Today", "Yesterday". */
  day: string;
  events: ActivityEvent[];
}

export interface EventTimelineProps {
  groups: TimelineGroup[];
  className?: string;
}

/** Day-grouped state-change feed (concept "Activity · events") — every event gets its own
 *  row, timestamped, colored only by semantic tone. Mobile renders each row as its own
 *  bordered card under a mono day header (concept exactly); desktop folds the same groups
 *  into one continuous divided list inside a single bounded card, left-aligned in a
 *  readable column rather than floating centered with empty margins either side. */
export function EventTimeline({groups, className}: EventTimelineProps) {
  return (
    <div className={cn('flex flex-col gap-2 md:max-w-[720px] md:gap-0', className)}>
      {/* ---- Mobile: bordered per-row cards under a mono day header ---- */}
      <div className="flex flex-col gap-2 md:hidden">
        {groups.map((group) => (
          <div key={group.day} className="flex flex-col gap-2">
            <span className="mt-1 font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint first:mt-0">
              {group.day}
            </span>
            <div className="flex flex-col gap-2">
              {group.events.map((event) => (
                <Card key={event.text} className="px-3 py-1">
                  <FeedRow icon={event.icon} tone={event.tone} text={event.text} time={event.time} />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---- Desktop: one bounded card holding the divided timeline ---- */}
      <Card className="hidden md:block md:p-4">
        {groups.map((group, i) => (
          <div key={group.day} className={cn('flex flex-col', i > 0 && 'mt-4')}>
            <span className="font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">
              {group.day}
            </span>
            <div className="flex flex-col divide-y divide-border">
              {group.events.map((event) => (
                <FeedRow key={event.text} icon={event.icon} tone={event.tone} text={event.text} time={event.time} />
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
