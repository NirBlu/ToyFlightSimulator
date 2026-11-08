import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createFlightState,stepFlight,assessLanding,padContains} from '../src/physics.js';
const pad={id:'dining',name:'dining table',x:-1.4,y:.78,z:1.5,w:1.36,d:2.18};
const room=()=>({pads:[pad],colliders:[{min:new Vector3(-2.08,.69,.41),max:new Vector3(-.72,.78,2.59),name:'Dining table'}]});
const neutral={pitch:0,yaw:0,roll:0,throttleUp:false,brake:false};
const spawn=()=>createFlightState(new Vector3(-1.4,.848,2.28),pad);
const flight=()=>{const s=spawn();s.position.set(0,1.5,0);s.grounded=null;s.hasFlown=true;return s;};

test('rests on the table without falling or colliding',()=>{
  const s=spawn();for(let i=0;i<240;i++)stepFlight(s,neutral,1/120,room());
  assert.equal(s.crashed,false);assert.equal(s.grounded,pad);assert.ok(Math.abs(s.position.y-.848)<1e-6);
});
test('throttle is bounded and wheel brakes stop the plane',()=>{
  const s=spawn();s.throttle=.9;s.velocity.z=-.5;
  for(let i=0;i<120;i++)stepFlight(s,{...neutral,brake:true},1/120,room());
  assert.ok(s.throttle<.21);assert.ok(s.velocity.length()<.01);assert.equal(s.crashed,false);
});
test('holding W and pulling back achieves table takeoff',()=>{
  const s=spawn();let tookOff=false;
  for(let i=0;i<280;i++)stepFlight(s,{...neutral,throttleUp:true,pitch:!s.hasFlown&&s.velocity.length()>.86?.8:0},1/120,room(),{takeoff:()=>{tookOff=true;}});
  assert.ok(tookOff);assert.equal(s.grounded,null);assert.ok(s.position.y>.9);assert.equal(s.crashed,false);
});
test('flaps produce more drag and reduce airspeed',()=>{
  const a=flight(),b=flight();a.velocity.z=b.velocity.z=-1.5;b.flapsDown=true;
  for(let i=0;i<30;i++){stepFlight(a,neutral,1/120,{pads:[],colliders:[]});stepFlight(b,neutral,1/120,{pads:[],colliders:[]});}
  assert.ok(Math.hypot(b.velocity.x,b.velocity.z)<Math.hypot(a.velocity.x,a.velocity.z));
});
test('stall gently drops the nose rather than triggering an instant crash',()=>{
  const s=flight();s.velocity.z=-.3;s.pitch=.1;
  stepFlight(s,neutral,1/60,{pads:[],colliders:[]});assert.equal(s.stall,true);assert.ok(s.pitch<.1);assert.equal(s.crashed,false);
});
test('gentle gear-down touchdown succeeds and names the surface',()=>{
  const s=flight();s.position.set(-1.4,.85,1.5);s.velocity.set(0,-.2,-.5);let landed='';
  for(let i=0;i<6;i++)stepFlight(s,neutral,1/120,room(),{landing:p=>{landed=p.name;}});
  assert.equal(landed,'dining table');assert.equal(s.grounded,pad);assert.equal(s.landings,1);assert.equal(s.crashed,false);
});
test('steep, banked, fast, and hard gear-up touchdowns fail',()=>{
  const s=flight();s.velocity.set(0,-.3,-.7);assert.equal(assessLanding(s),'success');
  s.roll=.6;assert.notEqual(assessLanding(s),'success');s.roll=0;
  s.velocity.y=-1;assert.notEqual(assessLanding(s),'success');s.velocity.set(0,-.3,-2);assert.notEqual(assessLanding(s),'success');
  s.velocity.set(0,-.3,-.7);s.gearDown=false;assert.notEqual(assessLanding(s),'success');
});
test('gear must be physically extended, not merely toggled at impact',()=>{
  const s=flight();s.gearDown=true;s.gearExtension=.4;s.velocity.set(0,-.2,-.7);
  assert.notEqual(assessLanding(s),'success');
});
test('very slow gear-up contact is a survivable scrape',()=>{
  const s=flight();s.gearDown=false;s.velocity.set(0,-.05,-.2);assert.equal(assessLanding(s),'scrape');
});
test('wall impact triggers crash once',()=>{
  const s=flight();s.position.x=2.99;let n=0;
  stepFlight(s,neutral,1/120,{pads:[],colliders:[]},{crash:()=>n++});
  stepFlight(s,neutral,1/120,{pads:[],colliders:[]},{crash:()=>n++});
  assert.equal(s.crashed,true);assert.equal(n,1);
});
test('furniture and wingtip impacts trigger destruction callback',()=>{
  const s=flight();let reason='';
  const obstacle={min:new Vector3(.15,1.4,-.1),max:new Vector3(.3,1.6,.1),name:'Bookcase'};
  stepFlight(s,neutral,1/120,{pads:[],colliders:[obstacle]},{crash:r=>reason=r});
  assert.equal(s.crashed,true);assert.match(reason,/bookcase/);
});
test('landing boundaries do not accept a pad outside its marked area',()=>{
  assert.equal(padContains(pad,new Vector3(-1.4,1,1.5)),true);
  assert.equal(padContains(pad,new Vector3(0,1,1.5)),false);
});
