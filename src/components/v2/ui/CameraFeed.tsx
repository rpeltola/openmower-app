import {cn} from '@/components/v2/lib/cn';
import {Camera} from 'lucide-react';

export interface CameraFeedProps {
  label?: string;
  /** Smaller PiP rendering — drops the label chip. */
  compact?: boolean;
  className?: string;
}

/** A camera that EXISTS (per capability), framed as a live-feed placeholder — not
 *  `CameraSlot`'s dashed "not installed" treatment. Still honest (design-language.md §1
 *  "Honest"): no fabricated photo, just a video-shaped frame + a live pill + the camera
 *  glyph, since there's no real stream yet. Hardcoded black/white (not theme tokens) is
 *  intentional here — a camera viewfinder stays dark in both light and dark app themes. */
export function CameraFeed({label = 'Front camera', compact, className}: CameraFeedProps) {
  return (
    <div className={cn('relative flex h-full w-full items-center justify-center bg-black text-white/60', className)}>
      <Camera size={compact ? 20 : 40} strokeWidth={1.5} aria-hidden />
      {!compact ? (
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
          {label}
        </span>
      ) : null}
    </div>
  );
}
