'use client';

// Vanilla-Leaflet map for the run replay (ReplayCard) — a purpose-built, read-only sibling of
// map/MapCanvas.tsx: no editing/tool state, just a basemap, the real area outlines, the full
// driven-track polyline, and a moving playhead marker. Split into its own file so ReplayCard can
// dynamic-import it with { ssr: false } (Leaflet touches `window` at module load, same reason
// Map.tsx dynamic-imports MapCanvas).
import {metersToLatLng, type Origin} from '@/lib/v2/geo/projection';
import {resolveBasemap} from '@/components/v2/map/basemaps';
import {ZONE_STYLE, type Zone} from '@/components/v2/map/mockMap';
import type {TimedTrackPoint} from '@/hooks/useJobTimedTrack';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {useEffect, useRef} from 'react';

// Matches map/MapCanvas.tsx's TRACK_COLOR so the two apps read consistently.
const TRACK_COLOR = '#fbb03b';

export interface ReplayMapProps {
  origin: Origin;
  zones: Zone[];
  /** The run's full timed track (see useJobTimedTrack) — drawn as one polyline. */
  points: TimedTrackPoint[];
  /** Current playhead position in the same local metres, or null while there's no track/no
   *  sample yet (hides the marker entirely rather than parking it at a fabricated spot). */
  playheadPoint: {x: number; y: number} | null;
  /** Identifies the run being replayed — the map refits its view once whenever this changes
   *  (and valid bounds exist), never on every playhead tick. */
  fitKey: string;
  className?: string;
}

/** Purpose-built replay map: satellite basemap + real area outlines + driven track + playhead. */
export function ReplayMap({origin, zones, points, playheadPoint, fitKey, className}: ReplayMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const zoneLayerRef = useRef<L.FeatureGroup | null>(null);
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const playheadLayerRef = useRef<L.LayerGroup | null>(null);
  const playheadMarkerRef = useRef<L.CircleMarker | null>(null);
  const fittedKeyRef = useRef<string | null>(null);

  // ---- one-time map + layer-group creation -----------------------------------------------------
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    // Replay keeps the satellite basemap on purpose — geographic context (where the run happened)
    // suits a historical driven path, even though the live map now defaults to the Minimal canvas.
    const basemap = resolveBasemap('esri');
    // L.svg (not the default canvas) renderer with generous padding: the large real-area polygons
    // otherwise clip/twitch at the viewport edge during zoom — same fix as MapCanvas.
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: true,
      renderer: L.svg({padding: 2}),
    }).setView(metersToLatLng({x: 0, y: 0}, origin), 19);
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: 22,
      maxNativeZoom: basemap.maxNativeZoom ?? 18,
    }).addTo(map);

    zoneLayerRef.current = L.featureGroup().addTo(map);
    trackLayerRef.current = L.layerGroup().addTo(map);
    playheadLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      playheadMarkerRef.current = null;
      fittedKeyRef.current = null;
    };
    // Created once — origin only seeds the initial view here; later origin changes reproject the
    // already-drawn layers in their own effects below rather than recentering the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- real area outlines (read-only ground truth, not the mock zones) --------------------------
  useEffect(() => {
    const layer = zoneLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    zones.forEach((z) => {
      const style = ZONE_STYLE[z.type];
      L.polygon(
        z.outline.map((p) => metersToLatLng(p, origin)),
        {
          color: style.stroke,
          weight: 2,
          fillColor: style.fill,
          fillOpacity: z.type === 'obstacle' ? 0.28 : 0.14,
          interactive: false,
        },
      ).addTo(layer);
    });
  }, [zones, origin]);

  // ---- the full driven track, as one polyline ----------------------------------------------------
  useEffect(() => {
    const layer = trackLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (points.length < 2) return;
    L.polyline(
      points.map((p) => metersToLatLng(p, origin)),
      {color: TRACK_COLOR, weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false},
    ).addTo(layer);
  }, [points, origin]);

  // ---- moving playhead marker: updated in place (not recreated) so it doesn't flicker at 60fps --
  useEffect(() => {
    const layer = playheadLayerRef.current;
    if (!layer) return;
    if (!playheadPoint) {
      layer.clearLayers();
      playheadMarkerRef.current = null;
      return;
    }
    const latlng = metersToLatLng(playheadPoint, origin);
    if (!playheadMarkerRef.current) {
      playheadMarkerRef.current = L.circleMarker(latlng, {
        radius: 7,
        color: '#ffffff',
        weight: 2.5,
        fillColor: TRACK_COLOR,
        fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
    } else {
      playheadMarkerRef.current.setLatLng(latlng);
    }
  }, [playheadPoint, origin]);

  // ---- fit to the track's bounds once per run, falling back to the areas' bounds while the track
  // is empty/still loading -- never refits on a playhead tick, only when `fitKey` (the run) or the
  // available geometry changes, and only once bounds are actually valid. -------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedKeyRef.current === fitKey) return;
    const trackLatLngs = points.map((p) => metersToLatLng(p, origin));
    const zoneLatLngs = zones.flatMap((z) => z.outline.map((p) => metersToLatLng(p, origin)));
    const bounds = L.latLngBounds(trackLatLngs.length > 0 ? trackLatLngs : zoneLatLngs);
    if (!bounds.isValid()) return;
    map.fitBounds(bounds.pad(0.2), {maxZoom: 21});
    fittedKeyRef.current = fitKey;
  }, [fitKey, points, zones, origin]);

  return <div ref={elRef} className={className} aria-label="Run replay map" />;
}
