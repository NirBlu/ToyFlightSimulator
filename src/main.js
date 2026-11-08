import * as THREE from "../vendor/three.module.js";
import { createPlane, animatePlane } from "./plane.js";
import { createRoom } from "./room.js";
import { Controls } from "./controls.js";
import { createFlightState, stepFlight } from "./physics.js";
import { CrashEffects } from "./crash.js";
import { Tutorial } from "./tutorial.js";
import { UI } from "./ui.js";

const canvas = document.querySelector("#game");
try {
  start();
} catch (error) {
  console.error(error);
  const el = document.querySelector("#fatal");
  el.hidden = false;
  el.textContent =
    "This little plane needs WebGL 2. Try a current desktop Chrome, Edge or Firefox with hardware acceleration enabled. " +
    error.message;
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c9dcd4");
  scene.fog = new THREE.Fog("#c9dcd4", 5, 15);
  scene.add(new THREE.HemisphereLight("#e4f6ff", "#b68b5d", 2.3));
  const sun = new THREE.DirectionalLight("#ffe7bc", 3.2);
  sun.position.set(-1.2, 3, -6);
  sun.target.position.set(-0.3, 0, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 15;
  sun.shadow.normalBias = 0.015;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const room = createRoom(scene),
    plane = createPlane();
  scene.add(plane.root);
  const targetPad = room.pads.find((p) => p.id === "couch-far");
  const target = new THREE.Vector3(targetPad.x, targetPad.y, targetPad.z);
  let state = createFlightState(room.spawn, room.pads[0]);
  const camera = new THREE.PerspectiveCamera(
    66,
    innerWidth / innerHeight,
    0.018,
    24,
  );
  const ui = new UI(),
    tutorial = new Tutorial(),
    crashFX = new CrashEffects(scene, plane);
  let accumulator = 0,
    crashReason = "",
    crashDelay = false;
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
  document.querySelector("#play").onclick = () => controls.lock();
  document.querySelector("#help").onclick = () => {
    if (tutorial.visible) tutorial.dismiss();
    else tutorial.show();
  };
  document.querySelector("#retry").onclick = () => {
    restart();
    controls.lock();
  };
  function restart() {
    state = createFlightState(room.spawn, room.pads[0]);
    crashFX.reset();
    crashDelay = false;
    accumulator = 0;
    controls.clear();
    plane.root.position.copy(state.position);
    plane.root.quaternion.identity();
    plane.gearBlend = 1;
    plane.flapBlend = 0;
    ui.reset();
    ui.setLocked(controls.locked);
    if (tutorial.visible) tutorial.show();
    updateCamera(1, true);
    ui.toast("Back on the table. Let’s give it another go!", 3);
  }
  const events = {
    takeoff() {
      ui.toast("Liftoff! The living room is yours. ✦", 4);
    },
    landing(pad) {
      ui.toast(`Nice landing on the ${pad.name}! ✦ Hold S to brake.`, 6);
      ui.el.objective.textContent = `${state.landings} LANDING${state.landings === 1 ? "" : "S"} · NEXT STOP: ANY GLOWING PAD`;
    },
    scrape(pad) {
      ui.toast(`A gentle scrape on the ${pad.name}. Wheels down next time!`, 5);
    },
    crash(reason) {
      crashReason = reason;
      plane.root.position.copy(state.position);
      plane.root.quaternion.copy(state.quaternion);
      crashFX.explode(state.position, state.velocity);
      crashDelay = true;
      ui.el.menu.hidden = true;
    },
  };
  function updateCamera(dt, snap = false) {
    const heading = new THREE.Vector3(
      Math.sin(state.yaw),
      0,
      Math.cos(state.yaw),
    );
    const desired = state.position.clone().addScaledVector(heading, 0.83);
    desired.y += 0.34;
    desired.x = THREE.MathUtils.clamp(desired.x, -2.88, 2.88);
    desired.z = THREE.MathUtils.clamp(desired.z, -3.86, 3.86);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.18, 2.55);
    camera.position.lerp(desired, snap ? 1 : 1 - Math.exp(-7 * dt));
    const look = state.position.clone().addScaledVector(heading, -0.24);
    look.y += 0.06;
    camera.lookAt(look);
  }
  plane.root.position.copy(state.position);
  updateCamera(1, true);
  let previous = performance.now(),
    time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    time += dt;
    const input = controls.update(dt, now);
    if (controls.locked && !state.crashed) {
      accumulator += dt;
      while (accumulator >= 1 / 120 && !state.crashed) {
        stepFlight(state, input, 1 / 120, room, events);
        accumulator -= 1 / 120;
      }
      plane.root.position.copy(state.position);
      plane.root.quaternion.copy(state.quaternion);
      animatePlane(plane, state, dt);
      tutorial.update(state, controls.locked, dt, target);
    }
    crashFX.update(dt);
    if (crashDelay && crashFX.time > 1.15) {
      crashDelay = false;
      ui.showCrash(crashReason);
      if (document.pointerLockElement) document.exitPointerLock();
    }
    if (!state.crashed) updateCamera(dt);
    room.update(time);
    ui.update(state, controls, camera, target, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  // Local-only inspection hook for simulation tests and model integration, omitted from production.
  if (import.meta.env.DEV)
    window.__toyFlight = {
      get state() {
        return state;
      },
      room,
      plane,
      controls,
      crashFX,
      scene,
      camera,
      restart,
    };
}
