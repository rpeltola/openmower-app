import withSerwistInit from '@serwist/next';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
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
