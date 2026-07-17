import type {CommandName, RejectCode} from '@/lib/v2/robotState';
import {generateId} from '@/utils/area-utils';
import type {MqttClient} from 'mqtt';

export interface CommandResponse {
  accepted: boolean;
  // Present iff accepted === false (a RejectCode, W9 §0.3).
  reject_code?: RejectCode;
  // The (possibly just-transitioned) canonical state string at response time.
  state: string;
}

interface PendingCommand {
  resolve: (value: CommandResponse) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Request/reply client for the `cmd/req` -> `cmd/res` MQTT contract (OpenMowerNext
 * docs/w9-implementation.md §0.9) -- a small, purpose-built mirror of `MqttQueryClient`
 * (queryClient.ts), kept separate because the envelope differs: the correlation field is
 * `id` (not `request_id`, which is the `query/*` family's field), and a rejected command
 * carries `reject_code` (not `reason` -- that word is reserved for PAUSED's `paused_reasons`).
 *
 * The app publishes `{id, cmd, args}` on `cmd/req`; the gateway replies with
 * `{id, accepted, reject_code?, state}` on `cmd/res` within ~300 ms. `id` is echoed back so
 * replies match their request even with several commands in flight.
 */
export class MqttCommandClient {
  private pending = new Map<string, PendingCommand>();

  constructor(
    private mqtt: MqttClient,
    private prefix: string,
  ) {}

  send(cmd: CommandName, args: object = {}, timeoutMs = 800): Promise<CommandResponse> {
    const id = generateId();
    this.mqtt.publish(`${this.prefix}cmd/req`, JSON.stringify({id, cmd, args}));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`cmd/${cmd} timed out`));
      }, timeoutMs);
      this.pending.set(id, {resolve, reject, timeout});
    });
  }

  /** Route one `cmd/res` MQTT message to its waiting request, matched by `id`. */
  handleResponse(payload: string) {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    const id = typeof json.id === 'string' ? json.id : undefined;
    if (!id) return;
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(id);
    pending.resolve({
      accepted: Boolean(json.accepted),
      reject_code: typeof json.reject_code === 'string' ? (json.reject_code as RejectCode) : undefined,
      state: typeof json.state === 'string' ? json.state : '',
    });
  }
}
