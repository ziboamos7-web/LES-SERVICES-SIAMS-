(function(){
  'use strict';
  const TABLE='store_banners';
  const BUCKET='siams-banners';
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
  const uid=()=>Utils.uid();
  const getSid=()=>Cloud.storeId || (Store.store&&Store.store.id) || null;
  const localKey=()=> 'siams_banners_'+((Store.store&&Store.store.slug)||'default');
  const localLoad=()=>{try{return JSON.parse(localStorage.getItem(localKey())||'[]')}catch(e){return[]}};
  const localSave=a=>{try{localStorage.setItem(localKey(),JSON.stringify(a.slice(0,30)))}catch(e){}};

  const Banners={
    items:[], loading:false,
    async load(){
      const sid=getSid(); if(!sid){this.items=localLoad().filter(x=>x.active!==false);return this.items;}
      this.loading=true; let remote=[];
      try{const {data,error}=await sb.from(TABLE).select('*').eq('store_id',sid).eq('active',true).order('position',{ascending:true}).limit(20);if(!error)remote=data||[];}catch(e){console.warn('Banners load',e)}
      const local=localLoad(); const map=new Map([...remote,...local].map(x=>[x.id,x]));
      this.items=[...map.values()].filter(x=>x.active!==false).sort((a,b)=>Number(a.position||0)-Number(b.position||0));
      return this.items;
    },
    async all(){
      const sid=getSid(); if(!sid){this.items=localLoad();return this.items;}
      try{const {data,error}=await sb.from(TABLE).select('*').eq('store_id',sid).order('position',{ascending:true}).limit(50);if(!error){this.items=data||[];return this.items;}}catch(e){}
      this.items=localLoad();return this.items;
    },
    async upload(file){
      if(!file)throw new Error('Fichier manquant');
      let ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(file.type && file.type.startsWith('image/')){
        const compressed = await siamsCompressImageFile(file);
        if(compressed && compressed.size && compressed.size < file.size){ file = compressed; ext='jpg'; }
      }
      const max=5*1024*1024;
      if(file.size>max)throw new Error('Image trop volumineuse (5 Mo maximum).');
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
      const row={id:item.id||uid(),store_id:sid,image_url:item.image_url,link_type:item.link_type||'none',link_url:item.link_url||null,link_product_id:item.link_product_id||null,link_category_id:item.link_category_id||null,active:item.active!==false,position:Number(item.position||0)};
      try{const {data,error}=await sb.from(TABLE).insert(row).select().single();if(error)throw error;this.items.push(data||row);localSave(this.items);return data||row;}catch(e){
        this.items.push(row); localSave(this.items);
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
  window.SIAMSBanners=Banners;

  Banners.openBanner=function(id){
    const x=Banners.items.find(i=>String(i.id)===String(id)); if(!x)return;
    if(x.link_type==='external' && x.link_url){ window.open(x.link_url,'_blank','noopener,noreferrer'); }
    else if(x.link_type==='product' && x.link_product_id){ Router.go('shop-product',{id:x.link_product_id}); }
    else if(x.link_type==='category' && x.link_category_id){
      const cat=(Store.categories||[]).find(c=>String(c.id)===String(x.link_category_id));
      Router.go('shop-categories',{cat:cat?cat.name:''});
    }
  };

  function bannerMarkup(items){
    if(!items.length)return '';
    return `<div class="siams-banner-carousel" id="siams-banner-carousel"><div class="siams-banner-track" id="siams-banner-track">${items.map(x=>`<div class="siams-banner-slide" onclick="SIAMSBanners.openBanner('${esc(x.id)}')"><img src="${esc(x.image_url)}" loading="lazy" alt="Bannière boutique"></div>`).join('')}</div>${items.length>1?`<div class="siams-banner-dots" id="siams-banner-dots">${items.map((_,i)=>`<span class="siams-banner-dot ${i===0?'active':''}"></span>`).join('')}</div>`:''}</div>`;
  }
  Banners.renderClient=async function(){
    const root=document.getElementById('siams-banners-client'); if(!root)return;
    await Banners.load(); root.innerHTML=bannerMarkup(Banners.items);
    startBannerCarousel();
  };
  function startBannerCarousel(){
    const track=document.getElementById('siams-banner-track'); if(!track)return;
    const n=track.children.length; if(n<1)return;
    const dots=document.getElementById('siams-banner-dots'); let i=0;
    const render=()=>{track.style.transform=`translateX(-${i*100}%)`;if(dots)[...dots.children].forEach((d,j)=>d.classList.toggle('active',j===i));};
    window.v56BannerTimer&&clearInterval(window.v56BannerTimer); render();
    if(n>1) window.v56BannerTimer=setInterval(()=>{i=(i+1)%n;render();},5500);
    let sx=0; track.ontouchstart=e=>{sx=e.touches[0].clientX}; track.ontouchend=e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){i=(i+(dx<0?1:-1)+n)%n;render();}};
  }
  const oldShop=Views.shop;
  Views.shop=function(){let h=oldShop();const marker='<div class="search-wrap"';if(!h.includes(marker))return h;return h.replace(marker,'<div id="siams-banners-client"></div>'+marker);};
  const oldAfterShop=Views._after_shop;
  Views._after_shop=async function(opts){if(oldAfterShop)await oldAfterShop(opts);try{await Banners.renderClient();}catch(e){console.warn('Banners client',e)}};

  /* ---------- Gestionnaire marchand ---------- */
  let bannerFormState={file:null,linkType:'none'};
  function linkTypeLabel(x){
    if(x.link_type==='external')return '🔗 Lien externe';
    if(x.link_type==='product')return '🛍️ Vers un produit';
    if(x.link_type==='category')return '▦ Vers une catégorie';
    return 'Sans lien';
  }
  function bannerFormHtml(){
    const products=Store.products||[]; const categories=Store.categories||[];
    return `<div class="v54-form">
      <div style="font-size:13px;font-weight:850;margin-bottom:10px">Ajouter une bannière</div>
      <div class="v54-upload" onclick="document.getElementById('v56-file').click()"><input id="v56-file" class="hidden" type="file" accept="image/png,image/jpeg,image/webp" onchange="previewBannerFile(event)"><strong>＋ Ajouter une image</strong><small>Photo : 5 Mo maximum</small><div id="v56-file-name" style="font-size:10px;color:var(--indigo);margin-top:6px">${bannerFormState.file?esc(bannerFormState.file.name):''}</div></div>
      <div id="v56-preview" class="v54-preview" style="${bannerFormState.file?'display:block':''}"></div>
      <div class="field" style="margin-top:11px"><label>Lien au clic (facultatif)</label>
        <div class="v56-link-type-grid">
          <button class="v54-type ${bannerFormState.linkType==='none'?'active':''}" onclick="setBannerLinkType('none')">Aucun</button>
          <button class="v54-type ${bannerFormState.linkType==='external'?'active':''}" onclick="setBannerLinkType('external')">🔗 Lien externe</button>
          <button class="v54-type ${bannerFormState.linkType==='product'?'active':''}" onclick="setBannerLinkType('product')">🛍️ Produit</button>
          <button class="v54-type ${bannerFormState.linkType==='category'?'active':''}" onclick="setBannerLinkType('category')">▦ Catégorie</button>
        </div>
      </div>
      ${bannerFormState.linkType==='external'?`<div class="field"><label>Lien externe</label><input id="v56-link-url" type="url" placeholder="https://..."></div>`:''}
      ${bannerFormState.linkType==='product'?`<div class="field"><label>Produit</label><select id="v56-link-product"><option value="">Choisir un produit</option>${products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
      ${bannerFormState.linkType==='category'?`<div class="field"><label>Catégorie</label><select id="v56-link-category"><option value="">Choisir une catégorie</option>${categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>`:''}
      <button class="btn btn-primary btn-block" style="margin-top:8px" onclick="publishBannerItem()">Publier la bannière</button>
    </div>`;
  }
  function renderManager(){
    const root=document.getElementById('v56-banners-manager'); if(!root)return;
    const cards=Banners.items.length ? Banners.items.map(function(x,idx){
      return `<article class="v54-list-card"><div style="position:relative">${x.image_url?`<img class="v54-list-media" src="${esc(x.image_url)}" loading="lazy">`:`<div style="height:150px;display:grid;place-items:center;background:var(--indigo-tint);color:var(--indigo);font-size:34px;">🖼️</div>`}<span style="position:absolute;left:10px;top:10px;background:rgba(5,25,48,.75);color:#fff;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850">${x.active===false?'Masquée':'Visible'}</span></div><div class="v54-list-body"><h4>${esc(linkTypeLabel(x))}</h4><div class="v54-list-actions"><button class="btn btn-outline btn-sm" ${idx===0?'disabled':''} onclick="moveBannerUp('${esc(x.id)}')">↑</button><button class="btn btn-outline btn-sm" ${idx===Banners.items.length-1?'disabled':''} onclick="moveBannerDown('${esc(x.id)}')">↓</button><button class="btn btn-outline btn-sm" onclick="toggleBannerItem('${esc(x.id)}')">${x.active===false?'Afficher':'Masquer'}</button><button class="btn btn-ghost btn-sm" onclick="deleteBannerItem('${esc(x.id)}')">Supprimer</button></div></div></article>`;
    }).join('') : `<div style="margin:0 20px 100px">${EmptyState(ICONS.box,'Aucune bannière','Ajoutez une bannière : elle apparaîtra en haut de la boutique, au-dessus de la recherche.')}</div>`;
    root.innerHTML=bannerFormHtml()+`<div class="v54-count">${Banners.items.filter(x=>x.active!==false).length} bannière(s) visible(s) actuellement sur la boutique.</div>${cards}`;
  }
  async function openManager(){
    const root=document.getElementById('v56-banners-manager'); if(!root)return;
    root.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-mid)">Chargement…</div>';
    await Banners.all(); renderManager();
  }
  window.setBannerLinkType=t=>{bannerFormState.linkType=t;renderManager();};
  window.previewBannerFile=e=>{const f=e.target.files?.[0];if(!f)return;bannerFormState.file=f;const p=document.getElementById('v56-preview'),n=document.getElementById('v56-file-name');if(n)n.textContent=f.name;const u=URL.createObjectURL(f);if(p){p.style.display='block';p.innerHTML=`<img src="${u}" alt="Aperçu">`;}};
  window.publishBannerItem=async()=>{
    const linkType=bannerFormState.linkType;
    const linkUrl=document.getElementById('v56-link-url')?.value.trim()||'';
    const linkProductId=document.getElementById('v56-link-product')?.value||'';
    const linkCategoryId=document.getElementById('v56-link-category')?.value||'';
    if(!bannerFormState.file)return Toast.show('Ajoutez une image');
    if(linkType==='external' && !linkUrl)return Toast.show('Ajoutez le lien externe');
    if(linkType==='product' && !linkProductId)return Toast.show('Choisissez un produit');
    if(linkType==='category' && !linkCategoryId)return Toast.show('Choisissez une catégorie');
    const btn=document.querySelector('#v56-banners-manager .btn-primary'); if(btn){btn.disabled=true;btn.textContent='Publication…';}
    try{
      const media=await Banners.upload(bannerFormState.file);
      const maxPos=Banners.items.reduce((m,x)=>Math.max(m,Number(x.position||0)),0);
      await Banners.create({image_url:media,link_type:linkType,link_url:linkType==='external'?linkUrl:null,link_product_id:linkType==='product'?linkProductId:null,link_category_id:linkType==='category'?linkCategoryId:null,active:true,position:maxPos+10});
      Toast.show('Bannière publiée ✓');
      bannerFormState={file:null,linkType:'none'};
      await Banners.all(); renderManager();
    }catch(e){console.error(e);Toast.show('Impossible de publier. Vérifiez la configuration du stockage SIAMS.');if(btn){btn.disabled=false;btn.textContent='Publier la bannière';}}
  };
  window.toggleBannerItem=async id=>{const x=Banners.items.find(i=>String(i.id)===String(id));if(!x)return;try{await Banners.update(id,{active:x.active===false});Toast.show(x.active===false?'Bannière affichée ✓':'Bannière masquée ✓');renderManager();}catch(e){Toast.show('Impossible de modifier cette bannière');}};
  window.deleteBannerItem=async id=>{if(!confirm('Supprimer définitivement cette bannière ?'))return;try{await Banners.remove(id);Toast.show('Bannière supprimée ✓');renderManager();}catch(e){Toast.show('Impossible de supprimer cette bannière');}};
  async function moveBanner(id,dir){
    const items=Banners.items; const idx=items.findIndex(x=>String(x.id)===String(id)); const swapIdx=idx+dir;
    if(idx<0||swapIdx<0||swapIdx>=items.length)return;
    const a=items[idx], b=items[swapIdx];
    const posA=Number(a.position||0), posB=Number(b.position||0);
    try{await Banners.update(a.id,{position:posB});await Banners.update(b.id,{position:posA});}catch(e){Toast.show('Impossible de réordonner');return;}
    items.sort((x,y)=>Number(x.position||0)-Number(y.position||0));
    renderManager();
  }
  window.moveBannerUp=id=>moveBanner(id,-1);
  window.moveBannerDown=id=>moveBanner(id,1);

  Views['banners']=function(){return `${TopBar('Bannières','Vitrine boutique')}<div class="v54-admin-head"><h2>Bannières de la boutique</h2><p>Ajoutez, réordonnez ou masquez les bannières affichées en haut de la boutique, au-dessus de la recherche. Chaque bannière peut pointer vers un lien externe, un produit ou une catégorie.</p></div><div id="v56-banners-manager"><div style="padding:35px;text-align:center;color:var(--text-mid)">Chargement…</div></div>`;};
  const oldAfterBanners=Views._after_banners;
  Views._after_banners=async function(){if(oldAfterBanners)await oldAfterBanners();await openManager();};
  /* La route reste volontairement hors navigation principale : accès depuis le Centre boutique. */
  AutoSync.safeViews.add('banners');
})();
