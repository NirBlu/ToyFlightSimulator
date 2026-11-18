import * as THREE from "../../vendor/three.module.js";
import { createBuilder, canvasTexture, pulsePads } from "./builder.js?v=14";

/**
 * Apartment Lobby: a 14 × 18 m entrance hall with a 4.5 m ceiling.
 * A bank of three elevators (brushed-metal doors that open and close, floor
 * indicators, call buttons), a wall of brass mailboxes, a concierge desk
 * runway, a lounge with couch, armchairs and coffee table on a rug, side,
 * console and round tables, columns, potted plants, ceiling lights and glass
 * entrance doors. Mailbox doors are one InstancedMesh.
 */
const W = 7, // half width (x)
  D = 9, // half depth (z)
  H = 4.5; // ceiling
const DESK_TOP = 1.05;

export default {
  id: "apartment-lobby",
  name: "Apartment Lobby",
  short: "lobby",
  tagline: "Elevators · mailboxes · concierge desk",
  icon: "🛗",
  heroTitle: "Cleared for<br /><em>the lobby.</em>",
  objective: "GOING DOWN? · CONCIERGE DESK → COFFEE TABLE",
  env: {
    background: "#efe6d8",
    fog: [14, 34],
    hemi: ["#fff8ec", "#b49a7e", 2.2],
    sun: {
      // Warm overhead "ceiling lights" that follow the plane.
      color: "#fff1dc",
      intensity: 2.5,
      position: [2, 9, 3],
      size: 8,
      far: 22,
      follow: true,
    },
    far: 45,
    exposure: 1.08,
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
    const { box, cylinder, sphere, mat, zone, addPad, architecture, furniture } =
      B;
    const shell = { parent: architecture, solid: false };
    const deco = { solid: false };
    const deco0 = { solid: false, cast: false };

    /* ---------------- Shell: marble floor, walls, ceiling ---------------- */
    const marble = canvasTexture(
      256,
      256,
      (t, w, h) => {
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            t.fillStyle = (i + j) % 2 ? "#e9e2d6" : "#d9cfbf";
            t.fillRect(i * 128, j * 128, 128, 128);
          }
        t.strokeStyle = "#ffffff55";
        t.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          t.beginPath();
          t.moveTo((k * 53) % w, 0);
          t.bezierCurveTo(40 + k * 30, 80, 10 + k * 20, 170, (k * 71) % w, h);
          t.stroke();
        }
        t.fillStyle = "#b9ad9a";
        t.fillRect(0, 0, w, 2);
        t.fillRect(0, 0, 2, h);
        t.fillRect(0, 127, w, 2);
        t.fillRect(127, 0, 2, h);
      },
      [7, 9],
    );
    box(2 * W, 0.08, 2 * D, 0, -0.04, 0, mat("#ffffff", { map: marble, roughness: 0.35 }), shell);
    const plaster = mat("#f3e9d8");
    const wainscot = mat("#8a5a3c", { roughness: 0.6 });
    // Side walls with wood wainscoting.
    for (const s of [-1, 1]) {
      box(0.1, H, 2 * D, s * (W + 0.05), H / 2, 0, plaster, shell);
      box(0.04, 1.1, 2 * D, s * (W - 0.02), 0.55, 0, wainscot, shell);
      box(0.06, 0.05, 2 * D, s * (W - 0.03), 1.12, 0, mat("#c9a46a", { metalness: 0.5, roughness: 0.35 }), shell);
    }
    // Back wall (elevators) in darker stone, front wall with the entrance.
    box(2 * W, H, 0.1, 0, H / 2, -D - 0.05, mat("#cbbba4"), shell);
    box(2 * W, 0.12, 0.06, 0, 3.0, -D + 0.02, mat("#c9a46a", { metalness: 0.35, roughness: 0.35 }), shell);
    box(W - 1.6, H, 0.1, -(W + 1.6) / 2, H / 2, D + 0.05, plaster, shell);
    box(W - 1.6, H, 0.1, (W + 1.6) / 2, H / 2, D + 0.05, plaster, shell);
    box(3.2, H - 2.6, 0.1, 0, 2.6 + (H - 2.6) / 2, D + 0.05, plaster, shell);
    // Ceiling with a coffered border.
    box(2 * W, 0.06, 2 * D, 0, H + 0.03, 0, mat("#fbf6ee", { side: THREE.FrontSide }), shell);
    for (const x of [-3.5, 0, 3.5])
      box(0.18, 0.14, 2 * D, x, H - 0.07, 0, mat("#efe4d2"), { ...shell, cast: false });
    for (const z of [-4.5, 0, 4.5])
      box(2 * W, 0.14, 0.18, 0, H - 0.07, z, mat("#efe4d2"), { ...shell, cast: false });

    /* ---------------- Glass entrance doors (front wall, +z) ---------------- */
    const glass = new THREE.MeshStandardMaterial({
      color: "#bfe3f0",
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    });
    const doorFrame = mat("#2f2f33", { metalness: 0.6, roughness: 0.35 });
    const street = canvasTexture(64, 128, (t, w, h) => {
      const g = t.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#9fd0ee");
      g.addColorStop(0.6, "#e9f2f0");
      g.addColorStop(1, "#b9c2b0");
      t.fillStyle = g;
      t.fillRect(0, 0, w, h);
    });
    box(3.2, 2.6, 0.02, 0, 1.3, D + 0.12, mat("#ffffff", { map: street, emissive: "#dfeef2", emissiveIntensity: 0.55 }), { ...shell, cast: false });
    for (const s of [-1, 1]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.45, 0.03), glass);
      pane.position.set(s * 0.78, 1.25, D - 0.02);
      architecture.add(pane);
      box(0.06, 2.55, 0.08, s * 1.57, 1.28, D - 0.02, doorFrame, shell);
      box(0.04, 0.9, 0.06, s * 0.15, 1.1, D - 0.07, mat("#c9a46a", { metalness: 0.35, roughness: 0.3 }), deco);
    }
    box(3.2, 0.08, 0.08, 0, 2.58, D - 0.02, doorFrame, shell);
    box(0.06, 2.55, 0.08, 0, 1.28, D - 0.02, doorFrame, shell);
    const matTex = canvasTexture(256, 128, (t, w, h) => {
      t.fillStyle = "#3b2f2a";
      t.fillRect(0, 0, w, h);
      t.strokeStyle = "#c9a46a";
      t.lineWidth = 6;
      t.strokeRect(10, 10, w - 20, h - 20);
      t.fillStyle = "#c9a46a";
      t.font = "bold 34px serif";
      t.textAlign = "center";
      t.fillText("THE MAPLE", w / 2, 76);
    });
    const welcome = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), mat("#ffffff", { map: matTex, roughness: 1 }));
    welcome.rotation.x = -Math.PI / 2;
    welcome.position.set(0, 0.004, D - 1);
    welcome.receiveShadow = true;
    architecture.add(welcome);

    /* ---------------- Elevator bank (back wall, -z) ---------------- */
    const brushed = canvasTexture(
      128,
      256,
      (t, w, h) => {
        t.fillStyle = "#b9bcc0";
        t.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 2) {
          const v = 170 + ((y * 37) % 50);
          t.fillStyle = `rgba(${v},${v + 2},${v + 6},0.55)`;
          t.fillRect(0, y, w, 1);
        }
      },
    );
    const steel = mat("#ffffff", { map: brushed, metalness: 0.25, roughness: 0.38 });
    const frameMetal = mat("#c49a5a", { metalness: 0.35, roughness: 0.35 });
    const cabMat = mat("#f2d7a4", { emissive: "#f6dcae", emissiveIntensity: 0.45 });
    const elevators = [-3.2, 0, 3.2].map((x, i) => {
      // Lit cab behind the doors, door frame, indicator, call buttons.
      box(1.2, 2.25, 0.02, x, 1.125, -D + 0.01, cabMat, { ...shell, cast: false });
      box(0.12, 2.45, 0.1, x - 0.66, 1.225, -D + 0.05, frameMetal, shell);
      box(0.12, 2.45, 0.1, x + 0.66, 1.225, -D + 0.05, frameMetal, shell);
      box(1.44, 0.14, 0.1, x, 2.4, -D + 0.05, frameMetal, shell);
      const doors = [-1, 1].map((s) => {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.3, 0.04), steel);
        d.position.set(x + s * 0.3, 1.15, -D + 0.05);
        d.castShadow = false;
        d.receiveShadow = true;
        d.userData.side = s;
        architecture.add(d);
        return d;
      });
      // Floor indicator: a little screen with the floor number and arrow.
      const canvasInfo = { floor: 1 + i * 3, dir: 0 };
      const tex = canvasTexture(128, 48, (t, w, h) => drawIndicator(t, w, h, canvasInfo));
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.19),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      );
      screen.position.set(x, 2.68, -D + 0.03);
      architecture.add(screen);
      box(0.6, 0.27, 0.02, x, 2.68, -D + 0.005, mat("#1d1d22"), { ...shell, cast: false });
      // Call buttons on a brass plate to the right of each door.
      box(0.12, 0.3, 0.025, x + 0.95, 1.15, -D + 0.012, frameMetal, deco0);
      const lit = new THREE.MeshStandardMaterial({ color: "#fff2c4", emissive: "#ffb43a", emissiveIntensity: 0 });
      const buttons = [1.22, 1.08].map((y) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), lit);
        b.rotation.x = Math.PI / 2;
        b.position.set(x + 0.95, y, -D + 0.03);
        architecture.add(b);
        return b;
      });
      return {
        doors,
        tex,
        info: canvasInfo,
        lit,
        buttons,
        open: 0,
        // Staggered cycles so the three cars are never in sync.
        t: i * 4.3,
        period: 13 + i * 2.2,
        x,
      };
    });
    // Brass "ELEVATORS" sign and a waiting bench in front of the bank.
    const signTex = canvasTexture(256, 48, (t, w, h) => {
      t.fillStyle = "#2a2622";
      t.fillRect(0, 0, w, h);
      t.fillStyle = "#e3c27f";
      t.font = "bold 30px sans-serif";
      t.textAlign = "center";
      t.fillText("ELEVATORS", w / 2, 33);
    });
    box(2.2, 0.36, 0.04, 0, 3.4, -D + 0.03, new THREE.MeshBasicMaterial({ map: signTex }), { ...shell, cast: false });
    const benchWood = mat("#6f4a32", { roughness: 0.55 });
    box(2.4, 0.08, 0.5, 0, 0.46, -6.2, benchWood, { name: "Elevator bench" });
    for (const s of [-1, 1])
      box(0.08, 0.42, 0.44, s * 1.1, 0.21, -6.2, mat("#2f2f33", { metalness: 0.5 }), { name: "Bench leg", landable: false });
    // Brass standing ashtray / planter pair by the bench.
    for (const s of [-1, 1]) {
      cylinder(0.24, 0.2, 0.7, s * 1.9, 0.35, -6.2, mat("#c9a46a", { metalness: 0.35, roughness: 0.35 }), { solid: true, name: "Brass planter" });
      sphere(0.32, s * 1.9, 0.95, -6.2, mat("#4f8f4a"), { solid: true, name: "Plant", landable: false });
    }

    /* ---------------- Mailbox wall (west wall, -x) ---------------- */
    const MB = { x: -W + 0.25, z0: -3.4, z1: 0.6, y0: 0.35, y1: 2.05 };
    const cabinet = mat("#5a3b28", { roughness: 0.5 });
    box(0.5, MB.y1 - 0 + 0.05, MB.z1 - MB.z0 + 0.1, MB.x, (MB.y1 + 0.05) / 2, (MB.z0 + MB.z1) / 2, cabinet, { name: "Mailboxes" });
    const cols = 14,
      rows = 7;
    const dz = (MB.z1 - MB.z0) / cols,
      dy = (MB.y1 - MB.y0) / rows;
    const brass = new THREE.MeshStandardMaterial({ color: "#e2b862", metalness: 0.3, roughness: 0.35 });
    const doorGeo = new THREE.BoxGeometry(0.02, dy * 0.82, dz * 0.84);
    const lockGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8);
    lockGeo.rotateZ(Math.PI / 2);
    const labelGeo = new THREE.BoxGeometry(0.006, dy * 0.12, dz * 0.42);
    const doorsMesh = new THREE.InstancedMesh(doorGeo, brass, cols * rows);
    const locks = new THREE.InstancedMesh(lockGeo, new THREE.MeshStandardMaterial({ color: "#3a3026", metalness: 0.6, roughness: 0.4 }), cols * rows);
    const labels = new THREE.InstancedMesh(labelGeo, new THREE.MeshStandardMaterial({ color: "#f7f1e2", roughness: 0.9 }), cols * rows);
    const m4 = new THREE.Matrix4();
    let n = 0;
    const faceX = MB.x + 0.25;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const y = MB.y0 + (r + 0.5) * dy,
          z = MB.z0 + (c + 0.5) * dz;
        m4.makeTranslation(faceX + 0.01, y, z);
        doorsMesh.setMatrixAt(n, m4);
        m4.makeTranslation(faceX + 0.026, y - dy * 0.12, z + dz * 0.26);
        locks.setMatrixAt(n, m4);
        m4.makeTranslation(faceX + 0.022, y + dy * 0.22, z - dz * 0.05);
        labels.setMatrixAt(n, m4);
        n++;
      }
    for (const im of [doorsMesh, locks, labels]) {
      im.castShadow = false;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      furniture.add(im);
    }
    // Parcel shelf / out-going mail slot below the boxes.
    box(0.06, 0.2, MB.z1 - MB.z0, faceX + 0.02, 0.2, (MB.z0 + MB.z1) / 2, mat("#c9a46a", { metalness: 0.35, roughness: 0.35 }), deco);
    const mailSign = canvasTexture(256, 48, (t, w, h) => {
      t.fillStyle = "#e3c27f";
      t.fillRect(0, 0, w, h);
      t.fillStyle = "#2a2622";
      t.font = "bold 30px sans-serif";
      t.textAlign = "center";
      t.fillText("MAIL", w / 2, 33);
    });
    const ms = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.26), new THREE.MeshBasicMaterial({ map: mailSign }));
    ms.rotation.y = Math.PI / 2;
    ms.position.set(-W + 0.01, 2.45, (MB.z0 + MB.z1) / 2);
    architecture.add(ms);
    // A stack of parcels waiting on the floor.
    const cardboard = mat("#c49a6c");
    box(0.5, 0.32, 0.4, -W + 0.85, 0.16, 1.4, cardboard, { name: "Parcel" });
    box(0.36, 0.24, 0.3, -W + 0.85, 0.44, 1.38, cardboard, { name: "Parcel" });

    /* ---------------- Concierge desk (spawn runway, east side) ---------------- */
    const deskWood = mat("#6b4430", { roughness: 0.45 });
    const deskTop = mat("#efe9df", { roughness: 0.3 });
    const DX = 4.6,
      DZ0 = 0.6,
      DZ1 = 5.2;
    box(0.82, DESK_TOP - 0.04, DZ1 - DZ0, DX, (DESK_TOP - 0.04) / 2, (DZ0 + DZ1) / 2, deskWood, { name: "Concierge desk base", landable: false });
    box(0.92, 0.04, DZ1 - DZ0 + 0.1, DX, DESK_TOP - 0.02, (DZ0 + DZ1) / 2, deskTop, { name: "Concierge desk" });
    for (let z = DZ0 + 0.4; z < DZ1 - 0.2; z += 0.6)
      box(0.02, 0.6, 0.04, DX - 0.42, 0.5, z, mat("#c9a46a", { metalness: 0.35, roughness: 0.35 }), deco);
    // Staff side: low back counter with a monitor, a chair and a bell.
    box(0.5, 0.75, 2.0, DX + 1.35, 0.375, 3.0, deskWood, { name: "Back counter" });
    box(0.06, 0.32, 0.5, DX + 1.35, 0.95, 3.0, mat("#1d1d22"), { name: "Monitor", landable: false });
    box(0.04, 0.26, 0.44, DX + 1.31, 0.95, 3.0, mat("#2f6fa8", { emissive: "#2f6fa8", emissiveIntensity: 0.6 }), deco0);
    box(0.5, 0.08, 0.5, DX + 0.85, 0.48, 3.6, mat("#2b2b30"), { name: "Desk chair" });
    box(0.08, 0.5, 0.5, DX + 1.08, 0.76, 3.6, mat("#2b2b30"), { name: "Desk chair", landable: false });
    cylinder(0.04, 0.04, 0.42, DX + 0.85, 0.22, 3.6, mat("#555"), deco);
    box(0.24, 0.02, 0.3, DX + 1.35, 0.76, 2.4, mat("#f7f1e2"), deco); // guest book

    /* ---------------- Lounge: rug, couch, armchairs, coffee table ---------------- */
    const rugTex = canvasTexture(256, 256, (t, w, h) => {
      t.fillStyle = "#8c3b34";
      t.fillRect(0, 0, w, h);
      t.strokeStyle = "#e3c27f";
      t.lineWidth = 8;
      t.strokeRect(14, 14, w - 28, h - 28);
      t.lineWidth = 3;
      t.strokeRect(32, 32, w - 64, h - 64);
      t.fillStyle = "#d9a65e";
      t.beginPath();
      t.ellipse(w / 2, h / 2, 54, 80, 0, 0, Math.PI * 2);
      t.fill();
      t.fillStyle = "#8c3b34";
      t.beginPath();
      t.ellipse(w / 2, h / 2, 36, 60, 0, 0, Math.PI * 2);
      t.fill();
    });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.2), mat("#ffffff", { map: rugTex, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-2.6, 0.006, 4.4);
    rug.receiveShadow = true;
    furniture.add(rug);
    const velvet = mat("#2f5d62", { roughness: 0.85 });
    const cushion = mat("#3b7177", { roughness: 0.9 });
    // Couch along x = -4.35, facing +x (back toward the mailbox wall side).
    const CX = -4.35,
      CZ = 4.4;
    box(0.9, 0.42, 2.4, CX, 0.21, CZ, velvet, { name: "Couch seat" });
    box(0.22, 0.85, 2.4, CX - 0.34, 0.425, CZ, velvet, { name: "Couch back" });
    for (const s of [-1, 1])
      box(0.9, 0.62, 0.2, CX, 0.31, CZ + s * 1.3, velvet, { name: "Couch arm" });
    for (const s of [-1, 1])
      box(0.62, 0.1, 1.1, CX + 0.06, 0.47, CZ + s * 0.56, cushion, deco);
    box(0.14, 0.34, 0.34, CX - 0.16, 0.62, CZ - 0.75, mat("#e3c27f"), deco);
    box(0.14, 0.34, 0.34, CX - 0.16, 0.62, CZ + 0.75, mat("#e3c27f"), deco);
    // Coffee table (target).
    const walnut = mat("#5c3a26", { roughness: 0.4 });
    box(0.8, 0.05, 1.4, -2.65, 0.445, CZ, walnut, { name: "Coffee table" });
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
      box(0.05, 0.42, 0.05, -2.65 + sx * 0.34, 0.21, CZ + sz * 0.64, mat("#c9a46a", { metalness: 0.35, roughness: 0.35 }), { name: "Table leg", landable: false });
    box(0.22, 0.03, 0.3, -2.5, 0.485, CZ + 0.45, mat("#2f6fa8"), deco0); // magazine
    // Armchairs facing the couch.
    const leather = mat("#a0623a", { roughness: 0.6 });
    const armchair = (z) => {
      box(0.8, 0.42, 0.8, -1.0, 0.21, z, leather, { name: "Armchair seat" });
      box(0.2, 0.85, 0.8, -0.7, 0.425, z, leather, { name: "Armchair back" });
      for (const s of [-1, 1])
        box(0.8, 0.6, 0.14, -1.0, 0.3, z + s * 0.44, leather, { name: "Armchair arm" });
    };
    armchair(3.5);
    armchair(5.3);
    // Side tables by the couch with lamps.
    for (const s of [-1, 1]) {
      const z = CZ + s * 1.75;
      box(0.5, 0.56, 0.5, CX, 0.28, z, walnut, { name: "Side table" });
      cylinder(0.08, 0.1, 0.3, CX, 0.71, z, mat("#c9a46a", { metalness: 0.35, roughness: 0.35 }), deco);
      cylinder(0.14, 0.2, 0.24, CX, 0.98, z, mat("#fff4dc", { emissive: "#ffd9a0", emissiveIntensity: 0.55 }), { solid: true, name: "Lamp", landable: false });
    }

    /* ---------------- Random tables ---------------- */
    // Console table against the east wall, between desk and elevators, with a vase.
    const CTX = W - 0.3,
      CTZ = -3.4;
    box(0.45, 0.05, 1.8, CTX, 0.85, CTZ, walnut, { name: "Console table" });
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
      box(0.04, 0.82, 0.04, CTX + sx * 0.18, 0.41, CTZ + sz * 0.85, mat("#2f2f33", { metalness: 0.5 }), { name: "Table leg", landable: false });
    cylinder(0.07, 0.1, 0.36, CTX, 1.055, CTZ - 0.6, mat("#2f6fa8", { roughness: 0.2 }), { solid: true, name: "Vase", landable: false });
    for (let i = 0; i < 5; i++)
      sphere(0.06, CTX + Math.sin(i * 2.4) * 0.08, 1.3 + (i % 2) * 0.06, CTZ - 0.6 + Math.cos(i * 2.4) * 0.08, mat(["#f6c445", "#ef7d57", "#ffffff"][i % 3]), deco);
    // Round table with two chairs (west of center).
    const RX = -2.2,
      RZ = -2.6;
    cylinder(0.55, 0.55, 0.05, RX, 0.75, RZ, mat("#efe9df", { roughness: 0.3 }), { solid: true, name: "Round table", segments: 32 });
    cylinder(0.05, 0.05, 0.72, RX, 0.36, RZ, mat("#2f2f33", { metalness: 0.5 }), deco);
    cylinder(0.25, 0.25, 0.03, RX, 0.015, RZ, mat("#2f2f33", { metalness: 0.5 }), deco);
    for (const s of [-1, 1]) {
      box(0.42, 0.05, 0.42, RX + s * 0.85, 0.46, RZ, mat("#c9a46a", { metalness: 0.4, roughness: 0.5 }), { name: "Bistro chair" });
      box(0.05, 0.45, 0.42, RX + s * 1.04, 0.7, RZ, mat("#c9a46a", { metalness: 0.4, roughness: 0.5 }), { name: "Bistro chair back", landable: false });
    }
    // A fruit bowl on the round table.
    cylinder(0.14, 0.09, 0.07, RX, 0.81, RZ, mat("#ffffff"), deco);
    for (let i = 0; i < 4; i++) sphere(0.045, RX + Math.cos(i * 1.6) * 0.06, 0.87, RZ + Math.sin(i * 1.6) * 0.06, mat(i % 2 ? "#e8443a" : "#f6a623"), deco);
    // Small high table by the entrance with a package drop box.
    box(0.6, 0.04, 0.6, 2.6, 1.0, 6.9, walnut, { name: "Tall table" });
    cylinder(0.04, 0.04, 0.98, 2.6, 0.49, 6.9, mat("#2f2f33", { metalness: 0.5 }), deco);
    // Low bench-table under the mail sign side.
    box(1.0, 0.05, 0.5, -4.6, 0.5, -5.7, walnut, { name: "Low table" });
    for (const s of [-1, 1]) box(0.05, 0.47, 0.45, -4.6 + s * 0.45, 0.24, -5.7, walnut, { name: "Table leg", landable: false });

    /* ---------------- Columns, plants, lights ---------------- */
    const stone = mat("#e2d6c2", { roughness: 0.4 });
    for (const [x, z] of [[-3.6, -0.6], [1.6, -0.6], [-3.6, 7.2], [1.6, 7.2]]) {
      box(0.6, H, 0.6, x, H / 2, z, stone, { name: "Column" });
      box(0.72, 0.18, 0.72, x, 0.09, z, mat("#c9a46a", { metalness: 0.5, roughness: 0.4 }), deco);
      box(0.72, 0.18, 0.72, x, H - 0.09, z, stone, deco);
    }
    const pot = mat("#3a3530", { roughness: 0.5 });
    const leaf = mat("#4f8f4a");
    for (const [x, z, s] of [[-W + 0.6, D - 0.7, 1.1], [W - 0.6, D - 0.7, 1.1], [W - 0.6, -D + 0.7, 1], [-W + 0.6, -D + 0.7, 1], [-1.9, 6.9, 0.8]]) {
      cylinder(0.26 * s, 0.2 * s, 0.5 * s, x, 0.25 * s, z, pot, { solid: true, name: "Plant pot" });
      sphere(0.42 * s, x, 0.5 * s + 0.4 * s, z, leaf, { solid: true, name: "Plant", landable: false });
      sphere(0.3 * s, x + 0.12, 0.5 * s + 0.8 * s, z - 0.06, mat("#5fa75a"), deco);
    }
    const glow = new THREE.MeshStandardMaterial({ color: "#fff6e0", emissive: "#ffe6b8", emissiveIntensity: 1.1 });
    for (const x of [-5.25, -1.75, 1.75, 5.25])
      for (const z of [-6.75, -2.25, 2.25, 6.75]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20), glow);
        l.position.set(x, H - 0.02, z);
        architecture.add(l);
      }
    // A brass chandelier over the lounge (hangs high: decorative only).
    cylinder(0.01, 0.01, 0.6, -2.6, H - 0.3, 4.4, frameMetal, deco0);
    cylinder(0.5, 0.35, 0.12, -2.6, H - 0.66, 4.4, frameMetal, deco0);
    for (let i = 0; i < 8; i++)
      sphere(0.07, -2.6 + Math.cos((i * Math.PI) / 4) * 0.5, H - 0.58, 4.4 + Math.sin((i * Math.PI) / 4) * 0.5, glow, deco0);
    // Framed art over the couch-side wall.
    const art = canvasTexture(128, 96, (t, w, h) => {
      t.fillStyle = "#f3d9a6";
      t.fillRect(0, 0, w, h);
      t.fillStyle = "#2f6fa8";
      t.beginPath();
      t.arc(40, 50, 26, 0, Math.PI * 2);
      t.fill();
      t.fillStyle = "#ef7d57";
      t.fillRect(70, 20, 40, 56);
    });
    box(0.04, 1.0, 1.4, -W + 0.03, 2.1, 4.4, mat("#ffffff", { map: art }), { ...shell, cast: false });
    box(0.03, 1.1, 1.5, -W + 0.015, 2.1, 4.4, frameMetal, { ...shell, cast: false });

    /* ---------------- Named areas and suggested landing spots ---------------- */
    zone("lobby floor", 0, 0, 2 * W, 2 * D);
    zone("rug", -2.6, 4.4, 3.6, 4.2);
    zone("entrance mat", 0, D - 1, 2.6, 1.3);
    zone("elevator landing", 0, -7.4, 10, 3);
    addPad("desk", "concierge desk", DX, DESK_TOP, (DZ0 + DZ1) / 2, 0.92, DZ1 - DZ0 + 0.1, "#ffd84a", "01");
    addPad("coffee", "coffee table", -2.65, 0.47, CZ, 0.8, 1.4, "#a4ffe1", "02");
    addPad("mailboxes", "top of the mailboxes", MB.x, MB.y1 + 0.05, (MB.z0 + MB.z1) / 2, 0.5, MB.z1 - MB.z0 + 0.1, "#ffc1f0", "03");
    addPad("console", "console table", CTX, 0.875, CTZ + 0.25, 0.45, 1.3, "#9ad7ff", "04");
    addPad("bench", "elevator bench", 0, 0.5, -6.2, 2.4, 0.5, "#ff9d7a", "05");
    addPad("round", "round table", RX, 0.775, RZ, 0.78, 0.78, "#c5ff8a", "06");

    return {
      furniture,
      architecture,
      colliders: B.colliders,
      pads: B.pads,
      animated: B.animated,
      balls: B.balls,
      groundZones: B.groundZones,
      ground: { y: 0, name: "lobby floor" },
      bounds: {
        minX: -W,
        maxX: W,
        minZ: -D,
        maxZ: D,
        maxY: H,
        wallName: "lobby wall",
        ceilingName: "lobby ceiling",
      },
      elevators,
      spawn: new THREE.Vector3(DX, DESK_TOP + 0.068, DZ1 - 0.35),
      spawnYaw: 0,
      spawnPadId: "desk",
      targetPadId: "coffee",
      update(time, dt = 0) {
        pulsePads(B.animated, time);
        for (const e of elevators) {
          // Cycle: arrive (counting down to lobby), open, wait, close, leave.
          e.t += dt;
          const c = e.t % e.period;
          const arriving = c < 4;
          const open = c >= 4 && c < 9;
          e.open += ((open ? 1 : 0) - e.open) * (1 - Math.exp(-3 * dt));
          // Each panel slides into the frame (shrinks toward its side).
          const w = Math.max(0.04, 1 - e.open * 0.94);
          for (const d of e.doors) {
            d.scale.x = w;
            d.position.x = e.x + d.userData.side * (0.6 - 0.3 * w);
          }
          e.lit.emissiveIntensity = arriving ? 0.9 + 0.3 * Math.sin(time * 6) : 0;
          const floor = arriving
            ? Math.max(1, 5 - Math.floor(c))
            : open
              ? 1
              : Math.min(12, 1 + Math.floor((c - 9) * 1.2));
          const dir = arriving ? -1 : open ? 0 : 1;
          if (floor !== e.info.floor || dir !== e.info.dir) {
            e.info.floor = floor;
            e.info.dir = dir;
            const img = e.tex.image;
            if (img?.getContext) {
              drawIndicator(img.getContext("2d"), img.width, img.height, e.info);
              e.tex.needsUpdate = true;
            }
          }
        }
      },
    };
  },
};

function drawIndicator(t, w, h, info) {
  t.fillStyle = "#120d08";
  t.fillRect(0, 0, w, h);
  t.fillStyle = "#ffb43a";
  t.font = "bold 34px monospace";
  t.textAlign = "center";
  t.fillText(info.floor === 1 ? "L" : String(info.floor), w / 2 + 14, 36);
  if (info.dir) {
    t.beginPath();
    const x = 28,
      y = h / 2;
    if (info.dir > 0) {
      t.moveTo(x, y - 12);
      t.lineTo(x + 12, y + 8);
      t.lineTo(x - 12, y + 8);
    } else {
      t.moveTo(x, y + 12);
      t.lineTo(x + 12, y - 8);
      t.lineTo(x - 12, y - 8);
    }
    t.fill();
  }
}
