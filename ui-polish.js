/* Accessible micro-interactions. No application data or navigation logic is changed. */
(function(){
 'use strict';
 var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var root=document.documentElement;
 root.classList.add('ui-motion-enabled');
 if(reduced){window.showPlatformToast=window.showPlatformToast||function(){};return;}
 function revealTargets(){
  var selectors='.overview-card,.overview-resume-card,.overview-next-card,.card,.feature-card,.subject-card,.admin-card,.admin-action-card,.main-card,.summary-card,.table-card,.video-card,.report-card,.latest-result-card,.honors-card,.assignment-card,.panel,.ai-panel,.qpanel,.notification,.student-notification-item';
  var nodes=document.querySelectorAll(selectors);
  var io=('IntersectionObserver' in window)?new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target);}});},{threshold:.06,rootMargin:'0px 0px -24px 0px'}):null;
  Array.prototype.forEach.call(nodes,function(node,index){
   if(node.dataset.uiMotionSeen)return;
   node.dataset.uiMotionSeen='1';
   node.classList.add('ui-reveal');
   var siblings=node.parentElement?node.parentElement.querySelectorAll(':scope > .ui-reveal'):[];
   node.style.setProperty('--ui-reveal-delay',Math.min(Math.max(siblings.length-1,0),5)*55+'ms');
   if(io)io.observe(node);else node.classList.add('is-visible');
  });
  if(io)window.setTimeout(function(){nodes.forEach(function(n){if(n.isConnected&&n.getBoundingClientRect().top<innerHeight)n.classList.add('is-visible');});},700);
 }
 function scanLoading(){
  var phrases=/^(جاري|جارٍ|جارى|جاري الآن|loading\b|please wait\b)/i;
  document.querySelectorAll('body *').forEach(function(el){
   if(el.children.length>0||el.closest('.ui-platform-toast'))return;
   var t=(el.textContent||'').trim();
   if(t.length<=100&&phrases.test(t)){el.classList.add('ui-loading-state');el.setAttribute('aria-busy','true');}
   else if(el.classList.contains('ui-loading-state')){el.classList.remove('ui-loading-state');el.removeAttribute('aria-busy');}
  });
 }
 var scanQueued=false;
 function queueScan(){if(scanQueued)return;scanQueued=true;requestAnimationFrame(function(){scanQueued=false;scanLoading();});}
 function init(){
  revealTargets();scanLoading();
  if('MutationObserver' in window){new MutationObserver(function(){queueScan();revealTargets();}).observe(document.body,{subtree:true,childList:true,characterData:true});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.showPlatformToast=function(message,type,duration){
  if(!message)return;
  var host=document.querySelector('.ui-platform-toast-host');
  if(!host){host=document.createElement('div');host.className='ui-platform-toast-host';host.setAttribute('aria-live','polite');host.setAttribute('aria-atomic','false');document.body.appendChild(host);}
  var toast=document.createElement('div');toast.className='ui-platform-toast';toast.dataset.type=['success','error','info'].indexOf(type)>=0?type:'info';
  var mark=document.createElement('span');mark.className='ui-platform-toast-mark';mark.setAttribute('aria-hidden','true');
  var text=document.createElement('span');text.textContent=String(message);toast.append(mark,text);host.appendChild(toast);
  window.setTimeout(function(){toast.style.animation='uiToastOut .2s ease both';window.setTimeout(function(){toast.remove();if(!host.children.length)host.remove();},220);},Math.max(1800,Number(duration)||3600));
 };
})();
