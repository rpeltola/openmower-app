'use client';

import type {MowerHeroState} from '@/components/v2/ui/MowingHero';
import {heroSceneForState, type RobotState} from '@/lib/v2/robotState';
import {useSelectedMower} from '@/stores/mowersStore';

// `current_state` values (mower_logic's HighLevelStatus, folded into robot_state/json) that map
// 1:1 onto our RobotState enum by name. DOCKED is handled separately below since is_charging
// splits it into two RobotState values — same "docked" convention MowerMap.tsx/MowerControls.tsx
// already use. Anything else (older/newer gateway, a value we don't render a dedicated scene
// for yet) falls back to IDLE rather than guessing.
const DIRECT_STATE_MAP: Partial<Record<string, RobotState>> = {
  IDLE: 'IDLE',
  MOWING: 'MOWING',
  PAUSED: 'PAUSED',
  DOCKING: 'DOCKING',
  UNDOCKING: 'UNDOCKING',
  AREA_RECORDING: 'AREA_RECORDING',
  HEADING_CALIBRATION: 'HEADING_CALIBRATION',
};

function toRobotState(currentState: string | undefined, isCharging: boolean): RobotState {
  if (!currentState) return 'IDLE';
  if (currentState === 'DOCKED') return isCharging ? 'DOCKED_CHARGING' : 'DOCKED';
  return DIRECT_STATE_MAP[currentState] ?? 'IDLE';
}

export interface RobotStateView {
  state: RobotState;
  heroState: MowerHeroState;
  isMowing: boolean;
  isCharging: boolean;
  /** 0-100, already rounded (battery_percentage arrives pre-scaled by stateSchema). */
  batteryPct: number;
  areaName: string | undefined;
  /** 0-100, only while actually MOWING — undefined the rest of the time rather than a stale
   *  or fabricated number. */
  coveragePct: number | undefined;
}

/** Real display snapshot derived from `robot_state/json` (via the mowersStore singleton) —
 *  replaces useRobotStateMock.ts as Home/AppShell/Map's live DISPLAY source. Still reads its
 *  vocabulary (RobotState, STATE_COPY, heroSceneForState) from robotState.ts so both stay in
 *  sync. No mower selected / no state yet -> a calm IDLE default, never a crash or a fake scene. */
export function useRobotState(): RobotStateView {
  const currentState = useSelectedMower((s) => s?.state.current_state);
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);
  const batteryPercentage = useSelectedMower((s) => s?.state.battery_percentage ?? 0);
  const currentAreaName = useSelectedMower((s) => s?.state.current_area_name);
  const currentActionProgress = useSelectedMower((s) => s?.state.current_action_progress ?? 0);

  const state = toRobotState(currentState, isCharging);
  const isMowing = state === 'MOWING';

  return {
    state,
    heroState: heroSceneForState(state),
    isMowing,
    isCharging,
    batteryPct: Math.round(batteryPercentage),
    areaName: currentAreaName || undefined,
    coveragePct: isMowing ? Math.round(Math.max(0, Math.min(1, currentActionProgress)) * 100) : undefined,
  };
}
