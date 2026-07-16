'use client';

import {Box} from '@mui/material';
import {usePathname} from 'next/navigation';
import {DialogProvider} from 'react-dialog-async';
import Navigation from './navigation/Navigation';
import MowerConnectionBanner from './pwa/MowerConnectionBanner';
import PwaManager from './pwa/PwaManager';
import ThemeRegistry from './ThemeRegistry';

// Coexistence boundary between v1 (MUI) and v2 (Tailwind/shadcn) — component-library.md §2.
// v1's chrome (MUI CssBaseline reset, Navigation sidebar/bottom-bar, the fixed 100dvh Box
// shell) only ever mounts for non-/v2 routes; /v2 renders its own children untouched so
// v1's reset can never clobber v2's tokens/utilities, and vice versa.
export default function AppChrome({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const isV2 = pathname?.startsWith('/v2');

  if (isV2) {
    return <>{children}</>;
  }

  return (
    <ThemeRegistry>
      <DialogProvider>
        <PwaManager />
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100dvh'}}>
          <MowerConnectionBanner />
          <Box sx={{display: 'flex', flex: 1, minHeight: 0}}>
            <Navigation />
            <Box
              component="main"
              sx={{
                flex: 1,
                pb: {xs: 7, md: 0}, // Account for mobile bottom navigation
                margin: 0,
                padding: 0,
                width: '100%',
                overflow: 'auto',
                overflowAnchor: 'none',
              }}
            >
              {children}
            </Box>
          </Box>
        </Box>
      </DialogProvider>
    </ThemeRegistry>
  );
}
