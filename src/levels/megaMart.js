import * as THREE from "../../vendor/three.module.js";
import { createBuilder, canvasTexture, pulsePads } from "./builder.js?v=11";

/**
 * Mega Mart: a big-box store interior (30 × 40 m, 7.5 m ceiling).
 * Long shelving aisles stocked with instanced products, checkout lanes with
 * moving belts, freezers, produce, pallets, carts, hanging aisle signs, a
 * Quick Stop convenience corner and sliding entrance doors.
 * All product meshes are InstancedMesh (a handful of draw calls for thousands
 * of items) and do not cast shadows.
 */
const W = 15, // half width  (x)
  D = 20, // half depth  (z)
  H = 7.5; // ceiling
function rng(seed) {
  // mulberry32: same store every time (and in tests).
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PALETTE = [
  "#e8443a",
  "#f6a623",
  "#f7d23e",
  "#5cc46a",
  "#2f9ee8",
  "#7a5cf0",
  "#ef5ba1",
  "#1fb5a9",
  "#ff7f3f",
  "#ffffff",
  "#3d6bd8",
  "#c8e04a",
];
// Gondola (aisle shelf) categories, west to east.
const SHELVES = [
  {
    name: "Cereal shelf",
    kind: "box",
    colors: ["#f6a623", "#e8443a", "#f7d23e", "#5cc46a", "#2f9ee8"],
  },
  {
    name: "Snack shelf",
    kind: "bag",
    colors: ["#e8443a", "#f7d23e", "#ef5ba1", "#ff7f3f", "#7a5cf0"],
  },
  {
    name: "Cereal and pasta shelf",
    kind: "mix",
    colors: ["#f7d23e", "#2f9ee8", "#e8443a", "#ffffff", "#5cc46a"],
  },
  {
    name: "Drinks shelf",
    kind: "bottle",
    colors: ["#2f9ee8", "#5cc46a", "#e8443a", "#f6a623", "#1fb5a9"],
  },
  {
    name: "Toy shelf",
    kind: "box",
    colors: ["#7a5cf0", "#ef5ba1", "#1fb5a9", "#f7d23e", "#3d6bd8"],
  },
  {
    name: "Pet food shelf",
    kind: "bag",
    colors: ["#c8e04a", "#ff7f3f", "#3d6bd8", "#e8443a", "#a87442"],
  },
];
const AISLES = [
  "1 · PRODUCE SIDE",
  "2 · CEREAL",
  "3 · SNACKS",
  "4 · PASTA & SAUCE",
  "5 · DRINKS",
  "6 · TOYS",
  "7 · PET FOOD",
];

export default {
  id: "mega-mart",
  name: "Mega Mart",
  short: "store",
  tagline: "Shelf-top runways · checkouts · freezers",
  icon: "🛒",
  heroTitle: "Cleared for<br /><em>the Mega Mart.</em>",
  objective: "SHOPPING TRIP · CEREAL SHELF → CHEST FREEZER",
  env: {
    background: "#e6ece8",
    fog: [24, 70],
    hemi: ["#ffffff", "#bdb4a6", 2.15],
    sun: {
      // Overhead "store lights": a high, nearly vertical light that follows the plane.
      color: "#fff6e6",
      intensity: 2.4,
      position: [2.5, 14, 4],
      size: 10,
      far: 32,
      follow: true,
    },
    far: 80,
    exposure: 1.12,
    camera: {
      minX: -W + 0.12,
      maxX: W - 0.12,
      minZ: -D + 0.12,
      maxZ: D - 0.12,
      minY: 0.14,
      maxY: H - 0.1,
    },
  },
  create(scene) {
    const B = createBuilder(scene);
    const { box, cylinder, mat, zone, addPad, architecture, furniture } = B;
    const rand = rng(20261116);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const shell = { parent: architecture, solid: false };
    const deco = { solid: false };
    const deco0 = { solid: false, cast: false };

    /* ---------------- Shell: floor, walls, ceiling ---------------- */
    const tiles = canvasTexture(
      256,
      256,
      (t, w, h) => {
        t.fillStyle = "#eeeae2";
        t.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 4; j++) {
            const v = 228 + Math.floor(((i * 7 + j * 3) % 5) * 4);
            t.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
            t.fillRect(i * 64 + 1, j * 64 + 1, 62, 62);
          }
        t.fillStyle = "#cfc8bc";
        for (let i = 0; i <= 4; i++) {
          t.fillRect(i * 64 - 1, 0, 2, h);
          t.fillRect(0, i * 64 - 1, w, 2);
        }
      },
      [30, 40],
    );
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * W, 2 * D),
      mat("#ffffff", { map: tiles, roughness: 0.35, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    architecture.add(floor);
    // Painted walkway around the aisles ("action alley").
    const alley = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 3.2),
      mat("#dfe9f2", { roughness: 0.5 }),
    );
    alley.rotation.x = -Math.PI / 2;
    alley.position.set(0, 0.004, 7.6);
    alley.receiveShadow = true;
    architecture.add(alley);
    const wallMat = mat("#f3efe6", { roughness: 0.95 });
    const band = mat("#1f6fbf", { roughness: 0.8 });
    // North / east / west walls, and the south wall with a door opening.
    box(2 * W, H, 0.3, 0, H / 2, -D - 0.15, wallMat, shell);
    box(0.3, H, 2 * D, -W - 0.15, H / 2, 0, wallMat, shell);
    box(0.3, H, 2 * D, W + 0.15, H / 2, 0, wallMat, shell);
    box(W - 2.6, H, 0.3, -(W + 2.6) / 2, H / 2, D + 0.15, wallMat, shell);
    box(W - 2.6, H, 0.3, (W + 2.6) / 2, H / 2, D + 0.15, wallMat, shell);
    box(5.2, H - 3, 0.3, 0, 3 + (H - 3) / 2, D + 0.15, wallMat, shell);
    // Blue band along the bottom of the walls.
    box(2 * W, 0.35, 0.04, 0, 0.175, -D + 0.02, band, {
      ...shell,
      cast: false,
    });
    box(0.04, 0.35, 2 * D, -W + 0.02, 0.175, 0, band, {
      ...shell,
      cast: false,
    });
    box(0.04, 0.35, 2 * D, W - 0.02, 0.175, 0, band, { ...shell, cast: false });
    // Ceiling tiles + exposed beams.
    const ceilingTex = canvasTexture(
      128,
      128,
      (t, w) => {
        t.fillStyle = "#f7f6f1";
        t.fillRect(0, 0, w, w);
        t.fillStyle = "#d7d4cb";
        t.fillRect(0, 0, w, 3);
        t.fillRect(0, 0, 3, w);
      },
      [15, 20],
    );
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * W, 2 * D),
      mat("#ffffff", { map: ceilingTex, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = H;
    architecture.add(ceiling);
    const beam = mat("#8d97a3", { roughness: 0.6, metalness: 0.3 });
    for (let z = -16; z <= 16; z += 8)
      box(2 * W, 0.35, 0.18, 0, H - 0.18, z, beam, { ...shell, cast: false });
    // Long ceiling light strips (one instanced mesh, emissive: no real lights).
    const strips = [];
    for (let x = -12; x <= 12; x += 3)
      for (let z = -17; z <= 17; z += 4.25)
        strips.push({
          p: [x, H - 0.05, z],
          s: [0.32, 0.06, 3.2],
          c: "#ffffff",
        });
    instanced(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: "#fffdf2" }),
      strips,
      architecture,
    );
    // Big structural columns (solid: you can stick to them with anti-grav).
    const column = mat("#c9ced4", { roughness: 0.7 });
    for (const x of [-10.5, 10.5])
      for (const z of [-8, 1.5])
        box(0.5, H, 0.5, x, H / 2, z, column, {
          name: "Column",
          landable: false,
          surfaceName: "column",
        });

    /* ---------------- Product geometry / instanced helpers ---------------- */
    const labelTex = canvasTexture(64, 64, (t, w, h) => {
      t.fillStyle = "#ffffff";
      t.fillRect(0, 0, w, h);
      t.fillStyle = "#e7e7e7";
      t.fillRect(0, h * 0.62, w, h * 0.38);
      t.fillStyle = "#ffffffee";
      t.fillRect(4, h * 0.2, w - 8, h * 0.3);
      t.fillStyle = "#00000022";
      t.beginPath();
      t.arc(w * 0.5, h * 0.35, h * 0.11, 0, Math.PI * 2);
      t.fill();
      t.fillStyle = "#00000030";
      t.fillRect(0, 0, w, 3);
    });
    const productMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: labelTex,
      roughness: 0.55,
    });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0); // origin at the bottom
    const canGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    canGeo.translate(0, 0.5, 0);
    // Low-poly on purpose: there are thousands of them.
    const bottleGeo = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.48, 0],
        [0.48, 0.55],
        [0.2, 0.78],
        [0.18, 1],
        [0, 1],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      7,
    );
    const fruitGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const boxes = [],
      cans = [],
      bottles = [],
      fruit = [];
    function instanced(geometry, material, items, parent = furniture) {
      if (!items.length) return null;
      const m = new THREE.InstancedMesh(geometry, material, items.length);
      const o = new THREE.Object3D(),
        c = new THREE.Color();
      items.forEach((it, i) => {
        o.position.set(...it.p);
        o.rotation.set(0, it.r || 0, 0);
        o.scale.set(...it.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, c.set(it.c));
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = false;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      m.name = "Products";
      parent.add(m);
      return m;
    }
    /** Fill a shelf row with products. Products are placed along z from z0 to z1. */
    function stockRow(kind, colors, xFace, depthDir, y, z0, z1, maxH = 0.36) {
      let z = z0 + 0.03;
      while (z < z1 - 0.12) {
        const k = kind === "mix" ? pick(["box", "can", "box", "bottle"]) : kind;
        const c = pick(colors);
        if (k === "box") {
          const w = 0.16 + rand() * 0.16,
            h = Math.min(maxH, 0.22 + rand() * 0.16),
            d = 0.12 + rand() * 0.08;
          // One deep box stands in for a row of identical boxes.
          boxes.push({
            p: [xFace + depthDir * (0.02 + d), y, z + w / 2],
            s: [d * 2, h, w],
            c,
          });
          z += w + 0.015;
        } else if (k === "bag") {
          const w = 0.22 + rand() * 0.12,
            h = Math.min(maxH, 0.26 + rand() * 0.12);
          boxes.push({
            p: [xFace + depthDir * 0.14, y, z + w / 2],
            s: [0.16, h, w],
            c,
          });
          z += w + 0.02;
        } else if (k === "can") {
          const r = 0.045 + rand() * 0.02,
            h = 0.11 + rand() * 0.06;
          cans.push({
            p: [xFace + depthDir * 0.06, y, z + r],
            s: [r * 2, h, r * 2],
            c,
          });
          z += r * 2 + 0.01;
        } else {
          const r = 0.04 + rand() * 0.015,
            h = Math.min(maxH, 0.24 + rand() * 0.1);
          bottles.push({
            p: [xFace + depthDir * 0.06, y, z + r],
            s: [r * 2, h, r * 2],
            c,
          });
          z += r * 2 + 0.012;
        }
      }
    }

    /* ---------------- Aisle shelving (gondolas) ---------------- */
    const GZ0 = -12,
      GZ1 = 4,
      GH = 2.2,
      GW = 1.2;
    const steel = mat("#e9edf1", { roughness: 0.55, metalness: 0.2 });
    const peg = mat("#cfd6dd", { roughness: 0.8 });
    const kick = mat("#2b3a4a", { roughness: 0.7 });
    const tagStrip = mat("#ffd84a", { roughness: 0.6 });
    const gondolaX = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
    gondolaX.forEach((x, gi) => {
      const info = SHELVES[gi];
      const len = GZ1 - GZ0,
        zc = (GZ0 + GZ1) / 2;
      // One solid collider for the whole gondola; its top is a long runway.
      box(GW, GH, len, x, GH / 2, zc, steel, {
        name: info.name,
        surfaceName: `top of the ${info.name.toLowerCase()}`,
        cast: true,
      }).visible = false;
      box(0.06, GH - 0.02, len, x, GH / 2, zc, peg, deco0);
      box(GW, 0.14, len, x, 0.07, zc, kick, deco0);
      box(GW + 0.04, 0.05, len + 0.04, x, GH - 0.025, zc, steel, deco);
      for (const end of [GZ0, GZ1])
        box(
          GW,
          GH,
          0.05,
          x,
          GH / 2,
          end + (end === GZ0 ? 0.025 : -0.025),
          steel,
          deco0,
        );
      const levels = [0.14, 0.6, 1.06, 1.52];
      for (const side of [-1, 1]) {
        const face = x + side * (GW / 2);
        for (const y of levels) {
          box(
            GW / 2 - 0.04,
            0.035,
            len - 0.1,
            x + side * (GW / 4 + 0.01),
            y,
            zc,
            steel,
            deco0,
          );
          box(
            0.02,
            0.05,
            len - 0.1,
            face - side * 0.01,
            y - 0.005,
            zc,
            tagStrip,
            deco0,
          );
          stockRow(
            info.kind,
            info.colors,
            face - side * 0.03,
            -side,
            y + 0.018,
            GZ0 + 0.06,
            GZ1 - 0.06,
            0.4,
          );
        }
      }
    });
    // End-cap displays at both ends of every aisle shelf (big promo stacks).
    const promo = canvasTexture(256, 128, (t, w, h) => {
      t.fillStyle = "#e8443a";
      t.fillRect(0, 0, w, h);
      t.fillStyle = "#ffffff";
      t.font = "bold 58px sans-serif";
      t.textAlign = "center";
      t.fillText("SALE!", w / 2, 62);
      t.font = "bold 30px sans-serif";
      t.fillText("2 FOR $3", w / 2, 108);
    });
    const promoMat = mat("#ffffff", { map: promo, roughness: 0.7 });
    gondolaX.forEach((x, gi) => {
      for (const [z, dir] of [
        [GZ0 - 0.45, -1],
        [GZ1 + 0.45, 1],
      ]) {
        box(
          GW,
          1.25,
          0.9,
          x,
          0.625,
          z,
          mat(PALETTE[(gi * 3 + (dir > 0 ? 1 : 0)) % PALETTE.length], {
            roughness: 0.6,
          }),
          {
            name: "End-cap display",
            surfaceName: "end-cap display",
          },
        );
        box(0.9, 0.45, 0.02, x, 0.85, z + dir * 0.46, promoMat, deco0);
        // Cans stacked on the end-cap top (low, so it stays landable around them).
        const c = pick(PALETTE);
        for (let i = 0; i < 5; i++)
          cans.push({
            p: [x - 0.4 + i * 0.2, 1.25, z - dir * 0.25],
            s: [0.15, 0.2, 0.15],
            c,
          });
      }
    });
    // Overstock cases on top of a couple of shelves (not on the runway shelf).
    for (const [x, z] of [
      [-7.5, -10.6],
      [4.5, 2.4],
      [7.5, -6],
      [-4.5, -1],
    ]) {
      box(0.9, 0.5, 1.1, x, GH + 0.25, z, mat("#b98a55", { roughness: 0.9 }), {
        name: "Overstock box",
      });
      box(0.92, 0.06, 0.14, x, GH + 0.5, z, mat("#d9c29a"), deco0);
    }
    // Hanging aisle signs (solid: a fun anti-grav target).
    AISLES.forEach((label, i) => {
      const x = -9 + i * 3;
      const tex = canvasTexture(512, 160, (t, w, h) => {
        t.fillStyle = "#1f6fbf";
        t.fillRect(0, 0, w, h);
        t.fillStyle = "#ffd84a";
        t.fillRect(0, h - 18, w, 18);
        t.fillStyle = "#ffffff";
        t.textAlign = "center";
        const [num, name] = label.split(" · ");
        t.font = "bold 74px sans-serif";
        t.fillText(`AISLE ${num}`, w / 2, 74);
        t.font = "bold 40px sans-serif";
        t.fillText(name, w / 2, 124);
      });
      const signMat = mat("#ffffff", { map: tex, roughness: 0.6 });
      box(2.0, 0.66, 0.08, x, 4.6, -4, signMat, {
        name: `Aisle ${i + 1} sign`,
        surfaceName: `aisle ${i + 1} sign`,
        cast: false,
      });
      for (const dx of [-0.8, 0.8])
        cylinder(0.008, 0.008, H - 4.93, x + dx, (H + 4.93) / 2, -4, beam, {
          segments: 4,
        });
    });

    /* ---------------- Freezers along the back wall ---------------- */
    const glass = new THREE.MeshStandardMaterial({
      color: "#bfe6ff",
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0.1,
      emissive: "#9fd8ff",
      emissiveIntensity: 0.12,
      depthWrite: false,
    });
    const freezerBody = mat("#f4f7f9", { roughness: 0.4 });
    const frame = mat("#9aa6b2", { roughness: 0.4, metalness: 0.5 });
    const coolLight = mat("#e9f7ff", {
      emissive: "#bfe9ff",
      emissiveIntensity: 0.9,
    });
    const freezerNames = [
      "Ice cream freezer",
      "Frozen pizza freezer",
      "Frozen veggie freezer",
      "Ice pop freezer",
    ];
    const FZ = -D + 0.6;
    freezerNames.forEach((name, i) => {
      const x = -9 + i * 6;
      box(5.9, 2.1, 1.2, x, 1.05, FZ, freezerBody, {
        name,
        surfaceName: `top of the ${name.toLowerCase()}`,
      }).visible = false;
      box(5.9, 0.3, 1.2, x, 0.15, FZ, kick, deco0);
      box(5.9, 0.3, 1.2, x, 1.95, FZ, freezerBody, deco);
      box(5.9, 1.5, 0.04, x, 1.05, FZ - 0.58, coolLight, deco0); // glowing back
      box(5.9, 1.5, 0.02, x, 1.05, FZ + 0.6, glass, { ...deco0 }); // glass doors
      for (let k = 0; k <= 8; k++)
        box(
          0.04,
          1.5,
          0.05,
          x - 2.95 + k * 0.7375,
          1.05,
          FZ + 0.6,
          frame,
          deco0,
        );
      for (const y of [0.32, 0.72, 1.12, 1.52]) {
        box(5.8, 0.025, 1.0, x, y, FZ - 0.05, frame, deco0);
        let z = x - 2.85;
        while (z < x + 2.75) {
          const w = 0.18 + rand() * 0.12;
          boxes.push({
            p: [z + w / 2, y + 0.013, FZ - 0.05],
            s: [w, 0.18 + rand() * 0.14, 0.5],
            c: pick(PALETTE),
          });
          z += w + 0.03;
        }
      }
    });
    // Two open chest freezers in front of them, running north-south.
    for (const x of [-1.5, 3]) {
      box(1.0, 0.9, 4.2, x, 0.45, -15.4, freezerBody, {
        name: "Chest freezer",
        surfaceName: "chest freezer",
      });
      box(0.9, 0.02, 4.1, x, 0.91, -15.4, glass, deco0);
      box(1.02, 0.05, 4.22, x, 0.925, -15.4, frame, deco0);
      box(1.0, 0.25, 4.2, x, 0.125, -15.4, mat("#1f6fbf"), deco0);
    }

    /* ---------------- Produce (front-left) ---------------- */
    const wood = mat("#a87442", { roughness: 0.85 });
    const green = mat("#2f7d4a", { roughness: 0.8 });
    const produce = [
      {
        name: "Apple table",
        z: 7,
        colors: ["#d8252b", "#e8443a", "#b81d2a"],
        r: 0.085,
      },
      { name: "Orange table", z: 10, colors: ["#f6931f", "#ff9f2e"], r: 0.09 },
      {
        name: "Lemon and lime table",
        z: 13,
        colors: ["#f7e13e", "#7cc242"],
        r: 0.07,
      },
    ];
    for (const p of produce) {
      box(1.6, 0.85, 2.4, -12.2, 0.425, p.z, wood, deco);
      box(1.7, 0.1, 2.5, -12.2, 0.9, p.z, green, deco);
      B.addCollider(-13.05, 0, p.z - 1.25, -11.35, 0.95, p.z + 1.25, p.name, {
        surfaceName: p.name.toLowerCase(),
      });
      // Low fruit pile, sunk into the table top so landings still read flat.
      for (let i = 0; i < 9; i++)
        for (let j = 0; j < 13; j++) {
          const r = p.r * (0.9 + rand() * 0.2);
          const x = -12.9 + i * 0.17 + (j % 2) * 0.05,
            z = p.z - 1.1 + j * 0.17;
          fruit.push({
            p: [x, 0.95 + r * 0.25, z],
            s: [r * 2, r * 1.8, r * 2],
            c: pick(p.colors),
          });
        }
    }
    // Banana stand and watermelon bin.
    box(1.2, 1.2, 1.2, -9.6, 0.6, 9, wood, {
      name: "Watermelon bin",
      surfaceName: "watermelon bin",
    });
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        fruit.push({
          p: [-10 + i * 0.4, 1.12, 8.6 + j * 0.4],
          s: [0.36, 0.3, 0.42],
          c: j % 2 ? "#2f7d3a" : "#3c9a4a",
        });
    box(0.9, 1.0, 1.6, -9.6, 0.5, 12, wood, {
      name: "Banana stand",
      surfaceName: "banana stand",
    });
    for (let i = 0; i < 14; i++)
      fruit.push({
        p: [-9.9 + (i % 2) * 0.5, 1.03, 11.35 + Math.floor(i / 2) * 0.2],
        s: [0.32, 0.07, 0.1],
        c: "#f7d23e",
      });
    // Produce wall rack with misters along the west wall.
    box(1.0, 1.4, 10, -W + 0.5, 0.7, 9, green, {
      name: "Veggie rack",
      surfaceName: "veggie rack",
    });
    for (let j = 0; j < 40; j++)
      for (let i = 0; i < 3; i++)
        fruit.push({
          p: [-W + 0.25 + i * 0.25, 1.42, 4.2 + j * 0.24],
          s: [0.2, 0.12, 0.2],
          c: pick([
            "#3c9a4a",
            "#7cc242",
            "#d8252b",
            "#f6931f",
            "#6a3fa0",
            "#2f7d3a",
          ]),
        });

    /* ---------------- Checkout lanes (front) ---------------- */
    const beltTex = canvasTexture(
      64,
      64,
      (t, w, h) => {
        t.fillStyle = "#24272b";
        t.fillRect(0, 0, w, h);
        t.fillStyle = "#3a3f45";
        for (let i = 0; i < 4; i++) t.fillRect(0, i * 16, w, 3);
      },
      [1, 8],
    );
    const beltMat = mat("#ffffff", { map: beltTex, roughness: 0.9 });
    const counter = mat("#dfe3e6", { roughness: 0.5 });
    const counterSide = mat("#1f6fbf", { roughness: 0.6 });
    const screen = mat("#10202c", {
      emissive: "#1e90d0",
      emissiveIntensity: 0.6,
    });
    const laneLight = mat("#ffffff", {
      emissive: "#ffd84a",
      emissiveIntensity: 0.7,
    });
    const lanes = [-6, -3, 0, 3, 6];
    lanes.forEach((x, i) => {
      const n = i + 1;
      box(0.8, 0.9, 3.2, x, 0.45, 14, counterSide, {
        name: `Checkout ${n}`,
        surfaceName: `checkout ${n} belt`,
      });
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.012, 2.2),
        beltMat,
      );
      belt.position.set(x, 0.906, 13.5);
      belt.receiveShadow = true;
      furniture.add(belt);
      box(0.82, 0.03, 3.22, x, 0.885, 14, counter, deco0);
      // Register + screen + bagging shelf.
      box(0.45, 0.35, 0.4, x + 0.62, 1.07, 15.1, counter, { name: "Register" });
      box(0.4, 0.28, 0.04, x + 0.62, 1.38, 15.05, screen, deco0);
      box(0.6, 0.9, 0.9, x + 0.7, 0.45, 15.1, counterSide, {
        name: "Register stand",
        surfaceName: "register stand",
      });
      // Lane number on a pole.
      cylinder(0.03, 0.03, 2.3, x - 0.32, 1.15 + 0.9, 15.4, frame, {
        segments: 8,
      });
      const numTex = canvasTexture(128, 128, (t, w) => {
        t.fillStyle = "#1f6fbf";
        t.fillRect(0, 0, w, w);
        t.fillStyle = "#ffffff";
        t.font = "bold 92px sans-serif";
        t.textAlign = "center";
        t.fillText(String(n), w / 2, 98);
      });
      box(
        0.34,
        0.34,
        0.05,
        x - 0.32,
        3.4,
        15.4,
        mat("#ffffff", {
          map: numTex,
          emissive: "#ffffff",
          emissiveMap: numTex,
          emissiveIntensity: 0.35,
        }),
        {
          name: `Lane ${n} light`,
          cast: false,
        },
      );
      box(0.12, 0.12, 0.12, x - 0.32, 3.65, 15.4, laneLight, deco0);
      // Candy rack at the lane entrance.
      box(0.35, 1.25, 1.0, x - 0.75, 0.625, 13, mat("#e9edf1"), {
        name: "Candy rack",
        surfaceName: "candy rack",
      });
      for (const y of [0.3, 0.65, 1.0])
        for (let k = 0; k < 6; k++)
          boxes.push({
            p: [x - 0.55, y, 12.6 + k * 0.15],
            s: [0.05, 0.14, 0.12],
            c: pick(PALETTE),
          });
      // Groceries waiting on the belt.
      for (let k = 0; k < 3; k++)
        boxes.push({
          p: [x - 0.1 + rand() * 0.2, 0.912, 12.7 + k * 0.6],
          s: [0.18, 0.12 + rand() * 0.1, 0.14],
          c: pick(PALETTE),
        });
    });

    /* ---------------- Shopping carts ---------------- */
    const wireTex = canvasTexture(64, 64, (t, w) => {
      t.clearRect(0, 0, w, w);
      t.strokeStyle = "#ffffff";
      t.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        t.beginPath();
        t.moveTo(i * 16, 0);
        t.lineTo(i * 16, w);
        t.moveTo(0, i * 16);
        t.lineTo(w, i * 16);
        t.stroke();
      }
    });
    const wire = new THREE.MeshStandardMaterial({
      color: "#c7ced6",
      map: wireTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      metalness: 0.6,
      roughness: 0.35,
    });
    const red = mat("#e8443a", { roughness: 0.5 });
    const tire = mat("#202226");
    let cartN = 0;
    /** A cart pointing toward -z (handle at +z) when rotY = 0. */
    function cart(x, z, rotY = 0) {
      cartN++;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      furniture.add(g);
      const add = (geo, m, px, py, pz) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(px, py, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
        return mesh;
      };
      add(new THREE.BoxGeometry(0.56, 0.45, 0.85), wire, 0, 0.8, 0);
      add(new THREE.BoxGeometry(0.56, 0.02, 0.85), wire, 0, 0.58, 0);
      add(new THREE.BoxGeometry(0.6, 0.05, 0.05), red, 0, 1.08, 0.5);
      for (const sx of [-0.27, 0.27]) {
        add(new THREE.BoxGeometry(0.03, 0.55, 0.03), wire, sx, 0.3, 0.42);
        add(new THREE.BoxGeometry(0.03, 0.55, 0.03), wire, sx, 0.3, -0.38);
        add(new THREE.BoxGeometry(0.02, 0.02, 0.9), wire, sx, 0.12, 0);
        for (const sz of [-0.38, 0.42]) {
          const wh = add(
            new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10),
            tire,
            sx,
            0.05,
            sz,
          );
          wh.rotation.z = Math.PI / 2;
        }
      }
      // Colliders (axis aligned; carts are placed at 0 / 90 / 180 / 270 degrees).
      const sw = Math.abs(Math.sin(rotY)) > 0.7;
      const hw = sw ? 0.43 : 0.28,
        hd = sw ? 0.28 : 0.43;
      B.addCollider(
        x - hw,
        0.02,
        z - hd,
        x + hw,
        1.03,
        z + hd,
        "Shopping cart",
        {
          surfaceName: "shopping cart basket",
        },
      );
      const hx = x + Math.sin(rotY) * 0.5,
        hz = z + Math.cos(rotY) * 0.5;
      B.addCollider(
        hx - (sw ? 0.03 : 0.3),
        1.05,
        hz - (sw ? 0.3 : 0.03),
        hx + (sw ? 0.03 : 0.3),
        1.11,
        hz + (sw ? 0.3 : 0.03),
        "Cart handle",
        { landable: false },
      );
      return g;
    }
    // Cart corral by the doors, plus a few carts parked around the store.
    for (let i = 0; i < 4; i++) cart(5.4 + i * 0.95, 18.6, 0);
    cart(-3, -2, Math.PI / 2);
    cart(3, 0.5, 0);
    cart(-6, 9.5, Math.PI);
    cart(9.2, -14, -Math.PI / 2);

    /* ---------------- Pallets in action alley ---------------- */
    const pallet = mat("#c9a26b", { roughness: 0.95 });
    const wrap = new THREE.MeshStandardMaterial({
      color: "#dff2ff",
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
      depthWrite: false,
    });
    function palletStack(x, z, name, color, layers = 4) {
      box(1.2, 0.15, 1.0, x, 0.075, z, pallet, deco);
      const top = 0.15 + layers * 0.3;
      box(1.2, top, 1.0, x, top / 2, z, pallet, {
        name,
        surfaceName: name.toLowerCase(),
      }).visible = false;
      for (let l = 0; l < layers; l++)
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 2; j++)
            boxes.push({
              p: [x - 0.4 + i * 0.4, 0.15 + l * 0.3, z - 0.25 + j * 0.5],
              s: [0.38, 0.29, 0.48],
              c: color,
            });
      box(1.22, top - 0.15, 1.02, x, 0.15 + (top - 0.15) / 2, z, wrap, deco0);
    }
    palletStack(-6, 7.4, "Pallet of water bottles", "#4fb0f0", 4);
    palletStack(-3.2, 7.4, "Pallet of paper towels", "#ffffff", 3);
    palletStack(3.2, 7.4, "Pallet of dog food", "#ff7f3f", 3);
    palletStack(6, 7.4, "Pallet of juice boxes", "#7a5cf0", 4);
    // A soda-can pyramid in the middle of the alley (three landable tiers).
    const sodaColors = ["#e8443a", "#2f9ee8", "#5cc46a"];
    [
      [1.4, 0],
      [1.0, 1],
      [0.6, 2],
    ].forEach(([size, tier]) => {
      const y0 = tier * 0.24;
      box(size, 0.24, size, 0, y0 + 0.12, 7.6, mat("#ffffff"), {
        name: "Soda can pyramid",
        surfaceName: "soda can pyramid",
      }).visible = false;
      const n = Math.round(size / 0.2);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          cans.push({
            p: [-size / 2 + 0.1 + i * 0.2, y0, 7.6 - size / 2 + 0.1 + j * 0.2],
            s: [0.17, 0.23, 0.17],
            c: sodaColors[(i + j + tier) % 3],
          });
    });

    /* ---------------- Quick Stop convenience corner (front-right) ---------------- */
    const qsRed = mat("#e8443a", { roughness: 0.5 });
    const qsTop = mat("#f7f2e8", { roughness: 0.4 });
    box(1.0, 1.0, 6.5, W - 0.6, 0.5, 9.5, qsRed, {
      name: "Quick Stop counter",
      surfaceName: "quick stop counter",
    });
    box(1.04, 0.04, 6.54, W - 0.6, 1.02, 9.5, qsTop, deco0);
    // Coffee machines, slushie machine, hot dog roller on the counter (low, solid).
    box(0.5, 0.6, 0.5, W - 0.55, 1.34, 7, mat("#2b2b2f"), {
      name: "Coffee machine",
    });
    box(0.5, 0.6, 0.5, W - 0.55, 1.34, 7.7, mat("#2b2b2f"), {
      name: "Coffee machine",
    });
    box(0.55, 0.75, 0.9, W - 0.55, 1.415, 11.8, mat("#d9dde2"), {
      name: "Slushie machine",
    });
    for (const [dz, c] of [
      [-0.22, "#2f9ee8"],
      [0.22, "#e8443a"],
    ]) {
      const tank = cylinder(
        0.16,
        0.16,
        0.42,
        W - 0.55,
        1.55,
        11.8 + dz,
        new THREE.MeshStandardMaterial({
          color: c,
          transparent: true,
          opacity: 0.75,
          roughness: 0.1,
        }),
      );
      tank.castShadow = false;
    }
    box(
      0.5,
      0.18,
      0.7,
      W - 0.55,
      1.13,
      9.4,
      mat("#b8bec5", { metalness: 0.6, roughness: 0.3 }),
      { name: "Hot dog roller" },
    );
    for (let k = 0; k < 6; k++) {
      const hd = cylinder(
        0.025,
        0.025,
        0.4,
        W - 0.55,
        1.25,
        9.15 + k * 0.1,
        mat("#c0582f"),
        { segments: 8 },
      );
      hd.rotation.x = Math.PI / 2;
    }
    // Snack rack and two cafe tables.
    box(0.8, 1.5, 3, 11.4, 0.75, 8, mat("#e9edf1"), {
      name: "Snack rack",
      surfaceName: "top of the snack rack",
    });
    for (const side of [-1, 1])
      for (const y of [0.2, 0.6, 1.0])
        stockRow(
          "bag",
          ["#e8443a", "#f7d23e", "#ff7f3f", "#2f9ee8"],
          11.4 + side * 0.38,
          -side,
          y,
          6.55,
          9.45,
          0.3,
        );
    for (const [x, z] of [
      [10.6, 12.6],
      [12.4, 13.6],
    ]) {
      cylinder(0.45, 0.45, 0.04, x, 0.76, z, qsTop, { segments: 24 });
      cylinder(0.04, 0.04, 0.74, x, 0.37, z, frame, { segments: 8 });
      B.addCollider(
        x - 0.32,
        0.72,
        z - 0.32,
        x + 0.32,
        0.78,
        z + 0.32,
        "Cafe table",
        { surfaceName: "cafe table" },
      );
      for (const [dx, dz] of [
        [-0.7, 0],
        [0.7, 0],
      ]) {
        box(0.42, 0.05, 0.42, x + dx, 0.46, z + dz, qsRed, {
          name: "Cafe chair",
        });
        box(0.04, 0.46, 0.04, x + dx, 0.23, z + dz, frame, deco0);
      }
    }
    // Wall signs.
    function wallSign(text, sub, w, h, x, y, z, rotY, bg, fg = "#ffffff") {
      const tex = canvasTexture(512, Math.round((512 * h) / w), (t, cw, ch) => {
        t.fillStyle = bg;
        t.fillRect(0, 0, cw, ch);
        t.fillStyle = fg;
        t.textAlign = "center";
        t.font = `bold ${Math.round(ch * (sub ? 0.5 : 0.62))}px sans-serif`;
        t.fillText(text, cw / 2, ch * (sub ? 0.55 : 0.72));
        if (sub) {
          t.font = `bold ${Math.round(ch * 0.2)}px sans-serif`;
          t.fillText(sub, cw / 2, ch * 0.85);
        }
      });
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          map: tex,
          emissive: "#ffffff",
          emissiveMap: tex,
          emissiveIntensity: 0.25,
          roughness: 0.7,
        }),
      );
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      architecture.add(m);
      return m;
    }
    wallSign(
      "★ MEGA MART ★",
      "EVERYTHING FOR LITTLE PILOTS",
      9,
      1.6,
      0,
      5.4,
      D - 0.02,
      Math.PI,
      "#1f6fbf",
      "#ffd84a",
    );
    wallSign("FROZEN", null, 7, 1.1, 0, 3.6, -D + 0.02, 0, "#2f9ee8");
    wallSign(
      "FRESH PRODUCE",
      null,
      9,
      1.1,
      -W + 0.02,
      3.4,
      9,
      Math.PI / 2,
      "#2f7d4a",
    );
    wallSign(
      "QUICK STOP",
      "COFFEE · SNACKS · SLUSHIES",
      6,
      1.4,
      W - 0.02,
      3.2,
      9.5,
      -Math.PI / 2,
      "#e8443a",
    );
    wallSign(
      "CHECKOUT",
      null,
      6,
      0.9,
      -8,
      5.6,
      D - 0.02,
      Math.PI,
      "#ffd84a",
      "#1f3d5c",
    );

    /* ---------------- Entrance with sliding doors ---------------- */
    const outside = canvasTexture(256, 128, (t, w, h) => {
      const g = t.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#8cc6ee");
      g.addColorStop(0.55, "#e8f3f5");
      g.addColorStop(0.56, "#6c7076");
      g.addColorStop(1, "#4f5358");
      t.fillStyle = g;
      t.fillRect(0, 0, w, h);
    });
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 3.4),
      new THREE.MeshBasicMaterial({ map: outside, fog: false }),
    );
    view.position.set(0, 1.6, D + 1.2);
    view.rotation.y = Math.PI;
    architecture.add(view);
    box(5.2, 0.25, 0.4, 0, 2.95, D, frame, deco); // door header
    for (const x of [-2.6, 2.6])
      box(0.16, 3.0, 0.4, x, 1.5, D - 0.05, frame, {
        name: "Door frame",
        landable: false,
      });
    const doorGlass = new THREE.MeshStandardMaterial({
      color: "#cfefff",
      transparent: true,
      opacity: 0.3,
      roughness: 0.05,
      depthWrite: false,
    });
    const doors = [-1, 1].map((side) => {
      const d = new THREE.Group();
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.8, 0.04),
        doorGlass,
      );
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.08, 0.06),
        frame,
      );
      edge.position.y = -1.36;
      const edge2 = edge.clone();
      edge2.position.y = 1.36;
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.8, 0.08),
        frame,
      );
      handle.position.set(-side * 1.1, 0, 0);
      d.add(pane, edge, edge2, handle);
      d.position.set(side * 1.25, 1.42, D - 0.1);
      d.userData.side = side;
      architecture.add(d);
      return d;
    });
    // Welcome mat.
    const matTex = canvasTexture(256, 128, (t, w, h) => {
      t.fillStyle = "#2b3a4a";
      t.fillRect(0, 0, w, h);
      t.fillStyle = "#ffd84a";
      t.font = "bold 44px sans-serif";
      t.textAlign = "center";
      t.fillText("WELCOME!", w / 2, 80);
    });
    const welcome = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      mat("#ffffff", { map: matTex, roughness: 1 }),
    );
    welcome.rotation.x = -Math.PI / 2;
    welcome.position.set(0, 0.005, D - 1.4);
    welcome.receiveShadow = true;
    architecture.add(welcome);

    /* ---------------- Build the instanced product meshes ---------------- */
    instanced(boxGeo, productMat, boxes);
    instanced(canGeo, productMat, cans);
    instanced(
      bottleGeo,
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.25,
        metalness: 0.05,
      }),
      bottles,
    );
    instanced(
      fruitGeo,
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45 }),
      fruit,
    );

    /* ---------------- Named floor areas and suggested landing spots ---------------- */
    zone("produce section floor", -11.5, 10, 7, 9);
    zone("checkout area floor", 0, 14, 16, 5);
    zone("entrance floor", 0, 18, 10, 4);
    zone("frozen aisle floor", 0, -16, 26, 6);
    zone("quick stop floor", 12, 10, 6, 8);
    zone("action alley", 0, 7.6, 22, 3.2);
    const cerealX = gondolaX[2];
    addPad(
      "shelf",
      "cereal and pasta shelf top",
      cerealX,
      GH,
      2.2,
      1.0,
      3.0,
      "#ffd84a",
      "01",
    );
    addPad(
      "chest",
      "chest freezer",
      -1.5,
      0.9,
      -15.4,
      0.86,
      3.6,
      "#a4ffe1",
      "02",
    );
    addPad(
      "checkout",
      "checkout 3 belt",
      0,
      0.9,
      14,
      0.7,
      3.0,
      "#ff9d7a",
      "03",
    );
    addPad(
      "water",
      "pallet of water bottles",
      -6,
      1.35,
      7.4,
      1.1,
      0.9,
      "#9ad7ff",
      "04",
    );
    addPad(
      "quickstop",
      "quick stop counter",
      W - 0.6,
      1.0,
      10.55,
      0.9,
      1.1,
      "#ffc1f0",
      "05",
    );
    addPad("apples", "apple table", -12.2, 0.95, 7, 1.5, 2.3, "#c5ff8a", "06");
    let doorOpen = 0,
      doorTimer = 0;
    const beltOffset = { v: 0 };
    return {
      furniture,
      architecture,
      colliders: B.colliders,
      pads: B.pads,
      animated: B.animated,
      balls: B.balls,
      groundZones: B.groundZones,
      ground: { y: 0, name: "store floor" },
      bounds: {
        minX: -W,
        maxX: W,
        minZ: -D,
        maxZ: D,
        maxY: H,
        wallName: "store wall",
        ceilingName: "store ceiling",
      },
      spawn: new THREE.Vector3(cerealX, GH + 0.068, 3.4),
      spawnYaw: 0,
      spawnPadId: "shelf",
      targetPadId: "chest",
      update(time, dt = 0) {
        pulsePads(B.animated, time);
        // Conveyor belts roll toward the cashier.
        beltOffset.v = (beltOffset.v + dt * 0.35) % 1;
        beltTex.offset.y = -beltOffset.v;
        // Sliding doors open and close every few seconds.
        doorTimer += dt;
        const want = doorTimer % 9 < 4.5 ? 1 : 0;
        doorOpen += (want - doorOpen) * (1 - Math.exp(-3 * dt));
        for (const d of doors)
          d.position.x = d.userData.side * (1.25 + doorOpen * 2.25);
      },
    };
  },
};
