'use client';

// Dev-only gallery of the v2 "state screens" — booting, height-confirm, paused/blocker and
// onboarding — stacked with labels for visual review. Mirrors the /v2/kit gallery pattern
// (src/app/v2/kit/page.tsx). Not linked in nav; reachable at /v2/states.
import {BootingScreen} from '@/components/v2/states/BootingScreen';
import {HeightConfirmScreen} from '@/components/v2/states/HeightConfirmScreen';
import {OnboardingScreen} from '@/components/v2/states/OnboardingScreen';
import {PausedBlockerScreen} from '@/components/v2/states/PausedBlockerScreen';
import {Button} from '@/components/v2/ui/Button';
import {simulateConnectionStatus, type ConnectionStatus} from '@/lib/v2/useConnectionStatus';

const CONNECTION_STATES: {status: ConnectionStatus; label: string}[] = [
  {status: 'connected', label: 'Connected (hide banner)'},
  {status: 'reconnecting', label: 'Reconnecting'},
  {status: 'disconnected', label: 'Disconnected'},
  {status: 'offline', label: 'Offline'},
];

function StateSlot({title, sub, children}: {title: string; sub: string; children: React.ReactNode}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-mono text-[.7rem] font-semibold uppercase tracking-[.1em] text-ink-faint">{title}</h2>
        <p className="mt-0.5 text-[.82rem] text-ink-soft">{sub}</p>
      </div>
      <div className="h-[620px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-bg">
        {children}
      </div>
    </section>
  );
}

export default function StatesPage() {
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8 p-5">
      <header>
        <div className="font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">
          v2 design system
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink md:text-[1.4rem]">
          State screens — &ldquo;a wait with a face&rdquo;
        </h1>
      </header>

      <StateSlot title="Booting" sub="Every subsystem gets its own line and honest status — a spinner is never a black box.">
        <BootingScreen />
      </StateSlot>

      <StateSlot
        title="Height confirm · AWAITING_HEIGHT_CONFIRM"
        sub="No motorized deck, so a height change becomes a calm, purpose-built blocking screen."
      >
        <HeightConfirmScreen />
      </StateSlot>

      <StateSlot
        title="Paused · blockers as data"
        sub="RTK lost mid-mow grows the uncertainty ring; Mow stays disabled with its reason, Dock is still one tap away."
      >
        <PausedBlockerScreen />
      </StateSlot>

      <StateSlot title="Onboarding" sub="A strict order, live connection status, a single primary action at a time.">
        <OnboardingScreen />
      </StateSlot>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-mono text-[.7rem] font-semibold uppercase tracking-[.1em] text-ink-faint">
            Connection banner
          </h2>
          <p className="mt-0.5 text-[.82rem] text-ink-soft">
            Demo trigger for the global AppShell banner (no live MQTT to fail on purpose) — jump to any
            other /v2 screen after picking one to see it. Same effect as <code>?conn=disconnected</code>{' '}
            on any /v2 URL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CONNECTION_STATES.map((s) => (
            <Button
              key={s.status}
              variant="ghost"
              size="sm"
              onClick={() => simulateConnectionStatus(s.status)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
