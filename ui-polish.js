/* Accessible micro-interactions. No application data or navigation logic is changed. */
(function(){
 'use strict';
 // Lightweight image loading optimization. Never delays visible/priority images.
 function optimizeImages(root){
  if(!root)return;
  var imgs=[];
  if(root.tagName==='IMG')imgs.push(root);
  if(root.querySelectorAll)root.querySelectorAll('img').forEach(function(img){imgs.push(img);});
  imgs.forEach(function(img){
   if(!img.hasAttribute('decoding'))img.decoding='async';
   if(img.loading==='eager'||img.getAttribute('fetchpriority')==='high')return;
   try{
    if(img.getBoundingClientRect().top>Math.max(window.innerHeight*1.15,700)&&!img.hasAttribute('loading'))img.loading='lazy';
   }catch(e){}
  });
 }

 var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.documentElement.classList.add('ui-motion-enabled');
 var selectors='.overview-card,.overview-resume-card,.overview-next-card,.card,.feature-card,.subject-card,.admin-card,.admin-action-card,.main-card,.summary-card,.table-card,.video-card,.report-card,.latest-result-card,.honors-card,.assignment-card,.panel,.ai-panel,.qpanel,.notification,.student-notification-item';
 function enhance(root){
  if(!root||root.nodeType!==1)return;
  var nodes=[];
  if(root.matches&&root.matches(selectors))nodes.push(root);
  if(root.querySelectorAll)root.querySelectorAll(selectors).forEach(function(n){nodes.push(n);});
  nodes.forEach(function(node){
   if(node.dataset.uiMotionSeen)return;
   node.dataset.uiMotionSeen='1';node.classList.add('ui-reveal');
   var siblings=node.parentElement?node.parentElement.querySelectorAll(':scope > .ui-reveal'):[];
   node.style.setProperty('--ui-reveal-delay',Math.min(Math.max(siblings.length-1,0),5)*55+'ms');
   if(observer)observer.observe(node);else node.classList.add('is-visible');
  });
  var loadingNodes=[];
  if(root.matches&&root.matches('body *'))loadingNodes.push(root);
  if(root.querySelectorAll)root.querySelectorAll('*').forEach(function(n){loadingNodes.push(n);});
  loadingNodes.forEach(function(el){
   // Keep login/authentication feedback readable; it is not a skeleton placeholder.
   if(el.matches('#msg,#signupSuccessNotice,[role="alert"],[data-auth-message]')||
      el.closest('#msg,#signupSuccessNotice,.auth-message,[data-auth-message]')){
    el.classList.remove('ui-loading-state');
    el.removeAttribute('aria-busy');
    return;
   }
   if(el.children.length>0||el.closest('.ui-platform-toast'))return;
   var t=(el.textContent||'').trim();
   if(t.length<=100&&/^(جاري|جارٍ|جارى|loading\\b|please wait\\b)/i.test(t)){el.classList.add('ui-loading-state');el.setAttribute('aria-busy','true');}
   else if(el.classList.contains('ui-loading-state')){el.classList.remove('ui-loading-state');el.removeAttribute('aria-busy');}
  });
 }

 function initImageOptimization(){
  function run(){optimizeImages(document);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  if('MutationObserver' in window){
   var imageObserver=new MutationObserver(function(records){
    records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1)optimizeImages(node);});});
   });
   var observe=function(){if(document.documentElement)imageObserver.observe(document.documentElement,{subtree:true,childList:true});};
   if(document.documentElement)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});
  }
 }
 initImageOptimization();
 if(reduced){window.showPlatformToast=window.showPlatformToast||function(){};return;}
 var observer=('IntersectionObserver' in window)?new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}});},{threshold:.06,rootMargin:'0px 0px -24px 0px'}):null;
 function init(){
  enhance(document.body);
  if('MutationObserver' in window)new MutationObserver(function(records){
   records.forEach(function(record){
    if(record.type==='characterData'){if(record.target.parentElement)enhance(record.target.parentElement);}
    else record.addedNodes.forEach(function(node){if(node.nodeType===1)enhance(node);else if(node.nodeType===3&&node.parentElement)enhance(node.parentElement);});
   });
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.showPlatformToast=function(message,type,duration){
  if(!message)return;
  var host=document.querySelector('.ui-platform-toast-host');
  if(!host){host=document.createElement('div');host.className='ui-platform-toast-host';host.setAttribute('aria-live','polite');host.setAttribute('aria-atomic','false');document.body.appendChild(host);}
  var toast=document.createElement('div');toast.className='ui-platform-toast';toast.dataset.type=['success','error','info'].indexOf(type)>=0?type:'info';
  var mark=document.createElement('span');mark.className='ui-platform-toast-mark';mark.setAttribute('aria-hidden','true');
  var content=document.createElement('span');content.textContent=String(message);toast.append(mark,content);host.appendChild(toast);
  window.setTimeout(function(){toast.style.animation='uiToastOut .2s ease both';window.setTimeout(function(){toast.remove();if(!host.children.length)host.remove();},220);},Math.max(1800,Number(duration)||3600));
 };
})();
