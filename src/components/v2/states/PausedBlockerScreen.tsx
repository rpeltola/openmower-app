'use client';

import {cn} from '@/components/v2/lib/cn';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {StatCard} from '@/components/v2/ui/StatCard';
import {StatePill} from '@/components/v2/ui/StatePill';
import {Home as DockIcon, Play, TriangleAlert} from 'lucide-react';
import {useId} from 'react';

const MOW = {area: 'Etupiha', batteryPct: 71};

/** The garden outline + mowed lanes + robot/dock markers, plus a growing dashed uncertainty
 *  ring around the robot — the concept's "blockers as data" beat: RTK lost mid-mow grows the
 *  ring instead of hiding it (openmower-app-concept.html line 1634-1685). Chrome only, no
 *  live map wiring. */
function PausedMapSvg() {
  const clipId = useId();
  return (
    <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <rect width="300" height="300" fill="var(--map)" />
      <g stroke="var(--map-line)" strokeWidth="1" opacity=".5">
        <path d="M0 100h300M0 200h300M100 0v300M200 0v300" />
      </g>
      <path d="M40 50 L250 40 L262 150 L232 250 L70 262 L30 150 Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      <clipPath id={clipId}>
        <path d="M40 50 L250 40 L262 150 L232 250 L70 262 L30 150 Z" />
      </clipPath>
      <g clipPath={`url(#${clipId})`} stroke="var(--mowed)" strokeWidth="10" strokeLinecap="round" opacity=".9">
        <path d="M45 150h210M48 168h204M52 186h192M56 204h176M62 222h150M70 240h120" />
      </g>
      {/* growing position-uncertainty ring */}
      <circle cx="150" cy="150" r="46" fill="var(--warn-wash)" opacity=".5" />
      <circle cx="150" cy="150" r="46" fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeDasharray="6 5" opacity=".85" />
      <g transform="translate(150,150)">
        <rect x="-12" y="-12" width="24" height="24" rx="7" fill="var(--accent-bright)" />
        <path d="M0 -18 L5 -11 L-5 -11 Z" fill="var(--accent)" />
      </g>
      <g transform="translate(244,150)">
        <rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />
      </g>
    </svg>
  );
}

function BlockerControls({className}: {className?: string}) {
  return (
    <div className={cn('flex flex-col gap-[.55rem]', className)}>
      <p className="m-0 text-[.8rem] leading-[1.45] text-ink-soft">
        The mower stopped itself — it won&rsquo;t drive on a position it can&rsquo;t trust.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled className="flex-1 justify-center">
          <Play size={16} fill="currentColor" />
          Mow
        </Button>
        <Chip variant="warn" className="flex-none">
          Needs a GPS fix
        </Chip>
      </div>
      <Button variant="ghost" className="justify-center">
        <DockIcon size={15} strokeWidth={2.2} />
        Dock
      </Button>
    </div>
  );
}

/** PAUSED / blockers-as-data: RTK lost mid-mow grows the uncertainty ring; Mow stays
 *  disabled with its reason attached, Dock is still one tap away (concept caption, mobile
 *  line 1684). */
export function PausedBlockerScreen() {
  return (
    <div className="flex min-h-full flex-col p-4 md:h-full md:min-h-0 md:p-6">
      {/* ===== Mobile: map fills the screen, controls float as a bottom sheet-style card ===== */}
      <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-[var(--radius-card)] border border-border md:hidden">
        <PausedMapSvg />

        <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap gap-2">
          <OverlayChip>
            <span className="text-warn">●</span> RTK lost
          </OverlayChip>
          <OverlayChip>🔋 {MOW.batteryPct}%</OverlayChip>
          <OverlayChip className="ml-auto">{MOW.area}</OverlayChip>
        </div>

        <StatePill
          tone="warn"
          icon={<TriangleAlert size={16} strokeWidth={2.4} />}
          label="Paused · Waiting for GPS fix"
          sub="Position uncertainty is growing"
          className="absolute inset-x-3 top-[3.1rem] z-10 shadow-[var(--shadow-m)]"
        />

        <StatCard className="absolute inset-x-3 bottom-3 z-10">
          <BlockerControls />
        </StatCard>
      </div>

      {/* ===== Desktop: map card + a persistent side panel for the blocked controls ===== */}
      <div className="hidden md:grid md:min-h-0 md:flex-1 md:grid-cols-[1fr_320px] md:gap-4">
        <Card className="relative overflow-hidden p-0">
          <PausedMapSvg />
          <StatePill
            tone="warn"
            icon={<TriangleAlert size={16} strokeWidth={2.4} />}
            label="Paused"
            sub="Waiting for GPS fix"
            className="absolute left-3 top-3 z-10 w-fit shadow-[var(--shadow-m)]"
          />
        </Card>

        <Card className="flex flex-col gap-[.9rem] p-4">
          <BlockerControls />
        </Card>
      </div>
    </div>
  );
}
