import * as THREE from "../vendor/three.module.js";
import { interactBalls } from "./balls.js?v=11";

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
/** Body rotation rates (rad/s) at full stick / full A-D. No angle limits in the air. */
export const RATES = { pitch: 1.8, roll: 2.6, yaw: 1.65 };
/** Anti-gravity (V): how close a wall / ceiling / side must be, and when it lets go. */
export const ANTI_GRAV_RANGE = 1.5;
export const ANTI_GRAV_RELEASE = 3.2;
/** While gravity swings to a new surface the fall speed toward it is capped (a soft "magnet"). */
export const ANTI_GRAV_SINK = 0.55;
const UP = new THREE.Vector3(0, 1, 0),
  FORWARD = new THREE.Vector3(0, 0, -1),
  RIGHT = new THREE.Vector3(1, 0, 0);
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
    // pitch / yaw / roll are read-outs of the quaternion in the current gravity
    // frame (HUD, landing grading). Writing them still works (tests, debug).
    pitch: 0,
    yaw,
    roll: 0,
    _e: { p: 0, y: yaw, r: 0 },
    heading: yaw,
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
    // Gravity frame. gravUp is always an axis (±X, ±Y, ±Z): surfaces are boxes.
    gravUp: new THREE.Vector3(0, 1, 0),
    gravKey: "+y",
    antiGrav: null, // { kind, name } while stuck to a wall / ceiling / side
    gravAssist: null, // soft magnet while gravity swings
    farTime: 0,
    altitude: spawn.y,
    pitchIdle: 0,
    rollIdle: 0,
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

/* ---------------------------------------------------------------------------
 * Orientation helpers. All of them work on s.quaternion in the CURRENT frame
 * (inside the core step that is the local gravity frame, where up is +Y).
 * ------------------------------------------------------------------------- */
const _a = new THREE.Vector3(),
  _b = new THREE.Vector3(),
  _c = new THREE.Vector3(),
  _dq = new THREE.Quaternion(),
  _dq2 = new THREE.Quaternion(),
  _id = new THREE.Quaternion(),
  _eul = new THREE.Euler(0, 0, 0, "YXZ");
/** Heading (radians, yaw about +Y) from a forward and up vector, valid even when vertical. */
export function headingOf(fwd, up) {
  // Nose up vertical: the belly points the way we were going; nose down: the back does.
  const x = fwd.x - fwd.y * up.x,
    z = fwd.z - fwd.y * up.z;
  if (x * x + z * z < 1e-10) return null;
  return Math.atan2(-x, -z);
}
function rotateWorldYaw(s, angle) {
  if (!angle) return;
  _dq.setFromAxisAngle(UP, angle);
  s.quaternion.premultiply(_dq);
}
/** Turn the nose toward local "down" by up to `angle`, keeping wings where they are. */
function noseDown(s, angle) {
  const f = _a.copy(FORWARD).applyQuaternion(s.quaternion);
  const axis = _b.set(f.z, 0, -f.x); // f x (0,-1,0)
  const len = axis.length();
  if (len < 0.05 || angle <= 0) return;
  _dq.setFromAxisAngle(axis.divideScalar(len), angle);
  s.quaternion.premultiply(_dq);
}
function pitchAngle(q) {
  const f = _a.copy(FORWARD).applyQuaternion(q);
  return Math.asin(clamp(f.y, -1, 1));
}
function reflectYaw(s, n) {
  const f = _a.copy(FORWARD).applyQuaternion(s.quaternion);
  const u = _b.copy(UP).applyQuaternion(s.quaternion);
  const h = headingOf(f, u);
  if (h === null) return;
  const fx = -Math.sin(h),
    fz = -Math.cos(h);
  const dot = fx * n.x + fz * n.z;
  if (dot >= 0) return;
  const rx = fx - 2 * dot * n.x,
    rz = fz - 2 * dot * n.z;
  rotateWorldYaw(s, Math.atan2(-rx, -rz) - h);
}
/** Halve the bank (used after a bump on top of something). */
function softenRoll(s) {
  _eul.setFromQuaternion(s.quaternion, "YXZ");
  _eul.z *= 0.5;
  s.quaternion.setFromEuler(_eul);
}
function syncEuler(s) {
  s.quaternion.normalize();
  _eul.setFromQuaternion(s.quaternion, "YXZ");
  s.pitch = _eul.x;
  s.yaw = _eul.y;
  s.roll = _eul.z;
  s._e = { p: s.pitch, y: s.yaw, r: s.roll };
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
  if (n.y > 0.5) softenRoll(s);
  damage(s, impactDamage(impact), events, { name, impact, kind });
  return false;
}

/* ---------------------------------------------------------------------------
 * Gravity frames. Anti-gravity points "down" at a wall, the ceiling or the
 * side of a piece of furniture. Because every surface is an axis-aligned box,
 * each of the six directions is a signed axis permutation: the whole level
 * can be rotated so the chosen surface faces +Y, and the normal flight model
 * (lift, landings, land-anywhere, damage) runs unchanged in that frame.
 * ------------------------------------------------------------------------- */
const deg90 = Math.PI / 2;
const makeFrame = (key, up, q) => ({
  key,
  up: new THREE.Vector3(...up),
  q, // world -> local
  qi: q.clone().invert(), // local -> world
});
export const FRAMES = {
  "+y": makeFrame("+y", [0, 1, 0], new THREE.Quaternion()),
  "-y": makeFrame(
    "-y",
    [0, -1, 0],
    new THREE.Quaternion().setFromAxisAngle(RIGHT, Math.PI),
  ),
  "+x": makeFrame(
    "+x",
    [1, 0, 0],
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg90),
  ),
  "-x": makeFrame(
    "-x",
    [-1, 0, 0],
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -deg90),
  ),
  "+z": makeFrame(
    "+z",
    [0, 0, 1],
    new THREE.Quaternion().setFromAxisAngle(RIGHT, -deg90),
  ),
  "-z": makeFrame(
    "-z",
    [0, 0, -1],
    new THREE.Quaternion().setFromAxisAngle(RIGHT, deg90),
  ),
};
/** "+x", "-y"... for an axis-aligned unit vector (largest component wins). */
export function axisKey(v) {
  const ax = Math.abs(v.x),
    ay = Math.abs(v.y),
    az = Math.abs(v.z);
  if (ay >= ax && ay >= az) return v.y >= 0 ? "+y" : "-y";
  if (ax >= az) return v.x >= 0 ? "+x" : "-x";
  return v.z >= 0 ? "+z" : "-z";
}
const round6 = (v) => {
  v.x = Math.round(v.x * 1e6) / 1e6 + 0;
  v.y = Math.round(v.y * 1e6) / 1e6 + 0;
  v.z = Math.round(v.z * 1e6) / 1e6 + 0;
  return v;
};
/** Name of the side of a box (or room) that faces direction n. */
function faceKind(n, room = false) {
  if (n.y > 0.5) return room ? "floor" : "top";
  if (n.y < -0.5) return room ? "ceiling" : "underside";
  return room ? "wall" : "side";
}
const WALL_LABEL = {
  "+x": "west wall",
  "-x": "east wall",
  "+z": "north wall",
  "-z": "south wall",
};
const planeCache = new WeakMap();
/**
 * The level's boundary as inward-facing planes: point p is inside when
 * p·n >= d. The floor is always solid; walls / ceiling only indoors.
 */
export function boundPlanes(room) {
  const cached = planeCache.get(room);
  if (cached && cached.bounds === room.bounds && cached.ground === room.ground)
    return cached.list;
  const b = room.bounds,
    gy = room.ground?.y ?? 0,
    gname = room.ground?.name || "floor";
  const list = [
    {
      n: new THREE.Vector3(0, 1, 0),
      d: gy,
      soft: false,
      name: gname,
      label: gname,
      kind: "floor",
    },
  ];
  if (b) {
    const soft = !!b.soft,
      wall = b.wallName || "wall";
    const add = (n, d, name, label, kind) =>
      list.push({ n: new THREE.Vector3(...n), d, soft, name, label, kind });
    add([1, 0, 0], b.minX, wall, WALL_LABEL["+x"], "wall");
    add([-1, 0, 0], -b.maxX, wall, WALL_LABEL["-x"], "wall");
    add([0, 0, 1], b.minZ, wall, WALL_LABEL["+z"], "wall");
    add([0, 0, -1], -b.maxZ, wall, WALL_LABEL["-z"], "wall");
    if (b.maxY !== undefined)
      add(
        [0, -1, 0],
        -b.maxY,
        b.ceilingName || "ceiling",
        b.ceilingName || "ceiling",
        "ceiling",
      );
  }
  planeCache.set(room, { bounds: room.bounds, ground: room.ground, list });
  return list;
}
function colliderLabel(c, n) {
  const base = (c.surfaceName || c.name)
    .toLowerCase()
    .replace(/^top of (the )?/, "");
  const kind = faceKind(n);
  if (kind === "top") return base;
  return `${kind} of the ${base.replace(/^the /, "")}`;
}
const frameCache = new WeakMap();
/** The level seen from gravity frame `key` (local up = +Y). "+y" is the level itself. */
export function frameRoom(room, key) {
  if (key === "+y") return room;
  let byKey = frameCache.get(room);
  if (!byKey) frameCache.set(room, (byKey = new Map()));
  const colliders = room.colliders || [];
  const hit = byKey.get(key);
  if (hit && hit.n === colliders.length && hit.bounds === room.bounds)
    return hit.room;
  const F = FRAMES[key];
  const lc = colliders.map((c) => {
    const a = c.min.clone().applyQuaternion(F.q),
      b = c.max.clone().applyQuaternion(F.q);
    const out = {
      min: a.clone().min(b),
      max: a.clone().max(b),
      name: c.name,
      id: `${c.id || c.name}@${key}`,
      surfaceName: colliderLabel(c, F.up),
      source: c,
    };
    if (c.landable === false) out.landable = false;
    return out;
  });
  const planes = boundPlanes(room).map((p) => ({
    ...p,
    n: round6(p.n.clone().applyQuaternion(F.q)),
  }));
  const groundPlane = planes.find((p) => !p.soft && p.n.y > 0.5);
  const local = {
    frameKey: key,
    base: room,
    pads: [],
    groundZones: [],
    colliders: lc,
    ground: groundPlane
      ? { y: groundPlane.d, name: groundPlane.label }
      : { y: -Infinity, name: "nothing" },
    planes: planes.filter((p) => p !== groundPlane),
  };
  byKey.set(key, { n: colliders.length, bounds: room.bounds, room: local });
  return local;
}
function localPlanes(room) {
  if (room.planes) return room.planes;
  return boundPlanes(room).filter((p) => !(p.n.y > 0.5 && !p.soft));
}

/**
 * Nearest wall / ceiling / box side to p within `range`, ignoring faces that
 * point along `excludeUp` (the current "down" surfaces). Returns
 * { n, dist, kind, name } in world space or null.
 */
export function findNearestSurface(
  room,
  p,
  range = ANTI_GRAV_RANGE,
  excludeUp = UP,
) {
  let best = null;
  const consider = (n, dist, kind, name) => {
    if (dist < -0.06 || dist > range) return;
    if (n.dot(excludeUp) > 0.5) return;
    if (!best || dist < best.dist)
      best = { n: n.clone(), dist: Math.max(0, dist), kind, name };
  };
  for (const pl of boundPlanes(room)) {
    if (pl.soft) continue;
    consider(pl.n, p.dot(pl.n) - pl.d, pl.kind, pl.label);
  }
  const axes = ["x", "y", "z"],
    m = 0.05;
  const n = new THREE.Vector3();
  for (const c of room.colliders || []) {
    if (c.landable === false) continue;
    for (const a of axes) {
      const [b1, b2] = axes.filter((x) => x !== a);
      if (
        p[b1] < c.min[b1] - m ||
        p[b1] > c.max[b1] + m ||
        p[b2] < c.min[b2] - m ||
        p[b2] > c.max[b2] + m
      )
        continue;
      if (
        c.max[b1] - c.min[b1] < MIN_LANDABLE ||
        c.max[b2] - c.min[b2] < MIN_LANDABLE
      )
        continue;
      for (const sign of [1, -1]) {
        const face = sign > 0 ? c.max[a] : c.min[a];
        const dist = (p[a] - face) * sign;
        if (dist < -0.06 || dist > range) continue;
        n.set(0, 0, 0);
        n[a] = sign;
        consider(n, dist, faceKind(n), colliderLabel(c, n));
      }
    }
  }
  return best;
}

/** Swing gravity toward `up` (axis vector). info = { kind, name } or null for normal. */
export function setGravity(s, up, info = null) {
  const key = axisKey(up);
  const wasGrounded = !!s.grounded;
  s.gravUp = FRAMES[key].up.clone();
  s.gravKey = key;
  s.antiGrav = key === "+y" ? null : info;
  if (wasGrounded) {
    s.grounded = null;
    s.hasFlown = true;
  }
  // Moving into the new surface? The magnet takes that over (no slam into it).
  const vn = s.velocity.dot(s.gravUp);
  if (vn < 0) s.velocity.addScaledVector(s.gravUp, -vn);
  s.gravAssist = { t: 0, lift: s.antiGrav ? 0.35 : 1 };
  s.farTime = 0;
  s.stall = false;
  s._e = null; // re-derive pitch / yaw / roll in the new frame
  return s;
}
/** The V key. Returns { ok, off?, hit?, message }. */
export function toggleAntiGrav(s, room) {
  if (s.crashed) return { ok: false, message: "" };
  if (s.antiGrav) {
    setGravity(s, UP, null);
    return { ok: true, off: true, message: "Normal gravity" };
  }
  const hit = findNearestSurface(room, s.position, ANTI_GRAV_RANGE, s.gravUp);
  if (!hit) return { ok: false, message: "No surface close enough" };
  setGravity(s, hit.n, { kind: hit.kind, name: hit.name });
  return { ok: true, hit, message: `Anti-grav: ${hit.name}` };
}

const _qLocal = new THREE.Quaternion();
function toFrame(s, q) {
  s.position.applyQuaternion(q);
  s.velocity.applyQuaternion(q);
  s.quaternion.premultiply(q);
}

export function stepFlight(s, input, dt, room, events = {}) {
  if (s.crashed) return;
  if (!s.gravUp) {
    s.gravUp = new THREE.Vector3(0, 1, 0);
    s.gravKey = "+y";
  }
  const key = s.gravKey || "+y";
  const F = FRAMES[key];
  if (key === "+y") {
    core(s, input, dt, room, events);
  } else {
    // Run the normal flight model with the level rotated so "down" is the chosen surface.
    const queued = [];
    const deferred = new Proxy(events, {
      get: (target, k) =>
        typeof target[k] === "function"
          ? (...args) => queued.push([k, args])
          : target[k],
    });
    toFrame(s, F.q);
    core(s, input, dt, frameRoom(room, key), deferred);
    toFrame(s, F.qi);
    for (const [k, args] of queued) events[k](...args);
  }
  if (s.crashed) return;
  if (room.balls?.length) interactBalls(s, room.balls, events);
  if (s.damage >= 100 && !s.crashed) {
    s.crashed = true;
    s.throttle = 0;
    events.crash?.(
      "Too many bumps! Your little plane needs a rest. Fly a bit gentler next time!",
    );
    return;
  }
  // Wandered far from the anti-grav surface: let go, back to normal gravity.
  if (s.antiGrav && s.farTime > 0.4) {
    const name = s.antiGrav.name;
    setGravity(s, UP, null);
    events.gravity?.({ auto: true, off: true, name });
  }
  const f = _a.copy(FORWARD).applyQuaternion(s.quaternion);
  const u = _b.copy(UP).applyQuaternion(s.quaternion);
  const h = headingOf(f, u);
  if (h !== null) s.heading = h;
  if (!s.antiGrav) s.altitude = s.position.y - (room.ground?.y ?? 0);
}

/** One fixed step of the flight model in the local gravity frame (+Y is up). */
function core(s, input, dt, room, events) {
  const crash = (reason) => {
    s.crashed = true;
    s.throttle = 0;
    events.crash?.(reason);
  };
  s.elapsed += dt;
  // Someone (a test, the debug hook) wrote pitch / yaw / roll: honor it.
  const e = s._e;
  if (e && (e.p !== s.pitch || e.y !== s.yaw || e.r !== s.roll))
    s.quaternion.setFromEuler(new THREE.Euler(s.pitch, s.yaw, s.roll, "YXZ"));
  else if (!e) syncEuler(s);
  if (input.throttleUp) s.throttle = clamp(s.throttle + 0.48 * dt, 0, 1);
  if (input.brake) s.throttle = clamp(s.throttle - 0.7 * dt, 0, 1);
  else if (input.throttleSet != null && !input.throttleUp) {
    // Throttle lever: glide to the lever's position (fast, but no instant jump).
    const target = clamp(input.throttleSet, 0, 1);
    s.throttle += clamp(target - s.throttle, -1.6 * dt, 1.6 * dt);
  }
  s.gearExtension = THREE.MathUtils.damp(
    s.gearExtension,
    s.gearDown ? 1 : 0,
    9,
    dt,
  );
  const ip = input.pitch || 0,
    ir = input.roll || 0,
    iy = input.yaw || 0;
  s.pitchIdle = Math.abs(ip) > 0.03 ? 0 : (s.pitchIdle || 0) + dt;
  s.rollIdle = Math.abs(ir) > 0.03 ? 0 : (s.rollIdle || 0) + dt;
  const grounded = !!s.grounded;
  const previous = s.position.clone(),
    clearance = 0.033 + (s.gearDrop ?? 0.035) * s.gearExtension;
  if (grounded) {
    // Taxiing: a simple heading + nose-wheel pitch model, wings level.
    const pad = s.grounded;
    s.pitch = clamp(
      s.pitch + (ip * RATES.pitch - s.pitch * 1.2) * dt,
      -0.06,
      s.groundPitchMax ?? 0.67,
    );
    s.roll = THREE.MathUtils.damp(s.roll, 0, 10, dt);
    s.yaw += (-iy * 0.8 + s.roll * 0.95 + ir * 0.48) * dt;
    s.quaternion.setFromEuler(new THREE.Euler(s.pitch, s.yaw, s.roll, "YXZ"));
    const flatForward = new THREE.Vector3(
      -Math.sin(s.yaw),
      0,
      -Math.cos(s.yaw),
    );
    const speed = s.velocity.length();
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
    s.farTime = 0;
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
    const q = s.quaternion;
    const fwd = new THREE.Vector3().copy(FORWARD).applyQuaternion(q),
      up = new THREE.Vector3().copy(UP).applyQuaternion(q),
      right = new THREE.Vector3().copy(RIGHT).applyQuaternion(q);
    // Body rates: pitch about local X, yaw about local Y, roll about local Z.
    // No angle limits, so full loops and rolls just keep going.
    let wx = ip * RATES.pitch,
      wy = -iy * RATES.yaw,
      wz = ir * RATES.roll;
    // Gentle auto-level, only on an axis the pilot has let go of, and never
    // while they are pulling through a loop (pitching while not upright).
    const rollK = THREE.MathUtils.smoothstep(s.rollIdle, 0.25, 0.7);
    if (rollK > 0 && !(Math.abs(ip) > 0.15 && up.y < 0.5)) {
      if (up.y >= 0) wz += -1.35 * right.y * rollK;
      else wz += -(right.y >= 0 ? 1 : -1) * 0.9 * rollK; // inverted: roll back upright
    }
    const pitchK = THREE.MathUtils.smoothstep(s.pitchIdle, 0.6, 1.2);
    if (pitchK > 0 && up.y > 0.3) wx += -0.6 * fwd.y * pitchK * up.y;
    const w = new THREE.Vector3(wx, wy, wz);
    const angle = w.length() * dt;
    if (angle > 1e-9) {
      _dq.setFromAxisAngle(w.normalize(), angle);
      q.multiply(_dq);
    }
    // Banking turns the plane (arcade coordinated turn, smooth through any attitude).
    rotateWorldYaw(s, 1.05 * right.y * dt);
    let speed = s.velocity.length();
    // Anti-grav swing: belly turns toward the new "down", velocity turns with it.
    const assist = s.gravAssist;
    if (assist) {
      assist.t += dt;
      const u2 = _c.copy(UP).applyQuaternion(q);
      // The swing is a one-time "turn your belly to the new floor". It stops for
      // good once it gets there (or after 2 s), and it always gives way to the
      // pilot: with the stick held it barely pulls, so pitch and roll keep
      // working (before, it pinned the nose at ~17° for 2 s after every V press
      // or automatic release: "pull up gets stuck").
      if (!assist.aligned && assist.t < 2) {
        if (u2.y > 0.995) assist.aligned = true;
        else {
          const hands = clamp(Math.max(Math.abs(ip), Math.abs(ir)) * 1.6, 0, 1);
          const k = (1 - Math.exp(-6 * dt)) * (1 - 0.9 * hands);
          _dq2.setFromUnitVectors(u2, UP);
          _dq.slerpQuaternions(_id, _dq2, k);
          q.premultiply(_dq);
        }
      }
    }
    q.normalize();
    fwd.copy(FORWARD).applyQuaternion(q);
    up.copy(UP).applyQuaternion(q);
    const along = s.velocity.dot(fwd);
    const aoa = clamp(
      Math.atan2(-s.velocity.dot(up), Math.max(0.15, along)),
      -0.5,
      0.65,
    );
    const stallSpeed = s.flapsDown ? 0.62 : 0.76;
    s.stall = speed < stallSpeed;
    // Toy wing: the built-in lift follows the side of the plane facing the sky,
    // so it also holds you up upside down (and fades to nothing on a knife edge).
    const camber = clamp(up.y * 1.5, -1, 1);
    const cl =
      clamp(0.6 * camber + aoa * 3.5, -1, 1.7) * (s.flapsDown ? 1.4 : 1);
    let lift =
      Math.sign(cl) *
      Math.min(GRAVITY * 1.9, GRAVITY * speed * speed * Math.abs(cl));
    if (s.stall) {
      lift *= 0.55;
      if (pitchAngle(q) > -0.5 && !assist) noseDown(s, 0.28 * dt);
    }
    if (assist) lift *= assist.lift;
    const direction =
      speed > 0.01 ? s.velocity.clone().divideScalar(speed) : fwd.clone();
    const liftDirection = up
      .clone()
      .addScaledVector(direction, -up.dot(direction));
    if (liftDirection.lengthSq() > 1e-8) liftDirection.normalize();
    const induced = 0.08 * cl * cl * speed * speed;
    const drag =
      0.14 * speed +
      (0.35 + (s.flapsDown ? 0.31 : 0) + 0.1 * s.gearExtension) *
        speed *
        speed +
      induced;
    const acceleration = fwd
      .clone()
      .multiplyScalar(s.throttle * 2.5 * (assist && assist.lift < 1 ? 0.3 : 1))
      .addScaledVector(liftDirection, lift)
      .addScaledVector(direction, -drag);
    acceleration.y -= GRAVITY;
    s.velocity.addScaledVector(acceleration, dt);
    // Arcade sideslip correction makes a toy-sized room navigable without rudder
    // pedals. Fades out as the nose points straight up or down.
    const fh = Math.hypot(fwd.x, fwd.z);
    const wAlign = THREE.MathUtils.smoothstep(fh, 0.15, 0.5);
    if (wAlign > 0) {
      const horizontal = Math.hypot(s.velocity.x, s.velocity.z);
      const align = (1 - Math.exp(-1.5 * dt)) * wAlign;
      s.velocity.x = THREE.MathUtils.lerp(
        s.velocity.x,
        (fwd.x / fh) * horizontal,
        align,
      );
      s.velocity.z = THREE.MathUtils.lerp(
        s.velocity.z,
        (fwd.z / fh) * horizontal,
        align,
      );
    }
    if (assist) {
      // Entering anti-grav: a gentle magnet settles you onto the new surface.
      if (assist.lift < 1 && s.velocity.y > -0.42)
        s.velocity.y += (-0.42 - s.velocity.y) * (1 - Math.exp(-2.5 * dt));
      if (s.velocity.y < -ANTI_GRAV_SINK) s.velocity.y = -ANTI_GRAV_SINK;
      speed = s.velocity.length();
      if ((assist.t > 3 && speed > 0.95) || assist.t > 12) s.gravAssist = null;
    }
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
        syncEuler(s);
        const verdict = assessTouchdown(s);
        if (verdict.kind === "crash") {
          s.position.y = contact.y + clearance;
          crash(verdict.tip);
          return;
        }
        s.position.y = contact.y + clearance;
        s.velocity.y = 0;
        s.grounded = contact;
        s.gravAssist = null;
        const f2 = _a.copy(FORWARD).applyQuaternion(q),
          u3 = _b.copy(UP).applyQuaternion(q);
        const hd = headingOf(f2, u3) ?? s.yaw;
        s.quaternion.setFromEuler(new THREE.Euler(0, hd, 0, "YXZ"));
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
  for (const pl of localPlanes(room)) {
    const depth = pl.d - p.dot(pl.n);
    if (depth <= 0) continue;
    const n = pl.n;
    if (pl.soft) {
      p.addScaledVector(n, depth + 0.001);
      const vn = s.velocity.dot(n);
      if (vn < 0) s.velocity.addScaledVector(n, -2 * vn);
      if (Math.abs(n.y) < 0.5) reflectYaw(s, n);
      else if (n.y < 0)
        noseDown(s, Math.max(0, pitchAngle(s.quaternion) + 0.05));
      events.boundary?.(Math.abs(n.y) < 0.5 ? "edge" : "ceiling");
    } else if (
      collide(
        s,
        n,
        depth,
        pl.name,
        events,
        crash,
        n.y < -0.5 ? "ceiling" : "wall",
      )
    )
      return;
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
  if (
    !Number.isFinite(
      p.x + p.y + p.z + s.velocity.x + s.velocity.y + s.velocity.z,
    )
  ) {
    // Never leave the plane in a broken state: put it back where it was, stopped.
    p.copy(previous);
    s.velocity.set(0, 0, 0);
  }
  syncEuler(s);
  // How high above whatever is "below" (in this frame)? Used to let go of anti-grav.
  if (s.antiGrav) {
    const support = findSupport(room, p, p.y);
    s.altitude = Number.isFinite(support.y) ? p.y - support.y : Infinity;
    s.farTime =
      !s.grounded && s.altitude > ANTI_GRAV_RELEASE ? s.farTime + dt : 0;
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
