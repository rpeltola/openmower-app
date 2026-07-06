'use client';

import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {Alert, Button} from '@mui/material';

export default function MowerConnectionBanner() {
  const mowerId = useSelectedMower((s) => s?.id);
  const status = useMowersStore((s) => (mowerId ? s.mqttStatuses[mowerId] : undefined));
  const reconnectNow = useMowersStore((s) => s.reconnectNow);

  if (!status || status === 'connected') {
    return null;
  }

  return (
    <Alert
      severity="warning"
      sx={{position: 'sticky', top: 0, zIndex: (theme) => theme.zIndex.appBar + 1, borderRadius: 0}}
      action={
        <Button color="inherit" size="small" onClick={reconnectNow}>
          Reconnect now
        </Button>
      }
    >
      {status === 'reconnecting' ? 'Reconnecting…' : 'Mower offline — retrying every 30s…'}
    </Alert>
  );
}
