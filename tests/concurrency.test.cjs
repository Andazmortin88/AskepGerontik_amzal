const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SyncDocument}=require('../sync.js');
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
// In-memory transport deliberately substitutes authentication and Postgres.
// This verifies client concurrency, not Google OAuth or production capacity.
test('100 concurrent synthetic users retain separate documents across save, reload and lecturer readback',async()=>{
 const documents=new Map(),operations=new Map(),storage=store();let active=0,peak=0,saves=0;
 const api=owner=>async(action,p)=>{active++;peak=Math.max(peak,active);await new Promise(setImmediate);try{
  if(action==='load')return {document:structuredClone(documents.get(owner)||null)};
  const op=owner+':'+p.operationId;if(operations.has(op))return operations.get(op);
  const prior=documents.get(owner);if((prior?.revision||0)!==p.expectedRevision)throw Object.assign(new Error('conflict'),{status:409});
  const document={revision:(prior?.revision||0)+1,state:structuredClone(p.state),status:p.finalize?'FINAL':'DRAFT'};documents.set(owner,document);saves++;
  const ack={revision:document.revision,documentStatus:document.status};operations.set(op,ack);return ack;
 }finally{active--;}};
 const clients=Array.from({length:100},(_,i)=>new SyncDocument({key:'synthetic-'+i,storage,api:api(i)}));
 await Promise.all(clients.map(c=>c.initialize()));
 await Promise.all(clients.map(async(c,i)=>{c.change({logs:[{id:'log-'+i,summary:'CASE-'+i,reflection:'REF-'+i}],attendance:[{room:'ROOM-'+i}],clinicalState:{caseCode:'CASE-'+i}});await c.flush();}));
 const reloaded=await Promise.all(clients.map(async(c,i)=>{const fresh=new SyncDocument({key:c.key,storage,api:api(i)});await fresh.initialize();return fresh;}));
 reloaded.forEach((c,i)=>{assert.equal(c.state.logs[0].summary,'CASE-'+i);assert.equal(c.state.attendance[0].room,'ROOM-'+i);assert.equal(documents.get(i).state.clinicalState.caseCode,'CASE-'+i);assert.equal(c.revision,1);assert.equal(c.dirty,false);});
 assert.equal(saves,100);assert.equal(documents.size,100);assert.equal(peak,100);
 console.log(JSON.stringify({mode:'synthetic-in-memory',users:100,peakConcurrentTransportCalls:peak,saves,documents:documents.size,readbackPassed:100,googleLogins:0,productionRequests:0}));
});
test('two devices editing the same student reject the stale write without overwriting the winning data',async()=>{
 let document=null;const api=async(a,p)=>{await new Promise(setImmediate);if(a==='load')return {document:structuredClone(document)};if((document?.revision||0)!==p.expectedRevision)throw Object.assign(new Error('conflict'),{status:409});document={revision:1,state:structuredClone(p.state),status:'DRAFT'};return {revision:1,documentStatus:'DRAFT'};};
 const a=new SyncDocument({key:'device-A',storage:store(),api}),b=new SyncDocument({key:'device-B',storage:store(),api});await Promise.all([a.initialize(),b.initialize()]);a.change({text:'A'});b.change({text:'B'});
 const results=await Promise.allSettled([a.flush(),b.flush()]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(document.state.text,'A');assert.equal(b.localConflict.text,'B');
});
