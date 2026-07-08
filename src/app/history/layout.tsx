'use client';

import {RMapContextProvider} from 'maplibre-react-components';

// HistoryMap (see components/history/HistoryMap) needs maplibre-react-components' own registry
// in scope for its useMap/useControl/RMarker usage -- mirrors app/map/layout.tsx. Unlike that
// route, the app-level MapContextProvider is NOT hoisted here: HistoryMap owns its own instance
// (see its doc comment), so no page in this route needs useMapContext() directly.
export default function HistoryLayout({children}: {children: React.ReactNode}) {
  return <RMapContextProvider>{children}</RMapContextProvider>;
}
