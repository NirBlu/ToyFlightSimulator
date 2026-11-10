import * as THREE from "../../vendor/three.module.js";
import {
  createBuilder,
  addSky,
  canvasTexture,
  pulsePads,
} from "./builder.js?v=5";

/** A big sunny front yard: ~36 × 30 m of lawn, stone wall, patio, porch and house. */
export default {
  id: "front-lawn",
  name: "Front Lawn",
  short: "front lawn",
  tagline: "Stone wall · patio set · porch · trampoline",
  icon: "🌳",
  heroTitle: "Cleared for<br /><em>the front lawn.</em>",
  objective: "OUTDOOR FLIGHT · PICNIC TABLE → FRONT PORCH",
  env: {
    background: "#bfe0f0",
    fog: [28, 85],
    hemi: ["#dff3ff", "#7c9a52", 2.0],
    sun: {
      color: "#fff1cf",
      intensity: 3.4,
      position: [-8, 14, 6],
      size: 9,
      far: 40,
      follow: true,
    },
    far: 160,
    exposure: 1.15,
    camera: {
      minX: -19,
      maxX: 19,
      minZ: -13.6,
      maxZ: 17,
      minY: 0.12,
      maxY: 10,
    },
  },
  create(scene) {
    const B = createBuilder(scene);
    const { box, cylinder, sphere, mat, zone, addPad, architecture } = B;
    addSky(scene, 140, "#5fa9e0", "#e7f3ea");
    // Ground: mown grass stripes everywhere, with paths and a patio painted on.
    const grass = canvasTexture(
      256,
      256,
      (t, W, H) => {
        for (let i = 0; i < 8; i++) {
          t.fillStyle = i % 2 ? "#6fa64c" : "#7cb556";
          t.fillRect(0, (i * H) / 8, W, H / 8 + 1);
        }
        for (let i = 0; i < 900; i++) {
          t.fillStyle = Math.random() > 0.5 ? "#5e9541" : "#8cc463";
          t.fillRect(Math.random() * W, Math.random() * H, 1.5, 3);
        }
      },
      [24, 24],
    );
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      mat("#ffffff", { map: grass, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    architecture.add(ground);
    const flat = (w, d, x, z, color, y = 0.004, map) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        mat(color, map ? { map, roughness: 0.95 } : { roughness: 0.95 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      architecture.add(m);
      return m;
    };
    const pavers = canvasTexture(
      128,
      128,
      (t, W) => {
        t.fillStyle = "#b9aa95";
        t.fillRect(0, 0, W, W);
        t.strokeStyle = "#8f8270";
        t.lineWidth = 3;
        for (let i = 0; i <= 4; i++) {
          t.beginPath();
          t.moveTo(0, i * 32);
          t.lineTo(W, i * 32);
          t.stroke();
          for (let j = 0; j < 4; j++) {
            t.beginPath();
            const x = j * 32 + (i % 2) * 16;
            t.moveTo(x, i * 32);
            t.lineTo(x, i * 32 + 32);
            t.stroke();
          }
        }
      },
      [8, 7],
    );
    flat(8, 7, -8, -7.5, "#ffffff", 0.004, pavers);
    zone("patio", -8, -7.5, 8, 7);
    flat(2.2, 24, 0, 0, "#cdbfa8");
    zone("garden path", 0, 0, 2.2, 24);
    flat(5.5, 32, 6.5, 0, "#9a9a96");
    zone("driveway", 6.5, 0, 5.5, 32);
    // House facade (solid) with a roof you can land on the porch below.
    const siding = mat("#f1e4c8"),
      trim = mat("#ffffff"),
      roof = mat("#8a4e3e");
    box(24, 5, 6, -1, 2.5, -17, siding, {
      name: "House",
      parent: architecture,
    });
    const roofL = box(24.6, 0.25, 4.2, -1, 6.1, -15.6, roof, {
      solid: false,
      parent: architecture,
    });
    roofL.rotation.x = 0.62;
    const roofR = box(24.6, 0.25, 4.2, -1, 6.1, -18.4, roof, {
      solid: false,
      parent: architecture,
    });
    roofR.rotation.x = -0.62;
    B.addCollider(-13, 5, -20, 11, 7.4, -14, "Roof", { landable: false });
    for (const x of [-9, -5.5, 3, 7.5]) {
      box(
        1.6,
        1.3,
        0.06,
        x,
        3.4,
        -13.97,
        mat("#7fc4d8", { emissive: "#4a8fa3", emissiveIntensity: 0.25 }),
        { solid: false, parent: architecture },
      );
      box(1.8, 0.12, 0.12, x, 2.7, -13.94, trim, {
        solid: false,
        parent: architecture,
      });
    }
    box(1.1, 2.1, 0.06, -1, 1.55, -13.97, mat("#2f5f73"), {
      solid: false,
      parent: architecture,
    });
    box(4.6, 2.6, 0.06, 6.5, 1.3, -13.97, mat("#e7e3dc"), {
      solid: false,
      parent: architecture,
    });
    for (let i = 1; i < 5; i++)
      box(4.6, 0.04, 0.08, 6.5, i * 0.52, -13.93, mat("#c9c3b8"), {
        solid: false,
        parent: architecture,
      });
    // Front porch deck, steps, posts and a flat porch roof.
    const deck = mat("#a8754f");
    box(6, 0.5, 2.4, -1, 0.25, -12.8, deck, { name: "Front porch" });
    box(2, 0.25, 0.5, -1, 0.125, -11.35, deck, { name: "Porch step" });
    for (const x of [-3.8, 1.8])
      cylinder(0.09, 0.09, 2.6, x, 1.8, -11.75, trim, {
        solid: true,
        name: "Porch post",
      });
    box(6.6, 0.18, 2.8, -1, 3.18, -12.65, mat("#e9dcc0"), {
      name: "Porch roof",
    });
    // Picnic table (spawn) with benches.
    const wood = mat("#b07a4c"),
      darkWood = mat("#7b5236");
    box(0.85, 0.07, 2.6, -2.6, 0.725, 5.0, wood, { name: "Picnic table" });
    for (const dz of [-1, 1])
      for (const dx of [-0.32, 0.32]) {
        const leg = box(0.07, 0.72, 0.07, -2.6 + dx, 0.36, 5 + dz, darkWood, {
          solid: false,
        });
        leg.rotation.z = dx > 0 ? -0.25 : 0.25;
      }
    for (const dx of [-0.72, 0.72]) {
      box(0.3, 0.05, 2.6, -2.6 + dx, 0.45, 5.0, wood, { name: "Picnic bench" });
      for (const dz of [-1, 1])
        box(0.06, 0.42, 0.06, -2.6 + dx, 0.21, 5 + dz, darkWood, {
          solid: false,
        });
    }
    // Patio set: table, four chairs, lounger, umbrella, BBQ and pots.
    const white = mat("#f6f3ea"),
      teal = mat("#2a8c8a"),
      cushion = mat("#f0b35a");
    box(1.3, 0.06, 1.3, -8, 0.74, -7.5, white, { name: "Patio table" });
    cylinder(0.06, 0.06, 0.71, -8, 0.355, -7.5, white, {
      solid: true,
      name: "Table leg",
    });
    for (const [dx, dz, ry] of [
      [0, 1.05, 0],
      [0, -1.05, Math.PI],
      [1.05, 0, Math.PI / 2],
      [-1.05, 0, -Math.PI / 2],
    ]) {
      const cx = -8 + dx,
        cz = -7.5 + dz;
      box(0.5, 0.06, 0.5, cx, 0.45, cz, teal, { name: "Patio chair" });
      const bx = cx + Math.sin(ry) * 0.24,
        bz = cz + Math.cos(ry) * 0.24;
      box(0.5, 0.5, 0.05, bx, 0.72, bz, teal, { name: "Chair back", rotY: ry });
      for (const lx of [-0.2, 0.2])
        for (const lz of [-0.2, 0.2])
          box(0.04, 0.42, 0.04, cx + lx, 0.21, cz + lz, teal, { solid: false });
    }
    box(0.75, 0.12, 1.5, -11.2, 0.38, -6.3, cushion, { name: "Sun lounger" });
    const back = box(0.75, 0.1, 0.6, -11.2, 0.6, -7.3, cushion, {
      solid: false,
    });
    back.rotation.x = 0.9;
    B.addCollider(-11.58, 0.32, -7.6, -10.82, 0.82, -7.05, "Lounger back", {
      landable: false,
    });
    for (const lz of [-5.6, -7.0])
      box(0.7, 0.3, 0.06, -11.2, 0.16, lz, white, { solid: false });
    cylinder(0.03, 0.03, 2.3, -10.2, 1.15, -8.9, white, {
      solid: true,
      name: "Umbrella pole",
    });
    cylinder(0.25, 0.3, 0.1, -10.2, 0.05, -8.9, mat("#555555"), {
      solid: true,
      name: "Umbrella base",
    });
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 0.5, 8, 1, true),
      mat("#e8574b", { side: THREE.DoubleSide }),
    );
    canopy.position.set(-10.2, 2.35, -8.9);
    canopy.castShadow = true;
    B.furniture.add(canopy);
    B.addCollider(-11.2, 2.1, -9.9, -9.2, 2.6, -7.9, "Patio umbrella", {
      landable: false,
    });
    // BBQ grill.
    const black = mat("#2b2b2e", { roughness: 0.5, metalness: 0.3 });
    box(0.9, 0.4, 0.55, -5.2, 0.78, -10.3, black, { name: "Barbecue" });
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.9, 16, 1, false, 0, Math.PI),
      black,
    );
    lid.rotation.z = Math.PI / 2;
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(-5.2, 0.98, -10.3);
    lid.castShadow = true;
    B.furniture.add(lid);
    B.addCollider(-5.65, 0.98, -10.57, -4.75, 1.25, -10.03, "BBQ lid", {
      landable: false,
    });
    box(0.4, 0.05, 0.5, -4.55, 0.86, -10.3, mat("#8d8d8d"), {
      name: "BBQ side shelf",
    });
    for (const dx of [-0.38, 0.38])
      box(0.05, 0.58, 0.05, -5.2 + dx, 0.29, -10.3, black, { solid: false });
    const terracotta = mat("#c96d48");
    for (const [x, z, s] of [
      [-4.4, -4.5, 1],
      [-11.5, -10.5, 1.2],
      [-4.4, -10.8, 0.8],
      [1.6, -10.8, 0.9],
      [-3.6, -10.8, 0.9],
    ]) {
      cylinder(0.3 * s, 0.22 * s, 0.5 * s, x, 0.25 * s, z, terracotta, {
        solid: true,
        name: "Flower pot",
        landable: false,
      });
      for (let i = 0; i < 5; i++)
        sphere(
          0.12 * s,
          x + Math.sin(i * 1.3) * 0.12 * s,
          0.55 * s + (i % 2) * 0.06,
          z + Math.cos(i * 1.3) * 0.12 * s,
          mat(["#ef5a8a", "#ffd34e", "#b06be0"][i % 3]),
        );
    }
    // Stone wall along the front, with a gap and two gate pillars.
    const stones = ["#9d978c", "#8a8479", "#b0a99c", "#7d776d"].map((c) =>
      mat(c),
    );
    const wallZ = 12,
      wallH = 0.85;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [x0, x1] of [
      [-18.5, -1.6],
      [1.6, 18.5],
    ]) {
      B.addCollider(x0, 0, wallZ - 0.23, x1, wallH, wallZ + 0.23, "Stone wall");
      for (let row = 0; row < 3; row++) {
        let x = x0;
        while (x < x1 - 0.05) {
          const w = Math.min(x1 - x, 0.45 + rnd() * 0.45);
          box(
            w - 0.03,
            0.26,
            0.46,
            x + w / 2,
            0.14 + row * 0.28,
            wallZ,
            stones[Math.floor(rnd() * 4)],
            { solid: false },
          );
          x += w;
        }
      }
      box(
        x1 - x0,
        0.06,
        0.52,
        (x0 + x1) / 2,
        wallH - 0.01,
        wallZ,
        mat("#c7c0b2"),
        { solid: false },
      );
    }
    for (const x of [-1.9, 1.9]) {
      box(0.6, 1.15, 0.6, x, 0.575, wallZ, stones[2], { name: "Gate pillar" });
      sphere(
        0.14,
        x,
        1.3,
        wallZ,
        mat("#fff6cf", { emissive: "#ffd986", emissiveIntensity: 0.6 }),
      );
    }
    // Side walls (low) to frame the yard.
    for (const x of [-18.5, 18.5])
      B.addCollider(x - 0.23, 0, -14, x + 0.23, wallH, 12, "Stone wall");
    for (const x of [-18.5, 18.5])
      box(0.46, wallH, 26, x, wallH / 2, -1, stones[1], { solid: false });
    // Mailbox.
    cylinder(0.05, 0.05, 1.0, 3.0, 0.5, 11.3, darkWood, {
      solid: true,
      name: "Mailbox post",
    });
    box(0.3, 0.28, 0.55, 3.0, 1.14, 11.3, mat("#2f6dbf"), { name: "Mailbox" });
    box(0.03, 0.18, 0.08, 3.17, 1.34, 11.45, mat("#e0352b"), { solid: false });
    // Garden bench.
    const green = mat("#3f6b4d");
    box(1.7, 0.06, 0.48, 10.5, 0.46, 8.4, wood, { name: "Garden bench" });
    box(1.7, 0.45, 0.06, 10.5, 0.75, 8.66, wood, { name: "Bench back" });
    for (const dx of [-0.75, 0.75])
      box(0.08, 0.44, 0.5, 10.5 + dx, 0.22, 8.4, green, { solid: false });
    // Trampoline.
    const tramp = cylinder(1.6, 1.6, 0.08, 10.5, 0.74, -3.5, mat("#1e2a33"), {
      segments: 32,
    });
    tramp.receiveShadow = true;
    B.addCollider(9.2, 0.68, -4.8, 11.8, 0.78, -2.2, "Trampoline");
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.09, 8, 40),
      mat("#2f8fe0"),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(10.5, 0.79, -3.5);
    B.furniture.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      cylinder(
        0.035,
        0.035,
        0.74,
        10.5 + Math.cos(a) * 1.5,
        0.37,
        -3.5 + Math.sin(a) * 1.5,
        mat("#9aa4ad"),
        { solid: false },
      );
    }
    // Doghouse with a flat roof.
    box(1.3, 0.95, 1.4, 14.5, 0.475, -10.5, mat("#d86d3d"), {
      name: "Doghouse",
    });
    box(1.5, 0.08, 1.6, 14.5, 0.99, -10.5, mat("#7b3f2a"), {
      name: "Doghouse roof",
    });
    box(0.5, 0.6, 0.04, 14.5, 0.3, -9.79, mat("#3b2116"), { solid: false });
    // Trees and bushes.
    const bark = mat("#6b4a33"),
      leaves = [mat("#4f8d3f"), mat("#5fa04a"), mat("#3f7a36")];
    for (const [x, z, s] of [
      [14, 3, 1],
      [-14.5, 6.5, 1.15],
      [-15, -3, 0.9],
      [15.5, 10, 0.8],
    ]) {
      cylinder(0.22 * s, 0.3 * s, 3 * s, x, 1.5 * s, z, bark, {
        solid: true,
        name: "Tree trunk",
      });
      for (let i = 0; i < 5; i++)
        sphere(
          1.3 * s,
          x + Math.sin(i * 1.7) * 0.9 * s,
          3.4 * s + (i % 2) * 0.6 * s,
          z + Math.cos(i * 1.7) * 0.9 * s,
          leaves[i % 3],
        );
      B.addCollider(
        x - 1.9 * s,
        2.3 * s,
        z - 1.9 * s,
        x + 1.9 * s,
        4.9 * s,
        z + 1.9 * s,
        "Tree",
        { landable: false },
      );
    }
    for (let x = -12; x <= -5; x += 1.4) {
      sphere(0.5, x, 0.4, -13.5, leaves[Math.abs(Math.round(x)) % 3]);
    }
    B.addCollider(-12.5, 0, -14, -4.5, 0.8, -13, "Hedge", { landable: false });
    // A garden gnome, because every yard needs one.
    cylinder(0.09, 0.12, 0.25, 1.6, 0.125, 9, mat("#3d6fd1"), {
      solid: true,
      name: "Garden gnome",
      landable: false,
    });
    sphere(0.08, 1.6, 0.3, 9, mat("#f2c9a5"));
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.2, 12),
      mat("#d9342b"),
    );
    hat.position.set(1.6, 0.44, 9);
    B.furniture.add(hat);

    // Suggested landing spots (you can land on any flat top, these are just fun goals).
    addPad(
      "picnic",
      "picnic table",
      -2.6,
      0.76,
      5.0,
      0.85,
      2.6,
      "#ffefb9",
      "01",
    );
    addPad(
      "patio-table",
      "patio table",
      -8,
      0.77,
      -7.5,
      1.3,
      1.3,
      "#a4ffe1",
      "02",
    );
    addPad("porch", "front porch", -1, 0.5, -12.8, 6, 2.4, "#ffe8b0", "03");
    addPad(
      "trampoline",
      "trampoline",
      10.5,
      0.78,
      -3.5,
      2.6,
      2.6,
      "#a4ffe1",
      "04",
    );
    addPad(
      "porch-roof",
      "porch roof",
      -1,
      3.27,
      -12.65,
      6.6,
      2.8,
      "#ffd0f0",
      "05",
    );
    addPad("wall", "stone wall top", 9, 0.85, wallZ, 5, 0.46, "#ffefb9", "06");
    return {
      furniture: B.furniture,
      architecture,
      colliders: B.colliders,
      pads: B.pads,
      animated: B.animated,
      balls: B.balls,
      groundZones: B.groundZones,
      ground: { y: 0, name: "grass" },
      bounds: {
        minX: -18.2,
        maxX: 18.2,
        minZ: -14.5,
        maxZ: 16,
        maxY: 9,
        soft: true,
      },
      spawn: new THREE.Vector3(-2.6, 0.76 + 0.068, 6.05),
      spawnYaw: 0,
      spawnPadId: "picnic",
      targetPadId: "porch",
      update(time) {
        pulsePads(B.animated, time);
      },
    };
  },
};
