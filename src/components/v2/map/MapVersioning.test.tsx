import {SaveMapSheet, VersionHistorySheet} from '@/components/v2/map/MapVersioning';
import type {Zone} from '@/components/v2/map/mockMap';
import type {MapVersionEntry} from '@/stores/schemas';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// These two Sheets are the presentational half of W9 A2b's map save/versioning wiring — Map.tsx
// owns the real RPC/query calls (rpc.map.replace, query/mapversions, query/mapversion) and passes
// the results down as plain props, so the save/restore CONTRACT (what triggers onSave/onRestore,
// what saving/loading/error state renders as) is testable without mounting the whole Leaflet map.

const ZONES: Zone[] = [
  {id: 'z1', name: 'Etupiha', type: 'mow', outline: [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]},
  {id: 'z2', name: 'Flowerbed', type: 'obstacle', outline: [{x: 0.2, y: 0.2}, {x: 0.4, y: 0.2}, {x: 0.4, y: 0.4}]},
];

describe('SaveMapSheet', () => {
  afterEach(cleanup);

  it('shows the area/no-go summary and calls onSave when the primary button is pressed', () => {
    const onSave = vi.fn();
    render(<SaveMapSheet open onClose={vi.fn()} zones={ZONES} onSave={onSave} saving={false} error={null} />);

    expect(screen.getByText(/1 area · 1 no-go zone · dock/)).toBeInTheDocument();
    screen.getByRole('button', {name: /Save as new version/}).click();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables the save button and shows "Saving…" while saving', () => {
    render(<SaveMapSheet open onClose={vi.fn()} zones={ZONES} onSave={vi.fn()} saving error={null} />);
    const button = screen.getByRole('button', {name: /Saving…/});
    expect(button).toBeDisabled();
  });

  it('surfaces a real save error instead of a fabricated success', () => {
    render(
      <SaveMapSheet
        open
        onClose={vi.fn()}
        zones={ZONES}
        onSave={vi.fn()}
        saving={false}
        error="Cannot save yet: the mower has not reported its GPS datum."
      />,
    );
    expect(screen.getByText(/has not reported its GPS datum/)).toBeInTheDocument();
  });
});

describe('VersionHistorySheet', () => {
  afterEach(cleanup);

  const VERSIONS: MapVersionEntry[] = [
    {id: 3, created_at: 300, note: 'Added Saunan area', is_current: true},
    {id: 2, created_at: 200, note: 'Moved the dock', is_current: false},
  ];

  it('shows a "Current" chip for the current version and a Restore button for the others', () => {
    render(
      <VersionHistorySheet
        open
        onClose={vi.fn()}
        versions={VERSIONS}
        loading={false}
        error={null}
        onRestore={vi.fn()}
        restoringId={null}
        restoreError={null}
      />,
    );

    expect(screen.getByText('Added Saunan area')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Restore/})).toBeInTheDocument();
  });

  it('calls onRestore with the version id when Restore is pressed', () => {
    const onRestore = vi.fn();
    render(
      <VersionHistorySheet
        open
        onClose={vi.fn()}
        versions={VERSIONS}
        loading={false}
        error={null}
        onRestore={onRestore}
        restoringId={null}
        restoreError={null}
      />,
    );

    screen.getByRole('button', {name: /Restore/}).click();
    expect(onRestore).toHaveBeenCalledWith(2);
  });

  it('shows a loading state, an empty state, and a query-error state (never a fabricated list)', () => {
    const {rerender} = render(
      <VersionHistorySheet
        open
        onClose={vi.fn()}
        versions={[]}
        loading
        error={null}
        onRestore={vi.fn()}
        restoringId={null}
        restoreError={null}
      />,
    );
    expect(screen.getByText(/Loading versions/)).toBeInTheDocument();

    rerender(
      <VersionHistorySheet
        open
        onClose={vi.fn()}
        versions={[]}
        loading={false}
        error={null}
        onRestore={vi.fn()}
        restoringId={null}
        restoreError={null}
      />,
    );
    expect(screen.getByText('No saved versions yet.')).toBeInTheDocument();

    rerender(
      <VersionHistorySheet
        open
        onClose={vi.fn()}
        versions={[]}
        loading={false}
        error="mapversions timed out"
        onRestore={vi.fn()}
        restoringId={null}
        restoreError={null}
      />,
    );
    expect(screen.getByText(/mapversions timed out/)).toBeInTheDocument();
  });
});
