import {useMapboxDraw, useMapContext, useMapSelection, withDisplaySortKeys} from '@/contexts/MapContext';
import type {AreaFeature} from '@/types/geojson';
import {removeMiniCoords} from '@/utils/area-utils';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import {Alert, useTheme} from '@mui/material';
import {difference} from '@turf/difference';
import {featureCollection} from '@turf/helpers';
import {union} from '@turf/union';
import type {Geometry} from 'geojson';
import {
  CircleXIcon,
  PencilLineIcon,
  Redo2Icon,
  SaveIcon,
  ScissorsLineDashedIcon,
  Settings2Icon,
  SquaresSubtractIcon,
  SquaresUniteIcon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react';
import {useCallback, useState} from 'react';
import {useDialog} from 'react-dialog-async';
import ControlButton from '../ControlButton';
import {AreaSettingsDialog} from './AreaSettingsDialog';
import {CancelConfirmDialog} from './CancelConfirmDialog';
import {DockingStationSettingsDialog} from './DockingStationSettingsDialog';
import MergeDialog from './MergeDialog';
import SubtractDialog from './SubtractDialog';

export default function EditControls({
  areas,
  saveMapToMower,
}: {
  areas: AreaFeature[];
  saveMapToMower: () => Promise<void>;
}) {
  const {
    setEditMode,
    trashEnabled,
    setFeatures,
    drawMode,
    setDrawWorkflow,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useMapContext();
  const draw = useMapboxDraw();
  const selectedIds = useMapSelection();
  const selectedAreas = areas.filter((area) => selectedIds.includes(area.id as string));
  const isDrawing = drawMode === MapboxDraw.constants.modes.DRAW_POLYGON;
  // The Settings button opens the dialog matching the SINGLE selected feature's type --
  // a docking station is a LineString (see area-converter.ts's dockingStationToFeature),
  // not a Polygon, so it needs its own dialog rather than AreaSettingsDialog.
  const selectedFeature = selectedIds.length === 1 ? draw?.get(selectedIds[0]) : undefined;
  const isDockSelected =
    selectedFeature?.geometry.type === 'LineString' && selectedFeature.properties?.type === 'docking_station';
  const areaSettingsDialog = useDialog(AreaSettingsDialog);
  const dockingStationSettingsDialog = useDialog(DockingStationSettingsDialog);
  const mergeDialog = useDialog(MergeDialog);
  const subtractDialog = useDialog(SubtractDialog);
  const cancelConfirmDialog = useDialog(CancelConfirmDialog);

  const theme = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveMapToMower();
      setEditMode(false);
    } catch (error) {
      console.error('Error saving map to mower:', error);
      // Keep the user in edit mode so their unsaved work isn't lost, and show why.
      setSaveError(error instanceof Error ? error.message : 'Failed to save the map to the mower.');
    } finally {
      setIsSaving(false);
    }
  }, [saveMapToMower, setEditMode]);

  const handleCancel = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await cancelConfirmDialog.open();
      if (!confirmed) return;
    }
    setEditMode(false);
  }, [hasUnsavedChanges, cancelConfirmDialog, setEditMode]);

  const updateAreaGeometry = useCallback(
    (targetId: string, geometry: Geometry | undefined, removeOtherAreas: boolean = false) => {
      if (geometry?.type !== 'Polygon') {
        console.error('New area would not be contiguous');
        return;
      }
      setFeatures((draft) => {
        draft.features.find((f) => f.id === targetId)!.geometry = geometry;
        if (removeOtherAreas) {
          draft.features = draft.features.filter((f) => !selectedIds.includes(f.id as string) || f.id === targetId);
        }
        draw?.set(withDisplaySortKeys(featureCollection(draft.features)));
      });
    },
    [setFeatures, selectedIds, draw],
  );

  const handleMerge = useCallback(async () => {
    const targetId = await mergeDialog.open({selectedAreas});
    if (targetId === undefined) return;
    const result = removeMiniCoords(union(featureCollection(selectedAreas)));
    updateAreaGeometry(targetId, result?.geometry, true);
  }, [mergeDialog, selectedAreas, updateAreaGeometry]);

  const handleSubtract = useCallback(async () => {
    const [targetId, keepAllAreas] = (await subtractDialog.open({selectedAreas})) ?? [undefined, false];
    if (targetId === undefined) return;
    const targetArea = selectedAreas.find((area) => area.id === targetId)!;
    const otherAreas = selectedAreas.filter((area) => area.id !== targetId);
    const result = removeMiniCoords(difference(featureCollection([targetArea, ...otherAreas])));
    updateAreaGeometry(targetId, result?.geometry, !keepAllAreas);
  }, [subtractDialog, selectedAreas, updateAreaGeometry]);

  const handleSplit = useCallback(async () => {
    setDrawWorkflow({type: 'split_polygon', areaId: selectedIds[0]});
    draw?.changeMode(MapboxDraw.constants.modes.DRAW_LINE_STRING);
  }, [setDrawWorkflow, selectedIds, draw]);

  if (isSaving) {
    return (
      <ControlButton
        position="top-left"
        icon={() => <SaveIcon style={{animation: 'pulse 1.5s ease-in-out infinite'}} />}
        title="Saving…"
        disabled
      />
    );
  }

  return (
    <>
      {saveError && (
        <Alert
          severity="error"
          onClose={() => setSaveError(null)}
          sx={{position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 10, maxWidth: 360}}
        >
          {saveError}
        </Alert>
      )}
      <ControlButton
        position="top-left"
        icon={SaveIcon}
        title="Save"
        style={{color: hasUnsavedChanges ? theme.palette.success.main : undefined}}
        disabled={!hasUnsavedChanges}
        onClick={handleSave}
      />
      <ControlButton
        position="top-left"
        icon={CircleXIcon}
        title="Cancel"
        style={{color: theme.palette.error.main}}
        onClick={handleCancel}
      />
      <ControlButton
        position="top-left"
        icon={Undo2Icon}
        title="Undo"
        disabled={!canUndo}
        onClick={() => {
          const snapshot = undo();
          if (snapshot) draw?.set(withDisplaySortKeys(featureCollection(snapshot.features)));
        }}
      />
      <ControlButton
        position="top-left"
        icon={Redo2Icon}
        title="Redo"
        disabled={!canRedo}
        onClick={() => {
          const snapshot = redo();
          if (snapshot) draw?.set(withDisplaySortKeys(featureCollection(snapshot.features)));
        }}
      />
      <ControlButton
        position="top-left"
        icon={Settings2Icon}
        title="Settings"
        //active={areaSettingsDialog.isOpen}
        disabled={selectedIds.length != 1}
        onClick={() => (isDockSelected ? dockingStationSettingsDialog.open() : areaSettingsDialog.open())}
        spaced={true}
      />
      <ControlButton
        position="top-left"
        icon={Trash2Icon}
        title="Delete"
        disabled={!trashEnabled || isDrawing}
        onClick={() => {
          draw?.trash();
        }}
      />
      <ControlButton
        position="top-left"
        icon={PencilLineIcon}
        title="Draw new area"
        active={isDrawing}
        onClick={() => {
          if (isDrawing) {
            draw?.trash();
          } else {
            draw?.changeMode(MapboxDraw.constants.modes.DRAW_POLYGON);
          }
        }}
      />
      <ControlButton
        spaced={true}
        position="top-left"
        icon={SquaresUniteIcon}
        title="Merge"
        disabled={selectedIds.length < 2}
        onClick={handleMerge}
      />
      <ControlButton
        position="top-left"
        icon={SquaresSubtractIcon}
        title="Subtract"
        disabled={selectedIds.length < 2}
        onClick={handleSubtract}
      />
      <ControlButton
        position="top-left"
        icon={ScissorsLineDashedIcon}
        title="Split area"
        disabled={selectedIds.length !== 1}
        onClick={handleSplit}
      />
    </>
  );
}
