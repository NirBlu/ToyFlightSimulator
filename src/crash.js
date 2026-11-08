import * as THREE from "three";

export class CrashEffects {
  constructor(scene, plane) {
    this.scene = scene;
    this.plane = plane;
    this.debris = [];
    this.particles = [];
    this.time = 0;
    this.active = false;
    this.flash = new THREE.PointLight("#ffbb58", 0, 3);
    scene.add(this.flash);
    this.geometry = new THREE.IcosahedronGeometry(1, 1);
  }
  explode(position, velocity) {
    this.reset();
    this.active = true;
    this.time = 0;
    this.scene.updateMatrixWorld(true);
    // Each entire semantic aircraft piece becomes independent, preserving its world transform.
    for (const original of this.plane.pieces) {
      const piece = original.clone(true);
      const wp = new THREE.Vector3(),
        wq = new THREE.Quaternion(),
        ws = new THREE.Vector3();
      original.matrixWorld.decompose(wp, wq, ws);
      piece.position.copy(wp);
      piece.quaternion.copy(wq);
      piece.scale.copy(ws);
      piece.visible = true;
      this.scene.add(piece);
      this.debris.push({
        mesh: piece,
        velocity: velocity
          .clone()
          .multiplyScalar(0.55)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 2.2,
              0.7 + Math.random() * 1.2,
              (Math.random() - 0.5) * 2.2,
            ),
          ),
        spin: new THREE.Vector3(
          Math.random() * 8 - 4,
          Math.random() * 8 - 4,
          Math.random() * 8 - 4,
        ),
      });
    }
    this.plane.root.visible = false;
    for (let i = 0; i < 64; i++) {
      const smoke = i > 35,
        material = new THREE.MeshBasicMaterial({
          color: smoke
            ? "#5c6262"
            : ["#fff0a0", "#ffb43c", "#f47530", "#e75026"][i % 4],
          transparent: true,
          depthWrite: false,
        });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.position.copy(position);
      const size = smoke
        ? 0.035 + Math.random() * 0.04
        : 0.012 + Math.random() * 0.025;
      mesh.scale.setScalar(size);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        smoke,
        size,
        life: smoke ? 2.8 : 1.1,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.4,
          Math.random() * 1.8,
          (Math.random() - 0.5) * 2.4,
        ),
      });
    }
    this.flash.position.copy(position);
    this.flash.intensity = 10;
  }
  update(dt) {
    if (!this.active) return;
    this.time += dt;
    this.flash.intensity = 10 * Math.exp(-this.time * 11);
    for (const d of this.debris) {
      d.velocity.y -= 2.8 * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      if (d.mesh.position.y < 0.03) {
        d.mesh.position.y = 0.03;
        d.velocity.y = Math.abs(d.velocity.y) * 0.25;
        d.velocity.x *= 0.94;
        d.velocity.z *= 0.94;
        d.spin.multiplyScalar(0.95);
      }
    }
    for (const p of this.particles) {
      const age = this.time / p.life;
      p.mesh.visible = age < 1;
      p.mesh.material.opacity = Math.max(0, 1 - age);
      p.mesh.scale.setScalar(p.size * (1 + this.time * (p.smoke ? 3.5 : 2.5)));
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(Math.exp(-dt * 1.5));
      p.velocity.y += dt * (p.smoke ? 0.35 : -0.6);
    }
    if (this.time > 5) this.active = false;
  }
  reset() {
    for (const d of this.debris) this.scene.remove(d.mesh);
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.debris = [];
    this.particles = [];
    this.active = false;
    this.flash.intensity = 0;
    this.plane.root.visible = true;
  }
}
