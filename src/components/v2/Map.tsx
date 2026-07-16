'use client';

// Map screen — the map is the hero (full-bleed), UI floats over it in pills / FABs / a stat card
// (design-language.md "The map is the hero"). Real Leaflet canvas underneath; concept chrome on top.
// Batch 1 of the map-editor port (RevLaw baseline): edit mode, zone selection, vertex
// select/drag/add/delete, undo/redo. Later batches add brush/snap/multi-select/transforms.
import {BASEMAPS, DEFAULT_BASEMAP_ID} from '@/components/v2/map/basemaps';
import {MOCK_ZONES} from '@/components/v2/map/mockMap';
import {useMapEditor, type EditTool} from '@/components/v2/map/useMapEditor';
import {Button} from '@/components/v2/ui/Button';
import {Fab} from '@/components/v2/ui/Fab';
import {ListRow} from '@/components/v2/ui/ListRow';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import {StatCard} from '@/components/v2/ui/StatCard';
import type {Map as LeafletMap} from 'leaflet';
import {Check, Layers, Locate, MapPinned, Minus, Pencil, Plus, Redo2, Square, Trash2, Undo2, X} from 'lucide-react';
import dynamic from 'next/dynamic';
import {useEffect, useRef, useState} from 'react';

const MapCanvas = dynamic(() => import('@/components/v2/map/MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24};

const BASEMAP_STORAGE_KEY = 'v2.basemap';

const TOOL_OPTIONS: {value: EditTool; label: string}[] = [
  {value: 'select', label: 'Select'},
  {value: 'add', label: 'Add'},
  {value: 'delete', label: 'Delete'},
];

export function Map() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const [basemapSheetOpen, setBasemapSheetOpen] = useState(false);
  const [zoneSheetOpen, setZoneSheetOpen] = useState(false);
  const editor = useMapEditor(MOCK_ZONES);

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

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        className="absolute inset-0 h-full w-full"
        basemapId={basemapId}
        onReady={(m) => (mapRef.current = m)}
        zones={editor.zones}
        editing={editor.editing}
        selectedZoneId={editor.selectedZoneId}
        selectedVertex={editor.selectedVertex}
        tool={editor.tool}
        onZonesChange={editor.commitZones}
        onSelectVertex={editor.selectVertex}
        onSelectZone={editor.selectZone}
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
            <SegmentedToggle
              className="mt-2"
              label="Tool"
              options={TOOL_OPTIONS}
              value={editor.tool}
              onChange={(v) => editor.setTool(v as EditTool)}
            />
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
                onClick={editor.deleteSelectedVertex}
                disabled={!editor.selectedVertex}
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

      <Sheet open={zoneSheetOpen} onClose={() => setZoneSheetOpen(false)} title="Edit zone">
        {editor.zones.map((z) => (
          <ListRow
            key={z.id}
            title={z.name}
            sub={z.type}
            onClick={() => {
              editor.selectZone(z.id);
              setZoneSheetOpen(false);
            }}
            trailing={z.id === editor.selectedZoneId ? <Check size={17} className="text-accent" /> : undefined}
          />
        ))}
      </Sheet>
    </div>
  );
}
