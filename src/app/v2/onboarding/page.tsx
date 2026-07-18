import {OnboardingScreen} from '@/components/v2/states/OnboardingScreen';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';

// A sibling of `/v2/control` — outside the `(shell)` route group, since onboarding is a
// pre-app setup flow with no tab bar (mobile-architecture.md §5's "More → onboarding
// re-run"). Gated behind the `onboarding` L3 feature (R1 gate audit): every step + action on
// this screen is static mock, wired to nothing. TODO: gating real entry to it on a live
// BOOTING/onboarding-incomplete state (ux-state-architecture.md) is out of scope here — it
// needs the live state source another workstream owns.
export default function OnboardingPage() {
  return (
    <FeatureGate feature="onboarding">
      <OnboardingScreen />
    </FeatureGate>
  );
}
