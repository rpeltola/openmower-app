import type {DockingStation} from '@/stores/schemas';
import {Box, ListItem, Typography, useTheme} from '@mui/material';
import {HousePlugIcon} from 'lucide-react';

// The orange used for the docking-station map marker (see DockingStationMarker), so the list
// icon reads as the same object on the map.
const DOCK_COLOR = '#F5A523';

export interface DockingStationItemProps {
  station: DockingStation;
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
}

// A list row for a docking station, styled to match AreaItem so areas and docks read as one
// list. Docks aren't reorderable (their draw order is irrelevant), so there's no drag handle.
export default function DockingStationItem({
  station,
  selected = false,
  hovered = false,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: DockingStationItemProps) {
  const theme = useTheme();
  const inactive = station.properties.active === false;
  return (
    <ListItem
      onClick={onSelect ? (e) => onSelect(station.id, e) : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        p: 0,
        cursor: onSelect ? 'pointer' : 'default',
        borderBottom: '1px solid',
        borderColor: theme.palette.divider,
        backgroundColor: selected
          ? theme.palette.mode === 'dark'
            ? theme.palette.secondary.main
            : theme.palette.secondary.dark
          : hovered
            ? theme.palette.secondary.main
            : undefined,
        color: selected ? theme.palette.secondary.contrastText : undefined,
        opacity: inactive ? 0.5 : 1,
        touchAction: 'pan-y',
        '&:last-child': {
          borderBottom: 'none',
        },
        ...(onSelect && {
          '&:hover': {
            backgroundColor: theme.palette.secondary.main,
            color: theme.palette.secondary.contrastText,
          },
        }),
      }}
    >
      <Box sx={{width: '100%', display: 'flex'}}>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', pl: 2, color: DOCK_COLOR}}>
          <HousePlugIcon size={18} strokeWidth={2} />
        </Box>
        <Box sx={{flex: 1, px: 1.5, py: 1}}>
          <Typography variant="h6" fontWeight="600">
            {station.properties.name ?? 'Docking station'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Docking station{inactive ? ' • Inactive' : ''}
          </Typography>
        </Box>
      </Box>
    </ListItem>
  );
}
