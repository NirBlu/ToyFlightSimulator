import * as THREE from "three";
export class UI {
  constructor() {
    this.el = {};
    for (const id of [
      "speed",
      "speed-tag",
      "height",
      "throttle",
      "throttle-fill",
      "gear",
      "flaps",
      "stick-pip",
      "stall",
      "map-plane",
      "menu",
      "play",
      "crash-screen",
      "crash-reason",
      "toast",
      "target-label",
      "target-distance",
      "objective",
      "status",
    ])
      this.el[id] = document.getElementById(id);
    this.toastTimer = 0;
    this.crashShown = false;
  }
  setLocked(locked, crashed = false) {
    document.body.classList.toggle("playing", locked);
    this.el.menu.hidden = locked || crashed;
    if (!locked && !crashed) {
      const flown = this.hasStarted;
      this.el.menu.querySelector("h2").innerHTML = flown
        ? "Taking a<br/>little breather?"
        : "Your room.<br/>Your runway.";
      this.el.menu.querySelector(".eyebrow").textContent = flown
        ? "PAUSED · WINGS ON HOLD"
        : "READY, LITTLE PILOT?";
      this.el.play.innerHTML = flown
        ? "BACK TO FLYING <span>↗</span>"
        : "LET’S FLY <span>↗</span>";
    }
    if (locked) this.hasStarted = true;
    this.el.status.textContent = locked
      ? "MOUSE CAPTURED · ESC TO PAUSE"
      : "DESKTOP · KEYBOARD + MOUSE / THRUSTMASTER";
  }
  toast(text, seconds = 4) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add("show");
    this.toastTimer = seconds;
  }
  showCrash(reason) {
    this.crashShown = true;
    document.body.classList.add("crashed");
    this.el["crash-screen"].hidden = false;
    this.el["crash-reason"].textContent = reason;
    this.el.menu.hidden = true;
  }
  reset() {
    this.crashShown = false;
    this.el["crash-screen"].hidden = true;
    document.body.classList.remove("crashed");
    this.el.objective.textContent =
      "YOUR FIRST FLIGHT · DINING TABLE → COUCH ARM";
  }
  update(state, controls, camera, target, dt) {
    const s = state,
      speed = s.velocity.length();
    this.el.speed.innerHTML = `${speed.toFixed(2)} <small>m/s</small>`;
    this.el.height.innerHTML = `${Math.round(s.position.y * 100)} <small>cm</small>`;
    this.el.throttle.textContent = `${Math.round(s.throttle * 100)}%`;
    this.el["throttle-fill"].style.width = `${s.throttle * 100}%`;
    this.el.gear.textContent = s.gearDown
      ? s.gearExtension < 0.95
        ? "LOWERING"
        : "DOWN"
      : s.gearExtension > 0.05
        ? "RAISING"
        : "UP";
    this.el.gear.classList.toggle("green", s.gearDown);
    this.el.flaps.textContent = s.flapsDown ? "DOWN" : "UP";
    this.el.flaps.classList.toggle("green", s.flapsDown);
    this.el["speed-tag"].textContent = s.crashed
      ? "LET’S TRY THAT AGAIN"
      : s.stall
        ? "STALL · ADD POWER"
        : s.grounded
          ? s.hasFlown
            ? "S TO BRAKE · W TO GO AGAIN"
            : speed > 0.85
              ? "PULL BACK TO LIFT OFF"
              : "SPOOL UP TO 0.85"
          : s.flapsDown
            ? "LANDING CONFIGURATION"
            : "FREE AS A TOY BIRD";
    this.el["stick-pip"].style.transform =
      `translate(${controls.stick.x * 34}px,${controls.stick.y * 34}px)`;
    this.el.stall.hidden = !s.stall || s.crashed || !controls.locked;
    const mx = 3 + ((s.position.x + 3) / 6) * 84,
      mz = 3 + ((s.position.z + 4) / 8) * 104;
    this.el["map-plane"].setAttribute(
      "transform",
      `translate(${mx} ${mz}) rotate(${(-s.yaw * 180) / Math.PI})`,
    );
    const point = target.clone();
    point.y += 0.18;
    const projected = point.project(camera);
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    const inFront = target.clone().sub(camera.position).dot(cameraForward) > 0;
    this.el["target-label"].hidden =
      s.crashed ||
      !inFront ||
      Math.abs(projected.x) > 0.92 ||
      Math.abs(projected.y) > 0.84;
    this.el["target-label"].style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
    this.el["target-label"].style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`;
    this.el["target-distance"].textContent =
      `${s.position.distanceTo(target).toFixed(1)} METERS AWAY`;
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) this.el.toast.classList.remove("show");
  }
}
