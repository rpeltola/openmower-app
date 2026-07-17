import {cn} from '@/components/v2/lib/cn';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {type ReactNode, useId} from 'react';

export type MowerHeroState = 'mowing' | 'charging' | 'docked' | 'paused' | 'idle';

export interface MowingHeroProps {
  className?: string;
  /** Chip row floated over the top-left of the scene (mobile: state + area + coverage). */
  overlayTop?: ReactNode;
  /** 0–100 — renders a flush progress bar along the bottom edge when set. */
  progress?: number;
  /** Which scene to render — aligns with StatePill's tone vocabulary (accent/warn/info).
   *  Defaults to 'mowing'. */
  state?: MowerHeroState;
}

// 'mowing'/'paused'/'idle' render the mower on the lawn (GroundLayer); 'charging'/'docked'
// render it at the dock (DockLayer). Wash mirrors StatePill's tones: accent for mowing, warn
// for paused, info/blue for charging+docked (design-language.md reserves blue for dock/charge),
// a neutral surface for idle.
const SCENE: Record<MowerHeroState, 'ground' | 'dock'> = {
  mowing: 'ground',
  paused: 'ground',
  idle: 'ground',
  charging: 'dock',
  docked: 'dock',
};

const WASH: Record<MowerHeroState, string> = {
  mowing: 'var(--accent-wash)',
  paused: 'var(--warn-wash)',
  idle: 'var(--surface-2)',
  charging: 'var(--info-wash)',
  docked: 'var(--info-wash)',
};

const ARIA_LABEL: Record<MowerHeroState, string> = {
  mowing: 'Your YardForce mowing the lawn',
  paused: 'Your YardForce, paused on the lawn',
  idle: 'Your YardForce, at rest',
  charging: 'Your YardForce charging at the dock',
  docked: 'Your YardForce docked and ready',
};

// Where the deck cuts — mowed stripe to the left, uncut grass to the right (matches the
// mower art's own footprint, cx ~142-184). Ground layer geometry is expressed relative to this.
const CUT_X = 170;
const AHEAD_SPACING = 14;
const AHEAD_TILE = 56; // 4 tuft variants * spacing — one full scroll cycle
const BEHIND_SPACING = 12;
const BEHIND_TILE = 24; // 2 tick variants * spacing

const TUFT_VARIANTS = ['M0 0 q3 -12 -1 -19', 'M0 0 q3 -14 -1 -20', 'M0 0 q3 -12 -1 -18', 'M0 0 q3 -15 -1 -21'];
const TICK_VARIANTS = ['M0 0v-4', 'M0 0v-5'];

/** Tiles a periodic motif across a zone plus one extra tile of buffer on the trailing (entry)
 *  edge, so scrolling the whole strip by exactly one tile width never reveals a gap — the
 *  loop point ends up pixel-identical to the start. */
function tileForZone(zoneX: number, zoneWidth: number, spacing: number, tileWidth: number): number[] {
  const count = Math.ceil((zoneWidth + tileWidth) / spacing);
  return Array.from({length: count}, (_, i) => zoneX + i * spacing);
}

/** The "on the lawn" scene (mowing/paused/idle) — a fixed mower over a scrolling ground plane.
 *  Uncut grass tiles in ahead of the deck, mowed ticks tile in behind it, both clipped to their
 *  side of `CUT_X` so the tall→short transition reads as happening right at the blade. Only
 *  animates (`driving`) for 'mowing' — paused/idle freeze it as plain scenery. */
function GroundLayer({aheadClipId, behindClipId, driving}: {aheadClipId: string; behindClipId: string; driving: boolean}) {
  const aheadX = tileForZone(CUT_X, 300 - CUT_X, AHEAD_SPACING, AHEAD_TILE);
  const behindX = tileForZone(0, CUT_X, BEHIND_SPACING, BEHIND_TILE);

  return (
    <>
      <rect x="0" y="112" width={CUT_X} height="38" fill="var(--mowed)" opacity=".5" />
      <path d="M0 114h300" stroke="var(--accent)" strokeWidth="1" opacity=".22" />

      <g clipPath={`url(#${behindClipId})`}>
        <g className={driving ? 'mh-ground-behind' : undefined} stroke="var(--mowed)" strokeWidth="2.5" strokeLinecap="round" opacity=".7">
          {behindX.map((x, i) => (
            <path key={x} d={TICK_VARIANTS[i % TICK_VARIANTS.length]} transform={`translate(${x} 114)`} />
          ))}
        </g>
      </g>

      <g clipPath={`url(#${aheadClipId})`}>
        <g className={driving ? 'mh-ground-ahead' : undefined} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity=".8">
          {aheadX.map((x, i) => (
            <g key={x} transform={`translate(${x} 115)`}>
              <g className={driving ? 'mh-tuft' : undefined} style={driving ? {animationDelay: `${(i % 4) * 0.15}s`} : undefined}>
                <path d={TUFT_VARIANTS[i % TUFT_VARIANTS.length]} />
              </g>
            </g>
          ))}
        </g>
      </g>

      {driving ? (
        <g fill="var(--accent-bright)">
          <circle className="mh-clip" cx={CUT_X + 6} cy="106" r="2.4" />
          <circle className="mh-clip" style={{animationDelay: '.55s'}} cx={CUT_X + 9} cy="104" r="1.8" />
          <circle className="mh-clip" style={{animationDelay: '1s'}} cx={CUT_X + 3} cy="108" r="2" />
        </g>
      ) : null}
    </>
  );
}

/** The "at the dock" scene (charging/docked) — a schematic plinth + post (not literal
 *  hardware) behind the mower. Charging adds the `dh-breath` charge beams (ported from
 *  DeviceHeroScene, tinted info/blue here), a pulsing bolt, and a breathing battery fill;
 *  docked shows the same dock calm and full, with no beams/bolt and a static-full gauge. */
function DockLayer({charging}: {charging: boolean}) {
  return (
    <>
      {charging ? (
        <g stroke="var(--info)" strokeWidth="2" strokeLinecap="round">
          <line x1="140" y1="118" x2="140" y2="46" className="dh-breath" style={{animationDelay: '0s'}} />
          <line x1="152" y1="120" x2="152" y2="38" className="dh-breath" style={{animationDelay: '.4s'}} />
          <line x1="172" y1="120" x2="172" y2="38" className="dh-breath" style={{animationDelay: '.8s'}} />
          <line x1="186" y1="118" x2="186" y2="46" className="dh-breath" style={{animationDelay: '1.2s'}} />
        </g>
      ) : null}

      <rect x="112" y="120" width="100" height="9" rx="4" fill="var(--info)" opacity=".2" />
      <rect x="104" y="88" width="8" height="35" rx="3" fill="#2a2f33" />
      <circle cx="108" cy="93" r="2.4" fill={charging ? 'var(--info)' : 'var(--accent-bright)'} className={charging ? 'dh-breath' : undefined} />

      {charging ? <path className="mh-bolt" d="M163 46 L152 66 L161 66 L157 84 L172 60 L162 60 Z" fill="var(--info)" /> : null}

      <rect x="222" y="58" width="26" height="14" rx="2.5" fill="none" stroke="var(--info)" strokeWidth="1.6" />
      <rect x="249" y="62" width="3" height="6" rx="1" fill="var(--info)" />
      <rect x="224.5" y="60.5" width="21" height="9" rx="1" fill="var(--info)" className={charging ? 'mh-battery-fill' : undefined} />
    </>
  );
}

/** The mower vector itself — identical art across every state; only whether it drives
 *  (bob + wheel/blade spin) changes. */
function MowerBody({gradientId, driving}: {gradientId: string; driving: boolean}) {
  return (
    <g className={driving ? 'mh-mower' : undefined}>
      <ellipse cx="160" cy="116" rx="36" ry="6" fill="#000" opacity=".12" />
      <g className={driving ? 'mh-wheel' : undefined}>
        <circle cx="142" cy="110" r="11" fill="#1a1a1e" />
        <g stroke="#050506" strokeWidth="1.6" opacity=".7">
          <path d="M142 101v18M133 110h18M136 104l12 12M148 104l-12 12" />
        </g>
        <circle cx="142" cy="110" r="4" fill="#F26A1B" />
      </g>
      <g className={driving ? 'mh-wheel' : undefined}>
        <circle cx="184" cy="110" r="11" fill="#1a1a1e" />
        <g stroke="#050506" strokeWidth="1.6" opacity=".7">
          <path d="M184 101v18M175 110h18M178 104l12 12M190 104l-12 12" />
        </g>
        <circle cx="184" cy="110" r="4" fill="#F26A1B" />
      </g>
      <g className={driving ? 'mh-blade' : undefined}>
        <circle cx="163" cy="112" r="9" fill="none" stroke="var(--ink-faint)" strokeWidth="1.4" strokeDasharray="4 5" opacity=".7" />
      </g>
      <path d="M128 110 C122 88 138 79 160 79 L174 79 C192 81 200 92 198 110 Z" fill={`url(#${gradientId})`} />
      <path d="M198 110 C200 92 192 81 174 79 L182 80 C196 84 202 96 200 110 Z" fill="#C8500E" opacity=".85" />
      <path d="M150 84 C160 80 172 80 180 82 C170 84 158 86 150 90 Z" fill="#fff" opacity=".22" />
      <ellipse cx="150" cy="82" rx="8" ry="3.4" fill="#F26A1B" />
      <rect x="184" y="72" width="3" height="9" rx="1.5" fill="#26262A" />
      <ellipse cx="185.5" cy="72" rx="4" ry="2.2" fill="#33333A" />
      <circle cx="185.5" cy="72" r="1.4" fill="#2FBE7E" />
      <path d="M196 104 C200 96 196 92 190 93 C196 98 197 102 196 108 Z" fill="#141417" />
    </g>
  );
}

/** The animated "your mower" scene (Home hero, mobile + desktop) — state-driven per
 *  StatePill's tone vocabulary. Mowing drives a scrolling ground plane past a fixed mower
 *  (uncut grass ahead, mowed ticks behind, cut at `CUT_X`); charging/docked render it at the
 *  dock; paused/idle freeze the lawn scene. Bob/wheel-spin/blade-spin/ground-scroll/charge
 *  keyframes live in tailwind.css, scoped under `.v2-root` and disabled under
 *  prefers-reduced-motion (design-language.md §3). */
export function MowingHero({className, overlayTop, progress, state = 'mowing'}: MowingHeroProps) {
  const gradientId = useId();
  const aheadClipId = useId();
  const behindClipId = useId();

  const scene = SCENE[state];
  const driving = state === 'mowing';
  const charging = state === 'charging';

  return (
    <div
      className={cn('relative flex-none overflow-hidden rounded-[18px] border border-border', className)}
      style={{background: `linear-gradient(165deg, ${WASH[state]}, var(--surface) 72%)`}}
    >
      <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-label={ARIA_LABEL[state]}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF8B3E" />
            <stop offset=".5" stopColor="#F26A1B" />
            <stop offset="1" stopColor="#D2540F" />
          </linearGradient>
          {scene === 'ground' ? (
            <>
              <clipPath id={aheadClipId}>
                <rect x={CUT_X} y="82" width={300 - CUT_X} height="38" />
              </clipPath>
              <clipPath id={behindClipId}>
                <rect x="0" y="100" width={CUT_X} height="18" />
              </clipPath>
            </>
          ) : null}
        </defs>

        {scene === 'ground' ? (
          <GroundLayer aheadClipId={aheadClipId} behindClipId={behindClipId} driving={driving} />
        ) : (
          <DockLayer charging={charging} />
        )}

        <MowerBody gradientId={gradientId} driving={driving} />
      </svg>

      {overlayTop ? <div className="absolute inset-x-2.5 top-2.5 flex items-center gap-1.5">{overlayTop}</div> : null}

      {progress != null ? (
        <ProgressBar
          value={progress}
          className="absolute inset-x-0 bottom-0 h-[5px] rounded-none bg-surface-2/70"
          indicatorClassName="rounded-none"
        />
      ) : null}
    </div>
  );
}
