import {defaultCache} from '@serwist/next/worker';
import type {PrecacheEntry, SerwistGlobalConfig} from 'serwist';
import {Serwist} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// skipWaiting is false: a newly installed worker waits until the app tells it to take
// over (see PwaManager.tsx), so an in-progress session isn't yanked out from under the
// user mid-use. serwist.addEventListeners() wires up the 'SKIP_WAITING' message handler
// that PwaManager's messageSkipWaiting() call triggers.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
