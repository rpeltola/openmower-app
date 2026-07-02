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
import {LassoIcon, PlayIcon, SquareXIcon, XIcon} from 'lucide-react';
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

  const missionActive = missionState !== null && ACTIVE_STATES.has(missionState.state);

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

  const handleStart = () => {
    if (!mower || jobs.length === 0 || missionActive) return;
    mower.publishMissionStart(buildMissionPayload(jobs));
  };

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
            disabled={missionActive || areas.length === 0}
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
          <Button variant="outlined" onClick={handleAddArea} disabled={selectedAreaId === '' || missionActive}>
            Add
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
          <Button
            size="small"
            variant={isDrawingSpot ? 'contained' : 'outlined'}
            startIcon={isDrawingSpot ? <SquareXIcon size={16} /> : <LassoIcon size={16} />}
            onClick={toggleSpotDraw}
            disabled={missionActive}
            fullWidth
          >
            {isDrawingSpot ? 'Cancel drawing' : 'Draw spot mow area'}
          </Button>
        </Stack>

        {jobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{p: 2}}>
            Add a saved area or draw a spot-mow region on the map to build a mission.
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
                    disabled={missionActive}
                    onChange={(patch) => updateJob(job.id, patch)}
                    onRemove={() => removeJob(job.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </List>
        )}

        <Stack direction="row" spacing={1} sx={{p: 1.5, mt: 'auto'}}>
          <Button
            variant="contained"
            color="success"
            startIcon={<PlayIcon size={16} />}
            fullWidth
            disabled={jobs.length === 0 || missionActive || !mower}
            onClick={handleStart}
          >
            Start mission
          </Button>
          <Button variant="outlined" color="error" disabled={!missionActive} onClick={handleCancel}>
            Cancel
          </Button>
        </Stack>
        {jobs.length > 0 && !missionActive && (
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
