/* Authoritative two-human / seven-bot Werewolf rules. Views never expose hidden roles. */
(function(root) {
  'use strict';
  const Social = typeof module !== 'undefined' && module.exports ? require('./wolf-social.js') : root.WolfSocial;
  const ROLES = ['loup','loup','voyante','sorciere','chasseur','villageois','villageois','villageois','villageois'];
  class WolfDuo {
    constructor(random = Math.random, roles) {
      this.random = random;
      const deck = roles ? roles.slice() : ROLES.slice();
      if (!roles) for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
      this.players=deck.map((role,i)=>({id:i,name:i<2?'Joueur '+(i+1):['Aube','Basile','Céleste','Dorian','Éloïse','Faust','Gaëlle'][i-2],role,alive:true,known:{}}));
      this.social=new Social(this.players,random);this.discussionRound=0;
      this.day=0;this.phase='reveal';this.token=0;this.pending={};this.answers={};this.log=[];
      this.life=true;this.poison=true;this.winner=null;this.deaths=[];this.hunters=[];this.victim=null;
      this.request([0,1], 'Découvre ton rôle, puis confirme que tu es prêt.', () => [{label:'Je suis prêt',value:'ready'}]);
    }
    living(){return this.players.filter(p=>p.alive).map(p=>p.id);}
    human(i){return i<2;}
    pick(list){return list[Math.floor(this.random()*list.length)];}
    options(list){return list.map(i=>({label:this.players[i].name,value:i}));}
    add(text){this.log.push(text);this.log=this.log.slice(-50);}
    request(seats,text,options){
      this.token++;this.pending={};this.answers={};
      for(const id of seats) this.pending[id]={text,options:options(id)};
    }
    act(id, token, choice){
      const q=this.pending[id];
      if(token!==this.token || !q || !q.options.some(o=>o.value===choice))return false;
      this.answers[id]=choice;delete this.pending[id];
      if(!Object.keys(this.pending).length)this.advance();
      return true;
    }
    botVote(id,list){
      return this.social.chooseTarget(id,list);
    }
    botDebate(){
      // Rotate the speaking order; do not always let the same three bots dominate.
      const bots=this.living().filter(i=>!this.human(i));
      const offset=(this.day+this.discussionRound)%Math.max(1,bots.length);
      for(const id of [...bots.slice(offset),...bots.slice(0,offset)].slice(0,4)){
        const speech=this.social.botSpeech(id);
        if(speech)this.add(this.players[id].name+' : « '+speech.text+' »');
      }
    }
    openDiscussion(){
      this.request(this.living().filter(i=>this.human(i)),
        'Débat — tour '+this.discussionRound+'/2. Tes paroles influencent les soupçons. Les affirmations seront jugées après les révélations.',
        id=>this.social.options(id));
    }
    checkWin(){
      const a=this.living(),wolves=a.filter(i=>this.players[i].role==='loup').length;
      if(!wolves)this.winner='village';else if(wolves>=a.length-wolves)this.winner='loups';
      if(this.winner){this.phase='over';this.pending={};this.add(this.winner==='loups'?'Les loups ont gagné !':'Le village a gagné !');return true;}
      return false;
    }
    eliminate(ids,cause='nuit'){
      for(const i of new Set(ids)){
        const p=this.players[i];if(!p || !p.alive)continue;
        p.alive=false;this.add(p.name+' est éliminé·e : '+p.role+'.');
        this.social.reveal(i,cause);
        if(p.role==='chasseur')this.hunters.push(i);
      }
    }
    advance(){
      // Every automatic phase progresses to a human decision, endgame, or the next day.
      for(let guard=0;guard<100;guard++){
        const A=this.living();
        if(this.phase==='reveal'||this.phase==='nightStart'){
          this.day++;this.social.startDay(this.day);this.add('Nuit '+this.day+' : le village s’endort.');this.phase='seer';
          const id=A.find(i=>this.players[i].role==='voyante');this.seer=id;
          const opts=A.filter(i=>i!==id && !this.players[id]?.known[i]);
          if(id!==undefined && opts.length){
            if(this.human(id)){this.request([id],'De qui veux-tu découvrir le rôle ?',()=>this.options(opts));return;}
            this.players[id].known[this.pick(opts)]=true;
          }
          this.answers={};
        }
        if(this.phase==='seer'){
          if(this.seer!==undefined && this.answers[this.seer]!==undefined)this.players[this.seer].known[this.answers[this.seer]]=true;
          this.phase='wolves';this.wolves=A.filter(i=>this.players[i].role==='loup');
          const humans=this.wolves.filter(i=>this.human(i)),targets=A.filter(i=>this.players[i].role!=='loup');
          if(humans.length){this.request(humans,'Quelle victime choisis-tu avec les loups ?',()=>this.options(targets));return;}
          this.answers={};
        }
        if(this.phase==='wolves'){
          const votes=Object.values(this.answers);this.victim=votes.length?this.pick(votes):this.social.nightTarget(this.wolves,A);
          this.deaths=[this.victim];this.witch=A.find(i=>this.players[i].role==='sorciere');this.phase='witchLife';
          if(this.witch!==undefined && this.life){
            if(this.human(this.witch)){this.request([this.witch],this.players[this.victim].name+' a été attaqué·e. Utiliser la potion de vie ?',()=>[{label:'Sauver',value:true},{label:'Garder la potion',value:false}]);return;}
            if(this.victim===this.witch || this.social.score(this.witch,this.victim)<.4){this.life=false;this.deaths=[];}
          }
          this.answers={};
        }
        if(this.phase==='witchLife'){
          if(this.answers[this.witch]===true){this.life=false;this.deaths=[];}
          this.phase='witchDeath';
          if(this.witch!==undefined && this.poison){
            const targets=A.filter(i=>i!==this.witch);
            if(this.human(this.witch)){this.request([this.witch],'Utiliser la potion de mort ?',()=>[{label:'Garder la potion',value:-1},...this.options(targets)]);return;}
            const suspect=this.botVote(this.witch,targets);
            if(suspect>=0 && this.social.score(this.witch,suspect)>.7){this.deaths.push(suspect);this.poison=false;}
          }
          this.answers={};
        }
        if(this.phase==='witchDeath'){
          const target=this.answers[this.witch];
          if(Number.isInteger(target)&&target>=0){this.deaths.push(target);this.poison=false;}
          this.add('Jour '+this.day+' : le village se réveille.');
          if(!this.deaths.length)this.add('Personne n’est mort cette nuit.');
          this.eliminate(this.deaths);this.afterHunter='discussion';this.phase='hunter';this.answers={};
        }
        if(this.phase==='hunter'){
          if(this.hunter!==undefined){this.eliminate([this.answers[this.hunter]],'chasseur');this.hunter=undefined;}
          if(this.hunters.length){
            const id=this.hunters.shift(),targets=this.living();
            if(targets.length){
              if(this.human(id)){this.hunter=id;this.request([id],'Chasseur : qui emportes-tu avec toi ?',()=>this.options(targets));return;}
              this.eliminate([this.botVote(id,targets)],'chasseur');continue;
            }
          }
          if(this.checkWin())return;
          this.phase=this.afterHunter;
          if(this.phase==='nightStart')continue;
          this.discussionRound=1;this.botDebate();this.openDiscussion();
          if(Object.keys(this.pending).length)return;
        }
        if(this.phase==='discussion'){
          for(const [id,value] of Object.entries(this.answers)){
            const text=this.social.speak(+id,value);
            if(text)this.add(this.players[id].name+' : « '+text+' »');
          }
          if(this.discussionRound===1){
            this.discussionRound=2;this.botDebate();this.openDiscussion();
            if(Object.keys(this.pending).length)return;
          }
          this.phase='vote';
          this.request(this.living().filter(i=>this.human(i)),'Vote : qui faut-il éliminer ?',id=>this.options(this.living().filter(i=>i!==id)));
          if(Object.keys(this.pending).length)return;
        }
        if(this.phase==='vote'){
          const votes={...this.answers};
          for(const i of this.living().filter(i=>!this.human(i)))votes[i]=this.botVote(i,this.living().filter(j=>j!==i));
          this.social.recordVotes(votes);
          const tally={};for(const target of Object.values(votes))tally[target]=(tally[target]||0)+1;
          const max=Math.max(...Object.values(tally)),top=Object.keys(tally).map(Number).filter(i=>tally[i]===max);
          this.add('Votes : '+Object.entries(votes).map(([i,target])=>this.players[i].name+' → '+this.players[target].name).join(' · '));
          if(top.length===1)this.eliminate(top,'vote');else this.add('Égalité : personne n’est éliminé.');
          this.phase='hunter';this.afterHunter='nightStart';this.answers={};continue;
        }
      }
      throw new Error('Werewolf phase did not settle');
    }
    view(id){
      const me=this.players[id],wolf=me.role==='loup';
      return {day:this.day,phase:this.phase,round:this.discussionRound,token:this.token,winner:this.winner,seat:id,
        players:this.players.map(p=>({id:p.id,name:p.name,alive:p.alive,role:p.id===id||!p.alive||this.winner||me.known[p.id]||(wolf&&p.role==='loup')?p.role:null})),
        log:this.log.slice(),prompt:this.pending[id]||null,
        votes:this.social.votes.map(v=>({day:v.day,choices:{...v.choices}})),
        waiting:Object.keys(this.pending).length>0&&!this.pending[id],
        won:!!this.winner && (wolf?'loups':'village')===this.winner};
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=WolfDuo;else root.WolfDuo=WolfDuo;
})(globalThis);
