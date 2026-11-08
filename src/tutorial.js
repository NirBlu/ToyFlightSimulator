const lessons = [
  [
    "Meet your tiny plane",
    "Your dining table is a runway! Click LET’S FLY to capture the mouse. Mouse back = nose up. Mouse sideways = turn.",
    "Click to capture your mouse",
  ],
  [
    "Give it some power",
    "Hold W to spool up. Keep the wings level and watch the airspeed climb. The table ends sooner than you think!",
    "Hold W · aim for 0.85 m/s",
  ],
  [
    "Up, up and away",
    "At 0.85 m/s, pull the mouse toward you in little pushes to lift the nose. The stick returns to center after each push.",
    "Mouse toward you = nose UP",
  ],
  [
    "Tuck the wheels away",
    "You’re flying! Press G to raise the gear. Keep some power on. Too slow? Nose down a little and add W.",
    "Press G · gear UP",
  ],
  [
    "Find your next runway",
    "Look for the mint-green couch arms. Use mouse sideways to yaw and A / D to bank. Small movements are best.",
    "Follow the COUCH ARM marker",
  ],
  [
    "Get ready to land",
    "Line up with an arm. Press F for flaps to slow down, then G for wheels down. Ease off the power with S.",
    "F: flaps DOWN · G: gear DOWN",
  ],
  [
    "Make a gentle touchdown",
    "Stay level, float down gently and keep below 1.35 m/s. Touch wheels first on the glowing cloth, then hold S to brake. You’ve got this!",
    "Gentle nose up · S to brake",
  ],
];
export class Tutorial {
  constructor() {
    this.el = document.querySelector("#tutorial");
    this.step = 0;
    this.elapsed = 0;
    this.visible = false;
    document.querySelector("#next").onclick = () => this.next();
    document.querySelector("#skip").onclick = () => this.dismiss();
    let seen = false;
    try {
      seen = localStorage.getItem("toyflight-tutorial-v1") === "done";
    } catch {
      /* private browsing still works */
    }
    if (!seen) this.show();
  }
  show() {
    this.visible = true;
    this.step = 0;
    this.elapsed = 0;
    this.render();
  }
  dismiss() {
    this.visible = false;
    this.el.hidden = true;
    document.body.classList.remove("tutorial-open");
    try {
      localStorage.setItem("toyflight-tutorial-v1", "done");
    } catch {
      /* optional persistence */
    }
  }
  next() {
    if (this.step >= lessons.length - 1) {
      this.dismiss();
      return;
    }
    this.step++;
    this.elapsed = 0;
    this.render();
  }
  render() {
    this.el.hidden = !this.visible;
    document.body.classList.toggle("tutorial-open", this.visible);
    const [title, copy, hint] = lessons[this.step];
    document.querySelector("#lesson-number").textContent =
      `LESSON 0${this.step + 1} / 07`;
    document.querySelector("#lesson-title").textContent = title;
    document.querySelector("#lesson-copy").textContent = copy;
    document.querySelector("#lesson-hint").textContent = hint;
    document.querySelector("#step-track").innerHTML = lessons
      .map((_, i) => `<i class="${i <= this.step ? "done" : ""}"></i>`)
      .join("");
    document.querySelector("#next").textContent =
      this.step === 6 ? "Got it ✓" : "Next →";
  }
  update(s, locked, dt, target) {
    if (!this.visible || !locked || s.crashed) return;
    this.elapsed += dt;
    const done = [
      locked,
      s.throttle > 0.6,
      s.hasFlown,
      !s.gearDown,
      s.position.distanceTo(target) < 1.7 || this.elapsed > 12,
      s.flapsDown && s.gearDown,
      s.landings > 0,
    ][this.step];
    if (done && this.elapsed > 0.7) this.next();
  }
}
