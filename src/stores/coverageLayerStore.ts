import {enableMapSet, immerable} from 'immer';
import type {CoverageDelta, CoverageSnapshot} from './schemas';

// The coverage layer keeps its covered cells in a Map<tileKey, Set<idx>>, mutated in place inside
// immer producers — so map/set drafting must be enabled.
enableMapSet();

export const COVERAGE_TILE = 128;

export type TileKey = string; // "tx,ty"

export function tileKey(tx: number, ty: number): TileKey {
  return `${tx},${ty}`;
}

export function parseTileKey(key: TileKey): [tx: number, ty: number] {
  const comma = key.indexOf(',');
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
}

/**
 * Sparse covered-cell store for one mower, populated from incremental coverage deltas plus a full
 * snapshot. Holds the current `job_id` and a per-tile set of covered cell indices. Lives on the
 * Mower (an immerable object), so its methods mutate `this` inside immer producers; immer's
 * structural sharing keeps the per-tile Set identity stable for tiles that didn't change, which lets
 * the renderer memoize an unchanged tile's canvas.
 */
export class CoverageLayerState {
  [immerable] = true;

  jobId: string | null = null;
  res = 0.05;
  tile = COVERAGE_TILE;
  tiles: Map<TileKey, Set<number>> = new Map();

  /** Replace everything with the full covered set from a snapshot. */
  applySnapshot(snap: CoverageSnapshot): void {
    this.jobId = snap.job_id;
    this.res = snap.res;
    this.tile = snap.tile;
    const next = new Map<TileKey, Set<number>>();
    for (const t of snap.tiles) {
      if (t.cells.length > 0) next.set(tileKey(t.tx, t.ty), new Set(t.cells));
    }
    this.tiles = next;
  }

  /**
   * Merge an incremental delta. Returns true when the caller should fetch a snapshot: either the
   * delta announced a `job_id` we don't have yet (we adopt it and merge what we got, but the full
   * set must come from a snapshot). `reset` clears everything for the new job and needs no snapshot.
   */
  applyDelta(delta: CoverageDelta): boolean {
    this.res = delta.res;
    this.tile = delta.tile;

    if (delta.reset) {
      this.jobId = delta.job_id;
      this.tiles = new Map();
      return false;
    }

    const newJob = delta.job_id !== this.jobId;
    if (newJob) {
      this.jobId = delta.job_id;
      this.tiles = new Map();
    }

    for (const t of delta.tiles) {
      if (t.cells.length === 0) continue;
      const key = tileKey(t.tx, t.ty);
      const existing = this.tiles.get(key);
      if (existing) {
        for (const c of t.cells) existing.add(c);
      } else {
        this.tiles.set(key, new Set(t.cells));
      }
    }

    return newJob;
  }
}
