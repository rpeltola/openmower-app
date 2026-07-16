'use client';

// Vertex-editing state for the v2 map — zones (an editable copy of the mock/live data), the
// current edit mode/tool/selection, and a snapshot-based undo/redo history. Presentational and
// local: no MQTT here, just the state MapCanvas renders and Map.tsx's tool dock drives. Later
// batches (brush/snap/multi-select/transforms) extend `EditTool` and add actions alongside these.
import {useCallback, useState} from 'react';
import type {Zone} from '@/components/v2/map/mockMap';

export type EditTool = 'select' | 'add' | 'delete';

export interface SelectedVertex {
  zoneId: string;
  index: number;
}

export interface MapEditor {
  zones: Zone[];
  editing: boolean;
  selectedZoneId: string | null;
  selectedVertex: SelectedVertex | null;
  tool: EditTool;
  canUndo: boolean;
  canRedo: boolean;
  setEditing: (editing: boolean) => void;
  selectZone: (id: string | null) => void;
  selectVertex: (vertex: SelectedVertex | null) => void;
  setTool: (tool: EditTool) => void;
  /** Replace the whole zones array and push it onto the undo stack — the single commit point
   *  every edit (drag-end, insert, delete) funnels through, so history stays one entry per action. */
  commitZones: (next: Zone[]) => void;
  deleteSelectedVertex: () => void;
  undo: () => void;
  redo: () => void;
}

export function useMapEditor(initialZones: Zone[]): MapEditor {
  const [history, setHistory] = useState<Zone[][]>([initialZones]);
  const [pointer, setPointer] = useState(0);
  const [editing, setEditingState] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(initialZones[0]?.id ?? null);
  const [selectedVertex, setSelectedVertex] = useState<SelectedVertex | null>(null);
  const [tool, setTool] = useState<EditTool>('select');

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
      setTool('select');
    }
  }, []);

  const selectZone = useCallback((id: string | null) => {
    setSelectedZoneId(id);
    setSelectedVertex(null);
  }, []);

  const selectVertex = useCallback((vertex: SelectedVertex | null) => {
    setSelectedVertex(vertex);
  }, []);

  const deleteSelectedVertex = useCallback(() => {
    if (!selectedVertex) return;
    const zone = zones.find((z) => z.id === selectedVertex.zoneId);
    if (!zone || zone.outline.length <= 3) return; // keep a valid polygon (>= 3 points)
    const outline = zone.outline.filter((_, i) => i !== selectedVertex.index);
    commitZones(zones.map((z) => (z.id === selectedVertex.zoneId ? {...z, outline} : z)));
    setSelectedVertex(null);
  }, [zones, selectedVertex, commitZones]);

  const undo = useCallback(() => {
    setPointer((p) => Math.max(0, p - 1));
    setSelectedVertex(null);
  }, []);

  const redo = useCallback(() => {
    setPointer((p) => Math.min(history.length - 1, p + 1));
    setSelectedVertex(null);
  }, [history.length]);

  return {
    zones,
    editing,
    selectedZoneId,
    selectedVertex,
    tool,
    canUndo: pointer > 0,
    canRedo: pointer < history.length - 1,
    setEditing,
    selectZone,
    selectVertex,
    setTool,
    commitZones,
    deleteSelectedVertex,
    undo,
    redo,
  };
}
