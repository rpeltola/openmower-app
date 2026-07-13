import withSerwistInit from '@serwist/next';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Next 16 blocks cross-origin dev requests (HMR socket + server actions) unless the
  // origin you browse from is whitelisted. Allow the VM's LAN IP so the app works when
  // opened from another machine at http://192.168.1.132:3000 (localhost is allowed by
  // default, so an SSH tunnel to localhost:3000 also works). Dev-only; ignored in prod.
  allowedDevOrigins: ['192.168.1.132'],
  transpilePackages: ['@mapbox/mapbox-gl-draw', 'mqtt'],
  // Serwist injects a webpack() config (needed for the production build's manifest
  // injection, see package.json's "build" script). Serwist itself is disabled in dev, but
  // `next dev` still defaults to Turbopack, which otherwise refuses to start when a
  // webpack config is present without an explicit Turbopack opt-in.
  turbopack: {},
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
