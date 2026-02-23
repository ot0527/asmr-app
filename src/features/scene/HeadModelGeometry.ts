import { BufferGeometry, SphereGeometry, Vector3 } from 'three';

const HEAD_RADIUS = 0.84;
const EAR_RADIUS = 0.2;

/**
 * 滑らかな解剖形状を作るためのガウス風重みを計算する。
 *
 * @param {number} value 入力値。
 * @param {number} center ピーク中心値。
 * @param {number} spread 滑らかさを制御する広がり値。
 * @returns {number} (0, 1] 範囲の重み。
 * @throws {Error} spreadが0以下の場合にスローする。
 * @example
 * ```ts
 * const weight = gaussian(0.2, 0, 0.1);
 * ```
 */
function gaussian(value: number, center: number, spread: number): number {
  if (spread <= 0) {
    throw new Error('Spread must be greater than zero.');
  }

  const normalized = (value - center) / spread;
  return Math.exp(-(normalized * normalized));
}

/**
 * 2つのエッジ間の滑らかな補間係数を返する。
 *
 * @param {number} edge0 下限エッジ。
 * @param {number} edge1 上限エッジ。
 * @param {number} value 入力値。
 * @returns {number} [0, 1] の平滑化補間値。
 * @throws {Error} エッジ値が同一の場合にスローする。
 * @example
 * ```ts
 * const factor = smoothstep(-1, 1, 0.4);
 * ```
 */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    throw new Error('Edges must be different values.');
  }

  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * 全面レイキャスト向けに非球面の解剖学的頭部表面を作成する。
 *
 * @returns {BufferGeometry} 手続き生成で造形した頭部ジオメトリ。
 * @throws {Error} ジオメトリ属性アクセスに失敗した場合にスローする。
 * @example
 * ```ts
 * const geometry = createHeadSurfaceGeometry();
 * ```
 */
export function createHeadSurfaceGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(HEAD_RADIUS, 120, 96);
  const positions = geometry.getAttribute('position');
  const point = new Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);

    const xNorm = point.x / HEAD_RADIUS;
    const yNorm = point.y / HEAD_RADIUS;
    const zNorm = point.z / HEAD_RADIUS;
    const xAbs = Math.abs(xNorm);
    const frontWeight = Math.max(zNorm, 0);
    const backWeight = Math.max(-zNorm, 0);

    const upperCranium = 0.9 + smoothstep(-0.1, 0.9, yNorm) * 0.17;
    const jawTaper = 1 - smoothstep(-0.85, -0.06, yNorm) * 0.28;
    const cheekBulge =
      1 +
      gaussian(yNorm, -0.1, 0.42) * gaussian(zNorm, 0.1, 0.85) * 0.11 -
      gaussian(yNorm, -0.62, 0.2) * 0.08;

    point.x *= upperCranium * jawTaper * cheekBulge;

    const foreheadPush = gaussian(yNorm, 0.28, 0.3) * gaussian(xNorm, 0, 0.52) * 0.12;
    const noseBridge = gaussian(yNorm, 0.1, 0.19) * gaussian(xNorm, 0, 0.16) * 0.19;
    const noseTip = gaussian(yNorm, -0.08, 0.11) * gaussian(xNorm, 0, 0.12) * 0.11;
    const mouthAreaInset = gaussian(yNorm, -0.26, 0.14) * gaussian(xNorm, 0, 0.23) * 0.06;
    const occipitalBulge = gaussian(yNorm, 0.16, 0.55) * 0.11;
    const chinProjection = gaussian(yNorm, -0.8, 0.16) * (1 - xAbs) * 0.08;

    point.z +=
      frontWeight * (foreheadPush + noseBridge + noseTip + chinProjection - mouthAreaInset) -
      backWeight * occipitalBulge;

    const jawDrop = gaussian(xAbs, 0.58, 0.2) * smoothstep(-0.8, -0.1, yNorm) * 0.1;
    point.y -= jawDrop;

    positions.setXYZ(index, point.x, point.y, point.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 耳輪と耳甲介の輪郭を持つ耳ジオメトリを作成する。
 *
 * @returns {BufferGeometry} 手続き生成で造形した耳ジオメトリ。
 * @throws {Error} ジオメトリ属性アクセスに失敗した場合にスローする。
 * @example
 * ```ts
 * const geometry = createEarGeometry();
 * ```
 */
export function createEarGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(EAR_RADIUS, 56, 56);
  const positions = geometry.getAttribute('position');
  const point = new Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);

    const radial = Math.sqrt(point.y * point.y + point.z * point.z);
    const helixRidge = gaussian(radial, EAR_RADIUS * 0.67, 0.045) * 0.045;
    const conchaCavity = gaussian(point.y, 0, 0.11) * gaussian(point.z, 0.01, 0.12) * 0.09;
    const lowerLobe = 1 - smoothstep(-EAR_RADIUS * 0.96, -EAR_RADIUS * 0.2, point.y);

    point.x *= 0.52;
    point.y *= 1.18;
    point.z *= 0.72;

    point.x += helixRidge;
    point.x -= conchaCavity;
    point.y -= lowerLobe * 0.03;
    point.z += lowerLobe * 0.013;

    positions.setXYZ(index, point.x, point.y, point.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}
