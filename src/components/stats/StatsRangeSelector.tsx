'use client';

import {Box, Button, ButtonGroup, TextField} from '@mui/material';

export type RangePreset = 'today' | 'week' | 'month' | 'all' | 'custom';

const PRESET_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  all: 'All time',
};

const PRESETS: Exclude<RangePreset, 'custom'>[] = ['today', 'week', 'month', 'all'];

interface StatsRangeSelectorProps {
  preset: RangePreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (preset: RangePreset) => void;
  onCustomChange: (from: string, to: string) => void;
}

/** Date-range picker for the Stats page: quick presets plus a custom from/to range. */
export default function StatsRangeSelector({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomChange,
}: StatsRangeSelectorProps) {
  return (
    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center'}}>
      <ButtonGroup size="small">
        {PRESETS.map((p) => (
          <Button key={p} variant={preset === p ? 'contained' : 'outlined'} onClick={() => onPresetChange(p)}>
            {PRESET_LABELS[p]}
          </Button>
        ))}
        <Button variant={preset === 'custom' ? 'contained' : 'outlined'} onClick={() => onPresetChange('custom')}>
          Custom
        </Button>
      </ButtonGroup>

      {preset === 'custom' && (
        <Box sx={{display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap'}}>
          <TextField
            type="date"
            size="small"
            label="From"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
            slotProps={{inputLabel: {shrink: true}}}
          />
          <TextField
            type="date"
            size="small"
            label="To"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
            slotProps={{inputLabel: {shrink: true}}}
          />
        </Box>
      )}
    </Box>
  );
}
