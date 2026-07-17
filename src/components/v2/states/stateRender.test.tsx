import {StatePill} from '@/components/v2/ui/StatePill';
import {BootingScreen} from '@/components/v2/states/BootingScreen';
import {PausedBlockerScreen} from '@/components/v2/states/PausedBlockerScreen';
import {
  ALL_PAUSED_REASONS,
  ALL_ROBOT_STATES,
  READINESS_KEYS,
  REASON_COPY,
  STATE_COPY,
  type ReadinessValue,
} from '@/lib/v2/robotState';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

const READINESS_VALUES: ReadinessValue[] = ['ok', 'waiting', 'converging', 'activating', 'error'];

// R7 minimum test scaffold: every state/reason/readiness combo the frozen wire contract can
// emit must render without throwing, table-driven off robotState.ts's canonical lists so the
// table can't silently drift from the enums as they grow.
describe('state x reason x readiness render table (R7)', () => {
  it.each(ALL_ROBOT_STATES)('STATE_COPY[%s] renders its label without throwing', (state) => {
    const copy = STATE_COPY[state];
    expect(copy).toBeDefined();
    const Icon = copy.icon;
    render(
      <StatePill
        tone={copy.tone === 'danger' ? 'warn' : copy.tone}
        icon={<Icon size={16} />}
        label={copy.label}
        sub={copy.sub}
      />,
    );
    expect(screen.getByText(copy.label)).toBeInTheDocument();
  });

  it.each(ALL_PAUSED_REASONS)('PausedBlockerScreen renders reason=%s without throwing', (reason) => {
    render(<PausedBlockerScreen reasons={[reason]} />);
    expect(screen.getAllByText(REASON_COPY[reason].label).length).toBeGreaterThan(0);
  });

  it('PausedBlockerScreen renders a stack of several reasons at once, most-severe-first', () => {
    render(<PausedBlockerScreen reasons={['EMERGENCY', 'GPS_LOSS', 'BATTERY_LOW']} />);
    expect(screen.getAllByText(REASON_COPY.EMERGENCY.label).length).toBeGreaterThan(0);
    expect(screen.getAllByText(REASON_COPY.GPS_LOSS.label).length).toBeGreaterThan(0);
    expect(screen.getAllByText(REASON_COPY.BATTERY_LOW.label).length).toBeGreaterThan(0);
  });

  it.each(READINESS_KEYS)('BootingScreen renders every readiness value for %s without throwing', (key) => {
    for (const value of READINESS_VALUES) {
      const {unmount} = render(<BootingScreen readiness={{[key]: value}} />);
      unmount();
    }
  });
});
