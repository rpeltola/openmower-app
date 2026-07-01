'use client';

import {parseTileKey, type CoverageLayerState} from '@/stores/coverageLayerStore';
import {useSelectedMower} from '@/stores/mowersStore';
import type {Coverage, Datum} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute, type UtmPoint} from '@/utils/coordinates';
import type {RasterLayerSpecification} from 'maplibre-gl';
import {RLayer, RSource} from 'maplibre-react-components';
import {useMemo} from 'react';

// Covered cells render green; in-area-uncovered and unknown cells are transparent (so the basemap /
// areas show through). The blade-cut footprint is what the system "knows" it mowed.
const COVERED: [number, number, number, number] = [60, 200, 90, 235];

// Image source corners: top-left, top-right, bottom-right, bottom-left (lng/lat).
type Corners = [[number, number], [number, number], [number, number], [number, number]];

const rasterPaint: RasterLayerSpecification['paint'] = {
  'raster-opacity': 0.75,
  'raster-fade-duration': 0,
  // Bilinear resampling: the coverage canvas is 1 px per 5 cm cell, so 'nearest' upscales each cell
  // into a hard 5 cm square (a blocky staircase along a tool-width swath). 'linear' blends adjacent
  // cells into a smooth coverage swath.
  'raster-resampling': 'linear',
};

// Cell (lx,ly) → canvas pixel for a width×height canvas. World y grows upward; canvas row 0 is the
// top (highest y), so flip the row.
function paintCell(data: Uint8ClampedArray, width: number, height: number, lx: number, ly: number) {
  const row = height - 1 - ly;
  const o = (row * width + lx) * 4;
  data[o] = COVERED[0];
  data[o + 1] = COVERED[1];
  data[o + 2] = COVERED[2];
  data[o + 3] = COVERED[3];
}

// Fill single-cell rasterization specks: an uncovered cell with >= 6 of its 8 neighbours covered is a
// hole the tool actually swept (a 5 cm raster miss), not a real gap. Painting these removes the
// "few-pixel spots" from the coverage while leaving genuine gaps and obstacle rims (which have far
// fewer covered neighbours) untouched. Mirrors the backend gap-detector, which already ignores them.
function fillSpecks(data: Uint8ClampedArray, width: number, height: number, covered: Set<number>) {
  const has = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height && covered.has(y * width + x);
  const candidates = new Set<number>();
  for (const idx of covered) {
    const x = idx % width;
    const y = (idx - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !covered.has(ny * width + nx)) {
          candidates.add(ny * width + nx);
        }
      }
    }
  }
  for (const idx of candidates) {
    const x = idx % width;
    const y = (idx - x) / width;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && has(x + dx, y + dy)) n++;
      }
    }
    if (n >= 6) paintCell(data, width, height, x, y);
  }
}

// Paint one tile's covered cells into a side×side canvas, returning a data URL (null if empty).
function tileToDataUrl(cells: Set<number>, side: number): string | null {
  if (cells.size === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(side, side);
  for (const idx of cells) {
    const lx = idx % side;
    paintCell(img.data, side, side, lx, (idx - lx) / side);
  }
  fillSpecks(img.data, side, side, cells);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// Fixed UTM→lng/lat box for tile (tx,ty): cells span [tx*side, (tx+1)*side) in cell units, × res.
function tileCorners(tx: number, ty: number, res: number, side: number, utm: UtmPoint): Corners {
  const x0 = tx * side * res;
  const y0 = ty * side * res;
  const x1 = (tx + 1) * side * res;
  const y1 = (ty + 1) * side * res;
  return [
    pointToAbsolute({x: x0, y: y1}, utm),
    pointToAbsolute({x: x1, y: y1}, utm),
    pointToAbsolute({x: x1, y: y0}, utm),
    pointToAbsolute({x: x0, y: y0}, utm),
  ];
}

// Decode an RLE coverage grid (historical job snapshot) into an RGBA canvas data URL, or null.
function coverageToDataUrl(cov: Coverage): string | null {
  const {w, h, rle} = cov;
  if (w === 0 || h === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const coveredSet = new Set<number>();
  let cell = 0; // row-major from origin (bottom-left), +x then +y
  for (let p = 0; p + 1 < rle.length; p += 2) {
    const covered = rle[p] >= 50;
    const count = rle[p + 1];
    for (let k = 0; k < count; k++) {
      if (covered) {
        paintCell(img.data, w, h, cell % w, Math.floor(cell / w));
        coveredSet.add(cell);
      }
      cell++;
    }
  }
  fillSpecks(img.data, w, h, coveredSet);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// One fixed-position image per coverage tile. The tile box never moves (no re-anchoring/twitch); only
// the canvas repaints when its cell set changes. Memoized on the Set identity, which immer keeps
// stable for tiles that didn't change.
function CoverageTile({
  tileId,
  cells,
  res,
  side,
  utm,
}: {
  tileId: string;
  cells: Set<number>;
  res: number;
  side: number;
  utm: UtmPoint;
}) {
  const {url, coordinates} = useMemo(() => {
    const [tx, ty] = parseTileKey(tileId);
    return {url: tileToDataUrl(cells, side), coordinates: tileCorners(tx, ty, res, side, utm)};
  }, [tileId, cells, res, side, utm]);

  if (!url) return null;
  const sourceId = `coverage-tile-${tileId}`;
  return (
    <>
      <RSource id={sourceId} type="image" url={url} coordinates={coordinates} />
      <RLayer id={`${sourceId}-layer`} source={sourceId} type="raster" paint={rasterPaint} />
    </>
  );
}

interface CoverageLayerProps {
  visible?: boolean;
  datum: Datum | null;
  // When `historical` is true a past job is selected: render `past` ONLY (null = render nothing),
  // never the live grid — otherwise we'd mix a past track with live coverage.
  historical?: boolean;
  past?: Coverage | null;
}

/**
 * Coverage layer. Live: renders the incremental coverage store as one fixed-position green image per
 * tile (see CoverageTile). Historical: renders a past job's RLE coverage grid as a single image. The
 * two paths never mix.
 */
export default function CoverageLayer({visible = true, datum, historical = false, past = null}: CoverageLayerProps) {
  const coverageLayer = useSelectedMower<CoverageLayerState | undefined>((s) => s?.coverageLayer);
  const utm = useMemo(() => (datum ? datumToRelative([datum.long, datum.lat]) : null), [datum]);

  // Historical (RLE grid) single image, placed at its true extent.
  const historicalImage = useMemo<{url: string | null; coordinates: Corners | null}>(() => {
    if (!historical || !past || !utm) return {url: null, coordinates: null};
    const {ox, oy, w, h, res} = past;
    const x1 = ox + w * res;
    const y1 = oy + h * res;
    const corners: Corners = [
      pointToAbsolute({x: ox, y: y1}, utm),
      pointToAbsolute({x: x1, y: y1}, utm),
      pointToAbsolute({x: x1, y: oy}, utm),
      pointToAbsolute({x: ox, y: oy}, utm),
    ];
    return {url: coverageToDataUrl(past), coordinates: corners};
  }, [historical, past, utm]);

  // Live tiles to render.
  const tiles = useMemo(
    () => (historical || !coverageLayer ? [] : Array.from(coverageLayer.tiles.entries())),
    [historical, coverageLayer],
  );

  if (!visible) return null;

  if (historical) {
    if (!historicalImage.url || !historicalImage.coordinates) return null;
    return (
      <>
        <RSource id="coverage-source" type="image" url={historicalImage.url} coordinates={historicalImage.coordinates} />
        <RLayer id="coverage-layer" source="coverage-source" type="raster" paint={rasterPaint} />
      </>
    );
  }

  if (!coverageLayer || !utm) return null;
  const {res, tile} = coverageLayer;
  return (
    <>
      {tiles.map(([tileId, cells]) => (
        <CoverageTile key={tileId} tileId={tileId} cells={cells} res={res} side={tile} utm={utm} />
      ))}
    </>
  );
}
