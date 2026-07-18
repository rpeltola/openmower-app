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
import {useEffect, useRef, useState} from 'react';

export type RecordAreaKind = 'mow' | 'obstacle';
export type RecordAreaStep = 'idle' | 'picking' | 'recording' | 'done' | 'error';

// If Done is tapped but no terminal record_area/status ever arrives (a stale mower deploy, a
// dropped MQTT message, a broker restart), the flow must never leave the user stuck staring at a
// dialog with no way out -- see the watchdog effect below.
const FINISH_TIMEOUT_MS = 15000;

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

  // `finishing`: local "I tapped Done" flag, true from the tap until a terminal status arrives --
  // gives immediate "Saving…" feedback (and disables Done) even before the gateway's own
  // processing/saving phase shows up, and covers the gap if it never does. `finishTimedOut`:
  // FINISH_TIMEOUT_MS watchdog fired with no terminal status -- see the effect below.
  const [finishing, setFinishing] = useState(false);
  const [finishTimedOut, setFinishTimedOut] = useState(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFinishTimer = () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  // A fresh open re-enters at `picking` with a blank draft (mirrors RecordCloseSheet's own
  // reset-on-open effect) -- UNLESS the backend is already mid-recording (the user navigated away
  // and came back, and Map re-opened us to resume). In that case jump straight to the driving
  // view: the name/type were committed at startRecording and finish()/discard() need no further
  // input, so there's nothing to re-pick. recordAreaStatus is read as an open-time snapshot on
  // purpose (not a dep) -- later phase changes are handled by the status effect below, and adding
  // it here would wrongly re-run this reset when the phase moves to processing/saving/success.
  useEffect(() => {
    if (open) {
      if (recordAreaStatus?.phase === 'recording') {
        setStep('recording');
      } else {
        setStep((prev) => nextRecordAreaStep(prev, {type: 'open'}));
        setName('');
        setKind('mow');
      }
    } else {
      setStep((prev) => nextRecordAreaStep(prev, {type: 'close'}));
    }
    // Every (re-)open or close starts a clean slate for the Done watchdog -- the flow stays
    // mounted across open/close (Map.tsx controls it via `open`), so this state would otherwise
    // leak from one recording session into the next.
    clearFinishTimer();
    setFinishing(false);
    setFinishTimedOut(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!recordAreaStatus) return;
    setStep((prev) => nextRecordAreaStep(prev, {type: 'status', phase: recordAreaStatus.phase}));
  }, [recordAreaStatus]);

  // Once a terminal status arrives, the watchdog has done its job (or was never needed) -- clear
  // it. 'error' also re-enables Done so the user can retry a failed finish; 'done' unmounts via
  // onClose below so it doesn't matter either way.
  useEffect(() => {
    if (step !== 'done' && step !== 'error') return;
    clearFinishTimer();
    setFinishTimedOut(false);
    if (step === 'error') setFinishing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Unmount cleanup -- belt-and-suspenders alongside the open-effect above, in case the flow is
  // ever torn down mid-recording instead of just closed.
  useEffect(() => clearFinishTimer, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const finish = () => {
    if (finishing) return; // Done already tapped -- don't double-publish
    mower?.publishRecordAreaFinish();
    setFinishing(true);
    setFinishTimedOut(false);
    clearFinishTimer();
    finishTimerRef.current = setTimeout(() => setFinishTimedOut(true), FINISH_TIMEOUT_MS);
  };

  const discard = () => {
    mower?.publishRecordAreaCancel();
    clearFinishTimer();
    setFinishing(false);
    setFinishTimedOut(false);
    setStep((prev) => nextRecordAreaStep(prev, {type: 'cancel'}));
    onClose();
  };

  if (!open) return null;

  // `finishing` folds in as soon as Done is tapped, ahead of the gateway's own processing/saving
  // phase, so the busy affordance (chip + disabled Done/drive) covers the gap between the tap and
  // the first status update, not just the phases we've actually heard back about.
  const busy = finishing || recordAreaStatus?.phase === 'processing' || recordAreaStatus?.phase === 'saving';
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
              // The Sheet's scroll body clips on the x-axis too (overflow-y-auto forces
              // overflow-x to auto per spec), so an outside-drawn focus outline gets shaved at
              // the edges -- draw the ring inset instead, inside the input's own border box.
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
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
            {busy && <OverlayChip>{recordAreaStatus?.phase === 'processing' ? 'Processing…' : 'Saving…'}</OverlayChip>}
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
            {finishTimedOut && (
              <div className="mt-2 rounded-[10px] bg-warn-wash px-2.5 py-1.5 text-center text-[.76rem] font-semibold text-warn">
                Still saving… the area may already be saved — check the map.
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
            {/* The watchdog fired (FINISH_TIMEOUT_MS with no terminal status) -- never leave the
                user trapped in the dialog: a plain, non-destructive way out. Doesn't auto-close or
                auto-discard, since the area may well have saved successfully server-side. */}
            {finishTimedOut && (
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-center" onClick={onClose}>
                Close
              </Button>
            )}
          </Card>
        </>
      )}
    </>
  );
}
