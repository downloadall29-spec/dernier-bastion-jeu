/* Private session chat; microphones are acquired only after an explicit click. */
(function(root){
  'use strict';
  class CoopComms {
    constructor(session,events={},media){this.session=session;this.events=events;this.media=media;this.stream=null;this.call=null;this.remote=false;this.generation=0;this.sentAt=-Infinity;this.receivedAt=-Infinity;}
    attach(){
      const peer=this.session.peer,epoch=this.session.epoch;
      peer.on('call',call=>{
        if(epoch!==this.session.epoch||!this.session.ready||call.peer!==this.session.conn?.peer||!this.stream||this.call){call.close();return;}
        this.bind(call);call.answer(this.stream);
      });
    }
    send(text){
      const clean=typeof text==='string'?text.trim().slice(0,280):'';
      if(!clean||Date.now()-this.sentAt<500||!this.session.send({type:'chat',text:clean}))return false;
      this.sentAt=Date.now();this.events.line?.(this.events.localName?.()||'Voyageur',clean);return true;
    }
    receive(msg){
      if(msg.type==='chat'){
        if(typeof msg.text==='string'&&msg.text.length<=280&&msg.text.trim()&&Date.now()-this.receivedAt>=400){this.receivedAt=Date.now();this.events.line?.(this.events.remoteName?.()||'Ami',msg.text);}
        return true;
      }
      if(msg.type==='voice'){
        this.remote=msg.enabled===true;
        if(!this.remote){this.closeCall();if(this.stream)this.events.status?.('Micro actif · en attente de ton ami');}
        else this.connect();
        return true;
      }
      return false;
    }
    async enable(){
      if(!this.session.ready||this.stream||this.requesting)return;
      const generation=++this.generation;this.requesting=true;
      try{
        const media=this.media||navigator.mediaDevices;
        if(!media?.getUserMedia)throw new Error('unsupported');
        const stream=await media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
        if(generation!==this.generation||!this.session.ready){stream.getTracks().forEach(t=>t.stop());return;}
        this.stream=stream;this.session.send({type:'voice',enabled:true});
        this.events.status?.('Micro actif · en attente de ton ami');this.events.enabled?.(true);this.connect();
      }catch(e){if(generation===this.generation)this.events.status?.('Micro indisponible ou permission refusée. Le chat écrit reste disponible.');}
      finally{if(generation===this.generation)this.requesting=false;}
    }
    connect(){
      if(!this.stream||!this.remote||this.call||this.session.role!=='host')return;
      try{this.bind(this.session.peer.call(this.session.conn.peer,this.stream));}
      catch(e){this.events.status?.('Appel impossible. Coupe puis réactive le micro.');}
    }
    bind(call){
      this.call=call;
      call.on('stream',stream=>{if(this.call===call){this.events.audio?.(stream);this.events.status?.('Vocal connecté · micro actif');}});
      const end=()=>{if(this.call===call){this.call=null;this.events.audio?.(null);this.events.status?.('Vocal interrompu. Coupe puis réactive le micro.');}};
      call.on('close',end);call.on('error',end);
    }
    closeCall(){const call=this.call;this.call=null;try{call?.close();}catch(e){}this.events.audio?.(null);}
    disable(notify=true){
      this.generation++;this.requesting=false;
      this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.closeCall();
      if(notify)this.session.send({type:'voice',enabled:false});
      this.events.enabled?.(false);this.events.status?.('Micro coupé');
    }
    stop(){this.disable(false);this.remote=false;this.sentAt=this.receivedAt=-Infinity;}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=CoopComms;else root.CoopComms=CoopComms;
})(globalThis);
