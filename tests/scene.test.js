import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPlane, animatePlane } from "../src/plane.js";
import { createRoom } from "../src/room.js";
import { CrashEffects } from "../src/crash.js";
import { createFlightState, stepFlight } from "../src/physics.js";

// A drawing-only canvas stub allows geometry/collision tests without a GPU or DOM.
// It does not pretend to validate rendered appearance or real browser pointer lock.
const noop = () => {};
const context = new Proxy(
  { createLinearGradient: () => ({ addColorStop: noop }) },
  { get: (target, key) => target[key] || noop },
);
globalThis.document = {
  createElement: () => ({ width: 256, height: 256, getContext: () => context }),
};

test("actual room has all four landable surfaces and a supported spawn", () => {
  const scene = new THREE.Scene(),
    room = createRoom(scene);
  assert.equal(room.pads.length, 4);
  assert.equal(room.pads.filter((p) => p.name.includes("couch")).length, 2);
  const s = createFlightState(room.spawn, room.pads[0]);
  for (let i = 0; i < 60; i++)
    stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, 1 / 120, room);
  assert.equal(s.crashed, false);
  for (const pad of room.pads) {
    assert.ok(
      room.colliders.some(
        (c) =>
          Math.abs(c.max.y - pad.y) < 0.001 &&
          pad.x >= c.min.x &&
          pad.x <= c.max.x &&
          pad.z >= c.min.z &&
          pad.z <= c.max.z,
      ),
      `pad ${pad.id} needs matching support`,
    );
  }
});
test("actual room allows table takeoff clear of chairs and furniture", () => {
  const room = createRoom(new THREE.Scene()),
    s = createFlightState(room.spawn, room.pads[0]);
  for (let i = 0; i < 300; i++)
    stepFlight(
      s,
      {
        throttleUp: true,
        pitch: !s.hasFlown && s.velocity.length() > 0.86 ? 0.8 : 0,
        yaw: 0,
        roll: 0,
      },
      1 / 120,
      room,
    );
  assert.equal(s.crashed, false);
  assert.equal(s.hasFlown, true);
  assert.ok(s.position.y > 0.9);
});
test("gear and flaps animate, propeller responds, and crash separates eight semantic parts", () => {
  const scene = new THREE.Scene(),
    plane = createPlane();
  scene.add(plane.root);
  plane.root.position.set(0, 1, 0);
  plane.root.rotation.y = 0.5;
  for (let i = 0; i < 120; i++)
    animatePlane(
      plane,
      { throttle: 1, gearDown: false, flapsDown: true },
      1 / 120,
    );
  assert.ok(plane.gearBlend < 0.001);
  assert.ok(plane.flapBlend > 0.99);
  assert.ok(plane.propeller.rotation.z > 100);
  const effects = new CrashEffects(scene, plane);
  effects.explode(plane.root.position, new THREE.Vector3(0, 0, -1));
  assert.equal(effects.debris.length, 8);
  assert.equal(effects.particles.length, 64);
  assert.equal(plane.root.visible, false);
  assert.ok(effects.debris.every((d) => d.mesh.position.y > 0.8));
  const start = effects.debris[0].mesh.position.clone();
  effects.update(0.1);
  assert.ok(effects.debris[0].mesh.position.distanceTo(start) > 0);
  assert.ok(effects.flash.intensity > 0);
  effects.reset();
  assert.equal(effects.debris.length, 0);
  assert.equal(effects.particles.length, 0);
  assert.equal(plane.root.visible, true);
});
test("Nir's plane model ships next to index.html and its gear retracts on its own axis", async () => {
  const { PLANE_MODEL_URL, NIR_PLANE } = await import("../src/plane.js");
  const { existsSync } = await import("node:fs");
  assert.match(PLANE_MODEL_URL, /^\.\/models\/.+\.glb$/);
  assert.ok(existsSync(PLANE_MODEL_URL), `${PLANE_MODEL_URL} is missing`);
  assert.equal(NIR_PLANE.gear.length, 3);
  const plane = createPlane();
  const g = new THREE.Group();
  g.userData.retract = { axis: "x", angle: 1.45 };
  plane.gears = [g];
  for (let i = 0; i < 120; i++)
    animatePlane(
      plane,
      { throttle: 0, gearDown: false, flapsDown: false },
      1 / 120,
    );
  assert.ok(g.rotation.x > 1.4 && g.rotation.z === 0);
  assert.equal(g.visible, false);
});
