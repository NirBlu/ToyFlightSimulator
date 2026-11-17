import * as THREE from "../vendor/three.module.js";
import { headingOf } from "./physics.js?v=10";

const BACK = new THREE.Vector3(0, 0.34, 0.83),
  LOOK = new THREE.Vector3(0, 0.06, -0.24),
  FORWARD = new THREE.Vector3(0, 0, -1),
  UP = new THREE.Vector3(0, 1, 0);
const smooth = THREE.MathUtils.smoothstep;

/**
 * Chase camera. Level flight / taxiing: a calm camera that only follows the
 * heading (like before). Steep or upside down (loops, rolls): it blends into
 * the plane's own frame, so "up" on screen follows the plane's up. Its idea
 * of the sky is the current gravity up, which swings smoothly in anti-grav.
 */
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.gravityUp = new THREE.Vector3(0, 1, 0);
    this.orientation = new THREE.Quaternion();
    this.heading = 0;
    this.bodyBlend = 0;
    this._target = new THREE.Quaternion();
    this._level = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
  }
  /** pose: { position, quaternion } (interpolated); state: flight state; clampBox: env.camera */
  update(dt, pose, state, clampBox, snap = false) {
    const k = (rate) => (snap ? 1 : 1 - Math.exp(-rate * dt));
    // Sky direction: slerp-like swing toward the plane's gravity.
    const g = this.gravityUp;
    const target = state.gravUp || UP;
    if (snap || g.dot(target) > 0.99999) g.copy(target);
    else {
      const q = new THREE.Quaternion().setFromUnitVectors(g, target);
      g.applyQuaternion(new THREE.Quaternion().slerp(q, k(3.2))).normalize();
    }
    const fwd = FORWARD.clone().applyQuaternion(pose.quaternion),
      up = UP.clone().applyQuaternion(pose.quaternion);
    // Heading frame in the gravity frame (fwd and up expressed relative to g).
    const fg = fwd.dot(g);
    const h = fwd
      .clone()
      .addScaledVector(g, -fg)
      .addScaledVector(up.clone().addScaledVector(g, -up.dot(g)), -fg);
    if (h.lengthSq() > 1e-8) h.normalize();
    else {
      // Pointing straight along gravity: keep the camera's last heading.
      h.copy(FORWARD).applyQuaternion(this.orientation);
      h.addScaledVector(g, -h.dot(g));
      if (h.lengthSq() < 1e-8) h.set(g.y, g.z, g.x).cross(g);
      h.normalize();
    }
    const right = new THREE.Vector3().crossVectors(h, g).normalize();
    const back = h.clone().negate();
    this._m.makeBasis(right, g, back);
    this._level.setFromRotationMatrix(this._m);
    // How far from "normal" flight are we? 0 = level camera, 1 = body camera.
    const upright = up.dot(g);
    const want = state.grounded ? 0 : smooth(1 - upright, 0.55, 1.25);
    this.bodyBlend += (want - this.bodyBlend) * k(4);
    this._target.slerpQuaternions(this._level, pose.quaternion, this.bodyBlend);
    if (snap) this.orientation.copy(this._target);
    else this.orientation.slerp(this._target, k(6));
    const hd = headingOf(fwd, up);
    if (hd !== null) this.heading = hd;
    const c = this.camera;
    const desired = BACK.clone()
      .applyQuaternion(this.orientation)
      .add(pose.position);
    if (clampBox) {
      desired.x = THREE.MathUtils.clamp(
        desired.x,
        clampBox.minX,
        clampBox.maxX,
      );
      desired.y = THREE.MathUtils.clamp(
        desired.y,
        clampBox.minY,
        clampBox.maxY,
      );
      desired.z = THREE.MathUtils.clamp(
        desired.z,
        clampBox.minZ,
        clampBox.maxZ,
      );
    }
    if (snap) c.position.copy(desired);
    else c.position.lerp(desired, k(8));
    c.up.copy(UP).applyQuaternion(this.orientation);
    c.lookAt(LOOK.clone().applyQuaternion(this.orientation).add(pose.position));
  }
}
