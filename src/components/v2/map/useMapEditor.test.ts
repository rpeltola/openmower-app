import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {useMapEditor} from '@/components/v2/map/useMapEditor';
import type {Dock, Zone} from '@/components/v2/map/mockMap';

const ZONES: Zone[] = [
  {id: 'z1', name: 'Front lawn', type: 'mow', outline: [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]},
];
const DOCK: Dock = {position: {x: 0, y: 0}};

describe('useMapEditor discardChanges', () => {
  it('reverts every unsaved edit back to the baseline (history[0]) in one step, clearing undo AND redo', () => {
    const {result} = renderHook(() => useMapEditor(ZONES, DOCK));

    act(() => {
      result.current.addZone({x: 5, y: 5});
    });
    expect(result.current.zones).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);

    // Undo once, so there's also a redo entry sitting past the pointer -- discardChanges must
    // drop that too, not just wind back to where the pointer happened to be.
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.discardChanges();
    });

    expect(result.current.zones).toEqual(ZONES);
    expect(result.current.dock).toEqual(DOCK);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.selectedZoneId).toBe(ZONES[0].id);
    expect(result.current.selectedVertex).toBeNull();
  });
});
