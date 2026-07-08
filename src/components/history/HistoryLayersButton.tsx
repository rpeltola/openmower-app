'use client';

import {useHeatmapMetrics} from '@/hooks/useHeatmapMetrics';
import type {Datum, HeatmapMetric} from '@/stores/schemas';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import {LayersIcon} from 'lucide-react';
import {useRControl} from 'maplibre-react-components';
import {useRef, useState} from 'react';
import {createPortal} from 'react-dom';

interface HistoryLayersButtonProps {
  datum: Datum | null;
  showSatellite: boolean;
  onShowSatelliteChange: (v: boolean) => void;
  showTrack: boolean;
  onShowTrackChange: (v: boolean) => void;
  trackLoading?: boolean;
  showPlannedPath: boolean;
  onShowPlannedPathChange: (v: boolean) => void;
  heatmapMetric: HeatmapMetric | null;
  onHeatmapMetricChange: (v: HeatmapMetric | null) => void;
  heatmapLoading?: boolean;
  heatmapEmpty?: boolean;
}

/**
 * The History map's layer toggle popover -- same set of layers as the live Map page's
 * LayersButton (satellite / driven track / planned path / coverage heatmap), but backed by
 * plain local state (see HistoryMap) rather than the global, persisted `useMapDisplayStore`:
 * that store also holds the LIVE map's own historical-job track browser, a different concept
 * from "which past job is open in the History page" -- sharing it here would fight over the
 * same toggle state (and job selector) across the two pages.
 */
export default function HistoryLayersButton({
  datum,
  showSatellite,
  onShowSatelliteChange,
  showTrack,
  onShowTrackChange,
  trackLoading,
  showPlannedPath,
  onShowPlannedPathChange,
  heatmapMetric,
  onHeatmapMetricChange,
  heatmapLoading,
  heatmapEmpty,
}: HistoryLayersButtonProps) {
  const {container} = useRControl({position: 'top-right'});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const {metrics: heatmapMetrics, loading: heatmapMetricsLoading} = useHeatmapMetrics();

  const content = (
    <>
      <button ref={buttonRef} type="button" title="Layers" onClick={() => setOpen((o) => !o)} style={{padding: 0}}>
        <LayersIcon />
      </button>

      <Popover
        open={open}
        anchorEl={buttonRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{vertical: 'top', horizontal: 'left'}}
        transformOrigin={{vertical: 'top', horizontal: 'right'}}
        slotProps={{paper: {sx: {minWidth: 220, p: 1}}}}
      >
        <Typography variant="overline" sx={{px: 1, display: 'block', lineHeight: 2}}>
          Layers
        </Typography>

        <FormControlLabel
          sx={{mx: 0, px: 1, py: 0.5, width: '100%'}}
          control={
            <Switch checked={showSatellite} onChange={(e) => onShowSatelliteChange(e.target.checked)} disabled={!datum} />
          }
          label="Satellite"
        />

        <FormControlLabel
          sx={{mx: 0, px: 1, py: 0.5, width: '100%'}}
          control={<Switch checked={showPlannedPath} onChange={(e) => onShowPlannedPathChange(e.target.checked)} />}
          label="Planned path"
        />

        <FormControlLabel
          sx={{mx: 0, px: 1, py: 0.5, width: '100%'}}
          control={<Switch checked={showTrack} onChange={(e) => onShowTrackChange(e.target.checked)} />}
          label={
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
              Driven track
              <CircularProgress size={12} sx={{visibility: trackLoading ? 'visible' : 'hidden'}} />
            </Box>
          }
        />

        <Divider sx={{my: 1}} />

        <Typography variant="overline" sx={{px: 1, display: 'block', lineHeight: 2}}>
          Coverage heatmap
        </Typography>
        <Box sx={{px: 1, pb: 0.5}}>
          <Select<HeatmapMetric | ''>
            size="small"
            fullWidth
            value={heatmapMetric ?? ''}
            displayEmpty
            disabled={heatmapMetrics.length === 0}
            onChange={(e) => onHeatmapMetricChange(e.target.value === '' ? null : e.target.value)}
          >
            <MenuItem value="">Off</MenuItem>
            {heatmapMetrics.map((metric) => (
              <MenuItem key={metric.key} value={metric.key}>
                {metric.label}
              </MenuItem>
            ))}
          </Select>
          {heatmapMetricsLoading && heatmapMetrics.length === 0 && (
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 0.75}}>
              <CircularProgress size={12} />
              <Typography variant="caption" color="text.secondary">
                Loading metrics…
              </Typography>
            </Box>
          )}
          {heatmapLoading && (
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 0.75}}>
              <CircularProgress size={12} />
              <Typography variant="caption" color="text.secondary">
                Loading heatmap…
              </Typography>
            </Box>
          )}
          {heatmapEmpty && (
            <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 0.75}}>
              No heatmap data
            </Typography>
          )}
        </Box>
      </Popover>
    </>
  );

  return createPortal(content, container);
}
