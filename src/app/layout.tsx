import {loadAppConfig} from '@/lib/actions';
import {AppRouterCacheProvider} from '@mui/material-nextjs/v15-appRouter';
import type {Metadata, Viewport} from 'next';
import {Roboto} from 'next/font/google';
import AppChrome from '../components/AppChrome';
import {ConfigInitializer} from '../components/ConfigInitializer';
import './globals.css';

export const dynamic = 'force-dynamic';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'OpenMower App',
  description: 'Control and monitor your OpenMower robotic lawnmower',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OpenMower',
  },
};

export const viewport: Viewport = {
  themeColor: '#4CAF50',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await loadAppConfig();
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Runs before React hydrates — sets body background immediately so the
            blank-before-mount period matches the final theme colour */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');document.body.style.background=d?'#121212':'#fafafa';}catch(e){}})()`,
          }}
        />
        <ConfigInitializer config={config} />
        <AppRouterCacheProvider>
          <AppChrome>{children}</AppChrome>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
