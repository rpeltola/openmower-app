'use client';

import {getEventIcon} from '@/components/events/eventIcons';
import {formatEventAttributeChip, getEventLabel, getOrderedEventExtraAttributeEntries} from '@/stores/mowerEvents';
import type {MowerEvent} from '@/stores/schemas';
import {PlaceOutlined as PlacedIcon} from '@mui/icons-material';
import {Box, Chip, ListItem, Tooltip, Typography} from '@mui/material';

interface HistoryEventRowProps {
  event: MowerEvent;
  hasMarker: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** One event in the History page's event list -- two-way linked to its EventMarker on the map
 * via `active` (hover OR selection) and the onSelect/onHover callbacks (see HistoryEventList /
 * EventMarkers, which share the same selected/hovered event id). */
export default function HistoryEventRow({event, hasMarker, active, onSelect, onHover}: HistoryEventRowProps) {
  const icon = getEventIcon(event);
  const extraEntries = getOrderedEventExtraAttributeEntries(event);

  return (
    <ListItem
      id={`history-event-${event.id}`}
      alignItems="center"
      disableGutters
      onClick={() => onSelect(event.id)}
      onMouseEnter={() => onHover(event.id)}
      onMouseLeave={() => onHover(null)}
      sx={{
        px: 1,
        py: 0.5,
        gap: 1,
        cursor: 'pointer',
        borderRadius: 1,
        bgcolor: active ? 'action.selected' : 'transparent',
        '&:hover': {bgcolor: 'action.hover'},
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: '3.25rem'}}
      >
        {formatEventTime(event.t)}
      </Typography>
      <Box sx={{display: 'flex', flexShrink: 0, alignItems: 'center'}}>{icon}</Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.75,
          rowGap: 0.25,
        }}
      >
        <Typography variant="body2" fontWeight={600} sx={{minWidth: 0}}>
          {getEventLabel(event)}
        </Typography>
        {extraEntries.map(([key, value]) => (
          <Chip
            key={key}
            size="small"
            variant="outlined"
            label={formatEventAttributeChip(key, value)}
            sx={{height: 20, fontSize: '0.7rem'}}
          />
        ))}
      </Box>
      {hasMarker && (
        <Tooltip title="Shown on the map">
          <PlacedIcon fontSize="small" color={active ? 'primary' : 'disabled'} sx={{flexShrink: 0}} />
        </Tooltip>
      )}
    </ListItem>
  );
}
