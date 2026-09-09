(function(){
  const esc = s => { try{return Utils.escapeHtml(String(s??''));}catch(e){return String(s??'');} };
  const money = n => { try{return Utils.fmtFCFA(Number(n)||0);}catch(e){return (Number(n)||0)+' FCFA';} };
  const stat = (n,l) => `<div class="v15-stat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`;
  const card = (icon,title,sub,action) => `<button class="v15-action" onclick="${action}"><span class="v15-action-icon">${icon}</span><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><b>›</b></button>`;

  // --- Promotions: form always visible, no prompt, with limit + activation + delete ---
  window.v15CreatePromo = function(){
    const code=(document.getElementById('v15-code')?.value||'').trim().toUpperCase();
    const type=document.getElementById('v15-type')?.value||'percent';
    const value=Number(document.getElementById('v15-value')?.value);
    const max=Number(document.getElementById('v15-max')?.value||0);
    if(!/^[A-Z0-9_-]{3,30}$/.test(code)) return Toast.show('Code invalide : 3 à 30 caractères');
    if((Store.promos||[]).some(p=>String(p.code).toUpperCase()===code)) return Toast.show('Ce code existe déjà');
    if(!Number.isFinite(value)||value<=0) return Toast.show('Indiquez une valeur valide');
    if(type==='percent'&&value>100) return Toast.show('Le pourcentage ne peut pas dépasser 100 %');
    if(!Number.isFinite(max)||max<0) return Toast.show('Limite invalide');
    const p={id:Utils.uid(),code,type,value:Math.floor(value),active:true,maxUses:Math.floor(max),usedCount:0,createdAt:Date.now()};
    Store.promos=[...(Store.promos||[]),p]; PromoLocal.update(p.id,{active:true,maxUses:p.maxUses,usedCount:0});
    Toast.show('Code promo créé ✓'); Router.go('promos');
  };
  window.v15SetPromoLimit = function(id){
    const p=(Store.promos||[]).find(x=>x.id===id); if(!p)return;
    const n=prompt("Nombre maximum d'utilisations (0 = illimité)",String(p.maxUses||0)); if(n===null)return;
    const max=Number(n); if(!Number.isFinite(max)||max<0)return Toast.show('Limite invalide');
    p.maxUses=Math.floor(max); Store.promos=Store.promos.slice(); PromoLocal.update(id,{maxUses:p.maxUses}); Toast.show('Limite mise à jour ✓'); Router.go('promos');
  };
  window.v15TogglePromo = function(id){
    const p=(Store.promos||[]).find(x=>x.id===id); if(!p)return;
    if(p.maxUses>0 && Number(p.usedCount||0)>=p.maxUses) return Toast.show('Ce code a atteint sa limite');
    p.active=!p.active; Store.promos=Store.promos.slice(); PromoLocal.update(id,{active:p.active}); Toast.show(p.active?'Code activé ✓':'Code désactivé'); Router.go('promos');
  };
  window.v15DeletePromo = function(id){
    const p=(Store.promos||[]).find(x=>x.id===id); if(!p)return;
    if(!confirm('Supprimer le code '+p.code+' ?'))return;
    Store.promos=Store.promos.filter(x=>x.id!==id); PromoLocal.update(id,{active:false}); Toast.show('Code supprimé'); Router.go('promos');
  };
  Views.promos = function(){
    if(!Store.hasFeature('promos')) return FeatureLock('Codes promo',"La création de codes promo est incluse à partir de la formule DOYEN.",'doyen');
    const promos=(Store.promos||[]).map(p=>PromoLocal.merge(p));
    const active=promos.filter(p=>p.active&&(!p.maxUses||p.usedCount<p.maxUses)).length;
    return TopBar('Codes promo',promos.length+' code(s)')+
      `<div class="v15-promo-hero"><div><span>MARKETING BOUTIQUE</span><h2>Gérez vos promotions</h2><p>Créez un code, fixez sa limite et désactivez-le à tout moment.</p></div><div class="v15-promo-hero-icon">％</div></div>`+
      `<div class="v15-promo-stats">${stat(promos.length,'Codes créés')}${stat(active,'Actifs')}${stat(promos.reduce((a,p)=>a+(Number(p.usedCount)||0),0),'Utilisations')}</div>`+
      `<section class="v15-form-card"><div class="v15-card-title"><span>＋</span><div><b>Créer un code promo</b><small>Le formulaire est directement accessible ici.</small></div></div><div class="v15-form-grid"><label>Code<input id="v15-code" type="text" maxlength="30" autocomplete="off" placeholder="BIENVENUE10" oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')"></label><label>Type<select id="v15-type"><option value="percent">Pourcentage (%)</option><option value="fixed">Montant fixe (FCFA)</option></select></label><label>Valeur<input id="v15-value" type="number" min="1" step="1" placeholder="10"></label><label>Utilisations max<input id="v15-max" type="number" min="0" step="1" value="0"><small>0 = illimité</small></label></div><button class="btn btn-mango btn-block" onclick="v15CreatePromo()">Créer le code promo</button></section>`+
      `<div class="section-title">Vos codes</div>`+
      (promos.length?promos.map(p=>{const exhausted=p.maxUses>0&&p.usedCount>=p.maxUses;const pct=p.maxUses?Math.min(100,Math.round(p.usedCount/p.maxUses*100)):0;return `<article class="v15-promo-card"><div class="v15-promo-top"><div><div class="v15-code">${esc(p.code)}</div><div class="v15-desc">${p.type==='percent'?p.value+'% de réduction':money(p.value)+' de réduction'}</div></div><span class="v15-status ${p.active&&!exhausted?'on':'off'}">${exhausted?'Épuisé':p.active?'Actif':'Désactivé'}</span></div><div class="v15-use"><span>${p.maxUses?`Utilisations <b>${p.usedCount} / ${p.maxUses}</b>`:`Utilisations <b>${p.usedCount}</b> · illimité`}</span><span>${p.maxUses?pct+'%':''}</span></div>${p.maxUses?`<div class="v15-progress"><i style="width:${pct}%"></i></div>`:''}<div class="v15-promo-actions"><button onclick="v15SetPromoLimit('${p.id}')">⚙ Limite</button><button onclick="v15TogglePromo('${p.id}')" ${exhausted?'disabled':''}>${p.active?'⏸ Désactiver':'▶ Activer'}</button><button class="danger" onclick="v15DeletePromo('${p.id}')">🗑 Supprimer</button></div></article>`}).join(''):EmptyState(ICONS.box,'Aucun code promo','Créez votre premier code directement avec le formulaire ci-dessus.'));
  };

  // --- Merchant areas: richer, actionable panels ---
  const oldViews={customers:Views.customers,delivery:Views.delivery,team:Views.team,boutique:Views.boutique};
  Views.customers=function(){
    const base=oldViews.customers(); const c=Store.customers(); const orders=Store.orders||[]; const spend=c.reduce((s,x)=>s+(+x.spent||0),0); const loyal=c.filter(x=>x.isTopContributor).length;
    const panel=`<section class="v15-merchant-card"><div class="v15-kicker">SERVICE SIAMS · CLIENTS</div><h2>Centre clients</h2><p>Une vue rapide pour connaître, fidéliser et contacter vos clients.</p><div class="v15-stats4">${stat(c.length,'Clients')}${stat(orders.length,'Commandes')}${stat(money(spend),'Dépenses')}${stat(loyal,'Fidèles')}</div><div class="v15-action-list">${card('🔎','Rechercher / consulter','Ouvrir la liste et les fiches clients','document.querySelector(".v15-client-search")?.focus()')}${card('🧾','Historique des commandes','Voir toutes les commandes clients',"Router.go('orders')")}${card('⭐','Satisfaction','Consulter et répondre aux avis',"Router.go('reviews')")}</div></section>`;
    return panel+`<div class="v15-client-tools"><input class="v15-client-search" placeholder="Rechercher un client…" oninput="v15FilterCustomers(this.value)"></div>`+base.replace('<div style="padding:16px 20px 0;">','<div id="v15-customers-list" style="padding:8px 20px 0;">');
  };
  window.v15FilterCustomers=function(q){document.querySelectorAll('#v15-customers-list > div').forEach(x=>{x.style.display=(x.innerText||'').toLowerCase().includes(String(q||'').toLowerCase())?'flex':'none';});};
  Views.delivery=function(){
    const base=oldViews.delivery(); const z=Store.deliveryZones||[], o=Store.orders||[]; const pending=o.filter(x=>['pending','confirmed','preparing','shipped'].includes(x.status)).length; const delivered=o.filter(x=>x.status==='delivered').length;
    const panel=`<section class="v15-merchant-card"><div class="v15-kicker">SERVICE SIAMS · LIVRAISON</div><h2>Centre logistique</h2><p>Pilotez vos zones, les commandes à livrer et vos tarifs.</p><div class="v15-stats4">${stat(pending,'À traiter')}${stat(delivered,'Livrées')}${stat(z.length,'Zones')}${stat(money(z.reduce((s,x)=>s+(+(x.fee||x[1])||0),0)),'Tarifs cumulés')}</div><div class="v15-action-list">${card('🚚','Commandes à livrer','Ouvrir le suivi des commandes',"Router.go('orders')")}${card('＋','Nouvelle zone','Ajouter une zone et son tarif','addDeliveryZone()')}${card('📱','Espace livreur','Gérer les livreurs',"Router.go('team')")}</div></section>`;
    return panel+base;
  };
  Views.team=function(){
    const base=oldViews.team(); const t=Store.team||[], c=Store.couriers||[]; const active=t.filter(x=>x.status!=='suspended').length;
    const panel=`<section class="v15-merchant-card"><div class="v15-kicker">SERVICE SIAMS · ÉQUIPE</div><h2>Centre équipe</h2><p>Attribuez les rôles et organisez les accès de votre boutique.</p><div class="v15-stats4">${stat(t.length,'Membres')}${stat(active,'Actifs')}${stat(c.length,'Livreurs')}${stat(t.filter(x=>/admin|propriétaire/i.test(x.role||'')).length,'Admins')}</div><div class="v15-action-list">${card('＋','Ajouter un membre','Gérant, vendeur ou administrateur','openAddMember()')}${card('🚚','Inviter un livreur','Créer une invitation SIAMS','inviteCourierFromMerchant()')}${card('🔐','Accès livreur','Ouvrir l’espace livreur',"Router.go('courier-login')")}</div></section>`;
    return panel+base;
  };
  Views.boutique=function(){
    // V17 — le panneau "Centre boutique" (stats + actions) ne s'affiche plus en
    // haut de cette page : il est désormais intégré directement comme un champ
    // dans la liste de l'onglet Plus (voir menu-item "Boutique" du Sheet).
    return oldViews.boutique();
  };

  // --- Dashboard: Services SIAMS is secondary and moved to the very end ---
  const oldDash=Views.dashboard;
  Views.dashboard=function(){
    let html=oldDash();
    const start=html.indexOf('<div class="dashboard-v2-section"><h3>Services SIAMS</h3>');
    const end=html.indexOf('<div class="dashboard-v2-section"><h3>Suivi des commandes</h3>');
    if(start>=0&&end>start){
      const block=html.slice(start,end);
      html=html.slice(0,start)+html.slice(end);
      html=html.replace('</div>\n  `;','</div>\n  `;');
      html=html.replace(/\s*$/,'')+`<section class="v15-services-bottom"><div class="v15-services-label">Services SIAMS · en dernier plan</div><p>Les outils secondaires restent disponibles ici sans prendre la place des fonctions principales.</p><div class="v15-service-chips">${DASHBOARD_SERVICES.map(s=>`<button onclick="Router.go('${s.route}')">${s.icon}<span>${esc(s.label)}</span></button>`).join('')}</div></section>`;
    }
    return html;
  };
})();
