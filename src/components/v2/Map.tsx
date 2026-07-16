'use client';

// Map screen — the map is the hero (full-bleed), UI floats over it in pills / FABs / a stat card
// (design-language.md "The map is the hero"). Real Leaflet canvas underneath; concept chrome on top.
// Map-editor port: edit mode, zone selection, vertex tools, zone create/transform, undo/redo
// (batches 1-3 of MAP_EDITOR_SPEC.md), plus the real per-area settings editor (AREA_SETTINGS_SPEC.md,
// AreaSettingsSheet.tsx). The "Choose zone" Sheet below is just the quick zone switcher now —
// selecting a zone (there, or by tapping it on the map) opens the settings editor.
import {latLngToMeters, metersToLatLng, type Meters, type Pose} from '@/lib/v2/geo/projection';
import {AreaSettingsSheet} from '@/components/v2/map/AreaSettingsSheet';
import {BASEMAPS, DEFAULT_BASEMAP_ID} from '@/components/v2/map/basemaps';
import {coverageLines, outlineLaps} from '@/components/v2/map/coverage';
import {polygonArea, polygonPerimeter, principalAngleDeg} from '@/components/v2/map/geometry';
import {estimateMowPreview, measureZone} from '@/components/v2/map/measurements';
import {RecordBriefingSheet} from '@/components/v2/map/record/RecordBriefingSheet';
import {RecordCloseSheet} from '@/components/v2/map/record/RecordCloseSheet';
import {RecordDriveOverlay, type RecordSpeed} from '@/components/v2/map/record/RecordDriveOverlay';
import {
  GLOBAL_DEFAULTS,
  isMowableType,
  MOCK_DOCK,
  MOCK_ORIGIN,
  MOCK_ZONES,
  ZONE_TYPE_LABELS,
  type Zone,
  type ZoneType,
} from '@/components/v2/map/mockMap';
import {useMapEditor, TOOL_SHORTCUT_KEYS, type EditTool, type OpResult} from '@/components/v2/map/useMapEditor';
import {validateMap, type MapIssue} from '@/components/v2/map/validation';
import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Chip} from '@/components/v2/ui/Chip';
import {CommandPalette, type CommandPaletteAction} from '@/components/v2/ui/CommandPalette';
import {Fab} from '@/components/v2/ui/Fab';
import {FormField} from '@/components/v2/ui/FormField';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {ListRow} from '@/components/v2/ui/ListRow';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Slider} from '@/components/v2/ui/Slider';
import {StatCard} from '@/components/v2/ui/StatCard';
import {StatePill} from '@/components/v2/ui/StatePill';
import {StatRow} from '@/components/v2/ui/StatRow';
import {Switch} from '@/components/v2/ui/Switch';
import {Toast} from '@/components/v2/ui/Toast';
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
  Footprints,
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
  ScissorsLineDashed,
  Shrink,
  Signpost,
  Sliders,
  Spline,
  Square,
  SquareDashedMousePointer,
  SquarePlus,
  SquaresSubtract,
  SquaresUnite,
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
// 'record' (S8) isn't a Zone type either — it opens the record-a-boundary flow (R1) instead of an
// instant square-at-center.
const ADD_TO_MAP_ITEMS: {type: ZoneType | 'dock' | 'record'; label: string; sub: string; icon: ReactNode; sizeM?: number}[] = [
  {type: 'mow', label: ZONE_TYPE_LABELS.mow, sub: 'An area the mower covers', icon: <SquarePlus size={18} />, sizeM: 6},
  {type: 'obstacle', label: ZONE_TYPE_LABELS.obstacle, sub: 'Excluded from mowing', icon: <Ban size={18} />, sizeM: 3},
  {type: 'dock', label: 'Docking station', sub: 'Move the charging dock', icon: <Home size={18} />},
  {type: 'spot', label: ZONE_TYPE_LABELS.spot, sub: 'A one-off mow patch', icon: <Target size={18} />, sizeM: 2},
  {type: 'nav', label: ZONE_TYPE_LABELS.nav, sub: 'A route between areas, not mowed', icon: <Signpost size={18} />, sizeM: 6},
  {type: 'record', label: 'Record a boundary', sub: 'Walk the edge with the mower', icon: <Footprints size={18} />},
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
  // S8 — boundary-recording journey (R1 briefing -> R2 drive-the-edge -> R3 close & name). The
  // drive simulation (recordPose/recordDirection) is the one place in the app where the shared
  // Joystick primitive actually moves anything — everywhere else it's decorative (ManualControl.tsx)
  // since there's no real drive backend yet, but a live trace with nothing moving would defeat the
  // point of this specific screen, so it gets a small mock physics loop (see the effect below).
  const [recordStep, setRecordStep] = useState<'r1' | 'r2' | 'r3' | null>(null);
  const [recordPoints, setRecordPoints] = useState<Meters[]>([]);
  const [recordMarks, setRecordMarks] = useState<Meters[]>([]);
  const [recordPose, setRecordPose] = useState<Pose>({x: 0, y: 0, heading: 0});
  const [recordDirection, setRecordDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  const [recordSpeed, setRecordSpeed] = useState<RecordSpeed>('normal');
  const [recordType, setRecordType] = useState<ZoneType>('mow');
  // Boolean area operations (MAP_BOOLEAN_OPS_SPEC.md) — merge/split/subtract live in the Transform
  // sheet's "Area operations" section rather than a new tool-row icon or dock row.
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [mergePickIds, setMergePickIds] = useState<Set<string>>(new Set());
  const [subtractPickerOpen, setSubtractPickerOpen] = useState(false);
  const [subtractPickIds, setSubtractPickIds] = useState<Set<string>>(new Set());
  const [subtractKeepOthers, setSubtractKeepOthers] = useState(true);
  const [cutLinePoints, setCutLinePoints] = useState<Meters[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  // Shared by toggleEditing (exiting edit mode) and onPreviewPlan (S7 jumps straight to the live
  // map to show the plan) — otherwise one left open (e.g. area settings) would still render its
  // persistent desktop panel over the live view, at the same spot the S4 "Areas" panel occupies.
  const closeAllEditSheets = () => {
    setAreaSettingsOpen(false);
    setTransformSheetOpen(false);
    setCoverageSheetOpen(false);
    setZoneSheetOpen(false);
    setIssuesSheetOpen(false);
    setAddObjectSheetOpen(false);
    setMergePickerOpen(false);
    setSubtractPickerOpen(false);
    setCutLinePoints([]);
  };

  const toggleEditing = () => {
    const next = !editor.editing;
    editor.setEditing(next);
    if (!next) closeAllEditSheets();
  };

  // --- Boolean area operations (MAP_BOOLEAN_OPS_SPEC.md) --------------------------------------
  const showOpResult = (result: OpResult, failureFallback: string) => {
    if (!result.ok) setToastMessage(result.reason ?? failureFallback);
  };

  const openMergePicker = () => {
    setMergePickIds(new Set());
    setMergePickerOpen(true);
  };

  const openSubtractPicker = () => {
    setSubtractPickIds(new Set());
    setSubtractKeepOthers(true);
    setSubtractPickerOpen(true);
  };

  const startSplitDraw = () => {
    // Split-draw needs both the map's editing-gated click handling and the contextual Finish/
    // Cancel controls in the edit dock — force edit mode on so it works even when Split is run
    // from the command palette in live view.
    editor.setEditing(true);
    setTransformSheetOpen(false);
    setCutLinePoints([]);
    editor.setTool('split');
  };

  const cancelSplitDraw = () => {
    setCutLinePoints([]);
    editor.setTool('select');
  };

  const finishSplitDraw = () => {
    if (!selectedZone) return;
    const result = editor.splitZone(selectedZone.id, cutLinePoints);
    setCutLinePoints([]);
    editor.setTool('select');
    showOpResult(result, 'Could not split this area.');
  };

  const toggleMergePick = (id: string) =>
    setMergePickIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSubtractPick = (id: string) =>
    setSubtractPickIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmMerge = () => {
    if (!selectedZone) return;
    const result = editor.mergeZones(selectedZone.id, Array.from(mergePickIds));
    setMergePickerOpen(false);
    showOpResult(result, 'Could not merge these areas.');
  };

  const confirmSubtract = () => {
    if (!selectedZone) return;
    const result = editor.subtractZones(selectedZone.id, Array.from(subtractPickIds), subtractKeepOthers);
    setSubtractPickerOpen(false);
    showOpResult(result, 'Could not subtract these areas.');
  };

  // --- S8 boundary recording -----------------------------------------------------------------
  const startRecordBoundary = () => {
    setAddObjectSheetOpen(false);
    setRecordStep('r1');
  };

  const drawOnMapInstead = () => {
    setRecordStep(null);
    editor.setEditing(true);
    setAddObjectSheetOpen(true);
  };

  const beginDriving = () => {
    // "Mower on the lawn, near the edge" — seed the trace from the dock, a plausible edge-adjacent
    // starting point, facing east.
    const start = {x: MOCK_DOCK.position.x, y: MOCK_DOCK.position.y};
    setRecordPoints([start]);
    setRecordMarks([]);
    setRecordType('mow');
    setRecordPose({x: start.x, y: start.y, heading: 0});
    setRecordDirection(null);
    recordDistSinceLastPointRef.current = 0;
    editor.setEditing(false);
    closeAllEditSheets();
    closePlanPreview();
    setMockBlocked(false);
    setRecordStep('r2');
  };

  const cancelRecording = () => {
    setRecordStep(null);
    setRecordPoints([]);
    setRecordMarks([]);
    setRecordDirection(null);
  };

  const markNoGo = () => setRecordMarks((m) => [...m, {x: recordPose.x, y: recordPose.y}]);
  const undoRecordPoint = () => setRecordPoints((pts) => (pts.length > 1 ? pts.slice(0, -1) : pts));
  const closeRecordLoop = () => setRecordStep('r3');

  const saveRecording = (name: string, fineTune: boolean) => {
    // Name it in the SAME createZone commit — a separate renameZone call right after would close
    // over the pre-create `zones` snapshot (no re-render in between) and silently drop the new
    // zone, since its `.map` wouldn't find the just-created id in that stale array.
    const id = editor.createZone(recordPoints, recordType, name);
    setRecordStep(null);
    setRecordPoints([]);
    setRecordMarks([]);
    if (fineTune) {
      editor.setEditing(true);
      editor.setTool('select');
    } else {
      openZoneSettings(id);
    }
  };

  // Mock drive-the-edge physics: while a Joystick direction is held, up/down translate at the
  // chosen speed and left/right rotate in place (a d-pad, not an analog stick — matches what the
  // shared Joystick primitive actually reports). A new trace point is appended every ~0.35m
  // traveled; the map recenters on the mower each time. Speeds are well above real mow speed
  // (0.15-0.35 m/s) — driving this by hand at real mow speed would feel unresponsive.
  const recordPoseRef = useRef(recordPose);
  recordPoseRef.current = recordPose;
  const recordDirectionRef = useRef(recordDirection);
  recordDirectionRef.current = recordDirection;
  const recordSpeedRef = useRef(recordSpeed);
  recordSpeedRef.current = recordSpeed;
  const recordDistSinceLastPointRef = useRef(0);

  useEffect(() => {
    if (recordStep !== 'r2') return;
    const TURN_RATE_RAD_S = Math.PI / 2;
    const RECORD_STEP_M = 0.35;
    const SPEED_MPS: Record<RecordSpeed, number> = {slow: 0.5, normal: 0.9, fast: 1.5};
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dir = recordDirectionRef.current;
      if (dir) {
        const pose = recordPoseRef.current;
        if (dir === 'left' || dir === 'right') {
          const turn = (dir === 'left' ? 1 : -1) * TURN_RATE_RAD_S * dt;
          setRecordPose({...pose, heading: pose.heading + turn});
        } else {
          const sign = dir === 'up' ? 1 : -1;
          const speedMps = SPEED_MPS[recordSpeedRef.current];
          const dx = Math.cos(pose.heading) * speedMps * dt * sign;
          const dy = Math.sin(pose.heading) * speedMps * dt * sign;
          const next = {x: pose.x + dx, y: pose.y + dy, heading: pose.heading};
          setRecordPose(next);
          recordDistSinceLastPointRef.current += Math.hypot(dx, dy);
          if (recordDistSinceLastPointRef.current >= RECORD_STEP_M) {
            recordDistSinceLastPointRef.current = 0;
            setRecordPoints((pts) => [...pts, {x: next.x, y: next.y}]);
            mapRef.current?.panTo(metersToLatLng(next, MOCK_ORIGIN), {animate: false});
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recordStep]);

  const recordAreaM2 = polygonArea(recordPoints);
  const recordPerimeterM = polygonPerimeter(recordPoints);

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

  // S7 — plan preview: the full animated coverage route for a zone, entered from the area-
  // settings "Preview" button. Its own lifecycle, separate from the edit-mode coverage-preview
  // above (that one's tied to the localStorage-remembered `coverage` settings) — reuses the same
  // route generator and the same MapCanvas `coveragePreview` prop, just fed a progressively larger
  // slice for the "draw-on" animation.
  const [planPreviewZoneId, setPlanPreviewZoneId] = useState<string | null>(null);
  const [planPreviewProgress, setPlanPreviewProgress] = useState(0);
  const planPreviewZone = editor.zones.find((z) => z.id === planPreviewZoneId);

  const onPreviewPlan = (zone: Zone) => {
    editor.setEditing(false);
    closeAllEditSheets();
    setPlanPreviewZoneId(zone.id);
  };

  const closePlanPreview = () => setPlanPreviewZoneId(null);

  const startThisPlan = () => {
    if (planPreviewZoneId) setActiveMowZoneId(planPreviewZoneId);
    closePlanPreview();
  };

  useEffect(() => {
    if (!planPreviewZoneId) return;
    setPlanPreviewProgress(0);
    const durationMs = 1400;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      setPlanPreviewProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [planPreviewZoneId]);

  const planPreviewFull = useMemo(() => {
    if (!planPreviewZone) return null;
    const obstacles = editor.zones.filter((z) => z.type === 'obstacle' && z.outline.length >= 3).map((z) => z.outline);
    const angleDeg =
      planPreviewZone.settings?.angle !== undefined
        ? (planPreviewZone.settings.angle * 180) / Math.PI
        : principalAngleDeg(planPreviewZone.outline);
    const outlineCount = planPreviewZone.settings?.outline_count ?? GLOBAL_DEFAULTS.outline_count;
    return {
      outlineLaps: outlineLaps(planPreviewZone.outline, outlineCount, MOWED_LANE_SPACING_M),
      fillSegments: coverageLines(planPreviewZone.outline, obstacles, MOWED_LANE_SPACING_M, angleDeg),
    };
  }, [planPreviewZone, editor.zones]);

  // The "draw-on" reveal: a growing prefix of laps/segments, animated by planPreviewProgress above.
  const planPreviewRevealed = useMemo(() => {
    if (!planPreviewFull) return null;
    const lapCount = Math.ceil(planPreviewFull.outlineLaps.length * planPreviewProgress);
    const segCount = Math.round(planPreviewFull.fillSegments.length * planPreviewProgress);
    return {
      outlineLaps: planPreviewFull.outlineLaps.slice(0, lapCount),
      fillSegments: planPreviewFull.fillSegments.slice(0, segCount),
    };
  }, [planPreviewFull, planPreviewProgress]);

  const planPreviewEstimate = planPreviewZone ? estimateMowPreview(planPreviewZone) : null;

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
    {id: 'record-boundary', label: 'Record a boundary…', icon: <Footprints size={15} />, onRun: () => setRecordStep('r1')},
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
    {
      id: 'merge',
      label: 'Merge…',
      icon: <SquaresUnite size={15} />,
      disabled: !selectedZone || editor.zones.length < 2,
      onRun: openMergePicker,
    },
    {
      id: 'split',
      label: 'Split',
      icon: <ScissorsLineDashed size={15} />,
      disabled: !selectedZone,
      onRun: startSplitDraw,
    },
    {
      id: 'subtract',
      label: 'Subtract…',
      icon: <SquaresSubtract size={15} />,
      disabled: !selectedZone || editor.zones.length < 2,
      onRun: openSubtractPicker,
    },
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
        coveragePreview={planPreviewZoneId ? planPreviewRevealed : coveragePreviewData}
        mowedLanes={mowedLanesData}
        robotAccuracyM={mockBlocked ? 1.4 : 0.35}
        robotBlocked={mockBlocked}
        recording={recordStep === 'r2' ? {points: recordPoints, pose: recordPose, marks: recordMarks} : null}
        cutLine={editor.tool === 'split' ? cutLinePoints : null}
        onAddCutLinePoint={(p) => setCutLinePoints((pts) => [...pts, p])}
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

      {/* map FABs — in live view the desktop S4 "Areas" panel occupies the same right-3/top-16
          corner and would intercept these clicks (incl. Edit), so shift the column left of the
          300px panel on md+ when not editing; in edit mode the panel is gone, keep it at the edge. */}
      <div className={`absolute right-3 top-16 z-[520] flex flex-col gap-2 ${editor.editing ? '' : 'md:right-[336px]'}`}>
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
        <div className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[380px]">
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

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            {editor.tool === 'split' && (
              <div className="mt-2.5 space-y-2">
                <div className="text-[.72rem] text-ink-faint">
                  Tap the map to draw a cut line across the area — {cutLinePoints.length} point
                  {cutLinePoints.length === 1 ? '' : 's'}.
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={cancelSplitDraw}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={cutLinePoints.length < 2}
                    onClick={finishSplitDraw}
                  >
                    <ScissorsLineDashed size={14} /> Finish split
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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

      {/* S7 — plan preview: the route draws on over ~1.4s (planPreviewProgress), then holds. Sits
          above the normal chrome (z-900) since it takes over the screen — onPreviewPlan already
          exited edit mode + closed every sheet, so the only thing underneath is the live-view
          stat card, which this covers at the same position (not hidden, just painted over). */}
      {planPreviewZone && planPreviewEstimate && (
        <>
          <div className="absolute inset-x-3 top-3 z-[900] flex items-center gap-2">
            <OverlayChip>
              <Route size={12} className="text-accent" /> Plan preview · {planPreviewZone.name}
            </OverlayChip>
            <Button
              variant="soft"
              size="icon"
              className="ml-auto h-9 w-9"
              aria-label="Close preview"
              onClick={closePlanPreview}
            >
              <X size={16} />
            </Button>
          </div>
          <StatCard className="absolute inset-x-3 bottom-3 z-[900] md:left-3 md:right-auto md:w-[320px]">
            <div className="grid grid-cols-3 gap-2">
              <KpiTile value={planPreviewEstimate.minutes} unit=" min" label="Est. time" />
              <KpiTile value={planPreviewEstimate.areaM2.toFixed(0)} unit=" m²" label="Area" />
              <KpiTile value={planPreviewEstimate.passes} label="Passes" />
            </div>
            <Button variant="primary" className="mt-2.5 w-full justify-center" onClick={startThisPlan}>
              <Play size={14} fill="currentColor" /> Start this plan
            </Button>
          </StatCard>
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
            onClick={() => {
              if (item.type === 'dock') addDockStation();
              else if (item.type === 'record') startRecordBoundary();
              else addObjectAtCenter(item.type, item.sizeM);
            }}
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
        onPreviewPlan={onPreviewPlan}
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

            <div className="h-px bg-border" />

            <FormField label="Area operations" hint="Combine this area with, cut a line through, or subtract other areas.">
              <div className="flex items-center gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  className="flex-1"
                  disabled={editor.zones.length < 2}
                  onClick={openMergePicker}
                >
                  <SquaresUnite size={14} /> Merge…
                </Button>
                <Button variant="soft" size="sm" className="flex-1" onClick={startSplitDraw}>
                  <ScissorsLineDashed size={14} /> Split
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  className="flex-1"
                  disabled={editor.zones.length < 2}
                  onClick={openSubtractPicker}
                >
                  <SquaresSubtract size={14} /> Subtract…
                </Button>
              </div>
            </FormField>
          </div>
        )}
      </Sheet>

      <Sheet
        open={mergePickerOpen}
        onClose={() => setMergePickerOpen(false)}
        title={selectedZone ? `Merge into ${selectedZone.name}` : 'Merge'}
      >
        <div className="space-y-2.5">
          <div className="text-[.76rem] text-ink-soft">Pick the areas to merge in — their outline joins the target.</div>
          <div className="space-y-0.5">
            {editor.zones
              .filter((z) => z.id !== selectedZone?.id)
              .map((z) => (
                <ListRow
                  key={z.id}
                  title={z.name}
                  sub={ZONE_TYPE_LABELS[z.type]}
                  onClick={() => toggleMergePick(z.id)}
                  trailing={mergePickIds.has(z.id) ? <Check size={17} className="text-accent" /> : undefined}
                />
              ))}
          </div>
          <Button variant="primary" className="w-full justify-center" disabled={mergePickIds.size === 0} onClick={confirmMerge}>
            <SquaresUnite size={14} /> Merge {mergePickIds.size > 0 ? `(${mergePickIds.size + 1} areas)` : ''}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={subtractPickerOpen}
        onClose={() => setSubtractPickerOpen(false)}
        title={selectedZone ? `Subtract from ${selectedZone.name}` : 'Subtract'}
      >
        <div className="space-y-2.5">
          <div className="text-[.76rem] text-ink-soft">Pick the areas to cut out of the target.</div>
          <div className="space-y-0.5">
            {editor.zones
              .filter((z) => z.id !== selectedZone?.id)
              .map((z) => (
                <ListRow
                  key={z.id}
                  title={z.name}
                  sub={ZONE_TYPE_LABELS[z.type]}
                  onClick={() => toggleSubtractPick(z.id)}
                  trailing={subtractPickIds.has(z.id) ? <Check size={17} className="text-accent" /> : undefined}
                />
              ))}
          </div>
          <FormField label="Keep the other areas">
            <div className="flex items-center justify-between">
              <span className="text-[.72rem] text-ink-faint">Off deletes the cutter areas after subtracting.</span>
              <Switch checked={subtractKeepOthers} onCheckedChange={setSubtractKeepOthers} aria-label="Keep the other areas" />
            </div>
          </FormField>
          <Button
            variant="primary"
            className="w-full justify-center"
            disabled={subtractPickIds.size === 0}
            onClick={confirmSubtract}
          >
            <SquaresSubtract size={14} /> Subtract
          </Button>
        </div>
      </Sheet>

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />

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

      {/* S8 — boundary recording (R1 briefing, R2 drive-the-edge, R3 close & name). R2 renders
          above the normal chrome (z-900, like the plan preview) since it takes over the map;
          beginDriving() already exited edit mode + closed every sheet before it opens. */}
      <RecordBriefingSheet
        open={recordStep === 'r1'}
        onClose={() => setRecordStep(null)}
        onStart={beginDriving}
        onDrawOnMapInstead={drawOnMapInstead}
      />

      {recordStep === 'r2' && (
        <RecordDriveOverlay
          pointCount={recordPoints.length}
          areaM2={recordAreaM2}
          perimeterM={recordPerimeterM}
          speed={recordSpeed}
          onSpeedChange={setRecordSpeed}
          onDirectionChange={setRecordDirection}
          onMarkNoGo={markNoGo}
          onUndo={undoRecordPoint}
          canUndo={recordPoints.length > 1}
          onCloseLoop={closeRecordLoop}
          canCloseLoop={recordPoints.length >= 3}
          onCancel={cancelRecording}
        />
      )}

      <RecordCloseSheet
        open={recordStep === 'r3'}
        onClose={() => setRecordStep(null)}
        areaM2={recordAreaM2}
        perimeterM={recordPerimeterM}
        pointCount={recordPoints.length}
        type={recordType}
        onTypeChange={setRecordType}
        defaultName={`New ${ZONE_TYPE_LABELS[recordType].toLowerCase()}`}
        onSave={saveRecording}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={commandActions}
        placeholder="Run a command…"
      />
    </div>
  );
}
