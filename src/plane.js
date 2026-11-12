import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/addons/loaders/GLTFLoader.js";

const material = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...extra });
const coral = material("#ef6c46"),
  cream = material("#ffebba"),
  teal = material("#166575");
const rubber = material("#253345"),
  metal = material("#b9d3d0", { metalness: 0.55, roughness: 0.3 });
function mesh(geometry, mat, parent, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, parent, pos) =>
  mesh(new THREE.BoxGeometry(w, h, d), mat, parent, pos);

export function createPlane() {
  const root = new THREE.Group();
  root.name = "ToyPlane";
  const primitives = new THREE.Group();
  primitives.name = "ReplaceablePlanePrimitives";
  root.add(primitives);
  const pieces = [];
  const flaps = [];
  const gears = [];
  const part = (name, x = 0, y = 0, z = 0) => {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    primitives.add(group);
    pieces.push(group);
    return group;
  };
  const body = part("Fuselage");
  const fuselage = mesh(new THREE.SphereGeometry(1, 24, 16), coral, body);
  fuselage.scale.set(0.037, 0.035, 0.153);
  const nose = mesh(
    new THREE.SphereGeometry(0.035, 20, 12),
    cream,
    body,
    [0, 0, -0.122],
  );
  nose.scale.z = 0.6;
  const canopy = mesh(
    new THREE.SphereGeometry(0.027, 16, 12),
    material("#72c8cd", { metalness: 0.2, roughness: 0.16 }),
    body,
    [0, 0.026, -0.027],
  );
  canopy.scale.set(0.85, 0.8, 1.65);
  box(0.018, 0.004, 0.095, cream, body, [0, 0.034, 0.07]);
  for (const side of [-1, 1]) {
    const wing = part(
      side < 0 ? "LeftWing" : "RightWing",
      side * 0.092,
      -0.005,
      -0.016,
    );
    box(0.167, 0.009, 0.067, cream, wing, [0, 0, 0]);
    box(0.021, 0.01, 0.067, coral, wing, [side * 0.071, 0, 0]);
    box(0.04, 0.0105, 0.012, teal, wing, [side * 0.022, 0.001, -0.012]);
    const flap = new THREE.Group();
    flap.position.set(-side * 0.018, 0, 0.032);
    wing.add(flap);
    flaps.push(flap);
    box(0.095, 0.006, 0.022, coral, flap, [0, 0, 0.009]);
    const light = mesh(
      new THREE.SphereGeometry(0.005, 8, 6),
      material(side < 0 ? "#f36a65" : "#8dffbf", {
        emissive: side < 0 ? "#af2424" : "#37b973",
        emissiveIntensity: 1,
      }),
      wing,
      [side * 0.082, 0.003, 0],
    );
    light.name = "WingtipLight";
  }
  const tail = part("Tail", 0, 0.005, 0.115);
  box(0.117, 0.007, 0.035, cream, tail, [0, 0, 0]);
  box(0.007, 0.058, 0.035, teal, tail, [0, 0.025, 0.004]);
  box(0.12, 0.008, 0.009, coral, tail, [0, 0, 0.014]);
  const propeller = part("Propeller", 0, 0, -0.158);
  box(0.009, 0.113, 0.005, teal, propeller);
  box(0.113, 0.009, 0.005, teal, propeller);
  mesh(
    new THREE.SphereGeometry(0.012, 12, 8),
    coral,
    propeller,
    [0, 0, -0.005],
  );
  for (const [i, x, z] of [
    [0, -0.035, -0.04],
    [1, 0.035, -0.04],
    [2, 0, 0.104],
  ]) {
    const gear = part(`Gear${i}`, x, -0.018, z);
    gears.push(gear);
    box(0.004, 0.033, 0.004, metal, gear, [0, -0.014, 0]);
    const wheel = mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.009, 12),
      rubber,
      gear,
      [0, -0.037, 0],
    );
    wheel.rotation.z = Math.PI / 2;
    const hub = mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.01, 10),
      cream,
      gear,
      [0, -0.037, 0],
    );
    hub.rotation.z = Math.PI / 2;
  }
  return {
    root,
    primitives,
    pieces,
    flaps,
    gears,
    propeller,
    importedModel: null,
    gearBlend: 1,
    flapBlend: 0,
  };
}

export function animatePlane(plane, state, dt) {
  plane.propeller.rotation.z += (12 + state.throttle * 190) * dt;
  const blend = 1 - Math.exp(-9 * dt);
  plane.gearBlend += ((state.gearDown ? 1 : 0) - plane.gearBlend) * blend;
  plane.flapBlend += ((state.flapsDown ? 1 : 0) - plane.flapBlend) * blend;
  plane.gears.forEach((g, i) => {
    const retract = g.userData.retract;
    const up = 1 - plane.gearBlend;
    if (retract) {
      g.rotation[retract.axis] = up * retract.angle;
      if (retract.lift) g.position.y = retract.baseY + up * retract.lift;
    } else g.rotation.z = up * (i === 0 ? -1.45 : 1.45);
    g.visible = plane.gearBlend > 0.025;
  });
  plane.flaps.forEach((f) => {
    f.rotation.x = plane.flapBlend * 0.48;
  });
}

/** Nir's plane (models/plane.glb, a KLM 737 exported from Blender).
 * Its wheel nodes all share the body's origin, so they are removed and the
 * game's own animated gear is mounted under the body instead. */
export const PLANE_MODEL_URL = "./models/plane.glb";
export const NIR_PLANE = {
  removeNodes: /wheel/i, // leftwheel, righwheel, frontwheel
  rotateY: Math.PI, // exported nose toward +Z; the game flies nose -Z
  wingspan: 0.317, // meters, about the size of the primitive toy plane
  cgFromNose: 0.4635, // fraction of the length, just ahead of the wing root
  belly: 0.033, // lowest point (engine nacelles) = physics gear-up clearance
  // Gear-down origin height above the ground. A real 737 sits low: short legs,
  // ~1.4 cm (scaled) between the engine nacelles and the ground.
  gearDown: 0.047,
  groundPitchMax: 0.24, // nose-up limit on the ground so the tail never scrapes
  gear: [
    // x, z in plane space; the strut top is found by raycasting up to the skin.
    {
      name: "MainGearLeft",
      x: -0.02,
      z: 0.013,
      axis: "z",
      angle: 1.45,
      r: 0.0095,
      dual: true,
      lift: 0.003,
    },
    {
      name: "MainGearRight",
      x: 0.02,
      z: 0.013,
      axis: "z",
      angle: -1.45,
      r: 0.0095,
      dual: true,
      lift: 0.003,
    },
    {
      name: "NoseGear",
      x: 0,
      z: -0.126,
      axis: "x",
      angle: -1.45, // folds aft into the nose wheel well
      lift: 0.007,
      r: 0.008,
      dual: true,
    },
  ],
};
function buildGear(parent, spec, top, groundY) {
  const gear = new THREE.Group();
  gear.name = spec.name;
  gear.position.set(spec.x, top, spec.z);
  gear.userData.retract = {
    axis: spec.axis,
    angle: spec.angle,
    lift: spec.lift || 0, // rises into the wheel well while folding
    baseY: top,
  };
  parent.add(gear);
  const wheelY = groundY + spec.r - top;
  const strut = box(0.0035, -wheelY, 0.0035, metal, gear, [0, wheelY / 2, 0]);
  strut.name = "Strut";
  const offsets = spec.dual ? [-0.0042, 0.0042] : [0];
  if (spec.dual) box(0.011, 0.0025, 0.0025, metal, gear, [0, wheelY, 0]);
  for (const dx of offsets) {
    const w = mesh(
      new THREE.CylinderGeometry(spec.r, spec.r, 0.006, 14),
      rubber,
      gear,
      [dx, wheelY, 0],
    );
    w.rotation.z = Math.PI / 2;
    w.name = "Wheel";
    const hub = mesh(
      new THREE.CylinderGeometry(spec.r * 0.42, spec.r * 0.42, 0.0065, 10),
      cream,
      gear,
      [dx, wheelY, 0],
    );
    hub.rotation.z = Math.PI / 2;
  }
  return gear;
}

/** Bake a mesh's triangles (already in plane space) into per-region pieces. */
function splitMesh(src, matrix, classify, buckets) {
  const g = src.geometry.index
    ? src.geometry.toNonIndexed()
    : src.geometry.clone();
  g.applyMatrix4(matrix);
  const pos = g.attributes.position;
  const names = Object.keys(g.attributes);
  const lists = new Map();
  const c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++)
      ((c.x += pos.getX(t + k) / 3),
        (c.y += pos.getY(t + k) / 3),
        (c.z += pos.getZ(t + k) / 3));
    const key = classify(c);
    if (!lists.has(key)) lists.set(key, []);
    lists.get(key).push(t);
  }
  for (const [key, tris] of lists) {
    const geo = new THREE.BufferGeometry();
    for (const n of names) {
      const a = g.attributes[n];
      const out = new Float32Array(tris.length * 3 * a.itemSize);
      let o = 0;
      for (const t of tris)
        for (let k = 0; k < 3; k++)
          for (let e = 0; e < a.itemSize; e++)
            out[o++] = a.getComponent(t + k, e);
      geo.setAttribute(n, new THREE.BufferAttribute(out, a.itemSize));
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(new THREE.Mesh(geo, src.material));
  }
  g.dispose();
}

/** Load a .glb as the plane's look. Removes nodes matching `removeNodes`,
 * orients/scales it to the toy plane, splits it into crash pieces and mounts
 * the game's animated landing gear under it. The procedural plane stays as
 * the fallback if loading fails. */
export async function loadPlaneModel(
  plane,
  url = PLANE_MODEL_URL,
  opts = NIR_PLANE,
) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  const removed = [];
  if (opts.removeNodes)
    scene.traverse((n) => {
      if (n !== scene && opts.removeNodes.test(n.name)) removed.push(n);
    });
  for (const n of removed) n.parent?.remove(n);
  const orient = new THREE.Group();
  orient.add(scene);
  orient.rotation.y = opts.rotateY || 0;
  orient.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(orient);
  const scale = opts.scale || opts.wingspan / (box.max.x - box.min.x);
  orient.scale.setScalar(scale);
  orient.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(orient);
  const size = box.getSize(new THREE.Vector3());
  orient.position.set(
    -(box.min.x + box.max.x) / 2,
    -opts.belly - box.min.y,
    -(box.min.z + size.z * opts.cgFromNose),
  );
  orient.updateMatrixWorld(true);

  // Crash pieces: nose, fuselage, two wings (with engines) and the tail.
  const len = size.z;
  const classify = (c) =>
    c.z > 0.34 * len
      ? "Tail"
      : c.z < -0.22 * len
        ? "Nose"
        : c.x < -0.06 * len
          ? "LeftWing"
          : c.x > 0.06 * len
            ? "RightWing"
            : "Fuselage";
  const buckets = new Map();
  const raycastTargets = [];
  scene.traverse((n) => {
    if (!n.isMesh) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of mats)
      if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.55);
    splitMesh(n, n.matrixWorld, classify, buckets);
    raycastTargets.push(n);
  });

  // Mount the gear where a ray straight up first meets the skin.
  const ray = new THREE.Raycaster();
  const gearRoot = new THREE.Group();
  gearRoot.name = "ModelGear";
  const sides = raycastTargets.map((m) => m.material.side);
  raycastTargets.forEach((m) => (m.material.side = THREE.DoubleSide));
  const gears = opts.gear.map((spec) => {
    // Probe a few points around the mount (a centerline ray can slip through a seam).
    let top = -Infinity;
    for (const dx of [0.0015, -0.0015])
      for (const dz of [0.0015, -0.0015]) {
        ray.set(
          new THREE.Vector3(spec.x + dx, -1, spec.z + dz),
          new THREE.Vector3(0, 1, 0),
        );
        const hit = ray.intersectObjects(raycastTargets, false)[0];
        if (hit) top = Math.max(top, hit.point.y + 0.001);
      }
    if (!Number.isFinite(top)) top = -opts.belly;
    return buildGear(gearRoot, spec, top, -opts.gearDown);
  });
  raycastTargets.forEach((m, i) => (m.material.side = sides[i]));

  const model = new THREE.Group();
  model.name = "ImportedPlane";
  const pieces = [];
  for (const [name, meshes] of buckets) {
    const piece = new THREE.Group();
    piece.name = name;
    const b = new THREE.Box3();
    for (const m of meshes) {
      m.geometry.computeBoundingBox();
      b.union(m.geometry.boundingBox);
    }
    const center = b.getCenter(new THREE.Vector3());
    piece.position.copy(center);
    for (const m of meshes) {
      m.geometry.translate(-center.x, -center.y, -center.z);
      m.geometry.computeBoundingSphere();
      m.castShadow = true;
      m.receiveShadow = true;
      piece.add(m);
    }
    model.add(piece);
    pieces.push(piece);
  }
  model.add(gearRoot);
  scene.traverse((n) => n.geometry?.dispose());

  if (plane.importedModel) plane.root.remove(plane.importedModel);
  plane.root.add(model);
  plane.importedModel = model;
  plane.primitives.visible = false;
  plane.gears = gears;
  // Physics: gear-down height above the belly height, and the ground pitch limit.
  plane.gearDrop = opts.gearDown - opts.belly;
  plane.groundPitchMax = opts.groundPitchMax;
  plane.pieces = [...pieces, ...gears];
  plane.modelInfo = {
    scale,
    rotateY: opts.rotateY || 0,
    removed: removed.map((n) => n.name),
    size: size.toArray(),
    gear: gears.map((g) => [g.name, ...g.position.toArray()]),
  };
  return model;
}
