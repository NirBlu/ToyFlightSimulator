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
test("mouse stick holds its position after the mouse stops (no spring back)", () => {
  const c = virtual();
  const first = c.update(1 / 60, 1016);
  for (let i = 0; i < 300; i++) c.update(1 / 60, 1200 + (i * 1000) / 60);
  const later = c.update(1 / 60, 9000);
  assert.equal(c.stick.x, 0.6);
  assert.equal(c.stick.y, 0.8);
  assert.ok(later.pitch > 0.7 && later.yaw > 0.5);
  assert.equal(later.pitch, first.pitch);
  assert.equal(later.yaw, first.yaw);
});
test("C / middle click re-centers the mouse stick", () => {
  const c = virtual();
  c.recenter();
  const input = c.update(1 / 60, 2000);
  assert.equal(input.pitch, 0);
  assert.equal(input.yaw, 0);
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
