'use client';

import type {HistogramBuckets} from '@/stores/schemas';
import {Box, Typography, useTheme} from '@mui/material';
import {useId} from 'react';

interface HistogramSparklineProps {
  buckets?: HistogramBuckets;
  unit?: string;
  digits?: number;
  width?: number;
  height?: number;
}

/**
 * A compact, glanceable recent-distribution histogram for the Sensors page (see
 * histograms/json in persistence/DESIGN.md's MQTT contract). Deliberately minimal: a single
 * series, no legend/axes (sparkline-sized, sits inline next to a readout) -- per-bucket range +
 * count is still reachable via the native SVG <title> tooltip on hover/focus, so nothing is
 * hidden, it's just not drawn permanently at this scale.
 */
export default function HistogramSparkline({
  buckets,
  unit = '',
  digits = 1,
  width = 140,
  height = 32,
}: HistogramSparklineProps) {
  const theme = useTheme();
  const titleId = useId();

  // No feed yet, or an all-empty window: a muted placeholder, never a drawn distribution.
  if (!buckets || buckets.counts.length === 0 || buckets.counts.every((c) => c === 0)) {
    return (
      <Typography variant="caption" color="text.disabled">
        No recent data
      </Typography>
    );
  }

  const {min, width: bucketWidth, counts} = buckets;
  const n = counts.length;
  const max = Math.max(...counts, 1);
  const gap = 1;
  const barWidth = Math.max(1, (width - gap * (n - 1)) / n);
  const color = theme.palette.primary.main;
  const peakIdx = counts.reduce((best, count, i) => (count > counts[best] ? i : best), 0);
  const peakLabel = `${(min + peakIdx * bucketWidth).toFixed(digits)}-${(min + (peakIdx + 1) * bucketWidth).toFixed(digits)}${unit}`;

  return (
    <Box sx={{display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start'}}>
      <svg width={width} height={height} role="img" aria-labelledby={titleId} style={{display: 'block'}}>
        <title id={titleId}>{`Recent distribution, peak ${peakLabel} (${counts[peakIdx]} samples)`}</title>
        {counts.map((count, i) => {
          const h = Math.max(1, (count / max) * (height - 2));
          const x = i * (barWidth + gap);
          const y = height - h;
          const bucketMin = min + i * bucketWidth;
          const bucketMax = bucketMin + bucketWidth;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={Math.min(1, barWidth / 2)}
              fill={color}
              opacity={i === peakIdx ? 1 : 0.65}
            >
              <title>{`${bucketMin.toFixed(digits)}-${bucketMax.toFixed(digits)}${unit}: ${count}`}</title>
            </rect>
          );
        })}
      </svg>
    </Box>
  );
}
