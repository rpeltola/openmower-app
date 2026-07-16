'use client';

// Vertex-editing state for the v2 map — zones (an editable copy of the mock/live data), the
// current edit mode/tool/selection, and a snapshot-based undo/redo history. Presentational and
// local: no MQTT here, just the state MapCanvas renders and Map.tsx's tool dock drives. Later
// batches (transforms, settings) extend this alongside these tools.
import {useCallback, useEffect, useState} from 'react';
import {snapEvenly} from '@/components/v2/map/geometry';
import type {Zone} from '@/components/v2/map/mockMap';

export type EditTool = 'select' | 'add' | 'delete' | 'snap' | 'brush' | 'multi';

export interface SelectedVertex {
  zoneId: string;
  index: number;
}

// Arrow-key vertex nudge (select tool): a small metric step; Shift = 10x. See the keydown effect
// below — one undo entry per keydown (bursts of held-arrow repeats aren't coalesced into one
// entry; simplest to reason about, and a little undo-stack spam from a nudge burst is an
// acceptable tradeoff here).
const NUDGE_STEP_M = 0.05;
const NUDGE_STEP_SHIFT_M = NUDGE_STEP_M * 10;

export interface MapEditor {
  zones: Zone[];
  editing: boolean;
  selectedZoneId: string | null;
  selectedVertex: SelectedVertex | null;
  tool: EditTool;
  /** Vertex picked as the snap-line start (tool 'snap') — the second pick applies immediately. */
  snapPick: SelectedVertex | null;
  /** Vertex indices (within the selected zone) picked by the multi-select tool. */
  multiSelected: Set<number>;
  canUndo: boolean;
  canRedo: boolean;
  setEditing: (editing: boolean) => void;
  selectZone: (id: string | null) => void;
  selectVertex: (vertex: SelectedVertex | null) => void;
  setTool: (tool: EditTool) => void;
  /** Replace the whole zones array and push it onto the undo stack — the single commit point
   *  every edit (drag-end, insert, delete, transform) funnels through, so history stays one entry
   *  per action. */
  commitZones: (next: Zone[]) => void;
  /** Delete whatever's selected: the multi-select set in the 'multi' tool, else the single
   *  selected vertex. Always keeps a zone's outline at >= 3 points. */
  deleteSelection: () => void;
  /** Snap-line tool (S): the first call picks the start vertex; a second call with a different
   *  index on the same zone applies the snap (one undo entry) and clears the pick; a second call
   *  on the SAME vertex cancels the pick. */
  pickSnapVertex: (vertex: SelectedVertex) => void;
  toggleMultiVertex: (index: number) => void;
  setMultiSelected: (indices: number[]) => void;
  undo: () => void;
  redo: () => void;
}

export function useMapEditor(initialZones: Zone[]): MapEditor {
  const [history, setHistory] = useState<Zone[][]>([initialZones]);
  const [pointer, setPointer] = useState(0);
  const [editing, setEditingState] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(initialZones[0]?.id ?? null);
  const [selectedVertex, setSelectedVertex] = useState<SelectedVertex | null>(null);
  const [tool, setToolState] = useState<EditTool>('select');
  const [snapPick, setSnapPick] = useState<SelectedVertex | null>(null);
  const [multiSelected, setMultiSelectedState] = useState<Set<number>>(new Set());

  const zones = history[pointer];

  const commitZones = useCallback(
    (next: Zone[]) => {
      setHistory((h) => [...h.slice(0, pointer + 1), next]);
      setPointer((p) => p + 1);
    },
    [pointer],
  );

  const setEditing = useCallback((next: boolean) => {
    setEditingState(next);
    if (!next) {
      setSelectedVertex(null);
      setToolState('select');
      setSnapPick(null);
      setMultiSelectedState(new Set());
    }
  }, []);

  const selectZone = useCallback((id: string | null) => {
    setSelectedZoneId(id);
    setSelectedVertex(null);
    setSnapPick(null);
    setMultiSelectedState(new Set());
  }, []);

  const selectVertex = useCallback((vertex: SelectedVertex | null) => {
    setSelectedVertex(vertex);
  }, []);

  const setTool = useCallback((next: EditTool) => {
    setToolState(next);
    // Switching tools drops the previous tool's in-progress pick/selection so e.g. a half-made
    // snap pick or a multi-select set doesn't linger and confuse the next tool.
    setSnapPick(null);
    setMultiSelectedState(new Set());
  }, []);

  const deleteSelection = useCallback(() => {
    if (tool === 'multi' && multiSelected.size > 0 && selectedZoneId) {
      const zone = zones.find((z) => z.id === selectedZoneId);
      if (!zone || zone.outline.length - multiSelected.size < 3) return; // keep >= 3 points
      const outline = zone.outline.filter((_, i) => !multiSelected.has(i));
      commitZones(zones.map((z) => (z.id === selectedZoneId ? {...z, outline} : z)));
      setMultiSelectedState(new Set());
      return;
    }
    if (!selectedVertex) return;
    const zone = zones.find((z) => z.id === selectedVertex.zoneId);
    if (!zone || zone.outline.length <= 3) return; // keep a valid polygon (>= 3 points)
    const outline = zone.outline.filter((_, i) => i !== selectedVertex.index);
    commitZones(zones.map((z) => (z.id === selectedVertex.zoneId ? {...z, outline} : z)));
    setSelectedVertex(null);
  }, [tool, multiSelected, selectedZoneId, selectedVertex, zones, commitZones]);

  const pickSnapVertex = useCallback(
    (vertex: SelectedVertex) => {
      if (!snapPick || snapPick.zoneId !== vertex.zoneId) {
        setSnapPick(vertex);
        return;
      }
      if (snapPick.index === vertex.index) {
        setSnapPick(null); // picking the same vertex again cancels
        return;
      }
      const zone = zones.find((z) => z.id === vertex.zoneId);
      if (!zone) {
        setSnapPick(null);
        return;
      }
      const {points, changed} = snapEvenly(zone.outline, snapPick.index, vertex.index);
      if (changed > 0) {
        commitZones(zones.map((z) => (z.id === vertex.zoneId ? {...z, outline: points} : z)));
      }
      setSnapPick(null);
    },
    [snapPick, zones, commitZones],
  );

  const toggleMultiVertex = useCallback((index: number) => {
    setMultiSelectedState((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const setMultiSelected = useCallback((indices: number[]) => {
    setMultiSelectedState(new Set(indices));
  }, []);

  const undo = useCallback(() => {
    setPointer((p) => Math.max(0, p - 1));
    setSelectedVertex(null);
  }, []);

  const redo = useCallback(() => {
    setPointer((p) => Math.min(history.length - 1, p + 1));
    setSelectedVertex(null);
  }, [history.length]);

  // Keyboard: arrow-key vertex nudge (select tool, a vertex selected) + Delete/Backspace to
  // remove the current selection (single vertex, or the whole multi-select set). Ignored while
  // focus is in a form control so typing a zone name etc. doesn't fight with map shortcuts.
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSelection = tool === 'multi' ? multiSelected.size > 0 : !!selectedVertex;
        if (!hasSelection) return;
        e.preventDefault();
        deleteSelection();
        return;
      }

      if (tool !== 'select' || !selectedVertex) return;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'ArrowRight') dx = 1;
      else if (e.key === 'ArrowUp') dy = 1; // screen/world up = north = +y
      else if (e.key === 'ArrowDown') dy = -1;
      else return;
      e.preventDefault();
      const step = e.shiftKey ? NUDGE_STEP_SHIFT_M : NUDGE_STEP_M;
      const zone = zones.find((z) => z.id === selectedVertex.zoneId);
      if (!zone) return;
      const outline = zone.outline.map((p, i) =>
        i === selectedVertex.index ? {x: p.x + dx * step, y: p.y + dy * step} : p,
      );
      commitZones(zones.map((z) => (z.id === selectedVertex.zoneId ? {...z, outline} : z)));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, tool, selectedVertex, multiSelected, zones, commitZones, deleteSelection]);

  return {
    zones,
    editing,
    selectedZoneId,
    selectedVertex,
    tool,
    snapPick,
    multiSelected,
    canUndo: pointer > 0,
    canRedo: pointer < history.length - 1,
    setEditing,
    selectZone,
    selectVertex,
    setTool,
    commitZones,
    deleteSelection,
    pickSnapVertex,
    toggleMultiVertex,
    setMultiSelected,
    undo,
    redo,
  };
}
