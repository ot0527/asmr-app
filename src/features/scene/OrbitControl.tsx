import type { ReactElement } from 'react';
import { OrbitControls } from '@react-three/drei';
import { ORBIT_LIMITS } from '../../core/constants';

/**
 * OrbitControlの動作用Props。
 */
export interface OrbitControlProps {
  enabled: boolean;
}

/**
 * 頭部回転用の制約付きOrbitControlを描画する。
 *
 * @param {OrbitControlProps} props OrbitControlの設定。
 * @returns {JSX.Element} 設定済みのDrei OrbitControlsコンポーネント。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
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
