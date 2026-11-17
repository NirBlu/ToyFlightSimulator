// Joystick / throttle (HOTAS) support through the browser Gamepad API.
// Works on Linux, Windows and macOS in Chrome and Firefox. Thrustmaster sticks
// usually report a "non-standard" mapping, so axis numbers differ per device:
// sensible defaults below, and the J panel can re-learn any axis by moving it.

/** Every tweakable mapping lives here. Saved overrides go on top of it. */
export const DEFAULT_GAMEPAD_CONFIG = {
  deadzone: 0.08,
  /** Swap the roll and turn axes (J panel key M). */
  swapRollTurn: false,
  invertPitch: false,
  /** Lever below this (0..1) counts as idle and also brakes on the ground, like S. */
  idleBrake: 0.03,
  /** How far the lever must move before it takes over from W/S. */
  throttleTakeover: 0.06,
  // Learned axis bindings: { id, axis, invert } or null for the built-in guess.
  // `invert` false means the raw axis is already positive in the asked-for
  // direction: stick BACK (pitch), roll RIGHT (roll), stick RIGHT (yaw / turn),
  // lever FORWARD (throttle).
  pitch: null,
  roll: null,
  yaw: null,
  throttle: null,
  // Learned buttons: { id, button } or null. Default: trigger = V, 2 = G, 3 = F.
  buttons: { antigrav: null, gear: null, flaps: null },
};
export const DEFAULT_BUTTONS = { antigrav: 0, gear: 1, flaps: 2 };
export const BUTTON_CODES = { gear: "KeyG", flaps: "KeyF", antigrav: "KeyV" };
export const STORAGE_KEY = "toyflight-gamepad-v2" // v1 held the old default layout; ignored;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const isThrottleId = (id = "") =>
  /throttle|twcs|\btwa\b/i.test(id) && !/hotas/i.test(id);
export const isHotasId = (id = "") => /hotas/i.test(id);

/** Snapshot real Gamepad objects into plain data (also what tests feed in). */
export function snapshotPads(list) {
  const out = [];
  for (const p of list || []) {
    if (!p || p.connected === false) continue;
    out.push({
      id: p.id || "Gamepad",
      index: p.index ?? out.length,
      mapping: p.mapping || "",
      axes: Array.from(p.axes || [], (a) => (Number.isFinite(a) ? a : 0)),
      buttons: Array.from(p.buttons || [], (b) =>
        typeof b === "object"
          ? { pressed: !!b.pressed, value: b.value ?? (b.pressed ? 1 : 0) }
          : { pressed: b > 0.5, value: +b || 0 },
      ),
    });
  }
  return out;
}

/** Which device is the stick and which (if any) is a separate throttle. */
export function pickDevices(pads) {
  const usable = pads.filter((p) => p.axes.length >= 2);
  const throttle = usable.find((p) => isThrottleId(p.id)) || null;
  const stick =
    usable.find((p) => p !== throttle && !isThrottleId(p.id)) || null;
  return { stick, throttle };
}

/** Built-in guesses for each role. Returns { pad, axis, invert } or null. */
export function defaultBindings(pads) {
  const { stick, throttle } = pickDevices(pads);
  const b = { pitch: null, roll: null, yaw: null, throttle: null };
  if (stick) {
    const n = stick.axes.length;
    const ax = (axis, invert = false) =>
      axis != null && axis < n ? { pad: stick, axis, invert } : null;
    b.pitch = ax(1);
    if (stick.mapping === "standard") {
      // Xbox / PlayStation style: left stick flies, right stick X turns,
      // triggers are throttle (see mapGamepads).
      b.roll = ax(0);
      b.yaw = ax(2);
    } else {
      // Nir's Thrustmaster (checked on the real stick, Linux):
      // 0 = side to side -> turn (like the mouse), 1 = up/down -> pitch,
      // 3 = throttle lever, 5 = roll. Smaller devices: roll on axis 2.
      b.yaw = ax(0);
      b.roll = ax(n > 5 ? 5 : 2);
      if (!throttle) b.throttle = ax(3, true);
    }
  }
  if (throttle)
    b.throttle = {
      pad: throttle,
      axis: throttle.axes.length > 2 ? 2 : 0,
      invert: true,
    };
  return b;
}

/** Saved bindings win when their device is plugged in; otherwise the guess. */
export function resolveBindings(pads, config) {
  const b = defaultBindings(pads);
  for (const role of ["pitch", "roll", "yaw", "throttle"]) {
    const saved = config[role];
    if (!saved) continue;
    const pad = pads.find((p) => p.id === saved.id);
    if (pad && saved.axis < pad.axes.length)
      b[role] = { pad, axis: saved.axis, invert: !!saved.invert };
  }
  return b;
}

export function resolveButtons(pads, config) {
  const { stick } = pickDevices(pads);
  const out = {};
  for (const name of Object.keys(BUTTON_CODES)) {
    const saved = config.buttons?.[name];
    const pad = saved && pads.find((p) => p.id === saved.id);
    if (pad) out[name] = { pad, button: saved.button };
    else if (stick) out[name] = { pad: stick, button: DEFAULT_BUTTONS[name] };
  }
  return out;
}

export function applyDeadzone(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return (Math.sign(v) * Math.min(1, a - dz)) / (1 - dz);
}
const axisValue = (bind) => {
  if (!bind) return 0;
  const v = bind.pad.axes[bind.axis] ?? 0;
  return bind.invert ? -v : v;
};

/**
 * Pure mapping: pads + config -> flight inputs, same signs as the mouse/keys:
 * pitch +1 = nose up (stick back), roll +1 = bank left (like A), yaw +1 = turn
 * right (like mouse right). `throttle` is the raw lever 0..1 or null.
 */
export function mapGamepads(pads, config = DEFAULT_GAMEPAD_CONFIG) {
  const cfg = { ...DEFAULT_GAMEPAD_CONFIG, ...config };
  const b = resolveBindings(pads, cfg);
  const dz = cfg.deadzone;
  const rollAxis = applyDeadzone(axisValue(b.roll), dz);
  const turnAxis = applyDeadzone(axisValue(b.yaw), dz);
  let pitch = applyDeadzone(axisValue(b.pitch), dz);
  if (cfg.invertPitch) pitch = -pitch;
  const right = cfg.swapRollTurn ? turnAxis : rollAxis;
  const turn = cfg.swapRollTurn ? rollAxis : turnAxis;
  const out = {
    pitch,
    roll: 0 - right,
    yaw: turn,
    throttle: null,
    throttleUp: false,
    brake: false,
    stick: b.pitch?.pad || b.roll?.pad || null,
    throttleDevice: b.throttle?.pad || null,
    bindings: b,
  };
  if (b.throttle) out.throttle = clamp((1 + axisValue(b.throttle)) / 2, 0, 1);
  const sp = out.stick;
  if (sp && sp.mapping === "standard") {
    out.throttleUp = (sp.buttons[7]?.value || 0) > 0.3;
    out.brake = (sp.buttons[6]?.value || 0) > 0.3;
  }
  return out;
}

/** Stateful wrapper: polls navigator.getGamepads, edges, lever takeover, storage. */
export class GamepadInput {
  constructor({
    getPads = () =>
      typeof navigator !== "undefined" && navigator.getGamepads
        ? navigator.getGamepads()
        : [],
    storage = typeof localStorage !== "undefined" ? localStorage : null,
  } = {}) {
    this.getPads = getPads;
    this.storage = storage;
    this.supported =
      typeof navigator === "undefined" || !!navigator.getGamepads;
    this.config = this.load();
    this.pads = [];
    this.prevButtons = new Map();
    this.leverEngaged = false;
    this.leverBaseline = null;
    this.last = null;
    this.learn = null; // { kind, ... } while the J panel is learning
    this.onLearn = () => {};
  }
  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return {
          ...DEFAULT_GAMEPAD_CONFIG,
          ...saved,
          buttons: { ...DEFAULT_GAMEPAD_CONFIG.buttons, ...saved.buttons },
        };
      }
    } catch {
      /* ignore broken storage */
    }
    return structuredCloneSafe(DEFAULT_GAMEPAD_CONFIG);
  }
  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      /* optional */
    }
  }
  reset() {
    this.config = structuredCloneSafe(DEFAULT_GAMEPAD_CONFIG);
    this.leverEngaged = false;
    this.leverBaseline = null;
    this.save();
  }
  set(key, value) {
    this.config[key] = value;
    this.save();
  }
  /** Call once per frame. `keyboardThrottle` = W or S held (hands lever control back). */
  poll(keyboardThrottle = false) {
    let list = [];
    try {
      list = this.getPads() || [];
    } catch {
      list = [];
    }
    const pads = snapshotPads(list);
    this.pads = pads;
    const m = mapGamepads(pads, this.config);
    // Lever only takes over once it actually moves, so W/S keep working.
    if (m.throttle == null) {
      this.leverEngaged = false;
      this.leverBaseline = null;
    } else if (keyboardThrottle) {
      this.leverEngaged = false;
      this.leverBaseline = m.throttle;
    } else {
      if (this.leverBaseline == null) this.leverBaseline = m.throttle;
      if (
        !this.leverEngaged &&
        Math.abs(m.throttle - this.leverBaseline) > this.config.throttleTakeover
      )
        this.leverEngaged = true;
    }
    m.lever = m.throttle;
    if (!this.leverEngaged) m.throttle = null;
    else if (m.throttle <= this.config.idleBrake) m.brake = true;
    // Button presses -> the same toggles as G / F / V.
    m.actions = [];
    const now = new Map();
    for (const p of pads)
      now.set(
        p.index + "|" + p.id,
        p.buttons.map((b) => b.pressed),
      );
    if (this.learn) this.stepLearn(pads, now);
    else {
      const binds = resolveButtons(pads, this.config);
      for (const [name, bind] of Object.entries(binds)) {
        const key = bind.pad.index + "|" + bind.pad.id;
        const was = this.prevButtons.get(key)?.[bind.button];
        if (bind.pad.buttons[bind.button]?.pressed && !was)
          m.actions.push(BUTTON_CODES[name]);
      }
    }
    this.prevButtons = now;
    this.last = m;
    return m;
  }
  // ---- J-panel learning: "move the axis you want for X" ----
  startLearn(kind) {
    this.learn = {
      kind,
      start: this.pads.map((p) => ({ id: p.id, index: p.index, axes: [...p.axes] })),
      found: null,
      step: 0,
    };
  }
  cancelLearn() {
    this.learn = null;
  }
  /** Throttle learning is two steps: wiggle the lever, then push it forward + confirm. */
  confirmLearn() {
    const l = this.learn;
    if (!l || l.kind !== "throttle" || !l.found) return false;
    const pad = this.pads.find((p) => p.id === l.found.id);
    if (!pad) return false;
    const v = pad.axes[l.found.axis] ?? 0;
    this.config.throttle = { id: pad.id, axis: l.found.axis, invert: v < 0 };
    this.save();
    this.learn = null;
    this.leverEngaged = false;
    this.leverBaseline = null;
    this.onLearn("throttle", this.config.throttle);
    return true;
  }
  stepLearn(pads, nowButtons) {
    const l = this.learn;
    if (l.kind === "buttons") {
      const order = ["gear", "flaps", "antigrav"];
      for (const p of pads) {
        const key = p.index + "|" + p.id;
        const prev = this.prevButtons.get(key) || [];
        const hit = p.buttons.findIndex((b, i) => b.pressed && !prev[i]);
        if (hit >= 0) {
          const name = order[l.step];
          this.config.buttons = {
            ...this.config.buttons,
            [name]: { id: p.id, button: hit },
          };
          this.save();
          this.onLearn(name, this.config.buttons[name]);
          l.step++;
          if (l.step >= order.length) this.learn = null;
          return;
        }
      }
      return;
    }
    // Axis: the one that moved furthest from where it rested when learning began.
    let best = null;
    for (const p of pads) {
      const start =
        l.start.find((s) => s.index === p.index && s.id === p.id)?.axes || [];
      p.axes.forEach((v, axis) => {
        if (start[axis] === undefined) start[axis] = v;
        const d = v - start[axis];
        if (!best || Math.abs(d) > Math.abs(best.d)) best = { p, axis, d };
      });
      if (!l.start.find((s) => s.index === p.index && s.id === p.id))
        l.start.push({ id: p.id, index: p.index, axes: start });
    }
    if (!best || Math.abs(best.d) < 0.5) return;
    if (l.kind === "throttle") {
      l.found = { id: best.p.id, axis: best.axis };
      return; // wait for "push it fully forward, then press T"
    }
    this.config[l.kind] = { id: best.p.id, axis: best.axis, invert: best.d < 0 };
    this.save();
    this.learn = null;
    this.onLearn(l.kind, this.config[l.kind]);
  }
}
function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}
/** Short human label for HUD text. */
export function padLabel(id = "") {
  return (
    id
      .replace(/\(.*?(vendor|product).*?\)/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 34) || "Gamepad"
  );
}
