import { createRoom } from "../room.js?v=6";

/** The original living room, unchanged, now with land-anywhere floor and padded walls. */
export default {
  id: "living-room",
  name: "Living Room",
  short: "living room",
  tagline: "Dining table · couch arms · coffee table",
  icon: "🛋",
  heroTitle: "Cleared for<br /><em>the living room.</em>",
  objective: "YOUR FIRST FLIGHT · DINING TABLE → COUCH ARM",
  env: {
    background: "#c9dcd4",
    fog: [5, 15],
    hemi: ["#e4f6ff", "#b68b5d", 2.3],
    sun: {
      color: "#ffe7bc",
      intensity: 3.2,
      position: [-1.2, 3, -6],
      target: [-0.3, 0, 1.5],
      size: 5,
      far: 15,
    },
    far: 24,
    camera: {
      minX: -2.88,
      maxX: 2.88,
      minZ: -3.86,
      maxZ: 3.86,
      minY: 0.18,
      maxY: 2.55,
    },
  },
  create(scene) {
    const room = createRoom(scene);
    return {
      ...room,
      balls: [],
      groundZones: [{ name: "rug", x: 0.45, z: -0.45, w: 2.8, d: 2.5 }],
      ground: { y: 0, name: "floor" },
      bounds: {
        minX: -2.94,
        maxX: 2.94,
        minZ: -3.94,
        maxZ: 3.94,
        maxY: 2.64,
        wallName: "living room wall",
      },
      spawnYaw: 0,
      spawnPadId: "dining",
      targetPadId: "couch-far",
    };
  },
};
