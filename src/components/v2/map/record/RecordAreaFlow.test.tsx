import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

// RecordAreaFlow's publish/status wiring goes through the real store (Mower.publishRecordArea* +
// recordAreaStatus) -- fake the mowersStore module so both are controllable, same pattern
// ManualControl.test.tsx/Map.commands.test.tsx use. `useMowersStore` is mocked too because
// useTeleop.ts (the real drive input this flow reuses) reads it directly via `.getState()`.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
  useMowersStore: {getState: vi.fn()},
}));

// jsdom doesn't implement matchMedia -- Sheet's reduced-motion check calls it unconditionally
// on mount (see ManualControl.test.tsx, which needs the same stub for the same reason).
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

import {nextRecordAreaStep, RecordAreaFlow} from '@/components/v2/map/record/RecordAreaFlow';
import type {RecordAreaStatus} from '@/stores/schemas';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';

function mockMower(recordAreaStatus: RecordAreaStatus | null = null) {
  const publishRecordAreaStart = vi.fn();
  const publishRecordAreaFinish = vi.fn();
  const publishRecordAreaCancel = vi.fn();
  const publishTeleop = vi.fn();
  const fakeMower = {
    recordAreaStatus,
    publishRecordAreaStart,
    publishRecordAreaFinish,
    publishRecordAreaCancel,
    publishTeleop,
  };
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
  vi.mocked(useMowersStore.getState).mockReturnValue({mowers: [fakeMower], selected: 0} as never);
  return {publishRecordAreaStart, publishRecordAreaFinish, publishRecordAreaCancel};
}

describe('RecordAreaFlow', () => {
  afterEach(cleanup);

  it('renders nothing while closed', () => {
    mockMower();
    const {container} = render(<RecordAreaFlow open={false} onClose={vi.fn()} onToast={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Start recording publishes {name, type} on the real store (default name, mowing area)', async () => {
    const {publishRecordAreaStart} = mockMower();
    render(<RecordAreaFlow open onClose={vi.fn()} onToast={vi.fn()} />);

    screen.getByRole('button', {name: /Start recording/}).click();

    await waitFor(() => expect(publishRecordAreaStart).toHaveBeenCalledWith('New mowing area', 2));
  });

  it('a typed name and the Obstacle type are passed through', async () => {
    const {publishRecordAreaStart} = mockMower();
    render(<RecordAreaFlow open onClose={vi.fn()} onToast={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('New mowing area'), {target: {value: 'Flower bed'}});

    fireEvent.click(screen.getByRole('radio', {name: 'Obstacle'}));
    screen.getByRole('button', {name: /Start recording/}).click();

    await waitFor(() => expect(publishRecordAreaStart).toHaveBeenCalledWith('Flower bed', 0));
  });

  it('resumes straight into the driving view (no picking) when opened while already recording', async () => {
    mockMower({phase: 'recording', point_count: 3, polygon: [], message: ''});
    render(<RecordAreaFlow open onClose={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => screen.getByRole('button', {name: /Done/}));
    expect(screen.queryByRole('button', {name: /Start recording/})).not.toBeInTheDocument();
  });

  it('Done publishes record_area/finish while recording', async () => {
    const {publishRecordAreaFinish} = mockMower({phase: 'recording', point_count: 4, polygon: [], message: ''});
    render(<RecordAreaFlow open onClose={vi.fn()} onToast={vi.fn()} />);

    await waitFor(() => screen.getByRole('button', {name: /Done/}));
    screen.getByRole('button', {name: /Done/}).click();

    expect(publishRecordAreaFinish).toHaveBeenCalledWith();
  });

  it('a success status toasts and closes the flow', async () => {
    const onClose = vi.fn();
    const onToast = vi.fn();
    mockMower({phase: 'recording', point_count: 6, polygon: [], message: ''});
    const {rerender} = render(<RecordAreaFlow open onClose={onClose} onToast={onToast} />);
    await waitFor(() => screen.getByRole('button', {name: /Done/}));

    mockMower({phase: 'success', point_count: 6, polygon: [], message: ''});
    rerender(<RecordAreaFlow open onClose={onClose} onToast={onToast} />);

    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Area saved'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('a failed status toasts the message and stays open (no onClose)', async () => {
    const onClose = vi.fn();
    const onToast = vi.fn();
    mockMower({phase: 'recording', point_count: 1, polygon: [], message: ''});
    const {rerender} = render(<RecordAreaFlow open onClose={onClose} onToast={onToast} />);
    await waitFor(() => screen.getByRole('button', {name: /Done/}));

    mockMower({phase: 'failed', point_count: 1, polygon: [], message: 'Too few points', code: 1});
    rerender(<RecordAreaFlow open onClose={onClose} onToast={onToast} />);

    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Too few points'));
    expect(onClose).not.toHaveBeenCalled();
    // Discard/Done are still reachable so the user can retry or bail out.
    expect(screen.getByRole('button', {name: 'Discard'})).toBeInTheDocument();
  });

  it('Discard cancels the recording and closes', async () => {
    const onClose = vi.fn();
    const {publishRecordAreaCancel} = mockMower({phase: 'recording', point_count: 2, polygon: [], message: ''});
    render(<RecordAreaFlow open onClose={onClose} onToast={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', {name: 'Discard'}));

    screen.getByRole('button', {name: 'Discard'}).click();

    expect(publishRecordAreaCancel).toHaveBeenCalledWith();
    expect(onClose).toHaveBeenCalled();
  });

  it('Done immediately shows a local "Saving…" affordance and disables itself (no double-publish)', async () => {
    const {publishRecordAreaFinish} = mockMower({phase: 'recording', point_count: 5, polygon: [], message: ''});
    render(<RecordAreaFlow open onClose={vi.fn()} onToast={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', {name: /Done/}));

    screen.getByRole('button', {name: /Done/}).click();

    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Done/})).toBeDisabled();

    // A second tap (if it somehow got through) must not re-publish.
    screen.getByRole('button', {name: /Done/}).click();
    expect(publishRecordAreaFinish).toHaveBeenCalledTimes(1);
  });

  it('watchdog: no terminal status within FINISH_TIMEOUT_MS surfaces a non-destructive Close, without auto-closing', async () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      mockMower({phase: 'recording', point_count: 5, polygon: [], message: ''});
      render(<RecordAreaFlow open onClose={onClose} onToast={vi.fn()} />);

      act(() => {
        screen.getByRole('button', {name: /Done/}).click();
      });

      // Not yet at the timeout: no "stuck" affordance, and onClose hasn't been called.
      act(() => {
        vi.advanceTimersByTime(14999);
      });
      expect(screen.queryByRole('button', {name: 'Close'})).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2);
      });

      expect(screen.getByText(/Still saving/)).toBeInTheDocument();
      const closeButton = screen.getByRole('button', {name: 'Close'});
      expect(onClose).not.toHaveBeenCalled(); // never auto-closes

      act(() => {
        closeButton.click();
      });
      expect(onClose).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('nextRecordAreaStep (state machine, headless)', () => {
  it('open always (re-)enters picking', () => {
    expect(nextRecordAreaStep('idle', {type: 'open'})).toBe('picking');
    expect(nextRecordAreaStep('done', {type: 'open'})).toBe('picking');
  });

  it('start only advances from picking', () => {
    expect(nextRecordAreaStep('picking', {type: 'start'})).toBe('recording');
    expect(nextRecordAreaStep('idle', {type: 'start'})).toBe('idle');
  });

  it('a status event is ignored outside recording/error (a stale retained message)', () => {
    expect(nextRecordAreaStep('picking', {type: 'status', phase: 'success'})).toBe('picking');
    expect(nextRecordAreaStep('idle', {type: 'status', phase: 'failed'})).toBe('idle');
  });

  it('recording -> done on success, error on failed, stays recording otherwise', () => {
    expect(nextRecordAreaStep('recording', {type: 'status', phase: 'success'})).toBe('done');
    expect(nextRecordAreaStep('recording', {type: 'status', phase: 'failed'})).toBe('error');
    expect(nextRecordAreaStep('recording', {type: 'status', phase: 'processing'})).toBe('recording');
  });

  it('error can retry back to recording, or resolve to done, via further status events', () => {
    expect(nextRecordAreaStep('error', {type: 'status', phase: 'recording'})).toBe('recording');
    expect(nextRecordAreaStep('error', {type: 'status', phase: 'success'})).toBe('done');
  });

  it('cancel/close always resolve to idle', () => {
    expect(nextRecordAreaStep('recording', {type: 'cancel'})).toBe('idle');
    expect(nextRecordAreaStep('picking', {type: 'close'})).toBe('idle');
  });
});
