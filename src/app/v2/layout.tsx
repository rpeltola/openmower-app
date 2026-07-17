import type {Metadata} from 'next';
import {OverscrollLock} from '@/components/v2/OverscrollLock';
import {V2PwaRegister} from '@/components/v2/V2PwaRegister';
import './tailwind.css';

export const metadata: Metadata = {
  title: 'OpenMower — v2',
};

// This layout is nested inside the app's single root layout (src/app/layout.tsx), which
// still owns <html>/<body>. AppChrome (src/components/AppChrome.tsx) detects the /v2 path
// and skips the v1 MUI shell (Navigation, MowerConnectionBanner, ThemeRegistry/CssBaseline)
// around it, so this div is v2's actual visual root — see component-library.md §2.
export default function V2Layout({children}: {children: React.ReactNode}) {
  return (
    // WebkitTapHighlightColor: transparent — kills the mobile browser's default rectangular tap
    // flash (which ignores border-radius, so it squares off round buttons); each button's own
    // rounded :active/hover state provides the press feedback instead. Inherited by all of v2.
    <div className="v2-root" style={{WebkitTapHighlightColor: 'transparent'}}>
      <OverscrollLock />
      <V2PwaRegister />
      {children}
    </div>
  );
}
