(function(){
  const originalGo=Router.go.bind(Router);
  Router.go=function(name,opts){
    if(name==='register' && !ActivationGate.getStored()) name='activation-code';
    if(name==='login') authMode='login';
    return originalGo(name,opts);
  };
})();
