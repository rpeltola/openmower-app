import {OnboardingScreen} from '@/components/v2/states/OnboardingScreen';

// A sibling of `/v2/control` — outside the `(shell)` route group, since onboarding is a
// pre-app setup flow with no tab bar (mobile-architecture.md §5's "More → onboarding
// re-run"). TODO: this renders the static mock screen only; gating real entry to it on a
// live BOOTING/onboarding-incomplete state (ux-state-architecture.md) is out of scope here —
// it needs the live state source another workstream owns.
export default function OnboardingPage() {
  return <OnboardingScreen />;
}
