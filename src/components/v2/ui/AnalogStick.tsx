'use client';

import {cn} from '@/components/v2/lib/cn';
import {useRef, useState} from 'react';

export interface StickVector {
  x: number;
  y: number;
}

export interface AnalogStickProps {
  size?: number;
  disabled?: boolean;
  onChange?: (vec: StickVector) => void;
  /** External {x,y} to render alongside touch drag — e.g. a gamepad stick driving the same
   *  drive command. Ignored while the thumb is actively being dragged by touch/pointer. */
  activeOverride?: StickVector | null;
  className?: string;
}

const ZERO: StickVector = {x: 0, y: 0};

/** The analog alternative to the `Joystick` clickpad (design-language.md "One control
 *  kit" — same drive-command contract, different feel): a draggable thumb reporting
 *  proportional 2D magnitude/direction in [-1,1], snapping back to center on release.
 *  Pointer-based so it works for touch + mouse + (via `activeOverride`) a gamepad stick. */
export function AnalogStick({size = 140, disabled, onChange, activeOverride, className}: AnalogStickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<StickVector>(ZERO);
  const [dragging, setDragging] = useState(false);

  const thumbSize = size * 0.34;
  const radius = (size - thumbSize) / 2;

  const emit = (next: StickVector) => {
    setPos(next);
    onChange?.(next);
  };

  const fromPointer = (e: React.PointerEvent<HTMLDivElement>): StickVector => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return ZERO;
    const dx = (e.clientX - (rect.left + rect.width / 2)) / radius;
    const dy = (e.clientY - (rect.top + rect.height / 2)) / radius;
    const mag = Math.hypot(dx, dy);
    return mag > 1 ? {x: dx / mag, y: dy / mag} : {x: dx, y: dy};
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    emit(fromPointer(e));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return;
    emit(fromPointer(e));
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    emit(ZERO);
  };

  const display = dragging ? pos : (activeOverride ?? pos);

  return (
    <div
      ref={baseRef}
      role="group"
      aria-label="Analog joystick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        'relative touch-none select-none rounded-full border border-border bg-surface-2',
        disabled && 'opacity-40',
        className,
      )}
      style={{width: size, height: size}}
    >
      <div
        aria-hidden
        className="absolute rounded-full bg-accent shadow-[var(--shadow-s)]"
        style={{
          width: thumbSize,
          height: thumbSize,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${display.x * radius}px, ${display.y * radius}px)`,
          transition: dragging ? 'none' : 'transform 150ms ease-out',
        }}
      />
    </div>
  );
}
