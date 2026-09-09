/* ================= SIAMS V48 — corrections & modules demandés ================= */
(function(){
  const esc = s => { try{return Utils.escapeHtml(String(s ?? ''));}catch(e){return String(s ?? '');} };
  const SUPPORT_EMAIL = (typeof PAYMENT_INFO!=='undefined' && PAYMENT_INFO.supportClientEmail) || 'serviceclientsiams.ci@gmail.com';
  const ADMIN_EMAILS = [SUPPORT_EMAIL.toLowerCase()];
  const isSiamsAdmin = () => {
    try { const u = sb.auth.getUser ? null : null; } catch(e){}
    const email = (window._siamsCurrentAdminEmail || '').toLowerCase();
    return ADMIN_EMAILS.includes(email);
  };

  /* 1) Thème sombre/clair : fonctionnalité totalement retirée. */
  const removeThemeUi = () => {
    document.getElementById('siams-theme-fab')?.remove();
    document.getElementById('siams-theme-overlay')?.remove();
    document.querySelectorAll('[data-theme-mode-label]').forEach(x=>x.closest('.acc-row,section,.v39-settings-section')?.remove());
  };
  window.ThemeMode = { init(){}, open(){ removeThemeUi(); }, close(){ removeThemeUi(); }, ensureFab(){ removeThemeUi(); }, set(){}, apply(){}, effective(){return 'light';}, refreshLabels(){}, label(){return 'Clair';} };
  removeThemeUi();

  /* 2) Onboarding : chaque variante possède maintenant son propre track. */
  const oldOnboardGo = Onboarding.go.bind(Onboarding);
  Onboarding.go = function(i){
    if(i<0 || i>=this.slides.length) return;
    this.index=i;
    const ids={admin:'onboard-track',public:'onboard-track__v46_2',client:'onboard-track__v46_3'};
    const track=document.getElementById(ids[this.type]) || document.getElementById('onboard-track') || document.getElementById('onboard-track__v46_2') || document.getElementById('onboard-track__v46_3');
    if(track) track.style.transform=`translate3d(-${i*100}%,0,0)`;
    document.querySelectorAll('.onboard-slide').forEach(el=>el.classList.toggle('active',Number(el.dataset.oi)===i));
    document.querySelectorAll('.onboard-dot').forEach((el,di)=>el.classList.toggle('active',di===i));
    const btn=document.getElementById(this.type==='admin'?'onboard-next-btn':this.type==='public'?'onboard-next-btn__v46_2':'onboard-next-btn__v46_3');
    if(btn) btn.innerHTML=(i===this.slides.length-1)?'Commencer <span style="float:right;font-size:20px;line-height:16px;">✦</span>':'Suivant <span style="float:right;font-size:20px;line-height:16px;">→</span>';
    const cur=document.getElementById(this.type==='admin'?'onboard-progress-current':this.type==='public'?'onboard-progress-current__v46_2':null); if(cur) cur.textContent=String(i+1);
    const bar=document.getElementById(this.type==='admin'?'onboard-progress-bar':this.type==='public'?'onboard-progress-bar__v46_2':null); if(bar) bar.style.width=((i+1)/this.slides.length*100)+'%';
  };
  const oldOnboardAttach=Onboarding.attach.bind(Onboarding);
  Onboarding.attach=function(){ oldOnboardAttach(); this.go(this.index); };

  /* 2bis) Défilement automatique : chaque slide reste affichée 10 secondes avant de
     passer à la suivante (retour au début après la dernière). Toute navigation —
     automatique ou manuelle (flèches, swipe, clavier) — repasse par Onboarding.go,
     qui relance systématiquement le minuteur : chaque slide dispose donc toujours
     de 10 secondes pleines, y compris après une interaction de l'utilisateur. */
  const autoAdvanceGo = Onboarding.go;
  Onboarding.go = function(i){
    if(i<0 || i>=this.slides.length) return;
    autoAdvanceGo.call(this, i);
    clearInterval(this._autoTimer);
    this._autoTimer = setInterval(()=>{
      const next = this.index < this.slides.length-1 ? this.index+1 : 0;
      this.go(next);
    }, 10000);
  };
  const oldOnboardFinish=Onboarding.finish.bind(Onboarding);
  Onboarding.finish=function(){ clearInterval(this._autoTimer); oldOnboardFinish(); };

  /* 3) Espace client : accès direct + compte/messages toujours accessibles. */
  const oldWelcome = Views.welcome;
  Views.welcome = function(){
    let h=oldWelcome();
    if(!h.includes('Accéder à l’espace client')) h=h.replace('</div>`;', '<button class="btn btn-ghost btn-block" style="max-width:320px;position:relative;z-index:1;margin-top:8px;" onclick="Router.go(\'shop\')">Accéder à l’espace client</button></div>`;');
    return h;
  };

  /* 4) Email transactionnel : prêt pour une Supabase Edge Function. */
  async function sendSiamsEmail(to, subject, html, text, template_key, variables){
    try{
      const body={to,subject,html,text}; if(template_key){body.template_key=template_key;body.variables=variables||{};} const {data,error}=await sb.functions.invoke('send-siams-email',{body});
      if(error) throw error;
      return {ok:true,data};
    }catch(e){ console.warn('SIAMS email service:',e); return {ok:false,error:e}; }
  }
  window.sendSiamsEmail=sendSiamsEmail;

  async function saveRegistrationRequest(payload){
    const request={
      id: Utils.uid(), name:payload.name||'', shop:payload.shop||'', email:payload.email||'', phone:payload.phone||'',
      request:payload.request||'Création de compte SIAMS', status:'pending', created_at:new Date().toISOString(), source:payload.source||'registration'
    };
    try{
      const {data,error}=await sb.from('registration_requests').insert(request).select().single();
      if(error) throw error;
      try{localStorage.setItem('siams_last_registration_request',JSON.stringify(data||request));}catch(e){}
      return data||request;
    }catch(e){
      console.error('saveRegistrationRequest error:',e);
      try{ Toast.show('Erreur enregistrement demande : '+(e.message||e.code||JSON.stringify(e))); }catch(t){}
      try{
        const arr=JSON.parse(localStorage.getItem('siams_registration_requests')||'[]');arr.unshift(request);localStorage.setItem('siams_registration_requests',JSON.stringify(arr.slice(0,100)));
      }catch(x){}
      return request;
    }
  }
  window.saveRegistrationRequest=saveRegistrationRequest;

  async function notifyRegistrationPending(payload){
    return sendSiamsEmail(payload.email,'','','','registration_pending',{name:payload.name||'',email:payload.email||'',support_email:SUPPORT_EMAIL});
  }

  /* 5) Demande partenaire : dashboard admin + email automatique au demandeur. */
  ActivationGate.sendPartnerRequest = async function(){
    const name=(document.getElementById('partner-name')?.value||'').trim();
    const shop=(document.getElementById('partner-shop')?.value||'').trim();
    const phone=(document.getElementById('partner-phone')?.value||'').trim();
    const request=(document.getElementById('partner-request')?.value||'').trim();
    if(!name||!phone||!request){Toast.show('Renseignez votre nom, votre téléphone et votre requête.');return;}
    const email=prompt('Votre e-mail pour recevoir la confirmation SIAMS :','');
    if(!email || !email.includes('@')){Toast.show('Un e-mail valide est nécessaire.');return;}
    const q={name,shop,phone,request,email,pending:true,createdAt:Date.now()}; this.saveRequest(q);
    const saved=await saveRegistrationRequest({name,shop,phone,email,request,source:'partner'});
    if(saved && saved.id){ q.requestId=saved.id; this.saveRequest(q); }
    const mail=await notifyRegistrationPending(q);
    Toast.show(mail.ok?'Demande enregistrée ✓ — e-mail envoyé':'Demande enregistrée ✓ — configurez le service e-mail SIAMS');
    Router.go('activation-code');
  };

  /* 6) Création de compte : la requête est enregistrée dès la tentative d'inscription. */
  window.doRegister = async function(){
    const email=(document.getElementById('auth-email__v46_2')||document.getElementById('auth-email'))?.value.trim()||'';
    const phone=document.getElementById('auth-phone')?.value.trim()||'';
    const pass=(document.getElementById('auth-pass__v46_2')||document.getElementById('auth-pass'))?.value||'';
    const pass2=document.getElementById('auth-pass2')?.value||'';
    const err=document.getElementById('auth-error__v46_2')||document.getElementById('auth-error');
    const btn=document.getElementById('auth-submit-btn__v46_2')||document.getElementById('auth-submit-btn');
    if(!ActivationGate.getStored()){Router.go('activation-code');return;}
    if(!email||!phone||!pass){err.textContent='Merci de remplir tous les champs';return;}
    if(pass.length<6){err.textContent='Le mot de passe doit contenir au moins 6 caractères';return;}
    if(pass!==pass2){err.textContent='Les mots de passe ne correspondent pas';return;}
    err.textContent='';btn.disabled=true;btn.textContent='Création...';
    /* ---- Une seule demande d'inscription par tentative de création : si l'utilisateur
       retente (mot de passe refusé, email déjà pris, coupure réseau...) avec le même
       e-mail, on réutilise la demande déjà enregistrée au lieu d'en créer une nouvelle
       et de renvoyer un e-mail "demande en attente" en double. ---- */
    const REQ_ID_KEY='siams_registration_request_id', REQ_EMAIL_KEY='siams_registration_request_email';
    const storedReqEmail=(localStorage.getItem(REQ_EMAIL_KEY)||'').toLowerCase();
    const storedReqId=localStorage.getItem(REQ_ID_KEY);
    let request;
    if(storedReqId && storedReqEmail===email.toLowerCase()){
      request={id:storedReqId};
    } else {
      const requestPayload={name:'Nouveau marchand',shop:'À renseigner après activation',email,phone,request:'Demande de création de compte marchand SIAMS',source:'registration'};
      request=await saveRegistrationRequest(requestPayload);
      await notifyRegistrationPending(requestPayload);
      try{ localStorage.setItem(REQ_ID_KEY,request.id||''); localStorage.setItem(REQ_EMAIL_KEY,email.toLowerCase()); }catch(e){}
    }
    const res=await Auth.register(email,pass,phone);
    if(!res.ok){btn.disabled=false;btn.textContent='Créer mon compte';err.textContent=res.message||'Création impossible';return;}
    try{sessionStorage.setItem('siams_activation_email',email.toLowerCase());}catch(e){}
    if(res.needsConfirm) ConfirmEmail.show(res.email); else OtpGate.start('register',res.email);
  };

  /* 7) Mot de passe oublié : plus de redirection vers le support. */
  window.contactSupportForgotPasswordCustom = async function(){
    const identifier=(document.getElementById('auth-email')?.value||'').trim();
    if(!identifier){Toast.show('Saisissez votre e-mail ou votre ID marchand.');return;}
    let email=identifier;
    if(!identifier.includes('@')){
      const resolved=await Auth.resolveEmail(identifier);
      if(!resolved.ok){Toast.show('ID marchand introuvable.');return;}
      email=resolved.email;
    }
    try{
      const redirectTo=location.origin+location.pathname+'#reset-password';
      const mail=await sendSiamsEmail(email,'','','','password_reset',{email,redirect_to:redirectTo,support_email:SUPPORT_EMAIL});
      if(!mail.ok) throw new Error('email');
      Toast.show('E-mail de réinitialisation envoyé ✓');
    }catch(e){console.error(e);Toast.show('Impossible d’envoyer l’e-mail de récupération.');}
  };

  window.contactSupportForgotPassword = async function(){
    const identifier=(document.getElementById('auth-email')?.value||'').trim();
    if(!identifier){Toast.show('Saisissez votre e-mail ou votre ID marchand.');return;}
    let email=identifier;
    if(!identifier.includes('@')){
      const resolved=await Auth.resolveEmail(identifier);
      if(!resolved.ok){Toast.show('ID marchand introuvable.');return;}
      email=resolved.email;
    }
    try{
      const redirectTo=location.origin+location.pathname+'#reset-password';
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
      if(error) throw error;
      Toast.show('Lien de réinitialisation envoyé par e-mail ✓');
    }catch(e){console.error(e);Toast.show('Impossible d’envoyer l’e-mail de récupération.');}
  };

  /* 8) ID marchand oublié : récupération automatique et envoi direct par e-mail SIAMS. */
  if(window.RecoverId){
    RecoverId.submitEmail = async function(){
      const email=document.getElementById('recover-value')?.value.trim().toLowerCase()||'';
      const err=document.getElementById('recover-error');
      const btn=document.getElementById('recover-submit-btn');
      if(!email){err.textContent='Merci de renseigner l’adresse e-mail du compte';return;}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Veuillez saisir une adresse e-mail valide';return;}
      err.textContent=''; btn.disabled=true; btn.textContent='Recherche de votre compte…';
      try{
        const {data,error}=await sb.rpc('find_login_id_by_email',{p_email:email});
        if(error || !data){
          err.textContent='Aucun compte marchand SIAMS trouvé avec cette adresse e-mail.';
          return;
        }
        const merchantId=typeof data==='string' ? data : (data.login_id||data.id||data.loginId||'');
        if(!merchantId){err.textContent='Impossible de récupérer votre ID marchand. Merci de réessayer.';return;}
        btn.textContent='Envoi de l’e-mail…';
        const mail=await sendSiamsEmail(email,'','','','merchant_id_recovery',{name:'Marchand',email,merchant_id:merchantId,support_email:SUPPORT_EMAIL});
        if(!mail.ok){
          err.textContent='Votre ID a été retrouvé, mais l’envoi automatique de l’e-mail n’est pas configuré. Configurez le service e-mail SIAMS.';
          return;
        }
        btn.textContent='E-mail envoyé ✓';
        Toast.show('Votre ID marchand a été envoyé par e-mail ✓');
        setTimeout(()=>Router.go('login'),900);
      }catch(e){
        console.error(e);
        err.textContent='Une erreur est survenue. Merci de réessayer.';
      }finally{
        if(btn && btn.textContent!=='E-mail envoyé ✓'){btn.disabled=false;btn.textContent='Recevoir mon ID par e-mail';}
      }
    };
    RecoverId.submitWhatsapp = function(){ Toast.show('La récupération se fait désormais automatiquement par e-mail.'); };
  }

  /* 9) Messagerie marketing marchand → boîte client + popup à l’arrivée sur la vitrine. */
  const MSG_KEY='siams_store_messages_';
  const getSlug=()=>((Store.store&&Store.store.slug)||'default');
  const getLocalMsgs=()=>{try{return JSON.parse(localStorage.getItem(MSG_KEY+getSlug())||'[]');}catch(e){return[];}};
  const setLocalMsgs=a=>{try{localStorage.setItem(MSG_KEY+getSlug(),JSON.stringify(a.slice(0,50)));}catch(e){}};
  async function publishStoreMessage(title,body,template){
    const msg={id:Utils.uid(),store_id:Cloud.storeId||null,slug:getSlug(),title,body,template:template||'custom',created_at:new Date().toISOString(),active:true};
    let remote=false;
    try{const {error}=await sb.from('store_messages').insert(msg);if(!error)remote=true;}catch(e){}
    setLocalMsgs([msg,...getLocalMsgs()]);
    if(remote) Toast.show('Message publié dans les boîtes clients ✓'); else Toast.show('Message enregistré localement ✓ — configurez la table store_messages pour le multi-appareils.');
    return msg;
  }
  window.publishStoreMessage=publishStoreMessage;

  const NOTIF_TEMPLATES_V47=[
    {id:'flash',icon:'⚡',name:'Offre flash',tag:'Urgence',title:'Vente Flash : -20% sur tout ! 🔥',body:'Plus que quelques heures pour en profiter. Utilisez le code FLASH20 avant minuit. Ne ratez pas ça !'},
    {id:'cart',icon:'🛒',name:'Panier abandonné',tag:'Rappel',title:'Vous avez oublié quelque chose ?',body:'Votre panier vous attend. Finalisez votre commande maintenant et profitez de la livraison gratuite !'},
    {id:'new',icon:'✨',name:'Nouveautés',tag:'Nouveaux produits',title:'Alerte Nouveautés ! 😍',body:'Notre nouvelle collection vient d’arriver en boutique. Découvrez les nouveaux produits disponibles dès maintenant.'},
    {id:'loyalty',icon:'🎁',name:'Fidélisation',tag:'Cadeau / Récompense',title:'Merci pour votre fidélité ! ❤️',body:'Pour vous remercier, profitez de votre code promo MERCI10 sur votre prochaine commande.'}
  ];
  function openMarketingComposer(){
    const old=document.getElementById('siams-v47-marketing');if(old){old.remove();return;}
    const html=`<div id="siams-v47-marketing" class="notif-v42-composer-wrap"><div class="notif-v42-backdrop" onclick="closeMarketingComposer()"></div><section class="notif-v42-sheet notif-v42-composer"><div class="notif-v42-head"><div><h3>Créer un message client</h3><div style="font-size:11px;color:var(--text-mid);margin-top:2px;">Prêt à envoyer dans les boîtes de vos clients.</div></div><button class="notif-v42-close" onclick="closeMarketingComposer()">×</button></div><div class="notif-v42-template-list">${NOTIF_TEMPLATES_V47.map(t=>`<button class="notif-v42-template" onclick="useMarketingTemplate('${t.id}')"><span class="notif-v42-template-icon">${t.icon}</span><span><b>${esc(t.name)}</b><small>${esc(t.tag)}</small></span><span class="notif-v42-template-arrow">›</span></button>`).join('')}</div><div id="v47-marketing-editor" style="display:none;padding:0 18px 20px"></div></section></div>`;
    document.body.insertAdjacentHTML('beforeend',html);requestAnimationFrame(()=>document.querySelector('#siams-v47-marketing .notif-v42-sheet')?.classList.add('show'));requestAnimationFrame(()=>document.querySelector('#siams-v47-marketing .notif-v42-backdrop')?.classList.add('show'));
  }
  window.openMarketingComposer=openMarketingComposer;
  window.closeMarketingComposer=()=>document.getElementById('siams-v47-marketing')?.remove();
  window.useMarketingTemplate=id=>{
    window._v47TemplateId=id;
    const t=NOTIF_TEMPLATES_V47.find(x=>x.id===id);if(!t)return;const e=document.getElementById('v47-marketing-editor');if(!e)return;
    e.style.display='block';e.innerHTML=`<div style="font-size:11px;color:var(--mango-dark);font-weight:800;margin-bottom:7px">${esc(t.tag)}</div><div class="field"><label>Titre</label><input id="v47-msg-title" value="${esc(t.title)}"></div><div class="field"><label>Message</label><textarea id="v47-msg-body" rows="5">${esc(t.body)}</textarea></div><div class="notif-v42-preview"><div style="font-size:10px;color:var(--text-soft);margin-bottom:4px">APERÇU CLIENT</div><b id="v47-preview-title">${esc(t.title)}</b><p id="v47-preview-body">${esc(t.body)}</p></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-outline" style="flex:1" onclick="closeMarketingComposer()">Annuler</button><button class="btn btn-primary" style="flex:1" onclick="publishMarketingMessage()">Partager</button></div><div style="font-size:10.5px;color:var(--text-soft);line-height:1.4;margin-top:8px">Le message est ajouté à la boîte Messages du client et peut s’afficher à l’arrivée sur la vitrine.</div>`;
    const a=e.querySelector('#v47-msg-title'),b=e.querySelector('#v47-msg-body');a.oninput=()=>document.getElementById('v47-preview-title').textContent=a.value;b.oninput=()=>document.getElementById('v47-preview-body').textContent=b.value;
  };
  window.publishMarketingMessage=async()=>{const t=document.getElementById('v47-msg-title')?.value.trim()||'Message SIAMS';const b=document.getElementById('v47-msg-body')?.value.trim()||'';await publishStoreMessage(t,b,window._v47TemplateId||'custom');closeMarketingComposer();};

  /* Remplace le bouton de partage des anciens modèles par le nouveau système. */
  window.shareNotifTemplate=async()=>{const title=document.getElementById('notif-template-title')?.value.trim()||'Notification';const body=document.getElementById('notif-template-body')?.value.trim()||'';await publishStoreMessage(title,body,'legacy');};

  /* Bouton dans l’onglet Codes promo. */
  const oldPromoView=Views.promos;
  Views.promos=function(){
    let h=oldPromoView();
    const button='<div style="margin:0 20px 14px"><button class="btn btn-primary btn-block" onclick="openMarketingComposer()">✉ Créer un message client</button><div style="font-size:10.5px;color:var(--text-soft);margin-top:6px;text-align:center">Offres flash · paniers abandonnés · nouveautés · fidélisation</div></div>';
    const marker='<div id="v15-promo-form" class="hidden"></div>';
    return h.includes(marker)?h.replace(marker,marker+button):h+button;
  };

  /* 10) Boîte client : messages marketing distants + popup vitrine. */
  const ClientMessages={
    _list:[],
    async load(){
      const local=getLocalMsgs();let remote=[];
      try{const {data,error}=await sb.from('store_messages').select('*').eq('store_id',Cloud.storeId).eq('active',true).order('created_at',{ascending:false}).limit(30);if(!error)remote=data||[];}catch(e){}
      const map=new Map([...remote,...local].map(x=>[x.id,x]));this._list=[...map.values()].sort((a,b)=>new Date(b.created_at||b.createdAt)-new Date(a.created_at||a.createdAt));return this._list;
    },
    render(){return this._list.length?this._list.map(m=>`<div style="padding:14px 0;border-bottom:1px solid var(--line)"><div style="font-size:13.5px;font-weight:800">${esc(m.title)}</div><div style="font-size:12.5px;line-height:1.5;color:var(--text-mid);margin-top:5px">${esc(m.body)}</div><div style="font-size:10.5px;color:var(--text-soft);margin-top:6px">${Utils.timeAgo(new Date(m.created_at||m.createdAt).getTime())}</div></div>`).join(''):'<div style="text-align:center;color:var(--text-mid);padding:35px 10px">Aucun message pour le moment.</div>';},
    async open(){await this.load();const w=document.getElementById('v47-client-messages');if(w){w.remove();return;}const html=`<div id="v47-client-messages" class="shop-sheet-overlay show" onclick="ClientMessages.close()"><div class="shop-sheet show" style="max-height:76vh" onclick="event.stopPropagation()"><div class="sheet-handle"></div><h3>Messages de la boutique</h3><p style="font-size:11.5px;color:var(--text-mid);margin-top:-5px">Offres, nouveautés et informations importantes.</p><div>${this.render()}</div><button class="btn btn-primary btn-block" style="margin-top:14px" onclick="ClientMessages.close()">Fermer</button></div></div>`;document.body.insertAdjacentHTML('beforeend',html);},
    close(){document.getElementById('v47-client-messages')?.remove();},
    async popup(){await this.load();const newest=this._list[0];if(!newest)return;const seenKey='siams_seen_message_'+newest.id;try{if(localStorage.getItem(seenKey))return;localStorage.setItem(seenKey,'1');}catch(e){}const el=document.createElement('div');el.id='v47-message-popup';el.innerHTML=`<div class="v47-message-backdrop"></div><div class="v47-message-pop"><div class="v47-message-icon">${newest.template==='flash'?'⚡':newest.template==='new'?'✨':newest.template==='loyalty'?'🎁':'✉'}</div><div style="font-size:10px;color:var(--indigo);font-weight:900;letter-spacing:.08em;text-transform:uppercase">Nouveau message</div><h3>${esc(newest.title)}</h3><p>${esc(newest.body)}</p><button class="btn btn-primary btn-block" onclick="document.getElementById('v47-message-popup')?.remove();ClientMessages.open()">Voir le message</button><button class="btn btn-ghost btn-block" onclick="document.getElementById('v47-message-popup')?.remove()">Plus tard</button></div>`;document.body.appendChild(el);}
  };
  window.ClientMessages=ClientMessages;
  const oldShopAccount=Views['shop-account'];
  Views['shop-account']=function(){
    let h=oldShopAccount();
    const marker=`<div class="acc-row" onclick="ClientNotify.openPanel()">`;
    const row=`<div class="acc-row" onclick="ClientMessages.open()"><div class="acc-row-icon">✉</div><div class="acc-row-text"><h4>Messages de la boutique</h4><p>Offres, nouveautés et informations importantes</p></div><div class="acc-row-chev">›</div></div>`;
    if(h.includes(marker)) h=h.replace(marker,row+marker);
    else h+=`<div style="padding:0 20px 20px"><button class="btn btn-outline btn-block" onclick="ClientMessages.open()">✉ Messages de la boutique</button></div>`;
    return h;
  };
  const oldAfterShop=Views._after_shop;
  Views._after_shop=async function(opts){if(oldAfterShop)oldAfterShop(opts);try{await ClientMessages.popup();}catch(e){}};

  /* 11) Notifications : bouton Vider la corbeille pour marchand + client + livreur. */
  const clearNotifications=()=>{Store.notifications=[];try{Store.notifications=[];}catch(e){}Notify.renderBell();Toast.show('Notifications supprimées ✓');};
  window.clearMerchantNotifications=clearNotifications;
  const oldMerchantOpen=window.SiamsV42OpenMerchant;
  if(oldMerchantOpen){window.SiamsV42OpenMerchant=function(){oldMerchantOpen();setTimeout(()=>{const root=document.getElementById('siams-v42-merchant');const actions=root?.querySelector('.notif-v42-actions');if(actions&&!actions.querySelector('.v47-trash')){actions.insertAdjacentHTML('afterbegin','<button class="btn btn-outline v47-trash" onclick="clearMerchantNotifications()">🗑 Vider la corbeille</button>');}},40);};}
  const oldClientOpen=ClientNotify.openPanel.bind(ClientNotify);
  ClientNotify.openPanel=function(){oldClientOpen();setTimeout(()=>{const root=document.getElementById('siams-v42-client');const actions=root?.querySelector('.notif-v42-actions');if(actions&&!actions.querySelector('.v47-trash'))actions.insertAdjacentHTML('afterbegin','<button class="btn btn-outline v47-trash" onclick="ClientNotify.clearAll()">🗑 Vider la corbeille</button>');},40);};
  ClientNotify.clearAll=function(){this._list=[];this.save();this.renderBadges();this.closePanel?.();Toast.show('Notifications supprimées ✓');};
  window.clearCourierNotifications=()=>{try{CourierNotify._list=[];CourierNotify.save();CourierNotify.badge();Toast.show('Notifications supprimées ✓');}catch(e){}};

  /* 12) Dashboard admin SIAMS pour les demandes. */
  async function loadAdminRequests(){
    try{const {data,error}=await sb.from('registration_requests').select('*').order('created_at',{ascending:false}).limit(100);if(!error)return data||[];}catch(e){}
    try{return JSON.parse(localStorage.getItem('siams_registration_requests')||'[]');}catch(e){return[];}
  }
  window.adminRequestStatus=async function(id,status){
    try{
      let row=null;
      try{const {data}=await sb.from('registration_requests').select('*').eq('id',id).single();row=data||null;}catch(e){}
      const {error}=await sb.from('registration_requests').update({status}).eq('id',id);if(error)throw error;
      if(row?.email){
        const key=status==='approved'?'account_approved':'account_rejected';
        await sendSiamsEmail(row.email,'','','',key,{name:row.name||'Marchand',email:row.email,reason:status==='rejected'?'Demande non validée après examen.':'',support_email:SUPPORT_EMAIL});
      }
      Toast.show(status==='approved'?'Compte approuvé — e-mail envoyé ✓':'Demande refusée — e-mail envoyé ✓');
    }catch(e){console.error(e);Toast.show('Statut mis à jour, mais l’e-mail n’a pas pu être envoyé.');}
    Router.go('siams-admin-requests');
  };
  Views['siams-admin-requests']=function(){
    if(!isSiamsAdmin())return `<div style="padding:30px 20px"><h2>Accès administrateur SIAMS</h2><p style="color:var(--text-mid)">Cette section est réservée au compte administrateur SIAMS.</p><button class="btn btn-primary btn-block" onclick="Router.go('dashboard')">Retour</button></div>`;
    const cached=(()=>{try{return JSON.parse(localStorage.getItem('siams_registration_requests')||'[]')}catch(e){return[]}})();
    return `<div class="topbar" style="padding-top:18px"><div><h1>Demandes SIAMS</h1><div style="font-size:11px;color:var(--text-mid)">Requêtes de création de compte</div></div><button class="bell-btn" onclick="Router.go('dashboard')">←</button></div><div id="v47-admin-requests" style="padding:0 20px 100px"><div style="padding:20px;text-align:center;color:var(--text-mid)">Chargement des demandes…</div></div>`;
  };
  Views._after_siams_admin_requests=async function(){
    const root=document.getElementById('v47-admin-requests');if(!root)return;const rows=await loadAdminRequests();
    if(!rows.length){root.innerHTML='<div style="padding:40px 10px;text-align:center;color:var(--text-mid)">Aucune demande pour le moment.</div>';return;}
    root.innerHTML=rows.map(r=>`<article style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:15px;margin-bottom:10px;box-shadow:var(--shadow-sm)"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>${esc(r.name||'Nouveau marchand')}</b><div style="font-size:11px;color:var(--text-mid);margin-top:3px">${esc(r.shop||'Boutique non renseignée')}</div></div><span class="badge ${r.status==='pending'?'pending':'confirmed'}">${esc(r.status||'pending')}</span></div><div style="font-size:12px;line-height:1.5;margin-top:10px"><b>E-mail :</b> ${esc(r.email)}<br><b>Téléphone :</b> ${esc(r.phone)}<br><b>Requête :</b> ${esc(r.request)}</div><div style="display:flex;gap:7px;margin-top:12px"><button class="btn btn-primary" style="flex:1" onclick="adminRequestStatus('${esc(r.id)}','approved')">✓ Approuver</button><button class="btn btn-outline" style="flex:1" onclick="adminRequestStatus('${esc(r.id)}','rejected')">Refuser</button></div></article>`).join('');
  };

  /* Ajout d’un accès admin sur le dashboard SIAMS. */
  const oldDash=Views.dashboard;
  /* CORRECTIF : le bouton "Demandes de certification boutique" faisait doublon avec l'espace
     unifié "Vérifications d'identité" (Marchands + Livreurs) ajouté plus loin dans le fichier
     (voir siams-v64-identity-script). On ne garde ici que le raccourci propre à cet écran
     (nouvelles demandes de compte), différent de la certification d'identité. */
  if(oldDash) Views.dashboard=function(){let h=oldDash();if(isSiamsAdmin())h=h.replace('<div class="dashboard-v2-head">','<div style="margin:0 20px 10px"><button class="btn btn-primary btn-block" onclick="Router.go(\'siams-admin-requests\')">🛡️ Demandes de comptes SIAMS</button></div><div class="dashboard-v2-head">');return h;};

  /* 12bis) Dashboard admin SIAMS pour les demandes de certification boutique
     (pièce d'identité + photo en temps réel, voir Store.submitVerification). */
  const VERIF_DOC_LABELS = { cni:'CNI (Carte Nationale d’Identité)', passeport:'Passeport', cmu:'Carte CMU', nationalite:'Certificat de nationalité', carte_scolaire:'Carte scolaire' };
  window._siamsAdminVerifRows = [];
  async function loadAdminVerifications(){
    try{
      const {data,error}=await sb.from('stores').select('id,name,phone,login_id,email,address,verification_status,verification_doc_type,verification_doc_url,verification_photo_url,verification_submitted_at').eq('verification_status','pending').order('verification_submitted_at',{ascending:true}).limit(100);
      if(!error) return data||[];
    }catch(e){console.error(e);}
    return [];
  }
  window.adminVerificationStatus=async function(storeId,status,reason){
    try{
      const patch = status==='verified'
        ? { verification_status:'verified', verified:true, verified_at:new Date().toISOString(), verification_reject_reason:null }
        : { verification_status:'rejected', verified:false, verification_reject_reason:reason||'Document illisible ou non conforme. Merci de soumettre à nouveau.' };
      const {error}=await sb.from('stores').update(patch).eq('id',storeId);
      if(error) throw error;
      Toast.show(status==='verified'?'Boutique certifiée ✓':'Demande refusée');
    }catch(e){console.error(e);Toast.show('Erreur lors de la mise à jour');}
    Router.go('siams-admin-verifications');
  };
  window.adminRejectVerification=function(storeId){
    const reason=prompt('Motif du refus (visible par le marchand) :','Document illisible ou non conforme. Merci de soumettre à nouveau.');
    if(reason===null) return;
    adminVerificationStatus(storeId,'rejected',reason);
  };
  /* ---- Génère un PDF récapitulatif du dossier (infos boutique + pièce +
     photo en temps réel), pour archivage ou envoi hors ligne. Réutilise jsPDF
     et loadImageAsDataURL, déjà utilisés pour le contrat et les reçus. ---- */
  window.adminDownloadVerificationPDF=async function(storeId){
    const logoPdf = await loadImageAsDataURL(LOGO_DATA_URI);

    const r=(window._siamsAdminVerifRows||[]).find(x=>x.id===storeId);
    if(!r){ Toast.show('Dossier introuvable, rechargez la page'); return; }
    if(!await ensureJsPDF()){ Toast.show('Génération PDF indisponible, réessayez'); return; }
    Toast.show('Préparation du PDF…');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 46;
    const blueDeep=[0,96,217], mid=[92,107,122], ink=[22,35,47], line=[220,228,236];
    let y = 0;
    try{ doc.addImage(logoPdf, 'PNG', W-margin-40, 30, 40, 40); }catch(e){}
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(blueDeep[0],blueDeep[1],blueDeep[2]);
    doc.text('Dossier de certification boutique', margin, 52);
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(mid[0],mid[1],mid[2]);
    doc.text('SIAMS — Vérification vendeur sérieux', margin, 68);
    doc.setDrawColor(line[0],line[1],line[2]); doc.line(margin, 84, W-margin, 84);
    y = 108;
    const rows = [
      ['Boutique', r.name||'—'],
      ['ID de connexion', r.login_id||'—'],
      ['Téléphone', r.phone||'—'],
      ['E-mail', r.email||'—'],
      ['Adresse', r.address||'—'],
      ['Pièce fournie', VERIF_DOC_LABELS[r.verification_doc_type]||r.verification_doc_type||'—'],
      ['Envoyé le', r.verification_submitted_at ? new Date(r.verification_submitted_at).toLocaleString('fr-FR') : '—']
    ];
    doc.setFontSize(11);
    rows.forEach(([label,val])=>{
      doc.setFont('helvetica','bold'); doc.setTextColor(ink[0],ink[1],ink[2]);
      doc.text(label, margin, y);
      doc.setFont('helvetica','normal'); doc.setTextColor(mid[0],mid[1],mid[2]);
      doc.text(String(val), margin+150, y);
      y += 20;
    });
    y += 10;
    doc.setDrawColor(line[0],line[1],line[2]); doc.line(margin, y, W-margin, y);
    y += 26;
    const [docImg, photoImg] = await Promise.all([loadImageAsDataURL(r.verification_doc_url), loadImageAsDataURL(r.verification_photo_url)]);
    const imgW = (W-margin*2-16)/2, imgH = imgW;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(ink[0],ink[1],ink[2]);
    doc.text('Pièce jointe', margin, y);
    doc.text('Photo en temps réel', margin+imgW+16, y);
    y += 10;
    try{ if(docImg) doc.addImage(docImg, 'PNG', margin, y, imgW, imgH); }catch(e){}
    try{ if(photoImg) doc.addImage(photoImg, 'PNG', margin+imgW+16, y, imgW, imgH); }catch(e){}
    y += imgH + 30;
    doc.setDrawColor(line[0],line[1],line[2]); doc.line(margin, y, W-margin, y);
    y += 18;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(mid[0],mid[1],mid[2]);
    doc.text("SIAMS — Yopougon, Abidjan, Côte d'Ivoire  •  0748964690  •  serviceclientsiams.ci@gmail.com", margin, y);
    doc.save(`certification-${(r.login_id||r.name||'boutique').toString().replace(/[^a-z0-9]+/gi,'-')}.pdf`);
  };
  Views['siams-admin-verifications']=function(){
    if(!isSiamsAdmin())return `<div style="padding:30px 20px"><h2>Accès administrateur SIAMS</h2><p style="color:var(--text-mid)">Cette section est réservée au compte administrateur SIAMS.</p><button class="btn btn-primary btn-block" onclick="Router.go('dashboard')">Retour</button></div>`;
    return `<div class="topbar" style="padding-top:18px"><div><h1>Certifications</h1><div style="font-size:11px;color:var(--text-mid)">Demandes de badge certifié en attente</div></div><button class="bell-btn" onclick="Router.go('dashboard')">←</button></div><div id="v49-admin-verifs" style="padding:0 20px 100px"><div style="padding:20px;text-align:center;color:var(--text-mid)">Chargement des demandes…</div></div>`;
  };
  Views._after_siams_admin_verifications=async function(){
    const root=document.getElementById('v49-admin-verifs');if(!root)return;const rows=await loadAdminVerifications();
    window._siamsAdminVerifRows=rows;
    if(!rows.length){root.innerHTML='<div style="padding:40px 10px;text-align:center;color:var(--text-mid)">Aucune demande en attente.</div>';return;}
    root.innerHTML=rows.map(r=>`<article style="background:#fff;border:1px solid var(--line);border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;gap:8px"><div><b>${esc(r.name||'Boutique')}</b><div style="font-size:11px;color:var(--text-mid);margin-top:3px">${esc(r.login_id||'')} · ${esc(r.phone||'')}</div></div><span class="badge pending">${esc(VERIF_DOC_LABELS[r.verification_doc_type]||r.verification_doc_type||'Pièce')}</span></div>
      <div style="font-size:11.5px;line-height:1.7;margin-top:10px;color:var(--text-mid);">
        ${r.email?`<div><b style="color:var(--text)">E-mail :</b> ${esc(r.email)}</div>`:''}
        ${r.address?`<div><b style="color:var(--text)">Adresse :</b> ${esc(r.address)}</div>`:''}
        <div><b style="color:var(--text)">Envoyé le :</b> ${r.verification_submitted_at?new Date(r.verification_submitted_at).toLocaleString('fr-FR'):''}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        ${r.verification_doc_url?`<a href="${esc(r.verification_doc_url)}" target="_blank"><img src="${esc(r.verification_doc_url)}" style="width:100%;border-radius:12px;border:1px solid var(--line);object-fit:cover;aspect-ratio:1/1"></a>`:'<div></div>'}
        ${r.verification_photo_url?`<a href="${esc(r.verification_photo_url)}" target="_blank"><img src="${esc(r.verification_photo_url)}" style="width:100%;border-radius:12px;border:1px solid var(--line);object-fit:cover;aspect-ratio:1/1"></a>`:'<div></div>'}
      </div>
      <div style="font-size:10.5px;color:var(--text-soft);margin-top:6px;">Pièce (gauche) · Photo en temps réel (droite) — envoyée le ${r.verification_submitted_at?new Date(r.verification_submitted_at).toLocaleDateString('fr-FR'):''}</div>
      <div style="display:flex;gap:7px;margin-top:12px"><button class="btn btn-primary" style="flex:1" onclick="adminVerificationStatus('${esc(r.id)}','verified')">✓ Certifier (badge vert)</button><button class="btn btn-outline" style="flex:1" onclick="adminRejectVerification('${esc(r.id)}')">Refuser</button></div>
      <button class="btn btn-ghost btn-block" style="margin-top:6px" onclick="adminDownloadVerificationPDF('${esc(r.id)}')">📄 Télécharger le dossier en PDF</button>
    </article>`).join('');
  };

  /* Suivi de l’utilisateur courant pour l’admin allowlist. */
  try{sb.auth.getUser().then(({data})=>{window._siamsCurrentAdminEmail=(data?.user?.email||'').toLowerCase();});}catch(e){}
  const oldAuthLogin=Auth.login.bind(Auth);
  Auth.login=async function(email,password){const r=await oldAuthLogin(email,password);if(r.ok)window._siamsCurrentAdminEmail=(r.email||email||'').toLowerCase();return r;};

  /* 13) Reçu commande : version visuelle type reçu de transaction, identité SIAMS. */
  window.buildReceiptDataURL=function(order){
    const store=Store.store||{};const W=760;const pad=42;const lineH=34;const rows=order.items?.length||1;const H=920+rows*lineH;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    x.fillStyle='#f2f4f7';x.fillRect(0,0,W,H);
    x.fillStyle='#fff';roundRect(x,38,28,W-76,H-56,22);x.fill();
    x.fillStyle='#0a62c9';roundRect(x,38,28,W-76,170,22);x.fill();x.fillStyle='#0a62c9';x.fillRect(38,140,W-76,58);
    x.fillStyle='#fff';x.font='800 28px Arial';x.textAlign='center';x.fillText('SIAMS',W/2,74);x.font='700 17px Arial';x.fillText('REÇU DE COMMANDE',W/2,105);x.font='500 12px Arial';x.fillText('Transaction confirmée par la boutique',W/2,128);
    let y=228;x.textAlign='left';x.fillStyle='#657083';x.font='700 12px Arial';x.fillText('APERÇU',pad,y);y+=25;
    const info=[['Type de transaction','Commande'],['Marchand',store.name||'Ma boutique'],['Montant',Utils.fmtFCFA(order.amount)],['Acheteur',`${order.customer?.name||'Client'} — ${order.customer?.phone||''}`]];
    x.fillStyle='#fff';x.strokeStyle='#e1e6ee';roundRect(x,pad,y,W-pad*2,185,16);x.fill();x.stroke();let iy=y+35;info.forEach(r=>{x.fillStyle='#111827';x.font='700 15px Arial';x.fillText(r[0],pad+18,iy);x.fillStyle='#697386';x.font='700 14px Arial';x.textAlign='right';x.fillText(String(r[1]),W-pad-18,iy);x.textAlign='left';iy+=40;});y+=215;
    x.fillStyle='#657083';x.font='700 12px Arial';x.fillText('DÉTAILS',pad,y);y+=22;x.fillStyle='#fff';roundRect(x,pad,y,W-pad*2,150,16);x.fill();x.stroke();
    const details=[['Statut',order.status==='delivered'?'✓ Livrée':order.status==='confirmed'?'✓ Confirmée':'En attente'],['Mode de paiement',PAY_LABELS[order.paymentMethod]||order.paymentMethod||'—'],['Date et heure',new Date(order.createdAt).toLocaleString('fr-FR')],['ID de commande','#'+order.number]];iy=y+34;details.forEach(r=>{x.fillStyle='#111827';x.font='700 14px Arial';x.fillText(r[0],pad+18,iy);x.fillStyle='#697386';x.font='700 13px Arial';x.textAlign='right';x.fillText(String(r[1]),W-pad-18,iy);x.textAlign='left';iy+=30;});y+=180;
    x.fillStyle='#0a62c9';x.font='800 14px Arial';x.fillText('ARTICLES',pad,y);y+=18;order.items.forEach(it=>{x.fillStyle='#fff';roundRect(x,pad,y,W-pad*2,lineH,9);x.fill();x.fillStyle='#111827';x.font='600 12px Arial';x.fillText(`${it.name} ×${it.qty}`,pad+12,y+22);x.textAlign='right';x.font='700 12px Arial';x.fillText(Utils.fmtFCFA(it.price*it.qty),W-pad-12,y+22);x.textAlign='left';y+=lineH+4;});
    y+=14;x.strokeStyle='#dfe5ed';x.beginPath();x.moveTo(pad,y);x.lineTo(W-pad,y);x.stroke();y+=32;x.fillStyle='#111827';x.font='800 18px Arial';x.fillText('TOTAL',pad,y);x.textAlign='right';x.fillStyle='#0a62c9';x.font='800 21px Arial';x.fillText(Utils.fmtFCFA(order.amount),W-pad,y);x.textAlign='left';y+=55;
    x.fillStyle='#eef6ff';roundRect(x,pad,y,W-pad*2,90,14);x.fill();x.fillStyle='#45627e';x.font='500 11px Arial';x.textAlign='center';x.fillText('Ce reçu est émis par SIAMS pour la commande indiquée.',W/2,y+32);x.fillText('Conservez-le comme preuve de votre transaction.',W/2,y+52);x.fillStyle='#0a62c9';x.font='800 12px Arial';x.fillText('SIAMS · '+(SUPPORT_EMAIL),W/2,y+72);return c.toDataURL('image/png');
  };
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.rect(x,y,w,h));ctx.closePath();}

  /* Re-rendu et nettoyage final. */
  removeThemeUi();
  setTimeout(removeThemeUi,0);setTimeout(removeThemeUi,250);
})();
