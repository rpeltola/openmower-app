import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// MiniMap now reads the store directly (real garden/dock/pose/accuracy, no more `headingDeg`
// prop) -- fake the mowersStore the same way ManualControl.test.tsx does so each test can control
// exactly what "real data" looks like.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

import {MiniMap} from '@/components/v2/ui/MiniMap';
import {useSelectedMower} from '@/stores/mowersStore';
import type {MapData, State} from '@/stores/schemas';

function mockMower(overrides: {map?: MapData; position?: unknown; state?: Partial<State>}) {
  const fakeMower = {
    map: overrides.map,
    position: overrides.position,
    state: {current_state: 'IDLE', is_charging: false, ...overrides.state},
  };
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
}

const MOW_AREA_MAP: MapData = {
  areas: [
    {
      id: 'a1',
      properties: {name: 'Etupiha', type: 'mow', active: true},
      outline: [
        {x: -5, y: -5},
        {x: 5, y: -5},
        {x: 5, y: 5},
        {x: -5, y: 5},
      ],
    },
  ],
  docking_stations: [],
};

describe('MiniMap', () => {
  afterEach(cleanup);

  it('renders the waiting/empty state with no map and no pose', () => {
    mockMower({map: undefined, position: undefined, state: {}});
    const {container} = render(<MiniMap />);

    expect(screen.getByText('Map loading…')).toBeInTheDocument();
    expect(container.querySelectorAll('polygon').length).toBe(0);
    expect(container.querySelector('[data-testid="accuracy-ring"]')).toBeNull();
  });

  it('renders the zone polygon and mower marker but no accuracy ring when position_accuracy is missing', () => {
    mockMower({
      map: MOW_AREA_MAP,
      position: undefined,
      state: {
        pose: {x: 0, y: 0, heading: 0.4, heading_accuracy: 0, heading_valid: true, pos_accuracy: 0},
        sensors: {gps: {position_accuracy: null}} as unknown as State['sensors'],
      },
    });
    const {container} = render(<MiniMap />);

    expect(screen.queryByText('Map loading…')).not.toBeInTheDocument();
    expect(container.querySelectorAll('polygon').length).toBe(1);
    // Mower marker body is present (the rounded-square rect the marker always draws).
    expect(container.querySelector('rect[rx="8"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="accuracy-ring"]')).toBeNull();
  });

  it('renders the accuracy ring when a real position_accuracy reading is present', () => {
    mockMower({
      map: MOW_AREA_MAP,
      position: undefined,
      state: {
        pose: {x: 0, y: 0, heading: 0.4, heading_accuracy: 0, heading_valid: true, pos_accuracy: 0},
        sensors: {gps: {position_accuracy: 0.35}} as unknown as State['sensors'],
      },
    });
    const {container} = render(<MiniMap />);

    expect(container.querySelector('[data-testid="accuracy-ring"]')).not.toBeNull();
  });
});
