(function(){
  'use strict';
  const app=document.getElementById('app');

  /* 1) Services accueil : délégation de clic robuste, indépendante des onclick générés */
  function bindServices(){
    const root=document.getElementById('page-root');
    if(!root || root.dataset.v37ServicesBound==='1') return;
    root.dataset.v37ServicesBound='1';
    root.addEventListener('click',function(e){
      const el=e.target.closest && e.target.closest('.dashboard-v2-service,.v21-home-service');
      if(!el) return;
      const route=el.getAttribute('data-v37-route') || el.getAttribute('data-route');
      if(route){ e.preventDefault(); e.stopPropagation(); try{Sheet.close();}catch(_){} requestAnimationFrame(()=>Router.go(route)); }
    },true);
  }
  function markServices(){
    document.querySelectorAll('.dashboard-v2-service,.v21-home-service').forEach(el=>{
      const text=(el.innerText||'').trim();
      const found=(typeof DASHBOARD_SERVICES!=='undefined'?DASHBOARD_SERVICES:[]).find(s=>s.label===text);
      if(found){el.classList.add('v37-service-clickable');el.setAttribute('data-v37-route',found.route);}
    });
  }

  /* 2) Supprime uniquement le premier TopBar quand la page possède déjà un vrai titre secondaire. */
  function cleanDuplicateHead(){
    if(!app) return;
    const root=document.getElementById('page-root'); if(!root) return;
    const hasRichHead=!!root.querySelector('.payment-head,.delivery-head,.stats-premium-intro,.promo-premium-head,.products-v3-head,.orders-premium-head,.v20-cat-head,.v20-promo-head,.v22-promo-head,.v15-merchant-card');
    if(!hasRichHead){app.removeAttribute('data-v37-clean-head');return;}
    const top=root.querySelector('.topbar');
    if(top) top.remove();
    app.setAttribute('data-v37-clean-head','1');
  }

  /* 3) Métadonnées équipe persistées localement (photo + infos complémentaires). */
  const TeamLocal={
    key(){return 'siams_team_profiles_'+((Store.store&&Store.store.slug)||'default');},
    load(){try{return JSON.parse(localStorage.getItem(this.key())||'{}')}catch(e){return {}}},
    save(all){try{localStorage.setItem(this.key(),JSON.stringify(all||{}))}catch(e){console.warn('TeamLocal save',e)}},
    get(id){const all=this.load();return all[id]||{}},
    set(id,data){const all=this.load();all[id]=Object.assign({},all[id]||{},data||{});this.save(all);return all[id]},
    remove(id){const all=this.load();delete all[id];this.save(all)}
  };
  window.TeamLocal=TeamLocal;
  const esc=s=>{try{return Utils.escapeHtml(String(s??''))}catch(e){return String(s??'')}};
  const avatar=(m)=>{const meta=TeamLocal.get(m.id);if(meta.photo)return '<img src="'+esc(meta.photo)+'" alt="">';return '<svg width="25" height="25" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20c.8-4 3.6-6.2 7.5-6.2s6.7 2.2 7.5 6.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'};

  function teamCard(m){
    const x=TeamLocal.get(m.id); const status=m.status==='invited'?'Invitation envoyée':m.status==='suspended'?'Suspendu':'Actif';
    return `<article class="v37-team-card" data-team-id="${esc(m.id)}">
      <div class="v37-team-card-top"><div class="v37-team-avatar">${avatar(m)}</div><div class="v37-team-main"><h3>${esc(m.name||'Membre')}</h3><span class="v37-team-role">${esc(m.role||'Vendeur')}</span></div><span class="v37-team-status ${m.status==='invited'?'invited':''}">${status}</span></div>
      <div class="v37-team-info">
        <div class="v37-team-info-item"><small>Téléphone</small><span>${esc(m.phone||x.phone||'Non renseigné')}</span></div>
        <div class="v37-team-info-item"><small>E-mail</small><span>${esc(x.email||'Non renseigné')}</span></div>
        <div class="v37-team-info-item"><small>Ville / zone</small><span>${esc(x.city||'Non renseignée')}</span></div>
        <div class="v37-team-info-item"><small>Depuis</small><span>${esc(x.joined||'Non renseigné')}</span></div>
        ${x.note?`<div class="v37-team-info-item full"><small>Informations complémentaires</small><span>${esc(x.note)}</span></div>`:''}
      </div>
      <div class="v37-team-actions"><button type="button" onclick="v37EditMember('${esc(m.id)}')">Modifier</button><button type="button" class="danger" onclick="removeTeamMember('${esc(m.id)}')">Retirer</button></div>
    </article>`;
  }

  window.v37EditMember=function(id){
    const m=(Store.team||[]).find(x=>x.id===id); if(!m)return;
    const x=TeamLocal.get(id);
    const wrap=document.createElement('div'); wrap.id='v37-team-modal'; wrap.className='overlay show'; wrap.style.zIndex='99990';
    const sheet=document.createElement('div'); sheet.className='sheet show'; sheet.style.zIndex='99991';
    sheet.innerHTML=`<div class="sheet-handle"></div><h3 style="margin:0 0 5px;font-size:18px;">Profil du membre</h3><p style="margin:0 0 15px;color:var(--text-mid);font-size:12px;">Ajoutez une photo et les informations utiles à l’équipe.</p>
      <div class="field"><label>Photo de profil</label><input id="v37-t-photo" type="file" accept="image/png,image/jpeg,image/webp"></div>
      <div class="field"><label>E-mail</label><input id="v37-t-email" type="email" value="${esc(x.email||'')}" placeholder="membre@exemple.com"></div>
      <div class="field"><label>Ville / zone</label><input id="v37-t-city" value="${esc(x.city||'')}" placeholder="Ex. Cocody"></div>
      <div class="field"><label>Date d'arrivée</label><input id="v37-t-joined" type="date" value="${esc(x.joined||'')}"></div>
      <div class="field"><label>Informations complémentaires</label><textarea id="v37-t-note" rows="3" placeholder="Spécialité, horaires, remarques…">${esc(x.note||'')}</textarea></div>
      <button class="btn btn-primary btn-block" type="button" onclick="v37SaveMember('${esc(id)}')">Enregistrer</button>
      <button class="btn btn-outline btn-block" style="margin-top:8px;" type="button" onclick="document.getElementById('v37-team-modal')?.remove()">Annuler</button>`;
    wrap.onclick=e=>{if(e.target===wrap)wrap.remove()}; wrap.appendChild(sheet); document.body.appendChild(wrap);
  };
  window.v37SaveMember=function(id){
    const save={email:document.getElementById('v37-t-email')?.value.trim()||'',city:document.getElementById('v37-t-city')?.value.trim()||'',joined:document.getElementById('v37-t-joined')?.value||'',note:document.getElementById('v37-t-note')?.value.trim()||''};
    const file=document.getElementById('v37-t-photo')?.files?.[0];
    const done=photo=>{if(photo)save.photo=photo;TeamLocal.set(id,save);document.getElementById('v37-team-modal')?.remove();Toast.show('Profil du membre enregistré ✓');Router.go('team');};
    if(!file)return done();
    siamsPrepareImageDataURL(file).then(done).catch(()=>done());
  };

  const oldTeam=Views.team;
  Views.team=function(){
    if(!Store.hasFeature('team')) return oldTeam();
    const t=Store.team||[], c=Store.couriers||[], active=t.filter(x=>x.status!=='suspended').length;
    return `${TopBar('Équipe',t.length+' membre(s)')}<div class="v37-team-head"><div class="eyebrow">Gestion de votre équipe</div><h2>Membres de l’équipe</h2><p>Chaque membre dispose maintenant d’une carte complète avec photo, rôle et informations complémentaires.</p></div><div class="v37-team-summary"><div><b>${t.length}</b><span>Membres</span></div><div><b>${active}</b><span>Actifs</span></div><div><b>${c.length}</b><span>Livreurs</span></div></div><div class="v37-team-add"><button class="btn btn-primary btn-block" type="button" onclick="v37OpenAddMember()">＋ Ajouter un membre</button></div>${t.length?`<div class="v37-team-list">${t.map(teamCard).join('')}</div>`:`<div class="v37-team-empty"><b>Aucun membre d’équipe</b><div style="margin-top:5px;font-size:11.5px;">Ajoutez un gérant, vendeur ou administrateur.</div></div>`}<section class="v37-team-couriers"><h3>Livreurs SIAMS</h3>${c.length?c.map(q=>`<div class="v37-courier-row"><div class="v37-courier-avatar">🚚</div><div class="v37-courier-main"><b>${esc(q.name||'Livreur')}</b><span>${esc(q.phone||'')} · ${q.status==='active'?'Actif':q.status==='invited'?'Invitation envoyée':'Suspendu'}</span></div>${q.status!=='suspended'?`<button type="button" class="v37-courier-remove" onclick="removeCourier('${esc(q.id)}')" aria-label="Retirer ${esc(q.name||'livreur')}">Retirer</button>`:''}</div>`).join(''):`<div style="font-size:11.5px;color:var(--text-mid);">Aucun livreur connecté.</div>`}<button class="btn btn-soft-green btn-block" style="margin-top:10px;" onclick="inviteCourierFromMerchant()">Inviter un livreur</button></section>`;
  };

  window.v37OpenAddMember=function(){
    const wrap=document.createElement('div');wrap.id='v37-add-team-modal';wrap.className='overlay show';wrap.style.zIndex='99990';
    const sheet=document.createElement('div');sheet.className='sheet show';sheet.style.zIndex='99991';
    sheet.innerHTML=`<div class="sheet-handle"></div><h3 style="margin:0 0 5px;font-size:18px;">Ajouter un membre</h3><p style="margin:0 0 15px;color:var(--text-mid);font-size:12px;">Créez sa fiche dès maintenant.</p>
      <div class="field"><label>Nom complet</label><input id="v37-a-name" placeholder="Ex. Awa Koné"></div>
      <div class="field"><label>Numéro WhatsApp</label><input id="v37-a-phone" inputmode="tel" placeholder="07 00 00 00 00"></div>
      <div class="field"><label>Rôle</label><select id="v37-a-role"><option>Vendeur</option><option>Gérant</option><option>Admin</option></select></div>
      <div class="field"><label>Photo de profil</label><input id="v37-a-photo" type="file" accept="image/png,image/jpeg,image/webp"></div>
      <div class="field"><label>E-mail</label><input id="v37-a-email" type="email" placeholder="membre@exemple.com"></div>
      <div class="field"><label>Ville / zone</label><input id="v37-a-city" placeholder="Ex. Abidjan"></div>
      <div class="field"><label>Informations complémentaires</label><textarea id="v37-a-note" rows="3" placeholder="Spécialité, horaires, remarques…"></textarea></div>
      <button class="btn btn-primary btn-block" type="button" onclick="v37CreateMember()">Créer le membre</button><button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="document.getElementById('v37-add-team-modal')?.remove()">Annuler</button>`;
    wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};wrap.appendChild(sheet);document.body.appendChild(wrap);setTimeout(()=>document.getElementById('v37-a-name')?.focus(),50);
  };
  window.v37CreateMember=function(){
    const name=document.getElementById('v37-a-name')?.value.trim(),phone=document.getElementById('v37-a-phone')?.value.trim(),role=document.getElementById('v37-a-role')?.value||'Vendeur';
    if(!name)return Toast.show('Renseignez le nom du membre');if(!phone)return Toast.show('Renseignez le numéro WhatsApp');
    const id=Utils.uid(),meta={email:document.getElementById('v37-a-email')?.value.trim()||'',city:document.getElementById('v37-a-city')?.value.trim()||'',note:document.getElementById('v37-a-note')?.value.trim()||'',joined:new Date().toISOString().slice(0,10)};
    const file=document.getElementById('v37-a-photo')?.files?.[0];
    const done=photo=>{if(photo)meta.photo=photo;TeamLocal.set(id,meta);const team=[...(Store.team||[]),{id,name,phone,role,status:'invited'}];Store.team=team;document.getElementById('v37-add-team-modal')?.remove();Toast.show('Membre ajouté ✓');Router.go('team');};
    if(file){ siamsPrepareImageDataURL(file).then(done).catch(()=>done()); } else done();
  };

  /* 4) Client : raccourci promo + checkout tactile */
  const oldShop=Views.shop;
  Views.shop=function(){
    let html=oldShop();
    const cta='<div class="v37-client-promo-cta" role="button" tabindex="0" onclick="openClientPromoList()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openClientPromoList()}"><div class="ico">％</div><div class="txt"><b>Codes promo</b><span>Voir les réductions disponibles avant de commander.</span></div><div class="arr">›</div></div>';
    const marker='<div class="home-section-row"><h3 id="home-grid-title__v46_2">Nouveautés</h3>';
    return html.replace(marker,cta+marker);
  };
  const oldAccount=Views['shop-account'];
  Views['shop-account']=function(){
    let html=oldAccount();
    /* Le raccourci existant reste présent ; on lui ajoute une cible explicite. */
    html=html.replace('onclick="openClientPromoList()"','onclick="openClientPromoList();" data-v37-promo="1"');
    return html;
  };
  document.addEventListener('click',function(e){
    const input=e.target.closest&&e.target.closest('#co-promo');if(input){input.removeAttribute('readonly');input.disabled=false;input.focus({preventScroll:true});}
  },true);

  /* 5) Rebranche après chaque navigation, car Router remplace page-root. */
  const originalGo=Router.go.bind(Router);
  Router.go=function(name,opts){
    const r=originalGo(name,opts);
    setTimeout(()=>{cleanDuplicateHead();markServices();bindServices()},0);
    requestAnimationFrame(()=>{cleanDuplicateHead();markServices();bindServices()});
    return r;
  };
  document.addEventListener('DOMContentLoaded',()=>{cleanDuplicateHead();markServices();bindServices()});
  window.addEventListener('load',()=>{cleanDuplicateHead();markServices();bindServices()});
})();
