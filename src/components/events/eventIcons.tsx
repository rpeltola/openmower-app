'use client';

import type {MowerEvent} from '@/stores/schemas';
import {
  ContentCut as BladesIcon,
  PowerSettingsNew as BootIcon,
  CheckCircle as CheckIcon,
  Home as DockingIcon,
  House as DockedIcon,
  GpsFixed as GpsAvailableIcon,
  GpsOff as GpsUnavailableIcon,
  Layers as AreaIcon,
  NotificationsActive as EmergencyActiveIcon,
  ElectricBolt as MotorFaultIcon,
  HelpOutline as UnknownEventIcon,
  TaskAlt as JobCompleteIcon,
  WrongLocation as NavigationErrorIcon,
  Sync as StateIcon,
  ReportProblem as UndockingFailedIcon,
} from '@mui/icons-material';
import type {ReactElement} from 'react';

export function getEventTypeIcon(type: string): ReactElement {
  switch (type) {
    case 'EMERGENCY':
      return <EmergencyActiveIcon color="error" fontSize="small" />;
    case 'BOOTED':
      return <BootIcon color="primary" fontSize="small" />;
    case 'GPS':
      return <GpsAvailableIcon color="action" fontSize="small" />;
    case 'STATE':
      return <StateIcon color="action" fontSize="small" />;
    case 'BLADES':
      return <BladesIcon color="action" fontSize="small" />;
    case 'DOCKING':
      return <DockingIcon color="action" fontSize="small" />;
    case 'DOCKED':
      return <DockedIcon color="success" fontSize="small" />;
    case 'AREA':
      return <AreaIcon color="action" fontSize="small" />;
    case 'JOB_COMPLETE':
      return <JobCompleteIcon color="success" fontSize="small" />;
    case 'NAVIGATION_ERROR':
      return <NavigationErrorIcon color="error" fontSize="small" />;
    case 'UNDOCKING_FAILED':
      return <UndockingFailedIcon color="warning" fontSize="small" />;
    case 'ESC_FAULT':
      return <MotorFaultIcon color="error" fontSize="small" />;
    default:
      return <UnknownEventIcon color="disabled" fontSize="small" />;
  }
}

export function getEventIcon(event: MowerEvent): ReactElement {
  if (event.type === 'EMERGENCY') {
    return 'active' in event && event.active ? (
      <EmergencyActiveIcon color="error" fontSize="small" />
    ) : (
      <CheckIcon color="success" fontSize="small" />
    );
  }
  if (event.type === 'GPS') {
    return event.available ? (
      <GpsAvailableIcon color="success" fontSize="small" />
    ) : (
      <GpsUnavailableIcon color="disabled" fontSize="small" />
    );
  }
  if (event.type === 'BLADES') {
    return <BladesIcon color={event.enabled ? 'primary' : 'disabled'} fontSize="small" />;
  }
  if (event.type === 'ESC_FAULT') {
    return event.fault_code === 0 ? (
      <CheckIcon color="success" fontSize="small" />
    ) : (
      <MotorFaultIcon color="error" fontSize="small" />
    );
  }
  return getEventTypeIcon(event.type);
}

// Fill colors for the History map's event markers (see components/history/EventMarker) --
// one hue per type, matching the same semantic the MUI icon `color` props above use
// (error/warning/success/primary/action), so the marker and its list-row icon read as the
// same event at a glance.
export function getEventTypeColor(type: string): string {
  switch (type) {
    case 'EMERGENCY':
    case 'NAVIGATION_ERROR':
    case 'ESC_FAULT':
      return '#d32f2f'; // error
    case 'UNDOCKING_FAILED':
      return '#ed6c02'; // warning
    case 'BOOTED':
      return '#1976d2'; // primary
    case 'JOB_COMPLETE':
    case 'DOCKED':
      return '#2e7d32'; // success
    default:
      return '#616161'; // action/grey
  }
}
