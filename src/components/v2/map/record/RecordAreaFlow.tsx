'use client';

// "Record area" -- drive a new mowing area or obstacle boundary with the mower (MAP_SCREEN_SPEC
// S8's real counterpart: unlike RecordBriefingSheet/RecordDriveOverlay/RecordCloseSheet, which mock
// the drive with a local physics loop, this talks to the real `record_area/*` gateway bridge (see
// mowersStore.ts) and drives with the SAME unified manual-control console the Manual control page
// uses (DriveConsole -> useManualDrive -> teleop{vx,vz}) -- so the boundary drive gets the real
// D-pad/Joystick toggle, the Speed control, and gamepad/PS5 support, just with the blade OFF (you're
// tracing a boundary, not cutting).
//
// State machine: idle -> picking (name + type) -> recording (driving, live point count) ->
// done (success -> toast + close) | error (failed -> toast, stays open so the user can retry or
// discard). `nextRecordAreaStep` is exported standalone so the transition table can be unit-tested
// without rendering the drive UI (mirrors ManualControl.test.tsx's directionToVelocity split).
import {DriveConsole} from '@/components/v2/drive/DriveConsole';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {FormField} from '@/components/v2/ui/FormField';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import type {Mower} from '@/stores/mowersStore';
import {useSelectedMower} from '@/stores/mowersStore';
import type {RecordAreaPhase} from '@/stores/schemas';
import {Check, Play, X} from 'lucide-react';
import {useEffect, useState} from 'react';

export type RecordAreaKind = 'mow' | 'obstacle';
export type RecordAreaStep = 'idle' | 'picking' | 'recording' | 'done' | 'error';

const TYPE_OPTIONS: {value: RecordAreaKind; label: string}[] = [
  {value: 'mow', label: 'Mowing area'},
  {value: 'obstacle', label: 'Obstacle'},
];

// type: 0 = obstacle (exclusion), 2 = mowing area (operation); 1 (navigation) isn't exposed here.
const TYPE_TO_WIRE: Record<RecordAreaKind, number> = {mow: 2, obstacle: 0};
const DEFAULT_NAME: Record<RecordAreaKind, string> = {mow: 'New mowing area', obstacle: 'New obstacle'};

export type RecordAreaEvent =
  | {type: 'open'}
  | {type: 'start'}
  | {type: 'status'; phase: RecordAreaPhase}
  | {type: 'cancel'}
  | {type: 'close'};

/** Pure transition table -- unit-testable without mounting the component. `status` events are
 *  only honored while actively `recording`/`error` (a stale retained record_area/status from a
 *  PREVIOUS run must not jump a freshly-opened `picking` step straight to done/error). */
export function nextRecordAreaStep(step: RecordAreaStep, event: RecordAreaEvent): RecordAreaStep {
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

export interface RecordAreaFlowProps {
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function RecordAreaFlow({open, onClose, onToast}: RecordAreaFlowProps) {
  const mower = useSelectedMower<Mower | undefined>((s) => s);
  const recordAreaStatus = useSelectedMower((s) => s?.recordAreaStatus ?? null);

  const [step, setStep] = useState<RecordAreaStep>('idle');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RecordAreaKind>('mow');

  // A fresh open always re-enters at `picking` with a blank draft -- mirrors RecordCloseSheet's
  // own reset-on-open effect.
  useEffect(() => {
    if (open) {
      setStep((prev) => nextRecordAreaStep(prev, {type: 'open'}));
      setName('');
      setKind('mow');
    } else {
      setStep((prev) => nextRecordAreaStep(prev, {type: 'close'}));
    }
  }, [open]);

  useEffect(() => {
    if (!recordAreaStatus) return;
    setStep((prev) => nextRecordAreaStep(prev, {type: 'status', phase: recordAreaStatus.phase}));
  }, [recordAreaStatus]);

  useEffect(() => {
    if (step !== 'done') return;
    onToast('Area saved');
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step === 'error') onToast(recordAreaStatus?.message || 'Recording failed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startRecording = () => {
    if (!mower) return;
    mower.publishRecordAreaStart(name.trim() || DEFAULT_NAME[kind], TYPE_TO_WIRE[kind]);
    setStep((prev) => nextRecordAreaStep(prev, {type: 'start'}));
  };

  const finish = () => mower?.publishRecordAreaFinish();

  const discard = () => {
    mower?.publishRecordAreaCancel();
    setStep((prev) => nextRecordAreaStep(prev, {type: 'cancel'}));
    onClose();
  };

  if (!open) return null;

  const busy = recordAreaStatus?.phase === 'processing' || recordAreaStatus?.phase === 'saving';
  const driving = step === 'recording' || step === 'error';

  return (
    <>
      <Sheet open={step === 'picking'} onClose={onClose} title="Record area">
        <div className="space-y-3.5">
          <FormField label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEFAULT_NAME[kind]}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink"
            />
          </FormField>

          <FormField label="Type">
            <SegmentedToggle options={TYPE_OPTIONS} value={kind} onChange={(v) => setKind(v as RecordAreaKind)} />
          </FormField>

          <p className="m-0 text-[.76rem] leading-[1.4] text-ink-faint">
            Drive the mower around the edge, then tap Done -- the boundary saves as a new area.
          </p>

          <Button variant="primary" className="w-full justify-center" onClick={startRecording}>
            <Play size={14} fill="currentColor" /> Start recording
          </Button>
          <Button variant="ghost" className="w-full justify-center" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Sheet>

      {driving && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[900] flex flex-wrap items-center gap-2">
            <OverlayChip>
              <span className="text-danger">●</span> REC
            </OverlayChip>
            <OverlayChip>{recordAreaStatus?.point_count ?? 0} pts</OverlayChip>
            {busy && <OverlayChip>{recordAreaStatus?.phase === 'saving' ? 'Saving…' : 'Processing…'}</OverlayChip>}
            <Button
              variant="soft"
              size="icon"
              className="pointer-events-auto ml-auto h-9 w-9"
              aria-label="Discard recording"
              onClick={discard}
            >
              <X size={16} />
            </Button>
          </div>

          <Card className="absolute inset-x-3 bottom-3 z-[900] p-3 md:left-3 md:right-auto md:w-[340px]">
            <p className="m-0 text-center text-[.8rem] text-ink-soft">Drive the boundary of your area</p>
            {/* The unified manual-control console (D-pad/Joystick toggle + Speed + gamepad/PS5),
                blade OFF -- you're tracing a boundary, not cutting. Defaults to Slow for precise
                edge tracing; greyed + inert while the recording is processing/saving (`busy`). */}
            <DriveConsole
              className="mt-2.5"
              driveEnabled={!busy}
              defaultSpeed="slow"
              size={116}
              features={{inputMode: true, speed: true, blade: false}}
            />
            {step === 'error' && (
              <div className="mt-2 rounded-[10px] bg-danger-wash px-2.5 py-1.5 text-center text-[.76rem] font-semibold text-danger">
                {recordAreaStatus?.message || 'Recording failed'}
              </div>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={discard}>
                Discard
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={finish} disabled={busy}>
                <Check size={14} /> Done
              </Button>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
