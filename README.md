# ✈ ToyFlightSimulator

**A tiny airplane. A very big living room.** A colorful, single-player desktop Three.js flight playground for Nir’s little pilot. Take off from the dining table, weave around the furniture, and land on a couch arm. Built from replaceable primitives, not final art.

## Run

Use **Node.js 22.12+** (Node 24 recommended) and a current desktop browser with WebGL 2 / hardware acceleration.

```sh
npm install
npm run dev
```

Open the localhost address Vite prints (normally `http://localhost:5173`). Click **LET’S FLY** to capture the mouse. Internet is not needed after installation: no remote models, fonts or textures are fetched.

```sh
npm test          # deterministic flight / landing / collision / stick tests
npm run build    # production site in dist/
npm run preview  # serve the built site locally
```

This repository contains the game, not an automatically deployed hosted website. Deploy `dist/` to any static HTTPS host. Relative asset paths work with GitHub Pages subpaths too. Do not open `index.html` directly with `file://`.

## Controls

| Control | Action |
| --- | --- |
| **W** (hold) | Increase throttle |
| **S** (hold) | Reduce throttle; wheel brakes when grounded |
| **A / D** | Roll left / right; gentle steering on the ground |
| **Mouse toward you** (positive Y) | Pull back / nose up |
| **Mouse away from you** (negative Y) | Push forward / nose down |
| **Mouse left / right** | Yaw left / right |
| **G** | Toggle landing gear (animated; retraction is protected while grounded) |
| **F** | Toggle flaps: extra lift and drag, lower stall speed |
| **R** | Restart on the dining table, including from pause / crash |
| **Click game / LET’S FLY** | Capture mouse and resume |
| **Esc** | Release mouse and pause |
| **H / Flight school** | Replay or hide tutorial |
| **Enter / Skip** | Dismiss tutorial |

W/S is intentional: the original request mentioned A twice; A/D remains roll.

### Mouse / Thrustmaster recentering

A Thrustmaster **configured to emit mouse movement** works like the mouse (native joystick axes / WebHID are not implemented). Browsers cannot warp the real OS cursor to screen center. Instead this game uses the **Pointer Lock API** for unlimited relative `movementX/Y`, hiding the OS cursor while locked. Relative movement deflects a circular **virtual stick**, with a 5.5% deadzone. A light spring continuously centers it; **110 ms after movement pauses**, a stronger spring rapidly returns it to neutral. It never gets stuck at a screen edge. The reticle and amber pip show deflection.

Use small, repeated pushes to change attitude, not a permanently held mouse offset. Centering returns the *input* to neutral; aircraft attitude settles gradually. Pointer Lock needs a real click and localhost or HTTPS, and may be restricted inside embedded previews. Esc always releases the mouse. This build has not been validated on physical Thrustmaster hardware.

## Your first flight

1. Click LET’S FLY. Hold **W** and watch the airspeed.
2. At **0.85 m/s**, pull back a little. You’re airborne! **G** tucks in the wheels.
3. Make gentle turns using mouse yaw or **A/D** bank. Don’t hold full power forever — it’s a small room.
4. Find either **mint couch-arm pad**. The amber pads mark the table and coffee table. Radar shows your heading.
5. **F** lowers flaps. **G** lowers wheels. Ease off with **S**; aim for **0.8–1.2 m/s**.
6. Keep wings level, descend gently, touch wheels first, then **S** to stop. Raise the nose slightly to soften the touchdown.

Flight school appears on first load, progresses as you perform the actions, has manual Next / Skip buttons, and can be replayed with H. Tutorial completion is stored locally when available.

## Flight & crashes

World units are meters: a **0.32 m** plane in a **6 × 8 × 2.7 m** room. Arcade physics uses reduced effective gravity, speed / angle-of-attack lift, parasite and induced drag, bank-assisted turns, sideslip assistance, stalls, flaps, and gear drag. It is a playful approximation, not a real flight-training tool.

A clean landing needs a marked surface, gear **fully down**, bank under ~21°, a moderate nose angle, sink under **0.62 m/s**, and horizontal speed under **1.35 m/s** (1.55 with flaps). An extremely slow gear-up touchdown can scrape and survive. Hard belly landings, nose-ins, wingtip / furniture collisions, walls, ceiling and floor crash the plane. The near room wall is visually cut away, but still solid.

Crashes separate the fuselage, left wing, right wing, tail, propeller and three gear assemblies into tumbling debris, with orange fire particles, expanding smoke and a brief bright flash. The retry overlay waits a moment so the explosion is visible; **R** or **TRY AGAIN** resets an intact plane. No gore or real-world violence.

## Model swap hooks

Put assets in **`public/models/`**. All geometry should use **meters**, **+Y up**, plane **nose along -Z**, with origin at the center of gravity. The physics / collision shape remains independent from render meshes.

### Plane

`src/plane.js` exports `createPlane()`, `animatePlane()` and `loadPlaneModel()`:

```js
// In src/main.js, import loadPlaneModel and call after createPlane():
loadPlaneModel(plane, '/models/my-plane.glb', { scale: 1 })
  .catch(console.error);
```

The loader hides the primitive rig and shows your GLTF/GLB; it does **not** automatically bind its propeller, gear or flap bones. Adapt `animatePlane()` to your named model parts for those animations. The primitive semantic-part rig is retained as fallback crash debris; to break your custom model apart, populate `plane.pieces` with its named components and update the crash visual handling. Default groups: `Fuselage`, `LeftWing`, `RightWing`, `Tail`, `Propeller`, `Gear0..2`.

### Furniture

`src/room.js` returns `room.furniture`, `room.architecture`, **`room.colliders`**, **`room.pads`**, and `room.spawn`. `loadFurnitureModel(room, url, { scale: 1 })` replaces the entire primitive furniture visual group, while retaining the room shell and collision data. It also hides the old pad visuals, so recreate the pad decals in your model / a separate overlay group. Alternatively swap individual meshes inside `room.furniture` to preserve pad markers.

**Update collision boxes and pad bounds when changing furniture locations / sizes.** They are explicit world-space AABBs rather than automatically generated GLTF colliders. Pads specify `{ id, name, x, y, z, w, d }`, with `y` equal to the top surface. Architecture boundaries are in `physics.js`.

## File map

```text
index.html          HUD, menus, tutorial, keyboard help
src/main.js         Scene, lighting, fixed-step loop, chase camera, orchestration
src/plane.js        Primitive plane, animations, GLTF loader hook
src/room.js         Furniture, four pads, room, collision boxes, model hook
src/physics.js      Flight, ground handling, landing checks, collision probes
src/controls.js     Pointer lock, virtual stick, springs, key input
src/tutorial.js     Seven short, skippable takeoff / landing lessons
src/crash.js        Semantic-part debris, fire, smoke, light flash
src/ui.js           Live instruments, radar, messages, pause / crash menus
src/style.css       Responsive warm cockpit-style overlay
public/models/      Your future .glb / .gltf assets
tests/              Node built-in simulation and controls tests
vite.config.js      Relative base and vendor chunk
```

### Notes / limits

- Desktop keyboard + mouse only; no touch controls, audio, native gamepad mapping, or multiplayer yet.
- The chase camera is room-bounded, not a full furniture-occlusion camera.
- Collision detection uses small fixed steps and multiple body / wing probes, not mesh-level rigid-body physics. Decorative leaves / curtain folds are visual-only.
- Dependencies are pinned through `package-lock.json`; `node_modules/` and `dist/` stay out of git.
- Development builds expose `window.__toyFlight` for local model / physics inspection. Production builds omit it.
