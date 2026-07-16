'use client';

// Vertex-editing + zone/dock CRUD state for the v2 map — an editable copy of the mock/live data,
// the current edit mode/tool/selection, and a snapshot-based undo/redo history covering BOTH
// zones and the dock (so a misplaced dock is as undoable as a dragged vertex). Presentational and
// local: no MQTT here, just the state MapCanvas renders and Map.tsx's tool dock drives. The
// area-settings batch extends this further (updateZoneSettings/resetZoneSettings).
import {useCallback, useEffect, useState} from 'react';
import {
  centroid,
  offsetPolygon,
  rotatePoints,
  scalePoints,
  simplify,
  snapEvenly,
  translatePoints,
} from '@/components/v2/map/geometry';
import type {Dock, Zone, ZoneType} from '@/components/v2/map/mockMap';

export type EditTool = 'select' | 'add' | 'delete' | 'snap' | 'brush' | 'multi' | 'rect' | 'circle' | 'move';

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

const ROTATE_STEP_DEG = 15;
const SCALE_STEP = 0.05; // ±5%

interface MapState {
  zones: Zone[];
  dock: Dock;
}

function makeZoneId(): string {
  return `zone-${Math.random().toString(36).slice(2, 9)}`;
}

export interface MapEditor {
  zones: Zone[];
  dock: Dock;
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
   *  every vertex edit (drag-end, insert, delete, transform) funnels through, so history stays
   *  one entry per action. */
  commitZones: (next: Zone[]) => void;
  /** Move the dock (drag-end or click-to-place) — its own undo entry. */
  commitDock: (next: Dock) => void;
  /** Delete whatever's selected: the multi-select set in the 'multi' tool, else the single
   *  selected vertex. Always keeps a zone's outline at >= 3 points. */
  deleteSelection: () => void;
  /** Snap-line tool (S): the first call picks the start vertex; a second call with a different
   *  index on the same zone applies the snap (one undo entry) and clears the pick; a second call
   *  on the SAME vertex cancels the pick. */
  pickSnapVertex: (vertex: SelectedVertex) => void;
  toggleMultiVertex: (index: number) => void;
  setMultiSelected: (indices: number[]) => void;
  /** Create a new zone (type 'mow') from a ready-made outline — rect/circle draw tools call this
   *  with their finished shape; the new zone becomes selected. */
  createZone: (outline: Zone['outline']) => void;
  /** Add zone (a square centered on `center`, side `sizeM` meters, type 'mow'). */
  addZone: (center: Zone['outline'][number], sizeM?: number) => void;
  duplicateZone: (id: string) => void;
  deleteZone: (id: string) => void;
  renameZone: (id: string, name: string) => void;
  setZoneType: (id: string, type: ZoneType) => void;
  /** Move a zone earlier/later in the array — firmware selects areas by order. */
  reorderZone: (id: string, direction: 'up' | 'down') => void;
  /** Rotate the selected zone ±ROTATE_STEP_DEG about its centroid. */
  rotateSelectedZone: (direction: 1 | -1) => void;
  /** Scale the selected zone ±SCALE_STEP about its centroid. */
  scaleSelectedZone: (direction: 1 | -1) => void;
  /** Uniform buffer offset of the selected zone's outline (+grow / -shrink), meters. */
  bufferSelectedZone: (distanceM: number) => void;
  /** Douglas-Peucker simplify of the selected zone's outline at the given tolerance (m). */
  simplifySelectedZone: (toleranceM: number) => void;
  undo: () => void;
  redo: () => void;
}

export function useMapEditor(initialZones: Zone[], initialDock: Dock): MapEditor {
  const [history, setHistory] = useState<MapState[]>([{zones: initialZones, dock: initialDock}]);
  const [pointer, setPointer] = useState(0);
  const [editing, setEditingState] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(initialZones[0]?.id ?? null);
  const [selectedVertex, setSelectedVertex] = useState<SelectedVertex | null>(null);
  const [tool, setToolState] = useState<EditTool>('select');
  const [snapPick, setSnapPick] = useState<SelectedVertex | null>(null);
  const [multiSelected, setMultiSelectedState] = useState<Set<number>>(new Set());

  const {zones, dock} = history[pointer];

  const commitState = useCallback(
    (next: MapState) => {
      setHistory((h) => [...h.slice(0, pointer + 1), next]);
      setPointer((p) => p + 1);
    },
    [pointer],
  );

  const commitZones = useCallback((next: Zone[]) => commitState({zones: next, dock}), [commitState, dock]);
  const commitDock = useCallback((next: Dock) => commitState({zones, dock: next}), [commitState, zones]);

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

  const createZone = useCallback(
    (outline: Zone['outline']) => {
      const id = makeZoneId();
      const newZone: Zone = {id, name: `New area ${zones.length + 1}`, type: 'mow', outline};
      commitZones([...zones, newZone]);
      setSelectedZoneId(id);
    },
    [zones, commitZones],
  );

  const addZone = useCallback(
    (center: Zone['outline'][number], sizeM = 6) => {
      const half = sizeM / 2;
      createZone([
        {x: center.x - half, y: center.y - half},
        {x: center.x + half, y: center.y - half},
        {x: center.x + half, y: center.y + half},
        {x: center.x - half, y: center.y + half},
      ]);
    },
    [createZone],
  );

  const duplicateZone = useCallback(
    (id: string) => {
      const zone = zones.find((z) => z.id === id);
      if (!zone) return;
      const offset = 1.5; // meters, so the copy doesn't sit exactly on top of the original
      const newId = makeZoneId();
      const copy: Zone = {
        ...zone,
        id: newId,
        name: `${zone.name} copy`,
        outline: translatePoints(zone.outline, offset, -offset),
      };
      const index = zones.findIndex((z) => z.id === id);
      commitZones([...zones.slice(0, index + 1), copy, ...zones.slice(index + 1)]);
      setSelectedZoneId(newId);
    },
    [zones, commitZones],
  );

  const deleteZone = useCallback(
    (id: string) => {
      commitZones(zones.filter((z) => z.id !== id));
      setSelectedZoneId((current) => (current === id ? null : current));
    },
    [zones, commitZones],
  );

  const renameZone = useCallback(
    (id: string, name: string) => {
      commitZones(zones.map((z) => (z.id === id ? {...z, name} : z)));
    },
    [zones, commitZones],
  );

  const setZoneType = useCallback(
    (id: string, type: ZoneType) => {
      commitZones(zones.map((z) => (z.id === id ? {...z, type} : z)));
    },
    [zones, commitZones],
  );

  const reorderZone = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const index = zones.findIndex((z) => z.id === id);
      if (index < 0) return;
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= zones.length) return;
      const next = [...zones];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      commitZones(next);
    },
    [zones, commitZones],
  );

  const rotateSelectedZone = useCallback(
    (direction: 1 | -1) => {
      if (!selectedZoneId) return;
      const zone = zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      const center = centroid(zone.outline);
      if (!center) return;
      const outline = rotatePoints(zone.outline, center, direction * ROTATE_STEP_DEG * (Math.PI / 180));
      commitZones(zones.map((z) => (z.id === selectedZoneId ? {...z, outline} : z)));
    },
    [selectedZoneId, zones, commitZones],
  );

  const scaleSelectedZone = useCallback(
    (direction: 1 | -1) => {
      if (!selectedZoneId) return;
      const zone = zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      const center = centroid(zone.outline);
      if (!center) return;
      const outline = scalePoints(zone.outline, center, 1 + direction * SCALE_STEP);
      commitZones(zones.map((z) => (z.id === selectedZoneId ? {...z, outline} : z)));
    },
    [selectedZoneId, zones, commitZones],
  );

  const bufferSelectedZone = useCallback(
    (distanceM: number) => {
      if (!selectedZoneId || distanceM === 0) return;
      const zone = zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      const outline = offsetPolygon(zone.outline, distanceM);
      commitZones(zones.map((z) => (z.id === selectedZoneId ? {...z, outline} : z)));
    },
    [selectedZoneId, zones, commitZones],
  );

  const simplifySelectedZone = useCallback(
    (toleranceM: number) => {
      if (!selectedZoneId || toleranceM <= 0) return;
      const zone = zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      const outline = simplify(zone.outline, toleranceM);
      commitZones(zones.map((z) => (z.id === selectedZoneId ? {...z, outline} : z)));
    },
    [selectedZoneId, zones, commitZones],
  );

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
    dock,
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
    commitDock,
    deleteSelection,
    pickSnapVertex,
    toggleMultiVertex,
    setMultiSelected,
    createZone,
    addZone,
    duplicateZone,
    deleteZone,
    renameZone,
    setZoneType,
    reorderZone,
    rotateSelectedZone,
    scaleSelectedZone,
    bufferSelectedZone,
    simplifySelectedZone,
    undo,
    redo,
  };
}
