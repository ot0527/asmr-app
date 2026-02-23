import { forwardRef, useEffect, useMemo } from 'react';
import type { BufferGeometry, Group } from 'three';
import type { HeadRegion } from '../../core/types';
import { createEarGeometry, createHeadSurfaceGeometry } from './HeadModelGeometry';

/**
 * Props for rendering and highlighting the procedural head model.
 */
export interface HeadModelProps {
  highlightedRegion: HeadRegion | null;
}

/**
 * Returns emissive intensity for visual region feedback.
 *
 * @param {HeadRegion} region Region represented by a mesh.
 * @param {HeadRegion | null} highlightedRegion Currently highlighted region.
 * @returns {number} Emissive intensity for the mesh material.
 * @throws {Error} This function does not throw under normal operation.
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
 * Safely disposes geometries created inside the component.
 *
 * @param {BufferGeometry} headGeometry Procedural head surface geometry.
 * @param {BufferGeometry} earGeometry Procedural ear geometry.
 * @returns {void} This function does not return a value.
 * @throws {Error} This function does not throw under normal operation.
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
 * Renders an anatomical head model with full-surface raycast targets.
 *
 * @param {HeadModelProps} props Rendering configuration.
 * @param {React.ForwardedRef<Group>} ref Group ref used by raycaster logic.
 * @returns {JSX.Element} Anatomical procedural head model.
 * @throws {Error} This component does not throw under normal operation.
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
