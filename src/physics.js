import * as THREE from 'three';

export const GRAVITY=2.3; // deliberately toy-like: easier than full earth gravity at this scale
export const GEAR_CLEARANCE=.068;
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1);
const clamp=THREE.MathUtils.clamp;
export function createFlightState(spawn,pad){
  return {position:spawn.clone(),velocity:new THREE.Vector3(),quaternion:new THREE.Quaternion(),
    pitch:0,yaw:0,roll:0,throttle:0,gearDown:true,gearExtension:1,flapsDown:false,
    grounded:pad,crashed:false,stall:false,hasFlown:false,landings:0,airTime:0,elapsed:0};
}
export function padContains(pad,p,margin=0){return Math.abs(p.x-pad.x)<=pad.w/2-margin && Math.abs(p.z-pad.z)<=pad.d/2-margin;}
export function assessLanding(s){
  const speed=Math.hypot(s.velocity.x,s.velocity.z),sink=Math.max(0,-s.velocity.y);
  if(Math.abs(s.roll)>.36 || s.pitch<-.22 || s.pitch>.44)return 'Keep your wings level and your nose gently up at touchdown.';
  if(!s.gearDown || s.gearExtension<.85){
    if(speed<.45 && sink<.12)return 'scrape';
    return 'Wheels first! Press G to lower your landing gear.';
  }
  if(sink>.62)return 'A little too bumpy. Pull back gently to soften your landing.';
  if(speed>(s.flapsDown?1.55:1.35))return 'Too fast for touchdown! Press F for flaps, then ease off with S.';
  return 'success';
}

export function stepFlight(s,input,dt,room,events={}){
  if(s.crashed)return;
  const crash=reason=>{s.crashed=true;s.throttle=0;events.crash?.(reason);};
  s.elapsed+=dt;
  if(input.throttleUp)s.throttle=clamp(s.throttle+.48*dt,0,1);
  if(input.brake)s.throttle=clamp(s.throttle-.7*dt,0,1);
  s.gearExtension=THREE.MathUtils.damp(s.gearExtension,s.gearDown?1:0,9,dt);
  const grounded=!!s.grounded;
  s.pitch=clamp(s.pitch+(input.pitch*1.8-s.pitch*(grounded?1.2:.55))*dt,-.67,.67);
  s.roll=clamp(s.roll+(input.roll*1.85-s.roll*(input.roll? .15:1.35))*dt,-1.1,1.1);
  if(grounded)s.roll=THREE.MathUtils.damp(s.roll,0,10,dt);
  s.yaw+=(-input.yaw*(grounded?.8:1.65)+s.roll*.95+ (grounded?input.roll*.48:0))*dt;
  s.quaternion.setFromEuler(new THREE.Euler(s.pitch,s.yaw,s.roll,'YXZ'));
  const forward=FORWARD.clone().applyQuaternion(s.quaternion),up=UP.clone().applyQuaternion(s.quaternion);
  const previous=s.position.clone(), clearance=.033+.035*s.gearExtension;
  const speed=s.velocity.length();
  const flatForward=new THREE.Vector3(forward.x,0,forward.z).normalize();
  if(grounded){
    const pad=s.grounded;
    const signed=s.velocity.dot(flatForward);
    const acceleration=s.throttle*2.5 - (.13+.23*speed+.35*speed*speed)*(speed>.015?1:0) - (input.brake?3.6:0);
    const v=Math.max(0,signed+acceleration*dt);
    s.velocity.copy(flatForward).multiplyScalar(v);s.position.addScaledVector(s.velocity,dt);
    s.position.y=pad.y+clearance;s.velocity.y=0;s.stall=false;
    if(v>(s.flapsDown?.72:.85) && s.pitch>.065){
      s.grounded=null;s.velocity.y=.24+s.pitch*.6;s.hasFlown=true;events.takeoff?.();
    }else if(!padContains(pad,s.position,-.012)){
      s.grounded=null;s.hasFlown=true;
    }
  }else{
    s.airTime+=dt;
    const flightAngle=Math.atan2(s.velocity.y,Math.max(.15,Math.hypot(s.velocity.x,s.velocity.z)));
    const aoa=clamp(s.pitch-flightAngle,-.5,.65);
    const stallSpeed=s.flapsDown?.62:.76;
    s.stall=speed<stallSpeed;
    const cl=clamp(.6+aoa*3.5,.05,1.7)*(s.flapsDown?1.4:1);
    let lift=Math.min(GRAVITY*1.9,GRAVITY*speed*speed*cl);
    if(s.stall){lift*=.55;s.pitch=Math.max(-.5,s.pitch-.28*dt);}
    const direction=speed>.01?s.velocity.clone().divideScalar(speed):flatForward;
    const liftDirection=up.clone().addScaledVector(direction,-up.dot(direction)).normalize();
    const induced=.08*cl*cl*speed*speed;
    const drag=.14*speed+(.35+(s.flapsDown?.31:0)+.10*s.gearExtension)*speed*speed+induced;
    const acceleration=forward.multiplyScalar(s.throttle*2.5).addScaledVector(liftDirection,lift).addScaledVector(direction,-drag);
    acceleration.y-=GRAVITY;
    s.velocity.addScaledVector(acceleration,dt);
    // Arcade sideslip correction makes a toy-sized room navigable without rudder pedals.
    const horizontal=Math.hypot(s.velocity.x,s.velocity.z);
    const align=1-Math.exp(-1.5*dt);
    s.velocity.x=THREE.MathUtils.lerp(s.velocity.x,flatForward.x*horizontal,align);
    s.velocity.z=THREE.MathUtils.lerp(s.velocity.z,flatForward.z*horizontal,align);
    s.position.addScaledVector(s.velocity,dt);
    for(const pad of room.pads){
      if(padContains(pad,s.position,.012) && s.velocity.y<=0 && previous.y-clearance>=pad.y-.012 && s.position.y-clearance<=pad.y){
        const verdict=assessLanding(s);
        if(verdict!=='success' && verdict!=='scrape'){crash(verdict);return;}
        s.position.y=pad.y+clearance;s.velocity.y=0;s.grounded=pad;s.pitch=0;s.roll=0;
        if(verdict==='scrape'){s.throttle=0;s.velocity.multiplyScalar(.3);events.scrape?.(pad);}
        else {s.landings++;events.landing?.(pad);}
        break;
      }
    }
  }
  // Room shell, including the visually cut-away near wall.
  const p=s.position;
  if(p.x< -2.94 || p.x>2.94 || p.z< -3.94 || p.z>3.94 || p.y>.0+2.64 || p.y<clearance-.008){
    crash(p.y<clearance?'The floor is not a runway. Aim for a glowing landing pad!':'Whoops, that was the edge of the room!');return;
  }
  // Probe the fuselage, nose and wingtips so cartwheels and nose-ins count too.
  const probes=[new THREE.Vector3(),new THREE.Vector3(0,0,-.145),new THREE.Vector3(-.17,0,-.015),new THREE.Vector3(.17,0,-.015)];
  for(const offset of probes){
    const point=offset.applyQuaternion(s.quaternion).add(p);
    for(const c of room.colliders){
      const eps=.008;
      if(point.x>c.min.x-eps && point.x<c.max.x+eps && point.z>c.min.z-eps && point.z<c.max.z+eps && point.y>c.min.y-eps && point.y<c.max.y+eps){
        crash(`Ouch, the ${c.name.toLowerCase()}! Line up a little higher and slower next time.`);return;
      }
    }
  }
}
