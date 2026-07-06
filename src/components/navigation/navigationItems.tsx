import {type NavigationItem} from '@/components/types';
import {
  BugReport as BugReportIcon,
  Dashboard as DashboardIcon,
  Map as MapIcon,
  Sensors as SensorIcon,
  Settings as SettingsIcon,
  Assignment as TaskIcon,
} from '@mui/icons-material';

export function createNavigationItems(): NavigationItem[] {
  const isDev = process.env.NEXT_PUBLIC_IS_DEV === 'true';
  return [
    isDev && {label: 'Dashboard', icon: <DashboardIcon />, path: '/', isGlobal: true},
    {label: 'Map', icon: <MapIcon />, path: '/map', isGlobal: false},
    isDev && {label: 'Tasks', icon: <TaskIcon />, path: '/tasks', isGlobal: false},
    isDev && {label: 'Sensors', icon: <SensorIcon />, path: '/sensors', isGlobal: false},
    {label: 'Settings', icon: <SettingsIcon />, path: '/settings', isGlobal: true},
    {label: 'Debug', icon: <BugReportIcon />, path: '/debug', isGlobal: true},
  ].filter((item): item is NavigationItem => !!item);
}
