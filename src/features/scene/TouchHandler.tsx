import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import type { GestureMetrics, GestureType, TouchHit } from '../../core/types';
import { mapLocalPointToRegion, mapMeshToRegion } from '../audio/TriggerMapper';

/**
 * ポインターからレイキャストへの操作処理用Props。
 */
export interface TouchHandlerProps {
  enabled: boolean;
  headObject: Object3D | null;
  onHit: (hit: TouchHit, gesture: GestureType, metrics: GestureMetrics) => void;
  onGestureEnd: () => void;
  onModelPointerStateChange: (isPointerOnModel: boolean) => void;
}

interface PointerState {
  pointerId: number | null;
  lastX: number;
  lastY: number;
  isPointerOnModel: boolean;
  lastEmitTimeMs: number;
  lastWorldPoint: Vector3 | null;
}

/**
 * 数値を指定範囲にクランプする。
 *
 * @param {number} value クランプ対象の値。
 * @param {number} min 許容される最小値。
 * @param {number} max 許容される最大値。
 * @returns {number} クランプ済み数値。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const clamped = clamp(2.3, 0, 1);
 * ```
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * ストローク再生とスムージングで使うドラッグ指標を計算する。
 *
 * @param {number} movement ポインター移動量（ピクセル）。
 * @param {number} elapsedMs 前回emitからの経過時間。
 * @returns {GestureMetrics} 音響制御と補間に使うジェスチャー指標。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const metrics = toGestureMetrics(18, 32);
 * ```
 */
function toGestureMetrics(movement: number, elapsedMs: number): GestureMetrics {
  const safeElapsedMs = Math.max(elapsedMs, 1);
  const speedPxPerSecond = movement / (safeElapsedMs / 1000);
  const speedNormalized = clamp(speedPxPerSecond / 650, 0, 1.6);

  return {
    speedPxPerSecond,
    smoothingAlpha: clamp(0.18 + speedNormalized * 0.4, 0.18, 0.78)
  };
}

/**
 * クライアント座標を正規化デバイス座標へ変換する。
 *
 * @param {number} clientX ビューポート座標系のポインターX。
 * @param {number} clientY ビューポート座標系のポインターY。
 * @param {DOMRect} rect キャンバスの境界矩形。
 * @returns {Vector2} [-1, 1] の正規化デバイス座標。
 * @throws {Error} 幅または高さが0の場合にスローする。
 * @example
 * ```ts
 * const ndc = toNormalizedPointer(200, 120, canvasRect);
 * ```
 */
function toNormalizedPointer(clientX: number, clientY: number, rect: DOMRect): Vector2 {
  if (rect.width === 0 || rect.height === 0) {
    throw new Error('Canvas rect width/height must be non-zero.');
  }

  return new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
}

/**
 * Three.jsの交差結果からアプリ層のヒットオブジェクトを構築する。
 *
 * @param {Object3D} headObject ローカル座標変換に使う頭部ルートオブジェクト。
 * @param {string} objectName レイキャストから返されたメッシュ名。
 * @param {Vector3} worldPoint ワールド座標系での交点。
 * @returns {TouchHit} 正規化済みタッチヒットオブジェクト。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const hit = buildTouchHit(headGroup, 'ear_left', point);
 * ```
 */
function buildTouchHit(headObject: Object3D, objectName: string, worldPoint: Vector3): TouchHit {
  const localPoint = headObject.worldToLocal(worldPoint.clone());
  const regionFromMesh = mapMeshToRegion(objectName);
  const region =
    regionFromMesh === 'head_core' ? mapLocalPointToRegion(localPoint) : regionFromMesh;

  return {
    region,
    point: worldPoint,
    objectName
  };
}

/**
 * ポインターイベントを処理し、レイキャスト結果をアプリ層ジェスチャーとして通知する。
 *
 * @param {TouchHandlerProps} props ポインター処理とコールバックの設定。
 * @returns {null} このコンポーネントは何も描画しない。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
 * @example
 * ```tsx
 * <TouchHandler enabled headObject={headRef.current} onHit={onHit} onModelPointerStateChange={setState} />
 * ```
 */
export function TouchHandler(props: TouchHandlerProps): null {
  const { camera, gl } = useThree();
  const raycasterRef = useRef<Raycaster>(new Raycaster());
  const pointerRef = useRef<PointerState>({
    pointerId: null,
    lastX: 0,
    lastY: 0,
    isPointerOnModel: false,
    lastEmitTimeMs: 0,
    lastWorldPoint: null
  });

  useEffect(() => {
    const canvasElement = gl.domElement;

    /**
     * 頭部オブジェクトに対してレイキャストを実行する。
     *
     * @param {number} clientX ビューポート座標系のポインターX。
     * @param {number} clientY ビューポート座標系のポインターY。
     * @returns {TouchHit | null} モデルに交差した場合のタッチヒット。
     * @throws {Error} ポインター正規化に失敗した場合にスローする。
     * @example
     * ```ts
     * const hit = pickHit(120, 220);
     * ```
     */
    const pickHit = (clientX: number, clientY: number): TouchHit | null => {
      if (!props.enabled || props.headObject === null) {
        return null;
      }

      const rect = canvasElement.getBoundingClientRect();
      const pointer = toNormalizedPointer(clientX, clientY, rect);
      raycasterRef.current.setFromCamera(pointer, camera);

      const intersections = raycasterRef.current.intersectObject(props.headObject, true);

      if (intersections.length === 0) {
        return null;
      }

      const closest = intersections[0];
      return buildTouchHit(props.headObject, closest.object.name, closest.point.clone());
    };

    /**
     * モデル上のタップ検出のためにpointerdownを処理する。
     *
     * @param {PointerEvent} event ブラウザのポインターイベント。
     * @returns {void} このハンドラーは値を返しない。
     * @throws {Error} 通常運用ではこのハンドラーは例外をスローしない。
     * @example
     * ```ts
     * onPointerDown(event);
     * ```
     */
    const onPointerDown = (event: PointerEvent): void => {
      const hit = pickHit(event.clientX, event.clientY);

      if (hit === null) {
        return;
      }

      pointerRef.current.pointerId = event.pointerId;
      pointerRef.current.lastX = event.clientX;
      pointerRef.current.lastY = event.clientY;
      pointerRef.current.isPointerOnModel = true;
      pointerRef.current.lastEmitTimeMs = performance.now();
      pointerRef.current.lastWorldPoint = hit.point.clone();

      canvasElement.setPointerCapture(event.pointerId);
      props.onModelPointerStateChange(true);
      props.onHit(hit, 'tap', { speedPxPerSecond: 0, smoothingAlpha: 1 });
      event.preventDefault();
    };

    /**
     * 連続ドラッグトリガー再生のためにpointermoveを処理する。
     *
     * @param {PointerEvent} event ブラウザのポインターイベント。
     * @returns {void} このハンドラーは値を返しない。
     * @throws {Error} 通常運用ではこのハンドラーは例外をスローしない。
     * @example
     * ```ts
     * onPointerMove(event);
     * ```
     */
    const onPointerMove = (event: PointerEvent): void => {
      if (pointerRef.current.pointerId !== event.pointerId) {
        return;
      }

      if (!pointerRef.current.isPointerOnModel) {
        return;
      }

      const movement = Math.hypot(
        event.clientX - pointerRef.current.lastX,
        event.clientY - pointerRef.current.lastY
      );

      const nowMs = performance.now();
      const elapsedMs = nowMs - pointerRef.current.lastEmitTimeMs;

      if (movement < 4 || elapsedMs < 45) {
        return;
      }

      const hit = pickHit(event.clientX, event.clientY);

      if (hit !== null) {
        const metrics = toGestureMetrics(movement, elapsedMs);
        const lastPoint = pointerRef.current.lastWorldPoint ?? hit.point;
        const smoothedPoint = lastPoint.clone().lerp(hit.point, metrics.smoothingAlpha);

        pointerRef.current.lastX = event.clientX;
        pointerRef.current.lastY = event.clientY;
        pointerRef.current.lastEmitTimeMs = nowMs;
        pointerRef.current.lastWorldPoint = smoothedPoint.clone();
        props.onHit(
          {
            ...hit,
            point: smoothedPoint
          },
          'drag',
          metrics
        );
        event.preventDefault();
      }
    };

    /**
     * 操作終了時にポインター状態をリセットする。
     *
     * @param {PointerEvent} event ブラウザのポインターイベント。
     * @returns {void} このハンドラーは値を返しない。
     * @throws {Error} 通常運用ではこのハンドラーは例外をスローしない。
     * @example
     * ```ts
     * onPointerUp(event);
     * ```
     */
    const onPointerUp = (event: PointerEvent): void => {
      if (pointerRef.current.pointerId !== event.pointerId) {
        return;
      }

      if (pointerRef.current.isPointerOnModel) {
        props.onModelPointerStateChange(false);
      }

      pointerRef.current.pointerId = null;
      pointerRef.current.isPointerOnModel = false;
      pointerRef.current.lastEmitTimeMs = 0;
      pointerRef.current.lastWorldPoint = null;

      if (canvasElement.hasPointerCapture(event.pointerId)) {
        canvasElement.releasePointerCapture(event.pointerId);
      }

      props.onGestureEnd();
    };

    canvasElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvasElement.addEventListener('pointermove', onPointerMove, { passive: false });
    canvasElement.addEventListener('pointerup', onPointerUp);
    canvasElement.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvasElement.removeEventListener('pointerdown', onPointerDown);
      canvasElement.removeEventListener('pointermove', onPointerMove);
      canvasElement.removeEventListener('pointerup', onPointerUp);
      canvasElement.removeEventListener('pointercancel', onPointerUp);
    };
  }, [camera, gl, props]);

  return null;
}
