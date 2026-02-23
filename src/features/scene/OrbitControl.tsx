import type { ReactElement } from 'react';
import { OrbitControls } from '@react-three/drei';
import { ORBIT_LIMITS } from '../../core/constants';

/**
 * Props for orbit control behavior.
 */
export interface OrbitControlProps {
  enabled: boolean;
}

/**
 * Renders constrained orbit controls for head rotation.
 *
 * @param {OrbitControlProps} props Orbit control configuration.
 * @returns {JSX.Element} Configured Drei OrbitControls component.
 * @throws {Error} This component does not throw under normal operation.
 * @example
 * ```tsx
 * <OrbitControl enabled={!isTouchingModel} />
 * ```
 */
export function OrbitControl(props: OrbitControlProps): ReactElement {
  return (
    <OrbitControls
      enabled={props.enabled}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.72}
      enableZoom={false}
      enablePan={false}
      minPolarAngle={ORBIT_LIMITS.minPolarAngle}
      maxPolarAngle={ORBIT_LIMITS.maxPolarAngle}
      minAzimuthAngle={ORBIT_LIMITS.minAzimuthAngle}
      maxAzimuthAngle={ORBIT_LIMITS.maxAzimuthAngle}
    />
  );
}
