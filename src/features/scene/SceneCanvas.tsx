import { Canvas } from '@react-three/fiber';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Quaternion, Vector3, type Group } from 'three';
import type { AudioPosition, GestureType, HeadRegion, TouchHit } from '../../core/types';
import { touchToAudioPosition } from '../audio/TriggerMapper';
import { HeadModel } from './HeadModel';
import { OrbitControl } from './OrbitControl';
import { TouchHandler } from './TouchHandler';

/**
 * Payload emitted when the model interaction should trigger playback.
 */
export interface SceneTriggerPayload {
  region: HeadRegion;
  position: AudioPosition;
  gesture: GestureType;
}

/**
 * Props required to render and control the interactive scene.
 */
export interface SceneCanvasProps {
  highlightedRegion: HeadRegion | null;
  onRegionHover: (region: HeadRegion) => void;
  onTrigger: (payload: SceneTriggerPayload) => void;
}

/**
 * Converts a touch hit into an audio trigger payload.
 *
 * @param {Group} headGroup Root group of the head model.
 * @param {TouchHit} hit Normalized hit object from raycasting.
 * @param {'tap' | 'drag'} gesture Pointer gesture type.
 * @returns {SceneTriggerPayload} Scene trigger payload.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const payload = buildSceneTrigger(headRef.current, hit, 'tap');
 * ```
 */
function buildSceneTrigger(
  headGroup: Group,
  hit: TouchHit,
  gesture: 'tap' | 'drag'
): SceneTriggerPayload {
  const headCenter = new Vector3();
  const headRotation = new Quaternion();

  headGroup.getWorldPosition(headCenter);
  headGroup.getWorldQuaternion(headRotation);

  return {
    region: hit.region,
    position: touchToAudioPosition(hit.point, headCenter, headRotation),
    gesture
  };
}

/**
 * Renders the R3F canvas including model, controls, and touch handlers.
 *
 * @param {SceneCanvasProps} props Scene interaction callbacks and UI state.
 * @returns {JSX.Element} Interactive Three.js canvas.
 * @throws {Error} This component does not throw under normal operation.
 * @example
 * ```tsx
 * <SceneCanvas highlightedRegion={activeRegion} onRegionHover={setRegion} onTrigger={play} />
 * ```
 */
export function SceneCanvas(props: SceneCanvasProps): ReactElement {
  const headGroupRef = useRef<Group | null>(null);
  const [headObject, setHeadObject] = useState<Group | null>(null);
  const [lockOrbit, setLockOrbit] = useState<boolean>(false);

  /**
   * Keeps mutable and reactive references to the head group synchronized.
   *
   * @param {Group | null} group Mounted head group instance.
   * @returns {void} This callback does not return a value.
   * @throws {Error} This callback does not throw under normal operation.
   * @example
   * ```ts
   * setHeadGroupRef(group);
   * ```
   */
  const setHeadGroupRef = useCallback((group: Group | null): void => {
    headGroupRef.current = group;
    setHeadObject(group);
  }, []);

  /**
   * Handles normalized touch hits from TouchHandler.
   *
   * @param {TouchHit} hit Raycast result mapped to app-level data.
   * @param {'tap' | 'drag'} gesture Pointer gesture type.
   * @returns {void} This callback does not return a value.
   * @throws {Error} This callback does not throw under normal operation.
   * @example
   * ```ts
   * handleHit(hit, 'tap');
   * ```
   */
  const handleHit = useCallback(
    (hit: TouchHit, gesture: 'tap' | 'drag'): void => {
      const headGroup = headGroupRef.current;

      if (headGroup === null) {
        return;
      }

      props.onRegionHover(hit.region);
      props.onTrigger(buildSceneTrigger(headGroup, hit, gesture));
    },
    [props]
  );

  return (
    <div className="scene-canvas-wrap">
      <Canvas
        className="scene-canvas"
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.08, 3.15], fov: 42 }}
      >
        <color attach="background" args={['#edf8f7']} />
        <fog attach="fog" args={['#edf8f7', 2.9, 6.8]} />
        <ambientLight intensity={0.72} color="#ffffff" />
        <directionalLight
          intensity={1.05}
          color="#fffbef"
          position={[2.1, 2.6, 2.3]}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight intensity={0.28} color="#9ad5ff" position={[-2.2, 1.2, -2.4]} />

        <group position={[0, -0.05, 0]}>
          <HeadModel ref={setHeadGroupRef} highlightedRegion={props.highlightedRegion} />
        </group>

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.08, 0]}>
          <planeGeometry args={[7, 7]} />
          <shadowMaterial opacity={0.2} />
        </mesh>

        <OrbitControl enabled={!lockOrbit} />
        <TouchHandler
          enabled
          headObject={headObject}
          onHit={handleHit}
          onModelPointerStateChange={setLockOrbit}
        />
      </Canvas>
    </div>
  );
}
