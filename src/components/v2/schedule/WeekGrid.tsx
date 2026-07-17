import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {cn} from '@/components/v2/lib/cn';

export interface WeekGridDay {
  label: string;
  active: boolean;
  today?: boolean;
}

export interface WeekGridProps {
  days: WeekGridDay[];
  windowLabel: string;
  onClick?: () => void;
  className?: string;
}

/** Concept mobile Schedule `.card.hair` weekly grid — 7 day bars (scheduled days lit in
 *  accent, today outlined) + the run window caption underneath. Tappable to open the
 *  editor for the rule it represents (task: "opened from the plan e.g. tapping a rule"). */
export function WeekGrid({days, windowLabel, onClick, className}: WeekGridProps) {
  const content = (
    <>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d, i) => (
          <span key={i} className="font-mono text-[.62rem] text-ink-faint">
            {d.label}
          </span>
        ))}
      </div>
      <div className="mt-[5px] grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={cn(
              'h-[38px] rounded-lg',
              d.active ? 'bg-accent opacity-[.92]' : 'bg-surface-2',
              d.today && 'outline outline-2 outline-offset-1 outline-accent',
            )}
          />
        ))}
      </div>
      <div className="mt-1.5 text-center font-mono text-[.6rem] text-ink-faint">{windowLabel}</div>
    </>
  );

  if (onClick) {
    return (
      <Button
        variant="ghost"
        onClick={onClick}
        className={cn(
          'h-auto w-full flex-col items-stretch justify-start gap-0 rounded-2xl border border-border bg-surface pb-[.8rem] pl-[.7rem] pr-[.7rem] pt-[.7rem] text-left font-normal',
          className,
        )}
      >
        {content}
      </Button>
    );
  }

  return <Card className={cn('pb-[.8rem] pl-[.7rem] pr-[.7rem] pt-[.7rem]', className)}>{content}</Card>;
}
