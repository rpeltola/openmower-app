'use client';

import {Button} from '@/components/v2/ui/Button';
import {cn} from '@/components/v2/lib/cn';
import {CameraFeed} from '@/components/v2/ui/CameraFeed';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';
import {MiniMap} from '@/components/v2/ui/MiniMap';
import {isFeatureSupported} from '@/lib/v2/featureSupport';
import {Maximize, Minimize} from 'lucide-react';
import {useState} from 'react';

export interface MainViewportProps {
  /** Whether a front camera exists (per-camera capability, L1) — without one this is just the
   *  map, full-size, no PiP and nothing to swap to. Actually showing the camera feed also
   *  requires the L3 `cameras` feature (streaming isn't wired up yet — see `CameraFeed`'s
   *  doc), so a hardware-capable mower still degrades to map-only until that ships; the dev
   *  toggle reveals a greyed, inert PiP in its place. */
  showCamera: boolean;
  headingDeg?: number;
  className?: string;
  /** Current fullscreen state — only meaningful (and only rendered as a corner button)
   *  when `onToggleFullscreen` is also given; the caller owns the Fullscreen API, this
   *  component just reflects/toggles it. */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/** DJI Fly-style viewport: one large view (camera FPV or map) with the other inset as a
 *  small tappable PiP that swaps to become the main view. Capability-gated — see
 *  `showCamera` — so a mower with no camera never shows an empty/fake feed. */
export function MainViewport({
  showCamera,
  headingDeg = 0,
  className,
  fullscreen,
  onToggleFullscreen,
}: MainViewportProps) {
  const [main, setMain] = useState<'camera' | 'map'>('camera');
  // L1 (hardware exists) AND L3 (streaming is actually wired up) — a camera-equipped mower
  // still shows map-only, no PiP, until the backend can serve a real feed (R1: CameraFeed's
  // "live" pill would otherwise lie about a stream that doesn't exist).
  const camerasReady = showCamera && isFeatureSupported('cameras');
  const active = camerasReady ? main : 'map';

  return (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-card)]', className)}>
      {active === 'camera' ? (
        <CameraFeed className="absolute inset-0" />
      ) : (
        <MiniMap headingDeg={headingDeg} className="absolute inset-0" />
      )}

      {onToggleFullscreen ? (
        <Button
          variant="soft"
          size="icon"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className="absolute right-3 top-3 h-10 w-10 bg-surface/70 backdrop-blur-sm hover:bg-surface/90"
        >
          {fullscreen ? <Minimize size={18} strokeWidth={2.4} /> : <Maximize size={18} strokeWidth={2.4} />}
        </Button>
      ) : null}

      {camerasReady ? (
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
      ) : showCamera ? (
        <FeatureGate feature="cameras" className="absolute bottom-3 right-3 w-28">
          <div className="h-20 w-28 overflow-hidden rounded-lg border-2 border-surface shadow-[var(--shadow-m)]">
            <CameraFeed compact className="h-full w-full" />
          </div>
        </FeatureGate>
      ) : null}
    </div>
  );
}
