import type {MissionComposerJob} from '@/components/map/mission/types';
import {jobLabel} from '@/utils/mission-utils';
import type {DraggableSyntheticListeners} from '@dnd-kit/core';
import {Box, IconButton, ListItem, Typography, useTheme} from '@mui/material';
import {GripVerticalIcon, LassoIcon, ScissorsIcon, Trash2Icon} from 'lucide-react';
import DirectionControl from './DirectionControl';
import RepeatsStepper from './RepeatsStepper';

export interface MissionJobRowProps {
  index: number;
  job: MissionComposerJob;
  disabled?: boolean;
  onChange: (patch: Partial<Pick<MissionComposerJob, 'directionDeg' | 'repeats'>>) => void;
  onRemove: () => void;
  ref?: React.Ref<HTMLLIElement>;
  handleRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  listeners?: DraggableSyntheticListeners;
  dragging?: boolean;
}

export default function MissionJobRow({
  index,
  job,
  disabled = false,
  onChange,
  onRemove,
  ref,
  handleRef,
  style,
  listeners,
  dragging = false,
  ...props
}: MissionJobRowProps) {
  const theme = useTheme();
  const Icon = job.type === 'area' ? ScissorsIcon : LassoIcon;

  return (
    <ListItem
      ref={ref}
      style={style}
      {...props}
      sx={{
        display: 'block',
        p: 1.25,
        borderBottom: '1px solid',
        borderColor: theme.palette.divider,
        backgroundColor: dragging ? theme.palette.secondary.main : undefined,
        '&:last-child': {borderBottom: 'none'},
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
        <Typography
          variant="caption"
          sx={{
            width: '1.4rem',
            height: '1.4rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </Typography>
        <Icon size={16} style={{flexShrink: 0, opacity: 0.7}} />
        <Typography variant="body2" fontWeight={600} sx={{flex: 1, minWidth: 0}} noWrap>
          {jobLabel(job)}
        </Typography>
        <IconButton size="small" onClick={onRemove} disabled={disabled} title="Remove job">
          <Trash2Icon size={16} />
        </IconButton>
        {!disabled && (
          <Box
            ref={handleRef}
            {...listeners}
            sx={{
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              touchAction: 'none',
              color: theme.palette.text.secondary,
            }}
          >
            <GripVerticalIcon size={16} />
          </Box>
        )}
      </Box>
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1, pl: '2.2rem'}}>
        <DirectionControl
          valueDeg={job.directionDeg}
          onChange={(directionDeg) => onChange({directionDeg})}
        />
        <RepeatsStepper value={job.repeats} onChange={(repeats) => onChange({repeats})} />
      </Box>
    </ListItem>
  );
}
