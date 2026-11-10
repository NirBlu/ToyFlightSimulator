import * as THREE from "../vendor/three.module.js";

/** Bouncy toy balls: gravity, bounce, rolling friction, box and ball-ball collisions.
 * The plane can push them around but they never damage it. */
export const BALL_GRAVITY = 5.5;
const tmp = new THREE.Vector3(),
  axis = new THREE.Vector3(),
  spin = new THREE.Quaternion();

/** { radius, position, velocity, bounce, mass, mesh? , name } */
export function createBall({
  radius,
  position,
  velocity = new THREE.Vector3(),
  bounce = 0.6,
  mass,
  name = "ball",
  mesh = null,
}) {
  return {
    radius,
    position: position.clone(),
    velocity: velocity.clone(),
    bounce,
    mass: mass ?? Math.max(0.05, radius * 4),
    name,
    mesh,
    home: position.clone(),
    lastBump: -10,
  };
}

function collideBox(ball, c) {
  const p = ball.position,
    r = ball.radius;
  tmp.set(
    THREE.MathUtils.clamp(p.x, c.min.x, c.max.x),
    THREE.MathUtils.clamp(p.y, c.min.y, c.max.y),
    THREE.MathUtils.clamp(p.z, c.min.z, c.max.z),
  );
  const dx = p.x - tmp.x,
    dy = p.y - tmp.y,
    dz = p.z - tmp.z;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r) return false;
  let nx, ny, nz, depth;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
    nz = dz / d;
    depth = r - d;
  } else {
    // Center inside the box: pop out of the top.
    nx = 0;
    ny = 1;
    nz = 0;
    depth = c.max.y - p.y + r;
  }
  p.x += nx * depth;
  p.y += ny * depth;
  p.z += nz * depth;
  const vn = ball.velocity.x * nx + ball.velocity.y * ny + ball.velocity.z * nz;
  if (vn < 0) {
    const k = (1 + ball.bounce) * vn;
    ball.velocity.x -= k * nx;
    ball.velocity.y -= k * ny;
    ball.velocity.z -= k * nz;
  }
  return ny > 0.7;
}

/** Advance every ball. `room` supplies colliders, ground and bounds. */
export function stepBalls(room, dt) {
  const balls = room.balls;
  if (!balls?.length) return;
  const groundY = room.ground?.y ?? 0,
    b = room.bounds;
  for (const ball of balls) {
    const v = ball.velocity,
      p = ball.position,
      r = ball.radius;
    v.y -= BALL_GRAVITY * dt;
    p.addScaledVector(v, dt);
    let supported = false;
    if (p.y - r < groundY) {
      p.y = groundY + r;
      if (v.y < 0) v.y = Math.abs(v.y) < 0.25 ? 0 : -v.y * ball.bounce;
      supported = true;
    }
    for (const c of room.colliders) {
      if (
        p.x + r < c.min.x ||
        p.x - r > c.max.x ||
        p.z + r < c.min.z ||
        p.z - r > c.max.z ||
        p.y + r < c.min.y ||
        p.y - r > c.max.y
      )
        continue;
      if (collideBox(ball, c)) {
        supported = true;
        if (Math.abs(v.y) < 0.25) v.y = Math.max(0, v.y);
      }
    }
    if (b) {
      const e = ball.bounce;
      if (p.x - r < b.minX) {
        p.x = b.minX + r;
        v.x = Math.abs(v.x) * e;
      }
      if (p.x + r > b.maxX) {
        p.x = b.maxX - r;
        v.x = -Math.abs(v.x) * e;
      }
      if (p.z - r < b.minZ) {
        p.z = b.minZ + r;
        v.z = Math.abs(v.z) * e;
      }
      if (p.z + r > b.maxZ) {
        p.z = b.maxZ - r;
        v.z = -Math.abs(v.z) * e;
      }
      if (p.y + r > b.maxY) {
        p.y = b.maxY - r;
        v.y = -Math.abs(v.y) * e;
      }
    }
    if (supported) {
      // Rolling resistance; tiny drift is put to sleep so balls settle.
      const f = Math.exp(-0.9 * dt);
      v.x *= f;
      v.z *= f;
      if (Math.hypot(v.x, v.z) < 0.01) {
        v.x = 0;
        v.z = 0;
      }
    } else {
      v.multiplyScalar(Math.exp(-0.05 * dt));
    }
  }
  // Ball-ball elastic collisions, weighted by mass.
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i],
        c = balls[j];
      tmp.subVectors(c.position, a.position);
      const dist = tmp.length(),
        min = a.radius + c.radius;
      if (dist >= min || dist < 1e-6) continue;
      tmp.divideScalar(dist);
      const total = a.mass + c.mass,
        overlap = min - dist;
      a.position.addScaledVector(tmp, (-overlap * c.mass) / total);
      c.position.addScaledVector(tmp, (overlap * a.mass) / total);
      const rel = c.velocity.clone().sub(a.velocity).dot(tmp);
      if (rel >= 0) continue;
      const e = Math.min(a.bounce, c.bounce),
        j2 = (-(1 + e) * rel) / total;
      a.velocity.addScaledVector(tmp, -j2 * c.mass);
      c.velocity.addScaledVector(tmp, j2 * a.mass);
    }
  for (const ball of balls) {
    if (!Number.isFinite(ball.position.x + ball.position.y + ball.position.z)) {
      ball.position.copy(ball.home);
      ball.velocity.set(0, 0, 0);
    }
  }
}

/** Plane vs balls: the ball gets the shove, the plane is only nudged. Never damages. */
export function interactBalls(s, balls, events = {}) {
  const PLANE_RADIUS = 0.09,
    PLANE_MASS = 0.35;
  for (const ball of balls) {
    tmp.subVectors(ball.position, s.position);
    const dist = tmp.length(),
      min = ball.radius + PLANE_RADIUS;
    if (dist >= min || dist < 1e-6) continue;
    tmp.divideScalar(dist);
    const rel = s.velocity.clone().sub(ball.velocity).dot(tmp);
    // Separate: the ball moves most of the way, the plane a little.
    ball.position.addScaledVector(tmp, (min - dist) * 0.8);
    s.position.addScaledVector(tmp, -(min - dist) * 0.2);
    if (rel <= 0) continue;
    const total = PLANE_MASS + ball.mass;
    const impulse = (1 + ball.bounce) * rel;
    ball.velocity.addScaledVector(tmp, (impulse * PLANE_MASS) / total + 0.15);
    ball.velocity.y += Math.min(0.6, rel * 0.25);
    // Gentle deflection only: keep at least 75% of the plane's speed.
    const planeShare = Math.min(0.25, (0.6 * ball.mass) / total);
    s.velocity.addScaledVector(tmp, -rel * planeShare);
    if (s.elapsed - ball.lastBump > 0.6) {
      ball.lastBump = s.elapsed;
      events.ball?.(ball, rel);
    }
  }
}

/** Copy simulated positions to meshes and roll them visually. */
export function syncBallMeshes(balls, dt) {
  for (const ball of balls || []) {
    const m = ball.mesh;
    if (!m) continue;
    const horizontal = Math.hypot(ball.velocity.x, ball.velocity.z);
    if (horizontal > 1e-4) {
      axis.set(ball.velocity.z, 0, -ball.velocity.x).normalize();
      spin.setFromAxisAngle(axis, (horizontal * dt) / ball.radius);
      m.quaternion.premultiply(spin);
    }
    m.position.copy(ball.position);
  }
}
