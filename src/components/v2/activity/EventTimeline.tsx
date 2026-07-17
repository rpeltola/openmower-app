import {cn} from '@/components/v2/lib/cn';
import {type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {FeedRow} from '@/components/v2/ui/FeedRow';

export interface TimelineGroup {
  /** Mono day header, e.g. "Today", "Yesterday". */
  day: string;
  events: ActivityEvent[];
}

export interface EventTimelineProps {
  groups: TimelineGroup[];
  /** Opens the event's detail sheet — omit to render the feed passively (e.g. a dashboard
   *  preview) with no click affordance. */
  onSelectEvent?: (event: ActivityEvent) => void;
  className?: string;
}

/** A single event line, optionally wrapped in a `Button` (kit primitive, so app code never
 *  renders a raw `<button>`) so it reads and behaves as tappable when `onSelect` is given. */
function EventRow({event, onSelect, className}: {event: ActivityEvent; onSelect?: () => void; className?: string}) {
  const row = <FeedRow icon={event.icon} tone={event.tone} text={event.text} time={event.time} />;
  if (!onSelect) return <div className={className}>{row}</div>;
  return (
    <Button
      type="button"
      variant="soft"
      onClick={onSelect}
      className={cn(
        'h-auto w-full cursor-pointer justify-start rounded-none border-0 bg-transparent p-0 hover:bg-surface-2',
        className,
      )}
    >
      {row}
    </Button>
  );
}

/** Day-grouped state-change feed (concept "Activity · events") — every event gets its own
 *  row, timestamped, colored only by semantic tone. Mobile renders each row as its own
 *  bordered card under a mono day header (concept exactly); desktop folds the same groups
 *  into one continuous divided list inside a single bounded card, left-aligned in a
 *  readable column rather than floating centered with empty margins either side. */
export function EventTimeline({groups, onSelectEvent, className}: EventTimelineProps) {
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
                <Card key={event.id ?? event.text} className="overflow-hidden p-0">
                  <EventRow
                    event={event}
                    onSelect={onSelectEvent ? () => onSelectEvent(event) : undefined}
                    className="px-3 py-1"
                  />
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
                <EventRow
                  key={event.id ?? event.text}
                  event={event}
                  onSelect={onSelectEvent ? () => onSelectEvent(event) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
