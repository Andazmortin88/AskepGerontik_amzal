import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
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
  if(action==='bootstrap')return reply({status:'success',profile,roster:await scopedRoster(profile,period),period});
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
   const meta=(x:any)=>({id:x.id,owner_id:x.owner_id,period:x.period,file_size:x.file_size,document_revision:x.document_revision,created_at:x.created_at,review_revision:x.review_revision,review_status:x.review_status,feedback:x.feedback,student:roster.find(r=>r.auth_user_id===x.owner_id)?.name||'Mahasiswa'});
   if(action==='listPdf'){
    if(!owners.length)return reply({status:'success',reports:[],hasMore:false});
    const offset=Math.max(0,Math.trunc(Number(p.offset)||0));
    const reports=await must<any[]>(db.from('gerontik_learning_pdf').select('*').eq('period',period).in('owner_id',owners).order('created_at',{ascending:false}).order('id').range(offset,offset+49));
    return reply({status:'success',reports:reports.map(meta),hasMore:reports.length===50});
   }
   if(action==='uploadPdf'){
    if(!profile.roles.includes('student')||isLecturer(profile))throw new HttpError(403,'Hanya mahasiswa dapat mengirim PDF miliknya.');
    if(!uuid(p.reportId)||!Number.isInteger(p.expectedRevision)||!(uploadFile instanceof File)||uploadFile.type!=='application/pdf'||uploadFile.size<8||uploadFile.size>15728640)throw new HttpError(400,'Pilih PDF maksimal 15 MB dan revisi dokumen yang valid.');
    const bytes=new Uint8Array(await uploadFile.arrayBuffer()),decode=new TextDecoder();
    if(decode.decode(bytes.subarray(0,5))!=='%PDF-'||!decode.decode(bytes.subarray(Math.max(0,bytes.length-1024))).includes('%%EOF'))throw new HttpError(400,'Struktur PDF tidak valid.');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const prior=await must<any>(db.from('gerontik_learning_pdf').select('*').eq('id',p.reportId).maybeSingle());
    if(prior){if(prior.owner_id!==profile.userId||prior.period!==period||prior.sha256!==hash||prior.document_revision!==p.expectedRevision)throw new HttpError(409,'ID laporan sudah dipakai.');return reply({status:'success',report:meta(prior)});}
    const own=roster.find(r=>r.auth_user_id===profile.userId);if(!own)throw new HttpError(403,'Peserta belum aktif.');
    const doc=await fetchDocument(own);if(!doc||doc.revision!==p.expectedRevision)throw new HttpError(409,'Simpan dan muat revisi terbaru sebelum membuat PDF.');
    const path='reports/'+profile.userId+'/'+p.reportId+'.pdf';
    const {error:upError}=await db.storage.from('gerontik-learning-pdf').upload(path,bytes,{contentType:'application/pdf',upsert:false});
    if(upError)throw new HttpError(409,'Pengiriman PDF belum selesai. Periksa daftar dan coba kembali.');
    try{const saved=await must<any>(db.from('gerontik_learning_pdf').insert({id:p.reportId,owner_id:profile.userId,period,path,sha256:hash,file_size:bytes.length,document_revision:p.expectedRevision}).select('*').single());return reply({status:'success',report:meta(saved)});}catch(e){await db.storage.from('gerontik-learning-pdf').remove([path]);throw e;}
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

