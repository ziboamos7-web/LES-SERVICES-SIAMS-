(function(){
  'use strict';
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};

  window.closeV57Popup=function(id){const el=document.getElementById(id);if(el)el.remove();};

  function openPendingOrderPopup(order){
    if(document.getElementById('v57-pending-popup'))return;
    const html=`<div id="v57-pending-popup" class="v57-popup-overlay" onclick="if(event.target===this)closeV57Popup('v57-pending-popup')"><div class="v57-popup-card"><button class="v57-popup-close" onclick="closeV57Popup('v57-pending-popup')">✕</button>
      <div class="v57-pending-hero"><span class="v57-pending-badge">🕒 En attente</span><h2>Commande en attente de validation</h2><p>Le vendeur va bientôt confirmer votre commande #${esc(order.number)}.</p></div>
      <div class="v57-trust-grid">
        <div class="v57-trust-item"><div class="v57-trust-ico">🔒</div><div><b>Paiement sécurisé</b><span>Wave, OM, MTN, Moov ou cash</span></div></div>
        <div class="v57-trust-item"><div class="v57-trust-ico">🚚</div><div><b>Livraison suivie</b><span>Statut mis à jour en temps réel</span></div></div>
        <div class="v57-trust-item"><div class="v57-trust-ico">✔</div><div><b>Vendeur vérifié</b><span>Boutique active sur SIAMS</span></div></div>
        <div class="v57-trust-item"><div class="v57-trust-ico">💬</div><div><b>Support disponible</b><span>En cas de question sur la commande</span></div></div>
      </div>
      <div class="v57-popup-cta"><button class="btn btn-primary btn-block" onclick="closeV57Popup('v57-pending-popup');Router.go('order-track',{id:'${esc(order.id)}'})">SUIVRE MA COMMANDE</button></div>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    requestAnimationFrame(()=>document.getElementById('v57-pending-popup')?.classList.add('show'));
  }

  function openDealsPopup(products){
    if(document.getElementById('v57-deals-popup'))return;
    let i=0;
    const slideHtml=p=>{const discount=p.oldPrice?Math.round((1-p.price/p.oldPrice)*100):0;return `<div class="v57-deals-slide"><img src="${esc(p.photo||'')}" alt="${esc(p.name)}">${discount?`<div class="v57-deals-badge">-${discount}%</div>`:''}<div class="v57-deals-name">${esc(p.name)}</div><div class="v57-deals-price-row"><span class="v57-deals-price">${Utils.fmtFCFA(p.price)}</span>${p.oldPrice?`<span class="v57-deals-old-price">${Utils.fmtFCFA(p.oldPrice)}</span>`:''}</div><button class="btn btn-mango btn-block" onclick="closeV57Popup('v57-deals-popup');Router.go('shop-product',{id:'${esc(p.id)}'})">Voir l'article →</button></div>`;};
    const html=`<div id="v57-deals-popup" class="v57-popup-overlay" onclick="if(event.target===this)closeV57Popup('v57-deals-popup')"><div class="v57-popup-card" style="position:relative;">
      <button class="v57-popup-close" onclick="closeV57Popup('v57-deals-popup')">✕</button>
      <div class="v57-deals-head"><span style="font-size:16px;">⚡</span><b>Offres du jour</b></div>
      ${products.length>1?`<button class="v57-deals-arrow prev" onclick="moveV57DealsSlide(-1)">‹</button><button class="v57-deals-arrow next" onclick="moveV57DealsSlide(1)">›</button>`:''}
      <div class="v57-deals-track" id="v57-deals-track">${products.map(slideHtml).join('')}</div>
      ${products.length>1?`<div class="v57-deals-dots" id="v57-deals-dots">${products.map((_,j)=>`<span class="v57-deals-dot ${j===0?'active':''}"></span>`).join('')}</div>`:''}
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    requestAnimationFrame(()=>document.getElementById('v57-deals-popup')?.classList.add('show'));
    const track=document.getElementById('v57-deals-track');
    const dots=document.getElementById('v57-deals-dots');
    const setActiveDot=j=>{if(dots)[...dots.children].forEach((d,k)=>d.classList.toggle('active',k===j));};
    window.moveV57DealsSlide=dir=>{
      if(!track)return;
      i=Math.max(0,Math.min(products.length-1,i+dir));
      const slide=track.children[i];
      if(slide)track.scrollTo({left:slide.offsetLeft-18,behavior:'smooth'});
      setActiveDot(i);
    };
    if(track){
      let scrollTimer=null;
      track.addEventListener('scroll',()=>{
        clearTimeout(scrollTimer);
        scrollTimer=setTimeout(()=>{
          const slideW=track.children[1]?track.children[1].offsetLeft-track.children[0].offsetLeft:track.clientWidth;
          i=Math.round(track.scrollLeft/slideW);
          setActiveDot(i);
        },80);
      },{passive:true});
    }
  }

  function maybeShowHomePopups(){
    const sid=(Store.store&&Store.store.slug)||'default';
    const pendingKey='siams_popup_pending_'+sid;
    const dealsKey='siams_popup_deals_'+sid;
    let orders=[];
    try{orders=(window.ClientOrderCache?ClientOrderCache.load():[])||[];}catch(e){}
    const pendingOrder=orders.find(o=>o&&o.status==='pending');
    if(pendingOrder && !sessionStorage.getItem(pendingKey)){
      sessionStorage.setItem(pendingKey,'1');
      setTimeout(()=>openPendingOrderPopup(pendingOrder),600);
      return;
    }
    if(!sessionStorage.getItem(dealsKey)){
      const discounted=(Store.products||[]).filter(p=>p.oldPrice && Number(p.oldPrice)>Number(p.price)).sort((a,b)=>(1-b.price/b.oldPrice)-(1-a.price/a.oldPrice)).slice(0,10);
      if(discounted.length){
        sessionStorage.setItem(dealsKey,'1');
        setTimeout(()=>openDealsPopup(discounted),600);
      }
    }
  }

  const oldAfterShop=Views._after_shop;
  Views._after_shop=async function(opts){if(oldAfterShop)await oldAfterShop(opts);try{maybeShowHomePopups();}catch(e){console.warn('Home popups',e)}};
})();
