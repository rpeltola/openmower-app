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

// Full low-level sensor telemetry, folded into robot_state by the ROS2 gateway
// (sim_mow/app_gateway.py) from the mower_comms_v2 /ll/* topics. Every block is
// optional: it appears only once its source topic has ticked, so the sensors page
// can render exactly what the mower reports. Field names mirror the mower_msgs
// definitions. looseObject tolerates future field additions without a schema bump.
//
// nullableNumber: the gateway maps any NON-FINITE float (NaN/Inf) to JSON null
// (its _json_sanitize), because a bare NaN is invalid JSON and would make the whole
// robot_state message unparseable. The hardware legitimately reports several analog
// readings as NaN when a sensor/rail is unpopulated (e.g. the DC-DC and charger input
// currents, ADC channels), so EVERY raw float that passes straight through from a
// mower_msgs field must accept null. Integer fields (flags, tacho, cycle counts,
// enums) and booleans stay strict. Render null as "—", never NaN/0 (see sensors page).
const nullableNumber = z.number().nullable();

const escStatusSchema = z.looseObject({
  status: z.number(),
  current: nullableNumber,
  tacho: z.number(),
  rpm: z.number(),
  temperature_motor: nullableNumber,
  temperature_pcb: nullableNumber,
});

export const sensorsSchema = z.looseObject({
  power: z
    .looseObject({
      charge_voltage: nullableNumber,
      charge_current: nullableNumber,
      battery_voltage: nullableNumber,
      battery_pct: nullableNumber,
      dcdc_input_current: nullableNumber,
      charger_input_current: nullableNumber,
      charger_enabled: z.boolean(),
      charger_status: z.string(),
    })
    .optional(),
  battery: z
    .looseObject({
      voltage: nullableNumber,
      current: nullableNumber,
      state_of_charge: nullableNumber,
      remaining_capacity: nullableNumber,
      full_charge_capacity: nullableNumber,
      cycle_count: z.number(),
      temperature: nullableNumber,
      status: z.string(),
    })
    .optional(),
  esc_left: escStatusSchema.optional(),
  esc_right: escStatusSchema.optional(),
  mower: z
    .looseObject({
      esc_status: z.number(),
      esc_temperature: nullableNumber,
      esc_current: nullableNumber,
      motor_temperature: nullableNumber,
      motor_rpm: nullableNumber,
      mow_enabled: z.boolean(),
      rain_detected: z.boolean(),
      esc_power: z.boolean(),
      raspberry_pi_power: z.boolean(),
      mower_status: z.number(),
    })
    .optional(),
  emergency: z
    .looseObject({
      active: z.boolean(),
      latched: z.boolean(),
      reason: z.string(),
    })
    .optional(),
  imu: z
    .looseObject({
      linear_acceleration: z.object({x: nullableNumber, y: nullableNumber, z: nullableNumber}),
      angular_velocity: z.object({x: nullableNumber, y: nullableNumber, z: nullableNumber}),
    })
    .optional(),
  gps: z
    .looseObject({
      flags: z.number(),
      rtk: z.boolean(),
      rtk_fixed: z.boolean(),
      rtk_float: z.boolean(),
      dead_reckoning: z.boolean(),
      position_accuracy: nullableNumber,
      orientation_valid: z.boolean(),
      orientation_accuracy: nullableNumber,
      motion_vector_valid: z.boolean(),
      quality: z.number(),
    })
    .optional(),
});
export type Sensors = z.infer<typeof sensorsSchema>;

export const stateSchema = z.object({
  battery_percentage: percentage,
  current_state: z.string(),
  current_action_progress: z.number(),
  current_area: z.number(),
  // Human-readable area from mower_logic's HighLevelStatus. Empty when idle;
  // default so older gateway payloads without these fields still parse.
  current_area_id: z.string().default(''),
  current_area_name: z.string().default(''),
  current_path: z.number(),
  current_path_index: z.number(),
  current_sub_state: z.string(),
  emergency: numericBoolean,
  gps_percentage: gpsPercentage,
  is_charging: numericBoolean,
  sensors: sensorsSchema.optional(),
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
export const areaSchema = z.object({
  id: z.string(),
  properties: z.looseObject({
    name: z.string().optional(),
    type: z.enum(['mow', 'nav', 'obstacle', 'draft']).default('draft'),
    active: z.boolean().default(true),
    // Per-area overrides for mowing areas. When a field is omitted, ROS falls back to the
    // corresponding global config default (see open_mower_ros MowingBehavior::overrideOrGlobal).
    angle: z.number().optional(), // radians; replaces the auto-detected mow orientation
    outline_count: z.int().gte(0).optional(),
    outline_overlap_count: z.int().gte(0).optional(),
    outline_offset: z.number().optional(), // meters
  }),
  outline: polygonSchema,
});
export type Area = z.infer<typeof areaSchema>;
export type AreaProps = Area['properties'];
export type AreaType = AreaProps['type'];

export const dockingStationSchema = z.object({
  id: z.string(),
  properties: z.object({
    name: z.string().optional(),
    active: z.boolean().default(true),
  }),
  position: pointSchema,
  heading: z.number(),
  // Staging distance (m) the robot approaches from before its final docking approach.
  // 0 (also the default for maps recorded before this field existed) means "not set" --
  // the docking system falls back to its own configured default.
  approach_distance: z.number().default(0),
});
export type DockingStation = z.infer<typeof dockingStationSchema>;

export const mapSchema = z.object({
  datum: datumSchema.optional(),
  areas: z.array(areaSchema),
  docking_stations: z.array(dockingStationSchema),
});

export type MapData = z.infer<typeof mapSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Mission (see OpenMowerNext sim_mow/MISSION_CONTRACT.md)
////////////////////////////////////////////////////////////////////////////////////////////////////

// Wire format for a spot polygon vertex — the contract uses [x, y] tuples in map-frame metres,
// unlike the area outline's {x, y} objects.
const missionPointSchema = z.tuple([z.number(), z.number()]);

const missionAreaJobSchema = z.object({
  type: z.literal('area'),
  area_id: z.string(),
  direction_deg: z.number().default(0),
  repeats: z.int().gte(1).default(1),
});

const missionSpotJobSchema = z.object({
  type: z.literal('spot'),
  polygon: z.array(missionPointSchema),
  direction_deg: z.number().default(0),
  repeats: z.int().gte(1).default(1),
});

export const missionJobSchema = z.discriminatedUnion('type', [missionAreaJobSchema, missionSpotJobSchema]);
export type MissionJob = z.infer<typeof missionJobSchema>;

export const missionSchema = z.object({
  mission_id: z.string(),
  jobs: z.array(missionJobSchema),
});
export type Mission = z.infer<typeof missionSchema>;

export const missionStateStatusSchema = z.enum([
  'queued',
  'planning',
  'mowing',
  'paused',
  'done',
  'failed',
  'cancelled',
]);
export type MissionStateStatus = z.infer<typeof missionStateStatusSchema>;

export const missionStateSchema = z.object({
  mission_id: z.string(),
  job_index: z.number(),
  job_total: z.number(),
  type: z.enum(['area', 'spot']),
  area_id: z.string().optional(),
  pass: z.number(),
  repeats: z.number(),
  coverage: z.number(),
  state: missionStateStatusSchema,
  eta_s: z.number().optional(),
});
export type MissionState = z.infer<typeof missionStateSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Docking-station recording (record_docking/start|cancel -> record_docking/status)
////////////////////////////////////////////////////////////////////////////////////////////////////

// Mirrors open_mower_next/action/RecordDockingStation's Feedback.STATUS_* names, plus the two
// terminal outcomes the gateway adds once the action finishes (see sim_mow/app_gateway.py's
// _RECORD_DOCK_PHASE / _on_record_dock_result). 'idle' doubles as "nothing in progress".
export const recordDockingPhaseSchema = z.enum([
  'idle',
  'driving',
  'waiting_for_charging',
  'recording',
  'saving',
  'success',
  'failed',
]);
export type RecordDockingPhase = z.infer<typeof recordDockingPhaseSchema>;

export const recordDockingStatusSchema = z.object({
  phase: recordDockingPhaseSchema,
  // Raw RecordDockingStation.Feedback.STATUS_* value (0 while idle/on a terminal phase).
  status: z.number(),
  message: z.string().default(''),
  // RecordDockingStation.Result.CODE_* value; only present once phase is 'success'/'failed'.
  code: z.number().optional(),
  // Only present when phase === 'success'; same shape as a map/json docking_stations[] entry.
  docking_station: dockingStationSchema.optional(),
});
export type RecordDockingStatus = z.infer<typeof recordDockingStatusSchema>;

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
// Stats & histograms (see OpenMowerNext persistence/DESIGN.md "MQTT contract"):
// `stats/json` + `histograms/json` are always-on/retained topics; `query/stats/req|res`
// and `query/heatmap/req|res` are the on-demand request/reply pair (see lib/queryClient.ts).
////////////////////////////////////////////////////////////////////////////////////////////////////

export const bladeStatusSchema = z.object({
  total_hours: z.number(),
  left_hours: z.number(),
  right_hours: z.number(),
  due: z.boolean(),
  interval_hours: z.number(),
});
export type BladeStatus = z.infer<typeof bladeStatusSchema>;

// stats/json (retained, on-change / ~30s)
export const statsSchema = z.object({
  mowed_hours: z.number(),
  mowed_m2: z.number(),
  mow_count: z.number(),
  blade: bladeStatusSchema,
});
export type Stats = z.infer<typeof statsSchema>;

export const histogramBucketsSchema = z.object({
  min: z.number(),
  width: z.number(),
  counts: z.array(z.number()),
});
export type HistogramBuckets = z.infer<typeof histogramBucketsSchema>;

// histograms/json (~2-5s), served from the persistence node's RAM window
export const histogramsSchema = z.object({
  mow_motor_current: histogramBucketsSchema.optional(),
  drive_speed_left: histogramBucketsSchema.optional(),
  drive_speed_right: histogramBucketsSchema.optional(),
  gps_quality: histogramBucketsSchema.optional(),
});
export type Histograms = z.infer<typeof histogramsSchema>;
export type HistogramMetric = keyof Histograms;

// query/stats/res -- per-day rollup entry, decoded from the `per_day_json` string field
// (services with list/complex responses forward a JSON string verbatim; see DESIGN.md's
// ROS services table). date is a YYYY-MM-DD string.
export const statsPerDaySchema = z.object({
  date: z.string(),
  mowed_hours: z.number().default(0),
  mowed_m2: z.number().default(0),
  mow_count: z.number().default(0),
});
export type StatsPerDay = z.infer<typeof statsPerDaySchema>;

export const statsQueryResultSchema = z.object({
  mowed_hours: z.number().default(0),
  mowed_m2: z.number().default(0),
  mow_count: z.number().default(0),
  blade_hours: z.number().default(0),
  per_day: z.array(statsPerDaySchema).default([]),
});
export type StatsQueryResult = z.infer<typeof statsQueryResultSchema>;

// query/heatmap/res -- cells decoded from the `json` string field, keyed by the current
// map version. Coordinates are 0.25m-cell grid indices in datum-relative local metres
// (HEATMAP_CELL_SIZE_M, see DESIGN.md).
export const heatmapCellSchema = z.object({
  x: z.number(),
  y: z.number(),
  mean: z.number(),
  count: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;

export const HEATMAP_METRICS = ['gps_quality', 'mow_motor_current', 'slip_pct'] as const;
export type HeatmapMetric = (typeof HEATMAP_METRICS)[number];

export const HEATMAP_METRIC_LABELS: Record<HeatmapMetric, string> = {
  gps_quality: 'GPS quality',
  mow_motor_current: 'Mower motor current',
  slip_pct: 'Wheel slip',
};

// query/mapversions/res -- decoded from its `json` string field (ListMapVersions service).
export const mapVersionEntrySchema = z.object({
  id: z.number(),
  created_at: z.number().optional(),
  note: z.string().optional(),
  is_current: z.boolean().default(false),
});
export type MapVersionEntry = z.infer<typeof mapVersionEntrySchema>;

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
    baseEventSchema.extend({
      type: z.literal('EMERGENCY'),
      active: z.boolean(),
      reason: z.string().optional(),
      latched: z.boolean().optional(),
    }),
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
  current_area_id: '',
  current_area_name: '',
  current_path: -1,
  current_path_index: -1,
  current_state: 'UNKNOWN',
  current_sub_state: '',
  emergency: false,
  gps_percentage: 0.0,
  is_charging: false,
  pose: undefined,
};
