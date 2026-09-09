(function(){
  'use strict';
  const DOCS=[
    ['cni','CNI / Carte nationale d’identité'],
    ['passeport','Passeport'],
    ['cmu','Carte CMU'],
    ['nationalite','Certificat de nationalité'],
    ['carte_scolaire','Carte scolaire']
  ];
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
  const label=k=>(DOCS.find(x=>x[0]===k)||['','Pièce d’identité'])[1];

  /* ---------- LIVREUR : remplacement de l'ancien bloc CNI/permis/carte grise/assurance ---------- */
  let courierIdDoc=null, courierPhoto=null, courierDocType='cni';

  window.CourierIdentity={
    data:null,
    async load(){
      const sess=courierSession(), mount=document.getElementById('courier-docs-list');
      if(!sess||!mount)return;
      try{
        const r=await sb.rpc('courier_get_documents',{p_session_token:sess.session_token});
        const old=Array.isArray(r.data)?r.data[0]:r.data;
        /* Si la migration V64 est installée, récupérer les champs d'identité directement. */
        const {data,error}=await sb.from('couriers').select('identity_status,identity_doc_type,identity_doc_url,identity_photo_url,identity_submitted_at,identity_verified_at,identity_reject_reason').eq('id',sess.courier_id||sess.id).maybeSingle();
        this.data=!error&&data?data:(old||{});
        this.render();
        this.renderBadge();
      }catch(e){
        console.error(e);
        this.render();
      }
    },
    render(){
      const mount=document.getElementById('courier-docs-list');if(!mount)return;
      const d=this.data||{}, status=d.identity_status||'none';
      if(status==='verified'){
        mount.innerHTML=`<div class="siams-id-status verified"><span>✓</span><div><b>Identité vérifiée par SIAMS</b><br><small>Votre badge vert certifié est actif.</small></div></div>`;
        return;
      }
      if(status==='pending'){
        mount.innerHTML=`<div class="siams-id-status pending"><span>⏳</span><div><b>Vérification en cours</b><br><small>Votre dossier est en cours d’examen par SIAMS.</small></div></div>`;
        return;
      }
      const rejected=status==='rejected';
      mount.innerHTML=`<div class="siams-id-card">
        <div style="font-size:8.5px;font-weight:900;letter-spacing:.12em;color:#0b67d8">SIAMS · IDENTIFICATION DU COMPTE</div>
        <div style="font-size:17px;font-weight:900;margin-top:5px">Obtenir le badge certifié</div>
        <p style="font-size:11px;color:#667085;line-height:1.5;margin:6px 0 0">Choisissez une pièce officielle, envoyez sa photo puis prenez une photo de vous avec l’appareil photo. Après approbation par l’administration SIAMS, le badge vert apparaît automatiquement.</p>
        ${rejected?`<div class="siams-id-status rejected"><span>!</span><div><b>Dossier refusé</b><br>${esc(d.identity_reject_reason||'Document non conforme. Merci de soumettre à nouveau.')}</div></div>`:''}
        <div style="font-size:9px;font-weight:900;letter-spacing:.08em;margin-top:15px">1 · CHOISIR LA PIÈCE</div>
        <div class="siams-id-doc-grid">${DOCS.map(x=>`<button class="siams-id-doc ${courierDocType===x[0]?'selected':''}" onclick="CourierIdentity.selectDoc('${x[0]}')">${esc(x[1])}</button>`).join('')}</div>
        <div style="font-size:9px;font-weight:900;letter-spacing:.08em;margin-top:15px">2 · PHOTO / SCAN DE LA PIÈCE</div>
        <label class="siams-id-upload">📄<b>Ajouter ma pièce</b><small>Image nette et lisible</small><input type="file" accept="image/*" style="display:none" onchange="CourierIdentity.docFile(event)"></label>
        <div id="courier-id-doc-preview" class="siams-id-preview"></div>
        <div style="font-size:9px;font-weight:900;letter-spacing:.08em;margin-top:15px">3 · PHOTO DE VÉRIFICATION</div>
        <label class="siams-id-upload">🤳<b>Prendre ma photo maintenant</b><small>La caméra frontale est utilisée</small><input type="file" accept="image/*" capture="user" style="display:none" onchange="CourierIdentity.photoFile(event)"></label>
        <div id="courier-id-photo-preview" class="siams-id-preview"></div>
        <button class="courier-primary-btn full" style="margin-top:13px" onclick="CourierIdentity.submit()">Envoyer mon dossier</button>
      </div>`;
    },
    selectDoc(k){courierDocType=k;this.render();},
    async docFile(e){
      const f=e.target.files&&e.target.files[0];if(!f)return;
      courierIdDoc=await siamsPrepareImageDataURL(f,{maxDim:1600});
      const p=document.getElementById('courier-id-doc-preview');if(p)p.innerHTML=`<img src="${courierIdDoc}">`;
    },
    async photoFile(e){
      const f=e.target.files&&e.target.files[0];if(!f)return;
      courierPhoto=await siamsPrepareImageDataURL(f,{maxDim:1200});
      const p=document.getElementById('courier-id-photo-preview');if(p)p.innerHTML=`<img src="${courierPhoto}">`;
    },
    async submit(){
      const sess=courierSession();if(!sess)return;
      if(!courierIdDoc||!courierPhoto){Toast.show('Ajoutez la pièce et la photo de vérification.');return;}
      try{
        const docUrl=await Cloud.ensureStoredUrl(courierIdDoc,'identity-documents');
        const photoUrl=await Cloud.ensureStoredUrl(courierPhoto,'identity-photos');
        const {error}=await sb.rpc('courier_submit_identity',{p_session_token:sess.session_token,p_doc_type:courierDocType,p_doc_url:docUrl,p_photo_url:photoUrl});
        if(error)throw error;
        courierIdDoc=null;courierPhoto=null;
        Toast.show('Dossier envoyé à SIAMS ✓');
        this.load();
      }catch(e){console.error(e);Toast.show('Impossible d’envoyer le dossier. Vérifiez la configuration Supabase.');}
    },
    renderBadge(){
      const v=this.data&&this.data.identity_status==='verified';
      const html=v?CertifiedBadge(16):'';
      const a=document.getElementById('courier-cert-badge');if(a)a.innerHTML=html;
      const b=document.getElementById('courier-cert-badge-hero');if(b)b.innerHTML=html;
    }
  };

  /* On réutilise le point d'entrée déjà appelé par l'espace livreur. */
  window.CourierDocs=window.CourierIdentity;

  /* ---------- ADMIN : une seule boîte de réception pour marchands + livreurs ----------
     CORRECTIF : la version précédente dépendait des RPC Supabase "siams_identity_pending"
     et "siams_review_identity", jamais créées côté base — chaque ouverture échouait donc
     silencieusement. On repasse par des lectures/écritures directes des tables "stores"
     et "couriers", exactement comme le fait déjà (avec succès) l'écran de certification
     boutique existant. */
  window.SiamsIdentityAdmin={
    merchants:[], couriers:[],
    async load(){
      const root=document.getElementById('siams-unified-id-list');if(!root)return;
      root.innerHTML='<div style="padding:30px;text-align:center;color:var(--text-mid)">Chargement…</div>';
      try{
        const [mRes,cRes]=await Promise.all([
          sb.from('stores').select('id,name,phone,email,verification_doc_type,verification_doc_url,verification_photo_url,verification_submitted_at').eq('verification_status','pending').order('verification_submitted_at',{ascending:true}).limit(100),
          sb.from('couriers').select('id,name,phone,identity_doc_type,identity_doc_url,identity_photo_url,identity_submitted_at').eq('identity_status','pending').order('identity_submitted_at',{ascending:true}).limit(100)
        ]);
        this.merchants=mRes.data||[]; this.couriers=cRes.data||[];
        root.innerHTML=this.renderSection('🏪 Marchands',this.merchants,'merchant')+this.renderSection('🚴 Livreurs',this.couriers,'courier');
      }catch(e){console.error(e);root.innerHTML='<div style="padding:25px;text-align:center;color:#b42318">Impossible de charger les dossiers.</div>';}
    },
    renderSection(title,rows,type){
      const head=`<div style="font-size:11px;font-weight:900;letter-spacing:.06em;color:var(--text-mid);margin:16px 4px 8px">${title} · ${rows.length} en attente</div>`;
      if(!rows.length) return head+'<div style="padding:18px 10px 4px;text-align:center;color:var(--text-mid);font-size:11.5px">✓ Aucun dossier en attente.</div>';
      return head+rows.map(r=>`
        <article class="siams-admin-id-card">
          <div class="siams-admin-id-head"><div><div class="siams-admin-id-name">${esc(r.name||'Compte')}</div><div class="siams-admin-id-meta">${esc(r.phone||'')}${r.email?' · '+esc(r.email):''}</div></div><span class="siams-id-status pending" style="margin:0;padding:6px 9px">À vérifier</span></div>
          <div style="margin-top:11px;font-size:10.5px;color:#667085"><b>Pièce :</b> ${esc(label(type==='merchant'?r.verification_doc_type:r.identity_doc_type))}<br><b>Envoyée :</b> ${(type==='merchant'?r.verification_submitted_at:r.identity_submitted_at)?new Date(type==='merchant'?r.verification_submitted_at:r.identity_submitted_at).toLocaleString('fr-FR'):'—'}</div>
          <div class="siams-admin-id-images">
            ${(type==='merchant'?r.verification_doc_url:r.identity_doc_url)?`<a href="${esc(type==='merchant'?r.verification_doc_url:r.identity_doc_url)}" target="_blank"><img src="${esc(type==='merchant'?r.verification_doc_url:r.identity_doc_url)}" alt="Pièce d'identité"></a>`:'<div style="border:1px dashed #cbd5e1;border-radius:13px;display:grid;place-items:center;font-size:10px;color:#98a2b3">Pièce absente</div>'}
            ${(type==='merchant'?r.verification_photo_url:r.identity_photo_url)?`<a href="${esc(type==='merchant'?r.verification_photo_url:r.identity_photo_url)}" target="_blank"><img src="${esc(type==='merchant'?r.verification_photo_url:r.identity_photo_url)}" alt="Photo de vérification"></a>`:'<div style="border:1px dashed #cbd5e1;border-radius:13px;display:grid;place-items:center;font-size:10px;color:#98a2b3">Photo absente</div>'}
          </div>
          <div style="font-size:9px;color:#98a2b3;margin-top:5px">Gauche : document · Droite : photo de vérification</div>
          <div class="siams-admin-id-actions"><button class="ok" onclick="SiamsIdentityAdmin.review('${type}','${esc(r.id)}','verified')">✓ APPROUVER · BADGE VERT</button><button class="no" onclick="SiamsIdentityAdmin.review('${type}','${esc(r.id)}','rejected')">Refuser</button></div>
        </article>`).join('');
    },
    async review(type,id,status){
      let reason=null;
      if(status==='rejected'){reason=prompt('Motif du refus :','Document illisible ou non conforme. Merci de soumettre à nouveau.');if(reason===null)return;}
      try{
        if(type==='merchant'){
          const patch=status==='verified'
            ?{verification_status:'verified',verified:true,verified_at:new Date().toISOString(),verification_reject_reason:null}
            :{verification_status:'rejected',verified:false,verification_reject_reason:reason};
          const {error}=await sb.from('stores').update(patch).eq('id',id); if(error)throw error;
        }else{
          const patch=status==='verified'
            ?{identity_status:'verified',identity_verified_at:new Date().toISOString(),identity_reject_reason:null}
            :{identity_status:'rejected',identity_reject_reason:reason};
          const {error}=await sb.from('couriers').update(patch).eq('id',id); if(error)throw error;
        }
        Toast.show(status==='verified'?'Compte certifié ✓ Badge vert activé':'Dossier refusé');
        this.load();
      }catch(e){console.error(e);Toast.show('Erreur lors de la décision SIAMS.');}
    }
  };

  Views['siams-admin-identity-verifications']=function(){
    if(typeof isSiamsAdmin==='function'&&!isSiamsAdmin())return `<div style="padding:30px 20px"><h2>Accès administrateur SIAMS</h2><p style="color:var(--text-mid)">Cette section est réservée au compte administrateur SIAMS.</p></div>`;
    return `<div class="topbar" style="padding-top:18px"><div><h1>Identification des comptes</h1><div style="font-size:11px;color:var(--text-mid)">Marchands et livreurs · dossiers à vérifier</div></div><button class="bell-btn" onclick="Router.go('dashboard')">←</button></div><div style="padding:0 20px 100px"><div class="siams-id-hero"><div style="font-size:9px;font-weight:900;letter-spacing:.12em;opacity:.7">CENTRE DE VÉRIFICATION SIAMS</div><h2>Identités à contrôler</h2><p>Examinez la pièce officielle et la photo de vérification. L’approbation active automatiquement le badge vert certifié.</p></div><div id="siams-unified-id-list">Chargement…</div></div>`;
  };
  Views._after_siams_admin_identity_verifications=()=>SiamsIdentityAdmin.load();

  /* Accès direct depuis le dashboard administrateur. */
  const oldDash=Views.dashboard;
  if(oldDash && !oldDash.__v64Identity){
    const wrapped=function(){
      let h=oldDash();
      if(typeof isSiamsAdmin==='function'&&isSiamsAdmin()&&!h.includes('siams-admin-identity-verifications')){
        h=h.replace('<div class="dashboard-v2-head">','<div style="margin:0 20px 10px"><button class="btn btn-primary btn-block" onclick="Router.go(\'siams-admin-identity-verifications\')">🛡️ Identification · Marchands + Livreurs</button></div><div class="dashboard-v2-head">');
      }
      return h;
    };
    wrapped.__v64Identity=true;Views.dashboard=wrapped;
  }

  /* Synchronise le badge livreur quand il ouvre son profil. */
  const oldLoad=window.loadCourierProfileExtras;
  if(oldLoad && !oldLoad.__v64Identity){
    const f=function(){
      const r=oldLoad.apply(this,arguments);
      setTimeout(()=>CourierIdentity.load(),120);
      return r;
    };
    f.__v64Identity=true;window.loadCourierProfileExtras=f;
  }
})();
