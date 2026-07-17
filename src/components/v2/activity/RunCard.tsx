import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip, type ChipProps} from '@/components/v2/ui/Chip';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {ChevronRight} from 'lucide-react';

export interface RunMetric {
  value: number | string;
  unit?: string;
  label: string;
  /** Highlights the one "hero" number — concept reserves this for coverage on completed runs. */
  accent?: boolean;
}

export interface RunCardProps {
  plan: string;
  statusLabel: string;
  statusVariant: ChipProps['variant'];
  /** Mono timestamp line, e.g. "Mon · 09:30–11:22" (mobile) or "Mon · 09:30" (compact). */
  timestamp: string;
  metrics: [RunMetric, RunMetric, RunMetric];
  /** Desktop sidebar rendering: a smaller selectable list item instead of the full mobile card. */
  compact?: boolean;
  selected?: boolean;
  /** Mobile: makes the card tappable, opening the run's full-screen detail drill-in. */
  onSelect?: () => void;
  className?: string;
}

/** Yarbo-style run summary — plan name, status chip, timestamp, and the three numbers that
 *  matter (concept "Activity · history"). `compact` swaps the boxed mobile metric tiles for
 *  the desktop sidebar's plain inline trio, and becomes selectable when `onSelect` is given. */
export function RunCard({
  plan,
  statusLabel,
  statusVariant,
  timestamp,
  metrics,
  compact,
  selected,
  onSelect,
  className,
}: RunCardProps) {
  if (compact) {
    const content = (
      <>
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-[.92rem] font-[650] tracking-tight text-ink">{plan}</span>
          <Chip variant={statusVariant}>{statusLabel}</Chip>
        </div>
        <span className="font-mono text-[.76rem] tabular-nums text-ink-soft">{timestamp}</span>
        <div className="flex gap-[1.1rem]">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className={cn('tabular-nums text-[.84rem] font-[640]', m.accent ? 'text-accent' : 'text-ink')}>
                {m.value}
                {m.unit ? <span className="text-[.7rem] font-semibold text-ink-faint"> {m.unit}</span> : null}
              </div>
              <div className="font-mono text-[.62rem] uppercase tracking-[.06em] text-ink-faint">{m.label}</div>
            </div>
          ))}
        </div>
      </>
    );

    if (onSelect) {
      return (
        <Button
          type="button"
          variant="soft"
          onClick={onSelect}
          className={cn(
            'h-auto w-full cursor-pointer flex-col items-start gap-[.5rem] rounded-[16px] border p-[.8rem] text-left hover:bg-surface',
            selected ? 'border-accent ring-2 ring-accent-wash' : 'border-transparent',
            className,
          )}
        >
          {content}
        </Button>
      );
    }

    return (
      <div className={cn('flex flex-col gap-[.5rem] rounded-[16px] bg-surface-2 p-[.8rem]', className)}>{content}</div>
    );
  }

  const content = (
    <>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-[.9rem] font-[660] tracking-tight text-ink">{plan}</span>
        <span className="flex flex-none items-center gap-1.5">
          <Chip variant={statusVariant}>{statusLabel}</Chip>
          {onSelect ? <ChevronRight size={16} strokeWidth={2.4} className="text-ink-faint" /> : null}
        </span>
      </div>
      <span className="font-mono text-[.7rem] tabular-nums text-ink-faint">{timestamp}</span>
      <div className="flex w-full gap-2">
        {metrics.map((m) => (
          <KpiTile key={m.label} value={m.value} unit={m.unit} label={m.label} accent={m.accent} className="flex-1" />
        ))}
      </div>
    </>
  );

  if (onSelect) {
    return (
      <Button
        type="button"
        variant="soft"
        onClick={onSelect}
        className={cn(
          'h-auto w-full cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-[.8rem] text-left shadow-sm hover:bg-surface-2',
          className,
        )}
      >
        {content}
      </Button>
    );
  }

  return <Card className={cn('flex flex-col gap-2 p-[.8rem]', className)}>{content}</Card>;
}
