export class Controls {
  constructor(canvas, { onToggle=()=>{}, onLock=()=>{}, onError=()=>{} }={}) {
    this.canvas=canvas;this.keys=new Set();this.stick={x:0,y:0};this.lastMove=0;
    this.locked=false;this.onToggle=onToggle;this.onLock=onLock;this.onError=onError;
    this.handlers=[];
    const on=(target,type,fn)=>{target.addEventListener(type,fn);this.handlers.push(()=>target.removeEventListener(type,fn));};
    on(document,'keydown',e=>{
      if(e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName))return;
      if(['KeyW','KeyS','KeyA','KeyD','KeyG','KeyF','KeyR','KeyH','Enter','Space'].includes(e.code))e.preventDefault();
      if(!e.repeat && ['KeyG','KeyF','KeyR','KeyH','Enter'].includes(e.code))this.onToggle(e.code);
      if(this.locked)this.keys.add(e.code);
    });
    on(document,'keyup',e=>this.keys.delete(e.code));
    on(document,'mousemove',e=>{
      if(!this.locked)return;
      this.stick.x+=e.movementX*.012;this.stick.y+=e.movementY*.012;
      const length=Math.hypot(this.stick.x,this.stick.y);
      if(length>1){this.stick.x/=length;this.stick.y/=length;}
      this.lastMove=performance.now();
    });
    on(document,'pointerlockchange',()=>{
      this.locked=document.pointerLockElement===canvas;this.clear();this.onLock(this.locked);
    });
    on(document,'pointerlockerror',()=>this.onError('Mouse capture was blocked. Click Let’s fly again (desktop browser, HTTPS or localhost).'));
    on(window,'blur',()=>this.clear());
    on(canvas,'click',()=>this.lock());
  }
  lock(){
    if(this.locked)return;
    if(!this.canvas.requestPointerLock){this.onError('Use a desktop browser with Pointer Lock support.');return;}
    try {const result=this.canvas.requestPointerLock();if(result?.catch)result.catch(()=>this.onError('Mouse capture needs a fresh click. Click Let’s fly to try again.'));}
    catch{this.onError('Mouse capture needs a fresh click. Click Let’s fly to try again.');}
  }
  clear(){this.keys.clear();this.stick.x=0;this.stick.y=0;}
  update(dt,now=performance.now()){
    // No real OS cursor warping: pointer lock supplies unlimited relative motion.
    // A light continuous spring, then a stronger spring 110 ms after the last push.
    const decay=Math.exp(-(now-this.lastMove>110 ? 17 : .65)*dt);
    this.stick.x*=decay;this.stick.y*=decay;
    const r=Math.hypot(this.stick.x,this.stick.y),deadzone=.055;
    const gain=r>deadzone?(r-deadzone)/(1-deadzone)/r:0;
    return {yaw:this.stick.x*gain,pitch:this.stick.y*gain,
      roll:(this.keys.has('KeyA')?1:0)-(this.keys.has('KeyD')?1:0),
      throttleUp:this.keys.has('KeyW'),brake:this.keys.has('KeyS')};
  }
  dispose(){this.handlers.forEach(fn=>fn());this.clear();}
}
