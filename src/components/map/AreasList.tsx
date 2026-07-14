// import {useMapContext} from '@/contexts/MapContext'; // TODO: Uncomment when implementing persistence
import {
  useMap,
  useMapboxDraw,
  useMapContext,
  useMapHover,
  useMapSelection,
  withDisplaySortKeys,
} from '@/contexts/MapContext';
import {AreaProps, type DockingStation} from '@/stores/schemas';
import {closestCenter, DndContext, DragEndEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type DragStartEvent} from '@dnd-kit/core';
import {restrictToFirstScrollableAncestor, restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {Card, CardContent, CardHeader, IconButton, List, ListSubheader, useTheme} from '@mui/material';
import {featureCollection} from '@turf/helpers';
import {Feature, Polygon} from 'geojson';
import {XIcon} from 'lucide-react';
import {useRef, useState} from 'react';
import DockingStationItem from './DockingStationItem';
import SortableAreaItem from './edit/SortableAreaItem';

function rangeIndices(ids: string[], a: string, b: string): [number, number] {
  const ai = ids.indexOf(a);
  const bi = ids.indexOf(b);
  return [Math.min(ai, bi), Math.max(ai, bi)];
}

export default function AreasList({
  areas,
  dockingStations = [],
  onClose,
}: {
  areas: Feature<Polygon, AreaProps>[];
  dockingStations?: DockingStation[];
  onClose?: () => void;
}) {
  const theme = useTheme();
  const selectedIds = useMapSelection();
  const [hoveredId, setHoveredId] = useMapHover();
  const {editMode, setFeatures} = useMapContext();
  const draw = useMapboxDraw();
  const map = useMap();
  const anchorId = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {activationConstraint: {distance: 5}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 250, tolerance: 8}}),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const selectFeatures = (featureIds: string[]) => {
    if (!draw || !map) return;
    draw.changeMode('simple_select', {featureIds});
    // draw.changeMode with featureIds suppresses draw.selectionchange by default,
    // so fire it manually to keep useMapSelection() in sync.
    map.fire('draw.selectionchange', {features: featureIds.map((fid) => draw.get(fid)).filter(Boolean)});
  };

  const handleSelect = (id: string, event: React.MouseEvent) => {
    if (!draw || !editMode) return;
    const current = draw.getSelectedIds();
    const ids = areas.map((a) => a.id as string);
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    if (ctrl && shift) {
      const anchor = anchorId.current ?? ids[0];
      const [lo, hi] = rangeIndices(ids, anchor, id);
      selectFeatures(Array.from(new Set([...current, ...ids.slice(lo, hi + 1)])));
    } else if (shift) {
      const anchor = anchorId.current ?? ids[0];
      const [lo, hi] = rangeIndices(ids, anchor, id);
      selectFeatures(ids.slice(lo, hi + 1));
    } else if (ctrl) {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      selectFeatures(next);
      anchorId.current = id;
    } else {
      selectFeatures([id]);
      anchorId.current = id;
    }
  };

  // Docking stations aren't reorderable and range-selecting across areas + docks is
  // meaningless, so they get a simpler click-to-select (ctrl/cmd toggles), reusing the same
  // simple_select path areas use so the Settings/Delete controls light up identically.
  const handleSelectDock = (id: string, event: React.MouseEvent) => {
    if (!draw || !editMode) return;
    const current = draw.getSelectedIds();
    if (event.ctrlKey || event.metaKey) {
      selectFeatures(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    } else {
      selectFeatures([id]);
    }
    anchorId.current = id;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const {active, over} = event;
    if (over?.id === undefined || active.id === over.id) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;
    const draggedIsSelected = selectedIds.includes(activeItemId);

    setFeatures((draft) => {
      const oldIndex = draft.features.findIndex((f) => f.id === activeItemId);
      const newIndex = draft.features.findIndex((f) => f.id === overId);

      if (draggedIsSelected && selectedIds.length > 1) {
        const selected = new Set(selectedIds);
        const group = draft.features.filter((f) => selected.has(f.id as string));
        const rest = draft.features.filter((f) => !selected.has(f.id as string));
        const overIdxInRest = rest.findIndex((f) => f.id === overId);
        if (overIdxInRest !== -1) {
          const insertAt = overIdxInRest + (newIndex > oldIndex ? 1 : 0);
          rest.splice(insertAt, 0, ...group);
          draft.features = rest;
        }
      } else {
        draft.features = arrayMove(draft.features, oldIndex, newIndex);
      }
      draw?.set(withDisplaySortKeys(featureCollection(draft.features)));
    });
  };

  const isMultiDrag = activeId !== null && selectedIds.includes(activeId) && selectedIds.length > 1;

  const getDragCount = (areaId: string) => {
    if (!isMultiDrag) return undefined;
    if (areaId === activeId) return selectedIds.length;
    if (selectedIds.includes(areaId)) return 0;
    return undefined;
  };

  return (
    <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', border: 0}}>
      <CardHeader
        title="Areas"
        action={
          onClose && (
            <IconButton size="small" onClick={onClose} sx={{color: theme.palette.primary.contrastText, mr: -1}}>
              <XIcon size={18} />
            </IconButton>
          )
        }
        sx={{
          py: 1,
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          userSelect: 'none',
          '& .MuiCardHeader-action': {alignSelf: 'center', m: 0},
        }}
      />
      <CardContent sx={{flex: 1, p: 0, overflowY: 'auto', '&:last-child': {pb: 0}}}>
        <List sx={{minHeight: '100%', p: 0, userSelect: 'none'}}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          >
            <SortableContext items={areas.map((area) => area.id as string)} strategy={verticalListSortingStrategy}>
              {areas.map((area, index) => (
                <SortableAreaItem
                  key={(area.id as string | undefined) ?? `area-${index}`}
                  area={area}
                  selected={editMode && selectedIds.includes(area.id as string)}
                  hovered={hoveredId === (area.id as string)}
                  showDragHandle={editMode}
                  onSelect={editMode ? handleSelect : undefined}
                  dragCount={getDragCount(area.id as string)}
                  onMouseEnter={() => setHoveredId(area.id as string)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            </SortableContext>
            <DragOverlay style={{cursor: 'grabbing'}} />
          </DndContext>
          {dockingStations.length > 0 && (
            <>
              <ListSubheader
                sx={{
                  lineHeight: '2.2em',
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: '1px solid',
                  borderTop: '1px solid',
                  borderColor: theme.palette.divider,
                }}
              >
                Docking stations
              </ListSubheader>
              {dockingStations.map((station) => (
                <DockingStationItem
                  key={station.id}
                  station={station}
                  selected={editMode && selectedIds.includes(station.id)}
                  hovered={hoveredId === station.id}
                  onSelect={editMode ? handleSelectDock : undefined}
                  onMouseEnter={() => setHoveredId(station.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            </>
          )}
        </List>
      </CardContent>
    </Card>
  );
}
