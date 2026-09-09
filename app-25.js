(function(){
  const esc = s => { try{return Utils.escapeHtml(String(s ?? ''));}catch(e){return String(s ?? '');} };
  const DOC_TYPES = [
    {key:'cni', label:'CNI (Carte Nationale d’Identité)'},
    {key:'passeport', label:'Passeport'},
    {key:'cmu', label:'Carte CMU'},
    {key:'nationalite', label:'Certificat de nationalité'},
    {key:'carte_scolaire', label:'Carte scolaire'}
  ];
  function docLabel(key){ const d=DOC_TYPES.find(x=>x.key===key); return d?d.label:"Pièce d'identité"; }

  window.VerificationForm = {
    _docFile:null, _photoFile:null, _docType:'cni',
    selectDoc(key){ this._docType=key; if(Router.current==='verification') Router.go('verification'); },
    handleDocFile(evt){
      const f=evt.target.files&&evt.target.files[0]; if(!f) return;
      siamsPrepareImageDataURL(f,{maxDim:1600}).then(dataUrl=>{
        VerificationForm._docFile=dataUrl;
        const prev=document.getElementById('verif-doc-preview');
        if(prev) prev.innerHTML=`<img src="${dataUrl}" style="width:100%;border-radius:12px;display:block;">`;
      }).catch(()=>Toast.show('Impossible de traiter ce fichier'));
    },
    handlePhotoFile(evt){
      const f=evt.target.files&&evt.target.files[0]; if(!f) return;
      siamsPrepareImageDataURL(f,{maxDim:1200}).then(dataUrl=>{
        VerificationForm._photoFile=dataUrl;
        const prev=document.getElementById('verif-photo-preview');
        if(prev) prev.innerHTML=`<img src="${dataUrl}" style="width:100%;border-radius:12px;display:block;">`;
      }).catch(()=>Toast.show('Impossible de traiter cette photo'));
    },
    async submit(){
      if(!this._docFile){ Toast.show('Ajoutez une photo ou un scan de votre pièce'); return; }
      if(!this._photoFile){ Toast.show('Prenez la photo en temps réel demandée'); return; }
      const btn=document.getElementById('verif-submit-btn');
      if(btn){ btn.disabled=true; btn.textContent='Envoi en cours…'; }
      try{
        await Store.submitVerification(this._docType, this._docFile, this._photoFile);
        Toast.show('Demande de certification envoyée ✓');
        this._docFile=null; this._photoFile=null;
        Router.go('verification');
      }catch(e){
        console.error(e);
        Toast.show("Erreur lors de l'envoi, réessayez.");
        if(btn){ btn.disabled=false; btn.textContent='Envoyer ma demande de certification'; }
      }
    }
  };

  Views.verification = function(){
    const v = (Store.store && Store.store.verification) || {status:'none'};
    if(v.status==='verified'){
      return `${TopBar('Certification boutique','')}<div style="padding:20px;">
        <div style="border:1.5px solid #1FAA59;border-radius:20px;padding:22px;background:#EAFBF1;text-align:center;">
          <div style="font-size:38px;">✅</div>
          <h2 style="margin:10px 0 6px;">Boutique certifiée</h2>
          <p style="color:var(--text-mid);font-size:13px;margin:0;">Le badge vert de certification s'affiche désormais à côté du nom de votre boutique, pour rassurer vos clients.</p>
        </div>
      </div>`;
    }
    if(v.status==='pending'){
      return `${TopBar('Certification boutique','')}<div style="padding:20px;">
        <div style="border:1.5px solid var(--gold);border-radius:20px;padding:22px;background:var(--gold-tint);text-align:center;">
          <div style="font-size:38px;">⏳</div>
          <h2 style="margin:10px 0 6px;">Vérification en cours</h2>
          <p style="color:var(--text-mid);font-size:13px;margin:0;">Votre dossier (${esc(docLabel(v.docType))}) a été transmis le ${v.submittedAt?new Date(v.submittedAt).toLocaleDateString('fr-FR'):''}. L'équipe SIAMS l'examine et vous notifiera dès validation.</p>
        </div>
      </div>`;
    }
    const rejected = v.status==='rejected';
    return `${TopBar('Certification boutique','')}
    <div style="padding:0 20px 100px;">
      ${rejected?`<div style="border:1.5px solid var(--red);border-radius:16px;padding:14px;background:#FDEDED;margin-bottom:14px;"><b style="color:var(--red);font-size:13px;">Demande refusée</b><p style="margin:6px 0 0;font-size:12.5px;color:var(--text-mid);">${esc(v.rejectReason||"Document illisible ou non conforme. Merci de soumettre à nouveau.")}</p></div>`:''}
      <div class="v15-merchant-card" style="margin:0 0 16px;">
        <div class="v15-kicker">SERVICE SIAMS · CERTIFICATION</div>
        <h2>Obtenez le badge vert certifié</h2>
        <p>Fournissez une pièce officielle (CNI, Passeport, CMU, Certificat de nationalité ou Carte scolaire) et une photo prise en temps réel pour être identifié comme vendeur sérieux auprès de vos clients.</p>
      </div>
      <div class="section-title">1. Choisissez votre pièce</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 20px 0;">
        ${DOC_TYPES.map(d=>`<button type="button" onclick="VerificationForm.selectDoc('${d.key}')" style="text-align:left;padding:11px;border-radius:13px;border:1.5px solid ${VerificationForm._docType===d.key?'var(--indigo)':'var(--line)'};background:${VerificationForm._docType===d.key?'var(--indigo-tint)':'#fff'};font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;">${esc(d.label)}</button>`).join('')}
      </div>
      <div class="section-title">2. Photo ou scan de la pièce</div>
      <div style="margin:8px 20px 0;">
        <label class="btn btn-outline btn-block" style="cursor:pointer;">📎 Ajouter la pièce jointe<input type="file" accept="image/*" class="hidden" onchange="VerificationForm.handleDocFile(event)"></label>
        <div id="verif-doc-preview" style="margin-top:10px;"></div>
      </div>
      <div class="section-title">3. Photo prise en temps réel</div>
      <div style="margin:8px 20px 0;">
        <label class="btn btn-outline btn-block" style="cursor:pointer;">🤳 Prendre la photo maintenant<input type="file" accept="image/*" capture="user" class="hidden" onchange="VerificationForm.handlePhotoFile(event)"></label>
        <p style="font-size:11px;color:var(--text-soft);margin:6px 0 0;">L'appareil photo s'ouvre directement — cette photo ne peut pas être choisie depuis la galerie.</p>
        <div id="verif-photo-preview" style="margin-top:10px;"></div>
      </div>
      <div style="margin:20px 20px 0;">
        <button id="verif-submit-btn" type="button" class="btn btn-primary btn-block" onclick="VerificationForm.submit()">Envoyer ma demande de certification</button>
      </div>
    </div>`;
  };
})();
