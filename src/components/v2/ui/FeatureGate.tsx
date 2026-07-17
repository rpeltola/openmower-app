'use client';

import {cn} from '@/components/v2/lib/cn';
import {Chip} from '@/components/v2/ui/Chip';
import {
  FEATURE_SUPPORT,
  isFeatureSupported,
  useShowUnsupportedFeatures,
  type FeatureId,
} from '@/lib/v2/featureSupport';
import {type ReactNode} from 'react';

export interface FeatureGateProps {
  /** Which `featureSupport.ts` (L3) entry gates this control. */
  feature: FeatureId;
  children: ReactNode;
  className?: string;
}

/** L3 gate for a control the backend doesn't support yet (STATE_COMMAND_MODEL.md §4). Supported
 *  features render straight through with no wrapper at all. Unsupported ones are hidden entirely
 *  by default; the Settings → General dev toggle "Show controls not yet supported by your
 *  mower" reveals them greyed out and inert, tagged with why — which doubles as the live,
 *  in-app list of what the backend still owes. */
export function FeatureGate({feature, children, className}: FeatureGateProps) {
  const showUnsupported = useShowUnsupportedFeatures();

  if (isFeatureSupported(feature)) return <>{children}</>;
  if (!showUnsupported) return null;

  const {reason} = FEATURE_SUPPORT[feature];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="pointer-events-none opacity-45 grayscale">{children}</div>
      <div className="flex items-start gap-1.5">
        <Chip variant="neutral">Not supported by your mower&apos;s software yet</Chip>
      </div>
      {reason ? <p className="text-[.72rem] leading-[1.4] text-ink-faint">{reason}</p> : null}
    </div>
  );
}
