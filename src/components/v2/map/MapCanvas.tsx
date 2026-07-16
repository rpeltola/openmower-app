'use client';

// Vanilla-Leaflet map canvas (no react-leaflet) — imperative layer/tool control via refs, mirroring
// the RevLaw editor's mapController so the editing features port cleanly. Client-only; the page
// loads it with next/dynamic { ssr:false } so Leaflet never runs during SSR.
import {footprintPolygon, headingNose, metersToLatLng, type Footprint, type Origin, type Pose} from '@/lib/v2/geo/projection';
import {MOCK_DOCK, MOCK_FOOTPRINT, MOCK_ORIGIN, MOCK_POSE, MOCK_ZONES, ZONE_STYLE, type Zone} from '@/components/v2/map/mockMap';
import {DEFAULT_BASEMAP_ID, resolveBasemap} from '@/components/v2/map/basemaps';
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
}: MapCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {zoomControl: false, attributionControl: true}).setView(
      metersToLatLng({x: 0, y: 0}, origin),
      19,
    );
    mapRef.current = map;
    map.attributionControl.setPrefix(false);

    const geo = L.featureGroup().addTo(map);

    // zones (fixed colors, theme-independent)
    for (const z of zones) {
      const s = ZONE_STYLE[z.type];
      L.polygon(
        z.outline.map((p) => metersToLatLng(p, origin)),
        {color: s.stroke, weight: 2, fillColor: s.fill, fillOpacity: z.type === 'obstacle' ? 0.28 : 0.14},
      )
        .bindTooltip(z.name, {direction: 'center', className: 'v2-map-label'})
        .addTo(geo);
    }

    // docking station
    L.circleMarker(metersToLatLng(dock.position, origin), {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#5aa9ff',
      fillOpacity: 1,
    })
      .bindTooltip('Dock', {direction: 'top', className: 'v2-map-label'})
      .addTo(geo);

    // to-scale robot footprint + heading nose
    const robot = L.layerGroup().addTo(map);
    L.polygon(footprintPolygon(pose, footprint, origin), {
      color: '#0b1f16',
      weight: 1.5,
      fillColor: '#F26A1B',
      fillOpacity: 0.95,
    }).addTo(robot);
    L.polyline(headingNose(pose, footprint, origin), {color: '#0b1f16', weight: 2.5}).addTo(robot);

    map.fitBounds(geo.getBounds(), {padding: [40, 40], maxZoom: 20});
    onReady?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [origin, zones, dock, pose, footprint]);

  // Swap the tile layer in place when the basemap changes, without recreating the map
  // (keeps zoom/pan/overlays intact).
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

  return <div ref={elRef} className={className} aria-label="Garden map" />;
}
