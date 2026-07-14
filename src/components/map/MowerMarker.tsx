'use client';

import {useSmoothedPosition} from '@/hooks/useSmoothedPosition';
import {useSelectedMower} from '@/stores/mowersStore';
import type {Datum, Position, RobotFootprint} from '@/stores/schemas';
import MapMarker from './MapMarker';

// Nominal, cosmetic size used by DockingStationMarker to size the (static) dock glyph and the
// small "docked" arrow drawn inside it. This is NOT the robot footprint -- the live robot
// marker is drawn to-scale from the dynamic footprint the gateway publishes in robot_state.
export const MOWER_LENGTH_M = 0.55;

interface MowerArrowProps {
  /** Scale factor relative to full size (default 1) */
  scale?: number;
  fill: string;
}

/**
 * Mower arrow shape centered at (16, 16) in a 32×32 viewBox, pointing up (forward at 0° heading).
 * Half-width=10, half-height=13.
 */
export function MowerArrow({scale = 1, fill}: MowerArrowProps) {
  const cx = 16;
  const cy = 16;
  const hw = 10 * scale;
  const hh = 13 * scale;
  const notch = 6 * scale;
  return (
    <path
      d={`M${cx} ${cy - hh} L${cx + hw} ${cy + hh} L${cx} ${cy + hh - notch} L${cx - hw} ${cy + hh} Z`}
      fill={fill}
      stroke="#fff"
      strokeWidth={2 * scale}
      strokeLinejoin="round"
    />
  );
}

// Colors: normal = OpenMower green, degraded (no position accuracy) = red. White outline +
// soft drop shadow keep it legible over light grass, dark shade, and satellite imagery, in
// both light and dark map themes.
const BODY_GREEN = '#2E9E4B';
const BODY_RED = '#E53935';
const DECK = '#1B5E2E';
const WHEEL = '#212121';
const OUTLINE = '#ffffff';
const PLACEHOLDER = '#607D8B'; // neutral slate for the "footprint unknown" glyph

// Fixed pixel size of the placeholder glyph (it is deliberately NOT metres-scaled, so it never
// implies a real size before the true footprint arrives).
const PLACEHOLDER_PX = 24;

/**
 * Top-down, to-scale silhouette of the robot lawn mower drawn in a 100×100 viewBox with
 * base_link (the origin the marker is anchored/rotated about) at the centre (50,50). Forward
 * (heading 0) points up (−y). The footprint is placed from the gateway-published dimensions:
 * front_m ahead of base_link, rear_m behind, half_width_m to each side.
 */
function MowerBodyIcon({footprint, fill}: {footprint: RobotFootprint; fill: string}) {
  const S = 100;
  const c = S / 2; // base_link at centre
  const front = Math.max(0, footprint.front_m);
  const rear = Math.max(0, footprint.rear_m);
  const halfW = Math.max(0, footprint.half_width_m);
  // Units per metre so the largest extent from base_link maps to half the box (base_link stays
  // centred, so rotation is about base_link and the icon draws to-scale regardless of shape).
  const maxExtent = Math.max(front, rear, halfW) || 1;
  const k = (S / 2) / maxExtent;

  const frontY = c - front * k;
  const rearY = c + rear * k;
  const halfWu = halfW * k;
  const leftX = c - halfWu;
  const rightX = c + halfWu;
  const bodyLen = rearY - frontY;
  const bodyW = rightX - leftX;

  // Front corners more rounded than the rear -> reads as a "nose".
  const rFront = Math.min(bodyW * 0.45, bodyLen * 0.35);
  const rRear = Math.min(bodyW * 0.22, bodyLen * 0.2);

  const body =
    `M ${leftX} ${frontY + rFront}` +
    ` Q ${leftX} ${frontY} ${leftX + rFront} ${frontY}` +
    ` L ${rightX - rFront} ${frontY}` +
    ` Q ${rightX} ${frontY} ${rightX} ${frontY + rFront}` +
    ` L ${rightX} ${rearY - rRear}` +
    ` Q ${rightX} ${rearY} ${rightX - rRear} ${rearY}` +
    ` L ${leftX + rRear} ${rearY}` +
    ` Q ${leftX} ${rearY} ${leftX} ${rearY - rRear}` +
    ` Z`;

  // Cutting-deck hint: a subtle disc set into the body.
  const deckY = frontY + bodyLen * 0.55;
  const deckR = Math.max(bodyW * 0.22, 3);

  // Drive wheels straddling the rear side edges (about the base_link line).
  const wheelY = Math.min(rearY, c); // base_link line, clamped inside the body
  const wheelLen = bodyLen * 0.34;
  const wheelW = Math.max(bodyW * 0.14, 3);
  const wheelR = wheelW / 2;

  // Front bumper band + two "sensor" dots to make the front unmistakable.
  const bumperInset = bodyW * 0.14;
  const bumperY = frontY + bodyLen * 0.06;
  const bumperH = Math.max(bodyLen * 0.11, 3);
  const dotR = Math.max(bodyW * 0.06, 1.2);
  const dotY = frontY + bodyLen * 0.16;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${S} ${S}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="mower-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#mower-shadow)">
        {/* Wheels (under the body) */}
        <rect x={leftX - wheelW / 2} y={wheelY - wheelLen / 2} width={wheelW} height={wheelLen} rx={wheelR} fill={WHEEL} />
        <rect x={rightX - wheelW / 2} y={wheelY - wheelLen / 2} width={wheelW} height={wheelLen} rx={wheelR} fill={WHEEL} />
        {/* Chassis */}
        <path d={body} fill={fill} stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {/* Cutting-deck hint */}
        <circle cx={c} cy={deckY} r={deckR} fill="none" stroke={DECK} strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.9} />
        {/* Front bumper */}
        <rect x={leftX + bumperInset} y={bumperY} width={bodyW - 2 * bumperInset} height={bumperH} rx={bumperH / 2} fill={OUTLINE} opacity={0.9} />
        {/* Front sensor dots */}
        <circle cx={c - bodyW * 0.2} cy={dotY} r={dotR} fill={OUTLINE} />
        <circle cx={c + bodyW * 0.2} cy={dotY} r={dotR} fill={OUTLINE} />
      </g>
    </svg>
  );
}

// Neutral position+heading glyph shown until the real footprint arrives. Fixed pixel size (no
// implied real dimensions); a rounded chevron pointing forward (up at heading 0).
function PlaceholderGlyph({fill}: {fill: string}) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="mower-ph-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <path
        d="M16 4 L26 26 L16 21 L6 26 Z"
        fill={fill}
        stroke={OUTLINE}
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        filter="url(#mower-ph-shadow)"
      />
    </svg>
  );
}

interface MowerMarkerProps {
  position: Position;
  datum: Datum;
}

export default function MowerMarker({position, datum}: MowerMarkerProps) {
  const smoothedPosition = useSmoothedPosition(position);
  const accuracy = useSelectedMower((s) => s?.state.pose?.pos_accuracy);
  // Dimensions come dynamically from ROS (gateway -> robot_state.footprint), never hardcoded.
  const footprint = useSelectedMower((s) => s?.state.footprint);

  const fill = accuracy === 0 ? BODY_RED : BODY_GREEN;
  const heading = smoothedPosition?.heading ?? 0;

  const valid = footprint && (footprint.front_m + footprint.rear_m > 0) && footprint.half_width_m > 0;

  // Placeholder: fixed-size neutral glyph until the real footprint arrives (snaps to true scale
  // on the next robot_state that carries it).
  if (!valid) {
    return (
      <MapMarker
        position={smoothedPosition}
        heading={heading}
        sizeM={0.5}
        minSizePx={PLACEHOLDER_PX}
        maxSizePx={PLACEHOLDER_PX}
        datum={datum}
        className="mower-marker"
      >
        {() => <PlaceholderGlyph fill={PLACEHOLDER} />}
      </MapMarker>
    );
  }

  // The marker Box is a square centred on base_link, big enough to hold the whole footprint
  // (base_link is off-centre when rear_m != front_m, so span = twice the largest extent). The
  // icon inside draws to-scale within it, so the rendered footprint == the real footprint.
  const spanM = 2 * Math.max(footprint.front_m, footprint.rear_m, footprint.half_width_m);
  const lengthM = Math.max(footprint.front_m + footprint.rear_m, 0.01);

  return (
    <MapMarker
      position={smoothedPosition}
      heading={heading}
      sizeM={spanM}
      // Floor so the icon never vanishes far out (footprint length stays >= ~16 px), and a
      // generous ceiling so it can't get absurd when zoomed all the way in.
      minSizePx={Math.round((spanM / lengthM) * 16)}
      maxSizePx={Math.round((spanM / lengthM) * 360)}
      datum={datum}
      className="mower-marker"
    >
      {() => <MowerBodyIcon footprint={footprint} fill={fill} />}
    </MapMarker>
  );
}
