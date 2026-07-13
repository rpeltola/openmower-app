import {useSpotDrawTool} from '@/contexts/MapContext';
import type {MissionComposer} from '@/hooks/useMissionComposer';
import type {Mower} from '@/stores/mowersStore';
import {useSelectedMower} from '@/stores/mowersStore';
import type {AreaProps} from '@/stores/schemas';
import {buildMissionPayload} from '@/utils/mission-utils';
import {closestCenter, DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors} from '@dnd-kit/core';
import {restrictToVerticalAxis} from '@dnd-kit/modifiers';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  List,
  MenuItem,
  Select,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import type {Feature, Polygon} from 'geojson';
import {LassoIcon, PlayIcon, PlusIcon, SquareXIcon, XIcon} from 'lucide-react';
import {useState} from 'react';
import MissionProgress from './MissionProgress';
import SortableMissionJobRow from './SortableMissionJobRow';

const ACTIVE_STATES = new Set(['queued', 'planning', 'mowing', 'paused']);

interface MissionPanelProps {
  composer: MissionComposer;
  areas: Feature<Polygon, AreaProps>[];
  onClose?: () => void;
}

export default function MissionPanel({composer, areas, onClose}: MissionPanelProps) {
  const theme = useTheme();
  const {jobs, addAreaJob, removeJob, updateJob, reorderJobs, clearJobs} = composer;
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const {isDrawingSpot, toggle: toggleSpotDraw} = useSpotDrawTool();
  const missionState = useSelectedMower((s) => s?.missionState ?? null);
  const mower = useSelectedMower<Mower | undefined>();

  // A mission is "in progress" while it's running OR paused-but-preserved. In that state the
  // composer no longer starts a fresh mission; it APPENDS to the running one (the "Add" flow).
  const missionInProgress = missionState !== null && ACTIVE_STATES.has(missionState.state);
  // Paused = preserved and resumable in place; surface an explicit "Continue" affordance
  // (mow_mission/continue) — the toolbar START resumes the same mission the same way.
  const resumable = missionState?.state === 'paused';

  const sensors = useSensors(
    useSensor(MouseSensor, {activationConstraint: {distance: 5}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 250, tolerance: 8}}),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (over?.id !== undefined) {
      reorderJobs(active.id as string, over.id as string);
    }
  };

  const handleAddArea = () => {
    const area = areas.find((a) => (a.id as string) === selectedAreaId);
    if (!area) return;
    addAreaJob(selectedAreaId, area.properties.name ?? 'Unnamed area');
    setSelectedAreaId('');
  };

  // Start a brand-new mission (fresh id) — only when nothing is in progress. Per the contract
  // this supersedes any non-active preserved mission; an active one is appended to via Add.
  const handleStart = () => {
    if (!mower || jobs.length === 0 || missionInProgress) return;
    mower.publishMissionStart(buildMissionPayload(jobs));
    clearJobs();
  };

  // Append the composed jobs to the running/paused mission without cancel+replan. Reuse the
  // current mission's id so the backend can guard against a stale add racing a mission change.
  const handleAdd = () => {
    if (!mower || jobs.length === 0 || !missionInProgress) return;
    mower.publishMissionAdd(buildMissionPayload(jobs, missionState?.mission_id));
    clearJobs();
  };

  // Resume a paused mission from its saved queue position (does not touch the composer).
  const handleContinue = () => {
    mower?.publishMissionContinue();
  };

  // The ONLY control that discards a mission (STATE_CANCELLED, queue cleared).
  const handleCancel = () => {
    mower?.publishMissionCancel();
  };

  return (
    <Card sx={{height: '100%', display: 'flex', flexDirection: 'column', border: 0}}>
      <CardHeader
        title="Mission"
        action={
          onClose && (
            <IconButton size="small" onClick={onClose} sx={{color: theme.palette.primary.contrastText, mr: -1}}>
              <XIcon size={18} />
            </IconButton>
          )
        }
        sx={{
          py: 1,
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          userSelect: 'none',
          '& .MuiCardHeader-action': {alignSelf: 'center', m: 0},
        }}
      />
      <CardContent sx={{flex: 1, p: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', '&:last-child': {pb: 0}}}>
        <Stack direction="row" spacing={1} sx={{p: 1.5, borderBottom: '1px solid', borderColor: 'divider'}}>
          <Select
            size="small"
            displayEmpty
            fullWidth
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            disabled={areas.length === 0}
            MenuProps={{disablePortal: true}}
          >
            <MenuItem value="" disabled>
              {areas.length === 0 ? 'No mowing areas saved' : 'Add area to mission…'}
            </MenuItem>
            {areas.map((area) => (
              <MenuItem key={area.id as string} value={area.id as string}>
                {area.properties.name ?? 'Unnamed area'}
              </MenuItem>
            ))}
          </Select>
          <Button variant="outlined" onClick={handleAddArea} disabled={selectedAreaId === ''}>
            Add
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
          <Button
            size="small"
            variant={isDrawingSpot ? 'contained' : 'outlined'}
            startIcon={isDrawingSpot ? <SquareXIcon size={16} /> : <LassoIcon size={16} />}
            onClick={toggleSpotDraw}
            fullWidth
          >
            {isDrawingSpot ? 'Cancel drawing' : 'Draw spot mow area'}
          </Button>
        </Stack>

        {jobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{p: 2}}>
            {missionInProgress
              ? 'Add a saved area or draw a spot-mow region to append it to the running mission.'
              : 'Add a saved area or draw a spot-mow region on the map to build a mission.'}
          </Typography>
        ) : (
          <List sx={{p: 0}}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
                {jobs.map((job, index) => (
                  <SortableMissionJobRow
                    key={job.id}
                    index={index}
                    job={job}
                    onChange={(patch) => updateJob(job.id, patch)}
                    onRemove={() => removeJob(job.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </List>
        )}

        <Stack direction="row" spacing={1} sx={{p: 1.5, mt: 'auto'}}>
          {missionInProgress ? (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusIcon size={16} />}
              sx={{flex: 1}}
              disabled={jobs.length === 0 || !mower}
              onClick={handleAdd}
            >
              Add to mission
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayIcon size={16} />}
              sx={{flex: 1}}
              disabled={jobs.length === 0 || !mower}
              onClick={handleStart}
            >
              Start mission
            </Button>
          )}
          {resumable && (
            <Button variant="outlined" color="success" startIcon={<PlayIcon size={16} />} onClick={handleContinue}>
              Continue
            </Button>
          )}
          <Button variant="outlined" color="error" disabled={!missionInProgress} onClick={handleCancel}>
            Cancel
          </Button>
        </Stack>
        {jobs.length > 0 && (
          <Stack direction="row" sx={{px: 1.5, pb: 1.5}}>
            <Button size="small" color="inherit" onClick={clearJobs}>
              Clear all
            </Button>
          </Stack>
        )}
        {missionState && <MissionProgress missionState={missionState} />}
      </CardContent>
    </Card>
  );
}
