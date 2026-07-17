'use client';

import {Button} from '@/components/v2/ui/Button';
import {Card} from '@/components/v2/ui/Card';
import {Gamepad2, X} from 'lucide-react';
import {useEffect, useState} from 'react';

const STORAGE_KEY = 'v2.control.gamepadTipDismissed';

export interface GamepadTipProps {
  /** Hide immediately once a controller is present — ManualControl shows the connected chip instead. */
  connected: boolean;
  className?: string;
}

/** "Did you know?" discoverability callout for gamepad support (design-language.md info
 *  tone) — shown only while no controller is connected, dismissible, remembers the
 *  dismissal in localStorage (same pattern as Map.tsx's basemap/coverage prefs). */
export function GamepadTip({connected, className}: GamepadTipProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  if (connected || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <Card className={`flex items-start gap-2.5 border-0 bg-info-wash p-3 ${className ?? ''}`}>
      <Gamepad2 size={18} strokeWidth={2.2} className="mt-0.5 flex-none text-info" />
      <p className="flex-1 text-xs leading-snug text-ink-soft">
        <span className="font-semibold text-ink">Did you know?</span> You can plug in or pair
        an Xbox or PS5 controller for smoother manual control.
      </p>
      <Button variant="ghost" size="icon" aria-label="Dismiss tip" className="h-7 w-7 flex-none" onClick={dismiss}>
        <X size={13} strokeWidth={2.4} />
      </Button>
    </Card>
  );
}
