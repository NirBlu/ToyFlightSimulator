import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {
  createFlightState,
  stepFlight,
  assessTouchdown,
  impactDamage,
  getSurfaces,
  CRASH_IMPACT,
} from "../src/physics.js";
import { createBall, stepBalls, interactBalls } from "../src/balls.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const neutral = { pitch: 0, yaw: 0, roll: 0, throttleUp: false, brake: false };
const carRoof = {
  min: V(-0.8, 0.95, -1.2),
  max: V(0.8, 1.45, 1.2),
  name: "Red car roof",
};
const level = (extra = {}) => ({
  pads: [],
  colliders: [carRoof],
  ground: { y: 0, name: "grass" },
  groundZones: [{ name: "patio", x: 5, z: 0, w: 4, d: 4 }],
  ...extra,
});
function airborne(x, y, z) {
  const s = createFlightState(V(x, y, z), null);
  s.hasFlown = true;
  return s;
}
function fly(s, room, events = {}, steps = 240) {
  for (let i = 0; i < steps && !s.grounded && !s.crashed; i++)
    stepFlight(s, neutral, 1 / 120, room, events);
}

test("a gentle landing on plain grass counts: no pad needed", () => {
  const s = airborne(0, 0.12, 4);
  s.velocity.set(0, -0.25, -0.8);
  let landed = null;
  fly(s, level(), { landing: (surface, v) => (landed = { surface, v }) });
  assert.equal(s.crashed, false);
  assert.ok(s.grounded, "grounded");
  assert.equal(landed.surface.name, "grass");
  assert.equal(landed.v.kind, "landing");
  assert.equal(s.landings, 1);
  assert.equal(s.damage, 0);
});
test("named ground zones are reported (patio)", () => {
  const s = airborne(5, 0.1, 0);
  s.velocity.set(0, -0.2, -0.6);
  let name = "";
  fly(s, level(), { landing: (surface) => (name = surface.name) });
  assert.equal(name, "patio");
});
test("any flat furniture / car top is landable and named", () => {
  const s = airborne(0, 1.56, 0.5);
  s.velocity.set(0, -0.3, -0.7);
  let name = "";
  fly(s, level(), { landing: (surface) => (name = surface.name) });
  assert.equal(s.crashed, false);
  assert.equal(name, "red car roof");
  assert.ok(Math.abs(s.position.y - (1.45 + 0.068)) < 1e-6);
  assert.ok(getSurfaces(level()).length >= 1);
});
test("hard wheels-down landing is survivable: bumpy, with damage", () => {
  const s = airborne(0, 0.2, 4);
  s.velocity.set(0, -1.0, -1.0);
  let verdict = null;
  fly(s, level(), { landing: (_, v) => (verdict = v) });
  assert.equal(s.crashed, false);
  assert.equal(verdict.kind, "rough");
  assert.ok(s.damage > 0 && s.damage < 60, `damage ${s.damage}`);
  assert.ok(s.grounded);
});
test("belly landing (gear up) slides to a stop with damage, no explosion", () => {
  const s = airborne(0, 0.1, 4);
  s.gearDown = false;
  s.gearExtension = 0;
  s.velocity.set(0, -0.4, -1.1);
  let scraped = null;
  fly(s, level(), { scrape: (surface, v) => (scraped = v) });
  assert.equal(s.crashed, false);
  assert.equal(scraped.kind, "belly");
  assert.ok(s.damage > 0);
  assert.equal(s.throttle, 0);
});
test("touchdown grading", () => {
  const s = airborne(0, 1, 0);
  s.velocity.set(0, -0.3, -0.9);
  assert.equal(assessTouchdown(s).kind, "landing");
  s.velocity.set(0, -0.3, -1.9);
  assert.equal(assessTouchdown(s).kind, "rough");
  s.velocity.set(0, -2.2, -1);
  assert.equal(assessTouchdown(s).kind, "crash");
  s.velocity.set(0, -1.2, -1.8);
  s.pitch = -0.6;
  assert.equal(assessTouchdown(s).kind, "crash", "nosedive");
});
test("damage scales with impact and caps the safe range", () => {
  assert.equal(impactDamage(0.05), 0);
  assert.ok(impactDamage(0.5) < impactDamage(1));
  assert.ok(impactDamage(CRASH_IMPACT - 0.01) < 100);
});
test("damage reaching 100% breaks the plane", () => {
  const s = airborne(0, 0.2, 4);
  s.damage = 95;
  s.velocity.set(0, -1.0, -1.0);
  let reason = "";
  fly(s, level(), { crash: (r) => (reason = r) });
  assert.equal(s.crashed, true);
  assert.match(reason, /bumps/i);
});
test("rolling onto a neighbouring top at the same height stays grounded", () => {
  const a = { min: V(-1, 0, -1), max: V(1, 0.5, 0), name: "Cushion A" };
  const b = { min: V(-1, 0, -2), max: V(1, 0.5, -1), name: "Cushion B" };
  const room = { pads: [], colliders: [a, b] };
  const s = createFlightState(V(0, 0.568, -0.5), getSurfaces(room)[0]);
  s.velocity.set(0, 0, -0.5);
  s.throttle = 0.3;
  let landings = 0;
  for (let i = 0; i < 160; i++)
    stepFlight(s, neutral, 1 / 120, room, { landing: () => landings++ });
  assert.ok(s.position.z < -1.05);
  assert.equal(s.grounded.name, "cushion b");
  assert.equal(landings, 0);
});
test("soft outdoor edge turns the plane around without damage", () => {
  const s = airborne(17.99, 2, 0);
  s.yaw = -Math.PI / 2; // heading +x
  s.velocity.set(1.2, 0, 0);
  let edge = 0;
  const room = level({
    bounds: { minX: -18, maxX: 18, minZ: -18, maxZ: 18, maxY: 9, soft: true },
  });
  for (let i = 0; i < 10; i++)
    stepFlight(s, neutral, 1 / 120, room, { boundary: () => edge++ });
  assert.equal(s.crashed, false);
  assert.equal(s.damage, 0);
  assert.ok(edge >= 1);
  assert.ok(s.velocity.x < 0, "now heading back inside");
  assert.ok(Math.sin(-s.yaw) < 0, "yaw mirrored");
});
test("balls get pushed by the plane and never damage it", () => {
  const ball = createBall({ radius: 0.15, position: V(0, 1, -0.2) });
  const s = airborne(0, 1, 0);
  s.velocity.set(0, 0, -1.2);
  const room = { pads: [], colliders: [], balls: [ball] };
  let bumped = 0;
  for (let i = 0; i < 30; i++) {
    stepFlight(s, neutral, 1 / 120, room, {
      ball: () => bumped++,
      crash: () => assert.fail("no crash"),
    });
    stepBalls(room, 1 / 120);
  }
  assert.ok(bumped >= 1);
  assert.ok(ball.velocity.z < -0.5, `ball pushed forward ${ball.velocity.z}`);
  assert.equal(s.damage, 0);
  assert.equal(s.crashed, false);
  assert.ok(s.velocity.length() > 0.7, "plane only nudged");
});
test("balls fall, bounce, settle on the floor and on furniture", () => {
  const table = { min: V(-0.5, 0, -0.5), max: V(0.5, 0.5, 0.5), name: "Table" };
  const onTable = createBall({ radius: 0.1, position: V(0, 1.2, 0) });
  const onFloor = createBall({
    radius: 0.2,
    position: V(2, 1.5, 0),
    bounce: 0.7,
  });
  const room = {
    colliders: [table],
    balls: [onTable, onFloor],
    ground: { y: 0 },
  };
  let maxBounce = 0,
    touched = false;
  for (let i = 0; i < 1200; i++) {
    stepBalls(room, 1 / 120);
    if (onFloor.position.y <= 0.2001) touched = true;
    if (touched) maxBounce = Math.max(maxBounce, onFloor.position.y);
  }
  assert.ok(maxBounce > 0.4, "bounced");
  assert.ok(Math.abs(onFloor.position.y - 0.2) < 0.01);
  assert.ok(Math.abs(onTable.position.y - 0.6) < 0.01);
});
test("balls collide with each other", () => {
  const a = createBall({
    radius: 0.1,
    position: V(0, 0.1, 0),
    velocity: V(1, 0, 0),
  });
  const b = createBall({ radius: 0.1, position: V(0.3, 0.1, 0) });
  const room = { colliders: [], balls: [a, b] };
  for (let i = 0; i < 60; i++) stepBalls(room, 1 / 120);
  assert.ok(b.velocity.x > 0.3);
  assert.ok(a.velocity.x < b.velocity.x);
});
test("plane-ball interaction helper ignores balls that are far away", () => {
  const ball = createBall({ radius: 0.1, position: V(5, 0.1, 5) });
  const s = airborne(0, 1, 0);
  s.velocity.set(0, 0, -1);
  interactBalls(s, [ball]);
  assert.equal(ball.velocity.length(), 0);
});
