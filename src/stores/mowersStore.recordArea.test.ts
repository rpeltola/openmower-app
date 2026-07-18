import type {MowerConfig} from '@/components/types';
import {Mower} from '@/stores/mowersStore';
import type {MqttClient} from 'mqtt';
import {describe, expect, it, vi} from 'vitest';

// The "Record area" store wiring (record_area/start|finish|cancel -> record_area/status) --
// mirrors record_docking's own publish + status-subscription pattern (see mowersStore.ts). A
// real `Mower` is constructed directly with a fake mqtt client (its constructor only stores
// references, never touches the network) so these are exact publish-payload assertions rather
// than a mock stand-in.
const CONFIG: MowerConfig = {
  id: 'm1',
  name: 'Test Mower',
  mqtt_ws_url: 'ws://localhost:9001',
  mqtt_prefix: 'openmower/m1/',
  description: '',
};

function makeMower() {
  const publish = vi.fn();
  const mqttClient = {publish} as unknown as MqttClient;
  const mower = new Mower(CONFIG, mqttClient);
  return {mower, publish};
}

describe('Mower.publishRecordArea*', () => {
  it('start publishes {name, type} on record_area/start', () => {
    const {mower, publish} = makeMower();
    mower.publishRecordAreaStart('Front lawn', 2);
    expect(publish).toHaveBeenCalledWith('openmower/m1/record_area/start', JSON.stringify({name: 'Front lawn', type: 2}));
  });

  it('start with type 0 (obstacle)', () => {
    const {mower, publish} = makeMower();
    mower.publishRecordAreaStart('Flower bed', 0);
    expect(publish).toHaveBeenCalledWith('openmower/m1/record_area/start', JSON.stringify({name: 'Flower bed', type: 0}));
  });

  it('finish publishes an empty object on record_area/finish', () => {
    const {mower, publish} = makeMower();
    mower.publishRecordAreaFinish();
    expect(publish).toHaveBeenCalledWith('openmower/m1/record_area/finish', '{}');
  });

  it('cancel publishes an empty payload on record_area/cancel', () => {
    const {mower, publish} = makeMower();
    mower.publishRecordAreaCancel();
    expect(publish).toHaveBeenCalledWith('openmower/m1/record_area/cancel', '');
  });
});

describe('recordAreaStatusSchema (via mowersStore parse path)', () => {
  it('parses a full recording-phase payload', async () => {
    const {recordAreaStatusSchema} = await import('@/stores/schemas');
    const parsed = recordAreaStatusSchema.parse({
      phase: 'recording',
      point_count: 12,
      polygon: [
        [0, 0],
        [1, 0],
      ],
      message: '',
    });
    expect(parsed).toEqual({
      phase: 'recording',
      point_count: 12,
      polygon: [
        [0, 0],
        [1, 0],
      ],
      message: '',
    });
  });

  it('defaults point_count/polygon/message when the gateway omits them', async () => {
    const {recordAreaStatusSchema} = await import('@/stores/schemas');
    const parsed = recordAreaStatusSchema.parse({phase: 'idle'});
    expect(parsed).toEqual({phase: 'idle', point_count: 0, polygon: [], message: ''});
  });

  it('carries the terminal code on failed', async () => {
    const {recordAreaStatusSchema} = await import('@/stores/schemas');
    const parsed = recordAreaStatusSchema.parse({
      phase: 'failed',
      point_count: 2,
      polygon: [],
      message: 'Too few points',
      code: 1,
    });
    expect(parsed.code).toBe(1);
    expect(parsed.phase).toBe('failed');
  });

  it('rejects an unknown phase', async () => {
    const {recordAreaStatusSchema} = await import('@/stores/schemas');
    expect(() => recordAreaStatusSchema.parse({phase: 'bogus'})).toThrow();
  });
});
