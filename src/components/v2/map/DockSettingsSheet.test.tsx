import {DockSettingsSheet} from '@/components/v2/map/DockSettingsSheet';
import type {Dock} from '@/components/v2/map/mockMap';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

// jsdom doesn't implement matchMedia -- Sheet's reduced-motion check calls it unconditionally on
// mount (same stub RecordAreaFlow.test.tsx/RecordDockingFlow.test.tsx need).
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

const DOCK: Dock = {
  id: 'dock-1',
  position: {x: -4, y: -4.5},
  heading: 0,
  approach_distance: 0.6,
  name: 'Docking station',
  active: true,
};

describe('DockSettingsSheet', () => {
  afterEach(cleanup);

  it('renders no dock-settings content while closed', () => {
    render(<DockSettingsSheet open={false} onClose={vi.fn()} dock={DOCK} onUpdate={vi.fn()} />);
    expect(screen.queryByText('Dock settings')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Docking station')).not.toBeInTheDocument();
  });

  it('shows the current heading (degrees) and approach distance', () => {
    render(<DockSettingsSheet open onClose={vi.fn()} dock={DOCK} onUpdate={vi.fn()} />);
    expect(screen.getAllByText('0°').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.6 m').length).toBeGreaterThan(0);
  });

  it('the heading stepper commits a +5deg patch, in radians', () => {
    const onUpdate = vi.fn();
    render(<DockSettingsSheet open onClose={vi.fn()} dock={DOCK} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('button', {name: 'Increase heading'})[0]);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.heading).toBeCloseTo((5 * Math.PI) / 180, 6);
  });

  it('the heading stepper wraps past 180deg instead of clamping', () => {
    const onUpdate = vi.fn();
    const dock: Dock = {...DOCK, heading: Math.PI}; // 180deg
    render(<DockSettingsSheet open onClose={vi.fn()} dock={dock} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('button', {name: 'Increase heading'})[0]);
    const patch = onUpdate.mock.calls[0][0];
    // 180 + 5 wraps to -175, not 185.
    expect((patch.heading * 180) / Math.PI).toBeCloseTo(-175, 4);
  });

  it('the approach-distance stepper commits a +0.1m patch', () => {
    const onUpdate = vi.fn();
    render(<DockSettingsSheet open onClose={vi.fn()} dock={DOCK} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('button', {name: 'Increase approach distance'})[0]);
    expect(onUpdate.mock.calls[0][0]).toEqual({approach_distance: 0.7});
  });

  it('the approach-distance stepper never goes negative', () => {
    const onUpdate = vi.fn();
    const zeroDock: Dock = {...DOCK, approach_distance: 0};
    render(<DockSettingsSheet open onClose={vi.fn()} dock={zeroDock} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('button', {name: 'Decrease approach distance'})[0]);
    expect(onUpdate.mock.calls[0][0]).toEqual({approach_distance: 0});
  });

  it('the active switch commits {active: false}', () => {
    const onUpdate = vi.fn();
    render(<DockSettingsSheet open onClose={vi.fn()} dock={DOCK} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('switch', {name: 'Dock active'})[0]);
    expect(onUpdate).toHaveBeenCalledWith({active: false});
  });

  it('blurring the name field commits the trimmed name', () => {
    const onUpdate = vi.fn();
    render(<DockSettingsSheet open onClose={vi.fn()} dock={DOCK} onUpdate={onUpdate} />);
    const [input] = screen.getAllByPlaceholderText('Docking station');
    fireEvent.change(input, {target: {value: '  Back dock  '}});
    fireEvent.blur(input);
    expect(onUpdate).toHaveBeenCalledWith({name: 'Back dock'});
  });
});
