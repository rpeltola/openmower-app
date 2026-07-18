'use client';

// Live follow-cam Leaflet map for the cockpit's main viewport — a vanilla-Leaflet sibling of
// activity/ReplayMap.tsx (same one-time L.map() + imperative layer-group pattern) but reading
// the mower's LIVE position/heading straight from the store (like MiniMap) instead of a
// pre-recorded track, and recentering on the robot every tick so it reads as a follow-cam. Split
// into its own file so MainViewport can dynamic-import it with { ssr: false }.
import {boundingBox} from '@/components/v2/map/geometry';
import {resolveBasemap, DEFAULT_BASEMAP_ID} from '@/components/v2/map/basemaps';
import {mapDataToDock, mapDataToZones} from '@/components/v2/map/realData';
import {MOCK_ORIGIN, ZONE_STYLE, type Zone} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {cn} from '@/components/v2/lib/cn';
import {metersToLatLng, type Meters, type Origin} from '@/lib/v2/geo/projection';
import {useSelectedMower} from '@/stores/mowersStore';
import {LocateFixed} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {useEffect, useMemo, useRef, useState} from 'react';

export interface LiveFollowMapProps {
  chipLabel?: string;
  className?: string;
}

// A close follow-cam zoom -- roughly a lane or two of the garden visible around the robot,
// definitely closer than a whole-garden fit. Leaflet's own tile/native-zoom clamping (see
// basemaps.ts) still applies on top of this.
const DEFAULT_ZOOM = 20;

/** projection.ts's yaw (radians CCW from +x/east) -> the on-screen rotation degrees for the
 *  marker's CSS `rotate()` -- matches MiniMap's SVG rotation formula exactly. */
function rotationFromHeading(headingRad: number): number {
  return 90 - headingRad * (180 / Math.PI);
}

function robotDivIcon(rotationDeg: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div style="width:32px;height:32px;transform:rotate(${rotationDeg}deg);transform-origin:50% 50%;">` +
      `<svg viewBox="-16 -16 32 32" width="32" height="32">` +
      `<rect x="-10" y="-10" width="20" height="20" rx="6" fill="var(--accent-bright)" />` +
      `<path d="M0 -16 L5 -10 L-5 -10 Z" fill="var(--accent)" />` +
      `</svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const DOCK_ICON = L.divIcon({
  className: '',
  html:
    `<svg viewBox="-8 -6 16 12" width="16" height="12">` +
    `<rect x="-8" y="-6" width="16" height="12" rx="3" fill="var(--dock)" />` +
    `</svg>`,
  iconSize: [16, 12],
  iconAnchor: [8, 6],
});

/** Live follow-cam map: the real garden outlines + dock (like MiniMap) plus the live robot pose,
 *  as a real Leaflet map so it gets native pinch-to-zoom -- but recentered on the robot on every
 *  pose tick (preserving whatever zoom the user is at) so it reads as a follow-cam, not a static
 *  viewport. A user pan pauses the follow (resume via the corner reset button); zooming never
 *  does. */
export function LiveFollowMap({chipLabel, className}: LiveFollowMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const zoneLayerRef = useRef<L.FeatureGroup | null>(null);
  const dockLayerRef = useRef<L.LayerGroup | null>(null);
  const dockMarkerRef = useRef<L.Marker | null>(null);
  const robotLayerRef = useRef<L.LayerGroup | null>(null);
  const robotMarkerRef = useRef<L.Marker | null>(null);
  const accuracyLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const [follow, setFollow] = useState(true);

  const realMap = useSelectedMower((s) => s?.map);
  const zones = useMemo<Zone[]>(() => (realMap ? mapDataToZones(realMap) : []), [realMap]);
  const dock = useMemo(() => (realMap ? mapDataToDock(realMap) : undefined), [realMap]);
  const datumLat = realMap?.datum?.lat;
  const datumLng = realMap?.datum?.long;
  const origin: Origin = useMemo(
    () => (datumLat !== undefined && datumLng !== undefined ? {lat: datumLat, lng: datumLng} : MOCK_ORIGIN),
    [datumLat, datumLng],
  );

  const currentState = useSelectedMower((s) => s?.state.current_state);
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);
  const isDocked = currentState === 'DOCKED' || isCharging;
  const robotPositionBase = useSelectedMower((s) => s?.position ?? s?.state.pose);
  const robotLiveHeading = useSelectedMower((s) => (s?.state.pose?.heading_valid ? s.state.pose.heading : undefined));
  const accuracyM = useSelectedMower((s) => s?.state.sensors?.gps?.position_accuracy);

  const showRobot = Boolean(robotPositionBase) && !isDocked;
  const heading = robotLiveHeading ?? robotPositionBase?.heading ?? 0;
  const robotLatLng = showRobot && robotPositionBase ? metersToLatLng({x: robotPositionBase.x, y: robotPositionBase.y}, origin) : null;

  // Best-guess center for the very first paint, before any live pose has arrived: the dock, else
  // the garden's own bounds, else the origin itself. Only read once (mount) -- later moves are
  // driven by the pose-follow effect below, not by this fallback.
  const initialCenterRef = useRef<[number, number] | null>(null);
  if (initialCenterRef.current === null) {
    const zonePoints: Meters[] = zones.flatMap((z) => z.outline);
    const bbox = boundingBox(zonePoints);
    if (dock) initialCenterRef.current = metersToLatLng(dock.position, origin);
    else if (bbox) initialCenterRef.current = metersToLatLng({x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2}, origin);
    else initialCenterRef.current = metersToLatLng({x: 0, y: 0}, origin);
  }

  // ---- one-time map + layer-group creation -----------------------------------------------------
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    // Matches the live editor map's own default (map/basemaps.ts DEFAULT_BASEMAP_ID) so the
    // cockpit's follow-cam reads consistently with the map screen the driver just came from.
    const basemap = resolveBasemap(DEFAULT_BASEMAP_ID);
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: Boolean(basemap.url),
      renderer: L.svg({padding: 2}),
    }).setView(initialCenterRef.current!, DEFAULT_ZOOM);
    mapRef.current = map;
    if (basemap.url) {
      map.attributionControl.setPrefix(false);
      L.tileLayer(basemap.url, {
        attribution: basemap.attribution,
        maxZoom: 24,
        maxNativeZoom: basemap.maxNativeZoom ?? 19,
      }).addTo(map);
    } else {
      // "Minimal" basemap — no tiles, plain theme-aware canvas (see MapCanvas.tsx's identical
      // fallback for the editor map).
      map.getContainer().style.background = 'var(--surface-2)';
    }

    zoneLayerRef.current = L.featureGroup().addTo(map);
    dockLayerRef.current = L.layerGroup().addTo(map);
    robotLayerRef.current = L.layerGroup().addTo(map);
    accuracyLayerRef.current = L.layerGroup().addTo(map);

    // A real user drag pauses follow so they can look around; programmatic setView() (our own
    // recenters below) never fires 'dragstart', so this only ever sees genuine user pans. Zoom
    // (including pinch) is deliberately NOT wired here -- follow must survive a zoom.
    map.on('dragstart', () => setFollow(false));

    return () => {
      map.remove();
      mapRef.current = null;
      dockMarkerRef.current = null;
      robotMarkerRef.current = null;
      accuracyCircleRef.current = null;
    };
    // Created once -- origin/zones/dock only seed the initial view via initialCenterRef; every
    // later update happens in the imperative effects below, not by recreating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- container resize (cockpit toggles fullscreen/layouts) -----------------------------------
  useEffect(() => {
    const el = elRef.current;
    const map = mapRef.current;
    if (!el || !map) return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    // Also fix up the size after the first paint, in case the container's final size wasn't
    // settled yet when the map was created (e.g. inside a flex layout).
    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // ---- real area outlines (same styling as ReplayMap's satellite mini-map) ----------------------
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

  // ---- dock marker ------------------------------------------------------------------------------
  useEffect(() => {
    const layer = dockLayerRef.current;
    if (!layer) return;
    if (!dock) {
      layer.clearLayers();
      dockMarkerRef.current = null;
      return;
    }
    const latlng = metersToLatLng(dock.position, origin);
    if (!dockMarkerRef.current) {
      dockMarkerRef.current = L.marker(latlng, {icon: DOCK_ICON, interactive: false}).addTo(layer);
    } else {
      dockMarkerRef.current.setLatLng(latlng);
    }
  }, [dock, origin]);

  // ---- robot marker: updated in place (latlng + rotated icon) so it doesn't flicker -------------
  useEffect(() => {
    const layer = robotLayerRef.current;
    if (!layer) return;
    if (!robotLatLng) {
      layer.clearLayers();
      robotMarkerRef.current = null;
      return;
    }
    const icon = robotDivIcon(rotationFromHeading(heading));
    if (!robotMarkerRef.current) {
      robotMarkerRef.current = L.marker(robotLatLng, {icon, interactive: false}).addTo(layer);
    } else {
      robotMarkerRef.current.setLatLng(robotLatLng);
      robotMarkerRef.current.setIcon(icon);
    }
  }, [robotLatLng, heading]);

  // ---- accuracy ring: only ever drawn from a real sensors.gps.position_accuracy reading, never
  // a fabricated radius (R1, same rule as MiniMap). --------------------------------------------
  useEffect(() => {
    const layer = accuracyLayerRef.current;
    if (!layer) return;
    if (!robotLatLng || typeof accuracyM !== 'number') {
      layer.clearLayers();
      accuracyCircleRef.current = null;
      return;
    }
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(robotLatLng, {
        radius: accuracyM,
        color: 'var(--accent)',
        weight: 1.5,
        dashArray: '3 4',
        fillColor: 'var(--accent)',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(layer);
    } else {
      accuracyCircleRef.current.setLatLng(robotLatLng);
      accuracyCircleRef.current.setRadius(accuracyM);
    }
  }, [robotLatLng, accuracyM]);

  // ---- the core follow behavior: recenter on every pose tick while `follow` is on, PRESERVING
  // the user's current zoom so a mid-track pinch-zoom doesn't get reset (only a pan does, via
  // the dragstart handler above). ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !robotLatLng) return;
    map.setView(robotLatLng, map.getZoom(), {animate: false});
  }, [robotLatLng, follow]);

  function handleReset() {
    setFollow(true);
    const map = mapRef.current;
    if (!map) return;
    map.setView(robotLatLng ?? initialCenterRef.current!, DEFAULT_ZOOM, {animate: true});
  }

  return (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-card)]', className)}>
      <div ref={elRef} className="absolute inset-0 h-full w-full" aria-label="Live mower map" />
      {chipLabel ? (
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur"
          style={{background: 'color-mix(in srgb, var(--surface) 82%, transparent)'}}
        >
          ● {chipLabel}
        </span>
      ) : null}
      <Button
        variant="soft"
        size="icon"
        onClick={handleReset}
        aria-label="Recenter on mower"
        // Bottom-LEFT, not bottom-right: MainViewport puts its camera/map PiP swap thumbnail at
        // bottom-right whenever this is the main view of a camera-equipped mower, and the two
        // must not overlap.
        className="absolute bottom-3 left-3 h-10 w-10 bg-surface/70 backdrop-blur-sm hover:bg-surface/90"
      >
        <LocateFixed size={18} strokeWidth={2.4} />
      </Button>
    </div>
  );
}
