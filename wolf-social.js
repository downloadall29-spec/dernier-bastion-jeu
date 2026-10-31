/* Shared solo/duo social deduction. Only public statements and revealed deaths
   affect listeners; a seer's private knowledge belongs to that seer alone. */
(function(root) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  const LINES = {
    accuse: [
      'Je surveille {target}. Ses explications ne me rassurent pas.',
      '{target}, explique-nous tes choix avant de réclamer notre confiance.',
      'Mon principal doute porte sur {target}. Je veux entendre sa défense.',
      'On parle beaucoup, mais {target} évite toujours le sujet.',
      'Je ne demande pas un vote aveugle : regardons le comportement de {target}.',
      'Si je dois désigner un suspect maintenant, ce sera {target}.',
      'Je garde un œil sur {target}. Quelque chose ne colle pas.',
      '{target} me semble trop pressé de trouver un coupable ailleurs.',
      'Avant de suivre {target}, demandons-lui sur quoi repose son accusation.',
      'Je veux une réponse claire de {target}, pas une nouvelle diversion.',
    ],
    defend: [
      'Je suis du village. Regardez mes décisions avant de me condamner.',
      'Me faire taire ne vous rapprochera pas des loups. Laissez-moi répondre.',
      'Je comprends vos doutes, mais une accusation ne constitue pas une preuve.',
      'Je n’ai rien à cacher. Posez-moi des questions au lieu de suivre la foule.',
      'Je peux me tromper sur un suspect sans être un loup.',
      'Je veux survivre avec le village. Vérifiez qui essaie de nous diviser.',
      'Vous cherchez un responsable trop vite. Je demande qu’on examine les votes.',
      'Si vous m’éliminez, relisez ensuite ceux qui ont poussé contre moi.',
    ],
    doubt: [
      'Nous sommes en train de condamner {target} sans certitude. Ralentissons.',
      'L’accusation contre {target} me paraît fragile. Qui en profite ?',
      'Et si {target} était simplement une cible facile pour les loups ?',
      'Je ne garantis rien pour {target}, mais le doute mérite une réponse.',
      'Pourquoi tout le monde devrait-il suivre la piste {target} ?',
      'Ne confondons pas le silence de {target} avec un aveu.',
    ],
    support: [
      'Je fais plutôt confiance à {target}. Je prends le risque de le dire.',
      '{target} n’est pas ma priorité. D’autres explications me gênent davantage.',
      'Pour le moment, je défends {target}. Les prochaines révélations nous départageront.',
      'Je préfère écouter {target} plutôt que le condamner immédiatement.',
      'Je ne voterai pas contre {target} sans élément supplémentaire.',
      'Mon intuition me pousse à soutenir {target}, pas à l’accuser.',
    ],
  };
  const KIND_LABELS = {defend:'Me défendre',accuse:'Accuser',doubt:'Semer le doute',support:'Défendre quelqu’un',evidence:'Rappeler un vote',alibi:'Rappeler mon vote contre un loup',claim:'Me dire Voyante',pass:'Écouter'};
  class WolfSocial {
    constructor(players, random = Math.random) {
      this.players=players; this.random=random; this.day=0;
      this.suspicion=players.map((_,i)=>players.map((__,j)=>i===j?0:.3+random()*.06));
      this.trust=players.map(()=>players.map(()=>.6));
      this.statements=[];this.votes=[];this.deaths=[];this.dialogues=new Set();this.templates=new Set();
      this.revealed=new Set();this.speeches={};
    }
    alive(){return this.players.map((p,i)=>p.alive?i:-1).filter(i=>i>=0);}
    startDay(day){this.day=day;}
    knows(observer,target){return !!this.players[observer].known?.[target];}
    score(observer,target){
      if(observer===target)return -1;
      const p=this.players[observer],other=this.players[target];
      if(this.knows(observer,target))return other.role==='loup'?1:0;
      if(p.role==='loup'&&other.role==='loup')return -1;
      return this.suspicion[observer][target];
    }
    change(observer,target,delta){
      if(observer===target||this.knows(observer,target))return;
      if(this.players[observer].role==='loup'&&this.players[target].role==='loup')return;
      this.suspicion[observer][target]=clamp(this.suspicion[observer][target]+delta);
    }
    chooseTarget(observer,list){
      const eligible=list.filter(i=>i!==observer&&this.players[i]?.alive);
      if(!eligible.length)return -1;
      // Randomness only breaks equally supported hypotheses, not each vote.
      const best=Math.max(...eligible.map(i=>this.score(observer,i)));
      const ties=eligible.filter(i=>Math.abs(this.score(observer,i)-best)<.000001);
      return ties[Math.floor(this.random()*ties.length)];
    }
    nightTarget(wolves,list){
      const candidates=list.filter(i=>this.players[i]?.alive&&!wolves.includes(i));
      if(!candidates.length)return -1;
      const threat=i=>this.statements.reduce((n,s)=>n+(s.actor===i&&wolves.includes(s.target)&&['accuse','claim','evidence'].includes(s.kind)?.6:0),0)
        +this.votes.reduce((n,v)=>n+(wolves.includes(v.choices[i])?.8:0),0)
        +this.statements.filter(s=>s.actor===i&&s.kind==='claim').length*.5;
      const best=Math.max(...candidates.map(threat)),ties=candidates.filter(i=>threat(i)===best);
      return ties[Math.floor(this.random()*ties.length)];
    }
    recordVotes(choices){this.votes.push({day:this.day,choices:{...choices}});}
    badVote(actor){
      return this.votes.slice().reverse().map(v=>({day:v.day,target:v.choices[actor]}))
        .find(v=>this.deaths.some(d=>d.id===v.target&&d.role!=='loup'&&d.day>=v.day));
    }
    goodVote(actor){
      return this.votes.slice().reverse().map(v=>({day:v.day,target:v.choices[actor]}))
        .find(v=>this.deaths.some(d=>d.id===v.target&&d.role==='loup'&&d.day>=v.day));
    }
    reveal(id,cause){
      if(this.revealed.has(id))return;
      this.revealed.add(id);
      const wolf=this.players[id].role==='loup';
      this.deaths.push({id,day:this.day,role:this.players[id].role,cause});
      for(const observer of this.alive()){
        for(const vote of this.votes)for(const [actor,target] of Object.entries(vote.choices))if(target===id)this.change(observer,+actor,wolf?-.2:.09);
        for(const speech of this.statements.filter(s=>s.target===id)){
          const accusing=['accuse','evidence','claim'].includes(speech.kind);
          if(!accusing&&!['support','doubt'].includes(speech.kind))continue;
          const correct=accusing===wolf, weight=speech.kind==='claim'?2:1;
          this.trust[observer][speech.actor]=clamp(this.trust[observer][speech.actor]+(correct?.08:-.12)*weight);
          this.change(observer,speech.actor,(correct?-.07:.09)*weight);
        }
      }
    }
    options(actor){
      const out=[{label:'Je suis innocent·e : jugez-moi sur les faits.',value:'defend',kind:'defend'}];
      if(this.goodVote(actor))out.push({label:'J’ai voté contre un loup : vérifiez !',value:'alibi',kind:'alibi'});
      for(const target of this.alive().filter(i=>i!==actor)){
        const name=this.players[target].name;
        out.push({label:'Je soupçonne '+name+'.',value:'accuse:'+target,kind:'accuse'},
          {label:'On condamne '+name+' trop vite.',value:'doubt:'+target,kind:'doubt'},
          {label:'Je fais confiance à '+name+'.',value:'support:'+target,kind:'support'});
        if(this.badVote(target))out.push({label:name+' a voté contre un innocent.',value:'evidence:'+target,kind:'evidence'});
        if(!this.knows(actor,target)||this.players[target].role==='loup')out.push({label:'Je suis la Voyante : '+name+' est un loup. (Déclaration publique, bluff possible)',value:'claim:'+target,kind:'claim'});
      }
      out.push({label:'Je préfère écouter avant de me prononcer.',value:'pass',kind:'pass'});
      return out;
    }
    line(kind,target,actor){
      const name=this.players[target]?.name||'',pool=LINES[kind]||[];
      const available=pool.map((text,i)=>({text,key:kind+':'+i})).filter(o=>!this.templates.has(o.key));
      if(available.length){const item=available[Math.floor(this.random()*available.length)];this.templates.add(item.key);return item.text.replaceAll('{target}',name);}
      // Once the authored bank is exhausted, contextual lines remain unique.
      const who=this.players[actor].name;
      const text=kind==='defend'?`Jour ${this.day}, ${who} demande qu’on examine ses actes avant de voter.`:
        `Jour ${this.day}, ${who} ${kind==='accuse'?'maintient ses soupçons contre':kind==='support'?'prend la défense de':'refuse de condamner trop vite'} ${name}.`;
      return this.dialogues.has(text)?null:text;
    }
    speak(actor,value,bot=false){
      if(!this.players[actor]?.alive||!this.options(actor).some(o=>o.value===value))return null;
      const [kind,raw]=value.split(':'),target=raw===undefined?actor:Number(raw),name=this.players[target].name;
      const previous=this.statements.filter(s=>s.actor===actor&&s.day===this.day&&s.kind===kind).length;
      // Repeating a plea has sharply diminishing influence within the same day.
      const strength=previous? .15:1;
      let text;
      if(kind==='evidence'){const v=this.badVote(target);text=`Au jour ${v.day}, ${name} a voté contre ${this.players[v.target].name}, qui était innocent·e. Cela mérite une explication.`;}
      else if(kind==='alibi'){const v=this.goodVote(actor);text=`J’ai voté contre ${this.players[v.target].name} au jour ${v.day}. Son rôle de loup a été révélé : vérifiez ce vote.`;}
      else if(kind==='claim')text=`Je suis la Voyante : j’affirme que ${name} est un loup. Gardez cette déclaration en mémoire.`;
      else if(kind==='pass')text='Je préfère écouter avant de me prononcer.';
      else text=this.line(kind,target,actor);
      if(!text)return null;
      if(bot&&this.dialogues.has(text))return null;
      this.dialogues.add(text);
      for(const listener of this.alive()){
        if(listener===actor)continue;
        const credibility=this.trust[listener][actor]*(1-.65*clamp(this.score(listener,actor)));
        const influence=credibility*strength;
        if(kind==='defend')this.change(listener,actor,-.13*influence);
        if(kind==='alibi')this.change(listener,actor,-.16*strength);
        if(kind==='accuse')this.change(listener,target,.22*influence);
        if(kind==='doubt')this.change(listener,target,-.13*influence);
        if(kind==='support')this.change(listener,target,-.2*influence);
        if(kind==='evidence')this.change(listener,target,.17*strength);
        if(kind==='claim')this.change(listener,target,.36*influence);
      }
      this.statements.push({actor,kind,target,day:this.day,text});
      return text;
    }
    botSpeech(actor){
      const targets=this.alive().filter(i=>i!==actor),target=this.chooseTarget(actor,targets);
      if(target<0)return null;
      const said=kind=>this.statements.some(s=>s.actor===actor&&s.day===this.day&&s.kind===kind);
      const attacked=this.statements.some(s=>s.day===this.day&&s.target===actor&&['accuse','claim','evidence'].includes(s.kind));
      let value;
      if(attacked&&!said('defend'))value='defend';
      else if(this.knows(actor,target)&&this.players[target].role==='loup'&&!said('claim'))value='claim:'+target;
      else if(this.badVote(target)&&!said('evidence'))value='evidence:'+target;
      else if(!said('accuse'))value='accuse:'+target;
      else {
        const safe=targets.slice().sort((a,b)=>this.score(actor,a)-this.score(actor,b))[0];
        value=(this.score(actor,safe)<.35?'support:':'doubt:')+safe;
      }
      const text=this.speak(actor,value,true);
      return text?{actor,text}:null;
    }
  }
  WolfSocial.KIND_LABELS=KIND_LABELS;
  if(typeof module!=='undefined'&&module.exports)module.exports=WolfSocial;else root.WolfSocial=WolfSocial;
})(globalThis);
