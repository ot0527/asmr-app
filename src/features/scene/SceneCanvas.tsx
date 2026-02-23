import { Canvas } from '@react-three/fiber';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Quaternion, Vector3, type Group } from 'three';
import type {
  AudioPosition,
  GestureMetrics,
  GestureType,
  HeadRegion,
  TouchHit
} from '../../core/types';
import { touchToAudioPosition } from '../audio/TriggerMapper';
import { HeadModel } from './HeadModel';
import { OrbitControl } from './OrbitControl';
import { TouchHandler } from './TouchHandler';

/**
 * モデル操作が再生を起動すべきときに通知するペイロード。
 */
export interface SceneTriggerPayload {
  region: HeadRegion;
  position: AudioPosition;
  gesture: GestureType;
  gestureMetrics: GestureMetrics;
}

/**
 * インタラクティブシーンの描画と制御に必要なProps。
 */
export interface SceneCanvasProps {
  highlightedRegion: HeadRegion | null;
  onRegionHover: (region: HeadRegion) => void;
  onTrigger: (payload: SceneTriggerPayload) => void;
  onStrokeEnd: () => void;
}

/**
 * タッチヒットを音声トリガーペイロードへ変換する。
 *
 * @param {Group} headGroup 頭部モデルのルートGroup。
 * @param {TouchHit} hit レイキャスト結果を正規化したヒットオブジェクト。
 * @param {'tap' | 'drag'} gesture ポインタージェスチャー種別。
 * @param {GestureMetrics} gestureMetrics ポインター速度とスムージング指標。
 * @returns {SceneTriggerPayload} シーントリガーペイロード。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const payload = buildSceneTrigger(headRef.current, hit, 'tap');
 * ```
 */
function buildSceneTrigger(
  headGroup: Group,
  hit: TouchHit,
  gesture: 'tap' | 'drag',
  gestureMetrics: GestureMetrics
): SceneTriggerPayload {
  const headCenter = new Vector3();
  const headRotation = new Quaternion();

  headGroup.getWorldPosition(headCenter);
  headGroup.getWorldQuaternion(headRotation);

  return {
    region: hit.region,
    position: touchToAudioPosition(hit.point, headCenter, headRotation),
    gesture,
    gestureMetrics
  };
}

/**
 * モデル・コントロール・タッチハンドラーを含むR3Fキャンバスを描画する。
 *
 * @param {SceneCanvasProps} props シーン操作用コールバックとUI状態。
 * @returns {JSX.Element} 操作可能なThree.jsキャンバス。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
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
   * 頭部Groupへのミュータブル参照とリアクティブ参照を同期する。
   *
   * @param {Group | null} group マウント済みの頭部Groupインスタンス。
   * @returns {void} このコールバックは値を返しない。
   * @throws {Error} 通常運用ではこのコールバックは例外をスローしない。
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
   * TouchHandlerからの正規化済みタッチヒットを処理する。
   *
   * @param {TouchHit} hit アプリ層データへ変換済みのレイキャスト結果。
   * @param {'tap' | 'drag'} gesture ポインタージェスチャー種別。
   * @returns {void} このコールバックは値を返しない。
   * @throws {Error} 通常運用ではこのコールバックは例外をスローしない。
   * @example
   * ```ts
   * handleHit(hit, 'tap');
   * ```
   */
  const handleHit = useCallback(
    (hit: TouchHit, gesture: 'tap' | 'drag', gestureMetrics: GestureMetrics): void => {
      const headGroup = headGroupRef.current;

      if (headGroup === null) {
        return;
      }

      props.onRegionHover(hit.region);
      props.onTrigger(buildSceneTrigger(headGroup, hit, gesture, gestureMetrics));
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
          onGestureEnd={props.onStrokeEnd}
          onModelPointerStateChange={setLockOrbit}
        />
      </Canvas>
    </div>
  );
}
