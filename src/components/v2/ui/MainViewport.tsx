'use client';

import {cn} from '@/components/v2/lib/cn';
import {CameraFeed} from '@/components/v2/ui/CameraFeed';
import {MiniMap} from '@/components/v2/ui/MiniMap';
import {useState} from 'react';

export interface MainViewportProps {
  /** Whether a front camera exists (per-camera capability) — without one this is just the
   *  map, full-size, no PiP and nothing to swap to. */
  showCamera: boolean;
  headingDeg?: number;
  className?: string;
}

/** DJI Fly-style viewport: one large view (camera FPV or map) with the other inset as a
 *  small tappable PiP that swaps to become the main view. Capability-gated — see
 *  `showCamera` — so a mower with no camera never shows an empty/fake feed. */
export function MainViewport({showCamera, headingDeg = 0, className}: MainViewportProps) {
  const [main, setMain] = useState<'camera' | 'map'>('camera');
  const active = showCamera ? main : 'map';

  return (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-card)]', className)}>
      {active === 'camera' ? (
        <CameraFeed className="absolute inset-0" />
      ) : (
        <MiniMap headingDeg={headingDeg} className="absolute inset-0" />
      )}

      {showCamera ? (
        <button
          type="button"
          onClick={() => setMain(active === 'camera' ? 'map' : 'camera')}
          aria-label={`Switch to ${active === 'camera' ? 'map' : 'camera'} view`}
          className="absolute bottom-3 right-3 h-20 w-28 overflow-hidden rounded-lg border-2 border-surface shadow-[var(--shadow-m)] transition-transform active:scale-95"
        >
          {active === 'camera' ? (
            <MiniMap headingDeg={headingDeg} chipLabel="" className="h-full w-full" />
          ) : (
            <CameraFeed compact className="h-full w-full" />
          )}
        </button>
      ) : null}
    </div>
  );
}
