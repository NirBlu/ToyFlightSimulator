import * as THREE from "../vendor/three.module.js";

/** Grey smoke puffs from a damaged plane (over 50% damage). Pooled, cheap. */
export class DamageSmoke {
  constructor(scene, count = 48) {
    this.scene = scene;
    this.geometry = new THREE.IcosahedronGeometry(1, 0);
    this.puffs = [];
    this.timer = 0;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({
          color: "#6a6f72",
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.puffs.push({ mesh, life: 0, max: 1, velocity: new THREE.Vector3() });
    }
    this.next = 0;
  }
  update(dt, state, planeRoot) {
    const damaged = state && !state.crashed && state.damage >= 50;
    if (damaged) {
      this.timer -= dt;
      const rate = state.damage >= 80 ? 0.035 : 0.07;
      while (this.timer <= 0) {
        this.timer += rate;
        const p = this.puffs[this.next];
        this.next = (this.next + 1) % this.puffs.length;
        const tail = new THREE.Vector3(0, 0.01, 0.06).applyQuaternion(
          planeRoot.quaternion,
        );
        p.mesh.position.copy(planeRoot.position).add(tail);
        p.velocity.set(
          (Math.random() - 0.5) * 0.08,
          0.12 + Math.random() * 0.08,
          (Math.random() - 0.5) * 0.08,
        );
        p.life = 0;
        p.max = 0.9 + Math.random() * 0.6;
        p.mesh.visible = true;
        p.mesh.material.color.set(state.damage >= 80 ? "#3f4345" : "#7a7f82");
      }
    }
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      const age = p.life / p.max;
      if (age >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(0.014 + age * 0.085);
      p.mesh.material.opacity = 0.42 * (1 - age);
    }
  }
  reset() {
    for (const p of this.puffs) p.mesh.visible = false;
    this.timer = 0;
  }
}
