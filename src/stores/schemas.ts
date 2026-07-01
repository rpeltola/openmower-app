import {z} from 'zod/v4';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Capabilities
////////////////////////////////////////////////////////////////////////////////////////////////////

// Simple string to unsigned integer map
export const capabilitiesSchema = z.record(z.string(), z.int().gte(1));
export type Capabilities = z.infer<typeof capabilitiesSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// State
////////////////////////////////////////////////////////////////////////////////////////////////////

const numericBoolean = z.union([z.literal(0), z.literal(1)]).transform((v) => v === 1);
const percentage = z
  .number()
  .min(0)
  .max(1)
  .transform((v) => Math.round(v * 100));

const gpsPercentage = z
  .number()
  .max(1)
  .transform((v) => Math.round(Math.max(0, v) * 100));

export const stateSchema = z.object({
  battery_percentage: percentage,
  current_state: z.string(),
  current_action_progress: z.number(),
  current_area: z.number(),
  current_path: z.number(),
  current_path_index: z.number(),
  current_sub_state: z.string(),
  emergency: numericBoolean,
  gps_percentage: gpsPercentage,
  is_charging: numericBoolean,
  pose: z.object({
    heading: z.number(),
    heading_accuracy: z.number(),
    heading_valid: numericBoolean,
    pos_accuracy: z.number(),
    x: z.number(),
    y: z.number(),
  }),
});

export type State = z.infer<typeof stateSchema>;
export type StateOptionalPose = Omit<State, 'pose'> & {pose?: State['pose']};

////////////////////////////////////////////////////////////////////////////////////////////////////
// Map
////////////////////////////////////////////////////////////////////////////////////////////////////

export const datumSchema = z.object({
  lat: z.number(),
  long: z.number(),
  height: z.number(),
});
export type Datum = z.infer<typeof datumSchema>;

const pointSchema = z.object({x: z.number(), y: z.number()});
const polygonSchema = z.array(pointSchema);
const areaSchema = z.object({
  id: z.string(),
  properties: z.looseObject({
    name: z.string().optional(),
    type: z.enum(['mow', 'nav', 'obstacle', 'draft']).default('draft'),
    active: z.boolean().default(true),
  }),
  outline: polygonSchema,
});
export type Area = z.infer<typeof areaSchema>;
export type AreaProps = Area['properties'];
export type AreaType = AreaProps['type'];

const dockingStationSchema = z.object({
  id: z.string(),
  properties: z.object({
    name: z.string().optional(),
    active: z.boolean().default(true),
  }),
  position: pointSchema,
  heading: z.number(),
});

export const mapSchema = z.object({
  datum: datumSchema.optional(),
  areas: z.array(areaSchema),
  docking_stations: z.array(dockingStationSchema),
});

export type MapData = z.infer<typeof mapSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Coverage (gridded map layer)
////////////////////////////////////////////////////////////////////////////////////////////////////

// A coverage grid in the map frame, bridged from the coverage_feedback OccupancyGrid.
// `rle` is a flat run-length encoding [value, count, value, count, ...] of the row-major cells
// (origin is the bottom-left corner, +x then +y); values: 100 covered, 0 in-area uncovered, -1 unknown.
export const coverageSchema = z.object({
  res: z.number(),
  w: z.int().gte(0),
  h: z.int().gte(0),
  ox: z.number(),
  oy: z.number(),
  stamp: z.number().optional(),
  rle: z.array(z.number()),
});
export type Coverage = z.infer<typeof coverageSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Coverage layer (incremental sparse coverage: deltas streamed over MQTT + full snapshot RPC)
////////////////////////////////////////////////////////////////////////////////////////////////////

// One tile's newly-covered cells. `tx`/`ty` index a `tile`x`tile` block of cells (may be negative);
// each `idx` is a within-tile cell (0..tile*tile-1) with lx=idx%tile, ly=floor(idx/tile).
const coverageTileSchema = z.object({
  tx: z.int(),
  ty: z.int(),
  cells: z.array(z.int().gte(0)),
});
export type CoverageTile = z.infer<typeof coverageTileSchema>;

// Incremental delta on `map_layers/coverage/delta` (non-retained). `reset:true` (empty tiles) clears
// everything for a new job. A delta carrying an unfamiliar `job_id` triggers a snapshot fetch.
export const coverageDeltaSchema = z.object({
  job_id: z.string(),
  res: z.number(),
  tile: z.int().gte(1),
  reset: z.boolean().optional(),
  tiles: z.array(coverageTileSchema),
});
export type CoverageDelta = z.infer<typeof coverageDeltaSchema>;

// Full covered set for a job, returned by the `coverage.snapshot` RPC (same shape as a delta but
// always the complete set, so `reset` is absent).
export const coverageSnapshotSchema = z.object({
  job_id: z.string(),
  res: z.number(),
  tile: z.int().gte(1),
  tiles: z.array(coverageTileSchema),
});
export type CoverageSnapshot = z.infer<typeof coverageSnapshotSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Planned path (slic3r planned path map layer)
////////////////////////////////////////////////////////////////////////////////////////////////////

// The planned mowing path, streamed over MQTT (map_layers/planned_path/json).
// Points are [x, y] in metres in the map frame; `is_outline` marks perimeter passes.
const xyTupleSchema = z.tuple([z.number(), z.number()]);

const plannedPathEntrySchema = z.object({
  is_outline: z.boolean(),
  points: z.array(xyTupleSchema),
});
export type PlannedPathEntry = z.infer<typeof plannedPathEntrySchema>;

export const plannedPathSchema = z.object({
  job_id: z.string(),
  paths: z.array(plannedPathEntrySchema),
});
export type PlannedPath = z.infer<typeof plannedPathSchema>;

// The live map_layers/planned_path/json topic is only a signal: which job is current and which step
// it is on. The actual geometry is fetched from history (planned_path.history / .step), so the plan
// is held client-side and stays visible after the job is cancelled/finished (like the driven track).
export const plannedPathSignalSchema = z.object({
  job_id: z.string(),
  step_index: z.number().optional(),
});
export type PlannedPathSignal = z.infer<typeof plannedPathSignalSchema>;
////////////////////////////////////////////////////////////////////////////////////////////////////
// Coverage history (past mow attempts, fetched via the coverage.history.* RPCs)
////////////////////////////////////////////////////////////////////////////////////////////////////

// Response of `coverage.history.list`: one entry per job, each listing its recorded passes.
export const coverageHistoryListSchema = z.array(
  z.object({
    job_id: z.string(),
    passes: z.array(
      z.object({
        pass: z.number(),
        timestamp: z.number(),
        coverage_percent: z.number(),
        gap_count: z.number(),
      }),
    ),
  }),
);
export type CoverageHistoryList = z.infer<typeof coverageHistoryListSchema>;

// Response of `coverage.history.pass`: a full snapshot of one historical pass, reusing the live
// layer shapes (coverage grid, planned path) so the same renderers apply. The historical
// planned_path carries no job_id; callers attach it when building a PlannedPath.
export const coveragePassSchema = z.object({
  meta: z.unknown(),
  coverage: coverageSchema,
  planned_path: z.object({paths: z.array(plannedPathEntrySchema)}),
  actual_track: z.unknown(),
});
export type CoveragePass = z.infer<typeof coveragePassSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Legacy map
////////////////////////////////////////////////////////////////////////////////////////////////////

export const legacyAreaSchema = z.object({
  name: z.string(),
  obstacles: z.array(polygonSchema).nullable(),
  outline: polygonSchema,
});

export const legacyMapSchema = z.object({
  datum: datumSchema.optional(),
  docking_pose: z.object({
    heading: z.number().nullable(),
    x: z.number(),
    y: z.number(),
  }),
  meta: z.object({
    mapCenterX: z.number(),
    mapCenterY: z.number(),
    mapHeight: z.number(),
    mapWidth: z.number(),
  }),
  navigation_areas: z.array(legacyAreaSchema).nullable(),
  working_areas: z.array(legacyAreaSchema).nullable(),
});

export type LegacyArea = z.infer<typeof legacyAreaSchema>;
export type LegacyMapData = z.infer<typeof legacyMapSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Position (from position/json topic)
////////////////////////////////////////////////////////////////////////////////////////////////////

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  heading: z.number(),
  attributes: z.object({
    job_id: z.string(),
    session_id: z.string(),
    blades: z.boolean(),
  }),
});

export type PositionWithAttributes = z.infer<typeof positionSchema>;
export type Position = Omit<PositionWithAttributes, 'attributes'>;
export type TrackAttributes = PositionWithAttributes['attributes'];

////////////////////////////////////////////////////////////////////////////////////////////////////
// Events (from events/json topic and events.history RPC)
////////////////////////////////////////////////////////////////////////////////////////////////////

const baseEventSchema = z.looseObject({
  id: z.string(),
  t: z.number(),
  type: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  job_id: z.string().optional(),
  session_id: z.string().optional(),
});

export const eventSchema = z.union([
  z.discriminatedUnion('type', [
    baseEventSchema.extend({type: z.literal('EMERGENCY'), active: z.boolean()}),
    baseEventSchema.extend({type: z.literal('BOOTED')}),
    baseEventSchema.extend({type: z.literal('GPS'), available: z.boolean()}),
    baseEventSchema.extend({type: z.literal('STATE'), state: z.string()}),
    baseEventSchema.extend({type: z.literal('BLADES'), enabled: z.boolean()}),
    baseEventSchema.extend({type: z.literal('DOCKING'), reason: z.string()}),
    baseEventSchema.extend({
      type: z.literal('AREA'),
      area_id: z.string(),
      area_name: z.string(),
    }),
  ]),
  baseEventSchema,
]);

export type MowerEvent = z.infer<typeof eventSchema>;

export const BASE_EVENT_KEYS = new Set(Object.keys(baseEventSchema.shape));

////////////////////////////////////////////////////////////////////////////////////////////////////
// Defaults
////////////////////////////////////////////////////////////////////////////////////////////////////

export const mapDefaults: MapData = {
  datum: undefined,
  areas: [],
  docking_stations: [],
};

export const fallbackDatum = {lat: 48.0, long: 11.0, height: 0} satisfies Datum;

export const stateDefaults: StateOptionalPose = {
  battery_percentage: 100,
  current_action_progress: 0.0,
  current_area: -1,
  current_path: -1,
  current_path_index: -1,
  current_state: 'UNKNOWN',
  current_sub_state: '',
  emergency: false,
  gps_percentage: 0.0,
  is_charging: false,
  pose: undefined,
};
