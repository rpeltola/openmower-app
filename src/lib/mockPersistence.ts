import type {
  HeatmapCell,
  HeatmapMetric,
  HistogramBuckets,
  Histograms,
  Stats,
  StatsPerDay,
  StatsQueryResult,
} from '@/stores/schemas';

/**
 * Deterministic sample data for the stats/histogram/heatmap MQTT contract (see
 * OpenMowerNext persistence/DESIGN.md "MQTT contract"). The persistence node this UI
 * talks to doesn't exist yet, so every consumer of these topics/queries falls back to a
 * fixture from here on failure/timeout -- pages render something sane during development,
 * and swap to live data the moment the real topics/queries respond. Not randomised per
 * render (seeded), so screenshots/tests are stable.
 */

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const MOCK_STATS: Stats = {
  mowed_hours: 42.5,
  mowed_m2: 1280,
  mow_count: 37,
  blade: {
    total_hours: 38.2,
    left_hours: 19.4,
    right_hours: 18.8,
    due: false,
    interval_hours: 50,
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function mockStatsForRange(fromMs: number, toMs: number): StatsQueryResult {
  const to = toMs || Date.now();
  const from = fromMs || to - 30 * DAY_MS;
  const days = Math.max(1, Math.min(120, Math.round((to - from) / DAY_MS)));
  const rand = seededRandom(days * 7919 + 13);

  const per_day: StatsPerDay[] = [];
  let mowed_hours = 0;
  let mowed_m2 = 0;
  let mow_count = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(to - (days - 1 - i) * DAY_MS);
    const didMow = rand() > 0.35;
    const hours = didMow ? Math.round((0.4 + rand() * 1.6) * 100) / 100 : 0;
    const m2 = didMow ? Math.round(hours * (180 + rand() * 60)) : 0;
    const count = didMow ? 1 + Math.round(rand() * 1.4) : 0;
    mowed_hours += hours;
    mowed_m2 += m2;
    mow_count += count;
    per_day.push({date: date.toISOString().slice(0, 10), mowed_hours: hours, mowed_m2: m2, mow_count: count});
  }

  return {
    mowed_hours: Math.round(mowed_hours * 10) / 10,
    mowed_m2: Math.round(mowed_m2),
    mow_count,
    blade_hours: Math.round(mowed_hours * 0.9 * 10) / 10,
    per_day,
  };
}

function mockHistogramBuckets(
  min: number,
  width: number,
  buckets: number,
  peakIdx: number,
  spread: number,
  seed: number,
): HistogramBuckets {
  const rand = seededRandom(seed);
  const counts = Array.from({length: buckets}, (_, i) => {
    const d = (i - peakIdx) / spread;
    const base = Math.exp(-d * d) * 100;
    return Math.max(0, Math.round(base + (rand() - 0.5) * 12));
  });
  return {min, width, counts};
}

export function mockHistograms(): Histograms {
  return {
    mow_motor_current: mockHistogramBuckets(0, 0.5, 20, 8, 3, 1),
    drive_speed_left: mockHistogramBuckets(-0.5, 0.05, 20, 14, 3, 2),
    drive_speed_right: mockHistogramBuckets(-0.5, 0.05, 20, 13, 3, 3),
    gps_quality: mockHistogramBuckets(0, 5, 20, 17, 2.5, 4),
  };
}

export function mockHeatmap(metric: HeatmapMetric): {cell_size: number; cells: HeatmapCell[]} {
  const cellSize = 0.25;
  const rand = seededRandom(metric.length * 97 + 5);
  const cells: HeatmapCell[] = [];
  const w = 40;
  const h = 24;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      // Mask to an ellipse so the sample grid reads as a mowed lawn footprint, not noise.
      const nx = (x - w / 2) / (w / 2);
      const ny = (y - h / 2) / (h / 2);
      if (nx * nx + ny * ny > 1) continue;
      const base =
        metric === 'gps_quality'
          ? 65 + rand() * 35
          : metric === 'mow_motor_current'
            ? 1.5 + rand() * 3.5
            : rand() * 18;
      cells.push({
        x,
        y,
        mean: Math.round(base * 100) / 100,
        count: 5 + Math.round(rand() * 40),
        min: Math.round(base * 0.7 * 100) / 100,
        max: Math.round(base * 1.3 * 100) / 100,
      });
    }
  }
  return {cell_size: cellSize, cells};
}
