import { padLabel, resolveBindings, resolveButtons } from "./gamepad.js?v=11";

const PROMPTS = {
  pitch: "PITCH: pull the stick all the way BACK (toward you)…",
  roll: "ROLL: move the control you want for rolling all the way RIGHT…",
  yaw: "TURN: push the stick all the way RIGHT (side to side, like the mouse)…",
  throttle:
    "THROTTLE: move the lever back and forth, then leave it fully FORWARD and press T…",
  buttons: ["press the button for GEAR (G)…", "press the button for FLAPS (F)…", "press the button for ANTI-GRAV (V)…"],
};
const KEYS = {
  KeyP: "pitch",
  KeyX: "roll",
  KeyY: "yaw",
  KeyT: "throttle",
  KeyB: "buttons",
};

/** J: live joystick view + "move the axis now" remapping, saved in localStorage. */
export class GamepadPanel {
  constructor(gamepad, { toast = () => {} } = {}) {
    this.gp = gamepad;
    this.toast = toast;
    this.visible = false;
    const el = (this.el = document.createElement("section"));
    el.id = "pad-panel";
    el.className = "pad-panel";
    el.hidden = true;
    el.setAttribute("aria-label", "Joystick setup");
    el.innerHTML = `
      <div class="card-top"><span class="eyebrow">🕹 JOYSTICK &amp; THROTTLE SETUP</span><span class="pad-close"><kbd>J</kbd> close</span></div>
      <div class="pad-learn" id="pad-learn"></div>
      <div class="pad-roles" id="pad-roles"></div>
      <div class="pad-list" id="pad-list"></div>
      <div class="pad-help">
        Re-learn by moving it: <kbd>P</kbd> pitch · <kbd>X</kbd> roll · <kbd>Y</kbd> turn · <kbd>T</kbd> throttle · <kbd>B</kbd> buttons<br/>
        <kbd>I</kbd> invert pitch · <kbd>M</kbd> swap roll / turn · <kbd>C</kbd> reset to defaults · <kbd>Esc</kbd> cancel
      </div>`;
    document.getElementById("app")?.appendChild(el);
    this.learnEl = el.querySelector("#pad-learn");
    this.rolesEl = el.querySelector("#pad-roles");
    this.listEl = el.querySelector("#pad-list");
    this.timer = 0;
    gamepad.onLearn = (what, bind) => {
      const name = bind ? `${what.toUpperCase()} → ${"axis" in bind ? `axis ${bind.axis}${bind.invert ? " (inverted)" : ""}` : `button ${bind.button}`}` : what;
      this.toast(`Joystick: ${name}. Saved!`, 3);
    };
    // Capture phase on window: runs before the game's own key handling.
    this.onKey = (e) => {
      if (e.code === "KeyJ") {
        if (!e.repeat) this.toggle();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (!this.visible) return;
      const kind = KEYS[e.code];
      let handled = true;
      if (e.repeat) handled = !!kind || ["KeyI", "KeyM", "KeyC", "Escape"].includes(e.code);
      else if (kind === "throttle" && this.gp.learn?.kind === "throttle") {
        if (!this.gp.confirmLearn())
          this.toast("Move the throttle lever first, then press T.", 3);
      } else if (kind) this.gp.startLearn(kind);
      else if (e.code === "KeyI") {
        this.gp.set("invertPitch", !this.gp.config.invertPitch);
        this.toast(`Pitch ${this.gp.config.invertPitch ? "INVERTED: stick back = nose down" : "normal: stick back = nose up"}`, 3);
      } else if (e.code === "KeyM") {
        this.gp.set("swapRollTurn", !this.gp.config.swapRollTurn);
        this.toast(`Roll and turn axes ${this.gp.config.swapRollTurn ? "SWAPPED: side to side now rolls" : "normal: side to side turns like the mouse"}`, 3);
      } else if (e.code === "KeyC") {
        this.gp.reset();
        this.toast("Joystick mapping reset to defaults.", 3);
      } else if (e.code === "Escape") {
        if (this.gp.learn) this.gp.cancelLearn();
        else this.hide();
        handled = false; // let Esc still release the mouse
      } else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", this.onKey, true);
  }
  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }
  show() {
    this.visible = true;
    this.el.hidden = false;
    this.render();
  }
  hide() {
    this.visible = false;
    this.el.hidden = true;
    this.gp.cancelLearn();
  }
  update(dt) {
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / 30;
    this.render();
  }
  render() {
    const gp = this.gp,
      pads = gp.pads;
    const l = gp.learn;
    this.learnEl.hidden = !l && pads.length > 0;
    this.learnEl.textContent = !gp.supported
      ? "This browser has no Gamepad API. Try Chrome or Firefox."
      : l
        ? l.kind === "buttons"
          ? `Now ${PROMPTS.buttons[l.step]}`
          : l.kind === "throttle" && l.found
            ? `Got it: ${padLabel(pads.find((p) => p.id === l.found.id)?.id)} axis ${l.found.axis}. Leave it fully FORWARD (full power) and press T.`
            : PROMPTS[l.kind]
        : "No joystick yet. Plug it in and PRESS ANY BUTTON on it (Linux browsers wait for a button press).";
    this.learnEl.classList.toggle("on", !!l);
    const b = resolveBindings(pads, gp.config);
    const btn = resolveButtons(pads, gp.config);
    const role = (name, bind) =>
      `<div><span>${name}</span><b>${bind ? `${padLabel(bind.pad.id)} · axis ${bind.axis}${bind.invert ? " ⇅" : ""}` : "—"}</b></div>`;
    const c = gp.config;
    const lever = gp.last?.lever;
    this.rolesEl.innerHTML =
      role(c.invertPitch ? "PITCH (inverted)" : "PITCH", b.pitch) +
      role(c.swapRollTurn ? "TURN (swapped)" : "ROLL", b.roll) +
      role(c.swapRollTurn ? "ROLL (swapped)" : "TURN (like mouse)", b.yaw) +
      role(
        `THROTTLE${lever != null ? ` ${Math.round(lever * 100)}%${gp.leverEngaged ? "" : " (move to take over)"}` : ""}`,
        b.throttle,
      ) +
      `<div><span>BUTTONS</span><b>${["gear", "flaps", "antigrav"].map((n) => `${n === "antigrav" ? "V" : n[0].toUpperCase()}=${btn[n] ? btn[n].button : "—"}`).join(" · ")}</b></div>`;
    this.listEl.innerHTML = pads
      .map((p) => {
        const axes = p.axes
          .map((v, i) => {
            const used = Object.values(b).some((x) => x && x.pad === p && x.axis === i);
            return `<div class="pad-axis${used ? " used" : ""}"><span>${i}</span><i><u style="left:${((v + 1) * 50).toFixed(1)}%"></u></i><em>${v.toFixed(2)}</em></div>`;
          })
          .join("");
        const buttons = p.buttons
          .map((x, i) => `<span class="pad-btn${x.pressed ? " on" : ""}">${i}</span>`)
          .join("");
        return `<div class="pad-dev"><b>#${p.index} ${padLabel(p.id)}</b><small>${p.mapping || "non-standard"} · ${p.axes.length} axes · ${p.buttons.length} buttons</small>${axes}<div class="pad-btns">${buttons}</div></div>`;
      })
      .join("");
  }
}
