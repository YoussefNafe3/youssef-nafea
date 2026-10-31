(() => {
"use strict";
const URL="https://nhdowqzecpwmkunczodl.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5oZG93cXplY3B3bWt1bmN6b2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDAyNTUsImV4cCI6MjA5NjE3NjI1NX0.Tdfx0e610t059HG1QZVtsqO_UIppi8Axd02fU6jqqTo";
const STORE="dr_youssef_admin_notice_seen_v1";
const S={
students:{href:"admin.html",tables:[["students","created_at"]]},
videos:{href:"admin-videos.html",tables:[["videos","created_at"]]},
analytics:{href:"admin-analytics.html",tables:[["video_sessions","updated_at"]]},
files:{href:"admin-files.html",tables:[["study_files","created_at"]]},
password:{href:"admin-password-recovery.html",tables:[["password_reset_requests","created_at","pending"]]},
exams:{href:"admin-online-exams.html",tables:[["online_exams","updated_at"],["online_exam_attempts","submitted_at","submitted"]]},
results:{href:"admin-results.html",tables:[["exam_results","created_at"],["recitation_results","created_at"]]}
};
const style=document.createElement("style");
style.textContent=".admin-notice-badge{display:inline-flex!important;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 6px;margin-inline-start:auto;border-radius:999px;background:#ef3340;color:#fff!important;font:800 10px Arial,sans-serif;box-shadow:0 0 0 3px #ef334022,0 3px 12px #ef334055;vertical-align:middle;animation:adminNoticePulse 1.8s infinite;white-space:nowrap}.admin-notice-badge[hidden]{display:none!important}.admin-notice-total{margin-inline-start:7px}@keyframes adminNoticePulse{50%{box-shadow:0 0 0 6px #ef334411,0 3px 16px #ef334066}}@media(prefers-reduced-motion:reduce){.admin-notice-badge{animation:none}}";
document.head.appendChild(style);
let seen={};try{seen=JSON.parse(localStorage.getItem(STORE)||"{}")||{}}catch(e){}
const now=new Date().toISOString();
Object.keys(S).forEach(k=>{if(!(k in seen))seen[k]=k==="password"?"1970-01-01T00:00:00.000Z":now});
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(seen))}catch(e){}};
save();
if(!window.supabase?.createClient)return;
const db=window.supabase.createClient(URL,KEY),counts={};
const page=(location.pathname.split("/").pop()||"admin.html").toLowerCase();
const current=Object.keys(S).find(k=>S[k].href===page);
let active=false;
async function adminCheck(){
 const {data}=await db.auth.getSession(),session=data?.session;
 if(!session?.user?.email)return false;
 const phone=session.user.email.split("@")[0];
 const {data:row,error}=await db.from("students").select("role").eq("phone",phone).maybeSingle();
 return !error&&row?.role==="admin";
}
async function countSince(table,col,since,filter){
 let q=db.from(table).select("id",{count:"exact",head:true}).gt(col,since);
 if(filter==="pending")q=q.eq("status","pending");
 if(filter==="submitted")q=q.not("submitted_at","is",null);
 const {count,error}=await q;
 if(error){console.debug("[Admin notices]",table,error.message);return 0}
 return count||0;
}
async function latest(table,col,filter){
 let q=db.from(table).select(col).not(col,"is",null).order(col,{ascending:false}).limit(1);
 if(filter==="pending")q=q.eq("status","pending");
 const {data,error}=await q;return error?null:(data?.[0]?.[col]||null);
}
function render(){
 let total=0;
 Object.entries(S).forEach(([key,section])=>{
  const n=counts[key]||0;total+=n;
  document.querySelectorAll("a[href]").forEach(a=>{
   const href=(a.getAttribute("href")||"").split("?")[0].split("#")[0].split("/").pop();
   if(href!==section.href)return;
   let b=a.querySelector(":scope > .admin-notice-badge");
   if(!b){b=document.createElement("span");b.className="admin-notice-badge";b.setAttribute("aria-label","تحديثات جديدة");a.appendChild(b)}
   b.textContent=n>99?"99+":String(n);b.hidden=n<1;
  });
 });
 if(page!=="admin.html"){
  document.querySelectorAll('a[href="admin.html"]').forEach(a=>{
   let b=a.querySelector(":scope > .admin-notice-badge.admin-notice-total");
   if(!b){b=document.createElement("span");b.className="admin-notice-badge admin-notice-total";b.setAttribute("aria-label","تنبيهات جديدة في لوحة الإدارة");a.appendChild(b)}
   b.textContent=total>99?"99+":String(total);b.hidden=total<1;
  });
 }
}
async function refresh(){
 if(!active)return;
 for(const [key,section] of Object.entries(S)){
  let n=0;
  for(const [table,col,filter] of section.tables)n+=await countSince(table,col,seen[key],filter);
  counts[key]=n;
 }
 render();
}
async function markCurrentRead(){
 if(!current)return;
 let newest=null;
 for(const [table,col,filter] of S[current].tables){
  const v=await latest(table,col,filter);
  if(v&&(!newest||new Date(v)>new Date(newest)))newest=v;
 }
 if(newest&&(!seen[current]||new Date(newest)>new Date(seen[current])))seen[current]=newest;
 else if(!newest&&!seen[current])seen[current]=new Date().toISOString();
 save();
}
(async()=>{
 active=await adminCheck();if(!active)return;
 if(current)await markCurrentRead();
 await refresh();
 setInterval(refresh,25000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
})().catch(e=>console.warn("[Admin notices]",e));
})();