'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {ListRow} from '@/components/v2/ui/ListRow';
import {ScreenHeader} from '@/components/v2/ui/ScreenHeader';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Check, ChevronRight, Lock, Wifi} from 'lucide-react';

type StepStatus = 'done' | 'current' | 'locked';

interface Step {
  label: string;
  status: StepStatus;
}

// Strict order + exact copy from the concept's "F · ONBOARDING — CONNECT + PLACE" slot
// (openmower-app-concept.html line 1687-1728) and its desktop counterpart.
const STEPS: Step[] = [
  {label: 'Connect to mower', status: 'done'},
  {label: 'Set the datum', status: 'current'},
  {label: 'Draw first area', status: 'locked'},
  {label: 'Record dock', status: 'locked'},
];

function StepBadge({status}: {status: StepStatus}) {
  if (status === 'done') {
    return (
      <div className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent text-white">
        <Check size={13} strokeWidth={3} />
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent-wash text-accent">
        <Lock size={13} strokeWidth={2.2} />
      </div>
    );
  }
  return (
    <div className="grid h-7 w-7 flex-none place-items-center rounded-full bg-surface-2 text-ink-faint">
      <Lock size={13} strokeWidth={2.2} />
    </div>
  );
}

function StepTrailing({status}: {status: StepStatus}) {
  if (status === 'done') {
    return <span className="text-[.7rem] font-semibold text-accent">Done</span>;
  }
  if (status === 'current') {
    return <ChevronRight size={14} strokeWidth={2.4} className="text-accent" />;
  }
  return <span className="text-[.7rem] text-ink-faint">Locked</span>;
}

/** Onboarding — guided setup: a strict ordered checklist where only the current step is
 *  active and a single primary action moves it forward (concept caption, mobile line 1727 /
 *  desktop line 1212 — "One step unlocks the next"). */
export function OnboardingScreen() {
  const current = STEPS.find((s) => s.status === 'current');

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col gap-4 p-6 md:min-h-0 md:py-10">
      <ScreenHeader kicker="Setup" title="Get started" />
      <p className="m-0 text-[.9rem] leading-[1.5] text-ink-soft">
        A few steps, in order — each one unlocks the next.
      </p>

      <Card className="flex flex-col p-0 px-[.9rem]">
        {STEPS.map((step, i) => (
          <ListRow
            key={step.label}
            icon={<StepBadge status={step.status} />}
            title={step.label}
            trailing={<StepTrailing status={step.status} />}
            className={cn(
              'py-[.65rem]',
              i < STEPS.length - 1 && 'border-b border-border',
              step.status === 'locked' && 'opacity-55',
            )}
          />
        ))}
      </Card>

      <StatePill
        tone="accent"
        icon={<Wifi size={15} strokeWidth={2.2} />}
        label="Connected to mower"
        sub="YardForce · Kotipiha · signal strong"
      />

      <Button variant="primary" className="mt-auto justify-center">
        Continue{current ? ` · ${current.label}` : ''}
      </Button>
    </div>
  );
}
