/* ---------- Produits ---------- */
Views.products = function(){
  const products = Store.products;
  const cats = Store.categories;
  const access = Store.access();
  const maxProducts = access.features.maxProducts;
  const limited = Number.isFinite(maxProducts);
  const currentPlanObj = SUBSCRIPTION_PLANS.find(p=>p.key===access.plan);
  const currentPlanLabel = currentPlanObj ? currentPlanObj.label : access.label;
  const nextPlanIdx = SUBSCRIPTION_PLANS.findIndex(p=>p.key===access.plan) + 1;
  const nextPlan = SUBSCRIPTION_PLANS[nextPlanIdx];
  return `
  ${TopBar('Produits')}
  <div class="products-v3-head">
    <div><div class="products-v3-kicker">Catalogue marchand</div><h1 class="products-v3-title">Mes produits</h1></div>
    <div class="products-v3-count"><span id="product-count">${products.length}</span> produits</div>
  </div>
  <div class="products-v3-toolbar">
    <div class="search-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="product-search" type="text" placeholder="Rechercher un produit..." oninput="renderProductList()">
    </div>
    <button class="products-v3-filter-btn" onclick="document.getElementById('product-search').focus()" aria-label="Rechercher"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
  </div>
  ${cats.length>0 ? `<div class="products-v3-chips">
    <button class="products-v3-chip active" data-cat="" onclick="setProductCatFilter('')">Tous</button>
    ${cats.map(c=>`<button class="products-v3-chip" data-cat="${Utils.escapeHtml(c)}" onclick="setProductCatFilter('${Utils.escapeHtml(c)}')">${Utils.escapeHtml(c)}</button>`).join('')}
  </div>` : ''}
  <div class="products-v3-summary"><strong>Votre catalogue</strong><span>${limited?`Limite : ${maxProducts} · ${currentPlanLabel}`:'Catalogue illimité'}</span></div>
  <div style="margin:10px 20px 0;"><button class="btn btn-outline btn-block" onclick="exportProductsCSV()">Exporter le catalogue (Excel / CSV)</button></div>
  ${limited && products.length>=maxProducts ? `<div style="margin:8px 20px 0;border:1.5px solid var(--mango);border-radius:var(--radius-md);padding:12px 14px;background:var(--mango-tint);font-size:12.5px;">Limite de ${maxProducts} produits atteinte.${nextPlan ? ` <a href="#" onclick="SubscriptionSheet.open();return false;" style="color:var(--mango-dark);font-weight:700;">Passez à ${nextPlan.label}</a> pour ${Number.isFinite(nextPlan.features.maxProducts) ? `jusqu'à ${nextPlan.features.maxProducts} produits` : 'un catalogue illimité'}.` : ''}</div>` : ''}
  <div id="products-empty" class="hidden product-v3-empty">${EmptyState(ICONS.box,'Aucun produit trouvé',"Ajoutez vos premiers produits pour commencer à recevoir des commandes.")}</div>
  <div id="products-list" class="products-v3-list"></div>
  <div class="fab"><button class="btn btn-primary" onclick="goAddProduct()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>Nouveau produit</button></div>
  `;
};
function goAddProduct(){
  const maxProducts = Store.access().features.maxProducts;
  if(Number.isFinite(maxProducts) && Store.products.length>=maxProducts){
    Toast.show(`Limite de ${maxProducts} produits atteinte`);
    SubscriptionSheet.open();
    return;
  }
  Router.go('product-add');
}
Views._after_products = function(){ productCatFilter=''; renderProductList(); };

function renderProductList(){
  const list = Store.products;
  const searchEl = document.getElementById('product-search');
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  let filtered = q ? list.filter(p=>p.name.toLowerCase().includes(q)) : list;
  if(productCatFilter) filtered = filtered.filter(p=>p.category===productCatFilter);
  const countEl = document.getElementById('product-count');
  if(countEl) countEl.textContent = list.length;
  const empty = document.getElementById('products-empty');
  const container = document.getElementById('products-list');
  if(!container) return;
  if(filtered.length===0){ empty.classList.remove('hidden'); container.innerHTML=''; return; }
  empty.classList.add('hidden');
  container.innerHTML = filtered.map(p=>{
    const low = p.stockLimited && Number(p.stockQty) <= 3;
    const rating = Store.avgRating(p.id);
    return `
    <div class="product-v3-card">
      <div class="product-v3-media">${p.photo?`<img src="${p.photo}" alt="">`:`<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8M12 13v8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`}${p.stockLimited?`<span class="product-v3-stock-dot ${low?'low':''}"></span>`:''}</div>
      <div class="product-v3-body">
        ${p.category ? `<div class="product-v3-cat">${Utils.escapeHtml(p.category)}</div>` : '<div class="product-v3-cat">Produit</div>'}
        <h4 class="product-v3-name">${Utils.escapeHtml(p.name)}</h4>
        <div class="product-v3-price">${Utils.fmtFCFA(p.price)}</div>
        <div class="product-v3-meta">
          ${p.stockLimited ? `<span class="product-v3-pill ${low?'low':''}">${low?'⚠ ':''}${p.stockQty} en stock</span>` : '<span class="product-v3-pill">Stock disponible</span>'}
          ${rating ? `<span class="product-v3-pill rating">★ ${rating.avg.toFixed(1)} · ${rating.count}</span>` : ''}
        </div>
      </div>
      <div class="product-v3-actions">
        <button class="product-v3-action" onclick="shareProduct('${p.id}')" aria-label="Partager l'article" title="Partager l'article"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="19" r="2.5" stroke="currentColor" stroke-width="1.8"/><path d="m8.2 10.7 7.4-4.2M8.2 13.3l7.4 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        <button class="product-v3-action" onclick="Router.go('product-edit',{id:'${p.id}'})" aria-label="Modifier" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>
        <button class="product-v3-action" onclick="deleteProduct('${p.id}')" aria-label="Supprimer" title="Supprimer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a2 2 0 0 1-2 1.8H10a2 2 0 0 1-2-1.8L7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>`;
  }).join('');
}
let productCatFilter = '';
function setProductCatFilter(cat){
  productCatFilter = cat;
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.cat===cat));
  renderProductList();
}
function deleteProduct(id){
  Store.products = Store.products.filter(p=>p.id!==id);
  renderProductList();
  Toast.show('Produit supprimé');
}

/* ---------- Ajout / modification produit ---------- */
let formPhotos = [];
let editingProductId = null;
function productForm(existing){
  const cats = Store.categories;
  const meta = existing ? Utils.decodeMeta(existing.desc) : {desc:'', sizes:[], colors:[], extra:[]};
  formExtraGroups = (meta.extra||[]).map(g=>({label:g.label, values:(g.values||[]).join(', ')}));
  return `
  <div class="form-wrap">
    <div class="field"><label>Nom du produit</label><input id="f-name" type="text" placeholder="Ex : Robe wax imprimée" value="${existing?Utils.escapeHtml(existing.name):''}"></div>
    <div class="field"><label>Catégorie</label>
      <select id="f-category">
        <option value="">Sans catégorie</option>
        ${cats.map(c=>`<option value="${Utils.escapeHtml(c)}" ${existing&&existing.category===c?'selected':''}>${Utils.escapeHtml(c)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Prix (FCFA)</label>
      <div class="price-field"><input id="f-price" type="number" inputmode="numeric" placeholder="0" value="${existing?existing.price:''}"><div class="price-suffix">FCFA</div></div>
    </div>
    <div class="field"><label>Prix barré avant réduction (facultatif)</label>
      <div class="price-field"><input id="f-old-price" type="number" inputmode="numeric" placeholder="0" value="${existing&&existing.oldPrice?existing.oldPrice:''}"><div class="price-suffix">FCFA</div></div>
      <div class="hint" style="margin-top:6px;color:var(--text-mid);font-size:12px;">Affiche un badge de réduction sur la boutique s'il est supérieur au prix de vente.</div>
    </div>
    <div class="field"><label>Photos du produit (facultatif)</label>
      <div id="photo-gallery" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;"></div>
      <div class="upload-box" id="upload-box" onclick="document.getElementById('f-photo').click()">
        <input type="file" id="f-photo" accept="image/png,image/jpeg,image/webp" multiple class="hidden" onchange="handlePhoto(event)">
        <div class="upload-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round"/></svg></div>
        <strong>Ajouter des photos du produit</strong><div class="sub">Appuyez pour choisir un ou plusieurs fichiers</div><div class="hint">PNG, JPG, WEBP — max 5 Mo chacune</div>
      </div>
    </div>
    <div class="field"><label>Quantité en stock</label>
      <div class="toggle-row"><span>J'ai un stock limité pour ce produit</span><label class="switch"><input type="checkbox" id="f-stock-toggle" ${existing&&existing.stockLimited?'checked':''} onchange="toggleStockQty()"><span class="slider"></span></label></div>
      <div class="stock-qty ${existing&&existing.stockLimited?'show':''}" id="stock-qty-wrap"><input id="f-stock-qty" type="number" inputmode="numeric" placeholder="Quantité disponible" value="${existing&&existing.stockQty!=null?existing.stockQty:''}"></div>
    </div>
    <div class="field"><label>Description</label><textarea id="f-desc" rows="3" placeholder="Décrivez le produit : matière, coupe, particularités...">${Utils.escapeHtml(meta.desc||'')}</textarea></div>
    <div class="field"><label>Tailles disponibles (facultatif)</label>
      <input id="f-sizes" type="text" placeholder="Ex : S, M, L, XL" value="${Utils.escapeHtml(meta.sizes.join(', '))}">
      <div class="hint" style="margin-top:6px;color:var(--text-mid);font-size:12px;">Séparez chaque taille par une virgule. Le client pourra choisir avant d'ajouter au panier.</div>
    </div>
    <div class="field"><label>Couleurs disponibles (facultatif)</label>
      <input id="f-colors" type="text" placeholder="Ex : Rouge, Bleu, Noir" value="${Utils.escapeHtml(meta.colors.join(', '))}">
      <div class="hint" style="margin-top:6px;color:var(--text-mid);font-size:12px;">Séparez chaque couleur par une virgule.</div>
    </div>
    <div class="field">
      <label>Autres options (séries, numéros, pointures, matières…)</label>
      <div class="hint" style="margin-bottom:8px;color:var(--text-mid);font-size:12px;">Ajoutez d'autres choix que le client sélectionnera avant d'ajouter au panier, en plus de la taille et de la couleur.</div>
      <div id="extra-groups-wrap">${renderExtraGroups()}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button type="button" class="btn btn-outline btn-sm" onclick="addExtraGroup('Série')">+ Série</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="addExtraGroup('Numéro')">+ Numéro</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="addExtraGroup('Pointure')">+ Pointure</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="addExtraGroup('Matière')">+ Matière</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="addExtraGroup('')">+ Attribut personnalisé</button>
      </div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-bottom:24px;" onclick="saveProduct('${existing?existing.id:''}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>${existing?'Enregistrer les modifications':'Ajouter le produit'}</button>
  </div>`;
}
/* ---- Attributs de variante personnalisés (séries, numéros, pointures, etc.) ----
   Complète les champs fixes Taille/Couleur par une liste extensible de groupes
   {label, values} que le vendeur construit via les boutons "+ ...". Persisté
   dans meta.extra (voir Utils.encodeMeta/decodeMeta) sans changer le schéma DB. */
let formExtraGroups = [];
function renderExtraGroups(){
  if(!formExtraGroups.length) return '';
  return formExtraGroups.map((g,i)=>`
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
      <input type="text" placeholder="Nom (ex : Série)" value="${Utils.escapeHtml(g.label)}" oninput="updateExtraGroup(${i},'label',this.value)" style="flex:0 0 34%;padding:11px;border:1.5px solid var(--line);border-radius:10px;">
      <input type="text" placeholder="Valeurs séparées par une virgule" value="${Utils.escapeHtml(g.values)}" oninput="updateExtraGroup(${i},'values',this.value)" style="flex:1;padding:11px;border:1.5px solid var(--line);border-radius:10px;">
      <button type="button" class="btn btn-ghost btn-sm" style="padding:11px 12px;" onclick="removeExtraGroup(${i})">✕</button>
    </div>`).join('');
}
function refreshExtraGroupsUI(){
  const el = document.getElementById('extra-groups-wrap');
  if(el) el.innerHTML = renderExtraGroups();
}
function addExtraGroup(defaultLabel){
  formExtraGroups.push({label:defaultLabel||'', values:''});
  refreshExtraGroupsUI();
}
function updateExtraGroup(i, field, val){
  if(formExtraGroups[i]) formExtraGroups[i][field] = val;
}
function removeExtraGroup(i){
  formExtraGroups.splice(i,1);
  refreshExtraGroupsUI();
}
Views['product-add'] = function(){ return `${TopBar('Nouveau produit')}${productForm(null)}`; };
Views['product-edit'] = function(opts){
  const p = Store.products.find(x=>x.id===opts.id);
  if(!p) return `${TopBar('Produit introuvable')}<div style="padding:20px;">${EmptyState(ICONS.box,'Produit introuvable','Ce produit a peut-être été supprimé.')}</div>`;
  return `${TopBar('Modifier le produit')}${productForm(p)}`;
};
Views._after_product_add = function(){ formPhotos = []; editingProductId = null; renderPhotoGallery(); };
Views._after_product_edit = function(opts){
  const p = Store.products.find(x=>x.id===opts.id);
  formPhotos = p ? (p.photos || (p.photo ? [p.photo] : [])).slice() : [];
  editingProductId = opts.id;
  renderPhotoGallery();
};
function renderPhotoGallery(){
  const wrap = document.getElementById('photo-gallery');
  if(!wrap) return;
  wrap.innerHTML = formPhotos.map((src,i)=>`
    <div style="position:relative;width:64px;height:64px;">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;border:1.5px solid var(--line);">
      <button onclick="removeFormPhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);border:2px solid #fff;color:#fff;font-size:12px;line-height:1;cursor:pointer;">✕</button>
    </div>`).join('');
}
function removeFormPhoto(i){ formPhotos.splice(i,1); renderPhotoGallery(); }
function toggleStockQty(){
  const on = document.getElementById('f-stock-toggle').checked;
  document.getElementById('stock-qty-wrap').classList.toggle('show', on);
}
function handlePhoto(e){
  const files = Array.from(e.target.files || []);
  files.forEach(async file=>{
    try{
      const dataUrl = await siamsPrepareImageDataURL(file);
      formPhotos.push(dataUrl);
      renderPhotoGallery();
    }catch(err){ Toast.show('Impossible de traiter cette photo'); }
  });
}
async function saveProduct(id){
  const name = document.getElementById('f-name').value.trim();
  const price = document.getElementById('f-price').value;
  if(!name){ Toast.show('Indiquez le nom du produit'); return; }
  if(!price || Number(price) <= 0){ Toast.show('Indiquez un prix valide'); return; }
  const oldPriceRaw = document.getElementById('f-old-price').value;
  const oldPrice = oldPriceRaw ? Number(oldPriceRaw) : null;
  const stockLimited = document.getElementById('f-stock-toggle').checked;
  const stockQty = stockLimited ? (document.getElementById('f-stock-qty').value || 0) : null;
  const descRaw = document.getElementById('f-desc').value.trim();
  const sizes = document.getElementById('f-sizes').value.split(',').map(s=>s.trim()).filter(Boolean);
  const colors = document.getElementById('f-colors').value.split(',').map(s=>s.trim()).filter(Boolean);
  const extra = formExtraGroups.map(g=>({label:(g.label||'').trim(), values:(g.values||'').split(',').map(v=>v.trim()).filter(Boolean)})).filter(g=>g.label && g.values.length);
  const desc = Utils.encodeMeta(descRaw, {sizes, colors, extra});
  const category = document.getElementById('f-category').value;
  const photos = formPhotos.slice();
  const products = Store.products;

  let newProducts;
  if(id){
    newProducts = products.map(p=>p.id===id ? { ...p, name, price:Number(price), oldPrice, category, photos, photo:photos[0]||null, stockLimited, stockQty, desc } : p);
  } else {
    const maxProducts = Store.access().features.maxProducts;
    if(Number.isFinite(maxProducts) && products.length>=maxProducts){
      Toast.show(`Limite de ${maxProducts} produits atteinte`);
      SubscriptionSheet.open();
      return;
    }
    newProducts = [{ id:Utils.uid(), name, price:Number(price), oldPrice, category, photos, photo:photos[0]||null, stockLimited, stockQty, desc }, ...products];
  }

  const saveBtn = document.querySelector('.btn.btn-primary.btn-block[onclick^="saveProduct"]');
  if(saveBtn){ saveBtn.disabled = true; saveBtn.style.opacity = '0.6'; }

  try {
    await Cloud.pushProducts(products, newProducts); // on ATTEND la vraie confirmation Supabase
    _cache.products = newProducts;
    Toast.show(id ? 'Produit modifié ✓' : 'Produit ajouté ✓');
    if(stockLimited && Number(stockQty)===0) Notify.add('stock', `⚠️ Stock épuisé : ${name} — pensez à réapprovisionner`);
    else if(stockLimited && Number(stockQty) <= 3) Notify.add('stock', `Stock presque épuisé : ${name} (${stockQty} restant${Number(stockQty)>1?'s':''})`);
    formPhotos = [];
    Router.go('products');
  } catch(e) {
    console.error('Erreur enregistrement produit', e);
    Toast.show('⚠️ Échec : '+(e && (e.message||e.code||JSON.stringify(e))));
    if(saveBtn){ saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
  }
}

/* ==========================================================
   Module Restauration & street food — Menu du jour
   Écran dédié, données dans Store.menuItems (table menu_items).
   Le panier/commande/paiement/livraison réutilise le moteur
   existant (addToCart, checkout, orders) sans modification.
   ========================================================== */
const MENU_CATEGORIES = ['Entrée','Plat','Boisson','Dessert','Snack'];
let menuCatFilter = '';

Views.menu = function(){
  const items = Store.menuItems;
  const availableCount = items.filter(m=>m.available).length;
  return `
  ${TopBar('Menu du jour')}
  <div class="products-v3-head">
    <div><div class="products-v3-kicker">Restauration & street food</div><h1 class="products-v3-title">Mon menu du jour</h1></div>
    <div class="products-v3-count"><span id="menu-count">${items.length}</span> plats</div>
  </div>
  <div class="products-v3-toolbar">
    <div class="search-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="menu-search" type="text" placeholder="Rechercher un plat..." oninput="renderMenuList()">
    </div>
  </div>
  <div class="products-v3-chips">
    <button class="products-v3-chip active" data-cat="" onclick="setMenuCatFilter('')">Tous</button>
    ${MENU_CATEGORIES.map(c=>`<button class="products-v3-chip" data-cat="${c}" onclick="setMenuCatFilter('${c}')">${c}</button>`).join('')}
  </div>
  <div class="products-v3-summary"><strong>Disponibles aujourd'hui</strong><span>${availableCount} / ${items.length} plats</span></div>
  ${items.length ? `<div style="margin:10px 20px 0;display:flex;gap:8px;">
    <button class="btn btn-outline btn-block" onclick="markAllMenuUnavailable()">🌙 Tout marquer indisponible</button>
  </div>` : ''}
  <div id="menu-empty" class="hidden product-v3-empty">${EmptyState(ICONS.box,'Aucun plat trouvé',"Ajoutez les plats de votre menu du jour pour commencer à recevoir des commandes.")}</div>
  <div id="menu-list" class="products-v3-list"></div>
  <div class="fab"><button class="btn btn-primary" onclick="Router.go('menu-add')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>Nouveau plat</button></div>
  `;
};
Views._after_menu = function(){ menuCatFilter=''; renderMenuList(); };

function setMenuCatFilter(cat){
  menuCatFilter = cat;
  document.querySelectorAll('.products-v3-chip').forEach(c=>c.classList.toggle('active', c.dataset.cat===cat));
  renderMenuList();
}

function renderMenuList(){
  const list = Store.menuItems;
  const searchEl = document.getElementById('menu-search');
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  let filtered = q ? list.filter(m=>m.name.toLowerCase().includes(q)) : list;
  if(menuCatFilter) filtered = filtered.filter(m=>m.category===menuCatFilter);
  const countEl = document.getElementById('menu-count');
  if(countEl) countEl.textContent = list.length;
  const empty = document.getElementById('menu-empty');
  const container = document.getElementById('menu-list');
  if(!container) return;
  if(filtered.length===0){ empty.classList.remove('hidden'); container.innerHTML=''; return; }
  empty.classList.add('hidden');
  container.innerHTML = filtered.map(m=>`
    <div class="product-v3-card">
      <div class="product-v3-media">${m.photo?`<img src="${m.photo}" alt="">`:`<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M7 2v6.5a2.2 2.2 0 0 0 2.2 2.2M7 2v8.7M9.2 2v6.5M11.4 2v6.5a2.2 2.2 0 0 1-2.2 2.2M9.2 10.7V22" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`}</div>
      <div class="product-v3-body">
        <div class="product-v3-cat">${Utils.escapeHtml(m.category||'Plat')}</div>
        <h4 class="product-v3-name">${Utils.escapeHtml(m.name)}</h4>
        <div class="product-v3-price">${Utils.fmtFCFA(m.price)}</div>
        <div class="product-v3-meta">
          <label class="toggle-row" style="gap:8px;margin:0;" onclick="event.stopPropagation()">
            <span style="font-size:12px;">${m.available?"Disponible aujourd'hui":'Indisponible'}</span>
            <label class="switch"><input type="checkbox" ${m.available?'checked':''} onchange="toggleMenuAvailability('${m.id}', this.checked)"><span class="slider"></span></label>
          </label>
        </div>
      </div>
      <div class="product-v3-actions">
        <button class="product-v3-action" onclick="duplicateMenuItem('${m.id}')" aria-label="Dupliquer" title="Dupliquer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="product-v3-action" onclick="Router.go('menu-edit',{id:'${m.id}'})" aria-label="Modifier" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>
        <button class="product-v3-action" onclick="deleteMenuItem('${m.id}')" aria-label="Supprimer" title="Supprimer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a2 2 0 0 1-2 1.8H10a2 2 0 0 1-2-1.8L7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>`).join('');
}

/* ---- Bascule rapide de la disponibilité, directement depuis la liste (sans
   passer par le formulaire) : c'est l'action la plus fréquente au quotidien
   pour un vendeur de rue dont le menu change chaque jour. ---- */
async function toggleMenuAvailability(id, checked){
  const items = Store.menuItems;
  const prev = items;
  const next = items.map(m=>m.id===id ? {...m, available:checked} : m);
  try{
    await Cloud.pushMenuItems(prev, next);
    _cache.menuItems = next;
    Toast.show(checked ? 'Plat marqué disponible ✓' : 'Plat marqué indisponible');
  }catch(e){
    console.error('Erreur disponibilité plat', e);
    Toast.show('⚠️ Échec de la mise à jour, réessayez');
    renderMenuList();
  }
}

/* ---- Fin de journée : bascule tous les plats en indisponible en un seul geste,
   plutôt que de décocher chaque plat un par un. Le menu reste enregistré (rien
   n'est supprimé) — le vendeur n'a qu'à recocher demain matin ce qu'il propose. ---- */
async function markAllMenuUnavailable(){
  const items = Store.menuItems;
  const availableItems = items.filter(m=>m.available);
  if(availableItems.length===0){ Toast.show('Aucun plat disponible à désactiver'); return; }
  if(!confirm(`Marquer les ${availableItems.length} plat(s) disponible(s) comme indisponibles ?`)) return;
  const next = items.map(m=>({...m, available:false}));
  const btn = document.querySelector('.products-v3-summary + div .btn-outline');
  if(btn){ btn.disabled = true; btn.style.opacity = '0.6'; }
  try{
    await Cloud.pushMenuItems(items, next);
    _cache.menuItems = next;
    Toast.show('Menu du jour clôturé ✓ Tous les plats sont indisponibles');
    Router.go('menu');
  }catch(e){
    console.error('Erreur clôture menu', e);
    Toast.show('⚠️ Échec de la mise à jour, réessayez');
    if(btn){ btn.disabled = false; btn.style.opacity = '1'; }
  }
}

/* ---- Duplique un plat (même nom/prix/catégorie/photo), marqué disponible par
   défaut. Utile pour reconstituer rapidement le menu type du jour, ou pour créer
   une variante proche (ex : "Attiéké poisson" -> dupliqué puis renommé "Attiéké
   poulet"). Ouvre directement l'écran d'édition de la copie pour ajuster. ---- */
async function duplicateMenuItem(id){
  const items = Store.menuItems;
  const source = items.find(m=>m.id===id);
  if(!source) return;
  const copy = { ...source, id:Utils.uid(), name: source.name + ' (copie)', available:true };
  const next = [copy, ...items];
  try{
    await Cloud.pushMenuItems(items, next);
    _cache.menuItems = next;
    Toast.show('Plat dupliqué ✓');
    Router.go('menu-edit', {id:copy.id});
  }catch(e){
    console.error('Erreur duplication plat', e);
    Toast.show('⚠️ Échec de la duplication, réessayez');
  }
}

function deleteMenuItem(id){
  Store.menuItems = Store.menuItems.filter(m=>m.id!==id);
  renderMenuList();
  Toast.show('Plat supprimé');
}

/* ---------- Ajout / modification d'un plat ---------- */
let menuFormPhoto = null;
function menuForm(existing){
  return `
  <div class="form-wrap">
    <div class="field"><label>Nom du plat</label><input id="mf-name" type="text" placeholder="Ex : Attiéké poisson braisé" value="${existing?Utils.escapeHtml(existing.name):''}"></div>
    <div class="field"><label>Catégorie</label>
      <select id="mf-category">
        ${MENU_CATEGORIES.map(c=>`<option value="${c}" ${existing&&existing.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Prix (FCFA)</label>
      <div class="price-field"><input id="mf-price" type="number" inputmode="numeric" placeholder="0" value="${existing?existing.price:''}"><div class="price-suffix">FCFA</div></div>
    </div>
    <div class="field"><label>Photo du plat (facultatif)</label>
      <div id="menu-photo-gallery" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;"></div>
      <div class="upload-box" id="menu-upload-box" onclick="document.getElementById('mf-photo').click()">
        <input type="file" id="mf-photo" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="handleMenuPhoto(event)">
        <div class="upload-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round"/></svg></div>
        <strong>Ajouter une photo du plat</strong><div class="sub">Appuyez pour choisir un fichier</div><div class="hint">PNG, JPG, WEBP — max 5 Mo</div>
      </div>
    </div>
    <div class="field">
      <div class="toggle-row"><span>Disponible aujourd'hui</span><label class="switch"><input type="checkbox" id="mf-available" ${!existing || existing.available?'checked':''}><span class="slider"></span></label></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-bottom:24px;" onclick="saveMenuItem('${existing?existing.id:''}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>${existing?'Enregistrer les modifications':'Ajouter le plat'}</button>
  </div>`;
}
function renderMenuPhotoGallery(){
  const wrap = document.getElementById('menu-photo-gallery');
  if(!wrap) return;
  wrap.innerHTML = menuFormPhoto ? `
    <div style="position:relative;width:64px;height:64px;">
      <img src="${menuFormPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;border:1.5px solid var(--line);">
      <button onclick="removeMenuFormPhoto()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);border:2px solid #fff;color:#fff;font-size:12px;line-height:1;cursor:pointer;">✕</button>
    </div>` : '';
}
function removeMenuFormPhoto(){ menuFormPhoto = null; renderMenuPhotoGallery(); }
function handleMenuPhoto(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  siamsPrepareImageDataURL(file).then(dataUrl=>{
    menuFormPhoto = dataUrl;
    renderMenuPhotoGallery();
  }).catch(()=>Toast.show('Impossible de traiter cette photo'));
}
Views['menu-add'] = function(){ return `${TopBar('Nouveau plat')}${menuForm(null)}`; };
Views['menu-edit'] = function(opts){
  const m = Store.menuItems.find(x=>x.id===opts.id);
  if(!m) return `${TopBar('Plat introuvable')}<div style="padding:20px;">${EmptyState(ICONS.box,'Plat introuvable','Ce plat a peut-être été supprimé.')}</div>`;
  return `${TopBar('Modifier le plat')}${menuForm(m)}`;
};
Views._after_menu_add = function(){ menuFormPhoto = null; renderMenuPhotoGallery(); };
Views._after_menu_edit = function(opts){
  const m = Store.menuItems.find(x=>x.id===opts.id);
  menuFormPhoto = m ? (m.photo || null) : null;
  renderMenuPhotoGallery();
};
async function saveMenuItem(id){
  const name = document.getElementById('mf-name').value.trim();
  const price = document.getElementById('mf-price').value;
  if(!name){ Toast.show('Indiquez le nom du plat'); return; }
  if(!price || Number(price) <= 0){ Toast.show('Indiquez un prix valide'); return; }
  const category = document.getElementById('mf-category').value;
  const available = document.getElementById('mf-available').checked;
  const photo = menuFormPhoto;
  const items = Store.menuItems;

  let newItems;
  if(id){
    newItems = items.map(m=>m.id===id ? { ...m, name, price:Number(price), category, photo, available } : m);
  } else {
    newItems = [{ id:Utils.uid(), name, price:Number(price), category, photo, available, desc:'' }, ...items];
  }

  const saveBtn = document.querySelector('.btn.btn-primary.btn-block[onclick^="saveMenuItem"]');
  if(saveBtn){ saveBtn.disabled = true; saveBtn.style.opacity = '0.6'; }

  try{
    await Cloud.pushMenuItems(items, newItems);
    _cache.menuItems = newItems;
    Toast.show(id ? 'Plat modifié ✓' : 'Plat ajouté ✓');
    menuFormPhoto = null;
    Router.go('menu');
  }catch(e){
    console.error('Erreur enregistrement plat', e);
    Toast.show('⚠️ Échec : '+(e && (e.message||e.code||JSON.stringify(e))));
    if(saveBtn){ saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
  }
}

/* ---------- Commandes ---------- */
let currentOrderFilter = 'all';
Views.orders = function(){
  const all = Store.orders || [];
  const pending = all.filter(o=>o.status==='pending').length;
  const delivered = all.filter(o=>o.status==='delivered').length;
  return `
  ${TopBar('Commandes')}
  <div class="orders-premium-head">
    <div class="eyebrow">Gestion commerciale</div>
    <h2>Vos commandes</h2>
    <p>Suivez chaque vente, de la réception à la livraison.</p>
  </div>
  <div class="orders-kpis">
    <div class="orders-kpi"><div class="v">${all.length}</div><div class="l">Total</div></div>
    <div class="orders-kpi pending"><div class="v">${pending}</div><div class="l">En attente</div></div>
    <div class="orders-kpi done"><div class="v">${delivered}</div><div class="l">Livrées</div></div>
  </div>
  <div class="orders-filter-card">
    <div class="search-box" style="margin-bottom:10px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="order-search" type="text" placeholder="Rechercher une commande, un client..." oninput="renderOrderList()">
    </div>
    <div class="filter-row"><div class="chips">
      <button class="chip active" data-f="all" onclick="setOrderFilter('all')">Toutes</button>
      <button class="chip" data-f="pending" onclick="setOrderFilter('pending')">En attente</button>
      <button class="chip" data-f="confirmed" onclick="setOrderFilter('confirmed')">Confirmées</button>
      <button class="chip" data-f="delivered" onclick="setOrderFilter('delivered')">Livrées</button>
    </div></div>
  </div>
  <div class="section-title" style="padding-top:4px;">${all.length ? 'Activité récente' : 'Commandes'}</div>
  <div id="orders-empty" class="hidden">${EmptyState(ICONS.box,'Aucune commande',"Les commandes de vos clients apparaîtront ici.",
    `<button class="btn btn-primary" onclick="Router.go('product-add')">Ajouter un produit</button>`)}</div>
  <div id="orders-list" class="orders-list-premium"></div>
  `;
};
Views._after_orders = function(){ currentOrderFilter='all'; renderOrderList(); };
function setOrderFilter(f){
  currentOrderFilter = f;
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.f===f));
  renderOrderList();
}
function renderOrderList(){
  const all = Store.orders || [];
  let list = all;
  if(currentOrderFilter!=='all') list = all.filter(o=>o.status===currentOrderFilter);
  const searchEl = document.getElementById('order-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  if(q) list = list.filter(o=> String(o.number).includes(q) || (o.customer?.name||'').toLowerCase().includes(q) || (o.customer?.phone||'').toLowerCase().includes(q));
  const empty = document.getElementById('orders-empty');
  const container = document.getElementById('orders-list');
  if(!container) return;
  if(list.length===0){ if(empty) empty.classList.remove('hidden'); container.innerHTML=''; return; }
  if(empty) empty.classList.add('hidden');
  const badgeLabel = {pending:'En attente', confirmed:'Confirmée', delivered:'Livrée'};
  container.innerHTML = list.map(o=>`
    <div class="order-card-premium" onclick="Router.go('order-detail',{id:'${o.id}'})">
      <div class="status-dot ${o.status}"></div>
      <div class="order-card-main">
        <div class="order-card-top"><h4>Commande #${o.number}</h4><span class="badge ${o.status}">${badgeLabel[o.status]||o.status}</span></div>
        <div class="meta">${Utils.escapeHtml(o.customer?.name||'Client')} · ${o.items?.length||0} article(s)</div>
      </div>
      <div class="order-card-side"><div class="amount">${Utils.fmtFCFA(o.amount)}</div><div class="order-card-arrow">›</div></div>
    </div>
  `).join('');
}

/* ---------- Détail commande ---------- */
const PAY_LABELS = {wave:'Wave', om:'Orange Money', mtn:'MTN Money', moov:'Moov Money', cash:'Paiement à la livraison'};
Views['order-detail'] = function(opts){
  const order=Store.orders.find(o=>o.id===opts.id);
  if(!order)return `${TopBar('Commande introuvable')}<div style="padding:20px;">${EmptyState(ICONS.box,'Commande introuvable','Cette commande a peut-être été supprimée.')}</div>`;
  const labels={pending:'En attente',confirmed:'Confirmée',delivered:'Livrée'}; const shipped=!!order.shipped||order.status==='delivered';
  const steps=[['pending','Commande reçue',true],['confirmed','Commande confirmée',order.status==='confirmed'||order.status==='delivered'],['shipped','Commande en livraison',shipped],['delivered','Commande livrée',order.status==='delivered']];
  return `
  <div class="topbar" style="padding-top:18px;"><div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('orders')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1>Commande</h1></div></div>
  <div class="order-detail-hero">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
      <div><div class="eyebrow">Détail de la vente</div><h2>#${order.number}</h2><p>${Utils.timeAgo(order.createdAt)} · ${order.items?.length||0} article(s)</p></div>
      <div style="text-align:right;flex:none;"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-mid);">Total</div><div class="mono" style="font-size:19px;font-weight:800;color:var(--indigo);margin-top:2px;">${Utils.fmtFCFA(order.amount)}</div></div>
    </div>
    <div class="order-detail-status ${order.status}"><span class="dot"></span>${labels[order.status]||order.status}</div>
  </div>
  <div class="order-section"><div class="order-section-title"><span class="ico blue"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c.8-4 3.4-6.2 7-6.2s6.2 2.2 7 6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>Client</div><div class="order-client-name">${Utils.escapeHtml(order.customer.name)}</div><div class="order-client-meta">${Utils.escapeHtml(order.customer.phone)}<br>${Utils.escapeHtml(order.customer.address)}</div><div class="order-actions"><button class="btn btn-soft-green btn-sm" onclick="window.open('https://wa.me/225${(order.customer.phone||'').replace(/\D/g,'')}','_blank')"><svg width="14" height="14" viewBox="0 0 448 512" fill="currentColor" style="vertical-align:-2px;margin-right:5px;"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>Contacter</button><button class="btn btn-soft-indigo btn-sm" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('${Utils.escapeHtml(order.customer.address||'')}'),'_blank')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:5px;"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.6"/></svg>Itinéraire</button></div></div>
  <div class="order-section"><div class="order-section-title"><span class="ico indigo"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 8h16M4 8l1.5 11a2 2 0 0 0 2 1.7h9a2 2 0 0 0 2-1.7L20 8M4 8l2-4h12l2 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Articles</div>${(order.items||[]).map(it=>`<div class="order-item"><div class="order-item-thumb">${it.photo?`<img src="${it.photo}">`:'◫'}</div><div class="order-item-main"><b>${Utils.escapeHtml(it.name)}</b><span>Quantité ×${it.qty}</span></div><div class="order-item-price">${Utils.fmtFCFA(it.price*it.qty)}</div></div>`).join('')}${order.discount?`<div style="display:flex;justify-content:space-between;padding-top:10px;font-size:12px;color:var(--green);"><span>Réduction</span><span class="mono">−${Utils.fmtFCFA(order.discount)}</span></div>`:''}${order.deliveryFee?`<div style="display:flex;justify-content:space-between;padding-top:8px;font-size:12px;color:var(--text-mid);"><span>Livraison</span><span class="mono">${Utils.fmtFCFA(order.deliveryFee)}</span></div>`:''}<div class="order-total"><b>Total</b><strong>${Utils.fmtFCFA(order.amount)}</strong></div></div>
  <div class="order-section"><div class="order-section-title"><span class="ico green"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Suivi de la commande</div><div class="order-timeline">${steps.map(x=>`<div class="timeline-step ${x[2]?'done':''} ${x[0]==='delivered'&&x[2]?'delivered':''}"><span class="point"></span><b>${x[1]}</b><span>${x[2]?'Étape validée':'À venir'}</span></div>`).join('')}</div></div>
  <div class="order-section"><div class="order-section-title"><span class="ico gold"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.7"/></svg></span>Paiement</div><div style="font-size:13px;font-weight:700;">${PAY_LABELS[order.paymentMethod]||order.paymentMethod}</div>${order.paymentProof?`<div style="font-size:11.5px;color:var(--text-mid);margin-top:6px;">Preuve de paiement reçue</div>`:(order.paymentMethod!=='cash'?`<div style="font-size:11.5px;color:var(--red);margin-top:6px;">Aucune preuve fournie.</div>`:'')}</div>
  <div class="order-section"><div class="order-section-title"><span class="ico mango"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 8h11v9H4zM15 11h3l3 3v3h-6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="7.5" cy="19" r="1.6" stroke="currentColor" stroke-width="1.5"/><circle cx="17.5" cy="19" r="1.6" stroke="currentColor" stroke-width="1.5"/></svg></span>Livraison</div><div style="font-size:12px;color:var(--text-mid);">${order.courierId?'Livreur affecté · suivi GPS disponible.':shipped?'Commande en cours de livraison ou livrée.':order.status==='confirmed'?'Affectez un livreur pour cette commande.':'Affectation disponible après confirmation.'}</div>${(()=>{
    if(order.courierId||shipped||order.status!=='confirmed') return '';
    const activeCouriers = Store.couriers.filter(c=>c.status==='active');
    if(!activeCouriers.length){
      return `<div style="margin-top:10px;padding:12px 14px;border-radius:10px;background:var(--mango-tint,#fff7df);font-size:12px;color:var(--text-mid);line-height:1.5;">Aucun livreur actif pour l'instant. Invitez un livreur pour pouvoir affecter vos livraisons.<br><button class="btn btn-soft-indigo btn-sm" style="margin-top:8px;" onclick="Router.go('team')">Inviter un livreur</button></div>`;
    }
    return `<select id="assign-courier-select" style="width:100%;margin-top:10px;padding:12px;border:1.5px solid var(--line);border-radius:10px;background:#fff;font-size:14px;"><option value="">Choisir un livreur</option>${activeCouriers.map(c=>`<option value="${c.id}">${Utils.escapeHtml(c.name)} · ${Utils.escapeHtml(c.phone||'')}</option>`).join('')}</select><button class="btn btn-soft-green btn-block" style="margin-top:9px;" onclick="assignOrderToCourier('${order.id}')">Affecter le livreur</button>`;
  })()}</div>
  <div class="order-main-action">${order.status==='pending'?`<button class="btn btn-primary btn-block" onclick="adminConfirmOrder('${order.id}')">Confirmer la commande</button>`:''}${order.status==='confirmed'&&!shipped?`<button class="btn btn-primary btn-block" onclick="adminMarkShipped('${order.id}')">Marquer « en livraison »</button>`:''}${order.status==='confirmed'&&shipped?`<div style="padding:12px 14px;border-radius:12px;background:var(--mango-tint,#fff7df);color:var(--text-mid);font-size:12.5px;line-height:1.45;text-align:center;">📷 Le client confirme la réception en prenant simplement une photo de l'article reçu. La commande sera automatiquement marquée <strong>Livrée</strong>.</div>`:''}${order.status==='delivered'?`<div style="text-align:center;color:var(--green);font-size:13px;font-weight:800;">✓ Livraison confirmée</div>`:''}</div>`;
};
/* ---------- Suivi GPS du livreur côté boutique (itinéraire temps réel) ----------
   La boutique est propriétaire de la commande : lecture directe des colonnes
   courier_latitude / courier_longitude de la table orders, protégée par RLS. */
let storeCourierPoll=null;
async function startStoreCourierRealtime(orderId){
  const wrap=document.getElementById('store-courier-live-'+orderId);
  if(!wrap) return;
  if(storeCourierPoll) clearInterval(storeCourierPoll);
  const refresh=async()=>{
    if(Router.current!=='order-detail'){ clearInterval(storeCourierPoll); storeCourierPoll=null; return; }
    const coordsEl=document.getElementById('store-courier-coords-'+orderId);
    const itinBtn=document.getElementById('store-courier-itin-'+orderId);
    if(!coordsEl){ clearInterval(storeCourierPoll); storeCourierPoll=null; return; }
    try{
      const { data, error } = await sb.from('orders').select('courier_latitude,courier_longitude,courier_location_at,delivery_status_message').eq('id', orderId).single();
      if(error || !data || data.courier_latitude==null || data.courier_longitude==null){
        coordsEl.textContent = 'Position du livreur : en attente de la prochaine mise à jour…';
        if(itinBtn) itinBtn.style.display = 'none';
        return;
      }
      const o = Store.orders.find(x=>x.id===orderId);
      if(o){ o.courierLat=Number(data.courier_latitude); o.courierLng=Number(data.courier_longitude); }
      const when = data.courier_location_at ? new Date(data.courier_location_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
      coordsEl.textContent = `📍 Dernière position du livreur : ${when}${data.delivery_status_message?' — '+data.delivery_status_message:''}`;
      if(itinBtn) itinBtn.style.display = 'inline-flex';
    }catch(e){ console.error('store courier location', e); }
  };
  await refresh();
  storeCourierPoll = setInterval(refresh, 5000);
}
function openStoreCourierItinerary(orderId){
  const o = Store.orders.find(x=>x.id===orderId);
  if(!o || o.courierLat==null || o.courierLng==null){ Toast.show('Position du livreur pas encore disponible'); return; }
  let url = `https://www.google.com/maps/dir/?api=1&origin=${o.courierLat},${o.courierLng}`;
  if(o.customerLat!=null && o.customerLng!=null) url += `&destination=${o.customerLat},${o.customerLng}`;
  else url += `&destination=${encodeURIComponent(o.customer.address||'')}`;
  window.open(url, '_blank');
}
Views._after_order_detail = function(opts){
  if(!opts || !opts.id) return;
  const order = Store.orders.find(o=>o.id===opts.id);
  if(order && order.courierId) setTimeout(()=>startStoreCourierRealtime(opts.id), 0);
  else if(storeCourierPoll){ clearInterval(storeCourierPoll); storeCourierPoll=null; }
};

/* ---------- Actions marchand sur une commande (confirmer / marquer en livraison / affecter un livreur) ----------
   Ces trois fonctions étaient appelées depuis les boutons du détail de commande mais n'étaient
   jamais définies : les clics ne faisaient rien (ReferenceError silencieuse en console). */
async function adminConfirmOrder(id){
  const order = Store.orders.find(o=>o.id===id);
  if(!order || order.status!=='pending') return;
  /* CORRECTIF : on attend désormais la fin réelle de l'écriture Supabase avant
     d'afficher « Confirmée ✓ ». Avant, Store.orders=... déclenchait l'écriture
     en arrière-plan (fire-and-forget) : le toast de succès s'affichait tout de
     suite quoi qu'il arrive, donc un échec silencieux (ex. RLS) passait
     inaperçu — la commande restait « pending » côté client alors que tout
     semblait fonctionner côté marchand. */
  const prev = Store.orders;
  const next = prev.map(o=>o.id===id?{...o,status:'confirmed',confirmedAt:Date.now()}:o);
  const btn = document.querySelector(`[onclick="adminConfirmOrder('${id}')"]`);
  if(btn){ btn.disabled=true; btn.textContent='Confirmation…'; }
  try{
    await Cloud.pushOrders(prev, next);
    _cache.orders = next;
    Toast.show('Commande confirmée ✓');
    Router.go('order-detail',{id});
  }catch(e){
    console.error('adminConfirmOrder', e);
    Toast.show('⚠️ Échec de la confirmation : '+(e&&e.message?e.message:'erreur inconnue'));
    if(btn){ btn.disabled=false; btn.textContent='Confirmer la commande'; }
  }
}
async function adminMarkShipped(id){
  const order = Store.orders.find(o=>o.id===id);
  if(!order || order.status!=='confirmed' || order.shipped) return;
  /* CORRECTIF : même principe que adminConfirmOrder ci-dessus — on attend la
     confirmation réelle de Supabase avant d'afficher le succès. */
  const prev = Store.orders;
  const next = prev.map(o=>o.id===id?{...o,shipped:true,shippedAt:Date.now()}:o);
  const btn = document.querySelector(`[onclick="adminMarkShipped('${id}')"]`);
  if(btn){ btn.disabled=true; btn.textContent='Mise à jour…'; }
  try{
    await Cloud.pushOrders(prev, next);
    _cache.orders = next;
    Toast.show('Commande marquée « en livraison » ✓');
    Router.go('order-detail',{id});
  }catch(e){
    console.error('adminMarkShipped', e);
    Toast.show('⚠️ Échec de la mise en livraison : '+(e&&e.message?e.message:'erreur inconnue'));
    if(btn){ btn.disabled=false; btn.textContent='Marquer « en livraison »'; }
  }
}
async function assignOrderToCourier(id){
  const sel = document.getElementById('assign-courier-select');
  const courierId = sel ? String(sel.value||'').trim() : '';
  if(!courierId){ Toast.show('Choisissez un livreur dans la liste.'); return; }

  const order = Store.orders.find(o=>String(o.id)===String(id));
  if(!order || order.status!=='confirmed' || order.shipped){
    Toast.show('Affectation disponible uniquement après confirmation et avant la mise en livraison.');
    return;
  }

  const btn = document.querySelector(`[onclick="assignOrderToCourier('${id}')"]`);
  if(btn){ btn.disabled=true; btn.textContent='Affectation…'; }

  try{
    await Cloud.assignCourier(id, courierId);
    _cache.orders = (_cache.orders||[]).map(o=>String(o.id)===String(id)?{...o,courierId}:o);
    const assignedCourier = Store.couriers.find(c=>String(c.id)===String(courierId));
    Toast.show(assignedCourier ? `Livreur ${assignedCourier.name} affecté ✓` : 'Livreur affecté ✓');
    Router.go('order-detail',{id});
  }catch(e){
    console.error('Affectation livreur',e);
    Toast.show(e && e.message==='Cette livraison est déjà acceptée par un livreur'
      ? '⚠️ Cette livraison est déjà prise en charge.'
      : (e && e.message ? `⚠️ ${e.message}` : '⚠️ Impossible d’affecter le livreur, réessayez'));
    if(btn){ btn.disabled=false; btn.textContent='Affecter le livreur'; }
  }
}

/* ---------- Confirmation de livraison par photo ----------
   Aucun QR code n'est nécessaire : le client prend une photo de l'article reçu.
   Le jeton de livraison reste interne et sert uniquement à sécuriser la confirmation
   côté serveur via confirm_order_delivery. Il n'est jamais affiché au client.
*/
async function ensureDeliverySecurityToken(order){
  if(!order) return null;
  if(order.deliveryToken) return order.deliveryToken;
  const token = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : Utils.uid();
  order.deliveryToken = token;
  _cache.orders = (_cache.orders||[]).map(o=>String(o.id)===String(order.id)?{...o,deliveryToken:token}:o);
  try{
    if(Cloud.storeId){
      const {error}=await sb.from('orders').update({delivery_token:token})
        .eq('id',order.id).eq('store_id',Cloud.storeId);
      if(error) throw error;
    }
  }catch(e){
    console.error('delivery security token',e);
    order.deliveryToken = null;
    return null;
  }
  ClientOrderCache.save(order);
  return token;
}

/* ---------- Statistiques ---------- */
let statsPeriod = 7;

function statsMoney(v){ return Utils.fmtFCFA(Math.round(Number(v)||0)); }
function statsPct(n,d){ return d ? Math.round((n/d)*100) : 0; }
function statsPaymentLabel(k){ return ({wave:'Wave',om:'Orange Money',mtn:'MTN Mobile Money',moov:'Moov Money',cash:'Paiement à la livraison'})[k] || k; }
function statsOrderStatusLabel(k){ return ({new:'Nouvelles',preparing:'En préparation',shipped:'Expédiées',delivered:'Terminées',cancelled:'Annulées'})[k] || k; }

Views.stats = function(){
  if(!Store.hasFeature('stats')) return FeatureLock('Statistiques', "Les statistiques avancées (revenus, panier moyen, produits les plus vendus) sont incluses à partir de la formule DOYEN.", 'doyen');
  statsPeriod = 7;
  const orders = Store.orders || [];
  const delivered = orders.filter(o=>o.status==='delivered');
  const validOrders = orders.filter(o=>o.status!=='cancelled');
  const revenue = delivered.reduce((s,o)=>s+(Number(o.amount)||0),0);
  const validAmount = validOrders.reduce((s,o)=>s+(Number(o.amount)||0),0);
  const avgBasket = validOrders.length ? Math.round(validAmount/validOrders.length) : 0;
  const top = Store.topProducts(8);
  const catPerf = Store.categoryPerformance();
  const counts = Store.orderStatusCounts();
  const clients = Store.customers();
  const clientsCount = clients.length;

  const mCur = Store.monthRange(0), mPrev = Store.monthRange(-1);
  const revCur = Store.revenueBetween(mCur.start, mCur.end);
  const revPrev = Store.revenueBetween(mPrev.start, mPrev.end);
  const ordCur = Store.ordersCountBetween(mCur.start, mCur.end);
  const ordPrev = Store.ordersCountBetween(mPrev.start, mPrev.end);
  const amtCur = Store.ordersAmountBetween(mCur.start, mCur.end);
  const amtPrev = Store.ordersAmountBetween(mPrev.start, mPrev.end);
  const basketCur = ordCur ? Math.round(amtCur/ordCur) : 0;
  const basketPrev = ordPrev ? Math.round(amtPrev/ordPrev) : 0;
  const newCustCur = Store.newCustomersBetween(mCur.start, mCur.end);
  const returningCustomers = clients.filter(c=>c.orders>=2).length;
  const deliveredRate = statsPct(delivered.length, orders.length);
  const cancellationRate = statsPct(counts.cancelled, orders.length);
  const deliveryAvg = delivered.length ? Math.round(delivered.reduce((s,o)=>{
    const a=Number(o.createdAt)||0, b=Number(o.deliveryConfirmedAt)||0;
    return s + (b>a ? (b-a) : 0);
  },0)/delivered.length/60000) : 0;

  const revD = pctDelta(revCur, revPrev);
  const ordD = pctDelta(ordCur, ordPrev);
  const basketD = pctDelta(basketCur, basketPrev);
  const kpiCard = (lbl, val, delta) => `
    <div class="kpi-card">
      <div class="lbl">${lbl}</div>
      <div class="val">${val}</div>
      ${delta ? `<div class="kpi-delta ${delta.dir}">${delta.dir==='up'?'▲':delta.dir==='down'?'▼':'•'} ${delta.txt} vs mois dernier</div>` : ''}
    </div>`;

  const statusSegments = [
    { key:'new', label:'Nouvelles', color:'var(--mango)', value:counts.new },
    { key:'preparing', label:'En préparation', color:'var(--blue)', value:counts.preparing },
    { key:'shipped', label:'Expédiées', color:'var(--indigo)', value:counts.shipped },
    { key:'delivered', label:'Terminées', color:'var(--green)', value:counts.delivered ?? counts.done ?? 0 },
    { key:'cancelled', label:'Annulées', color:'var(--red)', value:counts.cancelled }
  ];
  const statusTotal = statusSegments.reduce((s,x)=>s+x.value,0);
  const maxTop = Math.max(1, ...top.map(t=>t[1]));

  const paymentMap = {};
  validOrders.forEach(o=>{
    const key=o.paymentMethod||'unknown';
    if(!paymentMap[key]) paymentMap[key]={count:0,amount:0};
    paymentMap[key].count += 1;
    paymentMap[key].amount += Number(o.amount)||0;
  });
  const payments = Object.entries(paymentMap).sort((a,b)=>b[1].amount-a[1].amount);
  const maxPayment = Math.max(1,...payments.map(x=>x[1].amount));

  const zonesMap={};
  orders.forEach(o=>{
    const z=o.deliveryZone||'Non précisée';
    if(!zonesMap[z]) zonesMap[z]={count:0,amount:0};
    zonesMap[z].count++; zonesMap[z].amount += Number(o.amount)||0;
  });
  const zones=Object.entries(zonesMap).sort((a,b)=>b[1].count-a[1].count).slice(0,6);

  return `
  ${TopBar('Statistiques', "Pilotez votre activité avec les données réelles de votre boutique")}
  <div class="stats-premium-intro">
    <div class="eyebrow">Performance commerciale</div>
    <h2>Vos statistiques</h2>
    <p>Comprenez vos ventes, vos clients et les performances de votre boutique.</p>
  </div>
  <div class="stats-export"><button class="btn btn-outline btn-block" onclick="exportSalesReportPDF()">Exporter le rapport PDF</button></div>
  <div class="stats-export" style="margin-top:8px;"><button class="btn btn-outline btn-block" onclick="exportOrdersCSV()">Exporter les commandes (Excel / CSV)</button></div>

  <div class="stats-kpis">
    <div class="stats-kpi primary"><div class="lbl">CA livré ce mois</div><div class="val">${statsMoney(revCur)}</div>${revD?`<div style="font-size:10.5px;margin-top:5px;opacity:.9">${revD.dir==='up'?'▲':revD.dir==='down'?'▼':'•'} ${revD.txt} vs mois dernier</div>`:''}</div>
    <div class="stats-kpi"><div class="lbl">Commandes</div><div class="val">${ordCur}</div>${ordD?`<div style="font-size:10.5px;color:${ordD.dir==='up'?'var(--green)':ordD.dir==='down'?'var(--red)':'var(--text-mid)'};margin-top:5px">${ordD.txt} vs mois dernier</div>`:''}</div>
    <div class="stats-kpi"><div class="lbl">Panier moyen</div><div class="val">${statsMoney(basketCur)}</div>${basketD?`<div style="font-size:10.5px;color:${basketD.dir==='up'?'var(--green)':basketD.dir==='down'?'var(--red)':'var(--text-mid)'};margin-top:5px">${basketD.txt} vs mois dernier</div>`:''}</div>
    <div class="stats-kpi"><div class="lbl">Clients</div><div class="val">${clientsCount}</div><div style="font-size:10.5px;color:var(--text-mid);margin-top:5px">${newCustCur} nouveau${newCustCur>1?'x':''} ce mois</div></div>
  </div>

  <div class="stats-section">
    <div class="section-head"><h4>Performance globale</h4><span>Depuis le début</span></div>
    <div class="stats-insights">
      <div class="stats-insight"><div class="n">${deliveredRate}%</div><div class="t">Commandes terminées</div></div>
      <div class="stats-insight"><div class="n">${cancellationRate}%</div><div class="t">Annulations</div></div>
      <div class="stats-insight"><div class="n">${statsMoney(revenue)}</div><div class="t">CA livré total</div></div>
    </div>
    <div style="margin-top:11px;font-size:11.5px;color:var(--text-mid)">${deliveryAvg?`Temps moyen de traitement : <b style="color:var(--ink)">${deliveryAvg>=60?Math.floor(deliveryAvg/60)+' h '+deliveryAvg%60+' min':deliveryAvg+' min'}</b>`:'Le temps moyen apparaîtra après les premières livraisons confirmées.'}</div>
  </div>

  <div class="stats-section">
    <div class="section-head"><h4>Évolution du chiffre d’affaires</h4><span id="stats-trend-title">7 derniers jours</span></div>
    <div class="seg-control" style="margin-bottom:12px;">
      <button class="seg-btn active" data-period="7" onclick="setStatsPeriod(7)">7 jours</button>
      <button class="seg-btn" data-period="30" onclick="setStatsPeriod(30)">30 jours</button>
      <button class="seg-btn" data-period="365" onclick="setStatsPeriod(365)">12 mois</button>
    </div>
    <div id="stats-trend-chart" class="stats-chart-wrap">${Charts.trend(Store.ordersByDay(7))}</div>
  </div>

  <div class="stats-section">
    <div class="section-head"><h4>Répartition des commandes</h4><span>${statusTotal} au total</span></div>
    <div class="donut-row">
      ${Charts.donut(statusSegments.map(s=>({value:s.value,color:s.color})))}
      <div class="donut-legend">${statusSegments.map(s=>`<div class="donut-legend-item"><span class="donut-legend-name"><span class="donut-legend-dot" style="background:${s.color}"></span>${s.label}</span><span class="donut-legend-val">${s.value}${statusTotal?' · '+statsPct(s.value,statusTotal)+'%':''}</span></div>`).join('')}</div>
    </div>
  </div>

  <div class="stats-section">
    <div class="section-head"><h4>Produits les plus vendus</h4><span>Quantités</span></div>
    ${top.length===0?`<div style="color:var(--text-mid);font-size:13px">Pas encore de ventes enregistrées.</div>`:top.map((t,i)=>`<div class="perf-row"><div class="perf-row-head"><span class="name">#${i+1} · ${Utils.escapeHtml(t[0])}</span><span class="val">${t[1]} vendu${t[1]>1?'s':''}</span></div><div class="perf-bar-track"><div class="perf-bar-fill" style="width:${Math.round(t[1]/maxTop*100)}%;background:${i===0?'var(--mango)':'var(--indigo)'}"></div></div></div>`).join('')}
  </div>

  ${catPerf.length?`<div class="stats-section"><div class="section-head"><h4>CA par catégorie</h4></div>${catPerf.slice(0,8).map(c=>`<div class="perf-row"><div class="perf-row-head"><span class="name">${Utils.escapeHtml(c.name)}</span><span class="val">${statsMoney(c.amount)} · ${c.pct}%</span></div><div class="perf-bar-track"><div class="perf-bar-fill" style="background:var(--green);width:${c.pct}%"></div></div></div>`).join('')}</div>`:''}

  <div class="stats-section">
    <div class="section-head"><h4>Moyens de paiement</h4><span>Commandes valides</span></div>
    ${payments.length?payments.map(([k,v])=>`<div class="perf-row"><div class="perf-row-head"><span class="name">${Utils.escapeHtml(statsPaymentLabel(k))}</span><span class="val">${statsMoney(v.amount)} · ${v.count} commande${v.count>1?'s':''}</span></div><div class="perf-bar-track"><div class="perf-bar-fill" style="width:${Math.round(v.amount/maxPayment*100)}%;background:var(--indigo)"></div></div></div>`).join(''):`<div style="color:var(--text-mid);font-size:13px">Aucun paiement enregistré.</div>`}
  </div>

  <div class="stats-section">
    <div class="section-head"><h4>Clientèle</h4><span>Ce mois</span></div>
    <div class="stats-insights">
      <div class="stats-insight"><div class="n">${clientsCount}</div><div class="t">Clients</div></div>
      <div class="stats-insight"><div class="n">${newCustCur}</div><div class="t">Nouveaux</div></div>
      <div class="stats-insight"><div class="n">${returningCustomers}</div><div class="t">Récurrents</div></div>
    </div>
  </div>

  ${zones.length?`<div class="stats-section"><div class="section-head"><h4>Zones de livraison</h4><span>Activité</span></div>${zones.map(([z,v])=>`<div class="perf-row"><div class="perf-row-head"><span class="name">${Utils.escapeHtml(z)}</span><span class="val">${v.count} commande${v.count>1?'s':''} · ${statsMoney(v.amount)}</span></div></div>`).join('')}</div>`:''}
  <div class="stats-bottom"></div>`;
};

Views._after_stats = function(){ statsPeriod = 7; };
function setStatsPeriod(days){
  statsPeriod = days;
  document.querySelectorAll('.seg-btn[data-period]').forEach(b=>b.classList.toggle('active', Number(b.dataset.period)===days));
  const chartWrap = document.getElementById('stats-trend-chart');
  const titleEl = document.getElementById('stats-trend-title');
  if(!chartWrap) return;
  let data, label;
  if(days===365){ data = Store.revenueByMonth(12); label = '12 derniers mois'; }
  else { data = Store.ordersByDay(days); label = days+' derniers jours'; }
  chartWrap.innerHTML = Charts.trend(data);
  if(titleEl) titleEl.textContent = 'Revenu — '+label;
}

/* ---------- Équipe ---------- */
Views.team = function(){
  if(!Store.hasFeature('team')) return FeatureLock('Équipe', "L'ajout de membres d'équipe (gérants, vendeurs) est réservé à la formule DOYA.", 'doya');
  const team = Store.team;
  return `
  ${TopBar('Équipe', team.length+' membre(s)')}
  <div style="padding:16px 20px 0;">${team.map(m=>`
    <div class="order-row" style="border:1.5px solid var(--line);border-radius:var(--radius-md);margin-bottom:10px;padding:14px 16px;background:#fff;">
      <div class="store-logo" style="width:42px;height:42px;border-radius:12px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="var(--indigo)" stroke-width="1.7"/><path d="M4.5 20c.8-4 3.6-6.2 7.5-6.2s6.7 2.2 7.5 6.2" stroke="var(--indigo)" stroke-width="1.7" stroke-linecap="round"/></svg>
      </div>
      <div class="order-info"><h4>${Utils.escapeHtml(m.name)}</h4><div class="meta mono">${m.phone}</div></div>
      <div style="display:flex;align-items:center;gap:7px;flex:none;">
        <span class="badge ${m.role==='Admin'?'delivered':m.status==='invited'?'pending':'confirmed'}">${m.role}${m.status==='invited'?' · invité':''}</span>
        <button type="button" onclick="removeTeamMember('${m.id}')" aria-label="Retirer ${Utils.escapeHtml(m.name)}" style="width:34px;height:34px;border:1px solid var(--red-tint);background:var(--red-tint);color:var(--red);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a2 2 0 0 1-2 1.8H10a2 2 0 0 1-2-1.8L7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('')}</div>
  <div style="padding:8px 20px 10px;">
    <button class="btn btn-soft-indigo btn-block" onclick="openAddMember()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--indigo)" stroke-width="2.2" stroke-linecap="round"/></svg>Ajouter un membre</button>
  </div>
  <div style="padding:0 20px 24px;">
    <div class="section-title" style="padding-left:0;">Livreurs SIAMS</div>
    ${Store.couriers.length ? Store.couriers.map(c=>`<div class="order-row" style="border:1.5px solid var(--line);border-radius:var(--radius-md);margin-bottom:10px;padding:14px 16px;background:#fff;">
      <div class="store-logo" style="width:42px;height:42px;border-radius:12px;background:var(--green-tint);color:var(--green);">🚚</div>
      <div class="order-info"><h4>${Utils.escapeHtml(c.name||'Livreur')}</h4><div class="meta">${Utils.escapeHtml(c.phone||'')} · ${c.status==='active'?'Actif':c.status==='invited'?'Invitation envoyée':'Suspendu'}</div></div>
      <div style="display:flex;align-items:center;gap:7px;flex:none;">
        <span class="badge ${c.status==='active'?'delivered':'pending'}">${c.status==='active'?'Actif':c.status==='invited'?'En attente':'Suspendu'}</span>
        ${c.status!=='suspended' ? `<button type="button" onclick="removeCourier('${c.id}')" aria-label="Retirer ${Utils.escapeHtml(c.name||'livreur')}" style="width:34px;height:34px;border:1px solid var(--red-tint);background:var(--red-tint);color:var(--red);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a2 2 0 0 1-2 1.8H10a2 2 0 0 1-2-1.8L7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>` : ''}
      </div>
    </div>`).join('') : `<div style="border:1.5px dashed var(--line);border-radius:var(--radius-md);padding:16px;text-align:center;color:var(--text-mid);font-size:13px;">Aucun livreur connecté.</div>`}
    <button class="btn btn-soft-green btn-block" style="margin-top:10px;" onclick="inviteCourierFromMerchant()">Inviter un livreur</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="Router.go('courier-login')">Ouvrir l'espace livreur</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="shareCourierSpaceLink()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v10m0-10 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Partager le lien de l'espace livreur</button>
  </div>
  `;
};
function removeTeamMember(id){
  const member = (Store.team||[]).find(m=>m.id===id);
  if(!member) return;
  if(!confirm(`Retirer ${member.name||'ce membre'} de l'équipe ?`)) return;
  Store.team = (Store.team||[]).filter(m=>m.id!==id);
  Toast.show('Membre retiré de l’équipe');
  Router.go('team');
}
async function removeCourier(id){
  const courier = (Store.couriers||[]).find(c=>c.id===id);
  if(!courier) return;
  if(!confirm(`Retirer ${courier.name||'ce livreur'} de votre équipe de livraison ? Il devra être réinvité pour reprendre du service.`)) return;
  const btn = document.querySelector(`[onclick="removeCourier('${id}')"]`);
  if(btn){ btn.disabled=true; }
  try{
    await Cloud.removeCourier(id);
    Toast.show('Livreur retiré');
    Router.go('team');
  }catch(e){
    console.error('Retrait livreur',e);
    Toast.show(e && e.message ? `⚠️ ${e.message}` : '⚠️ Impossible de retirer ce livreur, réessayez');
    if(btn){ btn.disabled=false; }
  }
}
function openAddMember(){
  const name = prompt("Nom du membre");
  if(!name || !name.trim()) return;
  const phone = prompt("Numéro WhatsApp (ex: 07 00 00 00 00)");
  if(!phone || !phone.trim()) return;
  const role = prompt("Rôle : Admin, Gérant ou Vendeur", "Vendeur");
  const team = Store.team;
  team.push({ id:Utils.uid(), name:name.trim(), phone:phone.trim(), role: role && role.trim() ? role.trim() : 'Vendeur', status:'invited' });
  Store.team = team;
  Toast.show('Invitation envoyée ✓');
  Router.go('team');
}
function inviteCourierFromMerchant(){
  const wrap=document.createElement('div');
  wrap.id='courier-invite-overlay';
  wrap.className='overlay show';
  wrap.style.zIndex='95';
  wrap.onclick=function(e){ if(e.target===wrap) closeCourierInviteSheet(); };
  const sheet=document.createElement('div');
  sheet.id='courier-invite-sheet';
  sheet.className='sheet show';
  sheet.style.zIndex='96';
  sheet.innerHTML=`
    <div id="courier-invite-step-form">
      <h3 style="margin:0 0 4px;font-size:17px;">Inviter un livreur</h3>
      <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 16px;">Renseignez ses informations pour générer son lien d'invitation.</p>
      <div class="field" style="margin-bottom:10px;"><label>Nom complet</label><input id="courier-invite-name" placeholder="Ex. Jean Kouassi" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:10px;"></div>
      <div class="field" style="margin-bottom:16px;"><label>Numéro WhatsApp</label><input id="courier-invite-phone" inputmode="tel" placeholder="Ex. 07 00 00 00 00" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:10px;"></div>
      <button class="btn btn-primary btn-block" id="courier-invite-submit-btn" onclick="submitCourierInvite()">Générer le code</button>
      <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="closeCourierInviteSheet()">Annuler</button>
    </div>
    <div id="courier-invite-step-result" style="display:none;">
      <h3 style="margin:0 0 4px;font-size:17px;">Invitation générée ✓</h3>
      <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 14px;">Envoyez ce lien au livreur, ou copiez-le pour le partager vous-même.</p>
      <div class="field" style="margin-bottom:10px;">
        <label>Lien d'invitation</label>
        <div style="display:flex;gap:8px;">
          <input id="courier-invite-link" readonly style="flex:1;padding:12px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg,#f7f7f9);font-size:12.5px;">
          <button class="btn btn-outline btn-sm" onclick="copyCourierInviteLink()">Copier</button>
        </div>
      </div>
      <button class="btn btn-soft-green btn-block" style="margin-top:6px;" onclick="openCourierInviteWhatsApp()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>Envoyer via WhatsApp</button>
      <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="closeCourierInviteSheet()">Fermer</button>
    </div>
  `;
  document.body.appendChild(wrap);
  document.body.appendChild(sheet);
  setTimeout(()=>document.getElementById('courier-invite-name').focus(),50);
}
function closeCourierInviteSheet(){
  const wrap=document.getElementById('courier-invite-overlay');
  const sheet=document.getElementById('courier-invite-sheet');
  if(wrap) wrap.remove();
  if(sheet) sheet.remove();
}
let _courierInviteWaUrl='';
function submitCourierInvite(){
  const name=document.getElementById('courier-invite-name').value.trim();
  const phone=document.getElementById('courier-invite-phone').value.trim();
  if(!name){ Toast.show('⚠️ Indiquez le nom du livreur'); return; }
  if(!phone){ Toast.show('⚠️ Indiquez le numéro WhatsApp'); return; }
  const btn=document.getElementById('courier-invite-submit-btn');
  btn.disabled=true; btn.textContent='Génération…';
  Cloud.inviteCourier(name,phone).then(r=>{
    const x=Array.isArray(r)?r[0]:r;
    const link=location.origin+location.pathname.replace(/\/?$/,'')+'?courier_invite='+encodeURIComponent(x.invite_token);
    const msg=`Bonjour ${name}, vous êtes invité à rejoindre ${Store.store.name} comme livreur SIAMS.\n\nAcceptez votre invitation ici : ${link}\n\nAprès acceptation, un code d'accès personnel vous sera généré pour votre espace livreur.`;
    _courierInviteWaUrl='https://wa.me/225'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(msg);
    document.getElementById('courier-invite-link').value=link;
    document.getElementById('courier-invite-step-form').style.display='none';
    document.getElementById('courier-invite-step-result').style.display='block';
    Toast.show('Invitation créée ✓');
    Router.go('team');
  }).catch(e=>{
    console.error(e);
    const detail = (e && (e.message || e.error_description || e.details || e.hint)) ? `${e.message||''}\n${e.details||''}\n${e.hint||''}\n(code: ${e.code||'?'})` : JSON.stringify(e);
    alert('Erreur lors de la création de l’invitation :\n\n'+detail);
    Toast.show('⚠️ Impossible de créer l’invitation');
    btn.disabled=false; btn.textContent='Générer le code';
  });
}
function copyCourierInviteLink(){
  const input=document.getElementById('courier-invite-link');
  const done=()=>Toast.show('Lien copié ✓');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(input.value).then(done).catch(()=>{ input.select(); document.execCommand('copy'); done(); });
  } else {
    input.select(); document.execCommand('copy'); done();
  }
}
function openCourierInviteWhatsApp(){
  if(_courierInviteWaUrl) window.open(_courierInviteWaUrl,'_blank');
}
function shareCourierSpaceLink(){
  const s=Store.store;
  const link=location.origin+'/livreur';
  const text=`Espace livreur ${s.name||'SIAMS'} : connectez-vous avec votre code d'accès personnel.`;
  if(navigator.share){
    navigator.share({title:'Espace livreur',text,url:link}).catch(()=>{});
  } else {
    window.open('https://wa.me/?text='+encodeURIComponent(text+' '+link),'_blank');
  }
}

/* ---------- Paramètres ---------- */
Views.settings = function(){
  const s=Store.store;
  return `${TopBar('Paramètres','Préférences et sécurité SIAMS')}
  <div style="padding:16px 20px 24px;">
    <div class="stats-card" style="margin-bottom:12px;"><div class="stats-card-head"><h4>Compte</h4></div>
      <div style="font-size:13px;color:var(--text-mid);line-height:1.6;">Boutique : <b style="color:var(--text);">${Utils.escapeHtml(s.name)}</b><br>ID marchand SIAMS : <b class="mono">${Utils.escapeHtml(s.loginId||'—')}</b></div>
    </div>
    <div class="stats-card" style="margin-bottom:12px;"><div class="stats-card-head"><h4>Livraison</h4></div>
      <button class="btn btn-soft-green btn-block" onclick="Router.go('delivery')">Zones, tarifs et délais</button>
      <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="Router.go('team')">Livreurs et équipe</button>
    </div>
    <div class="stats-card"><div class="stats-card-head"><h4>Assistance SIAMS</h4></div>
      <button class="btn btn-soft-green btn-block" onclick="window.open('https://wa.me/qr/CP2FDOBXXD74G1?text='+encodeURIComponent('Bonjour SIAMS, j’ai besoin d’assistance depuis les paramètres de ma boutique '+Store.store.name+'.'),'_blank')">Contacter l’assistant client</button>
    </div>
  </div>`;
};

/* ---------- Espace livreur ---------- */
function courierSession(){ try{return JSON.parse(sessionStorage.getItem('siams_courier_session')||'null');}catch(e){return null;} }
function setCourierSession(v){ if(v) sessionStorage.setItem('siams_courier_session',JSON.stringify(v)); else sessionStorage.removeItem('siams_courier_session'); }

function renderCourierCodeForm(opts){
  opts=opts||{};
  return `<h1>Espace livreur</h1><p>${opts.forgot?'Entrez le code à 6 chiffres remis par la boutique pour redéfinir votre PIN.':'Connectez-vous avec le code personnel remis par la boutique.'}</p>
    <div class="field"><label>Code d'accès livreur</label><input id="courier-code" class="courier-code-input" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"></div>
    <div id="courier-login-error" style="font-size:13px;color:var(--red);margin:4px 0 10px;"></div>
    <button class="btn btn-primary btn-courier-primary btn-block" onclick="loginCourier(${opts.forgot?'true':'false'})">Se connecter</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="Router.go('welcome')">Retour à SIAMS</button>`;
}
function renderCourierInviteAcceptScreen(name,token){
  return `<h1>Espace livreur</h1><p>Bienvenue ${Utils.escapeHtml(name||'')}. Acceptez l’invitation pour créer votre accès livreur.</p>
    <button class="btn btn-primary btn-courier-primary btn-block" onclick="acceptCourierInvite('${Utils.escapeHtml(token)}')">Accepter l’invitation</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="Router.go('welcome')">Retour à SIAMS</button>`;
}
function renderCourierSetPinScreen(name){
  return `<h1 style="font-size:23px;">Créez votre code PIN</h1><p>Bonjour ${Utils.escapeHtml(name||'')}. Choisissez un code à 4 chiffres pour protéger l’accès à votre espace livreur — il vous sera redemandé à chaque ouverture du lien.</p>
    <div class="field"><label>Code PIN (4 chiffres)</label><input id="courier-pin-new" class="courier-pin-input" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"></div>
    <div class="field"><label>Confirmez le PIN</label><input id="courier-pin-new-confirm" class="courier-pin-input" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"></div>
    <div id="courier-pin-error" style="font-size:13px;color:var(--red);margin:4px 0 10px;"></div>
    <button class="btn btn-primary btn-courier-primary btn-block" onclick="submitCourierSetPin()">Valider</button>`;
}
function renderCourierPinScreen(token,name){
  return `<h1>Espace livreur</h1><p>Bonjour ${Utils.escapeHtml(name||'')}. Entrez votre code PIN pour accéder à votre espace.</p>
    <div class="field"><label>Code PIN (4 chiffres)</label><input id="courier-pin-login" class="courier-pin-input" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"></div>
    <div id="courier-pin-login-error" style="font-size:13px;color:var(--red);margin:4px 0 10px;"></div>
    <button class="btn btn-primary btn-courier-primary btn-block" onclick="submitCourierPinLogin('${Utils.escapeHtml(token)}')">Se connecter</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="forgotCourierPin()">PIN oublié ?</button>`;
}
Views['courier-login']=function(){
  const invite=new URLSearchParams(location.search).get('courier_invite');
  return `<div class="courier-auth-wrap">
    <div class="courier-auth-badge"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="M3 7.5v9L12 21l9-4.5v-9"/><path d="M12 12v9"/></svg></div>
    <div id="courier-login-body">
      ${invite?`<div style="text-align:center;padding:30px 0;"><div class="wd-spinner"></div></div>`:renderCourierCodeForm()}
    </div>
  </div>`;
};
Views['courier-invite']=Views['courier-login'];
Views._after_courier_login=function(){
  const invite=new URLSearchParams(location.search).get('courier_invite');
  if(invite) initCourierInviteFlow(invite);
};
async function initCourierInviteFlow(token){
  const body=document.getElementById('courier-login-body'); if(!body)return;
  try{
    const r=await Cloud.getCourierInviteStatus(token); const st=Array.isArray(r)?r[0]:r;
    if(st.status==='pending') body.innerHTML=renderCourierInviteAcceptScreen(st.name,token);
    else if(st.pin_required) body.innerHTML=renderCourierPinScreen(token,st.name);
    else body.innerHTML=renderCourierCodeForm();
  }catch(e){
    console.error(e);
    body.innerHTML=`<div style="text-align:center;color:var(--red);padding:20px 0;">Invitation invalide. Contactez la boutique.</div><button class="btn btn-soft-green btn-block" style="margin-top:14px;" onclick="window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent('Bonjour SIAMS, mon invitation de livreur semble invalide ou expirée. Pouvez-vous m’aider ?'),'_blank')">Contacter la boutique</button>`;
  }
}
Views['courier-dashboard']=function(){
  const sess=courierSession(); if(!sess) return Views['courier-login']();
  const name=Utils.escapeHtml(sess.name||'Livreur');
  const initials=((sess.name||'L').trim().split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('')||'L').toUpperCase();
  const online=CourierApp.isOnline();
  return `<div class="courier-dash-hero">
    <div class="courier-dash-top">
      <div class="courier-dash-id">
        <div class="courier-avatar">${initials}</div>
        <div style="min-width:0;"><div class="courier-dash-name" style="display:flex;align-items:center;gap:6px;">${name}<span id="courier-cert-badge-hero"></span></div><div class="courier-dash-sub">Espace livreur</div></div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="setCourierSession(null);Router.go('courier-login')">Déconnexion</button>
    </div>
    <div class="courier-status-row">
      <span class="courier-status-label">Statut de disponibilité</span>
      <button id="courier-online-btn" class="courier-online-toggle ${online?'online':'offline'}" onclick="CourierApp.toggleOnline()"><span class="dot"></span>${online?'En ligne':'Hors ligne'}</button>
    </div>
  </div>
  <div id="courier-page-body" style="padding:16px 20px 88px;">
    <div class="courier-tab-panel active" data-tab="dashboard">
      <div id="courier-stats-mount"><div class="courier-stats-row"><div class="courier-stat"><b>—</b><span>À traiter</span></div><div class="courier-stat"><b>—</b><span>En cours</span></div></div></div>
      <div class="section-title" style="padding:0;margin:2px 0 10px;">Missions à traiter</div>
      <div id="courier-dashboard-list"><div class="wd-spinner"></div></div>
    </div>
    <div class="courier-tab-panel" data-tab="missions">
      <div class="section-title" style="padding:0;margin:0 0 10px;">Toutes mes missions</div>
      <div id="courier-missions-list"><div class="wd-spinner"></div></div>
    </div>
    <div class="courier-tab-panel" data-tab="gains">
      <div id="courier-earnings-mount"><div class="wd-spinner"></div></div>
    </div>
    <div class="courier-tab-panel" data-tab="profil">
      <div style="text-align:center;padding:20px 10px 6px;">
        <div class="courier-avatar" style="width:64px;height:64px;border-radius:20px;background:var(--blue-tint);color:#0b67d8;font-size:20px;margin:0 auto 10px;">${initials}</div>
        <div style="font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;gap:6px;">${name}<span id="courier-cert-badge"></span></div>
        <div style="font-size:12px;color:var(--text-mid);margin-top:2px;">Espace livreur SIAMS</div>
      </div>
      <div id="courier-profile-stats" style="margin-top:16px;"><div class="courier-stats-row"><div class="courier-stat"><b>—</b><span>Acceptation</span></div><div class="courier-stat"><b>—</b><span>Missions</span></div><div class="courier-stat"><b>—</b><span>Ce mois-ci</span></div></div></div>
      <div class="section-title" style="padding:0;margin:20px 0 10px;">💰 Solde à verser à la boutique</div>
      <div id="courier-payout-list"><div class="wd-spinner"></div></div>
      <div class="section-title" style="padding:0;margin:20px 0 10px;">📋 Documents vérifiés</div>
      <div id="courier-docs-list"><div class="wd-spinner"></div></div>
      <div class="section-title" style="padding:0;margin:20px 0 10px;">⚙️ Paramètres</div>
      <div id="courier-settings-list"></div>
      <button class="btn btn-outline btn-block" style="margin-top:18px;" onclick="setCourierSession(null);Router.go('courier-login')">Se déconnecter</button>
    </div>
  </div>
  <nav class="courier-nav">
    <button class="courier-nav-btn active" data-tab="dashboard" onclick="CourierApp.setTab('dashboard')"><span class="courier-nav-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-5.5h4V20h3a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><span>Accueil</span></button>
    <button class="courier-nav-btn" data-tab="missions" onclick="CourierApp.setTab('missions')"><span class="courier-nav-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4 8h16M4 8l1.5 11a2 2 0 0 0 2 1.7h9a2 2 0 0 0 2-1.7L20 8M4 8l2-4h12l2 4M9 12v3M15 12v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Missions</span></button>
    <button class="courier-nav-btn" data-tab="gains" onclick="CourierApp.setTab('gains')"><span class="courier-nav-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="12" rx="2.4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/></svg></span><span>Gains</span></button>
    <button class="courier-nav-btn" data-tab="profil" onclick="CourierApp.setTab('profil')"><span class="courier-nav-ico"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c.8-4 3.4-6.2 7-6.2s6.2 2.2 7 6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span>Profil</span></button>
  </nav>`;
};
/* ---------- État de l'app livreur (onglet actif + statut en ligne/hors ligne) ----------
   Le statut en ligne/hors ligne est pour l'instant enregistré uniquement en local sur
   l'appareil (pas encore synchronisé côté serveur) — il sert à filtrer visuellement
   l'affichage des missions proposées au livreur. */
const CourierApp = {
  tab: 'dashboard',
  _assignments: [],
  setTab(tab){
    this.tab = tab;
    document.querySelectorAll('.courier-tab-panel').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
    document.querySelectorAll('.courier-nav-btn').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
    if(tab==='gains') loadCourierEarnings();
    if(tab==='profil') loadCourierProfileExtras();
  },
  _key(){ const sess=courierSession(); return 'siams_courier_online_'+((sess&&sess.session_token)||'x'); },
  isOnline(){ const v=localStorage.getItem(this._key()); return v===null ? true : v==='1'; },
  toggleOnline(){
    const next=!this.isOnline();
    localStorage.setItem(this._key(), next?'1':'0');
    const btn=document.getElementById('courier-online-btn');
    if(btn){ btn.className='courier-online-toggle '+(next?'online':'offline'); btn.innerHTML='<span class="dot"></span>'+(next?'En ligne':'Hors ligne'); }
    Toast.show(next?'Vous êtes en ligne ✓':'Vous êtes hors ligne');
  }
};
async function acceptCourierInvite(token){
  try{
    const r=await Cloud.courierInviteAccept(token); const x=Array.isArray(r)?r[0]:r;
    const sessRes=await Cloud.courierLogin(x.access_code); const sess=Array.isArray(sessRes)?sessRes[0]:sessRes;
    setCourierSession(sess);
    const body=document.getElementById('courier-login-body');
    if(body) body.innerHTML=renderCourierSetPinScreen(sess.name||x.name);
  }catch(e){
    console.error(e);
    Toast.show('⚠️ Invitation invalide ou expirée');
  }
}
async function loginCourier(forceReset){
  const code=(document.getElementById('courier-code')?.value||'').trim(); const err=document.getElementById('courier-login-error');
  if(!err){ /* formulaire pas encore affiché */ }
  if(!/^\d{6}$/.test(code)){ if(err) err.textContent='Entrez le code à 6 chiffres remis par la boutique.'; return; }
  try{
    const r=await Cloud.courierLogin(code); const x=Array.isArray(r)?r[0]:r; setCourierSession(x);
    if(!x.pin_set || forceReset){
      const body=document.getElementById('courier-login-body');
      if(body){ body.innerHTML=renderCourierSetPinScreen(x.name); return; }
    }
    Router.go('courier-dashboard'); AutoSync.start();
  }catch(e){ console.error(e); if(err) err.textContent='Code invalide ou accès suspendu.'; }
}
async function submitCourierSetPin(){
  const p1=(document.getElementById('courier-pin-new')?.value||'').trim();
  const p2=(document.getElementById('courier-pin-new-confirm')?.value||'').trim();
  const err=document.getElementById('courier-pin-error');
  if(!/^\d{4}$/.test(p1)){err.textContent='Le PIN doit contenir 4 chiffres.';return;}
  if(p1!==p2){err.textContent='Les deux codes ne correspondent pas.';return;}
  const sess=courierSession();
  if(!sess){err.textContent='Session expirée, rouvrez le lien.';return;}
  try{
    await Cloud.courierSetPin(sess.session_token,p1);
    Toast.show('PIN enregistré ✓');
    Router.go('courier-dashboard'); AutoSync.start();
  }catch(e){ console.error(e); err.textContent='Impossible d’enregistrer le PIN.'; }
}
async function submitCourierPinLogin(token){
  const pin=(document.getElementById('courier-pin-login')?.value||'').trim();
  const err=document.getElementById('courier-pin-login-error');
  if(!/^\d{4}$/.test(pin)){err.textContent='Entrez les 4 chiffres de votre PIN.';return;}
  try{
    const r=await Cloud.courierLoginPin(token,pin); const x=Array.isArray(r)?r[0]:r;
    setCourierSession(x);
    Router.go('courier-dashboard'); AutoSync.start();
  }catch(e){
    console.error(e);
    const msg=(e&&e.message)||'';
    err.textContent=/Trop de tentatives/i.test(msg)?'Trop d’essais. Réessayez dans quelques minutes.':'PIN incorrect.';
  }
}
function forgotCourierPin(){
  const body=document.getElementById('courier-login-body');
  if(body) body.innerHTML=renderCourierCodeForm({forgot:true});
}
const ICO_MONEY_SVG='<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="12" rx="2.4" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICO_PIN_SVG='<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICO_CLOCK_SVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex:none;"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---- Délai de réponse à une mission proposée : si le livreur n'accepte ni ne refuse
   dans ce délai, la mission est automatiquement remise à disposition de la boutique
   pour être proposée à un autre livreur (voir declineCourierDelivery silencieux
   ci-dessous et MissionOfferPopup pour la variante en popup). ---- */
const COURIER_OFFER_TIMEOUT_MS = 10*60*1000;
function courierOfferDeadline(id){
  const key='siams_mission_deadline_'+id;
  let d=Number(sessionStorage.getItem(key)||0);
  if(!d || d<Date.now()){ d=Date.now()+COURIER_OFFER_TIMEOUT_MS; sessionStorage.setItem(key,String(d)); }
  return d;
}
function courierTickOfferTimers(){
  document.querySelectorAll('[data-courier-timer]').forEach(el=>{
    const id=el.getAttribute('data-courier-timer');
    const deadline=courierOfferDeadline(id);
    const remain=deadline-Date.now();
    const span=el.querySelector('span');
    if(remain<=0){
      el.classList.add('low');
      if(span) span.textContent='Délai dépassé — réaffectation…';
      if(!el.dataset.expiredHandled){ el.dataset.expiredHandled='1'; declineCourierDelivery(id, true); }
      return;
    }
    const m=Math.floor(remain/60000), s=Math.floor((remain%60000)/1000);
    if(span) span.textContent='Réponse attendue sous '+m+':'+String(s).padStart(2,'0');
    el.classList.toggle('low', remain<60000);
  });
}
if(!window._courierTimerInterval) window._courierTimerInterval=setInterval(courierTickOfferTimers,1000);

/* ---- Distance à parcourir : calculée côté appareil (formule de Haversine) entre la
   position GPS actuelle du livreur et les coordonnées du client, sans appel serveur. ---- */
function courierHaversineKm(lat1,lon1,lat2,lon2){
  const toRad=d=>d*Math.PI/180, R=6371;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}
let _courierLastPos=null,_courierLastPosAt=0;
function courierUpdateCardDistances(rows){
  if(!navigator.geolocation) return;
  const apply=coords=>{
    _courierLastPos=coords; _courierLastPosAt=Date.now();
    rows.forEach(a=>{
      const el=document.getElementById('courier-dist-'+a.id); if(!el) return;
      if(a.customer_latitude==null||a.customer_longitude==null){ el.textContent='—'; return; }
      const km=courierHaversineKm(coords.latitude,coords.longitude,Number(a.customer_latitude),Number(a.customer_longitude));
      el.textContent = km<1 ? Math.round(km*1000)+' m' : km.toFixed(1)+' km';
    });
  };
  if(_courierLastPos && Date.now()-_courierLastPosAt<60000){ apply(_courierLastPos); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>apply(pos.coords),
    ()=>rows.forEach(a=>{ const el=document.getElementById('courier-dist-'+a.id); if(el) el.textContent='GPS requis'; }),
    {enableHighAccuracy:true,maximumAge:60000,timeout:10000}
  );
}
function courierAssignmentCard(a){
  const offered=a.status==='offered', accepted=a.status==='accepted';
  return `<div class="courier-card ${accepted?'accepted':''}"><div class="courier-card-head"><div><div class="courier-card-order">Commande #${Utils.escapeHtml(a.order_number||'')}</div><div class="courier-card-meta">${Utils.escapeHtml(a.customer_name||'')} · ${Utils.escapeHtml(a.customer_address||'')}</div></div><span class="courier-card-status ${accepted?'accepted':'offered'}">${offered?'Proposée':accepted?'Acceptée':a.status}</span></div>
      <div class="courier-card-info-row">
        <div class="courier-card-info-chip"><span class="ico-round green">${ICO_MONEY_SVG}</span><div class="txt"><b>${a.amount!=null?Utils.fmtFCFA(a.amount):'—'}</b><span>Montant</span></div></div>
        <div class="courier-card-info-chip"><span class="ico-round blue">${ICO_PIN_SVG}</span><div class="txt"><b id="courier-dist-${a.id}">…</b><span>Distance</span></div></div>
      </div>
      ${offered?`<div class="courier-card-timer" data-courier-timer="${a.id}">${ICO_CLOCK_SVG}<span>Réponse attendue sous 10:00</span></div>`:''}
      <div class="courier-card-actions">
      ${offered?`<div class="field"><label>Délai estimé</label><select id="eta-${a.id}"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option></select></div><div class="courier-card-actions-row"><button class="btn btn-outline" onclick="declineCourierDelivery('${a.id}')">✕ Ignorer</button><button class="btn btn-primary btn-courier-primary" onclick="acceptCourierDelivery('${a.id}')">✓ Accepter</button></div>`:''}
      ${accepted?`<div class="courier-progress-note">✓ Livraison acceptée. Le client et la boutique ont été informés.</div><button class="btn btn-primary btn-courier-primary btn-block" onclick="CourierMission.open('${a.id}')">Voir la mission ›</button><button class="btn btn-soft-indigo btn-block" onclick="startCourierLiveGps('${a.id}')">Démarrer mon GPS</button><button class="btn btn-soft-green btn-block" onclick="courierDelivered('${a.id}')">Marquer la livraison effectuée</button>`:''}
      <button class="btn btn-outline btn-block" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((a.customer_latitude||'')+','+(a.customer_longitude||'')),'_blank')">Itinéraire</button>
      </div>
    </div>`;
}
async function declineCourierDelivery(id, silent){
  const sess=courierSession(); if(!sess) return;
  const btns=document.querySelectorAll(`[data-courier-timer="${id}"]`);
  try{
    await Cloud.courierDeclineAssignment(sess.session_token, id);
    sessionStorage.removeItem('siams_mission_deadline_'+id);
    Toast.show(silent?'Délai dépassé — mission réaffectée à un autre livreur':'Mission ignorée — elle sera proposée à un autre livreur');
    loadCourierDashboard();
  }catch(e){
    console.error('Refus mission (liste)',e);
    if(!silent) Toast.show('⚠️ Impossible d’ignorer cette mission pour le moment');
  }
}
async function loadCourierDashboard(){
  const sess=courierSession();
  const statsMount=document.getElementById('courier-stats-mount');
  const dashList=document.getElementById('courier-dashboard-list');
  const missionsList=document.getElementById('courier-missions-list');
  if(!sess||(!statsMount&&!dashList&&!missionsList))return;
  try{
    const rows=await Cloud.courierAssignments(sess.session_token);
    CourierApp._assignments = rows;
    const offered=rows.filter(a=>a.status==='offered');
    const accepted=rows.filter(a=>a.status==='accepted');
    if(statsMount) statsMount.innerHTML=`<div class="courier-stats-row"><div class="courier-stat"><b>${offered.length}</b><span>À traiter</span></div><div class="courier-stat"><b>${accepted.length}</b><span>En cours</span></div></div>`;
    const emptyState=EmptyState(`<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 7.5v9L12 21l9-4.5v-9" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,'Aucune livraison pour le moment','Les nouvelles courses proposées par la boutique apparaîtront ici.');
    if(dashList){
      const toShow=[...offered,...accepted];
      dashList.innerHTML = toShow.length ? toShow.map(courierAssignmentCard).join('') : emptyState;
    }
    if(missionsList){
      missionsList.innerHTML = rows.length ? rows.map(courierAssignmentCard).join('') : emptyState;
    }
    courierUpdateCardDistances([...offered,...accepted]);
    CourierMission.refresh();
  }catch(e){
    console.error(e);
    const errHtml='<div style="color:var(--red);padding:20px;">Impossible de charger les livraisons.</div>';
    if(dashList) dashList.innerHTML=errHtml;
    if(missionsList) missionsList.innerHTML=errHtml;
  }
}
/* ---- Acceptation d'une mission proposée. Le détail d'erreur exact renvoyé par Supabase
   (message/code/hint/details) est systématiquement affiché dans le Toast : c'est ce texte,
   copié tel quel, qu'il faut relire pour diagnostiquer un refus d'acceptation côté serveur
   (fonction RPC courier_accept_assignment) — un simple "Erreur inconnue" générique ne
   suffit pas à savoir si la mission a déjà été prise, si le livreur est suspendu, etc. ---- */
async function acceptCourierDelivery(id){
  const sess=courierSession(); const eta=document.getElementById('eta-'+id)?.value||60;
  try{
    await Cloud.courierAcceptAssignment(sess.session_token,id,eta);
    sessionStorage.removeItem('siams_mission_deadline_'+id);
    Toast.show('Livraison acceptée ✓');
    loadCourierDashboard();
  }catch(e){
    console.error('Acceptation mission (liste)',e);
    const detail=(e&&(e.message||e.error_description||e.hint||e.details))||('code '+(e&&e.code||'inconnu'));
    Toast.show('⚠️ '+detail);
  }
}
let courierWatchId=null, courierLastSent=0, courierTrackingId=null, courierGpsErrorShown=false;
/* CORRECTIF : le toast "Suivi GPS livreur activé ✓" s'affichait dès le démarrage de
   watchPosition, indépendamment du succès réel de l'envoi de la position vers Supabase.
   Si l'appel RPC courier_update_location échouait (fonction absente côté base, RLS,
   paramètres invalides, etc.), l'erreur finissait uniquement dans console.error : le
   livreur croyait son GPS actif et la boutique ne recevait jamais aucune position, sans
   qu'aucune des deux parties ne soit prévenue. On affiche désormais l'erreur au livreur
   dès la première tentative ratée (throttlée pour ne pas spammer), afin que le problème
   soit visible immédiatement au lieu de rester silencieux. */
function startCourierLiveGps(assignmentId){
  const sess=courierSession(); if(!sess||!navigator.geolocation){Toast.show('GPS indisponible');return;}
  if(courierWatchId!==null) navigator.geolocation.clearWatch(courierWatchId);
  courierTrackingId=assignmentId;
  courierGpsErrorShown=false;
  courierWatchId=navigator.geolocation.watchPosition(async pos=>{
    /* Met à jour le marqueur/la distance sur la carte à chaque position reçue — indépendant
       du throttle réseau ci-dessous qui ne concerne que l'envoi vers Supabase. */
    if(typeof CourierMission!=='undefined' && typeof CourierMission.updateCourierPosition==='function' && String(courierTrackingId)===String(assignmentId)){
      CourierMission.updateCourierPosition(pos.coords.latitude,pos.coords.longitude);
    }
    const now=Date.now(); if(now-courierLastSent<5000)return; courierLastSent=now;
    try{
      await Cloud.courierUpdateLocation(sess.session_token,assignmentId,pos.coords.latitude,pos.coords.longitude,pos.coords.accuracy,pos.coords.heading,pos.coords.speed);
      courierGpsErrorShown=false;
    }catch(e){
      console.error('GPS livreur',e);
      if(!courierGpsErrorShown){
        courierGpsErrorShown=true;
        const detail=(e&&(e.message||e.error_description||e.hint||e.details))||('code '+(e&&e.code||'inconnu'));
        Toast.show('⚠️ Position non transmise : '+detail);
      }
    }
  }, err=>Toast.show(err.code===1?'Autorisez la localisation pour le suivi du livreur.':'GPS indisponible'), {enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  Toast.show('Suivi GPS livreur activé ✓');
  CourierMission.refresh();
}
async function courierDelivered(id){ const sess=courierSession(); try{await Cloud.courierMarkDelivered(sess.session_token,id); if(courierWatchId!==null){navigator.geolocation.clearWatch(courierWatchId);courierWatchId=null;courierTrackingId=null;} Toast.show('Livraison signalée ✓'); CourierMission.close(); loadCourierDashboard();}catch(e){console.error(e);Toast.show('⚠️ Impossible de clôturer la livraison');} }

/* =========================================================
   Reversement à la boutique — espèces "paiement à la livraison"
   encaissées par le livreur. Un livreur qui a livré une commande
   payée en cash doit ce montant à la boutique ; il déclare son
   virement et joint un reçu, la boutique confirme réception et le
   solde correspondant est remis à zéro (voir Cloud.courierCashDue,
   Cloud.courierSubmitPayoutReceipt, migration_courier_payouts.sql).
   Si la boutique ne réagit pas sous 1h, la fonction SQL
   courier_get_cash_due considère le versement confirmé automatiquement. */
(function(){
  'use strict';
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};

  async function loadCourierPayoutSection(){
    const mount=document.getElementById('courier-payout-list');
    const sess=courierSession();
    if(!mount||!sess) return;
    try{
      const rows=await Cloud.courierCashDue(sess.session_token);
      window._courierPayoutRows = rows||[];
      mount.innerHTML = renderCourierPayoutSection(rows||[]);
    }catch(e){
      console.error('Solde livreur',e);
      mount.innerHTML = '<div style="font-size:11.5px;color:var(--text-soft);padding:4px 2px;">Solde bientôt disponible.</div>';
    }
  }

  function renderCourierPayoutSection(rows){
    const due = rows.filter(r=>r.status!=='confirmed');
    const total = due.reduce((s,r)=>s+Number(r.amount||0),0);
    if(!rows.length){
      return `<div style="font-size:11.5px;color:var(--text-mid);padding:4px 2px;">Aucune espèce en attente de reversement. Ce solde apparaît automatiquement après chaque livraison réglée en paiement à la livraison.</div>`;
    }
    const hero = total>0
      ? `<div class="courier-payout-hero"><span>Montant à reverser à la boutique</span><b>${Utils.fmtFCFA(total)}</b><small>Effectuez le virement puis joignez votre reçu ci-dessous. La boutique confirme réception ; le solde est remis à zéro automatiquement.</small></div>`
      : `<div style="font-size:11.5px;color:var(--green);font-weight:700;padding:4px 2px;">✓ Tout est à jour, aucun solde en attente.</div>`;
    const list = rows.map(r=>{
      const submitted = r.status==='submitted';
      return `<div class="courier-payout-row">
        <div class="courier-payout-row-head">
          <div><b style="font-size:12.5px;">Commande #${esc(r.order_number||'')}</b><div style="font-size:11px;color:var(--text-mid);margin-top:2px;">${Utils.fmtFCFA(r.amount)}</div></div>
          <span class="courier-payout-status ${submitted?'sub':'wait'}">${submitted?'Reçu envoyé · en attente':'À reverser'}</span>
        </div>
        ${submitted?`<div style="font-size:10.5px;color:var(--text-soft);margin-top:6px;">Confirmation boutique attendue sous 1h.</div>`:`<button class="btn btn-primary btn-sm btn-block" style="margin-top:9px;" onclick="CourierPayout.openSubmit('${esc(r.order_id)}','${esc(r.order_number||'')}',${Number(r.amount)||0})">Joindre mon reçu de virement</button>`}
      </div>`;
    }).join('');
    return hero + list;
  }

  window.CourierPayout = {
    openSubmit(orderId, orderNumber, amount){
      const w=document.createElement('div'); w.id='courier-payout-sheet';
      w.innerHTML=`<div class="shop-sheet-overlay show" onclick="document.getElementById('courier-payout-sheet')?.remove()"></div>
      <div class="shop-sheet show">
        <div class="sheet-handle"></div>
        <h3>Reçu de virement — Commande #${esc(orderNumber)}</h3>
        <p style="font-size:12px;color:var(--text-mid);margin:0 0 12px;">Montant à reverser : <strong>${Utils.fmtFCFA(amount)}</strong>. Joignez une capture d'écran ou une photo du reçu de votre virement à la boutique.</p>
        <label class="btn btn-outline btn-block" style="cursor:pointer;">📎 Choisir le reçu<input type="file" accept="image/*" class="hidden" onchange="CourierPayout.handleFile(event)"></label>
        <div id="courier-payout-preview" style="margin-top:10px;"></div>
        <button id="courier-payout-submit-btn" class="btn btn-primary btn-block" style="margin-top:14px;" disabled onclick="CourierPayout.submit('${esc(orderId)}')">Envoyer le reçu</button>
      </div>`;
      document.body.appendChild(w);
    },
    _dataUrl:null,
    handleFile(evt){
      const f=evt.target.files&&evt.target.files[0]; if(!f) return;
      const reader=new FileReader();
      reader.onload=()=>{
        this._dataUrl=reader.result;
        const p=document.getElementById('courier-payout-preview');
        if(p) p.innerHTML=`<img src="${reader.result}" style="width:100%;border-radius:12px;border:1px solid var(--line);">`;
        const btn=document.getElementById('courier-payout-submit-btn'); if(btn) btn.disabled=false;
      };
      reader.readAsDataURL(f);
    },
    async submit(orderId){
      if(!this._dataUrl){ Toast.show('Ajoutez la photo du reçu'); return; }
      const btn=document.getElementById('courier-payout-submit-btn'); if(btn){btn.disabled=true;btn.textContent='Envoi…';}
      try{
        const sess=courierSession(); if(!sess) throw new Error('Session expirée');
        await Cloud.courierSubmitPayoutReceipt(sess.session_token, orderId, this._dataUrl);
        Toast.show('Reçu envoyé ✓ En attente de confirmation de la boutique');
        this._dataUrl=null;
        document.getElementById('courier-payout-sheet')?.remove();
        loadCourierPayoutSection();
      }catch(e){
        console.error('Envoi reçu reversement',e);
        Toast.show('⚠️ '+((e&&e.message)||'Impossible d’envoyer le reçu'));
        if(btn){btn.disabled=false;btn.textContent='Envoyer le reçu';}
      }
    }
  };

  window.loadCourierPayoutSection = loadCourierPayoutSection;
})();

/* ---------- Écran Gains livreur ----------
   S'appuie sur Cloud.courierEarnings(), qui appelle la fonction SQL
   courier_get_earnings (voir migration_courier_earnings.sql). Tant que cette
   fonction n'est pas déployée côté Supabase, l'appel échoue et on affiche un
   état d'attente honnête plutôt qu'un montant inventé — même discipline que
   pour les autres sections avec repli gracieux (dashboard admin, etc.). ---------- */
let courierEarningsData = null, courierEarningsPeriod = 'today';
async function loadCourierEarnings(){
  const mount=document.getElementById('courier-earnings-mount');
  const sess=courierSession();
  if(!mount||!sess) return;
  if(!courierEarningsData) mount.innerHTML='<div class="wd-spinner"></div>';
  try{
    const data=await Cloud.courierEarnings(sess.session_token);
    courierEarningsData = data;
    mount.innerHTML = renderCourierEarnings(data);
  }catch(e){
    console.error('courierEarnings',e);
    mount.innerHTML = `<div class="courier-tab-empty-note" style="padding:64px 10px 10px;">
      <div style="font-size:34px;margin-bottom:8px;">💰</div>
      <b style="display:block;color:var(--text);font-size:14px;margin-bottom:4px;">Gains bientôt disponibles</b>
      Cette fonctionnalité attend une mise à jour côté serveur. Contactez l'assistant SIAMS si ce message persiste.
    </div>`;
  }
}
function setCourierEarningsPeriod(p){
  courierEarningsPeriod = p;
  const mount=document.getElementById('courier-earnings-mount');
  if(mount && courierEarningsData) mount.innerHTML = renderCourierEarnings(courierEarningsData);
}
function renderCourierEarnings(d){
  const money=v=>Utils.fmtFCFA(Number(v||0));
  const periods = [['today','Jour'],['week','Semaine'],['month','Mois'],['total_paid','Total']];
  const amount = d[courierEarningsPeriod] ?? 0;
  const history = Array.isArray(d.history) ? d.history : [];
  const statusLabel = s => s==='paid' ? 'Payé' : s==='pending' ? 'En attente' : s;
  const statusClass = s => s==='paid' ? 'paid' : 'pending';
  const historyHtml = history.length ? history.map(h=>`
    <div class="courier-earn-row">
      <div>
        <div class="courier-earn-row-title">Commande #${Utils.escapeHtml(h.order_number||'')}</div>
        <div class="courier-earn-row-sub">${Utils.escapeHtml(h.customer_name||'')} · ${h.created_at?Utils.timeAgo(new Date(h.created_at).getTime()):''}</div>
      </div>
      <div style="text-align:right;">
        <div class="courier-earn-row-amount">${money(h.amount)}</div>
        <span class="courier-earn-status ${statusClass(h.status)}">${statusLabel(h.status)}</span>
      </div>
    </div>`).join('') : EmptyState(`<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,'Aucun gain pour le moment','Vos livraisons rémunérées apparaîtront ici au fur et à mesure.');
  return `
    <div class="courier-earn-period-tabs">
      ${periods.map(([key,label])=>`<button class="courier-earn-period-btn ${courierEarningsPeriod===key?'active':''}" onclick="setCourierEarningsPeriod('${key}')">${label}</button>`).join('')}
    </div>
    <div class="courier-earn-hero">
      <div class="courier-earn-hero-label">${periods.find(p=>p[0]===courierEarningsPeriod)?.[1]||''}</div>
      <div class="courier-earn-hero-amount">${money(amount)}</div>
      ${Number(d.pending||0)>0?`<div class="courier-earn-hero-pending">+ ${money(d.pending)} en attente de versement</div>`:''}
    </div>
    <div class="section-title" style="padding:0;margin:18px 0 10px;">Historique</div>
    ${historyHtml}`;
}

/* ---------- Écran « Mission active » : overlay plein écran pour une livraison
   acceptée, ouvert depuis courierAssignmentCard(). Réutilise les fonctions
   existantes (startCourierLiveGps, courierDelivered) — aucune logique de
   livraison n'est dupliquée ici, seulement l'affichage. Le téléphone client
   n'est affiché que si la donnée existe côté serveur (dégradation propre si
   le champ n'est pas encore exposé par courier_get_assignments). ---------- */
const CourierMission = {
  openId: null,
  _assignments(){ return CourierApp._assignments || []; },
  find(id){ return this._assignments().find(a=>String(a.id)===String(id)); },
  open(id){
    const a=this.find(id);
    if(!a){ Toast.show('Mission introuvable, actualisation…'); loadCourierDashboard(); return; }
    this.openId=id;
    let el=document.getElementById('courier-mission-overlay');
    if(!el){ el=document.createElement('div'); el.id='courier-mission-overlay'; el.className='courier-mission-overlay'; document.body.appendChild(el); }
    el.innerHTML=this._render(a);
  },
  close(){
    this.openId=null;
    if(courierWatchId!==null){ /* on laisse le GPS actif si le livreur ferme juste l'écran, il continue de suivre la course en cours */ }
    const el=document.getElementById('courier-mission-overlay');
    if(el) el.remove();
  },
  refresh(){
    if(!this.openId) return;
    const a=this.find(this.openId);
    const el=document.getElementById('courier-mission-overlay');
    if(!a){ this.close(); return; }
    if(el) el.innerHTML=this._render(a);
  },
  _render(a){
    const name=Utils.escapeHtml(a.customer_name||'Client');
    const addr=Utils.escapeHtml(a.customer_address||'Adresse non renseignée');
    const phone=(a.customer_phone||'').trim();
    const gpsOn = courierWatchId!==null && String(courierTrackingId)===String(a.id);
    const delivered = a.status!=='accepted' && a.status!=='offered';
    const mapsUrl='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((a.customer_latitude||'')+','+(a.customer_longitude||''));
    const since = a.updated_at ? Utils.timeAgo(new Date(a.updated_at).getTime()) : '';
    return `
      <div class="courier-mission-head">
        <div class="courier-mission-head-row">
          <button class="courier-mission-back" onclick="CourierMission.close()" aria-label="Retour"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 19 8 12l7-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div><div class="courier-mission-title">Commande #${Utils.escapeHtml(a.order_number||'')}</div><div class="courier-mission-sub">${delivered?'Livraison effectuée':(since?'Acceptée '+since:'Livraison en cours')}</div></div>
        </div>
        <div class="courier-mission-steps">
          <div class="courier-mission-step done"><div class="courier-mission-step-dot">✓</div><span>Acceptée</span></div>
          <div class="courier-mission-step-line ${gpsOn||delivered?'done':''}"></div>
          <div class="courier-mission-step ${gpsOn?'current':''} ${delivered?'done':''}"><div class="courier-mission-step-dot">${delivered?'✓':'2'}</div><span>En route</span></div>
          <div class="courier-mission-step-line ${delivered?'done':''}"></div>
          <div class="courier-mission-step ${delivered?'done':''}"><div class="courier-mission-step-dot">${delivered?'✓':'3'}</div><span>Livrée</span></div>
        </div>
      </div>
      <div class="courier-mission-body">
        <div class="courier-mission-card">
          <h4>Client</h4>
          <div class="courier-mission-client-name">${name}</div>
          <div class="courier-mission-client-addr">📍 ${addr}</div>
          ${phone?`<div class="courier-mission-contact-row"><button class="btn btn-soft-green" onclick="window.open('tel:${Utils.escapeHtml(phone)}','_self')">📞 Appeler</button><button class="btn btn-outline" onclick="window.open('https://wa.me/${Utils.escapeHtml(phone.replace(/\\D/g,''))}','_blank')">WhatsApp</button></div>`:''}
        </div>
        <div class="courier-mission-card">
          <h4>Suivi GPS</h4>
          <span class="courier-mission-gps-badge ${gpsOn?'':'off'}"><span class="dot"></span>${gpsOn?'Position partagée en direct':'GPS non démarré'}</span>
        </div>
      </div>
      <div class="courier-mission-actions">
        <button class="btn btn-outline btn-block" onclick="window.open('${mapsUrl}','_blank')">Itinéraire</button>
        ${!delivered?`<button class="btn btn-soft-indigo btn-block" onclick="startCourierLiveGps('${a.id}')">${gpsOn?'GPS actif — relancer':'Démarrer mon GPS'}</button><button class="btn btn-primary btn-courier-primary btn-block" onclick="courierDelivered('${a.id}')">Marquer la livraison effectuée</button>`:`<button class="btn btn-primary btn-courier-primary btn-block" onclick="CourierMission.close()">Retour aux missions</button>`}
      </div>`;
  }
};

/* ---------- Paiement ---------- */
Views.payment = function(){
  const p = Store.payment;
  const statusBadge = (m)=>{
    if(!m.enabled || !m.number) return '';
    if(m.validated) return `<span style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--green-tint);color:var(--green);">Vérifié ✓</span>`;
    return `<span style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--mango-tint);color:var(--mango-dark);">En attente</span>`;
  };
  const row = (key,label,icon)=>`
    <div class="payment-method-card">
      <div class="toggle-row" style="border:none;padding:0;">
        <span style="display:flex;align-items:center;gap:10px;font-weight:750;">${icon}<span>${label}</span>${statusBadge(p[key])}</span>
        <label class="switch"><input type="checkbox" id="pm-${key}" ${p[key].enabled?'checked':''} onchange="togglePaymentMethod('${key}')"><span class="slider"></span></label>
      </div>
      <div id="pm-${key}-num" class="${p[key].enabled?'':'hidden'}" style="margin-top:12px;">
        <input type="text" id="pm-${key}-input" placeholder="Numéro marchand ${label}" value="${p[key].number||''}" style="width:100%;border:1.5px solid var(--line);border-radius:11px;padding:12px 14px;font-size:14px;font-family:var(--font-body);margin-bottom:9px;box-sizing:border-box;">
        <input type="url" id="pm-${key}-link" placeholder="Lien de paiement (optionnel)" value="${p[key].link||''}" style="width:100%;border:1.5px solid var(--line);border-radius:11px;padding:12px 14px;font-size:14px;font-family:var(--font-body);margin-bottom:9px;box-sizing:border-box;">
        <button type="button" class="btn btn-soft-indigo btn-block" onclick="savePaymentNumber('${key}')">Enregistrer ${label}</button>
      </div>
    </div>`;
  const active=['wave','om','mtn','moov'].filter(k=>p[k].enabled&&p[k].number).length;
  return `
    ${TopBar('Paiement','Moyens d’encaissement')}
    <div class="payment-head"><div class="eyebrow">Encaissement</div><h2>Paiements de votre boutique</h2><p>Choisissez comment vos clients peuvent vous payer.</p></div>
    <div class="payment-hero"><div class="label">Moyens mobiles configurés</div><div class="title">${active} / 4 actifs</div><div style="font-size:11.5px;color:var(--text-mid);margin-top:4px;">Les paiements sont envoyés directement sur vos comptes marchands.</div></div>
    <div style="padding:0 20px 4px;">
      ${row('wave','Wave','')}
      ${row('om','Orange Money','')}
      ${row('mtn','MTN Money','')}
      ${row('moov','Moov Money','')}
      <div class="payment-method-card"><div class="toggle-row" style="border:none;padding:0;"><span style="font-weight:750;">Paiement à la livraison <span style="font-size:10.5px;color:var(--text-mid);font-weight:500;">(cash)</span></span><label class="switch"><input type="checkbox" id="pm-cash" ${p.cash.enabled?'checked':''} onchange="togglePaymentMethod('cash')"><span class="slider"></span></label></div></div>
    </div>
    <div class="payment-security" style="border:1.5px solid var(--green);padding:14px 16px;background:var(--green-tint);">
      <div style="display:flex;align-items:center;gap:8px;font-weight:750;font-size:13.5px;margin-bottom:6px;color:var(--green);">Paiements directs et sécurisés</div>
      <p style="font-size:12px;color:var(--text-mid);margin:0;line-height:1.55;">Les moyens mobiles activés encaissent directement sur votre numéro marchand. SIAMS ne reçoit ni ne conserve ces paiements.</p>
    </div>
    <div class="payment-note">Les moyens activés seront proposés à vos clients au moment du paiement dans votre boutique.</div>
  `;
};

function togglePaymentMethod(key){
  const p = Store.payment;
  p[key].enabled = document.getElementById('pm-'+key).checked;
  if(p[key].enabled && p[key].number){
    p[key].validated = true;
    p[key].validatedAt = p[key].validatedAt || Date.now();
  }
  Store.payment = p;
  const numWrap = document.getElementById('pm-'+key+'-num');
  if(numWrap) numWrap.classList.toggle('hidden', !p[key].enabled);
}
function savePaymentNumber(key){
  const p = Store.payment;
  const prevNumber = p[key].number || '';
  const prevLink = p[key].link || '';
  p[key].number = document.getElementById('pm-'+key+'-input').value.trim();
  const linkInput = document.getElementById('pm-'+key+'-link');
  p[key].link = linkInput ? linkInput.value.trim() : '';
  if(p[key].number !== prevNumber || p[key].link !== prevLink){
    p[key].validated = !!p[key].number;
    p[key].validatedAt = p[key].number ? Date.now() : 0;
  } else if(p[key].number){
    // Un numéro déjà renseigné reste immédiatement disponible.
    p[key].validated = true;
    p[key].validatedAt = p[key].validatedAt || Date.now();
  }
  p[key].enabled = true;
  Store.payment = p;
  Toast.show(p[key].number ? 'Moyen de paiement activé ✓' : 'Numéro enregistré');
  Router.go('payment');
}

/* ---------- Catégories ---------- */
Views.categories = function(){
  const cats = Store.categories;
  const products = Store.products;
  const photos = Store.categoryPhotos;
  return `
  ${TopBar('Catégories', cats.length+' catégorie(s)')}
  <div style="padding:16px 20px 0;">
    ${cats.map(c=>{
      const count = products.filter(p=>p.category===c).length;
      const cid = 'catphoto-' + Utils.escapeHtml(c).replace(/[^a-zA-Z0-9]/g,'_');
      const photo = photos[c];
      return `
      <div style="display:flex;align-items:center;gap:14px;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px;background:#fff;">
        <div style="position:relative;flex:none;">
          <div class="store-logo" style="width:44px;height:44px;border-radius:11px;overflow:hidden;cursor:pointer;" onclick="document.getElementById('${cid}-input').click()">
            ${photo ? `<img src="${Utils.escapeHtml(photo)}" style="width:100%;height:100%;object-fit:cover;">` : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="var(--indigo)" stroke-width="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="var(--indigo)" stroke-width="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="var(--indigo)" stroke-width="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="var(--indigo)" stroke-width="1.7"/></svg>`}
          </div>
          <input type="file" id="${cid}-input" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="handleCategoryPhoto(event,'${Utils.escapeHtml(c)}','${cid}')">
        </div>
        <div style="flex:1;"><h4 style="margin:0 0 2px;font-size:14.5px;font-weight:700;">${Utils.escapeHtml(c)}</h4><span style="font-size:12px;color:var(--text-mid);">${count} produit(s)</span>
          <div style="margin-top:4px;display:flex;gap:12px;">
            <button onclick="document.getElementById('${cid}-input').click()" style="background:none;border:none;color:var(--indigo);font-size:11.5px;font-weight:700;cursor:pointer;padding:0;">${photo?'Changer la photo':'Ajouter une photo'}</button>
            ${photo?`<button onclick="removeCategoryPhoto('${Utils.escapeHtml(c)}')" style="background:none;border:none;color:var(--red);font-size:11.5px;font-weight:700;cursor:pointer;padding:0;">Retirer</button>`:''}
          </div>
        </div>
        <button onclick="deleteCategory('${Utils.escapeHtml(c)}')" style="background:none;border:none;color:var(--text-soft);cursor:pointer;padding:6px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a2 2 0 0 1-2 1.8H10a2 2 0 0 1-2-1.8L7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>`;
    }).join('')}
  </div>
  <div style="padding:8px 20px 24px;"><button class="btn btn-soft-indigo btn-block" onclick="addCategory()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--indigo)" stroke-width="2.2" stroke-linecap="round"/></svg>Ajouter une catégorie</button></div>
  `;
};
function handleCategoryPhoto(e, name, cid){
  const file = e.target.files[0];
  if(!file) return;
  siamsPrepareImageDataURL(file).then(async dataUrl=>{
    try{
      await Cloud.setCategoryPhoto(name, dataUrl);
      Toast.show('Photo enregistrée ✓');
      Router.go('categories');
    }catch(err){ console.error(err); Toast.show('⚠️ Impossible d’enregistrer cette photo'); }
  }).catch(()=>Toast.show('Impossible de traiter cette photo'));
}
async function removeCategoryPhoto(name){
  try{
    await Cloud.setCategoryPhoto(name, null);
    Toast.show('Photo retirée');
    Router.go('categories');
  }catch(err){ console.error(err); Toast.show('⚠️ Impossible de retirer cette photo'); }
}
function addCategory(){
  const name = prompt('Nom de la catégorie');
  if(!name || !name.trim()) return;
  const cats = Store.categories;
  if(cats.includes(name.trim())){ Toast.show('Cette catégorie existe déjà'); return; }
  cats.push(name.trim());
  Store.categories = cats;
  Toast.show('Catégorie ajoutée ✓');
  Router.go('categories');
}
function deleteCategory(name){
  if(!confirm(`Supprimer la catégorie "${name}" ?`)) return;
  Store.categories = Store.categories.filter(c=>c!==name);
  Toast.show('Catégorie supprimée');
  Router.go('categories');
}

/* ---------- Codes promo ---------- */
Views.promos = function(){
  if(!Store.hasFeature('promos')) return FeatureLock('Codes promo', "La création de codes promo est incluse à partir de la formule DOYEN.", 'doyen');
  const promos = (Store.promos || []).map(p=>PromoLocal.merge(p));
  const active = promos.filter(p=>p.active && (!p.maxUses || p.usedCount<p.maxUses)).length;
  const inactive = promos.length-active;
  return `
  ${TopBar('Codes promo', promos.length+' code(s)')}
  <div class="promo-premium-head"><div class="eyebrow">Marketing boutique</div><h2>Vos codes promo</h2><p>Créez des réductions, limitez leur utilisation et désactivez-les quand vous le souhaitez.</p></div>
  <div class="promo-summary"><div class="promo-stat"><div class="n">${promos.length}</div><div class="t">Total</div></div><div class="promo-stat active"><div class="n">${active}</div><div class="t">Disponibles</div></div><div class="promo-stat inactive"><div class="n">${inactive}</div><div class="t">Désactivés / épuisés</div></div></div>
  <div class="promo-tip">Définissez une limite pour créer une campagne maîtrisée, ou laissez <b>0</b> pour une utilisation illimitée.</div>
  <div class="section-title" style="padding-top:2px;">Codes disponibles</div>
  ${promos.length===0 ? EmptyState(ICONS.box,'Aucun code promo',"Créez votre premier code promo pour proposer une réduction à vos clients.") : promos.map(p=>{
    const exhausted=p.maxUses>0 && p.usedCount>=p.maxUses;
    return `<div class="promo-card-premium">
      <div class="promo-card-top"><div class="promo-code-badge"><span>％</span>${Utils.escapeHtml(p.code)}</div><span class="badge ${p.active&&!exhausted?'delivered':'pending'}">${exhausted?'Épuisé':p.active?'Actif':'Inactif'}</span></div>
      <div class="promo-card-desc">${p.type==='percent'?p.value+'% de réduction sur la commande':Utils.fmtFCFA(p.value)+' de réduction sur la commande'}</div>
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--text-mid);margin-bottom:11px;"><span>${p.maxUses>0?`Utilisations : <b>${p.usedCount} / ${p.maxUses}</b>`:`Utilisations : <b>${p.usedCount}</b> · illimité`}</span><button class="link-btn" onclick="editPromo('${p.id}')">Modifier</button></div>
      ${p.maxUses>0?`<div style="height:6px;background:var(--panel);border-radius:999px;overflow:hidden;margin-bottom:11px;"><span style="display:block;height:100%;width:${Math.min(100,Math.round(p.usedCount/p.maxUses*100))}%;background:var(--indigo);"></span></div>`:''}
      <div class="promo-card-foot"><span class="promo-kind">${p.type==='percent'?'Pourcentage':'Montant fixe'}</span><label class="switch"><input type="checkbox" ${p.active&&!exhausted?'checked':''} ${exhausted?'disabled':''} onchange="togglePromo('${p.id}')"><span class="slider"></span></label></div>
    </div>`;
  }).join('')}
  <div class="promo-create"><button class="btn btn-mango btn-block" onclick="addPromo()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>Créer un code promo</button></div>`;
};
function addPromo(){
  const code=prompt('Code promo (ex. BIENVENUE10)'); if(!code||!code.trim()) return;
  if((Store.promos||[]).some(p=>p.code===code.trim().toUpperCase())) return Toast.show('Ce code existe déjà');
  const type=prompt('Type : % pourcentage / montant fixe', '%'); if(type===null) return;
  const value=Number(prompt(type.trim()==='%'?'Valeur en pourcentage':'Montant de la réduction en FCFA','10')); if(!Number.isFinite(value)||value<=0) return Toast.show('Valeur invalide');
  const max=Number(prompt("Nombre maximum d'utilisations (0 = illimité)",'0')); if(!Number.isFinite(max)||max<0) return Toast.show('Limite invalide');
  const p={id:Utils.uid(),code:code.trim().toUpperCase(),type:type.trim()==='%'?'percent':'fixed',value,active:true,maxUses:Math.floor(max),usedCount:0,createdAt:Date.now()};
  Store.promos=[...(Store.promos||[]),p]; PromoLocal.update(p.id,{maxUses:p.maxUses,usedCount:0,active:true}); Toast.show('Code promo créé ✓'); Router.go('promos');
}
function togglePromo(id){ const promos=Store.promos.map(p=>p.id===id?Object.assign({},p,{active:!p.active}):p); Store.promos=promos; const p=promos.find(x=>x.id===id); PromoLocal.update(id,{active:p.active}); Toast.show(p.active?'Code activé ✓':'Code désactivé'); Router.go('promos'); }
function editPromo(id){
  const promos=Store.promos.slice(); const p=promos.find(x=>x.id===id); if(!p) return;
  const max=prompt("Nombre maximum d'utilisations (0 = illimité)",String(p.maxUses||0)); if(max===null) return;
  const n=Number(max); if(!Number.isFinite(n)||n<0) return Toast.show('Limite invalide');
  p.maxUses=Math.floor(n); Store.promos=promos; PromoLocal.update(id,{maxUses:p.maxUses}); Toast.show('Limite mise à jour ✓'); Router.go('promos');
}

/* ---------- Avis clients ---------- */
Views.reviews = function(){
  if(!Store.hasFeature('reviews')) return FeatureLock('Avis clients', "La gestion des avis clients est incluse à partir de la formule DOYEN.", 'doyen');
  const reviews = Store.reviews.slice().sort((a,b)=>b.createdAt-a.createdAt);
  const products = Store.products;
  const nameFor = (id)=>{ const p = products.find(x=>x.id===id); return p?p.name:'Produit supprimé'; };
  const count = reviews.length;
  const total = reviews.reduce((sum,r)=>sum + Number(r.rating||0),0);
  const avg = count ? total/count : 0;
  const distribution = [5,4,3,2,1].map(n=>({n,count:reviews.filter(r=>Number(r.rating)===n).length}));
  const stars = (value)=>`${'★'.repeat(Math.round(value))}${'☆'.repeat(5-Math.round(value))}`;
  return `
  ${TopBar('Avis clients', count+' avis')}
  <div style="padding:16px 20px 0;">
    <div class="reviews-summary">
      <div style="text-align:center;">
        <div class="reviews-score">${avg.toFixed(1)}</div>
        <div class="reviews-score-stars">${stars(avg)}</div>
        <div class="reviews-trust">${count ? 'Réputation basée sur '+count+' avis' : 'Aucun avis reçu'}</div>
      </div>
      <div class="reviews-bars">
        ${distribution.map(x=>`<div class="reviews-bar-row"><span>${x.n}★</span><div class="reviews-bar"><span style="width:${count ? Math.round(x.count/count*100) : 0}%"></span></div><strong>${x.count}</strong></div>`).join('')}
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px;">
      <div><div style="font-size:15px;font-weight:800;">Avis récents</div><div style="font-size:11px;color:var(--text-soft);">Renforcez la confiance en répondant à vos clients.</div></div>
      <span style="font-size:11px;color:var(--indigo);font-weight:800;">${count ? '★★★★★' : '—'}</span>
    </div>

    ${count===0 ? EmptyState(ICONS.box,'Aucun avis pour le moment',"Les avis laissés par vos clients apparaîtront ici.") : `
      <div class="reviews-filter" id="reviews-filter">
        <button class="active" onclick="filterReviews(0,this)">Tous (${count})</button>
        ${[5,4,3,2,1].map(n=>`<button onclick="filterReviews(${n},this)">${n}★ (${distribution.find(x=>x.n===n).count})</button>`).join('')}
      </div>
      <div id="reviews-list">
        ${reviews.map(r=>`
        <div class="review-card review-item" data-rating="${Number(r.rating)||0}" style="padding:14px 0;">
          <div class="review-card-top">
            <div>
              <div class="review-card-name">${Utils.escapeHtml(r.name||'Client')}</div>
              <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">${Utils.escapeHtml(nameFor(r.productId))}</div>
            </div>
            <span style="color:var(--mango-dark);font-size:13px;font-weight:700;">${'★'.repeat(Number(r.rating)||0)}${'☆'.repeat(5-(Number(r.rating)||0))}</span>
          </div>
          ${r.comment ? `<p class="review-card-comment">${Utils.escapeHtml(r.comment)}</p>` : `<p class="review-card-comment" style="font-style:italic;">Le client n’a pas laissé de commentaire.</p>`}
          <div class="review-card-time">${Utils.timeAgo(r.createdAt)}</div>
          ${r.reply ? `
          <div class="review-card-reply">
            <div style="font-size:11px;font-weight:800;color:var(--indigo);margin-bottom:3px;">Réponse de votre boutique</div>
            <div style="font-size:12.5px;color:var(--text);line-height:1.45;">${Utils.escapeHtml(r.reply)}</div>
          </div>
          <button class="link-btn" style="margin-top:8px;padding:0;" onclick="replyToReview('${r.id}')">Modifier la réponse</button>
          ` : `<button class="link-btn" style="margin-top:8px;padding:0;" onclick="replyToReview('${r.id}')">Répondre au client</button>`}
        </div>`).join('')}
      </div>`}
  </div>
  <div style="height:12px;"></div>
  `;
};

function filterReviews(rating, button){
  document.querySelectorAll('#reviews-filter button').forEach(b=>b.classList.remove('active'));
  if(button) button.classList.add('active');
  document.querySelectorAll('#reviews-list .review-item').forEach(card=>{
    card.style.display = (!rating || Number(card.dataset.rating)===Number(rating)) ? '' : 'none';
  });
}

function replyToReview(id){
  const reviews = Store.reviews;
  const review = reviews.find(r=>r.id===id);
  if(!review) return;
  const reply = prompt('Votre réponse à cet avis', review.reply || '');
  if(reply===null) return;
  review.reply = reply.trim();
  Store.reviews = reviews;
  Toast.show('Réponse enregistrée ✓');
  Router.go('reviews');
}

/* ---------- Clients ---------- */
Views.customers = function(){
  if(!Store.hasFeature('customers')) return FeatureLock('Clients', "L'historique et le suivi de vos clients sont inclus à partir de la formule DOYEN.", 'doyen');
  const customers = Store.customers();
  return `
  ${TopBar('Clients', customers.length+' client(s)')}
  ${customers.length ? `<div style="padding:16px 20px 0;"><button class="btn btn-outline btn-block" onclick="exportCustomersCSV()">Exporter les clients (Excel / CSV)</button></div>` : ''}
  <div style="padding:16px 20px 0;">
    ${customers.length===0 ? EmptyState(ICONS.team,'Aucun client encore',"L'historique de vos clients apparaîtra ici après leurs premières commandes.") :
      customers.map(c=>{
        const medal = c.rank===1?'🥇':c.rank===2?'🥈':c.rank===3?'🥉':null;
        return `
      <div style="display:flex;align-items:center;gap:14px;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px;background:#fff;cursor:pointer;" onclick="Router.go('customer-detail',{phone:'${Utils.escapeHtml(c.phone)}'})">
        ${medal ? `<div class="rank-medal" style="background:var(--indigo-tint);">${medal}</div>` : `<div class="store-logo" style="width:42px;height:42px;border-radius:12px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="var(--indigo)" stroke-width="1.7"/><path d="M4.5 20c.8-4 3.6-6.2 7.5-6.2s6.7 2.2 7.5 6.2" stroke="var(--indigo)" stroke-width="1.7" stroke-linecap="round"/></svg></div>`}
        <div style="flex:1;min-width:0;">
          <h4 style="margin:0 0 2px;font-size:14.5px;font-weight:700;">${Utils.escapeHtml(c.name)}${c.isTopContributor?' <span style="font-size:10px;font-weight:800;color:var(--gold-dark);background:var(--gold-tint);padding:2px 6px;border-radius:999px;vertical-align:middle;">TOP CLIENT</span>':''}</h4>
          <span class="mono" style="font-size:12px;color:var(--text-mid);">${Utils.escapeHtml(c.phone)}</span>
        </div>
        <div style="text-align:right;">
          <div class="mono" style="font-size:13.5px;font-weight:700;color:var(--indigo);">${Utils.fmtFCFA(c.spent)}</div>
          <span style="font-size:11px;color:var(--text-soft);">${c.orders} commande(s)</span>
        </div>
      </div>`;}).join('')}
  </div>
  <div style="height:12px;"></div>
  `;
};

/* ---------- Fiche client ---------- */
Views['customer-detail'] = function(opts){
  const orders = Store.ordersForPhone(opts.phone);
  if(orders.length===0) return `${TopBar('Client introuvable')}<div style="padding:20px;">${EmptyState(ICONS.team,'Client introuvable','Aucune commande associée à ce numéro.')}</div>`;
  const name = orders[0].customer.name;
  const address = orders[0].customer.address;
  const spent = orders.reduce((s,o)=>s+o.amount,0);
  const badgeLabel = {pending:'En attente', confirmed:'Confirmée', delivered:'Livrée'};
  const custInfo = Store.customers().find(c=>c.phone===opts.phone);
  const isTop = custInfo && custInfo.isTopContributor;
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('customers')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1>${Utils.escapeHtml(name)}</h1></div>
  </div>
  <div style="padding:0 20px;">
    <div class="mono" style="font-size:13px;color:var(--text-mid);margin-bottom:2px;">${Utils.escapeHtml(opts.phone)}</div>
    <div style="font-size:13px;color:var(--text-mid);margin-bottom:16px;">${Utils.escapeHtml(address)}</div>
    <button class="btn btn-soft-green btn-sm" style="margin-bottom:16px;" onclick="window.open('https://wa.me/225${opts.phone.replace(/\\D/g,'')}','_blank')"><svg width="14" height="14" viewBox="0 0 448 512" fill="var(--green)"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>Contacter sur WhatsApp</button>
  </div>
  <div class="stat-grid">
    <div class="stat-card"><div class="lbl">Total dépensé</div><div class="val">${Utils.fmtFCFA(spent)}</div></div>
    <div class="stat-card"><div class="lbl">Commandes</div><div class="val">${orders.length}</div></div>
  </div>
  ${isTop ? `
  <div style="margin:14px 20px 0;border:1.5px solid var(--gold);border-radius:var(--radius-md);padding:14px 16px;background:var(--gold-tint);">
    <div style="font-size:13px;font-weight:700;color:var(--gold-dark);margin-bottom:4px;">⭐ Ce client contribue énormément à votre activité</div>
    <div style="font-size:12.5px;color:var(--text-mid);margin-bottom:10px;">Et si vous lui donniez un code de réduction pour le fidéliser ?</div>
    <button class="btn btn-sm" style="background:var(--gold);color:#fff;" onclick="${Store.hasFeature('promos')?"Router.go('promos')":"SubscriptionSheet.open()"}">${Store.hasFeature('promos')?'Créer un code promo':'Débloquer les codes promo'}</button>
  </div>` : ''}
  <div class="section-title">Historique des commandes</div>
  <div style="padding:8px 20px 24px;">
    ${orders.map(o=>`
      <div class="order-row" style="border:1.5px solid var(--line);border-radius:var(--radius-md);margin-bottom:10px;padding:14px 16px;background:#fff;cursor:pointer;" onclick="Router.go('order-detail',{id:'${o.id}'})">
        <div class="order-status ${o.status}"></div>
        <div class="order-info"><h4>Commande #${o.number}</h4><div class="meta">${Utils.timeAgo(o.createdAt)}</div></div>
        <div style="text-align:right;"><div class="order-amount">${Utils.fmtFCFA(o.amount)}</div><span class="badge ${o.status}">${badgeLabel[o.status]}</span></div>
      </div>`).join('')}
  </div>
  `;
};

/* ---------- Couleurs de l'application (déblocables par formule) ---------- */
Views['app-theme'] = function(){
  const unlocked = ThemeUnlock.unlocked;
  const active = ThemeUnlock.active;
  const rows = SUBSCRIPTION_PLANS.map(p=>{
    const isUnlocked = unlocked.includes(p.key);
    const isActive = active===p.key;
    return `
    <div class="theme-tier-row ${isActive?'active':''} ${isUnlocked?'':'locked'}" ${isUnlocked?`onclick=\"ThemeUnlock.setActive('${p.key}');Router.go('app-theme')\"`:''}>
      <div class="theme-swatch" style="background:${TIER_COLORS[p.key]};"></div>
      <div style="flex:1;min-width:0;">
        <h4 style="margin:0 0 2px;font-size:14.5px;font-weight:700;">${p.label}</h4>
        <span style="font-size:12px;color:var(--text-mid);">${isUnlocked ? (isActive?'Couleur active':'Débloquée — appuyez pour l\'activer') : `À débloquer avec la formule ${p.label}`}</span>
      </div>
      ${isActive?`<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="var(--indigo)"/><path d="m7 12.5 3.2 3.2L17 9" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : !isUnlocked ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="var(--text-soft)" stroke-width="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--text-soft)" stroke-width="1.6"/></svg>` : ''}
    </div>`;
  }).join('');
  return `
  ${TopBar('Couleurs de l\'app', 'Débloquées automatiquement à chaque formule souscrite')}
  <div style="padding:16px 20px 0;">
    ${!unlocked.length ? `<div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:14px;font-size:12.5px;color:var(--text-mid);background:#fff;">Souscrivez à une formule pour débloquer votre première couleur d'application.</div>`:''}
    ${rows}
    ${unlocked.length ? `<div style="margin-top:6px;"><button class="btn btn-ghost btn-block" onclick="ThemeUnlock.setActive(null);Router.go('app-theme')">Revenir à la couleur par défaut</button></div>` : ''}
  </div>
  <div style="height:12px;"></div>
  `;
};

/* ---------- Livraison ---------- */
Views.delivery = function(){
  if(!Store.hasFeature('delivery')) return FeatureLock('Livraison', "La configuration des zones de livraison est réservée à la formule DOYA.", 'doya');
  const zones = Store.deliveryZones || [];
  const orders = Store.orders || [];
  const delivered = orders.filter(o=>o.status==='delivered').length;
  const active = zones.length;
  const avgFee = zones.length ? Math.round(zones.reduce((s,z)=>s+Number(z[1]||z.fee||0),0)/zones.length) : 0;
  return `
  ${TopBar('Livraison', zones.length+' zone(s) configurée(s)')}
  <div class="delivery-head">
    <div class="eyebrow">Logistique boutique</div>
    <h2>Livraison</h2>
    <p>Configurez vos zones, tarifs et conditions de livraison.</p>
  </div>
  <div class="delivery-summary">
    <div class="delivery-stat"><div class="n">${active}</div><div class="t">Zones actives</div></div>
    <div class="delivery-stat green"><div class="n">${delivered}</div><div class="t">Commandes livrées</div></div>
    <div class="delivery-stat"><div class="n">${avgFee?Utils.fmtFCFA(avgFee):'—'}</div><div class="t">Frais moyen</div></div>
  </div>
  <div class="section-title" style="padding-top:2px;">Vos zones de livraison</div>
  ${zones.length===0 ? EmptyState(ICONS.box,'Aucune zone de livraison',"Ajoutez des zones avec leurs frais. Sans zone, la livraison sera gratuite ou à négocier avec le client.") :
    zones.map((z,i)=>{
      const name = Array.isArray(z) ? z[0] : (z.name||z.zone||'Zone');
      const fee = Array.isArray(z) ? z[1] : (z.fee||z.price||0);
      const delay = Array.isArray(z) ? (z[2]||'24–72 h') : (z.delay||'24–72 h');
      return `<div class="delivery-zone">
        <div class="zone-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <div class="zone-main"><h4>${Utils.escapeHtml(name)}</h4><p>Délai indicatif : ${Utils.escapeHtml(String(delay))}</p></div>
        <div class="fee"><strong>${Utils.fmtFCFA(Number(fee)||0)}</strong><span>frais</span></div>
      </div>`;
    }).join('')}
  <div class="delivery-note">
    Les zones configurées seront proposées automatiquement au client lors de la commande. Les frais affichés dépendent de la zone sélectionnée.
  </div>
  <div class="delivery-action">
    <button class="btn btn-soft-green btn-block" onclick="addDeliveryZone()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round"/></svg>Ajouter une zone de livraison</button>
  </div>`;
};
function addDeliveryZone(){
  const name = prompt('Nom de la zone (ex : Cocody, Yopougon)');
  if(!name || !name.trim()) return;
  const fee = prompt('Frais de livraison (FCFA)');
  if(fee===null || isNaN(Number(fee)) || Number(fee)<0){ Toast.show('Montant invalide'); return; }
  const zones = Store.deliveryZones;
  zones.push({ name:name.trim(), fee:Number(fee) });
  Store.deliveryZones = zones;
  Toast.show('Zone ajoutée ✓');
  Router.go('delivery');
}
function deleteDeliveryZone(i){
  const zones = Store.deliveryZones;
  zones.splice(i,1);
  Store.deliveryZones = zones;
  Toast.show('Zone supprimée');
  Router.go('delivery');
}

/* ---------- Boutique ---------- */
Views.boutique = function(){
  const store = Store.store;
  const products = Store.products;
  return `
  ${TopBar('Boutique')}
  ${store.banner ? `<div style="margin:0 20px;border-radius:var(--radius-lg);overflow:hidden;aspect-ratio:16/7;"><img src="${store.banner}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>` : ''}
  <div class="store-card">
    <div class="store-card-top"><h3>Votre boutique</h3><button class="btn btn-soft-indigo btn-sm" onclick="Router.go('store-edit')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round"/></svg>Modifier</button></div>
    <div class="store-id-row">
      <div class="store-logo">${store.photo?`<img src="${store.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 9h16M4 9l1.4-4h13.2L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke="var(--indigo)" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 13a3 3 0 0 0 6 0" stroke="var(--indigo)" stroke-width="1.8" stroke-linecap="round"/></svg>`}</div>
      <h2>${Utils.escapeHtml(store.name)}</h2>
    </div>
    <div class="store-actions">
      <button class="btn btn-soft-green btn-block" onclick="openWhatsapp()"><svg width="16" height="16" viewBox="0 0 448 512" fill="var(--green)"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>Ouvrir la boutique WhatsApp</button>
      <div class="row2">
        <button class="btn btn-outline" onclick="copyLink()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" stroke-width="1.7"/></svg>Copier le lien</button>
        <button class="btn btn-outline" onclick="shareLink()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v10m0-10 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Partager</button>
      </div>
      <button class="btn btn-mango btn-block" onclick="openStorePreview()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="#fff" stroke-width="1.7"/></svg>Aperçu client</button>
    </div>
  </div>

  <div class="catalog-card">
    <h3>Aperçu du catalogue</h3><p>Voici comment vos clients voient vos produits</p>
    <button class="btn btn-soft-indigo btn-block" onclick="Router.go('products')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round"/></svg>Modifier le menu</button>
  </div>
  ${products.length===0 ? EmptyState(ICONS.box,'Votre boutique est vide','Les produits que vous ajoutez apparaîtront ici.') :
    `<div style="margin-top:8px;">${products.slice(0,6).map(p=>`
      <div class="product-row">
        <div class="product-thumb">${p.photo?`<img src="${p.photo}">`:`<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8M12 13v8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`}</div>
        <div class="product-info"><h4>${Utils.escapeHtml(p.name)}</h4><div class="price">${Utils.fmtFCFA(p.price)}</div></div>
      </div>`).join('')}</div>`}
  `;
};
/* ---------- Horaires d'ouverture façon WhatsApp Business ----------
   Structure remplie manuellement par le vendeur, jour par jour (ouvert/fermé,
   heure d'ouverture, heure de fermeture). Stockée en JSON dans store.hours. */
const SCHEDULE_DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
function defaultSchedule(){
  return SCHEDULE_DAYS.map(day => ({ day, closed: day==='Dimanche', open:'08:00', close:'19:00' }));
}
function parseSchedule(hoursValue){
  if(hoursValue){
    try{
      const parsed = JSON.parse(hoursValue);
      if(Array.isArray(parsed) && parsed.length===SCHEDULE_DAYS.length) return parsed;
    }catch(e){ /* ancien format texte libre : on retombe sur les horaires par défaut */ }
  }
  return defaultSchedule();
}
function scheduleTodayIndex(){ return (new Date().getDay()+6)%7; } // 0 = Lundi
let storeEditPhoto = null;
Views['store-edit'] = function(){
  const store = Store.store;
  return `
  ${TopBar('Modifier la boutique')}
  <div class="form-wrap">
    <div class="field"><label>Bannière de la boutique</label>
      <div class="upload-box" id="banner-upload-box" onclick="document.getElementById('f-store-banner').click()" style="padding:0;overflow:hidden;${store.banner?'border-style:solid;':''}">
        <input type="file" id="f-store-banner" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="handleStoreBanner(event)">
        <div id="banner-upload-empty" class="${store.banner?'hidden':''}" style="padding:32px 20px;">
          <div class="upload-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round"/></svg></div>
          <strong>Ajouter une bannière</strong><div class="sub">Appuyez pour choisir un fichier</div><div class="hint">PNG, JPG, WEBP — format large recommandé — max 5 Mo</div>
        </div>
        <img id="banner-upload-preview" class="${store.banner?'':'hidden'}" src="${store.banner||''}" style="width:100%;aspect-ratio:16/7;object-fit:cover;display:block;">
      </div>
      ${store.banner ? `<button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="removeStoreBanner()">Retirer la bannière</button>` : ''}
    </div>
    <div class="field"><label>Photo / logo de la boutique</label>
      <div class="upload-box" id="store-upload-box" onclick="document.getElementById('f-store-photo').click()">
        <input type="file" id="f-store-photo" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="handleStorePhoto(event)">
        <div id="store-upload-empty" class="${store.photo?'hidden':''}">
          <div class="upload-icon"><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="var(--indigo)" stroke-width="2" stroke-linecap="round"/></svg></div>
          <strong>Ajouter une photo</strong><div class="sub">Appuyez pour choisir un fichier</div><div class="hint">PNG, JPG, WEBP — max 5 Mo</div>
        </div>
        <img id="store-upload-preview" class="upload-preview ${store.photo?'':'hidden'}" src="${store.photo||''}">
      </div>
    </div>
    <div class="field"><label>Nom de la boutique</label><input id="f-store-name" type="text" placeholder="Ex : AMOS STORE" value="${Utils.escapeHtml(store.name)}"></div>
    <div class="field"><label>Numéro WhatsApp</label><input id="f-store-phone" type="tel" placeholder="07 00 00 00 00" value="${Utils.escapeHtml(store.phone)}"></div>
    <div class="field"><label>Description de la boutique</label><textarea id="f-store-desc" rows="3" placeholder="Présentez votre boutique en quelques mots" style="width:100%;border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;font-family:var(--font-body);font-size:14.5px;color:var(--text);resize:vertical;">${Utils.escapeHtml(store.description||'')}</textarea></div>
    <div class="field"><label>Adresse</label><input id="f-store-address" type="text" placeholder="Ex : Cocody, Abidjan" value="${Utils.escapeHtml(store.address||'')}"></div>
    <div class="field"><label>E-mail (optionnel)</label><input id="f-store-email" type="email" placeholder="contact@maboutique.com" value="${Utils.escapeHtml(store.email||'')}"></div>
    <div class="field">
      <label>Horaires d'ouverture</label>
      <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:4px 16px;background:#fff;">
        ${parseSchedule(store.hours).map((d,i)=>`
        <div class="sched-row">
          <span class="sched-day">${d.day}</span>
          <div class="sched-times" id="sched-times-${i}" style="${d.closed?'opacity:.4;':''}">
            <input type="time" id="sched-${i}-open" value="${d.open||'08:00'}" ${d.closed?'disabled':''}>
            <span style="color:var(--text-soft);font-size:12px;">à</span>
            <input type="time" id="sched-${i}-close" value="${d.close||'19:00'}" ${d.closed?'disabled':''}>
          </div>
          <label class="switch" style="flex:none;"><input type="checkbox" id="sched-${i}-open-toggle" ${d.closed?'':'checked'} onchange="toggleScheduleDay(${i})"><span class="slider"></span></label>
        </div>`).join('')}
      </div>
      <div class="hint" style="margin-top:6px;">Comme sur WhatsApp Business : indiquez, pour chaque jour, si la boutique est ouverte et à quelles heures.</div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-bottom:24px;" onclick="saveStoreProfile()">Enregistrer</button>
  </div>`;
};
Views._after_store_edit = function(){ storeEditPhoto = Store.store.photo || null; storeEditBanner = Store.store.banner || null; };
function handleStorePhoto(e){
  const file = e.target.files[0];
  if(!file) return;
  siamsPrepareImageDataURL(file).then(dataUrl=>{
    storeEditPhoto = dataUrl;
    document.getElementById('store-upload-empty').classList.add('hidden');
    const prev = document.getElementById('store-upload-preview');
    prev.src = storeEditPhoto; prev.classList.remove('hidden');
  }).catch(()=>Toast.show('Impossible de traiter cette photo'));
}
let storeEditBanner = null;
function handleStoreBanner(e){
  const file = e.target.files[0];
  if(!file) return;
  siamsPrepareImageDataURL(file).then(dataUrl=>{
    storeEditBanner = dataUrl;
    document.getElementById('banner-upload-empty').classList.add('hidden');
    const prev = document.getElementById('banner-upload-preview');
    prev.src = storeEditBanner; prev.classList.remove('hidden');
    document.getElementById('banner-upload-box').style.borderStyle = 'solid';
  }).catch(()=>Toast.show('Impossible de traiter cette photo'));
}
function removeStoreBanner(){
  storeEditBanner = null;
  Router.go('store-edit');
}
function toggleScheduleDay(i){
  const open = !document.getElementById(`sched-${i}-open-toggle`).checked; // décoché = fermé
  const wrap = document.getElementById(`sched-times-${i}`);
  wrap.style.opacity = open ? '.4' : '';
  document.getElementById(`sched-${i}-open`).disabled = open;
  document.getElementById(`sched-${i}-close`).disabled = open;
}
function readScheduleFromForm(){
  return SCHEDULE_DAYS.map((day,i)=>{
    const closed = !document.getElementById(`sched-${i}-open-toggle`).checked;
    return { day, closed, open: document.getElementById(`sched-${i}-open`).value||'08:00', close: document.getElementById(`sched-${i}-close`).value||'19:00' };
  });
}
function saveStoreProfile(){
  const name = document.getElementById('f-store-name').value.trim();
  const phone = document.getElementById('f-store-phone').value.trim();
  if(!name){ Toast.show('Indiquez le nom de la boutique'); return; }
  const description = document.getElementById('f-store-desc').value.trim();
  const address = document.getElementById('f-store-address').value.trim();
  const email = document.getElementById('f-store-email').value.trim();
  const hours = JSON.stringify(readScheduleFromForm());
  const store = Store.store;
  store.name = name;
  store.phone = phone || store.phone;
  store.photo = storeEditPhoto;
  store.banner = storeEditBanner;
  store.description = description;
  store.address = address;
  store.email = email;
  store.hours = hours;
  Store.store = store;
  Toast.show('Boutique mise à jour ✓');
  Router.go('boutique');
}
function openWhatsapp(){ const s = Store.store; window.open('https://wa.me/225'+s.phone.replace(/\\D/g,''), '_blank'); }
function getPublicStoreUrl(store, productId){
  const s = store || Store.store || {};
  const slug = String(s.slug || '').trim();
  if(!slug) return location.origin + '/';
  /* Lien de partage dédié : Vercel /api/share génère les métadonnées sociales
     (nom + logo de la boutique) avant de rediriger vers la vitrine SIAMS. */
  const u = new URL('/api/share', location.origin);
  u.searchParams.set('boutique', slug);
  if(productId) u.searchParams.set('produit', String(productId));
  return u.toString();
}

function setPublicStoreMeta(store){
  const s = store || {};
  const name = String(s.name || 'Boutique en ligne').trim();
  const description = String(s.description || 'Découvrez cette boutique en ligne sur SIAMS.').trim();
  document.title = name + ' — Boutique en ligne';
  const setMeta=(selector,attr,value)=>{
    let el=document.head.querySelector(selector);
    if(!el){ el=document.createElement('meta'); el.setAttribute(attr,''); document.head.appendChild(el); }
    el.setAttribute(attr,value);
  };
  setMeta('meta[name="description"]','name',description);
  setMeta('meta[property="og:title"]','property',name + ' — Boutique en ligne');
  setMeta('meta[property="og:description"]','property',description);
  setMeta('meta[property="og:url"]','property',location.href);
  if(s.photo){ setMeta('meta[property="og:image"]','property',s.photo); }
  setMeta('meta[name="twitter:title"]','name',name + ' — Boutique en ligne');
  setMeta('meta[name="twitter:description"]','name',description);
  if(s.photo){ setMeta('meta[name="twitter:image"]','name',s.photo); }
}
function copyLink(){
  const link = getPublicStoreUrl(Store.store);
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(link).then(()=>Toast.show('Lien de la boutique copié ✓')).catch(()=>Toast.show(link));
  } else {
    Toast.show(link);
  }
}
function shareLink(){
  const s = Store.store || {};
  const link = getPublicStoreUrl(s);
  if(navigator.share){
    navigator.share({title:s.name || 'Ma boutique', text:'Découvrez ma boutique SIAMS', url:link}).catch(()=>{});
  } else if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(link).then(()=>Toast.show('Lien de la boutique copié ✓')).catch(()=>Toast.show(link));
  } else {
    Toast.show(link);
  }
}
function openStorePreview(){
  try{
    /* L'aperçu est interne : aucune authentification et aucun onboarding client. */
    Router.go('shop', {skipOnboarding:true, source:'merchant-preview'});
  }catch(e){
    console.error('openStorePreview',e);
    const url = getPublicStoreUrl(Store.store);
    const w = window.open(url,'_blank','noopener,noreferrer');
    if(!w) location.href = url;
  }
}

/* ---------- Palette des tuiles de catégories ---------- */
function catTileHtml(name, index, opts){
  opts = opts || {};
  const size = opts.grid ? '' : 'style="flex:0 0 148px;"';
  return `
  <div class="cat-tile cat-tile-palette-${index%5}" onclick="Router.go('shop-categories',{cat:decodeURIComponent('${encodeURIComponent(name)}')})">
    <div class="cat-tile-arrow"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div>
      <h4>${Utils.escapeHtml(name)}</h4>
      <div class="cat-tile-btn" style="margin-top:8px;">DÉCOUVRIR</div>
    </div>
  </div>`;
}

/* ---------- Accueil client (bannière réduite + catégories + nouveautés) ---------- */
Views.shop = function(){
  const store = Store.store;
  const isRestauration = store.businessType==='restauration';
  const products = Store.products;
  const access = Store.access();
  const storeBadge = (access.status==='active' && access.badge) ? access.badge : null;
  const isGoldenStore = storeBadge==='GOLDEN';
  const isPlatinumStore = storeBadge==='PLATINE';
  const isAllStore = storeBadge==='TOUTE BOUTIQUE';
  const isDoyaStore = storeBadge==='DOYA';
  const isPremiumStore = isGoldenStore || isPlatinumStore || isAllStore || isDoyaStore;
  const paidVerified = isPaidSubscriptionActive();
  // Côté client : le nom de la formule reste réservé à l'accueil marchand.
  // La vitrine client affiche uniquement le badge de visibilité.
  const badgeChip = paidVerified ? VerifiedBadge(16, access.plan) : '';
  const certifiedChip = (store.verification && store.verification.verified) ? CertifiedBadge(16) : '';
  /* ---- Stats du hero premium : nombre d'articles, note moyenne boutique (toutes
     les notes produits confondues), commandes livrées. Purement dérivé des
     données déjà en cache, aucun nouvel appel réseau. ---- */
  const catalogCount = (isRestauration ? Store.menuItems : Store.products).length;
  const allReviews = Store.reviews||[];
  const storeAvgRating = allReviews.length ? (allReviews.reduce((s,r)=>s+r.rating,0)/allReviews.length) : null;
  const deliveredCount = Store.orders.filter(o=>o.status==='delivered').length;
  return `
  <div class="shop-hero-premium">
    <div class="shop-hero-top">
      ${store.photo ? `<div class="store-logo${isGoldenStore?' tier-golden-logo':isPlatinumStore?' tier-platinum-logo':isAllStore?' tier-all-logo':isDoyaStore?' tier-doya-logo':''}" style="width:44px;height:44px;border-radius:13px;"><img src="${store.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:${isPremiumStore?'11px':'12px'};"></div>` : ''}
      <div class="shop-hero-store"><h1>${Utils.escapeHtml(store.name)}${badgeChip}${certifiedChip}</h1><div class="page-sub">${isRestauration?'Restauration & street food':'Boutique en ligne'}</div></div>
      <button class="cn-notif-btn" onclick="ClientNotify.openPanel()" aria-label="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="cn-notif-dot" id="cn-notif-dot"></span></button>
    </div>
    <div class="shop-hero-stats">
      <div class="shop-hero-stat"><b data-count-to="${catalogCount}">0</b><span>${isRestauration?'Plats':'Articles'}</span></div>
      <div class="shop-hero-stat"><b>${storeAvgRating!=null?storeAvgRating.toFixed(1):'—'}</b><span>Note ${storeAvgRating!=null?`(${allReviews.length})`:''}</span></div>
      <div class="shop-hero-stat"><b data-count-to="${deliveredCount}">0</b><span>Livrées</span></div>
    </div>
  </div>
  ${store.banner ? `<div class="shop-banner-wrap"${isAllStore?' style="border:1.5px solid var(--ruby);"':isPlatinumStore?' style="border:1.5px solid #FF3B5C;"':isDoyaStore?' style="border:1.5px solid var(--gold);"':''}><img src="${store.banner}"></div>` : ''}
  ${isRestauration ? `
  <div class="search-wrap" style="padding-top:14px;">
    <div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="menu-home-search" type="text" placeholder="Rechercher un plat..." oninput="renderClientMenu()"></div>
  </div>
  <div id="menu-home-empty" class="hidden">${EmptyState(ICONS.box,'Aucun plat disponible aujourd\u2019hui',"Repassez plus tard, le menu du jour n'a pas encore été mis à jour.")}</div>
  <div id="menu-home-sections"></div>
  ` : `
  <div class="search-wrap" style="padding-top:14px;">
    <div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="home-search" type="text" placeholder="Rechercher un produit..." oninput="renderHomeGrid()"></div>
  </div>
  ${Store.categories.length>0 ? `
  <div class="home-section-row"><h3>Catégories</h3><button class="link-btn" onclick="Router.go('shop-categories')">Voir tout ›</button></div>
  <div class="cat-tile-row">${Store.categories.slice(0,8).map((c,i)=>catTileHtml(c,i)).join('')}</div>` : ''}
  <div class="home-section-row"><h3 id="home-grid-title">Nouveautés</h3><button class="link-btn" onclick="Router.go('shop-categories')">Voir tout ›</button></div>
  <div id="home-empty" class="hidden">${EmptyState(ICONS.box,'Boutique vide',"Cette boutique n'a pas encore de produits.")}</div>
  <div id="home-grid" class="home-grid"></div>
  `}
  <div class="fab hidden" id="cart-bar" style="left:20px;right:20px;bottom:24px;max-width:440px;">
    <button class="btn btn-mango btn-block" onclick="Router.go('cart')" style="justify-content:space-between;">
      <span style="display:flex;align-items:center;gap:8px;">${ICONS.cart.replace('30','18').replace('30','18')} Voir le panier</span>
      <span id="cart-bar-amount"></span>
    </button>
  </div>
  `;
};
Views._after_shop = function(){
  Wishlist.load();
  ClientLocal.load();
  if(Store.store.businessType==='restauration') renderClientMenu();
  else renderHomeGrid();
  ClientNotify.renderBadges();
  animateShopHeroStats();
};
/* ---- Compteurs animés du hero premium (0 -> valeur réelle en ~600ms). Purement
   cosmétique, ne modifie aucune donnée. ---- */
function animateShopHeroStats(){
  document.querySelectorAll('.shop-hero-stat b[data-count-to]').forEach(el=>{
    const target = Number(el.getAttribute('data-count-to'))||0;
    const start = performance.now();
    const dur = 650;
    function tick(now){
      const p = Math.min(1,(now-start)/dur);
      const eased = 1-Math.pow(1-p,3);
      el.textContent = String(Math.round(target*eased));
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
/* ---- Rendu de la vitrine "restauration" : plats disponibles aujourd'hui,
   groupés par catégorie (Entrée/Plat/Boisson/Dessert/Snack). Les plats
   indisponibles ne sont jamais affichés côté client. ---- */
function renderClientMenu(){
  const wrap = document.getElementById('menu-home-sections');
  if(!wrap) return;
  const searchEl = document.getElementById('menu-home-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const empty = document.getElementById('menu-home-empty');
  let items = Store.menuItems.filter(m=>m.available);
  if(q) items = items.filter(m=>m.name.toLowerCase().includes(q));
  if(items.length===0){
    if(empty) empty.classList.remove('hidden');
    wrap.innerHTML = '';
    updateCartBar();
    return;
  }
  if(empty) empty.classList.add('hidden');
  const groups = MENU_CATEGORIES.map(cat=>({ cat, list: items.filter(m=>m.category===cat) })).filter(g=>g.list.length);
  wrap.innerHTML = groups.map(g=>`
    <div class="home-section-row"><h3>${g.cat}</h3></div>
    <div class="home-grid">${g.list.map(m=>menuItemCardHtml(m)).join('')}</div>
  `).join('');
  updateCartBar();
}
function menuItemCardHtml(m){
  return `
  <div class="pcard">
    <div class="pcard-media">
      ${m.photo?`<img src="${m.photo}" loading="lazy">`:`<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M7 2v6.5a2.2 2.2 0 0 0 2.2 2.2M7 2v8.7M9.2 2v6.5M11.4 2v6.5a2.2 2.2 0 0 1-2.2 2.2M9.2 10.7V22" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
    </div>
    <div class="pcard-body">
      <h4 class="pcard-name">${Utils.escapeHtml(m.name)}</h4>
      <div class="pcard-price-row"><span class="pcard-price">${Utils.fmtFCFA(m.price)}</span></div>
      <button class="pcard-add" onclick="addToCart('${m.id}')">Ajouter</button>
    </div>
  </div>`;
}
function renderHomeGrid(){
  const grid = document.getElementById('home-grid');
  if(!grid) return;
  const searchEl = document.getElementById('home-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const titleEl = document.getElementById('home-grid-title');
  const list = Store.products;
  const empty = document.getElementById('home-empty');
  let shown;
  if(q){
    shown = list.filter(p=>p.name.toLowerCase().includes(q));
    if(titleEl) titleEl.textContent = `Résultats pour « ${searchEl.value.trim()} »`;
  } else {
    shown = list.slice(0,8);
    if(titleEl) titleEl.textContent = 'Nouveautés';
  }
  if(list.length===0){ empty.classList.remove('hidden'); grid.innerHTML=''; }
  else { empty.classList.add('hidden'); grid.innerHTML = shown.map(p=>productCardHtml(p)).join(''); }
  updateCartBar();
}

/* ---------- Onglet Catégories (façon Jumia : onglets réduits à gauche, produits à droite) ---------- */
Views['shop-categories'] = function(opts){
  opts = opts || {};
  const catLabel = (!opts.cat || opts.cat==='__all__') ? 'Tous les produits' : opts.cat;
  const cats = Store.categories || [];
  const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6" stroke="currentColor" stroke-width="1.8"/></svg>`;
  const catCards = cats.map((c,i)=>{
    const count = Store.products.filter(p=>p.category===c).length;
    return `<button class="category-card" type="button" onclick="setShopCatFilter(decodeURIComponent('${encodeURIComponent(c)}'))">
      <div class="cc-icon">${icon}</div><h4>${Utils.escapeHtml(c)}</h4><div class="category-count">${count} produit${count>1?'s':''}</div>
      <span class="cc-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>`;
  }).join('');
  return `
  <div class="topbar" style="padding-top:18px;"><h1 style="font-size:19px;">Catégories</h1></div>
  <div class="categories-hero">
    <div class="eyebrow">Explorer la boutique</div>
    <h2>${catLabel==='Tous les produits'?'Que recherchez-vous ?':Utils.escapeHtml(catLabel)}</h2>
    <p>Parcourez les produits par univers et trouvez rapidement ce qui vous intéresse.</p>
  </div>
  ${cats.length ? `<div class="category-cards">${catCards}</div>` : `<div class="category-empty">Aucune catégorie n'est encore disponible dans cette boutique.</div>`}
  <div class="shop-toolbar">
    <div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="shop-search" type="text" placeholder="Rechercher un produit..." oninput="renderShopGrid()"></div>
    <button class="shop-tool-btn" id="shop-sort-btn" onclick="openShopSheet()" aria-label="Trier et filtrer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="shop-tool-dot" id="shop-sort-dot"></span></button>
  </div>
  <div class="shop-result-row"><span class="count" id="shop-result-count"></span><button class="fav-toggle" id="shop-fav-toggle" onclick="toggleShopFavOnly()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20.6s-7.6-4.6-10-9C.4 8.2 2.4 4.5 6 4c2-.3 3.9.6 5 2.3C12.1 4.6 14 3.7 16 4c3.6.5 5.6 4.2 4 7.6-2.4 4.4-8 9-8 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Favoris</button></div>
  <div class="shop-layout"><div class="shop-cat-side"><button class="cat-side-tab ${catLabel==='Tous les produits'?'active':''}" data-scat="" onclick="setShopCatFilter('')">Tous</button>${cats.map(c=>`<button class="cat-side-tab ${c===catLabel?'active':''}" data-scat="${Utils.escapeHtml(c)}" onclick="setShopCatFilter(decodeURIComponent('${encodeURIComponent(c)}'))">${Utils.escapeHtml(c)}</button>`).join('')}</div><div class="shop-cat-main"><div id="shop-empty" class="hidden">${EmptyState(ICONS.box,'Boutique vide',"Cette boutique n'a pas encore de produits.")}</div><div id="shop-grid" class="shop-grid"></div></div></div>
  <div class="fab hidden" id="cart-bar__v46_2" style="left:20px;right:20px;bottom:24px;max-width:440px;"><button class="btn btn-mango btn-block" onclick="Router.go('cart')" style="justify-content:space-between;"><span style="display:flex;align-items:center;gap:8px;">${ICONS.cart.replace('30','18').replace('30','18')} Voir le panier</span><span id="cart-bar-amount__v46_2"></span></button></div>`;
};

Views._after_shop_categories = function(opts){
  opts = opts || {};
  Wishlist.load();
  shopCatFilter = (!opts.cat || opts.cat==='__all__') ? '' : opts.cat;
  shopSort='default'; shopFavOnly=false; shopPriceMin=null; shopPriceMax=null;
  renderShopGrid();
};

/* ---------- Compte client ---------- */
Views['shop-account'] = function(){
  const store = Store.store;
  const p = ClientLocal.profile;
  const myOrders = p.phone ? Store.orders.filter(o=>o.customer.phone===p.phone) : [];
  return `
  <div class="page-header"><h1>Mon compte</h1></div>
  <div class="acc-store-row">
    <div class="store-logo">${store.photo?`<img src="${store.photo}">`:''}</div>
    <div><h3 style="margin:0 0 2px;font-size:15.5px;">${Utils.escapeHtml(store.name)}</h3><div style="font-size:12.5px;color:var(--text-mid);">${Utils.escapeHtml(store.phone||'')}</div></div>
  </div>

  <div class="acc-group-label">Mes informations</div>
  <div class="acc-card">
    <div class="acc-row" onclick="openAccountProfileEditor()">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1-4.2 4-6.5 7.5-6.5s6.5 2.3 7.5 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
      <div class="acc-row-text"><h4>Nom, téléphone, adresse</h4><p>${p.name ? Utils.escapeHtml(p.name)+' · '+Utils.escapeHtml(p.phone||'') : 'À renseigner pour un paiement plus rapide'}</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
  </div>

  <div class="acc-group-label">Mes achats</div>
  <div class="acc-card">
    <div class="acc-row" onclick="Router.go('shop-orders-history')">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
      <div class="acc-row-text"><h4>Historique de mes commandes</h4><p>${myOrders.length ? myOrders.length+' commande(s) trouvée(s)' : 'Retrouver vos commandes précédentes'}</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
    <div class="acc-row" onclick="openTrackByNumber()">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/><path d="M2.5 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="acc-row-text"><h4>Suivre ma commande</h4><p>Retrouver une commande par son numéro</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
    <div class="acc-row" onclick="Router.go('shop-favorites')">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 20.6s-7.6-4.6-10-9C.4 8.2 2.4 4.5 6 4c2-.3 3.9.6 5 2.3C12.1 4.6 14 3.7 16 4c3.6.5 5.6 4.2 4 7.6-2.4 4.4-8 9-8 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div>
      <div class="acc-row-text"><h4>Mes favoris</h4><p>Retrouver vos produits enregistrés</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
  </div>

  <div class="acc-group-label">Mon activité</div>
  <div class="acc-card">
    <div class="acc-row" onclick="openClientPromoList()"><div class="acc-row-icon"><span style="font-weight:900;font-size:15px;">％</span></div><div class="acc-row-text"><h4>Mes codes promo</h4><p>Consulter les offres disponibles et utilisées</p></div><div class="acc-row-chev">›</div></div>
    <div class="acc-row" onclick="openClientReviews()"><div class="acc-row-icon"><span style="font-size:15px;">★</span></div><div class="acc-row-text"><h4>Mes avis</h4><p>Retrouver les évaluations laissées aux produits</p></div><div class="acc-row-chev">›</div></div>
  </div>

  <div class="acc-group-label">Boutique</div>
  <div class="acc-card">
    <div class="acc-row" onclick="openWhatsapp()">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 448 512" fill="currentColor"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg></div>
      <div class="acc-row-text"><h4>Contacter le vendeur</h4><p>Discuter sur WhatsApp</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
    <div class="acc-row" onclick="shareLink()">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.6" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="19" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="m8.3 10.7 7.4-4.2M8.3 13.3l7.4 4.2" stroke="currentColor" stroke-width="1.6"/></svg></div>
      <div class="acc-row-text"><h4>Partager la boutique</h4><p>Copier le lien de la boutique</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
  </div>

  <div class="acc-group-label">Paramètres</div>
  <div class="acc-card">
    
    <div class="acc-row" onclick="ClientNotify.openPanel()">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="acc-row-text"><h4>Notifications</h4><p>Suivi de vos commandes en temps réel</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
    <div class="acc-row" onclick="Router.go('shop-about')">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v6M12 8v.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></div>
      <div class="acc-row-text"><h4>À propos de la boutique</h4><p>Coordonnées et informations</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
  </div>

  <div class="acc-group-label">Aide</div>
  <div class="acc-card" style="margin-bottom:28px;">
    <div class="acc-row" onclick="Router.go('shop-help')">
      <div class="acc-row-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.2 1.9-2.2 3.6M12 16.5v.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div>
      <div class="acc-row-text"><h4>Aide & questions fréquentes</h4><p>Livraison, paiement, commandes</p></div>
      <div class="acc-row-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>
  </div>
  `;
};
Views._after_shop_account = function(){ ClientLocal.load(); };

function openClientPromoList(){
  const promos=(Store.promos||[]).map(p=>PromoLocal.merge(p)).filter(p=>p.active && (!p.maxUses || p.usedCount<p.maxUses));
  const w=document.createElement('div'); w.id='client-promo-wrap';
  w.innerHTML=`<div class="shop-sheet-overlay show" onclick="this.parentElement.remove()"></div><div class="shop-sheet show" style="max-height:76vh;"><div class="sheet-handle"></div><h3>Mes codes promo</h3>${promos.length?promos.map(p=>`<div class="promo-card-premium" style="margin:8px 0;"><div class="promo-card-top"><div class="promo-code-badge">${Utils.escapeHtml(p.code)}</div><span class="badge delivered">Actif</span></div><div class="promo-card-desc">${p.type==='percent'?p.value+'% de réduction':Utils.fmtFCFA(p.value)+' de réduction'} · ${p.maxUses?Math.max(0,p.maxUses-p.usedCount)+' utilisation(s) restante(s)':'utilisation illimitée'}</div></div>`).join(''):`<p style="text-align:center;color:var(--text-mid);padding:20px;">Aucun code promo disponible pour le moment.</p>`}<button class="btn btn-ghost btn-block" onclick="this.closest('#client-promo-wrap').remove()">Fermer</button></div>`;
  document.body.appendChild(w);
}
function openClientReviews(){ Toast.show('Vos avis sont accessibles depuis les produits commandés.'); }

/* ---------- À propos de la boutique (client) ---------- */
Views['shop-about'] = function(){
  const store = Store.store;
  const access = Store.access();
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('shop-account')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1 style="font-size:19px;">À propos</h1></div>
  </div>
  <div style="padding-top:14px;">
    <div class="about-hero">
      ${store.banner?`<img class="about-hero-banner" src="${store.banner}">`:''}
      <div class="about-hero-body">
        <div class="about-hero-top">
          <div class="store-logo">${store.photo?`<img src="${store.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 9h16M4 9l1.4-4h13.2L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke="var(--indigo)" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 13a3 3 0 0 0 6 0" stroke="var(--indigo)" stroke-width="1.8" stroke-linecap="round"/></svg>`}</div>
          <div>
            <h3 class="about-hero-name">${Utils.escapeHtml(store.name)}</h3>
            ${isPaidSubscriptionActive() ? `<span class="about-verified" title="Boutique vérifiée" aria-label="Boutique vérifiée">${VerifiedBadge(14, access.plan)}</span>` : ''}
          </div>
        </div>
        <p class="about-desc">${Utils.escapeHtml(store.description || "Boutique en ligne spécialisée dans la vente d'articles de qualité, avec livraison rapide et paiement sécurisé à la livraison.")}</p>
      </div>
    </div>

    <div class="about-info-list">
      <div class="about-info-row">
        <div class="about-info-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.7"/></svg></div>
        <div><h5>Adresse</h5><p>${Utils.escapeHtml(store.address || 'Abidjan, Côte d’Ivoire')}</p></div>
      </div>
      <div class="about-info-row">
        <div class="about-info-icon"><svg width="16" height="16" viewBox="0 0 448 512" fill="currentColor"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg></div>
        <div><h5>Téléphone / WhatsApp</h5><p>${Utils.escapeHtml(store.phone || 'Non renseigné')}</p></div>
      </div>
      ${store.email ? `<div class="about-info-row">
        <div class="about-info-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div><h5>E-mail</h5><p>${Utils.escapeHtml(store.email)}</p></div>
      </div>` : ''}
      <div class="about-info-row" style="align-items:flex-start;">
        <div class="about-info-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div style="flex:1;">
          <h5>Horaires</h5>
          <div>
            ${parseSchedule(store.hours).map((d,i)=>`
            <div class="about-hours-row ${i===scheduleTodayIndex()?'today':''}">
              <span class="d">${d.day}</span>
              <span class="t">${d.closed ? `<span class="closed">Fermé</span>` : `${d.open} – ${d.close}`}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="about-badges">
      <div class="about-badge"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6M2 7h20v5H2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span>Livraison rapide</span></div>
      <div class="about-badge"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Paiement à la livraison</span></div>
      <div class="about-badge"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6.5v5c0 5 3.4 8.7 8 9.5 4.6-.8 8-4.5 8-9.5v-5L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>Achat sécurisé</span></div>
    </div>

    <div class="about-actions">
      <button class="btn btn-mango btn-block" onclick="openWhatsapp()"><svg width="16" height="16" viewBox="0 0 448 512" fill="#fff"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>Discuter sur WhatsApp</button>
      <button class="btn btn-outline btn-block" onclick="shareLink()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v10m0-10 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Partager la boutique</button>
    </div>
  </div>
  `;
};

/* ---------- Aide & questions fréquentes (client) ----------
   Les questions/réponses sont générées dynamiquement à partir des données
   réelles de la boutique (zones de livraison, moyens de paiement activés,
   horaires, adresse) et, quand elle est disponible, de la géolocalisation
   du client (pour indiquer si sa position est dans une zone couverte). */
let faqClientCoords = null; /* {lat,lng,accuracy} une fois obtenue */
function buildFaqData(){
  const store = Store.store || {};
  const zones = Store.deliveryZones || [];
  const pay = Store.payment || {};

  const deliveryAnswer = zones.length
    ? `Nous livrons dans les zones suivantes : ${zones.map(z=>`${z.name} (${Utils.fmtFCFA(z.fee)})`).join(', ')}. La zone et les frais correspondants sont sélectionnés au moment de la commande.`
    : "Les frais et délais de livraison dépendent de votre localisation et vous sont indiqués au moment de la commande.";

  let locationAnswer;
  if(faqClientCoords){
    const quality = faqClientCoords.accuracy<=50 ? 'précise' : 'approximative';
    locationAnswer = `Votre position ${quality} a été détectée (précision ~${Math.round(faqClientCoords.accuracy)} m). ${zones.length?'Choisissez la zone correspondante lors de votre commande pour connaître les frais exacts, ou contactez le vendeur pour confirmer la couverture à votre adresse précise.':'Contactez le vendeur pour confirmer que votre adresse est couverte.'}`;
  } else {
    locationAnswer = "Activez la localisation depuis cette page pour que nous puissions vous indiquer si votre position est couverte. Vous pouvez aussi simplement renseigner votre zone lors de la commande.";
  }

  const payMethods = [];
  if(pay.wave && pay.wave.enabled) payMethods.push('Wave');
  if(pay.om && pay.om.enabled) payMethods.push('Orange Money');
  if(pay.mtn && pay.mtn.enabled) payMethods.push('MTN Money');
  if(pay.moov && pay.moov.enabled) payMethods.push('Moov Money');
  if(!pay.cash || pay.cash.enabled!==false) payMethods.push('Paiement à la livraison (espèces)');
  const paymentAnswer = payMethods.length
    ? `Cette boutique accepte : ${payMethods.join(', ')}.`
    : "Le paiement à la livraison est disponible ; d'autres moyens peuvent être proposés selon la boutique.";

  const groups = [
    {group:'Livraison', items:[
      {q:'Quels sont les délais de livraison ?', a:"Les commandes passées avant 14h sont généralement livrées sous 24 à 72h selon votre zone. Un lien de suivi vous est envoyé dès l'expédition."},
      {q:'Quelles sont vos zones de livraison et leurs frais ?', a: deliveryAnswer},
      {q:'Livrez-vous chez moi ?', a: locationAnswer, geo:true},
      {q:'Puis-je suivre ma commande ?', a:"Oui, rendez-vous dans « Mon compte » puis « Suivre ma commande » : vous y verrez le statut en temps réel, ainsi que la position du livreur une fois la commande expédiée."}
    ]},
    {group:'Paiement', items:[
      {q:'Quels moyens de paiement acceptez-vous ?', a: paymentAnswer},
      {q:'Le paiement en ligne est-il sécurisé ?', a:"Oui, toutes les transactions passent par des canaux sécurisés et aucune donnée bancaire n'est stockée dans l'application."}
    ]},
    {group:'Commandes & retours', items:[
      {q:'Comment passer une commande ?', a:"Ajoutez vos articles au panier, renseignez vos informations de livraison (en activant si possible votre localisation pour une livraison plus précise) puis validez."},
      {q:'Puis-je modifier ou annuler ma commande ?', a:"Contactez le vendeur rapidement via WhatsApp après votre commande : toute modification est possible tant que la commande n'a pas été expédiée."},
      {q:'Que faire si un article est défectueux ?', a:"Contactez le vendeur sous 48h après réception avec une photo de l'article. Un échange ou un remboursement sera proposé selon la situation."}
    ]}
  ];
  if(store.hours || store.address){
    groups.push({group:'Boutique', items:[
      ...(store.address ? [{q:'Où êtes-vous situés ?', a:`La boutique ${Utils.escapeHtml(store.name||'')} est basée : ${store.address}.`}] : []),
      ...(store.hours ? [{q:'Quels sont vos horaires ?', a: store.hours}] : [])
    ]});
  }
  return groups;
}
Views['shop-help'] = function(){
  const data = buildFaqData();
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('shop-account')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1 style="font-size:19px;">Aide & FAQ</h1></div>
  </div>
  <div class="page-sub" style="padding:0 20px;margin-top:2px;">Livraison, paiement, commandes et retours — adapté à cette boutique${faqClientCoords?' et à votre position':''}</div>
  <div id="faq-groups-wrap">${renderFaqGroups(data)}</div>
  <div class="help-contact-card">
    <h4>Vous ne trouvez pas de réponse ?</h4>
    <p>Notre équipe vous répond directement sur WhatsApp.</p>
    <button class="btn btn-mango btn-block" onclick="openWhatsapp()"><svg width="16" height="16" viewBox="0 0 448 512" fill="#fff"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>Contacter le vendeur</button>
  </div>
  <div style="height:12px;"></div>
  `;
};
function renderFaqGroups(data){
  return data.map((g,gi)=>`
    <div class="faq-group-label">${Utils.escapeHtml(g.group)}</div>
    <div class="faq-card">
      ${g.items.map((it,ii)=>`
        <div class="faq-item" id="faq-${gi}-${ii}">
          <div class="faq-q" onclick="toggleFaq(${gi},${ii})">${Utils.escapeHtml(it.q)}<span class="faq-q-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
          <div class="faq-a"><p>${Utils.escapeHtml(it.a)}</p>${it.geo && !faqClientCoords ? `<button class="btn btn-outline btn-sm" style="margin-top:2px;" onclick="event.stopPropagation();requestFaqLocation();">📍 Activer ma localisation</button>` : ''}</div>
        </div>`).join('')}
    </div>`).join('');
}
function toggleFaq(gi, ii){
  const el = document.getElementById('faq-'+gi+'-'+ii);
  if(el) el.classList.toggle('open');
}
function requestFaqLocation(){
  if(!navigator.geolocation){ Toast.show('Localisation non prise en charge par cet appareil'); return; }
  Toast.show('Recherche de votre position…');
  navigator.geolocation.getCurrentPosition(
    pos=>{
      faqClientCoords = {lat:pos.coords.latitude, lng:pos.coords.longitude, accuracy:pos.coords.accuracy||0};
      const wrap = document.getElementById('faq-groups-wrap');
      if(wrap) wrap.innerHTML = renderFaqGroups(buildFaqData());
      Toast.show('Position détectée ✓');
    },
    ()=>{ Toast.show('Localisation refusée ou indisponible'); },
    {enableHighAccuracy:true, timeout:12000, maximumAge:30000}
  );
}
Views._after_shop_help = function(){ /* la géoloc n'est demandée qu'à la demande du client via le bouton dédié */ };

function openAccountProfileEditor(){
  ClientLocal.load();
  const p = ClientLocal.profile;
  const existing = document.getElementById('acc-edit-wrap');
  if(existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'acc-edit-wrap';
  wrap.innerHTML = `
    <div class="shop-sheet-overlay show" onclick="document.getElementById('acc-edit-wrap').remove()"></div>
    <div class="shop-sheet show">
      <div class="sheet-handle"></div>
      <h3>Mes informations</h3>
      <div class="field"><label>Nom complet</label><input id="acc-name" type="text" value="${Utils.escapeHtml(p.name||'')}"></div>
      <div class="field"><label>Numéro de téléphone</label><input id="acc-phone" type="tel" value="${Utils.escapeHtml(p.phone||'')}"></div>
      <div class="field"><label>Adresse de livraison</label><input id="acc-address" type="text" value="${Utils.escapeHtml(p.address||'')}"></div>
      <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="saveAccountProfile()">Enregistrer</button>
    </div>`;
  document.body.appendChild(wrap);
}
function saveAccountProfile(){
  const name = document.getElementById('acc-name').value.trim();
  const phone = document.getElementById('acc-phone').value.trim();
  const address = document.getElementById('acc-address').value.trim();
  ClientLocal.save({name, phone, address});
  const w = document.getElementById('acc-edit-wrap'); if(w) w.remove();
  Toast.show('Informations enregistrées ✓');
  Router.go('shop-account');
}
function openTrackByNumber(){
  const existing = document.getElementById('track-lookup-wrap');
  if(existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'track-lookup-wrap';
  wrap.innerHTML = `
    <div class="shop-sheet-overlay show" onclick="document.getElementById('track-lookup-wrap').remove()"></div>
    <div class="shop-sheet show">
      <div class="sheet-handle"></div>
      <h3>Suivre ma commande</h3>
      <div class="field"><label>Code de commande</label><input id="track-number" type="text" placeholder="Ex : SIA-4K9F2" style="text-transform:uppercase;"></div>
      <button class="btn btn-primary btn-block" onclick="lookupOrderTrack()">Rechercher</button>
    </div>`;
  document.body.appendChild(wrap);
}
function lookupOrderTrack(){
  const val = document.getElementById('track-number').value.trim().toUpperCase();
  const order = Store.orders.find(o=>String(o.number).toUpperCase()===val);
  if(!order){ Toast.show('Aucune commande trouvée avec ce numéro'); return; }
  const w = document.getElementById('track-lookup-wrap'); if(w) w.remove();
  Router.go('order-track', {id:order.id});
}

/* ---------- Historique des commandes du client ---------- */
Views['shop-orders-history'] = function(){
  const p = ClientLocal.profile;
  const myOrders = p.phone ? Store.orders.filter(o=>o.customer.phone===p.phone) : [];
  const badgeLabel = {pending:'En attente', confirmed:'Confirmée', delivered:'Livrée'};
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('shop-account')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1 style="font-size:19px;">Mes commandes</h1></div>
  </div>
  <div style="padding:12px 20px 24px;">
    ${!p.phone ? EmptyState(ICONS.box,'Renseignez vos informations',"Ajoutez votre numéro de téléphone dans « Mes informations » pour retrouver vos commandes.",`<button class="btn btn-primary" onclick="openAccountProfileEditor()">Renseigner mes informations</button>`) :
      myOrders.length===0 ? EmptyState(ICONS.box,'Aucune commande',"Vous n'avez pas encore passé de commande.",`<button class="btn btn-primary" onclick="Router.go('shop-categories',{cat:'__all__'})">Découvrir la boutique</button>`) :
      myOrders.map(o=>`
      <div class="order-row" style="border:1.5px solid var(--line);border-radius:var(--radius-md);margin-bottom:10px;padding:14px 16px;background:#fff;cursor:pointer;" onclick="Router.go('order-track',{id:'${o.id}'})">
        <div class="order-status ${o.status}"></div>
        <div class="order-info"><h4>Commande #${o.number}</h4><div class="meta">${o.items.length} article(s) · ${new Date(o.createdAt).toLocaleDateString('fr-FR')}</div></div>
        <div style="text-align:right;"><div class="order-amount">${Utils.fmtFCFA(o.amount)}</div><span class="badge ${o.status}">${badgeLabel[o.status]}</span></div>
      </div>`).join('')}
  </div>
  `;
};

/* ---------- Favoris ---------- */
Views['shop-favorites'] = function(){
  const store = Store.store;
  return `
  <div class="page-header"><h1>Mes favoris</h1><div class="page-sub">Les articles que vous avez enregistrés chez ${Utils.escapeHtml(store.name)}</div></div>
  <div id="fav-empty" class="hidden">${EmptyState(ICONS.box,'Aucun favori',"Touchez le cœur sur un article pour l'ajouter ici.",`<button class="btn btn-primary" onclick="Router.go('shop-categories',{cat:'__all__'})">Découvrir la boutique</button>`)}</div>
  <div id="fav-grid" class="home-grid" style="padding-top:8px;"></div>
  `;
};
Views._after_shop_favorites = function(){
  Wishlist.load();
  const list = Store.products.filter(p=>Wishlist.has(p.id));
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  if(list.length===0){ empty.classList.remove('hidden'); grid.innerHTML=''; }
  else { empty.classList.add('hidden'); grid.innerHTML = list.map(p=>productCardHtml(p)).join(''); }
  updateCartBar();
};
let shopCatFilter = '';
let shopSort = 'default'; // default | price-asc | price-desc | popular
let shopFavOnly = false;
let shopPriceMin = null;
let shopPriceMax = null;

function ShopMarquee(){
  const activePromos = (Store.promos||[]).filter(p=>p.active);
  const items = activePromos.length ? activePromos.map(p=>
    `<span class="shop-marquee-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M2 7h20v5H2z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 22V7M12 7c-1.5 0-4-1-4-3.2C8 2.3 8.9 2 9.6 2c1.9 0 2.4 2.5 2.4 5Zm0 0c1.5 0 4-1 4-3.2 0-1.5-.9-1.8-1.6-1.8-1.9 0-2.4 2.5-2.4 5Z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg> Code ${Utils.escapeHtml(p.code)} : ${p.type==='percent'?p.value+'% de réduction':Utils.fmtFCFA(p.value)+' de réduction'}</span>`
  ) : [`<span class="shop-marquee-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Paiement à la livraison disponible</span>`,
     `<span class="shop-marquee-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6M2 7h20v5H2z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg> Commandez directement sur WhatsApp</span>`];
  const looped = items.concat(items).join('');
  return `<div class="shop-marquee"><div class="shop-marquee-track">${looped}</div></div>`;
}

function setShopCatFilter(cat){
  shopCatFilter = cat;
  document.querySelectorAll('.cat-side-tab').forEach(c=>c.classList.toggle('active', c.dataset.scat===cat));
  renderShopGrid();
}
function toggleShopFavOnly(){
  shopFavOnly = !shopFavOnly;
  document.getElementById('shop-fav-toggle').classList.toggle('active', shopFavOnly);
  renderShopGrid();
}
function productBadges(p){
  const badges = [];
  if(p.oldPrice && Number(p.oldPrice) > Number(p.price)){
    const pct = Math.round((1 - Number(p.price)/Number(p.oldPrice)) * 100);
    badges.push(`<span class="pcard-badge promo">−${pct}%</span>`);
  }
  const rating = Store.avgRating(p.id);
  if(rating && rating.count >= 3 && rating.avg >= 4.5){
    badges.push(`<span class="pcard-badge hot">★ Populaire</span>`);
  }
  return badges.join('');
}
/* ---- Carte produit réutilisable (grille accueil, catégories, favoris) ---- */
function productCardHtml(p){
  const rating = Store.avgRating(p.id);
  const fav = Wishlist.has(p.id);
  const meta = Utils.decodeMeta(p.desc);
  const variantBits = [];
  if(meta.sizes.length) variantBits.push(meta.sizes.length+' taille'+(meta.sizes.length>1?'s':''));
  if(meta.colors.length) variantBits.push(meta.colors.length+' couleur'+(meta.colors.length>1?'s':''));
  (meta.extra||[]).forEach(g=>{ if(g.values.length) variantBits.push(g.values.length+' '+g.label.toLowerCase()); });
  return `
  <div class="pcard">
    <div class="pcard-media" onclick="Router.go('shop-product',{id:'${p.id}'})" style="cursor:pointer;">
      <div class="pcard-badges">${productBadges(p)}</div>
      <button class="pcard-share" onclick="event.stopPropagation();shareProduct('${p.id}')" aria-label="Partager"><svg viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="19" r="2.6" stroke="currentColor" stroke-width="1.7"/><path d="m8.3 10.7 7.4-4.2M8.3 13.3l7.4 4.2" stroke="currentColor" stroke-width="1.7"/></svg></button>
      <button class="pcard-heart ${fav?'active':''}" onclick="event.stopPropagation();toggleWishlist('${p.id}')" aria-label="Ajouter aux favoris">
        <svg viewBox="0 0 24 24" fill="${fav?'currentColor':'none'}"><path d="M12 20.6s-7.6-4.6-10-9C.4 8.2 2.4 4.5 6 4c2-.3 3.9.6 5 2.3C12.1 4.6 14 3.7 16 4c3.6.5 5.6 4.2 4 7.6-2.4 4.4-8 9-8 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
      ${p.photo?`<img src="${p.photo}" loading="lazy">`:`<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8M12 13v8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`}
      ${(p.photos&&p.photos.length>1)?`<span class="pcard-photo-count">1/${p.photos.length}</span>`:''}
    </div>
    <div class="pcard-body">
      <h4 class="pcard-name" style="cursor:pointer;" onclick="Router.go('shop-product',{id:'${p.id}'})">${Utils.escapeHtml(p.name)}</h4>
      <div class="pcard-price-row">
        <span class="pcard-price">${Utils.fmtFCFA(p.price)}</span>
        ${(p.oldPrice && Number(p.oldPrice)>Number(p.price)) ? `<span class="pcard-old-price">${Utils.fmtFCFA(p.oldPrice)}</span>` : ''}
      </div>
      ${variantBits.length ? `<div class="pcard-variants">${variantBits.join(' · ')}</div>` : ''}
      <div class="pcard-rating">${rating?`★ ${rating.avg.toFixed(1)} (${rating.count})`:''}</div>
      <button class="pcard-add" onclick="event.stopPropagation();addToCart('${p.id}')">Ajouter</button>
    </div>
  </div>`;
}
/* ---- Partage d'un article (lien direct produit) ---- */
function shareProduct(productId){
  const p = Store.products.find(x=>x.id===productId);
  const store = Store.store;
  if(!p) return;
  const link = getPublicStoreUrl(store, productId);
  const text = `${p.name} — ${Utils.fmtFCFA(p.price)} sur ${store.name}`;
  if(navigator.share){
    navigator.share({title:p.name, text, url:link}).catch(()=>{});
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(`${text}\n${link}`).then(()=>Toast.show('Lien de l\'article copié ✓')).catch(()=>Toast.show(link));
  } else {
    Toast.show(link);
  }
}
function renderShopGrid(){
  const list = Store.products;
  const searchEl = document.getElementById('shop-search');
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  let filtered = q ? list.filter(p=>p.name.toLowerCase().includes(q)) : list.slice();
  if(shopCatFilter) filtered = filtered.filter(p=>p.category===shopCatFilter);
  if(shopFavOnly) filtered = filtered.filter(p=>Wishlist.has(p.id));
  if(shopPriceMin != null) filtered = filtered.filter(p=>Number(p.price) >= shopPriceMin);
  if(shopPriceMax != null) filtered = filtered.filter(p=>Number(p.price) <= shopPriceMax);
  if(shopSort === 'price-asc') filtered.sort((a,b)=>a.price-b.price);
  else if(shopSort === 'price-desc') filtered.sort((a,b)=>b.price-a.price);
  else if(shopSort === 'popular') filtered.sort((a,b)=>{
    const ra = Store.avgRating(a.id), rb = Store.avgRating(b.id);
    return (rb?rb.count*rb.avg:0) - (ra?ra.count*ra.avg:0);
  });
  const grid = document.getElementById('shop-grid');
  const empty = document.getElementById('shop-empty');
  const countEl = document.getElementById('shop-result-count');
  if(!grid) return;
  if(countEl) countEl.textContent = `${filtered.length} produit${filtered.length>1?'s':''}`;
  const dot = document.getElementById('shop-sort-dot');
  if(dot) dot.classList.toggle('show', shopSort!=='default' || shopPriceMin!=null || shopPriceMax!=null);
  if(list.length===0){ empty.classList.remove('hidden'); grid.innerHTML=''; }
  else {
    empty.classList.add('hidden');
    grid.innerHTML = filtered.map(p=>productCardHtml(p)).join('');
  }
  updateCartBar();
}

/* ---- Favoris (liste de souhaits, stockée localement sur l'appareil du client) ---- */
const Wishlist = {
  _ids: [],
  _key(){ return 'belou_wishlist_' + (Store.store && Store.store.slug ? Store.store.slug : 'default'); },
  load(){
    try{ this._ids = JSON.parse(localStorage.getItem(this._key()) || '[]'); }
    catch(e){ this._ids = []; }
  },
  save(){ try{ localStorage.setItem(this._key(), JSON.stringify(this._ids)); }catch(e){} },
  has(id){ return this._ids.includes(id); },
  toggle(id){
    if(this._ids.includes(id)) this._ids = this._ids.filter(x=>x!==id);
    else this._ids.push(id);
    this.save();
  }
};
function toggleWishlist(productId){
  Wishlist.toggle(productId);
  Toast.show(Wishlist.has(productId) ? 'Ajouté aux favoris ♥' : 'Retiré des favoris');
  if(Router.current==='shop') renderHomeGrid();
  else if(Router.current==='shop-categories') renderShopGrid();
  else if(Router.current==='shop-favorites') Views._after_shop_favorites();
}

/* ---- Profil client local (nom / téléphone / adresse mémorisés sur l'appareil) ---- */
const ClientLocal = {
  profile:{name:'', phone:'', address:''},
  _key(){ return 'siams_client_profile_' + (Store.store && Store.store.slug ? Store.store.slug : 'default'); },
  load(){
    try{ this.profile = Object.assign({name:'',phone:'',address:''}, JSON.parse(localStorage.getItem(this._key())||'{}')); }
    catch(e){ this.profile = {name:'',phone:'',address:''}; }
  },
  save(p){ this.profile = Object.assign({}, this.profile, p); try{ localStorage.setItem(this._key(), JSON.stringify(this.profile)); }catch(e){} }
};

/* ---- Gestion locale des limites d'utilisation des codes promo ---- */
const PromoLocal = {
  _key(){ return 'siams_promo_limits_' + (Store.store && Store.store.slug ? Store.store.slug : 'default'); },
  _map:{},
  load(){ try{ this._map=JSON.parse(localStorage.getItem(this._key())||'{}'); }catch(e){ this._map={}; } return this._map; },
  save(promos){ try{ this.load(); promos.forEach(p=>{ this._map[p.id]={maxUses:Number(p.maxUses||0),usedCount:Number(p.usedCount||0),active:p.active!==false}; }); localStorage.setItem(this._key(),JSON.stringify(this._map)); }catch(e){} },
  merge(p){ this.load(); const x=this._map[p.id]||{}; return Object.assign({},p,{maxUses:Number(p.maxUses||x.maxUses||0),usedCount:Number(p.usedCount||x.usedCount||0),active:p.active!==false && x.active!==false}); },
  get(id){ this.load(); return this._map[id]||{}; },
  update(id, patch){ this.load(); this._map[id]=Object.assign({},this._map[id]||{},patch); try{ localStorage.setItem(this._key(),JSON.stringify(this._map)); }catch(e){} }
};

/* ---- Notifications client (suivi de commande, stockées sur l'appareil) ---- */
const ClientNotify = {
  _list:[],
  _key(){ return 'siams_client_notifs_' + (Store.store && Store.store.slug ? Store.store.slug : 'default'); },
  load(){
    try{ this._list = JSON.parse(localStorage.getItem(this._key())||'[]'); }
    catch(e){ this._list = []; }
  },
  save(){ try{ localStorage.setItem(this._key(), JSON.stringify(this._list)); }catch(e){} },
  add(orderNumber, message){
    this.load();
    this._list.unshift({ id:Utils.uid(), orderNumber, message, read:false, createdAt:Date.now() });
    this.save();
    this.renderBadges();
    if('Notification' in window && Notification.permission==='granted'){
      try{ new Notification(Store.store.name || 'Boutique', {body:message}); }catch(e){}
    }
  },
  unreadCount(){ this.load(); return this._list.filter(n=>!n.read).length; },
  renderBadges(){
    const count = this.unreadCount();
    const dot = document.getElementById('cn-notif-dot');
    if(dot) dot.classList.toggle('show', count>0);
  },
  markAllRead(){ this.load(); this._list = this._list.map(n=>({...n, read:true})); this.save(); this.renderBadges(); },
  openPanel(){
    if('Notification' in window && Notification.permission==='default'){ try{ Notification.requestPermission(); }catch(e){} }
    this.load();
    const existing = document.getElementById('cn-notif-panel-wrap');
    if(existing){ existing.remove(); return; }
    const wrap = document.createElement('div');
    wrap.id = 'cn-notif-panel-wrap';
    wrap.innerHTML = `
      <div class="shop-sheet-overlay show" onclick="ClientNotify.closePanel()"></div>
      <div class="shop-sheet show" style="max-height:70vh;">
        <div class="sheet-handle"></div>
        <h3>Notifications</h3>
        ${this._list.length===0 ? `<p style="color:var(--text-mid);font-size:13.5px;text-align:center;padding:20px 0;">Aucune notification pour le moment.</p>` :
          this._list.map(n=>`
          <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);">
            <div style="width:34px;height:34px;border-radius:10px;background:${n.read?'var(--panel)':'var(--indigo-tint)'};color:${n.read?'var(--text-mid)':'var(--indigo)'};display:flex;align-items:center;justify-content:center;flex:none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2 7h20v5H2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div>
            <div style="flex:1;"><p style="margin:0 0 3px;font-size:13px;font-weight:${n.read?'500':'700'};color:var(--text);line-height:1.4;">${Utils.escapeHtml(n.message)}</p><span style="font-size:11px;color:var(--text-soft);">${Utils.timeAgo(n.createdAt)}</span></div>
          </div>`).join('')}
        <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="ClientNotify.markAllRead();ClientNotify.closePanel();">Fermer</button>
      </div>`;
    document.body.appendChild(wrap);
    this.markAllRead();
  },
  closePanel(){ const w = document.getElementById('cn-notif-panel-wrap'); if(w) w.remove(); }
};

/* ---- Suivi de livraison détaillé (étape "en livraison" + preuve photo, stocké sur l'appareil) ----
   Ces informations complètent le statut officiel de la commande (pending/confirmed/delivered)
   sans modifier le schéma de la base de données. */
const OrderTrack = {
  _map:{},
  _key(){ return 'siams_order_track_' + (Store.store && Store.store.slug ? Store.store.slug : 'default'); },
  load(){ try{ this._map = JSON.parse(localStorage.getItem(this._key())||'{}'); }catch(e){ this._map = {}; } },
  save(){ try{ localStorage.setItem(this._key(), JSON.stringify(this._map)); }catch(e){} },
  get(orderId){ this.load(); return this._map[orderId] || {}; },
  set(orderId, patch){
    this.load();
    this._map[orderId] = Object.assign({}, this._map[orderId]||{}, patch);
    this.save();
  }
};

/* ---- Tri & filtres avancés (feuille de sélection) ---- */
function openShopSheet(){
  const existing = document.getElementById('shop-filter-sheet-wrap');
  if(existing) existing.remove();
  const opts = [
    {v:'default', label:'Pertinence'},
    {v:'popular', label:'Popularité'},
    {v:'price-asc', label:'Prix croissant'},
    {v:'price-desc', label:'Prix décroissant'}
  ];
  const wrap = document.createElement('div');
  wrap.id = 'shop-filter-sheet-wrap';
  wrap.innerHTML = `
    <div class="shop-sheet-overlay" id="shop-sheet-overlay" onclick="closeShopSheet()"></div>
    <div class="shop-sheet" id="shop-filter-sheet">
      <div class="sheet-handle"></div>
      <h3>Trier & filtrer</h3>
      <div class="sub-label">Trier par</div>
      ${opts.map(o=>`
        <div class="sort-option ${shopSort===o.v?'active':''}" data-sort="${o.v}" onclick="setShopSortChoice('${o.v}')">
          <span>${o.label}</span><span class="radio"></span>
        </div>`).join('')}
      <div class="sub-label">Fourchette de prix (FCFA)</div>
      <div class="price-range-row">
        <input id="shop-price-min" type="number" inputmode="numeric" placeholder="Min" value="${shopPriceMin!=null?shopPriceMin:''}">
        <input id="shop-price-max" type="number" inputmode="numeric" placeholder="Max" value="${shopPriceMax!=null?shopPriceMax:''}">
      </div>
      <div class="shop-sheet-actions">
        <button class="btn btn-ghost" onclick="resetShopSheet()">Réinitialiser</button>
        <button class="btn btn-primary" onclick="applyShopSheet()">Appliquer</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>{
    document.getElementById('shop-sheet-overlay').classList.add('show');
    document.getElementById('shop-filter-sheet').classList.add('show');
  });
}
let shopSortChoice = null;
function setShopSortChoice(v){
  shopSortChoice = v;
  document.querySelectorAll('#shop-filter-sheet .sort-option').forEach(el=>el.classList.toggle('active', el.dataset.sort===v));
}
function closeShopSheet(){
  const overlay = document.getElementById('shop-sheet-overlay');
  const sheet = document.getElementById('shop-filter-sheet');
  if(overlay) overlay.classList.remove('show');
  if(sheet) sheet.classList.remove('show');
  setTimeout(()=>{ const w = document.getElementById('shop-filter-sheet-wrap'); if(w) w.remove(); }, 220);
}
function applyShopSheet(){
  if(shopSortChoice) shopSort = shopSortChoice;
  const min = document.getElementById('shop-price-min').value;
  const max = document.getElementById('shop-price-max').value;
  shopPriceMin = min ? Number(min) : null;
  shopPriceMax = max ? Number(max) : null;
  closeShopSheet();
  renderShopGrid();
}
function resetShopSheet(){
  shopSort = 'default'; shopSortChoice = null; shopPriceMin = null; shopPriceMax = null;
  closeShopSheet();
  renderShopGrid();
}
function openPhotoGallery(productId){
  const p = Store.products.find(x=>x.id===productId);
  if(!p || !p.photos || !p.photos.length) return;
  const existing = document.getElementById('photo-lightbox');
  if(existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'photo-lightbox';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,.9);z-index:90;display:flex;flex-direction:column;';
  wrap.innerHTML = `
    <div style="display:flex;justify-content:flex-end;padding:16px;position:relative;z-index:3;"><button onclick="document.getElementById('photo-lightbox').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button></div>
    <div style="flex:1;display:flex;gap:0;overflow-x:auto;scroll-snap-type:x mandatory;position:relative;">
      ${p.photos.map(src=>`<div class="lb-slide"><img src="${src}"></div>`).join('')}
      <div class="lb-hint">Pincez ou touchez deux fois pour zoomer</div>
    </div>`;
  document.body.appendChild(wrap);
  initLightboxZoom(wrap);
}
/* ---- Zoom photo produit : pincer pour zoomer + double-tap ---- */
function initLightboxZoom(wrap){
  wrap.querySelectorAll('.lb-slide').forEach(slide=>{
    const img = slide.querySelector('img');
    let scale = 1, originX = 0, originY = 0, startDist = 0, startScale = 1, lastTap = 0;
    let panX = 0, panY = 0, startPanX = 0, startPanY = 0, startTouchX = 0, startTouchY = 0;

    function apply(){ img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }
    function dist(t){ return Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY); }
    function clampPan(){
      const max = 80 * (scale - 1);
      panX = Math.max(-max, Math.min(max, panX));
      panY = Math.max(-max, Math.min(max, panY));
    }
    function resetZoom(){ scale=1; panX=0; panY=0; apply(); }

    slide.addEventListener('touchstart', e=>{
      if(e.touches.length===2){
        startDist = dist(e.touches);
        startScale = scale;
      } else if(e.touches.length===1 && scale>1){
        startPanX = panX; startPanY = panY;
        startTouchX = e.touches[0].clientX; startTouchY = e.touches[0].clientY;
      }
    }, {passive:true});
    slide.addEventListener('touchmove', e=>{
      if(e.touches.length===2){
        e.preventDefault();
        const newDist = dist(e.touches);
        scale = Math.max(1, Math.min(4, startScale * (newDist/startDist)));
        clampPan();
        apply();
      } else if(e.touches.length===1 && scale>1){
        e.preventDefault();
        panX = startPanX + (e.touches[0].clientX - startTouchX);
        panY = startPanY + (e.touches[0].clientY - startTouchY);
        clampPan();
        apply();
      }
    }, {passive:false});
    slide.addEventListener('touchend', e=>{
      if(scale < 1.02) resetZoom();
      const now = Date.now();
      if(now - lastTap < 300 && e.touches.length===0){
        scale = scale > 1 ? 1 : 2.4;
        panX = 0; panY = 0;
        apply();
      }
      lastTap = now;
    });
    /* Double-clic souris (desktop) pour tester le zoom */
    img.addEventListener('dblclick', ()=>{ scale = scale > 1 ? 1 : 2.4; panX=0; panY=0; apply(); });
  });
}
/* ---- Sélecteur d'étoiles cliquable (remplace les prompt() du navigateur) ---- */
function starIconSvg(){
  return `<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function starPickerHtml(){
  return `<div class="star-picker" id="review-star-picker">
    ${[1,2,3,4,5].map(n=>`<button type="button" class="star-btn" data-star="${n}" onclick="setReviewStar(${n})" aria-label="${n} étoile${n>1?'s':''}">${starIconSvg()}</button>`).join('')}
  </div>`;
}
let reviewStarValue = 0;
function setReviewStar(n){
  reviewStarValue = n;
  document.querySelectorAll('#review-star-picker .star-btn').forEach(btn=>{
    btn.classList.toggle('filled', Number(btn.dataset.star) <= n);
  });
}
function staticStarsHtml(rating){
  const r = Math.round(rating||0);
  return `<span class="static-stars">${[1,2,3,4,5].map(n=>`<span class="${n<=r?'filled':''}">${starIconSvg()}</span>`).join('')}</span>`;
}
function reviewCardHtml(r){
  return `
  <div class="review-card">
    <div class="review-card-top">
      <span class="review-card-name">${Utils.escapeHtml(r.name||'Client')}</span>
      ${staticStarsHtml(r.rating)}
    </div>
    ${r.comment ? `<p class="review-card-comment">${Utils.escapeHtml(r.comment)}</p>` : ''}
    <div class="review-card-time">${Utils.timeAgo(r.createdAt)}</div>
    ${r.reply ? `<div class="review-card-reply"><strong>Réponse de la boutique :</strong> ${Utils.escapeHtml(r.reply)}</div>` : ''}
  </div>`;
}
async function submitProductReview(productId){
  const nameInput = document.getElementById('review-name-input');
  const commentInput = document.getElementById('review-comment-input');
  const name = nameInput ? nameInput.value.trim() : '';
  if(!name){ Toast.show('Merci d’indiquer votre nom'); return; }
  if(!reviewStarValue){ Toast.show('Sélectionnez une note en étoiles'); return; }
  if(!Cloud.storeId){ Toast.show('⚠️ Boutique introuvable'); return; }
  const comment = commentInput ? commentInput.value.trim() : '';
  const rating = reviewStarValue;
  try{
    /* Envoi direct d'une seule ligne (et non via Store.reviews, qui resynchronise
       toute la liste et nécessiterait des droits d'écriture sur les avis existants). */
    const { data, error } = await sb.from('reviews')
      .insert({ store_id:Cloud.storeId, product_id:productId, name, rating, comment: comment || null })
      .select().single();
    if(error) throw error;
    _cache.reviews = [{ id:data.id, productId, name, rating, comment, reply:null, createdAt:new Date(data.created_at).getTime() }, ..._cache.reviews];
  } catch(e){
    console.error(e);
    Toast.show('⚠️ Impossible d’envoyer votre avis, réessayez');
    return;
  }
  Toast.show('Merci pour votre avis ✓');
  reviewStarValue = 0;
  Router.go('shop-product', {id:productId});
}

/* ---- Fiche produit détaillée (photo, description, avis + étoiles, articles similaires) ---- */
Views['shop-product'] = function(opts){
  const p = Store.products.find(x=>x.id===opts.id);
  if(!p) return `${TopBar('Produit introuvable')}<div style="padding:20px;">${EmptyState(ICONS.box,'Produit introuvable',"Cet article n'existe plus ou a été retiré.")}</div>`;
  const rating = Store.avgRating(p.id);
  const reviews = Store.reviewsFor(p.id).slice().sort((a,b)=>b.createdAt-a.createdAt);
  const meta = Utils.decodeMeta(p.desc);
  const similar = Store.products.filter(x=>x.id!==p.id && x.category===p.category).slice(0,6);
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <button class="bell-btn" onclick="Router.go('shop')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <h1 style="font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(p.name)}</h1>
    </div>
    <button class="pcard-share" style="position:static;" onclick="shareProduct('${p.id}')" aria-label="Partager"><svg viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="19" r="2.6" stroke="currentColor" stroke-width="1.7"/><path d="m8.3 10.7 7.4-4.2M8.3 13.3l7.4 4.2" stroke="currentColor" stroke-width="1.7"/></svg></button>
  </div>
  <div class="pd-gallery" id="pd-gallery" ${(p.photos&&p.photos.length)?`onclick="openPhotoGallery('${p.id}')"`:''}>
    ${(p.photos&&p.photos.length) ? p.photos.map((src,i)=>`<img class="pd-gallery-img" data-i="${i}" src="${src}" style="position:absolute;inset:0;opacity:${i===0?1:0};transition:opacity .5s ease;">`).join('') : (p.photo?`<img src="${p.photo}">`:`<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8M12 13v8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`)}
    ${(p.photos&&p.photos.length>1)?`<span class="pcard-photo-count" id="pd-gallery-count">1/${p.photos.length}</span><div class="pd-gallery-dots" id="pd-gallery-dots">${p.photos.map((_,i)=>`<span class="pd-gallery-dot ${i===0?'active':''}"></span>`).join('')}</div>`:''}
  </div>
  <div style="padding:18px 20px 4px;">
    <h2 style="font-size:20px;margin:0 0 8px;">${Utils.escapeHtml(p.name)}</h2>
    <div class="pcard-price-row" style="margin-bottom:8px;">
      <span class="pcard-price" style="font-size:20px;">${Utils.fmtFCFA(p.price)}</span>
      ${(p.oldPrice && Number(p.oldPrice)>Number(p.price)) ? `<span class="pcard-old-price">${Utils.fmtFCFA(p.oldPrice)}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      ${rating ? `${staticStarsHtml(rating.avg)}<span style="font-size:13px;color:var(--text-mid);">${rating.avg.toFixed(1)} · ${rating.count} avis</span>` : `<span style="font-size:13px;color:var(--text-mid);">Aucun avis pour l’instant</span>`}
    </div>
    <button class="btn btn-primary btn-block" onclick="addToCart('${p.id}')">Ajouter au panier</button>
  </div>
  <div style="padding:18px 20px;border-top:1px solid var(--line);margin-top:8px;">
    <h3 style="font-size:15px;margin:0 0 8px;">Description</h3>
    <p style="font-size:14px;color:var(--text-mid);line-height:1.6;margin:0;">${meta.desc ? Utils.escapeHtml(meta.desc) : 'Aucune description fournie pour cet article.'}</p>
  </div>
  <div style="padding:18px 20px;border-top:1px solid var(--line);">
    <h3 style="font-size:15px;margin:0 0 12px;">Avis clients (${reviews.length})</h3>
    ${reviews.length ? reviews.map(r=>reviewCardHtml(r)).join('') : `<p style="font-size:13.5px;color:var(--text-mid);">Soyez le premier à donner votre avis sur cet article.</p>`}
  </div>
  <div style="padding:18px 20px;border-top:1px solid var(--line);">
    <h3 style="font-size:15px;margin:0 0 12px;">Laisser un avis</h3>
    <div class="field"><input id="review-name-input" type="text" placeholder="Votre nom"></div>
    <div class="field"><label style="font-size:12.5px;color:var(--text-mid);margin-bottom:6px;display:block;">Votre note</label>${starPickerHtml()}</div>
    <div class="field"><textarea id="review-comment-input" rows="3" placeholder="Votre commentaire (facultatif)" style="resize:vertical;"></textarea></div>
    <button class="btn btn-mango btn-block" onclick="submitProductReview('${p.id}')">Envoyer mon avis</button>
  </div>
  ${similar.length ? `
  <div style="padding:18px 20px 0;border-top:1px solid var(--line);"><h3 style="font-size:15px;margin:0 0 4px;">Produits similaires</h3></div>
  <div class="pd-similar-row">${similar.map(s=>`
    <div class="pd-similar-card" onclick="Router.go('shop-product',{id:'${s.id}'})">
      <div class="pd-similar-media">${s.photo?`<img src="${s.photo}" loading="lazy">`:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8M12 13v8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`}</div>
      <div class="pd-similar-name">${Utils.escapeHtml(s.name)}</div>
      <div class="pd-similar-price">${Utils.fmtFCFA(s.price)}</div>
    </div>`).join('')}</div>` : ''}
  <div style="height:20px;"></div>
  `;
};
let pdGalleryTimer=null;
Views._after_shop_product=function(opts){
  if(pdGalleryTimer){ clearInterval(pdGalleryTimer); pdGalleryTimer=null; }
  const p = Store.products.find(x=>x.id===opts.id);
  if(!p || !p.photos || p.photos.length<2) return;
  let i=0;
  pdGalleryTimer=setInterval(()=>{
    const gallery=document.getElementById('pd-gallery');
    if(!gallery){ clearInterval(pdGalleryTimer); pdGalleryTimer=null; return; }
    i=(i+1)%p.photos.length;
    gallery.querySelectorAll('.pd-gallery-img').forEach(img=>{ img.style.opacity = (Number(img.dataset.i)===i) ? 1 : 0; });
    const count=document.getElementById('pd-gallery-count'); if(count) count.textContent=(i+1)+'/'+p.photos.length;
    const dots=document.getElementById('pd-gallery-dots'); if(dots)[...dots.children].forEach((d,j)=>d.classList.toggle('active',j===i));
  },10000);
};
function addToCart(productId){
  const p = Store.sellables.find(x=>x.id===productId);
  if(!p) return;
  const meta = Utils.decodeMeta(p.desc);
  if(meta.sizes.length || meta.colors.length || (meta.extra&&meta.extra.length)){ openVariantPicker(productId, meta); return; }
  addToCartWithVariant(productId, '', '', {});
}
function addToCartWithVariant(productId, size, color, extra){
  extra = extra || {};
  const extraKey = Object.keys(extra).sort().map(k=>k+'='+extra[k]).join('|');
  const key = productId + '::' + (size||'') + '::' + (color||'') + '::' + extraKey;
  const cart = Store.cart;
  const existing = cart.find(c=>c.key===key);
  if(existing) existing.qty += 1; else cart.push({productId, key, size:size||'', color:color||'', extra, qty:1});
  Store.cart = cart;
  Toast.show('Ajouté au panier ✓');
  updateCartBar();
}
/* ---- Sélecteur de taille / couleur / autres attributs avant ajout au panier ---- */
let variantChoice = {size:'', color:'', extra:{}};
function openVariantPicker(productId, meta){
  const p = Store.products.find(x=>x.id===productId);
  if(!p) return;
  const extraGroups = meta.extra || [];
  variantChoice = {size: meta.sizes[0]||'', color: meta.colors[0]||'', extra:{}};
  extraGroups.forEach(g=>{ variantChoice.extra[g.label] = g.values[0]||''; });
  const existing = document.getElementById('variant-sheet-wrap');
  if(existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'variant-sheet-wrap';
  wrap.innerHTML = `
    <div class="shop-sheet-overlay" id="variant-sheet-overlay" onclick="closeVariantPicker()"></div>
    <div class="shop-sheet" id="variant-sheet">
      <div class="sheet-handle"></div>
      <h3>${Utils.escapeHtml(p.name)}</h3>
      ${meta.sizes.length ? `<div class="sub-label">Taille</div>
      <div class="variant-chip-row">${meta.sizes.map((s,i)=>`<button class="variant-chip ${i===0?'active':''}" data-vsize="${Utils.escapeHtml(s)}" onclick="setVariantChoice('size','${Utils.escapeHtml(s)}')">${Utils.escapeHtml(s)}</button>`).join('')}</div>` : ''}
      ${meta.colors.length ? `<div class="sub-label">Couleur</div>
      <div class="variant-chip-row">${meta.colors.map((c,i)=>`<button class="variant-chip ${i===0?'active':''}" data-vcolor="${Utils.escapeHtml(c)}" onclick="setVariantChoice('color','${Utils.escapeHtml(c)}')">${Utils.escapeHtml(c)}</button>`).join('')}</div>` : ''}
      ${extraGroups.map(g=>`<div class="sub-label">${Utils.escapeHtml(g.label)}</div>
      <div class="variant-chip-row">${g.values.map((v,i)=>`<button class="variant-chip ${i===0?'active':''}" data-vextra="${Utils.escapeHtml(g.label)}" data-vval="${Utils.escapeHtml(v)}" onclick="setExtraVariantChoice('${g.label.replace(/'/g,"\\'")}','${v.replace(/'/g,"\\'")}')">${Utils.escapeHtml(v)}</button>`).join('')}</div>`).join('')}
      <div class="shop-sheet-actions">
        <button class="btn btn-primary btn-block" onclick="confirmVariantAdd('${productId}')">Ajouter au panier</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>{
    document.getElementById('variant-sheet-overlay').classList.add('show');
    document.getElementById('variant-sheet').classList.add('show');
  });
}
function setVariantChoice(kind, val){
  variantChoice[kind] = val;
  document.querySelectorAll(kind==='size'?'[data-vsize]':'[data-vcolor]').forEach(el=>{
    el.classList.toggle('active', (kind==='size'?el.dataset.vsize:el.dataset.vcolor)===val);
  });
}
function setExtraVariantChoice(label, val){
  variantChoice.extra[label] = val;
  document.querySelectorAll('[data-vextra]').forEach(el=>{
    if(el.dataset.vextra===label) el.classList.toggle('active', el.dataset.vval===val);
  });
}
function closeVariantPicker(){
  const overlay = document.getElementById('variant-sheet-overlay');
  const sheet = document.getElementById('variant-sheet');
  if(overlay) overlay.classList.remove('show');
  if(sheet) sheet.classList.remove('show');
  setTimeout(()=>{ const w = document.getElementById('variant-sheet-wrap'); if(w) w.remove(); }, 220);
}
function confirmVariantAdd(productId){
  addToCartWithVariant(productId, variantChoice.size, variantChoice.color, variantChoice.extra);
  closeVariantPicker();
}
function updateCartBar(){
  const cart = Store.cart;
  const count = cart.reduce((s,c)=>s+c.qty,0);
  const badge = document.getElementById('cn-cart-badge');
  if(badge){ badge.textContent = count>99?'99+':String(count); badge.classList.toggle('show', count>0); }
  const bar = document.getElementById('cart-bar');
  if(!bar) return;
  if(count===0){ bar.classList.add('hidden'); return; }
  const products = Store.sellables;
  const amount = cart.reduce((s,c)=>{ const p = products.find(x=>x.id===c.productId); return s + (p?p.price*c.qty:0); },0);
  bar.classList.remove('hidden');
  animateCartAmount(count, amount);
}
/* ---- Anime le montant du panier vers sa nouvelle valeur au lieu de le remplacer
   brutalement, façon compteur d'app bancaire. Repli immédiat si aucune valeur
   précédente (premier article ajouté). ---- */
let _cartBarAmountShown = 0;
function animateCartAmount(count, amount){
  const el = document.getElementById('cart-bar-amount');
  if(!el) return;
  const from = _cartBarAmountShown;
  const to = amount;
  _cartBarAmountShown = to;
  if(from===to){ el.textContent = `${count} · ${Utils.fmtFCFA(to)}`; return; }
  const start = performance.now(), dur = 420;
  function tick(now){
    const p = Math.min(1,(now-start)/dur);
    const eased = 1-Math.pow(1-p,3);
    const val = Math.round(from + (to-from)*eased);
    el.textContent = `${count} · ${Utils.fmtFCFA(val)}`;
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
/* ---- Retour visuel "Ajouté ✓" sur les boutons produit (délégation, purement
   cosmétique — n'intercepte ni ne remplace la logique d'ajout existante). ---- */
document.addEventListener('click', e=>{
  const btn = e.target.closest && e.target.closest('.pcard-add');
  if(!btn || btn.dataset.animLock) return;
  const original = btn.textContent;
  btn.dataset.animLock = '1';
  btn.classList.add('added');
  btn.textContent = '✓ Ajouté';
  setTimeout(()=>{ btn.classList.remove('added'); btn.textContent = original; delete btn.dataset.animLock; }, 900);
});

/* ---------- Panier ---------- */
Views.cart = function(){
  const cart = Store.cart;
  const products = Store.sellables;
  const items = cart.map(c=>({...c, product: products.find(p=>p.id===c.productId)})).filter(i=>i.product);
  const total = items.reduce((s,i)=>s+i.product.price*i.qty,0);
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('shop')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1>Mon panier</h1></div>
  </div>
  ${items.length===0 ? EmptyState(ICONS.cart,'Panier vide','Ajoutez des produits depuis la boutique pour commencer.',
    `<button class="btn btn-primary" onclick="Router.go('shop')">Voir la boutique</button>`) : `
  <div style="padding:8px 20px 0;">
    ${items.map(i=>{
      const variantLabel = Utils.variantLabel(i);
      const key = i.key || i.productId;
      return `
      <div class="product-row" style="padding:14px 0;">
        <div class="product-thumb">${i.product.photo?`<img src="${i.product.photo}">`:`<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`}</div>
        <div class="product-info"><h4>${Utils.escapeHtml(i.product.name)}</h4>${variantLabel?`<div class="meta">${Utils.escapeHtml(variantLabel)}</div>`:''}<div class="price">${Utils.fmtFCFA(i.product.price)}</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="changeCartQty('${key}',-1)" style="width:28px;height:28px;border-radius:8px;border:1.5px solid var(--line);background:#fff;font-size:16px;cursor:pointer;">−</button>
          <span class="mono" style="min-width:16px;text-align:center;font-size:14px;font-weight:700;">${i.qty}</span>
          <button onclick="changeCartQty('${key}',1)" style="width:28px;height:28px;border-radius:8px;border:1.5px solid var(--line);background:#fff;font-size:16px;cursor:pointer;">+</button>
        </div>
      </div>
    `;}).join('')}
  </div>
  <div style="margin:20px 20px 0;padding:18px;border-radius:var(--radius-md);background:var(--panel);display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:700;font-size:15px;">Total</span><span class="mono" style="font-weight:700;font-size:17px;">${Utils.fmtFCFA(total)}</span>
  </div>
  <div style="padding:16px 20px 24px;"><button class="btn btn-mango btn-block" onclick="Router.go('checkout')">Passer la commande</button></div>
  `}`;
};
function changeCartQty(key, delta){
  let cart = Store.cart;
  const item = cart.find(c=>(c.key||c.productId)===key);
  if(item){ item.qty += delta; if(item.qty<=0) cart = cart.filter(c=>(c.key||c.productId)!==key); }
  Store.cart = cart;
  Router.go('cart');
}

/* ---------- Checkout ---------- */
Views.checkout = function(){
  const cart = Store.cart;
  const products = Store.sellables;
  const items = cart.map(c=>({...c, product: products.find(p=>p.id===c.productId)})).filter(i=>i.product);
  const total = items.reduce((s,i)=>s+i.product.price*i.qty,0);
  const pay = Store.payment;
  const methods = [
    pay.wave.enabled ? {key:'wave',label:'Wave'} : null,
    pay.om.enabled ? {key:'om',label:'Orange Money'} : null,
    pay.mtn.enabled ? {key:'mtn',label:'MTN Money'} : null,
    pay.moov.enabled ? {key:'moov',label:'Moov Money'} : null,
    pay.cash.enabled ? {key:'cash',label:'Paiement à la livraison'} : null,
  ].filter(Boolean);
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('cart')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1>Finaliser la commande</h1></div>
  </div>
  <div class="form-wrap">
    <div class="field"><label>Nom complet</label><input id="co-name" type="text" placeholder="Votre nom" value="${Utils.escapeHtml(ClientLocal.profile.name||'')}"></div>
    <div class="field"><label>Numéro de téléphone</label><input id="co-phone" type="tel" placeholder="07 00 00 00 00" value="${Utils.escapeHtml(ClientLocal.profile.phone||'')}"></div>
    <div class="field"><label>Adresse / Quartier de livraison</label><input id="co-address" type="text" placeholder="Ex : Yopougon, Sicogi" value="${Utils.escapeHtml(ClientLocal.profile.address||'')}"></div>
    ${Store.deliveryZones.length>0 ? `<div class="field"><label>Zone de livraison</label>
      <select id="co-zone" onchange="recalcCheckoutTotal()">
        <option value="">Aucune / à convenir</option>
        ${Store.deliveryZones.map(z=>`<option value="${Utils.escapeHtml(z.name)}" data-fee="${z.fee}">${Utils.escapeHtml(z.name)} — ${Utils.fmtFCFA(z.fee)}</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="field"><label>Code promo (facultatif)</label>
      <div style="display:flex;gap:10px;">
        <input id="co-promo" type="text" placeholder="Ex : BIENVENUE10" style="flex:1;text-transform:uppercase;">
        <button class="btn btn-outline btn-sm" onclick="applyPromoCode()" style="flex:none;">Appliquer</button>
      </div>
      <div id="co-promo-msg" style="font-size:12.5px;margin-top:8px;"></div>
    </div>
    <div class="field"><label>Mode de paiement</label>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${methods.length===0 ? `<div style="font-size:13px;color:var(--text-mid);">Aucun mode de paiement configuré par le vendeur.</div>` :
          methods.map((m,i)=>{
            const pm = pay[m.key] || {};
            const info = m.key==='cash' ? 'Paiement à la livraison' : (pm.number ? pm.number : 'Numéro non renseigné');
            return `<label style="display:flex;align-items:center;gap:12px;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;cursor:pointer;">
            <input type="radio" name="co-pay" value="${m.key}" ${i===0?'checked':''} onchange="onCheckoutPayChange()" style="width:18px;height:18px;accent-color:var(--indigo);">
            <span style="display:flex;flex-direction:column;gap:3px;"><span style="font-size:14.5px;font-weight:700;">${m.label}</span><span style="font-size:11.5px;color:var(--text-mid);">${Utils.escapeHtml(info)}</span></span>
          </label>`;
          }).join('')}
      </div>
      <div id="co-pay-details"></div>
    </div>
    <div style="border-top:1px solid var(--line);padding-top:16px;margin-bottom:20px;">
      <div id="co-subtotal-row" class="hidden" style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13.5px;color:var(--text-mid);"><span>Sous-total</span><span class="mono" id="co-subtotal"></span></div>
      <div id="co-discount-row" class="hidden" style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13.5px;color:var(--green);"><span>Réduction</span><span class="mono" id="co-discount"></span></div>
      <div id="co-delivery-row" class="hidden" style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13.5px;color:var(--text-mid);"><span>Livraison</span><span class="mono" id="co-delivery"></span></div>
      <div style="display:flex;justify-content:space-between;"><span style="font-weight:700;">Total à payer</span><span class="mono" style="font-weight:700;" id="co-total">${Utils.fmtFCFA(total)}</span></div>
    </div>
    <button class="btn btn-mango btn-block" style="margin-bottom:24px;" onclick="confirmOrder()">Confirmer la commande</button>
  </div>
  `;
};
let appliedPromo = null;
let checkoutPaymentProof = null;
Views._after_checkout = function(){ appliedPromo = null; checkoutPaymentProof = null; ClientLocal.load(); onCheckoutPayChange(); };
function onCheckoutPayChange(){
  const payRadio = document.querySelector('input[name="co-pay"]:checked');
  const wrap = document.getElementById('co-pay-details');
  if(!wrap || !payRadio) return;
  checkoutPaymentProof = null;
  const method = payRadio.value;
  if(method==='cash'){ wrap.innerHTML = ''; return; }
  const pay = Store.payment;
  const number = pay[method] ? pay[method].number : '';
  const link = pay[method] ? pay[method].link : '';
  const validated = pay[method] ? pay[method].validated : false;
  const label = PAY_LABELS[method] || method;
  wrap.innerHTML = `
    <div style="margin-top:10px;border:1.5px dashed var(--line);border-radius:var(--radius-sm);padding:14px;">
      <p style="margin:0 0 8px;font-size:12.5px;color:var(--text-mid);">Envoyez le montant total au numéro ${label} ci-dessous, puis joignez une capture d'écran ou le reçu de la transaction.</p>
      <div style="display:flex;align-items:center;gap:10px;background:var(--panel);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:10px;">
        <span class="mono" style="font-weight:700;font-size:15px;flex:1;">${number ? Utils.escapeHtml(number) : 'Numéro non renseigné par le vendeur'}</span>
        ${validated ? `<span style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--green-tint);color:var(--green);white-space:nowrap;">Vérifié ✓</span>` : ''}
        ${number ? `<button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${number.replace(/'/g,"")}');Toast.show('Numéro copié ✓')">Copier</button>` : ''}
      </div>
      ${link ? `<a href="${Utils.escapeHtml(link)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-bottom:10px;font-size:13px;font-weight:600;color:var(--indigo);">Payer directement via le lien ${label} ↗</a>` : ''}
      <input type="file" accept="image/*" id="co-payment-proof-input" class="hidden" onchange="handleCheckoutProof(event)">
      <div id="co-payment-proof-preview"></div>
      <button type="button" class="btn btn-mango btn-sm" style="width:100%;" onclick="document.getElementById('co-payment-proof-input').click()">📎 Joindre la capture / le reçu de paiement</button>
    </div>`;
}
function handleCheckoutProof(evt){
  const file = evt.target.files && evt.target.files[0];
  if(!file) return;
  siamsPrepareImageDataURL(file).then(dataUrl=>{
    checkoutPaymentProof = dataUrl;
    const prev = document.getElementById('co-payment-proof-preview');
    if(prev) prev.innerHTML = `<div style="margin:10px 0;border-radius:var(--radius-sm);overflow:hidden;border:1.5px solid var(--line);"><img src="${checkoutPaymentProof}" style="width:100%;display:block;"></div><div style="font-size:12px;color:var(--green);font-weight:600;">✓ Justificatif joint</div>`;
  }).catch(()=>Toast.show('Impossible de traiter cette image'));
}
function applyPromoCode(){
  const code = document.getElementById('co-promo').value.trim().toUpperCase();
  const msg = document.getElementById('co-promo-msg');
  if(!code){ msg.textContent=''; appliedPromo=null; recalcCheckoutTotal(); return; }
  const promo = Store.promos.map(p=>PromoLocal.merge(p)).find(p=>p.code===code && p.active && (!p.maxUses || p.usedCount<p.maxUses));
  if(!promo){ msg.textContent = 'Code invalide, inactif ou épuisé'; msg.style.color = 'var(--red)'; appliedPromo=null; recalcCheckoutTotal(); return; }
  appliedPromo = promo;
  msg.textContent = `Code appliqué : ${promo.type==='percent' ? promo.value+'% de réduction' : Utils.fmtFCFA(promo.value)+' de réduction'}`;
  msg.style.color = 'var(--green)';
  recalcCheckoutTotal();
}
function recalcCheckoutTotal(){
  const cart = Store.cart;
  const products = Store.sellables;
  const items = cart.map(c=>({...c, product: products.find(p=>p.id===c.productId)})).filter(i=>i.product);
  const subtotal = items.reduce((s,i)=>s+i.product.price*i.qty,0);
  let discount = 0;
  if(appliedPromo) discount = appliedPromo.type==='percent' ? Math.round(subtotal*appliedPromo.value/100) : Math.min(appliedPromo.value, subtotal);
  const zoneEl = document.getElementById('co-zone');
  const deliveryFee = zoneEl && zoneEl.value ? Number(zoneEl.selectedOptions[0].dataset.fee||0) : 0;
  const total = subtotal - discount + deliveryFee;
  document.getElementById('co-total').textContent = Utils.fmtFCFA(total);
  document.getElementById('co-subtotal-row').classList.toggle('hidden', discount===0 && deliveryFee===0);
  document.getElementById('co-discount-row').classList.toggle('hidden', discount===0);
  document.getElementById('co-delivery-row').classList.toggle('hidden', deliveryFee===0);
  if(discount>0 || deliveryFee>0){
    document.getElementById('co-subtotal').textContent = Utils.fmtFCFA(subtotal);
  }
  if(discount>0) document.getElementById('co-discount').textContent = '−'+Utils.fmtFCFA(discount);
  if(deliveryFee>0) document.getElementById('co-delivery').textContent = Utils.fmtFCFA(deliveryFee);
}
let checkoutLocation=null;
let checkoutLocationRequestInProgress=false;

function setCheckoutLocationStatus(message, type='neutral'){
  const status=document.getElementById('co-location-status');
  if(!status) return;
  const styles={
    neutral:'color:var(--text-soft);',
    loading:'color:var(--indigo);',
    success:'color:var(--green);font-weight:700;',
    warning:'color:#9a6700;',
    error:'color:var(--danger,#d64545);'
  };
  status.style.cssText='font-size:12px;margin-top:8px;line-height:1.5;'+(styles[type]||styles.neutral);
  status.innerHTML=message;
}

function locationHelpHtml(){
  return `<div style="margin-top:10px;padding:11px 12px;border-radius:12px;background:#fff8e8;border:1px solid #f0d58a;color:#765b18;line-height:1.5;">
    <strong>La localisation est bloquée.</strong><br>
    Sur Android, ouvrez les paramètres du site depuis votre navigateur, choisissez <strong>Localisation → Autoriser</strong>, puis revenez ici et appuyez sur <strong>Réessayer</strong>.
    <div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" class="btn btn-soft-indigo btn-sm" onclick="requestDeliveryLocation(true)">Réessayer</button>
    </div>
  </div>`;
}

async function requestDeliveryLocation(forceRetry=false){
  const status=document.getElementById('co-location-status');
  if(checkoutLocationRequestInProgress) return;
  if(!navigator.geolocation){
    setCheckoutLocationStatus('Votre appareil ou votre navigateur ne prend pas en charge la géolocalisation.', 'error');
    return;
  }

  checkoutLocationRequestInProgress=true;
  setCheckoutLocationStatus('Recherche de votre position…<br><span style="font-weight:400;">Gardez la page ouverte quelques secondes.</span>', 'loading');

  const handleSuccess=(pos)=>{
    checkoutLocationRequestInProgress=false;
    const accuracy=Number(pos.coords.accuracy||0);
    checkoutLocation={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy,timestamp:Date.now()};
    const quality=accuracy<=30?'Position précise':accuracy<=100?'Position correcte':'Position approximative';
    setCheckoutLocationStatus(`✓ ${quality} — précision ~${Math.round(accuracy)} m`, 'success');
  };

  const handleError=(err)=>{
    checkoutLocationRequestInProgress=false;
    if(err && err.code===1){
      setCheckoutLocationStatus(
        'L’accès à votre position a été refusé par le navigateur.'+locationHelpHtml(),
        'warning'
      );
      return;
    }
    if(err && err.code===2){
      setCheckoutLocationStatus('Votre position est momentanément indisponible. Vérifiez que la localisation du téléphone est activée, puis appuyez sur <strong>Réessayer</strong>.', 'warning');
      return;
    }
    if(err && err.code===3){
      setCheckoutLocationStatus('La recherche de votre position a pris trop de temps. Vérifiez votre connexion et votre GPS, puis appuyez sur <strong>Réessayer</strong>.', 'warning');
      return;
    }
    setCheckoutLocationStatus('Impossible d’obtenir votre position pour le moment. Vous pouvez vérifier les autorisations du site puis réessayer.', 'error');
  };

  // Si l’API Permissions est disponible, on explique immédiatement l’état
  // de l’autorisation sans empêcher getCurrentPosition de déclencher le prompt
  // lorsque celui-ci est encore à l’état "prompt".
  try{
    if(navigator.permissions && navigator.permissions.query){
      const permission=await navigator.permissions.query({name:'geolocation'});
      if(permission.state==='denied'){
        checkoutLocationRequestInProgress=false;
        setCheckoutLocationStatus('L’accès à la localisation est actuellement bloqué pour ce site.'+locationHelpHtml(), 'warning');
        return;
      }
    }
  }catch(e){}

  navigator.geolocation.getCurrentPosition(
    handleSuccess,
    handleError,
    {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
  );
}

async function confirmOrder(){
  const name = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  if(!name || !phone || !address){ Toast.show('Merci de remplir tous les champs'); return; }
  const payRadio = document.querySelector('input[name="co-pay"]:checked');
  const payMethod = payRadio?payRadio.value:'cash';
  if(payMethod!=='cash' && !checkoutPaymentProof){ Toast.show('Veuillez joindre la capture ou le reçu de votre paiement'); return; }
  const cart = Store.cart;
  let products = Store.sellables;
  const items = cart.map(c=>{ const p = products.find(x=>x.id===c.productId); if(!p) return null; const variantLabel = Utils.variantLabel(c); return {productId:c.productId, name: variantLabel ? `${p.name} (${variantLabel})` : p.name, price:p.price, qty:c.qty}; }).filter(Boolean);
  if(items.length===0){ Toast.show('Panier vide'); return; }
  const subtotal = items.reduce((s,i)=>s+i.price*i.qty,0);
  let discount = 0;
  if(appliedPromo) discount = appliedPromo.type==='percent' ? Math.round(subtotal*appliedPromo.value/100) : Math.min(appliedPromo.value, subtotal);
  const zoneEl = document.getElementById('co-zone');
  const deliveryZone = zoneEl && zoneEl.value ? zoneEl.value : null;
  const deliveryFee = zoneEl && zoneEl.value ? Number(zoneEl.selectedOptions[0].dataset.fee||0) : 0;
  const amount = subtotal - discount + deliveryFee;
  const orders = Store.orders.slice();
  const isFirstOrderEver = orders.length===0;
  let number = Utils.genOrderCode(Store.store.name);
  while(orders.some(o=>o.number===number)) number = Utils.genOrderCode(Store.store.name);
  const order = { id:Utils.uid(), number, customer:{name,phone,address}, items, amount, discount, deliveryZone, deliveryFee, promoCode: appliedPromo?appliedPromo.code:null, paymentMethod: payMethod, paymentProof: checkoutPaymentProof||null, status:'pending', createdAt:Date.now(), deliveryToken:Utils.uid(),
    customerLat: checkoutLocation?checkoutLocation.lat:null, customerLng: checkoutLocation?checkoutLocation.lng:null, customerLocationAccuracy: checkoutLocation?checkoutLocation.accuracy:null };
  orders.unshift(order);
  if(appliedPromo){ const promos=Store.promos.slice(); const pp=promos.find(x=>x.id===appliedPromo.id); if(pp){ pp.usedCount=Number(pp.usedCount||0)+1; Store.promos=promos; PromoLocal.update(pp.id,{usedCount:pp.usedCount}); } }
  Store.orders = orders;
  /* Conserve immédiatement la commande sur l'appareil du client et attend
     l'écriture serveur avant d'annoncer qu'elle est reçue par la boutique. */
  try{
    ClientOrderCache.save(order);
    await Cloud.waitForOrderPersisted(order.id);
  }catch(syncErr){
    console.error('Commande non synchronisée', syncErr);
    const detail = syncErr && (syncErr.message || syncErr.code || (syncErr.error && syncErr.error.message) || JSON.stringify(syncErr));
    Toast.show('⚠️ La commande n’a pas pu être transmise : '+(detail||'erreur inconnue'));
    return;
  }

  /* Décrément du stock */
  products = products.map(p=>{
    const it = items.find(i=>i.productId===p.id);
    if(it && p.stockLimited){
      const newQty = Math.max(0, Number(p.stockQty||0) - it.qty);
      if(newQty===0) Notify.add('stock', `⚠️ Stock épuisé : ${p.name} — pensez à réapprovisionner`);
      else if(newQty <= 3) Notify.add('stock', `Stock presque épuisé : ${p.name} (${newQty} restant${newQty>1?'s':''})`);
      return { ...p, stockQty: newQty };
    }
    return p;
  });
  Store.products = products;

  Store.cart = [];
  appliedPromo = null;
  checkoutPaymentProof = null;
  checkoutLocation = null;
  Notify.add('order', `Nouvelle commande #${number} de ${name} — ${Utils.fmtFCFA(amount)}`);
  ClientLocal.save({name, phone, address});
  ClientNotify.add(number, `Commande #${number} reçue — en attente de confirmation du vendeur.`);

  /* Envoi automatique au vendeur par WhatsApp */
  const store = Store.store;
  const lines = items.map(i=>`• ${i.name} ×${i.qty} — ${Utils.fmtFCFA(i.price*i.qty)}`).join('\n');
  const waText = `Nouvelle commande #${number}\nClient : ${name} (${phone})\nAdresse : ${address}${deliveryZone?`\nZone : ${deliveryZone}`:''}\n\n${lines}\n\nTotal : ${Utils.fmtFCFA(amount)}`;
  const waLink = `https://wa.me/225${(store.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(waText)}`;
  window.open(waLink, '_blank');

  if(isFirstOrderEver){
    Achievements.celebrate({ icon:'trophy', color:'#1E9E6B', title:'Première commande enregistrée ! 🎉', subtitle:'Votre boutique vient de recevoir sa toute première vente.' });
  }
  Router.go('confirmation', {orderNumber:number});
}

/* ---------- Aperçu PNG inline du reçu (canvas), harmonisé avec le design de référence
   renderSIAMSReceiptPDF : bandeau dégradé navy → bleu, ruban bleu → cyan, panneau
   d'informations, tableau à en-tête navy, bandeau de pied navy avec identité SIAMS. ---------- */
function ctxRoundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function buildReceiptDataURL(order){
  const store = Store.store;
  const C = { navy:'#052A4D', blueDeep:'#0060D9', blue:'#0098E8', cyan:'#00D6EE',
    ink:'#162335', mid:'#5C6B7A', line:'#DCE4EC', green:'#1E9E6B', mango:'#EE9A2E',
    panel:'#EEF3F8', legal:'#F0F6FB', paper:'#FFFFFF' };
  const W = 680;
  const padX = 40;
  const rowH = 28;

  /* Hauteurs fixes des sections (utilisées à la fois pour calculer H et pour dessiner) */
  const headerH = 128, rubanH = 3, gapHeader = 24;
  const infoBoxH = 118, gapInfo = 22;
  const tableHeadH = 28, gapTable = 12;
  const extraTotalLines = (order.discount?1:0) + (order.deliveryFee?1:0);
  const totalsH = 22 + extraTotalLines*22 + 14 + 34;
  const gapTotals = 18, statusH = 24, gapStatus = 16, legalH = 68, gapLegal = 20, footerH = 58;

  const H = headerH + rubanH + gapHeader + infoBoxH + gapInfo + tableHeadH + order.items.length*rowH
    + gapTable + totalsH + gapTotals + statusH + gapStatus + legalH + gapLegal + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.paper; ctx.fillRect(0,0,W,H);

  /* ---- Bandeau d'en-tête dégradé navy → bleu + badge SIAMS ---- */
  const grad = ctx.createLinearGradient(0,0,W,0);
  grad.addColorStop(0, C.navy); grad.addColorStop(1, C.blueDeep);
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,headerH);

  ctx.fillStyle = '#fff';
  ctxRoundRect(ctx, W-padX-58, 20, 58, 58, 12); ctx.fill();
  ctx.fillStyle = C.navy; ctx.textAlign = 'center'; ctx.font = '800 15px Arial';
  ctx.fillText('SIAMS', W-padX-29, 54);

  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.font = '800 26px Arial'; ctx.fillText('Reçu', padX, 54);
  ctx.font = '700 12px Arial'; ctx.fillText(`N° ${order.number}`, padX, 72);
  ctx.globalAlpha = .85; ctx.font = '500 12px Arial';
  ctx.fillText(`Reçu de commande — ${store.name || 'Boutique'} (propulsé par SIAMS)`, padX, 92);
  ctx.globalAlpha = 1;

  /* ---- Ruban dégradé bleu → cyan ---- */
  const ruban = ctx.createLinearGradient(0,0,W,0);
  ruban.addColorStop(0, C.blueDeep); ruban.addColorStop(1, C.cyan);
  ctx.fillStyle = ruban; ctx.fillRect(0, headerH, W, rubanH);

  let y = headerH + rubanH + gapHeader;

  /* ---- Panneau d'informations ---- */
  ctx.fillStyle = C.panel; ctx.strokeStyle = C.line;
  ctxRoundRect(ctx, padX, y, W-padX*2, infoBoxH, 8); ctx.fill(); ctx.stroke();
  const half = (W-padX*2-32)/2;
  const infoRows = [
    ['Date', new Date(order.createdAt).toLocaleString('fr-FR')],
    ['Client', `${order.customer.name} · ${order.customer.phone}`],
    ['Paiement', PAY_LABELS[order.paymentMethod]||order.paymentMethod],
    ['Statut', 'En attente de confirmation']
  ];
  let iy = y + 26;
  infoRows.forEach((row,idx)=>{
    const cx = padX + 16 + (idx%2)*(half+16);
    ctx.textAlign = 'left'; ctx.fillStyle = C.mid; ctx.font = '600 10px Arial';
    ctx.fillText(row[0].toUpperCase(), cx, iy);
    ctx.fillStyle = C.ink; ctx.font = '700 12px Arial';
    let val = String(row[1]);
    if (val.length > 30) val = val.slice(0,30)+'…';
    ctx.fillText(val, cx, iy+16);
    if (idx%2===1) iy += 44;
  });
  ctx.textAlign = 'left'; ctx.fillStyle = C.mid; ctx.font = '600 10px Arial';
  ctx.fillText('ADRESSE', padX+16, iy);
  ctx.fillStyle = C.ink; ctx.font = '700 12px Arial';
  let addr = order.customer.address || '';
  if (addr.length > 62) addr = addr.slice(0,62)+'…';
  ctx.fillText(addr, padX+16, iy+16);

  y += infoBoxH + gapInfo;

  /* ---- Tableau des articles ---- */
  const tableW = W-padX*2;
  ctx.fillStyle = C.navy; ctx.fillRect(padX, y, tableW, tableHeadH);
  ctx.fillStyle = '#fff'; ctx.font = '700 10px Arial';
  ctx.textAlign = 'left'; ctx.fillText('DESCRIPTION', padX+10, y+18);
  ctx.textAlign = 'center'; ctx.fillText('QTÉ', padX+tableW*0.62, y+18);
  ctx.textAlign = 'right'; ctx.fillText('TOTAL', W-padX-10, y+18);
  y += tableHeadH;

  order.items.forEach((it,idx)=>{
    if (idx%2===1){ ctx.fillStyle = '#F8FAFC'; ctx.fillRect(padX, y, tableW, rowH); }
    ctx.fillStyle = C.ink; ctx.font = '600 12px Arial'; ctx.textAlign = 'left';
    const label = it.name.length > 34 ? it.name.slice(0,34)+'…' : it.name;
    ctx.fillText(label, padX+10, y+18);
    ctx.textAlign = 'center'; ctx.font = '600 12px Arial';
    ctx.fillText(String(it.qty), padX+tableW*0.62, y+18);
    ctx.textAlign = 'right'; ctx.font = '700 12px Arial';
    ctx.fillText(Utils.fmtFCFA(it.price*it.qty), W-padX-10, y+18);
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(padX,y+rowH); ctx.lineTo(W-padX,y+rowH); ctx.stroke();
    y += rowH;
  });

  y += gapTable;

  /* ---- Totaux ---- */
  const totX = padX, totW = tableW;
  ctx.textAlign = 'left'; ctx.fillStyle = C.mid; ctx.font = '500 13px Arial';
  ctx.fillText('Sous-total', totX, y);
  ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = '600 12px Arial';
  ctx.fillText(Utils.fmtFCFA(order.amount - (order.deliveryFee||0) + (order.discount||0)), totX+totW, y);
  y += 22;
  if (order.discount){
    ctx.textAlign = 'left'; ctx.fillStyle = C.green; ctx.font = '500 13px Arial';
    ctx.fillText(`Réduction${order.promoCode?' ('+order.promoCode+')':''}`, totX, y);
    ctx.textAlign = 'right'; ctx.font = '600 12px Arial';
    ctx.fillText('−'+Utils.fmtFCFA(order.discount), totX+totW, y);
    y += 22;
  }
  if (order.deliveryFee){
    ctx.textAlign = 'left'; ctx.fillStyle = C.mid; ctx.font = '500 13px Arial';
    ctx.fillText(`Livraison${order.deliveryZone?' ('+order.deliveryZone+')':''}`, totX, y);
    ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = '600 12px Arial';
    ctx.fillText(Utils.fmtFCFA(order.deliveryFee), totX+totW, y);
    y += 22;
  }
  ctx.strokeStyle = C.navy; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(totX,y+2); ctx.lineTo(totX+totW,y+2); ctx.stroke(); ctx.lineWidth = 1;
  y += 24;
  ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = '800 16px Arial';
  ctx.fillText('Total payé', totX, y);
  ctx.textAlign = 'right'; ctx.fillStyle = C.blueDeep; ctx.font = '800 16px Arial';
  ctx.fillText(Utils.fmtFCFA(order.amount), totX+totW, y);

  y += gapTotals + statusH;

  /* ---- Statut de paiement ---- */
  ctx.textAlign = 'center'; ctx.font = '700 12px Arial';
  const statusText = order.status==='delivered' ? 'Statut : livraison confirmée ✓'
    : order.status==='confirmed' ? 'Statut : commande confirmée'
    : order.shipped ? 'Statut : en livraison'
    : 'Statut : en attente de confirmation du vendeur';
  ctx.fillStyle = order.status==='delivered' ? C.green : C.mango;
  ctx.fillText(statusText, W/2, y);

  y += gapStatus;

  /* ---- Mention légale ---- */
  ctx.fillStyle = C.legal;
  ctxRoundRect(ctx, padX, y, W-padX*2, legalH, 8); ctx.fill();
  ctx.fillStyle = C.mid; ctx.textAlign = 'center'; ctx.font = 'italic 400 10px Arial';
  ctx.fillText("Ce reçu fait office de preuve d'achat électronique, généré via l'application.", W/2, y+20);
  ctx.fillText(`${store.name || 'Boutique'}, propulsée par SIAMS. Conservez-le ou téléchargez le reçu PDF officiel.`, W/2, y+38);

  y += legalH + gapLegal;

  /* ---- Pied de page navy avec identité SIAMS ---- */
  ctx.fillStyle = C.navy; ctx.fillRect(0, y, W, footerH);
  ctx.textAlign = 'center'; ctx.fillStyle = C.cyan; ctx.font = '700 10px Arial';
  ctx.fillText('SIAMS', W/2, y+20);
  ctx.fillStyle = '#CBD8E6'; ctx.font = '500 10px Arial';
  ctx.fillText(`Tél. ${SIAMS_RECEIPT_IDENTITY.phone}  ·  ${SIAMS_RECEIPT_IDENTITY.email}`, W/2, y+36);

  return canvas.toDataURL('image/png');
}
function downloadReceipt(orderNumber){
  const img = document.getElementById('receipt-img');
  if(!img || !img.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = `recu-commande-${orderNumber}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  Toast.show('Reçu téléchargé ✓');
}

/* ---------- Reçu PDF officiel (logo SIAMS + logo boutique, étapes, CGV) ---------- */
function loadImageAsDataURL(url){
  return new Promise(resolve=>{
    if(!url){ resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try{
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img,0,0);
        resolve(c.toDataURL('image/png'));
      }catch(e){ resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
/* =========================================================================
   RENDU DE RÉFÉRENCE — REÇU OFFICIEL SIAMS
   -------------------------------------------------------------------------
   Ce moteur (renderSIAMSReceiptPDF) est LA référence visuelle et structurelle
   pour tout reçu émis par l'application, quelle que soit la nature du
   paiement ou de la transaction (commande boutique, abonnement, versement
   journalier, futur module de paiement…). Toute nouvelle fonctionnalité qui
   génère un paiement doit produire son reçu PDF en appelant cette fonction
   plutôt qu'en dessinant un document ad hoc.

   data = {
     receiptNumber   : string  (Utils.genReceiptNumber())
     docSubtitle     : string  ex. "Reçu de commande" / "Reçu d'abonnement"
     receiptDate     : timestamp ms — date d'émission du reçu
     paidDate        : timestamp ms — date effective du paiement
     clientNumber    : string|null
     agent           : string  — émis par (nom boutique / agent SIAMS)
     paymentMethod   : string  — libellé déjà traduit (FR)
     clientName, clientContact, clientAddress, clientPhone : string
     items           : [{ description, qty, unit, unitPrice, total }]
     subtotal, discount, deliveryFee, total : number (FCFA)
     bankLines       : [string] — lignes "Détails bancaires / Mobile Money"
     footerNote      : string — mention légale (remplace le texte par défaut)
   }
   ========================================================================= */
function drawPdfGradient(doc, x, y, w, h, colorA, colorB, steps){
  steps = steps || 48;
  const stepW = w/steps;
  for(let i=0;i<steps;i++){
    const t = i/(steps-1);
    const r = Math.round(colorA[0]+(colorB[0]-colorA[0])*t);
    const g = Math.round(colorA[1]+(colorB[1]-colorA[1])*t);
    const b = Math.round(colorA[2]+(colorB[2]-colorA[2])*t);
    doc.setFillColor(r,g,b);
    doc.rect(x+stepW*i, y, stepW+0.6, h, 'F');
  }
}
async function renderSIAMSReceiptPDF(doc, data){
  const logoPdf = await loadImageAsDataURL(LOGO_DATA_URI);

  const NAVY=[5,42,77], BLUE_DEEP=[0,96,217], BLUE=[0,152,232], CYAN=[0,214,238],
        INK=[22,35,47], MUTED=[92,107,122], LINE=[220,228,236], GREEN=[30,158,107], PAPER=[255,255,255];
  const W = doc.internal.pageSize.getWidth();
  const margin = 44;
  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('fr-FR') : '—';

  const issuer = data.issuer || SIAMS_RECEIPT_IDENTITY;
  /* ---------- En-tête : bandeau dégradé navy → bleu + badge (logo SIAMS ou photo boutique) ---------- */
  const headerH = 112;
  drawPdfGradient(doc, 0, 0, W, headerH, NAVY, BLUE_DEEP);
  doc.setFillColor(PAPER[0],PAPER[1],PAPER[2]);
  doc.roundedRect(W-margin-58, 20, 58, 58, 12, 12, 'F');
  try{ doc.addImage(issuer.logo || logoPdf, 'PNG', W-margin-53, 25, 48, 48); }catch(e){}
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold'); doc.setFontSize(28);
  doc.text('Reçu', margin, 54);
  doc.setFont('courier','normal'); doc.setFontSize(10);
  doc.text(`N° ${data.receiptNumber}`, margin, 72);
  if(data.docSubtitle){ doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(224,236,250); doc.text(data.docSubtitle, margin, 90); }
  /* ruban dégradé bleu → cyan sous l'en-tête */
  drawPdfGradient(doc, 0, headerH, W, 3, BLUE_DEEP, CYAN);

  /* ---------- Émetteur / Destinataire ---------- */
  let y = headerH + 34;
  const colW = (W-margin*2-32)/2;
  const col2X = margin+colW+32;
  doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(BLUE_DEEP[0],BLUE_DEEP[1],BLUE_DEEP[2]);
  doc.text('ÉMETTEUR', margin, y);
  doc.text('DESTINATAIRE', col2X, y, {align:'left'});
  y += 16;
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(INK[0],INK[1],INK[2]);
  doc.text(issuer.name, margin, y);
  doc.text(String(data.clientName||'—'), col2X, y);
  y += 15;
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(MUTED[0],MUTED[1],MUTED[2]);
  const emLines = [issuer.fullName, issuer.address, `Tél. : ${issuer.phone}`, issuer.email ? `Email : ${issuer.email}` : ''].filter(Boolean);
  const destLines = [data.clientContact||'', data.clientAddress||'', data.clientPhone||''].filter(Boolean);
  const maxLines = Math.max(emLines.length, destLines.length);
  for(let i=0;i<maxLines;i++){
    if(emLines[i]) doc.text(emLines[i], margin, y);
    if(destLines[i]) doc.text(destLines[i], col2X, y);
    y += 13;
  }
  y += 12;

  /* ---------- Bloc infos (fond gris clair) ---------- */
  const infoRows = [
    ['Date du reçu', fmtDate(data.receiptDate)],
    ['Paiement effectué le', fmtDate(data.paidDate)],
    ['Numéro de reçu', data.receiptNumber],
    ['Numéro de client', data.clientNumber || '—'],
    ['Émis par', data.agent || issuer.name],
    ['Mode de paiement', data.paymentMethod || '—']
  ];
  const infoBoxH = 22 + Math.ceil(infoRows.length/2)*17;
  doc.setFillColor(238,243,248); doc.setDrawColor(LINE[0],LINE[1],LINE[2]);
  doc.roundedRect(margin, y, W-margin*2, infoBoxH, 8, 8, 'FD');
  let iy = y+22, half = (W-margin*2-32)/2;
  infoRows.forEach((row,idx)=>{
    const cx = margin+16 + (idx%2)*(half+32-16);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(MUTED[0],MUTED[1],MUTED[2]);
    doc.text(row[0], cx, iy);
    doc.setFont('courier','bold'); doc.setFontSize(9.5); doc.setTextColor(INK[0],INK[1],INK[2]);
    doc.text(String(row[1]), cx+half-8, iy, {align:'right'});
    if(idx%2===1) iy += 17;
  });
  y += infoBoxH + 26;

  /* ---------- Tableau des articles ---------- */
  const cols = [
    {label:'Description', w:0.42, align:'left'},
    {label:'Qté', w:0.12, align:'center'},
    {label:'Unité', w:0.12, align:'center'},
    {label:'Prix unit.', w:0.17, align:'right'},
    {label:'Total', w:0.17, align:'right'}
  ];
  const tableW = W-margin*2;
  let cx0 = margin;
  doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
  doc.rect(margin, y, tableW, 24, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(255,255,255);
  cx0 = margin;
  cols.forEach(c=>{
    const cw = tableW*c.w;
    const tx = c.align==='left' ? cx0+10 : c.align==='right' ? cx0+cw-10 : cx0+cw/2;
    doc.text(c.label.toUpperCase(), tx, y+15, {align:c.align});
    cx0 += cw;
  });
  y += 24;
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(INK[0],INK[1],INK[2]);
  (data.items||[]).forEach((it,idx)=>{
    const rowH = 22;
    if(idx%2===1){ doc.setFillColor(248,250,252); doc.rect(margin, y, tableW, rowH, 'F'); }
    cx0 = margin;
    const money = v => `${Number(v||0).toLocaleString('fr-FR').replace(/\u202f|\s/g,' ')} FCFA`;
    const rowVals = [it.description, String(it.qty), it.unit||'u', money(it.unitPrice), money(it.total)];
    cols.forEach((c,i)=>{
      const cw = tableW*c.w;
      const tx = c.align==='left' ? cx0+10 : c.align==='right' ? cx0+cw-10 : cx0+cw/2;
      let val = rowVals[i];
      if(i===0 && val && val.length>46) val = val.slice(0,46)+'…';
      doc.text(String(val), tx, y+14, {align:c.align});
      cx0 += cw;
    });
    doc.setDrawColor(LINE[0],LINE[1],LINE[2]); doc.line(margin, y+rowH, margin+tableW, y+rowH);
    y += rowH;
  });
  y += 20;

  /* ---------- Totaux ---------- */
  const totW = 250, totX = W-margin-totW;
  const money = v => `${Number(v||0).toLocaleString('fr-FR').replace(/\u202f|\s/g,' ')} FCFA`;
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(MUTED[0],MUTED[1],MUTED[2]);
  doc.text('Sous-total', totX, y); doc.setTextColor(INK[0],INK[1],INK[2]); doc.setFont('helvetica','normal'); doc.text(money(data.subtotal||0), totX+totW, y, {align:'right'}); y+=16;
  if(data.discount){
    doc.setFont('helvetica','normal'); doc.setTextColor(GREEN[0],GREEN[1],GREEN[2]); doc.text('Remise', totX, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.text('−'+money(data.discount), totX+totW, y, {align:'right'}); y+=16;
  }
  if(data.deliveryFee){
    doc.setFont('helvetica','normal'); doc.setTextColor(MUTED[0],MUTED[1],MUTED[2]); doc.text('Livraison', totX, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(INK[0],INK[1],INK[2]); doc.text(money(data.deliveryFee), totX+totW, y, {align:'right'}); y+=16;
  }
  doc.setDrawColor(NAVY[0],NAVY[1],NAVY[2]); doc.setLineWidth(1.3); doc.line(totX, y+2, totX+totW, y+2); doc.setLineWidth(1); y += 20;
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(INK[0],INK[1],INK[2]);
  doc.text('Total payé', totX, y);
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(BLUE_DEEP[0],BLUE_DEEP[1],BLUE_DEEP[2]);
  doc.text(money(data.total||0), totX+totW, y, {align:'right'});
  y += 34;

  /* ---------- Chronologie de la commande (optionnelle) ----------
     Utilisée pour le reçu détaillé de livraison : retrace les étapes
     de la commande, de sa création jusqu'à la confirmation de réception. */
  if(data.timeline && data.timeline.length){
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(BLUE_DEEP[0],BLUE_DEEP[1],BLUE_DEEP[2]);
    doc.text('CHRONOLOGIE DE LA COMMANDE', margin, y);
    y += 14;
    doc.setDrawColor(LINE[0],LINE[1],LINE[2]);
    data.timeline.forEach((step,idx)=>{
      doc.setFillColor(GREEN[0],GREEN[1],GREEN[2]);
      doc.circle(margin+4, y-3, 3, 'F');
      if(idx<data.timeline.length-1) doc.line(margin+4, y, margin+4, y+15);
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(INK[0],INK[1],INK[2]);
      doc.text(step.label, margin+16, y);
      doc.setFont('courier','normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED[0],MUTED[1],MUTED[2]);
      doc.text(step.time || '—', W-margin, y, {align:'right'});
      y += 17;
    });
    y += 8;
  }

  /* ---------- Mention légale ---------- */
  doc.setDrawColor(LINE[0],LINE[1],LINE[2]);
  const legal = data.footerNote || "Le présent reçu constitue la preuve officielle du règlement effectué par le client auprès de SIAMS, pour le montant et à la date indiqués ci-dessus. Il fait foi entre les parties et peut être produit à toute fin utile, notamment auprès des autorités compétentes, conformément à la réglementation en vigueur en République de Côte d'Ivoire.";
  const legalLines = doc.splitTextToSize(legal, W-margin*2-28);
  const legalH = Math.max(42, legalLines.length*10 + 18);
  doc.setFillColor(240,246,251); doc.roundedRect(margin, y, W-margin*2, legalH, 8, 8, 'F');
  doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(MUTED[0],MUTED[1],MUTED[2]);
  doc.text(legalLines, margin+14, y+15);
  y += legalH + 14;

  /* ---------- Pied de page navy (3 colonnes) ---------- */
  const pageH = doc.internal.pageSize.getHeight();
  const footH = 86;
  const footY = Math.max(y, pageH-footH);
  if(footY + footH > pageH + 0.5){
    doc.addPage();
  }
  const safeFootY = doc.internal.pageSize.getHeight()-footH;
  doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]); doc.rect(0, safeFootY, W, footH, 'F');
  const fcolW = (W-margin*2)/3;
  const footCols = [
    { title:issuer.footerTitle || 'SIÈGE SOCIAL', lines:issuer.footerAddressLines || [issuer.name, 'Yopougon, Abidjan', "Côte d'Ivoire"] },
    { title:'COORDONNÉES', lines:[`Tél. : ${issuer.phone}`, issuer.email ? `Email : ${issuer.email}` : ''].filter(Boolean) },
    { title:'DÉTAILS BANCAIRES / MOBILE MONEY', lines: data.bankLines && data.bankLines.length ? data.bankLines : ['Voir application pour les détails de paiement'] }
  ];
  footCols.forEach((c,i)=>{
    const fx = margin + fcolW*i;
    let fy = safeFootY+22;
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(CYAN[0],CYAN[1],CYAN[2]);
    doc.text(c.title, fx, fy); fy += 13;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(203,216,230);
    c.lines.forEach(l=>{ doc.text(doc.splitTextToSize(l, fcolW-14), fx, fy); fy += 12; });
  });
}

async function downloadReceiptPDF(orderId){
  if(!await ensureJsPDF()){ Toast.show('Génération PDF indisponible, réessayez'); return; }
  const order = Store.orders.find(o=>o.id===orderId) || ClientOrderCache.get(orderId);
  if(!order){ Toast.show('Commande introuvable'); return; }
  const store = Store.store;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });

  if(!order.receiptNumber){ order.receiptNumber = Utils.genReceiptNumber(); Store.orders = Store.orders.map(o=>o.id===order.id?order:o); }

  const items = order.items.map(it=>({ description: it.name, qty: it.qty, unit:'u', unitPrice: it.price, total: it.price*it.qty }));
  const pay = Store.payment || {};
  const bankLines = [];
  if(pay.wave && pay.wave.enabled && pay.wave.number) bankLines.push(`Wave : ${pay.wave.number}`);
  if(pay.om && pay.om.enabled && pay.om.number) bankLines.push(`Orange Money : ${pay.om.number}`);
  if(pay.mtn && pay.mtn.enabled && pay.mtn.number) bankLines.push(`MTN Money : ${pay.mtn.number}`);
  if(!bankLines.length) bankLines.push('Paiement à la livraison');

  const fmtT = ts => ts ? new Date(ts).toLocaleString('fr-FR', {dateStyle:'short', timeStyle:'short'}) : null;
  let timeline = null;
  if(order.status==='delivered'){
    timeline = [
      { label:'Commande passée par le client', time: fmtT(order.createdAt) },
      { label:'Confirmée par la boutique', time: fmtT(order.confirmedAt) || '—' },
      { label:'Expédiée / prise en charge par le livreur', time: fmtT(order.shippedAt) || '—' },
      { label:'Réception confirmée par le client (photo à l’appui)', time: fmtT(order.deliveryConfirmedAt) || '—' }
    ];
  }

  await renderSIAMSReceiptPDF(doc, {
    receiptNumber: order.receiptNumber,
    docSubtitle: order.status==='delivered' ? `Reçu détaillé de livraison — ${store.name || 'Boutique'}` : `Reçu de commande — ${store.name || 'Boutique'}`,
    receiptDate: Date.now(),
    timeline,
    paidDate: order.createdAt,
    clientNumber: order.customer.phone,
    agent: store.name || 'Ma boutique',
    paymentMethod: PAY_LABELS[order.paymentMethod]||order.paymentMethod,
    clientName: order.customer.name,
    clientContact: order.customer.phone,
    clientAddress: order.customer.address,
    clientPhone: order.customer.phone,
    items,
    subtotal: order.amount - (order.deliveryFee||0) + (order.discount||0),
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    total: order.amount,
    bankLines,
    issuer: {
      name: store.name || 'Ma boutique',
      fullName: store.name || 'Ma boutique',
      address: store.address || '',
      phone: store.phone || '',
      email: store.email || '',
      logo: store.photo || null,
      footerTitle: 'BOUTIQUE',
      footerAddressLines: [store.name || 'Ma boutique', store.address || ''].filter(Boolean)
    },
    footerNote: "Ce reçu fait office de preuve d'achat. La commande n'est considérée comme livrée qu'après confirmation du client depuis l'application. Tout litige doit être signalé au vendeur dans les 48h suivant la livraison."
  });

  doc.save(`recu-commande-${order.number}.pdf`);
  Toast.show('Reçu PDF téléchargé ✓');
}

/* ---------- Reçu PDF officiel d'abonnement (réutilise le moteur de référence SIAMS) ---------- */
async function downloadSubscriptionReceiptPDF(){
  if(!await ensureJsPDF()){ Toast.show('Génération PDF indisponible, réessayez'); return; }
  const access = Store.access();
  if(access.status!=='active' || !access.contractRef){ Toast.show('Aucun abonnement actif à ce jour'); return; }
  const store = Store.store;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });

  const receiptNumber = Store.subscription.receiptNumber || Utils.genReceiptNumber();
  if(!Store.subscription.receiptNumber){ Store.subscription = { ...Store.subscription, receiptNumber }; }
  const renewDate = access.renewsAt ? new Date(access.renewsAt).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'}) : '—';

  const items = [{ description:`Abonnement ${access.label} — mensuel (sans commission sur les ventes)`, qty:1, unit:'mois', unitPrice: access.amount||0, total: access.amount||0 }];
  const bankLines = [];
  if(access.paymentMethod==='card'){ bankLines.push(`${PAYMENT_INFO.bankName} : carte se terminant par ${(PAYMENT_INFO.cardNumber||'').slice(-4)}`); }
  else if(PAYMENT_INFO.djamoNumber){ bankLines.push(`Djamo : ${PAYMENT_INFO.djamoNumber}`); }

  await renderSIAMSReceiptPDF(doc, {
    receiptNumber,
    docSubtitle: "Reçu d'abonnement — SIAMS",
    receiptDate: Date.now(),
    paidDate: access.activatedAt,
    clientNumber: store.phone || null,
    agent: 'SIAMS',
    paymentMethod: SUB_PAY_LABELS[access.paymentMethod] || access.paymentMethod || '—',
    clientName: store.name || 'Ma boutique',
    clientContact: store.phone || '',
    clientAddress: `Réf. contrat : ${access.contractRef}`,
    clientPhone: `Prochain renouvellement : ${renewDate}`,
    items,
    subtotal: access.amount||0,
    discount: 0,
    deliveryFee: 0,
    total: access.amount||0,
    bankLines,
    footerNote: "Ce reçu fait office de preuve de paiement de l'abonnement SIAMS pour la boutique désignée ci-dessus. La référence de contrat identifie de manière unique cet abonnement. Tout litige doit être signalé sous 48h. Document généré automatiquement — SIAMS."
  });

  doc.save(`recu-abonnement-${access.contractRef}.pdf`);
  Toast.show('Reçu PDF téléchargé ✓');
}

/* ---------- Confirmation ---------- */
Views.confirmation = function(opts){
  const order = Store.orders.find(o=>o.number===opts.orderNumber);
  const store = Store.store;
  let waLink = '';
  if(order){
    const lines = order.items.map(i=>`• ${i.name} ×${i.qty} — ${Utils.fmtFCFA(i.price*i.qty)}`).join('\n');
    const waText = `Nouvelle commande #${order.number}\nClient : ${order.customer.name} (${order.customer.phone})\nAdresse : ${order.customer.address}\n\n${lines}\n\nTotal : ${Utils.fmtFCFA(order.amount)}`;
    waLink = `https://wa.me/225${(store.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(waText)}`;
  }
  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('shop')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1 style="font-size:19px;">Confirmation</h1></div>
  </div>
  <div style="padding:24px 20px 24px;text-align:center;">
    <div style="width:76px;height:76px;border-radius:22px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h1 style="font-size:21px;margin:0 0 8px;">Commande envoyée ✓</h1>
    <p style="color:var(--text-mid);font-size:14px;line-height:1.5;margin:0 0 4px;">Votre commande <strong class="mono">#${opts.orderNumber}</strong> a bien été transmise au vendeur.</p>
    <p style="color:var(--text-mid);font-size:14px;line-height:1.5;margin:0;">Vous serez contacté sur WhatsApp pour la suite.</p>
    ${order ? `<div style="margin:16px auto 0;max-width:360px;padding:12px 14px;border-radius:14px;background:var(--panel);border:1px solid var(--line);text-align:left;font-size:12.5px;"><strong>Mode de paiement :</strong> ${Utils.escapeHtml(PAY_LABELS[order.paymentMethod]||order.paymentMethod||'Paiement à la livraison')}${order.paymentMethod!=='cash' && Store.payment[order.paymentMethod]?.number ? `<br><span style="color:var(--text-mid);">Numéro : ${Utils.escapeHtml(Store.payment[order.paymentMethod].number)}</span>` : ''}</div>` : ''}
  </div>
  ${order ? `
  <div class="receipt-wrap"><img id="receipt-img" alt="Reçu de commande #${opts.orderNumber}"></div>
  <div class="receipt-hint">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex:none;"><rect x="4" y="2" width="16" height="20" rx="2" stroke="var(--mango-dark)" stroke-width="1.7"/><path d="M9 7h6M9 11h6M9 15h3" stroke="var(--mango-dark)" stroke-width="1.7" stroke-linecap="round"/></svg>
    <span>C'est votre reçu officiel. Faites-en une <strong>capture d'écran</strong> ou touchez « Télécharger le reçu » pour le conserver comme preuve d'achat.</span>
  </div>
  <div style="padding:0 20px;">
    <button class="btn btn-outline btn-block" style="margin-bottom:10px;" onclick="downloadReceiptPDF('${order.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Télécharger le reçu (PDF)</button>
    ${waLink ? `<button class="btn btn-soft-green btn-block" style="margin-bottom:10px;" onclick="window.open('${waLink}','_blank')"><svg width="16" height="16" viewBox="0 0 448 512" fill="var(--green)"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>Confirmer sur WhatsApp</button>` : ''}
    <button class="btn btn-mango btn-block" style="margin-bottom:10px;" onclick="Router.go('order-track',{id:'${order.id}'})">Suivre ma commande</button>
    <button class="btn btn-ghost btn-block" style="margin-bottom:24px;" onclick="Router.go('shop')">Retour à la boutique</button>
  </div>` : `
  <div style="padding:0 20px;text-align:center;">
    <button class="btn btn-primary btn-block" onclick="Router.go('shop')">Retour à la boutique</button>
  </div>`}
  `;
};
Views._after_confirmation = function(opts){
  const order = Store.orders.find(o=>o.number===opts.orderNumber);
  const img = document.getElementById('receipt-img');
  if(order && img) img.src = buildReceiptDataURL(order);
};

/* ---------- Suivi de commande client (étapes professionnelles) ---------- */
Views['order-track'] = function(opts){
  const order = Store.orders.find(o=>o.id===opts.id);
  if(!order) return `${TopBar('Commande introuvable')}<div style="padding:20px;">${EmptyState(ICONS.box,'Commande introuvable',"Cette commande n'existe pas ou a été supprimée.")}</div>`;
  const shipped = !!order.shipped || order.status==='delivered';
  const delivered = order.status==='delivered';
  const confirmed = order.status==='confirmed' || delivered;
  const fmtT = ts => ts ? new Date(ts).toLocaleString('fr-FR') : '';

  const steps = [
    { key:'placed', title:'Commande reçue', desc:`Votre commande #${order.number} a été transmise au vendeur.`, done:true, time:fmtT(order.createdAt) },
    { key:'confirmed', title:'Confirmée par le vendeur', desc: confirmed ? "Le vendeur prépare vos articles." : "En attente de confirmation par le vendeur.", done:confirmed, current: !confirmed, time: confirmed?fmtT(order.confirmedAt):'' },
    { key:'shipped', title:'En cours de livraison', desc: shipped ? "Votre colis est en route." : "Votre colis sera bientôt pris en charge pour la livraison.", done:shipped, current: confirmed && !shipped, time: shipped?fmtT(order.shippedAt):'' },
    { key:'delivered', title:'Livrée', desc: delivered ? "Réception confirmée avec photo à l'appui." : "À valider dès réception de votre colis.", done:delivered, current: shipped && !delivered, time: delivered?fmtT(order.deliveryConfirmedAt):'' },
  ];

  return `
  <div class="topbar" style="padding-top:18px;">
    <div style="display:flex;align-items:center;gap:12px;"><button class="bell-btn" onclick="Router.go('shop-account')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><h1 style="font-size:19px;">Suivi de commande</h1></div>
  </div>
  <div class="track-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <div><div class="mono" style="font-size:13px;color:var(--text-mid);">Commande</div><div style="font-weight:700;font-size:16px;">#${order.number}</div></div>
      <div style="text-align:right;"><div style="font-size:13px;color:var(--text-mid);">Total</div><div class="mono" style="font-weight:700;font-size:16px;color:var(--indigo);">${Utils.fmtFCFA(order.amount)}</div></div>
    </div>
    ${steps.map((s,i)=>`
      <div class="track-step ${s.done?'done':''} ${s.current?'current':''}">
        ${i<steps.length-1 ? '<div class="track-step-line"></div>' : ''}
        <div class="track-step-dot">${s.done?`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`:(i+1)}</div>
        <div class="track-step-body">
          <h4>${s.title}</h4>
          <p>${s.desc}</p>
          ${s.time ? `<div class="ts-time">${s.time}</div>` : ''}
          ${s.key==='delivered' && s.current ? `
            <div style="margin-top:12px;border:1.5px dashed var(--line);border-radius:var(--radius-sm);padding:12px;">
              <p style="margin:0 0 10px;font-size:12.5px;color:var(--text-mid);">Prenez une photo de l'article reçu pour valider définitivement la livraison.</p>
              <input type="file" accept="image/*" capture="environment" id="delivery-photo-input" class="hidden" onchange="handleDeliveryPhoto(event,'${order.id}')">
              <div id="delivery-photo-preview"></div>
              <button class="btn btn-mango btn-sm" style="width:100%;" onclick="document.getElementById('delivery-photo-input').click()">📷 Ajouter une photo & confirmer la réception</button>
            </div>` : ''}
        </div>
      </div>`).join('')}
  </div>
  ${order.courierId && shipped && !delivered ? `<div id="client-courier-live-${order.id}" style="margin:0 20px 16px;border:1.5px solid var(--green);background:var(--green-tint);border-radius:var(--radius-md);padding:14px 16px;"><div style="font-weight:800;margin-bottom:5px;">🚚 Livraison prise en charge</div><div style="font-size:12.5px;color:var(--text-mid);">${Utils.escapeHtml(order.deliveryStatusMessage||'Votre livreur a pris en charge la commande. Sa position sera mise à jour pendant le trajet.')}</div><div id="client-courier-coords-${order.id}" style="font-size:12px;color:var(--text-soft);margin-top:8px;">Position du livreur : attente de la prochaine mise à jour…</div></div>` : ''}
  ${delivered && order.deliveryPhoto ? `
  <div class="home-section-row" style="padding-top:0;"><h3 style="font-size:14.5px;">Photo de réception</h3></div>
  <div style="margin:0 20px 20px;border-radius:var(--radius-md);overflow:hidden;border:1.5px solid var(--line);"><img src="${order.deliveryPhoto}" style="width:100%;display:block;"></div>
  ${buildDetailedReceiptHtml(order)}` : ''}
  <div style="padding:0 20px 28px;">
    <button class="btn btn-ghost btn-block" onclick="Router.go('shop-account')">Retour à mon compte</button>
  </div>
  `;
};
/* ---------- Reçu détaillé (du début de la commande jusqu'à la livraison) ----------
   Affiché juste sous la photo de confirmation de réception, avec bouton de
   téléchargement PDF (renderSIAMSReceiptPDF, chronologie incluse). Le fait
   que la commande soit livrée + reçu disponible remonte automatiquement
   dans les statistiques boutique (carte « Reçus de livraison signés »). */
function buildDetailedReceiptHtml(order){
  const fmtT = ts => ts ? new Date(ts).toLocaleString('fr-FR', {dateStyle:'short', timeStyle:'short'}) : '—';
  const steps = [
    { label:'Commande passée', time: fmtT(order.createdAt), done:true },
    { label:'Confirmée par la boutique', time: fmtT(order.confirmedAt), done:!!order.confirmedAt },
    { label:'Expédiée', time: fmtT(order.shippedAt), done:!!order.shippedAt },
    { label:'Réception confirmée (photo à l’appui)', time: fmtT(order.deliveryConfirmedAt), done:!!order.deliveryConfirmedAt }
  ];
  return `
  <div class="home-section-row" style="padding-top:0;"><h3 style="font-size:14.5px;">Reçu détaillé de la commande</h3></div>
  <div style="margin:0 20px 14px;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;background:#fff;">
    ${steps.map(s=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12.5px;border-bottom:1px solid var(--line);">
        <span style="color:${s.done?'var(--text)':'var(--text-soft)'};font-weight:${s.done?'700':'400'};">${s.done?'✓ ':'• '}${s.label}</span>
        <span class="mono" style="color:var(--text-mid);">${s.time}</span>
      </div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding-top:10px;font-weight:700;font-size:14px;"><span>Total payé</span><span class="mono">${Utils.fmtFCFA(order.amount)}</span></div>
  </div>
  <div style="padding:0 20px 20px;">
    <button class="btn btn-primary btn-block" onclick="downloadReceiptPDF('${order.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 20h14" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Télécharger le reçu détaillé (PDF)</button>
    <div style="font-size:11px;color:var(--text-soft);margin-top:8px;text-align:center;">Ce reçu professionnel retrace toutes les étapes de votre commande, du passage de commande jusqu'à la livraison confirmée.</div>
  </div>`;
}
async function handleDeliveryPhoto(evt, orderId){
  const file = evt.target.files && evt.target.files[0];
  if(!file) return;
  const order = Store.orders.find(o=>String(o.id)===String(orderId));
  if(!order) return;
  if(order.status==='delivered'){ Toast.show('Cette commande est déjà livrée.'); return; }
  if(order.status!=='confirmed' || !order.shipped){
    Toast.show('La commande doit être confirmée et en cours de livraison.');
    return;
  }
  const input=evt.target;
  const button=document.querySelector(`[onclick=\"document.getElementById('delivery-photo-input').click()\"]`);
  if(button){button.disabled=true;button.textContent='⏳ Confirmation de la livraison…';}
  try{
    const token=await ensureDeliverySecurityToken(order);
    if(!token) throw new Error('security_token_unavailable');
    const localDataUrl=await siamsPrepareImageDataURL(file);
    const dataUrl=await Cloud.ensureStoredUrl(localDataUrl, 'delivery-photos');
    const {error}=await sb.rpc('confirm_order_delivery',{p_order_id:orderId,p_token:token,p_photo_url:dataUrl});
    if(error) throw error;
    const now=Date.now();
    const updated={...order,status:'delivered',shipped:true,deliveryPhoto:dataUrl,deliveryConfirmedAt:now};
    _cache.orders=(_cache.orders||[]).map(o=>String(o.id)===String(orderId)?updated:o);
    ClientOrderCache.save(updated);
    Cloud.pushCommission(Store.commissionDue(),Store.commissionSettled).catch(e=>console.error('Sync error [commission]',e));
    try{if(typeof AutoSync!=='undefined')AutoSync.refresh(true);}catch(e){}
    Notify.add('order',`Le client a confirmé la réception de la commande #${order.number} avec photo à l'appui ✓`);
    ClientNotify.add(order.number,`Merci ! Réception de la commande #${order.number} confirmée avec succès.`);
    showDeliveredBadge();
    Toast.show('✓ Commande terminée — livraison confirmée');
    Router.go('order-track',{id:orderId});
  }catch(e){
    console.error('Confirmation livraison par photo',e);
    Toast.show('⚠️ Impossible de confirmer la livraison. Vérifiez la connexion puis réessayez.');
    if(button){button.disabled=false;button.textContent='📷 Ajouter une photo & confirmer la réception';}
    if(input)input.value='';
  }
}
function showDeliveredBadge(){
  const el = document.createElement('div');
  el.className = 'delivered-badge-overlay';
  el.innerHTML = `<div class="delivered-badge-pop">
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#1E9E6B"/><path d="m7 12.5 3.2 3.2L17 9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div>Livraison confirmée ✓</div>
  </div>`;
  document.body.appendChild(el);
  setTimeout(()=>el.classList.add('show'), 20);
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 1900);
}

/* ---------------- Promo carousel dots ---------------- */
function initPromoCarousel(){
  const row = document.getElementById('promo-row');
  const dotsWrap = document.getElementById('promo-dots');
  if(!row || !dotsWrap) return;
  const cards = row.querySelectorAll('.promo-card');
  dotsWrap.innerHTML = Array.from(cards).map((_,i)=>`<div class="dot${i===0?' active':''}"></div>`).join('');
  const dots = dotsWrap.querySelectorAll('.dot');
  let ticking = false;
  row.addEventListener('scroll', ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const rowCenter = row.scrollLeft + row.clientWidth/2;
      let closest = 0, closestDist = Infinity;
      cards.forEach((card,i)=>{
        const cardCenter = card.offsetLeft + card.offsetWidth/2;
        const dist = Math.abs(cardCenter - rowCenter);
        if(dist < closestDist){ closestDist = dist; closest = i; }
      });
      dots.forEach((d,i)=>d.classList.toggle('active', i===closest));
      ticking = false;
    });
  }, {passive:true});
}

/* ---------- Position livreur côté client ----------
   La position est lue par une RPC protégée par le token de livraison.
   Cela évite d'ouvrir la table delivery_tracking en lecture publique. */
let courierClientPoll=null;
async function startClientCourierRealtime(orderId){
  const el=document.getElementById('client-courier-live-'+orderId);
  if(!el) return;
  if(courierClientPoll) clearInterval(courierClientPoll);
  const refresh=async()=>{
    try{
      const order=Store.orders.find(o=>o.id===orderId);
      if(!order||!order.deliveryToken) return;
      const {data,error}=await sb.rpc('get_public_courier_location',{p_order_id:orderId,p_delivery_token:order.deliveryToken});
      if(error||!data) return;
      const r=Array.isArray(data)?data[0]:data;
      const c=document.getElementById('client-courier-coords-'+orderId);
      if(!c||!r||!r.latitude||!r.longitude)return;
      c.innerHTML=`Dernière position : ${new Date(r.recorded_at||Date.now()).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · précision ${Math.round(r.accuracy||0)} m · <button class="btn btn-soft-green btn-sm" onclick="window.open('https://www.google.com/maps?q='+${Number(r.latitude)}+','+${Number(r.longitude)},'_blank')">Voir / itinéraire</button>`;
    }catch(e){ console.error('courier location',e); }
  };
  await refresh();
  courierClientPoll=setInterval(refresh,5000);
}

Views._after_order_track=function(opts){ if(opts&&opts.id) setTimeout(()=>startClientCourierRealtime(opts.id),0); };

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  const initBottomNav = document.getElementById('bottom-nav');
  if(initBottomNav) initBottomNav.classList.add('hidden');
  const initRoot = document.getElementById('page-root');
  initRoot.innerHTML = Views.loading();
  const stopSplashLoop = siamsStartSplashLoop(initRoot);
  /* Le chargement réel démarre tout de suite, en parallèle de ce délai minimum
     (juste assez pour que l'animation ne clignote pas) — au lieu d'attendre
     bêtement 3 secondes avant même de commencer à charger quoi que ce soit. */
  const splashMinDelay = new Promise(resolve=>setTimeout(resolve, 900));
  try{
    /* ---- Vitrine publique : /{slug}[?produit={id}] ---- */
    const path = location.pathname.replace(/^\/+|\/+$/g, '');
    const qsEarly = new URLSearchParams(location.search);
    const courierInviteToken = qsEarly.get('courier_invite');
    if(path.toLowerCase()==='livreur'){ Router.go(courierSession()?'courier-dashboard':'courier-login'); return; }
    if(courierInviteToken){ setCourierSession(null); Router.go('courier-login'); return; }
    /* URL publique : /?boutique=slug (robuste sur Vercel) ou ancien /slug. */
    const querySlug = qsEarly.get('boutique') || qsEarly.get('store') || qsEarly.get('shop');
    const pathSlug = path && path.toLowerCase() !== 'index.html' ? path.split('/')[0] : null;
    const slug = querySlug || pathSlug;
    const isPublicStoreUrl = !!slug;

    if(slug){
      /* ---- Ce bloc a son propre try/catch : un lien de boutique cassé (réseau,
         Supabase, etc.) ne doit JAMAIS renvoyer un client sur l'écran marchand
         « Découvrir SIAMS / créer ma boutique » (catch générique plus bas) — il
         doit voir un message d'erreur adapté à un client, avec le détail affiché
         à l'écran pour pouvoir nous le transmettre facilement en capture. ---- */
      try{
        const store = await Cloud.ensurePublicStore(slug);
        if(!store){
          document.getElementById('page-root').innerHTML = `
            <div style="padding:60px 24px;text-align:center;">
              <h2 style="color:var(--text);">Boutique introuvable</h2>
              <p style="color:var(--text-soft,#888);">Ce lien n'est plus valide ou la boutique a été retirée.</p>
              <button class="btn btn-primary" style="margin-top:20px;" onclick="location.href=location.origin">Connexion</button>
            </div>`;
          return;
        }
        await Cloud.loadAll();
        setPublicStoreMeta(Store.store);
        Auth.loggedIn = false;
        AutoSync.start();
        const qs = new URLSearchParams(location.search);
        const productId = qs.get('produit');
        /* Les anciens paramètres de confirmation sont ignorés. La livraison est
           désormais validée directement par la photo prise dans le suivi de commande. */
        await splashMinDelay;
        if(productId){
          const sharedProduct = Store.products.find(p=>String(p.id)===String(productId));
          if(sharedProduct){ Router.go('shop-product', {id: sharedProduct.id}); }
          else { Toast.show('Article introuvable ou retiré'); Router.go('shop', {skipOnboarding:true, source:'public-link'}); }
        }
        else { Router.go('shop', {skipOnboarding:true, source:'public-link'}); }
        Notify.renderBell();
      }catch(publicErr){
        console.error('Erreur boutique publique', publicErr);
        document.getElementById('page-root').innerHTML = `
          <div style="padding:60px 24px;text-align:center;">
            <h2 style="color:var(--text);">Boutique temporairement indisponible</h2>
            <p style="color:var(--text-soft,#888);">Une erreur technique empêche l'affichage de cette boutique pour le moment. Vous pouvez réessayer, ou transmettre le détail ci-dessous au support.</p>
            <button class="btn btn-primary" style="margin-top:20px;" onclick="location.reload()">Réessayer</button>
            <p style="margin-top:24px;font-size:11px;color:#b91c1c;word-break:break-all;">${Utils.escapeHtml(String((publicErr&&(publicErr.message||publicErr.toString&&publicErr.toString()))||publicErr))}</p>
          </div>`;
      }
      return;
    }

    /* ---- Comportement existant : espace marchand ---- */
    const { data:{ session } } = await sb.auth.getSession();
    if(session && session.user){
      Auth.loggedIn = true;
      await Bootstrap.loadStoreData(session.user);
      Store.trialStartedAt; // amorce le pass gratuit de 20 jours dès la première ouverture
      ThemeUnlock.init();
      await splashMinDelay;
      Router.go('dashboard');
      AutoSync.start();
    } else {
      await splashMinDelay;
      if(ActivationGate.getStored()){
        Router.go('register');
      } else if(ActivationGate.hasPendingRequest()){
        Router.go('activation-code');
      } else {
        Router.go('welcome');
      }
    }
  } catch(e){
    console.error(e);
    Auth.loggedIn = false;
    await splashMinDelay;
    Router.go('welcome');
  } finally {
    stopSplashLoop();
  }
  Notify.renderBell();
});
