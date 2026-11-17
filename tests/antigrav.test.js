import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { LEVELS } from "../src/levels/index.js";
import {
  createFlightState,
  stepFlight,
  toggleAntiGrav,
  findNearestSurface,
  setGravity,
  frameRoom,
  FRAMES,
  ANTI_GRAV_RANGE,
} from "../src/physics.js";

const noop = () => {};
const context = new Proxy(
  { createLinearGradient: () => ({ addColorStop: noop }) },
  { get: (target, key) => target[key] || noop },
);
globalThis.document = {
  createElement: () => ({ width: 256, height: 256, getContext: () => context }),
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const level = (id) => LEVELS.find((l) => l.id === id).create(new THREE.Scene());
function flying(pos, yaw = 0, speed = 1.1) {
  const s = createFlightState(pos, null, yaw);
  s.hasFlown = true;
  s.throttle = 0.35;
  s.velocity.set(-Math.sin(yaw) * speed, 0, -Math.cos(yaw) * speed);
  return s;
}
function settle(s, room, steps = 1200) {
  const log = [];
  const events = {
    landing: (c, v) => log.push(["landing", c.name, v.kind]),
    hit: (h) => log.push(["hit", h.name, h.damage]),
    crash: (r) => log.push(["crash", r]),
    gravity: (g) => log.push(["gravity", g]),
  };
  for (let i = 0; i < steps && !s.crashed && !s.grounded; i++) {
    stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, 1 / 120, room, events);
    for (const v of [s.position, s.velocity])
      assert.ok(Number.isFinite(v.x + v.y + v.z), "no NaN");
  }
  return log;
}

test("gravity frames rotate their surface normal to local +Y", () => {
  for (const [key, F] of Object.entries(FRAMES)) {
    const up = F.up.clone().applyQuaternion(F.q);
    assert.ok(up.distanceTo(V(0, 1, 0)) < 1e-9, key);
  }
});

test("V near the north wall swings gravity to the wall and lands gently on it", () => {
  const room = level("living-room");
  const s = flying(V(-0.6, 1.5, -2.9));
  const hit = findNearestSurface(room, s.position, ANTI_GRAV_RANGE, s.gravUp);
  assert.equal(hit.name, "north wall");
  assert.ok(hit.dist < ANTI_GRAV_RANGE);
  const r = toggleAntiGrav(s, room);
  assert.ok(r.ok);
  assert.equal(s.gravKey, "+z");
  assert.deepEqual(s.antiGrav, { kind: "wall", name: "north wall" });
  const log = settle(s, room);
  assert.deepEqual(log, [["landing", "north wall", "landing"]]);
  assert.equal(s.damage, 0);
  assert.equal(s.crashed, false);
  assert.ok(
    Math.abs(s.position.z - (-3.94 + 0.068)) < 1e-6,
    "resting on its wheels on the wall",
  );
  const up = V(0, 1, 0).applyQuaternion(s.quaternion);
  assert.ok(up.z > 0.999, "belly to the wall");
  // Sit there: no sliding off, no falling through.
  for (let i = 0; i < 600; i++) stepFlight(s, { brake: true }, 1 / 120, room);
  assert.ok(s.grounded && Math.abs(s.position.z + 3.94 - 0.068) < 1e-6);
  // V again: normal gravity returns and it floats down to the floor.
  assert.ok(toggleAntiGrav(s, room).off);
  assert.equal(s.gravKey, "+y");
  const back = settle(s, room, 2400);
  assert.equal(s.crashed, false);
  assert.equal(s.grounded?.name, "floor");
  assert.equal(back.filter((e) => e[0] === "landing").length, 1);
  assert.ok(
    V(0, 1, 0).applyQuaternion(s.quaternion).y > 0.999,
    "right side up again",
  );
});

test("V under the ceiling lands upside down on it, then drive and take off from it", () => {
  const room = level("living-room");
  const s = flying(V(0.5, 1.8, 1.5));
  assert.ok(toggleAntiGrav(s, room).ok);
  assert.equal(s.gravKey, "-y");
  const log = settle(s, room);
  assert.deepEqual(log, [["landing", "ceiling", "landing"]]);
  assert.ok(Math.abs(s.position.y - (2.64 - 0.068)) < 1e-6);
  assert.ok(V(0, 1, 0).applyQuaternion(s.quaternion).y < -0.999, "upside down");
  // Taxi + take off along the ceiling.
  let took = false;
  for (let i = 0; i < 500 && !took; i++)
    stepFlight(
      s,
      { throttleUp: true, pitch: s.velocity.length() > 0.86 ? 0.8 : 0 },
      1 / 120,
      room,
      { takeoff: () => (took = true) },
    );
  assert.ok(took, "took off from the ceiling");
  for (let i = 0; i < 60; i++)
    stepFlight(s, { throttleUp: true }, 1 / 120, room);
  assert.ok(
    s.position.y < 2.64 - 0.068,
    "away from the ceiling, toward the floor",
  );
  assert.equal(s.gravKey, "-y");
});

test("no surface nearby: V says so and nothing changes; restart resets gravity", () => {
  const room = level("parking-lot");
  const s = flying(V(0, 4, -3.6));
  const r = toggleAntiGrav(s, room);
  assert.equal(r.ok, false);
  assert.match(r.message, /No surface close enough/);
  assert.equal(s.gravKey, "+y");
  const fresh = createFlightState(room.spawn, room.pads[0], 0);
  assert.equal(fresh.gravKey, "+y");
  assert.equal(fresh.antiGrav, null);
});

test("outdoors: stick to the side of the house, and let go when far away", () => {
  const room = level("front-lawn");
  const house = room.colliders.find((c) => c.name === "House");
  assert.ok(house, "the house");
  // In front of the house wall, east of the porch, flying toward it.
  const s = flying(V(6, 2.5, house.max.z + 1.0), 0, 0.9);
  const r = toggleAntiGrav(s, room);
  assert.ok(r.ok, r.message);
  assert.equal(s.gravKey, "+z");
  assert.equal(s.antiGrav.name, "side of the house");
  const log = settle(s, room);
  assert.deepEqual(log, [["landing", "side of the house", "landing"]]);
  assert.equal(s.crashed, false);
  // Teleport far out into the open: anti-grav lets go by itself.
  s.grounded = null;
  s.position.z += 6;
  let released = null;
  for (let i = 0; i < 120; i++)
    stepFlight(s, {}, 1 / 120, room, { gravity: (g) => (released = g) });
  assert.ok(released?.auto);
  assert.equal(s.gravKey, "+y");
});

test("the store: shelf sides, signs and the ceiling are all anti-grav surfaces", () => {
  const room = level("mega-mart");
  const side = findNearestSurface(room, V(-3, 1.2, -4), ANTI_GRAV_RANGE);
  assert.match(side.name, /side of the/);
  const sign = findNearestSurface(room, V(-9, 4.6, -3.2), ANTI_GRAV_RANGE);
  assert.match(sign.name, /aisle 1 sign/);
  const ceil = findNearestSurface(room, V(0, 6.6, 10), ANTI_GRAV_RANGE);
  assert.equal(ceil.name, "store ceiling");
  const s = flying(V(0, 6.4, 10), Math.PI);
  assert.ok(toggleAntiGrav(s, room).ok);
  settle(s, room);
  assert.equal(s.grounded?.name, "store ceiling");
  assert.equal(s.damage, 0);
});

test("anti-grav frame caches are rebuilt per level and keep names", () => {
  const room = level("living-room");
  const local = frameRoom(room, "+x");
  assert.equal(local.colliders.length, room.colliders.length);
  assert.equal(local.ground.name, "west wall");
  assert.equal(frameRoom(room, "+x"), local, "cached");
  assert.equal(frameRoom(room, "+y"), room);
  const s = flying(V(0, 1, 0));
  setGravity(s, V(-1, 0, 0), { kind: "wall", name: "east wall" });
  assert.equal(s.gravKey, "-x");
});
