import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

// Settings pulls in next/navigation (useSearchParams for the ?category= deep link, useRouter via
// the always-mounted MowerSelector) and the mowersStore (useSelectedMower for the mower itself,
// useMowersStore via useConnectionStatus/MowerSelector) -- fake both, same pattern
// ManualControl.test.tsx/AppShell.test.tsx already use, so the nav-entry gating logic renders
// without a real app-router context or MQTT-backed store.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({push: vi.fn(), back: vi.fn()}),
}));

vi.mock('@/stores/mowersStore', () => ({
  useSelectedMower: vi.fn(),
  useMowersStore: vi.fn(),
}));

import {Settings} from '@/components/v2/Settings';
import {setShowUnsupportedFeatures} from '@/lib/v2/featureSupport';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';

// jsdom doesn't implement matchMedia -- theme.ts's dark-mode detection calls it unconditionally
// on mount (pulled in via ScreenHeader), same stub ManualControl.test.tsx needs for its own
// useMediaQuery calls.
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

function setup() {
  vi.mocked(useSelectedMower).mockImplementation(
    ((selector?: (mower?: unknown) => unknown) => selector?.(undefined)) as typeof useSelectedMower,
  );
  vi.mocked(useMowersStore).mockImplementation(
    ((selector?: (s: unknown) => unknown) =>
      selector?.({mowers: [], selected: 0, mqttStatuses: {}, reconnectNow: vi.fn()})) as typeof useMowersStore,
  );
}

// Backup & Restore / Notifications / Safety are fully gated (their entire content pane is one
// FeatureGate wrapper -- see SettingsCategoryDetail.tsx/BackupRestore.tsx) -- an unsupported
// mower must not show a nav entry that only leads to an empty pane. `getAllByRole('button', ...)`
// (not queryByText) on purpose: the mobile grouped list and the desktop rail are BOTH always in
// the jsdom DOM (only CSS `md:` classes tell them apart, which jsdom doesn't apply), and a plain
// text query would also match the desktop pane's own category-label heading (a non-interactive
// div, not a nav entry) -- scoping to role=button sidesteps both issues.
describe('Settings — nav-entry gating for fully-gated categories', () => {
  afterEach(() => {
    cleanup();
    setShowUnsupportedFeatures(false);
  });

  it('hides Backup & Restore / Notifications / Safety nav entries by default (dev toggle off)', () => {
    setup();
    render(<Settings />);

    expect(screen.queryAllByRole('button', {name: /Backup & Restore/})).toHaveLength(0);
    expect(screen.queryAllByRole('button', {name: /Notifications/})).toHaveLength(0);
    expect(screen.queryAllByRole('button', {name: /^Safety$/})).toHaveLength(0);
  });

  it('reveals all 3 nav entries once the dev toggle is on', () => {
    setShowUnsupportedFeatures(true);
    setup();
    render(<Settings />);

    expect(screen.getAllByRole('button', {name: /Backup & Restore/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /Notifications/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /^Safety$/}).length).toBeGreaterThan(0);
  });

  it('always shows the non-gated nav entries regardless of the toggle', () => {
    setup();
    render(<Settings />);

    expect(screen.getAllByRole('button', {name: /^Connection/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /Positioning \/ RTK/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /Docking station/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /^Units/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /Map basemap/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /^General$/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /^Maintenance$/}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: /^About/}).length).toBeGreaterThan(0);
  });
});
