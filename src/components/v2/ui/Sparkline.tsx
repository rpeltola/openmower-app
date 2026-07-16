import {cn} from '@/components/v2/lib/cn';

export interface SparklineProps {
  /** SVG path `d` for the filled area under the trend (closed shape). */
  areaPath: string;
  /** SVG path `d` for the trend line itself (open shape, same points as the area). */
  linePath: string;
  /** Endpoint dot, in the same 0–100×0–28 viewBox space as the paths. */
  dot: {x: number; y: number};
  className?: string;
}

/** Concept diagnostics sparkline: translucent accent area + accent line + a bright endpoint dot,
 *  in a fixed `0 0 100 28` viewBox so callers can drop in the concept's exact path data. */
export function Sparkline({areaPath, linePath, dot, className}: SparklineProps) {
  return (
    <svg
      viewBox="0 0 100 28"
      width="100%"
      height="28"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('mt-[.4rem] block', className)}
    >
      <path d={areaPath} fill="var(--accent)" opacity=".12" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={dot.x} cy={dot.y} r="2.6" fill="var(--accent-bright)" stroke="var(--surface-2)" strokeWidth="1.2" />
    </svg>
  );
}
