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
 const fsToggle=$('videoNotesFullscreenToggle');
 const fsPopover=$('videoNotesFullscreenPopover');
 const fsClose=$('videoNotesFullscreenClose');
 const labels={note:'ملاحظة',question:'سؤال',bookmark:'علامة مرجعية'};
 const icons={note:'✎',question:'؟',bookmark:'★'};
 let activeVideoId=null, notes=[], saving=false, loadSequence=0, clockTimer=null;

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
  }catch(error){return Math.max(0,Math.floor(window.state?.lastTime||0));}
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
   button.disabled=value||!activeVideoId;
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
 function openFullscreenNotes(){
  if(!fsPopover||!fsToggle)return;
  fsPopover.hidden=false;fsToggle.setAttribute('aria-expanded','true');
  fsToggle.classList.add('is-open');
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
  notes=[];render();setStatus('جاري تحميل ملاحظات الدرس…');setBusy(true);
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
  if(saving||!activeVideoId)return;
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
 fsToggle?.addEventListener('click',()=>fsPopover.hidden?openFullscreenNotes():closeFullscreenNotes());
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
 clockTimer=setInterval(updateClock,1000);updateClock();
 window.addEventListener('pagehide',()=>{if(clockTimer)clearInterval(clockTimer);});
})();