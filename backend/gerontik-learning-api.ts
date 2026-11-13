import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { portfolioMissing as finalMissing, weekProgress } from './progress.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
import './practice-schedule.js';
const practice=(globalThis as any).GerontikPractice;
const PERIOD='uji-v7';
const STAFF:Record<string,{name:string,roles:string[]}>= {
 'andazmortin@gmail.com':{name:'Amzal Mortin Andas',roles:['super_admin','lecturer']},
 'indahkeperawatan89@gmail.com':{name:'Indah Puspitasari',roles:['lecturer']}
};
const ORIGIN='https://andazmortin88.github.io';
const HEADERS={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
class HttpError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status} }
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...HEADERS,'Content-Type':'application/json'}});
const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v:any,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const email=(v:any)=>text(v,320).toLowerCase();
const isObject=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
async function must<T=any>(q:PromiseLike<{data:T,error:any}>):Promise<T>{const {data,error}=await q;if(error){console.error('database operation',error.code||'unknown');throw new HttpError(503,'Penyimpanan server belum berhasil. Perubahan lokal tetap perlu dikirim ulang.')}return data;}
function verifiedGoogle(u:any){return !!u?.id&&!!u.email_confirmed_at&&Array.isArray(u.identities)&&u.identities.some((i:any)=>i.provider==='google');}
async function profileFor(u:any){
 if(!verifiedGoogle(u))throw new HttpError(403,'Masuk dengan akun Google yang terverifikasi.');
 const e=email(u.email);if(!e)throw new HttpError(403,'Email Google tidak tersedia.');
 const old=await must(db.from('gerontik_learning_profiles').select('*').eq('auth_user_id',u.id).maybeSingle());
 const staff=STAFF[e];
 let roles=staff?.roles||['pending'];
 const registered=staff?[]:await must<any[]>(db.from('gerontik_learning_roster').select('id,auth_user_id').eq('email',e).eq('active',true));
 if(registered.some(r=>r.auth_user_id&&r.auth_user_id!==u.id))throw new HttpError(409,'Email peserta telah tertaut ke akun lain. Hubungi super admin.');
 if(!staff&&(registered.length||await must<any>(db.from('gerontik_learning_roster').select('id').eq('auth_user_id',u.id).eq('active',true).limit(1).maybeSingle())))roles=['student'];
 const name=staff?.name||old?.name||text(u.user_metadata?.full_name||u.user_metadata?.name,200)||e;
 if(!old||old.email!==e||old.name!==name||JSON.stringify(old.roles)!==JSON.stringify(roles))await must(db.from('gerontik_learning_profiles').upsert({auth_user_id:u.id,email:e,name,roles,updated_at:new Date().toISOString()},{onConflict:'auth_user_id'}));
 if(!staff&&registered.length)await must(db.from('gerontik_learning_roster').update({auth_user_id:u.id}).eq('email',e).is('auth_user_id',null).eq('active',true));
 return {userId:u.id,name,email:e,roles};
}
const isAdmin=(p:any)=>p.roles.includes('super_admin');
const isLecturer=(p:any)=>isAdmin(p)||p.roles.includes('lecturer');
function adminOnly(p:any){if(!isAdmin(p))throw new HttpError(403,'Fitur ini hanya untuk super admin.');}
async function scopedRoster(p:any,period:string,id?:string){
 let q=db.from('gerontik_learning_roster').select('*').eq('active',true).eq('period',period);
 if(id)q=q.eq('id',id);
 if(!isLecturer(p))q=q.eq('auth_user_id',p.userId);
 else if(!isAdmin(p)){
  const a=await must<any[]>(db.from('gerontik_learning_assignments').select('roster_id').eq('lecturer_email',p.email));
  if(!a.length)return [];
  q=q.in('id',a.map(r=>r.roster_id));
 }
 return await must<any[]>(q.order('created_at'));
}
async function fetchDocument(r:any){return r.auth_user_id?await must(db.from('gerontik_learning_documents').select('*').eq('owner_id',r.auth_user_id).eq('period',r.period).maybeSingle()):null;}
function checkedRows(value:any){
 if(!Array.isArray(value)||!value.length||value.length>1000)throw new HttpError(400,'Impor memerlukan 1–1000 peserta.');
 const nims=new Set<string>(),emails=new Set<string>();
 return value.map((r:any,i:number)=>{
  if(!isObject(r))throw new HttpError(400,'Baris '+(i+2)+' tidak valid.');
  const row={name:text(r.name),nim:text(r.nim,60),email:email(r.email),program:text(r.program,100)||'Profesi Ners',group:text(r.group,100)};
  if(!row.name||[row.name,row.nim,row.email,row.program,row.group].some(v=>/^[=+@\-]/.test(v)))throw new HttpError(400,'Nama atau nilai baris '+(i+2)+' tidak valid.');
  if(row.email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)||STAFF[row.email]))throw new HttpError(400,'Email peserta baris '+(i+2)+' tidak valid atau merupakan akun dosen.');
  if(row.nim&&nims.has(row.nim)||row.email&&emails.has(row.email))throw new HttpError(409,'NIM/email ganda pada berkas. Periksa pratinjau.');
  if(row.nim)nims.add(row.nim);if(row.email)emails.add(row.email);
  return row;
 });
}
function rpcReply(r:any){if(r.status==='success')return reply(r);if(r.status==='conflict')return reply({...r,message:'Versi server berubah. Muat ulang dan tinjau konflik sebelum mengirim.'},409);if(r.status==='locked')return reply({...r,message:'Dokumen sudah FINAL dan tidak dapat ditimpa.'},409);return reply({...r,message:'ID operasi sudah dipakai untuk perubahan berbeda.'},409);}
function validateReview(doc:any,p:any){
 const key=text(p.key||p.detail?.key||'competency',30);
 if(!['competency','logs','reflections','attendance'].includes(key))throw new HttpError(400,'Jenis review tidak valid.');
 const recordId=text(p.competencyId,100),record=(doc.state?.[key]||[]).find((r:any)=>r.id===recordId);
 if(!record)throw new HttpError(404,'Catatan mahasiswa tidak ditemukan pada dokumen tersimpan.');
 const detail=isObject(p.detail)?{...p.detail}:{};detail.key=key;detail.recordId=recordId;
 if(key==='competency'){
  const method=record.method,critical:Record<string,number[]>={DOPS:[0,1,2,4,5],'mini-CEX':[0,4,5],EBN:[4]};
  if(!critical[method])throw new HttpError(400,'Metode rubrik mahasiswa tidak valid.');
  detail.method=method;
  const scores=p.scores||detail.scores||[];
  if(!text(detail.observed,10)||detail.observed<record.date||detail.observed>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}))throw new HttpError(400,'Tanggal observasi tidak valid.');
  if(p.status==='Terverifikasi'){
   if(!Array.isArray(scores)||scores.length!==(method==='EBN'?6:7)||scores.some((s:any)=>s===' '||s===''||!(s==='NA'||(/^[0-4]$/.test(String(s))))))throw new HttpError(400,'Lengkapi seluruh skor rubrik 0–4 atau N/A.');
   const relevant=scores.filter((s:any)=>s!=='NA');
   if(!relevant.length||scores.includes('NA')&&!text(detail.naReason,1500))throw new HttpError(400,'N/A memerlukan alasan dan setidaknya satu aspek bernilai.');
   if(!['Kompeten dalam supervisi','Perlu perbaikan','Tidak dapat dinilai'].includes(detail.outcome))throw new HttpError(400,'Hasil penilaian tidak valid.');
   if(detail.outcome==='Kompeten dalam supervisi'&&(record.action==='Mengamati'||relevant.some((s:any)=>+s<3)||critical[method].some(i=>scores[i]==='NA'||+scores[i]<3)))throw new HttpError(400,'Bukti melakukan dan aspek keselamatan belum memenuhi aturan formatif.');
   detail.percent=Math.round(relevant.reduce((n:number,s:any)=>n+Number(s),0)/(4*relevant.length)*1000)/10;
  }else detail.percent=null;
  detail.scores=scores;
 }
 return {key,recordId,detail};
}
Deno.serve(async(req)=>{
 if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return reply({status:'error',message:'Origin tidak diizinkan.'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers:HEADERS});
 if(req.method!=='POST')return reply({status:'error',message:'Gunakan POST.'},405);
 try{
  const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data'),limit=multipart?16000000:4000000;
  if(Number(req.headers.get('content-length')||0)>limit)throw new HttpError(413,'Data melebihi batas pengiriman.');
  const reader=req.body?.getReader();let chunks:Uint8Array[]=[],size=0;if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new HttpError(413,'Data melebihi batas pengiriman.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  let body:any,uploadFile:any=null;try{if(multipart){const form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')!}}).formData();body={action:String(form.get('action')||''),payload:JSON.parse(String(form.get('payload')||'{}'))};uploadFile=form.get('file');}else body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Permintaan tidak valid.');}
  if(!isObject(body))throw new HttpError(400,'Permintaan tidak valid.');
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([^\s]+)$/i)?.[1];if(!token)throw new HttpError(401,'Silakan masuk dengan Google.');
  const {data:auth,error:authError}=await db.auth.getUser(token);if(authError||!auth?.user)throw new HttpError(401,'Sesi berakhir. Masuk kembali; data tersimpan tidak dihapus.');
  const profile=await profileFor(auth.user),p=isObject(body.payload)?body.payload:{},action=text(body.action,40),period=text(p.period,100)||PERIOD;
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(period))throw new HttpError(400,'Kode periode tidak valid.');
  if(action==='bootstrap'){
   const signedIn=auth.user.last_sign_in_at;
   if(!isLecturer(profile)&&typeof signedIn==='string'&&Number.isFinite(Date.parse(signedIn)))await must(db.from('gerontik_learning_login_events').upsert({auth_user_id:profile.userId,login_at:signedIn,email:profile.email,name:profile.name,account_status:profile.roles.includes('student')?'student':'pending'},{onConflict:'auth_user_id,login_at',ignoreDuplicates:true}));
   return reply({status:'success',profile,roster:await scopedRoster(profile,period),period});
  }
  if(action==='loginNotifications'||action==='readLoginNotification'){
   if(!isLecturer(profile))throw new HttpError(403,'Notifikasi hanya untuk dosen atau super admin.');
   const roster=await scopedRoster(profile,period),owners=roster.map(r=>r.auth_user_id).filter(Boolean);
   if(action==='readLoginNotification'){
    if(!uuid(p.eventId))throw new HttpError(400,'ID notifikasi tidak valid.');
    const event=await must<any>(db.from('gerontik_learning_login_events').select('id,auth_user_id').eq('id',p.eventId).maybeSingle());
    if(!event||!isAdmin(profile)&&!owners.includes(event.auth_user_id))throw new HttpError(404,'Notifikasi tidak tersedia untuk akun ini.');
    await must(db.from('gerontik_learning_login_receipts').upsert({event_id:event.id,reader_id:profile.userId},{onConflict:'event_id,reader_id',ignoreDuplicates:true}));
    return reply({status:'success'});
   }
   let q=db.from('gerontik_learning_login_events').select('id,auth_user_id,login_at,email,name,account_status');
   if(!isAdmin(profile)){if(!owners.length)return reply({status:'success',events:[]});q=q.in('auth_user_id',owners);}
   const events=await must<any[]>(q.order('login_at',{ascending:false}).order('id').limit(50));
   const receipts=events.length?await must<any[]>(db.from('gerontik_learning_login_receipts').select('event_id').eq('reader_id',profile.userId).in('event_id',events.map(e=>e.id))):[];
   return reply({status:'success',events:events.map(e=>({...e,name:roster.find(r=>r.auth_user_id===e.auth_user_id)?.name||e.name,read:receipts.some(r=>r.event_id===e.id)}))});
  }
  if(action==='notificationContact'||action==='saveNotificationContact'){
   if(!profile.roles.includes('student')||isLecturer(profile))throw new HttpError(403,'Pengaturan ini untuk akun mahasiswa sendiri.');
   if(action==='notificationContact'){const contact=await must<any>(db.from('gerontik_notification_contacts').select('email_enabled,whatsapp_phone,whatsapp_opt_in,consent_at').eq('owner_id',profile.userId).maybeSingle());return reply({status:'success',email:profile.email,contact:contact||{email_enabled:true,whatsapp_phone:'',whatsapp_opt_in:false}});}
   if(typeof p.emailEnabled!=='boolean'||typeof p.whatsappOptIn!=='boolean'||typeof p.phone!=='string')throw new HttpError(400,'Pengaturan kontak tidak valid.');
   let phone=p.phone.replace(/[\s()-]/g,'');if(phone.startsWith('08'))phone='+62'+phone.slice(1);else if(phone.startsWith('62'))phone='+'+phone;
   if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone)||p.whatsappOptIn&&!phone)throw new HttpError(400,'Gunakan nomor WhatsApp dengan kode negara, misalnya +62812…');
   await must(db.from('gerontik_notification_contacts').upsert({owner_id:profile.userId,email_enabled:p.emailEnabled,whatsapp_phone:phone,whatsapp_opt_in:p.whatsappOptIn,consent_at:p.whatsappOptIn?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'owner_id'}));return reply({status:'success'});
  }
  if(action==='reminderChannels'||action==='reminderDeliveries'){
   if(!isLecturer(profile))throw new HttpError(403,'Menu ini untuk dosen.');
   if(action==='reminderChannels')return reply({status:'success',enabled:Deno.env.get('REMINDER_SEND_ENABLED')==='true',emailConfigured:!!(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('REMINDER_EMAIL_FROM')),whatsappConfigured:!!(Deno.env.get('WHATSAPP_ACCESS_TOKEN')&&Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')&&Deno.env.get('WHATSAPP_REMINDER_TEMPLATE')&&Deno.env.get('WHATSAPP_GRAPH_VERSION'))});
   const roster=await scopedRoster(profile,period),ids=roster.map(r=>r.id);if(!ids.length)return reply({status:'success',deliveries:[]});
   const reminders=await must<any[]>(db.from('gerontik_weekly_reminders').select('id,roster_id,week,created_at').in('roster_id',ids).order('created_at',{ascending:false}).limit(50));
   const jobs=reminders.length?await must<any[]>(db.from('gerontik_reminder_outbox').select('id,reminder_id,channel,status,attempts,error_code,created_at').in('reminder_id',reminders.map(r=>r.id)).order('created_at',{ascending:false})):[];
   return reply({status:'success',deliveries:jobs.map(j=>({...j,student:roster.find(r=>r.id===reminders.find(x=>x.id===j.reminder_id)?.roster_id)?.name||'Mahasiswa'}))});
  }

  if(action==='setPracticeSchedule'){
   if(!isLecturer(profile))throw new HttpError(403,'Pengaturan jadwal hanya untuk dosen atau superadmin.');
   if(typeof p.startDate!=='string'||typeof p.enabled!=='boolean'||!Number.isInteger(p.inactiveDays)||p.inactiveDays<1||p.inactiveDays>10||!Array.isArray(p.targets)||!p.targets.length||p.targets.length>1000||p.targets.some((r:any)=>!uuid(r.roster_id)||!Number.isInteger(r.expected_revision)||r.expected_revision<0)||new Set(p.targets.map((r:any)=>r.roster_id)).size!==p.targets.length)throw new HttpError(400,'Pilih jadwal dan peserta yang valid.');
   try{practice.deadlines({enabled:true,start_date:p.startDate});}catch{throw new HttpError(400,'Tanggal mulai harus hari Senin yang valid.');}
   const allowed=await scopedRoster(profile,period);if(p.targets.some((r:any)=>!allowed.some(a=>a.id===r.roster_id)))throw new HttpError(403,'Jadwal hanya dapat diatur untuk peserta bimbingan sendiri.');
   return rpcReply(await must(db.rpc('gerontik_set_practice_schedule',{p_actor:profile.userId,p_targets:p.targets,p_start:p.startDate,p_enabled:p.enabled,p_inactive:p.inactiveDays})));
  }
  if(action==='loadSubmission'){
   if(!uuid(p.submissionId)||isLecturer(profile)&&!uuid(p.rosterId)||!isLecturer(profile)&&!profile.roles.includes('student'))throw new HttpError(403,'Kiriman tidak tersedia untuk akun ini.');
   const roster=await scopedRoster(profile,period,p.rosterId);if(roster.length!==1)throw new HttpError(404,'Peserta tidak tersedia.');
   const submission=await must<any>(db.from('gerontik_weekly_submissions').select('*').eq('id',p.submissionId).eq('owner_id',roster[0].auth_user_id).eq('period',period).maybeSingle());
   if(!submission)throw new HttpError(404,'Kiriman tidak tersedia.');
   const reviews=await must<any[]>(db.from('gerontik_weekly_reviews').select('id,decision,comment,created_at').eq('submission_id',submission.id).order('created_at',{ascending:false}));
   return reply({status:'success',student:roster[0].name,submission,reviews});
  }
  if(['monitoring','weeklyStatus','submitWeek','reviewWeek','sendReminder','readReminder'].includes(action)){
   const lecturer=isLecturer(profile);
   if(['monitoring','reviewWeek','sendReminder'].includes(action)&&!lecturer)throw new HttpError(403,'Menu ini hanya untuk dosen.');
   if(['submitWeek','readReminder'].includes(action)&&(lecturer||!profile.roles.includes('student')))throw new HttpError(403,'Menu ini hanya untuk mahasiswa.');
   if(p.rosterId&&!uuid(p.rosterId))throw new HttpError(400,'ID peserta tidak valid.');
   const roster=await scopedRoster(profile,period,p.rosterId),owners=roster.map(r=>r.auth_user_id).filter(Boolean);
   if(action==='monitoring'){
    const students=[];
    // Bounded state batches; raw clinical values never leave this summary endpoint.
    for(let i=0;i<roster.length;i+=5){const batch=roster.slice(i,i+5),ids=batch.map(r=>r.auth_user_id).filter(Boolean);
     const schedules=await must<any[]>(db.from('gerontik_roster_schedules').select('roster_id,start_date,enabled,inactive_days,revision').in('roster_id',batch.map(r=>r.id)));
     const docs=ids.length?await must<any[]>(db.from('gerontik_learning_documents').select('owner_id,state,revision,status,updated_at').eq('period',period).in('owner_id',ids)):[];
     const submissions=ids.length?await must<any[]>(db.from('gerontik_weekly_submissions').select('id,owner_id,week,status,attempt,review_revision,created_at,document_revision,due_at,is_late').eq('period',period).in('owner_id',ids).order('attempt',{ascending:false})):[];
     for(const r of batch){const d=docs.find(x=>x.owner_id===r.auth_user_id),schedule=schedules.find(s=>s.roster_id===r.id)||null;students.push({id:r.id,name:r.name,nim:r.nim,group:r.group_name,schedule,linked:!!r.auth_user_id,updatedAt:d?.updated_at||null,revision:d?.revision||0,documentStatus:d?.status||'EMPTY',weeks:[1,2].map(week=>{const progress=weekProgress(d?.state||{},week);return {...progress,missing:progress.missing.map(x=>({label:x.label,page:x.page,week:x.week,module:x.module,field:x.field})),submission:submissions.find(s=>s.owner_id===r.auth_user_id&&s.week===week)||null};})});}
    }
    return reply({status:'success',students});
   }
   if(action==='weeklyStatus'){
    if(roster.length!==1)throw new HttpError(400,'Pilih satu peserta.');
    const submissions=owners.length?await must<any[]>(db.from('gerontik_weekly_submissions').select('id,week,attempt,document_revision,status,review_revision,created_at,updated_at,progress,due_at,is_late').eq('period',period).in('owner_id',owners).order('attempt',{ascending:false})):[];
    const reviews=submissions.length?await must<any[]>(db.from('gerontik_weekly_reviews').select('id,submission_id,decision,comment,created_at').in('submission_id',submissions.map(s=>s.id)).order('created_at',{ascending:false})):[];
    const reminders=await must<any[]>(db.from('gerontik_weekly_reminders').select('id,week,message,read_at,created_at').eq('roster_id',roster[0].id).order('created_at',{ascending:false}).limit(50));
    const schedule=await must<any>(db.from('gerontik_roster_schedules').select('start_date,enabled,inactive_days,revision').eq('roster_id',roster[0].id).maybeSingle());return reply({status:'success',submissions,reviews,reminders,schedule});
   }
   if(action==='readReminder'){
    if(!uuid(p.reminderId)||roster.length!==1)throw new HttpError(400,'Pengingat tidak valid.');
    await must(db.from('gerontik_weekly_reminders').update({read_at:new Date().toISOString()}).eq('id',p.reminderId).eq('roster_id',roster[0].id));return reply({status:'success'});
   }
   if(!uuid(p.operationId))throw new HttpError(400,'ID operasi tidak valid.');
   if(action==='sendReminder'){
    if(p.channels!==undefined){
     if(!Array.isArray(p.channels)||p.channels.length>2||p.channels.some((x:any)=>!['email','whatsapp'].includes(x))||roster.length!==1||![1,2].includes(p.week)||!text(p.message,1000))throw new HttpError(400,'Pilih peserta, minggu, kanal, dan pesan yang valid.');
     const channels=[...new Set(p.channels)].sort();const result=await must<any>(db.rpc('gerontik_queue_reminder',{p_actor:profile.userId,p_roster:roster[0].id,p_week:p.week,p_message:text(p.message,1000),p_channels:channels,p_operation:p.operationId}));
     if(result.status==='rate_limited')return reply({status:'rate_limited',message:'Pengingat untuk mahasiswa ini baru dikirim. Tunggu satu menit.'},429);
     return rpcReply(result);
    }

    if(roster.length!==1||![1,2].includes(p.week)||!text(p.message,1000))throw new HttpError(400,'Pilih peserta, minggu dan pesan.');
    const payload={roster_id:roster[0].id,actor_id:profile.userId,operation_id:p.operationId,week:p.week,message:text(p.message,1000)};
    const prior=await must<any>(db.from('gerontik_weekly_reminders').select('*').eq('actor_id',profile.userId).eq('operation_id',p.operationId).maybeSingle());
    if(prior){if(prior.roster_id!==payload.roster_id||prior.week!==payload.week||prior.message!==payload.message)throw new HttpError(409,'ID operasi sudah dipakai.');return reply({status:'success'});}
    await must(db.from('gerontik_weekly_reminders').upsert(payload,{onConflict:'actor_id,operation_id',ignoreDuplicates:true}));
    const saved=await must<any>(db.from('gerontik_weekly_reminders').select('roster_id,week,message').eq('actor_id',profile.userId).eq('operation_id',p.operationId).single());
    if(saved.roster_id!==payload.roster_id||saved.week!==payload.week||saved.message!==payload.message)throw new HttpError(409,'ID operasi sudah dipakai.');return reply({status:'success'});
   }
   if(action==='submitWeek'){
    if(roster.length!==1||![1,2].includes(p.week)||!Number.isInteger(p.expectedRevision))throw new HttpError(400,'Minggu atau revisi tidak valid.');
    // A lost acknowledgment can be replayed even if later work advanced the draft.
    const prior=await must<any>(db.from('gerontik_weekly_submissions').select('id,period,week,document_revision').eq('owner_id',profile.userId).eq('operation_id',p.operationId).maybeSingle());
    if(prior){if(prior.period!==period||prior.week!==p.week||prior.document_revision!==p.expectedRevision)throw new HttpError(409,'ID operasi sudah dipakai.');return reply({status:'success',submissionId:prior.id});}
    const doc=await fetchDocument(roster[0]);if(!doc||doc.revision!==p.expectedRevision)throw new HttpError(409,'Simpan dan gunakan revisi terbaru.');
    const progress=weekProgress(doc.state,p.week);if(!progress.complete)return reply({status:'incomplete',message:'Isian minggu ini belum lengkap.',missing:progress.missing},400);
    return rpcReply(await must(db.rpc('gerontik_submit_week',{p_owner:profile.userId,p_period:period,p_week:p.week,p_expected:p.expectedRevision,p_operation:p.operationId,p_progress:progress})));
   }
   if(!uuid(p.submissionId)||!Number.isInteger(p.expectedRevision)||!['revision_requested','approved'].includes(p.decision)||!text(p.comment,3000))throw new HttpError(400,'Review memerlukan status dan komentar.');
   const submission=await must<any>(db.from('gerontik_weekly_submissions').select('id,owner_id').eq('id',p.submissionId).eq('period',period).maybeSingle());
   if(!submission||!owners.includes(submission.owner_id))throw new HttpError(404,'Kiriman tidak tersedia untuk akun ini.');
   return rpcReply(await must(db.rpc('gerontik_review_week',{p_actor:profile.userId,p_submission:p.submissionId,p_expected:p.expectedRevision,p_operation:p.operationId,p_decision:p.decision,p_comment:text(p.comment,3000)})));
  }

  if(action==='load'){
   if(p.rosterId&&!uuid(p.rosterId))throw new HttpError(400,'ID peserta tidak valid.');
   const roster=await scopedRoster(profile,period,p.rosterId);
   if(!roster.length)return reply({status:'success',document:null,reviews:[],pending:true});
   if(roster.length!==1)throw new HttpError(400,'Pilih satu peserta.');
   const r=roster[0],snapshot=r.auth_user_id?await must<any>(db.rpc('gerontik_learning_load',{p_owner:r.auth_user_id,p_period:r.period})):{document:null,reviews:[]};
   return reply({status:'success',...snapshot,roster:r});
  }
  if(['uploadPdf','listPdf','openPdf','reviewPdf'].includes(action)){
   const roster=await scopedRoster(profile,period),owners=roster.map(r=>r.auth_user_id).filter(Boolean);
   const meta=(x:any)=>({id:x.id,submission_id:x.submission_id||null,owner_id:x.owner_id,period:x.period,file_size:x.file_size,document_revision:x.document_revision,created_at:x.created_at,review_revision:x.review_revision,review_status:x.review_status,feedback:x.feedback,student:roster.find(r=>r.auth_user_id===x.owner_id)?.name||'Mahasiswa'});
   if(action==='listPdf'){
    if(!owners.length)return reply({status:'success',reports:[],hasMore:false});
    const offset=Math.max(0,Math.trunc(Number(p.offset)||0));
    const reports=await must<any[]>(db.from('gerontik_learning_pdf').select('*').eq('period',period).in('owner_id',owners).order('created_at',{ascending:false}).order('id').range(offset,offset+49));
    const bound=reports.map(r=>r.submission_id).filter(Boolean),submissions=bound.length?await must<any[]>(db.from('gerontik_weekly_submissions').select('id,week,attempt,is_late').eq('period',period).in('id',bound)):[];return reply({status:'success',reports:reports.map(r=>({...meta(r),submission:submissions.find(s=>s.id===r.submission_id)||null})),hasMore:reports.length===50});
   }
   if(action==='uploadPdf'){
    if(!profile.roles.includes('student')||isLecturer(profile))throw new HttpError(403,'Hanya mahasiswa dapat mengirim PDF miliknya.');
    if(!uuid(p.reportId)||!uuid(p.submissionId)||!Number.isInteger(p.expectedRevision)||!(uploadFile instanceof File)||uploadFile.type!=='application/pdf'||uploadFile.size<8||uploadFile.size>15728640)throw new HttpError(400,'Pilih PDF maksimal 15 MB dan revisi dokumen yang valid.');
    const bytes=new Uint8Array(await uploadFile.arrayBuffer()),decode=new TextDecoder();
    if(decode.decode(bytes.subarray(0,5))!=='%PDF-'||!decode.decode(bytes.subarray(Math.max(0,bytes.length-1024))).includes('%%EOF'))throw new HttpError(400,'Struktur PDF tidak valid.');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const prior=await must<any>(db.from('gerontik_learning_pdf').select('*').eq('id',p.reportId).maybeSingle());
    if(prior){if(prior.owner_id!==profile.userId||prior.period!==period||prior.sha256!==hash||prior.document_revision!==p.expectedRevision||prior.submission_id!==p.submissionId)throw new HttpError(409,'ID laporan sudah dipakai.');return reply({status:'success',report:meta(prior)});}
    const own=roster.find(r=>r.auth_user_id===profile.userId);if(!own)throw new HttpError(403,'Peserta belum aktif.');
    const submission=await must<any>(db.from('gerontik_weekly_submissions').select('id,document_revision').eq('id',p.submissionId).eq('owner_id',profile.userId).eq('period',period).maybeSingle());if(!submission||submission.document_revision!==p.expectedRevision)throw new HttpError(409,'PDF harus terkait revisi kiriman mingguan milik Anda.');
    const path='reports/'+profile.userId+'/'+p.reportId+'.pdf';
    const {error:upError}=await db.storage.from('gerontik-learning-pdf').upload(path,bytes,{contentType:'application/pdf',upsert:false});
    if(upError)throw new HttpError(409,'Pengiriman PDF belum selesai. Periksa daftar dan coba kembali.');
    try{const saved=await must<any>(db.from('gerontik_learning_pdf').insert({id:p.reportId,owner_id:profile.userId,period,path,sha256:hash,file_size:bytes.length,document_revision:p.expectedRevision,submission_id:p.submissionId}).select('*').single());return reply({status:'success',report:meta(saved)});}catch(e){await db.storage.from('gerontik-learning-pdf').remove([path]);throw e;}
   }
   if(!uuid(p.reportId))throw new HttpError(400,'ID laporan tidak valid.');
   const report=await must<any>(db.from('gerontik_learning_pdf').select('*').eq('id',p.reportId).eq('period',period).maybeSingle());
   if(!report||!owners.includes(report.owner_id))throw new HttpError(404,'Laporan tidak tersedia untuk akun ini.');
   if(action==='openPdf'){const {data,error}=await db.storage.from('gerontik-learning-pdf').createSignedUrl(report.path,600);if(error||!data?.signedUrl)throw new HttpError(503,'PDF belum dapat dibuka.');return reply({status:'success',url:data.signedUrl});}
   if(!isLecturer(profile)||!uuid(p.operationId)||!Number.isInteger(p.expectedRevision)||!['Perlu revisi','Terverifikasi'].includes(p.status)||!text(p.comment,10000))throw new HttpError(403,'Review PDF memerlukan dosen, revisi dan umpan balik.');
   return rpcReply(await must(db.rpc('gerontik_learning_pdf_review',{p_actor:profile.userId,p_report:p.reportId,p_operation:p.operationId,p_expected:p.expectedRevision,p_status:p.status,p_comment:text(p.comment,10000)})));
  }

  if(action==='save'){
   if(!profile.roles.includes('student'))throw new HttpError(403,'Hanya mahasiswa dapat menyimpan isian miliknya.');
   if(!uuid(p.operationId)||!Number.isInteger(p.expectedRevision)||p.expectedRevision<0||!isObject(p.state)||typeof p.finalize!=='undefined'&&typeof p.finalize!=='boolean')throw new HttpError(400,'Dokumen, revisi atau ID operasi tidak valid.');
   // Review authority lives only in gerontik_learning_reviews, never in student JSON.
   const state=structuredClone(p.state);
   const ownRoster=(await scopedRoster(profile,period))[0];if(!ownRoster)throw new HttpError(403,'Peserta belum terdaftar.');
   if(isObject(state.clinicalState)){state.clinicalState.mahasiswa={...(state.clinicalState.mahasiswa||{}),nama:ownRoster.name,nim:ownRoster.nim||'',status:ownRoster.program,kelas:ownRoster.group_name};}
   state.ownerAuthUserId=profile.userId;
   if(p.finalize===true){const missing=finalMissing(state);if(missing.length)return reply({status:'incomplete',message:'Portofolio belum lengkap: '+missing.slice(0,4).join('; ')+(missing.length>4?' (+'+(missing.length-4)+' bagian lainnya)':''),missing},400);}
   const cleanRecord=(r:any)=>{if(!isObject(r))return;delete r.reviews;delete r.outcome;if(['Terverifikasi','Perlu revisi'].includes(r.status))r.status='Diajukan';if(Array.isArray(r.history))r.history.forEach(cleanRecord);};
   for(const key of ['competency','logs','reflections','attendance'])if(Array.isArray(state[key]))state[key].forEach(cleanRecord);
   const r=await must(db.rpc('gerontik_learning_save',{p_owner:profile.userId,p_period:period,p_state:state,p_expected:p.expectedRevision,p_operation:p.operationId,p_final:p.finalize===true}));
   return rpcReply(r);
  }
  if(action==='listStudents'){
   if(!isLecturer(profile))throw new HttpError(403,'Menu ini untuk dosen.');
   const roster=await scopedRoster(profile,period),ids=roster.map(r=>r.auth_user_id).filter(Boolean);
   const docs=ids.length?await must<any[]>(db.from('gerontik_learning_documents').select('owner_id,revision,status,updated_at').eq('period',period).in('owner_id',ids)):[];
   const map=new Map(docs.map(d=>[d.owner_id,d]));
   const assignments=roster.length?await must<any[]>(db.from('gerontik_learning_assignments').select('roster_id,lecturer_email').in('roster_id',roster.map(r=>r.id))):[];
   return reply({status:'success',students:roster.map(r=>({...r,revision:map.get(r.auth_user_id)?.revision||0,document_status:map.get(r.auth_user_id)?.status||'EMPTY',updated_at:map.get(r.auth_user_id)?.updated_at||null,lecturers:assignments.filter(a=>a.roster_id===r.id).map(a=>a.lecturer_email)})),lecturers:Object.entries(STAFF).map(([email,s])=>({email,name:s.name}))});
  }
  if(action==='importRoster'){
   adminOnly(profile);if(!uuid(p.batchId))throw new HttpError(400,'ID impor tidak valid.');
   const rows=checkedRows(p.rows);
   const existing=await must<any[]>(db.from('gerontik_learning_roster').select('nim,email').eq('period',period));
   const prior=await must<any>(db.from('gerontik_learning_import_batches').select('batch_id').eq('batch_id',p.batchId).maybeSingle());
   if(!prior&&rows.some(r=>existing.some(e=>r.nim&&e.nim===r.nim||r.email&&e.email===r.email)))throw new HttpError(409,'NIM/email sudah terdaftar pada periode ini; data lama tidak ditimpa.');
   return rpcReply(await must(db.rpc('gerontik_learning_import',{p_actor:profile.userId,p_period:period,p_batch:p.batchId,p_rows:rows})));
  }
  if(action==='assign'){
   adminOnly(profile);if(!uuid(p.rosterId)||!STAFF[email(p.lecturerEmail)])throw new HttpError(400,'Peserta/dosen tidak valid.');
   const r=await scopedRoster(profile,period,p.rosterId);if(r.length!==1)throw new HttpError(404,'Peserta tidak ditemukan.');
   await must(db.from('gerontik_learning_assignments').upsert({roster_id:p.rosterId,lecturer_email:email(p.lecturerEmail),assigned_by:profile.userId},{onConflict:'roster_id,lecturer_email'}));
   return reply({status:'success'});
  }
  if(action==='pendingAccounts'){
   adminOnly(profile);const accounts=await must(db.from('gerontik_learning_profiles').select('auth_user_id,email,name,created_at').contains('roles',['pending']).limit(200));return reply({status:'success',accounts});
  }
  if(action==='approveLink'){
   adminOnly(profile);if(!uuid(p.rosterId)||!uuid(p.authUserId))throw new HttpError(400,'ID penautan tidak valid.');
   const {data:target,error}=await db.auth.admin.getUserById(p.authUserId);if(error||!verifiedGoogle(target?.user))throw new HttpError(400,'Akun tujuan belum login Google terverifikasi.');
   const targetEmail=email(target.user.email);if(STAFF[targetEmail])throw new HttpError(409,'Akun dosen tidak dapat dialihkan ke mahasiswa.');
   const r=(await scopedRoster(profile,period,p.rosterId))[0];if(!r||r.auth_user_id&&r.auth_user_id!==p.authUserId||r.email&&r.email!==targetEmail)throw new HttpError(409,'Peserta sudah tertaut atau email tidak sesuai.');
   await profileFor(target.user);
   const linked=await must<any[]>(db.from('gerontik_learning_roster').update({auth_user_id:p.authUserId,email:targetEmail}).eq('id',r.id).or('auth_user_id.is.null,auth_user_id.eq.'+p.authUserId).select('id'));
   if(!linked.length)throw new HttpError(409,'Penautan berubah; muat ulang peserta.');
   await profileFor(target.user);return reply({status:'success'});
  }
  if(action==='reopen'){
   if(!isLecturer(profile))throw new HttpError(403,'Hanya dosen pembimbing dapat membuka koreksi FINAL.');
   if(!uuid(p.rosterId)||!uuid(p.operationId)||!Number.isInteger(p.expectedRevision)||p.expectedRevision<1||!text(p.reason,3000))throw new HttpError(400,'Lengkapi peserta, revisi dan alasan pembukaan koreksi.');
   const r=(await scopedRoster(profile,period,p.rosterId))[0];if(!r)throw new HttpError(403,'Mahasiswa bukan bimbingan akun ini.');
   return rpcReply(await must(db.rpc('gerontik_learning_reopen',{p_actor:profile.userId,p_roster:r.id,p_expected:p.expectedRevision,p_operation:p.operationId,p_reason:text(p.reason,3000)})));
  }
  if(action==='review'){
   if(!isLecturer(profile))throw new HttpError(403,'Hanya dosen dapat memberi review.');
   if(!uuid(p.rosterId)||!uuid(p.operationId)||!Number.isInteger(p.expectedRevision)||!['Perlu revisi','Terverifikasi'].includes(p.status)||!text(p.comment,10000))throw new HttpError(400,'Lengkapi data review dan umpan balik.');
   const r=(await scopedRoster(profile,period,p.rosterId))[0];if(!r)throw new HttpError(403,'Mahasiswa bukan bimbingan akun ini.');
   const priorReview=await must<any>(db.from('gerontik_learning_reviews').select('id,document_revision,reviewer_name').eq('reviewer_id',profile.userId).eq('operation_id',p.operationId).maybeSingle());
   // Reconstruct the same normalized payload on retries, using the immutable
   // reviewed snapshot. A later student edit must not invalidate a successful
   // operation retry. The RPC still rejects any changed request fingerprint.
   const doc=priorReview
    ?await must<any>(db.from('gerontik_learning_document_versions').select('state,revision').eq('owner_id',r.auth_user_id).eq('period',r.period).eq('revision',priorReview.document_revision).maybeSingle())
    :await fetchDocument(r);
   if(!doc)throw new HttpError(priorReview?503:404,priorReview?'Riwayat penilaian belum dapat dimuat. Coba kembali.':'Mahasiswa belum menyimpan dokumen.');
   if(!priorReview&&doc.revision!==p.expectedRevision)return reply({status:'conflict',revision:doc.revision,message:'Dokumen mahasiswa berubah. Muat ulang sebelum menilai.'},409);
   const {recordId,detail}=validateReview(doc,p);detail.examiner=priorReview?.reviewer_name||profile.name;
   return rpcReply(await must(db.rpc('gerontik_learning_review',{p_actor:profile.userId,p_roster:r.id,p_operation:p.operationId,p_comment:text(p.comment,10000),p_status:p.status,p_competency:recordId,p_scores:p.scores||detail.scores||null,p_detail:detail,p_expected:p.expectedRevision})));
  }
  throw new HttpError(400,'Aksi tidak dikenal.');
 }catch(e){if(e instanceof HttpError)return reply({status:'error',message:e.message},e.status);console.error('learning api',e instanceof Error?e.name:'error');return reply({status:'error',message:'Permintaan belum berhasil. Data server tidak dinyatakan tersimpan.'},500);}
});

