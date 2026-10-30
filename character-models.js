/* Quaternius Standard character assembly. Source meshes remain immutable. */
(function(root){
const hairs=['none','simpleparted','buzzed','buns','long'];
// Teintes de peau (multipliées sur la texture claire) et couleurs d'étoffe des tenues
const skins={claire:'#ffffff',doree:'#f3d3b8',mate:'#dcaa84',brune:'#a8714f',ebene:'#6e4734'};
const cloths=['green','red','blue','purple'];
const clothHue={red:356,blue:214,purple:282};
function clean(a={}){a=a&&typeof a==='object'?a:{};return {body:a.body==='female'?'female':'male',hair:hairs.includes(a.hair)?a.hair:'simpleparted',beard:a.beard===true,outfit:a.outfit==='peasant'?'peasant':'ranger',hood:a.hood!==false,skin:skins[a.skin]?a.skin:'claire',cloth:cloths.includes(a.cloth)?a.cloth:'green'};}
function build(T,models,input,preview=false,color='#5a3a26',coverHair=false){
 const a=clean(input),ids=[(preview?'body_':'head_')+a.body];
 if(!preview)ids.push(a.outfit+'_'+a.body);
 if(a.hair!=='none')ids.push('hair_'+(a.hair==='buzzed'&&a.body==='female'?'buzzedfemale':a.hair));
 if(a.beard)ids.push('hair_beard');
 if(ids.some(id=>!models['q_'+id]))return null;
 const g=new T.Group(),content=new T.Group();g.add(content);content.scale.setScalar(1.4);
 const bones=[],allMeshes=[];
 for(const id of ids){
  const src=T.cloneSkinned(models['q_'+id].scene);content.add(src);
  if(id.startsWith('hair_')){const femaleHair=['hair_buns','hair_long','hair_buzzedfemale'].includes(id);src.position.y=(a.body==='female'?-.044:0)+(femaleHair?.044:0);}
  src.traverse(o=>{
   if(o.isBone)bones.push({o,q:o.quaternion.clone()});
   if(!o.isMesh)return;
   allMeshes.push(o);
   if(/Head_Hood/.test(o.name))o.visible=a.hood;
   // peau et étoffe : copies des matières, les modèles d'origine restent intacts
   const recol=m=>{
    if(/Superhero|Regular/.test(m.name)&&a.skin!=='claire'){const c=m.clone();c.color.set(skins[a.skin]);c.userData.characterOwned=true;return c;}
    if(/MI_Ranger|MI_Peasant/.test(m.name)&&a.cloth!=='green'&&m.map){const c=m.clone();c.map=clothMap(T,m.map,a.cloth,/Peasant/.test(m.name));c.userData.characterOwned=true;return c;}
    return m;
   };
   if(!id.startsWith('hair_'))o.material=Array.isArray(o.material)?o.material.map(recol):recol(o.material);
   if(id.startsWith('hair_')){
    const tint=m=>{const c=m.clone();c.color.set(color);c.userData.characterOwned=true;return c};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
    if(!preview&&((a.outfit==='ranger'&&a.hood)||coverHair)&&id!=='hair_beard'){
     // Preserve the selected fringe/nape while concealing volume covered by the hood.
     const geo=o.geometry.clone(),p=geo.attributes.position,idx=geo.index,keep=[];
     for(let i=0;i<(idx?idx.count:p.count);i+=3){const tri=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);if(tri.every(v=>p.getY(v)<1.61||(p.getZ(v)>.045&&p.getY(v)<1.76)))keep.push(...tri);}
     geo.setIndex(keep);geo.userData.characterCrop=true;o.geometry=geo;
    }
   }
  });
 }
 g.userData.quaternius={appearance:a,preview,content,bones,meshes:allMeshes};
 g.userData.legs=[];g.userData.arms=[];g.userData.body=content;
 animate(T,g,0,false);return g;
}
// Étoffe recolorée : le vert du rôdeur (ou le lin clair du paysan) prend la teinte voulue, le cuir et le métal gardent la leur
const clothCache=new Map();
function clothMap(T,src,cloth,peasant){
 const key=src.uuid+cloth;if(clothCache.has(key))return clothCache.get(key);
 let tex=src;
 try{
  const im=src.image,c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
  const d=g.getImageData(0,0,c.width,c.height),px=d.data,H=clothHue[cloth]/360;
  for(let i=0;i<px.length;i+=4){
   const r=px[i]/255,gg=px[i+1]/255,b=px[i+2]/255,mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),l=(mx+mn)/2,dd=mx-mn,s=dd?dd/(1-Math.abs(2*l-1)):0;
   let h=0;if(dd){if(mx===r)h=((gg-b)/dd+6)%6;else if(mx===gg)h=(b-r)/dd+2;else h=(r-gg)/dd+4;}h*=60;
   let ns=s,nl=l;
   if(peasant){if(!(l>.36&&s<.3&&h>25&&h<75))continue;ns=.3;nl=Math.min(.75,l*.95);}
   else if(!(h>60&&h<175&&s>.18))continue;
   const q=nl<.5?nl*(1+ns):nl+ns-nl*ns,p2=2*nl-q,f=t=>{t=(t+1)%1;return t<1/6?p2+(q-p2)*6*t:t<.5?q:t<2/3?p2+(q-p2)*(2/3-t)*6:p2;};
   px[i]=f(H+1/3)*255;px[i+1]=f(H)*255;px[i+2]=f(H-1/3)*255;
  }
  g.putImageData(d,0,0);
  tex=new T.CanvasTexture(c);tex.flipY=src.flipY;tex.encoding=src.encoding;tex.wrapS=src.wrapS;tex.wrapT=src.wrapT;
 }catch(e){}
 clothCache.set(key,tex);return tex;
}
// Marche procédurale : bassin qui balance, buste qui contre-tourne, genoux et coudes pliés, bras opposés aux jambes.
// À l'arrêt : bras détendus et légère respiration.
// Rapide : les rotations sont calculées sur un seul squelette (sans recalculer les matrices), puis recopiées
// sur les squelettes des autres pièces (tête, tenue, cheveux), qui ont la même ossature.
const POSE_BONES=['pelvis','spine_02','spine_03','neck_01','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'];
let tmp=null;
function rig(q){
 if(q.rig)return q.rig;
 const by={};for(const b of q.bones)(by[b.o.name]=by[b.o.name]||[]).push(b);
 return q.rig=POSE_BONES.filter(n=>by[n]).map(n=>({name:n,main:by[n][0],others:by[n].slice(1)}));
}
function animate(T,g,walk,moving){
 const q=g.userData.quaternius;if(!q)return;
 if(!tmp)tmp={a:new T.Quaternion(),b:new T.Quaternion(),r:new T.Quaternion(),H:new T.Quaternion(),X:new T.Vector3(),Y:new T.Vector3(),Z:new T.Vector3(),v:new T.Vector3(),chain:[]};
 const R=rig(q),{a:pq,b:dq,r:rq,H}=tmp;
 // quaternion « monde » d'un objet, à partir des rotations locales (les matrices ne sont pas recalculées)
 const wq=(o,out)=>{const c=tmp.chain;c.length=0;for(let p=o;p;p=p.parent)c.push(p);out.identity();for(let i=c.length-1;i>=0;i--)out.multiply(c[i].quaternion);return out;};
 wq(g,H);const X=tmp.X.set(1,0,0).applyQuaternion(H),Y=tmp.Y.set(0,1,0).applyQuaternion(H),Z=tmp.Z.set(0,0,1).applyQuaternion(H);
 const turn=(o,axis,angle)=>{if(!angle)return;wq(o.parent,pq).invert();tmp.v.copy(axis).applyQuaternion(pq);o.quaternion.premultiply(dq.setFromAxisAngle(tmp.v,angle));};
 const m=moving?1:0,s=Math.sin(walk)*m,c=Math.cos(walk)*m,t=(typeof performance!=='undefined'?performance.now():Date.now())/1000,breath=Math.sin(t*1.7)*(1-m);
 const armed=!!g.userData.gun;
 for(const {name:n,main} of R)main.o.quaternion.copy(main.q);
 for(const {name:n,main} of R){
  const o=main.o,l=n.endsWith('_l'),k=l?1:-1;
  if(n==='pelvis'){turn(o,Y,s*.12);turn(o,Z,c*.04);}
  else if(n==='spine_02'){turn(o,Y,-s*.2);turn(o,X,-.06*m);}
  else if(n==='spine_03')turn(o,X,breath*.025);
  else if(n==='neck_01')turn(o,Y,s*.08);
  else if(n==='upperarm_l'||n==='upperarm_r'){
   const gun=armed&&!l;
   turn(o,Z,-k*(gun?1.0:1.12)+k*breath*.02);
   turn(o,X,gun?-.25-s*.1:-k*s*.5+.05);
  }
  else if(n==='lowerarm_l'||n==='lowerarm_r'){
   const gun=armed&&!l,fwd=Math.max(0,-k*s);
   turn(o,X,gun?-.75:-(.22+.35*m+.3*fwd));
  }
  else if(n==='thigh_l'||n==='thigh_r')turn(o,X,k*s*.55-.04*m);
  else if(n==='calf_l'||n==='calf_r')turn(o,X,m*(.12+.85*Math.max(0,-k*c))+.04*(1-m));
  else if(n==='foot_l'||n==='foot_r')turn(o,X,-m*(.2*Math.max(0,-k*c))+k*s*.15);
 }
 // même rotation relative sur les os homonymes des autres pièces
 for(const {main,others} of R){if(!others.length)continue;rq.copy(main.q).invert().premultiply(main.o.quaternion);for(const b of others)b.o.quaternion.copy(b.q).premultiply(rq);}
 q.content.position.y=m*(Math.abs(Math.cos(walk))*.045-.03);
}
function dispose(g){g.traverse(o=>{if(!o.isMesh)return;if(o.geometry.userData.characterCrop)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.characterOwned)m.dispose()})}
root.CharacterModels={clean,build,animate,hairs,dispose,skins,cloths};
})(globalThis);
