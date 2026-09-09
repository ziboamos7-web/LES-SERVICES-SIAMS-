/* =========================================================
   BELOU STORE — architecture: Store / Notify / Router / Views
   ========================================================= */

/* ---------------- Logo SIAMS ---------------- */
const LOGO_DATA_URI = "images/logo.webp";

/* ---------------- Supabase ---------------- */
const SUPABASE_URL = 'https://anlqgkrjiwkeaqikgdcd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xc3fRNdG_R-CNkeVBseU2w_sIDz-3j4';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------------- Chargement paresseux des librairies lourdes ----------------
   jsPDF (~350 Ko) ne sert que pour l'export PDF. Il est injecté uniquement
   au premier export afin de garder le démarrage rapide sur mobile. */
const _scriptCache = {};
function loadScriptOnce(key, src){
  if(_scriptCache[key]) return _scriptCache[key];
  _scriptCache[key] = new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = ()=>{ delete _scriptCache[key]; reject(new Error('load failed: '+src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[key];
}
async function ensureJsPDF(){
  if(window.jspdf) return true;
  try{ await loadScriptOnce('jspdf', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'); return true; }
  catch(e){ console.error(e); return false; }
}
/* ---------------- Utils ---------------- */
const Utils = {
  fmtFCFA(n){ return Number(n||0).toLocaleString('fr-FR').replace(/[\u202F\u00A0\u2009,]/g,' ') + ' FCFA'; },
  escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  /* ---- Transforme un nom de boutique en lien propre et lisible : "Amos Boutique" -> "amos-boutique" ---- */
  slugify(name){
    return String(name||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // retire les accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0, 40) || 'boutique';
  },
  /* ---- Référence de contrat d'abonnement : SIGO-<PLAN>-<horodatage base36>-<aléatoire> ---- */
  genContractRef(planKey){
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    return `SIGO-${(planKey||'').toUpperCase()}-${stamp}-${rand}`;
  },
  /* ---- Référence du contrat d'utilisation SIAMS (généré à l'inscription) : SIAMS-CTR-<horodatage base36>-<aléatoire> ---- */
  genAccountContractRef(){
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    return `SIAMS-CTR-${stamp}-${rand}`;
  },
  uid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  },
  /* ---- ID marchand SIAMS utilisateur : SIAMS-XXXXXX ----
     Remplace l'e-mail pour se reconnecter. Sans caractères ambigus (0/O, 1/I). ---- */
  genLoginId(){
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for(let i=0;i<6;i++) rand += chars[Math.floor(Math.random()*chars.length)];
    return `SIAMS-${rand}`;
  },
  /* ---- Code de commande lisible : initiales de la boutique + suffixe aléatoire
     (ex: "SIAMS Boutique" -> "SIA-4K9F2"). Remplace le simple compteur 1001, 1002... ---- */
  genOrderCode(storeName){
    const initials = (storeName||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toUpperCase().replace(/[^A-Z0-9\s]/g,'')
      .split(/\s+/).filter(Boolean)
      .map(w=>w[0]).join('').slice(0,4) || 'BTQ';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
    let rand = '';
    for(let i=0;i<5;i++) rand += chars[Math.floor(Math.random()*chars.length)];
    return `${initials}-${rand}`;
  },
  /* ---- Numéro de reçu officiel SIAMS (distinct du n° de commande) : SIAMS-R-<horodatage base36>-<aléatoire> ---- */
  genReceiptNumber(){
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    return `SIAMS-R-${stamp}-${rand}`;
  },
  timeAgo(ts){
    const s = Math.floor((Date.now()-ts)/1000);
    if(s<60) return "à l'instant";
    if(s<3600) return Math.floor(s/60)+' min';
    if(s<86400) return Math.floor(s/3600)+' h';
    return Math.floor(s/86400)+' j';
  },
  dayLabel(d){ return ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()]; },
  /* ---- Libellé lisible d'une combinaison de variante (taille/couleur/attributs
     personnalisés) pour un item de panier ou de commande. ---- */
  variantLabel(item){
    const bits = [item.size, item.color].filter(Boolean);
    if(item.extra){ Object.keys(item.extra).forEach(k=>{ if(item.extra[k]) bits.push(item.extra[k]); }); }
    return bits.join(' · ');
  },
  /* ---- Encodage discret de métadonnées (tailles / couleurs) dans la description ----
     Permet de conserver ces infos via la colonne "description" existante, sans
     modification du schéma de la base de données. ---- */
  encodeMeta(desc, meta){
    const clean = (desc||'').replace(/\n?<!--SIGO_META:.*?-->\s*$/s, '');
    const extra = (meta.extra||[]).filter(g=>g.label && g.values && g.values.length);
    const hasMeta = (meta.sizes && meta.sizes.length) || (meta.colors && meta.colors.length) || extra.length;
    const payload = {sizes:meta.sizes||[], colors:meta.colors||[], extra};
    return hasMeta ? `${clean}\n<!--SIGO_META:${JSON.stringify(payload)}-->` : clean;
  },
  decodeMeta(desc){
    const raw = desc || '';
    const m = raw.match(/<!--SIGO_META:(.*?)-->\s*$/s);
    let meta = {sizes:[], colors:[], extra:[]};
    if(m){ try{ meta = {...meta, ...JSON.parse(m[1])}; }catch(e){} }
    const clean = raw.replace(/\n?<!--SIGO_META:.*?-->\s*$/s, '').trim();
    return { desc: clean, sizes: meta.sizes||[], colors: meta.colors||[], extra: (meta.extra||[]).filter(g=>g&&g.label&&Array.isArray(g.values)) };
  },
  /* ---- Petit stockage local additionnel (retraits, email de contact) ---- */
  localKey(name){ const slug = (Store.store && Store.store.slug) ? Store.store.slug : 'default'; return `sigo_${name}_${slug}`; },
  getLocal(name, fallback){ try{ const v = localStorage.getItem(Utils.localKey(name)); return v!=null ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
  setLocal(name, value){ try{ localStorage.setItem(Utils.localKey(name), JSON.stringify(value)); }catch(e){} }
};

/* ---------------- Cloud (Supabase sync layer) ---------------- */
const Cloud = {
  storeId: null,
  loginId: null,
  publicMode: false,
  _orderWritePromises: Object.create(null),
  categories: [], // [{id,name}]

  catId(name){ const c = this.categories.find(x=>x.name===name); return c ? c.id : null; },
  catName(id){ const c = this.categories.find(x=>x.id===id); return c ? c.name : ''; },

  /* ---- Convertit une data URL base64 (photo/bannière/preuve de paiement générée
     en local par siamsPrepareImageDataURL) en un vrai fichier hébergé sur Supabase
     Storage, et renvoie l'URL publique à stocker en base. Ne fait rien si la valeur
     est déjà une URL (http/https) : évite un ré-upload inutile à chaque sauvegarde. ---- */
  MEDIA_BUCKET: 'assets',
  async ensureStoredUrl(value, folder){
    if(!value || typeof value !== 'string' || !value.startsWith('data:')) return value;
    const blob = await (await fetch(value)).blob();
    const ext = ((blob.type.split('/')[1]||'jpg').split('+')[0]||'jpg').replace(/[^a-z0-9]/gi,'') || 'jpg';
    const path = `${folder}/${this.storeId||'shared'}/${Date.now()}-${Utils.uid().replace(/-/g,'')}.${ext}`;
    const { error:upErr } = await sb.storage.from(this.MEDIA_BUCKET).upload(path, blob, { contentType: blob.type||undefined, upsert:false, cacheControl:'31536000' });
    if(upErr){ console.error('Sync error [storage upload '+folder+']', upErr); throw upErr; }
    const { data:pub } = sb.storage.from(this.MEDIA_BUCKET).getPublicUrl(path);
    if(!pub || !pub.publicUrl) throw new Error('URL publique indisponible après upload ('+folder+')');
    return pub.publicUrl;
  },

  async ensureStore(userId, phone){
    let { data } = await sb.from('stores').select('*').eq('owner_id', userId).order('created_at', {ascending:true}).limit(1);
    let store = (data && data[0]) || null;
    if(!store){
      const slug = 'boutique-' + userId.slice(0,8) + '-' + Math.random().toString(36).slice(2,6);
      const loginId = Utils.genLoginId();
      const ins = await sb.from('stores').insert({ owner_id:userId, name:'Ma boutique', slug, phone: phone || '', login_id: loginId }).select().single();
      store = ins.data;
      /* ---- Boutique tout juste créée : on sème les catégories/moyens de paiement
         par défaut ici, une seule fois, plutôt qu'à chaque connexion (voir
         ensureDefaults, conservé seulement pour les vieux comptes non semés). ---- */
      if(store) await this.ensureDefaults(store.id);
    } else if(!store.login_id){
      /* Compte créé avant l'ajout de cette fonctionnalité : on génère l'identifiant à la volée. */
      const loginId = Utils.genLoginId();
      const upd = await sb.from('stores').update({ login_id: loginId }).eq('id', store.id).select().single();
      store = upd.data || { ...store, login_id: loginId };
    }
    this.storeId = store.id;
    this.loginId = store.login_id || '';
    this.publicMode = false;
    return store;
  },

  async ensurePublicStore(slug){
    const { data: store, error } = await sb.from('stores').select('id').eq('slug', slug).maybeSingle();
    if(error || !store) return null;
    this.storeId = store.id;
    this.loginId = null;
    this.publicMode = true;
    return store;
  },

  /* ---- Sème les catégories/moyens de paiement par défaut si absents. Appelée une
     fois à la création d'une boutique (ensureStore) ; conservée aussi en filet de
     sécurité pour les comptes créés avant l'ajout de cette fonctionnalité, mais
     alors lancée en arrière-plan (voir loadStoreData) pour ne jamais ralentir
     l'écran de connexion des boutiques déjà à jour. ---- */
  async ensureDefaults(storeId){
    const sid = storeId || this.storeId;
    const [catRes, payRes] = await Promise.all([
      sb.from('categories').select('id').eq('store_id', sid).limit(1),
      sb.from('payment_methods').select('id').eq('store_id', sid).limit(1)
    ]);
    const jobs = [];
    if(!catRes.data || !catRes.data.length){
      const defaults = ['Vêtements','Chaussures','Sacs','Montres','Bijoux & Accessoires','Autres'];
      jobs.push(sb.from('categories').insert(defaults.map(name=>({store_id:sid, name}))));
    }
    if(!payRes.data || !payRes.data.length){
      jobs.push(sb.from('payment_methods').insert([
        {store_id:sid, method_key:'wave', enabled:false, number:''},
        {store_id:sid, method_key:'om', enabled:false, number:''},
        {store_id:sid, method_key:'mtn', enabled:false, number:''},
        {store_id:sid, method_key:'moov', enabled:false, number:''},
        {store_id:sid, method_key:'cash', enabled:true, number:null}
      ]));
    }
    if(jobs.length) await Promise.all(jobs);
  },

  async loadAll(){
    const sid = this.storeId;
    const [storeRes, prodRes, ordRes, teamRes, payRes, zoneRes, promoRes, revRes, notifRes, catRes, menuRes] = await Promise.all([
      sb.from('stores').select('*').eq('id', sid).single(),
      sb.from('products').select('*').eq('store_id', sid).order('created_at', {ascending:false}),
      sb.from('orders').select('*').eq('store_id', sid).order('created_at', {ascending:false}),
      sb.from('team_members').select('*').eq('store_id', sid),
      sb.from('payment_methods').select('*').eq('store_id', sid),
      sb.from('delivery_zones').select('*').eq('store_id', sid),
      sb.from('promos').select('*').eq('store_id', sid).order('created_at', {ascending:false}),
      sb.from('reviews').select('*').eq('store_id', sid).order('created_at', {ascending:false}),
      sb.from('notifications').select('*').eq('store_id', sid).order('created_at', {ascending:false}),
      sb.from('categories').select('*').eq('store_id', sid),
      sb.from('menu_items').select('*').eq('store_id', sid).order('position', {ascending:true})
    ]);
    this.categories = catRes.data || [];
    const products = prodRes.data || [];
    const orders = ordRes.data || [];
    const productIds = products.map(p=>p.id);
    const orderIds = orders.map(o=>o.id);
    const [photoRes, itemRes] = await Promise.all([
      productIds.length ? sb.from('product_photos').select('*').in('product_id', productIds) : Promise.resolve({data:[]}),
      orderIds.length ? sb.from('order_items').select('*').in('order_id', orderIds) : Promise.resolve({data:[]})
    ]);
    const photos = photoRes.data || [];
    const items = itemRes.data || [];
    const s = storeRes.data || {};

    _cache.store = { name:s.name||'Ma boutique', phone:s.phone||'', slug:s.slug||'', photo:s.photo_url||null, banner:s.banner_url||null,
      description:s.description||"Boutique en ligne spécialisée dans la vente d'articles de qualité, avec livraison rapide et paiement sécurisé à la livraison.",
      address:s.address||'Abidjan, Côte d’Ivoire', email:s.email||'', hours:s.hours||'Lundi – Samedi, 8h – 19h', loginId:s.login_id||'', businessType:s.business_type||'vente-ligne',
      uiTheme: s.ui_theme==='black' ? 'black' : 'blue',
      verification: { status:s.verification_status||'none', docType:s.verification_doc_type||'', docUrl:s.verification_doc_url||null, photoUrl:s.verification_photo_url||null,
        submittedAt:s.verification_submitted_at?new Date(s.verification_submitted_at).getTime():0, verified:!!s.verified,
        verifiedAt:s.verified_at?new Date(s.verified_at).getTime():0, rejectReason:s.verification_reject_reason||'' } };
    /* ---- Le thème (bleu/noir) fait foi côté cloud, comme le type d'activité juste au-dessus :
       on garde une copie locale (localStorage) uniquement pour un affichage instantané avant que
       ce chargement cloud ne soit terminé, jamais comme source de vérité. ---- */
    Utils.setLocal('ui_theme', _cache.store.uiTheme);
    /* ---- Le type d'activité fait foi côté cloud (multi-appareils). On resynchronise
       le cache local du marchand pour que l'écran de choix ne se réaffiche pas et que
       la navigation (onglet Produits/Menu) reste cohérente sur cet appareil aussi. ---- */
    if(s.business_type && !this.publicMode) setBusinessType(s.business_type);
    _cache.products = products.map(p=>{
      const pPhotos = photos.filter(ph=>ph.product_id===p.id).sort((a,b)=>a.position-b.position).map(ph=>ph.url);
      return { id:p.id, name:p.name, price:p.price, oldPrice:p.compare_at_price||null, category:this.catName(p.category_id), photos:pPhotos, photo:pPhotos[0]||null, stockLimited:p.stock_limited, stockQty:p.stock_qty, desc:p.description||'' };
    });
    _cache.orders = orders.map(o=>({
      id:o.id, number:o.number, customer:{name:o.customer_name, phone:o.customer_phone, address:o.customer_address},
      customerLat:o.customer_latitude!=null?Number(o.customer_latitude):null, customerLng:o.customer_longitude!=null?Number(o.customer_longitude):null,
      items: items.filter(it=>it.order_id===o.id).map(it=>({productId:it.product_id, name:it.name, price:it.price, qty:it.qty, photo:(photos.filter(ph=>ph.product_id===it.product_id).sort((a,b)=>a.position-b.position)[0]||{}).url||null})),
      amount:o.amount, discount:o.discount, deliveryZone:o.delivery_zone, deliveryFee:o.delivery_fee,
      promoCode:o.promo_code, paymentMethod:o.payment_method, status:o.status, createdAt:new Date(o.created_at).getTime(),
      paymentProof:o.payment_proof_url||null, confirmedAt:o.confirmed_at?new Date(o.confirmed_at).getTime():0,
      shipped:!!o.shipped, shippedAt:o.shipped_at?new Date(o.shipped_at).getTime():0,
      deliveryConfirmedAt:o.delivery_confirmed_at?new Date(o.delivery_confirmed_at).getTime():0, deliveryPhoto:o.delivery_photo_url||null,
      deliveryToken:o.delivery_token||null, courierId:o.courier_id||null, courierLat:o.courier_latitude||null, courierLng:o.courier_longitude||null, courierAccuracy:o.courier_location_accuracy||null, courierLocationAt:o.courier_location_at?new Date(o.courier_location_at).getTime():0, deliveryStatusMessage:o.delivery_status_message||'', courierPayout:Number(o.courier_payout_amount||0)
    }));
    _cache.team = (teamRes.data||[]).map(t=>({id:t.id, name:t.name, phone:t.phone, role:t.role, status:t.status}));
    const payArr = payRes.data || [];
    const findPay = k => { const r = payArr.find(x=>x.method_key===k); return r ? {enabled:r.enabled, number:r.number||'', link:r.link||'', validated:(!!r.validated || !!r.number), validatedAt:r.validated_at?new Date(r.validated_at).getTime():0} : {enabled:k==='cash', number:'', link:'', validated:false, validatedAt:0}; };
    _cache.payment = { wave:findPay('wave'), om:findPay('om'), mtn:findPay('mtn'), moov:findPay('moov'), cash:{enabled:findPay('cash').enabled} };
    _cache.deliveryZones = (zoneRes.data||[]).map(z=>({name:z.name, fee:z.fee}));
    _cache.promos = (promoRes.data||[]).map(p=>({id:p.id, code:p.code, type:p.type, value:p.value, active:p.active, maxUses:Number(p.max_uses||0), usedCount:Number(p.used_count||0), createdAt:new Date(p.created_at).getTime()}));
    PromoLocal.load(); _cache.promos = _cache.promos.map(p=>PromoLocal.merge(p));
    _cache.reviews = (revRes.data||[]).map(r=>({id:r.id, productId:r.product_id, name:r.name, rating:r.rating, comment:r.comment, reply:r.reply, createdAt:new Date(r.created_at).getTime()}));
    _cache.notifications = (notifRes.data||[]).map(n=>({id:n.id, type:n.type, message:n.message, read:n.read, createdAt:new Date(n.created_at).getTime()}));
    _cache.categories = this.categories.map(c=>c.name);
    _cache.categoryPhotos = Object.fromEntries(this.categories.filter(c=>c.photo).map(c=>[c.name, c.photo]));
    _cache.menuItems = (menuRes.data||[]).map(m=>({ id:m.id, name:m.name, price:m.price, desc:m.description||'', category:m.category||'Plat', photo:m.photo_url||null, available:!!m.available_today }));

    /* ---- Synchronisation de l'abonnement depuis le cloud (multi-appareils) ----
       Si une formule a déjà été activée/payée (sur ce téléphone ou un autre), la
       fiche boutique en fait foi : l'abonnement est reconnu automatiquement, sans
       attendre une nouvelle confirmation locale. On préserve toutefois le compte à
       rebours local si un paiement vient d'être déclaré sur cet appareil précis. */
    if(s.subscription_plan){
      const localSub = Utils.getLocal('subscription', { plan:null, status:'none', renewsAt:0, pendingSince:0, pendingConfirmAt:0, pendingMethod:'' });
      const serverStatus = s.subscription_status || 'none';
      /* ---- 'active' et 'expired' sont des statuts définitifs décidés par l'admin :
         ils écrasent toujours le cache local, même si l'appareil était resté sur
         'pending' (sinon un appareil qui a déclaré un paiement ne voit jamais la
         validation admin arriver, et le badge ne s'affiche jamais). ---- */
      const serverIsFinal = serverStatus==='active' || serverStatus==='expired';
      if(serverIsFinal || localSub.status!=='pending'){
        const wasActive = localSub.status==='active';
        Utils.setLocal('subscription', {
          plan: s.subscription_plan,
          status: serverStatus,
          renewsAt: s.subscription_renews_at ? new Date(s.subscription_renews_at).getTime() : 0,
          paymentMethod: s.subscription_payment_method || localSub.paymentMethod || '',
          pendingSince:0, pendingConfirmAt:0, pendingMethod:''
        });
        if(serverStatus==='active' && !wasActive){
          const planLabel = (typeof SUBSCRIPTION_PLANS!=='undefined' && SUBSCRIPTION_PLANS.find(p=>p.key===s.subscription_plan)?.label) || '';
          Notify.add('order', `Abonnement ${planLabel} activé ✓ Votre formule est maintenant active.`);
        }
      }
    }
    /* ---- Synchronisation du statut « commission réglée » depuis le cloud, pour que
       tous les appareils du vendeur voient le même état (une fois validé par SIAMS). ---- */
    if(typeof s.commission_settled === 'boolean'){
      Utils.setLocal('commission_settled', s.commission_settled);
    }
  },

  /* ---- Écrit le thème choisi par le marchand dans Supabase, pour qu'il s'applique
     sur tous les appareils (marchand, livreur, et vitrine client) au lieu de rester
     coincé en localStorage sur le seul appareil où il a été choisi. ---- */
  async pushTheme(theme){
    if(!this.storeId) return;
    const { error } = await sb.from('stores').update({ ui_theme: theme }).eq('id', this.storeId);
    if(error){ console.error('Sync error [theme update]', error); throw error; }
  },

  async pushStore(prev, next){
    next.photo = await this.ensureStoredUrl(next.photo, 'store-photos');
    next.banner = await this.ensureStoredUrl(next.banner, 'store-banners');
    const patch = { name:next.name, phone:next.phone, photo_url:next.photo, banner_url:next.banner, description:next.description||null, address:next.address||null, email:next.email||null, hours:next.hours||null };
    /* ---- Regénère un lien propre (ex: amos-boutique) quand le nom change, plutôt que de garder
       l'ancien slug aléatoire (boutique-xxxxxxxx-xxxx) généré à la création du compte. ---- */
    if(next.name && next.name !== prev.name){
      const base = Utils.slugify(next.name);
      let candidate = base, i = 1;
      while(true){
        const { data } = await sb.from('stores').select('id').eq('slug', candidate).neq('id', this.storeId).limit(1);
        if(!data || !data.length) break;
        i++; candidate = base + '-' + i;
      }
      patch.slug = candidate;
      next.slug = candidate;
      Utils.setLocal('store', next);
    }
    const { error:storeErr } = await sb.from('stores').update(patch).eq('id', this.storeId);
    if(storeErr){ console.error('Sync error [stores update]', storeErr); throw storeErr; }
  },

  async pushProducts(prev, next){
    const prevIds = prev.map(p=>p.id), nextIds = next.map(p=>p.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length){
      const { error:delErr } = await sb.from('products').delete().in('id', removed);
      if(delErr){ console.error('Sync error [products delete]', delErr); throw delErr; }
    }
    for(const p of next){
      let catId = this.catId(p.category);
      if(p.category && !catId){
        const ins = await sb.from('categories').insert({store_id:this.storeId, name:p.category}).select().single();
        if(ins.error){ console.error('Sync error [categories insert]', ins.error); throw ins.error; }
        if(ins.data){ this.categories.push(ins.data); catId = ins.data.id; }
      }
      const { error:prodErr } = await sb.from('products').upsert({ id:p.id, store_id:this.storeId, category_id:catId||null, name:p.name, price:p.price, compare_at_price:p.oldPrice||null, description:p.desc||null, stock_limited:!!p.stockLimited, stock_qty:p.stockLimited?Number(p.stockQty||0):null });
      if(prodErr){ console.error('Sync error [products upsert]', prodErr); throw prodErr; }
      /* ---- On insère d'abord les nouvelles photos, puis on ne supprime que les
         anciennes lignes restantes : si l'insertion échoue (réseau coupé, photo
         trop lourde, etc.), les photos déjà en ligne restent intactes au lieu
         d'être effacées avant que le remplacement ait réussi. ---- */
      const photos = (p.photos && p.photos.length) ? p.photos : (p.photo?[p.photo]:[]);
      if(photos.length){
        const uploadedUrls = await Promise.all(photos.map(url=>this.ensureStoredUrl(url, 'product-photos')));
        p.photos = uploadedUrls; p.photo = uploadedUrls[0]||null;
        const { data:inserted, error:photoErr } = await sb.from('product_photos').insert(uploadedUrls.map((url,i)=>({product_id:p.id, url, position:i}))).select('id');
        if(photoErr){ console.error('Sync error [product_photos insert]', photoErr); throw photoErr; }
        const newIds = (inserted||[]).map(r=>r.id);
        if(newIds.length) await sb.from('product_photos').delete().eq('product_id', p.id).not('id','in','('+newIds.join(',')+')');
      } else {
        await sb.from('product_photos').delete().eq('product_id', p.id);
      }
    }
  },

  /* ---- Module Restauration : plats du menu du jour (table dédiée menu_items,
     séparée des produits classiques). Pas de galerie multi-photos ni de stock
     numérique ici : juste une photo optionnelle et un flag "disponible aujourd'hui"
     que le marchand bascule en un tap. ---- */
  async pushMenuItems(prev, next){
    const prevIds = prev.map(m=>m.id), nextIds = next.map(m=>m.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length){
      const { error:delErr } = await sb.from('menu_items').delete().in('id', removed);
      if(delErr){ console.error('Sync error [menu_items delete]', delErr); throw delErr; }
    }
    for(let i=0;i<next.length;i++){
      const m = next[i];
      m.photo = await this.ensureStoredUrl(m.photo, 'menu-photos');
      const { error:menuErr } = await sb.from('menu_items').upsert({ id:m.id, store_id:this.storeId, name:m.name, price:m.price, description:m.desc||null, category:m.category||'Plat', photo_url:m.photo||null, available_today:!!m.available, position:i });
      if(menuErr){ console.error('Sync error [menu_items upsert]', menuErr); throw menuErr; }
    }
  },

  async pushOrders(prev, next){
    const prevIds = prev.map(o=>o.id), nextIds = next.map(o=>o.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length){
      const del = await sb.from('orders').delete().in('id', removed);
      if(del.error) throw del.error;
    }

    const writeOne = async (o)=>{
      const isNew = !prev.find(x=>x.id===o.id);
      o.paymentProof = await this.ensureStoredUrl(o.paymentProof, 'payment-proofs');
      o.deliveryPhoto = await this.ensureStoredUrl(o.deliveryPhoto, 'delivery-photos');
      const payload = {
        id:o.id, store_id:this.storeId, number:o.number, customer_name:o.customer.name, customer_phone:o.customer.phone, customer_address:o.customer.address,
        customer_latitude:o.customerLat!=null?o.customerLat:null, customer_longitude:o.customerLng!=null?o.customerLng:null,
        subtotal: o.amount + (o.discount||0) - (o.deliveryFee||0), discount:o.discount||0, promo_code:o.promoCode||null,
        delivery_zone:o.deliveryZone||null, delivery_fee:o.deliveryFee||0, amount:o.amount, payment_method:o.paymentMethod||'cash', status:o.status||'pending',
        payment_proof_url:o.paymentProof||null, confirmed_at:o.confirmedAt?new Date(o.confirmedAt).toISOString():null,
        shipped:!!o.shipped, shipped_at:o.shippedAt?new Date(o.shippedAt).toISOString():null,
        delivery_arrived_at:o.delivery_arrived_at?new Date(o.delivery_arrived_at).toISOString():null,
        delivery_status:o.delivery_status||null,
        delivery_confirmed_at:o.deliveryConfirmedAt?new Date(o.deliveryConfirmedAt).toISOString():null, delivery_photo_url:o.deliveryPhoto||null,
        delivery_token:o.deliveryToken||undefined, courier_id:o.courierId||null
      };

      let lastError = null;
      for(let attempt=1; attempt<=3; attempt++){
        /* CORRECTIF : .select('id') après l'update permet de détecter un échec
           silencieux (0 ligne modifiée par ex. à cause d'une règle RLS qui bloque
           l'écriture) — sans ce .select(), Supabase ne renvoie aucune erreur dans
           ce cas et l'appli croit à tort que l'enregistrement a réussi. */
        let { data, error } = isNew
          ? await sb.from('orders').insert(payload).select('id')
          : await sb.from('orders').update(payload).eq('id', o.id).select('id');
        if(!error && (!data || data.length===0)){
          error = new Error(`Écriture refusée pour la commande #${o.number||o.id} (probablement une règle RLS Supabase qui bloque la mise à jour) — 0 ligne modifiée.`);
        }
        if(!error){ lastError=null; break; }
        lastError=error;
        if(attempt<3) await new Promise(r=>setTimeout(r, 500*attempt));
      }
      if(lastError) throw lastError;

      if(isNew && o.items && o.items.length){
        const {error:itemError} = await sb.from('order_items').insert(
          o.items.map(it=>({order_id:o.id, product_id:it.productId||null, name:it.name, price:it.price, qty:it.qty}))
        );
        if(itemError) throw itemError;
      }
      return o;
    };

    const jobs = next.map(o=>{
      const promise = writeOne(o);
      this._orderWritePromises[o.id] = promise;
      promise.finally(()=>{ if(this._orderWritePromises[o.id]===promise) delete this._orderWritePromises[o.id]; }).catch(()=>{});
      return promise;
    });
    await Promise.all(jobs);
  },

  async waitForOrderPersisted(orderId){
    const p = this._orderWritePromises[orderId];
    if(p) await p;
    return true;
  },

  async pushTeam(prev, next){
    const prevIds = prev.map(t=>t.id), nextIds = next.map(t=>t.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length) await sb.from('team_members').delete().in('id', removed);
    if(next.length) await sb.from('team_members').upsert(next.map(t=>({id:t.id, store_id:this.storeId, name:t.name, phone:t.phone, role:t.role, status:t.status})));
  },

  async pushPromos(prev, next){
    const prevIds = prev.map(p=>p.id), nextIds = next.map(p=>p.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length){
      const { error:delErr } = await sb.from('promos').delete().in('id', removed);
      if(delErr){ console.error('Sync error [promos delete]', delErr); throw delErr; }
    }
    if(next.length){
      const { error:promoErr } = await sb.from('promos').upsert(next.map(p=>({id:p.id, store_id:this.storeId, code:p.code, type:p.type, value:p.value, active:p.active, max_uses:Number(p.maxUses||0), used_count:Number(p.usedCount||0)})));
      if(promoErr){ console.error('Sync error [promos upsert]', promoErr); throw promoErr; }
    }
    PromoLocal.save(next);
  },

  async pushReviews(prev, next){
    const prevIds = prev.map(r=>r.id), nextIds = next.map(r=>r.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length) await sb.from('reviews').delete().in('id', removed);
    if(next.length) await sb.from('reviews').upsert(next.map(r=>({id:r.id, store_id:this.storeId, product_id:r.productId, name:r.name, rating:r.rating, comment:r.comment||null, reply:r.reply||null})));
  },

  async pushNotifications(prev, next){
    const prevIds = prev.map(n=>n.id), nextIds = next.map(n=>n.id);
    const removed = prevIds.filter(id=>!nextIds.includes(id));
    if(removed.length) await sb.from('notifications').delete().in('id', removed);
    if(next.length) await sb.from('notifications').upsert(next.map(n=>({id:n.id, store_id:this.storeId, type:n.type, message:n.message, read:!!n.read})));
  },

  async pushCategories(prev, next){
    const existingNames = this.categories.map(c=>c.name);
    const toAdd = next.filter(n=>!existingNames.includes(n));
    const toRemoveRows = this.categories.filter(c=>!next.includes(c.name));
    if(toRemoveRows.length) await sb.from('categories').delete().in('id', toRemoveRows.map(c=>c.id));
    let added = [];
    if(toAdd.length){ const ins = await sb.from('categories').insert(toAdd.map(name=>({store_id:this.storeId, name}))).select(); added = ins.data || []; }
    this.categories = this.categories.filter(c=>next.includes(c.name)).concat(added);
  },

  /* ---- Photo dédiée à une catégorie, indépendante des produits qu'elle contient :
     le marchand peut la définir, la remplacer ou la retirer à tout moment. ---- */
  async setCategoryPhoto(name, dataUrlOrNull){
    const catId = this.catId(name);
    if(!catId) throw new Error('Catégorie introuvable');
    const photo = dataUrlOrNull ? await this.ensureStoredUrl(dataUrlOrNull, 'categories') : null;
    const {error} = await sb.from('categories').update({photo}).eq('id', catId);
    if(error) throw error;
    const cat = this.categories.find(c=>c.id===catId);
    if(cat) cat.photo = photo;
    if(photo) _cache.categoryPhotos[name] = photo; else delete _cache.categoryPhotos[name];
    return photo;
  },

  async pushDeliveryZones(prev, next){
    await sb.from('delivery_zones').delete().eq('store_id', this.storeId);
    if(next.length) await sb.from('delivery_zones').insert(next.map(z=>({store_id:this.storeId, name:z.name, fee:z.fee})));
  },

  async pushPayment(prev, next){
    const rows = ['wave','om','mtn','moov','cash'].map(k=>({store_id:this.storeId, method_key:k, enabled:!!next[k].enabled, number:next[k].number||null, link:next[k].link||null, validated:!!next[k].validated, validated_at:next[k].validatedAt?new Date(next[k].validatedAt).toISOString():null}));
    const {error} = await sb.from('payment_methods').upsert(rows, {onConflict:'store_id,method_key'});
    if(error) throw error;
  },

  /* ---- SIAMS DELIVERY NETWORK ---- */
  async loadCourierData(){
    if(!this.storeId) return;
    try{
      const [cRes,aRes,pRes] = await Promise.all([
        sb.from('couriers').select('*').eq('store_id',this.storeId).order('created_at',{ascending:false}),
        sb.from('delivery_assignments').select('*').eq('store_id',this.storeId).order('created_at',{ascending:false}),
        sb.from('courier_payouts').select('*').eq('store_id',this.storeId).order('created_at',{ascending:false})
      ]);
      _cache.couriers = cRes.data || [];
      _cache.courierAssignments = aRes.data || [];
      _cache.courierPayouts = pRes.data || [];
    }catch(e){ console.error('Courier load',e); }
  },
  async inviteCourier(name, phone){
    const {data,error}=await sb.rpc('create_courier_invite',{p_store_id:this.storeId,p_name:name,p_phone:phone});
    if(error) throw error;
    return data;
  },
  async removeCourier(courierId){
    if(!this.storeId) throw new Error('Boutique non initialisée');
    if(!courierId) throw new Error('Livreur manquant');
    const {error}=await sb.from('couriers').update({status:'suspended'}).eq('id',courierId).eq('store_id',this.storeId);
    if(error) throw error;
    await this.loadCourierData();
  },
  async assignCourier(orderId,courierId){
    if(!this.storeId) throw new Error('Boutique non initialisée');
    if(!orderId || !courierId) throw new Error('Commande ou livreur manquant');

    const {data:existing,error:findError}=await sb.from('delivery_assignments')
      .select('*').eq('store_id',this.storeId).eq('order_id',orderId)
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(findError) throw findError;
    if(existing && existing.status==='accepted') throw new Error('Cette livraison est déjà acceptée par un livreur');

    let data,error;
    if(existing){
      ({data,error}=await sb.from('delivery_assignments')
        .update({courier_id:courierId,status:'offered'})
        .eq('id',existing.id).eq('store_id',this.storeId).select().single());
    }else{
      ({data,error}=await sb.from('delivery_assignments')
        .insert({store_id:this.storeId,order_id:orderId,courier_id:courierId,status:'offered'})
        .select().single());
    }
    if(error) throw error;

    const {error:orderError}=await sb.from('orders')
      .update({courier_id:courierId})
      .eq('id',orderId).eq('store_id',this.storeId);
    if(orderError) throw orderError;

    await this.loadCourierData();
    return data;
  },
  async setCourierPayout(orderId,courierId,amount){
    const {data,error}=await sb.from('courier_payouts').upsert({store_id:this.storeId,order_id:orderId,courier_id:courierId,amount:Number(amount)||0,status:'pending'},{onConflict:'order_id'}).select().single();
    if(error) throw error;
    await sb.from('orders').update({courier_payout_amount:Number(amount)||0}).eq('id',orderId).eq('store_id',this.storeId);
    return data;
  },
  async courierInviteAccept(token){
    const {data,error}=await sb.rpc('accept_courier_invite',{p_token:token});
    if(error) throw error;
    return data;
  },
  async courierLogin(code){
    const {data,error}=await sb.rpc('courier_login',{p_access_code:code});
    if(error) throw error;
    return data;
  },
  async getCourierInviteStatus(token){
    const {data,error}=await sb.rpc('get_courier_invite_status',{p_token:token});
    if(error) throw error;
    return data;
  },
  async courierSetPin(sessionToken,pin){
    const {data,error}=await sb.rpc('courier_set_pin',{p_session_token:sessionToken,p_pin:pin});
    if(error) throw error;
    return data;
  },
  async courierLoginPin(token,pin){
    const {data,error}=await sb.rpc('courier_login_pin',{p_token:token,p_pin:pin});
    if(error) throw error;
    return data;
  },
  async courierAssignments(sessionToken){
    const {data,error}=await sb.rpc('courier_get_assignments',{p_session_token:sessionToken});
    if(error) throw error;
    return data || [];
  },
  async courierAcceptAssignment(sessionToken,assignmentId,eta){
    const {data,error}=await sb.rpc('courier_accept_assignment',{p_session_token:sessionToken,p_assignment_id:assignmentId,p_eta_minutes:Number(eta)});
    if(error) throw error;
    return data;
  },
  /* ---- Refus (ou expiration du compte à rebours de 10 min) d'une mission proposée :
     remet la commande "non affectée" côté marchand. Nécessite la fonction SQL
     courier_decline_assignment (voir migration_mission_popup.sql). ---- */
  async courierDeclineAssignment(sessionToken,assignmentId){
    const {data,error}=await sb.rpc('courier_decline_assignment',{p_session_token:sessionToken,p_assignment_id:assignmentId});
    if(error) throw error;
    return data;
  },
  /* ---- Documents administratifs du livreur (CNI, permis, carte grise, assurance) : chaque
     pièce est envoyée séparément vers Supabase Storage puis enregistrée sur la fiche livreur
     (statut 'pending') en vue d'une validation manuelle par un admin SIAMS. Le badge vert
     certifié s'affiche automatiquement dès que les 4 pièces sont validées (voir
     courier_recompute_documents_verified côté SQL — migration_courier_documents.sql). ---- */
  async courierDocuments(sessionToken){
    const {data,error}=await sb.rpc('courier_get_documents',{p_session_token:sessionToken});
    if(error) throw error;
    return data;
  },
  async courierSubmitDocument(sessionToken, docKey, docDataUrl){
    const docUrl = await this.ensureStoredUrl(docDataUrl, 'courier-documents');
    const {data,error}=await sb.rpc('courier_submit_document',{p_session_token:sessionToken,p_doc_key:docKey,p_doc_url:docUrl});
    if(error) throw error;
    return data;
  },
  async courierUpdateLocation(sessionToken,assignmentId,lat,lng,accuracy,heading,speed){
    const {data,error}=await sb.rpc('courier_update_location',{p_session_token:sessionToken,p_assignment_id:assignmentId,p_latitude:lat,p_longitude:lng,p_accuracy:accuracy||null,p_heading:heading||null,p_speed:speed||null});
    if(error) throw error;
    return data;
  },
  async courierMarkDelivered(sessionToken,assignmentId){
    const {data,error}=await sb.rpc('courier_mark_delivered',{p_session_token:sessionToken,p_assignment_id:assignmentId});
    if(error) throw error;
    return data;
  },
  /* ---- Reversement à la boutique des espèces encaissées par le livreur pour des commandes
     "paiement à la livraison" — nécessite les fonctions SQL courier_get_cash_due et
     courier_submit_payout_receipt côté livreur, et merchant_confirm_courier_payout côté
     boutique (voir migration_courier_payouts.sql). Le solde dû par le livreur, la pièce
     jointe du reçu de virement et la confirmation de réception par le marchand vivent tous
     dans la table courier_payouts déjà utilisée par Cloud.setCourierPayout. ---- */
  async courierCashDue(sessionToken){
    const {data,error}=await sb.rpc('courier_get_cash_due',{p_session_token:sessionToken});
    if(error) throw error;
    return data || [];
  },
  async courierSubmitPayoutReceipt(sessionToken, orderId, receiptDataUrl){
    const receiptUrl = await this.ensureStoredUrl(receiptDataUrl, 'courier-payout-receipts');
    const {data,error}=await sb.rpc('courier_submit_payout_receipt',{p_session_token:sessionToken,p_order_id:orderId,p_receipt_url:receiptUrl});
    if(error) throw error;
    return data;
  },
  async confirmCourierPayout(orderId){
    if(!this.storeId) throw new Error('Boutique non initialisée');
    const {data,error}=await sb.rpc('merchant_confirm_courier_payout',{p_store_id:this.storeId,p_order_id:orderId});
    if(error) throw error;
    await this.loadCourierData();
    return data;
  },
  /* Écran Gains livreur — nécessite la fonction SQL courier_get_earnings
     (migration_courier_earnings.sql). Si la fonction n'est pas encore
     déployée côté Supabase, l'appel échoue et l'écran affiche un état
     d'attente au lieu d'un montant inventé. */
  async courierEarnings(sessionToken){
    const {data,error}=await sb.rpc('courier_get_earnings',{p_session_token:sessionToken});
    if(error) throw error;
    return data;
  },

  /* ---- Synchronisation de l'abonnement : dès qu'une formule est payée/activée, on
     met à jour la fiche boutique côté serveur pour que l'accès soit reconnu sur tous
     les appareils, immédiatement et automatiquement (pas seulement en local). ---- */
  async pushSubscription(sub){
    if(!this.storeId) return;
    await sb.from('stores').update({
      subscription_plan: sub.plan || null,
      subscription_status: sub.status || 'none',
      subscription_renews_at: sub.renewsAt ? new Date(sub.renewsAt).toISOString() : null,
      subscription_payment_method: sub.paymentMethod || null,
      subscription_payment_number: sub.paymentMethod==='djamo' ? PAYMENT_INFO.djamoNumber : null
    }).eq('id', this.storeId);
  },

  /* ---- Consolidation de la commission période d'essai sur la fiche boutique :
     appelée à chaque paiement (livraison confirmée) pour que le montant dû soit
     visible côté admin et cohérent sur tous les appareils du vendeur. ---- */
  async pushCommission(due, settled){
    if(!this.storeId) return;
    await sb.from('stores').update({ commission_due: due, commission_settled: !!settled }).eq('id', this.storeId);
  },

  /* ---- Consolidation de la commission d'abonnement (2%, Article 8 du contrat)
     sur la fiche boutique : due est recalculé par subCommissionDue(), settledAt
     est la date du dernier règlement déclaré par le vendeur. ---- */
  async pushSubCommission(due, settledAt){
    if(!this.storeId) return;
    await sb.from('stores').update({ sub_commission_due: due, sub_commission_settled_at: settledAt ? new Date(settledAt).toISOString() : null }).eq('id', this.storeId);
  },

  /* ---- Certification boutique : envoie la pièce d'identité et la photo prise en
     temps réel vers Supabase Storage, puis enregistre la demande sur la fiche
     boutique (statut 'pending') en vue de la validation manuelle par un admin
     SIAMS (voir Views['siams-admin-verifications']). ---- */
  async pushVerification(docType, docDataUrl, photoDataUrl){
    if(!this.storeId) return null;
    const docUrl = await this.ensureStoredUrl(docDataUrl, 'verification-docs');
    const photoUrl = await this.ensureStoredUrl(photoDataUrl, 'verification-photos');
    const patch = { verification_status:'pending', verification_doc_type:docType, verification_doc_url:docUrl, verification_photo_url:photoUrl, verification_submitted_at:new Date().toISOString(), verification_reject_reason:null };
    const { error } = await sb.from('stores').update(patch).eq('id', this.storeId);
    if(error){ console.error('Sync error [verification submit]', error); throw error; }
    return { status:'pending', docType, docUrl, photoUrl, submittedAt:Date.now(), verified:false, verifiedAt:0, rejectReason:'' };
  }
};

/* ---------------- In-memory cache (remplace localStorage) ---------------- */
let _cache = {
  products:[], orders:[], team:[], couriers:[], courierAssignments:[],
  payment:{wave:{enabled:false,number:'',link:'',validated:false},om:{enabled:false,number:'',link:'',validated:false},mtn:{enabled:false,number:'',link:'',validated:false},moov:{enabled:false,number:'',link:'',validated:false},cash:{enabled:true}},
  categories:[], promos:[], reviews:[], notifications:[], deliveryZones:[], menuItems:[],
  store:{name:'Ma boutique',phone:'',slug:'',photo:null,banner:null,description:'',address:'',email:'',hours:'',loginId:'',verification:{status:'none',docType:'',docUrl:null,photoUrl:null,submittedAt:0,verified:false,verifiedAt:0,rejectReason:''}}
};
function syncFail(label){ return (err)=>{ console.error('Sync error ['+label+']', err); Toast.show('⚠️ Erreur ['+label+'] : '+(err && (err.message||err.code||JSON.stringify(err)))); }; }
/* CORRECTIF : compteur d'écritures Supabase en cours. Le rafraîchissement automatique
   (AutoSync) recharge périodiquement toutes les données depuis Supabase et remplace
   _cache en bloc. Si ce rechargement survenait pendant qu'un envoi (ex. création d'un
   code promo) était encore en vol, les données fraîchement ajoutées localement étaient
   écrasées par la version serveur pas encore à jour — d'où leur disparition après
   quelques secondes. On bloque désormais le rafraîchissement tant qu'une écriture est
   en cours. */
let _pendingWrites = 0;
function trackWrite(promise){ _pendingWrites++; return promise.finally(()=>{ _pendingWrites--; }); }

/* ---------------- Store ---------------- */
const Store = {
  get products(){ return _cache.products; },
  set products(v){ const prev=_cache.products; _cache.products=v; trackWrite(Cloud.pushProducts(prev, v)).catch(syncFail('products')); },

  get menuItems(){ return _cache.menuItems; },
  set menuItems(v){ const prev=_cache.menuItems; _cache.menuItems=v; trackWrite(Cloud.pushMenuItems(prev, v)).catch(syncFail('menuItems')); },

  /* ---- Vue unifiée produits + plats du menu du jour, utilisée uniquement par le
     panier/checkout pour résoudre un productId sans se soucier de sa provenance
     (le moteur de commande ne fait aucune distinction entre les deux). ---- */
  get sellables(){ return _cache.products.concat(_cache.menuItems); },

  get orders(){ return _cache.orders; },
  set orders(v){ const prev=_cache.orders; _cache.orders=v; trackWrite(Cloud.pushOrders(prev, v)).catch(syncFail('orders')); },

  get store(){ return _cache.store; },
  set store(v){ const prev=_cache.store; _cache.store=v; trackWrite(Cloud.pushStore(prev, v)).catch(syncFail('store')); },

  get team(){ return _cache.team; },
  set team(v){ const prev=_cache.team; _cache.team=v; trackWrite(Cloud.pushTeam(prev, v)).catch(syncFail('team')); },
  get couriers(){ return _cache.couriers; },
  get courierAssignments(){ return _cache.courierAssignments; },
  get courierPayouts(){ return _cache.courierPayouts; },
  /* ---- Reçus de virement envoyés par les livreurs, en attente de confirmation par la
     boutique (voir Cloud.confirmCourierPayout). Jointe avec le n° de commande et le nom
     du livreur pour l'affichage. ---- */
  pendingCourierReceipts(){
    return (this.courierPayouts||[]).filter(p=>p.status==='submitted').map(p=>{
      const order = this.orders.find(o=>o.id===p.order_id);
      const courier = this.couriers.find(c=>c.id===p.courier_id);
      return { ...p, orderNumber: order?order.number:'', courierName: courier?courier.name:'Livreur' };
    });
  },

  get payment(){ return _cache.payment; },
  set payment(v){ const prev=_cache.payment; _cache.payment=v; trackWrite(Cloud.pushPayment(prev, v)).catch(syncFail('payment')); },

  get notifications(){ return _cache.notifications; },
  set notifications(v){ const prev=_cache.notifications; _cache.notifications=v; trackWrite(Cloud.pushNotifications(prev, v)).catch(syncFail('notifications')); },

  get cart(){ return JSON.parse(sessionStorage.getItem('belou_cart')||'[]'); },
  set cart(v){ sessionStorage.setItem('belou_cart', JSON.stringify(v)); },

  get categories(){ return _cache.categories; },
  set categories(v){ const prev=_cache.categories; _cache.categories=v; trackWrite(Cloud.pushCategories(prev, v)).catch(syncFail('categories')); },
  get categoryPhotos(){ return _cache.categoryPhotos || {}; },

  get promos(){ return _cache.promos; },
  set promos(v){ const prev=_cache.promos; _cache.promos=v; trackWrite(Cloud.pushPromos(prev, v)).catch(syncFail('promos')); },

  get reviews(){ return _cache.reviews; },
  set reviews(v){ const prev=_cache.reviews; _cache.reviews=v; trackWrite(Cloud.pushReviews(prev, v)).catch(syncFail('reviews')); },

  get deliveryZones(){ return _cache.deliveryZones; },
  set deliveryZones(v){ const prev=_cache.deliveryZones; _cache.deliveryZones=v; trackWrite(Cloud.pushDeliveryZones(prev, v)).catch(syncFail('deliveryZones')); },

  reviewsFor(productId){ return this.reviews.filter(r=>r.productId===productId); },
  avgRating(productId){
    const list = this.reviewsFor(productId);
    if(!list.length) return null;
    return { avg: list.reduce((s,r)=>s+r.rating,0)/list.length, count: list.length };
  },
  customers(){
    const map = {};
    this.orders.forEach(o=>{
      const key = o.customer.phone;
      if(!map[key]) map[key] = { phone:key, name:o.customer.name, address:o.customer.address, orders:0, spent:0, lastOrderAt:0 };
      map[key].orders += 1;
      map[key].spent += o.amount;
      map[key].name = o.customer.name;
      map[key].lastOrderAt = Math.max(map[key].lastOrderAt, o.createdAt);
    });
    const list = Object.values(map);
    const bySpend = list.slice().sort((a,b)=>b.spent-a.spent);
    bySpend.forEach((c,i)=>{ c.rank = i+1; });
    const avgSpent = list.length ? list.reduce((s,c)=>s+c.spent,0)/list.length : 0;
    list.forEach(c=>{
      c.isTopContributor = list.length>=3 && c.rank<=3 && c.orders>=2 && c.spent > avgSpent*1.3;
    });
    return list.sort((a,b)=>b.lastOrderAt-a.lastOrderAt);
  },
  ordersForPhone(phone){ return this.orders.filter(o=>o.customer.phone===phone).sort((a,b)=>b.createdAt-a.createdAt); },

  /* computed helpers */
  revenueDelivered(){ return this.orders.filter(o=>o.status==='delivered').reduce((s,o)=>s+o.amount,0); },
  get withdrawals(){ return Utils.getLocal('withdrawals', []); },
  /* ---- Le thème vient du cloud (fiche boutique Supabase) dès que celui-ci est chargé,
     pour être identique sur tous les appareils et côté client. Avant ce chargement (tout
     début d'ouverture de l'app), on retombe sur la copie locale pour éviter un flash de
     thème par défaut. ---- */
  get uiTheme(){ return (_cache.store && _cache.store.uiTheme) || Utils.getLocal('ui_theme', 'blue'); },
  set uiTheme(v){
    if(_cache.store) _cache.store.uiTheme = v;
    Utils.setLocal('ui_theme', v);
    Cloud.pushTheme(v).catch(syncFail('theme'));
  },
  set withdrawals(v){ Utils.setLocal('withdrawals', v); },
  totalWithdrawn(){ return this.withdrawals.reduce((s,w)=>s+w.amount,0); },
  /* ---- Espèces collectées par vos livreurs pour des commandes payées à la livraison ----
     SIAMS ne reçoit et ne conserve jamais l'argent du marchand : les paiements Wave/OM/MTN
     tombent directement sur le compte mobile money du marchand, et le cash est encaissé soit
     par le marchand lui-même, soit par un livreur. Seul ce dernier cas (cash encaissé par un
     livreur pour une commande livrée) laisse de l'argent du marchand entre des mains tierces
     en attendant d'être reversé — c'est le seul solde que cet écran doit suivre. */
  cashPendingFromCouriers(){
    return this.orders.filter(o=>o.status==='delivered' && o.paymentMethod==='cash' && o.courierId)
      .reduce((s,o)=>s+Math.max(0, Number(o.amount||0) - Number(o.courierPayout||0)), 0);
  },
  availableBalance(){ return Math.max(0, this.cashPendingFromCouriers() - this.totalWithdrawn()); },
  get contactEmail(){ return Utils.getLocal('contact_email', ''); },
  set contactEmail(v){ Utils.setLocal('contact_email', v); },

  /* ---- Centre financier : formule d'abonnement ---- */
  get subscription(){ return Utils.getLocal('subscription', { plan:null, status:'none', renewsAt:0, pendingSince:0, pendingConfirmAt:0, pendingMethod:'' }); },
  set subscription(v){ Utils.setLocal('subscription', v); },

  /* ---- Pass gratuit de découverte : 20 jours, toutes fonctionnalités, dès la première ouverture ---- */
  get trialStartedAt(){
    let v = Utils.getLocal('trial_started_at', null);
    if(!v){ v = Date.now(); Utils.setLocal('trial_started_at', v); }
    return v;
  },

  /* ---- Statut d'accès courant : essai gratuit / abonnement actif / vérification en cours / expiré ---- */
  access(){
    const now = Date.now();
    const sub = this.subscription;
    const planActiveNow = SUBSCRIPTION_PLANS.find(p=>p.key===sub.plan);
    /* ---- Un abonnement payant actif prend toujours le dessus sur le pass d'essai
       gratuit : sinon, tant que les 20 jours d'essai ne sont pas écoulés, un
       abonnement déjà payé reste invisible pour l'utilisateur (pas de badge, espace
       paiement qui continue de proposer de s'abonner, etc.). ---- */
    if(sub.status==='active' && planActiveNow && now < sub.renewsAt){
      if(typeof ThemeUnlock!=='undefined') ThemeUnlock.unlock(sub.plan);
      return { status:'active', plan:sub.plan, renewsAt:sub.renewsAt, features:planActiveNow.features, label:planActiveNow.label, badge:planActiveNow.badge, contractRef:sub.contractRef, amount:sub.amount, paymentMethod:sub.paymentMethod, activatedAt:sub.activatedAt };
    }
    const trialEnd = this.trialStartedAt + TRIAL_DAYS*86400000;
    if(now < trialEnd){
      return { status:'trial', daysLeft: Math.max(1, Math.ceil((trialEnd-now)/86400000)), endsAt:trialEnd, features:TRIAL_FEATURES, label:'Pass gratuit', badge:null };
    }
    const plan = sub.plan ? SUBSCRIPTION_PLANS.find(p=>p.key===sub.plan) : null;
    /* ---- Paiement échelonné journalier : chaque versement déclaré passe par une
       vérification (capture WhatsApp envoyée à SIAMS, validée dans Supabase). En
       prototype, cette vérification est simulée par le même délai que le paiement
       classique ; une fois le délai passé, le versement est comptabilisé et la barre
       de progression avance jusqu'à atteindre le socle (prix de la formule). ---- */
    if(sub.status==='building' && plan){
      let paid = sub.paidAmount||0;
      let pendingAmt = sub.pendingAmount||0;
      if(pendingAmt>0 && sub.pendingConfirmAt && now>=sub.pendingConfirmAt){
        paid += pendingAmt;
        if(paid >= plan.price){
          const activated = { plan:sub.plan, status:'active', renewsAt: now+30*86400000, activatedAt: now, pendingSince:0, pendingConfirmAt:0, pendingMethod:'', contractRef: Utils.genContractRef(sub.plan), amount: plan.price, paymentMethod: sub.paymentMethod||'djamo' };
          this.subscription = activated;
          Cloud.pushSubscription(activated).catch(e=>console.error('Sync error [subscription]', e));
          return this.access();
        }
        const updated = { ...sub, paidAmount:paid, pendingAmount:0, pendingConfirmAt:0 };
        this.subscription = updated;
        return this.access();
      }
      return { status:'building', plan:sub.plan, label:plan.label, price:plan.price, dailyRate:plan.dailyRate, mode:sub.mode||'daily', paidAmount:paid, pendingAmount:pendingAmt, msLeft: pendingAmt>0 ? Math.max(0, sub.pendingConfirmAt-now) : 0, features:LOCKED_FEATURES, badge:null };
    }
    if(sub.status==='pending'){
      /* ---- L'activation n'est plus simulée localement : elle n'a lieu que lorsque
         l'admin SIAMS valide le paiement dans admin.html. En attendant, l'accès
         reste verrouillé et le statut ne change que via la synchro serveur
         (voir Bootstrap.loadStoreData). ---- */
      return { status:'pending', plan:sub.plan, msLeft:0, features: LOCKED_FEATURES, label: plan?plan.label:'', badge:null };
    }
    if(sub.status==='active' && plan && now < sub.renewsAt){
      // Filet de sécurité : normalement déjà couvert par le check tout en haut de access(),
      // mais gardé ici au cas où planActiveNow n'aurait pas été trouvé plus haut pour une raison quelconque.
      if(typeof ThemeUnlock!=='undefined') ThemeUnlock.unlock(sub.plan);
      return { status:'active', plan:sub.plan, renewsAt:sub.renewsAt, features:plan.features, label:plan.label, badge:plan.badge, contractRef:sub.contractRef, amount:sub.amount, paymentMethod:sub.paymentMethod, activatedAt:sub.activatedAt };
    }
    return { status:'expired', features:LOCKED_FEATURES, label:'Aucun abonnement actif', badge:null };
  },
  hasFeature(key){ return !!this.access().features[key]; },

  /* ---- Commission SIAMS période d'essai (20 jours) : 5% sur le montant total de
     chaque commande livrée. Calcul 100% en temps réel à partir des commandes
     livrées (source de vérité déjà synchronisée avec Supabase) : pas d'état séparé à
     désynchroniser, la valeur consolidée est repoussée vers stores.commission_due à
     chaque nouveau paiement (voir handleDeliveryPhoto). ---- */
  commissionDue(){
    const start = this.trialStartedAt;
    const end = start + TRIAL_DAYS*86400000;
    return this.orders
      .filter(o=>o.status==='delivered' && o.createdAt>=start && o.createdAt<end)
      .reduce((sum,o)=> sum + Math.round((o.amount||0)*COMMISSION_RATE), 0);
  },
  /* ---- Marqueur manuel : le montant a été réglé par le vendeur (avec son abonnement
     ou séparément). Synchronisé sur la fiche boutique pour rester cohérent multi-appareils. ---- */
  get commissionSettled(){ return Utils.getLocal('commission_settled', false); },
  set commissionSettled(v){
    Utils.setLocal('commission_settled', !!v);
    Cloud.pushCommission(this.commissionDue(), !!v).catch(e=>console.error('Sync error [commission]', e));
  },

  /* ---- Commission SIAMS pendant l'abonnement (Pass payant) : 2% sur chaque
     commande livrée à partir de l'activation du Pass, en plus du prix de
     l'abonnement (Article 8 du contrat). Se calcule depuis le dernier
     règlement déclaré (subCommissionSettledAt) ou depuis l'activation si aucun
     règlement n'a encore eu lieu, comme la commission d'essai (Article 5). ---- */
  subCommissionDue(){
    const access = this.access();
    if(access.status!=='active') return 0;
    const since = Math.max(this.subCommissionSettledAt||0, access.activatedAt||0);
    return this.orders
      .filter(o=>o.status==='delivered' && o.createdAt>=since)
      .reduce((sum,o)=> sum + Math.round((o.amount||0)*SUBSCRIPTION_COMMISSION_RATE), 0);
  },
  get subCommissionSettledAt(){ return Utils.getLocal('sub_commission_settled_at', 0); },
  markSubCommissionSettled(){
    const at = Date.now();
    Utils.setLocal('sub_commission_settled_at', at);
    Cloud.pushSubCommission(0, at).catch(e=>console.error('Sync error [subCommission]', e));
  },

  /* ---- Certification boutique : soumet une pièce d'identité (CNI, Passeport,
     CMU, Certificat de nationalité, Carte scolaire) + une photo prise en temps
     réel. La mise à jour locale est directe (pas via `Store.store = ...`, qui
     déclencherait Cloud.pushStore et ses colonnes fixes) pour rester réactive
     pendant l'upload, puis synchronisée avec Supabase. ---- */
  async submitVerification(docType, docDataUrl, photoDataUrl){
    const v = await Cloud.pushVerification(docType, docDataUrl, photoDataUrl);
    if(v) _cache.store = { ..._cache.store, verification: v };
    return v;
  },

  /* ---- Centre financier : revenus par période et statuts de commande ---- */
  revenueSince(ts){ return this.orders.filter(o=>o.status==='delivered' && o.createdAt>=ts).reduce((s,o)=>s+o.amount,0); },
  pendingRevenue(){ return this.orders.filter(o=>o.status!=='delivered' && o.status!=='cancelled').reduce((s,o)=>s+o.amount,0); },
  totalSales(){ return this.orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.amount,0); },
  orderStatusCounts(){
    const counts = { new:0, preparing:0, shipped:0, done:0, cancelled:0 };
    this.orders.forEach(o=>{
      if(o.status==='pending') counts.new++;
      else if(o.status==='delivered') counts.done++;
      else if(o.status==='cancelled') counts.cancelled++;
      else if(o.status==='confirmed'){
        if(o.shipped) counts.shipped++; else counts.preparing++;
      }
    });
    return counts;
  },
  ordersByDay(days){
    const out = [];
    const now = new Date();
    for(let i=days-1;i>=0;i--){
      const d = new Date(now); d.setDate(now.getDate()-i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(d.getDate()+1);
      const dayOrders = this.orders.filter(o=>o.createdAt>=d.getTime() && o.createdAt<next.getTime());
      out.push({ label:Utils.dayLabel(d), amount:dayOrders.reduce((s,o)=>s+o.amount,0), count:dayOrders.length });
    }
    return out;
  },
  topProducts(limit){
    const tally = {};
    this.orders.forEach(o=>(o.items||[]).forEach(it=>{
      tally[it.name] = (tally[it.name]||0) + it.qty;
    }));
    return Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,limit||3);
  },

  /* ---- Statistiques avancées : périodes, comparaisons, répartitions ---- */
  monthRange(offset){
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth()+offset, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth()+offset+1, 1).getTime();
    return { start, end };
  },
  revenueBetween(start,end){ return this.orders.filter(o=>o.status==='delivered' && o.createdAt>=start && o.createdAt<end).reduce((s,o)=>s+o.amount,0); },
  ordersCountBetween(start,end){ return this.orders.filter(o=>o.createdAt>=start && o.createdAt<end && o.status!=='cancelled').length; },
  ordersAmountBetween(start,end){ return this.orders.filter(o=>o.createdAt>=start && o.createdAt<end && o.status!=='cancelled').reduce((s,o)=>s+o.amount,0); },
  newCustomersBetween(start,end){
    const firsts = {};
    this.orders.slice().sort((a,b)=>a.createdAt-b.createdAt).forEach(o=>{
      const k = o.customer.phone;
      if(!(k in firsts)) firsts[k] = o.createdAt;
    });
    return Object.values(firsts).filter(t=>t>=start && t<end).length;
  },
  revenueByMonth(months){
    const out = [];
    for(let i=months-1;i>=0;i--){
      const { start, end } = this.monthRange(-i);
      out.push({ label: new Date(start).toLocaleDateString('fr-FR',{month:'short'}).replace('.',''), amount: this.revenueBetween(start,end) });
    }
    return out;
  },
  categoryPerformance(){
    const map = {};
    this.orders.filter(o=>o.status==='delivered').forEach(o=>{
      (o.items||[]).forEach(it=>{
        const prod = this.products.find(p=>p.id===it.productId) || this.products.find(p=>p.name===it.name);
        const cat = (prod && prod.category) ? prod.category : 'Autres';
        map[cat] = (map[cat]||0) + ((it.price!=null ? it.price : 0) * it.qty);
      });
    });
    const total = Object.values(map).reduce((s,v)=>s+v,0) || 1;
    return Object.entries(map).map(([name,amount])=>({ name, amount, pct:Math.round(amount/total*100) })).sort((a,b)=>b.amount-a.amount);
  }
};

/* ---- Petit utilitaire d'affichage : variation en % entre deux valeurs ---- */
function pctDelta(curr, prev){
  if(!prev){
    if(curr>0) return { txt:'Nouveau', dir:'up' };
    return { txt:'—', dir:'flat' };
  }
  const d = ((curr-prev)/prev)*100;
  const dir = d>0.5 ? 'up' : d<-0.5 ? 'down' : 'flat';
  const txt = (d>0?'+':'') + Math.round(d) + '%';
  return { txt, dir };
}

/* ---------------- Notify ---------------- */
const Notify = {
  add(type, message){
    const list = Store.notifications;
    list.unshift({ id:Utils.uid(), type, message, read:false, createdAt:Date.now() });
    Store.notifications = list.slice(0,30);
    Notify.renderBell();
  },
  renderBell(){
    const unread = Store.notifications.filter(n=>!n.read).length;
    document.querySelectorAll('.bell-dot').forEach(d=>d.classList.toggle('show', unread>0));
  },
  openPanel(){
    const list = Store.notifications;
    const wrap = document.getElementById('notif-list');
    wrap.innerHTML = list.length ? list.map(n=>`
      <div class="notif-item">
        <div class="ic ${n.type}">
          ${n.type==='order' ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/><path d="M2.5 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'}
        </div>
        <div class="txt">
          <p>${Utils.escapeHtml(n.message)}</p>
          <span>${Utils.timeAgo(n.createdAt)}</span>
        </div>
      </div>
    `).join('') : `<div class="notif-empty">Aucune notification pour le moment.</div>`;
    document.getElementById('notif-overlay').classList.add('show');
    document.getElementById('notif-panel').classList.add('show');
  },
  closePanel(){
    document.getElementById('notif-overlay').classList.remove('show');
    document.getElementById('notif-panel').classList.remove('show');
  },
  markAllRead(){
    Store.notifications = Store.notifications.map(n=>({...n, read:true}));
    Notify.renderBell();
    Notify.openPanel();
  }
};
function toggleNotifPanel(){
  const open = document.getElementById('notif-panel').classList.contains('show');
  if(open) Notify.closePanel(); else Notify.openPanel();
}

/* ==================== Popup de célébration réutilisable ==================== */
const Achievements = {
  ICONS:{
    trophy:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" stroke="{c}" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 4H5.2a1 1 0 0 0-1 1.1c.2 2.4 1.7 3.9 3.7 4.2M16 4h2.8a1 1 0 0 1 1 1.1c-.2 2.4-1.7 3.9-3.7 4.2M9 15.6V19M15 15.6V19M7 21h10" stroke="{c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    coins:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><ellipse cx="9" cy="7" rx="6" ry="3.2" stroke="{c}" stroke-width="1.7"/><path d="M3 7v4c0 1.77 2.69 3.2 6 3.2s6-1.43 6-3.2V7" stroke="{c}" stroke-width="1.7" stroke-linecap="round"/><path d="M3 11v4c0 1.77 2.69 3.2 6 3.2s6-1.43 6-3.2v-4" stroke="{c}" stroke-width="1.7" stroke-linecap="round"/><circle cx="17.5" cy="15.5" r="3.7" fill="{c}" stroke="#fff" stroke-width="1.2"/></svg>',
    box:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z" stroke="{c}" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.5 8v8L12 20l8.5-4V8M12 12v8" stroke="{c}" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    palette:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 8 0 1 0 0 16c1.1 0 2-.8 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.8.7-1.5 1.5-1.5H16c2.2 0 4-1.7 4-4C20 5.5 16.4 3 12 3Z" stroke="{c}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.5" cy="10.5" r="1.2" fill="{c}"/><circle cx="9.5" cy="7" r="1.2" fill="{c}"/><circle cx="14.5" cy="7" r="1.2" fill="{c}"/><circle cx="16.5" cy="11" r="1.2" fill="{c}"/></svg>'
  },
  celebrate({icon='trophy', color='#1E9E6B', title, subtitle}){
    const svg = (this.ICONS[icon]||this.ICONS.trophy).split('{c}').join(color);
    const el = document.createElement('div');
    el.className = 'delivered-badge-overlay achievement-overlay';
    el.innerHTML = `<div class="delivered-badge-pop achievement-pop">
      <div class="achievement-ic" style="background:${color}2b;">${svg}</div>
      <div style="font-size:15px;font-weight:800;text-align:center;">${Utils.escapeHtml(title||'')}</div>
      ${subtitle?`<div style="font-size:12.5px;font-weight:500;color:var(--text-mid);text-align:center;">${Utils.escapeHtml(subtitle)}</div>`:''}
    </div>`;
    document.body.appendChild(el);
    setTimeout(()=>el.classList.add('show'), 20);
    setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 2700);
  }
};

/* ==================== Paliers de revenus : messages de motivation ==================== */
const REVENUE_MILESTONES = [
  { amount:5000,    title:'Bon début ! 🌱',            subtitle:'Vos premiers revenus sont enregistrés.' },
  { amount:25000,   title:'Ça avance ! 👏',             subtitle:'25 000 FCFA de revenus cumulés.' },
  { amount:50000,   title:'On avance bien 🚀',          subtitle:'50 000 FCFA de revenus cumulés.' },
  { amount:100000,  title:'100 000 FCFA franchis ! 💪', subtitle:'Un cap symbolique atteint.' },
  { amount:250000,  title:'250 000 FCFA — bravo ! 🔥',  subtitle:'Votre activité prend de l\'ampleur.' },
  { amount:500000,  title:'500 000 FCFA — on y est presque 🎯', subtitle:'Le million n\'est plus très loin.' },
  { amount:1000000, title:'1 000 000 FCFA — on a un million à se faire, et c\'est fait ! 🏆', subtitle:'Un vrai palier atteint, félicitations.' }
];
function checkRevenueMilestones(){
  const revenue = Store.revenueDelivered();
  const reached = Utils.getLocal('revenue_milestones_reached', 0);
  let best = null;
  REVENUE_MILESTONES.forEach(m=>{ if(revenue>=m.amount && m.amount>reached) best = m; });
  // Paliers additionnels au-delà d'1 000 000 FCFA, par million
  if(revenue>=2000000){
    const millions = Math.floor(revenue/1000000);
    const lastMillion = Math.floor(reached/1000000);
    if(millions>lastMillion && reached>=1000000){
      best = { amount:millions*1000000, title:`${millions} millions de FCFA cumulés ! 🎉`, subtitle:'Votre activité continue de grandir.' };
    }
  }
  if(best){
    Utils.setLocal('revenue_milestones_reached', best.amount);
    Achievements.celebrate({ icon:'coins', color:'#C8912F', title:best.title, subtitle:best.subtitle });
  }
}

/* ==================== Couleurs d'application déblocables par formule ==================== */
const TIER_COLORS = { free:'#009688', doyen:'#6D28D9', doya:'#A67C00', all:'#8E1537', platinum:'#D7263D', golden:'#B8860B' };
const TIER_THEME_LABELS = { free:'BON MOOD', doyen:'DOYEN', doya:'DOYA', all:'TOUTE BOUTIQUE', platinum:'PLATINE', golden:'GOLDEN' };
function hexToRgb(hex){ const h=hex.replace('#',''); return { r:parseInt(h.substring(0,2),16), g:parseInt(h.substring(2,4),16), b:parseInt(h.substring(4,6),16) }; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function mixColor(hex, target, amount){ const a=hexToRgb(hex), b=hexToRgb(target); return rgbToHex(a.r+(b.r-a.r)*amount, a.g+(b.g-a.g)*amount, a.b+(b.b-a.b)*amount); }
/* ---- L'application conserve toujours sa couleur d'origine : il n'y a plus
   d'habillage différent débloqué selon la formule payée. ThemeUnlock reste défini
   (par compatibilité avec les quelques appels existants) mais ne fait plus rien. ---- */
const ThemeUnlock = { init(){}, unlock(){}, setActive(){}, applyTier(){}, unlocked:[], active:null };

/* ---------------- Export du rapport de ventes (PDF) ---------------- */
async function exportSalesReportPDF(){
  const logoPdf = await loadImageAsDataURL(LOGO_DATA_URI);

  if(!await ensureJsPDF()){ Toast.show('Génération PDF indisponible, réessayez'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
  const M=40, store=Store.store||{};
  const C={navy:[5,42,77],blue:[0,96,217],ink:[22,35,47],muted:[92,107,122],line:[220,228,236],soft:[244,247,250],green:[30,158,107],white:[255,255,255]};
  const money=v=>Utils.fmtFCFA(Number(v||0));
  let page=0;
  function header(){
    page++;
    doc.setFillColor(...C.navy); doc.rect(0,0,W,74,'F');
    try{doc.addImage(logoPdf,'PNG',M,12,50,50);}catch(e){}
    doc.setTextColor(...C.white); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text(store.name||'Ma boutique',M+64,30);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.text('Rapport de ventes & activité commerciale',M+64,47);
    doc.setFontSize(8.5); doc.text(`Page ${page} · ${new Date().toLocaleString('fr-FR')}`,W-M,47,{align:'right'});
    return 98;
  }
  function footer(){
    doc.setDrawColor(...C.line); doc.line(M,H-36,W-M,H-36);
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(...C.muted);
    doc.text('Rapport généré automatiquement par SIAMS à partir des données de la boutique.',W/2,H-21,{align:'center'});
  }
  function ensure(need=30,y){ if(y+need>H-52){footer(); return header();} return y; }
  let y=header();
  const orders=(Store.orders||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const revenue=Store.revenueDelivered(), totalSales=Store.totalSales(), pending=Store.pendingRevenue();
  const avg=orders.length?Math.round(orders.reduce((s,o)=>s+Number(o.amount||0),0)/orders.length):0;
  const counts=Store.orderStatusCounts(), clients=Store.customers().length, top=Store.topProducts(5);
  doc.setTextColor(...C.ink); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text('Synthèse',M,y); y+=18;
  const kpis=[['Ventes livrées',money(revenue)],['Total commandes',money(totalSales)],['En attente',money(pending)],['Panier moyen',money(avg)],['Clients',String(clients)]];
  kpis.forEach(([l,v])=>{ y=ensure(18,y); doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...C.muted);doc.text(l,M,y);doc.setFont('courier','bold');doc.setTextColor(...C.ink);doc.text(v,W-M,y,{align:'right'});y+=17; });
  y+=7; doc.setDrawColor(...C.line);doc.line(M,y,W-M,y);y+=22;
  y=ensure(50,y);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...C.ink);doc.text('Commandes par statut',M,y);y+=18;
  [['Nouvelles',counts.new],['En préparation',counts.preparing],['Expédiées',counts.shipped],['Terminées / livrées',counts.done],['Annulées',counts.cancelled]].forEach(([l,v])=>{y=ensure(18,y);doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...C.muted);doc.text(l,M,y);doc.setFont('courier','bold');doc.setTextColor(...C.ink);doc.text(String(v||0),W-M,y,{align:'right'});y+=17;});
  y+=7;doc.setDrawColor(...C.line);doc.line(M,y,W-M,y);y+=22;
  y=ensure(50,y);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Produits les plus vendus',M,y);y+=18;
  if(!top.length){doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text('Aucune vente pour le moment.',M,y);y+=18;}
  top.forEach(([name,qty])=>{y=ensure(18,y);doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(doc.splitTextToSize(String(name||'Produit'),W-M*2-90)[0],M,y);doc.text(`${qty} vendu(s)`,W-M,y,{align:'right'});y+=17;});
  y+=8;doc.setDrawColor(...C.line);doc.line(M,y,W-M,y);y+=22;
  y=ensure(70,y);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Journal des commandes',M,y);y+=18;
  const xNum=M,xClient=M+72,xStatus=M+235,xDate=M+315,xAmt=W-M;
  doc.setFillColor(...C.navy);doc.rect(M,y-13,W-M*2,22,'F');doc.setTextColor(...C.white);doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('COMMANDE',xNum,y);doc.text('CLIENT',xClient,y);doc.text('STATUT',xStatus,y);doc.text('DATE',xDate,y);doc.text('TOTAL',xAmt,y,{align:'right'});y+=17;
  const status={pending:'En attente',confirmed:'Confirmée',delivered:'Livrée'};
  if(!orders.length){doc.setTextColor(...C.muted);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Aucune commande enregistrée.',M,y);}
  for(const o of orders){
    if(y>H-70){footer();y=header();doc.setFillColor(...C.navy);doc.rect(M,y-13,W-M*2,22,'F');doc.setTextColor(...C.white);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('COMMANDE',xNum,y);doc.text('CLIENT',xClient,y);doc.text('STATUT',xStatus,y);doc.text('DATE',xDate,y);doc.text('TOTAL',xAmt,y,{align:'right'});y+=17;}
    if(orders.indexOf(o)%2===0){doc.setFillColor(...C.soft);doc.rect(M,y-11,W-M*2,19,'F');}
    doc.setTextColor(...C.ink);doc.setFont('courier','bold');doc.setFontSize(8);doc.text(`#${String(o.number||'—')}`,xNum,y);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(doc.splitTextToSize(String(o.customer?.name||'Client'),150)[0],xClient,y);
    doc.text(status[o.status]||String(o.status||'—'),xStatus,y);
    doc.text(o.createdAt?new Date(o.createdAt).toLocaleDateString('fr-FR'):'—',xDate,y);
    doc.setFont('courier','bold');doc.text(money(o.amount),xAmt,y,{align:'right'});y+=19;
  }
  footer();
  doc.save(`rapport-${(store.slug||'boutique')}-${new Date().toISOString().slice(0,10)}.pdf`);
  Toast.show('Rapport PDF téléchargé ✓');
}

/* ---------- Export CSV/Excel : commandes & catalogue ---------- */
function csvCell(v){
  const s = String(v==null?'':v).replace(/\r?\n/g,' ');
  return /[;"\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
function downloadCSV(filename, rows){
  const content = rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff'+content], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportOrdersCSV(){
  const orders = (Store.orders||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const statusLabel = {pending:'En attente',new:'Nouvelle',confirmed:'Confirmée',preparing:'En préparation',shipped:'Expédiée',delivered:'Livrée',cancelled:'Annulée'};
  const rows = [['N° commande','Client','Téléphone','Statut','Moyen de paiement','Zone de livraison','Date','Montant (FCFA)']];
  orders.forEach(o=>{
    rows.push([
      o.number||o.id||'',
      o.customer?.name||'',
      o.customer?.phone||'',
      statusLabel[o.status]||o.status||'',
      statsPaymentLabel ? statsPaymentLabel(o.paymentMethod||'unknown') : (o.paymentMethod||''),
      o.deliveryZone||'',
      o.createdAt?new Date(o.createdAt).toLocaleString('fr-FR'):'',
      Number(o.amount)||0
    ]);
  });
  const store=Store.store||{};
  downloadCSV(`commandes-${(store.slug||'boutique')}-${new Date().toISOString().slice(0,10)}.csv`, rows);
  Toast.show('Export des commandes téléchargé ✓');
}
function exportProductsCSV(){
  const products = Store.products||[];
  const rows = [['Nom','Catégorie','Prix (FCFA)','Ancien prix (FCFA)','Stock suivi','Quantité en stock','Description']];
  products.forEach(p=>{
    rows.push([
      p.name||'',
      p.category||'',
      Number(p.price)||0,
      p.oldPrice?Number(p.oldPrice):'',
      p.stockLimited?'Oui':'Non',
      p.stockLimited?(Number(p.stockQty)||0):'',
      p.desc||''
    ]);
  });
  const store=Store.store||{};
  downloadCSV(`catalogue-${(store.slug||'boutique')}-${new Date().toISOString().slice(0,10)}.csv`, rows);
  Toast.show('Export du catalogue téléchargé ✓');
}
function exportCustomersCSV(){
  const customers = Store.customers()||[];
  const rows = [['Nom','Téléphone','Adresse','Nombre de commandes','Total dépensé (FCFA)','Dernière commande','Client fidèle']];
  customers.forEach(c=>{
    rows.push([
      c.name||'',
      c.phone||'',
      c.address||'',
      Number(c.orders)||0,
      Number(c.spent)||0,
      c.lastOrderAt?new Date(c.lastOrderAt).toLocaleString('fr-FR'):'',
      c.isTopContributor?'Oui':'Non'
    ]);
  });
  const store=Store.store||{};
  downloadCSV(`clients-${(store.slug||'boutique')}-${new Date().toISOString().slice(0,10)}.csv`, rows);
  Toast.show('Export des clients téléchargé ✓');
}

/* ---------------- Toast ---------------- */
let toastTimer;
const Toast = {
  show(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
  }
};

/* ---------------- Sheet ---------------- */
const Sheet = {
  open(){
    document.getElementById('overlay').classList.add('show');
    document.getElementById('sheet').classList.add('show');
    const s = Store.store;
    const nameEl = document.getElementById('sheet-store-name');
    if(nameEl) nameEl.innerHTML = `${Utils.escapeHtml(s.name)}${(s.verification && s.verification.verified) ? ' '+CertifiedBadge(15) : ''}`;
    document.getElementById('sheet-store-phone').textContent = s.phone;
    document.getElementById('sheet-store-logo').innerHTML = s.photo
      ? `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 9h16M4 9l1.4-4h13.2L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke="var(--indigo)" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 13a3 3 0 0 0 6 0" stroke="var(--indigo)" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  },
  close(){
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('sheet').classList.remove('show');
  }
};

/* ---------------- Charts (hand-rolled SVG) ---------------- */
const Charts = {
  bars(data){
    const max = Math.max(1, ...data.map(d=>d.amount));
    const w = 40, gap = 14, h = 120;
    const svgW = data.length*(w+gap);
    const bars = data.map((d,i)=>{
      const bh = Math.max(4, Math.round((d.amount/max)*h));
      const x = i*(w+gap);
      const y = h-bh;
      return `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="6" fill="${i===data.length-1?'var(--indigo)':'var(--indigo-tint)'}"></rect>
        <text x="${x+w/2}" y="${h+18}" text-anchor="middle" font-size="10" fill="var(--text-soft)" font-family="var(--font-body)">${d.label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${svgW} ${h+26}" width="100%" height="150" style="overflow:visible">${bars}</svg>`;
  },
  /* ---- Courbe de tendance (aire dégradée) pour la page Statistiques ---- */
  trend(data){
    if(!data || !data.length) data = [{label:'',amount:0}];
    const w = 300, h = 130, pad = 10;
    const max = Math.max(1, ...data.map(d=>d.amount));
    const stepX = data.length>1 ? (w-pad*2)/(data.length-1) : 0;
    const pts = data.map((d,i)=>{
      const x = pad + i*stepX;
      const y = pad + (h-pad*2) * (1 - (d.amount/max));
      return { x, y, d };
    });
    const linePath = pts.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
    const areaPath = pts.length ? `${linePath} L${pts[pts.length-1].x.toFixed(1)},${(h-pad).toFixed(1)} L${pts[0].x.toFixed(1)},${(h-pad).toFixed(1)} Z` : '';
    const grid = [0,1,2,3].map(i=>{
      const y = pad + (h-pad*2)*i/3;
      return `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${w-pad}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"></line>`;
    }).join('');
    const showEvery = Math.max(1, Math.ceil(data.length/7));
    const labels = pts.map((p,i)=> (i%showEvery===0 || i===pts.length-1) ? `<text x="${p.x.toFixed(1)}" y="${h+8}" text-anchor="middle" font-size="9" fill="var(--text-soft)" font-family="var(--font-body)">${p.d.label}</text>` : '').join('');
    const lastPt = pts[pts.length-1];
    const dot = lastPt ? `<circle cx="${lastPt.x.toFixed(1)}" cy="${lastPt.y.toFixed(1)}" r="4" fill="var(--indigo)" stroke="#fff" stroke-width="2"></circle>` : '';
    const gradId = 'trendGrad'+Math.random().toString(36).slice(2,8);
    return `<svg viewBox="0 0 ${w} ${h+16}" width="100%" height="176" style="overflow:visible">
      <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--indigo)" stop-opacity=".28"></stop><stop offset="100%" stop-color="var(--indigo)" stop-opacity="0"></stop></linearGradient></defs>
      ${grid}
      <path d="${areaPath}" fill="url(#${gradId})" stroke="none"></path>
      <path d="${linePath}" fill="none" stroke="var(--indigo)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dot}
      ${labels}
    </svg>`;
  },
  /* ---- Graphique en anneau (répartition des commandes par statut, etc.) ---- */
  donut(segments, bg){
    bg = bg || '#fff';
    const total = segments.reduce((s,x)=>s+x.value,0);
    const r = 40, cx = 52, cy = 52, sw = 15;
    const circ = 2*Math.PI*r;
    if(!total){
      return `<svg viewBox="0 0 104 104" width="118" height="118"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${sw}"></circle></svg>`;
    }
    let acc = 0;
    const arcs = segments.filter(s=>s.value>0).map(s=>{
      const frac = s.value/total;
      const dash = Math.max(0, frac*circ - 2);
      const gap = circ-dash;
      const rotate = (acc/total)*360 - 90;
      acc += s.value;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" stroke-linecap="round" transform="rotate(${rotate.toFixed(1)} ${cx} ${cy})"></circle>`;
    }).join('');
    return `<svg viewBox="0 0 104 104" width="118" height="118">${arcs}<circle cx="${cx}" cy="${cy}" r="${r-sw/2-3}" fill="${bg}"></circle></svg>`;
  }
};

/* ---------------- Router ---------------- */
const PUBLIC_VIEWS = ['welcome','onboarding-public','about-partnership','activation-code','courier-login','courier-invite','courier-dashboard','shop','shop-product','cart','checkout','confirmation','login','register','verify-otp','confirm-email','recover-id','shop-categories','shop-favorites','shop-account','order-track','shop-orders-history','shop-about','shop-help','onboarding-client'];
const CLIENT_TAB_VIEWS = ['shop','shop-categories','cart','shop-favorites','shop-account'];
function applyUiTheme(){
  document.documentElement.setAttribute('data-ui-theme', Store.uiTheme==='black' ? 'black' : 'blue');
}
function setUiTheme(v){
  Store.uiTheme = v;
  applyUiTheme();
  Router.go(Router.current, Router.currentOpts);
}
const Router = {
  current:'dashboard',
  go(name, opts){
    if(name!=='courier-dashboard' && typeof CourierMission!=='undefined') CourierMission.close();
    if(name==='register' && !ActivationGate.getStored()){
      name='activation-code';
      opts={};
    }
    if(!PUBLIC_VIEWS.includes(name) && !Auth.isLoggedIn()){
      name = 'login';
      opts = {};
    }
    if(!PUBLIC_VIEWS.includes(name) && Auth.isLoggedIn() && OtpGate.pending){
      name = 'verify-otp';
      opts = {};
    }
    if(name==='dashboard' && !hasSeenOnboarding(ONBOARD_ADMIN_KEY)){
      name = 'onboarding-admin';
      opts = {};
    } else if(name==='dashboard' && !hasChosenBusinessType()){
      name = 'business-type';
      opts = {};
    }
    /* ---- Boutiques "restauration" : l'onglet Produits pointe vers l'écran dédié
       "Menu du jour" au lieu du catalogue classique. Redirection centralisée ici
       pour que tous les points d'entrée (nav, raccourcis dashboard, etc.) en
       bénéficient sans avoir à changer chaque appel Router.go('products'). ---- */
    if(name==='products' && getBusinessType()==='restauration'){
      name = 'menu';
    }
    /* ---- Idem côté client : l'onglet "Catégories" est redondant pour une boutique
       restauration (l'accueil affiche déjà tout le menu groupé par catégorie), et
       la fiche produit détaillée n'a pas d'équivalent pour un plat. On renvoie donc
       vers l'accueil plutôt que de dupliquer/adapter des vues déjà redéfinies
       plusieurs fois plus bas dans le fichier (risque de régression inutile). ---- */
    if((name==='shop-categories' || name==='shop-product') && Store.store && Store.store.businessType==='restauration'){
      name = 'shop';
      opts = {};
    }
    /* Aperçu marchand et liens publics : la vitrine doit être directement accessible.
       L'onboarding client reste affiché uniquement lors d'un accès client normal. */
    const skipClientOnboarding = !!(opts && opts.skipOnboarding);
    if(name==='shop' && !skipClientOnboarding && !hasSeenOnboarding(ONBOARD_CLIENT_KEY)){
      name = 'onboarding-client';
      opts = {};
    }
    Notify.closePanel();
    Sheet.close();
    Router.current = name;
    Router.currentOpts = opts || {};
    applyUiTheme();
    /* ---- Un rendu de vue qui plante (exception JS) ne doit jamais laisser le clic
       « sans rien faire » à l'écran : on affiche l'erreur pour pouvoir la diagnostiquer
       facilement (capture d'écran), au lieu d'un échec silencieux visible seulement
       dans la console. ---- */
    try{
      document.getElementById('page-root').innerHTML = Views[name] ? Views[name](opts||{}) : '';
    }catch(renderErr){
      console.error('Erreur de rendu pour la vue "'+name+'"', renderErr);
      document.getElementById('page-root').innerHTML = `
        <div style="padding:60px 24px;text-align:center;">
          <h2 style="color:var(--text);">Un problème est survenu</h2>
          <p style="color:var(--text-soft,#888);">L'affichage de cet écran a échoué. Vous pouvez réessayer.</p>
          <button class="btn btn-primary" style="margin-top:20px;" onclick="Router.go('dashboard')">Retour au tableau de bord</button>
          <p style="margin-top:24px;font-size:11px;color:#b91c1c;word-break:break-all;">${Utils.escapeHtml(String((renderErr&&(renderErr.message||renderErr.toString&&renderErr.toString()))||renderErr))}</p>
        </div>`;
      return;
    }
    const isCustomer = PUBLIC_VIEWS.includes(name) && name!=='login' && name!=='welcome';
    document.getElementById('bottom-nav').classList.toggle('hidden', isCustomer || name==='login' || name==='welcome' || name==='verify-otp' || name==='about-partnership' || name==='activation-code' || name==='onboarding-public' || name==='confirm-email' || name==='business-type' || name==='onboarding-admin' || name==='courier-login' || name==='courier-dashboard' || name==='account-id' || name==='recover-id' || name==='account-contract' || name==='account-contract-read' || name==='account-contract-notice');
    document.getElementById('client-nav').classList.toggle('hidden', !CLIENT_TAB_VIEWS.includes(name));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    const navMap = {dashboard:'dashboard', products:'products', 'product-add':'products', 'product-edit':'products', menu:'products', 'menu-add':'products', 'menu-edit':'products', orders:'orders', 'order-detail':'orders',
      boutique:'plus', 'store-edit':'plus', stats:'plus', team:'plus', payment:'plus', categories:'plus', promos:'plus', reviews:'plus', customers:'plus', 'customer-detail':'plus', delivery:'plus', 'app-theme':'plus', settings:'plus', team:'plus', 'courier-login':'plus', 'courier-dashboard':'plus', 'commissions-apercu':'plus',
      shop:'home', 'shop-categories':'categories', cart:'cart', 'shop-favorites':'favorites', 'shop-account':'account'};
    const navKey = navMap[name];
    if(navKey){ document.querySelectorAll('.nav-item[data-nav="'+navKey+'"]').forEach(el=>el.classList.add('active')); }
    const prodNavLabel = document.querySelector('.nav-item[data-nav="products"] span');
    if(prodNavLabel) prodNavLabel.textContent = getBusinessType()==='restauration' ? 'Menu' : 'Produits';
    window.scrollTo(0,0);
    Notify.renderBell();
    ClientNotify.renderBadges();
    if(Views['_after_'+name.replace(/-/g,'_')]) Views['_after_'+name.replace(/-/g,'_')](opts||{});
    if(name==='courier-dashboard'){ setTimeout(loadCourierDashboard,0); AutoSync.start(); }
  }
};

/* ---------------- Synchronisation automatique multi-interface ----------------
   Les données ne doivent plus dépendre d'un clic sur un onglet pour être rafraîchies.
   On actualise immédiatement au retour sur l'application et périodiquement lorsque
   l'écran reste ouvert. Le rendu est limité aux vues sûres pour ne pas interrompre
   une saisie (checkout, formulaires, panier, etc.). */
const AutoSync = {
  timer:null, busy:false, lastRun:0, started:false, intervalMs:8000,
  safeViews:new Set(['dashboard','orders','products','order-detail','boutique','store-edit','stats','team','payment','categories','promos','reviews','customers','customer-detail','delivery','app-theme','settings','courier-dashboard']),
  async refresh(force=false){
    const isCourier = !!courierSession();
    if(isCourier && Router.current==='courier-dashboard'){
      try{ await loadCourierDashboard(); }catch(e){ console.error('AutoSync courier',e); }
      return;
    }
    if(this.busy || !Cloud.storeId) return;
    if(_pendingWrites>0) return; /* CORRECTIF : une écriture (ex. création de promo) est en vol, on ne rafraîchit pas tant qu'elle n'est pas confirmée par Supabase */
    const now=Date.now();
    if(!force && now-this.lastRun<1500) return;
    this.busy=true; this.lastRun=now;
    try{
      const before = JSON.stringify({
        store:Store.store, products:Store.products, orders:Store.orders, team:Store.team,
        payment:Store.payment, categories:Store.categories, promos:Store.promos,
        reviews:Store.reviews, deliveryZones:Store.deliveryZones, notifications:Store.notifications
      });
      await Cloud.loadAll();
      const after = JSON.stringify({
        store:Store.store, products:Store.products, orders:Store.orders, team:Store.team,
        payment:Store.payment, categories:Store.categories, promos:Store.promos,
        reviews:Store.reviews, deliveryZones:Store.deliveryZones, notifications:Store.notifications
      });
      if(before!==after) this.renderCurrent();
      if(Router.current==='courier-dashboard') loadCourierDashboard();
      Notify.renderBell();
      ClientNotify.renderBadges();
    }catch(e){ console.error('AutoSync',e); }
    finally{ this.busy=false; }
  },
  renderCurrent(){
    const name=Router.current;
    if(!this.safeViews.has(name)) return;
    /* Ne pas remplacer une page pendant qu'un champ est en cours d'édition. */
    const active=document.activeElement;
    if(active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName)) return;
    const root=document.getElementById('page-root');
    if(!root || !Views[name]) return;
    try{
      const opts=Object.assign({}, Router.currentOpts||{}, {autoRefresh:true});
      root.innerHTML=Views[name](opts);
      const after=Views['_after_'+name.replace(/-/g,'_')];
      if(after) after(opts);
      Notify.renderBell(); ClientNotify.renderBadges();
      if(name==='courier-dashboard') setTimeout(loadCourierDashboard,0);
    }catch(e){ console.error('AutoSync render',e); }
  },
  start(){
    if(this.started) return;
    this.started=true;
    clearInterval(this.timer);
    this.timer=setInterval(()=>{ if(document.visibilityState==='visible') this.refresh(false); },this.intervalMs);
    window.addEventListener('focus',()=>this.refresh(true));
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') this.refresh(true); });
    window.addEventListener('pageshow',()=>this.refresh(true));
    setTimeout(()=>this.refresh(true),1200);
  },
  stop(){ clearInterval(this.timer); this.timer=null; this.started=false; }
};

/* ---------------- Auth ---------------- */
const Bootstrap = {
  async loadStoreData(user){
    await Cloud.ensureStore(user.id, user.user_metadata?.phone || '');
    /* ---- loadAll et loadCourierData ne dépendent que du storeId : on les lance
       en parallèle plutôt qu'à la suite, ça évite d'additionner leurs latences
       réseau et accélère nettement l'écran de connexion. ensureDefaults ne sert
       plus qu'aux vieux comptes non semés (les nouveaux le sont déjà via
       ensureStore) : on la laisse tourner en arrière-plan, sans bloquer
       l'affichage du tableau de bord. ---- */
    Cloud.ensureDefaults().catch(e=>console.error('ensureDefaults', e));
    await Promise.all([ Cloud.loadAll(), Cloud.loadCourierData() ]);
  }
};
const Auth = {
  loggedIn:false,
  isLoggedIn(){ return Auth.loggedIn; },
  /* ---- Traduit l'identifiant saisi (e-mail ou "SIAMS-XXXXXX") en e-mail réel ----
     Repose sur la fonction Supabase find_email_by_login_id (SECURITY DEFINER),
     seule autorisée à lire l'association identifiant → e-mail. ---- */
  async resolveEmail(identifier){
    if(identifier.includes('@')) return { ok:true, email: identifier };
    try{
      const { data, error } = await sb.rpc('find_email_by_login_id', { p_login_id: identifier.toUpperCase() });
      if(error || !data) return { ok:false };
      return { ok:true, email:data };
    }catch(e){ return { ok:false }; }
  },
  async login(email, password){
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error) return { ok:false, message: error.message==='Invalid login credentials' ? 'E-mail ou mot de passe incorrect' : error.message };
    Auth.loggedIn = true;
    try{ await Bootstrap.loadStoreData(data.user); } catch(e){ console.error(e); return { ok:false, message:'Erreur de chargement des données' }; }
    Store.trialStartedAt; ThemeUnlock.init();
    return { ok:true, phone: data.user?.user_metadata?.phone || '', email: data.user?.email || email };
  },
  async register(email, password, phone){
    const redirectTo = location.origin + location.pathname;
    const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ phone }, emailRedirectTo: redirectTo } });
    if(error) return { ok:false, message: error.message };
    if(!data.session) return { ok:true, needsConfirm:true };
    Auth.loggedIn = true;
    try{ await Bootstrap.loadStoreData(data.user); } catch(e){ console.error(e); return { ok:false, message:'Erreur de chargement des données' }; }
    Store.trialStartedAt; // démarre le pass gratuit de 20 jours pour la nouvelle boutique
    return { ok:true, phone: data.user?.user_metadata?.phone || phone, email: data.user?.email || email };
  },
  async logout(){
    await sb.auth.signOut();
    Auth.loggedIn = false;
    OtpGate.reset();
    _cache = { products:[], orders:[], team:[], payment:{wave:{enabled:false,number:'',link:'',validated:false},om:{enabled:false,number:'',link:'',validated:false},mtn:{enabled:false,number:'',link:'',validated:false},moov:{enabled:false,number:'',link:'',validated:false},cash:{enabled:true}}, categories:[], promos:[], reviews:[], notifications:[], deliveryZones:[], menuItems:[], store:{name:'Ma boutique',phone:'',slug:'',photo:null,banner:null,description:'',address:'',email:'',hours:'',loginId:'',verification:{status:'none',docType:'',docUrl:null,photoUrl:null,submittedAt:0,verified:false,verifiedAt:0,rejectReason:''}} };
    Cloud.storeId = null; Cloud.loginId = null; Cloud.publicMode = false; Cloud._orderWritePromises = Object.create(null);
    Router.go('login');
  }
};

/* ---------------- Onboarding (première utilisation) ----------------
   NOTE PROTOTYPE : un petit tutoriel en 4 écrans s'affiche une seule fois
   par appareil, côté marchand (après la première connexion) et côté
   client (à la première visite de la boutique). Le statut "déjà vu" est
   stocké en localStorage. */
const ONBOARD_ADMIN_KEY = 'siams_onboarding_admin_seen_v2';
const ONBOARD_CLIENT_KEY = 'siams_onboarding_client_seen_v1';
function hasSeenOnboarding(key){ try{ return localStorage.getItem(key)==='1'; }catch(e){ return true; } }
function markOnboardingSeen(key){ try{ localStorage.setItem(key,'1'); }catch(e){} }

/* ---------------- Choix du type d'activité (après l'onboarding marchand) ----------------
   NOTE PROTOTYPE : étape unique demandée après le tutoriel de bienvenue, pour laisser
   le marchand choisir le type d'activité de sa boutique. Seule « Vente en ligne » est
   fonctionnelle pour l'instant ; les 5 autres catégories sont prévues pour de futures
   versions (restauration, services, point de vente, livraison, formations) et
   affichent un état « Bientôt disponible ». Le choix est mémorisé sur l'appareil. */
const BUSINESS_TYPE_KEY = 'siams_business_type_v1';
function getBusinessType(){ try{ return localStorage.getItem(BUSINESS_TYPE_KEY) || ''; }catch(e){ return ''; } }
function hasChosenBusinessType(){ return !!getBusinessType(); }
function setBusinessType(id){ try{ localStorage.setItem(BUSINESS_TYPE_KEY, id); }catch(e){} }

const BUSINESS_CATEGORIES = [
  { id:'vente-ligne', available:true, label:'Vente en ligne',
    icon:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 8V6a6 6 0 0 1 12 0v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M5 8h14l1 12.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20.5L5 8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 12a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    title:'Boutique de vente en ligne',
    desc:"Créez votre catalogue de produits, recevez des commandes et vendez directement sur WhatsApp — la formule que vous connaissez déjà.",
    features:['Catalogue produits illimité','Commandes & suivi client','Paiement à la livraison, Wave, Orange Money, MTN'] },
  { id:'restauration', available:false, label:'Restauration',
    icon:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 2v6.5a2.2 2.2 0 0 0 2.2 2.2M7 2v8.7M9.2 2v6.5M11.4 2v6.5a2.2 2.2 0 0 1-2.2 2.2M9.2 10.7V22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 2c-1.8 0-3.2 1.9-3.2 4.3 0 2.1 1.1 3.9 2.5 4.2L16 22h2l-.3-11.5c1.4-.3 2.5-2.1 2.5-4.2C20.2 3.9 18.8 2 17 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    title:'Restauration & street food',
    desc:"Pensée pour les vendeurs de crêpes, jus, plats et snacks : menu du jour, commandes à emporter et paiement rapide.",
    features:['Menu du jour par catégorie','Disponibilité activable en un tap','Commandes à distance, comme la boutique classique'] },
  { id:'services', available:false, label:'Services',
    icon:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20.2 5.8a4.2 4.2 0 0 1-5.7 5.7L6 20l-2-2 8.5-8.5a4.2 4.2 0 0 1 5.7-5.7l-3 3 1.5 1.5 3-3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m14.5 9.5 4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    title:'Services à domicile',
    desc:"Coiffure, couture, réparation, ménage… prenez des rendez-vous et gérez vos prestations au quotidien.",
    features:[] },
  { id:'point-vente', available:false, label:'Point de vente',
    icon:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18l-2.2-1.4L14 21l-2-1.4L10 21l-1.8-1.4L6 21V3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 7.5h6M9 11h6M9 14.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    title:'Point de vente / Kiosque',
    desc:"Gérez la caisse et le stock de votre commerce physique, même sans connexion internet.",
    features:[] },
  { id:'livraison', available:false, label:'Livraison',
    icon:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M2 7.5h10.5v9H2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12.5 10.5h4l3.5 3.3v2.7h-7.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.2" cy="18.3" r="1.9" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="18.3" r="1.9" stroke="currentColor" stroke-width="1.5"/><path d="M2 10.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    title:'Livraison & courses',
    desc:"Proposez un service de livraison locale et suivez vos courses en temps réel.",
    features:[] },
  { id:'formations', available:false, label:'Formations',
    icon:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3 2 8l10 5 10-5-10-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 10.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-5.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M22 8v6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    title:'Formations & cours',
    desc:"Vendez des cours en ligne, du coaching ou des formations à votre communauté.",
    features:[] }
];
let businessTypeActiveTab = 'vente-ligne';
function selectBusinessTab(id){
  businessTypeActiveTab = id;
  document.querySelectorAll('.biz-tab').forEach(el=> el.classList.toggle('active', el.dataset.bid===id));
  const panel = document.getElementById('biz-panel');
  if(panel) panel.innerHTML = businessPanelHtml(id);
}
function businessPanelHtml(id){
  const cat = BUSINESS_CATEGORIES.find(c=>c.id===id) || BUSINESS_CATEGORIES[0];
  if(cat.available){
    return `
    <div class="biz-panel-icon">${cat.icon}</div>
    <h2>${cat.title}</h2>
    <p>${cat.desc}</p>
    <ul class="biz-feature-list">${cat.features.map(f=>`<li><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>${Utils.escapeHtml(f)}</li>`).join('')}</ul>
    <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="chooseBusinessType('${cat.id}')">Créer ma boutique</button>`;
  }
  return `
    <div class="biz-panel-icon soon">${cat.icon}</div>
    <span class="biz-soon-badge">Bientôt disponible</span>
    <h2>${cat.title}</h2>
    <p>${cat.desc}</p>
    <button class="btn btn-outline btn-block" style="margin-top:6px;" onclick="notifyBusinessType('${cat.id}')">Me prévenir de la disponibilité</button>`;
}
async function chooseBusinessType(id){
  setBusinessType(id);
  const cat = BUSINESS_CATEGORIES.find(c=>c.id===id);
  Toast.show((cat?cat.title:'Boutique')+' sélectionnée ✓');
  Router.go('dashboard');
  /* ---- Écriture en base après la navigation pour ne pas bloquer l'écran sur un
     aller-retour réseau : la boutique reste utilisable même si cette requête est
     lente, et le cache local (déjà mis à jour ci-dessus) garde la vitrine cohérente
     en attendant. ---- */
  try{
    if(Cloud.storeId) await sb.from('stores').update({ business_type:id }).eq('id', Cloud.storeId);
    _cache.store = { ..._cache.store, businessType:id };
  }catch(e){ console.error('Erreur sauvegarde type d\u2019activité', e); }
}
function notifyBusinessType(id){
  const cat = BUSINESS_CATEGORIES.find(c=>c.id===id);
  Toast.show((cat?cat.title:'Cette fonctionnalité')+' — vous serez averti(e) dès la disponibilité ✓');
}


function merchantPhoneScreen(i){
  const screens=[
    `<div class="os-top">Tableau de bord</div><div class="os-sub">SIAMS STORE</div><div class="os-card"><div>Ventes livrées</div><strong>150 000 FCFA</strong><div style="display:flex;justify-content:space-between;font-size:6px;"><span>En attente<br><b>25 800 FCFA</b></span><span>Total<br><b>175 800 FCFA</b></span></div></div><div class="os-sub">Raccourcis rapides</div><div class="os-grid"><div class="os-tile">＋<br>Produit</div><div class="os-tile">↗<br>Partager</div><div class="os-tile">◷<br>Attente</div><div class="os-tile">♙<br>Membre</div></div>`,
    `<div class="os-top">Commandes</div><div class="os-sub">Toutes · En attente · Expédiées · Livrées</div><div class="os-list">${['#SI-1048|25 000 FCFA',' #SI-1047|15 000 FCFA',' #SI-1046|30 000 FCFA',' #SI-1045|20 000 FCFA',' #SI-1044|12 000 FCFA'].map(x=>{let [a,b]=x.trim().split('|');return `<div class="os-row"><b>${a}</b><span>${b}<br><small>En attente</small></span></div>`}).join('')}</div>`,
    `<div class="os-top">Produits <span style="float:right;color:#0668e3">＋</span></div><div style="background:white;border-radius:8px;padding:8px;margin-bottom:7px;color:#8993a3">⌕ Rechercher un produit</div><div class="os-list">${['T-shirt SIAMS|12 000 FCFA|Stock:45','Casquette SIAMS|8 000 FCFA|Stock:30','Mug SIAMS|6 000 FCFA|Stock:20','Sac SIAMS|15 000 FCFA|Stock:10'].map(x=>{let [a,b,c]=x.split('|');return `<div class="os-row"><span><b>${a}</b><br><small>${c}</small></span><b>${b}</b></div>`}).join('')}</div>`,
    `<div class="os-top">Ajouter un produit</div><div class="os-list"><div class="os-row"><b>Photo</b><span>＋</span></div><div class="os-row"><b>Nom du produit</b><span>Champ texte</span></div><div class="os-row"><b>Prix</b><span>12 000 FCFA</span></div><div class="os-row"><b>Stock</b><span>45</span></div></div><div class="os-card" style="margin-top:8px;text-align:center">Enregistrer le produit</div>`,
    `<div class="os-top">Statistiques</div><div class="os-card"><div>Chiffre d'affaires</div><strong>175 800 FCFA</strong><div style="font-size:6px">+18,4% cette semaine</div></div><div class="os-list"><div class="os-row"><b>Commandes</b><span>48</span></div><div class="os-row"><b>Clients</b><span>31</span></div><div class="os-row"><b>Panier moyen</b><span>3 662 FCFA</span></div></div>`,
    `<div class="os-top">Paiements</div><div class="os-list"><div class="os-row"><b>Vente #SI-1048</b><span>25 000 FCFA<br><small>Confirmé</small></span></div><div class="os-row"><b>Vente #SI-1047</b><span>15 000 FCFA<br><small>En attente</small></span></div><div class="os-row"><b>Total encaissé</b><span><b>150 000 FCFA</b></span></div></div><div class="os-sub" style="margin-top:8px">Wave · Orange Money · MTN</div>`,
    `<div class="os-top">Livraison</div><div class="os-card" style="background:linear-gradient(135deg,#0b67d8,#16b6ff)">3 livraisons aujourd'hui<br><strong style="font-size:13px">2 en cours</strong></div><div class="os-list"><div class="os-row"><b>#SI-1048</b><span>Yopougon<br><small>En route</small></span></div><div class="os-row"><b>#SI-1046</b><span>Cocody<br><small>À préparer</small></span></div></div>`,
    `<div class="os-top">Promotions</div><div class="os-list"><div class="os-row"><b>-10% T-shirts</b><span>Actif</span></div><div class="os-row"><b>Livraison offerte</b><span>Actif</span></div><div class="os-row"><b>Créer une promotion</b><span>＋</span></div></div>`,
    `<div class="os-top">Avis clients</div><div class="os-card" style="background:linear-gradient(135deg,#f6a62c,#ff7a1a)"><strong>4,8 / 5</strong><div>Excellent niveau de satisfaction</div></div><div class="os-list"><div class="os-row"><b>★★★★★</b><span>Très bon service</span></div><div class="os-row"><b>★★★★☆</b><span>Livraison rapide</span></div></div>`,
    `<div class="os-top">Équipe</div><div class="os-list"><div class="os-row"><b>Amos</b><span>Administrateur</span></div><div class="os-row"><b>Junior</b><span>Vendeur</span></div><div class="os-row"><b>Ajouter un membre</b><span>＋</span></div></div>`,
    `<div class="os-top">Tous les services</div><div class="os-grid">${['Boutique','Statistiques','Équipe','Paiements','Livraison','Produits','Catégories','Promotions','Avis clients'].map(x=>`<div class="os-tile">▦<br><b>${x}</b></div>`).join('')}</div>`
  ];
  return screens[Math.max(0,Math.min(screens.length-1,i))];
}
function onboardAdminSlides(){
  return [
    {phone:true,phoneIndex:0,title:'Votre boutique peut aller plus loin.',text:'Découvrez votre espace marchand SIAMS et les outils essentiels pour piloter votre commerce.'},
    {phone:true,phoneIndex:0,title:'Votre tableau de bord',text:'Une vue claire de vos ventes, de vos commandes et de votre activité.'},
    {phone:true,phoneIndex:1,title:'Vos commandes',text:'Retrouvez vos commandes et leur évolution en un seul endroit.'},
    {phone:true,phoneIndex:2,title:'Vos produits',text:'Gérez votre catalogue, vos prix et vos stocks simplement.'},
    {phone:true,phoneIndex:3,title:'Ajoutez vos produits',text:'Créez un article rapidement avec ses informations essentielles.'},
    {phone:true,phoneIndex:4,title:'Vos statistiques',text:'Suivez vos performances et comprenez l’évolution de votre activité.'},
    {phone:true,phoneIndex:5,title:'Vos paiements',text:'Gardez une vue claire sur les paiements et les ventes encaissées.'},
    {phone:true,phoneIndex:6,title:'Votre livraison',text:'Organisez le suivi des livraisons et gardez vos clients informés.'},
    {phone:true,phoneIndex:7,title:'Vos promotions',text:'Mettez vos offres en avant et animez votre boutique.'},
    {phone:true,phoneIndex:8,title:'Vos clients',text:'Consultez les avis et améliorez continuellement votre expérience client.'},
    {phone:true,phoneIndex:9,title:'Votre équipe',text:'Travaillez à plusieurs et attribuez les bons rôles à votre équipe.'},
    {phone:true,phoneIndex:10,title:'Alors… on se lance maintenant ?',text:'Tout est réuni pour faire grandir votre commerce. Découvrez SIAMS, puis rejoignez-nous.'}
  ];
}
function onboardClientSlides(){
  const storeName = Utils.escapeHtml((_cache.store && _cache.store.name) || 'la boutique');
  return [
    { icon:`<svg width="46" height="46" viewBox="0 0 24 24" fill="none"><path d="M4 9h16M4 9l1.4-4h13.2L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 13a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
      title:`Bienvenue chez ${storeName}`, text:"Découvrez tous nos articles et trouvez ce qu'il vous faut en quelques clics." },
    { icon:`<svg width="46" height="46" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/><path d="M2.5 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      title:'Parcourez et ajoutez à votre panier', text:"Filtrez par catégorie, comparez les prix et enregistrez vos articles favoris." },
    { icon:`<svg width="46" height="46" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      title:'Commandez en toute simplicité', text:"Payez à la livraison ou via Wave, Orange Money, MTN — comme vous préférez." },
    { icon:`<svg width="46" height="46" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      title:'Suivez votre commande en temps réel', text:"Retrouvez l'historique et le statut de vos commandes dans « Mon compte »." }
  ];
}
function publicPhoneScreen(i){
  const screens=[
    `<div class="os-top">Tableau de bord</div><div class="os-sub">SIAMS STORE</div><div class="os-card"><div>Ventes livrées</div><strong>150 000 FCFA</strong><div style="display:flex;justify-content:space-between;font-size:6px;"><span>En attente<br><b>25 800 FCFA</b></span><span>Total des ventes<br><b>175 800 FCFA</b></span></div></div><div class="os-sub">Raccourcis rapides</div><div class="os-grid"><div class="os-tile">＋<br>Produit</div><div class="os-tile">↗<br>Partager</div><div class="os-tile">◷<br>Attente</div><div class="os-tile">♙<br>Membre</div></div>`,
    `<div class="os-top">Commandes</div><div class="os-sub">Toutes · En attente · Expédiées · Livrées</div><div class="os-list">${['#SI-1048|25 000 FCFA',' #SI-1047|15 000 FCFA',' #SI-1046|30 000 FCFA',' #SI-1045|20 000 FCFA',' #SI-1044|12 000 FCFA'].map(x=>{let [a,b]=x.trim().split('|');return `<div class="os-row"><b>${a}</b><span>${b}<br><small>En attente</small></span></div>`}).join('')}</div>`,
    `<div class="os-top">Produits <span style="float:right;color:#0668e3">＋</span></div><div style="background:white;border-radius:8px;padding:8px;margin-bottom:7px;color:#8993a3">⌕ Rechercher un produit</div><div class="os-list">${['T-shirt SIAMS|12 000 FCFA|Stock: 45','Casquette SIAMS|8 000 FCFA|Stock: 30','Mug SIAMS|6 000 FCFA|Stock: 20','Sac SIAMS|15 000 FCFA|Stock: 10','Polo SIAMS|14 000 FCFA|Stock: 25'].map(x=>{let [a,b,c]=x.split('|');return `<div class="os-row"><span><b>${a}</b><br><small>${c}</small></span><b>${b}</b></div>`}).join('')}</div>`,
    `<div class="os-top">Plus</div><div class="os-list">${['Équipe|Gérez les membres','Paiements|Transactions','Statistiques|Performances','Livraison|Zones et suivi','Promotions|Offres et réductions','Avis clients|Évaluations','Paramètres|Votre boutique'].map(x=>{let [a,b]=x.split('|');return `<div class="os-row"><b>${a}</b><span>›<br><small>${b}</small></span></div>`}).join('')}</div>`,
    `<div class="os-top">Raccourcis rapides</div><div class="os-list">${['Ajouter un produit|Ajoutez un nouveau produit','Partager ma boutique|Partagez votre lien','Commandes en attente|Voir les commandes','Ajouter un membre|Invitez un membre'].map(x=>{let [a,b]=x.split('|');return `<div class="os-row"><b>${a}</b><span><small>${b}</small></span></div>`}).join('')}</div><div class="os-card" style="margin-top:8px;text-align:center;background:linear-gradient(135deg,#e8f1ff,#d7edff);color:#0758c9">SIAMS STORE<br><small>Votre boutique en ligne</small></div>`,
    `<div class="os-top">Services</div><div class="os-grid">${['Boutique','Statistiques','Équipe','Paiements','Livraison','Produits','Catégories','Promotions','Avis clients'].map(x=>`<div class="os-tile">▦<br><b>${x}</b></div>`).join('')}</div>`
  ];
  return screens[i%6];
}
function onboardPublicSlides(){
  // Les visiteurs découvrent le même panorama produit que les marchands,
  // avec 12 étapes visuelles et sans personnage intermédiaire.
  return onboardAdminSlides().map((s,i)=>({ ...s,
    text: i===0 ? 'Découvrez comment SIAMS peut vous accompagner, puis rejoignez une plateforme pensée pour faire grandir votre commerce.' : s.text
  }));
}
/* V45 : musique de présentation supprimée à la demande. */

const Onboarding = {
  index:0, slides:[], key:'', finishRoute:'dashboard', touchStartX:0, type:'',
  init(type){
    this.index = 0;
    this.type = type;
    if(type==='admin'){ this.slides = onboardAdminSlides(); this.key = ONBOARD_ADMIN_KEY; this.finishRoute = 'dashboard'; }
    else if(type==='public'){ this.slides = onboardPublicSlides(); this.key = 'siams_public_onboarding_v2'; this.finishRoute = 'about-partnership'; }
    else { this.slides = onboardClientSlides(); this.key = ONBOARD_CLIENT_KEY; this.finishRoute = 'shop'; }
  },
  render(){
    const isAdmin = this.type==='admin';
    const isPublic = this.type==='public';
    if(isAdmin){
      return `
      <div class="onboard-wrap onboard-merchant-pro">
        <div class="onboard-merchant-top">
          <div class="onboard-progress-line"><span id="onboard-progress-bar"></span></div>
          <button class="onboard-skip" onclick="Onboarding.finish()">Passer</button>
        </div>
        <div class="onboard-merchant-head">
          <div class="onboard-brand"><img src="${LOGO_DATA_URI}" alt="SIAMS"><span>ESPACE MARCHAND</span></div>
          <div class="onboard-kicker">LES SERVICES SIAMS</div>
        </div>
        <div class="onboard-slides onboard-merchant-slides" id="onboard-touch-zone">
          <div class="onboard-track" id="onboard-track">
            ${this.slides.map((s,i)=>`
              <div class="onboard-slide merchant-slide ${i===0?'active':''}" data-oi="${i}">
                <div class="merchant-phone-stage">
                  ${i>0?`<div class="onboard-side-phone left"><div class="onboard-screen dark">${merchantPhoneScreen(Math.max(0,s.phoneIndex-1))}</div></div>`:''}
                  <div class="onboard-phone merchant-main-phone"><div class="onboard-screen">${merchantPhoneScreen(s.phoneIndex)}</div></div>
                  ${i<this.slides.length-1?`<div class="onboard-side-phone right"><div class="onboard-screen dark">${merchantPhoneScreen(Math.min(10,s.phoneIndex+1))}</div></div>`:''}
                </div>
                <div class="merchant-slide-copy">
                  <h1>${s.title}</h1>
                  <p>${s.text}</p>
                </div>
              </div>`).join('')}
          </div>
          <div class="onboard-arrows merchant-arrows">
            <button class="onboard-arrow" onclick="Onboarding.go(Onboarding.index-1)" aria-label="Précédent">‹</button>
            <button class="onboard-arrow" onclick="Onboarding.next()" aria-label="Suivant">›</button>
          </div>
        </div>
        <div class="onboard-footer merchant-footer">
          <button class="btn btn-primary btn-block" id="onboard-next-btn" onclick="Onboarding.next()">Suivant <span style="float:right;font-size:20px;line-height:16px;">→</span></button>
        </div>
      </div>`;
    }
    if(isPublic){
      return `
      <div class="onboard-wrap onboard-merchant-pro onboard-public-panorama">
        <div class="onboard-merchant-top">
          <div class="onboard-progress-line"><span id="onboard-progress-bar__v46_2"></span></div>
          <button class="onboard-skip" onclick="Onboarding.finish()">Passer</button>
        </div>
        <div class="onboard-merchant-head">
          <div class="onboard-brand"><img src="${LOGO_DATA_URI}" alt="SIAMS"><span>BIENVENUE CHEZ SIAMS</span></div>
          <div class="onboard-kicker">DÉCOUVRIR SIAMS</div>
        </div>
        <div class="onboard-slides onboard-merchant-slides" id="onboard-touch-zone__v46_2">
          <div class="onboard-track" id="onboard-track__v46_2">
            ${this.slides.map((s,i)=>`
              <div class="onboard-slide merchant-slide ${i===0?'active':''}" data-oi="${i}">
                <div class="merchant-phone-stage">
                  ${i>0?`<div class="onboard-side-phone left"><div class="onboard-screen dark">${merchantPhoneScreen(Math.max(0,s.phoneIndex-1))}</div></div>`:''}
                  <div class="onboard-phone merchant-main-phone"><div class="onboard-screen">${merchantPhoneScreen(s.phoneIndex)}</div></div>
                  ${i<this.slides.length-1?`<div class="onboard-side-phone right"><div class="onboard-screen dark">${merchantPhoneScreen(Math.min(10,s.phoneIndex+1))}</div></div>`:''}
                </div>
                <div class="merchant-slide-copy">
                  <h1>${s.title}</h1>
                  <p>${s.text}</p>
                </div>
              </div>`).join('')}
          </div>
          <div class="onboard-arrows merchant-arrows">
            <button class="onboard-arrow" onclick="Onboarding.go(Onboarding.index-1)" aria-label="Précédent">‹</button>
            <button class="onboard-arrow" onclick="Onboarding.next()" aria-label="Suivant">›</button>
          </div>
        </div>
        <div class="onboard-footer merchant-footer">
          <button class="btn btn-primary btn-block" id="onboard-next-btn__v46_2" onclick="Onboarding.next()">Suivant <span style="float:right;font-size:20px;line-height:16px;">→</span></button>
        </div>
      </div>`;
    }
    return `
    <div class="onboard-wrap">
      <button class="onboard-skip" onclick="Onboarding.finish()">Passer</button>
      <div class="onboard-slides"><div class="onboard-track" id="onboard-track__v46_3">
        ${this.slides.map((s,i)=>`
          <div class="onboard-slide ${i===0?'active':''}" data-oi="${i}">
            ${s.vision ? `<div style="width:88px;height:88px;border-radius:26px;margin-bottom:24px;background:linear-gradient(135deg,var(--indigo-dark) 0%,var(--indigo) 55%,var(--cyan) 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px -14px rgba(17,17,17,.5);overflow:hidden;"><img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;"></div><div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:var(--indigo);margin-bottom:8px;">${s.tagline||''}</div><h2>${s.title}</h2><p>${s.text}</p>` : `<div class="onboard-icon">${s.icon}</div><h2>${s.title}</h2><p>${s.text}</p>`}
          </div>`).join('')}
      </div></div>
      <div class="onboard-footer"><div class="onboard-dots">${this.slides.map((s,i)=>`<div class="onboard-dot ${i===0?'active':''}"></div>`).join('')}</div><button class="btn btn-primary btn-block" id="onboard-next-btn__v46_3" onclick="Onboarding.next()">Suivant</button></div>
    </div>`;
  },
  attach(){
    const el = document.querySelector('.onboard-slides');
    if(!el) return;
    let startX=0, startY=0, dragging=false;
    const begin=(x,y)=>{ startX=x; startY=y; dragging=true; this.touchStartX=x; };
    const end=(x,y)=>{
      if(!dragging) return;
      dragging=false;
      const dx=x-startX, dy=y-startY;
      if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.15){ dx<0 ? this.next() : this.go(this.index-1); }
    };
    el.addEventListener('touchstart',e=>begin(e.touches[0].clientX,e.touches[0].clientY),{passive:true});
    el.addEventListener('touchend',e=>end(e.changedTouches[0].clientX,e.changedTouches[0].clientY),{passive:true});
    el.addEventListener('pointerdown',e=>{ if(e.pointerType!=='touch') begin(e.clientX,e.clientY); });
    el.addEventListener('pointerup',e=>{ if(e.pointerType!=='touch') end(e.clientX,e.clientY); });
    el.addEventListener('keydown',e=>{ if(e.key==='ArrowRight') this.next(); if(e.key==='ArrowLeft') this.go(this.index-1); });
  },
  go(i){
    if(i<0 || i>=this.slides.length) return;
    this.index=i;
    const track=document.getElementById('onboard-track') || document.getElementById('onboard-track__v46_2') || document.getElementById('onboard-track__v46_3');
    if(track) track.style.transform=`translate3d(-${i*100}%,0,0)`;
    document.querySelectorAll('.onboard-slide').forEach(el=>el.classList.toggle('active',Number(el.dataset.oi)===i));
    document.querySelectorAll('.onboard-dot').forEach((el,di)=>el.classList.toggle('active',di===i));
    const btn=document.getElementById('onboard-next-btn');
    if(btn) btn.innerHTML=(i===this.slides.length-1)?'Commencer <span style="float:right;font-size:20px;line-height:16px;">✦</span>':'Suivant <span style="float:right;font-size:20px;line-height:16px;">→</span>';
    const current=document.getElementById('onboard-progress-current');
    if(current) current.textContent=String(i+1);
    const bar=document.getElementById('onboard-progress-bar');
    if(bar) bar.style.width=((i+1)/this.slides.length*100)+'%';
  },
  next(){
    if(this.index < this.slides.length-1) this.go(this.index+1);
    else this.finish();
  },
  finish(){
    markOnboardingSeen(this.key);
    Router.go(this.finishRoute);
  }
};

/* ---------------- Vérification par code (E-MAIL) ----------------
   Le code est désormais envoyé automatiquement par e-mail, via le
   système OTP natif de Supabase Auth (sb.auth.signInWithOtp /
   sb.auth.verifyOtp). Aucune fonction RPC personnalisée n'est requise
   côté serveur pour l'envoi/la vérification : Supabase s'en charge.
   ⚠️ Pré-requis côté Supabase : dans Authentication > Email Templates,
   le template "Magic Link" (utilisé par signInWithOtp) doit contenir
   {{ .Token }} afin d'envoyer un code à 8 chiffres (et non un simple
   lien de connexion). */
const OTP_RESEND_SECONDS = 60;
const OtpGate = {
  pending:false,
  mode:'login',
  email:'',
  secondsLeft:0,
  timerId:null,
  sending:false,
  start(mode, email){
    OtpGate.pending = true;
    OtpGate.mode = mode;
    OtpGate.email = email || '';
    Router.go('verify-otp');
    OtpGate.sendCode(true);
  },
  reset(){
    OtpGate.pending = false;
    clearInterval(OtpGate.timerId);
    OtpGate.timerId = null;
  },
  async sendCode(silent){
    if(OtpGate.sending) return;
    OtpGate.sending = true;
    try{
      const {error} = await sb.auth.signInWithOtp({ email: OtpGate.email, options:{ shouldCreateUser:false } });
      if(error) throw error;
      Toast.show(silent ? 'Code envoyé par e-mail ✓' : 'Nouveau code envoyé par e-mail ✓');
      OtpGate.secondsLeft = OTP_RESEND_SECONDS;
      clearInterval(OtpGate.timerId);
      OtpGate.timerId = setInterval(()=>{
        OtpGate.secondsLeft--;
        OtpGate.tickUI();
        if(OtpGate.secondsLeft<=0) clearInterval(OtpGate.timerId);
      }, 1000);
      OtpGate.tickUI();
    }catch(e){
      console.error(e);
      const detail = (e && (e.message || e.details || e.hint)) ? `${e.message||''}\n${e.details||''}\n${e.hint||''}\n(code: ${e.code||'?'})` : JSON.stringify(e);
      alert('Erreur lors de l’envoi du code par e-mail :\n\n'+detail);
      Toast.show('⚠️ Impossible d’envoyer le code par e-mail');
    }finally{
      OtpGate.sending = false;
    }
  },
  tickUI(){
    const lbl = document.getElementById('otp-timer-label');
    if(!lbl) return;
    const ready = OtpGate.secondsLeft<=0;
    const m = String(Math.floor(Math.max(0,OtpGate.secondsLeft)/60)).padStart(2,'0');
    const s = String(Math.max(0,OtpGate.secondsLeft)%60).padStart(2,'0');
    lbl.innerHTML = ready ? 'Vous n\'avez rien reçu ?' : 'Renvoyer le code dans <b>'+m+':'+s+'</b> :';
    const resendBtn = document.getElementById('otp-resend-btn');
    if(resendBtn) resendBtn.disabled = !ready;
  },
  resend(){
    if(OtpGate.secondsLeft>0){
      const secs = OtpGate.secondsLeft;
      Toast.show('Merci de patienter '+secs+'s avant de renvoyer le code');
      return;
    }
    OtpGate.sendCode(false);
  },
  async verify(){
    const boxes = [...document.querySelectorAll('.otp-box')];
    const entered = boxes.map(b=>b.value).join('');
    const err = document.getElementById('otp-error');
    if(entered.length<8){ err.textContent = 'Merci de saisir les 8 chiffres du code'; return; }
    try{
      const {error} = await sb.auth.verifyOtp({ email: OtpGate.email, token: entered, type:'email' });
      if(error){
        err.textContent = 'Code incorrect, merci de réessayer';
        boxes.forEach(b=>{ b.value=''; b.classList.remove('filled'); });
        boxes[0].focus();
        return;
      }
    }catch(e){
      console.error(e);
      err.textContent = 'Erreur de vérification, réessayez';
      return;
    }
    err.textContent = '';
    const wasRegister = OtpGate.mode === 'register';
    OtpGate.pending = false;
    clearInterval(OtpGate.timerId);
    Toast.show('E-mail vérifié ✓');
    const pendingActivationEmail = (()=>{ try{return sessionStorage.getItem('siams_activation_email')||'';}catch(e){return '';} })();
    const shouldRedeem = !!ActivationGate.getStored() && pendingActivationEmail && pendingActivationEmail === String(OtpGate.email||'').toLowerCase();
    if(wasRegister || shouldRedeem){
      try{
        const code = ActivationGate.getStored();
        if(!code) throw new Error('missing_activation_code');
        const {data,error}=await sb.rpc('redeem_activation_key',{p_code:code});
        if(error) throw error;
        if(!data || !data.success){
          const messages={invalid_code:'Code d’activation invalide.',code_already_used:'Ce code a déjà été utilisé.',store_not_found:'Boutique introuvable pour activer le code.'};
          throw new Error(messages[data&&data.error] || 'Activation impossible');
        }
        ActivationGate.clear();
        try{ sessionStorage.removeItem('siams_activation_email'); localStorage.removeItem('siams_partner_request'); }catch(e){}
        const currentUser=(await sb.auth.getUser()).data.user;
        if(currentUser) await Bootstrap.loadStoreData(currentUser);
        Toast.show('Partenariat SIAMS activé ✓');
        ContractGate.show();
      }catch(e){
        console.error(e);
        err.textContent = e.message && e.message!=='missing_activation_code' ? e.message : 'Impossible d’activer votre partenariat. Contactez le service client SIAMS.';
      }
    } else { await showWelcomeBackThenDashboard(); }
  },
  changeAccount(){
    OtpGate.reset();
    Auth.logout();
  }
};
function otpBoxHandle(el, idx){
  const boxes = [...document.querySelectorAll('.otp-box')];
  el.value = el.value.replace(/[^0-9]/g,'').slice(0,1);
  el.classList.toggle('filled', el.value.length>0);
  document.getElementById('otp-error').textContent = '';
  if(el.value && idx<boxes.length-1){ boxes[idx+1].focus(); }
  if(boxes.every(b=>b.value.length===1)) OtpGate.verify();
}
function otpBoxKeydown(e, idx){
  const boxes = [...document.querySelectorAll('.otp-box')];
  if(e.key==='Backspace' && !e.target.value && idx>0){ boxes[idx-1].focus(); boxes[idx-1].value=''; boxes[idx-1].classList.remove('filled'); }
}
function otpBoxPaste(e){
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g,'').slice(0,8);
  if(!text) return;
  e.preventDefault();
  const boxes = [...document.querySelectorAll('.otp-box')];
  text.split('').forEach((ch,i)=>{ if(boxes[i]){ boxes[i].value = ch; boxes[i].classList.add('filled'); } });
  const next = boxes[text.length] || boxes[boxes.length-1];
  next.focus();
  if(text.length===8) OtpGate.verify();
}

/* ---------------- Shared partials ---------------- */
function TopBarPlanBadge(){
  const access = Store.access();
  const badge = (access.status==='active' && access.badge) ? access.badge : null;
  if(!badge) return '';
  const isGolden = badge==='GOLDEN';
  const isPlatinum = badge==='PLATINE';
  const isAll = badge==='TOUTE BOUTIQUE';
  const isDoya = badge==='DOYA';
  const style = isGolden
    ? 'background:linear-gradient(135deg,#8A6410,#F5CB5C);color:#241900;box-shadow:0 3px 10px -2px rgba(240,194,75,.55),inset 0 0 0 1px rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.7);'
    : isPlatinum
    ? 'background:linear-gradient(135deg,#9C1128,#FF4766);color:#fff;box-shadow:0 3px 10px -2px rgba(255,59,92,.5),inset 0 0 0 1px rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.45);'
    : isAll
    ? 'background:linear-gradient(135deg,#A81C45,var(--ruby-dark));color:#fff;box-shadow:0 3px 10px -2px rgba(142,21,55,.5),inset 0 0 0 1px rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.45);'
    : isDoya
    ? 'background:linear-gradient(135deg,#0091FD,#0B67D8);color:#fff;box-shadow:0 3px 10px -2px rgba(11,103,216,.45),inset 0 0 0 1px rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.45);'
    : 'background:var(--indigo-tint);color:var(--indigo);border:1px solid rgba(17,17,17,.08);';
  const starIcon = '<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style="flex:none;"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7L12 2.5Z"/></svg>';
  return `<span class="${isGolden?'tier-badge-golden':isPlatinum?'tier-badge-platinum':isAll?'tier-badge-all':isDoya?'tier-badge-doya':''}" style="display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:800;letter-spacing:.45px;padding:5px 10px;border-radius:999px;margin-left:8px;vertical-align:middle;${style}">${(isGolden||isPlatinum||isAll||isDoya)?starIcon:''}${badge}</span>`;
}
function dashboardServiceGo(route){
  try{ Sheet.close(); }catch(e){}
  requestAnimationFrame(()=>Router.go(route));
}
function TopBar(title, sub){
  return `
  <div class="topbar">
    <div>
      <h1>${title}</h1>
      ${sub ? `<div class="page-sub">${sub}</div>` : ''}
    </div>
    <button class="bell-btn" onclick="toggleNotifPanel()">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <div class="bell-dot" id="bell-dot"></div>
    </button>
  </div>`;
}
function EmptyState(icon, title, text, cta){
  return `
  <div class="empty-card">
    <div class="empty-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${text}</p>
    ${cta||''}
  </div>`;
}
const ICONS = {
  box:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 8h16M4 8l1.5 11a2 2 0 0 0 2 1.7h9a2 2 0 0 0 2-1.7L20 8M4 8l2-4h12l2 4M9 12v3M15 12v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  team:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5M16 9.5c1.6.2 2.8 1.6 2.8 3.2M16 5.3a3 3 0 0 1 0 5.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chart:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cart:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/><path d="M2.5 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* =========================================================
   VIEWS
   ========================================================= */
const Views = {};

/* ---------- Écran d'animation au démarrage / après connexion ---------- */
if(!document.getElementById('siams-splash-anim-style')){
  const splashStyle=document.createElement('style');
  splashStyle.id='siams-splash-anim-style';
  splashStyle.textContent=`
    @keyframes siamsSplashLogoIn{0%{opacity:0;transform:scale(.55) translateY(14px);}60%{opacity:1;transform:scale(1.06) translateY(0);}100%{opacity:1;transform:scale(1) translateY(0);}}
    @keyframes siamsSplashGlow{0%,100%{box-shadow:0 20px 46px -14px rgba(22,200,220,.55),0 0 0 0 rgba(22,200,220,.35);}50%{box-shadow:0 20px 54px -10px rgba(22,200,220,.75),0 0 0 16px rgba(22,200,220,0);}}
    @keyframes siamsSplashTextIn{0%{opacity:0;transform:translateY(10px);}100%{opacity:1;transform:translateY(0);}}
    @keyframes siamsSplashBg{0%,100%{opacity:.5;transform:translate(-8%,-6%) scale(1);}50%{opacity:.85;transform:translate(4%,5%) scale(1.16);}}
    @keyframes siamsSplashBg2{0%,100%{opacity:.35;transform:translate(6%,8%) scale(1);}50%{opacity:.65;transform:translate(-5%,-4%) scale(1.2);}}
    @keyframes siamsSplashRing{0%{transform:scale(.92);opacity:.5;}100%{transform:scale(1.6);opacity:0;}}
    @keyframes siamsSplashMsgIn{0%{opacity:0;transform:translateY(8px);}15%{opacity:1;transform:translateY(0);}85%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-8px);}}
    @keyframes siamsSplashBarLoop{0%{transform:translateX(-110%);}100%{transform:translateX(230%);}}
    .siams-splash-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 28px;text-align:center;position:relative;overflow:hidden;background:var(--paper);}
    .siams-splash-grid{display:none;}
    .siams-splash-dot{display:none;}
    .siams-splash-bg{position:absolute;top:-16%;left:-18%;width:68vw;height:68vw;max-width:420px;max-height:420px;border-radius:50%;background:radial-gradient(circle,rgba(28,126,242,.16),transparent 65%);animation:siamsSplashBg 7s ease-in-out infinite;pointer-events:none;}
    .siams-splash-bg2{position:absolute;bottom:-14%;right:-16%;width:58vw;height:58vw;max-width:380px;max-height:380px;border-radius:50%;background:radial-gradient(circle,rgba(255,122,26,.14),transparent 65%);animation:siamsSplashBg2 8s ease-in-out infinite;pointer-events:none;}
    .siams-splash-card{position:relative;z-index:1;padding:30px 34px 26px;border-radius:32px;}
    .siams-splash-logo-wrap{position:relative;width:88px;height:88px;margin:0 auto 20px;}
    .siams-splash-ring{position:absolute;inset:0;border-radius:24px;border:1.5px solid var(--cyan);animation:siamsSplashRing 2.2s ease-out infinite;pointer-events:none;}
    .siams-splash-ring.delay{animation-delay:1.1s;}
    .siams-splash-logo{width:88px;height:88px;border-radius:24px;background:linear-gradient(135deg,var(--indigo-dark) 0%,var(--indigo) 55%,var(--cyan) 100%);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;overflow:hidden;animation:siamsSplashLogoIn .65s cubic-bezier(.2,.9,.3,1.3) both, siamsSplashGlow 2.4s ease-in-out .65s infinite;}
    .siams-splash-logo img{width:100%;height:100%;object-fit:cover;}
    .siams-splash-brand{font-size:20px;font-weight:900;letter-spacing:.5px;position:relative;z-index:1;color:var(--text);opacity:0;animation:siamsSplashTextIn .5s ease-out .45s forwards;}
    .siams-splash-msg-wrap{height:20px;margin-top:9px;position:relative;z-index:1;overflow:hidden;}
    .siams-splash-text{font-size:13px;font-weight:600;color:var(--text-mid);position:relative;z-index:1;}
    .siams-splash-bar-track{width:140px;height:4px;border-radius:4px;background:var(--line);overflow:hidden;margin:24px auto 0;position:relative;z-index:1;}
    .siams-splash-bar-fill{position:absolute;top:0;bottom:0;width:40%;border-radius:4px;background:linear-gradient(90deg,transparent,var(--indigo-dark),var(--cyan),transparent);animation:siamsSplashBarLoop 1.3s ease-in-out infinite;}
  `;
  document.head.appendChild(splashStyle);
}
/* ---------- Connexion ---------- */
let authMode = 'login';
const SIAMS_SPLASH_MESSAGES = ['Bon retour','Préparation de votre espace…','Synchronisation des données…','Presque prêt…'];
function siamsRunSplashMessages(root, duration){
  const el = root && root.querySelector('.siams-splash-text');
  if(!el) return;
  const msgs = SIAMS_SPLASH_MESSAGES;
  const step = Math.max(700, Math.floor(duration / msgs.length));
  let i = 0;
  el.textContent = msgs[0];
  el.style.animation = `siamsSplashMsgIn ${step}ms ease-in-out both`;
  const timer = setInterval(()=>{
    i = (i + 1) % msgs.length;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.textContent = msgs[i];
    el.style.animation = `siamsSplashMsgIn ${step}ms ease-in-out both`;
  }, step);
  setTimeout(()=>clearInterval(timer), duration + step);
}
/* ---------- Compression d'images avant envoi (limite : 5 Mo) ---------- */
const SIAMS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
function siamsCompressImageFile(file, maxBytes = SIAMS_IMAGE_MAX_BYTES, maxDim = 1600){
  return new Promise((resolve)=>{
    if(!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif'){
      resolve(file); return; // on ne touche pas aux PDF/vidéos/GIF animés
    }
    if(file.size <= maxBytes){ resolve(file); return; } // déjà assez léger
    const objUrl = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.onload = async ()=>{
      URL.revokeObjectURL(objUrl);
      const fit = (w,h,max)=>{ if(w<=max && h<=max) return {w,h}; const s=max/Math.max(w,h); return {w:Math.round(w*s),h:Math.round(h*s)}; };
      let dims = fit(imgEl.naturalWidth||imgEl.width, imgEl.naturalHeight||imgEl.height, maxDim);
      let quality = 0.88;
      let blob = null;
      for(let attempt=0; attempt<7; attempt++){
        const canvas = document.createElement('canvas');
        canvas.width = dims.w; canvas.height = dims.h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,dims.w,dims.h); // fond blanc si transparence (PNG->JPEG)
        ctx.drawImage(imgEl, 0, 0, dims.w, dims.h);
        blob = await new Promise(res=>canvas.toBlob(res,'image/jpeg',quality));
        if(!blob){ break; }
        if(blob.size <= maxBytes) break;
        if(quality > 0.5){ quality -= 0.12; }
        else { dims = fit(Math.round(dims.w*0.82), Math.round(dims.h*0.82), maxDim); quality = 0.75; }
      }
      resolve(blob || file);
    };
    imgEl.onerror = ()=>{ URL.revokeObjectURL(objUrl); resolve(file); };
    imgEl.src = objUrl;
  });
}
function siamsBlobToDataURL(blob){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
/* Compresse un fichier image puis renvoie directement un dataURL, prêt à l'emploi. */
async function siamsPrepareImageDataURL(file, opts){
  const compressed = await siamsCompressImageFile(file, opts && opts.maxBytes, opts && opts.maxDim);
  return siamsBlobToDataURL(compressed);
}

Views.loading = function(){
  return `<div class="siams-splash-wrap">
    <div class="siams-splash-bg"></div>
    <div class="siams-splash-bg2"></div>
    <div class="siams-splash-card">
      <div class="siams-splash-logo-wrap">
        <span class="siams-splash-ring"></span>
        <span class="siams-splash-ring delay"></span>
        <div class="siams-splash-logo">
          <img src="${LOGO_DATA_URI}" alt="SIAMS">
        </div>
      </div>
      <div class="siams-splash-brand">SIAMS</div>
      <div class="siams-splash-msg-wrap"><div class="siams-splash-text">Bon retour</div></div>
      <div class="siams-splash-bar-track"><div class="siams-splash-bar-fill"></div></div>
    </div>
  </div>`;
};
/* Boucle de messages sans durée fixe : tourne tant que le démarrage réel n'est
   pas terminé, puis s'arrête via la fonction retournée (stop()). */
function siamsStartSplashLoop(root){
  const el = root && root.querySelector('.siams-splash-text');
  if(!el) return ()=>{};
  const msgs = SIAMS_SPLASH_MESSAGES;
  const step = 900;
  let i = 0;
  const show = ()=>{ el.style.animation='none'; void el.offsetWidth; el.textContent=msgs[i]; el.style.animation = `siamsSplashMsgIn ${step}ms ease-in-out both`; };
  show();
  const timer = setInterval(()=>{ i = (i+1) % msgs.length; show(); }, step);
  return ()=>clearInterval(timer);
}
/* ---- Écran dédié logo + « Bon retour » affiché après connexion, avant le tableau de bord ---- */
async function showWelcomeBackThenDashboard(){
  const root = document.getElementById('page-root');
  const bottomNav = document.getElementById('bottom-nav');
  if(bottomNav) bottomNav.classList.add('hidden');
  if(root){ root.innerHTML = Views.loading(); siamsRunSplashMessages(root, 1200); }
  await new Promise(resolve=>setTimeout(resolve, 1200));
  Router.go('dashboard');
}
Views.welcome = function(){
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 28px;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:radial-gradient(480px 320px at 50% -10%, rgba(17,17,17,.16), transparent 60%);pointer-events:none;"></div>
    <img src="${SIAMS_WATERMARK_DATA_URI}" alt="" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(560px,92vw);height:auto;opacity:.09;pointer-events:none;z-index:0;">
    <div style="width:88px;height:88px;border-radius:26px;margin-bottom:26px;background:linear-gradient(135deg,var(--indigo-dark) 0%,var(--indigo) 55%,var(--cyan) 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px -14px rgba(17,17,17,.5);position:relative;z-index:1;overflow:hidden;">
      <img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:var(--indigo);margin-bottom:8px;position:relative;z-index:1;">SIAMS</div>
    <h1 style="font-size:25px;line-height:1.3;margin:0 0 10px;letter-spacing:-.5px;position:relative;z-index:1;">Votre boutique mérite mieux.</h1>
    <p style="color:var(--text-mid);font-size:14.5px;line-height:1.55;margin:0 0 26px;max-width:320px;position:relative;z-index:1;">Découvrez l'application SIAMS et comment nous accompagnons les commerçants dans leur activité en ligne.</p>
    <button class="btn btn-primary btn-block" style="max-width:320px;position:relative;z-index:1;" onclick="Router.go('onboarding-public')">Découvrir SIAMS</button>
    <button class="btn btn-outline btn-block" style="max-width:320px;position:relative;z-index:1;margin-top:10px;" onclick="authMode='login';Router.go('login')">Déjà partenaire ? Se connecter</button>
    <button class="btn btn-ghost btn-block" style="max-width:320px;position:relative;z-index:1;margin-top:8px;" onclick="Router.go('shop')">Accéder à l’espace client</button>
  </div>`;
};

Views['onboarding-public'] = function(){ Onboarding.init('public'); return Onboarding.render(); };
Views._after_onboarding_public = function(){ Onboarding.attach(); };

Views['about-partnership'] = function(){
  const q=ActivationGate.getRequest();
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;padding:28px 22px;">
    <button onclick="Router.go('onboarding-public')" style="border:none;background:var(--panel);color:var(--text);width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:18px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="store-logo" style="width:56px;height:56px;border-radius:16px;margin-bottom:18px;overflow:hidden;"><img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;"></div>
    <div style="font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--indigo);text-transform:uppercase;margin-bottom:5px;">PARTENARIAT SIAMS</div>
    <h1 style="font-size:25px;line-height:1.15;margin:0 0 8px;">Devenir partenaire SIAMS</h1>
    <p style="color:var(--text-mid);font-size:14px;line-height:1.55;margin:0 0 16px;">Envoyez votre demande au service client. Votre message sera personnalisé pour permettre à SIAMS de traiter votre requête plus rapidement.</p>
    <div style="display:grid;gap:9px;margin-bottom:16px;">
      <div class="field"><label>Nom / responsable</label><input id="partner-name" value="${Utils.escapeHtml(q.name||'')}" placeholder="Votre nom complet"></div>
      <div class="field"><label>Nom de la boutique</label><input id="partner-shop" value="${Utils.escapeHtml(q.shop||'')}" placeholder="Nom de votre commerce"></div>
      <div class="field"><label>Téléphone / WhatsApp</label><input id="partner-phone" value="${Utils.escapeHtml(q.phone||'')}" inputmode="tel" placeholder="07 00 00 00 00"></div>
      <div class="field"><label>Votre requête</label><textarea id="partner-request" rows="4" placeholder="Expliquez brièvement votre besoin ou votre projet…">${Utils.escapeHtml(q.request||'')}</textarea></div>
    </div>
    <div style="margin-top:auto;">
      <button class="btn btn-primary btn-block" onclick="ActivationGate.sendPartnerRequest()">Envoyer ma demande au service client</button>
      <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="Router.go('welcome')">Quitter</button>
    </div>
  </div>`;
};

const ActivationGate = {
  code:'',
  busy:false,
  normalize(v){ return String(v||'').trim().toUpperCase().replace(/\s+/g,''); },
  getRequest(){ try{return JSON.parse(localStorage.getItem('siams_partner_request')||'{}')||{};}catch(e){return {};} },
  saveRequest(data){ try{localStorage.setItem('siams_partner_request',JSON.stringify(data||{}));}catch(e){} },
  hasPendingRequest(){ const q=this.getRequest(); return !!(q.pending); },
  sendPartnerRequest(){
    const name=(document.getElementById('partner-name')?.value||'').trim();
    const shop=(document.getElementById('partner-shop')?.value||'').trim();
    const phone=(document.getElementById('partner-phone')?.value||'').trim();
    const request=(document.getElementById('partner-request')?.value||'').trim();
    if(!name||!phone||!request){ Toast.show('Renseignez votre nom, votre téléphone et votre requête.'); return; }
    const q={name,shop,phone,request,pending:true,createdAt:Date.now()};
    this.saveRequest(q);
    const msg=[
      'Bonjour Service Client SIAMS,',
      '',
      'Je souhaite devenir partenaire SIAMS et obtenir mon code d’activation.',
      '',
      `Nom / responsable : ${name}`,
      `Boutique : ${shop||'À préciser'}`,
      `Téléphone / WhatsApp : ${phone}`,
      '',
      'Ma requête :',
      request,
      '',
      'Merci de traiter ma demande et de me transmettre mon code partenaire.',
      '',
      'Message envoyé depuis l’application SIAMS.'
    ].join('\n');
    window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent(msg),'_blank');
    Toast.show('Demande envoyée au service client ✓');
    Router.go('activation-code');
  },
  openWhatsApp(){ Router.go('about-partnership'); },
  back(){ Router.go('about-partnership'); },
  async checkStatus(){
    const q=this.getRequest();
    const id=q.requestId;
    const btn=document.getElementById('activation-check-btn');
    if(!id){ Toast.show('Aucune demande en cours à vérifier.'); return; }
    if(btn){ btn.disabled=true; btn.textContent='Vérification...'; }
    try{
      const {data,error}=await sb.from('registration_requests').select('status,activation_code').eq('id',id).single();
      if(error) throw error;
      if(data && data.status==='approved' && data.activation_code){
        try{ localStorage.setItem('siams_activation_code',data.activation_code); sessionStorage.setItem('siams_activation_code',data.activation_code); }catch(e){}
        this.code=data.activation_code;
        Toast.show('Code d’activation reçu ✓');
        Router.go('activation-code');
      }else if(data && data.status==='rejected'){
        Toast.show('Votre demande a été refusée. Contactez le service client SIAMS.');
      }else{
        Toast.show('Activation en cours — pas encore de code disponible.');
      }
    }catch(e){
      console.error(e);
      Toast.show('Impossible de vérifier le statut pour le moment.');
    }finally{
      if(btn){ btn.disabled=false; btn.textContent='Vérifier si mon code est arrivé'; }
    }
  },
  quit(){
    this.clear();
    try{localStorage.removeItem('siams_partner_request');}catch(e){}
    Router.go('welcome');
  },
  async validate(){
    const input=document.getElementById('activation-code-input');
    const err=document.getElementById('activation-code-error');
    const btn=document.getElementById('activation-code-btn');
    const code=this.normalize(input&&input.value);
    if(!code){ err.textContent='Entrez votre code d’activation'; return; }
    if(this.busy) return;
    this.busy=true; err.textContent=''; btn.disabled=true; btn.textContent='Vérification...';
    try{
      const {data,error}=await sb.rpc('check_activation_key',{p_code:code});
      if(error) throw error;
      if(!data || !data.success){
        const messages={invalid_code:'Code invalide.',code_already_used:'Ce code a déjà été utilisé.',code_expired:'Ce code a expiré.'};
        err.textContent=messages[data&&data.error] || 'Code d’activation invalide.';
        return;
      }
      this.code=code;
      try{ localStorage.setItem('siams_activation_code',code); sessionStorage.setItem('siams_activation_code',code); }catch(e){}
      Toast.show('Code d’activation validé ✓');
      Router.go('register');
    }catch(e){
      console.error(e);
      err.textContent='Impossible de vérifier le code pour le moment.';
    }finally{
      this.busy=false; btn.disabled=false; btn.textContent='Valider le code';
    }
  },
  getStored(){
    if(this.code) return this.code;
    try{ return localStorage.getItem('siams_activation_code') || sessionStorage.getItem('siams_activation_code') || ''; }catch(e){ return ''; }
  },
  clear(){ this.code=''; try{localStorage.removeItem('siams_activation_code');sessionStorage.removeItem('siams_activation_code');}catch(e){} }
};

Views['activation-code'] = function(){
  const q=ActivationGate.getRequest();
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;padding:32px 26px;">
    <div style="width:56px;height:56px;border-radius:16px;margin-bottom:22px;overflow:hidden;"><img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;"></div>
    <div style="font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--indigo);text-transform:uppercase;margin-bottom:5px;">ACCÈS PARTENAIRE</div>
    <h1 style="font-size:25px;margin:0 0 8px;">Votre code partenaire</h1>
    <p style="color:var(--text-mid);font-size:14px;line-height:1.55;margin:0 0 22px;">${q.pending?'Votre demande a bien été enregistrée. Vous recevrez automatiquement un e-mail de serviceclientsiams.ci@gmail.com contenant votre code d’activation dès que le service client SIAMS aura approuvé votre compte.':'Saisissez le code personnel transmis par le service client SIAMS pour commencer votre inscription.'}</p>
    ${q.pending?`<div id="activation-pending-panel" style="padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--panel);margin-bottom:16px;display:flex;align-items:center;gap:12px;"><div class="spinner" style="width:20px;height:20px;border:2.5px solid var(--line);border-top-color:var(--indigo);border-radius:50%;animation:siams-spin .8s linear infinite;flex:none;"></div><div><b style="font-size:12.5px;">Activation en cours…</b><div style="font-size:11px;color:var(--text-mid);margin-top:3px;">Votre demande est en cours d’examen par le service client SIAMS.</div></div></div>`:''}
    <div class="field"><label>Code d’activation</label><input id="activation-code-input" type="text" autocomplete="off" autocapitalize="characters" placeholder="SIAMS-XXXXXX" value="${Utils.escapeHtml(ActivationGate.getStored())}" oninput="document.getElementById('activation-code-error').textContent=''"></div>
    <div id="activation-code-error" style="color:var(--red);font-size:12.5px;min-height:20px;margin:-6px 0 14px;"></div>
    <button id="activation-code-btn" class="btn btn-primary btn-block" onclick="ActivationGate.validate()">Valider le code</button>
    ${q.pending?'<button id="activation-check-btn" class="btn btn-outline btn-block" style="margin-top:10px;" onclick="ActivationGate.checkStatus()">Vérifier si mon code est arrivé</button>':''}
    <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="ActivationGate.openWhatsApp()">${q.pending?'Modifier ma demande':'Demander un code au service client'}</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="ActivationGate.quit()">Quitter</button>
  </div>`;
};

Views.login = function(){
  authMode='login';
  return `
  <div class="siams-login-preview">
    
<div class="siams-lp-phone">
  <div class="siams-lp-hero">
    <div class="siams-lp-siams-lp-hero-top">
      <button type="button" class="siams-lp-back-btn" onclick="Router.go('welcome')" aria-label="Retour">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div style="width:38px;"></div>
      <div style="width:38px;"></div>
    </div>

    <div class="siams-lp-mascot-wrap">
      <img class="siams-lp-mascot-img" src="images/mascot.webp">
    </div>

    <div class="siams-lp-msg-board">
      <div class="siams-lp-msg-card">
        <div class="siams-lp-msg-ico mango">🛍️</div>
        <div class="siams-lp-msg-text"><b>Nouvelle commande</b><span>Robe wax — 12 000 FCFA</span></div>
      </div>
      <div class="siams-lp-msg-card">
        <div class="siams-lp-msg-ico green">💳</div>
        <div class="siams-lp-msg-text"><b>Paiement reçu</b><span>Wave — confirmé</span></div>
      </div>
      <div class="siams-lp-msg-card">
        <div class="siams-lp-msg-ico blue">⭐</div>
        <div class="siams-lp-msg-text"><b>Nouvel avis client</b><span>5 étoiles — merci !</span></div>
      </div>
    </div>
  </div>

  <div class="siams-lp-card">
    <h1>Bon retour</h1>
    <p class="siams-lp-sub">Connectez-vous pour gérer votre boutique.</p>

    <div class="siams-lp-field">
      <label>E-mail ou ID marchand SIAMS</label>
      <div class="siams-lp-input-wrap">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        <input type="text" id="auth-email" placeholder="vous@exemple.com ou SIAMS-XXXXXX">
      </div>
    </div>

    <div class="siams-lp-field">
      <label>Mot de passe</label>
      <div class="siams-lp-input-wrap">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7"/></svg>
        <input type="password" id="auth-pass" autocomplete="current-password" placeholder="••••••••">
        <button type="button" class="siams-lp-eye-btn" aria-label="Afficher le mot de passe" onclick="togglePasswordVisibility('auth-pass', this)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>
        </button>
      </div>
    </div>

    <div class="siams-lp-row-between">
      <div class="siams-lp-remember">
        <span class="siams-lp-checkbox">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        Rester connecté
      </div>
      <button type="button" class="siams-lp-link" style="background:none;border:0;padding:0;cursor:pointer;font:inherit;" onclick="contactSupportForgotPasswordCustom()">Mot de passe oublié ?</button>
    </div>

    <div id="auth-error" style="font-size:13px;margin:0 0 14px;"></div><button type="button" class="siams-lp-btn-primary" id="auth-submit-btn" onclick="doLogin()">Se connecter</button>

    <div class="siams-lp-divider">Ou continuer avec</div>
    <div class="siams-lp-social-row">
      <button type="button" class="siams-lp-social-btn">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.59-5.19 3.59-8.84z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.89-3.02c-1.08.72-2.45 1.15-4.04 1.15-3.1 0-5.73-2.09-6.67-4.9H1.32v3.09C3.29 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.33 14.33A7.2 7.2 0 0 1 4.94 12c0-.81.14-1.6.39-2.33V6.58H1.32A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.32 5.42l4.01-3.09z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.29 2.7 1.32 6.58l4.01 3.09C6.27 6.86 8.9 4.77 12 4.77z"/></svg>
        Google
      </button>
      <button type="button" class="siams-lp-social-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#0B0E17"><path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.03-.83.87-2.19 1.55-3.34 1.46-.14-1.1.42-2.25 1.19-3.02.83-.87 2.27-1.53 3.36-1.47zM20.5 17.34c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.53.02-1.92-1-4-1-2.07 0-2.51.98-4.04.99-1.73.02-3.05-1.71-4.04-3.27-2.77-4.32-3.06-9.39-1.35-12.09 1.21-1.92 3.13-3.05 4.94-3.05 1.84 0 3 1.02 4.52 1.02 1.47 0 2.37-1.02 4.5-1.02 1.61 0 3.31.88 4.52 2.4-3.97 2.18-3.33 7.84.59 9.55z"/></svg>
        Apple
      </button>
    </div>
    <div style="text-align:center;font-size:10.5px;color:var(--text-soft);margin:8px 0 6px;">Bientôt disponible</div>

    <button type="button" class="siams-lp-id-recover" onclick="Router.go('recover-id')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15v6m0 0l-3-3m3 3l3-3M4 9V7a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      ID marchand oublié ?
    </button>

  </div>
</div>
  </div>`;
};
Views.register = function(){
  if(!ActivationGate.getStored()) return Views['activation-code']();
  authMode='register';
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:32px 26px;">
    <button onclick="Router.go('activation-code')" style="border:none;background:var(--panel);color:var(--text);width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:18px;">←</button>
    <div class="store-logo" style="width:56px;height:56px;border-radius:16px;margin-bottom:22px;overflow:hidden;"><img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;"></div>
    <div style="font-size:10px;font-weight:900;letter-spacing:.1em;color:var(--green);text-transform:uppercase;margin-bottom:5px;">CODE PARTENAIRE VALIDÉ</div>
    <h1 style="font-size:24px;margin:0 0 6px;">Créer votre compte</h1>
    <p style="color:var(--text-mid);font-size:14px;margin:0 0 22px;">Votre inscription est autorisée par le code SIAMS validé.</p>
    <div class="field"><label>Adresse e-mail</label><input id="auth-email__v46_2" type="email" placeholder="vous@exemple.com" autocomplete="email"></div>
    <div class="field"><label>Numéro de téléphone</label><input id="auth-phone" type="tel" placeholder="07 00 00 00 00" autocomplete="tel"></div>
    <div class="field"><label>Mot de passe</label><div class="pass-field-wrap"><input id="auth-pass__v46_2" type="password" placeholder="••••••••" autocomplete="new-password"><button type="button" class="pass-toggle-btn" aria-label="Afficher le mot de passe" onclick="togglePasswordVisibility('auth-pass__v46_2', this)">${EYE_SVG}</button></div><div style="font-size:12px;color:var(--text-mid);margin-top:5px;">Au moins 6 caractères</div></div>
    <div class="field"><label>Confirmer le mot de passe</label><div class="pass-field-wrap"><input id="auth-pass2" type="password" placeholder="••••••••" autocomplete="new-password"><button type="button" class="pass-toggle-btn" aria-label="Afficher le mot de passe" onclick="togglePasswordVisibility('auth-pass2', this)">${EYE_SVG}</button></div></div>
    <div id="auth-error__v46_2" style="font-size:13px;margin-bottom:14px;"></div>
    <button class="btn btn-primary btn-block" id="auth-submit-btn__v46_2" onclick="doRegister()">Créer mon compte</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="Router.go('activation-code')">Retour au code partenaire</button>
  </div>`;
};

/* ---------- Vérification par code (E-MAIL) ---------- */
Views['verify-otp'] = function(){
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;">
    <div class="otp-topbar">
      <button class="otp-back" onclick="OtpGate.changeAccount()" aria-label="Retour">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="otp-help" onclick="Toast.show('Contactez le support pour être aidé')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 13a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="3" y="13" width="4" height="6" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="17" y="13" width="4" height="6" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>
        Besoin d'aide ?
      </button>
    </div>

    <h1 class="otp-title">Entrez le code reçu par e-mail</h1>
    <div class="otp-resend-label" style="margin:0 20px 8px;text-align:left;">Un code a été envoyé à <b>${OtpGate.email}</b></div>

    <div class="otp-boxes">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" autofocus oninput="otpBoxHandle(this,0)" onkeydown="otpBoxKeydown(event,0)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,1)" onkeydown="otpBoxKeydown(event,1)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,2)" onkeydown="otpBoxKeydown(event,2)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,3)" onkeydown="otpBoxKeydown(event,3)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,4)" onkeydown="otpBoxKeydown(event,4)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,5)" onkeydown="otpBoxKeydown(event,5)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,6)" onkeydown="otpBoxKeydown(event,6)" onpaste="otpBoxPaste(event)">
      <input class="otp-box" type="tel" inputmode="numeric" maxlength="1" oninput="otpBoxHandle(this,7)" onkeydown="otpBoxKeydown(event,7)" onpaste="otpBoxPaste(event)">
    </div>

    <div class="otp-resend-label" id="otp-timer-label">Renvoyer le code dans <b>00:${String(OTP_RESEND_SECONDS).padStart(2,'0')}</b></div>

    <div class="otp-channels">
      <button class="otp-channel active" id="otp-resend-btn" disabled onclick="OtpGate.resend()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 1 3 6.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 17v-4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Renvoyer le code par e-mail
      </button>
    </div>

    <div class="otp-error" id="otp-error"></div>

    <button class="otp-changenum" onclick="OtpGate.changeAccount()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M11 18.5h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Utiliser un autre compte
    </button>
  </div>`;
};
Views._after_verify_otp = function(){
  OtpGate.tickUI();
  const first = document.querySelector('.otp-box');
  if(first) first.focus();
};

/* ---------- Onboarding (tutoriel de bienvenue) ---------- */
Views['onboarding-admin'] = function(){ Onboarding.init('admin'); return Onboarding.render(); };
Views._after_onboarding_admin = function(){ Onboarding.attach(); };
Views['onboarding-client'] = function(){ Onboarding.init('client'); return Onboarding.render(); };
Views._after_onboarding_client = function(){ Onboarding.attach(); };

/* ---------- Choix du type d'activité ---------- */
Views['business-type'] = function(){
  businessTypeActiveTab = 'vente-ligne';
  return `
  <div style="padding:26px 20px 4px;text-align:center;">
    <div style="width:52px;height:52px;border-radius:15px;margin:0 auto 16px;overflow:hidden;box-shadow:0 10px 22px -10px rgba(17,17,17,.4);">
      <img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <h1 style="font-size:21px;margin:0 0 6px;letter-spacing:-.3px;">SIAMS à vos côtés</h1>
    <p style="color:var(--text-mid);font-size:13.5px;margin:0 0 4px;line-height:1.5;">Pour la création de toutes vos boutiques, quelle que soit votre activité.</p>
  </div>
  <div class="biz-tabs">
    ${BUSINESS_CATEGORIES.map(c=>`
      <button class="biz-tab ${c.id==='vente-ligne'?'active':''}" data-bid="${c.id}" onclick="selectBusinessTab('${c.id}')">
        <span class="biz-tab-icon">${c.icon}</span>
        <span>${Utils.escapeHtml(c.label)}</span>
        ${!c.available?'<span class="biz-tab-dot"></span>':''}
      </button>`).join('')}
  </div>
  <div class="biz-panel" id="biz-panel">${businessPanelHtml('vente-ligne')}</div>
  `;
};

function toggleAuthMode(){ Router.go(ActivationGate.getStored() ? 'register' : 'activation-code'); }
/* ---------- Badge « vérifié » façon Meta, affiché quand l'abonnement est payé et actif
   ET que l'identité de la boutique a été validée par SIAMS (pièce officielle + photo en
   temps réel, cf. store.verification.verified). Sans identification validée, le badge de
   formule reste verrouillé même si le Pass est payé. ---- */
function isPaidSubscriptionActive(){
  const store = Store.store;
  const identityVerified = !!(store && store.verification && store.verification.verified);
  return Store.access().status==='active' && Store.hasFeature('badgeVisibility') && identityVerified;
}
function VerifiedBadge(size, plan){
  size = size || 16;
  /* ---- Récapitulatif des badges par formule (façon Meta) :
     BON MOOD → aucun badge · DOYEN → badge noir · DOYA → badge bleu ·
     TOUTE BOUTIQUE → badge bordeaux · PLATINE → badge rouge · GOLDEN → badge doré exclusif ---- */
  const color = plan==='golden' ? '#F0C24B' : plan==='platinum' ? '#D7263D' : plan==='all' ? '#8E1537' : plan==='doya' ? '#0091FD' : '#0B0E17';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;vertical-align:middle;">
    <path d="M12 1.3 14.7 3.8 18.3 3.1 19.1 6.7 22.3 8.5 20.7 12 22.3 15.5 19.1 17.3 18.3 20.9 14.7 20.2 12 22.7 9.3 20.2 5.7 20.9 4.9 17.3 1.7 15.5 3.3 12 1.7 8.5 4.9 6.7 5.7 3.1 9.3 3.8 12 1.3Z" fill="${color}"/>
    <path d="m7.7 12.2 2.8 2.8 5.8-6" stroke="${plan==='golden'?'#1a1300':'#fff'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
/* ---- Badge « boutique certifiée » (vert) : identité vérifiée par SIAMS
   (pièce officielle + photo en temps réel), indépendant du badge de formule
   d'abonnement ci-dessus. Affiché dès que store.verification.verified est vrai. ---- */
function CertifiedBadge(size){
  size = size || 16;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;vertical-align:middle;" aria-label="Boutique certifiée SIAMS">
    <circle cx="12" cy="12" r="10.5" fill="#1FAA59"/>
    <path d="m7.7 12.2 2.8 2.8 5.8-6" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
const EYE_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>';
const EYE_OFF_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2M6.2 6.6C3.9 8.1 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.7-1.2M10.7 5.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7-.5.9-1.2 2-2.2 3.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function togglePasswordVisibility(inputId, btn){
  const input = document.getElementById(inputId);
  if(!input) return;
  const willShow = input.type === 'password';
  input.type = willShow ? 'text' : 'password';
  btn.innerHTML = willShow ? EYE_OFF_SVG : EYE_SVG;
  btn.setAttribute('aria-label', willShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
}
function contactSupportForgotPassword(){
  const identifier = (document.getElementById('auth-email')?.value || '').trim();
  const cleanIdentifier = identifier || 'Non renseigné';
  const isMerchantId = /^SIAMS-[A-Z0-9_-]+$/i.test(cleanIdentifier);
  const merchantIdLine = isMerchantId
    ? `ID marchand SIAMS : ${cleanIdentifier.toUpperCase()}`
    : `ID marchand SIAMS : Non renseigné (à confirmer par SIAMS)`;
  const emailLine = !isMerchantId && cleanIdentifier.includes('@')
    ? `E-mail du compte : ${cleanIdentifier}`
    : `E-mail du compte : À confirmer`;
  const msg = [
    'Bonjour Service Client SIAMS,',
    '',
    "Je suis un marchand SIAMS et j'ai oublié mon mot de passe.",
    'Je souhaite récupérer l’accès à mon compte.',
    '',
    merchantIdLine,
    emailLine,
    `Boutique : À confirmer par SIAMS`,
    `Téléphone marchand : À confirmer par SIAMS`,
    '',
    'Merci de vérifier mon compte et de m’aider à réinitialiser mon mot de passe.',
    '',
    'Message envoyé depuis l’espace de connexion SIAMS.'
  ].join('\n');
  window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent(msg), '_blank');
}
async function doLogin(){
  const identifier = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const err = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');
  err.style.color = 'var(--red)';
  if(!identifier || !pass){ err.textContent = 'Merci de remplir tous les champs'; return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Connexion...';
  const resolved = await Auth.resolveEmail(identifier);
  if(!resolved.ok){
    btn.disabled = false; btn.textContent = 'Se connecter';
    err.textContent = 'E-mail ou ID marchand SIAMS introuvable';
    return;
  }
  const res = await Auth.login(resolved.email, pass);
  if(res.ok){ OtpGate.start('login', res.email); return; }
  btn.disabled = false; btn.textContent = 'Se connecter';
  err.textContent = res.message || 'Connexion impossible';
}
/* ---------- Partnership post-inscription supprimé : le partenariat est désormais traité avant l'inscription. ---------- */

/* ---------- Confirmation e-mail (lien de vérification Supabase) ---------- */
const ConfirmEmail = {
  email:'',
  show(email){
    this.email = email || '';
    Router.go('confirm-email');
  },
  async resend(){
    if(!this.email) return;
    try{
      const { error } = await sb.auth.resend({ type:'signup', email:this.email });
      if(error) throw error;
      Toast.show("E-mail de confirmation renvoyé ✓");
    }catch(e){
      Toast.show("Impossible de renvoyer l'e-mail pour le moment");
    }
  },
  openMail(){
    const domain = (this.email.split('@')[1]||'').toLowerCase();
    const inboxUrls = {
      'gmail.com':'https://mail.google.com/mail/u/0/#inbox',
      'googlemail.com':'https://mail.google.com/mail/u/0/#inbox',
      'outlook.com':'https://outlook.live.com/mail/0/inbox',
      'hotmail.com':'https://outlook.live.com/mail/0/inbox',
      'live.com':'https://outlook.live.com/mail/0/inbox',
      'yahoo.com':'https://mail.yahoo.com/',
      'yahoo.fr':'https://mail.yahoo.com/',
      'icloud.com':'https://www.icloud.com/mail',
      'me.com':'https://www.icloud.com/mail'
    };
    const url = inboxUrls[domain];
    if(url){ window.open(url,'_blank'); }
    else{ window.location.href = 'mailto:'; }
  },
  goLogin(){
    authMode = 'login';
    Router.go('login');
  }
};

/* ---------- ID marchand SIAMS (affiché juste après la validation du contrat / vérification OTP) ----------
   NOTE PROTOTYPE : nécessite côté Supabase une colonne stores.login_id ainsi que les
   fonctions RPC find_email_by_login_id / find_login_id_by_email (SECURITY DEFINER). ---- */
/* ---------- Carte d'identifiants SIAMS (PDF format carte, style badge) ---------- */
async function downloadAccountIdCardPDF(){
  const logoPdf = await loadImageAsDataURL(LOGO_DATA_URI);

  const id = AccountId.current;
  if(!id){ Toast.show('ID marchand indisponible'); return; }
  if(!await ensureJsPDF()){ Toast.show('Génération PDF indisponible, réessayez'); return; }
  const { jsPDF } = window.jspdf;
  const store = Store.store;
  const navy = [5,42,77], blueDeep = [0,96,217], cyan = [0,214,238], white = [255,255,255];
  const cardW = 340, cardH = 214; // format carte bancaire, en points
  const doc = new jsPDF({ unit:'pt', format:[cardW+40, cardH+40] });
  const ox = 20, oy = 20;

  // Fond dégradé simulé (bandes) + panneau navy
  doc.setFillColor(...navy);
  doc.roundedRect(ox, oy, cardW, cardH, 14, 14, 'F');
  doc.setFillColor(...blueDeep);
  doc.roundedRect(ox, oy, cardW, 64, 14, 14, 'F');
  doc.setFillColor(...navy);
  doc.rect(ox, oy+40, cardW, 24, 'F');
  doc.setFillColor(...cyan);
  doc.rect(ox, oy+62, cardW, 2.4, 'F');

  // En-tête : logo + nom SIAMS
  try{ doc.addImage(logoPdf, 'PNG', ox+16, oy+14, 34, 34, undefined, 'FAST'); }catch(e){}
  doc.setTextColor(...white);
  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('SIAMS', ox+58, oy+30);
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.text('Carte d\'identifiant vendeur', ox+58, oy+42);

  // Nom de la boutique
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(String(store.name||'Ma boutique'), ox+16, oy+92, {maxWidth:cardW-32});

  // Identifiant, en évidence
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.setTextColor(200,215,235);
  doc.text('ID MARCHAND SIAMS', ox+16, oy+118);
  doc.setFont('courier','bold'); doc.setFontSize(20);
  doc.setTextColor(...white);
  doc.text(id, ox+16, oy+142, {charSpace:1.2});

  // Pied de carte
  doc.setDrawColor(...cyan); doc.setLineWidth(0.8);
  doc.line(ox+16, oy+cardH-38, ox+cardW-16, oy+cardH-38);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
  doc.setTextColor(190,205,225);
  doc.text('Utilisez cet identifiant pour vous reconnecter sans ressaisir votre e-mail.', ox+16, oy+cardH-24, {maxWidth:cardW-32});
  doc.text('siams.ci — serviceclientsiams.ci@gmail.com', ox+16, oy+cardH-12);

  doc.save(`carte-identifiant-siams-${id}.pdf`);
  Toast.show('Carte d\'identifiant téléchargée ✓');
}
const AccountId = {
  current:'',
  showAfterRegister(){
    this.current = Cloud.loginId || (_cache.store && _cache.store.loginId) || '';
    Router.go('account-id');
  },
  open(){
    this.current = Cloud.loginId || (_cache.store && _cache.store.loginId) || '';
    Router.go('account-id');
  },
  copy(){
    if(!this.current) return;
    (navigator.clipboard ? navigator.clipboard.writeText(this.current) : Promise.reject())
      .then(()=> Toast.show('Identifiant copié ✓'))
      .catch(()=> Toast.show("Impossible de copier l'identifiant"));
  },
  save(){ downloadAccountIdCardPDF(); },
  continueToApp(){ Router.go('dashboard'); }
};
Views['account-id'] = function(){
  const id = AccountId.current || '';
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;padding:32px 26px;">
    <div class="store-logo" style="width:56px;height:56px;border-radius:16px;margin-bottom:22px;overflow:hidden;">
      <img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <h1 style="font-size:23px;margin:0 0 8px;">Votre ID marchand SIAMS</h1>
    <p style="color:var(--text-mid);font-size:14.5px;line-height:1.6;margin:0 0 22px;">Utilisez-le pour vous reconnecter à votre compte, sans ressaisir votre e-mail à chaque fois. Conservez-le en lieu sûr.</p>
    <div style="border:1.5px solid var(--indigo);border-radius:var(--radius-md);padding:20px 16px;background:var(--indigo-tint);text-align:center;margin-bottom:16px;">
      <div style="font-size:11px;color:var(--indigo);font-weight:700;letter-spacing:.4px;margin-bottom:8px;">ID MARCHAND SIAMS</div>
      <div class="mono" style="font-size:22px;font-weight:800;letter-spacing:1px;color:var(--text);">${Utils.escapeHtml(id)}</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:22px;">
      <button class="btn btn-outline" style="flex:1;" onclick="AccountId.copy()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:5px;"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.7"/></svg>
        Copier
      </button>
      <button class="btn btn-outline" style="flex:1;" onclick="AccountId.save()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:5px;"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Enregistrer
      </button>
    </div>
    <p style="font-size:12px;color:var(--text-soft);margin:0 0 26px;">En cas d'oubli, l'option « ID marchand oublié ? » sur l'écran de connexion vous permet de le récupérer via votre e-mail ou WhatsApp.</p>
    <div style="margin-top:auto;">
      <button class="btn btn-primary btn-block" onclick="AccountId.continueToApp()">Continuer vers mon tableau de bord</button>
    </div>
  </div>`;
};

/* ---------- Contrat d'utilisation SIAMS (affiché après la création du compte, avant validation finale) ----------
   NOTE PROTOTYPE : le contrat reprend le contenu officiel du fichier contrat-siams.html. Les
   informations complémentaires (référence, date, boutique, téléphone, e-mail) sont renseignées
   automatiquement à partir des données de l'utilisateur avant l'affichage. L'Utilisateur peut le
   télécharger (PDF) ou le lire à l'écran, puis doit valider avant de poursuivre. Un message
   obligatoire lui rappelle ensuite d'imprimer, signer et renvoyer le contrat par e-mail/WhatsApp. ---- */
function getContractArticles(){
  const allPlan = SUBSCRIPTION_PLANS.find(p=>p.key==='all') || {price:6000};
  const half = Math.round(allPlan.price/2);
  return [
    { num:1, title:'Définitions', blocks:[
      { type:'p', text:"Dans le présent contrat, les termes suivants ont la signification indiquée ci-après :" },
      { type:'ul', items:[
        "« Application » désigne la plateforme logicielle de gestion de boutique en ligne éditée et exploitée par SIAMS ;",
        "« Utilisateur » ou « Client » désigne toute personne physique ou morale ayant créé un compte sur l'Application pour y exploiter une boutique ;",
        "« Pass » désigne la formule d'abonnement payante donnant accès à l'ensemble ou à une partie des fonctionnalités de l'Application ;",
        "« Période d'essai » désigne la période de vingt (20) jours durant laquelle l'accès à l'Application est offert gratuitement à l'Utilisateur ;",
        "« Commission » désigne le pourcentage prélevé par SIAMS sur les ventes réalisées par l'Utilisateur via l'Application, dans les conditions fixées au présent contrat."
      ]}
    ]},
    { num:2, title:'Objet du contrat', blocks:[
      { type:'p', text:"Le présent contrat a pour objet de définir les conditions dans lesquelles SIAMS met à la disposition de l'Utilisateur l'Application, ainsi que les modalités d'essai, d'accompagnement, de commission et d'abonnement applicables à leur relation." }
    ]},
    { num:3, title:'Inscription et création de compte', blocks:[
      { type:'p', text:"L'accès à l'Application est subordonné à la création d'un compte par l'Utilisateur, lequel doit renseigner des informations exactes, complètes et à jour (identité, coordonnées, informations relatives à la boutique)." },
      { type:'p', text:"L'Utilisateur est seul responsable de la confidentialité de ses identifiants de connexion et de toute activité réalisée depuis son compte. Il s'engage à informer SIAMS sans délai en cas de suspicion d'utilisation non autorisée de son compte." }
    ]},
    { num:4, title:"Période d'essai gratuite de 20 jours", blocks:[
      { type:'p', text:"SIAMS offre à l'Utilisateur un accès complet et gratuit à l'Application pendant une période d'essai de vingt (20) jours calendaires à compter de la date de création du compte, incluant l'ensemble des fonctionnalités disponibles sur la plateforme." },
      { type:'p', text:"Durant cette période, l'Utilisateur gère librement sa boutique (produits, commandes, clients, promotions) et bénéficie de l'accompagnement et de l'assistance de l'équipe SIAMS pour la prise en main et le bon fonctionnement de son activité." },
      { type:'p', text:"SIAMS se réjouit de cette collaboration et s'engage à accompagner l'Utilisateur dans le développement de son activité tout au long de la relation contractuelle." }
    ]},
    { num:5, title:"Commission applicable durant la période d'essai", blocks:[
      { type:'p', text:"Pendant toute la durée de la période d'essai, SIAMS prélève une commission sur chaque commande vendue par l'Utilisateur, selon le barème suivant :" },
      { type:'ul', items:[
        "Taux de commission : 5% (cinq pour cent) du montant total de chaque commande, prélevés par SIAMS sur chaque transaction."
      ]},
      { type:'p', text:"Cette commission s'applique sans seuil minimum, sur toute commande livrée durant la période d'essai. Ce barème pourra être révisé par SIAMS dans les conditions prévues à l'Article 17, moyennant information préalable de l'Utilisateur." }
    ]},
    { num:6, title:"Délai de régularisation à l'expiration de la période d'essai", blocks:[
      { type:'p', text:"À l'expiration des 20 jours d'essai, l'Utilisateur dispose d'un délai supplémentaire de trois (3) jours maximum pour entamer le paiement de son abonnement (« Pass ») afin de conserver l'accès à l'Application." },
      { type:'p', text:"Passé ce délai de 3 jours sans début de paiement, SIAMS se réserve le droit de suspendre ou restreindre l'accès de l'Utilisateur à l'Application, sans préjudice des sommes déjà dues au titre des commissions perçues pendant la période d'essai." }
    ]},
    { num:7, title:"Conditions tarifaires à l'issue du délai", blocks:[
      { type:'p', text:`À l'issue de la période d'essai de 20 jours et du délai de régularisation de 3 jours, l'Utilisateur qui souhaite poursuivre l'utilisation de l'Application s'engage à régler la moitié (50%) du montant du Pass « Toute Boutique », dont le tarif plein est fixé à ${Utils.fmtFCFA(allPlan.price)}, soit un montant de ${Utils.fmtFCFA(half)}.` },
      { type:'p', text:"Pendant cette phase de paiement à moitié tarif, SIAMS prélève, en plus de ce montant, une commission de 10% (dix pour cent) du montant total de chaque commande vendue par l'Utilisateur via l'Application, en remplacement du taux de 5% applicable pendant la période d'essai (Article 5)." }
    ]},
    { num:8, title:"Absence de commission pendant l'abonnement (Pass payant)", blocks:[
      { type:'p', text:"À compter de l'activation d'un Pass payant (formule d'abonnement souscrite conformément à l'Article 7), SIAMS ne prélève plus aucune commission sur les commandes vendues par l'Utilisateur via l'Application. Seul le montant de l'abonnement reste dû." },
      { type:'p', text:"Cette absence de commission s'applique à compter de l'activation du Pass et pendant toute la durée de l'abonnement, en remplacement des taux applicables pendant la période d'essai (Article 5) et, le cas échéant, pendant la phase de régularisation à moitié tarif (Article 7)." }
    ]},
    { num:9, title:'Modalités de paiement', blocks:[
      { type:'p', text:"Le paiement du Pass et des commissions dues s'effectue selon les modalités communiquées par SIAMS (Wave, Orange Money, MTN Money ou virement bancaire). La preuve de paiement est transmise à SIAMS par e-mail ou WhatsApp, en vue de l'activation ou du renouvellement de l'accès." },
      { type:'p', text:"Toute somme non réglée à son échéance pourra entraîner la suspension temporaire de l'accès de l'Utilisateur à l'Application, après notification préalable." }
    ]},
    { num:10, title:"Obligations de l'Utilisateur", blocks:[
      { type:'ul', items:[
        "Fournir des informations exactes et à jour lors de son inscription et tout au long de la relation contractuelle ;",
        "Utiliser l'Application conformément à sa destination et à la réglementation en vigueur ;",
        "S'acquitter des commissions et montants dus dans les délais convenus ;",
        "Ne pas contourner le dispositif de commission en dissimulant ou en sous-évaluant le prix réel des articles vendus ;",
        "Informer SIAMS de toute difficulté rencontrée dans l'utilisation de la plateforme."
      ]}
    ]},
    { num:11, title:'Obligations de SIAMS', blocks:[
      { type:'ul', items:[
        "Assurer, dans la mesure du possible, la disponibilité et le bon fonctionnement de l'Application ;",
        "Accompagner l'Utilisateur durant la période d'essai et après son passage à l'abonnement ;",
        "Assurer un support raisonnable en cas de difficulté technique signalée par l'Utilisateur ;",
        "Informer l'Utilisateur de toute évolution des présentes conditions avant leur application, conformément à l'Article 17."
      ]}
    ]},
    { num:12, title:'Propriété intellectuelle', blocks:[
      { type:'p', text:"L'Application, son code source, ses interfaces, sa charte graphique, sa marque et l'ensemble des éléments qui la composent demeurent la propriété exclusive de SIAMS. Le présent contrat n'emporte aucune cession de droits de propriété intellectuelle au profit de l'Utilisateur." },
      { type:'p', text:"L'Utilisateur conserve l'entière propriété des contenus qu'il publie sur sa boutique (photos, descriptions, données de son catalogue), et garantit disposer des droits nécessaires à leur diffusion." }
    ]},
    { num:13, title:'Confidentialité et protection des données personnelles', blocks:[
      { type:'p', text:"Chaque Partie s'engage à préserver la confidentialité des informations non publiques dont elle aurait connaissance à l'occasion de l'exécution du présent contrat, et à ne les utiliser qu'aux fins de celui-ci." },
      { type:'p', text:"SIAMS s'engage à traiter les données personnelles de l'Utilisateur et de ses clients dans le respect de la réglementation applicable en Côte d'Ivoire, aux seules fins de fourniture et d'amélioration de l'Application." }
    ]},
    { num:14, title:'Responsabilité', blocks:[
      { type:'p', text:"SIAMS met en œuvre les moyens raisonnables pour assurer le bon fonctionnement de l'Application, sans garantir une disponibilité continue et sans faille. SIAMS ne saurait être tenue responsable des pertes indirectes (perte de chiffre d'affaires, de clientèle ou d'opportunité) subies par l'Utilisateur." },
      { type:'p', text:"L'Utilisateur demeure seul responsable des produits et services qu'il propose à la vente, de leur conformité et de leur livraison à ses propres clients." }
    ]},
    { num:15, title:'Force majeure', blocks:[
      { type:'p', text:"Aucune des Parties ne pourra être tenue responsable de l'inexécution de ses obligations si celle-ci résulte d'un cas de force majeure, tel que reconnu par la jurisprudence et la loi ivoiriennes (notamment coupures prolongées de réseau, catastrophes naturelles, décisions des pouvoirs publics)." }
    ]},
    { num:16, title:'Durée, suspension et résiliation', blocks:[
      { type:'p', text:"Le présent contrat prend effet à la date d'inscription de l'Utilisateur sur l'Application et se poursuit tant que l'Utilisateur maintient son abonnement actif." },
      { type:'p', text:"Chacune des Parties peut résilier le présent contrat à tout moment, sous réserve du règlement des sommes dues à la date de résiliation. SIAMS peut suspendre ou clôturer un compte en cas de manquement grave de l'Utilisateur à ses obligations, après mise en demeure restée sans effet, sauf urgence dûment justifiée." }
    ]},
    { num:17, title:'Modification du contrat', blocks:[
      { type:'p', text:"SIAMS se réserve le droit de faire évoluer les présentes conditions, notamment les tarifs et taux de commission, sous réserve d'en informer l'Utilisateur au moins sept (7) jours avant leur entrée en vigueur. La poursuite de l'utilisation de l'Application après ce délai vaut acceptation des nouvelles conditions." }
    ]},
    { num:18, title:'Cession', blocks:[
      { type:'p', text:"L'Utilisateur ne peut céder ou transférer à un tiers les droits et obligations résultant du présent contrat sans l'accord écrit préalable de SIAMS." }
    ]},
    { num:19, title:'Divisibilité des clauses', blocks:[
      { type:'p', text:"Si l'une des clauses du présent contrat venait à être déclarée nulle ou inapplicable, les autres clauses demeureraient pleinement en vigueur, les Parties s'efforçant de remplacer la clause concernée par une disposition d'effet équivalent." }
    ]},
    { num:20, title:'Notifications', blocks:[
      { type:'p', text:"Toute notification entre les Parties au titre du présent contrat est valablement effectuée par e-mail ou WhatsApp aux coordonnées renseignées lors de l'inscription, ou à celles de SIAMS mentionnées en en-tête du présent contrat." }
    ]},
    { num:21, title:'Règlement des litiges et droit applicable', blocks:[
      { type:'p', text:"Le présent contrat est régi par le droit ivoirien. En cas de litige relatif à son interprétation ou à son exécution, les Parties s'efforceront de trouver une solution amiable avant tout recours contentieux. À défaut d'accord amiable, le litige sera porté devant les juridictions compétentes de Côte d'Ivoire." }
    ]}
  ];
}

/* ---------- Aperçu des commissions (onglet Plus) ----------
   NOTE PROTOTYPE : le contrat signé n'étant pas consultable dans l'App, cet écran
   reprend uniquement les articles du contrat qui portent sur les commissions
   (les plus importants à connaître au quotidien), pour que le marchand puisse s'y
   référer rapidement sans télécharger le PDF complet. ---- */
function getCommissionApercuItems(){
  const allPlan = SUBSCRIPTION_PLANS.find(p=>p.key==='all') || {price:6000};
  const half = Math.round(allPlan.price/2);
  return [
    { badge:'Très important', title:"Pendant l'essai gratuit de 20 jours", rate:'5%',
      text:"SIAMS prélève une commission de 5% (cinq pour cent) sur le montant total de chaque commande vendue via l'Application, sans seuil minimum, pendant toute la période d'essai de 20 jours (Article 5 du contrat)." },
    { badge:'Très important', title:'Après activation de votre Pass (abonnement)', rate:'0%',
      text:"À compter de l'activation d'un Pass payant, SIAMS ne prélève plus aucune commission sur vos ventes. Seul le montant de l'abonnement reste dû (Article 8 du contrat)." },
    { badge:'Très important', title:`Si vous choisissez de régler la moitié du Pass « Toute Boutique »`, rate:'10%',
      text:`Si, à l'issue du délai de régularisation, vous réglez la moitié (50%) du montant du Pass « Toute Boutique » (soit ${Utils.fmtFCFA(half)} sur un tarif plein de ${Utils.fmtFCFA(allPlan.price)}), SIAMS prélève alors une commission de 10% (dix pour cent) sur chaque commande, en remplacement du taux de 5% de la période d'essai (Article 7 du contrat).` }
  ];
}
Views['commissions-apercu'] = function(){
  const items = getCommissionApercuItems();
  return `${TopBar('Aperçu de mon contrat','Commissions applicables — les points importants')}
  <div style="padding:16px 20px 28px;">
    <div class="stats-card" style="margin-bottom:14px;background:var(--indigo-tint);border:1px solid var(--indigo);">
      <div style="font-size:12.5px;color:var(--text-mid);line-height:1.55;">Ceci est un aperçu des principales clauses de commission de votre contrat SIAMS, pour vous permettre de vous y référer rapidement. Il ne remplace pas le contrat complet, que vous pouvez télécharger en PDF ci-dessous.</div>
    </div>
    ${items.map(it=>`
      <div class="stats-card" style="margin-bottom:14px;border-left:4px solid var(--mango);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
          <span style="background:var(--mango);color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.02em;padding:3px 9px;border-radius:999px;text-transform:uppercase;">${it.badge}</span>
          <span class="mono" style="font-size:20px;font-weight:800;color:var(--indigo);">${it.rate}</span>
        </div>
        <h4 style="margin:0 0 6px;font-size:14.5px;">${Utils.escapeHtml(it.title)}</h4>
        <p style="margin:0;font-size:12.5px;color:var(--text-mid);line-height:1.6;">${Utils.escapeHtml(it.text)}</p>
      </div>`).join('')}
    <button class="btn btn-outline btn-block" style="margin-top:6px;" onclick="ContractGate.download()">📄 Télécharger le contrat complet (PDF)</button>
  </div>`;
};

const ContractGate = {
  ref:'',
  createdAt:0,
  show(){
    if(!this.ref){ this.ref = Utils.genAccountContractRef(); this.createdAt = Date.now(); }
    Router.go('account-contract');
  },
  openRead(){ Router.go('account-contract-read'); },
  backToSummary(){ Router.go('account-contract'); },
  async download(){ await downloadAccountContractPDF(); },
  goToNotice(){ Router.go('account-contract-notice'); },
  acknowledge(){ AccountId.showAfterRegister(); },
  contactSupportWhatsapp(){
    const msg = `Bonjour, je viens de créer ma boutique sur SIAMS. Voici la capture de mon contrat signé (réf. ${this.ref}).`;
    window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent(msg), '_blank');
  },
  contactSupportEmail(){
    window.location.href = `mailto:serviceclientsiams.ci@gmail.com?subject=${encodeURIComponent('Contrat signé — Réf. '+this.ref)}`;
  }
};

function contractSummaryRows(){
  const store = Store.store;
  const dateStr = new Date(ContractGate.createdAt || Date.now()).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
  return [
    ['Référence du contrat', ContractGate.ref],
    ['Date', dateStr],
    ['Boutique / Utilisateur', store.name || 'Ma boutique'],
    ['Téléphone', store.phone || '—'],
    ['E-mail', store.email || '—']
  ];
}

Views['account-contract'] = function(){
  const rows = contractSummaryRows();
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;padding:32px 26px;">
    <div class="store-logo" style="width:56px;height:56px;border-radius:16px;margin-bottom:22px;overflow:hidden;">
      <img src="${LOGO_DATA_URI}" alt="SIAMS" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <h1 style="font-size:23px;margin:0 0 8px;">Votre contrat SIAMS</h1>
    <p style="color:var(--text-mid);font-size:14.5px;line-height:1.6;margin:0 0 20px;">Avant de continuer, prenez connaissance du contrat d'utilisation et d'abonnement qui vous lie désormais à SIAMS. Il porte les références ci-dessous, propres à votre compte.</p>
    <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:16px 16px 6px;background:var(--panel);margin-bottom:18px;">
      ${rows.map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;padding-bottom:10px;"><span style="color:var(--text-soft);">${Utils.escapeHtml(k)}</span><span style="font-weight:700;text-align:right;" class="${k.startsWith('Référence')?'mono':''}">${Utils.escapeHtml(String(v))}</span></div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <button class="btn btn-outline" style="flex:1;" onclick="ContractGate.download()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:5px;"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Télécharger (PDF)
      </button>
      <button class="btn btn-outline" style="flex:1;" onclick="ContractGate.openRead()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:5px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        Lire
      </button>
    </div>
    <p style="font-size:12px;color:var(--text-soft);margin:0 0 26px;">Le contrat officiel complet reste disponible à tout moment en PDF. La suite de l'inscription requiert que vous ayez consulté ce document.</p>
    <div style="margin-top:auto;">
      <button class="btn btn-primary btn-block" onclick="ContractGate.goToNotice()">Continuer</button>
    </div>
  </div>`;
};

Views['account-contract-read'] = function(){
  const rows = contractSummaryRows();
  const articles = getContractArticles();
  const articlesHtml = articles.map(a=>{
    const blocksHtml = a.blocks.map(b=>{
      if(b.type==='ul'){
        return `<ul style="margin:0 0 10px;padding-left:20px;">${b.items.map(it=>`<li style="font-size:13px;color:var(--text-mid);line-height:1.7;margin-bottom:5px;">${Utils.escapeHtml(it)}</li>`).join('')}</ul>`;
      }
      return `<p style="font-size:13px;color:var(--text-mid);line-height:1.7;margin:0 0 10px;text-align:justify;">${Utils.escapeHtml(b.text)}</p>`;
    }).join('');
    return `
    <div style="margin-bottom:18px;">
      <h3 style="font-size:14px;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid var(--indigo-tint);color:var(--text);">Article ${a.num} — ${Utils.escapeHtml(a.title)}</h3>
      ${blocksHtml}
    </div>`;
  }).join('');
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;">
    <div style="padding:18px 20px 12px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;position:sticky;top:0;background:var(--bg);z-index:2;">
      <button onclick="ContractGate.backToSummary()" style="background:none;border:none;cursor:pointer;padding:4px;display:flex;color:var(--text);" aria-label="Retour">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div style="font-weight:800;font-size:15px;">Contrat d'utilisation SIAMS</div>
    </div>
    <div style="padding:20px 22px 100px;">
      <p style="font-size:12.5px;color:var(--text-soft);margin:0 0 16px;">Entre SIAMS — Société Informatique Agréée Multi-Services, Yopougon, Abidjan, Côte d'Ivoire (0748964690 — serviceclientsiams.ci@gmail.com), ci-après « SIAMS », et l'utilisateur inscrit sur la plateforme, désigné ci-après par ses références :</p>
      <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 14px 4px;background:var(--panel);margin-bottom:20px;">
        ${rows.map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding-bottom:9px;"><span style="color:var(--text-soft);">${Utils.escapeHtml(k)}</span><span style="font-weight:700;text-align:right;" class="${k.startsWith('Référence')?'mono':''}">${Utils.escapeHtml(String(v))}</span></div>`).join('')}
      </div>
      ${articlesHtml}
      <div style="background:var(--indigo-tint);border-radius:var(--radius-md);padding:14px 16px;font-size:11.5px;color:var(--text-mid);line-height:1.6;font-style:italic;margin-bottom:24px;">
        Le présent contrat constitue un engagement officiel entre SIAMS et l'Utilisateur. Il fait foi entre les parties et peut être produit à toute fin utile, notamment auprès des autorités compétentes, conformément à la réglementation en vigueur en République de Côte d'Ivoire.
      </div>
    </div>
    <div style="position:fixed;left:0;right:0;bottom:0;padding:14px 20px calc(14px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--line);display:flex;gap:10px;">
      <button class="btn btn-outline" style="flex:1;" onclick="ContractGate.download()">Télécharger (PDF)</button>
      <button class="btn btn-primary" style="flex:1;" onclick="ContractGate.backToSummary()">J'ai terminé la lecture</button>
    </div>
  </div>`;
};

Views['account-contract-notice'] = function(){
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;padding:32px 26px;">
    <div style="width:56px;height:56px;border-radius:16px;margin-bottom:22px;background:var(--indigo-tint);display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" stroke="var(--indigo)" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </div>
    <h1 style="font-size:22px;margin:0 0 10px;">Étape importante avant de continuer</h1>
    <p style="color:var(--text);font-size:15px;line-height:1.65;margin:0 0 18px;font-weight:600;">Vous devez imprimer le contrat et le signer, puis envoyer la capture par e-mail ou WhatsApp au support client.</p>
    <p style="color:var(--text-mid);font-size:13.5px;line-height:1.6;margin:0 0 22px;">Réf. contrat : <span class="mono" style="font-weight:700;color:var(--text);">${Utils.escapeHtml(ContractGate.ref)}</span>. Vous pouvez retélécharger le PDF à tout moment depuis votre tableau de bord.</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:26px;">
      <button class="btn btn-soft-green btn-block" onclick="ContractGate.contactSupportWhatsapp()">
        <svg width="16" height="16" viewBox="0 0 448 512" fill="var(--green)" style="vertical-align:-3px;margin-right:6px;"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>
        Envoyer via WhatsApp
      </button>
      <button class="btn btn-outline btn-block" onclick="ContractGate.contactSupportEmail()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align:-3px;margin-right:6px;"><path d="M4 6h16v12H4V6Zm0 0 8 7 8-7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        Envoyer par e-mail
      </button>
    </div>
    <div style="margin-top:auto;">
      <button class="btn btn-primary btn-block" onclick="ContractGate.acknowledge()">J'ai compris, continuer</button>
    </div>
  </div>`;
};

/* ---------- Génération du PDF officiel du contrat d'utilisation SIAMS ---------- */
async function downloadAccountContractPDF(){
  const logoPdf = await loadImageAsDataURL(LOGO_DATA_URI);

  if(!await ensureJsPDF()){ Toast.show('Génération PDF indisponible, réessayez'); return; }
  if(!ContractGate.ref){ ContractGate.ref = Utils.genAccountContractRef(); ContractGate.createdAt = Date.now(); }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 46;
  const contentW = W - margin*2;
  const navy = [5,42,77], blueDeep = [0,96,217], cyan = [0,214,238], ink = [22,35,47], mid = [92,107,122], line = [220,228,236];
  let y = 0, pageNum = 1;

  function addHeader(first){
    if(first){
      try{ doc.addImage(logoPdf, 'PNG', W-margin-40, 34, 40, 40); }catch(e){}
      doc.setTextColor(blueDeep[0],blueDeep[1],blueDeep[2]);
      doc.setFont('helvetica','bold'); doc.setFontSize(19);
      doc.text("Contrat d'utilisation et d'abonnement", margin, 56);
      doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
      doc.setTextColor(mid[0],mid[1],mid[2]);
      doc.text('Plateforme de boutique en ligne SIAMS', margin, 72);
      doc.setDrawColor(cyan[0],cyan[1],cyan[2]); doc.setLineWidth(2);
      doc.line(margin, 88, W-margin, 88);
      doc.setLineWidth(1);
      y = 108;
    } else {
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.setTextColor(mid[0],mid[1],mid[2]);
      doc.text('Contrat SIAMS — Réf. '+ContractGate.ref, margin, 30);
      doc.setDrawColor(line[0],line[1],line[2]);
      doc.line(margin, 38, W-margin, 38);
      y = 56;
    }
  }
  function addFooter(){
    doc.setDrawColor(line[0],line[1],line[2]);
    doc.line(margin, pageH-38, W-margin, pageH-38);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.setTextColor(mid[0],mid[1],mid[2]);
    doc.text("SIAMS — Yopougon, Abidjan, Côte d'Ivoire  •  0748964690  •  serviceclientsiams.ci@gmail.com", margin, pageH-24);
    doc.text(`Page ${pageNum}`, W-margin, pageH-24, {align:'right'});
  }
  function ensureSpace(needed){
    if(y + needed > pageH - 50){
      addFooter();
      doc.addPage();
      pageNum++;
      addHeader(false);
    }
  }
  function h2(text){
    ensureSpace(26);
    doc.setFont('helvetica','bold'); doc.setFontSize(11.5);
    doc.setTextColor(navy[0],navy[1],navy[2]);
    doc.text(text, margin, y);
    doc.setDrawColor(cyan[0],cyan[1],cyan[2]);
    doc.line(margin, y+4, W-margin, y+4);
    y += 20;
  }
  function p(text){
    doc.setFont('helvetica','normal'); doc.setFontSize(9.6);
    doc.setTextColor(ink[0],ink[1],ink[2]);
    const lines = doc.splitTextToSize(text, contentW);
    lines.forEach(ln=>{ ensureSpace(13.5); doc.text(ln, margin, y); y += 13; });
    y += 6;
  }
  function ul(items){
    doc.setFont('helvetica','normal'); doc.setFontSize(9.6);
    doc.setTextColor(ink[0],ink[1],ink[2]);
    items.forEach(it=>{
      const lines = doc.splitTextToSize(it, contentW-16);
      lines.forEach((ln,i)=>{
        ensureSpace(13.5);
        doc.text((i===0?'•  ':'   ')+ln, margin, y);
        y += 13;
      });
    });
    y += 6;
  }
  function kvRow(k, v){
    ensureSpace(15);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.6);
    doc.setTextColor(mid[0],mid[1],mid[2]);
    doc.text(k, margin, y);
    doc.setFont('helvetica','bold'); doc.setTextColor(ink[0],ink[1],ink[2]);
    doc.text(String(v), W-margin, y, {align:'right'});
    y += 15;
  }

  addHeader(true);
  p("Entre les soussignés :");
  ul([
    "SIAMS — Société Informatique Agréée Multi-Services, dont le siège est situé à Yopougon, Abidjan, Côte d'Ivoire, joignable au 0748964690 et à l'adresse serviceclientsiams.ci@gmail.com, ci-après désignée « SIAMS » ou « l'Entreprise »,",
    "Et l'utilisateur inscrit sur la plateforme, identifié par les références ci-dessous, ci-après désigné « l'Utilisateur » ou « le Client »,"
  ]);
  p("ci-après désignées ensemble « les Parties », il a été convenu ce qui suit :");

  ensureSpace(20);
  doc.setDrawColor(line[0],line[1],line[2]); doc.setFillColor(247,249,252);
  const boxH = 5*15 + 14;
  ensureSpace(boxH+10);
  doc.roundedRect(margin, y, contentW, boxH, 6, 6, 'FD');
  y += 12;
  contractSummaryRows().forEach(([k,v])=> kvRow(k, v));
  y += 14;

  getContractArticles().forEach(a=>{
    h2(`Article ${a.num} — ${a.title}`);
    a.blocks.forEach(b=>{ if(b.type==='ul') ul(b.items); else p(b.text); });
  });

  ensureSpace(50);
  doc.setDrawColor(cyan[0],cyan[1],cyan[2]); doc.setFillColor(247,249,252);
  doc.roundedRect(margin, y, contentW, 42, 6, 6, 'FD');
  doc.setFont('helvetica','italic'); doc.setFontSize(8.5); doc.setTextColor(mid[0],mid[1],mid[2]);
  const legal = "Le présent contrat constitue un engagement officiel entre SIAMS et l'Utilisateur. Il fait foi entre les parties et peut être produit à toute fin utile, notamment auprès des autorités compétentes, conformément à la réglementation en vigueur en République de Côte d'Ivoire.";
  doc.text(doc.splitTextToSize(legal, contentW-16), margin+8, y+14);
  y += 58;

  ensureSpace(90);
  const colW = (contentW-24)/2;
  doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(blueDeep[0],blueDeep[1],blueDeep[2]);
  doc.text('POUR SIAMS', margin, y);
  doc.text("POUR L'UTILISATEUR", margin+colW+24, y);
  y += 22;
  doc.setFont('helvetica','normal'); doc.setFontSize(9.3); doc.setTextColor(mid[0],mid[1],mid[2]);
  ['Nom : ', 'Date : ', 'Signature : '].forEach((lbl)=>{
    doc.text(lbl, margin, y);
    doc.setDrawColor(line[0],line[1],line[2]); doc.line(margin+42, y+2, margin+colW, y+2);
    doc.text(lbl, margin+colW+24, y);
    doc.line(margin+colW+24+42, y+2, margin+colW+24+colW, y+2);
    y += 26;
  });

  addFooter();
  doc.save(`contrat-siams-${ContractGate.ref}.pdf`);
  Toast.show('Contrat PDF téléchargé ✓');
}

/* ---------- ID marchand oublié ---------- */
const RecoverId = {
  method:'email',
  setMethod(m){
    this.method = m;
    document.querySelectorAll('.recover-method').forEach(el=>{
      const on = el.dataset.rm===m;
      el.style.borderColor = on ? 'var(--indigo)' : 'var(--line)';
      el.style.background = on ? 'var(--indigo-tint)' : 'var(--panel)';
      el.style.color = on ? 'var(--indigo)' : 'var(--text)';
    });
    const panel = document.getElementById('recover-panel');
    if(panel) panel.innerHTML = this.panelHtml();
  },
  panelHtml(){
    return `
      <div class="field"><label>Adresse e-mail du compte marchand</label><input id="recover-value" type="email" placeholder="vous@exemple.com" autocomplete="email"></div>
      <div style="font-size:12.5px;color:var(--text-mid);line-height:1.5;margin:-4px 0 12px;">Nous allons retrouver votre ID marchand et vous l'envoyer automatiquement par e-mail depuis SIAMS.</div>
      <div id="recover-error" style="font-size:13px;color:var(--red);margin-bottom:10px;"></div>
      <button class="btn btn-primary btn-block" id="recover-submit-btn" onclick="RecoverId.submitEmail()">Recevoir mon ID par e-mail</button>`;
  },
  async submitEmail(){
    const email = document.getElementById('recover-value').value.trim();
    const err = document.getElementById('recover-error');
    const btn = document.getElementById('recover-submit-btn');
    if(!email){ err.textContent = 'Merci de renseigner votre e-mail'; return; }
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Préparation...';
    try{
      const { data, error } = await sb.rpc('find_login_id_by_email', { p_email: email });
      if(error || !data){
        btn.disabled = false; btn.textContent = 'Préparer ma demande par e-mail';
        err.textContent = 'Aucun compte trouvé pour cet e-mail';
        return;
      }
      const merchantId = typeof data === 'string' ? data : (data.login_id || data.id || data.loginId || 'À confirmer par SIAMS');
      const subject = 'Demande de récupération de mon ID marchand SIAMS';
      const body = `Bonjour Service Client SIAMS,\n\nJe suis un marchand SIAMS et je souhaite récupérer mon ID marchand SIAMS.\n\nID marchand SIAMS : ${merchantId}\nE-mail du compte : ${email}\nTéléphone marchand : À confirmer par SIAMS\nBoutique : À confirmer par SIAMS\n\nMerci de vérifier mon compte et de m’indiquer mon ID marchand SIAMS.\n\nCordialement.`;
      const mailTo = PAYMENT_INFO.supportClientEmail ? `mailto:${PAYMENT_INFO.supportClientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : '';
      if(mailTo) window.location.href = mailTo;
      else Toast.show('Votre demande est prête. Contactez le service client SIAMS.');
      btn.disabled = false; btn.textContent = 'Préparer ma demande par e-mail';
    }catch(e){
      console.error(e);
      btn.disabled = false; btn.textContent = 'Préparer ma demande par e-mail';
      err.textContent = 'Erreur, merci de réessayer';
    }
  },
  submitWhatsapp(){
    const phone = document.getElementById('recover-value').value.trim();
    const err = document.getElementById('recover-error');
    if(!phone){ err.textContent = 'Merci de renseigner votre numéro WhatsApp'; return; }
    err.textContent = '';
    const msg = `Bonjour Service Client SIAMS,\n\nJe suis un marchand SIAMS et je souhaite récupérer mon ID marchand SIAMS.\n\nNuméro WhatsApp marchand : ${phone}\nID marchand SIAMS : À retrouver par SIAMS\nE-mail du compte : À confirmer par SIAMS\nBoutique : À confirmer par SIAMS\n\nMerci de vérifier mon compte à partir de ces informations et de me communiquer mon ID marchand SIAMS.\n\nCordialement.`;
    window.open(PAYMENT_INFO.supportClientWaLink+'?text='+encodeURIComponent(msg), '_blank');
  }
};
Views['recover-id'] = function(){
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;padding:32px 26px;">
    <button onclick="Router.go('login')" style="border:none;background:var(--panel);color:var(--text);width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:18px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <h1 style="font-size:22px;margin:0 0 6px;">ID marchand oublié</h1>
    <p style="color:var(--text-mid);font-size:14px;line-height:1.5;margin:0 0 20px;">Renseignez l’e-mail associé à votre compte. SIAMS vous enverra automatiquement votre ID marchand par e-mail.</p>
    <div style="display:flex;align-items:center;gap:10px;padding:13px 14px;border:1px solid var(--line);border-radius:14px;background:var(--indigo-tint);margin-bottom:18px;">
      <div style="width:34px;height:34px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;color:var(--indigo);font-weight:800;">✉</div>
      <div style="font-size:12.5px;color:var(--text);line-height:1.4;"><b>Récupération automatique</b><br>Votre ID est envoyé directement à l’adresse du compte.</div>
    </div>
    <div id="recover-panel">${RecoverId.panelHtml()}</div>
  </div>`;
};

Views['confirm-email'] = function(){
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:32px 26px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:50%;background:var(--indigo-tint);color:var(--indigo);display:flex;align-items:center;justify-content:center;margin:0 auto 22px;">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>
    </div>
    <h1 style="font-size:22px;margin:0 0 10px;">Confirmez votre e-mail</h1>
    <p style="color:var(--text-mid);font-size:14px;line-height:1.6;margin:0 0 4px;">Nous avons envoyé un lien de confirmation à</p>
    <p style="font-weight:800;font-size:15px;margin:0 0 22px;">${Utils.escapeHtml(ConfirmEmail.email)}</p>
    <p style="color:var(--text-mid);font-size:13px;line-height:1.6;margin:0 0 28px;">Ouvrez cet e-mail depuis votre messagerie et cliquez sur le lien de vérification Supabase pour activer votre compte, puis revenez vous connecter ici.</p>
    <button class="btn btn-primary btn-block" onclick="ConfirmEmail.openMail()">Ouvrir ma boîte mail</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="ConfirmEmail.resend()">Renvoyer l'e-mail de confirmation</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="ConfirmEmail.goLogin()">J'ai confirmé mon e-mail, me connecter</button>
  </div>`;
};

/* ---------- Centre financier : configuration ---------- */
/* Commission SIAMS pendant les 20 premiers jours (période d'essai) : 5% sur le
   montant total de chaque commande livrée (voir Article 5 du contrat). */
const TRIAL_DAYS = 20;
const COMMISSION_RATE = 0.05; // 5%
/* ---- Commission SIAMS pendant l'abonnement (Pass payant) : retirée (Article 8) —
   depuis l'activation d'un Pass payant, seul le montant de l'abonnement est dû,
   sans commission additionnelle. Le taux est conservé à 0 (plutôt que de retirer
   toute l'infrastructure) pour que subCommissionDue() reste sûr si des soldes
   historiques existent déjà côté serveur. ---- */
const SUBSCRIPTION_COMMISSION_RATE = 0; // commission d'abonnement retirée
const PAYMENT_CONFIRM_DELAY_MS = 5*60*1000; // délai de vérification manuelle du paiement : 5 minutes
/* ---- Identité SIAMS pour tout reçu officiel émis par l'application (voir renderSIAMSReceiptPDF) ---- */
const SIAMS_WATERMARK_DATA_URI = "images/watermark.webp";
const SIAMS_RECEIPT_IDENTITY = {
  name: 'SIAMS',
  fullName: 'Société Informatique Agréée Multi-Services',
  address: "Yopougon, Abidjan — Côte d'Ivoire",
  phone: '0748964690',
  email: 'serviceclientsiams.ci@gmail.com'
};
const PAYMENT_INFO = {
  djamoNumber: '0748964690',
  waveNumber: '0748964690',
  waveUrl: 'https://pay.wave.com/m/REMPLACER_PAR_VOTRE_LIEN/c/ci/',
  bankName: 'SIAMS BANQUE',
  cardNumber: '5273 7568 7418 6188',
  /* ---- Lien WhatsApp « contact client » SIAMS : c'est ici que le vendeur envoie
     la capture d'écran de chaque paiement (mensuel ou journalier) pour validation. ---- */
  contactClientWaLink: 'https://wa.me/qr/CP2FDOBXXD74G1',
  /* ---- Lien WhatsApp « support client » SIAMS : partenariat, contrat, identifiant oublié, etc. ---- */
  supportClientWaLink: 'https://wa.me/message/G7UPF2ZGMLPLG1'
};
/* ---- GOLDEN : formule exclusive, réservée à la boutique officielle SIAMS. ---- */
const SIAMS_GOLDEN_STORE_NAME = 'SIAMS STORE OFFICIEL';
function isSiamsGoldenStore(){
  return ((Store.store && Store.store.name) || '').trim().toUpperCase() === SIAMS_GOLDEN_STORE_NAME;
}
const LOCKED_FEATURES = { maxProducts:0, stats:false, promos:false, reviews:false, customers:false, team:false, delivery:false, banner:false, badgeVisibility:false, prioritySupport:false, featuredBoost:false, goldenBadge:false, vipSupport:false, homepageSpotlight:false, customStorefront:false };
const TRIAL_FEATURES = { maxProducts:Infinity, stats:true, promos:true, reviews:true, customers:true, team:true, delivery:true, banner:true, badgeVisibility:true, prioritySupport:false, featuredBoost:false, goldenBadge:false, vipSupport:false, homepageSpotlight:false, customStorefront:false };
const SUBSCRIPTION_PLANS = [
  { key:'free', label:'BON MOOD', price:1000, dailyRate:34, tagline:"Boutique en ligne, commandes illimitées, jusqu'à 10 produits, livraison & suivi clients inclus", badge:null,
    features:{ maxProducts:10, stats:false, promos:false, reviews:false, customers:true, team:false, delivery:true, banner:false, badgeVisibility:false, prioritySupport:false, featuredBoost:false, goldenBadge:false, vipSupport:false, homepageSpotlight:false, customStorefront:false } },
  { key:'doyen', label:'DOYEN', price:2000, dailyRate:67, tagline:"Jusqu'à 20 produits + statistiques, promotions et avis clients", badge:'DOYEN',
    features:{ maxProducts:20, stats:true, promos:true, reviews:true, customers:true, team:false, delivery:true, banner:true, badgeVisibility:true, prioritySupport:false, featuredBoost:false, goldenBadge:false, vipSupport:false, homepageSpotlight:false, customStorefront:false } },
  { key:'doya', label:'DOYA', price:3500, dailyRate:117, tagline:'Jusqu\u2019à 35 produits + équipe, zones de livraison & badge visibilité', badge:'DOYA',
    features:{ maxProducts:35, stats:true, promos:true, reviews:true, customers:true, team:true, delivery:true, banner:true, badgeVisibility:true, prioritySupport:false, featuredBoost:false, goldenBadge:false, vipSupport:false, homepageSpotlight:false, customStorefront:false } },
  { key:'all', label:'TOUTE BOUTIQUE', price:5000, dailyRate:167, tagline:'Catalogue illimité, tout DOYA + support prioritaire dédié & mise en avant renforcée', badge:'TOUTE BOUTIQUE',
    features:{ maxProducts:Infinity, stats:true, promos:true, reviews:true, customers:true, team:true, delivery:true, banner:true, badgeVisibility:true, prioritySupport:true, featuredBoost:true, goldenBadge:false, vipSupport:false, homepageSpotlight:false, customStorefront:false } },
  { key:'platinum', label:'PLATINE', price:15000, dailyRate:500, tagline:'Le tout premium, ouvert à toutes les boutiques : support VIP 24/7, mise en avant permanente à l’accueil, vitrine entièrement personnalisable et badge Platine rouge', badge:'PLATINE',
    features:{ maxProducts:Infinity, stats:true, promos:true, reviews:true, customers:true, team:true, delivery:true, banner:true, badgeVisibility:true, prioritySupport:true, featuredBoost:true, goldenBadge:false, vipSupport:true, homepageSpotlight:true, customStorefront:true } },
  { key:'golden', label:'GOLDEN', price:15000, dailyRate:500, tagline:'Formule exclusive réservée à SIAMS STORE OFFICIEL : badge Doré, vitrine personnalisée, mise en avant permanente & support VIP 24/7', badge:'GOLDEN', exclusive:true,
    features:{ maxProducts:Infinity, stats:true, promos:true, reviews:true, customers:true, team:true, delivery:true, banner:true, badgeVisibility:true, prioritySupport:true, featuredBoost:true, goldenBadge:true, vipSupport:true, homepageSpotlight:true, customStorefront:true } }
];
function getPeriodStarts(){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dow = (now.getDay()+6)%7; // semaine démarre le lundi
  const week = today - dow*86400000;
  const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const year = new Date(now.getFullYear(), 0, 1).getTime();
  return { today, week, month, year };
}

/* ---------- Paiement échelonné journalier ----------
   Le vendeur choisit de payer sa formule en un seul versement (mensuel) ou en
   plusieurs petits versements journaliers avant l'échéance. Après chaque versement,
   il envoie sa capture de paiement via WhatsApp au service client SIAMS, qui
   valide manuellement dans Supabase. Une fois le total confirmé atteint le prix
   de la formule (le « socle »), l'abonnement s'active automatiquement. */
const Installments = {
  start(planKey, mode){
    const plan = SUBSCRIPTION_PLANS.find(p=>p.key===planKey);
    if(!plan) return;
    Store.subscription = { plan:planKey, status:'building', mode, paidAmount:0, pendingAmount:0, pendingConfirmAt:0, renewsAt:0, pendingSince:0, pendingMethod:'', contractRef:'', amount:plan.price, paymentMethod:'djamo' };
  },
  declare(amount){
    const sub = Store.subscription;
    if(sub.status!=='building' || !amount || amount<=0) return;
    const updated = { ...sub, pendingAmount:(sub.pendingAmount||0)+amount, pendingConfirmAt: Date.now()+PAYMENT_CONFIRM_DELAY_MS };
    Store.subscription = updated;
    /* Trace du versement côté Supabase, pour la validation manuelle SIAMS. */
    if(Cloud.storeId){
      sb.from('subscription_payments').insert({ store_id:Cloud.storeId, plan:sub.plan, amount, status:'pending' }).catch(e=>console.error('Sync error [installment]', e));
    }
  },
  waLink(plan, amount, mode){
    const store = Store.store;
    const due = Store.commissionDue();
    const commissionNote = (due>0 && !Store.commissionSettled) ? ` + commission période d'essai de ${Utils.fmtFCFA(due)}` : '';
    const msg = `Bonjour SIAMS, voici ma preuve de paiement pour l'abonnement ${plan.label} (${mode==='daily'?'versement journalier':'paiement mensuel'} de ${Utils.fmtFCFA(amount)}${commissionNote}). Boutique : ${store.name}${store.loginId?' — '+store.loginId:''}.`;
    return PAYMENT_INFO.contactClientWaLink+'?text='+encodeURIComponent(msg);
  }
};
/* ---------- Dashboard ---------- */
const DASHBOARD_SERVICES = [
  { route:'boutique', label:'Boutique', tint:'var(--indigo-tint)', color:'var(--indigo)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 9h16M4 9l1.4-4h13.2L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 13a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
  { route:'stats', label:'Statistiques', tint:'var(--green-tint)', color:'var(--green)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { route:'team', label:'Équipe', tint:'var(--blue-tint)', color:'var(--blue)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5M16 9.5c1.6.2 2.8 1.6 2.8 3.2M16 5.3a3 3 0 0 1 0 5.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
  { route:'payment', label:'Paiement', tint:'var(--mango-tint)', color:'var(--mango-dark)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/></svg>' },
  { route:'categories', label:'Catégories', tint:'var(--indigo-tint)', color:'var(--indigo)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>' },
  { route:'promos', label:'Codes promo', tint:'var(--green-tint)', color:'var(--green)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 12 12 20l-8-8V5a1 1 0 0 1 1-1h7l8 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/></svg>' },
  { route:'reviews', label:'Avis clients', tint:'var(--mango-tint)', color:'var(--mango-dark)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
  { route:'customers', label:'Clients', tint:'var(--blue-tint)', color:'var(--blue)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20c.8-4 3.6-6.2 7.5-6.2s6.7 2.2 7.5 6.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' },
  { route:'delivery', label:'Livraison', tint:'var(--indigo-tint)', color:'var(--indigo)', icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 16V6a1 1 0 0 1 1-1h9v11M3 16h11m0 0h3.5a1.5 1.5 0 0 0 1.5-1.5V11h-5m0-6h2l3 4v3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="1.8" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="17.5" r="1.8" stroke="currentColor" stroke-width="1.6"/></svg>' }
];
Views.dashboard = function(){
  const orders = Store.orders;
  const pending = Store.pendingRevenue();
  const totalSales = Store.totalSales();
  const store = Store.store;
  const periods = getPeriodStarts();
  const revToday = Store.revenueSince(periods.today);
  const revWeek = Store.revenueSince(periods.week);
  const counts = Store.orderStatusCounts();
  const deliveredRevenue = Store.revenueDelivered();
  const access = Store.access();
  const avgBasket = orders.length ? Math.round(orders.reduce((s,o)=>s+o.amount,0)/orders.length) : 0;
  const clientsCount = Store.customers().length;
  const lowStockProducts = (Store.products||[]).filter(p=>p.stockLimited && Number(p.stockQty||0)<=3);
  const cmdRow = (label,count,color,sub)=>`
    <div class="dashboard-v2-command-row" onclick="Router.go('orders')">
      <span class="dashboard-v2-command-dot" style="background:${color};"></span>
      <div class="dashboard-v2-command-main">${label}<small>${sub}</small></div>
      <span class="dashboard-v2-command-count">${count}</span>
      <span style="color:var(--text-soft);font-size:16px;">›</span>
    </div>`;
  const quick=[
    {route:'product-add',label:'Produit',tint:'rgba(92,72,214,.10)',color:'#5C48D6',icon:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'},
    {route:'boutique',label:'Boutique',tint:'rgba(18,163,111,.10)',color:'#12A36F',icon:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5V20h16v-9.5M3 10.5 5.2 4h13.6l2.2 6.5M3 10.5c.8 1.1 1.9 1.7 3.2 1.7s2.5-.6 3.2-1.7c.8 1.1 1.9 1.7 3.2 1.7s2.5-.6 3.2-1.7c.8 1.1 1.9 1.7 3.2 1.7s2.4-.6 3.2-1.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'},
    {route:'orders',label:'Commandes',tint:'rgba(239,155,27,.12)',color:'#D88A00',icon:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'},
    {route:'team',label:'Équipe',tint:'rgba(31,116,220,.10)',color:'#1F74DC',icon:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 20c.7-3.4 2.9-5.4 5.5-5.4s4.8 2 5.5 5.4M16 9.5c1.6.2 2.8 1.4 2.8 3.1M16 5.3a3 3 0 0 1 0 5.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'}
  ];
  return `
    <div class="dashboard-v2-head dashboard-v5-head">
      <div class="dashboard-v5-heading"><h1 class="dashboard-v2-title">${Utils.escapeHtml(store.name||'Ma boutique')}${TopBarPlanBadge()}</h1></div>
      <div style="display:flex;align-items:center;gap:9px;flex:none;">
        <button class="bell-btn" onclick="toggleNotifPanel()" aria-label="Notifications">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <div class="bell-dot" id="bell-dot"></div>
        </button>
        <button class="dashboard-v2-profile" onclick="Router.go('settings')" aria-label="Paramètres">
          ${store.photo ? `<img src="${store.photo}" alt="">` : `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c.9-4 3.7-6.2 7.5-6.2s6.6 2.2 7.5 6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`}
        </button>
      </div>
    </div>
    <section class="dashboard-v18-finance" aria-label="Tableau de bord financier">
      <div class="finance-main">
        <div class="finance-main-label">Ventes livrées</div>
        <div class="finance-total" id="finance-total-val" data-target="${deliveredRevenue}">0 FCFA</div>
      </div>
      <div class="finance-two-col">
        <div class="finance-two-col-item"><span>En attente</span><b>${Utils.fmtFCFA(pending)}</b></div>
        <div class="finance-two-col-item right"><span>Total des ventes</span><b>${Utils.fmtFCFA(totalSales)}</b></div>
      </div>
      <div class="finance-trust-note"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex:none;"><path d="M12 3l7 3v6c0 4.8-3 8.5-7 9.9-4-1.4-7-5.1-7-9.9V6l7-3Z" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg><span>Chaque paiement client va directement sur votre compte Wave/OM/MTN</span></div>
    </section>
    </section>
    <div class="dashboard-v2-section"><h3>Raccourcis</h3><button onclick="Router.go('products')">Tout voir ›</button></div>
    <div class="dashboard-v2-quick">${quick.map(q=>`<button class="quick-nav-card" onclick="dashboardQuickGo('${q.route}')" aria-label="${q.label}"><div class="qicon" style="background:${q.tint};color:${q.color};">${q.icon}</div><span>${q.label}</span></button>`).join('')}</div>
    <div class="dashboard-v2-section"><h3>Services SIAMS</h3><button onclick="Sheet.open()">Voir tout ›</button></div>
    <div class="dashboard-v2-service-grid">${DASHBOARD_SERVICES.slice(0,9).map(s=>`<button type="button" class="dashboard-v2-service" onclick="dashboardServiceGo('${s.route}')" aria-label="Ouvrir ${s.label}"><div class="sicon" style="background:${s.tint};color:${s.color};">${s.icon}</div><span>${s.label}</span></button>`).join('')}</div>
    <div class="dashboard-v2-section"><h3>Suivi des commandes</h3><button onclick="Router.go('orders')">Détails ›</button></div>
    <div class="dashboard-v2-command-card">
      ${cmdRow('Nouvelles commandes',counts.new,'var(--mango)','À traiter maintenant')}
      ${cmdRow('En préparation',counts.preparing,'var(--blue)','Commandes en cours')}
      ${cmdRow('Expédiées',counts.shipped,'var(--indigo)','En cours de livraison')}
      ${cmdRow('Terminées',counts.done,'var(--green)','Livrées avec succès')}
      ${cmdRow('Annulées',counts.cancelled,'var(--red)','À vérifier')}
    </div>
    <div class="dashboard-v2-section"><h3>Votre activité</h3><button onclick="Router.go('stats')">Voir les stats ›</button></div>
    <div class="stat-grid" style="padding-top:0;">
      <div class="stat-card"><div class="lbl">Aujourd'hui</div><div class="val">${Utils.fmtFCFA(revToday)}</div></div>
      <div class="stat-card"><div class="lbl">Cette semaine</div><div class="val">${Utils.fmtFCFA(revWeek)}</div></div>
      <div class="stat-card"><div class="lbl">Panier moyen</div><div class="val">${Utils.fmtFCFA(avgBasket)}</div></div>
      <div class="stat-card"><div class="lbl">Clients</div><div class="val">${clientsCount}</div></div>
    </div>
    ${lowStockProducts.length ? `
    <div class="dashboard-v2-section"><h3>Alerte stock</h3><button onclick="Router.go('products')">Voir le catalogue ›</button></div>
    <div style="margin:0 20px 6px;border:1.5px solid var(--mango);border-radius:var(--radius-md);background:var(--mango-tint);overflow:hidden;">
      ${lowStockProducts.slice(0,5).map(p=>{
        const out = Number(p.stockQty||0)===0;
        return `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;" onclick="Router.go('product-edit',{id:'${p.id}'})">
          <span style="width:8px;height:8px;border-radius:50%;background:${out?'var(--red)':'var(--mango-dark)'};flex:none;"></span>
          <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(p.name||'Produit')}</div></div>
          <span style="font-size:11.5px;font-weight:800;color:${out?'var(--red)':'var(--mango-dark)'};flex:none;">${out?'Épuisé':`${p.stockQty} restant${Number(p.stockQty)>1?'s':''}`}</span>
        </div>`;
      }).join('')}
      ${lowStockProducts.length>5?`<div style="padding:9px 14px;font-size:11.5px;color:var(--mango-dark);text-align:center;">+ ${lowStockProducts.length-5} autre${lowStockProducts.length-5>1?'s':''} produit${lowStockProducts.length-5>1?'s':''} en alerte</div>`:''}
    </div>` : ''}
    
    ${CommissionCard()}
    ${SubCommissionCard()}
    <div class="section-title">Abonnement</div>
    ${SubscriptionCard(access)}
    <div style="height:16px;"></div>`;
};
Views._after_dashboard = function(){
  const el=document.getElementById('finance-total-val');
  if(!el) return;
  const target=Number(el.getAttribute('data-target'))||0;
  const dur=700; const start=performance.now();
  function step(now){
    const p=Math.min(1,(now-start)/dur);
    const eased=1-Math.pow(1-p,3);
    el.textContent=Utils.fmtFCFA(Math.round(target*eased));
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};

/* ---------- Récapitulatif des badges débloqués par formule d'abonnement :
   BON MOOD → aucun badge · DOYEN → badge noir · DOYA → badge bleu ·
   TOUTE BOUTIQUE → badge bordeaux · PLATINE → badge rouge (GOLDEN, exclusif, non repris ici). ---- */
const COMMISSION_BADGE_RECAP = [
  { label:'BON MOOD',       color:null,      note:'Aucun badge' },
  { label:'DOYEN',          color:'#0B0E17', note:'Badge noir' },
  { label:'DOYA',           color:'#0091FD', note:'Badge bleu' },
  { label:'TOUTE BOUTIQUE', color:'#8E1537', note:'Badge bordeaux' },
  { label:'PLATINE',        color:'#D7263D', note:'Badge rouge' }
];
function CommissionBadgeRecap(){
  return `
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
    ${COMMISSION_BADGE_RECAP.map(t=>`
      <div style="display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 10px 5px 6px;">
        ${t.color
          ? `<span style="width:14px;height:14px;border-radius:50%;flex:none;background:${t.color};box-shadow:0 0 0 2px #fff, 0 0 0 3px ${t.color}33;"></span>`
          : `<span style="width:14px;height:14px;border-radius:50%;flex:none;border:1.5px dashed var(--text-soft);"></span>`}
        <span style="font-size:10.5px;font-weight:800;letter-spacing:.02em;">${t.label}</span>
        <span style="font-size:10px;color:var(--text-mid);">· ${t.note}</span>
      </div>`).join('')}
  </div>`;
}

/* ---------- Carte « Commission » (dashboard) — période d'essai de 20 jours ---------- */
function CommissionCard(){
  const due = Store.commissionDue();
  const settled = Store.commissionSettled;
  const trialEnd = Store.trialStartedAt + TRIAL_DAYS*86400000;
  const inTrial = Date.now() < trialEnd;
  const daysLeft = Math.max(0, Math.ceil((trialEnd-Date.now())/86400000));
  if(settled || (due<=0 && !inTrial)) return '';
  return `
  <div class="section-title">Commission (période d'essai)</div>
  <div style="margin:8px 20px 0;border:1.5px solid ${inTrial?'var(--gold)':'var(--ruby)'};border-radius:var(--radius-md);overflow:hidden;background:#fff;box-shadow:var(--shadow-sm);">
    <div style="padding:16px 16px 14px;background:${inTrial?'var(--gold-tint)':'var(--ruby-tint)'};">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:7px;">
          <span style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${inTrial?'var(--gold)':'var(--ruby)'};flex:none;">💰</span>
          <span style="font-size:12.5px;font-weight:800;color:${inTrial?'var(--gold-dark)':'var(--ruby-dark)'};">Commission SIAMS</span>
        </div>
        <span style="font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:4px 9px;border-radius:999px;background:${inTrial?'var(--gold)':'var(--ruby)'};color:#fff;">${inTrial?'ESSAI · 5%':'ESSAI TERMINÉ'}</span>
      </div>
      <div style="font-size:24px;font-weight:800;" class="mono">${Utils.fmtFCFA(due)}</div>
      <div style="font-size:12px;color:var(--text-mid);margin-top:6px;line-height:1.5;">${inTrial
        ? `Calculée en temps réel sur le montant total de vos commandes livrées, pendant vos 20 jours d'essai (encore ${daysLeft} jour${daysLeft>1?'s':''}). Elle augmente à chaque commande livrée. Elle disparaît dès l'activation de votre Pass.`
        : `Vos 20 jours d'essai sont terminés. Ce montant reste dû et doit être réglé avec votre abonnement pour continuer à vendre sans interruption.`}</div>
    </div>
    ${!inTrial ? `
    <div style="padding:14px 16px 16px;border-top:1px solid var(--line);">
      <div style="font-size:12.5px;font-weight:700;margin-bottom:4px;">Gérer ma commission</div>
      <p style="font-size:11.5px;color:var(--text-mid);margin:0 0 10px;line-height:1.5;">Réglez uniquement ce montant, ou activez un Pass pour que la commission d'essai disparaisse définitivement.</p>
      <button type="button" class="btn btn-primary btn-block" onclick="SubscriptionSheet.openCommissionOnly()">Gérer ma commission</button>
      <button type="button" class="btn btn-outline btn-block" style="margin-top:8px;" onclick="SubscriptionSheet.open()">Voir les formules d'abonnement</button>
      ${(()=>{ const verified = !!(Store.store && Store.store.verification && Store.store.verification.verified);
        return !verified ? `
      <div style="display:flex;align-items:flex-start;gap:8px;margin-top:10px;border:1px solid var(--mango);background:var(--mango-tint);border-radius:var(--radius-sm);padding:9px 11px;">
        <span style="flex:none;">🛡️</span>
        <div style="font-size:11px;color:var(--text-mid);line-height:1.5;">Le badge de votre formule ne se débloque qu'une fois votre <a href="#" onclick="Router.go('verification');return false;" style="color:var(--mango-dark);font-weight:700;">identification validée</a> par SIAMS — même avec un Pass payé et actif.</div>
      </div>` : ''; })()}
      ${CommissionBadgeRecap()}
    </div>` : ''}
  </div>`;
}

/* ---------- Carte « Commission » (dashboard) — pendant l'abonnement (Pass payant), 2% ---------- */
function SubCommissionCard(){
  const access = Store.access();
  if(access.status!=='active') return '';
  const due = Store.subCommissionDue();
  if(due<=0) return '';
  return `
  <div class="section-title">Commission (abonnement)</div>
  <div style="margin:8px 20px 0;border:1.5px solid var(--gold);border-radius:var(--radius-md);padding:16px;background:var(--gold-tint);box-shadow:var(--shadow-sm);">
    <div style="font-size:12px;color:var(--gold-dark);font-weight:700;margin-bottom:2px;">💰 COMMISSION SIAMS — 2% SUR CHAQUE VENTE</div>
    <div style="font-size:19px;font-weight:800;" class="mono">${Utils.fmtFCFA(due)}</div>
    <div style="font-size:12px;color:var(--text-mid);margin-top:6px;">Calculée en temps réel sur vos commandes livrées depuis votre dernier règlement, en plus du prix de votre Pass (Article 8 du contrat).</div>
    <button type="button" class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="SubscriptionSheet.markSubCommissionSettled()">J'ai réglé la commission, envoyer le reçu</button>
  </div>`;
}

/* ---------- Carte d'état de l'abonnement (dashboard) ---------- */
function fmtMsLeft(ms){
  const totalSec = Math.max(0, Math.ceil(ms/1000));
  const m = Math.floor(totalSec/60), s = totalSec%60;
  return m+':'+String(s).padStart(2,'0');
}
function fmtRenewCountdown(ms){
  const total = Math.max(0, ms);
  const d = Math.floor(total/86400000);
  const h = Math.floor((total%86400000)/3600000);
  const m = Math.floor((total%3600000)/60000);
  const s = Math.floor((total%60000)/1000);
  if(d>0) return `${d}j ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
  if(h>0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  return `${m}m ${String(s).padStart(2,'0')}s`;
}
setInterval(()=>{
  const el = document.getElementById('sub-renew-countdown');
  const val = document.getElementById('sub-renew-countdown-val');
  if(el && val){
    const renewsAt = Number(el.dataset.renewsAt);
    val.textContent = fmtRenewCountdown(renewsAt - Date.now());
  }
}, 1000);
function SubscriptionCard(access){
  if(access.status==='trial'){
    return `
    <div style="margin:8px 20px 0;border:1.5px solid var(--mango);border-radius:var(--radius-md);padding:16px;background:var(--mango-tint);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:12px;color:var(--mango-dark);font-weight:700;margin-bottom:2px;">🎁 PASS GRATUIT DE DÉCOUVERTE</div>
          <div style="font-size:16px;font-weight:700;">${access.daysLeft} jour${access.daysLeft>1?'s':''} restant${access.daysLeft>1?'s':''}</div>
          <div style="font-size:12px;color:var(--text-mid);margin-top:6px;">Toutes les fonctionnalités sont débloquées. Choisissez votre formule avant la fin de l'essai.</div>
        </div>
        <button class="btn btn-mango" style="padding:9px 14px;font-size:12.5px;flex:none;" onclick="SubscriptionSheet.open()">Voir les formules</button>
      </div>
    </div>`;
  }
  if(access.status==='pending'){
    return `
    <div style="margin:8px 20px 0;border:1.5px solid var(--blue);border-radius:var(--radius-md);padding:16px;background:var(--blue-tint);box-shadow:var(--shadow-sm);">
      <div style="font-size:12px;color:var(--blue);font-weight:700;margin-bottom:2px;">⏳ VÉRIFICATION DU PAIEMENT</div>
      <div style="font-size:15px;font-weight:700;">Formule ${access.label} en cours d'activation</div>
      <div style="font-size:12px;color:var(--text-mid);margin-top:6px;">Votre preuve de paiement a été transmise. Le déblocage se fait dès que SIAMS valide votre paiement — vous recevrez une notification.</div>
    </div>`;
  }
  if(access.status==='building'){
    const totalConfirmed = access.paidAmount||0;
    const pct = Math.min(100, Math.round((totalConfirmed/access.price)*100));
    const remaining = Math.max(0, access.price - totalConfirmed - (access.pendingAmount||0));
    return `
    <div style="margin:8px 20px 0;border:1.5px solid var(--blue);border-radius:var(--radius-md);padding:16px;background:var(--blue-tint);box-shadow:var(--shadow-sm);">
      <div style="font-size:12px;color:var(--blue);font-weight:700;margin-bottom:2px;">💳 PAIEMENT ${access.mode==='daily'?'JOURNALIER':'MENSUEL'} EN COURS</div>
      <div style="font-size:15px;font-weight:700;">Formule ${access.label} — ${Utils.fmtFCFA(access.price)}</div>
      <div class="installment-bar-track" style="margin-top:10px;"><div class="installment-bar-fill" style="width:${pct}%;"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;">
        <span style="font-size:11.5px;color:var(--text-mid);">${Utils.fmtFCFA(totalConfirmed)} confirmé sur ${Utils.fmtFCFA(access.price)}</span>
        <span class="mono" style="font-size:11.5px;font-weight:700;color:var(--blue);">${pct}%</span>
      </div>
      ${access.pendingAmount ? `<div style="font-size:11.5px;color:var(--text-mid);margin-top:6px;">⏳ ${Utils.fmtFCFA(access.pendingAmount)} en attente de validation SIAMS (<span class="mono" id="sub-pending-countdown">${fmtMsLeft(access.msLeft)}</span>)</div>` : ''}
      ${remaining>0 ? `<div style="font-size:11.5px;color:var(--text-mid);margin-top:2px;">Reste à payer avant le socle : <strong>${Utils.fmtFCFA(remaining)}</strong></div>` : ''}
      <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="SubscriptionSheet.openBuilding()">${access.mode==='daily'?'Déclarer un versement du jour':'Envoyer ma preuve de paiement'}</button>
    </div>`;
  }
  if(access.status==='active'){
    const renewDate = new Date(access.renewsAt).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
    const isAll = access.plan==='all';
    const isDoya = access.plan==='doya';
    const isDoyen = access.plan==='doyen';
    const isPremiumTier = isAll || isDoya;
    const crown = isAll ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2 3 9l9 13 9-13-9-7Z" fill="#F4D98A" stroke="#F4D98A" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      : isDoya ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8Z" fill="#F4D98A" stroke="#F4D98A" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      : isDoyen ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.6 6.6L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.4L12 2Z" fill="var(--indigo)"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--mango)" stroke-width="1.8"/><path d="M8 13.5c1 1.3 2.4 2 4 2s3-.7 4-2" stroke="var(--mango)" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="9.5" r="1.1" fill="var(--mango)"/><circle cx="15" cy="9.5" r="1.1" fill="var(--mango)"/></svg>';
    const periods = getPeriodStarts();
    const productsCount = Store.products.length;
    const maxP = access.features.maxProducts;
    const ordersMonth = Store.orders.filter(o=>o.createdAt>=periods.month).length;
    const revMonth = Store.revenueSince(periods.month);
    return `
    <div class="plan-card ${isAll?'tier-all':isDoya?'tier-doya':isDoyen?'tier-doyen':'tier-free'}" style="margin:8px 20px 0;cursor:default;">
      ${isAll ? '<div class="plan-ribbon" style="background:#EA580C;">TOUT INCLUS</div>' : isDoya ? '<div class="plan-ribbon" style="background:var(--gold);">PREMIUM</div>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:12px;color:${isPremiumTier?'rgba(255,255,255,.75)':'var(--text-mid)'};margin-bottom:2px;">✓ Abonnement en cours</div>
          <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:7px;color:${isPremiumTier?'#fff':'var(--text)'};">${crown}${access.label}</div>
          ${access.contractRef ? `<div style="font-size:10.5px;color:${isPremiumTier?'rgba(255,255,255,.6)':'var(--text-soft)'};margin-top:4px;" class="mono">Réf. ${access.contractRef}</div>` : ''}
        </div>
      </div>
      <div data-renews-at="${access.renewsAt}" id="sub-renew-countdown" style="margin-top:14px;padding:10px 12px;border-radius:10px;background:${isPremiumTier?'rgba(255,255,255,.14)':'var(--indigo-tint)'};display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11.5px;color:${isPremiumTier?'rgba(255,255,255,.85)':'var(--text-mid)'};">Renouvellement le ${renewDate}</span>
        <span class="mono" style="font-size:12.5px;font-weight:800;color:${isPremiumTier?'#fff':'var(--indigo)'};" id="sub-renew-countdown-val">${fmtRenewCountdown(access.renewsAt-Date.now())}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <div style="flex:1;padding:9px 10px;border-radius:10px;background:${isPremiumTier?'rgba(255,255,255,.1)':'var(--panel)'};">
          <div style="font-size:10px;color:${isPremiumTier?'rgba(255,255,255,.7)':'var(--text-soft)'};">Produits</div>
          <div style="font-size:13px;font-weight:800;color:${isPremiumTier?'#fff':'var(--text)'};" class="mono">${productsCount}${maxP===Infinity?'':' / '+maxP}</div>
        </div>
        <div style="flex:1;padding:9px 10px;border-radius:10px;background:${isPremiumTier?'rgba(255,255,255,.1)':'var(--panel)'};">
          <div style="font-size:10px;color:${isPremiumTier?'rgba(255,255,255,.7)':'var(--text-soft)'};">Commandes (mois)</div>
          <div style="font-size:13px;font-weight:800;color:${isPremiumTier?'#fff':'var(--text)'};" class="mono">${ordersMonth}</div>
        </div>
        <div style="flex:1;padding:9px 10px;border-radius:10px;background:${isPremiumTier?'rgba(255,255,255,.1)':'var(--panel)'};">
          <div style="font-size:10px;color:${isPremiumTier?'rgba(255,255,255,.7)':'var(--text-soft)'};">Ventes (mois)</div>
          <div style="font-size:12.5px;font-weight:800;color:${isPremiumTier?'#fff':'var(--text)'};" class="mono">${Utils.fmtFCFA(revMonth)}</div>
        </div>
      </div>
      ${access.contractRef ? `<button class="btn ${isPremiumTier?'btn-ghost':'btn-outline'} btn-block" style="margin-top:12px;padding:9px 14px;font-size:12px;${isPremiumTier?'background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.3);':''}" onclick="downloadSubscriptionReceiptPDF()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Télécharger le reçu (PDF)</button>` : ''}
    </div>`;
  }
  return `
    <div style="margin:8px 20px 0;border:1.5px solid var(--red);border-radius:var(--radius-md);padding:16px;background:var(--red-tint);box-shadow:var(--shadow-sm);">
      <div style="font-size:12px;color:var(--red);font-weight:700;margin-bottom:2px;">🔒 AUCUN ABONNEMENT ACTIF</div>
      <div style="font-size:13.5px;color:var(--text);margin:4px 0 12px;">Les fonctionnalités boutique (produits illimités, statistiques, promos...) sont verrouillées.</div>
      <button class="btn btn-primary btn-block" onclick="SubscriptionSheet.open()">S'abonner maintenant</button>
    </div>`;
}

/* ---------- Écran de verrouillage pour les fonctionnalités non incluses dans la formule ---------- */
function FeatureLock(title, desc, tier){
  const isDoya = tier==='doya';
  const iconBg = isDoya ? 'var(--gold-tint)' : 'var(--indigo-tint)';
  const iconColor = isDoya ? 'var(--gold-dark)' : 'var(--indigo)';
  const pillBg = isDoya ? 'var(--gold-tint)' : 'var(--indigo-tint)';
  const pillColor = isDoya ? 'var(--gold-dark)' : 'var(--indigo)';
  const pillLabel = isDoya ? 'RÉSERVÉ À DOYA' : 'DÈS DOYEN';
  return `
  ${TopBar(title)}
  <div style="padding:40px 24px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:18px;background:${iconBg};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="${iconColor}" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="${iconColor}" stroke-width="1.8" stroke-linecap="round"/></svg>
    </div>
    <div style="display:inline-block;background:${pillBg};color:${pillColor};font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:5px 12px;border-radius:999px;margin-bottom:12px;">${pillLabel}</div>
    <h3 style="margin:0 0 8px;">Fonctionnalité verrouillée</h3>
    <p style="color:var(--text-mid);font-size:13.5px;margin:0 0 22px;">${desc}</p>
    <button class="btn btn-primary" style="padding:12px 22px;" onclick="SubscriptionSheet.open()">Voir les formules</button>
  </div>`;
}

/* ---------- Sélecteur de formule d'abonnement + aperçu démo + paiement ---------- */
let subPaymentStep = null; // {plan} quand l'utilisateur a choisi une formule
let subDemoSeen = false; // true une fois l'aperçu démo consulté, pour passer au choix du mode de paiement
let subPaymentMode = null; // 'monthly' ou 'daily', une fois choisi sur l'écran d'explication
let subCommissionOnlyMode = false; // true : raccourci « Gérer ma commission » sans passer par le choix de formule
const subPaymentMethod = 'djamo'; // moyen de paiement (Djamo uniquement)
const SUB_PAY_LABELS = { djamo:'Djamo', wave:'Wave', card:'Carte bancaire (virement SIAMS BANQUE)' };
const FEATURE_LABELS = [
  { key:'maxProducts', label:p=> p===Infinity ? 'Catalogue de produits illimité' : `Jusqu'à ${p} produits au catalogue` },
  { key:'stats', label:'Statistiques avancées & tableaux de bord' },
  { key:'promos', label:'Codes promo & réductions' },
  { key:'reviews', label:'Avis clients' },
  { key:'customers', label:'Fiches clients & historique des ventes' },
  { key:'banner', label:'Bannière boutique personnalisée' },
  { key:'badgeVisibility', label:'Badge de visibilité boutique' },
  { key:'team', label:"Gestion d'équipe (gérants, vendeurs)" },
  { key:'delivery', label:'Zones de livraison personnalisées' },
  { key:'prioritySupport', label:'Support prioritaire dédié' },
  { key:'featuredBoost', label:'Mise en avant renforcée dans les résultats' },
  { key:'goldenBadge', label:'Badge Doré exclusif' },
  { key:'vipSupport', label:'Ligne support VIP 24/7 dédiée' },
  { key:'homepageSpotlight', label:"Mise en avant permanente à l'accueil" },
  { key:'customStorefront', label:'Vitrine boutique entièrement personnalisable' }
];
const SubscriptionSheet = {
  open(){
    if(Store.access().status==='active'){ Toast.show('Abonnement déjà actif — voir la carte "Abonnement en cours"'); return; }
    subPaymentStep = null; subDemoSeen = false; subPaymentMode = null; subCommissionOnlyMode = false; this.mount();
  },
  /* ---- Raccourci « Gérer ma commission » : règle uniquement la commission d'essai due,
     sans passer par le choix d'une formule d'abonnement. ---- */
  openCommissionOnly(){
    const due = Store.commissionDue();
    if(due<=0 || Store.commissionSettled){ Toast.show('Aucune commission à régler pour le moment'); return; }
    subPaymentStep = null; subDemoSeen = false; subPaymentMode = null; subCommissionOnlyMode = true; this.mount();
  },
  /* ---- Ouvre directement l'écran de paiement pour la formule en cours d'accumulation (paiement échelonné) ---- */
  openBuilding(){
    const sub = Store.subscription;
    const plan = SUBSCRIPTION_PLANS.find(p=>p.key===sub.plan);
    if(!plan) return;
    subPaymentStep = plan;
    subDemoSeen = true;
    subPaymentMode = sub.mode || 'daily';
    this.mount();
  },
  mount(){
    const existing = document.getElementById('sub-wrap');
    if(existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.id = 'sub-wrap';
    document.body.appendChild(wrap);
    this.render();
  },
  close(){
    const ov = document.getElementById('sub-overlay'), sh = document.getElementById('sub-sheet');
    if(ov) ov.classList.remove('show');
    if(sh) sh.classList.remove('show');
    subCommissionOnlyMode = false;
    setTimeout(()=>{ const w = document.getElementById('sub-wrap'); if(w) w.remove(); }, 220);
  },
  render(){
    const wrap = document.getElementById('sub-wrap');
    if(!wrap) return;
    const access = Store.access();
    if(subCommissionOnlyMode){
      wrap.innerHTML = this.commissionOnlyScreen();
      this._show();
      return;
    }
    if(subPaymentStep && subDemoSeen && subPaymentMode){
      wrap.innerHTML = this.paymentScreen(subPaymentStep, subPaymentMode);
      this._show();
      return;
    }
    if(subPaymentStep && subDemoSeen && !subPaymentMode){
      wrap.innerHTML = this.explainScreen(subPaymentStep);
      this._show();
      return;
    }
    if(subPaymentStep && !subDemoSeen){
      wrap.innerHTML = this.previewScreen(subPaymentStep);
      this._show();
      return;
    }
    wrap.innerHTML = `
      <div class="shop-sheet-overlay" id="sub-overlay" onclick="SubscriptionSheet.close()"></div>
      <div class="shop-sheet" id="sub-sheet" style="max-height:88vh;">
        <div class="sheet-handle"></div>
        <h3 style="margin:2px 0 4px;">Choisir une formule</h3>
        <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 16px;">Abonnement mensuel + commission SIAMS de 2% sur chaque vente réalisée pendant l'abonnement. Changez de formule à tout moment.</p>
        ${SUBSCRIPTION_PLANS.filter(p=>!p.exclusive || isSiamsGoldenStore()).map(p=>{
          const tierClass = p.key==='golden' ? 'tier-golden' : p.key==='platinum' ? 'tier-platinum' : p.key==='all' ? 'tier-all' : p.key==='doya' ? 'tier-doya' : p.key==='doyen' ? 'tier-doyen' : 'tier-free';
          const isCurrent = access.status==='active' && access.plan===p.key;
          const crownBg = p.key==='golden' ? 'rgba(240,194,75,.22)' : p.key==='platinum' ? 'rgba(255,59,92,.22)' : p.key==='all' ? 'rgba(255,255,255,.18)' : p.key==='doya' ? 'rgba(255,255,255,.18)' : p.key==='doyen' ? 'var(--indigo-tint)' : 'var(--mango-tint)';
          const crownIcon = p.key==='golden'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 18h16l1.4-9-5.4 3.5L12 5l-4 7.5L2.6 9 4 18Z" stroke="#F0C24B" stroke-width="1.8" stroke-linejoin="round" fill="#F0C24B"/></svg>'
            : p.key==='platinum'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 3h12l3 5-9 13L3 8l3-5Z" stroke="#FF8FA3" stroke-width="1.8" stroke-linejoin="round" fill="#FF8FA3"/></svg>'
            : p.key==='all'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2 3 9l9 13 9-13-9-7Z" stroke="#F4D98A" stroke-width="1.8" stroke-linejoin="round" fill="#F4D98A"/></svg>'
            : p.key==='doya'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8Z" stroke="#F4D98A" stroke-width="1.8" stroke-linejoin="round" fill="#F4D98A"/></svg>'
            : p.key==='doyen'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.6 6.6L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.4L12 2Z" fill="var(--indigo)"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--mango)" stroke-width="1.8"/><path d="M8 13.5c1 1.3 2.4 2 4 2s3-.7 4-2" stroke="var(--mango)" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="9.5" r="1.1" fill="var(--mango)"/><circle cx="15" cy="9.5" r="1.1" fill="var(--mango)"/></svg>';
          const mid = `<div class="plan-crown" style="background:${crownBg};">${crownIcon}</div>`;
          const priceColor = (p.key==='doya'||p.key==='all'||p.key==='platinum'||p.key==='golden') ? '#fff' : 'var(--text)';
          const taglineColor = (p.key==='doya'||p.key==='all'||p.key==='platinum'||p.key==='golden') ? 'rgba(255,255,255,.82)' : 'var(--text-mid)';
          const ctaColor = (p.key==='golden'||p.key==='platinum'||p.key==='all'||p.key==='doya') ? '#F4D98A' : 'var(--indigo)';
          return `
          <div class="plan-card ${tierClass} ${isCurrent?'selected':''}" onclick="SubscriptionSheet.choose('${p.key}')">
            ${p.key==='doyen' ? '<div class="plan-ribbon">POPULAIRE</div>' : ''}
            ${p.key==='doya' ? '<div class="plan-ribbon" style="background:var(--gold);">PREMIUM</div>' : ''}
            ${p.key==='all' ? '<div class="plan-ribbon" style="background:var(--ruby);">TOUT INCLUS</div>' : ''}
            ${p.key==='platinum' ? '<div class="plan-ribbon" style="background:linear-gradient(90deg,#8A0E22,#FF3B5C);">PLATINE</div>' : ''}
            ${p.key==='golden' ? '<div class="plan-ribbon" style="background:linear-gradient(90deg,#B8860B,#F0C24B);color:#1a1300;">EXCLUSIF</div>' : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <span style="display:flex;align-items:center;gap:8px;color:${priceColor};" class="plan-name">${mid}${p.label}</span>
              <span style="color:${priceColor};" class="plan-price">${Utils.fmtFCFA(p.price)}<span class="plan-price-per">/mois</span></span>
            </div>
            <p style="font-size:12px;color:${taglineColor};margin:8px 0 0;line-height:1.45;">${p.tagline}</p>
            <div class="plan-cta" style="color:${ctaColor};">${isCurrent?'✓ Formule actuelle':"Voir l'aperçu ›"}</div>
          </div>`;
        }).join('')}
      </div>`;
    this._show();
  },
  _show(){
    requestAnimationFrame(()=>{
      const ov = document.getElementById('sub-overlay'), sh = document.getElementById('sub-sheet');
      if(ov) ov.classList.add('show');
      if(sh) sh.classList.add('show');
    });
  },
  choose(key){
    try{
      const plan = SUBSCRIPTION_PLANS.find(p=>p.key===key);
      if(!plan){ console.warn('SubscriptionSheet.choose: formule introuvable pour', key); return; }
      if(plan.exclusive && !isSiamsGoldenStore()){ Toast.show('Cette formule est réservée à la boutique officielle SIAMS.'); return; }
      subPaymentStep = plan;
      subDemoSeen = false;
      subPaymentMode = null;
      this.render();
    }catch(e){
      console.error('SubscriptionSheet.choose error:', e);
      Toast.show('Impossible d’ouvrir l’aperçu pour le moment.');
    }
  },
  /* ---- Aperçu démo de la formule : à consulter avant de finaliser le paiement ---- */
  previewScreen(plan){
    const tierClass = plan.key==='golden' ? 'tier-golden' : plan.key==='platinum' ? 'tier-platinum' : plan.key==='all' ? 'tier-all' : plan.key==='doya' ? 'tier-doya' : plan.key==='doyen' ? 'tier-doyen' : 'tier-free';
    const sortedFeatures = [...FEATURE_LABELS].sort((a,b)=> (plan.features[b.key]?1:0) - (plan.features[a.key]?1:0));
    let dividerPlaced = false;
    const rows = sortedFeatures.map(f=>{
      const on = !!plan.features[f.key];
      const label = typeof f.label==='function' ? f.label(plan.features[f.key]) : f.label;
      const checkIcon = on
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
      let divider = '';
      if(!on && !dividerPlaced){ divider = '<div class="demo-feature-divider"></div>'; dividerPlaced = true; }
      return `${divider}
        <div class="demo-feature-item ${on?'':'locked'}">
          <span class="demo-feature-check ${on?'':'locked'}">${checkIcon}</span>
          ${label}
        </div>`;
    }).join('');
    return `
      <div class="shop-sheet-overlay" id="sub-overlay__v46_2" onclick="SubscriptionSheet.close()"></div>
      <div class="shop-sheet" id="sub-sheet__v46_2" style="max-height:92vh;">
        <div class="sheet-handle"></div>
        <button onclick="subPaymentStep=null;SubscriptionSheet.render();" style="background:none;border:none;color:var(--text-mid);font-size:13px;padding:0 0 10px;cursor:pointer;">‹ Retour aux formules</button>
        <h3 style="margin:0 0 4px;">Aperçu de la formule ${plan.label}</h3>
        <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 14px;">Voici précisément ce qui sera débloqué dans votre boutique. Vérifiez avant de finaliser le paiement.</p>
        <div class="demo-preview">
          <div class="demo-preview-bar"><span class="demo-preview-dot"></span><span class="demo-preview-dot"></span><span class="demo-preview-dot"></span><span class="demo-preview-label">APERÇU · ${plan.label}</span></div>
          <div class="demo-preview-body">
            <div class="demo-feature-list">${rows}</div>
          </div>
        </div>
        <div class="plan-card ${tierClass}" style="margin-bottom:16px;cursor:default;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="plan-name">Formule ${plan.label}</span>
            <span class="plan-price">${Utils.fmtFCFA(plan.price)}<span class="plan-price-per">/mois</span></span>
          </div>
        </div>
        <button class="btn btn-primary btn-block" onclick="SubscriptionSheet.proceedToPayment('${plan.key}')">Continuer vers le paiement</button>
      </div>`;
  },
  proceedToPayment(key){
    const plan = SUBSCRIPTION_PLANS.find(p=>p.key===key);
    if(!plan) return;
    subDemoSeen = true;
    subPaymentMode = null;
    this.render();
  },
  /* ---- Explique les deux façons de régler l'abonnement avant de laisser choisir ---- */
  explainScreen(plan){
    return `
      <div class="shop-sheet-overlay" id="sub-overlay__v46_3" onclick="SubscriptionSheet.close()"></div>
      <div class="shop-sheet" id="sub-sheet__v46_3" style="max-height:92vh;">
        <div class="sheet-handle"></div>
        <button onclick="subDemoSeen=false;SubscriptionSheet.render();" style="background:none;border:none;color:var(--text-mid);font-size:13px;padding:0 0 10px;cursor:pointer;">‹ Retour à l'aperçu</button>
        <h3 style="margin:0 0 4px;">Comment souhaitez-vous payer ?</h3>
        <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 18px;line-height:1.55;">
          La formule <strong style="color:var(--text);">${plan.label}</strong> coûte <strong class="mono" style="color:var(--text);">${Utils.fmtFCFA(plan.price)}</strong>. Vous pouvez régler ce montant en une seule fois (paiement mensuel), ou le fractionner en plusieurs petits versements journaliers avant l'échéance (paiement échelonné). Après chaque paiement, envoyez la capture d'écran de votre transaction via le bouton WhatsApp ci-dessous. Une fois le versement validé par SIAMS, une barre de progression avance jusqu'à atteindre le montant total (le « socle »), puis l'abonnement est activé.
        </p>
        <button class="btn btn-primary btn-block" style="margin-bottom:10px;padding:16px;" onclick="SubscriptionSheet.chooseMode('${plan.key}','monthly')">
          Payer mon abonnement mensuel<br><span style="font-weight:600;font-size:12px;opacity:.85;">${Utils.fmtFCFA(plan.price)} en une seule fois</span>
        </button>
        <button class="btn btn-outline btn-block" style="padding:16px;" onclick="SubscriptionSheet.chooseMode('${plan.key}','daily')">
          Paiement journalier échelonné<br><span style="font-weight:600;font-size:12px;color:var(--text-mid);">dès ${Utils.fmtFCFA(plan.dailyRate)} / jour</span>
        </button>
      </div>`;
  },
  chooseMode(key, mode){
    const plan = SUBSCRIPTION_PLANS.find(p=>p.key===key);
    if(!plan) return;
    const sub = Store.subscription;
    if(sub.status==='building' && sub.plan===key){
      Store.subscription = { ...sub, mode };
    } else {
      Installments.start(key, mode);
    }
    subPaymentMode = mode;
    this.render();
  },
  paymentScreen(plan, mode){
    mode = mode || subPaymentMode || 'monthly';
    const sub = Store.subscription;
    const inProgress = sub.status==='building' && sub.plan===plan.key;
    const paid = inProgress ? (sub.paidAmount||0) : 0;
    const pendingAmt = inProgress ? (sub.pendingAmount||0) : 0;
    const remaining = Math.max(0, plan.price - paid - pendingAmt);
    const suggested = mode==='daily' ? Math.max(1, Math.min(plan.dailyRate, remaining||plan.dailyRate)) : (remaining||plan.price);
    const pct = Math.min(100, Math.round((paid/plan.price)*100));
    return `
      <div class="shop-sheet-overlay" id="sub-overlay__v46_4" onclick="SubscriptionSheet.close()"></div>
      <div class="shop-sheet" id="sub-sheet__v46_4" style="max-height:92vh;">
        <div class="sheet-handle"></div>
        <button onclick="subPaymentMode=null;SubscriptionSheet.render();" style="background:none;border:none;color:var(--text-mid);font-size:13px;padding:0 0 10px;cursor:pointer;">‹ Choisir un autre mode de paiement</button>
        <h3 style="margin:0 0 4px;">${mode==='daily'?'Paiement journalier':'Paiement mensuel'} — ${plan.label}</h3>
        <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 14px;">Montant total de la formule : <strong class="mono" style="color:var(--text);">${Utils.fmtFCFA(plan.price)}</strong></p>
        ${(()=>{ const due=Store.commissionDue(); const settled=Store.commissionSettled;
          if(due<=0 || settled) return '';
          return `
        <div style="border:1.5px solid var(--gold);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px;background:var(--gold-tint);">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">💰 Commission période d'essai à régler</div>
          <div style="font-size:17px;font-weight:800;" class="mono">${Utils.fmtFCFA(due)}</div>
          <p style="font-size:11.5px;color:var(--text-mid);margin:6px 0 10px;">5% sur toutes vos commandes livrées pendant les 20 jours d'essai (Article 5 du contrat). Ajoutez ce montant à votre virement Djamo, en plus de l'abonnement.</p>
          <button type="button" class="btn btn-outline btn-sm" onclick="SubscriptionSheet.markCommissionSettled()">J'ai réglé la commission, envoyer le reçu</button>
        </div>`;
        })()}
        ${(paid>0||pendingAmt>0) ? `
        <div style="margin-bottom:16px;">
          <div class="installment-bar-track"><div class="installment-bar-fill" style="width:${pct}%;"></div></div>
          <div style="font-size:11.5px;color:var(--text-mid);margin-top:5px;">${Utils.fmtFCFA(paid)} confirmé sur ${Utils.fmtFCFA(plan.price)}${pendingAmt?` · ${Utils.fmtFCFA(pendingAmt)} en attente de validation`:''}</div>
        </div>` : ''}
        <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:10px;">1. Payez avec Djamo ou Wave</div>
          <div style="border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;background:var(--panel);margin-bottom:8px;">
            <div style="font-size:11px;color:var(--text-mid);margin-bottom:2px;">Numéro Djamo</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="mono" style="font-size:14px;font-weight:800;letter-spacing:.03em;">${PAYMENT_INFO.djamoNumber}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${PAYMENT_INFO.djamoNumber}');Toast.show('Numéro Djamo copié ✓')">Copier</button>
            </div>
          </div>
          <div style="border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;background:var(--panel);">
            <div style="font-size:11px;color:var(--text-mid);margin-bottom:2px;">Numéro Wave</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="mono" style="font-size:14px;font-weight:800;letter-spacing:.03em;">${PAYMENT_INFO.waveNumber}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${PAYMENT_INFO.waveNumber}');Toast.show('Numéro Wave copié ✓')">Copier</button>
            </div>
          </div>
          ${mode==='daily' ? `
          <div class="field" style="margin-top:12px;margin-bottom:0;"><label>Montant payé aujourd'hui</label><input id="sub-daily-amount" type="number" min="1" value="${suggested}" placeholder="Ex : ${plan.dailyRate}"></div>
          <p style="font-size:11px;color:var(--text-mid);margin:8px 0 0;">Suggestion : ${Utils.fmtFCFA(plan.dailyRate)}/jour. Vous pouvez ajuster le montant, tant que le total atteint ${Utils.fmtFCFA(plan.price)} avant l'échéance.</p>` : `
          <p style="font-size:11.5px;color:var(--text-mid);margin:10px 0 0;">Envoyez le montant exact (${Utils.fmtFCFA(remaining||plan.price)}) via Djamo ou Wave vers l'un de ces numéros.</p>`}
        </div>
        <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:18px;">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">2. Envoyez votre preuve à SIAMS</div>
          <p style="font-size:12px;color:var(--text-mid);margin:0;">${Store.store.name?`${Utils.escapeHtml(Store.store.name)}, une`:'Une'} fois votre paiement effectué, appuyez sur le bouton ci-dessous : nous ouvrons directement votre galerie pour choisir la capture, puis votre conversation WhatsApp avec l'assistant SIAMS pour l'envoyer. Dès validation par SIAMS, la barre de progression avance jusqu'au socle.</p>
        </div>
        <input type="file" id="sub-proof-input" accept="image/*,application/pdf" class="hidden" onchange="SubscriptionSheet.handleProofFile(event)">
        <div id="sub-proof-status" style="font-size:11.5px;color:var(--text-mid);margin:0 0 10px;min-height:14px;"></div>
        <button class="btn btn-primary btn-block" onclick="SubscriptionSheet.startProofUpload('${plan.key}','${mode}')">
          <svg width="16" height="16" viewBox="0 0 448 512" fill="#fff" style="margin-right:6px;vertical-align:-3px;"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>
          J'ai payé, envoyer le reçu de paiement
        </button>
      </div>`;
  },
  /* ---- Écran raccourci « Gérer ma commission » : règle uniquement la commission
     d'essai due, sans passer par le choix ni le paiement d'une formule d'abonnement.
     Réutilise les ids de base sub-overlay/sub-sheet pour que close()/_show() fonctionnent. ---- */
  commissionOnlyScreen(){
    const due = Store.commissionDue();
    const settled = Store.commissionSettled;
    if(due<=0 || settled){
      return `
      <div class="shop-sheet-overlay" id="sub-overlay" onclick="SubscriptionSheet.close()"></div>
      <div class="shop-sheet" id="sub-sheet" style="max-height:60vh;">
        <div class="sheet-handle"></div>
        <h3 style="margin:2px 0 4px;">Commission déjà réglée</h3>
        <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 16px;">Il n'y a aucune commission en attente pour le moment.</p>
        <button class="btn btn-outline btn-block" onclick="SubscriptionSheet.close()">Fermer</button>
      </div>`;
    }
    return `
      <div class="shop-sheet-overlay" id="sub-overlay" onclick="SubscriptionSheet.close()"></div>
      <div class="shop-sheet" id="sub-sheet" style="max-height:88vh;">
        <div class="sheet-handle"></div>
        <h3 style="margin:2px 0 4px;">Gérer ma commission</h3>
        <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 14px;">Réglez uniquement la commission de la période d'essai, sans souscrire à un Pass.</p>
        <div style="border:1.5px solid var(--gold);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:16px;background:var(--gold-tint);">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">💰 Commission période d'essai due</div>
          <div style="font-size:20px;font-weight:800;" class="mono">${Utils.fmtFCFA(due)}</div>
          <p style="font-size:11.5px;color:var(--text-mid);margin:6px 0 0;">5% sur toutes vos commandes livrées pendant les 20 jours d'essai (Article 5 du contrat).</p>
        </div>
        <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:10px;">1. Payez avec Djamo ou Wave</div>
          <div style="border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;background:var(--panel);margin-bottom:8px;">
            <div style="font-size:11px;color:var(--text-mid);margin-bottom:2px;">Numéro Djamo</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="mono" style="font-size:14px;font-weight:800;letter-spacing:.03em;">${PAYMENT_INFO.djamoNumber}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${PAYMENT_INFO.djamoNumber}');Toast.show('Numéro Djamo copié ✓')">Copier</button>
            </div>
          </div>
          <div style="border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;background:var(--panel);">
            <div style="font-size:11px;color:var(--text-mid);margin-bottom:2px;">Numéro Wave</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="mono" style="font-size:14px;font-weight:800;letter-spacing:.03em;">${PAYMENT_INFO.waveNumber}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${PAYMENT_INFO.waveNumber}');Toast.show('Numéro Wave copié ✓')">Copier</button>
            </div>
          </div>
          <p style="font-size:11.5px;color:var(--text-mid);margin:10px 0 0;">Envoyez le montant exact (${Utils.fmtFCFA(due)}) via Djamo ou Wave vers l'un de ces numéros.</p>
        </div>
        <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:18px;">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">2. Envoyez votre preuve à SIAMS</div>
          <p style="font-size:12px;color:var(--text-mid);margin:0;">${Store.store.name?`${Utils.escapeHtml(Store.store.name)}, une`:'Une'} fois votre paiement effectué, appuyez sur le bouton ci-dessous : nous ouvrons directement votre galerie pour choisir la capture, puis votre conversation WhatsApp avec l'assistant SIAMS pour l'envoyer.</p>
        </div>
        <input type="file" id="sub-proof-input" accept="image/*,application/pdf" class="hidden" onchange="SubscriptionSheet.handleProofFile(event)">
        <div id="sub-proof-status" style="font-size:11.5px;color:var(--text-mid);margin:0 0 10px;min-height:14px;"></div>
        <button class="btn btn-primary btn-block" onclick="SubscriptionSheet.startCommissionProof()">
          <svg width="16" height="16" viewBox="0 0 448 512" fill="#fff" style="margin-right:6px;vertical-align:-3px;"><path d="M223.9 32C100.9 32 1.5 131.4 1.5 254.4c0 42.4 11.8 82.1 32.4 116.1L0 480l112.1-33.4c32.6 18.9 70.4 29.8 110.7 29.8h.1c123 0 222.4-99.4 222.4-222.4 0-59.3-23.4-115.1-65.6-157.2-42.2-42.2-98-64.7-155.8-64.7zm0 407.2h-.1c-35.5 0-70.3-9.5-100.6-27.5l-7.2-4.3-74.7 19.6 19.9-72.8-4.7-7.5c-19.8-31.5-30.2-67.9-30.2-105.4 0-109.1 88.8-197.9 198-197.9 52.9 0 102.6 20.6 140 58.1 37.4 37.4 58 87.1 58 140-.1 109.1-88.9 197.7-198.4 197.7zm108.4-148.3c-5.9-3-35.1-17.3-40.5-19.3-5.4-2-9.4-3-13.3 3-4 6-15.3 19.3-18.8 23.3-3.5 4-6.9 4.5-12.8 1.5-6-3-25.2-9.3-48-29.6-17.7-15.8-29.7-35.3-33.2-41.3-3.5-6-.4-9.2 2.6-12.2 2.7-2.7 6-7 9-10.5s4-6 6-10 1-7.5-.5-10.5c-1.5-3-13.3-32-18.2-43.9-4.8-11.6-9.7-10-13.3-10.2-3.4-.2-7.4-.2-11.3-.2s-10.5 1.5-16 7.5c-5.5 6-21 20.5-21 50s21.5 58 24.5 62 42.3 64.6 102.6 90.6c14.3 6.2 25.5 9.9 34.2 12.7 14.4 4.6 27.5 3.9 37.8 2.4 11.5-1.7 35.1-14.4 40.1-28.3 5-13.9 5-25.8 3.5-28.3-1.5-2.5-5.4-4-11.4-7z"/></svg>
          J'ai payé, envoyer le reçu de paiement
        </button>
        <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="subCommissionOnlyMode=false;SubscriptionSheet.render();">Voir aussi les formules d'abonnement</button>
      </div>`;
  },
  /* ---- Reçu de preuve : sélection immédiate de la photo/document dans la galerie,
     puis redirection automatique vers l'assistant client SIAMS sur WhatsApp avec un
     message prêt à envoyer. La pièce jointe doit être ajoutée manuellement dans
     WhatsApp (aucune API web ne permet de joindre un fichier à un lien wa.me). ---- */
  _pendingProof: null,
  startProofUpload(key, mode){
    const plan = SUBSCRIPTION_PLANS.find(p=>p.key===key);
    if(!plan) return;
    let sub = Store.subscription;
    if(!(sub.status==='building' && sub.plan===key)){
      Installments.start(key, mode);
      sub = Store.subscription;
    }
    const paid = sub.paidAmount||0;
    const pendingAmt = sub.pendingAmount||0;
    const remaining = Math.max(0, plan.price - paid - pendingAmt);
    let amount = remaining;
    if(mode==='daily'){
      const input = document.getElementById('sub-daily-amount');
      const raw = input ? String(input.value).replace(',', '.') : '0';
      amount = Math.round(Number(raw)||0);
      if(amount<=0){ Toast.show('Indiquez le montant payé aujourd’hui'); return; }
      amount = Math.min(amount, remaining);
    }
    if(amount<=0){ Toast.show('Ce montant a déjà été réglé.'); return; }
    this._pendingProof = { type:'installment', key, mode, amount };
    const input = document.getElementById('sub-proof-input');
    if(input){ input.value=''; input.click(); }
  },
  startCommissionProof(){
    const due = Store.commissionDue();
    if(due<=0){ Toast.show('Aucune commission à régler pour le moment'); return; }
    this._pendingProof = { type:'commission', amount:due };
    const input = document.getElementById('sub-proof-input');
    if(input){ input.value=''; input.click(); }
  },
  startSubCommissionProof(){
    const due = Store.subCommissionDue();
    if(due<=0){ Toast.show('Aucune commission à régler pour le moment'); return; }
    this._pendingProof = { type:'subCommission', amount:due };
    const input = document.getElementById('sub-proof-input');
    if(input){ input.value=''; input.click(); }
  },
  handleProofFile(evt){
    const file = evt.target.files && evt.target.files[0];
    const pending = this._pendingProof;
    if(!file || !pending){ return; }
    const statusEl = document.getElementById('sub-proof-status');
    const store = Store.store;
    let msg, waLink;
    if(pending.type==='commission'){
      Store.commissionSettled = true;
      msg = `Bonjour SIAMS, je viens de régler ma commission période d'essai de ${Utils.fmtFCFA(pending.amount)}. Boutique : ${store.name}${store.loginId?' — '+store.loginId:''}. Voici ma preuve de paiement (${file.name}).`;
      waLink = PAYMENT_INFO.contactClientWaLink+'?text='+encodeURIComponent(msg);
      Toast.show(`📎 « ${file.name} » sélectionné — ouverture de WhatsApp pour l'envoi`);
      if(statusEl) statusEl.textContent = `Requête en cours : je viens de régler ma commission — joignez « ${file.name} » dans WhatsApp puis envoyez.`;
      this.render();
    } else if(pending.type==='subCommission'){
      Store.markSubCommissionSettled();
      msg = `Bonjour SIAMS, je viens de régler ma commission d'abonnement (2%) de ${Utils.fmtFCFA(pending.amount)}. Boutique : ${store.name}${store.loginId?' — '+store.loginId:''}. Voici ma preuve de paiement (${file.name}).`;
      waLink = PAYMENT_INFO.contactClientWaLink+'?text='+encodeURIComponent(msg);
      Toast.show(`📎 « ${file.name} » sélectionné — ouverture de WhatsApp pour l'envoi`);
      if(statusEl) statusEl.textContent = `Requête en cours : je viens de régler ma commission d'abonnement — joignez « ${file.name} » dans WhatsApp puis envoyez.`;
      this.render();
    } else {
      const plan = SUBSCRIPTION_PLANS.find(p=>p.key===pending.key);
      if(!plan) return;
      Installments.declare(pending.amount);
      msg = `Bonjour SIAMS, je viens d'effectuer mon paiement d'abonnement ${plan.label} (${pending.mode==='daily'?'versement journalier':'paiement mensuel'} de ${Utils.fmtFCFA(pending.amount)}). Boutique : ${store.name}${store.loginId?' — '+store.loginId:''}. Voici ma preuve de paiement (${file.name}).`;
      waLink = PAYMENT_INFO.contactClientWaLink+'?text='+encodeURIComponent(msg);
      if(statusEl) statusEl.textContent = `Requête en cours : je viens d'effectuer mon abonnement — joignez « ${file.name} » dans WhatsApp puis envoyez.`;
      Toast.show(`📎 « ${file.name} » sélectionné — ouverture de WhatsApp pour l'envoi`);
    }
    window.open(waLink, '_blank');
    this._pendingProof = null;
    subPaymentStep = null;
    subDemoSeen = false;
    subPaymentMode = null;
    subCommissionOnlyMode = false;
    setTimeout(()=>{ this.close(); if(Router.current) Router.go(Router.current); }, 1200);
  },
  /* ---- Le vendeur confirme avoir viré la commission (en plus de l'abonnement) ---- */
  markCommissionSettled(){
    this.startCommissionProof();
  },
  markSubCommissionSettled(){
    this.startSubCommissionProof();
  },
  submitInstallment(key, mode){
    const plan = SUBSCRIPTION_PLANS.find(p=>p.key===key);
    if(!plan) return;
    /* ---- Garde-fou : si le versement échelonné n'a pas (encore) démarré côté Store
       (état perdu/désynchronisé), on l'amorce ici pour que le bouton ne reste jamais
       sans effet. ---- */
    let sub = Store.subscription;
    if(!(sub.status==='building' && sub.plan===key)){
      Installments.start(key, mode);
      sub = Store.subscription;
    }
    const paid = sub.paidAmount||0;
    const pendingAmt = sub.pendingAmount||0;
    const remaining = Math.max(0, plan.price - paid - pendingAmt);
    let amount = remaining;
    if(mode==='daily'){
      const input = document.getElementById('sub-daily-amount');
      const raw = input ? String(input.value).replace(',', '.') : '0';
      amount = Math.round(Number(raw)||0);
      if(amount<=0){ Toast.show('Indiquez le montant payé aujourd’hui'); return; }
      amount = Math.min(amount, remaining);
    }
    if(amount<=0){ Toast.show('Ce montant a déjà été réglé.'); return; }
    Installments.declare(amount);
    window.open(Installments.waLink(plan, amount, mode), '_blank');
    Toast.show('✅ Versement déclaré, envoyez votre capture sur WhatsApp');
    subPaymentStep = null;
    subDemoSeen = false;
    subPaymentMode = null;
    subCommissionOnlyMode = false;
    this.close();
    if(Router.current) Router.go(Router.current);
  }
};



/* ---------- Retrait de solde (analyse, rapport, paiement, reçu) ---------- */
const Withdraw = {
  step: 'idle',
  amount: 0,
  recommended: 0,
  reserve: 0,
  method: '',
  restockSuggestions: [],
  lastRecord: null,

  open(){
    const balance = Store.availableBalance();
    if(balance <= 0){ Toast.show('Aucune espèce en attente de reversement pour le moment'); return; }
    this.step = 'analyzing';
    this.mount();
    setTimeout(()=>{ this.buildReport(); this.step = 'report'; this.render(); }, 1900);
  },

  buildReport(){
    const balance = Store.availableBalance();
    this.reserve = Math.round(balance * 0.15);
    this.recommended = Math.max(0, balance - this.reserve);
    this.amount = this.recommended;
    this.restockSuggestions = this.computeRestockSuggestions();
    const pay = Store.payment;
    const methods = ['wave','om','mtn','moov'].filter(k=>pay[k].enabled && pay[k].number);
    this.method = methods[0] || '';
  },

  computeRestockSuggestions(){
    const tally = {};
    Store.orders.forEach(o=>(o.items||[]).forEach(it=>{
      if(!it.productId) return;
      tally[it.productId] = (tally[it.productId]||0) + it.qty;
    }));
    return Store.products.map(p=>{
      const sold = tally[p.id] || 0;
      const rating = Store.avgRating(p.id);
      const lowStock = !!(p.stockLimited && Number(p.stockQty||0) <= 3);
      const score = sold*2 + (rating ? rating.avg*rating.count*0.5 : 0) + (lowStock?5:0);
      const reasons = [];
      if(sold>0) reasons.push(`${sold} vendu${sold>1?'s':''}`);
      if(rating && rating.avg>=4) reasons.push(`★ ${rating.avg.toFixed(1)}`);
      if(lowStock) reasons.push('Stock bas');
      return {product:p, score, reasons};
    }).filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,4);
  },

  /* ---- Reçus de virement livreur en attente de confirmation : affichés en tête du
     rapport pour que la boutique les traite avant même de calculer son propre retrait. ---- */
  renderPendingCourierReceipts(){
    const pending = Store.pendingCourierReceipts();
    if(!pending.length) return '';
    return `<div class="sub-label">Reçus de virement livreurs à confirmer</div>
    <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:14px;">
      ${pending.map(p=>`
        <div style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:11px 13px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
            <div><b style="font-size:12.5px;">${Utils.escapeHtml(p.courierName)}</b><div style="font-size:11px;color:var(--text-mid);margin-top:1px;">Commande #${Utils.escapeHtml(p.orderNumber)} · ${Utils.fmtFCFA(p.amount)}</div></div>
          </div>
          ${p.receipt_url?`<a href="${Utils.escapeHtml(p.receipt_url)}" target="_blank"><img src="${Utils.escapeHtml(p.receipt_url)}" style="width:100%;max-width:220px;border-radius:10px;border:1px solid var(--line);display:block;margin-bottom:9px;"></a>`:''}
          <button class="btn btn-primary btn-sm btn-block" onclick="Withdraw.confirmCourierReceipt('${Utils.escapeHtml(p.order_id)}')">✓ Confirmer la réception</button>
        </div>`).join('')}
    </div>`;
  },
  async confirmCourierReceipt(orderId){
    try{
      await Cloud.confirmCourierPayout(orderId);
      Toast.show('Réception confirmée ✓ Solde du livreur remis à zéro');
      this.buildReport();
      this.render();
    }catch(e){
      console.error('Confirmation reçu livreur',e);
      Toast.show('⚠️ '+((e&&e.message)||'Impossible de confirmer la réception'));
    }
  },

  mount(){
    const existing = document.getElementById('withdraw-wrap');
    if(existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.id = 'withdraw-wrap';
    document.body.appendChild(wrap);
    this.render();
    requestAnimationFrame(()=>{
      const ov = document.getElementById('withdraw-overlay'), sh = document.getElementById('withdraw-sheet');
      if(ov) ov.classList.add('show');
      if(sh) sh.classList.add('show');
    });
  },

  close(){
    const ov = document.getElementById('withdraw-overlay'), sh = document.getElementById('withdraw-sheet');
    if(ov) ov.classList.remove('show');
    if(sh) sh.classList.remove('show');
    setTimeout(()=>{ const w = document.getElementById('withdraw-wrap'); if(w) w.remove(); if(Router.current==='dashboard') Router.go('dashboard'); }, 220);
  },

  render(){
    const wrap = document.getElementById('withdraw-wrap');
    if(!wrap) return;
    wrap.innerHTML = `
      <div class="shop-sheet-overlay" id="withdraw-overlay" onclick="${this.step==='processing'?'':'Withdraw.close()'}"></div>
      <div class="shop-sheet" id="withdraw-sheet" style="max-height:88vh;">
        <div class="sheet-handle"></div>
        ${this['_render_'+this.step] ? this['_render_'+this.step]() : ''}
      </div>`;
    if(this.step==='report') this.recalc();
  },

  _render_analyzing(){
    return `
      <div style="padding:30px 4px 10px;text-align:center;">
        <div class="wd-spinner"></div>
        <h3 style="margin:18px 0 6px;">Analyse en cours</h3>
        <p style="color:var(--text-mid);font-size:13.5px;line-height:1.6;margin:0;">
          Nous calculons les espèces encaissées par vos livreurs sur vos commandes payées à<br>la livraison, pour préparer un rapport de reversement fiable et précis.
        </p>
      </div>`;
  },

  _render_report(){
    const balance = Store.availableBalance();
    const pay = Store.payment;
    const methods = [
      pay.wave.enabled && pay.wave.number ? {key:'wave', label:'Wave', number:pay.wave.number} : null,
      pay.om.enabled && pay.om.number ? {key:'om', label:'Orange Money', number:pay.om.number} : null,
      pay.mtn.enabled && pay.mtn.number ? {key:'mtn', label:'MTN Money', number:pay.mtn.number} : null,
      pay.moov.enabled && pay.moov.number ? {key:'moov', label:'Moov Money', number:pay.moov.number} : null,
    ].filter(Boolean);
    return `
      <h3 style="margin:2px 0 4px;">Rapport de reversement</h3>
      <p style="color:var(--text-mid);font-size:12.5px;margin:0 0 14px;">Espèces encaissées par vos livreurs à la livraison, en attente de vous être reversées</p>

      <div style="background:var(--indigo-tint);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>Espèces en attente de reversement</span><span class="mono" style="font-weight:700;">${Utils.fmtFCFA(balance)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:var(--text-mid);"><span>Réserve conseillée (réapprovisionnement)</span><span class="mono">${Utils.fmtFCFA(this.reserve)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;color:var(--indigo);"><span>Montant recommandé</span><span class="mono">${Utils.fmtFCFA(this.recommended)}</span></div>
      </div>
      ${this.renderPendingCourierReceipts()}

      ${this.restockSuggestions.length ? `
      <div class="sub-label">Articles conseillés à précommander</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
        ${this.restockSuggestions.map(s=>`
          <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:var(--radius-sm);padding:9px 11px;">
            <div class="product-thumb" style="width:36px;height:36px;">${s.product.photo?`<img src="${s.product.photo}">`:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 8 12 3l9 5-9 5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`}</div>
            <div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(s.product.name)}</div><div style="font-size:11px;color:var(--text-mid);">${s.reasons.join(' · ')}</div></div>
          </div>`).join('')}
      </div>` : ''}

      <div class="sub-label">Montant à faire reverser</div>
      <div class="field" style="margin-bottom:2px;">
        <div class="price-field"><input id="wd-amount" type="number" inputmode="numeric" value="${this.amount}" oninput="Withdraw.onAmountInput(this.value)"><div class="price-suffix">FCFA</div></div>
      </div>
      <div id="wd-amount-msg" style="font-size:12px;color:var(--text-mid);margin-bottom:14px;">Maximum disponible : ${Utils.fmtFCFA(balance)}</div>

      <div class="sub-label">Comment le livreur vous reverse cet argent</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:8px;">
        ${methods.length===0 ? `<div style="font-size:13px;color:var(--text-mid);">Aucun moyen de paiement mobile configuré. <a href="javascript:void(0)" onclick="Withdraw.close();Router.go('payment');" style="color:var(--indigo);font-weight:700;">Ajouter un moyen de paiement</a></div>` :
          methods.map(m=>`
          <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1.5px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;cursor:pointer;">
            <span style="display:flex;align-items:center;gap:10px;"><input type="radio" name="wd-method" value="${m.key}" ${this.method===m.key?'checked':''} onchange="Withdraw.method='${m.key}'" style="width:18px;height:18px;accent-color:var(--indigo);"><span style="font-size:14px;font-weight:700;">${m.label}</span></span>
            <span class="mono" style="font-size:12px;color:var(--text-mid);">${Utils.escapeHtml(m.number)}</span>
          </label>`).join('')}
      </div>
      <div style="font-size:11.5px;color:var(--text-soft);margin-bottom:8px;">Le livreur vous transfère lui-même ce montant sur le numéro choisi, ou vous le remet en cash. SIAMS ne fait que garder la trace de ce reversement.</div>

      <button class="btn btn-mango btn-block" style="margin-top:14px;" onclick="Withdraw.confirm()" ${methods.length===0?'disabled':''}>Confirmer le reversement</button>
    `;
  },

  onAmountInput(v){
    this.amount = Number(v)||0;
    this.recalc();
  },
  recalc(){
    const el = document.getElementById('wd-amount-msg');
    if(!el) return;
    const balance = Store.availableBalance();
    if(this.amount > balance) el.innerHTML = `<span style="color:var(--red);">Le montant dépasse votre solde disponible (${Utils.fmtFCFA(balance)})</span>`;
    else if(this.amount <= 0) el.innerHTML = `<span style="color:var(--red);">Indiquez un montant supérieur à 0</span>`;
    else el.textContent = `Maximum disponible : ${Utils.fmtFCFA(balance)}`;
  },

  confirm(){
    const balance = Store.availableBalance();
    if(!this.amount || this.amount <= 0){ Toast.show('Indiquez un montant valide'); return; }
    if(this.amount > balance){ Toast.show('Montant supérieur au solde disponible'); return; }
    if(!this.method){ Toast.show('Choisissez une modalité de paiement'); return; }
    this.step = 'processing';
    this.render();
    setTimeout(()=>this.finish(), 1800);
  },

  finish(){
    const pay = Store.payment;
    const number = pay[this.method] ? pay[this.method].number : '';
    const record = {
      id: 'REV-' + Date.now().toString(36).toUpperCase(),
      amount: this.amount,
      method: this.method,
      methodLabel: {wave:'Wave', om:'Orange Money', mtn:'MTN Money'}[this.method] || this.method,
      number,
      date: Date.now()
    };
    const list = Store.withdrawals;
    list.unshift(record);
    Store.withdrawals = list;
    Notify.add('order', `Reversement de ${Utils.fmtFCFA(record.amount)} enregistré ✓`);
    this.lastRecord = record;
    this.step = 'success';
    this.render();
  },

  _render_processing(){
    return `
      <div style="padding:30px 4px 10px;text-align:center;">
        <div class="wd-spinner"></div>
        <h3 style="margin:18px 0 6px;">Enregistrement en cours</h3>
        <p style="color:var(--text-mid);font-size:13.5px;line-height:1.6;margin:0;">Enregistrement du reversement...<br>Merci de patienter, ne fermez pas cette fenêtre.</p>
      </div>`;
  },

  _render_success(){
    const r = this.lastRecord;
    const store = Store.store;
    const email = Store.contactEmail;
    return `
      <div style="text-align:center;padding:6px 2px 2px;">
        <div style="width:64px;height:64px;border-radius:18px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-11" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h3 style="margin:0 0 4px;">Reversement enregistré ✓</h3>
        <p style="color:var(--text-mid);font-size:13px;margin:0 0 16px;">Ce reversement a bien été enregistré dans votre suivi.</p>
      </div>

      <div id="wd-receipt" style="border:1.5px solid var(--line);border-radius:var(--radius-md);padding:16px 18px;margin-bottom:14px;">
        <div style="text-align:center;margin-bottom:10px;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:.5px;color:var(--indigo);">SIAMS PROTOTYPE</div>
          <div style="font-size:11px;color:var(--text-mid);">Reçu de reversement — ${Utils.escapeHtml(store.name)}</div>
        </div>
        <div style="border-top:1px dashed var(--line);margin:10px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span style="color:var(--text-mid);">N° reversement</span><span class="mono">${r.id}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span style="color:var(--text-mid);">Date</span><span class="mono">${new Date(r.date).toLocaleString('fr-FR')}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span style="color:var(--text-mid);">Modalité</span><span>${r.methodLabel}${r.number?' · '+Utils.escapeHtml(r.number):''}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span style="color:var(--text-mid);">Statut</span><span style="color:var(--green);font-weight:700;">Enregistré</span></div>
        <div style="border-top:1px dashed var(--line);margin:10px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;"><span>Montant reversé</span><span class="mono">${Utils.fmtFCFA(r.amount)}</span></div>
      </div>

      ${email ? `<div style="font-size:12.5px;color:var(--text-mid);margin-bottom:14px;">Un reçu a été envoyé à <strong>${Utils.escapeHtml(email)}</strong>${store.phone?` et sur WhatsApp <strong>${Utils.escapeHtml(store.phone)}</strong>`:''}.</div>` : `
      <div class="field" style="margin-bottom:14px;">
        <label>Email pour recevoir vos reçus (facultatif)</label>
        <div style="display:flex;gap:8px;">
          <input id="wd-email" type="email" placeholder="votre@email.com" style="flex:1;">
          <button class="btn btn-outline btn-sm" onclick="Withdraw.saveEmail()" style="flex:none;">Ajouter</button>
        </div>
      </div>`}

      <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="Withdraw.printReceipt()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>Imprimer / Enregistrer le reçu</button>
      <button class="btn btn-ghost btn-block" onclick="Withdraw.close()">Fermer</button>
    `;
  },

  saveEmail(){
    const el = document.getElementById('wd-email');
    const val = el ? el.value.trim() : '';
    if(!val || !val.includes('@')){ Toast.show('Indiquez un email valide'); return; }
    Store.contactEmail = val;
    Toast.show('Email enregistré ✓');
    this.render();
  },

  printReceipt(){
    const r = this.lastRecord;
    if(!r) return;
    const store = Store.store;
    const w = window.open('', '_blank', 'width=420,height=640');
    if(!w){ Toast.show('Autorisez les pop-ups pour imprimer le reçu'); return; }
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Reçu ${r.id}</title>
      </head><body>
      <div class="h"><div class="co">SIAMS PROTOTYPE</div><div class="sub">Reçu de transaction — \${Utils.escapeHtml(store.name)}</div></div>
      <hr>
      <div class="row"><span class="lbl">N° transaction</span><span>\${r.id}</span></div>
      <div class="row"><span class="lbl">Date</span><span>\${new Date(r.date).toLocaleString('fr-FR')}</span></div>
      <div class="row"><span class="lbl">Boutique</span><span>\${Utils.escapeHtml(store.name)}</span></div>
      <div class="row"><span class="lbl">Modalité</span><span>\${r.methodLabel}\${r.number?' · '+Utils.escapeHtml(r.number):''}</span></div>
      <div class="row"><span class="lbl">Statut</span><span class="status">Effectué</span></div>
      <hr>
      <div class="total"><span>Montant retiré</span><span>\${Utils.fmtFCFA(r.amount)}</span></div>
</body>
</html>`);
    w.document.close();
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 350);
  }
};


<!-- ================= SIAMS V51 — son notifications livreur renforcé ================= -->
