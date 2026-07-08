'use client';

import {getEventTypeColor, getEventTypeIcon} from '@/components/events/eventIcons';
import type {Datum, MowerEvent} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute, type UtmPoint} from '@/utils/coordinates';
import {Box} from '@mui/material';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import {RMarker} from 'maplibre-react-components';
import {cloneElement, useMemo, type ReactElement} from 'react';

interface EventMarkerProps {
  event: MowerEvent;
  utmDatum: UtmPoint;
  active: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function EventMarker({event, utmDatum, active, onSelect, onHover}: EventMarkerProps) {
  const absPosition = useMemo(
    () => (event.x != null && event.y != null ? pointToAbsolute({x: event.x, y: event.y}, utmDatum) : null),
    [event.x, event.y, utmDatum],
  );

  if (!absPosition) return null;

  const size = active ? 26 : 20;
  const color = getEventTypeColor(event.type);
  const icon = cloneElement(getEventTypeIcon(event.type) as ReactElement<SvgIconProps>, {
    color: 'inherit',
    sx: {fontSize: active ? 16 : 13, color: '#fff'},
  });

  return (
    <RMarker longitude={absPosition[0]} latitude={absPosition[1]}>
      <Box
        onClick={() => onSelect(event.id)}
        onMouseEnter={() => onHover(event.id)}
        onMouseLeave={() => onHover(null)}
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: color,
          border: '2px solid white',
          boxShadow: active ? '0 0 0 3px rgba(25,118,210,0.55)' : '0 1px 4px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'width 0.1s, height 0.1s, box-shadow 0.1s',
          zIndex: active ? 2 : 1,
        }}
      >
        {icon}
      </Box>
    </RMarker>
  );
}

interface EventMarkersProps {
  events: MowerEvent[];
  datum: Datum;
  mapVersionId: number | null;
  activeEventId: string | null;
  onSelectEvent: (id: string) => void;
  onHoverEvent: (id: string | null) => void;
}

/**
 * Places the selected job's events on the History map -- one marker per event that both has a
 * known position (x/y, local map-frame metres) AND was recorded against the map version
 * currently displayed (map_version_id matches); events without either just stay list-only (see
 * HistoryEventList). Two-way linked to the event list via activeEventId (hover OR selection).
 */
export default function EventMarkers({
  events,
  datum,
  mapVersionId,
  activeEventId,
  onSelectEvent,
  onHoverEvent,
}: EventMarkersProps) {
  const utmDatum = useMemo(() => datumToRelative([datum.long, datum.lat]), [datum]);

  const placeable = useMemo(
    () => events.filter((e) => e.map_version_id === mapVersionId && e.x != null && e.y != null),
    [events, mapVersionId],
  );

  return (
    <>
      {placeable.map((event) => (
        <EventMarker
          key={event.id}
          event={event}
          utmDatum={utmDatum}
          active={event.id === activeEventId}
          onSelect={onSelectEvent}
          onHover={onHoverEvent}
        />
      ))}
    </>
  );
}
