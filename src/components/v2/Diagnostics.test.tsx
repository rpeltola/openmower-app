import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// Diagnostics' new "Capabilities" card reads the live `capabilities/json` -> `Mower.capabilities`
// (a sparse `{name: level}` map, ported from the v1 `/debug` page's CapabilitiesSection) --
// fake the mowersStore selector so it's controllable, same pattern Map.commands.test.tsx uses.
vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
}));

import {Diagnostics} from '@/components/v2/Diagnostics';
import {useSelectedMower} from '@/stores/mowersStore';
import type {Capabilities} from '@/stores/schemas';

function mockMower(capabilities: Capabilities | undefined) {
  const fakeMower = {name: 'Test Mower', state: {}, capabilities};
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(fakeMower)) as typeof useSelectedMower,
  );
}

describe('Diagnostics — Capabilities card', () => {
  afterEach(cleanup);

  it('renders a chip per reported capability, humanized', () => {
    mockMower({events: 1, mow_direction: 2, position: 1});
    render(<Diagnostics />);

    // Mobile + desktop both render the card (one hidden via CSS, not unmounted), so each label
    // appears twice -- assert presence, not count.
    expect(screen.getAllByText('Events').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Position').length).toBeGreaterThan(0);
    // A level above 1 is surfaced alongside the label.
    expect(screen.getAllByText('Mow Direction ×2').length).toBeGreaterThan(0);
  });

  it('shows the empty state when capabilities/json has not arrived yet', () => {
    mockMower(undefined);
    render(<Diagnostics />);
    expect(screen.getAllByText('No capabilities reported yet').length).toBeGreaterThan(0);
  });

  it('shows the empty state for an explicitly empty capabilities map (old gateway)', () => {
    mockMower({});
    render(<Diagnostics />);
    expect(screen.getAllByText('No capabilities reported yet').length).toBeGreaterThan(0);
  });

  it('never crashes when sensors/state are entirely absent', () => {
    mockMower({events: 1});
    expect(() => render(<Diagnostics />)).not.toThrow();
  });
});
