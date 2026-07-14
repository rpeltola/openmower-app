'use client';

import {useMap} from '@/contexts/MapContext';
import type {Datum} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute} from '@/utils/coordinates';
import {Box} from '@mui/material';
import {RMarker} from 'maplibre-react-components';
import {type ReactNode, useEffect, useMemo, useState} from 'react';

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

function metersToPixels(meters: number, zoom: number, latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  const metersPerPx = (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (256 * Math.pow(2, zoom));
  return meters / metersPerPx;
}

interface MapMarkerProps {
  /** Relative position in the mower coordinate system */
  position: {x: number; y: number};
  /** Heading in radians (same convention as pose.heading) */
  heading: number;
  /** Physical size of the marker in meters (used for zoom-based scaling) */
  sizeM: number;
  datum: Datum;
  className?: string;
  /** Floor for the rendered pixel size, so a to-scale marker never vanishes when zoomed far
   *  out (it stays a small but correctly-oriented glyph). */
  minSizePx?: number;
  /** Ceiling for the rendered pixel size, so it can't become absurdly huge when zoomed in. */
  maxSizePx?: number;
  children: (sizePx: number) => ReactNode;
}

export default function MapMarker({position, heading, sizeM, datum, className, minSizePx, maxSizePx, children}: MapMarkerProps) {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map?.getZoom() ?? 18);

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoom', onZoom);
    return () => {
      map.off('zoom', onZoom);
    };
  }, [map]);

  const absPosition = useMemo(() => {
    const {long, lat} = datum;
    const utmDatum = datumToRelative([long, lat]);
    return pointToAbsolute(position, utmDatum);
  }, [datum, position]);

  const sizePx = useMemo(() => {
    const lat = absPosition ? absPosition[1] : 0;
    const raw = metersToPixels(sizeM, zoom, lat);
    const clamped = Math.min(maxSizePx ?? Infinity, Math.max(minSizePx ?? 0, raw));
    return Math.round(clamped);
  }, [sizeM, zoom, absPosition, minSizePx, maxSizePx]);

  // Convert from mower heading (radians, 0 = east, CCW positive) to CSS rotation (degrees, 0 = north, CW positive)
  const headingDeg = 90 - (heading * 180) / Math.PI;

  // A position outside the datum's UTM range can't be placed on the map; skip it
  // rather than crashing (guards against stale/foreign-datum track/robot points).
  if (!absPosition) return null;

  // Rotate via maplibre's native marker `rotation` (a reactive option) instead of a CSS
  // transform on the child: RMarker only re-renders its DOM children when the marker's
  // lng/lat changes, so a CSS transform went stale during an in-place pivot (position
  // frozen, heading changing). `rotation` updates whenever the value changes, independent
  // of position -- so the arrow now turns while the robot pivots in place.
  return (
    <RMarker longitude={absPosition[0]} latitude={absPosition[1]} className={className} rotation={headingDeg}>
      <Box
        sx={{
          width: sizePx,
          height: sizePx,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children(sizePx)}
      </Box>
    </RMarker>
  );
}
