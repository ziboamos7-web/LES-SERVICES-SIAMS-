(function(){
  'use strict';
  const TABLE='store_showcase_items';
  const BUCKET='siams-showcase';
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
  const uid=()=>Utils.uid();
  const getSid=()=>Cloud.storeId || (Store.store&&Store.store.id) || null;
  const localKey=()=> 'siams_showcase_'+((Store.store&&Store.store.slug)||'default');
  const localLoad=()=>{try{return JSON.parse(localStorage.getItem(localKey())||'[]')}catch(e){return[]}};
  const localSave=a=>{try{localStorage.setItem(localKey(),JSON.stringify(a.slice(0,30)))}catch(e){}};
  const typeLabel=t=>t==='video'?'Vidéo':t==='partnership'?'Partenariat':'Annonce';
  const Showcase={
    items:[], loading:false,
    async load(){
      const sid=getSid(); if(!sid){this.items=localLoad();return this.items;}
      this.loading=true; let remote=[];
      try{const {data,error}=await sb.from(TABLE).select('*').eq('store_id',sid).eq('active',true).order('position',{ascending:true}).order('created_at',{ascending:false}).limit(20);if(!error)remote=data||[];}catch(e){console.warn('Showcase load',e)}
      const local=localLoad(); const map=new Map([...remote,...local].map(x=>[x.id,x]));
      this.items=[...map.values()].filter(x=>x.active!==false).sort((a,b)=>(Number(a.position||0)-Number(b.position||0)) || (new Date(b.created_at||0)-new Date(a.created_at||0)));
      return this.items;
    },
    async all(){
      const sid=getSid(); if(!sid)return localLoad();
      try{const {data,error}=await sb.from(TABLE).select('*').eq('store_id',sid).order('position',{ascending:true}).order('created_at',{ascending:false}).limit(50);if(!error){this.items=data||[];return this.items;}}catch(e){}
      return localLoad();
    },
    async upload(file){
      if(!file)throw new Error('Fichier manquant');
      const isVideo=file.type.startsWith('video/');
      let ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(!isVideo && file.type && file.type.startsWith('image/')){
        const compressed = await siamsCompressImageFile(file);
        if(compressed && compressed.size && compressed.size < file.size){ file = compressed; ext='jpg'; }
      }
      const max=isVideo?25*1024*1024:5*1024*1024;
      if(file.size>max)throw new Error(isVideo?'Vidéo trop volumineuse (25 Mo maximum).':'Photo trop volumineuse (5 Mo maximum).');
      const sid=getSid(); if(!sid)throw new Error('Boutique non identifiée');
      const path=sid+'/'+Date.now()+'-'+uid().replace(/-/g,'')+'.'+ext;
      const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||undefined,cacheControl:'31536000'});
      if(error)throw error;
      const {data}=sb.storage.from(BUCKET).getPublicUrl(path);
      if(!data?.publicUrl)throw new Error('URL publique indisponible');
      return data.publicUrl;
    },
    async create(item){
      const sid=getSid(); if(!sid)throw new Error('Boutique non identifiée');
      const row={id:item.id||uid(),store_id:sid,type:item.type||'announcement',title:item.title||'',description:item.description||'',media_url:item.media_url||null,link_url:item.link_url||null,active:item.active!==false,position:Number(item.position||0)};
      try{const {data,error}=await sb.from(TABLE).insert(row).select().single();if(error)throw error;this.items.unshift(data||row);localSave(this.items);return data||row;}catch(e){
        localSave([row,...this.items]);
        throw e;
      }
    },
    async update(id,patch){
      const idx=this.items.findIndex(x=>x.id===id); if(idx>=0)this.items[idx]={...this.items[idx],...patch};
      try{const {error}=await sb.from(TABLE).update(patch).eq('id',id);if(error)throw error;}catch(e){localSave(this.items);throw e}
      localSave(this.items);return true;
    },
    async remove(id){
      try{const {error}=await sb.from(TABLE).delete().eq('id',id);if(error)throw error;}catch(e){localSave(this.items.filter(x=>x.id!==id));throw e}
      this.items=this.items.filter(x=>x.id!==id);localSave(this.items);return true;
    }
  };
  window.SIAMSShowcase=Showcase;

  function mediaHtml(item,admin){
    const isVideo=item.type==='video'||String(item.media_url||'').match(/\.(mp4|webm|mov|m4v)(\?|$)/i);
    if(!item.media_url)return `<div style="height:150px;display:grid;place-items:center;background:var(--indigo-tint);color:var(--indigo);font-size:34px;">${item.type==='partnership'?'🤝':'📢'}</div>`;
    return isVideo?`<video class="${admin?'v54-list-media':'siams-showcase-media'}" src="${esc(item.media_url)}" ${admin?'controls':''} muted playsinline preload="metadata"></video>`:`<img class="${admin?'v54-list-media':'siams-showcase-media'}" src="${esc(item.media_url)}" loading="lazy" alt="${esc(item.title||'Annonce')}">`;
  }
  function clientMarkup(items){
    if(!items.length)return '';
    return `<section class="siams-showcase" aria-label="Actualités et partenariats"><div class="siams-showcase-head"><h3>À la une</h3><span>Actualités · Partenariats</span></div><div class="siams-showcase-row">${items.map(x=>`<article class="siams-showcase-card" onclick="SIAMSShowcase.openItem('${esc(x.id)}')">${mediaHtml(x,false)}<div class="siams-showcase-shade"></div>${x.type==='video'?'<div class="siams-showcase-play">▶</div>':''}<div class="siams-showcase-content"><span class="siams-showcase-tag">${typeLabel(x.type)}</span><h4>${esc(x.title||'Nouvelle annonce')}</h4>${x.description?`<p>${esc(x.description)}</p>`:''}</div></article>`).join('')}</div></section>`;
  }
  Showcase.renderClient=async function(){const root=document.getElementById('siams-cournsel-client');if(!root)return;await Showcase.load();root.innerHTML=clientMarkup(Showcase.items);};
  Showcase.openItem=async function(id){
    const x=Showcase.items.find(i=>String(i.id)===String(id));if(!x)return;
    const old=document.getElementById('v54-showcase-detail');if(old)old.remove();
    const isVideo=x.type==='video';
    const html=`<div id="v54-showcase-detail" class="shop-sheet-overlay show" onclick="this.remove()"><div class="shop-sheet show" style="max-height:88vh" onclick="event.stopPropagation()"><div class="sheet-handle"></div>${isVideo?`<video src="${esc(x.media_url||'')}" controls autoplay playsinline style="width:100%;max-height:48vh;border-radius:14px;background:#000;object-fit:contain"></video>`:x.media_url?`<img src="${esc(x.media_url)}" style="width:100%;max-height:48vh;object-fit:cover;border-radius:14px;">`:''}<div style="font-size:10px;color:var(--indigo);font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-top:12px">${typeLabel(x.type)}</div><h3 style="margin:5px 0 0">${esc(x.title||'Annonce')}</h3>${x.description?`<p style="font-size:12.5px;color:var(--text-mid);line-height:1.5">${esc(x.description)}</p>`:''}${x.link_url?`<button class="btn btn-primary btn-block" onclick="window.open('${esc(x.link_url)}','_blank','noopener,noreferrer')">En savoir plus</button>`:''}<button class="btn btn-ghost btn-block" onclick="this.closest('#v54-showcase-detail').remove()">Fermer</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
  };

  /* Ajoute le Cournsel à l'accueil client sans déplacer la bannière existante. */
  const oldShop=Views.shop;
  Views.shop=function(){let h=oldShop();const marker='<div class="search-wrap"';if(!h.includes(marker))return h;return h.replace(marker,'<div id="siams-cournsel-client"></div>'+marker);};
  const oldAfterShop=Views._after_shop;
  Views._after_shop=async function(opts){if(oldAfterShop)await oldAfterShop(opts);try{await Showcase.renderClient();}catch(e){console.warn('Cournsel client',e)}};

  /* Gestionnaire marchand */
  let formState={type:'announcement',file:null,url:'',title:'',description:'',link:''};
  function formHtml(){
    return `<div class="v54-form"><div style="font-size:13px;font-weight:850;margin-bottom:10px">Ajouter au Cournsel client</div><div class="v54-type-grid"><button class="v54-type ${formState.type==='announcement'?'active':''}" onclick="setShowcaseType('announcement')">📢 Annonce</button><button class="v54-type ${formState.type==='partnership'?'active':''}" onclick="setShowcaseType('partnership')">🤝 Partenariat</button><button class="v54-type ${formState.type==='video'?'active':''}" onclick="setShowcaseType('video')">▶ Vidéo</button></div><div class="field" style="margin-top:11px"><label>Titre</label><input id="v54-title" maxlength="80" placeholder="Ex. Nouveau partenariat SIAMS" value="${esc(formState.title)}"></div><div class="field"><label>Description courte</label><textarea id="v54-desc" rows="3" maxlength="220" placeholder="Quelques mots pour informer vos clients...">${esc(formState.description)}</textarea></div><div class="v54-upload" onclick="document.getElementById('v54-file').click()"><input id="v54-file" class="hidden" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" onchange="previewShowcaseFile(event)"><strong>＋ Ajouter une photo ou une vidéo</strong><small>Photo : 5 Mo max · Vidéo : 25 Mo max</small><div id="v54-file-name" style="font-size:10px;color:var(--indigo);margin-top:6px"></div></div><div id="v54-preview" class="v54-preview"></div><div class="field" style="margin-top:10px"><label>Lien (facultatif)</label><input id="v54-link" type="url" placeholder="https://..." value="${esc(formState.link)}"><small style="font-size:10px;color:var(--text-soft)">Le client pourra appuyer sur « En savoir plus ».</small></div><button class="btn btn-primary btn-block" style="margin-top:8px" onclick="publishShowcaseItem()">Publier sur la vitrine client</button></div>`;
  }
  function renderManager(){
    const root=document.getElementById('v54-showcase-manager');if(!root)return;
    const cards=Showcase.items.length ? Showcase.items.map(function(x){
      return `<article class="v54-list-card"><div style="position:relative">${mediaHtml(x,true)}<span style="position:absolute;left:10px;top:10px;background:rgba(5,25,48,.75);color:#fff;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850">${typeLabel(x.type)}</span></div><div class="v54-list-body"><h4>${esc(x.title||'Sans titre')}</h4>${x.description?`<p>${esc(x.description)}</p>`:''}<div class="v54-list-actions"><button class="btn btn-outline btn-sm" onclick="toggleShowcaseItem('${esc(x.id)}')">${x.active===false?'Afficher':'Masquer'}</button><button class="btn btn-ghost btn-sm" onclick="deleteShowcaseItem('${esc(x.id)}')">Supprimer</button></div></div></article>`;
    }).join('') : `<div style="margin:0 20px 100px">${EmptyState(ICONS.box,'Aucun contenu','Ajoutez une annonce, une photo ou une vidéo : elle apparaîtra automatiquement dans le Cournsel client.')}</div>`;
    root.innerHTML=formHtml()+`<div class="v54-count">${Showcase.items.filter(x=>x.active!==false).length} contenu(s) visible(s) actuellement sur la vitrine client.</div>${cards}`;
  }
  async function openManager(){
    const root=document.getElementById('v54-showcase-manager');if(!root)return;root.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-mid)">Chargement…</div>';await Showcase.all();renderManager();
  }
  window.setShowcaseType=t=>{formState.type=t;renderManager();};
  window.previewShowcaseFile=e=>{const f=e.target.files?.[0];if(!f)return;formState.file=f;const p=document.getElementById('v54-preview'),n=document.getElementById('v54-file-name');if(n)n.textContent=f.name;const u=URL.createObjectURL(f);if(p){p.style.display='block';p.innerHTML=f.type.startsWith('video/')?`<video src="${u}" controls muted playsinline></video>`:`<img src="${u}" alt="Aperçu">`;}};
  window.publishShowcaseItem=async()=>{
    const title=document.getElementById('v54-title')?.value.trim()||'';const description=document.getElementById('v54-desc')?.value.trim()||'';const link=document.getElementById('v54-link')?.value.trim()||'';
    if(!title)return Toast.show('Ajoutez un titre');
    if(!formState.file)return Toast.show('Ajoutez une photo ou une vidéo');
    const btn=document.querySelector('#v54-showcase-manager .btn-primary');if(btn){btn.disabled=true;btn.textContent='Publication…';}
    try{const media=await Showcase.upload(formState.file);await Showcase.create({type:formState.type,title,description,media_url:media,link_url:link,active:true,position:0});Toast.show('Contenu publié sur la vitrine client ✓');formState={type:'announcement',file:null,url:'',title:'',description:'',link:''};await Showcase.all();renderManager();}
    catch(e){console.error(e);Toast.show('Impossible de publier. Vérifiez la configuration du stockage SIAMS.');if(btn){btn.disabled=false;btn.textContent='Publier sur la vitrine client';}}
  };
  window.toggleShowcaseItem=async id=>{const x=Showcase.items.find(i=>String(i.id)===String(id));if(!x)return;try{await Showcase.update(id,{active:x.active===false});Toast.show(x.active===false?'Contenu affiché ✓':'Contenu masqué ✓');renderManager();}catch(e){Toast.show('Impossible de modifier ce contenu');}};
  window.deleteShowcaseItem=async id=>{if(!confirm('Supprimer définitivement ce contenu de la vitrine client ?'))return;try{await Showcase.remove(id);Toast.show('Contenu supprimé ✓');renderManager();}catch(e){Toast.show('Impossible de supprimer ce contenu');}};

  Views['showcase']=function(){return `${TopBar('Cournsel client','Annonces & partenariats')}<div class="v54-admin-head"><h2>Contenus de la vitrine</h2><p>Ajoutez une annonce, une photo ou une vidéo de partenariat. Le contenu publié apparaît automatiquement dans l’accueil du client.</p></div><div id="v54-showcase-manager"><div style="padding:35px;text-align:center;color:var(--text-mid)">Chargement…</div></div>`;};
  const oldDash=Views.dashboard;
  Views.dashboard=function(){return oldDash();};
  const oldAfter=Views._after_showcase;Views._after_showcase=async function(){if(oldAfter)await oldAfter();await openManager();};
  const navKeyAdd=(()=>{try{const orig=Router.go;return orig}catch(e){return null}})();
  /* La route reste volontairement hors navigation principale : accès depuis Dashboard. */
  AutoSync.safeViews.add('showcase');
  
  /* Si le dashboard est reconstruit par un module ultérieur, réinjecte le raccourci au rendu. */
  const originalDashboardQuick=window.dashboardQuickGo;
  if(originalDashboardQuick){ /* aucun remplacement : le raccourci dédié utilise Router.go directement */ }
})();
