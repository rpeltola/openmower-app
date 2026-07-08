import type {PastTrack} from '@/hooks/useJobTrack';
import type {RelativePoint} from '@/utils/coordinates';
import type {TrackSegment} from '@/utils/track-pipeline';

export interface ReplayTrackSample {
  point: RelativePoint;
  heading: number;
}

/** Total point count across all of a past track's segments, in recorded order. */
export function countTrackPoints(pastTrack: PastTrack | null): number {
  if (!pastTrack) return 0;
  return pastTrack.segments.reduce((sum, seg) => sum + seg.points.length, 0);
}

/**
 * Trims a PastTrack to its first `pointCount` points (across segments, in order), preserving
 * per-segment attributes -- so the History map's progressive/replay track can be fed a growing
 * prefix while reusing the same TrackLayer/useTrackFeatures rendering path as the full-track view.
 */
export function trimPastTrack(pastTrack: PastTrack, pointCount: number): PastTrack {
  if (pointCount <= 0) return {jobId: pastTrack.jobId, segments: []};
  let remaining = pointCount;
  const segments: TrackSegment[] = [];
  for (const seg of pastTrack.segments) {
    if (remaining <= 0) break;
    if (seg.points.length <= remaining) {
      segments.push(seg);
      remaining -= seg.points.length;
    } else {
      segments.push({attributes: seg.attributes, points: seg.points.slice(0, remaining)});
      remaining = 0;
    }
  }
  return {jobId: pastTrack.jobId, segments};
}

/**
 * How many leading points to draw for a given fractional track index: always through the point
 * AT OR AHEAD of `index` (ceil), so the drawn line never lags behind the interpolated marker
 * position that sampleTrackAt renders for the same index.
 */
export function replayPointCount(totalPoints: number, index: number): number {
  if (totalPoints <= 0) return 0;
  return Math.min(totalPoints, Math.max(0, Math.ceil(index) + 1));
}

function headingBetween(a: RelativePoint, b: RelativePoint): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx === 0 && dy === 0 ? null : Math.atan2(dy, dx);
}

/**
 * Samples the flattened track at a fractional index (0..pointCount-1), linearly interpolating
 * position between the two nearest points and deriving heading from their direction. Track points
 * carry no per-point timestamp (see useJobTrack / position.history), so the replay drives the
 * marker by INDEX rather than by time -- see useReplay for how the job's [started_at, ended_at]
 * window maps to a 0..1 progress, and from there to this index.
 */
export function sampleTrackAt(pastTrack: PastTrack | null, index: number): ReplayTrackSample | null {
  if (!pastTrack) return null;
  const flat: RelativePoint[] = [];
  for (const seg of pastTrack.segments) flat.push(...seg.points);
  if (flat.length === 0) return null;

  const clamped = Math.max(0, Math.min(index, flat.length - 1));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(i0 + 1, flat.length - 1);
  const frac = clamped - i0;

  const p0 = flat[i0];
  const p1 = flat[i1];
  const point: RelativePoint = {
    x: p0.x + (p1.x - p0.x) * frac,
    y: p0.y + (p1.y - p0.y) * frac,
  };

  let heading = headingBetween(p0, p1);
  for (let j = i0 - 1; heading === null && j >= 0; j--) {
    heading = headingBetween(flat[j], p0);
  }

  return {point, heading: heading ?? 0};
}
