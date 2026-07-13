'use client';

import type {Mower} from '@/stores/mowersStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {getEmergencyReasonLabel} from '@/stores/mowerEvents';
import type {RecordDockingPhase} from '@/stores/schemas';
import {Button, Card, Chip, Stack} from '@mui/material';
import {Disc, Home, MapPin, Play, Square, TriangleAlert, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useDialog} from 'react-dialog-async';
import {RecordDockingNameDialog} from './RecordDockingNameDialog';

const DOCKING_PHASE_LABEL: Record<RecordDockingPhase, string> = {
  idle: 'Idle',
  driving: 'Driving to dock…',
  waiting_for_charging: 'Waiting for charging…',
  recording: 'Verifying position…',
  saving: 'Saving…',
  success: 'Docking station recorded',
  failed: 'Recording failed',
};

const DOCKING_PHASE_COLOR: Record<RecordDockingPhase, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  idle: 'default',
  driving: 'info',
  waiting_for_charging: 'warning',
  recording: 'info',
  saving: 'info',
  success: 'success',
  failed: 'error',
};

const DOCKING_IN_PROGRESS_PHASES = new Set<RecordDockingPhase>([
  'driving',
  'waiting_for_charging',
  'recording',
  'saving',
]);

// Floating control bar on the map: high-level mower commands. Each button
// publishes the shared `command` topic via mower.sendCommand(); the gateway maps
// the action to mower_logic's high_level_control service (+ the area recorder).
// The Area Recording toggle is what unlocks the joystick (see TeleopControls).
export default function MowerControls() {
  const mower = useSelectedMower<Mower | undefined>();
  const currentState = useSelectedMower((s) => s?.state.current_state ?? 'UNKNOWN');
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  // robot_state.sensors.emergency (folded in from mower_msgs/Emergency by the
  // gateway) carries WHY the mower stopped; state.emergency stays a plain flag.
  const emergencyReason = useSelectedMower((s) => s?.state.sensors?.emergency?.reason ?? '');
  const recordDockingStatus = useSelectedMower((s) => s?.recordDockingStatus ?? null);
  // A paused mission is preserved and resumable in place: the toolbar START resumes it
  // (backend high_level_control COMMAND_START), so relabel it "Continue" to signal there's
  // a mission to pick up rather than a fresh one to start. STOP/Go Dock preserve, never cancel.
  const missionState = useSelectedMower((s) => s?.missionState ?? null);
  const resumable = missionState?.state === 'paused';
  const recordDockingNameDialog = useDialog(RecordDockingNameDialog);
  // Terminal outcomes (success/failed) are retained on the broker, so without a local
  // dismiss they'd show forever after a page reload. Re-arm whenever a NEW status object
  // arrives (a fresh MQTT message, including a genuine retry) so it reappears each time.
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => setResultDismissed(false), [recordDockingStatus]);

  if (!mower) return null;

  const recording = currentState === 'AREA_RECORDING';
  const mowing = currentState === 'MOWING';
  const idle = currentState === 'IDLE' || currentState === 'UNKNOWN';
  const send = (a: Parameters<Mower['sendCommand']>[0]) => mower.sendCommand(a);

  const dockingPhase = recordDockingStatus?.phase ?? 'idle';
  const dockingInProgress = DOCKING_IN_PROGRESS_PHASES.has(dockingPhase);
  const showDockingResult = dockingPhase !== 'idle' && !dockingInProgress && !resultDismissed;

  const handleRecordDock = async () => {
    const name = await recordDockingNameDialog.open();
    if (name) mower.publishRecordDockingStart(name);
  };

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
          {resumable ? 'Continue' : 'Start'}
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
        {dockingInProgress ? (
          <>
            <Chip
              size="small"
              color={DOCKING_PHASE_COLOR[dockingPhase]}
              icon={<MapPin size={ICON} />}
              label={recordDockingStatus?.message || DOCKING_PHASE_LABEL[dockingPhase]}
            />
            <Button size="small" variant="outlined" color="error" onClick={() => mower.publishRecordDockingCancel()}>
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<MapPin size={ICON} />}
            disabled={emergency || mowing || recording || currentState === 'DOCKING' || currentState === 'UNDOCKING'}
            onClick={handleRecordDock}
          >
            Record Dock
          </Button>
        )}
        {showDockingResult && (
          <Chip
            size="small"
            color={DOCKING_PHASE_COLOR[dockingPhase]}
            icon={<MapPin size={ICON} />}
            label={recordDockingStatus?.message || DOCKING_PHASE_LABEL[dockingPhase]}
            onDelete={() => setResultDismissed(true)}
            deleteIcon={<X size={14} />}
          />
        )}
        {emergency && (
          <>
            <Chip
              size="small"
              color="error"
              icon={<TriangleAlert size={ICON} />}
              label={emergencyReason ? getEmergencyReasonLabel(emergencyReason) : 'Emergency'}
            />
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<TriangleAlert size={ICON} />}
              onClick={() => send('reset_emergency')}
            >
              Reset E-Stop
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}
