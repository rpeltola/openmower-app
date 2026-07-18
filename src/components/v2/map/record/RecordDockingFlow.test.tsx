import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

// RecordDockingFlow's publish/status wiring goes through the real store (Mower.
// publishRecordDocking* + recordDockingStatus) -- fake the mowersStore module so both are
// controllable, same pattern as RecordAreaFlow.test.tsx.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

// jsdom doesn't implement matchMedia -- Sheet's reduced-motion check calls it unconditionally on
// mount (see RecordAreaFlow.test.tsx, which needs the same stub for the same reason).
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

import {nextRecordDockingStep, RecordDockingFlow} from '@/components/v2/map/record/RecordDockingFlow';
import type {RecordDockingStatus} from '@/stores/schemas';
import {useSelectedMower} from '@/stores/mowersStore';

function mockMower(recordDockingStatus: RecordDockingStatus | null = null) {
  const publishRecordDockingStart = vi.fn();
  const publishRecordDockingCancel = vi.fn();
  const fakeMower = {recordDockingStatus, publishRecordDockingStart, publishRecordDockingCancel};
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
  return {publishRecordDockingStart, publishRecordDockingCancel};
}

describe('RecordDockingFlow', () => {
  afterEach(cleanup);

  it('renders nothing while closed', () => {
    mockMower();
    const {container} = render(<RecordDockingFlow open={false} onClose={vi.fn()} onToast={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Start recording is disabled until a name is entered, then publishes {name}', async () => {
    const {publishRecordDockingStart} = mockMower();
    render(<RecordDockingFlow open onClose={vi.fn()} onToast={vi.fn()} />);

    expect(screen.getByRole('button', {name: /Start recording/})).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Docking station'), {target: {value: 'Front dock'}});
    screen.getByRole('button', {name: /Start recording/}).click();

    await waitFor(() => expect(publishRecordDockingStart).toHaveBeenCalledWith('Front dock'));
  });

  it('no teleop pad is shown while recording -- the mower drives itself', async () => {
    mockMower({phase: 'driving', status: 1, message: ''});
    render(<RecordDockingFlow open onClose={vi.fn()} onToast={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Docking station'), {target: {value: 'Front dock'}});
    screen.getByRole('button', {name: /Start recording/}).click();

    await waitFor(() => expect(screen.getAllByText('Driving to the dock…').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', {name: /Done/})).not.toBeInTheDocument();
  });

  it('a success status toasts and closes the flow -- no explicit Done trigger', async () => {
    const onClose = vi.fn();
    const onToast = vi.fn();
    mockMower({phase: 'recording', status: 3, message: ''});
    const {rerender} = render(<RecordDockingFlow open onClose={onClose} onToast={onToast} />);
    fireEvent.change(screen.getByPlaceholderText('Docking station'), {target: {value: 'Front dock'}});
    screen.getByRole('button', {name: /Start recording/}).click();
    await waitFor(() => expect(screen.getAllByText('Verifying position…').length).toBeGreaterThan(0));

    mockMower({phase: 'success', status: 0, message: '', code: 0});
    rerender(<RecordDockingFlow open onClose={onClose} onToast={onToast} />);

    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Docking station recorded'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('a failed status toasts the message and stays open (no onClose)', async () => {
    const onClose = vi.fn();
    const onToast = vi.fn();
    mockMower({phase: 'waiting_for_charging', status: 2, message: ''});
    const {rerender} = render(<RecordDockingFlow open onClose={onClose} onToast={onToast} />);
    fireEvent.change(screen.getByPlaceholderText('Docking station'), {target: {value: 'Front dock'}});
    screen.getByRole('button', {name: /Start recording/}).click();
    await waitFor(() => expect(screen.getAllByText('Waiting for charging…').length).toBeGreaterThan(0));

    mockMower({phase: 'failed', status: 99, message: 'No charging detected', code: 1});
    rerender(<RecordDockingFlow open onClose={onClose} onToast={onToast} />);

    await waitFor(() => expect(onToast).toHaveBeenCalledWith('No charging detected'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Stop recording'})).toBeInTheDocument();
  });

  it('Stop recording publishes record_docking/cancel and closes', async () => {
    const onClose = vi.fn();
    const {publishRecordDockingCancel} = mockMower({phase: 'saving', status: 4, message: ''});
    render(<RecordDockingFlow open onClose={onClose} onToast={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Docking station'), {target: {value: 'Front dock'}});
    screen.getByRole('button', {name: /Start recording/}).click();
    await waitFor(() => screen.getByRole('button', {name: 'Stop recording'}));

    screen.getByRole('button', {name: 'Stop recording'}).click();

    expect(publishRecordDockingCancel).toHaveBeenCalledWith();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('nextRecordDockingStep (state machine, headless)', () => {
  it('open always (re-)enters picking', () => {
    expect(nextRecordDockingStep('idle', {type: 'open'})).toBe('picking');
    expect(nextRecordDockingStep('done', {type: 'open'})).toBe('picking');
  });

  it('start only advances from picking', () => {
    expect(nextRecordDockingStep('picking', {type: 'start'})).toBe('recording');
    expect(nextRecordDockingStep('idle', {type: 'start'})).toBe('idle');
  });

  it('a status event is ignored outside recording/error (a stale retained message)', () => {
    expect(nextRecordDockingStep('picking', {type: 'status', phase: 'success'})).toBe('picking');
    expect(nextRecordDockingStep('idle', {type: 'status', phase: 'failed'})).toBe('idle');
  });

  it('recording -> done on success, error on failed, stays recording through the in-progress phases', () => {
    expect(nextRecordDockingStep('recording', {type: 'status', phase: 'success'})).toBe('done');
    expect(nextRecordDockingStep('recording', {type: 'status', phase: 'failed'})).toBe('error');
    expect(nextRecordDockingStep('recording', {type: 'status', phase: 'driving'})).toBe('recording');
    expect(nextRecordDockingStep('recording', {type: 'status', phase: 'waiting_for_charging'})).toBe('recording');
    expect(nextRecordDockingStep('recording', {type: 'status', phase: 'saving'})).toBe('recording');
  });

  it('error can retry back to recording, or resolve to done, via further status events', () => {
    expect(nextRecordDockingStep('error', {type: 'status', phase: 'driving'})).toBe('recording');
    expect(nextRecordDockingStep('error', {type: 'status', phase: 'success'})).toBe('done');
  });

  it('cancel/close always resolve to idle', () => {
    expect(nextRecordDockingStep('recording', {type: 'cancel'})).toBe('idle');
    expect(nextRecordDockingStep('picking', {type: 'close'})).toBe('idle');
  });
});
