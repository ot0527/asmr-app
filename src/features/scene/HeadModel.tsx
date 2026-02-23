import { forwardRef, useEffect, useMemo } from 'react';
import type { BufferGeometry, Group } from 'three';
import type { HeadRegion } from '../../core/types';
import { createEarGeometry, createHeadSurfaceGeometry } from './HeadModelGeometry';

/**
 * 手続き生成頭部モデルの描画とハイライト用Props。
 */
export interface HeadModelProps {
  highlightedRegion: HeadRegion | null;
}

/**
 * 部位フィードバック表示用の発光強度を返する。
 *
 * @param {HeadRegion} region メッシュが表す部位。
 * @param {HeadRegion | null} highlightedRegion 現在ハイライト中の部位。
 * @returns {number} メッシュ材質に設定する発光強度。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const intensity = getEmissiveIntensity('ear_left', 'ear_left');
 * ```
 */
function getEmissiveIntensity(region: HeadRegion, highlightedRegion: HeadRegion | null): number {
  if (region === highlightedRegion) {
    return 0.48;
  }

  if (
    region === 'head_core' &&
    highlightedRegion !== null &&
    highlightedRegion !== 'ear_left' &&
    highlightedRegion !== 'ear_right'
  ) {
    return 0.28;
  }

  return 0.1;
}

/**
 * コンポーネント内で作成したジオメトリを安全に破棄する。
 *
 * @param {BufferGeometry} headGeometry 手続き生成した頭部表面ジオメトリ。
 * @param {BufferGeometry} earGeometry 手続き生成した耳ジオメトリ。
 * @returns {void} この関数は値を返しない。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * disposeGeometries(headGeometry, earGeometry);
 * ```
 */
function disposeGeometries(
  headGeometry: BufferGeometry,
  earGeometry: BufferGeometry
): void {
  headGeometry.dispose();
  earGeometry.dispose();
}

/**
 * 全面レイキャスト対象を持つ解剖学的頭部モデルを描画する。
 *
 * @param {HeadModelProps} props 描画設定。
 * @param {React.ForwardedRef<Group>} ref レイキャスト処理で使うGroup参照。
 * @returns {JSX.Element} 解剖学的に表現した手続き生成頭部モデル。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
 * @example
 * ```tsx
 * <HeadModel highlightedRegion={activeRegion} ref={headRef} />
 * ```
 */
export const HeadModel = forwardRef<Group, HeadModelProps>(function HeadModel(
  props: HeadModelProps,
  ref
) {
  const headGeometry = useMemo(() => createHeadSurfaceGeometry(), []);
  const earGeometry = useMemo(() => createEarGeometry(), []);

  useEffect(() => {
    return () => {
      disposeGeometries(headGeometry, earGeometry);
    };
  }, [earGeometry, headGeometry]);

  return (
    <group ref={ref} name="head_root">
      <mesh name="head_surface" geometry={headGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#f2dbc9"
          roughness={0.58}
          metalness={0.05}
          emissive="#8bd9cf"
          emissiveIntensity={getEmissiveIntensity('head_core', props.highlightedRegion)}
        />
      </mesh>

      <mesh
        name="ear_left"
        geometry={earGeometry}
        position={[-0.84, 0.02, 0.01]}
        rotation={[0, Math.PI, 0]}
        castShadow
      >
        <meshStandardMaterial
          color="#e8c3b1"
          roughness={0.49}
          emissive="#7dd3c2"
          emissiveIntensity={getEmissiveIntensity('ear_left', props.highlightedRegion)}
        />
      </mesh>

      <mesh name="ear_right" geometry={earGeometry} position={[0.84, 0.02, 0.01]} castShadow>
        <meshStandardMaterial
          color="#e8c3b1"
          roughness={0.49}
          emissive="#7dd3c2"
          emissiveIntensity={getEmissiveIntensity('ear_right', props.highlightedRegion)}
        />
      </mesh>
    </group>
  );
});
