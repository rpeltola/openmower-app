'use client';

import {cn} from '@/components/v2/lib/cn';
import {useState} from 'react';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface JoystickProps {
  size?: number;
  disabled?: boolean;
  onDirectionChange?: (direction: Direction | null) => void;
  /** External direction to highlight alongside touch input — e.g. a gamepad stick driving
   *  the same drive command. Purely visual; doesn't affect pointer handling. */
  activeOverride?: Direction | null;
  className?: string;
}

const ARROWS: Record<Direction, string> = {
  up: 'M74 20 l-8 12 h16 Z',
  down: 'M74 128 l-8 -12 h16 Z',
  left: 'M20 74 l12 -8 v16 Z',
  right: 'M128 74 l-12 -8 v16 Z',
};

// Wedge hit-areas: 60°-wide pie slices centred on each cardinal direction, out to the
// joystick's outer radius — generous touch targets without covering the whole disc.
const HIT_AREAS: Record<Direction, string> = {
  up: 'M74 74 L45.7 26.7 A55 55 0 0 1 102.3 26.7 Z',
  down: 'M74 74 L45.7 121.3 A55 55 0 0 0 102.3 121.3 Z',
  left: 'M74 74 L26.7 45.7 A55 55 0 0 0 26.7 102.3 Z',
  right: 'M74 74 L121.3 45.7 A55 55 0 0 1 121.3 102.3 Z',
};

/** The one d-pad glyph shared by Manual control + Record area (design-language.md "One
 *  control kit"). Static/mock: highlights the pressed direction, no drive command is sent. */
export function Joystick({size = 140, disabled, onDirectionChange, activeOverride, className}: JoystickProps) {
  const [active, setActive] = useState<Direction | null>(null);
  const displayActive = active ?? activeOverride ?? null;

  const press = (dir: Direction | null) => {
    if (disabled) return;
    setActive(dir);
    onDirectionChange?.(dir);
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 148 148"
      role="group"
      aria-label="Directional joystick"
      className={cn('touch-none select-none', disabled && 'opacity-40', className)}
    >
      <circle cx="74" cy="74" r="70" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="74" cy="74" r="26" fill="var(--surface)" stroke="var(--border)" />
      <circle cx="74" cy="74" r="5" fill="var(--accent)" />
      {(Object.keys(ARROWS) as Direction[]).map((dir) => (
        <g key={dir}>
          <path
            d={HIT_AREAS[dir]}
            fill="transparent"
            className={cn(!disabled && 'cursor-pointer')}
            onPointerDown={() => press(dir)}
            onPointerUp={() => press(null)}
            onPointerLeave={() => active === dir && press(null)}
          />
          <path d={ARROWS[dir]} fill={displayActive === dir ? 'var(--accent)' : 'var(--ink-soft)'} className="pointer-events-none" />
        </g>
      ))}
    </svg>
  );
}
