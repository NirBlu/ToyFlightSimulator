import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { LEVELS } from "../src/levels/index.js";
import { createFlightState, stepFlight, padContains } from "../src/physics.js";
import { stepBalls } from "../src/balls.js";

// Drawing-only canvas stub (no GPU / DOM needed for geometry + physics checks).
const noop = () => {};
const context = new Proxy(
  { createLinearGradient: () => ({ addColorStop: noop }) },
  { get: (target, key) => target[key] || noop },
);
globalThis.document = {
  createElement: () => ({ width: 256, height: 256, getContext: () => context }),
};
const build = (def) => def.create(new THREE.Scene());

test("there are five levels with unique ids and complete environments", () => {
  assert.deepEqual(
    LEVELS.map((l) => l.id),
    ["living-room", "front-lawn", "toy-room", "parking-lot", "mega-mart"],
  );
  for (const l of LEVELS) {
    assert.ok(l.name && l.short && l.tagline && l.objective && l.heroTitle);
    assert.ok(l.env.far > l.env.fog[1] - 1, `${l.id} far plane covers fog`);
    assert.ok(l.env.camera && l.env.sun && l.env.hemi);
  }
});

for (const def of LEVELS) {
  test(`${def.name}: spawn sits on its pad, pads are supported, plane rests safely`, () => {
    const room = build(def);
    const spawnPad = room.pads.find((p) => p.id === room.spawnPadId);
    const targetPad = room.pads.find((p) => p.id === room.targetPadId);
    assert.ok(spawnPad, "spawn pad");
    assert.ok(targetPad, "target pad");
    assert.ok(room.pads.length >= 4, "several suggested landing spots");
    assert.ok(padContains(spawnPad, room.spawn, 0.1));
    assert.ok(Math.abs(room.spawn.y - (spawnPad.y + 0.068)) < 1e-6);
    for (const pad of room.pads) {
      const supported =
        pad.y === 0 ||
        room.colliders.some(
          (c) =>
            Math.abs(c.max.y - pad.y) < 0.002 &&
            pad.x >= c.min.x &&
            pad.x <= c.max.x &&
            pad.z >= c.min.z &&
            pad.z <= c.max.z,
        );
      assert.ok(supported, `pad ${pad.id} needs a matching surface`);
    }
    const s = createFlightState(room.spawn, spawnPad, room.spawnYaw);
    for (let i = 0; i < 240; i++)
      stepFlight(s, { pitch: 0, yaw: 0, roll: 0 }, 1 / 120, room);
    assert.equal(s.crashed, false);
    assert.equal(s.damage, 0);
    assert.equal(s.grounded, spawnPad);
  });
  test(`${def.name}: full-power takeoff from the spawn is clean`, () => {
    const room = build(def);
    const spawnPad = room.pads.find((p) => p.id === room.spawnPadId);
    const s = createFlightState(room.spawn, spawnPad, room.spawnYaw);
    let hits = 0;
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
        { hit: () => hits++ },
      );
    assert.equal(s.crashed, false);
    assert.equal(hits, 0, "no bumps on the way out");
    assert.equal(s.hasFlown, true);
    assert.equal(s.grounded, null);
    assert.ok(s.position.y > room.spawn.y, "climbing away");
  });
}

test("Front Lawn and Parking Lot are big open outdoor areas with soft edges", () => {
  for (const id of ["front-lawn", "parking-lot"]) {
    const room = build(LEVELS.find((l) => l.id === id));
    const b = room.bounds;
    assert.ok(b.soft, `${id} soft bounds`);
    assert.ok(b.maxX - b.minX >= 30 && b.maxZ - b.minZ >= 30, `${id} size`);
  }
  const lawn = build(LEVELS[1]);
  for (const n of [
    "stone wall",
    "patio table",
    "patio chair",
    "sun lounger",
    "barbecue",
    "mailbox",
    "garden bench",
  ])
    assert.ok(
      lawn.colliders.some((c) => c.name.toLowerCase() === n),
      n,
    );
});

test("Parking Lot has landable car roofs, a van and a box truck", () => {
  const lot = build(LEVELS[3]);
  const roofs = lot.colliders.filter((c) => / car roof$/i.test(c.name));
  assert.ok(roofs.length >= 10, `car roofs: ${roofs.length}`);
  assert.ok(roofs.every((c) => c.landable !== false));
  assert.ok(lot.colliders.some((c) => /van roof/i.test(c.name)));
  assert.ok(lot.colliders.some((c) => c.name === "Box truck"));
  assert.ok(lot.colliders.some((c) => c.name === "Light pole"));
});

test("Toy Room balls come in many sizes, settle, and stay in the room", () => {
  const room = build(LEVELS[2]);
  assert.ok(room.balls.length >= 8);
  assert.ok(
    new Set(room.balls.map((b) => b.radius)).size >= 6,
    "different sizes",
  );
  for (let i = 0; i < 600; i++) stepBalls(room, 1 / 120);
  const b = room.bounds;
  for (const ball of room.balls) {
    const p = ball.position;
    assert.ok(Number.isFinite(p.x + p.y + p.z));
    assert.ok(p.y >= ball.radius - 0.005, `${ball.name} above floor`);
    assert.ok(p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ);
    assert.ok(ball.velocity.length() < 0.2, `${ball.name} settled`);
  }
});

test("Mega Mart is a big indoor store with aisles, checkouts, freezers, produce and carts", () => {
  const def = LEVELS.find((l) => l.id === "mega-mart");
  const scene = new THREE.Scene();
  const store = def.create(scene);
  const b = store.bounds;
  assert.ok(!b.soft, "indoor: solid walls and ceiling");
  assert.ok(b.maxX - b.minX >= 28 && b.maxZ - b.minZ >= 38, "about 30 × 40 m");
  assert.ok(b.maxY >= 7 && b.maxY <= 8, "high ceiling");
  const names = store.colliders.map((c) => c.name.toLowerCase());
  const count = (re) => names.filter((n) => re.test(n)).length;
  assert.ok(count(/ shelf$/) >= 6, "shelving aisles");
  assert.ok(count(/^checkout \d$/) >= 4, "checkout lanes");
  assert.ok(count(/freezer/) >= 4, "freezer cases");
  assert.equal(count(/^shopping cart$/), 8, "shopping carts");
  assert.ok(count(/pallet/) >= 3, "pallets");
  assert.ok(count(/table|bin|stand|rack/) >= 4, "produce displays");
  assert.ok(count(/aisle \d sign/) >= 6, "hanging aisle signs");
  assert.ok(count(/quick stop counter/) === 1, "convenience corner");
  assert.ok(store.pads.length >= 6, "suggested pads");
  // Thousands of products, but only a few instanced draw calls.
  let instances = 0,
    instancedMeshes = 0;
  scene.traverse((o) => {
    if (o.isInstancedMesh) {
      instancedMeshes++;
      instances += o.count;
      assert.equal(o.castShadow, false, "products do not cast shadows");
    }
  });
  assert.ok(instances > 2500, `products: ${instances}`);
  assert.ok(instancedMeshes <= 6, `instanced meshes: ${instancedMeshes}`);
  // Every suggested pad and the spawn shelf top are reachable surfaces.
  const top = store.colliders.find((c) => c.name === "Cereal and pasta shelf");
  assert.ok(Math.abs(top.max.y - store.spawn.y + 0.068) < 1e-6);
  assert.equal(def.name.toLowerCase().includes("walmart"), false);
});
