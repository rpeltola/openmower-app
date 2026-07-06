'use client';

import {Box, Typography, useTheme} from '@mui/material';
import {useEffect, useMemo, useRef, useState} from 'react';

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

interface BarTimeSeriesChartProps {
  data: TimeSeriesPoint[];
  unit?: string;
  formatValue?: (value: number) => string;
  isMock?: boolean;
  height?: number;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

/**
 * A per-day bar chart for the Stats page (mowed area/hours over the selected range).
 * Single series, inline SVG, no charting library -- real axes + a hover tooltip (this is a
 * primary chart, unlike the compact sparklines on the Sensors page).
 */
export default function BarTimeSeriesChart({
  data,
  unit = '',
  formatValue,
  isMock = false,
  height = 200,
}: BarTimeSeriesChartProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fmt = formatValue ?? ((v: number) => v.toFixed(1));

  const paddingLeft = 40;
  const paddingRight = 8;
  const paddingTop = 16;
  const paddingBottom = 24;
  const plotWidth = Math.max(0, width - paddingLeft - paddingRight);
  const plotHeight = height - paddingTop - paddingBottom;

  const maxValue = useMemo(() => niceMax(Math.max(...data.map((d) => d.value), 0)), [data]);
  const n = data.length;
  const gap = 2;
  const slot = n > 0 ? plotWidth / n : 0;
  const barWidth = n > 0 ? Math.min(24, Math.max(2, slot - gap)) : 0;
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f * 10) / 10);

  const color = isMock ? theme.palette.text.disabled : theme.palette.primary.main;
  const axisColor = theme.palette.divider;
  const textColor = theme.palette.text.secondary;

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  if (n === 0) {
    return (
      <Box sx={{py: 4, textAlign: 'center'}}>
        <Typography variant="body2" color="text.disabled">
          No data for this range.
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{position: 'relative', width: '100%'}}>
      <svg width={width} height={height} role="img" aria-label={`Value per day, in ${unit || 'units'}`}>
        {yTicks.map((tick, i) => {
          const y = paddingTop + plotHeight - (maxValue > 0 ? (tick / maxValue) * plotHeight : 0);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke={axisColor}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={paddingLeft - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={textColor}>
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((point, i) => {
          const barHeight = maxValue > 0 ? (point.value / maxValue) * plotHeight : 0;
          const x = paddingLeft + i * slot + (slot - barWidth) / 2;
          const y = paddingTop + plotHeight - barHeight;
          const isHovered = hoverIdx === i;
          return (
            <g key={point.date}>
              {/* transparent hit target, wider than the visible bar */}
              <rect
                x={paddingLeft + i * slot}
                y={paddingTop}
                width={slot}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
                rx={2}
                fill={color}
                opacity={isHovered ? 1 : 0.85}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {data.map((point, i) =>
          i % labelEvery === 0 ? (
            <text
              key={point.date}
              x={paddingLeft + i * slot + slot / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill={textColor}
            >
              {formatDateLabel(point.date)}
            </text>
          ) : null,
        )}

        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={paddingTop + plotHeight}
          y2={paddingTop + plotHeight}
          stroke={axisColor}
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      </svg>

      {hovered && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            px: 1,
            py: 0.5,
            pointerEvents: 'none',
            boxShadow: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
            {formatDateLabel(hovered.date)}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {fmt(hovered.value)} {unit}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
