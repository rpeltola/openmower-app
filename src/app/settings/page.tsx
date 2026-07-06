'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useSelectedMower} from '@/stores/mowersStore';
import {Typography} from '@mui/material';
import {AudioFilesCard} from './AudioFilesCard';
import {SettingsForm} from './SettingsForm';

export default function SettingsPage() {
  const supportsAudio = useSelectedMower((s) => s?.hasCapability('audio') ?? false);

  // The full configuration form is still a work-in-progress placeholder (its Save is a stub and
  // it depends on a config schema the backend does not serve yet), so only surface it in dev
  // builds. A normal Settings page hosts the (working) audio management widget on V2 hardware.
  const isDev = process.env.NEXT_PUBLIC_IS_DEV === 'true';
  if (isDev) {
    return <SettingsForm />;
  }

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Manage your mower" />
      <PageContent>
        {supportsAudio ? (
          <AudioFilesCard />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select an audio-capable (V2) mower to manage audio files.
          </Typography>
        )}
      </PageContent>
    </Page>
  );
}
