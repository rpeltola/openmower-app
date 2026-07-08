import type {ChargeSession} from '@/stores/schemas';

// Bound on how many recent completed sessions feed the rate average -- enough to smooth out a
// single unusually fast/slow charge, without dragging in stale history.
const MAX_SESSIONS_FOR_RATE = 5;

/**
 * Average charge rate (%/hour) from the last few completed charge sessions, newest first (as
 * returned by useChargeSessions). Only `result === 'completed'` sessions with a real duration and
 * a net gain in charge count -- a session that ended lower than it started, or with a bogus
 * duration, would otherwise skew or invert the estimate. Returns `null` if there's nothing usable.
 */
export function estimateChargeRatePctPerHour(sessions: ChargeSession[]): number | null {
  const valid = sessions
    .filter((s) => s.result === 'completed' && s.duration_s > 0 && s.end_pct > s.start_pct)
    .slice(0, MAX_SESSIONS_FOR_RATE);
  if (valid.length === 0) return null;

  const rates = valid.map((s) => (s.end_pct - s.start_pct) / (s.duration_s / 3600));
  const rate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  return rate > 0 ? rate : null;
}

/**
 * Minutes until the battery reaches 100%, projected from the historical charge rate above and
 * the live (charging-aware) battery percentage. Returns `null` when there's no usable history
 * yet -- callers should show nothing (or an "estimating..." placeholder) rather than a number.
 */
export function estimateMinutesToFull(sessions: ChargeSession[], currentBatteryPct: number): number | null {
  const rate = estimateChargeRatePctPerHour(sessions);
  if (rate == null) return null;
  return ((100 - currentBatteryPct) / rate) * 60;
}

/** Formats a minutes-to-full estimate as "~35 min to full" or "~1 h 20 min to full". */
export function formatMinutesToFull(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 90) return `~${rounded} min to full`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins > 0 ? `~${hours} h ${mins} min to full` : `~${hours} h to full`;
}
