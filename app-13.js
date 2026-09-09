/* SIAMS V50 — notifications client en temps réel + son SIAMS.
   Le client doit recevoir une notification lorsque le marchand confirme ou met
   sa commande en livraison. Le son personnalisé est joué dans l'onglet client
   dès qu'une interaction utilisateur a déverrouillé l'audio du navigateur. */
(function(){
  const WATCH_KEY=()=> 'siams_client_order_status_watch_' + ((Store.store&&Store.store.slug)||'default');
  let seeded=false;
  function loadWatch(){try{return JSON.parse(localStorage.getItem(WATCH_KEY())||'{}')}catch(e){return{}}}
  function saveWatch(x){try{localStorage.setItem(WATCH_KEY(),JSON.stringify(x))}catch(e){}}
  function statusOf(o){return o?.status||'pending'}
  function messageFor(o,prev){
    const n=o.number||'';
    if(statusOf(o)==='confirmed' && statusOf(prev)!=='confirmed') return `Bonne nouvelle : votre commande #${n} a été confirmée par la boutique.`;
    if((o.shipped||statusOf(o)==='delivered') && !(prev&&prev.shipped) && statusOf(o)!=='delivered') return `Votre commande #${n} est maintenant en livraison.`;
    if(statusOf(o)==='delivered' && statusOf(prev)!=='delivered') return `Votre commande #${n} a été livrée. Merci pour votre confiance !`;
    return null;
  }
  function syncClientOrderNotifications(){
    if(!Cloud.publicMode || !window.ClientOrderCache || !window.ClientNotify) return;
    const cached=ClientOrderCache.load();
    if(!cached.length) return;
    const watch=loadWatch();
    let changed=false;
    cached.forEach(local=>{
      const server=(Store.orders||[]).find(o=>String(o.id)===String(local.id));
      if(!server) return;
      const previous=watch[local.id] || {status:statusOf(local),shipped:!!local.shipped};
      const msg=messageFor(server,previous);
      /* Première observation : on initialise sans alerter. */
      if(!seeded && !(local.id in watch)) { watch[local.id]={status:statusOf(server),shipped:!!server.shipped}; changed=true; return; }
      if(msg){
        ClientNotify.add(server.number,msg,statusOf(server)==='delivered'?'delivery':server.shipped?'delivery':'order');
      }
      if(previous.status!==statusOf(server) || previous.shipped!==!!server.shipped){
        watch[local.id]={status:statusOf(server),shipped:!!server.shipped};
        ClientOrderCache.save(Object.assign({},local,server,{items:(server.items&&server.items.length)?server.items:local.items}));
        changed=true;
      }
    });
    seeded=true;
    if(changed) saveWatch(watch);
  }

  /* Chaque rafraîchissement public recharge les commandes puis déclenche la
     détection des changements. Le système reste compatible avec l'AutoSync V48. */
  const oldRefresh=AutoSync.refresh.bind(AutoSync);
  AutoSync.refresh=async function(force){
    const r=await oldRefresh(force);
    try{ syncClientOrderNotifications(); }catch(e){ console.warn('V50 client notifications',e); }
    return r;
  };

  /* Si l'utilisateur ouvre la boutique et interagit immédiatement, on initialise
     aussi le son sans attendre le prochain cycle de synchronisation. */
  setTimeout(()=>{try{syncClientOrderNotifications();}catch(e){}},1400);
})();
