import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// W9 mission composer — end-to-end wiring test through the real Map screen: adding a saved area
// to the composer and pressing Start/Add/Continue/Cancel must call the real Mower.publishMission*
// methods (mow_mission/start|add|continue|cancel), not a local mock. Same mocking pattern as
// Map.commands.test.tsx (fakes mowersStore's useSelectedMower rather than mounting a real store).
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
  useMowersStore: {getState: vi.fn().mockReturnValue({mowers: [], selected: 0})},
}));

// MapCanvas is a real Leaflet map, loaded via next/dynamic(ssr:false); its dynamic import resolves
// on a real async tick, which can otherwise race a later test's render/cleanup cycle in this file
// (mount/unmount against an already-torn-down container). Mission composer wiring doesn't touch
// the map canvas itself, so stub it out.
vi.mock('@/components/v2/map/MapCanvas', () => ({
  MapCanvas: () => null,
}));

import {Map} from '@/components/v2/Map';
import {useSelectedMower} from '@/stores/mowersStore';
import type {MissionState} from '@/stores/schemas';

function mockMower(missionState: MissionState | null = null) {
  const fakeMower = {
    state: {current_state: 'IDLE', is_charging: false},
    commandClient: {send: vi.fn(() => Promise.resolve({accepted: true}))},
    track: {buffer: [], historySegments: [], attributes: {blades: false}},
    missionState,
    publishMissionStart: vi.fn(),
    publishMissionAdd: vi.fn(),
    publishMissionContinue: vi.fn(),
    publishMissionCancel: vi.fn(),
  };
  // Mirror the real hook's default param (selector = identity) — Map.tsx's mission wiring calls
  // `useSelectedMower<Mower | undefined>()` with NO selector to get the whole Mower (same pattern
  // as Settings.tsx), which `selector?.(fakeMower)` alone would silently turn into `undefined`.
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector: (mower?: unknown) => unknown = (m) => m) => selector(fakeMower)) as typeof useSelectedMower,
  );
  return fakeMower;
}

describe('Map mission composer wiring (W9)', () => {
  afterEach(cleanup);

  // Both the map FABs and the desktop "Areas" rail expose a "Mission" opener (see Map.tsx) —
  // grab the first (the FAB, first in DOM order) to open the composer sheet, then wait for the
  // Sheet's own open-transition effect to actually mount its content.
  const openMissionSheet = async () => {
    screen.getAllByRole('button', {name: 'Mission'})[0].click();
    await waitFor(() => screen.getByRole('dialog'));
  };

  it('Start mission publishes the built payload via mow_mission/start, then clears the composer', async () => {
    const fakeMower = mockMower(null);
    render(<Map />);

    await openMissionSheet();
    // MOCK_ZONES (no real map reported yet) seeds one mowable area: 'Etupiha'.
    screen.getByRole('button', {name: /Etupiha/}).click();

    const start = await waitFor(() => {
      const button = screen.getByRole('button', {name: /Start mission/});
      expect(button).toBeEnabled();
      return button;
    });
    start.click();

    await waitFor(() => expect(fakeMower.publishMissionStart).toHaveBeenCalledTimes(1));
    expect(fakeMower.publishMissionStart).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs: [{type: 'area', area_id: 'etupiha', direction_deg: 0, repeats: 1}],
      }),
    );
    // The composer's queue is cleared after a successful start — back to the empty-queue copy
    // ('Etupiha' itself stays listed in "Add to mission", which is independent of the queue).
    expect(screen.getByText('Add a saved area above to build an ordered mission.')).toBeInTheDocument();
  });

  it('appends to a running mission via mow_mission/add, reusing the running mission_id', async () => {
    const fakeMower = mockMower({
      mission_id: 'running-id',
      job_index: 0,
      job_total: 1,
      type: 'area',
      area_id: 'etupiha',
      pass: 1,
      repeats: 1,
      coverage: 0.3,
      state: 'mowing',
    });
    render(<Map />);

    await openMissionSheet();
    screen.getByRole('button', {name: /Etupiha/}).click();

    const addToMission = await waitFor(() => {
      const button = screen.getByRole('button', {name: /Add to mission/});
      expect(button).toBeEnabled();
      return button;
    });
    addToMission.click();

    await waitFor(() => expect(fakeMower.publishMissionAdd).toHaveBeenCalledTimes(1));
    expect(fakeMower.publishMissionAdd).toHaveBeenCalledWith(expect.objectContaining({mission_id: 'running-id'}));
    expect(fakeMower.publishMissionStart).not.toHaveBeenCalled();
  });

  it('Continue and Cancel call the real mow_mission/continue and mow_mission/cancel publishers', async () => {
    const fakeMower = mockMower({
      mission_id: 'running-id',
      job_index: 0,
      job_total: 1,
      type: 'area',
      pass: 1,
      repeats: 1,
      coverage: 0.3,
      state: 'paused',
    });
    render(<Map />);

    await openMissionSheet();
    screen.getByRole('button', {name: /Continue/}).click();
    expect(fakeMower.publishMissionContinue).toHaveBeenCalledTimes(1);

    screen.getByRole('button', {name: /Cancel/}).click();
    expect(fakeMower.publishMissionCancel).toHaveBeenCalledTimes(1);
  });
});
