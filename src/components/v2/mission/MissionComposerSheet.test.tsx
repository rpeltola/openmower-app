import type {MissionComposerJob} from '@/components/map/mission/types';
import {MissionComposerSheet} from '@/components/v2/mission/MissionComposerSheet';
import type {MissionState} from '@/stores/schemas';
import {newAreaJob} from '@/utils/mission-utils';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

// Presentational component — the composer STATE/logic (useMissionComposer) and the
// mow_mission/* PUBLISH wiring live in the caller (Map.tsx), same split as MapVersioning.tsx's
// SaveMapSheet/VersionHistorySheet, so the Start-vs-Add / Continue / Cancel CONTRACT is testable
// here without mounting the map/store.

const AREAS = [
  {id: 'etupiha', name: 'Etupiha'},
  {id: 'takapiha', name: 'Takapiha'},
];

function noop() {
  // intentionally empty — unused handler slots for props this test doesn't exercise
}

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  areas: AREAS,
  jobs: [] as MissionComposerJob[],
  onAddAreaJob: vi.fn(),
  onRemoveJob: vi.fn(),
  onUpdateJob: vi.fn(),
  onReorderJobs: vi.fn(),
  onClearJobs: vi.fn(),
  missionState: null as MissionState | null,
  onStart: vi.fn(),
  onAdd: vi.fn(),
  onContinue: noop,
  onCancel: vi.fn(),
};

describe('MissionComposerSheet', () => {
  afterEach(cleanup);

  it('lists the saved mowable areas and adds one on tap', () => {
    const onAddAreaJob = vi.fn();
    render(<MissionComposerSheet {...BASE_PROPS} onAddAreaJob={onAddAreaJob} />);

    screen.getByRole('button', {name: /Etupiha/}).click();
    expect(onAddAreaJob).toHaveBeenCalledWith('etupiha', 'Etupiha');
  });

  it('shows "No mowing areas saved." when there are none', () => {
    render(<MissionComposerSheet {...BASE_PROPS} areas={[]} />);
    expect(screen.getByText('No mowing areas saved.')).toBeInTheDocument();
  });

  it('renders the ordered job queue and disables Start with an empty queue', () => {
    render(<MissionComposerSheet {...BASE_PROPS} />);

    const start = screen.getByRole('button', {name: /Start mission/});
    expect(start).toBeDisabled();
  });

  it('Start mission calls onStart with a populated queue, and not onAdd', () => {
    const onStart = vi.fn();
    const onAdd = vi.fn();
    const jobs = [newAreaJob('etupiha', 'Etupiha')];
    render(<MissionComposerSheet {...BASE_PROPS} jobs={jobs} onStart={onStart} onAdd={onAdd} />);

    // Rendered twice: once in "Add to mission" (still offered independent of the queue) and once
    // as the job row's label.
    expect(screen.getAllByText('Etupiha')).toHaveLength(2);
    screen.getByRole('button', {name: /Start mission/}).click();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('switches Start to Add-to-mission while a mission is active (queued/planning/mowing/paused)', () => {
    const onAdd = vi.fn();
    const jobs = [newAreaJob('etupiha', 'Etupiha')];
    const missionState: MissionState = {
      mission_id: 'm1',
      job_index: 0,
      job_total: 2,
      type: 'area',
      area_id: 'etupiha',
      pass: 1,
      repeats: 1,
      coverage: 0.4,
      state: 'mowing',
    };
    render(<MissionComposerSheet {...BASE_PROPS} jobs={jobs} missionState={missionState} onAdd={onAdd} />);

    expect(screen.queryByRole('button', {name: /Start mission/})).not.toBeInTheDocument();
    screen.getByRole('button', {name: /Add to mission/}).click();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows Continue only while paused, and Cancel only while a mission is active', () => {
    const runningState: MissionState = {
      mission_id: 'm1',
      job_index: 0,
      job_total: 1,
      type: 'area',
      pass: 1,
      repeats: 1,
      coverage: 0,
      state: 'mowing',
    };
    const {rerender} = render(<MissionComposerSheet {...BASE_PROPS} missionState={runningState} />);
    expect(screen.queryByRole('button', {name: /Continue/})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Cancel/})).toBeEnabled();

    rerender(<MissionComposerSheet {...BASE_PROPS} missionState={{...runningState, state: 'paused'}} />);
    expect(screen.getByRole('button', {name: /Continue/})).toBeInTheDocument();

    rerender(<MissionComposerSheet {...BASE_PROPS} missionState={null} />);
    expect(screen.getByRole('button', {name: /Cancel/})).toBeDisabled();
  });

  it('renders live mission progress (job i/N, coverage) when a mission state is present', () => {
    const missionState: MissionState = {
      mission_id: 'm1',
      job_index: 1,
      job_total: 3,
      type: 'area',
      area_id: 'etupiha',
      pass: 2,
      repeats: 3,
      coverage: 0.55,
      state: 'mowing',
    };
    render(<MissionComposerSheet {...BASE_PROPS} missionState={missionState} />);

    expect(screen.getByText(/Job 2 \/ 3/)).toBeInTheDocument();
    expect(screen.getByText(/Pass 2 \/ 3/)).toBeInTheDocument();
    expect(screen.getByText(/55% coverage/)).toBeInTheDocument();
  });

  it('clears the queue via Clear all', () => {
    const onClearJobs = vi.fn();
    const jobs = [newAreaJob('etupiha', 'Etupiha')];
    render(<MissionComposerSheet {...BASE_PROPS} jobs={jobs} onClearJobs={onClearJobs} />);

    screen.getByRole('button', {name: 'Clear all'}).click();
    expect(onClearJobs).toHaveBeenCalledTimes(1);
  });
});
