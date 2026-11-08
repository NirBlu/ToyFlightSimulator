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
    g.rotation.z = (1 - plane.gearBlend) * (i === 0 ? -1.45 : 1.45);
    g.visible = plane.gearBlend > 0.025;
  });
  plane.flaps.forEach((f) => {
    f.rotation.x = plane.flapBlend * 0.48;
  });
}

/** Drop a .glb under public/models. Author in meters, nose -Z, up +Y, origin at CG.
 * Primitives remain the crash rig; a custom model is hidden on impact. */
export async function loadPlaneModel(plane, url, { scale = 1 } = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  if (plane.importedModel) plane.root.remove(plane.importedModel);
  const model = gltf.scene;
  model.scale.setScalar(scale);
  model.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  plane.root.add(model);
  plane.importedModel = model;
  plane.primitives.visible = false;
  return model;
}
