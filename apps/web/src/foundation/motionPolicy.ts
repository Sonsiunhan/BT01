import type { QualityTier } from "./qualityTier";

export type MotionPolicy = {
  ambient: boolean;
  events: boolean;
};

export type MotionPolicyInput = {
  tier: QualityTier;
  reducedMotion: boolean;
  ambientMotion: boolean;
};

/**
 * Robot Lab motion is state-driven: low quality disables ambient decoration,
 * while reduced motion disables non-essential event choreography as well.
 */
export function resolveMotionPolicy({ tier, reducedMotion, ambientMotion }: MotionPolicyInput): MotionPolicy {
  if (reducedMotion) return { ambient: false, events: false };
  return { ambient: ambientMotion && tier !== "low", events: true };
}
