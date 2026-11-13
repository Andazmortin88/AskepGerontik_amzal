const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(require('node:path').join(__dirname,'../backend/gerontik-learning-api.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const lecturer={id:id(1),email:'indahkeperawatan89@gmail.com',email_confirmed_at:'2026-11-12',identities:[{provider:'google'}]};
const student={id:id(2),email:'student@example.test',email_confirmed_at:'2026-11-12',identities:[{provider:'google'}]};
const roster={id:id(3),auth_user_id:student.id,period:'uji-v7',name:'Mahasiswa Uji',active:true};
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
function harness(user=lecturer,options={}){
 let handler,stored=null,rpcCalls=[],eventRows=structuredClone(options.events||[]),receiptRows=[],writes=[];
 const document={revision:2,state:{competency:[{id:'record-1',method:'DOPS',date:'2026-11-01',action:'Melakukan dengan supervisi'}]}};
 const db={auth:{getUser:async()=>({data:{user},error:null})},from(table){
  const filters=[];let single=false;const query={select(){return this},eq(key,value){filters.push(x=>x[key]===value);return this},is(){return this},in(key,values){filters.push(x=>values.includes(x[key]));return this},order(){return this},limit(){return this},upsert(value,config){writes.push({table,value,config});if(table==='gerontik_learning_login_events'&&!eventRows.some(e=>e.auth_user_id===value.auth_user_id&&e.login_at===value.login_at))eventRows.push({id:id(50),...value});if(table==='gerontik_learning_login_receipts')receiptRows.push(value);return this},update(){return this},maybeSingle(){single=true;return this},then(resolve){let data=null;
   if(table==='gerontik_learning_profiles')data={name:user===lecturer?'Indah Puspitasari':'Mahasiswa Uji',email:user.email,roles:user===lecturer?['lecturer']:['student']};
   if(table==='gerontik_learning_roster')data=[roster];
   if(table==='gerontik_learning_assignments')data=[{roster_id:roster.id}];
   if(table==='gerontik_learning_documents')data=document;
   if(table==='gerontik_learning_document_versions')data={revision:2,state:{competency:[{id:'record-1',method:'DOPS',date:'2026-11-01',action:'Melakukan dengan supervisi'}]}};
   if(table==='gerontik_learning_reviews')data=stored?{id:id(9),...stored}:null;
   if(table==='gerontik_learning_login_events'||table==='gerontik_learning_login_receipts'){data=(table==='gerontik_learning_login_events'?eventRows:receiptRows).filter(x=>filters.every(f=>f(x)));if(single)data=data[0]||null;}return Promise.resolve({data,error:null}).then(resolve);
  }};return query;
 },async rpc(name,payload){rpcCalls.push(payload);const fingerprint=JSON.stringify(canonical(payload));if(stored)return {data:{status:stored.fingerprint===fingerprint?'success':'idempotency_conflict'},error:null};stored={fingerprint,detail:payload.p_detail,scores:payload.p_scores,comment:payload.p_comment,status:payload.p_status,competency_id:payload.p_competency,document_revision:payload.p_expected};return {data:{status:'success'},error:null};}};
 const context={createClient:()=>db,GerontikPractice:require('../practice-schedule.js'),finalMissing:require('../progress.js').portfolioMissing,weekProgress:require('../progress.js').weekProgress,Deno:{env:{get:()=>''},serve:f=>handler=f},Response,Request,Headers,File,TextEncoder,TextDecoder,Uint8Array,structuredClone,crypto,console};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 const call=(payload,options={})=>handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',...(options.noToken?{}:{Authorization:'Bearer test-token'}),...(options.origin?{Origin:options.origin}:{})},body:JSON.stringify(payload)}));
 return {call,rpcCalls,document,eventRows,writes};
}
test('unauthenticated requests cannot access bootstrap',async()=>{const h=harness();const r=await h.call({action:'bootstrap'},{noToken:true});assert.equal(r.status,401);assert.equal(h.rpcCalls.length,0);});
test('foreign origins are rejected',async()=>{const r=await harness().call({action:'bootstrap'},{origin:'https://untrusted.example'});assert.equal(r.status,403);});
test('student cannot import roster',async()=>{const r=await harness(student).call({action:'importRoster',payload:{batchId:id(8),rows:[{name:'Uji'}]}});assert.equal(r.status,403);});
test('lecturer cannot save student document',async()=>{const r=await harness().call({action:'save',payload:{state:{},expectedRevision:0,operationId:id(8)}});assert.equal(r.status,403);});
test('student cannot reopen a FINAL document',async()=>{const h=harness(student);const r=await h.call({action:'reopen',payload:{rosterId:roster.id,expectedRevision:2,operationId:id(8),reason:'Revisi'}});assert.equal(r.status,403);assert.equal(h.rpcCalls.length,0);});
test('incomplete portfolio cannot be finalized through a direct API request',async()=>{const h=harness(student);const r=await h.call({action:'save',payload:{state:{},expectedRevision:0,operationId:id(8),finalize:true}});assert.equal(r.status,400);assert.equal((await r.json()).status,'incomplete');assert.equal(h.rpcCalls.length,0);});
test('review rejects stale document revision',async()=>{const r=await harness().call({action:'review',payload:{rosterId:roster.id,operationId:id(8),expectedRevision:1,competencyId:'record-1',status:'Perlu revisi',comment:'Perbaiki.',detail:{observed:'2026-11-02'}}});assert.equal(r.status,409);});
test('retrying an identical competency review preserves its normalized fingerprint',async()=>{
 const h=harness();const payload={action:'review',payload:{rosterId:roster.id,operationId:id(8),expectedRevision:2,competencyId:'record-1',status:'Terverifikasi',comment:'Observasi sesuai rubrik.',scores:[3,3,3,3,3,3,3],detail:{observed:'2026-11-02',outcome:'Kompeten dalam supervisi'}}};
 const first=await h.call(payload);assert.equal(first.status,200);
 const retry=await h.call(payload);assert.equal(retry.status,200,JSON.stringify(await retry.clone().json()));
 assert.deepEqual(canonical(h.rpcCalls[0]),canonical(h.rpcCalls[1]));
});
test('successful review retry survives a later student edit',async()=>{
 const h=harness();const payload={action:'review',payload:{rosterId:roster.id,operationId:id(8),expectedRevision:2,competencyId:'record-1',status:'Terverifikasi',comment:'Observasi sesuai rubrik.',scores:[3,3,3,3,3,3,3],detail:{observed:'2026-11-02',outcome:'Kompeten dalam supervisi'}}};
 assert.equal((await h.call(payload)).status,200);
 h.document.revision=3;h.document.state.competency[0].method='EBN';
 assert.equal((await h.call(payload)).status,200);
});
test('same operation ID cannot be reused for a different review',async()=>{
 const h=harness();const payload={action:'review',payload:{rosterId:roster.id,operationId:id(8),expectedRevision:2,competencyId:'record-1',status:'Perlu revisi',comment:'Perbaiki keselamatan.',detail:{observed:'2026-11-02'}}};
 assert.equal((await h.call(payload)).status,200);
 payload.payload.comment='Umpan balik berbeda.';
 const retry=await h.call(payload);assert.equal(retry.status,409);assert.equal((await retry.json()).status,'idempotency_conflict');
});


test('students cannot read lecturer login notifications',async()=>{const r=await harness(student).call({action:'loginNotifications'});assert.equal(r.status,403);});
test('lecturer login feed is restricted to assigned roster owners',async()=>{const h=harness(lecturer,{events:[{id:id(50),auth_user_id:student.id,name:'Assigned',login_at:'2026-11-13T01:00:00Z'},{id:id(51),auth_user_id:id(99),name:'Foreign',login_at:'2026-11-13T01:00:00Z'}]});const r=await h.call({action:'loginNotifications'});assert.equal(r.status,200);const body=await r.json();assert.equal(body.events.length,1);assert.equal(body.events[0].auth_user_id,student.id);});
test('lecturer cannot acknowledge a foreign login event',async()=>{const h=harness(lecturer,{events:[{id:id(51),auth_user_id:id(99)}]});const r=await h.call({action:'readLoginNotification',payload:{eventId:id(51)}});assert.equal(r.status,404);assert.equal(h.writes.filter(x=>x.table==='gerontik_learning_login_receipts').length,0);});
test('acknowledgement binds the receipt to the authenticated reader',async()=>{const h=harness(lecturer,{events:[{id:id(50),auth_user_id:student.id}]});const r=await h.call({action:'readLoginNotification',payload:{eventId:id(50),readerId:id(99)}});assert.equal(r.status,200);assert.equal(h.writes.at(-1).value.reader_id,lecturer.id);});
test('login event timestamp comes from Auth and bootstrap retries do not create another event',async()=>{const h=harness({...student,last_sign_in_at:'2026-11-13T01:00:00Z'});for(let i=0;i<2;i++)assert.equal((await h.call({action:'bootstrap',payload:{loginAt:'2099-01-01'}})).status,200);assert.equal(h.eventRows.length,1);assert.equal(h.eventRows[0].login_at,'2026-11-13T01:00:00Z');assert.equal(h.writes[0].config.ignoreDuplicates,true);});
