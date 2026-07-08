import {generateId} from '@/utils/area-utils';
import type {MqttClient} from 'mqtt';

export type QueryName =
  | 'stats'
  | 'histogram'
  | 'heatmap'
  | 'heatmap_metrics'
  | 'events'
  | 'mapversions'
  | 'mapversion'
  | 'track'
  | 'mowjobs';

interface PendingQuery {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Request/reply client for the on-demand `{prefix}query/<name>/req` -> `{prefix}query/<name>/res`
 * MQTT contract (see OpenMowerNext persistence/DESIGN.md, "MQTT contract" section). This is
 * distinct from the existing JSON-RPC `rpc/request`+`rpc/response` pair (see rpc-base.ts) --
 * the persistence node speaks this simpler, purpose-built query contract instead.
 *
 * The app publishes `{request_id, ...params}` on the `/req` topic; the gateway calls the
 * matching ROS service and publishes `{request_id, ...data}` on the `/res` topic. `request_id`
 * is echoed back so replies can be matched to their request even with several in flight.
 */
export class MqttQueryClient {
  private pending = new Map<string, PendingQuery>();

  constructor(
    private mqtt: MqttClient,
    private prefix: string,
  ) {}

  request<TParams extends object>(
    name: QueryName,
    params: TParams,
    timeoutMs = 10000,
  ): Promise<Record<string, unknown>> {
    const request_id = generateId();
    this.mqtt.publish(`${this.prefix}query/${name}/req`, JSON.stringify({request_id, ...params}));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request_id);
        reject(new Error(`query/${name} timed out`));
      }, timeoutMs);
      this.pending.set(request_id, {resolve, reject, timeout});
    });
  }

  /** Route one `query/<name>/res` MQTT message to its waiting request, matched by request_id. */
  handleResponse(payload: string) {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    const requestId = typeof json.request_id === 'string' ? json.request_id : undefined;
    if (!requestId) return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    pending.resolve(json);
  }
}

/**
 * A `query/<name>/res` payload's list/complex fields (e.g. `per_day_json`, `json`) are, per the
 * contract, a JSON-encoded STRING that the gateway forwards verbatim from the ROS service's JSON
 * field -- so decode it here. Defensively also accepts an already-parsed array/undefined, in
 * case a future gateway version parses it before publishing.
 */
export function parseJsonArrayField(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
