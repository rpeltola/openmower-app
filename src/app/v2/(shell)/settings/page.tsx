import {Settings} from '@/components/v2/Settings';
import {Suspense} from 'react';

export default function SettingsPage() {
  // Settings reads `?category=` (the More → About deep link) via useSearchParams, which
  // requires a Suspense boundary to avoid de-opting the whole route from static rendering.
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
