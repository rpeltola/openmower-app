'use client';

import MapMarker from '@/components/map/MapMarker';
import {MOWER_LENGTH_M, MowerArrow} from '@/components/map/MowerMarker';
import type {Datum} from '@/stores/schemas';
import type {ReplayTrackSample} from '@/utils/replay-track';

interface ReplayMarkerProps {
  sample: ReplayTrackSample | null;
  datum: Datum;
}

/**
 * The animated replay's robot marker -- the same MowerArrow shape as the live map's MowerMarker,
 * in a distinct colour so it's never mistaken for a live position, driven by the replay's
 * interpolated track sample (see sampleTrackAt / useReplay in HistoryMap) instead of the live
 * mower store.
 */
export default function ReplayMarker({sample, datum}: ReplayMarkerProps) {
  if (!sample) return null;

  return (
    <MapMarker
      position={sample.point}
      heading={sample.heading}
      sizeM={MOWER_LENGTH_M}
      datum={datum}
      className="replay-marker"
    >
      {(sizePx) => (
        <svg width={sizePx} height={sizePx} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <MowerArrow fill="#1976D2" />
        </svg>
      )}
    </MapMarker>
  );
}
