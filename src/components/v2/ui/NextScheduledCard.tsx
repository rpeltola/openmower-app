import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Clock} from 'lucide-react';

export interface NextScheduledCardProps {
  when: string;
  detail: string;
  label?: string;
  onEdit?: () => void;
  className?: string;
}

/** Desktop "Next scheduled" card: clock icon + when/detail + Edit action. */
export function NextScheduledCard({label = 'Next scheduled', when, detail, onEdit, className}: NextScheduledCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="mb-2 font-mono text-[.7rem] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="flex items-center gap-2.5">
        <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-info-wash text-info">
          <Clock size={17} strokeWidth={2} />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[.92rem] font-semibold text-ink">{when}</div>
          <div className="text-[.78rem] text-ink-soft">{detail}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </Card>
  );
}
