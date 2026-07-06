'use client';

import {Button, DialogActions, DialogContent, DialogTitle, TextField} from '@mui/material';
import {useState} from 'react';
import {AsyncDialogProps} from 'react-dialog-async';
import MapDialog from '../MapDialog';

// Prompts for a docking station name, then resolves with it (or undefined on cancel).
// Kept intentionally simple -- unlike AreaSettingsDialog/DockingStationSettingsDialog this
// isn't editing an existing feature's properties, just naming a NEW recording run before
// kicking off the record_docking_station action (see MowerControls.tsx).
export function RecordDockingNameDialog({isOpen, handleClose}: AsyncDialogProps<void, string>) {
  const [name, setName] = useState('');

  const confirm = () => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    handleClose(trimmed);
  };

  return (
    <MapDialog open={isOpen} onClose={() => handleClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Record Docking Station</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
          autoFocus
          required
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          helperText="The mower will drive forward and stage itself at the dock; keep clear of its path."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()}>Cancel</Button>
        <Button onClick={confirm} variant="contained" disabled={name.trim() === ''}>
          Start Recording
        </Button>
      </DialogActions>
    </MapDialog>
  );
}
