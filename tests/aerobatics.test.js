import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {
  createFlightState,
  stepFlight,
  assessTouchdown,
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

test("holding the stick back flies a complete 360° loop at full throttle", () => {
  const room = open(),
    s = cruising();
  const cam = new ChaseCamera(new THREE.PerspectiveCamera(66, 1.6, 0.02, 100));
  cam.update(1, s, s, null, true);
  let turned = 0,
    maxStep = 0,
    inverted = false,
    camInverted = false,
    minY = Infinity,
    maxY = -Infinity,
    prev = axis(s, 0, 0, -1);
  for (let i = 0; i < 120 * 8 && turned < 2 * Math.PI; i++) {
    stepFlight(
      s,
      { pitch: 1, yaw: 0, roll: 0, throttleUp: true },
      1 / 120,
      room,
    );
    cam.update(1 / 120, new Pose().copyFrom(s), s, null);
    assert.ok(finite(s), "no NaN");
    const f = axis(s, 0, 0, -1);
    const d = prev.angleTo(f);
    turned += d;
    maxStep = Math.max(maxStep, d);
    prev = f;
    if (axis(s, 0, 1, 0).y < -0.95) inverted = true;
    if (cam.camera.up.y < -0.5) camInverted = true;
    minY = Math.min(minY, s.position.y);
    maxY = Math.max(maxY, s.position.y);
  }
  assert.ok(
    turned >= 2 * Math.PI,
    `nose went all the way round (${((turned * 180) / Math.PI).toFixed(0)}°)`,
  );
  assert.ok(inverted, "upside down over the top");
  assert.ok(camInverted, "chase camera rolled over with the plane");
  assert.ok(maxStep < 0.03, "orientation is continuous: no flips");
  assert.ok(
    maxY - minY > 1.5 && maxY - minY < 6,
    `loop height ${(maxY - minY).toFixed(2)} m fits the big levels`,
  );
  assert.equal(s.crashed, false);
  assert.equal(s.grounded, null);
  // Back out the bottom flying level-ish and still fast enough to fly.
  assert.ok(axis(s, 0, 1, 0).y > 0.9);
  assert.ok(s.velocity.length() > 1, "kept its energy");
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
  // Let go: gentle return toward wings level.
  for (let i = 0; i < 240; i++)
    stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, 1 / 120, open());
  assert.ok(Math.abs(s.roll) < bank * 0.6, "levels out gently once released");
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

test("inverted touchdown is graded as a crash, not a landing", () => {
  const s = cruising(0.2, 1);
  s.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI, "YXZ"));
  s.roll = Math.PI;
  s.velocity.set(0, -1, -1);
  assert.equal(assessTouchdown(s).kind, "crash");
});
