import test from "node:test";
import assert from "node:assert/strict";
import {
  mapGamepads,
  defaultBindings,
  GamepadInput,
  DEFAULT_GAMEPAD_CONFIG,
  STORAGE_KEY,
  applyDeadzone,
  isThrottleId,
} from "../src/gamepad.js";
import { Controls } from "../src/controls.js";
import { Vector3 } from "three";
import { createFlightState, stepFlight } from "../src/physics.js";

const pad = (id, axes, buttons = 12, extra = {}) => ({
  id,
  index: extra.index ?? 0,
  connected: true,
  mapping: extra.mapping ?? "",
  axes: [...axes],
  buttons: Array.from({ length: buttons }, (_, i) => ({
    pressed: !!extra.pressed?.includes(i),
    value: extra.pressed?.includes(i) ? 1 : (extra.values?.[i] ?? 0),
  })),
});
const HOTAS = "Thrustmaster T.Flight Hotas X (Vendor: 044f Product: b108)";
const STICK = "Thrustmaster T.16000M (Vendor: 044f Product: b10a)";
const TWCS = "Thrustmaster TWCS Throttle (Vendor: 044f Product: b687)";
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m };
};

test("deadzone: tiny deflections are ignored, full stays full", () => {
  assert.equal(applyDeadzone(0.05, 0.08), 0);
  assert.equal(applyDeadzone(-0.08, 0.08), 0);
  assert.equal(applyDeadzone(1, 0.08), 1);
  assert.equal(applyDeadzone(-1, 0.08), -1);
  assert.ok(Math.abs(applyDeadzone(0.54, 0.08) - 0.5) < 1e-9);
});

// Nir's real Thrustmaster: 0 side to side, 1 up/down, 3 throttle lever, 5 roll.
const nir = ({ x = 0, y = 0, lever = 0, roll = 0 } = {}) => [x, y, 0, lever, 0, roll, 0, 0];

test("Nir's layout: 0 = turn (like mouse X), 1 = pitch, 3 = throttle, 5 = roll", () => {
  const b = defaultBindings([pad(HOTAS, nir())]);
  assert.equal(b.yaw.axis, 0);
  assert.equal(b.pitch.axis, 1);
  assert.equal(b.throttle.axis, 3);
  assert.equal(b.roll.axis, 5);
  let m = mapGamepads([pad(HOTAS, nir({ x: 1 }))]);
  assert.equal(m.yaw, 1); // side to side right = turn right, like mouse right
  assert.equal(m.roll, 0);
  assert.equal(m.pitch, 0);
  m = mapGamepads([pad(HOTAS, nir({ y: 1 }))]);
  assert.equal(m.pitch, 1); // back = nose up, like mouse toward you
  assert.equal(m.yaw, 0);
  m = mapGamepads([pad(HOTAS, nir({ roll: 1 }))]);
  assert.equal(m.roll, -1); // roll right (A = +1 = left)
  assert.equal(m.yaw, 0);
  assert.equal(mapGamepads([pad(HOTAS, nir({ roll: -1 }))]).roll, 1);
  assert.equal(mapGamepads([pad(HOTAS, nir({ lever: -1 }))]).throttle, 1);
  assert.equal(mapGamepads([pad(HOTAS, nir({ lever: 1 }))]).throttle, 0);
  const rest = mapGamepads([pad(HOTAS, nir({ x: 0.03, y: -0.05, roll: 0.02 }))]);
  assert.equal(rest.pitch, 0);
  assert.equal(rest.roll, 0);
  assert.equal(rest.yaw, 0);
  assert.equal(rest.throttle, 0.5);
  // Small devices fall back safely: roll on axis 2, no lever under 4 axes.
  assert.equal(defaultBindings([pad(HOTAS, [0, 0, 0, 0])]).roll.axis, 2);
  assert.equal(defaultBindings([pad(HOTAS, [0, 0, 0])]).throttle, null);
  assert.equal(defaultBindings([pad(HOTAS, [0, 0])]).roll, null);
});

test("separate stick + throttle devices are told apart by name, any order", () => {
  assert.ok(isThrottleId(TWCS));
  assert.ok(!isThrottleId(HOTAS));
  const pads = [
    pad(TWCS, [0, 0, -1, 0, 0], 14, { index: 0 }),
    pad(STICK, [0, -1, 0, 0.9], 16, { index: 1 }),
  ];
  const b = defaultBindings(pads);
  assert.equal(b.pitch.pad.id, STICK);
  assert.equal(b.throttle.pad.id, TWCS);
  const m = mapGamepads(pads);
  assert.equal(m.pitch, -1); // stick pushed forward = nose down
  assert.equal(m.throttle, 1); // TWCS lever forward
  assert.equal(m.stick.id, STICK);
  assert.equal(m.throttleDevice.id, TWCS);
});

test("standard-mapping gamepad: triggers are throttle up / brake", () => {
  const m = mapGamepads([
    pad("Xbox Wireless Controller", [0, 0, 0.6, 0], 17, {
      mapping: "standard",
      values: { 7: 0.9 },
    }),
  ]);
  assert.equal(m.throttle, null);
  assert.equal(m.throttleUp, true);
  assert.equal(m.brake, false);
  assert.ok(m.yaw > 0.4);
});

test("config: invert pitch, and M swaps roll / turn axes", () => {
  const p = [pad(HOTAS, nir({ x: 0.6, y: 1, roll: -0.6 }))];
  const m = mapGamepads(p, { ...DEFAULT_GAMEPAD_CONFIG, invertPitch: true, swapRollTurn: true });
  assert.equal(m.pitch, -1);
  assert.ok(m.roll < -0.4); // side to side right -> now rolls right
  assert.ok(m.yaw < -0.4); // roll axis left -> now turns left
});

test("old v1 saved mappings are ignored (new defaults win)", () => {
  const store = memory();
  store.setItem("toyflight-gamepad-v1", JSON.stringify({ roll: { id: HOTAS, axis: 0, invert: false }, throttle: { id: HOTAS, axis: 5, invert: true } }));
  const g = new GamepadInput({ getPads: () => [pad(HOTAS, nir({ x: 1 }))], storage: store });
  assert.equal(g.config.roll, null);
  const m = g.poll();
  assert.equal(m.yaw, 1);
  assert.equal(m.roll, 0);
  assert.equal(STORAGE_KEY, "toyflight-gamepad-v2");
});

test("lever only takes over once moved; W/S hand control back; idle brakes", () => {
  const lever = (v) => nir({ lever: v });
  let axes = lever(0.2);
  const g = new GamepadInput({ getPads: () => [pad(HOTAS, axes)], storage: memory() });
  assert.equal(g.poll().throttle, null); // resting lever ignored at first
  axes = lever(0.18);
  assert.equal(g.poll().throttle, null); // tiny jitter still ignored
  axes = lever(-0.6);
  assert.ok(Math.abs(g.poll().throttle - 0.8) < 1e-9); // moved: takes over
  assert.equal(g.poll(true).throttle, null); // W/S pressed: keys win
  assert.equal(g.poll().throttle, null); // ...until the lever moves again
  axes = lever(1);
  const idle = g.poll();
  assert.equal(idle.throttle, 0);
  assert.equal(idle.brake, true);
});

test("buttons fire G / F / V once per press (default trigger = V)", () => {
  let pressed = [];
  const g = new GamepadInput({
    getPads: () => [pad(HOTAS, [0, 0, 0, 0], 12, { pressed })],
    storage: memory(),
  });
  assert.deepEqual(g.poll().actions, []);
  pressed = [0, 1];
  assert.deepEqual(g.poll().actions.sort(), ["KeyG", "KeyV"]);
  assert.deepEqual(g.poll().actions, []); // held: no repeat
  pressed = [2];
  assert.deepEqual(g.poll().actions, ["KeyF"]);
});

test("J-panel learning: move an axis to bind it (direction too), saved", () => {
  const store = memory();
  let axes = [0, 0, 0, 0, 0, 0];
  const g = new GamepadInput({ getPads: () => [pad(STICK, axes)], storage: store });
  g.poll();
  g.startLearn("pitch");
  axes = [0, 0, 0, 0, 0.2, 0];
  g.poll();
  assert.ok(g.learn); // not far enough yet
  axes = [0, 0, 0, 0, -0.9, 0]; // this stick reports "back" as negative axis 4
  g.poll();
  assert.equal(g.learn, null);
  assert.deepEqual(g.config.pitch, { id: STICK, axis: 4, invert: true });
  assert.ok(g.poll().pitch > 0.85); // pulling back is now nose up
  // Throttle: wiggle, then push fully forward and confirm.
  g.startLearn("throttle");
  axes = [0, 0, 0, 0, 0, 1];
  g.poll();
  assert.deepEqual(g.learn.found, { id: STICK, axis: 5 });
  assert.ok(g.confirmLearn());
  assert.deepEqual(g.config.throttle, { id: STICK, axis: 5, invert: false });
  // Saved and reloaded by a fresh instance.
  const again = new GamepadInput({ getPads: () => [pad(STICK, axes)], storage: store });
  assert.equal(again.config.pitch.axis, 4);
  assert.equal(again.config.throttle.axis, 5);
  assert.ok(JSON.parse(store.getItem(STORAGE_KEY)).pitch);
  // Unplugged learned device: falls back to defaults without crashing.
  const other = new GamepadInput({ getPads: () => [pad(HOTAS, nir({ y: 1 }))], storage: store });
  assert.equal(other.poll().pitch, 1);
});

test("button learning binds gear, flaps, anti-grav in order", () => {
  let pressed = [];
  const g = new GamepadInput({
    getPads: () => [pad(HOTAS, [0, 0, 0, 0], 12, { pressed })],
    storage: memory(),
  });
  g.poll();
  g.startLearn("buttons");
  for (const b of [5, 6, 7]) {
    pressed = [b];
    assert.deepEqual(g.poll().actions, []); // learning swallows presses
    pressed = [];
    g.poll();
  }
  assert.equal(g.learn, null);
  assert.equal(g.config.buttons.gear.button, 5);
  assert.equal(g.config.buttons.flaps.button, 6);
  assert.equal(g.config.buttons.antigrav.button, 7);
  pressed = [6];
  assert.deepEqual(g.poll().actions, ["KeyF"]);
});

test("Controls merge: joystick works with no mouse, mouse/keys still work, buttons toggle", () => {
  let axes = nir(),
    pressed = [];
  const c = Object.create(Controls.prototype);
  c.stick = { x: 0, y: 0 };
  c.lastMove = 0;
  c.keys = new Set();
  const toggles = [];
  c.onToggle = (code) => toggles.push(code);
  c.gamepad = new GamepadInput({
    getPads: () => [pad(HOTAS, axes, 12, { pressed })],
    storage: memory(),
  });
  let i = c.update(1 / 60, 1000);
  assert.equal(i.pitch, 0);
  assert.equal(i.throttleSet, null);
  axes = nir({ roll: 1, y: 1, lever: -1 });
  pressed = [1];
  i = c.update(1 / 60, 1016);
  assert.equal(i.pitch, 1);
  assert.equal(i.roll, -1);
  assert.equal(i.throttleSet, 1);
  assert.deepEqual(toggles, ["KeyG"]);
  // Keys still work alongside (A cancels stick-right roll).
  c.keys = new Set(["KeyA"]);
  i = c.update(1 / 60, 1032);
  assert.equal(i.roll, 0);
});

test("physics: throttleSet glides the throttle to the lever position", () => {
  const pad = { id: "big", name: "big table", x: 0, y: 0.78, z: 0, w: 100, d: 100 };
  const room = { pads: [pad], colliders: [] };
  const s = createFlightState(new Vector3(0, 0.848, 0), pad);
  const input = { pitch: 0, yaw: 0, roll: 0, throttleUp: false, brake: false };
  for (let k = 0; k < 120; k++) stepFlight(s, { ...input, throttleSet: 0.7 }, 1 / 120, room);
  assert.ok(Math.abs(s.throttle - 0.7) < 1e-6, `throttle ${s.throttle}`);
  for (let k = 0; k < 120; k++) stepFlight(s, { ...input, throttleSet: 0.2 }, 1 / 120, room);
  assert.ok(Math.abs(s.throttle - 0.2) < 1e-6, `throttle ${s.throttle}`);
  // No lever (null): the throttle stays where it is, W/S rule.
  for (let k = 0; k < 60; k++) stepFlight(s, { ...input, throttleSet: null }, 1 / 120, room);
  assert.ok(Math.abs(s.throttle - 0.2) < 1e-6);
});
