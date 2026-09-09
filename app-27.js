(function(){
  'use strict';
  const esc = s => { try{ return Utils.escapeHtml(String(s??'')); }catch(e){ return String(s??''); } };

  const COURIER_DOC_TYPES = [
    {key:'cni', label:"CNI / Carte d'identité", svg:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5" width="19" height="14" rx="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="12" r="2.1" stroke="currentColor" stroke-width="1.5"/><path d="M12.5 9.5h6M12.5 12.5h6M12.5 15.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'},
    {key:'permis', label:'Permis de conduire', svg:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 15.5h6M9 8.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'},
    {key:'carte_grise', label:'Carte grise du véhicule', svg:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 8h11v9H4zM15 11h3l3 3v3h-6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.5" cy="19" r="1.6" stroke="currentColor" stroke-width="1.4"/><circle cx="17.5" cy="19" r="1.6" stroke="currentColor" stroke-width="1.4"/></svg>'},
    {key:'assurance', label:'Assurance véhicule', svg:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3.5 19 6.5v5c0 5-3 8.3-7 9.5-4-1.2-7-4.5-7-9.5v-5L12 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 12 2.2 2.2L15.5 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
  ];

  const STATUS_CHIP = {
    none:     {label:'À fournir',        bg:'var(--mango-tint)', fg:'var(--mango-dark)'},
    pending:  {label:'En vérification',  bg:'var(--gold-tint)',  fg:'var(--gold-dark)'},
    verified: {label:'Validé ✓',         bg:'var(--green-tint)', fg:'var(--green)'},
    rejected: {label:'Refusé',           bg:'var(--red-tint)',   fg:'var(--red)'}
  };
  function statusChip(status){
    const m = STATUS_CHIP[status] || STATUS_CHIP.none;
    return `<span style="font-size:10.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:${m.bg};color:${m.fg};white-space:nowrap;flex:none;">${m.label}</span>`;
  }

  window.CourierDocs = {
    _data: null,
    async load(){
      const sess = courierSession();
      const mount = document.getElementById('courier-docs-list');
      if(!sess || !mount) return;
      try{
        const r = await Cloud.courierDocuments(sess.session_token);
        this._data = Array.isArray(r) ? r[0] : r;
        this.render();
        this.renderBadge();
      }catch(e){
        console.error('Chargement documents livreur', e);
        mount.innerHTML = `<div class="courier-tab-empty-note" style="padding:24px 10px;">
          <div style="margin-bottom:6px;display:flex;justify-content:center;color:var(--text-soft);"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          Cette fonctionnalité attend une mise à jour côté serveur. Contactez l'assistant SIAMS si ce message persiste.
        </div>`;
      }
    },
    render(){
      const mount = document.getElementById('courier-docs-list'); if(!mount) return;
      const c = this._data || {};
      mount.innerHTML = COURIER_DOC_TYPES.map(d=>{
        const status = c['doc_'+d.key+'_status'] || 'none';
        const rejectReason = status==='rejected' ? (c.doc_reject_reason||'') : '';
        return `<label class="courier-doc-row">
          <div style="width:38px;height:38px;border-radius:12px;background:var(--panel);display:flex;align-items:center;justify-content:center;color:var(--ink);flex:none;">${d.svg}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:13.5px;">${esc(d.label)}</div>
            ${rejectReason?`<div style="font-size:11px;color:var(--red);margin-top:2px;">${esc(rejectReason)}</div>`:''}
          </div>
          ${statusChip(status)}
          <input type="file" accept="image/*" onchange="CourierDocs.handleFile('${d.key}', event)">
        </label>`;
      }).join('') + `<p style="font-size:11px;color:var(--text-soft);margin:6px 4px 0;">Touchez un document pour l'ajouter ou le remplacer. Une fois vos 4 pièces validées par SIAMS, votre badge certifié s'affiche automatiquement.</p>`;
    },
    renderBadge(){
      const verified = !!(this._data && this._data.documents_verified);
      const html = verified ? CertifiedBadge(16) : '';
      const a = document.getElementById('courier-cert-badge'); if(a) a.innerHTML = html;
      const b = document.getElementById('courier-cert-badge-hero'); if(b) b.innerHTML = html;
    },
    async handleFile(docKey, evt){
      const f = evt.target.files && evt.target.files[0]; if(!f) return;
      const sess = courierSession(); if(!sess) return;
      try{
        const dataUrl = await siamsPrepareImageDataURL(f, {maxDim:1600});
        Toast.show('Envoi du document…');
        await Cloud.courierSubmitDocument(sess.session_token, docKey, dataUrl);
        Toast.show('Document envoyé ✓ En cours de vérification');
        this.load();
      }catch(e){
        console.error('Envoi document livreur', e);
        Toast.show("⚠️ Impossible d'envoyer ce document, réessayez.");
      }
    }
  };

  function renderCourierSettingsSection(){
    const notifOn = localStorage.getItem('siams_courier_notif_pref')!=='0';
    const gpsOn = localStorage.getItem('siams_courier_gps_pref')!=='0';
    const toggleSw = on => `<span style="display:inline-flex;align-items:center;width:38px;height:22px;border-radius:999px;background:${on?'var(--green)':'var(--line)'};position:relative;transition:background .2s;flex:none;"><span style="position:absolute;top:2px;left:${on?'18px':'2px'};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s;"></span></span>`;
    const icoBell='<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    const icoPin='<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>';
    const icoChat='<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1.2-3.6A7.9 7.9 0 0 1 4 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    const icoWrap = svg => `<div style="width:38px;height:38px;border-radius:12px;background:var(--panel);display:flex;align-items:center;justify-content:center;color:var(--ink);flex:none;">${svg}</div>`;
    return `
    <div class="courier-doc-row" onclick="CourierSettings.toggleNotif()" style="cursor:pointer;">
      ${icoWrap(icoBell)}
      <div style="flex:1;font-weight:800;font-size:13.5px;">Notifications missions</div>
      ${toggleSw(notifOn)}
    </div>
    <div class="courier-doc-row" onclick="CourierSettings.toggleGps()" style="cursor:pointer;">
      ${icoWrap(icoPin)}
      <div style="flex:1;font-weight:800;font-size:13.5px;">Partage de position</div>
      ${toggleSw(gpsOn)}
    </div>
    <div class="courier-doc-row" onclick="window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent('Bonjour SIAMS, j’ai besoin d’assistance depuis mon espace livreur.'),'_blank')" style="cursor:pointer;">
      ${icoWrap(icoChat)}
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;font-size:13.5px;">Assistance SIAMS</div>
        <div style="font-size:11px;color:var(--text-mid);margin-top:2px;">0748964690 · serviceclientsiams.ci@gmail.com</div>
      </div>
      <span style="color:var(--text-soft);font-size:16px;">›</span>
    </div>`;
  }

  window.CourierSettings = {
    toggleNotif(){
      const cur = localStorage.getItem('siams_courier_notif_pref')!=='0';
      localStorage.setItem('siams_courier_notif_pref', cur?'0':'1');
      const mount=document.getElementById('courier-settings-list'); if(mount) mount.innerHTML=renderCourierSettingsSection();
      Toast.show(cur?'Notifications désactivées':'Notifications activées');
    },
    toggleGps(){
      const cur = localStorage.getItem('siams_courier_gps_pref')!=='0';
      localStorage.setItem('siams_courier_gps_pref', cur?'0':'1');
      const mount=document.getElementById('courier-settings-list'); if(mount) mount.innerHTML=renderCourierSettingsSection();
      Toast.show(cur?'Partage de position désactivé':'Partage de position activé (utilisé pendant vos livraisons)');
    }
  };

  /* ---- Statistiques de l'onglet Profil (Acceptation / Missions / Ce mois-ci) : réutilise
     les mêmes appels Cloud que les onglets Missions et Gains, sans dupliquer de logique. ---- */
  async function loadCourierProfileStats(){
    const sess = courierSession();
    const mount = document.getElementById('courier-profile-stats');
    if(!sess || !mount) return;
    try{
      const rows = await Cloud.courierAssignments(sess.session_token);
      const total = rows.length;
      const accepted = rows.filter(a=>a.status==='accepted'||a.status==='delivered').length;
      const declined = rows.filter(a=>a.status==='declined').length;
      const rate = (accepted+declined)>0 ? Math.round(accepted/(accepted+declined)*100)+'%' : '—';
      let monthTotal = '—';
      try{
        const earn = await Cloud.courierEarnings(sess.session_token);
        const e = Array.isArray(earn) ? earn[0] : earn;
        if(e && e.month!=null) monthTotal = Utils.fmtFCFA(Number(e.month||0));
      }catch(e2){ /* écran Gains gère déjà l'absence de la fonction SQL ; ici on garde le tiret */ }
      mount.innerHTML = `<div class="courier-stats-row">
        <div class="courier-stat"><b>${rate}</b><span>Acceptation</span></div>
        <div class="courier-stat"><b>${total}</b><span>Missions</span></div>
        <div class="courier-stat"><b>${monthTotal}</b><span>Ce mois-ci</span></div>
      </div>`;
    }catch(e){ console.error('Statistiques profil livreur', e); }
  }

  /* ---- Panneau admin SIAMS : validation des pièces d'identité du livreur (CNI, permis,
     carte grise, assurance) — même logique que la certification boutique existante
     (Views['siams-admin-verifications']), mais document par document puisqu'un livreur
     envoie 4 pièces distinctes. Mise à jour directe de la ligne "couriers" ; le trigger
     SQL courier_recompute_documents_verified (migration_courier_documents.sql) active
     seul le badge vert dès que les 4 statuts passent à 'verified'. ---- */
  const ADMIN_EMAIL_V60 = 'serviceclientsiams.ci@gmail.com';
  function isSiamsAdminV60(){
    return (window._siamsCurrentAdminEmail||'').toLowerCase() === ADMIN_EMAIL_V60;
  }

  async function loadAdminCourierVerifications(){
    try{
      const {data,error} = await sb.from('couriers')
        .select('id,name,phone,doc_cni_status,doc_cni_url,doc_permis_status,doc_permis_url,doc_carte_grise_status,doc_carte_grise_url,doc_assurance_status,doc_assurance_url,documents_submitted_at,documents_verified,doc_reject_reason')
        .or('doc_cni_status.eq.pending,doc_permis_status.eq.pending,doc_carte_grise_status.eq.pending,doc_assurance_status.eq.pending')
        .order('documents_submitted_at',{ascending:true}).limit(100);
      if(!error) return data||[];
      console.error(error);
    }catch(e){ console.error(e); }
    return [];
  }
  window.adminCourierDocStatus = async function(courierId, docKey, status, reason){
    try{
      const patch = { ['doc_'+docKey+'_status']: status, doc_reject_reason: status==='rejected' ? (reason||'Document illisible ou non conforme. Merci de renvoyer une pièce nette.') : null };
      const {error} = await sb.from('couriers').update(patch).eq('id', courierId);
      if(error) throw error;
      Toast.show(status==='verified' ? 'Document validé ✓' : 'Document refusé');
    }catch(e){ console.error(e); Toast.show('Erreur lors de la mise à jour'); }
    Router.go('siams-admin-courier-verifications');
  };
  window.adminRejectCourierDoc = function(courierId, docKey){
    const reason = prompt('Motif du refus (visible par le livreur) :', 'Document illisible ou non conforme. Merci de renvoyer une pièce nette.');
    if(reason===null) return;
    adminCourierDocStatus(courierId, docKey, 'rejected', reason);
  };
  Views['siams-admin-courier-verifications'] = function(){
    if(!isSiamsAdminV60()) return `<div style="padding:30px 20px"><h2>Accès administrateur SIAMS</h2><p style="color:var(--text-mid)">Cette section est réservée au compte administrateur SIAMS.</p><button class="btn btn-primary btn-block" onclick="Router.go('dashboard')">Retour</button></div>`;
    return `<div class="topbar" style="padding-top:18px"><div><h1>Certifications livreurs</h1><div style="font-size:11px;color:var(--text-mid)">Documents en attente de vérification</div></div><button class="bell-btn" onclick="Router.go('dashboard')">←</button></div><div id="v60-admin-courier-verifs" style="padding:0 20px 100px"><div style="padding:20px;text-align:center;color:var(--text-mid)">Chargement des documents…</div></div>`;
  };
  Views._after_siams_admin_courier_verifications = async function(){
    const root = document.getElementById('v60-admin-courier-verifs'); if(!root) return;
    const rows = await loadAdminCourierVerifications();
    if(!rows.length){ root.innerHTML = '<div style="padding:40px 10px;text-align:center;color:var(--text-mid)">Aucun document en attente.</div>'; return; }
    root.innerHTML = rows.map(r=>{
      const pendingDocs = COURIER_DOC_TYPES.filter(d=>r['doc_'+d.key+'_status']==='pending');
      return `<article style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div><b>${esc(r.name||'Livreur')}</b><div style="font-size:11px;color:var(--text-mid);margin-top:3px">${esc(r.phone||'')}</div></div>
          ${r.documents_verified?CertifiedBadge(18):''}
        </div>
        ${pendingDocs.map(d=>{
          const url = r['doc_'+d.key+'_url'];
          return `<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);">
            <div style="font-size:12.5px;font-weight:800;margin-bottom:8px;display:flex;align-items:center;gap:7px;"><span style="color:var(--ink);display:inline-flex;">${d.svg}</span>${esc(d.label)}</div>
            ${url?`<a href="${esc(url)}" target="_blank"><img src="${esc(url)}" style="width:100%;max-width:220px;border-radius:12px;border:1px solid var(--line);object-fit:cover;display:block;"></a>`:'<div style="font-size:11px;color:var(--text-soft);">Aucun fichier</div>'}
            <div style="display:flex;gap:7px;margin-top:10px"><button class="btn btn-primary" style="flex:1" onclick="adminCourierDocStatus('${esc(r.id)}','${d.key}','verified')">✓ Valider</button><button class="btn btn-outline" style="flex:1" onclick="adminRejectCourierDoc('${esc(r.id)}','${d.key}')">Refuser</button></div>
          </div>`;
        }).join('')}
      </article>`;
    }).join('');
  };
  /* Ajoute l'accès depuis le dashboard admin SIAMS, à côté des demandes de comptes et
     de la certification boutique déjà présentes. */
  const oldDashV60 = Views.dashboard;
  if(oldDashV60) Views.dashboard = function(){
    let h = oldDashV60();
    if(isSiamsAdminV60() && !h.includes('siams-admin-courier-verifications')){
      h = h.replace('<div class="dashboard-v2-head">', '<div style="margin:0 20px 10px;"><button class="btn btn-outline btn-block" onclick="Router.go(\'siams-admin-courier-verifications\')">🛡️ Demandes de certification livreur</button></div><div class="dashboard-v2-head">');
    }
    return h;
  };

  window.loadCourierProfileExtras = function(){
    const settingsMount = document.getElementById('courier-settings-list');
    if(settingsMount) settingsMount.innerHTML = renderCourierSettingsSection();
    CourierDocs.load();
    loadCourierProfileStats();
    if(window.loadCourierPayoutSection) loadCourierPayoutSection();
  };

  /* ---- Le badge certifié doit aussi apparaître dès l'ouverture du tableau de bord (pas
     seulement quand le livreur va sur l'onglet Profil) : on le charge une fois en tâche de
     fond dès que le tableau de bord livreur est prêt. ---- */
  const oldLoadForCourierDocs = window.loadCourierDashboard;
  if(oldLoadForCourierDocs){
    window.loadCourierDashboard = async function(){
      const r = await oldLoadForCourierDocs.apply(this, arguments);
      try{
        const sess = courierSession();
        if(sess && Router.current==='courier-dashboard' && !CourierDocs._data){
          const data = await Cloud.courierDocuments(sess.session_token);
          CourierDocs._data = Array.isArray(data) ? data[0] : data;
          CourierDocs.renderBadge();
        }
      }catch(e){ /* fonction SQL pas encore déployée : on n'affiche simplement pas le badge */ }
      return r;
    };
  }
})();
