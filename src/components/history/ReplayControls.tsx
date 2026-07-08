'use client';

import {REPLAY_SPEEDS} from '@/hooks/useReplay';
import {Pause as PauseIcon, PlayArrow as PlayIcon} from '@mui/icons-material';
import {Box, IconButton, MenuItem, Select, Slider, Typography} from '@mui/material';

interface ReplayControlsProps {
  t: number;
  startedAt: number;
  endedAt: number;
  playing: boolean;
  speed: number;
  disabled?: boolean;
  onScrub: (t: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Timeline scrubber for the History map's animated replay (see useReplay + HistoryMap): play/pause,
 * a speed multiplier, and a slider over the selected job's [started_at, ended_at] window. The two
 * clocks are job-relative (00:00 at started_at / job duration at the right), not wall-clock time.
 */
export default function ReplayControls({
  t,
  startedAt,
  endedAt,
  playing,
  speed,
  disabled = false,
  onScrub,
  onTogglePlay,
  onSpeedChange,
}: ReplayControlsProps) {
  const elapsed = t - startedAt;
  const total = endedAt - startedAt;
  const noDuration = disabled || total <= 0;

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1}}>
      <IconButton size="small" onClick={onTogglePlay} disabled={noDuration} title={playing ? 'Pause' : 'Play'}>
        {playing ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
      </IconButton>

      <Typography variant="caption" sx={{minWidth: 40, textAlign: 'right', color: 'text.secondary'}}>
        {formatClock(elapsed)}
      </Typography>

      <Slider
        size="small"
        value={t}
        min={startedAt}
        max={Math.max(startedAt, endedAt)}
        disabled={noDuration}
        onChange={(_, value) => onScrub(Array.isArray(value) ? value[0] : value)}
        sx={{flex: 1}}
      />

      <Typography variant="caption" sx={{minWidth: 40, color: 'text.secondary'}}>
        {formatClock(total)}
      </Typography>

      <Select
        size="small"
        value={speed}
        disabled={disabled}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        sx={{minWidth: 76}}
      >
        {REPLAY_SPEEDS.map((s) => (
          <MenuItem key={s} value={s}>
            {s}×
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
