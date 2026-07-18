import {DeviceHome} from '@/components/v2/mower/DeviceHome';
import {FeatureGate} from '@/components/v2/ui/FeatureGate';

export default function MowerPage() {
  return (
    <FeatureGate feature="deviceHome">
      <DeviceHome />
    </FeatureGate>
  );
}
