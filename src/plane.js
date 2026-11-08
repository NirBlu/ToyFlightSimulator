import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...extra });
const coral = material('#ef6c46'), cream = material('#ffebba'), teal = material('#166575');
const rubber = material('#253345'), metal = material('#b9d3d0', { metalness: 0.55, roughness: 0.3 });
function mesh(geometry, mat, parent, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(...pos);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const box = (w, h, d, mat, parent, pos) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, pos);

export function createPlane() {
  const root = new THREE.Group(); root.name = 'ToyPlane';
  const primitives = new THREE.Group(); primitives.name = 'ReplaceablePlanePrimitives'; root.add(primitives);
  const pieces = []; const flaps = []; const gears = [];
  const part = (name, x=0, y=0, z=0) => {
    const group = new THREE.Group(); group.name = name; group.position.set(x,y,z);
    primitives.add(group); pieces.push(group); return group;
  };
  const body = part('Fuselage');
  const fuselage = mesh(new THREE.SphereGeometry(1, 24, 16), coral, body); fuselage.scale.set(.037, .035, .153);
  const nose = mesh(new THREE.SphereGeometry(.035, 20, 12), cream, body, [0,0,-.122]); nose.scale.z = .6;
  const canopy = mesh(new THREE.SphereGeometry(.027, 16, 12), material('#72c8cd', { metalness:.2, roughness:.16 }), body, [0,.026,-.027]); canopy.scale.set(.85,.8,1.65);
  box(.018,.004,.095,cream,body,[0,.034,.07]);
  for (const side of [-1,1]) {
    const wing = part(side < 0 ? 'LeftWing' : 'RightWing', side*.092, -.005, -.016);
    box(.167,.009,.067,cream,wing,[0,0,0]);
    box(.021,.010,.067,coral,wing,[side*.071,0,0]);
    box(.04,.0105,.012,teal,wing,[side*.022,.001,-.012]);
    const flap = new THREE.Group(); flap.position.set(-side*.018,0,.032); wing.add(flap); flaps.push(flap);
    box(.095,.006,.022,coral,flap,[0,0,.009]);
    const light = mesh(new THREE.SphereGeometry(.005,8,6),material(side<0?'#f36a65':'#8dffbf',{emissive:side<0?'#af2424':'#37b973',emissiveIntensity:1}),wing,[side*.082,.003,0]);
    light.name = 'WingtipLight';
  }
  const tail = part('Tail',0,.005,.115);
  box(.117,.007,.035,cream,tail,[0,0,0]); box(.007,.058,.035,teal,tail,[0,.025,.004]);
  box(.12,.008,.009,coral,tail,[0,0,.014]);
  const propeller = part('Propeller',0,0,-.158);
  box(.009,.113,.005,teal,propeller); box(.113,.009,.005,teal,propeller);
  mesh(new THREE.SphereGeometry(.012,12,8),coral,propeller,[0,0,-.005]);
  for (const [i, x, z] of [[0,-.035,-.04],[1,.035,-.04],[2,0,.104]]) {
    const gear = part(`Gear${i}`,x,-.018,z); gears.push(gear);
    box(.004,.033,.004,metal,gear,[0,-.014,0]);
    const wheel = mesh(new THREE.CylinderGeometry(.013,.013,.009,12),rubber,gear,[0,-.037,0]); wheel.rotation.z = Math.PI/2;
    const hub=mesh(new THREE.CylinderGeometry(.005,.005,.01,10),cream,gear,[0,-.037,0]); hub.rotation.z=Math.PI/2;
  }
  return { root, primitives, pieces, flaps, gears, propeller, importedModel:null, gearBlend:1, flapBlend:0 };
}

export function animatePlane(plane, state, dt) {
  plane.propeller.rotation.z += (12 + state.throttle * 190) * dt;
  const blend = 1 - Math.exp(-9*dt);
  plane.gearBlend += ((state.gearDown ? 1 : 0)-plane.gearBlend)*blend;
  plane.flapBlend += ((state.flapsDown ? 1 : 0)-plane.flapBlend)*blend;
  plane.gears.forEach((g,i) => { g.rotation.z = (1-plane.gearBlend)*(i===0 ? -1.45 : 1.45); g.visible=plane.gearBlend>.025; });
  plane.flaps.forEach(f => { f.rotation.x = plane.flapBlend*.48; });
}

/** Drop a .glb under public/models. Author in meters, nose -Z, up +Y, origin at CG.
 * Primitives remain the crash rig; a custom model is hidden on impact. */
export async function loadPlaneModel(plane, url, { scale=1 } = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  if (plane.importedModel) plane.root.remove(plane.importedModel);
  const model = gltf.scene; model.scale.setScalar(scale);
  model.traverse(n => { if(n.isMesh) { n.castShadow=true; n.receiveShadow=true; } });
  plane.root.add(model); plane.importedModel = model; plane.primitives.visible=false;
  return model;
}
