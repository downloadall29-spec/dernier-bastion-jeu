/* Render-only smoothing. Health, collisions, rewards and combat stay on the host. */
(function(root){
  'use strict';
  class CoopMotion {
    constructor(){this.reset();}
    reset(){this.target=null;this.view=null;this.at=0;this.previous=null;}
    accept(game,now=performance.now()){
      const old=this.view,previous=this.target,elapsed=Math.max(.025,Math.min(.25,(now-this.at)/1000));
      this.target=game;this.at=now;
      this.view={...game};
      const copy=(item,before,prior)=>{
        if(!item)return item;
        const q={...item};
        if(before&&Math.hypot(item.x-before.x,item.y-before.y)<180){q.x=before.x;q.y=before.y;}
        q._vx=prior?(item.x-prior.x)/elapsed:0;q._vy=prior?(item.y-prior.y)/elapsed:0;
        return q;
      };
      for(const key of ['p','ally','pet'])this.view[key]=copy(game[key],old?.[key],previous?.[key]);
      for(const key of ['zombies','bullets','ebullets']){
        const before=new Map((old?.[key]||[]).map(q=>[q.netId,q]));
        const prior=new Map((previous?.[key]||[]).map(q=>[q.netId,q]));
        this.view[key]=game[key].map(q=>copy(q,before.get(q.netId),prior.get(q.netId)));
      }
      return this.view;
    }
    step(dt,input,now=performance.now(),playing=true){
      if(!this.target)return this.view;
      const age=Math.max(0,(now-this.at)/1000),lead=playing?Math.min(.08,age):0;
      const alpha=1-Math.exp(-dt*24);
      const smooth=(q,target,local=false)=>{
        if(!q||!target)return;
        let x=target.x+(q._vx||0)*lead,y=target.y+(q._vy||0)*lead;
        if(local&&playing&&age<.25){
          // React immediately to the local stick; gently reconcile with the host.
          q.x+=input.mx*target.speed*dt;q.y+=input.my*target.speed*dt;
          x=target.x+input.mx*target.speed*lead;y=target.y+input.my*target.speed*lead;
        }
        q.x+=(x-q.x)*alpha;q.y+=(y-q.y)*alpha;
      };
      smooth(this.view.p,this.target.p);smooth(this.view.ally,this.target.ally,true);smooth(this.view.pet,this.target.pet);
      for(const key of ['zombies','bullets','ebullets'])this.view[key].forEach((q,i)=>smooth(q,this.target[key][i]));
      this.view.t=this.target.t+lead;
      return this.view;
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=CoopMotion;else root.CoopMotion=CoopMotion;
})(globalThis);
