import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {
  createFlightState,
  stepFlight,
  assessTouchdown,
  PITCH_LIMIT,
} from "../src/physics.js";
import { ChaseCamera } from "../src/camera.js";
import { Pose } from "../src/loop.js";

const open = () => ({
  pads: [],
  colliders: [],
  ground: { y: 0, name: "asphalt" },
  bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60, maxY: 20, soft: true },
});
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function cruising(y = 3.5, speed = 2) {
  const s = createFlightState(V(0, y, 0), null, 0);
  s.hasFlown = true;
  s.gearDown = false;
  s.gearExtension = 0;
  s.throttle = 1;
  s.velocity.set(0, 0, -speed);
  return s;
}
const axis = (s, x, y, z) => V(x, y, z).applyQuaternion(s.quaternion);
const finite = (s) =>
  [
    s.position.x,
    s.position.y,
    s.position.z,
    s.velocity.x,
    s.velocity.y,
    s.velocity.z,
    s.quaternion.x,
    s.quaternion.y,
    s.quaternion.z,
    s.quaternion.w,
  ].every(Number.isFinite);

const elevation = (s) => Math.asin(THREE.MathUtils.clamp(axis(s, 0, 0, -1).y, -1, 1));

test("holding full pull-up for 5 s climbs steeply but never loops", () => {
  const room = open(),
    s = cruising(3.5, 2);
  let maxElev = -Infinity,
    maxStep = 0,
    prev = axis(s, 0, 0, -1),
    turned = 0;
  for (let i = 0; i < 120 * 5; i++) {
    stepFlight(s, { pitch: 1, yaw: 0, roll: 0, throttleUp: true }, 1 / 120, room);
    assert.ok(finite(s), "no NaN");
    const f = axis(s, 0, 0, -1);
    const d = prev.angleTo(f);
    turned += d;
    maxStep = Math.max(maxStep, d);
    prev = f;
    const e = elevation(s);
    maxElev = Math.max(maxElev, e);
    assert.ok(e <= PITCH_LIMIT + 0.03, `nose ${((e * 180) / Math.PI).toFixed(1)}° stays under the limit`);
    assert.ok(axis(s, 0, 1, 0).y > 0, "never goes over the top (no inverted loop)");
  }
  assert.ok(maxElev > PITCH_LIMIT - 0.08, `reached the limit (${((maxElev * 180) / Math.PI).toFixed(0)}°)`);
  assert.ok(turned < Math.PI, "nowhere near a full loop");
  assert.ok(maxStep < 0.03, "smooth: no snaps at the limit");
  assert.equal(s.crashed, false);
});

test("pitch limit: full push-down stops at the dive limit; inverted pulls stay limited too", () => {
  const s = cruising(8, 2);
  for (let i = 0; i < 120 * 3; i++) {
    stepFlight(s, { pitch: -1, yaw: 0, roll: 0 }, 1 / 120, open());
    assert.ok(elevation(s) >= -PITCH_LIMIT - 0.03);
  }
  // Roll inverted, then pull: nose drops toward the ground but stops at the limit.
  const t = cruising(12, 2);
  t.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI, "YXZ"));
  t._e = null;
  for (let i = 0; i < 120 * 3; i++) {
    stepFlight(t, { pitch: 1, yaw: 0, roll: 0, throttleUp: true }, 1 / 120, open());
    assert.ok(Math.abs(elevation(t)) <= PITCH_LIMIT + 0.03, "inverted pull is limited too");
  }
});

test("stick + yaw at a knife edge cannot sneak the nose past the limit", () => {
  const s = cruising(6, 2);
  s.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2, "YXZ"));
  s._e = null;
  for (let i = 0; i < 120 * 3; i++) {
    stepFlight(s, { pitch: 1, yaw: 1, roll: 0, throttleUp: true }, 1 / 120, open());
    assert.ok(Math.abs(elevation(s)) <= PITCH_LIMIT + 0.03);
  }
});

test("holding A or D rolls through 360° and beyond without clamping or losing much height", () => {
  for (const dir of [1, -1]) {
    const room = open(),
      s = cruising(4, 1.8);
    let turned = 0,
      maxStep = 0,
      prev = axis(s, 1, 0, 0);
    const y0 = s.position.y;
    let inverted = false;
    for (let i = 0; i < 120 * 4; i++) {
      stepFlight(
        s,
        { pitch: 0, yaw: 0, roll: dir, throttleUp: true },
        1 / 120,
        room,
      );
      assert.ok(finite(s));
      const r = axis(s, 1, 0, 0);
      const d = prev.angleTo(r);
      turned += d;
      maxStep = Math.max(maxStep, d);
      prev = r;
      if (axis(s, 0, 1, 0).y < -0.95) inverted = true;
    }
    assert.ok(
      turned > 2.5 * Math.PI,
      `rolled ${((turned * 180) / Math.PI).toFixed(0)}°`,
    );
    assert.ok(inverted);
    assert.ok(maxStep < 0.03);
    assert.ok(
      Math.abs(s.position.y - y0) < 1.5,
      `height change ${(s.position.y - y0).toFixed(2)}`,
    );
    assert.equal(s.crashed, false);
  }
});

test("no auto-level fights the pilot: a held bank and a held climb stay", () => {
  const s = cruising(5, 1.8);
  for (let i = 0; i < 60; i++)
    stepFlight(s, { pitch: 0, yaw: 0, roll: 1 }, 1 / 120, open());
  const bank = Math.abs(s.roll);
  assert.ok(bank > 1, `banked past the old 63° limit (${bank.toFixed(2)})`);
  // Let go: no auto-level, the bank stays where the pilot left it.
  for (let i = 0; i < 240; i++)
    stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, 1 / 120, open());
  assert.ok(Math.abs(Math.abs(s.roll) - bank) < 0.05, `bank held (${s.roll.toFixed(2)} vs ${bank.toFixed(2)})`);
  const c = cruising(5, 1.8);
  for (let i = 0; i < 60; i++)
    stepFlight(
      c,
      { pitch: 1, yaw: 0, roll: 0, throttleUp: true },
      1 / 120,
      open(),
    );
  assert.ok(
    c.pitch > 0.67,
    `pitch is not clamped at the old 0.67 (${c.pitch.toFixed(2)})`,
  );
});

test("zero input: no attitude auto-levels (pitch, bank, inverted all hold)", () => {
  const elev = (s) => Math.asin(axis(s, 0, 0, -1).y);
  const bankOf = (s) => Math.atan2(-axis(s, 1, 0, 0).y, axis(s, 0, 1, 0).y);
  for (const [p, r] of [[0.4, 0], [-0.3, 0], [0.2, 0.7], [0, Math.PI * 0.9]]) {
    const s = cruising(10, 2);
    s.quaternion.setFromEuler(new THREE.Euler(p, 0, r, "YXZ"));
    s._e = null;
    const e0 = elev(s),
      b0 = bankOf(s);
    // Half a second hands-off: the old auto-level would have kicked in by now.
    for (let i = 0; i < 60; i++) stepFlight(s, { pitch: 0, yaw: 0, roll: 0, throttleUp: true }, 1 / 120, open());
    assert.ok(Math.abs(bankOf(s) - b0) < 0.03, `bank ${r} held (${bankOf(s).toFixed(3)} vs ${b0.toFixed(3)})`);
    if (Math.abs(r) < 1) assert.ok(Math.abs(elev(s) - e0) < 0.03, `pitch ${p} held (${elev(s).toFixed(3)} vs ${e0.toFixed(3)})`);
  }
});

test("inverted touchdown is graded as a crash, not a landing", () => {
  const s = cruising(0.2, 1);
  s.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI, "YXZ"));
  s.roll = Math.PI;
  s.velocity.set(0, -1, -1);
  assert.equal(assessTouchdown(s).kind, "crash");
});
