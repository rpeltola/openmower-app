import {useMissionComposer} from '@/hooks/useMissionComposer';
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

// useMissionComposer is reused as-is from the v1 port (already presentation-agnostic — no ROS/MUI
// imports) as the v2 mission composer's job-list state machine.

describe('useMissionComposer', () => {
  it('adds area and spot jobs to the end of the queue', () => {
    const {result} = renderHook(() => useMissionComposer());

    act(() => result.current.addAreaJob('etupiha', 'Etupiha'));
    act(() => result.current.addSpotJob([{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}]));

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs[0]).toMatchObject({type: 'area', areaId: 'etupiha', areaName: 'Etupiha'});
    expect(result.current.jobs[1]).toMatchObject({type: 'spot'});
  });

  it('updates a job by id without disturbing the others', () => {
    const {result} = renderHook(() => useMissionComposer());
    act(() => result.current.addAreaJob('a', 'A'));
    act(() => result.current.addAreaJob('b', 'B'));
    const targetId = result.current.jobs[0].id;

    act(() => result.current.updateJob(targetId, {directionDeg: 90, repeats: 4}));

    expect(result.current.jobs[0]).toMatchObject({directionDeg: 90, repeats: 4});
    expect(result.current.jobs[1]).toMatchObject({directionDeg: 0, repeats: 1});
  });

  it('removes a job by id', () => {
    const {result} = renderHook(() => useMissionComposer());
    act(() => result.current.addAreaJob('a', 'A'));
    act(() => result.current.addAreaJob('b', 'B'));
    const removeId = result.current.jobs[0].id;

    act(() => result.current.removeJob(removeId));

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].id).not.toBe(removeId);
  });

  it('reorders jobs by dragging one id onto another', () => {
    const {result} = renderHook(() => useMissionComposer());
    act(() => result.current.addAreaJob('a', 'A'));
    act(() => result.current.addAreaJob('b', 'B'));
    act(() => result.current.addAreaJob('c', 'C'));
    const [a, , c] = result.current.jobs;

    act(() => result.current.reorderJobs(a.id, c.id));

    expect(result.current.jobs.map((j) => (j.type === 'area' ? j.areaId : j.id))).toEqual(['b', 'c', 'a']);
  });

  it('reordering onto itself is a no-op', () => {
    const {result} = renderHook(() => useMissionComposer());
    act(() => result.current.addAreaJob('a', 'A'));
    act(() => result.current.addAreaJob('b', 'B'));
    const order = result.current.jobs.map((j) => j.id);

    act(() => result.current.reorderJobs(order[0], order[0]));

    expect(result.current.jobs.map((j) => j.id)).toEqual(order);
  });

  it('clearJobs empties the queue', () => {
    const {result} = renderHook(() => useMissionComposer());
    act(() => result.current.addAreaJob('a', 'A'));
    act(() => result.current.clearJobs());

    expect(result.current.jobs).toEqual([]);
  });
});
