import {describe, expect, it} from 'vitest';
import {ALL_PAUSED_REASONS, ALL_REJECT_CODES, ALL_ROBOT_STATES, REASON_COPY, REJECT_COPY, STATE_COPY} from '@/lib/v2/robotState';

// R4 completeness gate (OpenMowerNext docs/w9-implementation.md §0.3): every value of the frozen
// wire contract's enums MUST have a copy-table row, or an unrecognized code would render raw
// somewhere instead of a label. This is the app's first test suite's "actually fails the build"
// gate -- add a value to ALL_ROBOT_STATES/ALL_PAUSED_REASONS/ALL_REJECT_CODES (robotState.ts)
// without a matching STATE_COPY/REASON_COPY/REJECT_COPY row and this test goes red.
describe('copy-table completeness (R4 gate)', () => {
  it('STATE_COPY has a row for every RobotState', () => {
    for (const state of ALL_ROBOT_STATES) {
      expect(STATE_COPY[state], `STATE_COPY missing a row for ${state}`).toBeDefined();
    }
    expect(Object.keys(STATE_COPY)).toHaveLength(ALL_ROBOT_STATES.length);
  });

  it('REASON_COPY has a row for every PausedReason', () => {
    for (const reason of ALL_PAUSED_REASONS) {
      expect(REASON_COPY[reason], `REASON_COPY missing a row for ${reason}`).toBeDefined();
    }
    expect(Object.keys(REASON_COPY)).toHaveLength(ALL_PAUSED_REASONS.length);
  });

  it('REJECT_COPY has a row for every RejectCode, including UNSUPPORTED (§0.3\'s reconciliation)', () => {
    for (const code of ALL_REJECT_CODES) {
      expect(REJECT_COPY[code], `REJECT_COPY missing a row for ${code}`).toBeDefined();
    }
    expect(Object.keys(REJECT_COPY)).toHaveLength(ALL_REJECT_CODES.length);
    expect(REJECT_COPY.UNSUPPORTED).toBeDefined();
  });

  it('the frozen contract\'s exact counts (16 states / 8 reasons / 11 reject codes)', () => {
    expect(ALL_ROBOT_STATES).toHaveLength(16);
    expect(ALL_PAUSED_REASONS).toHaveLength(8);
    expect(ALL_REJECT_CODES).toHaveLength(11);
  });
});
