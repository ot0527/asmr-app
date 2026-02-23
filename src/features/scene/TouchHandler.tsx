import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import type { GestureMetrics, GestureType, TouchHit } from '../../core/types';
import { mapLocalPointToRegion, mapMeshToRegion } from '../audio/TriggerMapper';

/**
 * Props for pointer-to-raycast interaction handling.
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
 * Clamps a number to a range.
 *
 * @param {number} value Value to clamp.
 * @param {number} min Minimum allowed value.
 * @param {number} max Maximum allowed value.
 * @returns {number} Clamped number.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const clamped = clamp(2.3, 0, 1);
 * ```
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates drag metrics used by stroke playback and smoothing.
 *
 * @param {number} movement Pointer movement in pixels.
 * @param {number} elapsedMs Time elapsed since the previous emit.
 * @returns {GestureMetrics} Gesture metrics for audio and interpolation.
 * @throws {Error} This function does not throw under normal operation.
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
 * Converts client coordinates into normalized device coordinates.
 *
 * @param {number} clientX Pointer X in viewport coordinates.
 * @param {number} clientY Pointer Y in viewport coordinates.
 * @param {DOMRect} rect Canvas bounding rectangle.
 * @returns {Vector2} Normalized device coordinates in range [-1, 1].
 * @throws {Error} Throws when width or height is zero.
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
 * Builds an app-level hit object from a Three.js intersection.
 *
 * @param {Object3D} headObject Root head object used for local conversion.
 * @param {string} objectName Mesh name returned by raycast.
 * @param {Vector3} worldPoint Intersection point in world coordinates.
 * @returns {TouchHit} Normalized touch hit object.
 * @throws {Error} This function does not throw under normal operation.
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
 * Handles pointer events and emits raycast hits as app-level gestures.
 *
 * @param {TouchHandlerProps} props Pointer and callback configuration.
 * @returns {null} This component renders nothing.
 * @throws {Error} This component does not throw under normal operation.
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
     * Performs raycast against the head object.
     *
     * @param {number} clientX Pointer X in viewport coordinates.
     * @param {number} clientY Pointer Y in viewport coordinates.
     * @returns {TouchHit | null} Touch hit when the model is intersected.
     * @throws {Error} Throws when pointer normalization fails.
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
     * Handles pointerdown for tap detection on the model.
     *
     * @param {PointerEvent} event Browser pointer event.
     * @returns {void} This handler does not return a value.
     * @throws {Error} This handler does not throw under normal operation.
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
     * Handles pointermove for continuous drag-trigger playback.
     *
     * @param {PointerEvent} event Browser pointer event.
     * @returns {void} This handler does not return a value.
     * @throws {Error} This handler does not throw under normal operation.
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
     * Resets pointer state when interaction finishes.
     *
     * @param {PointerEvent} event Browser pointer event.
     * @returns {void} This handler does not return a value.
     * @throws {Error} This handler does not throw under normal operation.
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
