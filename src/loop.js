import * as THREE from "../vendor/three.module.js";

/** Physics runs on a fixed clock; rendering blends between the last two steps. */
export const STEP = 1 / 120;
export const MAX_FRAME = 0.05;

/**
 * Advance a fixed-step accumulator by one rendered frame.
 * Calls step() once per whole physics step and returns
 * { accumulator, steps, alpha } where alpha in [0, 1) is how far the
 * render time sits between the previous and the current physics state.
 */
export function advanceFixed(accumulator, frameDt, step, onStep, h = STEP) {
  let acc = accumulator + Math.min(Math.max(frameDt, 0), MAX_FRAME);
  let steps = 0;
  while (acc >= h) {
    onStep?.(h);
    acc -= h;
    steps++;
  }
  return { accumulator: acc, steps, alpha: renderAlpha(acc, h) };
}
export function renderAlpha(accumulator, h = STEP) {
  const a = accumulator / h;
  return Number.isFinite(a) ? THREE.MathUtils.clamp(a, 0, 1) : 1;
}

/** A pose snapshot: position + quaternion. */
export class Pose {
  constructor() {
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
  }
  copyFrom(src) {
    this.position.copy(src.position);
    this.quaternion.copy(src.quaternion);
    return this;
  }
}
/** out = previous blended toward current by alpha (lerp + slerp). Big jumps snap. */
export function interpolatePose(
  out,
  previous,
  current,
  alpha,
  snapDistance = 0.6,
) {
  if (
    previous.position.distanceToSquared(current.position) >
    snapDistance ** 2
  ) {
    out.position.copy(current.position);
    out.quaternion.copy(current.quaternion);
    return out;
  }
  out.position.lerpVectors(previous.position, current.position, alpha);
  out.quaternion.slerpQuaternions(
    previous.quaternion,
    current.quaternion,
    alpha,
  );
  return out;
}

/**
 * Snap a directional light's target to whole shadow-map texels (in light
 * space) so a shadow camera that follows the plane does not shimmer.
 */
export function snapToTexel(out, point, lightOffset, texel) {
  const z = new THREE.Vector3().copy(lightOffset).normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const u = Math.round(point.dot(x) / texel) * texel,
    v = Math.round(point.dot(y) / texel) * texel,
    w = point.dot(z);
  return out
    .set(0, 0, 0)
    .addScaledVector(x, u)
    .addScaledVector(y, v)
    .addScaledVector(z, w);
}
