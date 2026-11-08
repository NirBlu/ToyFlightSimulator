import test from "node:test";
import assert from "node:assert/strict";
import { Controls } from "../src/controls.js";
function virtual() {
  const c = Object.create(Controls.prototype);
  c.stick = { x: 0.6, y: 0.8 };
  c.lastMove = 1000;
  c.keys = new Set();
  return c;
}
test("virtual stick springs to center 110ms after a push", () => {
  const c = virtual();
  for (let i = 0; i < 30; i++) c.update(1 / 60, 1200 + (i * 1000) / 60);
  assert.ok(Math.hypot(c.stick.x, c.stick.y) < 0.001);
  const input = c.update(1 / 60, 1800);
  assert.equal(input.pitch, 0);
  assert.equal(input.yaw, 0);
});
test("light centering while pushing preserves meaningful pitch/yaw", () => {
  const c = virtual();
  const input = c.update(1 / 60, 1050);
  assert.ok(input.pitch > 0.7);
  assert.ok(input.yaw > 0.5);
});
test("W/S and A/D map exactly to throttle/brake and roll", () => {
  const c = virtual();
  c.keys = new Set(["KeyW", "KeyA"]);
  let input = c.update(0, 1000);
  assert.equal(input.throttleUp, true);
  assert.equal(input.brake, false);
  assert.equal(input.roll, 1);
  c.keys = new Set(["KeyS", "KeyD"]);
  input = c.update(0, 1000);
  assert.equal(input.throttleUp, false);
  assert.equal(input.brake, true);
  assert.equal(input.roll, -1);
});
