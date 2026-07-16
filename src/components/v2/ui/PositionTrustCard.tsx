import {cn} from '@/components/v2/lib/cn';
import {Card} from '@/components/v2/ui/Card';
import {SatelliteDish} from 'lucide-react';
import {type ReactNode} from 'react';

export interface PositionTrustCardProps {
  state: string;
  detail: string;
  icon?: ReactNode;
  className?: string;
}

/** Mobile position-trust footer: RTK/GPS state + trusted-accuracy readout. */
export function PositionTrustCard({
  state,
  detail,
  icon = <SatelliteDish size={15} strokeWidth={2.2} />,
  className,
}: PositionTrustCardProps) {
  return (
    <Card className={cn('flex items-center gap-2.5 border-none bg-surface-2 p-3 shadow-none', className)}>
      <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-accent-wash text-accent">
        {icon}
      </div>
      <div className="flex-1 leading-tight">
        <div className="text-[.82rem] font-semibold text-ink">{state}</div>
        <div className="text-[.72rem] text-ink-soft">{detail}</div>
      </div>
    </Card>
  );
}
