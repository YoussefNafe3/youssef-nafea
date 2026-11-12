/* Focus Mode controller — isolated from video playback/progress logic. */
(function(){
 'use strict';
 if(window.__platformFocusModeLoaded)return;
 window.__platformFocusModeLoaded=true;
 const body=document.body;
 const toolbar=document.querySelector('.player-toolbar');
 if(!toolbar)return;
 const STORE='yn_focus_session_v1';
 let remaining=25*60, elapsed=0, running=false, ticker=null, lastTick=0;
 const toggle=document.createElement('button');
 toggle.type='button';toggle.className='focus-mode-toggle';toggle.setAttribute('aria-pressed','false');
 toggle.innerHTML='<span class="focus-mode-icon" aria-hidden="true">◎</span><span class="focus-mode-label">وضع التركيز</span>';
 toggle.setAttribute('aria-label','تفعيل وضع التركيز');
 const timer=document.createElement('section');timer.className='focus-timer';timer.setAttribute('aria-label','مؤقت جلسة التركيز');
 timer.innerHTML='<div class="focus-timer-display"><strong class="focus-time">25:00</strong><small>وقت الجلسة</small></div><div class="focus-timer-actions"><button type="button" class="primary focus-start">ابدأ</button><button type="button" class="focus-reset">إعادة</button><button type="button" class="finish focus-finish">إنهاء</button></div><span class="focus-session-status" aria-live="polite">جاهز للبدء</span><span class="focus-mode-hint">يُحتسب الوقت أثناء نشاط الصفحة فقط</span>';
 toolbar.append(toggle,timer);
 const timeEl=timer.querySelector('.focus-time'),startBtn=timer.querySelector('.focus-start'),resetBtn=timer.querySelector('.focus-reset'),finishBtn=timer.querySelector('.focus-finish'),statusEl=timer.querySelector('.focus-session-status');
 function fmt(n){n=Math.max(0,Math.floor(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
 function render(){timeEl.textContent=fmt(remaining);startBtn.textContent=running?'إيقاف مؤقت':(elapsed?'استكمال':'ابدأ');statusEl.textContent=running?'الجلسة نشطة':(elapsed?'متوقفة مؤقتًا':'جاهز للبدء');}
 function save(){try{localStorage.setItem(STORE,JSON.stringify({remaining,elapsed,running,updatedAt:Date.now()}));}catch(e){}}
 function stopTicker(){if(ticker){clearInterval(ticker);ticker=null;}}
 function tick(){if(!running||document.hidden)return;const now=Date.now();if(lastTick)elapsed+=Math.max(0,Math.min(2,Math.round((now-lastTick)/1000)));lastTick=now;if(remaining>0)remaining=Math.max(0,remaining-1);if(remaining===0){running=false;stopTicker();statusEl.textContent='انتهى الوقت';if(typeof window.showPlatformToast==='function')window.showPlatformToast('أحسنت! انتهت جلسة التركيز. خذ استراحة قصيرة.','success');}render();save();}
 function start(){if(remaining===0)remaining=25*60;running=true;lastTick=Date.now();stopTicker();ticker=setInterval(tick,1000);render();save();}
 function pause(){running=false;lastTick=0;stopTicker();render();save();}
 function setFocus(active){body.classList.toggle('focus-mode-active',active);toggle.setAttribute('aria-pressed',String(active));toggle.querySelector('.focus-mode-label').textContent=active?'إنهاء وضع التركيز':'وضع التركيز';toggle.setAttribute('aria-label',active?'إنهاء وضع التركيز':'تفعيل وضع التركيز');try{sessionStorage.setItem('yn_focus_mode',active?'1':'0');}catch(e){}}
 toggle.addEventListener('click',()=>setFocus(!body.classList.contains('focus-mode-active')));
 startBtn.addEventListener('click',()=>running?pause():start());
 resetBtn.addEventListener('click',()=>{pause();remaining=25*60;elapsed=0;render();save();});
 finishBtn.addEventListener('click',()=>{pause();const mins=Math.floor(elapsed/60);if(typeof window.showPlatformToast==='function')window.showPlatformToast('انتهت الجلسة — وقت التركيز الفعلي: '+mins+' دقيقة.','success',5000);remaining=25*60;elapsed=0;render();save();setFocus(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(running){lastTick=0;save();}}else if(running){lastTick=Date.now();}});
 try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved&&Number.isFinite(saved.remaining)&&Number.isFinite(saved.elapsed)){remaining=Math.max(0,Math.min(25*60,saved.remaining));elapsed=Math.max(0,saved.elapsed);running=false;}}catch(e){}
 try{if(sessionStorage.getItem('yn_focus_mode')==='1')setFocus(true);}catch(e){}
 render();
 window.addEventListener('pagehide',save);
})();
