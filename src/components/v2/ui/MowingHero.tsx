import {cn} from '@/components/v2/lib/cn';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {type ReactNode, useId} from 'react';

export interface MowingHeroProps {
  className?: string;
  /** Chip row floated over the top-left of the scene (mobile: state + area + coverage). */
  overlayTop?: ReactNode;
  /** 0–100 — renders a flush progress bar along the bottom edge when set. */
  progress?: number;
}

/** The animated "your mower, mowing" scene — ported 1:1 from the concept's
 *  `.mowhero`/`.mowscene` (mobile Home hero + desktop dashboard hero card). Bob/wheel-spin/
 *  blade-spin/grass-sway/clipping-fly keyframes live in tailwind.css, scoped under
 *  `.v2-root` and disabled under `prefers-reduced-motion` (design-language.md §3). */
export function MowingHero({className, overlayTop, progress}: MowingHeroProps) {
  const gradientId = useId();

  return (
    <div
      className={cn('relative flex-none overflow-hidden rounded-[18px] border border-border', className)}
      style={{background: 'linear-gradient(165deg, var(--accent-wash), var(--surface) 72%)'}}
    >
      <svg
        viewBox="0 0 300 150"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-label="Your YardForce mowing the lawn"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF8B3E" />
            <stop offset=".5" stopColor="#F26A1B" />
            <stop offset="1" stopColor="#D2540F" />
          </linearGradient>
        </defs>

        <rect x="0" y="112" width="162" height="38" fill="var(--mowed)" opacity=".5" />
        <path d="M0 114h300" stroke="var(--accent)" strokeWidth="1" opacity=".22" />
        <g stroke="var(--mowed)" strokeWidth="2.5" strokeLinecap="round" opacity=".7">
          <path d="M18 114v-4M42 114v-5M68 114v-4M96 114v-5M122 114v-4M148 114v-5" />
        </g>

        <g fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity=".8">
          <path className="mh-tuft" d="M178 115 q3 -12 -1 -19" />
          <path className="mh-tuft" style={{animationDelay: '.15s'}} d="M196 115 q3 -14 -1 -20" />
          <path className="mh-tuft" style={{animationDelay: '.35s'}} d="M214 115 q3 -12 -1 -18" />
          <path className="mh-tuft" style={{animationDelay: '.5s'}} d="M232 115 q3 -15 -1 -21" />
          <path className="mh-tuft" style={{animationDelay: '.7s'}} d="M251 115 q3 -12 -1 -18" />
          <path className="mh-tuft" style={{animationDelay: '.9s'}} d="M270 115 q3 -14 -1 -20" />
          <path className="mh-tuft" style={{animationDelay: '1.1s'}} d="M288 115 q3 -13 -1 -19" />
        </g>

        <g fill="var(--accent-bright)">
          <circle className="mh-clip" cx="176" cy="106" r="2.4" />
          <circle className="mh-clip" style={{animationDelay: '.55s'}} cx="179" cy="104" r="1.8" />
          <circle className="mh-clip" style={{animationDelay: '1s'}} cx="173" cy="108" r="2" />
        </g>

        <g className="mh-mower">
          <ellipse cx="160" cy="116" rx="36" ry="6" fill="#000" opacity=".12" />
          <g className="mh-wheel">
            <circle cx="142" cy="110" r="11" fill="#1a1a1e" />
            <g stroke="#050506" strokeWidth="1.6" opacity=".7">
              <path d="M142 101v18M133 110h18M136 104l12 12M148 104l-12 12" />
            </g>
            <circle cx="142" cy="110" r="4" fill="#F26A1B" />
          </g>
          <g className="mh-wheel">
            <circle cx="184" cy="110" r="11" fill="#1a1a1e" />
            <g stroke="#050506" strokeWidth="1.6" opacity=".7">
              <path d="M184 101v18M175 110h18M178 104l12 12M190 104l-12 12" />
            </g>
            <circle cx="184" cy="110" r="4" fill="#F26A1B" />
          </g>
          <g className="mh-blade">
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
      </svg>

      {overlayTop ? (
        <div className="absolute inset-x-2.5 top-2.5 flex items-center gap-1.5">{overlayTop}</div>
      ) : null}

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
