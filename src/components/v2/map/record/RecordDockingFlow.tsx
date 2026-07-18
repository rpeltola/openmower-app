'use client';

// "Record dock" -- name a new docking station, then let the mower record it against the real
// `record_docking/*` gateway bridge (see mowersStore.ts) -- the ROS2 counterpart of
// RecordAreaFlow.tsx, but for the dock instead of an area boundary. UNLIKE area recording, this
// is NOT user-teleop-driven: `RecordDockingStation.action`'s STATUS_DRIVING/STATUS_WAITING_FOR_
// CHARGING/STATUS_RECORDING/STATUS_SAVING phases are the MOWER autonomously driving itself onto
// the dock and verifying it charges -- v1's working reference (MowerControls.tsx /
// RecordDockingNameDialog.tsx, same gateway bridge) confirms this: its own helper text reads "The
// mower will drive forward and stage itself at the dock; keep clear of its path." So there's no
// teleop pad here, just a live phase readout and a Cancel -- and it auto-completes on 'success'
// with no user "Done" trigger, since the mower itself decides when the docking check finishes.
//
// State machine mirrors RecordAreaFlow's nextRecordAreaStep exactly (open -> picking -> start ->
// recording -> status-driven done/error), minus the 'finish' event area recording needs (there's
// no user-triggered end here) and the type picker (a dock has no type).
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {FormField} from '@/components/v2/ui/FormField';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {Sheet} from '@/components/v2/ui/Sheet';
import type {Mower} from '@/stores/mowersStore';
import {useSelectedMower} from '@/stores/mowersStore';
import type {RecordDockingPhase} from '@/stores/schemas';
import {MapPin, Play, X} from 'lucide-react';
import {useEffect, useState} from 'react';

export type RecordDockingStep = 'idle' | 'picking' | 'recording' | 'done' | 'error';

// Mirrors v1's MowerControls.tsx DOCKING_PHASE_LABEL -- same wording, so the two UIs read
// consistently for anyone who has used either.
const PHASE_LABEL: Record<RecordDockingPhase, string> = {
  idle: 'Idle',
  driving: 'Driving to the dock…',
  waiting_for_charging: 'Waiting for charging…',
  recording: 'Verifying position…',
  saving: 'Saving…',
  success: 'Docking station recorded',
  failed: 'Recording failed',
};

export type RecordDockingEvent =
  | {type: 'open'}
  | {type: 'start'}
  | {type: 'status'; phase: RecordDockingPhase}
  | {type: 'cancel'}
  | {type: 'close'};

/** Pure transition table -- unit-testable without mounting the component, same split as
 *  RecordAreaFlow's nextRecordAreaStep. `status` events are only honored while actively
 *  `recording`/`error` (a stale retained record_docking/status from a PREVIOUS run must not jump
 *  a freshly-opened `picking` step straight to done/error). */
export function nextRecordDockingStep(step: RecordDockingStep, event: RecordDockingEvent): RecordDockingStep {
  switch (event.type) {
    case 'open':
      return 'picking';
    case 'start':
      return step === 'picking' ? 'recording' : step;
    case 'status':
      if (step !== 'recording' && step !== 'error') return step;
      if (event.phase === 'success') return 'done';
      if (event.phase === 'failed') return 'error';
      return 'recording';
    case 'cancel':
    case 'close':
      return 'idle';
    default:
      return step;
  }
}

export interface RecordDockingFlowProps {
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function RecordDockingFlow({open, onClose, onToast}: RecordDockingFlowProps) {
  const mower = useSelectedMower<Mower | undefined>((s) => s);
  const recordDockingStatus = useSelectedMower((s) => s?.recordDockingStatus ?? null);

  const [step, setStep] = useState<RecordDockingStep>('idle');
  const [name, setName] = useState('');

  // A fresh open always re-enters at `picking` with a blank draft -- mirrors RecordAreaFlow.
  useEffect(() => {
    if (open) {
      setStep((prev) => nextRecordDockingStep(prev, {type: 'open'}));
      setName('');
    } else {
      setStep((prev) => nextRecordDockingStep(prev, {type: 'close'}));
    }
  }, [open]);

  useEffect(() => {
    if (!recordDockingStatus) return;
    setStep((prev) => nextRecordDockingStep(prev, {type: 'status', phase: recordDockingStatus.phase}));
  }, [recordDockingStatus]);

  useEffect(() => {
    if (step !== 'done') return;
    onToast('Docking station recorded');
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step === 'error') onToast(recordDockingStatus?.message || 'Recording failed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startRecording = () => {
    if (!mower || name.trim() === '') return;
    mower.publishRecordDockingStart(name.trim());
    setStep((prev) => nextRecordDockingStep(prev, {type: 'start'}));
  };

  const discard = () => {
    mower?.publishRecordDockingCancel();
    setStep((prev) => nextRecordDockingStep(prev, {type: 'cancel'}));
    onClose();
  };

  if (!open) return null;

  const phase = recordDockingStatus?.phase ?? 'driving';
  const inProgress = step === 'recording' || step === 'error';

  return (
    <>
      <Sheet open={step === 'picking'} onClose={onClose} title="Record dock">
        <div className="space-y-3.5">
          <FormField label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Docking station"
              autoFocus
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink"
            />
          </FormField>

          <p className="m-0 text-[.76rem] leading-[1.4] text-ink-faint">
            The mower will drive forward and stage itself at the dock -- keep clear of its path.
          </p>

          <Button variant="primary" className="w-full justify-center" onClick={startRecording} disabled={name.trim() === ''}>
            <Play size={14} fill="currentColor" /> Start recording
          </Button>
          <Button variant="ghost" className="w-full justify-center" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Sheet>

      {inProgress && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[900] flex flex-wrap items-center gap-2">
            <OverlayChip>
              <MapPin size={12} className={step === 'error' ? 'text-danger' : 'text-info'} /> {PHASE_LABEL[phase]}
            </OverlayChip>
            <Button
              variant="soft"
              size="icon"
              className="pointer-events-auto ml-auto h-9 w-9"
              aria-label="Cancel recording"
              onClick={discard}
            >
              <X size={16} />
            </Button>
          </div>

          <Card className="absolute inset-x-3 bottom-3 z-[900] p-3 md:left-3 md:right-auto md:w-[340px]">
            <p className="m-0 text-center text-[.8rem] text-ink-soft">
              {step === 'error' ? recordDockingStatus?.message || 'Recording failed' : PHASE_LABEL[phase]}
            </p>
            {/* Distinct wording from the picking sheet's "Cancel" button below, same reason
                RecordAreaFlow's driving-view button says "Discard" rather than "Cancel" -- the
                two can be transiently mounted at once during the picking sheet's close
                animation, and need different accessible names to stay unambiguous. */}
            <Button variant="ghost" size="sm" className="mt-2.5 w-full justify-center" onClick={discard}>
              Stop recording
            </Button>
          </Card>
        </>
      )}
    </>
  );
}
