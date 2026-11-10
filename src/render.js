// Canvas renderer: isometric town, residents, camera (pan, pinch zoom).
import { G, curMin, clamp } from './game.js';
import { TW, TH, hash, isRoad, ring, plots, plotAt, tierOf, cityAt } from './city.js';
import { t } from './i18n.js';

let cv, ctx;
let city = cityAt(0);
function shade(hex, amt){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255;
  if(amt>0){ r+= (255-r)*amt; g+=(255-g)*amt; b+=(255-b)*amt; } else { r*=1+amt; g*=1+amt; b*=1+amt; }
  return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')'; }

// ---------- residents ----------
const SPECIES = ['bunny','cat','bear','chick','frog','pig'];
const CHAR_COL = {bunny:'#fff4f8',cat:'#ffd9a8',bear:'#d9b08c',chick:'#ffe680',frog:'#a8e6a1',pig:'#ffc4d6'};
let chars = [];
function walkable(x,y){
  if (ring(x,y) > city.R) return false;
  if (isRoad(x,y)) return true;
  const p = plotAt[x+','+y]; if(!p) return false;
  if (p.t > curMin()) return true;
  return p.kind==='trees' || p.kind==='garden';
}
function randomWalkable(){
  for(let k=0;k<200;k++){ const x=Math.floor(Math.random()*(2*city.R+1))-city.R, y=Math.floor(Math.random()*(2*city.R+1))-city.R; if(walkable(x,y)) return {x,y}; }
  return {x:city.R, y:city.R};
}
function newChar(i){
  const sp = SPECIES[i%SPECIES.length]; const c = randomWalkable();
  return {sp, x:c.x, y:c.y, cx:c.x, cy:c.y, tx:c.x, ty:c.y, wait:Math.random()*2, phase:Math.random()*6, dir:1, bubble:0, bt:''};
}
export function syncChars(all){
  if (all) chars=[];
  while(chars.length < city.pop) chars.push(newChar(chars.length));
  if (chars.length > city.pop) chars.length = city.pop;
  chars.forEach(c=>{ if(!walkable(c.cx,c.cy)){ const p=randomWalkable(); c.x=c.cx=c.tx=p.x; c.y=c.cy=c.ty=p.y; } });
}
function updateChars(dt){
  const studying = G.timer.running;
  for(const c of chars){
    const dx=c.tx-c.x, dy=c.ty-c.y, d=Math.hypot(dx,dy);
    if (d>0.01){ const sp=0.9*dt; if(d<=sp){c.x=c.tx;c.y=c.ty;} else {c.x+=dx/d*sp; c.y+=dy/d*sp;} c.phase+=dt*12; if(Math.abs(dx-dy)>0.01) c.dir = (dx-dy)>0?1:-1; }
    else {
      c.cx=c.tx; c.cy=c.ty; c.wait-=dt;
      if (c.wait<=0){
        const opts=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[c.cx+a,c.cy+b]).filter(([a,b])=>walkable(a,b));
        if(opts.length){ const o=opts[Math.floor(Math.random()*opts.length)]; c.tx=o[0]; c.ty=o[1]; }
        c.wait = Math.random()<0.3 ? 1+Math.random()*3 : 0;
        if (Math.random()<0.06){ c.bubble=2.2; c.bt = studying ? ['📖','✏️','💪','⭐'][Math.floor(Math.random()*4)] : ['♪','💕','✨','🌸'][Math.floor(Math.random()*4)]; }
      }
    }
    if (c.bubble>0) c.bubble-=dt;
  }
}

// ---------- drawing ----------
let W=0,H=0,DPR=1, scale=1, userZoom=1, panX=0, panY=0;
function resize(){ const r=cv.getBoundingClientRect(); DPR=Math.min(2,window.devicePixelRatio||1); W=r.width; H=r.height; cv.width=Math.max(1,W*DPR); cv.height=Math.max(1,H*DPR); }
const P = (gx,gy) => [(gx-gy)*TW/2, (gx+gy)*TH/2];
function poly(pts, fill, stroke){ ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();} }
function prism(cx,cy,f,h,base,opt={}){
  const hw=f*TW/2, hh=f*TH/2;
  const L=[cx-hw,cy], B=[cx,cy+hh], R=[cx+hw,cy], T=[cx,cy-hh];
  const up=p=>[p[0],p[1]-h];
  poly([L,B,up(B),up(L)], opt.left||shade(base,-0.12));
  poly([B,R,up(R),up(B)], opt.right||shade(base,-0.25));
  poly([up(T),up(R),up(B),up(L)], opt.top||shade(base,0.15));
  return {L,B,R,T,h};
}
function faceQuad(a,b,u0,u1,v0,v1,fill){ const p=(u,v)=>[a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u-v]; poly([p(u0,v0),p(u1,v0),p(u1,v1),p(u0,v1)],fill); }
function windows(pr, floors, floorH, base0, night, seed){
  for(let f=0;f<floors;f++){
    const v0=base0+f*floorH+5, v1=v0+floorH-9;
    for(const [u0,u1] of [[0.18,0.40],[0.60,0.82]]){
      const litL = night && hash(seed,f*7+u0*10,1)>0.35, litR = night && hash(seed,f*7+u0*10,2)>0.35;
      faceQuad(pr.L,pr.B,u0,u1,v0,v1, litL?'#ffe48a':'#cfeaff');
      faceQuad(pr.B,pr.R,u0,u1,v0,v1, litR?'#f5cf6a':'#a9d4f0');
    }
  }
}
function pyramidRoof(cx,cy,f,h,rh,col){
  const hw=f*TW/2, hh=f*TH/2, y=cy-h;
  const L=[cx-hw,y], B=[cx,y+hh], R=[cx+hw,y], A=[cx,y-rh];
  poly([L,B,A], shade(col,0)); poly([B,R,A], shade(col,-0.22));
}
function tree(x,y,s,col){
  ctx.fillStyle='rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x,y,8*s,4*s,0,0,7); ctx.fill();
  ctx.fillStyle='#a8754f'; ctx.fillRect(x-2*s,y-12*s,4*s,12*s);
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y-18*s,10*s,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x-3.5*s,y-21*s,3.5*s,0,7); ctx.fill();
}
function flower(x,y,col){ ctx.fillStyle=col; for(let k=0;k<5;k++){ const a=k*1.256; ctx.beginPath(); ctx.arc(x+Math.cos(a)*1.8,y+Math.sin(a)*1.8,1.5,0,7); ctx.fill(); } ctx.fillStyle='#ffe066'; ctx.beginPath(); ctx.arc(x,y,1.2,0,7); ctx.fill(); }

function drawPlot(p, minutes, night, now){
  const [cx,cy] = P(p.x,p.y);
  const tier = tierOf(p, minutes);
  const a = G.anims[p.i]; let g = 1;
  if (a){ const t=(now-a)/900; if(t>=1){ delete G.anims[p.i]; } else { g = 1 - Math.pow(1-t,3)*Math.cos(t*4); g=clamp(g,0.05,1.2); } }
  ctx.save(); ctx.translate(cx,cy); ctx.scale(1,g); ctx.translate(-cx,-cy);
  const seed = p.x*31+p.y;
  if (p.kind==='hall'){
    if (tier===0){ // tent
      poly([[cx-20,cy+2],[cx,cy+12],[cx,cy-22]],'#ffb36b'); poly([[cx,cy+12],[cx+20,cy+2],[cx,cy-22]],'#f28c3c');
      poly([[cx-6,cy+9],[cx,cy+12],[cx,cy-4]],'#8a5a3c');
      ctx.strokeStyle='#8a5a3c'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(cx,cy-22); ctx.lineTo(cx,cy-34); ctx.stroke();
      poly([[cx,cy-34],[cx+10,cy-31],[cx,cy-28]],'#ff6f91');
      ctx.fillStyle='#ff9f43'; ctx.beginPath(); ctx.arc(cx+18,cy+12,3,0,7); ctx.fill(); // campfire
      ctx.fillStyle='#ffd36e'; ctx.beginPath(); ctx.arc(cx+18,cy+10,1.8+Math.sin(now/120),0,7); ctx.fill();
    } else if (tier===1){
      const pr=prism(cx,cy,0.62,20,'#ffe3c2'); windows(pr,1,16,0,night,seed);
      faceQuad(pr.L,pr.B,0.42,0.58,0,12,'#a8754f'); pyramidRoof(cx,cy,0.74,20,18,'#ff7f7f');
    } else if (tier===2){
      const pr=prism(cx,cy,0.82,34,'#fff1dc'); windows(pr,2,16,0,night,seed);
      faceQuad(pr.L,pr.B,0.42,0.58,0,14,'#a8754f');
      ctx.fillStyle='#ffb3c6'; ctx.beginPath(); ctx.ellipse(cx,cy-34,16,10,0,Math.PI,0); ctx.fill();
      ctx.fillStyle='#ffd36e'; ctx.beginPath(); ctx.arc(cx,cy-46,3,0,7); ctx.fill();
    } else {
      prism(cx,cy,0.85,10,'#e9dcc9');
      const pr=prism(cx,cy-10,0.5,72,'#fff1dc'); windows({L:[pr.L[0],pr.L[1]],B:pr.B,R:pr.R},3,16,0,night,seed);
      const [ox,oy]=[(pr.L[0]+pr.B[0])/2,(pr.L[1]+pr.B[1])/2-62];
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(ox,oy,6,7,0,0,7); ctx.fill(); ctx.strokeStyle='#4a3b52'; ctx.lineWidth=1.2; ctx.stroke();
      const ang=now/2000; ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox+Math.cos(ang)*4,oy+Math.sin(ang)*4); ctx.moveTo(ox,oy); ctx.lineTo(ox,oy-5); ctx.stroke();
      pyramidRoof(cx,cy-10,0.6,72,26,'#7fa8ff');
      ctx.strokeStyle='#4a3b52'; ctx.beginPath(); ctx.moveTo(cx,cy-108); ctx.lineTo(cx,cy-120); ctx.stroke();
      poly([[cx,cy-120],[cx+10,cy-117],[cx,cy-114]],'#ff6f91');
    }
  } else if (p.kind==='house'){
    if (tier===0){ const pr=prism(cx,cy,0.55,16,p.color); faceQuad(pr.L,pr.B,0.4,0.6,0,10,'#a8754f'); faceQuad(pr.B,pr.R,0.3,0.7,5,11,night?'#ffe48a':'#cfeaff'); pyramidRoof(cx,cy,0.66,16,16,p.roof); }
    else if (tier===1){ const pr=prism(cx,cy,0.6,32,p.color); windows(pr,2,16,0,night,seed); faceQuad(pr.L,pr.B,0.42,0.58,0,11,'#a8754f'); pyramidRoof(cx,cy,0.72,32,18,p.roof); }
    else if (tier===2){ const pr=prism(cx,cy,0.7,50,p.color); windows(pr,3,16,0,night,seed); prism(cx,cy-50,0.5,4,'#dddddd'); ctx.fillStyle='#8fd694'; ctx.beginPath(); ctx.arc(cx+6,cy-58,4,0,7); ctx.fill(); }
    else { const pr=prism(cx,cy,0.66,86,p.color); windows(pr,5,16,2,night,seed); prism(cx,cy-86,0.3,8,'#e6e0ea');
      ctx.strokeStyle='#888'; ctx.beginPath(); ctx.moveTo(cx,cy-94); ctx.lineTo(cx,cy-106); ctx.stroke(); ctx.fillStyle= (Math.floor(now/600)%2)?'#ff4d6d':'#ffb3c6'; ctx.beginPath(); ctx.arc(cx,cy-106,2,0,7); ctx.fill(); }
  } else if (p.kind==='shop'){
    const h=[16,30,44][tier]; const pr=prism(cx,cy,tier===2?0.78:0.6,h,'#fff7e6'); if(tier>0) windows(pr,tier+1,14,0,night,seed);
    // awning on left face
    const a0=[pr.L[0],pr.L[1]-12], b0=[pr.B[0],pr.B[1]-12];
    for(let k=0;k<6;k++){ const u0=k/6,u1=(k+1)/6; const pt=(u,d)=>[a0[0]+(b0[0]-a0[0])*u-d*0.9, a0[1]+(b0[1]-a0[1])*u+d*0.4]; poly([pt(u0,0),pt(u1,0),pt(u1,7),pt(u0,7)], k%2?'#fff':p.roof); }
    faceQuad(pr.L,pr.B,0.3,0.7,0,6, night?'#ffe48a':'#ffd36e');
    if (tier===2){ ctx.fillStyle=p.roof; ctx.font='bold 9px Mali'; ctx.fillText('SHOP', cx-12, cy-h+2); }
  } else if (p.kind==='trees'){
    const spots=[[0,0],[-12,-4],[11,-3],[0,-9]].slice(0,tier+1+(tier>1?1:0));
    spots.sort((a,b)=>a[1]-b[1]).forEach(([dx,dy],k)=>tree(cx+dx,cy+dy+4,0.8+hash(seed,k)*0.35, ['#7ccf7a','#5fbf6e','#9ad66a','#ff9fb8'][Math.floor(hash(seed,k,5)*4)]));
  } else if (p.kind==='garden'){
    poly([[cx-18,cy],[cx,cy+9],[cx+18,cy],[cx,cy-9]],'#c5ec9f');
    for(let k=0;k<9;k++){ const u=hash(seed,k,1)-0.5, v=hash(seed,k,2)-0.5; flower(cx+(u-v)*30, cy+(u+v)*15, ['#ff8fab','#ffd36e','#b08cff','#fff'][k%4]); }
    if (tier>=1){ ctx.fillStyle='#a8754f'; ctx.fillRect(cx+4,cy-6,12,3); ctx.fillRect(cx+5,cy-3,2,4); ctx.fillRect(cx+13,cy-3,2,4); }
    if (tier>=2){ ctx.fillStyle='#bfe6ff'; ctx.beginPath(); ctx.ellipse(cx-6,cy+2,9,4.5,0,0,7); ctx.fill(); ctx.strokeStyle='#e0d6c8'; ctx.lineWidth=2; ctx.stroke();
      const j=Math.sin(now/200)*1.5; ctx.fillStyle='rgba(124,198,254,.8)'; ctx.beginPath(); ctx.ellipse(cx-6,cy-6+j,2,6,0,0,7); ctx.fill(); }
  } else if (p.kind==='pond'){
    poly([[cx-24,cy],[cx,cy+12],[cx+24,cy],[cx,cy-12]],'#e8dcc4');
    poly([[cx-19,cy],[cx,cy+9.5],[cx+19,cy],[cx,cy-9.5]], night?'#4f7fb5':'#8fd3ff');
    ctx.fillStyle='rgba(255,255,255,.6)'; ctx.fillRect(cx-6+Math.sin(now/700)*3,cy-2,6,1.5);
    ctx.fillStyle='#7ccf7a'; ctx.beginPath(); ctx.arc(cx+7,cy+2,3,0,7); ctx.fill();
    const dk=now/1500+seed; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx+Math.cos(dk)*9,cy+Math.sin(dk)*4-2,2.5,0,7); ctx.fill(); ctx.fillStyle='#ffb347'; ctx.fillRect(cx+Math.cos(dk)*9+2,cy+Math.sin(dk)*4-3,2,1.2);
  }
  ctx.restore();
  if (a && now-a<900){ const t=(now-a)/900; ctx.fillStyle='rgba(255,255,255,'+(0.8*(1-t))+')'; for(let k=0;k<6;k++){ const an=k*1.05; ctx.beginPath(); ctx.arc(cx+Math.cos(an)*(10+t*18), cy+Math.sin(an)*(5+t*9), 4*(1-t)+1,0,7); ctx.fill(); }
    ctx.fillStyle='rgba(255,211,110,'+(1-t)+')'; for(let k=0;k<5;k++){ ctx.font='12px sans-serif'; ctx.fillText('✦', cx-20+k*10, cy-30-t*30-k*4); } }
}

function drawChar(c, now){
  const [sx,sy0] = P(c.x,c.y); const moving = Math.hypot(c.tx-c.x,c.ty-c.y)>0.01;
  const bob = moving ? Math.abs(Math.sin(c.phase))*3 : Math.sin(now/400+c.phase)*0.6;
  const sy = sy0; const by = sy-10-bob, col=CHAR_COL[c.sp], dk=shade(col,-0.35);
  ctx.fillStyle='rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(sx,sy,7,3,0,0,7); ctx.fill();
  ctx.lineWidth=1.2; ctx.strokeStyle=dk;
  const ear=(x,y,rx,ry,rot,f)=>{ ctx.fillStyle=f; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rot,0,7); ctx.fill(); ctx.stroke(); };
  if (c.sp==='bunny'){ ear(sx-3.5,by-10,2.6,6.5,-0.2,col); ear(sx+3.5,by-10,2.6,6.5,0.2,col); ctx.fillStyle='#ffc4d6'; ctx.beginPath(); ctx.ellipse(sx-3.5,by-10,1.1,4,-0.2,0,7); ctx.ellipse(sx+3.5,by-10,1.1,4,0.2,0,7); ctx.fill(); }
  if (c.sp==='bear'){ ear(sx-6,by-6,3,3,0,col); ear(sx+6,by-6,3,3,0,col); }
  if (c.sp==='cat'){ for(const s of [-1,1]){ ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(sx+s*7.5,by-3); ctx.lineTo(sx+s*6,by-12); ctx.lineTo(sx+s*1.5,by-7); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
  if (c.sp==='pig'){ for(const s of [-1,1]){ ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(sx+s*7,by-4); ctx.lineTo(sx+s*7,by-10); ctx.lineTo(sx+s*2.5,by-7); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
  if (c.sp==='frog'){ ear(sx-4.5,by-7,3.4,3.4,0,col); ear(sx+4.5,by-7,3.4,3.4,0,col); }
  // feet
  const fs = moving ? Math.sin(c.phase)*1.5 : 0; ctx.fillStyle=dk; ctx.beginPath(); ctx.ellipse(sx-3.5,sy-1+fs,2.4,1.5,0,0,7); ctx.ellipse(sx+3.5,sy-1-fs,2.4,1.5,0,0,7); ctx.fill();
  // body
  ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(sx,by,8.5,8,0,0,7); ctx.fill(); ctx.stroke();
  if (c.sp==='chick'){ ctx.strokeStyle='#e0b000'; ctx.beginPath(); ctx.moveTo(sx,by-8); ctx.quadraticCurveTo(sx+1,by-13,sx+3,by-12); ctx.stroke(); }
  const ex = c.dir*1.2, ey = c.sp==='frog' ? -7 : -1;
  const eyeX = c.sp==='frog'?4.5:3;
  ctx.fillStyle='#3b2f40'; ctx.beginPath(); ctx.arc(sx-eyeX+ex,by+ey,1.4,0,7); ctx.arc(sx+eyeX+ex,by+ey,1.4,0,7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx-eyeX+ex+0.5,by+ey-0.5,0.5,0,7); ctx.arc(sx+eyeX+ex+0.5,by+ey-0.5,0.5,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,130,160,.55)'; ctx.beginPath(); ctx.arc(sx-5.5+ex,by+2.5,1.8,0,7); ctx.arc(sx+5.5+ex,by+2.5,1.8,0,7); ctx.fill();
  if (c.sp==='chick'){ ctx.fillStyle='#ff9f43'; ctx.beginPath(); ctx.moveTo(sx+ex-1.6,by+1.5); ctx.lineTo(sx+ex+1.6,by+1.5); ctx.lineTo(sx+ex,by+3.5); ctx.fill(); }
  else if (c.sp==='pig'){ ctx.fillStyle='#ff9fbf'; ctx.beginPath(); ctx.ellipse(sx+ex,by+2.5,2.6,1.8,0,0,7); ctx.fill(); ctx.fillStyle=dk; ctx.fillRect(sx+ex-1.2,by+2,0.8,1); ctx.fillRect(sx+ex+0.4,by+2,0.8,1); }
  else { ctx.strokeStyle='#3b2f40'; ctx.lineWidth=0.9; ctx.beginPath(); ctx.arc(sx+ex-0.9,by+2,0.9,0,Math.PI); ctx.arc(sx+ex+0.9,by+2,0.9,0,Math.PI); ctx.stroke(); }
  if (c.bubble>0){ ctx.globalAlpha=clamp(c.bubble,0,1); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(sx+10,by-20,8,7,0,0,7); ctx.fill(); ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#4a3b52'; ctx.fillText(c.bt,sx+10,by-17); ctx.textAlign='start'; ctx.globalAlpha=1; }
}

const stars = Array.from({length:60},()=>[Math.random(),Math.random()*0.6,Math.random()]);
let lastT = performance.now();
function frame(now){
  const dt = Math.min(0.05,(now-lastT)/1000); lastT=now;
  const minutes = curMin();
  city = G.city = cityAt(minutes);
  syncChars(false); updateChars(dt);
  const hr = new Date().getHours()+new Date().getMinutes()/60;
  const night = hr>=19 || hr<6, dusk = (hr>=17&&hr<19)||(hr>=5&&hr<7);
  // sky
  const sky = ctx.createLinearGradient(0,0,0,H*DPR);
  if (night){ sky.addColorStop(0,'#2b2d5c'); sky.addColorStop(1,'#5b5590'); }
  else if (dusk){ sky.addColorStop(0,'#ffb4a2'); sky.addColorStop(1,'#ffe5c4'); }
  else { sky.addColorStop(0,'#bfe6ff'); sky.addColorStop(1,'#eaf7ff'); }
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle=sky; ctx.fillRect(0,0,cv.width,cv.height);
  if (night){ ctx.fillStyle='#fff'; for(const [x,y,t] of stars){ ctx.globalAlpha=0.4+0.6*Math.abs(Math.sin(now/900+t*9)); ctx.fillRect(x*cv.width,y*cv.height,2*DPR,2*DPR);} ctx.globalAlpha=1; }
  else { ctx.fillStyle='rgba(255,255,255,.85)'; for(let k=0;k<4;k++){ const x=((now/60000*(k+1)*0.6+k*0.27)%1.2-0.1)*W*DPR, y=(40+k*55)*DPR; ctx.beginPath(); ctx.ellipse(x,y,40*DPR,14*DPR,0,0,7); ctx.ellipse(x+26*DPR,y-8*DPR,24*DPR,14*DPR,0,0,7); ctx.fill(); } }
  // camera
  const R = city.R, span=(2*R+1);
  const target = clamp(Math.min(W/(span*TW*1.08), H/(span*TH*1.08+140)), 0.3, 2.6);
  scale += (target-scale)*0.06;
  const s = scale*userZoom;
  ctx.setTransform(DPR*s,0,0,DPR*s, DPR*(W/2+panX), DPR*(H/2+panY+45*s));
  // ground (back to front)
  const cells=[]; for(let x=-R;x<=R;x++) for(let y=-R;y<=R;y++) cells.push([x,y]);
  cells.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1]));
  for (const [x,y] of cells){
    const [cx,cy]=P(x,y); const road=isRoad(x,y);
    const g = road ? '#e9e1d6' : ((x+y)&1 ? '#a6e39a':'#9bdc8e');
    prism(cx,cy+0,1,0,g,{top:g});
    if (x===R || y===R){ // island side
      const hw=TW/2, hh=TH/2, d=18;
      if (y===R) poly([[cx-hw,cy],[cx,cy+hh],[cx,cy+hh+d],[cx-hw,cy+d]],'#c99a6e');
      if (x===R) poly([[cx,cy+hh],[cx+hw,cy],[cx+hw,cy+d],[cx,cy+hh+d]],'#a97c55');
      if (y===R){ ctx.fillStyle='#7cc46f'; poly([[cx-hw,cy],[cx,cy+hh],[cx,cy+hh+3],[cx-hw,cy+3]],'#86cf78'); }
      if (x===R){ poly([[cx,cy+hh],[cx+hw,cy],[cx+hw,cy+3],[cx,cy+hh+3]],'#74b866'); }
    }
    if (road){ // dashed line
      const hx=((x%4)+4)%4===2, hy=((y%4)+4)%4===2;
      ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]); ctx.beginPath();
      if (hx && !hy){ const a=P(x,y-0.5),b=P(x,y+0.5); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); }
      if (hy && !hx){ const a=P(x-0.5,y),b=P(x+0.5,y); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); }
      ctx.stroke(); ctx.setLineDash([]);
    } else if (!plotAt[x+','+y] || plotAt[x+','+y].t>minutes) {
      // little grass tufts on empty land
      const h1=hash(x,y,21); if(h1<0.5){ ctx.fillStyle='#7cc46f'; ctx.fillRect(cx-8+h1*20,cy-2,1.5,3); ctx.fillRect(cx-6+h1*20,cy-3,1.5,4); }
      if(hash(x,y,22)<0.15) flower(cx+hash(x,y,23)*16-8, cy+hash(x,y,24)*6-3, '#fff');
    }
  }
  // empty-land sign at start
  const objs=[];
  if (city.n===0){ const [cx,cy]=P(0,0); objs.push({d:0, f:()=>{
    const label=t('sign'); ctx.font='bold 8px Mali, sans-serif'; const w=Math.max(32, ctx.measureText(label).width+10);
    ctx.fillStyle='#a8754f'; ctx.fillRect(cx-1.5,cy-22,3,22); ctx.fillStyle='#e9c79a'; ctx.fillRect(cx-w/2,cy-34,w,14); ctx.strokeStyle='#a8754f'; ctx.lineWidth=1; ctx.strokeRect(cx-w/2,cy-34,w,14);
    ctx.fillStyle='#6b4a32'; ctx.textAlign='center'; ctx.fillText(label,cx,cy-24); ctx.textAlign='start'; }}); }
  for(let i=0;i<city.n;i++){ const p=plots[i]; objs.push({d:p.x+p.y, f:()=>drawPlot(p,minutes,night,now)}); }
  for(const c of chars) objs.push({d:c.x+c.y+0.3, f:()=>drawChar(c,now)});
  objs.sort((a,b)=>a.d-b.d).forEach(o=>o.f());
  requestAnimationFrame(frame);
}

// ---------- camera input: drag to pan, pinch or wheel to zoom, double-tap to recentre ----------
function bindInput(){
  const pts = new Map(); let pinch = null, lastTap = 0, moved = 0;
  const dist = () => { const [a,b] = [...pts.values()]; return Math.hypot(a.x-b.x, a.y-b.y); };
  const mid = () => { const [a,b] = [...pts.values()]; return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; };
  const anchor = () => { const p = pts.values().next().value; return p ? { x:p.x, y:p.y, px:panX, py:panY } : null; };
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    if (pts.size === 1) { drag = anchor(); moved = 0; cv.classList.add('drag'); }
    else if (pts.size === 2) { const m = mid(); pinch = { d:dist(), zoom:userZoom, mx:m.x, my:m.y, px:panX, py:panY }; drag = null; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (pts.size >= 2 && pinch) {
      const m = mid();
      userZoom = clamp(pinch.zoom * dist() / Math.max(1, pinch.d), 0.5, 3.5);
      panX = pinch.px + m.x - pinch.mx; panY = pinch.py + m.y - pinch.my;
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.hypot(dx, dy));
      panX = drag.px + dx; panY = drag.py + dy;
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) drag = anchor();
    if (pts.size === 0) {
      drag = null; cv.classList.remove('drag');
      if (e.type === 'pointerup' && moved < 8) {
        const now = performance.now();
        if (now - lastTap < 320) { resetView(); lastTap = 0; } else lastTap = now;
      }
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); userZoom = clamp(userZoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.5, 3.5); }, { passive:false });
}
export function resetView(){ userZoom = 1; panX = 0; panY = 0; }

export function startRender(canvas){
  cv = canvas; ctx = cv.getContext('2d');
  new ResizeObserver(resize).observe(cv); resize();
  city = G.city = cityAt(curMin());
  syncChars(true);
  bindInput();
  requestAnimationFrame(frame);
}
