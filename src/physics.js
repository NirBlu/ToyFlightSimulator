import * as THREE from "../vendor/three.module.js";
import { interactBalls } from "./balls.js?v=7";

export const GRAVITY = 2.3; // deliberately toy-like: easier than full earth gravity at this scale
export const GEAR_CLEARANCE = 0.068;
/** Impacts (m/s straight into a surface) at or above this destroy the plane outright. */
export const CRASH_IMPACT = 1.9;
/** Gentle-landing limits. Anything outside them is still survivable, it just costs damage. */
export const LANDING_LIMITS = {
  sink: 0.62,
  speed: 1.35,
  flapSpeed: 1.55,
  roll: 0.36,
  pitchMin: -0.22,
  pitchMax: 0.44,
};
/** Smallest top (meters) that counts as somewhere you can land. */
export const MIN_LANDABLE = 0.1;
const UP = new THREE.Vector3(0, 1, 0),
  FORWARD = new THREE.Vector3(0, 0, -1);
const clamp = THREE.MathUtils.clamp;
const PROBES = [
  [0, 0, 0, "body"],
  [0, 0, -0.145, "nose"],
  [-0.17, 0, -0.015, "wingtip"],
  [0.17, 0, -0.015, "wingtip"],
  [0, 0.02, 0.13, "tail"],
];

export function createFlightState(spawn, pad, yaw = 0) {
  return {
    position: spawn.clone(),
    velocity: new THREE.Vector3(),
    quaternion: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, yaw, 0, "YXZ"),
    ),
    pitch: 0,
    yaw,
    roll: 0,
    throttle: 0,
    gearDown: true,
    gearExtension: 1,
    flapsDown: false,
    grounded: pad,
    crashed: false,
    stall: false,
    hasFlown: false,
    landings: 0,
    padLandings: 0,
    damage: 0,
    hits: 0,
    lastHit: -1,
    airTime: 0,
    elapsed: 0,
  };
}
export function padContains(pad, p, margin = 0) {
  return (
    Math.abs(p.x - pad.x) <= pad.w / 2 - margin &&
    Math.abs(p.z - pad.z) <= pad.d / 2 - margin
  );
}
/** Strict "textbook" landing check, kept for hints and backwards compatibility. */
export function assessLanding(s) {
  const speed = Math.hypot(s.velocity.x, s.velocity.z),
    sink = Math.max(0, -s.velocity.y);
  if (Math.abs(s.roll) > 0.36 || s.pitch < -0.22 || s.pitch > 0.44)
    return "Keep your wings level and your nose gently up at touchdown.";
  if (!s.gearDown || s.gearExtension < 0.85) {
    if (speed < 0.45 && sink < 0.12) return "scrape";
    return "Wheels first! Press G to lower your landing gear.";
  }
  if (sink > 0.62)
    return "A little too bumpy. Pull back gently to soften your landing.";
  if (speed > (s.flapsDown ? 1.55 : 1.35))
    return "Too fast for touchdown! Press F for flaps, then ease off with S.";
  return "success";
}

/**
 * Grades any touchdown on any flat surface.
 * kind: "landing" (clean), "rough" (wheels down, survivable, costs damage),
 * "belly" (gear up slide, costs damage) or "crash" (violent impact).
 */
export function assessTouchdown(s) {
  const L = LANDING_LIMITS;
  const speed = Math.hypot(s.velocity.x, s.velocity.z),
    sink = Math.max(0, -s.velocity.y);
  const gear = s.gearDown && s.gearExtension >= 0.85;
  const limit = s.flapsDown ? L.flapSpeed : L.speed;
  const roll = Math.abs(s.roll);
  const attitude =
    Math.max(0, roll - L.roll) +
    Math.max(0, L.pitchMin - s.pitch) +
    Math.max(0, s.pitch - L.pitchMax);
  if (
    sink >= CRASH_IMPACT ||
    (s.pitch < -0.4 && sink > 0.95) ||
    (roll > 0.95 && sink > 0.95)
  )
    return {
      kind: "crash",
      damage: 100,
      sink,
      speed,
      tip: "That was a nosedive into the ground! Level off and descend gently.",
    };
  let damage = 0;
  const tips = [];
  if (!gear) {
    damage += 6 + 22 * sink + 8 * speed;
    tips.push("Wheels first! Press G to lower your landing gear.");
  }
  if (sink > L.sink) {
    damage += 4 + 45 * (sink - L.sink);
    tips.push("A bit bumpy. Pull back gently to soften the touchdown.");
  }
  if (speed > limit) {
    damage += 3 + 25 * (speed - limit);
    tips.push("Quite fast! Press F for flaps and ease off with S.");
  }
  if (attitude > 0) {
    damage += 5 + 30 * attitude;
    tips.push("Keep your wings level and your nose gently up.");
  }
  damage = Math.round(damage);
  return {
    kind: !gear ? "belly" : damage > 0 ? "rough" : "landing",
    damage,
    sink,
    speed,
    tip: tips[0] || "",
  };
}
/** Damage (percent) for hitting something at `impact` m/s straight on. */
export function impactDamage(impact) {
  if (impact < 0.15) return 0;
  return Math.round(2 + 22 * impact * impact);
}

const surfaceCache = new WeakMap();
/** Every landable top in the level: pads first (they win ties), then collider tops. */
export function getSurfaces(room) {
  const pads = room.pads || [],
    colliders = room.colliders || [];
  const cached = surfaceCache.get(room);
  if (
    cached &&
    cached.pads === pads.length &&
    cached.colliders === colliders.length
  )
    return cached.list;
  const list = pads.map((p) => p);
  for (const c of colliders) {
    const w = c.max.x - c.min.x,
      d = c.max.z - c.min.z;
    if (c.landable === false) continue;
    if (Math.min(w, d) < MIN_LANDABLE) continue;
    list.push({
      id: c.id || c.name,
      name: c.surfaceName || c.name.toLowerCase(),
      x: (c.min.x + c.max.x) / 2,
      z: (c.min.z + c.max.z) / 2,
      y: c.max.y,
      w,
      d,
      collider: c,
    });
  }
  surfaceCache.set(room, {
    pads: pads.length,
    colliders: colliders.length,
    list,
  });
  return list;
}
function groundSurface(room, p) {
  const y = room.ground?.y ?? 0;
  const zone = (room.groundZones || []).find((z) => padContains(z, p));
  return {
    id: "ground",
    name: zone?.name || room.ground?.name || "floor",
    x: p.x,
    z: p.z,
    y,
    w: Infinity,
    d: Infinity,
    ground: true,
  };
}
/** Highest landable surface under p whose top is at or below `maxTop`. */
export function findSupport(room, p, maxTop, margin = 0) {
  let best = null;
  for (const s of getSurfaces(room)) {
    if (s.y > maxTop + 1e-6 || !padContains(s, p, margin)) continue;
    if (!best || s.y > best.y + 1e-6) best = s;
  }
  const ground = groundSurface(room, p);
  if (!best || ground.y > best.y) best = ground;
  return best;
}

function damage(s, amount, events, info) {
  if (amount <= 0) return;
  s.damage = Math.min(100, s.damage + amount);
  s.hits++;
  s.lastHit = s.elapsed;
  events.hit?.({ ...info, damage: amount, total: s.damage });
}
function reflectYaw(s, n) {
  const fx = -Math.sin(s.yaw),
    fz = -Math.cos(s.yaw);
  const dot = fx * n.x + fz * n.z;
  if (dot >= 0) return;
  const rx = fx - 2 * dot * n.x,
    rz = fz - 2 * dot * n.z;
  s.yaw = Math.atan2(-rx, -rz);
}
/** Push the plane out along n, bounce, and turn an impact into damage (or a crash). */
function collide(s, n, depth, name, events, crash, kind = "obstacle") {
  s.position.addScaledVector(n, depth + 0.0005);
  const vn = s.velocity.dot(n);
  if (vn >= 0) return false;
  const impact = -vn;
  if (impact >= CRASH_IMPACT) {
    crash(
      `Ka-boom! You hit the ${name} at full speed. Slow down near obstacles and steer around them.`,
    );
    return true;
  }
  const vertical = Math.abs(n.y) > 0.5;
  const restitution = vertical ? 0.15 : 0.35;
  s.velocity.addScaledVector(n, -vn * (1 + restitution));
  // A little friction along the surface.
  const tangential = s.velocity.clone().addScaledVector(n, -s.velocity.dot(n));
  s.velocity.addScaledVector(tangential, -0.12);
  if (!vertical && !s.grounded && impact > 0.25) reflectYaw(s, n);
  if (n.y > 0.5) s.roll *= 0.5;
  damage(s, impactDamage(impact), events, { name, impact, kind });
  return false;
}

export function stepFlight(s, input, dt, room, events = {}) {
  if (s.crashed) return;
  const crash = (reason) => {
    s.crashed = true;
    s.throttle = 0;
    events.crash?.(reason);
  };
  s.elapsed += dt;
  if (input.throttleUp) s.throttle = clamp(s.throttle + 0.48 * dt, 0, 1);
  if (input.brake) s.throttle = clamp(s.throttle - 0.7 * dt, 0, 1);
  s.gearExtension = THREE.MathUtils.damp(
    s.gearExtension,
    s.gearDown ? 1 : 0,
    9,
    dt,
  );
  const grounded = !!s.grounded;
  s.pitch = clamp(
    s.pitch + (input.pitch * 1.8 - s.pitch * (grounded ? 1.2 : 0.55)) * dt,
    grounded ? -0.06 : -0.67,
    grounded ? (s.groundPitchMax ?? 0.67) : 0.67,
  );
  s.roll = clamp(
    s.roll + (input.roll * 1.85 - s.roll * (input.roll ? 0.15 : 1.35)) * dt,
    -1.1,
    1.1,
  );
  if (grounded) s.roll = THREE.MathUtils.damp(s.roll, 0, 10, dt);
  s.yaw +=
    (-input.yaw * (grounded ? 0.8 : 1.65) +
      s.roll * 0.95 +
      (grounded ? input.roll * 0.48 : 0)) *
    dt;
  s.quaternion.setFromEuler(new THREE.Euler(s.pitch, s.yaw, s.roll, "YXZ"));
  const forward = FORWARD.clone().applyQuaternion(s.quaternion),
    up = UP.clone().applyQuaternion(s.quaternion);
  const previous = s.position.clone(),
    clearance = 0.033 + (s.gearDrop ?? 0.035) * s.gearExtension;
  const speed = s.velocity.length();
  const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();
  if (grounded) {
    const pad = s.grounded;
    const signed = s.velocity.dot(flatForward);
    const acceleration =
      s.throttle * 2.5 -
      (0.13 + 0.23 * speed + 0.35 * speed * speed) * (speed > 0.015 ? 1 : 0) -
      (input.brake ? 3.6 : 0);
    const v = Math.max(0, signed + acceleration * dt);
    s.velocity.copy(flatForward).multiplyScalar(v);
    s.position.addScaledVector(s.velocity, dt);
    s.position.y = pad.y + clearance;
    s.velocity.y = 0;
    s.stall = false;
    if (v > (s.flapsDown ? 0.72 : 0.85) && s.pitch > 0.065) {
      s.grounded = null;
      s.velocity.y = 0.24 + s.pitch * 0.6;
      s.hasFlown = true;
      events.takeoff?.();
    } else if (!pad.ground && !padContains(pad, s.position, -0.012)) {
      // Rolling onto a neighbouring top at the same height keeps us grounded.
      const next = findSupport(room, s.position, pad.y + 0.01);
      if (next && Math.abs(next.y - pad.y) < 0.012 && next !== pad) {
        s.grounded = next;
      } else {
        s.grounded = null;
        s.hasFlown = true;
      }
    }
  } else {
    s.airTime += dt;
    const flightAngle = Math.atan2(
      s.velocity.y,
      Math.max(0.15, Math.hypot(s.velocity.x, s.velocity.z)),
    );
    const aoa = clamp(s.pitch - flightAngle, -0.5, 0.65);
    const stallSpeed = s.flapsDown ? 0.62 : 0.76;
    s.stall = speed < stallSpeed;
    const cl = clamp(0.6 + aoa * 3.5, 0.05, 1.7) * (s.flapsDown ? 1.4 : 1);
    let lift = Math.min(GRAVITY * 1.9, GRAVITY * speed * speed * cl);
    if (s.stall) {
      lift *= 0.55;
      s.pitch = Math.max(-0.5, s.pitch - 0.28 * dt);
    }
    const direction =
      speed > 0.01 ? s.velocity.clone().divideScalar(speed) : flatForward;
    const liftDirection = up
      .clone()
      .addScaledVector(direction, -up.dot(direction))
      .normalize();
    const induced = 0.08 * cl * cl * speed * speed;
    const drag =
      0.14 * speed +
      (0.35 + (s.flapsDown ? 0.31 : 0) + 0.1 * s.gearExtension) *
        speed *
        speed +
      induced;
    const acceleration = forward
      .multiplyScalar(s.throttle * 2.5)
      .addScaledVector(liftDirection, lift)
      .addScaledVector(direction, -drag);
    acceleration.y -= GRAVITY;
    s.velocity.addScaledVector(acceleration, dt);
    // Arcade sideslip correction makes a toy-sized room navigable without rudder pedals.
    const horizontal = Math.hypot(s.velocity.x, s.velocity.z);
    const align = 1 - Math.exp(-1.5 * dt);
    s.velocity.x = THREE.MathUtils.lerp(
      s.velocity.x,
      flatForward.x * horizontal,
      align,
    );
    s.velocity.z = THREE.MathUtils.lerp(
      s.velocity.z,
      flatForward.z * horizontal,
      align,
    );
    s.position.addScaledVector(s.velocity, dt);
    // Touchdown: any landable top (pads, furniture, car roofs) or the ground itself.
    if (s.velocity.y <= 0) {
      let contact = null;
      for (const surface of getSurfaces(room)) {
        const margin = surface.collider ? 0 : 0.012;
        if (
          padContains(surface, s.position, margin) &&
          previous.y - clearance >= surface.y - 0.012 &&
          s.position.y - clearance <= surface.y &&
          (!contact || surface.y > contact.y + 1e-6)
        )
          contact = surface;
      }
      const ground = groundSurface(room, s.position);
      if (!contact && s.position.y - clearance <= ground.y) contact = ground;
      if (contact) {
        const verdict = assessTouchdown(s);
        if (verdict.kind === "crash") {
          s.position.y = contact.y + clearance;
          crash(verdict.tip);
          return;
        }
        s.position.y = contact.y + clearance;
        s.velocity.y = 0;
        s.grounded = contact;
        s.pitch = 0;
        s.roll = 0;
        if (verdict.damage > 0)
          damage(s, verdict.damage, events, {
            name: contact.name,
            impact: verdict.sink,
            kind: verdict.kind,
            quiet: true,
          });
        if (verdict.kind === "belly") {
          s.throttle = 0;
          s.velocity.multiplyScalar(0.3);
          events.scrape?.(contact, verdict);
        } else {
          s.landings++;
          if (!contact.collider && !contact.ground) s.padLandings++;
          events.landing?.(contact, verdict);
        }
        if (s.damage >= 100) {
          crash(
            "Too many bumps! Your little plane needs a rest. Gentle landings next time!",
          );
          return;
        }
      }
    }
  }
  const p = s.position;
  // Level bounds: hard rooms bump (with damage), soft outdoor edges turn you around.
  const b = room.bounds;
  if (b) {
    const walls = [
      [p.x < b.minX, new THREE.Vector3(1, 0, 0), b.minX - p.x],
      [p.x > b.maxX, new THREE.Vector3(-1, 0, 0), p.x - b.maxX],
      [p.z < b.minZ, new THREE.Vector3(0, 0, 1), b.minZ - p.z],
      [p.z > b.maxZ, new THREE.Vector3(0, 0, -1), p.z - b.maxZ],
      [p.y > b.maxY, new THREE.Vector3(0, -1, 0), p.y - b.maxY],
    ];
    for (const [out, n, depth] of walls) {
      if (!out) continue;
      if (b.soft) {
        p.addScaledVector(n, depth + 0.001);
        const vn = s.velocity.dot(n);
        if (vn < 0) s.velocity.addScaledVector(n, -2 * vn);
        if (n.y === 0) reflectYaw(s, n);
        else s.pitch = Math.min(s.pitch, -0.05);
        events.boundary?.(n.y === 0 ? "edge" : "ceiling");
      } else if (
        collide(
          s,
          n,
          depth,
          n.y < 0 ? b.ceilingName || "ceiling" : b.wallName || "wall",
          events,
          crash,
          "wall",
        )
      )
        return;
    }
  }
  // Probe the fuselage, nose, wingtips and tail against every solid box.
  for (const [ox, oy, oz, part] of PROBES) {
    const offset = new THREE.Vector3(ox, oy, oz).applyQuaternion(s.quaternion);
    const point = offset.clone().add(p);
    const before = offset.clone().add(previous);
    let hit = null;
    for (const c of room.colliders) {
      const eps = 0.008;
      if (
        point.x > c.min.x - eps &&
        point.x < c.max.x + eps &&
        point.z > c.min.z - eps &&
        point.z < c.max.z + eps &&
        point.y > c.min.y - eps &&
        point.y < c.max.y + eps
      ) {
        hit = { c, ...contactNormal(c, point, before, eps) };
        break;
      }
    }
    if (hit) {
      const name = hit.c.name.toLowerCase();
      if (collide(s, hit.n, hit.depth, name, events, crash, part)) return;
      break; // one contact per step keeps the response stable
    }
  }
  if (room.balls?.length) interactBalls(s, room.balls, events);
  if (s.damage >= 100) {
    crash(
      "Too many bumps! Your little plane needs a rest. Fly a bit gentler next time!",
    );
  }
}

/** Which face of box c did the probe come through, and how deep is it? */
export function contactNormal(c, point, before, eps = 0) {
  const axes = ["x", "y", "z"];
  let best = null;
  for (const a of axes) {
    const lo = c.min[a] - eps,
      hi = c.max[a] + eps;
    if (before[a] <= lo && point[a] > lo) {
      const t = (lo - before[a]) / (point[a] - before[a] || 1e-9);
      if (!best || t > best.t) best = { a, sign: -1, depth: point[a] - lo, t };
    } else if (before[a] >= hi && point[a] < hi) {
      const t = (before[a] - hi) / (before[a] - point[a] || 1e-9);
      if (!best || t > best.t) best = { a, sign: 1, depth: hi - point[a], t };
    }
  }
  if (!best) {
    for (const a of axes) {
      const lo = point[a] - (c.min[a] - eps),
        hi = c.max[a] + eps - point[a];
      if (!best || lo < best.depth) best = { a, sign: -1, depth: lo };
      if (hi < best.depth) best = { a, sign: 1, depth: hi };
    }
  }
  const n = new THREE.Vector3();
  n[best.a] = best.sign;
  return { n, depth: best.depth };
}
