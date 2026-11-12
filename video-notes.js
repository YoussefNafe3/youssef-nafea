/* Smart Video Notes — student-scoped Supabase persistence. */
(function(){
 'use strict';
 if(window.__smartVideoNotesLoaded)return;
 window.__smartVideoNotesLoaded=true;
 const panel=document.getElementById('videoNotesPanel');
 if(!panel)return;
 const input=document.getElementById('videoNotesInput');
 const list=document.getElementById('videoNotesList');
 const count=document.getElementById('videoNotesCount');
 const status=document.getElementById('videoNotesStatus');
 const clock=document.getElementById('videoNotesClock');
 const buttons=[...panel.querySelectorAll('[data-note-action]')];
 let activeVideoId=null, notes=[], loading=false, saving=false, clockTimer=null;
 const labels={note:'ملاحظة',question:'سؤال',bookmark:'علامة مرجعية'};
 const icons={note:'✎',question:'؟',bookmark:'★'};
 function currentTime(){
  try{
   if(state.currentVideo&&state.currentVideo.is_youtube&&state.yt)return Math.max(0,Math.floor(state.yt.getCurrentTime()||0));
   const el=document.getElementById('videoPlayer');
   return Math.max(0,Math.floor(el&&Number.isFinite(el.currentTime)?el.currentTime:state.lastTime||0));
  }catch(e){return Math.max(0,Math.floor(state.lastTime||0));}
 }
 function formatTime(value){const n=Math.max(0,Math.floor(Number(value)||0));return String(Math.floor(n/3600)).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
 function setStatus(message,isError){status.textContent=message||'';status.style.color=isError?'#ef4444':'';}
 function setBusy(value){saving=value;buttons.forEach(b=>b.disabled=value||!activeVideoId);}
 function render(){
  count.textContent=notes.length+' عنصر';
  list.replaceChildren();
  if(!notes.length){const empty=document.createElement('div');empty.className='video-notes-empty';empty.textContent='لم تضف ملاحظات لهذا الدرس بعد. احفظ أول فكرة مهمة أثناء المشاهدة.';list.appendChild(empty);return;}
  notes.forEach(note=>{
   const row=document.createElement('article');row.className='video-note-item';row.dataset.type=note.note_type;
   const icon=document.createElement('span');icon.className='video-note-type';icon.textContent=icons[note.note_type]||'✎';
   const main=document.createElement('div');main.className='video-note-main';
   const meta=document.createElement('div');meta.className='video-note-meta';
   const jump=document.createElement('button');jump.type='button';jump.className='video-note-time';jump.textContent=formatTime(note.timestamp_seconds);jump.title='الانتقال إلى هذه اللحظة';
   jump.addEventListener('click',()=>seek(note.timestamp_seconds));
   const label=document.createElement('span');label.className='video-note-label';label.textContent=labels[note.note_type]||'ملاحظة';
   meta.append(jump,label);main.append(meta);
   if(note.content){const content=document.createElement('div');content.className='video-note-content';content.textContent=note.content;main.append(content);}
   const tools=document.createElement('div');tools.className='video-note-tools';
   const del=document.createElement('button');del.type='button';del.className='video-note-tool';del.title='حذف';del.setAttribute('aria-label','حذف العنصر');del.textContent='×';
   del.addEventListener('click',()=>removeNote(note.id,del));tools.append(del);
   row.append(icon,main,tools);list.append(row);
  });
 }
 async function load(videoId){
  activeVideoId=String(videoId||'');notes=[];render();setStatus('جاري تحميل ملاحظات الدرس…');setBusy(true);
  if(!activeVideoId){setStatus('اختر فيديو لعرض ملاحظاته.');setBusy(false);return;}
  if(typeof client==='undefined'){setStatus('تعذر الاتصال بخدمة حفظ الملاحظات.',true);setBusy(false);return;}
  loading=true;
  try{
   const {data,error}=await client.from('student_video_notes').select('id,video_id,note_type,content,timestamp_seconds,created_at,updated_at').eq('video_id',activeVideoId).order('timestamp_seconds',{ascending:true}).order('created_at',{ascending:true});
   if(error)throw error;
   if(activeVideoId!==String(state.currentVideoId||''))return;
   notes=Array.isArray(data)?data:[];
   render();setStatus(notes.length?'ملاحظاتك محفوظة لهذا الدرس.':'ابدأ بإضافة ملاحظاتك أو علاماتك المرجعية.');
  }catch(error){console.error('[Video notes load]',error);setStatus('تعذر تحميل الملاحظات. حاول مرة أخرى.',true);}
  finally{loading=false;setBusy(false);}
 }
 async function add(type){
  if(saving||!activeVideoId||activeVideoId!==String(state.currentVideoId||''))return;
  const content=input.value.trim();
  if(type!=='bookmark'&&!content){input.focus();setStatus(type==='question'?'اكتب سؤالك أولاً.':'اكتب الملاحظة أولاً.',true);return;}
  if(content.length>3000){setStatus('الحد الأقصى للملاحظة 3000 حرف.',true);return;}
  setBusy(true);setStatus('جاري حفظ العنصر…');
  try{
   const {data,error}=await client.from('student_video_notes').insert({video_id:activeVideoId,note_type:type,content:content,timestamp_seconds:currentTime()}).select('id,video_id,note_type,content,timestamp_seconds,created_at,updated_at').single();
   if(error)throw error;
   if(activeVideoId!==String(state.currentVideoId||''))return;
   notes.push(data);notes.sort((a,b)=>a.timestamp_seconds-b.timestamp_seconds||new Date(a.created_at)-new Date(b.created_at));input.value='';render();setStatus(type==='bookmark'?'تم حفظ العلامة المرجعية.':'تم حفظ '+labels[type]+' بالتوقيت الحالي.');
  }catch(error){console.error('[Video notes save]',error);setStatus('لم يتم الحفظ. تحقق من الاتصال ثم حاول مجددًا.',true);}
  finally{setBusy(false);}
 }
 async function removeNote(id,button){
  if(saving||!activeVideoId)return;
  if(!window.confirm('هل تريد حذف هذا العنصر؟'))return;
  button.disabled=true;
  try{
   const {error}=await client.from('student_video_notes').delete().eq('id',id).eq('video_id',activeVideoId);
   if(error)throw error;
   notes=notes.filter(n=>n.id!==id);render();setStatus('تم حذف العنصر.');
  }catch(error){console.error('[Video notes delete]',error);button.disabled=false;setStatus('تعذر الحذف. حاول مرة أخرى.',true);}
 }
 function seek(seconds){
  const target=Math.max(0,Number(seconds)||0);
  try{
   if(state.currentVideo&&state.currentVideo.is_youtube&&state.yt){state.yt.seekTo(target,true);state.yt.playVideo();return;}
   const el=document.getElementById('videoPlayer');
   if(el){el.currentTime=target;const p=el.play();if(p&&typeof p.catch==='function')p.catch(()=>{});}
  }catch(error){console.warn('[Video notes seek]',error);setStatus('تعذر الانتقال إلى هذا التوقيت.',true);}
 }
 buttons.forEach(button=>button.addEventListener('click',()=>add(button.dataset.noteAction)));
 function updateClock(){clock.textContent=formatTime(currentTime());}
 document.addEventListener('platform:video-selected',event=>{const id=event.detail&&event.detail.videoId;if(id)load(id);else load(null);});
 if(state.currentVideoId)load(state.currentVideoId);else{setStatus('اختر فيديو من القائمة لتبدأ تدوين الملاحظات.');setBusy(false);}
 clockTimer=setInterval(updateClock,500);
 updateClock();
 window.addEventListener('pagehide',()=>{if(clockTimer)clearInterval(clockTimer);});
})();
