'use client';

import type {MowerHeroState} from '@/components/v2/ui/MowingHero';
import {heroSceneForState, isOnLawn, isPlanning, type RobotState, type StateDetail} from '@/lib/v2/robotState';
import {useRobotStateSnapshot} from '@/lib/v2/useRobotStateSnapshot';
import {useSelectedMower} from '@/stores/mowersStore';

export interface RobotStateView {
  state: RobotState;
  heroState: MowerHeroState;
  isMowing: boolean;
  isPaused: boolean;
  /** True only for PLANNING_MISSION -- the "dead Mow button" busy affordance (STATE_COMMAND_MODEL.md
   *  §3). Drives MowingHero's `planning` sweep treatment. */
  isPlanning: boolean;
  isCharging: boolean;
  /** 0-100, already rounded (battery_percentage arrives pre-scaled by stateSchema). */
  batteryPct: number;
  areaName: string | undefined;
  /** 0-100, defined for any on-lawn state (`isOnLawn`: MOWING/PAUSED/PLANNING_MISSION/
   *  RECOVERING) -- undefined the rest of the time rather than a stale or fabricated number.
   *  Prefers the real `state_detail.progress` (W9 §0.6) once the gateway sends it, falling back
   *  to the legacy `current_action_progress` (0-1 fraction) for an old gateway. */
  coveragePct: number | undefined;
  /** Straight passthrough of the snapshot's `state_detail` (progress/phase/eta) -- lets a caller
   *  render "Planning… area 2/5" or a RECOVERING phase line without the hook re-deriving it. */
  stateDetail: StateDetail | undefined;
}

/** THE display hook every state-rendering surface (Home, AppShell, Map) reads from -- the W9 B5
 *  consolidation. `state` comes straight from `useRobotStateSnapshot`, which already falls back
 *  to the legacy `current_state`+`is_charging` mapping for an old gateway (R3/R6) -- so
 *  PLANNING_MISSION/RECOVERING/READY/ERROR render the moment a gateway starts publishing them,
 *  with no second, independently-maintained mapping left to drift out of sync. Battery/area/
 *  progress stay direct store reads here since they're not part of the canonical state envelope
 *  (robot_state/json.state_detail carries progress/phase, but battery% and the area name are
 *  separate top-level fields). */
export function useRobotState(): RobotStateView {
  const snapshot = useRobotStateSnapshot();
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);
  const batteryPercentage = useSelectedMower((s) => s?.state.battery_percentage ?? 0);
  const currentAreaName = useSelectedMower((s) => s?.state.current_area_name);
  const currentActionProgress = useSelectedMower((s) => s?.state.current_action_progress ?? 0);

  const state = snapshot.state;
  const onLawn = isOnLawn(state);

  return {
    state,
    heroState: heroSceneForState(state),
    isMowing: state === 'MOWING',
    isPaused: state === 'PAUSED',
    isPlanning: isPlanning(state),
    isCharging,
    batteryPct: Math.round(batteryPercentage),
    areaName: currentAreaName || undefined,
    coveragePct: onLawn
      ? Math.round(
          snapshot.stateDetail?.progress !== undefined
            ? Math.max(0, Math.min(100, snapshot.stateDetail.progress))
            : Math.max(0, Math.min(1, currentActionProgress)) * 100,
        )
      : undefined,
    stateDetail: snapshot.stateDetail,
  };
}
