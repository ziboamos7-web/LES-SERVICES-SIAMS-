(function(){
  function cleanPlus(){
    const sheet=document.getElementById('sheet'); if(!sheet)return;
    sheet.querySelectorAll('.v16-merchant-cleanup,.v15-service-backdrop,.v16-plus-section').forEach(el=>el.remove());
    sheet.querySelectorAll('.menu-item').forEach(el=>{el.style.display='flex';});
  }
  const previousOpen=Sheet.open.bind(Sheet);
  Sheet.open=function(){
    previousOpen();
    cleanPlus();
    requestAnimationFrame(cleanPlus);
    setTimeout(cleanPlus,40);
    setTimeout(cleanPlus,160);
  };
  const previousDashboard=Views.dashboard;
  Views.dashboard=function(){
    let html=previousDashboard();
    html=html.replace(/<div class="dashboard-v2-section"><h3>Services SIAMS<\/h3>[\s\S]*?<\/div>\s*<div class="dashboard-v2-service-grid">[\s\S]*?<\/div>/,'');
    html=html.replace(/<section class="v15-services-bottom">[\s\S]*?<\/section>/,'');
    const serviceData=(typeof DASHBOARD_SERVICES!=='undefined'?DASHBOARD_SERVICES:[]).slice(0,8);
    const services='<section class="v21-home-services" aria-label="Services SIAMS">'+
      '<div class="v21-home-services-head"><div><div class="v21-home-services-title">Services SIAMS</div><div class="v21-home-services-sub">Accès rapide aux services complémentaires</div></div><button class="link-btn" onclick="Sheet.open()">Voir tout ›</button></div>'+
      '<div class="v21-home-services-grid">'+serviceData.map(s=>'<button class="v21-home-service" onclick="Router.go(\\\''+s.route+'\\\')"><div class="si" style="background:'+s.tint+';color:'+s.color+'">'+s.icon+'</div><span>'+s.label+'</span></button>').join('')+'</div>'+
      '</section>';
    const follow='<div class="dashboard-v2-section"><h3>Suivi des commandes</h3>';
    if(html.includes(follow)) html=html.replace(follow,services+'\n    '+follow);
    return html;
  };
  document.addEventListener('DOMContentLoaded',cleanPlus);
  window.addEventListener('load',cleanPlus);
})();
