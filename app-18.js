(function(){
  const esc=s=>Utils.escapeHtml(String(s??''));
  function categoryImage(name){
    const custom=(Store.categoryPhotos||{})[name];
    if(custom) return custom;
    const p=(Store.products||[]).find(x=>String(x.category||'')===String(name) && (x.photo || (x.photos&&x.photos[0])));
    return p ? (p.photo || p.photos[0]) : '';
  }
  function activePromos(){
    return (Store.promos||[]).map(p=>PromoLocal.merge(p)).filter(p=>p.active!==false && (!p.maxUses || Number(p.usedCount||0)<Number(p.maxUses||0)));
  }
  function buildPromoSlides(){
    const store=Store.store||{}; const promos=activePromos(); const slides=[];
    if(store.banner && promos.length) slides.push(`<article class="v40-promo-slide"><img src="${esc(store.banner)}" alt="Promotion de ${esc(store.name||'la boutique')}"></article>`);
    promos.slice(0,5).forEach(p=>{
      const discount=p.type==='percent' ? `-${p.value}%` : `-${Number(p.value||0).toLocaleString('fr-FR')} FCFA`;
      slides.push(`<article class="v40-promo-slide" style="background:linear-gradient(135deg,var(--indigo),#5b6fe8);"><div class="v40-promo-copy"><span class="tag">${esc(p.type==='percent'?'Réduction':'Offre spéciale')}</span><b>${discount}</b><span>Code <strong>${esc(p.code)}</strong> · offre proposée par la boutique</span></div></article>`);
    });
    return slides;
  }
  window.startV40Carousel=function(){
    const root=document.getElementById('v40-promo-carousel'), track=document.getElementById('v40-promo-track'); if(!root||!track)return;
    const n=track.children.length;if(n<1)return; root.style.display='block';
    const dots=document.getElementById('v40-promo-dots'); let i=0;
    const render=()=>{track.style.transform=`translateX(-${i*100}%)`;[...dots.children].forEach((d,j)=>d.classList.toggle('active',j===i));};
    window.v40PromoTimer&&clearInterval(window.v40PromoTimer); render();
    if(n>1) window.v40PromoTimer=setInterval(()=>{i=(i+1)%n;render();},5000);
    let sx=0; track.ontouchstart=e=>{sx=e.touches[0].clientX}; track.ontouchend=e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){i=(i+(dx<0?1:-1)+n)%n;render();}};
  };

  Views.shop=function(){
    const store=Store.store||{}, products=Store.products||[];
    const access=Store.access(), paidVerified=isPaidSubscriptionActive();
    const badgeChip=paidVerified?VerifiedBadge(16,access.plan):'';
    const cats=Store.categories||[];
    const slides=buildPromoSlides();
    return `<div class="topbar" style="padding-top:18px;">
      <div style="display:flex;align-items:center;gap:12px;min-width:0;">
        ${store.photo?`<div class="store-logo" style="width:40px;height:40px;border-radius:11px;flex:none;overflow:hidden;"><img src="${esc(store.photo)}" style="width:100%;height:100%;object-fit:cover;"></div>`:''}
        <div style="min-width:0"><h1 style="font-size:20px;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(store.name||'Boutique')}${badgeChip}</h1><div class="page-sub">Boutique en ligne</div></div>
      </div>
      <button class="cn-notif-btn" onclick="ClientNotify.openPanel()" aria-label="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="cn-notif-dot" id="cn-notif-dot"></span></button>
    </div>
    <div class="search-wrap" style="padding-top:14px;"><div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="home-search" type="text" placeholder="Rechercher un produit..." oninput="renderHomeGrid()"></div></div>
    ${slides.length?`<div class="v40-promo-carousel" id="v40-promo-carousel"><div class="v40-promo-track" id="v40-promo-track">${slides.join('')}</div><div class="v40-promo-dots" id="v40-promo-dots">${slides.map((_,i)=>`<span class="v40-promo-dot ${i===0?'active':''}"></span>`).join('')}</div></div>`:''}
    ${cats.length?`<div class="home-section-row"><h3>Catégories</h3><button class="link-btn" onclick="Router.go('shop-categories')">Voir tout ›</button></div><div class="v40-category-row">${cats.slice(0,10).map(c=>{const im=categoryImage(c);return `<div class="v40-category-item" onclick="Router.go('shop-categories',{cat:decodeURIComponent('${encodeURIComponent(c)}')})"><div class="v40-category-img">${im?`<img src="${esc(im)}" alt="${esc(c)}">`:`<span style="font-size:22px;color:var(--text-soft);">▦</span>`}</div><span>${esc(c)}</span></div>`}).join('')}</div>`:''}
    <div class="home-section-row"><h3 id="home-grid-title">Nouveautés</h3><button class="link-btn" onclick="Router.go('shop-categories')">Voir tout ›</button></div>
    <div id="home-empty" class="hidden">${EmptyState(ICONS.box,'Boutique vide',"Cette boutique n'a pas encore de produits.")}</div><div id="home-grid" class="home-grid"></div>
    <div class="fab hidden" id="cart-bar" style="left:20px;right:20px;bottom:24px;max-width:440px;"><button class="btn btn-mango btn-block" onclick="Router.go('cart')" style="justify-content:space-between;"><span style="display:flex;align-items:center;gap:8px;">${ICONS.cart.replace('30','18').replace('30','18')} Voir le panier</span><span id="cart-bar-amount"></span></button></div>`;
  };
  const oldAfterShop=Views._after_shop;
  Views._after_shop=function(){ if(oldAfterShop)oldAfterShop(); startV40Carousel(); };

  Views['shop-categories']=function(opts){
    opts=opts||{}; const selected=(!opts.cat||opts.cat==='__all__')?'':opts.cat; const cats=Store.categories||[];
    return `<div class="v40-cat-page-head"><div class="eyebrow">Explorer la boutique</div><h1>Catégories</h1><p>Des produits classés simplement, avec les vraies photos de la boutique.</p></div>
      <div class="v40-cat-search"><div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="shop-search" type="text" placeholder="Rechercher un produit..." oninput="renderShopGrid()"></div></div>
      ${cats.length?`<div class="v40-cat-chips"><button class="v40-cat-chip ${!selected?'active':''}" onclick="setShopCatFilter('')">Tous</button>${cats.map(c=>`<button class="v40-cat-chip ${c===selected?'active':''}" onclick="setShopCatFilter(decodeURIComponent('${encodeURIComponent(c)}'))">${esc(c)}</button>`).join('')}</div>`:''}
      <div class="shop-result-row"><span class="count" id="shop-result-count"></span><button class="fav-toggle" id="shop-fav-toggle" onclick="toggleShopFavOnly()">♡ Favoris</button></div>
      <div class="shop-layout"><div class="shop-cat-main" style="width:100%;"><div id="shop-empty" class="hidden">${EmptyState(ICONS.box,'Boutique vide',"Cette boutique n'a pas encore de produits.")}</div><div id="shop-grid" class="shop-grid"></div></div></div>
      <div class="fab hidden" id="cart-bar" style="left:20px;right:20px;bottom:24px;max-width:440px;"><button class="btn btn-mango btn-block" onclick="Router.go('cart')" style="justify-content:space-between;"><span style="display:flex;align-items:center;gap:8px;">${ICONS.cart.replace('30','18').replace('30','18')} Voir le panier</span><span id="cart-bar-amount"></span></button></div>`;
  };
  const oldAfterCats=Views._after_shop_categories;
  Views._after_shop_categories=function(opts){ if(oldAfterCats)oldAfterCats(opts); else { Wishlist.load();shopCatFilter=(!opts||!opts.cat||opts.cat==='__all__')?'':opts.cat;renderShopGrid(); } };

  // Photo client : ajout au même profil local que les autres informations.
  const oldEditor=window.openAccountProfileEditor;
  window.openAccountProfileEditor=function(){
    if(!ClientLocal.load) return oldEditor();
    ClientLocal.load(); const p=ClientLocal.profile||{};
    oldEditor();
    const wrap=document.getElementById('acc-edit-wrap'); if(!wrap)return;
    const host=wrap.querySelector('.shop-sheet'); if(!host)return;
    const first=host.querySelector('h3');
    const photo= document.createElement('div'); photo.innerHTML=`<div class="v40-client-profile-photo" id="v40-client-photo-preview">${p.photo?`<img src="${esc(p.photo)}" alt="Photo de profil">`:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" style="color:var(--text-soft)"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20c.9-4 3.7-6.2 7.5-6.2s6.6 2.2 7.5 6.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`}</div><div class="v40-client-photo-btn"><button type="button" onclick="document.getElementById('v40-client-photo-input').click()">📷 ${p.photo?'Modifier ma photo':'Ajouter ma photo'}</button><input id="v40-client-photo-input" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="window.handleClientProfilePhoto(event)"></div><div class="v40-profile-photo-note">Votre photo est utilisée uniquement pour votre profil client.</div>`;
    host.insertBefore(photo,first?.nextSibling||host.firstChild);
  };
  window.handleClientProfilePhoto=function(e){const f=e.target.files&&e.target.files[0];if(!f)return;siamsPrepareImageDataURL(f).then(dataUrl=>{const img=document.getElementById('v40-client-photo-preview');if(img)img.innerHTML=`<img src="${esc(dataUrl)}" alt="Photo de profil">`;window._v40ClientPhoto=dataUrl;}).catch(()=>Toast.show('Impossible de traiter cette photo'));};
  const oldSave=window.saveAccountProfile;
  window.saveAccountProfile=function(){
    const photo=window._v40ClientPhoto || (ClientLocal.profile&&ClientLocal.profile.photo) || '';
    const oldProfile=ClientLocal.profile||{};
    window._v40ClientPhoto='';
    const name=document.getElementById('acc-name')?.value.trim()||oldProfile.name||'';
    const firstName=document.getElementById('acc-firstname')?.value.trim()||oldProfile.firstName||'';
    const email=document.getElementById('acc-email')?.value.trim()||oldProfile.email||'';
    const phone=document.getElementById('acc-phone')?.value.trim()||oldProfile.phone||'';
    const city=document.getElementById('acc-city')?.value.trim()||oldProfile.city||'';
    const district=document.getElementById('acc-district')?.value.trim()||oldProfile.district||'';
    const address=document.getElementById('acc-address')?.value.trim()||oldProfile.address||'';
    const lat=document.getElementById('acc-lat')?.value||oldProfile.lat||''; const lng=document.getElementById('acc-lng')?.value||oldProfile.lng||''; const mapsUrl=document.getElementById('acc-maps-url')?.value||oldProfile.mapsUrl||'';
    if(!firstName||!name||!phone){Toast.show('Renseignez au minimum le nom, le prénom et le numéro');return;}
    ClientLocal.save({name,firstName,email,phone,city,district,address,lat,lng,mapsUrl,photo});
    document.getElementById('acc-edit-wrap')?.remove(); document.getElementById('acc-edit-wrap__v46_2')?.remove(); Toast.show('Profil enregistré ✓'); Router.go('shop-account');
  };

  // Rendre le code promo du checkout très clairement accessible.
  const oldCheckout=Views.checkout;
  Views.checkout=function(){
    const html=oldCheckout();
    return html.replace(/<div class="field"><label>Code promo \(facultatif\)<\/label>[\s\S]*?<div id="co-promo-msg__v46_2"[^>]*><\/div>\s*<\/div>/,
      `<div class="field"><label>Code promo</label><div style="font-size:11px;color:var(--text-mid);margin:-3px 0 7px;">Ajoutez le code communiqué par la boutique pour profiter d'une réduction.</div><div class="v40-promo-entry"><input id="co-promo__v46_2" type="text" inputmode="text" autocomplete="off" placeholder="Ex : BIENVENUE10"><button type="button" onclick="applyPromoCode()">Appliquer</button></div><div id="co-promo-msg__v46_3" style="font-size:12.5px;margin-top:8px;"></div></div>`);
  };
})();
