'use client';

import {MowerSelector} from '@/components/v2/MowerSelector';
import {cn} from '@/components/v2/lib/cn';
import {BootingScreen} from '@/components/v2/states/BootingScreen';
import {ErrorScreen} from '@/components/v2/states/ErrorScreen';
import {PausedBanner} from '@/components/v2/states/PausedBanner';
import {Button} from '@/components/v2/ui/Button';
import {ConnectionBanner} from '@/components/v2/ui/ConnectionBanner';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {STATE_COPY, type Tone} from '@/lib/v2/robotState';
import {useConnectionStatus} from '@/lib/v2/useConnectionStatus';
import {useRobotState} from '@/lib/v2/useRobotState';
import {useRobotStateSnapshot} from '@/lib/v2/useRobotStateSnapshot';
import {
  Activity,
  Calendar,
  ChevronDown,
  Gauge,
  Home,
  Map as MapIcon,
  MoreHorizontal,
  Settings,
  Tractor,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';

// Same tone -> color mapping as StatePill's icon chip (StatePill.tsx), just as a plain dot here.
const TONE_DOT_BG: Record<Tone, string> = {
  accent: 'bg-accent',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-ink-soft',
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shows the unread-activity dot (design-language.md's Activity tab badge). */
  alert?: boolean;
}

// 5-tab mobile IA (mobile-architecture.md). "More" folds Diagnostics/Settings/everything
// else that the desktop sidebar lists separately.
const MOBILE_TABS: NavItem[] = [
  {href: '/v2', label: 'Home', icon: Home},
  {href: '/v2/map', label: 'Map', icon: MapIcon},
  {href: '/v2/schedule', label: 'Schedule', icon: Calendar},
  {href: '/v2/activity', label: 'Activity', icon: Activity, alert: true},
  {href: '/v2/more', label: 'More', icon: MoreHorizontal},
];

// Desktop sidebar splits "More" back out into Diagnostics + Settings.
const DESKTOP_NAV: NavItem[] = [
  {href: '/v2', label: 'Home', icon: Home},
  {href: '/v2/map', label: 'Map', icon: MapIcon},
  {href: '/v2/schedule', label: 'Schedule', icon: Calendar},
  {href: '/v2/activity', label: 'Activity', icon: Activity, alert: true},
  {href: '/v2/diagnostics', label: 'Diagnostics', icon: Gauge},
  {href: '/v2/settings', label: 'Settings', icon: Settings},
];

function isActive(pathname: string, href: string) {
  return href === '/v2' ? pathname === '/v2' : pathname.startsWith(href);
}

export interface AppShellProps {
  children: React.ReactNode;
}

/** The responsive layout pattern (component-library.md §4.2): mobile = a fixed bottom tab
 *  bar, desktop (md+) = a persistent left sidebar. One component, `md:` reflow — both trees
 *  render, only visibility toggles, so there's no hydration-order flash between them
 *  (matches the convention already used in ManualControl.tsx). Wraps every /v2 route under
 *  the `(shell)` route group; `/v2/control` opts out (its own full-screen Close). */
export function AppShell({children}: AppShellProps) {
  const pathname = usePathname() ?? '/v2';
  const [mowerSelectorOpen, setMowerSelectorOpen] = useState(false);
  const {status: connectionStatus, reconnect} = useConnectionStatus();
  const {state, isMowing, isPlanning, areaName, coveragePct, stateDetail} = useRobotState();
  const {reasons, error} = useRobotStateSnapshot();
  const stateCopy = STATE_COPY[state];

  // BOOTING/ERROR are a full-screen blocking takeover (STATE_COMMAND_MODEL.md §3) -- there's
  // nothing useful to navigate to yet (BOOTING) or the robot needs attention before anything
  // else matters (ERROR), so neither the sidebar/tab bar nor the route's own content mounts.
  // The connection banner still shows -- knowing whether the gateway itself is even reachable is
  // exactly what you want while staring at a boot checklist or an error screen.
  if (state === 'BOOTING' || state === 'ERROR') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col">
        <ConnectionBanner status={connectionStatus} onReconnect={reconnect} />
        <div className="flex min-h-0 flex-1 items-center justify-center bg-surface p-4">
          {state === 'BOOTING' ? <BootingScreen /> : <ErrorScreen code={error?.code} />}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] md:h-dvh">
      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden w-[248px] flex-none flex-col gap-1 border-r border-border bg-surface-2 p-3 md:flex">
        <div className="flex items-center gap-2 px-2 pb-3 pt-1">
          <div className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-accent text-white">
            <Tractor size={17} strokeWidth={2.2} />
          </div>
          <span className="text-[1.02rem] font-bold tracking-tight text-ink">OpenMower</span>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setMowerSelectorOpen(true)}
          className="mb-1.5 h-auto gap-2 rounded-[10px] bg-surface px-2.5 py-2 text-left"
        >
          <div className="h-[26px] w-[26px] flex-none rounded-[7px]" style={{background: '#F26A1B'}} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[.82rem] font-semibold text-ink">YardForce</div>
            <div className="truncate text-[.7rem] text-ink-soft">Kotipiha</div>
          </div>
          <ChevronDown size={15} className="flex-none text-ink-faint" />
        </Button>

        <nav className="flex flex-col gap-1">
          {DESKTOP_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-semibold',
                  active ? 'bg-accent-wash text-accent' : 'text-ink-soft hover:text-ink',
                )}
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
                {item.alert ? <span className="ml-auto h-[7px] w-[7px] flex-none rounded-full bg-danger" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* sidestate — the always-visible status card at the foot of the sidebar */}
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[.82rem] font-semibold text-ink">
            <span className={cn('h-2 w-2 flex-none rounded-full', TONE_DOT_BG[stateCopy.tone])} />
            {isMowing && areaName
              ? `${stateCopy.label} · ${areaName}`
              : isPlanning && stateDetail?.phase
                ? stateDetail.phase
                : stateCopy.label}
          </div>
          {/* No mission ETA wired yet — mowing shows real coverage only, never a fabricated
              "min left"; other states fall back to STATE_COPY's sub line. */}
          <div className="my-1 text-xs text-ink-soft">
            {isMowing
              ? `${coveragePct ?? 0}% mowed`
              : isPlanning
                ? `${Math.round(stateDetail?.progress ?? 0)}%`
                : stateCopy.sub}
          </div>
          {isMowing ? (
            <ProgressBar value={coveragePct ?? 0} className="h-[5px]" />
          ) : isPlanning ? (
            <ProgressBar value={stateDetail?.progress ?? 0} className="h-[5px]" />
          ) : null}
        </div>
      </aside>

      {/* ---- Content + mobile bottom tab bar ---- */}
      {/* Mobile screens sit on the white surface (concept `.screen{background:var(--surface)}`)
          so surface-2 tiles/cards read; desktop keeps the tinted `--bg` canvas. */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col bg-surface md:min-h-0 md:bg-transparent">
        <ConnectionBanner status={connectionStatus} onReconnect={reconnect} />
        {state === 'PAUSED' ? <PausedBanner reasons={reasons} /> : null}

        <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-between border-t border-border bg-surface px-3 pb-[calc(.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
          {MOBILE_TABS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center gap-[3px] text-[.6rem] font-semibold',
                  active ? 'text-accent' : 'text-ink-faint',
                )}
              >
                <span className="relative">
                  <Icon size={19} strokeWidth={2} />
                  {item.alert ? (
                    <span className="absolute -right-[3px] -top-[1px] h-[6px] w-[6px] rounded-full bg-danger" />
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <MowerSelector open={mowerSelectorOpen} onClose={() => setMowerSelectorOpen(false)} />
    </div>
  );
}
