'use client';

import type {Mower} from '@/stores/mowersStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {Button, Card, Stack} from '@mui/material';
import {Disc, Home, Play, Square, TriangleAlert} from 'lucide-react';

// Floating control bar on the map: high-level mower commands. Each button
// publishes the shared `command` topic via mower.sendCommand(); the gateway maps
// the action to mower_logic's high_level_control service (+ the area recorder).
// The Area Recording toggle is what unlocks the joystick (see TeleopControls).
export default function MowerControls() {
  const mower = useSelectedMower<Mower | undefined>();
  const currentState = useSelectedMower((s) => s?.state.current_state ?? 'UNKNOWN');
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);

  if (!mower) return null;

  const recording = currentState === 'AREA_RECORDING';
  const mowing = currentState === 'MOWING';
  const idle = currentState === 'IDLE' || currentState === 'UNKNOWN';
  const send = (a: Parameters<Mower['sendCommand']>[0]) => mower.sendCommand(a);

  const ICON = 16;

  return (
    <Card
      elevation={4}
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        borderRadius: 2,
        px: 1,
        py: 0.75,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<Play size={ICON} />}
          disabled={emergency || mowing || recording}
          onClick={() => send('start')}
        >
          Start
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Square size={ICON} />}
          disabled={emergency || idle}
          onClick={() => send('stop')}
        >
          Stop
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Home size={ICON} />}
          disabled={emergency || recording || currentState === 'DOCKING'}
          onClick={() => send('dock')}
        >
          Go Dock
        </Button>
        <Button
          size="small"
          variant={recording ? 'contained' : 'outlined'}
          color={recording ? 'error' : 'primary'}
          startIcon={<Disc size={ICON} />}
          disabled={emergency || mowing || currentState === 'DOCKING' || currentState === 'UNDOCKING'}
          onClick={() => send(recording ? 'record_off' : 'record_on')}
        >
          {recording ? 'Stop Recording' : 'Area Recording'}
        </Button>
        {emergency && (
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<TriangleAlert size={ICON} />}
            onClick={() => send('reset_emergency')}
          >
            Reset E-Stop
          </Button>
        )}
      </Stack>
    </Card>
  );
}
