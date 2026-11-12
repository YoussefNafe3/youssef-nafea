/* Smart Video Notes — timestamped notes and bookmarks. */
(function(){
 'use strict';
 if(window.__smartVideoNotesLoaded)return;
 window.__smartVideoNotesLoaded=true;

 const panel=document.getElementById('videoNotesPanel');
 if(!panel)return;
 const $=id=>document.getElementById(id);
 const mainInput=$('videoNotesInput');
 const fsInput=$('videoNotesFullscreenInput');
 const list=$('videoNotesList');
 const count=$('videoNotesCount');
 const mainStatus=$('videoNotesStatus');
 const fsStatus=$('videoNotesFullscreenStatus');
 const mainClock=$('videoNotesClock');
 const fsClock=$('videoNotesFullscreenClock');
 const fsToggle=$('videoNotesFab');
 const playerStage=$('stage');
 const fsPopover=$('videoNotesFullscreenPopover');
 const fsClose=$('videoNotesFullscreenClose');
 const labels={note:'ملاحظة',question:'سؤال',bookmark:'علامة مرجعية'};
 const icons={note:'✎',question:'؟',bookmark:'★'};
 let activeVideoId=null, notes=[], saving=false, loadSequence=0, clockTimer=null;


 // First-use guide: shown once per signed-in student, never on later visits.
 const onboardingKey=(()=>{
  let identity='student';
  try{
   const user=JSON.parse(localStorage.getItem('user')||'null');
   identity=String(user?.id||user?.student_id||user?.phone||user?.auth_user_id||'student');
  }catch(e){}
  return 'video-notes-onboarding-v1:'+identity;
 })();
 let onboardingNode=null;
 function dismissOnboarding(){
  if(!onboardingNode)return;
  onboardingNode.classList.remove('is-visible');
  onboardingNode.setAttribute('aria-hidden','true');
  try{localStorage.setItem(onboardingKey,'seen');}catch(e){}
 }
 function positionOnboarding(){
  if(!onboardingNode||!fsToggle||!playerStage)return;
  const icon=fsToggle.getBoundingClientRect(),box=playerStage.getBoundingClientRect();
  const width=Math.min(245,Math.max(190,box.width-24));
  onboardingNode.style.width=width+'px';
  const height=onboardingNode.offsetHeight||58;
  let left=icon.left-box.left+icon.width/2-width/2;
  let top=icon.top-box.top-height-12;
  if(top<8)top=icon.bottom-box.top+12;
  left=Math.max(8,Math.min(left,box.width-width-8));
  top=Math.max(8,Math.min(top,box.height-height-8));
  onboardingNode.style.left=left+'px';
  onboardingNode.style.top=top+'px';
 }
 function showOnboarding(){
  if(!fsToggle||!playerStage)return;
  try{if(localStorage.getItem(onboardingKey)==='seen')return;}catch(e){}
  if(!onboardingNode){
   onboardingNode=document.createElement('div');
   onboardingNode.className='video-notes-onboarding';
   onboardingNode.setAttribute('role','status');
   onboardingNode.setAttribute('aria-hidden','true');
   onboardingNode.innerHTML='<span class="video-notes-onboarding-dot" aria-hidden="true"></span><span>يمكنك إضافة ملاحظة أثناء مشاهدة الفيديو من هنا</span><button type="button" aria-label="إغلاق التلميح">×</button>';
   playerStage.appendChild(onboardingNode);
   onboardingNode.querySelector('button').addEventListener('click',dismissOnboarding);
  }
  onboardingNode.setAttribute('aria-hidden','false');
  positionOnboarding();
  requestAnimationFrame(()=>onboardingNode?.classList.add('is-visible'));
  try{localStorage.setItem(onboardingKey,'seen');}catch(e){}
  window.setTimeout(()=>onboardingNode?.classList.remove('is-visible'),9000);
 }

 function formatTime(value){
  const n=Math.max(0,Math.floor(Number(value)||0));
  const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
 }
 function currentTime(){
  try{
   if(typeof state!=='undefined'&&state.currentVideo?.is_youtube&&state.yt&&typeof state.yt.getCurrentTime==='function')
    return Math.max(0,Math.floor(state.yt.getCurrentTime()||0));
   const media=$('videoPlayer');
   if(media&&Number.isFinite(media.currentTime))return Math.max(0,Math.floor(media.currentTime));
   return Math.max(0,Math.floor(typeof state!=='undefined'?state.lastTime||0:0));
  }catch(error){return Math.max(0,Math.floor(typeof state!=='undefined'?state.lastTime||0:0));}
 }
 function setStatus(message,isError,surface){
  const target=surface==='fullscreen'?fsStatus:mainStatus;
  if(!target)return;
  target.textContent=message||'';
  target.classList.toggle('is-error',!!isError);
 }
 function setBusy(value){
  saving=value;
  document.querySelectorAll('[data-note-action]').forEach(button=>{
   button.disabled=Boolean(value);
  });
 }
 function syncInputs(source){
  const value=source==='fullscreen'?fsInput.value:mainInput.value;
  if(source==='fullscreen')mainInput.value=value;else fsInput.value=value;
 }
 function render(){
  count.textContent=notes.length+' ملاحظة';
  list.replaceChildren();
  if(!notes.length){
   const empty=document.createElement('div');empty.className='video-notes-empty';
   empty.textContent='لا توجد ملاحظات لهذا الدرس حتى الآن.';
   list.appendChild(empty);return;
  }
  notes.forEach(note=>{
   const row=document.createElement('article');row.className='video-note-item';row.dataset.type=note.note_type;
   const icon=document.createElement('span');icon.className='video-note-type';icon.textContent=icons[note.note_type]||'✎';
   const main=document.createElement('div');main.className='video-note-main';
   const meta=document.createElement('div');meta.className='video-note-meta';
   const jump=document.createElement('button');jump.type='button';jump.className='video-note-time';
   jump.textContent=formatTime(note.timestamp_seconds);jump.title='الانتقال إلى هذه اللحظة';
   jump.addEventListener('click',()=>seek(note.timestamp_seconds));
   const label=document.createElement('span');label.className='video-note-label';label.textContent=labels[note.note_type]||'ملاحظة';
   meta.append(jump,label);main.append(meta);
   if(note.content){const content=document.createElement('div');content.className='video-note-content';content.textContent=note.content;main.append(content);}
   const tools=document.createElement('div');tools.className='video-note-tools';
   const del=document.createElement('button');del.type='button';del.className='video-note-tool';
   del.title='حذف';del.setAttribute('aria-label','حذف العنصر');del.textContent='×';
   del.addEventListener('click',()=>removeNote(note.id,del));
   tools.append(del);row.append(icon,main,tools);list.append(row);
  });
 }

 function positionNotesPopover(){
  if(!fsPopover||fsPopover.hidden||!fsToggle)return;
  const rect=fsToggle.getBoundingClientRect();
  const stage=fsToggle.closest('.stage');
  if(!stage)return;
  const bounds=stage.getBoundingClientRect();
  const width=Math.min(320,Math.max(220,bounds.width-20));
  fsPopover.style.width=width+'px';
  const height=fsPopover.offsetHeight||210;
  let left=rect.left-bounds.left+rect.width-width;
  let top=rect.bottom-bounds.top+8;
  left=Math.max(10,Math.min(left,bounds.width-width-10));
  if(top+height>bounds.height-8)top=rect.top-bounds.top-height-8;
  top=Math.max(8,Math.min(top,bounds.height-height-8));
  fsPopover.style.left=left+'px';
  fsPopover.style.top=top+'px';
  fsPopover.style.right='auto';
 }
 function openFullscreenNotes(){
  if(!fsPopover||!fsToggle)return;
  fsPopover.hidden=false;fsToggle.setAttribute('aria-expanded','true');
  fsToggle.classList.add('is-open');
  positionNotesPopover();
  setTimeout(()=>fsInput?.focus(),40);
 }
 function closeFullscreenNotes(){
  if(!fsPopover||!fsToggle)return;
  fsPopover.hidden=true;fsToggle.setAttribute('aria-expanded','false');
  fsToggle.classList.remove('is-open');
 }
 async function load(videoId){
  const sequence=++loadSequence;
  activeVideoId=String(videoId||'');
  if(activeVideoId)window.setTimeout(showOnboarding,450);
  notes=[];render();setStatus('جاري تحميل ملاحظات الفيديو…');setBusy(false);
  if(!activeVideoId){setStatus('اختر فيديو لعرض ملاحظاته.');setBusy(false);return;}
  try{
   const {data,error}=await client.from('student_video_notes')
    .select('id,video_id,note_type,content,timestamp_seconds,created_at,updated_at')
    .eq('video_id',activeVideoId)
    .order('timestamp_seconds',{ascending:true})
    .order('created_at',{ascending:true});
   if(error)throw error;
   if(sequence!==loadSequence)return;
   notes=Array.isArray(data)?data:[];
   render();
   setStatus(notes.length?'تم تحميل ملاحظات هذا الدرس.':'أضف أول ملاحظة أو علامة مرجعية.');
  }catch(error){
   if(sequence!==loadSequence)return;
   console.error('[Video notes load]',error);
   setStatus('تعذر تحميل الملاحظات. أعد المحاولة بعد التأكد من الاتصال.',true);
  }finally{
   if(sequence===loadSequence)setBusy(false);
  }
 }
 async function add(type,surface){
  const source=surface==='fullscreen'?fsInput:mainInput;
  const content=(source?.value||'').trim();
  if(saving)return;
  if(!activeVideoId){setStatus('اختر فيديو أولاً لحفظ الملاحظة.',true,surface);return;}
  if(type!=='bookmark'&&!content){
   source?.focus();setStatus(type==='question'?'اكتب سؤالك أولاً.':'اكتب الملاحظة أولاً.',true,surface);return;
  }
  if(content.length>3000){setStatus('الحد الأقصى 3000 حرف.',true,surface);return;}
  const videoAtSave=activeVideoId;
  setBusy(true);setStatus('جاري الحفظ…',false,surface);
  try{
   const {data,error}=await client.from('student_video_notes').insert({
    video_id:videoAtSave,note_type:type,content:content,timestamp_seconds:currentTime()
   }).select('id,video_id,note_type,content,timestamp_seconds,created_at,updated_at').single();
   if(error)throw error;
   if(videoAtSave!==activeVideoId)return;
   notes.push(data);
   notes.sort((a,b)=>a.timestamp_seconds-b.timestamp_seconds||new Date(a.created_at)-new Date(b.created_at));
   if(mainInput)mainInput.value='';
   if(fsInput)fsInput.value='';
   render();
   const success=type==='bookmark'?'تم حفظ اللحظة المرجعية.':'تم حفظ '+labels[type]+' بالتوقيت الحالي.';
   setStatus(success,false,surface);
   if(surface==='fullscreen')setStatus(success,false,'main');
  }catch(error){
   console.error('[Video notes save]',error);
   setStatus('لم يتم الحفظ. حاول مرة أخرى.',true,surface);
  }finally{setBusy(false);}
 }
 async function removeNote(id,button){
  if(saving||!activeVideoId)return;
  if(!window.confirm('هل تريد حذف هذا العنصر؟'))return;
  button.disabled=true;
  try{
   const {error}=await client.from('student_video_notes').delete().eq('id',id).eq('video_id',activeVideoId);
   if(error)throw error;
   notes=notes.filter(note=>note.id!==id);render();setStatus('تم حذف العنصر.');
  }catch(error){
   console.error('[Video notes delete]',error);button.disabled=false;
   setStatus('تعذر الحذف. حاول مرة أخرى.',true);
  }
 }
 function seek(seconds){
  const target=Math.max(0,Number(seconds)||0);
  try{
   if(typeof state!=='undefined'&&state.currentVideo?.is_youtube&&state.yt){
    state.yt.seekTo(target,true);state.yt.playVideo();return;
   }
   const media=$('videoPlayer');
   if(media){media.currentTime=target;const promise=media.play();if(promise?.catch)promise.catch(()=>{});return;}
   setStatus('مشغل الفيديو غير متاح حالياً.',true);
  }catch(error){console.warn('[Video notes seek]',error);setStatus('تعذر الانتقال إلى هذا التوقيت.',true);}
 }
 document.querySelectorAll('[data-note-action]').forEach(button=>{
  button.addEventListener('click',()=>add(button.dataset.noteAction,button.dataset.noteSurface||'main'));
 });
 fsToggle?.addEventListener('click',()=>{dismissOnboarding();fsPopover.hidden?openFullscreenNotes():closeFullscreenNotes();});
 fsClose?.addEventListener('click',closeFullscreenNotes);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&fsPopover&&!fsPopover.hidden)closeFullscreenNotes();});
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)closeFullscreenNotes();});
 document.addEventListener('webkitfullscreenchange',()=>{if(!document.webkitFullscreenElement)closeFullscreenNotes();});
 window.addEventListener('platform:video-selected',event=>{
  const id=event.detail?.videoId;
  load(id||null);
  closeFullscreenNotes();
 });
 function updateClock(){
  const value=formatTime(currentTime());
  if(mainClock)mainClock.textContent=value;
  if(fsClock)fsClock.textContent=value;
 }
 if(typeof state!=='undefined'&&state.currentVideoId)load(state.currentVideoId);
 else{setStatus('اختر فيديو من القائمة لتبدأ تدوين الملاحظات.');setBusy(false);}

 // Draggable floating note icon. Position is saved per browser/device.
 (function enableDraggableNotesIcon(){
  if(!fsToggle)return;
  const stage=fsToggle.closest('.stage');
  if(!stage)return;
  const key='video-notes-fab-position-v2';
  let dragging=false,moved=false,startX=0,startY=0,startLeft=0,startTop=0,pointerId=null;
  let suppressClick=false;
  const clamp=(v,min,max)=>Math.max(min,Math.min(v,max));
  function currentPosition(){
   const button=fsToggle.getBoundingClientRect(),box=stage.getBoundingClientRect();
   return {left:button.left-box.left,top:button.top-box.top};
  }
  function setPosition(left,top,persist){
   const maxLeft=Math.max(0,stage.clientWidth-fsToggle.offsetWidth);
   const maxTop=Math.max(0,stage.clientHeight-fsToggle.offsetHeight);
   left=clamp(left,4,maxLeft-4);top=clamp(top,4,maxTop-4);
   fsToggle.style.left=left+'px';fsToggle.style.top=top+'px';
   fsToggle.style.right='auto';fsToggle.style.bottom='auto';
   if(persist){
    try{localStorage.setItem(key,JSON.stringify({x:maxLeft?left/maxLeft:1,y:maxTop?top/maxTop:1}));}catch(e){}
   }
  }
  function restore(){
   try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
     const maxLeft=Math.max(0,stage.clientWidth-fsToggle.offsetWidth);
     const maxTop=Math.max(0,stage.clientHeight-fsToggle.offsetHeight);
     setPosition(saved.x*maxLeft,saved.y*maxTop,false);
    }
   }catch(e){}
  }
  restore();
  fsToggle.addEventListener('pointerdown',event=>{
   dismissOnboarding();
   if(event.button!==undefined&&event.button!==0)return;
   const p=currentPosition();dragging=true;moved=false;pointerId=event.pointerId;
   startX=event.clientX;startY=event.clientY;startLeft=p.left;startTop=p.top;
   try{fsToggle.setPointerCapture(pointerId);}catch(e){}
  });
  fsToggle.addEventListener('pointermove',event=>{
   if(!dragging||event.pointerId!==pointerId)return;
   const dx=event.clientX-startX,dy=event.clientY-startY;
   if(!moved&&Math.hypot(dx,dy)<5)return;
   moved=true;event.preventDefault();
   setPosition(startLeft+dx,startTop+dy,false);
  });
  function finish(event){
   if(!dragging||event.pointerId!==pointerId)return;
   dragging=false;
   if(moved){setPosition(...Object.values(currentPosition()),true);suppressClick=true;setTimeout(()=>suppressClick=false,180);}
   pointerId=null;
  }
  fsToggle.addEventListener('pointerup',finish);
  fsToggle.addEventListener('pointercancel',finish);
  fsToggle.addEventListener('click',event=>{
   if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  window.addEventListener('resize',()=>{const p=currentPosition();setPosition(p.left,p.top,false);positionNotesPopover();positionOnboarding();},{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{const p=currentPosition();setPosition(p.left,p.top,false);positionNotesPopover();positionOnboarding();},{passive:true});
 })();

 clockTimer=setInterval(updateClock,1000);updateClock();
 window.addEventListener('pagehide',()=>{if(clockTimer)clearInterval(clockTimer);});
})();