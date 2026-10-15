import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const BUCKET='gerontik-askep-pdf',LIMIT=15728640;
const C={'Access-Control-Allow-Origin':'https://andazmortin88.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...C,'Content-Type':'application/json'}});
const uuid=(x:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(x||''));
async function must<T>(result:PromiseLike<{data:T,error:any}>):Promise<T>{const {data,error}=await result;if(error)throw new Error('Database operation failed');return data;}
async function session(token:string){
 if(!token||token.length>256)return null;
 const s=await must<any>(db.from('gerontik_sessions').select('user_id,expires_at').eq('token',token).gt('expires_at',new Date().toISOString()).maybeSingle());
 if(!s)return null;
 return await must<any>(db.from('gerontik_users').select('user_id,full_name,nim,class_name,role').eq('user_id',s.user_id).eq('active',true).maybeSingle());
}
async function allowedStudents(u:any):Promise<string[]|null>{
 if(u.role==='ADMIN')return null;
 if(u.role==='STUDENT')return [u.user_id];
 if(u.role!=='INSTRUCTOR')return [];
 const assigned=await must<any[]>(db.from('gerontik_group_supervisors').select('group_id').eq('supervisor_user_id',u.user_id));
 if(!assigned.length)return [];
 const members=await must<any[]>(db.from('gerontik_group_members').select('student_user_id').eq('active',true).in('group_id',assigned.map(x=>x.group_id)));
 return [...new Set(members.map(x=>x.student_user_id))];
}
const metadata=(r:any)=>({report_id:r.report_id,student_user_id:r.student_user_id,version:r.version,file_name:r.file_name,file_size:r.file_size,snapshot_status:r.snapshot_status,review_status:r.review_status,feedback:r.feedback,reviewed_at:r.reviewed_at,review_revision:r.review_revision,created_at:r.created_at});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:C});
 if(req.method!=='POST')return reply({status:'error',message:'Metode tidak didukung.'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>LIMIT+100000)return reply({status:'error',message:'PDF maksimal 15 MB.'},413);
  const fd=await req.formData(),u=await session(String(fd.get('token')||''));
  if(!u)return reply({status:'auth_required',message:'Sesi berakhir. Silakan login kembali.'},401);
  const action=String(fd.get('action')||''),payload=JSON.parse(String(fd.get('payload')||'{}'));
  const scope=await allowedStudents(u);
  if(action==='list'){
   if(scope?.length===0)return reply({status:'success',reports:[],hasMore:false});
   const offset=Math.max(0,Math.min(100000,Math.trunc(Number(payload.offset)||0)));
   let q=db.from('gerontik_pdf_reports').select('*').order('created_at',{ascending:false}).order('report_id').range(offset,offset+49);
   if(scope)q=q.in('student_user_id',scope);
   const reports=await must<any[]>(q),ids=[...new Set(reports.map(r=>r.student_user_id))];
   const users=ids.length?await must<any[]>(db.from('gerontik_users').select('user_id,full_name,nim,class_name').in('user_id',ids)):[];
   const names=new Map(users.map(x=>[x.user_id,x]));
   return reply({status:'success',reports:reports.map(r=>({...metadata(r),student:names.get(r.student_user_id)})),hasMore:reports.length===50});
  }
  if(action==='upload'){
   if(u.role!=='STUDENT')return reply({status:'error',message:'Hanya mahasiswa dapat mengirim laporan.'},403);
   if(!uuid(payload.reportId))return reply({status:'error',message:'ID pengiriman tidak valid.'},400);
   const file=fd.get('file');
   if(!(file instanceof File)||file.type!=='application/pdf'||file.size<8||file.size>LIMIT)return reply({status:'error',message:'Berkas harus PDF berukuran 1 byte–15 MB.'},400);
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-'||!new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-1024))).includes('%%EOF'))return reply({status:'error',message:'Struktur berkas PDF tidak valid.'},400);
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   const existing=await must<any>(db.from('gerontik_pdf_reports').select('*').eq('report_id',payload.reportId).maybeSingle());
   if(existing){if(existing.student_user_id!==u.user_id||existing.sha256!==hash)return reply({status:'error',message:'ID pengiriman sudah digunakan.'},409);return reply({status:'success',report:metadata(existing)});}
   const period=await must<any>(db.from('gerontik_practicum_periods').select('period_id').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(1).maybeSingle());
   const final=await must<any>(db.from('gerontik_finals').select('owner_user_id').eq('owner_user_id',u.user_id).maybeSingle());
   const path='reports/'+u.user_id+'/'+payload.reportId+'.pdf';
   const {error:uploadError}=await db.storage.from(BUCKET).upload(path,bytes,{contentType:'application/pdf',upsert:false});
   if(uploadError)return reply({status:'error',message:'Pengiriman belum selesai. Muat ulang daftar untuk memeriksa, lalu coba kembali.'},409);
   let saved:any=null;
   try{
    for(let attempt=0;attempt<4;attempt++){
     const latest=await must<any>(db.from('gerontik_pdf_reports').select('version').eq('student_user_id',u.user_id).order('version',{ascending:false}).limit(1).maybeSingle());
     const version=(latest?.version||0)+1;
     const name='Askep_Gerontik_'+String(u.nim||'Mahasiswa').replace(/[^a-z0-9_-]/gi,'_')+'_v'+version+'.pdf';
     const {data,error}=await db.from('gerontik_pdf_reports').insert({report_id:payload.reportId,student_user_id:u.user_id,period_id:period?.period_id||null,version,file_name:name,storage_path:path,file_size:bytes.length,sha256:hash,snapshot_status:final?'FINAL':'DRAFT'}).select('*').single();
     if(!error){saved=data;break;}if(error.code!=='23505')throw new Error('metadata');
    }
    if(!saved)throw new Error('version');
   }catch{
    await db.storage.from(BUCKET).remove([path]);
    return reply({status:'error',message:'Laporan belum tersimpan. Silakan coba kembali.'},500);
   }
   return reply({status:'success',report:metadata(saved)});
  }
  if(['open','review','history'].includes(action)){
   if(!uuid(payload.reportId))return reply({status:'error',message:'ID laporan tidak valid.'},400);
   const r=await must<any>(db.from('gerontik_pdf_reports').select('*').eq('report_id',payload.reportId).maybeSingle());
   if(!r||scope&&!scope.includes(r.student_user_id))return reply({status:'error',message:'Laporan tidak tersedia untuk akun ini.'},404);
   if(action==='open'){
    const {data,error}=await db.storage.from(BUCKET).createSignedUrl(r.storage_path,600);
    if(error||!data?.signedUrl)return reply({status:'error',message:'PDF belum dapat dibuka.'},500);
    return reply({status:'success',url:data.signedUrl,fileName:r.file_name,expiresIn:600});
   }
   if(action==='history'){
    const history=await must<any[]>(db.from('gerontik_pdf_report_reviews').select('review_status,feedback,created_at').eq('report_id',r.report_id).order('created_at'));
    return reply({status:'success',history});
   }
   if(!['ADMIN','INSTRUCTOR'].includes(u.role))return reply({status:'error',message:'Review hanya dapat dilakukan dosen.'},403);
   const feedback=String(payload.feedback||'').trim();
   if(!['REVISION','APPROVED'].includes(payload.reviewStatus)||!feedback||feedback.length>10000||!Number.isInteger(payload.revision))return reply({status:'error',message:'Isi catatan review (maksimal 10.000 karakter) dan pilih keputusan.'},400);
   const data=await must<any>(db.from('gerontik_pdf_reports').update({review_status:payload.reviewStatus,feedback,reviewed_by:u.user_id}).eq('report_id',r.report_id).eq('review_revision',payload.revision).select('*').maybeSingle());
   if(!data)return reply({status:'error',message:'Laporan sudah ditinjau pengguna lain. Muat ulang daftar sebelum menyimpan.'},409);
   return reply({status:'success',report:metadata(data)});
  }
  return reply({status:'error',message:'Permintaan tidak dikenal.'},400);
 }catch{console.error('PDF reports request failed');return reply({status:'error',message:'Layanan laporan mengalami kendala. Silakan coba kembali.'},500);}
});
