import * as THREE from "../../vendor/three.module.js";
import {
  createBuilder,
  addSky,
  canvasTexture,
  pulsePads,
} from "./builder.js?v=7";

/** A huge sunny parking lot: rows of parked cars, a van, a box truck runway, poles and a store. */
export default {
  id: "parking-lot",
  name: "Parking Lot",
  short: "parking lot",
  tagline: "Car roofs · box truck · van · light poles",
  icon: "🚗",
  heroTitle: "Cleared for<br /><em>the parking lot.</em>",
  objective: "BIG LOT · BOX TRUCK → WHITE VAN ROOF",
  env: {
    background: "#bcdcef",
    fog: [35, 115],
    hemi: ["#e6f4ff", "#6d6a66", 1.9],
    sun: {
      color: "#fff0d0",
      intensity: 3.5,
      position: [10, 16, 8],
      size: 10,
      far: 45,
      follow: true,
    },
    far: 190,
    exposure: 1.1,
    camera: {
      minX: -23,
      maxX: 23,
      minZ: -24.5,
      maxZ: 27,
      minY: 0.12,
      maxY: 13,
    },
  },
  create(scene) {
    const B = createBuilder(scene);
    const { box, cylinder, sphere, mat, zone, addPad, architecture } = B;
    addSky(scene, 160, "#5aa4dc", "#eaf1ef");
    const asphalt = canvasTexture(
      256,
      256,
      (t, W, H) => {
        t.fillStyle = "#50545a";
        t.fillRect(0, 0, W, H);
        for (let i = 0; i < 2600; i++) {
          const v = 60 + Math.floor(Math.random() * 50);
          t.fillStyle = `rgb(${v},${v},${v + 4})`;
          t.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }
      },
      [40, 40],
    );
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      mat("#ffffff", { map: asphalt, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    architecture.add(ground);
    const paint = mat("#f4f1e6", { roughness: 0.9 }),
      yellow = mat("#f2c230", { roughness: 0.9 });
    const line = (w, d, x, z, m = paint) => {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.006, z);
      l.receiveShadow = true;
      architecture.add(l);
    };
    // Four rows of 12 stalls. Rows A/B back to back, then C/D.
    const STALL = 2.6,
      DEPTH = 5.2,
      x0 = -15.6;
    const rows = [
      { z: -15, flip: false },
      { z: -9.8, flip: true },
      { z: 2.6, flip: false },
      { z: 7.8, flip: true },
    ];
    for (const r of rows) {
      for (let i = 0; i <= 12; i++) line(0.12, DEPTH, x0 + i * STALL, r.z);
      zone("parking space", 0, r.z, 31.2, DEPTH);
    }
    line(31.2, 0.12, 0, -12.4, yellow);
    line(31.2, 0.12, 0, 5.2, yellow);
    for (let x = -14; x <= 14; x += 4) line(1.6, 0.14, x, -3.6, yellow);
    zone("driving aisle", 0, -3.6, 36, 7.2);
    // Painted helipad-style landing circle on the asphalt.
    const helipad = canvasTexture(256, 256, (t, W) => {
      t.strokeStyle = "#ffffff";
      t.lineWidth = 12;
      t.beginPath();
      t.arc(W / 2, W / 2, W / 2 - 14, 0, Math.PI * 2);
      t.stroke();
      t.fillStyle = "#ffffff";
      t.font = "bold 150px sans-serif";
      t.textAlign = "center";
      t.fillText("H", W / 2, W / 2 + 52);
    });
    const h = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshStandardMaterial({
        map: helipad,
        transparent: true,
        roughness: 0.9,
      }),
    );
    h.rotation.x = -Math.PI / 2;
    h.position.set(10, 0.007, 18);
    architecture.add(h);
    // Cars.
    const glass = mat("#26384a", { roughness: 0.2, metalness: 0.4 }),
      tire = mat("#1c1c1e"),
      chrome = mat("#d8dde2", { metalness: 0.7, roughness: 0.3 }),
      headlight = mat("#fff8d8", {
        emissive: "#ffeeb0",
        emissiveIntensity: 0.4,
      }),
      tail = mat("#d92a2a", { emissive: "#7a0e0e", emissiveIntensity: 0.4 });
    function wheels(x, z, halfW, offsets, r = 0.33, w = 0.24) {
      for (const dz of offsets)
        for (const side of [-1, 1]) {
          const wh = cylinder(r, r, w, x + side * halfW, r, z + dz, tire, {
            segments: 16,
          });
          wh.rotation.z = Math.PI / 2;
          B.addCollider(
            x + side * halfW - w / 2,
            0,
            z + dz - r,
            x + side * halfW + w / 2,
            r * 2,
            z + dz + r,
            "Tire",
            { landable: false },
          );
        }
    }
    function car(x, z, color, label, flip) {
      const body = mat(color, { roughness: 0.35, metalness: 0.25 });
      const f = flip ? 1 : -1; // front of the car points to -z when not flipped
      box(1.8, 0.62, 4.4, x, 0.62, z, body, { name: `${label}` });
      box(1.58, 0.5, 2.3, x, 1.18, z - f * 0.25, body, {
        name: `${label} roof`,
      });
      box(1.6, 0.3, 2.32, x, 1.13, z - f * 0.25, glass, { solid: false });
      for (const side of [-0.6, 0.6]) {
        box(0.32, 0.12, 0.04, x + side, 0.75, z + f * 2.2, headlight, {
          solid: false,
        });
        box(0.3, 0.12, 0.04, x + side, 0.78, z - f * 2.2, tail, {
          solid: false,
        });
      }
      box(1.84, 0.12, 0.12, x, 0.4, z + f * 2.2, chrome, { solid: false });
      wheels(x, z, 0.8, [-1.4, 1.4]);
    }
    function van(x, z, color, label, flip) {
      const body = mat(color, { roughness: 0.4 });
      const f = flip ? 1 : -1;
      box(2.0, 1.95, 4.2, x, 1.33, z - f * 0.4, body, {
        name: `${label} roof`,
        surfaceName: `${label.toLowerCase()} roof`,
      });
      box(2.0, 0.75, 0.9, x, 0.73, z + f * 2.1, body, {
        name: `${label} hood`,
      });
      box(2.02, 0.7, 0.04, x, 1.6, z + f * 1.72, glass, { solid: false });
      box(2.02, 0.5, 3.0, x, 1.75, z - f * 0.3, glass, { solid: false });
      box(2.04, 0.08, 4.0, x, 1.0, z - f * 0.4, mat("#3a7fd0"), {
        solid: false,
      });
      wheels(x, z, 0.9, [-1.6, 1.6], 0.36);
    }
    const colors = [
      ["#d9342b", "Red car"],
      ["#2f6dbf", "Blue car"],
      ["#f2c230", "Yellow car"],
      ["#f3f3f0", "White car"],
      ["#3c9a5f", "Green car"],
      ["#a9b0b8", "Silver car"],
      ["#ff8a3d", "Orange car"],
      ["#1f2c3a", "Black car"],
      ["#9b6bff", "Purple car"],
    ];
    const layout = [
      "c.c.cc.vc.c.",
      "cc.c.v..cc.c",
      ".c.cc.c..c.c",
      "c..c.c.cc..c",
    ];
    let k = 0;
    rows.forEach((r, ri) => {
      [...layout[ri]].forEach((ch, i) => {
        const x = x0 + STALL / 2 + i * STALL;
        if (ch === "c") {
          const [c, n] = colors[k++ % colors.length];
          car(x, r.z, c, n, r.flip);
        } else if (ch === "v") {
          van(
            x,
            r.z,
            ri === 1 ? "#f3f3f0" : "#5b8fd6",
            ri === 1 ? "White van" : "Blue van",
            r.flip,
          );
        }
      });
    });
    // Box truck parked in the open: a long flat roof, perfect runway.
    const truckX = -11,
      truckZ = 17;
    const cargo = mat("#dfe5ea"),
      cab = mat("#2f6dbf");
    box(2.5, 2.6, 6.2, truckX, 2.2, truckZ, cargo, { name: "Box truck" });
    const stripe = canvasTexture(512, 128, (t, W, H) => {
      t.fillStyle = "#f6f3ea";
      t.fillRect(0, 0, W, H);
      t.fillStyle = "#e8574b";
      t.fillRect(0, H * 0.62, W, H * 0.16);
      t.fillStyle = "#2f6dbf";
      t.font = "bold 58px sans-serif";
      t.fillText("TOY MOVERS", 30, 66);
    });
    for (const side of [-1, 1]) {
      const sign = box(
        0.02,
        2.2,
        5.8,
        truckX + side * 1.26,
        2.2,
        truckZ,
        mat("#ffffff", { map: stripe }),
        { solid: false },
      );
      sign.material = new THREE.MeshStandardMaterial({
        map: stripe,
        roughness: 0.6,
      });
    }
    box(2.3, 1.7, 1.8, truckX, 1.55, truckZ - 4.05, cab, { name: "Truck cab" });
    box(2.32, 0.7, 0.04, truckX, 1.95, truckZ - 4.96, glass, { solid: false });
    box(2.2, 0.7, 1.0, truckX, 1.05, truckZ - 5.4, cab, { name: "Truck hood" });
    box(2.0, 0.4, 7.5, truckX, 0.7, truckZ - 0.6, mat("#333"), {
      name: "Truck chassis",
      landable: false,
    });
    wheels(truckX, truckZ, 1.05, [-4.8, 1.2, 2.4], 0.5, 0.32);
    // Light poles with lamp heads you can (carefully) land on.
    const pole = mat("#8d949b", { metalness: 0.5, roughness: 0.5 });
    for (const [x, z] of [
      [-8, -12.4],
      [8, -12.4],
      [-8, 5.2],
      [8, 5.2],
      [18, 14],
    ]) {
      cylinder(0.1, 0.14, 7, x, 3.5, z, pole, {
        solid: true,
        name: "Light pole",
      });
      box(1.4, 0.2, 0.5, x, 7.1, z, pole, { name: "Lamp post top" });
      box(
        1.2,
        0.04,
        0.4,
        x,
        6.99,
        z,
        mat("#fff7d8", { emissive: "#ffe9a8", emissiveIntensity: 0.8 }),
        { solid: false },
      );
    }
    // Planter islands at the row ends, with curbs and trees.
    const curb = mat("#c9c6bd"),
      grassTop = mat("#6fa64c", { roughness: 1 }),
      bark = mat("#6b4a33"),
      leaves = mat("#4f8d3f");
    for (const [x, z] of [
      [-17.6, -12.4],
      [17.6, -12.4],
      [-17.6, 5.2],
      [17.6, 5.2],
    ]) {
      box(2.4, 0.15, 10.4, x, 0.075, z, curb, { name: "Planter curb" });
      box(2.2, 0.02, 10.2, x, 0.16, z, grassTop, { solid: false });
      cylinder(0.2, 0.26, 2.6, x, 1.45, z, bark, {
        solid: true,
        name: "Tree trunk",
      });
      for (let i = 0; i < 4; i++)
        sphere(
          1.1,
          x + Math.sin(i * 1.6) * 0.6,
          3.3 + (i % 2) * 0.5,
          z + Math.cos(i * 1.6) * 0.6,
          leaves,
        );
      B.addCollider(x - 1.6, 2.4, z - 1.6, x + 1.6, 4.5, z + 1.6, "Tree", {
        landable: false,
      });
    }
    // Store front with a sidewalk, sign and a flat awning.
    box(48, 7, 8, 0, 3.5, -29.5, mat("#e9e1d3"), { name: "Toy Mart" });
    const signTex = canvasTexture(512, 128, (t, W, H) => {
      t.fillStyle = "#e8574b";
      t.fillRect(0, 0, W, H);
      t.fillStyle = "#fff6d8";
      t.font = "bold 84px sans-serif";
      t.textAlign = "center";
      t.fillText("TOY MART", W / 2, 94);
    });
    box(
      12,
      3,
      0.1,
      0,
      5.4,
      -25.45,
      mat("#ffffff", {
        map: signTex,
        emissive: "#552222",
        emissiveIntensity: 0.2,
      }),
      { solid: false },
    );
    for (const x of [-14, -7, 7, 14])
      box(
        4.5,
        2.4,
        0.06,
        x,
        1.6,
        -25.47,
        mat("#9fd4e8", { emissive: "#4a8fa3", emissiveIntensity: 0.3 }),
        { solid: false },
      );
    box(3.2, 2.6, 0.06, 0, 1.3, -25.47, mat("#4b5a66"), { solid: false });
    box(44, 0.15, 3, 0, 0.075, -23.9, curb, { name: "Sidewalk" });
    box(30, 0.15, 2.2, 0, 3.3, -24.4, mat("#2a8c8a"), { name: "Store awning" });
    for (const x of [-14.5, -5, 5, 14.5])
      cylinder(0.07, 0.07, 3.1, x, 1.75, -23.4, pole, {
        solid: true,
        name: "Awning post",
      });
    // Shopping cart corral with two carts.
    const rail = mat("#c0392b", { metalness: 0.3 });
    for (const dx of [-0.65, 0.65])
      box(0.06, 1.0, 4.2, 4 + dx, 0.5, 16, rail, {
        name: "Cart corral",
        landable: false,
      });
    box(1.36, 1.0, 0.06, 4, 0.5, 18.1, rail, {
      name: "Cart corral",
      landable: false,
    });
    const wire = new THREE.MeshStandardMaterial({
      color: "#c7ccd2",
      wireframe: true,
      metalness: 0.5,
    });
    for (const z of [15.4, 16.6]) {
      box(0.55, 0.45, 0.95, 4, 0.75, z, wire, {
        name: "Shopping cart",
        landable: false,
      });
      box(0.5, 0.05, 0.9, 4, 0.22, z, wire, { solid: false });
    }
    // Traffic cones.
    const orange = mat("#ff7a1f");
    for (const [x, z] of [
      [-7.5, 13],
      [-7.5, 15.5],
      [-7.5, 18],
      [14, 12],
    ]) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.5, 14),
        orange,
      );
      cone.position.set(x, 0.25, z);
      cone.castShadow = true;
      B.furniture.add(cone);
      box(0.4, 0.03, 0.4, x, 0.015, z, orange, { solid: false });
      B.addCollider(
        x - 0.15,
        0,
        z - 0.15,
        x + 0.15,
        0.5,
        z + 0.15,
        "Traffic cone",
        { landable: false },
      );
    }
    addPad(
      "truck",
      "box truck roof",
      truckX,
      3.5,
      truckZ,
      2.5,
      6.2,
      "#ff7a4a",
      "01",
    );
    addPad(
      "van",
      "white van roof",
      x0 + STALL / 2 + 5 * STALL,
      2.305,
      -9.8 - 0.4,
      2.0,
      4.2,
      "#a4ffe1",
      "02",
    );
    addPad("helipad", "helipad", 10, 0, 18, 4, 4, "#ffe8b0", "03");
    addPad("awning", "store awning", 0, 3.375, -24.4, 30, 2.2, "#ffd0f0", "04");
    addPad(
      "cab",
      "truck cab",
      truckX,
      2.4,
      truckZ - 4.05,
      2.3,
      1.8,
      "#a4ffe1",
      "05",
    );
    return {
      furniture: B.furniture,
      architecture,
      colliders: B.colliders,
      pads: B.pads,
      animated: B.animated,
      balls: B.balls,
      groundZones: B.groundZones,
      ground: { y: 0, name: "asphalt" },
      bounds: {
        minX: -22,
        maxX: 22,
        minZ: -26,
        maxZ: 26,
        maxY: 12,
        soft: true,
      },
      spawn: new THREE.Vector3(truckX, 3.5 + 0.068, truckZ + 2.7),
      spawnYaw: 0,
      spawnPadId: "truck",
      targetPadId: "van",
      update(time) {
        pulsePads(B.animated, time);
      },
    };
  },
};
