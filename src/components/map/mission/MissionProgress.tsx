import type {MissionState} from '@/stores/schemas';
import {Box, Chip, LinearProgress, Typography} from '@mui/material';

const STATE_COLOR: Record<MissionState['state'], 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  queued: 'default',
  planning: 'info',
  mowing: 'info',
  paused: 'warning',
  done: 'success',
  failed: 'error',
  cancelled: 'default',
};

function formatEta(etaS?: number): string | null {
  if (etaS === undefined) return null;
  const minutes = Math.floor(etaS / 60);
  const seconds = Math.round(etaS % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
}

export default function MissionProgress({missionState}: {missionState: MissionState}) {
  const {job_index, job_total, type, area_id, pass, repeats, coverage, state, eta_s} = missionState;
  const eta = formatEta(eta_s);

  return (
    <Box sx={{p: 1.5, borderTop: '1px solid', borderColor: 'divider'}}>
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
        <Typography variant="subtitle2" fontWeight={600}>
          Job {job_index + 1} / {job_total}
          {type === 'area' && area_id ? ` — ${area_id}` : type === 'spot' ? ' — Spot mow' : ''}
        </Typography>
        <Chip size="small" label={state} color={STATE_COLOR[state]} />
      </Box>
      <LinearProgress variant="determinate" value={Math.round(Math.min(1, Math.max(0, coverage)) * 100)} sx={{mb: 0.5}} />
      <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
        <Typography variant="caption" color="text.secondary">
          Pass {pass} / {repeats} • {Math.round(coverage * 100)}% coverage
        </Typography>
        {eta && (
          <Typography variant="caption" color="text.secondary">
            {eta}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
