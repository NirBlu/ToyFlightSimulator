# ✈ ToyFlightSimulator

**A tiny airplane. Big places to explore.** A colorful, single-player desktop Three.js flight playground for Nir’s little pilot. Pick a level, take off from a table, a bed or a box-truck roof, and land on anything flat. Built from replaceable primitives, not final art.

## Run

You need a current desktop browser with WebGL 2 / hardware acceleration. Pick **either** way:

**No install (plain static server).** Three.js is vendored in `vendor/`, so any static server works. From the folder that contains `index.html`:

```sh
python -m http.server 8000     # or: python3 -m http.server 8000
```

Then open `http://localhost:8000`.

**With Vite (nicer dev server).** Needs Node.js 22.12+ (Node 24 recommended):

```sh
npm install
npm run dev
```

Open the localhost address Vite prints (normally `http://localhost:5173`). Click **LET’S FLY** to capture the mouse. Internet is not needed: no remote models, fonts or textures are fetched.

```sh
npm test          # flight / landing / damage / balls / levels / import-safety tests
npm run build     # production site in dist/
npm run preview   # serve the built site locally
```

Do not open `index.html` directly with `file://` (browsers block modules there). After `git pull`, hard-refresh (**Ctrl+Shift+R**) so the browser does not keep old files. Game modules carry a `?v=N` cache-bust that matches `index.html`; bump it in every `src` import when you change code (the `imports` test checks they match).

## Levels

Pick a level on the start / pause menu (click a card or press **1–4**). Press **L** at any time (flying, paused or after a crash) to come back to the level picker. The last level you chose is remembered; `?level=toy-room` in the URL also works.

| #   | Level           | What’s there                                                                                                                                                                                                                                                |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Living Room** | The original 6 × 8 m room: dining-table runway, couch arms, coffee table, bookcase, TV. Walls are padded now (bumps = damage) and the floor is landable.                                                                                                    |
| 2   | **Front Lawn**  | ~36 × 30 m sunny yard: picnic-table runway, stone wall with gate pillars, patio (table, four chairs, sun lounger, umbrella, BBQ, flower pots), front porch + porch roof, house, mailbox, garden bench, trampoline, doghouse, trees.                         |
| 3   | **Toy Room**    | 8 × 10 m playroom: big bed runway, raised toy race track, toy chest, kids table + chairs, cubby shelf, bookcase, block tower, rocking horse, teepee, ball pit, and **18 bouncy balls** of many sizes.                                                       |
| 4   | **Parking Lot** | ~44 × 52 m lot: box-truck roof runway, four rows of parked cars (landable hoods and roofs), a white van and a blue van, light poles, planter islands with trees, cart corral, cones, a painted helipad, and the Toy Mart storefront with a landable awning. |

Outdoor levels have soft edges: fly to the edge and the plane is gently turned around (no damage). Indoor levels have walls and a ceiling that you can bump.

Each level has several glowing **suggested** landing pads (pad landings earn a ★ bonus) and a ◎ marker pointing at a goal, but you never need a pad.

### Bouncy balls

The Toy Room balls have simple sphere physics: gravity, bounces, rolling friction, collisions with furniture and with each other. When the plane touches one, the ball gets the shove and rolls / bounces away; the plane is only nudged a little and **never takes damage** from a ball.

## Land anywhere, and damage

Any flat surface counts: the floor, grass, the patio, a table, a chair seat, a car roof, the trampoline… A touchdown is graded:

- **Nice landing** (no damage): wheels fully down (**G**), wings roughly level (bank under ~21°), nose not pointing down, sink under **0.62 m/s**, speed under **1.35 m/s** (1.55 with flaps). The toast names the surface you landed on.
- **Bumpy landing** (wheels down but too hard / fast / banked): you still land, it still counts, and you get some damage.
- **Belly slide** (gear up): the plane slides to a stop and takes damage.
- **Nosedive** (extremely hard or steep): breaks the plane.

Bumping furniture, walls, trees, cars, etc. pushes the plane back and adds damage in proportion to how fast you hit it straight on (a light brush costs ~2%, a 1 m/s head-on bonk ~24%). Only a **really violent** head-on impact (about 1.9 m/s or more, i.e. near full speed) or reaching **100% damage** triggers the explosion / breakup crash.

The **DAMAGE** meter on the HUD shows 0–100%. Above 50% the plane trails smoke; every hit gives a red flash and a little camera shake. Damage resets on restart (**R**) or when changing levels.

## Controls

| Control                              | Action                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| **W** (hold)                         | Increase throttle                                                      |
| **S** (hold)                         | Reduce throttle; wheel brakes when grounded                            |
| **A / D**                            | Roll left / right; gentle steering on the ground                       |
| **Mouse toward you** (positive Y)    | Pull back / nose up                                                    |
| **Mouse away from you** (negative Y) | Push forward / nose down                                               |
| **Mouse left / right**               | Yaw left / right                                                       |
| **G**                                | Toggle landing gear (animated; retraction is protected while grounded) |
| **F**                                | Toggle flaps: extra lift and drag, lower stall speed                   |
| **R**                                | Restart at the level’s start spot, including from pause / crash        |
| **L / Levels button**                | Open the level picker (works while flying, paused or crashed)          |
| **1 – 4** (in the menu)              | Pick Living Room / Front Lawn / Toy Room / Parking Lot                 |
| **Click game / LET’S FLY**           | Capture mouse and resume                                               |
| **Esc**                              | Release mouse and pause                                                |
| **H / Flight school**                | Replay or hide tutorial                                                |
| **Enter / Skip**                     | Dismiss tutorial                                                       |

W/S is intentional: the original request mentioned A twice; A/D remains roll.

### Mouse / Thrustmaster recentering

A Thrustmaster **configured to emit mouse movement** works like the mouse (native joystick axes / WebHID are not implemented). Browsers cannot warp the real OS cursor to screen center. Instead this game uses the **Pointer Lock API** for unlimited relative `movementX/Y`, hiding the OS cursor while locked. Relative movement deflects a circular **virtual stick**, with a 5.5% deadzone. A light spring continuously centers it; **110 ms after movement pauses**, a stronger spring rapidly returns it to neutral. It never gets stuck at a screen edge. The reticle and amber pip show deflection.

Use small, repeated pushes to change attitude, not a permanently held mouse offset. Centering returns the _input_ to neutral; aircraft attitude settles gradually. Pointer Lock needs a real click and localhost or HTTPS, and may be restricted inside embedded previews. Esc always releases the mouse. This build has not been validated on physical Thrustmaster hardware.

## Your first flight

1. Pick a level, click LET’S FLY. Hold **W** and watch the airspeed.
2. At **0.85 m/s**, pull back a little. You’re airborne! **G** tucks in the wheels.
3. Make gentle turns using mouse yaw or **A/D** bank. Don’t hold full power forever — it’s a small room.
4. Follow the ◎ marker to the level’s goal, or pick any flat spot. Glowing pads earn a ★ bonus. The radar shows the level, pads and your heading.
5. **F** lowers flaps. **G** lowers wheels. Ease off with **S**; aim for **0.8–1.2 m/s**.
6. Keep wings level, descend gently, touch wheels first, then **S** to stop. Raise the nose slightly to soften the touchdown.

Flight school appears on first load, progresses as you perform the actions, has manual Next / Skip buttons, and can be replayed with H. Tutorial completion is stored locally when available.

## Flight & crashes

World units are meters: a **0.32 m** plane. Arcade physics uses reduced effective gravity, speed / angle-of-attack lift, parasite and induced drag, bank-assisted turns, sideslip assistance, stalls, flaps, and gear drag. It is a playful approximation, not a real flight-training tool. See **Land anywhere, and damage** above for landings and bumps.

Crashes separate the fuselage, left wing, right wing, tail, propeller and three gear assemblies into tumbling debris, with orange fire particles, expanding smoke and a brief bright flash. The retry overlay waits a moment so the explosion is visible; **R** or **TRY AGAIN** resets an intact plane. No gore or real-world violence.

## Model swap hooks

Put assets in **`public/models/`**. Under Vite they are served at `/models/…`; with `python -m http.server` use `./public/models/…` as the URL. All geometry should use **meters**, **+Y up**, plane **nose along -Z**, with origin at the center of gravity. The physics / collision shape remains independent from render meshes.

### Plane

`src/plane.js` exports `createPlane()`, `animatePlane()` and `loadPlaneModel()`:

```js
// In src/main.js, import loadPlaneModel and call after createPlane():
loadPlaneModel(plane, "/models/my-plane.glb", { scale: 1 }).catch(
  console.error,
);
```

The loader hides the primitive rig and shows your GLTF/GLB; it does **not** automatically bind its propeller, gear or flap bones. Adapt `animatePlane()` to your named model parts for those animations. The primitive semantic-part rig is retained as fallback crash debris; to break your custom model apart, populate `plane.pieces` with its named components and update the crash visual handling. Default groups: `Fuselage`, `LeftWing`, `RightWing`, `Tail`, `Propeller`, `Gear0..2`.

### Furniture

Every level (`src/levels/*.js`) returns `furniture`, `architecture`, **`colliders`**, **`pads`**, `balls`, `spawn` and `bounds`. `loadFurnitureModel(level, url, { scale: 1 })` from `src/room.js` works with any level and replaces the entire primitive furniture visual group, while retaining the room shell and collision data. It also hides the old pad visuals, so recreate the pad decals in your model / a separate overlay group. Alternatively swap individual meshes inside `room.furniture` to preserve pad markers.

**Update collision boxes and pad bounds when changing furniture locations / sizes.** They are explicit world-space AABBs (`{ min, max, name, landable? }`) rather than automatically generated GLTF colliders. Any collider top at least 10 cm wide is automatically landable (set `landable: false` for things like umbrellas or tree canopies). Pads specify `{ id, name, x, y, z, w, d }`, with `y` equal to the top surface. Room walls / outdoor edges are the level’s `bounds` (`soft: true` = turn around instead of bump).

### Adding a level

Copy one of `src/levels/*.js`, build it with the helpers in `src/levels/builder.js` (`box`, `cylinder`, `sphere`, `addPad`, `ball`, `zone`, `addCollider`), and add it to the list in `src/levels/index.js`. A level exports `{ id, name, short, tagline, icon, heroTitle, objective, env, create(scene) }`; `env` holds the sky/fog colors, lights, shadow size, camera far plane and chase-camera limits. `tests/levels.test.js` automatically checks every level’s spawn, pads and takeoff.

## File map

```text
index.html             HUD, menus, level picker, tutorial, keyboard help
src/main.js            Renderer, level loading, fixed-step loop, chase camera, events
src/levels/index.js    The level list (add new levels here)
src/levels/*.js        Living Room, Front Lawn, Toy Room, Parking Lot
src/levels/builder.js  Primitive / collider / pad / ball / sky helpers for levels
src/room.js            Original living-room furniture + loadFurnitureModel hook
src/plane.js           Primitive plane, animations, GLTF loader hook
src/physics.js         Flight, land-anywhere touchdowns, damage, bumps, bounds
src/balls.js           Bouncy ball physics and plane-ball pushes (no damage)
src/effects.js         Damage smoke trail
src/controls.js        Pointer lock, virtual stick, springs, key input
src/tutorial.js        Seven short, skippable takeoff / landing lessons
src/crash.js           Semantic-part debris, fire, smoke, light flash
src/ui.js              Instruments, damage meter, radar, level picker, menus
src/style.css          Responsive warm cockpit-style overlay
vendor/                Three.js r187 + the few addons used (relative imports only)
public/models/         Your future .glb / .gltf assets
tests/                 Node built-in tests (flight, damage, balls, levels, imports)
vite.config.js         Relative base and vendor chunk
```

### Notes / limits

- Desktop keyboard + mouse only; no touch controls, audio, native gamepad mapping, or multiplayer yet.
- The chase camera is level-bounded, not a full furniture-occlusion camera.
- Collision detection uses small fixed steps and multiple body / wing probes, not mesh-level rigid-body physics. Decorative leaves / curtain folds are visual-only.
- Dependencies are pinned through `package-lock.json`; `node_modules/` and `dist/` stay out of git.
- `window.__toyFlight` (state, level, `loadLevel(id)`, scene…) is exposed under Vite dev or when the URL has `?debug`, for model / physics inspection.
