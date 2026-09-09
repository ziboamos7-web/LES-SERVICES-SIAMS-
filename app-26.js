(function(){
  'use strict';
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
  const DURATION_MS = 10*60*1000; // même délai que COURIER_OFFER_TIMEOUT_MS (vue liste)
  const deadlineKey = id => 'siams_mission_deadline_'+id;
  const handledKey = id => 'siams_mission_handled_'+id; /* évite de reproposer la même offre au livreur pendant la session en cours, le temps que le backend reflète le refus/l'expiration */

  window.MissionOfferPopup = {
    _id:null, _deadline:0, _timer:null, _declining:false,

    /* Appelée après chaque chargement du tableau de bord livreur : ouvre la
       popup pour la première mission "proposée" qui n'a pas déjà été traitée
       par ce livreur sur cet appareil pendant la session en cours. Si une
       popup est déjà affichée, on ne l'interrompt pas pour une autre offre. */
    maybeShow(rows){
      if(this._id) return;
      const offer = (rows||[]).find(a=>a && a.status==='offered' && !sessionStorage.getItem(handledKey(a.id)));
      if(offer) this.open(offer);
    },

    open(a){
      if(document.getElementById('v58-mission-popup')) return;
      this._id = a.id;
      let deadline = Number(sessionStorage.getItem(deadlineKey(a.id))||0);
      if(!deadline || deadline < Date.now()){ deadline = Date.now()+DURATION_MS; }
      sessionStorage.setItem(deadlineKey(a.id), String(deadline));
      this._deadline = deadline;
      const html = `<div id="v58-mission-popup" class="v57-popup-overlay"><div class="v57-popup-card" style="max-width:380px;">
        <div class="v58-mission-hero">
          <span class="v58-mission-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><circle cx="6" cy="18" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="18" r="2.6" stroke="currentColor" stroke-width="1.7"/><path d="M6 18h6l1.8-6H10M13.8 12l1.7-3.5h3M17 18l-1.6-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="7" r="1.3" fill="currentColor"/></svg>Nouvelle mission</span>
          <span id="v58-mission-countdown" class="v58-mission-countdown">10:00</span>
          <div class="v58-mission-bar-track"><div id="v58-mission-bar-fill" class="v58-mission-bar-fill" style="width:100%;"></div></div>
        </div>
        <div class="v58-mission-body">
          <div class="v58-mission-order">Commande #${esc(a.order_number||'')}</div>
          <div class="v58-mission-client"><b>${esc(a.customer_name||'')}</b><span>${esc(a.customer_address||'')}</span></div>
          ${a.amount!=null?`<div class="v58-mission-amount">${Utils.fmtFCFA(a.amount)}</div>`:''}
          <div class="v58-mission-eta-row"><label>Délai estimé de livraison</label><select id="v58-mission-eta"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>1 h</option><option value="90">1 h 30</option><option value="120">2 h</option></select></div>
        </div>
        <div class="v58-mission-actions">
          <button class="btn btn-outline btn-block" onclick="MissionOfferPopup.decline()">Refuser</button>
          <button class="btn btn-primary btn-block" onclick="MissionOfferPopup.accept()">Accepter la livraison</button>
        </div>
      </div></div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      requestAnimationFrame(()=>document.getElementById('v58-mission-popup')?.classList.add('show'));
      this.tick();
      this._timer = setInterval(()=>this.tick(), 1000);
    },

    tick(){
      const remaining = this._deadline - Date.now();
      if(remaining<=0){ this.expire(); return; }
      const el = document.getElementById('v58-mission-countdown');
      const bar = document.getElementById('v58-mission-bar-fill');
      const m = Math.floor(remaining/60000);
      const s = Math.floor((remaining%60000)/1000);
      if(el){ el.textContent = m+':'+String(s).padStart(2,'0'); el.classList.toggle('low', remaining<60000); }
      if(bar){ bar.style.width = Math.max(0,(remaining/DURATION_MS*100)).toFixed(1)+'%'; }
    },

    _cleanup(){
      if(this._timer){ clearInterval(this._timer); this._timer=null; }
      const el=document.getElementById('v58-mission-popup'); if(el) el.remove();
      if(this._id) sessionStorage.removeItem(deadlineKey(this._id));
      this._id=null;
    },

    async accept(){
      const id=this._id; if(!id) return;
      const eta=document.getElementById('v58-mission-eta')?.value||60;
      document.querySelectorAll('#v58-mission-popup .v58-mission-actions .btn').forEach(b=>b.disabled=true);
      try{
        const sess=courierSession();
        if(!sess) throw new Error('Session livreur expirée');
        await Cloud.courierAcceptAssignment(sess.session_token, id, eta);
        Toast.show('Livraison acceptée ✓');
        sessionStorage.setItem(handledKey(id),'1');
        this._cleanup();
        loadCourierDashboard();
      }catch(e){
        console.error('Acceptation mission',e);
        Toast.show('⚠️ '+((e&&e.message)||'Impossible d’accepter la mission'));
        document.querySelectorAll('#v58-mission-popup .v58-mission-actions .btn').forEach(b=>b.disabled=false);
      }
    },

    async decline(){
      const id=this._id; if(!id || this._declining) return;
      this._declining=true;
      document.querySelectorAll('#v58-mission-popup .v58-mission-actions .btn').forEach(b=>b.disabled=true);
      await this._sendDecline(id);
      sessionStorage.setItem(handledKey(id),'1');
      this._declining=false;
      this._cleanup();
      Toast.show('Mission refusée');
      loadCourierDashboard();
    },

    /* Compte à rebours écoulé sans réponse : refus silencieux, la commande
       redevient "non affectée" côté marchand qui peut réaffecter un livreur. */
    async expire(){
      const id=this._id; if(!id) return;
      await this._sendDecline(id);
      sessionStorage.setItem(handledKey(id),'1');
      this._cleanup();
      loadCourierDashboard();
    },

    async _sendDecline(id){
      try{
        const sess=courierSession();
        if(sess) await Cloud.courierDeclineAssignment(sess.session_token, id);
      }catch(e){ console.error('Refus mission',e); }
    }
  };

  const oldLoadForMissionPopup = window.loadCourierDashboard;
  if(oldLoadForMissionPopup){
    window.loadCourierDashboard = async function(){
      const r = await oldLoadForMissionPopup.apply(this, arguments);
      try{
        const sess = courierSession();
        if(sess && Router.current==='courier-dashboard'){
          const rows = await Cloud.courierAssignments(sess.session_token);
          MissionOfferPopup.maybeShow(rows);
        }
      }catch(e){ console.error('Vérification popup mission',e); }
      return r;
    };
  }
})();
