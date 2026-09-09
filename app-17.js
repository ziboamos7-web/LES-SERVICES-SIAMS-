(function(){
  /* ---------- ID marchand : présentation plus claire et exploitable ---------- */
  const oldAccountId = Views['account-id'];
  Views['account-id'] = function(){
    const id = AccountId.current || '';
    return `
    <div style="min-height:100vh;display:flex;flex-direction:column;padding:28px 22px;">
      <button onclick="Router.go('plus')" style="border:none;background:var(--panel);color:var(--text);width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:18px;">←</button>
      <div class="store-logo" style="width:58px;height:58px;border-radius:17px;margin-bottom:18px;overflow:hidden;"><img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;"></div>
      <div style="font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--indigo);text-transform:uppercase;margin-bottom:5px;">IDENTIFIANT DE CONNEXION</div>
      <h1 style="font-size:25px;line-height:1.15;margin:0 0 8px;">Mon ID marchand SIAMS</h1>
      <p style="color:var(--text-mid);font-size:14px;line-height:1.55;margin:0 0 20px;">Cet identifiant vous permet de vous connecter rapidement à votre espace marchand. Gardez-le confidentiel.</p>
      <div class="v39-id-card">
        <div class="v39-id-top"><div class="v39-id-label">ID MARCHAND SIAMS</div><span class="v39-id-status">✓ Identifiant actif</span></div>
        <div class="v39-id-value">${Utils.escapeHtml(id || '—')}</div>
        <div class="v39-id-help">Vous pouvez saisir cet ID à la place de votre e-mail sur l'écran de connexion.</div>
        <div class="v39-id-actions">
          <button class="btn btn-primary" onclick="AccountId.copy()">Copier l’ID</button>
          <button class="btn btn-outline" onclick="AccountId.save()">Enregistrer la carte</button>
        </div>
      </div>
      <div class="v39-settings-section">
        <div class="v39-settings-head"><div class="v39-settings-icon">🔐</div><div><b>Conseil de sécurité</b><span>Ne partagez pas votre identifiant avec une personne non autorisée.</span></div></div>
        <div style="font-size:11.5px;line-height:1.5;color:var(--text-mid);">En cas d’oubli, utilisez « ID marchand oublié ? » depuis l’écran de connexion pour demander sa récupération.</div>
      </div>
      <div style="margin-top:auto;padding-top:16px;"><button class="btn btn-primary btn-block" onclick="AccountId.continueToApp()">Continuer vers mon tableau de bord</button></div>
    </div>`;
  };

  /* ---------- Paramètres : séparation nette Préférences générales / Sécurité ---------- */
  Views.settings = function(){
    const s=Store.store||{};
    return `${TopBar('Paramètres','Préférences générales et sécurité')}
      <div style="padding:14px 20px 90px;">
        <section class="v39-settings-section">
          <div class="v39-settings-head"><div class="v39-settings-icon">⚙️</div><div><b>Préférences générales</b><span>Personnalisez le fonctionnement de votre espace SIAMS.</span></div></div>
          
          
          <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="Router.go('store-edit')">Informations de la boutique</button>
        </section>
        <section class="v39-settings-section">
          <div class="v39-settings-head"><div class="v39-settings-icon">🎨</div><div><b>Thème de l'application</b><span>S'applique aux boutons d'action et à la carte du tableau de bord.</span></div></div>
          <div style="display:flex;gap:10px;">
            <button type="button" onclick="setUiTheme('blue')" style="flex:1;padding:12px;border-radius:14px;border:2px solid ${Store.uiTheme!=='black'?'var(--blue)':'var(--line)'};background:#fff;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;">
              <span style="width:100%;height:34px;border-radius:9px;background:linear-gradient(135deg,#0091FD,#00B4FD);"></span>
              <span style="font-size:12.5px;font-weight:800;color:var(--text);">Bleu${Store.uiTheme!=='black'?' ✓':''}</span>
            </button>
            <button type="button" onclick="setUiTheme('black')" style="flex:1;padding:12px;border-radius:14px;border:2px solid ${Store.uiTheme==='black'?'var(--ink)':'var(--line)'};background:#fff;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;">
              <span style="width:100%;height:34px;border-radius:9px;background:linear-gradient(135deg,#000000,#2E2E2E);"></span>
              <span style="font-size:12.5px;font-weight:800;color:var(--text);">Noir${Store.uiTheme==='black'?' ✓':''}</span>
            </button>
          </div>
        </section>
        <section class="v39-settings-section">
          <div class="v39-settings-head"><div class="v39-settings-icon">🛡️</div><div><b>Sécurité du compte</b><span>Identifiant et accès à votre espace marchand.</span></div></div>
          <div style="padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel);margin-bottom:9px;"><small style="color:var(--text-mid);display:block;margin-bottom:4px;">ID marchand SIAMS</small><strong class="mono" style="font-size:15px;">${Utils.escapeHtml(s.loginId||Cloud.loginId||'—')}</strong></div>
          <button class="btn btn-primary btn-block" onclick="AccountId.current='${Utils.escapeHtml(s.loginId||Cloud.loginId||'')}';Router.go('account-id')">Gérer mon ID marchand</button>
          <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="contactSupportForgotPassword()">Mot de passe oublié</button>
        </section>
        <section class="v39-settings-section">
          <div class="v39-settings-head"><div class="v39-settings-icon">💬</div><div><b>Assistance SIAMS</b><span>Besoin d'aide avec votre compte ou votre boutique ?</span></div></div>
          <button class="btn btn-soft-green btn-block" onclick="window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent('Bonjour SIAMS, j’ai besoin d’assistance depuis mes paramètres.'),'_blank')">Contacter le service client</button>
        </section>
      </div>`;
  };

  /* ---------- Catégories client : suppression des grosses tables au-dessus de la recherche ---------- */
  Views['shop-categories'] = function(opts){
    opts=opts||{};
    const selected=(!opts.cat||opts.cat==='__all__')?'':opts.cat;
    const cats=Store.categories||[];
    return `<div class="v39-cat-wrap">
      <div class="v39-cat-head"><div style="font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--indigo);text-transform:uppercase;margin-bottom:4px;">CATALOGUE</div><h1>Catégories</h1><p>Trouvez rapidement les produits qui vous intéressent.</p></div>
      <div class="v39-cat-search">
        <div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="shop-search__v46_2" type="text" placeholder="Rechercher un produit..." oninput="renderShopGrid()"></div>
        <button class="shop-tool-btn" onclick="openShopSheet()" aria-label="Filtrer et trier"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="v39-cat-chips"><button class="v39-cat-chip ${!selected?'active':''}" onclick="setShopCatFilter('')">Tous</button>${cats.map(c=>`<button class="v39-cat-chip ${c===selected?'active':''}" onclick="setShopCatFilter(decodeURIComponent('${encodeURIComponent(c)}'))">${Utils.escapeHtml(c)}</button>`).join('')}</div>
      <div class="v39-cat-results"><strong id="shop-result-count__v46_2"></strong><button class="fav-toggle" id="shop-fav-toggle__v46_2" onclick="toggleShopFavOnly()">♡ Favoris</button></div>
      <div class="shop-layout" style="padding:0 20px;"><div class="shop-cat-main" style="width:100%;"><div id="shop-empty__v46_2" class="hidden">${EmptyState(ICONS.box,'Boutique vide',"Cette boutique n'a pas encore de produits.")}</div><div id="shop-grid__v46_2" class="shop-grid"></div></div></div>
      <div class="fab hidden" id="cart-bar__v46_3" style="left:20px;right:20px;bottom:24px;max-width:440px;"><button class="btn btn-mango btn-block" onclick="Router.go('cart')" style="justify-content:space-between;"><span style="display:flex;align-items:center;gap:8px;">${ICONS.cart.replace('30','18').replace('30','18')} Voir le panier</span><span id="cart-bar-amount__v46_3"></span></button></div>
    </div>`;
  };
  Views._after_shop_categories=function(opts){ opts=opts||{}; Wishlist.load(); shopCatFilter=(!opts.cat||opts.cat==='__all__')?'':opts.cat; shopSort='default';shopFavOnly=false;shopPriceMin=null;shopPriceMax=null;renderShopGrid(); };

  /* ---------- Informations client : identité + adresse + position Google Maps ---------- */
  window.captureClientLocation=function(){
    if(!navigator.geolocation){ Toast.show('La localisation n’est pas disponible sur cet appareil'); return; }
    const btn=document.getElementById('acc-location-btn'); if(btn){btn.disabled=true;btn.textContent='Localisation…';}
    navigator.geolocation.getCurrentPosition(function(pos){
      const lat=Number(pos.coords.latitude.toFixed(6)), lng=Number(pos.coords.longitude.toFixed(6));
      const mapsUrl='https://www.google.com/maps/search/?api=1&query='+lat+','+lng;
      document.getElementById('acc-lat').value=lat;document.getElementById('acc-lng').value=lng;document.getElementById('acc-maps-url').value=mapsUrl;
      const preview=document.getElementById('acc-location-preview'); if(preview){preview.innerHTML=`Position détectée ✓<br><span style="font-size:10.5px;color:var(--text-mid);">${lat}, ${lng}</span>`;preview.style.color='var(--green)';}
      if(btn){btn.disabled=false;btn.textContent='Actualiser ma position';}
      Toast.show('Position enregistrée ✓');
    },function(){ if(btn){btn.disabled=false;btn.textContent='Utiliser ma position';} Toast.show('Autorisez la localisation pour continuer'); },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
  };
  window.openClientMaps=function(){
    const url=document.getElementById('acc-maps-url')?.value||'';
    if(url) window.open(url,'_blank'); else Toast.show('Enregistrez d’abord votre position');
  };
  window.saveAccountProfile=function(){
    const name=document.getElementById('acc-name')?.value.trim()||'';
    const firstName=document.getElementById('acc-firstname')?.value.trim()||'';
    const email=document.getElementById('acc-email')?.value.trim()||'';
    const phone=document.getElementById('acc-phone')?.value.trim()||'';
    const city=document.getElementById('acc-city')?.value.trim()||'';
    const district=document.getElementById('acc-district')?.value.trim()||'';
    const address=document.getElementById('acc-address')?.value.trim()||'';
    const lat=document.getElementById('acc-lat')?.value||'';
    const lng=document.getElementById('acc-lng')?.value||'';
    const mapsUrl=document.getElementById('acc-maps-url')?.value||'';
    if(!firstName||!name||!phone){Toast.show('Renseignez au minimum le nom, le prénom et le numéro');return;}
    ClientLocal.save({name,firstName,email,phone,city,district,address,lat,lng,mapsUrl});
    document.getElementById('acc-edit-wrap')?.remove();Toast.show('Informations enregistrées ✓');Router.go('shop-account');
  };
  window.openAccountProfileEditor=function(){
    ClientLocal.load(); const p=ClientLocal.profile; const existing=document.getElementById('acc-edit-wrap');if(existing)existing.remove();
    const mapsLabel=p.lat&&p.lng?'Position déjà enregistrée':'Ajoutez votre position';
    const wrap=document.createElement('div');wrap.id='acc-edit-wrap__v46_2';
    wrap.innerHTML=`<div class="shop-sheet-overlay show" onclick="document.getElementById('acc-edit-wrap').remove()"></div><div class="shop-sheet show"><div class="sheet-handle"></div><h3>Mes informations</h3><p style="font-size:11.5px;color:var(--text-mid);line-height:1.45;margin:-4px 0 13px;">Ces informations facilitent vos commandes et votre livraison.</p>
      <div class="v39-profile-grid">
        <div class="field"><label>Prénom</label><input id="acc-firstname" type="text" autocomplete="given-name" value="${Utils.escapeHtml(p.firstName||'')}"></div>
        <div class="field"><label>Nom</label><input id="acc-name" type="text" autocomplete="family-name" value="${Utils.escapeHtml(p.name||'')}"></div>
        <div class="field full"><label>E-mail</label><input id="acc-email" type="email" autocomplete="email" value="${Utils.escapeHtml(p.email||'')}"></div>
        <div class="field full"><label>Numéro de téléphone</label><input id="acc-phone" type="tel" autocomplete="tel" value="${Utils.escapeHtml(p.phone||'')}"></div>
        <div class="field"><label>Ville</label><input id="acc-city" type="text" autocomplete="address-level2" value="${Utils.escapeHtml(p.city||'')}"></div>
        <div class="field"><label>Quartier</label><input id="acc-district" type="text" value="${Utils.escapeHtml(p.district||'')}"></div>
        <div class="field full"><label>Adresse / repère</label><input id="acc-address" type="text" autocomplete="street-address" placeholder="Rue, repère, lieu connu…" value="${Utils.escapeHtml(p.address||'')}"></div>
      </div>
      <div class="v39-location-card"><div class="v39-location-head"><div class="v39-location-icon">📍</div><div><b>Position de livraison</b><span>Utilisez la localisation de votre téléphone puis ouvrez-la dans Google Maps.</span></div></div>
        <div id="acc-location-preview" style="font-size:11px;color:${p.lat&&p.lng?'var(--green)':'var(--text-mid)'};line-height:1.45;margin-bottom:8px;">${p.lat&&p.lng?mapsLabel+'<br><span style="font-size:10.5px;">'+Utils.escapeHtml(p.lat)+', '+Utils.escapeHtml(p.lng)+'</span>':'Aucune position enregistrée'}</div>
        <input id="acc-lat" type="hidden" value="${Utils.escapeHtml(p.lat||'')}"><input id="acc-lng" type="hidden" value="${Utils.escapeHtml(p.lng||'')}"><input id="acc-maps-url" type="hidden" value="${Utils.escapeHtml(p.mapsUrl||'')}">
        <div class="v39-location-actions"><button id="acc-location-btn" class="btn btn-soft-green" onclick="captureClientLocation()">${p.lat&&p.lng?'Actualiser ma position':'Utiliser ma position'}</button><button class="btn btn-outline" onclick="openClientMaps()">Ouvrir Google Maps</button></div>
        <a class="v39-map-link" href="https://www.google.com/maps" target="_blank" rel="noopener">Google Maps · choisir ou vérifier un lieu</a>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:4px;" onclick="saveAccountProfile()">Enregistrer mes informations</button>
    </div>`;
    document.body.appendChild(wrap);
  };

  /* Synchronise les anciennes données client avec les nouveaux champs sans les perdre. */
  const oldClientLoad=ClientLocal.load.bind(ClientLocal);
  ClientLocal.load=function(){
    oldClientLoad();
    this.profile=Object.assign({name:'',firstName:'',email:'',phone:'',city:'',district:'',address:'',lat:'',lng:'',mapsUrl:''},this.profile||{});
    return this.profile;
  };
  const oldClientSave=ClientLocal.save.bind(ClientLocal);
  ClientLocal.save=function(p){ return oldClientSave(Object.assign({firstName:'',email:'',city:'',district:'',lat:'',lng:'',mapsUrl:''},p||{})); };
})();
