import { Quaternion, Vector3 } from 'three';
import { AUDIO_SCALE } from '../../core/constants';
import type { AudioPosition, HeadRegion } from '../../core/types';

/**
 * メッシュ名を正規化された頭部部位へマッピングする。
 *
 * @param {string} meshName レイキャスト交差で取得したメッシュ名。
 * @returns {HeadRegion} 正規化された部位識別子。
 * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
 * メッシュ名が汎用的な場合にローカル座標から部位を推定する。
 *
 * @param {Vector3} localPoint 頭部モデルのローカル座標系におけるヒット位置。
 * @returns {HeadRegion} 推定した部位識別子。
 * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
 * ワールド空間のタッチ点を音響空間座標へ変換する。
 *
 * @param {Vector3} intersectPoint ワールド座標系でのレイキャストヒット点。
 * @param {Vector3} headCenter ワールド空間における頭部モデル中心。
 * @param {Quaternion} headQuaternion ワールド空間における頭部モデル回転。
 * @returns {AudioPosition} PannerNodeに適した座標。
 * @throws {Error} 通常運用ではこのメソッドは例外をスローしない。
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
    // The 3D stage is presented as a face-to-face view, so we invert X to match user-perceived left/right.
    x: -relativeLocal.x * AUDIO_SCALE,
    y: relativeLocal.y * AUDIO_SCALE,
    z: relativeLocal.z * AUDIO_SCALE
  };
}
