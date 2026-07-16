'use client';

// Map screen — the map is the hero (full-bleed), UI floats over it in pills / FABs / a stat card
// (design-language.md "The map is the hero"). Real Leaflet canvas underneath; concept chrome on top.
// Map-editor port: edit mode, zone selection, vertex tools, zone create/transform, undo/redo
// (batches 1-3 of MAP_EDITOR_SPEC.md), plus the real per-area settings editor (AREA_SETTINGS_SPEC.md,
// AreaSettingsSheet.tsx). The "Choose zone" Sheet below is just the quick zone switcher now —
// selecting a zone (there, or by tapping it on the map) opens the settings editor.
import {latLngToMeters, metersToLatLng} from '@/lib/v2/geo/projection';
import {AreaSettingsSheet} from '@/components/v2/map/AreaSettingsSheet';
import {BASEMAPS, DEFAULT_BASEMAP_ID} from '@/components/v2/map/basemaps';
import {coverageLines, outlineLaps} from '@/components/v2/map/coverage';
import {principalAngleDeg} from '@/components/v2/map/geometry';
import {measureZone} from '@/components/v2/map/measurements';
import {isMowableType, MOCK_DOCK, MOCK_ORIGIN, MOCK_ZONES, ZONE_TYPE_LABELS, type ZoneType} from '@/components/v2/map/mockMap';
import {useMapEditor, TOOL_SHORTCUT_KEYS, type EditTool} from '@/components/v2/map/useMapEditor';
import {validateMap, type MapIssue} from '@/components/v2/map/validation';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {CommandPalette, type CommandPaletteAction} from '@/components/v2/ui/CommandPalette';
import {Fab} from '@/components/v2/ui/Fab';
import {FormField} from '@/components/v2/ui/FormField';
import {ListRow} from '@/components/v2/ui/ListRow';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Slider} from '@/components/v2/ui/Slider';
import {StatCard} from '@/components/v2/ui/StatCard';
import {StatePill} from '@/components/v2/ui/StatePill';
import {StatRow} from '@/components/v2/ui/StatRow';
import {Switch} from '@/components/v2/ui/Switch';
import type {Map as LeafletMap} from 'leaflet';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  Circle as CircleIcon,
  CirclePlus,
  Command,
  Copy,
  Eraser,
  Expand,
  HelpCircle,
  Home,
  Layers,
  Locate,
  MapPin,
  MapPinned,
  MousePointer2,
  Minus,
  Move,
  Paintbrush2,
  Pause,
  Pencil,
  Play,
  Plus,
  RectangleHorizontal,
  Redo2,
  Route,
  RotateCcw,
  RotateCw,
  Shrink,
  Signpost,
  Sliders,
  Spline,
  Square,
  SquareDashedMousePointer,
  SquarePlus,
  Target,
  Trash2,
  Undo2,
  Waypoints,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';

const MapCanvas = dynamic(() => import('@/components/v2/map/MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24};

const BASEMAP_STORAGE_KEY = 'v2.basemap';
const COVERAGE_STORAGE_KEY = 'v2.coveragePreview';

// Coverage preview (§F) — visual only, remembered locally, never written to the map.
interface CoveragePreviewSettings {
  enabled: boolean;
  toolWidthM: number;
  outlineLapCount: number;
  angleOffsetDeg: number;
  /** true = angleOffsetDeg is the absolute stripe direction; false = an offset from the
   *  outline's auto-detected principal angle (mirrors mower_logic's mow_angle_offset_is_absolute). */
  angleIsAbsolute: boolean;
}

const DEFAULT_COVERAGE_SETTINGS: CoveragePreviewSettings = {
  enabled: false,
  toolWidthM: 0.24,
  outlineLapCount: 2,
  angleOffsetDeg: 0,
  angleIsAbsolute: false,
};

// Mowed-so-far lanes (S1) use a fixed lane spacing — separate from the user-adjustable coverage-
// preview tool width above, since one is "what already happened" and the other is a what-if plan.
const MOWED_LANE_SPACING_M = 0.24;

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

// Reverse of TOOL_SHORTCUT_KEYS ({letter: tool} -> {tool: LETTER}) for hints in the tool row/
// command palette.
const TOOL_KEY_LABEL: Partial<Record<EditTool, string>> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUT_KEYS).map(([key, tool]) => [tool, key.toUpperCase()]),
);

// "Add to map" create-object menu (MAP_SCREEN_SPEC S3) — every object type the concept lists.
// 'dock' isn't a Zone type (there's exactly one physical dock); picking it arms click-to-place.
const ADD_TO_MAP_ITEMS: {type: ZoneType | 'dock'; label: string; sub: string; icon: ReactNode; sizeM?: number}[] = [
  {type: 'mow', label: ZONE_TYPE_LABELS.mow, sub: 'An area the mower covers', icon: <SquarePlus size={18} />, sizeM: 6},
  {type: 'obstacle', label: ZONE_TYPE_LABELS.obstacle, sub: 'Excluded from mowing', icon: <Ban size={18} />, sizeM: 3},
  {type: 'dock', label: 'Docking station', sub: 'Move the charging dock', icon: <Home size={18} />},
  {type: 'spot', label: ZONE_TYPE_LABELS.spot, sub: 'A one-off mow patch', icon: <Target size={18} />, sizeM: 2},
  {type: 'nav', label: ZONE_TYPE_LABELS.nav, sub: 'A route between areas, not mowed', icon: <Signpost size={18} />, sizeM: 6},
];

const SHORTCUTS: {keys: string; desc: string}[] = [
  {keys: 'V', desc: 'Select / drag tool'},
  {keys: 'A', desc: 'Add point tool'},
  {keys: 'B', desc: 'Push brush tool'},
  {keys: 'S', desc: 'Snap line tool'},
  {keys: 'M', desc: 'Multi-select tool'},
  {keys: 'R', desc: 'Draw rectangle tool'},
  {keys: 'O', desc: 'Draw circle tool'},
  {keys: 'G', desc: 'Move zone tool'},
  {keys: '← → ↑ ↓', desc: 'Nudge selected vertex (Shift = 10×)'},
  {keys: 'Del / ⌫', desc: 'Delete the current selection'},
  {keys: 'Ctrl/⌘+Z', desc: 'Undo'},
  {keys: 'Ctrl/⌘+Shift+Z', desc: 'Redo'},
  {keys: 'Ctrl/⌘+D', desc: 'Duplicate the selected zone'},
  {keys: 'Ctrl/⌘+K', desc: 'Command palette'},
  {keys: '?', desc: 'This cheat sheet'},
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
  const [issuesSheetOpen, setIssuesSheetOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [coverageSheetOpen, setCoverageSheetOpen] = useState(false);
  const [addObjectSheetOpen, setAddObjectSheetOpen] = useState(false);
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE_SETTINGS);
  // S5 — mock pause/resume for the live-view stat card (a real "hold position" toggle, distinct
  // from S6's involuntary RTK-lost block).
  const [mockPaused, setMockPaused] = useState(false);
  // S4 — which mowable zone the live view treats as "currently mowing" (the per-area Mow button
  // in the desktop Areas panel changes this). MOW.coverage/timeLeftMin stay fixed mock numbers
  // regardless of which area is active — a deliberate simplification, not real per-area progress.
  const [activeMowZoneId, setActiveMowZoneId] = useState(() => MOCK_ZONES.find((z) => z.name === MOW.area)?.id ?? null);
  // S6 — mock "blockers as data": an involuntary RTK-lost pause (distinct from S5's voluntary
  // Pause). No real trigger exists yet, so it's toggled from the command palette for now — reuses
  // states/PausedBlockerScreen.tsx's visual language, rendered as the Map's own live-view state.
  const [mockBlocked, setMockBlocked] = useState(false);
  const editor = useMapEditor(MOCK_ZONES, MOCK_DOCK);

  useEffect(() => {
    const stored = localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (stored && BASEMAPS.some((b) => b.id === stored)) setBasemapId(stored);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(COVERAGE_STORAGE_KEY);
    if (!stored) return;
    try {
      setCoverage({...DEFAULT_COVERAGE_SETTINGS, ...JSON.parse(stored)});
    } catch {
      // ignore malformed localStorage content — keep the defaults
    }
  }, []);

  const updateCoverage = (patch: Partial<CoveragePreviewSettings>) => {
    setCoverage((prev) => {
      const next = {...prev, ...patch};
      localStorage.setItem(COVERAGE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // UI-only shortcuts (the tool/undo/nudge/delete shortcuts live in useMapEditor, next to the
  // state they drive). Available regardless of edit mode — Ctrl/Cmd+K is useful any time.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setCheatSheetOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectBasemap = (id: string) => {
    setBasemapId(id);
    localStorage.setItem(BASEMAP_STORAGE_KEY, id);
    setBasemapSheetOpen(false);
  };

  // Toggling edit mode off closes every edit-only sheet too — otherwise one left open (e.g. area
  // settings) would still render its persistent desktop panel over the live view, at the same
  // spot the new S4 "Areas" live-view panel occupies.
  const toggleEditing = () => {
    const next = !editor.editing;
    editor.setEditing(next);
    if (!next) {
      setAreaSettingsOpen(false);
      setTransformSheetOpen(false);
      setCoverageSheetOpen(false);
      setZoneSheetOpen(false);
      setIssuesSheetOpen(false);
      setAddObjectSheetOpen(false);
    }
  };

  const selectedZone = editor.zones.find((z) => z.id === editor.selectedZoneId);
  const selectedZoneIndex = editor.zones.findIndex((z) => z.id === editor.selectedZoneId);
  const activeMowZone = editor.zones.find((z) => z.id === activeMowZoneId);
  const mowAreaName = activeMowZone?.name ?? MOW.area;

  // Selecting a zone (zone-list picker, or tapping it on the map) opens the settings editor for
  // it — the zone-list Sheet itself stays around as a quick way to switch which zone that is.
  const openZoneSettings = (id: string) => {
    editor.selectZone(id);
    setZoneSheetOpen(false);
    setAreaSettingsOpen(true);
  };

  // Create-object menu (MAP_SCREEN_SPEC S3): every polygon object type is a square at the current
  // map center (rect/circle draw tools are still there for a drawn shape instead); "drops into
  // editing it" per the spec means opening the settings editor for the brand-new zone right away.
  const addObjectAtCenter = (type: ZoneType, sizeM?: number) => {
    const center = mapRef.current ? latLngToMeters(mapRef.current.getCenter(), MOCK_ORIGIN) : {x: 0, y: 0};
    const id = editor.addZone(center, type, sizeM);
    openZoneSettings(id);
    setAddObjectSheetOpen(false);
  };

  const addDockStation = () => {
    setPlacingDock(true);
    setAddObjectSheetOpen(false);
  };

  // Live measurements for the selected zone — recomputed from `editor.zones` on every render, so
  // they reflect every COMMITTED edit (drag-end, brush-stroke-end, transform apply, ...). Nothing
  // updates mid-gesture (before commit), since live drag previews are Leaflet-only and never touch
  // React state (see MapCanvas) — "live" here means "immediately after each edit action".
  const measurements = selectedZone ? measureZone(selectedZone, editor.zones) : null;

  // Map-wide validation — recomputed whenever the zones/dock actually change (self-intersection
  // checks are O(n²) per zone, worth memoizing).
  const issues = useMemo(() => validateMap(editor.zones, editor.dock), [editor.zones, editor.dock]);

  // Coverage preview (§F) — visual only, for the selected mow zone. Obstacles anywhere on the map
  // carve holes in the fill (matches how the robot would actually treat them, not just ones inside
  // this particular zone's bounds).
  const coveragePreviewData = useMemo(() => {
    if (!coverage.enabled || !selectedZone || !isMowableType(selectedZone.type)) return null;
    const obstacles = editor.zones.filter((z) => z.type === 'obstacle' && z.outline.length >= 3).map((z) => z.outline);
    const baseAngle = coverage.angleIsAbsolute
      ? coverage.angleOffsetDeg
      : principalAngleDeg(selectedZone.outline) + coverage.angleOffsetDeg;
    return {
      outlineLaps: outlineLaps(selectedZone.outline, coverage.outlineLapCount, coverage.toolWidthM),
      fillSegments: coverageLines(selectedZone.outline, obstacles, coverage.toolWidthM, baseAngle),
    };
  }, [coverage, selectedZone, editor.zones]);

  // Mowed-so-far lanes (MAP_SCREEN_SPEC S1) — mock progress painting for the live view (hidden
  // while editing, same as the real robot wouldn't repaint the map mid-edit). Reuses the coverage-
  // line generator at a fixed lane spacing, independent of the edit-mode coverage-preview settings,
  // and shows only the leading MOW.coverage% of lines so it visually matches the existing "62%
  // mowed" stat in the live-view card.
  const mowedLanesData = useMemo(() => {
    if (editor.editing || !activeMowZone) return null;
    const obstacles = editor.zones.filter((z) => z.type === 'obstacle' && z.outline.length >= 3).map((z) => z.outline);
    const lines = coverageLines(activeMowZone.outline, obstacles, MOWED_LANE_SPACING_M, principalAngleDeg(activeMowZone.outline));
    return lines.slice(0, Math.round((lines.length * MOW.coverage) / 100));
  }, [editor.editing, editor.zones, activeMowZone]);

  const goToIssue = (issue: MapIssue) => {
    // Select (not open settings for) the zone so the tool dock reflects it without stacking a
    // second sheet on top of the one the user is browsing issues from.
    if (issue.zoneId) editor.selectZone(issue.zoneId);
    setIssuesSheetOpen(false);
    mapRef.current?.setView(metersToLatLng(issue.point, MOCK_ORIGIN), 20);
  };

  // Command palette (Ctrl/Cmd+K) — every action on this screen, filterable by name. Kept close to
  // the JSX it mirrors rather than factored out, since it's mostly thin wrappers around the same
  // handlers the buttons below call.
  const commandActions: CommandPaletteAction[] = [
    {
      id: 'toggle-edit',
      label: editor.editing ? 'Exit edit mode' : 'Edit map',
      onRun: toggleEditing,
    },
    ...TOOLS.map((t) => ({
      id: `tool-${t.value}`,
      label: `Tool: ${t.label}`,
      hint: TOOL_KEY_LABEL[t.value],
      icon: t.icon,
      disabled: !editor.editing,
      onRun: () => editor.setTool(t.value),
    })),
    {id: 'undo', label: 'Undo', hint: 'Ctrl+Z', disabled: !editor.canUndo, onRun: editor.undo},
    {id: 'redo', label: 'Redo', hint: 'Ctrl+Shift+Z', disabled: !editor.canRedo, onRun: editor.redo},
    {
      id: 'delete-selection',
      label: 'Delete selection',
      hint: 'Del',
      disabled: editor.tool === 'multi' ? editor.multiSelected.size === 0 : !editor.selectedVertex,
      onRun: editor.deleteSelection,
    },
    {id: 'add-to-map', label: 'Add to map…', disabled: !editor.editing, onRun: () => setAddObjectSheetOpen(true)},
    {id: 'place-dock', label: 'Place dock', disabled: !editor.editing, onRun: () => setPlacingDock(true)},
    {
      id: 'duplicate-zone',
      label: 'Duplicate zone',
      hint: 'Ctrl+D',
      disabled: !selectedZone,
      onRun: () => selectedZone && editor.duplicateZone(selectedZone.id),
    },
    {
      id: 'delete-zone',
      label: 'Delete zone',
      disabled: !selectedZone,
      onRun: () => selectedZone && editor.deleteZone(selectedZone.id),
    },
    {id: 'zone-settings', label: 'Zone settings…', disabled: !selectedZone, onRun: () => setAreaSettingsOpen(true)},
    {id: 'transform', label: 'Transform zone…', disabled: !selectedZone, onRun: () => setTransformSheetOpen(true)},
    {id: 'choose-zone', label: 'Choose zone…', onRun: () => setZoneSheetOpen(true)},
    {id: 'validation', label: `Validation issues (${issues.length})`, onRun: () => setIssuesSheetOpen(true)},
    {id: 'basemap', label: 'Base map…', onRun: () => setBasemapSheetOpen(true)},
    {id: 'zoom-in', label: 'Zoom in', onRun: () => mapRef.current?.zoomIn()},
    {id: 'zoom-out', label: 'Zoom out', onRun: () => mapRef.current?.zoomOut()},
    {
      id: 'recenter',
      label: 'Recenter on robot',
      disabled: editor.editing,
      onRun: () => mapRef.current?.setZoom(19),
    },
    {id: 'coverage-preview', label: 'Coverage preview…', icon: <Route size={15} />, onRun: () => setCoverageSheetOpen(true)},
    {
      id: 'simulate-rtk-lost',
      label: mockBlocked ? 'Simulate: clear RTK-lost' : 'Simulate: RTK lost',
      disabled: editor.editing,
      icon: <AlertTriangle size={15} />,
      onRun: () => setMockBlocked((v) => !v),
    },
    {id: 'cheat-sheet', label: 'Keyboard shortcuts', hint: '?', icon: <HelpCircle size={15} />, onRun: () => setCheatSheetOpen(true)},
  ];

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
        coveragePreview={coveragePreviewData}
        mowedLanes={mowedLanesData}
        robotAccuracyM={mockBlocked ? 1.4 : 0.35}
        robotBlocked={mockBlocked}
      />

      {/* top status pills (live view) / editing indicator (edit mode) */}
      {editor.editing ? (
        <div className="absolute inset-x-3 top-3 z-[500] flex items-center gap-2">
          <OverlayChip>
            <Pencil size={12} className="text-accent" /> Editing map
          </OverlayChip>
        </div>
      ) : mockBlocked ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-center gap-2">
          <OverlayChip>
            <span className="text-warn">●</span> RTK lost
          </OverlayChip>
          <OverlayChip className="ml-auto">{mowAreaName}</OverlayChip>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-center gap-2">
          <OverlayChip>
            <span className={mockPaused ? 'text-warn' : 'text-accent'}>●</span> {mockPaused ? 'Paused' : 'Mowing'}
          </OverlayChip>
          <OverlayChip>{mowAreaName}</OverlayChip>
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
          onClick={toggleEditing}
        />
        {!editor.editing && (
          <Fab aria-label="Recenter on robot" icon={<Locate size={18} />} onClick={() => mapRef.current?.setZoom(19)} />
        )}
        <Fab aria-label="Base map" icon={<Layers size={18} />} onClick={() => setBasemapSheetOpen(true)} />
        {editor.editing && (
          <div className="relative">
            <Fab aria-label="Validation issues" icon={<AlertTriangle size={18} />} onClick={() => setIssuesSheetOpen(true)} />
            {issues.length > 0 && (
              <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {issues.length}
              </span>
            )}
          </div>
        )}
        {editor.editing && (
          <Fab
            aria-label="Coverage preview"
            icon={<Route size={18} className={coverage.enabled ? 'text-accent' : undefined} />}
            onClick={() => setCoverageSheetOpen(true)}
          />
        )}
        <Fab aria-label="Zoom in" icon={<Plus size={18} />} onClick={() => mapRef.current?.zoomIn()} />
        <Fab aria-label="Zoom out" icon={<Minus size={18} />} onClick={() => mapRef.current?.zoomOut()} />
        <Fab
          aria-label="Command palette (Ctrl/Cmd+K)"
          icon={<Command size={17} />}
          onClick={() => setCommandPaletteOpen(true)}
        />
      </div>

      {editor.editing ? (
        /* edit-mode tool dock: zone picker, vertex tool, undo/redo/delete */
        <div className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[320px]">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-[var(--shadow-s)]">
            <ListRow
              className="py-1.5"
              icon={<MapPinned size={16} className="text-ink-faint" />}
              title={selectedZone?.name ?? 'Choose a zone'}
              sub={selectedZone ? ZONE_TYPE_LABELS[selectedZone.type] : undefined}
              onClick={() => setZoneSheetOpen(true)}
            />

            {measurements && (
              <div className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
                <StatRow
                  label="Area"
                  value={`${measurements.areaM2.toFixed(0)} m² · ${(measurements.areaM2 / 10000).toFixed(3)}`}
                  unit="ha"
                />
                <StatRow label="Perimeter" value={measurements.perimeterM.toFixed(1)} unit="m" />
                {measurements.netMowableM2 !== null && (
                  <StatRow label="Net mowable" value={measurements.netMowableM2.toFixed(0)} unit="m²" />
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
              {TOOLS.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant={editor.tool === t.value ? 'primary' : 'soft'}
                  size="icon"
                  className="h-9 w-9 flex-none"
                  aria-label={t.label}
                  title={TOOL_KEY_LABEL[t.value] ? `${t.label} (${TOOL_KEY_LABEL[t.value]})` : t.label}
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
              <Button variant="soft" size="sm" className="flex-1" onClick={() => setAddObjectSheetOpen(true)}>
                <SquarePlus size={14} /> Add to map
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
      ) : mockBlocked ? (
        /* S6 — blockers as data: the mower stopped itself on a position it can't trust. Mow stays
           disabled with its reason attached; Dock is still one tap away. Visual language mirrors
           states/PausedBlockerScreen.tsx, rendered here as the Map's own live state. */
        <>
          <StatePill
            tone="warn"
            icon={<AlertTriangle size={16} strokeWidth={2.4} />}
            label="Paused · Waiting for GPS fix"
            sub="Position uncertainty is growing"
            className="absolute inset-x-3 top-[3.1rem] z-[500] shadow-[var(--shadow-m)] md:left-3 md:right-auto md:w-[360px]"
          />
          <StatCard className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[320px]">
            <p className="m-0 text-[.8rem] leading-[1.45] text-ink-soft">
              The mower stopped itself — it won&rsquo;t drive on a position it can&rsquo;t trust.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Button variant="primary" disabled className="flex-1 justify-center">
                <Play size={16} fill="currentColor" /> Mow
              </Button>
              <Chip variant="warn" className="flex-none">
                Needs a GPS fix
              </Chip>
            </div>
            <Button variant="ghost" className="mt-2 w-full justify-center">
              <Home size={15} strokeWidth={2.2} /> Dock
            </Button>
          </StatCard>
        </>
      ) : (
        <>
          {/* floating stat card (live view, mobile — desktop gets the Areas panel below too) */}
          <StatCard className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[320px]">
            <div className="flex items-center gap-2.5">
              <div className="flex-1 leading-tight">
                <div className="text-[.92rem] font-semibold text-ink">
                  {mockPaused ? 'Paused' : 'Mowing'} {mowAreaName}
                </div>
                <div className="text-[.76rem] text-ink-soft">
                  {MOW.coverage}% · {mockPaused ? 'holding position' : `${MOW.timeLeftMin} min left`}
                </div>
              </div>
            </div>
            <ProgressBar value={MOW.coverage} className="mt-2.5" />
            <div className="mt-2.5 flex items-center gap-2">
              {mockPaused ? (
                <Button variant="primary" className="flex-1 justify-center" onClick={() => setMockPaused(false)}>
                  <Play size={13} fill="currentColor" /> Resume
                </Button>
              ) : (
                <Button variant="ghost" className="flex-1 justify-center" onClick={() => setMockPaused(true)}>
                  <Pause size={13} fill="currentColor" /> Pause
                </Button>
              )}
              <Button variant="danger" className="flex-1 justify-center">
                <Square size={13} fill="currentColor" /> Stop
              </Button>
            </div>
          </StatCard>

          {/* S4 — desktop-only "Areas" right rail (live view). Mobile keeps the stat card above. */}
          <Card className="absolute right-3 top-16 bottom-3 z-[500] hidden w-[300px] flex-col overflow-hidden p-0 md:flex">
            <div className="border-b border-border px-3.5 py-3 text-[.85rem] font-semibold text-ink">Areas</div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {editor.zones
                .filter((z) => isMowableType(z.type))
                .map((z) => {
                  const isActive = z.id === activeMowZoneId;
                  const areaM2 = measureZone(z, editor.zones).areaM2;
                  const status = isActive ? `Mowing · ${MOW.coverage}%` : z.active === false ? 'Inactive' : 'Queued';
                  return (
                    <div key={z.id} className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[.85rem] font-semibold text-ink">{z.name}</div>
                        <div className="text-[.72rem] text-ink-soft">
                          {areaM2.toFixed(0)} m² · {status}
                        </div>
                      </div>
                      <Button
                        variant={isActive ? 'primary' : 'soft'}
                        size="sm"
                        disabled={isActive || z.active === false}
                        onClick={() => setActiveMowZoneId(z.id)}
                      >
                        Mow
                      </Button>
                    </div>
                  );
                })}
            </div>
            <div className="border-t border-border p-2.5">
              <Button variant="primary" className="w-full justify-center">
                <Play size={13} fill="currentColor" /> Mow all now
              </Button>
            </div>
          </Card>
        </>
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
            sub={ZONE_TYPE_LABELS[z.type]}
            onClick={() => openZoneSettings(z.id)}
            trailing={z.id === editor.selectedZoneId ? <Check size={17} className="text-accent" /> : undefined}
          />
        ))}
      </Sheet>

      <Sheet open={addObjectSheetOpen} onClose={() => setAddObjectSheetOpen(false)} title="Add to map">
        {ADD_TO_MAP_ITEMS.map((item) => (
          <ListRow
            key={item.type}
            icon={item.icon}
            title={item.label}
            sub={item.sub}
            onClick={() => (item.type === 'dock' ? addDockStation() : addObjectAtCenter(item.type, item.sizeM))}
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

      <Sheet
        open={issuesSheetOpen}
        onClose={() => setIssuesSheetOpen(false)}
        title={issues.length > 0 ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : 'No issues'}
      >
        {issues.length === 0 ? (
          <div className="py-2 text-center text-[.82rem] text-ink-soft">Map geometry looks good.</div>
        ) : (
          issues.map((issue) => (
            <ListRow
              key={issue.id}
              icon={
                issue.severity === 'error' ? (
                  <AlertCircle size={16} className="text-danger" />
                ) : (
                  <AlertTriangle size={16} className="text-warn" />
                )
              }
              title={issue.message}
              onClick={() => goToIssue(issue)}
            />
          ))
        )}
      </Sheet>

      <Sheet open={cheatSheetOpen} onClose={() => setCheatSheetOpen(false)} title="Keyboard shortcuts">
        {SHORTCUTS.map((s) => (
          <ListRow
            key={s.keys}
            title={s.desc}
            trailing={<span className="font-mono text-[.72rem] text-ink-faint">{s.keys}</span>}
          />
        ))}
      </Sheet>

      <Sheet open={coverageSheetOpen} onClose={() => setCoverageSheetOpen(false)} title="Coverage preview">
        <div className="space-y-3.5">
          <FormField label="Show preview">
            <div className="flex items-center justify-between">
              <span className="text-[.78rem] text-ink-soft">
                {selectedZone && isMowableType(selectedZone.type)
                  ? 'Visual only — never written to the map.'
                  : 'Select a mowing area first.'}
              </span>
              <Switch
                checked={coverage.enabled}
                onCheckedChange={(v) => updateCoverage({enabled: v})}
                disabled={!selectedZone || !isMowableType(selectedZone.type)}
                aria-label="Show coverage preview"
              />
            </div>
          </FormField>

          <FormField label="Tool width" value={coverage.toolWidthM.toFixed(2)} unit=" m">
            <Slider
              value={coverage.toolWidthM}
              min={0.1}
              max={0.6}
              step={0.01}
              onChange={(v) => updateCoverage({toolWidthM: v})}
              aria-label="Tool width"
            />
          </FormField>

          <FormField label="Outline laps" value={coverage.outlineLapCount} hint="Edge-first perimeter passes.">
            <div className="flex items-center gap-2">
              <Button
                variant="soft"
                size="icon"
                className="h-9 w-9"
                aria-label="Fewer outline laps"
                onClick={() => updateCoverage({outlineLapCount: Math.max(0, coverage.outlineLapCount - 1)})}
              >
                <Minus size={14} />
              </Button>
              <div className="flex-1 text-center font-mono text-sm tabular-nums text-ink">{coverage.outlineLapCount}</div>
              <Button
                variant="soft"
                size="icon"
                className="h-9 w-9"
                aria-label="More outline laps"
                onClick={() => updateCoverage({outlineLapCount: coverage.outlineLapCount + 1})}
              >
                <Plus size={14} />
              </Button>
            </div>
          </FormField>

          <FormField
            label="Fill angle offset"
            value={coverage.angleOffsetDeg}
            unit="°"
            hint={coverage.angleIsAbsolute ? 'Absolute direction.' : "Offset from the outline's auto-detected angle."}
          >
            <Slider
              value={coverage.angleOffsetDeg}
              min={-90}
              max={90}
              step={5}
              onChange={(v) => updateCoverage({angleOffsetDeg: v})}
              aria-label="Fill angle offset"
            />
          </FormField>

          <FormField label="Angle is absolute">
            <div className="flex items-center justify-between">
              <span className="text-[.72rem] text-ink-faint">Off = relative to the outline&apos;s own angle.</span>
              <Switch
                checked={coverage.angleIsAbsolute}
                onCheckedChange={(v) => updateCoverage({angleIsAbsolute: v})}
                aria-label="Angle offset is absolute"
              />
            </div>
          </FormField>
        </div>
      </Sheet>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={commandActions}
        placeholder="Run a command…"
      />
    </div>
  );
}
