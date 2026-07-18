import type {MowerConfig} from '@/components/types';
import {Mower} from '@/stores/mowersStore';
import type {MqttClient} from 'mqtt';
import {describe, expect, it, vi} from 'vitest';

// The "Record dock" store wiring (record_docking/start|cancel -> record_docking/status) -- the
// backend bridge this rides on predates this app change (see RecordDockingFlow.tsx's module doc),
// but had no direct test coverage of its own yet. Same real-Mower-plus-fake-mqtt-client approach
// as mowersStore.recordArea.test.ts, for exact publish-payload assertions.
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

describe('Mower.publishRecordDocking*', () => {
  it('start publishes {name} on record_docking/start', () => {
    const {mower, publish} = makeMower();
    mower.publishRecordDockingStart('Front dock');
    expect(publish).toHaveBeenCalledWith('openmower/m1/record_docking/start', JSON.stringify({name: 'Front dock'}));
  });

  it('cancel publishes an empty payload on record_docking/cancel', () => {
    const {mower, publish} = makeMower();
    mower.publishRecordDockingCancel();
    expect(publish).toHaveBeenCalledWith('openmower/m1/record_docking/cancel', '');
  });
});

describe('recordDockingStatusSchema (via mowersStore parse path)', () => {
  it('parses a driving-phase payload', async () => {
    const {recordDockingStatusSchema} = await import('@/stores/schemas');
    const parsed = recordDockingStatusSchema.parse({phase: 'driving', status: 1, message: 'Heading to the dock'});
    expect(parsed).toEqual({phase: 'driving', status: 1, message: 'Heading to the dock'});
  });

  it('defaults message when the gateway omits it', async () => {
    const {recordDockingStatusSchema} = await import('@/stores/schemas');
    const parsed = recordDockingStatusSchema.parse({phase: 'idle', status: 0});
    expect(parsed).toEqual({phase: 'idle', status: 0, message: ''});
  });

  it('carries the terminal code + docking_station on success', async () => {
    const {recordDockingStatusSchema} = await import('@/stores/schemas');
    const parsed = recordDockingStatusSchema.parse({
      phase: 'success',
      status: 0,
      message: 'Recorded',
      code: 0,
      docking_station: {
        id: 'dock-1',
        properties: {name: 'Front dock', active: true},
        position: {x: 1, y: 2},
        heading: 0.5,
        approach_distance: 0.3,
      },
    });
    expect(parsed.phase).toBe('success');
    expect(parsed.code).toBe(0);
    expect(parsed.docking_station?.heading).toBe(0.5);
  });

  it('carries the terminal code on failed, no docking_station required', async () => {
    const {recordDockingStatusSchema} = await import('@/stores/schemas');
    const parsed = recordDockingStatusSchema.parse({phase: 'failed', status: 99, message: 'No charging detected', code: 1});
    expect(parsed.phase).toBe('failed');
    expect(parsed.code).toBe(1);
    expect(parsed.docking_station).toBeUndefined();
  });

  it('rejects an unknown phase', async () => {
    const {recordDockingStatusSchema} = await import('@/stores/schemas');
    expect(() => recordDockingStatusSchema.parse({phase: 'bogus', status: 0})).toThrow();
  });
});
