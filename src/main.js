import * as THREE from "../vendor/three.module.js";
import { createPlane, animatePlane } from "./plane.js?v=5";
import { Controls } from "./controls.js?v=5";
import { createFlightState, stepFlight } from "./physics.js?v=5";
import { stepBalls, syncBallMeshes } from "./balls.js?v=5";
import { CrashEffects } from "./crash.js?v=5";
import { DamageSmoke } from "./effects.js?v=5";
import { Tutorial } from "./tutorial.js?v=5";
import { UI } from "./ui.js?v=5";
import { LEVELS, getLevel } from "./levels/index.js?v=5";

const canvas = document.querySelector("#game");
try {
  start();
} catch (error) {
  console.error(error);
  const el = document.querySelector("#fatal");
  el.hidden = false;
  const webgl = /webgl/i.test(String(error && error.message));
  el.textContent = webgl
    ? "This little plane needs WebGL 2. Try a current desktop Chrome, Edge or Firefox with hardware acceleration enabled. " +
      error.message
    : "Something went wrong starting the game: " + (error && error.message);
}

function savedLevelId() {
  try {
    const fromUrl = new URLSearchParams(location.search).get("level");
    if (fromUrl && LEVELS.some((l) => l.id === fromUrl)) return fromUrl;
    return localStorage.getItem("toyflight-level") || LEVELS[0].id;
  } catch {
    return LEVELS[0].id;
  }
}
function disposeScene(scene) {
  scene.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    const mats = n.material
      ? Array.isArray(n.material)
        ? n.material
        : [n.material]
      : [];
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

function start() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const plane = createPlane();
  const camera = new THREE.PerspectiveCamera(
    66,
    innerWidth / innerHeight,
    0.018,
    24,
  );
  const ui = new UI(),
    tutorial = new Tutorial();
  let level = null,
    room = null,
    scene = null,
    sun = null,
    crashFX = null,
    smoke = null,
    spawnPad = null,
    targetPad = null;
  const target = new THREE.Vector3();
  let state = null;
  let accumulator = 0,
    crashReason = "",
    crashDelay = false,
    shake = 0,
    lastEdgeToast = -10,
    lastBallToast = -10;

  function loadLevel(id) {
    const def = getLevel(id);
    if (scene) {
      crashFX.reset();
      scene.remove(plane.root);
      disposeScene(scene);
    }
    level = def;
    const env = def.env;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(env.background);
    scene.fog = new THREE.Fog(env.background, env.fog[0], env.fog[1]);
    renderer.toneMappingExposure = env.exposure ?? 1.25;
    scene.add(new THREE.HemisphereLight(...env.hemi));
    sun = new THREE.DirectionalLight(env.sun.color, env.sun.intensity);
    sun.position.set(...env.sun.position);
    sun.target.position.set(...(env.sun.target || [0, 0, 0]));
    sun.userData.offset = new THREE.Vector3(...env.sun.position).sub(
      sun.target.position,
    );
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const size = env.sun.size;
    Object.assign(sun.shadow.camera, {
      left: -size,
      right: size,
      top: size,
      bottom: -size,
      near: 0.1,
      far: env.sun.far,
    });
    sun.shadow.normalBias = 0.015;
    sun.shadow.bias = -0.0002;
    scene.add(sun, sun.target);
    room = def.create(scene);
    scene.add(plane.root);
    crashFX = new CrashEffects(scene, plane);
    smoke = new DamageSmoke(scene);
    camera.far = env.far;
    camera.updateProjectionMatrix();
    spawnPad = room.pads.find((p) => p.id === room.spawnPadId) || room.pads[0];
    targetPad =
      room.pads.find((p) => p.id === room.targetPadId) ||
      room.pads[1] ||
      spawnPad;
    target.set(targetPad.x, targetPad.y, targetPad.z);
    ui.setLevel(def, room, targetPad);
    try {
      localStorage.setItem("toyflight-level", def.id);
    } catch {
      /* optional persistence */
    }
    restart(true);
  }

  const controls = new Controls(canvas, {
    onToggle(code) {
      if (code === "KeyR") {
        restart();
        controls.lock();
        return;
      }
      if (code === "KeyH") {
        if (tutorial.visible) tutorial.dismiss();
        else tutorial.show();
        return;
      }
      if (code === "Enter") {
        tutorial.dismiss();
        return;
      }
      if (code === "KeyL") {
        openLevelSelect();
        return;
      }
      if (/^Digit[1-9]$/.test(code)) {
        const i = Number(code.slice(5)) - 1;
        if (!controls.locked && LEVELS[i]) pickLevel(LEVELS[i].id);
        return;
      }
      if (!controls.locked || state.crashed) return;
      if (code === "KeyG") {
        if (state.grounded && state.gearDown) {
          ui.toast(
            "Keep the wheels down on the runway! Raise them after takeoff.",
          );
          return;
        }
        state.gearDown = !state.gearDown;
        ui.toast(
          `Landing gear ${state.gearDown ? "coming down" : "going up"}!`,
          2,
        );
      }
      if (code === "KeyF") {
        state.flapsDown = !state.flapsDown;
        ui.toast(
          `Flaps ${state.flapsDown ? "down · extra lift, extra drag" : "up · ready to cruise"}`,
          2,
        );
      }
    },
    onLock(locked) {
      ui.setLocked(locked, state.crashed);
      accumulator = 0;
    },
    onError: (message) => ui.toast(message, 7),
  });
  function openLevelSelect() {
    if (state.crashed) {
      restart();
    }
    if (document.pointerLockElement) document.exitPointerLock();
    else ui.setLocked(false);
    ui.toast("Pick a level, then LET’S FLY. Keys 1–4 work too!", 4);
  }
  function pickLevel(id) {
    if (level && level.id === id) {
      if (state.crashed) restart();
      ui.toast(`${level.name} is ready. Click LET’S FLY!`, 3);
      return;
    }
    loadLevel(id);
    ui.setLocked(controls.locked, false);
    ui.toast(
      `${level.icon} ${level.name}! Click LET’S FLY when you're ready.`,
      4,
    );
  }
  ui.buildLevelPicker(LEVELS, pickLevel);
  document.querySelector("#play").onclick = () => controls.lock();
  document.querySelector("#help").onclick = () => {
    if (tutorial.visible) tutorial.dismiss();
    else tutorial.show();
  };
  document.querySelector("#level-button").onclick = () => openLevelSelect();
  document.querySelector("#retry").onclick = () => {
    restart();
    controls.lock();
  };
  document.querySelector("#crash-levels").onclick = () => openLevelSelect();

  function restart(silent = false) {
    state = createFlightState(room.spawn, spawnPad, room.spawnYaw || 0);
    crashFX.reset();
    smoke.reset();
    crashDelay = false;
    accumulator = 0;
    shake = 0;
    controls.clear();
    plane.root.position.copy(state.position);
    plane.root.quaternion.copy(state.quaternion);
    plane.gearBlend = 1;
    plane.flapBlend = 0;
    ui.reset();
    ui.setLocked(controls.locked);
    if (tutorial.visible) tutorial.show();
    updateCamera(1, true);
    if (!silent)
      ui.toast(`Back on the ${spawnPad.name}. Let’s give it another go!`, 3);
  }
  const objective = () => {
    const n = state.landings;
    return `${n} LANDING${n === 1 ? "" : "S"} · ${state.padLandings} ★ PAD BONUS · LAND ON ANYTHING FLAT`;
  };
  const events = {
    takeoff() {
      ui.toast(`Liftoff! The ${level.short} is yours. ✦`, 4);
    },
    landing(surface, verdict) {
      const pad = !surface.collider && !surface.ground;
      if (verdict.kind === "rough")
        ui.toast(
          `Bumpy landing on the ${surface.name}! +${verdict.damage}% damage. ${verdict.tip}`,
          6,
        );
      else
        ui.toast(
          `Nice landing on the ${surface.name}! ✦${pad ? " ★ Pad bonus!" : ""} Hold S to brake.`,
          6,
        );
      ui.el.objective.textContent = objective();
    },
    scrape(surface, verdict) {
      ui.toast(
        `Belly slide on the ${surface.name}! +${verdict.damage}% damage. Wheels down next time (G).`,
        5,
      );
    },
    hit(info) {
      shake = Math.min(1, shake + 0.25 + info.impact * 0.6);
      ui.flashHit(Math.min(1, info.damage / 30));
      if (!info.quiet)
        ui.toast(
          `Bonk! You bumped the ${info.name}. +${info.damage}% damage`,
          3,
        );
    },
    ball(ball) {
      if (state.elapsed - lastBallToast < 2.5) return;
      lastBallToast = state.elapsed;
      ui.toast(`Boing! You bounced the ${ball.name}. No damage!`, 2.5);
    },
    boundary(kind) {
      if (state.elapsed - lastEdgeToast < 3) return;
      lastEdgeToast = state.elapsed;
      ui.toast(
        kind === "ceiling"
          ? "That’s as high as we go! Nose down a little."
          : `That’s the edge of the ${level.short}! Turning you around.`,
        3,
      );
    },
    crash(reason) {
      crashReason = reason;
      plane.root.position.copy(state.position);
      plane.root.quaternion.copy(state.quaternion);
      crashFX.explode(state.position, state.velocity);
      crashDelay = true;
      shake = 1;
      ui.el.menu.hidden = true;
    },
  };
  const shakeOffset = new THREE.Vector3();
  function updateCamera(dt, snap = false) {
    const c = level.env.camera;
    const heading = new THREE.Vector3(
      Math.sin(state.yaw),
      0,
      Math.cos(state.yaw),
    );
    const desired = state.position.clone().addScaledVector(heading, 0.83);
    desired.y += 0.34;
    desired.x = THREE.MathUtils.clamp(desired.x, c.minX, c.maxX);
    desired.z = THREE.MathUtils.clamp(desired.z, c.minZ, c.maxZ);
    desired.y = THREE.MathUtils.clamp(desired.y, c.minY, c.maxY);
    camera.position.sub(shakeOffset);
    camera.position.lerp(desired, snap ? 1 : 1 - Math.exp(-7 * dt));
    const look = state.position.clone().addScaledVector(heading, -0.24);
    look.y += 0.06;
    camera.lookAt(look);
    shake = snap ? 0 : Math.max(0, shake - dt * 2.5);
    const a = shake * shake * 0.035;
    shakeOffset.set(
      (Math.random() - 0.5) * a,
      (Math.random() - 0.5) * a,
      (Math.random() - 0.5) * a,
    );
    camera.position.add(shakeOffset);
  }
  loadLevel(savedLevelId());
  let previous = performance.now(),
    time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    time += dt;
    const input = controls.update(dt, now);
    if (controls.locked) {
      accumulator += dt;
      while (accumulator >= 1 / 120) {
        if (!state.crashed) stepFlight(state, input, 1 / 120, room, events);
        stepBalls(room, 1 / 120);
        accumulator -= 1 / 120;
      }
      if (!state.crashed) {
        plane.root.position.copy(state.position);
        plane.root.quaternion.copy(state.quaternion);
        animatePlane(plane, state, dt);
        tutorial.update(state, controls.locked, dt, target);
      }
    }
    syncBallMeshes(room.balls, controls.locked ? dt : 0);
    crashFX.update(dt);
    smoke.update(dt, state, plane.root);
    if (crashDelay && crashFX.time > 1.15) {
      crashDelay = false;
      ui.showCrash(crashReason);
      if (document.pointerLockElement) document.exitPointerLock();
    }
    if (!state.crashed) updateCamera(dt);
    if (level.env.sun.follow) {
      sun.target.position.set(state.position.x, 0, state.position.z);
      sun.position.copy(sun.target.position).add(sun.userData.offset);
    }
    room.update(time, dt);
    ui.update(state, controls, camera, target, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  // Local inspection hook for simulation tests and model integration (Vite dev or ?debug).
  let debug = false;
  try {
    debug =
      !!import.meta.env?.DEV ||
      new URLSearchParams(location.search).has("debug");
  } catch {
    debug = false;
  }
  if (debug)
    window.__toyFlight = {
      get state() {
        return state;
      },
      get room() {
        return room;
      },
      get level() {
        return level;
      },
      get scene() {
        return scene;
      },
      levels: LEVELS.map((l) => l.id),
      loadLevel,
      plane,
      controls,
      get crashFX() {
        return crashFX;
      },
      camera,
      restart,
      renderer,
    };
}
