(function(root){
  'use strict';
  const TITLES=['La porte dérobée','Le poste de garde','La salle des tambours','Les gardes du chef','Le trône de Gribouille'];
  function plan(difficulty,room){
    if(!['easy','normal','hard'].includes(difficulty)||!Number.isInteger(room)||room<1||room>5)throw new Error('Invalid dungeon room');
    const tier={easy:0,normal:1,hard:2}[difficulty];
    return {room,title:TITLES[room-1],goblins:room===5?0:5+tier*5+(room-1)*2,
      shamans:room===1||room===5?0:(room===2?1:2)+tier,
      guards:room<3||room===5?0:room-2+tier,boss:room===5};
  }
  function create(difficulty){return {difficulty,room:1,started:0,damage:0,finished:false,cleared:false,rows:TITLES.map((title,i)=>({room:i+1,title,status:'unvisited',seconds:null,damage:0,resources:[]}))};}
  function hit(run,hp,amount){if(!run.finished&&Number.isFinite(hp)&&Number.isFinite(amount))run.damage+=Math.max(0,Math.min(hp,amount));}
  function closeRoom(run,time,cleared){const row=run.rows[run.room-1];if(row.status!=='unvisited')return;Object.assign(row,{status:cleared?'cleared':'failed',seconds:Math.max(0,time-run.started),damage:run.damage});}
  const api={plan,create,hit,closeRoom};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DungeonRules=api;
})(globalThis);
