/* Transport for one host and up to three guests (star topology: every guest talks only to the host).
   No game state or save data lives here. maxGuests = 1 keeps the original two-player behaviour. */
(function (root) {
  'use strict';
  const VERSION = 3, PREFIX = 'dernier-bastion-v1-';
  class BastionSession {
    constructor(PeerType, events = {}, options = {}) {
      this.PeerType = PeerType; this.events = events; this.options = options;
      this.role = null; this.peer = null; this.conn = null; this.ready = false;
      this.epoch = 0; this.lastSeen = 0; this.pendingConnection=null; this.remoteProfile=null;
      this.maxGuests = 1; this.guests = []; this.slot = 0; this.primarySlot = 0;
    }
    status(message) { this.events.status?.(message); }
    // host only: the players other than the host, in arrival order ({slot, profile})
    players() { return this.guests.filter(g => g.ready).map(g => ({ slot: g.slot, profile: g.profile })); }
    open(role, code) {
      this.close();
      this.role = role;this.code=code;
      const epoch = this.epoch;
      const active = () => this.epoch === epoch;
      if (!/^(?:[A-Z0-9]{8}|#[A-Z0-9_-]{3,24})$/.test(code || '')) {
        this.fail('Entre le code de ton ami ou son #identifiant (3 à 24 lettres/chiffres).'); return;
      }
      this.status('Connexion au serveur…');
      try {
        const id = role === 'host' ? PREFIX + code.replace('#','user-') : undefined;
        this.peer = new this.PeerType(id, { ...this.options, debug: 0 });
        const peer = this.peer;
        this.deadline = setTimeout(() => { if (active() && !this.ready) this.fail('Connexion impossible. Vérifie Internet et réessaie.'); }, 25000);
        peer.on('open', () => {
          if (!active()) return;
          if (role === 'host') {
            clearTimeout(this.deadline);
            this.status('Code : ' + code + ' — en attente de ton ami');
          } else this.attach(peer.connect(PREFIX + code.replace('#','user-'), { reliable: true, serialization: 'binary', metadata: { version: VERSION, profile:this.profile() } }), epoch);
        });
        peer.on('connection', conn => {
          const reject = message => { conn.on('open',()=>{conn.send({type:'rejected',message});setTimeout(()=>conn.close(),100);}); };
          if(!active()||role!=='host'||conn.metadata?.version!==VERSION){reject(conn.metadata?.version!==VERSION?'Installe la même version que ton ami.':'Une demande ou une partie est déjà en cours.');return;}
          if(this.guests.length>=this.maxGuests){reject(this.maxGuests>1?'La partie est complète (4 joueurs maximum).':'Une demande ou une partie est déjà en cours.');return;}
          if(this.pendingConnection){reject('Une autre demande est en cours. Réessaie dans un instant.');return;}
          if(this.events.canJoin?.()===false){reject('La partie a déjà commencé. Attends la prochaine.');return;}
          if(!this.events.joinRequest){this.attach(conn,epoch);return;}
          this.pendingConnection=conn;
          const profile=this.cleanProfile(conn.metadata?.profile);
          const decide=accepted=>{
            if(!active()||this.pendingConnection!==conn)return;
            clearTimeout(this.approvalTimer);this.pendingConnection=null;this.events.joinClosed?.();
            if(accepted&&this.guests.length<this.maxGuests){this.attach(conn,epoch);}
            else {try{conn.send({type:'rejected',message:'Demande refusée ou expirée. Tu peux réessayer (3 demandes maximum en 10 minutes).'});}catch(e){}setTimeout(()=>conn.close(),100);}
          };
          conn.on('open',()=>{
            if(!active()||this.pendingConnection!==conn)return;
            conn.send({type:'pending'});
            this.approvalTimer=setTimeout(()=>decide(false),45000);
            this.events.joinRequest(profile,decide);
          });
          conn.on('close',()=>{if(this.pendingConnection===conn){this.pendingConnection=null;clearTimeout(this.approvalTimer);this.events.joinClosed?.();}});
        });
        peer.on('error', err => {
          if (!active()) return;
          const messages = { 'peer-unavailable': 'Partie introuvable. Vérifie le code et que ton ami attend encore.', 'unavailable-id': 'Cet identifiant est déjà utilisé. Choisis-en un autre.' };
          this.fail(messages[err.type] || 'Connexion interrompue. Vérifie Internet et réessaie.');
        });
        peer.on('disconnected', () => { if (active()) this.fail('Connexion au serveur perdue. Recrée une partie.'); });
      } catch (_) { this.fail('Le multijoueur nécessite un navigateur compatible WebRTC et Internet.'); }
    }
    cleanProfile(value){return {id:typeof value?.id==='string'?value.id.slice(0,80):'unknown',name:typeof value?.name==='string'?value.name.slice(0,24):'Voyageur',code:typeof value?.code==='string'&&/^#[A-Z0-9_-]{3,24}$/.test(value.code)?value.code:''};}
    profile(){const p=this.cleanProfile(this.events.profile?.());if(this.role==='host'&&this.code?.startsWith('#'))p.code=this.code;return p;}
    // the first guest still reachable through session.conn / remoteProfile (chat, voice, friends, Loup-Garou)
    repoint(){const first=this.guests.find(g=>g.ready);this.conn=first?first.conn:(this.guests[0]?.conn||null);this.remoteProfile=first?first.profile:null;this.primarySlot=first?first.slot:0;}
    attach(conn, epoch) {
      if (this.role === 'host') { this.attachGuest(conn, epoch); return; }
      this.conn = conn;
      const active = () => this.epoch === epoch && this.conn === conn;
      this.handshake = setTimeout(() => { if (active() && !this.ready) this.fail('Ton ami ne répond pas. Réessaie.'); }, 20000);
      const hello=()=>{if(active())conn.send({type:'hello',version:VERSION,profile:this.profile()});};
      conn.on('open',hello);
      conn.on('data', msg => {
        if (!active() || !msg || typeof msg !== 'object') return;
        if(!this.ready&&msg.type==='pending'){clearTimeout(this.deadline);clearTimeout(this.handshake);this.handshake=setTimeout(()=>{if(active()&&!this.ready)this.fail('Ton ami n’a pas répondu. Réessaie plus tard.');},50000);this.status('Demande envoyée : ton ami doit accepter (45 secondes).');return;}
        if(!this.ready&&msg.type==='rejected'){this.fail(typeof msg.message==='string'?msg.message.slice(0,180):'Demande refusée.');return;}
        if (msg.type === 'hello') {
          if (msg.version !== VERSION) { this.fail('Les deux appareils doivent utiliser la même version du jeu.'); return; }
          if (this.ready) return;
          this.ready = true;this.remoteProfile=this.cleanProfile(msg.profile);this.lastSeen = Date.now();
          this.slot = Number.isInteger(msg.slot) && msg.slot >= 1 && msg.slot <= 3 ? msg.slot : 1;
          hello();
          clearTimeout(this.deadline); clearTimeout(this.handshake);
          this.pulse = setInterval(() => {
            if (Date.now() - this.lastSeen > 15000) this.fail('Ton ami ne répond plus. La partie a été arrêtée.');
            else this.send({ type: 'ping' });
          }, 2000);
          this.status('Connecté ! Ton ami va lancer la partie.');
          this.events.ready?.(); return;
        }
        if (!this.ready) return;
        this.lastSeen = Date.now();
        if (msg.type === 'ping') { this.send({ type: 'pong' }); return; }
        if (msg.type !== 'pong') this.events.message?.(msg, 0);
      });
      conn.on('close', () => { if (active()) this.fail('Ton ami a quitté la partie.'); });
      conn.on('error', () => { if (active()) this.fail('Connexion avec ton ami interrompue.'); });
      if(conn.open)hello();
    }
    attachGuest(conn, epoch) {
      const used = new Set(this.guests.map(g => g.slot)); let slot = 1; while (used.has(slot)) slot++;
      const guest = { conn, slot, profile: this.cleanProfile(conn.metadata?.profile), ready: false, lastSeen: Date.now() };
      this.guests.push(guest); if (!this.conn) this.conn = conn;
      const active = () => this.epoch === epoch && this.guests.includes(guest);
      guest.handshake = setTimeout(() => { if (active() && !guest.ready) this.dropGuest(guest, 'Ton ami ne répond pas. Réessaie.'); }, 20000);
      const hello=()=>{if(active())conn.send({type:'hello',version:VERSION,profile:this.profile(),slot});};
      conn.on('open',hello);
      conn.on('data', msg => {
        if (!active() || !msg || typeof msg !== 'object') return;
        if (msg.type === 'hello') {
          if (msg.version !== VERSION) { this.dropGuest(guest, 'Les deux appareils doivent utiliser la même version du jeu.'); return; }
          if (guest.ready) return;
          guest.ready = true; guest.profile = this.cleanProfile(msg.profile); guest.lastSeen = Date.now(); hello();
          clearTimeout(guest.handshake);
          const first = !this.ready; this.repoint();
          if (first) {
            this.ready = true; this.lastSeen = Date.now(); clearTimeout(this.deadline);
            this.pulse = setInterval(() => {
              for (const g of this.guests.slice()) if (g.ready && Date.now() - g.lastSeen > 15000) this.dropGuest(g, 'Ton ami ne répond plus. La partie a été arrêtée.');
              if (this.ready) this.send({ type: 'ping' });
            }, 2000);
            this.status('Ton ami est prêt. Lance la partie !');
            this.events.ready?.();
          } else this.events.joined?.(slot, guest.profile);
          return;
        }
        if (!guest.ready) return;
        guest.lastSeen = this.lastSeen = Date.now();
        if (msg.type === 'ping') { try { conn.send({ type: 'pong' }); } catch (_) {} return; }
        if (msg.type !== 'pong') this.events.message?.(msg, slot);
      });
      conn.on('close', () => { if (active()) this.dropGuest(guest, 'Ton ami a quitté la partie.'); });
      conn.on('error', () => { if (active()) this.dropGuest(guest, 'Connexion avec ton ami interrompue.'); });
      if(conn.open)hello();
    }
    // a guest leaves: the session goes on while somebody is still there
    dropGuest(guest, message) {
      if (!this.guests.includes(guest)) return;
      this.guests = this.guests.filter(g => g !== guest); clearTimeout(guest.handshake);
      try { guest.conn.close(); } catch (_) {}
      const wasReady = guest.ready; this.repoint();
      if (!this.guests.some(g => g.ready)) { if (wasReady || this.maxGuests === 1) this.fail(message); return; }
      if (wasReady) this.events.left?.(guest.slot, guest.profile);
    }
    sendConn(conn, message, disposable) {
      if (!conn?.open) return false;
      // Never queue obsolete snapshots behind a congested data channel.
      if (disposable && (conn.bufferSize > 0 || conn.dataChannel?.bufferedAmount > 65536)) return false;
      try { conn.send(message); return true; }
      catch (_) { if (this.role === 'host') { const g = this.guests.find(x => x.conn === conn); if (g) this.dropGuest(g, 'Envoi interrompu.'); return false; } this.fail('Envoi interrompu. Recrée une partie.'); return false; }
    }
    // host: to every ready guest ; guest: to the host
    send(message, disposable = false) {
      if (!this.ready) return false;
      if (this.role !== 'host') return this.sendConn(this.conn, message, disposable);
      let ok = false; for (const g of this.guests.slice()) if (g.ready && this.sendConn(g.conn, message, disposable)) ok = true;
      return ok;
    }
    sendTo(slot, message, disposable = false) { const g = this.guests.find(x => x.slot === slot && x.ready); return !!g && this.sendConn(g.conn, message, disposable); }
    sendExcept(slot, message) { let ok = false; for (const g of this.guests.slice()) if (g.ready && g.slot !== slot && this.sendConn(g.conn, message)) ok = true; return ok; }
    fail(message) { this.close(); this.status(message); this.events.closed?.(message); }
    close() {
      this.epoch++; this.ready = false; this.role = null; this.slot = 0; this.primarySlot = 0;
      clearTimeout(this.deadline); clearTimeout(this.handshake); clearInterval(this.pulse);clearTimeout(this.approvalTimer);
      const pending=this.pendingConnection;this.pendingConnection=null;try{pending?.close();}catch(e){}this.events.joinClosed?.();this.remoteProfile=null;
      const guests = this.guests; this.guests = [];
      for (const g of guests) { clearTimeout(g.handshake); try { g.conn.close(); } catch (_) {} }
      const conn = this.conn, peer = this.peer; this.conn = this.peer = null;
      try { conn?.close(); } catch (_) {} try { peer?.destroy(); } catch (_) {}
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = BastionSession;
  else root.BastionSession = BastionSession;
})(globalThis);
