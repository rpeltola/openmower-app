'use client';

// Map screen — the map is the hero (full-bleed), UI floats over it in pills / FABs / a stat card
// (design-language.md "The map is the hero"). Real Leaflet canvas underneath; concept chrome on top.
// Map-editor port: edit mode, zone selection, vertex tools, zone create/transform, undo/redo
// (batches 1-3 of MAP_EDITOR_SPEC.md), plus the real per-area settings editor (AREA_SETTINGS_SPEC.md,
// AreaSettingsSheet.tsx). The "Choose zone" Sheet below is just the quick zone switcher now —
// selecting a zone (there, or by tapping it on the map) opens the settings editor.
import {latLngToMeters} from '@/lib/v2/geo/projection';
import {AreaSettingsSheet} from '@/components/v2/map/AreaSettingsSheet';
import {BASEMAPS, DEFAULT_BASEMAP_ID} from '@/components/v2/map/basemaps';
import {MOCK_DOCK, MOCK_ORIGIN, MOCK_ZONES, type ZoneType} from '@/components/v2/map/mockMap';
import {useMapEditor, type EditTool} from '@/components/v2/map/useMapEditor';
import {Button} from '@/components/v2/ui/Button';
import {Fab} from '@/components/v2/ui/Fab';
import {FormField} from '@/components/v2/ui/FormField';
import {ListRow} from '@/components/v2/ui/ListRow';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Slider} from '@/components/v2/ui/Slider';
import {StatCard} from '@/components/v2/ui/StatCard';
import type {Map as LeafletMap} from 'leaflet';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Circle as CircleIcon,
  CirclePlus,
  Copy,
  Eraser,
  Expand,
  Layers,
  Locate,
  MapPin,
  MapPinned,
  MousePointer2,
  Minus,
  Move,
  Paintbrush2,
  Pencil,
  Plus,
  RectangleHorizontal,
  Redo2,
  RotateCcw,
  RotateCw,
  Shrink,
  Sliders,
  Spline,
  Square,
  SquareDashedMousePointer,
  SquarePlus,
  Trash2,
  Undo2,
  Waypoints,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {useEffect, useRef, useState, type ReactNode} from 'react';

const MapCanvas = dynamic(() => import('@/components/v2/map/MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24};

const BASEMAP_STORAGE_KEY = 'v2.basemap';

const TOOLS: {value: EditTool; label: string; icon: ReactNode}[] = [
  {value: 'select', label: 'Select / drag', icon: <MousePointer2 size={16} />},
  {value: 'add', label: 'Add point', icon: <CirclePlus size={16} />},
  {value: 'delete', label: 'Delete point', icon: <Eraser size={16} />},
  {value: 'snap', label: 'Snap line', icon: <Waypoints size={16} />},
  {value: 'brush', label: 'Push brush', icon: <Paintbrush2 size={16} />},
  {value: 'multi', label: 'Multi-select', icon: <SquareDashedMousePointer size={16} />},
  {value: 'move', label: 'Move zone', icon: <Move size={16} />},
  {value: 'rect', label: 'Draw rectangle', icon: <RectangleHorizontal size={16} />},
  {value: 'circle', label: 'Draw circle', icon: <CircleIcon size={16} />},
];

export function Map() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const [basemapSheetOpen, setBasemapSheetOpen] = useState(false);
  const [zoneSheetOpen, setZoneSheetOpen] = useState(false);
  const [areaSettingsOpen, setAreaSettingsOpen] = useState(false);
  const [transformSheetOpen, setTransformSheetOpen] = useState(false);
  const [brushRadius, setBrushRadius] = useState(1.2);
  const [brushStrength, setBrushStrength] = useState(0.6);
  const [placingDock, setPlacingDock] = useState(false);
  const [bufferDistance, setBufferDistance] = useState(0.3);
  const [simplifyTolerance, setSimplifyTolerance] = useState(0.1);
  const editor = useMapEditor(MOCK_ZONES, MOCK_DOCK);

  useEffect(() => {
    const stored = localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (stored && BASEMAPS.some((b) => b.id === stored)) setBasemapId(stored);
  }, []);

  const selectBasemap = (id: string) => {
    setBasemapId(id);
    localStorage.setItem(BASEMAP_STORAGE_KEY, id);
    setBasemapSheetOpen(false);
  };

  const selectedZone = editor.zones.find((z) => z.id === editor.selectedZoneId);
  const selectedZoneIndex = editor.zones.findIndex((z) => z.id === editor.selectedZoneId);

  const addZoneAtCenter = () => {
    const center = mapRef.current ? latLngToMeters(mapRef.current.getCenter(), MOCK_ORIGIN) : {x: 0, y: 0};
    editor.addZone(center);
  };

  // Selecting a zone (zone-list picker, or tapping it on the map) opens the settings editor for
  // it — the zone-list Sheet itself stays around as a quick way to switch which zone that is.
  const openZoneSettings = (id: string) => {
    editor.selectZone(id);
    setZoneSheetOpen(false);
    setAreaSettingsOpen(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        className="absolute inset-0 h-full w-full"
        basemapId={basemapId}
        onReady={(m) => (mapRef.current = m)}
        zones={editor.zones}
        dock={editor.dock}
        editing={editor.editing}
        selectedZoneId={editor.selectedZoneId}
        selectedVertex={editor.selectedVertex}
        tool={editor.tool}
        snapPick={editor.snapPick}
        multiSelected={editor.multiSelected}
        brushRadius={brushRadius}
        brushStrength={brushStrength}
        placingDock={placingDock}
        onZonesChange={editor.commitZones}
        onSelectVertex={editor.selectVertex}
        onSelectZone={openZoneSettings}
        onPickSnapVertex={editor.pickSnapVertex}
        onToggleMultiVertex={editor.toggleMultiVertex}
        onSetMultiSelected={editor.setMultiSelected}
        onCreateZone={(outline) => {
          editor.createZone(outline);
          editor.setTool('select');
        }}
        onDockChange={(next) => {
          editor.commitDock(next);
          setPlacingDock(false);
        }}
      />

      {/* top status pills (live view) / editing indicator (edit mode) */}
      {editor.editing ? (
        <div className="absolute inset-x-3 top-3 z-[500] flex items-center gap-2">
          <OverlayChip>
            <Pencil size={12} className="text-accent" /> Editing map
          </OverlayChip>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-center gap-2">
          <OverlayChip>
            <span className="text-accent">●</span> Mowing
          </OverlayChip>
          <OverlayChip>{MOW.area}</OverlayChip>
          <OverlayChip className="ml-auto">
            <span className="text-accent">●</span> RTK fixed
          </OverlayChip>
        </div>
      )}

      {/* map FABs */}
      <div className="absolute right-3 top-16 z-[500] flex flex-col gap-2">
        <Fab
          aria-label={editor.editing ? 'Exit edit mode' : 'Edit map'}
          icon={editor.editing ? <X size={18} /> : <Pencil size={18} />}
          onClick={() => editor.setEditing(!editor.editing)}
        />
        {!editor.editing && (
          <Fab aria-label="Recenter on robot" icon={<Locate size={18} />} onClick={() => mapRef.current?.setZoom(19)} />
        )}
        <Fab aria-label="Base map" icon={<Layers size={18} />} onClick={() => setBasemapSheetOpen(true)} />
        <Fab aria-label="Zoom in" icon={<Plus size={18} />} onClick={() => mapRef.current?.zoomIn()} />
        <Fab aria-label="Zoom out" icon={<Minus size={18} />} onClick={() => mapRef.current?.zoomOut()} />
      </div>

      {editor.editing ? (
        /* edit-mode tool dock: zone picker, vertex tool, undo/redo/delete */
        <div className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[320px]">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-[var(--shadow-s)]">
            <ListRow
              className="py-1.5"
              icon={<MapPinned size={16} className="text-ink-faint" />}
              title={selectedZone?.name ?? 'Choose a zone'}
              sub={selectedZone?.type}
              onClick={() => setZoneSheetOpen(true)}
            />
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
              {TOOLS.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant={editor.tool === t.value ? 'primary' : 'soft'}
                  size="icon"
                  className="h-9 w-9 flex-none"
                  aria-label={t.label}
                  title={t.label}
                  aria-pressed={editor.tool === t.value}
                  onClick={() => editor.setTool(t.value)}
                >
                  {t.icon}
                </Button>
              ))}
            </div>

            {editor.tool === 'snap' && (
              <div className="mt-2 text-[.72rem] text-ink-faint">
                {editor.snapPick
                  ? 'Tap the end vertex to snap the range straight.'
                  : 'Tap a start vertex, then an end vertex.'}
              </div>
            )}
            {editor.tool === 'multi' && (
              <div className="mt-2 text-[.72rem] text-ink-faint">
                Tap vertices to select, or Shift-drag a box on the map — {editor.multiSelected.size} selected.
              </div>
            )}
            {editor.tool === 'brush' && (
              <div className="mt-2.5 space-y-2">
                <FormField label="Brush radius" value={brushRadius.toFixed(1)} unit=" m">
                  <Slider
                    value={brushRadius}
                    min={0.3}
                    max={4}
                    step={0.1}
                    onChange={setBrushRadius}
                    aria-label="Brush radius"
                  />
                </FormField>
                <FormField label="Brush strength" value={Math.round(brushStrength * 100)} unit="%">
                  <Slider
                    value={brushStrength}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onChange={setBrushStrength}
                    aria-label="Brush strength"
                  />
                </FormField>
              </div>
            )}

            <div className="mt-2.5 flex items-center gap-2">
              <Button variant="soft" size="sm" className="flex-1" onClick={addZoneAtCenter}>
                <SquarePlus size={14} /> Add zone
              </Button>
              <Button
                variant={placingDock ? 'primary' : 'soft'}
                size="sm"
                className="flex-1"
                onClick={() => setPlacingDock((v) => !v)}
              >
                <MapPin size={14} /> {placingDock ? 'Tap the map…' : 'Place dock'}
              </Button>
              <Button
                variant="soft"
                size="sm"
                className="flex-1"
                onClick={() => setTransformSheetOpen(true)}
                disabled={!selectedZone}
              >
                <Sliders size={14} /> Transform
              </Button>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={editor.undo} disabled={!editor.canUndo}>
                <Undo2 size={14} /> Undo
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={editor.redo} disabled={!editor.canRedo}>
                <Redo2 size={14} /> Redo
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={editor.deleteSelection}
                disabled={editor.tool === 'multi' ? editor.multiSelected.size === 0 : !editor.selectedVertex}
              >
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* floating stat card (live view) */
        <StatCard className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[320px]">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 leading-tight">
              <div className="text-[.92rem] font-semibold text-ink">Mowing {MOW.area}</div>
              <div className="text-[.76rem] text-ink-soft">
                {MOW.coverage}% · {MOW.timeLeftMin} min left
              </div>
            </div>
          </div>
          <ProgressBar value={MOW.coverage} className="mt-2.5" />
          <Button variant="danger" className="mt-2.5 w-full justify-center">
            <Square size={13} fill="currentColor" /> Stop &amp; hold position
          </Button>
        </StatCard>
      )}

      <Sheet open={basemapSheetOpen} onClose={() => setBasemapSheetOpen(false)} title="Base map">
        {BASEMAPS.map((b) => (
          <ListRow
            key={b.id}
            title={b.label}
            onClick={() => selectBasemap(b.id)}
            trailing={b.id === basemapId ? <Check size={17} className="text-accent" /> : undefined}
          />
        ))}
      </Sheet>

      <Sheet open={zoneSheetOpen} onClose={() => setZoneSheetOpen(false)} title="Choose zone">
        {editor.zones.map((z) => (
          <ListRow
            key={z.id}
            title={z.name}
            sub={z.type}
            onClick={() => openZoneSettings(z.id)}
            trailing={z.id === editor.selectedZoneId ? <Check size={17} className="text-accent" /> : undefined}
          />
        ))}
      </Sheet>

      <AreaSettingsSheet
        open={areaSettingsOpen}
        onClose={() => setAreaSettingsOpen(false)}
        zone={selectedZone}
        onSwitchZone={() => setZoneSheetOpen(true)}
        onRename={(name) => selectedZone && editor.renameZone(selectedZone.id, name)}
        onSetType={(type) => selectedZone && editor.setZoneType(selectedZone.id, type)}
        onSetActive={(active) => selectedZone && editor.setZoneActive(selectedZone.id, active)}
        onUpdateSettings={(patch) => selectedZone && editor.updateZoneSettings(selectedZone.id, patch)}
        onResetSettings={() => selectedZone && editor.resetZoneSettings(selectedZone.id)}
      />

      {/* Zone create/transform — placeholder home for this until the area-settings batch folds
          the Basics (name/type/active) part into the real per-area settings editor. */}
      <Sheet open={transformSheetOpen} onClose={() => setTransformSheetOpen(false)} title={selectedZone?.name ?? 'Transform'}>
        {selectedZone && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Button
                variant="soft"
                size="sm"
                className="flex-1"
                onClick={() => editor.reorderZone(selectedZone.id, 'up')}
                disabled={selectedZoneIndex <= 0}
              >
                <ArrowUp size={14} /> Order up
              </Button>
              <Button
                variant="soft"
                size="sm"
                className="flex-1"
                onClick={() => editor.reorderZone(selectedZone.id, 'down')}
                disabled={selectedZoneIndex < 0 || selectedZoneIndex >= editor.zones.length - 1}
              >
                <ArrowDown size={14} /> Order down
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="soft" size="sm" className="flex-1" onClick={() => editor.duplicateZone(selectedZone.id)}>
                <Copy size={14} /> Duplicate
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={() => {
                  editor.deleteZone(selectedZone.id);
                  setTransformSheetOpen(false);
                }}
              >
                <Trash2 size={14} /> Delete zone
              </Button>
            </div>

            <div className="h-px bg-border" />

            <FormField label="Rotate" hint="About the zone's centroid.">
              <div className="flex items-center gap-2">
                <Button variant="soft" size="sm" className="flex-1" onClick={() => editor.rotateSelectedZone(-1)}>
                  <RotateCcw size={14} /> −15°
                </Button>
                <Button variant="soft" size="sm" className="flex-1" onClick={() => editor.rotateSelectedZone(1)}>
                  <RotateCw size={14} /> +15°
                </Button>
              </div>
            </FormField>

            <FormField label="Scale" hint="About the zone's centroid.">
              <div className="flex items-center gap-2">
                <Button variant="soft" size="sm" className="flex-1" onClick={() => editor.scaleSelectedZone(-1)}>
                  <Shrink size={14} /> −5%
                </Button>
                <Button variant="soft" size="sm" className="flex-1" onClick={() => editor.scaleSelectedZone(1)}>
                  <Expand size={14} /> +5%
                </Button>
              </div>
            </FormField>

            <FormField
              label="Grow / shrink"
              value={bufferDistance >= 0 ? `+${bufferDistance.toFixed(2)}` : bufferDistance.toFixed(2)}
              unit=" m"
              hint="Uniform outline offset — positive grows, negative shrinks."
            >
              <Slider
                value={bufferDistance}
                min={-1}
                max={1}
                step={0.05}
                onChange={setBufferDistance}
                aria-label="Grow/shrink distance"
              />
              <Button
                variant="soft"
                size="sm"
                className="mt-1.5 w-full justify-center"
                onClick={() => editor.bufferSelectedZone(bufferDistance)}
              >
                Apply
              </Button>
            </FormField>

            <FormField
              label="Simplify outline"
              value={simplifyTolerance.toFixed(2)}
              unit=" m tolerance"
              hint="Douglas-Peucker — removes points that don't change the shape by more than this."
            >
              <Slider
                value={simplifyTolerance}
                min={0.02}
                max={1}
                step={0.02}
                onChange={setSimplifyTolerance}
                aria-label="Simplify tolerance"
              />
              <Button
                variant="soft"
                size="sm"
                className="mt-1.5 w-full justify-center"
                onClick={() => editor.simplifySelectedZone(simplifyTolerance)}
              >
                <Spline size={14} /> Simplify
              </Button>
            </FormField>
          </div>
        )}
      </Sheet>
    </div>
  );
}
