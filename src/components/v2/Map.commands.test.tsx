import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// Map.tsx's own stat-card command surfaces (Pause/Resume/Stop/Dock) now go through the real
// `useCommand`/`useCommandAvailability` client (same protocol Home.tsx uses), replacing the old
// local `mockPaused` toggle -- fake the mowersStore selector so `commandClient.send` is
// controllable and assert the wiring, not the whole map-editor surface.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

import {Map} from '@/components/v2/Map';
import {useSelectedMower} from '@/stores/mowersStore';

function mockMower(state: Record<string, unknown>, send: (...args: never[]) => Promise<{accepted: boolean; reject_code?: string; state?: string}>) {
  const fakeMower = {
    state,
    commandClient: {send},
    // Map.tsx's own (non-command-related) selectors index straight into these without an
    // intermediate `?.` guard -- give them an empty-but-present shape so this test can focus on
    // the command wiring rather than the map/track rendering surface.
    track: {buffer: [], historySegments: [], attributes: {blades: false}},
  };
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
}

describe('Map stat-card command wiring (W9 A2a)', () => {
  afterEach(cleanup);

  it('Pause calls the real command client (not a local mockPaused toggle) while MOWING', async () => {
    const send = vi.fn(() => Promise.resolve({accepted: true, state: 'PAUSED'}));
    mockMower({state: 'MOWING', current_state: 'MOWING', is_charging: false, current_area_name: 'Etupiha'}, send);
    render(<Map />);

    const pauseButtons = screen.getAllByRole('button', {name: /Pause/});
    pauseButtons[0].click();

    await waitFor(() => expect(send).toHaveBeenCalledWith('pause', undefined));
  });

  it('Resume is reachable while PAUSED (real state, not the old isMowing-gated mock)', async () => {
    const send = vi.fn(() => Promise.resolve({accepted: true, state: 'MOWING'}));
    mockMower({state: 'PAUSED', current_state: 'PAUSED', is_charging: false}, send);
    render(<Map />);

    const resumeButtons = screen.getAllByRole('button', {name: /Resume/});
    resumeButtons[0].click();

    await waitFor(() => expect(send).toHaveBeenCalledWith('resume', undefined));
  });

  it('shows a reason chip when Pause is disallowed (blockers-as-data, same pattern as Home)', async () => {
    const send = vi.fn(() => Promise.resolve({accepted: false, reject_code: 'NOT_READY', state: 'MOWING'}));
    mockMower(
      {
        state: 'MOWING',
        current_state: 'MOWING',
        is_charging: false,
        commands: {
          mow: {allowed: true, reasons: []},
          stop: {allowed: true, reasons: []},
          dock: {allowed: true, reasons: []},
          pause: {allowed: false, reasons: ['NOT_READY']},
          resume: {allowed: false, reasons: []},
          undock: {allowed: false, reasons: []},
        },
      },
      send,
    );
    render(<Map />);

    expect(screen.getAllByText('Not ready yet').length).toBeGreaterThan(0);
    const pauseButtons = screen.getAllByRole('button', {name: /Pause/});
    expect(pauseButtons.some((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});
