'use client';

import {useMap, useMapboxDraw, useMapContext} from '@/contexts/MapContext';
import {type Datum} from '@/stores/schemas';
import MapMarker from './MapMarker';
import {MOWER_LENGTH_M, MowerArrow} from './MowerMarker';

const DOCK_PADDING_M = 0.45;
const DOCK_SIZE_M = MOWER_LENGTH_M + DOCK_PADDING_M;

interface DockingStation {
  id: string;
  position: {x: number; y: number};
  heading: number;
}

interface DockingStationMarkerProps {
  station: DockingStation;
  datum: Datum;
  isDocked?: boolean;
}

export default function DockingStationMarker({station, datum, isDocked = false}: DockingStationMarkerProps) {
  const {editMode} = useMapContext();
  const draw = useMapboxDraw();
  const map = useMap();

  // A docking station's Draw feature is a 2-point LineString whose connecting segment is
  // intentionally hidden (see drawStyles.ts), so gl-draw has no rendered geometry to
  // hit-test -- clicking on the map can't select it, which left Settings/Delete perpetually
  // disabled. This marker overlay sits on top of that geometry, so make it the selection
  // handle in edit mode: select the underlying feature the same way AreasList does.
  const handleSelect = (event: React.MouseEvent) => {
    if (!editMode || !draw || !map) return;
    event.stopPropagation();
    draw.changeMode('simple_select', {featureIds: [station.id]});
    // changeMode with featureIds suppresses draw.selectionchange, so fire it manually to
    // keep useMapSelection() (and the Settings/Delete buttons) in sync.
    const feature = draw.get(station.id);
    map.fire('draw.selectionchange', {features: feature ? [feature] : []});
  };

  return (
    <MapMarker
      position={station.position}
      heading={station.heading}
      sizeM={DOCK_SIZE_M}
      datum={datum}
      className="docking-station-marker"
    >
      {(sizePx) => {
        const opacity = isDocked ? 0.6 : 0.3;
        return (
          <svg
            width={sizePx}
            height={sizePx}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onClick={editMode ? handleSelect : undefined}
            style={editMode ? {cursor: 'pointer', pointerEvents: 'all'} : undefined}
          >
            <path
              d="M16 2 L30 14 L26 14 L26 29 L6 29 L6 14 L2 14 Z"
              fill="#F5A523"
              fillOpacity={opacity}
              stroke="#F5A523"
              strokeWidth={1.5}
              strokeOpacity={opacity}
              strokeLinejoin="round"
            />
            <path
              d="M7.5 13.75 L24.5 13.75 M13 28 L13 22 L19 22 L19 28"
              stroke="#F5A523"
              strokeWidth={0.75}
              strokeOpacity={opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {isDocked && <MowerArrow scale={MOWER_LENGTH_M / DOCK_SIZE_M} fill="#4CAF50" />}
          </svg>
        );
      }}
    </MapMarker>
  );
}
