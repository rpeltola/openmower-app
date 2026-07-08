'use client';

import type {MowJob, MowJobStatus} from '@/stores/schemas';
import {formatAreaSize, formatDuration} from '@/utils/area-utils';
import {
  BatteryFull as BatteryIcon,
  PlayCircle as RunningIcon,
  SquareFoot as AreaIcon,
  Timer as DurationIcon,
} from '@mui/icons-material';
import {Box, Chip, ListItemButton, Typography} from '@mui/material';

interface JobRowProps {
  job: MowJob;
  selected: boolean;
  onSelect: (jobId: string) => void;
}

type ChipColor = 'success' | 'info' | 'error' | 'default';

function statusColor(status: MowJob['status']): ChipColor {
  switch (status as MowJobStatus) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'failed':
      return 'error';
    case 'superseded':
      return 'default';
    default:
      return 'default';
  }
}

function statusLabel(status: MowJob['status']): string {
  switch (status as MowJobStatus) {
    case 'completed':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'superseded':
      return 'Superseded';
    default:
      return status;
  }
}

function formatJobDate(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function JobRow({job, selected, onSelect}: JobRowProps) {
  const areaCount = job.area_ids.length;

  return (
    <ListItemButton
      selected={selected}
      onClick={() => onSelect(job.id)}
      sx={{px: 1.5, py: 1, borderRadius: 1, alignItems: 'flex-start', flexDirection: 'column', gap: 0.5}}
    >
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1}}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {formatJobDate(job.started_at)}
        </Typography>
        <Chip size="small" label={statusLabel(job.status)} color={statusColor(job.status)} sx={{height: 20, fontSize: '0.7rem'}} />
      </Box>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75, rowGap: 0.25}}>
        <Chip
          size="small"
          variant="outlined"
          icon={<AreaIcon sx={{fontSize: '0.9rem !important'}} />}
          label={areaCount > 0 ? `${areaCount} area${areaCount === 1 ? '' : 's'} · ${formatAreaSize(job.area_m2)}` : formatAreaSize(job.area_m2)}
          sx={{height: 20, fontSize: '0.7rem'}}
        />
        <Chip
          size="small"
          variant="outlined"
          icon={<DurationIcon sx={{fontSize: '0.9rem !important'}} />}
          label={formatDuration(job.duration_s)}
          sx={{height: 20, fontSize: '0.7rem'}}
        />
        {job.avg_battery_pct !== null && (
          <Chip
            size="small"
            variant="outlined"
            icon={<BatteryIcon sx={{fontSize: '0.9rem !important'}} />}
            label={`${Math.round(job.avg_battery_pct)}%`}
            sx={{height: 20, fontSize: '0.7rem'}}
          />
        )}
        {job.status === 'running' && (
          <Chip
            size="small"
            variant="outlined"
            color="info"
            icon={<RunningIcon sx={{fontSize: '0.9rem !important'}} />}
            label="In progress"
            sx={{height: 20, fontSize: '0.7rem'}}
          />
        )}
      </Box>
    </ListItemButton>
  );
}
