(function(){
  function refinePlusServices(){
    const box=document.querySelector('#sheet .v15-service-backdrop');
    if(!box) return;
    box.className='v15-service-backdrop';
    box.innerHTML='<div class="v15-service-title">Services SIAMS · secondaires</div><p style="margin:4px 0 10px;color:var(--text-soft);font-size:10px">Outils complémentaires, placés volontairement en dernier.</p><div class="v15-service-list">'+[
      ['📊','Statistiques','stats'],['💳','Paiements','payment'],['🚚','Livraison','delivery'],['⭐','Avis clients','reviews'],['👥','Clients','customers'],['🛡️','Certification boutique','verification'],['⚙️','Paramètres','settings']
    ].map(x=>'<button class="v15-service-item" onclick="Sheet.close();Router.go(\''+x[2]+'\')"><span>'+x[0]+'</span><b>'+x[1]+'</b><i>›</i></button>').join('')+'</div>';
  }
  document.addEventListener('click',function(e){ if(e.target.closest('#sheet')) setTimeout(refinePlusServices,0); },true);
  document.addEventListener('DOMContentLoaded',refinePlusServices);
  window.addEventListener('load',refinePlusServices);
})();
