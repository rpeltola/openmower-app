// Registry of Leaflet raster basemaps for the v2 map. Esri World Imagery is the default
// (no key needed) but has no close-up imagery over rural Finland ("Map data not yet
// available" at zoom). MML's open orthophoto WMTS covers that gap for Finnish installs;
// see v1's src/components/map/basemaps.ts for the original resolution of this problem.

export interface Basemap {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxNativeZoom?: number;
}

// Finnish National Land Survey (Maanmittauslaitos) open WMTS. The WGS84_Pseudo-Mercator
// matrix set is plain EPSG:3857 XYZ, so it drops straight into a Leaflet tileLayer. Needs a
// free API key. ortokuva serves real tiles up to zoom 18 (measured: z14-18 → JPEG, z19+ → 404);
// maxNativeZoom:18 uses those sharpest native tiles and only overzooms past 18.
const MML_API_KEY = process.env.NEXT_PUBLIC_MOWER_MML_API_KEY ?? '';

export const BASEMAPS: Basemap[] = [
  {
    id: 'esri',
    label: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri, Maxar, Earthstar Geographics',
    // Over rural Finland Esri serves a "Map data not yet available" PLACEHOLDER tile (a 200, not
    // a 404) from z19 up (measured at the garden datum: z13-18 real imagery, z19+ the identical
    // 2521-byte placeholder). Cap native tiles at 18 so Leaflet overzooms the last REAL imagery
    // (blurry but true) past z18 instead of painting the "no data" placeholder.
    maxNativeZoom: 18,
  },
  {
    id: 'mml-ortokuva',
    label: 'MML Orthophoto (Finland)',
    url: `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/ortokuva/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.jpg?api-key=${MML_API_KEY}`,
    attribution: '&copy; Maanmittauslaitos',
    maxNativeZoom: 18,
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
];

export const DEFAULT_BASEMAP_ID = 'esri';

export function resolveBasemap(id: string | undefined): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS.find((b) => b.id === DEFAULT_BASEMAP_ID)!;
}
