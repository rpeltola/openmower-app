'use client';

import {Alert, Button, Snackbar} from '@mui/material';
import {Serwist} from '@serwist/window';
import {useEffect, useRef, useState} from 'react';

const UPDATE_POLL_INTERVAL_MS = 30 * 60 * 1000;

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID?.slice(0, 7);

export default function PwaManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const serwistRef = useRef<Serwist | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const sw = new Serwist('/sw.js', {scope: '/'});
    serwistRef.current = sw;

    sw.addEventListener('waiting', () => setUpdateAvailable(true));
    // Reload ONLY when an actual update takes control (isUpdate = a SW was already
    // controlling at register time). Without this guard, `clientsClaim` makes the
    // SW claim the page on the FIRST-ever install too → an unwanted reload on the
    // user's first visit. `refreshing` guards against a double reload.
    let refreshing = false;
    sw.addEventListener('controlling', (event) => {
      if (event.isUpdate && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    void sw.register();

    const poll = () => void sw.update();
    const interval = setInterval(poll, UPDATE_POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <Snackbar open={updateAvailable} anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}>
      <Alert
        severity="info"
        variant="filled"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => serwistRef.current?.messageSkipWaiting()}
          >
            Update
          </Button>
        }
      >
        Update available{BUILD_ID ? ` — v${BUILD_ID}` : ''}
      </Alert>
    </Snackbar>
  );
}
