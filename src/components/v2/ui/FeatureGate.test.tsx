import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {FeatureGate} from '@/components/v2/ui/FeatureGate';
import {setShowUnsupportedFeatures} from '@/lib/v2/featureSupport';

// R1 gate audit (W9): the core hide/grey-reveal contract every control in the app now relies on
// to stay honest -- an unsupported control must never render live, and the dev toggle must be
// the ONLY thing that reveals it (inert + labelled, never interactive).
describe('FeatureGate', () => {
  afterEach(() => {
    cleanup();
    setShowUnsupportedFeatures(false);
  });

  it('hides an unsupported feature entirely when the dev toggle is off (default)', () => {
    setShowUnsupportedFeatures(false);
    render(
      <FeatureGate feature="backup">
        <button>Download backup</button>
      </FeatureGate>,
    );
    expect(screen.queryByText('Download backup')).not.toBeInTheDocument();
  });

  it('reveals an unsupported feature greyed + tagged once the dev toggle is on', () => {
    setShowUnsupportedFeatures(true);
    render(
      <FeatureGate feature="backup">
        <button>Download backup</button>
      </FeatureGate>,
    );
    const button = screen.getByText('Download backup');
    expect(button).toBeInTheDocument();
    // Inert -- the greyed wrapper carries pointer-events-none, not the control itself.
    expect(button.closest('.pointer-events-none')).not.toBeNull();
    expect(screen.getByText("Not supported by your mower's software yet")).toBeInTheDocument();
    expect(screen.getByText(/Backup & restore needs a mower-side RPC/)).toBeInTheDocument();
  });

  it('renders a supported feature straight through regardless of the dev toggle', async () => {
    vi.resetModules();
    vi.doMock('@/lib/v2/featureSupport', async () => {
      const actual = await vi.importActual<typeof import('@/lib/v2/featureSupport')>('@/lib/v2/featureSupport');
      return {...actual, isFeatureSupported: () => true};
    });
    const {FeatureGate: PatchedGate} = await import('@/components/v2/ui/FeatureGate');
    setShowUnsupportedFeatures(false);

    render(
      <PatchedGate feature="backup">
        <button>Download backup</button>
      </PatchedGate>,
    );

    const button = screen.getByText('Download backup');
    expect(button).toBeInTheDocument();
    expect(button.closest('.pointer-events-none')).toBeNull();
    expect(screen.queryByText("Not supported by your mower's software yet")).not.toBeInTheDocument();

    vi.doUnmock('@/lib/v2/featureSupport');
    vi.resetModules();
  });
});
