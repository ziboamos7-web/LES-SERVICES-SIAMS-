(function(){
'use strict';
const V67DOCS=[
 {k:'cni',n:"CNI / Carte nationale d'identité"},
 {k:'passeport',n:'Passeport'},
 {k:'cmu',n:'Carte CMU'},
 {k:'nationalite',n:'Certificat de nationalité'},
 {k:'carte_scolaire',n:'Carte scolaire'}
];
const v67esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
let v67DocType='cni',v67Doc=null,v67Photo=null,v67AdFile=null;

function v67CourierSession(){try{return courierSession&&courierSession()}catch(e){return null}}
function v67DocName(k){return (V67DOCS.find(x=>x.k===k)||V67DOCS[0]).n}

/* ---------- Identification livreur : même logique que la certification marchand,
   mais avec les 5 pièces demandées par SIAMS. ---------- */
window.SIAMSCourierIdentity={
 async load(){
  const root=document.getElementById('siams-v67-courier-root');if(!root)return;
  const sess=v67CourierSession();if(!sess){Router.go('courier-login');return}
  let d={status:'none'};
  try{
   const {data,error}=await sb.rpc('courier_get_identity_verification_v67',{p_session_token:sess.session_token});
   if(error)throw error; d=Array.isArray(data)?(data[0]||{}):(data||{});
  }catch(e){console.warn('V67 identité livreur',e)}
  this.data=d;this.render();
 },
 render(){
  const root=document.getElementById('siams-v67-courier-root');if(!root)return;
  const d=this.data||{},status=d.status||'none';
  if(status==='verified'){
   root.innerHTML=`<div class="siams-v67-card"><div class="siams-v67-status siams-v67-ok"><b>✓ Compte livreur certifié</b><br>Le badge vert CERTIFIÉ SIAMS est actif.</div><p>Pièce validée : <b>${v67esc(v67DocName(d.docType))}</b></p></div>`;return;
  }
  if(status==='pending'){
   root.innerHTML=`<div class="siams-v67-card"><div class="siams-v67-status siams-v67-pending"><b>⏳ Vérification en cours</b><br>Votre dossier est maintenant chez l'administration SIAMS.</div><p>Pièce envoyée : <b>${v67esc(v67DocName(d.docType))}</b></p></div>`;return;
  }
  root.innerHTML=`${status==='rejected'?`<div class="siams-v67-card"><div class="siams-v67-status siams-v67-no"><b>Dossier refusé</b><br>${v67esc(d.rejectReason||'Document non conforme. Merci de soumettre un nouveau dossier.')}</div></div>`:''}
  <div class="siams-v67-card"><div class="siams-v67-kicker">ÉTAPE 1 · PIÈCE</div><h3>Identifiez votre compte</h3><p>Une seule pièce est nécessaire.</p><div class="siams-v67-docs">${V67DOCS.map(x=>`<button class="siams-v67-doc ${v67DocType===x.k?'active':''}" onclick="SIAMSCourierIdentity.select('${x.k}')"><b>${v67esc(x.n)}</b><small>Document accepté par SIAMS</small></button>`).join('')}</div></div>
  <div class="siams-v67-card"><div class="siams-v67-kicker">ÉTAPE 2 · DOCUMENT</div><h3>Photo ou scan de la pièce</h3><label class="siams-v67-upload">📄<b>Ajouter ${v67esc(v67DocName(v67DocType))}</b><small>Image nette et entièrement visible</small><input type="file" accept="image/*" onchange="SIAMSCourierIdentity.doc(event)"></label><div class="siams-v67-preview" id="siams-v67-doc-preview">${v67Doc?`<img src="${v67Doc}">`:''}</div></div>
  <div class="siams-v67-card"><div class="siams-v67-kicker">ÉTAPE 3 · PHOTO DE VÉRIFICATION</div><h3>Photo du titulaire</h3><label class="siams-v67-upload">🤳<b>Prendre ma photo</b><small>Caméra frontale recommandée</small><input type="file" accept="image/*" capture="user" onchange="SIAMSCourierIdentity.photo(event)"></label><div class="siams-v67-preview" id="siams-v67-photo-preview">${v67Photo?`<img src="${v67Photo}">`:''}</div><button id="siams-v67-submit" class="btn btn-primary btn-block" style="margin-top:11px" onclick="SIAMSCourierIdentity.submit()">Envoyer mon dossier à SIAMS</button></div>`;
 },
 select(k){v67DocType=k;this.render()},
 async doc(e){const f=e.target.files&&e.target.files[0];if(!f)return;v67Doc=await siamsPrepareImageDataURL(f,{maxDim:1600});this.renderPreview('siams-v67-doc-preview',v67Doc)},
 async photo(e){const f=e.target.files&&e.target.files[0];if(!f)return;v67Photo=await siamsPrepareImageDataURL(f,{maxDim:1200});this.renderPreview('siams-v67-photo-preview',v67Photo)},
 renderPreview(id,u){const x=document.getElementById(id);if(x)x.innerHTML=`<img src="${u}">`},
 async submit(){
  if(!v67Doc||!v67Photo)return Toast.show('Ajoutez la pièce et votre photo de vérification.');
  const sess=v67CourierSession();if(!sess)return Router.go('courier-login');
  const b=document.getElementById('siams-v67-submit');if(b){b.disabled=true;b.textContent='Envoi en cours…'}
  try{
   const docUrl=await Cloud.ensureStoredUrl(v67Doc,'verification-docs');
   const photoUrl=await Cloud.ensureStoredUrl(v67Photo,'verification-photos');
   const {error}=await sb.rpc('courier_submit_identity_verification_v67',{p_session_token:sess.session_token,p_doc_type:v67DocType,p_doc_url:docUrl,p_photo_url:photoUrl});
   if(error)throw error;
   v67Doc=null;v67Photo=null;Toast.show('Dossier envoyé à SIAMS ✓');this.load();
  }catch(e){console.error(e);Toast.show('Impossible d’envoyer le dossier. Exécutez le SQL V67.');if(b){b.disabled=false;b.textContent='Envoyer mon dossier à SIAMS'}}
 }
};
/* CORRECTIF : cet écran faisait doublon avec le formulaire d'identification déjà intégré
   directement dans l'onglet "Profil" du livreur (section VÉRIFICATION / Documents, géré
   par CourierIdentity ci-dessous). On garde la route pour éviter tout lien mort, mais elle
   redirige simplement vers le profil où se trouve désormais le seul formulaire. */
Views['courier-identification']=function(){ Router.go('courier-dashboard'); setTimeout(()=>{ try{CourierApp.setTab('profil');}catch(e){} },0); return ''; };

const oldCourierExtrasV67=window.loadCourierProfileExtras;
window.loadCourierProfileExtras=function(){
 if(oldCourierExtrasV67)oldCourierExtrasV67();
};

/* ---------- Codes promo : persistance immédiate dans la table EXISTANTE "promos". ---------- */
async function v67PersistPromo(p){
 const sid=Cloud.storeId||(Store.store&&Store.store.id);if(!sid)throw new Error('Boutique non identifiée');
 const row={id:p.id,store_id:sid,code:p.code,type:p.type,value:p.value,active:p.active!==false,max_uses:Number(p.maxUses||0),used_count:Number(p.usedCount||0)};
 const {error}=await sb.from('promos').upsert(row,{onConflict:'id'});if(error)throw error;
}
async function v67LoadPromos(){
 try{
  const sid=Cloud.storeId||(Store.store&&Store.store.id);if(!sid)return;
  const {data,error}=await sb.from('promos').select('id,code,type,value,active,max_uses,used_count,created_at').eq('store_id',sid).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  const fresh=(data||[]).map(p=>({id:p.id,code:p.code,type:p.type,value:Number(p.value||0),active:p.active!==false,maxUses:Number(p.max_uses||0),usedCount:Number(p.used_count||0),createdAt:new Date(p.created_at||Date.now()).getTime()}));
  /* CORRECTIF : on met à jour uniquement le cache local d'affichage (comme pour _cache.orders
     ailleurs dans le fichier), sans repasser par le setter Store.promos. Ce setter compare
     l'ancienne et la nouvelle liste pour resynchroniser Supabase et supprimait par erreur les
     codes tout juste créés lorsque cette relecture arrivait avant la confirmation de l'écriture
     — c'était la cause du bug "le code promo disparaît après fermeture/réouverture". */
  _cache.promos=fresh;
  PromoLocal.save(fresh);
 }catch(e){console.warn('V67 chargement promos',e)}
}
const v67OriginalPromoCreate=window.v15AddPromo;
if(v67OriginalPromoCreate){
 window.v15AddPromo=async function(){
  await v67LoadPromos();
  return v67OriginalPromoCreate.apply(this,arguments);
 };
}
/* Capture la création par les fonctions déjà présentes : après toute navigation vers promos,
   on relit Supabase. */
const v67PromoView=Views.promos;
Views.promos=function(){const h=v67PromoView();setTimeout(v67LoadPromos,0);return h};
const v67OldAfterPromo=Views._after_promos;
Views._after_promos=async function(){if(v67OldAfterPromo)await v67OldAfterPromo();await v67LoadPromos();if(Router.current==='promos')AutoSync.renderCurrent()};

/* Réécrit les actions globales de promo lorsqu'elles existent pour garantir l'upsert. */
function v67WrapPromo(fnName,action){
 const old=window[fnName];if(!old)return;
 window[fnName]=async function(id){
  const before=(Store.promos||[]).find(p=>String(p.id)===String(id));
  const r=await old.apply(this,arguments);
  const after=(Store.promos||[]).find(p=>String(p.id)===String(id));
  if(action==='delete'&&!after){try{await sb.from('promos').delete().eq('id',id).eq('store_id',Cloud.storeId)}catch(e){}}
  else if(after){try{await v67PersistPromo(after)}catch(e){console.warn('Promo persist',e);}}
  return r;
 };
}
setTimeout(()=>{['v15TogglePromo','v20TogglePromo','siamsTogglePromoV22','v15SetPromoLimit','v20SaveLimit','siamsLimitPromoV22'].forEach(n=>v67WrapPromo(n,'update'));['v15DeletePromo','v20ConfirmDeletePromo','siamsDeletePromoV22'].forEach(n=>v67WrapPromo(n,'delete'));},0);

/* ---------- Espace marchand : promotion d'articles dans la banderole existante ---------- */
let v67AdLink='';
window.SIAMSPromoBanners={
 async load(){try{await SIAMSBanners.all()}catch(e){}},
 render(){
  const root=document.getElementById('siams-v67-promo-banner-root');if(!root)return;
  const products=Store.products||[],ads=(SIAMSBanners.items||[]).filter(x=>x.promo_product===true);
  root.innerHTML=`<div class="siams-v67-card"><div class="siams-v67-kicker">MARKETING · BANDEROLE CLIENT</div><h3>Promouvoir un article</h3><p>Créez une affiche liée à un produit. Elle sera ajoutée au carrousel déjà visible en haut de l'espace client.</p><div class="siams-v67-ad-grid"><div><label style="font-size:9px;font-weight:800">ARTICLE</label><select id="siams-v67-ad-product"><option value="">Choisir un article</option>${products.map(p=>`<option value="${v67esc(p.id)}">${v67esc(p.name)} · ${Utils.fmtFCFA(Number(p.price)||0)}</option>`).join('')}</select></div><div><label style="font-size:9px;font-weight:800">TITRE</label><input id="siams-v67-ad-title" maxlength="60" placeholder="Ex. Offre spéciale"></div><div class="siams-v67-full"><label style="font-size:9px;font-weight:800">SOUS-TITRE</label><input id="siams-v67-ad-sub" maxlength="90" placeholder="Profitez de cette offre"></div></div><label class="siams-v67-upload">🖼️<b>Ajouter l'affiche</b><small>Format recommandé 16:7 · 5 Mo maximum</small><input type="file" accept="image/*" onchange="SIAMSPromoBanners.file(event)"></label><div id="siams-v67-ad-preview" class="siams-v67-ad-preview"></div><button class="btn btn-primary btn-block" style="margin-top:10px" onclick="SIAMSPromoBanners.publish()">Publier dans la banderole client</button></div>
  <div class="siams-v67-card"><div class="siams-v67-kicker">VOS PROMOTIONS</div><h3>Affiches publiées</h3>${ads.length?ads.map(x=>`<div style="border:1px solid var(--line);border-radius:13px;overflow:hidden;margin-top:9px"><img src="${v67esc(x.image_url)}" style="width:100%;aspect-ratio:16/7;object-fit:cover;display:block"><div style="padding:9px;font-size:10px"><b>${v67esc(x.promo_title||'Promotion')}</b><div style="color:var(--text-mid);margin-top:3px">${x.active===false?'Masquée':'Visible'} · ${x.link_product_id?'Article lié':'Sans lien'}</div><div style="display:flex;gap:6px;margin-top:7px"><button class="btn btn-outline btn-sm" onclick="SIAMSPromoBanners.toggle('${v67esc(x.id)}')">${x.active===false?'Afficher':'Masquer'}</button><button class="btn btn-ghost btn-sm" onclick="SIAMSPromoBanners.remove('${v67esc(x.id)}')">Supprimer</button></div></div></div>`).join(''):'<div style="padding:18px;text-align:center;color:var(--text-mid);font-size:10px">Aucune affiche promotionnelle.</div>'}</div>`;
 },
 file(e){const f=e.target.files&&e.target.files[0];if(!f)return;v67AdFile=f;const p=document.getElementById('siams-v67-ad-preview');if(p)p.innerHTML=`<img src="${URL.createObjectURL(f)}">`},
 async publish(){
  const product=document.getElementById('siams-v67-ad-product')?.value;if(!product)return Toast.show('Choisissez un article');
  if(!v67AdFile)return Toast.show('Ajoutez une affiche');
  const title=(document.getElementById('siams-v67-ad-title')?.value||'').trim()||'Promotion';
  const sub=(document.getElementById('siams-v67-ad-sub')?.value||'').trim();
  try{
   const image=await SIAMSBanners.upload(v67AdFile);
   const items=SIAMSBanners.items||[],pos=items.reduce((m,x)=>Math.max(m,Number(x.position||0)),0)+10;
   await SIAMSBanners.create({id:Utils.uid(),image_url:image,link_type:'product',link_product_id:product,active:true,position:pos,promo_product:true,promo_title:title,promo_subtitle:sub});
   v67AdFile=null;Toast.show('Promotion publiée ✓');await this.load();this.render();
  }catch(e){console.error(e);Toast.show('Impossible de publier. Vérifiez le stockage et le SQL V67.')}
 },
 async toggle(id){const x=(SIAMSBanners.items||[]).find(a=>String(a.id)===String(id));if(!x)return;try{await SIAMSBanners.update(id,{active:x.active===false});Toast.show('Affiche mise à jour ✓');this.load().then(()=>this.render())}catch(e){Toast.show('Impossible de modifier l’affiche')}},
 async remove(id){if(!confirm('Supprimer cette affiche ?'))return;try{await SIAMSBanners.remove(id);Toast.show('Affiche supprimée ✓');this.load().then(()=>this.render())}catch(e){Toast.show('Impossible de supprimer l’affiche')}}
};
Views['product-promotions']=function(){return `${TopBar('Promotions articles','Banderole client')}<div style="padding-bottom:100px"><div id="siams-v67-promo-banner-root">Chargement…</div></div>`};
Views._after_product_promotions=async function(){await SIAMSPromoBanners.load();SIAMSPromoBanners.render()};

/* Ajoute le raccourci dans le Centre boutique sans toucher au reste de l'interface. */
const v67OldBoutique=Views.boutique;
if(v67OldBoutique){
 Views.boutique=function(){
  let h=v67OldBoutique();
  if(!h.includes("Router.go('product-promotions')")){
   const marker=`<button class="v14-action" onclick="Router.go('banners')"><strong>🖼️ Bannières</strong><small>Carrousel en haut de la boutique</small></button>`;
   if(h.includes(marker))h=h.replace(marker,marker+`<button class="v14-action" onclick="Router.go('product-promotions')"><strong>🔥 Promotions articles</strong><small>Affiches dans la banderole client</small></button>`);
  }
  return h;
 };
}

/* Admin : lecture/validation des nouveaux dossiers livreurs. */
window.SIAMSAdminCourierIdentityV67={
 async load(){
  const root=document.getElementById('siams-v67-admin-courier-root');if(!root)return;
  let rows=[];
  try{const {data,error}=await sb.from('couriers').select('id,name,phone,identity_status,identity_doc_type,identity_doc_url,identity_photo_url,identity_submitted_at,identity_reject_reason').eq('identity_status','pending').order('identity_submitted_at',{ascending:true}).limit(100);if(error)throw error;rows=data||[]}catch(e){console.error(e)}
  if(!rows.length){root.innerHTML='<div style="padding:30px;text-align:center;color:var(--text-mid)">✓ Aucun dossier livreur en attente.</div>';return}
  root.innerHTML=rows.map(r=>`<article class="siams-v67-card"><div class="siams-v67-kicker">LIVREUR</div><h3>${v67esc(r.name||'Livreur')}</h3><p>${v67esc(r.phone||'')} · ${v67esc(v67DocName(r.identity_doc_type))}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${r.identity_doc_url?`<a href="${v67esc(r.identity_doc_url)}" target="_blank"><img src="${v67esc(r.identity_doc_url)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:11px"></a>`:''}${r.identity_photo_url?`<a href="${v67esc(r.identity_photo_url)}" target="_blank"><img src="${v67esc(r.identity_photo_url)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:11px"></a>`:''}</div><div style="display:flex;gap:7px;margin-top:10px"><button class="btn btn-primary" style="flex:1" onclick="SIAMSAdminCourierIdentityV67.review('${v67esc(r.id)}','verified')">✓ Approuver · Badge vert</button><button class="btn btn-outline" style="flex:1" onclick="SIAMSAdminCourierIdentityV67.review('${v67esc(r.id)}','rejected')">Refuser</button></div></article>`).join('');
 },
 async review(id,status){
  let reason=null;if(status==='rejected'){reason=prompt('Motif du refus :','Document illisible ou non conforme. Merci de renvoyer une pièce nette.');if(reason===null)return}
  try{
   const patch={identity_status:status,identity_reject_reason:status==='rejected'?reason:null,identity_verified_at:status==='verified'?new Date().toISOString():null};
   const {error}=await sb.from('couriers').update(patch).eq('id',id);if(error)throw error;
   Toast.show(status==='verified'?'Livreur certifié ✓ Badge vert activé':'Dossier refusé');this.load();
  }catch(e){console.error(e);Toast.show('Erreur de validation. Vérifiez le SQL V67.')}
 }
};
/* CORRECTIF : cet écran et son bouton dashboard faisaient doublon avec l'espace unifié
   "Vérifications d'identité" (Marchands + Livreurs) ajouté plus loin dans le fichier.
   On garde la route pour éviter tout lien mort, mais elle redirige vers l'écran unifié
   au lieu d'afficher un deuxième bouton/écran équivalent sur le dashboard admin. */
Views['siams-admin-courier-identity-v67']=function(){ Router.go('siams-admin-identity-verifications'); return ''; };
})();
