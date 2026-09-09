(function(){
  window.dashboardQuickGo=function(route){
    try{ Router.go(String(route)); }
    catch(e){ console.error('Quick navigation',e); if(window.Toast&&Toast.show) Toast.show('Impossible d’ouvrir cette rubrique'); }
  };
})();
