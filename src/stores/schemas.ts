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
const escStatusSchema = z.looseObject({
  status: z.number(),
  current: z.number(),
  tacho: z.number(),
  rpm: z.number(),
  temperature_motor: z.number(),
  temperature_pcb: z.number(),
});

export const sensorsSchema = z.looseObject({
  power: z
    .looseObject({
      charge_voltage: z.number(),
      charge_current: z.number(),
      battery_voltage: z.number(),
      battery_pct: z.number(),
      dcdc_input_current: z.number(),
      charger_input_current: z.number(),
      charger_enabled: z.boolean(),
      charger_status: z.string(),
    })
    .optional(),
  battery: z
    .looseObject({
      voltage: z.number(),
      current: z.number(),
      state_of_charge: z.number(),
      remaining_capacity: z.number(),
      full_charge_capacity: z.number(),
      cycle_count: z.number(),
      temperature: z.number(),
      status: z.string(),
    })
    .optional(),
  esc_left: escStatusSchema.optional(),
  esc_right: escStatusSchema.optional(),
  mower: z
    .looseObject({
      esc_status: z.number(),
      esc_temperature: z.number(),
      esc_current: z.number(),
      motor_temperature: z.number(),
      motor_rpm: z.number(),
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
      linear_acceleration: z.object({x: z.number(), y: z.number(), z: z.number()}),
      angular_velocity: z.object({x: z.number(), y: z.number(), z: z.number()}),
    })
    .optional(),
  gps: z
    .looseObject({
      flags: z.number(),
      rtk: z.boolean(),
      rtk_fixed: z.boolean(),
      rtk_float: z.boolean(),
      dead_reckoning: z.boolean(),
      position_accuracy: z.number(),
      orientation_valid: z.boolean(),
      orientation_accuracy: z.number(),
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
  current_path: -1,
  current_path_index: -1,
  current_state: 'UNKNOWN',
  current_sub_state: '',
  emergency: false,
  gps_percentage: 0.0,
  is_charging: false,
  pose: undefined,
};
