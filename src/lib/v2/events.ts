import {type ActivityEvent} from '@/components/v2/ui/ActivityFeedCard';
import {type Tone} from '@/lib/v2/robotState';
import {getEventLabel, getEventTypeLabel} from '@/stores/mowerEvents';
import type {MowerEvent} from '@/stores/schemas';
import {
  ArrowDownToLine,
  CheckCircle2,
  HelpCircle,
  Layers,
  type LucideIcon,
  Power,
  RefreshCw,
  SatelliteDish,
  Scissors,
  SignalZero,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import {createElement} from 'react';

/**
 * Icon + tone per event, mirroring the semantics in components/events/eventIcons.tsx
 * (EMERGENCY/GPS/BLADES/ESC_FAULT swap icon or tone by outcome; every other type is one
 * icon per `type`) -- reproduced with lucide icons and V2's tone vocabulary (see
 * lib/v2/robotState.ts's STATE_COPY/REASON_COPY, reused here for BOOTED/DOCKING so the same
 * real-world condition always reads the same way across the app) instead of MUI's color props.
 */
function iconAndTone(event: MowerEvent): {icon: LucideIcon; tone: Tone} {
  switch (event.type) {
    case 'EMERGENCY':
      return event.active ? {icon: TriangleAlert, tone: 'danger'} : {icon: CheckCircle2, tone: 'accent'};
    case 'BOOTED':
      return {icon: Power, tone: 'neutral'};
    case 'GPS':
      return event.available ? {icon: SatelliteDish, tone: 'accent'} : {icon: SignalZero, tone: 'warn'};
    case 'STATE':
      return {icon: RefreshCw, tone: 'neutral'};
    case 'BLADES':
      return {icon: Scissors, tone: event.enabled ? 'accent' : 'neutral'};
    case 'DOCKING':
      return {icon: ArrowDownToLine, tone: 'info'};
    case 'AREA':
      return {icon: Layers, tone: 'neutral'};
    case 'ESC_FAULT':
      return Number(event.fault_code) === 0 ? {icon: CheckCircle2, tone: 'accent'} : {icon: Zap, tone: 'danger'};
    default:
      return {icon: HelpCircle, tone: 'neutral'};
  }
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

/**
 * Turns one real MowerEvent (see hooks/useMowerEvents) into the {icon, tone, text, time}
 * shape ActivityFeedCard/EventTimeline/EventMap render. `text` comes straight from
 * stores/mowerEvents' getEventLabel -- the same copy v1's Events/History pages show -- only
 * the icon/tone are re-picked for V2's lucide + tone vocabulary. Carries no map position: a
 * single event has no frame to normalize its {x,y} against (see mowerEventsToActivityEvents,
 * which does).
 */
export function mowerEventToActivityEvent(event: MowerEvent): ActivityEvent {
  const {icon, tone} = iconAndTone(event);
  return {
    id: event.id,
    icon: createElement(icon, {size: 14, strokeWidth: 2.2}),
    tone,
    text: getEventLabel(event),
    time: formatEventTime(event.t),
    type: getEventTypeLabel(event.type),
  };
}

interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Percent-canvas margin so pins never sit flush against EventMap's illustrated garden edge.
const MAP_MARGIN_PCT = 15;
const MAP_SPAN_PCT = 100 - 2 * MAP_MARGIN_PCT;

/**
 * Normalizes one event's real local-frame {x,y} metres (see baseEventSchema) into the 0-100
 * percent position EventMap plots pins at, scaled to the bounding box of the events passed to
 * mowerEventsToActivityEvents. This isn't a real garden outline -- just the events' relative
 * layout stretched to fill the illustrated canvas. Y is flipped: map-frame y grows north/up,
 * the canvas grows down.
 */
function toMapPosition(x: number, y: number, bounds: MapBounds): {x: number; y: number} {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  return {
    x: spanX > 0 ? MAP_MARGIN_PCT + ((x - bounds.minX) / spanX) * MAP_SPAN_PCT : 50,
    y: spanY > 0 ? 100 - MAP_MARGIN_PCT - ((y - bounds.minY) / spanY) * MAP_SPAN_PCT : 50,
  };
}

/**
 * Display list for a date/range: maps every event via mowerEventToActivityEvent, then fills
 * in `location` for the ones with a recorded position (guarded -- events without a fix at
 * record time have x/y null and stay pin-less on the Events map view) by normalizing them
 * against the bounding box of this same list.
 */
export function mowerEventsToActivityEvents(events: MowerEvent[]): ActivityEvent[] {
  const coords = events.flatMap((e) => (e.x != null && e.y != null ? [{x: e.x, y: e.y}] : []));
  const bounds: MapBounds | null =
    coords.length > 0
      ? {
          minX: Math.min(...coords.map((c) => c.x)),
          maxX: Math.max(...coords.map((c) => c.x)),
          minY: Math.min(...coords.map((c) => c.y)),
          maxY: Math.max(...coords.map((c) => c.y)),
        }
      : null;

  return events.map((event) => {
    const base = mowerEventToActivityEvent(event);
    if (!bounds || event.x == null || event.y == null) return base;
    return {...base, location: toMapPosition(event.x, event.y, bounds)};
  });
}
