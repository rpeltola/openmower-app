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
 *  into one continuous divided card so the wider column reads as a single timeline. */
export function EventTimeline({groups, className}: EventTimelineProps) {
  return (
    <div className={cn('flex flex-col gap-2 md:mx-auto md:w-full md:max-w-2xl md:gap-0', className)}>
      {groups.map((group) => (
        <div key={group.day} className="flex flex-col gap-2 md:gap-0">
          <span className="mt-1 font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint first:mt-0 md:mt-4 md:first:mt-0">
            {group.day}
          </span>
          <div className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border">
            {group.events.map((event) => (
              <Card
                key={event.text}
                className="px-3 py-1 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:shadow-none"
              >
                <FeedRow icon={event.icon} tone={event.tone} text={event.text} time={event.time} />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
