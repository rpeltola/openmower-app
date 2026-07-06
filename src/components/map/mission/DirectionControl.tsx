import {DIRECTION_PRESETS_DEG} from '@/utils/mission-utils';
import {Box, TextField, ToggleButton, ToggleButtonGroup} from '@mui/material';

interface DirectionControlProps {
  valueDeg: number;
  onChange: (valueDeg: number) => void;
}

// Swath angle control: a few common presets plus a free-form numeric fallback, per the mission
// contract's `direction_deg` (0 = area's default best-fit).
export default function DirectionControl({valueDeg, onChange}: DirectionControlProps) {
  const preset = DIRECTION_PRESETS_DEG.includes(valueDeg as (typeof DIRECTION_PRESETS_DEG)[number])
    ? valueDeg
    : null;

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={preset}
        onChange={(_, next) => {
          if (next !== null) onChange(next);
        }}
      >
        {DIRECTION_PRESETS_DEG.map((deg) => (
          <ToggleButton key={deg} value={deg} sx={{px: 1, py: 0.25, fontSize: '0.7rem'}}>
            {deg}°
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <TextField
        size="small"
        type="number"
        value={valueDeg}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        slotProps={{htmlInput: {min: -180, max: 180, step: 'any', style: {width: '3.5rem', padding: '4px 8px'}}}}
      />
    </Box>
  );
}
