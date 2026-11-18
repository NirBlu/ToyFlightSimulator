export class Controls {
  constructor(
    canvas,
    {
      onToggle = () => {},
      onLock = () => {},
      onError = () => {},
      gamepad = null,
    } = {},
  ) {
    this.gamepad = gamepad;
    this.pad = null;
    this.pip = { x: 0, y: 0 };
    this.canvas = canvas;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.lastMove = 0;
    this.locked = false;
    this.onToggle = onToggle;
    this.onLock = onLock;
    this.onError = onError;
    this.handlers = [];
    const on = (target, type, fn) => {
      target.addEventListener(type, fn);
      this.handlers.push(() => target.removeEventListener(type, fn));
    };
    on(document, "keydown", (e) => {
      if (
        e.target instanceof HTMLElement &&
        /INPUT|TEXTAREA/.test(e.target.tagName)
      )
        return;
      if (
        [
          "KeyW",
          "KeyS",
          "KeyA",
          "KeyD",
          "KeyG",
          "KeyF",
          "KeyR",
          "KeyH",
          "KeyL",
          "KeyV",
          "KeyC",
          "ArrowUp",
          "ArrowDown",
          "Enter",
          "Space",
        ].includes(e.code)
      )
        e.preventDefault();
      if (
        !e.repeat &&
        (["KeyG", "KeyF", "KeyR", "KeyH", "KeyL", "KeyV", "Enter"].includes(
          e.code,
        ) ||
          /^Digit[1-9]$/.test(e.code))
      )
        this.onToggle(e.code);
      if (e.code === "KeyC" && !e.repeat) this.recenter();
      if (this.locked) this.keys.add(e.code);
    });
    on(document, "mousedown", (e) => {
      if (e.button === 1 && this.locked) {
        e.preventDefault();
        this.recenter();
      }
    });
    on(document, "keyup", (e) => this.keys.delete(e.code));
    on(document, "mousemove", (e) => {
      if (!this.locked) return;
      const c = (v) => Math.max(-1, Math.min(1, v));
      this.stick.x = c(this.stick.x + e.movementX * 0.012);
      this.stick.y = c(this.stick.y + e.movementY * 0.012);
      this.lastMove = performance.now();
    });
    on(document, "pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      this.clear();
      this.onLock(this.locked);
    });
    on(document, "pointerlockerror", () =>
      this.onError(
        "Mouse capture was blocked. Click Let’s fly again (desktop browser, HTTPS or localhost).",
      ),
    );
    on(window, "blur", () => this.clear());
    on(canvas, "click", () => this.lock());
  }
  lock() {
    if (this.locked) return;
    if (!this.canvas.requestPointerLock) {
      this.onError("Use a desktop browser with Pointer Lock support.");
      return;
    }
    try {
      const result = this.canvas.requestPointerLock();
      if (result?.catch)
        result.catch(() =>
          this.onError(
            "Mouse capture needs a fresh click. Click Let’s fly to try again.",
          ),
        );
    } catch {
      this.onError(
        "Mouse capture needs a fresh click. Click Let’s fly to try again.",
      );
    }
  }
  /** Put the mouse stick back in the middle (C key / middle click). */
  recenter() {
    this.stick.x = 0;
    this.stick.y = 0;
  }
  clear() {
    this.keys.clear();
    this.stick.x = 0;
    this.stick.y = 0;
  }
  update(dt, now = performance.now()) {
    // The mouse is a persistent virtual stick: it stays where you leave it
    // (no spring back to center). C or the middle mouse button re-centers it.
    const r = Math.hypot(this.stick.x, this.stick.y),
      deadzone = 0.055;
    const gain = r > deadzone ? (r - deadzone) / (1 - deadzone) / r : 0;
    const kbThrottle = this.keys.has("KeyW") || this.keys.has("KeyS");
    // Joystick / throttle (Gamepad API): adds to the mouse and keys.
    const g = (this.pad = this.gamepad ? this.gamepad.poll(kbThrottle) : null);
    if (g) for (const code of g.actions || []) this.onToggle(code);
    const c = (v) => Math.max(-1, Math.min(1, v));
    const yaw = c(this.stick.x * gain + (g?.yaw || 0));
    // Arrow keys are a steady "hold the stick" for pitch: ↓ pulls up, ↑ pushes down.
    const pitch = c(
      this.stick.y * gain +
        (g?.pitch || 0) +
        (this.keys.has("ArrowDown") ? 1 : 0) -
        (this.keys.has("ArrowUp") ? 1 : 0),
    );
    const roll = c(
      (this.keys.has("KeyA") ? 1 : 0) -
        (this.keys.has("KeyD") ? 1 : 0) +
        (g?.roll || 0),
    );
    // Reticle pip: right/back like the mouse, from whichever input is active.
    this.pip = {
      x: c(this.stick.x + (g ? -g.roll + g.yaw : 0)),
      y: c(this.stick.y + (g?.pitch || 0)),
    };
    return {
      yaw,
      pitch,
      roll,
      throttleUp: this.keys.has("KeyW") || !!g?.throttleUp,
      brake: this.keys.has("KeyS") || !!g?.brake,
      // Absolute lever position 0..1 (null until the lever is moved).
      throttleSet: g?.throttle ?? null,
    };
  }
  dispose() {
    this.handlers.forEach((fn) => fn());
    this.clear();
  }
}
