import * as THREE from "../../vendor/three.module.js";
import { createBall } from "../balls.js?v=6";

/**
 * Shared helpers for building levels out of primitives.
 * All units are meters, +Y up. Colliders are axis-aligned boxes
 * { min, max, name, landable? }. Any collider top at least 10 cm wide
 * is automatically a landing surface unless `landable: false`.
 */
export function createBuilder(scene) {
  const furniture = new THREE.Group();
  furniture.name = "FurnitureModelHook";
  const architecture = new THREE.Group();
  architecture.name = "RoomShell";
  scene.add(furniture, architecture);
  const colliders = [],
    pads = [],
    animated = [],
    balls = [],
    groundZones = [];
  const materials = new Map();
  const mat = (color, extra = {}) => {
    const key =
      color +
      Object.entries(extra)
        .map(([k, v]) => `${k}:${v && v.isTexture ? v.uuid : String(v)}`)
        .join(",");
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }),
      );
    return materials.get(key);
  };
  const shadow = (m, cast = true) => {
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  function addCollider(minX, minY, minZ, maxX, maxY, maxZ, name, opts = {}) {
    const c = {
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ),
      name,
      ...opts,
    };
    colliders.push(c);
    return c;
  }
  /** Box centered at (x,y,z). rotY must be 0 or ±π/2 for solid boxes. */
  function box(w, h, d, x, y, z, material, opts = {}) {
    const {
      parent = furniture,
      solid = true,
      name = "Furniture",
      rotY = 0,
      landable,
      cast = true,
      surfaceName,
    } = opts;
    const m = shadow(
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material),
      cast,
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    parent.add(m);
    if (solid) {
      const swap = Math.abs(Math.sin(rotY)) > 0.7;
      const hw = (swap ? d : w) / 2,
        hd = (swap ? w : d) / 2;
      const extra = {};
      if (landable !== undefined) extra.landable = landable;
      if (surfaceName) extra.surfaceName = surfaceName;
      addCollider(
        x - hw,
        y - h / 2,
        z - hd,
        x + hw,
        y + h / 2,
        z + hd,
        name,
        extra,
      );
    }
    return m;
  }
  function cylinder(r1, r2, h, x, y, z, material, opts = {}) {
    const {
      parent = furniture,
      solid = false,
      name = "Post",
      segments = 20,
      landable,
    } = opts;
    const m = shadow(
      new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, segments), material),
    );
    m.position.set(x, y, z);
    parent.add(m);
    if (solid) {
      const r = Math.max(r1, r2);
      const extra = landable !== undefined ? { landable } : {};
      addCollider(
        x - r,
        y - h / 2,
        z - r,
        x + r,
        y + h / 2,
        z + r,
        name,
        extra,
      );
    }
    return m;
  }
  function sphere(r, x, y, z, material, opts = {}) {
    const { parent = furniture, solid = false, name = "Bush", landable } = opts;
    const m = shadow(
      new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), material),
    );
    m.position.set(x, y, z);
    parent.add(m);
    if (solid) {
      const k = r * 0.8;
      const extra = landable !== undefined ? { landable } : {};
      addCollider(x - k, y - k, z - k, x + k, y + k, z + k, name, extra);
    }
    return m;
  }
  /** A named flat area on the ground (patio, driveway...) used only to name landings. */
  function zone(name, x, z, w, d) {
    groundZones.push({ name, x, z, w, d });
  }
  /** A suggested landing spot with a glowing decal. y is the top of the surface. */
  function addPad(id, name, x, y, z, w, d, color, number) {
    const pad = { id, name, x, y, z, w, d };
    pads.push(pad);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(
        Math.max(0.05, w - 0.035),
        Math.max(0.05, d - 0.035),
      ),
      new THREE.MeshBasicMaterial({
        map: padTexture(color, number, w, d),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, y + 0.004, z);
    plane.renderOrder = 2;
    furniture.add(plane);
    animated.push(plane);
    return pad;
  }
  /** A dynamic ball. Pattern makes rolling visible. */
  function ball(radius, x, z, colors, opts = {}) {
    const { y = radius, bounce = 0.6, name = "ball", stripes = 6 } = opts;
    const m = shadow(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius, 28, 18),
        new THREE.MeshStandardMaterial({
          map: ballTexture(colors, stripes),
          roughness: 0.45,
        }),
      ),
    );
    m.position.set(x, y, z);
    m.name = "Ball";
    furniture.add(m);
    const b = createBall({
      radius,
      position: new THREE.Vector3(x, y, z),
      bounce,
      name,
      mesh: m,
    });
    balls.push(b);
    return b;
  }
  return {
    THREE,
    scene,
    furniture,
    architecture,
    colliders,
    pads,
    animated,
    balls,
    groundZones,
    mat,
    box,
    cylinder,
    sphere,
    zone,
    addPad,
    addCollider,
    ball,
    canvasTexture,
  };
}

export function canvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 4;
  }
  return t;
}
function padTexture(color, number, w, d) {
  const tall = d >= w;
  return canvasTexture(tall ? 256 : 512, tall ? 512 : 256, (t, W, H) => {
    t.fillStyle = color;
    t.globalAlpha = 0.16;
    t.fillRect(0, 0, W, H);
    t.globalAlpha = 1;
    t.strokeStyle = color;
    t.lineWidth = 6;
    t.setLineDash([20, 14]);
    t.strokeRect(13, 13, W - 26, H - 26);
    t.setLineDash([]);
    t.lineWidth = 4;
    t.beginPath();
    t.arc(W / 2, H / 2, 57, 0, Math.PI * 2);
    t.stroke();
    t.fillStyle = color;
    t.font = "bold 48px sans-serif";
    t.textAlign = "center";
    t.fillText(number, W / 2, H / 2 + 16);
  });
}
function ballTexture(colors, stripes) {
  return canvasTexture(256, 128, (t, W, H) => {
    const band = W / stripes;
    for (let i = 0; i < stripes; i++) {
      t.fillStyle = colors[i % colors.length];
      t.fillRect(i * band, 0, band + 1, H);
    }
    t.fillStyle = "#ffffff";
    t.beginPath();
    t.arc(W * 0.25, H * 0.12, 9, 0, Math.PI * 2);
    t.arc(W * 0.75, H * 0.88, 9, 0, Math.PI * 2);
    t.fill();
  });
}

/** Big sky dome with a soft gradient. Ignores fog so it always reads as sky. */
export function addSky(scene, radius, top = "#6fb6e6", horizon = "#e6f2ee") {
  const tex = canvasTexture(4, 256, (t, W, H) => {
    const g = t.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.55, horizon);
    g.addColorStop(1, horizon);
    t.fillStyle = g;
    t.fillRect(0, 0, W, H);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  sky.name = "Sky";
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}

/** Pulse the glowing pad decals. */
export function pulsePads(animated, time) {
  animated.forEach((m, i) => {
    m.material.opacity = 0.75 + Math.sin(time * 1.8 + i) * 0.17;
  });
}
