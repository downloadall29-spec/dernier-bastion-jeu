/* Local social data. Public accounts and cross-device friendships need a backend. */
(function(root){
  'use strict';
  class FriendBook {
    constructor(storage,key){this.storage=storage;this.key=key;}
    read(){try{const value=JSON.parse(this.storage.getItem(this.key)||'[]');return Array.isArray(value)?value.slice(0,100):[];}catch(e){return [];}}
    write(value){try{this.storage.setItem(this.key,JSON.stringify(value));}catch(e){}}
    add(profile){
      if(!profile||typeof profile.id!=='string'||typeof profile.code!=='string'||!/^#[A-Z0-9_-]{3,24}$/.test(profile.code))return false;
      const list=this.read().filter(p=>p.id!==profile.id&&p.code!==profile.code);
      list.push({id:profile.id.slice(0,80),name:String(profile.name||'Ami').slice(0,24),code:profile.code});this.write(list.slice(-100));return true;
    }
    remove(id){this.write(this.read().filter(p=>p.id!==id));}
  }
  class JoinLimits {
    constructor(storage,key,now=Date.now){this.storage=storage;this.key=key;this.now=now;}
    take(id){
      let entries={};try{entries=JSON.parse(this.storage.getItem(this.key)||'{}');}catch(e){}
      if(!entries||typeof entries!=='object'||Array.isArray(entries))entries={};
      const now=this.now(),clean={};
      for(const [key,value] of Object.entries(entries).slice(-200))if(Array.isArray(value)){const times=value.filter(t=>Number.isFinite(t)&&now-t<600000&&t<=now);if(times.length)clean[key]=times;}
      const times=Object.hasOwn(clean,id)?clean[id]:[];
      if(times.length>=3)return {ok:false,remaining:0,wait:Math.ceil((600000-(now-times[0]))/1000)};
      if(times.length&&now-times[times.length-1]<10000)return {ok:false,remaining:3-times.length,wait:Math.ceil((10000-now+times[times.length-1])/1000)};
      Object.defineProperty(clean,id,{value:[...times,now],enumerable:true,configurable:true,writable:true});
      try{this.storage.setItem(this.key,JSON.stringify(clean));}catch(e){}
      return {ok:true,remaining:2-times.length};
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={FriendBook,JoinLimits};else{root.FriendBook=FriendBook;root.JoinLimits=JoinLimits;}
})(globalThis);
