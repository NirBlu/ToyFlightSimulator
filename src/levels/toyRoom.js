import * as THREE from "../../vendor/three.module.js";
import { createBuilder, canvasTexture, pulsePads } from "./builder.js?v=7";

/** A bright 8 × 10 m playroom with a big bed runway, a toy race track and bouncy balls. */
export default {
  id: "toy-room",
  name: "Toy Room",
  short: "toy room",
  tagline: "Bouncy balls · race track · toy chest",
  icon: "🧸",
  heroTitle: "Cleared for<br /><em>the toy room.</em>",
  objective: "PLAYTIME · BED → RACE TRACK · BUMP THE BALLS!",
  env: {
    background: "#e9dff2",
    fog: [7, 19],
    hemi: ["#fff4ff", "#c49a7a", 2.4],
    sun: {
      color: "#fff0d2",
      intensity: 3.0,
      position: [1.5, 3.6, -7],
      target: [0, 0, 1],
      size: 6.5,
      far: 18,
    },
    far: 30,
    camera: {
      minX: -3.86,
      maxX: 3.86,
      minZ: -4.86,
      maxZ: 4.86,
      minY: 0.18,
      maxY: 2.65,
    },
  },
  create(scene) {
    const B = createBuilder(scene);
    const { box, cylinder, sphere, mat, zone, addPad, architecture, ball } = B;
    const shell = { parent: architecture, solid: false };
    // Floor: light wood planks.
    const planks = canvasTexture(
      256,
      256,
      (t, W, H) => {
        for (let i = 0; i < 8; i++) {
          t.fillStyle = ["#e2b98b", "#d8ad7d", "#e8c398", "#dcb282"][i % 4];
          t.fillRect(0, (i * H) / 8, W, H / 8);
          t.fillStyle = "#b88b5f";
          t.fillRect(0, (i * H) / 8, W, 2);
          t.fillRect((i * 97) % W, (i * H) / 8, 2, H / 8);
        }
      },
      [4, 5],
    );
    box(8, 0.08, 10, 0, -0.04, 0, mat("#ffffff", { map: planks }), shell);
    const wallpaper = canvasTexture(
      128,
      128,
      (t, W) => {
        t.fillStyle = "#cfe8f3";
        t.fillRect(0, 0, W, W);
        t.fillStyle = "#ffffffaa";
        for (const [x, y] of [
          [20, 24],
          [84, 40],
          [44, 92],
          [104, 108],
        ]) {
          t.beginPath();
          t.arc(x, y, 9, 0, Math.PI * 2);
          t.arc(x + 10, y + 3, 7, 0, Math.PI * 2);
          t.arc(x - 9, y + 4, 6, 0, Math.PI * 2);
          t.fill();
        }
      },
      [6, 2.5],
    );
    const wall = mat("#ffffff", { map: wallpaper });
    box(0.08, 2.8, 10, -4.04, 1.4, 0, wall, shell);
    box(0.08, 2.8, 10, 4.04, 1.4, 0, mat("#f7d6a8"), shell);
    box(2.5, 2.8, 0.08, -2.75, 1.4, -5.04, wall, shell);
    box(2.5, 2.8, 0.08, 2.75, 1.4, -5.04, wall, shell);
    box(3, 0.9, 0.08, 0, 0.45, -5.04, wall, shell);
    box(3, 0.4, 0.08, 0, 2.6, -5.04, wall, shell);
    box(
      8,
      0.06,
      10,
      0,
      2.83,
      0,
      mat("#fbf4e8", { side: THREE.FrontSide }),
      shell,
    );
    const sky = canvasTexture(64, 128, (t, W, H) => {
      const g = t.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#86c6ea");
      g.addColorStop(1, "#f6e3b8");
      t.fillStyle = g;
      t.fillRect(0, 0, W, H);
    });
    box(
      3,
      1.5,
      0.03,
      0,
      1.65,
      -5.0,
      mat("#ffffff", { map: sky, emissive: "#d9ecf2", emissiveIntensity: 0.5 }),
      { ...shell, cast: false },
    );
    for (const x of [-1.5, 0, 1.5])
      box(0.07, 1.55, 0.08, x, 1.65, -4.96, mat("#ffffff"), shell);
    for (const y of [0.9, 1.65, 2.4])
      box(3.1, 0.07, 0.08, 0, y, -4.96, mat("#ffffff"), shell);
    for (const x of [-3.98, 3.98])
      box(0.035, 0.1, 10, x, 0.05, 0, mat("#ffffff"), shell);
    // Big bed (spawn runway), headboard on the left wall.
    const frame = mat("#8fb8de"),
      duvet = mat("#f6c445"),
      sheet = mat("#fffaf0");
    box(2.4, 0.3, 1.25, -2.78, 0.2, -3.6, frame, {
      name: "Bed frame",
      landable: false,
    });
    box(2.3, 0.23, 1.15, -2.8, 0.465, -3.6, sheet, { name: "Bed" });
    box(1.5, 0.004, 1.2, -2.3, 0.58, -3.6, duvet, { solid: false });
    box(0.08, 1.1, 1.3, -3.96, 0.55, -3.6, frame, { name: "Headboard" });
    const pillow = box(0.36, 0.12, 0.7, -3.7, 0.64, -3.6, mat("#ffffff"), {
      solid: false,
    });
    pillow.rotation.z = 0.12;
    for (let i = 0; i < 5; i++)
      box(0.12, 0.002, 1.21, -2.85 + i * 0.25, 0.5825, -3.6, mat("#ef7d57"), {
        solid: false,
      });
    // Toy cubby shelf against the back wall.
    const shelfWood = mat("#f3e6d2"),
      bins = [
        "#ef6f6c",
        "#5cb8e4",
        "#8fd16a",
        "#f6c445",
        "#b38fe0",
        "#ff9f4a",
      ].map((c) => mat(c));
    box(2.4, 1.2, 0.4, 2.65, 0.6, -4.75, shelfWood, { name: "Toy shelf" });
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++)
        box(
          0.7,
          0.42,
          0.04,
          1.85 + c * 0.8,
          0.3 + r * 0.55,
          -4.53,
          bins[(r * 3 + c) % 6],
          { solid: false },
        );
    // Tall bookcase on the right wall.
    box(0.4, 1.8, 1.6, 3.78, 0.9, -1.4, mat("#ffffff"), { name: "Bookcase" });
    for (let s = 0; s < 3; s++)
      for (let i = 0; i < 8; i++)
        box(
          0.25,
          0.2 + (i % 3) * 0.04,
          0.12,
          3.56,
          0.25 + s * 0.55 + 0.1,
          -2.05 + i * 0.17,
          bins[(i + s) % 6],
          { solid: false },
        );
    // Toy chest.
    box(1.1, 0.55, 0.65, 3.2, 0.275, 2.6, mat("#d9513f"), {
      name: "Toy chest",
    });
    box(1.14, 0.06, 0.69, 3.2, 0.58, 2.6, mat("#f6c445"), {
      name: "Toy chest lid",
    });
    // Kids table and chairs.
    const pastel = mat("#7fd3c4");
    box(1.0, 0.05, 1.0, 0.9, 0.5, 1.2, pastel, { name: "Kids table" });
    for (const dx of [-0.43, 0.43])
      for (const dz of [-0.43, 0.43])
        box(0.05, 0.48, 0.05, 0.9 + dx, 0.24, 1.2 + dz, mat("#ffffff"), {
          solid: false,
        });
    for (const [dz, c] of [
      [-0.85, bins[0]],
      [0.85, bins[1]],
    ]) {
      box(0.34, 0.04, 0.34, 0.9, 0.3, 1.2 + dz, c, { name: "Little chair" });
      box(0.34, 0.32, 0.04, 0.9, 0.48, 1.2 + dz + Math.sign(dz) * 0.15, c, {
        name: "Little chair back",
      });
    }
    // Raised toy race track: a long flat runway with lanes and toy cars.
    const track = canvasTexture(64, 512, (t, W, H) => {
      t.fillStyle = "#4a4f57";
      t.fillRect(0, 0, W, H);
      t.fillStyle = "#ffffff";
      t.fillRect(2, 0, 3, H);
      t.fillRect(W - 5, 0, 3, H);
      for (let y = 0; y < H; y += 32) t.fillRect(W / 2 - 1, y, 3, 18);
      for (let i = 0; i < 8; i++) {
        t.fillStyle = i % 2 ? "#ffffff" : "#111111";
        t.fillRect(i * 8, 40, 8, 8);
        t.fillStyle = i % 2 ? "#111111" : "#ffffff";
        t.fillRect(i * 8, 48, 8, 8);
      }
    });
    box(0.9, 0.15, 5, -1.9, 0.075, 1.6, mat("#ffffff", { map: track }), {
      name: "Race track",
    });
    for (const dx of [-0.48, 0.48])
      box(0.06, 0.08, 5, -1.9 + dx, 0.19, 1.6, mat("#ff7a3d"), {
        name: "Track rail",
        landable: false,
      });
    for (const [x, z, c] of [
      [-2.75, -0.4, bins[0]],
      [-2.75, 0.4, bins[1]],
      [-1.05, 3.6, bins[2]],
    ]) {
      box(0.12, 0.06, 0.22, x, 0.06, z, c, { name: "Toy car" });
      box(0.1, 0.05, 0.11, x, 0.115, z + 0.02, mat("#bfe7ff"), {
        solid: false,
      });
    }
    // Ball pit with a ring of soft walls.
    const pitX = 1.6,
      pitZ = 3.6,
      pit = mat("#5cb8e4");
    box(1.6, 0.3, 0.08, pitX, 0.15, pitZ - 0.76, pit, { name: "Ball pit" });
    box(1.6, 0.3, 0.08, pitX, 0.15, pitZ + 0.76, pit, { name: "Ball pit" });
    box(0.08, 0.3, 1.44, pitX - 0.76, 0.15, pitZ, pit, { name: "Ball pit" });
    box(0.08, 0.3, 1.44, pitX + 0.76, 0.15, pitZ, pit, { name: "Ball pit" });
    // Toy block tower and loose blocks.
    for (let i = 0; i < 4; i++)
      box(0.2, 0.2, 0.2, 2.2, 0.1 + i * 0.2, -1.8, bins[i], {
        name: "Toy block",
      });
    for (const [x, z, i] of [
      [1.8, -1.6, 4],
      [2.0, -2.2, 5],
      [-0.6, -2.6, 2],
    ])
      box(0.2, 0.2, 0.2, x, 0.1, z, bins[i], { name: "Toy block" });
    // Rocking horse.
    box(0.25, 0.3, 0.7, -0.8, 0.55, -3.9, mat("#e6b56d"), {
      name: "Rocking horse",
      landable: false,
    });
    box(0.2, 0.32, 0.22, -0.8, 0.82, -4.25, mat("#e6b56d"), {
      name: "Rocking horse head",
      landable: false,
    });
    const rocker = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.03, 6, 24, Math.PI * 0.6),
      mat("#b3653a"),
    );
    rocker.rotation.set(0, Math.PI / 2, Math.PI * 1.2);
    rocker.position.set(-0.8, 0.62, -3.9);
    B.furniture.add(rocker);
    B.addCollider(-0.95, 0, -4.45, -0.65, 0.4, -3.35, "Rocking horse", {
      landable: false,
    });
    // Teepee tent.
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 1.7, 6, 1, true),
      mat("#f3e1c4", { side: THREE.DoubleSide }),
    );
    tent.position.set(3.0, 0.85, 4.0);
    tent.castShadow = true;
    B.furniture.add(tent);
    B.addCollider(2.4, 0, 3.4, 3.6, 1.0, 4.6, "Teepee", { landable: false });
    B.addCollider(2.7, 1.0, 3.7, 3.3, 1.7, 4.3, "Teepee", { landable: false });
    // Round play rug and foam puzzle mat.
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 40),
      mat("#f39ab4", { roughness: 1 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.4, 0.006, -1.0);
    rug.receiveShadow = true;
    architecture.add(rug);
    zone("play rug", 0.4, -1.0, 3.0, 3.0);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        box(
          0.6,
          0.012,
          0.6,
          -0.3 + i * 0.6 - 0.9,
          0.006,
          3.0 + j * 0.6 - 0.9,
          bins[(i + j * 2) % 6],
          { ...shell, cast: false },
        );
    zone("foam mat", -0.3, 3.0, 2.4, 2.4);
    // A lamp on the shelf for a cosy glow.
    cylinder(
      0.06,
      0.1,
      0.25,
      3.5,
      1.33,
      -4.75,
      mat("#ffe7a8", { emissive: "#ffcc66", emissiveIntensity: 0.6 }),
      { solid: true, name: "Lamp", landable: false },
    );
    const glow = new THREE.PointLight("#ffd79a", 1.6, 4, 2);
    glow.position.set(3.5, 1.6, -4.6);
    scene.add(glow);
    // Bouncy balls of every size. They roll, bounce and never hurt the plane.
    ball(
      0.3,
      0.2,
      -0.8,
      ["#ff5f5f", "#ffffff", "#3fa9f5", "#ffe14d", "#ffffff", "#5fd37a"],
      { name: "beach ball", bounce: 0.55, stripes: 6 },
    );
    ball(0.33, -0.8, 1.2, ["#9b6bff", "#b48cff"], {
      name: "big bouncy ball",
      bounce: 0.6,
      stripes: 2,
    });
    ball(0.11, 1.2, -0.3, ["#ffffff", "#222222"], {
      name: "soccer ball",
      bounce: 0.6,
      stripes: 8,
    });
    ball(0.12, -0.2, -2.0, ["#f07a2e", "#3a2414"], {
      name: "basketball",
      bounce: 0.7,
      stripes: 4,
    });
    ball(0.07, 2.4, 0.6, ["#ff4fa3"], {
      name: "bouncy ball",
      bounce: 0.85,
      stripes: 1,
    });
    ball(0.05, 0.0, 0.4, ["#52e0d0"], {
      name: "bouncy ball",
      bounce: 0.85,
      stripes: 1,
    });
    ball(0.035, 1.6, 0.2, ["#d6f04a", "#ffffff"], {
      name: "tennis ball",
      bounce: 0.75,
      stripes: 2,
    });
    ball(0.18, 2.6, -0.4, ["#2fbf71", "#ffffff"], {
      name: "playground ball",
      bounce: 0.65,
      stripes: 2,
    });
    ball(0.09, 0.9, 1.2, ["#ffd34e", "#ff8a3d"], {
      name: "ball on the table",
      bounce: 0.6,
      stripes: 2,
      y: 0.525 + 0.09,
    });
    for (let i = 0; i < 9; i++)
      ball(
        0.075,
        pitX - 0.45 + (i % 3) * 0.45,
        pitZ - 0.45 + Math.floor(i / 3) * 0.45,
        [["#ef6f6c", "#5cb8e4", "#8fd16a", "#f6c445"][i % 4]],
        { name: "ball-pit ball", bounce: 0.5, stripes: 1 },
      );

    addPad("bed", "bed", -2.8, 0.58, -3.6, 2.3, 1.15, "#ffefb9", "01");
    addPad(
      "race-track",
      "race track",
      -1.9,
      0.15,
      1.6,
      0.9,
      5,
      "#a4ffe1",
      "02",
    );
    addPad(
      "toy-chest",
      "toy chest",
      3.2,
      0.61,
      2.6,
      1.14,
      0.69,
      "#ffe8b0",
      "03",
    );
    addPad(
      "kids-table",
      "kids table",
      0.9,
      0.525,
      1.2,
      1.0,
      1.0,
      "#ffd0f0",
      "04",
    );
    addPad("shelf", "toy shelf", 2.65, 1.2, -4.75, 2.4, 0.4, "#a4ffe1", "05");
    return {
      furniture: B.furniture,
      architecture,
      colliders: B.colliders,
      pads: B.pads,
      animated: B.animated,
      balls: B.balls,
      groundZones: B.groundZones,
      ground: { y: 0, name: "floor" },
      bounds: {
        minX: -3.94,
        maxX: 3.94,
        minZ: -4.94,
        maxZ: 4.94,
        maxY: 2.74,
        wallName: "toy room wall",
      },
      spawn: new THREE.Vector3(-3.4, 0.58 + 0.068, -3.6),
      spawnYaw: -Math.PI / 2,
      spawnPadId: "bed",
      targetPadId: "race-track",
      update(time) {
        pulsePads(B.animated, time);
      },
    };
  },
};
