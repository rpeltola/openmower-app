import {Box, IconButton, Typography} from '@mui/material';
import {MinusIcon, PlusIcon} from 'lucide-react';

const MIN_REPEATS = 1;
const MAX_REPEATS = 20;

interface RepeatsStepperProps {
  value: number;
  onChange: (value: number) => void;
}

export default function RepeatsStepper({value, onChange}: RepeatsStepperProps) {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
      <IconButton
        size="small"
        disabled={value <= MIN_REPEATS}
        onClick={() => onChange(Math.max(MIN_REPEATS, value - 1))}
      >
        <MinusIcon size={14} />
      </IconButton>
      <Typography variant="body2" sx={{width: '1.2rem', textAlign: 'center'}}>
        {value}
      </Typography>
      <IconButton
        size="small"
        disabled={value >= MAX_REPEATS}
        onClick={() => onChange(Math.min(MAX_REPEATS, value + 1))}
      >
        <PlusIcon size={14} />
      </IconButton>
    </Box>
  );
}
