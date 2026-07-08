'use client';

import HistoryEventRow from '@/components/history/HistoryEventRow';
import type {MowerEvent} from '@/stores/schemas';
import {EventNote as EventIcon} from '@mui/icons-material';
import {Box, CircularProgress, List, Typography} from '@mui/material';
import {useEffect} from 'react';

interface HistoryEventListProps {
  events: MowerEvent[];
  loading: boolean;
  mapVersionId: number | null;
  activeEventId: string | null;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onHoverEvent: (id: string | null) => void;
}

/** Scrollable, time-ordered list of the selected job's events. Two-way linked to the map's
 * EventMarkers: hovering/clicking a row highlights its marker (via activeEventId, shared with
 * EventMarkers), and clicking a marker scrolls + highlights the matching row here. */
export default function HistoryEventList({
  events,
  loading,
  mapVersionId,
  activeEventId,
  selectedEventId,
  onSelectEvent,
  onHoverEvent,
}: HistoryEventListProps) {
  // Scroll the selected row into view when the selection changed via a map marker click
  // rather than a click on the row itself (which is already in view).
  useEffect(() => {
    if (!selectedEventId) return;
    document.getElementById(`history-event-${selectedEventId}`)?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }, [selectedEventId]);

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0}}>
        <EventIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={600}>
          Events
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({events.length})
        </Typography>
        {loading && <CircularProgress size={14} sx={{ml: 'auto'}} />}
      </Box>
      <Box sx={{flex: 1, overflowY: 'auto', minHeight: 0}}>
        {events.length === 0 && !loading ? (
          <Box sx={{py: 3, textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              No events for this job.
            </Typography>
          </Box>
        ) : (
          <List disablePadding dense onMouseLeave={() => onHoverEvent(null)}>
            {events.map((event) => (
              <HistoryEventRow
                key={event.id}
                event={event}
                hasMarker={event.map_version_id === mapVersionId && event.x != null && event.y != null}
                active={event.id === activeEventId}
                onSelect={(id) => onSelectEvent(id)}
                onHover={onHoverEvent}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
