(function(){
  const routes=['customers','delivery','team','boutique'];
  const oldGo=Router.go.bind(Router);
  function cleanup(){
    const root=document.getElementById('page-root'); if(!root)return;
    root.querySelectorAll('.v14-merchant-panel,.v15-merchant-card').forEach(el=>el.remove());
  }
  Router.go=function(name,opts){
    oldGo(name,opts);
    if(routes.includes(name)){
      requestAnimationFrame(cleanup);
      setTimeout(cleanup,40);
      setTimeout(cleanup,180);
    }
  };
  function addPlusGroup(){
    const sheet=document.getElementById('sheet'); if(!sheet || sheet.querySelector('.v16-merchant-cleanup')) return;
    const anchor=[...sheet.querySelectorAll('.menu-item')].find(el=>/Clients/.test(el.innerText||''));
    const box=document.createElement('section');
    box.className='v16-merchant-cleanup';
    box.innerHTML=`<div class="v16-merchant-cleanup-head"><div class="mi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 20v-1.5A4.5 4.5 0 0 1 8.5 14h7a4.5 4.5 0 0 1 4.5 4.5V20M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><div><b>Gestion marchand</b><span>Les centres de gestion sont regroupés ici.</span></div></div>
      <div class="v16-merchant-grid">
        <button class="v16-merchant-link" onclick="Sheet.close();Router.go('customers')"><span class="li" style="background:var(--blue-tint);color:var(--blue)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20c.8-3.8 3.6-6 7.5-6s6.7 2.2 7.5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><span><b>Clients</b><small>Fiches et historique</small></span><i class="arr">›</i></button>
        <button class="v16-merchant-link" onclick="Sheet.close();Router.go('delivery')"><span class="li" style="background:var(--indigo-tint);color:var(--indigo)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 16V6a1 1 0 0 1 1-1h9v11M3 16h11m0 0h3.5a1.5 1.5 0 0 0 1.5-1.5V11h-5m0-6h2l3 4v3" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="1.7" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="17.5" r="1.7" stroke="currentColor" stroke-width="1.5"/></svg></span><span><b>Livraison</b><small>Zones et suivi</small></span><i class="arr">›</i></button>
        <button class="v16-merchant-link" onclick="Sheet.close();Router.go('team')"><span class="li" style="background:var(--green-tint);color:var(--green)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 20c.7-3.5 2.9-5.5 5.5-5.5s4.8 2 5.5 5.5M16 10c2 .1 3 1.4 3 3.2M16 5.5a3 3 0 0 1 0 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><span><b>Équipe</b><small>Rôles et accès</small></span><i class="arr">›</i></button>
        <button class="v16-merchant-link" onclick="Sheet.close();Router.go('boutique')"><span class="li" style="background:var(--mango-tint);color:var(--mango-dark)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 9h16M4 9l1.4-4h13.2L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 13a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><span><b>Boutique</b><small>Vitrine et catalogue</small></span><i class="arr">›</i></button>
      </div>`;
    if(anchor) sheet.insertBefore(box,anchor); else sheet.insertBefore(box,sheet.querySelector('.menu-item'));
    // Retire les anciennes entrées individuelles pour éviter les doublons.
    sheet.querySelectorAll('.menu-item').forEach(el=>{
      const t=(el.innerText||'').trim();
      if(/^(Boutique|Équipe|Clients|Livraison)$/.test(t.split('\\n')[0])) el.style.display='none';
    });
  }
  const oldOpen=Sheet.open.bind(Sheet);
  Sheet.open=function(){ oldOpen(); requestAnimationFrame(addPlusGroup); setTimeout(addPlusGroup,30); };
})();
