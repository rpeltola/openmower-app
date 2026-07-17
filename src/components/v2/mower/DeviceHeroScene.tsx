import {cn} from '@/components/v2/lib/cn';
import {MowerHeroArt} from '@/components/v2/mower/MowerHeroArt';

export interface DeviceHeroSceneProps {
  className?: string;
  /** Render the "charging" beam lines behind the mower (concept: only shown while charging). */
  charging?: boolean;
  artWidth?: number;
  modelName: string;
}

/** The Device Home hero slot — "a hero slot built for a real 3D scan of your own YardForce"
 *  (concept caption). Today it's `MowerHeroArt` on a radial accent-wash glow with animated
 *  charge beams; the slot is theme-aware and sized by the consumer (mobile full-bleed panel
 *  vs desktop hero card). */
export function DeviceHeroScene({className, charging, artWidth = 192, modelName}: DeviceHeroSceneProps) {
  return (
    <div
      className={cn('relative flex items-center justify-center overflow-hidden', className)}
      style={{background: 'radial-gradient(ellipse at 50% 42%, var(--accent-wash) 0%, transparent 68%)'}}
    >
      {charging ? (
        <svg
          width="90"
          viewBox="0 0 90 150"
          className="absolute left-1/2 top-0 h-full -translate-x-1/2"
          aria-hidden="true"
        >
          <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="130" x2="18" y2="18" className="dh-breath" style={{animationDelay: '0s'}} />
            <line x1="34" y1="140" x2="34" y2="10" className="dh-breath" style={{animationDelay: '.5s'}} />
            <line x1="56" y1="140" x2="56" y2="10" className="dh-breath" style={{animationDelay: '1s'}} />
            <line x1="72" y1="130" x2="72" y2="18" className="dh-breath" style={{animationDelay: '1.5s'}} />
          </g>
        </svg>
      ) : null}

      <div className="relative flex flex-col items-center gap-2">
        <div style={{filter: 'drop-shadow(0 12px 22px rgba(210,84,15,.22))'}}>
          <MowerHeroArt width={artWidth} />
        </div>
        <span className="text-center text-[.7rem] font-semibold text-ink-soft">{modelName}</span>
      </div>
    </div>
  );
}
