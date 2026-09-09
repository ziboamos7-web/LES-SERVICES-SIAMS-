(function(){
  let courierNotifTimer=null;
  let courierNotifBusy=false;
  let courierSeenAssignments=new Set();

  function courierSignature(a){
    return [a.id,a.status,a.order_number||'',a.updated_at||''].join('|');
  }

  async function pollCourierNotifications(){
    if(courierNotifBusy || Router.current!=='courier-dashboard') return;
    const sess=typeof courierSession==='function'?courierSession():null;
    if(!sess) return;
    courierNotifBusy=true;
    try{
      const rows=await Cloud.courierAssignments(sess.session_token);
      CourierNotify.load();
      const existing=CourierNotify._list||[];
      const existingIds=new Set(existing.map(n=>n.assignmentId).filter(Boolean));
      rows.filter(a=>a.status==='accepted'||a.status==='arrived'||a.status==='delivered').forEach(a=>{
        const sig=courierSignature(a);
        const oldKey='siams_courier_last_state_'+a.id;
        let old='';
        try{old=sessionStorage.getItem(oldKey)||'';}catch(e){}
        if(old && old!==sig){
          if(a.status==='arrived'){
            CourierNotify.add('delivery',`📍 Vous êtes arrivé pour la commande #${a.order_number||''}. En attente de la confirmation du client.`);
            if(typeof nativePush==='function') nativePush('Livreur arrivé',`Commande #${a.order_number||''} : attendez la confirmation du client.`);
          }else if(a.status==='delivered'){
            CourierNotify.add('delivery',`✓ Commande #${a.order_number||''} livrée. Le client a confirmé la réception.`);
            if(typeof nativePush==='function') nativePush('Commande livrée',`Commande #${a.order_number||''} confirmée par le client.`);
          }
        }
        try{sessionStorage.setItem(oldKey,sig);}catch(e){}
      });
      rows.filter(a=>a.status==='offered').forEach(a=>{
        const sig=courierSignature(a);
        const isNew=!courierSeenAssignments.has(sig) && !existingIds.has(a.id);
        if(isNew){
          CourierNotify._list.unshift({
            id:Utils.uid(), assignmentId:a.id, type:'order',
            message:`Nouvelle livraison proposée pour la commande #${a.order_number||''}.`,
            read:false, createdAt:Date.now()
          });
          courierSeenAssignments.add(sig);
          CourierNotify.save();
          CourierNotify.badge();
          /* Son SIAMS + notification système : même comportement que client. */
          if(typeof nativePush==='function') nativePush('Nouvelle livraison',`Commande #${a.order_number||''} proposée.`);
          else if(typeof SiamsV44TestNotificationSound==='function') SiamsV44TestNotificationSound();
          if(typeof Toast!=='undefined' && Toast.show) Toast.show(`🔔 Nouvelle livraison · #${a.order_number||''}`);
        } else if(!courierSeenAssignments.has(sig)) {
          courierSeenAssignments.add(sig);
        }
      });
    }catch(e){console.error('V51 courier notifications',e)}
    finally{courierNotifBusy=false;}
  }

  function startCourierNotificationPolling(){
    if(courierNotifTimer) clearInterval(courierNotifTimer);
    courierSeenAssignments=new Set();
    /* Premier passage immédiat, puis contrôle régulier sans attendre un clic. */
    setTimeout(pollCourierNotifications,500);
    courierNotifTimer=setInterval(pollCourierNotifications,8000);
  }
  function stopCourierNotificationPolling(){
    if(courierNotifTimer){clearInterval(courierNotifTimer);courierNotifTimer=null;}
    courierSeenAssignments=new Set();
  }

  const oldLogin=window.loginCourier;
  if(typeof oldLogin==='function'){
    window.loginCourier=async function(){
      const r=await oldLogin.apply(this,arguments);
      if(courierSession()) startCourierNotificationPolling();
      return r;
    };
  }

  const oldLogout=window.setCourierSession;
  if(typeof oldLogout==='function'){
    window.setCourierSession=function(v){
      const r=oldLogout.apply(this,arguments);
      if(!v) stopCourierNotificationPolling();
      return r;
    };
  }

  const oldGo=Router.go;
  if(typeof oldGo==='function'){
    Router.go=function(name,opts){
      const r=oldGo.apply(this,arguments);
      if(name==='courier-dashboard' && courierSession()) startCourierNotificationPolling();
      else if(name!=='courier-dashboard') stopCourierNotificationPolling();
      return r;
    };
  }

  /* Le bouton de test du son est aussi disponible depuis l'espace livreur. */
  window.SiamsV51TestCourierSound=function(){
    if(typeof unlockNotifAudio==='function') unlockNotifAudio();
    setTimeout(function(){ if(typeof playNotifSound==='function') playNotifSound(); },80);
  };

  setTimeout(function(){if(courierSession() && Router.current==='courier-dashboard')startCourierNotificationPolling();},900);
})();
