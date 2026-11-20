export const T = Object.freeze({ player_speed:6, carry_capacity:10, lantern_cost:10, pickup_radius:1, interact_radius:2, pulse_cost:3, pulse_radius:5, night1_duration_s:300, flames:3, invuln_s:1.5, hit_drop_ratio:.5, pulse_stun_s:2, pulse_push_m:4, pulse_cooldown_s:3, safe_radius:6, shade_speed:4, shade_hit_radius:1 });
export const DT = 1/60;
export const dist = (a,b) => Math.hypot(a[0]-b[0],a[2]-b[2]);
export const round = n => Math.round(n*1000)/1000;
const posOut = p => p.map(round);
const idSort = (a,b) => a.id.localeCompare(b.id,'en',{numeric:true});
export function ring(n,r,c=[0,0,0],offset=0) { return Array.from({length:n},(_,i)=>{ const a=(offset+i*360/n)*Math.PI/180; return [c[0]+r*Math.cos(a),c[1],c[2]+r*Math.sin(a)]; }); }
function direction(a,b) { const d=dist(a,b); return d>1e-10?[(b[0]-a[0])/d,(b[2]-a[2])/d]:[1,0]; }
export class Game {
  constructor({seed=1,night=1,scenario={}}={}) {
    this.night=night; this.rng=seed>>>0; this.tick=0; this.sim_tick=0; this.state='playing'; this.score=0; this.events=[];
    this.timeTicks=(scenario.time_left_s??T.night1_duration_s)*60;
    this.input={move:[0,0],cam_yaw_deg:0,jump:false,interact:false,pulse:false};
    this.player={pos:[0,0,0],vel:[0,0,0],carried:0,flames:T.flames,grounded:true,invuln:0,pulseCD:0,respawn:0,facing:[0,1],...structuredClone(scenario.player??{})};
    this.player.grounded=this.player.pos[1]===0;
    this.lanterns=[[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]].map((pos,i)=>({id:`L${i+1}`,pos,lit:false,deposited:0}));
    for(const item of scenario.lanterns??[]) { const l=this.lanterns.find(l=>l.id===item.id); Object.assign(l,structuredClone(item)); if(l.lit) l.deposited=T.lantern_cost; if(l.deposited>=T.lantern_cost) l.lit=true; }
    this.motePoints=[...ring(8,12),...ring(16,33)]; this.shadePoints=ring(12,37,[0,0,0],15);
    this.randomMotes=scenario.random_motes??true; this.randomShades=scenario.random_shades??true;
    this.moteId=0; this.shadeId=0; this.motes=[]; this.shades=[];
    if(scenario.motes) for(const pos of scenario.motes) this.addMote(pos);
    else if(this.randomMotes) for(let i=0;i<20;i++) this.spawnMote();
    for(const item of scenario.shades??[]) this.addShade(item);
  }
  random() { this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0; return this.rng/4294967296; }
  emit(name,data={}) { this.events.push({type:'event',tick:this.tick,name,data}); }
  addMote(pos,kind='random',ttl=0) { this.motes.push({id:`M${++this.moteId}`,pos:[...pos],kind,ttl,born:this.sim_tick}); }
  spawnMote() { const free=this.motePoints.filter(p=>!this.motes.some(m=>dist(m.pos,p)<.1&&Math.abs(m.pos[1]-p[1])<.1)); if(free.length&&this.motes.length<30) this.addMote(free[Math.floor(this.random()*free.length)]); }
  addShade(item={}) { const id=item.id??`S${++this.shadeId}`; this.shadeId=Math.max(this.shadeId,Number(id.match(/^S(\d+)$/)?.[1]??0)); this.shades.push({id,pos:[...(item.pos??[37,.8,0])],state:item.state??'wander',remaining:item.state_ticks_left??0,push:0,pushDir:[1,0],born:-1}); this.shades.sort(idSort); }
  spawnShade() { const free=this.shadePoints.filter(p=>dist(p,this.player.pos)>=15&&!this.lanterns.some(l=>l.lit&&dist(l.pos,p)<6)); if(this.shades.length>=6||!free.length)return; const p=free[Math.floor(this.random()*free.length)]; this.addShade({pos:[p[0],p[1]+.8,p[2]]}); const s=this.shades.at(-1); s.born=this.sim_tick; this.emit('shade_spawned',{id:s.id}); }
  floorAt(x,z) { return Math.hypot(x,z)<=40?0:-Infinity; }
  movePlayer(edge) {
    const p=this.player;
    if(p.respawn>0) { if(--p.respawn===0) { p.pos=[0,0,0];p.vel=[0,0,0];p.grounded=true;p.invuln=90; } return; }
    let [x,z]=this.input.move; const len=Math.hypot(x,z); if(len>1) { x/=len;z/=len; }
    const a=this.input.cam_yaw_deg*Math.PI/180; const dx=x*Math.cos(a)+z*Math.sin(a),dz=-x*Math.sin(a)+z*Math.cos(a);
    if(len>0) p.facing=[dx/(Math.hypot(dx,dz)||1),dz/(Math.hypot(dx,dz)||1)];
    p.vel[0]=dx*T.player_speed;p.vel[2]=dz*T.player_speed;
    if(edge.jump&&p.grounded) { p.vel[1]=7;p.grounded=false; }
    if(!p.grounded) p.vel[1]-=20*DT;
    p.pos=p.pos.map((v,i)=>v+p.vel[i]*DT);
    const floor=this.floorAt(p.pos[0],p.pos[2]);
    if(p.pos[1]<=floor&&p.vel[1]<=0) { p.pos[1]=floor;p.vel[1]=0;p.grounded=true; } else if(p.pos[1]>floor) p.grounded=false;
    if(p.pos[1]<-10) { const lost=p.carried; p.flames--;p.carried=0;p.respawn=60;p.vel=[0,0,0];this.emit('player_hit',{by:'fall',flames:p.flames,dropped:0,lost}); }
  }
  dropMotes(amount,pos=this.player.pos) { for(let i=0;i<amount;i++) { const a=this.random()*Math.PI*2,r=1.5+this.random();const x=pos[0]+Math.cos(a)*r,z=pos[2]+Math.sin(a)*r;const h=this.floorAt(x,z);this.addMote([x,Number.isFinite(h)?h:pos[1],z],'dropped',480); } }
  pickup() { const p=this.player;if(p.respawn)return;this.motes=this.motes.filter(m=>{ if(m.born===this.sim_tick||p.carried>=T.carry_capacity||dist(m.pos,p.pos)>T.pickup_radius+1e-9||Math.abs(m.pos[1]-p.pos[1])>1.5)return true;p.carried++;this.emit('mote_picked',{carried:p.carried});return false; }); }
  deposit() { const p=this.player;if(p.respawn||!p.carried)return;const ls=this.lanterns.filter(l=>!l.lit&&dist(l.pos,p.pos)<=T.interact_radius+1e-9).sort((a,b)=>dist(a.pos,p.pos)-dist(b.pos,p.pos)||idSort(a,b));const l=ls[0];if(!l)return;const amount=Math.min(p.carried,T.lantern_cost-l.deposited);p.carried-=amount;l.deposited+=amount;this.score+=amount*10;this.emit('deposit',{lantern_id:l.id,amount,deposited:l.deposited});if(l.deposited>=T.lantern_cost){l.lit=true;this.score+=100;this.emit('lantern_lit',{lantern_id:l.id});} }
  pulse() { const p=this.player;if(p.respawn||p.pulseCD>0||p.carried<T.pulse_cost)return;p.carried-=T.pulse_cost;p.pulseCD=180;const stunned=[];for(const s of this.shades)if(dist(s.pos,p.pos)<=T.pulse_radius+1e-9){s.state='stunned';s.remaining=120;s.push=15;s.pushDir=direction(p.pos,s.pos);stunned.push(s.id);this.score+=5;}this.emit('pulse',{stunned_ids:stunned}); }
  safeMove(s,dx,dz) { const next=[s.pos[0]+dx,s.pos[1],s.pos[2]+dz];if(!Number.isFinite(this.floorAt(next[0],next[2])))return;for(const l of this.lanterns)if(l.lit&&dist(next,l.pos)<6){const d=direction(l.pos,next);next[0]=l.pos[0]+d[0]*6;next[2]=l.pos[2]+d[1]*6;}s.pos=next; }
  moveShades() { for(const s of this.shades) { if(s.born===this.sim_tick)continue; const safe=this.lanterns.find(l=>l.lit&&dist(l.pos,s.pos)<6);if(safe){const d=direction(safe.pos,s.pos);s.pos[0]=safe.pos[0]+d[0]*6;s.pos[2]=safe.pos[2]+d[1]*6;continue;}
      if(s.state==='stunned'){if(s.push>0){this.safeMove(s,s.pushDir[0]*4/15,s.pushDir[1]*4/15);s.push--;}if(s.remaining<=0)s.state='wander';else continue;}
      if(s.state==='recoil'){this.safeMove(s,s.pushDir[0]*2/60,s.pushDir[1]*2/60);if(s.remaining<=0)s.state='wander';else continue;}
      const d=dist(s.pos,this.player.pos);if(d<=12)s.state='chase';else if(d>18)s.state='wander';if(s.state==='chase'&&!this.player.respawn){const dir=direction(s.pos,this.player.pos);this.safeMove(s,dir[0]*4*DT,dir[1]*4*DT);}
    } }
  contacts() { const p=this.player;if(p.invuln||p.respawn)return;for(const s of this.shades){if(s.born===this.sim_tick||s.state==='stunned'||s.state==='recoil'||this.lanterns.some(l=>l.lit&&dist(l.pos,s.pos)<6-1e-9))continue;if(dist(s.pos,p.pos)<=1+1e-9&&Math.abs(s.pos[1]-p.pos[1])<=1.5){p.flames--;const dropped=Math.floor(p.carried*.5);p.carried-=dropped;p.invuln=90;this.dropMotes(dropped);s.state='recoil';s.remaining=60;s.pushDir=direction(p.pos,s.pos);this.emit('player_hit',{by:'shade',flames:p.flames,dropped});break;}} }
  finish() { let reason;if(this.player.flames<=0){this.state='lost';reason='no_flames';}else if(this.lanterns.every(l=>l.lit)){this.state='won';reason='all_lit';this.score+=Math.floor(Math.max(0,this.timeTicks)/60)*2+this.player.flames*50;}else if(this.timeTicks<=0){this.state='lost';reason='dawn';}if(reason)this.emit('game_over',{result:this.state,reason}); }
  step(change={}) { if(this.state!=='playing')return [];this.events=[];const old=this.input;this.input={...old,...change};const edge=Object.fromEntries(['jump','interact','pulse'].map(k=>[k,!old[k]&&this.input[k]]));this.tick++;this.sim_tick++;this.timeTicks=Math.max(0,this.timeTicks-1);const p=this.player;p.invuln=Math.max(0,p.invuln-1);p.pulseCD=Math.max(0,p.pulseCD-1);for(const s of this.shades)s.remaining=Math.max(0,s.remaining-1);this.motes=this.motes.filter(m=>m.kind!=='dropped'||--m.ttl>0);
    this.movePlayer(edge);this.pickup();if(edge.interact)this.deposit();if(edge.pulse)this.pulse();this.moveShades();this.contacts();if(this.randomMotes&&this.sim_tick%240===0)this.spawnMote();if(this.randomShades&&(this.sim_tick===300||(this.sim_tick>300&&(this.sim_tick-300)%480===0))){this.spawnShade();if(this.sim_tick===300)this.spawnShade();}this.finish();return this.events;
  }
  snapshot() {return {type:'snapshot',tick:this.tick,sim_tick:this.sim_tick,state:this.state,time_left_s:round(this.timeTicks/60),score:this.score,player:{pos:posOut(this.player.pos),flames:this.player.flames,carried:this.player.carried},lanterns:this.lanterns.map(l=>({...l,pos:posOut(l.pos)})),shades:this.shades.map(s=>({id:s.id,pos:posOut(s.pos),state:s.state})),motes_active:this.motes.length,motes:this.motes.map(m=>({id:m.id,pos:posOut(m.pos)}))}; }
}
