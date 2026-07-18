import {Schedule} from '@/components/v2/Schedule';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';

export default function SchedulePage() {
  return (
    <FeatureGate feature="schedules">
      <Schedule />
    </FeatureGate>
  );
}
