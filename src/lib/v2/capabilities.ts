/** Per-position camera capability — which physical camera slots exist on this hardware. */
export interface CameraCapabilities {
  front: boolean;
  left: boolean;
  rear: boolean;
  right: boolean;
}

/** What the connected mower can actually do. The app must gate features on this instead
 *  of assuming every mower has every part — e.g. the YardForce SA-series has no motorized
 *  cutting-height deck, so "mow height adjustment" isn't a real control for it. */
export interface HardwareCapabilities {
  /** Motorized deck that can raise/lower the cutting height. */
  mowHeightAdjustment: boolean;
  /** Blade motor exists at all (independent of height adjustment — on/off still applies). */
  bladeMotor: boolean;
  rainSensor: boolean;
  cameras: CameraCapabilities;
}

// MOCK — current hardware is the YardForce SA-series. This will come from the gateway/MQTT
// once the device advertises its own capabilities (see V2_STATUS.md "Wire REAL data"); the
// shape here is the target contract, so that swap only touches `useCapabilities` below, not
// any of its call sites.
export const DEVICE_CAPABILITIES: HardwareCapabilities = {
  mowHeightAdjustment: false, // fixed-height deck, no height motor
  bladeMotor: true,
  rainSensor: true,
  cameras: {front: true, left: false, rear: false, right: false}, // one front camera only
};

/** The one place every screen reads hardware capabilities from — gate features on the
 *  returned object (e.g. `if (!caps.mowHeightAdjustment) return null`) rather than
 *  hardcoding assumptions about what the mower has. */
export function useCapabilities(): HardwareCapabilities {
  return DEVICE_CAPABILITIES;
}
