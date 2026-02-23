import { Quaternion, Vector3 } from 'three';
import { AUDIO_SCALE } from '../../core/constants';
import type { AudioPosition, HeadRegion } from '../../core/types';

/**
 * Maps mesh names to normalized head regions.
 *
 * @param {string} meshName Mesh name from raycast intersection.
 * @returns {HeadRegion} Normalized region identifier.
 * @throws {Error} This method does not throw under normal operation.
 * @example
 * ```ts
 * const region = mapMeshToRegion('ear_left');
 * ```
 */
export function mapMeshToRegion(meshName: string): HeadRegion {
  const normalized = meshName.trim().toLowerCase();

  if (normalized.includes('ear_left') || normalized.includes('left_ear')) {
    return 'ear_left';
  }

  if (normalized.includes('ear_right') || normalized.includes('right_ear')) {
    return 'ear_right';
  }

  return 'head_core';
}

/**
 * Derives a region from local hit coordinates when mesh names are generic.
 *
 * @param {Vector3} localPoint Hit position in the head model's local space.
 * @returns {HeadRegion} Estimated region identifier.
 * @throws {Error} This method does not throw under normal operation.
 * @example
 * ```ts
 * const region = mapLocalPointToRegion(new Vector3(0.8, 0, 0));
 * ```
 */
export function mapLocalPointToRegion(localPoint: Vector3): HeadRegion {
  if (localPoint.x < -0.8) {
    return 'ear_left';
  }

  if (localPoint.x > 0.8) {
    return 'ear_right';
  }

  if (localPoint.y > 0.64) {
    return 'top';
  }

  if (localPoint.z < -0.56) {
    return 'back';
  }

  if (localPoint.z > 0.52) {
    return 'forehead';
  }

  return 'head_core';
}

/**
 * Converts a world-space touch point into audio-space coordinates.
 *
 * @param {Vector3} intersectPoint Raycast hit point in world coordinates.
 * @param {Vector3} headCenter World-space center of the head model.
 * @param {Quaternion} headQuaternion World-space rotation of the head model.
 * @returns {AudioPosition} Position suitable for PannerNode.
 * @throws {Error} This method does not throw under normal operation.
 * @example
 * ```ts
 * const position = touchToAudioPosition(hitPoint, center, quaternion);
 * ```
 */
export function touchToAudioPosition(
  intersectPoint: Vector3,
  headCenter: Vector3,
  headQuaternion: Quaternion
): AudioPosition {
  const relativeWorld = intersectPoint.clone().sub(headCenter);
  const inverseHeadRotation = headQuaternion.clone().invert();
  const relativeLocal = relativeWorld.applyQuaternion(inverseHeadRotation);

  return {
    x: relativeLocal.x * AUDIO_SCALE,
    y: relativeLocal.y * AUDIO_SCALE,
    z: relativeLocal.z * AUDIO_SCALE
  };
}
