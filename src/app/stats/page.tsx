'use client';

import BarTimeSeriesChart from '@/components/charts/BarTimeSeriesChart';
import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import BladeWearCard from '@/components/stats/BladeWearCard';
import StatsRangeSelector, {type RangePreset} from '@/components/stats/StatsRangeSelector';
import {useStatsRange} from '@/hooks/useStatsRange';
import {outerCardStyles} from '@/lib/cardStyles';
import {MOCK_STATS} from '@/lib/mockPersistence';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  AccessTime as HoursIcon,
  ContentCut as BladeIcon,
  PlayCircle as MowCountIcon,
  QueryStats as StatsIcon,
  SquareFoot as AreaIcon,
} from '@mui/icons-material';
import {Box, Card, CardContent, Chip, Stack, Typography, useTheme} from '@mui/material';
import {type ReactNode, useMemo, useState} from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function rangeForPreset(preset: RangePreset, customFrom: string, customTo: string): {from: number; to: number} {
  const now = new Date();
  switch (preset) {
    case 'today':
      return {from: startOfDay(now).getTime(), to: now.getTime()};
    case 'week':
      return {from: now.getTime() - 7 * DAY_MS, to: now.getTime()};
    case 'month':
      return {from: now.getTime() - 30 * DAY_MS, to: now.getTime()};
    case 'all':
      // 0,0 means "lifetime/recent" per the query/stats contract (GetStats service).
      return {from: 0, to: 0};
    case 'custom': {
      const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)).getTime() : 0;
      const to = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)).getTime() : now.getTime();
      return {from, to};
    }
  }
}

function StatTile({icon, label, value, isMock}: {icon: ReactNode; label: string; value: string; isMock?: boolean}) {
  const theme = useTheme();
  return (
    <Card sx={outerCardStyles(theme)}>
      <CardContent sx={{display: 'flex', alignItems: 'center', gap: 2}}>
        <Box sx={{color: 'primary.main', display: 'flex'}}>{icon}</Box>
        <Box sx={{minWidth: 0}}>
          <Typography variant="h5" fontWeight={700} noWrap>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {label}
            {isMock ? ' (sample)' : ''}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

type ChartMetric = 'mowed_m2' | 'mowed_hours';

export default function StatsPage() {
  const theme = useTheme();
  const name = useSelectedMower((m) => m?.name);
  const lifetimeStats = useSelectedMower((m) => m?.stats);
  const mower = useSelectedMower((m) => m);

  const [preset, setPreset] = useState<RangePreset>('month');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(Date.now() - 7 * DAY_MS)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [chartMetric, setChartMetric] = useState<ChartMetric>('mowed_m2');

  const {from, to} = useMemo(() => rangeForPreset(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const {data, loading, isMock} = useStatsRange(from, to);

  // stats/json is retained/always-on (lifetime totals + blade wear); falls back to sample
  // data if it hasn't arrived yet, same as the range query.
  const blade = lifetimeStats?.blade ?? MOCK_STATS.blade;
  const bladeIsMock = lifetimeStats === null || lifetimeStats === undefined;

  const chartData = useMemo(
    () => (data?.per_day ?? []).map((d) => ({date: d.date, value: d[chartMetric]})),
    [data, chartMetric],
  );

  return (
    <Page>
      <PageHeader title="Stats" subtitle={`Lifetime mowing stats for ${name ?? 'the selected mower'}`}>
        <HeaderStat icon={<HoursIcon />} value={`${(lifetimeStats?.mowed_hours ?? MOCK_STATS.mowed_hours).toFixed(1)} h`} label="Lifetime mowed" />
        <HeaderStat icon={<AreaIcon />} value={`${Math.round(lifetimeStats?.mowed_m2 ?? MOCK_STATS.mowed_m2)} m²`} label="Lifetime area" />
        <HeaderStat icon={<MowCountIcon />} value={lifetimeStats?.mow_count ?? MOCK_STATS.mow_count} label="Lifetime mows" />
      </PageHeader>

      <PageContent>
        <Stack spacing={3}>
          <Card sx={outerCardStyles(theme)}>
            <CardContent>
              <StatsRangeSelector
                preset={preset}
                customFrom={customFrom}
                customTo={customTo}
                onPresetChange={setPreset}
                onCustomChange={(f, t) => {
                  setCustomFrom(f);
                  setCustomTo(t);
                }}
              />
            </CardContent>
          </Card>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {xs: '1fr 1fr', md: 'repeat(4, 1fr)'},
              gap: 2,
            }}
          >
            <StatTile
              icon={<HoursIcon />}
              label="Mowed hours"
              value={`${(data?.mowed_hours ?? 0).toFixed(1)} h`}
              isMock={isMock}
            />
            <StatTile
              icon={<AreaIcon />}
              label="Mowed area"
              value={`${Math.round(data?.mowed_m2 ?? 0)} m²`}
              isMock={isMock}
            />
            <StatTile
              icon={<MowCountIcon />}
              label="Number of mows"
              value={`${data?.mow_count ?? 0}`}
              isMock={isMock}
            />
            <StatTile
              icon={<BladeIcon />}
              label="Blade hours (range)"
              value={`${(data?.blade_hours ?? 0).toFixed(1)} h`}
              isMock={isMock}
            />
          </Box>

          <Card sx={outerCardStyles(theme)}>
            <CardContent>
              <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                  <StatsIcon color="primary" />
                  <Typography variant="h6" component="h2">
                    Mowed per day
                  </Typography>
                  {isMock && <Chip size="small" variant="outlined" label="sample data" />}
                </Box>
                <Box sx={{display: 'flex', gap: 1}}>
                  <Chip
                    label="Area (m²)"
                    size="small"
                    color={chartMetric === 'mowed_m2' ? 'primary' : 'default'}
                    onClick={() => setChartMetric('mowed_m2')}
                  />
                  <Chip
                    label="Hours"
                    size="small"
                    color={chartMetric === 'mowed_hours' ? 'primary' : 'default'}
                    onClick={() => setChartMetric('mowed_hours')}
                  />
                </Box>
              </Box>
              {loading && !data ? (
                <Typography variant="body2" color="text.disabled">
                  Loading…
                </Typography>
              ) : (
                <BarTimeSeriesChart
                  data={chartData}
                  unit={chartMetric === 'mowed_m2' ? 'm²' : 'h'}
                  formatValue={(v) => (chartMetric === 'mowed_m2' ? Math.round(v).toString() : v.toFixed(1))}
                  isMock={isMock}
                />
              )}
            </CardContent>
          </Card>

          <BladeWearCard blade={blade} isMock={bladeIsMock} onResetBlade={() => mower?.publishBladeReset()} />
        </Stack>
      </PageContent>
    </Page>
  );
}
