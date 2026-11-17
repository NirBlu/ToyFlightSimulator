import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {
  createFlightState,
  stepFlight,
  setGravity,
  RATES,
  PITCH_LIMIT,
} from "../src/physics.js";
import { Controls } from "../src/controls.js";

// Regression: "pull up gets stuck sometimes and doesn't pull up at all".
// Cause: after any gravity change (V on, V off, or the automatic let-go when
// you fly away from an anti-grav surface) a 2 s "swing belly to the new floor"
// leveler fought the elevator and pinned the nose at ~17°.

const h = 1 / 120;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const open = () => ({
  pads: [],
  colliders: [],
  ground: { y: 0, name: "asphalt" },
  bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60, maxY: 20, soft: true },
});
function cruising(y = 3, speed = 1.3) {
  const s = createFlightState(V(0, y, 0), null, 0);
  s.hasFlown = true;
  s.throttle = 0.6;
  s.velocity.set(0, 0, -speed);
  return s;
}
/** Total nose-up rotation (rad) about the plane's own wing axis over `steps`. */
function pitchedThrough(s, room, steps, input = { pitch: 1, throttleUp: true }) {
  let total = 0;
  const inv = new THREE.Quaternion();
  for (let i = 0; i < steps; i++) {
    const q0 = s.quaternion.clone();
    stepFlight(s, input, h, room, {});
    assert.ok(!s.crashed, "still flying");
    const d = inv.copy(q0).invert().multiply(s.quaternion);
    if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
    total += 2 * Math.asin(THREE.MathUtils.clamp(d.x, -1, 1));
  }
  return total;
}

test("pull-up responds right after anti-grav is switched off (plane still tilted)", () => {
  const room = open(),
    s = cruising();
  // Tilt it like it just came off a wall, then return to normal gravity (V again).
  s.quaternion.setFromEuler(new THREE.Euler(0.1, 0, 0.9, "YXZ"));
  s._e = null;
  setGravity(s, V(0, 1, 0), null);
  assert.ok(s.gravAssist, "gravity swing is active");
  const turned = pitchedThrough(s, room, 60); // 0.5 s of full back stick
  assert.ok(
    turned > 0.6 * RATES.pitch * 0.5,
    `nose kept coming up (${turned.toFixed(2)} rad in 0.5 s)`,
  );
});

test("pull-up responds right after V onto a wall", () => {
  const room = open(),
    s = cruising(3, 1.2);
  setGravity(s, V(1, 0, 0), { kind: "wall", name: "the west wall" });
  const turned = pitchedThrough(s, room, 60);
  assert.ok(turned > 0.5, `nose comes up during the swing (${turned.toFixed(2)})`);
});

test("hands off, the swing still turns the belly to the new floor", () => {
  const room = open(),
    s = cruising();
  s.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI * 0.9, "YXZ")); // nearly inverted
  s._e = null;
  setGravity(s, V(0, 1, 0), null);
  for (let i = 0; i < 240; i++) stepFlight(s, {}, h, room, {});
  const up = V(0, 1, 0).applyQuaternion(s.quaternion);
  assert.ok(up.y > 0.9, `upright again (up.y=${up.y.toFixed(2)})`);
});

test("once the swing is done it never holds the nose again: pull-up reaches the limit", () => {
  const room = open(),
    s = cruising();
  setGravity(s, V(0, 1, 0), null);
  for (let i = 0; i < 30; i++) stepFlight(s, {}, h, room, {});
  const turned = pitchedThrough(s, room, 120);
  assert.ok(turned > PITCH_LIMIT - 0.12, `nose came all the way up (${turned.toFixed(2)} rad in 1 s)`);
  const f = V(0, 0, -1).applyQuaternion(s.quaternion);
  assert.ok(Math.asin(f.y) > PITCH_LIMIT - 0.12 && Math.asin(f.y) < PITCH_LIMIT + 0.03);
});

test("pull-up on an anti-grav wall is limited against the wall, not world up", () => {
  const room = open(),
    s = cruising(3, 1.4);
  setGravity(s, V(1, 0, 0), { kind: "wall", name: "the west wall" });
  for (let i = 0; i < 120 * 3; i++) stepFlight(s, { pitch: 1, throttleUp: true }, h, room, {});
  const f = V(0, 0, -1).applyQuaternion(s.quaternion);
  const elev = Math.asin(THREE.MathUtils.clamp(f.dot(s.gravUp), -1, 1));
  assert.ok(elev > 0.5 && elev < PITCH_LIMIT + 0.03, `elevation off the wall ${elev.toFixed(2)}`);
});

test("full back stick pitches at full rate in every ordinary flight state", () => {
  const states = {
    cruise: cruising(),
    slow: Object.assign(cruising(3, 0.6), { throttle: 0.2 }),
    flaps: Object.assign(cruising(), { flapsDown: true }),
    gearUp: Object.assign(cruising(), { gearDown: false, gearExtension: 0 }),
  };
  for (const [name, s] of Object.entries(states)) {
    const turned = pitchedThrough(s, open(), 60);
    assert.ok(turned > 0.7 * RATES.pitch * 0.5, `${name}: ${turned.toFixed(2)}`);
  }
});

test("touch-and-go: pulling up on the ground lifts off at flying speed", () => {
  const s = createFlightState(V(0, 0.075, 0), null, 0);
  s.hasFlown = true;
  s.throttle = 0.6;
  s.velocity.set(0, -0.15, -1.2);
  let tookOff = false,
    touched = false;
  const events = { takeoff: () => (tookOff = true), landing: () => (touched = true) };
  for (let i = 0; i < 240 && !tookOff; i++)
    stepFlight(s, { pitch: touched ? 1 : 0, throttleUp: true }, h, open(), events);
  assert.ok(touched && tookOff, "landed, then pulled up and flew again");
});

test("arrow keys hold a steady pitch, even with the mouse at rest", () => {
  const c = Object.create(Controls.prototype);
  c.stick = { x: 0, y: 0 };
  c.lastMove = 0;
  c.keys = new Set(["ArrowDown"]);
  for (let i = 0; i < 120; i++) assert.equal(c.update(1 / 60, 5000 + i * 16).pitch, 1);
  c.keys = new Set(["ArrowUp"]);
  assert.equal(c.update(1 / 60, 9000).pitch, -1);
  c.keys = new Set(["ArrowDown"]);
  c.stick = { x: 0, y: 0.9 };
  c.lastMove = 9000;
  assert.equal(c.update(1 / 60, 9001).pitch, 1, "never more than full stick");
});
