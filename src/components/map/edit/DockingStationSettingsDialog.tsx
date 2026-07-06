'use client';

import {TooltipTextField} from '@/components/ui/TooltipTextField';
import {useMap, useMapboxDraw, useMapSelection} from '@/contexts/MapContext';
import type {DockingStationFeatureProps} from '@/types/geojson';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import {useEffect, useState} from 'react';
import {AsyncDialogProps} from 'react-dialog-async';
import MapDialog from '../MapDialog';

// Non-negative; empty/0 means "use the docking system's configured default" (see
// open_mower_next/msg/DockingStation.msg's approach_distance doc comment).
function validateApproachDistance(raw: string): string {
  if (raw.trim() === '') return '';
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return 'Must be a non-negative number';
  }
  return '';
}

export function DockingStationSettingsDialog({isOpen, handleClose}: AsyncDialogProps) {
  const map = useMap();
  const draw = useMapboxDraw();
  const selectedIds = useMapSelection();
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  // Kept as a string so an empty field means "use the system default" rather than 0.
  const [approachDistance, setApproachDistance] = useState('');

  useEffect(() => {
    if (selectedIds.length === 0 || !draw) return;
    const selectedDock = draw.get(selectedIds[0]);
    const properties = selectedDock?.properties as DockingStationFeatureProps | undefined;
    if (!properties) return;
    setName(properties.name ?? '');
    setActive(properties.active ?? true);
    setApproachDistance(properties.approach_distance ? String(properties.approach_distance) : '');
  }, [draw, selectedIds]);

  const approachDistanceError = validateApproachDistance(approachDistance);

  const handleSave = () => {
    if (!map || !draw || selectedIds.length === 0) return;

    const feature = draw.get(selectedIds[0])!;
    const parsedApproachDistance = parseFloat(approachDistance.trim());
    const properties: DockingStationFeatureProps = {
      ...(feature.properties as DockingStationFeatureProps),
      type: 'docking_station',
      name,
      active,
      approach_distance: Number.isFinite(parsedApproachDistance) ? parsedApproachDistance : 0,
    };

    feature.properties = properties;
    draw.add(feature);
    map.fire(MapboxDraw.constants.events.UPDATE, {features: [feature]});

    handleClose();
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <MapDialog open={isOpen} onClose={() => handleClose()} fullWidth maxWidth="xs">
      <DialogTitle>Docking Station Settings</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
          required
        />

        <FormControlLabel
          control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
          label="Active"
          sx={{mt: 2, display: 'block'}}
        />

        <TooltipTextField
          label="Approach distance (m)"
          type="number"
          value={approachDistance}
          onChange={(e) => setApproachDistance(e.target.value)}
          fullWidth
          margin="normal"
          placeholder="System default"
          inputProps={{min: 0, step: 0.1}}
          slotProps={{inputLabel: {shrink: true}}}
          sx={{
            '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {display: 'none'},
            '& input[type=number]': {MozAppearance: 'textfield'},
          }}
          error={!!approachDistanceError}
          helperText={approachDistanceError}
          tooltip={
            'The distance (m) the mower stages/approaches from before its final docking ' +
            'approach, along the dock’s heading. Empty or 0 = use the docking system’s ' +
            'configured default.'
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={name === '' || !!approachDistanceError}>
          Save
        </Button>
      </DialogActions>
    </MapDialog>
  );
}
