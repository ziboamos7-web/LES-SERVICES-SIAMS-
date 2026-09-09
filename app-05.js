(function(){
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
  function promoForm(){
    return `<div class="v15-promo-form">
      <div style="font-size:13px;font-weight:800;margin-bottom:10px;">Créer un code promo</div>
      <div class="v15-promo-grid">
        <div class="field"><label>Code</label><input id="v15-promo-code" type="text" maxlength="30" autocomplete="off" placeholder="BIENVENUE10" oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')"></div>
        <div class="field"><label>Type</label><select id="v15-promo-type"><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option></select></div>
      </div>
      <div class="v15-promo-row">
        <div class="field"><label>Valeur</label><input id="v15-promo-value" type="number" min="1" step="1" placeholder="10"></div>
        <div class="field"><label>Limite d'utilisation</label><input id="v15-promo-max" type="number" min="0" step="1" value="0" placeholder="0"></div>
      </div>
      <div class="v15-promo-hint">0 = utilisation illimitée. Le compteur est conservé et le code devient indisponible dès que la limite est atteinte.</div>
      <div class="v15-promo-actions"><button class="btn btn-mango btn-block" onclick="createPromoV15()">Créer le code</button><button class="btn btn-ghost btn-block" onclick="document.getElementById('v15-promo-form')?.remove()">Annuler</button></div>
    </div>`;
  }
  window.openPromoFormV15=function(){const w=document.getElementById('v15-promo-form'); if(!w)return; w.innerHTML=promoForm(); w.classList.remove('hidden'); w.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>document.getElementById('v15-promo-code')?.focus(),50);};
  window.createPromoV15=function(){
    const code=(document.getElementById('v15-promo-code')?.value||'').trim().toUpperCase();
    const type=document.getElementById('v15-promo-type')?.value||'percent';
    const value=Number(document.getElementById('v15-promo-value')?.value);
    const max=Number(document.getElementById('v15-promo-max')?.value||0);
    if(!/^[A-Z0-9_-]{3,30}$/.test(code)) return Toast.show('Code invalide : 3 à 30 caractères');
    if((Store.promos||[]).some(p=>String(p.code).toUpperCase()===code)) return Toast.show('Ce code existe déjà');
    if(!Number.isFinite(value)||value<=0) return Toast.show('Valeur invalide');
    if(type==='percent' && value>100) return Toast.show('Le pourcentage ne peut pas dépasser 100 %');
    if(!Number.isFinite(max)||max<0) return Toast.show('Limite invalide');
    const p={id:Utils.uid(),code,type,value:Math.floor(value),active:true,maxUses:Math.floor(max),usedCount:0,createdAt:Date.now()};
    Store.promos=[...(Store.promos||[]),p];
    PromoLocal.update(p.id,{maxUses:p.maxUses,usedCount:0,active:true});
    Toast.show('Code promo créé ✓'); Router.go('promos');
  };
  window.setPromoLimitV15=function(id){
    const p=(Store.promos||[]).find(x=>x.id===id); if(!p)return;
    const n=prompt("Nombre maximum d'utilisations (0 = illimité)",String(p.maxUses||0)); if(n===null)return;
    const max=Number(n); if(!Number.isFinite(max)||max<0)return Toast.show('Limite invalide');
    p.maxUses=Math.floor(max); Store.promos=Store.promos.slice(); PromoLocal.update(id,{maxUses:p.maxUses}); Toast.show('Limite mise à jour ✓'); Router.go('promos');
  };
  window.togglePromoV15=function(id){
    const p=(Store.promos||[]).find(x=>x.id===id); if(!p)return;
    if(p.maxUses>0 && Number(p.usedCount||0)>=p.maxUses && !p.active) return Toast.show('Ce code est épuisé');
    p.active=!p.active; Store.promos=Store.promos.slice(); PromoLocal.update(id,{active:p.active}); Toast.show(p.active?'Code activé ✓':'Code désactivé'); Router.go('promos');
  };
  window.deletePromoV15=function(id){
    const p=(Store.promos||[]).find(x=>x.id===id); if(!p)return;
    if(!confirm(`Supprimer le code ${p.code} ?`))return;
    Store.promos=Store.promos.filter(x=>x.id!==id); PromoLocal.update(id,{active:false}); Toast.show('Code supprimé'); Router.go('promos');
  };
  const originalPromos=Views.promos;
  Views.promos=function(){
    const promos=(Store.promos||[]).map(p=>PromoLocal.merge(p));
    const active=promos.filter(p=>p.active&&(!p.maxUses||p.usedCount<p.maxUses)).length;
    const inactive=promos.length-active;
    const cards=promos.map(function(p){
      const exhausted=p.maxUses>0&&p.usedCount>=p.maxUses;
      const pct=p.maxUses?Math.min(100,Math.round(p.usedCount/p.maxUses*100)):0;
      const discount=p.type==='percent' ? p.value+'% de réduction' : Utils.fmtFCFA(p.value)+' de réduction';
      const uses=p.maxUses ? 'Utilisations : <b>'+p.usedCount+' / '+p.maxUses+'</b>' : 'Utilisations : <b>'+p.usedCount+'</b> · illimité';
      const progress=p.maxUses ? '<div style="height:6px;background:var(--panel);border-radius:999px;overflow:hidden;margin-bottom:10px;"><span style="display:block;height:100%;width:'+pct+'%;background:var(--indigo);"></span></div>' : '';
      return '<div class="promo-card-premium">'+
        '<div class="promo-card-top"><div class="promo-code-badge"><span>％</span>'+esc(p.code)+'</div><span class="badge '+(p.active&&!exhausted?'delivered':'pending')+'">'+(exhausted?'Épuisé':p.active?'Actif':'Inactif')+'</span></div>'+ 
        '<div class="promo-card-desc">'+discount+' sur la commande</div>'+ 
        '<div style="display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--text-mid);margin-bottom:8px;"><span>'+uses+'</span><span>'+(p.maxUses?pct+'%':'')+'</span></div>'+progress+
        '<div class="promo-card-foot"><span class="promo-kind">'+(p.type==='percent'?'Pourcentage':'Montant fixe')+'</span><label class="switch"><input type="checkbox" '+(p.active&&!exhausted?'checked':'')+' '+(exhausted?'disabled':'')+' onchange="togglePromoV15(\''+p.id+'\')"><span class="slider"></span></label></div>'+ 
        '<div class="v15-promo-edit"><button class="v15-mini" onclick="setPromoLimitV15(\''+p.id+'\')">⚙ Limite</button><button class="v15-mini" onclick="togglePromoV15(\''+p.id+'\')">'+(p.active?'⏸ Désactiver':'▶ Activer')+'</button><button class="v15-mini" onclick="deletePromoV15(\''+p.id+'\')">🗑 Supprimer</button></div>'+ 
      '</div>';
    }).join('');
    return TopBar('Codes promo',promos.length+' code(s)')+
      '<div class="promo-premium-head"><div class="eyebrow">Marketing boutique</div><h2>Vos codes promo</h2><p>Créez, limitez, désactivez et suivez chaque campagne depuis un seul espace.</p></div>'+ 
      '<div class="promo-summary"><div class="promo-stat"><div class="n">'+promos.length+'</div><div class="t">Total</div></div><div class="promo-stat active"><div class="n">'+active+'</div><div class="t">Disponibles</div></div><div class="promo-stat inactive"><div class="n">'+inactive+'</div><div class="t">Inactifs / épuisés</div></div></div>'+ 
      '<div id="v15-promo-form" class="hidden"></div>'+ 
      '<div class="promo-create"><button class="btn btn-mango btn-block" onclick="openPromoFormV15()">＋ Créer un code promo</button></div>'+ 
      '<div class="promo-tip">Définissez une limite pour une campagne maîtrisée, ou laissez <b>0</b> pour une utilisation illimitée.</div>'+ 
      '<div class="section-title" style="padding-top:2px;">Vos campagnes</div>'+ 
      (promos.length===0?EmptyState(ICONS.box,'Aucun code promo','Créez votre premier code promo pour proposer une réduction à vos clients.'):cards);
  };
  // Rendre le champ promo checkout réellement cliquable et confortable sur mobile.
  document.addEventListener('click',function(e){
    const input=e.target.closest?.('#co-promo'); if(input){input.removeAttribute('readonly');input.focus();}
  },true);
  // Services SIAMS : une zone secondaire, volontairement placée tout en bas du menu Plus.
  function addBottomServices(){
    const sheet=document.getElementById('sheet'); if(!sheet||sheet.querySelector('.v15-service-backdrop'))return;
    const box=document.createElement('div'); box.className='v15-service-backdrop'; box.innerHTML='<div class="v15-service-title">Autres services SIAMS</div><div class="v15-service-list">'+[['📊','Statistiques'],['💳','Paiements'],['🚚','Livraison'],['⭐','Avis clients'],['👥','Clients'],['⚙','Paramètres']].map(x=>`<div class="v15-service-item"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')+'</div>';
    sheet.appendChild(box);
  }
  document.addEventListener('DOMContentLoaded',addBottomServices);
  window.addEventListener('load',addBottomServices);
})();
