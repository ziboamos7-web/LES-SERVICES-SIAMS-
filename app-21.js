/* SIAMS V48 — fiabilisation des commandes client ↔ marchand et des reçus.
   Objectif : une commande validée ne doit jamais disparaître du client si une
   lecture publique Supabase renvoie une liste vide, et le marchand ne doit pas
   recevoir une confirmation locale avant la fin de l'écriture serveur. */
(function(){
  const CLIENT_ORDER_KEY = ()=> 'siams_client_orders_' + ((Store.store&&Store.store.slug)||'default');

  window.ClientOrderCache = window.ClientOrderCache || {
    load(){
      try{ return JSON.parse(localStorage.getItem(CLIENT_ORDER_KEY())||'[]'); }
      catch(e){ return []; }
    },
    save(order){
      try{
        const list=this.load().filter(o=>o&&o.id!==order.id);
        list.unshift(JSON.parse(JSON.stringify(order)));
        localStorage.setItem(CLIENT_ORDER_KEY(),JSON.stringify(list.slice(0,30)));
      }catch(e){ console.warn('ClientOrderCache.save',e); }
    },
    get(id){
      return this.load().find(o=>String(o.id)===String(id))||null;
    },
    remove(id){
      try{
        const list=this.load().filter(o=>String(o.id)!==String(id));
        localStorage.setItem(CLIENT_ORDER_KEY(),JSON.stringify(list));
      }catch(e){}
    }
  };

  /* La lecture cloud publique peut légalement retourner zéro ligne lorsque les
     policies RLS ne permettent pas de lire orders côté client. On fusionne alors
     le cache local sans écraser une commande déjà mise à jour côté serveur. */
  const originalLoadAll=Cloud.loadAll.bind(Cloud);
  Cloud.loadAll=async function(){
    const localBefore=this.publicMode ? ClientOrderCache.load() : [];
    await originalLoadAll();
    if(this.publicMode && localBefore.length){
      const byId=new Map((Store.orders||[]).map(o=>[String(o.id),o]));
      localBefore.forEach(local=>{
        const server=byId.get(String(local.id));
        if(!server){
          byId.set(String(local.id),local);
        }else{
          byId.set(String(local.id),Object.assign({},local,server,{
            items:(server.items&&server.items.length)?server.items:local.items
          }));
        }
      });
      _cache.orders=Array.from(byId.values()).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    }
  };

  /* Si le setter a déjà lancé une écriture cloud, waitForOrderPersisted attend
     cette écriture. Pour une utilisation publique plus sûre, on réessaie aussi
     explicitement si aucun job n'est encore enregistré. */
  const originalWait=Cloud.waitForOrderPersisted.bind(Cloud);
  Cloud.waitForOrderPersisted=async function(orderId){
    if(this._orderWritePromises[orderId]) return originalWait(orderId);
    const local=ClientOrderCache.get(orderId);
    if(!local) return false;
    await this.persistSingleOrder(local);
    return true;
  };

  Cloud.persistSingleOrder=async function(order){
    if(!this.storeId) throw new Error('Boutique non initialisée');
    order.paymentProof = await this.ensureStoredUrl(order.paymentProof, 'payment-proofs');
    order.deliveryPhoto = await this.ensureStoredUrl(order.deliveryPhoto, 'delivery-photos');
    /* Un doublon (code 23505) sur une nouvelle tentative signifie que la
       commande a déjà été enregistrée lors d'un essai précédent : on le
       traite comme un succès plutôt qu'une erreur. On utilise insert() au
       lieu de upsert() : une clause ON CONFLICT DO UPDATE exige que le rôle
       ait aussi le droit SELECT sur la table (même sans conflit réel), ce
       que les clients anonymes n'ont pas — d'où l'échec RLS systématique. */
    const isDuplicateKey = e => e && (e.code==='23505' || /duplicate key/i.test(e.message||''));
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      const {error}=await sb.from('orders').insert({
        id:order.id, store_id:this.storeId, number:order.number,
        customer_name:order.customer?.name||'', customer_phone:order.customer?.phone||'',
        customer_address:order.customer?.address||'',
        customer_latitude:order.customerLat!=null?order.customerLat:null,
        customer_longitude:order.customerLng!=null?order.customerLng:null,
        subtotal:order.amount+(order.discount||0)-(order.deliveryFee||0),
        discount:order.discount||0, promo_code:order.promoCode||null,
        delivery_zone:order.deliveryZone||null, delivery_fee:order.deliveryFee||0,
        amount:order.amount, payment_method:order.paymentMethod||'cash',
        status:order.status||'pending', payment_proof_url:order.paymentProof||null,
        confirmed_at:order.confirmedAt?new Date(order.confirmedAt).toISOString():null,
        shipped:!!order.shipped, shipped_at:order.shippedAt?new Date(order.shippedAt).toISOString():null,
        delivery_confirmed_at:order.deliveryConfirmedAt?new Date(order.deliveryConfirmedAt).toISOString():null,
        delivery_photo_url:order.deliveryPhoto||null, delivery_token:order.deliveryToken||undefined, courier_id:order.courierId||null
      });
      if(!error || isDuplicateKey(error)){
        if(order.items?.length){
          const {error:itemError}=await sb.from('order_items').insert(
            order.items.map(it=>({order_id:order.id,product_id:it.productId||null,name:it.name,price:it.price,qty:it.qty}))
          );
          if(itemError && !isDuplicateKey(itemError)) lastError=itemError; else return true;
        }else return true;
      }else lastError=error;
      if(attempt<3) await new Promise(r=>setTimeout(r,600*attempt));
    }
    throw lastError||new Error('Échec de synchronisation');
  };

  /* Le bouton de reçu peut être utilisé après une actualisation : récupération
     d'abord du cache local, puis du cloud, sans jamais afficher à tort "introuvable". */
  const originalDownload=window.downloadReceiptPDF;
  window.downloadReceiptPDF=async function(orderId){
    let order=Store.orders.find(o=>String(o.id)===String(orderId))||ClientOrderCache.get(orderId);
    if(!order && Cloud.storeId){
      try{
        const {data,error}=await sb.from('orders').select('*').eq('id',orderId).eq('store_id',Cloud.storeId).maybeSingle();
        if(!error&&data){
          order={
            id:data.id,number:data.number,
            customer:{name:data.customer_name,phone:data.customer_phone,address:data.customer_address},
            amount:data.amount,discount:data.discount,deliveryZone:data.delivery_zone,deliveryFee:data.delivery_fee,
            promoCode:data.promo_code,paymentMethod:data.payment_method,status:data.status,
            createdAt:new Date(data.created_at).getTime(),paymentProof:data.payment_proof_url||null,
            confirmedAt:data.confirmed_at?new Date(data.confirmed_at).getTime():0,
            shipped:!!data.shipped,shippedAt:data.shipped_at?new Date(data.shipped_at).getTime():0,
            deliveryConfirmedAt:data.delivery_confirmed_at?new Date(data.delivery_confirmed_at).getTime():0,
            deliveryPhoto:data.delivery_photo_url||null,deliveryToken:data.delivery_token||null,items:[]
          };
          const {data:items}=await sb.from('order_items').select('*').eq('order_id',orderId);
          order.items=(items||[]).map(it=>({productId:it.product_id,name:it.name,price:it.price,qty:it.qty}));
        }
      }catch(e){}
    }
    if(!order){ Toast.show('Commande introuvable'); return; }
    ClientOrderCache.save(order);
    /* Le moteur PDF existant reste inchangé : on lui donne temporairement
       la commande résolue pour éviter toute régression visuelle. */
    const previous=Store.orders;
    if(!previous.some(o=>String(o.id)===String(order.id))) _cache.orders=[order].concat(previous||[]);
    try{ return await originalDownload(order.id); }
    finally{ _cache.orders=previous; }
  };

  /* Sur mobile, un retour d'application peut survenir avant le prochain cycle
     AutoSync. On conserve toujours la dernière commande dans le cache client. */
  const originalAfterConfirmation=Views._after_confirmation;
  Views._after_confirmation=function(opts){
    const order=Store.orders.find(o=>o.number===opts?.orderNumber);
    if(order) ClientOrderCache.save(order);
    if(originalAfterConfirmation) originalAfterConfirmation(opts);
  };

  /* Évite qu'une synchro publique vide ne fasse disparaître immédiatement la
     commande du client. Les vues client restent locales pour leur historique. */
  AutoSync.safeViews.add('shop-account');
  AutoSync.safeViews.add('shop-orders-history');
  AutoSync.safeViews.add('order-track');
})();
