import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
export function createRoom(scene) {
  const furniture = new THREE.Group();
  furniture.name = "FurnitureModelHook";
  scene.add(furniture);
  const architecture = new THREE.Group();
  architecture.name = "RoomShell";
  scene.add(architecture);
  const colliders = [],
    pads = [],
    animated = [];
  const wood = mat("#bf8050"),
    darkWood = mat("#774e3b"),
    fabric = mat("#287a7b"),
    cushion = mat("#439895");
  function box(
    w,
    h,
    d,
    x,
    y,
    z,
    material,
    parent = furniture,
    solid = true,
    name = "Furniture",
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    if (solid)
      colliders.push({
        min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
        name,
      });
    return m;
  }
  function sphere(r, x, y, z, material, parent = furniture) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function cylinder(r1, r2, h, x, y, z, material, solid = false) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r2, h, 24),
      material,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    furniture.add(m);
    if (solid)
      colliders.push({
        min: new THREE.Vector3(
          x - Math.max(r1, r2),
          y - h / 2,
          z - Math.max(r1, r2),
        ),
        max: new THREE.Vector3(
          x + Math.max(r1, r2),
          y + h / 2,
          z + Math.max(r1, r2),
        ),
        name: "Floor lamp",
      });
    return m;
  }
  // Six by eight meters. The near wall is cut away visually, but remains solid in physics.
  box(6, 0.08, 8, 0, -0.04, 0, mat("#c29262"), architecture, false);
  for (let z = -3.9; z < 4; z += 0.33)
    box(6, 0.001, 0.007, 0, 0.002, z, mat("#a9754e"), architecture, false);
  for (let z = -3.75; z < 4; z += 0.66)
    for (let x = -2.9; x < 3; x += 1.6)
      box(
        0.006,
        0.001,
        0.31,
        x + (Math.round(z * 3) % 2) * 0.4,
        0.003,
        z,
        mat("#a9754e"),
        architecture,
        false,
      );
  const wall = mat("#eee0c5");
  const accent = mat("#7ea6a5");
  box(0.08, 2.7, 8, -3.04, 1.35, 0, accent, architecture, false);
  box(0.08, 2.7, 8, 3.04, 1.35, 0, wall, architecture, false);
  // A real opening lets directional light through instead of shadowing the whole room.
  box(1.1, 2.7, 0.08, -2.45, 1.35, -4.04, wall, architecture, false);
  box(2.2, 2.7, 0.08, 1.9, 1.35, -4.04, wall, architecture, false);
  box(2.6, 0.95, 0.08, -0.55, 0.475, -4.04, wall, architecture, false);
  box(2.6, 0.22, 0.08, -0.55, 2.59, -4.04, wall, architecture, false);
  // Ceiling is deliberately back-faced from the chase camera for an airy dollhouse look.
  box(
    6,
    0.06,
    8,
    0,
    2.73,
    0,
    mat("#f2e9d4", { side: THREE.FrontSide }),
    architecture,
    false,
  );
  for (const x of [-2.98, 2.98])
    box(0.035, 0.09, 8, x, 0.045, 0, mat("#f7e9ce"), architecture, false);
  box(6, 0.09, 0.035, 0, 0.045, -3.98, mat("#f7e9ce"), architecture, false);
  // Window with a sky gradient, white muntins and sunny panes.
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#8fcad6");
  grad.addColorStop(0.7, "#e0efd9");
  grad.addColorStop(1, "#edc994");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  box(
    2.6,
    1.45,
    0.03,
    -0.55,
    1.72,
    -3.975,
    mat("#ffffff", { map: tex, emissive: "#ccdfdc", emissiveIntensity: 0.5 }),
    architecture,
    false,
  ).castShadow = false;
  const white = mat("#fff5de");
  for (const x of [-1.9, -0.55, 0.8])
    box(0.065, 1.56, 0.08, x, 1.72, -3.93, white, architecture, false);
  for (const y of [0.95, 1.72, 2.48])
    box(2.77, 0.065, 0.08, -0.55, y, -3.93, white, architecture, false);
  box(2.95, 0.05, 0.21, -0.55, 0.94, -3.87, wood, architecture, false);
  const curtain = mat("#efc096");
  for (const x of [-2.11, 1.01])
    for (let i = 0; i < 5; i++)
      cylinder(0.045, 0.065, 1.8, x + i * 0.055, 1.6, -3.82, curtain);
  // Dining runway, start at the near end pointing toward the window.
  box(
    1.36,
    0.09,
    2.18,
    -1.4,
    0.735,
    1.5,
    wood,
    furniture,
    true,
    "Dining table",
  );
  for (const x of [-1.93, -0.87])
    for (const z of [0.62, 2.38])
      box(0.075, 0.69, 0.075, x, 0.345, z, darkWood);
  for (const x of [-2.45, -0.37]) {
    box(
      0.43,
      0.07,
      0.43,
      x,
      0.45,
      1.55,
      mat("#bc7149"),
      furniture,
      true,
      "Chair",
    );
    box(
      0.43,
      0.49,
      0.055,
      x,
      0.71,
      1.77,
      mat("#bc7149"),
      furniture,
      true,
      "Chair back",
    );
    for (const dx of [-0.16, 0.16])
      for (const dz of [-0.16, 0.16])
        box(0.035, 0.43, 0.035, x + dx, 0.215, 1.55 + dz, darkWood);
  }
  // A long teal couch against the right wall. Arms are wide enough for tiny wheels.
  box(
    1.12,
    0.24,
    2.5,
    2.04,
    0.25,
    -1.65,
    fabric,
    furniture,
    true,
    "Couch base",
  );
  box(0.2, 0.72, 2.6, 2.53, 0.52, -1.65, fabric, furniture, true, "Couch back");
  for (const z of [-2.3, -1.65, -1.0])
    box(
      0.87,
      0.19,
      0.6,
      1.96,
      0.455,
      z,
      cushion,
      furniture,
      true,
      "Couch cushion",
    );
  for (const z of [-2.85, -0.45])
    box(1.15, 0.65, 0.36, 2.02, 0.375, z, fabric, furniture, true, "Couch arm");
  for (const z of [-2.48, -0.83]) {
    const pillow = box(
      0.2,
      0.38,
      0.36,
      2.29,
      0.7,
      z,
      mat(z < -2 ? "#efb56e" : "#f0dcaf"),
      furniture,
      false,
    );
    pillow.rotation.z = -0.18;
  }
  for (const x of [1.65, 2.43])
    for (const z of [-2.7, -0.6]) box(0.06, 0.18, 0.06, x, 0.09, z, darkWood);
  // Rug and coffee table.
  box(2.8, 0.014, 2.5, 0.45, 0.011, -0.45, mat("#d7b282"), furniture, false);
  for (let z = -1.55; z < 0.8; z += 0.15)
    box(2.65, 0.002, 0.014, 0.45, 0.02, z, mat("#f1d6ac"), furniture, false);
  box(1.22, 0.07, 0.9, 0.55, 0.385, 0.4, wood, furniture, true, "Coffee table");
  for (const x of [0.08, 1.02])
    for (const z of [0.08, 0.72])
      box(0.055, 0.35, 0.055, x, 0.175, z, darkWood);
  // Bookshelf: shelf top is also physically solid (not a marked runway).
  box(
    1.25,
    1.7,
    0.12,
    -2.15,
    0.85,
    -3.75,
    darkWood,
    furniture,
    true,
    "Bookcase",
  );
  for (const x of [-2.78, -1.52])
    box(0.07, 1.7, 0.43, x, 0.85, -3.56, wood, furniture, true, "Bookcase");
  for (const y of [0.12, 0.58, 1.04, 1.7])
    box(1.32, 0.055, 0.43, -2.15, y, -3.56, wood, furniture, true, "Shelf");
  const colors = ["#e58b57", "#367981", "#eacb91", "#aabd94", "#e2a69e"];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 9; i++) {
      const h = 0.21 + (i % 3) * 0.045;
      box(
        0.08,
        h,
        0.22,
        -2.65 + i * 0.115,
        0.15 + row * 0.46 + h / 2,
        -3.49,
        mat(colors[(i + row) % 5]),
        furniture,
        false,
      );
    }
  // TV sideboard, framed art, playful blocks and a houseplant.
  box(
    1.5,
    0.5,
    0.43,
    0.6,
    0.27,
    -3.52,
    mat("#bf8050"),
    furniture,
    true,
    "TV stand",
  );
  box(
    1.25,
    0.7,
    0.055,
    0.6,
    1.01,
    -3.53,
    mat("#213b4b"),
    furniture,
    true,
    "Television",
  );
  box(
    1.13,
    0.58,
    0.01,
    0.6,
    1.01,
    -3.495,
    mat("#4b767b", { emissive: "#426c70", emissiveIntensity: 0.25 }),
    furniture,
    false,
  );
  const picture = box(
    0.7,
    0.55,
    0.045,
    -2.95,
    1.65,
    -0.5,
    wood,
    furniture,
    false,
  );
  picture.rotation.y = Math.PI / 2;
  const art = box(
    0.6,
    0.45,
    0.05,
    -2.92,
    1.65,
    -0.5,
    mat("#e8bd85"),
    furniture,
    false,
  );
  art.rotation.y = Math.PI / 2;
  cylinder(0.14, 0.1, 0.23, 2.25, 0.115, 2.45, mat("#cb7958"));
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4;
    const leaf = sphere(
      0.14,
      2.25 + Math.sin(a) * 0.15,
      0.42 + (i % 3) * 0.06,
      2.45 + Math.cos(a) * 0.15,
      mat("#5e946c"),
    );
    leaf.scale.set(0.4, 1.5, 0.65);
    leaf.rotation.z = Math.sin(a) * 0.5;
  }
  for (let i = 0; i < 3; i++)
    box(
      0.12,
      0.12,
      0.12,
      0.8 + i * 0.13,
      0.06,
      2.5 + (i % 2) * 0.13,
      mat(colors[i]),
      furniture,
      true,
      "Toy block",
    );
  cylinder(0.19, 0.2, 0.035, 1.2, 0.0175, -3.18, mat("#bfa16e"), true);
  cylinder(0.015, 0.015, 1.55, 1.2, 0.8, -3.18, mat("#a6854b"), true);
  cylinder(
    0.17,
    0.28,
    0.35,
    1.2,
    1.62,
    -3.18,
    mat("#ffe2a0", { emissive: "#f8bd64", emissiveIntensity: 0.25 }),
    true,
  );
  const lamp = new THREE.PointLight("#ffce88", 1.8, 3, 2);
  lamp.position.set(1.2, 1.52, -3.18);
  scene.add(lamp);

  function addPad(id, name, x, y, z, w, d, color, number) {
    const pad = { id, name, x, y, z, w, d };
    pads.push(pad);
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 512;
    const t = c.getContext("2d");
    t.fillStyle = color;
    t.globalAlpha = 0.14;
    t.fillRect(0, 0, 256, 512);
    t.globalAlpha = 1;
    t.strokeStyle = color;
    t.lineWidth = 6;
    t.setLineDash([20, 14]);
    t.strokeRect(13, 13, 230, 486);
    t.setLineDash([]);
    t.lineWidth = 4;
    t.beginPath();
    t.arc(128, 256, 57, 0, Math.PI * 2);
    t.stroke();
    t.fillStyle = color;
    t.font = "bold 48px sans-serif";
    t.textAlign = "center";
    t.fillText(number, 128, 272);
    for (const v of [90, 390]) {
      t.beginPath();
      t.moveTo(103, v + 10);
      t.lineTo(128, v - 12);
      t.lineTo(153, v + 10);
      t.stroke();
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.035, d - 0.035),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, y + 0.003, z);
    furniture.add(plane);
    animated.push(plane);
    return pad;
  }
  addPad(
    "dining",
    "dining table",
    -1.4,
    0.78,
    1.5,
    1.36,
    2.18,
    "#ffefb9",
    "01",
  );
  addPad(
    "couch-far",
    "far couch arm",
    2.02,
    0.7,
    -2.85,
    1.15,
    0.36,
    "#a4ffe1",
    "02",
  );
  addPad(
    "couch-near",
    "near couch arm",
    2.02,
    0.7,
    -0.45,
    1.15,
    0.36,
    "#a4ffe1",
    "03",
  );
  addPad("coffee", "coffee table", 0.55, 0.42, 0.4, 1.22, 0.9, "#ffe8b0", "04");
  return {
    furniture,
    architecture,
    colliders,
    pads,
    animated,
    spawn: new THREE.Vector3(-1.4, 0.848, 2.28),
    update(time) {
      animated.forEach((m, i) => {
        m.material.opacity = 0.75 + Math.sin(time * 1.8 + i) * 0.17;
      });
    },
  };
}

/** Furniture uses world-space meters. Swap visuals, keep / update the explicit collision boxes and pads. */
export async function loadFurnitureModel(room, url, { scale = 1 } = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.scale.setScalar(scale);
  gltf.scene.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  room.furniture.visible = false;
  room.architecture.parent.add(gltf.scene);
  return gltf.scene;
}
