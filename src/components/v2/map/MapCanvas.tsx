'use client';

// Vanilla-Leaflet map canvas (no react-leaflet) — imperative layer/tool control via refs, mirroring
// the RevLaw editor's mapController so the editing features port cleanly. Client-only; the page
// loads it with next/dynamic { ssr:false } so Leaflet never runs during SSR.
//
// The map itself is created exactly once (empty-deps effect) and never torn down on prop changes —
// zones/dock/robot are separate layer groups updated imperatively, so dragging a vertex (which
// changes `zones` on every frame) never resets pan/zoom or recreates Leaflet layers wholesale.
import {
  footprintPolygon,
  headingNose,
  latLngToMeters,
  metersToLatLng,
  type Footprint,
  type Meters,
  type Origin,
  type Pose,
} from '@/lib/v2/geo/projection';
import {centroid, circleToPolygon, dragBrush, nearestEdgeInsertIndex, rectangleCorners} from '@/components/v2/map/geometry';
import {
  MOCK_DOCK,
  MOCK_FOOTPRINT,
  MOCK_ORIGIN,
  MOCK_POSE,
  MOCK_ZONES,
  ZONE_STYLE,
  type Dock,
  type Zone,
} from '@/components/v2/map/mockMap';
import {DEFAULT_BASEMAP_ID, resolveBasemap} from '@/components/v2/map/basemaps';
import type {EditTool, SelectedVertex} from '@/components/v2/map/useMapEditor';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {useEffect, useRef} from 'react';

export interface MapCanvasProps {
  origin?: Origin;
  zones?: Zone[];
  dock?: Dock;
  pose?: Pose;
  footprint?: Footprint;
  className?: string;
  /** Basemap registry id (see map/basemaps.ts). Defaults to Esri World Imagery. */
  basemapId?: string;
  /** Called once with the Leaflet map so the screen can wire its own controls (zoom/locate FABs). */
  onReady?: (map: L.Map) => void;

  /** Vertex-editing (map-editor port) — all optional, off by default. */
  editing?: boolean;
  selectedZoneId?: string | null;
  selectedVertex?: SelectedVertex | null;
  tool?: EditTool;
  /** Vertex picked as the snap-line start (tool 'snap'), highlighted while the second pick is pending. */
  snapPick?: SelectedVertex | null;
  /** Vertex indices (within the selected zone) picked by the multi-select tool. */
  multiSelected?: Set<number>;
  /** Push/smear brush radius (m) and follow-strength (0..1) — contextual sliders in the tool dock. */
  brushRadius?: number;
  brushStrength?: number;
  /** True while a "place dock" action is armed — the next map click moves the dock there,
   *  regardless of the current vertex tool. */
  placingDock?: boolean;
  /** Fires with the whole updated zones array on every committed edit (drag-end, insert, delete). */
  onZonesChange?: (zones: Zone[]) => void;
  onSelectVertex?: (vertex: SelectedVertex | null) => void;
  onSelectZone?: (id: string) => void;
  onPickSnapVertex?: (vertex: SelectedVertex) => void;
  onToggleMultiVertex?: (index: number) => void;
  onSetMultiSelected?: (indices: number[]) => void;
  /** Fires with a finished outline from the rectangle/circle draw tools. */
  onCreateZone?: (outline: Zone['outline']) => void;
  /** Fires on dock drag-end, and on a map click while `placingDock` is armed. */
  onDockChange?: (dock: Dock) => void;
}

// Vertex-handle colors are fixed (not theme-dependent), same rule as the zone colors — they must
// read on satellite imagery regardless of the app's light/dark chrome.
const HANDLE_FILL = '#ffffff';
const HANDLE_STROKE = '#111827';
const HANDLE_SELECTED = '#22d3ee';

// Vertex-handle icon. Kept out of the marker-creation effect's deps so changing which vertex is
// selected/picked only restyles handles (setIcon) instead of recreating them — recreating mid-drag
// would destroy the marker being dragged and kill the gesture.
const EMPTY_SET: Set<number> = new Set();

function makeHandleIcon(highlighted: boolean) {
  const size = highlighted ? 16 : 12;
  const fill = highlighted ? HANDLE_SELECTED : HANDLE_FILL;
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:2px solid ${HANDLE_STROKE};box-shadow:0 1px 3px rgba(0,0,0,.45);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Move-whole-zone (tool 'move') centroid handle — a diamond, distinct from the round vertex
// handles, so it reads as "drag to translate the whole shape" rather than "edit this vertex".
const MOVE_HANDLE_COLOR = '#ffb020';
function makeMoveIcon() {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:18px;height:18px;border-radius:5px;background:${MOVE_HANDLE_COLOR};border:2px solid ${HANDLE_STROKE};box-shadow:0 1px 3px rgba(0,0,0,.45);transform:rotate(45deg);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// Dock marker icon — a filled circle matching the old circleMarker look, but an L.marker (not a
// vector layer) so it can be dragged.
function makeDockIcon() {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:#5aa9ff;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,.45);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function MapCanvas({
  origin = MOCK_ORIGIN,
  zones = MOCK_ZONES,
  dock = MOCK_DOCK,
  pose = MOCK_POSE,
  footprint = MOCK_FOOTPRINT,
  className,
  basemapId = DEFAULT_BASEMAP_ID,
  onReady,
  editing = false,
  selectedZoneId = null,
  selectedVertex = null,
  tool = 'select',
  snapPick = null,
  multiSelected = EMPTY_SET,
  brushRadius = 1.2,
  brushStrength = 0.6,
  placingDock = false,
  onZonesChange,
  onSelectVertex,
  onSelectZone,
  onPickSnapVertex,
  onToggleMultiVertex,
  onSetMultiSelected,
  onCreateZone,
  onDockChange,
}: MapCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const zoneLayerRef = useRef<L.FeatureGroup | null>(null);
  const handleLayerRef = useRef<L.LayerGroup | null>(null);
  const dockLayerRef = useRef<L.LayerGroup | null>(null);
  const robotLayerRef = useRef<L.LayerGroup | null>(null);
  const brushCursorRef = useRef<L.Circle | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const zonePolygonsRef = useRef<Map<string, L.Polygon>>(new Map());
  const handleMarkersRef = useRef<L.Marker[]>([]);
  const fittedRef = useRef(false);

  // Latest props mirrored into refs so imperative Leaflet handlers (bound once, in the map-creation
  // effect) always read current values without needing to be re-bound on every render.
  const originRef = useRef(origin);
  originRef.current = origin;
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const selectedZoneIdRef = useRef(selectedZoneId);
  selectedZoneIdRef.current = selectedZoneId;
  const multiSelectedRef = useRef(multiSelected);
  multiSelectedRef.current = multiSelected;
  const brushRadiusRef = useRef(brushRadius);
  brushRadiusRef.current = brushRadius;
  const brushStrengthRef = useRef(brushStrength);
  brushStrengthRef.current = brushStrength;
  const onZonesChangeRef = useRef(onZonesChange);
  onZonesChangeRef.current = onZonesChange;
  const onSelectVertexRef = useRef(onSelectVertex);
  onSelectVertexRef.current = onSelectVertex;
  const onPickSnapVertexRef = useRef(onPickSnapVertex);
  onPickSnapVertexRef.current = onPickSnapVertex;
  const onToggleMultiVertexRef = useRef(onToggleMultiVertex);
  onToggleMultiVertexRef.current = onToggleMultiVertex;
  const onSetMultiSelectedRef = useRef(onSetMultiSelected);
  onSetMultiSelectedRef.current = onSetMultiSelected;
  const onCreateZoneRef = useRef(onCreateZone);
  onCreateZoneRef.current = onCreateZone;
  const onDockChangeRef = useRef(onDockChange);
  onDockChangeRef.current = onDockChange;
  const placingDockRef = useRef(placingDock);
  placingDockRef.current = placingDock;

  // ---- one-time map + layer-group creation -----------------------------------------------------
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {zoomControl: false, attributionControl: true}).setView(
      metersToLatLng({x: 0, y: 0}, origin),
      19,
    );
    mapRef.current = map;
    map.attributionControl.setPrefix(false);

    zoneLayerRef.current = L.featureGroup().addTo(map);
    handleLayerRef.current = L.layerGroup().addTo(map);
    dockLayerRef.current = L.layerGroup().addTo(map);
    robotLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    brushCursorRef.current = L.circle(map.getCenter(), {
      radius: brushRadiusRef.current,
      color: HANDLE_SELECTED,
      weight: 1.5,
      fillColor: HANDLE_SELECTED,
      fillOpacity: 0.08,
      interactive: false,
    });

    // Push/smear brush drag-paint state (tool 'brush') — lives here (not React state) so every
    // pointer move can restyle the polygon live without spamming the undo history; committed once
    // on pointer-up. Box-select state (tool 'multi', Shift+drag) similarly lives here.
    let brushDragging = false;
    let brushLast: Meters | null = null;
    let brushWorkingOutline: Meters[] | null = null;
    let brushZoneId: string | null = null;

    let boxStart: L.Point | null = null;
    let boxSelectDiv: HTMLDivElement | null = null;

    // Rectangle/circle draw-by-drag (tools 'rect'/'circle') — a dashed preview shape that follows
    // the drag, finished into a new zone outline on pointer-up.
    let draftStart: Meters | null = null;
    let draftShape: L.Polygon | L.Circle | null = null;

    // "Place dock" (armed via `placingDock`) takes priority over any tool: the next map click
    // moves the dock there and does NOT fall through to the tool's own click behavior. "Add"
    // tool: a map click inserts a vertex on the selected zone's nearest edge. "Select"/"multi"
    // tools: clicking empty map (not a vertex handle — those stop propagation) clears the current
    // selection.
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!editingRef.current) return;
      const point = latLngToMeters(e.latlng, originRef.current);
      if (placingDockRef.current) {
        onDockChangeRef.current?.({position: point});
        return;
      }
      const currentTool = toolRef.current;
      if (currentTool === 'add') {
        const zoneId = selectedZoneIdRef.current;
        if (!zoneId) return;
        const zone = zonesRef.current.find((z) => z.id === zoneId);
        if (!zone || zone.outline.length < 2) return;
        const idx = nearestEdgeInsertIndex(zone.outline, point);
        const outline = [...zone.outline.slice(0, idx), point, ...zone.outline.slice(idx)];
        onZonesChangeRef.current?.(zonesRef.current.map((z) => (z.id === zoneId ? {...z, outline} : z)));
        onSelectVertexRef.current?.({zoneId, index: idx});
      } else if (currentTool === 'select') {
        onSelectVertexRef.current?.(null);
      } else if (currentTool === 'multi') {
        onSetMultiSelectedRef.current?.([]);
      }
    });

    map.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!editingRef.current) return;
      const currentTool = toolRef.current;

      if (currentTool === 'multi' && e.originalEvent.shiftKey) {
        map.dragging.disable();
        boxStart = e.containerPoint;
        boxSelectDiv = document.createElement('div');
        Object.assign(boxSelectDiv.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          width: '0',
          height: '0',
          border: `1.5px dashed ${HANDLE_SELECTED}`,
          background: 'rgba(34,211,238,.15)',
          pointerEvents: 'none',
          zIndex: '650',
        });
        map.getContainer().appendChild(boxSelectDiv);
        return;
      }

      if (currentTool === 'brush') {
        const zoneId = selectedZoneIdRef.current;
        const zone = zoneId ? zonesRef.current.find((z) => z.id === zoneId) : null;
        if (!zone) return;
        brushDragging = true;
        brushZoneId = zoneId;
        brushWorkingOutline = zone.outline.map((p) => ({x: p.x, y: p.y}));
        brushLast = latLngToMeters(e.latlng, originRef.current);
        return;
      }

      if (currentTool === 'rect' || currentTool === 'circle') {
        draftStart = latLngToMeters(e.latlng, originRef.current);
        draftShape =
          currentTool === 'circle'
            ? L.circle(e.latlng, {
                radius: 0.05,
                color: HANDLE_SELECTED,
                weight: 2,
                dashArray: '4,4',
                fillColor: HANDLE_SELECTED,
                fillOpacity: 0.08,
              }).addTo(draftLayerRef.current!)
            : L.polygon([e.latlng, e.latlng, e.latlng, e.latlng], {
                color: HANDLE_SELECTED,
                weight: 2,
                dashArray: '4,4',
                fillColor: HANDLE_SELECTED,
                fillOpacity: 0.08,
              }).addTo(draftLayerRef.current!);
      }
    });

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (editingRef.current && toolRef.current === 'brush') {
        brushCursorRef.current?.setLatLng(e.latlng);
        brushCursorRef.current?.setRadius(brushRadiusRef.current);
      }

      if (boxStart && boxSelectDiv) {
        const cur = e.containerPoint;
        const x = Math.min(boxStart.x, cur.x);
        const y = Math.min(boxStart.y, cur.y);
        Object.assign(boxSelectDiv.style, {
          left: `${x}px`,
          top: `${y}px`,
          width: `${Math.abs(cur.x - boxStart.x)}px`,
          height: `${Math.abs(cur.y - boxStart.y)}px`,
        });
        return;
      }

      if (brushDragging && brushWorkingOutline && brushZoneId) {
        const point = latLngToMeters(e.latlng, originRef.current);
        const last = brushLast ?? point;
        const delta = {x: point.x - last.x, y: point.y - last.y};
        const {points} = dragBrush(brushWorkingOutline, point, delta, brushRadiusRef.current, brushStrengthRef.current);
        brushWorkingOutline = points;
        brushLast = point;
        const polygon = zonePolygonsRef.current.get(brushZoneId);
        polygon?.setLatLngs(brushWorkingOutline.map((p) => metersToLatLng(p, originRef.current)));
        return;
      }

      if (draftStart && draftShape) {
        const cur = latLngToMeters(e.latlng, originRef.current);
        if (toolRef.current === 'circle') {
          const radius = Math.max(Math.hypot(cur.x - draftStart.x, cur.y - draftStart.y), 0.05);
          (draftShape as L.Circle).setRadius(radius);
        } else {
          const corners = rectangleCorners(draftStart, cur);
          (draftShape as L.Polygon).setLatLngs(corners.map((p) => metersToLatLng(p, originRef.current)));
        }
      }
    });

    map.on('mouseup', (e: L.LeafletMouseEvent) => {
      if (boxStart && boxSelectDiv) {
        const cur = e.containerPoint;
        const m1 = latLngToMeters(map.containerPointToLatLng(boxStart), originRef.current);
        const m2 = latLngToMeters(map.containerPointToLatLng(cur), originRef.current);
        const minX = Math.min(m1.x, m2.x);
        const maxX = Math.max(m1.x, m2.x);
        const minY = Math.min(m1.y, m2.y);
        const maxY = Math.max(m1.y, m2.y);
        const zoneId = selectedZoneIdRef.current;
        const zone = zoneId ? zonesRef.current.find((z) => z.id === zoneId) : null;
        if (zone) {
          const picked: number[] = [];
          zone.outline.forEach((p, i) => {
            if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) picked.push(i);
          });
          onSetMultiSelectedRef.current?.(picked);
        }
        boxSelectDiv.remove();
        boxSelectDiv = null;
        boxStart = null;
        map.dragging.enable();
        return;
      }

      if (brushDragging && brushWorkingOutline && brushZoneId) {
        const zoneId = brushZoneId;
        const outline = brushWorkingOutline;
        onZonesChangeRef.current?.(zonesRef.current.map((z) => (z.id === zoneId ? {...z, outline} : z)));
      }
      brushDragging = false;
      brushWorkingOutline = null;
      brushZoneId = null;
      brushLast = null;

      if (draftStart && draftShape) {
        const cur = latLngToMeters(e.latlng, originRef.current);
        if (toolRef.current === 'circle') {
          const radius = Math.hypot(cur.x - draftStart.x, cur.y - draftStart.y);
          if (radius > 0.2) onCreateZoneRef.current?.(circleToPolygon(draftStart, Math.max(radius, 0.3)));
        } else {
          const w = Math.abs(cur.x - draftStart.x);
          const h = Math.abs(cur.y - draftStart.y);
          if (w > 0.2 && h > 0.2) onCreateZoneRef.current?.(rectangleCorners(draftStart, cur));
        }
        draftShape.remove();
        draftShape = null;
        draftStart = null;
      }
    });

    onReady?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
    // Intentionally created once — see the imperative layer-group effects below for prop updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- basemap tiles (swap in place, no map recreation) ----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const basemap = resolveBasemap(basemapId);
    tileLayerRef.current?.remove();
    tileLayerRef.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: 22,
      maxNativeZoom: basemap.maxNativeZoom ?? 19,
    }).addTo(map);
  }, [basemapId]);

  // ---- brush tool: disable map panning (drag = paint) while active + show/hide cursor circle ----
  useEffect(() => {
    const map = mapRef.current;
    const cursor = brushCursorRef.current;
    if (!map || !cursor) return;
    if (editing && tool === 'brush') {
      map.dragging.disable();
      cursor.addTo(map);
    } else {
      map.dragging.enable();
      cursor.remove();
    }
  }, [editing, tool]);

  // ---- zones + (in edit mode) draggable vertex handles for the selected zone -------------------
  useEffect(() => {
    const map = mapRef.current;
    const zoneLayer = zoneLayerRef.current;
    const handleLayer = handleLayerRef.current;
    if (!map || !zoneLayer || !handleLayer) return;

    zoneLayer.clearLayers();
    handleLayer.clearLayers();
    const polyByZone = new Map<string, L.Polygon>();

    for (const z of zones) {
      const style = ZONE_STYLE[z.type];
      const isSelected = editing && z.id === selectedZoneId;
      const polygon = L.polygon(
        z.outline.map((p) => metersToLatLng(p, origin)),
        {
          color: style.stroke,
          weight: isSelected ? 3 : 2,
          fillColor: style.fill,
          fillOpacity: z.type === 'obstacle' ? 0.28 : 0.14,
        },
      )
        .bindTooltip(z.name, {direction: 'center', className: 'v2-map-label'})
        .addTo(zoneLayer);
      // In edit mode, tapping a zone's fill/outline selects it as the zone being edited.
      if (editing) {
        polygon.on('click', () => onSelectZone?.(z.id));
      }
      polyByZone.set(z.id, polygon);
    }
    zonePolygonsRef.current = polyByZone;

    if (!fittedRef.current) {
      const bounds = zoneLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), {maxZoom: 20});
        fittedRef.current = true;
      }
    }

    handleMarkersRef.current = [];
    // The brush tool works on the whole outline via drag-paint, and rect/circle draw independent
    // new shapes — none of them need individual vertex handles, so hide them (brush especially
    // must not have handles intercepting its map-level pointer events).
    if (!editing || !selectedZoneId || tool === 'brush' || tool === 'rect' || tool === 'circle') return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return;

    // Move-whole-zone (tool 'move'): a single centroid handle translates every vertex together —
    // no per-vertex handles in this tool.
    if (tool === 'move') {
      const center = centroid(zone.outline);
      if (!center) return;
      const marker = L.marker(metersToLatLng(center, origin), {
        draggable: true,
        icon: makeMoveIcon(),
        zIndexOffset: 950,
        title: 'Move zone',
      }).addTo(handleLayer);
      handleMarkersRef.current.push(marker);

      let startOutline: Meters[] | null = null;
      let startPoint: Meters | null = null;
      marker.on('dragstart', () => {
        const current = zonesRef.current.find((z) => z.id === zone.id);
        if (!current) return;
        startOutline = current.outline.map((p) => ({x: p.x, y: p.y}));
        startPoint = latLngToMeters(marker.getLatLng(), originRef.current);
      });
      marker.on('drag', () => {
        const polygon = zonePolygonsRef.current.get(zone.id);
        if (!polygon || !startOutline || !startPoint) return;
        const cur = latLngToMeters(marker.getLatLng(), originRef.current);
        const dx = cur.x - startPoint.x;
        const dy = cur.y - startPoint.y;
        const liveOutline = startOutline.map((p) => ({x: p.x + dx, y: p.y + dy}));
        polygon.setLatLngs(liveOutline.map((p) => metersToLatLng(p, originRef.current)));
      });
      marker.on('dragend', () => {
        const currentZones = zonesRef.current;
        const current = currentZones.find((z) => z.id === zone.id);
        if (!current || !startOutline || !startPoint) return;
        const cur = latLngToMeters(marker.getLatLng(), originRef.current);
        const dx = cur.x - startPoint.x;
        const dy = cur.y - startPoint.y;
        const outline = startOutline.map((p) => ({x: p.x + dx, y: p.y + dy}));
        onZonesChangeRef.current?.(currentZones.map((z) => (z.id === zone.id ? {...z, outline} : z)));
        startOutline = null;
        startPoint = null;
      });
      return;
    }

    zone.outline.forEach((point, index) => {
      // 'select' and 'multi' drag vertices directly (multi may drag the whole selected group —
      // see dragstart below); 'add'/'delete'/'snap' use plain clicks only.
      const draggable = tool === 'select' || tool === 'multi';
      const marker = L.marker(metersToLatLng(point, origin), {
        draggable,
        // In the add tool, handles must not intercept the click meant for the map's nearest-edge insert.
        interactive: tool !== 'add',
        icon: makeHandleIcon(false),
        zIndexOffset: 900,
        title: `Vertex ${index + 1}`,
      }).addTo(handleLayer);
      handleMarkersRef.current.push(marker);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const currentTool = toolRef.current;
        if (currentTool === 'delete') {
          const currentZones = zonesRef.current;
          const current = currentZones.find((z) => z.id === zone.id);
          if (!current || current.outline.length <= 3) return; // keep a valid polygon (>= 3 points)
          const outline = current.outline.filter((_, i) => i !== index);
          onZonesChangeRef.current?.(currentZones.map((z) => (z.id === zone.id ? {...z, outline} : z)));
          onSelectVertexRef.current?.(null);
          return;
        }
        if (currentTool === 'snap') {
          onPickSnapVertexRef.current?.({zoneId: zone.id, index});
          return;
        }
        if (currentTool === 'multi') {
          onToggleMultiVertexRef.current?.(index);
          return;
        }
        onSelectVertexRef.current?.({zoneId: zone.id, index});
      });

      // NOTE: do NOT select/pick the vertex on 'dragstart'. Doing so mutates React state, which
      // fires the restyle effect below → `marker.setIcon(...)` → Leaflet's `_initIcon` →
      // `_initInteraction`, which does `this.dragging.disable(); this.dragging = new MarkerDrag(...)`
      // — tearing down the drag handler mid-gesture and killing the drag on the first move. A
      // vertex is selected/picked/toggled by a plain click (handler above); dragging only moves it.

      // Group drag (multi tool): if this handle is part of the current multi-selection, the whole
      // set translates together by the same delta; otherwise (or in the select tool) only this
      // vertex moves. Captured at dragstart so `drag` only needs to apply a running delta.
      let groupIndices: number[] = [index];
      let groupStartOutline: Meters[] | null = null;
      let groupStartPoint: Meters | null = null;

      marker.on('dragstart', () => {
        const current = zonesRef.current.find((z) => z.id === zone.id);
        if (!current) return;
        groupIndices =
          toolRef.current === 'multi' && multiSelectedRef.current.has(index)
            ? Array.from(multiSelectedRef.current)
            : [index];
        groupStartOutline = current.outline.map((p) => ({x: p.x, y: p.y}));
        groupStartPoint = latLngToMeters(marker.getLatLng(), originRef.current);
      });

      // Live-redraw the polygon as the handle(s) move, without touching React state (that would
      // spam the undo history) — the moved point(s) are committed once, on dragend.
      marker.on('drag', () => {
        const polygon = zonePolygonsRef.current.get(zone.id);
        if (!polygon || !groupStartOutline || !groupStartPoint) return;
        const movedPoint = latLngToMeters(marker.getLatLng(), originRef.current);
        const dx = movedPoint.x - groupStartPoint.x;
        const dy = movedPoint.y - groupStartPoint.y;
        const liveOutline = groupStartOutline.map((p, i) =>
          groupIndices.includes(i) ? {x: p.x + dx, y: p.y + dy} : p,
        );
        polygon.setLatLngs(liveOutline.map((p) => metersToLatLng(p, originRef.current)));
      });

      marker.on('dragend', () => {
        const currentZones = zonesRef.current;
        const current = currentZones.find((z) => z.id === zone.id);
        if (!current || !groupStartOutline || !groupStartPoint) return;
        const movedPoint = latLngToMeters(marker.getLatLng(), originRef.current);
        const dx = movedPoint.x - groupStartPoint.x;
        const dy = movedPoint.y - groupStartPoint.y;
        const outline = groupStartOutline.map((p, i) => (groupIndices.includes(i) ? {x: p.x + dx, y: p.y + dy} : p));
        onZonesChangeRef.current?.(currentZones.map((z) => (z.id === zone.id ? {...z, outline} : z)));
        groupStartOutline = null;
        groupStartPoint = null;
      });
    });
    // selectedVertex/snapPick/multiSelected intentionally excluded — selection is a restyle-only
    // concern (effect below), never a recreate, so dragging a handle isn't torn down mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, origin, editing, selectedZoneId, tool, onSelectZone]);

  // ---- selected/picked-vertex highlight: restyle existing handles in place (no recreation) ------
  useEffect(() => {
    handleMarkersRef.current.forEach((marker, index) => {
      const highlighted =
        editing &&
        ((tool === 'select' && selectedVertex?.zoneId === selectedZoneId && selectedVertex.index === index) ||
          (tool === 'snap' && snapPick?.zoneId === selectedZoneId && snapPick.index === index) ||
          (tool === 'multi' && multiSelected.has(index)));
      marker.setIcon(makeHandleIcon(highlighted));
    });
  }, [selectedVertex, snapPick, multiSelected, selectedZoneId, editing, tool]);

  // ---- dock marker: draggable while editing (place-by-click also lands here via onDockChange) ---
  useEffect(() => {
    const dockLayer = dockLayerRef.current;
    if (!mapRef.current || !dockLayer) return;
    dockLayer.clearLayers();
    const marker = L.marker(metersToLatLng(dock.position, origin), {
      draggable: editing,
      icon: makeDockIcon(),
      zIndexOffset: 800,
    })
      .bindTooltip('Dock', {direction: 'top', className: 'v2-map-label'})
      .addTo(dockLayer);
    marker.on('dragend', () => {
      onDockChangeRef.current?.({position: latLngToMeters(marker.getLatLng(), originRef.current)});
    });
  }, [dock, origin, editing]);

  // ---- to-scale robot footprint + heading nose (imperative update) ------------------------------
  useEffect(() => {
    const robotLayer = robotLayerRef.current;
    if (!mapRef.current || !robotLayer) return;
    robotLayer.clearLayers();
    L.polygon(footprintPolygon(pose, footprint, origin), {
      color: '#0b1f16',
      weight: 1.5,
      fillColor: '#F26A1B',
      fillOpacity: 0.95,
    }).addTo(robotLayer);
    L.polyline(headingNose(pose, footprint, origin), {color: '#0b1f16', weight: 2.5}).addTo(robotLayer);
  }, [pose, footprint, origin]);

  return <div ref={elRef} className={className} aria-label="Garden map" />;
}
