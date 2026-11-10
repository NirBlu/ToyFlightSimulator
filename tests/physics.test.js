import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  createFlightState,
  stepFlight,
  assessLanding,
  padContains,
} from "../src/physics.js";
const pad = {
  id: "dining",
  name: "dining table",
  x: -1.4,
  y: 0.78,
  z: 1.5,
  w: 1.36,
  d: 2.18,
};
const room = () => ({
  pads: [pad],
  colliders: [
    {
      min: new Vector3(-2.08, 0.69, 0.41),
      max: new Vector3(-0.72, 0.78, 2.59),
      name: "Dining table",
    },
  ],
});
const neutral = { pitch: 0, yaw: 0, roll: 0, throttleUp: false, brake: false };
const spawn = () => createFlightState(new Vector3(-1.4, 0.848, 2.28), pad);
const flight = () => {
  const s = spawn();
  s.position.set(0, 1.5, 0);
  s.grounded = null;
  s.hasFlown = true;
  return s;
};

test("rests on the table without falling or colliding", () => {
  const s = spawn();
  for (let i = 0; i < 240; i++) stepFlight(s, neutral, 1 / 120, room());
  assert.equal(s.crashed, false);
  assert.equal(s.grounded, pad);
  assert.ok(Math.abs(s.position.y - 0.848) < 1e-6);
});
test("throttle is bounded and wheel brakes stop the plane", () => {
  const s = spawn();
  s.throttle = 0.9;
  s.velocity.z = -0.5;
  for (let i = 0; i < 120; i++)
    stepFlight(s, { ...neutral, brake: true }, 1 / 120, room());
  assert.ok(s.throttle < 0.21);
  assert.ok(s.velocity.length() < 0.01);
  assert.equal(s.crashed, false);
});
test("holding W and pulling back achieves table takeoff", () => {
  const s = spawn();
  let tookOff = false;
  for (let i = 0; i < 280; i++)
    stepFlight(
      s,
      {
        ...neutral,
        throttleUp: true,
        pitch: !s.hasFlown && s.velocity.length() > 0.86 ? 0.8 : 0,
      },
      1 / 120,
      room(),
      {
        takeoff: () => {
          tookOff = true;
        },
      },
    );
  assert.ok(tookOff);
  assert.equal(s.grounded, null);
  assert.ok(s.position.y > 0.9);
  assert.equal(s.crashed, false);
});
test("flaps produce more drag and reduce airspeed", () => {
  const a = flight(),
    b = flight();
  a.velocity.z = b.velocity.z = -1.5;
  b.flapsDown = true;
  for (let i = 0; i < 30; i++) {
    stepFlight(a, neutral, 1 / 120, { pads: [], colliders: [] });
    stepFlight(b, neutral, 1 / 120, { pads: [], colliders: [] });
  }
  assert.ok(
    Math.hypot(b.velocity.x, b.velocity.z) <
      Math.hypot(a.velocity.x, a.velocity.z),
  );
});
test("stall gently drops the nose rather than triggering an instant crash", () => {
  const s = flight();
  s.velocity.z = -0.3;
  s.pitch = 0.1;
  stepFlight(s, neutral, 1 / 60, { pads: [], colliders: [] });
  assert.equal(s.stall, true);
  assert.ok(s.pitch < 0.1);
  assert.equal(s.crashed, false);
});
test("gentle gear-down touchdown succeeds and names the surface", () => {
  const s = flight();
  s.position.set(-1.4, 0.85, 1.5);
  s.velocity.set(0, -0.2, -0.5);
  let landed = "";
  for (let i = 0; i < 6; i++)
    stepFlight(s, neutral, 1 / 120, room(), {
      landing: (p) => {
        landed = p.name;
      },
    });
  assert.equal(landed, "dining table");
  assert.equal(s.grounded, pad);
  assert.equal(s.landings, 1);
  assert.equal(s.crashed, false);
});
test("steep, banked, fast, and hard gear-up touchdowns fail", () => {
  const s = flight();
  s.velocity.set(0, -0.3, -0.7);
  assert.equal(assessLanding(s), "success");
  s.roll = 0.6;
  assert.notEqual(assessLanding(s), "success");
  s.roll = 0;
  s.velocity.y = -1;
  assert.notEqual(assessLanding(s), "success");
  s.velocity.set(0, -0.3, -2);
  assert.notEqual(assessLanding(s), "success");
  s.velocity.set(0, -0.3, -0.7);
  s.gearDown = false;
  assert.notEqual(assessLanding(s), "success");
});
test("gear must be physically extended, not merely toggled at impact", () => {
  const s = flight();
  s.gearDown = true;
  s.gearExtension = 0.4;
  s.velocity.set(0, -0.2, -0.7);
  assert.notEqual(assessLanding(s), "success");
});
test("very slow gear-up contact is a survivable scrape", () => {
  const s = flight();
  s.gearDown = false;
  s.velocity.set(0, -0.05, -0.2);
  assert.equal(assessLanding(s), "scrape");
});
test("slow bump into a room wall adds damage instead of exploding", () => {
  const s = flight();
  s.position.set(2.95, 1.5, 0);
  s.velocity.set(0.6, 0, 0);
  let hits = 0;
  stepFlight(
    s,
    neutral,
    1 / 120,
    {
      pads: [],
      colliders: [],
      bounds: { minX: -2.94, maxX: 2.94, minZ: -3.94, maxZ: 3.94, maxY: 2.64 },
    },
    { hit: () => hits++, crash: () => assert.fail("should not crash") },
  );
  assert.equal(s.crashed, false);
  assert.equal(hits, 1);
  assert.ok(s.damage > 0 && s.damage < 30, `damage ${s.damage}`);
  assert.ok(s.position.x <= 2.94);
  assert.ok(s.velocity.x <= 0, "bounced back off the wall");
});
test("violent head-on wall impact still crashes, exactly once", () => {
  const s = flight();
  s.position.set(2.95, 1.5, 0);
  s.velocity.set(2.2, 0, 0);
  let n = 0;
  const box = {
    pads: [],
    colliders: [],
    bounds: { minX: -2.94, maxX: 2.94, minZ: -3.94, maxZ: 3.94, maxY: 2.64 },
  };
  stepFlight(s, neutral, 1 / 120, box, { crash: () => n++ });
  stepFlight(s, neutral, 1 / 120, box, { crash: () => n++ });
  assert.equal(s.crashed, true);
  assert.equal(n, 1);
});
test("gentle wingtip / furniture bump damages, fast head-on impact destroys", () => {
  const obstacle = {
    min: new Vector3(0.15, 1.4, -0.1),
    max: new Vector3(0.3, 1.6, 0.1),
    name: "Bookcase",
  };
  const slow = flight();
  slow.position.set(-0.05, 1.5, 0);
  slow.velocity.set(0.5, 0, 0);
  let info = null;
  for (let i = 0; i < 30 && !info; i++)
    stepFlight(
      slow,
      neutral,
      1 / 120,
      { pads: [], colliders: [obstacle] },
      { hit: (h) => (info = h) },
    );
  assert.equal(slow.crashed, false);
  assert.ok(slow.damage > 0);
  assert.equal(info.name, "bookcase");
  const fast = flight();
  fast.velocity.set(0, 0, -2.2);
  const wall = {
    min: new Vector3(-1, 0, -0.3),
    max: new Vector3(1, 3, -0.15),
    name: "Bookcase",
  };
  let reason = "";
  for (let i = 0; i < 10 && !fast.crashed; i++)
    stepFlight(
      fast,
      neutral,
      1 / 120,
      { pads: [], colliders: [wall] },
      { crash: (r) => (reason = r) },
    );
  assert.equal(fast.crashed, true);
  assert.match(reason, /bookcase/);
});
test("landing boundaries do not accept a pad outside its marked area", () => {
  assert.equal(padContains(pad, new Vector3(-1.4, 1, 1.5)), true);
  assert.equal(padContains(pad, new Vector3(0, 1, 1.5)), false);
});
