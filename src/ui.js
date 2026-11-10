import * as THREE from "../vendor/three.module.js";

const SVG = "http://www.w3.org/2000/svg";
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
      "damage",
      "damage-fill",
      "damage-tag",
      "stick-pip",
      "stall",
      "map-plane",
      "radar-shapes",
      "menu",
      "play",
      "levels",
      "crash-screen",
      "crash-reason",
      "toast",
      "target-label",
      "target-name",
      "target-distance",
      "objective",
      "status",
      "brand-sub",
      "hero-title",
      "hit-flash",
    ])
      this.el[id] = document.getElementById(id);
    this.toastTimer = 0;
    this.crashShown = false;
    this.level = null;
    this.bounds = { minX: -3, maxX: 3, minZ: -4, maxZ: 4 };
  }
  /** Build the level picker. onPick(id) is called on click. */
  buildLevelPicker(levels, onPick) {
    const root = this.el.levels;
    root.innerHTML = "";
    levels.forEach((level, i) => {
      const b = document.createElement("button");
      b.className = "level-card";
      b.dataset.level = level.id;
      b.type = "button";
      b.innerHTML = `<span class="level-icon">${level.icon}</span><b>${level.name}</b><small>${level.tagline}</small><kbd>${i + 1}</kbd>`;
      b.onclick = (e) => {
        e.stopPropagation();
        onPick(level.id);
      };
      root.appendChild(b);
    });
  }
  setLevel(level, runtime, target) {
    this.level = level;
    for (const b of this.el.levels.querySelectorAll(".level-card"))
      b.classList.toggle("selected", b.dataset.level === level.id);
    this.el["brand-sub"].textContent = `${level.name.toUpperCase()} ADVENTURES`;
    this.el["hero-title"].innerHTML = level.heroTitle;
    this.el["target-name"].textContent = (
      target?.name || "landing pad"
    ).toUpperCase();
    document.title = `Toy Flight · ${level.name}`;
    document.body.dataset.level = level.id;
    const b = runtime.bounds || { minX: -3, maxX: 3, minZ: -4, maxZ: 4 };
    this.bounds = b;
    // Radar: big obstacles faint, landing pads bright.
    const g = this.el["radar-shapes"];
    g.innerHTML = "";
    const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    const rect = (x0, z0, x1, z1, fill) => {
      const [ax, az] = this.mapPoint(x0, z0),
        [bx, bz] = this.mapPoint(x1, z1);
      const r = document.createElementNS(SVG, "rect");
      r.setAttribute("x", Math.min(ax, bx).toFixed(1));
      r.setAttribute("y", Math.min(az, bz).toFixed(1));
      r.setAttribute("width", Math.max(1, Math.abs(bx - ax)).toFixed(1));
      r.setAttribute("height", Math.max(1, Math.abs(bz - az)).toFixed(1));
      r.setAttribute("rx", "1.5");
      r.setAttribute("fill", fill);
      g.appendChild(r);
    };
    for (const c of runtime.colliders) {
      const a = (c.max.x - c.min.x) * (c.max.z - c.min.z);
      if (a < area * 0.004 || c.max.y < 0.2) continue;
      rect(c.min.x, c.min.z, c.max.x, c.max.z, "#ffffff22");
    }
    for (const p of runtime.pads)
      rect(
        p.x - p.w / 2,
        p.z - p.d / 2,
        p.x + p.w / 2,
        p.z + p.d / 2,
        p === target ? "#5cceb5cc" : "#f0bd7188",
      );
  }
  mapPoint(x, z) {
    const b = this.bounds;
    return [
      3 + ((x - b.minX) / (b.maxX - b.minX)) * 84,
      3 + ((z - b.minZ) / (b.maxZ - b.minZ)) * 104,
    ];
  }
  setLocked(locked, crashed = false) {
    document.body.classList.toggle("playing", locked);
    this.el.menu.hidden = locked || crashed;
    if (!locked && !crashed) {
      const flown = this.hasStarted;
      const short = this.level?.short || "room";
      this.el.menu.querySelector("h2").innerHTML = flown
        ? "Taking a<br/>little breather?"
        : `Your ${short}.<br/>Your runway.`;
      this.el.menu.querySelector(".eyebrow").textContent = flown
        ? "PAUSED · PICK A LEVEL OR KEEP FLYING"
        : "READY, LITTLE PILOT? PICK A LEVEL";
      this.el.play.innerHTML = flown
        ? "BACK TO FLYING <span>↗</span>"
        : "LET’S FLY <span>↗</span>";
    }
    if (locked) this.hasStarted = true;
    this.el.status.textContent = locked
      ? "MOUSE CAPTURED · ESC TO PAUSE · L LEVELS"
      : "DESKTOP · KEYBOARD + MOUSE / THRUSTMASTER";
  }
  toast(text, seconds = 4) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add("show");
    this.toastTimer = seconds;
  }
  flashHit(strength = 0.5) {
    const f = this.el["hit-flash"];
    if (!f) return;
    f.style.opacity = String(Math.min(0.55, 0.15 + strength * 0.4));
    f.classList.remove("fade");
    void f.offsetWidth;
    f.classList.add("fade");
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
      this.level?.objective || "YOUR FIRST FLIGHT · DINING TABLE → COUCH ARM";
  }
  update(state, controls, camera, target, dt) {
    const s = state,
      speed = s.velocity.length();
    this.el.speed.innerHTML = `${speed.toFixed(2)} <small>m/s</small>`;
    this.el.height.innerHTML = `${Math.round(s.position.y * 100)} <small>cm</small>`;
    this.el.throttle.textContent = `${Math.round(s.throttle * 100)}%`;
    this.el["throttle-fill"].style.width = `${s.throttle * 100}%`;
    const dmg = Math.round(s.damage || 0);
    this.el.damage.textContent = `${dmg}%`;
    const fill = this.el["damage-fill"];
    fill.style.width = `${dmg}%`;
    fill.style.background =
      dmg < 25
        ? "#91debb"
        : dmg < 50
          ? "#ffcc83"
          : dmg < 80
            ? "#ff9b5b"
            : "#ff5d5d";
    this.el["damage-tag"].textContent = s.crashed
      ? "BROKEN · PRESS R"
      : dmg < 1
        ? "GOOD AS NEW"
        : dmg < 25
          ? "A FEW SCRATCHES"
          : dmg < 50
            ? "DENTED · FLY GENTLY"
            : dmg < 80
              ? "SMOKING · LAND SOFTLY"
              : "CRITICAL · LAND NOW!";
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
    const [mx, mz] = this.mapPoint(s.position.x, s.position.z);
    this.el["map-plane"].setAttribute(
      "transform",
      `translate(${mx.toFixed(1)} ${mz.toFixed(1)}) rotate(${(-s.yaw * 180) / Math.PI})`,
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
