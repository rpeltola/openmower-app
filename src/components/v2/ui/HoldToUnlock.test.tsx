import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import {HoldToUnlock} from '@/components/v2/ui/HoldToUnlock';

// This project's jsdom (25.x) has no PointerEvent constructor at all -- fireEvent.pointerDown/
// Move/Up fall back to a bare `Event` that drops eventInit properties like clientX (confirmed by
// hand: `'PointerEvent' in new JSDOM().window` is false). Firing plain `MouseEvent`s typed as
// "pointerdown"/"pointermove"/"pointerup" instead works fine -- native dispatch matches listeners
// by the `type` string only, and MouseEvent does carry `clientX` -- so that's what drives the
// SlideToUnlock drag gesture below.
function firePointer(el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup', clientX = 0) {
  fireEvent(el, new MouseEvent(type, {bubbles: true, clientX}));
}

// jsdom doesn't implement pointer capture -- HoldToUnlock's drag gesture (SlideToUnlock) calls
// `setPointerCapture` unconditionally on pointerdown, which would otherwise throw in these tests.
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

function mockDesktop(isDesktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isDesktop,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('HoldToUnlock — landscape text-selection fix', () => {
  afterEach(cleanup);

  describe('PressHold (desktop press-and-hold gesture)', () => {
    beforeEach(() => {
      mockDesktop(true);
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('is unselectable (select-none class + inline anti-select/touch styles) and blocks the context menu', () => {
      const {getByRole} = render(<HoldToUnlock unlocked={false} onUnlock={vi.fn()} />);
      const button = getByRole('button');

      expect(button.className).toContain('select-none');
      expect(button.style.userSelect).toBe('none');
      expect(button.style.touchAction).toBe('none');
      // The WebkitUserSelect/WebkitTouchCallout inline styles are also set (see the component --
      // jsdom's style engine just doesn't recognize those vendor-prefixed properties to assert on
      // here; real browsers do).

      const contextMenuEvent = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
      button.dispatchEvent(contextMenuEvent);
      expect(contextMenuEvent.defaultPrevented).toBe(true);
    });

    it('still fills and unlocks after a full hold, and cancels (no unlock, fill resets) on an early release', () => {
      const onUnlock = vi.fn();
      const {getByRole, container} = render(<HoldToUnlock unlocked={false} onUnlock={onUnlock} holdMs={900} />);
      const button = getByRole('button');
      const fill = container.querySelector('[aria-hidden]') as HTMLElement;

      fireEvent.pointerDown(button);
      expect(fill.style.width).toBe('100%');
      expect(onUnlock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(900);
      expect(onUnlock).toHaveBeenCalledTimes(1);
    });

    it('cancels the hold (no unlock) when released early', () => {
      const onUnlock = vi.fn();
      const {getByRole, container} = render(<HoldToUnlock unlocked={false} onUnlock={onUnlock} holdMs={900} />);
      const button = getByRole('button');
      const fill = container.querySelector('[aria-hidden]') as HTMLElement;

      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);
      vi.advanceTimersByTime(900);

      expect(onUnlock).not.toHaveBeenCalled();
      expect(fill.style.width).toBe('0%');
    });
  });

  describe('SlideToUnlock (mobile drag gesture)', () => {
    beforeEach(() => {
      mockDesktop(false);
      vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 44,
        top: 0,
        left: 0,
        right: 200,
        bottom: 44,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect);
    });
    afterEach(() => vi.restoreAllMocks());

    it('the draggable knob and track are unselectable (select-none/touch-none + inline styles)', () => {
      const {container} = render(<HoldToUnlock unlocked={false} onUnlock={vi.fn()} />);
      const track = container.firstChild as HTMLElement;
      const knob = track.querySelector('.touch-none') as HTMLElement;

      expect(track.className).toContain('select-none');
      expect(knob.className).toContain('touch-none');
      expect(knob.className).toContain('select-none');
      expect(knob.style.userSelect).toBe('none');
      expect(knob.style.touchAction).toBe('none');

      const contextMenuEvent = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
      knob.dispatchEvent(contextMenuEvent);
      expect(contextMenuEvent.defaultPrevented).toBe(true);
    });

    it('still unlocks on a full slide past the threshold', () => {
      const onUnlock = vi.fn();
      const {container} = render(<HoldToUnlock unlocked={false} onUnlock={onUnlock} />);
      const track = container.firstChild as HTMLElement;
      const knob = track.querySelector('.touch-none') as HTMLElement;

      firePointer(knob, 'pointerdown', 0);
      firePointer(knob, 'pointermove', 178);
      firePointer(knob, 'pointerup');

      expect(onUnlock).toHaveBeenCalledTimes(1);
    });

    it('does not unlock on a short slide', () => {
      const onUnlock = vi.fn();
      const {container} = render(<HoldToUnlock unlocked={false} onUnlock={onUnlock} />);
      const track = container.firstChild as HTMLElement;
      const knob = track.querySelector('.touch-none') as HTMLElement;

      firePointer(knob, 'pointerdown', 0);
      firePointer(knob, 'pointermove', 30);
      firePointer(knob, 'pointerup');

      expect(onUnlock).not.toHaveBeenCalled();
    });
  });
});
