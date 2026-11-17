import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {
  STEP,
  advanceFixed,
  renderAlpha,
  Pose,
  interpolatePose,
  snapToTexel,
} from "../src/loop.js";
import { createFlightState, stepFlight } from "../src/physics.js";
import { ChaseCamera } from "../src/camera.js";

test("fixed-step accumulator: whole steps run, alpha is the leftover fraction", () => {
  let n = 0;
  const r = advanceFixed(0, 0.02, STEP, () => n++);
  assert.equal(r.steps, 2); // 20 ms = 2.4 steps of 8.33 ms
  assert.equal(n, 2);
  assert.ok(Math.abs(r.accumulator - (0.02 - 2 * STEP)) < 1e-12);
  assert.ok(Math.abs(r.alpha - 0.4) < 1e-9);
  // Long hitches are capped so the sim never spirals.
  assert.equal(advanceFixed(0, 1, STEP).steps, 6);
  assert.equal(renderAlpha(0), 0);
  assert.equal(renderAlpha(STEP * 0.999) < 1, true);
  assert.equal(renderAlpha(NaN), 1);
  assert.equal(advanceFixed(0, -1, STEP).steps, 0);
});

test("pose interpolation lerps position, slerps rotation and snaps teleports", () => {
  const a = new Pose(),
    b = new Pose(),
    out = new Pose();
  b.position.set(0.1, 0, 0);
  b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  interpolatePose(out, a, b, 0.5);
  assert.ok(Math.abs(out.position.x - 0.05) < 1e-12);
  assert.ok(
    Math.abs(out.quaternion.angleTo(a.quaternion) - Math.PI / 4) < 1e-9,
  );
  b.position.set(5, 0, 0); // teleport (restart / debug)
  interpolatePose(out, a, b, 0.25);
  assert.equal(out.position.x, 5);
});

test("shadow camera follow snaps to whole texels in light space", () => {
  const offset = new THREE.Vector3(10, 16, 8),
    texel = 20 / 2048;
  const z = offset.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const out = new THREE.Vector3();
  for (const p of [
    new THREE.Vector3(1.2345, 0, -3.21),
    new THREE.Vector3(-7.77, 0, 4.4),
  ]) {
    snapToTexel(out, p, offset, texel);
    const u = out.dot(x) / texel,
      v = out.dot(y) / texel;
    assert.ok(
      Math.abs(u - Math.round(u)) < 1e-6 && Math.abs(v - Math.round(v)) < 1e-6,
    );
    assert.ok(out.distanceTo(p) < texel, "moves less than a texel");
  }
});

/** Simulate the real frame loop at a display rate and measure how evenly the
 * plane moves across the screen (the jitter Nir saw). */
function screenMotion(hz, interpolate) {
  const room = { pads: [], colliders: [], ground: { y: 0, name: "grass" } };
  const s = createFlightState(new THREE.Vector3(0, 3, 0), null, 0);
  s.hasFlown = true;
  s.throttle = 0.7;
  s.velocity.set(0, 0, -1.6);
  const cam = new THREE.PerspectiveCamera(66, 16 / 10, 0.02, 100);
  const chase = new ChaseCamera(cam);
  const prev = new Pose().copyFrom(s),
    curr = new Pose().copyFrom(s),
    render = new Pose().copyFrom(s);
  chase.update(1, render, s, null, true);
  let acc = 0,
    seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const speeds = [];
  let last = null;
  for (let f = 0; f < hz * 3; f++) {
    const dt = (1 / hz) * (0.9 + 0.2 * rand()); // real frame times wobble
    const r = advanceFixed(acc, dt, STEP, (h) => {
      prev.copyFrom(curr);
      stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, h, room);
      curr.copyFrom(s);
    });
    acc = r.accumulator;
    if (interpolate) interpolatePose(render, prev, curr, r.alpha);
    else render.copyFrom(curr);
    chase.update(dt, render, s, null);
    cam.updateMatrixWorld();
    // Screen-space position of a point on the ground under the flight path,
    // and the plane itself relative to the camera.
    const world = render.position.clone();
    const rel = world.clone().applyMatrix4(cam.matrixWorldInverse);
    if (last) speeds.push(rel.distanceTo(last) / dt);
    last = rel;
  }
  speeds.splice(0, hz); // let the camera settle
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const sd = Math.sqrt(
    speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length,
  );
  return { mean, sd };
}
function worldMotion(hz, interpolate) {
  const room = { pads: [], colliders: [], ground: { y: 0, name: "grass" } };
  const s = createFlightState(new THREE.Vector3(0, 3, 0), null, 0);
  s.hasFlown = true;
  s.throttle = 0.7;
  s.velocity.set(0, 0, -1.6);
  const prev = new Pose().copyFrom(s),
    curr = new Pose().copyFrom(s),
    render = new Pose().copyFrom(s);
  let acc = 0,
    seed = 11,
    last = null;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ratios = [];
  for (let f = 0; f < hz * 2; f++) {
    const dt = (1 / hz) * (0.9 + 0.2 * rand());
    const r = advanceFixed(acc, dt, STEP, (h) => {
      prev.copyFrom(curr);
      stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, h, room);
      curr.copyFrom(s);
    });
    acc = r.accumulator;
    if (interpolate) interpolatePose(render, prev, curr, r.alpha);
    else render.copyFrom(curr);
    if (last)
      ratios.push(
        render.position.distanceTo(last) / (s.velocity.length() * dt),
      );
    last = render.position.clone();
  }
  ratios.splice(0, 10); // start-up transient
  const worst = Math.max(...ratios.map((x) => Math.abs(x - 1)));
  return worst;
}

for (const hz of [60, 144]) {
  test(`${hz} Hz display: interpolated plane moves evenly (no stepping jitter)`, () => {
    const raw = worldMotion(hz, false),
      smooth = worldMotion(hz, true);
    // Without interpolation the drawn plane jumps 0, 1 or 2 physics steps per frame.
    assert.ok(raw > 0.35, `raw stepping visible (${raw.toFixed(2)})`);
    assert.ok(
      smooth < 0.05,
      `interpolated motion is even (${smooth.toFixed(3)})`,
    );
    // The plane sits steady in front of the chase camera.
    const a = screenMotion(hz, false),
      b = screenMotion(hz, true);
    assert.ok(
      b.sd < a.sd * 0.5,
      `camera-relative wobble ${b.sd.toFixed(4)} vs ${a.sd.toFixed(4)}`,
    );
  });
}
