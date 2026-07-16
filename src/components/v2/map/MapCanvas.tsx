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
  type Origin,
  type Pose,
} from '@/lib/v2/geo/projection';
import {nearestEdgeInsertIndex} from '@/components/v2/map/geometry';
import {MOCK_DOCK, MOCK_FOOTPRINT, MOCK_ORIGIN, MOCK_POSE, MOCK_ZONES, ZONE_STYLE, type Zone} from '@/components/v2/map/mockMap';
import {DEFAULT_BASEMAP_ID, resolveBasemap} from '@/components/v2/map/basemaps';
import type {EditTool, SelectedVertex} from '@/components/v2/map/useMapEditor';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {useEffect, useRef} from 'react';

export interface MapCanvasProps {
  origin?: Origin;
  zones?: Zone[];
  dock?: {position: {x: number; y: number}};
  pose?: Pose;
  footprint?: Footprint;
  className?: string;
  /** Basemap registry id (see map/basemaps.ts). Defaults to Esri World Imagery. */
  basemapId?: string;
  /** Called once with the Leaflet map so the screen can wire its own controls (zoom/locate FABs). */
  onReady?: (map: L.Map) => void;

  /** Vertex-editing (batch 1 of the map-editor port) — all optional, off by default. */
  editing?: boolean;
  selectedZoneId?: string | null;
  selectedVertex?: SelectedVertex | null;
  tool?: EditTool;
  /** Fires with the whole updated zones array on every committed edit (drag-end, insert, delete). */
  onZonesChange?: (zones: Zone[]) => void;
  onSelectVertex?: (vertex: SelectedVertex | null) => void;
  onSelectZone?: (id: string) => void;
}

// Vertex-handle colors are fixed (not theme-dependent), same rule as the zone colors — they must
// read on satellite imagery regardless of the app's light/dark chrome.
const HANDLE_FILL = '#ffffff';
const HANDLE_STROKE = '#111827';
const HANDLE_SELECTED = '#22d3ee';

// Vertex-handle icon. Kept out of the marker-creation effect's deps so changing which vertex is
// selected only restyles handles (setIcon) instead of recreating them — recreating mid-drag would
// destroy the marker being dragged and kill the gesture.
function makeHandleIcon(selected: boolean) {
  const size = selected ? 16 : 12;
  const fill = selected ? HANDLE_SELECTED : HANDLE_FILL;
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:2px solid ${HANDLE_STROKE};box-shadow:0 1px 3px rgba(0,0,0,.45);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
  onZonesChange,
  onSelectVertex,
  onSelectZone,
}: MapCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const zoneLayerRef = useRef<L.FeatureGroup | null>(null);
  const handleLayerRef = useRef<L.LayerGroup | null>(null);
  const dockLayerRef = useRef<L.LayerGroup | null>(null);
  const robotLayerRef = useRef<L.LayerGroup | null>(null);
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
  const onZonesChangeRef = useRef(onZonesChange);
  onZonesChangeRef.current = onZonesChange;
  const onSelectVertexRef = useRef(onSelectVertex);
  onSelectVertexRef.current = onSelectVertex;

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

    // "Add" tool: a map click inserts a vertex on the selected zone's nearest edge. "Select" tool:
    // clicking empty map (not a vertex handle — those stop propagation) clears the selection.
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!editingRef.current) return;
      const point = latLngToMeters(e.latlng, originRef.current);
      if (toolRef.current === 'add') {
        const zoneId = selectedZoneIdRef.current;
        if (!zoneId) return;
        const zone = zonesRef.current.find((z) => z.id === zoneId);
        if (!zone || zone.outline.length < 2) return;
        const idx = nearestEdgeInsertIndex(zone.outline, point);
        const outline = [...zone.outline.slice(0, idx), point, ...zone.outline.slice(idx)];
        onZonesChangeRef.current?.(zonesRef.current.map((z) => (z.id === zoneId ? {...z, outline} : z)));
        onSelectVertexRef.current?.({zoneId, index: idx});
      } else if (toolRef.current === 'select') {
        onSelectVertexRef.current?.(null);
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
    if (!editing || !selectedZoneId) return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return;

    zone.outline.forEach((point, index) => {
      const marker = L.marker(metersToLatLng(point, origin), {
        // Only draggable in the select tool — add/delete use plain clicks on the map/handle.
        draggable: tool === 'select',
        // In the add tool, handles must not intercept the click meant for the map's nearest-edge insert.
        interactive: tool !== 'add',
        icon: makeHandleIcon(false),
        zIndexOffset: 900,
        title: `Vertex ${index + 1}`,
      }).addTo(handleLayer);
      handleMarkersRef.current.push(marker);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (toolRef.current === 'delete') {
          const currentZones = zonesRef.current;
          const current = currentZones.find((z) => z.id === zone.id);
          if (!current || current.outline.length <= 3) return; // keep a valid polygon (>= 3 points)
          const outline = current.outline.filter((_, i) => i !== index);
          onZonesChangeRef.current?.(currentZones.map((z) => (z.id === zone.id ? {...z, outline} : z)));
          onSelectVertexRef.current?.(null);
          return;
        }
        onSelectVertexRef.current?.({zoneId: zone.id, index});
      });

      marker.on('dragstart', () => {
        onSelectVertexRef.current?.({zoneId: zone.id, index});
      });

      // Live-redraw the polygon as the handle moves, without touching React state (that would
      // spam the undo history) — the moved point is committed once, on dragend.
      marker.on('drag', () => {
        const polygon = zonePolygonsRef.current.get(zone.id);
        const current = zonesRef.current.find((z) => z.id === zone.id);
        if (!polygon || !current) return;
        const movedPoint = latLngToMeters(marker.getLatLng(), originRef.current);
        const liveOutline = current.outline.map((p, i) => (i === index ? movedPoint : p));
        polygon.setLatLngs(liveOutline.map((p) => metersToLatLng(p, originRef.current)));
      });

      marker.on('dragend', () => {
        const currentZones = zonesRef.current;
        const current = currentZones.find((z) => z.id === zone.id);
        if (!current) return;
        const movedPoint = latLngToMeters(marker.getLatLng(), originRef.current);
        const outline = current.outline.map((p, i) => (i === index ? movedPoint : p));
        onZonesChangeRef.current?.(currentZones.map((z) => (z.id === zone.id ? {...z, outline} : z)));
      });
    });
    // selectedVertex intentionally excluded — selection is a restyle-only concern (effect below),
    // never a recreate, so dragging a handle isn't torn down mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, origin, editing, selectedZoneId, tool, onSelectZone]);

  // ---- selected-vertex highlight: restyle existing handles in place (no recreation) -------------
  useEffect(() => {
    handleMarkersRef.current.forEach((marker, index) => {
      const selected =
        editing && selectedVertex?.zoneId === selectedZoneId && selectedVertex.index === index;
      marker.setIcon(makeHandleIcon(selected));
    });
  }, [selectedVertex, selectedZoneId, editing]);

  // ---- dock marker (imperative update, independent of zone/edit state) --------------------------
  useEffect(() => {
    const dockLayer = dockLayerRef.current;
    if (!mapRef.current || !dockLayer) return;
    dockLayer.clearLayers();
    L.circleMarker(metersToLatLng(dock.position, origin), {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#5aa9ff',
      fillOpacity: 1,
    })
      .bindTooltip('Dock', {direction: 'top', className: 'v2-map-label'})
      .addTo(dockLayer);
  }, [dock, origin]);

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
