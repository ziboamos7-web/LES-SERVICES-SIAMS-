(function(){
  'use strict';

  /* ---------- Badges vitrine client ----------
     Le code calculait le badge avec isPaidSubscriptionActive(), ce qui pouvait
     masquer le badge dans l'aperçu lorsque l'état d'identité/abonnement n'était
     pas encore chargé au même instant. On utilise maintenant access.badge comme
     source d'affichage, sans changer les règles d'accès marchand. */
  const oldShop = Views.shop;
  if(typeof oldShop==='function'){
    Views.shop=function(){
      let html=oldShop.apply(this,arguments);
      try{
        const access=Store.access ? Store.access() : {};
        const badge=access && access.badge;
        if(badge && typeof VerifiedBadge==='function'){
          const plan=access.plan || (
            badge==='GOLDEN'?'golden':
            badge==='PLATINE'?'platinum':
            badge==='TOUTE BOUTIQUE'?'all':
            badge==='DOYA'?'doya':'doyen'
          );
          const chip=VerifiedBadge(16,plan);
          /* Si l'ancien rendu n'a pas affiché de badge, l'ajouter au nom de boutique. */
          if(chip && !/svg[^>]*VerifiedBadge/.test(html) && !html.includes(chip)){
            const safeName=Utils.escapeHtml(Store.store?.name||'Boutique');
            const escapedName=safeName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
            const re=new RegExp('('+escapedName+')(</h1>)');
            if(re.test(html)) html=html.replace(re,'$1'+chip+'$2');
          }
        }
      }catch(e){ console.warn('V62 badge vitrine',e); }
      return html;
    };
  }

  /* ---------- Promo robuste ----------
     Le champ promo a changé d'id plusieurs fois (co-promo / __v46_2).
     La fonction originale ne trouvait donc parfois pas l'input/message.
     On remplace par une version tolérante et on recharge les promos cloud si
     nécessaire avant validation. */
  window.applyPromoCode = async function(){
    const input=document.getElementById('co-promo') || document.getElementById('co-promo__v46_2');
    const msg=document.getElementById('co-promo-msg') || document.getElementById('co-promo-msg__v46_3');
    if(!input || !msg){ Toast.show('Champ code promo introuvable.'); return; }
    const code=(input.value||'').trim().toUpperCase();
    if(!code){ msg.textContent=''; appliedPromo=null; recalcCheckoutTotal(); return; }

    let promos=Store.promos||[];
    try{
      if(!promos.length && Cloud.storeId) await Cloud.loadAll();
    }catch(e){}

    const promo=promos.map(p=>PromoLocal.merge(p)).find(p=>
      String(p.code||'').trim().toUpperCase()===code &&
      p.active!==false &&
      (!Number(p.maxUses||0) || Number(p.usedCount||0)<Number(p.maxUses||0)) &&
      Number(p.value||0)>0
    );
    if(!promo){
      msg.textContent='Code invalide, inactif ou épuisé';
      msg.style.color='var(--red)';
      appliedPromo=null; recalcCheckoutTotal(); return;
    }
    appliedPromo=promo;
    msg.textContent=`✓ Code appliqué : ${promo.type==='percent' ? Number(promo.value)+'% de réduction' : Utils.fmtFCFA(Number(promo.value))+' de réduction'}`;
    msg.style.color='var(--green)';
    recalcCheckoutTotal();
  };

  /* ---------- RPC arrivée ----------
     Le SQL V62 crée courier_mark_arrived. Le livreur ne peut donc plus
     terminer directement la commande : il signale seulement son arrivée. */
  Cloud.courierMarkArrived = async function(sessionToken,assignmentId){
    const {data,error}=await sb.rpc('courier_mark_arrived',{
      p_session_token:sessionToken,
      p_assignment_id:assignmentId
    });
    if(error) throw error;
    return data;
  };

  async function courierArrived(id){
    const sess=courierSession();
    if(!sess){ Toast.show('Session livreur expirée.'); return; }
    const btn=document.querySelector(`[onclick="courierArrived('${id}')"]`);
    if(btn){btn.disabled=true;btn.textContent='Arrivée…';}
    try{
      await Cloud.courierMarkArrived(sess.session_token,id);
      CourierNotify?.add?.('delivery',`Vous êtes arrivé chez le client pour la commande #${(CourierMission.find(id)||{}).order_number||''}.`);
      Toast.show('📍 Arrivée enregistrée ✓ — attente de la confirmation du client');
      await loadCourierDashboard();
      if(CourierMission && CourierMission.openId) CourierMission.refresh();
    }catch(e){
      console.error('courierArrived',e);
      Toast.show('⚠️ '+((e&&e.message)||'Impossible d’enregistrer l’arrivée'));
      if(btn){btn.disabled=false;btn.textContent='📍 Arrivé';}
    }
  }
  window.courierArrived=courierArrived;

  /* Remplace la carte livreur pour distinguer accepted / arrived / delivered. */
  const oldCard=window.courierAssignmentCard;
  if(typeof oldCard==='function'){
    window.courierAssignmentCard=function(a){
      const status=String(a.status||'');
      if(status!=='accepted' && status!=='arrived') return oldCard(a);
      const delivered=status==='delivered';
      const name=Utils.escapeHtml(a.customer_name||'');
      const addr=Utils.escapeHtml(a.customer_address||'');
      return `<div class="courier-card accepted">
        <div class="courier-card-head"><div>
          <div class="courier-card-order">Commande #${Utils.escapeHtml(a.order_number||'')}</div>
          <div class="courier-card-meta">${name} · ${addr}</div>
        </div><span class="courier-card-status accepted">${delivered?'Livrée':status==='arrived'?'Arrivé':'Acceptée'}</span></div>
        <div class="courier-card-info-row">
          <div class="courier-card-info-chip"><span class="ico-round green">${ICO_MONEY_SVG}</span><div class="txt"><b>${a.amount!=null?Utils.fmtFCFA(a.amount):'—'}</b><span>Montant</span></div></div>
          <div class="courier-card-info-chip"><span class="ico-round blue">${ICO_PIN_SVG}</span><div class="txt"><b id="courier-dist-${a.id}">…</b><span>Distance</span></div></div>
        </div>
        <div class="courier-card-actions">
          ${status==='accepted'?`<div class="courier-progress-note">✓ Livraison acceptée. En route vers le client.</div>
            <button class="btn btn-primary btn-courier-primary btn-block" onclick="CourierMission.open('${a.id}')">Voir la mission ›</button>
            <button class="btn btn-soft-indigo btn-block" onclick="startCourierLiveGps('${a.id}')">Démarrer mon GPS</button>
            <button class="btn btn-soft-green btn-block" onclick="courierArrived('${a.id}')">📍 Arrivé chez le client</button>`:''}
          ${status==='arrived'?`<div class="courier-arrived-note">📍 Vous êtes arrivé. La commande sera terminée uniquement lorsque le client confirme la réception.</div>
            <button class="btn btn-primary btn-courier-primary btn-block" onclick="CourierMission.open('${a.id}')">Voir la mission ›</button>`:''}
          <button class="btn btn-outline btn-block" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((a.customer_latitude||'')+','+(a.customer_longitude||'')),'_blank')">Itinéraire</button>
        </div>
      </div>`;
    };
  }

  /* ---------- Mission plein écran : bandeau + carte live (Leaflet/OSM) + fiche client
     façon "Track Package". La carte n'est initialisée qu'après insertion du HTML dans
     le DOM (CourierMission.open/refresh sont enveloppés plus bas pour appeler
     CourierMission._initMap juste après avoir posé le innerHTML). ---------- */
  if(typeof CourierMission!=='undefined'){
    const oldRender=CourierMission._render.bind(CourierMission);
    CourierMission._render=function(a){
      const status=String(a.status||'');
      if(status!=='accepted' && status!=='arrived') return oldRender(a);
      const name=Utils.escapeHtml(a.customer_name||'Client');
      const addr=Utils.escapeHtml(a.customer_address||'Adresse non renseignée');
      const phone=(a.customer_phone||'').trim();
      const gpsOn=courierWatchId!==null && String(courierTrackingId)===String(a.id);
      const mapsUrl='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((a.customer_latitude||'')+','+(a.customer_longitude||''));
      const initials=(a.customer_name||'C').trim().split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'C';
      const hasGeo=a.customer_latitude!=null && a.customer_longitude!=null;
      return `<div class="courier-mission-head">
        <div class="courier-mission-head-row">
          <button class="courier-mission-back" onclick="CourierMission.close()" aria-label="Retour">←</button>
          <div><div class="courier-mission-title">Commande #${Utils.escapeHtml(a.order_number||'')}</div>
          <div class="courier-mission-sub">${status==='arrived'?'Arrivé chez le client':'Livraison en cours'}</div></div>
        </div>
        <div class="courier-mission-steps">
          <div class="courier-mission-step done"><div class="courier-mission-step-dot">✓</div><span>Acceptée</span></div>
          <div class="courier-mission-step-line done"></div>
          <div class="courier-mission-step ${status==='arrived'?'done':'current'}"><div class="courier-mission-step-dot">${status==='arrived'?'✓':'2'}</div><span>${status==='arrived'?'Arrivé':'En route'}</span></div>
          <div class="courier-mission-step-line ${status==='arrived'?'done':''}"></div>
          <div class="courier-mission-step"><div class="courier-mission-step-dot">3</div><span>Client confirme</span></div>
        </div>
      </div>
      <div class="courier-track-map-wrap">
        <div class="courier-track-map-badge ${gpsOn?'':'off'}"><span class="dot"></span>${gpsOn?'GPS en direct':'GPS non démarré'}</div>
        ${hasGeo?`<div class="courier-track-eta-badge" id="courier-mission-dist">…</div>`:''}
        <div id="courier-mission-map" class="courier-track-map loading"></div>
      </div>
      <div class="courier-mission-body" style="padding-top:0;">
        <div class="courier-track-card">
          <div class="courier-track-card-top">
            <div class="courier-track-avatar">${Utils.escapeHtml(initials)}</div>
            <div class="courier-track-id">
              <div class="courier-track-name">${name}</div>
              <div class="courier-track-sub">📍 ${addr}</div>
            </div>
            <div class="courier-track-contact">
              ${phone?`<a class="call" href="tel:${Utils.escapeHtml(phone)}" aria-label="Appeler">${typeof ICO_PHONE_SVG!=='undefined'?ICO_PHONE_SVG:'📞'}</a><a class="msg" href="https://wa.me/${Utils.escapeHtml(phone.replace(/\\D/g,''))}" target="_blank" aria-label="WhatsApp">💬</a>`:''}
            </div>
          </div>
          <div class="courier-track-status-row ${status==='arrived'?'done':''}">
            ${status==='arrived'?'📍 Arrivé — en attente de confirmation du client':'🛵 En route vers le client'}
          </div>
          <div class="courier-track-route">
            <div class="courier-track-route-rail"><span class="rdot a"></span><span class="rline"></span><span class="rdot b"></span></div>
            <div class="courier-track-route-pts">
              <div class="courier-track-route-pt"><span>Départ</span><b>Votre position (GPS)</b></div>
              <div class="courier-track-route-pt"><span>Arrivée</span><b>${addr}</b></div>
            </div>
          </div>
          <div class="courier-track-foot">
            <div class="courier-track-foot-chip">Commande <b>#${Utils.escapeHtml(a.order_number||'')}</b></div>
            <div class="courier-track-foot-amount">${a.amount!=null?Utils.fmtFCFA(a.amount):'—'}</div>
          </div>
        </div>
        ${status==='arrived'?`<div class="courier-arrived-note">📍 Arrivée enregistrée. Demandez au client de confirmer la réception depuis son téléphone.</div>`:''}
      </div>
      <div class="courier-mission-actions">
        <button class="btn btn-outline btn-block" onclick="window.open('${mapsUrl}','_blank')">Itinéraire (Google Maps)</button>
        <button class="btn btn-soft-indigo btn-block" onclick="startCourierLiveGps('${a.id}')">${gpsOn?'GPS actif — relancer':'Démarrer mon GPS'}</button>
        ${status==='accepted'?`<button class="btn btn-primary btn-courier-primary btn-block" onclick="courierArrived('${a.id}')">📍 Je suis arrivé</button>`:`<button class="btn btn-outline btn-block" onclick="CourierMission.close()">Attendre la confirmation du client</button>`}
      </div>`;
    };

    /* ---- Cycle de vie de la carte Leaflet : init après insertion du DOM, mise à jour
       légère de la position sans tout re-rendre, nettoyage à la fermeture. ---- */
    let courierMissionMapObj=null, courierMissionCourierMarker=null, courierMissionClientMarker=null, courierMissionRouteLine=null;
    let courierMissionRouteFetchAt=0;
    window.courierLastGpsCoords=window.courierLastGpsCoords||null;

    CourierMission._destroyMap=function(){
      if(courierMissionMapObj){ try{courierMissionMapObj.remove();}catch(e){} }
      courierMissionMapObj=null; courierMissionCourierMarker=null; courierMissionClientMarker=null; courierMissionRouteLine=null;
    };

    CourierMission._drawRoute=function(lat1,lng1,lat2,lng2){
      const map=courierMissionMapObj; if(!map) return;
      const drawStraight=()=>{
        if(courierMissionRouteLine){ try{map.removeLayer(courierMissionRouteLine);}catch(e){} }
        courierMissionRouteLine=L.polyline([[lat1,lng1],[lat2,lng2]],{color:'#ff7a00',weight:4,opacity:.85,dashArray:'2 10',lineCap:'round'}).addTo(map);
      };
      const now=Date.now();
      if(now-courierMissionRouteFetchAt<15000){ if(!courierMissionRouteLine) drawStraight(); return; }
      courierMissionRouteFetchAt=now;
      fetch(`https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`)
        .then(r=>r.ok?r.json():Promise.reject())
        .then(d=>{
          const coords=d && d.routes && d.routes[0] && d.routes[0].geometry && d.routes[0].geometry.coordinates;
          if(!coords || !coords.length) return drawStraight();
          const latlngs=coords.map(c=>[c[1],c[0]]);
          if(courierMissionRouteLine){ try{map.removeLayer(courierMissionRouteLine);}catch(e){} }
          courierMissionRouteLine=L.polyline(latlngs,{color:'#ff7a00',weight:5,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(map);
        })
        .catch(drawStraight);
    };

    CourierMission._initMap=function(a){
      const mapEl=document.getElementById('courier-mission-map');
      if(!mapEl || typeof L==='undefined') return;
      CourierMission._destroyMap();
      mapEl.classList.remove('loading');
      const clientLat=Number(a.customer_latitude), clientLng=Number(a.customer_longitude);
      const hasClient=isFinite(clientLat) && isFinite(clientLng);
      const start=window.courierLastGpsCoords;
      const center = start?[start.lat,start.lng]:(hasClient?[clientLat,clientLng]:[5.3599,-4.0083]);
      const map=L.map(mapEl,{zoomControl:false,attributionControl:false}).setView(center,14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
      courierMissionMapObj=map;
      if(hasClient) courierMissionClientMarker=L.marker([clientLat,clientLng],{icon:L.divIcon({className:'',html:'<div class="cm-pin cm-pin-client"><span>🏠</span></div>',iconSize:[32,32],iconAnchor:[16,32]})}).addTo(map);
      if(start) courierMissionCourierMarker=L.marker([start.lat,start.lng],{icon:L.divIcon({className:'',html:'<div class="cm-pin cm-pin-courier"><span>🛵</span></div>',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map);
      if(hasClient && start){
        map.fitBounds(L.latLngBounds([[start.lat,start.lng],[clientLat,clientLng]]),{padding:[44,44]});
        CourierMission._drawRoute(start.lat,start.lng,clientLat,clientLng);
      }
      CourierMission._updateDistanceBadge(a);
      setTimeout(()=>{ try{map.invalidateSize();}catch(e){} },80);
    };

    CourierMission._updateDistanceBadge=function(a){
      const el=document.getElementById('courier-mission-dist'); if(!el) return;
      const start=window.courierLastGpsCoords;
      const clientLat=Number(a.customer_latitude), clientLng=Number(a.customer_longitude);
      if(!start || !isFinite(clientLat) || !isFinite(clientLng)){ el.textContent='—'; return; }
      const km=courierHaversineKm(start.lat,start.lng,clientLat,clientLng);
      el.textContent = km<1 ? Math.round(km*1000)+' m' : km.toFixed(1)+' km';
    };

    CourierMission.updateCourierPosition=function(lat,lng){
      window.courierLastGpsCoords={lat,lng};
      const map=courierMissionMapObj; if(!map) return;
      if(courierMissionCourierMarker) courierMissionCourierMarker.setLatLng([lat,lng]);
      else courierMissionCourierMarker=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="cm-pin cm-pin-courier"><span>🛵</span></div>',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map);
      const a=CourierMission.find(CourierMission.openId);
      if(a){
        CourierMission._updateDistanceBadge(a);
        const clientLat=Number(a.customer_latitude), clientLng=Number(a.customer_longitude);
        if(isFinite(clientLat) && isFinite(clientLng)) CourierMission._drawRoute(lat,lng,clientLat,clientLng);
      }
    };

    const oldOpen=CourierMission.open.bind(CourierMission);
    CourierMission.open=function(id){
      oldOpen(id);
      const a=CourierMission.find(id);
      if(a && (a.status==='accepted'||a.status==='arrived')) setTimeout(()=>CourierMission._initMap(a),30);
    };
    const oldRefresh=CourierMission.refresh.bind(CourierMission);
    CourierMission.refresh=function(){
      oldRefresh();
      if(!CourierMission.openId) return;
      const a=CourierMission.find(CourierMission.openId);
      if(a && (a.status==='accepted'||a.status==='arrived')) setTimeout(()=>CourierMission._initMap(a),30);
    };
    const oldClose=CourierMission.close.bind(CourierMission);
    CourierMission.close=function(){ CourierMission._destroyMap(); oldClose(); };
  }

  /* ---------- Empêche l'ancien bouton livreur "Marquer livrée" d'apparaître. */
  window.courierDelivered = async function(id){
    Toast.show('La livraison ne peut plus être clôturée par le livreur. Le client doit confirmer la réception.');
  };

  /* ---------- Client : afficher le bouton de confirmation après "arrivé". */
  const oldTrack=Views['order-track'];
  if(typeof oldTrack==='function'){
    Views['order-track']=function(opts){
      let html=oldTrack.apply(this,arguments);
      try{
        const order=Store.orders.find(o=>String(o.id)===String(opts?.id));
        if(order && order.status!=='delivered' && order.shipped && order.delivery_arrived_at){
          const marker='</div>';
          const box=`<div class="client-confirm-delivery">
            <div style="font-weight:800;font-size:13.5px;">📍 Votre livreur est arrivé</div>
            <div style="font-size:12px;color:var(--text-mid);margin-top:4px;line-height:1.45;">Vérifiez votre commande puis confirmez la réception. Une fois confirmée, le livreur et la boutique seront automatiquement informés.</div>
            <div style="margin-top:10px;"><button class="btn btn-primary btn-block" onclick="confirmDeliveryFromClient('${order.id}')">✓ Confirmer la réception</button></div>
          </div>`;
          const pos=html.indexOf('<div style="padding:0 20px 20px;">');
          html=pos>=0?html.slice(0,pos)+box+html.slice(pos):box+html;
        }
      }catch(e){console.warn('V62 order track',e)}
      return html;
    };
  }

  window.confirmDeliveryFromClient=async function(orderId){
    const order=Store.orders.find(o=>String(o.id)===String(orderId));
    if(!order){Toast.show('Commande introuvable');return;}
    if(order.status==='delivered'){Toast.show('Cette commande est déjà livrée.');return;}
    if(!order.deliveryToken){
      const t=await ensureDeliverySecurityToken(order);
      if(!t){Toast.show('Impossible de sécuriser la confirmation.');return;}
    }
    try{
      /* V62 : la confirmation définitive est faite par le client après l'arrivée.
         La photo n'est plus obligatoire dans ce parcours. */
      const {error}=await sb.rpc('client_confirm_order_delivery',{
        p_order_id:orderId,
        p_token:order.deliveryToken
      });
      if(error) throw error;
      const now=Date.now();
      const updated={...order,status:'delivered',deliveryConfirmedAt:now};
      _cache.orders=(_cache.orders||[]).map(o=>String(o.id)===String(orderId)?updated:o);
      ClientOrderCache.save(updated);
      Notify.add('order',`Commande #${order.number} livrée : réception confirmée par le client.`);
      ClientNotify.add(order.number,`✓ Commande #${order.number} livrée. Merci pour votre confiance.`);
      try{await AutoSync.refresh(true);}catch(e){}
      Toast.show('✓ Réception confirmée — commande livrée');
      Router.go('order-track',{id:orderId});
    }catch(e){
      console.error('confirmDeliveryFromClient',e);
      Toast.show('⚠️ '+((e&&e.message)||'Impossible de confirmer la réception'));
    }
  };

  /* ---------- Polling client : recharge les changements d'état sans clic. */
  let clientDeliveryPoll=null, lastClientDeliveryState={};
  function startClientDeliveryPolling(){
    if(clientDeliveryPoll) clearInterval(clientDeliveryPoll);
    clientDeliveryPoll=setInterval(async()=>{
      if(!Cloud.storeId || Router.current!=='order-track') return;
      try{
        await Cloud.loadAll();
        const id=Router.currentOpts?.id;
        const o=Store.orders.find(x=>String(x.id)===String(id));
        if(!o) return;
        const sig=[o.status,o.shipped,o.delivery_arrived_at,o.delivery_confirmed_at].join('|');
        if(lastClientDeliveryState[id] && lastClientDeliveryState[id]!==sig){
          if(o.delivery_arrived_at && o.status!=='delivered') ClientNotify.add(o.number,`📍 Votre livreur est arrivé pour la commande #${o.number}.`);
          if(o.status==='delivered') ClientNotify.add(o.number,`✓ Commande #${o.number} livrée et réception confirmée.`);
          Router.go('order-track',{id});
        }
        lastClientDeliveryState[id]=sig;
      }catch(e){}
    },5000);
  }
  const oldGo=Router.go;
  Router.go=function(name,opts){
    const r=oldGo.apply(this,arguments);
    if(name==='order-track') startClientDeliveryPolling();
    else if(clientDeliveryPoll){clearInterval(clientDeliveryPoll);clientDeliveryPoll=null;}
    return r;
  };

  /* ---------- Marchand : notifications lors des changements d'état. */
  let merchantDeliveryState={};
  const oldRefresh=AutoSync.refresh.bind(AutoSync);
  AutoSync.refresh=async function(force){
    const r=await oldRefresh(force);
    try{
      if(Router.current==='order-track' || courierSession()) return r;
      (Store.orders||[]).forEach(o=>{
        const sig=[o.status,o.shipped,o.delivery_arrived_at,o.delivery_confirmed_at].join('|');
        const old=merchantDeliveryState[o.id];
        if(old && old!==sig){
          if(o.delivery_arrived_at && o.status!=='delivered') Notify.add('order',`📍 Le livreur est arrivé pour la commande #${o.number}.`);
          if(o.status==='delivered') Notify.add('order',`✓ Commande #${o.number} livrée — réception confirmée par le client.`);
        }
        merchantDeliveryState[o.id]=sig;
      });
    }catch(e){}
    return r;
  };

})();
