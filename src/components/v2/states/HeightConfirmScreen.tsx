import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';
import {ArrowRight, Check, MoveVertical} from 'lucide-react';

// Mock world matching the concept's "5 · HEIGHT CONFIRM" slot (openmower-app-concept.html
// line 528-553): Etupiha's last job cut at 60 mm, this job wants 45 mm.
const HEIGHT_CHANGE = {area: 'Etupiha', fromMm: 60, toMm: 45};

/** AWAITING_HEIGHT_CONFIRM — because there's no motorized deck, a cutting-height change
 *  becomes a calm, blocking state instead of a silent stall: the mower asks, then waits
 *  (concept caption, mobile line 552 — "a wait with a face"). */
export function HeightConfirmScreen() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 md:min-h-0 md:py-10">
      <Card className="flex w-full max-w-[420px] flex-col gap-[.9rem] p-5">
        <div className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl bg-warn-wash text-warn">
          <MoveVertical size={26} strokeWidth={2} />
        </div>

        <h2 className="text-[1.28rem] font-bold leading-[1.15] tracking-tight text-ink">
          Set the deck to&nbsp;45&nbsp;mm
        </h2>

        <p className="text-[.92rem] leading-[1.5] text-ink-soft">
          &ldquo;{HEIGHT_CHANGE.area}&rdquo; cuts lower than your last job{' '}
          <span className="tabular-nums">({HEIGHT_CHANGE.fromMm} mm)</span>. Adjust the height on the mower, then
          confirm — mowing won&rsquo;t start until you do.
        </p>

        <div className="flex flex-wrap items-center gap-[.7rem] rounded-[var(--radius-card)] bg-surface-2 px-[.95rem] py-[.85rem]">
          <span className="text-[1.5rem] font-bold tabular-nums text-ink-faint">{HEIGHT_CHANGE.fromMm}</span>
          <ArrowRight size={20} strokeWidth={2.4} className="flex-none text-ink-faint" />
          <span className="text-[1.5rem] font-bold tabular-nums text-accent">{HEIGHT_CHANGE.toMm}</span>
          <span className="text-[.8rem] text-ink-soft">mm</span>
          <Chip variant="warn" className="ml-auto">
            Paused, safe
          </Chip>
        </div>

        <FeatureGate feature="cuttingHeight">
          <Button variant="primary" className="justify-center">
            <Check size={17} strokeWidth={2.6} />
            Height is set — continue
          </Button>
          <Button variant="ghost" className="justify-center">
            Skip this area
          </Button>
        </FeatureGate>
      </Card>
    </div>
  );
}
