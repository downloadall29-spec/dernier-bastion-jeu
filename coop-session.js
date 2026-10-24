/* Transport for one host and one guest. No game state or save data lives here. */
(function (root) {
  'use strict';
  const VERSION = 3, PREFIX = 'dernier-bastion-v1-';
  class BastionSession {
    constructor(PeerType, events = {}, options = {}) {
      this.PeerType = PeerType; this.events = events; this.options = options;
      this.role = null; this.peer = null; this.conn = null; this.ready = false;
      this.epoch = 0; this.lastSeen = 0; this.pendingConnection=null; this.remoteProfile=null;
    }
    status(message) { this.events.status?.(message); }
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
          if(!active()||role!=='host'||this.conn||this.pendingConnection||conn.metadata?.version!==VERSION){
            conn.on('open',()=>{conn.send({type:'rejected',message:conn.metadata?.version!==VERSION?'Installe la même version que ton ami.':'Une demande ou une partie est déjà en cours.'});setTimeout(()=>conn.close(),100);});return;
          }
          if(!this.events.joinRequest){this.attach(conn,epoch);return;}
          this.pendingConnection=conn;
          const profile=this.cleanProfile(conn.metadata?.profile);
          const decide=accepted=>{
            if(!active()||this.pendingConnection!==conn)return;
            clearTimeout(this.approvalTimer);this.pendingConnection=null;this.events.joinClosed?.();
            if(accepted){this.attach(conn,epoch);}
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
    attach(conn, epoch) {
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
          this.ready = true;this.remoteProfile=this.cleanProfile(msg.profile);this.lastSeen = Date.now();hello();
          clearTimeout(this.deadline); clearTimeout(this.handshake);
          this.pulse = setInterval(() => {
            if (Date.now() - this.lastSeen > 15000) this.fail('Ton ami ne répond plus. La partie a été arrêtée.');
            else this.send({ type: 'ping' });
          }, 2000);
          this.status(this.role === 'host' ? 'Ton ami est prêt. Lance la partie !' : 'Connecté ! Ton ami va lancer la partie.');
          this.events.ready?.(); return;
        }
        if (!this.ready) return;
        this.lastSeen = Date.now();
        if (msg.type === 'ping') { this.send({ type: 'pong' }); return; }
        if (msg.type !== 'pong') this.events.message?.(msg);
      });
      conn.on('close', () => { if (active()) this.fail('Ton ami a quitté la partie.'); });
      conn.on('error', () => { if (active()) this.fail('Connexion avec ton ami interrompue.'); });
      if(conn.open)hello();
    }
    send(message, disposable = false) {
      if (!this.ready || !this.conn?.open) return false;
      // Never queue obsolete snapshots behind a congested data channel.
      if (disposable && (this.conn.bufferSize > 0 || this.conn.dataChannel?.bufferedAmount > 65536)) return false;
      try { this.conn.send(message); return true; }
      catch (_) { this.fail('Envoi interrompu. Recrée une partie.'); return false; }
    }
    fail(message) { this.close(); this.status(message); this.events.closed?.(message); }
    close() {
      this.epoch++; this.ready = false; this.role = null;
      clearTimeout(this.deadline); clearTimeout(this.handshake); clearInterval(this.pulse);clearTimeout(this.approvalTimer);
      const pending=this.pendingConnection;this.pendingConnection=null;try{pending?.close();}catch(e){}this.events.joinClosed?.();this.remoteProfile=null;
      const conn = this.conn, peer = this.peer; this.conn = this.peer = null;
      try { conn?.close(); } catch (_) {} try { peer?.destroy(); } catch (_) {}
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = BastionSession;
  else root.BastionSession = BastionSession;
})(globalThis);
