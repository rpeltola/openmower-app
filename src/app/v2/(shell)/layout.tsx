import {AppShell} from '@/components/v2/AppShell';

// Route group (no URL segment) that wraps the tabbed v2 routes — Home, and later
// Map/Schedule/Activity/Diagnostics/Settings/More — in the responsive AppShell
// (bottom tab bar ↔ sidebar, component-library.md §4.2). /v2/control lives as a sibling
// OUTSIDE this group: it's a full-screen task with its own Close, not a tabbed screen.
export default function ShellLayout({children}: {children: React.ReactNode}) {
  return <AppShell>{children}</AppShell>;
}
